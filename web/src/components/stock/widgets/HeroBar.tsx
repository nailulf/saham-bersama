import type { StockHeader, StockMetrics, PricePoint, CAGRResult } from '@/lib/types/api'
import { formatIDRCompact, formatPercent, formatMultiple, fmtNumID } from '@/lib/calculations/formatters'

interface Props {
  header: StockHeader
  metrics: StockMetrics | null
  priceHistory: PricePoint[]
  cagr: CAGRResult[]
}

function fmtVol(v: number | null): string {
  if (!v) return '—'
  return v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : `${(v / 1_000).toFixed(0)}K`
}

function fmtPrice(v: number | null): string {
  if (!v) return '—'
  return `Rp ${fmtNumID(v)}`
}

export function HeroBar({ header, metrics, priceHistory, cagr }: Props) {
  const latest  = priceHistory.at(-1)
  const prev    = priceHistory.at(-2)
  const price   = latest?.close ?? metrics?.price ?? null
  const prevPx  = prev?.close ?? null
  const delta   = price != null && prevPx != null ? price - prevPx : null
  const pct     = delta != null && prevPx ? (delta / prevPx) * 100 : null
  const pos     = (pct ?? 0) >= 0

  const closes  = priceHistory.map((p) => p.close).filter((c): c is number => c != null)
  const low52   = closes.length ? Math.min(...closes) : null
  const high52  = closes.length ? Math.max(...closes) : null

  const priceColor = pos ? 'text-[#00FF88]' : 'text-red-400'
  const lastDate   = latest?.date ?? null

  const epsGrowth = cagr.find((c) => c.metric === 'net_income')?.cagr_3yr ?? null
  const peg = (metrics?.pe_ratio != null && epsGrowth != null && epsGrowth > 0)
    ? metrics.pe_ratio / epsGrowth
    : null

  const stats = [
    { label: 'KAP. PASAR', value: header.market_cap ? formatIDRCompact(header.market_cap) : '—' },
    { label: 'VOL',         value: fmtVol(latest?.volume ?? null) },
    { label: 'P/E',         value: metrics?.pe_ratio  ? formatMultiple(metrics.pe_ratio)  : '—' },
    { label: 'PEG',         value: peg != null ? fmtNumID(peg, 2) : '—' },
    { label: 'ROE',         value: metrics?.roe        ? formatPercent(metrics.roe)        : '—' },
    { label: '52M',         value: low52 && high52 ? `${fmtNumID(low52)}–${fmtNumID(high52)}` : '—' },
  ]

  const PriceBlock = ({ size }: { size: 'sm' | 'lg' }) => (
    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
      <span className={`font-display font-bold tracking-[-1px] leading-none ${priceColor} ${size === 'lg' ? 'text-[32px]' : 'text-[24px] md:text-[28px]'}`}>
        {fmtPrice(price)}
      </span>
      {delta != null && pct != null && (
        <span className={`font-mono font-semibold ${priceColor} ${size === 'lg' ? 'text-[15px]' : 'text-[11px] md:text-[13px]'}`}>
          {delta >= 0 ? '+' : ''}{fmtNumID(delta)} ({pct >= 0 ? '+' : ''}{pct.toFixed(2)}%)
        </span>
      )}
    </div>
  )

  const StatsRow = ({ wrap, textSize }: { wrap: boolean; textSize: string }) => (
    <div className={`flex items-center gap-0 ${wrap ? 'flex-wrap' : 'overflow-x-auto scrollbar-none -mx-4 px-4 md:mx-0 md:px-0'}`}>
      {stats.map((s, i) => (
        <span key={s.label} className={`flex items-center gap-1 font-mono font-medium tracking-[0.5px] shrink-0 ${textSize}`}>
          <span className="text-[#555555]">{s.label}:</span>
          <span className="text-[#555555]">{s.value}</span>
          {i < stats.length - 1 && <span className="text-[#CCCCCC] mx-1.5 md:mx-1">|</span>}
        </span>
      ))}
    </div>
  )

  return (
    <div className="bg-white border-b border-[#E0E0E5] px-4 md:px-12 py-3">

      {/* ── Mobile + Tablet (<lg): ticker+price row, name, stats below ── */}
      <div className="lg:hidden">
        <div className="flex items-start justify-between gap-3">
          <span className="font-display text-[28px] md:text-[32px] font-bold text-[#1A1A1A] tracking-[-1px] leading-none">
            {header.ticker}
          </span>
          <PriceBlock size="sm" />
        </div>
        <span className="font-mono text-[11px] md:text-[12px] font-medium text-[#555555] tracking-[0.5px] uppercase mt-0.5 block">
          {header.name}
        </span>
        <div className="mt-2">
          <StatsRow wrap={false} textSize="text-[11px] md:text-[12px]" />
          {lastDate && (
            <span className="font-mono text-[10px] text-[#9C9B99] tracking-[0.3px] mt-0.5 block">
              Data terakhir: {lastDate}
            </span>
          )}
        </div>
      </div>

      {/* ── Desktop (lg+): 3-column ── */}
      <div className="hidden lg:flex lg:items-center lg:justify-between lg:min-h-[64px] lg:gap-6">
        {/* Col 1: ticker + name */}
        <div className="flex flex-col gap-0.5 flex-shrink-0">
          <span className="font-display text-[32px] font-bold text-[#1A1A1A] tracking-[-1px] leading-none">
            {header.ticker}
          </span>
          <span className="font-mono text-[13px] font-medium text-[#555555] tracking-[0.5px] uppercase leading-tight">
            {header.name}
          </span>
        </div>

        {/* Col 2: price + change */}
        <PriceBlock size="lg" />

        {/* Col 3: stats */}
        <div className="flex flex-col items-end gap-1">
          <StatsRow wrap textSize="text-[13px]" />
          {lastDate && (
            <span className="font-mono text-[10px] text-[#9C9B99] tracking-[0.3px]">
              Data terakhir: {lastDate}
            </span>
          )}
        </div>
      </div>

    </div>
  )
}
