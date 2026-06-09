interface SkeletonProps {
  className?: string
}

// Skeletons use design tokens so they render correctly in both dark and light
// themes. `--color-bg-inset` is the design-system's prescribed skeleton fill.
export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`animate-pulse rounded bg-[var(--color-bg-inset)] ${className}`} />
}

export function MetricCardSkeleton() {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5">
      <Skeleton className="h-3 w-20 mb-2" />
      <Skeleton className="h-8 w-28" />
    </div>
  )
}

export function TableRowSkeleton({ cols = 7 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  )
}

export function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div
      className="animate-pulse rounded-xl w-full bg-[var(--color-bg-inset)]"
      style={{ height }}
    />
  )
}
