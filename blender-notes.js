const PRIVATE_DATA_URL = "assets/content/blender-notes.enc.json";
const LOCAL_STORAGE_KEY = "zaiye-blender-notes-local-v1";
const SESSION_KEY = "zaiye-notes-session-key";

const elements = {
  accessPanel: document.querySelector("#accessPanel"),
  unlockForm: document.querySelector("#unlockForm"),
  unlockKey: document.querySelector("#unlockKey"),
  unlockMessage: document.querySelector("#unlockMessage"),
  startLocal: document.querySelector("#startLocal"),
  notesApp: document.querySelector("#notesApp"),
  notesSearch: document.querySelector("#notesSearch"),
  searchStatus: document.querySelector("#searchStatus"),
  modeLabel: document.querySelector("#modeLabel"),
  localActions: document.querySelector("#localActions"),
  notesNav: document.querySelector("#notesNav"),
  notesContent: document.querySelector("#notesContent"),
  closeNotes: document.querySelector("#closeNotes"),
  newNote: document.querySelector("#newNote"),
  importNotes: document.querySelector("#importNotes"),
  exportNotes: document.querySelector("#exportNotes"),
  importFile: document.querySelector("#importFile"),
  noteDialog: document.querySelector("#noteDialog"),
  noteForm: document.querySelector("#noteForm"),
  editorCategory: document.querySelector("#editorCategory"),
  newCategoryField: document.querySelector("#newCategoryField"),
  editorNewCategory: document.querySelector("#editorNewCategory"),
  editorTitle: document.querySelector("#editorTitle"),
  editorBody: document.querySelector("#editorBody"),
  editorShortcuts: document.querySelector("#editorShortcuts"),
};

let notes = null;
let mode = null;

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

function createEmptyNotebook() {
  return {
    version: 1,
    title: "我的 Blender 笔记",
    updatedAt: new Date().toISOString().slice(0, 10),
    categories: [],
  };
}

function loadLocalNotebook() {
  const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!saved) return createEmptyNotebook();
  try {
    return validateNotes(JSON.parse(saved));
  } catch {
    return createEmptyNotebook();
  }
}

function saveLocalNotebook() {
  if (mode !== "local" || !notes) return;
  notes.updatedAt = new Date().toISOString().slice(0, 10);
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(notes));
}

function validateNotes(value) {
  if (!value || !Array.isArray(value.categories)) {
    throw new Error("笔记文件格式不正确");
  }
  return value;
}

function openNotebook(data, nextMode) {
  notes = validateNotes(data);
  mode = nextMode;
  elements.accessPanel.hidden = true;
  elements.notesApp.hidden = false;
  elements.modeLabel.textContent = mode === "owner" ? "私人笔记" : "仅保存在本机";
  elements.localActions.hidden = mode !== "local";
  elements.notesSearch.value = "";
  renderNotebook();
}

function appendInlineText(parent, source) {
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let cursor = 0;
  for (const match of source.matchAll(pattern)) {
    if (match.index > cursor) parent.append(document.createTextNode(source.slice(cursor, match.index)));
    const token = match[0];
    const element = token.startsWith("**") ? document.createElement("strong") : document.createElement("code");
    element.textContent = token.startsWith("**") ? token.slice(2, -2) : token.slice(1, -1);
    parent.append(element);
    cursor = match.index + token.length;
  }
  if (cursor < source.length) parent.append(document.createTextNode(source.slice(cursor)));
}

function renderTextBlock(tagName, text, className) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  appendInlineText(element, text);
  return element;
}

function renderList(block) {
  const list = document.createElement(block.type === "ordered-list" ? "ol" : "ul");
  block.items.forEach((item) => {
    const listItem = document.createElement("li");
    appendInlineText(listItem, item);
    list.append(listItem);
  });
  return list;
}

function renderTable(block) {
  const wrapper = document.createElement("div");
  wrapper.className = "note-table-wrap";
  const table = document.createElement("table");
  table.className = "note-table";
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  block.columns.forEach((column) => {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = column;
    headRow.append(cell);
  });
  head.append(headRow);
  const body = document.createElement("tbody");
  block.rows.forEach((row) => {
    const tableRow = document.createElement("tr");
    row.forEach((value, index) => {
      const cell = document.createElement("td");
      if (index === 0) {
        const code = document.createElement("code");
        code.textContent = value;
        cell.append(code);
      } else {
        cell.textContent = value;
      }
      tableRow.append(cell);
    });
    body.append(tableRow);
  });
  table.append(head, body);
  wrapper.append(table);
  return wrapper;
}

function renderBlock(block) {
  if (block.type === "paragraph") return renderTextBlock("p", block.text);
  if (block.type === "tip") return renderTextBlock("p", block.text, "note-tip");
  if (block.type === "ordered-list" || block.type === "unordered-list") return renderList(block);
  if (block.type === "table") return renderTable(block);
  if (block.type === "shortcuts") {
    return renderList({
      type: "unordered-list",
      items: block.items.map((item) => `\`${item.keys}\`：${item.action}`),
    });
  }
  return document.createDocumentFragment();
}

function buildSearchText(category, section) {
  return JSON.stringify({
    category: category.title,
    keywords: category.keywords || [],
    title: section.title,
    functions: section.functionNames || [],
    shortcuts: section.shortcuts || [],
    blocks: section.blocks || [],
  }).toLocaleLowerCase("zh-CN");
}

function createNavigation() {
  const fragment = document.createDocumentFragment();
  notes.categories.forEach((category, categoryIndex) => {
    const group = document.createElement("div");
    group.className = "notes-nav-group";
    group.dataset.categoryIndex = categoryIndex;

    const categoryButton = document.createElement("button");
    categoryButton.type = "button";
    categoryButton.className = "notes-nav-button";
    categoryButton.textContent = category.title;
    categoryButton.setAttribute("aria-expanded", categoryIndex === 0 ? "true" : "false");

    const subnav = document.createElement("div");
    subnav.className = `notes-subnav${categoryIndex === 0 ? " is-open" : ""}`;
    category.sections.forEach((section, sectionIndex) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "notes-subnav-button";
      button.textContent = section.title;
      button.dataset.categoryIndex = categoryIndex;
      button.dataset.sectionIndex = sectionIndex;
      subnav.append(button);
    });

    categoryButton.addEventListener("click", () => {
      const willOpen = categoryButton.getAttribute("aria-expanded") !== "true";
      categoryButton.setAttribute("aria-expanded", String(willOpen));
      subnav.classList.toggle("is-open", willOpen);
      document.querySelector(`#category-${category.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    group.append(categoryButton, subnav);
    fragment.append(group);
  });
  elements.notesNav.replaceChildren(fragment);
}

function createContent() {
  const fragment = document.createDocumentFragment();
  notes.categories.forEach((category, categoryIndex) => {
    const categoryElement = document.createElement("section");
    categoryElement.className = "notes-category";
    categoryElement.id = `category-${category.id}`;
    categoryElement.dataset.categoryIndex = categoryIndex;
    const heading = document.createElement("h2");
    heading.textContent = category.title;
    categoryElement.append(heading);

    category.sections.forEach((section, sectionIndex) => {
      const sectionElement = document.createElement("section");
      sectionElement.className = "note-section";
      sectionElement.id = `note-${section.id}`;
      sectionElement.dataset.categoryIndex = categoryIndex;
      sectionElement.dataset.sectionIndex = sectionIndex;
      sectionElement.dataset.searchText = buildSearchText(category, section);
      const title = document.createElement("h3");
      title.textContent = section.title;
      sectionElement.append(title);
      section.blocks.forEach((block) => sectionElement.append(renderBlock(block)));
      categoryElement.append(sectionElement);
    });
    fragment.append(categoryElement);
  });

  if (!notes.categories.length) {
    const empty = document.createElement("div");
    empty.className = "notes-empty";
    empty.textContent = "还没有笔记。点击“新增笔记”建立第一个分类和内容。";
    fragment.append(empty);
  }
  elements.notesContent.replaceChildren(fragment);
}

function renderNotebook() {
  createNavigation();
  createContent();
  filterNotes();
}

function filterNotes() {
  const query = elements.notesSearch.value.trim().toLocaleLowerCase("zh-CN");
  const sections = [...elements.notesContent.querySelectorAll(".note-section")];
  let count = 0;
  sections.forEach((section) => {
    const matched = !query || section.dataset.searchText.includes(query);
    section.hidden = !matched;
    if (matched) count += 1;
  });

  elements.notesContent.querySelectorAll(".notes-category").forEach((category) => {
    const visible = [...category.querySelectorAll(".note-section")].some((section) => !section.hidden);
    category.hidden = !visible;
  });

  elements.notesNav.querySelectorAll(".notes-nav-group").forEach((group) => {
    const categoryIndex = group.dataset.categoryIndex;
    const visibleSections = sections.filter(
      (section) => section.dataset.categoryIndex === categoryIndex && !section.hidden,
    );
    group.hidden = query ? visibleSections.length === 0 : false;
    group.querySelectorAll(".notes-subnav-button").forEach((button) => {
      const section = sections.find(
        (item) =>
          item.dataset.categoryIndex === button.dataset.categoryIndex &&
          item.dataset.sectionIndex === button.dataset.sectionIndex,
      );
      button.hidden = Boolean(query && section?.hidden);
    });
    if (query && visibleSections.length) {
      group.querySelector(".notes-nav-button").setAttribute("aria-expanded", "true");
      group.querySelector(".notes-subnav").classList.add("is-open");
    }
  });

  elements.searchStatus.textContent = query ? `找到 ${count} 条匹配笔记` : `共 ${sections.length} 条笔记`;
  let empty = elements.notesContent.querySelector(".search-empty");
  if (query && count === 0) {
    if (!empty) {
      empty = document.createElement("div");
      empty.className = "notes-empty search-empty";
      empty.textContent = "没有找到匹配内容";
      elements.notesContent.append(empty);
    }
  } else {
    empty?.remove();
  }
}

function makeId(label) {
  const base = label
    .toLocaleLowerCase("zh-CN")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || "note"}-${Date.now().toString(36)}`;
}

function openEditor() {
  elements.editorCategory.replaceChildren();
  notes.categories.forEach((category, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = category.title;
    elements.editorCategory.append(option);
  });
  const newOption = document.createElement("option");
  newOption.value = "new";
  newOption.textContent = "新建大分类";
  elements.editorCategory.append(newOption);
  if (!notes.categories.length) elements.editorCategory.value = "new";
  elements.newCategoryField.hidden = elements.editorCategory.value !== "new";
  elements.noteForm.reset();
  if (!notes.categories.length) elements.editorCategory.value = "new";
  elements.newCategoryField.hidden = elements.editorCategory.value !== "new";
  elements.noteDialog.showModal();
}

function saveEditorNote() {
  const title = elements.editorTitle.value.trim();
  const body = elements.editorBody.value.trim();
  if (!title || !body) return false;

  let category;
  if (elements.editorCategory.value === "new") {
    const categoryTitle = elements.editorNewCategory.value.trim();
    if (!categoryTitle) {
      elements.editorNewCategory.focus();
      return false;
    }
    category = {
      id: makeId(categoryTitle),
      title: categoryTitle,
      keywords: [],
      sections: [],
    };
    notes.categories.push(category);
  } else {
    category = notes.categories[Number(elements.editorCategory.value)];
  }

  const tags = elements.editorShortcuts.value
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const blocks = body
    .split(/\n\s*\n/)
    .map((text) => ({ type: "paragraph", text: text.replace(/\n/g, " ") }));
  category.sections.push({
    id: makeId(title),
    title,
    functionNames: tags,
    shortcuts: tags,
    blocks,
  });
  saveLocalNotebook();
  renderNotebook();
  return true;
}

elements.unlockForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const secret = elements.unlockKey.value.trim();
  if (!secret) return;
  elements.unlockMessage.textContent = "正在解锁…";
  try {
    const response = await fetch(PRIVATE_DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("暂时没有可读取的私人笔记");
    const data = await decryptNotes(await response.json(), secret);
    sessionStorage.setItem(SESSION_KEY, secret);
    elements.unlockMessage.textContent = "";
    elements.unlockKey.value = "";
    openNotebook(data, "owner");
  } catch {
    elements.unlockMessage.textContent = "密钥不正确，或加密笔记尚未生成";
  }
});

elements.startLocal.addEventListener("click", () => openNotebook(loadLocalNotebook(), "local"));
elements.notesSearch.addEventListener("input", filterNotes);
elements.closeNotes.addEventListener("click", () => {
  if (mode === "owner") sessionStorage.removeItem(SESSION_KEY);
  notes = null;
  mode = null;
  elements.notesApp.hidden = true;
  elements.accessPanel.hidden = false;
});

const sessionSecret = sessionStorage.getItem(SESSION_KEY);
if (sessionSecret) {
  elements.unlockMessage.textContent = "正在打开笔记…";
  fetch(PRIVATE_DATA_URL, { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error();
      return response.json();
    })
    .then((payload) => decryptNotes(payload, sessionSecret))
    .then((data) => {
      elements.unlockMessage.textContent = "";
      openNotebook(data, "owner");
    })
    .catch(() => {
      sessionStorage.removeItem(SESSION_KEY);
      elements.unlockMessage.textContent = "解锁状态已失效，请重新输入密钥";
    });
}

elements.notesNav.addEventListener("click", (event) => {
  const button = event.target.closest(".notes-subnav-button");
  if (!button) return;
  elements.notesNav.querySelectorAll(".notes-subnav-button").forEach((item) => item.classList.remove("is-active"));
  button.classList.add("is-active");
  document
    .querySelector(`[data-category-index="${button.dataset.categoryIndex}"][data-section-index="${button.dataset.sectionIndex}"]`)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
});

elements.newNote.addEventListener("click", openEditor);
elements.editorCategory.addEventListener("change", () => {
  elements.newCategoryField.hidden = elements.editorCategory.value !== "new";
});
elements.noteForm.addEventListener("submit", (event) => {
  if (event.submitter?.value !== "save") return;
  event.preventDefault();
  if (saveEditorNote()) elements.noteDialog.close();
});

elements.exportNotes.addEventListener("click", () => {
  const blob = new Blob([`${JSON.stringify(notes, null, 2)}\n`], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "my-blender-notes.json";
  link.click();
  URL.revokeObjectURL(link.href);
});

elements.importNotes.addEventListener("click", () => elements.importFile.click());
elements.importFile.addEventListener("change", async () => {
  const [file] = elements.importFile.files;
  if (!file) return;
  try {
    notes = validateNotes(JSON.parse(await file.text()));
    saveLocalNotebook();
    renderNotebook();
  } catch (error) {
    window.alert(error.message || "无法读取这个笔记文件");
  } finally {
    elements.importFile.value = "";
  }
});
