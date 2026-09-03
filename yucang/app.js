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
  applyLastLoginHint,
  bindLoginConsent,
  bindLoginShowcase,
  loginControlsMarkup,
  loginExperienceMarkup,
} from "../auth/login-experience.js";
import { createPromptVaultBridge } from "./prompt-vault-bridge.mjs?v=20260825-import1";
import { createPromptVaultWebsiteAuthBridge } from "./prompt-vault-auth-bridge.mjs?v=20260825-sso1";
import { createPromptVaultPublishBridge } from "./prompt-vault-publish-bridge.mjs?v=20260826-handoff2";
import {
  loadAccountProfile,
  openAccountProfileEditor,
  profileAvatarMarkup,
} from "./account-profile.mjs?v=20260826-profile1";
import {
  commentsSectionMarkup,
  notificationPanelMarkup,
} from "./interactions.mjs?v=20260902-governance1";

const app = document.getElementById("app");
const accountActions = document.getElementById("accountActions");
const accountDrawer = document.getElementById("accountDrawer");
const toast = document.getElementById("toast");
const localeToggle = document.querySelector("[data-locale-toggle]");
const themeToggle = document.querySelector("[data-theme-toggle]");
const promptVaultBridge = createPromptVaultBridge();
const promptVaultWebsiteAuthBridge = createPromptVaultWebsiteAuthBridge();
const promptVaultPublishBridge = createPromptVaultPublishBridge();
const HANDOFF_DRAFT_ENDPOINT = "https://zbcdmtjmqpwtevjaewtl.supabase.co/functions/v1/yucang-create-handoff-draft";
const VERSION_MEDIA_ENDPOINT = "https://zbcdmtjmqpwtevjaewtl.supabase.co/functions/v1/yucang-version-media";
const ACCOUNT_PROFILE_ENDPOINT = "https://zbcdmtjmqpwtevjaewtl.supabase.co/functions/v1/yucang-update-profile";

const RESOURCE_CATEGORY_LABELS = Object.freeze({
  all: ["全部", "All"],
  image: ["图像", "Image"],
  video: ["视频", "Video"],
  "text-office": ["文字与办公", "Text & Office"],
  writing: ["写作", "Writing"],
  office: ["办公", "Office"],
  coding: ["编程", "Coding"],
});
const RESOURCE_CATEGORY_ORDER = ["all", "image", "video", "text-office", "coding"];
const HOME_FEATURED_ART = Object.freeze([
  { src: "assets/featured/mushroom-city-1.webp", promptId: "image-mushroom-city", title: "蘑菇城", titleEn: "Mushroom City", likes: 0, size: 1.18, phase: .03, speed: .082, lane: 1.02, lift: -12 },
  { src: "assets/featured/mushroom-city-2.webp", promptId: "image-mushroom-realm", title: "蘑菇城秘境", titleEn: "Mushroom Realm", likes: 0, size: .82, phase: .10, speed: .112, lane: .9, lift: 14 },
  { src: "assets/featured/abstract-expression.webp", promptId: "image-abstract-expression", title: "抽象表现主义", titleEn: "Abstract Expression", likes: 0, size: .78, phase: .17, speed: .11, lane: .91, lift: 18 },
  { src: "assets/featured/knight-medieval.webp", promptId: "image-medieval-knight", title: "骑士回中世纪", titleEn: "Medieval Knight", likes: 0, size: 1.04, phase: .29, speed: .094, lane: 1.05, lift: -20 },
  { src: "assets/featured/watercolor-dessert.webp", promptId: "image-ink-watercolor-dessert", title: "钢笔水彩手绘", titleEn: "Ink & Watercolor", likes: 0, size: .72, phase: .44, speed: .122, lane: .87, lift: 8 },
  { src: "assets/featured/embroidered-mountain.webp", promptId: "image-embroidered-landscape", title: "刺绣山水", titleEn: "Embroidered Landscape", likes: 0, size: 1.22, phase: .57, speed: .086, lane: 1, lift: -8 },
  { src: "assets/featured/litian-demon.webp", promptId: "image-celestial-demon", title: "庶天妖", titleEn: "Celestial Demon", likes: 0, size: .84, phase: .69, speed: .106, lane: .92, lift: 22 },
  { src: "assets/featured/dark-gothic.webp?v=20260903-mvp5", promptId: "image-dark-gothic", title: "暗黑哥特风", titleEn: "Dark Gothic", likes: 0, size: 1.08, phase: .82, speed: .09, lane: 1.06, lift: -18 },
  { src: "assets/featured/particle-poster.webp?v=20260903-mvp5", promptId: "image-particle-poster", title: "粒子海报", titleEn: "Particle Poster", likes: 0, size: .76, phase: .94, speed: .116, lane: .89, lift: 12 },
  { src: "assets/featured/neon-action.webp", promptId: "image-neon-action", title: "霓虹动作场景", titleEn: "Neon Action", likes: 0, size: .9, phase: .37, speed: .098, lane: .96, lift: 24 },
  { src: "assets/featured/cosmic-eye.webp", promptId: "image-cosmic-eye", title: "宇宙之眼", titleEn: "Cosmic Eye", likes: 0, size: .7, phase: .63, speed: .126, lane: .86, lift: -6 },
  { src: "assets/featured/ink-character.webp", promptId: "image-ink-character", title: "黑白人物", titleEn: "Ink Character", likes: 0, size: .8, phase: .75, speed: .102, lane: 1.04, lift: 6 },
]);

const state = {
  client: null,
  session: null,
  access: null,
  profile: null,
  notificationUnread: 0,
  authReady: false,
  resources: null,
  homeOrbitCleanup: null,
  publishHandoff: null,
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
    creators: tr("创作者", "Creators"),
  };
  Object.entries(navLabels).forEach(([key, label]) => {
    const link = document.querySelector(`[data-nav="${key}"]`);
    if (link) link.textContent = label;
  });
  const staffLink = document.querySelector("[data-staff-link]");
  if (staffLink) staffLink.textContent = tr("管理", "Manage");
  const vaultLink = document.querySelector("[data-prompt-vault-link]");
  if (vaultLink) vaultLink.textContent = tr("安装 Prompt Vault", "Get Prompt Vault");
  localeToggle.textContent = en ? "中" : "EN";
  localeToggle.setAttribute("aria-label", en ? "切换到中文" : "Switch to English");
  updateThemeToggle();
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

function publicAssetUrl(value) {
  if (!value) return "";
  try {
    return new URL(value, `${location.origin}${location.pathname}`).toString();
  } catch {
    return "";
  }
}

function mediaGalleryMarkup(images, label = tr("作品图片", "Work images")) {
  if (!images?.length) return "";
  return `<div class="publication-media" aria-label="${escapeHtml(label)}">${images.map((item, index) => {
    const url = typeof item === "string" ? item : item.url;
    return `<figure><img src="${escapeHtml(url)}" alt="${escapeHtml(`${label} ${index + 1}`)}" loading="lazy" decoding="async" /></figure>`;
  }).join("")}</div>`;
}

async function loadVersionMedia(versionId) {
  if (!versionId) return [];
  const headers = {
    "apikey": window.ZaiyeSupabase.config.publishableKey,
    "Content-Type": "application/json",
  };
  if (state.session?.access_token) headers.Authorization = `Bearer ${state.session.access_token}`;
  const response = await fetch(VERSION_MEDIA_ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({ versionId }),
  });
  if (!response.ok) return [];
  const result = await response.json().catch(() => ({}));
  return result.ok && Array.isArray(result.images) ? result.images : [];
}

function resolvedOfficialPrompt(item) {
  const variables = officialResourceVariables(item);
  const values = Object.fromEntries(variables.map((entry) => [
    entry.name,
    entry.defaultValue || `@${entry.name}`,
  ]));
  return renderPromptTemplate(item.prompt, variables, values);
}

function officialPromptPayload(item, prompt = resolvedOfficialPrompt(item)) {
  return {
    title: item.title,
    prompt,
    image: publicAssetUrl(item.featuredImage),
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
    sourceVersionId: "official-library-v3",
    sourceUrl: publicPromptUrl(item.id),
    usageInstruction: item.usage || "",
    negative: item.negative || "",
    sourceCreator: item.sourceName || tr("语藏", "Yucang"),
  };
}

function communityPromptPayload(item, image = "") {
  return {
    title: item.title,
    prompt: item.prompt_text,
    image,
    project: tr("语藏社区", "Yucang Community"),
    category: item.content_type || "",
    type: item.content_type || "scene",
    tags: item.tags || [],
    variables: normalizeVariables(item.variables),
    model: item.model_name || "",
    modelVersion: item.model_version || "",
    basicParams: item.parameters || {},
    license: licenseLabel(item.license_code),
    negative: item.negative_prompt_text || "",
    usageInstruction: item.instructions || "",
    dependencies: item.dependencies || [],
    sourceWorkId: item.work_id,
    sourceVersionId: item.version_id,
    sourceUrl: publicPromptUrl(item.work_id),
    sourceCreator: item.author_nickname || "",
  };
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")), { once: true });
    reader.addEventListener("error", () => reject(reader.error || new Error("image_read_failed")), { once: true });
    reader.readAsDataURL(blob);
  });
}

async function portableVaultPayload(payload) {
  const image = String(payload?.image || "").trim();
  if (!image || /^data:image\/(?:png|jpeg|webp);base64,/i.test(image)) return payload;
  const response = await fetch(image, { cache: "force-cache" });
  if (!response.ok) throw new Error("image_download_failed");
  const blob = await response.blob();
  if (!/^image\/(?:png|jpeg|webp)$/i.test(blob.type) || blob.size > 5 * 1024 * 1024) {
    throw new Error("image_not_portable");
  }
  const portableImage = await blobToDataUrl(blob);
  if (!portableImage) throw new Error("image_read_failed");
  return { ...payload, image: portableImage };
}

async function savePromptToVault(button, payload) {
  setBusy(button, true, tr("正在收藏…", "Saving…"));
  let portablePayload;
  try {
    portablePayload = await portableVaultPayload(payload);
  } catch {
    setBusy(button, false);
    notify(tr("图片未能安全保存到扩展，请稍后重试。", "The image could not be saved safely. Try again later."));
    return;
  }
  const result = await promptVaultBridge.save(portablePayload);
  setBusy(button, false);
  if (result.ok && result.status === "created") {
    button.textContent = tr("已收藏", "Saved");
    button.disabled = true;
    notify(tr("已作为普通提示词收进 Prompt Vault。", "Saved as a regular Prompt Vault item."));
    return;
  }
  if (result.ok && result.status === "already_saved") {
    button.textContent = tr("已收藏", "Saved");
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
      button.title = connection.installed
        ? tr("收藏进扩展", "Save to the extension")
        : tr("安装 Prompt Vault 后收藏", "Install Prompt Vault to save");
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

function licenseRightsMarkup(code, { official = false, hasDependencies = false } = {}) {
  const commercial = official || ["commercial", "commercial_client"].includes(code);
  const client = code === "commercial_client";
  const rights = [
    [tr("收藏和复制", "Save and copy"), true],
    [tr("修改 Prompt", "Modify Prompt"), true],
    [tr("个人项目", "Personal projects"), true],
    [tr("商业项目", "Commercial projects"), commercial],
    [tr("客户项目", "Client projects"), client],
    [tr("团队共享", "Team sharing"), false],
    [tr("署名要求", "Attribution"), tr("按作品说明", "See work terms")],
    [tr("重新发布或转售 Prompt", "Republish or resell Prompt"), false],
  ];
  return `<section class="license-rights" aria-labelledby="licenseRightsTitle"><h2 id="licenseRightsTitle">${tr("授权范围", "License scope")}</h2><div>${rights.map(([label, allowed]) => `<span class="license-right"><strong>${escapeHtml(label)}</strong><small>${typeof allowed === "string" ? escapeHtml(allowed) : allowed ? tr("允许", "Allowed") : tr("不允许", "Not allowed")}</small></span>`).join("")}</div><p>${hasDependencies ? tr("仍需遵守页面列出的模型、LoRA、参考图和第三方素材许可。", "The listed model, LoRA, reference image, and third-party material licenses still apply.") : tr("不包含重新发布、转售或冒充原作者的权利。", "This does not permit republishing, resale, or impersonating the creator.")}</p></section>`;
}

function pageExitNavMarkup() {
  return `<nav class="page-exit-nav" aria-label="${tr("退出当前页面", "Leave this page")}">
    <a href="#/home">${tr("返回首页", "Back to home")}</a>
    <a href="#/discover">${tr("提示词库", "Prompt Library")}</a>
  </nav>`;
}

function resourceFavoriteKey(item) {
  return `${item.sourceKind === "community" ? "work" : "official"}:${item.id}`;
}

function postLoginPath(fallback = "home") {
  const pending = sessionStorage.getItem("yucangPostLoginPath");
  sessionStorage.removeItem("yucangPostLoginPath");
  return pending || fallback;
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

async function loadProfile() {
  if (!state.session) {
    state.profile = null;
    return;
  }
  const metadata = state.session.user.user_metadata || {};
  const fallback = {
    nickname: state.access?.nickname || metadata.full_name || metadata.name || state.session.user.email || tr("已登录", "Signed in"),
    avatarUrl: metadata.avatar_url || metadata.picture || "",
  };
  try {
    state.profile = await loadAccountProfile(getClient(), fallback);
  } catch (error) {
    state.profile = fallback;
    if (!isSchemaMissing(error)) console.error(error);
  }
}

function updateNotificationBadge() {
  const badge = accountActions.querySelector("[data-notification-count]");
  const button = accountActions.querySelector("[data-notification-toggle]");
  if (!badge || !button) return;
  const count = Number(state.notificationUnread || 0);
  badge.hidden = count < 1;
  badge.textContent = count > 99 ? "99+" : String(count);
  button.setAttribute("aria-label", count
    ? tr(`${count} 条未读互动通知`, `${count} unread notifications`)
    : tr("互动通知", "Notifications"));
}

async function refreshNotificationCount() {
  if (!state.session) return;
  try {
    state.notificationUnread = Number(await rpc("yucang_notification_unread_count")) || 0;
    updateNotificationBadge();
  } catch (error) {
    if (!isSchemaMissing(error)) console.error(error);
  }
}

async function toggleNotificationPanel() {
  const panel = accountActions.querySelector("[data-notification-panel]");
  const toggle = accountActions.querySelector("[data-notification-toggle]");
  if (!panel || !toggle) return;
  if (!panel.hidden) {
    panel.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    return;
  }
  panel.hidden = false;
  toggle.setAttribute("aria-expanded", "true");
  panel.innerHTML = `<p class="notification-empty">${tr("正在读取通知…", "Loading notifications…")}</p>`;
  try {
    const notifications = (await rpc("yucang_list_notifications", { p_limit: 20 })).map((item) => ({
      ...item,
      created_at_label: formatDate(item.created_at),
    }));
    panel.innerHTML = notificationPanelMarkup(notifications, state.locale);
    panel.querySelector("[data-notification-read-all]")?.addEventListener("click", async () => {
      await rpc("yucang_mark_all_notifications_read");
      state.notificationUnread = 0;
      updateNotificationBadge();
      panel.querySelectorAll(".notification-item.is-unread").forEach((item) => item.classList.remove("is-unread"));
      panel.querySelector("[data-notification-read-all]")?.remove();
    });
    panel.querySelectorAll("[data-notification-id]").forEach((item) => item.addEventListener("click", async () => {
      if (item.classList.contains("is-unread")) {
        await rpc("yucang_mark_notification_read", { p_notification_id: item.dataset.notificationId });
        state.notificationUnread = Math.max(0, state.notificationUnread - 1);
        updateNotificationBadge();
      }
      panel.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      go(`prompt/${item.dataset.notificationWork}/comment/${item.dataset.notificationComment}`);
    }));
  } catch (error) {
    panel.innerHTML = `<p class="notification-empty">${escapeHtml(tr("通知暂时无法读取。", "Notifications are temporarily unavailable."))}</p>`;
    if (!isSchemaMissing(error)) console.error(error);
  }
}

function renderHeader() {
  document.querySelectorAll("[data-staff-link]").forEach((item) => {
    item.hidden = !(state.access?.is_admin || state.access?.is_reviewer);
  });

  if (!state.session) {
    setAccountDrawer(false);
    accountActions.innerHTML = `<a class="button ghost" href="#/login">${tr("登录", "Sign in")}</a>`;
    return;
  }
  const profile = state.profile || {
    nickname: state.access?.nickname || state.session.user.user_metadata?.full_name || state.session.user.user_metadata?.name || tr("已登录", "Signed in"),
    avatarUrl: state.session.user.user_metadata?.avatar_url || state.session.user.user_metadata?.picture || "",
  };
  accountActions.innerHTML = `
    <div class="notification-shell">
      <button class="notification-toggle" type="button" data-notification-toggle aria-expanded="false" aria-haspopup="true" aria-label="${tr("互动通知", "Notifications")}">
        <span>${tr("通知", "Alerts")}</span>
        <span class="notification-count" data-notification-count hidden>0</span>
      </button>
      <div class="notification-panel" data-notification-panel hidden></div>
    </div>
    <button class="account-profile-button" type="button" data-account-drawer-toggle aria-expanded="${String(document.body.classList.contains("account-drawer-open"))}" aria-controls="accountDrawer" title="${tr("打开我的", "Open My account")}">
      ${profileAvatarMarkup(profile, state.locale)}
      <span class="account-copy">
        <strong>${escapeHtml(profile.nickname)}</strong>
      </span>
    </button>`;
  accountActions.querySelector("[data-notification-toggle]").addEventListener("click", toggleNotificationPanel);
  updateNotificationBadge();
  refreshNotificationCount();
  accountActions.querySelector("[data-account-drawer-toggle]").addEventListener("click", () => {
    setAccountDrawer(!document.body.classList.contains("account-drawer-open"));
  });
  renderAccountDrawer();
}

function openProfileEditorFromAccount() {
  const profile = state.profile || {
    nickname: state.access?.nickname || state.session?.user?.email || tr("已登录", "Signed in"),
    avatarUrl: "",
  };
  openAccountProfileEditor({
    client: getClient(),
    endpoint: ACCOUNT_PROFILE_ENDPOINT,
    locale: state.locale,
    profile,
    onSaved: async (saved) => {
      state.profile = saved;
      if (state.access) state.access.nickname = saved.nickname;
      renderHeader();
      renderAccountDrawer();
      notify(tr("账号资料已更新。", "Account profile updated."));
    },
  });
}

function setAccountDrawer(open) {
  const visible = Boolean(open && state.session);
  document.body.classList.toggle("account-drawer-open", visible);
  accountDrawer.hidden = !visible;
  accountDrawer.setAttribute("aria-hidden", String(!visible));
  accountActions.querySelector("[data-account-drawer-toggle]")?.setAttribute("aria-expanded", String(visible));
}

function renderAccountDrawer() {
  if (!state.session) {
    accountDrawer.innerHTML = "";
    setAccountDrawer(false);
    return;
  }
  const profile = state.profile || {
    nickname: state.access?.nickname || state.session.user.email || tr("已登录", "Signed in"),
    avatarUrl: "",
  };
  accountDrawer.innerHTML = `
    <div class="account-drawer-head">
      <strong>${tr("我的", "My Yucang")}</strong>
      <button class="icon-button" type="button" data-account-drawer-close aria-label="${tr("收起我的侧栏", "Close account drawer")}">×</button>
    </div>
    <div class="account-drawer-body">
      <header class="account-drawer-profile">
        ${profileAvatarMarkup(profile, state.locale, true)}
        <div><h2>${escapeHtml(profile.nickname)}</h2><p>${escapeHtml(state.session.user.email || "")}</p></div>
      </header>
      <button class="button account-drawer-edit" type="button" data-edit-profile>${tr("编辑头像和昵称", "Edit avatar & nickname")}</button>
      <nav class="account-drawer-nav" aria-label="${tr("我的功能", "My account sections")}">
        <a href="#/favorites"><span>${tr("个人收藏", "Saved items")}</span><strong>${tr("我的收藏", "My favorites")}</strong></a>
        <a href="#/account"><span>${tr("账号设置", "Account settings")}</span><strong>${tr("账号与隐私", "Account & privacy")}</strong></a>
        ${state.access?.slug ? `<a href="#/creator/${encodeURIComponent(state.access.slug)}"><span>${tr("公开主页", "Public profile")}</span><strong>${tr("查看我的公开主页", "View my public profile")}</strong></a>` : ""}
        <a href="#/my-publications"><span>${tr("创作管理", "Creator workspace")}</span><strong>${tr("我的发布", "My publications")}</strong></a>
        ${state.access?.is_creator ? `<a href="#/publish/new"><span>${tr("发布入口", "Publishing")}</span><strong>${tr("网站新建 Prompt", "Create Prompt on website")}</strong></a>` : ""}
        <a href="#/governance"><span>${tr("社区安全", "Community safety")}</span><strong>${tr("我的举报与申诉", "My reports & appeals")}</strong></a>
        ${(state.access?.is_admin || state.access?.is_reviewer) ? `<a href="#/admin/reports"><span>${tr("治理后台", "Governance")}</span><strong>${tr("处理举报与申诉", "Review reports & appeals")}</strong></a>` : ""}
        <a href="../prompt-vault.html"><span>Prompt Vault</span><strong>${tr("打开扩展介绍", "Open extension page")}</strong></a>
      </nav>
      <footer class="account-drawer-footer">
        <button class="button ghost" type="button" data-sign-out>${tr("退出当前账号", "Sign out of this account")}</button>
      </footer>
    </div>`;
  accountDrawer.querySelector("[data-account-drawer-close]").addEventListener("click", () => setAccountDrawer(false));
  accountDrawer.querySelector("[data-edit-profile]").addEventListener("click", openProfileEditorFromAccount);
  accountDrawer.querySelector("[data-sign-out]").addEventListener("click", async () => {
    setAccountDrawer(false);
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
      <p class="eyebrow">ACCOUNT SETUP</p>
      <h1>${tr("账号发布权限尚未就绪", "Publishing access is not ready")}</h1>
      <p class="lede">${tr(
        "所有登录用户都可以创建和提交免费 Prompt。请刷新页面；如果仍看到这里，说明账号资料初始化失败。",
        "Every signed-in member can create and submit free Prompts. Refresh the page; if this remains, account profile initialization failed.",
      )}</p>
      <button class="button primary" type="button" data-reload-access>${tr("刷新账号权限", "Refresh access")}</button>
    </section>`;
  app.querySelector("[data-reload-access]")?.addEventListener("click", () => location.reload());
  return false;
}

function requireStaff() {
  if (!requireLogin()) return false;
  if (state.access?.is_admin || state.access?.is_reviewer) return true;
  app.innerHTML = `
    <section class="state-card narrow">
      <p class="eyebrow">STAFF ONLY</p>
      <h1>${tr("没有管理权限", "No management access")}</h1>
      <p class="lede">${tr("内容管理仅向已由服务端授权的管理员开放。普通用户不能申请或自行获得该权限。", "Content management is available only to server-authorized administrators. Regular users cannot request or grant themselves access.")}</p>
      <a class="button" href="#/discover">${tr("返回提示词库", "Back to Prompt Library")}</a>
    </section>`;
  return false;
}

const REPORT_REASONS = Object.freeze([
  ["copyright", ["版权或素材侵权", "Copyright or unauthorized material"]],
  ["harassment", ["骚扰、仇恨或人身攻击", "Harassment, hate, or abuse"]],
  ["spam", ["垃圾信息或恶意推广", "Spam or malicious promotion"]],
  ["illegal", ["违法或危险内容", "Illegal or dangerous content"]],
  ["misleading", ["冒充、虚假来源或误导", "Impersonation or misleading provenance"]],
  ["privacy", ["隐私或个人信息泄露", "Privacy or personal-data exposure"]],
  ["other", ["其他违反社区规则的内容", "Other community-rule violation"]],
]);

function governanceErrorMessage(error) {
  const message = String(error?.message || error || "");
  const known = {
    contact_email_required: tr("未登录举报需要填写可联系邮箱。", "A contact email is required when reporting without signing in."),
    duplicate_open_report: tr("你已经提交过相同目标的待处理举报。", "You already have an open report for this target."),
    duplicate_open_appeal: tr("这项处置已经有一条待处理申诉。", "An open appeal already exists for this action."),
    rate_limited: tr("提交过于频繁，请稍后再试。", "Too many submissions. Try again later."),
    report_target_not_found: tr("举报目标不存在或已经不可访问。", "The reported item no longer exists or is inaccessible."),
    appeal_target_not_owned_or_not_actioned: tr("只有被处置内容的所有者可以申诉。", "Only the owner of moderated content can appeal."),
  };
  const key = Object.keys(known).find((item) => message.includes(item));
  return key ? known[key] : message;
}

function openGovernanceDialog({ mode = "report", targetType, targetId = null, targetRef = "", targetLabel = "", reportId = null } = {}) {
  document.querySelector("[data-governance-dialog]")?.remove();
  const isAppeal = mode === "appeal";
  const dialog = document.createElement("dialog");
  dialog.className = "governance-dialog";
  dialog.dataset.governanceDialog = "";
  const reasonOptions = REPORT_REASONS.map(([value, labels]) => `<option value="${value}">${escapeHtml(labels[state.locale === "en" ? 1 : 0])}</option>`).join("");
  dialog.innerHTML = `
    <form method="dialog" class="governance-dialog-card" data-governance-form>
      <header>
        <div><p class="eyebrow">COMMUNITY SAFETY</p><h2>${isAppeal ? tr("提交申诉", "Submit an appeal") : tr("举报内容", "Report content")}</h2></div>
        <button class="icon-button" type="button" data-dialog-close aria-label="${tr("关闭", "Close")}">×</button>
      </header>
      <p class="lede">${isAppeal
        ? tr("说明处置存在错误的原因和可核验信息。提交后由平台人员复核。", "Explain why the action was incorrect and provide verifiable context. Staff will review it.")
        : tr("举报不会自动下架内容。平台会按社区规则核查，并保留处理记录。", "A report does not automatically remove content. Staff review it under the community rules and retain a handling record.")}</p>
      <div class="governance-target"><span>${tr("目标", "Target")}</span><strong>${escapeHtml(targetLabel || `${targetType} · ${targetId}`)}</strong></div>
      ${isAppeal ? "" : `<label class="field"><span>${tr("举报原因", "Reason")}</span><select name="reason" required>${reasonOptions}</select></label>`}
      ${!isAppeal && !state.session ? `<label class="field"><span>${tr("联系邮箱", "Contact email")}</span><input name="email" type="email" maxlength="254" required /><small>${tr("仅用于处理结果与补充材料，不公开显示。", "Used only for case follow-up and never shown publicly.")}</small></label>` : ""}
      <label class="field"><span>${isAppeal ? tr("申诉说明", "Appeal statement") : tr("具体说明", "Details")}</span><textarea name="details" minlength="${isAppeal ? 20 : 10}" maxlength="3000" required placeholder="${isAppeal ? tr("请提供事实、时间、来源或权利证明…", "Provide facts, dates, sources, or proof of rights…") : tr("请说明问题出现在哪里以及为什么违反规则…", "Explain where the issue appears and which rule it may violate…")}"></textarea></label>
      <p class="governance-rules-link"><a href="rules.html" target="_blank" rel="noopener">${tr("查看语藏社区规则与知识产权流程", "Read the Yucang Community and IP Rules")}</a></p>
      <div class="actions">
        <button class="button ghost" type="button" data-dialog-close>${tr("取消", "Cancel")}</button>
        <button class="button primary" type="submit">${isAppeal ? tr("提交申诉", "Submit appeal") : tr("提交举报", "Submit report")}</button>
      </div>
    </form>`;
  document.body.append(dialog);
  dialog.querySelectorAll("[data-dialog-close]").forEach((button) => button.addEventListener("click", () => dialog.close()));
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  dialog.querySelector("[data-governance-form]").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('[type="submit"]');
    const data = new FormData(form);
    setBusy(button, true, isAppeal ? tr("正在提交申诉…", "Submitting appeal…") : tr("正在提交举报…", "Submitting report…"));
    try {
      if (isAppeal) {
        await rpc("yucang_submit_appeal", {
          p_target_type: targetType, p_target_id: targetId,
          p_body: data.get("details"), p_report_id: reportId,
        });
      } else {
        await rpc("yucang_submit_report", {
          p_target_type: targetType, p_target_id: targetId,
          p_reason_code: data.get("reason"), p_details: data.get("details"),
          p_contact_email: data.get("email") || "", p_target_ref: targetRef,
        });
      }
      dialog.close();
      notify(isAppeal ? tr("申诉已提交，平台会进行人工复核。", "Appeal submitted for staff review.") : tr("举报已提交，平台会按规则核查。", "Report submitted for review."));
      if (isAppeal && location.hash.includes("governance")) renderGovernanceCenter();
    } catch (error) {
      notify(governanceErrorMessage(error));
      setBusy(button, false);
    }
  });
  dialog.showModal();
  dialog.querySelector("select, textarea, input")?.focus();
}

function bindWebsiteLogin(root) {
  const lastAuthEmailKey = "yucangLastAuthEmail";
  const pendingAuthMethodKey = "yucangPendingAuthMethod";
  const loginConsent = bindLoginConsent(root);
  const lastMethod = localStorage.getItem("yucangLastAuthMethod") || "";
  applyLastLoginHint(root, {
    method: lastMethod,
    email: localStorage.getItem(lastAuthEmailKey) || "",
  });
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
    if (!loginConsent.allowed()) return setLoginStatus(tr("请先阅读并同意用户协议和隐私政策。", "Please agree to the Terms and Privacy Policy first."), true);
    const button = event.submitter;
    sessionStorage.removeItem(pendingAuthMethodKey);
    pendingEmail = new FormData(event.currentTarget).get("email").trim();
    setBusy(button, true, tr("正在发送...", "Sending..."));
    loginConsent.setBusy(button, true);
    const { error } = await getClient().auth.signInWithOtp({
      email: pendingEmail, options: { shouldCreateUser: true },
    });
    setBusy(button, false);
    loginConsent.setBusy(button, false);
    if (error) return setLoginStatus(emailErrorMessage(error), true);
    emailRequestForm.hidden = true;
    emailVerifyForm.hidden = false;
    emailVerifyForm.querySelector("input").focus();
    setLoginStatus(tr("验证码已发送，请在下方输入。若收件箱没有，请检查垃圾邮箱。", "Verification code sent. Enter it below. Check spam if it is not in your inbox."));
  });

  emailVerifyForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!loginConsent.allowed()) return setLoginStatus(tr("请先阅读并同意用户协议和隐私政策。", "Please agree to the Terms and Privacy Policy first."), true);
    const button = event.submitter;
    setBusy(button, true, tr("正在验证...", "Verifying..."));
    loginConsent.setBusy(button, true);
    const form = new FormData(event.currentTarget);
    const { data, error } = await getClient().auth.verifyOtp({
      email: pendingEmail, token: form.get("token"), type: "email",
    });
    setBusy(button, false);
    loginConsent.setBusy(button, false);
    if (error) return setLoginStatus(error.message, true);
    const normalizedEmail = pendingEmail.toLowerCase();
    localStorage.setItem("yucangLastAuthMethod", "email");
    localStorage.setItem(lastAuthEmailKey, normalizedEmail);
    applyLastLoginHint(root, { method: "email", email: normalizedEmail });
    state.session = data.session;
    await loadAccess();
    await loadProfile();
    renderHeader();
    go(postLoginPath());
  });

  root.querySelectorAll("[data-oauth]").forEach((button) => button.addEventListener("click", async () => {
    if (!loginConsent.allowed()) return setLoginStatus(tr("请先阅读并同意用户协议和隐私政策。", "Please agree to the Terms and Privacy Policy first."), true);
    loginConsent.setBusy(button, true);
    sessionStorage.setItem(pendingAuthMethodKey, button.dataset.oauth);
    const { error } = await getClient().auth.signInWithOAuth({
      provider: button.dataset.oauth,
      options: { redirectTo: `${location.origin}${location.pathname}` },
    });
    if (error) {
      sessionStorage.removeItem(pendingAuthMethodKey);
      loginConsent.setBusy(button, false);
      setLoginStatus(error.message, true);
    }
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
    const figureRgb = document.documentElement.dataset.theme === "light" ? "39, 41, 37" : "239, 239, 232";
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
        context.fillStyle = `rgba(${figureRgb}, ${Math.min(1, particle.alpha + interaction * .42)})`;
        context.shadowColor = `rgba(${figureRgb}, ${.08 + particle.depth * .22 + interaction * .58})`;
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
      context.fillStyle = `rgba(${figureRgb}, ${alpha})`;
      context.fillText(mote.glyph, x, y);
    });
    if (!reducedMotion) frame = requestAnimationFrame(draw);
  };
  const themeObserver = new MutationObserver(() => {
    if (reducedMotion) draw(performance.now());
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  draw();
  return () => {
    cancelAnimationFrame(frame);
    themeObserver.disconnect();
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
  root.querySelectorAll(".login-last-used-marker").forEach((marker) => { marker.textContent = "Last used"; });
  setHtml(".login-policy-consent span", 'I have read and agree to the <a href="https://zaiye.art/terms.html" target="_blank" rel="noopener">Terms of Service</a> and <a href="https://zaiye.art/privacy.html" target="_blank" rel="noopener">Privacy Policy</a>');
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
    <a class="home-art-card" href="#/prompt/${encodeURIComponent(item.promptId)}" aria-label="${escapeHtml(title)}, ${tr("打开对应 Prompt", "open the matching Prompt")}, ${item.likes} ${tr("个赞", "likes")}" style="--card-size:${item.size}" data-home-like-resource="official:${escapeHtml(item.promptId)}" data-home-title="${escapeHtml(title)}" data-orbit-phase="${item.phase}" data-orbit-speed="${item.speed}" data-orbit-lane="${item.lane}" data-orbit-lift="${item.lift}">
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
      <div class="home-orbit" aria-label="${tr("首发 Prompt 示例图与社区真实点赞", "Launch Prompt examples with live community likes")}">
        ${featured}
        <canvas class="home-text-figure" role="img" aria-label="${tr("由流动中文文字汇聚成的无五官抽象人形", "A featureless abstract figure formed from flowing Chinese characters")}"></canvas>
      </div>
      <a class="button primary home-library-cta" href="#/discover">${tr("进入提示词库", "Explore Prompts")}</a>
      <p class="home-feature-note">${tr("首发精选 · 显示社区真实点赞", "Launch picks · live community likes")}</p>
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
  hydrateHomeLikes(app);
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

async function renderDiscover({ initialCategory = "all", initialQuery = "" } = {}) {
  app.innerHTML = `<section class="loading-state"><span class="spinner"></span><p>${tr("正在读取提示词库...", "Loading Prompt Library...")}</p></section>`;
  try {
    const officialItems = await loadResources();
    const communityItems = await loadCommunityResources();
    const items = [...communityItems, ...officialItems];
    app.innerHTML = `
      <section class="library-intro">
        <div>
          <p class="eyebrow">${tr("语藏提示词库", "YUCANG PROMPT LIBRARY")}</p>
          <h1>${tr("找到 Prompt，改好变量，直接使用", "Find a Prompt. Adjust it. Use it.")}</h1>
          <p>${tr(
            "无需登录。站方精选与用户公开作品都在这里，在页面里完成变量替换并复制最终 Prompt。",
            "No sign-in required. Official picks and public creator works live together here; replace variables and copy the final Prompt.",
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
            <input type="search" data-resource-search value="${escapeHtml(initialQuery)}" placeholder="${tr("搜索标题、用途、模型或标签", "Search title, use, model, or tag")}" autocomplete="off" />
          </label>
        </div>
        <div class="category-tabs" role="group" aria-label="${tr("提示词分类", "Prompt categories")}">
          ${RESOURCE_CATEGORY_ORDER.map((category) => `<button type="button" data-resource-category="${category}" aria-pressed="${category === initialCategory}">${resourceCategoryLabel(category)}</button>`).join("")}
        </div>
        <div class="resource-grid" data-resource-grid></div>
      </section>`;
    bindResourceLibrary(items, { initialCategory, initialQuery });
  } catch (error) {
    renderError(error, tr("提示词库暂时不可用", "Prompt Library is unavailable"));
  }
}

async function renderCreatorProfile(creatorSlug) {
  app.innerHTML = `<section class="loading-state"><span class="spinner"></span><p>${tr("正在读取创作者主页...", "Loading creator profile...")}</p></section>`;
  try {
    const [profileResult, communityItems] = await Promise.all([
      rpc("yucang_get_public_creator", { p_slug: creatorSlug }),
      loadCommunityResources(),
    ]);
    const profile = firstRow(profileResult);
    if (!profile) throw new Error(tr("这个创作者主页不存在或尚无公开作品。", "This creator profile does not exist or has no public work."));
    const works = communityItems.filter((item) => String(item.author_slug || "").toLowerCase() === String(profile.slug).toLowerCase());
    const publishedLabel = profile.latest_published_at
      ? tr(`最近发布于 ${formatDate(profile.latest_published_at)}`, `Latest work published ${formatDate(profile.latest_published_at)}`)
      : tr("尚无公开作品", "No public work yet");
    app.innerHTML = `
      <section class="creator-profile-page" aria-labelledby="creatorTitle">
        <a class="back-link" href="#/discover">${tr("返回提示词库", "Back to Prompt Library")}</a>
        <header class="creator-profile-hero">
          <div class="creator-profile-identity">
            ${profileAvatarMarkup({ nickname: profile.nickname, avatarUrl: profile.avatar_url }, state.locale, "large")}
            <div>
              <p class="creator-profile-handle">@${escapeHtml(profile.slug)}</p>
              <h1 id="creatorTitle">${escapeHtml(profile.nickname)}</h1>
              <p>${escapeHtml(publishedLabel)}</p>
              ${profile.bio ? `<p class="creator-profile-bio">${escapeHtml(profile.bio)}</p>` : ""}
            </div>
          </div>
          <div class="creator-profile-summary">
            <strong>${Number(profile.published_work_count || works.length)}</strong>
            <span>${tr("公开 Prompt", "Public Prompts")}</span>
            ${profile.is_owner
              ? `<a class="button ghost" href="#/account">${tr("管理公开范围", "Manage visibility")}</a>`
              : `<button class="button ghost" type="button" data-report-account="${escapeHtml(profile.user_id)}">${tr("举报账号", "Report account")}</button>`}
          </div>
        </header>
        <section class="creator-work-section" aria-labelledby="creatorWorksTitle">
          <div class="creator-work-heading">
            <h2 id="creatorWorksTitle">${tr("公开作品", "Published work")}</h2>
            <p>${works.length} ${tr("条作品", "works")}</p>
          </div>
          <div class="resource-grid creator-work-grid" data-creator-grid>
            ${works.length ? works.map(renderResourceCard).join("") : `<div class="library-empty"><h3>${tr("暂时没有公开作品", "No public work yet")}</h3><p>${tr("创作者发布的新作品会显示在这里。", "New public work will appear here.")}</p></div>`}
          </div>
        </section>
      </section>`;
    const grid = app.querySelector("[data-creator-grid]");
    if (works.length) {
      bindResourceCardActions(grid, works);
      layoutResourceMasonry(grid);
    }
    app.querySelector("[data-report-account]")?.addEventListener("click", () => openGovernanceDialog({
      targetType: "account",
      targetId: profile.user_id,
      targetLabel: tr(`创作者：${profile.nickname}`, `Creator: ${profile.nickname}`),
    }));
  } catch (error) {
    renderError(error, tr("无法打开创作者主页", "Unable to open creator profile"));
  }
}

async function renderFavorites() {
  if (!requireLogin()) return;
  app.innerHTML = `<section class="loading-state"><span class="spinner"></span><p>${tr("正在读取我的收藏...", "Loading favorites...")}</p></section>`;
  try {
    const [favoriteRows, officialItems, communityItems] = await Promise.all([
      rpc("yucang_list_my_favorites"),
      loadResources(),
      loadCommunityResources(),
    ]);
    const allItems = [...communityItems, ...officialItems];
    const itemByKey = new Map(allItems.map((item) => [resourceFavoriteKey(item), item]));
    const items = favoriteRows.map((row) => itemByKey.get(row.resource_key)).filter(Boolean);
    app.innerHTML = `
      <section class="favorites-page" aria-labelledby="favoritesTitle">
        ${pageExitNavMarkup()}
        <header class="section-head"><div><p class="eyebrow">SAVED</p><h1 id="favoritesTitle">${tr("我的收藏", "My favorites")}</h1><p>${tr("这里只保存网站账号的收藏记录，不读取 Prompt Vault 私库。", "These are website account bookmarks. Prompt Vault private data is never read.")}</p></div><span class="status">${items.length}</span></header>
        <div class="resource-grid" data-favorites-grid>
          ${items.length ? items.map(renderResourceCard).join("") : `<div class="library-empty"><h3>${tr("还没有网站收藏", "No website favorites yet")}</h3><p>${tr("在提示词卡片或详情页点击星标即可收藏。", "Use the star on a Prompt card or detail page to save it here.")}</p><a class="button primary" href="#/discover">${tr("浏览提示词库", "Browse Prompt Library")}</a></div>`}
        </div>
      </section>`;
    const grid = app.querySelector("[data-favorites-grid]");
    if (items.length) {
      bindResourceCardActions(grid, items);
      layoutResourceMasonry(grid);
      grid.addEventListener("favoritechange", (event) => {
        if (!event.detail?.favorited) renderFavorites();
      });
    }
  } catch (error) {
    renderError(error, tr("无法读取我的收藏", "Unable to load favorites"));
  }
}

async function renderAccountPrivacy() {
  if (!requireLogin()) return;
  app.innerHTML = `<section class="loading-state"><span class="spinner"></span><p>${tr("正在读取账号设置...", "Loading account settings...")}</p></section>`;
  try {
    const profile = state.access?.slug
      ? firstRow(await rpc("yucang_get_public_creator", { p_slug: state.access.slug }))
      : null;
    app.innerHTML = `
      <section class="account-settings-page" aria-labelledby="accountSettingsTitle">
        ${pageExitNavMarkup()}
        <header class="section-head"><div><p class="eyebrow">ACCOUNT</p><h1 id="accountSettingsTitle">${tr("账号与隐私", "Account & privacy")}</h1><p>${tr("管理公开主页、账号资料和登录状态。", "Manage your public profile, account details, and session.")}</p></div></header>
        <div class="account-settings-layout">
          <section class="panel account-identity-panel">
            <div class="account-settings-identity">${profileAvatarMarkup(state.profile, state.locale, "large")}<div><h2>${escapeHtml(state.profile?.nickname || state.access?.nickname || "")}</h2><p>${escapeHtml(state.session.user.email || "")}</p></div></div>
            <button class="button" type="button" data-account-edit-profile>${tr("编辑头像和昵称", "Edit avatar & nickname")}</button>
            <p>${tr("登录不会公开或读取扩展中的私人 Prompt。", "Signing in does not publish or read private Prompts from the extension.")}</p>
          </section>
          <form class="panel account-privacy-form" data-account-privacy-form>
            <div><h2>${tr("创作者公开主页", "Public creator profile")}</h2><p>${tr("关闭后，其他人无法打开或在创作者列表中找到你的主页。已经公开的作品和作品署名仍会保留。", "When off, others cannot open or discover your profile. Published work and its attribution remain visible.")}</p></div>
            <label class="privacy-switch"><input type="checkbox" name="is_public" ${profile?.is_public !== false ? "checked" : ""} /><span><strong>${tr("允许其他人查看我的创作者主页", "Allow others to view my creator profile")}</strong><small>${profile?.is_public === false ? tr("当前仅自己可见", "Currently visible only to you") : tr("当前公开", "Currently public")}</small></span></label>
            <label class="field"><span>${tr("个人简介", "Bio")}</span><textarea name="bio" maxlength="500" placeholder="${tr("介绍你的创作方向和擅长领域", "Describe your creative focus")}">${escapeHtml(profile?.bio || "")}</textarea><small>${tr("最多 500 个字符，仅在公开主页显示。", "Up to 500 characters, shown only on your public profile.")}</small></label>
            <div class="actions"><button class="button primary" type="submit" data-account-save>${tr("保存公开设置", "Save visibility")}</button><a class="button" href="../privacy.html" target="_blank" rel="noopener">${tr("隐私政策", "Privacy policy")}</a></div>
          </form>
        </div>
        <section class="account-session-row"><div><h2>${tr("当前登录", "Current session")}</h2><p>${tr("退出只会结束这个浏览器中的网站登录，不会删除账号或扩展数据。", "Signing out ends this website session only. It does not delete your account or extension data.")}</p></div><button class="button ghost" type="button" data-account-sign-out>${tr("退出当前账号", "Sign out")}</button></section>
      </section>`;
    app.querySelector("[data-account-edit-profile]").addEventListener("click", openProfileEditorFromAccount);
    app.querySelector("[data-account-sign-out]").addEventListener("click", async () => {
      await getClient().auth.signOut();
      go("home");
    });
    app.querySelector("[data-account-privacy-form]").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector("[data-account-save]");
      setBusy(button, true, tr("正在保存...", "Saving..."));
      try {
        const saved = firstRow(await rpc("yucang_update_creator_settings", {
          p_bio: form.elements.bio.value,
          p_is_public: form.elements.is_public.checked,
        }));
        if (state.access) state.access.profile_is_public = saved?.is_public !== false;
        notify(tr("账号公开设置已保存。", "Profile visibility saved."));
        await renderAccountPrivacy();
      } catch (error) {
        notify(error.message);
        setBusy(button, false);
      }
    });
  } catch (error) {
    renderError(error, tr("无法读取账号设置", "Unable to load account settings"));
  }
}

function renderAiService() {
  const plans = [
    {
      name: tr("轻量", "Light"),
      price: "¥9.9",
      credits: tr("1000 点", "1,000 points"),
    },
    {
      name: tr("创作者", "Creator"),
      price: "¥29",
      credits: tr("3200 点", "3,200 points"),
    },
    {
      name: tr("工作室", "Studio"),
      price: "¥69",
      credits: tr("8000 点", "8,000 points"),
    },
  ];
  const planMarkup = plans.map((plan, index) => `
    <article class="ai-plan${index === 1 ? " is-emphasized" : ""}">
      <h3>${plan.name}</h3>
      <strong class="ai-plan-price">${plan.price}</strong>
      <p>${plan.credits}</p>
      <small>${tr("一次性充值 · 不自动续费", "One-time · no auto-renewal")}</small>
      <span class="ai-plan-status">${tr("即将开放", "Coming soon")}</span>
    </article>`).join("");

  app.innerHTML = `
    <div class="ai-service-page">
      <section class="ai-service-hero" aria-labelledby="ai-service-title">
        <div class="ai-service-intro">
          <p class="ai-kicker">${tr("托管 AI 服务", "Hosted AI service")}</p>
          <h1 id="ai-service-title">${tr("不想配置 API，也可以按量使用 AI", "Use AI on demand without configuring an API")}</h1>
          <p>${tr(
            "语藏托管 AI 计划使用预付语藏点，并且必须登录。当前仅公布标准，充值与托管调用尚未开放。",
            "Hosted AI is planned as a prepaid Yucang Points service for signed-in users. These standards are public, but top-ups and hosted calls are not yet open.",
          )}</p>
        </div>
        <aside class="ai-service-state" aria-label="${tr("当前开放状态", "Current availability")}">
          <span>${tr("当前状态", "Current status")}</span>
          <strong>${tr("价格公示", "Pricing published")}</strong>
          <p>${tr("充值与托管 AI 尚未开放", "Top-ups and hosted AI are not open")}</p>
        </aside>
      </section>

      <section class="ai-billing-rule" aria-labelledby="ai-billing-title">
        <div>
          <h2 id="ai-billing-title">${tr("100 点 = 人民币 1 元", "100 points = RMB ¥1")}</h2>
          <p>${tr(
            "每次请求最低扣 2 点。执行前显示预计点数范围，完成后只按模型服务商返回的实际 usage 结算，并展示模型、输入 token、输出 token、扣点和时间明细。",
            "Each request has a 2-point minimum. An estimated range appears before execution; after completion, points are settled from the provider's actual usage with model, input token, output token, points, and time details.",
          )}</p>
        </div>
        <div class="ai-multiplier-list" aria-label="${tr("模型点数标准", "Model point rates")}">
          <div><span>${tr("经济模型 · 输入", "Economy · input")}</span><strong>1</strong><small>${tr("点 / 1000 token", "point / 1,000 tokens")}</small></div>
          <div><span>${tr("经济模型 · 输出", "Economy · output")}</span><strong>4</strong><small>${tr("点 / 1000 token", "points / 1,000 tokens")}</small></div>
          <div><span>${tr("品质模型 · 输入", "Quality · input")}</span><strong>2</strong><small>${tr("点 / 1000 token", "points / 1,000 tokens")}</small></div>
          <div><span>${tr("品质模型 · 输出", "Quality · output")}</span><strong>8</strong><small>${tr("点 / 1000 token", "points / 1,000 tokens")}</small></div>
        </div>
      </section>

      <section class="ai-plans" aria-labelledby="ai-plans-title">
        <div class="ai-section-copy">
          <h2 id="ai-plans-title">${tr("建议充值档位", "Suggested top-up amounts")}</h2>
          <p>${tr("以下仅为即将开放的标准展示，没有付款入口。新登录用户将随托管 AI 内测一次性获得 100 点体验点。", "These are coming-soon standards only, with no payment entry. New signed-in users will receive a one-time 100-point trial when the hosted AI beta opens.")}</p>
        </div>
        <div class="ai-plan-grid">${planMarkup}</div>
      </section>

      <section class="ai-byok" aria-labelledby="ai-byok-title">
        <div>
          <h2 id="ai-byok-title">BYOK ${tr("继续保留", "remains available")}</h2>
          <p>${tr(
            "扩展的本地基础功能永久免费且无需登录。继续使用自己的 API Key 时，平台不收取 AI 服务费，模型商费用由用户承担，Key 只保存在本机。",
            "The extension's local core features remain free and require no sign-in. With your own API key, Yucang charges no service fee; provider charges are yours, and the key stays on your device.",
          )}</p>
        </div>
        <div>
          <h3>${tr("托管模式", "Hosted mode")}</h3>
          <p>${tr(
            "平台 Key 只保存在服务端，永不下发到扩展，也不会进入 URL。",
            "Platform keys remain server-side, are never sent to the extension, and never appear in a URL.",
          )}</p>
        </div>
      </section>

      <section class="ai-explain-grid" aria-label="${tr("计费说明", "Billing explanation")}">
        <article>
          <h2>${tr("为什么这样计费", "Why billing works this way")}</h2>
          <p>${tr(
            "输入和输出分开计费，能让短回答和长生成按实际消耗结算。点数价格还需覆盖汇率、支付、服务器、滥用防护与失败重试缓冲。图片会按所选模型折算成输入 token。",
            "Input and output are billed separately so short answers and long generations settle by actual usage. Point rates also reserve room for exchange rates, payments, servers, abuse controls, and failed retries. Images count as model-converted input tokens.",
          )}</p>
        </article>
        <article>
          <h2>${tr("点数示例", "Point examples")}</h2>
          <p>${tr(
            "约 2000 输入 token + 1000 输出 token：经济模型约 6 点（¥0.06），品质模型约 12 点（¥0.12）。",
            "About 2,000 input tokens + 1,000 output tokens: around 6 points (¥0.06) on an economy model or 12 points (¥0.12) on a quality model.",
          )}</p>
          <small>${tr("实际价格会随上下文长度、图片尺寸和输出长度变化。失败且没有产生有效模型结果时不扣点。", "Actual cost varies with context length, image size, and output length. Failed calls with no valid model result consume no points.")}</small>
        </article>
      </section>

      <section class="ai-policy-layout">
        <article class="ai-refund" aria-labelledby="ai-balance-title">
          <h2 id="ai-balance-title">${tr("余额与有效期", "Balance and validity")}</h2>
          <ul>
            <li>${tr("默认不自动续费，不允许透支；余额不足时停止调用。", "No auto-renewal or overdrafts; calls stop when the balance is insufficient.")}</li>
            <li>${tr("付费点永久有效。", "Paid points do not expire.")}</li>
            <li>${tr("赠送点可在发放时单独标注有效期。", "Gift points may carry a stated expiry when granted.")}</li>
            <li>${tr("每笔用量都提供模型、token、扣点和时间记录。", "Every usage record shows model, tokens, points, and time.")}</li>
          </ul>
        </article>
        <article class="ai-safety" aria-labelledby="ai-safety-title">
          <h2 id="ai-safety-title">${tr("隐私与安全边界", "Privacy and security boundaries")}</h2>
          <p>${tr(
            "一次调用只处理用户明确提交的当前 Prompt 或图片。服务不会扫描、搜索或枚举扩展私库；登录不会上传本地 Prompt，云同步仍然关闭。",
            "A call processes only the current Prompt or image explicitly submitted by the user. The service does not scan, search, or enumerate the extension's private library. Signing in does not upload local Prompts, and cloud sync remains off.",
          )}</p>
        </article>
      </section>

      <section class="ai-readiness" aria-labelledby="ai-readiness-title">
        <h2 id="ai-readiness-title">${tr("开放前还缺什么", "What is required before launch")}</h2>
        <div class="ai-readiness-items">
          <span>${tr("服务端账户限速", "Server-side account rate limits")}</span>
          <span>${tr("IP 限速", "IP rate limits")}</span>
          <span>${tr("单请求 token 上限", "Per-request token caps")}</span>
          <span>${tr("全局预算", "Global budget controls")}</span>
          <span>${tr("幂等处理", "Idempotency")}</span>
          <span>${tr("不可变用量账本", "Immutable usage ledger")}</span>
        </div>
        <p>${tr("支付、钱包、扣点和代理调用现在都没有上线。这些安全与账务能力完成并经过验证后，平台才会开放充值。", "Payments, wallets, point deductions, and hosted proxy calls are not live. Top-ups will open only after these security and accounting controls are implemented and verified.")}</p>
      </section>

      <section class="ai-sources" aria-labelledby="ai-sources-title">
        <div>
          <h2 id="ai-sources-title">${tr("第三方模型与价格可能调整", "Third-party models and prices may change")}</h2>
          <p>${tr("模型名称、可用性和上游价格以正式接入时的供应商公示为准。标准调整会在生效前公示。", "Model names, availability, and upstream prices are subject to provider information at launch. Standard changes will be published before taking effect.")}</p>
        </div>
        <nav aria-label="${tr("官方价格来源", "Official pricing sources")}">
          <a href="https://api-docs.deepseek.com/zh-cn/quick_start/pricing/" target="_blank" rel="noopener noreferrer">DeepSeek ${tr("官方价格", "official pricing")}</a>
          <a href="https://help.aliyun.com/zh/model-studio/model-pricing" target="_blank" rel="noopener noreferrer">${tr("阿里云百炼价格", "Alibaba Cloud Model Studio pricing")}</a>
          <a href="https://supabase.com/docs/guides/functions/pricing" target="_blank" rel="noopener noreferrer">Supabase Edge Functions ${tr("价格", "pricing")}</a>
        </nav>
      </section>

      <section class="ai-readiness" aria-labelledby="ai-current-title">
        <h2 id="ai-current-title">${tr("当前继续使用自带 API", "Use your own API for now")}</h2>
        <p>${tr("当前仅公布标准，充值与托管 AI 尚未开放。现阶段请继续在 Prompt Vault 中配置自己的 API Key。", "These standards are public, but top-ups and hosted AI are not yet open. For now, continue configuring your own API key in Prompt Vault.")}</p>
        <div class="actions"><a class="button primary" href="../prompt-vault.html">${tr("返回扩展介绍", "View Prompt Vault")}</a><a class="button ghost" href="../prompt-vault.html#api-guide">${tr("查看如何配置自带 API", "How to configure your API")}</a></div>
      </section>
    </div>`;
}

function communityCategory(contentType) {
  return ({ image: "image", video: "video", text_office: "writing", programming: "coding" })[contentType] || "writing";
}

function updateThemeToggle() {
  const light = document.documentElement.dataset.theme === "light";
  themeToggle.textContent = light ? "☾" : "☀";
  themeToggle.setAttribute("aria-label", light
    ? tr("切换到夜间模式", "Switch to dark mode")
    : tr("切换到日间模式", "Switch to light mode"));
  themeToggle.setAttribute("aria-pressed", String(light));
}

function applyRouteDefaultTheme(section) {
  if (localStorage.getItem("yucangTheme")) return;
  document.documentElement.dataset.theme = section === "home" || section === "login" ? "dark" : "light";
  updateThemeToggle();
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("yucangTheme", next);
  updateThemeToggle();
}

async function hydrateHomeLikes(root) {
  const cards = [...root.querySelectorAll("[data-home-like-resource]")];
  if (!cards.length) return;
  try {
    const counts = await rpc("yucang_get_like_counts", {
      p_resource_keys: cards.map((card) => card.dataset.homeLikeResource),
    });
    const byKey = new Map(counts.map((item) => [item.resource_key, Number(item.like_count || 0)]));
    cards.forEach((card) => {
      const count = byKey.get(card.dataset.homeLikeResource) || 0;
      const title = card.dataset.homeTitle || "";
      card.setAttribute("aria-label", `${title}, ${tr("打开对应 Prompt", "open the matching Prompt")}, ${count} ${tr("个赞", "likes")}`);
      const label = card.querySelector(".home-art-like");
      if (label) label.textContent = `♡ ${count}`;
    });
  } catch { /* Keep the initial zero values if the like service is unavailable. */ }
}

async function loadCommunityResources() {
  try {
    const works = await rpc("yucang_list_public_works");
    return Promise.all(works.map(async (work) => {
      const images = await loadVersionMedia(work.version_id);
      return {
        ...work,
        id: work.work_id,
        category: communityCategory(work.content_type),
        model: [work.model_name, work.model_version].filter(Boolean).join(" "),
        usage: work.summary || "",
        featuredImage: images[0]?.url || "",
        sourceName: work.author_nickname || tr("语藏用户", "Yucang creator"),
        sourceKind: "community",
        communityImages: images,
      };
    }));
  } catch (error) {
    if (!isSchemaMissing(error)) console.warn("Community works unavailable", error);
    return [];
  }
}

function resourceSearchText(item) {
  return [item.title, item.summary, item.model, item.usage, item.sourceName, ...(item.tags || [])].join(" ").toLocaleLowerCase("zh-CN");
}

function renderResourceCard(item) {
  const image = item.featuredImage
    ? `<figure class="resource-card-image"><img src="${escapeHtml(item.featuredImage)}" alt="${escapeHtml(item.title)} ${tr("效果图", "example image")}" loading="lazy" decoding="async" /></figure>`
    : "";
  const resourceKey = item.sourceKind === "community" ? `work:${item.id}` : `official:${item.id}`;
  return `
    <article class="resource-card${image ? " has-image" : ""}">
      <a class="resource-card-link" href="#/prompt/${encodeURIComponent(item.id)}">
        ${image}
        ${image ? "" : `<div class="resource-card-copy">
        <div class="resource-card-meta"><span>${escapeHtml(resourceCategoryLabel(item.category))}</span></div>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.summary)}</p>
        <footer><span>${escapeHtml((item.tags || []).slice(0, 2).join(" / "))}</span></footer>
        </div>`}
      </a>
      ${image ? `<span class="resource-category-badge">${escapeHtml(resourceCategoryLabel(item.category))}</span>
      <button class="resource-like" type="button" data-like-resource="${escapeHtml(resourceKey)}" title="${tr("点赞", "Like")}" aria-label="${tr("点赞", "Like")}">♡ <span>0</span></button>
      <div class="resource-hover-tools">
        ${item.sourceKind === "community" && item.author_slug
          ? `<a class="resource-author" href="#/creator/${encodeURIComponent(item.author_slug)}">${escapeHtml(item.sourceName || tr("语藏用户", "Yucang creator"))}</a>`
          : `<span class="resource-author">${escapeHtml(item.sourceName || tr("语藏", "Yucang"))}</span>`}
        <button type="button" data-favorite-resource="${escapeHtml(resourceKey)}" title="${tr("收藏到网站", "Save on website")}" aria-label="${tr("收藏到网站", "Save on website")}">☆</button>
        <button type="button" data-save-to-vault="${escapeHtml(item.id)}" title="${tr("收藏进 Prompt Vault 扩展", "Save to Prompt Vault extension")}" aria-label="${tr("收藏进 Prompt Vault 扩展", "Save to Prompt Vault extension")}"><svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3h12v18l-6-4-6 4z"/></svg></button>
        <button type="button" data-copy-resource="${escapeHtml(item.id)}" title="${tr("复制 Prompt", "Copy Prompt")}" aria-label="${tr("复制 Prompt", "Copy Prompt")}">⧉</button>
      </div>` : `<button class="resource-favorite-button" type="button" data-favorite-resource="${escapeHtml(resourceKey)}" title="${tr("收藏到网站", "Save on website")}" aria-label="${tr("收藏到网站", "Save on website")}">☆</button><button class="resource-save-button" type="button" data-save-to-vault="${escapeHtml(item.id)}" title="${tr("收藏进 Prompt Vault 扩展", "Save to Prompt Vault extension")}" aria-label="${tr("收藏进 Prompt Vault 扩展", "Save to Prompt Vault extension")}"><svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3h12v18l-6-4-6 4z"/></svg></button>`}
    </article>`;
}

async function hydrateResourceLikes(root, items) {
  const buttons = [...root.querySelectorAll("[data-like-resource]")];
  if (!buttons.length) return;
  try {
    const counts = await rpc("yucang_get_like_counts", { p_resource_keys: buttons.map((button) => button.dataset.likeResource) });
    const byKey = new Map(counts.map((item) => [item.resource_key, item]));
    buttons.forEach((button) => {
      const item = byKey.get(button.dataset.likeResource);
      button.classList.toggle("is-liked", Boolean(item?.liked_by_me));
      button.querySelector("span").textContent = String(Number(item?.like_count || 0));
    });
  } catch { /* Likes remain at zero until the migration is available. */ }
  buttons.forEach((button) => button.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!state.session) {
      sessionStorage.setItem("yucangPostLoginPath", location.hash.replace(/^#\/?/, "") || "discover");
      go("login");
      return;
    }
    try {
      const result = firstRow(await rpc("yucang_toggle_like", { p_resource_key: button.dataset.likeResource }));
      button.classList.toggle("is-liked", Boolean(result?.liked));
      button.querySelector("span").textContent = String(Number(result?.like_count || 0));
    } catch (error) { notify(error.message); }
  }));
}

async function hydrateResourceFavorites(root) {
  const buttons = [...root.querySelectorAll("[data-favorite-resource]")];
  if (!buttons.length) return;
  let favoriteKeys = new Set();
  if (state.session) {
    try {
      favoriteKeys = new Set((await rpc("yucang_list_my_favorites")).map((item) => item.resource_key));
    } catch (error) {
      if (!isSchemaMissing(error)) console.error(error);
    }
  }
  const paint = (button, favorited) => {
    button.classList.toggle("is-favorited", favorited);
    button.textContent = button.classList.contains("button")
      ? `${favorited ? "★" : "☆"} ${favorited ? tr("已收藏", "Saved") : tr("网站收藏", "Website favorite")}`
      : (favorited ? "★" : "☆");
    button.setAttribute("aria-label", favorited ? tr("取消网站收藏", "Remove website favorite") : tr("收藏到网站", "Save on website"));
    button.title = button.getAttribute("aria-label");
  };
  buttons.forEach((button) => {
    paint(button, favoriteKeys.has(button.dataset.favoriteResource));
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!state.session) {
        sessionStorage.setItem("yucangPostLoginPath", location.hash.replace(/^#\/?/, "") || "discover");
        go("login");
        return;
      }
      button.disabled = true;
      try {
        const result = firstRow(await rpc("yucang_toggle_favorite", { p_resource_key: button.dataset.favoriteResource }));
        paint(button, Boolean(result?.favorited));
        button.dispatchEvent(new CustomEvent("favoritechange", { bubbles: true, detail: result }));
        notify(result?.favorited ? tr("已收藏到网站账号。", "Saved to your website account.") : tr("已取消网站收藏。", "Website favorite removed."));
      } catch (error) {
        notify(error.message);
      } finally {
        button.disabled = false;
      }
    });
  });
}

function bindResourceCardActions(root, items) {
  bindPromptVaultButtons(root, (itemId) => {
    const item = items.find((entry) => entry.id === itemId);
    return item?.sourceKind === "community"
      ? communityPromptPayload(item, item.featuredImage)
      : officialPromptPayload(item);
  });
  root.querySelectorAll("[data-copy-resource]").forEach((button) => button.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const item = items.find((entry) => entry.id === button.dataset.copyResource);
    if (!item) return;
    const prompt = item.sourceKind === "community"
      ? renderPromptTemplate(item.prompt_text, normalizeVariables(item.variables), Object.fromEntries(
        normalizeVariables(item.variables).map((entry) => [entry.name, entry.defaultValue || `@${entry.name}`]),
      ))
      : resolvedOfficialPrompt(item);
    await navigator.clipboard.writeText(prompt);
    notify(tr("Prompt 已复制", "Prompt copied"));
  }));
  hydrateResourceLikes(root, items);
  hydrateResourceFavorites(root);
}

let resourceMasonryObserver;

function layoutResourceMasonry(grid) {
  resourceMasonryObserver?.disconnect();
  const layout = () => {
    const style = getComputedStyle(grid);
    const row = Number.parseFloat(style.gridAutoRows) || 4;
    const gap = Number.parseFloat(style.rowGap) || 16;
    grid.querySelectorAll(".resource-card").forEach((card) => {
      const span = Math.ceil((card.getBoundingClientRect().height + gap) / (row + gap));
      const value = `span ${span}`;
      if (card.style.gridRowEnd !== value) card.style.gridRowEnd = value;
    });
  };
  grid.querySelectorAll("img").forEach((image) => {
    if (!image.complete) image.addEventListener("load", layout, { once: true });
  });
  resourceMasonryObserver = new ResizeObserver(layout);
  resourceMasonryObserver.observe(grid);
  grid.querySelectorAll(".resource-card").forEach((card) => resourceMasonryObserver.observe(card));
  requestAnimationFrame(layout);
}

function bindResourceLibrary(items, { initialCategory = "all", initialQuery = "" } = {}) {
  const grid = app.querySelector("[data-resource-grid]");
  const search = app.querySelector("[data-resource-search]");
  const count = app.querySelector("[data-result-count]");
  const buttons = [...app.querySelectorAll("[data-resource-category]")];
  let category = RESOURCE_CATEGORY_ORDER.includes(initialCategory) ? initialCategory : "all";
  search.value = initialQuery;

  const update = () => {
    const query = search.value.trim().toLocaleLowerCase("zh-CN");
    const filtered = items.filter((item) => (
      (category === "all" || item.category === category || (category === "text-office" && ["writing", "office"].includes(item.category)))
      && (!query || resourceSearchText(item).includes(query))
    ));
    count.textContent = `${filtered.length} ${tr("条结果", "results")}`;
    grid.innerHTML = filtered.length
      ? filtered.map(renderResourceCard).join("")
      : `<div class="library-empty"><h3>${tr("没有找到匹配的 Prompt", "No matching Prompts")}</h3><p>${tr("换一个关键词，或者切换到其他分类。", "Try another keyword or category.")}</p></div>`;
    bindResourceCardActions(grid, items);
    layoutResourceMasonry(grid);
  };

  search.addEventListener("input", () => {
    const query = search.value.trim();
    history.replaceState(null, "", `${location.pathname}${location.search}${query ? `#/search/${encodeURIComponent(query)}` : (category === "all" ? "#/discover" : `#/category/${category}`)}`);
    update();
  });
  buttons.forEach((button) => button.addEventListener("click", () => {
    category = button.dataset.resourceCategory;
    buttons.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    history.replaceState(null, "", `${location.pathname}${location.search}${category === "all" ? "#/discover" : `#/category/${category}`}`);
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
      ${pageExitNavMarkup()}
      <p class="eyebrow">CREATOR STUDIO · ${record.version_id ? `V${record.version_no}` : "NEW"}</p>
      <h1>${record.version_id ? tr("编辑发布草稿", "Edit publication draft") : tr("新建公开作品", "Create public work")}</h1>
      <p class="lede">${tr(
        "保存只进入发布流程域。完成公开预览并再次确认后，作品会立即出现在发现页；违规内容可在发布后被限制访问。",
        "Saving only creates publication-process data. After preview and second confirmation, the work appears in Discover immediately; violating content may be restricted afterward.",
      )}</p>
      <form id="workEditor" class="form-grid" data-version-id="${escapeHtml(record.version_id || "")}" data-work-id="${escapeHtml(record.work_id || "")}" data-revision="${Number(record.revision || 1)}">
        <label class="field full"><span>${tr("标题", "Title")} *</span><input name="title" maxlength="120" required value="${escapeHtml(record.title || "")}" /></label>
        <label class="field full"><span>${tr("一句话用途/简介", "One-line purpose / summary")} *</span><input name="summary" maxlength="300" required value="${escapeHtml(record.summary || "")}" /></label>
        <label class="field"><span>${tr("内容类型", "Content type")}</span><select name="content_type">${Object.keys(CONTENT_TYPE_LABELS).map((value) => `<option value="${value}" ${record.content_type === value ? "selected" : ""}>${contentTypeLabel(value)}</option>`).join("")}</select></label>
        <label class="field"><span>${tr("授权类型", "License")}</span><select name="license_code">${Object.keys(LICENSE_LABELS).map((value) => `<option value="${value}" ${record.license_code === value ? "selected" : ""}>${licenseLabel(value)}</option>`).join("")}</select></label>
        <label class="field full"><span>${tr("完整 Prompt", "Full Prompt")} *</span><textarea class="prompt-input" name="prompt_text" required placeholder="${tr("使用 {{变量名}} 插入可修改变量", "Use {{variable}} to insert an editable variable")}">${escapeHtml(record.prompt_text || "")}</textarea><small>${tr("示例：一张 {{主体}} 的电影感画面，使用 {{光线}}。", "Example: A cinematic image of {{subject}}, using {{lighting}}.")}</small></label>
        <label class="field full"><span>${tr("负面 Prompt", "Negative Prompt")}</span><textarea name="negative_prompt_text" maxlength="20000">${escapeHtml(record.negative_prompt_text || "")}</textarea></label>
        <div class="field full"><span>${tr("变量与默认值", "Variables and defaults")}</span><div class="variable-list" id="variableList">${variables.map(renderVariableEditorRow).join("")}</div><button class="button" type="button" data-add-variable>${tr("添加变量", "Add variable")}</button></div>
        <label class="field"><span>${tr("模型", "Model")}</span><input name="model_name" maxlength="120" value="${escapeHtml(record.model_name || "")}" placeholder="${tr("例如 Midjourney", "e.g. Midjourney")}" /></label>
        <label class="field"><span>${tr("模型版本", "Model version")}</span><input name="model_version" maxlength="120" value="${escapeHtml(record.model_version || "")}" placeholder="${tr("例如 v7", "e.g. v7")}" /></label>
        <label class="field full"><span>${tr("基础参数", "Parameters")}</span><textarea name="parameters" placeholder="${tr("每行一个，例如：aspect_ratio=16:9", "One per line, e.g. aspect_ratio=16:9")}">${escapeHtml(formatKeyValueLines(record.parameters))}</textarea></label>
        <label class="field full"><span>${tr("依赖（JSON 数组）", "Dependencies (JSON array)")}</span><textarea name="dependencies" placeholder='[{"name":"LoRA 名称","version":"1.0"}]'>${escapeHtml(JSON.stringify(record.dependencies || [], null, 2))}</textarea></label>
        <label class="field full"><span>${tr("使用说明", "Instructions")}</span><textarea name="instructions" maxlength="10000">${escapeHtml(record.instructions || "")}</textarea></label>
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
  let dependencies = [];
  try {
    dependencies = JSON.parse(String(data.get("dependencies") || "[]"));
    if (!Array.isArray(dependencies)) throw new Error();
  } catch {
    throw new Error(tr("依赖必须是有效的 JSON 数组。", "Dependencies must be a valid JSON array."));
  }
  return {
    p_title: data.get("title"), p_summary: data.get("summary"),
    p_content_type: data.get("content_type"), p_prompt_text: data.get("prompt_text"),
    p_negative_prompt_text: data.get("negative_prompt_text"),
    p_variables: variables, p_model_name: data.get("model_name"),
    p_model_version: data.get("model_version"), p_parameters: parseKeyValueLines(data.get("parameters")),
    p_dependencies: dependencies, p_tags: parseTags(data.get("tags")),
    p_license_code: data.get("license_code"), p_instructions: data.get("instructions"),
  };
}

async function saveEditor(form) {
  const payload = collectEditor(form);
  const versionId = form.dataset.versionId;
  if (!versionId) {
    const result = firstRow(await rpc("yucang_create_work_v2", payload));
    form.dataset.versionId = result.version_id;
    form.dataset.workId = result.work_id;
    form.dataset.revision = "1";
    return result.version_id;
  }
  const revision = await rpc("yucang_update_draft_v2", {
    p_version_id: versionId,
    p_expected_revision: Number(form.dataset.revision),
    ...payload,
  });
  form.dataset.revision = String(revision);
  return versionId;
}

function handoffErrorMessage(error) {
  const code = String(error?.message || error || "");
  const messages = {
    prompt_vault_not_installed: tr("没有检测到 Prompt Vault 扩展，请安装或更新后重试。", "Prompt Vault was not detected. Install or update it and try again."),
    claimed_elsewhere: tr("这次交接已在另一个语藏标签页中打开。", "This handoff is already open in another Yucang tab."),
    expired: tr("这次交接已超过 5 分钟，请回到扩展重新发起。", "This handoff expired after 5 minutes. Start it again from Prompt Vault."),
    handoff_expired: tr("这次交接已超过 5 分钟，请回到扩展重新发起。", "This handoff expired after 5 minutes. Start it again from Prompt Vault."),
    creator_required: tr("当前账号还没有受邀创作者资格。", "This account does not have invited creator access."),
    media_must_be_embedded: tr("这张图片不是可上传的本地图片，请回到扩展重新保存图片后再发布。", "This image is not embedded for upload. Save it locally in Prompt Vault and try again."),
    invalid_media: tr("图片文件无效，仅支持真实的 JPEG、PNG 或 WebP。", "Invalid image. Only real JPEG, PNG, or WebP files are supported."),
    media_too_large: tr("图片过大：单张最多 5 MB，合计最多 10 MB。", "Images are too large: 5 MB each and 10 MB combined."),
    paid_not_available: tr("付费发布尚未开放。", "Paid publication is not available yet."),
  };
  return messages[code] || code;
}

function handoffContentMarkup(content) {
  const variables = Array.isArray(content.variables) ? content.variables : [];
  const dependencies = Array.isArray(content.dependencies) ? content.dependencies : [];
  return `
    <div class="handoff-preview">
      <nav class="handoff-back-nav" aria-label="${tr("页面导航", "Page navigation")}"><a href="#/home">${tr("返回首页", "Home")}</a><a href="#/discover">${tr("返回提示词库", "Prompt Library")}</a></nav>
      <div class="detail-meta"><span class="pill accent">${escapeHtml(contentTypeLabel(content.contentType))}</span><span class="pill">${escapeHtml(licenseLabel(content.licenseCode))}</span></div>
      <h1>${escapeHtml(content.title)}</h1>
      <p class="lede">${escapeHtml(content.summary)}</p>
      ${mediaGalleryMarkup((content.images || []).filter((item) => typeof item === "string" && /^data:image\/(?:png|jpeg|webp);base64,/i.test(item)), tr("本次发布图片", "Images in this publication"))}
      <dl class="data-list">
        <div><dt>${tr("模型", "Model")}</dt><dd>${escapeHtml([content.model?.name, content.model?.version].filter(Boolean).join(" · ") || "—")}</dd></div>
        <div><dt>${tr("标签", "Tags")}</dt><dd>${escapeHtml((content.tags || []).join(" / ") || "—")}</dd></div>
        <div><dt>${tr("变量", "Variables")}</dt><dd>${variables.length ? variables.map((item) => `${escapeHtml(item.name)} = ${escapeHtml(item.defaultValue || "")}`).join("<br>") : "—"}</dd></div>
        <div><dt>${tr("依赖", "Dependencies")}</dt><dd>${dependencies.length ? dependencies.map((item) => escapeHtml(item.name || "")).join(" / ") : "—"}</dd></div>
      </dl>
      <h2>${tr("完整 Prompt", "Full Prompt")}</h2>
      <pre class="prompt-output">${escapeHtml(content.prompt)}</pre>
      ${content.negativePrompt ? `<h2>${tr("负面 Prompt", "Negative Prompt")}</h2><pre class="prompt-output compact">${escapeHtml(content.negativePrompt)}</pre>` : ""}
      ${content.instructions ? `<h2>${tr("使用说明", "Instructions")}</h2><p class="review-copy">${escapeHtml(content.instructions)}</p>` : ""}
    </div>`;
}

async function createHandoffDraft(claim, content = claim.content, payloadHash = claim.payloadHash) {
  const response = await fetch(HANDOFF_DRAFT_ENDPOINT, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${state.session.access_token}`,
      "apikey": window.ZaiyeSupabase.config.publishableKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      protocolVersion: 1,
      requestId: claim.requestId,
      handoffId: claim.handoffId,
      publicationMode: "free_public",
      targetWorkId: null,
      payloadHash,
      content,
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.error || `handoff_http_${response.status}`);
  return result;
}

async function renderPublishHandoff(handoffId) {
  if (!state.session) {
    sessionStorage.setItem("yucangPostLoginPath", `publish/handoff/${handoffId}`);
    go("login");
    return;
  }
  if (!state.access?.is_creator) {
    requireCreator();
    return;
  }
  sessionStorage.removeItem("yucangPostLoginPath");
  app.innerHTML = `<section class="loading-state"><span class="spinner"></span><p>${tr("正在从 Prompt Vault 领取本次选择的一条 Prompt…", "Claiming the one selected Prompt from Prompt Vault…")}</p></section>`;
  try {
    let claim = state.publishHandoff?.handoffId === handoffId ? state.publishHandoff : null;
    if (!claim) {
      claim = await promptVaultPublishBridge.claim(handoffId);
      state.publishHandoff = claim;
    }
    if (claim.expiresAt && new Date(claim.expiresAt).getTime() <= Date.now()) throw new Error("handoff_expired");
    const content = claim.content;
    const imageCount = Array.isArray(content.images) ? content.images.length : 0;
    app.innerHTML = `
      <section class="handoff-layout">
        <div class="panel">${handoffContentMarkup(content)}</div>
        <aside class="panel sticky-panel handoff-choice">
          <p class="eyebrow">PROMPT VAULT · SINGLE ITEM HANDOFF</p>
          <h2>${tr("选择这一次的发布方式", "Choose how to handle this item")}</h2>
          <p class="lede">${tr("这只是扩展中本次明确选择的一条 Prompt。网站不能浏览你的完整私库。", "This is only the one Prompt you explicitly selected. The website cannot browse your private library.")}</p>
          <label class="handoff-option"><input type="radio" name="publicationMode" value="private" /><span><strong>${tr("仅自己", "Only me")}</strong><small>${tr("不上传到网站，结束本次交接。", "Do not upload; end this handoff.")}</small></span></label>
          <label class="handoff-option"><input type="radio" name="publicationMode" value="free_public" checked /><span><strong>${tr("免费公开", "Free public")}</strong><small>${tr("创建发布草稿，随后继续公开预览和二次确认。", "Create a publication draft, then continue to public preview and second confirmation.")}</small></span></label>
          ${imageCount ? `<div class="handoff-media-warning"><strong>${tr(`这条 Prompt 含 ${imageCount} 张图片`, `This Prompt contains ${imageCount} image(s)`)}</strong><p>${tr("继续后，图片会与这一个发布草稿一起安全上传；不会读取扩展里的其他内容。", "The images will be securely uploaded with this one draft. No other extension content is read.")}</p></div>` : ""}
          <div class="actions"><button class="button primary" type="button" data-handoff-continue>${tr("继续", "Continue")}</button><button class="button" type="button" data-handoff-cancel>${tr("取消交接", "Cancel handoff")}</button></div>
          <p class="handoff-status" data-handoff-status>${tr("在创建网站草稿前，Prompt 仍只存在于扩展本地。", "Before a website draft is created, the Prompt remains only in the extension.")}</p>
        </aside>
      </section>`;
    const status = app.querySelector("[data-handoff-status]");
    const continueButton = app.querySelector("[data-handoff-continue]");
    const cancelButton = app.querySelector("[data-handoff-cancel]");
    continueButton.addEventListener("click", async () => {
      const mode = app.querySelector('input[name="publicationMode"]:checked')?.value;
      setBusy(continueButton, true, mode === "private" ? tr("正在保留…", "Keeping private…") : tr("正在创建草稿…", "Creating draft…"));
      try {
        if (mode === "private") {
          await promptVaultPublishBridge.discard(claim);
          state.publishHandoff = null;
          notify(tr("未上传，Prompt 仍只保留在你的扩展中。", "Nothing was uploaded. The Prompt remains only in your extension."));
          go("my-publications");
          return;
        }
        const result = await createHandoffDraft(claim, content, claim.payloadHash);
        await promptVaultPublishBridge.complete(claim, result);
        state.publishHandoff = null;
        notify(tr("发布草稿已创建，请继续检查并生成公开预览。", "Publication draft created. Review it and continue to public preview."));
        go(`publish/${result.versionId}`);
      } catch (error) {
        status.textContent = handoffErrorMessage(error);
        status.classList.add("error");
        setBusy(continueButton, false);
      }
    });
    cancelButton.addEventListener("click", async () => {
      setBusy(cancelButton, true, tr("正在取消…", "Cancelling…"));
      try {
        await promptVaultPublishBridge.discard(claim);
        state.publishHandoff = null;
        go("home");
      } catch (error) {
        status.textContent = handoffErrorMessage(error);
        status.classList.add("error");
        setBusy(cancelButton, false);
      }
    });
  } catch (error) {
    renderError(new Error(handoffErrorMessage(error)), tr("无法继续这次 Prompt 交接", "Unable to continue this Prompt handoff"));
  }
}

async function renderEditor(versionId = "") {
  if (!requireCreator()) return;
  app.innerHTML = `<section class="loading-state"><span class="spinner"></span><p>${tr("正在打开发布草稿…", "Opening publication draft…")}</p></section>`;
  try {
    const record = versionId ? firstRow(await rpc("yucang_get_my_version_v2", { p_version_id: versionId })) : {};
    if (versionId && !record) throw new Error(tr("没有找到可访问的版本。", "No accessible version was found."));
    if (record?.status && record.status !== "draft") throw new Error(tr("当前版本不处于可编辑 draft 状态。", "The current version is not an editable draft."));
    const images = versionId ? await loadVersionMedia(versionId) : [];
    app.innerHTML = `${mediaGalleryMarkup(images)}${editorMarkup(record || {})}`;
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
      ${view.negative_prompt_text ? `<div><dt>${tr("负面 Prompt", "Negative Prompt")}</dt><dd>${escapeHtml(view.negative_prompt_text)}</dd></div>` : ""}
      ${view.instructions ? `<div><dt>${tr("使用说明", "Instructions")}</dt><dd>${escapeHtml(view.instructions)}</dd></div>` : ""}
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
    const images = await loadVersionMedia(versionId);
    app.innerHTML = `
      <section class="panel">
        <p class="eyebrow">PUBLIC PREVIEW · SECOND CONFIRMATION</p>
        ${mediaGalleryMarkup(images)}
        <div class="detail-header">${snapshotDetail(view)}</div>
        <label class="confirm-box">
          <input type="checkbox" data-confirm-publish />
          <span>${tr(
            "我确认以上全部内容将作为不可变公开版本立即发布。发布后如有违规，可由平台限制访问。",
            "I confirm that all content above will be published immediately as an immutable public version. The platform may restrict it later for violations.",
          )}</span>
        </label>
        <div class="actions">
          <button class="button primary" type="button" data-submit-review disabled>${tr("确认并立即发布", "Confirm & publish")}</button>
          <a class="button" href="#/publish/${encodeURIComponent(versionId)}">${tr("返回修改", "Back to edit")}</a>
        </div>
      </section>`;
    const checkbox = app.querySelector("[data-confirm-publish]");
    const button = app.querySelector("[data-submit-review]");
    checkbox.addEventListener("change", () => { button.disabled = !checkbox.checked; });
    button.addEventListener("click", async () => {
      setBusy(button, true, tr("正在冻结并发布…", "Freezing and publishing…"));
      try {
        await rpc("yucang_submit_for_review", {
          p_version_id: versionId,
          p_expected_hash: preview.content_hash,
        });
        notify(tr("已发布。版本内容现已冻结，并进入公开提示词库。", "Published. The version is now immutable and visible in the public library."));
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
        ${pageExitNavMarkup()}
        <div class="section-head"><div><p class="eyebrow">CREATOR STUDIO</p><h1 style="font-size:52px">${tr("我的发布", "My Works")}</h1></div><a class="button primary" href="#/publish/new">${tr("新建公开作品", "Create public work")}</a></div>
        ${items.length ? `<div class="table-list">${items.map((item) => `
          <article class="table-row">
            <div><span class="status">${escapeHtml(item.version_status)}</span><h3>${escapeHtml(item.title || tr("未命名草稿", "Untitled draft"))}</h3><p>v${item.version_no} · ${escapeHtml(item.summary || tr("暂无简介", "No description"))} · ${formatDate(item.updated_at)}</p></div>
            <div class="actions" style="margin:0">
              ${item.version_status === "draft" ? `<a class="button" href="#/publish/${item.version_id}">${tr("编辑", "Edit")}</a><a class="button primary" href="#/preview/${item.version_id}">${tr("预览并发布", "Preview & publish")}</a>` : ""}
              ${item.version_status === "pending_review" ? `<button class="button" type="button" data-withdraw="${item.version_id}">${tr("撤回审核", "Withdraw review")}</button>` : ""}
              ${item.version_status === "changes_requested" ? `<button class="button" type="button" data-reopen="${item.version_id}">${tr("继续修改", "Continue editing")}</button>` : ""}
              ${item.version_status === "approved" && item.current_public_version_id === item.version_id ? `<a class="button" href="#/prompt/${item.work_id}">${tr("查看公开页", "View public page")}</a><button class="button" type="button" data-work-visibility="private" data-work-id="${item.work_id}">${tr("改为不公开", "Make private")}</button>` : ""}
              ${item.version_status === "approved" && item.work_status === "withdrawn" ? `<button class="button" type="button" data-work-visibility="public" data-work-id="${item.work_id}">${tr("重新公开", "Make public")}</button>` : ""}
              <button class="button danger" type="button" data-delete-work="${item.work_id}">${tr("删除", "Delete")}</button>
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
    app.querySelectorAll("[data-work-visibility]").forEach((button) => button.addEventListener("click", async () => {
      setBusy(button, true);
      try {
        await rpc("yucang_set_my_work_public", {
          p_work_id: button.dataset.workId,
          p_public: button.dataset.workVisibility === "public",
        });
        notify(button.dataset.workVisibility === "public" ? tr("作品已重新公开。", "The work is public again.") : tr("作品已改为不公开。", "The work is now private."));
        renderMyPublications();
      } catch (error) { notify(error.message); setBusy(button, false); }
    }));
    app.querySelectorAll("[data-delete-work]").forEach((button) => button.addEventListener("click", async () => {
      if (!window.confirm(tr("确定删除这条发布吗？删除后不会再出现在提示词库或“我的发布”。", "Delete this work? It will disappear from the library and My Works."))) return;
      setBusy(button, true);
      try {
        await rpc("yucang_delete_work", { p_work_id: button.dataset.deleteWork, p_reason: "" });
        notify(tr("发布已删除，审计记录已安全保留。", "The work was deleted; its audit record was retained."));
        renderMyPublications();
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
      <div class="resource-detail-overview${item.featuredImage ? " has-image" : ""}">
        <div class="resource-detail-left">
          ${item.featuredImage ? `<figure class="resource-featured-image"><img src="${escapeHtml(item.featuredImage)}" alt="${escapeHtml(item.title)}" /></figure>` : ""}
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
        </div>
        <div class="resource-detail-right">
          <div class="resource-detail-copy">
            <div class="detail-meta">
              <span class="pill accent">${escapeHtml(resourceCategoryLabel(item.category))}</span>
              <span class="pill">${tr("语藏官方", "Yucang official")}</span>
            </div>
            <h1>${escapeHtml(item.title)}</h1>
            <p>${escapeHtml(item.summary)}</p>
            <dl class="resource-facts">
              <div><dt>${tr("模型", "Model")}</dt><dd>${escapeHtml(item.model || tr("通用模型", "General model"))}</dd></div>
              <div><dt>${tr("来源", "Source")}</dt><dd>${escapeHtml(item.sourceName || tr("语藏", "Yucang"))}</dd></div>
              <div><dt>${tr("授权", "License")}</dt><dd>${escapeHtml(item.license || tr("请查看发布说明", "See publishing terms"))}</dd></div>
            </dl>
          </div>
          <aside class="prompt-stage">
            <div class="tool-heading">
              <div><h2>${tr("最终 Prompt", "Final Prompt")}</h2><p>${escapeHtml(item.usage || tr("检查内容后直接复制使用。", "Review, then copy and use."))}</p></div>
              <div class="prompt-actions"><button class="button" type="button" data-save-to-vault="${escapeHtml(item.id)}">${tr("收进 Prompt Vault", "Save to Prompt Vault")}</button><button class="button" type="button" data-favorite-resource="official:${escapeHtml(item.id)}">☆ ${tr("网站收藏", "Website favorite")}</button><button class="button primary" type="button" data-copy-prompt>${tr("复制 Prompt", "Copy Prompt")}</button><button class="button ghost" type="button" data-report-official="${escapeHtml(item.id)}">${tr("举报内容", "Report content")}</button></div>
            </div>
            <pre class="prompt-output resource-prompt-output" data-final-prompt></pre>
            <div class="resource-tags">${(item.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
            ${licenseRightsMarkup(item.license, { official: true })}
          </aside>
        </div>
      </div>
    </section>`;
  bindPromptTool({
    template: item.prompt,
    variables,
    output: app.querySelector("[data-final-prompt]"),
    copyButton: app.querySelector("[data-copy-prompt]"),
  });
  bindPromptVaultButtons(app, () => officialPromptPayload(
    item,
    app.querySelector("[data-final-prompt]")?.textContent || resolvedOfficialPrompt(item),
  ));
  hydrateResourceFavorites(app);
  app.querySelector("[data-report-official]")?.addEventListener("click", () => openGovernanceDialog({
    targetType: "official_resource", targetRef: item.id, targetLabel: item.title,
  }));
}

async function createCommunityComment(workId, kind, body, parentId = null) {
  return firstRow(await rpc("yucang_create_comment", {
    p_work_id: workId,
    p_kind: kind,
    p_body: body,
    p_parent_id: parentId,
  }));
}

function bindCommunityDiscussion(workId, focusCommentId = "") {
  const discussion = app.querySelector("[data-community-discussion]");
  if (!discussion) return;

  discussion.querySelectorAll("[data-report-comment]").forEach((button) => button.addEventListener("click", () => {
    openGovernanceDialog({
      targetType: "comment",
      targetId: button.dataset.reportComment,
      targetLabel: tr("作品讨论中的评论", "Comment in this work's discussion"),
    });
  }));

  discussion.querySelector("[data-comment-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("[data-comment-submit]");
    const body = form.querySelector("[data-comment-body]").value.trim();
    const kind = form.querySelector('[name="interaction-kind"]:checked')?.value || "comment";
    if (!body) return;
    setBusy(button, true, tr("正在发布…", "Posting…"));
    try {
      const created = await createCommunityComment(workId, kind, body);
      notify(kind === "question" ? tr("问题已公开发布。", "Question posted publicly.") : tr("评论已发布。", "Comment posted."));
      await renderPublicPrompt(workId, created?.comment_id || "");
    } catch (error) {
      notify(/rate_limited/i.test(error.message || "")
        ? tr("发布太频繁，请稍后再试。", "You are posting too quickly. Try again shortly.")
        : error.message);
      setBusy(button, false);
    }
  });

  discussion.querySelectorAll("[data-reply-to]").forEach((trigger) => trigger.addEventListener("click", () => {
    const parentId = trigger.dataset.replyTo;
    const slot = discussion.querySelector(`[data-reply-form-for="${CSS.escape(parentId)}"]`);
    if (!slot) return;
    discussion.querySelectorAll("[data-reply-form-for]").forEach((item) => {
      if (item !== slot) { item.hidden = true; item.replaceChildren(); }
    });
    slot.hidden = false;
    slot.innerHTML = `
      <form data-inline-reply-form>
        <label class="interaction-input">
          <span class="sr-only">${tr("回复内容", "Reply")}</span>
          <textarea maxlength="2000" required data-reply-body placeholder="${escapeHtml(tr(`回复 ${trigger.dataset.replyAuthor || ""}`, `Reply to ${trigger.dataset.replyAuthor || ""}`))}"></textarea>
        </label>
        <div class="interaction-inline-actions">
          <button class="button ghost" type="button" data-reply-cancel>${tr("取消", "Cancel")}</button>
          <button class="button primary" type="submit" data-reply-submit>${tr("公开回复", "Post reply")}</button>
        </div>
      </form>`;
    slot.querySelector("[data-reply-cancel]").addEventListener("click", () => {
      slot.hidden = true;
      slot.replaceChildren();
    });
    slot.querySelector("textarea").focus();
    slot.querySelector("[data-inline-reply-form]").addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = event.currentTarget.querySelector("[data-reply-submit]");
      const body = event.currentTarget.querySelector("[data-reply-body]").value.trim();
      if (!body) return;
      setBusy(button, true, tr("正在回复…", "Replying…"));
      try {
        const created = await createCommunityComment(workId, "reply", body, parentId);
        notify(tr("回复已公开发布。", "Reply posted publicly."));
        await renderPublicPrompt(workId, created?.comment_id || "");
      } catch (error) {
        notify(/rate_limited/i.test(error.message || "")
          ? tr("发布太频繁，请稍后再试。", "You are posting too quickly. Try again shortly.")
          : error.message);
        setBusy(button, false);
      }
    });
  }));

  if (focusCommentId) {
    requestAnimationFrame(() => {
      const target = document.getElementById(`comment-${focusCommentId}`);
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      target?.classList.add("is-notification-target");
    });
  }
}

function communityPublicationDetailsMarkup(item) {
  const parameters = Object.entries(item.parameters || {});
  const dependencies = Array.isArray(item.dependencies) ? item.dependencies : [];
  return `${licenseRightsMarkup(item.license_code, { hasDependencies: dependencies.length > 0 })}<section class="publication-details" aria-labelledby="publicationDetailsTitle">
    <h2 id="publicationDetailsTitle">${tr("发布说明", "Publication details")}</h2>
    <dl>
      ${item.negative_prompt_text ? `<div><dt>${tr("负面 Prompt", "Negative Prompt")}</dt><dd>${escapeHtml(item.negative_prompt_text)}</dd></div>` : ""}
      ${parameters.length ? `<div><dt>${tr("生成参数", "Parameters")}</dt><dd>${parameters.map(([key, value]) => `${escapeHtml(key)}: ${escapeHtml(typeof value === "object" ? JSON.stringify(value) : value)}`).join("<br>")}</dd></div>` : ""}
      ${dependencies.length ? `<div><dt>${tr("第三方依赖", "Dependencies")}</dt><dd>${dependencies.map((dependency) => escapeHtml([dependency.name, dependency.version, dependency.notes].filter(Boolean).join(" "))).join("<br>")}</dd></div>` : ""}
      ${item.instructions ? `<div><dt>${tr("使用方法与注意事项", "Usage and notes")}</dt><dd>${escapeHtml(item.instructions)}</dd></div>` : ""}
      <div><dt>${tr("标签", "Tags")}</dt><dd>${(item.tags || []).length ? (item.tags || []).map(escapeHtml).join(" / ") : tr("未填写", "Not provided")}</dd></div>
    </dl>
  </section>`;
}

async function renderPublicPrompt(workId, focusCommentId = "", versionId = "") {
  app.innerHTML = `<section class="loading-state"><span class="spinner"></span><p>${tr("正在读取 Prompt...", "Loading Prompt...")}</p></section>`;
  try {
    const resources = await loadResources();
    const officialResource = resources.find((item) => item.id === workId);
    if (officialResource) {
      renderOfficialResource(officialResource);
      return;
    }
    const item = firstRow(await rpc(
      versionId ? "yucang_get_public_work_version" : "yucang_get_public_work",
      versionId ? { p_work_id: workId, p_version_id: versionId } : { p_work_id: workId },
    ));
    if (!item) throw new Error(tr(
      "作品不存在、尚未公开或当前不可公开访问。",
      "This work does not exist, is not public, or is not publicly accessible.",
    ));
    const variables = normalizeVariables(item.variables);
    const images = await loadVersionMedia(item.version_id);
    const versions = await rpc("yucang_list_public_versions", { p_work_id: workId });
    let comments = [];
    try {
      comments = (await rpc("yucang_list_comments", { p_work_id: workId })).map((comment) => ({
        ...comment,
        created_at_label: formatDate(comment.created_at),
      }));
    } catch (error) {
      if (!isSchemaMissing(error)) throw error;
    }
    app.innerHTML = `
      <section class="resource-detail-head">
        <a class="back-link" href="#/discover">${tr("返回提示词库", "Back to Prompt Library")}</a>
        <div class="resource-detail-overview${images.length ? " has-image" : ""}">
          <div class="resource-detail-left">
            ${images.length ? `<div class="community-detail-media">${mediaGalleryMarkup(images)}</div>` : ""}
            <div class="resource-variable-panel">
              <div class="tool-heading"><h2>${tr("修改变量", "Adjust variables")}</h2><p>${tr("输入内容后，右侧 Prompt 会立即更新。", "The Prompt updates as you type.")}</p></div>
              <div class="resource-variable-list" data-variable-inputs>
                ${variables.length ? variables.map((entry) => `<label class="resource-variable"><span>${escapeHtml(entry.name)}</span><input data-variable-value="${escapeHtml(entry.name)}" value="${escapeHtml(entry.defaultValue)}" /></label>`).join("") : `<p class="lede">${tr("这个 Prompt 没有声明变量，可直接复制。", "This Prompt has no declared variables and can be copied directly.")}</p>`}
              </div>
            </div>
          </div>
          <div class="resource-detail-right">
            <div class="resource-detail-copy">
              <div class="detail-meta"><span class="pill accent">${escapeHtml(contentTypeLabel(item.content_type))}</span><span class="pill">${tr("创作者发布", "Creator publication")}</span><span class="pill">v${Number(item.version_no || 1)}</span></div>
              <h1>${escapeHtml(item.title)}</h1>
              <p>${escapeHtml(item.summary || tr("暂无简介", "No description"))}</p>
              <dl class="resource-facts">
                <div><dt>${tr("模型", "Model")}</dt><dd>${escapeHtml([item.model_name, item.model_version].filter(Boolean).join(" ") || tr("通用模型", "General model"))}</dd></div>
                <div><dt>${tr("作者", "Creator")}</dt><dd>${item.author_slug ? `<a class="creator-inline-link" href="#/creator/${encodeURIComponent(item.author_slug)}">${escapeHtml(item.author_nickname)}</a>` : `<span>${escapeHtml(item.author_nickname)}</span>`} <button class="inline-report-button" type="button" data-report-account="${escapeHtml(item.author_id)}">${tr("举报账号", "Report account")}</button></dd></div>
                <div><dt>${tr("授权", "License")}</dt><dd>${escapeHtml(licenseLabel(item.license_code))}</dd></div>
                <div><dt>${tr("发布时间", "Published")}</dt><dd>${escapeHtml(formatDate(item.published_at))}</dd></div>
              </dl>
            </div>
            <aside class="prompt-stage">
              <div class="tool-heading"><div><h2>${tr("最终 Prompt", "Final Prompt")}</h2><p>${tr("检查内容后直接复制使用。", "Review, then copy and use.")}</p></div><div class="prompt-actions"><button class="button" type="button" data-save-to-vault="${escapeHtml(item.work_id)}">${tr("收进 Prompt Vault", "Save to Prompt Vault")}</button><button class="button" type="button" data-favorite-resource="work:${escapeHtml(item.work_id)}">☆ ${tr("网站收藏", "Website favorite")}</button><button class="button primary" type="button" data-copy-prompt>${tr("复制 Prompt", "Copy Prompt")}</button><button class="button ghost" type="button" data-report-work="${escapeHtml(item.work_id)}">${tr("举报作品", "Report work")}</button>${state.access?.is_admin ? `<button class="button danger" type="button" data-admin-restrict="${escapeHtml(item.work_id)}">${tr("管理员下架", "Restrict work")}</button><button class="button danger" type="button" data-admin-delete="${escapeHtml(item.work_id)}">${tr("管理员删除", "Admin delete")}</button>` : ""}</div></div>
              <pre class="prompt-output resource-prompt-output" data-final-prompt></pre>
            </aside>
            ${communityPublicationDetailsMarkup(item)}
          </div>
        </div>
      </section>
      ${versions.length > 1 ? `<section class="version-history" aria-labelledby="versionHistoryTitle"><div><h2 id="versionHistoryTitle">${tr("公开版本", "Public versions")}</h2><p>${tr("只显示曾经公开且当前可访问的不可变版本。", "Only immutable versions that were public and remain accessible are shown.")}</p></div><nav>${versions.map((version) => `<a href="#/prompt/${encodeURIComponent(workId)}/version/${encodeURIComponent(version.version_id)}" ${version.version_id === item.version_id ? 'aria-current="page"' : ""}><strong>v${Number(version.version_no)}</strong><span>${version.is_current ? tr("当前版本", "Current") : formatDate(version.published_at)}</span></a>`).join("")}</nav></section>` : ""}
      ${commentsSectionMarkup({ comments, isLoggedIn: Boolean(state.session), locale: state.locale })}`;
    bindPromptTool({
      template: item.prompt_text,
      variables,
      output: app.querySelector("[data-final-prompt]"),
      copyButton: app.querySelector("[data-copy-prompt]"),
    });
    bindPromptVaultButtons(app, () => communityPromptPayload(item, images[0]?.url || ""));
    hydrateResourceFavorites(app);
    bindCommunityDiscussion(workId, focusCommentId);
    app.querySelector("[data-report-work]")?.addEventListener("click", () => openGovernanceDialog({
      targetType: "work", targetId: item.work_id, targetLabel: item.title,
    }));
    app.querySelector("[data-report-account]")?.addEventListener("click", () => openGovernanceDialog({
      targetType: "account", targetId: item.author_id,
      targetLabel: tr(`创作者：${item.author_nickname}`, `Creator: ${item.author_nickname}`),
    }));
    app.querySelector("[data-admin-restrict]")?.addEventListener("click", async (event) => {
      const reason = window.prompt(tr("请输入下架原因（会写入审计记录）", "Enter a restriction reason (saved to the audit log)"), "")?.trim();
      if (!reason) return;
      const button = event.currentTarget;
      setBusy(button, true, tr("正在下架…", "Restricting…"));
      try {
        await rpc("yucang_admin_set_work_restricted", { p_work_id: item.work_id, p_restricted: true, p_reason: reason });
        notify(tr("作品已从公开入口下架，历史与审计记录已保留。", "The work is no longer public; history and audit records were retained."));
        go("discover");
      } catch (error) { notify(error.message); setBusy(button, false); }
    });
    app.querySelector("[data-admin-delete]")?.addEventListener("click", async (event) => {
      const reason = window.prompt(tr("请输入删除原因（会写入审计记录）", "Enter a deletion reason (saved to the audit log)"), "")?.trim();
      if (!reason) return;
      if (!window.confirm(tr("确定删除这条作品吗？", "Delete this work?"))) return;
      const button = event.currentTarget;
      setBusy(button, true, tr("正在删除…", "Deleting…"));
      try {
        await rpc("yucang_delete_work", { p_work_id: item.work_id, p_reason: reason });
        notify(tr("作品已删除，历史与审计记录已保留。", "The work was deleted; history and audit records were retained."));
        go("discover");
      } catch (error) { notify(error.message); setBusy(button, false); }
    });
  } catch (error) {
    renderError(error, tr("无法打开 Prompt", "Unable to open Prompt"));
  }
}

function governanceStatusLabel(status) {
  const labels = {
    submitted: ["待处理", "Submitted"], reviewing: ["处理中", "Reviewing"],
    actioned: ["已处置", "Actioned"], dismissed: ["未发现违规", "Dismissed"],
    upheld: ["申诉成立", "Upheld"], denied: ["维持原处置", "Denied"],
  };
  return (labels[status] || [status, status])[state.locale === "en" ? 1 : 0];
}

function governanceTargetLabel(type) {
  const labels = { work: ["作品", "Work"], comment: ["评论", "Comment"], account: ["账号", "Account"], official_resource: ["站方模板", "Official template"] };
  return (labels[type] || [type, type])[state.locale === "en" ? 1 : 0];
}

function governanceReasonLabel(code) {
  const match = REPORT_REASONS.find(([value]) => value === code);
  return match ? match[1][state.locale === "en" ? 1 : 0] : code;
}

async function renderGovernanceCenter() {
  if (!requireLogin()) return;
  setAccountDrawer(false);
  app.innerHTML = `<section class="loading-state"><span class="spinner"></span><p>${tr("正在读取举报与申诉…", "Loading reports and appeals…")}</p></section>`;
  try {
    const [reports, appeals, moderated] = await Promise.all([
      rpc("yucang_list_my_reports"), rpc("yucang_list_my_appeals"), rpc("yucang_list_my_moderated_content"),
    ]);
    app.innerHTML = `
      <section class="governance-page">
        ${pageExitNavMarkup()}
        <div class="section-head"><div><p class="eyebrow">COMMUNITY SAFETY</p><h1>${tr("举报与申诉", "Reports & appeals")}</h1><p>${tr("查看你提交的举报，并对属于你的被处置内容申请人工复核。", "Track your reports and request staff review of moderated content you own.")}</p></div><a class="button" href="rules.html" target="_blank" rel="noopener">${tr("社区规则", "Community rules")}</a></div>
        ${moderated.length ? `<section class="governance-section"><div class="tool-heading"><div><h2>${tr("可以申诉的处置", "Actions eligible for appeal")}</h2><p>${tr("申诉不会自动恢复内容，由平台人员复核。", "Appeals do not automatically restore content; staff review them.")}</p></div></div><div class="governance-list">${moderated.map((item) => `
          <article class="governance-card"><div><span class="pill">${governanceTargetLabel(item.target_type)}</span><h3>${escapeHtml(item.target_label)}</h3><p>${formatDate(item.actioned_at)}</p></div><button class="button primary" type="button" data-appeal-target="${escapeHtml(item.target_id)}" data-appeal-type="${escapeHtml(item.target_type)}" data-appeal-report="${escapeHtml(item.report_id || "")}" data-appeal-label="${escapeHtml(item.target_label)}">${tr("提交申诉", "Appeal")}</button></article>`).join("")}</div></section>` : ""}
        <section class="governance-section"><div class="tool-heading"><h2>${tr("我的举报", "My reports")}</h2></div>${reports.length ? `<div class="governance-list">${reports.map((item) => `
          <article class="governance-card"><div><span class="pill">${governanceTargetLabel(item.target_type)}</span><span class="status">${governanceStatusLabel(item.status)}</span><h3>${governanceReasonLabel(item.reason_code)}</h3><p>${escapeHtml(item.details)}</p><small>${formatDate(item.created_at)}</small></div></article>`).join("")}</div>` : `<div class="empty-state"><p>${tr("你还没有提交过举报。作品和评论旁都提供举报入口。", "You have not submitted a report. Report controls appear beside works and comments.")}</p></div>`}</section>
        <section class="governance-section"><div class="tool-heading"><h2>${tr("我的申诉", "My appeals")}</h2></div>${appeals.length ? `<div class="governance-list">${appeals.map((item) => `
          <article class="governance-card"><div><span class="pill">${governanceTargetLabel(item.target_type)}</span><span class="status">${governanceStatusLabel(item.status)}</span><p>${escapeHtml(item.body)}</p>${item.resolution_notes ? `<p class="governance-resolution"><strong>${tr("复核说明", "Review notes")}</strong>${escapeHtml(item.resolution_notes)}</p>` : ""}<small>${formatDate(item.created_at)}</small></div></article>`).join("")}</div>` : `<div class="empty-state"><p>${tr("目前没有申诉记录。", "No appeals yet.")}</p></div>`}</section>
      </section>`;
    app.querySelectorAll("[data-appeal-target]").forEach((button) => button.addEventListener("click", () => openGovernanceDialog({
      mode: "appeal", targetType: button.dataset.appealType, targetId: button.dataset.appealTarget,
      targetLabel: button.dataset.appealLabel, reportId: button.dataset.appealReport || null,
    })));
  } catch (error) {
    renderError(error, tr("无法读取举报与申诉", "Unable to load reports and appeals"));
  }
}

function reportActionOptions(targetType) {
  const options = [
    ["reviewing", tr("标记为处理中", "Mark reviewing")],
    ["dismissed", tr("驳回：未发现违规", "Dismiss: no violation")],
    ["no_action", tr("结案：无需进一步处置", "Close: no further action")],
  ];
  if (targetType === "work") options.splice(1, 0, ["restrict_work", tr("下架作品", "Restrict work")]);
  if (targetType === "comment") options.splice(1, 0, ["hide_comment", tr("隐藏评论", "Hide comment")]);
  if (targetType === "account") options.splice(1, 0, ["account_warning", tr("记录账号警告", "Record account warning")]);
  return options.map(([value, label]) => `<option value="${value}">${escapeHtml(label)}</option>`).join("");
}

async function renderAdminGovernance() {
  if (!requireStaff()) return;
  setAccountDrawer(false);
  app.innerHTML = `<section class="loading-state"><span class="spinner"></span><p>${tr("正在读取治理工单…", "Loading governance cases…")}</p></section>`;
  try {
    const [reports, appeals] = await Promise.all([
      rpc("yucang_admin_list_reports", { p_status: null }),
      rpc("yucang_admin_list_appeals", { p_status: null }),
    ]);
    app.innerHTML = `
      <section class="governance-page admin-governance">
        ${pageExitNavMarkup()}
        <div class="section-head"><div><p class="eyebrow">GOVERNANCE DESK</p><h1>${tr("举报与申诉处理", "Reports & appeals desk")}</h1><p>${tr("所有决定都会写入不可变审计记录。处理人员不能修改用户原始内容。", "Every decision is written to append-only audit history. Staff cannot edit user content.")}</p></div><a class="button" href="#/admin/review">${tr("公开内容管理", "Content management")}</a></div>
        <section class="governance-section"><div class="tool-heading"><h2>${tr("举报工单", "Report cases")}</h2><span class="status">${reports.length}</span></div>${reports.length ? `<div class="governance-list">${reports.map((item) => `
          <article class="governance-card governance-case" data-report-case="${item.report_id}">
            <div><span class="pill">${governanceTargetLabel(item.target_type)}</span><span class="status">${governanceStatusLabel(item.status)}</span><h3>${escapeHtml(item.target_label)}</h3><p><strong>${governanceReasonLabel(item.reason_code)}</strong> · ${escapeHtml(item.details)}</p><small>${escapeHtml(item.contact_email || tr("已登录用户", "Signed-in user"))} · ${formatDate(item.created_at)}</small></div>
            ${["submitted", "reviewing"].includes(item.status) ? `<div class="governance-case-controls"><label class="field"><span>${tr("处理动作", "Action")}</span><select data-case-action>${reportActionOptions(item.target_type)}</select></label><label class="field"><span>${tr("处理说明", "Notes")}</span><textarea maxlength="3000" data-case-notes></textarea></label><button class="button primary" type="button" data-resolve-report>${tr("保存处理结果", "Save decision")}</button></div>` : ""}
          </article>`).join("")}</div>` : `<div class="empty-state"><p>${tr("暂无举报工单。", "No report cases.")}</p></div>`}</section>
        <section class="governance-section"><div class="tool-heading"><h2>${tr("申诉复核", "Appeal review")}</h2><span class="status">${appeals.length}</span></div>${appeals.length ? `<div class="governance-list">${appeals.map((item) => `
          <article class="governance-card governance-case" data-appeal-case="${item.appeal_id}"><div><span class="pill">${governanceTargetLabel(item.target_type)}</span><span class="status">${governanceStatusLabel(item.status)}</span><p>${escapeHtml(item.body)}</p><small>${formatDate(item.created_at)}</small></div>${["submitted", "reviewing"].includes(item.status) ? `<div class="governance-case-controls"><label class="field"><span>${tr("复核决定", "Decision")}</span><select data-appeal-decision><option value="reviewing">${tr("标记为复核中", "Mark reviewing")}</option><option value="upheld">${tr("申诉成立并恢复内容", "Uphold and restore")}</option><option value="denied">${tr("驳回并维持原处置", "Deny and keep action")}</option></select></label><label class="field"><span>${tr("复核说明", "Review notes")}</span><textarea maxlength="3000" data-appeal-notes></textarea></label><button class="button primary" type="button" data-resolve-appeal>${tr("保存复核结果", "Save review")}</button></div>` : `<p class="governance-resolution">${escapeHtml(item.resolution_notes || "")}</p>`}</article>`).join("")}</div>` : `<div class="empty-state"><p>${tr("暂无申诉。", "No appeals.")}</p></div>`}</section>
      </section>`;
    app.querySelectorAll("[data-resolve-report]").forEach((button) => button.addEventListener("click", async () => {
      const card = button.closest("[data-report-case]");
      const action = card.querySelector("[data-case-action]").value;
      const notes = card.querySelector("[data-case-notes]").value.trim();
      if (action !== "reviewing" && notes.length < 5) return notify(tr("结案或处置必须填写至少 5 个字的说明。", "Final decisions require at least five characters of notes."));
      setBusy(button, true);
      try { await rpc("yucang_admin_resolve_report", { p_report_id: card.dataset.reportCase, p_action: action, p_notes: notes }); await renderAdminGovernance(); }
      catch (error) { notify(governanceErrorMessage(error)); setBusy(button, false); }
    }));
    app.querySelectorAll("[data-resolve-appeal]").forEach((button) => button.addEventListener("click", async () => {
      const card = button.closest("[data-appeal-case]");
      const decision = card.querySelector("[data-appeal-decision]").value;
      const notes = card.querySelector("[data-appeal-notes]").value.trim();
      if (decision !== "reviewing" && notes.length < 5) return notify(tr("复核结论必须填写至少 5 个字的说明。", "Final appeal decisions require at least five characters of notes."));
      setBusy(button, true);
      try { await rpc("yucang_admin_resolve_appeal", { p_appeal_id: card.dataset.appealCase, p_decision: decision, p_notes: notes }); await renderAdminGovernance(); }
      catch (error) { notify(governanceErrorMessage(error)); setBusy(button, false); }
    }));
  } catch (error) {
    renderError(error, tr("无法打开治理后台", "Unable to open governance desk"));
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
    const items = state.access?.is_admin
      ? await rpc("yucang_list_public_works")
      : await rpc("yucang_admin_list_pending");
    if (state.access?.is_admin) {
      app.innerHTML = `
        <section>
          ${pageExitNavMarkup()}
          <div class="section-head"><div><p class="eyebrow">CONTENT MANAGEMENT</p><h1 style="font-size:52px">${tr("公开内容管理", "Public content management")}</h1><p>${tr("作品发布后直接进入提示词库；你可以在这里查看、下架或删除违规内容。", "Works enter the library immediately; inspect, restrict, or delete violating content here.")}</p></div><span class="status">${items.length} ${tr("项", "items")}</span></div>
          ${items.length ? `<div class="table-list">${items.map((item) => `
            <article class="table-row"><div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.author_nickname)} · v${item.version_no} · ${formatDate(item.published_at)}</p></div><div class="actions" style="margin:0"><a class="button" href="#/prompt/${item.work_id}">${tr("查看", "View")}</a><button class="button" data-manage-restrict="${item.work_id}">${tr("下架", "Restrict")}</button><button class="button danger" data-manage-delete="${item.work_id}">${tr("删除", "Delete")}</button></div></article>`).join("")}</div>` : `<div class="empty-state"><h3>${tr("暂无公开作品", "No public works")}</h3></div>`}
        </section>`;
      app.querySelectorAll("[data-manage-restrict]").forEach((button) => button.addEventListener("click", async () => {
        const reason = window.prompt(tr("请输入下架原因", "Enter a restriction reason"), "")?.trim();
        if (!reason) return;
        setBusy(button, true);
        try { await rpc("yucang_admin_set_work_restricted", { p_work_id: button.dataset.manageRestrict, p_restricted: true, p_reason: reason }); renderAdminReview(); }
        catch (error) { notify(error.message); setBusy(button, false); }
      }));
      app.querySelectorAll("[data-manage-delete]").forEach((button) => button.addEventListener("click", async () => {
        const reason = window.prompt(tr("请输入删除原因", "Enter a deletion reason"), "")?.trim();
        if (!reason || !window.confirm(tr("确定删除这条作品吗？", "Delete this work?"))) return;
        setBusy(button, true);
        try { await rpc("yucang_delete_work", { p_work_id: button.dataset.manageDelete, p_reason: reason }); renderAdminReview(); }
        catch (error) { notify(error.message); setBusy(button, false); }
      }));
      return;
    }
    app.innerHTML = `
      <section class="split-layout">
        <div>
          ${pageExitNavMarkup()}
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
          ${pageExitNavMarkup()}
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
  const [section, id, childId, detailId] = routeParts();
  applyRouteDefaultTheme(section);
  state.homeOrbitCleanup?.();
  state.homeOrbitCleanup = null;
  const homeRoute = section === "home" || section === "login";
  document.body.classList.toggle("route-home", homeRoute);
  document.body.classList.toggle("route-discover", section === "discover");
  document.body.classList.toggle("route-login", section === "login" && !state.session);
  document.querySelectorAll(".main-nav a").forEach((link) => {
    link.removeAttribute("aria-current");
    if (link.getAttribute("href") === `#/${section}`) link.setAttribute("aria-current", "page");
    if (["category", "search"].includes(section) && link.dataset.nav === "discover") link.setAttribute("aria-current", "page");
  });
  app.focus({ preventScroll: true });
  if (section === "home") return renderHome();
  if (section === "discover") return renderDiscover();
  if (section === "category" && id) return renderDiscover({ initialCategory: id });
  if (section === "search" && id) return renderDiscover({ initialQuery: decodeURIComponent(id) });
  if (section === "creators") {
    history.replaceState(null, "", `${location.pathname}${location.search}#/discover`);
    return renderDiscover();
  }
  if (section === "favorites") return renderFavorites();
  if (section === "account") return renderAccountPrivacy();
  if (section === "my") {
    if (!requireLogin()) return;
    setAccountDrawer(false);
    history.replaceState(null, "", `${location.pathname}${location.search}#/home`);
    return renderHome();
  }
  if (section === "ai-service") {
    history.replaceState(null, "", `${location.pathname}${location.search}#/home`);
    return renderHome();
  }
  if (section === "login") return renderLogin();
  if (section === "creator" && id) return renderCreatorProfile(id);
  if (section === "prompt" && id) return renderPublicPrompt(
    id,
    childId === "comment" ? detailId : "",
    childId === "version" ? detailId : "",
  );
  if (section === "publish" && id === "handoff" && childId) return renderPublishHandoff(childId);
  if (section === "publish" && id === "new") return renderEditor();
  if (section === "publish" && id) return renderEditor(id);
  if (section === "preview" && id) return renderPreview(id);
  if (section === "my-publications") return renderMyPublications();
  if (section === "governance") return renderGovernanceCenter();
  if (section === "admin" && id === "reports") return renderAdminGovernance();
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
    themeToggle.addEventListener("click", toggleTheme);
    document.querySelectorAll(".main-nav a").forEach((link) => {
      link.addEventListener("click", () => setAccountDrawer(false));
    });
    const client = getClient();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    state.session = data.session;
    const pendingAuthMethod = sessionStorage.getItem("yucangPendingAuthMethod") || "";
    let oauthReturnPath = "";
    if (state.session && ["github", "google"].includes(pendingAuthMethod)) {
      localStorage.setItem("yucangLastAuthMethod", pendingAuthMethod);
      sessionStorage.removeItem("yucangPendingAuthMethod");
      oauthReturnPath = postLoginPath();
    }
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
    await loadProfile();
    state.authReady = true;
    renderHeader();
    if (oauthReturnPath) {
      history.replaceState(null, "", `${location.pathname}${location.search}#/${oauthReturnPath.replace(/^\//, "")}`);
    }
    client.auth.onAuthStateChange((_event, session) => {
      state.session = session;
      setTimeout(async () => {
        await loadAccess();
        await loadProfile();
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
