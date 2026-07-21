import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getNotebookConfig,
  libraryOutputFile,
  notebooks,
  publicOutputFile,
  sharedKeyFile,
} from "./notebooks.config.mjs";
import { encryptText, validateNotebook } from "./notebook-crypto.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(scriptDir, "..");
const privateDir = resolve(projectDir, ".private");
const contentDir = resolve(projectDir, "assets", "content");
const keyPath = resolve(privateDir, sharedKeyFile);
const requestedId = process.argv[2];
const target = getNotebookConfig(requestedId);

if (!target) {
  throw new Error(`Unknown notebook: ${requestedId || "(missing)"}`);
}

async function loadOrCreateSecret() {
  try {
    return (await readFile(keyPath, "utf8")).trim();
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const secret = randomBytes(32).toString("base64url");
    await mkdir(privateDir, { recursive: true });
    await writeFile(keyPath, `${secret}\n`, "utf8");
    return secret;
  }
}

async function loadNotebook(config) {
  const sourceText = await readFile(resolve(privateDir, config.sourceFile), "utf8");
  const source = JSON.parse(sourceText);
  validateNotebook(source, config.id);
  return { config, source, sourceText };
}

const sources = await Promise.all(notebooks.map(loadNotebook));
const selected = sources.find(({ config }) => config.id === target.id);
const secret = await loadOrCreateSecret();

await mkdir(contentDir, { recursive: true });
const encryptedNotebook = await encryptText(selected.sourceText, secret);
await writeFile(
  resolve(contentDir, selected.config.outputFile),
  `${JSON.stringify(encryptedNotebook)}\n`,
  "utf8",
);

const library = {
  version: 1,
  notebooks: sources.map(({ config, source }) => ({
    ...source,
    categoryCount: source.categories.length,
    href: config.href,
    sourceFile: config.sourceFile,
    encryptedUrl: `assets/content/${config.outputFile}`,
  })),
};
const encryptedLibrary = await encryptText(`${JSON.stringify(library)}\n`, secret);
await writeFile(resolve(contentDir, libraryOutputFile), `${JSON.stringify(encryptedLibrary)}\n`, "utf8");

const publicManifest = {
  version: 1,
  notebooks: library.notebooks
    .filter((notebook) => notebook.publicVisible)
    .map((notebook) => ({
      id: notebook.id,
      title: notebook.title,
      summary: notebook.summary || "",
      categoryCount: notebook.categoryCount,
      href: notebook.href,
    })),
};
await writeFile(resolve(contentDir, publicOutputFile), `${JSON.stringify(publicManifest, null, 2)}\n`, "utf8");

console.log(`Updated encrypted notebook: assets/content/${selected.config.outputFile}`);
console.log(`Updated encrypted notebook library: assets/content/${libraryOutputFile}`);
console.log(`Updated public notebook manifest: assets/content/${publicOutputFile}`);
