import { createClient } from "npm:@supabase/supabase-js@2.111.0";
import {
  corsHeaders,
  email,
  exactObject,
  FRIEND_GROUP_ORIGINS,
  FriendGroupError,
  requiredString,
  shareMedia,
  uuid,
} from "../_shared/yucang-friend-groups.ts";

function json(status: number, origin: string, body: Record<string, unknown>) {
  const allowed = FRIEND_GROUP_ORIGINS.has(origin) ? origin : "https://zaiye.art";
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(allowed), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function bearer(request: Request) {
  const match = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new FriendGroupError(401, "authentication_required", "A signed-in session is required.");
  return match[1];
}

function first(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}

function dbError(error: { message?: string } | null) {
  const message = error?.message || "operation_failed";
  const known = [
    "account_not_available", "group_accounts_not_available", "friend_request_not_found",
    "group_invite_not_found", "group_not_available", "owner_must_close_group",
    "daily_share_limit_reached", "idempotency_conflict", "friend_not_available",
    "member_not_available", "group_member_limit_reached", "group_permission_denied",
    "invalid_share_payload", "invalid_share_request", "invalid_share_target", "forbidden",
  ].find((code) => message.includes(code));
  if (known === "account_not_available" || known === "group_accounts_not_available") {
    return new FriendGroupError(422, "account_not_available", "One or more accounts cannot be used for this action.");
  }
  if (known === "daily_share_limit_reached") return new FriendGroupError(429, known, "The daily free sharing limit has been reached.");
  if (known === "group_member_limit_reached") return new FriendGroupError(409, known, "The group member limit has been reached.");
  if (known === "group_permission_denied") return new FriendGroupError(403, known, "Only the group owner or an administrator can add members.");
  if (known === "member_not_available") return new FriendGroupError(422, known, "One or more accounts cannot be invited.");
  if (known === "idempotency_conflict") return new FriendGroupError(409, known, "The request identifier was already used for different content.");
  if (known === "forbidden") return new FriendGroupError(403, known, "This action requires an administrator account.");
  if (known) return new FriendGroupError(422, known, "The requested operation could not be completed.");
  return new FriendGroupError(500, "operation_failed", "The requested operation could not be completed.");
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin") || "";
  try {
    if (!FRIEND_GROUP_ORIGINS.has(origin)) return json(403, origin, { ok: false, error: "origin_not_allowed" });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (request.method !== "POST") return json(405, origin, { ok: false, error: "method_not_allowed" });
    if (Number(request.headers.get("content-length") || 0) > 15_000_000) throw new FriendGroupError(413, "payload_too_large", "The request is too large.");

    const token = bearer(request);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) throw new FriendGroupError(401, "invalid_session", "The session is invalid or expired.");

    let raw: unknown;
    try { raw = await request.json(); } catch { throw new FriendGroupError(400, "invalid_json", "Valid JSON is required."); }
    const base = exactObject(raw, ["action", "requestId", "email", "friendRequestId", "accept", "friendUserId", "name", "memberEmails", "groupId", "friendUserIds", "friendAccountIds", "emails", "limit", "share"]);
    const action = requiredString(base.action, "invalid_action", 40);
    const requestId = uuid(base.requestId, "invalid_request_id");
    let data: unknown;
    let error: { message?: string } | null = null;

    if (action === "request_friend") {
      const result = await adminClient.rpc("yucang_request_friend_by_email", { p_requester_id: userData.user.id, p_email: email(base.email) });
      data = first(result.data); error = result.error;
    } else if (action === "respond_friend") {
      if (typeof base.accept !== "boolean") throw new FriendGroupError(422, "invalid_accept", "Accept must be a boolean.");
      const result = await userClient.rpc("yucang_respond_friend_request", { p_request_id: uuid(base.friendRequestId, "invalid_friend_request_id"), p_accept: base.accept });
      data = { status: result.data }; error = result.error;
    } else if (action === "remove_friend") {
      const result = await userClient.rpc("yucang_remove_friend", { p_friend_user_id: uuid(base.friendUserId, "invalid_friend_user_id") });
      data = { removed: result.data }; error = result.error;
    } else if (action === "list_friends") {
      const result = await userClient.rpc("yucang_list_my_friendships"); data = result.data; error = result.error;
    } else if (action === "create_group") {
      if (!Array.isArray(base.memberEmails) || base.memberEmails.length < 2 || base.memberEmails.length > 49) {
        throw new FriendGroupError(422, "invalid_group_members", "A group needs at least two invited accounts.");
      }
      const memberEmails = base.memberEmails.map(email);
      const result = await adminClient.rpc("yucang_create_group_by_emails", {
        p_owner_id: userData.user.id,
        p_name: requiredString(base.name, "invalid_group_name", 40),
        p_emails: memberEmails,
      });
      data = first(result.data); error = result.error;
    } else if (action === "respond_group_invite") {
      if (typeof base.accept !== "boolean") throw new FriendGroupError(422, "invalid_accept", "Accept must be a boolean.");
      const result = await userClient.rpc("yucang_respond_group_invite", { p_group_id: uuid(base.groupId, "invalid_group_id"), p_accept: base.accept });
      data = { status: result.data }; error = result.error;
    } else if (action === "add_group_members" || action === "invite_group_members") {
      const rawFriendUserIds = base.friendUserIds ?? base.friendAccountIds;
      const rawMemberEmails = base.memberEmails ?? base.emails;
      if (!Array.isArray(rawFriendUserIds) || !Array.isArray(rawMemberEmails)) {
        throw new FriendGroupError(422, "invalid_group_members", "Friend account IDs and emails must be arrays.");
      }
      if (rawFriendUserIds.length + rawMemberEmails.length < 1 || rawFriendUserIds.length + rawMemberEmails.length > 49) {
        throw new FriendGroupError(422, "invalid_group_members", "Invite between 1 and 49 accounts at a time.");
      }
      const friendAccountIds = rawFriendUserIds.map((item) => uuid(item, "invalid_friend_user_id"));
      const emails = rawMemberEmails.map(email);
      const result = await adminClient.rpc("yucang_invite_group_members_by_accounts", {
        p_actor_id: userData.user.id,
        p_request_id: requestId,
        p_group_id: uuid(base.groupId, "invalid_group_id"),
        p_friend_account_ids: friendAccountIds,
        p_emails: emails,
      });
      data = result.data; error = result.error;
    } else if (action === "leave_group" || action === "close_group") {
      const rpc = action === "leave_group" ? "yucang_leave_group" : "yucang_close_group";
      const result = await userClient.rpc(rpc, { p_group_id: uuid(base.groupId, "invalid_group_id") });
      data = { changed: result.data }; error = result.error;
    } else if (action === "list_groups") {
      const result = await userClient.rpc("yucang_list_my_groups"); data = result.data; error = result.error;
    } else if (action === "list_group_members") {
      const result = await userClient.rpc("yucang_list_group_members", { p_group_id: uuid(base.groupId, "invalid_group_id") });
      data = result.data; error = result.error;
    } else if (action === "list_received" || action === "list_sent" || action === "list_feedback_inbox") {
      const limit = Number(base.limit ?? 50);
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new FriendGroupError(422, "invalid_limit", "Limit must be between 1 and 100.");
      const rpc = action === "list_received"
        ? "yucang_list_received_prompt_shares"
        : action === "list_sent"
          ? "yucang_list_sent_prompt_shares"
          : "yucang_list_admin_feedback_inbox";
      const result = await userClient.rpc(rpc, { p_limit: limit }); data = result.data; error = result.error;
    } else if (action === "share_prompt") {
      const share = exactObject(base.share, ["targetKind", "targetId", "title", "prompt", "project", "category", "contentType", "tags", "variables", "model", "modelVersion", "parameters", "license", "negativePrompt", "usageInstruction", "sourceItemId", "image", "examples", "references"]);
      const media = shareMedia(share);
      const result = await userClient.rpc("yucang_share_prompt", {
        p_request_id: requestId,
        p_target_kind: requiredString(share.targetKind, "invalid_share_target", 10),
        p_target_id: uuid(share.targetId, "invalid_target_id"),
        p_title: requiredString(share.title, "invalid_title", 200),
        p_prompt_text: requiredString(share.prompt, "invalid_prompt", 100000),
        p_project: typeof share.project === "string" ? share.project : "",
        p_category: typeof share.category === "string" ? share.category : "",
        p_content_type: typeof share.contentType === "string" ? share.contentType : "prompt",
        p_tags: Array.isArray(share.tags) ? share.tags : [],
        p_variables: Array.isArray(share.variables) ? share.variables : [],
        p_model_name: typeof share.model === "string" ? share.model : "",
        p_model_version: typeof share.modelVersion === "string" ? share.modelVersion : "",
        p_parameters: share.parameters && typeof share.parameters === "object" && !Array.isArray(share.parameters) ? share.parameters : {},
        p_license_code: typeof share.license === "string" ? share.license : "",
        p_negative_prompt: typeof share.negativePrompt === "string" ? share.negativePrompt : "",
        p_usage_instruction: typeof share.usageInstruction === "string" ? share.usageInstruction : "",
        p_source_item_id: typeof share.sourceItemId === "string" ? share.sourceItemId : "",
        p_image: media.image,
        p_examples: media.examples,
        p_references: media.references,
      });
      data = first(result.data); error = result.error;
    } else {
      throw new FriendGroupError(422, "unsupported_action", "The action is not supported.");
    }
    if (error) throw dbError(error);
    const entitlementResult = await userClient.rpc("yucang_get_collaboration_entitlement");
    if (entitlementResult.error) throw dbError(entitlementResult.error);
    return json(200, origin, { ok: true, requestId, data, entitlement: first(entitlementResult.data) });
  } catch (error) {
    const item = error instanceof FriendGroupError ? error : new FriendGroupError(500, "internal_error", "The request could not be completed.");
    return json(item.status, origin, { ok: false, error: item.code, message: item.message });
  }
});

