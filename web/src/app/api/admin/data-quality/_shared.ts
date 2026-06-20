import type { NextRequest } from 'next/server'
import { createAdminSupabase } from '@/lib/admin/supabase'

export const runtime = 'nodejs'

export const DATA_TABLES = {
  stocks: { tickerCol: 'ticker', dateCol: null as string | null },
  daily_prices: { tickerCol: 'ticker', dateCol: 'date' },
  financials: { tickerCol: 'ticker', dateCol: null as string | null },
  ai_analysis: { tickerCol: 'ticker', dateCol: 'generated_at' },
  ai_context_cache: { tickerCol: 'ticker', dateCol: 'built_at' },
  data_quality_flags: { tickerCol: 'ticker', dateCol: null as string | null },
  v_data_completeness: { tickerCol: 'ticker', dateCol: null as string | null },
  v_latest_prices: { tickerCol: 'ticker', dateCol: 'date' },
} as const

export type DataTableName = keyof typeof DATA_TABLES

export function isDataTableName(value: string): value is DataTableName {
  return Object.prototype.hasOwnProperty.call(DATA_TABLES, value)
}

export function getClientIp(req: NextRequest) {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    null
  )
}

export async function writeAuditLog(args: {
  actor: string
  action: string
  route: string
  query: Record<string, unknown>
  ip: string | null
  userAgent: string | null
}) {
  const supabase = createAdminSupabase()
  await supabase.from('admin_audit_log').insert({
    actor: args.actor,
    action: args.action,
    route: args.route,
    query: args.query,
    ip: args.ip,
    user_agent: args.userAgent,
  })
}

