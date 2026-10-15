import { useCallback, useEffect, useState } from 'react'
import { Gallery } from './Gallery'
import { Lightbox } from './Lightbox'
import type { Photo } from './layout'

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; photos: Photo[] }

export default function App() {
  const [state, setState] = useState<State>({ status: 'loading' })
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

  if (state.status === 'loading') return null
  if (state.status === 'error') return <div className="empty">Could not load the photo list.</div>
  if (state.photos.length === 0) return <div className="empty">Add JPEGs to the photos folder and rebuild.</div>

  return (
    <>
      <Gallery photos={state.photos} onOpen={setOpen} />
      {open !== null && <Lightbox photos={state.photos} index={open} onChange={setOpen} onClose={close} />}
    </>
  )
}
