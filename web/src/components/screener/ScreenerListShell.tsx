'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { StockTable, STOCK_COLUMNS, DEFAULT_VISIBLE_COLUMNS, OPTIONAL_COLUMNS } from '@/components/screener/StockTable'
import { StrategyTabs } from '@/components/screener/StrategyTabs'
import { ActiveFilterChips } from '@/components/screener/ActiveFilterChips'
import { fmtNumID } from '@/lib/calculations/formatters'
import type { ScreenerRow } from '@/lib/types/api'
import type { Strategy } from '@/lib/types/database'

const COLUMNS_STORAGE_KEY = 'screener-visible-columns'

const ALL_FILTER_KEYS = [
  'minRoe', 'maxPe', 'maxPbv', 'minNetMargin', 'minDivYield',
  'minDivAvg3yr', 'minDivAvg5yr',
  'minRevCagr3yr', 'minRevCagr5yr', 'minPriceCagr3yr', 'minPriceCagr5yr', 'minOcfCagr3yr', 'minOcfCagr5yr',
  'minMktCap', 'maxMktCap', 'maxPhaseDays',
  'sector', 'board', 'phase',
  'minRsi', 'maxRsi', 'macdCross', 'maxMacdCrossDays', 'minVolChangePct', 'maxVolChangePct', 'minVolAvg',
  'wyckoffEvent', 'wyckoffPhase', 'maxWyckoffDays', 'minWyckoffConf',
  'wyckoffEventV2', 'wyckoffPhaseV2', 'wyckoffFsmPhaseV2', 'maxWyckoffDaysV2', 'minWyckoffConfV2',
  'bandarAccdist',
]

interface ScreenerListShellProps {
  rows: ScreenerRow[]
  total: number
  page: number
  totalPages: number
  sortBy: string
  strategies: Strategy[]
  activeStrategyId?: string
  onOpenFilters: () => void
}

export function ScreenerListShell({
  rows,
  total,
  page,
  totalPages,
  sortBy,
  strategies,
  activeStrategyId,
  onOpenFilters,
}: ScreenerListShellProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [colsOpen, setColsOpen] = useState(false)
  const [visibleKeys, setVisibleKeys] = useState<string[]>(DEFAULT_VISIBLE_COLUMNS)

  // Load saved column choice after mount (keeps SSR markup deterministic).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(COLUMNS_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) setVisibleKeys(parsed.filter((k): k is string => typeof k === 'string'))
      }
    } catch { /* ignore */ }
  }, [])

  function toggleColumn(key: string) {
    setVisibleKeys((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
      try { localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  const sortDir: 'asc' | 'desc' = searchParams.get('dir') === 'asc' ? 'asc' : 'desc'
  const visibleColumns = STOCK_COLUMNS.filter((c) => c.locked || visibleKeys.includes(c.key))
  const activeFilterCount = ALL_FILTER_KEYS.filter((k) => searchParams.get(k)).length

  // Click a column header → sort by it; clicking the active column flips direction.
  function handleSort(sortKey: string) {
    const params = new URLSearchParams(searchParams.toString())
    const nextDir = sortBy === sortKey && sortDir === 'desc' ? 'asc' : 'desc'
    params.set('sort', sortKey)
    params.set('dir', nextDir)
    params.delete('page')
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
              style={{ fontSize: 11, color: 'var(--color-text-muted)' }}
            >
              Bersihkan
            </button>
          )}

          <button
            onClick={onOpenFilters}
            className="relative flex items-center md:hidden"
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
          </button>

        </div>
      </div>

      {/* Active Filter Chips */}
      <ActiveFilterChips />

      {/* Table head — title + count pill (left), sort control (right) */}
      <div
        className="flex items-center justify-between px-6 py-3 flex-shrink-0"
        style={{ background: 'var(--color-bg-card)', borderBottom: '2px solid var(--color-border)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-mono flex-shrink-0" style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: 'var(--color-text-primary)' }}>
            MATCHING STOCKS
          </span>
          <span
            className="font-mono rounded-full flex-shrink-0"
            style={{ fontSize: 10, fontWeight: 600, padding: '3px 10px', background: 'var(--color-brand-bg)', border: '1px solid var(--color-brand)', color: 'var(--color-brand-text)' }}
          >
            ~{fmtNumID(total)} saham
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="relative">
            <button
              onClick={() => setColsOpen((v) => !v)}
              className="font-mono rounded flex items-center gap-1.5"
              style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.5, padding: '5px 10px', background: 'var(--color-bg-page)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
              aria-label="Pilih kolom"
            >
              KOLOM
              <span style={{ fontSize: 8, color: 'var(--color-text-muted)' }}>▾</span>
            </button>
            {colsOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setColsOpen(false)} />
                <div
                  className="absolute right-0 top-full mt-1 z-30 rounded-xl shadow-lg py-1.5 max-h-[60vh] overflow-y-auto"
                  style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', minWidth: 180 }}
                >
                  {OPTIONAL_COLUMNS.map((c) => {
                    const on = visibleKeys.includes(c.key)
                    return (
                      <button
                        key={c.key}
                        onClick={() => toggleColumn(c.key)}
                        className="w-full text-left px-3 py-2 font-mono flex items-center gap-2 transition-colors"
                        style={{ fontSize: 11, color: on ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}
                      >
                        <span
                          className="flex items-center justify-center rounded flex-shrink-0"
                          style={{ width: 14, height: 14, border: `1px solid ${on ? 'var(--color-brand)' : 'var(--color-border)'}`, background: on ? 'var(--color-brand)' : 'transparent', color: '#0A0A0A', fontSize: 10, fontWeight: 700 }}
                        >
                          {on ? '✓' : ''}
                        </span>
                        {c.label}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Stock table — columns/rows, horizontally scrollable on narrow viewports */}
      <div className="flex-1 overflow-x-auto">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <p className="font-mono" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              Tidak ada saham yang cocok.
            </p>
            {activeFilterCount > 0 && (
              <button
                onClick={handleClearAll}
                className="font-mono font-semibold"
                style={{ fontSize: 11, color: 'var(--color-brand-text)' }}
              >
                BERSIHKAN SEMUA FILTER
              </button>
            )}
          </div>
        ) : (
          <StockTable rows={rows} columns={visibleColumns} sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
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
              style={{ fontSize: 12, color: 'var(--color-brand-text)', background: 'var(--color-brand-bg)' }}
            >
              ← Prev
            </Link>
          )}
          <span className="font-mono" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={buildPageUrl(page + 1)}
              className="font-mono px-3 py-1.5 rounded-md"
              style={{ fontSize: 12, color: 'var(--color-brand-text)', background: 'var(--color-brand-bg)' }}
            >
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
