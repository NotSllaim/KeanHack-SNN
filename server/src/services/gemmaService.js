import { findBot } from "../data/bots.js";

const fallbackScores = {
  confidence: 74,
  clarity: 78,
  engagement: 72,
  pacing: 70,
  wording: 76
};

function hasGemmaConfig() {
  return Boolean(process.env.GEMMA_API_KEY && process.env.GEMMA_API_URL);
}

function findBalancedObjects(text) {
  const objects = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "{") continue;
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let j = i; j < text.length; j++) {
      const ch = text[j];
      if (escape) { escape = false; continue; }
      if (ch === "\\") { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          objects.push(text.slice(i, j + 1));
          break;
        }
      }
    }
  }
  return objects;
}

function extractJson(text, requiredKey = "scores") {
  if (!text) return null;
  const candidates = findBalancedObjects(text);
  let best = null;
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && requiredKey in parsed) {
        if (!best || candidate.length > best.length) {
          best = { length: candidate.length, parsed };
        }
      }
    } catch {
      // skip non-JSON braces
    }
  }
  return best ? best.parsed : null;
}

function pickField(text, name) {
  const patterns = [
    new RegExp(`[*\\-\\s]*\`?${name}\`?\\s*:\\s*"([^"]+)"`, "i"),
    new RegExp(`[*\\-\\s]*\`?${name}\`?\\s*:\\s*([^\\n]+)`, "i")
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim().replace(/^["'`]|["'`]$/g, "");
  }
  return null;
}

function pickArray(text, name) {
  const re = new RegExp(`[*\\-\\s]*\`?${name}\`?\\s*:\\s*(\\[[^\\]]*\\])`, "i");
  const m = text.match(re);
  if (m) {
    try { return JSON.parse(m[1]); } catch { /* fall through */ }
  }
  return null;
}

function pickScore(text, name) {
  const re = new RegExp(`\`?${name}\`?\\s*:\\s*(\\d{1,3})`, "i");
  const m = text.match(re);
  return m ? Math.min(100, Math.max(0, Number(m[1]))) : null;
}

function parseBulletConversation(text) {
  if (!text) return null;
  const scoreFields = ["confidence", "clarity", "engagement", "pacing", "wording"];
  const scores = {};
  for (const f of scoreFields) {
    const v = pickScore(text, f);
    if (v === null) return null;
    scores[f] = v;
  }
  return {
    botReply: pickField(text, "botReply") || pickField(text, "bot reply"),
    thoughtBubble: pickField(text, "thoughtBubble") || pickField(text, "thought bubble") || "",
    feedback: {
      summary: pickField(text, "summary") || "",
      strengths: pickArray(text, "strengths") || [],
      improvements: pickArray(text, "improvements") || [],
      fillerWords: pickArray(text, "fillerWords") || pickArray(text, "filler words") || []
    },
    scores
  };
}

async function callGemma(prompt, exampleOutput, bulletFallback) {
  if (!hasGemmaConfig()) {
    return null;
  }

  const fullPrompt = `${prompt}

CRITICAL OUTPUT RULES:
- Your entire response must be a single raw JSON object.
- Start with { and end with }. No prose before or after. No markdown fences. No bullet points. No "here is the JSON" preamble.
- Do not narrate your reasoning. Just emit the JSON.

Here is an example of the EXACT format your response must take (structure only — generate your own values for the actual input):
${exampleOutput}

Now produce the JSON object for the actual input above:`;

  try {
    const response = await fetch(`${process.env.GEMMA_API_URL}?key=${process.env.GEMMA_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: fullPrompt }]
          }
        ],
        generationConfig: {
          temperature: 0.8
        }
      })
    });

    if (!response.ok) {
      const message = await response.text();
      console.error(`Gemma request failed (${response.status}):`, message);
      return null;
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    const json = extractJson(text);
    if (json) return json;
    if (bulletFallback) {
      const parsed = bulletFallback(text);
      if (parsed) return parsed;
    }
    console.warn("Gemma returned unparseable response (first 300 chars):", text?.slice(0, 300));
    return null;
  } catch (error) {
    console.error("Gemma call errored:", error);
    return null;
  }
}

function fallbackConversation(userMessage, botId) {
  const bot = findBot(botId);
  const short = userMessage.trim().split(/\s+/).length < 8;

  return {
    botReply: short
      ? "I want to hear a little more. What made that stand out to you?"
      : "That gives me a clearer picture. I like that you added some context. What would you say is the most important part of that experience?",
    thoughtBubble: short
      ? "They gave me something to work with, but it would feel more natural if they added a detail or asked me something back."
      : "They sounded more engaged here, especially because they gave context instead of only answering the surface question.",
    feedback: {
      summary: short
        ? "Good start, but the answer needs more detail to keep the conversation alive."
        : "Strong conversational momentum. You added context and made it easier for the other person to continue.",
      strengths: short ? ["Clear and easy to understand"] : ["Added context", "Kept the conversation open"],
      improvements: short ? ["Add one concrete detail", "Ask a follow-up question"] : ["End with a question more often"],
      fillerWords: [...userMessage.matchAll(/\b(uh|um|like)\b/gi)].map((match) => match[0]),
      thoughtBubble: ""
    },
    scores: {
      ...fallbackScores,
      engagement: short ? 58 : 82,
      confidence: short ? 65 : 80
    },
    botName: bot.name,
    botStyle: bot.style
  };
}

export async function generateConversationTurn({ botId, history, userMessage }) {
  const bot = findBot(botId);
  const recentHistory = (history || []).slice(-6);
  const prompt = `
You are ${bot.name}, a ${bot.style} AI conversation practice partner.
Return strict JSON with keys: botReply, thoughtBubble, feedback, scores.

SCORING RULES (read carefully):
- feedback and scores must evaluate ONLY the user's latest utterance below, treated as a standalone speech sample.
- Do NOT carry over scores from prior turns. Do NOT average across the conversation. Each utterance is a fresh speaker who could be anyone.
- Judge this utterance on its own merits: word choice, specificity, filler words, length, structure, energy.
- Two different utterances should produce noticeably different scores when their delivery differs.

feedback must include summary, strengths array, improvements array, fillerWords array.
scores must include confidence, clarity, engagement, pacing, wording from 0 to 100.
Be honest but encouraging. Sometimes include a socially realistic thoughtBubble.

botReply should respond naturally to the latest utterance, using the recent chat only for conversational context.

Recent chat (for context only, not for scoring):
${recentHistory.map((item) => `${item.role}: ${item.content}`).join("\n")}

User's latest utterance (score THIS):
${userMessage}
`;

  const example = `{"botReply":"That sounds like a real challenge. What part of it surprised you the most?","thoughtBubble":"They opened up a bit, but I want them to go deeper.","feedback":{"summary":"You answered directly but stayed surface-level.","strengths":["Direct response","Honest tone"],"improvements":["Add a concrete example","Vary sentence length"],"fillerWords":["um","like"]},"scores":{"confidence":72,"clarity":78,"engagement":65,"pacing":74,"wording":70}}`;

  const generated = await callGemma(prompt, example, parseBulletConversation);
  return generated || fallbackConversation(userMessage, botId);
}

export async function analyzeReading({ passage, transcript }) {
  const prompt = `
Analyze this read-aloud practice response. Return strict JSON with keys feedback and scores.
Consider pacing, rushing, volume consistency, hesitation, smoothness, confidence, clarity, and flow.
feedback must include summary, strengths array, improvements array.
scores must include confidence, clarity, engagement, pacing, wording from 0 to 100.

Passage:
${passage}

Transcript:
${transcript}
`;

  const example = `{"feedback":{"summary":"Steady delivery with a few rushed phrases.","strengths":["Clear articulation","Good volume"],"improvements":["Pause at commas","Slow down on longer sentences"]},"scores":{"confidence":75,"clarity":80,"engagement":70,"pacing":68,"wording":76}}`;

  const generated = await callGemma(prompt, example);
  return generated || {
    feedback: {
      summary: "Your delivery was understandable. Focus next on steadier pacing and more confident endings on longer sentences.",
      strengths: ["Clear enough to follow", "Good effort with complex wording"],
      improvements: ["Pause at commas", "Keep volume steady through the end of each sentence"]
    },
    scores: { ...fallbackScores, engagement: 68, pacing: 72 }
  };
}

export async function analyzeVerbiage({ promptText, responseText }) {
  const prompt = `
Analyze this response for stronger verbiage. Return strict JSON with keys feedback and scores.
feedback must include summary, strengths array, improvements array, and highlights array.
Each highlight must include text, reason, suggestion.
Look for weak phrasing, repetition, filler, vague claims, and missed chances to sound engaging.
scores must include confidence, clarity, engagement, pacing, wording from 0 to 100.

Prompt:
${promptText}

Response:
${responseText}
`;

  const example = `{"feedback":{"summary":"Clear answer, but several phrases could be sharper.","strengths":["Answered the prompt","Friendly tone"],"improvements":["Replace vague words","Trim filler"],"highlights":[{"text":"kind of","reason":"Hedges your point.","suggestion":"State the idea directly."},{"text":"stuff","reason":"Too vague.","suggestion":"Name the specific thing."}]},"scores":{"confidence":70,"clarity":74,"engagement":68,"pacing":75,"wording":65}}`;

  const generated = await callGemma(prompt, example);
  return generated || {
    feedback: {
      summary: "The response is understandable, but it would sound stronger with more specific language and a cleaner closing idea.",
      strengths: ["Direct answer", "Friendly tone"],
      improvements: ["Replace vague phrases with concrete examples", "Trim filler words"],
      highlights: [
        {
          text: "I think",
          reason: "This can soften your point when overused.",
          suggestion: "State the idea directly when you are confident."
        },
        {
          text: "stuff",
          reason: "This sounds vague and misses a chance to be specific.",
          suggestion: "Name the exact action, feeling, or result."
        }
      ]
    },
    scores: { ...fallbackScores, wording: 70 }
  };
}

