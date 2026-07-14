const PROJECT_LABELS = {
  feature: "电影 / 网大",
  series: "剧集 / 短剧",
  variety: "综艺 / 晚会",
  stage: "舞台剧",
  promo: "广告 / 宣传片",
  immersive: "实景 / 沉浸"
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
  lineart: "线稿场景"
};

const els = {
  loadDefault: document.getElementById("loadDefault"),
  importJson: document.getElementById("importJson"),
  exportJson: document.getElementById("exportJson"),
  jsonFile: document.getElementById("jsonFile"),
  addItem: document.getElementById("addItem"),
  itemCount: document.getElementById("itemCount"),
  searchItems: document.getElementById("searchItems"),
  itemList: document.getElementById("itemList"),
  rowTemplate: document.getElementById("rowTemplate"),
  title: document.getElementById("title"),
  slide: document.getElementById("slide"),
  file: document.getElementById("file"),
  note: document.getElementById("note"),
  duplicateItem: document.getElementById("duplicateItem"),
  deleteItem: document.getElementById("deleteItem"),
  preview: document.getElementById("preview"),
  previewEmpty: document.getElementById("previewEmpty")
};

let works = [];
let selectedIndex = -1;

function cleanTitle(title = "") {
  return title.replace(/\s+/g, " ").trim();
}

function activeWork() {
  return works[selectedIndex];
}

function makeEmptyWork() {
  return {
    slide: 0,
    file: "assets/portfolio/",
    title: "新作品",
    projects: [],
    types: [],
    note: ""
  };
}

async function loadDefaultData() {
  try {
    const response = await fetch("assets/portfolio/portfolio-index.json", { cache: "no-store" });
    if (!response.ok) throw new Error("读取失败");
    works = await response.json();
    selectedIndex = works.length ? 0 : -1;
    render();
  } catch {
    alert("本地 file:// 可能不能直接读取 JSON。请点“导入 JSON”，选择 assets/portfolio/portfolio-index.json。");
  }
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      works = JSON.parse(reader.result);
      selectedIndex = works.length ? 0 : -1;
      render();
    } catch {
      alert("JSON 格式不对，导入失败。");
    }
  };
  reader.readAsText(file);
}

function exportJson() {
  syncFormToWork();
  const normalized = works.map((work) => {
    const next = {
      slide: Number(work.slide) || 0,
      file: work.file || "",
      title: work.title || ""
    };
    if (Array.isArray(work.projects) && work.projects.length) next.projects = work.projects;
    if (Array.isArray(work.types) && work.types.length) next.types = work.types;
    if (work.note) next.note = work.note;
    return next;
  });
  const blob = new Blob([JSON.stringify(normalized, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "portfolio-index.json";
  link.click();
  URL.revokeObjectURL(url);
}

function renderChecks() {
  renderCheckGroup("projects", PROJECT_LABELS);
  renderCheckGroup("types", TYPE_LABELS);
}

function renderCheckGroup(field, labels) {
  const group = document.querySelector(`[data-checks="${field}"]`);
  const title = group.querySelector("strong");
  group.innerHTML = "";
  group.append(title);

  Object.entries(labels).forEach(([key, label]) => {
    const item = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = key;
    input.addEventListener("change", () => {
      const work = activeWork();
      if (!work) return;
      const values = new Set(work[field] || []);
      if (input.checked) values.add(key);
      else values.delete(key);
      work[field] = [...values];
      renderList();
    });
    item.append(input, document.createTextNode(label));
    group.append(item);
  });
}

function render() {
  renderChecks();
  renderList();
  syncFormFromWork();
}

function renderList() {
  const query = els.searchItems.value.trim().toLowerCase();
  els.itemList.innerHTML = "";
  els.itemCount.textContent = `${works.length} 项`;

  works.forEach((work, index) => {
    const haystack = `${work.slide} ${work.file} ${work.title}`.toLowerCase();
    if (query && !haystack.includes(query)) return;

    const row = els.rowTemplate.content.firstElementChild.cloneNode(true);
    row.classList.toggle("is-active", index === selectedIndex);
    row.querySelector("img").src = work.file || "";
    row.querySelector("strong").textContent = cleanTitle(work.title) || "未命名作品";
    row.querySelector("small").textContent = `第 ${work.slide || 0} 页 · ${work.file || "未设置图片"}`;
    row.addEventListener("click", () => {
      syncFormToWork();
      selectedIndex = index;
      syncFormFromWork();
      renderList();
    });
    els.itemList.append(row);
  });
}

function syncFormFromWork() {
  const work = activeWork();
  const disabled = !work;
  [els.title, els.slide, els.file, els.note, els.duplicateItem, els.deleteItem].forEach((el) => {
    el.disabled = disabled;
  });

  els.title.value = work?.title || "";
  els.slide.value = work?.slide ?? "";
  els.file.value = work?.file || "";
  els.note.value = work?.note || "";

  document.querySelectorAll("[data-checks]").forEach((group) => {
    const field = group.dataset.checks;
    group.querySelectorAll("input[type='checkbox']").forEach((input) => {
      input.disabled = disabled;
      input.checked = Array.isArray(work?.[field]) && work[field].includes(input.value);
    });
  });

  updatePreview();
}

function syncFormToWork() {
  const work = activeWork();
  if (!work) return;
  work.title = els.title.value;
  work.slide = Number(els.slide.value) || 0;
  work.file = els.file.value.trim();
  work.note = els.note.value;
}

function updatePreview() {
  const src = els.file.value.trim();
  if (!src) {
    els.preview.removeAttribute("src");
    els.previewEmpty.hidden = false;
    return;
  }
  els.preview.src = src;
  els.previewEmpty.hidden = true;
}

["input", "change"].forEach((eventName) => {
  [els.title, els.slide, els.file, els.note].forEach((field) => {
    field.addEventListener(eventName, () => {
      syncFormToWork();
      updatePreview();
      renderList();
    });
  });
});

els.searchItems.addEventListener("input", renderList);
els.loadDefault.addEventListener("click", loadDefaultData);
els.importJson.addEventListener("click", () => els.jsonFile.click());
els.jsonFile.addEventListener("change", () => {
  const file = els.jsonFile.files[0];
  if (file) importJson(file);
  els.jsonFile.value = "";
});
els.exportJson.addEventListener("click", exportJson);
els.addItem.addEventListener("click", () => {
  syncFormToWork();
  works.unshift(makeEmptyWork());
  selectedIndex = 0;
  render();
});
els.duplicateItem.addEventListener("click", () => {
  const work = activeWork();
  if (!work) return;
  works.splice(selectedIndex + 1, 0, { ...work, title: `${work.title || "作品"} 副本` });
  selectedIndex += 1;
  render();
});
els.deleteItem.addEventListener("click", () => {
  if (selectedIndex < 0) return;
  if (!confirm("删除当前作品条目？")) return;
  works.splice(selectedIndex, 1);
  selectedIndex = Math.min(selectedIndex, works.length - 1);
  render();
});

loadDefaultData();
