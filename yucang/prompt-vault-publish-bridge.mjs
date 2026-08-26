const TYPE = "prompt-vault-yucang-publish";
const PROTOCOL_VERSION = 1;
const EXTENSION_IDS = Object.freeze([
  "fapladhajicfoiadhcpmbmfkodekkckg",
  "idiemjhonlahnlnalpanhplbgjcfbpnl",
]);

function requestId() {
  return crypto.randomUUID();
}

function uuid(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function stableHandoffStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableHandoffStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableHandoffStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export async function hashHandoffContent(content) {
  const bytes = new TextEncoder().encode(stableHandoffStringify(content));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function send(extensionId, message) {
  return new Promise((resolve, reject) => {
    if (!globalThis.chrome?.runtime?.sendMessage) return reject(new Error("prompt_vault_not_installed"));
    chrome.runtime.sendMessage(extensionId, message, (response) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) reject(new Error(lastError.message || "prompt_vault_unreachable"));
      else resolve(response);
    });
  });
}

export function createPromptVaultPublishBridge() {
  return {
    async claim(handoffId) {
      if (!uuid(handoffId)) throw new Error("invalid_handoff_id");
      const claimRequestId = requestId();
      let lastError = new Error("prompt_vault_not_installed");
      for (const extensionId of EXTENSION_IDS) {
        try {
          const response = await send(extensionId, {
            type: TYPE,
            protocolVersion: PROTOCOL_VERSION,
            action: "claim",
            requestId: claimRequestId,
            handoffId,
          });
          if (!response?.ok) throw new Error(response?.error || "claim_failed");
          if (response.requestId !== claimRequestId || response.handoffId !== handoffId
            || !response.content || typeof response.payloadHash !== "string") {
            throw new Error("invalid_claim_response");
          }
          return { extensionId, requestId: claimRequestId, handoffId, ...response };
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError;
    },

    async complete(claim, result) {
      const response = await send(claim.extensionId, {
        type: TYPE,
        protocolVersion: PROTOCOL_VERSION,
        action: "complete",
        requestId: claim.requestId,
        handoffId: claim.handoffId,
        workId: result.workId,
        versionId: result.versionId,
        status: result.status,
      });
      if (!response?.ok || response.requestId !== claim.requestId || response.handoffId !== claim.handoffId) {
        throw new Error(response?.error || "complete_failed");
      }
      return response;
    },

    async discard(claim) {
      const response = await send(claim.extensionId, {
        type: TYPE,
        protocolVersion: PROTOCOL_VERSION,
        action: "discard",
        requestId: claim.requestId,
        handoffId: claim.handoffId,
      });
      if (!response?.ok || response.requestId !== claim.requestId || response.handoffId !== claim.handoffId) {
        throw new Error(response?.error || "discard_failed");
      }
      return response;
    },
  };
}

export const PUBLISH_HANDOFF_PROTOCOL = Object.freeze({
  type: TYPE,
  protocolVersion: PROTOCOL_VERSION,
  extensionIds: EXTENSION_IDS,
});
