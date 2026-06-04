import { Suspense } from 'react'
import { MarketOverview } from '@/components/home/market-overview'
import { PopularStocks } from '@/components/home/popular-stocks'
import { MarketCalendarSection } from '@/components/home/market-calendar-section'
import { MarketVolatilityBanner } from '@/components/home/market-volatility-banner'
import { NewsSection } from '@/components/home/news-section'
import { StrategyPicks, type StrategyTab } from '@/components/home/strategy-picks'
import { getStrategies } from '@/lib/queries/strategies'
import { getScreenerRows, type ScreenerFilters } from '@/lib/queries/stocks'
import { getMarketPulse } from '@/lib/queries/market-pulse'

// ─── Strategy Picks data loader ───────────────────────────────────────────────
// Fetches up to 4 saved strategies and the top 5 stocks for each.
// API gap: sorted by market_cap (proxy) until composite_score is denormalized.

async function loadStrategyTabs(): Promise<StrategyTab[]> {
  const strategies = await getStrategies()
  const top4 = strategies.slice(0, 4)

  const tabs = await Promise.all(
    top4.map(async (strategy) => {
      const filters = (strategy.filters ?? {}) as ScreenerFilters
      const { rows } = await getScreenerRows(
        { ...filters, sortBy: 'market_cap', sortDir: 'desc' },
        1,
      )
      return { strategy, rows: rows.slice(0, 5) }
    }),
  )

  return tabs
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  // Fetch calendar events + strategy tabs in parallel
  const [{ events, volatilityAlerts }, strategyTabs] = await Promise.all([
    getMarketPulse(),
    loadStrategyTabs(),
  ])

  // Server-computed today string — SSR-safe, avoids hydration mismatch in CalendarGrid
  const today = new Date().toISOString().slice(0, 10)

  return (
    <main
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--color-bg-page)' }}
    >
      {/* Volatility banner — shown directly below header when alerts exist */}
      <MarketVolatilityBanner alerts={volatilityAlerts} />

      <Suspense>
        <MarketOverview />
      </Suspense>

      <Suspense>
        <PopularStocks />
      </Suspense>

      {/* Calendar sits between Popular Stocks and News (as per design) */}
      <MarketCalendarSection events={events} today={today} />

      <Suspense>
        <NewsSection />
      </Suspense>

      {/* StrategyPicks is a Client Component (tab state) — data fetched server-side */}
      <StrategyPicks tabs={strategyTabs} />
    </main>
  )
}
