import type { StockHeader, StockMetrics, PricePoint, CAGRResult } from '@/lib/types/api'
import { formatIDRCompact, formatPercent, formatMultiple, fmtNumID } from '@/lib/calculations/formatters'
import { AIVerdictStrip } from './AIVerdictStrip'

interface Props {
  header: StockHeader
  metrics: StockMetrics | null
  priceHistory: PricePoint[]
  cagr: CAGRResult[]
}

function fmtPrice(v: number | null): string {
  if (!v) return '—'
  return fmtNumID(v)
}

export function HeroBar({ header, metrics, priceHistory, cagr }: Props) {
  const latest = priceHistory.at(-1)
  const prev   = priceHistory.at(-2)
  const price  = latest?.close ?? metrics?.price ?? null
  const prevPx = prev?.close ?? null
  const delta  = price != null && prevPx != null ? price - prevPx : null
  const pct    = delta != null && prevPx ? (delta / prevPx) * 100 : null
  const pos    = (pct ?? 0) >= 0

  const epsGrowth = cagr.find((c) => c.metric === 'net_income')?.cagr_3yr ?? null
  const peg = metrics?.pe_ratio != null && epsGrowth != null && epsGrowth > 0
    ? metrics.pe_ratio / epsGrowth
    : null

  const priceColor = pos ? 'var(--color-brand)' : 'var(--color-negative)'
  const lastDate   = latest?.date ?? null

  // ── Compact stats: 4 columns ──────────────────────────────────────────────
  const stats = [
    { label: 'Mkt Cap', value: header.market_cap ? formatIDRCompact(header.market_cap) : '—' },
    { label: 'P/E',     value: metrics?.pe_ratio ? formatMultiple(metrics.pe_ratio) : '—' },
    { label: 'PBV',     value: metrics?.pbv_ratio ? formatMultiple(metrics.pbv_ratio) : '—' },
    { label: 'Yield',   value: metrics?.dividend_yield ? formatPercent(metrics.dividend_yield) : '—' },
  ]

  // ── Ticker-row category chips ─────────────────────────────────────────────
  const chips: { label: string; color: string; bg: string }[] = []
  if (header.subsector) {
    chips.push({ label: header.subsector, color: '#3B82F6', bg: '#3B82F620' })
  }
  if (header.is_lq45) {
    chips.push({ label: 'LQ45', color: '#F59E0B', bg: '#F59E0B20' })
  }
  if (header.is_idx30) {
    chips.push({ label: 'IDX30', color: '#8B5CF6', bg: '#8B5CF620' })
  }

  return (
    <div
      className="px-3 md:px-4 pt-3 pb-4 flex flex-col gap-2.5"
      style={{
        background: 'var(--color-bg-card)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      {/* ── 1. Ticker Row ────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 mx-[20]">

        {/* Left: ticker + name + category chips */}
        <div className="flex flex-col gap-1 min-w-0">
          <span
            className="font-display font-bold leading-none tracking-[-0.5px] text-[26px] md:text-[32px]"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {header.ticker}
          </span>
          <span
            className="font-body text-[12px] md:text-[13px] leading-tight"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {header.name ?? ''}
          </span>
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-0.5">
              {chips.map((c) => (
                <span
                  key={c.label}
                  className="font-body text-[9px] font-semibold px-2 py-0.5 rounded"
                  style={{ color: c.color, background: c.bg }}
                >
                  {c.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Right: price + change + timestamp */}
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          <span
            className="font-display font-bold leading-none tracking-[-0.5px] text-[28px] md:text-[32px]"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {fmtPrice(price)}
          </span>
          {delta != null && pct != null && (
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[12px]" style={{ color: priceColor }}>
                {delta >= 0 ? '+' : ''}{fmtNumID(delta)}
              </span>
              <span className="font-mono text-[13px] font-bold" style={{ color: priceColor }}>
                {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
              </span>
            </div>
          )}
          {lastDate && (
            <span className="font-body text-[9px]" style={{ color: 'var(--color-text-muted)' }}>
              {lastDate}
            </span>
          )}
        </div>
      </div>

      {/* ── 2. Compact Stats pill ─────────────────────────────────────────── */}
      <div
        className="flex items-center rounded-lg overflow-hidden"
        style={{
          background: 'var(--color-bg-inset)',
          border: '1px solid var(--color-border-subtle)',
          padding: '10px 0',
        }}
      >
        {stats.map((s, i) => (
          <div key={s.label} className="flex items-center" style={{ flex: 1 }}>
            {/* Divider before every column except first */}
            {i > 0 && (
              <div
                className="self-stretch shrink-0"
                style={{ width: 1, background: 'var(--color-border)' }}
              />
            )}
            <div className="flex flex-col items-center gap-1" style={{ flex: 1 }}>
              {/* number → Display / Large Number (heading-3): prominent, scanned first */}
              <span
                className="font-display font-bold leading-none tracking-[-0.5px] text-[16px] md:text-[20px]"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {s.value}
              </span>
              {/* name → Label / Section Header (heading-4): ALL_CAPS mono caption */}
              <span
                className="font-mono font-bold uppercase tracking-[0.5px] leading-none text-[10px] md:text-[11px]"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {s.label}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ── 3 & 4. AI Verdict Strip + Style Badges (client, lazy fetch) ───── */}
      <AIVerdictStrip ticker={header.ticker} />
    </div>
  )
}
