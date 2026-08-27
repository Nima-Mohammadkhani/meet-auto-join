const DAY_NAMES = {
  0: "یکشنبه",
  1: "دوشنبه",
  2: "سه‌شنبه",
  3: "چهارشنبه",
  4: "پنجشنبه",
  5: "جمعه",
  6: "شنبه",
};

chrome.alarms.getAll((alarms) => {
  chrome.storage.sync.get({ schedule: [] }, ({ schedule }) => {
    const listEl = document.getElementById("list");
    const meetAlarms = alarms
      .filter((a) => a.name.startsWith("meet-join-"))
      .sort((a, b) => a.scheduledTime - b.scheduledTime);

    if (meetAlarms.length === 0) {
      listEl.innerHTML = '<div class="empty">هنوز زمانی تنظیم نشده است.</div>';
      return;
    }

    const ul = document.createElement("ul");
    for (const a of meetAlarms.slice(0, 6)) {
      const d = new Date(a.scheduledTime);
      const id = a.name.slice("meet-join-".length);
      const entry = schedule.find((e) => e.id === id);
      const label = entry && entry.label ? entry.label : "";
      const timeStr = `${DAY_NAMES[d.getDay()]} ساعت ${d.getHours().toString().padStart(2, "0")}:${d
        .getMinutes()
        .toString()
        .padStart(2, "0")}`;
      const li = document.createElement("li");
      if (label) {
        li.innerHTML = `<span class="label">${label}</span><span class="time">${timeStr}</span>`;
      } else {
        li.textContent = timeStr;
      }
      ul.appendChild(li);
    }
    listEl.appendChild(ul);
  });
});

document.getElementById("openOptions").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});
