import { NextRequest, NextResponse } from 'next/server'
import { assertAdmin } from '@/lib/admin/auth'
import { createAdminSupabase } from '@/lib/admin/supabase'
import { listRecentRuns } from '@/lib/admin/jobRuns'

export const runtime = 'nodejs'

// (table, dateColumn) pairs to report freshness for.
const FRESHNESS: Array<[string, string]> = [
  ['daily_prices', 'date'],
  ['ai_analysis', 'generated_at'],
]

export async function GET(req: NextRequest) {
  const guard = assertAdmin(req)
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status })

  try {
    const supabase = createAdminSupabase()
    const freshness = await Promise.all(
      FRESHNESS.map(async ([table, col]) => {
        const { data } = await supabase
          .from(table)
          .select(col)
          .order(col, { ascending: false })
          .limit(1)
          .maybeSingle()
        return { table, lastDate: (data as Record<string, string> | null)?.[col] ?? null }
      })
    )
    const runs = await listRecentRuns(10)
    return NextResponse.json({ ok: true, freshness, runs })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Failed to load overview' },
      { status: 500 }
    )
  }
}
