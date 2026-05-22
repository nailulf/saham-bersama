import Link from 'next/link'
import type { SummaryRow } from '@/lib/queries/money-flow'
import { formatIDRCompact, fmtNumID, formatPercent } from '@/lib/calculations/formatters'

// Most active stocks by total transaction value (IDX official). At the TOTAL
// level buy = sell per stock, so this is a single "where the money churned"
// ranking rather than a buy/sell split. Foreign net (shares) is IDX official.

export function MostActiveTable({ rows, date }: { rows: SummaryRow[]; date: string | null }) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-1">
        <h2 className="text-sm font-semibold text-gray-700">Most Active — Total Value</h2>
        <DateBadge date={date} source="IDX official" />
      </div>
      <p className="text-xs text-gray-400 mb-4">
        Stocks ranked by total transaction value. At the whole-market level buy = sell
        per stock, so this shows where the money concentrated, not a buy/sell split.
      </p>

      {rows.length === 0 ? (
        <Empty />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-100">
                <th className="text-left font-medium py-2 pr-3">#</th>
                <th className="text-left font-medium py-2 pr-3">Stock</th>
                <th className="text-right font-medium py-2 px-3">Close</th>
                <th className="text-right font-medium py-2 px-3">Chg%</th>
                <th className="text-right font-medium py-2 pl-3">Value</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.ticker} className="border-b border-gray-50 hover:bg-gray-50/60">
                  <td className="py-2 pr-3 text-gray-400 tabular-nums">{i + 1}</td>
                  <td className="py-2 pr-3">
                    <Link href={`/stock/${r.ticker}`} className="font-mono font-semibold text-gray-900 hover:text-blue-600">
                      {r.ticker}
                    </Link>
                    {r.name && <span className="hidden xl:inline text-gray-400 ml-2 text-xs">{r.name}</span>}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-gray-700">
                    {r.close != null ? fmtNumID(r.close) : '—'}
                  </td>
                  <td className={`py-2 px-3 text-right tabular-nums font-medium ${changeColor(r.change_pct)}`}>
                    {r.change_pct != null ? `${r.change_pct > 0 ? '+' : ''}${formatPercent(r.change_pct)}` : '—'}
                  </td>
                  <td className="py-2 pl-3 text-right tabular-nums font-semibold text-gray-900">
                    {formatIDRCompact(r.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function changeColor(v: number | null) {
  if (v == null || v === 0) return 'text-gray-400'
  return v > 0 ? 'text-green-600' : 'text-red-600'
}

export function DateBadge({ date, source }: { date: string | null; source: string }) {
  return (
    <span className="text-xs font-medium text-blue-600 bg-blue-50 border border-blue-100 rounded px-2 py-0.5">
      {date ?? '—'} · {source}
    </span>
  )
}

function Empty() {
  return (
    <div className="py-10 text-center text-gray-400">
      <p className="text-sm">No data for this day.</p>
      <p className="text-xs mt-1">
        Run <code className="bg-gray-100 px-1 rounded">python -m scrapers.idx_stock_summary</code>
      </p>
    </div>
  )
}
