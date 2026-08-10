import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { decryptPayload } from "./notebook-crypto.mjs";
import { libraryOutputFile, publicOutputFile, sharedKeyFile } from "./notebooks.config.mjs";

const privateDir = resolve(".private");
const contentDir = resolve("assets", "content");
const secret = (await readFile(resolve(privateDir, sharedKeyFile), "utf8")).trim();
const source = JSON.parse(await readFile(resolve(privateDir, "website-development-notes.json"), "utf8"));
const libraryPayload = JSON.parse(await readFile(resolve(contentDir, libraryOutputFile), "utf8"));
const library = JSON.parse(await decryptPayload(libraryPayload, secret));
const publicManifest = JSON.parse(await readFile(resolve(contentDir, publicOutputFile), "utf8"));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const libraryItem = library.notebooks.find((item) => item.id === "website-development");
assert(libraryItem, "unlocked library does not contain website-development");
assert(libraryItem.href === "website-development-notes.html", "library page link is incorrect");
assert(libraryItem.publicVisible === false, "private notebook is marked public");
assert(!publicManifest.notebooks.some((item) => item.id === "website-development"), "public manifest leaks private notebook metadata");

const publicText = JSON.stringify(publicManifest);
assert(!publicText.includes(source.title), "public manifest leaks the private title");
assert(!publicText.includes("categories"), "public manifest leaks private categories");

const sections = source.categories.flatMap((category) => category.sections);
const blocks = sections.flatMap((section) => section.blocks);
const searchableText = JSON.stringify(source).toLocaleLowerCase("zh-CN");
assert(sections.length === 45, "unexpected navigation section count");
assert(new Set(sections.map((section) => section.id)).size === sections.length, "navigation section ids are not unique");
assert(searchableText.includes("git add ."), "search index is missing Git staging guidance");
assert(searchableText.includes("github 443"), "search index is missing push failure guidance");
assert(blocks.some((block) => block.type === "code"), "code blocks were not imported");
assert(blocks.some((block) => block.type === "table"), "tables were not imported");
assert(blocks.some((block) => block.type === "ordered-list"), "ordered lists were not imported");
assert(blocks.some((block) => block.type === "unordered-list"), "unordered lists were not imported");

console.log(
  `Website notebook integration passed: ${source.categories.length} categories, ${sections.length} navigation sections, ${blocks.length} searchable blocks, private library entry present, public manifest clean.`,
);
