import Link from 'next/link'
import { formatIDRCompact, fmtNumID } from '@/lib/calculations/formatters'
import { DateBadge } from './most-active-table'

// Gross buy / sell leaderboard for one investor category (Foreign / Domestic),
// sourced from IDX official data. Mirrors the IDX stock-summary page: two ranked
// lists by value (also shown in shares), so the numbers reconcile with IDX. Net
// (buy − sell, IDR) is shown per row for context.
//
// CSS-width bars (no chart lib) → deterministic, SSR-safe, no mount guard.

export interface FlowItem {
  ticker: string
  name: string | null
  value: number   // IDR (buy or sell, depending on column)
  shares: number  // shares (buy or sell)
  net: number     // category net for this ticker, IDR
}

interface Props {
  title: string
  subtitle: string
  buy: FlowItem[]
  sell: FlowItem[]
  date: string | null
  /** Which metric drives the bar + headline number (matches the page's rank). */
  metric?: 'value' | 'shares'
}

export function BuySellSection({ title, subtitle, buy, sell, date, metric = 'value' }: Props) {
  const hasData = buy.length > 0 || sell.length > 0
  return (
    <section className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] p-6">
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-1">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h2>
        <DateBadge date={date} source="IDX official" />
      </div>
      <p className="text-xs text-[var(--color-text-muted)] mb-4">{subtitle}</p>

      {!hasData ? (
        <div className="py-8 text-center text-sm text-[var(--color-text-muted)]">No data for this day.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-2">
          <Column rows={buy} side="buy" metric={metric} />
          <Column rows={sell} side="sell" metric={metric} />
        </div>
      )}
    </section>
  )
}

function Column({ rows, side, metric }: { rows: FlowItem[]; side: 'buy' | 'sell'; metric: 'value' | 'shares' }) {
  const color = side === 'buy' ? 'var(--color-brand)' : 'var(--color-negative)'
  const label = side === 'buy' ? 'Top Buy' : 'Top Sell'
  const labelColor = side === 'buy' ? 'text-[var(--color-brand-text)]' : 'text-[var(--color-negative-text)]'
  const primary = (r: FlowItem) => (metric === 'value' ? r.value : r.shares)
  const max = Math.max(1, ...rows.map(primary))

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
        <span className={`text-xs font-semibold ${labelColor}`}>{label}</span>
        <span className="text-[10px] text-[var(--color-text-muted)]">by {metric === 'value' ? 'value' : 'shares'}</span>
      </div>
      {rows.length === 0 ? (
        <div className="h-20 flex items-center text-xs text-[var(--color-text-muted)]">No data.</div>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => {
            const pct = (primary(r) / max) * 100
            return (
              <li key={r.ticker}>
                <div className="flex items-center gap-2 group">
                  <Link
                    href={`/stock/${r.ticker}`}
                    className="font-mono text-xs font-semibold text-[var(--color-text-primary)] w-12 shrink-0 group-hover:text-[var(--color-brand-text)]"
                  >
                    {r.ticker}
                  </Link>
                  <div className="flex-1 h-4 bg-[var(--color-bg-inset)] rounded-sm overflow-hidden">
                    <div className="h-full rounded-sm" style={{ width: `${pct}%`, background: color, opacity: 0.85 }} />
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-[var(--color-text-primary)] w-16 text-right shrink-0">
                    {metric === 'value' ? formatIDRCompact(r.value) : `${fmtNumID(r.shares)}`}
                  </span>
                </div>
                <div className="flex items-center gap-2 pl-14 mt-0.5 text-[10px] text-[var(--color-text-muted)]">
                  <span>{metric === 'value' ? `${fmtNumID(r.shares)} sh` : formatIDRCompact(r.value)}</span>
                  <span>·</span>
                  <span className={r.net > 0 ? 'text-[var(--color-brand-text)]' : r.net < 0 ? 'text-[var(--color-negative-text)]' : ''}>
                    net {r.net > 0 ? '+' : ''}{formatIDRCompact(r.net)}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
