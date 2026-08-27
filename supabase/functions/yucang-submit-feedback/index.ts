import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import {
  FeedbackError,
  feedbackCorsHeaders,
  feedbackHash,
  validateFeedbackBody,
  YUCANG_FEEDBACK_ORIGINS,
} from "../_shared/yucang-feedback.ts";

function json(status: number, origin: string, body: Record<string, unknown>) {
  const allowed = YUCANG_FEEDBACK_ORIGINS.has(origin) ? origin : "https://zaiye.art";
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...feedbackCorsHeaders(allowed), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function bearer(request: Request) {
  const match = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new FeedbackError(401, "authentication_required", "A signed-in session is required.");
  return match[1];
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin") || "";
  let requestId = "";
  try {
    if (!YUCANG_FEEDBACK_ORIGINS.has(origin)) return json(403, origin, { ok: false, error: "origin_not_allowed" });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: feedbackCorsHeaders(origin) });
    if (request.method !== "POST") return json(405, origin, { ok: false, error: "method_not_allowed" });
    if (Number(request.headers.get("content-length") || 0) > 12_000) {
      throw new FeedbackError(413, "payload_too_large", "Feedback request is too large.");
    }
    const rawText = await request.text();
    if (rawText.length > 12_000) throw new FeedbackError(413, "payload_too_large", "Feedback request is too large.");
    let raw: unknown;
    try { raw = JSON.parse(rawText); } catch { throw new FeedbackError(400, "invalid_json", "Request body must be valid JSON."); }
    const input = validateFeedbackBody(raw);
    requestId = input.requestId;
    const token = bearer(request);
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await client.auth.getUser(token);
    if (userError || !userData.user) throw new FeedbackError(401, "invalid_session", "The session is invalid or expired.");
    const hash = await feedbackHash(input);
    const { data, error } = await client.rpc("yucang_submit_feedback", {
      p_request_id: input.requestId,
      p_payload_hash: hash,
      p_feedback_type: input.type,
      p_title: input.title,
      p_description: input.description,
      p_reproduction_steps: input.reproductionSteps,
      p_expected_result: input.expectedResult,
      p_extension_version: input.extensionVersion,
      p_surface: input.surface,
      p_locale: input.locale,
    });
    if (error) {
      if (error.message.includes("rate_limited")) throw new FeedbackError(429, "rate_limited", "Too many feedback submissions.");
      if (error.message.includes("idempotency_conflict")) throw new FeedbackError(409, "idempotency_conflict", "requestId was already used for different feedback.");
      throw new FeedbackError(500, "feedback_submission_failed", "Unable to save feedback.");
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new FeedbackError(500, "feedback_submission_failed", "Feedback submission returned no result.");
    const status = row.result_status === "already_created" ? "already_created" : "created";
    return json(status === "created" ? 201 : 200, origin, {
      ok: true,
      status,
      requestId: input.requestId,
      feedbackId: row.feedback_id,
      feedbackStatus: row.feedback_status,
    });
  } catch (error) {
    const item = error instanceof FeedbackError
      ? error
      : new FeedbackError(500, "server_error", "Unable to submit feedback.");
    return json(item.status, origin, { ok: false, error: item.code, message: item.message, ...(requestId ? { requestId } : {}) });
  }
});
