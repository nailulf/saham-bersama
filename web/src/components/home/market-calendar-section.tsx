'use client'

import { useEffect, useState } from 'react'
import type { MarketEvent } from '@/lib/types/api'
import { getActiveWatchlist } from '@/lib/watchlists'

// ─── Category config ──────────────────────────────────────────────────────────

type CatConfig = { color: string; label: string }

const CATEGORY_CONFIG: Record<string, CatConfig> = {
  index_rebalance: { color: '#7C3AED', label: 'INDEX' },
  monetary:        { color: '#FFAA00', label: 'MACRO' },
  macro_release:   { color: '#FFAA00', label: 'MACRO' },
  rerating:        { color: '#3B82F6', label: 'CORP'  },
  global:          { color: '#6B7280', label: 'GLOBAL'},
  rups:            { color: '#7C3AED', label: 'RUPS'  },
  dividend:        { color: '#10B981', label: 'DIVIDEN' },
  public_expose:   { color: '#3B82F6', label: 'EXPOSE' },
  other:           { color: '#6B7280', label: 'EVENT' },
}

// Map dividend-related events (title heuristic until schema adds a dividend category)
function categoryConfig(event: MarketEvent): CatConfig {
  const t = event.title.toUpperCase()
  if (t.includes('DIVIDEN') || t.includes('EX-DATE') || t.includes('CUM-DATE')) {
    return { color: 'var(--color-brand)', label: 'DIVIDEN' }
  }
  return CATEGORY_CONFIG[event.category ?? 'other'] ?? CATEGORY_CONFIG.other
}

// Server-safe month/day formatter (no Intl locale, no toLocaleString)
const MONTHS_SHORT = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']

function parseDate(iso: string): { year: number; month: number; day: number } {
  const [y, m, d] = iso.split('-').map(Number)
  return { year: y, month: m, day: d }
}

// ─── Calendar timeline view ───────────────────────────────────────────────────
// Horizontal scroll strip — only dates with events, event content shown on
// the card itself. No legend, no empty dates.

interface DayCardProps {
  date: string            // YYYY-MM-DD
  events: MarketEvent[]   // events on this day (already capped + importance-sorted)
  isToday: boolean
}

// One card per calendar day, listing that day's events. Events are pre-sorted by
// importance, so events[0] drives the accent color.
function DayCard({ date, events, isToday }: DayCardProps) {
  const { month, day } = parseDate(date)
  const accent = categoryConfig(events[0]).color

  return (
    <div
      className="flex-shrink-0 w-[168px] flex flex-col rounded-[8px] overflow-hidden"
      style={{
        background: 'var(--color-bg-inset)',
        border: `1px solid ${isToday ? accent : 'var(--color-border)'}`,
      }}
    >
      {/* Colored top accent bar */}
      <div className="h-[3px] w-full" style={{ background: accent }} aria-hidden="true" />

      <div className="flex flex-col gap-2 p-3">
        {/* Date */}
        <div className="flex items-baseline gap-1.5">
          <span
            className="font-display text-[22px] font-bold leading-none tabular-nums"
            style={{ color: isToday ? accent : 'var(--color-text-primary)' }}
          >
            {String(day).padStart(2, '0')}
          </span>
          <span
            className="font-mono text-[9px] font-semibold"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {MONTHS_SHORT[month - 1]}
          </span>
        </div>

        {/* Events for this day */}
        <div className="flex flex-col gap-1.5">
          {events.map((ev, i) => {
            const cfg = categoryConfig(ev)
            return (
              <div
                key={`${ev.ticker ?? ev.title}-${ev.category ?? ''}-${i}`}
                className="flex items-start gap-1.5"
              >
                <span
                  className="flex-shrink-0 font-mono text-[9px] font-bold px-[5px] py-[2px] rounded-[2px]"
                  style={{ background: `${cfg.color}22`, color: cfg.color }}
                >
                  {cfg.label}
                </span>
                <span
                  className="min-w-0 font-mono text-[10px] font-semibold leading-snug break-words"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {ev.ticker ?? ev.title}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

interface CalendarTimelineProps {
  events: MarketEvent[]
  today: string
}

// Display caps to keep the strip scannable (the IDX feed can be ~hundreds/month).
const MAX_EVENTS = 100      // total cards shown (current month)
const MAX_PER_DAY = 5       // cards per calendar day

const IMPORTANCE_RANK: Record<MarketEvent['importance'], number> = { high: 0, medium: 1, low: 2 }

function CalendarTimeline({ events, today }: CalendarTimelineProps) {
  // Upcoming events, sorted by date then importance (so a capped day keeps its
  // most important events rather than dropping macro ones for corporate actions).
  const sorted = events
    .filter((e) => e.eventDate >= today)
    .sort(
      (a, b) =>
        a.eventDate.localeCompare(b.eventDate) ||
        IMPORTANCE_RANK[a.importance] - IMPORTANCE_RANK[b.importance],
    )

  // Cap to MAX_PER_DAY per day and MAX_EVENTS overall.
  const perDay = new Map<string, number>()
  const upcoming: MarketEvent[] = []
  for (const e of sorted) {
    const count = perDay.get(e.eventDate) ?? 0
    if (count >= MAX_PER_DAY) continue
    perDay.set(e.eventDate, count + 1)
    upcoming.push(e)
    if (upcoming.length >= MAX_EVENTS) break
  }

  if (upcoming.length === 0) {
    return (
      <p
        className="px-5 py-4 text-[12px]"
        style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-inter)' }}
      >
        No upcoming events
      </p>
    )
  }

  // Group the capped events into one card per day (preserving date order).
  const byDay = new Map<string, MarketEvent[]>()
  for (const e of upcoming) {
    const arr = byDay.get(e.eventDate)
    if (arr) arr.push(e)
    else byDay.set(e.eventDate, [e])
  }

  return (
    <div className="flex items-start gap-2.5 overflow-x-auto px-5 scrollbar-none scroll-fade-right pb-1">
      {[...byDay.entries()].map(([date, evs]) => (
        <DayCard key={date} date={date} events={evs} isToday={date === today} />
      ))}
    </div>
  )
}

// ─── Market Calendar Section ──────────────────────────────────────────────────

interface MarketCalendarSectionProps {
  events: MarketEvent[]
  /** YYYY-MM-DD, computed server-side so SSR and client agree */
  today: string
}

/** Stable identity for de-duping macro + top-100 + watchlist events. */
function eventKey(e: MarketEvent): string {
  return `${e.ticker ?? ''}|${e.eventDate}|${e.category ?? ''}|${e.title}`
}

export function MarketCalendarSection({ events, today }: MarketCalendarSectionProps) {
  // SSR shows macro + top-100 CA events; on mount we merge the watchlist's events.
  const [merged, setMerged] = useState<MarketEvent[]>(events)

  useEffect(() => {
    const tickers = getActiveWatchlist()?.tickers ?? []
    if (tickers.length === 0) { setMerged(events); return }

    let cancelled = false
    fetch(`/api/calendar/corporate?tickers=${encodeURIComponent(tickers.join(','))}`)
      .then((r) => (r.ok ? (r.json() as Promise<MarketEvent[]>) : []))
      .then((wl) => {
        if (cancelled) return
        const seen = new Set(events.map(eventKey))
        const extra = (wl as MarketEvent[]).filter((e) => !seen.has(eventKey(e)))
        setMerged(extra.length ? [...events, ...extra] : events)
      })
      .catch(() => { /* keep SSR events */ })

    return () => { cancelled = true }
  }, [events])

  if (merged.length === 0) return null

  return (
    <section className="flex flex-col pt-4 pb-2" aria-label="Market Calendar">
      {/* Section header */}
      <div className="flex items-center justify-between px-5 mb-3">
        <span className="section-label">Market Calendar</span>
      </div>

      <CalendarTimeline events={merged} today={today} />
    </section>
  )
}
