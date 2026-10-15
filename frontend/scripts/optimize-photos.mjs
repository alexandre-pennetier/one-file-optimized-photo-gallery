// Turns the JPEGs in <repo>/photos into optimized AVIFs under public/photos and
// writes manifest.json. Runs before every frontend build; outputs are content-
// addressed, so unchanged photos are skipped and stale ones are removed.
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const srcDir = path.join(root, "photos");
const outDir = path.join(root, "frontend", "public", "photos");

const FULL_MAX = 2000; // long edge of the lightbox image
const THUMB_MAX = 720; // long edge of the grid image
const FULL_OPTS = { quality: 50, effort: 6, chromaSubsampling: "4:2:0" };
const THUMB_OPTS = { quality: 45, effort: 6, chromaSubsampling: "4:2:0" };

await mkdir(outDir, { recursive: true });
const names = existsSync(srcDir)
  ? (await readdir(srcDir)).filter((n) => /\.jpe?g$/i.test(n)).sort()
  : [];

const manifestPath = path.join(outDir, "manifest.json");
let previous = {};
try {
  for (const p of JSON.parse(await readFile(manifestPath, "utf8"))) previous[p.id] = p;
} catch {}

const photos = [];
const keep = new Set(["manifest.json"]);
let encoded = 0;

for (const name of names) {
  const buf = await readFile(path.join(srcDir, name));
  const id = createHash("sha1").update(buf).digest("hex").slice(0, 12);
  const full = `${id}.avif`;
  const thumb = `${id}-t.avif`;
  keep.add(full).add(thumb);

  if (previous[id] && existsSync(path.join(outDir, full)) && existsSync(path.join(outDir, thumb))) {
    photos.push({ ...previous[id], name });
    continue;
  }

  const base = sharp(buf).rotate(); // apply EXIF orientation, drop metadata
  const fullInfo = await base
    .clone()
    .resize(FULL_MAX, FULL_MAX, { fit: "inside", withoutEnlargement: true })
    .avif(FULL_OPTS)
    .toFile(path.join(outDir, full));
  await base
    .clone()
    .resize(THUMB_MAX, THUMB_MAX, { fit: "inside", withoutEnlargement: true })
    .avif(THUMB_OPTS)
    .toFile(path.join(outDir, thumb));
  const tiny = await base
    .clone()
    .resize(16, 16, { fit: "inside" })
    .blur(1)
    .webp({ quality: 40 })
    .toBuffer();

  photos.push({
    id,
    name,
    w: fullInfo.width,
    h: fullInfo.height,
    thumb,
    full,
    lqip: `data:image/webp;base64,${tiny.toString("base64")}`,
  });
  encoded++;
  console.log(`  optimized ${name} -> ${(fullInfo.size / 1024).toFixed(0)} KB`);
}

for (const f of await readdir(outDir)) if (!keep.has(f)) await rm(path.join(outDir, f));
await writeFile(manifestPath, JSON.stringify(photos));
console.log(`photos: ${photos.length} total, ${encoded} newly optimized`);
