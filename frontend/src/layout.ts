export interface Photo {
  id: string;
  name: string;
  w: number;
  h: number;
  thumb: string;
  full: string;
  lqip: string;
}

export interface Tile {
  index: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Row {
  top: number;
  height: number;
  first: number; // index into tiles
  last: number; // inclusive
}

export interface Layout {
  tiles: Tile[];
  rows: Row[];
  height: number;
}

/**
 * Justified rows: photos keep their aspect ratio, each row is scaled so it
 * exactly fills `width`. Pure O(n); cheap enough to rerun on every resize.
 */
export function justify(photos: Photo[], width: number, target: number, gap: number): Layout {
  const tiles: Tile[] = [];
  const rows: Row[] = [];
  let y = 0;
  let start = 0;
  let ratioSum = 0;

  const flush = (end: number, full: boolean) => {
    const n = end - start + 1;
    const avail = width - gap * (n - 1);
    // A short last row keeps the target height instead of stretching.
    const h = full ? avail / ratioSum : Math.min(target, avail / ratioSum);
    let x = 0;
    for (let i = start; i <= end; i++) {
      const w = (photos[i].w / photos[i].h) * h;
      tiles.push({ index: i, x, y, w, h });
      x += w + gap;
    }
    rows.push({ top: y, height: h, first: start, last: end });
    y += h + gap;
    start = end + 1;
    ratioSum = 0;
  };

  for (let i = 0; i < photos.length; i++) {
    ratioSum += photos[i].w / photos[i].h;
    const n = i - start + 1;
    if ((width - gap * (n - 1)) / ratioSum <= target) flush(i, true);
  }
  if (start < photos.length) flush(photos.length - 1, false);

  return { tiles, rows, height: Math.max(0, y - gap) };
}

/** Index of the first row whose bottom edge is below `y`. */
export function firstRowAt(rows: Row[], y: number): number {
  let lo = 0;
  let hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid].top + rows[mid].height < y) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
