import { NextRequest, NextResponse } from 'next/server'
import { assertAdmin } from '@/lib/admin/auth'
import { JOBS } from '@/lib/admin/jobs'
import { listRecentRuns } from '@/lib/admin/jobRuns'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const guard = assertAdmin(req)
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status })

  try {
    const runs = await listRecentRuns(30)
    return NextResponse.json({ ok: true, jobs: Object.values(JOBS), runs })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Failed to list jobs' },
      { status: 500 }
    )
  }
}
