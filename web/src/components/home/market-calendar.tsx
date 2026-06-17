import type { MarketEvent, MarketEventCategory } from '@/lib/types/api'

// ---------------------------------------------------------------------------
// MarketCalendar — server component. Renders upcoming "Important Dates":
// index rebalancing (MSCI/FTSE), monetary decisions (BI rate/Fed), and macro
// releases (GDP/CPI). SSR-safe: dates formatted via a static month table, no
// toLocaleString / new Date() in render.
// ---------------------------------------------------------------------------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Shared fixed height with the news column (keep in sync with market-news-list.tsx).
const COLUMN_HEIGHT = 'h-[480px]'

// Deterministic date format from a YYYY-MM-DD string (no Date parsing).
function formatEventDate(iso: string): { day: string; month: string } {
  const [, m, d] = iso.split('-')
  const monthIdx = Number(m) - 1
  return { day: String(Number(d)), month: MONTHS[monthIdx] ?? '' }
}

const CATEGORY_STYLES: Record<MarketEventCategory, { label: string; chip: string; bar: string }> = {
  index_rebalance: { label: 'Rebalance', chip: 'bg-purple-50 text-purple-600', bar: 'bg-purple-400' },
  rerating:        { label: 'Re-rating', chip: 'bg-rose-50 text-rose-600',     bar: 'bg-rose-400' },
  monetary:        { label: 'Monetary',  chip: 'bg-blue-50 text-blue-600',     bar: 'bg-blue-400' },
  macro_release:   { label: 'Macro',     chip: 'bg-green-50 text-green-600',   bar: 'bg-green-400' },
  global:          { label: 'Global',    chip: 'bg-amber-50 text-amber-600',   bar: 'bg-amber-400' },
  rups:            { label: 'RUPS',      chip: 'bg-purple-50 text-purple-600', bar: 'bg-purple-400' },
  dividend:        { label: 'Dividend',  chip: 'bg-green-50 text-green-600',   bar: 'bg-green-400' },
  public_expose:   { label: 'Expose',    chip: 'bg-blue-50 text-blue-600',     bar: 'bg-blue-400' },
  other:           { label: 'Event',     chip: 'bg-gray-100 text-gray-600',    bar: 'bg-gray-300' },
}

function EventRow({ event }: { event: MarketEvent }) {
  const { day, month } = formatEventDate(event.eventDate)
  const style = CATEGORY_STYLES[event.category ?? 'other'] ?? CATEGORY_STYLES.other
  const isHighVol = event.volatility === 'high'

  return (
    <li
      className={`flex gap-3 border-b border-gray-100 py-2 last:border-0 ${
        isHighVol ? '-mx-2 rounded bg-amber-50/60 px-2' : ''
      }`}
    >
      <div className={`flex-shrink-0 w-1 rounded ${style.bar}`} aria-hidden />
      <div className="flex-shrink-0 w-10 text-center">
        <div className="text-sm font-bold leading-none text-gray-900 tabular-nums">{day}</div>
        <div className="text-[10px] uppercase text-gray-400">{month}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${style.chip}`}>
            {style.label}
          </span>
          {isHighVol && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
              ⚠ volatile
            </span>
          )}
          {event.source && <span className="text-[10px] text-gray-400">{event.source}</span>}
        </div>
        <div className="mt-0.5 truncate text-sm text-gray-800">{event.title}</div>
        {event.note && <div className="truncate text-[11px] text-gray-400">{event.note}</div>}
      </div>
    </li>
  )
}

export function MarketCalendar({ events }: { events: MarketEvent[] }) {
  if (events.length === 0) return null

  return (
    <div className={`flex ${COLUMN_HEIGHT} flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm`}>
      <h2 className="mb-2 flex-shrink-0 text-sm font-semibold text-gray-900">Important Dates</h2>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {events.map((event) => (
          <EventRow key={`${event.eventDate}-${event.title}`} event={event} />
        ))}
      </ul>
    </div>
  )
}
