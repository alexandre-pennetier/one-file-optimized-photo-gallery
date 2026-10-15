import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { LANGUAGES, LANGUAGE_NAMES, useI18n, type Lang } from './i18n'

/**
 * Flags are inline SVG, not emoji: Windows has no flag glyphs and renders
 * regional indicators as the letters "GB" / "FR".
 */
function Flag({ lang }: { lang: Lang }) {
  const common = { className: 'flag', width: 20, height: 14, 'aria-hidden': true as const }
  if (lang === 'fr') {
    return (
      <svg {...common} viewBox="0 0 3 2" preserveAspectRatio="none">
        <rect width="1" height="2" fill="#0055a4" />
        <rect x="1" width="1" height="2" fill="#fff" />
        <rect x="2" width="1" height="2" fill="#ef4135" />
      </svg>
    )
  }
  return (
    <svg {...common} viewBox="0 0 60 30" preserveAspectRatio="none">
      <clipPath id="gb-s">
        <path d="M0,0 v30 h60 v-30 z" />
      </clipPath>
      <clipPath id="gb-t">
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <g clipPath="url(#gb-s)">
        <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
        <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#gb-t)" stroke="#c8102e" strokeWidth="4" />
        <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
        <path d="M30,0 v30 M0,15 h60" stroke="#c8102e" strokeWidth="6" />
      </g>
    </svg>
  )
}

export function LanguageSelect() {
  const { t, lang, setLang } = useI18n()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(LANGUAGES.indexOf(lang))
  const root = useRef<HTMLDivElement>(null)
  const listId = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const show = () => {
    setActive(LANGUAGES.indexOf(lang))
    setOpen(true)
  }
  const choose = (l: Lang) => {
    setLang(l)
    setOpen(false)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        show()
      }
      return
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActive((i) => (i + 1) % LANGUAGES.length)
        break
      case 'ArrowUp':
        e.preventDefault()
        setActive((i) => (i - 1 + LANGUAGES.length) % LANGUAGES.length)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        choose(LANGUAGES[active])
        break
      case 'Escape':
        e.preventDefault()
        e.stopPropagation()
        setOpen(false)
        break
      case 'Tab':
        setOpen(false)
        break
    }
  }

  return (
    <div className="lang" ref={root}>
      <button
        type="button"
        className="lang-btn"
        role="combobox"
        aria-label={t.language}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${LANGUAGES[active]}` : undefined}
        title={t.language}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
      >
        <Flag lang={lang} />
        <span>{LANGUAGE_NAMES[lang]}</span>
        <svg className="chevron" width="10" height="6" viewBox="0 0 10 6" aria-hidden="true">
          <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
      {open && (
        <ul className="lang-list" id={listId} role="listbox" aria-label={t.language}>
          {LANGUAGES.map((l, i) => (
            <li
              key={l}
              id={`${listId}-${l}`}
              role="option"
              lang={l}
              aria-selected={l === lang}
              className={i === active ? 'active' : undefined}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(l)}
            >
              <Flag lang={l} />
              <span>{LANGUAGE_NAMES[l]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
