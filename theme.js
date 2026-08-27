(function () {
  const KEY = "meetjoin-theme";

  function effectiveIsDark(theme) {
    if (theme === "dark") return true;
    if (theme === "light") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function apply(theme) {
    if (theme === "light" || theme === "dark") {
      document.documentElement.setAttribute("data-theme", theme);
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }

  // Runs in <head> — applies saved theme before body renders (no flash)
  apply(localStorage.getItem(KEY) || "auto");

  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("themeToggle");
    if (!btn) return;

    function sync() {
      const cur = localStorage.getItem(KEY) || "auto";
      btn.textContent = effectiveIsDark(cur) ? "☀️" : "🌙";
    }
    sync();

    btn.addEventListener("click", () => {
      const cur = localStorage.getItem(KEY) || "auto";
      const next = effectiveIsDark(cur) ? "light" : "dark";
      localStorage.setItem(KEY, next);
      apply(next);
      sync();
    });
  });
})();
