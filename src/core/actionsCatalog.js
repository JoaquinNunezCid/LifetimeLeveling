export const ACTIONS = [
  { key: "entreno_facil", label: "Entrenar facil", xp: 10, category: "Entrenamiento" },
  { key: "entreno_medio", label: "Entrenar medio", xp: 18, category: "Entrenamiento" },
  { key: "entreno_dificil", label: "Entrenar dificil", xp: 28, category: "Entrenamiento" },
  { key: "caminar_30m", label: "Caminar 30 min", xp: 6, category: "Movimiento" },
  { key: "caminar_1h", label: "Caminar 1 hora", xp: 10, category: "Movimiento" },
  { key: "estudio_30m", label: "Estudiar 30 min", xp: 8, category: "Estudio" },
  { key: "estudio_1h", label: "Estudiar 1 hora", xp: 15, category: "Estudio" },
  { key: "estudio_2h", label: "Estudiar 2 horas", xp: 25, category: "Estudio" },
  { key: "leer_30m", label: "Leer 30 min", xp: 6, category: "Lectura" },
  { key: "leer_1h", label: "Leer 1 hora", xp: 12, category: "Lectura" },
  { key: "leer_2h", label: "Leer 2 horas", xp: 20, category: "Lectura" },
];

export function getActionByKey(key) {
  return ACTIONS.find(a => a.key === key) || null;
}

export function getCategoryForAction(key) {
  const action = getActionByKey(key);
  return action ? action.category : null;
}

export function actionsForCategory(category) {
  return ACTIONS.filter(a => a.category === category);
}

export function actionsByCategory() {
  const map = new Map();
  ACTIONS.forEach(action => {
    if (!map.has(action.category)) map.set(action.category, []);
    map.get(action.category).push(action);
  });
  return map;
}
