import Link from 'next/link'
import { TrendingUp, Scale, Coins, Activity, type LucideIcon } from 'lucide-react'
import { fmtNumID } from '@/lib/calculations/formatters'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StrategyPick {
  id: string
  name: string
  description: string | null
  count: number // stocks matching the strategy's filters
  filters: Record<string, unknown> | null
}

interface StrategyPicksProps {
  picks: StrategyPick[]
}

// Decorative icons cycled by position (strategies are user-defined — no semantics)
const CARD_ICONS: LucideIcon[] = [TrendingUp, Scale, Coins, Activity]

// Dark text for the featured (brand-fill) card — same rule as BUY/HOLD/SELL badges
const FEATURED_TEXT = '#0A0A0A'

// Open the strategy's matching stocks in the screener (filters applied),
// mirroring StrategyCard's "view in screener" navigation — not the edit/builder route.
function strategyHref(pick: StrategyPick): string {
  const params = new URLSearchParams({ strategy: pick.id })
  for (const [key, value] of Object.entries(pick.filters ?? {})) {
    if (value != null && value !== '') params.set(key, String(value))
  }
  return `/screener?${params.toString()}`
}

// ─── Strategy Card ────────────────────────────────────────────────────────────

function StrategyCard({ pick, index }: { pick: StrategyPick; index: number }) {
  const featured = index === 0
  const Icon = CARD_ICONS[index % CARD_ICONS.length]
  const desc = pick.description?.trim()

  const fg      = featured ? FEATURED_TEXT : 'var(--color-text-primary)'
  const fgMuted = featured ? `${FEATURED_TEXT}99` : 'var(--color-text-muted)'
  const countFg = featured ? FEATURED_TEXT : 'var(--color-brand)'

  return (
    <Link
      href={strategyHref(pick)}
      className="flex flex-col justify-between rounded-xl p-4 no-underline min-w-0 min-h-[140px]"
      style={
        featured
          ? { background: 'var(--color-brand)' }
          : { background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }
      }
      aria-label={`${pick.name} — ${pick.count} stocks`}
    >
      {/* Top: icon + name */}
      <div className="flex flex-col gap-2">
        <Icon size={18} strokeWidth={2} style={{ color: fgMuted }} />
        <span
          className="font-mono text-[11px] font-bold uppercase tracking-[0.5px] leading-snug line-clamp-2"
          style={{ color: fg }}
        >
          {pick.name}
        </span>
        {desc && (
          <span
            className="font-body text-[11px] leading-snug line-clamp-2"
            style={{ color: fgMuted }}
          >
            {desc}
          </span>
        )}
      </div>

      {/* Bottom: hero count */}
      <div className="flex items-baseline gap-1.5 mt-3">
        <span
          className="font-display font-bold tabular-nums leading-none"
          style={{ fontSize: 36, color: countFg }}
        >
          {fmtNumID(pick.count)}
        </span>
        <span
          className="font-mono font-semibold"
          style={{ fontSize: 10, color: fgMuted }}
        >
          saham
        </span>
      </div>
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
