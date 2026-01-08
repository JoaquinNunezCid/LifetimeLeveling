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
      list.innerHTML = `<li class="emptyState"><span class="muted">${escapeHTML(t("training.none", { day: label }))}</span></li>`;
      return;
    }

    const frag = document.createDocumentFragment();
    training.forEach(item => {
      const li = document.createElement("li");
      li.classList.add("trainingItem");
      li.dataset.trainingId = String(item.id || "");
      const done = Number.isFinite(Number(item.done)) ? Number(item.done) : 0;
      li.innerHTML = `
        <button class="btn ghost dragHandle" type="button" draggable="true" data-training-drag="true" aria-label="${escapeHTML(t("training.reorder"))}" title="${escapeHTML(t("training.reorder"))}">
          <span class="dragIcon" aria-hidden="true"></span>
          <span class="srOnly">${escapeHTML(t("training.reorder"))}</span>
        </button>
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
      const id = removeBtn.dataset.trainingRemove;
      const day = currentDay;
      if (!id) return;
      if (!openModal) {
        store.dispatch({ type: "TRAINING_REMOVE", payload: { id, day } });
        return;
      }
      openModal({
        title: t("training.remove"),
        message: t("training.removeConfirm"),
        okLabel: t("training.remove"),
        cancelLabel: t("settings.cancel"),
        showInput: false,
        onOk: () => {
          store.dispatch({ type: "TRAINING_REMOVE", payload: { id, day } });
        },
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

  let draggedId = null;
  let dragOverId = null;
  let dragOverAfter = false;
  let touchDragActive = false;

  const clearDragOverStyles = () => {
    list.querySelectorAll(".trainingItem.dragOver, .trainingItem.dragOverAfter")
      .forEach(item => item.classList.remove("dragOver", "dragOverAfter"));
  };
  const clearAllDragStyles = () => {
    list.querySelectorAll(".trainingItem.dragging, .trainingItem.dragOver, .trainingItem.dragOverAfter")
      .forEach(item => item.classList.remove("dragging", "dragOver", "dragOverAfter"));
  };
  const updateDragOver = (li, after) => {
    if (!li) {
      dragOverId = null;
      dragOverAfter = false;
      clearDragOverStyles();
      return;
    }
    const id = li.dataset.trainingId;
    if (!id || id === draggedId) {
      clearDragOverStyles();
      return;
    }
    if (dragOverId !== id || dragOverAfter !== after) {
      clearDragOverStyles();
      li.classList.add("dragOver");
      if (after) li.classList.add("dragOverAfter");
      dragOverId = id;
      dragOverAfter = after;
    }
  };

  list.addEventListener("dragstart", (e) => {
    const handle = e.target.closest("[data-training-drag]");
    if (!handle) return;
    const li = handle.closest(".trainingItem");
    if (!li) return;
    const id = li.dataset.trainingId;
    if (!id) return;
    draggedId = id;
    dragOverId = null;
    dragOverAfter = false;
    li.classList.add("dragging");
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", id);
      try {
        e.dataTransfer.setDragImage(li, 16, 16);
      } catch {
        // Ignorar si el navegador no soporta setDragImage
      }
    }
  });

  list.addEventListener("dragover", (e) => {
    if (!draggedId) return;
    const li = e.target.closest(".trainingItem");
    e.preventDefault();
    if (!li) {
      updateDragOver(null, false);
      return;
    }
    const rect = li.getBoundingClientRect();
    const after = e.clientY > rect.top + rect.height / 2;
    updateDragOver(li, after);
  });

  list.addEventListener("dragleave", (e) => {
    if (!draggedId) return;
    const li = e.target.closest(".trainingItem");
    if (!li) return;
    if (!li.contains(e.relatedTarget)) {
      li.classList.remove("dragOver", "dragOverAfter");
    }
  });

  list.addEventListener("drop", (e) => {
    if (!draggedId) return;
    e.preventDefault();
    const li = e.target.closest(".trainingItem");
    const targetId = li?.dataset.trainingId || "";
    const after = dragOverAfter;
    const fromId = draggedId;
    draggedId = null;
    dragOverId = null;
    dragOverAfter = false;
    clearAllDragStyles();
    if (!fromId || (targetId && targetId === fromId)) return;
    store.dispatch({
      type: "TRAINING_REORDER",
      payload: { day: currentDay, fromId, toId: targetId, after },
    });
  });

  list.addEventListener("dragend", () => {
    draggedId = null;
    dragOverId = null;
    dragOverAfter = false;
    touchDragActive = false;
    clearAllDragStyles();
  });

  list.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
    const handle = e.target.closest("[data-training-drag]");
    if (!handle) return;
    const li = handle.closest(".trainingItem");
    if (!li) return;
    const id = li.dataset.trainingId;
    if (!id) return;
    draggedId = id;
    dragOverId = null;
    dragOverAfter = false;
    touchDragActive = true;
    li.classList.add("dragging");
    handle.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  list.addEventListener("pointermove", (e) => {
    if (!touchDragActive || !draggedId) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const li = el?.closest?.(".trainingItem") || null;
    if (!li) {
      updateDragOver(null, false);
      return;
    }
    const rect = li.getBoundingClientRect();
    const after = e.clientY > rect.top + rect.height / 2;
    updateDragOver(li, after);
    e.preventDefault();
  });

  const finishTouchDrag = (e) => {
    if (!touchDragActive) return;
    const fromId = draggedId;
    const targetId = dragOverId || "";
    const after = dragOverAfter;
    draggedId = null;
    dragOverId = null;
    dragOverAfter = false;
    touchDragActive = false;
    clearAllDragStyles();
    if (!fromId || (targetId && targetId === fromId)) return;
    store.dispatch({
      type: "TRAINING_REORDER",
      payload: { day: currentDay, fromId, toId: targetId, after },
    });
  };

  list.addEventListener("pointerup", finishTouchDrag);
  list.addEventListener("pointercancel", finishTouchDrag);

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
