(function () {
  const isFa = chrome.i18n.getUILanguage().startsWith("fa");
  document.documentElement.lang = isFa ? "fa" : "en";
  document.documentElement.dir = isFa ? "rtl" : "ltr";

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const msg = chrome.i18n.getMessage(el.getAttribute("data-i18n"));
    if (msg) el.textContent = msg;
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const msg = chrome.i18n.getMessage(el.getAttribute("data-i18n-placeholder"));
    if (msg) el.placeholder = msg;
  });

  const titleKey = document.querySelector("title[data-i18n]");
  if (titleKey) {
    const msg = chrome.i18n.getMessage(titleKey.getAttribute("data-i18n"));
    if (msg) document.title = msg;
  }
})();
