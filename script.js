/* =========================================================
   나의 달력 — script.js
   전체 데이터는 localStorage 에만 저장됩니다.
========================================================= */
(() => {
  "use strict";

  /* ---------- constants ---------- */
  const DATA_KEY = "myCalendarData_v1";
  const SETTINGS_KEY = "myCalendarSettings_v1";

  const PALETTE = [
    { name: "레드",   hex: "#FF6B6B" },
    { name: "오렌지", hex: "#FFA94D" },
    { name: "옐로우", hex: "#FFD43B" },
    { name: "그린",   hex: "#51CF66" },
    { name: "틸",     hex: "#20C997" },
    { name: "블루",   hex: "#4DABF7" },
    { name: "인디고", hex: "#7C6CF6" },
    { name: "핑크",   hex: "#F783AC" },
  ];

  const WEEKDAY_KO = ["일요일","월요일","화요일","수요일","목요일","금요일","토요일"];
  const DEFAULT_EVENT_COLOR = "#7C6CF6";

  /* ---------- state ---------- */
  let db = loadData();
  let settings = loadSettings();
  let view = { year: new Date().getFullYear(), month: new Date().getMonth() }; // month: 0-11
  let selectedDate = null;      // "YYYY-MM-DD" currently open in modal
  let searchQuery = "";
  let editingId = null;

  /* ---------- persistence ---------- */
  function loadData() {
    try {
      const raw = localStorage.getItem(DATA_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { console.warn("데이터 로드 실패", e); }
    return { events: {}, dateColors: {} };
  }
  function saveData() {
    localStorage.setItem(DATA_KEY, JSON.stringify(db));
  }
  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { theme: "light" };
  }
  function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  /* ---------- date helpers ---------- */
  const pad2 = n => String(n).padStart(2, "0");
  const dkey = (y, m, d) => `${y}-${pad2(m + 1)}-${pad2(d)}`;
  const monthKeyPrefix = (y, m) => `${y}-${pad2(m + 1)}`;
  function todayKey() {
    const t = new Date();
    return dkey(t.getFullYear(), t.getMonth(), t.getDate());
  }
  function parseKey(key) {
    const [y, m, d] = key.split("-").map(Number);
    return { y, m: m - 1, d };
  }

  /* ---------- DOM refs ---------- */
  const $ = sel => document.querySelector(sel);
  const el = {
    root: document.documentElement,
    brandHomeBtn: $("#brandHomeBtn"),
    grid: $("#calendarGrid"),
    monthLabel: $("#monthLabel"),
    monthSub: $("#monthSub"),
    colorStats: $("#colorStats"),
    ghostMonth: $("#ghostMonth"),
    prevMonth: $("#prevMonth"),
    nextMonth: $("#nextMonth"),
    todayBtn: $("#todayBtn"),
    jumpBtn: $("#jumpBtn"),
    searchInput: $("#searchInput"),
    themeToggle: $("#themeToggle"),
    themeIcon: $("#themeIcon"),
    dataMenuBtn: $("#dataMenuBtn"),
    dataMenu: $("#dataMenu"),
    importFile: $("#importFile"),
    modalBackdrop: $("#modalBackdrop"),
    closeModal: $("#closeModal"),
    modalWeekday: $("#modalWeekday"),
    modalDate: $("#modalDate"),
    dateColorRow: $("#dateColorRow"),
    eventList: $("#eventList"),
    addEventToggleBtn: $("#addEventToggleBtn"),
    eventFormBackdrop: $("#eventFormBackdrop"),
    eventFormTitle: $("#eventFormTitle"),
    closeEventForm: $("#closeEventForm"),
    addEventForm: $("#addEventForm"),
    eventTitle: $("#eventTitle"),
    eventTime: $("#eventTime"),
    timePicker: $("#timePicker"),
    timePickerBtn: $("#timePickerBtn"),
    timePickerLabel: $("#timePickerLabel"),
    timePickerPanel: $("#timePickerPanel"),
    ampmCol: $("#ampmCol"),
    hourCol: $("#hourCol"),
    minuteCol: $("#minuteCol"),
    timeClearBtn: $("#timeClearBtn"),
    timeConfirmBtn: $("#timeConfirmBtn"),
    eventMemo: $("#eventMemo"),
    editingEventId: $("#editingEventId"),
    cancelEditBtn: $("#cancelEditBtn"),
    submitEventBtn: $("#submitEventBtn"),
    jumpBackdrop: $("#jumpBackdrop"),
    closeJump: $("#closeJump"),
    yearPicker: $("#yearPicker"),
    yearPickerBtn: $("#yearPickerBtn"),
    yearPickerLabel: $("#yearPickerLabel"),
    yearPickerList: $("#yearPickerList"),
    monthPicker: $("#monthPicker"),
    monthPickerBtn: $("#monthPickerBtn"),
    monthPickerLabel: $("#monthPickerLabel"),
    monthPickerList: $("#monthPickerList"),
    jumpGoBtn: $("#jumpGoBtn"),
    jumpMiniCal: $("#jumpMiniCal"),
    colorAssignBtn: $("#colorAssignBtn"),
    colorBackdrop: $("#colorBackdrop"),
    closeColor: $("#closeColor"),
    colorPaintRow: $("#colorPaintRow"),
    colorPrevMonth: $("#colorPrevMonth"),
    colorNextMonth: $("#colorNextMonth"),
    colorTodayBtn: $("#colorTodayBtn"),
    colorCalLabel: $("#colorCalLabel"),
    colorMiniCal: $("#colorMiniCal"),
    colorHint: $("#colorHint"),
    toastStack: $("#toastStack"),
  };

  /* ---------- theme ---------- */
  function applyTheme() {
    el.root.setAttribute("data-theme", settings.theme);
    el.themeIcon.innerHTML = settings.theme === "dark"
      ? '<path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>'
      : '<circle cx="12" cy="12" r="4.2" stroke="currentColor" stroke-width="1.6"/><path d="M12 2v2.4M12 19.6V22M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2 12h2.4M19.6 12H22M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>';
  }
  el.themeToggle.addEventListener("click", () => {
    settings.theme = settings.theme === "dark" ? "light" : "dark";
    saveSettings();
    applyTheme();
    el.themeIcon.classList.remove("icon-spin");
    void el.themeIcon.offsetWidth;
    el.themeIcon.classList.add("icon-spin");
  });

  /* ---------- toasts ---------- */
  function toast(msg, type = "info") {
    const t = document.createElement("div");
    t.className = `toast ${type}`;
    t.innerHTML = `<span class="dot"></span><span>${escapeHtml(msg)}</span>`;
    el.toastStack.appendChild(t);
    setTimeout(() => {
      t.classList.add("leaving");
      setTimeout(() => t.remove(), 240);
    }, 2600);
  }

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  /* ---------- calendar rendering ---------- */
  function renderColorStats(prefix) {
    const counts = {};
    PALETTE.forEach(c => counts[c.hex] = 0);
    Object.keys(db.dateColors)
      .filter(k => k.startsWith(prefix))
      .forEach(k => {
        const hex = db.dateColors[k];
        if (counts[hex] !== undefined) counts[hex]++;
      });

    el.colorStats.innerHTML = "";
    PALETTE.forEach(c => {
      const n = counts[c.hex];
      const chip = document.createElement("div");
      chip.className = "color-stat" + (n === 0 ? " zero" : "");
      chip.title = c.name;
      chip.innerHTML = `<span class="dot" style="background:${c.hex}"></span><span class="cnt">${n}</span>`;
      el.colorStats.appendChild(chip);
    });
  }

  function renderCalendar(direction) {
    const { year, month } = view;
    el.monthLabel.textContent = `${year}년 ${month + 1}월`;
    el.ghostMonth.textContent = pad2(month + 1);

    const prefix = monthKeyPrefix(year, month);
    const monthEventCount = Object.keys(db.events)
      .filter(k => k.startsWith(prefix))
      .reduce((sum, k) => sum + db.events[k].length, 0);
    el.monthSub.textContent = `일정 ${monthEventCount}개`;
    renderColorStats(prefix);

    const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const totalCells = Math.ceil((firstDow + daysInMonth) / 7) * 7;

    el.grid.innerHTML = "";
    if (direction) {
      el.grid.classList.remove("slide-left", "slide-right");
      void el.grid.offsetWidth;
      el.grid.classList.add(direction === "next" ? "slide-left" : "slide-right");
    }

    const tKey = todayKey();

    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - firstDow + 1;
      let cellY = year, cellM = month, cellD = dayNum, outside = false;

      if (dayNum < 1) {
        cellM = month - 1; cellY = month === 0 ? year - 1 : year;
        cellD = daysInPrevMonth + dayNum;
        outside = true;
      } else if (dayNum > daysInMonth) {
        cellM = month + 1; cellY = month === 11 ? year + 1 : year;
        cellD = dayNum - daysInMonth;
        outside = true;
      }
      if (outside) { cellM = ((cellM % 12) + 12) % 12; }

      const key = dkey(cellY, cellM, cellD);
      const dow = new Date(cellY, cellM, cellD).getDay();

      const cell = document.createElement("div");
      cell.className = "day-cell" + (outside ? " outside" : "") + ((dow === 0 || dow === 6) ? " weekend" : "") + (key === tKey ? " is-today" : "");
      cell.tabIndex = 0;
      cell.dataset.key = key;
      cell.style.setProperty("--i", i % 7 + Math.floor(i / 7));

      const cellColor = db.dateColors[key];
      if (cellColor) {
        cell.dataset.hascolor = "1";
        cell.style.setProperty("--cell-color", cellColor);
      }

      let dayEvents = (db.events[key] || []).slice();

      if (searchQuery) {
        dayEvents = dayEvents.filter(ev =>
          ev.title.toLowerCase().includes(searchQuery) ||
          (ev.memo || "").toLowerCase().includes(searchQuery)
        );
      }
      dayEvents.sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));

      const numWrap = document.createElement("div");
      numWrap.className = "day-num";
      numWrap.textContent = cellD;
      cell.appendChild(numWrap);

      const evWrap = document.createElement("div");
      evWrap.className = "day-events";
      const maxShow = 3;
      dayEvents.slice(0, maxShow).forEach(ev => {
        const chip = document.createElement("div");
        chip.className = "event-chip";
        chip.style.background = ev.color;
        chip.innerHTML = `${ev.time ? `<span class="t">${ev.time}</span>` : ""}<span class="chip-title">${escapeHtml(ev.title)}</span>`;
        chip.addEventListener("click", (e) => {
          e.stopPropagation();
          openDayModal(key, ev.id);
        });
        evWrap.appendChild(chip);
      });
      if (dayEvents.length > maxShow) {
        const more = document.createElement("div");
        more.className = "more-chip";
        more.textContent = `+${dayEvents.length - maxShow}개 더`;
        evWrap.appendChild(more);
      }
      cell.appendChild(evWrap);

      cell.addEventListener("click", () => openDayModal(key));
      cell.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openDayModal(key); }
      });

      el.grid.appendChild(cell);
    }
  }

  /* ---------- month navigation ---------- */
  function changeMonth(delta) {
    view.month += delta;
    if (view.month < 0) { view.month = 11; view.year--; }
    if (view.month > 11) { view.month = 0; view.year++; }
    renderCalendar(delta > 0 ? "next" : "prev");
  }
  el.prevMonth.addEventListener("click", (e) => { changeMonth(-1); e.currentTarget.blur(); });
  el.nextMonth.addEventListener("click", (e) => { changeMonth(1); e.currentTarget.blur(); });

  function goToToday() {
    const t = new Date();
    const targetYear = t.getFullYear(), targetMonth = t.getMonth();
    const curIdx = view.year * 12 + view.month;
    const targetIdx = targetYear * 12 + targetMonth;
    const direction = targetIdx === curIdx ? null : (targetIdx > curIdx ? "next" : "prev");

    view = { year: targetYear, month: targetMonth };
    renderCalendar(direction);

    requestAnimationFrame(() => {
      const todayCell = el.grid.querySelector(".day-cell.is-today");
      if (todayCell) {
        todayCell.classList.remove("arrive-pulse");
        void todayCell.offsetWidth;
        todayCell.classList.add("arrive-pulse");
        setTimeout(() => todayCell.classList.remove("arrive-pulse"), 850);
      }
    });
  }
  el.todayBtn.addEventListener("click", (e) => { goToToday(); e.currentTarget.blur(); });
  el.brandHomeBtn.addEventListener("click", goToToday);

  document.addEventListener("keydown", (e) => {
    if (el.modalBackdrop.classList.contains("open") || el.jumpBackdrop.classList.contains("open")) return;
    if (document.activeElement === el.searchInput) return;
    if (e.key === "ArrowLeft") changeMonth(-1);
    if (e.key === "ArrowRight") changeMonth(1);
  });

  /* ---------- jump to date ---------- */
  const YEAR_MIN = 1950;
  const YEAR_MAX = new Date().getFullYear() + 50;
  const MONTH_NAMES_FULL = Array.from({ length: 12 }, (_, i) => `${i + 1}월`);
  let jumpSelectedYear = view.year;
  let jumpSelectedMonth = view.month;

  function closeAllPickers(except) {
    [el.yearPicker, el.monthPicker].forEach(p => {
      if (p !== except) p.classList.remove("open");
    });
  }

  function populateJumpSelectors() {
    jumpSelectedYear = view.year;
    jumpSelectedMonth = view.month;
    el.yearPickerLabel.textContent = `${jumpSelectedYear}년`;
    el.monthPickerLabel.textContent = MONTH_NAMES_FULL[jumpSelectedMonth];

    el.yearPickerList.innerHTML = "";
    for (let y = YEAR_MIN; y <= YEAR_MAX; y++) {
      const item = document.createElement("div");
      item.className = "picker-item" + (y === jumpSelectedYear ? " selected" : "");
      item.textContent = `${y}년`;
      item.dataset.year = y;
      item.addEventListener("click", () => {
        jumpSelectedYear = y;
        el.yearPickerLabel.textContent = `${y}년`;
        el.yearPicker.classList.remove("open");
        [...el.yearPickerList.children].forEach(c => c.classList.toggle("selected", Number(c.dataset.year) === y));
        renderJumpMiniCal(jumpSelectedYear, jumpSelectedMonth);
      });
      el.yearPickerList.appendChild(item);
    }

    el.monthPickerList.innerHTML = "";
    MONTH_NAMES_FULL.forEach((label, m) => {
      const item = document.createElement("div");
      item.className = "picker-item" + (m === jumpSelectedMonth ? " selected" : "");
      item.textContent = label;
      item.dataset.month = m;
      item.addEventListener("click", () => {
        jumpSelectedMonth = m;
        el.monthPickerLabel.textContent = label;
        el.monthPicker.classList.remove("open");
        [...el.monthPickerList.children].forEach(c => c.classList.toggle("selected", Number(c.dataset.month) === m));
        renderJumpMiniCal(jumpSelectedYear, jumpSelectedMonth);
      });
      el.monthPickerList.appendChild(item);
    });
  }

  function scrollPickerSelectionIntoView(listEl) {
    const selected = listEl.querySelector(".selected");
    if (selected && typeof selected.scrollIntoView === "function") {
      selected.scrollIntoView({ block: "center" });
    }
  }

  el.yearPickerBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const willOpen = !el.yearPicker.classList.contains("open");
    closeAllPickers();
    el.yearPicker.classList.toggle("open", willOpen);
    if (willOpen) scrollPickerSelectionIntoView(el.yearPickerList);
  });
  el.monthPickerBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const willOpen = !el.monthPicker.classList.contains("open");
    closeAllPickers();
    el.monthPicker.classList.toggle("open", willOpen);
    if (willOpen) scrollPickerSelectionIntoView(el.monthPickerList);
  });
  document.addEventListener("click", () => closeAllPickers());
  el.yearPickerList.addEventListener("click", (e) => e.stopPropagation());
  el.monthPickerList.addEventListener("click", (e) => e.stopPropagation());

  function renderJumpMiniCal(year, month) {
    const container = el.jumpMiniCal;
    container.innerHTML = "";

    const wdRow = document.createElement("div");
    wdRow.className = "mini-wd-row";
    ["일","월","화","수","목","금","토"].forEach(w => {
      const s = document.createElement("span");
      s.textContent = w;
      wdRow.appendChild(s);
    });
    container.appendChild(wdRow);

    const grid = document.createElement("div");
    grid.className = "mini-grid";

    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalCells = Math.ceil((firstDow + daysInMonth) / 7) * 7;
    const tKey = todayKey();

    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - firstDow + 1;
      const cell = document.createElement("div");
      cell.className = "mini-cell";

      if (dayNum < 1 || dayNum > daysInMonth) {
        cell.classList.add("outside");
      } else {
        const key = dkey(year, month, dayNum);
        cell.textContent = dayNum;
        if (key === tKey) cell.classList.add("today");

        const color = db.dateColors[key];
        if (color) {
          cell.classList.add("has-color");
          cell.style.setProperty("--dot-color", color);
        } else if ((db.events[key] || []).length > 0) {
          cell.classList.add("has-event");
        }

        cell.addEventListener("click", () => {
          view.year = year; view.month = month;
          renderCalendar();
          el.jumpBackdrop.classList.remove("open");
          openDayModal(key);
        });
      }
      grid.appendChild(cell);
    }
    container.appendChild(grid);
  }

  el.jumpBtn.addEventListener("click", () => {
    populateJumpSelectors();
    renderJumpMiniCal(view.year, view.month);
    el.jumpBackdrop.classList.add("open");
  });
  el.closeJump.addEventListener("click", () => el.jumpBackdrop.classList.remove("open"));
  el.jumpBackdrop.addEventListener("click", (e) => {
    if (e.target === el.jumpBackdrop) el.jumpBackdrop.classList.remove("open");
  });
  el.jumpGoBtn.addEventListener("click", () => {
    view.year = jumpSelectedYear;
    view.month = jumpSelectedMonth;
    renderCalendar();
    el.jumpBackdrop.classList.remove("open");
  });

  /* ---------- color assign modal (separate from jump modal) ---------- */
  let colorPaintColor = null; // null = nothing selected, "" = erase, hex = paint color
  let colorCalYear = view.year, colorCalMonth = view.month;

  function buildColorPaintRow() {
    el.colorPaintRow.innerHTML = "";

    const noneSw = document.createElement("div");
    noneSw.className = "swatch none";
    noneSw.textContent = "–";
    noneSw.title = "지우개";
    noneSw.dataset.hex = "";
    noneSw.addEventListener("click", () => toggleColorPaintColor(""));
    el.colorPaintRow.appendChild(noneSw);

    PALETTE.forEach(c => {
      const sw = document.createElement("div");
      sw.className = "swatch";
      sw.style.background = c.hex;
      sw.title = c.name;
      sw.dataset.hex = c.hex;
      sw.addEventListener("click", () => toggleColorPaintColor(c.hex));
      el.colorPaintRow.appendChild(sw);
    });
  }

  function toggleColorPaintColor(hex) {
    colorPaintColor = (colorPaintColor === hex) ? null : hex;
    syncColorPaintUI();
  }

  function syncColorPaintUI() {
    [...el.colorPaintRow.children].forEach(sw => {
      sw.classList.toggle("selected", colorPaintColor !== null && sw.dataset.hex === colorPaintColor);
    });

    if (colorPaintColor === null) {
      el.colorHint.textContent = "색상을 먼저 선택한 뒤, 날짜를 클릭하면 바로 칠해져요.";
      el.colorHint.classList.remove("paint-active");
    } else if (colorPaintColor === "") {
      el.colorHint.textContent = "지우개가 선택됐어요. 날짜를 클릭하면 색이 지워져요.";
      el.colorHint.classList.add("paint-active");
    } else {
      el.colorHint.textContent = "선택한 색으로 날짜를 클릭해 바로 칠해보세요.";
      el.colorHint.classList.add("paint-active");
    }
  }

  function resetColorPaintTool() {
    colorPaintColor = null;
    syncColorPaintUI();
  }

  function renderColorMiniCal(year, month) {
    colorCalYear = year;
    colorCalMonth = month;
    el.colorCalLabel.textContent = `${year}년 ${month + 1}월`;

    const container = el.colorMiniCal;
    container.innerHTML = "";

    const wdRow = document.createElement("div");
    wdRow.className = "mini-wd-row";
    ["일","월","화","수","목","금","토"].forEach(w => {
      const s = document.createElement("span");
      s.textContent = w;
      wdRow.appendChild(s);
    });
    container.appendChild(wdRow);

    const grid = document.createElement("div");
    grid.className = "mini-grid paint-mode";

    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalCells = Math.ceil((firstDow + daysInMonth) / 7) * 7;
    const tKey = todayKey();

    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - firstDow + 1;
      const cell = document.createElement("div");
      cell.className = "mini-cell";

      if (dayNum < 1 || dayNum > daysInMonth) {
        cell.classList.add("outside");
      } else {
        const key = dkey(year, month, dayNum);
        cell.textContent = dayNum;
        if (key === tKey) cell.classList.add("today");

        const color = db.dateColors[key];
        if (color) {
          cell.classList.add("has-color");
          cell.style.setProperty("--dot-color", color);
        } else if ((db.events[key] || []).length > 0) {
          cell.classList.add("has-event");
        }
        cell.dataset.key = key;

        cell.addEventListener("click", () => {
          if (colorPaintColor === null) {
            toast("먼저 색상을 선택해주세요", "info");
            return;
          }
          if (colorPaintColor === "") {
            delete db.dateColors[key];
          } else {
            db.dateColors[key] = colorPaintColor;
          }
          saveData();
          renderColorMiniCal(colorCalYear, colorCalMonth);
          if (view.year === year && view.month === month) renderCalendar();
          requestAnimationFrame(() => {
            const repainted = el.colorMiniCal.querySelector(`.mini-cell[data-key="${key}"]`);
            if (repainted) {
              repainted.classList.add("just-painted");
              setTimeout(() => repainted.classList.remove("just-painted"), 300);
            }
          });
        });
      }
      grid.appendChild(cell);
    }
    container.appendChild(grid);
  }

  function changeColorCalMonth(delta) {
    let y = colorCalYear, m = colorCalMonth + delta;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    renderColorMiniCal(y, m);
  }

  el.colorAssignBtn.addEventListener("click", () => {
    buildColorPaintRow();
    resetColorPaintTool();
    renderColorMiniCal(view.year, view.month);
    el.colorBackdrop.classList.add("open");
  });
  el.closeColor.addEventListener("click", () => { resetColorPaintTool(); el.colorBackdrop.classList.remove("open"); });
  el.colorBackdrop.addEventListener("click", (e) => {
    if (e.target === el.colorBackdrop) { resetColorPaintTool(); el.colorBackdrop.classList.remove("open"); }
  });
  el.colorPrevMonth.addEventListener("click", () => changeColorCalMonth(-1));
  el.colorNextMonth.addEventListener("click", () => changeColorCalMonth(1));
  el.colorTodayBtn.addEventListener("click", () => {
    const t = new Date();
    renderColorMiniCal(t.getFullYear(), t.getMonth());
  });

  /* ---------- search ---------- */
  let searchDebounce;
  el.searchInput.addEventListener("input", (e) => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      searchQuery = e.target.value.trim().toLowerCase();
      renderCalendar();
    }, 180);
  });

  /* ---------- data menu ---------- */
  el.dataMenuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    el.dataMenu.classList.toggle("open");
  });
  document.addEventListener("click", () => el.dataMenu.classList.remove("open"));
  el.dataMenu.addEventListener("click", (e) => e.stopPropagation());

  el.dataMenu.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    el.dataMenu.classList.remove("open");
    if (action === "export-month") exportMonth();
    else if (action === "export-all") exportAll();
    else if (action === "export-ics-month") exportICSMonth();
    else if (action === "export-ics-all") exportICSAll();
    else if (action === "import") el.importFile.click();
    else if (action === "clear-month") clearMonth();
  });

  /* ---------- iCalendar (.ics) export for iPhone / Galaxy / Google Calendar ---------- */
  function escapeICSText(str) {
    return String(str)
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\r?\n/g, "\\n");
  }

  function icsDateStamp() {
    const d = new Date();
    return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`;
  }

  function buildICS(entries) {
    // entries: [{ key: "YYYY-MM-DD", ev: {id,title,time,memo} }]
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//My Calendar//KO",
      "CALSCALE:GREGORIAN",
    ];
    const stamp = icsDateStamp();

    entries.forEach(({ key, ev }) => {
      const { y, m, d } = parseKey(key);
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${ev.id}@my-calendar.local`);
      lines.push(`DTSTAMP:${stamp}`);

      if (ev.time) {
        const [hh, mm] = ev.time.split(":").map(Number);
        const startStr = `${y}${pad2(m + 1)}${pad2(d)}T${pad2(hh)}${pad2(mm)}00`;
        let endH = hh + 1, endDay = d, endM = m, endY = y;
        if (endH >= 24) {
          endH -= 24;
          const next = new Date(y, m, d + 1);
          endY = next.getFullYear(); endM = next.getMonth(); endDay = next.getDate();
        }
        const endStr = `${endY}${pad2(endM + 1)}${pad2(endDay)}T${pad2(endH)}${pad2(mm)}00`;
        lines.push(`DTSTART:${startStr}`);
        lines.push(`DTEND:${endStr}`);
      } else {
        const startStr = `${y}${pad2(m + 1)}${pad2(d)}`;
        const next = new Date(y, m, d + 1);
        const endStr = `${next.getFullYear()}${pad2(next.getMonth() + 1)}${pad2(next.getDate())}`;
        lines.push(`DTSTART;VALUE=DATE:${startStr}`);
        lines.push(`DTEND;VALUE=DATE:${endStr}`);
      }

      lines.push(`SUMMARY:${escapeICSText(ev.title)}`);
      if (ev.memo) lines.push(`DESCRIPTION:${escapeICSText(ev.memo)}`);
      lines.push("END:VEVENT");
    });

    lines.push("END:VCALENDAR");
    return lines.join("\r\n");
  }

  function collectEntries(prefix) {
    const entries = [];
    Object.keys(db.events)
      .filter(k => !prefix || k.startsWith(prefix))
      .sort()
      .forEach(key => {
        db.events[key].forEach(ev => entries.push({ key, ev }));
      });
    return entries;
  }

  function downloadICS(icsText, filename) {
    const blob = new Blob([icsText], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 800);
  }

  async function shareOrDownloadICS(icsText, filename) {
    try {
      const file = new File([icsText], filename, { type: "text/calendar" });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
        toast("공유 시트에서 캘린더 앱을 선택해 추가하세요", "success");
        return;
      }
    } catch (err) {
      if (err && err.name === "AbortError") return; // user cancelled the share sheet
      // fall through to download on any other failure
    }
    downloadICS(icsText, filename);
    toast("파일이 저장됐어요. 캘린더 앱으로 열어 추가하세요", "success");
  }

  function exportICSMonth() {
    const prefix = monthKeyPrefix(view.year, view.month);
    const entries = collectEntries(prefix);
    if (entries.length === 0) {
      toast("이번 달에는 내보낼 일정이 없어요", "info");
      return;
    }
    shareOrDownloadICS(buildICS(entries), `calendar_${prefix}.ics`);
  }

  function exportICSAll() {
    const entries = collectEntries(null);
    if (entries.length === 0) {
      toast("내보낼 일정이 없어요", "info");
      return;
    }
    shareOrDownloadICS(buildICS(entries), `calendar_전체일정.ics`);
  }

  function exportMonth() {
    const prefix = monthKeyPrefix(view.year, view.month);
    const events = {}, dateColors = {};
    Object.keys(db.events).filter(k => k.startsWith(prefix)).forEach(k => events[k] = db.events[k]);
    Object.keys(db.dateColors).filter(k => k.startsWith(prefix)).forEach(k => dateColors[k] = db.dateColors[k]);

    const payload = {
      type: "myCalendarMonthExport",
      version: 1,
      month: prefix,
      exportedAt: new Date().toISOString(),
      events, dateColors,
    };
    downloadJson(payload, `calendar_${prefix}.json`);
    toast(`${prefix} 데이터를 내보냈어요`, "success");
  }

  function exportAll() {
    const payload = {
      type: "myCalendarFullExport",
      version: 1,
      exportedAt: new Date().toISOString(),
      events: db.events,
      dateColors: db.dateColors,
    };
    downloadJson(payload, `calendar_backup_전체.json`);
    toast("전체 데이터를 내보냈어요", "success");
  }

  function downloadJson(obj, filename) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 800);
  }

  el.importFile.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result);
        importPayload(json);
      } catch (err) {
        toast("JSON 파일을 읽을 수 없어요", "error");
      }
      el.importFile.value = "";
    };
    reader.readAsText(file);
  });

  function importPayload(json) {
    if (!json || typeof json !== "object" || !json.events || !json.dateColors) {
      toast("올바른 달력 데이터 형식이 아니에요", "error");
      return;
    }
    let dateCount = 0, eventCount = 0;
    Object.keys(json.events).forEach(k => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return;
      db.events[k] = json.events[k];
      eventCount += json.events[k].length;
      dateCount++;
    });
    Object.keys(json.dateColors).forEach(k => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return;
      db.dateColors[k] = json.dateColors[k];
    });
    saveData();
    renderCalendar();
    const label = json.month ? `${json.month} ` : "";
    toast(`${label}일정 ${eventCount}개를 불러왔어요`, "success");
  }

  function clearMonth() {
    const prefix = monthKeyPrefix(view.year, view.month);
    const ok = confirm(`${prefix} 데이터를 정말 삭제할까요? 되돌릴 수 없어요.`);
    if (!ok) return;
    Object.keys(db.events).filter(k => k.startsWith(prefix)).forEach(k => delete db.events[k]);
    Object.keys(db.dateColors).filter(k => k.startsWith(prefix)).forEach(k => delete db.dateColors[k]);
    saveData();
    renderCalendar();
    toast(`${prefix} 데이터를 삭제했어요`, "info");
  }

  /* ---------- day modal ---------- */
  function openDayModal(key, focusEventId) {
    selectedDate = key;
    const { y, m, d } = parseKey(key);
    const dow = new Date(y, m, d).getDay();
    el.modalWeekday.textContent = WEEKDAY_KO[dow].toUpperCase();
    el.modalDate.textContent = `${y}년 ${m + 1}월 ${d}일`;

    renderDateColorRow(key);
    renderEventList(key);
    closeEventFormModal();

    if (focusEventId) {
      const ev = (db.events[key] || []).find(x => x.id === focusEventId);
      if (ev) startEditEvent(key, ev);
    }

    el.modalBackdrop.classList.add("open");
  }
  function closeDayModal() {
    el.modalBackdrop.classList.remove("open");
    selectedDate = null;
    closeEventFormModal();
  }
  el.closeModal.addEventListener("click", closeDayModal);
  el.modalBackdrop.addEventListener("click", (e) => { if (e.target === el.modalBackdrop) closeDayModal(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (el.eventFormBackdrop.classList.contains("open")) { closeEventFormModal(); return; }
      if (el.modalBackdrop.classList.contains("open")) closeDayModal();
      if (el.jumpBackdrop.classList.contains("open")) el.jumpBackdrop.classList.remove("open");
      if (el.colorBackdrop.classList.contains("open")) { resetColorPaintTool(); el.colorBackdrop.classList.remove("open"); }
    }
  });

  /* ---------- add / edit event popup ---------- */
  function openEventFormModal() {
    el.eventFormBackdrop.classList.add("open");
    el.eventTitle.focus();
  }
  function closeEventFormModal() {
    el.eventFormBackdrop.classList.remove("open");
    resetForm();
  }
  el.addEventToggleBtn.addEventListener("click", () => {
    resetForm();
    openEventFormModal();
  });
  el.closeEventForm.addEventListener("click", closeEventFormModal);
  el.cancelEditBtn.addEventListener("click", closeEventFormModal);
  el.eventFormBackdrop.addEventListener("click", (e) => {
    if (e.target === el.eventFormBackdrop) closeEventFormModal();
  });

  function renderDateColorRow(key) {
    el.dateColorRow.innerHTML = "";
    const current = db.dateColors[key];

    const noneSw = document.createElement("div");
    noneSw.className = "swatch none" + (!current ? " selected" : "");
    noneSw.textContent = "–";
    noneSw.title = "색상 없음";
    noneSw.addEventListener("click", () => {
      delete db.dateColors[key];
      saveData(); renderDateColorRow(key); renderCalendar();
    });
    el.dateColorRow.appendChild(noneSw);

    PALETTE.forEach(c => {
      const sw = document.createElement("div");
      sw.className = "swatch" + (current === c.hex ? " selected" : "");
      sw.style.background = c.hex;
      sw.title = c.name;
      sw.addEventListener("click", () => {
        db.dateColors[key] = c.hex;
        saveData(); renderDateColorRow(key); renderCalendar();
      });
      el.dateColorRow.appendChild(sw);
    });
  }

  function renderEventList(key) {
    const events = (db.events[key] || []).slice().sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
    el.eventList.innerHTML = "";
    if (events.length === 0) {
      el.eventList.innerHTML = `<div class="empty-hint">이 날의 일정이 없어요. 아래에서 추가해보세요 ✨</div>`;
      return;
    }
    events.forEach(ev => {
      const item = document.createElement("div");
      item.className = "event-item";
      item.innerHTML = `
        <div class="bar" style="background:${ev.color}"></div>
        <div class="info">
          <div class="title-row" title="클릭해서 전체 내용 보기">
            <span class="title">${escapeHtml(ev.title)}</span>
            ${ev.time ? `<span class="time">${ev.time}</span>` : ""}
          </div>
          ${ev.memo ? `<div class="memo">${escapeHtml(ev.memo)}</div>` : ""}
        </div>
        <div class="actions">
          <button class="edit" title="수정" aria-label="수정">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none"><path d="M12 20h9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
          </button>
          <button class="del" title="삭제" aria-label="삭제">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>`;
      item.querySelector(".title-row").addEventListener("click", () => startEditEvent(key, ev));
      item.querySelector(".edit").addEventListener("click", () => startEditEvent(key, ev));
      item.querySelector(".del").addEventListener("click", (e) => { e.stopPropagation(); deleteEvent(key, ev.id); });
      el.eventList.appendChild(item);
    });
  }

  /* ---------- custom time picker ---------- */
  const AMPM_LABELS = ["오전", "오후"];
  const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12
  const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => i);   // 0..59

  let timeState = { ampm: null, hour: null, minute: null };

  function to12FromHHMM(hhmm) {
    if (!hhmm) return { ampm: null, hour: null, minute: null };
    const [h, m] = hhmm.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return { ampm: null, hour: null, minute: null };
    const ampm = h < 12 ? "오전" : "오후";
    let hour = h % 12;
    if (hour === 0) hour = 12;
    return { ampm, hour, minute: m };
  }
  function to24FromState(st) {
    if (st.ampm === null || st.hour === null || st.minute === null) return "";
    let h = st.hour % 12;
    if (st.ampm === "오후") h += 12;
    return `${pad2(h)}:${pad2(st.minute)}`;
  }

  function buildTimeColumn(container, items, formatFn, kind) {
    container.innerHTML = "";
    items.forEach(val => {
      const item = document.createElement("div");
      item.className = "time-col-item";
      item.textContent = formatFn(val);
      item.dataset.val = val;
      item.addEventListener("click", () => {
        timeState[kind] = val;
        if (timeState.ampm === null) timeState.ampm = "오전";
        if (timeState.hour === null) timeState.hour = 12;
        if (timeState.minute === null) timeState.minute = 0;
        syncTimeColumnSelection();
        commitTimeState();
      });
      container.appendChild(item);
    });
  }
  buildTimeColumn(el.ampmCol, AMPM_LABELS, v => v, "ampm");
  buildTimeColumn(el.hourCol, HOUR_OPTIONS, v => String(v), "hour");
  buildTimeColumn(el.minuteCol, MINUTE_OPTIONS, v => pad2(v), "minute");

  function syncTimeColumnSelection() {
    [[el.ampmCol, timeState.ampm], [el.hourCol, timeState.hour], [el.minuteCol, timeState.minute]]
      .forEach(([col, val]) => {
        [...col.children].forEach(c => {
          const match = kindMatches(col, c.dataset.val, val);
          c.classList.toggle("selected", match);
        });
      });
  }
  function kindMatches(col, rawVal, selectedVal) {
    if (selectedVal === null) return false;
    if (col === el.ampmCol) return rawVal === selectedVal;
    return Number(rawVal) === Number(selectedVal);
  }

  function commitTimeState() {
    const value = to24FromState(timeState);
    el.eventTime.value = value;
    if (value) {
      const h12 = timeState.hour, m = pad2(timeState.minute);
      el.timePickerLabel.textContent = `${timeState.ampm} ${h12}:${m}`;
      el.timePickerBtn.classList.add("has-value");
    } else {
      el.timePickerLabel.textContent = "시간 선택";
      el.timePickerBtn.classList.remove("has-value");
    }
  }

  function setTimePickerValue(hhmm) {
    timeState = to12FromHHMM(hhmm);
    syncTimeColumnSelection();
    commitTimeState();
  }

  function scrollTimeColumnsIntoView() {
    [[el.ampmCol, timeState.ampm], [el.hourCol, timeState.hour], [el.minuteCol, timeState.minute]].forEach(([col, val]) => {
      const target = val !== null
        ? [...col.children].find(c => kindMatches(col, c.dataset.val, val))
        : col.children[0];
      if (target && typeof target.scrollIntoView === "function") {
        target.scrollIntoView({ block: "center" });
      }
    });
  }

  el.timePickerBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const willOpen = !el.timePicker.classList.contains("open");
    el.timePicker.classList.toggle("open", willOpen);
    if (willOpen) {
      scrollTimeColumnsIntoView();
      requestAnimationFrame(() => {
        if (typeof el.timePickerPanel.scrollIntoView === "function") {
          el.timePickerPanel.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
      });
    }
  });
  document.addEventListener("click", () => el.timePicker.classList.remove("open"));
  el.timePickerPanel.addEventListener("click", (e) => e.stopPropagation());
  el.timeConfirmBtn.addEventListener("click", () => el.timePicker.classList.remove("open"));
  el.timeClearBtn.addEventListener("click", () => {
    setTimePickerValue("");
    el.timePicker.classList.remove("open");
  });

  function startEditEvent(key, ev) {
    editingId = ev.id;
    el.editingEventId.value = ev.id;
    el.eventTitle.value = ev.title;
    setTimePickerValue(ev.time || "");
    el.eventMemo.value = ev.memo || "";
    el.eventFormTitle.textContent = "일정 수정";
    el.submitEventBtn.textContent = "수정 완료";
    openEventFormModal();
  }

  function resetForm() {
    editingId = null;
    el.editingEventId.value = "";
    el.addEventForm.reset();
    setTimePickerValue("");
    el.eventFormTitle.textContent = "새 일정 추가";
    el.submitEventBtn.textContent = "일정 추가";
  }

  function deleteEvent(key, id) {
    db.events[key] = (db.events[key] || []).filter(e => e.id !== id);
    if (db.events[key].length === 0) delete db.events[key];
    saveData();
    renderEventList(key);
    renderCalendar();
    if (editingId === id) closeEventFormModal();
    toast("일정을 삭제했어요", "info");
  }

  el.addEventForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const title = el.eventTitle.value.trim();
    if (!title || !selectedDate) return;
    const time = el.eventTime.value;
    const memo = el.eventMemo.value.trim();
    const color = db.dateColors[selectedDate] || DEFAULT_EVENT_COLOR;

    if (!db.events[selectedDate]) db.events[selectedDate] = [];

    if (editingId) {
      const idx = db.events[selectedDate].findIndex(x => x.id === editingId);
      if (idx > -1) {
        db.events[selectedDate][idx] = { ...db.events[selectedDate][idx], title, time, memo, color };
      }
      toast("일정을 수정했어요", "success");
    } else {
      db.events[selectedDate].push({
        id: "e_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        title, time, memo, color,
      });
      toast("일정을 추가했어요", "success");
    }
    saveData();
    renderEventList(selectedDate);
    renderCalendar();
    closeEventFormModal();
  });

  /* ---------- init ---------- */
  applyTheme();
  renderCalendar();
})();
