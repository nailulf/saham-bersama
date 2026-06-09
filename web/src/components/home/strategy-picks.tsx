'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ScoreBox } from '@/components/ui/score-box'
import type { Strategy } from '@/lib/types/database'
import type { ScreenerRow } from '@/lib/types/api'
import { fmtNumID } from '@/lib/calculations/formatters'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StrategyTab {
  strategy: Strategy
  rows: ScreenerRow[]
}

interface StrategyPicksProps {
  tabs: StrategyTab[]
}

// ─── Stock Pick Row ───────────────────────────────────────────────────────────

interface PickRowProps {
  row: ScreenerRow
  isLast: boolean
}

function PickRow({ row, isLast }: PickRowProps) {
  // API gap: composite_score not on stocks table yet — use completeness_score as proxy
  const score = Math.round((row.completeness_score ?? 70))

  // API gap: price_change_pct not available — no change display for now
  const price = row.price !== null ? fmtNumID(row.price) : '—'

  // Short description: subsector or sector as fallback
  const desc = row.subsector ?? row.sector ?? ''

  return (
    <Link
      href={`/stock/${row.ticker}`}
      className="flex items-center gap-3 py-3 no-underline"
      style={isLast ? undefined : { borderBottom: '1px solid var(--color-border-subtle)' }}
      aria-label={`${row.ticker} — score ${score}`}
    >
      <ScoreBox score={score} />

      {/* Info */}
      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
        <span
          className="text-[13px] font-bold font-mono leading-none"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {row.ticker}
        </span>
        <span
          className="text-[10px] truncate"
          style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-inter)' }}
        >
          {desc}
        </span>
      </div>

      {/* Price */}
      <div className="flex flex-col items-end gap-0.5">
        <span
          className="text-[13px] font-bold font-mono tabular-nums leading-none"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {price}
        </span>
      </div>
    </Link>
  )
}

// ─── Strategy Picks Section ───────────────────────────────────────────────────

export function StrategyPicks({ tabs }: StrategyPicksProps) {
  const [activeIdx, setActiveIdx] = useState(0)
  const active = tabs[activeIdx]

  if (tabs.length === 0) return null

  return (
    <section className="flex flex-col pt-4 pb-6" aria-label="Strategy Picks">
      {/* Section header */}
      <div className="flex items-center justify-between px-5 mb-2.5">
        <span className="section-label">Strategy Picks</span>
        <Link
          href="/screener"
          className="text-[10px] font-medium no-underline"
          style={{ color: 'var(--color-brand)', fontFamily: 'var(--font-inter)' }}
        >
          Lihat semua →
        </Link>
      </div>

      {/* Strategy tab pills */}
      <div className="flex gap-2 overflow-x-auto px-5 scrollbar-none pb-2.5">
        {tabs.map((tab, i) => {
          const isActive = i === activeIdx
          return (
            <button
              key={tab.strategy.id}
              type="button"
              onClick={() => setActiveIdx(i)}
              className="flex-shrink-0 text-[11px] font-semibold px-3 py-1.5 rounded-full transition-colors"
              style={
                isActive
                  ? {
                      background: 'var(--color-brand)',
                      color: 'var(--color-bg-page)',
                      fontFamily: 'var(--font-inter)',
                      border: '1px solid transparent',
                    }
                  : {
                      background: 'var(--color-bg-card)',
                      color: 'var(--color-text-muted)',
                      fontFamily: 'var(--font-inter)',
                      border: '1px solid var(--color-border)',
                    }
              }
              aria-pressed={isActive}
            >
              {tab.strategy.name}
            </button>
          )
        })}
      </div>

      {/* Stock rows — light theme wraps in a card, dark is flat */}
      <div
        className="mx-5 rounded-xl overflow-hidden"
        style={{ background: 'var(--color-bg-card)' }}
      >
        <div className="px-5">
          {active?.rows.map((row, i) => (
            <PickRow
              key={row.ticker}
              row={row}
              isLast={i === (active.rows.length - 1)}
            />
          ))}
          {(!active || active.rows.length === 0) && (
            <p
              className="py-6 text-center text-[12px]"
              style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-inter)' }}
            >
              No stocks match this strategy
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
