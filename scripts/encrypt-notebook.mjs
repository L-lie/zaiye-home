import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
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
import {
  cleanOrphanedAssets,
  collectAssetUrls,
  compileNotebookAssets,
} from "./notebook-assets.mjs";

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
  return { config, source };
}

const sources = await Promise.all(notebooks.map(loadNotebook));
const secret = await loadOrCreateSecret();
await mkdir(contentDir, { recursive: true });

const compiledSources = [];
const generatedFiles = new Set();
try {
  for (const entry of sources) {
    const compiled = await compileNotebookAssets({
      source: entry.source,
      config: entry.config,
      privateDir,
      contentDir,
      secret,
    });
    compiled.generatedFiles.forEach((file) => generatedFiles.add(file));
    compiledSources.push({ ...entry, compiled: compiled.notebook });
  }

  for (const entry of compiledSources) {
    const encryptedNotebook = await encryptText(`${JSON.stringify(entry.compiled, null, 2)}\n`, secret);
    await writeFile(
      resolve(contentDir, entry.config.outputFile),
      `${JSON.stringify(encryptedNotebook)}\n`,
      "utf8",
    );
  }

  const library = {
    version: 2,
    notebooks: compiledSources.map(({ config, compiled }) => ({
      ...compiled,
      categoryCount: compiled.categories.length,
      href: config.href,
      sourceFile: config.sourceFile,
      encryptedUrl: `assets/content/${config.outputFile}`,
    })),
  };
  const encryptedLibrary = await encryptText(`${JSON.stringify(library)}\n`, secret);
  await writeFile(resolve(contentDir, libraryOutputFile), `${JSON.stringify(encryptedLibrary)}\n`, "utf8");

  const publicManifest = {
    version: 2,
    notebooks: library.notebooks
      .filter((notebook) => notebook.publicVisible === true)
      .map((notebook) => ({
        id: notebook.id,
        title: notebook.title,
        summary: notebook.summary || "",
        categoryCount: notebook.categoryCount,
        href: notebook.href,
      })),
  };
  await writeFile(resolve(contentDir, publicOutputFile), `${JSON.stringify(publicManifest, null, 2)}\n`, "utf8");

  const allowedAssetUrls = new Set();
  compiledSources.forEach(({ compiled }) => {
    collectAssetUrls(compiled).forEach((url) => allowedAssetUrls.add(url));
  });
  await cleanOrphanedAssets(contentDir, allowedAssetUrls);

  console.log(`Updated encrypted notebooks: ${compiledSources.map(({ config }) => `assets/content/${config.outputFile}`).join(", ")}`);
  console.log(`Updated encrypted notebook library: assets/content/${libraryOutputFile}`);
  console.log(`Updated public notebook manifest: assets/content/${publicOutputFile}`);
  console.log(`Encrypted notebook images: ${allowedAssetUrls.size} files`);
} catch (error) {
  await Promise.all([...generatedFiles].map((file) => rm(file, { force: true })));
  throw error;
}
