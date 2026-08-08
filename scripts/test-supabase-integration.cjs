const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const browserScripts = [
  "admin.js",
  "gallery.js",
  "portfolio-admin-image.js",
  "portfolio-publication.js",
  "supabase-client.js",
];
browserScripts.forEach((file) => new vm.Script(read(file), { filename: file }));

const adminHtml = read("admin.html");
const adminJs = read("admin.js");
const ids = [...adminJs.matchAll(/getElementById\("([^"]+)"\)/g)].map((match) => match[1]);
const missingIds = ids.filter((id) => !adminHtml.includes(`id="${id}"`));
assert.deepEqual(missingIds, [], `admin.html is missing ids: ${missingIds.join(", ")}`);
assert(!adminJs.includes("signInWithOtp"), "local editor must not depend on email auth");
assert(!adminJs.includes("verifyOtp"), "local editor must not depend on OTP auth");
assert(!adminHtml.includes("supabase-client.js"), "local editor must not load Supabase");
assert(adminJs.includes('apiJson("/api/portfolio/draft"'), "local draft API is missing");
assert(adminJs.includes('apiJson("/api/portfolio/publish"'), "local publish API is missing");
assert(adminJs.includes('fetch("/api/portfolio/upload"'), "local upload API is missing");
assert(adminHtml.includes("admin.js?v=20260808c"), "admin scripts need a cache-busting version");

const galleryHtml = read("gallery.html");
const orderedScripts = [
  "assets/vendor/supabase-2.111.0.js",
  "supabase-config.js",
  "supabase-client.js",
  "portfolio-publication.js",
  "gallery.js",
];
let previousIndex = -1;
orderedScripts.forEach((file) => {
  const index = galleryHtml.indexOf(file);
  assert(index > previousIndex, `${file} is missing or loaded out of order`);
  previousIndex = index;
});

const schema = read("supabase/portfolio.sql");
[
  "private.is_site_owner()",
  "portfolio_drafts",
  "portfolio_publications",
  "portfolio_publication_history",
  "portfolio_assets",
  "enable row level security",
  "publish_portfolio()",
  "portfolio-originals",
  "portfolio-public",
].forEach((term) => assert(schema.includes(term), `portfolio.sql is missing ${term}`));
assert(!schema.includes("service_role"), "portfolio.sql must not depend on service_role");

const config = read("supabase-config.js");
const configuredUrl = config.match(/url:\s*"([^"]*)"/)?.[1] || "";
const configuredKey = config.match(/publishableKey:\s*"([^"]*)"/)?.[1] || "";
assert(
  configuredUrl === "" || /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(configuredUrl),
  "Supabase URL must be empty or a valid Project URL",
);
assert(
  configuredKey === "" || /^sb_publishable_/i.test(configuredKey),
  "Supabase key must be empty or a publishable key",
);
assert(!/service[_-]?role/i.test(config), "browser config must not contain a service-role key");
assert(!/sb_secret_/i.test(config), "browser config must not contain a secret key");

const imageTools = read("portfolio-admin-image.js");
const gallery = read("gallery.js");
assert(imageTools.includes('fillText("再野文化"'), "watermark must be rendered as text");
assert(imageTools.includes("portfolio-originals"), "original uploads must use the private bucket");
assert(imageTools.includes("portfolio-public"), "derived uploads must use the public bucket");
assert(imageTools.includes("watermarked: true"), "derived images must be marked as baked-watermarked");
assert(gallery.includes("mediaFor(file).watermarked"), "gallery must avoid a second overlay watermark");

assert(fs.existsSync(path.join(root, "assets/vendor/supabase-2.111.0.js")), "vendored Supabase client is missing");
assert(fs.existsSync(path.join(root, "assets/vendor/supabase-js.LICENSE")), "Supabase license is missing");

async function testPublicationLoading() {
  const publicationScript = read("portfolio-publication.js");
  const storage = new Map();
  const staticItems = [{ id: "static-item", file: "assets/static.webp", title: "Static" }];
  const staticMedia = { items: { "assets/static.webp": { width: 16, height: 9 } } };
  const staticProjects = { items: [{ id: "static-project", title: "Static project" }] };
  const fetchStatic = async (url) => ({
    ok: true,
    json: async () => url.includes("portfolio-index")
      ? staticItems
      : url.includes("portfolio-projects") ? staticProjects : staticMedia,
  });

  const staticWindow = {
    localStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
    },
    ZaiyeSupabase: { isConfigured: false },
  };
  vm.runInNewContext(publicationScript, {
    window: staticWindow,
    localStorage: staticWindow.localStorage,
    fetch: fetchStatic,
    Date,
  });
  const staticResult = await staticWindow.PortfolioPublication.load(
    "assets/portfolio/portfolio-index.json",
    "assets/portfolio/portfolio-media.json",
    "assets/portfolio/portfolio-projects.json",
  );
  assert.equal(staticResult.source, "static", "unconfigured site must use static fallback");
  assert.equal(staticResult.content.items[0].id, "static-item");
  assert.equal(staticResult.content.projects[0].id, "static-project");

  const publishedContent = {
    version: 1,
    projects: [],
    items: [{ id: "published-item", file: "https://example.test/display.webp", title: "Published" }],
    media: {},
  };
  const liveWindow = {
    localStorage: staticWindow.localStorage,
    ZaiyeSupabase: {
      isConfigured: true,
      getClient: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { content: publishedContent, revision: 7 }, error: null }),
            }),
          }),
        }),
      }),
    },
  };
  vm.runInNewContext(publicationScript, {
    window: liveWindow,
    localStorage: liveWindow.localStorage,
    fetch: fetchStatic,
    Date,
  });
  const liveResult = await liveWindow.PortfolioPublication.load("index", "media");
  assert.equal(liveResult.source, "supabase", "published data must take priority over static data");
  assert.equal(liveResult.revision, 7);

  const cachedResult = await liveWindow.PortfolioPublication.load("index", "media");
  assert.equal(cachedResult.source, "cache", "fresh publication must be reused from cache");
  assert.equal(cachedResult.content.items[0].id, "published-item");
}

testPublicationLoading()
  .then(() => process.stdout.write(`Supabase integration checks passed (${ids.length} admin ids)\n`))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
