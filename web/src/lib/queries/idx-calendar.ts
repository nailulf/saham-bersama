// Reads the IDX corporate-action calendar from Supabase (populated by the
// Python scraper python/scrapers/idx_calendar.py). No external fetch — runs
// fine on Vercel. Returns [] on error so the home calendar degrades to macro.
import { createPublicClient as createClient } from '@/lib/supabase/public'
import type { MarketEvent, MarketEventCategory } from '@/lib/types/api'

type CorporateEventType = 'rups' | 'dividend' | 'public_expose' | 'bond' | 'ipo' | 'other'

const CATEGORY_BY_TYPE: Record<CorporateEventType, MarketEventCategory> = {
  rups: 'rups',
  dividend: 'dividend',
  public_expose: 'public_expose',
  bond: 'other',
  ipo: 'other',
  other: 'other',
}

interface CorpCalRow {
  ticker: string
  event_date: string
  event_type: string
  title: string | null
}

function toMarketEvent(r: CorpCalRow): MarketEvent {
  const cat = CATEGORY_BY_TYPE[(r.event_type as CorporateEventType)] ?? 'other'
  return {
    eventDate: r.event_date,
    title: r.ticker,
    category: cat,
    importance: 'medium',
    volatility: null,
    windowStart: null,
    source: 'idx_calendar',
    note: r.title,
    ticker: r.ticker,
  }
}

/**
 * Upcoming corporate-action events for the given tickers, from corporate_calendar.
 * Empty list → []. Used by the home page (top-100) and the watchlist API route.
 */
export async function getCorporateCalendar(tickers: string[]): Promise<MarketEvent[]> {
  if (tickers.length === 0) return []
  const sb = await createClient()
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await sb
    .from('corporate_calendar')
    .select('ticker, event_date, event_type, title')
    .in('ticker', tickers)
    .gte('event_date', today)
    .order('event_date', { ascending: true })
  if (error || !data) return []
  return (data as CorpCalRow[]).map(toMarketEvent)
}