import type React from 'react'
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { firstRowAt, justify, type Photo } from './layout'

const GAP = 4
const BUFFER_PX = 1200 // render this far above/below the viewport

const Tile = memo(function Tile(props: {
  photo: Photo; x: number; y: number; w: number; h: number; onOpen: (i: number) => void; index: number
}) {
  const { photo, x, y, w, h, onOpen, index } = props
  return (
    <button
      className="tile"
      style={{
        transform: `translate(${x}px, ${y}px)`,
        left: 0, top: 0,
        width: w, height: h,
        backgroundImage: `url(${photo.lqip})`,
      }}
      onClick={() => onOpen(index)}
      aria-label={photo.name}
    >
      <img src={`/photos/${photo.thumb}`} width={photo.w} height={photo.h}
           alt="" decoding="async" draggable={false} />
    </button>
  )
})

function useScrollState(scroller: React.RefObject<HTMLDivElement>) {
  const [state, setState] = useState({ top: 0, width: 0, height: 0 })
  useLayoutEffect(() => {
    const el = scroller.current!
    let raf = 0
    const read = () => {
      raf = 0
      setState((s) =>
        s.top === el.scrollTop && s.width === el.clientWidth && s.height === el.clientHeight
          ? s
          : { top: el.scrollTop, width: el.clientWidth, height: el.clientHeight })
    }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(read) }
    read()
    el.addEventListener('scroll', schedule, { passive: true })
    const ro = new ResizeObserver(schedule)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', schedule); ro.disconnect(); cancelAnimationFrame(raf) }
  }, [scroller])
  return state
}

export default function App() {
  const [photos, setPhotos] = useState<Photo[] | null>(null)
  const [open, setOpen] = useState<number | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const { top, width, height } = useScrollState(scroller)

  useEffect(() => {
    fetch('/photos/manifest.json').then((r) => r.json()).then(setPhotos).catch(() => setPhotos([]))
  }, [])

  // Aim for ~1/4 of the window height per row, clamped to a sensible range.
  const target = Math.max(140, Math.min(320, Math.round(height / 3.2)))
  const layout = useMemo(
    () => (photos && width ? justify(photos, width, target, GAP) : null),
    [photos, width, target],
  )

  const visible = useMemo(() => {
    if (!layout || !photos) return []
    const from = top - BUFFER_PX
    const to = top + height + BUFFER_PX
    const out: React.ReactElement[] = []
    for (let r = firstRowAt(layout.rows, from); r < layout.rows.length && layout.rows[r].top <= to; r++) {
      const row = layout.rows[r]
      for (let i = row.first; i <= row.last; i++) {
        const t = layout.tiles[i]
        out.push(
          <Tile key={photos[t.index].id} photo={photos[t.index]} index={t.index}
                x={t.x} y={t.y} w={t.w} h={t.h} onOpen={setOpen} />,
        )
      }
    }
    return out
  }, [layout, photos, top, height])

  const close = useCallback(() => setOpen(null), [])
  useEffect(() => {
    if (open === null || !photos) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight') setOpen((i) => (i === null ? i : Math.min(photos.length - 1, i + 1)))
      else if (e.key === 'ArrowLeft') setOpen((i) => (i === null ? i : Math.max(0, i - 1)))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, photos, close])

  return (
    <>
      <div className="scroller" ref={scroller}>
        {photos && photos.length === 0 && <div className="empty">Add JPEGs to the photos folder and rebuild.</div>}
        <div className="canvas" style={{ height: layout?.height ?? 0 }}>{visible}</div>
      </div>
      {open !== null && photos && photos[open] && (
        <div className="lightbox" onClick={close}>
          <img src={`/photos/${photos[open].full}`}
               style={{ backgroundImage: `url(${photos[open].lqip})`, backgroundSize: 'cover' }} alt="" />
        </div>
      )}
    </>
  )
}
