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
  stage: "舞台剧",
  feature: "电影 / 网大",
  series: "剧集 / 短剧",
  variety: "综艺 / 晚会",
  promo: "广告 / 宣传片",
  immersive: "实景 / 沉浸",
};

const TYPE_RULES = {
  atmosphere: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 42, 83, 84, 85, 86, 87],
  dressing: [18, 19, 20],
  model: [21, 22, 24, 25, 26, 27, 28, 29, 40, 45, 46, 47, 48, 51, 54, 55],
  prop: [41, 43, 44, 49, 50, 52, 53, 56, 57, 58, 59, 61, 62],
  vfx: [31, 32, 33, 34, 35, 36, 37, 38],
  handmade: [63, 64, 65],
  graphic: [77, 78, 79, 80, 81],
  character: [67, 68],
  storyboard: [70, 71, 72, 73, 74, 75],
  lineart: [72, 73, 74],
};

const PROJECTS = [
  {
    id: "ai-qing-gong-yu",
    project: "feature",
    title: "《爱情公寓》",
    image: "assets/portfolio/posters/ai-qing-gong-yu.jpg",
    poster: "assets/portfolio/posters/ai-qing-gong-yu.jpg",
    meta: "电影 / 网大",
    copy: "项目海报已归档，项目图后续补充。",
    slides: [],
  },
  {
    id: "monkey-king",
    project: "stage",
    title: "《美猴王·一念齐天》美术设计",
    image: "assets/portfolio/slide-04-01.jpeg",
    poster: "assets/portfolio/posters/monkey-king.jpg",
    meta: "舞台剧 / 古装奇幻",
    copy: "悬浮城市、花果山、多屏场景、特效设计和角色视觉方案。",
    slides: [4, 5, 6, 7, 8, 9, 10, 31, 32, 33, 34, 35, 36, 37, 38, 41, 42, 58, 59, 67, 68, 71],
  },
  {
    id: "di-xin-wei-ji",
    project: "feature",
    title: "《地心危机》",
    image: "assets/portfolio/slide-11-01.jpeg",
    poster: "assets/portfolio/posters/di-xin-wei-ji.jpg",
    meta: "电影 / 网大",
    copy: "科幻空间气氛图、道具资产、实验设备和戏用文字资料。",
    slides: [11, 16, 44, 45, 46, 48, 65],
  },
  {
    id: "qian-nv-you-hun",
    project: "feature",
    title: "《倩女幽魂》",
    image: "assets/portfolio/slide-13-01.jpeg",
    meta: "电影 / 网大",
    copy: "古装奇幻场景气氛图、树形资产、转生门和地台设计。",
    slides: [13, 14, 43, 49, 57, 84],
  },
  {
    id: "mi-hang-kun-lun-xu",
    project: "feature",
    title: "《迷航昆仑墟》",
    image: "assets/portfolio/slide-24-01.jpeg",
    poster: "assets/portfolio/posters/mi-hang-kun-lun-xu.jpg",
    meta: "电影 / 网大",
    copy: "船舱、实验室、改造人舱、顶灯和昆仑瓶道具资料。",
    slides: [24, 25, 29, 47, 50, 56],
  },
  {
    id: "bao-lian-deng",
    project: "feature",
    title: "《宝莲灯》",
    image: "assets/portfolio/slide-12-01.jpeg",
    meta: "电影 / 网大",
    copy: "天宫场景气氛图与空间视觉方案。",
    slides: [12, 83],
  },
  {
    id: "da-mao-xian-wang",
    project: "feature",
    title: "《大冒险王》",
    image: "assets/portfolio/slide-17-01.jpeg",
    poster: "assets/portfolio/posters/da-mao-xian-wang.jpg",
    meta: "电影 / 网大",
    copy: "基地空间、吧台、休闲区和仓库谈判场景。",
    slides: [17, 85, 86],
  },
  {
    id: "chao-shen-bao-biao",
    project: "feature",
    title: "《超神保镖》",
    image: "assets/portfolio/slide-21-01.jpeg",
    poster: "assets/portfolio/posters/chao-shen-bao-biao.jpg",
    meta: "电影 / 网大",
    copy: "警察局空间模型与渲染方案。",
    slides: [21],
  },
  {
    id: "qi-men-yi-shi",
    project: "feature",
    title: "《奇门异事》",
    image: "assets/portfolio/slide-22-01.jpeg",
    meta: "电影 / 网大",
    copy: "极乐城空间模型与渲染方案。",
    slides: [22],
  },
  {
    id: "ren-yu",
    project: "feature",
    title: "《人鱼》",
    image: "assets/portfolio/slide-52-01.png",
    poster: "assets/portfolio/posters/ren-yu.jpg",
    meta: "电影 / 网大",
    copy: "再田号船体与制作图资料。",
    slides: [52],
  },
  {
    id: "ying-zi-xing-dong",
    project: "feature",
    title: "《影子行动之血封喉》",
    image: "assets/portfolio/slide-55-05.png",
    poster: "assets/portfolio/posters/ying-zi-xing-dong.jpg",
    meta: "电影 / 网大",
    copy: "天机阁模型、渲染与后期资料。",
    slides: [55],
  },
  {
    id: "da-she-3",
    project: "feature",
    title: "《大蛇3》",
    image: "assets/portfolio/slide-61-04.jpeg",
    poster: "assets/portfolio/posters/da-she-3.png",
    meta: "电影 / 网大",
    copy: "动物札记与道具画资料。",
    slides: [61],
  },
  {
    id: "da-mo-shen-long",
    project: "feature",
    title: "《大漠神龙》",
    image: "assets/portfolio/slide-72-01.png",
    poster: "assets/portfolio/posters/da-mo-shen-long.webp",
    meta: "电影 / 网大",
    copy: "沙漠、磐石镇等分镜和线稿场景。",
    slides: [72, 74],
  },
  {
    id: "mo-wang-bie-hei-hua",
    project: "feature",
    title: "《魔王别黑化》",
    image: "assets/portfolio/slide-87-01.jpeg",
    poster: "assets/portfolio/posters/mo-wang-bie-hei-hua.jpg",
    meta: "电影 / 网大",
    copy: "医院病房场景气氛图。",
    slides: [87],
  },
  {
    id: "hei-shui-ling",
    project: "feature",
    title: "《黑水岭》",
    image: "assets/portfolio/posters/hei-shui-ling.jpg",
    poster: "assets/portfolio/posters/hei-shui-ling.jpg",
    meta: "电影 / 网大",
    copy: "项目海报已归档，项目图后续补充。",
    slides: [],
  },
  {
    id: "jiang-long-zhuo-yao",
    project: "feature",
    title: "《降龙大师之捉妖榜》",
    image: "assets/portfolio/posters/jiang-long-zhuo-yao.webp",
    poster: "assets/portfolio/posters/jiang-long-zhuo-yao.webp",
    meta: "电影 / 网大",
    copy: "项目海报已归档，项目图后续补充。",
    slides: [],
  },
  {
    id: "jiang-long-lie-long",
    project: "feature",
    title: "《降龙大师：猎龙队》",
    image: "assets/portfolio/posters/jiang-long-lie-long.jpg",
    poster: "assets/portfolio/posters/jiang-long-lie-long.jpg",
    meta: "电影 / 网大",
    copy: "项目海报已归档，项目图后续补充。",
    slides: [],
  },
  {
    id: "jiang-long-mo-long",
    project: "feature",
    title: "《降龙大师：魔龙咒》",
    image: "assets/portfolio/posters/jiang-long-mo-long.jpg",
    poster: "assets/portfolio/posters/jiang-long-mo-long.jpg",
    meta: "电影 / 网大",
    copy: "项目海报已归档，项目图后续补充。",
    slides: [],
  },
  {
    id: "yi-zhai-jia-zu",
    project: "series",
    title: "《一宅家族》",
    image: "assets/portfolio/slide-20-01.png",
    poster: "assets/portfolio/posters/yi-zhai-jia-zu.png",
    meta: "剧集 / 情景剧",
    copy: "客厅、卧室等空间模型、渲染图和实景陈设资料。",
    slides: [18, 19, 20],
  },
  {
    id: "su-ji-guan-cai-pu",
    project: "series",
    title: "《苏记棺材铺》",
    image: "assets/portfolio/slide-51-02.png",
    poster: "assets/portfolio/posters/su-ji-guan-cai-pu.jpg",
    meta: "剧集 / 古装",
    copy: "木船、玉璇玑、马车等模型和资产资料。",
    slides: [51, 53, 54],
  },
  {
    id: "feng-du-guai-tan",
    project: "series",
    title: "《阴阳镇怪谈》",
    image: "assets/portfolio/slide-77-01.png",
    poster: "assets/portfolio/posters/yin-yang-zhen-guai-tan.jpg",
    meta: "剧集 / 民国",
    copy: "政府文件、平面图等戏用平面资料。",
    slides: [77, 78],
  },
  {
    id: "xin-xin-yu",
    project: "series",
    title: "《倒数三秒爱上我》",
    image: "assets/portfolio/slide-80-01.jpeg",
    poster: "assets/portfolio/posters/dao-shu-san-miao.jpg",
    meta: "剧集 / 现代",
    copy: "应援物、海报易拉宝、药类平面和生活痕迹资料。",
    slides: [79, 80, 81],
  },
  {
    id: "miss",
    project: "series",
    showInProjectEntry: false,
    title: "《Miss》",
    image: "assets/portfolio/slide-73-01.png",
    meta: "短片 / 分镜",
    copy: "第一幕钥匙段落分镜资料。",
    slides: [73],
  },
  {
    id: "cheng-feng-po-lang",
    project: "variety",
    title: "《乘风破浪的姐姐第一季》",
    image: "assets/portfolio/slide-40-01.jpeg",
    poster: "assets/portfolio/posters/cheng-feng-po-lang.jpg",
    meta: "综艺 / 晚会",
    copy: "直播夜揭晓台模型、渲染和现场空间参考。",
    slides: [40],
  },
  {
    id: "qing-chun-zai-da-di",
    project: "variety",
    projects: ["stage", "variety"],
    title: "《青春在大地》",
    image: "assets/portfolio/posters/qing-chun-zai-da-di.png",
    poster: "assets/portfolio/posters/qing-chun-zai-da-di.png",
    meta: "舞台剧 / 综艺",
    copy: "项目海报已归档，项目图后续补充。",
    slides: [],
  },
  {
    id: "jin-ying-jie",
    project: "variety",
    title: "《第十三届中国金鹰电视艺术节》",
    image: "assets/portfolio/posters/jin-ying-jie.jpg",
    poster: "assets/portfolio/posters/jin-ying-jie.jpg",
    meta: "综艺 / 晚会",
    copy: "项目海报已归档，项目图后续补充。",
    slides: [],
  },
  {
    id: "jin-cheng-zha-lan",
    project: "promo",
    title: "《金城栅栏宣传片》",
    image: "assets/portfolio/slide-70-01.jpeg",
    poster: "assets/portfolio/posters/jin-cheng-zha-lan.jpg",
    meta: "广告 / 宣传片",
    copy: "广告分镜节选和镜头调度资料。",
    slides: [70],
  },
  {
    id: "hai-zhi-sheng",
    project: "promo",
    showInProjectEntry: false,
    title: "《海之声》",
    image: "assets/portfolio/slide-75-01.jpeg",
    meta: "广告 / 宣传片",
    copy: "三组镜头分镜与画面方案。",
    slides: [75],
  },
  {
    id: "ming-guo-immersive",
    project: "immersive",
    title: "民国剧本杀",
    image: "assets/portfolio/slide-27-02.png",
    poster: "assets/portfolio/posters/ming-guo-immersive.jpg",
    meta: "实景 / 沉浸",
    copy: "百乐门、证券交易所等沉浸式空间模型和实景资料。",
    slides: [26, 27, 28],
  },
];

const PROJECT_ENTRY_ORDER = [
  "ai-qing-gong-yu",
  "cheng-feng-po-lang",
  "jin-ying-jie",
  "yi-zhai-jia-zu",
  "monkey-king",
  "su-ji-guan-cai-pu",
];

const params = new URLSearchParams(window.location.search);
const activeType = params.get("type");
const activeProject = params.get("project");
const activeCaseId = params.get("case");
const activeCase = PROJECTS.find((item) => item.id === activeCaseId);
const showingProjectList = !activeType && !activeCase;

let allItems = [];
let filteredItems = [];
let renderedGroups = [];
let lightboxState = {
  scale: 1,
  x: 0,
  y: 0,
  dragging: false,
  pointerX: 0,
  pointerY: 0,
};

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
  return PROJECTS.find((project) => project.slides.includes(Number(item.slide)));
}

function projectHasType(project, type) {
  return project.project === type || project.projects?.includes(type);
}

function currentLabel() {
  if (activeType === "all") return "全部美术资料";
  if (activeType) return TYPE_LABELS[activeType] || "作品";
  if (activeCase) return activeCase.title;
  if (activeProject) return PROJECT_LABELS[activeProject] || "项目入口";
  return "项目入口";
}

function setActiveLinks() {
  const key = activeType ? `type=${activeType}` : activeProject ? `project=${activeProject}` : activeCase ? `case=${activeCase.id}` : "";
  document.querySelectorAll("[data-filter-link]").forEach((link) => {
    const href = link.getAttribute("href") || "";
    const active = key ? href.includes(key) : href === "gallery.html";
    link.classList.toggle("is-active", active);
  });
}

function renderFeature() {
  const feature = document.querySelector("[data-feature-card]");
  const project = activeCase || PROJECTS.find((item) => projectHasType(item, activeProject)) || PROJECTS[0];
  feature.innerHTML = `
    <a class="archive-feature-card" href="gallery.html?case=${project.id}#archive-browser">
      <img src="${project.image}" alt="${project.title}" />
      <span>${project.meta}</span>
      <strong>${project.title}</strong>
      <em>查看项目</em>
    </a>
  `;
}

function renderChips() {
  const wrap = document.querySelector("[data-archive-chips]");
  const chips = [
    { label: "全部", href: "gallery.html?type=all#archive-browser", active: activeType === "all" },
    { label: activeCase ? cleanTitle(activeCase.title) : "项目", href: activeCase ? window.location.href : "gallery.html#archive-selected", active: showingProjectList || Boolean(activeCase) },
    ...Object.entries(TYPE_LABELS).map(([key, label]) => ({
      label,
      href: `gallery.html?type=${key}#archive-browser`,
      active: activeType === key,
    })),
  ];

  wrap.replaceChildren(...chips.map((chip) => {
    const link = document.createElement("a");
    link.className = "archive-chip";
    link.href = chip.href;
    link.textContent = chip.label;
    link.classList.toggle("is-active", chip.active);
    return link;
  }));
}

function projectsForActiveType() {
  if (!activeType || activeType === "all" || !allItems.length) return [];
  const projects = new Map();
  allItems
    .filter((item) => Number(item.slide) > 1)
    .filter((item) => matchesRule(item, TYPE_RULES, activeType, "types"))
    .forEach((item) => {
      const project = projectForItem(item);
      if (project && !projects.has(project.id)) projects.set(project.id, project);
    });
  return Array.from(projects.values());
}

function renderSubChips() {
  const wrap = document.querySelector("[data-archive-subchips]");
  if (!wrap) return;
  const projects = projectsForActiveType();
  wrap.hidden = projects.length === 0;
  if (!projects.length) {
    wrap.replaceChildren();
    return;
  }

  const chips = [
    {
      label: "全部项目",
      href: `gallery.html?type=${activeType}#archive-browser`,
      active: !activeCase,
    },
    ...projects.map((project) => ({
      label: cleanTitle(project.title),
      href: `gallery.html?type=${activeType}&case=${project.id}#archive-browser`,
      active: activeCase?.id === project.id,
    })),
  ];

  wrap.replaceChildren(...chips.map((chip) => {
    const link = document.createElement("a");
    link.className = "archive-chip archive-subchip";
    link.href = chip.href;
    link.textContent = chip.label;
    link.classList.toggle("is-active", chip.active);
    return link;
  }));
}

function visibleProjects() {
  const order = new Map(PROJECT_ENTRY_ORDER.map((id, index) => [id, index]));
  const entries = PROJECTS
    .filter((item) => item.showInProjectEntry !== false)
    .sort((a, b) => {
      const aOrder = order.has(a.id) ? order.get(a.id) : Number.MAX_SAFE_INTEGER;
      const bOrder = order.has(b.id) ? order.get(b.id) : Number.MAX_SAFE_INTEGER;
      return aOrder - bOrder;
    });
  if (!activeProject) return entries;
  return entries.filter((item) => projectHasType(item, activeProject));
}

function syncProjectGridState(projects) {
  const grid = document.querySelector("[data-case-grid]");
  grid.classList.toggle("is-single", projects.length === 1);
}

function renderProjects() {
  const selected = document.querySelector("#archive-selected");
  const grid = document.querySelector("[data-case-grid]");
  const title = document.querySelector("[data-case-title]");
  const eyebrow = document.querySelector("[data-case-eyebrow]");
  const count = document.querySelector("[data-gallery-count]");
  const projects = visibleProjects();
  const browsingWorks = Boolean(activeCase || activeType);

  selected.hidden = browsingWorks;
  grid.hidden = browsingWorks;
  eyebrow.textContent = activeProject ? "Project Type" : "Selected Cases";
  title.textContent = activeProject ? currentLabel() : "项目入口";
  if (browsingWorks) return;

  count.textContent = `共 ${projects.length} 个项目`;
  syncProjectGridState(projects);
  grid.replaceChildren(...projects.map((item) => {
    const card = document.createElement("a");
    card.className = "archive-case-card";
    card.href = `gallery.html?case=${item.id}#archive-browser`;
    card.innerHTML = `
      <img src="${item.poster || item.image}" alt="${item.title}" loading="lazy" />
      <span>${item.meta}</span>
      <strong>${item.title}</strong>
      <p>${item.copy}</p>
    `;
    return card;
  }));
}

function itemSearchText(item) {
  const project = projectForItem(item);
  const projectTypes = project ? [project.project, ...(project.projects || [])] : [];
  return [
    item.title,
    item.slide,
    TYPE_LABELS[typeForItem(item)],
    project?.title,
    project?.meta,
    ...projectTypes.map((type) => PROJECT_LABELS[type] || ""),
  ].join(" ").toLowerCase();
}

function groupKeyForItem(item) {
  const project = projectForItem(item);
  return `${project?.id || "unknown"}::${cleanTitle(item.title).toLowerCase()}`;
}

const ITEM_ORDER = {
  "assets/portfolio/slide-18-02.jpeg": 0,
  "assets/portfolio/slide-18-03.jpeg": 1,
  "assets/portfolio/slide-18-04.jpeg": 2,
  "assets/portfolio/slide-18-01.jpeg": 3,
  "assets/portfolio/slide-19-03.jpeg": 0,
  "assets/portfolio/slide-19-04.jpeg": 1,
  "assets/portfolio/slide-19-01.jpeg": 2,
  "assets/portfolio/slide-19-02.jpeg": 3,
  "assets/portfolio/slide-20-01.png": 0,
  "assets/portfolio/slide-20-03.png": 1,
  "assets/portfolio/slide-20-04.png": 2,
  "assets/portfolio/slide-20-02.jpeg": 3,
};

function groupItems(items) {
  const groups = new Map();
  items.forEach((item) => {
    const key = groupKeyForItem(item);
    if (!groups.has(key)) {
      groups.set(key, {
        primary: item,
        items: [],
      });
    }
    groups.get(key).items.push(item);
  });
  return Array.from(groups.values()).map((group) => {
    group.items.sort((a, b) => {
      const aOrder = ITEM_ORDER[a.file] ?? Number.MAX_SAFE_INTEGER;
      const bOrder = ITEM_ORDER[b.file] ?? Number.MAX_SAFE_INTEGER;
      return aOrder - bOrder;
    });
    group.primary = group.items[0] || group.primary;
    return group;
  });
}

function baseFilteredItems() {
  return allItems
    .filter((item) => Number(item.slide) > 1)
    .filter((item) => matchesRule(item, TYPE_RULES, activeType, "types"))
    .filter((item) => {
      if (!activeCase) return true;
      return activeCase.slides.includes(Number(item.slide));
    });
}

function classifyPairImages(card) {
  const images = Array.from(card.querySelectorAll(".archive-work-track img"));
  if (images.length !== 2) return;

  const apply = () => {
    if (!images.every((image) => image.naturalWidth && image.naturalHeight)) return;
    const orientations = images.map((image) => (
      image.naturalWidth >= image.naturalHeight ? "landscape" : "portrait"
    ));
    card.classList.toggle("is-landscape-pair", orientations.every((item) => item === "landscape"));
    card.classList.toggle("is-portrait-pair", orientations.every((item) => item === "portrait"));
    card.classList.toggle("is-mixed-pair", new Set(orientations).size > 1);
  };

  images.forEach((image) => {
    if (!image.complete) image.addEventListener("load", apply, { once: true });
  });
  apply();
}

function renderItems(items) {
  const grid = document.querySelector("[data-gallery-grid]");
  const empty = document.querySelector("[data-gallery-empty]");
  const count = document.querySelector("[data-gallery-count]");
  const title = document.querySelector("[data-gallery-title]");
  const browser = document.querySelector("#archive-browser");

  title.textContent = currentLabel();
  renderedGroups = groupItems(items);
  count.textContent = showingProjectList ? count.textContent : `共 ${renderedGroups.length} 项`;
  empty.hidden = items.length > 0;
  browser.hidden = showingProjectList;
  browser.classList.toggle("is-filtered", !showingProjectList);
  grid.classList.toggle("is-list", !showingProjectList);

  grid.replaceChildren(...renderedGroups.map((group, index) => {
    const item = group.primary;
    const type = typeForItem(item);
    const project = projectForItem(item);
    const hasStack = group.items.length > 3;
    const card = document.createElement("article");
    card.className = "archive-work-card";
    if (group.items.length === 2) card.classList.add("is-pair");
    if (group.items.length === 3) card.classList.add("is-trio");
    if (hasStack) card.classList.add("is-stack");
    card.dataset.groupIndex = String(index);
    card.dataset.title = cleanTitle(item.title);
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `查看 ${cleanTitle(item.title)}`);
    card.innerHTML = `
      <div class="archive-work-carousel" data-inline-carousel data-index="0">
        <div class="archive-work-track" data-inline-track>
          ${group.items.map((entry) => `
            <img src="${entry.file}" alt="${cleanTitle(entry.title)}" loading="lazy" draggable="false" />
          `).join("")}
        </div>
        ${hasStack ? `
          <button class="archive-work-slide prev" type="button" data-inline-control data-inline-step="-1" aria-label="上一张">‹</button>
          <button class="archive-work-slide next" type="button" data-inline-control data-inline-step="1" aria-label="下一张">›</button>
        ` : ""}
      </div>
      <span>${project?.meta || "作品"} / ${TYPE_LABELS[type]}</span>
      <strong>${cleanTitle(item.title)}</strong>
      ${group.items.length > 1 ? `<em class="archive-work-count">${group.items.length} 张</em>` : ""}
    `;
    classifyPairImages(card);
    if (hasStack) setInlineSlide(card, 0);
    return card;
  }));
}

function setInlineSlide(card, nextIndex) {
  const group = renderedGroups[Number(card.dataset.groupIndex)];
  const carousel = card.querySelector("[data-inline-carousel]");
  const track = card.querySelector("[data-inline-track]");
  if (!group || !carousel || !track) return;
  const total = group.items.length;
  const index = (nextIndex + total) % total;
  carousel.dataset.index = String(index);
  carousel.style.setProperty("--slide-index", index);
  track.querySelectorAll("img").forEach((image, imageIndex) => {
    image.classList.toggle("is-current", imageIndex === index);
  });
  track.style.transform = "";
}

function updateLightboxImage(viewer) {
  const image = viewer.querySelector("[data-lightbox-image]");
  image.style.transform = `translate3d(${lightboxState.x}px, ${lightboxState.y}px, 0) scale(${lightboxState.scale})`;
}

function resetLightboxTransform(viewer) {
  lightboxState.scale = 1;
  lightboxState.x = 0;
  lightboxState.y = 0;
  updateLightboxImage(viewer);
}

function showLightboxImage(viewer, nextIndex) {
  const images = JSON.parse(viewer.dataset.images || "[]");
  if (!images.length) return;
  const index = (nextIndex + images.length) % images.length;
  viewer.dataset.index = String(index);
  const image = viewer.querySelector("[data-lightbox-image]");
  const count = viewer.querySelector("[data-lightbox-count]");
  image.src = images[index].file;
  image.alt = images[index].title || "";
  if (count) count.textContent = images.length > 1 ? `${index + 1} / ${images.length}` : "";
  resetLightboxTransform(viewer);
}

function closeLightbox() {
  document.querySelector("[data-lightbox]")?.remove();
  document.body.classList.remove("is-lightbox-open");
}

function openLightbox(group, startIndex = 0) {
  closeLightbox();
  lightboxState = { scale: 1, x: 0, y: 0, dragging: false, pointerX: 0, pointerY: 0 };
  const images = group.items.map((item) => ({
    file: item.file,
    title: cleanTitle(item.title),
  }));
  const title = cleanTitle(group.primary.title);
  const hasMultiple = images.length > 1;

  const viewer = document.createElement("div");
  viewer.className = "archive-lightbox";
  viewer.dataset.lightbox = "";
  viewer.dataset.images = JSON.stringify(images);
  viewer.dataset.index = String(startIndex);
  viewer.setAttribute("role", "dialog");
  viewer.setAttribute("aria-modal", "true");
  viewer.setAttribute("aria-label", title || "作品查看");
  viewer.innerHTML = `
    <button class="archive-lightbox-close" type="button" aria-label="关闭">×</button>
    ${hasMultiple ? `<button class="archive-lightbox-nav prev" type="button" aria-label="上一张">‹</button>` : ""}
    <div class="archive-lightbox-stage" data-lightbox-stage>
      <img data-lightbox-image src="" alt="${title || ""}" draggable="false" />
    </div>
    ${hasMultiple ? `<button class="archive-lightbox-nav next" type="button" aria-label="下一张">›</button>` : ""}
    <div class="archive-lightbox-count" data-lightbox-count></div>
  `;

  const stage = viewer.querySelector("[data-lightbox-stage]");
  const image = viewer.querySelector("[data-lightbox-image]");

  viewer.querySelector(".archive-lightbox-close").addEventListener("click", closeLightbox);
  viewer.querySelector(".archive-lightbox-nav.prev")?.addEventListener("click", (event) => {
    event.stopPropagation();
    showLightboxImage(viewer, Number(viewer.dataset.index) - 1);
  });
  viewer.querySelector(".archive-lightbox-nav.next")?.addEventListener("click", (event) => {
    event.stopPropagation();
    showLightboxImage(viewer, Number(viewer.dataset.index) + 1);
  });
  viewer.addEventListener("click", (event) => {
    if (event.target === viewer || event.target === stage) closeLightbox();
  });
  viewer.addEventListener("contextmenu", (event) => event.preventDefault());
  image.addEventListener("dragstart", (event) => event.preventDefault());
  stage.addEventListener("wheel", (event) => {
    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.12 : -0.12;
    lightboxState.scale = Math.min(6, Math.max(0.35, lightboxState.scale + delta));
    updateLightboxImage(viewer);
  }, { passive: false });
  image.addEventListener("pointerdown", (event) => {
    lightboxState.dragging = true;
    lightboxState.pointerX = event.clientX;
    lightboxState.pointerY = event.clientY;
    image.setPointerCapture(event.pointerId);
  });
  image.addEventListener("pointermove", (event) => {
    if (!lightboxState.dragging) return;
    lightboxState.x += event.clientX - lightboxState.pointerX;
    lightboxState.y += event.clientY - lightboxState.pointerY;
    lightboxState.pointerX = event.clientX;
    lightboxState.pointerY = event.clientY;
    updateLightboxImage(viewer);
  });
  image.addEventListener("pointerup", () => {
    lightboxState.dragging = false;
  });
  image.addEventListener("pointercancel", () => {
    lightboxState.dragging = false;
  });

  document.body.appendChild(viewer);
  document.body.classList.add("is-lightbox-open");
  showLightboxImage(viewer, startIndex);
}

function bindLightbox() {
  document.addEventListener("click", (event) => {
    const inlineControl = event.target.closest("[data-inline-control]");
    if (inlineControl) {
      event.preventDefault();
      event.stopPropagation();
      const card = inlineControl.closest("[data-group-index]");
      const carousel = card?.querySelector("[data-inline-carousel]");
      if (card && carousel) {
        setInlineSlide(card, Number(carousel.dataset.index || 0) + Number(inlineControl.dataset.inlineStep || 0));
      }
      return;
    }
    const trigger = event.target.closest("[data-group-index]");
    if (!trigger) return;
    openLightbox(renderedGroups[Number(trigger.dataset.groupIndex)] || { primary: {}, items: [] });
  });
  document.addEventListener("contextmenu", (event) => {
    if (event.target.closest("[data-group-index]")) event.preventDefault();
  });
  document.addEventListener("keydown", (event) => {
    const viewer = document.querySelector("[data-lightbox]");
    const inlineCard = event.target.closest?.("[data-group-index]");
    if (!viewer && inlineCard && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      openLightbox(renderedGroups[Number(inlineCard.dataset.groupIndex)] || { primary: {}, items: [] });
      return;
    }
    if (event.key === "Escape") closeLightbox();
    if (!viewer) return;
    if (event.key === "ArrowLeft") showLightboxImage(viewer, Number(viewer.dataset.index) - 1);
    if (event.key === "ArrowRight") showLightboxImage(viewer, Number(viewer.dataset.index) + 1);
  });
}

function applySearch() {
  const value = document.querySelector("[data-gallery-search]").value.trim().toLowerCase();

  if (showingProjectList) {
    const projects = visibleProjects().filter((project) => {
      const projectTypes = [project.project, ...(project.projects || [])];
      const text = [project.title, project.meta, project.copy, ...projectTypes.map((type) => PROJECT_LABELS[type] || "")].join(" ").toLowerCase();
      return !value || text.includes(value);
    });
    const grid = document.querySelector("[data-case-grid]");
    document.querySelector("[data-gallery-count]").textContent = `共 ${projects.length} 个项目`;
    syncProjectGridState(projects);
    grid.replaceChildren(...projects.map((item) => {
      const card = document.createElement("a");
      card.className = "archive-case-card";
      card.href = `gallery.html?case=${item.id}#archive-browser`;
      card.innerHTML = `
        <img src="${item.poster || item.image}" alt="${item.title}" loading="lazy" />
        <span>${item.meta}</span>
        <strong>${item.title}</strong>
        <p>${item.copy}</p>
      `;
      return card;
    }));
    return;
  }

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

function scrollToResults() {
  if (!(activeType || activeProject || activeCase)) return;
  const target = document.querySelector(showingProjectList ? "#archive-selected" : "#archive-browser");
  if (!target) return;
  window.requestAnimationFrame(() => {
    target.scrollIntoView({ block: "start" });
  });
}

async function initGallery() {
  setActiveLinks();
  renderFeature();
  renderChips();
  renderProjects();
  bindMenu();
  bindLightbox();

  const response = await fetch("assets/portfolio/portfolio-index.json", { cache: "no-store" });
  allItems = await response.json();
  filteredItems = baseFilteredItems();
  renderSubChips();
  renderItems(filteredItems);
  scrollToResults();

  document.querySelector("[data-gallery-search]").addEventListener("input", applySearch);
}

initGallery().catch(() => {
  const empty = document.querySelector("[data-gallery-empty]");
  empty.hidden = false;
  empty.textContent = "作品索引暂时无法读取";
});
