import { Suspense } from 'react'
import { ToolsSection } from '@/components/home/tools-section'
import { MarketOverview } from '@/components/home/market-overview'
import { MarketCalendarSection } from '@/components/home/market-calendar-section'
import { MarketVolatilityBanner } from '@/components/home/market-volatility-banner'
import { NewsSection } from '@/components/home/news-section'
import { StrategyPicks, type StrategyPick } from '@/components/home/strategy-picks'
import { getStrategies, getStrategyMatchCount } from '@/lib/queries/strategies'
import { type ScreenerFilters, getTop100Tickers } from '@/lib/queries/stocks'
import { getMarketPulse } from '@/lib/queries/market-pulse'
import { fetchIdxCorporateCalendar, toMarketEvent } from '@/lib/queries/idx-calendar'

// ─── Strategy Picks data loader ───────────────────────────────────────────────
// Fetches up to 4 saved strategies and the count of stocks matching each.

async function loadStrategyPicks(): Promise<StrategyPick[]> {
  const strategies = (await getStrategies()).slice(0, 4)

  return Promise.all(
    strategies.map(async (strategy) => ({
      id: strategy.id,
      name: strategy.name,
      description: strategy.description,
      filters: strategy.filters ?? null,
      count: await getStrategyMatchCount((strategy.filters ?? {}) as ScreenerFilters),
    })),
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  // Fetch calendar events + strategy picks + IDX corporate-action calendar in parallel
  const [{ events, volatilityAlerts }, strategyPicks, caEvents, top100] = await Promise.all([
    getMarketPulse(),
    loadStrategyPicks(),
    fetchIdxCorporateCalendar(),
    getTop100Tickers(),
  ])

  // Scope corporate-action events to the top-100 by market cap, then merge with
  // the macro market_events. (Watchlist events are merged client-side.)
  const top100Set = new Set(top100)
  const scopedCaEvents = caEvents
    .filter((e) => top100Set.has(e.ticker))
    .map(toMarketEvent)
  const calendarEvents = [...events, ...scopedCaEvents]

  // Server-computed today string — SSR-safe, avoids hydration mismatch in CalendarGrid
  const today = new Date().toISOString().slice(0, 10)

  return (
    <main
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--color-bg-page)' }}
    >
      {/* Volatility banner — shown directly below header when alerts exist */}
      <MarketVolatilityBanner alerts={volatilityAlerts} />

      {/* Quick tools & features — mobile only */}
      <ToolsSection />

      <Suspense>
        <MarketOverview />
      </Suspense>

      {/* Strategy Picks — mid section (replaces former Popular Stocks slot) */}
      <StrategyPicks picks={strategyPicks} />

      {/* Calendar sits between Strategy Picks and News (as per design) */}
      <MarketCalendarSection events={calendarEvents} today={today} />

      <Suspense>
        <NewsSection />
      </Suspense>
    </main>
  )
}
