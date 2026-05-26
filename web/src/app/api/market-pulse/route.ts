import { NextResponse } from 'next/server'
import { getMarketPulse } from '@/lib/queries/market-pulse'

// Homepage Market Pulse data (indicators + news). The homepage server
// component reads via the query helper directly; this route exists for
// client-side refresh/debug. Cached at the edge for 5 min.
export async function GET() {
  try {
    const data = await getMarketPulse()
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    })
  } catch {
    return NextResponse.json(
      { indicators: [], news: [], events: [], volatilityAlerts: [], generatedAt: new Date().toISOString() },
      { status: 500 },
    )
  }
}
