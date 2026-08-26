import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import {
  HandoffError,
  sha256Hex,
  stableStringify,
  validateHandoffBody,
  YUCANG_WEB_ORIGIN,
} from "../_shared/yucang-publish-handoff.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": YUCANG_WEB_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function bearer(request: Request) {
  const match = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new HandoffError(401, "authentication_required", "A signed-in website session is required.");
  return match[1];
}

Deno.serve(async (request) => {
  let requestId = "";
  try {
    const origin = request.headers.get("origin");
    if (origin !== YUCANG_WEB_ORIGIN) return json(403, { ok: false, error: "origin_not_allowed" });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });
    const declaredLength = Number(request.headers.get("content-length") || 0);
    if (declaredLength > 14_500_000) throw new HandoffError(413, "payload_too_large", "Request body is too large.");
    const raw = await request.text();
    if (raw.length > 14_500_000) throw new HandoffError(413, "payload_too_large", "Request body is too large.");
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { throw new HandoffError(400, "invalid_json", "Request body must be valid JSON."); }
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && typeof (parsed as Record<string, unknown>).requestId === "string") {
      requestId = String((parsed as Record<string, unknown>).requestId);
    }
    const input = await validateHandoffBody(parsed);
    const token = bearer(request);
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await client.auth.getUser(token);
    if (userError || !userData.user) throw new HandoffError(401, "invalid_session", "The website session is invalid or expired.");
    const draftPayloadHash = await sha256Hex(stableStringify(input.content));
    const { data, error } = await client.rpc("yucang_create_draft_from_handoff", {
      p_request_id: input.requestId,
      p_handoff_id: input.handoffId,
      p_payload_hash: draftPayloadHash,
      p_target_work_id: input.targetWorkId,
      p_content: input.content,
    });
    if (error) {
      const known = ["creator_required", "creator_profile_required", "idempotency_conflict", "open_version_exists", "target_work_not_found", "rate_limited"]
        .find((code) => error.message.includes(code));
      const status = known === "creator_required" || known === "creator_profile_required" ? 403 : known === "rate_limited" ? 429 : 409;
      throw new HandoffError(status, known || "draft_creation_failed", known || "Draft creation failed.");
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new HandoffError(500, "draft_creation_failed", "Draft creation returned no result.");
    if (input.media.length) {
      const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const manifest = [];
      for (const media of input.media) {
        const storagePath = `${userData.user.id}/${input.handoffId}/${media.position}.${media.extension}`;
        const { error: uploadError } = await admin.storage
          .from("yucang-publication-media")
          .upload(storagePath, media.bytes, { contentType: media.mimeType, upsert: true, cacheControl: "3600" });
        if (uploadError) throw new HandoffError(500, "media_upload_failed", "Unable to store publication media.");
        manifest.push({
          version_id: row.version_id,
          author_id: userData.user.id,
          storage_path: storagePath,
          mime_type: media.mimeType,
          byte_size: media.byteSize,
          position: media.position,
        });
      }
      const { data: attachedCount, error: manifestError } = await admin.rpc("yucang_attach_version_media", {
        p_author_id: userData.user.id,
        p_version_id: row.version_id,
        p_manifest: manifest.map(({ version_id: _versionId, author_id: _authorId, ...item }) => item),
      });
      if (manifestError || Number(attachedCount) !== manifest.length) {
        console.error("publication media manifest failed", {
          code: manifestError?.code || "count_mismatch",
          details: manifestError?.details || "",
          expected: manifest.length,
          actual: Number(attachedCount),
        });
        await admin.storage.from("yucang-publication-media").remove(manifest.map((item) => item.storage_path));
        throw new HandoffError(500, "media_manifest_failed", "Unable to attach publication media.");
      }
    }
    const status = row.result_status === "already_created" ? "already_created" : "created";
    return json(status === "created" ? 201 : 200, {
      ok: true,
      status,
      requestId: input.requestId,
      handoffId: input.handoffId,
      workId: row.work_id,
      versionId: row.version_id,
      revision: Number(row.revision || 1),
      mediaCount: input.media.length,
      originKind: "vault_handoff",
      nextUrl: `/yucang/#/publish/${row.version_id}`,
    });
  } catch (error) {
    const item = error instanceof HandoffError ? error : new HandoffError(500, "internal_error", "Unable to create the publication draft.");
    return json(item.status, { ok: false, error: item.code, message: item.message, ...(requestId ? { requestId } : {}) });
  }
});
