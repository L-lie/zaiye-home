const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");

const root = path.resolve(__dirname, "..");
const portfolioRoot = path.join(root, "assets", "portfolio");
const generatedRoot = path.join(portfolioRoot, "generated");
const manifestPath = path.join(portfolioRoot, "portfolio-media.json");
const processingVersion = "portfolio-webp-v1";
const sourceExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"]);
const sizes = [
  { key: "preview", edge: 1280, quality: 76 },
  { key: "display", edge: 2400, quality: 84 },
];

function webPath(filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

function orientedDimensions(metadata) {
  const rotated = metadata.orientation >= 5 && metadata.orientation <= 8;
  return {
    width: rotated ? metadata.height : metadata.width,
    height: rotated ? metadata.width : metadata.height,
  };
}

async function sourceFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (path.resolve(target) === path.resolve(generatedRoot)) continue;
      files.push(...await sourceFiles(target));
      continue;
    }
    if (sourceExtensions.has(path.extname(entry.name).toLowerCase())) files.push(target);
  }
  return files;
}

async function buildFile(sourcePath) {
  const source = await fs.readFile(sourcePath);
  const hash = crypto
    .createHash("sha256")
    .update(processingVersion)
    .update(source)
    .digest("hex")
    .slice(0, 12);
  const relative = path.relative(portfolioRoot, sourcePath);
  const relativeDirectory = path.dirname(relative);
  const base = path.basename(relative, path.extname(relative));
  const outputDirectory = path.join(generatedRoot, relativeDirectory);
  await fs.mkdir(outputDirectory, { recursive: true });

  const metadata = await sharp(source, { failOn: "warning" }).metadata();
  const dimensions = orientedDimensions(metadata);
  const outputs = {};
  const expected = [];

  for (const size of sizes) {
    const outputPath = path.join(outputDirectory, `${base}.${hash}.${size.key}.webp`);
    await sharp(source, { failOn: "warning" })
      .rotate()
      .resize({
        width: size.edge,
        height: size.edge,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: size.quality, effort: 5, smartSubsample: true })
      .toFile(outputPath);
    outputs[size.key] = webPath(outputPath);
    expected.push(path.resolve(outputPath));
  }

  return {
    source: webPath(sourcePath),
    media: {
      width: dimensions.width,
      height: dimensions.height,
      preview: outputs.preview,
      display: outputs.display,
    },
    expected,
  };
}

async function generatedFiles(directory) {
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) files.push(...await generatedFiles(target));
      else files.push(path.resolve(target));
    }
    return files;
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function main() {
  const sources = await sourceFiles(portfolioRoot);
  const manifest = {};
  const expected = new Set();

  for (const [index, sourcePath] of sources.entries()) {
    const result = await buildFile(sourcePath);
    manifest[result.source] = result.media;
    result.expected.forEach((file) => expected.add(file));
    process.stdout.write(`\rPortfolio media ${index + 1}/${sources.length}`);
  }

  const generated = await generatedFiles(generatedRoot);
  for (const file of generated) {
    if (!file.startsWith(path.resolve(generatedRoot) + path.sep)) {
      throw new Error(`Refusing to clean outside generated directory: ${file}`);
    }
    if (!expected.has(file)) await fs.unlink(file);
  }

  const ordered = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
  await fs.writeFile(manifestPath, `${JSON.stringify({ version: 1, items: ordered }, null, 2)}\n`, "utf8");
  process.stdout.write(`\nGenerated ${sources.length * sizes.length} files and ${webPath(manifestPath)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
