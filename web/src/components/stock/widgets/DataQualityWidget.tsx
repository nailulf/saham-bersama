import type { DataQuality } from '@/lib/types/api'
import { DataQualityPanel } from '@/components/stock/data-quality-panel'

interface Props {
  quality: DataQuality | null
  ticker: string
}

export function DataQualityWidget({ quality, ticker }: Props) {
  if (!quality) return null

  return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] flex flex-col">
      <div className="px-5 py-3 border-b border-[var(--color-border)]">
        <span className="font-mono text-[13px] font-bold tracking-[0.5px] text-[var(--color-text-primary)]">KUALITAS DATA</span>
      </div>
      <div className="p-5">
        <DataQualityPanel data={quality} ticker={ticker} />
      </div>
    </div>
  )
}
