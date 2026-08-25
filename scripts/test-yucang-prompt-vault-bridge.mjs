import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createPromptVaultBridge } from "../yucang/prompt-vault-bridge.mjs";

function fakeRuntime({ installed = true, saveStatus = "created", saveError = "" } = {}) {
  const calls = [];
  return {
    calls,
    lastError: null,
    sendMessage(extensionId, message, callback) {
      calls.push({ extensionId, message });
      if (message.action === "ping") {
        callback(installed ? {
          ok: true,
          installed: true,
          protocolVersion: 1,
          extensionVersion: "1.2.38",
          capabilities: ["save-public-prompt"],
        } : null);
        return;
      }
      callback(saveError
        ? { ok: false, error: saveError, requestId: message.requestId }
        : { ok: true, status: saveStatus, itemId: "local-1", requestId: message.requestId });
    },
  };
}

const payload = {
  title: "测试 Prompt",
  prompt: "生成 @主题",
  category: "image",
  type: "task",
  tags: ["测试"],
  variables: [{ name: "主题" }],
  sourceWorkId: "official:test",
  sourceVersionId: "official-library-v2",
  sourceUrl: "https://zaiye.art/yucang/#/prompt/test",
};

const runtime = fakeRuntime();
const bridge = createPromptVaultBridge(runtime);
const detection = await bridge.detect();
assert.equal(detection.installed, true);
const created = await bridge.save(payload);
assert.equal(created.status, "created");
assert.equal(runtime.calls.filter(({ message }) => message.action === "save").length, 1);
assert.equal(runtime.calls.at(-1).message.payload.category, "image");
assert.match(runtime.calls.at(-1).message.requestId, /^yucang-/);

const duplicateRuntime = fakeRuntime({ saveStatus: "already_saved" });
const duplicate = await createPromptVaultBridge(duplicateRuntime).save(payload);
assert.equal(duplicate.status, "already_saved");

const missingRuntime = fakeRuntime({ installed: false });
const missing = await createPromptVaultBridge(missingRuntime).save(payload);
assert.deepEqual(missing, { ok: false, error: "not_installed" });
assert.equal(missingRuntime.calls.filter(({ message }) => message.action === "save").length, 0);

const failedRuntime = fakeRuntime({ saveError: "invalid_payload" });
const failed = await createPromptVaultBridge(failedRuntime).save(payload);
assert.equal(failed.ok, false);
assert.equal(failed.error, "invalid_payload");
assert.equal(failedRuntime.calls.filter(({ message }) => message.action === "save").length, 1);

const appSource = readFileSync(new URL("../yucang/app.js", import.meta.url), "utf8");
assert.match(appSource, /data-save-to-vault/);
assert.match(appSource, /https:\/\/zaiye\.art\/yucang\/#\/prompt/);
assert.doesNotMatch(appSource, /favorite\s*:/);

console.log("Yucang Prompt Vault website bridge tests passed.");
