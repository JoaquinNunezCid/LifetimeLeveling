import { xpNeeded } from "../core/leveling.js";
import { showAchievementToasts } from "./achievementToasts.js";
import { getGoalLabel, t } from "../core/i18n.js";

export function mountGoalsView({ store, toast, router }) {
  const completeList = document.getElementById("goalsCompleteList");
  const levelEl = document.getElementById("levelGoals");
  const xpEl = document.getElementById("xpGoals");
  const xpNeedEl = document.getElementById("xpNeedGoals");
  const xpBarEl = document.getElementById("xpBarGoals");
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
  if (!completeList) return;

  const goalItems = [
    { key: "exerciseMinutes" },
    { key: "steps" },
    { key: "studyMinutes" },
    { key: "readMinutes" },
    { key: "calories" },
    { key: "waterLiters" },
  ];

  function render(state) {
    const level = state.progress.level;
    const xp = state.progress.xp;
    const xpNeed = xpNeeded(level);

    if (levelEl) levelEl.textContent = String(level);
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
    if (xpNeedEl) xpNeedEl.textContent = String(xpNeed);
    if (xpBarEl) {
      const pct = Math.max(0, Math.min(100, (xp / xpNeed) * 100));
      xpBarEl.style.width = pct + "%";
    }

    const goals = state.goals || {};
    const done = state.daily?.goalsDone || {};
    completeList.innerHTML = "";
    const frag = document.createDocumentFragment();
    goalItems.forEach(item => {
      const value = Number(goals[item.key] ?? 0);
      const label = getGoalLabel(item.key, { full: true });
      const li = document.createElement("li");
      const disabled = value <= 0;
      const isDone = !!done[item.key];
      const stateClass = isDone ? "done" : (disabled ? "disabled" : "pending");
      li.innerHTML = `
        <span class="text">${label}: ${value || 0}</span>
        <button class="checkBtn ${stateClass}" data-goal-complete="${item.key}" ${isDone ? "data-checked=\"true\"" : ""}>
          ${disabled ? t("goals.add") : '<span class="checkBox" aria-hidden="true"></span>'}
        </button>
      `;
      frag.appendChild(li);
    });
    completeList.appendChild(frag);
  }

  completeList.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-goal-complete]");
    if (!btn) return;
    const key = btn.dataset.goalComplete;
    if (!key) return;
    const value = Number(store.getState()?.goals?.[key] ?? 0);
    if (value <= 0) {
      router?.setRoute?.("objetivos-principales");
      return;
    }
    const res = store.dispatch({ type: "GOAL_COMPLETE", payload: key });
    if (res?.error === "already_done") {
      toast?.show?.(t("goals.alreadyDone"));
      return;
    }
    if (res?.error === "dead") {
      toast?.show?.(t("dead.blocked"));
      return;
    }
    if (res?.error === "not_set") {
      toast?.show?.(t("goals.notSet"));
      return;
    }
    const gained = Number.isFinite(res?.xpGained) ? res.xpGained : 0;
    toast?.show?.(t("goals.completed", { xp: gained }));
    showAchievementToasts(toast, res?.achievementsEarned, 2600);
  });

  render(store.getState());
  const onLanguageChange = () => render(store.getState());
  window.addEventListener("languagechange", onLanguageChange);
  const unsubscribe = store.subscribe(render);
  return () => {
    unsubscribe?.();
    window.removeEventListener("languagechange", onLanguageChange);
  };
}
