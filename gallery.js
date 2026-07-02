const TYPE_LABELS = {
  atmosphere: "气氛图",
  dressing: "陈设图",
  model: "置景模型",
  prop: "道具 / 资产",
  vfx: "特效设计",
  handmade: "手绘戏用",
  graphic: "戏用平面",
  character: "角色三视图",
  storyboard: "分镜",
  lineart: "线稿场景",
};

const PROJECT_LABELS = {
  feature: "电影 / 网大",
  series: "剧集 / 短剧",
  variety: "综艺 / 晚会",
  stage: "舞台剧",
  promo: "广告 / 宣传片",
  immersive: "实景 / 沉浸",
};

const TYPE_RULES = {
  atmosphere: [3, 14, 16, 17, 41, 43, 58, 59],
  dressing: [18, 19, 20],
  model: [21, 22, 24, 25, 26, 27, 28, 29, 40, 45, 46, 47, 48, 51, 54, 55],
  prop: [39, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 56, 57, 58, 59, 61, 62],
  vfx: [30, 31, 32, 33, 34, 35, 36, 37, 38],
  handmade: [60, 61, 62, 63, 64, 65],
  character: [66, 67, 68],
  storyboard: [69, 70, 71, 72, 73, 74, 75],
  graphic: [76, 77, 78, 79, 80, 81],
  lineart: [82, 83, 84, 85, 86, 87],
};

const PROJECT_RULES = {
  stage: [4, 5, 6, 7, 8, 9, 10, 31, 32, 33, 34, 35, 36, 37, 38, 41, 42, 58, 59, 67, 68, 71],
  feature: [11, 12, 13, 14, 16, 17, 21, 22, 24, 25, 29, 43, 44, 45, 46, 47, 48, 49, 50, 52, 56, 57, 61, 65, 72, 74, 83, 84, 85, 86, 87],
  series: [18, 19, 20, 51, 53, 54, 77, 78, 79, 80, 81],
  variety: [40],
  promo: [70, 75],
  immersive: [26, 27, 28],
};

const params = new URLSearchParams(window.location.search);
const activeType = params.get("type");
const activeProject = params.get("project");

function inRule(item, rules, key) {
  if (!key || !rules[key]) return true;
  return rules[key].includes(Number(item.slide));
}

function cleanTitle(title) {
  return title.replace(/\s+/g, " ").trim();
}

function setActiveLinks() {
  const key = activeType ? `type=${activeType}` : activeProject ? `project=${activeProject}` : "";
  document.querySelectorAll(".filter-chip").forEach((link) => {
    const href = link.getAttribute("href") || "";
    const active = key ? href.includes(key) : href === "gallery.html";
    link.classList.toggle("is-active", active);
  });
}

function setHeading(count) {
  const title = document.querySelector("[data-gallery-title]");
  const copy = document.querySelector("[data-gallery-copy]");
  const label = activeType ? TYPE_LABELS[activeType] : activeProject ? PROJECT_LABELS[activeProject] : "全部作品";
  title.textContent = label;
  copy.textContent = `${label}，共 ${count} 张。后续可以继续按项目整理成独立详情页。`;
}

function render(items) {
  const grid = document.querySelector("[data-gallery-grid]");
  const empty = document.querySelector("[data-gallery-empty]");
  grid.innerHTML = "";

  items.forEach((item) => {
    const card = document.createElement("a");
    card.className = "gallery-item";
    card.href = item.file;
    card.target = "_blank";
    card.rel = "noreferrer";
    card.innerHTML = `
      <img src="${item.file}" alt="${cleanTitle(item.title)}" loading="lazy" />
      <span>${cleanTitle(item.title)}</span>
    `;
    grid.append(card);
  });

  empty.hidden = items.length > 0;
  setHeading(items.length);
}

async function initGallery() {
  setActiveLinks();
  const response = await fetch("assets/portfolio/portfolio-index.json");
  const items = await response.json();
  const filtered = items.filter((item) => {
    return inRule(item, TYPE_RULES, activeType) && inRule(item, PROJECT_RULES, activeProject);
  });
  render(filtered);
}

initGallery().catch(() => {
  document.querySelector("[data-gallery-empty]").hidden = false;
});
