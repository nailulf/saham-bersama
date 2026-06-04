import Link from 'next/link'
import { getScreenerRows } from '@/lib/queries/stocks'
import { fmtNumID } from '@/lib/calculations/formatters'
import { SparklinePlaceholder } from '@/components/ui/sparkline'

// ─── Popular Stock Card ───────────────────────────────────────────────────────

interface PopularCardProps {
  ticker: string
  shortName: string
  price: number | null
  sector: string | null
  // API gap: price_change_pct and sparkline data not yet on stocks table.
  // Using null placeholders until schema migration lands.
  changePct: number | null
}

function PopularCard({ ticker, shortName, price, sector, changePct }: PopularCardProps) {
  const positive = changePct !== null ? changePct >= 0 : true
  const changeLabel = changePct !== null
    ? `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%`
    : null

  return (
    <Link
      href={`/stock/${ticker}`}
      className="flex-shrink-0 w-[108px] flex flex-col rounded-[10px] p-3.5 gap-1.5 no-underline"
      style={{
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
      }}
      aria-label={`${ticker} — ${shortName}`}
    >
      {/* Top row: ticker + change badge */}
      <div className="flex items-center justify-between w-full">
        <span
          className="font-mono text-[13px] font-bold"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {ticker}
        </span>
        {changeLabel && (
          <span
            className="text-[8px] font-semibold rounded px-1.5 py-0.5 font-mono"
            style={{
              background: positive ? 'var(--color-brand-bg)' : 'var(--color-negative-bg)',
              color: positive ? 'var(--color-brand-text)' : 'var(--color-negative-text)',
            }}
          >
            {changeLabel}
          </span>
        )}
      </div>

      {/* Short name */}
      <span
        className="text-[10px] leading-tight truncate"
        style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-inter)' }}
      >
        {shortName}
      </span>

      {/* Price */}
      <span
        className="font-mono text-[15px] font-bold tabular-nums"
        style={{ color: 'var(--color-text-primary)' }}
      >
        {price !== null ? fmtNumID(price) : '—'}
      </span>

      {/* Sparkline (placeholder until API gap resolved) */}
      <SparklinePlaceholder positive={positive} />

      {/* Sector */}
      <span
        className="text-[9px] leading-none truncate"
        style={{ color: 'var(--color-text-ghost)', fontFamily: 'var(--font-inter)' }}
      >
        {sector ?? ''}
      </span>
    </Link>
  )
}

// ─── Popular Stocks Section ───────────────────────────────────────────────────

export async function PopularStocks() {
  // API gap: no price_change_pct column yet; sort by volume as proxy for popularity.
  const { rows } = await getScreenerRows({ sortBy: 'market_cap', sortDir: 'desc' }, 1)
  const stocks = rows.slice(0, 8)

  if (stocks.length === 0) return null

  return (
    <section className="flex flex-col gap-2.5 pt-4" aria-label="Popular Stocks">
      {/* Section header */}
      <div className="flex items-center justify-between px-5">
        <span className="section-label">Popular Stocks</span>
        <span
          className="text-[10px] font-medium"
          style={{ color: 'var(--color-brand)', fontFamily: 'var(--font-inter)' }}
        >
          See all →
        </span>
      </div>

      {/* Horizontal scroll — right fade handled by CSS utility */}
      <div className="flex gap-2.5 overflow-x-auto px-5 scrollbar-none scroll-fade-right pb-1">
        {stocks.map((s) => (
          <PopularCard
            key={s.ticker}
            ticker={s.ticker}
            shortName={s.name ?? s.ticker}
            price={s.price}
            sector={s.sector}
            changePct={null} // API gap — backlogged
          />
        ))}
      </div>
    </section>
  )
}
