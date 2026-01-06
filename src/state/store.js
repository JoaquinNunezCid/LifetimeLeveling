import { loadState, saveState } from "../data/storage.js";
import { ensureDaily, hasDoneAction, markActionDone } from "../core/daily.js";
import { addXp, xpMultiplier, xpNeeded } from "../core/leveling.js";
import { grantAchievementRewards, grantAchievements } from "../core/achievements.js";
import { actionsForCategory, getActionByKey, getCategoryForAction } from "../core/actionsCatalog.js";
import { todayLocalKey } from "../core/date.js";

const ACTIONS_UNLOCK_MIGRATION_KEY = "levelup_actions_unlock_migrated_";
const UNLOCK_CATEGORY_BY_GOAL = {
  exerciseMinutes: "Entrenamiento",
  steps: "Movimiento",
  studyMinutes: "Estudio",
  readMinutes: "Lectura",
};

function applyAchievementRewards(next) {
  const reward = grantAchievementRewards(next, next.achievements);
  let progress = next.progress;
  let tokens = Number.isFinite(next.tokens) ? next.tokens : 0;
  let levelUps = [];

  if (reward.xp > 0) {
    const res = addXp(progress, reward.xp);
    progress = res.progress;
    levelUps = res.levelUps;
    tokens += levelUps.length;
  }

  return {
    next: { ...next, progress, tokens, achievements: reward.achievements },
    reward,
    levelUps,
  };
}

function applyActionsUnlockMigration(userId, state) {
  if (!userId) return state;
  const key = `${ACTIONS_UNLOCK_MIGRATION_KEY}${userId}`;
  if (localStorage.getItem(key) === "1") return state;
  const daily = {
    ...state.daily,
    actions: {},
    bonusCategories: {},
  };
  localStorage.setItem(key, "1");
  return { ...state, daily };
}

export function createStore({ userId }) {
  let state = loadState(userId);
  state = { ...state, daily: ensureDaily(state.daily) };
  state = applyActionsUnlockMigration(userId, state);
  state = { ...state, achievements: grantAchievements(state) };
  saveState(userId, state);

  /** @type {Set<Function>} */
  const listeners = new Set();

  function getState() {
    return state;
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function setState(next) {
    state = next;
    saveState(userId, state);
    for (const fn of listeners) fn(state);
  }

  function updateHistory(next, goals, goalsDone, actions, skipUsed) {
    const key = todayLocalKey();
    const history = next.history || { days: {} };
    const days = { ...(history.days || {}) };
    days[key] = {
      goals: { ...(goals || {}) },
      goalsDone: { ...(goalsDone || {}) },
      actions: { ...(actions || {}) },
      skipUsed: !!skipUsed,
    };
    return { ...history, days };
  }

  function dispatch(action) {
    // Normaliza daily antes de cualquier acción
    const normalized = { ...state, daily: ensureDaily(state.daily) };

    switch (action.type) {
      case "DEV_FORCE_RENDER": {
        setState({ ...normalized });
        return;
      }
      case "DEV_LEVEL_UP": {
        const amount = xpNeeded(normalized.progress.level);
        const { progress: progress2, levelUps } = addXp(normalized.progress, amount);
        const tokenGain = levelUps.length;
        const tokens = (Number.isFinite(normalized.tokens) ? normalized.tokens : 0) + tokenGain;
        const next = {
          ...normalized,
          progress: progress2,
          tokens,
        };
        const applied = applyAchievementRewards(next);
        setState(applied.next);
        return {
          levelUps: levelUps.concat(applied.levelUps),
          achievementsEarned: applied.reward.earned,
          achievementXp: applied.reward.xp,
        };
      }
      case "GOALS_SET": {
        const key = String(action.payload?.key || "");
        const value = Number(action.payload?.value ?? 0);
        if (!key) return;
        const nextValue = Number.isFinite(value) ? value : 0;
        const goals = { ...(normalized.goals || {}), [key]: nextValue };
        const goalsDone = { ...(normalized.daily?.goalsDone || {}) };
        if (goalsDone[key]) {
          goalsDone[key] = false;
        }
        setState({
          ...normalized,
          goals,
          daily: { ...normalized.daily, goalsDone },
          history: updateHistory(normalized, goals, goalsDone, normalized.daily?.actions, normalized.daily?.skipUsed),
        });
        return;
      }

      case "GOALS_SET_ALL": {
        const payload = action.payload || {};
        const currentGoals = normalized.goals || {};
        const nextGoals = { ...currentGoals };
        Object.keys(payload).forEach((key) => {
          const value = Number(payload[key] ?? 0);
          nextGoals[key] = Number.isFinite(value) ? value : 0;
        });
        const goalsDone = { ...(normalized.daily?.goalsDone || {}) };
        Object.keys(nextGoals).forEach((key) => {
          if (goalsDone[key] && currentGoals[key] !== nextGoals[key]) {
            goalsDone[key] = false;
          }
        });
        setState({
          ...normalized,
          goals: nextGoals,
          daily: { ...normalized.daily, goalsDone },
          history: updateHistory(normalized, nextGoals, goalsDone, normalized.daily?.actions, normalized.daily?.skipUsed),
        });
        return;
      }

      case "GOAL_COMPLETE": {
        const key = String(action.payload || "");
        if (!key) return;
        if (normalized.daily?.goalsDone?.[key]) {
          return { error: "already_done" };
        }
        const goalValue = Number(normalized.goals?.[key] ?? 0);
        if (!Number.isFinite(goalValue) || goalValue <= 0) {
          return { error: "not_set" };
        }
        let daily2 = {
          ...normalized.daily,
          goalsDone: { ...(normalized.daily.goalsDone || {}), [key]: true },
        };
        const unlockCategory = UNLOCK_CATEGORY_BY_GOAL[key];
        if (unlockCategory) {
          const actionKeys = actionsForCategory(unlockCategory).map(action => action.key);
          if (actionKeys.length) {
            const nextActions = { ...(daily2.actions || {}) };
            actionKeys.forEach(actionKey => {
              delete nextActions[actionKey];
            });
            const nextBonus = { ...(daily2.bonusCategories || {}) };
            delete nextBonus[unlockCategory];
            daily2 = { ...daily2, actions: nextActions, bonusCategories: nextBonus };
          }
        }
        const baseXp = 100;
        const totalXp = Math.round(baseXp * xpMultiplier(normalized.progress.level));
        const { progress: progress2, levelUps } = addXp(normalized.progress, totalXp);
        const tokenGain = levelUps.length;
        const tokens = (Number.isFinite(normalized.tokens) ? normalized.tokens : 0) + tokenGain;
        const next = {
          ...normalized,
          daily: daily2,
          progress: progress2,
          tokens,
          history: updateHistory(normalized, normalized.goals, daily2.goalsDone, daily2.actions, daily2.skipUsed),
        };
        const applied = applyAchievementRewards(next);
        setState(applied.next);
        return {
          levelUps: levelUps.concat(applied.levelUps),
          xpGained: totalXp,
          achievementsEarned: applied.reward.earned,
          achievementXp: applied.reward.xp,
        };
      }

      case "DAILY_SKIP": {
        const tokens = Number.isFinite(normalized.tokens) ? normalized.tokens : 0;
        if (tokens <= 0) return { error: "no_tokens" };
        if (normalized.daily?.skipUsed) return { error: "already_used" };
        const daily2 = { ...normalized.daily, skipUsed: true };
        const next = {
          ...normalized,
          tokens: tokens - 1,
          daily: daily2,
          history: updateHistory(normalized, normalized.goals, daily2.goalsDone, daily2.actions, daily2.skipUsed),
        };
        const applied = applyAchievementRewards(next);
        setState(applied.next);
        return {
          skipped: true,
          achievementsEarned: applied.reward.earned,
          achievementXp: applied.reward.xp,
          levelUps: applied.levelUps,
        };
      }

      case "TRAINING_ADD": {
        const name = String(action.payload?.name || "").trim();
        const reps = String(action.payload?.reps || "").trim();
        const day = String(action.payload?.day || "monday");
        if (!name || !reps) return;

        const id = (crypto?.randomUUID?.() ?? String(Date.now()));
        const item = { id, name, reps };
        const currentWeek = normalized.training || {};
        const currentDay = Array.isArray(currentWeek[day]) ? currentWeek[day] : [];
        const training = { ...currentWeek, [day]: [item, ...currentDay] };
        setState({ ...normalized, training });
        return;
      }

      case "TRAINING_REMOVE": {
        const id = String(action.payload?.id || "");
        const day = String(action.payload?.day || "");
        if (!id || !day) return;
        const currentWeek = normalized.training || {};
        const currentDay = Array.isArray(currentWeek[day]) ? currentWeek[day] : [];
        const training = {
          ...currentWeek,
          [day]: currentDay.filter(t => t.id !== id),
        };
        setState({ ...normalized, training });
        return;
      }

      case "TRAINING_UPDATE": {
        const id = String(action.payload?.id || "");
        const name = String(action.payload?.name || "").trim();
        const reps = String(action.payload?.reps || "").trim();
        const day = String(action.payload?.day || "");
        if (!id || !name || !reps || !day) return;
        const currentWeek = normalized.training || {};
        const currentDay = Array.isArray(currentWeek[day]) ? currentWeek[day] : [];
        const training = {
          ...currentWeek,
          [day]: currentDay.map(t => (t.id === id ? { ...t, name, reps } : t)),
        };
        setState({ ...normalized, training });
        return;
      }

      case "USER_SET_NAME": {
        const name = String(action.payload || "").trim();
        if (!name) return;
        setState({ ...normalized, user: { ...normalized.user, name } });
        return;
      }

      case "DAILY_DO_ACTION": {
        const key = String(action.payload || "");
        const actionMeta = getActionByKey(key);
        if (!actionMeta) return;

        if (hasDoneAction(normalized.daily, key)) {
          return { error: "already_done" };
        }

        let daily2 = markActionDone(normalized.daily, key);
        let bonusXp = 0;
        const category = getCategoryForAction(key);
        if (category && !daily2.bonusCategories?.[category]) {
          const allInCategory = actionsForCategory(category).every(a => daily2.actions?.[a.key]);
          if (allInCategory) {
            bonusXp = 10;
            daily2 = {
              ...daily2,
              bonusCategories: { ...(daily2.bonusCategories || {}), [category]: true },
            };
          }
        }

        const baseXp = actionMeta.xp + bonusXp;
        const totalXp = Math.round(baseXp * xpMultiplier(normalized.progress.level));
        const { progress: progress2, levelUps } = addXp(normalized.progress, totalXp);
        const tokenGain = levelUps.length;
        const tokens = (Number.isFinite(normalized.tokens) ? normalized.tokens : 0) + tokenGain;

        const next = {
          ...normalized,
          daily: daily2,
          progress: progress2,
          tokens,
          history: updateHistory(normalized, normalized.goals, daily2.goalsDone, daily2.actions, daily2.skipUsed),
        };
        const applied = applyAchievementRewards(next);
        setState(applied.next);
        return {
          levelUps: levelUps.concat(applied.levelUps),
          xpGained: totalXp,
          achievementsEarned: applied.reward.earned,
          achievementXp: applied.reward.xp,
        };
      }

      default:
        return;
    }
  }

  return { getState, subscribe, dispatch };
}
