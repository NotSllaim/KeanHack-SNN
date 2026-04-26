function hasDeepgramConfig() {
  return Boolean(process.env.DEEPGRAM_API_KEY);
}

let ttsFallbackReason = null;

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

  if (!hasDeepgramConfig()) {
    return {
      audioBase64: null,
      contentType: null,
      text,
      provider: "browser-speech",
      fallbackReason: "Deepgram API key is not configured",
      demo: true
    };
  }

  const model = getDeepgramVoiceModel(options.botId);

  try {
    const response = await fetch(`https://api.deepgram.com/v1/speak?model=${model}&encoding=mp3`, {
      method: "POST",
      headers: {
        "Authorization": `Token ${process.env.DEEPGRAM_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text
      })
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
