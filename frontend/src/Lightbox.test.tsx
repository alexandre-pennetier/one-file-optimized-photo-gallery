// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Lightbox } from './Lightbox'
import type { Photo } from './layout'

const photos: Photo[] = ['a', 'b', 'c'].map((n) => ({
  id: n,
  name: `${n}.jpg`,
  w: 100,
  h: 100,
  thumb: `${n}-t.avif`,
  full: `${n}.avif`,
  lqip: 'data:,',
}))

afterEach(cleanup)

const setup = (index: number) => {
  const onChange = vi.fn()
  const onClose = vi.fn()
  render(<Lightbox photos={photos} index={index} onChange={onChange} onClose={onClose} />)
  return { onChange, onClose }
}

describe('Lightbox', () => {
  it('shows the full-size image as an accessible dialog', () => {
    setup(1)
    expect(screen.getByRole('dialog', { name: 'b.jpg' })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'b.jpg' }).getAttribute('src')).toBe('/photos/b.avif')
  })

  it('navigates with arrow keys and closes on Escape', () => {
    const { onChange, onClose } = setup(1)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenLastCalledWith(2)
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenLastCalledWith(0)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not step past the first or last photo', () => {
    const first = setup(0)
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(first.onChange).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Previous photo' })).toBeNull()
    cleanup()

    const last = setup(2)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(last.onChange).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Next photo' })).toBeNull()
  })

  it('closes on backdrop click but not when clicking the image or arrows', () => {
    const { onChange, onClose } = setup(1)
    fireEvent.click(screen.getByRole('img'))
    fireEvent.click(screen.getByRole('button', { name: 'Next photo' }))
    expect(onClose).not.toHaveBeenCalled()
    expect(onChange).toHaveBeenCalledWith(2)
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('moves focus to the close button and restores it on unmount', () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    const { unmount } = render(<Lightbox photos={photos} index={0} onChange={() => {}} onClose={() => {}} />)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }))
    unmount()
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })
})
