# DB-backed IDX Corporate-Action Calendar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the IDX corporate-action calendar fetch out of the Vercel web layer (where it's WAF-blocked) into the Python data-acquisition pipeline: a scheduled scraper (`curl_cffi`) stores events in a new Supabase `corporate_calendar` table; the web reads from the DB.

**Architecture:** `idx_client.get_calendar()` (curl_cffi, beats IDX's WAF) → `scrapers/idx_calendar.py` parses/classifies and writes to `corporate_calendar` (override the scraped month + prune >12 months) → registered as a daily step in `run_all.py` → the web's `idx-calendar.ts` swaps its live HTTP fetch for a Supabase query. The display layer is untouched.

**Tech Stack:** Python 3.10+ (curl_cffi, supabase client, tenacity, dateutil, pytest), Next.js 16 + TypeScript + Supabase JS.

**Spec:** `docs/superpowers/specs/2026-06-17-idx-calendar-db-design.md`

**Verification:** Python has pytest (`cd python && python -m pytest`). Web has no test runner — `cd web && npx tsc --noEmit` + manual. The scraper's network/DB path is verified by a real run (Task 7); pure helpers are unit-tested.

---

## File Structure

**Create**
- `python/scrapers/idx_calendar.py` — scraper: fetch current month, classify, override-month + insert, prune >12mo.
- `python/tests/test_idx_calendar.py` — unit tests for the pure helpers (`_classify_event`, `_parse_row`).
- `docs/schema-v37-corporate-calendar.sql` — the table migration (verify v37 is the next free number on `main` at apply time).

**Modify**
- `python/utils/idx_client.py` — add `get_calendar()`.
- `python/run_all.py` — add a lazy import + a daily step.
- `web/src/lib/queries/idx-calendar.ts` — replace the live HTTP fetch with a Supabase query `getCorporateCalendar(tickers)`.
- `web/src/app/page.tsx` — call `getCorporateCalendar(top100)` instead of `fetchIdxCorporateCalendar()` + manual map.
- `web/src/app/api/calendar/corporate/route.ts` — call `getCorporateCalendar(tickers)`.

---

## Task 1: Add `get_calendar()` to the IDX client

**Files:**
- Modify: `python/utils/idx_client.py` (add a method; uses the existing `_get` helper + `IDX_BASE_URL`)

- [ ] **Step 1: Add the method**

Add after `get_public_expose_list` (anywhere among the public methods):
```python
    def get_calendar(self, range: str = "m", date: str | None = None) -> list[dict]:
        """
        Fetch the IDX listed-company corporate-action calendar (all emiten).

        Endpoint: GET /primary/Home/GetCalendar?range=m&date=YYYYMMDD
        `range='m'` returns the whole month containing `date`. One call covers
        every emiten with an agenda that month.

        Response shape (best-effort — no official docs):
            { "ResultCount": N, "Results": [
                { "id": 200528, "title": "MTEL",            # title == ticker
                  "description": "Pemberitahuan RUPS ...",
                  "Jenis": "Rencana", "Step": "rencana",
                  "start": "2026-06-30T00:00:00",
                  "TglWaktuRups": "2026-06-30T14:00:00",    # 1911-... == none
                  "TglWaktuPE": "1911-01-01T00:00:00" } ] }

        Returns [] if the endpoint is unavailable.
        """
        if date is None:
            date = _dt.date.today().strftime("%Y%m%d")
        url = f"{IDX_BASE_URL}/Home/GetCalendar"
        params = {"range": range, "date": date}
        try:
            data = self._get(url, params)
            return data.get("Results", []) if isinstance(data, dict) else []
        except Exception:
            logger.debug("GetCalendar endpoint unavailable (range=%s date=%s)", range, date)
            return []
```

- [ ] **Step 2: Ensure the `datetime` import alias exists**

At the top of `python/utils/idx_client.py`, confirm there is an import for the standard `datetime` module. If `import datetime as _dt` is not already present, add it near the other stdlib imports (the method above uses `_dt.date.today()`).

Run: `cd python && grep -n "^import datetime\|import datetime as" utils/idx_client.py`
If absent, add `import datetime as _dt` with the other imports.

- [ ] **Step 3: Smoke-test the live call (public endpoint)**

Run:
```bash
cd python && python -c "from utils.idx_client import IDXClient; r=IDXClient().get_calendar('m'); print('rows', len(r)); print(r[0]['title'], r[0]['description'][:40]) if r else print('EMPTY')"
```
Expected: `rows <N>` (hundreds) and a sample ticker + description. (This is the curl_cffi path — it should succeed from any IP.)

- [ ] **Step 4: Commit**

```bash
git add python/utils/idx_client.py
git commit -m "feat(idx_client): add get_calendar() for the corporate-action calendar"
```

---

## Task 2: Schema migration for `corporate_calendar`

**Files:**
- Create: `docs/schema-v37-corporate-calendar.sql`

- [ ] **Step 1: Verify the next migration number on main**

Run: `ls docs/schema-v*.sql | sed -E 's/.*schema-v([0-9]+).*/\1/' | sort -n | tail -3`
If `37` is already taken, name the file with the next free number and adjust references below.

- [ ] **Step 2: Create the migration**

```sql
-- docs/schema-v37-corporate-calendar.sql
-- IDX corporate-action calendar (RUPS, dividends, public expose, etc.)
-- Populated by python/scrapers/idx_calendar.py from /primary/Home/GetCalendar.
-- Read by the web home Market Calendar widget.

CREATE TABLE IF NOT EXISTS corporate_calendar (
  idx_id       BIGINT PRIMARY KEY,          -- stable IDX agenda id
  ticker       TEXT NOT NULL,
  event_date   DATE NOT NULL,
  event_type   TEXT NOT NULL,               -- rups | dividend | public_expose | bond | ipo | other
  jenis        TEXT,
  step         TEXT,
  title        TEXT,                          -- IDX description
  location     TEXT,
  rups_at      TIMESTAMPTZ,
  pe_at        TIMESTAMPTZ,
  source       TEXT DEFAULT 'idx_getcalendar',
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_corpcal_event_date ON corporate_calendar (event_date);
CREATE INDEX IF NOT EXISTS idx_corpcal_ticker     ON corporate_calendar (ticker);

-- Public read for the anon (frontend) role, matching market_events.
ALTER TABLE corporate_calendar ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON corporate_calendar;
CREATE POLICY "Allow public read" ON corporate_calendar FOR SELECT USING (true);
```

- [ ] **Step 3: Apply it in the Supabase SQL editor**

Migrations are applied manually (no tool). Paste the file into the Supabase SQL editor and run it. This must happen before Task 7's scraper run.

- [ ] **Step 4: Update the data dictionary + commit**

Add a one-line `corporate_calendar` entry to `docs/data_dictionary.md` (table: IDX corporate-action calendar; columns as above).
```bash
git add docs/schema-v37-corporate-calendar.sql docs/data_dictionary.md
git commit -m "feat(schema): v37 corporate_calendar table"
```

---

## Task 3: Scraper pure helpers (`_classify_event`, `_parse_row`) — TDD

**Files:**
- Create: `python/scrapers/idx_calendar.py` (helpers only this task)
- Create: `python/tests/test_idx_calendar.py`

- [ ] **Step 1: Write the failing tests**

```python
# python/tests/test_idx_calendar.py
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scrapers.idx_calendar import _classify_event, _parse_row


class TestClassify:
    def _row(self, desc="", jenis=""):
        return {"description": desc, "Jenis": jenis, "Step": ""}

    def test_public_expose(self):
        assert _classify_event(self._row(desc="Jadwal Public Expose BBRI")) == "public_expose"

    def test_dividend(self):
        assert _classify_event(self._row(desc="tanggal cum Dividen Tunai PT X")) == "dividend"

    def test_rups(self):
        assert _classify_event(self._row(desc="Pemberitahuan RUPS Rencana PT X")) == "rups"

    def test_bond_by_jenis(self):
        assert _classify_event(self._row(jenis="obligasiJatuhTempo")) == "bond"

    def test_ipo_by_jenis(self):
        assert _classify_event(self._row(jenis="pencatatanAwal")) == "ipo"

    def test_other(self):
        assert _classify_event(self._row(desc="Laporan Pembelian Kembali Saham")) == "other"


class TestParseRow:
    def _raw(self, **over):
        base = {
            "id": 200528, "title": "mtel",
            "description": "Pemberitahuan RUPS Rencana PT Dayamitra Telekomunikasi Tbk",
            "Jenis": "Rencana", "Step": "rencana",
            "start": "2026-06-30T00:00:00",
            "TglWaktuRups": "2026-06-30T14:00:00",
            "TglWaktuPE": "1911-01-01T00:00:00",
            "location": "Jakarta",
        }
        base.update(over)
        return base

    def test_basic_fields(self):
        row = _parse_row(self._raw())
        assert row["idx_id"] == 200528
        assert row["ticker"] == "MTEL"          # uppercased
        assert row["event_date"] == "2026-06-30"
        assert row["event_type"] == "rups"
        assert row["title"].startswith("Pemberitahuan RUPS")

    def test_rups_at_parsed_pe_null(self):
        row = _parse_row(self._raw())
        assert row["rups_at"] == "2026-06-30T14:00:00"
        assert row["pe_at"] is None              # 1911 sentinel → null

    def test_invalid_row_returns_none(self):
        assert _parse_row({"id": 1, "title": "", "start": ""}) is None
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd python && python -m pytest tests/test_idx_calendar.py -q`
Expected: FAIL — `ImportError` / `cannot import name '_classify_event'`.

- [ ] **Step 3: Implement the helpers**

```python
# python/scrapers/idx_calendar.py
"""
idx_calendar.py — IDX corporate-action calendar scraper.

Fetches the listed-company calendar (RUPS, dividends, public expose, etc.) from
IDX's public GetCalendar endpoint (all emiten, current month) and stores it in
the `corporate_calendar` table. Each run overrides the scraped month and prunes
rows older than 12 months.

    cd python && python -m scrapers.idx_calendar
"""
from __future__ import annotations

import calendar
import datetime as dt
import logging

from dateutil.relativedelta import relativedelta

from utils.idx_client import IDXClient
from utils.supabase_client import get_client, bulk_upsert, start_run, finish_run
from utils.helpers import RunResult

logger = logging.getLogger(__name__)

_TABLE = "corporate_calendar"


def _classify_event(row: dict) -> str:
    """Map an IDX calendar row to an event_type from its text/Jenis."""
    desc = (row.get("description") or "").lower()
    jenis = (row.get("Jenis") or "").lower()
    if "public expose" in desc or "paparan" in desc:
        return "public_expose"
    if "dividen" in desc:
        return "dividend"
    if "rups" in desc or "rapat umum" in desc:
        return "rups"
    if "obligasi" in jenis or jenis == "rupo" or "obligasi" in desc:
        return "bond"
    if jenis == "pencatatanawal" or "ipo" in desc:
        return "ipo"
    return "other"


def _clean_dt(value: str | None) -> str | None:
    """Return the ISO datetime, or None for the IDX 1911 'no value' sentinel."""
    if not value or str(value).startswith("1911"):
        return None
    return str(value)


def _parse_row(raw: dict) -> dict | None:
    """Parse one GetCalendar Result into a corporate_calendar row, or None if invalid."""
    ticker = str(raw.get("title") or "").strip().upper()
    start = str(raw.get("start") or "")
    if not ticker or len(start) < 10:
        return None
    return {
        "idx_id": int(raw["id"]),
        "ticker": ticker,
        "event_date": start[:10],
        "event_type": _classify_event(raw),
        "jenis": raw.get("Jenis") or None,
        "step": raw.get("Step") or None,
        "title": raw.get("description") or None,
        "location": raw.get("location") or None,
        "rups_at": _clean_dt(raw.get("TglWaktuRups")),
        "pe_at": _clean_dt(raw.get("TglWaktuPE")),
    }
```

- [ ] **Step 4: Run to verify they pass**

Run: `cd python && python -m pytest tests/test_idx_calendar.py -q`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add python/scrapers/idx_calendar.py python/tests/test_idx_calendar.py
git commit -m "feat(idx_calendar): classify + parse helpers with tests"
```

---

## Task 4: Scraper `run()` — fetch, override month, prune

**Files:**
- Modify: `python/scrapers/idx_calendar.py` (append `run()` + CLI entry)

- [ ] **Step 1: Append `run()` and the entry point**

```python
def run() -> RunResult:
    """
    Fetch the current month's IDX corporate-action calendar (all emiten) and
    refresh `corporate_calendar`:
      1. delete the scraped month's rows (override removed/edited agendas),
      2. upsert the freshly parsed rows,
      3. prune rows whose event_date is older than 12 months.
    Market-wide single call; non-per-ticker. Safe to re-run.
    """
    result = RunResult("idx_calendar")
    run_id = start_run("idx_calendar", metadata={"mode": "month"})
    client = IDXClient()
    db = get_client()

    try:
        today = dt.date.today()
        date_str = today.strftime("%Y%m%d")
        raw = client.get_calendar(range="m", date=date_str)
        rows = [r for r in (_parse_row(x) for x in raw) if r]

        month_start = today.replace(day=1)
        last_day = calendar.monthrange(today.year, today.month)[1]
        month_end = today.replace(day=last_day)

        # 1+2. Override the scraped month: delete then upsert fresh.
        db.table(_TABLE).delete() \
            .gte("event_date", month_start.isoformat()) \
            .lte("event_date", month_end.isoformat()) \
            .execute()
        if rows:
            bulk_upsert(_TABLE, rows, on_conflict="idx_id")

        # 3. Retention: drop anything older than 12 months (before the 1st of
        #    this month last year — robust against leap-day edge cases).
        cutoff = (month_start - relativedelta(months=12)).isoformat()
        db.table(_TABLE).delete().lt("event_date", cutoff).execute()

        logger.info("idx_calendar: %d events for %s (pruned < %s)", len(rows), date_str, cutoff)
        result.ok(f"{date_str}:{len(rows)}")
    except Exception as exc:
        logger.exception("idx_calendar run failed")
        result.fail("idx_calendar", str(exc))

    result.print_summary()
    finish_run(run_id, **result.to_db_kwargs())
    return result


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    run()
```

- [ ] **Step 2: Verify it imports and the helpers still pass**

Run: `cd python && python -c "import scrapers.idx_calendar as m; print(hasattr(m, 'run'))" && python -m pytest tests/test_idx_calendar.py -q`
Expected: `True` then PASS. (The live run is exercised in Task 7, after the migration is applied.)

- [ ] **Step 3: Commit**

```bash
git add python/scrapers/idx_calendar.py
git commit -m "feat(idx_calendar): run() — override month + 12-month retention"
```

---

## Task 5: Register `idx_calendar` as a daily step in `run_all.py`

**Files:**
- Modify: `python/run_all.py` (add a lazy import helper + a call in `run_daily`)

- [ ] **Step 1: Add the lazy import helper**

Find:
```python
def _import_market_pulse():
    from scrapers import market_pulse
    return market_pulse
```
Add directly below it:
```python
def _import_idx_calendar():
    from scrapers import idx_calendar
    return idx_calendar
```

- [ ] **Step 2: Add the daily step**

In `run_daily(...)`, find:
```python
    console.rule("[bold blue]DAILY: market_pulse")
    _run_tracked_optional(_import_market_pulse().run, "market_pulse", None)
```
Add directly below it:
```python
    console.rule("[bold blue]DAILY: idx_calendar")
    _run_tracked_optional(_import_idx_calendar().run, "idx_calendar", None)
```
(Non-fatal like `market_pulse` — if IDX is down the rest of the pipeline still runs.)

- [ ] **Step 3: Verify run_all still imports**

Run: `cd python && python -c "import run_all; print('ok')"`
Expected: `ok`.

- [ ] **Step 4: Commit**

```bash
git add python/run_all.py
git commit -m "feat(run_all): run idx_calendar in the daily pipeline"
```

---

## Task 6: Web — read `corporate_calendar` from Supabase

**Files:**
- Modify: `web/src/lib/queries/idx-calendar.ts` (full rewrite)
- Modify: `web/src/app/page.tsx`
- Modify: `web/src/app/api/calendar/corporate/route.ts`

- [ ] **Step 1: Rewrite `idx-calendar.ts` as a DB query**

Replace the entire contents of `web/src/lib/queries/idx-calendar.ts` with:
```ts
// Reads the IDX corporate-action calendar from Supabase (populated by the
// Python scraper python/scrapers/idx_calendar.py). No external fetch — runs
// fine on Vercel. Returns [] on error so the home calendar degrades to macro.
import { createPublicClient as createClient } from '@/lib/supabase/public'
import type { MarketEvent, MarketEventCategory } from '@/lib/types/api'

type CorporateEventType = 'rups' | 'dividend' | 'public_expose' | 'bond' | 'ipo' | 'other'

const CATEGORY_BY_TYPE: Record<CorporateEventType, MarketEventCategory> = {
  rups: 'rups',
  dividend: 'dividend',
  public_expose: 'public_expose',
  bond: 'other',
  ipo: 'other',
  other: 'other',
}

interface CorpCalRow {
  ticker: string
  event_date: string
  event_type: string
  title: string | null
}

function toMarketEvent(r: CorpCalRow): MarketEvent {
  const cat = CATEGORY_BY_TYPE[(r.event_type as CorporateEventType)] ?? 'other'
  return {
    eventDate: r.event_date,
    title: r.ticker,
    category: cat,
    importance: 'medium',
    volatility: null,
    windowStart: null,
    source: 'idx_calendar',
    note: r.title,
    ticker: r.ticker,
  }
}

/**
 * Upcoming corporate-action events for the given tickers, from corporate_calendar.
 * Empty list → []. Used by the home page (top-100) and the watchlist API route.
 */
export async function getCorporateCalendar(tickers: string[]): Promise<MarketEvent[]> {
  if (tickers.length === 0) return []
  const sb = await createClient()
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await sb
    .from('corporate_calendar')
    .select('ticker, event_date, event_type, title')
    .in('ticker', tickers)
    .gte('event_date', today)
    .order('event_date', { ascending: true })
  if (error || !data) return []
  return (data as CorpCalRow[]).map(toMarketEvent)
}
```

- [ ] **Step 2: Update the home page to use it**

In `web/src/app/page.tsx`, change the import:
```ts
import { fetchIdxCorporateCalendar, toMarketEvent } from '@/lib/queries/idx-calendar'
```
to:
```ts
import { getCorporateCalendar } from '@/lib/queries/idx-calendar'
```
Then replace the fetch + scope + map block:
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
```
with:
```ts
  // Top-100 by market cap scopes the corporate-action calendar (DB read).
  const top100 = await getTop100Tickers()
  const [{ events, volatilityAlerts }, strategyPicks, caEvents] = await Promise.all([
    getMarketPulse(),
    loadStrategyPicks(),
    getCorporateCalendar(top100),
  ])

  // Merge macro market_events + scoped corporate-action events.
  // (Watchlist events are merged client-side.)
  const calendarEvents = [...events, ...caEvents]
```

- [ ] **Step 3: Update the watchlist API route**

Replace the entire contents of `web/src/app/api/calendar/corporate/route.ts` with:
```ts
// GET /api/calendar/corporate?tickers=BBRI,BMRI
// Upcoming corporate-action events for the given tickers (watchlist merge),
// read from Supabase.
import { NextRequest, NextResponse } from 'next/server'
import { getCorporateCalendar } from '@/lib/queries/idx-calendar'

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('tickers') ?? ''
  const tickers = [...new Set(
    raw.split(',').map((t) => t.trim().toUpperCase()).filter(Boolean),
  )]
  if (tickers.length === 0) return NextResponse.json([])
  return NextResponse.json(await getCorporateCalendar(tickers))
}
```

- [ ] **Step 4: Type-check**

Run: `cd web && npx tsc --noEmit`
Expected: PASS. (Confirms `fetchIdxCorporateCalendar`/`toMarketEvent`/`filterByTickers` are no longer referenced anywhere.)

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/queries/idx-calendar.ts web/src/app/page.tsx web/src/app/api/calendar/corporate/route.ts
git commit -m "feat(calendar): web reads corporate_calendar from Supabase (no live IDX fetch)"
```

---

## Task 7: End-to-end verification

**Files:** none (verification; fix in Task 1–6 files if needed).

- [ ] **Step 1: Confirm the migration is applied** (Task 2 Step 3). In the Supabase SQL editor: `select count(*) from corporate_calendar;` → returns `0` (table exists).

- [ ] **Step 2: Run the scraper once**

Run: `cd python && python -m scrapers.idx_calendar`
Expected: logs `idx_calendar: <N> events for <YYYYMMDD>` with N in the hundreds; summary shows 1 ok, 0 failed.

- [ ] **Step 3: Verify rows + classification in the DB**

In the Supabase SQL editor:
```sql
select event_type, count(*) from corporate_calendar group by event_type order by 2 desc;
select ticker, event_date, event_type, left(title,40) from corporate_calendar
  where event_date >= current_date order by event_date limit 10;
```
Expected: rows across `dividend`/`rups`/`public_expose`/`other`; upcoming events present.

- [ ] **Step 4: Verify the web reads it**

Run: `cd web && rm -rf .next && npm run build` → PASS, `/` and `/api/calendar/corporate` present.
Then `npm run dev` and:
```bash
curl -s "http://localhost:3000/api/calendar/corporate?tickers=BBCA,TLKM,BBRI" | head -c 300
```
Expected: JSON array of `MarketEvent` objects with `ticker`/`category` from the DB (not `[]`, assuming those tickers have upcoming agendas).
Open `http://localhost:3000/` → the Market Calendar shows corporate-action day cards (sourced from the DB now). Stop dev.

- [ ] **Step 5: Re-run idempotency + retention check**

Run `cd python && python -m scrapers.idx_calendar` a second time. In Supabase, confirm `select count(*) from corporate_calendar` did not double (override worked) and `select min(event_date) from corporate_calendar` is ≥ ~12 months ago (retention).

- [ ] **Step 6: Final commit (if any fixes)**

```bash
git add -A && git commit -m "fix(idx_calendar): resolve end-to-end verification findings"
```

---

## Self-Review Notes (author)

- **Spec coverage:** get_calendar curl_cffi (T1), schema (T2), scraper classify/parse (T3), override-month + 12mo retention (T4 run()), run_all daily registration (T5), web DB read replacing live fetch (T6), end-to-end + idempotency/retention verify (T7). All spec decisions (#1–#6) map to a task.
- **Override + retention** (the user's two adds): T4 Step 1 — delete-month then `bulk_upsert(on_conflict='idx_id')`, then prune `< month_start − 12 months`.
- **Type/name consistency:** `_classify_event`/`_parse_row` defined T3, used T4 + tested T3. `get_calendar` defined T1, used T4. `getCorporateCalendar` defined T6 Step 1, used T6 Steps 2–3. `corporate_calendar`/`idx_id`/`event_type` consistent across T2/T3/T4/T6.
- **No web unit tests** (none in repo) — web gate is `tsc` + the T7 manual run; python helpers are unit-tested (T3).
- **Migration number** v37 is provisional — T2 Step 1 verifies it against the tree before applying.
- **Run order** for first activation: apply migration (T2.3) → run scraper (T7.2) → web shows data. Documented in T7.
