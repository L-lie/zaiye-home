const notebookSettings = {
  privateDataUrl: document.body.dataset.privateDataUrl,
  localStorageKey: document.body.dataset.localStorageKey,
  localTitle: document.body.dataset.localTitle || "我的学习笔记",
  exportFilename: document.body.dataset.exportFilename || "my-notes.json",
};
const SESSION_KEY = "zaiye-notes-session-key";

const elements = {
  accessPanel: document.querySelector("#accessPanel"),
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
let scrollSyncFrame = null;
let mode = null;
let editingTarget = null;

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
    title: notebookSettings.localTitle,
    updatedAt: new Date().toISOString().slice(0, 10),
    categories: [],
  };
}

function loadLocalNotebook() {
  const saved = localStorage.getItem(notebookSettings.localStorageKey);
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
  localStorage.setItem(notebookSettings.localStorageKey, JSON.stringify(notes));
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
      const categoryElement = elements.notesContent.querySelector(`#category-${category.id}`);
      if (categoryElement) scrollToNote(categoryElement);
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
      const titleRow = document.createElement("div");
      titleRow.className = "note-section-heading";
      titleRow.append(title);
      if (mode === "local") {
        const actions = document.createElement("div");
        actions.className = "note-section-actions";
        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.textContent = "编辑";
        editButton.addEventListener("click", () => openEditor(categoryIndex, sectionIndex));
        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.textContent = "删除";
        deleteButton.addEventListener("click", () => deleteNote(categoryIndex, sectionIndex));
        actions.append(editButton, deleteButton);
        titleRow.append(actions);
      }
      sectionElement.append(titleRow);
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

function stickyOffset() {
  const headerStyle = getComputedStyle(document.querySelector(".notes-site-header"));
  const headerHeight = headerStyle.position === "fixed" ? document.querySelector(".notes-site-header").offsetHeight : 0;
  return headerHeight + elements.notesApp.querySelector(".notes-toolbar").offsetHeight + 18;
}

function setActiveNavigation(categoryIndex, sectionIndex) {
  elements.notesNav.querySelectorAll(".notes-subnav-button").forEach((item) => {
    item.classList.toggle(
      "is-active",
      item.dataset.categoryIndex === String(categoryIndex) && item.dataset.sectionIndex === String(sectionIndex),
    );
  });

  const group = elements.notesNav.querySelector(`.notes-nav-group[data-category-index="${categoryIndex}"]`);
  if (!group) return;
  group.querySelector(".notes-nav-button").setAttribute("aria-expanded", "true");
  group.querySelector(".notes-subnav").classList.add("is-open");
}

function syncActiveNavigation() {
  scrollSyncFrame = null;
  const sections = [...elements.notesContent.querySelectorAll(".note-section:not([hidden])")];
  if (!sections.length) return;
  const threshold = stickyOffset() + 24;
  const active = sections.reduce((current, section) => (section.getBoundingClientRect().top <= threshold ? section : current), sections[0]);
  setActiveNavigation(active.dataset.categoryIndex, active.dataset.sectionIndex);
}

function requestNavigationSync() {
  if (scrollSyncFrame !== null || elements.notesApp.hidden) return;
  scrollSyncFrame = requestAnimationFrame(syncActiveNavigation);
}

function scrollToNote(section) {
  const top = section.getBoundingClientRect().top + window.scrollY - stickyOffset();
  window.scrollTo({ top, behavior: "smooth" });
}

function renderNotebook() {
  createNavigation();
  createContent();
  filterNotes();
  requestNavigationSync();
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
  requestNavigationSync();
}

function makeId(label) {
  const base = label
    .toLocaleLowerCase("zh-CN")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || "note"}-${Date.now().toString(36)}`;
}

function normalizeSection(section) {
  return {
    id: section.id || makeId(section.title || "note"),
    title: section.title || "未命名笔记",
    functionNames: Array.isArray(section.functionNames) ? section.functionNames : [],
    shortcuts: Array.isArray(section.shortcuts) ? section.shortcuts : [],
    blocks: Array.isArray(section.blocks) ? section.blocks : [],
  };
}

function sectionToPlainText(section) {
  return normalizeSection(section).blocks
    .map((block) => {
      if (block.type === "paragraph" || block.type === "tip") return block.text || "";
      if (block.type === "ordered-list" || block.type === "unordered-list") return (block.items || []).join("\n");
      if (block.type === "shortcuts") return (block.items || []).map((item) => `${item.keys} ${item.action}`).join("\n");
      if (block.type === "table") {
        const columns = (block.columns || []).join(" | ");
        const rows = (block.rows || []).map((row) => row.join(" | ")).join("\n");
        return [columns, rows].filter(Boolean).join("\n");
      }
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
}

function sectionShortcutText(section) {
  const normalized = normalizeSection(section);
  return [...normalized.functionNames, ...normalized.shortcuts]
    .filter(Boolean)
    .filter((item, index, array) => array.indexOf(item) === index)
    .join(", ");
}

function blocksFromPlainText(body) {
  return body
    .split(/\n\s*\n/)
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text) => ({ type: "paragraph", text: text.replace(/\n/g, " ") }));
}

function openEditor(categoryIndex = null, sectionIndex = null) {
  editingTarget = Number.isInteger(categoryIndex) && Number.isInteger(sectionIndex)
    ? { categoryIndex, sectionIndex }
    : null;
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
  elements.noteForm.reset();

  if (editingTarget) {
    const section = normalizeSection(notes.categories[categoryIndex].sections[sectionIndex]);
    elements.editorCategory.value = String(categoryIndex);
    elements.editorTitle.value = section.title;
    elements.editorBody.value = sectionToPlainText(section);
    elements.editorShortcuts.value = sectionShortcutText(section);
  } else if (!notes.categories.length) {
    elements.editorCategory.value = "new";
  }

  elements.newCategoryField.hidden = elements.editorCategory.value !== "new";
  elements.noteDialog.querySelector(".dialog-heading h2").textContent = editingTarget ? "编辑笔记" : "新增笔记";
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
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const nextSection = {
    id: editingTarget
      ? notes.categories[editingTarget.categoryIndex].sections[editingTarget.sectionIndex].id
      : makeId(title),
    title,
    functionNames: tags,
    shortcuts: tags,
    blocks: blocksFromPlainText(body),
  };

  if (editingTarget) {
    const oldCategory = notes.categories[editingTarget.categoryIndex];
    if (oldCategory === category) {
      category.sections[editingTarget.sectionIndex] = nextSection;
    } else {
      oldCategory.sections.splice(editingTarget.sectionIndex, 1);
      category.sections.push(nextSection);
    }
    editingTarget = null;
  } else {
    category.sections.push(nextSection);
  }

  saveLocalNotebook();
  renderNotebook();
  return true;
}

function deleteNote(categoryIndex, sectionIndex) {
  const category = notes.categories[categoryIndex];
  const section = category?.sections?.[sectionIndex];
  if (!section) return;
  if (!window.confirm(`删除“${section.title || "这条笔记"}”？`)) return;
  category.sections.splice(sectionIndex, 1);
  if (category.sections.length === 0 && window.confirm(`“${category.title}”已经没有笔记，是否同时删除这个大分类？`)) {
    notes.categories.splice(categoryIndex, 1);
  }
  saveLocalNotebook();
  renderNotebook();
}

elements.startLocal.addEventListener("click", () => openNotebook(loadLocalNotebook(), "local"));
elements.notesSearch.addEventListener("input", filterNotes);
window.addEventListener("scroll", requestNavigationSync, { passive: true });
window.addEventListener("resize", requestNavigationSync);
elements.closeNotes.addEventListener("click", () => {
  if (mode === "owner") {
    window.location.href = "notes.html";
    return;
  }
  notes = null;
  mode = null;
  elements.notesApp.hidden = true;
  elements.accessPanel.hidden = false;
});

const sessionSecret = sessionStorage.getItem(SESSION_KEY);
if (sessionSecret) {
  elements.unlockMessage.textContent = "正在打开笔记…";
  fetch(`${notebookSettings.privateDataUrl}?v=${Date.now()}`, { cache: "no-store" })
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
      window.location.replace("notes.html");
    });
}

elements.notesNav.addEventListener("click", (event) => {
  const button = event.target.closest(".notes-subnav-button");
  if (!button) return;
  setActiveNavigation(button.dataset.categoryIndex, button.dataset.sectionIndex);
  const section = elements.notesContent
    .querySelector(`[data-category-index="${button.dataset.categoryIndex}"][data-section-index="${button.dataset.sectionIndex}"]`);
  if (section) scrollToNote(section);
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
  link.download = notebookSettings.exportFilename;
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
