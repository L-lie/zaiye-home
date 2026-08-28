import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../supabase/migrations/20260828000100_yucang_feedback.sql", import.meta.url), "utf8");
const submitFix = await readFile(new URL("../supabase/migrations/20260828000700_yucang_feedback_submit_fix.sql", import.meta.url), "utf8");
const shared = await readFile(new URL("../supabase/functions/_shared/yucang-feedback.ts", import.meta.url), "utf8");
const fn = await readFile(new URL("../supabase/functions/yucang-submit-feedback/index.ts", import.meta.url), "utf8");
const config = await readFile(new URL("../supabase/config.toml", import.meta.url), "utf8");
const executableMigration = migration.replace(/^--.*$/gm, "").replace(/comment on[\s\S]*?;/gi, "");

assert.match(migration, /unique \(author_id, request_id\)/);
assert.match(migration, /created_at >= now\(\) - interval '1 hour'/);
assert.match(migration, />= 10/);
assert.match(migration, /author_id = auth\.uid\(\) or private\.yucang_can_review\(\)/);
assert.match(migration, /idempotency_conflict/);
assert.match(migration, /yucang_list_my_feedback/);
assert.match(migration, /yucang_admin_update_feedback/);
assert.doesNotMatch(executableMigration, /prompt_text|private_notebooks|clipboard|browsing_history/i);
assert.match(submitFix, /feedback\.created_at >= now\(\) - interval '1 hour'/);
assert.match(submitFix, /feedback\.author_id = caller/);
assert.match(submitFix, /feedback\.request_id = p_request_id/);
assert.doesNotMatch(submitFix, /\bwhere author_id = caller\b|\band created_at >=/);

assert.match(shared, /chrome-extension:\/\/fapladhajicfoiadhcpmbmfkodekkckg/);
assert.match(shared, /chrome-extension:\/\/idiemjhonlahnlnalpanhplbgjcfbpnl/);
assert.match(shared, /https:\/\/zaiye\.art/);
assert.match(shared, /new Set\(\["bug", "suggestion", "experience", "other"\]\)/);
assert.match(shared, /Object\.keys\(item\)\.some\(\(key\) => !KEYS\.has\(key\)\)/);
assert.doesNotMatch(shared, /prompt|image|clipboard|history/i);

assert.match(fn, /authentication_required/);
assert.match(fn, /invalid_session/);
assert.match(fn, /payload_too_large/);
assert.match(fn, /rate_limited/);
assert.match(fn, /idempotency_conflict/);
assert.match(fn, /feedback_submission_failed/);
assert.match(fn, /client\.rpc\("yucang_submit_feedback"/);
assert.doesNotMatch(fn, /SUPABASE_SERVICE_ROLE_KEY/);
assert.match(config, /\[functions\.yucang-submit-feedback\]\s+verify_jwt = false/);

console.log("Yucang feedback contract tests passed.");
