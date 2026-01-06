const SCHEMA = 1;

function defaultTraining() {
  return [
    { id: "flexiones", name: "Flexiones", reps: "3x12" },
    { id: "sentadillas", name: "Sentadillas", reps: "4x15" },
    { id: "plancha", name: "Plancha", reps: "3x30s" },
    { id: "abdominales", name: "Abdominales", reps: "3x20" },
  ];
}

function defaultTrainingWeek() {
  return {
    monday: defaultTraining(),
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
  };
}

export function defaultState({ name } = {}) {
  return {
    schema: SCHEMA,
    user: { name: name || "Invitado" },
    progress: { level: 1, xp: 0 },
    tokens: 0,
    daily: { date: "", actions: {}, bonusCategories: {}, goalsDone: {}, skipUsed: false },
    history: { days: {} },
    goals: {
      waterLiters: 0,
      calories: 0,
      exerciseMinutes: 0,
      readMinutes: 0,
      studyMinutes: 0,
      steps: 0,
    },
    tasks: [],
    training: defaultTrainingWeek(),
    achievements: [],
  };
}
