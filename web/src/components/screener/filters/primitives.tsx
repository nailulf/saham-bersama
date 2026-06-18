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

export type ChipVariant = 'brand' | 'warning' | 'negative' | 'neutral'

// Active chip = the design's tinted pill (docs/FSA → LChip_Large Cap): -bg tint fill +
// solid accent border + readable -text token (green text on light-green fill). The tinted
// fill + colored border is what distinguishes it from the flat outlined inactive state.
const CHIP_ACTIVE: Record<ChipVariant, { bg: string; border: string; text: string }> = {
  brand:    { bg: 'var(--color-brand-bg)',    border: 'var(--color-brand)',         text: 'var(--color-brand-text)' },
  warning:  { bg: 'var(--color-warning-bg)',  border: 'var(--color-warning-text)',  text: 'var(--color-warning-text)' },
  negative: { bg: 'var(--color-negative-bg)', border: 'var(--color-negative-text)', text: 'var(--color-negative-text)' },
  neutral:  { bg: 'var(--color-bg-inset)',    border: 'var(--color-text-dim)',      text: 'var(--color-text-primary)' },
}

export function ChipButton({
  label, active, variant = 'brand', onClick,
}: { label: string; active: boolean; variant?: ChipVariant; onClick: () => void }) {
  const a = CHIP_ACTIVE[variant]
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full flex-shrink-0 font-mono transition-colors"
      style={{
        fontSize: 10,
        padding: '5px 12px',
        fontWeight: active ? 600 : 400,
        background: active ? a.bg : 'var(--color-bg-page)',
        color: active ? a.text : 'var(--color-text-muted)',
        border: `1px solid ${active ? a.border : 'var(--color-border)'}`,
      }}
    >
      {label}
    </button>
  )
}

// min-w-0 lets the inputs shrink below their intrinsic min-width so two range inputs
// fit the panel instead of overflowing (and being clipped by the panel's overflow-x-hidden).
const inputBase = 'flex-1 min-w-0 rounded-lg px-3 py-2 font-mono text-[12px] outline-none transition-colors'
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
  options: readonly { label: string; value: string; variant?: ChipVariant }[]
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
            variant={o.variant}
            onClick={() => toggle(o.value)}
          />
        ))}
      </div>
    </div>
  )
}
