export interface Photo {
  id: string
  name: string
  /** Capture wall-clock time packed as a UTC epoch in ms (EXIF date, else file mtime). Read it with UTC getters. */
  taken: number
  w: number
  h: number
  thumb: string
  full: string
  lqip: string
}

export interface Tile {
  index: number
  x: number
  y: number
  w: number
  h: number
}

export interface Row {
  top: number
  height: number
  first: number // index into tiles
  last: number // inclusive
}

export interface YearHeader {
  year: number
  y: number
  height: number
}

export interface Layout {
  tiles: Tile[]
  rows: Row[]
  headers: YearHeader[]
  height: number
}

export type SortOrder = 'newest' | 'oldest'

export const yearOf = (p: Photo): number => new Date(p.taken).getUTCFullYear()

/** Sorts by capture time; ties fall back to the file name so the order is stable. */
export function sortPhotos(photos: Photo[], order: SortOrder): Photo[] {
  const dir = order === 'newest' ? -1 : 1
  return [...photos].sort((a, b) => dir * (a.taken - b.taken) || dir * a.name.localeCompare(b.name))
}

/**
 * Places `photos` (a contiguous slice of the final list starting at `base`) in
 * justified rows from `y0`: aspect ratios are kept and each full row is scaled to
 * exactly fill `width`. Returns the y after the last row, trailing gap included.
 */
function place(photos: Photo[], width: number, target: number, gap: number, y0: number, base: number) {
  const tiles: Tile[] = []
  const rows: Row[] = []
  let y = y0
  let start = 0
  let ratioSum = 0

  const flush = (end: number, full: boolean) => {
    const n = end - start + 1
    const avail = width - gap * (n - 1)
    // A short last row keeps the target height instead of stretching.
    const h = full ? avail / ratioSum : Math.min(target, avail / ratioSum)
    let x = 0
    for (let i = start; i <= end; i++) {
      const w = (photos[i].w / photos[i].h) * h
      tiles.push({ index: base + i, x, y, w, h })
      x += w + gap
    }
    rows.push({ top: y, height: h, first: base + start, last: base + end })
    y += h + gap
    start = end + 1
    ratioSum = 0
  }

  for (let i = 0; i < photos.length; i++) {
    ratioSum += photos[i].w / photos[i].h
    const n = i - start + 1
    if ((width - gap * (n - 1)) / ratioSum <= target) flush(i, true)
  }
  if (start < photos.length) flush(photos.length - 1, false)

  return { tiles, rows, end: y }
}

/** Justified rows for a flat list. Pure O(n); cheap enough to rerun on every resize. */
export function justify(photos: Photo[], width: number, target: number, gap: number): Layout {
  const { tiles, rows, end } = place(photos, width, target, gap, 0, 0)
  return { tiles, rows, headers: [], height: Math.max(0, end - gap) }
}

/**
 * Like `justify`, but starts a new block of rows, preceded by a year header of
 * `headerHeight` px, whenever the capture year changes. `photos` must already be
 * sorted; tile indexes refer to positions in that list.
 */
export function layoutByYear(
  photos: Photo[],
  width: number,
  target: number,
  gap: number,
  headerHeight: number,
): Layout {
  const tiles: Tile[] = []
  const rows: Row[] = []
  const headers: YearHeader[] = []
  let y = 0

  for (let start = 0; start < photos.length;) {
    const year = yearOf(photos[start])
    let end = start + 1
    while (end < photos.length && yearOf(photos[end]) === year) end++

    headers.push({ year, y, height: headerHeight })
    const section = place(photos.slice(start, end), width, target, gap, y + headerHeight, start)
    tiles.push(...section.tiles)
    rows.push(...section.rows)
    y = section.end
    start = end
  }

  return { tiles, rows, headers, height: Math.max(0, y - gap) }
}

/** Index of the first row whose bottom edge is below `y`. */
export function firstRowAt(rows: Row[], y: number): number {
  let lo = 0
  let hi = rows.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (rows[mid].top + rows[mid].height < y) lo = mid + 1
    else hi = mid
  }
  return lo
}

export interface TakenParts {
  weekday: string
  date: string
  time: string
  /** ISO 8601 date-time for the <time> element. */
  iso: string
}

/** Human-friendly capture date. `taken` is a wall-clock time, so format it as UTC. */
export function formatTaken(taken: number, locale?: string): TakenParts {
  const fmt = (o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { ...o, timeZone: 'UTC' }).format(taken)
  return {
    weekday: fmt({ weekday: 'long' }),
    date: fmt({ day: 'numeric', month: 'long', year: 'numeric' }),
    time: fmt({ hour: 'numeric', minute: '2-digit' }),
    iso: new Date(taken).toISOString().slice(0, 19),
  }
}
