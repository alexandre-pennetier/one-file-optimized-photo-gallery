// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const respond = (body: unknown, ok = true, status = 200) =>
  vi.fn().mockResolvedValue({ ok, status, json: () => Promise.resolve(body) })

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('App', () => {
  it('asks for photos when the manifest is empty', async () => {
    vi.stubGlobal('fetch', respond([]))
    render(<App />)
    expect(await screen.findByText(/Add JPEGs to the photos folder/)).toBeTruthy()
  })

  it('shows an error when the manifest cannot be loaded', async () => {
    vi.stubGlobal('fetch', respond(null, false, 404))
    render(<App />)
    expect(await screen.findByText(/Could not load the photo list/)).toBeTruthy()
  })

  it('shows an error when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    render(<App />)
    await waitFor(() => expect(screen.getByText(/Could not load the photo list/)).toBeTruthy())
  })

  it('requests the generated manifest', async () => {
    const fetchMock = respond([])
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)
    await screen.findByText(/Add JPEGs/)
    expect(fetchMock.mock.calls[0][0]).toBe('/photos/manifest.json')
  })

  describe('with photos', () => {
    const photo = (name: string, iso: string) => ({
      id: name,
      name,
      taken: new Date(iso).getTime(),
      w: 1500,
      h: 1000,
      thumb: `${name}-t.avif`,
      full: `${name}.avif`,
      lqip: 'data:,',
    })
    const manifest = [
      photo('a.jpg', '2020-05-01T10:00:00Z'),
      photo('b.jpg', '2024-05-01T10:00:00Z'),
      photo('c.jpg', '2022-05-01T10:00:00Z'),
    ]
    const years = () => screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)

    beforeEach(() => {
      vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(900)
      vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(700)
      vi.stubGlobal('fetch', respond(manifest))
    })

    it('groups by year, most recent first by default', async () => {
      render(<App />)
      await screen.findByRole('button', { name: /Switch to oldest first/ })
      expect(years()).toEqual(['2024', '2022', '2020'])
      expect(screen.getByText('3 photos')).toBeTruthy()
      expect(screen.getByRole('button', { name: /Switch to oldest first/ }).textContent).toBe('Most recent first ↓')
    })

    it('reverses the groups when the order button is clicked, and back', async () => {
      render(<App />)
      fireEvent.click(await screen.findByRole('button', { name: /Switch to oldest first/ }))
      expect(years()).toEqual(['2020', '2022', '2024'])
      fireEvent.click(screen.getByRole('button', { name: /Switch to most recent first/ }))
      expect(years()).toEqual(['2024', '2022', '2020'])
    })

    it('opens the lightbox on the photo that was clicked in the sorted order', async () => {
      render(<App />)
      await screen.findByRole('button', { name: /Switch to oldest first/ })
      fireEvent.click(screen.getByRole('button', { name: 'Open b.jpg' }))
      expect(screen.getByRole('dialog', { name: 'b.jpg' })).toBeTruthy()
    })
  })
})
