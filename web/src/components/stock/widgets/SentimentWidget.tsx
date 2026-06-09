// Sentimen pasar — ganti dengan integrasi umpan data
const METRICS = [
  'SENTIMEN RITEL',
  'KONSENSUS ANALIS',
  'ARUS INSTITUSI',
  'SHORT INTEREST',
  'AKTIVITAS OPSI',
]

export function SentimentWidget() {
  return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] flex flex-col">
      <div className="px-5 py-3 border-b border-[var(--color-border)]">
        <span className="font-mono text-[13px] font-bold tracking-[0.5px] text-[var(--color-text-primary)]">SENTIMEN PASAR</span>
      </div>

      {/* Foreign net flow bar */}
      <div className="flex flex-col gap-2 px-5 py-3 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[12px] text-[var(--color-text-muted)] tracking-[0.5px] uppercase">ARUS DANA ASING BERSIH (5H)</span>
          <span className="font-mono text-[13px] font-semibold text-[var(--color-text-muted)]">—</span>
        </div>
        <div className="h-2 bg-[var(--color-border)] relative">
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[var(--color-text-muted)] opacity-40" />
        </div>
        <div className="flex justify-between">
          <span className="font-mono text-[11px] text-[var(--color-text-muted)]">JUAL</span>
          <span className="font-mono text-[11px] text-[var(--color-text-muted)]">BELI</span>
        </div>
      </div>

      {/* Sentiment metrics */}
      {METRICS.map((m) => (
        <div
          key={m}
          className="flex items-center justify-between px-5 py-2.5 border-b border-[var(--color-border)] last:border-0"
        >
          <span className="font-mono text-[12px] text-[var(--color-text-muted)] tracking-[0.5px] uppercase">{m}</span>
          <span className="font-mono text-[13px] font-semibold text-[var(--color-text-muted)]">—</span>
        </div>
      ))}
    </div>
  )
}
