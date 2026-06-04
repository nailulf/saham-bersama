'use client'

import { useState } from 'react'
import Link from 'next/link'
import { StrategyCard } from '@/components/strategies/StrategyCard'
import type { Strategy } from '@/lib/types/database'

interface StrategyListPageProps {
  strategies: Strategy[]
  watchlistCount: number
}

export function StrategyListPage({ strategies: initial, watchlistCount }: StrategyListPageProps) {
  const [strategies, setStrategies] = useState(initial)

  function handleDelete(id: string) {
    setStrategies((prev) => prev.filter((s) => s.id !== id))
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'var(--color-bg-page)' }}>

      {/* Watchlist quick-link */}
      <Link
        href="/"
        className="flex items-center justify-between px-5 py-3.5 flex-shrink-0"
        style={{
          background: 'var(--color-bg-card)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div className="flex flex-col gap-0.5">
          <span className="font-display font-semibold" style={{ fontSize: 14, color: 'var(--color-text-primary)' }}>
            Watchlist
          </span>
          <span className="font-body" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            Quick access to your saved stocks
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="flex items-center px-2.5 py-1 rounded-full"
            style={{ background: 'var(--color-bg-inset)', border: '1px solid var(--color-border)' }}
          >
            <span className="font-mono font-semibold" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
              {watchlistCount}
            </span>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ color: 'var(--color-text-dim)', flexShrink: 0 }}>
            <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </Link>

      {/* Strategies section */}
      <div
        className="flex flex-col flex-1"
        style={{ background: 'var(--color-bg-card)' }}
      >
        {/* Section header + create button */}
        <div className="flex flex-col gap-3 px-5 pt-5 pb-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="flex flex-col gap-1">
            <span className="font-display font-bold" style={{ fontSize: 18, color: 'var(--color-text-primary)' }}>
              Your Strategies
            </span>
            <span className="font-body" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              Create, view and edit your strategies
            </span>
          </div>

          <Link
            href="/screener/strategy"
            className="flex items-center justify-center rounded-lg py-2.5 w-full font-mono font-semibold transition-colors"
            style={{
              fontSize: 13,
              background: 'var(--color-brand)',
              color: '#0C0C0C',
            }}
          >
            + Create Strategy
          </Link>
        </div>

        {/* Strategy list */}
        {strategies.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 px-8">
            <p className="font-mono text-center" style={{ fontSize: 13, color: 'var(--color-text-dim)' }}>
              Belum ada strategy tersimpan.
            </p>
            <Link
              href="/screener/strategy"
              className="font-mono font-semibold"
              style={{ fontSize: 12, color: 'var(--color-brand)' }}
            >
              Buat strategy pertamamu →
            </Link>
          </div>
        ) : (
          <div className="flex flex-col">
            {strategies.map((s) => (
              <StrategyCard key={s.id} strategy={s} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
