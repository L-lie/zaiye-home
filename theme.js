(() => {
  const storageKey = "zaiye-site-theme";
  const savedTheme = localStorage.getItem(storageKey);
  const initialTheme = savedTheme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = initialTheme;

  function updateButton(button, theme) {
    const dark = theme === "dark";
    button.textContent = dark ? "☀" : "☾";
    button.setAttribute("aria-label", dark ? "切换到日间模式" : "切换到夜间模式");
    button.title = dark ? "日间模式" : "夜间模式";
  }

  window.addEventListener("DOMContentLoaded", () => {
    const button = document.createElement("button");
    button.className = "theme-toggle";
    button.type = "button";
    updateButton(button, document.documentElement.dataset.theme);
    button.addEventListener("click", () => {
      const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = nextTheme;
      localStorage.setItem(storageKey, nextTheme);
      updateButton(button, nextTheme);
    });
    document.body.append(button);
  });
})();
