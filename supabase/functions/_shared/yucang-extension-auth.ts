const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const AUTH_CODE_TTL_SECONDS = 60;
export const MAX_JSON_BYTES = 32_768;

export class OAuthError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "OAuthError";
    this.status = status;
    this.code = code;
  }
}

export function oauthJson(
  status: number,
  error: string,
  description: string,
  headers: HeadersInit = {},
) {
  return Response.json(
    { error, error_description: description },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        Pragma: "no-cache",
        ...headers,
      },
    },
  );
}

export function successJson(body: unknown, headers: HeadersInit = {}) {
  return Response.json(body, {
    headers: {
      "Cache-Control": "no-store",
      Pragma: "no-cache",
      ...headers,
    },
  });
}

export function toOAuthResponse(error: unknown, headers: HeadersInit = {}) {
  if (error instanceof OAuthError) {
    return oauthJson(error.status, error.code, error.message, headers);
  }
  console.error(error);
  return oauthJson(500, "server_error", "The authorization server could not complete the request.", headers);
}

export async function readJson(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new OAuthError(415, "invalid_request", "Content-Type must be application/json.");
  }
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_JSON_BYTES) {
    throw new OAuthError(413, "invalid_request", "Request body is too large.");
  }
  const text = await request.text();
  if (textEncoder.encode(text).byteLength > MAX_JSON_BYTES) {
    throw new OAuthError(413, "invalid_request", "Request body is too large.");
  }
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("object required");
    return value as Record<string, unknown>;
  } catch {
    throw new OAuthError(400, "invalid_request", "Request body must be a JSON object.");
  }
}

export function requiredString(body: Record<string, unknown>, name: string) {
  const value = body[name];
  if (typeof value !== "string" || !value) {
    throw new OAuthError(400, "invalid_request", `${name} is required.`);
  }
  return value;
}

function optionalProvider(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (value !== "github" && value !== "google" && value !== "email") {
    throw new OAuthError(400, "invalid_request", "provider must be github, google, or email.");
  }
  return value;
}

export function validOpaque(value: string, min: number, max: number) {
  return value.length >= min && value.length <= max && /^[A-Za-z0-9._~-]+$/.test(value);
}

export function exactAllowlist(value: string, envName: string) {
  const entries = value.split(/[\s,]+/).map((entry) => entry.trim()).filter(Boolean);
  if (!entries.length) throw new Error(`${envName} is not configured`);
  return new Set(entries);
}

export function validateExactOrigin(value: string, allowlistValue: string, envName: string) {
  let origin: string;
  try {
    const url = new URL(value);
    if (url.origin === "null" || url.href !== `${url.origin}/`) throw new Error("origin required");
    origin = url.origin;
  } catch {
    throw new OAuthError(400, "invalid_request", "target_origin is invalid.");
  }
  if (!exactAllowlist(allowlistValue, envName).has(origin)) {
    throw new OAuthError(403, "access_denied", "Target origin is not allowed.");
  }
  return origin;
}

export function extensionCors(request: Request, allowlistValue: string) {
  const origin = request.headers.get("origin") || "";
  if (!exactAllowlist(allowlistValue, "YUCANG_EXTENSION_ORIGIN_ALLOWLIST").has(origin)) {
    throw new OAuthError(403, "access_denied", "Extension origin is not allowed.");
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

export function webCors(request: Request, allowlistValue: string) {
  const origin = request.headers.get("origin") || "";
  if (!exactAllowlist(allowlistValue, "YUCANG_WEB_ORIGINS").has(origin)) {
    throw new OAuthError(403, "access_denied", "Website origin is not allowed.");
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

export function validateWebsiteSessionAuthorizeBody(
  body: Record<string, unknown>,
  extensionOrigin: string,
  webOriginsValue: string,
) {
  const extensionId = requiredString(body, "extension_id");
  if (!/^[a-p]{32}$/.test(extensionId) || extensionOrigin !== `chrome-extension://${extensionId}`) {
    throw new OAuthError(403, "access_denied", "Extension identity does not match its origin.");
  }
  if (requiredString(body, "code_challenge_method") !== "S256") {
    throw new OAuthError(400, "invalid_request", "code_challenge_method must be S256.");
  }
  const codeChallenge = requiredString(body, "code_challenge");
  const state = requiredString(body, "state");
  const nonce = requiredString(body, "nonce");
  if (!validOpaque(codeChallenge, 43, 128) || codeChallenge.includes(".") || codeChallenge.includes("~")) {
    throw new OAuthError(400, "invalid_request", "code_challenge is invalid.");
  }
  if (!validOpaque(state, 16, 512) || !validOpaque(nonce, 16, 512)) {
    throw new OAuthError(400, "invalid_request", "state or nonce is invalid.");
  }
  const expiresAt = Number(body.expires_at);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) {
    throw new OAuthError(401, "invalid_session", "The extension session is expired.");
  }
  const refreshToken = requiredString(body, "refresh_token");
  if (refreshToken.length < 20 || refreshToken.length > 4096) {
    throw new OAuthError(400, "invalid_request", "refresh_token is invalid.");
  }
  return {
    extensionId,
    targetOrigin: validateExactOrigin(requiredString(body, "target_origin"), webOriginsValue, "YUCANG_WEB_ORIGINS"),
    codeChallenge,
    state,
    nonce,
    refreshToken,
    expiresAt,
  };
}

export function validateWebsiteSessionTokenBody(body: Record<string, unknown>, webOriginsValue: string) {
  if (requiredString(body, "grant_type") !== "authorization_code") {
    throw new OAuthError(400, "unsupported_grant_type", "grant_type must be authorization_code.");
  }
  const code = requiredString(body, "code");
  const verifier = requiredString(body, "code_verifier");
  const state = requiredString(body, "state");
  const nonce = requiredString(body, "nonce");
  if (!validOpaque(code, 32, 128) || !validOpaque(verifier, 43, 128)) {
    throw new OAuthError(400, "invalid_grant", "Authorization code or verifier is invalid.");
  }
  if (!validOpaque(state, 16, 512) || !validOpaque(nonce, 16, 512)) {
    throw new OAuthError(400, "invalid_grant", "state or nonce is invalid.");
  }
  return {
    code,
    verifier,
    state,
    nonce,
    targetOrigin: validateExactOrigin(requiredString(body, "target_origin"), webOriginsValue, "YUCANG_WEB_ORIGINS"),
  };
}

export function validateRedirectUri(value: string, allowlistValue: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new OAuthError(400, "invalid_request", "redirect_uri is invalid.");
  }
  if (url.protocol !== "https:" || url.pathname !== "/yucang-auth" || url.search || url.hash) {
    throw new OAuthError(400, "invalid_request", "redirect_uri is not an allowed extension callback.");
  }
  if (!exactAllowlist(allowlistValue, "YUCANG_EXTENSION_REDIRECT_ALLOWLIST").has(url.href)) {
    throw new OAuthError(400, "invalid_request", "redirect_uri is not allowlisted.");
  }
  return url.href;
}

export function validateAuthorizeBody(body: Record<string, unknown>, allowlistValue: string) {
  const action = requiredString(body, "action");
  if (action !== "signin" && action !== "link") {
    throw new OAuthError(400, "invalid_request", "action must be signin or link.");
  }
  const challengeMethod = requiredString(body, "code_challenge_method");
  if (challengeMethod !== "S256") {
    throw new OAuthError(400, "invalid_request", "code_challenge_method must be S256.");
  }
  const challenge = requiredString(body, "code_challenge");
  if (!validOpaque(challenge, 43, 128) || challenge.includes("." ) || challenge.includes("~")) {
    throw new OAuthError(400, "invalid_request", "code_challenge is invalid.");
  }
  const state = requiredString(body, "state");
  if (!validOpaque(state, 16, 512)) {
    throw new OAuthError(400, "invalid_request", "state is invalid.");
  }
  const expiresAt = Number(body.expires_at);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) {
    throw new OAuthError(401, "invalid_session", "The website session is expired.");
  }
  const refreshToken = requiredString(body, "refresh_token");
  if (refreshToken.length < 20 || refreshToken.length > 4096) {
    throw new OAuthError(400, "invalid_request", "refresh_token is invalid.");
  }
  return {
    provider: optionalProvider(body.provider),
    action,
    redirectUri: validateRedirectUri(requiredString(body, "redirect_uri"), allowlistValue),
    codeChallenge: challenge,
    state,
    refreshToken,
    expiresAt,
  };
}

export function validateTokenBody(body: Record<string, unknown>, allowlistValue: string) {
  if (requiredString(body, "grant_type") !== "authorization_code") {
    throw new OAuthError(400, "unsupported_grant_type", "grant_type must be authorization_code.");
  }
  const code = requiredString(body, "code");
  if (!validOpaque(code, 32, 128)) throw new OAuthError(400, "invalid_grant", "Authorization code is invalid.");
  const verifier = requiredString(body, "code_verifier");
  if (!validOpaque(verifier, 43, 128)) throw new OAuthError(400, "invalid_grant", "code_verifier is invalid.");
  return {
    code,
    verifier,
    redirectUri: validateRedirectUri(requiredString(body, "redirect_uri"), allowlistValue),
  };
}

export function bearerToken(request: Request) {
  const match = /^Bearer\s+([^\s]+)$/i.exec(request.headers.get("authorization") || "");
  if (!match) throw new OAuthError(401, "invalid_session", "A valid website session is required.");
  return match[1];
}

export function authorizeCors(request: Request, allowedOriginsValue: string) {
  const origin = request.headers.get("origin") || "";
  const allowed = exactAllowlist(allowedOriginsValue, "YUCANG_WEB_ORIGINS");
  if (!allowed.has(origin)) throw new OAuthError(403, "access_denied", "Request origin is not allowed.");
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

export const tokenCors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export async function sha256(value: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", textEncoder.encode(value)));
}

export async function sha256Base64Url(value: string) {
  return base64Url(await sha256(value));
}

export function randomCode() {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export function encryptionKey(secret: string) {
  const bytes = decodeBase64(secret);
  if (bytes.byteLength !== 32) throw new Error("YUCANG_EXTENSION_AUTH_ENCRYPTION_KEY must decode to 32 bytes");
  return bytes;
}

export async function encryptJson(value: unknown, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey("raw", encryptionKey(secret), "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    textEncoder.encode(JSON.stringify(value)),
  ));
  return `${base64Url(iv)}.${base64Url(ciphertext)}`;
}

export async function decryptJson(value: string, secret: string) {
  const [ivValue, ciphertextValue, extra] = value.split(".");
  if (!ivValue || !ciphertextValue || extra) throw new Error("Encrypted session is malformed");
  const key = await crypto.subtle.importKey("raw", encryptionKey(secret), "AES-GCM", false, ["decrypt"]);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: decodeBase64(ivValue) },
    key,
    decodeBase64(ciphertextValue),
  );
  return JSON.parse(textDecoder.decode(plaintext));
}

export function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function serviceRoleKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const values = JSON.parse(env("SUPABASE_SECRET_KEYS")) as Record<string, string>;
  const key = Object.values(values)[0];
  if (!key) throw new Error("No Supabase secret key is configured");
  return key;
}
