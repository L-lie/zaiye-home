import { readFile } from "node:fs/promises";
import { webcrypto } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const { subtle } = webcrypto;
const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(projectDir, ".private", "blender-notes.json");
const keyPath = resolve(projectDir, ".private", "blender-notes.key");
const encryptedPath = resolve(projectDir, "assets", "content", "blender-notes.enc.json");
const publicPath = resolve(projectDir, "assets", "content", "notes-public.json");
const allowedBlockTypes = new Set(["paragraph", "ordered-list", "unordered-list", "tip", "shortcuts", "table"]);

function base64ToBytes(value) {
  return Uint8Array.from(Buffer.from(value, "base64"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const sourceText = await readFile(sourcePath, "utf8");
const source = JSON.parse(sourceText);
assert(Array.isArray(source.categories), "categories must be an array");
assert(source.id && source.title, "notebook needs id and title");
assert(typeof source.publicVisible === "boolean", "publicVisible must be a boolean");

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

const payload = JSON.parse(await readFile(encryptedPath, "utf8"));
const secret = (await readFile(keyPath, "utf8")).trim();
const passwordKey = await subtle.importKey("raw", new TextEncoder().encode(secret), "PBKDF2", false, ["deriveKey"]);
const decryptionKey = await subtle.deriveKey(
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
const plaintext = await subtle.decrypt(
  { name: "AES-GCM", iv: base64ToBytes(payload.iv) },
  decryptionKey,
  base64ToBytes(payload.ciphertext),
);
const decrypted = JSON.parse(new TextDecoder().decode(plaintext));
assert(JSON.stringify(decrypted) === JSON.stringify(source), "encrypted website data is not up to date with the private source");

const publicManifest = JSON.parse(await readFile(publicPath, "utf8"));
assert(Array.isArray(publicManifest.notebooks), "public notebook manifest must contain a notebooks array");
const expectedPublicCount = source.publicVisible ? 1 : 0;
assert(publicManifest.notebooks.length === expectedPublicCount, "public notebook manifest is not up to date");
if (source.publicVisible) {
  const [publicNotebook] = publicManifest.notebooks;
  assert(publicNotebook.id === source.id, "public notebook id is not up to date");
  assert(publicNotebook.title === source.title, "public notebook title is not up to date");
  assert(publicNotebook.categoryCount === source.categories.length, "public category count is not up to date");
  assert(!("categories" in publicNotebook), "private categories must not appear in the public manifest");
}

console.log(
  `Blender notes are valid: ${source.categories.length} categories, ${sectionCount} sections, ${expectedPublicCount} public notebook.`,
);
