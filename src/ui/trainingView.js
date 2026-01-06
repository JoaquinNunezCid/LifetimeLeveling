import { getNow } from "../core/date.js";

function escapeHTML(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function mountTrainingView({ store, openModal }) {
  const list = document.getElementById("trainingList");
  const btnAdd = document.getElementById("btnAddExercise");
  const dayTabs = document.getElementById("trainingDayTabs");
  if (!list || !btnAdd || !dayTabs) return;

  const dayOrder = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];

  const dayLabels = {
    monday: "Lunes",
    tuesday: "Martes",
    wednesday: "Miercoles",
    thursday: "Jueves",
    friday: "Viernes",
    saturday: "Sabado",
    sunday: "Domingo",
  };

  function getDefaultDay() {
    const index = getNow().getDay();
    const map = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    return map[index] || "monday";
  }

  let currentDay = getDefaultDay();

  function setActiveDay(day) {
    currentDay = day;
    dayTabs.querySelectorAll("[data-day]").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.day === day);
    });
    render(store.getState());
  }

  function render(state) {
    const week = state.training || {};
    const training = Array.isArray(week[currentDay]) ? week[currentDay] : [];
    list.innerHTML = "";

    if (!training.length) {
      const label = dayLabels[currentDay] || "Este dia";
      list.innerHTML = `<li><span class="muted">Sin ejercicios para ${label}.</span></li>`;
      return;
    }

    const frag = document.createDocumentFragment();
    training.forEach(item => {
      const li = document.createElement("li");
      li.innerHTML = `
        <span class="text">${escapeHTML(item.name)}</span>
        <span class="pill">${escapeHTML(item.reps)}</span>
        <span class="actions">
          <button class="btn ghost" data-training-edit="${escapeHTML(item.id)}">Editar</button>
          <button class="btn ghost" data-training-remove="${escapeHTML(item.id)}">Quitar</button>
        </span>
      `;
      frag.appendChild(li);
    });
    list.appendChild(frag);
  }

  btnAdd.addEventListener("click", () => {
    if (!openModal) return;
    openModal({
      title: "Nuevo ejercicio",
      placeholder: "Ej: Flexiones",
      onOk: (name) => {
        openModal({
          title: "Repeticiones",
          placeholder: "Ej: 3x12",
          onOk: (reps) => {
            store.dispatch({ type: "TRAINING_ADD", payload: { name, reps, day: currentDay } });
          },
        });
      },
    });
  });

  list.addEventListener("click", (e) => {
    const removeBtn = e.target.closest("[data-training-remove]");
    if (removeBtn) {
      store.dispatch({
        type: "TRAINING_REMOVE",
        payload: { id: removeBtn.dataset.trainingRemove, day: currentDay },
      });
      return;
    }

    const editBtn = e.target.closest("[data-training-edit]");
    if (!editBtn || !openModal) return;

    const id = editBtn.dataset.trainingEdit;
    const week = store.getState().training || {};
    const training = Array.isArray(week[currentDay]) ? week[currentDay] : [];
    const item = training.find(t => t.id === id);
    if (!item) return;

    openModal({
      title: "Editar ejercicio",
      placeholder: "Ej: Flexiones",
      value: item.name,
      onOk: (name) => {
        openModal({
          title: "Editar repeticiones",
          placeholder: "Ej: 3x12",
          value: item.reps,
          onOk: (reps) => {
            store.dispatch({ type: "TRAINING_UPDATE", payload: { id, name, reps, day: currentDay } });
          },
        });
      },
    });
  });

  dayTabs.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-day]");
    if (!btn) return;
    const day = btn.dataset.day;
    if (!dayOrder.includes(day)) return;
    setActiveDay(day);
  });

  const onRouteChange = (e) => {
    if (e.detail?.route !== "entrenamiento") return;
    setActiveDay(getDefaultDay());
  };

  document.addEventListener("routechange", onRouteChange);
  setActiveDay(currentDay);
  const unsubscribe = store.subscribe(render);
  return () => {
    unsubscribe?.();
    document.removeEventListener("routechange", onRouteChange);
  };
}
