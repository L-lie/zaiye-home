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
const openPublishingMigration = readFileSync(join(root, "supabase/migrations/20260826000300_yucang_open_publishing.sql"), "utf8");
const app = readFileSync(join(root, "yucang/app.js"), "utf8");
const appCss = readFileSync(join(root, "yucang/app.css"), "utf8");
const html = readFileSync(join(root, "yucang/index.html"), "utf8");
const loginExperience = readFileSync(join(root, "auth/login-experience.js"), "utf8");
const resources = JSON.parse(readFileSync(join(root, "prompt-vault-resources.json"), "utf8"));

assert(app.includes("确认并立即发布"), "frozen preview must publish immediately after confirmation");
assert(app.includes("进入公开提示词库"), "successful publication must report public visibility");
assert(!app.includes("我确认以上全部内容将作为冻结的待审核版本提交"), "manual-review confirmation copy must be removed");

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
assert.match(migration, /update public\.yucang_works set\s+current_public_version_id = version_row\.id/, "atomic current pointer switch is missing");
assert(migration.includes("'authorNickname', p_version.author_nickname"), "author nickname is not frozen into the version snapshot");
assert(migration.includes("revoke all on public.yucang_versions from anon, authenticated"), "base-table DML/reads were not revoked");
assert(!migration.includes("service_role"), "migration must not expose or depend on service_role");
assert(!migration.includes("publish_portfolio"), "Yucang must not reuse mutable portfolio publication");
assert.match(openPublishingMigration, /auth\.uid\(\) is not null and p_user_id = auth\.uid\(\)/);
assert.match(openPublishingMigration, /after insert on auth\.users/);
assert.match(openPublishingMigration, /insert into public\.yucang_creator_profiles/);
assert.doesNotMatch(app, /INVITE ONLY/);
assert.match(app, /所有登录用户都可以创建和提交免费 Prompt/);

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
  const appRpc = rpc === "yucang_create_work" || rpc === "yucang_update_draft" ? `${rpc}_v2` : rpc;
  assert(app.includes(`"${appRpc}"`), `web app does not call ${appRpc}`);
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
assert.equal(resources.items.length, 36, "official prompt library must contain 36 real resources");
assert.deepEqual(
  [...new Set(resources.items.map((item) => item.category))].sort(),
  ["coding", "image", "office", "video", "writing"],
);
assert.match(app, /fetch\("\.\.\/prompt-vault-resources\.json"/);
assert.match(app, /data-resource-search/);
assert.match(app, /resource-card-image/);
assert.match(app, /item\.featuredImage/);
assert.match(app, /收藏进 Prompt Vault 扩展/);
const resourceCardSource = app.slice(app.indexOf("function renderResourceCard"), app.indexOf("function bindResourceLibrary"));
assert.match(resourceCardSource, /class="resource-like"/);
assert.match(resourceCardSource, /data-like-resource/);
assert.match(resourceCardSource, /yucang_toggle_like/);
assert.match(resourceCardSource, /event\.stopPropagation\(\)/);
assert.doesNotMatch(resourceCardSource, /item\.model/);
assert.doesNotMatch(resourceCardSource, /<strong>\$\{tr\("打开"/);
assert.match(html, /id="accountDrawer" class="account-drawer"/);
assert.match(html, /class="app-workspace"[\s\S]*id="app"[\s\S]*id="accountDrawer"/);
assert.match(app, /data-account-drawer-toggle/);
assert.match(app, /function setAccountDrawer\(open\)/);
assert.match(app, /function renderAccountDrawer\(\)/);
assert.match(app, /history\.replaceState\(null, "", `\$\{location\.pathname\}\$\{location\.search\}#\/home`\)/);
assert.match(app, /document\.querySelectorAll\("\.main-nav a"\)[\s\S]*setAccountDrawer\(false\)/);
assert.match(app, /account-drawer-nav/);
assert.match(app, /href="#\/my-publications"/);
assert.match(app, /href="#\/ai-service"/);
assert.match(app, /data-account-drawer-close/);
assert.match(app, /section === "my"/);
assert.match(app, /section === "my"[\s\S]*setAccountDrawer\(false\)/);
assert.doesNotMatch(html, /data-nav="ai-service"/);
assert.doesNotMatch(html, /data-creator-link/);
assert.match(app, /window\.open\("\.\.\/prompt-vault\.html"/);
assert.match(appCss, /\.route-discover \.app-main \{ width: min\(1640px/);
assert.match(appCss, /\.resource-grid \{ display: grid; grid-template-columns: repeat\(5/);
assert.match(appCss, /\.prompt-output \{[^}]*background: #efebe0/);
assert.match(app, /class="handoff-back-nav"/);
assert.match(appCss, /@media \(max-width: 1450px\)[\s\S]*repeat\(4/);
assert.match(appCss, /@media \(max-width: 1120px\)[\s\S]*repeat\(3/);
assert.match(app, /resource-detail-overview\$\{item\.featuredImage \? " has-image" : ""\}/);
assert.match(app, /<div class="resource-detail-left">[\s\S]*?resource-featured-image[\s\S]*?resource-variable-panel[\s\S]*?<div class="resource-detail-right">[\s\S]*?resource-detail-copy[\s\S]*?<aside class="prompt-stage">/,
  "the image and variables must stack on the left while details and final Prompt stack on the right");
assert.match(appCss, /\.resource-detail-overview \{[^}]*grid-template-columns: minmax\(280px, \.9fr\) minmax\(420px, 1\.1fr\)/);
assert.match(appCss, /\.resource-detail-left, \.resource-detail-right \{[^}]*display: grid;/);
assert.doesNotMatch(appCss, /\.resource-featured-image \{[^}]*position:\s*sticky/);
assert.doesNotMatch(appCss, /body\.account-drawer-open \{[^}]*padding-right/);
assert.doesNotMatch(appCss, /\.route-home\.account-drawer-open \.app-header/);
assert.match(appCss, /\.app-workspace \{[^}]*grid-template-columns: minmax\(0, 1fr\) 0/);
assert.match(appCss, /\.account-drawer-open \.app-workspace \{[^}]*grid-template-columns: minmax\(0, 1fr\) var\(--account-drawer-width\)/);
assert.match(appCss, /\.account-drawer \{[^}]*position: sticky/);
assert.match(appCss, /\.resource-detail-head h1 \{[^}]*font-size: clamp\(30px, 3vw, 46px\)/);
assert.match(appCss, /\.resource-prompt-output \{[^}]*max-height: none;[^}]*overflow: visible;/);
assert.match(appCss, /@media \(max-width: 860px\)[\s\S]*\.resource-featured-image \{ order: 1; \}[\s\S]*\.resource-detail-copy \{ order: 2; \}[\s\S]*\.resource-variable-panel \{ order: 3; \}[\s\S]*\.prompt-stage \{ order: 4; \}/);
assert.match(app, /bindPromptTool/);
assert.match(app, /image: publicAssetUrl\(item\.featuredImage\)/);
assert.match(app, /app\.querySelector\("\[data-final-prompt\]"\)\?\.textContent/);
assert.match(app, /HOME_FEATURED_ART/);
const featuredPromptIds = [...app.matchAll(/src: "assets\/featured\/[^"]+", promptId: "([^"]+)"/g)].map((match) => match[1]);
assert.equal(featuredPromptIds.length, 12, "homepage must link all 12 featured images");
assert.equal(new Set(featuredPromptIds).size, 12, "each homepage image must link to its own Prompt");
for (const promptId of featuredPromptIds) {
  const resource = resources.items.find((item) => item.id === promptId);
  assert(resource, `missing featured Prompt ${promptId}`);
  assert(resource.featuredImage, `featured Prompt ${promptId} must show its matching image`);
}
assert.match(app, /bindHomeOrbit/);
assert.match(app, /bindTextFigure/);
assert.match(app, /navigator\.language/);
assert.match(app, /yucangLocale/);
assert.match(app, /data-locale-toggle/);
assert.match(app, /home-login-layer/);
assert.match(app, /loginExperienceMarkup/);
assert.match(app, /loginControlsMarkup\(\{ assetRoot: "\.\.", showStatus: true \}\)/);
assert.match(loginExperience, /id="loginPolicyConsent" type="checkbox"/);
assert.match(loginExperience, /data-login-action disabled/);
assert.match(loginExperience, /export function bindLoginConsent/);
assert.match(loginExperience, /action\.disabled = !allowed\(\) \|\| busyActions\.has\(action\)/);
assert.match(loginExperience, /checkbox\?\.addEventListener\("change", refresh\)/);
assert.match(app, /const loginConsent = bindLoginConsent\(root\)/);
assert.match(app, /if \(!loginConsent\.allowed\(\)\)/);
assert.match(loginExperience, /data-last-used-method="github"/);
assert.match(loginExperience, /data-last-used-method="google"/);
assert.match(loginExperience, /data-last-used-method="email"/);
assert.match(loginExperience, /export function applyLastLoginHint/);
assert.match(app, /localStorage\.getItem\(lastAuthEmailKey\)/);
assert.match(app, /localStorage\.setItem\(lastAuthEmailKey, normalizedEmail\)/);
assert.match(app, /sessionStorage\.setItem\(pendingAuthMethodKey, button\.dataset\.oauth\)/);
assert.match(app, /sessionStorage\.removeItem\(pendingAuthMethodKey\)/);
assert.doesNotMatch(app, /localStorage\.setItem\("yucangLastAuthMethod", button\.dataset\.oauth\)/);
assert.match(app, /options: \{ redirectTo: `\$\{location\.origin\}\$\{location\.pathname\}` \}/);
assert.doesNotMatch(app, /redirectTo:[^\n]*#\//);
assert.match(app, /oauthReturnPath = postLoginPath\(\)/);
assert.match(app, /history\.replaceState\(null, "", `\$\{location\.pathname\}\$\{location\.search\}#\/\$\{oauthReturnPath/);
assert.match(app, /发送太频繁，请等待 60 秒后再试/);
assert.match(app, /验证码已发送，请在下方输入/);
assert.match(appCss, /\.toast \{[^}]*z-index: 150/);
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
assert.match(readFileSync(join(root, "index.html"), "utf8"), /href="yucang\/\?release=[^"]+#\/home"/);
assert.match(readFileSync(join(root, "prompt-vault.html"), "utf8"), /href="yucang\/\?release=[^"]+#\/home"/);
assert.deepEqual(parseKeyValueLines("aspect_ratio=16:9\nseed：42\ninvalid"), { aspect_ratio: "16:9", seed: "42" });
assert.deepEqual(parseTags("电影感，角色设计,电影感"), ["电影感", "角色设计"]);
assert.deepEqual(normalizeVariables([{ name: "主体", default: "人物" }, { name: "主体", default: "重复" }]), [
  { name: "主体", defaultValue: "人物", description: "" },
]);

console.log("Yucang Slice 1 contract and core tests passed.");
