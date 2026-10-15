// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
const setTitle = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
vi.mock('@wailsio/runtime', () => ({ Window: { SetTitle: setTitle } }))

import { detectLanguage, I18nProvider, LANGUAGES, MESSAGES } from './i18n'

describe('detectLanguage', () => {
  it('picks the first supported language, matching the base subtag', () => {
    expect(detectLanguage(['fr-CA', 'en-US'])).toBe('fr')
    expect(detectLanguage(['de-DE', 'FR', 'en'])).toBe('fr')
    expect(detectLanguage(['en-GB'])).toBe('en')
  })

  it('falls back to English for unsupported or missing languages', () => {
    expect(detectLanguage(['de-DE', 'ja'])).toBe('en')
    expect(detectLanguage([])).toBe('en')
  })
})

describe('messages', () => {
  it('French defines every key English does, with no empty strings', () => {
    for (const lang of LANGUAGES) {
      expect(Object.keys(MESSAGES[lang]).sort()).toEqual(Object.keys(MESSAGES.en).sort())
      for (const v of Object.values(MESSAGES[lang])) {
        if (typeof v === 'string') expect(v.length).toBeGreaterThan(0)
      }
    }
  })

  it('pluralizes photo counts per language', () => {
    expect(MESSAGES.en.photos(1)).toBe('1 photo')
    expect(MESSAGES.en.photos(0)).toBe('0 photos')
    expect(MESSAGES.fr.photos(0)).toBe('0 photo')
    expect(MESSAGES.fr.photos(1)).toBe('1 photo')
    expect(MESSAGES.fr.photos(2)).toBe('2 photos')
  })
})

describe('language in the app', () => {
  const photo = {
    id: 'a',
    name: 'a.jpg',
    taken: Date.UTC(2026, 8, 12, 16, 40),
    w: 1500,
    h: 1000,
    thumb: 'a-t.avif',
    full: 'a.avif',
    lqip: 'data:,',
  }
  const setLanguages = (langs: string[]) => vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(langs)

  beforeEach(() => {
    localStorage.clear()
    setTitle.mockClear()
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(900)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(700)
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    )
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([photo]) }))
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const renderApp = () =>
    render(
      <I18nProvider>
        <App />
      </I18nProvider>,
    )

  it('starts in French when the system language is French', async () => {
    setLanguages(['fr-FR', 'en-US'])
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Galerie' })).toBeTruthy()
    expect(screen.getByText('1 photo')).toBeTruthy()
    expect(document.documentElement.lang).toBe('fr')
    expect(screen.getByRole('combobox').textContent).toContain('Français')
    expect(setTitle).toHaveBeenLastCalledWith('Galerie') // native window title
  })

  it('starts in English for any other system language', async () => {
    setLanguages(['de-DE'])
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Gallery' })).toBeTruthy()
    expect(document.documentElement.lang).toBe('en')
  })

  it('switches language from the dropdown, translating the UI and dates, and remembers it', async () => {
    setLanguages(['en-US'])
    renderApp()
    await screen.findByRole('heading', { name: 'Gallery' })

    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(screen.getByRole('option', { name: /Français/ }))

    expect(screen.getByRole('heading', { name: 'Galerie' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Passer aux plus anciennes/ })).toBeTruthy()
    expect(screen.getByText('Plus récentes d’abord ↓')).toBeTruthy()
    expect(localStorage.getItem('gallery.lang')).toBe('fr')
    expect(setTitle).toHaveBeenLastCalledWith('Galerie')
    expect(document.title).toBe('Galerie')

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir a.jpg' }))
    expect(screen.getByText('samedi')).toBeTruthy()
    expect(screen.getByText('12 septembre 2026')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Fermer' })).toBeTruthy()
  })

  it('lists each language with a flag and closes after choosing', async () => {
    setLanguages(['en-US'])
    renderApp()
    fireEvent.click(await screen.findByRole('combobox'))
    const options = screen.getAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual(['English', 'Français'])
    for (const o of options) expect(o.querySelector('svg.flag')).toBeTruthy()
    expect(screen.getByRole('option', { name: 'English' }).getAttribute('aria-selected')).toBe('true')

    fireEvent.click(screen.getByRole('option', { name: /Français/ }))
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('is operable with the keyboard', async () => {
    setLanguages(['en-US'])
    renderApp()
    const box = await screen.findByRole('combobox')
    fireEvent.keyDown(box, { key: 'ArrowDown' }) // open
    expect(box.getAttribute('aria-expanded')).toBe('true')
    fireEvent.keyDown(box, { key: 'ArrowDown' }) // move to Français
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(screen.getByRole('heading', { name: 'Galerie' })).toBeTruthy()
    fireEvent.keyDown(box, { key: 'ArrowDown' })
    fireEvent.keyDown(box, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('prefers the saved choice over the system language', async () => {
    localStorage.setItem('gallery.lang', 'en')
    setLanguages(['fr-FR'])
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Gallery' })).toBeTruthy()
  })
})
