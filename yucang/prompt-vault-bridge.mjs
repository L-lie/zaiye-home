export const PROMPT_VAULT_IMPORT_PROTOCOL = Object.freeze({
  type: "prompt-vault-public-import",
  protocolVersion: 1,
  capability: "save-public-prompt",
  extensionIds: Object.freeze([
    "fapladhajicfoiadhcpmbmfkodekkckg",
    "idiemjhonlahnlnalpanhplbgjcfbpnl",
  ]),
});

function sendExternalMessage(runtime, extensionId, message, timeoutMs = 1400) {
  return new Promise((resolve) => {
    if (!runtime?.sendMessage) return resolve(null);
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    try {
      runtime.sendMessage(extensionId, message, (response) => {
        if (runtime.lastError) return finish(null);
        finish(response || null);
      });
    } catch {
      finish(null);
    }
  });
}

function createRequestId() {
  const randomPart = globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `yucang-${randomPart}`.slice(0, 100);
}

export function createPromptVaultBridge(runtime = globalThis.chrome?.runtime) {
  let detectionPromise = null;

  const detect = ({ refresh = false } = {}) => {
    if (detectionPromise && !refresh) return detectionPromise;
    detectionPromise = (async () => {
      for (const extensionId of PROMPT_VAULT_IMPORT_PROTOCOL.extensionIds) {
        const response = await sendExternalMessage(runtime, extensionId, {
          type: PROMPT_VAULT_IMPORT_PROTOCOL.type,
          protocolVersion: PROMPT_VAULT_IMPORT_PROTOCOL.protocolVersion,
          action: "ping",
        });
        if (
          response?.ok === true
          && response.protocolVersion === PROMPT_VAULT_IMPORT_PROTOCOL.protocolVersion
          && response.capabilities?.includes(PROMPT_VAULT_IMPORT_PROTOCOL.capability)
        ) {
          return { installed: true, extensionId, extensionVersion: response.extensionVersion || "" };
        }
      }
      return { installed: false, extensionId: "", extensionVersion: "" };
    })();
    return detectionPromise;
  };

  const save = async (payload) => {
    const connection = await detect();
    if (!connection.installed) return { ok: false, error: "not_installed" };
    const requestId = createRequestId();
    const response = await sendExternalMessage(runtime, connection.extensionId, {
      type: PROMPT_VAULT_IMPORT_PROTOCOL.type,
      protocolVersion: PROMPT_VAULT_IMPORT_PROTOCOL.protocolVersion,
      action: "save",
      requestId,
      payload,
    }, 5000);
    return response || { ok: false, error: "no_response", requestId };
  };

  return { detect, save };
}
