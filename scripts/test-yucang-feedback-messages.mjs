import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sql = await readFile(
  new URL("../supabase/migrations/20260828000400_yucang_feedback_messages.sql", import.meta.url),
  "utf8",
);
const digestFix = await readFile(
  new URL("../supabase/migrations/20260828000800_yucang_feedback_message_digest_fix.sql", import.meta.url),
  "utf8",
);

assert.match(sql, /create table if not exists public\.yucang_system_messages/);
assert.match(sql, /message_type in \('feedback_reply', 'broadcast'\)/);
assert.match(sql, /private\.yucang_has_staff_role\('admin', caller\)/g);
assert.match(sql, /message\.recipient_id = caller/);
assert.match(sql, /message\.expires_at is null or message\.expires_at > now\(\)/);
assert.match(sql, /unique \(created_by, request_id\)/);
assert.match(sql, /pg_advisory_xact_lock/);
assert.match(sql, /idempotency_conflict/);
assert.match(sql, /char_length\(clean_body\) < 1 or char_length\(clean_body\) > 2000/);
assert.match(sql, /clean_body ~ '\[<>\]'/);
assert.match(sql, /revoke all on table public\.yucang_system_messages from public, anon, authenticated/);
assert.match(sql, /grant select on table public\.yucang_system_messages to authenticated/);
assert.match(sql, /yucang_admin_reply_feedback/);
assert.match(sql, /yucang_admin_broadcast_system_message/);
assert.match(sql, /yucang_list_my_system_messages/);
assert.match(digestFix, /create or replace function public\.yucang_admin_reply_feedback/);
assert.match(digestFix, /create or replace function public\.yucang_admin_broadcast_system_message/);
assert.equal((digestFix.match(/extensions\.digest\(convert_to\(/g) || []).length, 2);
assert.doesNotMatch(digestFix, /encode\(digest\(/);

console.log("Yucang feedback message contract checks passed.");
