import { Window } from '@wailsio/runtime'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export const LANGUAGES = ['en', 'fr'] as const
export type Lang = (typeof LANGUAGES)[number]

/** Name of each language in that language, shown in the selector. */
export const LANGUAGE_NAMES: Record<Lang, string> = { en: 'English', fr: 'Français' }

export interface Messages {
  title: string
  photos: (n: number) => string
  language: string
  newestFirst: string
  oldestFirst: string
  switchToOldest: string
  switchToNewest: string
  open: (name: string) => string
  close: string
  previous: string
  next: string
  empty: string
  loadError: string
}

const en: Messages = {
  title: 'Gallery',
  photos: (n) => `${n} ${n === 1 ? 'photo' : 'photos'}`,
  language: 'Language',
  newestFirst: 'Most recent first ↓',
  oldestFirst: 'Oldest first ↑',
  switchToOldest: 'Sorted most recent first. Switch to oldest first',
  switchToNewest: 'Sorted oldest first. Switch to most recent first',
  open: (name) => `Open ${name}`,
  close: 'Close',
  previous: 'Previous photo',
  next: 'Next photo',
  empty: 'Add JPEGs to the photos folder and rebuild.',
  loadError: 'Could not load the photo list.',
}

const fr: Messages = {
  title: 'Galerie',
  photos: (n) => `${n} ${n > 1 ? 'photos' : 'photo'}`, // French uses the singular for 0 and 1
  language: 'Langue',
  newestFirst: 'Plus récentes d’abord ↓',
  oldestFirst: 'Plus anciennes d’abord ↑',
  switchToOldest: 'Trié des plus récentes aux plus anciennes. Passer aux plus anciennes d’abord',
  switchToNewest: 'Trié des plus anciennes aux plus récentes. Passer aux plus récentes d’abord',
  open: (name) => `Ouvrir ${name}`,
  close: 'Fermer',
  previous: 'Photo précédente',
  next: 'Photo suivante',
  empty: 'Ajoutez des JPEG dans le dossier photos, puis recompilez.',
  loadError: 'Impossible de charger la liste des photos.',
}

export const MESSAGES: Record<Lang, Messages> = { en, fr }

const STORAGE_KEY = 'gallery.lang'

/**
 * Picks the first supported language from the user's preference list
 * (e.g. `navigator.languages`), matching on the base subtag: "fr-CA" -> "fr".
 */
export function detectLanguage(preferred: readonly string[], fallback: Lang = 'en'): Lang {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split('-')[0]
    const hit = LANGUAGES.find((l) => l === base)
    if (hit) return hit
  }
  return fallback
}

const isLang = (v: unknown): v is Lang => LANGUAGES.includes(v as Lang)

function initialLanguage(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (isLang(saved)) return saved
  } catch {
    // storage unavailable: just follow the system language
  }
  const prefs =
    typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language]
  return detectLanguage(prefs.filter(Boolean))
}

interface I18n {
  lang: Lang
  setLang: (lang: Lang) => void
  t: Messages
}

// Defaults to English so components also work without a provider (e.g. in tests).
const Context = createContext<I18n>({ lang: 'en', setLang: () => {}, t: en })

export function I18nProvider({ children, initial }: { children: ReactNode; initial?: Lang }) {
  const [lang, setLangState] = useState<Lang>(() => initial ?? initialLanguage())

  const setLang = (next: Lang) => {
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // not persisted; applies for this session only
    }
  }

  useEffect(() => {
    document.documentElement.lang = lang
    const title = MESSAGES[lang].title
    document.title = title
    // The native window title; outside Wails (plain browser, tests) there is no window to rename.
    try {
      Window.SetTitle(title).catch(() => {})
    } catch {
      // not running inside Wails
    }
  }, [lang])

  const value = useMemo(() => ({ lang, setLang, t: MESSAGES[lang] }), [lang])
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export const useI18n = () => useContext(Context)
