import type { StockMetrics, FinancialYear } from '@/lib/types/api'
import { formatMultiple, formatPercent, formatNumber, fmtNumID } from '@/lib/calculations/formatters'

interface Props {
  ticker:     string
  metrics:    StockMetrics | null
  latestYear: FinancialYear | null
}

interface Row {
  label:    string
  stock:    string
  industry: string
  market:   string
}

export function FundamentalsWidget({ ticker, metrics, latestYear }: Props) {
  const rows: Row[] = [
    {
      label:    'P/E RATIO',
      stock:    metrics?.pe_ratio            ? formatMultiple(metrics.pe_ratio)            : '—',
      industry: '—', market: '—',
    },
    {
      label:    'P/BV RATIO',
      stock:    metrics?.pbv_ratio           ? formatMultiple(metrics.pbv_ratio)           : '—',
      industry: '—', market: '—',
    },
    {
      label:    'EPS',
      stock:    metrics?.eps                 ? `Rp ${fmtNumID(metrics.eps)}` : '—',
      industry: '—', market: '—',
    },
    {
      label:    'NILAI BUKU / LBR',
      stock:    metrics?.book_value_per_share ? `Rp ${fmtNumID(metrics.book_value_per_share)}` : '—',
      industry: '—', market: '—',
    },
    {
      label:    'ROE',
      stock:    (latestYear?.roe ?? metrics?.roe) != null
                  ? formatPercent(latestYear?.roe ?? metrics!.roe!)
                  : '—',
      industry: '—', market: '—',
    },
    {
      label:    'ROA',
      stock:    latestYear?.roa              ? formatPercent(latestYear.roa)               : '—',
      industry: '—', market: '—',
    },
    {
      label:    'MARGIN BERSIH',
      stock:    latestYear?.net_margin       ? formatPercent(latestYear.net_margin)        : '—',
      industry: '—', market: '—',
    },
    {
      label:    'MARGIN KOTOR',
      stock:    latestYear?.gross_margin     ? formatPercent(latestYear.gross_margin)      : '—',
      industry: '—', market: '—',
    },
    {
      label:    'RASIO LANCAR',
      stock:    latestYear?.current_ratio    ? formatNumber(latestYear.current_ratio)      : '—',
      industry: '—', market: '—',
    },
    {
      label:    'D/E RATIO',
      stock:    latestYear?.debt_to_equity   ? formatNumber(latestYear.debt_to_equity)     : '—',
      industry: '—', market: '—',
    },
    {
      label:    'DIVIDEN YIELD',
      stock:    metrics?.dividend_yield      ? formatPercent(metrics.dividend_yield)       : '—',
      industry: '—', market: '—',
    },
  ]

  return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] flex flex-col">
      {/* Header */}
      <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[13px] font-bold tracking-[0.5px] text-[var(--color-text-primary)]">METRIK UTAMA</span>
          {metrics?.financial_year && (
            <span className="font-mono text-[11px] text-[var(--color-text-muted)]">FY{metrics.financial_year}</span>
          )}
        </div>
        <span className="font-mono text-[11px] text-[var(--color-text-muted)]">{ticker} vs INDUSTRI vs PASAR</span>
      </div>

      {/* Column headers */}
      <div className="flex items-center bg-[var(--color-bg-inset)] px-3 py-2">
        <span className="font-mono text-[11px] font-bold text-[var(--color-text-muted)] tracking-[0.5px] flex-1">METRIK</span>
        <span className="font-mono text-[11px] font-bold text-[var(--color-text-muted)] tracking-[0.5px] w-28 text-right">{ticker}</span>
        <span className="font-mono text-[11px] font-bold text-[var(--color-text-muted)] tracking-[0.5px] w-28 text-right">INDUSTRI</span>
        <span className="font-mono text-[11px] font-bold text-[var(--color-text-muted)] tracking-[0.5px] w-20 text-right">PASAR</span>
      </div>

      {/* Rows */}
      {rows.map((row) => (
        <div key={row.label} className="flex items-center px-3 py-2 border-b border-[var(--color-border)] last:border-0">
          <span className="font-mono text-[12px] text-[var(--color-text-muted)] tracking-[0.5px] uppercase flex-1">{row.label}</span>
          <span className={`font-mono text-[13px] w-28 text-right ${
            row.stock !== '—' ? 'font-semibold text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'
          }`}>
            {row.stock}
          </span>
          <span className="font-mono text-[13px] text-[var(--color-text-muted)] w-28 text-right">{row.industry}</span>
          <span className="font-mono text-[13px] text-[var(--color-text-muted)] w-20 text-right">{row.market}</span>
        </div>
      ))}
    </div>
  )
}
