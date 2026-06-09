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
  { value: 'Financials',                 label: 'Financials' },
  { value: 'Energy',                     label: 'Energy' },
  { value: 'Basic Materials',            label: 'Basic Materials' },
  { value: 'Barang Konsumen Primer',     label: 'Consumer Staples' },
  { value: 'Barang Konsumen Non-Primer', label: 'Consumer Discretionary' },
  { value: 'Industrials',               label: 'Industrials' },
  { value: 'Property & Real Estate',    label: 'Property & Real Estate' },
  { value: 'Technology',                label: 'Technology' },
  { value: 'Infrastructure',            label: 'Infrastructure' },
  { value: 'Transportation & Logistics', label: 'Transportation & Logistics' },
  { value: 'Healthcare',                label: 'Healthcare' },
] as const

const FILTER_KEYS = [
  'minRoe', 'maxPe', 'maxPbv', 'minNetMargin', 'minDivYield',
  'minDivAvg3yr', 'minDivAvg5yr',
  'minRevCagr3yr', 'minRevCagr5yr', 'minPriceCagr3yr', 'minPriceCagr5yr', 'minOcfCagr3yr', 'minOcfCagr5yr',
  'minMktCap', 'maxPhaseDays',
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

// ---------------------------------------------------------------------------
// FilterSection — collapsible accordion section with active-count badge.
// Uses CSS grid-template-rows trick for smooth height animation.
// ---------------------------------------------------------------------------

function FilterSection({
  label,
  activeCount,
  defaultOpen = true,
  children,
}: {
  label: string
  activeCount: number
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div>
      {/* Section header — full-width clickable toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 py-1.5 group"
      >
        {/* Accent bar — blue when open, gray when closed */}
        <div className={`w-0.5 h-3.5 rounded-full shrink-0 transition-colors duration-200 ${open ? 'bg-[var(--color-brand)]' : 'bg-[var(--color-border)]'}`} />

        <span className={`text-[11px] font-semibold uppercase tracking-widest leading-none flex-1 text-left transition-colors duration-200 ${open ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text-muted)]'}`}>
          {label}
        </span>

        {/* Active count badge — always visible so collapsed sections still show state */}
        {activeCount > 0 && (
          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-[var(--color-brand-bg)] text-[var(--color-brand-text)] text-[10px] font-bold rounded-full leading-none">
            {activeCount}
          </span>
        )}

        {/* Chevron */}
        <svg
          className={`w-3.5 h-3.5 text-[var(--color-text-muted)] transition-transform duration-200 shrink-0 ${open ? '' : '-rotate-90'}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Animated collapse via CSS grid-template-rows */}
      <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="space-y-3 pt-3 pb-1">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared input primitives — full-width, single column
// ---------------------------------------------------------------------------

const inputCls = 'w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-card)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand)] focus:border-[var(--color-brand)] transition-colors placeholder:text-[var(--color-text-muted)]'
const selectCls = inputCls

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs text-[var(--color-text-muted)] mb-1 font-medium">{children}</label>
}

function NumInput({ label, placeholder, value, onChange }: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void
}) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type="number"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      />
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
      <Label>{label}</Label>
      <button
        type="button"
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        className={`${inputCls} text-left truncate flex items-center justify-between gap-2`}
      >
        <span className="truncate text-[var(--color-text-primary)]">{display}</span>
        <svg className="w-3 h-3 shrink-0 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-20 w-full bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl shadow-lg p-1 max-h-56 overflow-y-auto">
          {options.map((o) => (
            <label key={o.value} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-[var(--color-bg-inset)] cursor-pointer text-sm text-[var(--color-text-primary)]">
              <input
                type="checkbox"
                checked={selected.has(o.value)}
                onChange={() => toggle(o.value)}
                className="rounded border-[var(--color-border)] text-[var(--color-brand-text)] focus:ring-[var(--color-brand)]"
              />
              {o.label}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

function SelectInput({ label, value, onChange, children }: {
  label: string; value: string; onChange: (v: string) => void; children: React.ReactNode
}) {
  return (
    <div>
      <Label>{label}</Label>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={selectCls}>
        {children}
      </select>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ScreenerFilters — collapsible sections, single-column inputs, 500ms debounce
// ---------------------------------------------------------------------------

export function ScreenerFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [, startTransition] = useTransition()

  const isProgrammaticRef = useRef(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const fromUrl = readFilters(searchParams)
    isProgrammaticRef.current = true
    setFilters(fromUrl)
  }, [searchParams])

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
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters])

  useEffect(() => {
    const handler = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      isProgrammaticRef.current = true
    }
    window.addEventListener('screener-clear', handler)
    return () => window.removeEventListener('screener-clear', handler)
  }, [])

  const [wyckoffVersion, setWyckoffVersion] = useState<'v1' | 'v2'>('v2')
  useEffect(() => {
    if (searchParams.get('wyckoffEvent') || searchParams.get('wyckoffPhase')
        || searchParams.get('maxWyckoffDays') || searchParams.get('minWyckoffConf')) {
      setWyckoffVersion('v1')
    }
  }, [searchParams])

  const [savingStrategy, setSavingStrategy] = useState(false)
  const [strategyName, setStrategyName] = useState('')
  const strategyInputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (savingStrategy) strategyInputRef.current?.focus() }, [savingStrategy])

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
  const active = hasActiveFilters(filters)

  // Per-section active counts (used as badges on collapsed headers)
  const fundamentalCount = (['minRoe', 'maxPe', 'maxPbv', 'minNetMargin', 'minMktCap', 'sector', 'board'] as FilterKey[]).filter(k => filters[k]).length
  const dividendCount = (['minDivYield', 'minDivAvg3yr', 'minDivAvg5yr'] as FilterKey[]).filter(k => filters[k]).length
  const growthCount = (['minRevCagr3yr', 'minRevCagr5yr', 'minPriceCagr3yr', 'minPriceCagr5yr', 'minOcfCagr3yr', 'minOcfCagr5yr'] as FilterKey[]).filter(k => filters[k]).length
  const technicalCount = (['phase', 'maxPhaseDays', 'minRsi', 'maxRsi', 'macdCross', 'maxMacdCrossDays', 'minVolChangePct', 'minVolAvg'] as FilterKey[]).filter(k => filters[k]).length
  const wyckoffCount = (['wyckoffEvent', 'wyckoffPhase', 'maxWyckoffDays', 'minWyckoffConf', 'wyckoffEventV2', 'wyckoffPhaseV2', 'wyckoffFsmPhaseV2', 'maxWyckoffDaysV2', 'minWyckoffConfV2'] as FilterKey[]).filter(k => filters[k]).length

  return (
    <div className="space-y-1">

      {/* ── Fundamentals & Classification ── */}
      <FilterSection label="Fundamentals" activeCount={fundamentalCount}>
        <NumInput label="ROE ≥ (%)" placeholder="15" value={filters.minRoe} onChange={set('minRoe')} />
        <NumInput label="P/E ≤" placeholder="20" value={filters.maxPe} onChange={set('maxPe')} />
        <NumInput label="P/BV ≤" placeholder="3" value={filters.maxPbv} onChange={set('maxPbv')} />
        <NumInput label="Net Margin ≥ (%)" placeholder="10" value={filters.minNetMargin} onChange={set('minNetMargin')} />
        <NumInput label="Market Cap ≥ (T)" placeholder="1" value={filters.minMktCap} onChange={set('minMktCap')} />
        <SelectInput label="Sector" value={filters.sector} onChange={set('sector')}>
          <option value="">All sectors</option>
          {SECTORS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </SelectInput>
        <SelectInput label="Board" value={filters.board} onChange={set('board')}>
          <option value="">Any board</option>
          {BOARDS.map((b) => <option key={b} value={b}>{b}</option>)}
        </SelectInput>
      </FilterSection>

      <div className="h-px bg-[var(--color-bg-inset)]" />

      {/* ── Dividends ── */}
      <FilterSection label="Dividends" activeCount={dividendCount} defaultOpen={false}>
        <NumInput label="Dividend Yield ≥ (%)" placeholder="3" value={filters.minDivYield} onChange={set('minDivYield')} />
        <NumInput label="Avg Yield 3Y ≥ (%)" placeholder="3" value={filters.minDivAvg3yr} onChange={set('minDivAvg3yr')} />
        <NumInput label="Avg Yield 5Y ≥ (%)" placeholder="3" value={filters.minDivAvg5yr} onChange={set('minDivAvg5yr')} />
      </FilterSection>

      <div className="h-px bg-[var(--color-bg-inset)]" />

      {/* ── Growth ── */}
      <FilterSection label="Growth (CAGR)" activeCount={growthCount} defaultOpen={false}>
        <NumInput label="Revenue CAGR 3Y ≥ (%)" placeholder="10" value={filters.minRevCagr3yr} onChange={set('minRevCagr3yr')} />
        <NumInput label="Revenue CAGR 5Y ≥ (%)" placeholder="10" value={filters.minRevCagr5yr} onChange={set('minRevCagr5yr')} />
        <NumInput label="Price CAGR 3Y ≥ (%)" placeholder="5" value={filters.minPriceCagr3yr} onChange={set('minPriceCagr3yr')} />
        <NumInput label="Price CAGR 5Y ≥ (%)" placeholder="5" value={filters.minPriceCagr5yr} onChange={set('minPriceCagr5yr')} />
        <NumInput label="Op. Cash Flow CAGR 3Y ≥ (%)" placeholder="10" value={filters.minOcfCagr3yr} onChange={set('minOcfCagr3yr')} />
        <NumInput label="Op. Cash Flow CAGR 5Y ≥ (%)" placeholder="10" value={filters.minOcfCagr5yr} onChange={set('minOcfCagr5yr')} />
      </FilterSection>

      <div className="h-px bg-[var(--color-bg-inset)]" />

      {/* ── Technical Signals ── */}
      <FilterSection label="Technical Signals" activeCount={technicalCount} defaultOpen={false}>
        <MultiSelect label="Market Phase" options={PHASES} value={filters.phase} onChange={set('phase')} />
        <NumInput label="Phase Duration ≤ (days)" placeholder="20" value={filters.maxPhaseDays} onChange={set('maxPhaseDays')} />
        <NumInput label="RSI ≥" placeholder="30" value={filters.minRsi} onChange={set('minRsi')} />
        <NumInput label="RSI ≤" placeholder="70" value={filters.maxRsi} onChange={set('maxRsi')} />
        <SelectInput label="MACD Cross" value={filters.macdCross} onChange={set('macdCross')}>
          <option value="">Any</option>
          {MACD_CROSS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </SelectInput>
        <NumInput label="Cross Within ≤ (days)" placeholder="5" value={filters.maxMacdCrossDays} onChange={set('maxMacdCrossDays')} />
        <NumInput label="Volume vs Avg ≥ (%)" placeholder="150" value={filters.minVolChangePct} onChange={set('minVolChangePct')} />
        <NumInput label="Avg Volume ≥ (Jt)" placeholder="1" value={filters.minVolAvg} onChange={set('minVolAvg')} />
      </FilterSection>

      <div className="h-px bg-[var(--color-bg-inset)]" />

      {/* ── Wyckoff Signals ── */}
      <FilterSection label="Wyckoff Signals" activeCount={wyckoffCount} defaultOpen={false}>
        {/* Detector toggle */}
        <div>
          <Label>Detector version</Label>
          <div className="flex gap-0.5 p-0.5 bg-[var(--color-bg-inset)] rounded-lg">
            {(['v1', 'v2'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setWyckoffVersion(v)}
                title={v === 'v1' ? 'Flat-pass detector' : 'FSM detector (recommended)'}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  wyckoffVersion === v
                    ? 'bg-[var(--color-bg-card)] text-[var(--color-brand-text)] shadow-sm'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                {v === 'v1' ? 'Classic (v1)' : 'FSM (v2)'}
              </button>
            ))}
          </div>
        </div>

        {wyckoffVersion === 'v1' ? (
          <>
            <MultiSelect label="Wyckoff Event" options={WYCKOFF_EVENTS_V1} value={filters.wyckoffEvent} onChange={set('wyckoffEvent')} />
            <SelectInput label="Wyckoff Phase" value={filters.wyckoffPhase} onChange={set('wyckoffPhase')}>
              <option value="">Any phase</option>
              {WYCKOFF_PHASES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </SelectInput>
            <NumInput label="Event Within ≤ (days)" placeholder="14" value={filters.maxWyckoffDays} onChange={set('maxWyckoffDays')} />
            <NumInput label="Min Confidence ≥" placeholder="70" value={filters.minWyckoffConf} onChange={set('minWyckoffConf')} />
          </>
        ) : (
          <>
            <MultiSelect label="Wyckoff Event" options={WYCKOFF_EVENTS_V2} value={filters.wyckoffEventV2} onChange={set('wyckoffEventV2')} />
            <SelectInput label="Wyckoff Phase" value={filters.wyckoffPhaseV2} onChange={set('wyckoffPhaseV2')}>
              <option value="">Any phase</option>
              {WYCKOFF_PHASES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </SelectInput>
            <SelectInput label="FSM Phase (fine)" value={filters.wyckoffFsmPhaseV2} onChange={set('wyckoffFsmPhaseV2')}>
              <option value="">Any FSM phase</option>
              {WYCKOFF_FSM_PHASES_V2.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </SelectInput>
            <NumInput label="Event Within ≤ (days)" placeholder="14" value={filters.maxWyckoffDaysV2} onChange={set('maxWyckoffDaysV2')} />
            <NumInput label="Min Confidence ≥" placeholder="60" value={filters.minWyckoffConfV2} onChange={set('minWyckoffConfV2')} />
          </>
        )}
      </FilterSection>

      {/* ── Footer: Save as Strategy ── */}
      <div className="pt-4">
        {active ? (
          savingStrategy ? (
            <div className="space-y-2">
              <input
                ref={strategyInputRef}
                type="text"
                aria-label="Strategy name"
                value={strategyName}
                onChange={(e) => setStrategyName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveStrategy()
                  if (e.key === 'Escape') { setSavingStrategy(false); setStrategyName('') }
                }}
                placeholder="Strategy name..."
                className="w-full px-3 py-2 text-sm border border-[var(--color-brand)] rounded-lg outline-none focus:ring-1 focus:ring-[var(--color-brand)]"
              />
              <div className="flex gap-2">
                <button onClick={saveStrategy} className="flex-1 py-1.5 text-xs font-medium text-[var(--color-bg-page)] bg-[var(--color-brand)] hover:bg-[var(--color-brand)] rounded-lg transition-colors">
                  Save
                </button>
                <button onClick={() => { setSavingStrategy(false); setStrategyName('') }} className="px-3 py-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setSavingStrategy(true)}
              className="w-full py-2 text-sm font-medium text-[var(--color-brand-text)] border border-[var(--color-brand-bg)] rounded-lg hover:bg-[var(--color-brand-bg)] transition-colors"
            >
              Save as Strategy
            </button>
          )
        ) : (
          <p className="text-xs text-[var(--color-text-muted)] text-center py-1">Changes apply automatically · 0.5s</p>
        )}
      </div>
    </div>
  )
}
