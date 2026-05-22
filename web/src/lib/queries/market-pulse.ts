import { createClient } from '@/lib/supabase/server'
import type {
  MarketIndicator,
  MarketIndicatorCategory,
  MarketNewsItem,
  MarketPulseResponse,
} from '@/lib/types/api'

// Pull a wider pool than we display so the client can offer a per-source
// filter and round-robin the "All" view across sources. Diversification +
// filtering live in the client component (market-news-list.tsx).
const NEWS_POOL = 60

/**
 * Fetch the homepage Market Pulse bundle: active indicators (ordered for the
 * header) + a recent pool of news headlines (newest-first, across all sources).
 * Reused by both the homepage server component and the /api/market-pulse route.
 * Returns empty arrays on error so the header degrades gracefully.
 */
export async function getMarketPulse(): Promise<MarketPulseResponse> {
  const sb = await createClient()

  const [indicatorsRes, newsRes] = await Promise.all([
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

  return { indicators, news, generatedAt: new Date().toISOString() }
}
