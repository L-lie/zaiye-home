const PRIVATE_LIBRARY_URL = "assets/content/notes-library.enc.json";
const PUBLIC_DATA_URL = "assets/content/notes-public.json";
const SESSION_KEY = "zaiye-notes-session-key";

const elements = {
  gate: document.querySelector("#notesGate"),
  form: document.querySelector("#notesUnlockForm"),
  key: document.querySelector("#notesUnlockKey"),
  message: document.querySelector("#notesUnlockMessage"),
  publicList: document.querySelector("#publicNotebookList"),
  publicGrid: document.querySelector("#publicNotebookGrid"),
  privateList: document.querySelector("#privateNotebookList"),
  privateGrid: document.querySelector("#privateNotebookGrid"),
  shelfMessage: document.querySelector("#shelfMessage"),
  lock: document.querySelector("#lockNotes"),
};

const sourceFileHandles = new Map();
let privateNotebooks = [];

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function decryptNotes(payload, secret) {
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

function createNotebookCard(data, isPrivate = false) {
  const card = document.createElement(isPrivate ? "article" : "a");
  card.className = "notebook-card";
  if (!isPrivate) card.href = data.href;

  const header = document.createElement("div");
  header.className = "notebook-card-header";
  const label = document.createElement("span");
  label.className = "notebook-card-label";
  label.textContent = isPrivate ? "私人笔记本" : "学习笔记";
  header.append(label);

  if (isPrivate) {
    const visibility = document.createElement("label");
    visibility.className = "visibility-control";
    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.checked = Boolean(data.publicVisible);
    const toggleText = document.createElement("span");
    toggleText.textContent = "在上一层展示";
    visibility.append(toggle, toggleText);
    visibility.addEventListener("click", (event) => event.stopPropagation());
    toggle.addEventListener("click", (event) => event.stopPropagation());
    toggle.addEventListener("change", async () => {
      const saved = await savePublicVisibility(data, toggle.checked);
      if (!saved) toggle.checked = !toggle.checked;
    });
    header.append(visibility);
  }

  const title = document.createElement("h3");
  title.textContent = data.title || "未命名笔记";
  const meta = document.createElement("p");
  const categoryCount = data.categoryCount ?? data.categories?.length ?? 0;
  meta.textContent = `${categoryCount} 个分类`;
  const arrow = document.createElement("span");
  arrow.className = "notebook-card-arrow";
  arrow.textContent = "→";
  arrow.setAttribute("aria-hidden", "true");

  if (isPrivate) {
    const openLink = document.createElement("a");
    openLink.className = "notebook-card-open";
    openLink.href = data.href;
    openLink.append(title, meta, arrow);
    card.append(header, openLink);
  } else {
    card.append(header, title, meta, arrow);
  }
  return card;
}

function renderPrivateShelf(notebooks) {
  privateNotebooks = notebooks;
  elements.privateGrid.replaceChildren(...notebooks.map((notebook) => createNotebookCard(notebook, true)));
}

function downloadUpdatedSource(data) {
  const source = { ...data };
  delete source.categoryCount;
  delete source.href;
  delete source.sourceFile;
  delete source.encryptedUrl;
  const blob = new Blob([`${JSON.stringify(source, null, 2)}\n`], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = data.sourceFile;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function savePublicVisibility(notebook, publicVisible) {
  const nextNotebook = { ...notebook, publicVisible };
  elements.shelfMessage.textContent = `请选择私人源文件 ${notebook.sourceFile} 以保存设置`;

  if (!("showOpenFilePicker" in window)) {
    downloadUpdatedSource(nextNotebook);
    privateNotebooks = privateNotebooks.map((item) => (item.id === notebook.id ? nextNotebook : item));
    elements.shelfMessage.textContent = `浏览器不支持直接写入，已下载更新后的 ${notebook.sourceFile}`;
    return true;
  }

  try {
    let sourceFileHandle = sourceFileHandles.get(notebook.id);
    if (!sourceFileHandle) {
      [sourceFileHandle] = await window.showOpenFilePicker({
        multiple: false,
        types: [{ description: "私人笔记源文件", accept: { "application/json": [".json"] } }],
      });
      sourceFileHandles.set(notebook.id, sourceFileHandle);
    }
    const file = await sourceFileHandle.getFile();
    const source = JSON.parse(await file.text());
    if (!Array.isArray(source.categories) || source.id !== notebook.id) {
      throw new Error(`请选择 .private/${notebook.sourceFile}`);
    }
    source.publicVisible = publicVisible;
    const writable = await sourceFileHandle.createWritable();
    await writable.write(`${JSON.stringify(source, null, 2)}\n`);
    await writable.close();
    privateNotebooks = privateNotebooks.map((item) => (item.id === notebook.id ? nextNotebook : item));
    elements.shelfMessage.textContent = publicVisible
      ? "已保存：下次发布笔记后会在上一层展示"
      : "已保存：下次发布笔记后会从上一层隐藏";
    return true;
  } catch (error) {
    elements.shelfMessage.textContent = error.name === "AbortError" ? "已取消保存" : error.message;
    return false;
  }
}

async function loadPublicNotebooks() {
  try {
    const response = await fetch(PUBLIC_DATA_URL, { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    if (!Array.isArray(data.notebooks) || data.notebooks.length === 0) return;
    elements.publicGrid.replaceChildren(...data.notebooks.map((notebook) => createNotebookCard(notebook)));
    elements.publicList.hidden = false;
  } catch {
    // No public notebooks means the whole public list stays absent.
  }
}

async function rememberWithBrowser(secret) {
  if (!("PasswordCredential" in window) || !navigator.credentials?.store) return;
  try {
    const credential = new PasswordCredential({
      id: "zaiye-notes-owner",
      name: "再野学习笔记",
      password: secret,
    });
    await navigator.credentials.store(credential);
  } catch {
    // The standard form remains available to the browser password manager.
  }
}

async function unlock(secret, offerToSave = false) {
  elements.message.textContent = "正在解锁…";
  try {
    const response = await fetch(`${PRIVATE_LIBRARY_URL}?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error();
    const data = await decryptNotes(await response.json(), secret);
    if (!Array.isArray(data.notebooks)) throw new Error();
    sessionStorage.setItem(SESSION_KEY, secret);
    renderPrivateShelf(data.notebooks);
    elements.gate.hidden = true;
    elements.publicList.hidden = true;
    elements.privateList.hidden = false;
    elements.message.textContent = "";
    if (offerToSave) await rememberWithBrowser(secret);
    elements.key.value = "";
    return true;
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    elements.message.textContent = "密钥不正确，请重新输入";
    return false;
  }
}

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const secret = elements.key.value.trim();
  if (secret) await unlock(secret, true);
});

elements.lock.addEventListener("click", () => {
  sessionStorage.removeItem(SESSION_KEY);
  sourceFileHandles.clear();
  privateNotebooks = [];
  elements.privateGrid.replaceChildren();
  elements.privateList.hidden = true;
  elements.gate.hidden = false;
  loadPublicNotebooks();
  elements.key.focus();
});

const sessionSecret = sessionStorage.getItem(SESSION_KEY);
if (sessionSecret) {
  unlock(sessionSecret);
} else {
  loadPublicNotebooks();
}
