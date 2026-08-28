import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/20260827000400_yucang_friend_group_sharing.sql"), "utf8");
const sentMigration = fs.readFileSync(path.join(root, "supabase/migrations/20260828000200_yucang_list_sent_prompt_shares.sql"), "utf8");
const feedbackInboxMigration = fs.readFileSync(path.join(root, "supabase/migrations/20260828000300_yucang_feedback_owner_inbox.sql"), "utf8");
const addMembersMigration = fs.readFileSync(path.join(root, "supabase/migrations/20260828000600_yucang_group_add_members.sql"), "utf8");
const shareMediaMigration = fs.readFileSync(path.join(root, "supabase/migrations/20260828000900_yucang_prompt_share_media.sql"), "utf8");
const shared = fs.readFileSync(path.join(root, "supabase/functions/_shared/yucang-friend-groups.ts"), "utf8");
const fn = fs.readFileSync(path.join(root, "supabase/functions/yucang-friend-groups/index.ts"), "utf8");

assert.match(migration, /function public\.yucang_request_friend_by_email\(/);
assert.match(migration, /where lower\(email\) = normalized_email limit 1/);
assert.match(migration, /account_not_available/);
assert.match(migration, /grant execute on function public\.yucang_request_friend_by_email\(uuid, text\) to service_role/);
assert.doesNotMatch(migration, /^grant execute on function public\.yucang_request_friend_by_email\(uuid, text\) to authenticated;$/m);
assert.match(migration, /function public\.yucang_create_group_by_emails\(/);
assert.match(migration, /cardinality\(coalesce\(normalized_emails[\s\S]*< 2/);
assert.match(migration, /group_accounts_not_available/);
assert.match(migration, /active_count >= 3 then 'active' else 'forming'/);
assert.match(migration, /daily_share_limit_reached/);
assert.match(migration, /unique \(sender_id, request_id\)/);
assert.match(migration, /yucang_group_membership_periods/);

for (const origin of [
  "https://zaiye.art",
  "chrome-extension://fapladhajicfoiadhcpmbmfkodekkckg",
  "chrome-extension://idiemjhonlahnlnalpanhplbgjcfbpnl",
]) assert.match(shared, new RegExp(origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.doesNotMatch(shared, /chrome-extension:\/\/\*/);
assert.match(fn, /auth\.getUser\(token\)/);
assert.match(fn, /action === "request_friend"/);
assert.match(fn, /action === "create_group"/);
assert.match(fn, /action === "add_group_members" \|\| action === "invite_group_members"/);
assert.match(fn, /base\.friendUserIds \?\? base\.friendAccountIds/);
assert.match(fn, /base\.memberEmails \?\? base\.emails/);
assert.match(fn, /"yucang_invite_group_members_by_accounts"/);
assert.match(fn, /p_friend_account_ids: friendAccountIds/);
assert.match(fn, /p_emails: emails/);
assert.match(fn, /action === "share_prompt"/);
assert.match(fn, /"image", "examples", "references"/);
assert.match(fn, /const media = shareMedia\(share\)/);
assert.match(fn, /p_image: media\.image/);
assert.match(fn, /15_000_000/);
assert.match(fn, /p_examples: media\.examples/);
assert.match(fn, /p_references: media\.references/);
assert.match(fn, /action === "list_received"/);
assert.match(fn, /action === "list_received" \|\| action === "list_sent"/);
assert.match(fn, /"yucang_list_sent_prompt_shares"/);
assert.match(fn, /action === "list_feedback_inbox"/);
assert.match(fn, /"yucang_list_admin_feedback_inbox"/);
assert.match(fn, /"yucang_get_collaboration_entitlement"/);
assert.match(fn, /entitlement: first\(entitlementResult\.data\)/);
assert.match(fn, /"account_not_available"/);
assert.match(fn, /return new FriendGroupError\(429, known/);
assert.match(fn, /return new FriendGroupError\(409, known/);
assert.match(fn, /return new FriendGroupError\(403, known/);
assert.doesNotMatch(fn, /listUsers|searchUsers/);
assert.doesNotMatch(fn, /private_notebooks|chrome\.storage|cloud.?sync/i);

assert.match(sentMigration, /function public\.yucang_list_sent_prompt_shares\(p_limit integer default 50\)/);
assert.match(sentMigration, /from public\.profiles profile\s+where profile\.site_role = 'owner'/);
assert.match(sentMigration, /on conflict \(user_id, role\) do update/);
assert.match(sentMigration, /where shared\.sender_id = caller/);
assert.match(sentMigration, /least\(greatest\(coalesce\(p_limit, 50\), 1\), 100\)/);
assert.match(sentMigration, /grant execute on function public\.yucang_list_sent_prompt_shares\(integer\) to authenticated/);
assert.match(sentMigration, /function public\.yucang_get_collaboration_entitlement\(\)/);
assert.match(feedbackInboxMigration, /function public\.yucang_list_admin_feedback_inbox\(p_limit integer default 50\)/);
assert.match(feedbackInboxMigration, /private\.yucang_has_staff_role\('admin', caller\)/);
assert.match(feedbackInboxMigration, /'feedback'::text/);
assert.match(feedbackInboxMigration, /from public\.yucang_feedback feedback/);
assert.match(feedbackInboxMigration, /grant execute on function public\.yucang_list_admin_feedback_inbox\(integer\) to authenticated/);
assert.doesNotMatch(feedbackInboxMigration, /private_notebooks|prompt_text|clipboard|browsing_history/i);
assert.match(sentMigration, /private\.yucang_has_staff_role\('admin', caller\)/);
assert.match(sentMigration, /unlimited_sharing := privileged or paid_member/);
assert.match(sentMigration, /if not unlimited_sharing and used_today >= 3 then raise exception 'daily_share_limit_reached'/);
assert.match(sentMigration, /remaining_free_shares := case when unlimited_sharing then null/);
assert.doesNotMatch(sentMigration, /@|gmail|qq\.com|163\.com/i);
assert.doesNotMatch(sentMigration, /private_notebooks|chrome\.storage|cloud.?sync/i);

assert.match(addMembersMigration, /function public\.yucang_invite_group_members_by_accounts\(/);
assert.match(addMembersMigration, /group_row\.owner_id <> p_actor_id and not is_admin/);
assert.match(addMembersMigration, /friendship\.status = 'accepted'/);
assert.match(addMembersMigration, /where lower\(user_row\.email\) = any\(normalized_emails\)/);
assert.match(addMembersMigration, /raise exception 'member_not_available'/);
assert.match(addMembersMigration, /reserved_count \+ new_count > 50/);
assert.match(addMembersMigration, /primary key \(actor_id, request_id\)/);
assert.match(addMembersMigration, /pg_advisory_xact_lock/);
assert.match(addMembersMigration, /if receipt_row\.request_hash <> request_hash then raise exception 'idempotency_conflict'/);
assert.match(addMembersMigration, /status = 'invited'/);
assert.match(addMembersMigration, /grant execute on function public\.yucang_invite_group_members_by_accounts[\s\S]*to service_role/);
assert.doesNotMatch(addMembersMigration, /grant execute[\s\S]*to authenticated/);
assert.doesNotMatch(addMembersMigration, /private_notebooks|prompt_text|chrome\.storage|cloud.?sync/i);

assert.match(shared, /export function shareMedia/);
assert.match(shared, /png\|jpeg\|webp/);
assert.match(shared, /must contain real image bytes matching its MIME type/);
assert.match(shared, /SHARE_MEDIA_ITEM_LIMIT = 4/);
assert.match(shared, /SHARE_MEDIA_TOTAL_BYTES = 10 \* 1024 \* 1024/);
assert.match(shareMediaMigration, /add column if not exists image text/);
assert.match(shareMediaMigration, /add column if not exists examples jsonb/);
assert.match(shareMediaMigration, /add column if not exists reference_images jsonb/);
assert.match(shareMediaMigration, /private\.yucang_share_image_is_safe/);
assert.match(shareMediaMigration, /'image', clean_image/);
assert.match(shareMediaMigration, /shared\.image, shared\.examples, shared\.reference_images/);
assert.match(shareMediaMigration, /where auth\.uid\(\) is not null/);
assert.match(shareMediaMigration, /where shared\.sender_id = caller/);
assert.doesNotMatch(shareMediaMigration, /private_notebooks|chrome\.storage|cloud.?sync/i);

console.log("Yucang friend/group endpoint contract tests passed.");
