import { randomBytes, webcrypto } from "node:crypto";

const { subtle } = webcrypto;
export const iterations = 250000;
export const allowedBlockTypes = new Set([
  "paragraph",
  "ordered-list",
  "unordered-list",
  "tip",
  "shortcuts",
  "table",
]);

function bytesToBase64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

export function base64ToBytes(value) {
  return Uint8Array.from(Buffer.from(value, "base64"));
}

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function validateNotebook(source, expectedId) {
  assert(source?.id === expectedId, `notebook id must be ${expectedId}`);
  assert(source.title, "notebook needs a title");
  assert(typeof source.publicVisible === "boolean", "publicVisible must be a boolean");
  assert(Array.isArray(source.categories), "categories must be an array");

  const ids = new Set();
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
        assert(allowedBlockTypes.has(block.type), `unsupported block type: ${block.type}`);
      }
    }
  }
  return sectionCount;
}

async function deriveKey(secret, salt, usage) {
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
    [usage],
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
