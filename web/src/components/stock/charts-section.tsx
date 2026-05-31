import type { FinancialYear } from '@/lib/types/api'
import { Card } from '@/components/ui/card'
import { FinancialMetricChart } from '@/components/charts/financial-metric-chart'

export function ChartsSection({ data }: { data: FinancialYear[] }) {
  return (
    <Card title="Financial Charts">
      <div className="p-6">
        <FinancialMetricChart data={data} />
      </div>
    </Card>
  )
}
