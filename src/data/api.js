const DEFAULT_API_BASE = "https://lifetimeleveling.onrender.com";
const LOCAL_API_BASE = "http://localhost:4000";
const API_BASE = window.location.hostname === "localhost" ? LOCAL_API_BASE : DEFAULT_API_BASE;

const TOKEN_KEY = "levelup_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(token) {
  if (!token) return;
  localStorage.setItem(TOKEN_KEY, String(token));
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function apiRequest(path, { method = "GET", body = null, token = getToken() } = {}) {
  const headers = {};
  if (body !== null) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== null ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
    }
    if (!res.ok) {
      return { error: data?.error || "request_failed", status: res.status };
    }
    return data;
  } catch {
    return { error: "network_error" };
  }
}

export { API_BASE };
