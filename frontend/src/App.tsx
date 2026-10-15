import { useCallback, useEffect, useMemo, useState } from 'react'
import { Banner } from './Banner'
import { Gallery } from './Gallery'
import { useI18n } from './i18n'
import { Lightbox } from './Lightbox'
import { sortPhotos, type Photo, type SortOrder } from './layout'

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; photos: Photo[] }

export default function App() {
  const { t } = useI18n()
  const [state, setState] = useState<State>({ status: 'loading' })
  const [order, setOrder] = useState<SortOrder>('newest')
  const [open, setOpen] = useState<number | null>(null)
  const close = useCallback(() => setOpen(null), [])

  useEffect(() => {
    const ctrl = new AbortController()
    fetch('/photos/manifest.json', { signal: ctrl.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`manifest: HTTP ${r.status}`)
        return r.json() as Promise<Photo[]>
      })
      .then((photos) => setState({ status: 'ready', photos }))
      .catch((err) => {
        if (ctrl.signal.aborted) return
        console.error(err)
        setState({ status: 'error' })
      })
    return () => ctrl.abort()
  }, [])

  const sorted = useMemo(() => (state.status === 'ready' ? sortPhotos(state.photos, order) : []), [state, order])

  if (state.status === 'loading') return null
  if (state.status === 'error') return <div className="empty">{t.loadError}</div>
  if (state.photos.length === 0) return <div className="empty">{t.empty}</div>

  return (
    <div className="app">
      <Banner
        count={sorted.length}
        order={order}
        onToggle={() => {
          setOpen(null)
          setOrder((o) => (o === 'newest' ? 'oldest' : 'newest'))
        }}
      />
      {/* Remounted on reorder so the scroll position resets to the top. */}
      <Gallery key={order} photos={sorted} onOpen={setOpen} />
      {open !== null && <Lightbox photos={sorted} index={open} onChange={setOpen} onClose={close} />}
    </div>
  )
}
