import { NextRequest, NextResponse } from 'next/server'
import { assertAdmin } from '@/lib/admin/auth'
import { createAdminSupabase } from '@/lib/admin/supabase'
import { DATA_TABLES, getClientIp, isDataTableName, writeAuditLog } from '../_shared'

export const runtime = 'nodejs'

const MAX_LIMIT = 500

export async function GET(req: NextRequest) {
  const guard = assertAdmin(req)
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status })

  const sp = req.nextUrl.searchParams
  const table = String(sp.get('table') || '')
  if (!isDataTableName(table)) {
    return NextResponse.json({ ok: false, error: 'Invalid table' }, { status: 400 })
  }

  const meta = DATA_TABLES[table]
  const ticker = sp.get('ticker') ? String(sp.get('ticker')).toUpperCase().trim() : null
  const dateFrom = sp.get('dateFrom') ? String(sp.get('dateFrom')) : null
  const dateTo = sp.get('dateTo') ? String(sp.get('dateTo')) : null
  const orderBy = sp.get('orderBy') ? String(sp.get('orderBy')) : meta.dateCol || meta.tickerCol
  const orderDir = (sp.get('orderDir') || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc'
  const offset = Math.max(0, parseInt(sp.get('offset') || '0', 10) || 0)
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(sp.get('limit') || '50', 10) || 50))

  if (table === 'daily_prices' && !ticker) {
    return NextResponse.json({ ok: false, error: 'daily_prices requires ticker filter' }, { status: 400 })
  }

  let supabase: ReturnType<typeof createAdminSupabase>
  try {
    supabase = createAdminSupabase()
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Admin database client error' },
      { status: 500 }
    )
  }
  let query = supabase.from(table).select('*', { count: 'estimated' })

  if (ticker) query = query.eq(meta.tickerCol, ticker)

  if (meta.dateCol && (dateFrom || dateTo)) {
    if (dateFrom) query = query.gte(meta.dateCol, dateFrom)
    if (dateTo) query = query.lte(meta.dateCol, dateTo)
  }

  query = query.order(orderBy, { ascending: orderDir === 'asc', nullsFirst: false })
  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  await writeAuditLog({
    actor: guard.subject,
    action: 'data_quality.query',
    route: '/api/admin/data-quality/query',
    query: {
      table,
      ticker,
      dateFrom,
      dateTo,
      orderBy,
      orderDir,
      offset,
      limit,
    },
    ip: getClientIp(req),
    userAgent: req.headers.get('user-agent'),
  }).catch(() => null)

  return NextResponse.json({
    ok: true,
    table,
    meta,
    rows: data ?? [],
    count: count ?? null,
    offset,
    limit,
  })
}
