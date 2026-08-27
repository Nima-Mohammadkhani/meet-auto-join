const ALARM_PREFIX = "meet-join-";
const NOTIFY_PREFIX = "meet-notify-";
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 25000;
const retryCount = new Map();
const TELEGRAM_API = "https://api.telegram.org/bot";
const DEFAULT_TELEGRAM_MESSAGE =
  "⚠️ به جلسه دیلی نرسیدم، ورود خودکار به گوگل میت انجام نشد.";

const DAY_NAMES_BG = { 0: "یکشنبه", 1: "دوشنبه", 2: "سه‌شنبه", 3: "چهارشنبه", 4: "پنجشنبه", 5: "جمعه", 6: "شنبه" };

const DEFAULTS = {
  meetLink: "",
  displayName: "",
  muteBeforeJoin: false,
  schedule: [],
  telegramBotToken: "",
  telegramChatId: "",
  telegramMessage: DEFAULT_TELEGRAM_MESSAGE,
  lateThresholdMinutes: 5,
  notifyOnLate: true,
  notifyOnFail: true,
  notifyBefore: false,
  notifyBeforeMinutes: 5,
};

function nextOccurrence(day, hour, minute, from = new Date()) {
  const result = new Date(from);
  result.setSeconds(0, 0);
  result.setHours(hour, minute, 0, 0);
  let diffDays = (day - from.getDay() + 7) % 7;
  if (diffDays === 0 && result.getTime() <= from.getTime()) {
    diffDays = 7;
  }
  result.setDate(result.getDate() + diffDays);
  return result;
}

async function clearMeetAlarms() {
  const alarms = await chrome.alarms.getAll();
  await Promise.all(
    alarms
      .filter((a) => a.name.startsWith(ALARM_PREFIX) || a.name.startsWith(NOTIFY_PREFIX))
      .map((a) => chrome.alarms.clear(a.name))
  );
}

async function scheduleAll() {
  await clearMeetAlarms();
  const settings = await chrome.storage.sync.get(DEFAULTS);
  const now = new Date();
  for (const entry of settings.schedule) {
    if (entry.enabled === false) continue;
    const [hh, mm] = entry.time.split(":").map(Number);
    const when = nextOccurrence(entry.day, hh, mm, now);
    chrome.alarms.create(ALARM_PREFIX + entry.id, { when: when.getTime() });
    if (settings.notifyBefore) {
      const notifyWhen = when.getTime() - (settings.notifyBeforeMinutes || 5) * 60000;
      if (notifyWhen > Date.now()) {
        chrome.alarms.create(NOTIFY_PREFIX + entry.id, { when: notifyWhen });
      }
    }
  }
}

function showPreMeetingNotification(entry, minutesBefore) {
  const title = entry.label ? `⏰ ${entry.label}` : "⏰ جلسه در راه است";
  chrome.notifications.create(NOTIFY_PREFIX + entry.id, {
    type: "basic",
    iconUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    title,
    message: `روز ${DAY_NAMES_BG[entry.day] || ""} ساعت ${entry.time} — ${minutesBefore} دقیقه دیگر شروع می‌شود.`,
    buttons: [{ title: "ورود الان" }],
    requireInteraction: true,
  });
}

chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  if (!notificationId.startsWith(NOTIFY_PREFIX) || buttonIndex !== 0) return;
  const id = notificationId.slice(NOTIFY_PREFIX.length);
  const settings = await chrome.storage.sync.get(DEFAULTS);
  const entry = settings.schedule.find((e) => e.id === id);
  chrome.notifications.clear(notificationId);
  await openAndJoinMeeting(entry ? entry.meetLink : undefined);
});

async function sendTelegram(text) {
  const { telegramBotToken, telegramChatId } = await chrome.storage.sync.get(DEFAULTS);
  if (!telegramBotToken || !telegramChatId) {
    console.warn("Meet Auto Join: توکن یا chat id تلگرام تنظیم نشده است.");
    return { ok: false, error: "not-configured" };
  }
  try {
    const res = await fetch(`${TELEGRAM_API}${telegramBotToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: telegramChatId, text }),
    });
    const data = await res.json();
    if (!data.ok) {
      console.warn("Meet Auto Join: تلگرام خطا داد", data);
      return { ok: false, error: data.description };
    }
    return { ok: true };
  } catch (e) {
    console.warn("Meet Auto Join: ارسال پیام تلگرام ناموفق بود", e);
    return { ok: false, error: String(e) };
  }
}

async function openAndJoinMeeting(link) {
  const { meetLink: globalLink } = await chrome.storage.sync.get(DEFAULTS);
  const url = link || globalLink;
  if (!url) {
    console.warn("Meet Auto Join: لینک جلسه تنظیم نشده است.");
    return;
  }
  const tab = await chrome.tabs.create({ url, active: true });
  retryCount.set(tab.id, 0);

  const listener = (tabId, info) => {
    if (tabId === tab.id && info.status === "complete") {
      chrome.tabs.onUpdated.removeListener(listener);
      // Give the Meet SPA a moment to render its pre-join UI.
      setTimeout(() => {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["join-script.js"],
        });
      }, 1500);
    }
  };
  chrome.tabs.onUpdated.addListener(listener);
}

chrome.runtime.onInstalled.addListener(() => {
  scheduleAll();
});

chrome.runtime.onStartup.addListener(() => {
  scheduleAll();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name.startsWith(NOTIFY_PREFIX)) {
    const id = alarm.name.slice(NOTIFY_PREFIX.length);
    const settings = await chrome.storage.sync.get(DEFAULTS);
    const entry = settings.schedule.find((e) => e.id === id);
    if (entry) showPreMeetingNotification(entry, settings.notifyBeforeMinutes || 5);
    return;
  }

  if (!alarm.name.startsWith(ALARM_PREFIX)) return;
  const id = alarm.name.slice(ALARM_PREFIX.length);

  const settings = await chrome.storage.sync.get(DEFAULTS);
  const entry = settings.schedule.find((e) => e.id === id);

  // If the browser was closed/asleep at the scheduled time, this alarm only
  // fires once Chrome is back up, possibly long after the meeting started.
  // In that case notify immediately instead of (only) trying to join late.
  const lateMs = Date.now() - alarm.scheduledTime;
  if (settings.notifyOnLate && lateMs > settings.lateThresholdMinutes * 60000) {
    sendTelegram(settings.telegramMessage || DEFAULT_TELEGRAM_MESSAGE);
  }

  await openAndJoinMeeting(entry ? entry.meetLink : undefined);

  // Reschedule this entry for its next weekly occurrence.
  if (entry) {
    const [hh, mm] = entry.time.split(":").map(Number);
    const from = new Date();
    from.setMinutes(from.getMinutes() + 1); // ensure it lands next week, not today again
    const when = nextOccurrence(entry.day, hh, mm, from);
    chrome.alarms.create(alarm.name, { when: when.getTime() });
    if (settings.notifyBefore) {
      const notifyWhen = when.getTime() - (settings.notifyBeforeMinutes || 5) * 60000;
      if (notifyWhen > Date.now()) {
        chrome.alarms.create(NOTIFY_PREFIX + entry.id, { when: notifyWhen });
      }
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "reschedule") {
    scheduleAll().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message.type === "test-join") {
    openAndJoinMeeting().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message.type === "test-telegram") {
    sendTelegram("✅ این یک پیام تستی از اکستنشن ورود خودکار به گوگل میت است.").then((result) =>
      sendResponse(result)
    );
    return true;
  }
  if (message.type === "join-result") {
    const tabId = sender.tab ? sender.tab.id : null;
    chrome.storage.sync.get(DEFAULTS).then((settings) => {
      if (message.joined) {
        if (tabId !== null) retryCount.delete(tabId);
        return;
      }
      if (tabId !== null) {
        const count = retryCount.get(tabId) || 0;
        if (count < MAX_RETRIES) {
          retryCount.set(tabId, count + 1);
          setTimeout(() => {
            chrome.scripting.executeScript({ target: { tabId }, files: ["join-script.js"] })
              .catch(() => retryCount.delete(tabId));
          }, RETRY_DELAY_MS);
          return;
        }
        retryCount.delete(tabId);
      }
      if (settings.notifyOnFail) {
        sendTelegram(settings.telegramMessage || DEFAULT_TELEGRAM_MESSAGE);
      }
    });
    return false;
  }
});
