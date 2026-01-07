import { isAdminUser } from "../data/auth.js";
import { getLanguage } from "./i18n.js";

export function getNow() {
  if (isAdminUser()) {
    const raw = localStorage.getItem("levelup_admin_now");
    if (raw) {
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return new Date();
}

export function todayLocalKey() {
  const d = getNow();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayLongES() {
  const locale = getLanguage() === "en" ? "en-US" : "es-AR";
  return getNow().toLocaleDateString(locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
