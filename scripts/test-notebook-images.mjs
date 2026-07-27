import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { relative, resolve } from "node:path";
import {
  cleanOrphanedAssets,
  compileNotebookAssets,
  DEFAULT_IMAGE_LIMITS,
  findOrphanedAssets,
  loadSharp,
  validateCompiledAssets,
} from "./notebook-assets.mjs";
import {
  decryptAssetBytes,
  deriveKey,
  validateNotebook,
} from "./notebook-crypto.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function expectFailure(label, action, messagePart) {
  try {
    await action();
  } catch (error) {
    if (messagePart) {
      assert(String(error.message).includes(messagePart), `${label} returned the wrong error: ${error.message}`);
    }
    return;
  }
  throw new Error(`${label} should fail`);
}

function makeSource(assets) {
  return {
    version: 2,
    id: "mingri-park-heat-world",
    title: "测试私人笔记",
    publicVisible: false,
    assets,
    categories: [
      {
        id: "test-category",
        title: "测试分类",
        sections: [
          {
            id: "test-section",
            title: "测试图片",
            blocks: [
              {
                type: "image",
                assetId: "shot-001",
                alt: "原始镜头测试图",
                caption: "单图说明",
                role: "shot",
                sourceLabel: "TEST_SHOT_001",
              },
              {
                type: "gallery",
                layout: "before-after",
                items: [
                  {
                    assetId: "shot-001",
                    alt: "修改前",
                    role: "shot",
                  },
                  {
                    assetId: "final-001",
                    alt: "修改后",
                    role: "final",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

const root = await mkdtemp(resolve(tmpdir(), "zaiye-notebook-images-"));
const privateDir = resolve(root, ".private");
const assetDir = resolve(privateDir, "mingri-assets");
const contentDir = resolve(root, "assets", "content");
const config = {
  id: "mingri-park-heat-world",
  assetDir: "mingri-assets",
};
const secret = "fixture-owner-secret";
const sharp = loadSharp();

try {
  await mkdir(assetDir, { recursive: true });
  await mkdir(contentDir, { recursive: true });
  await sharp({
    create: {
      width: 1200,
      height: 675,
      channels: 3,
      background: { r: 24, g: 36, b: 52 },
    },
  }).png().toFile(resolve(assetDir, "shot-001.png"));
  await sharp({
    create: {
      width: 900,
      height: 1200,
      channels: 3,
      background: { r: 146, g: 102, b: 54 },
    },
  }).jpeg({ quality: 90 }).toFile(resolve(assetDir, "final-001.jpg"));

  const source = makeSource([
    { assetId: "shot-001", source: "shot-001.png" },
    { assetId: "final-001", source: "final-001.jpg" },
  ]);
  validateNotebook(source, config.id);

  const compiledResult = await compileNotebookAssets({
    source,
    config,
    privateDir,
    contentDir,
    secret,
  });
  const compiled = compiledResult.notebook;
  const compiledText = JSON.stringify(compiled);
  assert(!compiledText.includes("shot-001.png"), "compiled notebook leaks a private filename");
  assert(!compiledText.includes("final-001.jpg"), "compiled notebook leaks a private filename");
  assert(!compiledText.includes(privateDir), "compiled notebook leaks a private absolute path");
  assert(Object.keys(compiled.assetBundle.assets).length === 2, "compiled asset bundle is incomplete");

  const urls = await validateCompiledAssets({
    source,
    compiled,
    config,
    privateDir,
    contentDir,
    secret,
  });
  assert(urls.size === 4, "thumbnail and display variants were not generated");
  for (const variants of Object.values(compiled.assetBundle.assets)) {
    assert(
      variants.thumbnail.width <= DEFAULT_IMAGE_LIMITS.thumbnailEdge &&
        variants.thumbnail.height <= DEFAULT_IMAGE_LIMITS.thumbnailEdge,
      "thumbnail dimensions are not controlled",
    );
    assert(
      variants.display.width <= DEFAULT_IMAGE_LIMITS.displayEdge &&
        variants.display.height <= DEFAULT_IMAGE_LIMITS.displayEdge,
      "display dimensions are not controlled",
    );
  }

  const firstVariant = compiled.assetBundle.assets["shot-001"].thumbnail;
  const firstPath = resolve(contentDir, relative("assets/content", firstVariant.url));
  const encryptedBytes = await readFile(firstPath);
  assert(!encryptedBytes.includes(Buffer.from("shot-001")), "encrypted bytes leak assetId");
  const wrongKey = await deriveKey(
    "wrong-secret",
    Buffer.from(compiled.assetBundle.salt, "base64"),
    ["decrypt"],
  );
  await expectFailure(
    "wrong-key decryption",
    () => decryptAssetBytes(encryptedBytes, wrongKey),
  );

  const orphanPath = resolve(contentDir, "secure-media", "00000000000000000000000000000000.bin");
  const unrelatedPath = resolve(contentDir, "secure-media", "keep-me.txt");
  await writeFile(orphanPath, "orphan fixture");
  await writeFile(unrelatedPath, "unrelated fixture");
  const orphaned = await findOrphanedAssets(contentDir, urls);
  assert(orphaned.length === 1 && orphaned[0] === orphanPath, "orphan detection is not safely scoped");
  await cleanOrphanedAssets(contentDir, urls);
  assert((await findOrphanedAssets(contentDir, urls)).length === 0, "orphan cleanup failed");
  assert((await readFile(unrelatedPath, "utf8")) === "unrelated fixture", "cleanup removed an unrelated file");

  const duplicateSource = makeSource([
    { assetId: "shot-001", source: "shot-001.png" },
    { assetId: "shot-001", source: "final-001.jpg" },
  ]);
  await expectFailure(
    "duplicate assetId",
    () => Promise.resolve(validateNotebook(duplicateSource, config.id)),
    "duplicate assetId",
  );

  const unsafeIdSource = makeSource([
    { assetId: "__proto__", source: "shot-001.png" },
    { assetId: "final-001", source: "final-001.jpg" },
  ]);
  await expectFailure(
    "unsafe assetId",
    () => Promise.resolve(validateNotebook(unsafeIdSource, config.id)),
    "invalid assetId",
  );

  const missingReference = makeSource([
    { assetId: "shot-001", source: "shot-001.png" },
  ]);
  await expectFailure(
    "missing referenced asset",
    () => Promise.resolve(validateNotebook(missingReference, config.id)),
    "missing image asset",
  );

  const missingFile = makeSource([
    { assetId: "shot-001", source: "missing.png" },
    { assetId: "final-001", source: "final-001.jpg" },
  ]);
  validateNotebook(missingFile, config.id);
  await expectFailure(
    "missing image file",
    () => compileNotebookAssets({ source: missingFile, config, privateDir, contentDir, secret }),
    "missing image asset",
  );

  await writeFile(resolve(privateDir, "outside.png"), await readFile(resolve(assetDir, "shot-001.png")));
  const traversalSource = makeSource([
    { assetId: "shot-001", source: "../outside.png" },
    { assetId: "final-001", source: "final-001.jpg" },
  ]);
  validateNotebook(traversalSource, config.id);
  await expectFailure(
    "path traversal",
    () => compileNotebookAssets({ source: traversalSource, config, privateDir, contentDir, secret }),
    "escapes the private image directory",
  );

  await writeFile(resolve(assetDir, "bad.png"), "not an image");
  const illegalMimeSource = makeSource([
    { assetId: "shot-001", source: "bad.png" },
    { assetId: "final-001", source: "final-001.jpg" },
  ]);
  validateNotebook(illegalMimeSource, config.id);
  await expectFailure(
    "illegal MIME",
    () => compileNotebookAssets({ source: illegalMimeSource, config, privateDir, contentDir, secret }),
  );

  await writeFile(resolve(assetDir, "mismatch.jpg"), await readFile(resolve(assetDir, "shot-001.png")));
  const mismatchSource = makeSource([
    { assetId: "shot-001", source: "mismatch.jpg" },
    { assetId: "final-001", source: "final-001.jpg" },
  ]);
  validateNotebook(mismatchSource, config.id);
  await expectFailure(
    "MIME mismatch",
    () => compileNotebookAssets({ source: mismatchSource, config, privateDir, contentDir, secret }),
    "does not match",
  );

  await expectFailure(
    "oversized image",
    () => compileNotebookAssets({
      source,
      config,
      privateDir,
      contentDir,
      secret,
      limits: { ...DEFAULT_IMAGE_LIMITS, maxBytes: 32 },
    }),
    "too large",
  );

  console.log("Notebook image tests passed: schema, encryption, variants, cleanup, missing files, duplicate/unsafe IDs, traversal, MIME, size, and wrong-key failure.");
} finally {
  await rm(root, { recursive: true, force: true });
}
