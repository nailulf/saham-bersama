'use client'

import { useState, useEffect } from 'react'
import type { AIAnalysis } from '@/lib/types/api'
import { fmtNumID } from '@/lib/calculations/formatters'

interface Props { ticker: string }

// analystVerdict → display label + color tier
const VERDICT: Record<string, { label: string; tier: 'positive' | 'neutral' | 'negative' }> = {
  strong_buy:   { label: 'AKUMULASI KUAT', tier: 'positive' },
  buy:          { label: 'AKUMULASI',      tier: 'positive' },
  hold:         { label: 'TAHAN',          tier: 'neutral'  },
  avoid:        { label: 'KURANGI',        tier: 'negative' },
  strong_avoid: { label: 'DISTRIBUSI',     tier: 'negative' },
}

const LYNCH_LABEL: Record<string, string> = {
  stalwart:    'Stalwart',
  slow_grower: 'Slow Grower',
  fast_grower: 'Fast Grower',
  cyclical:    'Cyclical',
  turnaround:  'Turnaround',
  asset_play:  'Asset Play',
}

export function AIVerdictStrip({ ticker }: Props) {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null)

  useEffect(() => {
    fetch(`/api/stocks/${ticker}/ai-analysis`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.aiAnalysis) setAnalysis(data.aiAnalysis) })
      .catch(() => {})
  }, [ticker])

  if (!analysis) return null

  const verdict    = VERDICT[analysis.analystVerdict] ?? null
  const score      = Math.round(analysis.confidenceLevel * 10)
  const lynchLabel = analysis.lynchCategory ? LYNCH_LABEL[analysis.lynchCategory] : null

  // Target price: bull target when positive, bear when negative
  const targetPrice =
    (verdict?.tier === 'positive' || verdict?.tier === 'neutral')
      ? (analysis.bullCase?.price_target ?? analysis.neutralCase?.price_range_high ?? null)
      : (analysis.bearCase?.price_target ?? null)

  // Score badge colors per tier
  const scoreBg     = verdict?.tier === 'negative' ? 'var(--color-negative-bg)'  : 'var(--color-brand-bg)'
  const scoreBorder = verdict?.tier === 'negative' ? 'var(--color-negative)'      : 'var(--color-brand)'
  const scoreText   = verdict?.tier === 'negative' ? 'var(--color-negative-text)' : 'var(--color-brand-text)'

  // Strip card bg/border
  const cardBg     = verdict?.tier === 'negative' ? 'var(--color-negative-bg)'   : 'var(--color-brand-bg)'
  const cardBorder = verdict?.tier === 'negative' ? 'var(--color-negative)'       : 'var(--color-brand)'

  // Verdict label color
  const verdictColor = verdict?.tier === 'neutral' ? 'var(--color-warning-text)' : scoreText

  // Style badges
  type StyleBadge = { label: string; iconPath: string; color: string; bg: string }
  const badges: StyleBadge[] = []

  if (analysis.buffettMoat === 'wide') {
    badges.push({
      label: 'Strong MOAT',
      iconPath: 'M12 2L8 6H4l2 4-4 3h4l2 4 2-4h4l2 4 2-4h4l-4-3 2-4h-4L12 2z',
      color: '#8B5CF6',
      bg: '#8B5CF620',
    })
  }
  if (lynchLabel) {
    badges.push({
      label: `Lynch: ${lynchLabel}`,
      iconPath: 'M3 17l4-8 4 4 4-6 4 10',
      color: 'var(--color-brand-text)',
      bg: 'var(--color-brand-bg)',
    })
  }
  if (analysis.financialHealthSignal === 'improving') {
    badges.push({
      label: 'High Quality',
      iconPath: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
      color: '#F59E0B',
      bg: '#F59E0B20',
    })
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Verdict card */}
      <div
        className="flex items-center gap-3 rounded-[10px] px-3.5 py-3"
        style={{
          background: `color-mix(in srgb, ${cardBg} 60%, transparent)`,
          border: `1px solid color-mix(in srgb, ${cardBorder} 30%, transparent)`,
        }}
      >
        {/* Score badge */}
        <div
          className="flex items-center justify-center rounded-lg shrink-0"
          style={{
            width: 44,
            height: 44,
            background: scoreBg,
            border: `1.5px solid ${scoreBorder}`,
          }}
        >
          <span
            className="font-display font-bold leading-none"
            style={{ fontSize: 16, color: scoreText }}
          >
            {score}
          </span>
        </div>

        {/* Verdict text block */}
        <div className="flex flex-col gap-1 min-w-0">
          {/* Verdict + target price row */}
          <div className="flex items-center gap-2 flex-wrap">
            {verdict && (
              <span
                className="font-mono text-[11px] font-bold tracking-[0.5px]"
                style={{ color: verdictColor }}
              >
                {verdict.label}
              </span>
            )}
            {targetPrice != null && (
              <span
                className="font-mono text-[10px]"
                style={{ color: `color-mix(in srgb, ${verdictColor} 60%, transparent)` }}
              >
                · Target Rp {fmtNumID(targetPrice)}
              </span>
            )}
          </div>
          {/* Short thesis */}
          {analysis.businessNarrative && (
            <p
              className="font-body text-[10px] leading-[1.4] line-clamp-2"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {analysis.businessNarrative}
            </p>
          )}
        </div>
      </div>

      {/* Style badges row */}
      {badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {badges.map((b) => (
            <span
              key={b.label}
              className="flex items-center gap-1 font-body text-[9px] font-semibold px-2.5 py-1 rounded-md"
              style={{ color: b.color, background: b.bg }}
            >
              {/* Inline SVG icon */}
              <svg
                width="9"
                height="9"
                viewBox="0 0 24 24"
                fill="none"
                stroke={b.color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d={b.iconPath} />
              </svg>
              {b.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
