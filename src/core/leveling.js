export const BASE_GOAL_XP = 100;
export const DAILY_GOALS_TARGET = 4;
export const XP_LEVEL_DIVISOR = 150;
export const XP_REQUIRED_FACTOR = 1.20;

export function xpMultiplier(level) {
  return 1 + (level / XP_LEVEL_DIVISOR);
}

export function xpNeeded(level) {
  return Math.round(BASE_GOAL_XP * DAILY_GOALS_TARGET * level * xpMultiplier(level) * XP_REQUIRED_FACTOR);
}

export function addXp(progress, amount) {
  let level = progress.level;
  let xp = progress.xp + amount;

  const levelUps = [];
  while (xp >= xpNeeded(level)) {
    xp -= xpNeeded(level);
    level += 1;
    levelUps.push(level);
  }

  return {
    progress: { level, xp },
    levelUps, // ej: [2,3]
  };
}

export function lifeForLevel(level) {
  const safeLevel = Math.max(1, Number(level || 1));
  const n = safeLevel - 1;
  return 100 + (2 * n * n) + (5 * n);
}
