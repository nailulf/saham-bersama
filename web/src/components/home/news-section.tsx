import Link from 'next/link'
import { getMarketPulse } from '@/lib/queries/market-pulse'
import type { MarketNewsItem } from '@/lib/types/api'

const VISIBLE_ROWS = 5

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(iso: string | null): string {
  if (!iso) return ''
  const diffMs = Date.now() - Date.parse(iso)
  const diffH = Math.floor(diffMs / 3_600_000)
  if (diffH < 1) return `${Math.floor(diffMs / 60_000)}m lalu`
  if (diffH < 24) return `${diffH}j lalu`
  return `${Math.floor(diffH / 24)}h lalu`
}

function newsTag(item: MarketNewsItem): string {
  return item.source?.toUpperCase().slice(0, 8) ?? 'NEWS'
}

// ─── News Row (vertical list) ─────────────────────────────────────────────────

function NewsRow({ item, featured }: { item: MarketNewsItem; featured: boolean }) {
  const tag = newsTag(item)

  return (
    <Link
      href={item.link ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 px-5 py-3.5 no-underline"
      style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
    >
      <div
        className="flex-shrink-0 w-[3px] h-9 rounded-[2px]"
        style={{ background: featured ? 'var(--color-brand)' : 'var(--color-border)' }}
        aria-hidden="true"
      />
      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded"
            style={{
              background: featured ? 'var(--color-brand-bg)' : 'var(--color-bg-inset)',
              color: featured ? 'var(--color-brand-text)' : 'var(--color-text-dim)',
              fontFamily: 'var(--font-jetbrains-mono)',
              letterSpacing: '0.5px',
            }}
          >
            {tag}
          </span>
          <span
            className="text-[10px]"
            style={{ color: 'var(--color-text-ghost)', fontFamily: 'var(--font-inter)' }}
          >
            {relativeTime(item.publishedAt)}
          </span>
        </div>
        <p
          className="text-[12px] font-medium leading-snug line-clamp-2 m-0"
          style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-inter)' }}
        >
          {item.title}
        </p>
      </div>
    </Link>
  )
}

// ─── News Card (horizontal scroll) ───────────────────────────────────────────

function NewsCard({ item }: { item: MarketNewsItem }) {
  const tag = newsTag(item)

  return (
    <Link
      href={item.link ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="flex-shrink-0 w-[160px] flex flex-col gap-2 rounded-[8px] p-3 no-underline"
      style={{
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
      }}
    >
      {/* Tag + time */}
      <div className="flex items-center gap-1.5">
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded"
          style={{
            background: 'var(--color-bg-inset)',
            color: 'var(--color-text-dim)',
            fontFamily: 'var(--font-jetbrains-mono)',
            letterSpacing: '0.5px',
          }}
        >
          {tag}
        </span>
        <span
          className="text-[9px]"
          style={{ color: 'var(--color-text-ghost)', fontFamily: 'var(--font-inter)' }}
        >
          {relativeTime(item.publishedAt)}
        </span>
      </div>

      {/* Headline — 3 lines max */}
      <p
        className="text-[11px] font-medium leading-snug line-clamp-3 m-0 flex-1"
        style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-inter)' }}
      >
        {item.title}
      </p>
    </Link>
  )
}

// ─── News Section ─────────────────────────────────────────────────────────────

export async function NewsSection() {
  const { news } = await getMarketPulse()

  if (news.length === 0) return null

  const topRows  = news.slice(0, VISIBLE_ROWS)
  const moreCards = news.slice(VISIBLE_ROWS)

  return (
    <section className="flex flex-col pt-4" aria-label="Market News">
      {/* Section header */}
      <div className="flex items-center justify-between px-5 mb-3">
        <span className="section-label">Market News</span>
        <span
          className="text-[10px] font-medium"
          style={{ color: 'var(--color-brand)', fontFamily: 'var(--font-inter)' }}
        >
          See all →
        </span>
      </div>

      {/* Top 5 as vertical rows */}
      <div style={{ background: 'var(--color-bg-card)' }}>
        {topRows.map((item, i) => (
          <NewsRow key={item.id} item={item} featured={i === 0} />
        ))}
      </div>

      {/* Remaining as horizontal scroll cards */}
      {moreCards.length > 0 && (
        <div className="flex gap-2.5 overflow-x-auto px-5 scrollbar-none scroll-fade-right py-3">
          {moreCards.map((item) => (
            <NewsCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  )
}
