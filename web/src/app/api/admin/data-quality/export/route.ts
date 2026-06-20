import { NextRequest, NextResponse } from 'next/server'
import { assertAdmin } from '@/lib/admin/auth'
import { createAdminSupabase } from '@/lib/admin/supabase'
import { DATA_TABLES, getClientIp, isDataTableName, writeAuditLog } from '../_shared'

export const runtime = 'nodejs'

const MAX_LIMIT = 5000

function toCsvValue(v: unknown) {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return JSON.stringify(v)
}

function escapeCsv(v: string) {
  if (v.includes('"') || v.includes(',') || v.includes('\n') || v.includes('\r')) {
    return `"${v.replaceAll('"', '""')}"`
  }
  return v
}

export async function GET(req: NextRequest) {
  const guard = assertAdmin(req)
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status })

  const sp = req.nextUrl.searchParams
  const table = String(sp.get('table') || '')
  const format = (sp.get('format') || 'csv').toLowerCase()
  if (!isDataTableName(table)) {
    return NextResponse.json({ ok: false, error: 'Invalid table' }, { status: 400 })
  }
  if (format !== 'csv' && format !== 'json') {
    return NextResponse.json({ ok: false, error: 'Invalid format' }, { status: 400 })
  }

  const meta = DATA_TABLES[table]
  const ticker = sp.get('ticker') ? String(sp.get('ticker')).toUpperCase().trim() : null
  const dateFrom = sp.get('dateFrom') ? String(sp.get('dateFrom')) : null
  const dateTo = sp.get('dateTo') ? String(sp.get('dateTo')) : null
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(sp.get('limit') || '1000', 10) || 1000))

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
  let query = supabase.from(table).select('*')
  if (ticker) query = query.eq(meta.tickerCol, ticker)
  if (meta.dateCol && (dateFrom || dateTo)) {
    if (dateFrom) query = query.gte(meta.dateCol, dateFrom)
    if (dateTo) query = query.lte(meta.dateCol, dateTo)
  }
  query = query.limit(limit)

  const { data, error } = await query
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  await writeAuditLog({
    actor: guard.subject,
    action: 'data_quality.export',
    route: '/api/admin/data-quality/export',
    query: { table, format, ticker, dateFrom, dateTo, limit },
    ip: getClientIp(req),
    userAgent: req.headers.get('user-agent'),
  }).catch(() => null)

  const rows = (data ?? []) as Record<string, unknown>[]
  const filenameBase = `${table}${ticker ? `_${ticker}` : ''}`

  if (format === 'json') {
    const res = NextResponse.json(rows)
    res.headers.set('Content-Disposition', `attachment; filename="${filenameBase}.json"`)
    return res
  }

  const headers = Array.from(
    rows.reduce((acc, r) => {
      for (const k of Object.keys(r || {})) acc.add(k)
      return acc
    }, new Set<string>())
  )

  const lines = [
    headers.map(escapeCsv).join(','),
    ...rows.map((r) => headers.map((h) => escapeCsv(toCsvValue(r[h]))).join(',')),
  ]

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filenameBase}.csv"`,
    },
  })
}
