/**
 * ScoreBox — 36×36 coloured score tile used in Strategy Picks and Screener rows.
 *
 * Score tiers (from design):
 *   ≥ 85  →  brand  (green in both themes)
 *   75–84 →  warning (amber)
 *   < 75  →  neutral (gray)
 *
 * Dark theme adds a 1px coloured border; light theme has no border.
 * Font: JetBrains Mono in dark, Space Grotesk in light (handled via CSS class).
 */

interface ScoreBoxProps {
  score: number
  size?: number
}

type ScoreTier = 'brand' | 'warning' | 'neutral'

function tier(score: number): ScoreTier {
  if (score >= 85) return 'brand'
  if (score >= 75) return 'warning'
  return 'neutral'
}

// Returns inline style objects using CSS variables so both themes work
function tierStyle(t: ScoreTier): { bg: string; text: string; border: string } {
  switch (t) {
    case 'brand':
      return {
        bg:     'var(--color-brand-bg)',
        text:   'var(--color-brand-text)',
        border: 'var(--color-brand-bg)',  // dark: 40% opacity applied via alpha in token
      }
    case 'warning':
      return {
        bg:     'var(--color-warning-bg)',
        text:   'var(--color-warning-text)',
        border: 'var(--color-warning-bg)',
      }
    case 'neutral':
      return {
        bg:     'var(--color-neutral-bg)',
        text:   'var(--color-neutral-text)',
        border: 'var(--color-neutral-bg)',
      }
  }
}

export function ScoreBox({ score, size = 36 }: ScoreBoxProps) {
  const t = tier(score)
  const s = tierStyle(t)

  return (
    <div
      className="flex-shrink-0 flex items-center justify-center rounded-lg score-box-font"
      style={{
        width: size,
        height: size,
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.text,
        fontSize: 11,
        fontWeight: 700,
      }}
      aria-label={`Score ${score}`}
    >
      {score}
    </div>
  )
}
