// Turns a folder of JPEGs into optimized AVIFs plus a manifest.json. Outputs are
// content-addressed (source bytes + encoder settings), so unchanged photos are
// skipped and stale files are removed.
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import exifr from 'exifr'
import sharp from 'sharp'

export const SETTINGS = {
  full: { max: 2000, avif: { quality: 50, effort: 6, chromaSubsampling: '4:2:0' } }, // lightbox
  thumb: { max: 720, avif: { quality: 45, effort: 6, chromaSubsampling: '4:2:0' } }, // grid
}
const settingsKey = JSON.stringify(SETTINGS)
const CONCURRENCY = Math.max(1, Math.min(4, os.availableParallelism()))

const fit = (img, max) => img.clone().resize(max, max, { fit: 'inside', withoutEnlargement: true })

async function encode(buf, id, outDir) {
  const base = sharp(buf).rotate() // apply EXIF orientation; metadata is dropped
  const full = await fit(base, SETTINGS.full.max)
    .avif(SETTINGS.full.avif)
    .toFile(path.join(outDir, `${id}.avif`))
  await fit(base, SETTINGS.thumb.max)
    .avif(SETTINGS.thumb.avif)
    .toFile(path.join(outDir, `${id}-t.avif`))
  const tiny = await base.clone().resize(16, 16, { fit: 'inside' }).blur(1).webp({ quality: 40 }).toBuffer()
  return { w: full.width, h: full.height, size: full.size, lqip: `data:image/webp;base64,${tiny.toString('base64')}` }
}

/**
 * "Wall clock" time: the date/time components as local fields, packed into a
 * UTC epoch. EXIF carries no timezone, so this keeps what the camera wrote and
 * lets the viewer format it with timeZone 'UTC' on any machine, in any zone.
 */
const wallClock = (d) =>
  Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds())

/** When the photo was taken (wall clock, see above): EXIF capture date, else the file's mtime. */
async function takenAt(buf, file) {
  try {
    const exif = await exifr.parse(buf, { pick: ['DateTimeOriginal', 'CreateDate', 'DateTimeDigitized'] })
    const date = exif?.DateTimeOriginal ?? exif?.CreateDate ?? exif?.DateTimeDigitized
    if (date instanceof Date && !Number.isNaN(date.getTime())) return wallClock(date)
  } catch {
    // unreadable EXIF: fall back to mtime
  }
  return wallClock(new Date((await stat(file)).mtimeMs))
}

async function readPrevious(manifestPath) {
  try {
    return new Map(JSON.parse(await readFile(manifestPath, 'utf8')).map((p) => [p.id, p]))
  } catch {
    return new Map()
  }
}

async function processPhoto(name, previous, { srcDir, outDir, log }) {
  const file = path.join(srcDir, name)
  const buf = await readFile(file)
  const taken = await takenAt(buf, file)
  const id = createHash('sha1').update(buf).update(settingsKey).digest('hex').slice(0, 12)
  const cached = previous.get(id)
  const done = existsSync(path.join(outDir, `${id}.avif`)) && existsSync(path.join(outDir, `${id}-t.avif`))
  if (cached && done) return { photo: { ...cached, name, taken }, encoded: false }

  try {
    const { size, ...meta } = await encode(buf, id, outDir)
    log(`  optimized ${name} -> ${(size / 1024).toFixed(0)} KB`)
    return { photo: { id, name, taken, ...meta, thumb: `${id}-t.avif`, full: `${id}.avif` }, encoded: true }
  } catch (err) {
    throw new Error(`failed to process photos/${name}: ${err.message}`, { cause: err })
  }
}

/** Runs `fn` over `items` with at most `limit` in flight; preserves input order. */
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        results[i] = await fn(items[i])
      }
    }),
  )
  return results
}

/**
 * @param {{ srcDir: string, outDir: string, log?: (msg: string) => void }} opts
 * @returns {Promise<{ photos: object[], encoded: number }>}
 */
export async function optimizePhotos({ srcDir, outDir, log = () => {} }) {
  await mkdir(outDir, { recursive: true })
  const names = existsSync(srcDir) ? (await readdir(srcDir)).filter((n) => /\.jpe?g$/i.test(n)).sort() : []
  const manifestPath = path.join(outDir, 'manifest.json')
  const previous = await readPrevious(manifestPath)

  const results = await mapLimit(names, CONCURRENCY, (name) => processPhoto(name, previous, { srcDir, outDir, log }))

  // Identical files share an id; keep the first so React keys stay unique.
  const photos = [...new Map(results.map((r) => [r.photo.id, r.photo])).values()]
  const keep = new Set(['manifest.json', ...photos.flatMap((p) => [p.full, p.thumb])])
  for (const f of await readdir(outDir)) if (!keep.has(f)) await rm(path.join(outDir, f), { force: true })

  const tmp = `${manifestPath}.tmp`
  await writeFile(tmp, JSON.stringify(photos))
  await rename(tmp, manifestPath)

  return { photos, encoded: results.filter((r) => r.encoded).length }
}
