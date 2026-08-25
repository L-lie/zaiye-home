import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  normalizeVariables,
  parseKeyValueLines,
  parseTags,
  renderPromptTemplate,
} from "../yucang/core.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migration = readFileSync(join(root, "supabase/migrations/20260825000100_yucang_slice1.sql"), "utf8");
const app = readFileSync(join(root, "yucang/app.js"), "utf8");
const html = readFileSync(join(root, "yucang/index.html"), "utf8");
const resources = JSON.parse(readFileSync(join(root, "prompt-vault-resources.json"), "utf8"));

const requiredTables = [
  "yucang_creator_profiles",
  "yucang_creator_grants",
  "yucang_staff_roles",
  "yucang_works",
  "yucang_versions",
  "yucang_review_submissions",
  "yucang_review_actions",
  "yucang_audit_events",
];
for (const table of requiredTables) {
  assert.match(migration, new RegExp(`create table public\\.${table}\\b`), `missing ${table}`);
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`), `RLS missing for ${table}`);
}

for (const status of ["draft", "pending_review", "changes_requested", "rejected", "approved"]) {
  assert(migration.includes(`'${status}'`), `missing version status ${status}`);
}
for (const status of ["active", "withdrawn", "restricted"]) {
  assert(migration.includes(`'${status}'`), `missing work status ${status}`);
}

assert(migration.includes("yucang_one_open_version_per_work"), "single open version index is missing");
assert(migration.includes("where status in ('draft', 'pending_review', 'changes_requested')"), "open-version predicate is incomplete");
assert(migration.includes("only an open draft may change version content"), "pending/approved content guard is missing");
assert(migration.includes("approved status is immutable"), "approved status guard is missing");
assert(migration.includes("current public version must be an approved public version of the same work"), "current pointer guard is missing");
assert(migration.includes("frozen submission no longer matches version"), "approval hash/snapshot check is missing");
assert(migration.includes("submission is not the current review attempt"), "stale review attempts are not blocked");
assert(migration.includes("submission already closed"), "closed review attempts are not blocked");
assert(migration.includes("update public.yucang_works set\n      current_public_version_id = version_row.id"), "atomic current pointer switch is missing");
assert(migration.includes("'authorNickname', p_version.author_nickname"), "author nickname is not frozen into the version snapshot");
assert(migration.includes("revoke all on public.yucang_versions from anon, authenticated"), "base-table DML/reads were not revoked");
assert(!migration.includes("service_role"), "migration must not expose or depend on service_role");
assert(!migration.includes("publish_portfolio"), "Yucang must not reuse mutable portfolio publication");

for (const rpc of [
  "yucang_create_work",
  "yucang_update_draft",
  "yucang_prepare_preview",
  "yucang_submit_for_review",
  "yucang_review_submission",
  "yucang_list_public_works",
  "yucang_get_public_work",
]) {
  assert(migration.includes(`function public.${rpc}`), `missing RPC ${rpc}`);
  assert(app.includes(`"${rpc}"`), `web app does not call ${rpc}`);
}

for (const route of ["home", "discover", "login", "prompt", "publish", "preview", "my-publications", "admin"]) {
  assert(app.includes(`section === "${route}"`) || html.includes(`#/${route}`), `missing route ${route}`);
}

assert.equal(
  renderPromptTemplate("一张 {{主体}} 的画面，{{光线}}", [
    { name: "主体", defaultValue: "城堡" },
    { name: "光线", defaultValue: "晨光" },
  ], { 主体: "飞船" }),
  "一张 飞船 的画面，晨光",
);
assert.equal(
  renderPromptTemplate("@主体位于@场景，画幅为@画幅。", [
    { name: "主体", default: "人物" },
    { name: "场景", default: "城市" },
    { name: "画幅", default: "16:9" },
  ], { 主体: "飞船" }),
  "飞船位于城市，画幅为16:9。",
);
assert.equal(resources.items.length, 24, "official prompt library must contain 24 real resources");
assert.deepEqual(
  [...new Set(resources.items.map((item) => item.category))].sort(),
  ["coding", "image", "office", "video", "writing"],
);
assert.match(app, /fetch\("\.\.\/prompt-vault-resources\.json"/);
assert.match(app, /data-resource-search/);
assert.match(app, /bindPromptTool/);
assert.match(app, /HOME_FEATURED_ART/);
assert.match(app, /bindHomeOrbit/);
assert.match(app, /bindTextFigure/);
assert.match(app, /navigator\.language/);
assert.match(app, /yucangLocale/);
assert.match(app, /data-locale-toggle/);
assert.match(app, /home-login-layer/);
assert.match(app, /loginExperienceMarkup/);
for (const asset of [
  "yucang/assets/yucang-text-figure.png",
  "yucang/assets/featured/mushroom-city-1.webp",
  "yucang/assets/featured/mushroom-city-2.webp",
  "yucang/assets/featured/abstract-expression.webp",
  "yucang/assets/featured/knight-medieval.webp",
  "yucang/assets/featured/watercolor-dessert.webp",
  "yucang/assets/featured/embroidered-mountain.webp",
  "yucang/assets/featured/litian-demon.webp",
  "yucang/assets/featured/dark-gothic.webp",
  "yucang/assets/featured/particle-poster.webp",
  "yucang/assets/featured/neon-action.webp",
  "yucang/assets/featured/cosmic-eye.webp",
  "yucang/assets/featured/ink-character.webp",
]) assert(existsSync(join(root, asset)), `missing homepage asset ${asset}`);
assert.match(readFileSync(join(root, "index.html"), "utf8"), /href="yucang\/"/);
assert.match(readFileSync(join(root, "prompt-vault.html"), "utf8"), /href="yucang\/"/);
assert.deepEqual(parseKeyValueLines("aspect_ratio=16:9\nseed：42\ninvalid"), { aspect_ratio: "16:9", seed: "42" });
assert.deepEqual(parseTags("电影感，角色设计,电影感"), ["电影感", "角色设计"]);
assert.deepEqual(normalizeVariables([{ name: "主体", default: "人物" }, { name: "主体", default: "重复" }]), [
  { name: "主体", defaultValue: "人物", description: "" },
]);

console.log("Yucang Slice 1 contract and core tests passed.");
