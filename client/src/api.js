const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export function getToken() {
  return localStorage.getItem("lingo_token");
}

export function setToken(token) {
  if (token) {
    localStorage.setItem("lingo_token", token);
  } else {
    localStorage.removeItem("lingo_token");
  }
}

export async function api(path, options = {}) {
  const headers = {
    ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...options.headers
  };
  const token = getToken();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

export function playAudio({ audioBase64, contentType, text }) {
  if (!audioBase64 || !contentType) {
    return speakWithBrowserVoice(text);
  }

  const audio = new Audio(`data:${contentType};base64,${audioBase64}`);
  return new Promise((resolve) => {
    audio.onended = resolve;
    audio.onerror = resolve;
    audio.play().catch(resolve);
  });
}

function speakWithBrowserVoice(text) {
  if (!text || !window.speechSynthesis || !window.SpeechSynthesisUtterance) {
    return Promise.resolve();
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.volume = 1;

  return new Promise((resolve) => {
    utterance.onend = resolve;
    utterance.onerror = resolve;
    window.speechSynthesis.speak(utterance);
  });
}

