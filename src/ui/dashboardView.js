import { getNow, todayLocalKey, todayLongES } from "../core/date.js";
import { ACHIEVEMENTS } from "../core/achievements.js";
import { lifeForLevel, xpNeeded } from "../core/leveling.js";
import { getCurrentUser, isAdminUser, resetAuthToAdmin } from "../data/auth.js";
import { clearUserStatesExcept, resetUserState } from "../data/storage.js";
import { lockPageForModal, unlockPageForModal } from "./modalLock.js";
import { showAchievementToasts } from "./achievementToasts.js";
import { getAchievementTitle, getGoalLabel, getLanguage, t } from "../core/i18n.js";

function escapeHTML(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function mountDashboardView({ store, router, toast, openModal }) {
  const userName = document.getElementById("userName");
  const todayText = document.getElementById("todayText");

  const levelDash = document.getElementById("levelDash");
  const xpDash = document.getElementById("xpDash");
  const xpNeedDash = document.getElementById("xpNeedDash");
  const lifeDash = document.getElementById("lifeDash");
  const lifeBarDash = document.getElementById("lifeBarDash");
  const lifeBarLabel = document.getElementById("lifeBarLabel");
  const xpBarLabel = document.getElementById("xpBarLabel");
  const streakDash = document.getElementById("streakDash");
  const xpBarDash = document.getElementById("xpBarDash");

  const calendarMonthBtn = document.getElementById("calendarMonthBtn");
  const calendarGrid = document.getElementById("calendarGrid");
  const dayModal = document.getElementById("dayModal");
  const dayModalTitle = document.getElementById("dayModalTitle");
  const dayMissionText = document.getElementById("dayMissionText");
  const dayActionsDone = document.getElementById("dayActionsDone");
  const dayActionsMissing = document.getElementById("dayActionsMissing");
  const dayModalClose = document.getElementById("dayModalClose");
  const monthPickerModal = document.getElementById("monthPickerModal");
  const monthPickerYear = document.getElementById("monthPickerYear");
  const monthPickerMonth = document.getElementById("monthPickerMonth");
  const monthPickerApply = document.getElementById("monthPickerApply");
  const monthPickerClose = document.getElementById("monthPickerClose");
  const defeatModal = document.getElementById("defeatModal");
  const defeatModalClose = document.getElementById("defeatModalClose");
  const defeatModalRevive = document.getElementById("defeatModalRevive");
  const defeatRevivePanel = document.getElementById("defeatRevivePanel");
  const reviveBtn = document.getElementById("reviveBtn");

  const achievementsCount = document.getElementById("achievementsCount");
  const achievementsList = document.getElementById("achievementsList");
  const achievementCategories = [
    { key: "level", label: "level" },
    { key: "streak", label: "streak" },
    { key: "goals", label: "goals" },
    { key: "actions", label: "actions" },
  ];

  const goalsDoneSummary = document.getElementById("goalsDoneSummary");
  const goalsMissingSummary = document.getElementById("goalsMissingSummary");
  const btnEditName = document.getElementById("btnEditName");
  const tokensDash = document.getElementById("tokensDash");
  const skipTokenBtn = document.getElementById("skipTokenBtn");
  let lastXpValue = null;
  let xpAnimFrame = null;
  let lastDefeatSeen = null;

  function animateXp(el, from, to) {
    if (!el) return;
    if (xpAnimFrame) cancelAnimationFrame(xpAnimFrame);
    const start = performance.now();
    const duration = 550;
    const startValue = Number.isFinite(from) ? from : 0;
    const endValue = Number.isFinite(to) ? to : 0;
    const diff = endValue - startValue;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = Math.round(startValue + diff * eased);
      el.textContent = String(value);
      if (t < 1) {
        xpAnimFrame = requestAnimationFrame(tick);
      } else {
        xpAnimFrame = null;
        el.textContent = String(endValue);
      }
    };
    xpAnimFrame = requestAnimationFrame(tick);
  }

  let currentDateKey = todayLocalKey();
  let dateRefreshTimer = null;

  function refreshTodayText(force = false) {
    const nextKey = todayLocalKey();
    if (!force && nextKey === currentDateKey) return;
    currentDateKey = nextKey;
    if (todayText) todayText.textContent = todayLongES();
  }

  function scheduleNextDateRefresh() {
    if (dateRefreshTimer) clearTimeout(dateRefreshTimer);
    const now = getNow();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const delay = Math.max(1000, next.getTime() - now.getTime() + 50);
    dateRefreshTimer = setTimeout(() => {
      refreshTodayText(true);
      store.dispatch({ type: "DEV_FORCE_RENDER" });
      scheduleNextDateRefresh();
    }, delay);
  }

  refreshTodayText(true);
  scheduleNextDateRefresh();

  const now = getNow();
  let viewYear = now.getFullYear();
  let viewMonth = now.getMonth();

  const goalKeys = [
    "waterLiters",
    "calories",
    "exerciseMinutes",
    "readMinutes",
    "studyMinutes",
    "steps",
  ];

  btnEditName.addEventListener("click", () => {
    const current = store.getState().user?.name || "";
    openModal({
      title: t("modal.editNameTitle"),
      placeholder: t("modal.namePlaceholder"),
      value: current,
      onOk: (value) => store.dispatch({ type: "USER_SET_NAME", payload: value }),
    });
  });

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
        actions: history.actions || {},
        skipUsed: !!history.skipUsed,
      };
    }
    if (key === todayLocalKey()) {
      return {
        goals: state.goals || {},
        goalsDone: state.daily?.goalsDone || {},
        actions: state.daily?.actions || {},
        skipUsed: !!state.daily?.skipUsed,
      };
    }
    return { goals: {}, goalsDone: {}, actions: {}, skipUsed: false };
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

  function getStartDate() {
    const user = getCurrentUser();
    const created = user?.createdAt ? new Date(user.createdAt) : null;
    if (!created || Number.isNaN(created.getTime())) return new Date();
    return created;
  }

  function buildYearOptions(startDate) {
    if (!monthPickerYear) return;
    const startYear = startDate.getFullYear();
    const endYear = Math.max(startYear, getNow().getFullYear());
    monthPickerYear.innerHTML = "";
    for (let y = startYear; y <= endYear; y += 1) {
      const opt = document.createElement("option");
      opt.value = String(y);
      opt.textContent = String(y);
      monthPickerYear.appendChild(opt);
    }
  }

  function buildMonthOptions(startDate, year) {
    if (!monthPickerMonth) return;
    const monthNames = getLanguage() === "en"
      ? [
          "january", "february", "march", "april", "may", "june",
          "july", "august", "september", "october", "november", "december",
        ]
      : [
          "enero", "febrero", "marzo", "abril", "mayo", "junio",
          "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
        ];
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth();
    const end = getNow();
    const endYear = end.getFullYear();
    const endMonth = end.getMonth();

    let from = 0;
    let to = 11;
    if (year === startYear) from = startMonth;
    if (year === endYear) to = endMonth;

    monthPickerMonth.innerHTML = "";
    for (let m = from; m <= to; m += 1) {
      const opt = document.createElement("option");
      opt.value = String(m);
      opt.textContent = monthNames[m];
      monthPickerMonth.appendChild(opt);
    }
  }

  function openMonthPicker() {
    if (!monthPickerModal || !monthPickerYear || !monthPickerMonth) return;
    const wasOpen = monthPickerModal.classList.contains("show");
    const current = getNow();
    const startDate = getStartDate();
    buildYearOptions(startDate);
    const desiredYear = String(current.getFullYear());
    monthPickerYear.value = desiredYear;
    if (monthPickerYear.value !== desiredYear && monthPickerYear.options.length) {
      monthPickerYear.value = monthPickerYear.options[0].value;
    }
    buildMonthOptions(startDate, Number(monthPickerYear.value));
    const desiredMonth = String(current.getMonth());
    monthPickerMonth.value = desiredMonth;
    if (monthPickerMonth.value !== desiredMonth && monthPickerMonth.options.length) {
      monthPickerMonth.value = monthPickerMonth.options[0].value;
    }
    monthPickerModal.classList.add("show");
    monthPickerModal.setAttribute("aria-hidden", "false");
    if (!wasOpen) lockPageForModal();
  }

  function closeMonthPicker() {
    if (!monthPickerModal) return;
    const wasOpen = monthPickerModal.classList.contains("show");
    monthPickerModal.classList.remove("show");
    monthPickerModal.setAttribute("aria-hidden", "true");
    if (wasOpen) unlockPageForModal();
  }

  function openDefeatModal() {
    if (!defeatModal) return;
    const wasOpen = defeatModal.classList.contains("show");
    document.body.classList.add("defeatMode");
    defeatModal.classList.add("show");
    defeatModal.setAttribute("aria-hidden", "false");
    if (!wasOpen) lockPageForModal();
    playDefeatSound();
  }

  function closeDefeatModal() {
    if (!defeatModal) return;
    const wasOpen = defeatModal.classList.contains("show");
    defeatModal.classList.remove("show");
    defeatModal.setAttribute("aria-hidden", "true");
    if (wasOpen) unlockPageForModal();
  }

  function playDefeatSound() {
    if (!window.AudioContext && !window.webkitAudioContext) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(260, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.5);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
      setTimeout(() => ctx.close(), 700);
    } catch {
      // Ignorar si el navegador bloquea audio automatico
    }
  }

  function revive() {
    store.dispatch({ type: "REVIVE" });
    closeDefeatModal();
  }

  function renderCalendar(state) {
    if (!calendarGrid || !calendarMonthBtn) return;
    const year = viewYear;
    const month = viewMonth;
    const locale = getLanguage() === "en" ? "en-US" : "es-AR";
    const monthLabel = new Date(year, month, 1).toLocaleDateString(locale, {
      month: "long",
      year: "numeric",
    });
    calendarMonthBtn.textContent = monthLabel;

    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const daysInMonth = last.getDate();
    const startIndex = (first.getDay() + 6) % 7;

    calendarGrid.innerHTML = "";
    const frag = document.createDocumentFragment();
    const weekday = getLanguage() === "en"
      ? ["M", "T", "W", "T", "F", "S", "S"]
      : ["L", "M", "X", "J", "V", "S", "D"];
    weekday.forEach(w => {
      const el = document.createElement("div");
      el.className = "calendarHead";
      el.textContent = w;
      frag.appendChild(el);
    });

    for (let i = 0; i < startIndex; i += 1) {
      const empty = document.createElement("div");
      empty.className = "calendarEmpty";
      frag.appendChild(empty);
    }

    const todayKey = todayLocalKey();
    const defeatKey = state.life?.lastDefeatDate || "";
    for (let day = 1; day <= daysInMonth; day += 1) {
      const d = new Date(year, month, day);
      const key = dateKeyFromDate(d);
      const snapshot = getGoalsSnapshot(state, key);
      const missionDone = isMissionComplete(snapshot.goals, snapshot.goalsDone, snapshot.skipUsed);
      const skipped = snapshot.skipUsed;
      const goals = snapshot.goals || {};
      const hasGoals = Object.keys(goals).some(k => Number(goals[k] ?? 0) > 0);
      const hasGoalsDone = Object.values(snapshot.goalsDone || {}).some(Boolean);
      const hasActionsDone = Object.values(snapshot.actions || {}).some(Boolean);
      const hasAnyActivity = hasGoalsDone || hasActionsDone;
      const missionFailed = hasGoals && !missionDone && key < todayKey;
      const noActivity = !hasAnyActivity && key < todayKey && !skipped;
      const hasActivity = missionDone && !skipped;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "calendarDay";
      if (key === todayKey) btn.classList.add("today");
      if (hasActivity) btn.classList.add("hasActivity");
      if (missionFailed) btn.classList.add("missionFailed");
      if (noActivity) btn.classList.add("noActivity");
      if (skipped) btn.classList.add("daySkipped");
      if (defeatKey && key === defeatKey) btn.classList.add("dayDefeat");
      btn.dataset.dateKey = key;
      btn.textContent = String(day);
      frag.appendChild(btn);
    }

    calendarGrid.appendChild(frag);
  }

  function openDayModal(state, key) {
    if (!dayModal || !dayModalTitle || !dayMissionText) return;
    const wasOpen = dayModal.classList.contains("show");
    const d = new Date(key + "T00:00:00");
    const locale = getLanguage() === "en" ? "en-US" : "es-AR";
    dayModalTitle.textContent = d.toLocaleDateString(locale, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const snapshot = getGoalsSnapshot(state, key);
    if (state.life?.lastDefeatDate && key === state.life.lastDefeatDate) {
      dayMissionText.textContent = t("day.death");
    } else if (snapshot.skipUsed) {
      dayMissionText.textContent = t("day.skipText");
    } else {
      dayMissionText.textContent = isMissionComplete(snapshot.goals, snapshot.goalsDone, snapshot.skipUsed)
        ? t("day.missionSuccess")
        : t("day.missionFail");
    }

    if (dayActionsDone && dayActionsMissing) {
      const goals = snapshot.goals || {};
      const done = snapshot.goalsDone || {};
      const activeKeys = goalKeys.filter(k => Number(goals[k] ?? 0) > 0);
      const doneLabels = activeKeys.filter(k => done[k]).map(k => getGoalLabel(k));
      const missingLabels = activeKeys.filter(k => !done[k]).map(k => getGoalLabel(k));

      dayActionsDone.innerHTML = "";
      dayActionsMissing.innerHTML = "";

      if (!doneLabels.length) {
        dayActionsDone.innerHTML = `<li><span class="muted">${escapeHTML(t("day.noneDone"))}</span></li>`;
      } else {
        const frag = document.createDocumentFragment();
        doneLabels.forEach(label => {
          const li = document.createElement("li");
          li.innerHTML = `<span class="text">${escapeHTML(label)}</span>`;
          frag.appendChild(li);
        });
        dayActionsDone.appendChild(frag);
      }

      if (!missingLabels.length) {
        dayActionsMissing.innerHTML = `<li><span class="muted">${escapeHTML(t("day.noneMissing"))}</span></li>`;
      } else {
        const frag = document.createDocumentFragment();
        missingLabels.forEach(label => {
          const li = document.createElement("li");
          li.innerHTML = `<span class="text">${escapeHTML(label)}</span>`;
          frag.appendChild(li);
        });
        dayActionsMissing.appendChild(frag);
      }
    }

    dayModal.classList.add("show");
    dayModal.setAttribute("aria-hidden", "false");
    if (!wasOpen) lockPageForModal();
  }

  function closeDayModal() {
    if (!dayModal) return;
    const wasOpen = dayModal.classList.contains("show");
    dayModal.classList.remove("show");
    dayModal.setAttribute("aria-hidden", "true");
    if (wasOpen) unlockPageForModal();
  }

  function render(state) {
    const defeatDate = state.life?.lastDefeatDate || "";
    if (lastDefeatSeen === null) {
      lastDefeatSeen = defeatDate;
      if ((Number(state.life?.current) || 0) <= 0) {
        openDefeatModal();
      }
    } else if (defeatDate && defeatDate !== lastDefeatSeen) {
      lastDefeatSeen = defeatDate;
      openDefeatModal();
    }
    userName.textContent = state.user?.name || "Invitado";

    const level = state.progress.level;
    const xp = state.progress.xp;
    const xpNeed = xpNeeded(level);

    levelDash.textContent = String(level);
    if (xpDash) {
      if (lastXpValue !== null && lastXpValue !== xp) {
        xpDash.classList.remove("xpPulse");
        void xpDash.offsetWidth;
        xpDash.classList.add("xpPulse");
        animateXp(xpDash, lastXpValue, xp);
      } else {
        xpDash.textContent = String(xp);
      }
      lastXpValue = xp;
    }
    xpNeedDash.textContent = String(xpNeed);
    if (xpBarLabel) {
      const remaining = Math.max(0, xpNeed - xp);
      xpBarLabel.textContent = t("dashboard.xpLabel", { current: xp, total: xpNeed, remaining });
    }
    const maxLife = lifeForLevel(level);
    const currentLife = Number.isFinite(Number(state.life?.current)) ? Number(state.life?.current) : maxLife;
    const safeLife = Math.max(0, Math.min(maxLife, currentLife));
    const isDefeated = safeLife <= 0;
    if (isDefeated) {
      document.body.classList.add("defeatMode");
    } else {
      document.body.classList.remove("defeatMode");
    }
    if (defeatRevivePanel) defeatRevivePanel.hidden = !isDefeated;
    if (lifeDash) lifeDash.textContent = String(safeLife);
    if (lifeBarDash) {
      const lifePct = maxLife > 0 ? Math.round((safeLife / maxLife) * 100) : 0;
      lifeBarDash.style.width = `${lifePct}%`;
    }
    if (lifeBarLabel) lifeBarLabel.textContent = `${safeLife}/${maxLife}`;

    const pct = Math.max(0, Math.min(100, (xp / xpNeed) * 100));
    xpBarDash.style.width = pct + "%";
    if (streakDash) streakDash.textContent = String(getMissionStreak(state));
    if (tokensDash) tokensDash.textContent = String(state.tokens ?? 0);
    if (skipTokenBtn) {
      const tokens = Number.isFinite(state.tokens) ? state.tokens : 0;
      const used = !!state.daily?.skipUsed;
      const todaySnapshot = getGoalsSnapshot(state, todayLocalKey());
      const missionComplete = isMissionComplete(
        todaySnapshot.goals,
        todaySnapshot.goalsDone,
        todaySnapshot.skipUsed,
      );
      skipTokenBtn.disabled = tokens <= 0 || used || missionComplete;
      if (used) {
        skipTokenBtn.textContent = t("skip.usedLabel");
      } else if (missionComplete) {
        skipTokenBtn.textContent = t("skip.completeLabel");
      } else {
        skipTokenBtn.textContent = t("skip.useLabel");
      }
    }

    if (goalsDoneSummary && goalsMissingSummary) {
      const goals = state.goals || {};
      const done = state.daily?.goalsDone || {};
      const activeKeys = goalKeys.filter(k => Number(goals[k] ?? 0) > 0);
      const doneLabels = activeKeys.filter(k => done[k]).map(k => getGoalLabel(k));
      const missingLabels = activeKeys.filter(k => !done[k]).map(k => getGoalLabel(k));

      goalsDoneSummary.innerHTML = "";
      goalsMissingSummary.innerHTML = "";

      if (!doneLabels.length) {
        goalsDoneSummary.innerHTML = `<li><span class="muted">${escapeHTML(t("day.noneDone"))}</span></li>`;
      } else {
        const frag = document.createDocumentFragment();
        doneLabels.forEach(label => {
          const li = document.createElement("li");
          li.innerHTML = `<span class="text">${escapeHTML(label)}</span>`;
          frag.appendChild(li);
        });
        goalsDoneSummary.appendChild(frag);
      }

      if (!missingLabels.length) {
        goalsMissingSummary.innerHTML = `<li><span class="muted">${escapeHTML(t("day.noneMissing"))}</span></li>`;
      } else {
        const frag = document.createDocumentFragment();
        missingLabels.forEach(label => {
          const li = document.createElement("li");
          li.innerHTML = `<span class="text">${escapeHTML(label)}</span>`;
          frag.appendChild(li);
        });
        goalsMissingSummary.appendChild(frag);
      }
    }

    renderCalendar(state);

    if (achievementsList && achievementsCount) {
      const ach = Array.isArray(state.achievements) ? state.achievements : [];
      const earnedIds = new Set(ach.map(item => item.id));
      achievementsCount.textContent = String(ach.length);
      achievementsList.innerHTML = "";
      if (!ach.length) {
        achievementsList.innerHTML = `<li><span class="muted">${escapeHTML(t("achievements.empty"))}</span></li>`;
      } else {
        const fragAch = document.createDocumentFragment();
        achievementCategories.forEach((category) => {
          const items = ACHIEVEMENTS.filter(item => item.type === category.key);
          const topEarned = items.reduce((best, current) => {
            if (!earnedIds.has(current.id)) return best;
            if (!best) return current;
            return Number(current.target ?? 0) > Number(best.target ?? 0) ? current : best;
          }, null);
          const li = document.createElement("li");
          li.className = "achievementSummary";
          if (topEarned) {
            const title = getAchievementTitle(topEarned.id, topEarned.title);
            li.innerHTML = `
              <div class="achievementSummaryHeader">
                <span class="achievementSummaryTitle">${escapeHTML(t(`achievement.${category.key}`))}</span>
                <span class="pill">${escapeHTML(t("achievements.max"))}</span>
              </div>
              <p class="achievementSummaryText">${escapeHTML(title)}</p>
            `;
          } else {
            li.innerHTML = `
              <div class="achievementSummaryHeader">
                <span class="achievementSummaryTitle">${escapeHTML(t(`achievement.${category.key}`))}</span>
                <span class="pill muted">${escapeHTML(t("achievements.none"))}</span>
              </div>
              <p class="achievementSummaryText muted">${escapeHTML(t("achievements.noneDetail"))}</p>
            `;
          }
          fragAch.appendChild(li);
        });
        achievementsList.appendChild(fragAch);
      }
    }
  }

  if (calendarGrid) {
    calendarGrid.addEventListener("click", (e) => {
      const btn = e.target.closest(".calendarDay");
      if (!btn) return;
      const key = btn.dataset.dateKey;
      if (!key) return;
      openDayModal(store.getState(), key);
    });
  }

  if (dayModalClose) {
    dayModalClose.addEventListener("click", () => closeDayModal());
  }

  if (calendarMonthBtn) {
    calendarMonthBtn.addEventListener("click", () => openMonthPicker());
  }

  if (monthPickerYear && monthPickerMonth) {
    monthPickerYear.addEventListener("change", () => {
      const startDate = getStartDate();
      const year = Number(monthPickerYear.value);
      buildMonthOptions(startDate, year);
      if (monthPickerMonth.options.length) {
        monthPickerMonth.value = monthPickerMonth.options[0].value;
      }
    });
  }

  if (monthPickerApply) {
    monthPickerApply.addEventListener("click", () => {
      if (!monthPickerYear || !monthPickerMonth) return;
      viewYear = Number(monthPickerYear.value);
      viewMonth = Number(monthPickerMonth.value);
      renderCalendar(store.getState());
      closeMonthPicker();
    });
  }

  if (monthPickerClose) {
    monthPickerClose.addEventListener("click", () => closeMonthPicker());
  }

  if (defeatModalClose) {
    defeatModalClose.addEventListener("click", () => closeDefeatModal());
  }
  if (defeatModalRevive) {
    defeatModalRevive.addEventListener("click", () => revive());
  }
  if (reviveBtn) {
    reviveBtn.addEventListener("click", () => revive());
  }

  if (skipTokenBtn) {
    skipTokenBtn.addEventListener("click", () => {
      const state = store.getState();
      const tokens = Number.isFinite(state.tokens) ? state.tokens : 0;
      const todaySnapshot = getGoalsSnapshot(state, todayLocalKey());
      const missionComplete = isMissionComplete(
        todaySnapshot.goals,
        todaySnapshot.goalsDone,
        todaySnapshot.skipUsed,
      );
      if (tokens <= 0) {
        toast?.show(t("skip.noTokens"));
        return;
      }
      if (missionComplete) {
        toast?.show(t("skip.alreadyComplete"));
        return;
      }
      if (state.daily?.skipUsed) {
        toast?.show(t("skip.alreadyUsed"));
        return;
      }
      const confirmed = window.confirm(t("skip.confirm"));
      if (!confirmed) return;
      const res = store.dispatch({ type: "DAILY_SKIP" });
      if (res?.error === "no_tokens") {
        toast?.show(t("skip.noTokens"));
        return;
      }
      if (res?.error === "dead") {
        toast?.show(t("dead.blocked"));
        return;
      }
      if (res?.error === "already_used") {
        toast?.show(t("skip.alreadyUsed"));
        return;
      }
      toast?.show(t("skip.done"));
      showAchievementToasts(toast, res?.achievementsEarned, 2600);
    });
  }

  const adminControls = document.getElementById("adminControls");
  const isAdmin = isAdminUser();
  if (adminControls && !isAdmin) {
    adminControls.remove();
  }
  if (adminControls && isAdmin) {
    adminControls.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-admin-date]");
      if (!btn) return;
      const action = btn.dataset.adminDate;
      if (action === "level-up") {
        const res = store.dispatch({ type: "DEV_LEVEL_UP" });
        if (res?.levelUps?.length) {
          const last = res.levelUps[res.levelUps.length - 1];
          toast?.show(t("level.up", { level: last }));
        }
        showAchievementToasts(toast, res?.achievementsEarned, 2600);
        return;
      }
      if (action === "reset-accounts") {
        const confirmed = window.confirm(t("admin.resetConfirm"));
        if (!confirmed) return;
        const adminUser = getCurrentUser();
        if (!adminUser) {
          toast?.show(t("admin.notFound"));
          return;
        }
        const authRes = resetAuthToAdmin();
        if (authRes?.error) {
          toast?.show(t("admin.notFound"));
          return;
        }
        clearUserStatesExcept(adminUser.id);
        resetUserState(adminUser.id, adminUser.name);
        localStorage.removeItem("levelup_admin_now");
        toast?.show(t("admin.resetDone"));
        setTimeout(() => window.location.reload(), 400);
        return;
      }
      const now = getNow();
      if (action === "today") {
        localStorage.removeItem("levelup_admin_now");
      } else if (action === "prev-day") {
        now.setDate(now.getDate() - 1);
        localStorage.setItem("levelup_admin_now", now.toISOString());
      } else if (action === "next-day") {
        now.setDate(now.getDate() + 1);
        localStorage.setItem("levelup_admin_now", now.toISOString());
      } else if (action === "prev-month") {
        now.setMonth(now.getMonth() - 1);
        localStorage.setItem("levelup_admin_now", now.toISOString());
      } else if (action === "next-month") {
        now.setMonth(now.getMonth() + 1);
        localStorage.setItem("levelup_admin_now", now.toISOString());
      }
      refreshTodayText(true);
      scheduleNextDateRefresh();
      const refreshed = getNow();
      viewYear = refreshed.getFullYear();
      viewMonth = refreshed.getMonth();
      store.dispatch({ type: "DEV_FORCE_RENDER" });
    });
  }

  render(store.getState());
  const onLanguageChange = () => {
    refreshTodayText(true);
    render(store.getState());
    if (monthPickerYear && monthPickerMonth && monthPickerModal?.classList.contains("show")) {
      const startDate = getStartDate();
      const year = Number(monthPickerYear.value);
      buildMonthOptions(startDate, year);
    }
  };
  window.addEventListener("languagechange", onLanguageChange);
  const unsubscribe = store.subscribe(render);
  return () => {
    unsubscribe?.();
    window.removeEventListener("languagechange", onLanguageChange);
  };
}
