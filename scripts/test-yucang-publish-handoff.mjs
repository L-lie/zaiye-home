import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  HandoffError,
  sha256Hex,
  stableStringify,
  validateHandoffBody,
} from "../supabase/functions/_shared/yucang-publish-handoff.ts";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const uuid = (suffix) => `123e4567-e89b-42d3-a456-4266141740${suffix}`;
const baseContent = {
  title: "电影感场景",
  summary: "",
  contentType: "image",
  prompt: "A cinematic {{subject}}",
  negativePrompt: "blur",
  variables: [{ name: "subject", defaultValue: "city", description: "主体" }],
  model: { name: "Midjourney", version: "v7" },
  parameters: { aspect_ratio: "16:9" },
  dependencies: [],
  tags: ["电影感"],
  licenseCode: "personal",
  instructions: "替换变量后使用",
  images: [],
};

async function body(overrides = {}, contentOverrides = {}) {
  const content = { ...baseContent, ...contentOverrides };
  return {
    protocolVersion: 1,
    requestId: uuid("01"),
    handoffId: uuid("02"),
    publicationMode: "free_public",
    targetWorkId: null,
    payloadHash: await sha256Hex(stableStringify(content)),
    content,
    ...overrides,
  };
}

const valid = await validateHandoffBody(await body());
assert.equal(valid.content.summary, "", "legacy entries may open a draft with an empty summary");
assert.equal(valid.content.images.length, 0);

for (const [mode, code] of [["private", "private_stays_in_vault"], ["paid", "paid_not_available"]]) {
  const input = await body({ publicationMode: mode });
  await assert.rejects(() => validateHandoffBody(input), (error) => error instanceof HandoffError && error.code === code);
}
const mediaInput = await body({}, { images: ["data:image/png;base64,iVBORw0KGgo="] });
const media = await validateHandoffBody(mediaInput);
assert.equal(media.media.length, 1);
assert.equal(media.media[0].mimeType, "image/png");
assert.equal(media.content.images.length, 0, "binary images must not be stored inside the version snapshot");
const fakeMediaInput = await body({}, { images: ["data:image/png;base64,YWJj"] });
await assert.rejects(
  () => validateHandoffBody(fakeMediaInput),
  (error) => error instanceof HandoffError && error.code === "invalid_media",
);
const remoteMediaInput = await body({}, { images: ["https://example.com/image.png"] });
await assert.rejects(
  () => validateHandoffBody(remoteMediaInput),
  (error) => error instanceof HandoffError && error.code === "media_must_be_embedded",
);
const wrongHashInput = await body({ payloadHash: "0".repeat(64) });
await assert.rejects(
  () => validateHandoffBody(wrongHashInput),
  (error) => error instanceof HandoffError && error.code === "payload_hash_mismatch",
);
const unknown = await body();
unknown.content.privateLibraryId = "must-not-pass";
unknown.payloadHash = await sha256Hex(stableStringify(unknown.content));
await assert.rejects(
  () => validateHandoffBody(unknown),
  (error) => error instanceof HandoffError && error.code === "invalid_payload",
);
for (const parameters of [{ apiKey: "secret" }, { nested: "ok", refresh_token: "secret" }]) {
  const sensitive = await body({}, { parameters });
  await assert.rejects(
    () => validateHandoffBody(sensitive),
    (error) => error instanceof HandoffError && error.code === "sensitive_field_not_allowed",
  );
}
for (const url of ["data:text/plain,secret", "file:///tmp/model", "http://localhost/model", "http://127.0.0.1/model", "C:\\models\\local.safetensors", "/tmp/local.safetensors"]) {
  const unsafe = await body({}, { dependencies: [{ name: "model", kind: "model", version: "", url, notes: "" }] });
  await assert.rejects(
    () => validateHandoffBody(unsafe),
    (error) => error instanceof HandoffError && error.code === "unsafe_location",
  );
}
const promptMayMentionSecurityTerms = await body({}, { prompt: "教程示例可以写 token、password、file: 或 localhost，但这些只是 Prompt 正文。" });
await validateHandoffBody(promptMayMentionSecurityTerms);

const sent = [];
globalThis.chrome = {
  runtime: {
    lastError: null,
    sendMessage(extensionId, message, callback) {
      sent.push({ extensionId, message });
      if (message.action === "claim") callback({
        ok: true,
        requestId: message.requestId,
        handoffId: message.handoffId,
        payloadHash: "a".repeat(64),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        content: baseContent,
      });
      else callback({ ok: true, requestId: message.requestId, handoffId: message.handoffId });
    },
  },
};
const bridgeModule = await import(`${pathToFileURL(path.join(root, "yucang/prompt-vault-publish-bridge.mjs"))}?test=${Date.now()}`);
const bridge = bridgeModule.createPromptVaultPublishBridge();
const textOnlyContent = { ...baseContent, images: [] };
assert.equal(await bridgeModule.hashHandoffContent(textOnlyContent), await sha256Hex(stableStringify(textOnlyContent)));
const claim = await bridge.claim(uuid("03"));
assert.equal(claim.content.prompt, baseContent.prompt);
assert.equal(sent[0].message.action, "claim");
await bridge.complete(claim, { workId: uuid("04"), versionId: uuid("05"), status: "created" });
assert.equal(sent[1].message.action, "complete");
assert.equal(sent[1].message.requestId, sent[0].message.requestId);
await bridge.discard(claim);
assert.equal(sent[2].message.action, "discard");

const migration = read("supabase/migrations/20260826000100_yucang_publish_handoff.sql")
  + read("supabase/migrations/20260826000200_yucang_handoff_rate_guard.sql")
  + read("supabase/migrations/20260826000600_yucang_publication_media.sql");
for (const required of [
  "private.yucang_handoff_receipts",
  "unique (author_id, handoff_id)",
  "yucang_create_draft_from_handoff",
  "pg_advisory_xact_lock",
  "raise exception 'rate_limited'",
  "yucang-handoff-rate:",
  "origin_kind)",
  "'vault_handoff'",
  "revoke all on private.yucang_handoff_receipts from public, anon, authenticated",
  "negative_prompt_text",
  "dependencies",
  "instructions",
  "yucang-publication-media",
  "yucang_version_media",
  "yucang_can_access_version_media",
]) assert.ok(migration.includes(required), `migration missing ${required}`);
assert.ok(migration.indexOf("return query select 'already_created'") < migration.indexOf("raise exception 'rate_limited'"), "idempotent replay must be checked before rate limiting");
assert.ok(!migration.includes("private_notebooks"), "handoff must not touch the private sync domain");

const edge = read("supabase/functions/yucang-create-handoff-draft/index.ts");
assert.ok(edge.includes('origin !== YUCANG_WEB_ORIGIN'));
assert.ok(edge.includes('client.auth.getUser(token)'));
assert.ok(edge.includes('known === "rate_limited" ? 429'));
assert.ok(edge.includes("client.auth.getUser(token)"), "the user must be authenticated before privileged media storage is used");
assert.ok(edge.includes("SUPABASE_SERVICE_ROLE_KEY"), "private publication media must be stored by the controlled server boundary");
assert.ok(!edge.includes("prompt: row"), "server response must not echo Prompt content");
const mediaEdge = read("supabase/functions/yucang-version-media/index.ts");
assert.ok(mediaEdge.includes("yucang_can_access_version_media"));
assert.ok(mediaEdge.includes("createSignedUrls"));
assert.ok(mediaEdge.includes('request.headers.get("origin") !== WEB_ORIGIN'));

const app = read("yucang/app.js");
assert.ok(app.includes('id === "handoff" && childId'));
assert.ok(app.includes("promptVaultPublishBridge.claim(handoffId)"));
assert.ok(app.includes("promptVaultPublishBridge.complete(claim, result)"));
assert.ok(app.includes("promptVaultPublishBridge.discard(claim)"));
assert.ok(app.includes("VERSION_MEDIA_ENDPOINT"));
assert.ok(app.includes("loadVersionMedia"));
assert.ok(app.includes("图片会与这一个发布草稿一起安全上传"));
assert.ok(!app.includes("data-exclude-handoff-images"), "media handoffs must not force a text-only downgrade");
assert.ok(app.includes("createHandoffDraft(claim, content, claim.payloadHash)"), "the selected images must remain in the handoff request");

console.log("Yucang publish handoff tests passed.");
