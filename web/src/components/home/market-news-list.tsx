'use client'

import { useMemo, useState } from 'react'
import type { MarketNewsItem } from '@/lib/types/api'

// ---------------------------------------------------------------------------
// MarketNewsList — client component. Renders a source-filter chip row above the
// news list. "All" round-robins across sources so no single outlet dominates;
// selecting a source shows that outlet's recent headlines. Receives the full
// pool (newest-first) from the server and filters/diversifies on the client.
// ---------------------------------------------------------------------------

const DISPLAY_LIMIT = 18
// Shared fixed height for both Market Pulse columns (news + calendar) so they
// stay level; the row list scrolls internally rather than stretching the page.
// Keep in sync with market-calendar.tsx.
const COLUMN_HEIGHT = 'h-[480px]'

/**
 * Round-robin headlines across sources: take the newest from each source in
 * turn until `limit` is reached. Input must already be sorted newest-first.
 * Deterministic, so SSR and client render identically.
 */
function diversifyBySource(items: MarketNewsItem[], limit: number): MarketNewsItem[] {
  const bySource = new Map<string, MarketNewsItem[]>()
  for (const item of items) {
    const list = bySource.get(item.source) ?? []
    list.push(item)
    bySource.set(item.source, list)
  }
  const queues = [...bySource.values()]
  const out: MarketNewsItem[] = []
  let progressed = true
  while (out.length < limit && progressed) {
    progressed = false
    for (const queue of queues) {
      if (queue.length === 0) continue
      out.push(queue.shift()!)
      progressed = true
      if (out.length >= limit) break
    }
  }
  return out
}

function NewsRow({ item }: { item: MarketNewsItem }) {
  // Static date slice — SSR-safe, no Date parsing in render.
  const day = item.publishedAt ? item.publishedAt.slice(0, 10) : ''
  return (
    <li className="border-b border-gray-100 last:border-0">
      <a
        href={item.link}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-baseline gap-2 py-2 hover:bg-gray-50 -mx-2 px-2 rounded transition-colors"
      >
        <span className="flex-shrink-0 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">
          {item.source}
        </span>
        <span className="flex-1 truncate text-sm text-gray-800">{item.title}</span>
        {day && <span className="flex-shrink-0 text-[11px] text-gray-400 tabular-nums">{day}</span>}
      </a>
    </li>
  )
}

function Chip({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
        active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {label} <span className={active ? 'text-blue-100' : 'text-gray-400'}>{count}</span>
    </button>
  )
}

export function MarketNewsList({ news }: { news: MarketNewsItem[] }) {
  // null = "All" (diversified across sources).
  const [selectedSource, setSelectedSource] = useState<string | null>(null)

  // Sources present in the pool, ordered by headline count (desc).
  const sources = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of news) counts.set(item.source, (counts.get(item.source) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [news])

  const visible = useMemo(() => {
    if (selectedSource === null) return diversifyBySource(news, DISPLAY_LIMIT)
    return news.filter((n) => n.source === selectedSource).slice(0, DISPLAY_LIMIT)
  }, [news, selectedSource])

  if (news.length === 0) return null

  return (
    <div className={`flex ${COLUMN_HEIGHT} flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">Market News</h2>
      </div>

      <div className="mb-2 flex flex-shrink-0 items-center gap-2 overflow-x-auto pb-1">
        <Chip
          label="All"
          count={news.length}
          active={selectedSource === null}
          onClick={() => setSelectedSource(null)}
        />
        {sources.map(([source, count]) => (
          <Chip
            key={source}
            label={source}
            count={count}
            active={selectedSource === source}
            onClick={() => setSelectedSource(source)}
          />
        ))}
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto">
        {visible.map((item) => (
          <NewsRow key={item.id} item={item} />
        ))}
      </ul>
    </div>
  )
}
