const KEY = "levelup_auth_db";
const SCHEMA = 1;

function defaultDb() {
  return {
    schema: SCHEMA,
    users: [],
    session: { currentUserId: null },
  };
}

function safeParse(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

function loadDb() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return defaultDb();
  const parsed = safeParse(raw);
  if (!parsed) return defaultDb();
  const base = defaultDb();
  const db = { ...base, ...parsed };
  if (!Array.isArray(db.users)) db.users = [];
  if (!db.session || typeof db.session !== "object") db.session = base.session;
  db.schema = SCHEMA;
  return db;
}

function saveDb(db) {
  localStorage.setItem(KEY, JSON.stringify(db));
}

export function createUser({ name, email, password }) {
  const db = loadDb();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const cleanName = String(name || "").trim();
  const cleanPass = String(password || "").trim();

  if (!normalizedEmail || !cleanPass) {
    return { error: "invalid_input" };
  }

  if (db.users.some(u => u.email === normalizedEmail)) {
    return { error: "email_taken" };
  }

  const id = (crypto?.randomUUID?.() ?? String(Date.now()));
  const user = {
    id,
    name: cleanName || "Usuario",
    email: normalizedEmail,
    password: cleanPass,
    createdAt: new Date().toISOString(),
  };

  db.users.unshift(user);
  db.session.currentUserId = id;
  saveDb(db);
  return { user };
}

export function authenticate(email, password) {
  const db = loadDb();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const cleanPass = String(password || "").trim();
  const user = db.users.find(u => u.email === normalizedEmail && u.password === cleanPass);
  if (!user) return { error: "invalid_credentials" };
  db.session.currentUserId = user.id;
  saveDb(db);
  return { user };
}

export function getCurrentUser() {
  const db = loadDb();
  const id = db.session?.currentUserId;
  if (!id) return null;
  return db.users.find(u => u.id === id) || null;
}

export function isAdminUser() {
  const user = getCurrentUser();
  const email = String(user?.email || "").trim().toLowerCase();
  return email === "asd@asd.com.ar";
}

export function updateUserProfile({ id, name, avatar }) {
  const db = loadDb();
  const idx = db.users.findIndex(u => u.id === id);
  if (idx < 0) return { error: "not_found" };
  const cleanName = String(name || "").trim();
  const next = { ...db.users[idx] };
  if (cleanName) next.name = cleanName;
  if (avatar !== undefined) next.avatar = avatar;
  db.users[idx] = next;
  saveDb(db);
  return { user: next };
}

export function updateUserPassword({ id, password }) {
  const db = loadDb();
  const idx = db.users.findIndex(u => u.id === id);
  if (idx < 0) return { error: "not_found" };
  const cleanPass = String(password || "").trim();
  if (!cleanPass) return { error: "invalid_input" };
  db.users[idx] = { ...db.users[idx], password: cleanPass };
  saveDb(db);
  return { user: db.users[idx] };
}

export function clearSession() {
  const db = loadDb();
  db.session.currentUserId = null;
  saveDb(db);
}

export function resetAuthToAdmin() {
  const db = loadDb();
  const admin = db.users.find(u => String(u.email || "").trim().toLowerCase() === "asd@asd.com.ar");
  if (!admin) return { error: "admin_not_found" };
  db.users = [admin];
  db.session.currentUserId = admin.id;
  saveDb(db);
  return { admin };
}
