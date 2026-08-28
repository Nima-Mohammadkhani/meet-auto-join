(function () {
  const LANG_KEY = "meetjoin-lang";
  const stored = localStorage.getItem(LANG_KEY);
  const chromeLang = (chrome.i18n.getUILanguage() || "fa").startsWith("fa") ? "fa" : "en";
  const lang = stored === "fa" || stored === "en" ? stored : chromeLang;

  // Synchronous fallback so options.js / popup.js can call window.__t immediately
  window.__t = (key) => chrome.i18n.getMessage(key) || key;

  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "fa" ? "rtl" : "ltr";

  fetch(chrome.runtime.getURL("_locales/" + lang + "/messages.json"))
    .then((r) => r.json())
    .then((msgs) => {
      window.__t = (key) => msgs[key]?.message || key;

      document.querySelectorAll("[data-i18n]").forEach((el) => {
        const msg = window.__t(el.getAttribute("data-i18n"));
        if (msg) el.textContent = msg;
      });
      document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
        const msg = window.__t(el.getAttribute("data-i18n-placeholder"));
        if (msg) el.placeholder = msg;
      });
      const titleEl = document.querySelector("title[data-i18n]");
      if (titleEl) {
        const msg = window.__t(titleEl.getAttribute("data-i18n"));
        if (msg) document.title = msg;
      }

      const langBtn = document.getElementById("langToggle");
      if (langBtn) {
        langBtn.textContent = lang === "fa" ? "EN" : "FA";
        langBtn.addEventListener("click", () => {
          localStorage.setItem(LANG_KEY, lang === "fa" ? "en" : "fa");
          location.reload();
        });
      }
    });
})();
