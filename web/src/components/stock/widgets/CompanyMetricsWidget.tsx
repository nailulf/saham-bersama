import type { StockMetrics, FinancialYear, CAGRResult, HealthScore } from '@/lib/types/api'
import type { PeerPercentiles, PercentileRank } from '@/lib/calculations/percentile'
import { formatPercent, formatMultiple, fmtNumID, formatIDRCompact } from '@/lib/calculations/formatters'

/* ── Types ─────────────────────────────────────────────────────── */

interface MetricRow {
  name: string
  value: string
  comparison: string
  comparisonColor: string
  tooltip?: string
}

interface Props {
  ticker: string
  metrics: StockMetrics | null
  latestYear: FinancialYear | null
  cagr: CAGRResult[]
  health: HealthScore[]
  peerPercentiles: PeerPercentiles | null
}

/* ── Helpers ───────────────────────────────────────────────────── */

function fmtCagr(v: number | null): string {
  if (v === null) return '—'
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
}

function cagrRankLabel(v: number | null): { label: string; color: string } {
  if (v === null) return { label: 'N/A', color: 'var(--color-text-muted)' }
  if (v >= 20) return { label: 'Very High', color: 'var(--color-brand-text)'    }
  if (v >= 10) return { label: 'High',      color: 'var(--color-brand-text)'    }
  if (v >= 5)  return { label: 'Medium',    color: 'var(--color-warning-text)'  }
  if (v >= 0)  return { label: 'Low',       color: 'var(--color-warning-text)'  }
  return { label: 'Negative', color: 'var(--color-negative-text)' }
}

function peerToRow(pr: PercentileRank, subsector: string): MetricRow {
  return {
    name: pr.label,
    value: pr.formatted,
    comparison: pr.rankLabel,
    comparisonColor: pr.rankColor,
    tooltip: `Persentil ${pr.percentile ?? '—'}% dari ${pr.peerCount} emiten di ${subsector}`,
  }
}

/* ── Sub-components ────────────────────────────────────────────── */

function InfoIcon({ tooltip }: { tooltip: string }) {
  return (
    <span className="relative group cursor-help">
      <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-[var(--color-border)] text-[var(--color-text-ghost)] font-mono text-[8px] leading-none select-none">
        ?
      </span>
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-50 w-max max-w-[220px] px-2.5 py-1.5 bg-[var(--color-bg-inset)] text-[var(--color-text-primary)] border border-[var(--color-border)] font-mono text-[10px] leading-[1.4] rounded shadow-lg whitespace-normal">
        {tooltip}
      </span>
    </span>
  )
}

function MetricRowView({ row }: { row: MetricRow }) {
  // Show only the qualitative score — drop the "(top XX% / bottom XX%)" percentile.
  const score = row.comparison.replace(/\s*\([^)]*\)/g, '').trim()
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-[var(--color-border-subtle)] last:border-b-0">
      {/* Left: metric name + value, single line */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="font-mono text-[12px] font-medium text-[var(--color-text-primary)] truncate">
          {row.name}
        </span>
        {row.tooltip && <InfoIcon tooltip={row.tooltip} />}
        <span className="font-display text-[12px] font-semibold text-[var(--color-text-primary)] shrink-0">
          {row.value}
        </span>
      </div>
      {/* Right: qualitative score */}
      <span
        className="font-mono text-[11px] font-semibold whitespace-nowrap shrink-0"
        style={{ color: row.comparisonColor }}
      >
        {score}
      </span>
    </div>
  )
}

function ColumnCard({ title, tooltip, rows }: {
  title: string
  tooltip?: string
  rows: MetricRow[]
}) {
  if (rows.length === 0) return null
  return (
    <div className="flex-1 min-w-0 rounded-xl border border-[var(--color-border)] flex flex-col">
      <div className="px-4 py-2.5 border-b border-[var(--color-border)] flex items-center gap-1.5">
        <span className="font-mono text-[11px] font-bold tracking-[0.5px] text-[var(--color-text-primary)]">{title}</span>
        {tooltip && <InfoIcon tooltip={tooltip} />}
      </div>
      <div className="px-4 flex-1">
        {rows.map((row) => (
          <MetricRowView key={row.name} row={row} />
        ))}
      </div>
    </div>
  )
}

/* ── Main Component ────────────────────────────────────────────── */

export function CompanyMetricsWidget({ ticker, metrics, latestYear, cagr, health, peerPercentiles }: Props) {
  if (!metrics && !latestYear && cagr.length === 0 && health.length === 0) return null

  const hasPeers = peerPercentiles !== null
  const subsector = peerPercentiles?.subsector ?? ''
  const peerCount = peerPercentiles?.peerCount ?? 0

  // ── Growth column ──
  // Peer-ranked from normalized_metrics, fallback to absolute thresholds
  const hasGrowthPeers = hasPeers && peerPercentiles!.growth.length > 0
  const growthPeerMap = new Map(
    (peerPercentiles?.growth ?? []).map((pr) => [pr.metric, pr]),
  )

  const cagrMetrics: { label: string; key: string; period: '3yr' | '5yr' }[] = [
    { label: 'Revenue Growth (3Y)',   key: 'revenue',            period: '3yr' },
    { label: 'Revenue Growth (5Y)',   key: 'revenue',            period: '5yr' },
    { label: 'Earnings Growth (3Y)',  key: 'net_income',         period: '3yr' },
    { label: 'Earnings Growth (5Y)',  key: 'net_income',         period: '5yr' },
    { label: 'OCF Growth (3Y)',       key: 'operating_cash_flow', period: '3yr' },
    { label: 'FCF Growth (3Y)',       key: 'free_cash_flow',     period: '3yr' },
    { label: 'Equity Growth (3Y)',    key: 'total_equity',       period: '3yr' },
  ]

  const growthRows: MetricRow[] = cagrMetrics.map((m) => {
    const entry = cagr.find((c) => c.metric === m.key)
    const val = entry ? (m.period === '3yr' ? entry.cagr_3yr : entry.cagr_5yr) : null

    // Lookup uses metric_period key (e.g. "revenue_3yr")
    const peerRank = growthPeerMap.get(`${m.key}_${m.period}`)
    if (peerRank && peerRank.percentile !== null) {
      return {
        name: m.label,
        value: fmtCagr(val),
        comparison: peerRank.rankLabel,
        comparisonColor: peerRank.rankColor,
        tooltip: `Persentil ${peerRank.percentile}% dari ${peerRank.peerCount} emiten di ${subsector}`,
      }
    }

    // Fallback: absolute thresholds
    const rl = cagrRankLabel(val)
    return {
      name: m.label,
      value: fmtCagr(val),
      comparison: rl.label,
      comparisonColor: rl.color,
      tooltip: '≥20% Very High · ≥10% High · ≥5% Medium · ≥0% Low · <0% Negative',
    }
  })

  // ── Strength column ──
  const strengthRows: MetricRow[] = hasPeers
    ? peerPercentiles!.strength.map((pr) => peerToRow(pr, subsector))
    : (() => {
        const healthMap = new Map(health.map((h) => [h.metric, h]))
        const keys = ['roe', 'net_margin', 'gross_margin', 'roa', 'current_ratio', 'debt_to_equity', 'free_cash_flow'] as const
        return keys.map((k) => {
          const h = healthMap.get(k)
          if (!h) return null
          const statusColor: Record<string, string> = { green: 'var(--color-brand-text)', yellow: 'var(--color-warning-text)', red: 'var(--color-negative-text)', na: 'var(--color-text-muted)' }
          const statusLabel: Record<string, string> = { green: 'Good', yellow: 'Fair', red: 'Weak', na: 'N/A' }
          return {
            name: h.label,
            value: h.formatted,
            comparison: statusLabel[h.status] ?? 'N/A',
            comparisonColor: statusColor[h.status] ?? 'var(--color-text-muted)',
            tooltip: h.description,
          } as MetricRow
        }).filter((r): r is MetricRow => r !== null)
      })()

  // ── Value column ──
  const valueRows: MetricRow[] = hasPeers
    ? peerPercentiles!.value.map((pr) => peerToRow(pr, subsector))
    : (() => {
        const pe  = metrics?.pe_ratio ?? null
        const pbv = metrics?.pbv_ratio ?? null
        const dy  = metrics?.dividend_yield ?? null
        const defs: { label: string; value: string; rankFn: () => { label: string; color: string }; threshold: string }[] = [
          {
            label: 'PE Ratio', value: pe !== null ? formatMultiple(pe) : '—',
            rankFn: () => pe === null ? { label: 'N/A', color: 'var(--color-text-muted)' } : pe <= 10 ? { label: 'Good', color: 'var(--color-brand-text)' } : pe <= 20 ? { label: 'Fair', color: 'var(--color-warning-text)' } : { label: 'Expensive', color: 'var(--color-negative-text)' },
            threshold: 'Good ≤10x · Fair ≤20x · >20x Expensive',
          },
          {
            label: 'PBV Ratio', value: pbv !== null ? formatMultiple(pbv) : '—',
            rankFn: () => pbv === null ? { label: 'N/A', color: 'var(--color-text-muted)' } : pbv <= 1 ? { label: 'Good', color: 'var(--color-brand-text)' } : pbv <= 3 ? { label: 'Fair', color: 'var(--color-warning-text)' } : { label: 'Expensive', color: 'var(--color-negative-text)' },
            threshold: 'Good ≤1x · Fair ≤3x · >3x Expensive',
          },
          {
            label: 'Dividend Yield', value: dy !== null ? formatPercent(dy) : '—',
            rankFn: () => dy === null ? { label: 'N/A', color: 'var(--color-text-muted)' } : dy >= 4 ? { label: 'High', color: 'var(--color-brand-text)' } : dy >= 2 ? { label: 'Medium', color: 'var(--color-warning-text)' } : { label: 'Low', color: 'var(--color-negative-text)' },
            threshold: 'High ≥4% · Medium ≥2% · <2% Low',
          },
        ]
        return defs.map((d) => {
          const rl = d.rankFn()
          return {
            name: d.label,
            value: d.value,
            comparison: rl.label,
            comparisonColor: rl.color,
            tooltip: d.threshold,
          }
        })
      })()

  // ── Folded-in extras (from former value cards) — computed from available
  //    data, threshold-ranked since no peer percentile exists for them ──
  const RC = {
    good: 'var(--color-brand-text)',
    fair: 'var(--color-warning-text)',
    bad:  'var(--color-negative-text)',
    na:   'var(--color-text-muted)',
  }

  const mcap = metrics?.market_cap ?? null
  const rev  = latestYear?.revenue ?? null
  const fcf  = latestYear?.free_cash_flow ?? null
  const cash = latestYear?.cash_and_equivalents ?? null
  const bvps = metrics?.book_value_per_share ?? null
  const pe   = metrics?.pe_ratio ?? null
  const eg3  = cagr.find((c) => c.metric === 'net_income')?.cagr_3yr ?? null

  const ps       = mcap != null && rev != null && rev > 0 ? mcap / rev : null
  const peg      = pe != null && eg3 != null && eg3 > 0 ? pe / eg3 : null
  const priceFcf = mcap != null && fcf != null && fcf > 0 ? mcap / fcf : null
  const fcfYield = mcap != null && mcap > 0 && fcf != null ? (fcf / mcap) * 100 : null

  const valueExtras: MetricRow[] = [
    {
      name: 'P/S Ratio',
      value: ps != null ? formatMultiple(ps) : '—',
      ...(ps == null ? { comparison: 'N/A', comparisonColor: RC.na }
        : ps <= 1 ? { comparison: 'Good', comparisonColor: RC.good }
        : ps <= 3 ? { comparison: 'Fair', comparisonColor: RC.fair }
        : { comparison: 'Expensive', comparisonColor: RC.bad }),
      tooltip: 'P/S = Market Cap ÷ Revenue. Good ≤1x · Fair ≤3x · >3x Expensive',
    },
    {
      name: 'PEG (3Y)',
      value: peg != null ? fmtNumID(peg, 2) : '—',
      ...(peg == null ? { comparison: 'N/A', comparisonColor: RC.na }
        : peg <= 1 ? { comparison: 'Good', comparisonColor: RC.good }
        : peg <= 2 ? { comparison: 'Fair', comparisonColor: RC.fair }
        : { comparison: 'Expensive', comparisonColor: RC.bad }),
      tooltip: 'PEG = P/E ÷ EPS CAGR 3Y. Good ≤1 · Fair ≤2 · >2 Expensive. N/A bila pertumbuhan ≤0.',
    },
    {
      name: 'Price/FCF',
      value: priceFcf != null ? formatMultiple(priceFcf) : (fcf != null && fcf <= 0 ? 'FCF<0' : '—'),
      ...(priceFcf == null ? { comparison: 'N/A', comparisonColor: RC.na }
        : priceFcf <= 15 ? { comparison: 'Good', comparisonColor: RC.good }
        : priceFcf <= 25 ? { comparison: 'Fair', comparisonColor: RC.fair }
        : { comparison: 'Expensive', comparisonColor: RC.bad }),
      tooltip: 'Price/FCF = Market Cap ÷ Free Cash Flow. Good ≤15x · Fair ≤25x · >25x Expensive.',
    },
    {
      name: 'FCF Yield',
      value: fcfYield != null ? formatPercent(fcfYield) : '—',
      ...(fcfYield == null ? { comparison: 'N/A', comparisonColor: RC.na }
        : fcfYield >= 8 ? { comparison: 'High', comparisonColor: RC.good }
        : fcfYield >= 4 ? { comparison: 'Medium', comparisonColor: RC.fair }
        : fcfYield >= 0 ? { comparison: 'Low', comparisonColor: RC.bad }
        : { comparison: 'Negative', comparisonColor: RC.bad }),
      tooltip: 'FCF Yield = Free Cash Flow ÷ Market Cap. High ≥8% · Medium ≥4% · <4% Low.',
    },
  ]

  const strengthExtras: MetricRow[] = [
    {
      name: 'Free Cash Flow',
      value: fcf != null ? formatIDRCompact(fcf) : '—',
      comparison: fcf == null ? '—' : fcf > 0 ? 'Positif' : 'Negatif',
      comparisonColor: fcf == null ? RC.na : fcf > 0 ? RC.good : RC.bad,
      tooltip: 'Arus kas bebas (periode terakhir). Positif = menghasilkan kas setelah belanja modal.',
    },
    {
      name: 'Kas & Setara',
      value: cash != null ? formatIDRCompact(cash) : '—',
      comparison: '—',
      comparisonColor: RC.na,
      tooltip: 'Kas dan setara kas pada periode terakhir.',
    },
    {
      name: 'Book Value / Share',
      value: bvps != null ? `Rp ${fmtNumID(bvps)}` : '—',
      comparison: '—',
      comparisonColor: RC.na,
      tooltip: 'Nilai buku ekuitas per saham.',
    },
  ]

  // Value column: keep Dividend Yield last, slot computed ratios after P/E & P/B.
  const baseValue = [...valueRows]
  const divIdx = baseValue.findIndex((r) => /dividend/i.test(r.name))
  const divRow = divIdx >= 0 ? baseValue.splice(divIdx, 1)[0] : null
  const valueRowsAll = [...baseValue, ...valueExtras, ...(divRow ? [divRow] : [])]

  // Strength column: append extras, skipping any name already present (e.g. FCF in fallback).
  const strengthNames = new Set(strengthRows.map((r) => r.name.toLowerCase()))
  const strengthRowsAll = [
    ...strengthRows,
    ...strengthExtras.filter((r) => !strengthNames.has(r.name.toLowerCase())),
  ]

  return (
    <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] flex flex-col">
        {/* Header */}
        <div className="px-5 py-3 border-b border-[var(--color-border)] flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="font-mono text-[13px] font-bold tracking-[0.5px] text-[var(--color-text-primary)] flex-1 min-w-0">
            METRIK PERUSAHAAN
          </span>
          {hasPeers ? (
            <span className="font-mono text-[10px] text-[#00FF88] font-medium border border-[#00FF8840] bg-[#00FF8810] px-2 py-0.5 truncate max-w-full">
              VS {peerCount} EMITEN DI {subsector.toUpperCase()}
            </span>
          ) : (
            <span className="font-mono text-[10px] text-[var(--color-text-muted)] font-medium border border-[var(--color-border)] px-2 py-0.5 shrink-0">
              THRESHOLD ABSOLUT
            </span>
          )}
        </div>

        {/* Three-column layout — stacks on mobile, side-by-side on lg+ */}
        <div className="p-4 flex flex-col lg:flex-row gap-3">
          <ColumnCard
            title="PERTUMBUHAN"
            tooltip={hasGrowthPeers
              ? `CAGR vs emiten di subsector ${subsector}`
              : 'CAGR historis — threshold absolut'}
            rows={growthRows}
          />
          <ColumnCard
            title="KEKUATAN KEUANGAN"
            tooltip={hasPeers
              ? `Peringkat persentil terhadap ${peerCount} emiten di subsector ${subsector} dengan data lengkap`
              : 'Threshold absolut — data peer tidak tersedia'}
            rows={strengthRowsAll}
          />
          <ColumnCard
            title="VALUASI"
            tooltip={hasPeers
              ? `Peringkat persentil terhadap ${peerCount} emiten di subsector ${subsector} dengan data lengkap`
              : 'Threshold absolut — data peer tidak tersedia'}
            rows={valueRowsAll}
          />
        </div>
      </div>
  )
}
