import { getMarketPulse } from '@/lib/queries/market-pulse'
import { fmtNumID, formatIDR, formatPercent } from '@/lib/calculations/formatters'
import type { MarketIndicator } from '@/lib/types/api'
import { MarketNewsList } from '@/components/home/market-news-list'

// ---------------------------------------------------------------------------
// MarketPulseHeader — server component. Renders a row of market-indicator
// cards (FX, indices, commodities, minerba reference prices) plus a list of
// Indonesian-market news headlines. Reads via getMarketPulse() directly.
//
// SSR-safe: all formatting goes through deterministic formatters; dates are
// rendered as a static YYYY-MM-DD slice (no `new Date()` / toLocaleString in
// render), so this stays a server component with no mount guard.
// ---------------------------------------------------------------------------

function formatIndicatorValue(ind: MarketIndicator): string {
  if (ind.value === null) return '—'
  if (ind.category === 'fx') return formatIDR(ind.value)
  // Indices and commodities: thousands-separated, 2 decimals.
  return fmtNumID(ind.value, 2)
}

function changeColor(changePct: number | null): string {
  if (changePct === null) return 'text-gray-400'
  if (changePct > 0) return 'text-green-600'
  if (changePct < 0) return 'text-red-600'
  return 'text-gray-500'
}

function changeArrow(changePct: number | null): string {
  if (changePct === null) return ''
  if (changePct > 0) return '▲'
  if (changePct < 0) return '▼'
  return '■'
}

function IndicatorCard({ ind }: { ind: MarketIndicator }) {
  const isMonthly = ind.cadence === 'monthly_reference'
  const pctText =
    ind.changePct === null ? '—' : `${changeArrow(ind.changePct)} ${formatPercent(Math.abs(ind.changePct), 2)}`

  return (
    <div className="flex-shrink-0 min-w-[140px] rounded-lg border border-gray-200 bg-white px-3 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-gray-500">{ind.label}</span>
        {ind.unit && <span className="text-[10px] text-gray-400">{ind.unit}</span>}
      </div>
      <div className="mt-0.5 text-base font-semibold text-gray-900 tabular-nums">
        {formatIndicatorValue(ind)}
      </div>
      <div className={`text-xs tabular-nums ${changeColor(ind.changePct)}`}>{pctText}</div>
      {isMonthly && ind.referencePeriod && (
        <div className="mt-0.5 text-[10px] text-gray-400">Monthly ref · {ind.referencePeriod}</div>
      )}
    </div>
  )
}

export async function MarketPulseHeader() {
  const { indicators, news } = await getMarketPulse()

  // Nothing to show yet (scraper hasn't run / DB empty) — render nothing.
  if (indicators.length === 0 && news.length === 0) return null

  return (
    <section className="mb-6" aria-label="Market Pulse">
      {indicators.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {indicators.map((ind) => (
            <IndicatorCard key={ind.indicatorKey} ind={ind} />
          ))}
        </div>
      )}

      {news.length > 0 && (
        <div className="mt-3">
          <MarketNewsList news={news} />
        </div>
      )}
    </section>
  )
}
