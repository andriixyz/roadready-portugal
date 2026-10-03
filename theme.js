// Run before the stylesheet so the first paint uses the saved appearance.
(() => {
  const storageKey = "roadready-theme";
  const preferences = ["system", "light", "dark"];
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
  const normalize = (value) => preferences.includes(value) ? value : "system";
  let preference = "system";
  try { preference = normalize(localStorage.getItem(storageKey)); } catch { /* Storage can be unavailable. */ }

  function applyTheme() {
    const theme = preference === "system" ? (systemTheme.matches ? "dark" : "light") : preference;
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#141c18" : "#245e46");
    document.querySelectorAll("[data-theme-preference]").forEach((button) => {
      const active = button.dataset.themePreference === preference;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  applyTheme();
  systemTheme.addEventListener("change", applyTheme);
  window.addEventListener("storage", (event) => {
    if (event.key === storageKey || event.key === null) {
      preference = normalize(event.newValue);
      applyTheme();
    }
  });
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-theme-preference]").forEach((button) => {
      button.addEventListener("click", () => {
        preference = normalize(button.dataset.themePreference);
        try { localStorage.setItem(storageKey, preference); } catch { /* Keep the choice for this page. */ }
        applyTheme();
      });
    });
    applyTheme();
  });
})();
