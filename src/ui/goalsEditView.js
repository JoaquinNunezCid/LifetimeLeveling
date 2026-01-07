import { t } from "../core/i18n.js";

export function mountGoalsEditView({ store, toast }) {
  const form = document.getElementById("goalsForm");
  const water = document.getElementById("goalWater");
  const calories = document.getElementById("goalCalories");
  const exercise = document.getElementById("goalExercise");
  const read = document.getElementById("goalRead");
  const study = document.getElementById("goalStudy");
  const steps = document.getElementById("goalSteps");

  if (!form) return;

  function parseGoal(value, { min, max }) {
    const raw = String(value ?? "").trim();
    if (!raw) return 0;
    const normalized = raw.replace(",", ".");
    const num = Number.parseFloat(normalized);
    if (!Number.isFinite(num)) return 0;
    if (num <= 0) return 0;
    const clamped = Math.min(max, Math.max(min, num));
    return clamped;
  }

  function render(state) {
    const goals = state.goals || {};
    if (water) water.value = String(goals.waterLiters ?? 0);
    if (calories) calories.value = String(goals.calories ?? 0);
    if (exercise) exercise.value = String(goals.exerciseMinutes ?? 0);
    if (read) read.value = String(goals.readMinutes ?? 0);
    if (study) study.value = String(goals.studyMinutes ?? 0);
    if (steps) steps.value = String(goals.steps ?? 0);
  }

  function updateGoals() {
    const nextGoals = {
      waterLiters: parseGoal(water?.value, { min: 0.1, max: 10 }),
      calories: parseGoal(calories?.value, { min: 1, max: 10000 }),
      exerciseMinutes: parseGoal(exercise?.value, { min: 1, max: 600 }),
      readMinutes: parseGoal(read?.value, { min: 1, max: 600 }),
      studyMinutes: parseGoal(study?.value, { min: 1, max: 600 }),
      steps: parseGoal(steps?.value, { min: 1, max: 100000 }),
    };
    store.dispatch({ type: "GOALS_SET_ALL", payload: nextGoals });
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    updateGoals();
    toast?.show?.(t("goals.saved"));
  });

  [water, calories, exercise, read, study, steps].forEach(input => {
    if (!input) return;
    input.addEventListener("change", () => updateGoals());
  });

  render(store.getState());
  return store.subscribe(render);
}
