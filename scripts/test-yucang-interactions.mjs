import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migration = readFileSync(
  join(root, "supabase/migrations/20260826000400_yucang_interactions.sql"),
  "utf8",
);

for (const table of ["yucang_comments", "yucang_notifications"]) {
  assert.match(migration, new RegExp(`create table public\\.${table}\\b`));
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
  assert.match(migration, new RegExp(`revoke all on public\\.${table} from anon, authenticated`));
}

for (const kind of ["comment", "question", "reply"]) {
  assert(migration.includes(`'${kind}'`), `missing interaction kind ${kind}`);
}
for (const event of ["work_comment", "work_question", "comment_reply", "question_author_reply"]) {
  assert(migration.includes(`'${event}'`), `missing notification event ${event}`);
}

assert.match(migration, /p_kind not in \('comment', 'question', 'reply'\)/);
assert.match(migration, /c\.parent_id is null[\s\S]*c\.kind in \('comment', 'question'\)/);
assert.match(migration, /c\.public_version_id = work_row\.current_public_version_id/);
assert.match(migration, /w\.status = 'active'[\s\S]*v\.status = 'approved'[\s\S]*v\.was_public/);
assert.match(migration, /char_length\(clean_body\) < 1 or char_length\(clean_body\) > 2000/);
assert.match(migration, /pg_advisory_xact_lock/);
assert.match(migration, /created_at >= now\(\) - interval '1 minute'/);
assert.match(migration, />= 10 then[\s\S]*raise exception 'rate_limited'/);
assert.match(migration, /notify_recipient is distinct from caller/);
assert.match(migration, /unique \(event_type, recipient_id, source_comment_id\)/);

assert.match(migration, /grant execute on function public\.yucang_list_comments\(uuid\) to anon, authenticated/);
assert.match(migration, /grant execute on function public\.yucang_create_comment\(uuid, text, text, uuid\) to authenticated/);
assert.doesNotMatch(migration, /grant execute on function public\.yucang_create_comment[^\n]+to anon/);
assert.match(migration, /where n\.recipient_id = caller/);
assert.match(migration, /where id = p_notification_id and recipient_id = caller/);

console.log("Yucang interaction database contract tests passed.");
