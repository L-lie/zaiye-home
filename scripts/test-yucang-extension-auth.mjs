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

const chromeRedirect = "https://fapladhajicfoiadhcpmbmfkodekkckg.chromiumapp.org/yucang-auth";
const edgeRedirect = "https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/yucang-auth";
const allowlist = `${chromeRedirect},${edgeRedirect}`;
const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
const state = "state_0123456789abcdef0123456789abcdef";

assert.equal(AUTH_CODE_TTL_SECONDS, 60);
assert.equal(await sha256Base64Url(verifier), challenge);
assert.equal(validateRedirectUri(chromeRedirect, allowlist), chromeRedirect);
assert.throws(
  () => validateRedirectUri("https://evil.example/yucang-auth", allowlist),
  (error) => error instanceof OAuthError && error.code === "invalid_request",
);
assert.throws(
  () => validateRedirectUri(`${chromeRedirect}?token=bad`, allowlist),
  (error) => error instanceof OAuthError && error.code === "invalid_request",
);

const authorize = validateAuthorizeBody({
  provider: "github",
  action: "signin",
  redirect_uri: chromeRedirect,
  code_challenge: challenge,
  code_challenge_method: "S256",
  state,
  refresh_token: "refresh-token-value-that-is-long-enough",
  expires_at: Math.floor(Date.now() / 1000) + 3600,
}, allowlist);
assert.equal(authorize.redirectUri, chromeRedirect);
assert.equal(authorize.provider, "github");
assert.throws(
  () => validateAuthorizeBody({
    ...authorize,
    redirect_uri: chromeRedirect,
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
  redirect_uri: edgeRedirect,
}, allowlist);
assert.equal(token.redirectUri, edgeRedirect);
assert.throws(
  () => validateTokenBody({
    grant_type: "refresh_token",
    code: "authorization_code_0123456789abcdef0123456789",
    code_verifier: verifier,
    redirect_uri: edgeRedirect,
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

assert.match(pageSource, /location\.replace\(callbackUrl\(\{ code: result\.code, state: result\.state \}\)\)/);
assert.doesNotMatch(pageSource, /callbackUrl\(\{[^}]*access_token/);
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
