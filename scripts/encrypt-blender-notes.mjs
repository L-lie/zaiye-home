import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomBytes, webcrypto } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const { subtle } = webcrypto;
const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(scriptDir, "..");
const privateDir = resolve(projectDir, ".private");
const sourcePath = resolve(privateDir, "blender-notes.json");
const keyPath = resolve(privateDir, "blender-notes.key");
const outputPath = resolve(projectDir, "assets", "content", "blender-notes.enc.json");
const publicOutputPath = resolve(projectDir, "assets", "content", "notes-public.json");
const iterations = 250000;

function bytesToBase64(bytes) {
  return Buffer.from(bytes).toString("base64");
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

const source = await readFile(sourcePath, "utf8");
const notebook = JSON.parse(source);

const secret = await loadOrCreateSecret();
const salt = randomBytes(16);
const iv = randomBytes(12);
const passwordKey = await subtle.importKey(
  "raw",
  new TextEncoder().encode(secret),
  "PBKDF2",
  false,
  ["deriveKey"],
);
const encryptionKey = await subtle.deriveKey(
  { name: "PBKDF2", hash: "SHA-256", salt, iterations },
  passwordKey,
  { name: "AES-GCM", length: 256 },
  false,
  ["encrypt"],
);
const ciphertext = await subtle.encrypt(
  { name: "AES-GCM", iv },
  encryptionKey,
  new TextEncoder().encode(source),
);

const payload = {
  version: 1,
  algorithm: "AES-GCM",
  kdf: "PBKDF2-SHA-256",
  iterations,
  salt: bytesToBase64(salt),
  iv: bytesToBase64(iv),
  ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(payload)}\n`, "utf8");

const publicManifest = {
  version: 1,
  notebooks: notebook.publicVisible
    ? [
        {
          id: notebook.id,
          title: notebook.title,
          summary: notebook.summary,
          categoryCount: notebook.categories.length,
          href: "blender-notes.html",
        },
      ]
    : [],
};
await writeFile(publicOutputPath, `${JSON.stringify(publicManifest, null, 2)}\n`, "utf8");

console.log(`Encrypted notes updated: ${outputPath}`);
console.log(`Public notebook manifest updated: ${publicOutputPath}`);
console.log(`Private unlock key: ${keyPath}`);
