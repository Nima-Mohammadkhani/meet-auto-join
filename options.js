const DAY_NAMES = {
  0: "یکشنبه",
  1: "دوشنبه",
  2: "سه‌شنبه",
  3: "چهارشنبه",
  4: "پنجشنبه",
  5: "جمعه",
  6: "شنبه",
};

const DEFAULT_TELEGRAM_MESSAGE = "⚠️ به جلسه دیلی نرسیدم، ورود خودکار به گوگل میت انجام نشد.";

const DEFAULTS = {
  meetLink: "",
  displayName: "",
  muteBeforeJoin: false,
  schedule: [], // [{id, day, time, meetLink?}]
  telegramBotToken: "",
  telegramChatId: "",
  telegramMessage: DEFAULT_TELEGRAM_MESSAGE,
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
    const tdDay = document.createElement("td");
    tdDay.textContent = DAY_NAMES[entry.day];
    const tdTime = document.createElement("td");
    tdTime.textContent = entry.time;
    const tdLink = document.createElement("td");
    if (entry.meetLink) {
      tdLink.textContent = entry.meetLink.replace(/^https?:\/\/meet\.google\.com\//, "");
      tdLink.style.color = "var(--accent)";
      tdLink.style.fontSize = "11px";
      tdLink.title = entry.meetLink;
    } else {
      tdLink.textContent = "پیش‌فرض";
      tdLink.style.color = "var(--muted)";
      tdLink.style.fontSize = "12px";
    }
    const tdRemove = document.createElement("td");
    const btn = document.createElement("button");
    btn.textContent = "حذف";
    btn.className = "danger";
    btn.addEventListener("click", () => {
      state.schedule = state.schedule.filter((e) => e.id !== entry.id);
      renderScheduleTable();
    });
    tdRemove.appendChild(btn);
    tr.append(tdDay, tdTime, tdLink, tdRemove);
    body.appendChild(tr);
  }
  if (sorted.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 3;
    td.style.color = "#9aa0ac";
    td.textContent = "هنوز زمانی اضافه نشده است.";
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
    $("telegramMessage").value = state.telegramMessage || DEFAULT_TELEGRAM_MESSAGE;
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
  state.telegramMessage = $("telegramMessage").value.trim() || DEFAULT_TELEGRAM_MESSAGE;
  state.lateThresholdMinutes = Math.max(1, Number($("lateThreshold").value) || 5);
  state.notifyOnLate = $("notifyOnLate").checked;
  state.notifyOnFail = $("notifyOnFail").checked;
  state.notifyBefore = $("notifyBefore").checked;
  state.notifyBeforeMinutes = Math.max(1, Number($("notifyBeforeMinutes").value) || 5);
  chrome.storage.sync.set(state, () => {
    chrome.runtime.sendMessage({ type: "reschedule" }, () => {
      showStatus("ذخیره شد و زمان‌بندی به‌روزرسانی شد.");
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
  if (!time) {
    showStatus("لطفاً ساعت را انتخاب کنید.");
    return;
  }
  if (selectedDays.size === 0) {
    showStatus("لطفاً حداقل یک روز را انتخاب کنید.");
    return;
  }
  const link = $("entryLink").value.trim();
  for (const day of selectedDays) {
    state.schedule.push({ id: uid(), day, time, ...(link ? { meetLink: link } : {}) });
  }
  selectedDays.clear();
  document.querySelectorAll(".day-btn.active").forEach((b) => b.classList.remove("active"));
  $("entryLink").value = "";
  renderScheduleTable();
});

$("saveBtn").addEventListener("click", save);

$("testBtn").addEventListener("click", () => {
  save();
  chrome.runtime.sendMessage({ type: "test-join" }, () => {
    showStatus("در حال باز کردن جلسه برای تست...");
  });
});

$("testTelegramBtn").addEventListener("click", () => {
  save();
  chrome.runtime.sendMessage({ type: "test-telegram" }, (result) => {
    if (result && result.ok) {
      showStatus("پیام تست به تلگرام ارسال شد.");
    } else {
      showStatus("ارسال ناموفق بود: " + (result && result.error ? result.error : "تنظیمات را بررسی کنید."));
    }
  });
});

load();
