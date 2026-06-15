# Screener Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse three screener surfaces into a single `/screener` page with an inline filter panel (all non-Wyckoff filters exposed), server-rendered results, and full strategy CRUD — then delete the dead home screener and the separate `/screener/strategy` builder route.

**Architecture:** `/screener` stays a Server Component that fetches rows from URL params (SSR preserved). A new client `ScreenerShell` composes a `FilterPanel` (desktop left sidebar / mobile bottom-sheet) beside the existing results column. The panel holds local filter state seeded from the URL, previews a live match-count via the existing `/api/strategies/count`, and an "Terapkan" button commits filters to the URL (router.push) to re-render results. Strategy save/edit (POST/PATCH `/api/strategies`) moves into the panel. Filter primitives are extracted from the to-be-deleted `StrategyBuilderShell` into a shared `components/screener/filters/` module.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind + Terminal Dashboard CSS-var tokens. No web test runner exists — verification is `npx tsc --noEmit` + `npm run lint` + the `design-system-review` skill + manual checks.

**Backend:** No changes. `applyScreenerFilters`/`getScreenerRows` (`web/src/lib/queries/stocks.ts`) and `/api/strategies/count` already honor every filter key; `app/screener/page.tsx` already parses them all from the URL.

**Verification convention (used in every task):** all commands run from the `web/` directory.
- Type-check: `cd web && npx tsc --noEmit`
- Lint: `cd web && npm run lint`

---

## File Structure

**Create:**
- `web/src/components/screener/filters/types.ts` — filter keys, `FilterState`, `EMPTY_FILTERS`, chip/option constants, mkt-cap helpers.
- `web/src/components/screener/filters/primitives.tsx` — `SectionHeader`, `Section`, `ChipButton`, `RangeRow`, `MinRow`, `MultiChipRow`.
- `web/src/components/screener/filters/FilterPanel.tsx` — full filter panel: all 5 sections (incl. newly exposed filters), strategy name/desc, live count, Apply + Save + Clear.
- `web/src/components/screener/ScreenerShell.tsx` — client wrapper: desktop sidebar / mobile sheet + results column.

**Modify:**
- `web/src/app/screener/page.tsx` — parse `edit` flag + initial filters, render `ScreenerShell`.
- `web/src/components/screener/ScreenerListShell.tsx` — results-only column; replace the `/screener/strategy` filter Link with an `onOpenFilters` button (mobile only).
- `web/src/components/strategies/StrategyListPage.tsx` — create links → `/screener?edit=1`.
- `web/src/components/strategies/StrategyCard.tsx` — `handleEdit` → `/screener?strategy=<id>&edit=1&<filters>`.
- `web/src/components/nav/bottom-tab-bar.tsx` — drop the `/screener/strategy` mention in the active-tab comment.

**Delete:**
- `web/src/app/screener/strategy/` (whole route dir)
- `web/src/components/screener/StrategyBuilderShell.tsx`
- `web/src/components/home/screener-filters.tsx`
- `web/src/components/home/screener-shell.tsx`

> ⚠️ Do **not** modify `web/src/app/page.tsx` — its `ScreenerFilters` import is the *type* from `@/lib/queries/stocks` (still used), not the dead component.

---

## Task 1: Extract filter types & constants

**Files:**
- Create: `web/src/components/screener/filters/types.ts`

- [ ] **Step 1: Create the types/constants module**

```ts
// web/src/components/screener/filters/types.ts
// Shared filter keys, state shape, and option constants for the screener
// filter panel. Mirrors the keys honored by applyScreenerFilters() and the
// /api/strategies/count + /screener URL params.

export const FILTER_KEYS = [
  'minRoe', 'maxPe', 'maxPbv', 'minNetMargin', 'minDivYield',
  'minDivAvg3yr', 'minDivAvg5yr',
  'minRevCagr3yr', 'minRevCagr5yr', 'minPriceCagr3yr', 'minPriceCagr5yr', 'minOcfCagr3yr', 'minOcfCagr5yr',
  'minMktCap', 'maxMktCap', 'maxPhaseDays',
  'sector', 'board', 'phase',
  'minRsi', 'maxRsi', 'macdCross', 'maxMacdCrossDays', 'minVolChangePct', 'maxVolChangePct', 'minVolAvg',
  'wyckoffEvent', 'wyckoffPhase', 'maxWyckoffDays', 'minWyckoffConf',
  'wyckoffEventV2', 'wyckoffPhaseV2', 'wyckoffFsmPhaseV2', 'maxWyckoffDaysV2', 'minWyckoffConfV2',
] as const

export type FilterKey = typeof FILTER_KEYS[number]
export type FilterState = Record<FilterKey, string>
export const EMPTY_FILTERS: FilterState =
  Object.fromEntries(FILTER_KEYS.map((k) => [k, ''])) as FilterState

/** Seed a FilterState from a record (URL params or saved strategy.filters). */
export function filtersFromRecord(src: Record<string, unknown> | null | undefined): FilterState {
  const f = { ...EMPTY_FILTERS }
  if (!src) return f
  for (const key of FILTER_KEYS) {
    const v = src[key]
    if (v != null && v !== '') f[key] = String(v)
  }
  return f
}

// Sector values as stored in DB (label = Indonesian, value = DB string)
export const SECTOR_CHIPS = [
  { label: 'Perbankan',  value: 'Financials' },
  { label: 'Energi',     value: 'Energy' },
  { label: 'Teknologi',  value: 'Technology' },
  { label: 'Properti',   value: 'Property & Real Estate' },
  { label: 'Konsumer',   value: 'Barang Konsumen Primer' },
  { label: 'Telko',      value: 'Infrastructure' },
  { label: 'Industri',   value: 'Industrials' },
  { label: 'Kesehatan',  value: 'Healthcare' },
] as const

// Board values as stored in DB
export const BOARD_CHIPS = [
  { label: 'Utama',        value: 'Main' },
  { label: 'Pengembangan', value: 'Development' },
  { label: 'Akselerasi',   value: 'Acceleration' },
] as const

// Market phase (current_phase). Multi-select → comma-joined string.
export const PHASE_CHIPS = [
  { label: 'Uptrend',    value: 'uptrend',          color: 'var(--color-brand)' },
  { label: 'Downtrend',  value: 'downtrend',        color: 'var(--color-negative)' },
  { label: 'Sideways ↑', value: 'sideways_bullish', color: 'var(--color-warning-text)' },
  { label: 'Sideways ↓', value: 'sideways_bearish', color: 'var(--color-text-muted)' },
] as const

export const WYCKOFF_PHASE_CHIPS = [
  { label: 'Accumulation', value: 'accumulation', color: 'var(--color-warning-text)' },
  { label: 'Markup',       value: 'markup',       color: 'var(--color-brand)' },
  { label: 'Distribution', value: 'distribution', color: 'var(--color-negative)' },
  { label: 'Markdown',     value: 'markdown',     color: 'var(--color-negative)' },
] as const

export const MACD_CHIPS = [
  { label: 'Semua',             value: '' },
  { label: 'Bullish Crossover', value: 'golden_cross' },
  { label: 'Bearish Crossover', value: 'death_cross' },
] as const

// Market cap range chip → sets minMktCap + maxMktCap (values in trillions IDR)
export type MktCapChip = 'all' | 'lt1' | '1to10' | '10to100' | 'gt100'
export function getMktCapChip(min: string, max: string): MktCapChip {
  if (!min && !max) return 'all'
  if (!min && max === '1') return 'lt1'
  if (min === '1' && max === '10') return '1to10'
  if (min === '10' && max === '100') return '10to100'
  if (min === '100' && !max) return 'gt100'
  return 'all'
}
export const MKT_CAP_CHIPS: { label: string; id: MktCapChip; min: string; max: string }[] = [
  { label: 'Semua',    id: 'all',     min: '',    max: '' },
  { label: '< 1T',     id: 'lt1',     min: '',    max: '1' },
  { label: '1T–10T',   id: '1to10',   min: '1',   max: '10' },
  { label: '10T–100T', id: '10to100', min: '10',  max: '100' },
  { label: '> 100T',   id: 'gt100',   min: '100', max: '' },
]
```

- [ ] **Step 2: Type-check & lint**

Run: `cd web && npx tsc --noEmit && npm run lint`
Expected: PASS (no errors). The module is not yet imported anywhere, so this only verifies it compiles.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/screener/filters/types.ts
git commit -m "feat(screener): add shared filter types & option constants"
```

---

## Task 2: Extract filter UI primitives

**Files:**
- Create: `web/src/components/screener/filters/primitives.tsx`

These are lifted verbatim from the current `StrategyBuilderShell.tsx` (which Task 7 deletes), plus a new `MultiChipRow` for the comma-joined market-phase multiselect. Tokens/sizes are unchanged so the design system stays identical.

- [ ] **Step 1: Create the primitives module**

```tsx
// web/src/components/screener/filters/primitives.tsx
'use client'

import type { FilterKey, FilterState } from './types'

export function SectionHeader({
  title, open, onToggle,
}: { title: string; open: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} className="w-full flex items-center justify-between py-0.5">
      <span className="font-display font-semibold" style={{ fontSize: 14, color: 'var(--color-text-primary)' }}>
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

export function Section({
  title, open, onToggle, children,
}: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div
      className="flex flex-col gap-4 px-5 py-4"
      style={{ background: 'var(--color-bg-card)', borderBottom: '1px solid var(--color-border)' }}
    >
      <SectionHeader title={title} open={open} onToggle={onToggle} />
      {open && <div className="flex flex-col gap-4">{children}</div>}
    </div>
  )
}

export function ChipButton({
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

const inputBase = 'flex-1 rounded-lg px-3 py-2 font-mono text-[12px] outline-none transition-colors'
function inputStyle(hasValue: boolean): React.CSSProperties {
  return {
    background: 'var(--color-bg-inset)',
    border: `1px solid ${hasValue ? 'var(--color-brand)' : 'var(--color-border)'}`,
    color: 'var(--color-text-primary)',
  }
}

export function RangeRow({
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
          type="number" aria-label={`${label} minimum`} placeholder={minPlaceholder}
          value={filters[minKey]} onChange={(e) => set(minKey)(e.target.value)}
          className={inputBase} style={inputStyle(!!filters[minKey])}
        />
        <span className="font-mono" style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>—</span>
        <input
          type="number" aria-label={`${label} maximum`} placeholder={maxPlaceholder}
          value={filters[maxKey]} onChange={(e) => set(maxKey)(e.target.value)}
          className={inputBase} style={inputStyle(!!filters[maxKey])}
        />
      </div>
      <div className="w-full h-[3px] rounded-full" style={{ background: 'var(--color-border-subtle)' }}>
        {(filters[minKey] || filters[maxKey]) && (
          <div className="h-full w-1/2 rounded-full" style={{ background: 'var(--color-brand)' }} />
        )}
      </div>
    </div>
  )
}

export function MinRow({
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
          type="number" aria-label={label} placeholder={placeholder}
          value={filters[filterKey]} onChange={(e) => set(filterKey)(e.target.value)}
          className={inputBase} style={inputStyle(!!filters[filterKey])}
        />
        {unit && (
          <span className="font-mono flex-shrink-0" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Multi-select chip row backed by a single comma-joined string filter value
 * (e.g. phase = "uptrend,downtrend"). Toggling a chip adds/removes its value.
 */
export function MultiChipRow({
  label, options, filterKey, filters, set,
}: {
  label: string
  options: readonly { label: string; value: string; color?: string }[]
  filterKey: FilterKey
  filters: FilterState
  set: (k: FilterKey) => (v: string) => void
}) {
  const selected = filters[filterKey] ? filters[filterKey].split(',').filter(Boolean) : []
  function toggle(value: string) {
    const next = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value]
    set(filterKey)(next.join(','))
  }
  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono" style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)' }}>
        {label}
      </span>
      <div className="flex items-center gap-2 flex-wrap">
        {options.map((o) => (
          <ChipButton
            key={o.value}
            label={o.label}
            active={selected.includes(o.value)}
            color={o.color}
            onClick={() => toggle(o.value)}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check & lint**

Run: `cd web && npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/screener/filters/primitives.tsx
git commit -m "feat(screener): extract reusable filter UI primitives"
```

---

## Task 3: Build the full FilterPanel

**Files:**
- Create: `web/src/components/screener/filters/FilterPanel.tsx`

This is the consolidated panel. It owns local filter state, debounced live count, Apply (commit to URL), and strategy Save (POST/PATCH). It renders as a `flex flex-col h-full` so it fills either the desktop sidebar (`h-screen`) or the mobile sheet.

- [ ] **Step 1: Create FilterPanel**

```tsx
// web/src/components/screener/filters/FilterPanel.tsx
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Strategy } from '@/lib/types/database'
import {
  FILTER_KEYS, type FilterKey, type FilterState, EMPTY_FILTERS, filtersFromRecord,
  SECTOR_CHIPS, BOARD_CHIPS, PHASE_CHIPS, WYCKOFF_PHASE_CHIPS, MACD_CHIPS,
  MKT_CAP_CHIPS, getMktCapChip,
} from './types'
import { Section, ChipButton, RangeRow, MinRow, MultiChipRow } from './primitives'

interface FilterPanelProps {
  /** Initial filter values, seeded from the URL by the page. */
  initialFilters: FilterState
  /** When set, the panel is editing this strategy (name/desc + PATCH on save). */
  editStrategy?: Strategy
  /** Mobile sheet close handler. Omitted on the desktop sidebar (always open). */
  onClose?: () => void
}

export function FilterPanel({ initialFilters, editStrategy, onClose }: FilterPanelProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [filters, setFilters] = useState<FilterState>(initialFilters)
  const [strategyName, setStrategyName] = useState(editStrategy?.name ?? '')
  const [strategyDescription, setStrategyDescription] = useState(editStrategy?.description ?? '')
  const [saving, setSaving] = useState(false)
  const [matchCount, setMatchCount] = useState<number | null>(null)
  const [openSections, setOpenSections] = useState(
    new Set(['kelas', 'fundamental', 'pertumbuhan', 'dividen', 'teknikal'])
  )

  const set = (key: FilterKey) => (v: string) => setFilters((f) => ({ ...f, [key]: v }))

  function toggleSection(id: string) {
    setOpenSections((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const activeCount = FILTER_KEYS.filter((k) => filters[k]).length
  const isLocked = editStrategy ? !editStrategy.is_editable : false

  // Live match count — debounced fetch to /api/strategies/count
  const countTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (countTimerRef.current) clearTimeout(countTimerRef.current)
    countTimerRef.current = setTimeout(async () => {
      const params = new URLSearchParams()
      for (const key of FILTER_KEYS) if (filters[key]) params.set(key, filters[key])
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

  // Market cap chip ↔ min/max round-trip
  const mktCapChip = getMktCapChip(filters.minMktCap, filters.maxMktCap)
  function setMktCapChip(chip: typeof MKT_CAP_CHIPS[number]) {
    setFilters((f) => ({ ...f, minMktCap: chip.min, maxMktCap: chip.max }))
  }

  function handleClear() {
    setFilters(EMPTY_FILTERS)
    setMatchCount(null)
  }

  /** Commit current filters to the URL → server re-renders the results list. */
  const applyFilters = useCallback(() => {
    const params = new URLSearchParams()
    for (const key of FILTER_KEYS) if (filters[key]) params.set(key, filters[key])
    // Preserve sort/dir if present
    const sort = searchParams.get('sort')
    const dir = searchParams.get('dir')
    if (sort) params.set('sort', sort)
    if (dir) params.set('dir', dir)
    // Preserve the edited strategy's identity (so name/desc/PATCH persist) but
    // DO NOT re-add edit=1 — that flag only drives the initial mobile auto-open;
    // re-adding it would make the sheet pop open again after every Apply.
    if (editStrategy) params.set('strategy', editStrategy.id)
    router.push(`/screener?${params.toString()}`)
    onClose?.()
  }, [filters, searchParams, editStrategy, router, onClose])

  const saveStrategy = useCallback(async () => {
    const name = strategyName.trim()
    if (!name || isLocked) return
    setSaving(true)
    const filterObj: Record<string, string> = {}
    for (const key of FILTER_KEYS) if (filters[key]) filterObj[key] = filters[key]
    try {
      const isEdit = !!editStrategy?.id
      const url = isEdit ? `/api/strategies/${editStrategy!.id}` : '/api/strategies'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: strategyDescription.trim() || null, filters: filterObj }),
      })
      if (res.ok) {
        const saved = await res.json() as { id: string }
        const id = isEdit ? editStrategy!.id : saved.id
        window.dispatchEvent(new Event('strategy-change'))
        const params = new URLSearchParams({ strategy: id, ...filterObj })
        router.push(`/screener?${params.toString()}`)
        onClose?.()
      }
    } catch { /* silent */ } finally {
      setSaving(false)
    }
  }, [strategyName, strategyDescription, filters, editStrategy, isLocked, router, onClose])

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-bg-card)' }}>

      {/* Header */}
      <div
        className="flex items-center justify-between px-5 h-[56px] flex-shrink-0"
        style={{ background: 'var(--color-bg-card)', borderBottom: '1px solid var(--color-border)' }}
      >
        <span className="font-display font-bold" style={{ fontSize: 18, color: 'var(--color-text-primary)' }}>
          {editStrategy ? 'Edit Filter' : 'Filter'}
        </span>
        <div className="flex items-center gap-3">
          {activeCount > 0 && (
            <button onClick={handleClear} className="font-mono" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              Bersihkan
            </button>
          )}
          {onClose && (
            <button onClick={onClose} aria-label="Tutup" style={{ color: 'var(--color-text-dim)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Lock banner for predefined strategies */}
      {isLocked && (
        <div
          className="flex items-center gap-3 px-5 py-3 flex-shrink-0"
          style={{ background: 'var(--color-warning-bg)', borderBottom: '1px solid var(--color-border)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ color: 'var(--color-warning-text)', flexShrink: 0 }}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          <span className="font-mono" style={{ fontSize: 12, color: 'var(--color-warning-text)' }}>
            Predefined strategy — read only. Duplikat untuk membuat versimu.
          </span>
        </div>
      )}

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">

        {/* Strategy name + description */}
        <div
          className="flex flex-col gap-3 px-5 py-4"
          style={{ background: 'var(--color-bg-card)', borderBottom: '1px solid var(--color-border)' }}
        >
          <div className="flex flex-col gap-1.5">
            <span className="section-label">NAMA STRATEGY</span>
            <input
              type="text" aria-label="Nama strategi" placeholder="Contoh: Hyper Growth Q2 2026"
              value={strategyName} onChange={(e) => setStrategyName(e.target.value)} disabled={isLocked}
              className="w-full rounded-lg px-3.5 py-2.5 font-mono text-[13px] outline-none placeholder:opacity-40 transition-colors disabled:opacity-50"
              style={{ background: 'var(--color-bg-inset)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', fontWeight: 500 }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="section-label">DESKRIPSI (OPSIONAL)</span>
            <textarea
              aria-label="Deskripsi strategi" placeholder="Jelaskan tujuan strategy ini secara singkat…"
              value={strategyDescription} onChange={(e) => setStrategyDescription(e.target.value)} disabled={isLocked} rows={2}
              className="w-full rounded-lg px-3.5 py-2.5 font-body text-[13px] outline-none placeholder:opacity-40 resize-none transition-colors disabled:opacity-50"
              style={{ background: 'var(--color-bg-inset)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
            />
          </div>
        </div>

        {/* 1. Kelas Saham */}
        <Section title="Kelas Saham" open={openSections.has('kelas')} onToggle={() => toggleSection('kelas')}>
          <div className="flex flex-col gap-2">
            <span className="font-mono" style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)' }}>Kapitalisasi Pasar</span>
            <div className="flex items-center gap-2 flex-wrap">
              {MKT_CAP_CHIPS.map((chip) => (
                <ChipButton key={chip.id} label={chip.label} active={mktCapChip === chip.id} onClick={() => setMktCapChip(chip)} />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-mono" style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)' }}>Sektor</span>
            <div className="flex items-center gap-2 flex-wrap">
              {SECTOR_CHIPS.map((s) => (
                <ChipButton key={s.value} label={s.label} active={filters.sector === s.value}
                  onClick={() => set('sector')(filters.sector === s.value ? '' : s.value)} />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-mono" style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)' }}>Papan Pencatatan</span>
            <div className="flex items-center gap-2 flex-wrap">
              {BOARD_CHIPS.map((b) => (
                <ChipButton key={b.value} label={b.label} active={filters.board === b.value}
                  onClick={() => set('board')(filters.board === b.value ? '' : b.value)} />
              ))}
            </div>
          </div>
        </Section>

        {/* 2. Fundamental */}
        <Section title="Fundamental" open={openSections.has('fundamental')} onToggle={() => toggleSection('fundamental')}>
          <MinRow label="ROE (Return on Equity) ≥" filterKey="minRoe" placeholder="15" unit="%" filters={filters} set={set} />
          <MinRow label="PBV (Price to Book Value) ≤" filterKey="maxPbv" placeholder="3" filters={filters} set={set} />
          <MinRow label="P/E (Price to Earnings) ≤" filterKey="maxPe" placeholder="25" filters={filters} set={set} />
          <MinRow label="Net Margin ≥" filterKey="minNetMargin" placeholder="10" unit="%" filters={filters} set={set} />
        </Section>

        {/* 3. Pertumbuhan (CAGR) */}
        <Section title="Pertumbuhan (CAGR)" open={openSections.has('pertumbuhan')} onToggle={() => toggleSection('pertumbuhan')}>
          <MinRow label="Revenue CAGR 3Y ≥" filterKey="minRevCagr3yr" placeholder="10" unit="%" filters={filters} set={set} />
          <MinRow label="Revenue CAGR 5Y ≥" filterKey="minRevCagr5yr" placeholder="10" unit="%" filters={filters} set={set} />
          <MinRow label="Price CAGR 3Y ≥" filterKey="minPriceCagr3yr" placeholder="5" unit="%" filters={filters} set={set} />
          <MinRow label="Price CAGR 5Y ≥" filterKey="minPriceCagr5yr" placeholder="5" unit="%" filters={filters} set={set} />
          <MinRow label="OCF CAGR 3Y ≥" filterKey="minOcfCagr3yr" placeholder="10" unit="%" filters={filters} set={set} />
          <MinRow label="OCF CAGR 5Y ≥" filterKey="minOcfCagr5yr" placeholder="10" unit="%" filters={filters} set={set} />
        </Section>

        {/* 4. Dividen */}
        <Section title="Dividen" open={openSections.has('dividen')} onToggle={() => toggleSection('dividen')}>
          <MinRow label="Dividend Yield ≥" filterKey="minDivYield" placeholder="3" unit="%" filters={filters} set={set} />
          <MinRow label="Rata-rata Yield 3 Tahun ≥" filterKey="minDivAvg3yr" placeholder="3" unit="%" filters={filters} set={set} />
          <MinRow label="Rata-rata Yield 5 Tahun ≥" filterKey="minDivAvg5yr" placeholder="3" unit="%" filters={filters} set={set} />
        </Section>

        {/* 5. Teknikal */}
        <Section title="Teknikal" open={openSections.has('teknikal')} onToggle={() => toggleSection('teknikal')}>
          <MultiChipRow label="Fase Pasar" options={PHASE_CHIPS} filterKey="phase" filters={filters} set={set} />
          <MinRow label="Durasi Fase ≤ (hari)" filterKey="maxPhaseDays" placeholder="20" unit="hari" filters={filters} set={set} />
          <RangeRow label="RSI (Relative Strength Index)" minKey="minRsi" maxKey="maxRsi" minPlaceholder="30" maxPlaceholder="70" filters={filters} set={set} />
          <div className="flex flex-col gap-2">
            <span className="font-mono" style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)' }}>MACD Sinyal</span>
            <div className="flex items-center gap-2">
              {MACD_CHIPS.map((c) => (
                <ChipButton key={c.value} label={c.label} active={filters.macdCross === c.value} onClick={() => set('macdCross')(c.value)} />
              ))}
            </div>
          </div>
          <MinRow label="MACD Cross dalam ≤ (hari)" filterKey="maxMacdCrossDays" placeholder="5" unit="hari" filters={filters} set={set} />
          <RangeRow label="Volume Change (vs rata-rata 20H)" minKey="minVolChangePct" maxKey="maxVolChangePct" minPlaceholder="150" maxPlaceholder="max %" filters={filters} set={set} />
          <MinRow label="Rata-rata Volume ≥ (Jt)" filterKey="minVolAvg" placeholder="1" unit="Jt" filters={filters} set={set} />
          <div className="flex flex-col gap-2">
            <span className="font-mono" style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)' }}>Fase Wyckoff</span>
            <div className="flex items-center gap-2 flex-wrap">
              {WYCKOFF_PHASE_CHIPS.map((p) => (
                <ChipButton key={p.value} label={p.label} active={filters.wyckoffPhaseV2 === p.value} color={p.color}
                  onClick={() => set('wyckoffPhaseV2')(filters.wyckoffPhaseV2 === p.value ? '' : p.value)} />
              ))}
            </div>
          </div>
        </Section>

        <div className="h-4" />
      </div>

      {/* Sticky footer — count + Apply + Save */}
      <div
        className="flex-shrink-0 flex flex-col gap-3 px-5 py-4"
        style={{ background: 'var(--color-bg-card)', borderTop: '1px solid var(--color-border)' }}
      >
        <div className="flex flex-col gap-0.5">
          <span className="font-mono" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{activeCount} kondisi terpilih</span>
          {matchCount != null && (
            <span className="font-mono font-bold" style={{ fontSize: 13, color: 'var(--color-brand)' }}>~{matchCount} saham cocok</span>
          )}
        </div>

        <button
          onClick={applyFilters}
          className="flex items-center justify-center gap-2 w-full rounded-xl py-3.5 font-mono font-bold transition-opacity"
          style={{ fontSize: 14, background: 'var(--color-brand)', color: '#0C0C0C' }}
        >
          Terapkan Filter
        </button>

        <button
          onClick={saveStrategy}
          disabled={saving || !strategyName.trim() || isLocked}
          className="flex items-center justify-center gap-2 w-full rounded-xl py-2.5 font-mono font-semibold transition-opacity"
          style={{
            fontSize: 13,
            background: 'transparent',
            color: 'var(--color-brand)',
            border: '1px solid var(--color-brand)',
            opacity: saving || !strategyName.trim() || isLocked ? 0.4 : 1,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M9 11l3 3L22 4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" strokeLinecap="round" />
          </svg>
          {saving ? 'Menyimpan…' : editStrategy && !isLocked ? 'Perbarui Strategy' : 'Simpan Strategy'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check & lint**

Run: `cd web && npx tsc --noEmit && npm run lint`
Expected: PASS. (Not yet mounted; verifies compilation + that all imported names from `types`/`primitives` resolve.)

- [ ] **Step 3: Commit**

```bash
git add web/src/components/screener/filters/FilterPanel.tsx
git commit -m "feat(screener): build full FilterPanel with all non-Wyckoff filters"
```

---

## Task 4: Make ScreenerListShell results-only

Replace the filter-icon `<Link href="/screener/strategy">` with a button that calls an `onOpenFilters` prop (used by the mobile sheet trigger). Hide it on desktop (`md:hidden`) since the sidebar is always visible there.

**Files:**
- Modify: `web/src/components/screener/ScreenerListShell.tsx`

- [ ] **Step 1: Update imports — drop the unused `Link` filter usage**

`Link` is still used by pagination, so keep the import. No import change needed.

- [ ] **Step 2: Add `onOpenFilters` to the props interface**

Find:
```tsx
interface ScreenerListShellProps {
  rows: ScreenerRow[]
  total: number
  page: number
  totalPages: number
  sortBy: string
  strategies: Strategy[]
  activeStrategyId?: string
}
```
Replace with:
```tsx
interface ScreenerListShellProps {
  rows: ScreenerRow[]
  total: number
  page: number
  totalPages: number
  sortBy: string
  strategies: Strategy[]
  activeStrategyId?: string
  onOpenFilters: () => void
}
```
And add `onOpenFilters,` to the destructured params in `export function ScreenerListShell({ … })`.

- [ ] **Step 3: Replace the filter Link with a button**

Find (the `<Link href="/screener/strategy" …>` block):
```tsx
          <Link
            href="/screener/strategy"
            className="relative flex items-center"
            style={{ color: 'var(--color-text-muted)' }}
            aria-label="Filter"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z" />
            </svg>
            {activeFilterCount > 0 && (
              <span
                className="absolute -top-1 -right-1 flex items-center justify-center rounded-full font-mono font-bold"
                style={{ width: 14, height: 14, fontSize: 8, background: 'var(--color-brand)', color: '#0C0C0C' }}
              >
                {activeFilterCount}
              </span>
            )}
          </Link>
```
Replace with (a button; `md:hidden` because desktop shows the sidebar):
```tsx
          <button
            onClick={onOpenFilters}
            className="relative flex items-center md:hidden"
            style={{ color: 'var(--color-text-muted)' }}
            aria-label="Filter"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z" />
            </svg>
            {activeFilterCount > 0 && (
              <span
                className="absolute -top-1 -right-1 flex items-center justify-center rounded-full font-mono font-bold"
                style={{ width: 14, height: 14, fontSize: 8, background: 'var(--color-brand)', color: '#0C0C0C' }}
              >
                {activeFilterCount}
              </span>
            )}
          </button>
```

- [ ] **Step 4: Type-check & lint**

Run: `cd web && npx tsc --noEmit && npm run lint`
Expected: FAIL only at the call site? No — `ScreenerListShell` is currently rendered by `page.tsx` without `onOpenFilters`. Task 5 fixes the caller. For now `tsc` will error in `page.tsx` ("Property 'onOpenFilters' is missing"). That is expected and resolved in Task 5. If you want a green checkpoint, do Tasks 4 and 5 back-to-back before committing — otherwise commit and note the known-temporary error.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/screener/ScreenerListShell.tsx
git commit -m "refactor(screener): results list opens filters via callback, not route link"
```

---

## Task 5: Build ScreenerShell and wire the page

**Files:**
- Create: `web/src/components/screener/ScreenerShell.tsx`
- Modify: `web/src/app/screener/page.tsx`

- [ ] **Step 1: Create ScreenerShell (client wrapper)**

```tsx
// web/src/components/screener/ScreenerShell.tsx
'use client'

import { useState } from 'react'
import { ScreenerListShell } from '@/components/screener/ScreenerListShell'
import { FilterPanel } from '@/components/screener/filters/FilterPanel'
import type { FilterState } from '@/components/screener/filters/types'
import type { ScreenerRow } from '@/lib/types/api'
import type { Strategy } from '@/lib/types/database'

interface ScreenerShellProps {
  rows: ScreenerRow[]
  total: number
  page: number
  totalPages: number
  sortBy: string
  strategies: Strategy[]
  activeStrategyId?: string
  initialFilters: FilterState
  editStrategy?: Strategy
  autoOpenPanel: boolean
}

export function ScreenerShell({
  rows, total, page, totalPages, sortBy, strategies,
  activeStrategyId, initialFilters, editStrategy, autoOpenPanel,
}: ScreenerShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(autoOpenPanel)

  return (
    <div className="md:flex" style={{ background: 'var(--color-bg-page)' }}>
      {/* Desktop sidebar — always visible at md+ */}
      <aside
        className="hidden md:block md:w-[360px] md:flex-shrink-0 md:sticky md:top-0 md:h-screen md:overflow-hidden"
        style={{ borderRight: '1px solid var(--color-border)' }}
      >
        <FilterPanel initialFilters={initialFilters} editStrategy={editStrategy} />
      </aside>

      {/* Results column */}
      <div className="flex-1 min-w-0">
        <ScreenerListShell
          rows={rows}
          total={total}
          page={page}
          totalPages={totalPages}
          sortBy={sortBy}
          strategies={strategies}
          activeStrategyId={activeStrategyId}
          onOpenFilters={() => setDrawerOpen(true)}
        />
      </div>

      {/* Mobile sheet — only below md */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={() => setDrawerOpen(false)}
          />
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-2xl overflow-hidden"
            style={{ top: '5dvh', background: 'var(--color-bg-card)', overscrollBehavior: 'contain' }}
          >
            <FilterPanel
              initialFilters={initialFilters}
              editStrategy={editStrategy}
              onClose={() => setDrawerOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Rewrite the screener page to render ScreenerShell**

Replace the entire body of `web/src/app/screener/page.tsx` with:
```tsx
import { Suspense } from 'react'
import { getScreenerRows } from '@/lib/queries/stocks'
import { getStrategies } from '@/lib/queries/strategies'
import { ScreenerShell } from '@/components/screener/ScreenerShell'
import { filtersFromRecord } from '@/components/screener/filters/types'
import { PAGE_SIZE } from '@/lib/constants'

const NUMERIC_PARAMS = [
  'minRoe', 'maxPe', 'maxPbv', 'minNetMargin', 'minDivYield',
  'minDivAvg3yr', 'minDivAvg5yr',
  'minRevCagr3yr', 'minRevCagr5yr', 'minPriceCagr3yr', 'minPriceCagr5yr', 'minOcfCagr3yr', 'minOcfCagr5yr',
  'minMktCap', 'maxMktCap', 'maxPhaseDays',
  'minRsi', 'maxRsi', 'maxMacdCrossDays', 'minVolChangePct', 'maxVolChangePct', 'minVolAvg',
  'maxWyckoffDays', 'minWyckoffConf',
  'maxWyckoffDaysV2', 'minWyckoffConfV2',
] as const

const STRING_PARAMS = [
  'sector', 'board', 'phase', 'macdCross',
  'wyckoffEvent', 'wyckoffPhase',
  'wyckoffEventV2', 'wyckoffPhaseV2', 'wyckoffFsmPhaseV2',
] as const

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>
}

export default async function ScreenerPage({ searchParams }: PageProps) {
  const sp = await searchParams

  const page    = Math.max(1, Number(sp.page ?? 1))
  const sortBy  = sp.sort ?? 'market_cap'
  const sortDir = (sp.dir === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc'

  const filters: Record<string, string | number | undefined> = { sortBy, sortDir }
  for (const key of STRING_PARAMS) {
    if (sp[key]) filters[key] = sp[key]
  }
  for (const key of NUMERIC_PARAMS) {
    if (sp[key]) filters[key] = Number(sp[key])
  }

  const [{ rows, total }, strategies] = await Promise.all([
    getScreenerRows(filters, page),
    getStrategies(),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const activeStrategyId = sp.strategy

  // Seed the filter panel from URL params (string values only).
  const initialFilters = filtersFromRecord(sp as Record<string, unknown>)
  // If a strategy is active, pass its full record so the panel can edit it.
  const editStrategy = activeStrategyId
    ? strategies.find((s) => s.id === activeStrategyId)
    : undefined
  const autoOpenPanel = sp.edit === '1'

  return (
    <main className="min-h-screen" style={{ background: 'var(--color-bg-page)' }}>
      <Suspense>
        <ScreenerShell
          rows={rows}
          total={total}
          page={page}
          totalPages={totalPages}
          sortBy={sortBy}
          strategies={strategies}
          activeStrategyId={activeStrategyId}
          initialFilters={initialFilters}
          editStrategy={editStrategy}
          autoOpenPanel={autoOpenPanel}
        />
      </Suspense>
    </main>
  )
}
```

- [ ] **Step 3: Type-check & lint**

Run: `cd web && npx tsc --noEmit && npm run lint`
Expected: PASS. (Resolves the Task 4 caller error: `ScreenerListShell` now receives `onOpenFilters` from `ScreenerShell`.)

- [ ] **Step 4: Commit**

```bash
git add web/src/components/screener/ScreenerShell.tsx web/src/app/screener/page.tsx
git commit -m "feat(screener): single /screener page with inline filter panel + results"
```

---

## Task 6: Repoint external links to the merged page

**Files:**
- Modify: `web/src/components/strategies/StrategyListPage.tsx`
- Modify: `web/src/components/strategies/StrategyCard.tsx`
- Modify: `web/src/components/nav/bottom-tab-bar.tsx`

- [ ] **Step 1: StrategyListPage — both create links → `/screener?edit=1`**

In `web/src/components/strategies/StrategyListPage.tsx`, change both occurrences of:
```tsx
            href="/screener/strategy"
```
to:
```tsx
            href="/screener?edit=1"
```
(There are two: the "+ Create Strategy" button near line 73 and the "Buat strategy pertamamu →" empty-state link near line 93.)

- [ ] **Step 2: StrategyCard — edit opens the merged page in edit mode**

In `web/src/components/strategies/StrategyCard.tsx`, find:
```tsx
  function handleEdit(e: React.MouseEvent) {
    e.stopPropagation()
    router.push(`/screener/strategy?id=${strategy.id}`)
  }
```
Replace with (carry the strategy id + its filters + `edit=1` so the panel opens pre-loaded and applied):
```tsx
  function handleEdit(e: React.MouseEvent) {
    e.stopPropagation()
    const filters = strategy.filters as Record<string, string | number>
    const params = new URLSearchParams({ strategy: strategy.id, edit: '1' })
    for (const [k, v] of Object.entries(filters)) {
      if (v != null && v !== '') params.set(k, String(v))
    }
    router.push(`/screener?${params.toString()}`)
  }
```

- [ ] **Step 3: bottom-tab-bar — fix the stale comment**

In `web/src/components/nav/bottom-tab-bar.tsx`, change:
```tsx
    // Treat /screener and /screener/strategy as part of the Strategy tab
```
to:
```tsx
    // Treat /screener as part of the Strategy tab
```
(The `pathname.startsWith('/screener')` check on the next line is unchanged and still correct.)

- [ ] **Step 4: Type-check & lint**

Run: `cd web && npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/strategies/StrategyListPage.tsx web/src/components/strategies/StrategyCard.tsx web/src/components/nav/bottom-tab-bar.tsx
git commit -m "refactor(strategies): repoint create/edit links to merged /screener"
```

---

## Task 7: Delete the dead surfaces

**Files:**
- Delete: `web/src/app/screener/strategy/` (whole dir)
- Delete: `web/src/components/screener/StrategyBuilderShell.tsx`
- Delete: `web/src/components/home/screener-filters.tsx`
- Delete: `web/src/components/home/screener-shell.tsx`

- [ ] **Step 1: Confirm nothing imports them (besides each other)**

Run:
```bash
cd web && grep -rn "StrategyBuilderShell\|screener/strategy\|home/screener-filters\|home/screener-shell" src --include="*.ts" --include="*.tsx"
```
Expected: only matches inside the four files about to be deleted (and `screener-shell.tsx` importing `screener-filters.tsx`). If anything else references them, stop and fix that caller first.

- [ ] **Step 2: Delete the files**

```bash
cd "/Users/nailul.fadloil/Documents/Personal spaces/Financial-report-analyzer"
git rm -r web/src/app/screener/strategy
git rm web/src/components/screener/StrategyBuilderShell.tsx
git rm web/src/components/home/screener-filters.tsx
git rm web/src/components/home/screener-shell.tsx
```

- [ ] **Step 3: Type-check, lint, and a full build to catch route/import breakage**

Run: `cd web && npx tsc --noEmit && npm run lint && npm run build`
Expected: PASS. The build confirms the removed route causes no dangling references and `/screener` compiles as a route.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(screener): remove dead home screener and standalone builder route"
```

---

## Task 8: Design-system review + manual verification (ship gate)

**Files:** none (verification only; fix findings in the relevant files from Tasks 1–5).

- [ ] **Step 1: Run the design-system-review skill**

Invoke the `design-system-review` skill against the changed/created components:
- `web/src/components/screener/filters/types.ts`
- `web/src/components/screener/filters/primitives.tsx`
- `web/src/components/screener/filters/FilterPanel.tsx`
- `web/src/components/screener/ScreenerShell.tsx`
- `web/src/components/screener/ScreenerListShell.tsx`

Resolve every finding. Expected token/typography rules (per `.claude/CLAUDE.md`): no raw hex except the sanctioned dark-on-brand `#0C0C0C` badge/button text; labels `font-mono` ≥9px in `muted`/`primary` (never `dim`/`ghost`); reading copy ≥12px; active-input border = `var(--color-brand)`; badge fills use dark text.

- [ ] **Step 2: Manual smoke test — start dev server**

Run: `cd web && npm run dev`
Then in a browser at `http://localhost:3000/screener` verify:

1. **Desktop (≥768px):** filter sidebar visible on the left; results on the right. All five sections render. The newly-exposed inputs exist: **Papan Pencatatan** chips, **Price CAGR 3Y/5Y**, **Fase Pasar** multiselect, **Durasi Fase**, **MACD Cross dalam ≤ hari**, **Volume Change** max, **Rata-rata Volume**.
2. **Apply flow:** set RSI 30–70 + a sector → "~N saham cocok" updates within ~1s → click **Terapkan Filter** → URL gains `?minRsi=30&maxRsi=70&sector=…`, results list re-renders to match, count in the results bar equals the panel's preview.
3. **Mobile (resize to 390px):** sidebar hidden; tap the filter icon in the results bar → bottom sheet opens with the panel; apply closes the sheet and updates results.
4. **Strategy save:** enter a name → **Simpan Strategy** → redirected to `/screener?strategy=<id>&…`; the new strategy appears as a tab.
5. **Strategy edit:** from `/strategies`, click a card's edit → lands on `/screener?strategy=<id>&edit=1` with the panel pre-loaded (sheet auto-open on mobile); changing a value + **Perbarui Strategy** PATCHes it.
6. **Predefined lock:** open a non-editable strategy → lock banner shows, name/desc disabled, **Simpan/Perbarui** disabled, but **Terapkan Filter** still works.
7. **Clear:** **Bersihkan** empties the panel; applying returns the full list.
8. **200% zoom:** results metric/sort bar and tabs scroll horizontally without clipping.
9. **Home `/` and `/strategies`** still render correctly (no broken imports from the deletions).

- [ ] **Step 3: Fix any findings, then final type-check/lint/build**

Run: `cd web && npx tsc --noEmit && npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(screener): resolve design-system review + manual verification findings"
```

---

## Self-Review Notes (author)

- **Spec coverage:** decisions #1 (merge → Tasks 4–7), #2 (full CRUD inline → Task 3 name/desc + save, Task 6 links), #3 (all non-Wyckoff exposed, Wyckoff light → Task 3 sections; Wyckoff stays `wyckoffPhaseV2` chips only), #4 (Apply + live count → Task 3 `applyFilters`/count). Deletions → Task 7. Design-system conformance → Task 8 (+ token rules inline in Tasks 1–3). All spec sections map to a task.
- **No backend tasks:** intentional — `applyScreenerFilters`, `/api/strategies/count`, and the page param parsing already cover every key (verified against `lib/queries/stocks.ts`).
- **Type consistency:** `FilterState`/`FilterKey`/`EMPTY_FILTERS`/`filtersFromRecord` defined in Task 1 and used identically in Tasks 3 & 5. `onOpenFilters` prop name matches between Task 4 (definition) and Task 5 (caller).
- **Known transient:** Task 4 leaves `tsc` red until Task 5 wires the caller — called out explicitly; execute 4→5 together for a green checkpoint.
- **No web unit tests:** none exist in the repo; verification uses `tsc`/`lint`/`build` + `design-system-review` + the manual checklist, which is the honest gate for this codebase.
