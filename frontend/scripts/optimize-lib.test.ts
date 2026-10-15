import { mkdtemp, readdir, readFile, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
// @ts-expect-error plain JS module without types
import { optimizePhotos } from './optimize-lib.mjs'

let dir: string
let srcDir: string
let outDir: string

const jpeg = (w: number, h: number, r = 200, g = 100, b = 50, orientation?: number) => {
  let img = sharp({ create: { width: w, height: h, channels: 3, background: { r, g, b } } })
  if (orientation) img = img.withMetadata({ orientation })
  return img.jpeg().toBuffer()
}
const run = () => optimizePhotos({ srcDir, outDir })
const outFiles = async () => (await readdir(outDir)).sort()

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'optimize-'))
  srcDir = path.join(dir, 'photos')
  outDir = path.join(dir, 'out')
  await import('node:fs/promises').then((fs) => fs.mkdir(srcDir))
})
afterEach(() => rm(dir, { recursive: true, force: true }))

describe('capture date', () => {
  it('uses the EXIF DateTimeOriginal', async () => {
    const buf = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#888' } })
      .withExif({ IFD2: { DateTimeOriginal: '2019:07:04 12:30:00' } })
      .jpeg()
      .toBuffer()
    await writeFile(path.join(srcDir, 'dated.jpg'), buf)
    const { photos } = await run()
    expect(new Date(photos[0].taken).getFullYear()).toBe(2019)
    expect(new Date(photos[0].taken).getMonth()).toBe(6)
  })

  it('falls back to the file modification time without EXIF', async () => {
    const file = path.join(srcDir, 'plain.jpg')
    await writeFile(file, await jpeg(40, 30))
    const mtime = new Date('2015-03-02T10:00:00')
    await utimes(file, mtime, mtime)
    const { photos } = await run()
    expect(photos[0].taken).toBe(mtime.getTime())
  })

  it('keeps the date on a cached second run', async () => {
    await writeFile(path.join(srcDir, 'a.jpg'), await jpeg(40, 30))
    const first = await run()
    const second = await run()
    expect(second.photos[0].taken).toBe(first.photos[0].taken)
  })
})

describe('optimizePhotos', () => {
  it('writes full + thumb AVIFs and a manifest entry per JPEG', async () => {
    await writeFile(path.join(srcDir, 'b.jpg'), await jpeg(300, 200))
    await writeFile(path.join(srcDir, 'a.JPEG'), await jpeg(200, 300, 10, 20, 30))
    await writeFile(path.join(srcDir, 'notes.txt'), 'ignored')

    const { photos, encoded } = await run()

    expect(encoded).toBe(2)
    expect(photos.map((p: { name: string }) => p.name)).toEqual(['a.JPEG', 'b.jpg']) // sorted
    const manifest = JSON.parse(await readFile(path.join(outDir, 'manifest.json'), 'utf8'))
    expect(manifest).toEqual(photos)

    const p = manifest[1]
    expect(p).toMatchObject({ name: 'b.jpg', w: 300, h: 200 })
    expect(p.lqip).toMatch(/^data:image\/webp;base64,/)
    expect((await sharp(path.join(outDir, p.full)).metadata()).format).toBe('heif') // AVIF container
    expect(await outFiles()).toEqual(
      ['manifest.json', ...[p.full, p.thumb, manifest[0].full, manifest[0].thumb].sort()].sort(),
    )
  })

  it('never upscales and downsizes large photos to the configured long edge', async () => {
    await writeFile(path.join(srcDir, 'big.jpg'), await jpeg(4000, 1000))
    const { photos } = await run()
    expect(Math.max(photos[0].w, photos[0].h)).toBe(2000)
    expect(photos[0].w / photos[0].h).toBeCloseTo(4)
    const thumb = await sharp(path.join(outDir, photos[0].thumb)).metadata()
    expect(thumb.width).toBe(720)
  })

  it('applies EXIF orientation to the reported dimensions', async () => {
    await writeFile(path.join(srcDir, 'rot.jpg'), await jpeg(300, 200, 1, 2, 3, 6)) // rotated 90deg
    const { photos } = await run()
    expect(photos[0]).toMatchObject({ w: 200, h: 300 })
  })

  it('skips unchanged photos on the second run', async () => {
    await writeFile(path.join(srcDir, 'a.jpg'), await jpeg(300, 200))
    const first = await run()
    const second = await run()
    expect(second.encoded).toBe(0)
    expect(second.photos).toEqual(first.photos)
  })

  it('re-encodes only changed photos and removes outputs of deleted ones', async () => {
    await writeFile(path.join(srcDir, 'a.jpg'), await jpeg(300, 200, 255, 0, 0))
    await writeFile(path.join(srcDir, 'b.jpg'), await jpeg(300, 200, 0, 255, 0))
    const first = await run()

    await writeFile(path.join(srcDir, 'a.jpg'), await jpeg(300, 200, 0, 0, 255)) // changed
    await rm(path.join(srcDir, 'b.jpg')) // deleted
    const second = await run()

    expect(second.encoded).toBe(1)
    expect(second.photos).toHaveLength(1)
    expect(second.photos[0].id).not.toBe(first.photos[0].id)
    expect(await outFiles()).toEqual([second.photos[0].full, second.photos[0].thumb, 'manifest.json'].sort())
  })

  it('keeps one entry for byte-identical files so ids stay unique', async () => {
    const buf = await jpeg(300, 200)
    await writeFile(path.join(srcDir, 'a.jpg'), buf)
    await writeFile(path.join(srcDir, 'copy.jpg'), buf)
    const { photos } = await run()
    expect(photos).toHaveLength(1)
    expect(new Set(photos.map((p: { id: string }) => p.id)).size).toBe(photos.length)
  })

  it('produces an empty manifest when there are no photos', async () => {
    const { photos } = await run()
    expect(photos).toEqual([])
    expect(JSON.parse(await readFile(path.join(outDir, 'manifest.json'), 'utf8'))).toEqual([])
  })

  it('fails loudly, naming the file, on a corrupt JPEG', async () => {
    await writeFile(path.join(srcDir, 'broken.jpg'), 'definitely not a jpeg')
    await expect(run()).rejects.toThrow(/broken\.jpg/)
  })
})
