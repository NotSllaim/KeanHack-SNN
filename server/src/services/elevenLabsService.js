function hasElevenLabsConfig() {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

let ttsFallbackReason = null;

export async function textToSpeech(text) {
  if (!text?.trim()) {
    return browserSpeechFallback("", "No text was provided for speech");
  }

  if (ttsFallbackReason) {
    return browserSpeechFallback(text, ttsFallbackReason);
  }

  if (!hasElevenLabsConfig()) {
    return browserSpeechFallback(text, "ElevenLabs API key is not configured");
  }

  const voiceId = process.env.ELEVENLABS_TTS_VOICE_ID;
  if (!voiceId) {
    return browserSpeechFallback(text, "ElevenLabs voice id is not configured");
  }

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": process.env.ELEVENLABS_API_KEY
    },
    body: JSON.stringify({
      text,
      model_id: process.env.ELEVENLABS_TTS_MODEL_ID || "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.55,
        similarity_boost: 0.75
      }
    })
  });

  if (!response.ok) {
    const message = await response.text();
    if (message.includes("paid_plan_required") || message.includes("payment_required")) {
      ttsFallbackReason = message;
      console.warn("ElevenLabs TTS requires a paid voice for the configured voice id. Browser speech fallback is now active.");
    } else {
      console.warn(`ElevenLabs text to speech failed; falling back to browser speech: ${message}`);
    }
    return browserSpeechFallback(text, message);
  }

  const contentType = response.headers.get("content-type") || "audio/mpeg";
  const audioBuffer = Buffer.from(await response.arrayBuffer());
  return { audioBase64: audioBuffer.toString("base64"), contentType, text, provider: "elevenlabs", demo: false };
}

function browserSpeechFallback(text, reason) {
  return {
    audioBase64: null,
    contentType: null,
    text,
    provider: "browser-speech",
    fallbackReason: reason,
    demo: true
  };
}

export async function speechToText(file) {
  if (!hasElevenLabsConfig()) {
    return {
      text: "This is a demo transcript. Add your ElevenLabs API key to transcribe microphone audio.",
      demo: true
    };
  }

  const formData = new FormData();
  formData.append("model_id", process.env.ELEVENLABS_STT_MODEL_ID || "scribe_v1");
  formData.append("file", new Blob([file.buffer], { type: file.mimetype }), file.originalname || "speech.webm");

  const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: {
      "xi-api-key": process.env.ELEVENLABS_API_KEY
    },
    body: formData
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`ElevenLabs speech to text failed: ${message}`);
  }

  const data = await response.json();
  return { text: data.text || "", demo: false };
}

