import type { VolatilityAlert } from '@/lib/types/api'

// ---------------------------------------------------------------------------
// MarketVolatilityBanner — server component. Warns when a high-volatility
// window (e.g. an index rebalancing between announcement and effective date)
// is currently open or opening soon. Alerts are computed server-side in
// getMarketPulse; this only renders. SSR-safe (no Date() / toLocaleString).
// ---------------------------------------------------------------------------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function fmtDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${Number(d)} ${MONTHS[Number(m) - 1] ?? ''}`
}

function alertLine(a: VolatilityAlert): string {
  if (a.status === 'active') {
    const eff =
      a.daysUntilEvent === 0 ? 'effective today' : `effective ${fmtDate(a.eventDate)} (in ${a.daysUntilEvent}d)`
    return `flows active now — ${eff}.`
  }
  return `window opens ${fmtDate(a.windowStart)} (in ${a.daysUntilStart}d), ${fmtDate(a.eventDate)} effective.`
}

export function MarketVolatilityBanner({ alerts }: { alerts: VolatilityAlert[] }) {
  if (alerts.length === 0) return null
  const hasActive = alerts.some((a) => a.status === 'active')

  return (
    <div
      role="status"
      className="mt-3 flex gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3"
    >
      <span className="text-base leading-none" aria-hidden>⚠️</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-amber-800">
          {hasActive ? 'Elevated volatility window active' : 'Volatility window approaching'}
        </div>
        <ul className="mt-1 space-y-0.5">
          {alerts.map((a) => (
            <li key={`${a.eventDate}-${a.title}`} className="text-xs text-amber-700">
              <span className="font-medium">{a.title}</span>
              {a.source && <span className="text-amber-500"> · {a.source}</span>}
              {' — '}
              {alertLine(a)}
            </li>
          ))}
        </ul>
        <p className="mt-1 text-[11px] text-amber-600">
          Index rebalancing flows can drive sharp, headline-light moves — size positions accordingly.
        </p>
      </div>
    </div>
  )
}
