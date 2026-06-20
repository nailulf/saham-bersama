import { NextRequest, NextResponse } from 'next/server'
import { assertAdmin } from '@/lib/admin/auth'
import { createAdminSupabase } from '@/lib/admin/supabase'
import { getClientIp, writeAuditLog } from '../_shared'

export const runtime = 'nodejs'

type Issue = {
  id: string
  severity: 'info' | 'warning' | 'error'
  category: string
  title: string
  detail: string
  table?: string
  column?: string
}

export async function GET(req: NextRequest) {
  const guard = assertAdmin(req)
  if (!guard.ok) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status })

  const ticker = String(req.nextUrl.searchParams.get('ticker') || '').toUpperCase().trim()
  if (!ticker) return NextResponse.json({ ok: false, error: 'ticker is required' }, { status: 400 })

  let supabase: ReturnType<typeof createAdminSupabase>
  try {
    supabase = createAdminSupabase()
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Admin database client error' },
      { status: 500 }
    )
  }

  const [stockRes, complRes, latestPriceRes, latestAnnualRes, aiRes, dqRes] = await Promise.all([
    supabase.from('stocks').select('*').eq('ticker', ticker).maybeSingle(),
    supabase.from('v_data_completeness').select('*').eq('ticker', ticker).maybeSingle(),
    supabase.from('v_latest_prices').select('*').eq('ticker', ticker).maybeSingle(),
    supabase
      .from('financials')
      .select('*')
      .eq('ticker', ticker)
      .eq('quarter', 0)
      .or('is_ttm.is.null,is_ttm.is.false')
      .order('year', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('ai_analysis').select('*').eq('ticker', ticker).maybeSingle(),
    supabase.from('data_quality_flags').select('*').eq('ticker', ticker).order('year', { ascending: false }).limit(5),
  ])

  if (stockRes.error) return NextResponse.json({ ok: false, error: stockRes.error.message }, { status: 500 })

  const issues: Issue[] = []

  const stock = stockRes.data
  const completeness = complRes.data as any | null
  const latestPrice = latestPriceRes.data as any | null
  const latestAnnual = latestAnnualRes.data as any | null
  const ai = aiRes.data as any | null
  const dqFlags = (dqRes.data as any[]) ?? []

  if (!stock) {
    issues.push({
      id: 'missing:stocks',
      severity: 'error',
      category: 'missing',
      title: 'Missing stock row',
      detail: 'No row in stocks table for this ticker.',
      table: 'stocks',
    })
  } else {
    const requiredFields = ['ticker', 'name', 'sector', 'subsector', 'status']
    for (const f of requiredFields) {
      if (stock[f] == null || String(stock[f]).trim() === '') {
        issues.push({
          id: `missing:stocks:${f}`,
          severity: 'warning',
          category: 'missing',
          title: 'Missing stock metadata',
          detail: `${f} is NULL/empty in stocks.`,
          table: 'stocks',
          column: f,
        })
      }
    }
  }

  if (!latestPrice?.date) {
    issues.push({
      id: 'missing:daily_prices:latest',
      severity: 'error',
      category: 'missing',
      title: 'No price data',
      detail: 'No latest price row found (v_latest_prices).',
      table: 'daily_prices',
    })
  }

  if (latestAnnual) {
    const negativeFields = ['revenue', 'total_assets', 'total_equity']
    for (const f of negativeFields) {
      const v = latestAnnual[f]
      if (typeof v === 'number' && v < 0) {
        issues.push({
          id: `invalid:financials:${f}`,
          severity: 'error',
          category: 'invalid',
          title: 'Invalid annual financial value',
          detail: `${f} is negative in latest annual financials.`,
          table: 'financials',
          column: f,
        })
      }
    }
  } else {
    issues.push({
      id: 'missing:financials:annual',
      severity: 'warning',
      category: 'missing',
      title: 'Missing annual financials',
      detail: 'No annual financials row found for this ticker.',
      table: 'financials',
    })
  }

  const hasSourceConflict = dqFlags.some((r) => r?.source_conflict === true)
  if (hasSourceConflict) {
    issues.push({
      id: 'mismatch:sources',
      severity: 'warning',
      category: 'mismatch',
      title: 'Cross-source conflict detected',
      detail: 'data_quality_flags indicates conflicting metrics between sources.',
      table: 'data_quality_flags',
    })
  }

  const hasAnomaly = dqFlags.some((r) => r?.has_anomaly === true)
  if (hasAnomaly) {
    issues.push({
      id: 'outlier:fundamentals',
      severity: 'warning',
      category: 'outlier',
      title: 'Fundamental anomaly detected',
      detail: 'data_quality_flags indicates anomalous YoY changes (IQR).',
      table: 'data_quality_flags',
    })
  }

  if (completeness?.completeness_score != null && Number(completeness.completeness_score) < 80) {
    issues.push({
      id: 'quality:completeness',
      severity: 'warning',
      category: 'quality',
      title: 'Low completeness score',
      detail: `v_data_completeness.completeness_score = ${String(completeness.completeness_score)} (threshold: 80).`,
      table: 'v_data_completeness',
    })
  }

  const lastDataChangeAt = stock?.last_data_change_at ? new Date(stock.last_data_change_at).getTime() : null
  const generatedAt = ai?.generated_at ? new Date(ai.generated_at).getTime() : null
  if (!ai) {
    issues.push({
      id: 'missing:ai_analysis',
      severity: 'info',
      category: 'stale',
      title: 'AI analysis missing',
      detail: 'No ai_analysis row exists for this ticker.',
      table: 'ai_analysis',
    })
  } else {
    if (lastDataChangeAt && generatedAt && generatedAt < lastDataChangeAt) {
      issues.push({
        id: 'stale:ai_analysis',
        severity: 'warning',
        category: 'stale',
        title: 'AI analysis stale vs data',
        detail: 'ai_analysis.generated_at is older than stocks.last_data_change_at.',
        table: 'ai_analysis',
        column: 'generated_at',
      })
    }
    const ageDays = generatedAt ? (Date.now() - generatedAt) / 86400000 : null
    if (ageDays != null && ageDays > 30) {
      issues.push({
        id: 'stale:ai_analysis:age',
        severity: 'info',
        category: 'stale',
        title: 'AI analysis is old',
        detail: `ai_analysis.generated_at is ~${Math.floor(ageDays)} days old.`,
        table: 'ai_analysis',
        column: 'generated_at',
      })
    }
  }

  await writeAuditLog({
    actor: guard.subject,
    action: 'data_quality.validate',
    route: '/api/admin/data-quality/validate',
    query: { ticker },
    ip: getClientIp(req),
    userAgent: req.headers.get('user-agent'),
  }).catch(() => null)

  return NextResponse.json({
    ok: true,
    ticker,
    summary: {
      issues_total: issues.length,
      errors: issues.filter((i) => i.severity === 'error').length,
      warnings: issues.filter((i) => i.severity === 'warning').length,
    },
    issues,
    raw: {
      stocks: stock,
      v_data_completeness: completeness,
      v_latest_prices: latestPrice,
      latest_annual_financials: latestAnnual,
      ai_analysis: ai,
      data_quality_flags: dqFlags,
    },
  })
}
