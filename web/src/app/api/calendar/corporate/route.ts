// GET /api/calendar/corporate?tickers=BBRI,BMRI
// Live IDX corporate-action events for the given tickers (watchlist merge).
import { NextRequest, NextResponse } from 'next/server'
import {
  fetchIdxCorporateCalendar,
  filterByTickers,
  toMarketEvent,
} from '@/lib/queries/idx-calendar'

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('tickers') ?? ''
  const tickers = new Set(
    raw.split(',').map((t) => t.trim().toUpperCase()).filter(Boolean),
  )
  if (tickers.size === 0) return NextResponse.json([])

  const all = await fetchIdxCorporateCalendar()
  const events = filterByTickers(all, tickers).map(toMarketEvent)
  return NextResponse.json(events)
}
