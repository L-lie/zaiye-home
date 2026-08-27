import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/20260827000400_yucang_friend_group_sharing.sql"), "utf8");
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
assert.match(fn, /action === "share_prompt"/);
assert.match(fn, /action === "list_received"/);
assert.match(fn, /"account_not_available"/);
assert.match(fn, /return new FriendGroupError\(429, known/);
assert.match(fn, /return new FriendGroupError\(409, known/);
assert.doesNotMatch(fn, /listUsers|searchUsers/);
assert.doesNotMatch(fn, /private_notebooks|chrome\.storage|cloud.?sync/i);

console.log("Yucang friend/group endpoint contract tests passed.");
