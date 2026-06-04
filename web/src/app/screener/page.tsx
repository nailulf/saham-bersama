import { Suspense } from 'react'
import { getScreenerRows } from '@/lib/queries/stocks'
import { getStrategies } from '@/lib/queries/strategies'
import { ScreenerListShell } from '@/components/screener/ScreenerListShell'
import { PAGE_SIZE } from '@/lib/constants'

const NUMERIC_PARAMS = [
  'minRoe', 'maxPe', 'maxPbv', 'minNetMargin', 'minDivYield',
  'minDivAvg3yr', 'minDivAvg5yr',
  'minRevCagr3yr', 'minRevCagr5yr', 'minPriceCagr3yr', 'minPriceCagr5yr', 'minOcfCagr3yr', 'minOcfCagr5yr',
  'minMktCap', 'maxMktCap', 'maxPhaseDays',
  'minRsi', 'maxRsi', 'maxMacdCrossDays', 'minVolChangePct', 'maxVolChangePct', 'minVolAvg',
  'maxWyckoffDays', 'minWyckoffConf',
  'maxWyckoffDaysV2', 'minWyckoffConfV2',
] as const

const STRING_PARAMS = [
  'sector', 'board', 'phase', 'macdCross',
  'wyckoffEvent', 'wyckoffPhase',
  'wyckoffEventV2', 'wyckoffPhaseV2', 'wyckoffFsmPhaseV2',
] as const

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>
}

export default async function ScreenerPage({ searchParams }: PageProps) {
  const sp = await searchParams

  const page    = Math.max(1, Number(sp.page ?? 1))
  const sortBy  = sp.sort ?? 'market_cap'
  const sortDir = (sp.dir === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc'

  const filters: Record<string, string | number | undefined> = { sortBy, sortDir }
  for (const key of STRING_PARAMS) {
    if (sp[key]) filters[key] = sp[key]
  }
  for (const key of NUMERIC_PARAMS) {
    if (sp[key]) filters[key] = Number(sp[key])
  }

  const [{ rows, total }, strategies] = await Promise.all([
    getScreenerRows(filters, page),
    getStrategies(),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const activeStrategyId = sp.strategy

  return (
    <main className="min-h-screen" style={{ background: 'var(--color-bg-page)' }}>
      <Suspense>
        <ScreenerListShell
          rows={rows}
          total={total}
          page={page}
          totalPages={totalPages}
          sortBy={sortBy}
          strategies={strategies}
          activeStrategyId={activeStrategyId}
        />
      </Suspense>
    </main>
  )
}
