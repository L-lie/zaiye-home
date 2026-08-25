import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import {
  OAuthError,
  decryptJson,
  env,
  oauthJson,
  readJson,
  serviceRoleKey,
  sha256Base64Url,
  successJson,
  toOAuthResponse,
  validateWebsiteSessionTokenBody,
  webCors,
} from "../_shared/yucang-extension-auth.ts";

Deno.serve(async (request) => {
  let cors: HeadersInit = {};
  try {
    cors = webCors(request, env("YUCANG_WEB_ORIGINS"));
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") {
      return oauthJson(405, "invalid_request", "Only POST is supported.", { ...cors, Allow: "POST, OPTIONS" });
    }

    const input = validateWebsiteSessionTokenBody(await readJson(request), env("YUCANG_WEB_ORIGINS"));
    if ((request.headers.get("origin") || "") !== input.targetOrigin) {
      throw new OAuthError(403, "access_denied", "Website origin does not match the authorization code binding.");
    }
    const admin = createClient(env("SUPABASE_URL"), serviceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await admin.rpc("yucang_consume_website_session_auth_code", {
      p_code_hash: await sha256Base64Url(input.code),
      p_target_origin: input.targetOrigin,
      p_code_challenge: await sha256Base64Url(input.verifier),
      p_state_hash: await sha256Base64Url(input.state),
      p_nonce_hash: await sha256Base64Url(input.nonce),
    });
    const consumed = Array.isArray(data) ? data[0] : data;
    if (error || !consumed) {
      throw new OAuthError(400, "invalid_grant", "Authorization code is invalid, expired, bound to another request, or already used.");
    }

    const session = await decryptJson(consumed.encrypted_session, env("YUCANG_EXTENSION_AUTH_ENCRYPTION_KEY"));
    if (!session?.user?.id || session.user.id !== consumed.auth_user_id) {
      throw new Error("Authorization code user binding mismatch");
    }
    return successJson(session, cors);
  } catch (error) {
    return toOAuthResponse(error, cors);
  }
});
