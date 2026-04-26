function hasDeepgramConfig() {
  return Boolean(process.env.DEEPGRAM_API_KEY);
}

function hasElevenLabsTtsConfig() {
  return Boolean(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_TTS_VOICE_ID);
}

const botVoiceModels = {
  sana: process.env.DEEPGRAM_TTS_SANA_MODEL_ID || "aura-2-athena-en",
  theo: process.env.DEEPGRAM_TTS_THEO_MODEL_ID || "aura-2-orpheus-en",
  jax: process.env.DEEPGRAM_TTS_JAX_MODEL_ID || "aura-2-apollo-en",
  mira: process.env.DEEPGRAM_TTS_MIRA_MODEL_ID || "aura-2-vesta-en"
};

export async function textToSpeech(text, options = {}) {
  if (!text?.trim()) {
    return {
      audioBase64: null,
      contentType: null,
      text: "",
      provider: "deepgram",
      fallbackReason: "No text was provided for speech",
      demo: true
    };
  }

  if (hasDeepgramConfig()) {
    const deepgramResult = await deepgramTextToSpeech(text, options);
    if (deepgramResult.audioBase64) {
      return deepgramResult;
    }
    const elevenResult = await elevenLabsTextToSpeech(text);
    if (elevenResult.audioBase64) {
      return elevenResult;
    }
    return deepgramResult;
  }

  if (hasElevenLabsTtsConfig()) {
    return elevenLabsTextToSpeech(text);
  }

  return {
    audioBase64: null,
    contentType: null,
    text,
    provider: "browser-speech",
    fallbackReason: "No TTS provider configured (set DEEPGRAM_API_KEY or ELEVENLABS_API_KEY)",
    demo: true
  };
}

async function deepgramTextToSpeech(text, options = {}) {
  const model = getDeepgramVoiceModel(options.botId);

  try {
    const response = await fetch(`https://api.deepgram.com/v1/speak?model=${model}&encoding=mp3`, {
      method: "POST",
      headers: {
        "Authorization": `Token ${process.env.DEEPGRAM_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      const message = await response.text();
      console.warn(`Deepgram text to speech failed: ${message}`);
      return {
        audioBase64: null,
        contentType: null,
        text,
        provider: "browser-speech",
        fallbackReason: message,
        demo: true
      };
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    return {
      audioBase64: audioBuffer.toString("base64"),
      contentType: "audio/mpeg",
      text,
      provider: "deepgram",
      voiceModel: model,
      demo: false
    };
  } catch (error) {
    console.error("Deepgram TTS error:", error);
    return {
      audioBase64: null,
      contentType: null,
      text,
      provider: "browser-speech",
      fallbackReason: error.message,
      demo: true
    };
  }
}

async function elevenLabsTextToSpeech(text) {
  if (!hasElevenLabsTtsConfig()) {
    return {
      audioBase64: null,
      contentType: null,
      text,
      provider: "browser-speech",
      fallbackReason: "ElevenLabs TTS is not configured",
      demo: true
    };
  }

  const voiceId = process.env.ELEVENLABS_TTS_VOICE_ID;
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": process.env.ELEVENLABS_API_KEY
      },
      body: JSON.stringify({
        text,
        model_id: process.env.ELEVENLABS_TTS_MODEL_ID || "eleven_multilingual_v2",
        voice_settings: { stability: 0.55, similarity_boost: 0.75 }
      })
    });

    if (!response.ok) {
      const message = await response.text();
      console.warn(`ElevenLabs text to speech failed: ${message}`);
      return {
        audioBase64: null,
        contentType: null,
        text,
        provider: "browser-speech",
        fallbackReason: message,
        demo: true
      };
    }

    const contentType = response.headers.get("content-type") || "audio/mpeg";
    const audioBuffer = Buffer.from(await response.arrayBuffer());
    return {
      audioBase64: audioBuffer.toString("base64"),
      contentType,
      text,
      provider: "elevenlabs",
      voiceModel: voiceId,
      demo: false
    };
  } catch (error) {
    console.error("ElevenLabs TTS error:", error);
    return {
      audioBase64: null,
      contentType: null,
      text,
      provider: "browser-speech",
      fallbackReason: error.message,
      demo: true
    };
  }
}

function getDeepgramVoiceModel(botId) {
  return botVoiceModels[botId] || process.env.DEEPGRAM_TTS_MODEL_ID || "aura-2-arcas-en";
}

export async function speechToText(file) {
  if (!process.env.ELEVENLABS_API_KEY) {
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
