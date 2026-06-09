import { getMarketPulse } from '@/lib/queries/market-pulse'
import { fmtNumID, formatIDR, formatPercent } from '@/lib/calculations/formatters'
import type { MarketIndicator } from '@/lib/types/api'
import { MarketNewsList } from '@/components/home/market-news-list'
import { MarketCalendar } from '@/components/home/market-calendar'
import { MarketVolatilityBanner } from '@/components/home/market-volatility-banner'

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
  if (changePct === null) return 'text-[var(--color-text-muted)]'
  if (changePct > 0) return 'text-[var(--color-brand-text)]'
  if (changePct < 0) return 'text-[var(--color-negative-text)]'
  return 'text-[var(--color-text-muted)]'
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
    <div className="flex-shrink-0 min-w-[140px] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-[var(--color-text-muted)]">{ind.label}</span>
        {ind.unit && <span className="text-[10px] text-[var(--color-text-muted)]">{ind.unit}</span>}
      </div>
      <div className="mt-0.5 text-base font-semibold text-[var(--color-text-primary)] tabular-nums">
        {formatIndicatorValue(ind)}
      </div>
      <div className={`text-xs tabular-nums ${changeColor(ind.changePct)}`}>{pctText}</div>
      {isMonthly && ind.referencePeriod && (
        <div className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">Monthly ref · {ind.referencePeriod}</div>
      )}
    </div>
  )
}

export async function MarketPulseHeader() {
  const { indicators, news, events, volatilityAlerts } = await getMarketPulse()

  // Nothing to show yet (scraper hasn't run / DB empty) — render nothing.
  if (indicators.length === 0 && news.length === 0 && events.length === 0) return null

  const hasNews = news.length > 0
  const hasEvents = events.length > 0

  return (
    <section className="mb-6" aria-label="Market Pulse">
      {indicators.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {indicators.map((ind) => (
            <IndicatorCard key={ind.indicatorKey} ind={ind} />
          ))}
        </div>
      )}

      <MarketVolatilityBanner alerts={volatilityAlerts} />

      {(hasNews || hasEvents) && (
        // News 60% / calendar 40% on desktop (5-col grid: 3 + 2); stacked on mobile.
        // If only one side has data, it spans the full width.
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-5">
          {hasNews && (
            <div className={hasEvents ? 'lg:col-span-3' : 'lg:col-span-5'}>
              <MarketNewsList news={news} />
            </div>
          )}
          {hasEvents && (
            <div className={hasNews ? 'lg:col-span-2' : 'lg:col-span-5'}>
              <MarketCalendar events={events} />
            </div>
          )}
        </div>
      )}
    </section>
  )
}
