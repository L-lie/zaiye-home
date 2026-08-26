import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260826000700_yucang_likes_and_admin_controls.sql");
const app = read("yucang/app.js");
const css = read("yucang/app.css");

for (const required of [
  "yucang_resource_likes",
  "primary key (resource_key, user_id)",
  "yucang_get_like_counts",
  "yucang_toggle_like",
  "authentication_required",
  "yucang_admin_set_work_restricted",
  "private.yucang_has_staff_role('admin', caller)",
  "status = case when p_restricted then 'restricted' else 'active' end",
  "yucang_audit_events",
]) assert.ok(migration.includes(required), `migration missing ${required}`);

assert.ok(app.includes('data-like-resource='), "image cards need an independent like control");
assert.ok(app.includes('data-copy-resource='), "image cards need an independent copy control");
assert.ok(app.includes('data-save-to-vault='), "image cards need an independent Vault save control");
assert.ok(app.includes("event.stopPropagation()"), "card tools must not navigate to the detail page");
assert.ok(app.includes("yucang_toggle_like"), "likes must use the database RPC");
assert.ok(app.includes("yucang_admin_set_work_restricted"), "admin restriction must use the database RPC");
assert.ok(css.includes(".resource-hover-tools"));
assert.ok(css.includes(".resource-category-badge"));
assert.match(css, /\.resource-like \{[^}]*top: 10px; right: 10px/);
assert.match(css, /\.resource-hover-tools \{[^}]*opacity: 0/);
assert.match(css, /\.resource-card:hover \.resource-hover-tools/);
assert.match(css, /\.resource-category-badge \{[^}]*background: rgba\(13,14,13,\.58\)/);
const imageCard = app.slice(app.indexOf("function renderResourceCard"), app.indexOf("async function hydrateResourceLikes"));
assert.match(imageCard, /\$\{image \? "" : `<div class="resource-card-copy">/);
assert.match(imageCard, /class="resource-like"[\s\S]*class="resource-hover-tools"/);

console.log("Yucang likes and admin controls contract tests passed.");
