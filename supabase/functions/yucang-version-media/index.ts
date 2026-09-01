import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const WEB_ORIGIN = "https://zaiye.art";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const corsHeaders = {
  "Access-Control-Allow-Origin": WEB_ORIGIN,
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

Deno.serve(async (request) => {
  try {
    if (request.headers.get("origin") !== WEB_ORIGIN) return json(403, { ok: false, error: "origin_not_allowed" });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });
    const body = await request.json();
    const versionId = typeof body?.versionId === "string" ? body.versionId : "";
    if (!UUID.test(versionId)) return json(422, { ok: false, error: "invalid_version_id" });

    const authorization = request.headers.get("authorization") || "";
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: authorization ? { Authorization: authorization } : {} },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: allowed, error: accessError } = await client.rpc("yucang_can_access_version_media", { p_version_id: versionId });
    if (accessError || allowed !== true) return json(404, { ok: false, error: "media_not_found" });

    const { data: manifest, error: manifestError } = await client.rpc("yucang_get_version_media_manifest", {
      p_version_id: versionId,
    });
    if (manifestError) return json(500, { ok: false, error: "media_lookup_failed" });
    if (!manifest?.length) return json(200, { ok: true, images: [] });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: signed, error: signedError } = await admin.storage
      .from("yucang-publication-media")
      .createSignedUrls(manifest.map((item) => item.storage_path), 3600);
    if (signedError) return json(500, { ok: false, error: "media_signing_failed" });
    return json(200, {
      ok: true,
      images: manifest.map((item, index) => ({
        url: signed[index]?.signedUrl || "",
        mimeType: item.mime_type,
        byteSize: item.byte_size,
        position: item.media_position,
      })).filter((item) => item.url),
    });
  } catch {
    return json(400, { ok: false, error: "invalid_request" });
  }
});
