'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { ScreenerFilters } from '@/components/home/screener-filters'
import { StockTable, ColumnPicker, DEFAULT_VISIBLE, STORAGE_KEY } from '@/components/home/stock-table'
import type { ColumnKey } from '@/components/home/stock-table'
import { fmtNumID } from '@/lib/calculations/formatters'
import type { ScreenerRow } from '@/lib/types/api'

// All filter keys — used to count active filters and clear them from the URL.
const FILTER_KEYS_ALL = [
  'minRoe', 'maxPe', 'maxPbv', 'minNetMargin', 'minDivYield',
  'minDivAvg3yr', 'minDivAvg5yr',
  'minRevCagr3yr', 'minRevCagr5yr', 'minPriceCagr3yr', 'minPriceCagr5yr', 'minOcfCagr3yr', 'minOcfCagr5yr',
  'minMktCap', 'maxPhaseDays',
  'sector', 'board', 'phase',
  'minRsi', 'maxRsi', 'macdCross', 'maxMacdCrossDays', 'minVolChangePct', 'minVolAvg',
  'wyckoffEvent', 'wyckoffPhase', 'maxWyckoffDays', 'minWyckoffConf',
  'wyckoffEventV2', 'wyckoffPhaseV2', 'wyckoffFsmPhaseV2', 'maxWyckoffDaysV2', 'minWyckoffConfV2',
] as const

interface ScreenerShellProps {
  total: number
  rows: ScreenerRow[]
  sortBy: string
  sortDir: 'asc' | 'desc'
  baseParams: Record<string, string>
  page: number
  totalPages: number
  paginationParams: Record<string, string>
}

// ---------------------------------------------------------------------------
// ScreenerShell — owns sticky control bar, column visibility, and filter-open
// state. Passes visibleCols down to StockTable and open down to ScreenerFilters.
// ---------------------------------------------------------------------------

export function ScreenerShell({
  total,
  rows,
  sortBy,
  sortDir,
  baseParams,
  page,
  totalPages,
  paginationParams,
}: ScreenerShellProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [filterOpen, setFilterOpen] = useState(false)
  const [visibleCols, setVisibleCols] = useState<Set<ColumnKey>>(() => new Set(DEFAULT_VISIBLE))
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Restore column preferences from localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as string[]
        if (Array.isArray(parsed) && parsed.length > 0) {
          setVisibleCols(new Set(parsed as ColumnKey[]))
        }
      }
    } catch { /* ignore */ }

    // Auto-open filter panel if URL already has active filters
    const hasFilters = FILTER_KEYS_ALL.some((k) => searchParams.get(k))
    if (hasFilters) setFilterOpen(true)

    setMounted(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleColumnsChange(next: Set<ColumnKey>) {
    setVisibleCols(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
  }

  // Count of currently applied filters (reflects URL, not in-progress edits).
  const activeFilterCount = FILTER_KEYS_ALL.filter((k) => searchParams.get(k)).length

  // Quick-clear from the sticky bar: signals ScreenerFilters to cancel its
  // pending debounce, then immediately pushes a clean URL.
  function handleQuickClear() {
    window.dispatchEvent(new Event('screener-clear'))
    const params = new URLSearchParams(searchParams.toString())
    FILTER_KEYS_ALL.forEach((k) => params.delete(k))
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div>
      {/* ── Sticky control bar ── */}
      {/* top-14 = height of the navbar (h-14 = 56px, sticky top-0 z-30) */}
      <div className="sticky top-14 z-20 bg-white border-b border-gray-200 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 mb-4">
        <div className="max-w-7xl mx-auto flex items-center gap-2 sm:gap-3">
          {/* Title + count */}
          <div className="flex-1 min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-gray-900 leading-none">IDX Stock Screener</h1>
            <p className="text-xs text-gray-500 mt-0.5">{fmtNumID(total)} stocks</p>
          </div>

          {/* Filters toggle */}
          <button
            onClick={() => setFilterOpen((v) => !v)}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
              filterOpen || activeFilterCount > 0
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M7 8h10M11 12h2" />
            </svg>
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-blue-600 text-white text-[10px] font-bold rounded-full leading-none">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Quick-clear — only visible when filters are active */}
          {activeFilterCount > 0 && (
            <button
              onClick={handleQuickClear}
              title="Clear all filters"
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 px-2 py-1.5 rounded-lg border border-gray-200 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}

          {/* Column picker — rendered after mount to avoid SSR mismatch */}
          {mounted && <ColumnPicker visible={visibleCols} onChange={handleColumnsChange} />}
        </div>
      </div>

      {/* ── Filter panel (controlled by filterOpen) ── */}
      <ScreenerFilters open={filterOpen} />

      {/* ── Stock table ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <StockTable
          rows={rows}
          sortBy={sortBy}
          sortDir={sortDir}
          baseParams={baseParams}
          page={page}
          total={total}
          totalPages={totalPages}
          paginationParams={paginationParams}
          visibleCols={visibleCols}
        />
      </div>
    </div>
  )
}
