'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { BrokerFlowRow } from '@/lib/queries/money-flow'
import { formatIDRCompact } from '@/lib/calculations/formatters'
import { DateBadge } from './most-active-table'

// Market-wide top brokers by total buy (or sell) value across all stocks, each
// expandable to its top-10 emiten on that side. Net value is shown for context.

interface Props {
  title: string
  subtitle: string
  brokers: BrokerFlowRow[]
  side: 'buy' | 'sell'
  date: string | null
}

const TYPE_STYLE: Record<string, string> = {
  Asing: 'bg-purple-50 text-purple-700 border-purple-100',
  Lokal: 'bg-blue-50 text-blue-700 border-blue-100',
  Pemerintah: 'bg-amber-50 text-amber-700 border-amber-100',
}

export function TopBrokersSection({ title, subtitle, brokers, side, date }: Props) {
  const accent = side === 'buy' ? '#10B981' : '#EF4444'
  const sideValue = (b: BrokerFlowRow) => (side === 'buy' ? b.buy_value : b.sell_value)
  const max = Math.max(1, ...brokers.map(sideValue))

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-1">
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
        <DateBadge date={date} source="Stockbit broker flow" />
      </div>
      <p className="text-xs text-gray-400 mb-4">{subtitle}</p>

      {brokers.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-400">No broker data for this day.</div>
      ) : (
        <ul className="divide-y divide-gray-50">
          {brokers.map((b, i) => (
            <BrokerRow
              key={b.broker_code}
              rank={i + 1}
              broker={b}
              side={side}
              accent={accent}
              barPct={(sideValue(b) / max) * 100}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function BrokerRow({
  rank, broker, side, accent, barPct,
}: { rank: number; broker: BrokerFlowRow; side: 'buy' | 'sell'; accent: string; barPct: number }) {
  const [open, setOpen] = useState(false)
  const sideVal = side === 'buy' ? broker.buy_value : broker.sell_value
  const typeStyle = broker.broker_type ? TYPE_STYLE[broker.broker_type] ?? 'bg-gray-50 text-gray-600 border-gray-100' : ''

  return (
    <li>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-gray-50/60 rounded px-1"
      >
        <span className="text-xs text-gray-400 tabular-nums w-5 shrink-0">{rank}</span>
        <span className="font-mono text-sm font-bold text-gray-900 w-9 shrink-0">{broker.broker_code}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700 truncate">{broker.broker_name}</span>
            {broker.broker_type && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${typeStyle}`}>
                {broker.broker_type}
              </span>
            )}
          </div>
          <div className="h-1.5 mt-1 bg-gray-50 rounded-full overflow-hidden max-w-xs">
            <div className="h-full rounded-full" style={{ width: `${barPct}%`, background: accent, opacity: 0.85 }} />
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-semibold tabular-nums" style={{ color: accent }}>
            {formatIDRCompact(sideVal)}
          </div>
          <div className="text-[10px] text-gray-400 tabular-nums">
            net {formatIDRCompact(broker.net_value)} · {broker.ticker_count} stocks
          </div>
        </div>
        <span className={`text-gray-300 text-xs transition-transform shrink-0 ${open ? 'rotate-90' : ''}`}>▶</span>
      </button>

      {open && (
        <div className="pb-3 pl-9 pr-1">
          <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">
            Top {broker.breakdown.length} emiten by {side === 'buy' ? 'buy' : 'sell'} value
          </div>
          {broker.breakdown.length === 0 ? (
            <div className="text-xs text-gray-400">No breakdown available.</div>
          ) : (
            <table className="w-full text-xs">
              <tbody>
                {broker.breakdown.map((e) => {
                  const v = side === 'buy' ? e.buy_value : e.sell_value
                  return (
                    <tr key={e.ticker} className="border-b border-gray-50 last:border-0">
                      <td className="py-1 pr-2">
                        <Link href={`/stock/${e.ticker}`} className="font-mono font-semibold text-gray-700 hover:text-blue-600">
                          {e.ticker}
                        </Link>
                      </td>
                      <td className="py-1 pr-2 text-gray-400 truncate max-w-[160px] hidden sm:table-cell">{e.name ?? ''}</td>
                      <td className="py-1 px-2 text-right tabular-nums font-medium" style={{ color: accent }}>
                        {formatIDRCompact(v)}
                      </td>
                      <td className="py-1 pl-2 text-right tabular-nums text-gray-400">
                        net {formatIDRCompact(e.net_value)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </li>
  )
}
