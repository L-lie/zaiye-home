const assert = require("node:assert/strict");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const sharp = require("sharp");

const root = path.resolve(__dirname, "..");
const port = 8766;
const origin = `http://127.0.0.1:${port}`;
const privateRoot = path.join(os.tmpdir(), `zaiye-portfolio-editor-${process.pid}`);
const generatedRoot = path.join(privateRoot, "generated");
const staticFiles = [
  path.join(root, "assets", "portfolio", "portfolio-index.json"),
  path.join(root, "assets", "portfolio", "portfolio-media.json"),
  path.join(root, "assets", "portfolio", "portfolio-projects.json"),
];
const snapshots = new Map();
let server;

async function request(pathname, options = {}) {
  const response = await fetch(`${origin}${pathname}`, options);
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const result = await request("/api/portfolio/current");
      if (result.response.ok) return result.payload;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("本地作品编辑服务未能启动");
}

async function main() {
  for (const filePath of staticFiles) {
    snapshots.set(filePath, fs.existsSync(filePath) ? await fsp.readFile(filePath) : null);
  }
  server = spawn(process.execPath, [path.join("scripts", "portfolio-editor-server.cjs")], {
    cwd: root,
    env: {
      ...process.env,
      ZAIYE_EDITOR_PORT: String(port),
      ZAIYE_EDITOR_PRIVATE_ROOT: privateRoot,
      ZAIYE_EDITOR_TEST_GENERATED_ROOT: generatedRoot,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let serverErrors = "";
  server.stderr.on("data", (chunk) => { serverErrors += chunk; });

  const initial = await waitForServer();
  assert(initial.content.items.length > 0, "应能读取现有作品");
  assert.match(initial.content.items[0].id, /^(?:legacy-|[a-zA-Z0-9-]+)/, "旧作品应获得稳定 ID");

  const source = await sharp({
    create: { width: 640, height: 360, channels: 3, background: "#26313c" },
  }).png().toBuffer();
  const upload = await request("/api/portfolio/upload", {
    method: "POST",
    headers: {
      "Content-Type": "image/png",
      "X-Zaiye-Editor": "1",
      "X-File-Name": "safe-test.png",
      Origin: origin,
    },
    body: source,
  });
  assert.equal(upload.response.status, 200, JSON.stringify(upload.payload));
  assert.equal(upload.payload.media.watermarked, true);
  assert(upload.payload.file.startsWith("assets/portfolio/generated/editor-"));
  const displayPath = path.join(generatedRoot, path.basename(upload.payload.file));
  const displayBytes = await fsp.readFile(displayPath);
  const displayMeta = await sharp(displayBytes).metadata();
  assert.equal(displayMeta.format, "webp");
  assert(displayMeta.width <= 2400 && displayMeta.height <= 2400);
  const stats = await sharp(displayBytes).stats();
  assert(stats.channels.some((channel) => channel.stdev > 0.15), "公开 WebP 应包含烘焙水印纹理");
  const privateOriginals = await fsp.readdir(path.join(privateRoot, "originals", upload.payload.assetId));
  assert.deepEqual(privateOriginals, ["original.png"]);

  const content = structuredClone(initial.content);
  const testProject = {
    id: "codex-local-editor-test",
    project: "feature",
    title: "本地编辑器回滚测试",
    meta: "仅用于自动验证",
    copy: "发布完成后会自动恢复。",
    image: upload.payload.file,
    poster: upload.payload.file,
    slides: [],
    showInProjectEntry: true,
    assetId: upload.payload.assetId,
  };
  const testItem = {
    id: "codex-local-editor-test-item",
    slide: 9999,
    file: upload.payload.file,
    title: "本地编辑器回滚测试图片",
    projectId: testProject.id,
    projects: ["feature"],
    types: ["atmosphere"],
    note: "自动测试",
    assetId: upload.payload.assetId,
  };
  content.projects.push(testProject);
  content.items.push(testItem);
  content.media[upload.payload.file] = upload.payload.media;

  const draft = await request("/api/portfolio/draft", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Zaiye-Editor": "1", Origin: origin },
    body: JSON.stringify({ content }),
  });
  assert.equal(draft.response.status, 200, JSON.stringify(draft.payload));
  assert(draft.payload.revision >= 1);

  const publish = await request("/api/portfolio/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Zaiye-Editor": "1", Origin: origin },
    body: JSON.stringify({ content }),
  });
  assert.equal(publish.response.status, 200, JSON.stringify(publish.payload));
  const current = await request("/api/portfolio/current");
  assert(current.payload.content.items.some((item) => item.id === testItem.id));
  assert(current.payload.content.projects.some((project) => project.id === testProject.id));

  const noMarker = await request("/api/portfolio/draft", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({ content }),
  });
  assert.equal(noMarker.response.status, 403);

  const traversal = structuredClone(content);
  traversal.items.at(-1).file = "assets/portfolio/../../secret.png";
  const unsafe = await request("/api/portfolio/draft", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Zaiye-Editor": "1", Origin: origin },
    body: JSON.stringify({ content: traversal }),
  });
  assert.equal(unsafe.response.status, 400);

  const wrongMime = await request("/api/portfolio/upload", {
    method: "POST",
    headers: { "Content-Type": "text/plain", "X-Zaiye-Editor": "1", Origin: origin },
    body: "not an image",
  });
  assert.equal(wrongMime.response.status, 415);
  const unexpectedErrors = serverErrors
    .replace(/Fontconfig error: No writable cache directories(?:\r?\n\s+[^\r\n]+){2}/gi, "")
    .trim();
  assert(!/unhandled|error:/i.test(unexpectedErrors), unexpectedErrors);
  process.stdout.write("portfolio editor e2e: pass\n");
}

async function cleanup() {
  if (server && server.exitCode === null) {
    server.kill();
    await new Promise((resolve) => server.once("exit", resolve));
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  for (const [filePath, bytes] of snapshots) {
    if (bytes === null) await fsp.rm(filePath, { force: true });
    else await fsp.writeFile(filePath, bytes);
  }
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      await fsp.rm(privateRoot, { recursive: true, force: true });
      break;
    } catch (error) {
      if (error.code !== "EBUSY" || attempt === 11) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
}

main()
  .then(cleanup)
  .catch(async (error) => {
    try {
      await cleanup();
    } catch (cleanupError) {
      console.error("cleanup failed:", cleanupError);
    }
    console.error(error);
    process.exitCode = 1;
  });
