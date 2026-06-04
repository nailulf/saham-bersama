'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { ScreenerFilters } from '@/components/home/screener-filters'
import { StockTable, ColumnPicker, DEFAULT_VISIBLE, STORAGE_KEY } from '@/components/home/stock-table'
import type { ColumnKey } from '@/components/home/stock-table'
import { fmtNumID } from '@/lib/calculations/formatters'
import type { ScreenerRow } from '@/lib/types/api'

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

const SIDEBAR_WIDTH = 'w-72' // 288px

interface ScreenerShellProps {
  total: number
  rows: ScreenerRow[]
  sortBy: string
  sortDir: 'asc' | 'desc'
  baseParams: Record<string, string>
  page: number
  totalPages: number
  paginationParams: Record<string, string>
  activeStrategyId?: string
}

// ---------------------------------------------------------------------------
// ScreenerShell — 2-column layout: sticky left filter panel + right table.
// The sidebar collapses to w-0 via CSS; the right column fills remaining space.
// On mobile the sidebar stays hidden until the Filters button is pressed
// (at which point it overlays via fixed positioning).
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
  activeStrategyId: _activeStrategyId,
}: ScreenerShellProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Sidebar open by default on desktop; closed until mounted (SSR-safe)
  const [filterOpen, setFilterOpen] = useState(false)
  const [visibleCols, setVisibleCols] = useState<Set<ColumnKey>>(() => new Set(DEFAULT_VISIBLE))
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as string[]
        if (Array.isArray(parsed) && parsed.length > 0) setVisibleCols(new Set(parsed as ColumnKey[]))
      }
    } catch { /* ignore */ }

    // Default: sidebar open on desktop (md+), closed on mobile
    const isDesktop = window.matchMedia('(min-width: 768px)').matches
    setFilterOpen(isDesktop)

    setMounted(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleColumnsChange(next: Set<ColumnKey>) {
    setVisibleCols(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
  }

  const activeFilterCount = FILTER_KEYS_ALL.filter((k) => searchParams.get(k)).length

  function handleClearAll() {
    window.dispatchEvent(new Event('screener-clear'))
    const params = new URLSearchParams(searchParams.toString())
    FILTER_KEYS_ALL.forEach((k) => params.delete(k))
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    // Break out of the page's horizontal padding so the layout fills full content width.
    <div className="flex -mx-4 sm:-mx-6 lg:-mx-8 min-h-[600px]">

      {/* ── LEFT FILTER SIDEBAR ──────────────────────────────────────────── */}
      {/* Collapses to w-0 with overflow-hidden; inner div has fixed width so
          content clips cleanly during the CSS transition. */}
      <aside
        className={`relative flex-shrink-0 bg-white border-r border-gray-200 overflow-hidden transition-all duration-300 ease-in-out ${
          filterOpen ? SIDEBAR_WIDTH : 'w-0'
        }`}
      >
        {/* Inner wrapper: fixed width so it doesn't reflow during transition */}
        <div className="w-72 flex flex-col h-full">
          {/* Sticky inner: sticks below the navbar */}
          <div className="sticky top-14 h-[calc(100vh-56px)] flex flex-col">

            {/* Sidebar header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M7 8h10M11 12h2" />
                </svg>
                <span className="text-sm font-bold text-gray-800">Filters</span>
                {activeFilterCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-full leading-none">
                    {activeFilterCount}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {activeFilterCount > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors"
                  >
                    Clear all
                  </button>
                )}
                {/* Collapse button */}
                <button
                  onClick={() => setFilterOpen(false)}
                  title="Collapse filters"
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Scrollable filter body */}
            <div className="flex-1 overflow-y-auto px-4 py-5">
              <ScreenerFilters />
            </div>
          </div>
        </div>
      </aside>

      {/* ── RIGHT TABLE COLUMN ───────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 flex flex-col">

        {/* Sticky control bar — spans right column only */}
        <div className="sticky top-14 z-20 bg-white border-b border-gray-200 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 mb-4 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">

            {/* Filters toggle — only shown when sidebar is collapsed */}
            {!filterOpen && (
              <button
                onClick={() => setFilterOpen(true)}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                  activeFilterCount > 0
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
            )}

            {/* Title + stock count */}
            <div className="flex-1 min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-gray-900 leading-none">IDX Stock Screener</h1>
              <p className="text-xs text-gray-500 mt-0.5">{fmtNumID(total)} stocks</p>
            </div>

            {/* Quick-clear when sidebar is hidden and filters are active */}
            {!filterOpen && activeFilterCount > 0 && (
              <button
                onClick={handleClearAll}
                title="Clear all filters"
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 px-2 py-1.5 rounded-lg border border-gray-200 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}

            {/* Column picker */}
            {mounted && <ColumnPicker visible={visibleCols} onChange={handleColumnsChange} />}
          </div>
        </div>

        {/* Stock table */}
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
    </div>
  )
}
