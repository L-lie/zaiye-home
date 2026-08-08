const PROJECT_LABELS = {
  feature: "电影 / 网大",
  series: "剧集 / 短剧",
  variety: "综艺 / 晚会",
  stage: "舞台剧",
  promo: "广告 / 宣传片",
  immersive: "实景 / 沉浸",
};

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

const PUBLIC_CACHE_KEY = "zaiye-portfolio-publication-v2";
const EDITOR_PREVIEW_KEY = "zaiye-portfolio-editor-preview-v1";
const EMPTY_CONTENT = () => ({ version: 1, projects: [], items: [], media: {} });

const els = {
  editor: document.querySelector("[data-editor]"),
  connectionStatus: document.getElementById("connectionStatus"),
  loadDefault: document.getElementById("loadDefault"),
  importJson: document.getElementById("importJson"),
  exportJson: document.getElementById("exportJson"),
  saveDraft: document.getElementById("saveDraft"),
  publishDraft: document.getElementById("publishDraft"),
  jsonFile: document.getElementById("jsonFile"),
  addEntry: document.getElementById("addEntry"),
  listEyebrow: document.getElementById("listEyebrow"),
  itemCount: document.getElementById("itemCount"),
  searchItems: document.getElementById("searchItems"),
  itemList: document.getElementById("itemList"),
  rowTemplate: document.getElementById("rowTemplate"),
  itemEditor: document.querySelector("[data-item-editor]"),
  projectEditor: document.querySelector("[data-project-editor]"),
  draftState: document.getElementById("draftState"),
  visualFrame: document.getElementById("visualFrame"),
  visualHint: document.getElementById("visualHint"),
  viewportShell: document.querySelector("[data-viewport-shell]"),
  selectionLabel: document.getElementById("selectionLabel"),
  styleControls: document.querySelector("[data-style-controls]"),
  styleFontSize: document.getElementById("styleFontSize"),
  styleColor: document.getElementById("styleColor"),
  styleWeight: document.getElementById("styleWeight"),
  resetStyle: document.getElementById("resetStyle"),
  captionName: document.getElementById("captionName"),
  captionDescription: document.getElementById("captionDescription"),
  title: document.getElementById("title"),
  slide: document.getElementById("slide"),
  projectId: document.getElementById("projectId"),
  file: document.getElementById("file"),
  note: document.getElementById("note"),
  itemImageFile: document.getElementById("itemImageFile"),
  uploadItemImage: document.getElementById("uploadItemImage"),
  uploadStatus: document.getElementById("uploadStatus"),
  moveEntryUp: document.getElementById("moveEntryUp"),
  moveEntryDown: document.getElementById("moveEntryDown"),
  duplicateItem: document.getElementById("duplicateItem"),
  deleteItem: document.getElementById("deleteItem"),
  preview: document.getElementById("preview"),
  previewEmpty: document.getElementById("previewEmpty"),
  caseId: document.getElementById("caseId"),
  caseType: document.getElementById("caseType"),
  caseTitle: document.getElementById("caseTitle"),
  caseMeta: document.getElementById("caseMeta"),
  caseCopy: document.getElementById("caseCopy"),
  caseVisible: document.getElementById("caseVisible"),
  projectImageFile: document.getElementById("projectImageFile"),
  uploadProjectImage: document.getElementById("uploadProjectImage"),
  projectUploadStatus: document.getElementById("projectUploadStatus"),
  projectPreview: document.getElementById("projectPreview"),
  projectPreviewEmpty: document.getElementById("projectPreviewEmpty"),
  moveProjectUp: document.getElementById("moveProjectUp"),
  moveProjectDown: document.getElementById("moveProjectDown"),
  deleteProject: document.getElementById("deleteProject"),
};

let content = EMPTY_CONTENT();
let mode = "items";
let selectedItemIndex = -1;
let selectedProjectIndex = -1;
let draftRevision = 0;
let publishedRevision = 0;
let dirty = false;
let uploading = false;
let selectedVisualField = "";
let previewTimer = 0;
let draggedVisual = null;

function normalizeTextStyle(value) {
  if (!value || typeof value !== "object") return {};
  const style = {};
  const size = Number(value.fontSize);
  if (Number.isInteger(size) && size >= 8 && size <= 72) style.fontSize = size;
  if (/^#[0-9a-f]{6}$/i.test(value.color || "")) style.color = value.color;
  if ([400, 500, 600, 700, 800].includes(Number(value.fontWeight))) style.fontWeight = Number(value.fontWeight);
  return style;
}

function cleanTitle(title = "") {
  return String(title).replace(/\s+/g, " ").trim();
}

function assertSafeEditorText(value, label) {
  if (/[<>"\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(String(value || ""))) {
    throw new Error(`${label}包含不安全字符`);
  }
}

function setStatus(element, message, kind = "") {
  element.textContent = message;
  element.classList.toggle("is-error", kind === "error");
  element.classList.toggle("is-success", kind === "success");
}

function normalizeContent(value) {
  const source = Array.isArray(value) ? { items: value } : value;
  if (!source || typeof source !== "object") throw new Error("作品备份格式不正确");
  const projects = Array.isArray(source.projects) ? source.projects.map((project) => ({
    id: project.id || "",
    project: project.project || "feature",
    projects: Array.isArray(project.projects)
      ? project.projects.filter((value) => Object.hasOwn(PROJECT_LABELS, value))
      : [],
    title: project.title || "",
    meta: project.meta || "",
    copy: project.copy || "",
    image: project.image || "",
    poster: project.poster || "",
    slides: Array.isArray(project.slides) ? project.slides.map(Number).filter(Number.isFinite) : [],
    showInProjectEntry: project.showInProjectEntry !== false,
    assetId: project.assetId || "",
    order: Number.isFinite(project.order) ? project.order : undefined,
    textStyles: {
      title: normalizeTextStyle(project.textStyles?.title),
      meta: normalizeTextStyle(project.textStyles?.meta),
      copy: normalizeTextStyle(project.textStyles?.copy),
    },
  })) : [];
  const items = Array.isArray(source.items) ? source.items.map((item) => ({
    id: item.id || crypto.randomUUID(),
    slide: Number(item.slide) || 0,
    file: item.file || "",
    title: item.title || "",
    projectId: item.projectId || "",
    projects: Array.isArray(item.projects)
      ? item.projects.filter((value) => Object.hasOwn(PROJECT_LABELS, value))
      : [],
    types: Array.isArray(item.types)
      ? item.types.filter((value) => Object.hasOwn(TYPE_LABELS, value))
      : [],
    note: item.note || "",
    assetId: item.assetId || "",
    order: Number.isFinite(item.order) ? item.order : undefined,
    captionName: item.captionName || "",
    captionDescription: Object.hasOwn(item, "captionDescription") ? item.captionDescription : undefined,
    captionStyles: {
      name: normalizeTextStyle(item.captionStyles?.name),
      description: normalizeTextStyle(item.captionStyles?.description),
    },
  })) : [];
  const media = {};
  if (source.media && typeof source.media === "object" && !Array.isArray(source.media)) {
    Object.entries(source.media).forEach(([file, details]) => {
      if (!details || typeof details !== "object") return;
      media[file] = {
        width: Number(details.width) || 0,
        height: Number(details.height) || 0,
        preview: details.preview || "",
        display: details.display || "",
        watermarked: details.watermarked === true,
      };
    });
  }
  return {
    version: 1,
    projects,
    items,
    media,
  };
}

function activeItem() {
  return content.items[selectedItemIndex];
}

function activeProject() {
  return content.projects[selectedProjectIndex];
}

function legacyCaption(item) {
  if (!item) return { name: "", description: "" };
  const title = cleanTitle(item.title);
  const project = content.projects.find((entry) => entry.id === item.projectId)
    || content.projects.find((entry) => entry.slides?.includes(Number(item.slide)));
  const match = title.match(/《[^》]+》/);
  const fallback = cleanTitle(project?.title || "作品").replace(/[《》]/g, "").replace(/美术设计$/, "").trim();
  const name = (match?.[0] || fallback).replace(/[《》]/g, "");
  const description = match ? title.replace(match[0], "") : title.replace(fallback, "");
  return { name, description: cleanTitle(description) };
}

function makeEmptyItem() {
  return {
    id: crypto.randomUUID(),
    slide: 0,
    file: "",
    title: "新作品",
    projectId: content.projects[0]?.id || "",
    projects: [],
    types: [],
    note: "",
    captionName: "新作品",
    captionDescription: "",
    captionStyles: { name: {}, description: {} },
  };
}

function makeEmptyProject() {
  return {
    id: `project-${Date.now().toString(36)}`,
    project: "feature",
    title: "新项目",
    meta: "电影 / 网大",
    copy: "",
    image: "",
    poster: "",
    slides: [],
    showInProjectEntry: true,
    textStyles: { title: {}, meta: {}, copy: {} },
  };
}

function markDirty() {
  dirty = true;
  updateDraftState();
}

function writePreviewContent() {
  localStorage.setItem(EDITOR_PREVIEW_KEY, JSON.stringify({ content }));
}

function previewUrl() {
  return mode === "projects"
    ? `gallery.html?editor=1&preview=${Date.now()}#archive-selected`
    : `gallery.html?editor=1&type=all&preview=${Date.now()}#archive-browser`;
}

function schedulePreview({ immediate = false } = {}) {
  window.clearTimeout(previewTimer);
  const update = () => {
    writePreviewContent();
    els.visualFrame.src = previewUrl();
  };
  if (immediate) update();
  else previewTimer = window.setTimeout(update, 120);
}

function updateDraftState(message = "") {
  const suffix = dirty ? " · 有未保存修改" : "";
  els.draftState.textContent = message || `草稿版本 ${draftRevision || "尚未创建"} · 正式版本 ${publishedRevision || "尚未发布"}${suffix}`;
  els.connectionStatus.textContent = uploading ? "图片处理中" : dirty ? "草稿未保存" : "本地服务已连接";
  els.saveDraft.disabled = uploading || !dirty;
  els.publishDraft.disabled = uploading;
}

function renderChecks() {
  renderCheckGroup("projects", PROJECT_LABELS);
  renderCheckGroup("types", TYPE_LABELS);
}

function renderCheckGroup(field, labels) {
  const group = document.querySelector(`[data-checks="${field}"]`);
  const title = group.querySelector("strong");
  group.replaceChildren(title);
  Object.entries(labels).forEach(([key, label]) => {
    const item = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = key;
    input.addEventListener("change", () => {
      const work = activeItem();
      if (!work) return;
      const values = new Set(work[field] || []);
      if (input.checked) values.add(key);
      else values.delete(key);
      work[field] = [...values];
      markDirty();
      renderList();
    });
    item.append(input, document.createTextNode(label));
    group.append(item);
  });
}

function renderProjectTypeOptions() {
  els.caseType.replaceChildren(...Object.entries(PROJECT_LABELS).map(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    return option;
  }));
}

function renderProjectSelect() {
  const previous = els.projectId.value;
  const automatic = document.createElement("option");
  automatic.value = "";
  automatic.textContent = "按原页码自动归类";
  const options = content.projects.map((project) => {
    const option = document.createElement("option");
    option.value = project.id;
    option.textContent = cleanTitle(project.title) || project.id;
    return option;
  });
  els.projectId.replaceChildren(automatic, ...options);
  els.projectId.value = activeItem()?.projectId || previous || "";
}

function renderList() {
  const entries = mode === "items" ? content.items : content.projects;
  const query = els.searchItems.value.trim().toLowerCase();
  const selectedIndex = mode === "items" ? selectedItemIndex : selectedProjectIndex;
  els.itemList.replaceChildren();
  els.itemCount.textContent = `${entries.length} 项`;
  els.listEyebrow.textContent = mode === "items" ? "图片条目" : "项目入口";

  entries.forEach((entry, index) => {
    const haystack = [entry.title, entry.file, entry.meta, entry.id, entry.slide].join(" ").toLowerCase();
    if (query && !haystack.includes(query)) return;
    const row = els.rowTemplate.content.firstElementChild.cloneNode(true);
    row.classList.toggle("is-active", index === selectedIndex);
    const image = row.querySelector("img");
    const imageSource = mode === "items" ? entry.file : entry.poster || entry.image;
    if (imageSource) image.src = imageSource;
    row.querySelector("strong").textContent = cleanTitle(entry.title) || "未命名";
    row.querySelector("small").textContent = mode === "items"
      ? `第 ${entry.slide || 0} 页 · ${entry.projectId || entry.file || "未设置图片"}`
      : `${PROJECT_LABELS[entry.project] || "项目"} · ${entry.id || "未设置 ID"}`;
    row.addEventListener("click", () => {
      syncActiveForm();
      if (mode === "items") selectedItemIndex = index;
      else selectedProjectIndex = index;
      renderEditor();
      renderList();
    });
    els.itemList.append(row);
  });
}

function setImagePreview(image, empty, source) {
  if (!source) {
    image.removeAttribute("src");
    empty.hidden = false;
    return;
  }
  image.src = source;
  empty.hidden = true;
}

function renderItemEditor() {
  const work = activeItem();
  const disabled = !work;
  [els.captionName, els.captionDescription, els.title, els.slide, els.projectId, els.note, els.itemImageFile, els.uploadItemImage,
    els.moveEntryUp, els.moveEntryDown, els.duplicateItem, els.deleteItem].forEach((element) => {
    element.disabled = disabled || uploading;
  });
  els.title.value = work?.title || "";
  const caption = legacyCaption(work);
  els.captionName.value = work?.captionName || caption.name;
  els.captionDescription.value = work?.captionDescription ?? caption.description;
  els.slide.value = work?.slide ?? "";
  els.file.value = work?.file || "";
  els.note.value = work?.note || "";
  renderProjectSelect();
  document.querySelectorAll("[data-checks]").forEach((group) => {
    const field = group.dataset.checks;
    group.querySelectorAll("input[type='checkbox']").forEach((input) => {
      input.disabled = disabled || uploading;
      input.checked = Array.isArray(work?.[field]) && work[field].includes(input.value);
    });
  });
  setImagePreview(els.preview, els.previewEmpty, work?.file || "");
}

function renderProjectEditor() {
  const project = activeProject();
  const disabled = !project;
  [els.caseId, els.caseType, els.caseTitle, els.caseMeta, els.caseCopy, els.caseVisible,
    els.projectImageFile, els.uploadProjectImage, els.moveProjectUp, els.moveProjectDown,
    els.deleteProject].forEach((element) => {
    element.disabled = disabled || uploading;
  });
  els.caseId.value = project?.id || "";
  els.caseType.value = project?.project || "feature";
  els.caseTitle.value = project?.title || "";
  els.caseMeta.value = project?.meta || "";
  els.caseCopy.value = project?.copy || "";
  els.caseVisible.checked = project?.showInProjectEntry !== false;
  setImagePreview(els.projectPreview, els.projectPreviewEmpty, project?.poster || project?.image || "");
}

function renderEditor() {
  els.itemEditor.hidden = mode !== "items";
  els.projectEditor.hidden = mode !== "projects";
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === mode);
  });
  if (mode === "items") renderItemEditor();
  else renderProjectEditor();
}

function render() {
  renderProjectSelect();
  renderList();
  renderEditor();
  updateDraftState();
  schedulePreview();
}

function syncItemForm() {
  const work = activeItem();
  if (!work) return;
  work.title = els.title.value;
  work.captionName = els.captionName.value;
  work.captionDescription = els.captionDescription.value;
  work.slide = Number(els.slide.value) || 0;
  work.projectId = els.projectId.value;
  work.note = els.note.value;
}

function syncProjectForm() {
  const project = activeProject();
  if (!project) return;
  const previousId = project.id;
  project.id = els.caseId.value.trim();
  project.project = els.caseType.value;
  project.title = els.caseTitle.value;
  project.meta = els.caseMeta.value;
  project.copy = els.caseCopy.value;
  project.showInProjectEntry = els.caseVisible.checked;
  if (previousId && project.id && previousId !== project.id) {
    content.items.forEach((item) => {
      if (item.projectId === previousId) item.projectId = project.id;
    });
  }
}

function syncActiveForm() {
  if (mode === "items") syncItemForm();
  else syncProjectForm();
}

function assertPublicImagePath(value, label) {
  if (!value) return;
  const path = String(value);
  if (/^[a-zA-Z]:[\\/]/.test(path) || path.includes("..")) {
    throw new Error(`${label}不能包含本地绝对路径或路径穿越`);
  }
  if (/^(?:data|blob|file):/i.test(path)) {
    throw new Error(`${label}不能使用 Base64、Blob 或本地文件地址`);
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) && !/^https:/i.test(path)) {
    throw new Error(`${label}必须使用 HTTPS 或网站相对路径`);
  }
}

function validateContent({ forPublish = false } = {}) {
  syncActiveForm();
  if (content.items.length > 2000) throw new Error("作品条目数量异常");
  const projectIds = new Set();
  content.projects.forEach((project) => {
    if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(project.id || "")) {
      throw new Error(`项目 ID“${project.id || "空白"}”只能使用小写英文、数字和短横线`);
    }
    if (projectIds.has(project.id)) throw new Error(`项目 ID 重复：${project.id}`);
    projectIds.add(project.id);
    if (forPublish && !cleanTitle(project.title)) throw new Error(`项目 ${project.id} 缺少名称`);
    assertSafeEditorText(project.title, `项目 ${project.id} 名称`);
    assertSafeEditorText(project.meta, `项目 ${project.id} 标签`);
    assertSafeEditorText(project.copy, `项目 ${project.id} 介绍`);
    if (forPublish && project.showInProjectEntry !== false && !(project.poster || project.image)) {
      throw new Error(`项目 ${project.id} 缺少项目封面`);
    }
    assertPublicImagePath(project.poster || project.image || "", `项目 ${project.id} 的封面`);
  });
  const itemIds = new Set();
  content.items.forEach((item, index) => {
    item.id ||= crypto.randomUUID();
    item.order = index;
    if (itemIds.has(item.id)) throw new Error("存在重复的作品条目 ID");
    itemIds.add(item.id);
    assertSafeEditorText(item.title, `第 ${index + 1} 个作品标题`);
    assertSafeEditorText(item.captionName, `第 ${index + 1} 个作品名`);
    assertSafeEditorText(item.captionDescription, `第 ${index + 1} 个作品说明`);
    assertSafeEditorText(item.note, `第 ${index + 1} 个作品说明`);
    assertPublicImagePath(item.file || "", `第 ${index + 1} 个作品图片`);
    if (forPublish && (!cleanTitle(item.title) || !item.file)) {
      throw new Error(`第 ${index + 1} 个作品条目缺少标题或图片`);
    }
  });
  Object.entries(content.media).forEach(([file, details]) => {
    assertPublicImagePath(file, "媒体索引地址");
    assertPublicImagePath(details.preview || "", "媒体缩略图地址");
    assertPublicImagePath(details.display || "", "媒体展示图地址");
  });
  content.projects.forEach((project, index) => { project.order = index; });
}

async function readStaticContent() {
  const result = await apiJson("/api/portfolio/current");
  return normalizeContent(result.content);
}

async function apiJson(url, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("X-Zaiye-Editor", "1");
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(url, { ...options, headers, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `本地服务请求失败（${response.status}）`);
  return payload;
}

async function loadDraft() {
  const result = await apiJson("/api/portfolio/draft");
  content = normalizeContent(result.content);
  draftRevision = Number(result.revision) || 0;
  publishedRevision = Number(result.publishedRevision) || 0;
  selectedItemIndex = content.items.length ? 0 : -1;
  selectedProjectIndex = content.projects.length ? 0 : -1;
  dirty = false;
  render();
  updateDraftState(result.source === "draft" ? "已读取本机草稿" : "已读取当前官网静态数据");
}

async function saveDraft() {
  validateContent();
  const result = await apiJson("/api/portfolio/draft", {
    method: "POST",
    body: JSON.stringify({ content }),
  });
  draftRevision = Number(result.revision) || draftRevision + 1;
  dirty = false;
  updateDraftState("草稿已保存到本机");
  return draftRevision;
}

async function publishDraft() {
  validateContent({ forPublish: true });
  if (dirty || !draftRevision) await saveDraft();
  const result = await apiJson("/api/portfolio/publish", {
    method: "POST",
    body: JSON.stringify({ content }),
  });
  content = normalizeContent(result.content);
  publishedRevision = Number(result.revision) || draftRevision;
  draftRevision = publishedRevision;
  dirty = false;
  localStorage.removeItem(PUBLIC_CACHE_KEY);
  render();
  updateDraftState(`静态作品版本 ${publishedRevision} 已写入仓库`);
}

function downloadBackup() {
  validateContent();
  const blob = new Blob([`${JSON.stringify(content, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `portfolio-backup-r${draftRevision || 0}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      content = normalizeContent(JSON.parse(reader.result));
      selectedItemIndex = content.items.length ? 0 : -1;
      selectedProjectIndex = content.projects.length ? 0 : -1;
      markDirty();
      render();
    } catch (error) {
      alert(error.message || "备份格式不正确");
    }
  };
  reader.readAsText(file);
}

function swapEntries(entries, index, direction) {
  const target = index + direction;
  if (index < 0 || target < 0 || target >= entries.length) return index;
  [entries[index], entries[target]] = [entries[target], entries[index]];
  markDirty();
  return target;
}

async function uploadImage(kind) {
  const isItem = kind === "item";
  const fileInput = isItem ? els.itemImageFile : els.projectImageFile;
  const status = isItem ? els.uploadStatus : els.projectUploadStatus;
  const target = isItem ? activeItem() : activeProject();
  const file = fileInput.files[0];
  if (!target || !file) {
    setStatus(status, "请先选择一张图片", "error");
    return;
  }
  uploading = true;
  renderEditor();
  updateDraftState();
  try {
    setStatus(status, "正在生成压缩水印图并保存私人原图…");
    const response = await fetch("/api/portfolio/upload", {
      method: "POST",
      headers: {
        "Content-Type": file.type,
        "X-Zaiye-Editor": "1",
        "X-File-Name": encodeURIComponent(file.name),
      },
      body: file,
    });
    const asset = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(asset.error || "图片上传失败");
    content.media[asset.file] = asset.media;
    if (isItem) {
      target.file = asset.file;
      target.assetId = asset.assetId;
    } else {
      target.image = asset.file;
      target.poster = asset.file;
      target.assetId = asset.assetId;
    }
    fileInput.value = "";
    markDirty();
    render();
    setStatus(status, "图片已上传到草稿，记得保存并发布", "success");
  } catch (error) {
    setStatus(status, error.message || "图片上传失败", "error");
  } finally {
    uploading = false;
    renderEditor();
    updateDraftState();
  }
}

function selectedStyleTarget() {
  if (!selectedVisualField) return null;
  if (mode === "items") {
    const item = activeItem();
    if (!item) return null;
    item.captionStyles ||= { name: {}, description: {} };
    return selectedVisualField === "captionName" ? item.captionStyles.name : item.captionStyles.description;
  }
  const project = activeProject();
  if (!project) return null;
  project.textStyles ||= { title: {}, meta: {}, copy: {} };
  return project.textStyles[selectedVisualField];
}

function cssColorToHex(value) {
  const channels = String(value || "").match(/\d+(?:\.\d+)?/g)?.slice(0, 3).map(Number);
  if (!channels || channels.length !== 3) return "#252724";
  return `#${channels.map((channel) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, "0")).join("")}`;
}

function updateStyleControls(element = null) {
  const style = selectedStyleTarget();
  els.styleControls.hidden = !style;
  if (!style) return;
  const computed = element ? element.ownerDocument.defaultView.getComputedStyle(element) : null;
  els.styleFontSize.value = style.fontSize || Math.round(Number.parseFloat(computed?.fontSize || "16"));
  els.styleColor.value = style.color || cssColorToHex(computed?.color);
  els.styleWeight.value = String(style.fontWeight || Number(computed?.fontWeight) || 400);
}

function selectItemById(id, field = "", element = null) {
  syncActiveForm();
  const index = content.items.findIndex((item) => item.id === id);
  if (index < 0) return;
  mode = "items";
  selectedItemIndex = index;
  selectedVisualField = field;
  renderItemEditor();
  renderList();
  els.selectionLabel.textContent = field
    ? `${activeItem().captionName || cleanTitle(activeItem().title) || "作品"} · ${field === "captionName" ? "作品名" : "说明"}`
    : `${activeItem().captionName || cleanTitle(activeItem().title) || "作品"} · 图片`;
  updateStyleControls(element);
}

function selectProjectById(id, field = "", element = null) {
  syncActiveForm();
  const index = content.projects.findIndex((project) => project.id === id);
  if (index < 0) return;
  mode = "projects";
  selectedProjectIndex = index;
  selectedVisualField = field;
  renderProjectEditor();
  renderList();
  els.selectionLabel.textContent = `${cleanTitle(activeProject().title) || "项目"}${field ? ` · ${field}` : " · 封面"}`;
  updateStyleControls(element);
}

function moveIdsBefore(sourceIds, targetIds) {
  if (!sourceIds.length || sourceIds.some((id) => targetIds.includes(id))) return;
  const source = content.items.filter((item) => sourceIds.includes(item.id));
  const remaining = content.items.filter((item) => !sourceIds.includes(item.id));
  const targetIndex = remaining.findIndex((item) => targetIds.includes(item.id));
  remaining.splice(targetIndex < 0 ? remaining.length : targetIndex, 0, ...source);
  content.items = remaining;
  selectedItemIndex = content.items.findIndex((item) => item.id === sourceIds[0]);
  markDirty();
  render();
}

function bindVisualEditing() {
  const doc = els.visualFrame.contentDocument;
  if (!doc?.body) return;
  if (mode === "projects" && content.projects.length === 0) {
    const existingProjects = els.visualFrame.contentWindow.__portfolioEditorProjects;
    if (Array.isArray(existingProjects) && existingProjects.length) {
      content.projects = normalizeContent({ projects: existingProjects, items: content.items, media: content.media }).projects;
      selectedProjectIndex = 0;
      render();
      return;
    }
  }
  const style = doc.createElement("style");
  style.textContent = `
    .is-portfolio-editor-preview [data-editor-item-ids],
    .is-portfolio-editor-preview [data-editor-project-id] { cursor: grab; outline: 1px dashed transparent; outline-offset: 5px; }
    .is-portfolio-editor-preview [data-editor-item-ids]:hover,
    .is-portfolio-editor-preview [data-editor-project-id]:hover { outline-color: #c99854; }
    .is-portfolio-editor-preview [contenteditable="true"] { cursor: text; outline: 1px solid rgba(201,152,84,.8); outline-offset: 3px; }
    .is-portfolio-editor-preview [data-editor-item-id] { cursor: pointer; }
    .is-portfolio-editor-preview .archive-work-card[draggable="true"]:active,
    .is-portfolio-editor-preview .archive-case-card[draggable="true"]:active { cursor: grabbing; }
  `;
  doc.head.append(style);

  doc.querySelectorAll("[data-editor-item-ids]").forEach((card) => {
    const ids = card.dataset.editorItemIds.split(",").filter(Boolean);
    card.draggable = true;
    card.addEventListener("dragstart", (event) => {
      draggedVisual = { kind: "item-group", ids };
      event.dataTransfer.effectAllowed = "move";
    });
    card.addEventListener("dragover", (event) => event.preventDefault());
    card.addEventListener("drop", (event) => {
      event.preventDefault();
      if (draggedVisual?.kind === "item-group") moveIdsBefore(draggedVisual.ids, ids);
    });
    card.addEventListener("click", (event) => {
      const editable = event.target.closest("[data-editor-item-field]");
      if (editable) {
        selectItemById(ids[0], editable.dataset.editorItemField, editable);
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      const imageFrame = event.target.closest("[data-editor-item-id]");
      selectItemById(imageFrame?.dataset.editorItemId || ids[0]);
    }, true);
    card.querySelectorAll("[data-editor-item-field]").forEach((field) => {
      field.contentEditable = "true";
      field.draggable = false;
      field.addEventListener("click", (event) => {
        event.stopPropagation();
        selectItemById(ids[0], field.dataset.editorItemField, field);
      });
      field.addEventListener("input", () => {
        const item = content.items.find((entry) => entry.id === ids[0]);
        if (!item) return;
        item[field.dataset.editorItemField] = field.textContent.trim();
        selectedItemIndex = content.items.indexOf(item);
        els[field.dataset.editorItemField].value = item[field.dataset.editorItemField];
        markDirty();
        renderList();
      });
    });
    card.querySelectorAll("[data-editor-item-id]").forEach((frame) => {
      frame.draggable = true;
      frame.addEventListener("dragstart", (event) => {
        event.stopPropagation();
        draggedVisual = { kind: "item-image", id: frame.dataset.editorItemId };
        event.dataTransfer.effectAllowed = "move";
      });
      frame.addEventListener("dragover", (event) => event.preventDefault());
      frame.addEventListener("drop", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (draggedVisual?.kind !== "item-image" || draggedVisual.id === frame.dataset.editorItemId) return;
        const sourceIndex = content.items.findIndex((entry) => entry.id === draggedVisual.id);
        const targetIndex = content.items.findIndex((entry) => entry.id === frame.dataset.editorItemId);
        [content.items[sourceIndex], content.items[targetIndex]] = [content.items[targetIndex], content.items[sourceIndex]];
        selectedItemIndex = targetIndex;
        markDirty();
        render();
      });
    });
  });

  doc.querySelectorAll("[data-editor-project-id]").forEach((card) => {
    const id = card.dataset.editorProjectId;
    card.draggable = true;
    card.addEventListener("dragstart", (event) => {
      draggedVisual = { kind: "project", id };
      event.dataTransfer.effectAllowed = "move";
    });
    card.addEventListener("dragover", (event) => event.preventDefault());
    card.addEventListener("drop", (event) => {
      event.preventDefault();
      if (draggedVisual?.kind !== "project" || draggedVisual.id === id) return;
      const sourceIndex = content.projects.findIndex((project) => project.id === draggedVisual.id);
      const targetIndex = content.projects.findIndex((project) => project.id === id);
      const [source] = content.projects.splice(sourceIndex, 1);
      content.projects.splice(targetIndex, 0, source);
      selectedProjectIndex = content.projects.indexOf(source);
      markDirty();
      render();
    });
    card.addEventListener("click", (event) => {
      const editable = event.target.closest("[data-editor-project-field]");
      if (editable) {
        selectProjectById(id, editable.dataset.editorProjectField, editable);
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      selectProjectById(id);
    }, true);
    card.querySelectorAll("[data-editor-project-field]").forEach((field) => {
      field.contentEditable = "true";
      field.draggable = false;
      field.addEventListener("click", (event) => {
        event.stopPropagation();
        selectProjectById(id, field.dataset.editorProjectField, field);
      });
      field.addEventListener("input", () => {
        const project = content.projects.find((entry) => entry.id === id);
        if (!project) return;
        project[field.dataset.editorProjectField] = field.textContent.trim();
        selectedProjectIndex = content.projects.indexOf(project);
        markDirty();
        renderProjectEditor();
        renderList();
      });
    });
  });
  els.visualHint.textContent = "现在可以直接点文字修改；拖动整张作品卡或项目卡调整顺序；点击图片后在右侧替换。";
}

function applySelectedStyle() {
  const style = selectedStyleTarget();
  if (!style) return;
  style.fontSize = Math.max(8, Math.min(72, Math.round(Number(els.styleFontSize.value) || 16)));
  style.color = els.styleColor.value;
  style.fontWeight = Number(els.styleWeight.value) || 400;
  markDirty();
  schedulePreview({ immediate: true });
}

function bindFormEvents() {
  [els.captionName, els.captionDescription, els.title, els.slide, els.projectId, els.note].forEach((field) => {
    field.addEventListener("input", () => {
      syncItemForm();
      markDirty();
      renderList();
      setImagePreview(els.preview, els.previewEmpty, activeItem()?.file || "");
    });
  });
  [els.caseId, els.caseType, els.caseTitle, els.caseMeta, els.caseCopy, els.caseVisible].forEach((field) => {
    field.addEventListener("input", () => {
      syncProjectForm();
      markDirty();
      renderProjectSelect();
      renderList();
    });
  });
}

function bindEditorEvents() {
  els.visualFrame.addEventListener("load", bindVisualEditing);
  document.querySelectorAll("[data-viewport]").forEach((button) => {
    button.addEventListener("click", () => {
      const mobile = button.dataset.viewport === "mobile";
      els.viewportShell.classList.toggle("is-mobile", mobile);
      document.querySelectorAll("[data-viewport]").forEach((entry) => entry.classList.toggle("is-active", entry === button));
    });
  });
  [els.styleFontSize, els.styleColor, els.styleWeight].forEach((field) => field.addEventListener("input", applySelectedStyle));
  els.resetStyle.addEventListener("click", () => {
    const style = selectedStyleTarget();
    if (!style) return;
    Object.keys(style).forEach((key) => delete style[key]);
    markDirty();
    schedulePreview({ immediate: true });
  });
  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      syncActiveForm();
      mode = button.dataset.mode;
      els.searchItems.value = "";
      render();
    });
  });
  els.searchItems.addEventListener("input", renderList);
  els.addEntry.addEventListener("click", () => {
    syncActiveForm();
    if (mode === "items") {
      content.items.unshift(makeEmptyItem());
      selectedItemIndex = 0;
    } else {
      content.projects.unshift(makeEmptyProject());
      selectedProjectIndex = 0;
    }
    markDirty();
    render();
  });
  els.moveEntryUp.addEventListener("click", () => {
    syncItemForm();
    selectedItemIndex = swapEntries(content.items, selectedItemIndex, -1);
    render();
  });
  els.moveEntryDown.addEventListener("click", () => {
    syncItemForm();
    selectedItemIndex = swapEntries(content.items, selectedItemIndex, 1);
    render();
  });
  els.moveProjectUp.addEventListener("click", () => {
    syncProjectForm();
    selectedProjectIndex = swapEntries(content.projects, selectedProjectIndex, -1);
    render();
  });
  els.moveProjectDown.addEventListener("click", () => {
    syncProjectForm();
    selectedProjectIndex = swapEntries(content.projects, selectedProjectIndex, 1);
    render();
  });
  els.duplicateItem.addEventListener("click", () => {
    const work = activeItem();
    if (!work) return;
    syncItemForm();
    content.items.splice(selectedItemIndex + 1, 0, {
      ...work,
      id: crypto.randomUUID(),
      title: `${work.title || "作品"} 副本`,
    });
    selectedItemIndex += 1;
    markDirty();
    render();
  });
  els.deleteItem.addEventListener("click", () => {
    if (selectedItemIndex < 0 || !confirm("删除当前美术资料条目？正式页面要等下次发布后才会变化。")) return;
    content.items.splice(selectedItemIndex, 1);
    selectedItemIndex = Math.min(selectedItemIndex, content.items.length - 1);
    markDirty();
    render();
  });
  els.deleteProject.addEventListener("click", () => {
    const project = activeProject();
    if (!project || !confirm("删除当前项目？项目图片条目会保留，但会回到自动归类。")) return;
    content.items.forEach((item) => {
      if (item.projectId === project.id) item.projectId = "";
    });
    content.projects.splice(selectedProjectIndex, 1);
    selectedProjectIndex = Math.min(selectedProjectIndex, content.projects.length - 1);
    markDirty();
    render();
  });
  els.uploadItemImage.addEventListener("click", () => uploadImage("item"));
  els.uploadProjectImage.addEventListener("click", () => uploadImage("project"));
  els.loadDefault.addEventListener("click", async () => {
    if (!confirm("用当前官网静态数据替换本机草稿内容？尚未发布的草稿修改会被覆盖。")) return;
    try {
      content = await readStaticContent();
      selectedItemIndex = content.items.length ? 0 : -1;
      selectedProjectIndex = -1;
      markDirty();
      render();
    } catch (error) {
      alert(error.message);
    }
  });
  els.importJson.addEventListener("click", () => els.jsonFile.click());
  els.jsonFile.addEventListener("change", () => {
    const file = els.jsonFile.files[0];
    if (file) importBackup(file);
    els.jsonFile.value = "";
  });
  els.exportJson.addEventListener("click", downloadBackup);
  els.saveDraft.addEventListener("click", async () => {
    try {
      updateDraftState("正在保存草稿…");
      await saveDraft();
    } catch (error) {
      updateDraftState(`保存失败：${error.message}`);
    }
  });
  els.publishDraft.addEventListener("click", async () => {
    if (!confirm("确认把当前草稿写入官网静态作品文件？之后仍需由 Codex 提交并上线。")) return;
    try {
      updateDraftState("正在发布…");
      await publishDraft();
    } catch (error) {
      updateDraftState(`发布失败：${error.message}`);
    }
  });
  bindFormEvents();
}

async function init() {
  try {
    renderChecks();
    renderProjectTypeOptions();
    bindEditorEvents();
    render();
    await loadDraft();
  } catch (error) {
    updateDraftState(`初始化失败：${error.message}`);
    els.connectionStatus.textContent = "本地服务不可用";
  }
}

init();
