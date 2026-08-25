import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  AUTH_CODE_TTL_SECONDS,
  OAuthError,
  decryptJson,
  encryptJson,
  sha256Base64Url,
  validateAuthorizeBody,
  validateRedirectUri,
  validateTokenBody,
} from "../supabase/functions/_shared/yucang-extension-auth.ts";

const chromeStoreRedirect = "https://fapladhajicfoiadhcpmbmfkodekkckg.chromiumapp.org/yucang-auth";
const chromeDevRedirect = "https://idiemjhonlahnlnalpanhplbgjcfbpnl.chromiumapp.org/yucang-auth";
const unknownEdgeRedirect = "https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/yucang-auth";
const wildcardRedirect = "https://*.chromiumapp.org/yucang-auth";
const allowlist = `${chromeStoreRedirect},${chromeDevRedirect}`;
const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
const state = "state_0123456789abcdef0123456789abcdef";

assert.equal(AUTH_CODE_TTL_SECONDS, 60);
assert.equal(await sha256Base64Url(verifier), challenge);
assert.equal(validateRedirectUri(chromeStoreRedirect, allowlist), chromeStoreRedirect);
assert.equal(validateRedirectUri(chromeDevRedirect, allowlist), chromeDevRedirect);
assert.throws(
  () => validateRedirectUri(unknownEdgeRedirect, allowlist),
  (error) => error instanceof OAuthError && error.code === "invalid_request",
);
assert.throws(
  () => validateRedirectUri(chromeStoreRedirect, wildcardRedirect),
  (error) => error instanceof OAuthError && error.code === "invalid_request",
);
assert.throws(
  () => validateRedirectUri("https://evil.example/yucang-auth", allowlist),
  (error) => error instanceof OAuthError && error.code === "invalid_request",
);
assert.throws(
  () => validateRedirectUri(`${chromeStoreRedirect}?token=bad`, allowlist),
  (error) => error instanceof OAuthError && error.code === "invalid_request",
);

const authorize = validateAuthorizeBody({
  provider: "github",
  action: "signin",
  redirect_uri: chromeStoreRedirect,
  code_challenge: challenge,
  code_challenge_method: "S256",
  state,
  refresh_token: "short-token",
  expires_at: Math.floor(Date.now() / 1000) + 3600,
}, allowlist);
assert.equal(authorize.redirectUri, chromeStoreRedirect);
assert.equal(authorize.provider, "github");
assert.equal(authorize.refreshToken, "short-token");
assert.throws(
  () => validateAuthorizeBody({
    ...authorize,
    redirect_uri: chromeStoreRedirect,
    code_challenge_method: "plain",
    state,
    refresh_token: "refresh-token-value-that-is-long-enough",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  }, allowlist),
  (error) => error instanceof OAuthError && error.code === "invalid_request",
);

const token = validateTokenBody({
  grant_type: "authorization_code",
  code: "authorization_code_0123456789abcdef0123456789",
  code_verifier: verifier,
  redirect_uri: chromeDevRedirect,
}, allowlist);
assert.equal(token.redirectUri, chromeDevRedirect);
assert.throws(
  () => validateTokenBody({
    grant_type: "refresh_token",
    code: "authorization_code_0123456789abcdef0123456789",
    code_verifier: verifier,
    redirect_uri: chromeDevRedirect,
  }, allowlist),
  (error) => error instanceof OAuthError && error.code === "unsupported_grant_type",
);

const key = Buffer.alloc(32, 7).toString("base64");
const session = { access_token: "access", refresh_token: "refresh", user: { id: "user-id" } };
const encrypted = await encryptJson(session, key);
assert.equal(encrypted.includes("access"), false);
assert.deepEqual(await decryptJson(encrypted, key), session);
await assert.rejects(() => decryptJson(encrypted, Buffer.alloc(32, 8).toString("base64")));

const [pageSource, authorizeSource, tokenSource, migration, netlify, sharedLogin, sharedStyles, extensionPage, websitePage, websiteApp] = await Promise.all([
  readFile(new URL("../auth/extension/app.js", import.meta.url), "utf8"),
  readFile(new URL("../supabase/functions/yucang-extension-authorize/index.ts", import.meta.url), "utf8"),
  readFile(new URL("../supabase/functions/yucang-extension-token/index.ts", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20260825000200_yucang_extension_auth.sql", import.meta.url), "utf8"),
  readFile(new URL("../netlify.toml", import.meta.url), "utf8"),
  readFile(new URL("../auth/login-experience.js", import.meta.url), "utf8"),
  readFile(new URL("../auth/login-experience.css", import.meta.url), "utf8"),
  readFile(new URL("../auth/extension/index.html", import.meta.url), "utf8"),
  readFile(new URL("../yucang/index.html", import.meta.url), "utf8"),
  readFile(new URL("../yucang/app.js", import.meta.url), "utf8"),
]);

assert.match(pageSource, /type: "prompt-vault-extension-auth-result"/);
assert.match(pageSource, /await sendExtensionResult\(\{ code: result\.code \}\)/);
assert.match(pageSource, /yucangExtensionProviderStarted/);
assert.match(pageSource, /client\.auth\.signOut\(\{ scope: "local" \}\)/);
assert.match(pageSource, /id="switchAccountButton"/);
assert.match(pageSource, /id="closePageButton"/);
assert.match(pageSource, /cancelButton\.addEventListener\("click", cancelAndClose\)/);
assert.match(pageSource, /const loginConsent = bindLoginConsent\(extensionLoginRoot\)/);
assert.match(pageSource, /if \(!loginConsent\.allowed\(\)\)/);
assert.match(sharedLogin, /id="loginPolicyConsent" type="checkbox"/);
assert.match(sharedLogin, /data-login-action disabled/);
assert.match(sharedLogin, /export function bindLoginConsent/);
assert.match(sharedLogin, /action\.disabled = !allowed\(\) \|\| busyActions\.has\(action\)/);
assert.match(pageSource, /response\.requestId !== requestId/);
assert.doesNotMatch(pageSource, /location\.replace\(callbackUrl/);
assert.doesNotMatch(pageSource, /sendExtensionResult\(\{[^}]*access_token/);
assert.match(pageSource, /supabase\.co\/functions\/v1/);
assert.match(pageSource, /yucang-extension-authorize/);
assert.match(authorizeSource, /auth\.getUser\(accessToken\)/);
assert.match(authorizeSource, /state_hash/);
assert.match(tokenSource, /p_code_challenge: verifierChallenge/);
assert.match(tokenSource, /yucang_consume_extension_auth_code/);
assert.match(migration, /consumed_at is null/);
assert.match(migration, /code\.expires_at > now\(\)/);
assert.match(migration, /revoke all on table public\.yucang_extension_auth_codes from public, anon, authenticated/);
assert.match(migration, /grant execute on function public\.yucang_consume_extension_auth_code\(text, text, text\)[\s\S]*to service_role/);
assert.match(netlify, /from = "\/auth\/extension"/);
assert.match(extensionPage, /\.\.\/login-experience\.css/);
assert.match(websitePage, /\.\.\/auth\/login-experience\.css/);
assert.match(pageSource, /from "\.\.\/login-experience\.js"/);
assert.match(websiteApp, /from "\.\.\/auth\/login-experience\.js"/);
assert.match(sharedLogin, /prompt-vault-desktop\.png/);
assert.match(sharedLogin, /prompt-vault-mobile\.png/);
assert.match(sharedLogin, /prompt-vault-product\.jpg/);
assert.match(sharedLogin, /aria-label="使用 GitHub 登录" title="使用 GitHub 登录"/);
assert.match(sharedLogin, /aria-label="使用 Google 登录" title="使用 Google 登录"/);
assert.match(sharedStyles, /@media \(max-width: 820px\)/);
assert.match(sharedStyles, /prefers-reduced-motion/);
assert.match(sharedStyles, /height: min\(680px, calc\(100dvh - 112px\)\)/);
assert.match(sharedStyles, /\.login-slide \{[\s\S]*position: absolute;[\s\S]*inset: 0;/);

console.log("Yucang extension auth contract tests passed.");
