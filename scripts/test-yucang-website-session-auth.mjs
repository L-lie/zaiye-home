import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  OAuthError,
  sha256Base64Url,
  validateWebsiteSessionAuthorizeBody,
  validateWebsiteSessionTokenBody,
} from "../supabase/functions/_shared/yucang-extension-auth.ts";
import {
  PROMPT_VAULT_WEBSITE_AUTH_PROTOCOL,
  createPromptVaultWebsiteAuthBridge,
} from "../yucang/prompt-vault-auth-bridge.mjs";

const extensionId = "fapladhajicfoiadhcpmbmfkodekkckg";
const extensionOrigin = `chrome-extension://${extensionId}`;
const targetOrigin = "https://zaiye.art";
const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
const state = "state_0123456789abcdef0123456789abcdef";
const nonce = "nonce_0123456789abcdef0123456789abcdef";

assert.equal(await sha256Base64Url(verifier), challenge);
const authorize = validateWebsiteSessionAuthorizeBody({
  extension_id: extensionId,
  target_origin: targetOrigin,
  code_challenge: challenge,
  code_challenge_method: "S256",
  state,
  nonce,
  refresh_token: "refresh-token-value-that-is-long-enough",
  expires_at: Math.floor(Date.now() / 1000) + 3600,
}, extensionOrigin, targetOrigin);
assert.equal(authorize.extensionId, extensionId);
assert.equal(authorize.targetOrigin, targetOrigin);
assert.throws(
  () => validateWebsiteSessionAuthorizeBody({
    extension_id: extensionId,
    target_origin: targetOrigin,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
    nonce,
    refresh_token: "refresh-token-value-that-is-long-enough",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  }, "chrome-extension://idiemjhonlahnlnalpanhplbgjcfbpnl", targetOrigin),
  (error) => error instanceof OAuthError && error.code === "access_denied",
);
assert.throws(
  () => validateWebsiteSessionAuthorizeBody({
    extension_id: extensionId,
    target_origin: "https://evil.example",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
    nonce,
    refresh_token: "refresh-token-value-that-is-long-enough",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  }, extensionOrigin, targetOrigin),
  (error) => error instanceof OAuthError && error.code === "access_denied",
);

const token = validateWebsiteSessionTokenBody({
  grant_type: "authorization_code",
  code: "authorization_code_0123456789abcdef0123456789",
  code_verifier: verifier,
  target_origin: targetOrigin,
  state,
  nonce,
}, targetOrigin);
assert.equal(token.targetOrigin, targetOrigin);

const runtimeCalls = [];
const runtime = {
  lastError: null,
  sendMessage(id, message, callback) {
    runtimeCalls.push({ id, message });
    callback({ ok: true, code: "authorization_code_0123456789abcdef0123456789", state: message.state, nonce: message.nonce });
  },
};
let tokenRequest;
const fetchImpl = async (url, options) => {
  tokenRequest = { url, options, body: JSON.parse(options.body) };
  return {
    ok: true,
    async json() {
      return { access_token: "website-access", refresh_token: "website-refresh", user: { id: "user-id" } };
    },
  };
};
const session = await createPromptVaultWebsiteAuthBridge({ runtime, fetchImpl, currentOrigin: targetOrigin }).signInFromExtension();
assert.equal(session.user.id, "user-id");
assert.equal(runtimeCalls.length, 1);
assert.equal(runtimeCalls[0].message.action, "issue-web-session");
assert.equal(runtimeCalls[0].message.target_origin, targetOrigin);
assert.equal(runtimeCalls[0].message.code_challenge_method, "S256");
assert.equal(tokenRequest.url, PROMPT_VAULT_WEBSITE_AUTH_PROTOCOL.tokenEndpoint);
assert.equal(tokenRequest.body.grant_type, "authorization_code");
assert.equal(tokenRequest.body.state, runtimeCalls[0].message.state);
assert.equal(tokenRequest.body.nonce, runtimeCalls[0].message.nonce);
assert.equal("access_token" in runtimeCalls[0].message, false);
assert.equal("refresh_token" in runtimeCalls[0].message, false);

const localRuntime = { ...runtime, sendMessage() { throw new Error("must not contact extension from non-production origin"); } };
assert.equal(await createPromptVaultWebsiteAuthBridge({ runtime: localRuntime, fetchImpl, currentOrigin: "http://127.0.0.1:8787" }).signInFromExtension(), null);

const [authorizeSource, tokenSource, migration, appSource, bridgeSource] = await Promise.all([
  readFile(new URL("../supabase/functions/yucang-website-session-authorize/index.ts", import.meta.url), "utf8"),
  readFile(new URL("../supabase/functions/yucang-website-session-token/index.ts", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20260825000300_yucang_website_session_auth.sql", import.meta.url), "utf8"),
  readFile(new URL("../yucang/app.js", import.meta.url), "utf8"),
  readFile(new URL("../yucang/prompt-vault-auth-bridge.mjs", import.meta.url), "utf8"),
]);
assert.match(authorizeSource, /auth\.getUser\(accessToken\)/);
assert.match(authorizeSource, /state_hash/);
assert.match(authorizeSource, /nonce_hash/);
assert.match(authorizeSource, /extension_id/);
assert.match(tokenSource, /yucang_consume_website_session_auth_code/);
assert.match(tokenSource, /p_code_challenge: await sha256Base64Url\(input\.verifier\)/);
assert.match(tokenSource, /p_state_hash/);
assert.match(tokenSource, /p_nonce_hash/);
assert.match(migration, /code\.consumed_at is null/);
assert.match(migration, /code\.expires_at > now\(\)/);
assert.match(migration, /revoke all on table public\.yucang_website_session_auth_codes from public, anon, authenticated/);
assert.match(appSource, /client\.auth\.setSession/);
assert.doesNotMatch(bridgeSource, /location\.(?:href|replace|assign).*token/i);
assert.doesNotMatch(bridgeSource, /chrome\.storage|\.get\(\s*["']prompts|search-private|enumerate-private/i);

console.log("Yucang reverse website-session auth tests passed.");
