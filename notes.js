const PRIVATE_DATA_URL = "assets/content/blender-notes.enc.json";
const SESSION_KEY = "zaiye-notes-session-key";

const elements = {
  gate: document.querySelector("#notesGate"),
  form: document.querySelector("#notesUnlockForm"),
  key: document.querySelector("#notesUnlockKey"),
  message: document.querySelector("#notesUnlockMessage"),
  list: document.querySelector("#notebookList"),
  grid: document.querySelector("#notebookGrid"),
  lock: document.querySelector("#lockNotes"),
};

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

function renderNotebook(data) {
  const link = document.createElement("a");
  link.className = "notebook-card";
  link.href = "blender-notes.html";

  const label = document.createElement("span");
  label.className = "notebook-card-label";
  label.textContent = "学习笔记";
  const title = document.createElement("h3");
  title.textContent = data.title || "Blender 学习笔记";
  const meta = document.createElement("p");
  meta.textContent = `${data.categories.length} 个分类`;
  const arrow = document.createElement("span");
  arrow.className = "notebook-card-arrow";
  arrow.textContent = "→";
  arrow.setAttribute("aria-hidden", "true");

  link.append(label, title, meta, arrow);
  elements.grid.replaceChildren(link);
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
    const response = await fetch(PRIVATE_DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error();
    const data = await decryptNotes(await response.json(), secret);
    if (!Array.isArray(data.categories)) throw new Error();
    sessionStorage.setItem(SESSION_KEY, secret);
    renderNotebook(data);
    elements.gate.hidden = true;
    elements.list.hidden = false;
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
  elements.grid.replaceChildren();
  elements.list.hidden = true;
  elements.gate.hidden = false;
  elements.key.focus();
});

const sessionSecret = sessionStorage.getItem(SESSION_KEY);
if (sessionSecret) unlock(sessionSecret);
