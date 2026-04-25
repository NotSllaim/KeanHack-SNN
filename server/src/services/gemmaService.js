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

function extractJson(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function callGemma(prompt) {
  if (!hasGemmaConfig()) {
    return null;
  }

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
            parts: [{ text: `${prompt}\n\nRespond with ONLY a single JSON object. No prose, no markdown fences, no commentary.` }]
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
    return extractJson(text);
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
  const prompt = `
You are ${bot.name}, a ${bot.style} AI conversation practice partner.
Return strict JSON with keys: botReply, thoughtBubble, feedback, scores.
feedback must include summary, strengths array, improvements array, fillerWords array.
scores must include confidence, clarity, engagement, pacing, wording from 0 to 100.
Be honest but encouraging. Sometimes include a socially realistic thoughtBubble.

Recent chat:
${history.map((item) => `${item.role}: ${item.content}`).join("\n")}

User response:
${userMessage}
`;

  const generated = await callGemma(prompt);
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

  const generated = await callGemma(prompt);
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

  const generated = await callGemma(prompt);
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

