/**
 * Sparkline — pure-CSS 7-bar mini chart.
 * Heights are passed as normalized 0–1 values; the component scales them to
 * fit inside the container height. No library dependency.
 *
 * SSR-safe: no browser APIs, no Date, no random. Pure arithmetic.
 */

interface SparklineProps {
  /** 7 normalised values (0–1). Missing/null entries render at 0. */
  values: (number | null)[]
  /** Overall direction determines bar color. */
  positive: boolean
  /** Container height in px. Default 20. */
  height?: number
}

export function Sparkline({ values, positive, height = 20 }: SparklineProps) {
  const MAX_BARS = 7
  const bars = Array.from({ length: MAX_BARS }, (_, i) => {
    const v = values[i] ?? 0
    // Clamp to [0.1, 1] so even 0-value bars are slightly visible
    return Math.max(0.1, Math.min(1, v))
  })

  const barColor = positive ? 'var(--color-brand-bg)' : 'var(--color-negative-bg)'

  return (
    <div
      className="flex items-end gap-px w-full"
      style={{ height }}
      aria-hidden="true"
    >
      {bars.map((ratio, i) => (
        <div
          key={i}
          className="flex-1 rounded-[1px]"
          style={{
            height: `${Math.round(ratio * height)}px`,
            background: barColor,
          }}
        />
      ))}
    </div>
  )
}

// ─── Placeholder (API gap: sparkline data not yet available) ──────────────────

/** Renders a static placeholder sparkline using canned heights. */
export function SparklinePlaceholder({ positive }: { positive: boolean }) {
  // Canned heights mimic the design: [10, 14, 11, 17, 13, 18, 15] / 20
  const CANNED = [0.5, 0.7, 0.55, 0.85, 0.65, 0.9, 0.75]
  return <Sparkline values={CANNED} positive={positive} />
}
