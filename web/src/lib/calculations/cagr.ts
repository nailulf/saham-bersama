import type { FinancialYear, CAGRResult } from '@/lib/types/api'

/*
 * Canonical CAGR — see docs/cagr-spec.md. This must stay equivalent to the
 * Python implementation in python/scrapers/ratio_enricher.py
 * (_sync_screener_metrics) so the screener and this widget agree.
 */

/**
 * Standard CAGR: (end / start)^(1/span) - 1, as a percent.
 * `span` is the actual elapsed years. Only valid when both endpoints are positive.
 */
function cagr(start: number | null, end: number | null, span: number): number | null {
  if (start == null || end == null || span <= 0) return null
  if (start <= 0 || end <= 0) return null
  return (Math.pow(end / start, 1 / span) - 1) * 100
}

/**
 * Growth rate for metrics that can go negative (e.g., net_income).
 * Uses absolute start as base so negative-to-positive transitions
 * produce a meaningful positive growth number.
 *
 *   -100 → +200 over 3 years = ((200 - (-100)) / |-100|)^(1/3) - 1
 *
 * Returns null if start is zero (division by zero).
 */
function growthRate(start: number | null, end: number | null, span: number): number | null {
  if (start == null || end == null || span <= 0) return null
  if (start === 0) return null
  // Both positive — use standard CAGR
  if (start > 0 && end > 0) return cagr(start, end, span)
  // Mixed/negative signs — absolute-value-based annualized growth
  const totalGrowth = (end - start) / Math.abs(start)
  const base = 1 + totalGrowth
  if (base <= 0) return null // can't take a real root
  return (Math.pow(base, 1 / span) - 1) * 100
}

interface MetricDef {
  key: keyof FinancialYear
  label: string
  /** Use growthRate instead of strict CAGR (for metrics that can be negative) */
  allowNegative?: boolean
}

/**
 * Year-aware window selection for an N-year CAGR (see docs/cagr-spec.md).
 * `series` must be annual rows sorted ascending by year with TTM already excluded.
 * Returns [startValue, endValue, span] or null when there isn't a valid window.
 */
function pickWindow(
  series: FinancialYear[],
  key: keyof FinancialYear,
  n: number,
): [number | null, number | null, number] | null {
  if (series.length < 2) return null
  const end = series[series.length - 1]
  const window = series.filter((r) => r.year >= end.year - n)
  if (window.length < 2) return null
  const start = window[0]
  const span = end.year - start.year
  if (span <= 0) return null
  return [start[key] as number | null, end[key] as number | null, span]
}

const METRICS: MetricDef[] = [
  // Income Statement
  { key: 'revenue',            label: 'Pendapatan' },
  { key: 'gross_profit',       label: 'Laba Kotor' },
  { key: 'operating_income',   label: 'Laba Operasi',       allowNegative: true },
  { key: 'net_income',         label: 'Laba Bersih',        allowNegative: true },
  // Cash Flow
  { key: 'operating_cash_flow', label: 'Arus Kas Operasi',  allowNegative: true },
  { key: 'free_cash_flow',     label: 'Free Cash Flow',     allowNegative: true },
  // Balance Sheet
  { key: 'total_equity',       label: 'Ekuitas' },
  { key: 'total_debt',         label: 'Total Utang' },
]

export function computeCAGR(input: FinancialYear[]): CAGRResult[] {
  // Annual, non-TTM, sorted ascending by year (see docs/cagr-spec.md).
  const series = input
    .filter((r) => !r.is_ttm)
    .slice()
    .sort((a, b) => a.year - b.year)

  if (series.length < 2) return []

  const results: CAGRResult[] = []

  for (const { key, label, allowNegative } of METRICS) {
    const fn = allowNegative ? growthRate : cagr

    const w3 = pickWindow(series, key, 3)
    const w5 = pickWindow(series, key, 5)
    const cagr3 = w3 ? fn(w3[0], w3[1], w3[2]) : null
    const cagr5 = w5 ? fn(w5[0], w5[1], w5[2]) : null

    // Only include if at least one period has data
    if (cagr3 != null || cagr5 != null) {
      results.push({ metric: key, label, cagr_3yr: cagr3, cagr_5yr: cagr5 })
    }
  }

  return results
}
