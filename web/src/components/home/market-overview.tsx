import Link from 'next/link'
import { getMarketPulse } from '@/lib/queries/market-pulse'
import { fmtNumID, formatIDR, formatPercent } from '@/lib/calculations/formatters'
import type { MarketIndicator } from '@/lib/types/api'

// ─── Value / change helpers ───────────────────────────────────────────────────

function formatValue(ind: MarketIndicator): string {
  if (ind.value === null) return '—'
  if (ind.category === 'fx') return formatIDR(ind.value)
  return fmtNumID(ind.value, 2)
}

function formatChange(ind: MarketIndicator): string {
  if (ind.changePct === null) return ''
  const sign = ind.changePct >= 0 ? '+' : ''
  return `${sign}${formatPercent(ind.changePct, 2)}`
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function MarketCard({ ind }: { ind: MarketIndicator }) {
  const positive = ind.changePct !== null ? ind.changePct >= 0 : null
  const changeText = formatChange(ind)

  return (
    <div
      className="flex-shrink-0 w-[84px] flex flex-col gap-[3px] rounded-lg px-3 py-2.5"
      style={{ background: 'var(--color-bg-inset)', border: '1px solid var(--color-border)' }}
    >
      <span
        className="font-mono text-[9px] font-semibold tracking-[0.5px] uppercase truncate"
        style={{ color: 'var(--color-text-muted)' }}
        title={ind.label}
      >
        {ind.label}
      </span>

      <span
        className="font-mono text-[12px] font-bold tabular-nums truncate"
        style={{ color: 'var(--color-text-primary)' }}
      >
        {formatValue(ind)}
      </span>

      {positive !== null && changeText && (
        <span
          className="text-[9px] font-medium tabular-nums"
          style={{
            color: positive ? 'var(--color-brand)' : 'var(--color-negative)',
            fontFamily: 'var(--font-jetbrains-mono)',
          }}
        >
          {positive ? '▲ ' : '▼ '}{changeText}
        </span>
      )}
    </div>
  )
}

// ─── Market Overview ──────────────────────────────────────────────────────────

export async function MarketOverview() {
  const { indicators } = await getMarketPulse()
  if (!indicators.length) return null

  return (
    <section className="flex flex-col gap-2.5 pt-4 pb-2" aria-label="Market Overview">
      {/* Header */}
      <div className="flex items-center justify-between px-5">
        <span className="section-label">Market Overview</span>
        <Link
          href="/commodities"
          className="text-[10px] font-medium"
          style={{ color: 'var(--color-brand)', fontFamily: 'var(--font-inter)' }}
        >
          See all →
        </Link>
      </div>

      {/* Single horizontally scrollable strip — all indicators, ordered by sort_order */}
      <div className="flex gap-2 overflow-x-auto px-5 scrollbar-none scroll-fade-right pb-1">
        {indicators.map((ind) => (
          <MarketCard key={ind.indicatorKey} ind={ind} />
        ))}
      </div>
    </section>
  )
}
