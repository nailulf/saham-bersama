'use client'

import { useState } from 'react'
import type { MarketEvent } from '@/lib/types/api'

// ─── Category config ──────────────────────────────────────────────────────────

type CatConfig = { color: string; label: string }

const CATEGORY_CONFIG: Record<string, CatConfig> = {
  index_rebalance: { color: '#7C3AED', label: 'INDEX' },
  monetary:        { color: '#FFAA00', label: 'MACRO' },
  macro_release:   { color: '#FFAA00', label: 'MACRO' },
  rerating:        { color: '#3B82F6', label: 'CORP'  },
  global:          { color: '#6B7280', label: 'GLOBAL'},
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

// ─── List view ────────────────────────────────────────────────────────────────

function EventRow({ event }: { event: MarketEvent }) {
  const { month, day } = parseDate(event.eventDate)
  const cfg = categoryConfig(event)

  return (
    <div
      className="flex items-center gap-2 rounded-[6px] px-2.5 py-2.5"
      style={{ background: 'var(--color-bg-inset)' }}
    >
      {/* Accent bar */}
      <div
        className="flex-shrink-0 w-[3px] h-[34px] rounded-[1px]"
        style={{ background: cfg.color }}
        aria-hidden="true"
      />

      {/* Date block */}
      <div className="flex flex-col items-center w-[26px] flex-shrink-0">
        <span
          className="font-display text-[13px] font-bold leading-none"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {String(day).padStart(2, '0')}
        </span>
        <span
          className="font-mono text-[7px] font-semibold mt-0.5"
          style={{ color: 'var(--color-text-dim)' }}
        >
          {MONTHS_SHORT[month - 1]}
        </span>
      </div>

      {/* Info */}
      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
        <span
          className="font-mono text-[10px] font-semibold leading-tight"
          style={{ color: '#EEEEEE' }}
        >
          {event.title}
        </span>
        {event.note && (
          <span
            className="font-mono text-[8px] leading-tight truncate"
            style={{ color: 'var(--color-text-dim)' }}
          >
            {event.note}
          </span>
        )}
      </div>

      {/* Category badge */}
      <span
        className="flex-shrink-0 font-mono text-[7px] font-bold px-[5px] py-[3px] rounded-[2px]"
        style={{
          background: `${cfg.color}22`,
          color: cfg.color,
        }}
      >
        {cfg.label}
      </span>
    </div>
  )
}

// ─── Calendar timeline view ───────────────────────────────────────────────────
// Horizontal scroll strip — only dates with events, event content shown on
// the card itself. No legend, no empty dates.

interface EventCardProps {
  event: MarketEvent
  isToday: boolean
}

function EventCard({ event, isToday }: EventCardProps) {
  const { month, day } = parseDate(event.eventDate)
  const cfg = categoryConfig(event)

  return (
    <div
      className="flex-shrink-0 w-[120px] flex flex-col rounded-[8px] overflow-hidden"
      style={{
        background: 'var(--color-bg-inset)',
        border: `1px solid ${isToday ? cfg.color : 'var(--color-border)'}`,
      }}
    >
      {/* Colored top accent bar */}
      <div className="h-[3px] w-full" style={{ background: cfg.color }} aria-hidden="true" />

      <div className="flex flex-col gap-1.5 p-3">
        {/* Date */}
        <div className="flex items-baseline gap-1.5">
          <span
            className="font-display text-[22px] font-bold leading-none tabular-nums"
            style={{ color: isToday ? cfg.color : 'var(--color-text-primary)' }}
          >
            {String(day).padStart(2, '0')}
          </span>
          <span
            className="font-mono text-[9px] font-semibold"
            style={{ color: 'var(--color-text-dim)' }}
          >
            {MONTHS_SHORT[month - 1]}
          </span>
        </div>

        {/* Category badge */}
        <span
          className="self-start font-mono text-[7px] font-bold px-[5px] py-[3px] rounded-[2px]"
          style={{
            background: `${cfg.color}22`,
            color: cfg.color,
          }}
        >
          {cfg.label}
        </span>

        {/* Event title */}
        <span
          className="font-mono text-[9px] font-semibold leading-snug"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {event.title}
        </span>

      </div>
    </div>
  )
}

interface CalendarTimelineProps {
  events: MarketEvent[]
  today: string
}

function CalendarTimeline({ events, today }: CalendarTimelineProps) {
  // Only upcoming events, sorted by date, no artificial limit
  const upcoming = events
    .filter((e) => e.eventDate >= today)
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate))

  if (upcoming.length === 0) {
    return (
      <p
        className="px-5 py-4 text-[12px]"
        style={{ color: 'var(--color-text-dim)', fontFamily: 'var(--font-inter)' }}
      >
        No upcoming events
      </p>
    )
  }

  return (
    <div className="flex gap-2.5 overflow-x-auto px-5 scrollbar-none scroll-fade-right pb-1">
      {upcoming.map((ev) => (
        <EventCard
          key={`${ev.eventDate}-${ev.title}`}
          event={ev}
          isToday={ev.eventDate === today}
        />
      ))}
    </div>
  )
}

// ─── Toggle button ────────────────────────────────────────────────────────────

interface ToggleBtnProps {
  label: string
  active: boolean
  onClick: () => void
}

function ToggleBtn({ label, active, onClick }: ToggleBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-mono text-[8px] font-bold px-2 py-1 rounded-[3px] transition-colors"
      style={
        active
          ? { background: 'var(--color-brand-bg)', color: 'var(--color-brand-text)' }
          : { background: 'var(--color-bg-inset)',  color: 'var(--color-text-ghost)' }
      }
      aria-pressed={active}
    >
      {label}
    </button>
  )
}

// ─── Market Calendar Section ──────────────────────────────────────────────────

interface MarketCalendarSectionProps {
  events: MarketEvent[]
  /** YYYY-MM-DD, computed server-side so SSR and client agree */
  today: string
}

export function MarketCalendarSection({ events, today }: MarketCalendarSectionProps) {
  const [view, setView] = useState<'list' | 'calendar'>('list')

  if (events.length === 0) return null

  const upcoming = events
    .filter((e) => e.eventDate >= today)
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate))
    .slice(0, 6)

  return (
    <section className="flex flex-col pt-4 pb-2" aria-label="Market Calendar">
      {/* Section header */}
      <div className="flex items-center justify-between px-5 mb-3">
        <span className="section-label">Market Calendar</span>

        <div className="flex items-center gap-0.5">
          <ToggleBtn label="LIST"     active={view === 'list'}     onClick={() => setView('list')}     />
          <ToggleBtn label="CALENDAR" active={view === 'calendar'} onClick={() => setView('calendar')} />
        </div>
      </div>

      {view === 'list' ? (
        <div className="flex flex-col gap-1.5 px-5">
          {upcoming.length > 0
            ? upcoming.map((ev) => <EventRow key={`${ev.eventDate}-${ev.title}`} event={ev} />)
            : (
              <p
                className="py-4 text-center text-[12px]"
                style={{ color: 'var(--color-text-dim)', fontFamily: 'var(--font-inter)' }}
              >
                No upcoming events
              </p>
            )
          }
        </div>
      ) : (
        <CalendarTimeline events={events} today={today} />
      )}
    </section>
  )
}
