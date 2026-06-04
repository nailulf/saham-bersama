'use client'

import { useState, useEffect } from 'react'
import type { AIAnalysis } from '@/lib/types/api'

interface Props {
  ticker: string
}

const VERDICT_MAP: Record<string, { label: string; bg: string; text: string; border: string }> = {
  strong_buy:   { label: 'BELI KUAT', bg: 'var(--color-brand-bg)',    text: 'var(--color-brand-text)',    border: 'var(--color-brand)'    },
  buy:          { label: 'BELI',      bg: 'var(--color-brand-bg)',    text: 'var(--color-brand-text)',    border: 'var(--color-brand)'    },
  hold:         { label: 'TAHAN',     bg: 'var(--color-warning-bg)',  text: 'var(--color-warning-text)',  border: 'var(--color-warning-text)' },
  avoid:        { label: 'HINDARI',   bg: 'var(--color-negative-bg)', text: 'var(--color-negative-text)', border: 'var(--color-negative)'  },
  strong_avoid: { label: 'HINDARI',   bg: 'var(--color-negative-bg)', text: 'var(--color-negative-text)', border: 'var(--color-negative)'  },
}

const LYNCH_LABEL: Record<string, string> = {
  stalwart:    'STALWART',
  slow_grower: 'SLOW GROWER',
  fast_grower: 'FAST GROWER',
  cyclical:    'CYCLICAL',
  turnaround:  'TURNAROUND',
  asset_play:  'ASSET PLAY',
}

const MOAT_LABEL: Record<string, string> = {
  none:   'NO MOAT',
  narrow: 'NARROW MOAT',
  wide:   'WIDE MOAT',
}

export function AIVerdictStrip({ ticker }: Props) {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null)

  useEffect(() => {
    fetch(`/api/stocks/${ticker}/ai-analysis`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.aiAnalysis) setAnalysis(data.aiAnalysis)
      })
      .catch(() => {})
  }, [ticker])

  if (!analysis) return null

  const verdict = VERDICT_MAP[analysis.analystVerdict] ?? null
  const lynchLabel = analysis.lynchCategory ? LYNCH_LABEL[analysis.lynchCategory] : null
  const moatLabel = analysis.buffettMoat && analysis.buffettMoat !== 'none' ? MOAT_LABEL[analysis.buffettMoat] : null

  return (
    <div
      className="flex items-center gap-2 flex-wrap mt-2"
    >
      {/* Signal badge */}
      {verdict && (
        <span
          className="font-mono text-[10px] font-bold tracking-[0.8px] px-2.5 py-1 rounded"
          style={{
            background: verdict.bg,
            color: verdict.text,
            border: `1px solid ${verdict.border}`,
          }}
        >
          {verdict.label}
        </span>
      )}

      {/* Lynch category */}
      {lynchLabel && (
        <span
          className="font-mono text-[10px] font-medium tracking-[0.5px] px-2.5 py-1 rounded"
          style={{
            background: 'var(--color-bg-inset)',
            color: 'var(--color-text-muted)',
            border: '1px solid var(--color-border)',
          }}
        >
          {lynchLabel}
        </span>
      )}

      {/* Moat */}
      {moatLabel && (
        <span
          className="font-mono text-[10px] font-medium tracking-[0.5px] px-2.5 py-1 rounded"
          style={{
            background: 'var(--color-bg-inset)',
            color: 'var(--color-text-muted)',
            border: '1px solid var(--color-border)',
          }}
        >
          {moatLabel}
        </span>
      )}

      {/* Confidence */}
      <span
        className="font-mono text-[10px] tracking-[0.3px] ml-auto"
        style={{ color: 'var(--color-text-dim)' }}
      >
        CONF {analysis.confidenceLevel}/10
      </span>
    </div>
  )
}
