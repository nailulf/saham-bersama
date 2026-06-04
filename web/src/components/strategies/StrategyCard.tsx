'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, Trash2, Pencil, ChevronDown } from 'lucide-react'
import { StockCard } from '@/components/screener/StockCard'
import type { Strategy } from '@/lib/types/database'
import type { ScreenerRow } from '@/lib/types/api'

interface StocksResponse { rows: ScreenerRow[]; total: number }

interface StrategyCardProps {
  strategy: Strategy
  onDelete: (id: string) => void
}

function ActionBtn({
  children,
  label,
  bg,
  onClick,
}: { children: React.ReactNode; label: string; bg: string; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => { e.stopPropagation(); onClick(e) }}
      className="flex items-center justify-center rounded-md p-1.5 flex-shrink-0 transition-colors"
      style={{ background: bg }}
    >
      {children}
    </button>
  )
}

function SkeletonRow() {
  return (
    <div className="flex flex-col gap-2 px-5 py-3.5 animate-pulse"
      style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
      <div className="flex items-center gap-2">
        <div className="rounded-md w-8 h-8 flex-shrink-0" style={{ background: 'var(--color-bg-inset)' }} />
        <div className="flex flex-col gap-1 flex-1">
          <div className="h-3 w-20 rounded" style={{ background: 'var(--color-bg-inset)' }} />
          <div className="h-2.5 w-32 rounded" style={{ background: 'var(--color-bg-inset)' }} />
        </div>
        <div className="h-3 w-14 rounded" style={{ background: 'var(--color-bg-inset)' }} />
      </div>
      <div className="flex gap-1.5">
        {[56, 44, 64, 44].map((w, i) => (
          <div key={i} className="h-4 rounded" style={{ width: w, background: 'var(--color-bg-inset)' }} />
        ))}
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
    router.push(`/screener/strategy?id=${strategy.id}`)
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(`Delete "${strategy.name}"?`)) return
    await fetch(`/api/strategies/${strategy.id}`, { method: 'DELETE' })
    onDelete(strategy.id)
  }

  const holdingsLabel = total != null
    ? `Holdings: ${total}`
    : `${filterCount} filter`

  return (
    <div style={{ background: 'var(--color-bg-card)', borderBottom: '1px solid var(--color-border-subtle)' }}>

      {/* Clickable card header — tapping anywhere here toggles expand */}
      <button
        type="button"
        onClick={toggle}
        className="w-full text-left flex flex-col gap-2.5 px-5 py-3.5"
      >
        {/* Top row: info + actions */}
        <div className="flex items-start gap-2">
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <span
              className="font-display font-semibold leading-snug"
              style={{ fontSize: 14, color: 'var(--color-text-primary)' }}
            >
              {strategy.name}
            </span>
            {strategy.description ? (
              <span className="font-body leading-snug"
                style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                {strategy.description}
              </span>
            ) : filterCount > 0 ? (
              <span className="font-mono"
                style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>
                {filterCount} kondisi aktif
              </span>
            ) : null}
          </div>

          {/* Action buttons — each stops propagation so they don't trigger expand */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <ActionBtn label="View in screener" bg="var(--color-bg-inset)" onClick={handleNavigate}>
              <ChevronRight size={16} style={{ color: 'var(--color-text-dim)' }} />
            </ActionBtn>
            <ActionBtn label="Delete" bg="var(--color-negative-bg)" onClick={handleDelete}>
              <Trash2 size={16} style={{ color: 'var(--color-negative)' }} />
            </ActionBtn>
            <ActionBtn label="Edit" bg="var(--color-bg-inset)" onClick={handleEdit}>
              <Pencil size={16} style={{ color: 'var(--color-text-dim)' }} />
            </ActionBtn>
            <div
              className="flex items-center justify-center rounded-md p-1.5 flex-shrink-0"
              style={{ background: 'var(--color-bg-inset)' }}
            >
              <ChevronDown
                size={16}
                style={{
                  color: 'var(--color-text-dim)',
                  transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 200ms',
                }}
              />
            </div>
          </div>
        </div>

        {/* Holdings badge */}
        <div className="flex items-center">
          <div
            className="flex items-center px-2.5 py-1 rounded-full"
            style={{ background: 'var(--color-bg-inset)', border: '1px solid var(--color-border)' }}
          >
            <span className="font-mono font-medium" style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
              {loading && stocks === null ? 'Memuat…' : holdingsLabel}
            </span>
          </div>
        </div>
      </button>

      {/* Expanded stock list */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          {expanded && (
            <div style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
              {loading && stocks === null ? (
                <>{Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} />)}</>
              ) : stocks && stocks.length > 0 ? (
                <>
                  {stocks.map((row) => <StockCard key={row.ticker} row={row} />)}
                  {total != null && total > stocks.length && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleNavigate(e) }}
                      className="w-full py-3 font-mono font-medium text-center"
                      style={{ fontSize: 12, color: 'var(--color-brand)' }}
                    >
                      Lihat semua {total} saham →
                    </button>
                  )}
                </>
              ) : (
                <div className="px-5 py-6 text-center">
                  <p className="font-mono" style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>
                    Tidak ada saham yang cocok.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
