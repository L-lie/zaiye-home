import {
  CONTENT_TYPE_LABELS,
  LICENSE_LABELS,
  formatKeyValueLines,
  normalizeVariables,
  parseKeyValueLines,
  parseTags,
  renderPromptTemplate,
  snapshotToViewModel,
} from "./core.mjs?v=20260825-library1";
import {
  bindLoginShowcase,
  loginControlsMarkup,
  loginExperienceMarkup,
} from "../auth/login-experience.js";
import { createPromptVaultBridge } from "./prompt-vault-bridge.mjs?v=20260825-import1";
import { createPromptVaultWebsiteAuthBridge } from "./prompt-vault-auth-bridge.mjs?v=20260825-sso1";

const app = document.getElementById("app");
const accountActions = document.getElementById("accountActions");
const toast = document.getElementById("toast");
const localeToggle = document.querySelector("[data-locale-toggle]");
const promptVaultBridge = createPromptVaultBridge();
const promptVaultWebsiteAuthBridge = createPromptVaultWebsiteAuthBridge();

const RESOURCE_CATEGORY_LABELS = Object.freeze({
  all: ["全部", "All"],
  image: ["图像", "Image"],
  video: ["视频", "Video"],
  writing: ["写作", "Writing"],
  office: ["办公", "Office"],
  coding: ["编程", "Coding"],
});
const RESOURCE_CATEGORY_ORDER = ["all", "image", "video", "writing", "office", "coding"];
const HOME_FEATURED_ART = Object.freeze([
  { src: "assets/featured/mushroom-city-1.webp", promptId: "image-environment-concept", title: "蘑菇城", titleEn: "Mushroom City", likes: 0, size: 1.18, phase: .03, speed: .082, lane: 1.02, lift: -12 },
  { src: "assets/featured/mushroom-city-2.webp", promptId: "image-environment-concept", title: "蘑菇城秘境", titleEn: "Mushroom Realm", likes: 0, size: .82, phase: .10, speed: .112, lane: .9, lift: 14 },
  { src: "assets/featured/abstract-expression.webp", promptId: "image-visual-critique", title: "抽象表现主义", titleEn: "Abstract Expression", likes: 0, size: .78, phase: .17, speed: .11, lane: .91, lift: 18 },
  { src: "assets/featured/knight-medieval.webp", promptId: "image-cinematic-key-art", title: "骑士回中世纪", titleEn: "Medieval Knight", likes: 0, size: 1.04, phase: .29, speed: .094, lane: 1.05, lift: -20 },
  { src: "assets/featured/watercolor-dessert.webp", promptId: "image-product-photography", title: "钢笔水彩手绘", titleEn: "Ink & Watercolor", likes: 0, size: .72, phase: .44, speed: .122, lane: .87, lift: 8 },
  { src: "assets/featured/embroidered-mountain.webp", promptId: "image-environment-concept", title: "刺绣山水", titleEn: "Embroidered Landscape", likes: 0, size: 1.22, phase: .57, speed: .086, lane: 1, lift: -8 },
  { src: "assets/featured/litian-demon.webp", promptId: "image-character-turnaround", title: "庶天妖", titleEn: "Celestial Demon", likes: 0, size: .84, phase: .69, speed: .106, lane: .92, lift: 22 },
  { src: "assets/featured/dark-gothic.webp", promptId: "image-environment-concept", title: "暗黑哥特风", titleEn: "Dark Gothic", likes: 0, size: 1.08, phase: .82, speed: .09, lane: 1.06, lift: -18 },
  { src: "assets/featured/particle-poster.webp", promptId: "image-cinematic-key-art", title: "粒子海报", titleEn: "Particle Poster", likes: 0, size: .76, phase: .94, speed: .116, lane: .89, lift: 12 },
  { src: "assets/featured/neon-action.webp", promptId: "image-storyboard-shot", title: "霓虹动作场景", titleEn: "Neon Action", likes: 0, size: .9, phase: .37, speed: .098, lane: .96, lift: 24 },
  { src: "assets/featured/cosmic-eye.webp", promptId: "image-cinematic-key-art", title: "宇宙之眼", titleEn: "Cosmic Eye", likes: 0, size: .7, phase: .63, speed: .126, lane: .86, lift: -6 },
  { src: "assets/featured/ink-character.webp", promptId: "image-character-turnaround", title: "黑白人物", titleEn: "Ink Character", likes: 0, size: .8, phase: .75, speed: .102, lane: 1.04, lift: 6 },
]);

const state = {
  client: null,
  session: null,
  access: null,
  authReady: false,
  resources: null,
  homeOrbitCleanup: null,
  locale: localStorage.getItem("yucangLocale")
    || (navigator.language?.toLowerCase().startsWith("zh") ? "zh" : "en"),
};

function tr(zh, en) {
  return state.locale === "en" ? en : zh;
}

function resourceCategoryLabel(category) {
  const labels = RESOURCE_CATEGORY_LABELS[category];
  return labels ? labels[state.locale === "en" ? 1 : 0] : category;
}

function contentTypeLabel(type) {
  const english = { image: "Image", video: "Video", text_office: "Text & Office", programming: "Programming" };
  return state.locale === "en" ? (english[type] || type) : (CONTENT_TYPE_LABELS[type] || type);
}

function licenseLabel(code) {
  const english = {
    personal: "Personal use only",
    commercial: "Commercial use",
    commercial_client: "Commercial use & client projects",
  };
  return state.locale === "en" ? (english[code] || code) : (LICENSE_LABELS[code] || code);
}

function updateStaticLocale() {
  const en = state.locale === "en";
  document.documentElement.lang = en ? "en" : "zh-CN";
  document.title = tr("语藏 · Prompt 社区", "Yucang · Prompt Community");
  document.querySelector(".brand")?.setAttribute("aria-label", tr("语藏首页", "Yucang home"));
  document.querySelector(".brand strong").textContent = tr("语藏", "Yucang");
  document.querySelector(".main-nav")?.setAttribute("aria-label", tr("主导航", "Main navigation"));
  const navLabels = {
    home: tr("首页", "Home"),
    discover: tr("提示词库", "Prompt Library"),
  };
  Object.entries(navLabels).forEach(([key, label]) => {
    const link = document.querySelector(`[data-nav="${key}"]`);
    if (link) link.textContent = label;
  });
  const creatorLinks = [...document.querySelectorAll("[data-creator-link]")];
  if (creatorLinks[0]) creatorLinks[0].textContent = tr("新建作品", "Create");
  if (creatorLinks[1]) creatorLinks[1].textContent = tr("我的发布", "My Works");
  const staffLink = document.querySelector("[data-staff-link]");
  if (staffLink) staffLink.textContent = tr("审核", "Review");
  const vaultLink = document.querySelector("[data-prompt-vault-link]");
  if (vaultLink) vaultLink.textContent = tr("安装 Prompt Vault", "Get Prompt Vault");
  localeToggle.textContent = en ? "中" : "EN";
  localeToggle.setAttribute("aria-label", en ? "切换到中文" : "Switch to English");
  document.querySelector(".loading-state p")?.replaceChildren(tr("正在进入语藏…", "Entering Yucang…"));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(state.locale === "en" ? "en" : "zh-CN", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(value));
}

function firstRow(data) {
  return Array.isArray(data) ? (data[0] || null) : data;
}

function notify(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => { toast.hidden = true; }, 3200);
}

function setBusy(button, busy, label = tr("处理中…", "Working…")) {
  if (!button) return;
  if (busy) {
    button.dataset.label = button.textContent;
    button.textContent = label;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.label || button.textContent;
    button.disabled = false;
  }
}

function publicPromptUrl(workId) {
  return `https://zaiye.art/yucang/#/prompt/${encodeURIComponent(workId)}`;
}

function officialPromptPayload(item) {
  return {
    title: item.title,
    prompt: item.prompt,
    project: tr("语藏站方精选", "Yucang Official Picks"),
    category: item.category || "",
    type: item.type || item.category || "scene",
    tags: item.tags || [],
    variables: item.variables || [],
    model: item.model || "",
    modelVersion: item.modelVersion || "",
    basicParams: item.basicParams || {},
    license: item.license || "",
    sourceWorkId: `official:${item.id}`,
    sourceVersionId: "official-library-v2",
    sourceUrl: publicPromptUrl(item.id),
    usageInstruction: item.usage || "",
    negative: item.negative || "",
    sourceCreator: item.sourceName || tr("语藏", "Yucang"),
  };
}

function communityPromptPayload(item) {
  return {
    title: item.title,
    prompt: item.prompt_text,
    project: tr("语藏社区", "Yucang Community"),
    category: item.content_type || "",
    type: item.content_type || "scene",
    tags: item.tags || [],
    variables: normalizeVariables(item.variables),
    model: item.model_name || "",
    modelVersion: item.model_version || "",
    basicParams: item.parameters || {},
    license: licenseLabel(item.license_code),
    sourceWorkId: item.work_id,
    sourceVersionId: item.version_id,
    sourceUrl: publicPromptUrl(item.work_id),
    sourceCreator: item.author_nickname || "",
  };
}

async function savePromptToVault(button, payload) {
  setBusy(button, true, tr("正在收进语藏…", "Saving to Prompt Vault…"));
  const result = await promptVaultBridge.save(payload);
  setBusy(button, false);
  if (result.ok && result.status === "created") {
    button.textContent = tr("已收进 Prompt Vault", "Saved to Prompt Vault");
    button.disabled = true;
    notify(tr("已作为普通提示词收进 Prompt Vault。", "Saved as a regular Prompt Vault item."));
    return;
  }
  if (result.ok && result.status === "already_saved") {
    button.textContent = tr("已在 Prompt Vault 中", "Already in Prompt Vault");
    button.disabled = true;
    notify(tr("这个公开版本已经收进 Prompt Vault。", "This public version is already in Prompt Vault."));
    return;
  }
  if (result.error === "not_installed") {
    notify(tr("未检测到支持此功能的 Prompt Vault，请先安装或更新扩展。", "Prompt Vault was not detected. Install or update the extension first."));
    window.open("../prompt-vault.html", "_blank", "noopener");
    return;
  }
  notify(tr("暂时无法收进 Prompt Vault，请稍后再试。", "Unable to save to Prompt Vault. Try again later."));
}

function bindPromptVaultButtons(root, getPayload) {
  root.querySelectorAll("[data-save-to-vault]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (button.disabled) return;
      await savePromptToVault(button, getPayload(button.dataset.saveToVault));
    });
  });
  promptVaultBridge.detect().then((connection) => {
    if (!root.isConnected) return;
    root.querySelectorAll("[data-save-to-vault]").forEach((button) => {
      button.dataset.vaultInstalled = String(connection.installed);
      if (connection.installed) button.title = tr("保存为扩展中的普通提示词条目", "Save as a regular Prompt Vault item");
    });
  });
}

function routeParts() {
  const value = location.hash.replace(/^#\/?/, "") || "home";
  return value.split("/").filter(Boolean);
}

function go(path) {
  location.hash = `#/${path.replace(/^\//, "")}`;
}

async function setLocale(locale) {
  state.locale = locale === "en" ? "en" : "zh";
  localStorage.setItem("yucangLocale", state.locale);
  updateStaticLocale();
  renderHeader();
  await renderRoute();
}

function getClient() {
  if (state.client) return state.client;
  state.client = window.ZaiyeSupabase?.getClient();
  if (!state.client) throw new Error(tr(
    "Supabase 尚未配置，无法运行语藏。请检查 supabase-config.js。 ",
    "Supabase is not configured. Check supabase-config.js.",
  ));
  return state.client;
}

async function rpc(name, args = {}) {
  const result = await getClient().rpc(name, args);
  if (result.error) throw result.error;
  return result.data;
}

async function loadResources() {
  if (state.resources) return state.resources;
  const response = await fetch("../prompt-vault-resources.json", { cache: "no-cache" });
  if (!response.ok) throw new Error(`${tr("提示词库读取失败", "Prompt Library failed to load")} (${response.status})`);
  const payload = await response.json();
  if (!Array.isArray(payload.items)) throw new Error(tr("提示词库数据格式不正确。", "Prompt Library data is invalid."));
  state.resources = payload.items;
  return state.resources;
}

function isSchemaMissing(error) {
  return ["PGRST202", "PGRST205", "42P01", "42883"].includes(error?.code)
    || /schema cache|function .* does not exist|relation .* does not exist/i.test(error?.message || "");
}

function renderError(error, title = tr("暂时无法完成", "Unable to continue")) {
  const setup = isSchemaMissing(error)
    ? `<div class="setup-note">${tr(
      "远程 Supabase 尚未应用 Slice 1 migration。请先在开发/测试项目应用",
      "The remote Supabase project is missing the Slice 1 migration. Apply",
    )} <code>20260825000100_yucang_slice1.sql</code>${tr("，再刷新页面。", ", then refresh.")}</div>`
    : "";
  app.innerHTML = `
    <section class="state-card error-card">
      <p class="eyebrow">YUCANG ERROR</p>
      <h1>${escapeHtml(title)}</h1>
      <p class="lede">${escapeHtml(error?.message || String(error))}</p>
      ${setup}
      <div class="actions"><a class="button primary" href="#/discover">${tr("返回发现", "Back to Discover")}</a></div>
    </section>`;
}

async function loadAccess() {
  if (!state.session) {
    state.access = null;
    return;
  }
  try {
    state.access = firstRow(await rpc("yucang_get_my_access"));
  } catch (error) {
    state.access = null;
    if (!isSchemaMissing(error)) console.error(error);
  }
}

function renderHeader() {
  document.querySelectorAll("[data-creator-link]").forEach((item) => {
    item.hidden = !state.access?.is_creator;
  });
  document.querySelectorAll("[data-staff-link]").forEach((item) => {
    item.hidden = !(state.access?.is_admin || state.access?.is_reviewer);
  });

  if (!state.session) {
    accountActions.innerHTML = `<a class="button ghost" href="#/login">${tr("登录", "Sign in")}</a>`;
    return;
  }
  accountActions.innerHTML = `
    <span class="account-copy">
      <strong>${escapeHtml(state.access?.nickname || state.session.user.user_metadata?.full_name || state.session.user.user_metadata?.name || tr("已登录", "Signed in"))}</strong>
      <small>${escapeHtml(state.session.user.email || "")}</small>
    </span>
    <button class="button ghost" type="button" data-sign-out>${tr("退出", "Sign out")}</button>`;
  accountActions.querySelector("[data-sign-out]").addEventListener("click", async () => {
    await getClient().auth.signOut();
    go("home");
  });
}

function requireLogin() {
  if (state.session) return true;
  go("login");
  return false;
}

function requireCreator() {
  if (!requireLogin()) return false;
  if (state.access?.is_creator) return true;
  app.innerHTML = `
    <section class="state-card narrow">
      <p class="eyebrow">INVITE ONLY</p>
      <h1>${tr("当前账号没有创作者资格", "This account is not a creator")}</h1>
      <p class="lede">${tr(
        "语藏 MVP 采用站方邀请制。普通登录用户可以浏览公开作品，但不能创建或提交作品。",
        "Yucang MVP is invite-only for creators. Signed-in members can browse public works but cannot create or submit them.",
      )}</p>
      <a class="button primary" href="#/discover">${tr("浏览发现", "Browse Discover")}</a>
    </section>`;
  return false;
}

function requireStaff() {
  if (!requireLogin()) return false;
  if (state.access?.is_admin || state.access?.is_reviewer) return true;
  app.innerHTML = `
    <section class="state-card narrow">
      <p class="eyebrow">STAFF ONLY</p>
      <h1>${tr("没有审核权限", "No review access")}</h1>
      <p class="lede">${tr("审核后台仅向审核员和管理员开放。", "The review workspace is available only to reviewers and administrators.")}</p>
      <button class="button" type="button" data-bootstrap-admin>${tr("以站点 owner 初始化首位管理员", "Initialize the first admin as site owner")}</button>
    </section>`;
  app.querySelector("[data-bootstrap-admin]").addEventListener("click", bootstrapAdmin);
  return false;
}

function bindWebsiteLogin(root) {
  const lastMethod = localStorage.getItem("yucangLastAuthMethod") || "";
  root.querySelectorAll("[data-oauth]").forEach((button) => {
    if (button.dataset.oauth === lastMethod) {
      button.classList.add("is-recent");
      button.setAttribute("aria-label", `${button.getAttribute("aria-label")}${tr("，最近使用", ", recently used")}`);
      button.title = `${button.title}${tr("，最近使用", ", recently used")}`;
    }
  });

  let pendingEmail = "";
  const loginStatus = root.querySelector("#status");
  const setLoginStatus = (message, isError = false) => {
    if (!loginStatus) return notify(message);
    loginStatus.textContent = message;
    loginStatus.classList.toggle("error", isError);
  };
  const emailErrorMessage = (error) => {
    if (Number(error?.status) === 429 || /rate limit|too many|60 seconds/i.test(String(error?.message || ""))) {
      return tr("发送太频繁，请等待 60 秒后再试。之前收到的验证码在有效期内仍可使用。", "Too many requests. Wait 60 seconds and try again. Your previous code remains valid until it expires.");
    }
    return error?.message || tr("验证码发送失败，请稍后重试。", "Could not send the verification code. Try again later.");
  };
  setLoginStatus(tr("选择一种方式登录，或填写邮箱获取验证码。", "Choose a sign-in method or enter your email to get a verification code."));
  const emailRequestForm = root.querySelector("#emailRequestForm");
  const emailVerifyForm = root.querySelector("#emailVerifyForm");
  emailRequestForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.submitter;
    pendingEmail = new FormData(event.currentTarget).get("email").trim();
    setBusy(button, true, tr("正在发送...", "Sending..."));
    const { error } = await getClient().auth.signInWithOtp({
      email: pendingEmail, options: { shouldCreateUser: true },
    });
    setBusy(button, false);
    if (error) return setLoginStatus(emailErrorMessage(error), true);
    emailRequestForm.hidden = true;
    emailVerifyForm.hidden = false;
    emailVerifyForm.querySelector("input").focus();
    setLoginStatus(tr("验证码已发送，请在下方输入。若收件箱没有，请检查垃圾邮箱。", "Verification code sent. Enter it below. Check spam if it is not in your inbox."));
  });

  emailVerifyForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.submitter;
    setBusy(button, true, tr("正在验证...", "Verifying..."));
    const form = new FormData(event.currentTarget);
    const { data, error } = await getClient().auth.verifyOtp({
      email: pendingEmail, token: form.get("token"), type: "email",
    });
    setBusy(button, false);
    if (error) return setLoginStatus(error.message, true);
    localStorage.setItem("yucangLastAuthMethod", "email");
    state.session = data.session;
    await loadAccess();
    renderHeader();
    go("home");
  });

  root.querySelectorAll("[data-oauth]").forEach((button) => button.addEventListener("click", async () => {
    localStorage.setItem("yucangLastAuthMethod", button.dataset.oauth);
    const { error } = await getClient().auth.signInWithOAuth({
      provider: button.dataset.oauth,
      options: { redirectTo: `${location.origin}${location.pathname}#/home` },
    });
    if (error) setLoginStatus(error.message, true);
  }));
}

function bindHomeOrbit(root) {
  const cards = [...root.querySelectorAll(".home-art-card")];
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const entries = cards.map((card, index) => ({
    card,
    phase: Number(card.dataset.orbitPhase ?? index / cards.length) * Math.PI * 2 - Math.PI / 2,
    speed: Number(card.dataset.orbitSpeed || .1),
    lane: Number(card.dataset.orbitLane || 1),
    lift: Number(card.dataset.orbitLift || 0),
    paused: false,
  }));
  let frame = 0;
  let previous = performance.now();

  const setPaused = (entry, paused) => {
    entry.paused = paused;
    entry.card.classList.toggle("is-orbit-paused", paused);
    if (paused) {
      entry.card.style.opacity = "1";
      entry.card.style.zIndex = "20";
    } else {
      entry.card.style.removeProperty("opacity");
      entry.card.style.removeProperty("z-index");
    }
  };
  entries.forEach((entry) => {
    entry.card.addEventListener("pointerenter", () => setPaused(entry, true));
    entry.card.addEventListener("pointerleave", () => setPaused(entry, false));
    entry.card.addEventListener("focus", () => setPaused(entry, true));
    entry.card.addEventListener("blur", () => setPaused(entry, false));
  });

  const paint = (now) => {
    const elapsed = Math.min((now - previous) / 1000, .08);
    previous = now;
    const width = root.clientWidth;
    const height = root.clientHeight;
    const centerX = width / 2;
    const centerY = height * .4;
    const radiusX = Math.max(150, width * .43);
    const radiusY = Math.max(105, Math.min(175, height * .22));
    entries.forEach((entry) => {
      if (!entry.paused && !reducedMotion) entry.phase += elapsed * entry.speed;
      const cardWidth = entry.card.offsetWidth;
      const cardHeight = entry.card.offsetHeight;
      if (!cardWidth || !cardHeight) return;
      const depth = (Math.sin(entry.phase) + 1) / 2;
      const x = centerX + Math.cos(entry.phase) * radiusX * entry.lane - cardWidth / 2;
      const y = centerY + Math.sin(entry.phase) * radiusY + entry.lift - cardHeight / 2;
      entry.card.style.setProperty("--orbit-x", `${x}px`);
      entry.card.style.setProperty("--orbit-y", `${y}px`);
      entry.card.style.setProperty("--orbit-scale", String(.58 + depth * .64));
      entry.card.style.setProperty("--orbit-opacity", String(.16 + depth * .62));
      entry.card.style.setProperty("--orbit-blur", `${(1 - depth) * .7}px`);
      entry.card.style.setProperty("--orbit-z", String(2 + Math.round(depth * 9)));
    });
    if (!reducedMotion) frame = requestAnimationFrame(paint);
  };
  paint(previous);
  return () => cancelAnimationFrame(frame);
}

function bindTextFigure(canvas) {
  const context = canvas.getContext("2d");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const glyphs = "语藏提示词灵感创作想象光影构图镜头场景叙事节奏色彩质感空间细节图像语言模型参数风格结构生成变化重组流动";
  const particles = [];
  const motes = [];
  const pointer = { active: false, x: 0, y: 0 };
  let frame = 0;
  let start = performance.now();
  let seed = 24681357;
  const random = () => {
    seed = (seed * 48271) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const insideFigure = (x, y) => {
    let head = false;
    if (y >= .03 && y <= .38) {
      if (y <= .22) {
        head = (x / .18) ** 2 + ((y - .2) / .17) ** 2 <= 1;
      } else {
        const jawProgress = (y - .22) / .16;
        head = Math.abs(x) <= .18 - jawProgress * .075;
      }
    }
    const neck = y >= .37 && y <= .52 && Math.abs(x) <= .07 + (y - .37) * .16;
    let bust = false;
    if (y >= .48 && y <= .9) {
      const progress = (y - .48) / .42;
      const shoulderRise = Math.sin(progress * Math.PI / 2);
      const halfWidth = .09 + shoulderRise * .44;
      bust = Math.abs(x) <= halfWidth;
    }
    return head || neck || bust;
  };
  for (let index = 0; index < 900; index += 1) {
    let x;
    let y;
    do {
      x = random() * 1.24 - .62;
      y = random() * .98 + .04;
    } while (!insideFigure(x, y));
    const depth = random();
    particles.push({
      x,
      y,
      depth,
      glyph: glyphs[Math.floor(random() * glyphs.length)],
      size: 5 + depth ** 2 * 13 + random() * 4,
      alpha: .14 + depth * .64,
      phase: random() * Math.PI * 2,
      speed: .18 + random() * .32,
      rotation: (random() - .5) * .22,
    });
  }
  for (let index = 0; index < 90; index += 1) {
    motes.push({
      x: random() * 1.1 - .55,
      y: random() * .78 + .08,
      glyph: glyphs[Math.floor(random() * glyphs.length)],
      size: 6 + random() * 5,
      speed: .018 + random() * .028,
      phase: random(),
    });
  }
  particles.sort((a, b) => a.depth - b.depth);

  const updatePointer = (event) => {
    if (event.pointerType && event.pointerType !== "mouse" && event.pointerType !== "pen") return;
    const bounds = canvas.getBoundingClientRect();
    pointer.active = true;
    pointer.x = event.clientX - bounds.left;
    pointer.y = event.clientY - bounds.top;
  };
  const clearPointer = () => { pointer.active = false; };
  canvas.addEventListener("pointermove", updatePointer);
  canvas.addEventListener("pointerleave", clearPointer);

  const draw = (now = start) => {
    const cssWidth = canvas.clientWidth;
    const cssHeight = canvas.clientHeight;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    const width = Math.round(cssWidth * ratio);
    const height = Math.round(cssHeight * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, cssWidth, cssHeight);
    const time = (now - start) / 1000;
    const centerX = cssWidth / 2;
    const scaleX = cssWidth * .77;
    const scaleY = cssHeight * .9;
    particles.forEach((particle) => {
        const drift = reducedMotion ? 0 : Math.sin(time * particle.speed + particle.phase) * (1.2 + particle.depth * 1.8);
        let x = centerX + particle.x * scaleX + drift;
        let y = particle.y * scaleY + Math.cos(time * particle.speed * .7 + particle.phase) * 1.4;
        let interaction = 0;
        if (pointer.active && !reducedMotion) {
          const deltaX = x - pointer.x;
          const deltaY = y - pointer.y;
          const distance = Math.hypot(deltaX, deltaY);
          const radius = 72;
          if (distance < radius) {
            interaction = 1 - distance / radius;
            const force = interaction * 16;
            x += (deltaX / Math.max(distance, 1)) * force;
            y += (deltaY / Math.max(distance, 1)) * force;
          }
        }
        context.save();
        context.translate(x, y);
        context.rotate(particle.rotation + Math.sin(time * .12 + particle.phase) * .025);
        context.font = `${Math.round(particle.size)}px "Songti SC", SimSun, STSong, serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillStyle = `rgba(239, 239, 232, ${Math.min(1, particle.alpha + interaction * .42)})`;
        context.shadowColor = `rgba(239, 239, 232, ${.08 + particle.depth * .22 + interaction * .58})`;
        context.shadowBlur = 2 + particle.depth * 5 + interaction * 14;
        context.fillText(particle.glyph, 0, 0);
        context.restore();
      });
    motes.forEach((mote) => {
      const travel = reducedMotion ? 0 : (time * mote.speed + mote.phase) % 1;
      const x = centerX + mote.x * scaleX + Math.sin(time * .3 + mote.phase * 8) * 4;
      const y = (mote.y - travel * .18) * scaleY;
      const alpha = Math.sin(Math.PI * travel) * .34;
      context.font = `${mote.size}px "Songti SC", SimSun, STSong, serif`;
      context.textAlign = "center";
      context.fillStyle = `rgba(239, 239, 232, ${alpha})`;
      context.fillText(mote.glyph, x, y);
    });
    if (!reducedMotion) frame = requestAnimationFrame(draw);
  };
  draw();
  return () => {
    cancelAnimationFrame(frame);
    canvas.removeEventListener("pointermove", updatePointer);
    canvas.removeEventListener("pointerleave", clearPointer);
  };
}

function localizeLoginExperience(root) {
  if (state.locale !== "en") return;
  const setText = (selector, value) => {
    const node = root.querySelector(selector);
    if (node) node.textContent = value;
  };
  const setHtml = (selector, value) => {
    const node = root.querySelector(selector);
    if (node) node.innerHTML = value;
  };
  setText(".login-showcase-copy p", "From inspiration to lasting reuse");
  setHtml(".login-showcase-copy h2", "Turn scattered Prompts<br />into your creative system");
  [
    ["Collect & organize", "Classify, search, edit, and reuse your Prompts"],
    ["Ready anywhere", "Find what you need across different windows"],
    ["Connected to Yucang", "Discover public works, then save them to Prompt Vault"],
  ].forEach(([title, copy], index) => {
    setText(`[data-login-slide]:nth-child(${index + 1}) figcaption strong`, title);
    setText(`[data-login-slide]:nth-child(${index + 1}) figcaption span`, copy);
  });
  setText(".login-method-row > span", "Other sign-in methods");
  setText(".login-divider span", "Email verification code");
  setText('label[for="loginEmail"]', "Email");
  setText("#emailRequestForm button", "Send code");
  setText('label[for="loginToken"]', "Verification code");
  setText("#emailVerifyForm button", "Verify & sign in");
  root.querySelector('[data-oauth="github"]')?.setAttribute("aria-label", "Sign in with GitHub");
  root.querySelector('[data-oauth="google"]')?.setAttribute("aria-label", "Sign in with Google");
}

function renderHome({ showLogin = false } = {}) {
  const featured = HOME_FEATURED_ART.map((item) => {
    const title = state.locale === "en" ? item.titleEn : item.title;
    return `
    <a class="home-art-card" href="#/prompt/${encodeURIComponent(item.promptId)}" aria-label="${escapeHtml(title)}, ${tr("打开对应 Prompt", "open the matching Prompt")}, ${item.likes} ${tr("个赞", "likes")}" style="--card-size:${item.size}" data-orbit-phase="${item.phase}" data-orbit-speed="${item.speed}" data-orbit-lane="${item.lane}" data-orbit-lift="${item.lift}">
      <img src="${escapeHtml(item.src)}" alt="${escapeHtml(title)} ${tr("的 Prompt 示例效果", "Prompt example")}" width="512" height="512" />
      <span class="home-art-like" aria-label="${tr("点赞数", "Like count")}">♡ ${item.likes}</span>
    </a>`;
  }).join("");
  app.innerHTML = `
    <section class="home-hero" aria-labelledby="homeTitle">
      <div class="home-atmosphere" aria-hidden="true"></div>
      <div class="home-copy">
        <p>Prompt Vault · ${tr("语藏", "Yucang")}</p>
        <h1 id="homeTitle">${tr("让文字汇聚成<br />可以复用的创造", "Turn words into<br />reusable creation")}</h1>
        <p>${tr(
          "发现真实 Prompt，修改变量，把有效的方法收进自己的创作系统。",
          "Discover working Prompts, adjust variables, and keep proven methods in your creative system.",
        )}</p>
      </div>
      <div class="home-orbit" aria-label="${tr("首发 Prompt 示例图，当前均为 0 个赞", "Launch Prompt examples, all currently at 0 likes")}">
        ${featured}
        <canvas class="home-text-figure" role="img" aria-label="${tr("由流动中文文字汇聚成的无五官抽象人形", "A featureless abstract figure formed from flowing Chinese characters")}"></canvas>
      </div>
      <a class="button primary home-library-cta" href="#/discover">${tr("进入提示词库", "Explore Prompts")}</a>
      <p class="home-feature-note">${tr("首发精选 · 社区点赞上线后将按真实热度更新", "Launch picks · will update from real community likes")}</p>
    </section>
    ${showLogin && !state.session ? `
      <div class="home-login-layer" role="dialog" aria-modal="true" aria-labelledby="loginExperienceTitle">
        <a class="home-login-backdrop" href="#/home" aria-label="${tr("关闭登录", "Close sign in")}"></a>
        <div class="home-login-shell">
          <a class="home-login-close" href="#/home" aria-label="${tr("关闭登录", "Close sign in")}">×</a>
          ${loginExperienceMarkup({
            assetRoot: "..",
            logoSrc: "assets/prompt-vault-logo.png",
            title: tr("登录语藏", "Sign in to Yucang"),
            description: tr("使用同一个 Prompt Vault 账号进入社区。", "Use your Prompt Vault account to enter the community."),
            controls: loginControlsMarkup({ assetRoot: "..", showStatus: true }),
            footer: tr(
              '登录不会上传、同步或公开你扩展中的本地 Prompt。<br><a href="https://zaiye.art/privacy.html" target="_blank" rel="noopener">隐私政策</a>　<a href="https://zaiye.art/terms.html" target="_blank" rel="noopener">用户协议</a>',
              'Signing in does not upload, sync, or publish local Prompts from your extension.<br><a href="https://zaiye.art/privacy.html" target="_blank" rel="noopener">Privacy</a>　<a href="https://zaiye.art/terms.html" target="_blank" rel="noopener">Terms</a>',
            ),
          })}
        </div>
      </div>` : ""}`;
  const stopOrbit = bindHomeOrbit(app.querySelector(".home-orbit"));
  const stopFigure = bindTextFigure(app.querySelector(".home-text-figure"));
  state.homeOrbitCleanup = () => {
    stopOrbit();
    stopFigure();
  };
  if (showLogin && !state.session) {
    const loginShell = app.querySelector(".home-login-shell");
    localizeLoginExperience(loginShell);
    bindLoginShowcase(loginShell);
    bindWebsiteLogin(loginShell);
    document.onkeydown = (event) => { if (event.key === "Escape") go("home"); };
    requestAnimationFrame(() => app.querySelector(".home-login-close")?.focus());
  } else {
    document.onkeydown = null;
  }
}

async function renderDiscover() {
  app.innerHTML = `<section class="loading-state"><span class="spinner"></span><p>${tr("正在读取提示词库...", "Loading Prompt Library...")}</p></section>`;
  try {
    const items = await loadResources();
    app.innerHTML = `
      <section class="library-intro">
        <div>
          <p class="eyebrow">${tr("语藏提示词库", "YUCANG PROMPT LIBRARY")}</p>
          <h1>${tr("找到 Prompt，改好变量，直接使用", "Find a Prompt. Adjust it. Use it.")}</h1>
          <p>${tr(
            "无需登录。浏览站方整理的真实模板，在页面里完成变量替换并复制最终 Prompt。",
            "No sign-in required. Browse curated templates, replace variables, and copy the final Prompt.",
          )}</p>
        </div>
        <aside class="library-count" aria-label="${tr("提示词数量", "Prompt count")}">
          <strong>${items.length}</strong><span>${tr("条可用 Prompt", "Prompts available")}</span>
        </aside>
      </section>
      <section class="library-browser" aria-labelledby="libraryTitle">
        <div class="library-toolbar">
          <div>
            <h2 id="libraryTitle">${tr("全部提示词", "All Prompts")}</h2>
            <p data-result-count>${items.length} ${tr("条结果", "results")}</p>
          </div>
          <label class="library-search">
            <span>${tr("搜索", "Search")}</span>
            <input type="search" data-resource-search placeholder="${tr("搜索标题、用途、模型或标签", "Search title, use, model, or tag")}" autocomplete="off" />
          </label>
        </div>
        <div class="category-tabs" role="group" aria-label="${tr("提示词分类", "Prompt categories")}">
          ${RESOURCE_CATEGORY_ORDER.map((category) => `<button type="button" data-resource-category="${category}" aria-pressed="${category === "all"}">${resourceCategoryLabel(category)}</button>`).join("")}
        </div>
        <div class="resource-grid" data-resource-grid></div>
      </section>
      <section class="community-shelf" data-community-shelf hidden></section>`;
    bindResourceLibrary(items);
    hydrateCommunityShelf();
  } catch (error) {
    renderError(error, tr("提示词库暂时不可用", "Prompt Library is unavailable"));
  }
}

async function hydrateCommunityShelf() {
  const shelf = app.querySelector("[data-community-shelf]");
  if (!shelf) return;
  try {
    const items = await rpc("yucang_list_public_works");
    if (!items.length || !shelf.isConnected) return;
    shelf.innerHTML = `
      <div class="section-head"><div><h2>${tr("社区公开作品", "Community Works")}</h2><p>${tr("已经通过审核的创作者作品", "Creator works that passed review")}</p></div></div>
      <div class="card-grid">${items.map(renderWorkCard).join("")}</div>`;
    shelf.hidden = false;
  } catch (error) {
    if (!isSchemaMissing(error)) console.warn("Community shelf unavailable", error);
  }
}

function resourceSearchText(item) {
  return [item.title, item.summary, item.model, item.usage, ...(item.tags || [])].join(" ").toLocaleLowerCase("zh-CN");
}

function renderResourceCard(item) {
  return `
    <article class="resource-card">
      <a class="resource-card-link" href="#/prompt/${encodeURIComponent(item.id)}">
        <div class="resource-card-meta">
          <span>${escapeHtml(resourceCategoryLabel(item.category))}</span>
          <span>${escapeHtml(item.model || tr("通用模型", "General model"))}</span>
        </div>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.summary)}</p>
        <footer><span>${escapeHtml((item.tags || []).slice(0, 3).join(" / "))}</span><strong>${tr("打开使用", "Open")}</strong></footer>
      </a>
      <div class="resource-card-actions"><button class="resource-save-button" type="button" data-save-to-vault="${escapeHtml(item.id)}">${tr("收进 Prompt Vault", "Save to Prompt Vault")}</button></div>
    </article>`;
}

function bindResourceLibrary(items) {
  const grid = app.querySelector("[data-resource-grid]");
  const search = app.querySelector("[data-resource-search]");
  const count = app.querySelector("[data-result-count]");
  const buttons = [...app.querySelectorAll("[data-resource-category]")];
  let category = "all";

  const update = () => {
    const query = search.value.trim().toLocaleLowerCase("zh-CN");
    const filtered = items.filter((item) => (
      (category === "all" || item.category === category)
      && (!query || resourceSearchText(item).includes(query))
    ));
    count.textContent = `${filtered.length} ${tr("条结果", "results")}`;
    grid.innerHTML = filtered.length
      ? filtered.map(renderResourceCard).join("")
      : `<div class="library-empty"><h3>${tr("没有找到匹配的 Prompt", "No matching Prompts")}</h3><p>${tr("换一个关键词，或者切换到其他分类。", "Try another keyword or category.")}</p></div>`;
    bindPromptVaultButtons(grid, (itemId) => officialPromptPayload(items.find((item) => item.id === itemId)));
  };

  search.addEventListener("input", update);
  buttons.forEach((button) => button.addEventListener("click", () => {
    category = button.dataset.resourceCategory;
    buttons.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    update();
  }));
  update();
}

function renderWorkCard(item) {
  return `
    <article class="prompt-card">
      <a href="#/prompt/${encodeURIComponent(item.work_id)}">
        <div class="card-meta">
          <span class="pill accent">${escapeHtml(contentTypeLabel(item.content_type))}</span>
          <span class="pill">v${Number(item.version_no || 1)}</span>
        </div>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.summary || tr("暂无简介", "No description"))}</p>
        <footer class="card-footer"><span>${escapeHtml(item.author_nickname)}</span><span>${escapeHtml(item.model_name || tr("通用模型", "General model"))}</span></footer>
      </a>
    </article>`;
}

async function renderLogin() {
  renderHome({ showLogin: !state.session });
}

function editorMarkup(record = {}) {
  const variables = normalizeVariables(record.variables);
  return `
    <section class="panel">
      <p class="eyebrow">CREATOR STUDIO · ${record.version_id ? `V${record.version_no}` : "NEW"}</p>
      <h1>${record.version_id ? tr("编辑发布草稿", "Edit publication draft") : tr("新建公开作品", "Create public work")}</h1>
      <p class="lede">${tr(
        "保存只进入发布流程域。只有公开预览、二次确认并审核通过后，作品才会出现在发现页。",
        "Saving only creates publication-process data. A work appears in Discover only after preview, second confirmation, and approval.",
      )}</p>
      <form id="workEditor" class="form-grid" data-version-id="${escapeHtml(record.version_id || "")}" data-work-id="${escapeHtml(record.work_id || "")}" data-revision="${Number(record.revision || 1)}">
        <label class="field full"><span>${tr("标题", "Title")} *</span><input name="title" maxlength="120" required value="${escapeHtml(record.title || "")}" /></label>
        <label class="field full"><span>${tr("一句话用途/简介", "One-line purpose / summary")} *</span><input name="summary" maxlength="300" required value="${escapeHtml(record.summary || "")}" /></label>
        <label class="field"><span>${tr("内容类型", "Content type")}</span><select name="content_type">${Object.keys(CONTENT_TYPE_LABELS).map((value) => `<option value="${value}" ${record.content_type === value ? "selected" : ""}>${contentTypeLabel(value)}</option>`).join("")}</select></label>
        <label class="field"><span>${tr("授权类型", "License")}</span><select name="license_code">${Object.keys(LICENSE_LABELS).map((value) => `<option value="${value}" ${record.license_code === value ? "selected" : ""}>${licenseLabel(value)}</option>`).join("")}</select></label>
        <label class="field full"><span>${tr("完整 Prompt", "Full Prompt")} *</span><textarea class="prompt-input" name="prompt_text" required placeholder="${tr("使用 {{变量名}} 插入可修改变量", "Use {{variable}} to insert an editable variable")}">${escapeHtml(record.prompt_text || "")}</textarea><small>${tr("示例：一张 {{主体}} 的电影感画面，使用 {{光线}}。", "Example: A cinematic image of {{subject}}, using {{lighting}}.")}</small></label>
        <div class="field full"><span>${tr("变量与默认值", "Variables and defaults")}</span><div class="variable-list" id="variableList">${variables.map(renderVariableEditorRow).join("")}</div><button class="button" type="button" data-add-variable>${tr("添加变量", "Add variable")}</button></div>
        <label class="field"><span>${tr("模型", "Model")}</span><input name="model_name" maxlength="120" value="${escapeHtml(record.model_name || "")}" placeholder="${tr("例如 Midjourney", "e.g. Midjourney")}" /></label>
        <label class="field"><span>${tr("模型版本", "Model version")}</span><input name="model_version" maxlength="120" value="${escapeHtml(record.model_version || "")}" placeholder="${tr("例如 v7", "e.g. v7")}" /></label>
        <label class="field full"><span>${tr("基础参数", "Parameters")}</span><textarea name="parameters" placeholder="${tr("每行一个，例如：aspect_ratio=16:9", "One per line, e.g. aspect_ratio=16:9")}">${escapeHtml(formatKeyValueLines(record.parameters))}</textarea></label>
        <label class="field full"><span>${tr("标签", "Tags")}</span><input name="tags" value="${escapeHtml((record.tags || []).join("，"))}" placeholder="${tr("电影感，角色设计，光影", "cinematic, character design, lighting")}" /></label>
        <div class="actions field full">
          <button class="button" type="submit" name="intent" value="save">${tr("保存草稿", "Save draft")}</button>
          <button class="button primary" type="submit" name="intent" value="preview">${tr("保存并公开预览", "Save & preview")}</button>
          <a class="button" href="#/my-publications">${tr("返回我的发布", "Back to My Works")}</a>
        </div>
      </form>
    </section>`;
}

function renderVariableEditorRow(item = {}) {
  return `<div class="variable-row">
    <input data-variable-name value="${escapeHtml(item.name || "")}" placeholder="${tr("变量名", "Variable name")}" aria-label="${tr("变量名", "Variable name")}" />
    <input data-variable-default value="${escapeHtml(item.defaultValue || "")}" placeholder="${tr("默认值", "Default value")}" aria-label="${tr("变量默认值", "Variable default value")}" />
    <button class="icon-button" type="button" data-remove-variable aria-label="${tr("删除变量", "Remove variable")}">×</button>
  </div>`;
}

function bindVariableEditor(root) {
  const list = root.querySelector("#variableList");
  root.querySelector("[data-add-variable]").addEventListener("click", () => {
    list.insertAdjacentHTML("beforeend", renderVariableEditorRow());
  });
  list.addEventListener("click", (event) => {
    if (event.target.matches("[data-remove-variable]")) event.target.closest(".variable-row").remove();
  });
}

function collectEditor(form) {
  const data = new FormData(form);
  const variables = [...form.querySelectorAll(".variable-row")].map((row) => ({
    name: row.querySelector("[data-variable-name]").value.trim(),
    defaultValue: row.querySelector("[data-variable-default]").value.trim(),
  })).filter((item) => item.name);
  return {
    p_title: data.get("title"), p_summary: data.get("summary"),
    p_content_type: data.get("content_type"), p_prompt_text: data.get("prompt_text"),
    p_variables: variables, p_model_name: data.get("model_name"),
    p_model_version: data.get("model_version"), p_parameters: parseKeyValueLines(data.get("parameters")),
    p_tags: parseTags(data.get("tags")), p_license_code: data.get("license_code"),
  };
}

async function saveEditor(form) {
  const payload = collectEditor(form);
  const versionId = form.dataset.versionId;
  if (!versionId) {
    const result = firstRow(await rpc("yucang_create_work", payload));
    form.dataset.versionId = result.version_id;
    form.dataset.workId = result.work_id;
    form.dataset.revision = "1";
    return result.version_id;
  }
  const revision = await rpc("yucang_update_draft", {
    p_version_id: versionId,
    p_expected_revision: Number(form.dataset.revision),
    ...payload,
  });
  form.dataset.revision = String(revision);
  return versionId;
}

async function renderEditor(versionId = "") {
  if (!requireCreator()) return;
  app.innerHTML = `<section class="loading-state"><span class="spinner"></span><p>${tr("正在打开发布草稿…", "Opening publication draft…")}</p></section>`;
  try {
    const record = versionId ? firstRow(await rpc("yucang_get_my_version", { p_version_id: versionId })) : {};
    if (versionId && !record) throw new Error(tr("没有找到可访问的版本。", "No accessible version was found."));
    if (record?.status && record.status !== "draft") throw new Error(tr("当前版本不处于可编辑 draft 状态。", "The current version is not an editable draft."));
    app.innerHTML = editorMarkup(record || {});
    const form = app.querySelector("#workEditor");
    bindVariableEditor(form);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = event.submitter;
      setBusy(button, true, button.value === "preview" ? tr("正在生成预览…", "Preparing preview…") : tr("正在保存…", "Saving…"));
      try {
        const savedVersionId = await saveEditor(form);
        notify(tr("草稿已保存", "Draft saved"));
        if (button.value === "preview") go(`preview/${savedVersionId}`);
        else if (!versionId) go(`publish/${savedVersionId}`);
      } catch (error) {
        notify(error.message);
      } finally {
        setBusy(button, false);
      }
    });
  } catch (error) {
    renderError(error, tr("无法打开发布草稿", "Unable to open publication draft"));
  }
}

function snapshotDetail(view, { includePrompt = true } = {}) {
  return `
    <div class="detail-meta">
      <span class="pill accent">${escapeHtml(contentTypeLabel(view.content_type))}</span>
      <span class="pill">v${view.version_no}</span>
      <span class="pill">${escapeHtml(licenseLabel(view.license_code))}</span>
    </div>
    <h1>${escapeHtml(view.title)}</h1>
    <p class="lede">${escapeHtml(view.summary)}</p>
    <dl class="data-list">
      <div><dt>${tr("作者", "Author")}</dt><dd>${escapeHtml(view.author_nickname || state.access?.nickname || "—")}</dd></div>
      <div><dt>${tr("模型", "Model")}</dt><dd>${escapeHtml([view.model_name, view.model_version].filter(Boolean).join(" · ") || "—")}</dd></div>
      <div><dt>${tr("参数", "Parameters")}</dt><dd>${escapeHtml(formatKeyValueLines(view.parameters) || "—").replaceAll("\n", "<br>")}</dd></div>
      <div><dt>${tr("标签", "Tags")}</dt><dd><span class="tag-list">${(view.tags || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("") || "—"}</span></dd></div>
      <div><dt>${tr("授权", "License")}</dt><dd>${escapeHtml(licenseLabel(view.license_code))}</dd></div>
    </dl>
    ${includePrompt ? `<h2 style="margin-top:30px">${tr("完整 Prompt", "Full Prompt")}</h2><pre class="prompt-output">${escapeHtml(view.prompt_text)}</pre>` : ""}`;
}

async function renderPreview(versionId) {
  if (!requireCreator()) return;
  app.innerHTML = `<section class="loading-state"><span class="spinner"></span><p>${tr("正在生成冻结预览…", "Preparing frozen preview…")}</p></section>`;
  try {
    const preview = firstRow(await rpc("yucang_prepare_preview", { p_version_id: versionId }));
    if (!preview) throw new Error(tr("无法生成预览。", "Unable to prepare preview."));
    const view = snapshotToViewModel(preview.snapshot);
    app.innerHTML = `
      <section class="panel">
        <p class="eyebrow">PUBLIC PREVIEW · SECOND CONFIRMATION</p>
        <div class="detail-header">${snapshotDetail(view)}</div>
        <label class="confirm-box">
          <input type="checkbox" data-confirm-publish />
          <span>${tr(
            "我确认以上全部内容将作为冻结的待审核版本提交。审核期间不能直接修改；只有审核通过后才会公开。",
            "I confirm that all content above will be submitted as a frozen version for review. It cannot be edited during review and becomes public only after approval.",
          )}</span>
        </label>
        <div class="actions">
          <button class="button primary" type="button" data-submit-review disabled>${tr("确认并提交审核", "Confirm & submit")}</button>
          <a class="button" href="#/publish/${encodeURIComponent(versionId)}">${tr("返回修改", "Back to edit")}</a>
        </div>
      </section>`;
    const checkbox = app.querySelector("[data-confirm-publish]");
    const button = app.querySelector("[data-submit-review]");
    checkbox.addEventListener("change", () => { button.disabled = !checkbox.checked; });
    button.addEventListener("click", async () => {
      setBusy(button, true, tr("正在冻结并提交…", "Freezing and submitting…"));
      try {
        await rpc("yucang_submit_for_review", {
          p_version_id: versionId,
          p_expected_hash: preview.content_hash,
        });
        notify(tr("已提交审核，版本内容现已冻结。", "Submitted for review. The version is now frozen."));
        go("my-publications");
      } catch (error) {
        notify(error.message);
        setBusy(button, false);
      }
    });
  } catch (error) {
    renderError(error, tr("无法生成公开预览", "Unable to prepare public preview"));
  }
}

async function renderMyPublications() {
  if (!requireCreator()) return;
  app.innerHTML = `<section class="loading-state"><span class="spinner"></span><p>${tr("正在读取我的发布…", "Loading My Works…")}</p></section>`;
  try {
    const items = await rpc("yucang_list_my_publications");
    app.innerHTML = `
      <section>
        <div class="section-head"><div><p class="eyebrow">CREATOR STUDIO</p><h1 style="font-size:52px">${tr("我的发布", "My Works")}</h1></div><a class="button primary" href="#/publish/new">${tr("新建公开作品", "Create public work")}</a></div>
        ${items.length ? `<div class="table-list">${items.map((item) => `
          <article class="table-row">
            <div><span class="status">${escapeHtml(item.version_status)}</span><h3>${escapeHtml(item.title || tr("未命名草稿", "Untitled draft"))}</h3><p>v${item.version_no} · ${escapeHtml(item.summary || tr("暂无简介", "No description"))} · ${formatDate(item.updated_at)}</p></div>
            <div class="actions" style="margin:0">
              ${item.version_status === "draft" ? `<a class="button" href="#/publish/${item.version_id}">${tr("编辑", "Edit")}</a><a class="button primary" href="#/preview/${item.version_id}">${tr("预览提交", "Preview & submit")}</a>` : ""}
              ${item.version_status === "pending_review" ? `<button class="button" type="button" data-withdraw="${item.version_id}">${tr("撤回审核", "Withdraw review")}</button>` : ""}
              ${item.version_status === "changes_requested" ? `<button class="button" type="button" data-reopen="${item.version_id}">${tr("继续修改", "Continue editing")}</button>` : ""}
              ${item.version_status === "approved" && item.current_public_version_id === item.version_id ? `<a class="button" href="#/prompt/${item.work_id}">${tr("查看公开页", "View public page")}</a>` : ""}
            </div>
          </article>`).join("")}</div>` : `<div class="empty-state"><h3>${tr("还没有发布流程", "No publication flow yet")}</h3><p>${tr("从新建公开作品开始。", "Start by creating a public work.")}</p></div>`}
      </section>`;
    app.querySelectorAll("[data-withdraw]").forEach((button) => button.addEventListener("click", async () => {
      setBusy(button, true);
      try {
        await rpc("yucang_withdraw_review", { p_version_id: button.dataset.withdraw });
        notify(tr("审核已撤回，版本回到 draft。", "Review withdrawn. The version is back in draft."));
        renderMyPublications();
      } catch (error) { notify(error.message); setBusy(button, false); }
    }));
    app.querySelectorAll("[data-reopen]").forEach((button) => button.addEventListener("click", async () => {
      setBusy(button, true);
      try {
        await rpc("yucang_reopen_changes", { p_version_id: button.dataset.reopen });
        go(`publish/${button.dataset.reopen}`);
      } catch (error) { notify(error.message); setBusy(button, false); }
    }));
  } catch (error) {
    renderError(error, tr("无法读取我的发布", "Unable to load My Works"));
  }
}

function officialResourceVariables(item) {
  return (item.variables || []).map((entry) => ({
    name: String(entry.name || "").trim(),
    label: String(entry.label || entry.name || "").trim(),
    placeholder: String(entry.placeholder || "").trim(),
    defaultValue: String(entry.default ?? "").trim(),
  })).filter((entry) => entry.name);
}

function bindPromptTool({ template, variables, output, copyButton }) {
  const values = Object.fromEntries(variables.map((entry) => [
    entry.name,
    entry.defaultValue || `@${entry.name}`,
  ]));
  const update = () => {
    output.textContent = renderPromptTemplate(template, variables, values);
  };
  app.querySelectorAll("[data-variable-value]").forEach((input) => { input.oninput = () => {
    values[input.dataset.variableValue] = input.value || `@${input.dataset.variableValue}`;
    update();
  }; });
  copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(output.textContent);
      copyButton.textContent = tr("已复制", "Copied");
      notify(tr("Prompt 已复制", "Prompt copied"));
      setTimeout(() => { copyButton.textContent = tr("复制 Prompt", "Copy Prompt"); }, 1600);
    } catch {
      const range = document.createRange();
      range.selectNodeContents(output);
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      notify(tr(
        "浏览器未授权剪贴板，已选中文本，请手动复制。",
        "Clipboard access was blocked. The Prompt is selected for manual copying.",
      ));
    }
  });
  update();
}

function renderOfficialResource(item) {
  const variables = officialResourceVariables(item);
  app.innerHTML = `
    <section class="resource-detail-head">
      <a class="back-link" href="#/discover">${tr("返回提示词库", "Back to Prompt Library")}</a>
      <div class="detail-meta">
        <span class="pill accent">${escapeHtml(resourceCategoryLabel(item.category))}</span>
        <span class="pill">${tr("站方模板", "Official template")}</span>
      </div>
      <h1>${escapeHtml(item.title)}</h1>
      <p>${escapeHtml(item.summary)}</p>
      <dl class="resource-facts">
        <div><dt>${tr("模型", "Model")}</dt><dd>${escapeHtml(item.model || tr("通用模型", "General model"))}</dd></div>
        <div><dt>${tr("来源", "Source")}</dt><dd>${escapeHtml(item.sourceName || tr("语藏", "Yucang"))}</dd></div>
        <div><dt>${tr("授权", "License")}</dt><dd>${escapeHtml(item.license || tr("请查看发布说明", "See publishing terms"))}</dd></div>
      </dl>
    </section>
    <section class="resource-use-layout">
      <div class="resource-variable-panel">
        <div class="tool-heading">
          <h2>${tr("修改变量", "Adjust variables")}</h2>
          <p>${tr("输入内容后，右侧 Prompt 会立即更新。", "The Prompt updates as you type.")}</p>
        </div>
        <div class="resource-variable-list">
          ${variables.length ? variables.map((entry) => `
            <label class="resource-variable">
              <span>${escapeHtml(entry.label)}</span>
              <input data-variable-value="${escapeHtml(entry.name)}" value="${escapeHtml(entry.defaultValue)}" placeholder="${escapeHtml(entry.placeholder)}" />
            </label>`).join("") : `<p class="lede">${tr("这条 Prompt 没有变量，可以直接复制。", "This Prompt has no variables and can be copied directly.")}</p>`}
        </div>
      </div>
      <aside class="prompt-stage">
        <div class="tool-heading">
          <div><h2>${tr("最终 Prompt", "Final Prompt")}</h2><p>${escapeHtml(item.usage || tr("检查内容后直接复制使用。", "Review, then copy and use."))}</p></div>
          <div class="prompt-actions"><button class="button" type="button" data-save-to-vault="${escapeHtml(item.id)}">${tr("收进 Prompt Vault", "Save to Prompt Vault")}</button><button class="button primary" type="button" data-copy-prompt>${tr("复制 Prompt", "Copy Prompt")}</button></div>
        </div>
        <pre class="prompt-output resource-prompt-output" data-final-prompt></pre>
        <div class="resource-tags">${(item.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
      </aside>
    </section>`;
  bindPromptTool({
    template: item.prompt,
    variables,
    output: app.querySelector("[data-final-prompt]"),
    copyButton: app.querySelector("[data-copy-prompt]"),
  });
  bindPromptVaultButtons(app, () => officialPromptPayload(item));
}

async function renderPublicPrompt(workId) {
  app.innerHTML = `<section class="loading-state"><span class="spinner"></span><p>${tr("正在读取 Prompt...", "Loading Prompt...")}</p></section>`;
  try {
    const resources = await loadResources();
    const officialResource = resources.find((item) => item.id === workId);
    if (officialResource) {
      renderOfficialResource(officialResource);
      return;
    }
    const item = firstRow(await rpc("yucang_get_public_work", { p_work_id: workId }));
    if (!item) throw new Error(tr(
      "作品不存在、尚未审核通过或当前不可公开访问。",
      "This work does not exist, is not approved, or is not publicly accessible.",
    ));
    const variables = normalizeVariables(item.variables);
    app.innerHTML = `
      <section class="detail-header">
        <p class="eyebrow">PUBLIC PROMPT · APPROVED CURRENT VERSION</p>
        ${snapshotDetail(item, { includePrompt: false })}
      </section>
      <section class="split-layout">
        <div class="panel">
          <h2>${tr("修改变量", "Adjust variables")}</h2>
          <p class="lede">${tr("变量只在当前页面生成最终 Prompt，不会修改公开版本。", "Variables only change the generated Prompt on this page; the public version stays unchanged.")}</p>
          <div class="form-grid" data-variable-inputs>
            ${variables.length ? variables.map((entry) => `<label class="field"><span>${escapeHtml(entry.name)}</span><input data-variable-value="${escapeHtml(entry.name)}" value="${escapeHtml(entry.defaultValue)}" /></label>`).join("") : `<p class="lede field full">${tr("这个 Prompt 没有声明变量，可直接复制。", "This Prompt has no declared variables and can be copied directly.")}</p>`}
          </div>
        </div>
        <aside class="panel sticky-panel">
          <div class="section-head"><div><p class="eyebrow">FINAL PROMPT</p><h2>${tr("最终 Prompt", "Final Prompt")}</h2></div></div>
          <pre class="prompt-output" data-final-prompt></pre>
          <div class="prompt-actions" style="margin-top:16px"><button class="button" type="button" data-save-to-vault="${escapeHtml(item.work_id)}">${tr("收进 Prompt Vault", "Save to Prompt Vault")}</button><button class="button primary" type="button" data-copy-prompt>${tr("复制 Prompt", "Copy Prompt")}</button></div>
        </aside>
      </section>`;
    bindPromptTool({
      template: item.prompt_text,
      variables,
      output: app.querySelector("[data-final-prompt]"),
      copyButton: app.querySelector("[data-copy-prompt]"),
    });
    bindPromptVaultButtons(app, () => communityPromptPayload(item));
  } catch (error) {
    renderError(error, tr("无法打开 Prompt", "Unable to open Prompt"));
  }
}

async function bootstrapAdmin(event) {
  const button = event?.currentTarget;
  setBusy(button, true);
  try {
    await rpc("yucang_bootstrap_admin");
    await loadAccess();
    renderHeader();
    notify(tr("语藏首位管理员已初始化。", "The first Yucang administrator is initialized."));
    go("admin/review");
  } catch (error) {
    notify(error.message);
    setBusy(button, false);
  }
}

async function renderAdminReview() {
  if (!requireLogin()) return;
  if (!(state.access?.is_admin || state.access?.is_reviewer)) {
    requireStaff();
    return;
  }
  app.innerHTML = `<section class="loading-state"><span class="spinner"></span><p>${tr("正在读取审核队列…", "Loading review queue…")}</p></section>`;
  try {
    const items = await rpc("yucang_admin_list_pending");
    app.innerHTML = `
      <section class="split-layout">
        <div>
          <div class="section-head"><div><p class="eyebrow">REVIEW QUEUE</p><h1 style="font-size:52px">${tr("待审核", "Pending review")}</h1></div><span class="status">${items.length} ${tr("项", "items")}</span></div>
          ${items.length ? `<div class="table-list">${items.map((item) => `
            <article class="table-row"><div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.author_nickname)} · v${item.version_no} · ${formatDate(item.submitted_at)}</p></div><a class="button primary" href="#/admin/review/${item.submission_id}">${tr("打开审核", "Open review")}</a></article>`).join("")}</div>` : `<div class="empty-state"><h3>${tr("审核队列为空", "Review queue is empty")}</h3><p>${tr("创作者二次确认并提交后，会出现在这里。", "Creator submissions appear here after second confirmation.")}</p></div>`}
        </div>
        ${state.access?.is_admin ? `
          <aside class="panel sticky-panel">
            <p class="eyebrow">ADMIN</p><h2>${tr("赋予创作者资格", "Grant creator access")}</h2>
            <form id="grantCreator" class="form-grid">
              <label class="field full"><span>${tr("已有账号邮箱", "Existing account email")}</span><input name="email" type="email" required /></label>
              <label class="field full"><span>${tr("公开昵称", "Public nickname")}</span><input name="nickname" required maxlength="40" /></label>
              <label class="field full"><span>${tr("作者 slug", "Creator slug")}</span><input name="slug" required pattern="[a-z0-9][a-z0-9-]{1,62}[a-z0-9]" placeholder="visual-creator" /></label>
              <button class="button primary field full" type="submit">${tr("赋予资格", "Grant access")}</button>
            </form>
          </aside>` : ""}
      </section>`;
    const grantForm = app.querySelector("#grantCreator");
    grantForm?.addEventListener("submit", async (event) => {
      event.preventDefault(); const button = event.submitter; setBusy(button, true);
      const data = new FormData(event.currentTarget);
      try {
        await rpc("yucang_admin_grant_creator", {
          p_email: data.get("email"), p_nickname: data.get("nickname"), p_slug: data.get("slug"),
        });
        notify(tr("创作者资格已生效。", "Creator access granted.")); event.currentTarget.reset();
        if (data.get("email") === state.session.user.email) { await loadAccess(); renderHeader(); }
      } catch (error) { notify(error.message); } finally { setBusy(button, false); }
    });
  } catch (error) {
    renderError(error, tr("无法打开审核后台", "Unable to open review workspace"));
  }
}

async function renderSubmission(submissionId) {
  if (!requireStaff()) return;
  app.innerHTML = `<section class="loading-state"><span class="spinner"></span><p>${tr("正在读取冻结 submission…", "Loading frozen submission…")}</p></section>`;
  try {
    const item = firstRow(await rpc("yucang_admin_get_submission", { p_submission_id: submissionId }));
    if (!item) throw new Error(tr("Submission 不存在或不可访问。", "Submission does not exist or is inaccessible."));
    const view = snapshotToViewModel(item.snapshot);
    app.innerHTML = `
      <section class="split-layout">
        <div class="panel review-snapshot">
          <p class="eyebrow">FROZEN SUBMISSION · ${escapeHtml(item.content_hash.slice(0, 12))}</p>
          ${snapshotDetail(view)}
        </div>
        <aside class="panel sticky-panel">
          <p class="eyebrow">REVIEW ACTION</p><h2>${tr("审核决定", "Review decision")}</h2>
          <p class="lede">${tr("审核员只能决定结果，不能修改创作者 Prompt。", "Reviewers can decide the outcome but cannot edit the creator's Prompt.")}</p>
          <label class="field"><span>${tr("审核原因/说明", "Reason / notes")}</span><textarea data-review-reason placeholder="${tr("要求修改或拒绝时请说明原因", "A reason is required for changes or rejection")}"></textarea></label>
          <div class="actions">
            <button class="button primary" type="button" data-review-action="approved">${tr("通过并公开", "Approve & publish")}</button>
            <button class="button" type="button" data-review-action="changes_requested">${tr("要求修改", "Request changes")}</button>
            <button class="button danger" type="button" data-review-action="rejected">${tr("拒绝", "Reject")}</button>
          </div>
        </aside>
      </section>`;
    app.querySelectorAll("[data-review-action]").forEach((button) => button.addEventListener("click", async () => {
      const action = button.dataset.reviewAction;
      const reason = app.querySelector("[data-review-reason]").value.trim();
      if (action !== "approved" && !reason) return notify(tr("要求修改或拒绝时必须填写原因。", "A reason is required for changes or rejection."));
      setBusy(button, true, action === "approved" ? tr("正在批准并公开…", "Approving and publishing…") : tr("正在提交决定…", "Submitting decision…"));
      try {
        await rpc("yucang_review_submission", {
          p_submission_id: submissionId, p_action: action, p_reason: reason,
        });
        notify(action === "approved"
          ? tr("审核通过，作品已成为真实公开数据。", "Approved. The work is now live public data.")
          : tr("审核结果已保存。", "Review decision saved."));
        go("admin/review");
      } catch (error) { notify(error.message); setBusy(button, false); }
    }));
  } catch (error) {
    renderError(error, tr("无法读取审核 submission", "Unable to load review submission"));
  }
}

async function renderRoute() {
  const [section, id] = routeParts();
  state.homeOrbitCleanup?.();
  state.homeOrbitCleanup = null;
  const homeRoute = section === "home" || section === "login";
  document.body.classList.toggle("route-home", homeRoute);
  document.body.classList.toggle("route-login", section === "login" && !state.session);
  document.querySelectorAll(".main-nav a").forEach((link) => {
    link.removeAttribute("aria-current");
    if (link.getAttribute("href") === `#/${section}`) link.setAttribute("aria-current", "page");
  });
  app.focus({ preventScroll: true });
  if (section === "home") return renderHome();
  if (section === "discover") return renderDiscover();
  if (section === "login") return renderLogin();
  if (section === "prompt" && id) return renderPublicPrompt(id);
  if (section === "publish" && id === "new") return renderEditor();
  if (section === "publish" && id) return renderEditor(id);
  if (section === "preview" && id) return renderPreview(id);
  if (section === "my-publications") return renderMyPublications();
  if (section === "admin" && id === "review" && routeParts()[2]) return renderSubmission(routeParts()[2]);
  if (section === "admin" && id === "review") return renderAdminReview();
  renderError(new Error(tr("页面不存在。", "Page not found.")), tr("没有找到这个页面", "Page not found"));
}

async function initialize() {
  try {
    updateStaticLocale();
    localeToggle.addEventListener("click", () => {
      setLocale(state.locale === "en" ? "zh" : "en");
    });
    const client = getClient();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    state.session = data.session;
    if (!state.session) {
      const extensionSession = await promptVaultWebsiteAuthBridge.signInFromExtension();
      if (extensionSession) {
        const { data: sessionData, error: sessionError } = await client.auth.setSession({
          access_token: extensionSession.access_token,
          refresh_token: extensionSession.refresh_token,
        });
        if (sessionError) throw sessionError;
        state.session = sessionData.session;
      }
    }
    await loadAccess();
    state.authReady = true;
    renderHeader();
    client.auth.onAuthStateChange((_event, session) => {
      state.session = session;
      setTimeout(async () => {
        await loadAccess();
        renderHeader();
      }, 0);
    });
    await renderRoute();
  } catch (error) {
    renderError(error, tr("语藏初始化失败", "Yucang failed to initialize"));
  }
}

window.addEventListener("hashchange", renderRoute);
window.addEventListener("DOMContentLoaded", initialize, { once: true });
