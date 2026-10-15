import { describe, expect, it } from 'vitest'
import { firstRowAt, justify, type Photo } from './layout'

const photo = (w: number, h: number, i = 0): Photo => ({
  id: String(i),
  name: `${i}.jpg`,
  w,
  h,
  thumb: '',
  full: '',
  lqip: '',
})
const photos = (n: number) => Array.from({ length: n }, (_, i) => photo(1000 + (i % 3) * 400, 1000, i))

describe('justify', () => {
  it('fills the width exactly on every full row', () => {
    const width = 900
    const gap = 4
    const { tiles, rows } = justify(photos(20), width, 200, gap)
    for (const row of rows.slice(0, -1)) {
      const rowTiles = tiles.slice(row.first, row.last + 1)
      const sum = rowTiles.reduce((s, t) => s + t.w, 0) + gap * (rowTiles.length - 1)
      expect(sum).toBeCloseTo(width, 5)
    }
  })

  it('keeps aspect ratios', () => {
    const list = photos(10)
    const { tiles } = justify(list, 800, 180, 4)
    for (const t of tiles) expect(t.w / t.h).toBeCloseTo(list[t.index].w / list[t.index].h, 5)
  })

  it('does not stretch a short last row beyond the target height', () => {
    const { rows } = justify([photo(1000, 1000, 0)], 1000, 200, 4)
    expect(rows).toHaveLength(1)
    expect(rows[0].height).toBeLessThanOrEqual(200)
  })

  it('reports a height covering all rows and handles no photos', () => {
    const l = justify(photos(15), 700, 160, 4)
    const last = l.rows[l.rows.length - 1]
    expect(l.height).toBeCloseTo(last.top + last.height, 5)
    expect(justify([], 700, 160, 4)).toEqual({ tiles: [], rows: [], height: 0 })
  })
})

describe('firstRowAt', () => {
  const { rows } = justify(photos(40), 900, 200, 4)

  it('finds the row containing y', () => {
    for (const [i, r] of rows.entries()) {
      expect(firstRowAt(rows, r.top + r.height / 2)).toBe(i)
    }
  })

  it('clamps outside the range', () => {
    expect(firstRowAt(rows, -100)).toBe(0)
    expect(firstRowAt(rows, 1e9)).toBe(rows.length)
  })
})
