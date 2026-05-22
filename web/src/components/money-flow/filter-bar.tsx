import Link from 'next/link'
import {
  DURATIONS, DURATION_LABEL, type Duration,
  RANK_METRICS, RANK_LABEL, type RankMetric,
} from '@/lib/queries/money-flow'

// Money Flow filter bar: a duration window (1D/7D/30D/YTD) and a rank metric
// (Value/Shares — Shares mirrors IDX's stock-summary sort). Server-rendered
// <Link>s preserve both params, so the page stays a server component and the
// controls work without JS.

interface Props {
  duration: Duration
  rank: RankMetric
}

const href = (duration: Duration, rank: RankMetric) =>
  `/money-flow?range=${duration}&rank=${rank}`

function Pills({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm">
      {children}
    </div>
  )
}

function Pill({ active, to, label }: { active: boolean; to: string; label: string }) {
  return (
    <Link
      href={to}
      scroll={false}
      aria-current={active ? 'true' : undefined}
      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
        active ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
      }`}
    >
      {label}
    </Link>
  )
}

export function FilterBar({ duration, rank }: Props) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Pills>
        {DURATIONS.map((d) => (
          <Pill key={d} active={d === duration} to={href(d, rank)} label={DURATION_LABEL[d]} />
        ))}
      </Pills>
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] text-gray-400">Rank by</span>
        <Pills>
          {RANK_METRICS.map((m) => (
            <Pill key={m} active={m === rank} to={href(duration, m)} label={RANK_LABEL[m]} />
          ))}
        </Pills>
      </div>
    </div>
  )
}
