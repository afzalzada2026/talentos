/**
 * One-command project archiver.
 *
 *   node scripts/make-zip.mjs
 *
 * Creates "talentos-project.zip" in the project root containing every source
 * file (skipping node_modules, dist and git metadata). Run `npm install`
 * first if you haven't yet — the script uses the already-installed jszip.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outName = "talentos-project.zip";
const out = path.join(root, outName);

const SKIP = new Set(["node_modules", "dist", ".git", ".DS_Store", outName]);

async function walk(dir, zip, rel = "") {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      zip.folder(relPath); // keeps empty folders in the archive too
      await walk(full, zip, relPath);
    } else {
      zip.file(relPath, await fs.readFile(full));
    }
  }
}

try {
  const zip = new JSZip();
  await walk(root, zip);
  const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 9 } });
  await fs.writeFile(out, buf);
  const kb = (buf.length / 1024).toFixed(0);
  console.log(`✓ Created ${outName} (${kb} KB) in the project root.`);
  console.log("  Next: unzip it anywhere, then  npm install && npm run build");
} catch (e) {
  console.error("✗ Could not create the zip. Did you run `npm install` first?");
  console.error("  " + (e?.message ?? e));
  process.exit(1);
}
