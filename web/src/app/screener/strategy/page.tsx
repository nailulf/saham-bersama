import { Suspense } from 'react'
import { getStrategyById } from '@/lib/queries/strategies'
import { StrategyBuilderShell } from '@/components/screener/StrategyBuilderShell'

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>
}

export default async function StrategyPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const strategyId = sp.id

  const strategy = strategyId ? await getStrategyById(strategyId) : undefined

  return (
    <main className="min-h-screen" style={{ background: 'var(--color-bg-page)' }}>
      <Suspense>
        <StrategyBuilderShell initialStrategy={strategy ?? undefined} />
      </Suspense>
    </main>
  )
}
