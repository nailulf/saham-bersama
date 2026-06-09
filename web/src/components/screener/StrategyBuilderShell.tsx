'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { Strategy } from '@/lib/types/database'

// ─── Filter key constants (mirrors applyScreenerFilters) ─────────────────────

const FILTER_KEYS = [
  'minRoe', 'maxPe', 'maxPbv', 'minNetMargin', 'minDivYield',
  'minDivAvg3yr', 'minDivAvg5yr',
  'minRevCagr3yr', 'minRevCagr5yr', 'minPriceCagr3yr', 'minPriceCagr5yr', 'minOcfCagr3yr', 'minOcfCagr5yr',
  'minMktCap', 'maxMktCap', 'maxPhaseDays',
  'sector', 'board', 'phase',
  'minRsi', 'maxRsi', 'macdCross', 'maxMacdCrossDays', 'minVolChangePct', 'maxVolChangePct', 'minVolAvg',
  'wyckoffEvent', 'wyckoffPhase', 'maxWyckoffDays', 'minWyckoffConf',
  'wyckoffEventV2', 'wyckoffPhaseV2', 'wyckoffFsmPhaseV2', 'maxWyckoffDaysV2', 'minWyckoffConfV2',
] as const
type FilterKey = typeof FILTER_KEYS[number]
type FilterState = Record<FilterKey, string>
const EMPTY: FilterState = Object.fromEntries(FILTER_KEYS.map((k) => [k, ''])) as FilterState

// Sector values as stored in DB
const SECTOR_CHIPS = [
  { label: 'Perbankan',  value: 'Financials' },
  { label: 'Energi',     value: 'Energy' },
  { label: 'Teknologi',  value: 'Technology' },
  { label: 'Properti',   value: 'Property & Real Estate' },
  { label: 'Konsumer',   value: 'Barang Konsumen Primer' },
  { label: 'Telko',      value: 'Infrastructure' },
  { label: 'Industri',   value: 'Industrials' },
  { label: 'Kesehatan',  value: 'Healthcare' },
] as const

const WYCKOFF_PHASE_CHIPS = [
  { label: 'Accumulation', value: 'accumulation', color: 'var(--color-warning-text)' },
  { label: 'Markup',       value: 'markup',       color: 'var(--color-brand)' },
  { label: 'Distribution', value: 'distribution', color: 'var(--color-negative)' },
  { label: 'Markdown',     value: 'markdown',     color: 'var(--color-negative)' },
] as const

const MACD_CHIPS = [
  { label: 'Semua',             value: '' },
  { label: 'Bullish Crossover', value: 'golden_cross' },
  { label: 'Bearish Crossover', value: 'death_cross' },
] as const

// Market cap range chip → sets minMktCap + maxMktCap
type MktCapChip = 'all' | 'lt1' | '1to10' | '10to100' | 'gt100'
function getMktCapChip(min: string, max: string): MktCapChip {
  if (!min && !max) return 'all'
  if (!min && max === '1') return 'lt1'
  if (min === '1' && max === '10') return '1to10'
  if (min === '10' && max === '100') return '10to100'
  if (min === '100' && !max) return 'gt100'
  return 'all'
}
const MKT_CAP_CHIPS: { label: string; id: MktCapChip; min: string; max: string }[] = [
  { label: 'Semua',    id: 'all',     min: '',    max: '' },
  { label: '< 1T',     id: 'lt1',     min: '',    max: '1' },
  { label: '1T–10T',   id: '1to10',   min: '1',   max: '10' },
  { label: '10T–100T', id: '10to100', min: '10',  max: '100' },
  { label: '> 100T',   id: 'gt100',   min: '100', max: '' },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({
  title,
  open,
  onToggle,
}: { title: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between py-0.5"
    >
      <span
        className="font-display font-semibold"
        style={{ fontSize: 14, color: 'var(--color-text-primary)' }}
      >
        {title}
      </span>
      <svg
        width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        style={{
          color: 'var(--color-text-dim)',
          transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
          transition: 'transform 200ms',
          flexShrink: 0,
        }}
      >
        <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

function ChipButton({
  label, active, color, onClick,
}: { label: string; active: boolean; color?: string; onClick: () => void }) {
  const activeFg = color ?? 'var(--color-brand)'
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2.5 py-1.5 rounded-md flex-shrink-0 font-mono transition-colors"
      style={{
        fontSize: 10,
        fontWeight: active ? 600 : 400,
        background: active ? `${activeFg}15` : 'var(--color-bg-inset)',
        color: active ? activeFg : 'var(--color-text-muted)',
        border: `1px solid ${active ? `${activeFg}40` : 'var(--color-border)'}`,
      }}
    >
      {label}
    </button>
  )
}

function RangeRow({
  label, minKey, maxKey, minPlaceholder, maxPlaceholder, filters, set,
}: {
  label: string
  minKey: FilterKey
  maxKey: FilterKey
  minPlaceholder: string
  maxPlaceholder: string
  filters: FilterState
  set: (k: FilterKey) => (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono" style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)' }}>
        {label}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          aria-label={`${label} minimum`}
          placeholder={minPlaceholder}
          value={filters[minKey]}
          onChange={(e) => set(minKey)(e.target.value)}
          className="flex-1 rounded-lg px-3 py-2 font-mono text-[12px] outline-none transition-colors"
          style={{
            background: 'var(--color-bg-inset)',
            border: `1px solid ${filters[minKey] ? 'var(--color-brand)' : 'var(--color-border)'}`,
            color: 'var(--color-text-primary)',
          }}
        />
        <span className="font-mono" style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>—</span>
        <input
          type="number"
          aria-label={`${label} maximum`}
          placeholder={maxPlaceholder}
          value={filters[maxKey]}
          onChange={(e) => set(maxKey)(e.target.value)}
          className="flex-1 rounded-lg px-3 py-2 font-mono text-[12px] outline-none transition-colors"
          style={{
            background: 'var(--color-bg-inset)',
            border: `1px solid ${filters[maxKey] ? 'var(--color-brand)' : 'var(--color-border)'}`,
            color: 'var(--color-text-primary)',
          }}
        />
      </div>
      {/* Range track (visual only) */}
      <div className="w-full h-[3px] rounded-full" style={{ background: 'var(--color-border-subtle)' }}>
        {(filters[minKey] || filters[maxKey]) && (
          <div className="h-full w-1/2 rounded-full" style={{ background: 'var(--color-brand)' }} />
        )}
      </div>
    </div>
  )
}

function MinRow({
  label, filterKey, placeholder, unit, filters, set,
}: {
  label: string
  filterKey: FilterKey
  placeholder: string
  unit?: string
  filters: FilterState
  set: (k: FilterKey) => (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono" style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)' }}>
        {label}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          aria-label={label}
          placeholder={placeholder}
          value={filters[filterKey]}
          onChange={(e) => set(filterKey)(e.target.value)}
          className="flex-1 rounded-lg px-3 py-2 font-mono text-[12px] outline-none transition-colors"
          style={{
            background: 'var(--color-bg-inset)',
            border: `1px solid ${filters[filterKey] ? 'var(--color-brand)' : 'var(--color-border)'}`,
            color: 'var(--color-text-primary)',
          }}
        />
        {unit && (
          <span className="font-mono flex-shrink-0" style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  )
}

function Section({
  title, open, onToggle, children,
}: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div
      className="flex flex-col gap-4 px-5 py-4"
      style={{
        background: 'var(--color-bg-card)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <SectionHeader title={title} open={open} onToggle={onToggle} />
      {open && <div className="flex flex-col gap-4">{children}</div>}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface StrategyBuilderShellProps {
  initialStrategy?: Strategy
}

export function StrategyBuilderShell({ initialStrategy }: StrategyBuilderShellProps) {
  const router = useRouter()

  const [filters, setFilters] = useState<FilterState>(() => {
    if (!initialStrategy?.filters) return EMPTY
    const f = { ...EMPTY }
    for (const key of FILTER_KEYS) {
      const v = (initialStrategy.filters as Record<string, unknown>)[key]
      if (v != null) f[key] = String(v)
    }
    return f
  })

  const [strategyName, setStrategyName] = useState(initialStrategy?.name ?? '')
  const [saving, setSaving] = useState(false)
  const [matchCount, setMatchCount] = useState<number | null>(null)
  const [openSections, setOpenSections] = useState(
    new Set(['kelas', 'fundamental', 'pertumbuhan', 'dividen', 'teknikal'])
  )

  const set = (key: FilterKey) => (v: string) =>
    setFilters((f) => ({ ...f, [key]: v }))

  function toggleSection(id: string) {
    setOpenSections((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Active filter count for header badge
  const activeCount = FILTER_KEYS.filter((k) => filters[k]).length

  // Live match count — debounced fetch to /api/strategies/count
  const countTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (countTimerRef.current) clearTimeout(countTimerRef.current)
    countTimerRef.current = setTimeout(async () => {
      const params = new URLSearchParams()
      for (const key of FILTER_KEYS) {
        if (filters[key]) params.set(key, filters[key])
      }
      try {
        const res = await fetch(`/api/strategies/count?${params.toString()}`)
        if (res.ok) {
          const data = await res.json() as { count: number }
          setMatchCount(data.count)
        }
      } catch { /* silent */ }
    }, 600)
    return () => { if (countTimerRef.current) clearTimeout(countTimerRef.current) }
  }, [filters])

  function handleClear() {
    setFilters(EMPTY)
    setMatchCount(null)
  }

  const saveStrategy = useCallback(async () => {
    const name = strategyName.trim()
    if (!name) return
    setSaving(true)
    const filterObj: Record<string, string> = {}
    for (const key of FILTER_KEYS) {
      if (filters[key]) filterObj[key] = filters[key]
    }
    try {
      const isEdit = !!initialStrategy?.id
      const url = isEdit ? `/api/strategies/${initialStrategy!.id}` : '/api/strategies'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, filters: filterObj }),
      })
      if (res.ok) {
        const saved = await res.json() as { id: string }
        const id = isEdit ? initialStrategy!.id : saved.id
        window.dispatchEvent(new Event('strategy-change'))
        // Redirect to screener with strategy active
        const params = new URLSearchParams({ strategy: id, ...filterObj })
        router.push(`/screener?${params.toString()}`)
      }
    } catch { /* silent */ } finally {
      setSaving(false)
    }
  }, [strategyName, filters, initialStrategy, router])

  // ── Market cap chip helpers
  const mktCapChip = getMktCapChip(filters.minMktCap, filters.maxMktCap)
  function setMktCapChip(chip: typeof MKT_CAP_CHIPS[number]) {
    setFilters((f) => ({ ...f, minMktCap: chip.min, maxMktCap: chip.max }))
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'var(--color-bg-page)' }}>

      {/* Header */}
      <div
        className="flex items-center justify-between px-5 h-[56px] flex-shrink-0"
        style={{
          background: 'var(--color-bg-card)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            style={{ color: 'var(--color-text-dim)' }}
            aria-label="Close"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
          <span
            className="font-display font-bold"
            style={{ fontSize: 18, color: 'var(--color-text-primary)' }}
          >
            Buat Strategy
          </span>
        </div>

        <div className="flex items-center gap-3">
          {activeCount > 0 && (
            <button
              onClick={handleClear}
              className="font-mono"
              style={{ fontSize: 13, color: 'var(--color-text-dim)' }}
            >
              Bersihkan
            </button>
          )}
          {activeCount > 0 && (
            <div
              className="flex items-center justify-center rounded-full font-mono font-bold"
              style={{
                width: 20,
                height: 20,
                fontSize: 10,
                background: 'var(--color-brand-bg)',
                color: 'var(--color-brand)',
                border: '1px solid var(--color-brand)',
              }}
            >
              {activeCount}
            </div>
          )}
        </div>
      </div>

      {/* Strategy name input */}
      <div
        className="flex flex-col gap-1.5 px-5 py-3.5"
        style={{
          background: 'var(--color-bg-card)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <span className="section-label">NAMA STRATEGY</span>
        <div
          className="flex items-center gap-2.5 rounded-lg px-3.5 py-2.5"
          style={{
            background: 'var(--color-bg-inset)',
            border: '1px solid var(--color-border)',
          }}
        >
          <input
            type="text"
            aria-label="Nama strategi"
            placeholder="Contoh: Hyper Growth Q2 2026"
            value={strategyName}
            onChange={(e) => setStrategyName(e.target.value)}
            className="flex-1 bg-transparent font-mono text-[13px] outline-none placeholder:opacity-40"
            style={{
              color: 'var(--color-text-primary)',
              fontWeight: 500,
            }}
          />
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ color: 'var(--color-text-dim)', flexShrink: 0 }}>
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" strokeLinecap="round" />
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* Filter sections — scrollable body */}
      <div className="flex-1 overflow-y-auto">

        {/* 1. Kelas Saham */}
        <Section
          title="Kelas Saham"
          open={openSections.has('kelas')}
          onToggle={() => toggleSection('kelas')}
        >
          <div className="flex flex-col gap-2">
            <span className="font-mono" style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)' }}>
              Kapitalisasi Pasar
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {MKT_CAP_CHIPS.map((chip) => (
                <ChipButton
                  key={chip.id}
                  label={chip.label}
                  active={mktCapChip === chip.id}
                  onClick={() => setMktCapChip(chip)}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="font-mono" style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)' }}>
              Sektor
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {SECTOR_CHIPS.map((s) => (
                <ChipButton
                  key={s.value}
                  label={s.label}
                  active={filters.sector === s.value}
                  onClick={() => set('sector')(filters.sector === s.value ? '' : s.value)}
                />
              ))}
            </div>
          </div>
        </Section>

        {/* 2. Fundamental */}
        <Section
          title="Fundamental"
          open={openSections.has('fundamental')}
          onToggle={() => toggleSection('fundamental')}
        >
          <MinRow label="ROE (Return on Equity) ≥" filterKey="minRoe"    placeholder="15"  unit="%" filters={filters} set={set} />
          <MinRow label="PBV (Price to Book Value) ≤" filterKey="maxPbv" placeholder="3"   filters={filters} set={set} />
          <MinRow label="P/E (Price to Earnings) ≤"   filterKey="maxPe"  placeholder="25"  filters={filters} set={set} />
          <MinRow label="Net Margin ≥"                 filterKey="minNetMargin" placeholder="10" unit="%" filters={filters} set={set} />
        </Section>

        {/* 3. Pertumbuhan (CAGR) */}
        <Section
          title="Pertumbuhan (CAGR)"
          open={openSections.has('pertumbuhan')}
          onToggle={() => toggleSection('pertumbuhan')}
        >
          <RangeRow
            label="Revenue CAGR (3 Tahun)"
            minKey="minRevCagr3yr" maxKey="minRevCagr5yr"
            minPlaceholder="10%" maxPlaceholder="max %"
            filters={filters} set={set}
          />
          <MinRow label="Revenue CAGR 5Y ≥"       filterKey="minRevCagr5yr"  placeholder="10" unit="%" filters={filters} set={set} />
          <MinRow label="OCF CAGR 3Y ≥"           filterKey="minOcfCagr3yr"  placeholder="10" unit="%" filters={filters} set={set} />
          <MinRow label="OCF CAGR 5Y ≥"           filterKey="minOcfCagr5yr"  placeholder="10" unit="%" filters={filters} set={set} />
        </Section>

        {/* 4. Dividen */}
        <Section
          title="Dividen"
          open={openSections.has('dividen')}
          onToggle={() => toggleSection('dividen')}
        >
          <MinRow label="Dividend Yield ≥"        filterKey="minDivYield"  placeholder="3" unit="%" filters={filters} set={set} />
          <MinRow label="Rata-rata Yield 3 Tahun ≥" filterKey="minDivAvg3yr" placeholder="3" unit="%" filters={filters} set={set} />
          <MinRow label="Rata-rata Yield 5 Tahun ≥" filterKey="minDivAvg5yr" placeholder="3" unit="%" filters={filters} set={set} />
        </Section>

        {/* 5. Teknikal */}
        <Section
          title="Teknikal"
          open={openSections.has('teknikal')}
          onToggle={() => toggleSection('teknikal')}
        >
          <RangeRow
            label="RSI (Relative Strength Index)"
            minKey="minRsi" maxKey="maxRsi"
            minPlaceholder="30" maxPlaceholder="70"
            filters={filters} set={set}
          />

          <div className="flex flex-col gap-2">
            <span className="font-mono" style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)' }}>
              MACD Sinyal
            </span>
            <div className="flex items-center gap-2">
              {MACD_CHIPS.map((c) => (
                <ChipButton
                  key={c.value}
                  label={c.label}
                  active={filters.macdCross === c.value}
                  onClick={() => set('macdCross')(c.value)}
                />
              ))}
            </div>
          </div>

          <MinRow
            label="Volume Change (vs rata-rata 20H) ≥"
            filterKey="minVolChangePct"
            placeholder="150"
            unit="%"
            filters={filters} set={set}
          />

          <div className="flex flex-col gap-2">
            <span className="font-mono" style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)' }}>
              Fase Wyckoff
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {WYCKOFF_PHASE_CHIPS.map((p) => (
                <ChipButton
                  key={p.value}
                  label={p.label}
                  active={filters.wyckoffPhaseV2 === p.value}
                  color={p.color}
                  onClick={() => set('wyckoffPhaseV2')(
                    filters.wyckoffPhaseV2 === p.value ? '' : p.value
                  )}
                />
              ))}
            </div>
          </div>
        </Section>

        {/* bottom padding so footer doesn't cover last section */}
        <div className="h-4" />
      </div>

      {/* Apply footer — sticky */}
      <div
        className="flex-shrink-0 flex flex-col gap-3 px-5 py-4"
        style={{
          background: 'var(--color-bg-card)',
          borderTop: '1px solid var(--color-border)',
        }}
      >
        <div className="flex flex-col gap-0.5">
          <span className="font-mono" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            {activeCount} kondisi terpilih
          </span>
          {matchCount != null && (
            <span
              className="font-mono font-bold"
              style={{ fontSize: 13, color: 'var(--color-brand)' }}
            >
              ~{matchCount} saham cocok saat ini
            </span>
          )}
          <span className="font-mono" style={{ fontSize: 10, color: 'var(--color-text-ghost)' }}>
            ↻ diperbarui otomatis setiap hari
          </span>
        </div>

        <button
          onClick={saveStrategy}
          disabled={saving || !strategyName.trim()}
          className="flex items-center justify-center gap-2 w-full rounded-xl py-3.5 font-mono font-bold transition-opacity"
          style={{
            fontSize: 14,
            background: 'var(--color-brand)',
            color: '#0C0C0C',
            opacity: saving || !strategyName.trim() ? 0.5 : 1,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M9 11l3 3L22 4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" strokeLinecap="round" />
          </svg>
          {saving ? 'Menyimpan…' : 'Buat Strategy'}
        </button>
      </div>
    </div>
  )
}
