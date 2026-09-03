import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(root, path), "utf8");
const app = read("yucang/app.js");
const css = read("yucang/app.css");
const html = read("yucang/index.html");
const sql = read("supabase/migrations/20260903000300_yucang_mvp_library_accounts.sql");

for (const token of [
  "yucang_resource_favorites",
  "yucang_list_my_favorites",
  "yucang_toggle_favorite",
  "yucang_update_creator_settings",
  "yucang_list_public_creators",
  "yucang_list_public_versions",
  "yucang_get_public_work_version",
]) assert.match(sql, new RegExp(token), `missing ${token}`);

assert.match(sql, /where favorite\.user_id = auth\.uid\(\)/);
assert.match(sql, /and \(creator\.is_public or creator\.user_id = auth\.uid\(\)\)/);
assert.match(sql, /case when creator\.is_public or creator\.user_id = auth\.uid\(\) then creator\.slug else null end/);
assert.match(sql, /version\.status = 'approved'[\s\S]*version\.was_public[\s\S]*work\.status = 'active'/);
assert.match(sql, /grant execute on function public\.yucang_toggle_favorite\(text\) to authenticated/);
assert.doesNotMatch(sql, /grant execute on function public\.yucang_toggle_favorite\(text\) to anon/);
assert.match(sql, /negative_prompt_text text/);
assert.match(sql, /parameters jsonb, dependencies jsonb/);
assert.match(sql, /license_code text, instructions text/);
assert.doesNotMatch(sql, /private_notebooks|prompt_vault_account_backups|chrome\.storage/i);

for (const token of [
  "#/favorites",
  "#/account",
  "data-favorite-resource",
  "renderFavorites",
  "renderAccountPrivacy",
  "管理公开范围",
  "公开版本",
  "#/category/",
  "#/search/",
  "licenseRightsMarkup",
  "发布说明",
]) assert.match(app + html, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `missing UI token ${token}`);

assert.match(app, /childId === "version" \? detailId/);
assert.match(app, /\["writing", "office"\]\.includes\(item\.category\)/);
assert.match(css, /@media \(hover: none\)[\s\S]*\.resource-hover-tools/);
assert.match(css, /\.account-settings-layout/);
assert.doesNotMatch(html, /href="#\/creators"/);
assert.doesNotMatch(app, /async function renderCreators/);
assert.match(app, /section === "creators"[\s\S]*?#\/discover[\s\S]*?renderDiscover\(\)/);
assert.match(css, /:root\[data-theme="light"\] \.locale-toggle \{ background: rgba\(255,250,240,\.82\); \}/);
assert.match(css, /:root\[data-theme="light"\] \.account-drawer-nav a \{ background: rgba\(255,250,240,\.72\); \}/);
assert.match(html, /app\.js\?v=20260903-mvp4/);
assert.match(html, /app\.css\?v=20260903-mvp4/);

console.log("Yucang remaining free-community MVP surface checks passed.");
