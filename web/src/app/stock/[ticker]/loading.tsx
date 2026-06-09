import { Skeleton } from '@/components/ui/loading-skeleton'

/**
 * Loading skeleton for the stock detail page. Mirrors the real above-the-fold
 * structure — sticky HeroBar (ticker row + stats pill + verdict strip), NavTabs,
 * and the first overview cards — so the transition to the rendered page has no
 * layout shift. Uses design tokens, so it renders correctly in both themes.
 */
export default function StockLoading() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg-page)' }}>

      {/* ── HeroBar ──────────────────────────────────────────────────────── */}
      <div
        className="px-3 md:px-4 pt-3 pb-4 flex flex-col gap-2.5"
        style={{ background: 'var(--color-bg-card)', borderBottom: '1px solid var(--color-border)' }}
      >
        {/* Ticker row */}
        <div className="flex items-start justify-between gap-3">
          {/* Left: ticker + name + chips */}
          <div className="flex flex-col gap-1 min-w-0">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-3 w-40" />
            <div className="flex gap-1.5 mt-0.5">
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-3.5 w-12" />
            </div>
          </div>
          {/* Right: price + change + date */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        </div>

        {/* Stats pill — 4 columns */}
        <div
          className="flex items-stretch rounded-lg overflow-hidden"
          style={{ background: 'var(--color-bg-inset)', border: '1px solid var(--color-border-subtle)', padding: '7px 0' }}
        >
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center" style={{ flex: 1 }}>
              {i > 0 && <div className="self-stretch shrink-0" style={{ width: 1, background: 'var(--color-border)' }} />}
              <div className="flex flex-col items-center gap-1.5" style={{ flex: 1 }}>
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-2 w-8" />
              </div>
            </div>
          ))}
        </div>

        {/* AI verdict strip */}
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>

      {/* ── NavTabs ──────────────────────────────────────────────────────── */}
      <div
        className="flex px-2 gap-1 overflow-hidden"
        style={{ background: 'var(--color-bg-card)', borderBottom: '1px solid var(--color-border)' }}
      >
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="px-4 py-[11px]" style={i === 0 ? { borderBottom: '2px solid var(--color-brand)' } : undefined}>
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>

      {/* ── Overview cards ───────────────────────────────────────────────── */}
      <div className="px-3 md:px-4 py-3 flex flex-col gap-3">
        {/* AI insights (Skenario & Risiko) */}
        <div
          className="rounded-xl p-4 flex flex-col gap-3"
          style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-card)' }}
        >
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-14 rounded-lg" />
            <Skeleton className="h-14 rounded-lg" />
            <Skeleton className="h-14 rounded-lg" />
          </div>
        </div>
        {/* Analyst insight */}
        <div
          className="rounded-xl p-4 flex flex-col gap-3"
          style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-card)' }}
        >
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
    </div>
  )
}
