'use client'

import { useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { StockCard } from '@/components/screener/StockCard'
import { StrategyTabs } from '@/components/screener/StrategyTabs'
import { ActiveFilterChips } from '@/components/screener/ActiveFilterChips'
import { fmtNumID } from '@/lib/calculations/formatters'
import type { ScreenerRow } from '@/lib/types/api'
import type { Strategy } from '@/lib/types/database'

const SORT_OPTIONS = [
  { value: 'market_cap',    label: 'Mkt Cap ↓' },
  { value: 'pe_ratio',      label: 'P/E ↓' },
  { value: 'roe',           label: 'ROE ↓' },
  { value: 'dividend_yield',label: 'Yield ↓' },
  { value: 'ticker',        label: 'Ticker A–Z' },
] as const

const ALL_FILTER_KEYS = [
  'minRoe', 'maxPe', 'maxPbv', 'minNetMargin', 'minDivYield',
  'minDivAvg3yr', 'minDivAvg5yr',
  'minRevCagr3yr', 'minRevCagr5yr', 'minPriceCagr3yr', 'minPriceCagr5yr', 'minOcfCagr3yr', 'minOcfCagr5yr',
  'minMktCap', 'maxMktCap', 'maxPhaseDays',
  'sector', 'board', 'phase',
  'minRsi', 'maxRsi', 'macdCross', 'maxMacdCrossDays', 'minVolChangePct', 'maxVolChangePct', 'minVolAvg',
  'wyckoffEvent', 'wyckoffPhase', 'maxWyckoffDays', 'minWyckoffConf',
  'wyckoffEventV2', 'wyckoffPhaseV2', 'wyckoffFsmPhaseV2', 'maxWyckoffDaysV2', 'minWyckoffConfV2',
]

interface ScreenerListShellProps {
  rows: ScreenerRow[]
  total: number
  page: number
  totalPages: number
  sortBy: string
  strategies: Strategy[]
  activeStrategyId?: string
}

export function ScreenerListShell({
  rows,
  total,
  page,
  totalPages,
  sortBy,
  strategies,
  activeStrategyId,
}: ScreenerListShellProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [sortOpen, setSortOpen] = useState(false)

  const currentSort = SORT_OPTIONS.find((o) => o.value === sortBy) ?? SORT_OPTIONS[0]
  const activeFilterCount = ALL_FILTER_KEYS.filter((k) => searchParams.get(k)).length

  function handleSort(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('sort', value)
    params.set('dir', 'desc')
    params.delete('page')
    setSortOpen(false)
    router.push(`${pathname}?${params.toString()}`)
  }

  function handleClearAll() {
    window.dispatchEvent(new Event('screener-clear'))
    router.push(pathname)
  }

  function buildPageUrl(p: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(p))
    return `${pathname}?${params.toString()}`
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'var(--color-bg-page)' }}>

      {/* Strategy Tabs + filter/sort controls in one row */}
      <div className="flex items-center" style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
        {/* Tabs — scrollable, fills remaining width */}
        <div className="flex-1 min-w-0">
          <StrategyTabs strategies={strategies} activeStrategyId={activeStrategyId} />
        </div>

        {/* Filter + sort — fixed right side */}
        <div className="flex items-center gap-3 pr-5 flex-shrink-0">
          {activeFilterCount > 0 && (
            <button
              onClick={handleClearAll}
              className="font-mono"
              style={{ fontSize: 11, color: 'var(--color-text-dim)' }}
            >
              Bersihkan
            </button>
          )}

          <Link
            href="/screener/strategy"
            className="relative flex items-center"
            style={{ color: 'var(--color-text-muted)' }}
            aria-label="Filter"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z" />
            </svg>
            {activeFilterCount > 0 && (
              <span
                className="absolute -top-1 -right-1 flex items-center justify-center rounded-full font-mono font-bold"
                style={{ width: 14, height: 14, fontSize: 8, background: 'var(--color-brand)', color: '#0C0C0C' }}
              >
                {activeFilterCount}
              </span>
            )}
          </Link>

          <div className="relative">
            <button
              onClick={() => setSortOpen((v) => !v)}
              style={{ color: 'var(--color-text-muted)' }}
              aria-label="Sort"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z" />
              </svg>
            </button>

            {sortOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setSortOpen(false)} />
                <div
                  className="absolute right-0 top-full mt-1 z-30 rounded-xl shadow-lg py-1 min-w-[160px]"
                  style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
                >
                  {SORT_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      onClick={() => handleSort(o.value)}
                      className="w-full text-left px-4 py-2.5 font-mono transition-colors"
                      style={{
                        fontSize: 12,
                        color: sortBy === o.value ? 'var(--color-brand)' : 'var(--color-text-muted)',
                        background: sortBy === o.value ? 'var(--color-brand-bg)' : 'transparent',
                      }}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Active Filter Chips */}
      <ActiveFilterChips />

      {/* Results Bar */}
      <div
        className="flex items-center justify-between px-5 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <span className="font-mono" style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>
          {fmtNumID(total)} saham ditemukan
        </span>
        <button
          onClick={() => setSortOpen((v) => !v)}
          className="font-mono font-medium"
          style={{ fontSize: 11, color: 'var(--color-brand)' }}
        >
          {currentSort.label}
        </button>
      </div>

      {/* Stock List */}
      <div className="flex-1">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <p className="font-mono" style={{ fontSize: 13, color: 'var(--color-text-dim)' }}>
              Tidak ada saham yang cocok.
            </p>
            {activeFilterCount > 0 && (
              <button
                onClick={handleClearAll}
                className="font-mono font-semibold"
                style={{ fontSize: 11, color: 'var(--color-brand)' }}
              >
                BERSIHKAN SEMUA FILTER
              </button>
            )}
          </div>
        ) : (
          rows.map((row) => <StockCard key={row.ticker} row={row} />)
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          className="flex items-center justify-center gap-4 py-5 flex-shrink-0"
          style={{ borderTop: '1px solid var(--color-border)' }}
        >
          {page > 1 && (
            <Link
              href={buildPageUrl(page - 1)}
              className="font-mono px-3 py-1.5 rounded-md"
              style={{ fontSize: 12, color: 'var(--color-brand)', background: 'var(--color-brand-bg)' }}
            >
              ← Prev
            </Link>
          )}
          <span className="font-mono" style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={buildPageUrl(page + 1)}
              className="font-mono px-3 py-1.5 rounded-md"
              style={{ fontSize: 12, color: 'var(--color-brand)', background: 'var(--color-brand-bg)' }}
            >
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
