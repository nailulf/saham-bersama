// Live, on-the-fly fetch of IDX's public corporate-action calendar
// (GET /primary/Home/GetCalendar). No persistence — cached ~6h. Any failure
// returns [] so the home calendar degrades to macro events only.
import type { MarketEvent } from '@/lib/types/api'

const IDX_CALENDAR_URL = 'https://www.idx.co.id/primary/Home/GetCalendar'
const REVALIDATE_SECONDS = 21_600 // 6 hours

export type CorporateEventType = 'rups' | 'dividend' | 'public_expose' | 'bond' | 'ipo' | 'other'

export interface CorporateCalendarEvent {
  idxId: number
  ticker: string
  eventDate: string   // YYYY-MM-DD
  eventType: CorporateEventType
  description: string
}

interface IdxCalendarRow {
  id: number
  title: string        // emiten ticker
  description: string
  Jenis: string | null
  Step: string | null
  start: string        // ISO datetime, e.g. "2026-06-30T00:00:00"
}

/** YYYYMMDD for the current date — only selects the month (range=m). */
function todayYyyymmdd(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}${m}${day}`
}

function classifyEvent(row: IdxCalendarRow): CorporateEventType {
  const desc = (row.description ?? '').toLowerCase()
  const jenis = (row.Jenis ?? '').toLowerCase()
  if (desc.includes('public expose') || desc.includes('paparan')) return 'public_expose'
  if (desc.includes('dividen')) return 'dividend'
  if (desc.includes('rups') || desc.includes('rapat umum')) return 'rups'
  if (jenis.includes('obligasi') || jenis === 'rupo' || desc.includes('obligasi')) return 'bond'
  if (jenis === 'pencatatanawal' || desc.includes('ipo')) return 'ipo'
  return 'other'
}

const CATEGORY_BY_TYPE: Record<CorporateEventType, MarketEvent['category']> = {
  rups: 'rups',
  dividend: 'dividend',
  public_expose: 'public_expose',
  bond: 'other',
  ipo: 'other',
  other: 'other',
}

/** Live-fetch the current month's IDX corporate-action calendar (all emiten). */
export async function fetchIdxCorporateCalendar(): Promise<CorporateCalendarEvent[]> {
  const url = `${IDX_CALENDAR_URL}?range=m&date=${todayYyyymmdd()}`
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        Referer: 'https://www.idx.co.id/en/listed-companies/listed-company-calendar/',
        'X-Requested-With': 'XMLHttpRequest',
      },
      next: { revalidate: REVALIDATE_SECONDS },
    })
    if (!res.ok) return []
    const data = (await res.json()) as { Results?: IdxCalendarRow[] }
    const rows = data.Results ?? []
    return rows
      .filter((r) => r && r.title && r.start)
      .map((r) => ({
        idxId: r.id,
        ticker: String(r.title).toUpperCase(),
        eventDate: String(r.start).slice(0, 10),
        eventType: classifyEvent(r),
        description: r.description ?? '',
      }))
  } catch {
    return []
  }
}

/** Map a corporate-action event to the calendar's MarketEvent shape. */
export function toMarketEvent(ce: CorporateCalendarEvent): MarketEvent {
  return {
    eventDate: ce.eventDate,
    title: ce.ticker,
    category: CATEGORY_BY_TYPE[ce.eventType],
    importance: 'medium',
    volatility: null,
    windowStart: null,
    source: 'idx_calendar',
    note: ce.description || null,
    ticker: ce.ticker,
  }
}

/** Keep only events whose ticker is in the given set. */
export function filterByTickers(
  events: CorporateCalendarEvent[],
  tickers: Set<string>,
): CorporateCalendarEvent[] {
  return events.filter((e) => tickers.has(e.ticker))
}
