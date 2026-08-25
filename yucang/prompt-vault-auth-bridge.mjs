export const PROMPT_VAULT_WEBSITE_AUTH_PROTOCOL = Object.freeze({
  type: "prompt-vault-website-auth",
  protocolVersion: 1,
  capability: "issue-website-session",
  targetOrigin: "https://zaiye.art",
  tokenEndpoint: "https://zbcdmtjmqpwtevjaewtl.supabase.co/functions/v1/yucang-website-session-token",
  extensionIds: Object.freeze([
    "fapladhajicfoiadhcpmbmfkodekkckg",
    "idiemjhonlahnlnalpanhplbgjcfbpnl",
  ]),
});

function base64Url(bytes) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function randomOpaque(byteLength = 32) {
  return base64Url(globalThis.crypto.getRandomValues(new Uint8Array(byteLength)));
}

async function sha256Base64Url(value) {
  const bytes = new TextEncoder().encode(value);
  return base64Url(new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes)));
}

function sendExternalMessage(runtime, extensionId, message, timeoutMs = 6500) {
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

export function createPromptVaultWebsiteAuthBridge({
  runtime = globalThis.chrome?.runtime,
  fetchImpl = globalThis.fetch?.bind(globalThis),
  currentOrigin = globalThis.location?.origin || "",
} = {}) {
  let attemptPromise = null;

  const signInFromExtension = () => {
    if (attemptPromise) return attemptPromise;
    attemptPromise = (async () => {
      if (currentOrigin !== PROMPT_VAULT_WEBSITE_AUTH_PROTOCOL.targetOrigin || !runtime?.sendMessage || !fetchImpl) {
        return null;
      }
      const verifier = randomOpaque(32);
      const state = randomOpaque(24);
      const nonce = randomOpaque(24);
      const codeChallenge = await sha256Base64Url(verifier);
      const requestId = `yucang-web-${randomOpaque(18)}`.slice(0, 100);

      for (const extensionId of PROMPT_VAULT_WEBSITE_AUTH_PROTOCOL.extensionIds) {
        const response = await sendExternalMessage(runtime, extensionId, {
          type: PROMPT_VAULT_WEBSITE_AUTH_PROTOCOL.type,
          protocolVersion: PROMPT_VAULT_WEBSITE_AUTH_PROTOCOL.protocolVersion,
          action: "issue-web-session",
          requestId,
          target_origin: PROMPT_VAULT_WEBSITE_AUTH_PROTOCOL.targetOrigin,
          code_challenge: codeChallenge,
          code_challenge_method: "S256",
          state,
          nonce,
        });
        if (!response?.ok) continue;
        if (response.state !== state || response.nonce !== nonce || typeof response.code !== "string") continue;

        const tokenResponse = await fetchImpl(PROMPT_VAULT_WEBSITE_AUTH_PROTOCOL.tokenEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            grant_type: "authorization_code",
            code: response.code,
            code_verifier: verifier,
            target_origin: PROMPT_VAULT_WEBSITE_AUTH_PROTOCOL.targetOrigin,
            state,
            nonce,
          }),
        });
        if (!tokenResponse.ok) return null;
        const session = await tokenResponse.json();
        if (!session?.access_token || !session?.refresh_token || !session?.user?.id) return null;
        return session;
      }
      return null;
    })().catch(() => null);
    return attemptPromise;
  };

  return { signInFromExtension };
}
