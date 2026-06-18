'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import type { Strategy } from '@/lib/types/database'

interface StrategyTabsProps {
  strategies: Strategy[]
  activeStrategyId?: string
}

export function StrategyTabs({ strategies, activeStrategyId }: StrategyTabsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function applyStrategy(strategy: Strategy | null) {
    if (!strategy) {
      router.push(pathname)
      return
    }
    const params = new URLSearchParams()
    params.set('strategy', strategy.id)
    const f = strategy.filters as Record<string, string | number>
    for (const [key, val] of Object.entries(f)) {
      if (val != null && val !== '') params.set(key, String(val))
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  async function deleteStrategy(strategy: Strategy) {
    if (deletingId) return
    const ok = window.confirm(`Hapus strategy "${strategy.name}"?`)
    if (!ok) return
    setDeletingId(strategy.id)
    try {
      const res = await fetch(`/api/strategies/${strategy.id}`, { method: 'DELETE' })
      if (!res.ok) return
      // If the deleted strategy was active, drop back to Custom (clear params).
      if (strategy.id === activeStrategyId) {
        router.push(pathname)
      }
      router.refresh()
    } catch {
      // silent
    } finally {
      setDeletingId(null)
    }
  }

  const isCustom = !activeStrategyId

  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-none px-5 py-2.5">
      <button
        onClick={() => applyStrategy(null)}
        className="flex-shrink-0 px-3 py-1.5 rounded-full transition-colors"
        style={{
          fontSize: 11,
          fontWeight: 600,
          background: isCustom ? 'var(--color-brand)' : 'var(--color-bg-inset)',
          color: isCustom ? '#0C0C0C' : 'var(--color-text-muted)',
          border: `1px solid ${isCustom ? 'transparent' : 'var(--color-border)'}`,
        }}
      >
        Custom
      </button>

      {strategies.map((s) => {
        const isActive = s.id === activeStrategyId
        const canDelete = s.is_editable
        return (
          <div
            key={s.id}
            className="group flex-shrink-0 flex items-center rounded-full transition-colors"
            style={{
              fontSize: 11,
              background: isActive ? 'var(--color-brand)' : 'var(--color-bg-inset)',
              border: `1px solid ${isActive ? 'transparent' : 'var(--color-border)'}`,
            }}
          >
            <button
              onClick={() => applyStrategy(s)}
              className={`py-1.5 pl-3 ${canDelete ? 'pr-1.5' : 'pr-3'}`}
              style={{
                fontWeight: isActive ? 600 : 400,
                color: isActive ? '#0C0C0C' : 'var(--color-text-muted)',
              }}
            >
              {s.name}
            </button>
            {canDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  deleteStrategy(s)
                }}
                disabled={deletingId === s.id}
                aria-label={`Hapus strategy ${s.name}`}
                title="Hapus strategy"
                className="flex-shrink-0 flex items-center justify-center pr-2.5 pl-1 py-1.5 transition-opacity md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-40"
                style={{ color: isActive ? '#0C0C0C' : 'var(--color-text-dim)' }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
