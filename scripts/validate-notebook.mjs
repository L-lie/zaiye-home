import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getNotebookConfig,
  libraryOutputFile,
  notebooks,
  publicOutputFile,
  sharedKeyFile,
} from "./notebooks.config.mjs";
import { assert, decryptPayload, validateNotebook } from "./notebook-crypto.mjs";

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const privateDir = resolve(projectDir, ".private");
const contentDir = resolve(projectDir, "assets", "content");
const target = getNotebookConfig(process.argv[2]);

if (!target) {
  throw new Error(`Unknown notebook: ${process.argv[2] || "(missing)"}`);
}

const secret = (await readFile(resolve(privateDir, sharedKeyFile), "utf8")).trim();
const sourceText = await readFile(resolve(privateDir, target.sourceFile), "utf8");
const source = JSON.parse(sourceText);
const sectionCount = validateNotebook(source, target.id);
const payload = JSON.parse(await readFile(resolve(contentDir, target.outputFile), "utf8"));
const decrypted = await decryptPayload(payload, secret);
assert(decrypted === sourceText, "encrypted website data is not up to date with the private source");

const sourceEntries = await Promise.all(
  notebooks.map(async (config) => {
    const value = JSON.parse(await readFile(resolve(privateDir, config.sourceFile), "utf8"));
    validateNotebook(value, config.id);
    return { config, value };
  }),
);

const libraryPayload = JSON.parse(await readFile(resolve(contentDir, libraryOutputFile), "utf8"));
const library = JSON.parse(await decryptPayload(libraryPayload, secret));
assert(Array.isArray(library.notebooks), "private notebook library must contain a notebooks array");
assert(library.notebooks.length === sourceEntries.length, "private notebook library is incomplete");
for (const { config, value } of sourceEntries) {
  const item = library.notebooks.find((notebook) => notebook.id === config.id);
  assert(item, `private notebook library is missing ${config.id}`);
  assert(item.title === value.title, `private notebook title is not up to date: ${config.id}`);
  assert(item.categoryCount === value.categories.length, `private category count is not up to date: ${config.id}`);
  assert(item.publicVisible === value.publicVisible, `private visibility is not up to date: ${config.id}`);
  assert(item.href === config.href, `private page link is not up to date: ${config.id}`);
}

const publicManifest = JSON.parse(await readFile(resolve(contentDir, publicOutputFile), "utf8"));
const expectedPublic = sourceEntries.filter(({ value }) => value.publicVisible);
assert(Array.isArray(publicManifest.notebooks), "public notebook manifest must contain a notebooks array");
assert(publicManifest.notebooks.length === expectedPublic.length, "public notebook manifest is not up to date");
for (const { config, value } of expectedPublic) {
  const item = publicManifest.notebooks.find((notebook) => notebook.id === config.id);
  assert(item?.title === value.title, `public notebook is not up to date: ${config.id}`);
  assert(!("categories" in item), "private categories must not appear in the public manifest");
}

console.log(
  `${source.title} is valid: ${source.categories.length} categories, ${sectionCount} sections, ${library.notebooks.length} notebooks in the private library.`,
);
