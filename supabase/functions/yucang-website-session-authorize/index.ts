import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import {
  AUTH_CODE_TTL_SECONDS,
  OAuthError,
  bearerToken,
  encryptJson,
  env,
  extensionCors,
  oauthJson,
  randomCode,
  readJson,
  serviceRoleKey,
  sha256Base64Url,
  successJson,
  toOAuthResponse,
  validateWebsiteSessionAuthorizeBody,
} from "../_shared/yucang-extension-auth.ts";

Deno.serve(async (request) => {
  let cors: HeadersInit = {};
  try {
    cors = extensionCors(request, env("YUCANG_EXTENSION_ORIGIN_ALLOWLIST"));
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") {
      return oauthJson(405, "invalid_request", "Only POST is supported.", { ...cors, Allow: "POST, OPTIONS" });
    }

    const accessToken = bearerToken(request);
    const input = validateWebsiteSessionAuthorizeBody(
      await readJson(request),
      request.headers.get("origin") || "",
      env("YUCANG_WEB_ORIGINS"),
    );
    const admin = createClient(env("SUPABASE_URL"), serviceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await admin.auth.getUser(accessToken);
    if (userError || !userData.user) {
      throw new OAuthError(401, "invalid_session", "The extension session is invalid or expired.");
    }

    const code = randomCode();
    const now = Math.floor(Date.now() / 1000);
    const encryptedSession = await encryptJson({
      access_token: accessToken,
      refresh_token: input.refreshToken,
      expires_at: input.expiresAt,
      expires_in: Math.max(0, input.expiresAt - now),
      token_type: "bearer",
      user: userData.user,
    }, env("YUCANG_EXTENSION_AUTH_ENCRYPTION_KEY"));
    const expiresAt = new Date(Date.now() + AUTH_CODE_TTL_SECONDS * 1000).toISOString();
    const { error: insertError } = await admin.from("yucang_website_session_auth_codes").insert({
      code_hash: await sha256Base64Url(code),
      auth_user_id: userData.user.id,
      extension_id: input.extensionId,
      target_origin: input.targetOrigin,
      code_challenge: input.codeChallenge,
      state_hash: await sha256Base64Url(input.state),
      nonce_hash: await sha256Base64Url(input.nonce),
      encrypted_session: encryptedSession,
      expires_at: expiresAt,
    });
    if (insertError) throw insertError;

    return successJson({ code, state: input.state, nonce: input.nonce, expires_in: AUTH_CODE_TTL_SECONDS }, cors);
  } catch (error) {
    return toOAuthResponse(error, cors);
  }
});
