import { getNow, todayLocalKey } from "./date.js";

const ACHIEVEMENTS = [
  { id: "level_2", title: "Primer salto: nivel 2", type: "level", target: 2 },
  { id: "level_5", title: "Racha fuerte: nivel 5", type: "level", target: 5 },
  { id: "level_10", title: "Doble digito: nivel 10", type: "level", target: 10 },
  { id: "level_25", title: "Maestria: nivel 25", type: "level", target: 25 },
  { id: "level_50", title: "Leyenda: nivel 50", type: "level", target: 50 },
  { id: "level_100", title: "Eterno: nivel 100", type: "level", target: 100 },
  { id: "streak_3", title: "Constancia inicial: racha 3", type: "streak", target: 3 },
  { id: "streak_7", title: "Una semana completa", type: "streak", target: 7 },
  { id: "streak_14", title: "Dos semanas seguidas", type: "streak", target: 14 },
  { id: "streak_30", title: "Mes perfecto", type: "streak", target: 30 },
  { id: "streak_60", title: "Dos meses impecables", type: "streak", target: 60 },
  { id: "streak_100", title: "Cien dias sin parar", type: "streak", target: 100 },
  { id: "goals_10", title: "10 objetivos completos", type: "goals", target: 10 },
  { id: "goals_50", title: "50 objetivos completos", type: "goals", target: 50 },
  { id: "goals_150", title: "150 objetivos completos", type: "goals", target: 150 },
  { id: "goals_300", title: "300 objetivos completos", type: "goals", target: 300 },
  { id: "goals_600", title: "600 objetivos completos", type: "goals", target: 600 },
  { id: "actions_20", title: "20 objetivos extra", type: "actions", target: 20 },
  { id: "actions_100", title: "100 objetivos extra", type: "actions", target: 100 },
  { id: "actions_300", title: "300 objetivos extra", type: "actions", target: 300 },
  { id: "actions_600", title: "600 objetivos extra", type: "actions", target: 600 },
  { id: "actions_1200", title: "1200 objetivos extra", type: "actions", target: 1200 },
];

function getAchievementRewardXp(achievement) {
  const target = Number(achievement.target ?? 0);
  if (achievement.type === "level") {
    if (target <= 2) return 120;
    if (target <= 5) return 220;
    if (target <= 10) return 420;
    if (target <= 25) return 900;
    if (target <= 50) return 1800;
    if (target <= 100) return 3500;
    return 5000;
  }
  if (achievement.type === "streak") {
    if (target <= 3) return 100;
    if (target <= 7) return 200;
    if (target <= 14) return 380;
    if (target <= 30) return 700;
    if (target <= 60) return 1300;
    if (target <= 100) return 2200;
    return 3000;
  }
  if (achievement.type === "goals") {
    if (target <= 10) return 120;
    if (target <= 50) return 300;
    if (target <= 150) return 600;
    if (target <= 300) return 1000;
    if (target <= 600) return 1600;
    return 2400;
  }
  if (achievement.type === "actions") {
    if (target <= 20) return 120;
    if (target <= 100) return 320;
    if (target <= 300) return 700;
    if (target <= 600) return 1200;
    if (target <= 1200) return 2000;
    return 2800;
  }
  return 150;
}

function dateKeyFromDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getGoalsSnapshot(state, key) {
  const history = state.history?.days?.[key];
  if (history) {
    return {
      goals: history.goals || {},
      goalsDone: history.goalsDone || {},
      skipUsed: !!history.skipUsed,
    };
  }
  if (key === todayLocalKey()) {
    return {
      goals: state.goals || {},
      goalsDone: state.daily?.goalsDone || {},
      skipUsed: !!state.daily?.skipUsed,
    };
  }
  return { goals: {}, goalsDone: {}, skipUsed: false };
}

function isMissionComplete(goals, goalsDone, skipUsed) {
  if (skipUsed) return true;
  const keys = Object.keys(goals || {}).filter(k => Number(goals[k] ?? 0) > 0);
  if (!keys.length) return false;
  const completed = keys.filter(k => !!goalsDone?.[k]).length;
  return completed >= 4;
}

function getMissionStreak(state) {
  const now = getNow();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todaySnapshot = getGoalsSnapshot(state, dateKeyFromDate(today));
  const todayComplete = isMissionComplete(
    todaySnapshot.goals,
    todaySnapshot.goalsDone,
    todaySnapshot.skipUsed,
  );
  const cursor = new Date(today);
  if (!todayComplete) cursor.setDate(cursor.getDate() - 1);

  let count = 0;
  while (true) {
    const key = dateKeyFromDate(cursor);
    const snapshot = getGoalsSnapshot(state, key);
    if (!isMissionComplete(snapshot.goals, snapshot.goalsDone, snapshot.skipUsed)) break;
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

function countDone(map) {
  if (!map || typeof map !== "object") return 0;
  return Object.values(map).filter(Boolean).length;
}

function getTotalGoalsDone(state) {
  const days = Object.values(state.history?.days || {});
  return days.reduce((sum, day) => sum + countDone(day?.goalsDone), 0);
}

function getTotalActionsDone(state) {
  const days = Object.values(state.history?.days || {});
  return days.reduce((sum, day) => sum + countDone(day?.actions), 0);
}

export function getAchievementProgress(achievement, state) {
  const target = Number(achievement.target ?? 0);
  let current = 0;
  switch (achievement.type) {
    case "level":
      current = Number(state.progress?.level ?? 0);
      break;
    case "streak":
      current = getMissionStreak(state);
      break;
    case "goals":
      current = getTotalGoalsDone(state);
      break;
    case "actions":
      current = getTotalActionsDone(state);
      break;
    default:
      current = 0;
  }
  const safeTarget = Math.max(1, target);
  const pct = Math.min(100, Math.round((current / safeTarget) * 100));
  return { current, target, pct };
}

export function grantAchievements(state, achievements) {
  const current = Array.isArray(achievements) ? achievements : (Array.isArray(state.achievements) ? state.achievements : []);
  const have = new Set(current.map(a => a.id));
  const next = [...current];

  ACHIEVEMENTS.forEach(rule => {
    const progress = getAchievementProgress(rule, state);
    if (progress.current >= progress.target && !have.has(rule.id)) {
      next.push({
        id: rule.id,
        title: rule.title,
        earnedAt: new Date().toISOString(),
      });
      have.add(rule.id);
    }
  });

  return next;
}

export function grantAchievementRewards(state, achievements) {
  const current = Array.isArray(achievements) ? achievements : (Array.isArray(state.achievements) ? state.achievements : []);
  const have = new Set(current.map(a => a.id));
  const next = [...current];
  const earned = [];
  let xp = 0;

  ACHIEVEMENTS.forEach(rule => {
    const progress = getAchievementProgress(rule, state);
    if (progress.current >= progress.target && !have.has(rule.id)) {
      const rewardXp = getAchievementRewardXp(rule);
      next.push({
        id: rule.id,
        title: rule.title,
        earnedAt: new Date().toISOString(),
      });
      have.add(rule.id);
      earned.push({ id: rule.id, title: rule.title, xp: rewardXp });
      xp += rewardXp;
    }
  });

  return { achievements: next, earned, xp };
}

export { ACHIEVEMENTS };
