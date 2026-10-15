import { memo, useMemo, useRef } from 'react'
import { firstRowAt, justify, type Photo } from './layout'
import { useViewport } from './useViewport'

const GAP = 4
const BUFFER_PX = 1200 // mounted this far above/below the viewport
const SNAP_PX = 300 // scroll granularity at which the mounted set is recomputed
const MIN_ROW = 140
const MAX_ROW = 320

interface TileProps {
  photo: Photo
  index: number
  x: number
  y: number
  w: number
  h: number
  onOpen: (index: number) => void
}

const Tile = memo(function Tile({ photo, index, x, y, w, h, onOpen }: TileProps) {
  return (
    <button
      type="button"
      className="tile"
      style={{
        transform: `translate(${x}px, ${y}px)`,
        width: w,
        height: h,
        backgroundImage: `url(${photo.lqip})`,
      }}
      onClick={() => onOpen(index)}
      aria-label={`Open ${photo.name}`}
    >
      <img src={`/photos/${photo.thumb}`} width={photo.w} height={photo.h} alt="" decoding="async" draggable={false} />
    </button>
  )
})

export function Gallery({ photos, onOpen }: { photos: Photo[]; onOpen: (index: number) => void }) {
  const scroller = useRef<HTMLDivElement>(null)
  const { top, width, height } = useViewport(scroller, SNAP_PX)

  // Row height follows window height, so resizing the window reflows the grid.
  const target = Math.max(MIN_ROW, Math.min(MAX_ROW, Math.round(height / 3.2)))
  const layout = useMemo(() => (width ? justify(photos, width, target, GAP) : null), [photos, width, target])

  const tiles = useMemo(() => {
    if (!layout) return []
    const from = top - BUFFER_PX
    const to = top + SNAP_PX + height + BUFFER_PX
    const out = []
    for (let r = firstRowAt(layout.rows, from); r < layout.rows.length && layout.rows[r].top <= to; r++) {
      const { first, last } = layout.rows[r]
      for (let i = first; i <= last; i++) {
        const t = layout.tiles[i]
        out.push(
          <Tile key={photos[i].id} photo={photos[i]} index={i} x={t.x} y={t.y} w={t.w} h={t.h} onOpen={onOpen} />,
        )
      }
    }
    return out
  }, [layout, photos, top, height, onOpen])

  return (
    <div className="scroller" ref={scroller}>
      <div className="canvas" style={{ height: layout?.height ?? 0 }}>
        {tiles}
      </div>
    </div>
  )
}
