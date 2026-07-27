import { randomBytes, randomUUID } from "node:crypto";
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import {
  basename,
  extname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import {
  assert,
  bytesToBase64,
  decryptAssetBytes,
  deriveKey,
  encryptAssetBytes,
  iterations,
} from "./notebook-crypto.mjs";

export const SECURE_MEDIA_DIR = "secure-media";
export const DEFAULT_IMAGE_LIMITS = Object.freeze({
  maxBytes: 40 * 1024 * 1024,
  maxPixels: 80_000_000,
  maxDimension: 20_000,
  thumbnailEdge: 640,
  displayEdge: 2400,
});

const formatInfo = {
  jpeg: { mime: "image/jpeg", extensions: new Set([".jpg", ".jpeg"]) },
  png: { mime: "image/png", extensions: new Set([".png"]) },
  webp: { mime: "image/webp", extensions: new Set([".webp"]) },
};

let sharpInstance;

export function loadSharp() {
  if (sharpInstance) return sharpInstance;
  try {
    const require = createRequire(import.meta.url);
    sharpInstance = require("sharp");
    return sharpInstance;
  } catch {
    const runtimeModules = resolve(
      homedir(),
      ".cache",
      "codex-runtimes",
      "codex-primary-runtime",
      "dependencies",
      "node",
      "node_modules",
    );
    const runtimeRequire = createRequire(pathToFileURL(resolve(runtimeModules, "_notebook_loader.cjs")));
    sharpInstance = runtimeRequire("sharp");
    return sharpInstance;
  }
}

function isInside(root, candidate) {
  const offset = relative(root, candidate);
  return offset === "" || (!offset.startsWith(`..${sep}`) && offset !== ".." && !isAbsolute(offset));
}

export async function resolvePrivateAsset(root, source, assetId) {
  assert(typeof source === "string" && source.trim(), `asset source is required: ${assetId}`);
  assert(!source.includes("\0"), `asset source contains invalid characters: ${assetId}`);
  assert(!isAbsolute(source), `absolute asset paths are not allowed: ${assetId}`);

  const realRoot = await realpath(root);
  const candidate = resolve(realRoot, source);
  assert(isInside(realRoot, candidate), `asset path escapes the private image directory: ${assetId}`);

  let entry;
  try {
    entry = await lstat(candidate);
  } catch (error) {
    if (error.code === "ENOENT") throw new Error(`missing image asset: ${assetId}`);
    throw error;
  }
  assert(entry.isFile(), `asset must be a file: ${assetId}`);
  assert(!entry.isSymbolicLink(), `symbolic-link assets are not allowed: ${assetId}`);

  const resolvedFile = await realpath(candidate);
  assert(isInside(realRoot, resolvedFile), `asset path escapes the private image directory: ${assetId}`);
  return resolvedFile;
}

function validateImageMetadata(metadata, source, assetId, limits) {
  const info = formatInfo[metadata.format];
  assert(info, `unsupported image MIME type: ${assetId}`);
  assert(info.extensions.has(extname(source).toLowerCase()), `image extension does not match its MIME type: ${assetId}`);
  assert(metadata.width > 0 && metadata.height > 0, `image dimensions are invalid: ${assetId}`);
  assert(metadata.width <= limits.maxDimension && metadata.height <= limits.maxDimension, `image dimensions are too large: ${assetId}`);
  assert(metadata.width * metadata.height <= limits.maxPixels, `image pixel count is too large: ${assetId}`);
  return info;
}

async function makeVariant(sharp, source, edge, quality) {
  const result = await sharp(source, { failOn: "error", limitInputPixels: false })
    .rotate()
    .resize({
      width: edge,
      height: edge,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality, effort: 4 })
    .toBuffer({ resolveWithObject: true });
  return {
    bytes: result.data,
    width: result.info.width,
    height: result.info.height,
    mime: "image/webp",
  };
}

function randomAssetName() {
  return `${randomUUID().replaceAll("-", "")}.bin`;
}

function publicAssetUrl(name) {
  return `assets/content/${SECURE_MEDIA_DIR}/${name}`;
}

async function writeEncryptedVariant(variant, assetKey, outputDir, createdFiles) {
  const name = randomAssetName();
  const outputPath = resolve(outputDir, name);
  await writeFile(outputPath, await encryptAssetBytes(variant.bytes, assetKey));
  createdFiles.add(outputPath);
  return {
    url: publicAssetUrl(name),
    mime: variant.mime,
    width: variant.width,
    height: variant.height,
  };
}

export async function compileNotebookAssets({
  source,
  config,
  privateDir,
  contentDir,
  secret,
  limits = DEFAULT_IMAGE_LIMITS,
}) {
  const definitions = source.assets || [];
  if (!definitions.length) {
    const notebook = structuredClone(source);
    delete notebook.assets;
    notebook.publicVisible = source.publicVisible === true;
    return {
      notebook,
      generatedFiles: new Set(),
    };
  }

  assert(config.assetDir, `notebook asset directory is not configured: ${config.id}`);
  const privateAssetRoot = resolve(privateDir, config.assetDir);
  const outputDir = resolve(contentDir, SECURE_MEDIA_DIR);
  await mkdir(outputDir, { recursive: true });

  const sharp = loadSharp();
  const bundleSalt = randomBytes(16);
  const assetKey = await deriveKey(secret, bundleSalt, ["encrypt", "decrypt"]);
  const generatedFiles = new Set();
  const compiledAssets = {};

  try {
    for (const definition of definitions) {
      const sourcePath = await resolvePrivateAsset(privateAssetRoot, definition.source, definition.assetId);
      const fileInfo = await stat(sourcePath);
      assert(fileInfo.size <= limits.maxBytes, `image file is too large: ${definition.assetId}`);
      const metadata = await sharp(sourcePath, { failOn: "error", limitInputPixels: false }).metadata();
      validateImageMetadata(metadata, definition.source, definition.assetId, limits);

      const thumbnail = await makeVariant(sharp, sourcePath, limits.thumbnailEdge, 82);
      const display = await makeVariant(sharp, sourcePath, limits.displayEdge, 88);
      compiledAssets[definition.assetId] = {
        thumbnail: await writeEncryptedVariant(thumbnail, assetKey, outputDir, generatedFiles),
        display: await writeEncryptedVariant(display, assetKey, outputDir, generatedFiles),
      };
    }
  } catch (error) {
    await Promise.all([...generatedFiles].map((path) => rm(path, { force: true })));
    throw error;
  }

  const notebook = structuredClone(source);
  delete notebook.assets;
  notebook.publicVisible = source.publicVisible === true;
  notebook.assetBundle = {
    version: 1,
    algorithm: "AES-GCM",
    kdf: "PBKDF2-SHA-256",
    iterations,
    salt: bytesToBase64(bundleSalt),
    assets: compiledAssets,
  };
  return { notebook, generatedFiles };
}

export function collectAssetUrls(notebook) {
  const urls = new Set();
  const assets = notebook?.assetBundle?.assets || {};
  for (const variants of Object.values(assets)) {
    for (const variant of [variants.thumbnail, variants.display]) {
      if (typeof variant?.url === "string") urls.add(variant.url);
    }
  }
  return urls;
}

export async function cleanOrphanedAssets(contentDir, allowedUrls) {
  const orphaned = await findOrphanedAssets(contentDir, allowedUrls);
  await Promise.all(orphaned.map((path) => rm(path, { force: true })));
}

export async function findOrphanedAssets(contentDir, allowedUrls) {
  const outputDir = resolve(contentDir, SECURE_MEDIA_DIR);
  let entries;
  try {
    entries = await readdir(outputDir, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }

  const allowedNames = new Set(
    [...allowedUrls]
      .filter((url) => url.startsWith(`assets/content/${SECURE_MEDIA_DIR}/`))
      .map((url) => basename(url)),
  );
  const orphaned = [];
  for (const entry of entries) {
    if (!entry.isFile() || !/^[a-f0-9]{32}\.bin$/.test(entry.name)) continue;
    if (!allowedNames.has(entry.name)) {
      orphaned.push(resolve(outputDir, entry.name));
    }
  }
  return orphaned;
}

export async function validateCompiledAssets({
  source,
  compiled,
  config,
  privateDir,
  contentDir,
  secret,
  limits = DEFAULT_IMAGE_LIMITS,
}) {
  const definitions = source.assets || [];
  if (!definitions.length) {
    assert(!compiled.assetBundle, `unexpected encrypted image bundle: ${config.id}`);
    return new Set();
  }

  const bundle = compiled.assetBundle;
  assert(bundle?.version === 1, `missing encrypted image bundle: ${config.id}`);
  assert(bundle.iterations === iterations, `unexpected image KDF iterations: ${config.id}`);
  const expectedIds = new Set(definitions.map((asset) => asset.assetId));
  const compiledIds = Object.keys(bundle.assets || {});
  assert(compiledIds.length === expectedIds.size, `encrypted image bundle is incomplete: ${config.id}`);
  compiledIds.forEach((assetId) => assert(expectedIds.has(assetId), `unexpected encrypted assetId: ${assetId}`));

  const key = await deriveKey(secret, Buffer.from(bundle.salt, "base64"), ["decrypt"]);
  const sharp = loadSharp();
  const urls = new Set();
  for (const assetId of expectedIds) {
    const variants = bundle.assets[assetId];
    for (const [variantName, variant] of Object.entries({
      thumbnail: variants?.thumbnail,
      display: variants?.display,
    })) {
      assert(variant?.mime === "image/webp", `invalid generated MIME type: ${assetId}`);
      assert(
        typeof variant.url === "string" &&
          variant.url.startsWith(`assets/content/${SECURE_MEDIA_DIR}/`) &&
          /^[a-f0-9]{32}\.bin$/.test(basename(variant.url)),
        `invalid encrypted image URL: ${assetId}`,
      );
      const path = resolve(contentDir, relative("assets/content", variant.url));
      assert(isInside(resolve(contentDir, SECURE_MEDIA_DIR), path), `encrypted image URL escapes output directory: ${assetId}`);
      const encrypted = await readFile(path);
      const plaintext = await decryptAssetBytes(encrypted, key);
      const metadata = await sharp(plaintext, { failOn: "error", limitInputPixels: false }).metadata();
      assert(metadata.format === "webp", `generated image is not WebP: ${assetId}`);
      assert(metadata.width === variant.width && metadata.height === variant.height, `generated dimensions are stale: ${assetId}`);
      const maxEdge = variantName === "thumbnail" ? limits.thumbnailEdge : limits.displayEdge;
      assert(metadata.width <= maxEdge && metadata.height <= maxEdge, `generated image is too large: ${assetId}`);
      urls.add(variant.url);
    }
  }
  return urls;
}

export function comparableNotebook(source) {
  const copy = structuredClone(source);
  delete copy.assets;
  delete copy.assetBundle;
  copy.publicVisible = source.publicVisible === true;
  return copy;
}
