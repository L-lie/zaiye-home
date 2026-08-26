import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import {
  detectAvatarMime,
  MAX_AVATAR_BYTES,
  ProfileError,
  profileCorsHeaders,
  validateDisplayName,
  YUCANG_PROFILE_ORIGINS,
} from "../_shared/yucang-account-profile.ts";

const BUCKET = "yucang-avatars";

function json(status: number, origin: string, body: Record<string, unknown>) {
  const allowedOrigin = YUCANG_PROFILE_ORIGINS.has(origin) ? origin : "https://zaiye.art";
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...profileCorsHeaders(allowedOrigin),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function bearer(request: Request) {
  const match = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new ProfileError(401, "authentication_required", "A signed-in session is required.");
  return match[1];
}

function firstRow(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin") || "";
  try {
    if (!YUCANG_PROFILE_ORIGINS.has(origin)) return json(403, origin, { ok: false, error: "origin_not_allowed" });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: profileCorsHeaders(origin) });
    if (request.method !== "POST") return json(405, origin, { ok: false, error: "method_not_allowed" });
    const declaredLength = Number(request.headers.get("content-length") || 0);
    if (declaredLength > MAX_AVATAR_BYTES + 100_000) {
      throw new ProfileError(413, "payload_too_large", "Profile request is too large.");
    }

    const token = bearer(request);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) throw new ProfileError(401, "invalid_session", "The session is invalid or expired.");

    let form: FormData;
    try { form = await request.formData(); } catch { throw new ProfileError(400, "invalid_form", "Multipart form data is required."); }
    const displayName = validateDisplayName(form.get("displayName"));
    const avatar = form.get("avatar");
    if (avatar !== null && !(avatar instanceof File)) {
      throw new ProfileError(422, "invalid_avatar", "Avatar must be a file.");
    }

    const { data: currentData, error: currentError } = await userClient.rpc("yucang_get_my_profile");
    if (currentError) throw new ProfileError(500, "profile_read_failed", "Unable to read the current profile.");
    const current = firstRow(currentData) as Record<string, unknown> | null;
    const oldAvatarUrl = String(current?.avatar_url || userData.user.user_metadata?.avatar_url || "");
    let avatarUrl = oldAvatarUrl;
    let uploadedPath = "";

    if (avatar && avatar.size > 0) {
      if (avatar.size > MAX_AVATAR_BYTES) throw new ProfileError(413, "avatar_too_large", "Avatar must not exceed 2 MB.");
      const bytes = new Uint8Array(await avatar.arrayBuffer());
      const detected = detectAvatarMime(bytes);
      if (avatar.type && avatar.type !== detected.mime) {
        throw new ProfileError(422, "avatar_mime_mismatch", "Avatar content does not match its declared type.");
      }
      uploadedPath = `${userData.user.id}/avatar.webp`;
      const { error: uploadError } = await adminClient.storage.from(BUCKET).upload(uploadedPath, bytes, {
        contentType: detected.mime,
        cacheControl: "3600",
        upsert: true,
      });
      if (uploadError) throw new ProfileError(500, "avatar_upload_failed", "Unable to store the avatar.");
      avatarUrl = `${adminClient.storage.from(BUCKET).getPublicUrl(uploadedPath).data.publicUrl}?v=${Date.now()}`;
    }

    const { error: profileError } = await userClient.rpc("yucang_update_my_profile", {
      p_nickname: displayName,
      p_avatar_url: avatarUrl,
    });
    if (profileError) {
      if (uploadedPath) await adminClient.storage.from(BUCKET).remove([uploadedPath]);
      throw new ProfileError(422, "profile_update_failed", profileError.message);
    }

    const nextMetadata = {
      ...(userData.user.user_metadata || {}),
      full_name: displayName,
      name: displayName,
      avatar_url: avatarUrl,
    };
    const { error: authError } = await adminClient.auth.admin.updateUserById(userData.user.id, {
      user_metadata: nextMetadata,
    });
    return json(200, origin, {
      ok: true,
      profile: {
        userId: userData.user.id,
        displayName,
        avatarUrl,
        updatedAt: new Date().toISOString(),
      },
      metadataSynced: !authError,
    });
  } catch (error) {
    const item = error instanceof ProfileError
      ? error
      : new ProfileError(500, "internal_error", "Unable to update the account profile.");
    return json(item.status, origin, { ok: false, error: item.code, message: item.message });
  }
});
