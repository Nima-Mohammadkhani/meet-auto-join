const t = (key) => window.__t ? window.__t(key) : chrome.i18n.getMessage(key);

const DEFAULTS = {
  meetLink: "",
  displayName: "",
  muteBeforeJoin: false,
  schedule: [], // [{id, day, time, enabled, label?, meetLink?}]
  telegramBotToken: "",
  telegramChatId: "",
  telegramMessage: "",
  lateThresholdMinutes: 5,
  notifyOnLate: true,
  notifyOnFail: true,
  notifyBefore: false,
  notifyBeforeMinutes: 5,
};

let state = structuredClone(DEFAULTS);
let selectedDays = new Set();

const $ = (id) => document.getElementById(id);

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function renderScheduleTable() {
  const body = $("scheduleBody");
  body.innerHTML = "";
  const sorted = [...state.schedule].sort((a, b) => {
    if (a.day !== b.day) return a.day - b.day;
    return a.time.localeCompare(b.time);
  });
  for (const entry of sorted) {
    const tr = document.createElement("tr");
    if (entry.enabled === false) tr.classList.add("disabled-entry");

    const tdLabel = document.createElement("td");
    tdLabel.textContent = entry.label || "—";
    tdLabel.style.color = entry.label ? "var(--text)" : "var(--muted)";

    const tdDay = document.createElement("td");
    tdDay.textContent = t("day" + entry.day);

    const tdTime = document.createElement("td");
    tdTime.textContent = entry.time;

    const tdLink = document.createElement("td");
    if (entry.meetLink) {
      tdLink.textContent = entry.meetLink.replace(/^https?:\/\/meet\.google\.com\//, "");
      tdLink.style.color = "var(--accent)";
      tdLink.style.fontSize = "11px";
      tdLink.title = entry.meetLink;
    } else {
      tdLink.textContent = t("linkDefault");
      tdLink.style.color = "var(--muted)";
      tdLink.style.fontSize = "12px";
    }

    const tdToggle = document.createElement("td");
    const toggleBtn = document.createElement("button");
    const isEnabled = entry.enabled !== false;
    toggleBtn.textContent = isEnabled ? t("btnEnabled") : t("btnDisabled");
    toggleBtn.className = isEnabled ? "toggle-on" : "toggle-off";
    toggleBtn.addEventListener("click", () => {
      const e = state.schedule.find((s) => s.id === entry.id);
      if (e) e.enabled = e.enabled === false ? true : false;
      chrome.storage.sync.set(state, () => {
        chrome.runtime.sendMessage({ type: "reschedule" });
      });
      renderScheduleTable();
    });
    tdToggle.appendChild(toggleBtn);

    const tdRemove = document.createElement("td");
    const btn = document.createElement("button");
    btn.textContent = t("btnRemove");
    btn.className = "danger";
    btn.addEventListener("click", () => {
      state.schedule = state.schedule.filter((e) => e.id !== entry.id);
      renderScheduleTable();
    });
    tdRemove.appendChild(btn);

    tr.append(tdLabel, tdDay, tdTime, tdLink, tdToggle, tdRemove);
    body.appendChild(tr);
  }
  if (sorted.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.style.color = "#9aa0ac";
    td.textContent = t("emptySchedule");
    tr.appendChild(td);
    body.appendChild(tr);
  }
}

function showStatus(msg) {
  const el = $("status");
  el.textContent = msg;
  setTimeout(() => {
    if (el.textContent === msg) el.textContent = "";
  }, 3000);
}

function load() {
  chrome.storage.sync.get(DEFAULTS, (data) => {
    state = data;
    $("meetLink").value = state.meetLink || "";
    $("displayName").value = state.displayName || "";
    $("muteBeforeJoin").checked = !!state.muteBeforeJoin;
    $("telegramBotToken").value = state.telegramBotToken || "";
    $("telegramChatId").value = state.telegramChatId || "";
    $("telegramMessage").value = state.telegramMessage || t("defaultTelegramMessage");
    $("lateThreshold").value = state.lateThresholdMinutes ?? 5;
    $("notifyOnLate").checked = state.notifyOnLate !== false;
    $("notifyOnFail").checked = state.notifyOnFail !== false;
    $("notifyBefore").checked = !!state.notifyBefore;
    $("notifyBeforeMinutes").value = state.notifyBeforeMinutes ?? 5;
    renderScheduleTable();
  });
}

function save() {
  state.meetLink = $("meetLink").value.trim();
  state.displayName = $("displayName").value.trim();
  state.muteBeforeJoin = $("muteBeforeJoin").checked;
  state.telegramBotToken = $("telegramBotToken").value.trim();
  state.telegramChatId = $("telegramChatId").value.trim();
  state.telegramMessage = $("telegramMessage").value.trim() || t("defaultTelegramMessage");
  state.lateThresholdMinutes = Math.max(1, Number($("lateThreshold").value) || 5);
  state.notifyOnLate = $("notifyOnLate").checked;
  state.notifyOnFail = $("notifyOnFail").checked;
  state.notifyBefore = $("notifyBefore").checked;
  state.notifyBeforeMinutes = Math.max(1, Number($("notifyBeforeMinutes").value) || 5);
  chrome.storage.sync.set(state, () => {
    chrome.runtime.sendMessage({ type: "reschedule" }, () => {
      showStatus(t("statusSaved"));
    });
  });
}

document.querySelectorAll(".day-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const day = Number(btn.dataset.day);
    if (selectedDays.has(day)) {
      selectedDays.delete(day);
      btn.classList.remove("active");
    } else {
      selectedDays.add(day);
      btn.classList.add("active");
    }
  });
});

$("addScheduleBtn").addEventListener("click", () => {
  const time = $("timeInput").value;
  if (!time) { showStatus(t("errSelectTime")); return; }
  if (selectedDays.size === 0) { showStatus(t("errSelectDay")); return; }
  const link = $("entryLink").value.trim();
  const label = $("entryLabel").value.trim();
  for (const day of selectedDays) {
    state.schedule.push({
      id: uid(),
      day,
      time,
      enabled: true,
      ...(label ? { label } : {}),
      ...(link ? { meetLink: link } : {}),
    });
  }
  selectedDays.clear();
  document.querySelectorAll(".day-btn.active").forEach((b) => b.classList.remove("active"));
  $("entryLabel").value = "";
  $("entryLink").value = "";
  renderScheduleTable();
});

$("saveBtn").addEventListener("click", save);

$("testBtn").addEventListener("click", () => {
  save();
  chrome.runtime.sendMessage({ type: "test-join" }, () => {
    showStatus(t("statusTestJoin"));
  });
});

$("testTelegramBtn").addEventListener("click", () => {
  save();
  chrome.runtime.sendMessage({ type: "test-telegram" }, (result) => {
    if (result && result.ok) {
      showStatus(t("statusTelegramOk"));
    } else {
      showStatus(t("statusTelegramFail") + (result && result.error ? result.error : t("statusTelegramCheck")));
    }
  });
});

load();
