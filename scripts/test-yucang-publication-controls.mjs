import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(root, path), "utf8");
const migration = read("supabase/migrations/20260901000100_yucang_publication_controls.sql");
const app = read("yucang/app.js");
const config = read("supabase/config.toml");
const html = read("yucang/index.html");
const css = read("yucang/app.css");

assert.match(migration, /yucang_set_my_work_public\(p_work_id uuid, p_public boolean\)/);
assert.match(migration, /work_row\.author_id <> caller/);
assert.match(migration, /work_row\.status = 'restricted'/);
assert.match(migration, /yucang_delete_work\(p_work_id uuid, p_reason text default ''\)/);
assert.match(migration, /private\.yucang_has_staff_role\('admin', caller\)/);
assert.match(migration, /deleted_at = now\(\), deleted_by = caller/);
assert.match(migration, /work\.deleted_at is null/);
assert.match(migration, /insert into public\.yucang_audit_events/);
assert.match(migration, /revoke all on function public\.yucang_delete_work/);

assert.match(app, /const items = \[\.\.\.communityItems, \.\.\.officialItems\]/);
assert.doesNotMatch(app, /data-community-shelf/);
assert.match(app, /data-work-visibility="private"/);
assert.match(app, /data-delete-work=/);
assert.match(app, /data-admin-delete=/);
assert.match(app, /CONTENT MANAGEMENT/);
assert.doesNotMatch(app, /data-bootstrap-admin/);
assert.match(app, /community-detail-media/);
assert.match(config, /\[functions\.yucang-version-media\]\s+verify_jwt = false/);
assert.match(html, /data-theme-toggle/);
assert.match(css, /:root\[data-theme="light"\]/);

console.log("Yucang publication controls and unified library checks passed.");
