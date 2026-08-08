const fs = require("node:fs/promises");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const packageRoot = path.join(root, "node_modules", "@supabase", "supabase-js");
const vendorRoot = path.join(root, "assets", "vendor");

async function main() {
  await fs.mkdir(vendorRoot, { recursive: true });
  const supabaseBundle = await fs.readFile(
    path.join(packageRoot, "dist", "umd", "supabase.js"),
    "utf8",
  );
  await Promise.all([
    fs.writeFile(
      path.join(vendorRoot, "supabase-2.111.0.js"),
      supabaseBundle.replace(/[ \t]+$/gm, ""),
      "utf8",
    ),
    fs.copyFile(
      path.join(packageRoot, "LICENSE"),
      path.join(vendorRoot, "supabase-js.LICENSE"),
    ),
  ]);
  process.stdout.write("Vendored @supabase/supabase-js 2.111.0\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
