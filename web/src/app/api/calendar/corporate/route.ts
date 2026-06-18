// GET /api/calendar/corporate?tickers=BBRI,BMRI
// Upcoming corporate-action events for the given tickers (watchlist merge),
// read from Supabase.
import { NextRequest, NextResponse } from 'next/server'
import { getCorporateCalendar } from '@/lib/queries/idx-calendar'

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('tickers') ?? ''
  const tickers = [...new Set(
    raw.split(',').map((t) => t.trim().toUpperCase()).filter(Boolean),
  )]
  if (tickers.length === 0) return NextResponse.json([])
  return NextResponse.json(await getCorporateCalendar(tickers))
}