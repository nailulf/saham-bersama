# IDX Corporate-Action Calendar Enrichment — Design Spec

**Date:** 2026-06-16
**Status:** Approved (design), pending implementation plan
**Scope:** Web-only. No Python, no DB, no schema change.

## Goal

Enrich the home **Market Calendar** widget with IDX corporate-action events (RUPS/AGM, dividends, public expose, and other CA) fetched **live** from IDX's public calendar endpoint. This is **content enrichment only** — the data is not stored and not yet consumed by any other feature, so it must never break the page if the source is unavailable.

## Decisions (locked)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Source | IDX public `GET /primary/Home/GetCalendar?range=m&date=YYYYMMDD` (no token, no IP binding). |
| 2 | Storage | **None — on-the-fly live fetch**, cached ~6h. No DB table, no Python scraper, no migration, no `run_all` change. |
| 3 | Window | **Current (ongoing) month only** — a single `GetCalendar` call with `date = today (YYYYMMDD)`. |
| 4 | Scope / surface | Enrich the **home Market Calendar widget** only. Scope = **top-100 by market cap (SSR)** + **watchlist (client merge)**. |
| 5 | Failure mode | Graceful: any fetch/parse error → empty list → widget shows macro events only. Never an error state. |

## The IDX endpoint (verified 2026-06-16)

`GET https://www.idx.co.id/primary/Home/GetCalendar?range=m&date=20260616`

Requires browser-like headers (`User-Agent`, `Referer: https://www.idx.co.id/en/listed-companies/listed-company-calendar/`, `X-Requested-With: XMLHttpRequest`). One call returns the **whole month, all emiten** (~2,121 rows for June 2026, no pagination needed). Response:

```jsonc
{
  "request": { "range": "m", "date": "20260616", "code": null, ... },
  "ResultCount": 2121,
  "Results": [
    {
      "id": 200528,                         // stable IDX agenda id
      "title": "MTEL",                      // TICKER
      "description": "Pemberitahuan RUPS Rencana PT Dayamitra Telekomunikasi Tbk",
      "Jenis": "Rencana",                   // type/subtype
      "Step": "rencana",                    // stage (rencana/pgl/hsl)
      "start": "2026-06-30T00:00:00",       // event date
      "TglWaktuRups": "2026-06-30T14:00:00",// RUPS datetime (1911 = none)
      "TglWaktuPE": "1911-01-01T00:00:00",  // public-expose datetime (1911 = none)
      "location": "...",
      "MonthName": "June", "MonthNumber": 6, "Year": 2026
    }
  ]
}
```

Field meaning: `title` = ticker, `start` = date, `description` = free text (company + event), `id` = stable id (dedup key). Event type is **not a single clean field** — it is inferred from `Jenis`/`Step`/`description` keywords. June keyword spread: RUPS 853, dividen 763, public expose 314, obligasi 8, IPO 2.

## Architecture / data flow

```
Home page (server)
  ├── getMarketPulse()  →  macro market_events  (unchanged)
  ├── fetchIdxCorporateCalendar()  →  live IDX GetCalendar (current month)
  │       ├── parse Results → classify → CorporateCalendarEvent[]
  │       └── try/catch → []  on any failure  (graceful)
  ├── top-100 tickers  ←  stocks query (market_cap desc limit 100)
  └── merge: macro events + CA events filtered to top-100  →  MarketEvent[]
        → <MarketCalendarSection initialEvents=…>   (SSR)
              └── (client) on mount: read localStorage watchlist →
                  GET /api/calendar/corporate?tickers=…  → merge watchlist CA events
```

## Components & files

**Create**
- `web/src/lib/queries/idx-calendar.ts` — the live fetch + parse + classify layer:
  - `type CorporateCalendarEvent = { idxId: number; ticker: string; eventDate: string; eventType: 'rups'|'dividend'|'public_expose'|'bond'|'ipo'|'other'; title: string; jenis: string|null; step: string|null }`
  - `async function fetchIdxCorporateCalendar(): Promise<CorporateCalendarEvent[]>` — current-month call, browser headers, `fetch(url, { next: { revalidate: 21600 } })`, `try/catch → []`. Today's `YYYYMMDD` is computed server-side (no `new Date()` in render — this runs in a server function, not a component).
  - `function classifyEvent(r): eventType` — keyword/Jenis heuristic.
  - `function filterByTickers(events, tickers): CorporateCalendarEvent[]` — scoping helper.
- `web/src/app/api/calendar/corporate/route.ts` — `GET ?tickers=A,B,C` → runs `fetchIdxCorporateCalendar()`, filters to the given tickers, returns `MarketEvent[]`-shaped JSON. Used by the client watchlist merge.

**Modify**
- `web/src/lib/types/api.ts` — `MarketEvent` gains optional **`ticker?: string`**; `MarketEventCategory` gains `'rups' | 'dividend' | 'public_expose'` (bond/ipo map to existing `'other'`).
- Home page `web/src/app/page.tsx` — the merge happens here (keeps `getMarketPulse()` focused/unchanged). `Promise.all([getMarketPulse(), fetchIdxCorporateCalendar(), getTop100Tickers()])`, then scope CA events to the top-100 set and concatenate with the macro events before passing to `MarketCalendarSection`. The CA→MarketEvent mapping sets `ticker`, `category`, `importance: 'medium'`, `source: 'idx_calendar'`, `title` = `<ticker> — <short description>`. `getTop100Tickers()` is a small new helper (a `stocks` select `ticker` order by `market_cap desc` limit 100) added to `web/src/lib/queries/stocks.ts`.
- `web/src/components/home/market-calendar-section.tsx` — the timeline becomes a **client** component again (reversing the recent server-only conversion) so it can merge watchlist events on mount:
  - Takes `initialEvents` (SSR: macro + top-100 CA) as props.
  - On mount: read localStorage watchlist (via `lib/watchlists.ts`), and if there are watchlist tickers, `GET /api/calendar/corporate?tickers=…`, merge + dedupe (by `idxId`, falling back to `ticker+date+title`) + re-sort.
  - `CATEGORY_CONFIG` gains `dividend` (`--color-brand`), `rups` (purple `#7C3AED`/cat-purple), `public_expose` (blue `#3B82F6`/cat-blue). For CA events the calendar card renders `event.ticker` as the prominent label (macro events have no ticker and keep their title-only layout).

## Classification heuristic (v1)

From `description` (lowercased) + `Jenis`/`Step`:
- contains `public expose` / `paparan` → `public_expose`
- contains `dividen` → `dividend`
- contains `rups` / `rapat umum` → `rups`
- `Jenis == 'obligasiJatuhTempo'` or `'rupo'` or `obligasi` in desc → `bond`
- `Jenis == 'pencatatanAwal'` or `ipo` in desc → `ipo`
- else → `other`

A single agenda may carry both a RUPS and a PE date; v1 classifies by the dominant keyword (public_expose > dividend > rups precedence) and keeps it simple. Refinement deferred.

## Design-system conformance

CA event rows follow the existing `EventRow`/calendar-card styling and the Terminal Dashboard rules: category dot/badge via the new `CATEGORY_CONFIG` token colors; ticker in `font-display`/`font-mono` per the calendar card; reading text ≥12px; no raw hex beyond the established category palette already used in `CATEGORY_CONFIG` (which uses hex constants today — match that existing pattern, or map to `--color-cat-*` tokens where available). Run `design-system-review` on the changed calendar component before ship.

## Risks / constraints

- **Vercel may be blocked by IDX's WAF** (datacenter IP / TLS fingerprint) even though a browser-header `fetch` works from a dev machine. Mitigation: the graceful `[]` fallback means the widget degrades to macro-only, never errors. If it proves blocked in production, the deferred DB-scraper path is the robust fallback — out of scope here.
- **No SSR hydration risk:** `today` is computed in the server fetch function, not in a component render; the client watchlist merge runs in `useEffect` after mount; numbers use existing formatters.
- **IDX response is ~2k rows/month** — parsed server-side once per ~6h (cached), filtered before reaching the client. The watchlist API route filters server-side too.
- **Classification is heuristic** — acceptable for enrichment; raw `description` retained in the event `title` for transparency.

## Out of scope

- Persisting events to Supabase, any Python scraper, `run_all` registration, schema migration.
- Multi-month lookahead (current month only).
- A dedicated full all-emiten calendar page; per-stock CA timelines.
- Earnings-call dates (IDX GetCalendar does not expose them; would need Stockbit, deferred).
