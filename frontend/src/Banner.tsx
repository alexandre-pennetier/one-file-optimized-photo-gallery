import { useI18n } from './i18n'
import { LanguageSelect } from './LanguageSelect'
import type { SortOrder } from './layout'

interface Props {
  count: number
  order: SortOrder
  onToggle: () => void
}

export function Banner({ count, order, onToggle }: Props) {
  const { t } = useI18n()
  const newest = order === 'newest'
  return (
    <header className="banner">
      {/* Not shown (the window title already says it) but kept for screen readers. */}
      <h1 className="sr-only">{t.title}</h1>
      <LanguageSelect />
      <button
        type="button"
        className="sort"
        onClick={onToggle}
        aria-label={newest ? t.switchToOldest : t.switchToNewest}
      >
        {newest ? t.newestFirst : t.oldestFirst}
      </button>
      <span className="count">{t.photos(count)}</span>
    </header>
  )
}
