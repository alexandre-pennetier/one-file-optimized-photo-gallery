import type { SortOrder } from './layout'

interface Props {
  count: number
  order: SortOrder
  onToggle: () => void
}

export function Banner({ count, order, onToggle }: Props) {
  const newest = order === 'newest'
  return (
    <header className="banner">
      <h1>Gallery</h1>
      <span className="count">{count} photos</span>
      <button
        type="button"
        className="sort"
        onClick={onToggle}
        aria-label={
          newest
            ? 'Sorted most recent first. Switch to oldest first'
            : 'Sorted oldest first. Switch to most recent first'
        }
      >
        {newest ? 'Most recent first ↓' : 'Oldest first ↑'}
      </button>
    </header>
  )
}
