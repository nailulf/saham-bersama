'use client'

import { useRouter, usePathname } from 'next/navigation'
import type { Strategy } from '@/lib/types/database'

interface StrategyTabsProps {
  strategies: Strategy[]
  activeStrategyId?: string
}

export function StrategyTabs({ strategies, activeStrategyId }: StrategyTabsProps) {
  const router = useRouter()
  const pathname = usePathname()

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
          color: isCustom ? '#0C0C0C' : 'var(--color-text-dim)',
          border: `1px solid ${isCustom ? 'transparent' : 'var(--color-border)'}`,
        }}
      >
        Custom
      </button>

      {strategies.map((s) => {
        const isActive = s.id === activeStrategyId
        return (
          <button
            key={s.id}
            onClick={() => applyStrategy(s)}
            className="flex-shrink-0 px-3 py-1.5 rounded-full transition-colors"
            style={{
              fontSize: 11,
              fontWeight: isActive ? 600 : 400,
              background: isActive ? 'var(--color-brand)' : 'var(--color-bg-inset)',
              color: isActive ? '#0C0C0C' : 'var(--color-text-dim)',
              border: `1px solid ${isActive ? 'transparent' : 'var(--color-border)'}`,
            }}
          >
            {s.name}
          </button>
        )
      })}
    </div>
  )
}
