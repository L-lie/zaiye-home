const stops = [...document.querySelectorAll(".studio-stop[data-scene]")];
const sceneImage = document.querySelector(".scene-image");
const zoneLinks = [...document.querySelectorAll(".zone-nav a")];
const themeButton = document.querySelector("[data-theme-toggle]");
let activeIndex = 0;

function updateThemeButton() {
  const dark = document.documentElement.dataset.theme === "dark";
  themeButton.textContent = dark ? "☀" : "☾";
  themeButton.setAttribute("aria-label", dark ? "切换到日间模式" : "切换到夜间模式");
  themeButton.title = dark ? "日间模式" : "夜间模式";
}

themeButton.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = nextTheme;
  localStorage.setItem("zaiye-site-theme", nextTheme);
  updateThemeButton();
});

updateThemeButton();

function finishLoading() {
  document.body.classList.remove("is-loading");
}

if (sceneImage.complete && sceneImage.naturalWidth) {
  finishLoading();
} else {
  sceneImage.addEventListener("load", finishLoading, { once: true });
  sceneImage.addEventListener("error", () => {
    sceneImage.src = "assets/hero-production-design.png";
  }, { once: true });
}

function showStop(index) {
  activeIndex = Math.max(0, Math.min(stops.length - 1, index));
  const activeStop = stops[activeIndex];
  document.body.dataset.scene = activeStop.dataset.scene;
  stops.forEach((stop, stopIndex) => {
    stop.classList.toggle("is-active", stopIndex === activeIndex);
  });
  zoneLinks.forEach((link) => {
    const isCurrent = link.hash === `#${activeStop.id}`;
    if (isCurrent) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
}

function travelTo(index) {
  const target = stops[Math.max(0, Math.min(stops.length - 1, index))];
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

const observer = new IntersectionObserver((entries) => {
  const visible = entries
    .filter((entry) => entry.isIntersecting)
    .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
  if (!visible) return;
  showStop(stops.indexOf(visible.target));
}, { threshold: [0.45, 0.65, 0.85] });

stops.forEach((stop) => observer.observe(stop));

document.addEventListener("keydown", (event) => {
  if (event.target.closest("a, button")) return;
  if (["ArrowDown", "PageDown"].includes(event.key)) {
    event.preventDefault();
    travelTo(activeIndex + 1);
  }
  if (["ArrowUp", "PageUp"].includes(event.key)) {
    event.preventDefault();
    travelTo(activeIndex - 1);
  }
});

showStop(0);
