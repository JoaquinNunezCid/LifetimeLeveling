import { loadState, saveState } from "../data/storage.js";
import { ensureDaily, hasDoneAction, markActionDone } from "../core/daily.js";
import { addXp, lifeForLevel, xpMultiplier, xpNeeded } from "../core/leveling.js";
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
const BASE_LIFE_PENALTY = 10;

function getLifePenalty(level) {
  const safeLevel = Math.max(1, Number(level || 1));
  return Math.round(BASE_LIFE_PENALTY + safeLevel * 1.5);
}

function isMissionComplete(goals, goalsDone, skipUsed) {
  if (skipUsed) return true;
  const keys = Object.keys(goals || {}).filter(k => Number(goals[k] ?? 0) > 0);
  if (!keys.length) return false;
  const completed = keys.filter(k => !!goalsDone?.[k]).length;
  return completed >= 4;
}

function ensureLifeState(state) {
  const maxLife = lifeForLevel(state.progress?.level || 1);
  const life = state.life || {};
  const current = Number.isFinite(Number(life.current)) ? Number(life.current) : maxLife;
  const lastPenaltyDate = typeof life.lastPenaltyDate === "string" ? life.lastPenaltyDate : "";
  const lastDefeatDate = typeof life.lastDefeatDate === "string" ? life.lastDefeatDate : "";
  if (current <= 0) {
    return {
      ...state,
      life: { current: 0, lastPenaltyDate, lastDefeatDate },
    };
  }
  return {
    ...state,
    life: {
      current: Math.max(0, Math.min(maxLife, current)),
      lastPenaltyDate,
      lastDefeatDate,
    },
  };
}

function dateKeyFromDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function updateHistoryForDate(state, dateKey, snapshot) {
  if (!dateKey) return state.history || { days: {} };
  const history = state.history || { days: {} };
  const days = { ...(history.days || {}) };
  if (!days[dateKey]) {
    days[dateKey] = {
      goals: snapshot.goals || {},
      goalsDone: snapshot.goalsDone || {},
      actions: snapshot.actions || {},
      skipUsed: !!snapshot.skipUsed,
    };
  }
  return { ...history, days };
}

function applyDailyRolloverPenalty(state) {
  const todayKey = todayLocalKey();
  const dailyDate = state.daily?.date || "";
  if (!dailyDate || dailyDate >= todayKey) return state;

  const lastPenaltyDate = state.life?.lastPenaltyDate || "";
  if (lastPenaltyDate === dailyDate) return state;

  let next = ensureLifeState(state);
  const snapshot = {
    goals: next.goals || {},
    goalsDone: next.daily?.goalsDone || {},
    actions: next.daily?.actions || {},
    skipUsed: !!next.daily?.skipUsed,
  };
  next = { ...next, history: updateHistoryForDate(next, dailyDate, snapshot) };

  const hasGoals = Object.keys(snapshot.goals || {}).some(k => Number(snapshot.goals[k] ?? 0) > 0);
  const failed = hasGoals && !isMissionComplete(snapshot.goals, snapshot.goalsDone, snapshot.skipUsed);
  if (failed) {
    const level = next.progress?.level || 1;
    const current = Number.isFinite(Number(next.life.current)) ? Number(next.life.current) : lifeForLevel(level);
    const remaining = current - getLifePenalty(level);
    if (remaining <= 0) {
      return {
        ...next,
        life: {
          ...next.life,
          current: 0,
          lastPenaltyDate: dailyDate,
          lastDefeatDate: dailyDate,
        },
      };
    }
    return { ...next, life: { ...next.life, current: remaining, lastPenaltyDate: dailyDate } };
  }
  return { ...next, life: { ...next.life, lastPenaltyDate: dailyDate } };
}

function applyDailyFailurePenalty(state) {
  const todayKey = todayLocalKey();
  const lastPenaltyDate = state.life?.lastPenaltyDate || "";
  const dailyDate = state.daily?.date || "";
  const historyKeys = Object.keys(state.history?.days || {});
  const latestHistoryKey = historyKeys.length ? historyKeys.sort().slice(-1)[0] : "";

  let seedKey = "";
  if (lastPenaltyDate) {
    seedKey = lastPenaltyDate;
  } else if (dailyDate && dailyDate !== todayKey) {
    seedKey = dailyDate;
  } else if (latestHistoryKey) {
    seedKey = latestHistoryKey;
  }
  if (!seedKey) return state;

  let next = ensureLifeState(state);

  const startDate = new Date(seedKey + "T00:00:00");
  if (Number.isNaN(startDate.getTime())) return next;

  const endDate = new Date(todayKey + "T00:00:00");
  if (Number.isNaN(endDate.getTime())) return next;

  let cursor = new Date(startDate);
  if (lastPenaltyDate) cursor.setDate(cursor.getDate() + 1);

  while (cursor < endDate) {
    const key = dateKeyFromDate(cursor);
    let snapshot = null;
    if (key === dailyDate) {
      snapshot = {
        goals: next.goals || {},
        goalsDone: next.daily?.goalsDone || {},
        actions: next.daily?.actions || {},
        skipUsed: !!next.daily?.skipUsed,
      };
      next = { ...next, history: updateHistoryForDate(next, key, snapshot) };
    } else {
      const history = next.history?.days?.[key];
      if (history) {
        snapshot = {
          goals: history.goals || {},
          goalsDone: history.goalsDone || {},
          actions: history.actions || {},
          skipUsed: !!history.skipUsed,
        };
      } else {
        snapshot = {
          goals: next.goals || {},
          goalsDone: {},
          actions: {},
          skipUsed: false,
        };
      }
    }

    if (snapshot) {
      const hasGoals = Object.keys(snapshot.goals || {}).some(k => Number(snapshot.goals[k] ?? 0) > 0);
      const failed = hasGoals && !isMissionComplete(snapshot.goals, snapshot.goalsDone, snapshot.skipUsed);
      if (failed) {
        const level = next.progress?.level || 1;
        const current = Number.isFinite(Number(next.life.current)) ? Number(next.life.current) : lifeForLevel(level);
        const remaining = current - getLifePenalty(level);
        if (remaining <= 0) {
          next = {
            ...next,
            life: {
              ...next.life,
              current: 0,
              lastPenaltyDate: key,
              lastDefeatDate: key,
            },
          };
        } else {
          next = { ...next, life: { ...next.life, current: remaining, lastPenaltyDate: key } };
        }
      } else {
        next = { ...next, life: { ...next.life, lastPenaltyDate: key } };
      }
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return next;
}

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

  const baseNext = { ...next, progress, tokens, achievements: reward.achievements };
  const healedNext = applyLevelUpHealing(baseNext, levelUps.length > 0);
  return { next: healedNext, reward, levelUps };
}

function applyLevelUpHealing(next, didLevelUp) {
  if (!didLevelUp) return next;
  const level = next.progress?.level || 1;
  const life = next.life || {};
  return { ...next, life: { ...life, current: lifeForLevel(level) } };
}

function isDefeated(state) {
  const current = Number(state.life?.current ?? 0);
  return Number.isFinite(current) && current <= 0;
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

export function createStore({ userId, initialState = null }) {
  let state = initialState || loadState(userId);
  state = applyDailyRolloverPenalty(state);
  state = applyDailyFailurePenalty(state);
  state = { ...state, daily: ensureDaily(state.daily) };
  state = applyActionsUnlockMigration(userId, state);
  state = { ...state, achievements: grantAchievements(state) };
  state = ensureLifeState(state);
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
    state = ensureLifeState(next);
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
    const rolled = applyDailyFailurePenalty(applyDailyRolloverPenalty(state));
    const normalized = { ...rolled, daily: ensureDaily(rolled.daily) };

    switch (action.type) {
      case "DEV_FORCE_RENDER": {
        setState({ ...normalized });
        return;
      }
      case "REVIVE": {
        const today = todayLocalKey();
        setState({
          ...normalized,
          progress: { level: 1, xp: 0 },
          tokens: 0,
          achievements: [],
          daily: { date: today, actions: {}, bonusCategories: {}, goalsDone: {}, skipUsed: false },
          life: { ...normalized.life, current: lifeForLevel(1) },
        });
        return;
      }
      case "DEV_LEVEL_UP": {
        const amount = xpNeeded(normalized.progress.level);
        const { progress: progress2, levelUps } = addXp(normalized.progress, amount);
        const tokenGain = levelUps.length;
        const tokens = (Number.isFinite(normalized.tokens) ? normalized.tokens : 0) + tokenGain;
        let next = {
          ...normalized,
          progress: progress2,
          tokens,
        };
        const applied = applyAchievementRewards(next);
        const leveledUp = levelUps.length > 0 || applied.levelUps.length > 0;
        next = applyLevelUpHealing(applied.next, leveledUp);
        setState(next);
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
        if (isDefeated(normalized)) {
          return { error: "dead" };
        }
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
        let next = {
          ...normalized,
          daily: daily2,
          progress: progress2,
          tokens,
          history: updateHistory(normalized, normalized.goals, daily2.goalsDone, daily2.actions, daily2.skipUsed),
        };
        const applied = applyAchievementRewards(next);
        const leveledUp = levelUps.length > 0 || applied.levelUps.length > 0;
        next = applyLevelUpHealing(applied.next, leveledUp);
        setState(next);
        return {
          levelUps: levelUps.concat(applied.levelUps),
          xpGained: totalXp,
          achievementsEarned: applied.reward.earned,
          achievementXp: applied.reward.xp,
        };
      }

      case "DAILY_SKIP": {
        if (isDefeated(normalized)) return { error: "dead" };
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
        const done = Number(action.payload?.done ?? 0);
        if (!name || !reps) return;

        const id = (crypto?.randomUUID?.() ?? String(Date.now()));
        const item = { id, name, reps, done: Number.isFinite(done) && done >= 0 ? Math.floor(done) : 0 };
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
        const done = Number(action.payload?.done ?? 0);
        const day = String(action.payload?.day || "");
        if (!id || !name || !reps || !day) return;
        const currentWeek = normalized.training || {};
        const currentDay = Array.isArray(currentWeek[day]) ? currentWeek[day] : [];
        const training = {
          ...currentWeek,
          [day]: currentDay.map(t => (t.id === id ? { ...t, name, reps, done: Number.isFinite(done) && done >= 0 ? Math.floor(done) : 0 } : t)),
        };
        setState({ ...normalized, training });
        return;
      }

      case "TRAINING_DONE_SET": {
        const id = String(action.payload?.id || "");
        const day = String(action.payload?.day || "");
        const done = Number(action.payload?.done ?? 0);
        if (!id || !day) return;
        const safeDone = Number.isFinite(done) && done >= 0 ? Math.floor(done) : 0;
        const currentWeek = normalized.training || {};
        const currentDay = Array.isArray(currentWeek[day]) ? currentWeek[day] : [];
        const training = {
          ...currentWeek,
          [day]: currentDay.map(t => (t.id === id ? { ...t, done: safeDone } : t)),
        };
        setState({ ...normalized, training });
        return;
      }
      case "TRAINING_REORDER": {
        const day = String(action.payload?.day || "");
        const fromId = String(action.payload?.fromId || "");
        const toId = String(action.payload?.toId || "");
        const after = !!action.payload?.after;
        if (!day || !fromId) return;
        const currentWeek = normalized.training || {};
        const currentDay = Array.isArray(currentWeek[day]) ? currentWeek[day] : [];
        if (currentDay.length < 2) return;
        const fromIndex = currentDay.findIndex(t => t.id === fromId);
        if (fromIndex === -1) return;
        const toIndex = toId ? currentDay.findIndex(t => t.id === toId) : -1;
        const nextDay = [...currentDay];
        const [moved] = nextDay.splice(fromIndex, 1);
        if (!moved) return;
        if (toIndex === -1) {
          nextDay.push(moved);
        } else {
          let insertIndex = toIndex;
          if (fromIndex < toIndex) insertIndex -= 1;
          if (after) insertIndex += 1;
          insertIndex = Math.max(0, Math.min(nextDay.length, insertIndex));
          nextDay.splice(insertIndex, 0, moved);
        }
        if (nextDay.every((item, idx) => item.id === currentDay[idx]?.id)) return;
        const training = { ...currentWeek, [day]: nextDay };
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
        if (isDefeated(normalized)) return { error: "dead" };
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

        let next = {
          ...normalized,
          daily: daily2,
          progress: progress2,
          tokens,
          history: updateHistory(normalized, normalized.goals, daily2.goalsDone, daily2.actions, daily2.skipUsed),
        };
        const applied = applyAchievementRewards(next);
        const leveledUp = levelUps.length > 0 || applied.levelUps.length > 0;
        next = applyLevelUpHealing(applied.next, leveledUp);
        setState(next);
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
