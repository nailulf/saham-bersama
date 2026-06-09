import type { CAGRResult } from '@/lib/types/api'

function cagrClass(v: number | null) {
  if (v === null) return 'text-[var(--color-text-muted)]'
  if (v >= 10) return 'text-[#00FF88] font-semibold'
  if (v >= 5)  return 'text-amber-500 font-medium'
  if (v >= 0)  return 'text-[var(--color-text-primary)]'
  return 'text-red-400'
}

function fmt(v: number | null) {
  if (v === null) return '—'
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
}

export function CAGRTable({ results }: { results: CAGRResult[] }) {
  if (results.length === 0) return null

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[var(--color-border)]">
            <th className="text-left px-4 py-2.5 font-mono text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-[0.5px]">Metric</th>
            <th className="text-right px-4 py-2.5 font-mono text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-[0.5px]">3-Year</th>
            <th className="text-right px-4 py-2.5 font-mono text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-[0.5px]">5-Year</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.metric} className="border-b border-[#F5F5F8] last:border-b-0">
              <td className="px-4 py-3 font-mono text-[13px] font-medium text-[var(--color-text-primary)]">{r.label}</td>
              <td className={`px-4 py-3 text-right font-mono text-[13px] ${cagrClass(r.cagr_3yr)}`}>{fmt(r.cagr_3yr)}</td>
              <td className={`px-4 py-3 text-right font-mono text-[13px] ${cagrClass(r.cagr_5yr)}`}>{fmt(r.cagr_5yr)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
