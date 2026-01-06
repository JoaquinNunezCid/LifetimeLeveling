export function showAchievementToasts(toast, earned, initialDelay = 0) {
  if (!toast?.show) return;
  if (!Array.isArray(earned) || !earned.length) return;
  const step = 2600;
  earned.forEach((achievement, index) => {
    const xp = Number.isFinite(achievement?.xp) ? achievement.xp : 0;
    const label = xp > 0
      ? `Logro conseguido: ${achievement.title} (+${xp} XP)`
      : `Logro conseguido: ${achievement.title}`;
    const delay = Math.max(0, initialDelay + index * step);
    setTimeout(() => toast.show(label, 2500), delay);
  });
}
