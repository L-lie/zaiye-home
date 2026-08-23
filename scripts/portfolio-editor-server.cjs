const crypto = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const sharp = require("sharp");

const root = path.resolve(__dirname, "..");
const host = "127.0.0.1";
const port = Number(process.env.ZAIYE_EDITOR_PORT) || 8765;
const portfolioRoot = path.join(root, "assets", "portfolio");
const generatedRoot = path.resolve(process.env.ZAIYE_EDITOR_TEST_GENERATED_ROOT || path.join(portfolioRoot, "generated"));
const indexPath = path.join(portfolioRoot, "portfolio-index.json");
const mediaPath = path.join(portfolioRoot, "portfolio-media.json");
const projectsPath = path.join(portfolioRoot, "portfolio-projects.json");
const privateRoot = path.resolve(process.env.ZAIYE_EDITOR_PRIVATE_ROOT || path.join(root, ".private", "portfolio-editor"));
const draftPath = path.join(privateRoot, "draft.json");
const statePath = path.join(privateRoot, "state.json");
const originalsRoot = path.join(privateRoot, "originals");
const backupsRoot = path.join(privateRoot, "backups");
const maxImageBytes = 30 * 1024 * 1024;
const maxJsonBytes = 6 * 1024 * 1024;
const allowedImageTypes = new Map([
  ["image/jpeg", "jpeg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

function sendJson(response, status, payload) {
  const body = Buffer.from(`${JSON.stringify(payload)}\n`, "utf8");
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": body.length,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(body);
}

function safeInside(parent, target) {
  const resolvedParent = path.resolve(parent);
  const resolvedTarget = path.resolve(target);
  return resolvedTarget === resolvedParent || resolvedTarget.startsWith(`${resolvedParent}${path.sep}`);
}

function assertLocalRequest(request, write = false) {
  const expectedHost = `${host}:${port}`;
  if (request.headers.host !== expectedHost) throw Object.assign(new Error("无效的本地服务地址"), { status: 403 });
  if (!write) return;
  if (request.headers["x-zaiye-editor"] !== "1") {
    throw Object.assign(new Error("缺少本地编辑器请求标记"), { status: 403 });
  }
  const origin = request.headers.origin;
  if (origin && origin !== `http://${expectedHost}`) {
    throw Object.assign(new Error("拒绝来自其他网页的写入请求"), { status: 403 });
  }
}

async function readBody(request, limit) {
  const declared = Number(request.headers["content-length"] || 0);
  if (declared > limit) throw Object.assign(new Error("请求内容过大"), { status: 413 });
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > limit) throw Object.assign(new Error("请求内容过大"), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJsonBody(request) {
  const body = await readBody(request, maxJsonBytes);
  try {
    return JSON.parse(body.toString("utf8"));
  } catch {
    throw Object.assign(new Error("JSON 格式不正确"), { status: 400 });
  }
}

async function readJson(filePath, fallback) {
  try {
    const source = await fsp.readFile(filePath, "utf8");
    return JSON.parse(source.replace(/^\uFEFF/, ""));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function atomicJson(filePath, value) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  await fsp.writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fsp.rename(tempPath, filePath);
}

function assertSafeText(value, label, maxLength) {
  if (typeof value !== "string" || value.length > maxLength) throw new Error(`${label}格式不正确`);
  if (/[<>"\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new Error(`${label}包含不安全字符`);
}

function assertPublicPath(value, label) {
  if (!value) return;
  assertSafeText(value, label, 2000);
  if (value.includes("..") || value.includes("\\")) throw new Error(`${label}包含非法路径`);
  if (!value.startsWith("assets/portfolio/") && !/^https:\/\//i.test(value)) {
    throw new Error(`${label}必须位于作品资源目录或使用 HTTPS`);
  }
}

function assertTextStyle(value, label) {
  if (value == null) return;
  if (typeof value !== "object" || Array.isArray(value)) throw new Error(`${label}格式不正确`);
  if (value.fontSize != null && (!Number.isInteger(value.fontSize) || value.fontSize < 8 || value.fontSize > 72)) {
    throw new Error(`${label}字号不正确`);
  }
  if (value.color != null && !/^#[0-9a-f]{6}$/i.test(value.color)) throw new Error(`${label}颜色不正确`);
  if (value.fontWeight != null && ![400, 500, 600, 700, 800].includes(Number(value.fontWeight))) {
    throw new Error(`${label}字重不正确`);
  }
}

function validatePageElements(value) {
  if (value == null) return {};
  if (typeof value !== "object" || Array.isArray(value)) throw new Error("页面元素设置格式不正确");
  const result = {};
  Object.entries(value).forEach(([key, element]) => {
    if (!/^[a-zA-Z][a-zA-Z0-9-]{0,79}$/.test(key) || !element || typeof element !== "object" || Array.isArray(element)) return;
    const next = {};
    if (element.text != null) {
      assertSafeText(String(element.text), `${key} 文字`, 1000);
      next.text = String(element.text);
    }
    if (element.fontSize != null) {
      if (!Number.isInteger(element.fontSize) || element.fontSize < 8 || element.fontSize > 240) throw new Error(`${key} 字号不正确`);
      next.fontSize = element.fontSize;
    }
    if (element.color != null) {
      if (!/^#[0-9a-f]{6}$/i.test(element.color)) throw new Error(`${key} 颜色不正确`);
      next.color = element.color;
    }
    if (element.fontWeight != null) {
      if (![400, 500, 600, 700, 800].includes(Number(element.fontWeight))) throw new Error(`${key} 字重不正确`);
      next.fontWeight = Number(element.fontWeight);
    }
    for (const [property, min, max] of [["width", 12, 1600], ["height", 12, 800], ["iconSize", 8, 160]]) {
      if (element[property] == null) continue;
      if (!Number.isInteger(element[property]) || element[property] < min || element[property] > max) throw new Error(`${key} 尺寸不正确`);
      next[property] = element[property];
    }
    for (const property of ["offsetX", "offsetY"]) {
      if (element[property] == null) continue;
      if (!Number.isInteger(element[property]) || element[property] < -2000 || element[property] > 2000) throw new Error(`${key} 位置不正确`);
      next[property] = element[property];
    }
    result[key] = next;
  });
  return result;
}

function validateContent(input) {
  const content = input && typeof input === "object" && !Array.isArray(input) ? structuredClone(input) : null;
  if (!content || !Array.isArray(content.items) || !Array.isArray(content.projects)) throw new Error("作品数据结构不正确");
  if (!content.media || typeof content.media !== "object" || Array.isArray(content.media)) content.media = {};
  content.pageElements = validatePageElements(content.pageElements);
  if (content.items.length > 2000 || content.projects.length > 250 || Object.keys(content.media).length > 5000) {
    throw new Error("作品数据数量异常");
  }

  const itemIds = new Set();
  content.items.forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`第 ${index + 1} 个作品条目格式不正确`);
    if (!item.id) {
      const legacyKey = `${item.slide || 0}\n${item.file || ""}\n${item.title || ""}`;
      item.id = `legacy-${crypto.createHash("sha256").update(legacyKey).digest("hex").slice(0, 20)}`;
    }
    if (typeof item.id !== "string" || !/^[a-zA-Z0-9-]{1,100}$/.test(item.id)) throw new Error(`第 ${index + 1} 个作品 ID 不正确`);
    if (itemIds.has(item.id)) throw new Error(`作品 ID 重复：${item.id}`);
    itemIds.add(item.id);
    assertSafeText(String(item.title || ""), `第 ${index + 1} 个作品标题`, 2000);
    assertSafeText(String(item.captionName || ""), `第 ${index + 1} 个作品名`, 1000);
    assertSafeText(String(item.captionDescription || ""), `第 ${index + 1} 个作品说明`, 3000);
    assertTextStyle(item.captionStyles?.name, `第 ${index + 1} 个作品名字体`);
    assertTextStyle(item.captionStyles?.description, `第 ${index + 1} 个作品说明字体`);
    assertSafeText(String(item.note || ""), `第 ${index + 1} 个作品说明`, 5000);
    assertPublicPath(String(item.file || ""), `第 ${index + 1} 个作品图片`);
  });

  const projectIds = new Set();
  content.projects.forEach((project, index) => {
    if (!project || typeof project !== "object" || Array.isArray(project)) throw new Error(`第 ${index + 1} 个项目格式不正确`);
    if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(project.id || "")) throw new Error(`项目 ID 不正确：${project.id || "空白"}`);
    if (projectIds.has(project.id)) throw new Error(`项目 ID 重复：${project.id}`);
    projectIds.add(project.id);
    assertSafeText(String(project.title || ""), `项目 ${project.id} 名称`, 1000);
    assertSafeText(String(project.meta || ""), `项目 ${project.id} 标签`, 1000);
    assertSafeText(String(project.copy || ""), `项目 ${project.id} 介绍`, 5000);
    assertTextStyle(project.textStyles?.title, `项目 ${project.id} 标题字体`);
    assertTextStyle(project.textStyles?.meta, `项目 ${project.id} 标签字体`);
    assertTextStyle(project.textStyles?.copy, `项目 ${project.id} 介绍字体`);
    assertPublicPath(String(project.poster || project.image || ""), `项目 ${project.id} 封面`);
  });

  Object.entries(content.media).forEach(([file, details]) => {
    assertPublicPath(file, "媒体索引地址");
    if (!details || typeof details !== "object" || Array.isArray(details)) throw new Error("媒体索引格式不正确");
    assertPublicPath(String(details.preview || ""), "媒体缩略图地址");
    assertPublicPath(String(details.display || ""), "媒体展示图地址");
  });
  content.version = 1;
  return content;
}

async function currentContent() {
  const [items, mediaDocument, projectDocument] = await Promise.all([
    readJson(indexPath, []),
    readJson(mediaPath, { version: 1, items: {} }),
    readJson(projectsPath, { version: 1, items: [] }),
  ]);
  return validateContent({
    version: 1,
    items: Array.isArray(items) ? items : [],
    projects: Array.isArray(projectDocument.items) ? projectDocument.items : [],
    pageElements: projectDocument.pageElements || {},
    media: mediaDocument.items || {},
  });
}

async function readState() {
  return readJson(statePath, { publishedRevision: 0 });
}

async function draftContent() {
  const [draft, state] = await Promise.all([readJson(draftPath, null), readState()]);
  if (draft?.content) {
    return { source: "draft", revision: Number(draft.revision) || 0, publishedRevision: Number(state.publishedRevision) || 0, content: validateContent(draft.content) };
  }
  return { source: "static", revision: 0, publishedRevision: Number(state.publishedRevision) || 0, content: await currentContent() };
}

async function saveDraft(content) {
  const previous = await readJson(draftPath, { revision: 0 });
  const revision = (Number(previous.revision) || 0) + 1;
  await atomicJson(draftPath, { revision, savedAt: new Date().toISOString(), content });
  return revision;
}

async function backupPublishedFiles() {
  const backupRoot = path.join(backupsRoot, new Date().toISOString().replace(/[:.]/g, "-"));
  await fsp.mkdir(backupRoot, { recursive: true });
  for (const filePath of [indexPath, mediaPath, projectsPath]) {
    try {
      await fsp.copyFile(filePath, path.join(backupRoot, path.basename(filePath)));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
}

async function cleanUnusedEditorImages(content) {
  const referenced = new Set();
  Object.entries(content.media).forEach(([file, details]) => {
    [file, details?.preview, details?.display].forEach((value) => {
      if (typeof value === "string" && value.startsWith("assets/portfolio/generated/editor-")) {
        referenced.add(path.basename(value));
      }
    });
  });
  let entries = [];
  try {
    entries = await fsp.readdir(generatedRoot, { withFileTypes: true });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await Promise.all(entries
    .filter((entry) => entry.isFile() && entry.name.startsWith("editor-") && !referenced.has(entry.name))
    .map((entry) => fsp.unlink(path.join(generatedRoot, entry.name))));
}

async function publishContent(content) {
  await backupPublishedFiles();
  const state = await readState();
  const revision = (Number(state.publishedRevision) || 0) + 1;
  await Promise.all([
    atomicJson(indexPath, content.items),
    atomicJson(mediaPath, { version: 1, items: content.media }),
    atomicJson(projectsPath, { version: 1, items: content.projects, pageElements: content.pageElements || {} }),
  ]);
  await Promise.all([
    atomicJson(draftPath, { revision, savedAt: new Date().toISOString(), content }),
    atomicJson(statePath, { publishedRevision: revision, publishedAt: new Date().toISOString() }),
  ]);
  await cleanUnusedEditorImages(content);
  return revision;
}

function watermarkSvg(width, height) {
  const fontSize = Math.min(20, Math.max(10, Math.round(Math.max(width, height) * 0.0085)));
  const stepX = fontSize * 10;
  const stepY = fontSize * 7;
  const texts = [];
  for (let y = -height; y < height * 2; y += stepY) {
    for (let x = -width; x < width * 2; x += stepX) {
      texts.push(`<text x="${x}" y="${y}">再野文化</text>`);
    }
  }
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><g transform="rotate(-22 ${width / 2} ${height / 2})" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="${fontSize}" font-weight="600" text-anchor="middle" fill="#fff" fill-opacity="0.055" stroke="#000" stroke-opacity="0.025" stroke-width="0.6">${texts.join("")}</g></svg>`);
}

async function makePublicVariant(source, edge, quality) {
  const resized = await sharp(source, { failOn: "warning", limitInputPixels: 80_000_000 })
    .rotate()
    .resize({ width: edge, height: edge, fit: "inside", withoutEnlargement: true })
    .toBuffer({ resolveWithObject: true });
  return sharp(resized.data)
    .composite([{ input: watermarkSvg(resized.info.width, resized.info.height), blend: "over" }])
    .webp({ quality, effort: 5, smartSubsample: true })
    .toBuffer();
}

async function uploadImage(request) {
  const declaredType = String(request.headers["content-type"] || "").split(";")[0].toLowerCase();
  if (!allowedImageTypes.has(declaredType)) throw Object.assign(new Error("只支持 JPG、PNG 和 WebP 图片"), { status: 415 });
  const source = await readBody(request, maxImageBytes);
  if (!source.length) throw Object.assign(new Error("图片文件为空"), { status: 400 });
  let metadata;
  try {
    metadata = await sharp(source, { failOn: "warning", limitInputPixels: 80_000_000 }).metadata();
  } catch {
    throw Object.assign(new Error("图片已损坏或尺寸过大"), { status: 400 });
  }
  const detectedType = metadata.format === "jpg" ? "jpeg" : metadata.format;
  if (!["jpeg", "png", "webp"].includes(detectedType) || detectedType !== allowedImageTypes.get(declaredType)) {
    throw Object.assign(new Error("图片内容与文件类型不一致"), { status: 415 });
  }
  const rotated = metadata.orientation >= 5 && metadata.orientation <= 8;
  const width = rotated ? metadata.height : metadata.width;
  const height = rotated ? metadata.width : metadata.height;
  if (!width || !height || width * height > 80_000_000) throw Object.assign(new Error("图片尺寸过大"), { status: 400 });

  const assetId = crypto.randomUUID();
  const extension = detectedType === "jpeg" ? "jpg" : detectedType;
  const originalDirectory = path.join(originalsRoot, assetId);
  const originalPath = path.join(originalDirectory, `original.${extension}`);
  const previewName = `editor-${assetId}.preview.webp`;
  const displayName = `editor-${assetId}.display.webp`;
  const previewPath = path.join(generatedRoot, previewName);
  const displayPath = path.join(generatedRoot, displayName);
  await Promise.all([fsp.mkdir(originalDirectory, { recursive: true }), fsp.mkdir(generatedRoot, { recursive: true })]);
  try {
    const [preview, display] = await Promise.all([
      makePublicVariant(source, 1280, 76),
      makePublicVariant(source, 2400, 84),
    ]);
    await Promise.all([
      fsp.writeFile(originalPath, source, { flag: "wx" }),
      fsp.writeFile(previewPath, preview, { flag: "wx" }),
      fsp.writeFile(displayPath, display, { flag: "wx" }),
    ]);
  } catch (error) {
    await Promise.allSettled([
      fsp.rm(originalDirectory, { recursive: true, force: true }),
      fsp.unlink(previewPath),
      fsp.unlink(displayPath),
    ]);
    throw error;
  }
  const previewWebPath = `assets/portfolio/generated/${previewName}`;
  const displayWebPath = `assets/portfolio/generated/${displayName}`;
  return {
    assetId,
    file: displayWebPath,
    media: { width, height, preview: previewWebPath, display: displayWebPath, watermarked: true },
  };
}

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".svg", "image/svg+xml"],
  [".woff2", "font/woff2"],
]);

async function serveStatic(request, response, pathname) {
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  if (!relative || relative.startsWith(".") || relative.includes("\\") || relative.split("/").includes("..")) {
    throw Object.assign(new Error("资源路径无效"), { status: 403 });
  }
  const filePath = path.resolve(root, relative);
  if (!safeInside(root, filePath) || safeInside(path.join(root, ".private"), filePath) || safeInside(path.join(root, ".git"), filePath) || safeInside(path.join(root, "node_modules"), filePath)) {
    throw Object.assign(new Error("资源路径无效"), { status: 403 });
  }
  const stat = await fsp.stat(filePath);
  if (!stat.isFile()) throw Object.assign(new Error("资源不存在"), { status: 404 });
  response.writeHead(200, {
    "Content-Type": mimeTypes.get(path.extname(filePath).toLowerCase()) || "application/octet-stream",
    "Content-Length": stat.size,
    "Cache-Control": relative === "admin.html" || /\.(?:js|css)$/.test(relative) ? "no-store" : "public, max-age=300",
    "X-Content-Type-Options": "nosniff",
  });
  if (request.method === "HEAD") return response.end();
  fs.createReadStream(filePath).pipe(response);
}

async function handleRequest(request, response) {
  try {
    assertLocalRequest(request);
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (request.method === "GET" && url.pathname === "/api/portfolio/current") {
      return sendJson(response, 200, { content: await currentContent() });
    }
    if (request.method === "GET" && url.pathname === "/api/portfolio/draft") {
      return sendJson(response, 200, await draftContent());
    }
    if (request.method === "POST" && url.pathname === "/api/portfolio/draft") {
      assertLocalRequest(request, true);
      const body = await readJsonBody(request);
      const content = validateContent(body.content);
      return sendJson(response, 200, { revision: await saveDraft(content) });
    }
    if (request.method === "POST" && url.pathname === "/api/portfolio/publish") {
      assertLocalRequest(request, true);
      const body = await readJsonBody(request);
      const content = validateContent(body.content);
      const revision = await publishContent(content);
      return sendJson(response, 200, { revision, content });
    }
    if (request.method === "POST" && url.pathname === "/api/portfolio/upload") {
      assertLocalRequest(request, true);
      return sendJson(response, 200, await uploadImage(request));
    }
    if (!url.pathname.startsWith("/api/") && (request.method === "GET" || request.method === "HEAD")) {
      return serveStatic(request, response, decodeURIComponent(url.pathname));
    }
    sendJson(response, 404, { error: "接口不存在" });
  } catch (error) {
    const status = Number(error.status) || (error.code === "ENOENT" ? 404 : 400);
    sendJson(response, status, { error: error.message || "本地编辑器发生错误" });
  }
}

const server = http.createServer(handleRequest);
server.listen(port, host, () => {
  process.stdout.write(`Zaiye portfolio editor: http://${host}:${port}/admin.html\n`);
});
