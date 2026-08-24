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
  tokenCors,
  toOAuthResponse,
  validateTokenBody,
} from "../_shared/yucang-extension-auth.ts";

Deno.serve(async (request) => {
  try {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: tokenCors });
    if (request.method !== "POST") {
      return oauthJson(405, "invalid_request", "Only POST is supported.", { ...tokenCors, Allow: "POST, OPTIONS" });
    }

    const input = validateTokenBody(
      await readJson(request),
      env("YUCANG_EXTENSION_REDIRECT_ALLOWLIST"),
    );
    const admin = createClient(env("SUPABASE_URL"), serviceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const codeHash = await sha256Base64Url(input.code);
    const verifierChallenge = await sha256Base64Url(input.verifier);
    const { data, error } = await admin.rpc("yucang_consume_extension_auth_code", {
      p_code_hash: codeHash,
      p_redirect_uri: input.redirectUri,
      p_code_challenge: verifierChallenge,
    });
    const consumed = Array.isArray(data) ? data[0] : data;
    if (error || !consumed) {
      throw new OAuthError(400, "invalid_grant", "Authorization code is invalid, expired, or already used.");
    }

    const session = await decryptJson(
      consumed.encrypted_session,
      env("YUCANG_EXTENSION_AUTH_ENCRYPTION_KEY"),
    );
    if (!session?.user?.id || session.user.id !== consumed.auth_user_id) {
      throw new Error("Authorization code user binding mismatch");
    }
    return successJson(session, tokenCors);
  } catch (error) {
    return toOAuthResponse(error, tokenCors);
  }
});
