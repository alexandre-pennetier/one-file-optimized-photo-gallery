// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
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
})
