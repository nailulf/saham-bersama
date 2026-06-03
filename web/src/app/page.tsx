import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getScreenerRows } from '@/lib/queries/stocks'
import { getStrategies } from '@/lib/queries/strategies'
import { ScreenerShell } from '@/components/home/screener-shell'
import { QuickAccessBar } from '@/components/home/quick-access-bar'
import { MarketPulseHeader } from '@/components/home/market-pulse-header'
import { PAGE_SIZE } from '@/lib/constants'

const NUMERIC_PARAMS = [
  'minRoe', 'maxPe', 'maxPbv', 'minNetMargin', 'minDivYield',
  'minDivAvg3yr', 'minDivAvg5yr',
  'minRevCagr3yr', 'minRevCagr5yr', 'minPriceCagr3yr', 'minPriceCagr5yr', 'minOcfCagr3yr', 'minOcfCagr5yr',
  'minMktCap', 'maxPhaseDays',
  'minRsi', 'maxRsi', 'maxMacdCrossDays', 'minVolChangePct', 'minVolAvg',
  'maxWyckoffDays', 'minWyckoffConf',
  'maxWyckoffDaysV2', 'minWyckoffConfV2',
] as const

const STRING_PARAMS = [
  'sector', 'board', 'phase', 'macdCross',
  'wyckoffEvent', 'wyckoffPhase',
  'wyckoffEventV2', 'wyckoffPhaseV2', 'wyckoffFsmPhaseV2',
] as const

const ALL_FILTER_PARAMS = [...NUMERIC_PARAMS, ...STRING_PARAMS] as const

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>
}

export default async function HomePage({ searchParams }: PageProps) {
  const sp = await searchParams

  // If no filters and no strategy are active, redirect to the most recently
  // saved strategy so the user always lands on a meaningful filtered view.
  const hasActiveFilter = ALL_FILTER_PARAMS.some((k) => sp[k])
  const hasStrategy = Boolean(sp.strategy)

  if (!hasActiveFilter && !hasStrategy) {
    const strategies = await getStrategies()
    if (strategies.length > 0) {
      const latest = strategies[0] // ordered created_at DESC
      const filters = (latest.filters ?? {}) as Record<string, string>
      const params = new URLSearchParams()
      params.set('strategy', latest.id)
      for (const [k, v] of Object.entries(filters)) {
        if (v != null && v !== '') params.set(k, String(v))
      }
      redirect(`/?${params.toString()}`)
    }
  }

  const page    = Math.max(1, Number(sp.page ?? 1))
  const sortBy  = sp.sort ?? 'ticker'
  const sortDir = (sp.dir === 'asc' ? 'asc' : sp.dir === 'desc' ? 'desc' : sp.sort ? 'desc' : 'asc') as 'asc' | 'desc'

  const filters: Record<string, string | number | undefined> = { sortBy, sortDir }
  for (const key of STRING_PARAMS) {
    if (sp[key]) filters[key] = sp[key]
  }
  for (const key of NUMERIC_PARAMS) {
    if (sp[key]) filters[key] = Number(sp[key])
  }

  const { rows, total } = await getScreenerRows(filters, page)
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const baseParams: Record<string, string> = {}
  for (const key of ALL_FILTER_PARAMS) {
    if (sp[key]) baseParams[key] = sp[key]!
  }

  const paginationParams = { ...baseParams, sort: sortBy, dir: sortDir }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Suspense>
        <MarketPulseHeader />
      </Suspense>

      <Suspense>
        <QuickAccessBar />
      </Suspense>

      <Suspense>
        <ScreenerShell
          total={total}
          rows={rows}
          sortBy={sortBy}
          sortDir={sortDir}
          baseParams={baseParams}
          page={page}
          totalPages={totalPages}
          paginationParams={paginationParams}
        />
      </Suspense>
    </main>
  )
}
