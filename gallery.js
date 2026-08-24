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

const POSTER_YEARS = {
  "ai-qing-gong-yu": 2018,
  "monkey-king": 2026,
  "di-xin-wei-ji": 2023,
  "mi-hang-kun-lun-xu": 2025,
  "da-mao-xian-wang": 2024,
  "chao-shen-bao-biao": 2021,
  "ren-yu": 2022,
  "ying-zi-xing-dong": 2021,
  "da-she-3": 2022,
  "da-mo-shen-long": 2021,
  "hei-shui-ling": 2024,
  "jiang-long-zhuo-yao": 2020,
  "jiang-long-lie-long": 2020,
  "jiang-long-mo-long": 2020,
  "yi-zhai-jia-zu": 2021,
  "su-ji-guan-cai-pu": 2021,
  "feng-du-guai-tan": 2022,
  "xin-xin-yu": 2023,
  "cheng-feng-po-lang": 2020,
  "qing-chun-zai-da-di": 2020,
  "jin-ying-jie": 2020,
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

const LEGACY_PROJECTS = [
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

let PROJECTS = LEGACY_PROJECTS.slice();

const PROJECT_ENTRY_ORDER = [
  "ai-qing-gong-yu",
  "cheng-feng-po-lang",
  "jin-ying-jie",
  "yi-zhai-jia-zu",
  "monkey-king",
  "su-ji-guan-cai-pu",
];

const params = new URLSearchParams(window.location.search);
let activeType = params.get("type");
let activeProject = params.get("project");
const activeCaseId = params.get("case");
const editorPreview = params.get("editor") === "1";
let activeCase = PROJECTS.find((item) => item.id === activeCaseId);
let showingProjectList = !activeType && !activeCase;
let projectGridExpanded = params.get("view") === "all" || Boolean(activeProject) || window.location.hash === "#archive-selected";
const PORTFOLIO_DATA_VERSION = "20260808a";

let allItems = [];
let filteredItems = [];
let renderedGroups = [];
let portfolioMedia = {};
let pageElements = {};
let lightboxState = {
  scale: 1,
  x: 0,
  y: 0,
  dragging: false,
  pointerX: 0,
  pointerY: 0,
  startX: 0,
  startY: 0,
  pointerType: "",
};

function cleanTitle(title = "") {
  return title.replace(/\s+/g, " ").replace(/《\s+/g, "《").replace(/\s+》/g, "》").trim();
}

function displayTitle(title = "") {
  return cleanTitle(title).replace(/[《》]/g, "");
}

function textStyle(value) {
  if (!value || typeof value !== "object") return "";
  const declarations = [];
  const size = Number(value.fontSize);
  if (Number.isInteger(size) && size >= 8 && size <= 72) declarations.push(`font-size:${size}px`);
  if (/^#[0-9a-f]{6}$/i.test(value.color || "")) declarations.push(`color:${value.color}`);
  if ([400, 500, 600, 700, 800].includes(Number(value.fontWeight))) declarations.push(`font-weight:${Number(value.fontWeight)}`);
  return declarations.length ? ` style="${declarations.join(";")}"` : "";
}

function applyPageElementOverrides() {
  document.querySelectorAll("[data-editor-page-element]").forEach((element) => {
    const override = pageElements[element.dataset.editorPageElement];
    if (!override || typeof override !== "object") return;
    const kind = element.dataset.editorElementKind || "text";
    if (kind !== "icon" && typeof override.text === "string") element.textContent = override.text;
    if (Number.isInteger(override.fontSize)) element.style.fontSize = `${override.fontSize}px`;
    if (/^#[0-9a-f]{6}$/i.test(override.color || "")) element.style.color = override.color;
    if ([400, 500, 600, 700, 800].includes(Number(override.fontWeight))) element.style.fontWeight = String(override.fontWeight);
    if (Number.isInteger(override.width)) element.style.width = `${override.width}px`;
    if (Number.isInteger(override.height)) element.style.height = `${override.height}px`;
    if (Number.isInteger(override.offsetX) || Number.isInteger(override.offsetY)) {
      element.style.translate = `${override.offsetX || 0}px ${override.offsetY || 0}px`;
    }
    if (Number.isInteger(override.iconSize)) {
      const icon = element.matches("img,svg") ? element : element.querySelector("img,svg");
      if (icon) {
        icon.style.width = `${override.iconSize}px`;
        icon.style.height = `${override.iconSize}px`;
      } else if (kind === "icon") {
        element.style.fontSize = `${override.iconSize}px`;
      }
    }
  });
}

function mediaFor(file) {
  return portfolioMedia[file] || {};
}

function ratioClassForFile(file) {
  const media = mediaFor(file);
  if (!media.width || !media.height) return "";
  const ratio = media.width / media.height;
  if (ratio > 16 / 9) return "is-ultrawide";
  if (ratio > 1) return "is-wide";
  return "is-square-or-tall";
}

function portfolioImageMarkup(file, alt, options = {}) {
  const media = mediaFor(file);
  const source = media.preview || file;
  const loading = options.loading || "lazy";
  const index = Number.isInteger(options.imageIndex)
    ? ` data-group-image-index="${options.imageIndex}"`
    : "";
  const dimensions = media.width && media.height
    ? ` width="${media.width}" height="${media.height}"`
    : "";
  const priority = options.priority ? ' fetchpriority="high"' : "";
  return `<img${index} src="${source}" data-original-src="${file}" alt="${cleanTitle(alt)}" loading="${loading}"${priority}${dimensions} draggable="false" />`;
}

function bindPortfolioImageFallbacks() {
  document.addEventListener("error", (event) => {
    const image = event.target.closest?.("img[data-original-src]");
    if (!image) return;
    const fallback = image.dataset.originalSrc;
    delete image.dataset.originalSrc;
    if (fallback) image.src = fallback;
  }, true);
}

function registerPortfolioCache() {
  if (editorPreview) return;
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register(`portfolio-sw.js?v=${PORTFOLIO_DATA_VERSION}`).catch(() => {});
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
  if (item.projectId) {
    const assigned = PROJECTS.find((project) => project.id === item.projectId);
    if (assigned) return assigned;
  }
  return PROJECTS.find((project) => (project.slides || []).includes(Number(item.slide)));
}

function mergeProjects(projects = []) {
  const merged = new Map(LEGACY_PROJECTS.map((project) => [project.id, { ...project }]));
  projects.forEach((project) => {
    if (!project?.id) return;
    merged.set(project.id, { ...(merged.get(project.id) || {}), ...project });
  });
  return Array.from(merged.values());
}

function artworkCaption(title, project, item = {}) {
  const cleaned = cleanTitle(title);
  const titleMatch = cleaned.match(/《[^》]+》/);
  const fallbackName = cleanTitle(project?.title || "作品").replace(/美术设计$/, "").trim();
  const workName = displayTitle(titleMatch?.[0] || fallbackName);
  let description = cleaned;

  if (titleMatch) {
    description = description.replace(titleMatch[0], "");
  } else if (fallbackName && description.includes(fallbackName)) {
    description = description.replace(fallbackName, "");
  }

  return {
    workName: cleanTitle(item.captionName || workName),
    description: cleanTitle(item.captionDescription ?? description),
  };
}

function projectHasType(project, type) {
  return project.project === type || project.projects?.includes(type);
}

function currentLabel() {
  if (activeType === "all") return "全部美术资料";
  if (activeType) return TYPE_LABELS[activeType] || "作品";
  if (activeCase) return displayTitle(activeCase.title);
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

function createPosterMotion(marquee, track, enabled) {
  marquee._posterMotion?.destroy();
  marquee.scrollLeft = 0;

  let offset = 0;
  let frame = 0;
  let previousTime = performance.now();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const speed = window.matchMedia("(max-width: 760px)").matches ? 13 : 18;

  const cycleWidth = () => track.firstElementChild?.getBoundingClientRect().width || track.scrollWidth / 2;
  const normalize = (value) => {
    const width = cycleWidth();
    return width > 0 ? ((value % width) + width) % width : 0;
  };
  const render = () => {
    offset = normalize(offset);
    track.style.transform = `translate3d(${-offset}px, 0, 0)`;
  };
  const shiftBy = (distance) => {
    offset += distance;
    render();
  };
  const tick = (now) => {
    const elapsed = Math.min(32, Math.max(0, now - previousTime));
    previousTime = now;
    if (!marquee.classList.contains("is-middle-dragging") && !marquee.matches(":focus-within")) {
      offset += speed * elapsed / 1000;
      render();
    }
    frame = window.requestAnimationFrame(tick);
  };

  render();
  if (enabled && !reducedMotion) frame = window.requestAnimationFrame(tick);

  return {
    shiftBy,
    setOffset(value) {
      offset = value;
      render();
    },
    getCycleWidth: cycleWidth,
    destroy() {
      window.cancelAnimationFrame(frame);
      track.style.transform = "";
    },
  };
}

function renderPosterShowcase() {
  const showcase = document.querySelector("[data-archive-showcase]");
  const marquee = document.querySelector("[data-poster-marquee]");
  const track = document.querySelector("[data-poster-track]");
  const showAll = document.querySelector("[data-show-all-projects]");
  if (!showcase || !marquee || !track || !showAll) return;

  showcase.hidden = Boolean(activeCase && !activeType);
  if (showcase.hidden) {
    marquee._posterMotion?.destroy();
    marquee._posterMotion = null;
    track.replaceChildren();
    return;
  }

  const projects = visibleProjects().filter((project) => project.poster || project.image);
  const tilts = [-7, -4, -2, 3, 6, 2, -5, 4];
  const makeGroup = (duplicate = false) => {
    const group = document.createElement("div");
    group.className = "archive-poster-group";
    if (duplicate) group.setAttribute("aria-hidden", "true");
    projects.forEach((project, index) => {
      const card = document.createElement("a");
      const projectYear = POSTER_YEARS[project.id];
      const paperAge = Number.isInteger(projectYear)
        ? Math.max(0, Math.min(1, (2026 - projectYear) / 8))
        : 0.32;
      card.className = "archive-poster-card";
      card.href = `gallery.html?case=${project.id}#archive-browser`;
      card.style.setProperty("--poster-tilt", `${tilts[index % tilts.length]}deg`);
      card.style.setProperty("--paper-age", paperAge.toFixed(3));
      card.style.setProperty("--paper-overlay-turn", index % 3 === 0 ? "180deg" : "0deg");
      card.style.setProperty("--paper-overlay-flip", index % 4 === 0 ? "-1" : "1");
      card.style.zIndex = String((duplicate ? projects.length : 0) + index + 1);
      if (projectYear) card.dataset.projectYear = String(projectYear);
      card.setAttribute("aria-label", `查看项目：${displayTitle(project.title)}`);
      if (duplicate) card.tabIndex = -1;
      card.innerHTML = `
        <span class="archive-poster-visual">
          ${portfolioImageMarkup(project.poster || project.image, project.title, {
            loading: "eager",
            priority: index < 3 && !duplicate,
          })}
          <span class="archive-poster-label">${displayTitle(project.title)}</span>
        </span>
      `;
      group.appendChild(card);
    });
    return group;
  };

  track.replaceChildren(makeGroup(), makeGroup(true));
  track.classList.toggle("is-static", projects.length < 7);
  marquee._posterMotion = createPosterMotion(marquee, track, projects.length >= 7);
  showAll.setAttribute("aria-expanded", String(projectGridExpanded));
  if (!marquee.dataset.middleDragBound) {
    marquee.dataset.middleDragBound = "true";
    let middleDragging = false;
    let lastPointerX = 0;
    let lastMoveTime = 0;
    let scrollVelocity = 0;
    let inertiaFrame = 0;

    const shiftMarquee = (distance) => {
      marquee._posterMotion?.shiftBy(distance);
    };

    const startInertia = (onFinish = () => {}) => {
      let velocity = scrollVelocity;
      let previousTime = performance.now();
      const glide = (now) => {
        const elapsed = Math.min(32, now - previousTime);
        previousTime = now;
        shiftMarquee(velocity * elapsed);
        velocity *= Math.pow(0.86, elapsed / 16.67);
        if (Math.abs(velocity) >= 0.035) inertiaFrame = window.requestAnimationFrame(glide);
        else {
          inertiaFrame = 0;
          onFinish();
        }
      };
      if (Math.abs(velocity) >= 0.035) inertiaFrame = window.requestAnimationFrame(glide);
      else onFinish();
    };

    const endMiddleDrag = (withInertia = false) => {
      if (!middleDragging) return;
      middleDragging = false;
      if (withInertia) startInertia(() => marquee.classList.remove("is-middle-dragging"));
      else marquee.classList.remove("is-middle-dragging");
    };

    marquee.addEventListener("mousedown", (event) => {
      if (event.button !== 1) return;
      event.preventDefault();
      window.cancelAnimationFrame(inertiaFrame);
      inertiaFrame = 0;
      middleDragging = true;
      lastPointerX = event.clientX;
      lastMoveTime = event.timeStamp;
      scrollVelocity = 0;
      marquee.classList.add("is-middle-dragging");
    });

    window.addEventListener("mousemove", (event) => {
      if (!middleDragging) return;
      event.preventDefault();
      const deltaX = event.clientX - lastPointerX;
      const elapsed = Math.max(8, event.timeStamp - lastMoveTime);
      lastPointerX = event.clientX;
      lastMoveTime = event.timeStamp;
      const instantVelocity = Math.max(-2.2, Math.min(2.2, (-deltaX * 4.5) / elapsed));
      scrollVelocity = scrollVelocity * 0.55 + instantVelocity * 0.45;
      shiftMarquee(-deltaX * 4.5);
    }, { passive: false });

    window.addEventListener("mouseup", (event) => {
      if (event.button === 1) endMiddleDrag(true);
    });
    window.addEventListener("blur", () => endMiddleDrag(false));
    marquee.addEventListener("auxclick", (event) => {
      if (event.button === 1) event.preventDefault();
    });

    let touchDrag = null;
    let suppressTouchClick = false;
    let clearTouchClickTimer = 0;
    const suppressFollowingTouchClick = () => {
      suppressTouchClick = true;
      window.clearTimeout(clearTouchClickTimer);
      clearTouchClickTimer = window.setTimeout(() => {
        suppressTouchClick = false;
      }, 500);
    };
    marquee.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "touch") return;
      window.cancelAnimationFrame(inertiaFrame);
      inertiaFrame = 0;
      touchDrag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastTime: event.timeStamp,
        moved: false,
      };
      scrollVelocity = 0;
      marquee.setPointerCapture?.(event.pointerId);
    });
    marquee.addEventListener("pointermove", (event) => {
      if (!touchDrag || event.pointerId !== touchDrag.pointerId) return;
      const totalX = event.clientX - touchDrag.startX;
      const totalY = event.clientY - touchDrag.startY;
      if (!touchDrag.moved) {
        if (Math.hypot(totalX, totalY) < 7) return;
        if (Math.abs(totalY) > Math.abs(totalX)) {
          suppressFollowingTouchClick();
          touchDrag = null;
          return;
        }
        touchDrag.moved = true;
        suppressFollowingTouchClick();
        marquee.classList.add("is-middle-dragging");
      }
      const deltaX = event.clientX - touchDrag.lastX;
      const elapsed = Math.max(8, event.timeStamp - touchDrag.lastTime);
      touchDrag.lastX = event.clientX;
      touchDrag.lastTime = event.timeStamp;
      const instantVelocity = Math.max(-2.6, Math.min(2.6, (-deltaX * 2.6) / elapsed));
      scrollVelocity = scrollVelocity * 0.5 + instantVelocity * 0.5;
      shiftMarquee(-deltaX * 2.6);
      event.preventDefault();
    });
    const endTouchDrag = (event) => {
      if (!touchDrag || event.pointerId !== touchDrag.pointerId) return;
      const moved = touchDrag.moved;
      touchDrag = null;
      if (moved) startInertia(() => marquee.classList.remove("is-middle-dragging"));
    };
    marquee.addEventListener("pointerup", endTouchDrag);
    marquee.addEventListener("pointercancel", (event) => {
      if (!touchDrag || event.pointerId !== touchDrag.pointerId) return;
      suppressFollowingTouchClick();
      touchDrag = null;
      marquee.classList.remove("is-middle-dragging");
    });
    marquee.addEventListener("click", (event) => {
      if (!suppressTouchClick) return;
      suppressTouchClick = false;
      window.clearTimeout(clearTouchClickTimer);
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
  }
  if (!showAll.dataset.bound) {
    showAll.dataset.bound = "true";
    showAll.addEventListener("click", () => {
      const url = new URL(window.location.href);
      const collapseProjects = projectGridExpanded && !activeType && !activeCase;
      if (!collapseProjects) {
        activeType = null;
        activeCase = null;
        showingProjectList = true;
        projectGridExpanded = true;
        url.searchParams.delete("type");
        url.searchParams.delete("case");
        url.searchParams.set("view", "all");
        url.hash = "archive-selected";
        window.history.replaceState({}, "", url);
        renderProjectNavigationState();
      } else {
        projectGridExpanded = false;
        url.searchParams.delete("view");
        url.hash = "";
        window.history.replaceState({}, "", url);
        renderProjects();
        document.querySelector(".archive-showcase")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }
}

function preloadProjectPosters() {
  const sources = new Set(PROJECTS.map((project) => {
    const file = project.poster || project.image;
    return file ? (mediaFor(file).preview || file) : "";
  }).filter(Boolean));
  sources.forEach((source) => {
    const image = new Image();
    image.decoding = "async";
    image.src = source;
  });
}

function renderProjectNavigationState({ scroll = true } = {}) {
  activeCase = null;
  showingProjectList = true;
  projectGridExpanded = true;
  setActiveLinks();
  renderChips();
  filteredItems = baseFilteredItems();
  renderPosterShowcase();
  renderProjects();
  renderSubChips();
  renderItems(filteredItems);
  if (scroll) document.querySelector("#archive-selected")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function bindProjectNavigation() {
  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link || event.defaultPrevented || editorPreview || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const url = new URL(link.href, window.location.href);
    const project = url.searchParams.get("project");
    if (url.origin !== window.location.origin || !project || !Object.hasOwn(PROJECT_LABELS, project)) return;
    event.preventDefault();
    activeType = null;
    activeProject = project;
    url.searchParams.set("view", "all");
    url.hash = "archive-selected";
    window.history.pushState({}, "", url);
    renderProjectNavigationState();
  });
  window.addEventListener("popstate", () => {
    const url = new URL(window.location.href);
    activeType = url.searchParams.get("type");
    activeProject = url.searchParams.get("project");
    renderProjectNavigationState({ scroll: false });
  });
}

function bindMaterialJump() {
  document.addEventListener("click", (event) => {
    const link = event.target.closest(".archive-material-link, .archive-chip[href*='type=all']");
    if (!link || event.defaultPrevented || editorPreview || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    activeType = "all";
    activeProject = null;
    activeCase = null;
    showingProjectList = false;
    const browser = document.querySelector("#archive-browser");
    const threshold = document.querySelector("[data-material-threshold]");
    const title = document.querySelector("[data-gallery-title]");
    if (browser) {
      browser.hidden = false;
      browser.classList.add("is-filtered");
      browser.classList.remove("is-after-projects");
    }
    if (threshold) threshold.hidden = true;
    if (title) title.textContent = currentLabel();
    document.querySelector("[data-gallery-count]").textContent = `共 ${renderedGroups.length} 项`;
    const url = new URL(window.location.href);
    url.search = "?type=all";
    url.hash = "archive-browser";
    window.history.pushState({}, "", url);
    setActiveLinks();
    renderChips();
    applyPageElementOverrides();
    browser?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function renderChips() {
  const wrap = document.querySelector("[data-archive-chips]");
  const chips = [
    { label: "全部", href: "gallery.html?type=all#archive-browser", active: activeType === "all" },
    { label: activeCase ? displayTitle(activeCase.title) : "项目", href: activeCase ? window.location.href : "gallery.html#archive-selected", active: showingProjectList || Boolean(activeCase) },
    ...Object.entries(TYPE_LABELS).map(([key, label]) => ({
      label,
      href: `gallery.html?type=${key}#archive-browser`,
      active: activeType === key,
    })),
  ];

  wrap.replaceChildren(...chips.map((chip, index) => {
    const link = document.createElement("a");
    link.className = "archive-chip";
    link.href = chip.href;
    link.textContent = chip.label;
    const key = index === 0 ? "all" : index === 1 ? "project" : Object.keys(TYPE_LABELS)[index - 2];
    link.dataset.editorPageElement = `materialChip-${key}`;
    link.dataset.editorPageLabel = `${chip.label}分类按钮`;
    link.dataset.editorElementKind = "button";
    link.classList.toggle("is-active", chip.active);
    return link;
  }));
  applyPageElementOverrides();
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
      label: displayTitle(project.title),
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
      if (Number.isFinite(a.order) || Number.isFinite(b.order)) {
        return (Number.isFinite(a.order) ? a.order : Number.MAX_SAFE_INTEGER)
          - (Number.isFinite(b.order) ? b.order : Number.MAX_SAFE_INTEGER);
      }
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
  const revealProjects = !browsingWorks && projectGridExpanded;

  selected.hidden = !revealProjects;
  grid.hidden = !revealProjects;
  eyebrow.textContent = activeProject ? "Project Type" : "All Projects";
  title.textContent = activeProject ? currentLabel() : "全部作品";
  const showAll = document.querySelector("[data-show-all-projects]");
  showAll?.setAttribute("aria-expanded", String(revealProjects));
  if (showAll) showAll.textContent = revealProjects ? "收起作品" : "全部作品";
  if (browsingWorks) return;

  count.textContent = `共 ${projects.length} 个项目`;
  syncProjectGridState(projects);
  grid.replaceChildren(...projects.map((item) => {
    const card = document.createElement("a");
    card.className = "archive-case-card";
    if (editorPreview) card.dataset.editorProjectId = item.id;
    card.href = `gallery.html?case=${item.id}#archive-browser`;
    card.innerHTML = `
      ${portfolioImageMarkup(item.poster || item.image, item.title)}
      <span data-editor-project-field="meta"${textStyle(item.textStyles?.meta)}>${item.meta}</span>
      <strong data-editor-project-field="title"${textStyle(item.textStyles?.title)}>${displayTitle(item.title)}</strong>
      <p data-editor-project-field="copy"${textStyle(item.textStyles?.copy)}>${item.copy}</p>
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
  "assets/portfolio/slide-19-04.jpeg": 0,
  "assets/portfolio/slide-19-01.jpeg": 1,
  "assets/portfolio/slide-19-02.jpeg": 2,
  "assets/portfolio/slide-19-03.jpeg": 3,
  "assets/portfolio/slide-20-02.jpeg": 0,
  "assets/portfolio/slide-20-01.png": 1,
  "assets/portfolio/slide-20-03.png": 2,
  "assets/portfolio/slide-20-04.png": 3,
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
  const typeOrder = Object.keys(TYPE_LABELS);
  const sequenceStartType = showingProjectList && !activeProject ? "atmosphere" : activeType;
  const activeTypeIndex = typeOrder.indexOf(sequenceStartType);
  const continuousTypes = activeTypeIndex >= 0 ? typeOrder.slice(activeTypeIndex) : [];

  return allItems
    .filter((item) => Number(item.slide) > 1 || (item.id && !Number(item.slide)))
    .filter((item) => {
      if (!continuousTypes.length) return matchesRule(item, TYPE_RULES, activeType, "types");
      return continuousTypes.some((type) => matchesRule(item, TYPE_RULES, type, "types"));
    })
    .filter((item) => {
      if (!activeCase) return true;
      return projectForItem(item)?.id === activeCase.id;
    });
}

function groupedMaterialSections(items) {
  const typeOrder = Object.keys(TYPE_LABELS);
  const sequenceStartType = showingProjectList && !activeProject ? "atmosphere" : activeType;
  const activeTypeIndex = typeOrder.indexOf(sequenceStartType);
  if (activeTypeIndex < 0) return [{ type: null, groups: groupItems(items) }];

  const seen = new Set();
  return typeOrder.slice(activeTypeIndex).map((type) => {
    const groups = groupItems(items.filter((item) => matchesRule(item, TYPE_RULES, type, "types")))
      .filter((group) => {
        const key = groupKeyForItem(group.primary);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    return { type, groups };
  }).filter((section) => section.groups.length > 0);
}

function watermarkMarkup(file) {
  if (file && mediaFor(file).watermarked) return "";
  return `<span class="archive-image-watermark" aria-hidden="true">${
    Array.from({ length: 7 }, () => "<span>再野文化</span>").join("")
  }</span>`;
}

function classifyImageRatios(card) {
  const images = Array.from(card.querySelectorAll(".archive-work-track img"));
  if (!images.length) return;

  const apply = (image) => {
    if (!image.naturalWidth || !image.naturalHeight) return;
    const frame = image.closest(".archive-image-frame");
    if (!frame) return;
    const ratio = image.naturalWidth / image.naturalHeight;
    frame.classList.remove("is-ultrawide", "is-wide", "is-square-or-tall");
    frame.classList.add(
      ratio > 16 / 9
        ? "is-ultrawide"
        : ratio > 1
          ? "is-wide"
          : "is-square-or-tall",
    );
  };

  images.forEach((image) => {
    if (!image.complete) image.addEventListener("load", () => apply(image), { once: true });
    apply(image);
  });
}

function bindInlineStrip(card) {
  const carousel = card.querySelector("[data-inline-carousel]");
  if (!carousel || !card.classList.contains("is-horizontal-strip")) return;

  const previous = card.querySelector('[data-inline-nav="previous"]');
  const next = card.querySelector('[data-inline-nav="next"]');

  const updateNavigation = () => {
    if (!previous || !next) return;
    const maxScroll = Math.max(0, carousel.scrollWidth - carousel.clientWidth);
    const hasOverflow = maxScroll > 2;
    previous.hidden = !hasOverflow;
    next.hidden = !hasOverflow;
    previous.disabled = !hasOverflow || carousel.scrollLeft <= 2;
    next.disabled = !hasOverflow || carousel.scrollLeft >= maxScroll - 2;
  };

  [previous, next].forEach((button) => {
    button?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const direction = button.dataset.inlineNav === "previous" ? -1 : 1;
      carousel.scrollBy({ left: direction * carousel.clientWidth, behavior: "smooth" });
    });
  });
  carousel.addEventListener("scroll", updateNavigation, { passive: true });
  window.requestAnimationFrame(updateNavigation);

  let startX = 0;
  let startY = 0;
  let moved = false;

  carousel.addEventListener("pointerdown", (event) => {
    startX = event.clientX;
    startY = event.clientY;
    moved = false;
  });
  carousel.addEventListener("pointermove", (event) => {
    const deltaX = Math.abs(event.clientX - startX);
    const deltaY = Math.abs(event.clientY - startY);
    if (deltaX > 10 && deltaX > deltaY) moved = true;
  });
  carousel.addEventListener("pointerup", () => {
    if (!moved) return;
    card.dataset.suppressLightbox = "true";
    window.setTimeout(() => delete card.dataset.suppressLightbox, 250);
  });
}

function renderItems(items) {
  const grid = document.querySelector("[data-gallery-grid]");
  const empty = document.querySelector("[data-gallery-empty]");
  const count = document.querySelector("[data-gallery-count]");
  const title = document.querySelector("[data-gallery-title]");
  const browser = document.querySelector("#archive-browser");
  const threshold = document.querySelector("[data-material-threshold]");
  const showingMaterialBridge = showingProjectList && !activeProject;

  title.textContent = showingMaterialBridge ? TYPE_LABELS.atmosphere : currentLabel();
  const sections = groupedMaterialSections(items);
  renderedGroups = sections.flatMap((section) => section.groups);
  count.textContent = showingProjectList ? count.textContent : `共 ${renderedGroups.length} 项`;
  empty.hidden = items.length > 0;
  threshold.hidden = !showingMaterialBridge;
  browser.hidden = showingProjectList && !showingMaterialBridge;
  browser.classList.toggle("is-filtered", !showingProjectList || showingMaterialBridge);
  browser.classList.toggle("is-after-projects", showingMaterialBridge);
  grid.classList.toggle("is-list", !showingProjectList || showingMaterialBridge);

  const cards = [];
  let groupIndex = 0;
  sections.forEach((section, sectionIndex) => {
    const sequenceStartType = showingMaterialBridge ? "atmosphere" : activeType;
    const isFollowingType = section.type && section.type !== sequenceStartType;
    if (sectionIndex > 0 || isFollowingType) {
      const divider = document.createElement("header");
      divider.className = "archive-material-continuation";
      divider.innerHTML = `<small>继续浏览</small><h3>${TYPE_LABELS[section.type]}</h3>`;
      cards.push(divider);
    }

    section.groups.forEach((group) => {
      const item = group.primary;
      const type = typeForItem(item);
      const project = projectForItem(item);
      const caption = artworkCaption(item.title, project, item);
      const ratioClasses = group.items.map((entry) => ratioClassForFile(entry.file));
      const isTwoUltrawide = group.items.length === 2
        && ratioClasses.every((className) => className === "is-ultrawide");
      const card = document.createElement("article");
      card.className = "archive-work-card";
      if (editorPreview) card.dataset.editorItemIds = group.items.map((entry) => entry.id).join(",");
      if (group.items.length > 1) card.classList.add("is-horizontal-strip");
      if (isTwoUltrawide) card.classList.add("is-two-ultrawide");
      card.dataset.groupIndex = String(groupIndex);
      card.dataset.title = cleanTitle(item.title);
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", `查看 ${cleanTitle(item.title)}`);
      card.innerHTML = `
        <div class="archive-work-carousel-shell">
          <div
            class="archive-work-carousel"
            data-inline-carousel
            data-index="0"
          >
            <div class="archive-work-track" data-inline-track>
              ${group.items.map((entry, imageIndex) => `
                <span class="archive-image-frame ${ratioClassForFile(entry.file)}"${editorPreview ? ` data-editor-item-id="${entry.id}"` : ""}>
                  ${portfolioImageMarkup(entry.file, entry.title, { imageIndex })}
                  ${watermarkMarkup(entry.file)}
                </span>
              `).join("")}
            </div>
          </div>
          ${group.items.length > 1 ? `
            <button class="archive-work-nav previous" type="button" data-inline-nav="previous" aria-label="上一组图片">‹</button>
            <button class="archive-work-nav next" type="button" data-inline-nav="next" aria-label="下一组图片">›</button>
          ` : ""}
        </div>
        <span class="archive-work-meta">${project?.meta || "作品"} / ${TYPE_LABELS[type]}</span>
        <div class="archive-work-caption">
          <strong data-editor-item-field="captionName"${textStyle(item.captionStyles?.name)}>${caption.workName}</strong>
          ${caption.description || editorPreview ? `<span data-editor-item-field="captionDescription"${textStyle(item.captionStyles?.description)}>${caption.description}</span>` : ""}
        </div>
        ${group.items.length > 1 ? `<em class="archive-work-count">${group.items.length} 张${isTwoUltrawide ? "" : "<small>左滑看全部</small>"}</em>` : ""}
      `;
      classifyImageRatios(card);
      bindInlineStrip(card);
      cards.push(card);
      groupIndex += 1;
    });
  });
  grid.replaceChildren(...cards);
  applyPageElementOverrides();
}

function updateLightboxImage(viewer) {
  const media = viewer.querySelector("[data-lightbox-media]");
  media.style.transform = `translate3d(${lightboxState.x}px, ${lightboxState.y}px, 0) scale(${lightboxState.scale})`;
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
  image.dataset.originalSrc = images[index].fallback || "";
  image.src = images[index].file;
  image.alt = images[index].title || "";
  const watermark = viewer.querySelector("[data-lightbox-watermark]");
  if (watermark) watermark.hidden = images[index].watermarked === true;
  if (count) count.textContent = images.length > 1 ? `${index + 1} / ${images.length}` : "";
  resetLightboxTransform(viewer);
}

function closeLightbox() {
  document.querySelector("[data-lightbox]")?.remove();
  document.body.classList.remove("is-lightbox-open");
}

function openLightbox(group, startIndex = 0) {
  closeLightbox();
  lightboxState = {
    scale: 1,
    x: 0,
    y: 0,
    dragging: false,
    pointerX: 0,
    pointerY: 0,
    startX: 0,
    startY: 0,
    pointerType: "",
  };
  const images = group.items.map((item) => ({
    file: mediaFor(item.file).display || item.file,
    fallback: item.file,
    title: cleanTitle(item.title),
    watermarked: mediaFor(item.file).watermarked === true,
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
      <span class="archive-lightbox-media" data-lightbox-media>
        <img data-lightbox-image src="" alt="${title || ""}" draggable="false" />
        <span data-lightbox-watermark>${watermarkMarkup()}</span>
      </span>
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
    lightboxState.startX = event.clientX;
    lightboxState.startY = event.clientY;
    lightboxState.pointerType = event.pointerType;
    image.setPointerCapture(event.pointerId);
  });
  image.addEventListener("pointermove", (event) => {
    if (!lightboxState.dragging) return;
    if (lightboxState.pointerType === "touch" && lightboxState.scale <= 1) {
      lightboxState.pointerX = event.clientX;
      lightboxState.pointerY = event.clientY;
      return;
    }
    lightboxState.x += event.clientX - lightboxState.pointerX;
    lightboxState.y += event.clientY - lightboxState.pointerY;
    lightboxState.pointerX = event.clientX;
    lightboxState.pointerY = event.clientY;
    updateLightboxImage(viewer);
  });
  image.addEventListener("pointerup", (event) => {
    if (lightboxState.pointerType === "touch" && lightboxState.scale <= 1 && hasMultiple) {
      const deltaX = event.clientX - lightboxState.startX;
      const deltaY = event.clientY - lightboxState.startY;
      if (Math.abs(deltaX) >= 48 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
        showLightboxImage(viewer, Number(viewer.dataset.index) + (deltaX < 0 ? 1 : -1));
      }
    }
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
    const trigger = event.target.closest("[data-group-index]");
    if (!trigger) return;
    if (trigger.dataset.suppressLightbox === "true") return;
    const clickedImage = event.target.closest("[data-group-image-index]");
    const startIndex = clickedImage
      ? Number(clickedImage.dataset.groupImageIndex)
      : 0;
    openLightbox(
      renderedGroups[Number(trigger.dataset.groupIndex)] || { primary: {}, items: [] },
      Number.isFinite(startIndex) ? startIndex : 0,
    );
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
    if (value) projectGridExpanded = true;
    renderProjects();
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
        ${portfolioImageMarkup(item.poster || item.image, item.title)}
        <span>${item.meta}</span>
        <strong>${displayTitle(item.title)}</strong>
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
  if (!(activeType || activeProject || activeCase || projectGridExpanded)) return;
  const target = document.querySelector(showingProjectList ? "#archive-selected" : "#archive-browser");
  if (!target) return;
  window.requestAnimationFrame(() => {
    target.scrollIntoView({ block: "start" });
  });
}

function bindArchiveSidebar() {
  const sidebar = document.querySelector(".archive-sidebar");
  const shell = document.querySelector(".archive-shell");
  const toggle = document.querySelector("[data-archive-sidebar-toggle]");
  const scrim = document.querySelector("[data-archive-sidebar-scrim]");
  if (!sidebar || !shell || !toggle || !scrim) return;
  const mobileQuery = window.matchMedia("(max-width: 1180px)");
  const desktopHoverQuery = window.matchMedia("(min-width: 1181px) and (hover: hover) and (pointer: fine)");
  let hoverTimer = 0;
  let leaveTimer = 0;
  let desktopPinned = false;

  const setMobileOpen = (open) => {
    const nextOpen = mobileQuery.matches && open;
    sidebar.classList.toggle("is-open", nextOpen);
    document.body.classList.toggle("is-archive-menu-open", nextOpen);
    toggle.setAttribute("aria-expanded", String(nextOpen));
    toggle.textContent = nextOpen ? "收起分类" : "分类";
    scrim.tabIndex = nextOpen ? 0 : -1;
  };

  const clearDesktopTimers = () => {
    window.clearTimeout(hoverTimer);
    window.clearTimeout(leaveTimer);
  };

  const renderDesktopSidebar = (peeking = false) => {
    if (!desktopHoverQuery.matches) return;
    const collapsed = !desktopPinned;
    sidebar.classList.toggle("is-desktop-collapsed", collapsed);
    sidebar.classList.toggle("is-desktop-peeking", collapsed && peeking);
    shell.classList.toggle("is-sidebar-collapsed", collapsed);
    toggle.textContent = collapsed && !peeking ? "»" : "«";
    toggle.setAttribute("aria-label", collapsed && !peeking ? "展开作品分类" : "收起作品分类");
    toggle.setAttribute("aria-expanded", String(!collapsed || peeking));
  };

  const resetForViewport = () => {
    clearDesktopTimers();
    sidebar.classList.remove("is-desktop-collapsed", "is-desktop-peeking");
    shell.classList.remove("is-sidebar-collapsed");
    if (mobileQuery.matches) {
      setMobileOpen(false);
    } else {
      sidebar.classList.remove("is-open");
      document.body.classList.remove("is-archive-menu-open");
      renderDesktopSidebar(false);
    }
  };

  toggle.addEventListener("click", () => {
    if (mobileQuery.matches) {
      setMobileOpen(!sidebar.classList.contains("is-open"));
      return;
    }
    desktopPinned = !desktopPinned;
    renderDesktopSidebar(false);
  });
  sidebar.addEventListener("pointerenter", () => {
    if (!desktopHoverQuery.matches || desktopPinned) return;
    window.clearTimeout(leaveTimer);
    hoverTimer = window.setTimeout(() => renderDesktopSidebar(true), 200);
  });
  sidebar.addEventListener("pointerleave", () => {
    if (!desktopHoverQuery.matches || desktopPinned) return;
    window.clearTimeout(hoverTimer);
    leaveTimer = window.setTimeout(() => renderDesktopSidebar(false), 320);
  });
  sidebar.addEventListener("focusin", () => {
    if (desktopHoverQuery.matches && !desktopPinned) renderDesktopSidebar(true);
  });
  sidebar.addEventListener("focusout", (event) => {
    if (desktopHoverQuery.matches && !desktopPinned && !sidebar.contains(event.relatedTarget)) {
      renderDesktopSidebar(false);
    }
  });
  scrim.addEventListener("click", () => setMobileOpen(false));
  sidebar.addEventListener("click", (event) => {
    if (event.target.closest("a[data-filter-link]") && mobileQuery.matches) setMobileOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (sidebar.classList.contains("is-open")) setMobileOpen(false);
    if (sidebar.classList.contains("is-desktop-peeking")) renderDesktopSidebar(false);
  });
  mobileQuery.addEventListener("change", resetForViewport);
  desktopHoverQuery.addEventListener("change", resetForViewport);
  resetForViewport();
}

function bindArchiveSearch() {
  const container = document.querySelector(".archive-header-search");
  const toggle = document.querySelector("[data-gallery-search-toggle]");
  const panel = document.querySelector("#archive-search-panel");
  const input = document.querySelector("[data-gallery-search]");
  if (!container || !toggle || !panel || !input) return;

  const setOpen = (open) => {
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    if (open) window.requestAnimationFrame(() => input.focus());
  };

  toggle.addEventListener("click", () => setOpen(panel.hidden));
  input.addEventListener("input", applySearch);
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    setOpen(false);
    toggle.focus();
  });
  document.addEventListener("pointerdown", (event) => {
    if (!panel.hidden && !container.contains(event.target)) setOpen(false);
  });
}

async function initGallery() {
  document.body.classList.toggle("is-portfolio-editor-preview", editorPreview);
  bindMenu();
  bindArchiveSidebar();
  bindArchiveSearch();
  bindProjectNavigation();
  bindMaterialJump();
  bindLightbox();
  bindPortfolioImageFallbacks();
  registerPortfolioCache();

  const publication = await window.PortfolioPublication.load(
    `assets/portfolio/portfolio-index.json?v=${PORTFOLIO_DATA_VERSION}`,
    `assets/portfolio/portfolio-media.json?v=${PORTFOLIO_DATA_VERSION}`,
    `assets/portfolio/portfolio-projects.json?v=${PORTFOLIO_DATA_VERSION}`,
  );
  portfolioMedia = publication.content.media || {};
  pageElements = publication.content.pageElements || {};
  allItems = publication.content.items || [];
  PROJECTS = mergeProjects(publication.content.projects || []);
  applyPageElementOverrides();
  preloadProjectPosters();
  if (editorPreview) window.__portfolioEditorProjects = structuredClone(PROJECTS);
  activeCase = PROJECTS.find((item) => item.id === activeCaseId);
  showingProjectList = !activeType && !activeCase;
  setActiveLinks();
  renderChips();
  filteredItems = baseFilteredItems();
  renderPosterShowcase();
  renderProjects();
  renderSubChips();
  renderItems(filteredItems);
  scrollToResults();

}

initGallery().catch(() => {
  const empty = document.querySelector("[data-gallery-empty]");
  empty.hidden = false;
  empty.textContent = "作品索引暂时无法读取";
});
