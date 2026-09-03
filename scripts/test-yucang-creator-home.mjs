import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const app = readFileSync(join(root, "yucang/app.js"), "utf8");
const html = readFileSync(join(root, "yucang/index.html"), "utf8");
const css = readFileSync(join(root, "yucang/app.css"), "utf8");
const migration = readFileSync(join(root, "supabase/migrations/20260903000100_yucang_public_creator_profiles.sql"), "utf8");

assert.match(html, /localStorage\.getItem\("yucangTheme"\).*home\|login[\s\S]*\? "dark" : "light"/);
assert.match(app, /function applyRouteDefaultTheme\(section\)/);
assert.match(app, /if \(localStorage\.getItem\("yucangTheme"\)\) return/);
assert.match(app, /section === "home" \|\| section === "login" \? "dark" : "light"/);
assert.match(app, /yucang_get_like_counts/);
assert.match(app, /data-home-like-resource="official:/);
assert.match(app, /async function renderCreatorProfile\(creatorSlug\)/);
assert.match(app, /yucang_get_public_creator/);
assert.match(app, /section === "creator" && id/);
assert.match(app, /#\/creator\/\$\{encodeURIComponent\(item\.author_slug\)\}/);
assert.match(css, /\.creator-profile-hero/);
assert.match(css, /@media \(max-width: 860px\)[\s\S]*\.creator-profile-hero \{ grid-template-columns: 1fr/);
assert.match(migration, /security definer/);
assert.match(migration, /work\.status = 'active'/);
assert.match(migration, /work\.deleted_at is null/);
assert.match(migration, /grant execute on function public\.yucang_get_public_creator\(text\) to anon, authenticated/);

console.log("Yucang creator profile, live home likes, and route-theme checks passed.");
