<div align="center">

# 📅 Meet Auto Join

**Automatically join your Google Meet meetings — on schedule, hands-free.**

[![Chrome Extension](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/)
[![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla%20JS-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![i18n](https://img.shields.io/badge/i18n-FA%20%7C%20EN-FF6B6B?style=for-the-badge&logo=googletranslate&logoColor=white)](#bilingual-support)
[![Telegram](https://img.shields.io/badge/Telegram-Bot%20API-26A5E4?style=for-the-badge&logo=telegram&logoColor=white)](https://core.telegram.org/bots/api)
[![License](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge)](LICENSE)

</div>

---

## ✨ Features

| Feature | Description |
|---|---|
| **⏰ Weekly Scheduling** | Set any combination of days + times; the extension auto-joins every week without lifting a finger |
| **🔗 Per-meeting Links** | Each schedule entry can have its own Meet URL, overriding the global default |
| **🏷️ Meeting Labels** | Name your meetings (e.g. "Daily Standup") — shown in the popup and notifications |
| **🔔 Pre-meeting Notifications** | Get a Chrome notification N minutes before join time, fully configurable |
| **✅ Join Now / 😴 Snooze** | Notification action buttons — click **Join Now** to open Meet immediately, or **Snooze** to be reminded again in 5 minutes |
| **🔁 Smart Retry** | If the join button isn't found on first attempt, the content script retries up to 2 times with a 25-second gap before giving up |
| **🟢 Enable / Disable Per Entry** | Toggle any individual schedule entry on or off without deleting it |
| **📲 Telegram Fallback Alerts** | Sends a Telegram message when Chrome was closed at meeting time, or when auto-join fails |
| **🌐 Bilingual (FA / EN)** | Full Persian and English support; UI direction (RTL / LTR) switches automatically based on browser language |
| **🌙 Dark / Light Mode** | System-preference-aware theming; no flash on load. Toggle manually with the ☀️ / 🌙 button |
| **🔤 Vazir Font** | Beautiful Persian-optimised Vazir typeface, bundled locally — no network request needed |

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Chrome Extension — Manifest V3 |
| Background | Service Worker (`background.js`) — Chrome Alarms API |
| Content Script | `join-script.js` — DOM polling for the Meet join button |
| Storage | `chrome.storage.sync` (settings) · `localStorage` (theme, no flash) |
| Scheduling | `chrome.alarms` — weekly re-scheduling, notify alarms, snooze alarms |
| Notifications | `chrome.notifications` with action buttons |
| i18n | Chrome built-in `chrome.i18n` — `_locales/fa` & `_locales/en` |
| Styling | Vanilla CSS with CSS custom properties (full dark/light variable system) |
| Fonts | Vazir Medium — self-hosted via `@font-face` |
| Telegram | Telegram Bot API (`sendMessage`) |

---

## 📁 Project Structure

```
meet-auto-join/
├── manifest.json           # Extension config — MV3, permissions, i18n
├── background.js           # Service worker: alarms, scheduling, notifications, retry, Telegram
├── join-script.js          # Content script: DOM automation inside the Meet tab
├── options.html            # Settings page — full schedule & Telegram config UI
├── options.js              # Settings logic — CRUD for schedule entries
├── popup.html              # Toolbar popup — upcoming meetings at a glance
├── popup.js                # Popup: reads alarms + labels from storage
├── i18n.js                 # i18n utility: applies data-i18n text & RTL/LTR direction
├── theme.js                # Theme manager: dark/light/auto, prevents flash, toggle button
├── _locales/
│   ├── fa/
│   │   └── messages.json   # Persian translations (65+ keys)
│   └── en/
│       └── messages.json   # English translations
└── font/
    └── Vazir-Medium.woff   # Bundled Vazir font (no CDN)
```

---

## 🚀 Installation

No build step required — this extension runs directly from source.

1. **Clone or download** this repository:
   ```bash
   git clone https://github.com/Nima-Mohammadkhani/meet-auto-join.git
   ```

2. Open Chrome and navigate to `chrome://extensions`

3. Enable **Developer mode** (toggle in the top-right corner)

4. Click **Load unpacked** and select the project folder

5. The extension icon appears in your toolbar — click it and then **Settings** to configure

> **Tip:** Pin the extension from the puzzle-piece menu so the popup is always one click away.

---

## ⚙️ Configuration

### Global Settings

| Field | Description |
|---|---|
| **Meet Link** | Your default Google Meet URL — used for entries that don't have their own link |
| **Display Name** | Typed into the "Your name" field if Google shows it (usually only for non-signed-in sessions) |
| **Mute before joining** | Attempts to turn off mic & camera before clicking the join button |

### Schedule Entries

1. Select one or more **days of the week** (multi-select supported)
2. Pick a **time**
3. Optionally add a **label** (e.g. `Weekly Sync`) and an **entry-specific Meet link**
4. Click **Add** — the entry appears in the table below
5. Use the **Enabled / Disabled** toggle on any row to pause it without deleting

### Pre-meeting Notifications

Enable the checkbox and set how many minutes before the meeting you want to be notified. The notification includes **Join Now** and **Snooze (5 min)** action buttons.

### Telegram Alerts

| Field | Description |
|---|---|
| **Bot Token** | From `@BotFather` → `/newbot` |
| **Chat ID** | Your personal chat ID (find via `@userinfobot` or the `getUpdates` API) |
| **Message text** | Custom alert message; leave blank for the default |
| **Late threshold** | Minutes past meeting time before a "Chrome was closed" alert fires |
| **Notify on late** | Alert when Chrome was not open at meeting time |
| **Notify on fail** | Alert when the join button could not be found after all retries |

Use **Send test message** to verify your token and chat ID before saving.

---

## 🔬 How It Works

```
chrome.alarms.onAlarm
       │
       ├── NOTIFY_PREFIX  →  showPreMeetingNotification()
       │                           └── chrome.notifications (Join / Snooze buttons)
       │
       ├── SNOOZE_PREFIX  →  re-show notification after 5 min
       │
       └── ALARM_PREFIX   →  openAndJoinMeeting()
                                  ├── chrome.tabs.create({ url })
                                  ├── wait for tab "complete"
                                  ├── executeScript(join-script.js)  ← polls for join button
                                  │       └── reports { type: "join-result", joined }
                                  │
                                  ├── joined = false → retry (max 2×, delay 25 s)
                                  └── still failed  → sendTelegram()
```

**Smart Retry:** `join-script.js` polls the DOM every 700 ms for up to 40 ticks (~28 s). If it cannot find the join button, it reports failure. `background.js` schedules up to 2 re-injections with a 25-second gap before sending a Telegram alert.

**Theme, no flash:** `theme.js` is loaded in `<head>` and reads `localStorage` synchronously — the correct theme is applied before the browser paints a single pixel.

**i18n without inline scripts:** MV3's CSP blocks inline scripts. All UI strings are applied via `data-i18n` attributes that `i18n.js` replaces at runtime, and `data-i18n-placeholder` for input placeholders.

---

## 📝 Important Notes

- **Chrome must be open** — this is a browser extension, not a background service. If Chrome or your machine is off at meeting time, nothing will fire.
- **Camera / microphone permissions** — approve the popup the first time you visit your Meet link manually; Chrome remembers it and the extension will not be blocked again.
- **Google Meet UI changes** — `join-script.js` matches button text (`Join now`, `Ask to join`, and their Persian equivalents). If Google updates its UI, update the `JOIN_RE` regex in `join-script.js`.
- **Sync across devices** — settings are stored with `chrome.storage.sync`, so if Chrome sync is enabled they follow you to other machines automatically.

---

## 📄 License

MIT © [Nima Mohammadkhani](https://github.com/Nima-Mohammadkhani)
