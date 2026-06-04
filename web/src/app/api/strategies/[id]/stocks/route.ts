import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getScreenerRows } from '@/lib/queries/stocks'

// GET /api/strategies/[id]/stocks
// Returns the top matching stocks for a strategy, recalculated fresh on every call.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: strategy, error } = await supabase
    .from('strategies')
    .select('filters')
    .eq('id', id)
    .single()

  if (error || !strategy) {
    return NextResponse.json({ rows: [], total: 0 }, { status: 404 })
  }

  const filters = (strategy.filters ?? {}) as Record<string, string | number>
  const { rows, total } = await getScreenerRows(
    { ...filters, sortBy: 'market_cap', sortDir: 'desc' },
    1,
  )

  return NextResponse.json({ rows: rows.slice(0, 15), total })
}
