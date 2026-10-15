// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Gallery } from './Gallery'
import type { Photo } from './layout'

const photos: Photo[] = Array.from({ length: 2000 }, (_, i) => ({
  id: String(i),
  name: `${i}.jpg`,
  w: 1500,
  h: 1000,
  thumb: `${i}-t.avif`,
  full: `${i}.avif`,
  lqip: 'data:,',
}))

let resizeCallbacks: Array<() => void> = []

beforeEach(() => {
  // jsdom has no layout: report the container size from `size`.
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => size.width)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(() => size.height)
  resizeCallbacks = []
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(cb: () => void) {
        resizeCallbacks.push(cb)
      }
      observe() {}
      disconnect() {}
    },
  )
  // Run animation frames synchronously so state updates are observable.
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0)
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', () => {})
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const size = { width: 1000, height: 800 }

const mount = (width = 1000, height = 800) => {
  size.width = width
  size.height = height
  const onOpen = vi.fn()
  const view = render(<Gallery photos={photos} onOpen={onOpen} />)
  return { ...view, scroller: view.container.querySelector('.scroller') as HTMLElement, onOpen }
}

describe('Gallery', () => {
  it('mounts only a window of the photos, not all of them', () => {
    const { container } = mount()
    const n = container.querySelectorAll('.tile').length
    expect(n).toBeGreaterThan(0)
    expect(n).toBeLessThan(100)
  })

  it('reserves the full scroll height for all rows', () => {
    const { container } = mount()
    const canvas = container.querySelector('.canvas') as HTMLElement
    expect(parseFloat(canvas.style.height)).toBeGreaterThan(10_000)
  })

  it('swaps the mounted tiles as the user scrolls', () => {
    const { container, scroller } = mount()
    const first = container.querySelector('.tile img')?.getAttribute('src')

    scroller.scrollTop = 20_000
    act(() => {
      fireEvent.scroll(scroller)
    })

    const srcs = [...container.querySelectorAll('.tile img')].map((i) => i.getAttribute('src'))
    expect(srcs.length).toBeGreaterThan(0)
    expect(srcs).not.toContain(first)
  })

  it('relayouts when the container is resized', () => {
    const { container } = mount(1000, 800)
    const canvas = container.querySelector('.canvas') as HTMLElement
    const before = parseFloat(canvas.style.height)

    size.width = 400
    act(() => resizeCallbacks.forEach((cb) => cb()))

    expect(parseFloat(canvas.style.height)).not.toBe(before) // layout was recomputed for the new width
  })

  it('reports the index of the clicked photo', () => {
    const { container, onOpen } = mount()
    const tiles = container.querySelectorAll<HTMLButtonElement>('.tile')
    fireEvent.click(tiles[3])
    expect(onOpen).toHaveBeenCalledWith(3)
  })
})
