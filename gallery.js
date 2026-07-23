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

const CASES = [
  {
    title: "《美猴王·一念齐天》美术设计",
    href: "gallery.html?project=stage",
    image: "assets/portfolio/slide-04-01.jpeg",
    meta: "舞台剧 / 古装奇幻",
    copy: "悬浮城市、花果山、多屏场景、特效设计和舞台视觉方案。",
  },
  {
    title: "《爱情公寓》《倩女幽魂》等项目图",
    href: "gallery.html?project=feature",
    image: "assets/portfolio/slide-84-01.jpeg",
    meta: "电影 / 网大",
    copy: "气氛图、线稿场景、道具资产和空间设定资料。",
  },
  {
    title: "现代剧陈设与戏用平面",
    href: "gallery.html?project=series",
    image: "assets/portfolio/slide-80-01.jpeg",
    meta: "剧集 / 短剧",
    copy: "陈设图、应援物、药类平面和生活痕迹资料。",
  },
  {
    title: "综艺、舞台与实景空间",
    href: "gallery.html?project=variety",
    image: "assets/portfolio/slide-40-01.jpeg",
    meta: "综艺 / 晚会 / 实景",
    copy: "置景模型、现场空间、搭建过程和舞台视觉参考。",
  },
];

const params = new URLSearchParams(window.location.search);
const activeType = params.get("type");
const activeProject = params.get("project");

let allItems = [];
let filteredItems = [];

function cleanTitle(title = "") {
  return title.replace(/\s+/g, " ").replace(/《\s+/g, "《").replace(/\s+》/g, "》").trim();
}

function matchesRule(item, rules, key, fieldName) {
  if (!key || !rules[key]) return true;
  const field = item[fieldName];
  if (Array.isArray(field) && field.length > 0) return field.includes(key);
  return rules[key].includes(Number(item.slide));
}

function typeForItem(item) {
  return Object.keys(TYPE_RULES).find((type) => matchesRule(item, TYPE_RULES, type, "types")) || "atmosphere";
}

function projectForItem(item) {
  return Object.keys(PROJECT_RULES).find((project) => matchesRule(item, PROJECT_RULES, project, "projects")) || "feature";
}

function currentLabel() {
  if (activeType) return TYPE_LABELS[activeType] || "作品";
  if (activeProject) return PROJECT_LABELS[activeProject] || "作品";
  return "全部作品";
}

function setActiveLinks() {
  const key = activeType ? `type=${activeType}` : activeProject ? `project=${activeProject}` : "";
  document.querySelectorAll("[data-filter-link]").forEach((link) => {
    const href = link.getAttribute("href") || "";
    const active = key ? href.includes(key) : href === "gallery.html";
    link.classList.toggle("is-active", active);
  });
}

function createChip(label, href, active) {
  const chip = document.createElement("a");
  chip.className = "archive-chip";
  chip.href = href;
  chip.textContent = label;
  chip.classList.toggle("is-active", active);
  return chip;
}

function renderChips() {
  const row = document.querySelector("[data-chip-row]");
  const key = activeType ? `type=${activeType}` : activeProject ? `project=${activeProject}` : "";
  const chips = [createChip("全部", "gallery.html", !key)];
  Object.entries(PROJECT_LABELS).forEach(([id, label]) => {
    chips.push(createChip(label, `gallery.html?project=${id}`, key === `project=${id}`));
  });
  Object.entries(TYPE_LABELS).forEach(([id, label]) => {
    chips.push(createChip(label, `gallery.html?type=${id}`, key === `type=${id}`));
  });
  row.replaceChildren(...chips);
}

function renderFeature() {
  const feature = document.querySelector("[data-feature-card]");
  const caseData = CASES.find((item) => item.href.includes(activeProject || "")) || CASES[0];
  feature.innerHTML = `
    <a class="archive-feature-card" href="${caseData.href}">
      <img src="${caseData.image}" alt="${caseData.title}" />
      <span>${caseData.meta}</span>
      <strong>${caseData.title}</strong>
      <em>查看项目</em>
    </a>
  `;
}

function renderCases() {
  const grid = document.querySelector("[data-case-grid]");
  grid.replaceChildren(...CASES.map((item) => {
    const card = document.createElement("a");
    card.className = "archive-case-card";
    card.href = item.href;
    card.innerHTML = `
      <img src="${item.image}" alt="${item.title}" loading="lazy" />
      <span>${item.meta}</span>
      <strong>${item.title}</strong>
      <p>${item.copy}</p>
    `;
    return card;
  }));
}

function itemSearchText(item) {
  return [
    item.title,
    item.slide,
    TYPE_LABELS[typeForItem(item)],
    PROJECT_LABELS[projectForItem(item)],
  ].join(" ").toLowerCase();
}

function baseFilteredItems() {
  return allItems
    .filter((item) => Number(item.slide) > 1)
    .filter((item) => matchesRule(item, TYPE_RULES, activeType, "types"))
    .filter((item) => matchesRule(item, PROJECT_RULES, activeProject, "projects"));
}

function renderItems(items) {
  const grid = document.querySelector("[data-gallery-grid]");
  const empty = document.querySelector("[data-gallery-empty]");
  const count = document.querySelector("[data-gallery-count]");
  const title = document.querySelector("[data-gallery-title]");

  title.textContent = currentLabel();
  count.textContent = `共 ${items.length} 张`;
  empty.hidden = items.length > 0;

  grid.replaceChildren(...items.map((item) => {
    const type = typeForItem(item);
    const project = projectForItem(item);
    const card = document.createElement("a");
    card.className = "archive-work-card";
    card.href = item.file;
    card.target = "_blank";
    card.rel = "noreferrer";
    card.innerHTML = `
      <img src="${item.file}" alt="${cleanTitle(item.title)}" loading="lazy" />
      <span>${PROJECT_LABELS[project]} / ${TYPE_LABELS[type]}</span>
      <strong>${cleanTitle(item.title)}</strong>
    `;
    return card;
  }));
}

function applySearch() {
  const value = document.querySelector("[data-gallery-search]").value.trim().toLowerCase();
  const items = value
    ? filteredItems.filter((item) => itemSearchText(item).includes(value))
    : filteredItems;
  renderItems(items);
}

function bindMenu() {
  document.querySelectorAll(".archive-menu-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const expanded = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!expanded));
      button.nextElementSibling.hidden = expanded;
    });
  });
}

async function initGallery() {
  setActiveLinks();
  renderChips();
  renderFeature();
  renderCases();
  bindMenu();

  const response = await fetch("assets/portfolio/portfolio-index.json", { cache: "no-store" });
  allItems = await response.json();
  filteredItems = baseFilteredItems();
  renderItems(filteredItems);

  document.querySelector("[data-gallery-search]").addEventListener("input", applySearch);
}

initGallery().catch(() => {
  const empty = document.querySelector("[data-gallery-empty]");
  empty.hidden = false;
  empty.textContent = "作品索引暂时无法读取";
});
