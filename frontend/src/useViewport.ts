import { useLayoutEffect, useState, type RefObject } from 'react'

export interface Viewport {
  /** scrollTop, snapped down to a multiple of `snap` so consumers re-render rarely. */
  top: number
  width: number
  height: number
}

/**
 * Tracks the scroll position and size of an element. Updates are coalesced to one
 * per animation frame, and the scroll offset is snapped to `snap` px: windowing only
 * needs to know when the buffered range could change, not every pixel.
 */
export function useViewport(ref: RefObject<HTMLElement | null>, snap: number): Viewport {
  const [vp, setVp] = useState<Viewport>({ top: 0, width: 0, height: 0 })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0

    const read = () => {
      raf = 0
      const top = Math.floor(el.scrollTop / snap) * snap
      const { clientWidth: width, clientHeight: height } = el
      setVp((v) => (v.top === top && v.width === width && v.height === height ? v : { top, width, height }))
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(read)
    }

    read()
    el.addEventListener('scroll', schedule, { passive: true })
    const ro = new ResizeObserver(schedule)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', schedule)
      ro.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [ref, snap])

  return vp
}
