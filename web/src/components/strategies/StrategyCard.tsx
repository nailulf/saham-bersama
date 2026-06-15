'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, Trash2, Pencil, ChevronDown, Lock } from 'lucide-react'
import { StockCard } from '@/components/screener/StockCard'
import type { Strategy } from '@/lib/types/database'
import type { ScreenerRow } from '@/lib/types/api'

interface StocksResponse { rows: ScreenerRow[]; total: number }

interface StrategyCardProps {
  strategy: Strategy
  onDelete: (id: string) => void
}

function ActionBtn({
  children, label, bg, onClick,
}: { children: React.ReactNode; label: string; bg: string; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => { e.stopPropagation(); onClick(e) }}
      className="flex items-center justify-center rounded-lg p-2 flex-shrink-0 transition-colors"
      style={{ background: bg }}
    >
      {children}
    </button>
  )
}

function SkeletonRow() {
  return (
    <div className="flex flex-col gap-2 px-5 py-4 animate-pulse"
      style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
      <div className="flex items-center gap-3">
        <div className="rounded-lg w-8 h-8 flex-shrink-0" style={{ background: 'var(--color-bg-inset)' }} />
        <div className="flex flex-col gap-1.5 flex-1">
          <div className="h-3 w-20 rounded" style={{ background: 'var(--color-bg-inset)' }} />
          <div className="h-2.5 w-32 rounded" style={{ background: 'var(--color-bg-inset)' }} />
        </div>
        <div className="h-3 w-14 rounded" style={{ background: 'var(--color-bg-inset)' }} />
      </div>
    </div>
  )
}

export function StrategyCard({ strategy, onDelete }: StrategyCardProps) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [stocks, setStocks] = useState<ScreenerRow[] | null>(null)
  const [total, setTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  const filterCount = Object.keys(strategy.filters ?? {}).length
  const isEditable = strategy.is_editable !== false

  const fetchStocks = useCallback(async () => {
    if (stocks !== null) return
    setLoading(true)
    try {
      const res = await fetch(`/api/strategies/${strategy.id}/stocks`)
      if (res.ok) {
        const data = await res.json() as StocksResponse
        setStocks(data.rows)
        setTotal(data.total)
      }
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }, [strategy.id, stocks])

  function toggle() {
    const next = !expanded
    setExpanded(next)
    if (next) fetchStocks()
  }

  function handleNavigate(e: React.MouseEvent) {
    e.stopPropagation()
    const filters = strategy.filters as Record<string, string | number>
    const params = new URLSearchParams({ strategy: strategy.id })
    for (const [k, v] of Object.entries(filters)) {
      if (v != null && v !== '') params.set(k, String(v))
    }
    router.push(`/screener?${params.toString()}`)
  }

  function handleEdit(e: React.MouseEvent) {
    e.stopPropagation()
    const filters = strategy.filters as Record<string, string | number>
    const params = new URLSearchParams({ strategy: strategy.id, edit: '1' })
    for (const [k, v] of Object.entries(filters)) {
      if (v != null && v !== '') params.set(k, String(v))
    }
    router.push(`/screener?${params.toString()}`)
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(`Delete "${strategy.name}"?`)) return
    await fetch(`/api/strategies/${strategy.id}`, { method: 'DELETE' })
    onDelete(strategy.id)
  }

  return (
    <div
      className={`relative rounded-xl overflow-hidden${expanded ? ' col-span-full' : ''}`}
      style={{
        background: 'var(--color-bg-card)',
        border: `1px solid ${expanded ? 'var(--color-brand)' : 'var(--color-border)'}`,
        transition: 'border-color 200ms',
      }}
    >
      {/* Top accent bar — matches EventCard pattern */}
      <div
        className="h-[3px] w-full"
        style={{ background: expanded ? 'var(--color-brand)' : 'var(--color-border)' }}
        aria-hidden="true"
      />

      {/* Clickable compact header — same height target as EventCard (~p-3) */}
      <button
        type="button"
        onClick={toggle}
        className="w-full text-left flex flex-col gap-2 p-3"
      >
        {/* Name row + expand chevron */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className="font-display font-bold leading-snug line-clamp-2"
                style={{ fontSize: 14, color: 'var(--color-text-primary)' }}
              >
                {strategy.name}
              </span>
              {!isEditable && (
                <Lock
                  size={11}
                  className="flex-shrink-0"
                  style={{ color: 'var(--color-text-muted)' }}
                  aria-label="Terkunci"
                />
              )}
            </div>

            {strategy.description ? (
              <span className="font-body line-clamp-1" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                {strategy.description}
              </span>
            ) : filterCount > 0 ? (
              <span className="font-mono" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                {filterCount} kondisi aktif
              </span>
            ) : null}
          </div>

          <ChevronDown
            size={14}
            className="flex-shrink-0 mt-0.5"
            style={{
              color: expanded ? 'var(--color-brand)' : 'var(--color-text-dim)',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 200ms',
            }}
          />
        </div>

        {/* Holdings badge */}
        <div
          className="self-start flex items-center gap-1 px-2 py-0.5 rounded-full"
          style={{
            background: total != null ? 'var(--color-brand-bg)' : 'var(--color-bg-inset)',
            border: `1px solid ${total != null ? 'var(--color-brand)' : 'var(--color-border)'}`,
          }}
        >
          {total != null && (
            <span className="font-display font-bold" style={{ fontSize: 12, color: 'var(--color-brand)' }}>
              {total}
            </span>
          )}
          <span className="font-mono" style={{ fontSize: 10, color: total != null ? 'var(--color-brand)' : 'var(--color-text-muted)' }}>
            {loading && stocks === null
              ? 'Memuat…'
              : total != null
                ? 'saham cocok'
                : `${filterCount} filter`}
          </span>
        </div>
      </button>

      {/* Expanded section — action bar + stock list */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          {expanded && (
            <>
              {/* Action bar — only visible when expanded */}
              <div
                className="flex items-center gap-2 px-3 py-2.5"
                style={{ borderTop: '1px solid var(--color-border)' }}
              >
                <ActionBtn label="View in screener" bg="var(--color-bg-inset)" onClick={handleNavigate}>
                  <ChevronRight size={14} style={{ color: 'var(--color-text-muted)' }} />
                  <span className="font-mono ml-1" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                    Buka Screener
                  </span>
                </ActionBtn>
                {isEditable && (
                  <>
                    <ActionBtn label="Edit" bg="var(--color-bg-inset)" onClick={handleEdit}>
                      <Pencil size={14} style={{ color: 'var(--color-text-muted)' }} />
                      <span className="font-mono ml-1" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Edit</span>
                    </ActionBtn>
                    <ActionBtn label="Delete" bg="var(--color-negative-bg)" onClick={handleDelete}>
                      <Trash2 size={14} style={{ color: 'var(--color-negative)' }} />
                    </ActionBtn>
                  </>
                )}
              </div>

              {/* Stock list */}
              <div style={{ borderTop: '1px solid var(--color-border)' }}>
                {loading && stocks === null ? (
                  <>{Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}</>
                ) : stocks && stocks.length > 0 ? (
                  <>
                    {stocks.map((row) => <StockCard key={row.ticker} row={row} />)}
                    {total != null && total > stocks.length && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleNavigate(e) }}
                        className="w-full py-4 font-mono font-semibold text-center"
                        style={{ fontSize: 12, color: 'var(--color-brand)' }}
                      >
                        Lihat semua {total} saham →
                      </button>
                    )}
                  </>
                ) : (
                  <div className="px-5 py-8 text-center">
                    <p className="font-mono" style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                      Tidak ada saham yang cocok.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
