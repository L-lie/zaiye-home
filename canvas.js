const DB_NAME = "zaiye-canvas-db";
const STORE_NAME = "boards";
const LEGACY_STORAGE_KEY = "zaiye-canvas-v1";
const PRIVATE_LIBRARY_URL = "assets/content/notes-library.enc.json";
const SESSION_KEY = "zaiye-notes-session-key";
const DEFAULT_VIEW = { x: -520, y: -320, scale: 0.9 };

const els = {
  canvasAccess: document.getElementById("canvasAccess"),
  canvasUnlockForm: document.getElementById("canvasUnlockForm"),
  canvasUnlockKey: document.getElementById("canvasUnlockKey"),
  canvasUnlockMessage: document.getElementById("canvasUnlockMessage"),
  canvasHome: document.getElementById("canvasHome"),
  canvasWorkspace: document.getElementById("canvasWorkspace"),
  homeActions: document.getElementById("homeActions"),
  editorActions: document.getElementById("editorActions"),
  boardGrid: document.getElementById("boardGrid"),
  boardEmpty: document.getElementById("boardEmpty"),
  boardCount: document.getElementById("boardCount"),
  boardCardTemplate: document.getElementById("boardCardTemplate"),
  newBoard: document.getElementById("newBoard"),
  newBoardHero: document.getElementById("newBoardHero"),
  newBoardEmpty: document.getElementById("newBoardEmpty"),
  backToBoards: document.getElementById("backToBoards"),
  importBoardHome: document.getElementById("importBoardHome"),
  sharedImportFile: document.getElementById("sharedImportFile"),
  viewport: document.getElementById("viewport"),
  grid: document.getElementById("canvasGrid"),
  board: document.getElementById("board"),
  itemLayer: document.getElementById("itemLayer"),
  inkLayer: document.getElementById("inkLayer"),
  itemTemplate: document.getElementById("itemTemplate"),
  boardTitle: document.getElementById("boardTitle"),
  boardNote: document.getElementById("boardNote"),
  itemTitle: document.getElementById("itemTitle"),
  itemBody: document.getElementById("itemBody"),
  saveBoard: document.getElementById("saveBoard"),
  exportBoard: document.getElementById("exportBoard"),
  shareBoard: document.getElementById("shareBoard"),
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
  zoomText: document.getElementById("zoomText"),
  strokeWidth: document.getElementById("strokeWidth"),
  undoInk: document.getElementById("undoInk"),
  toolMenu: document.getElementById("toolMenu"),
};

let db;
let state = null;
let selectedId = null;
let view = { ...DEFAULT_VIEW };
let saveTimer = null;
let dragState = null;
let currentStroke = null;
let activeTool = "select";
let activeColor = "#18231f";
let backgroundColor = "#f4efe6";
let lastBoardPointer = null;
let spacePan = false;

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function makeUuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

async function decryptPrivateLibrary(payload, secret) {
  if (!crypto.subtle) throw new Error("当前页面需要 HTTPS 才能解锁私人内容");
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: base64ToBytes(payload.salt),
      iterations: payload.iterations,
    },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(payload.iv) },
    key,
    base64ToBytes(payload.ciphertext),
  );
  return JSON.parse(new TextDecoder().decode(plaintext));
}

async function verifyCanvasSecret(secret) {
  const response = await fetch(`${PRIVATE_LIBRARY_URL}?v=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error("无法读取私人密钥校验文件");
  await decryptPrivateLibrary(await response.json(), secret);
}

async function openDatabase() {
  const request = indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE_NAME)) {
      request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    }
  };
  db = await requestResult(request);
}

function boardStore(mode = "readonly") {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

async function getBoards() {
  return requestResult(boardStore().getAll());
}

async function getBoard(id) {
  return requestResult(boardStore().get(id));
}

async function putBoard(board) {
  return requestResult(boardStore("readwrite").put(board));
}

async function removeBoard(id) {
  return requestResult(boardStore("readwrite").delete(id));
}

function normalizedBoard(value = {}) {
  const now = new Date().toISOString();
  return {
    id: value.id || makeUuid(),
    title: value.title || "未命名画布",
    note: value.note || "",
    createdAt: value.createdAt || now,
    updatedAt: value.updatedAt || now,
    view: value.view || { ...DEFAULT_VIEW },
    items: Array.isArray(value.items) ? value.items : [],
    strokes: Array.isArray(value.strokes) ? value.strokes : [],
  };
}

async function migrateLegacyBoard() {
  const boards = await getBoards();
  if (boards.length) return;
  const saved = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!saved) return;
  try {
    const legacy = normalizedBoard(JSON.parse(saved));
    legacy.title = legacy.title === "未命名项目" ? "原来的画布" : legacy.title;
    await putBoard(legacy);
  } catch {
    // A damaged legacy entry should not block the new canvas library.
  }
}

function formatDate(value) {
  if (!value) return "刚刚";
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    .format(new Date(value));
}

async function renderBoardLibrary() {
  const boards = (await getBoards()).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  els.boardGrid.replaceChildren();
  els.boardCount.textContent = boards.length ? `${boards.length} 张` : "";
  els.boardEmpty.hidden = boards.length > 0;
  els.boardGrid.hidden = boards.length === 0;

  boards.forEach((board) => {
    const card = els.boardCardTemplate.content.firstElementChild.cloneNode(true);
    const preview = card.querySelector(".board-preview");
    const image = board.items?.find((item) => item.type === "image" && item.src);
    if (image) {
      preview.style.backgroundImage = `url("${image.src.replace(/"/g, "%22")}")`;
      preview.classList.add("has-image");
    } else {
      const counts = [
        board.items?.length ? `${board.items.length} 个条目` : "空白画布",
        board.strokes?.length ? `${board.strokes.length} 段笔迹` : "",
      ].filter(Boolean);
      preview.textContent = counts.join(" · ");
    }
    card.querySelector(".board-card-copy strong").textContent = board.title;
    card.querySelector(".board-card-copy small").textContent = `更新于 ${formatDate(board.updatedAt)}`;
    card.querySelector(".board-card-open").addEventListener("click", () => openBoard(board.id));
    card.querySelector(".rename-board").addEventListener("click", async () => {
      const title = window.prompt("画布名称", board.title)?.trim();
      if (!title) return;
      board.title = title;
      board.updatedAt = new Date().toISOString();
      await putBoard(board);
      renderBoardLibrary();
    });
    card.querySelector(".delete-board").addEventListener("click", async () => {
      if (!window.confirm(`删除“${board.title}”？此操作无法撤销。`)) return;
      await removeBoard(board.id);
      renderBoardLibrary();
    });
    els.boardGrid.append(card);
  });
}

function showHome() {
  document.body.classList.add("canvas-home-mode");
  els.canvasAccess.hidden = true;
  els.canvasHome.hidden = false;
  els.canvasWorkspace.hidden = true;
  els.homeActions.hidden = false;
  els.editorActions.hidden = true;
  state = null;
  selectedId = null;
  renderBoardLibrary();
}

function showEditor() {
  document.body.classList.remove("canvas-home-mode");
  els.canvasAccess.hidden = true;
  els.canvasHome.hidden = true;
  els.canvasWorkspace.hidden = false;
  els.homeActions.hidden = true;
  els.editorActions.hidden = false;
}

function showAccess() {
  document.body.classList.add("canvas-home-mode");
  els.canvasAccess.hidden = false;
  els.canvasHome.hidden = true;
  els.canvasWorkspace.hidden = true;
  els.homeActions.hidden = true;
  els.editorActions.hidden = true;
  state = null;
  selectedId = null;
  els.canvasUnlockKey.focus();
}

function openBoard(id) {
  const url = new URL(window.location.href);
  url.searchParams.set("board", id);
  window.location.href = url.href;
}

async function createBoard() {
  const board = normalizedBoard();
  await putBoard(board);
  openBoard(board.id);
}

async function loadCurrentBoard(id) {
  const board = await getBoard(id);
  if (!board) {
    showHome();
    return;
  }
  state = normalizedBoard(board);
  view = { ...state.view };
  showEditor();
  hydrateForm();
  applyView();
  renderBoard();
}

async function saveBoard(status = "已保存到本机") {
  if (!state) return;
  state.view = { ...view };
  state.updatedAt = new Date().toISOString();
  await putBoard(state);
  els.statusText.textContent = status;
}

function scheduleSave(status = "正在编辑") {
  if (!state) return;
  els.statusText.textContent = status;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveBoard(), 450);
}

function applyView() {
  const transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
  els.board.style.transform = transform;
  els.grid.style.transform = transform;
  els.zoomText.textContent = `${Math.round(view.scale * 100)}%`;
}

function boardPointFromClient(clientX, clientY) {
  const rect = els.viewport.getBoundingClientRect();
  return {
    x: (clientX - rect.left - view.x) / view.scale,
    y: (clientY - rect.top - view.y) / view.scale,
  };
}

function centerBoardPoint() {
  const rect = els.viewport.getBoundingClientRect();
  return boardPointFromClient(rect.left + rect.width / 2, rect.top + rect.height / 2);
}

function typeLabel(type) {
  return { prompt: "PROMPT", note: "NOTE", frame: "FRAME", image: "IMAGE" }[type] || "ITEM";
}

function selectedItem() {
  return state?.items.find((item) => item.id === selectedId);
}

function closestElement(target, selector) {
  const element = target instanceof Element ? target : target?.parentElement;
  return element?.closest(selector) || null;
}

function renderBoard() {
  if (!state) return;
  els.itemLayer.replaceChildren();
  const ordered = [...state.items].sort((a, b) => (a.type === "frame" ? -1 : 0) - (b.type === "frame" ? -1 : 0));

  ordered.forEach((item) => {
    const node = els.itemTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.id = item.id;
    node.classList.add(item.type);
    if (item.id === selectedId) node.classList.add("selected");
    node.style.left = `${item.x}px`;
    node.style.top = `${item.y}px`;
    const title = node.querySelector("strong");
    title.textContent = item.title || "未命名";
    title.dataset.editField = "title";
    node.querySelector(".item-head span").textContent = typeLabel(item.type);

    const body = node.querySelector(".item-body");
    if (item.type === "image" && item.src) {
      const img = document.createElement("img");
      img.src = item.src;
      img.alt = item.title || "画布图片";
      const caption = document.createElement("div");
      caption.className = "caption";
      caption.dataset.editField = "body";
      caption.textContent = item.body || "图片参考";
      body.append(img, caption);
    } else {
      body.dataset.editField = "body";
      body.textContent = item.body || "";
    }

    node.addEventListener("pointerdown", (event) => startItemDrag(event, item.id));
    node.addEventListener("mousedown", (event) => {
      const editTarget = closestElement(event.target, "[data-edit-field]");
      if (event.detail >= 2 && editTarget) {
        event.preventDefault();
        event.stopPropagation();
        beginInlineEdit(editTarget, item.id, editTarget.dataset.editField);
      }
    });
    node.addEventListener("click", (event) => {
      event.stopPropagation();
      const editTarget = closestElement(event.target, "[data-edit-field]");
      if (editTarget) {
        beginInlineEdit(editTarget, item.id, editTarget.dataset.editField);
        return;
      }
      selectItem(item.id);
    });
    node.addEventListener("dblclick", (event) => {
      const target = closestElement(event.target, "[data-edit-field]");
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      beginInlineEdit(target, item.id, target.dataset.editField);
    });
    node.addEventListener("focus", () => selectItem(item.id));
    els.itemLayer.append(node);
  });

  renderInk();
  syncEditor();
}

function beginInlineEdit(target, id, field) {
  const item = state.items.find((entry) => entry.id === id);
  if (!item) return;
  const original = item[field] || "";
  const editor = document.createElement(field === "title" ? "input" : "textarea");
  editor.className = "inline-editor";
  editor.value = original;
  if (field === "body") editor.rows = Math.max(3, Math.min(9, original.split("\n").length + 2));
  target.replaceChildren(editor);
  editor.focus();
  editor.select();
  let finished = false;
  const finish = (save) => {
    if (finished) return;
    finished = true;
    if (save) {
      item[field] = editor.value.trim();
      scheduleSave("已编辑");
    }
    renderBoard();
  };
  editor.addEventListener("pointerdown", (event) => event.stopPropagation());
  editor.addEventListener("click", (event) => event.stopPropagation());
  editor.addEventListener("blur", () => finish(true));
  editor.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      finish(false);
    } else if (event.key === "Enter" && (field === "title" || event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      finish(true);
    }
  });
}

function renderInk() {
  els.inkLayer.replaceChildren();
  state.strokes.forEach((stroke) => renderStroke(stroke));
  if (currentStroke) renderStroke(currentStroke);
}

function renderStroke(stroke) {
  if (!stroke.points.length) return;
  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.dataset.strokeId = stroke.id;
  const points = stroke.points;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const point = points[index];
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", previous.x);
    line.setAttribute("y1", previous.y);
    line.setAttribute("x2", point.x);
    line.setAttribute("y2", point.y);
    line.setAttribute("stroke", stroke.color);
    line.setAttribute("stroke-width", stroke.width * (0.42 + ((previous.pressure + point.pressure) / 2) * 0.9));
    line.setAttribute("stroke-linecap", "round");
    line.setAttribute("stroke-linejoin", "round");
    group.append(line);
  }
  if (points.length === 1) {
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("cx", points[0].x);
    dot.setAttribute("cy", points[0].y);
    dot.setAttribute("r", Math.max(1, stroke.width * points[0].pressure * 0.5));
    dot.setAttribute("fill", stroke.color);
    group.append(dot);
  }
  els.inkLayer.append(group);
}

function selectItem(id) {
  if (selectedId === id) return;
  selectedId = id;
  document.querySelectorAll(".canvas-item").forEach((node) => {
    node.classList.toggle("selected", node.dataset.id === selectedId);
  });
  syncEditor();
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

function defaultTitle(type) {
  return { prompt: "新 Prompt", note: "新备注", frame: "新分组", image: "图片参考" }[type] || "新条目";
}

function defaultBody(type) {
  return {
    prompt: "在这里写提示词、约束、风格方向或负面提示词。",
    note: "在这里写项目备注、修改意见或生成结果判断。",
    frame: "把同一组资料放在这个区域附近。",
    image: "图片说明",
  }[type] || "";
}

function addItem(type, payload = {}) {
  if (!state) return;
  const center = payload.point || centerBoardPoint();
  const item = {
    id: makeUuid(),
    type,
    title: payload.title || defaultTitle(type),
    body: payload.body || defaultBody(type),
    src: payload.src || "",
    x: payload.x ?? center.x - 120,
    y: payload.y ?? center.y - 70,
  };
  state.items.push(item);
  selectedId = item.id;
  renderBoard();
  scheduleSave(payload.status || "已添加");
}

function startItemDrag(event, id) {
  if (event.button !== 0 || closestElement(event.target, "input, textarea")) return;
  if (event.pointerType === "pen" || activeTool !== "select") return;
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
    itemY: item.y,
  };
  event.currentTarget.setPointerCapture(event.pointerId);
  event.currentTarget.classList.add("selected");
  syncEditor();
}

function pressureFor(event) {
  return event.pressure > 0 ? event.pressure : 0.5;
}

function appendStrokePoint(event) {
  const point = boardPointFromClient(event.clientX, event.clientY);
  const previous = currentStroke?.points.at(-1);
  if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 1.4 / view.scale) return;
  currentStroke.points.push({ ...point, pressure: pressureFor(event) });
}

function eraseAt(point) {
  const radius = 18 / view.scale;
  const before = state.strokes.length;
  state.strokes = state.strokes.filter((stroke) => !stroke.points.some((entry) => Math.hypot(entry.x - point.x, entry.y - point.y) <= radius));
  if (state.strokes.length !== before) {
    renderInk();
    scheduleSave("已擦除笔迹");
  }
}

function startSelection(event, shape) {
  event.preventDefault();
  const rect = els.viewport.getBoundingClientRect();
  const selection = document.createElement("div");
  selection.className = `selection-box ${shape}`;
  els.viewport.append(selection);
  dragState = {
    type: "selection",
    shape,
    pointerId: event.pointerId,
    startX: event.clientX - rect.left,
    startY: event.clientY - rect.top,
    selection,
  };
  updateSelectionBox(event);
  els.viewport.setPointerCapture(event.pointerId);
}

function updateSelectionBox(event) {
  if (dragState?.type !== "selection") return;
  const rect = els.viewport.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const left = Math.min(dragState.startX, x);
  const top = Math.min(dragState.startY, y);
  const width = Math.abs(x - dragState.startX);
  const height = Math.abs(y - dragState.startY);
  Object.assign(dragState.selection.style, {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`,
  });
}

function startViewportAction(event) {
  if (event.button !== 0) return;
  const pencilTool = spacePan ? "pan" : (event.pointerType === "pen" ? (activeTool === "eraser" ? "eraser" : activeTool === "select" ? "pen" : activeTool) : activeTool);
  if (pencilTool === "zoom") {
    event.preventDefault();
    zoomAt(event.clientX, event.clientY, view.scale * (event.shiftKey || event.altKey ? 0.88 : 1.12));
    return;
  }
  if (pencilTool === "pen") {
    event.preventDefault();
    currentStroke = {
      id: makeUuid(),
      color: activeColor,
      width: Number(els.strokeWidth.value),
      points: [],
    };
    appendStrokePoint(event);
    renderInk();
    dragState = { type: "ink", pointerId: event.pointerId };
    els.viewport.setPointerCapture(event.pointerId);
    return;
  }
  if (pencilTool === "heal" || pencilTool === "smudge") {
    event.preventDefault();
    currentStroke = {
      id: makeUuid(),
      color: pencilTool === "heal" ? "#d7c7a8" : activeColor,
      width: Number(els.strokeWidth.value),
      points: [],
    };
    appendStrokePoint(event);
    renderInk();
    dragState = { type: "ink", pointerId: event.pointerId };
    els.viewport.setPointerCapture(event.pointerId);
    return;
  }
  if (pencilTool === "eraser") {
    event.preventDefault();
    eraseAt(boardPointFromClient(event.clientX, event.clientY));
    dragState = { type: "eraser", pointerId: event.pointerId };
    els.viewport.setPointerCapture(event.pointerId);
    return;
  }
  if (pencilTool === "lasso" || pencilTool === "rect-lasso") {
    startSelection(event, pencilTool === "lasso" ? "lasso" : "rect");
    return;
  }
  if (closestElement(event.target, ".canvas-item")) return;
  dragState = {
    type: "pan",
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    viewX: view.x,
    viewY: view.y,
  };
  els.viewport.classList.add("dragging");
  els.viewport.setPointerCapture(event.pointerId);
}

function movePointer(event) {
  if (state) lastBoardPointer = boardPointFromClient(event.clientX, event.clientY);
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  if (dragState.type === "pan") {
    view.x = dragState.viewX + event.clientX - dragState.startX;
    view.y = dragState.viewY + event.clientY - dragState.startY;
    applyView();
    scheduleSave("正在移动画布");
    return;
  }
  if (dragState.type === "ink") {
    const events = event.getCoalescedEvents ? event.getCoalescedEvents() : [event];
    events.forEach(appendStrokePoint);
    renderInk();
    return;
  }
  if (dragState.type === "eraser") {
    eraseAt(boardPointFromClient(event.clientX, event.clientY));
    return;
  }
  if (dragState.type === "selection") {
    updateSelectionBox(event);
    return;
  }
  const item = state.items.find((entry) => entry.id === dragState.id);
  if (!item) return;
  item.x = dragState.itemX + (event.clientX - dragState.startX) / view.scale;
  item.y = dragState.itemY + (event.clientY - dragState.startY) / view.scale;
  const node = els.itemLayer.querySelector(`[data-id="${dragState.id}"]`);
  if (node) {
    node.style.left = `${item.x}px`;
    node.style.top = `${item.y}px`;
  }
  scheduleSave("正在移动条目");
}

function endPointer(event) {
  if (!dragState || (event && event.pointerId !== dragState.pointerId)) return;
  if (dragState.type === "ink" && currentStroke?.points.length) {
    state.strokes.push(currentStroke);
    currentStroke = null;
    renderInk();
    scheduleSave("已保存笔迹");
  }
  if (dragState.type === "selection") {
    dragState.selection.remove();
    els.statusText.textContent = "已框选区域";
  }
  dragState = null;
  els.viewport.classList.remove("dragging");
  saveBoard();
}

function zoomAt(clientX, clientY, nextScale) {
  const rect = els.viewport.getBoundingClientRect();
  const before = boardPointFromClient(clientX, clientY);
  view.scale = Math.min(1.8, Math.max(0.28, nextScale));
  view.x = clientX - rect.left - before.x * view.scale;
  view.y = clientY - rect.top - before.y * view.scale;
  applyView();
  scheduleSave("正在缩放");
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function readImages(files, point, status = "已添加图片") {
  const images = [...files].filter((file) => file.type.startsWith("image/"));
  for (let index = 0; index < images.length; index += 1) {
    const file = images[index];
    addItem("image", {
      title: file.name?.replace(/\.[^.]+$/, "") || "粘贴的图片",
      body: "图片参考",
      src: await readImage(file),
      x: point.x + index * 34,
      y: point.y + index * 34,
      status,
    });
  }
}

function isTypingTarget(target) {
  return target instanceof HTMLElement && (target.matches("input, textarea, [contenteditable='true']") || target.isContentEditable);
}

async function handlePaste(event) {
  if (!state || isTypingTarget(document.activeElement)) return;
  const items = [...(event.clipboardData?.items || [])];
  const imageFiles = items
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter(Boolean);
  const point = lastBoardPointer || centerBoardPoint();
  if (imageFiles.length) {
    event.preventDefault();
    await readImages(imageFiles, point, "已粘贴图片");
    return;
  }
  const text = event.clipboardData?.getData("text/plain")?.trim();
  if (text) {
    event.preventDefault();
    addItem("note", {
      title: text.split(/\r?\n/)[0].slice(0, 28) || "粘贴的文字",
      body: text,
      point,
      status: "已粘贴文字",
    });
  }
}

function exportBoard() {
  if (!state) return;
  saveBoard();
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${state.title || "zaiye-canvas"}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function readBoardFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(normalizedBoard(JSON.parse(reader.result)));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

async function importAsNewBoard(file) {
  try {
    const board = await readBoardFile(file);
    board.id = makeUuid();
    board.title = board.title || "导入的画布";
    board.createdAt = new Date().toISOString();
    board.updatedAt = board.createdAt;
    await putBoard(board);
    openBoard(board.id);
  } catch {
    window.alert("无法读取这个画布文件");
  }
}

function hydrateForm() {
  els.boardTitle.value = state?.title || "未命名画布";
  els.boardNote.value = state?.note || "";
}

function setTool(tool) {
  activeTool = tool;
  document.querySelectorAll(".ink-tool").forEach((button) => {
    const active = button.dataset.tool === tool;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  els.viewport.dataset.tool = tool;
}

function setStrokeWidth(width) {
  const nextWidth = Math.min(Number(els.strokeWidth.max), Math.max(Number(els.strokeWidth.min), width));
  els.strokeWidth.value = String(nextWidth);
  els.statusText.textContent = `画笔粗细 ${nextWidth}`;
}

function swapActiveColors() {
  [activeColor, backgroundColor] = [backgroundColor, activeColor];
  document.querySelectorAll(".color-swatch").forEach((swatch) => {
    swatch.classList.toggle("active", swatch.dataset.color === activeColor);
  });
  setTool("pen");
}

function hideToolMenu() {
  els.toolMenu.hidden = true;
}

function showToolMenu(event) {
  if (!state) return;
  event.preventDefault();
  els.toolMenu.style.left = `${event.clientX}px`;
  els.toolMenu.style.top = `${event.clientY}px`;
  els.toolMenu.hidden = false;
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

async function shareCurrentBoard() {
  if (!state) return;
  await saveBoard("已保存，正在生成分享链接");
  const secret = sessionStorage.getItem(SESSION_KEY) || "";
  const url = new URL(window.location.href);
  url.searchParams.set("board", state.id);
  if (secret) url.hash = `key=${encodeURIComponent(secret)}`;
  await copyText(url.href);
  els.statusText.textContent = secret ? "已复制分享链接" : "已复制链接，请另行发送密钥";
}

function handleCanvasShortcut(event) {
  if (!state || isTypingTarget(event.target) || event.ctrlKey || event.metaKey) return;
  const key = event.key.toLowerCase();
  const toolKeys = {
    z: "zoom",
    b: "pen",
    e: "eraser",
    d: "lasso",
    v: "rect-lasso",
    s: "heal",
    w: "smudge",
  };

  if (event.code === "Space") {
    event.preventDefault();
    spacePan = true;
    els.viewport.classList.add("dragging");
    return;
  }
  if (toolKeys[key]) {
    event.preventDefault();
    setTool(toolKeys[key]);
    return;
  }
  if (key === "q") {
    event.preventDefault();
    setStrokeWidth(Number(els.strokeWidth.value) + 1);
    return;
  }
  if (key === "a") {
    event.preventDefault();
    setStrokeWidth(Number(els.strokeWidth.value) - 1);
    return;
  }
  if (key === "x") {
    event.preventDefault();
    swapActiveColors();
  }
}

function endCanvasShortcut(event) {
  if (event.code !== "Space") return;
  spacePan = false;
  if (!dragState) els.viewport.classList.remove("dragging");
}

async function unlockCanvas(secret) {
  els.canvasUnlockMessage.textContent = "正在解锁…";
  try {
    await verifyCanvasSecret(secret);
    sessionStorage.setItem(SESSION_KEY, secret);
    els.canvasUnlockKey.value = "";
    els.canvasUnlockMessage.textContent = "";
    await openDatabase();
    await migrateLegacyBoard();
    const id = new URL(window.location.href).searchParams.get("board");
    if (id) await loadCurrentBoard(id);
    else showHome();
    return true;
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    showAccess();
    els.canvasUnlockMessage.textContent = "密钥不正确，请重新输入";
    return false;
  }
}

els.newBoard.addEventListener("click", createBoard);
els.newBoardHero.addEventListener("click", createBoard);
els.newBoardEmpty.addEventListener("click", createBoard);
els.backToBoards.addEventListener("click", () => {
  saveBoard();
  window.location.href = "canvas.html";
});
els.importBoardHome.addEventListener("click", () => els.sharedImportFile.click());
els.sharedImportFile.addEventListener("change", () => {
  const file = els.sharedImportFile.files[0];
  if (file) importAsNewBoard(file);
  els.sharedImportFile.value = "";
});

els.boardTitle.addEventListener("input", () => {
  state.title = els.boardTitle.value.trim() || "未命名画布";
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
els.imageFile.addEventListener("change", async () => {
  await readImages(els.imageFile.files, centerBoardPoint());
  els.imageFile.value = "";
});

els.duplicateItem.addEventListener("click", () => {
  const item = selectedItem();
  if (!item) return;
  const copy = { ...item, id: makeUuid(), title: `${item.title} 副本`, x: item.x + 30, y: item.y + 30 };
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
  if (!window.confirm("清空当前画布？本机保存也会被覆盖。")) return;
  state.items = [];
  state.strokes = [];
  selectedId = null;
  renderBoard();
  scheduleSave("已清空");
});

els.saveBoard.addEventListener("click", () => saveBoard());
els.exportBoard.addEventListener("click", exportBoard);
els.importBoard.addEventListener("click", () => els.importFile.click());
els.importFile.addEventListener("change", async () => {
  const file = els.importFile.files[0];
  if (!file) return;
  try {
    const imported = await readBoardFile(file);
    imported.id = state.id;
    imported.createdAt = state.createdAt;
    state = imported;
    selectedId = null;
    view = { ...state.view };
    hydrateForm();
    applyView();
    renderBoard();
    saveBoard("已导入");
  } catch {
    els.statusText.textContent = "导入失败";
  }
  els.importFile.value = "";
});
els.shareBoard.addEventListener("click", shareCurrentBoard);

els.zoomIn.addEventListener("click", () => zoomAt(els.viewport.getBoundingClientRect().left + els.viewport.clientWidth / 2, els.viewport.getBoundingClientRect().top + els.viewport.clientHeight / 2, view.scale * 1.12));
els.zoomOut.addEventListener("click", () => zoomAt(els.viewport.getBoundingClientRect().left + els.viewport.clientWidth / 2, els.viewport.getBoundingClientRect().top + els.viewport.clientHeight / 2, view.scale / 1.12));
els.resetView.addEventListener("click", () => {
  view = { ...DEFAULT_VIEW };
  applyView();
  scheduleSave("已回到中心");
});

document.querySelectorAll(".ink-tool").forEach((button) => button.addEventListener("click", () => setTool(button.dataset.tool)));
document.querySelectorAll(".color-swatch").forEach((button) => button.addEventListener("click", () => {
  activeColor = button.dataset.color;
  document.querySelectorAll(".color-swatch").forEach((swatch) => swatch.classList.toggle("active", swatch === button));
  setTool("pen");
}));
els.strokeWidth.addEventListener("input", () => setStrokeWidth(Number(els.strokeWidth.value)));
els.undoInk.addEventListener("click", () => {
  if (!state?.strokes.length) return;
  state.strokes.pop();
  renderInk();
  scheduleSave("已撤销笔迹");
});
els.toolMenu.addEventListener("click", (event) => {
  const button = closestElement(event.target, "button");
  if (!button) return;
  if (button.dataset.menuTool) setTool(button.dataset.menuTool);
  if (button.dataset.width) setStrokeWidth(Number(button.dataset.width));
  hideToolMenu();
});

els.viewport.addEventListener("pointerdown", startViewportAction);
els.viewport.addEventListener("pointermove", movePointer);
els.viewport.addEventListener("pointerup", endPointer);
els.viewport.addEventListener("pointercancel", endPointer);
window.addEventListener("pointermove", movePointer);
window.addEventListener("pointerup", endPointer);
window.addEventListener("pointercancel", endPointer);
els.viewport.addEventListener("click", (event) => {
  if (!closestElement(event.target, ".canvas-item") && activeTool === "select") {
    selectedId = null;
    renderBoard();
  }
});
els.viewport.addEventListener("wheel", (event) => {
  event.preventDefault();
  zoomAt(event.clientX, event.clientY, view.scale * (event.deltaY > 0 ? 0.92 : 1.08));
}, { passive: false });
els.viewport.addEventListener("contextmenu", showToolMenu);
window.addEventListener("click", hideToolMenu);
window.addEventListener("keydown", handleCanvasShortcut);
window.addEventListener("keyup", endCanvasShortcut);

els.viewport.addEventListener("dragover", (event) => {
  event.preventDefault();
  els.viewport.classList.add("drop-ready");
});
els.viewport.addEventListener("dragleave", () => els.viewport.classList.remove("drop-ready"));
els.viewport.addEventListener("drop", async (event) => {
  event.preventDefault();
  els.viewport.classList.remove("drop-ready");
  await readImages(event.dataTransfer.files, boardPointFromClient(event.clientX, event.clientY));
});
window.addEventListener("paste", handlePaste);

els.canvasUnlockForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const secret = els.canvasUnlockKey.value.trim();
  if (secret) await unlockCanvas(secret);
});

async function init() {
  const url = new URL(window.location.href);
  const hashKey = new URLSearchParams(url.hash.replace(/^#/, "")).get("key");
  if (hashKey) sessionStorage.setItem(SESSION_KEY, hashKey);
  await openDatabase();
  await migrateLegacyBoard();
  const id = url.searchParams.get("board");
  if (id) await loadCurrentBoard(id);
  else showHome();
}

init().catch(() => {
  document.body.classList.add("canvas-home-mode");
  els.canvasAccess.hidden = true;
  els.canvasHome.hidden = false;
  els.canvasWorkspace.hidden = true;
  els.boardEmpty.hidden = false;
  els.boardEmpty.querySelector("strong").textContent = "无法读取本机画布";
  els.boardEmpty.querySelector("p").textContent = "请确认浏览器允许本站使用本机存储";
});
