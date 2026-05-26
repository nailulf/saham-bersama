import { createClient } from '@/lib/supabase/server'
import type {
  MarketIndicator,
  MarketIndicatorCategory,
  MarketNewsItem,
  MarketEvent,
  MarketEventCategory,
  VolatilityLevel,
  VolatilityAlert,
  MarketPulseResponse,
} from '@/lib/types/api'

// Pull a wider pool than we display so the client can offer a per-source
// filter and round-robin the "All" view across sources. Diversification +
// filtering live in the client component (market-news-list.tsx).
const NEWS_POOL = 60
const EVENTS_LIMIT = 30
// How many days ahead a high-volatility window may open and still warn ("heads-up").
const ALERT_LEAD_DAYS = 10

/**
 * From the upcoming events, derive the high-volatility windows relevant to now:
 * either already open (window_start ≤ today ≤ event) or opening within
 * ALERT_LEAD_DAYS. Used for the homepage warning banner. Date math is done here
 * (server data layer), never in render.
 */
function computeVolatilityAlerts(events: MarketEvent[], today: string): VolatilityAlert[] {
  const todayMs = Date.parse(today)
  const days = (iso: string) => Math.round((Date.parse(iso) - todayMs) / 86_400_000)

  const alerts: VolatilityAlert[] = []
  for (const e of events) {
    if (e.volatility !== 'high' || !e.windowStart) continue
    const daysUntilStart = days(e.windowStart)
    const daysUntilEvent = days(e.eventDate)
    if (daysUntilEvent < 0) continue                 // already passed
    if (daysUntilStart > ALERT_LEAD_DAYS) continue   // window opens too far out
    alerts.push({
      title: e.title,
      source: e.source,
      status: daysUntilStart <= 0 ? 'active' : 'upcoming',
      windowStart: e.windowStart,
      eventDate: e.eventDate,
      daysUntilStart,
      daysUntilEvent,
    })
  }
  // Soonest-resolving first.
  return alerts.sort((a, b) => a.daysUntilEvent - b.daysUntilEvent)
}

/**
 * Fetch the homepage Market Pulse bundle: active indicators (ordered for the
 * header) + a recent pool of news headlines (newest-first, across all sources).
 * Reused by both the homepage server component and the /api/market-pulse route.
 * Returns empty arrays on error so the header degrades gracefully.
 */
export async function getMarketPulse(): Promise<MarketPulseResponse> {
  const sb = await createClient()
  const today = new Date().toISOString().slice(0, 10)

  const [indicatorsRes, newsRes, eventsRes] = await Promise.all([
    sb
      .from('market_indicators')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    sb
      .from('market_news')
      .select('id, title, link, source, published_at, summary')
      .order('published_at', { ascending: false })
      .limit(NEWS_POOL),
    sb
      .from('market_events')
      .select('event_date, title, category, importance, volatility, window_start, source, note')
      .gte('event_date', today)
      .order('event_date', { ascending: true })
      .limit(EVENTS_LIMIT),
  ])

  const indicators: MarketIndicator[] = (indicatorsRes.data ?? []).map((r) => ({
    indicatorKey: r.indicator_key,
    label: r.label,
    category: r.category as MarketIndicatorCategory,
    unit: r.unit,
    provider: r.provider,
    cadence: r.cadence,
    value: r.value !== null ? Number(r.value) : null,
    prevValue: r.prev_value !== null ? Number(r.prev_value) : null,
    changeAbs: r.change_abs !== null ? Number(r.change_abs) : null,
    changePct: r.change_pct !== null ? Number(r.change_pct) : null,
    asOf: r.as_of,
    referencePeriod: r.reference_period,
    sortOrder: r.sort_order,
  }))

  const news: MarketNewsItem[] = (newsRes.data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    link: r.link,
    source: r.source,
    publishedAt: r.published_at,
    summary: r.summary,
  }))

  const events: MarketEvent[] = (eventsRes.data ?? []).map((r) => ({
    eventDate: r.event_date,
    title: r.title,
    category: r.category as MarketEventCategory | null,
    importance: (r.importance ?? 'medium') as MarketEvent['importance'],
    volatility: (r.volatility ?? null) as VolatilityLevel | null,
    windowStart: r.window_start,
    source: r.source,
    note: r.note,
  }))

  const volatilityAlerts = computeVolatilityAlerts(events, today)

  return { indicators, news, events, volatilityAlerts, generatedAt: new Date().toISOString() }
}
