import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/admin/supabase'

export const runtime = 'nodejs'

export async function GET() {
  const checks: Record<string, { status: string; detail?: string }> = {}

  // env presence
  const missing = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter(
    (k) => !process.env[k]
  )
  checks.env = missing.length
    ? { status: 'unhealthy', detail: `missing: ${missing.join(', ')}` }
    : { status: 'healthy' }

  // real DB round-trip
  try {
    const supabase = createAdminSupabase()
    const started = Date.now()
    const { error } = await supabase.from('stocks').select('ticker', { count: 'estimated', head: true })
    checks.database = error
      ? { status: 'unhealthy', detail: error.message }
      : { status: 'healthy', detail: `${Date.now() - started}ms` }
  } catch (e) {
    checks.database = { status: 'unhealthy', detail: e instanceof Error ? e.message : 'error' }
  }

  const allHealthy = Object.values(checks).every((c) => c.status === 'healthy')
  return NextResponse.json(
    { status: allHealthy ? 'healthy' : 'degraded', timestamp: new Date().toISOString(), checks },
    { status: allHealthy ? 200 : 503 }
  )
}
