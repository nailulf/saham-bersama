'use client'

import { useState } from 'react'
import { ScreenerListShell } from '@/components/screener/ScreenerListShell'
import { FilterPanel } from '@/components/screener/filters/FilterPanel'
import type { FilterState } from '@/components/screener/filters/types'
import type { ScreenerRow } from '@/lib/types/api'
import type { Strategy } from '@/lib/types/database'

interface ScreenerShellProps {
  rows: ScreenerRow[]
  total: number
  page: number
  totalPages: number
  sortBy: string
  strategies: Strategy[]
  activeStrategyId?: string
  initialFilters: FilterState
  editStrategy?: Strategy
  autoOpenPanel: boolean
}

export function ScreenerShell({
  rows, total, page, totalPages, sortBy, strategies,
  activeStrategyId, initialFilters, editStrategy, autoOpenPanel,
}: ScreenerShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(autoOpenPanel)

  return (
    <div className="md:flex" style={{ background: 'var(--color-bg-page)' }}>
      {/* Desktop sidebar — always visible at md+ */}
      <aside
        className="hidden md:block md:w-[360px] md:flex-shrink-0 md:sticky md:top-0 md:h-screen md:overflow-hidden"
        style={{ borderRight: '1px solid var(--color-border)' }}
      >
        <FilterPanel initialFilters={initialFilters} editStrategy={editStrategy} />
      </aside>

      {/* Results column */}
      <div className="flex-1 min-w-0">
        <ScreenerListShell
          rows={rows}
          total={total}
          page={page}
          totalPages={totalPages}
          sortBy={sortBy}
          strategies={strategies}
          activeStrategyId={activeStrategyId}
          onOpenFilters={() => setDrawerOpen(true)}
        />
      </div>

      {/* Mobile sheet — only below md */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setDrawerOpen(false)}
          />
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-2xl overflow-hidden"
            style={{ top: '5dvh', background: 'var(--color-bg-card)', overscrollBehavior: 'contain' }}
          >
            <FilterPanel
              initialFilters={initialFilters}
              editStrategy={editStrategy}
              onClose={() => setDrawerOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
