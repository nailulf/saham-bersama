import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import path from 'path'
import { assertAdmin } from '@/lib/admin/auth'
import { createAdminSupabase } from '@/lib/admin/supabase'

export const runtime = 'nodejs'

interface RouteParams {
  params: Promise<{ runId: string }>
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req: NextRequest, { params }: RouteParams) {
  const guard = assertAdmin(req)
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status })

  const { runId } = await params
  if (!UUID_RE.test(runId)) {
    return NextResponse.json({ ok: false, error: 'Invalid runId' }, { status: 400 })
  }

  // Resolve log_path from the DB row — never build a path from raw input.
  const supabase = createAdminSupabase()
  const { data, error } = await supabase
    .from('admin_job_runs')
    .select('log_path')
    .eq('id', runId)
    .maybeSingle()
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  if (!data?.log_path) return NextResponse.json({ ok: false, error: 'Run not found' }, { status: 404 })

  // Defense in depth: ensure the stored path stays inside the admin-logs dir.
  const logDir = path.join(process.cwd(), '..', 'python', 'data', 'admin-logs')
  const resolved = path.resolve(data.log_path)
  if (!resolved.startsWith(path.resolve(logDir))) {
    return NextResponse.json({ ok: false, error: 'Invalid log path' }, { status: 400 })
  }

  let log = ''
  try {
    log = readFileSync(resolved, 'utf8').split('\n').slice(-500).join('\n')
  } catch {
    log = '(log not available yet)'
  }
  return NextResponse.json({ ok: true, runId, log })
}
