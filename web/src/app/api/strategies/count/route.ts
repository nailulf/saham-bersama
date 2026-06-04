import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { applyScreenerFilters } from '@/lib/queries/stocks'

const NUMERIC_PARAMS = [
  'minRoe', 'maxPe', 'maxPbv', 'minNetMargin', 'minDivYield',
  'minDivAvg3yr', 'minDivAvg5yr',
  'minRevCagr3yr', 'minRevCagr5yr', 'minPriceCagr3yr', 'minPriceCagr5yr', 'minOcfCagr3yr', 'minOcfCagr5yr',
  'minMktCap', 'maxMktCap', 'maxPhaseDays',
  'minRsi', 'maxRsi', 'maxMacdCrossDays', 'minVolChangePct', 'maxVolChangePct', 'minVolAvg',
  'maxWyckoffDays', 'minWyckoffConf', 'maxWyckoffDaysV2', 'minWyckoffConfV2',
] as const

const STRING_PARAMS = [
  'sector', 'board', 'phase', 'macdCross',
  'wyckoffEvent', 'wyckoffPhase',
  'wyckoffEventV2', 'wyckoffPhaseV2', 'wyckoffFsmPhaseV2',
] as const

// GET /api/strategies/count?<filter_params>
// Returns the number of active stocks matching the given filters.
// Used by the strategy builder to show a live match preview.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const filters: Record<string, string | number> = {}

  for (const key of STRING_PARAMS) {
    const v = sp.get(key)
    if (v) filters[key] = v
  }
  for (const key of NUMERIC_PARAMS) {
    const v = sp.get(key)
    if (v) {
      const n = Number(v)
      if (!isNaN(n)) filters[key] = n
    }
  }

  const supabase = await createClient()
  let query = supabase
    .from('stocks')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'Active')

  query = applyScreenerFilters(query, filters)

  const { count, error } = await query
  if (error) {
    return NextResponse.json({ count: 0 }, { status: 500 })
  }
  return NextResponse.json({ count: count ?? 0 })
}
