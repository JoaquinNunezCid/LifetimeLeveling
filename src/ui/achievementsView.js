import { ACHIEVEMENTS, getAchievementProgress } from "../core/achievements.js";

function escapeHTML(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function mountAchievementsView({ store }) {
  const countEl = document.getElementById("achievementsCountView");
  const listEl = document.getElementById("achievementsListView");
  if (!countEl || !listEl) return;

  const categoryMeta = [
    { key: "level", label: "Niveles" },
    { key: "streak", label: "Rachas" },
    { key: "goals", label: "Objetivos diarios" },
    { key: "actions", label: "Objetivos extra" },
  ];
  const grouped = categoryMeta.map(category => ({
    ...category,
    items: ACHIEVEMENTS.filter(achievement => achievement.type === category.key),
  }));
  const openState = {};

  listEl.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-achievement-toggle]");
    if (!btn) return;
    const key = String(btn.dataset.achievementToggle || "");
    if (!key) return;
    const group = btn.closest(".achievementGroup");
    if (!group) return;
    const nextOpen = !openState[key];
    openState[key] = nextOpen;
    group.classList.toggle("open", nextOpen);
    btn.setAttribute("aria-expanded", String(nextOpen));
    const panel = group.querySelector("[data-achievement-panel]");
    if (panel) panel.setAttribute("aria-hidden", String(!nextOpen));
    const icon = group.querySelector(".achievementGroupIcon");
    if (icon) icon.textContent = nextOpen ? "-" : "+";
  });

  function render(state) {
    const earned = Array.isArray(state.achievements) ? state.achievements : [];
    countEl.textContent = String(earned.length);
    listEl.innerHTML = "";
    const frag = document.createDocumentFragment();
    const radius = 18;
    const circumference = 2 * Math.PI * radius;

    grouped.forEach((category, index) => {
      if (!category.items.length) return;
      const doneCount = category.items.reduce((sum, achievement) => {
        const progress = getAchievementProgress(achievement, state);
        return sum + (progress.current >= progress.target ? 1 : 0);
      }, 0);
      const isOpen = openState[category.key] ?? index === 0;
      openState[category.key] = isOpen;
      const groupItem = document.createElement("li");
      groupItem.className = `achievementGroup${isOpen ? " open" : ""}`;
      groupItem.innerHTML = `
        <button class="achievementGroupSummary" type="button" data-achievement-toggle="${category.key}" aria-expanded="${isOpen}">
          <span class="achievementGroupTitle">${escapeHTML(category.label)}</span>
          <span class="achievementGroupMeta">${doneCount}/${category.items.length}</span>
          <span class="achievementGroupIcon" aria-hidden="true">${isOpen ? "-" : "+"}</span>
        </button>
        <div class="achievementGroupPanel" data-achievement-panel="${category.key}" aria-hidden="${!isOpen}">
          <ul class="list achievementGroupList"></ul>
        </div>
      `;
      const groupList = groupItem.querySelector(".achievementGroupList");
      if (groupList) {
        category.items.forEach((achievement) => {
          const progress = getAchievementProgress(achievement, state);
          const pct = Math.max(0, Math.min(100, progress.pct));
          const dashOffset = circumference - (pct / 100) * circumference;
          const done = progress.current >= progress.target;
          const li = document.createElement("li");
          li.className = `achievementItem${done ? " done" : ""}`;
          li.innerHTML = `
            <div class="achievementProgress" aria-hidden="true">
              <svg class="progressRing" viewBox="0 0 44 44" role="img" focusable="false">
                <circle class="progressTrack" cx="22" cy="22" r="${radius}"></circle>
                <circle class="progressValue" cx="22" cy="22" r="${radius}" style="stroke-dasharray:${circumference};stroke-dashoffset:${dashOffset};"></circle>
              </svg>
              <span class="progressText">${pct}%</span>
            </div>
            <div class="achievementInfo">
              <p class="achievementTitle">${escapeHTML(achievement.title)}</p>
              <p class="muted">Progreso ${Math.min(progress.current, progress.target)} / ${progress.target}</p>
            </div>
            ${done ? `<span class="pill">Completado</span>` : ""}
          `;
          groupList.appendChild(li);
        });
      }
      frag.appendChild(groupItem);
    });
    listEl.appendChild(frag);
  }

  render(store.getState());
  return store.subscribe(render);
}
