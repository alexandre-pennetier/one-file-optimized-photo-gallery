// Optimizes <repo>/photos into frontend/public/photos. Run via the Task
// `optimize:photos` (or `pnpm run optimize`).
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { optimizePhotos } from './optimize-lib.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

const { photos, encoded } = await optimizePhotos({
  srcDir: path.join(root, 'photos'),
  outDir: path.join(root, 'frontend', 'public', 'photos'),
  log: console.log,
})
console.log(`photos: ${photos.length} total, ${encoded} newly optimized`)
