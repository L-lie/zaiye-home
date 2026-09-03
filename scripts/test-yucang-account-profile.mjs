import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  detectAvatarMime,
  MAX_AVATAR_BYTES,
  ProfileError,
  validateDisplayName,
  YUCANG_PROFILE_ORIGINS,
} from "../supabase/functions/_shared/yucang-account-profile.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migration = readFileSync(join(root, "supabase/migrations/20260826000500_yucang_account_profiles.sql"), "utf8");
const fn = readFileSync(join(root, "supabase/functions/yucang-update-profile/index.ts"), "utf8");
const website = readFileSync(join(root, "yucang/account-profile.mjs"), "utf8");
const app = readFileSync(join(root, "yucang/app.js"), "utf8");
const html = readFileSync(join(root, "yucang/index.html"), "utf8");

assert.equal(validateDisplayName(" 里予里 "), "里予里");
assert.throws(() => validateDisplayName(" "), (error) => error instanceof ProfileError && error.code === "invalid_display_name");
assert.throws(() => validateDisplayName("名".repeat(41)), (error) => error instanceof ProfileError && error.code === "invalid_display_name");
assert.equal(MAX_AVATAR_BYTES, 2 * 1024 * 1024);

assert.equal(detectAvatarMime(Uint8Array.from([0xff, 0xd8, 0xff, 0x00])).mime, "image/jpeg");
assert.equal(detectAvatarMime(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])).mime, "image/png");
assert.equal(detectAvatarMime(new TextEncoder().encode("RIFF0000WEBP")).mime, "image/webp");
assert.throws(() => detectAvatarMime(new TextEncoder().encode("<svg></svg>")), (error) => error instanceof ProfileError && error.code === "invalid_avatar_type");

for (const origin of [
  "https://zaiye.art",
  "chrome-extension://fapladhajicfoiadhcpmbmfkodekkckg",
  "chrome-extension://idiemjhonlahnlnalpanhplbgjcfbpnl",
]) assert(YUCANG_PROFILE_ORIGINS.has(origin));
assert(!YUCANG_PROFILE_ORIGINS.has("https://evil.example"));

assert.match(migration, /'yucang-avatars'[\s\S]*true,[\s\S]*2097152/);
assert.match(migration, /image\/jpeg'[\s\S]*'image\/png'[\s\S]*'image\/webp'/);
assert.match(migration, /name = auth\.uid\(\)::text \|\| '\/avatar\.webp'/);
assert.match(migration, /create or replace function public\.yucang_get_my_profile\(\)/);
assert.match(migration, /returns table \([\s\S]*nickname text,[\s\S]*avatar_url text[\s\S]*\)/);
assert.match(migration, /create or replace function public\.yucang_update_my_profile\([\s\S]*p_nickname text,[\s\S]*p_avatar_url text/);
assert.match(migration, /caller uuid := auth\.uid\(\)/);
assert.match(migration, /position\('\/storage\/v1\/object\/public\/yucang-avatars\/' \|\| caller::text \|\| '\/avatar\.webp'/);
assert.match(migration, /grant execute on function public\.yucang_get_my_profile\(\) to authenticated/);
assert.match(migration, /grant execute on function public\.yucang_update_my_profile\(text, text\) to authenticated/);
assert.doesNotMatch(migration, /grant execute on function public\.yucang_update_my_profile[^\n]+to anon/);

assert.match(fn, /getUser\(token\)/);
assert.match(fn, /avatar\.size > MAX_AVATAR_BYTES/);
assert.match(fn, /detectAvatarMime\(bytes\)/);
assert.match(fn, /uploadedPath = `\$\{userData\.user\.id\}\/avatar\.webp`/);
assert.match(fn, /p_nickname: displayName/);
assert.match(fn, /full_name: displayName/);
assert.match(fn, /avatar_url: avatarUrl/);
assert.doesNotMatch(fn, /access_token|refresh_token/);

assert.match(website, /client\.rpc\("yucang_get_my_profile"\)/);
assert.match(website, /createImageBitmap\(file\)/);
assert.match(website, /Math\.min\(512, side\)/);
assert.match(website, /canvas\.toBlob\([\s\S]*"image\/webp"/);
assert.match(website, /body\.set\("displayName", nickname\)/);
assert.match(website, /Authorization: `Bearer \$\{sessionData\.session\.access_token\}`/);
assert.match(website, /昵称和头像会同步显示在语藏网站与 Prompt Vault 扩展中/);
assert.match(app, /loadAccountProfile/);
assert.match(app, /openAccountProfileEditor/);
assert.match(app, /data-edit-profile/);
assert.match(app, /await loadProfile\(\);[\s\S]*state\.authReady = true/);
assert.match(html, /account-profile\.css\?v=20260826-profile1/);
assert.match(html, /app\.js\?v=20260903-exits1/);

console.log("Yucang account profile contract tests passed.");
