import { apiRequest, clearToken, getToken, setToken } from "./api.js";

const USER_KEY = "levelup_current_user";
const DEV_SHORTCUT_USER = "admin";
const DEV_SHORTCUT_PASS = "admin";
const DEV_LOCAL_USER = {
  id: "local-admin",
  name: "Admin",
  email: DEV_SHORTCUT_USER,
  avatar: "",
};

function safeParse(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

function saveUser(user) {
  if (!user) return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function loadUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  return safeParse(raw);
}

function clearUser() {
  localStorage.removeItem(USER_KEY);
}

export function isLocalDevHost() {
  const host = window?.location?.hostname || "";
  return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";
}

export function isDevShortcutEmail(email) {
  if (!isLocalDevHost()) return false;
  return String(email || "").trim().toLowerCase() === DEV_SHORTCUT_USER;
}

export async function createUser({ name, email, password, passwordConfirm }) {
  const payload = {
    name: String(name || "").trim(),
    email: String(email || "").trim().toLowerCase(),
    password: String(password || "").trim(),
    passwordConfirm: String(passwordConfirm || "").trim(),
  };
  const res = await apiRequest("/api/auth/register", { method: "POST", body: payload });
  if (res?.token && res?.user) {
    setToken(res.token);
    saveUser(res.user);
    return { user: res.user };
  }
  return res;
}

export async function authenticate(email, password) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanPass = String(password || "").trim();
  if (isLocalDevHost() && cleanEmail === DEV_SHORTCUT_USER && cleanPass === DEV_SHORTCUT_PASS) {
    clearToken();
    saveUser(DEV_LOCAL_USER);
    return { user: DEV_LOCAL_USER };
  }
  const payload = {
    email: cleanEmail,
    password: cleanPass,
  };
  const res = await apiRequest("/api/auth/login", { method: "POST", body: payload });
  if (res?.token && res?.user) {
    setToken(res.token);
    saveUser(res.user);
    return { user: res.user };
  }
  return res;
}

export function getCurrentUser() {
  return loadUser();
}

export async function fetchCurrentUser() {
  if (!getToken()) return null;
  const res = await apiRequest("/api/auth/me");
  if (res?.user) {
    saveUser(res.user);
    return res.user;
  }
  if (res?.error) {
    clearSession();
    return null;
  }
  return null;
}

export function isAdminUser() {
  const user = getCurrentUser();
  const email = String(user?.email || "").trim().toLowerCase();
  return email === "asd@asd.com.ar";
}

export async function updateUserProfile({ id, name, avatar }) {
  const payload = {};
  const cleanName = String(name || "").trim();
  if (cleanName) payload.name = cleanName;
  if (avatar !== undefined) payload.avatar = avatar;
  if (!Object.keys(payload).length) {
    const cached = loadUser();
    if (cached) return { user: cached };
    return { error: "invalid_input" };
  }
  const res = await apiRequest("/api/auth/me", { method: "PATCH", body: payload });
  if (res?.user) {
    saveUser(res.user);
    return { user: res.user };
  }
  if (!res?.error && id) {
    const cached = loadUser();
    if (cached) return { user: cached };
  }
  return res;
}

export async function updateUserPassword({ id, password, passwordConfirm }) {
  const cleanPass = String(password || "").trim();
  if (!cleanPass) return { error: "invalid_input" };
  const cleanConfirm = String(passwordConfirm || "").trim();
  const res = await apiRequest("/api/auth/me/password", {
    method: "PATCH",
    body: { password: cleanPass, passwordConfirm: cleanConfirm },
  });
  if (res?.ok) return { ok: true };
  if (!res?.error && id) return { ok: true };
  return res;
}

export function clearSession() {
  clearToken();
  clearUser();
}

export function resetAuthToAdmin() {
  const admin = getCurrentUser();
  if (!admin || String(admin.email || "").trim().toLowerCase() !== "asd@asd.com.ar") {
    return { error: "admin_not_found" };
  }
  return { admin };
}
