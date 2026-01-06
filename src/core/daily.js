import { todayLocalKey } from "./date.js";

export function ensureDaily(dailyState) {
  const today = todayLocalKey();

  if (!dailyState || dailyState.date !== today) {
    return { date: today, actions: {}, bonusCategories: {}, goalsDone: {}, skipUsed: false };
  }

  const actions = dailyState.actions || {};
  const hasInvalid = Object.values(actions).some(value => value !== true && value !== false);
  if (hasInvalid) {
    return {
      ...dailyState,
      actions: {},
      bonusCategories: {},
    };
  }

  if (typeof dailyState.skipUsed !== "boolean") {
    return { ...dailyState, skipUsed: false };
  }

  return dailyState;
}

export function hasDoneAction(dailyState, actionKey) {
  return !!dailyState.actions?.[actionKey];
}

export function markActionDone(dailyState, actionKey) {
  return {
    ...dailyState,
    actions: { ...(dailyState.actions || {}), [actionKey]: true },
  };
}
