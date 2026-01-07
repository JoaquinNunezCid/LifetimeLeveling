import { lifeForLevel } from "../core/leveling.js";
import { apiRequest, getToken } from "./api.js";

const LEGACY_KEY = "levelup_app_state";
const LEGACY_MIGRATED_KEY = "levelup_legacy_migrated";
const KEY_PREFIX = "levelup_user_state_";
const SCHEMA = 1;
const SAVE_DEBOUNCE_MS = 500;
let pendingState = null;
let saveTimer = null;

function defaultTraining() {
  return [
    { id: "flexiones", name: "Flexiones", reps: "3x12", done: 0 },
    { id: "sentadillas", name: "Sentadillas", reps: "4x15", done: 0 },
    { id: "plancha", name: "Plancha", reps: "3x30s", done: 0 },
    { id: "abdominales", name: "Abdominales", reps: "3x20", done: 0 },
  ];
}

function defaultTrainingWeek() {
  return {
    monday: defaultTraining(),
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
  };
}

function defaultState() {
  return {
    schema: SCHEMA,
    user: { name: "Invitado" },
    progress: { level: 1, xp: 0 },
    life: { current: lifeForLevel(1), lastPenaltyDate: "", lastDefeatDate: "" },
    tokens: 0,
    daily: { date: "", actions: {}, bonusCategories: {}, goalsDone: {}, skipUsed: false }, // se normaliza con ensureDaily()
    history: { days: {} },
    goals: {
      waterLiters: 0,
      calories: 0,
      exerciseMinutes: 0,
      readMinutes: 0,
      studyMinutes: 0,
      steps: 0,
    },
    tasks: [],
    training: defaultTrainingWeek(),
    achievements: [],
  };
}

function safeParse(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

function migrate(state) {
  // En el futuro:
  // if (state.schema === 0) { ...; state.schema = 1; }
  // Por ahora, sólo validamos shape mínima:
  const base = defaultState();
  const s = { ...base, ...(state || {}) };

  if (!s.user || typeof s.user.name !== "string") s.user = base.user;
  if (!s.progress || typeof s.progress.level !== "number" || typeof s.progress.xp !== "number") s.progress = base.progress;
  if (!s.life || typeof s.life !== "object") {
    s.life = { ...base.life, current: lifeForLevel(s.progress?.level || 1) };
  } else {
    const current = Number(s.life.current);
    s.life.current = Number.isFinite(current) ? current : lifeForLevel(s.progress?.level || 1);
    if (typeof s.life.lastPenaltyDate !== "string") s.life.lastPenaltyDate = "";
    if (typeof s.life.lastDefeatDate !== "string") s.life.lastDefeatDate = "";
  }
  if (!Number.isFinite(s.tokens)) s.tokens = base.tokens;
  if (!s.daily || typeof s.daily !== "object") s.daily = base.daily;
  if (!s.daily.bonusCategories || typeof s.daily.bonusCategories !== "object") {
    s.daily.bonusCategories = base.daily.bonusCategories;
  }
  if (!s.daily.goalsDone || typeof s.daily.goalsDone !== "object") {
    s.daily.goalsDone = base.daily.goalsDone;
  }
  if (typeof s.daily.skipUsed !== "boolean") {
    s.daily.skipUsed = base.daily.skipUsed;
  }
  if (!s.history || typeof s.history !== "object") s.history = base.history;
  if (!s.history.days || typeof s.history.days !== "object") s.history.days = base.history.days;
  if (!s.goals || typeof s.goals !== "object") s.goals = base.goals;
  if (!Array.isArray(s.tasks)) s.tasks = base.tasks;
  if (Array.isArray(s.training)) {
    s.training = {
      monday: s.training,
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: [],
    };
  }
  if (!s.training || typeof s.training !== "object") s.training = base.training;
  const trainingDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  trainingDays.forEach((day) => {
    if (!Array.isArray(s.training[day])) s.training[day] = [];
    s.training[day] = s.training[day].map((item) => {
      if (!item || typeof item !== "object") return { id: String(Date.now()), name: "", reps: "", done: 0 };
      const done = Number(item.done ?? 0);
      return {
        ...item,
        done: Number.isFinite(done) && done >= 0 ? Math.floor(done) : 0,
      };
    });
  });
  if (!Array.isArray(s.achievements)) s.achievements = base.achievements;

  s.schema = SCHEMA;
  return s;
}

function userKey(userId) {
  return `${KEY_PREFIX}${userId}`;
}

function hasAnyUserState() {
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i) || "";
    if (key.startsWith(KEY_PREFIX)) return true;
  }
  return false;
}

export function loadState(userId) {
  if (!userId) return defaultState();
  const key = userKey(userId);
  const raw = localStorage.getItem(key);
  if (!raw) {
    return defaultState();
  }

  const parsed = safeParse(raw);
  if (!parsed) return defaultState();

  return migrate(parsed);
}

export function saveState(userId, state) {
  if (!userId) return;
  localStorage.setItem(userKey(userId), JSON.stringify(state));
  pendingState = state;
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const snapshot = pendingState;
    pendingState = null;
    if (!snapshot || !getToken()) return;
    void apiRequest("/api/state", { method: "PUT", body: { state: snapshot } });
  }, SAVE_DEBOUNCE_MS);
}

export function resetUserState(userId, name) {
  if (!userId) return null;
  const next = defaultState();
  if (typeof name === "string" && name.trim()) {
    next.user = { ...next.user, name: name.trim() };
  }
  saveState(userId, next);
  return next;
}

export function clearUserStatesExcept(keepUserId) {
  const keepKey = keepUserId ? userKey(keepUserId) : "";
  const keys = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i) || "";
    if (key.startsWith(KEY_PREFIX)) keys.push(key);
  }
  keys.forEach((key) => {
    if (key !== keepKey) localStorage.removeItem(key);
  });
}

export function migrateLegacyState(userId) {
  if (!userId) return null;
  if (localStorage.getItem(LEGACY_MIGRATED_KEY)) return null;
  if (hasAnyUserState()) return null;

  const legacy = localStorage.getItem(LEGACY_KEY);
  if (!legacy) return null;
  const parsedLegacy = safeParse(legacy);
  if (!parsedLegacy) return null;

  const migrated = migrate(parsedLegacy);
  saveState(userId, migrated);
  localStorage.removeItem(LEGACY_KEY);
  localStorage.setItem(LEGACY_MIGRATED_KEY, "1");
  return migrated;
}

export async function fetchState() {
  if (!getToken()) return null;
  const res = await apiRequest("/api/state");
  if (res?.state) return migrate(res.state);
  return null;
}

export async function resetRemoteState(name) {
  if (!getToken()) return null;
  const res = await apiRequest("/api/state/reset", { method: "POST", body: { name } });
  if (res?.state) return migrate(res.state);
  return null;
}
