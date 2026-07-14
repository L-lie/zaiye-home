const STORAGE_KEY = "zaiye-canvas-v1";
const DEFAULT_ITEMS = [
  {
    id: crypto.randomUUID(),
    type: "prompt",
    title: "画面方向",
    body: "写实电影感室内场景，保留空间结构，重点调整光线、材质、陈设层次，不改变原始构图。",
    x: 760,
    y: 520
  },
  {
    id: crypto.randomUUID(),
    type: "note",
    title: "待补参考",
    body: "把 ChatGPT / Gemini 出图结果拖进来，和对应 Prompt 放在一起。每个项目可以导出一份 JSON 留档。",
    x: 1080,
    y: 520
  },
  {
    id: crypto.randomUUID(),
    type: "frame",
    title: "第一组视觉方向",
    body: "把同一场景的参考图、提示词、生成结果放进这个区域。",
    x: 700,
    y: 430
  }
];

const els = {
  viewport: document.getElementById("viewport"),
  grid: document.getElementById("canvasGrid"),
  board: document.getElementById("board"),
  itemTemplate: document.getElementById("itemTemplate"),
  boardTitle: document.getElementById("boardTitle"),
  boardNote: document.getElementById("boardNote"),
  itemTitle: document.getElementById("itemTitle"),
  itemBody: document.getElementById("itemBody"),
  saveBoard: document.getElementById("saveBoard"),
  exportBoard: document.getElementById("exportBoard"),
  importBoard: document.getElementById("importBoard"),
  importFile: document.getElementById("importFile"),
  addPrompt: document.getElementById("addPrompt"),
  addNote: document.getElementById("addNote"),
  addFrame: document.getElementById("addFrame"),
  addImage: document.getElementById("addImage"),
  imageFile: document.getElementById("imageFile"),
  duplicateItem: document.getElementById("duplicateItem"),
  deleteItem: document.getElementById("deleteItem"),
  zoomOut: document.getElementById("zoomOut"),
  zoomIn: document.getElementById("zoomIn"),
  resetView: document.getElementById("resetView"),
  clearBoard: document.getElementById("clearBoard"),
  statusText: document.getElementById("statusText"),
  zoomText: document.getElementById("zoomText")
};

let state = loadBoard();
let selectedId = null;
let view = state.view || { x: -520, y: -320, scale: 0.9 };
let saveTimer = null;
let dragState = null;

function loadBoard() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return {
      title: "未命名项目",
      note: "",
      view: { x: -520, y: -320, scale: 0.9 },
      items: DEFAULT_ITEMS
    };
  }

  try {
    const parsed = JSON.parse(saved);
    return {
      title: parsed.title || "未命名项目",
      note: parsed.note || "",
      view: parsed.view || { x: -520, y: -320, scale: 0.9 },
      items: Array.isArray(parsed.items) ? parsed.items : DEFAULT_ITEMS
    };
  } catch {
    return {
      title: "未命名项目",
      note: "",
      view: { x: -520, y: -320, scale: 0.9 },
      items: DEFAULT_ITEMS
    };
  }
}

function saveBoard(status = "已保存到本机") {
  state.view = view;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  els.statusText.textContent = status;
}

function scheduleSave(status = "正在编辑") {
  els.statusText.textContent = status;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveBoard(), 500);
}

function applyView() {
  const transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
  els.board.style.transform = transform;
  els.grid.style.transform = transform;
  els.zoomText.textContent = `${Math.round(view.scale * 100)}%`;
}

function boardPointFromEvent(event) {
  const rect = els.viewport.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left - view.x) / view.scale,
    y: (event.clientY - rect.top - view.y) / view.scale
  };
}

function centerBoardPoint() {
  return {
    x: (els.viewport.clientWidth / 2 - view.x) / view.scale,
    y: (els.viewport.clientHeight / 2 - view.y) / view.scale
  };
}

function renderBoard() {
  els.board.innerHTML = "";
  const ordered = [...state.items].sort((a, b) => (a.type === "frame" ? -1 : 0) - (b.type === "frame" ? -1 : 0));

  ordered.forEach((item) => {
    const node = els.itemTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.id = item.id;
    node.classList.add(item.type);
    if (item.id === selectedId) node.classList.add("selected");
    node.style.left = `${item.x}px`;
    node.style.top = `${item.y}px`;
    node.querySelector("strong").textContent = item.title || "未命名";
    node.querySelector("span").textContent = typeLabel(item.type);

    const body = node.querySelector(".item-body");
    if (item.type === "image" && item.src) {
      const img = document.createElement("img");
      img.src = item.src;
      img.alt = item.title || "画布图片";
      const caption = document.createElement("div");
      caption.className = "caption";
      caption.textContent = item.body || "图片参考";
      body.append(img, caption);
    } else {
      body.textContent = item.body || "";
    }

    node.addEventListener("pointerdown", (event) => startItemDrag(event, item.id));
    node.addEventListener("click", (event) => {
      event.stopPropagation();
      selectItem(item.id);
    });
    node.addEventListener("focus", () => selectItem(item.id));
    els.board.appendChild(node);
  });

  syncEditor();
}

function typeLabel(type) {
  return {
    prompt: "PROMPT",
    note: "NOTE",
    frame: "FRAME",
    image: "IMAGE"
  }[type] || "ITEM";
}

function selectItem(id) {
  selectedId = id;
  renderBoard();
}

function selectedItem() {
  return state.items.find((item) => item.id === selectedId);
}

function syncEditor() {
  const item = selectedItem();
  const disabled = !item;
  els.itemTitle.disabled = disabled;
  els.itemBody.disabled = disabled;
  els.duplicateItem.disabled = disabled;
  els.deleteItem.disabled = disabled;
  els.itemTitle.value = item?.title || "";
  els.itemBody.value = item?.body || "";
}

function addItem(type, payload = {}) {
  const center = centerBoardPoint();
  const item = {
    id: crypto.randomUUID(),
    type,
    title: payload.title || defaultTitle(type),
    body: payload.body || defaultBody(type),
    src: payload.src || "",
    x: payload.x ?? center.x - 120,
    y: payload.y ?? center.y - 70
  };
  state.items.push(item);
  selectedId = item.id;
  renderBoard();
  scheduleSave("已添加");
}

function defaultTitle(type) {
  return {
    prompt: "新 Prompt",
    note: "新备注",
    frame: "新分组",
    image: "图片参考"
  }[type] || "新条目";
}

function defaultBody(type) {
  return {
    prompt: "在这里写提示词、约束、风格方向或负面提示词。",
    note: "在这里写项目备注、修改意见或生成结果判断。",
    frame: "把同一组资料放在这个区域附近。",
    image: "图片说明"
  }[type] || "";
}

function startItemDrag(event, id) {
  if (event.button !== 0) return;
  const item = state.items.find((entry) => entry.id === id);
  if (!item) return;
  event.preventDefault();
  event.stopPropagation();
  selectedId = id;
  dragState = {
    type: "item",
    id,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    itemX: item.x,
    itemY: item.y
  };
  event.currentTarget.setPointerCapture(event.pointerId);
  event.currentTarget.classList.add("selected");
  syncEditor();
}

function startPan(event) {
  if (event.button !== 0 || event.target !== els.viewport) return;
  dragState = {
    type: "pan",
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    viewX: view.x,
    viewY: view.y
  };
  els.viewport.classList.add("dragging");
  els.viewport.setPointerCapture(event.pointerId);
}

function movePointer(event) {
  if (!dragState) return;
  if (dragState.type === "pan") {
    view.x = dragState.viewX + event.clientX - dragState.startX;
    view.y = dragState.viewY + event.clientY - dragState.startY;
    applyView();
    scheduleSave("正在移动画布");
    return;
  }

  const item = state.items.find((entry) => entry.id === dragState.id);
  if (!item) return;
  item.x = dragState.itemX + (event.clientX - dragState.startX) / view.scale;
  item.y = dragState.itemY + (event.clientY - dragState.startY) / view.scale;
  const node = els.board.querySelector(`[data-id="${dragState.id}"]`);
  if (node) {
    node.style.left = `${item.x}px`;
    node.style.top = `${item.y}px`;
  }
  scheduleSave("正在移动条目");
}

function endPointer() {
  if (!dragState) return;
  dragState = null;
  els.viewport.classList.remove("dragging");
  saveBoard();
}

function zoomAt(clientX, clientY, nextScale) {
  const rect = els.viewport.getBoundingClientRect();
  const before = {
    x: (clientX - rect.left - view.x) / view.scale,
    y: (clientY - rect.top - view.y) / view.scale
  };
  view.scale = Math.min(1.8, Math.max(0.28, nextScale));
  view.x = clientX - rect.left - before.x * view.scale;
  view.y = clientY - rect.top - before.y * view.scale;
  applyView();
  scheduleSave("正在缩放");
}

function readImages(files, point) {
  [...files].filter((file) => file.type.startsWith("image/")).forEach((file, index) => {
    const reader = new FileReader();
    reader.onload = () => {
      addItem("image", {
        title: file.name.replace(/\.[^.]+$/, ""),
        body: "图片参考",
        src: reader.result,
        x: point.x + index * 28,
        y: point.y + index * 28
      });
    };
    reader.readAsDataURL(file);
  });
}

function exportBoard() {
  saveBoard();
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${state.title || "zaiye-canvas"}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importBoard(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const next = JSON.parse(reader.result);
      state = {
        title: next.title || "导入的画布",
        note: next.note || "",
        view: next.view || { x: -520, y: -320, scale: 0.9 },
        items: Array.isArray(next.items) ? next.items : []
      };
      selectedId = null;
      view = state.view;
      hydrateForm();
      applyView();
      renderBoard();
      saveBoard("已导入");
    } catch {
      els.statusText.textContent = "导入失败";
    }
  };
  reader.readAsText(file);
}

function hydrateForm() {
  els.boardTitle.value = state.title || "未命名项目";
  els.boardNote.value = state.note || "";
}

els.boardTitle.addEventListener("input", () => {
  state.title = els.boardTitle.value.trim() || "未命名项目";
  scheduleSave();
});

els.boardNote.addEventListener("input", () => {
  state.note = els.boardNote.value;
  scheduleSave();
});

els.itemTitle.addEventListener("input", () => {
  const item = selectedItem();
  if (!item) return;
  item.title = els.itemTitle.value;
  renderBoard();
  scheduleSave();
});

els.itemBody.addEventListener("input", () => {
  const item = selectedItem();
  if (!item) return;
  item.body = els.itemBody.value;
  renderBoard();
  scheduleSave();
});

els.addPrompt.addEventListener("click", () => addItem("prompt"));
els.addNote.addEventListener("click", () => addItem("note"));
els.addFrame.addEventListener("click", () => addItem("frame"));
els.addImage.addEventListener("click", () => els.imageFile.click());
els.imageFile.addEventListener("change", () => {
  const center = centerBoardPoint();
  readImages(els.imageFile.files, center);
  els.imageFile.value = "";
});

els.duplicateItem.addEventListener("click", () => {
  const item = selectedItem();
  if (!item) return;
  const copy = { ...item, id: crypto.randomUUID(), title: `${item.title} 副本`, x: item.x + 30, y: item.y + 30 };
  state.items.push(copy);
  selectedId = copy.id;
  renderBoard();
  scheduleSave("已复制");
});

els.deleteItem.addEventListener("click", () => {
  if (!selectedId) return;
  state.items = state.items.filter((item) => item.id !== selectedId);
  selectedId = null;
  renderBoard();
  scheduleSave("已删除");
});

els.clearBoard.addEventListener("click", () => {
  if (!confirm("清空当前画布？本机保存也会被覆盖。")) return;
  state.items = [];
  selectedId = null;
  renderBoard();
  scheduleSave("已清空");
});

els.saveBoard.addEventListener("click", () => saveBoard());
els.exportBoard.addEventListener("click", exportBoard);
els.importBoard.addEventListener("click", () => els.importFile.click());
els.importFile.addEventListener("change", () => {
  const file = els.importFile.files[0];
  if (file) importBoard(file);
  els.importFile.value = "";
});

els.zoomIn.addEventListener("click", () => zoomAt(els.viewport.clientWidth / 2, els.viewport.clientHeight / 2, view.scale * 1.12));
els.zoomOut.addEventListener("click", () => zoomAt(els.viewport.clientWidth / 2, els.viewport.clientHeight / 2, view.scale / 1.12));
els.resetView.addEventListener("click", () => {
  view = { x: -520, y: -320, scale: 0.9 };
  applyView();
  scheduleSave("已回到中心");
});

els.viewport.addEventListener("pointerdown", startPan);
els.viewport.addEventListener("pointermove", movePointer);
els.viewport.addEventListener("pointerup", endPointer);
els.viewport.addEventListener("pointercancel", endPointer);
window.addEventListener("pointermove", movePointer);
window.addEventListener("pointerup", endPointer);
window.addEventListener("pointercancel", endPointer);
els.viewport.addEventListener("click", (event) => {
  if (event.target === els.viewport) {
    selectedId = null;
    renderBoard();
  }
});
els.viewport.addEventListener("wheel", (event) => {
  event.preventDefault();
  zoomAt(event.clientX, event.clientY, view.scale * (event.deltaY > 0 ? 0.92 : 1.08));
}, { passive: false });

els.viewport.addEventListener("dragover", (event) => {
  event.preventDefault();
  els.viewport.classList.add("drop-ready");
});
els.viewport.addEventListener("dragleave", () => els.viewport.classList.remove("drop-ready"));
els.viewport.addEventListener("drop", (event) => {
  event.preventDefault();
  els.viewport.classList.remove("drop-ready");
  const point = boardPointFromEvent(event);
  readImages(event.dataTransfer.files, point);
});

hydrateForm();
applyView();
renderBoard();
saveBoard();
