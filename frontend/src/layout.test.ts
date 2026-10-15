import { describe, expect, it } from 'vitest'
import { firstRowAt, justify, layoutByYear, formatTaken, sortPhotos, yearOf, type Photo } from './layout'

const photo = (w: number, h: number, i = 0): Photo => ({
  id: String(i),
  name: `${i}.jpg`,
  taken: 0,
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
    expect(justify([], 700, 160, 4)).toEqual({ tiles: [], rows: [], headers: [], height: 0 })
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

const at = (iso: string, name: string, w = 1500, h = 1000): Photo => ({
  ...photo(w, h),
  name,
  id: name,
  taken: new Date(iso).getTime(),
})

describe('sortPhotos', () => {
  const list = [
    at('2021-06-01T12:00:00Z', 'b.jpg'),
    at('2023-01-15T12:00:00Z', 'c.jpg'),
    at('2021-06-01T12:00:00Z', 'a.jpg'),
  ]

  it('sorts most recent first, breaking ties by name', () => {
    expect(sortPhotos(list, 'newest').map((p) => p.name)).toEqual(['c.jpg', 'b.jpg', 'a.jpg'])
  })

  it('sorts oldest first, breaking ties by name', () => {
    expect(sortPhotos(list, 'oldest').map((p) => p.name)).toEqual(['a.jpg', 'b.jpg', 'c.jpg'])
  })

  it('does not mutate its input', () => {
    const copy = [...list]
    sortPhotos(list, 'newest')
    expect(list).toEqual(copy)
  })
})

describe('layoutByYear', () => {
  const list = sortPhotos(
    [
      at('2024-03-01T10:00:00Z', '2024-a.jpg'),
      at('2024-09-01T10:00:00Z', '2024-b.jpg'),
      at('2022-05-01T10:00:00Z', '2022-a.jpg'),
      at('2022-06-01T10:00:00Z', '2022-b.jpg'),
      at('2022-07-01T10:00:00Z', '2022-c.jpg'),
      at('2019-12-31T10:00:00Z', '2019-a.jpg'),
    ],
    'newest',
  )

  it('emits one header per year, in list order', () => {
    const { headers } = layoutByYear(list, 800, 200, 4, 60)
    expect(headers.map((h) => h.year)).toEqual([2024, 2022, 2019])
  })

  it('puts every photo of a year below its header and above the next one', () => {
    const { tiles, headers } = layoutByYear(list, 800, 200, 4, 60)
    for (const [k, header] of headers.entries()) {
      const next = headers[k + 1]
      for (const t of tiles) {
        if (yearOf(list[t.index]) !== header.year) continue
        expect(t.y).toBeGreaterThanOrEqual(header.y + header.height)
        if (next) expect(t.y + t.h).toBeLessThanOrEqual(next.y)
      }
    }
  })

  it('keeps tile indexes aligned with the sorted list and rows contiguous', () => {
    const { tiles, rows } = layoutByYear(list, 800, 200, 4, 60)
    expect(tiles.map((t) => t.index)).toEqual(list.map((_, i) => i))
    expect(rows[0].first).toBe(0)
    expect(rows[rows.length - 1].last).toBe(list.length - 1)
    for (let i = 1; i < rows.length; i++) expect(rows[i].first).toBe(rows[i - 1].last + 1)
  })

  it('has no header and no height for an empty list', () => {
    expect(layoutByYear([], 800, 200, 4, 60)).toEqual({ tiles: [], rows: [], headers: [], height: 0 })
  })

  it('reserves a single header for one year', () => {
    const one = list.filter((p) => yearOf(p) === 2022)
    const { headers, rows } = layoutByYear(one, 800, 200, 4, 60)
    expect(headers).toHaveLength(1)
    expect(rows[0].top).toBe(60)
  })
})

describe('formatTaken', () => {
  const taken = Date.UTC(2026, 8, 12, 16, 40, 23) // wall clock 2026-09-12 16:40:23

  it('formats weekday, date and time of the wall clock', () => {
    const f = formatTaken(taken, 'en-US')
    expect(f.weekday).toBe('Saturday')
    expect(f.date).toBe('September 12, 2026')
    expect(f.time).toMatch(/^4:40\sPM$/)
    expect(f.iso).toBe('2026-09-12T16:40:23')
  })

  it('does not shift the day around midnight', () => {
    const f = formatTaken(Date.UTC(2024, 11, 31, 23, 59, 30), 'en-US')
    expect(f.date).toBe('December 31, 2024')
    expect(f.iso).toBe('2024-12-31T23:59:30')
  })

  it('localizes', () => {
    expect(formatTaken(taken, 'fr-FR').weekday).toBe('samedi')
  })
})
