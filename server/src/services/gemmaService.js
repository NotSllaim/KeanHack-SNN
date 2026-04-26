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

async function callGemma(prompt) {
  if (!hasGemmaConfig()) {
    return null;
  }

  const response = await fetch(`${process.env.GEMMA_API_URL}?key=${process.env.GEMMA_API_KEY}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.8,
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Gemma request failed: ${message}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return text ? parseGemmaJson(text) : null;
}

function parseGemmaJson(text) {
  const trimmed = text.trim();
  const candidates = [
    trimmed,
    trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, ""),
    extractJsonObject(trimmed),
    repairJsonLikeText(extractJsonObject(trimmed))
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (_error) {
      // Try the next cleanup strategy before falling back.
    }
  }

  console.warn("Gemma returned non-JSON output; using fallback analysis.");
  return null;
}

function extractJsonObject(text) {
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  return text.slice(firstBrace, lastBrace + 1);
}

function repairJsonLikeText(text) {
  if (!text) {
    return null;
  }

  return text
    .replace(/,\s*}/g, "}")
    .replace(/,\s*]/g, "]")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'");
}

function fallbackConversation({ userMessage, botId, history = [] }) {
  const bot = findBot(botId);
  const short = userMessage.trim().split(/\s+/).length < 8;
  const fillerWords = [...userMessage.matchAll(/\b(uh|um|uhm|like|you know|sort of|kind of)\b/gi)].map((match) => match[0]);
  const latestAssistant = [...history].reverse().find((item) => item.role === "assistant")?.content || "";
  const botReply = buildFallbackReply({ bot, userMessage, short, latestAssistant });
  const thoughtBubble = buildFallbackThought({ bot, userMessage, short, fillerWords });

  return {
    botReply,
    thoughtBubble,
    feedback: {
      summary: short
        ? "Good start, but the answer needs more detail to keep the conversation alive."
        : "Strong conversational momentum. You added context and made it easier for the other person to continue.",
      strengths: short ? ["Clear and easy to understand"] : ["Added context", "Kept the conversation open"],
      improvements: buildFallbackImprovements({ short, fillerWords, botId }),
      fillerWords,
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
Do not include markdown, code fences, or text outside JSON.
feedback must include summary, strengths array, improvements array, fillerWords array.
scores must include confidence, clarity, engagement, pacing, wording from 0 to 100.
Be honest but encouraging. Sometimes include a socially realistic thoughtBubble.
Pay close attention to the latest user response. Do not repeat your previous assistant message.

Recent chat:
${history.map((item) => `${item.role}: ${item.content}`).join("\n")}

User response:
${userMessage}
`;

  let generated = null;
  try {
    generated = await callGemma(prompt);
  } catch (error) {
    console.warn(`Gemma conversation failed; using fallback: ${error.message}`);
  }

  return isUsableConversationTurn(generated, history)
    ? generated
    : fallbackConversation({ userMessage, botId, history });
}

function isUsableConversationTurn(turn, history = []) {
  if (!turn?.botReply || !turn?.feedback || !turn?.scores) {
    return false;
  }

  const latestAssistant = [...history].reverse().find((item) => item.role === "assistant")?.content?.trim();
  return !latestAssistant || turn.botReply.trim() !== latestAssistant;
}

export async function analyzeReading({ passage, transcript, audioMetrics }) {
  const metricsText = audioMetrics
    ? `
Measured audio delivery metrics:
- Duration: ${audioMetrics.durationSeconds}s
- Speaking time: ${audioMetrics.speakingTimeSeconds}s
- Word count: ${audioMetrics.wordCount}
- Pace: ${audioMetrics.wordsPerMinute} words per minute
- Average volume: ${audioMetrics.averageVolumePercent}/100
- Peak volume: ${audioMetrics.peakVolumePercent}/100
- Volume variation: ${audioMetrics.volumeVariationPercent}/100
- Pause count: ${audioMetrics.pauseCount}
- Longest pause: ${audioMetrics.longestPauseSeconds}s
`
    : "No audio delivery metrics were provided. Base delivery feedback only on the transcript.";

  const prompt = `
Analyze this read-aloud practice response. Return strict JSON with keys feedback and scores.
Do not include markdown, bullet points outside JSON, code fences, commentary, or explanations.
Use exactly this shape:
{
  "feedback": {
    "summary": "string",
    "strengths": ["string"],
    "improvements": ["string"]
  },
  "scores": {
    "confidence": 0,
    "clarity": 0,
    "engagement": 0,
    "pacing": 0,
    "wording": 0
  }
}
Consider pacing, rushing, volume consistency, hesitation, smoothness, confidence, clarity, and flow.
Use the measured audio metrics as direct evidence. A healthy reading pace is usually about 120-160 WPM.
Very low average volume suggests the user may be too quiet. High volume variation suggests uneven delivery.
Frequent or long pauses suggest hesitation or difficulty with phrasing.
feedback must include summary, strengths array, improvements array.
scores must include confidence, clarity, engagement, pacing, wording from 0 to 100.

Passage:
${passage}

Transcript:
${transcript}

${metricsText}
`;

  const generated = await callGemma(prompt);
  const fallbackPacing = scorePacing(audioMetrics?.wordsPerMinute);
  const fallbackClarity = scoreVolume(audioMetrics);
  return generated || {
    feedback: {
      summary: fallbackReadingSummary(audioMetrics),
      strengths: ["Clear enough to follow", "Good effort with complex wording"],
      improvements: fallbackReadingImprovements(audioMetrics)
    },
    scores: { ...fallbackScores, engagement: 68, pacing: fallbackPacing, clarity: fallbackClarity }
  };
}

function buildFallbackReply({ bot, userMessage, short, latestAssistant }) {
  const message = userMessage.toLowerCase();
  const alreadyAskedImportantPart = latestAssistant.toLowerCase().includes("most important part");
  const alreadyAskedSpecificExample = latestAssistant.toLowerCase().includes("specific project, skill, or goal");

  if (short) {
    return avoidRepeat(
      "Give me one more detail there. What is the part you actually want the other person to remember?",
      latestAssistant,
      "Say that again with one concrete detail so I have something to respond to."
    );
  }

  if (bot.id === "theo") {
    if (/\b(microsoft|xbox|internship|full-time|full time|job|built|build|project|app|website|research)\b/.test(message)) {
      return avoidRepeat(
        "That is a big claim, so in a real conversation I would make it more believable by adding scope. What exactly did you build, what tools did you use, and what changed because of your work?",
        latestAssistant,
        "Strong project angle. Now make it credible: give me the role you played, the technology you used, and one measurable result."
      );
    }

    if (message.includes("network") || message.includes("connection")) {
      return avoidRepeat(
        "That is a strong angle for a professional conversation. Try tightening it into one confident sentence: what kind of computer science work are you hoping those connections lead toward?",
        latestAssistant,
        "Good networking point. Now connect it to direction: what kind of role or team are you trying to grow toward?"
      );
    }

    if (message.includes("college") || message.includes("student") || message.includes("school")) {
      const reply = alreadyAskedImportantPart || alreadyAskedSpecificExample
        ? "Good. Now make it more specific: what project, class, or experience would you mention to prove that college is helping you grow?"
        : "That is a useful starting point. What is the most important skill or opportunity college has given you so far?";
      return avoidRepeat(
        reply,
        latestAssistant,
        "Let us move from background to proof. What is one example from school that shows what you can actually do?"
      );
    }

    return avoidRepeat(
      "Nice. I would sharpen that by adding a concrete example. What is one specific project, skill, or goal you could mention next?",
      latestAssistant,
      "That is a decent start. Now give me the next layer: what should I remember about you after this introduction?"
    );
  }

  if (bot.id === "jax") {
    return avoidRepeat(
      "Okay, that has something to work with. Now make it a little less safe: what is the more interesting version of that story?",
      latestAssistant,
      "You gave me the headline. Now give me the part that would make someone laugh, react, or ask a follow-up."
    );
  }

  if (bot.id === "sana") {
    return avoidRepeat(
      "I hear a real value underneath that. What part of it feels most meaningful to you personally?",
      latestAssistant,
      "There is something personal in that. What did that experience teach you about yourself?"
    );
  }

  return avoidRepeat(
    "That gives me a clearer picture. What is one detail you could add that would help me understand you better?",
    latestAssistant,
    "I follow you. What is one detail you have not said yet that would make this feel more vivid?"
  );
}

function avoidRepeat(reply, latestAssistant, alternateReply) {
  return reply.trim() === latestAssistant.trim() ? alternateReply : reply;
}

function buildFallbackThought({ bot, userMessage, short, fillerWords }) {
  if (short) {
    return "They answered clearly, but I would need more detail to keep the conversation natural.";
  }

  if (fillerWords.length > 2) {
    return "They have a solid idea, but the filler words make the confidence feel less steady.";
  }

  if (bot.id === "theo" && /\b(network|connection|college|student|project|skill)\b/i.test(userMessage)) {
    return "This is a good professional thread. They should turn it into a sharper example.";
  }

  return "They gave context, which makes it easier to ask a better follow-up.";
}

function buildFallbackImprovements({ short, fillerWords, botId }) {
  if (short) {
    return ["Add one concrete detail", "Give the other person something easy to ask about"];
  }

  const improvements = botId === "theo"
    ? ["Turn the idea into a concise professional example"]
    : ["End with a question more often"];

  if (fillerWords.length > 1) {
    improvements.push("Pause briefly instead of filling space with filler words");
  }

  return improvements;
}

function scorePacing(wordsPerMinute = 0) {
  if (!wordsPerMinute) {
    return 70;
  }

  if (wordsPerMinute >= 120 && wordsPerMinute <= 160) {
    return 88;
  }

  if (wordsPerMinute >= 95 && wordsPerMinute <= 185) {
    return 74;
  }

  return 58;
}

function scoreVolume(audioMetrics) {
  if (!audioMetrics) {
    return 78;
  }

  const volume = audioMetrics.averageVolumePercent || 0;
  const variation = audioMetrics.volumeVariationPercent || 0;
  const volumeScore = volume >= 18 && volume <= 75 ? 84 : 66;
  const consistencyPenalty = variation > 18 ? 12 : 0;
  return Math.max(50, volumeScore - consistencyPenalty);
}

function fallbackReadingSummary(audioMetrics) {
  if (!audioMetrics) {
    return "Your delivery was understandable. Record audio to get pace, volume, and pause feedback.";
  }

  return `Your reading pace was ${audioMetrics.wordsPerMinute} WPM with an average volume of ${audioMetrics.averageVolumePercent}/100. Use that as your baseline while working toward a steady, clear read-aloud delivery.`;
}

function fallbackReadingImprovements(audioMetrics) {
  if (!audioMetrics) {
    return ["Record your reading to measure pace and volume", "Pause naturally at commas and sentence endings"];
  }

  const improvements = [];
  if (audioMetrics.wordsPerMinute < 120) {
    improvements.push("Increase pace slightly while keeping each word clear");
  } else if (audioMetrics.wordsPerMinute > 160) {
    improvements.push("Slow down a little so longer sentences have room to breathe");
  } else {
    improvements.push("Keep practicing this steady pace range");
  }

  if (audioMetrics.averageVolumePercent < 18) {
    improvements.push("Speak a little louder and project through the end of each sentence");
  } else if (audioMetrics.volumeVariationPercent > 18) {
    improvements.push("Keep your volume more consistent between phrases");
  } else {
    improvements.push("Maintain your current volume consistency");
  }

  if (audioMetrics.pauseCount > 3 || audioMetrics.longestPauseSeconds > 1.5) {
    improvements.push("Reduce long pauses by previewing difficult phrases before reading");
  }

  return improvements;
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

