'use client'

import { useState, useTransition, useEffect, useRef, useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { track } from '@/lib/analytics'

const BOARDS = ['Main', 'Development', 'Acceleration'] as const

const PHASES = [
  { value: 'uptrend',          label: 'Uptrend' },
  { value: 'downtrend',        label: 'Downtrend' },
  { value: 'sideways_bullish', label: 'Sideways ↑' },
  { value: 'sideways_bearish', label: 'Sideways ↓' },
] as const

const MACD_CROSS_OPTIONS = [
  { value: 'golden_cross', label: 'Golden Cross' },
  { value: 'death_cross',  label: 'Death Cross' },
] as const

const WYCKOFF_EVENTS_V1 = [
  { value: 'Spring',           label: 'Spring (bullish reversal)' },
  { value: 'SC',               label: 'Selling Climax' },
  { value: 'SOS',              label: 'Sign of Strength' },
  { value: 'LPS',              label: 'Last Point of Support' },
  { value: 'no_supply',        label: 'No Supply' },
  { value: 'passive_markup',   label: 'Passive Markup (drift up)' },
  { value: 'UTAD',             label: 'UTAD (bearish reversal)' },
  { value: 'BC',               label: 'Buying Climax' },
  { value: 'SOW',              label: 'Sign of Weakness' },
  { value: 'LPSY',             label: 'Last Point of Supply' },
  { value: 'no_demand',        label: 'No Demand' },
  { value: 'passive_markdown', label: 'Passive Markdown (drift down)' },
  { value: 'absorption',       label: 'Absorption' },
] as const

const WYCKOFF_EVENTS_V2 = [
  { value: 'SC',                  label: 'Selling Climax' },
  { value: 'BC',                  label: 'Buying Climax' },
  { value: 'Spring',              label: 'Spring' },
  { value: 'UTAD',                label: 'UTAD' },
  { value: 'SOS',                 label: 'Sign of Strength' },
  { value: 'LPS',                 label: 'Last Point of Support' },
  { value: 'SOW',                 label: 'Sign of Weakness' },
  { value: 'LPSY',                label: 'Last Point of Supply' },
  { value: 'distr_failed',        label: 'Distribution Failed (re-accum)' },
  { value: 'accum_failed',        label: 'Accumulation Failed (re-distr)' },
  { value: 'basis_building',      label: 'Basis Building (soft accum)' },
  { value: 'topping_action',      label: 'Topping Action (soft distr)' },
  { value: 'range_breakout_up',   label: 'Range Breakout Up' },
  { value: 'range_breakout_down', label: 'Range Breakout Down' },
  { value: 'markup_exhaustion',   label: 'Markup Exhaustion' },
  { value: 'markdown_exhaustion', label: 'Markdown Exhaustion' },
] as const

const WYCKOFF_PHASES = [
  { value: 'accumulation', label: 'Accumulation' },
  { value: 'markup',       label: 'Markup' },
  { value: 'distribution', label: 'Distribution' },
  { value: 'markdown',     label: 'Markdown' },
] as const

const WYCKOFF_FSM_PHASES_V2 = [
  { value: 'unknown',          label: 'Unknown' },
  { value: 'downtrend',        label: 'Downtrend' },
  { value: 'accumulation_a',   label: 'Accum A (SC/AR/ST)' },
  { value: 'accumulation_b',   label: 'Accum B (range)' },
  { value: 'accumulation_c',   label: 'Accum C (Spring)' },
  { value: 'accumulation_d',   label: 'Accum D (SOS/LPS)' },
  { value: 'markup',           label: 'Markup' },
  { value: 'uptrend',          label: 'Uptrend' },
  { value: 'distribution_a',   label: 'Distr A (BC/AR/ST)' },
  { value: 'distribution_b',   label: 'Distr B (range)' },
  { value: 'distribution_c',   label: 'Distr C (UTAD)' },
  { value: 'distribution_d',   label: 'Distr D (SOW/LPSY)' },
  { value: 'markdown',         label: 'Markdown' },
] as const

const SECTORS = [
  { value: 'Financials',                label: 'Financials' },
  { value: 'Energy',                    label: 'Energy' },
  { value: 'Basic Materials',           label: 'Basic Materials' },
  { value: 'Barang Konsumen Primer',    label: 'Consumer Staples' },
  { value: 'Barang Konsumen Non-Primer', label: 'Consumer Discretionary' },
  { value: 'Industrials',              label: 'Industrials' },
  { value: 'Property & Real Estate',   label: 'Property & Real Estate' },
  { value: 'Technology',               label: 'Technology' },
  { value: 'Infrastructure',           label: 'Infrastructure' },
  { value: 'Transportation & Logistics', label: 'Transportation & Logistics' },
  { value: 'Healthcare',               label: 'Healthcare' },
] as const

const FILTER_KEYS = [
  'minRoe', 'maxPe', 'maxPbv', 'minNetMargin', 'minDivYield',
  'minDivAvg3yr', 'minDivAvg5yr',
  'minRevCagr3yr', 'minRevCagr5yr', 'minPriceCagr3yr', 'minPriceCagr5yr', 'minOcfCagr3yr', 'minOcfCagr5yr',
  'minMktCap',
  'maxPhaseDays',
  'sector', 'board', 'phase',
  'minRsi', 'maxRsi', 'macdCross', 'maxMacdCrossDays', 'minVolChangePct', 'minVolAvg',
  'wyckoffEvent', 'wyckoffPhase', 'maxWyckoffDays', 'minWyckoffConf',
  'wyckoffEventV2', 'wyckoffPhaseV2', 'wyckoffFsmPhaseV2',
  'maxWyckoffDaysV2', 'minWyckoffConfV2',
] as const

type FilterKey = typeof FILTER_KEYS[number]
type FilterState = Record<FilterKey, string>

const EMPTY_FILTERS: FilterState = Object.fromEntries(FILTER_KEYS.map((k) => [k, ''])) as FilterState

function readFilters(params: URLSearchParams): FilterState {
  const f = { ...EMPTY_FILTERS }
  for (const key of FILTER_KEYS) f[key] = params.get(key) ?? ''
  return f
}

function hasActiveFilters(f: FilterState) {
  return Object.values(f).some(Boolean)
}

const inputCls = 'w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400'
const selectCls = `${inputCls} bg-white`

function NumInput({ label, placeholder, value, onChange }: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input type="number" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />
    </div>
  )
}

function MultiSelect({ label, options, value, onChange }: {
  label: string
  options: readonly { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = new Set(value ? value.split(',') : [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function toggle(v: string) {
    const next = new Set(selected)
    if (next.has(v)) next.delete(v)
    else next.add(v)
    onChange([...next].join(','))
  }

  const display = selected.size === 0
    ? 'Any'
    : options.filter((o) => selected.has(o.value)).map((o) => o.label).join(', ')

  return (
    <div ref={ref} className="relative">
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${inputCls} bg-white text-left truncate flex items-center justify-between gap-1`}
      >
        <span className="truncate">{display}</span>
        <svg className="w-3 h-3 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-20 w-48 bg-white border border-gray-200 rounded-lg shadow-lg p-1">
          {options.map((o) => (
            <label key={o.value} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer text-sm text-gray-700">
              <input
                type="checkbox"
                checked={selected.has(o.value)}
                onChange={() => toggle(o.value)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              {o.label}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ScreenerFilters — controlled panel (open state owned by ScreenerShell).
// Auto-applies via 500ms debounce on any filter change. No Apply button.
// Listens for the 'screener-clear' event to cancel pending debounce.
// ---------------------------------------------------------------------------

export function ScreenerFilters({ open }: { open: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [, startTransition] = useTransition()

  // Used to distinguish URL-driven state sync from user-driven changes.
  const isProgrammaticRef = useRef(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync local filter state from URL (programmatic — must not trigger debounce).
  useEffect(() => {
    const fromUrl = readFilters(searchParams)
    isProgrammaticRef.current = true
    setFilters(fromUrl)
  }, [searchParams])

  // Auto-apply: 500ms debounce on user-driven filter changes only.
  useEffect(() => {
    if (isProgrammaticRef.current) {
      isProgrammaticRef.current = false
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      for (const key of FILTER_KEYS) {
        if (filters[key]) params.set(key, filters[key])
        else params.delete(key)
      }
      params.delete('page')
      track.screenerFilterApplied(filters)
      startTransition(() => router.push(`${pathname}?${params.toString()}`))
    }, 500)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters])

  // Cancel pending debounce when the shell's quick-clear fires.
  useEffect(() => {
    const handler = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      isProgrammaticRef.current = true
    }
    window.addEventListener('screener-clear', handler)
    return () => window.removeEventListener('screener-clear', handler)
  }, [])

  // Wyckoff version toggle (v1 flat-pass vs v2 FSM)
  const [wyckoffVersion, setWyckoffVersion] = useState<'v1' | 'v2'>('v2')
  useEffect(() => {
    if (searchParams.get('wyckoffEvent') || searchParams.get('wyckoffPhase')
        || searchParams.get('maxWyckoffDays') || searchParams.get('minWyckoffConf')) {
      setWyckoffVersion('v1')
    }
  }, [searchParams])

  // Strategy save
  const [savingStrategy, setSavingStrategy] = useState(false)
  const [strategyName, setStrategyName] = useState('')
  const strategyInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (savingStrategy) strategyInputRef.current?.focus()
  }, [savingStrategy])

  const saveStrategy = useCallback(async () => {
    const name = strategyName.trim()
    if (!name) return
    const filterObj: Record<string, string> = {}
    for (const key of FILTER_KEYS) {
      const v = searchParams.get(key)
      if (v) filterObj[key] = v
    }
    try {
      const res = await fetch('/api/strategies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, filters: filterObj }),
      })
      if (res.ok) {
        track.strategySaved(name, Object.keys(filterObj).length)
        setSavingStrategy(false)
        setStrategyName('')
        window.dispatchEvent(new Event('strategy-change'))
      }
    } catch { /* silent */ }
  }, [strategyName, searchParams])

  const set = (key: FilterKey) => (v: string) => setFilters((f) => ({ ...f, [key]: v }))

  function clearFilters() {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    isProgrammaticRef.current = true
    const params = new URLSearchParams(searchParams.toString())
    for (const key of FILTER_KEYS) params.delete(key)
    params.delete('page')
    setFilters({ ...EMPTY_FILTERS })
    track.screenerFilterCleared()
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  const active = hasActiveFilters(filters)

  if (!open) return null

  return (
    <div className="mb-4 p-4 bg-white border border-gray-200 rounded-xl shadow-sm space-y-4">
      {/* Row 1: Fundamentals & Classification */}
      <div>
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Fundamentals & Classification</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <NumInput label="ROE ≥ (%)" placeholder="15" value={filters.minRoe} onChange={set('minRoe')} />
          <NumInput label="P/E ≤" placeholder="20" value={filters.maxPe} onChange={set('maxPe')} />
          <NumInput label="P/BV ≤" placeholder="3" value={filters.maxPbv} onChange={set('maxPbv')} />
          <NumInput label="Net Margin ≥ (%)" placeholder="10" value={filters.minNetMargin} onChange={set('minNetMargin')} />
          <NumInput label="Mkt Cap ≥ (T)" placeholder="1" value={filters.minMktCap} onChange={set('minMktCap')} />
          <div>
            <label className="block text-xs text-gray-500 mb-1">Sector</label>
            <select value={filters.sector} onChange={(e) => set('sector')(e.target.value)} className={selectCls}>
              <option value="">All</option>
              {SECTORS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Board</label>
            <select value={filters.board} onChange={(e) => set('board')(e.target.value)} className={selectCls}>
              <option value="">Any</option>
              {BOARDS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Row 2: Dividends */}
      <div>
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Dividends</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <NumInput label="Div Yield ≥ (%)" placeholder="3" value={filters.minDivYield} onChange={set('minDivYield')} />
          <NumInput label="Div Avg 3Y ≥ (%)" placeholder="3" value={filters.minDivAvg3yr} onChange={set('minDivAvg3yr')} />
          <NumInput label="Div Avg 5Y ≥ (%)" placeholder="3" value={filters.minDivAvg5yr} onChange={set('minDivAvg5yr')} />
        </div>
      </div>

      {/* Row 3: Growth */}
      <div>
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Growth (CAGR)</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <NumInput label="Rev CAGR 3Y ≥ (%)" placeholder="10" value={filters.minRevCagr3yr} onChange={set('minRevCagr3yr')} />
          <NumInput label="Rev CAGR 5Y ≥ (%)" placeholder="10" value={filters.minRevCagr5yr} onChange={set('minRevCagr5yr')} />
          <NumInput label="Price CAGR 3Y ≥ (%)" placeholder="5" value={filters.minPriceCagr3yr} onChange={set('minPriceCagr3yr')} />
          <NumInput label="Price CAGR 5Y ≥ (%)" placeholder="5" value={filters.minPriceCagr5yr} onChange={set('minPriceCagr5yr')} />
          <NumInput label="OCF CAGR 3Y ≥ (%)" placeholder="10" value={filters.minOcfCagr3yr} onChange={set('minOcfCagr3yr')} />
          <NumInput label="OCF CAGR 5Y ≥ (%)" placeholder="10" value={filters.minOcfCagr5yr} onChange={set('minOcfCagr5yr')} />
        </div>
      </div>

      {/* Row 4: Technical Signals */}
      <div>
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Technical Signals</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <MultiSelect label="Phase" options={PHASES} value={filters.phase} onChange={set('phase')} />
          <NumInput label="Phase Days ≤" placeholder="20" value={filters.maxPhaseDays} onChange={set('maxPhaseDays')} />
          <NumInput label="RSI ≥" placeholder="35" value={filters.minRsi} onChange={set('minRsi')} />
          <NumInput label="RSI ≤" placeholder="60" value={filters.maxRsi} onChange={set('maxRsi')} />
          <div>
            <label className="block text-xs text-gray-500 mb-1">MACD Cross</label>
            <select value={filters.macdCross} onChange={(e) => set('macdCross')(e.target.value)} className={selectCls}>
              <option value="">Any</option>
              {MACD_CROSS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <NumInput label="Cross ≤ N days" placeholder="5" value={filters.maxMacdCrossDays} onChange={set('maxMacdCrossDays')} />
          <NumInput label="Vol Change ≥ (%)" placeholder="150" value={filters.minVolChangePct} onChange={set('minVolChangePct')} />
          <NumInput label="Avg Vol ≥ (Jt)" placeholder="1" value={filters.minVolAvg} onChange={set('minVolAvg')} />
        </div>
      </div>

      {/* Row 5: Wyckoff Signals */}
      <div>
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
          <span>Wyckoff Signals</span>
          <div className="flex gap-0.5 border border-gray-200 rounded p-0.5 bg-white">
            {(['v1', 'v2'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setWyckoffVersion(v)}
                title={v === 'v1' ? 'Flat-pass detector' : 'FSM detector (recommended)'}
                className={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors ${
                  wyckoffVersion === v
                    ? 'bg-blue-600 text-white'
                    : 'bg-transparent text-gray-500 hover:bg-gray-100'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        {wyckoffVersion === 'v1' ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MultiSelect label="Wyckoff Event (v1)" options={WYCKOFF_EVENTS_V1} value={filters.wyckoffEvent} onChange={set('wyckoffEvent')} />
            <div>
              <label className="block text-xs text-gray-500 mb-1">Wyckoff Phase</label>
              <select value={filters.wyckoffPhase} onChange={(e) => set('wyckoffPhase')(e.target.value)} className={selectCls}>
                <option value="">Any</option>
                {WYCKOFF_PHASES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <NumInput label="Event ≤ N days ago" placeholder="14" value={filters.maxWyckoffDays} onChange={set('maxWyckoffDays')} />
            <NumInput label="Min Confidence ≥" placeholder="70" value={filters.minWyckoffConf} onChange={set('minWyckoffConf')} />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <MultiSelect label="Wyckoff Event (v2)" options={WYCKOFF_EVENTS_V2} value={filters.wyckoffEventV2} onChange={set('wyckoffEventV2')} />
            <div>
              <label className="block text-xs text-gray-500 mb-1">Wyckoff Phase</label>
              <select value={filters.wyckoffPhaseV2} onChange={(e) => set('wyckoffPhaseV2')(e.target.value)} className={selectCls}>
                <option value="">Any</option>
                {WYCKOFF_PHASES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">FSM Phase (fine)</label>
              <select value={filters.wyckoffFsmPhaseV2} onChange={(e) => set('wyckoffFsmPhaseV2')(e.target.value)} className={selectCls}>
                <option value="">Any</option>
                {WYCKOFF_FSM_PHASES_V2.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <NumInput label="Event ≤ N days ago" placeholder="14" value={filters.maxWyckoffDaysV2} onChange={set('maxWyckoffDaysV2')} />
            <NumInput label="Min Confidence ≥" placeholder="60" value={filters.minWyckoffConfV2} onChange={set('minWyckoffConfV2')} />
          </div>
        )}
      </div>

      {/* Action row: Clear + Save as Strategy (no Apply button) */}
      <div className="flex gap-2 items-center pt-1 border-t border-gray-100">
        {active && (
          <button
            onClick={clearFilters}
            className="px-4 py-1.5 bg-white text-gray-600 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Clear all filters
          </button>
        )}
        {active && (
          <>
            <span className="w-px h-5 bg-gray-200" />
            {savingStrategy ? (
              <div className="flex items-center gap-1.5">
                <input
                  ref={strategyInputRef}
                  type="text"
                  value={strategyName}
                  onChange={(e) => setStrategyName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveStrategy()
                    if (e.key === 'Escape') { setSavingStrategy(false); setStrategyName('') }
                  }}
                  placeholder="Strategy name..."
                  className="px-2 py-1 text-xs border border-blue-300 rounded-lg outline-none focus:ring-1 focus:ring-blue-400 w-36"
                />
                <button
                  onClick={saveStrategy}
                  className="px-2 py-1 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => { setSavingStrategy(false); setStrategyName('') }}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setSavingStrategy(true)}
                className="px-3 py-1.5 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
              >
                Save as Strategy
              </button>
            )}
          </>
        )}
        {!active && (
          <p className="text-xs text-gray-400">Changes apply automatically after 0.5s</p>
        )}
      </div>
    </div>
  )
}
