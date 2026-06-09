import type { CAGRResult, HealthScore } from '@/lib/types/api'
import { CAGRTable } from '@/components/stock/cagr-table'
import { HealthScorecard } from '@/components/stock/health-scorecard'

interface Props {
  cagr: CAGRResult[]
  health: HealthScore[]
}

export function GrowthHealthWidget({ cagr, health }: Props) {
  if (cagr.length === 0 && health.length === 0) return null

  return (
    <div className="px-4 md:px-12 py-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {cagr.length > 0 && (
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] flex flex-col">
            <div className="px-5 py-3 border-b border-[var(--color-border)]">
              <span className="font-mono text-[13px] font-bold tracking-[0.5px] text-[var(--color-text-primary)]">
                TINGKAT PERTUMBUHAN (CAGR)
              </span>
            </div>
            <div className="p-5">
              <CAGRTable results={cagr} />
            </div>
          </div>
        )}
        {health.length > 0 && (
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] flex flex-col">
            <div className="px-5 py-3 border-b border-[var(--color-border)]">
              <span className="font-mono text-[13px] font-bold tracking-[0.5px] text-[var(--color-text-primary)]">
                KESEHATAN KEUANGAN
              </span>
            </div>
            <div className="p-5">
              <HealthScorecard scores={health} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
