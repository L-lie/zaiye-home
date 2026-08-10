import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const [sourcePath] = process.argv.slice(2);
if (!sourcePath) {
  throw new Error("Usage: node scripts/import-website-development-notes.mjs <markdown-file>");
}

const categoryIds = [
  "reading-guide",
  "current-status",
  "website",
  "chrome-store",
  "edge-store",
  "wechat-mini-program",
  "supabase",
  "local-editor",
  "trademark",
  "release-checklist",
];

const lines = (await readFile(path.resolve(sourcePath), "utf8")).replace(/\r\n/g, "\n").split("\n");
const categories = [];
let title = "从本地项目到真正上线";
let preamble = [];
let category = null;
let section = null;
let sectionIndex = 0;

function cleanInline(value) {
  return value.trim();
}

function ensureSection() {
  if (!category) return null;
  if (!section) {
    sectionIndex += 1;
    section = {
      id: `${category.id}-${String(sectionIndex).padStart(2, "0")}`,
      title: category.title,
      functionNames: [],
      shortcuts: [],
      blocks: [],
    };
    category.sections.push(section);
  }
  return section;
}

function addBlock(block) {
  ensureSection()?.blocks.push(block);
}

function isTableSeparator(line) {
  return /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*$/.test(line);
}

function splitTableRow(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

for (let index = 0; index < lines.length;) {
  const raw = lines[index];
  const line = raw.trimEnd();

  if (/^# /.test(line)) {
    title = line.replace(/^# /, "").trim();
    index += 1;
    continue;
  }

  if (/^## /.test(line)) {
    const categoryTitle = line.replace(/^## /, "").trim();
    category = {
      id: categoryIds[categories.length] || `category-${categories.length + 1}`,
      title: categoryTitle,
      keywords: [],
      sections: [],
    };
    categories.push(category);
    section = null;
    sectionIndex = 0;
    if (preamble.length) {
      addBlock({ type: "tip", text: preamble.join(" ") });
      preamble = [];
    }
    index += 1;
    continue;
  }

  if (/^### /.test(line)) {
    if (!category) throw new Error(`Section found before category: ${line}`);
    sectionIndex += 1;
    section = {
      id: `${category.id}-${String(sectionIndex).padStart(2, "0")}`,
      title: line.replace(/^### /, "").trim(),
      functionNames: [],
      shortcuts: [],
      blocks: [],
    };
    category.sections.push(section);
    index += 1;
    continue;
  }

  if (/^```/.test(line)) {
    const language = line.slice(3).trim();
    const code = [];
    index += 1;
    while (index < lines.length && !/^```/.test(lines[index].trimEnd())) {
      code.push(lines[index]);
      index += 1;
    }
    if (index >= lines.length) throw new Error("Unclosed fenced code block");
    addBlock({ type: "code", language, code: code.join("\n") });
    index += 1;
    continue;
  }

  if (line.trim().startsWith("|") && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
    const columns = splitTableRow(line);
    const rows = [];
    index += 2;
    while (index < lines.length && lines[index].trim().startsWith("|")) {
      rows.push(splitTableRow(lines[index]));
      index += 1;
    }
    addBlock({ type: "table", columns, rows });
    continue;
  }

  const orderedMatch = line.match(/^\s*\d+\.\s+(.+)$/);
  const unorderedMatch = line.match(/^\s*[-*]\s+(.+)$/);
  if (orderedMatch || unorderedMatch) {
    const ordered = Boolean(orderedMatch);
    const items = [];
    while (index < lines.length) {
      const candidate = lines[index].trimEnd();
      const match = candidate.match(ordered ? /^\s*\d+\.\s+(.+)$/ : /^\s*[-*]\s+(.+)$/);
      if (!match) break;
      items.push(cleanInline(match[1]));
      index += 1;
    }
    addBlock({ type: ordered ? "ordered-list" : "unordered-list", items });
    continue;
  }

  if (/^>\s?/.test(line)) {
    const quote = [];
    while (index < lines.length && /^>\s?/.test(lines[index].trimEnd())) {
      quote.push(lines[index].trimEnd().replace(/^>\s?/, "").trim());
      index += 1;
    }
    const text = quote.join(" ");
    if (category) addBlock({ type: "tip", text });
    else preamble.push(text);
    continue;
  }

  if (!line.trim() || /^---+$/.test(line.trim())) {
    index += 1;
    continue;
  }

  const paragraph = [line.trim()];
  index += 1;
  while (index < lines.length) {
    const next = lines[index].trimEnd();
    if (!next.trim() || /^(#{1,3} |```|>|\s*\d+\.\s+|\s*[-*]\s+|\|)/.test(next)) break;
    paragraph.push(next.trim());
    index += 1;
  }
  if (category) addBlock({ type: "paragraph", text: paragraph.join(" ") });
  else preamble.push(paragraph.join(" "));
}

for (const item of categories) {
  if (!item.sections.length) {
    throw new Error(`Category has no sections: ${item.title}`);
  }
}

const notebook = {
  version: 2,
  id: "website-development",
  title,
  summary: "独立产品开发、发布、维护与品牌保护的真实操作、踩坑和验证记录。",
  publicVisible: false,
  assets: [],
  categories,
};

const outputPath = path.resolve(".private", "website-development-notes.json");
await writeFile(outputPath, `${JSON.stringify(notebook, null, 2)}\n`, "utf8");
console.log(`Imported ${categories.length} categories to ${outputPath}`);
