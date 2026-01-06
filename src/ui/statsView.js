import { todayLocalKey } from "../core/date.js";
import { getActionByKey } from "../core/actionsCatalog.js";
import { lifeForLevel } from "../core/leveling.js";

const POINTS_PER_LEVEL = 10;

function getDays(state) {
  const historyDays = Object.values(state.history?.days || {});
  const todayKey = todayLocalKey();
  if (!state.history?.days?.[todayKey]) {
    historyDays.push({
      goals: state.goals || {},
      goalsDone: state.daily?.goalsDone || {},
      actions: state.daily?.actions || {},
    });
  }
  return historyDays;
}

function countGoalDone(days, key) {
  return days.reduce((sum, day) => (day?.goalsDone?.[key] ? sum + 1 : sum), 0);
}

function countActionDaysByCategory(days) {
  const totals = {
    Entrenamiento: 0,
    Movimiento: 0,
    Estudio: 0,
    Lectura: 0,
  };
  days.forEach((day) => {
    const actions = day?.actions || {};
    const dayHasCategory = new Set();
    Object.keys(actions).forEach((actionKey) => {
      if (!actions[actionKey]) return;
      const action = getActionByKey(actionKey);
      if (!action) return;
      dayHasCategory.add(action.category);
    });
    dayHasCategory.forEach((category) => {
      totals[category] = (totals[category] || 0) + 1;
    });
  });
  return totals;
}

function scoreToLevel(score) {
  const safeScore = Math.max(0, score);
  const level = Math.floor(safeScore / POINTS_PER_LEVEL) + 1;
  const progress = safeScore % POINTS_PER_LEVEL;
  const pct = Math.min(100, Math.round((progress / POINTS_PER_LEVEL) * 100));
  return { level, progress, pct };
}

export function mountStatsView({ store }) {
  const listEl = document.getElementById("statsList");
  if (!listEl) return;

  function render(state) {
    const days = getDays(state);
    const exercise = countGoalDone(days, "exerciseMinutes");
    const steps = countGoalDone(days, "steps");
    const water = countGoalDone(days, "waterLiters");
    const study = countGoalDone(days, "studyMinutes");
    const read = countGoalDone(days, "readMinutes");
    const actionDays = countActionDaysByCategory(days);
    const life = lifeForLevel(state.progress?.level);
    const lifeBonus = Math.max(0, Math.round((life - 100) / 10));

    const strengthScore = exercise * 2 + actionDays.Entrenamiento * 2;
    const dexterityScore = exercise + steps + actionDays.Movimiento * 2;
    const constitutionScore = steps + water + actionDays.Movimiento * 2 + lifeBonus;
    const intelligenceScore = study * 2 + actionDays.Estudio * 2;
    const wisdomScore = read * 2 + actionDays.Lectura * 2;

    const stats = [
      { key: "strength", label: "Fuerza", hint: "Ejercicio y entrenamiento", score: strengthScore },
      { key: "dexterity", label: "Destreza", hint: "Ejercicio y pasos", score: dexterityScore },
      { key: "constitution", label: "Constitucion", hint: "Pasos y agua", score: constitutionScore },
      { key: "intelligence", label: "Inteligencia", hint: "Estudio", score: intelligenceScore },
      { key: "wisdom", label: "Sabiduria", hint: "Lectura", score: wisdomScore },
    ];

    listEl.innerHTML = "";
    const frag = document.createDocumentFragment();
    stats.forEach((stat) => {
      const { level, progress, pct } = scoreToLevel(stat.score);
      const li = document.createElement("li");
      li.className = `statItem stat-${stat.key}`;
      li.innerHTML = `
        <div class="statHeader">
          <div>
            <p class="statTitle">${stat.label}</p>
            <p class="muted statHint">${stat.hint}</p>
          </div>
          <div class="statMeta">
            <span class="statLevel">Nivel ${level}</span>
            <span class="statPoints">${stat.score} pts</span>
          </div>
        </div>
        <div class="barra statBar">
          <div class="progreso" style="width:${pct}%"></div>
        </div>
        <p class="muted statProgress">${progress}/${POINTS_PER_LEVEL}</p>
      `;
      frag.appendChild(li);
    });
    listEl.appendChild(frag);
  }

  render(store.getState());
  return store.subscribe(render);
}
