'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'

const FILTER_LABELS: Record<string, string> = {
  minRoe:          'ROE ≥',
  maxPe:           'P/E ≤',
  maxPbv:          'PBV ≤',
  minNetMargin:    'Margin ≥',
  minMktCap:       'MktCap ≥',
  maxMktCap:       'MktCap ≤',
  sector:          'Sektor',
  board:           'Board',
  phase:           'Phase',
  minDivYield:     'Yield ≥',
  minDivAvg3yr:    'Yield3Y ≥',
  minDivAvg5yr:    'Yield5Y ≥',
  minRevCagr3yr:   'Rev3Y ≥',
  minRevCagr5yr:   'Rev5Y ≥',
  minPriceCagr3yr: 'Prc3Y ≥',
  minPriceCagr5yr: 'Prc5Y ≥',
  minOcfCagr3yr:   'OCF3Y ≥',
  minOcfCagr5yr:   'OCF5Y ≥',
  minRsi:          'RSI ≥',
  maxRsi:          'RSI ≤',
  macdCross:       'MACD',
  maxMacdCrossDays:'MACD ≤d',
  minVolChangePct: 'Vol ≥',
  maxVolChangePct: 'Vol ≤',
  minVolAvg:       'VolAvg ≥',
  maxPhaseDays:    'Phase ≤d',
  wyckoffEvent:    'WyEv',
  wyckoffPhase:    'WyPh',
  maxWyckoffDays:  'WyDays ≤',
  minWyckoffConf:  'WyConf ≥',
  wyckoffEventV2:  'WyEv',
  wyckoffPhaseV2:  'WyPh',
  wyckoffFsmPhaseV2: 'WyFSM',
  maxWyckoffDaysV2: 'WyDays ≤',
  minWyckoffConfV2: 'WyConf ≥',
  bandarAccdist:    'Bandar',
}

const ALL_FILTER_KEYS = Object.keys(FILTER_LABELS)

export function ActiveFilterChips() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const activeFilters = ALL_FILTER_KEYS.filter((k) => searchParams.get(k))
  if (activeFilters.length === 0) return null

  function removeFilter(key: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.delete(key)
    params.delete('page')
    // If min+max of same field, clear both when either is removed
    if (key === 'minMktCap') params.delete('maxMktCap')
    if (key === 'maxMktCap') params.delete('minMktCap')
    params.delete('strategy')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none px-5 pb-2.5">
      {activeFilters.map((key) => {
        const val = searchParams.get(key)!
        return (
          <div
            key={key}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md flex-shrink-0"
            style={{
              background: 'var(--color-brand-bg)',
              border: '1px solid var(--color-brand)',
            }}
          >
            <span
              className="font-mono font-medium"
              style={{ fontSize: 10, color: 'var(--color-brand)' }}
            >
              {FILTER_LABELS[key]}: {val}
            </span>
            <button
              onClick={() => removeFilter(key)}
              aria-label={`Remove ${key}`}
              style={{ color: 'var(--color-brand)', lineHeight: 1 }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )
      })}
    </div>
  )
}
