# DB-backed IDX Corporate-Action Calendar — Design Spec

**Date:** 2026-06-17
**Status:** Approved (design), pending implementation plan
**Sub-project:** A of the "Vercel-blocked external fetch" fix. (B = Yahoo analyst consensus, separate spec.)
**Supersedes:** the on-the-fly approach in `2026-06-16-idx-corporate-calendar-design.md` (that approach fails in production — see Root cause).

## Root cause (why the on-the-fly version failed in prod)

Vercel serverless functions egress from datacenter IPs. IDX's WAF only admits requests with a real browser TLS fingerprint — our Python scrapers pass because `curl_cffi` impersonates Chrome; a Node `fetch` from Vercel does not, and is blocked. (It worked in local testing only because that was a residential IP.) The graceful `[]` fallback then makes the home calendar show macro events only. The same class of block hits the Yahoo analyst route. Conclusion: the external fetch must happen in the **Python data-acquisition layer** (curl_cffi, off Vercel), with the web reading from Supabase.

## Goal

Replace the live IDX fetch with a scheduled Python scraper that stores IDX corporate-action events in Supabase; the web reads from the DB. Reliable in production; freshness = cron cadence (daily is ample for scheduled corporate actions). Reuses the existing display layer unchanged.

## Decisions (locked)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Where the fetch runs | Python scraper (`curl_cffi` via `idx_client`), on GitHub Actions cron / owner's machine. Never from Vercel. |
| 2 | Storage | New Supabase table `corporate_calendar`. |
| 3 | Scrape window | **Current month only** (one `GetCalendar` call, all emiten). |
| 4 | Override on re-scrape | Each run **replaces** the scraped month's rows (delete the month's rows, then insert fresh) so cancelled/edited events don't linger. |
| 5 | Retention | Each run **prunes** rows with `event_date < today − 12 months`. |
| 6 | Web layer | Reads `corporate_calendar` from Supabase. Display layer (clubbing, 4-row + "+N more", tap-to-open bottom sheet, uniform chips, top-100 + watchlist scoping) is unchanged — only the data source swaps. |

## The IDX endpoint (verified 2026-06-16)

`GET https://www.idx.co.id/primary/Home/GetCalendar?range=m&date=YYYYMMDD` (needs `curl_cffi impersonate="chrome"` + IDX headers). One call returns the whole month, all emiten. Per-row fields: `id` (stable agenda id → PK), `title` (ticker), `description`, `Jenis`, `Step`, `start` (ISO date), `TglWaktuRups`, `TglWaktuPE` (`1911-...` = none). June 2026 keyword spread: RUPS 853, dividen 763, public expose 314, obligasi 8, IPO 2.

## Architecture / data flow

```
GitHub Actions cron (or owner's machine)
  └── run_all.py → idx_calendar.run()
        ├── idx_client.get_calendar(range='m', date=today)   # curl_cffi, beats WAF
        ├── classify each row → event_type
        ├── DELETE corporate_calendar WHERE event_date in [month_start, month_end]   # override
        ├── INSERT fresh rows
        └── DELETE corporate_calendar WHERE event_date < today − 12 months           # retention
                              │ Supabase
                              ▼
Vercel web  ──  getCorporateCalendar(tickers) → SELECT from corporate_calendar
                              ▼
        page.tsx (top-100 scope) + /api/calendar/corporate (watchlist) + display layer (unchanged)
```

## Components & files

**Create**
- `python/scrapers/idx_calendar.py` — the scraper. `run() -> RunResult`: fetch current month, parse + classify, delete-month + insert (override), prune >12mo. Idempotent. Classification heuristic ported from the TS version (rups/dividend/public_expose/bond/ipo/other from `Jenis`/`Step`/`description`).
- `docs/schema-v{N}-corporate-calendar.sql` — the table migration (N = next free number on `main`, ~v37; verify before applying).

**Modify**
- `python/utils/idx_client.py` — add `get_calendar(self, range: str = 'm', date: str | None = None) -> list[dict]` hitting `/Home/GetCalendar`, returning `Results`. Mirrors the existing IDX methods (curl_cffi, headers, rate-limit).
- `python/run_all.py` — register `idx_calendar` as a daily step (public → CI-safe), following the existing job_id / RunResult / skip pattern.
- `web/src/lib/queries/idx-calendar.ts` — **remove** the HTTP fetch + TS classifier; replace with `getCorporateCalendar(tickers: string[]): Promise<MarketEvent[]>` — a Supabase query: `select ... from corporate_calendar where ticker = ANY(tickers) and event_date >= today order by event_date`, mapped to `MarketEvent` (category from `event_type`, `ticker`, `note` = title/description). Keep the `MarketEvent`/category types from the prior change.
- `web/src/app/page.tsx` — unchanged in shape; `fetchIdxCorporateCalendar()` call becomes `getCorporateCalendar(top100)`.
- `web/src/app/api/calendar/corporate/route.ts` — unchanged in shape; calls `getCorporateCalendar(tickers)` (DB) instead of live fetch + filter.

**Unchanged**: `market-calendar-section.tsx` (all display logic), the `MarketEvent` type additions, the top-100 helper.

## Schema — `corporate_calendar`

```sql
CREATE TABLE IF NOT EXISTS corporate_calendar (
  idx_id       BIGINT PRIMARY KEY,         -- stable IDX agenda id
  ticker       TEXT NOT NULL,
  event_date   DATE NOT NULL,
  event_type   TEXT NOT NULL,              -- rups | dividend | public_expose | bond | ipo | other
  jenis        TEXT,
  step         TEXT,
  title        TEXT,                        -- IDX description
  location     TEXT,
  rups_at      TIMESTAMPTZ,                 -- null when 1911 sentinel
  pe_at        TIMESTAMPTZ,                 -- null when 1911 sentinel
  source       TEXT DEFAULT 'idx_getcalendar',
  last_updated TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_corpcal_event_date ON corporate_calendar (event_date);
CREATE INDEX IF NOT EXISTS idx_corpcal_ticker     ON corporate_calendar (ticker);
-- RLS: public read (anon), matching market_events.
```

## Scraper algorithm (per run)

1. `date = today` (YYYYMMDD). `rows = idx_client.get_calendar('m', date)`.
2. Parse each row → `{idx_id, ticker=title.upper(), event_date=start[:10], event_type=classify(row), jenis, step, title=description, location, rups_at, pe_at}`. `rups_at`/`pe_at`: parse the datetime unless it starts with `1911` → null.
3. Compute `[month_start, month_end]` from `date`.
4. **Override**: `DELETE FROM corporate_calendar WHERE event_date BETWEEN month_start AND month_end`, then bulk-insert the fresh rows **with `ON CONFLICT (idx_id) DO UPDATE`** (defensive — handles the rare case where IDX returns an agenda whose `event_date` falls outside the deleted month, so the insert never PK-collides).
5. **Retention**: `DELETE FROM corporate_calendar WHERE event_date < (today − interval '12 months')`.
6. Return `RunResult` with counts.

Rationale for delete-by-month + insert (vs. pure upsert): IDX may remove/cancel an agenda; delete-then-insert makes the latest scrape authoritative for the month, which pure upsert-on-`idx_id` can't (it would leave orphaned removed events).

## Web query (replaces the live fetch)

`getCorporateCalendar(tickers)` → Supabase `corporate_calendar` filtered to `ticker = ANY(tickers)` and `event_date >= today`, mapped to `MarketEvent` (`category` from `event_type`, `ticker` set, `note` = `title`). Runs on Vercel as a normal DB read. SSR scopes to top-100; the API route scopes to watchlist tickers — same call, different ticker list.

## Risks / notes

- **Migration number**: assign the next free `schema-v{N}` against `main` at apply time (~v37). Migrations are applied manually via the Supabase SQL editor.
- **GH Actions + curl_cffi**: IDX scrapers already run there per the project's "where it runs" table — proven to beat the WAF from datacenter IPs.
- **First-run gap**: until the scraper runs at least once (and the migration is applied), the web shows macro-only — no worse than today. Document the run order in the plan.
- **Classification** stays heuristic (v1); raw `title`/`jenis`/`step` retained for later refinement.

## Out of scope

- Yahoo analyst consensus (sub-project B).
- Multi-month lookahead (current month only, per decision #3).
- Changes to the calendar display/UX (already shipped).
- The existing `corporate_events` table / scraper (separate source, untouched).
