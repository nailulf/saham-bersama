import Link from 'next/link'
import { TrendingUp, Scale, Coins, Activity, type LucideIcon } from 'lucide-react'
import { fmtNumID } from '@/lib/calculations/formatters'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StrategyPick {
  id: string
  name: string
  description: string | null
  count: number // stocks matching the strategy's filters
}

interface StrategyPicksProps {
  picks: StrategyPick[]
}

// Decorative icons cycled by position (strategies are user-defined — no semantics)
const CARD_ICONS: LucideIcon[] = [TrendingUp, Scale, Coins, Activity]

// Dark text for the featured (brand-fill) card — same rule as BUY/HOLD/SELL badges
const FEATURED_TEXT = '#0A0A0A'

// ─── Strategy Card ────────────────────────────────────────────────────────────

function StrategyCard({ pick, index }: { pick: StrategyPick; index: number }) {
  const featured = index === 0
  const Icon = CARD_ICONS[index % CARD_ICONS.length]
  const desc = pick.description?.trim()

  return (
    <Link
      href={`/screener/strategy?id=${pick.id}`}
      className="flex flex-col gap-1 rounded-[10px] p-3 no-underline min-w-0"
      style={
        featured
          ? { background: 'var(--color-brand)' }
          : { background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }
      }
      aria-label={`${pick.name} — ${pick.count} stocks`}
    >
      {/* Top row: icon + name … count */}
      <div className="flex items-center gap-1.5 w-full">
        <Icon
          size={14}
          strokeWidth={2}
          style={{ color: featured ? FEATURED_TEXT : 'var(--color-text-muted)' }}
        />
        <span
          className="font-mono text-[12px] font-bold uppercase tracking-[0.3px] leading-none truncate flex-1 min-w-0"
          style={{ color: featured ? FEATURED_TEXT : 'var(--color-text-primary)' }}
        >
          {pick.name}
        </span>
        <span
          className="font-display text-[15px] font-bold tabular-nums leading-none"
          style={{ color: featured ? FEATURED_TEXT : 'var(--color-text-muted)' }}
        >
          {fmtNumID(pick.count)}
        </span>
      </div>

      {/* Description */}
      <span
        className="text-[12px] leading-tight truncate"
        style={{
          color: featured ? FEATURED_TEXT : 'var(--color-text-muted)',
          fontFamily: 'var(--font-inter)',
        }}
      >
        {desc || ' '}
      </span>
    </Link>
  )
}

// ─── Strategy Picks Section ───────────────────────────────────────────────────

export function StrategyPicks({ picks }: StrategyPicksProps) {
  if (picks.length === 0) return null

  return (
    <section className="flex flex-col gap-2.5 pt-3" aria-label="Strategy Picks">
      {/* Section header */}
      <div className="flex items-center justify-between px-5">
        <span className="section-label">Strategy Picks</span>
        <Link
          href="/strategies"
          className="text-[10px] font-medium no-underline"
          style={{ color: 'var(--color-brand)', fontFamily: 'var(--font-inter)' }}
        >
          Lihat semua →
        </Link>
      </div>

      {/* 2×2 grid on mobile; single row from tablet up — max 4 strategies */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 px-5">
        {picks.slice(0, 4).map((pick, i) => (
          <StrategyCard key={pick.id} pick={pick} index={i} />
        ))}
      </div>
    </section>
  )
}
