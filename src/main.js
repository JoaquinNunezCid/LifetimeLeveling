import { createStore } from "./state/store.js";
import { createRouter } from "./ui/router.js";
import { createToast } from "./ui/toast.js";
import { mountDashboardView } from "./ui/dashboardView.js";
import { mountActionsView } from "./ui/actionsView.js";
import { mountTrainingView } from "./ui/trainingView.js";
import { mountAuthView } from "./ui/authView.js";
import { mountAchievementsView } from "./ui/achievementsView.js";
import { mountStatsView } from "./ui/statsView.js";
import { mountGoalsView } from "./ui/goalsView.js";
import { mountGoalsEditView } from "./ui/goalsEditView.js";
import { lockPageForModal, unlockPageForModal } from "./ui/modalLock.js";
import { clearSession, getCurrentUser, updateUserPassword, updateUserProfile } from "./data/auth.js";
import { migrateLegacyState } from "./data/storage.js";

function createModal() {
  const modal = document.getElementById("modal");
  const titleEl = document.getElementById("modalTitle");
  const inputEl = document.getElementById("modalInput");
  const btnOk = document.getElementById("modalOk");
  const btnCancel = document.getElementById("modalCancel");

  function open({ title, placeholder, value = "", onOk }) {
    titleEl.textContent = title || "—";
    inputEl.placeholder = placeholder || "";
    inputEl.value = value;

    const close = () => {
      modal.classList.remove("show");
      modal.setAttribute("aria-hidden", "true");
      unlockPageForModal();
      btnOk.onclick = null;
      btnCancel.onclick = null;
    };

    btnCancel.onclick = close;
    btnOk.onclick = () => {
      const v = inputEl.value.trim();
      if (!v) return;
      close();
      onOk?.(v);
    };

    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
    lockPageForModal();
    inputEl.focus();
  }

  // Cerrar con ESC
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("show")) {
      modal.classList.remove("show");
      modal.setAttribute("aria-hidden", "true");
      unlockPageForModal();
    }
  });

  return { open };
}

// ===== App init =====
const router = createRouter();
const toast = createToast();
const modal = createModal();
let store = null;
let unsubscribers = [];

function setAuthUI(isAuthed) {
  document.querySelectorAll("[data-auth='app']").forEach(el => {
    el.hidden = !isAuthed;
  });
  document.querySelectorAll("[data-auth='guest']").forEach(el => {
    el.hidden = isAuthed;
  });
  document.querySelectorAll(".app-only").forEach(el => {
    el.hidden = !isAuthed;
  });
  document.querySelectorAll(".guest-only").forEach(el => {
    el.hidden = isAuthed;
  });
}

function unmountViews() {
  unsubscribers.forEach(fn => fn?.());
  unsubscribers = [];
  store = null;
}

function mountApp(user) {
  unmountViews();
  migrateLegacyState(user.id);
  store = createStore({ userId: user.id });
  const currentName = store.getState()?.user?.name;
  if (!currentName || currentName === "Invitado") {
    store.dispatch({ type: "USER_SET_NAME", payload: user.name });
  }
  unsubscribers.push(
    mountDashboardView({ store, router, toast, openModal: modal.open })
  );
  unsubscribers.push(mountActionsView({ store, toast }));
  unsubscribers.push(mountTrainingView({ store, openModal: modal.open }));
  unsubscribers.push(mountAchievementsView({ store }));
  unsubscribers.push(mountStatsView({ store }));
  unsubscribers.push(mountGoalsView({ store, toast, router }));
  unsubscribers.push(mountGoalsEditView({ store, toast }));
}

// Tabs -> router
document.querySelectorAll(".tab[data-route]").forEach(btn => {
  btn.addEventListener("click", () => router.setRoute(btn.dataset.route));
});

// Auth views
mountAuthView({
  router,
  toast,
  onAuth: (user) => {
    setAuthUI(true);
    mountApp(user);
    setAvatar(user);
    router.setRoute("dashboard");
  },
});

const btnLogout = document.getElementById("btnLogout");
const btnOpenSettings = document.getElementById("btnOpenSettings");
const btnSettings = document.getElementById("btnSettings");
const settingsPanel = document.getElementById("settingsPanel");
const avatarCircle = document.getElementById("avatarCircle");
const settingsModal = document.getElementById("settingsModal");
const settingsForm = document.getElementById("settingsForm");
const settingsName = document.getElementById("settingsName");
const settingsPassword = document.getElementById("settingsPassword");
const settingsAvatar = document.getElementById("settingsAvatar");
const settingsError = document.getElementById("settingsError");
const settingsCancel = document.getElementById("settingsCancel");
const btnOpenGoals = document.getElementById("btnOpenGoals");
const btnNavToggle = document.getElementById("btnNavToggle");
const primaryNav = document.getElementById("primaryNav");

function setError(el, msg) {
  if (!el) return;
  el.textContent = msg || "";
  el.hidden = !msg;
}

function passwordIssues(password) {
  const pwd = String(password || "");
  const issues = [];
  if (pwd.length < 8) issues.push("minimo 8 caracteres");
  if (!/[A-Za-z]/.test(pwd)) issues.push("al menos una letra");
  if (!/\d/.test(pwd)) issues.push("al menos un numero");
  return issues;
}

function setAvatar(user) {
  if (!avatarCircle) return;
  const url = user?.avatar || "";
  if (url) {
    avatarCircle.style.backgroundImage = `url(${url})`;
    avatarCircle.classList.add("hasImage");
  } else {
    avatarCircle.style.backgroundImage = "";
    avatarCircle.classList.remove("hasImage");
  }
}

function resizeImageFile(file, { maxSize = 200, maxBytes = 150000 } = {}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read_failed"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("image_failed"));
      img.onload = () => {
        let { width, height } = img;
        const scale = Math.min(1, maxSize / Math.max(width, height));
        width = Math.round(width * scale);
        height = Math.round(height * scale);

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("ctx_failed"));
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.8;
        let dataUrl = canvas.toDataURL("image/jpeg", quality);
        while (dataUrl.length > maxBytes && quality > 0.5) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL("image/jpeg", quality);
        }
        resolve(dataUrl);
      };
      img.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}

function closeSettings() {
  if (!btnSettings || !settingsPanel) return;
  settingsPanel.hidden = true;
  btnSettings.setAttribute("aria-expanded", "false");
}

function toggleSettings() {
  if (!btnSettings || !settingsPanel) return;
  const next = !settingsPanel.hidden;
  settingsPanel.hidden = next;
  btnSettings.setAttribute("aria-expanded", String(!next));
}

if (btnSettings && settingsPanel) {
  btnSettings.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleSettings();
  });

  settingsPanel.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  window.addEventListener("click", () => closeSettings());
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSettings();
  });
}

if (btnNavToggle && primaryNav) {
  btnNavToggle.addEventListener("click", () => {
    const isOpen = primaryNav.classList.toggle("open");
    btnNavToggle.setAttribute("aria-expanded", String(isOpen));
    document.body.classList.toggle("navOpen", isOpen);
  });

  primaryNav.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab[data-route]");
    if (!btn) return;
    primaryNav.classList.remove("open");
    btnNavToggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("navOpen");
  });
}

function closeSettingsModal() {
  if (!settingsModal) return;
  settingsModal.classList.remove("show");
  settingsModal.setAttribute("aria-hidden", "true");
  unlockPageForModal();
  if (settingsForm) settingsForm.reset();
  setError(settingsError, "");
}

function openSettingsModal() {
  if (!settingsModal) return;
  const user = getCurrentUser();
  if (settingsName) settingsName.value = user?.name || "";
  if (settingsPassword) settingsPassword.value = "";
  if (settingsAvatar) settingsAvatar.value = "";
  setError(settingsError, "");
  settingsModal.classList.add("show");
  settingsModal.setAttribute("aria-hidden", "false");
  lockPageForModal();
}

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && settingsModal?.classList.contains("show")) {
    closeSettingsModal();
  }
});

if (btnOpenSettings) {
  btnOpenSettings.addEventListener("click", () => {
    closeSettings();
    openSettingsModal();
  });
}

if (btnOpenGoals) {
  btnOpenGoals.addEventListener("click", () => {
    closeSettings();
    router.setRoute("objetivos-principales");
  });
}

if (settingsCancel) {
  settingsCancel.addEventListener("click", () => closeSettingsModal());
}


if (settingsForm) {
  settingsForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const user = getCurrentUser();
    if (!user) return;

    const name = settingsName?.value || "";
    const password = settingsPassword?.value || "";
    const file = settingsAvatar?.files?.[0] || null;

    if (password) {
      const issues = passwordIssues(password);
      if (issues.length) {
        setError(settingsError, `Password debil: ${issues.join(", ")}.`);
        return;
      }
      updateUserPassword({ id: user.id, password });
    }

    if (name.trim()) {
      const res = updateUserProfile({ id: user.id, name: name.trim() });
      if (res?.user) {
        store?.dispatch({ type: "USER_SET_NAME", payload: res.user.name });
      }
    }

    if (file) {
      resizeImageFile(file).then((dataUrl) => {
        const res = updateUserProfile({ id: user.id, avatar: dataUrl });
        if (res?.user) setAvatar(res.user);
        toast.show("Configuracion guardada");
        closeSettingsModal();
      }).catch(() => {
        setError(settingsError, "No se pudo procesar la imagen.");
      });
      return;
    }

    const updated = getCurrentUser();
    if (updated) setAvatar(updated);
    toast.show("Configuracion guardada");
    closeSettingsModal();
  });
}


if (btnLogout) {
  btnLogout.addEventListener("click", () => {
    clearSession();
    unmountViews();
    setAuthUI(false);
    closeSettings();
    router.setRoute("login");
  });
}

const currentUser = getCurrentUser();
if (currentUser) {
  setAuthUI(true);
  mountApp(currentUser);
  setAvatar(currentUser);
  router.setRoute("dashboard");
} else {
  setAuthUI(false);
  router.setRoute("login");
}
