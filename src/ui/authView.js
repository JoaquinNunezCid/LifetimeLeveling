import { authenticate, createUser, isDevShortcutEmail, isLocalDevHost } from "../data/auth.js";
import { t } from "../core/i18n.js";

function setError(el, msg) {
  if (!el) return;
  el.textContent = msg || "";
  el.hidden = !msg;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function passwordIssues(password) {
  const pwd = String(password || "");
  const issues = [];
  if (pwd.length < 8) issues.push(t("password.minLength"));
  if (!/[A-Za-z]/.test(pwd)) issues.push(t("password.letter"));
  if (!/\d/.test(pwd)) issues.push(t("password.number"));
  return issues;
}

function setPasswordToggleState(btn, input) {
  if (!btn || !input) return;
  const isVisible = input.type === "text";
  const label = isVisible ? t("auth.hide") : t("auth.show");
  btn.dataset.visible = String(isVisible);
  btn.setAttribute("aria-pressed", String(isVisible));
  btn.setAttribute("aria-label", label);
  btn.setAttribute("title", label);
  const labelEl = btn.querySelector("[data-toggle-label]");
  if (labelEl) labelEl.textContent = label;
}

export function mountAuthView({ router, toast, onAuth }) {
  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");
  const loginError = document.getElementById("loginError");
  const signupError = document.getElementById("signupError");
  const goSignup = document.getElementById("goSignup");
  const goLogin = document.getElementById("goLogin");

  if (goSignup) {
    goSignup.addEventListener("click", () => router.setRoute("signup"));
  }

  if (goLogin) {
    goLogin.addEventListener("click", () => router.setRoute("login"));
  }

  document.querySelectorAll("[data-help-toggle]").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.helpToggle;
      const box = document.getElementById(targetId);
      if (!box) return;
      const nextHidden = !box.hidden;
      box.hidden = nextHidden;
      btn.setAttribute("aria-expanded", String(!nextHidden));
    });
  });

  document.querySelectorAll("[data-toggle-password]").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.togglePassword;
      const input = document.getElementById(targetId);
      if (!input) return;
      const nextType = input.type === "password" ? "text" : "password";
      input.type = nextType;
      setPasswordToggleState(btn, input);
    });
    const targetId = btn.dataset.togglePassword;
    const input = document.getElementById(targetId);
    if (input) setPasswordToggleState(btn, input);
  });

  if (loginForm) {
    loginForm.noValidate = isLocalDevHost();
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      setError(loginError, "");

      const email = document.getElementById("loginEmail")?.value || "";
      const password = document.getElementById("loginPassword")?.value || "";
      if (!isDevShortcutEmail(email) && !isValidEmail(email)) {
        setError(loginError, t("auth.invalidEmail"));
        return;
      }
      if (!String(password || "").trim()) {
        setError(loginError, t("auth.passwordRequired"));
        return;
      }
      const res = await authenticate(email, password);

      if (res?.error) {
        setError(loginError, t("auth.invalidCredentials"));
        toast?.show?.(t("auth.loginFailed"));
        return;
      }

      loginForm.reset();
      setError(loginError, "");
      onAuth?.(res.user);
    });
  }

  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      setError(signupError, "");

      const name = document.getElementById("signupName")?.value || "";
      const email = document.getElementById("signupEmail")?.value || "";
      const password = document.getElementById("signupPassword")?.value || "";
      const passwordConfirm = document.getElementById("signupPasswordConfirm")?.value || "";
      if (!isValidEmail(email)) {
        setError(signupError, t("auth.invalidEmail"));
        return;
      }
      const issues = passwordIssues(password);
      if (issues.length) {
        setError(signupError, t("toast.passwordWeak", { issues: issues.join(", ") }));
        return;
      }
      if (String(password) !== String(passwordConfirm)) {
        setError(signupError, t("password.mismatch"));
        return;
      }
      const res = await createUser({ name, email, password, passwordConfirm });

      if (res?.error === "email_taken") {
        setError(signupError, t("auth.emailTaken"));
        toast?.show?.(t("auth.emailInUse"));
        return;
      }

      if (res?.error === "password_weak") {
        const backendIssues = passwordIssues(password);
        setError(signupError, t("toast.passwordWeak", { issues: backendIssues.join(", ") }));
        return;
      }

      if (res?.error === "password_mismatch") {
        setError(signupError, t("password.mismatch"));
        return;
      }

      if (res?.error) {
        setError(signupError, t("auth.signupFields"));
        toast?.show?.(t("auth.signupFailed"));
        return;
      }

      signupForm.reset();
      setError(signupError, "");
      onAuth?.(res.user);
    });
  }
}
