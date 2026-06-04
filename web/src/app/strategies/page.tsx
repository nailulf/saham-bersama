import { Suspense } from 'react'
import { getStrategies } from '@/lib/queries/strategies'
import { StrategyListPage } from '@/components/strategies/StrategyListPage'

export default async function StrategiesPage() {
  const strategies = await getStrategies()

  return (
    <main className="min-h-screen" style={{ background: 'var(--color-bg-page)' }}>
      <Suspense>
        <StrategyListPage strategies={strategies} watchlistCount={0} />
      </Suspense>
    </main>
  )
}
