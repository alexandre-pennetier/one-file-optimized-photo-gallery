import { useEffect, useMemo, useRef, type MouseEvent } from 'react'
import { formatTaken, type Photo } from './layout'

interface Props {
  photos: Photo[]
  index: number
  onChange: (index: number) => void
  onClose: () => void
}

export function Lightbox({ photos, index, onChange, onClose }: Props) {
  const photo = photos[index]
  const taken = useMemo(() => formatTaken(photo.taken), [photo.taken])
  const closeBtn = useRef<HTMLButtonElement>(null)
  const prev = index > 0 ? index - 1 : null
  const next = index < photos.length - 1 ? index + 1 : null

  // Move focus into the dialog, and give it back to the tile on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    closeBtn.current?.focus()
    return () => opener?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && prev !== null) onChange(prev)
      else if (e.key === 'ArrowRight' && next !== null) onChange(next)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prev, next, onChange, onClose])

  // Warm the cache so stepping through photos is instant.
  useEffect(() => {
    for (const i of [prev, next]) {
      if (i !== null) new Image().src = `/photos/${photos[i].full}`
    }
  }, [prev, next, photos])

  const step = (to: number) => (e: MouseEvent) => {
    e.stopPropagation()
    onChange(to)
  }

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={photo.name}
      aria-describedby="lb-caption"
      onClick={onClose}
    >
      <img
        src={`/photos/${photo.full}`}
        alt={photo.name}
        style={{ backgroundImage: `url(${photo.lqip})` }}
        onClick={(e) => e.stopPropagation()}
      />
      <div id="lb-caption" className="lb-caption" key={photo.id}>
        <span className="lb-weekday">{taken.weekday}</span>
        <time className="lb-date" dateTime={taken.iso}>
          {taken.date}
        </time>
        <span className="lb-meta">
          {taken.time}
          <i aria-hidden="true">·</i>
          {index + 1} / {photos.length}
        </span>
      </div>
      <button ref={closeBtn} type="button" className="lb-btn lb-close" aria-label="Close" onClick={onClose}>
        ×
      </button>
      {prev !== null && (
        <button type="button" className="lb-btn lb-prev" aria-label="Previous photo" onClick={step(prev)}>
          ‹
        </button>
      )}
      {next !== null && (
        <button type="button" className="lb-btn lb-next" aria-label="Next photo" onClick={step(next)}>
          ›
        </button>
      )}
    </div>
  )
}
