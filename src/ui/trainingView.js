import { getNow } from "../core/date.js";
import { getDayLabel, t } from "../core/i18n.js";

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
      const label = getDayLabel(currentDay) || t("dayModal.title");
      list.innerHTML = `<li><span class="muted">${escapeHTML(t("training.none", { day: label }))}</span></li>`;
      return;
    }

    const frag = document.createDocumentFragment();
    training.forEach(item => {
      const li = document.createElement("li");
      const done = Number.isFinite(Number(item.done)) ? Number(item.done) : 0;
      li.innerHTML = `
        <span class="text">${escapeHTML(item.name)}</span>
        <span class="pill">${escapeHTML(item.reps)}</span>
        <input class="trainingDoneInput" type="number" min="0" step="1" value="${escapeHTML(done)}" data-training-done="${escapeHTML(item.id)}" aria-label="${escapeHTML(t("training.done"))}" />
        <span class="actions">
          <button class="btn ghost" data-training-edit="${escapeHTML(item.id)}">${escapeHTML(t("training.edit"))}</button>
          <button class="btn ghost" data-training-remove="${escapeHTML(item.id)}">${escapeHTML(t("training.remove"))}</button>
        </span>
      `;
      frag.appendChild(li);
    });
    list.appendChild(frag);
  }

  btnAdd.addEventListener("click", () => {
    if (!openModal) return;
    openModal({
      title: t("training.new"),
      placeholder: t("training.namePlaceholder"),
      onOk: (name) => {
        openModal({
          title: t("training.repsTitle"),
          placeholder: t("training.repsPlaceholder"),
          onOk: (reps) => {
            store.dispatch({ type: "TRAINING_ADD", payload: { name, reps, done: 0, day: currentDay } });
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
      title: t("training.editTitle"),
      placeholder: t("training.namePlaceholder"),
      value: item.name,
      onOk: (name) => {
        openModal({
          title: t("training.editReps"),
          placeholder: t("training.repsPlaceholder"),
          value: item.reps,
          onOk: (reps) => {
            store.dispatch({ type: "TRAINING_UPDATE", payload: { id, name, reps, done: item.done, day: currentDay } });
          },
        });
      },
    });
  });

  list.addEventListener("change", (e) => {
    const input = e.target.closest("[data-training-done]");
    if (!input) return;
    const id = input.dataset.trainingDone;
    if (!id) return;
    const raw = Number(input.value);
    const done = Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 0;
    store.dispatch({ type: "TRAINING_DONE_SET", payload: { id, done, day: currentDay } });
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
  const onLanguageChange = () => render(store.getState());
  window.addEventListener("languagechange", onLanguageChange);
  const unsubscribe = store.subscribe(render);
  return () => {
    unsubscribe?.();
    window.removeEventListener("languagechange", onLanguageChange);
    document.removeEventListener("routechange", onRouteChange);
  };
}
