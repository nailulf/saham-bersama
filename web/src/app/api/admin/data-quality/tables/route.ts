import { NextRequest, NextResponse } from 'next/server'
import { assertAdmin } from '@/lib/admin/auth'
import { DATA_TABLES, getClientIp, writeAuditLog } from '../_shared'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const guard = assertAdmin(req)
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status })

  await writeAuditLog({
    actor: guard.subject,
    action: 'data_quality.tables',
    route: '/api/admin/data-quality/tables',
    query: {},
    ip: getClientIp(req),
    userAgent: req.headers.get('user-agent'),
  }).catch(() => null)

  return NextResponse.json({
    ok: true,
    tables: Object.entries(DATA_TABLES).map(([name, meta]) => ({
      name,
      tickerCol: meta.tickerCol,
      dateCol: meta.dateCol,
    })),
  })
}
