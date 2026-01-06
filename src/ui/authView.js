import { authenticate, createUser } from "../data/auth.js";

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
  if (pwd.length < 8) issues.push("minimo 8 caracteres");
  if (!/[A-Za-z]/.test(pwd)) issues.push("al menos una letra");
  if (!/\d/.test(pwd)) issues.push("al menos un numero");
  return issues;
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
      btn.textContent = nextType === "password" ? "Ver" : "Ocultar";
      btn.setAttribute("aria-pressed", nextType !== "password");
    });
  });

  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      setError(loginError, "");

      const email = document.getElementById("loginEmail")?.value || "";
      const password = document.getElementById("loginPassword")?.value || "";
      if (!isValidEmail(email)) {
        setError(loginError, "Ingresa un email valido.");
        return;
      }
      if (!String(password || "").trim()) {
        setError(loginError, "Ingresa tu password.");
        return;
      }
      const res = authenticate(email, password);

      if (res?.error) {
        setError(loginError, "Credenciales invalidas.");
        toast?.show?.("No se pudo iniciar sesion");
        return;
      }

      loginForm.reset();
      setError(loginError, "");
      onAuth?.(res.user);
    });
  }

  if (signupForm) {
    signupForm.addEventListener("submit", (e) => {
      e.preventDefault();
      setError(signupError, "");

      const name = document.getElementById("signupName")?.value || "";
      const email = document.getElementById("signupEmail")?.value || "";
      const password = document.getElementById("signupPassword")?.value || "";
      if (!isValidEmail(email)) {
        setError(signupError, "Ingresa un email valido.");
        return;
      }
      const issues = passwordIssues(password);
      if (issues.length) {
        setError(signupError, `Password debil: ${issues.join(", ")}.`);
        return;
      }
      const res = createUser({ name, email, password });

      if (res?.error === "email_taken") {
        setError(signupError, "El email ya esta registrado.");
        toast?.show?.("Email en uso");
        return;
      }

      if (res?.error) {
        setError(signupError, "Completa los campos.");
        toast?.show?.("No se pudo crear la cuenta");
        return;
      }

      const loginRes = authenticate(email, password);
      if (loginRes?.error) {
        setError(signupError, "Cuenta creada, pero no se pudo iniciar sesion.");
        toast?.show?.("Inicia sesion");
        return;
      }

      signupForm.reset();
      setError(signupError, "");
      onAuth?.(loginRes.user);
    });
  }
}
