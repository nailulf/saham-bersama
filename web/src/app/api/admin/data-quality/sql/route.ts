import { NextRequest, NextResponse } from 'next/server'
import { assertAdmin } from '@/lib/admin/auth'
import { createAdminSupabase } from '@/lib/admin/supabase'
import { DATA_TABLES, getClientIp, isDataTableName, writeAuditLog } from '../_shared'

export const runtime = 'nodejs'

type ParsedSql = {
  table: string
  columns: string[] | '*'
  where: Array<{ col: string; op: '=' | '>=' | '<=' | 'like'; value: string }>
  orderBy: string | null
  orderDir: 'asc' | 'desc'
  limit: number
  offset: number
}

const MAX_LIMIT = 500

function normalizeSql(sql: string) {
  return sql.trim().replace(/;+\s*$/g, '')
}

function parseSql(sqlRaw: string): ParsedSql {
  const sql = normalizeSql(sqlRaw)
  const lower = sql.toLowerCase()
  if (!lower.startsWith('select ')) throw new Error('Only SELECT is allowed')

  const fromMatch = lower.match(/\sfrom\s+([a-z0-9_]+)/)
  if (!fromMatch) throw new Error('Missing FROM clause')
  const table = fromMatch[1]
  if (!isDataTableName(table)) throw new Error('Table not allowed')

  const selectPart = sql.slice(6, fromMatch.index).trim()
  const columns =
    selectPart === '*' ? '*' : selectPart.split(',').map((s) => s.trim()).filter(Boolean)
  if (columns !== '*' && columns.length === 0) throw new Error('Invalid SELECT columns')

  const where: ParsedSql['where'] = []
  const whereMatch = lower.match(/\swhere\s+([\s\S]+?)(\sorder\s+by\s+|\slimit\s+|\soffset\s+|$)/)
  if (whereMatch) {
    const raw = whereMatch[1].trim()
    const parts = raw.split(/\s+and\s+/i).map((s) => s.trim()).filter(Boolean)
    for (const p of parts) {
      const m = p.match(/^([a-zA-Z0-9_]+)\s*(=|>=|<=|like)\s*(.+)$/i)
      if (!m) throw new Error(`Unsupported WHERE condition: ${p}`)
      const col = m[1]
      const op = m[2].toLowerCase() as '=' | '>=' | '<=' | 'like'
      let value = m[3].trim()
      if (
        (value.startsWith("'") && value.endsWith("'")) ||
        (value.startsWith('"') && value.endsWith('"'))
      ) {
        value = value.slice(1, -1)
      }
      where.push({ col, op, value })
    }
  }

  const orderByMatch = lower.match(/\sorder\s+by\s+([a-z0-9_]+)(\s+(asc|desc))?/)
  const orderBy = orderByMatch ? orderByMatch[1] : null
  const orderDir = (orderByMatch?.[3] || 'desc') as 'asc' | 'desc'

  const limitMatch = lower.match(/\slimit\s+(\d+)/)
  const offsetMatch = lower.match(/\soffset\s+(\d+)/)
  const limit = Math.min(MAX_LIMIT, Math.max(1, limitMatch ? parseInt(limitMatch[1], 10) : 50))
  const offset = Math.max(0, offsetMatch ? parseInt(offsetMatch[1], 10) : 0)

  return { table, columns, where, orderBy, orderDir, limit, offset }
}

export async function POST(req: NextRequest) {
  const guard = assertAdmin(req)
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status })

  const body = await req.json().catch(() => ({}))
  const sql = String(body?.sql ?? '')
  if (!sql.trim()) return NextResponse.json({ ok: false, error: 'sql is required' }, { status: 400 })

  let parsed: ParsedSql
  try {
    parsed = parseSql(sql)
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Invalid SQL' }, { status: 400 })
  }

  const meta = DATA_TABLES[parsed.table as keyof typeof DATA_TABLES]
  let supabase: ReturnType<typeof createAdminSupabase>
  try {
    supabase = createAdminSupabase()
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Admin database client error' },
      { status: 500 }
    )
  }

  const selectArg = parsed.columns === '*' ? '*' : parsed.columns.join(',')
  let q = supabase.from(parsed.table).select(selectArg)

  for (const c of parsed.where) {
    if (c.op === '=') q = q.eq(c.col, c.value)
    if (c.op === '>=') q = q.gte(c.col, c.value)
    if (c.op === '<=') q = q.lte(c.col, c.value)
    if (c.op === 'like') q = q.ilike(c.col, c.value)
  }

  if (parsed.orderBy) q = q.order(parsed.orderBy, { ascending: parsed.orderDir === 'asc' })
  else q = q.order(meta.dateCol || meta.tickerCol, { ascending: false })

  q = q.range(parsed.offset, parsed.offset + parsed.limit - 1)

  const { data, error } = await q
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  await writeAuditLog({
    actor: guard.subject,
    action: 'data_quality.sql',
    route: '/api/admin/data-quality/sql',
    query: { sql, parsed },
    ip: getClientIp(req),
    userAgent: req.headers.get('user-agent'),
  }).catch(() => null)

  return NextResponse.json({ ok: true, parsed, rows: data ?? [] })
}
