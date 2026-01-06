import { actionsByCategory, getActionByKey, getCategoryForAction } from "../core/actionsCatalog.js";
import { xpMultiplier, xpNeeded } from "../core/leveling.js";
import { showAchievementToasts } from "./achievementToasts.js";

export function mountActionsView({ store, toast }) {
  const levelEl = document.getElementById("levelActions");
  const xpEl = document.getElementById("xpActions");
  const xpNeedEl = document.getElementById("xpNeedActions");
  const xpBarEl = document.getElementById("xpBarActions");
  let lastXpValue = null;
  let xpAnimFrame = null;

  function animateXp(el, from, to) {
    if (!el) return;
    if (xpAnimFrame) cancelAnimationFrame(xpAnimFrame);
    const start = performance.now();
    const duration = 550;
    const startValue = Number.isFinite(from) ? from : 0;
    const endValue = Number.isFinite(to) ? to : 0;
    const diff = endValue - startValue;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = Math.round(startValue + diff * eased);
      el.textContent = String(value);
      if (t < 1) {
        xpAnimFrame = requestAnimationFrame(tick);
      } else {
        xpAnimFrame = null;
        el.textContent = String(endValue);
      }
    };
    xpAnimFrame = requestAnimationFrame(tick);
  }

  const actionsButtons = document.getElementById("actionsButtons");

  const unlockByCategory = {
    Entrenamiento: "exerciseMinutes",
    Movimiento: "steps",
    Estudio: "studyMinutes",
    Lectura: "readMinutes",
  };

  const unlockLabelByGoal = {
    exerciseMinutes: "Ejercicio",
    steps: "Pasos",
    studyMinutes: "Estudiar",
    readMinutes: "Leer",
  };

  function isCategoryUnlocked(category, state) {
    const goalKey = unlockByCategory[category];
    if (!goalKey) return true;
    return !!state?.daily?.goalsDone?.[goalKey];
  }

  function getUnlockMessage(category) {
    const goalKey = unlockByCategory[category];
    if (!goalKey) return "Completa el objetivo principal de esta categoria.";
    const label = unlockLabelByGoal[goalKey] || "objetivo principal";
    return `Primero completa el objetivo principal: ${label}.`;
  }

  function renderActions(state) {
    if (!actionsButtons) return;
    actionsButtons.innerHTML = "";
    const level = state.progress?.level ?? 1;
    const multiplier = xpMultiplier(level);
    const groups = actionsByCategory();
    const frag = document.createDocumentFragment();

    for (const [category, items] of groups.entries()) {
      const unlocked = isCategoryUnlocked(category, state);
      const section = document.createElement("div");
      section.className = "actionGroup";
      section.innerHTML = `<h3>${category}</h3>`;

      const row = document.createElement("div");
      row.className = "actionRow";
      items.forEach(item => {
        const btn = document.createElement("button");
        const scaledXp = Math.round(item.xp * multiplier);
        const label = document.createElement("span");
        label.className = "actionLabel";
        label.textContent = item.label;
        const xp = document.createElement("span");
        xp.className = "actionXp";
        xp.textContent = `+${scaledXp} XP`;
        btn.append(label, xp);
        btn.setAttribute("data-do-action", item.key);
        btn.setAttribute("data-category", category);
        btn.setAttribute("data-locked", unlocked ? "0" : "1");
        if (!unlocked) btn.classList.add("locked");
        btn.disabled = false;
        row.appendChild(btn);
      });
      section.appendChild(row);
      frag.appendChild(section);
    }

    actionsButtons.appendChild(frag);
  }

  function render(state) {
    renderActions(state);
    const level = state.progress.level;
    const xp = state.progress.xp;
    const xpNeed = xpNeeded(level);

    levelEl.textContent = String(level);
    if (xpEl) {
      if (lastXpValue !== null && lastXpValue !== xp) {
        xpEl.classList.remove("xpPulse");
        void xpEl.offsetWidth;
        xpEl.classList.add("xpPulse");
        animateXp(xpEl, lastXpValue, xp);
      } else {
        xpEl.textContent = String(xp);
      }
      lastXpValue = xp;
    }
    xpNeedEl.textContent = String(xpNeed);

    const pct = Math.max(0, Math.min(100, (xp / xpNeed) * 100));
    xpBarEl.style.width = pct + "%";

    const doneMap = state.daily?.actions || {};
    actionsButtons.querySelectorAll("button[data-do-action]").forEach(btn => {
      const key = btn.dataset.doAction;
      const category = btn.dataset.category || getCategoryForAction(key);
      const locked = category ? !isCategoryUnlocked(category, state) : false;
      const isDone = !locked && doneMap[key] === true;
      btn.dataset.locked = locked ? "1" : "0";
      btn.classList.toggle("locked", locked);
      btn.dataset.done = isDone ? "1" : "0";
      btn.classList.toggle("done", isDone);
      btn.disabled = false;
    });
  }

  actionsButtons.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-do-action]");
    if (!btn) return;
    if (btn.dataset.locked === "1") {
      const category = btn.dataset.category || getCategoryForAction(btn.dataset.doAction);
      toast.show(getUnlockMessage(category));
      return;
    }
    if (btn.dataset.done === "1") {
      toast.show("Ya hiciste esta accion hoy");
      return;
    }

    const res = store.dispatch({ type: "DAILY_DO_ACTION", payload: btn.dataset.doAction });

    if (res?.error === "already_done") {
      toast.show("Ya hiciste esta accion hoy");
      return;
    }

    const meta = getActionByKey(btn.dataset.doAction);
    const gained = Number.isFinite(res?.xpGained) ? res.xpGained : 0;
    if (meta) {
      toast.show(`Accion registrada: ${meta.label} (+${gained} XP)`);
    } else {
      toast.show(`Accion registrada (+${gained} XP)`);
    }

    if (res?.levelUps?.length) {
      toast.show(`Subiste a nivel ${res.levelUps[res.levelUps.length - 1]}`, 2500);
    }
    showAchievementToasts(toast, res?.achievementsEarned, 2600);
  });

  render(store.getState());
  return store.subscribe(render);
}
