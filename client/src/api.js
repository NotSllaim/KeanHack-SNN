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

export function playAudio({ audioBase64, contentType }) {
  if (!audioBase64 || !contentType) {
    return;
  }

  const audio = new Audio(`data:${contentType};base64,${audioBase64}`);
  audio.play();
}

