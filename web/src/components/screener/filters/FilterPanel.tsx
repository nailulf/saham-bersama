'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Strategy } from '@/lib/types/database'
import {
  FILTER_KEYS, type FilterKey, type FilterState, EMPTY_FILTERS,
  SECTOR_CHIPS, BOARD_CHIPS, PHASE_CHIPS, WYCKOFF_PHASE_CHIPS, MACD_CHIPS, BANDAR_CHIPS,
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
          <div className="flex flex-col gap-2">
            <span className="font-mono" style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)' }}>Bandar (Akumulasi/Distribusi)</span>
            <div className="flex items-center gap-2 flex-wrap">
              {BANDAR_CHIPS.map((c) => (
                <ChipButton key={c.value} label={c.label} active={(filters.bandarAccdist ?? '') === c.value}
                  onClick={() => set('bandarAccdist')(filters.bandarAccdist === c.value ? '' : c.value)} />
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
