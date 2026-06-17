# IDX Corporate-Action Calendar Enrichment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich the home Market Calendar widget with IDX corporate-action events (RUPS, dividends, public expose, etc.) fetched **live** from IDX's public `GetCalendar` endpoint — current month only, scoped to top-100 by market cap (SSR) plus the user's watchlist (client merge), with a graceful empty-list fallback. No DB, no Python, no migration.

**Architecture:** A server-side TS helper fetches + classifies the IDX calendar (cached ~6h). The home page (`page.tsx`) merges those events — scoped to the top-100 tickers — with the existing macro `market_events` and passes them to `MarketCalendarSection`, which becomes a client component that additionally fetches the watchlist's events from a small API route and merges them on mount.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind + Terminal Dashboard tokens. No web test runner — verification is `npx tsc --noEmit` per task + `npm run build` + `design-system-review` + a manual smoke check. All commands run from `web/`.

**Spec:** `docs/superpowers/specs/2026-06-16-idx-corporate-calendar-design.md`

---

## File Structure

**Create**
- `web/src/lib/queries/idx-calendar.ts` — live IDX fetch + classify + map/filter helpers (one responsibility: the IDX calendar source).
- `web/src/app/api/calendar/corporate/route.ts` — `GET ?tickers=…` → live-fetch, filter, return `MarketEvent[]` for the client watchlist merge.

**Modify**
- `web/src/lib/types/api.ts` — extend `MarketEventCategory`; add optional `MarketEvent.ticker`.
- `web/src/lib/queries/stocks.ts` — add `getTop100Tickers()`.
- `web/src/app/page.tsx` — SSR merge of macro + scoped CA events.
- `web/src/components/home/market-calendar-section.tsx` — client conversion + watchlist merge; ticker display; category styles.

---

## Task 1: Extend the MarketEvent type

**Files:**
- Modify: `web/src/lib/types/api.ts:673-687`

- [ ] **Step 1: Add CA categories and the optional ticker field**

Find:
```ts
export type MarketEventCategory =
  | 'index_rebalance' | 'rerating' | 'monetary' | 'macro_release' | 'global' | 'other'
```
Replace with:
```ts
export type MarketEventCategory =
  | 'index_rebalance' | 'rerating' | 'monetary' | 'macro_release' | 'global' | 'other'
  | 'rups' | 'dividend' | 'public_expose'
```

Find:
```ts
export interface MarketEvent {
  eventDate: string          // YYYY-MM-DD (effective / decision date)
  title: string
  category: MarketEventCategory | null
  importance: 'high' | 'medium' | 'low'
  volatility: VolatilityLevel | null
  windowStart: string | null // YYYY-MM-DD — when the volatility window opens
  source: string | null
  note: string | null
}
```
Replace with (append `ticker`):
```ts
export interface MarketEvent {
  eventDate: string          // YYYY-MM-DD (effective / decision date)
  title: string
  category: MarketEventCategory | null
  importance: 'high' | 'medium' | 'low'
  volatility: VolatilityLevel | null
  windowStart: string | null // YYYY-MM-DD — when the volatility window opens
  source: string | null
  note: string | null
  ticker?: string            // set for per-emiten corporate-action events (IDX calendar)
}
```

- [ ] **Step 2: Type-check**

Run: `cd web && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add web/src/lib/types/api.ts
git commit -m "feat(calendar): add CA categories + ticker to MarketEvent type"
```

---

## Task 2: IDX calendar fetch/classify helper

**Files:**
- Create: `web/src/lib/queries/idx-calendar.ts`

- [ ] **Step 1: Create the helper**

```ts
// web/src/lib/queries/idx-calendar.ts
// Live, on-the-fly fetch of IDX's public corporate-action calendar
// (GET /primary/Home/GetCalendar). No persistence — cached ~6h. Any failure
// returns [] so the home calendar degrades to macro events only.
import type { MarketEvent } from '@/lib/types/api'

const IDX_CALENDAR_URL = 'https://www.idx.co.id/primary/Home/GetCalendar'
const REVALIDATE_SECONDS = 21_600 // 6 hours

export type CorporateEventType = 'rups' | 'dividend' | 'public_expose' | 'bond' | 'ipo' | 'other'

export interface CorporateCalendarEvent {
  idxId: number
  ticker: string
  eventDate: string   // YYYY-MM-DD
  eventType: CorporateEventType
  description: string
}

interface IdxCalendarRow {
  id: number
  title: string        // emiten ticker
  description: string
  Jenis: string | null
  Step: string | null
  start: string        // ISO datetime, e.g. "2026-06-30T00:00:00"
}

/** YYYYMMDD for the current date — only selects the month (range=m). */
function todayYyyymmdd(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}${m}${day}`
}

function classifyEvent(row: IdxCalendarRow): CorporateEventType {
  const desc = (row.description ?? '').toLowerCase()
  const jenis = (row.Jenis ?? '').toLowerCase()
  if (desc.includes('public expose') || desc.includes('paparan')) return 'public_expose'
  if (desc.includes('dividen')) return 'dividend'
  if (desc.includes('rups') || desc.includes('rapat umum')) return 'rups'
  if (jenis.includes('obligasi') || jenis === 'rupo' || desc.includes('obligasi')) return 'bond'
  if (jenis === 'pencatatanawal' || desc.includes('ipo')) return 'ipo'
  return 'other'
}

const CATEGORY_BY_TYPE: Record<CorporateEventType, MarketEvent['category']> = {
  rups: 'rups',
  dividend: 'dividend',
  public_expose: 'public_expose',
  bond: 'other',
  ipo: 'other',
  other: 'other',
}

/** Live-fetch the current month's IDX corporate-action calendar (all emiten). */
export async function fetchIdxCorporateCalendar(): Promise<CorporateCalendarEvent[]> {
  const url = `${IDX_CALENDAR_URL}?range=m&date=${todayYyyymmdd()}`
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        Referer: 'https://www.idx.co.id/en/listed-companies/listed-company-calendar/',
        'X-Requested-With': 'XMLHttpRequest',
      },
      next: { revalidate: REVALIDATE_SECONDS },
    })
    if (!res.ok) return []
    const data = (await res.json()) as { Results?: IdxCalendarRow[] }
    const rows = data.Results ?? []
    return rows
      .filter((r) => r && r.title && r.start)
      .map((r) => ({
        idxId: r.id,
        ticker: String(r.title).toUpperCase(),
        eventDate: String(r.start).slice(0, 10),
        eventType: classifyEvent(r),
        description: r.description ?? '',
      }))
  } catch {
    return []
  }
}

/** Map a corporate-action event to the calendar's MarketEvent shape. */
export function toMarketEvent(ce: CorporateCalendarEvent): MarketEvent {
  return {
    eventDate: ce.eventDate,
    title: ce.ticker,
    category: CATEGORY_BY_TYPE[ce.eventType],
    importance: 'medium',
    volatility: null,
    windowStart: null,
    source: 'idx_calendar',
    note: ce.description || null,
    ticker: ce.ticker,
  }
}

/** Keep only events whose ticker is in the given set. */
export function filterByTickers(
  events: CorporateCalendarEvent[],
  tickers: Set<string>,
): CorporateCalendarEvent[] {
  return events.filter((e) => tickers.has(e.ticker))
}
```

- [ ] **Step 2: Type-check**

Run: `cd web && npx tsc --noEmit`
Expected: PASS (depends on Task 1's category/ticker additions).

- [ ] **Step 3: Commit**

```bash
git add web/src/lib/queries/idx-calendar.ts
git commit -m "feat(calendar): live IDX corporate-action calendar fetch + classify helper"
```

---

## Task 3: Top-100-by-market-cap helper

**Files:**
- Modify: `web/src/lib/queries/stocks.ts` (append a new exported function; the file already imports `createClient` from `@/lib/supabase/server`)

- [ ] **Step 1: Add `getTop100Tickers()`**

Append at the end of `web/src/lib/queries/stocks.ts`:
```ts

/**
 * Tickers of the 100 largest stocks by market cap (nulls last).
 * Used to scope the IDX corporate-action calendar on the home page.
 * Returns [] on error so the calendar degrades gracefully.
 */
export async function getTop100Tickers(): Promise<string[]> {
  const sb = await createClient()
  const { data, error } = await sb
    .from('stocks')
    .select('ticker')
    .order('market_cap', { ascending: false, nullsFirst: false })
    .limit(100)
  if (error) return []
  return (data ?? []).map((r) => r.ticker as string)
}
```

- [ ] **Step 2: Verify `createClient` is imported in stocks.ts**

Run: `cd web && grep -n "import { createClient }" src/lib/queries/stocks.ts`
Expected: a line importing `createClient` from `@/lib/supabase/server`. If absent, add `import { createClient } from '@/lib/supabase/server'` at the top.

- [ ] **Step 3: Type-check**

Run: `cd web && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add web/src/lib/queries/stocks.ts
git commit -m "feat(stocks): add getTop100Tickers() for calendar scoping"
```

---

## Task 4: Watchlist API route

**Files:**
- Create: `web/src/app/api/calendar/corporate/route.ts`

- [ ] **Step 1: Create the route**

```ts
// web/src/app/api/calendar/corporate/route.ts
// GET /api/calendar/corporate?tickers=BBRI,BMRI
// Live IDX corporate-action events for the given tickers (watchlist merge).
import { NextRequest, NextResponse } from 'next/server'
import {
  fetchIdxCorporateCalendar,
  filterByTickers,
  toMarketEvent,
} from '@/lib/queries/idx-calendar'

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('tickers') ?? ''
  const tickers = new Set(
    raw.split(',').map((t) => t.trim().toUpperCase()).filter(Boolean),
  )
  if (tickers.size === 0) return NextResponse.json([])

  const all = await fetchIdxCorporateCalendar()
  const events = filterByTickers(all, tickers).map(toMarketEvent)
  return NextResponse.json(events)
}
```

- [ ] **Step 2: Type-check**

Run: `cd web && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add web/src/app/api/calendar/corporate/route.ts
git commit -m "feat(calendar): API route for watchlist corporate-action events"
```

---

## Task 5: Merge scoped CA events on the home page (SSR)

**Files:**
- Modify: `web/src/app/page.tsx`

- [ ] **Step 1: Add imports**

Find:
```ts
import { getStrategies, getStrategyMatchCount } from '@/lib/queries/strategies'
import { type ScreenerFilters } from '@/lib/queries/stocks'
import { getMarketPulse } from '@/lib/queries/market-pulse'
```
Replace with:
```ts
import { getStrategies, getStrategyMatchCount } from '@/lib/queries/strategies'
import { type ScreenerFilters, getTop100Tickers } from '@/lib/queries/stocks'
import { getMarketPulse } from '@/lib/queries/market-pulse'
import { fetchIdxCorporateCalendar, toMarketEvent } from '@/lib/queries/idx-calendar'
```

- [ ] **Step 2: Fetch CA + top-100 in parallel and merge**

Find:
```ts
  // Fetch calendar events + strategy picks in parallel
  const [{ events, volatilityAlerts }, strategyPicks] = await Promise.all([
    getMarketPulse(),
    loadStrategyPicks(),
  ])

  // Server-computed today string — SSR-safe, avoids hydration mismatch in CalendarGrid
  const today = new Date().toISOString().slice(0, 10)
```
Replace with:
```ts
  // Fetch calendar events + strategy picks + IDX corporate-action calendar in parallel
  const [{ events, volatilityAlerts }, strategyPicks, caEvents, top100] = await Promise.all([
    getMarketPulse(),
    loadStrategyPicks(),
    fetchIdxCorporateCalendar(),
    getTop100Tickers(),
  ])

  // Scope corporate-action events to the top-100 by market cap, then merge with
  // the macro market_events. (Watchlist events are merged client-side.)
  const top100Set = new Set(top100)
  const scopedCaEvents = caEvents
    .filter((e) => top100Set.has(e.ticker))
    .map(toMarketEvent)
  const calendarEvents = [...events, ...scopedCaEvents]

  // Server-computed today string — SSR-safe, avoids hydration mismatch in CalendarGrid
  const today = new Date().toISOString().slice(0, 10)
```

- [ ] **Step 3: Pass merged events to the calendar**

Find:
```tsx
      <MarketCalendarSection events={events} today={today} />
```
Replace with:
```tsx
      <MarketCalendarSection events={calendarEvents} today={today} />
```

- [ ] **Step 4: Type-check**

Run: `cd web && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/app/page.tsx
git commit -m "feat(calendar): merge top-100 IDX corporate-action events into home calendar"
```

---

## Task 6: Client watchlist merge + CA styling in the calendar component

**Files:**
- Modify: `web/src/components/home/market-calendar-section.tsx`

- [ ] **Step 1: Add the client directive and imports**

Find (top of file):
```ts
import type { MarketEvent } from '@/lib/types/api'
```
Replace with:
```ts
'use client'

import { useEffect, useState } from 'react'
import type { MarketEvent } from '@/lib/types/api'
import { getActiveWatchlist } from '@/lib/watchlists'
```

- [ ] **Step 2: Add CA category styles**

Find:
```ts
const CATEGORY_CONFIG: Record<string, CatConfig> = {
  index_rebalance: { color: '#7C3AED', label: 'INDEX' },
  monetary:        { color: '#FFAA00', label: 'MACRO' },
  macro_release:   { color: '#FFAA00', label: 'MACRO' },
  rerating:        { color: '#3B82F6', label: 'CORP'  },
  global:          { color: '#6B7280', label: 'GLOBAL'},
  other:           { color: '#6B7280', label: 'EVENT' },
}
```
Replace with:
```ts
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
```

- [ ] **Step 3: Show the ticker on CA cards**

Find:
```tsx
        {/* Event title */}
        <span
          className="font-mono text-[9px] font-semibold leading-snug"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {event.title}
        </span>
```
Replace with (ticker = bold 11px when present, else the macro title):
```tsx
        {/* Event ticker (CA events) or title (macro events) */}
        <span
          className={`font-mono leading-snug ${event.ticker ? 'text-[11px] font-bold' : 'text-[9px] font-semibold'}`}
          style={{ color: 'var(--color-text-primary)' }}
        >
          {event.ticker ?? event.title}
        </span>
```

- [ ] **Step 4: Make event keys collision-safe**

Find:
```tsx
        <EventCard
          key={`${ev.eventDate}-${ev.title}`}
          event={ev}
          isToday={ev.eventDate === today}
        />
```
Replace with:
```tsx
        <EventCard
          key={`${ev.eventDate}-${ev.ticker ?? ev.title}-${ev.category ?? ''}`}
          event={ev}
          isToday={ev.eventDate === today}
        />
```

- [ ] **Step 5: Convert the section to a client component that merges watchlist events**

Find:
```tsx
export function MarketCalendarSection({ events, today }: MarketCalendarSectionProps) {
  if (events.length === 0) return null

  return (
    <section className="flex flex-col pt-4 pb-2" aria-label="Market Calendar">
      {/* Section header */}
      <div className="flex items-center justify-between px-5 mb-3">
        <span className="section-label">Market Calendar</span>
      </div>

      <CalendarTimeline events={events} today={today} />
    </section>
  )
}
```
Replace with:
```tsx
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
```

- [ ] **Step 6: Type-check**

Run: `cd web && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add web/src/components/home/market-calendar-section.tsx
git commit -m "feat(calendar): client watchlist merge + corporate-action styling"
```

---

## Task 7: Verify — build, design-system review, manual smoke

**Files:** none (verification only; fix findings in the Task 1–6 files).

- [ ] **Step 1: Full build**

Run: `cd web && rm -rf .next && npm run build`
Expected: PASS; `/` and `/api/calendar/corporate` both present in the route list, no type errors.

- [ ] **Step 2: design-system-review**

Invoke the `design-system-review` skill on `web/src/components/home/market-calendar-section.tsx`. Resolve any FAIL. Expected notes: the new `CATEGORY_CONFIG` entries use raw hex to match the file's existing categorical palette (pre-existing pattern); CA category labels are 9px mono on tinted bg (≥4.5:1). No new SSR violation (the watchlist merge is in `useEffect`; `today` is a prop).

- [ ] **Step 3: Manual smoke (live IDX)**

Run: `cd web && npm run dev`, then:
1. `curl -s "http://localhost:3000/api/calendar/corporate?tickers=BBRI,BMRI,TLKM" | head -c 400` → JSON array of `MarketEvent` objects with `ticker`/`category` (or `[]` if IDX blocked this month for those tickers).
2. Open `http://localhost:3000/` → the Market Calendar strip shows corporate-action cards (ticker + RUPS/DIVIDEN/EXPOSE badge) alongside any macro events, scoped to top-100. With a watchlist set in localStorage, its tickers' events appear after mount.
3. Confirm the page still renders if IDX is unreachable: temporarily point `IDX_CALENDAR_URL` at a bad host → the calendar shows macro-only, no error. Revert.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(calendar): resolve review + smoke findings"
```

---

## Self-Review Notes (author)

- **Spec coverage:** live fetch/classify (Task 2), no-DB/cached (Task 2 `revalidate`), current-month-only (`todayYyyymmdd` + `range=m`, Task 2), top-100 SSR scope (Tasks 3+5), watchlist client merge (Tasks 4+6), graceful `[]` fallback (Task 2 try/catch + Task 6 `.catch`), MarketEvent `ticker`/categories (Task 1), CA styling (Task 6), Vercel-block risk handled by fallback (Task 7 step 3). All spec sections map to a task.
- **No persistence/Python/migration:** intentional, per spec.
- **Type consistency:** `fetchIdxCorporateCalendar`, `toMarketEvent`, `filterByTickers` defined in Task 2 and consumed identically in Tasks 4 & 5; `getTop100Tickers` defined Task 3, used Task 5; `MarketEvent.ticker` defined Task 1, used in Tasks 2/6. `eventKey` defined and used within Task 6.
- **No web tests** exist; verification is tsc + build + design-system-review + manual smoke (honest gate for this codebase).
