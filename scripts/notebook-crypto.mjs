import { randomBytes, webcrypto } from "node:crypto";

const { subtle } = webcrypto;
export const iterations = 250000;
export const allowedImageRoles = new Set([
  "shot",
  "revision",
  "final",
  "reference",
  "comparison",
]);
export const allowedGalleryLayouts = new Set([
  "grid",
  "comparison",
  "before-after",
]);
export const allowedBlockTypes = new Set([
  "paragraph",
  "ordered-list",
  "unordered-list",
  "tip",
  "shortcuts",
  "table",
  "image",
  "gallery",
]);

export function bytesToBase64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

export function base64ToBytes(value) {
  return Uint8Array.from(Buffer.from(value, "base64"));
}

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertOptionalText(value, field, context) {
  assert(value === undefined || typeof value === "string", `${field} must be text: ${context}`);
}

function validateImageReference(item, context, assetIds) {
  assert(item && typeof item === "object" && !Array.isArray(item), `image item must be an object: ${context}`);
  assert(typeof item.assetId === "string" && item.assetId.trim(), `assetId is required: ${context}`);
  assert(assetIds.has(item.assetId), `missing image asset: ${item.assetId}`);
  assert(typeof item.alt === "string" && item.alt.trim(), `alt is required: ${item.assetId}`);
  assert(allowedImageRoles.has(item.role), `unsupported image role: ${item.role}`);
  assertOptionalText(item.caption, "caption", item.assetId);
  assertOptionalText(item.sourceLabel, "sourceLabel", item.assetId);
  assertOptionalText(item.credit, "credit", item.assetId);
}

function validateBlock(block, context, assetIds) {
  assert(block && typeof block === "object" && !Array.isArray(block), `block must be an object: ${context}`);
  assert(allowedBlockTypes.has(block.type), `unsupported block type: ${block.type}`);

  if (block.type === "image") {
    validateImageReference(block, context, assetIds);
  }

  if (block.type === "gallery") {
    assert(allowedGalleryLayouts.has(block.layout), `unsupported gallery layout: ${block.layout}`);
    assert(Array.isArray(block.items) && block.items.length > 0, `gallery needs items: ${context}`);
    if (block.layout === "before-after") {
      assert(block.items.length === 2, `before-after gallery needs exactly 2 items: ${context}`);
    }
    if (block.layout === "comparison") {
      assert(block.items.length >= 2, `comparison gallery needs at least 2 items: ${context}`);
    }
    block.items.forEach((item, index) => validateImageReference(item, `${context} item ${index + 1}`, assetIds));
  }
}

export function validateNotebook(source, expectedId) {
  assert(source?.id === expectedId, `notebook id must be ${expectedId}`);
  assert(source.title, "notebook needs a title");
  assert(
    source.publicVisible === undefined || typeof source.publicVisible === "boolean",
    "publicVisible must be a boolean",
  );
  assert(Array.isArray(source.categories), "categories must be an array");

  const ids = new Set();
  const assetIds = new Set();
  const assets = source.assets || [];
  assert(Array.isArray(assets), "assets must be an array");
  for (const asset of assets) {
    assert(asset && typeof asset === "object" && !Array.isArray(asset), "every asset must be an object");
    assert(typeof asset.assetId === "string" && asset.assetId.trim(), "every asset needs assetId");
    assert(/^[a-z0-9][a-z0-9._-]*$/.test(asset.assetId), `invalid assetId: ${asset.assetId}`);
    assert(!assetIds.has(asset.assetId), `duplicate assetId: ${asset.assetId}`);
    assetIds.add(asset.assetId);
    assert(typeof asset.source === "string" && asset.source.trim(), `asset source is required: ${asset.assetId}`);
  }

  let sectionCount = 0;
  for (const category of source.categories) {
    assert(category.id && category.title, "every category needs id and title");
    assert(!ids.has(category.id), `duplicate id: ${category.id}`);
    ids.add(category.id);
    assert(Array.isArray(category.sections), `sections must be an array: ${category.id}`);
    for (const section of category.sections) {
      sectionCount += 1;
      assert(section.id && section.title, `every section needs id and title: ${category.id}`);
      assert(!ids.has(section.id), `duplicate id: ${section.id}`);
      ids.add(section.id);
      assert(Array.isArray(section.blocks), `blocks must be an array: ${section.id}`);
      for (const block of section.blocks) {
        validateBlock(block, section.id, assetIds);
      }
    }
  }
  return sectionCount;
}

export async function deriveKey(secret, salt, usages) {
  const passwordKey = await subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false,
    Array.isArray(usages) ? usages : [usages],
  );
}

export async function encryptText(text, secret) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveKey(secret, salt, "encrypt");
  const ciphertext = await subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(text),
  );
  return {
    version: 1,
    algorithm: "AES-GCM",
    kdf: "PBKDF2-SHA-256",
    iterations,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptPayload(payload, secret) {
  const salt = base64ToBytes(payload.salt);
  const iv = base64ToBytes(payload.iv);
  const key = await deriveKey(secret, salt, "decrypt");
  const plaintext = await subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    base64ToBytes(payload.ciphertext),
  );
  return new TextDecoder().decode(plaintext);
}

const assetMagic = Buffer.from("ZNB1", "ascii");

export async function encryptAssetBytes(bytes, key) {
  const iv = randomBytes(12);
  const ciphertext = await subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    bytes,
  );
  return Buffer.concat([
    assetMagic,
    Buffer.from(iv),
    Buffer.from(ciphertext),
  ]);
}

export async function decryptAssetBytes(payload, key) {
  const bytes = Buffer.from(payload);
  assert(bytes.length > 32, "encrypted image asset is too short");
  assert(bytes.subarray(0, assetMagic.length).equals(assetMagic), "encrypted image asset has an invalid header");
  const iv = bytes.subarray(assetMagic.length, assetMagic.length + 12);
  const ciphertext = bytes.subarray(assetMagic.length + 12);
  const plaintext = await subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );
  return Buffer.from(plaintext);
}
