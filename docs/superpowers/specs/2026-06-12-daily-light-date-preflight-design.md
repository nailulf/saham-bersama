# `--daily-light` Date Pre-flight & Choice — Design

**Date:** 2026-06-12
**Status:** Approved (pending spec review)
**Area:** `python/run_all.py`, `python/scrapers/*`

## Problem

`run_all.py --daily-light` runs three scrapers that feed the money-flow page:
`daily_prices`, `money_flow`, and `idx_stock_summary`. Two of them
(`idx_stock_summary`, `money_flow`) resolve their dates with a helper that anchors
on **yesterday** and walks back N weekdays — so a run never fetches **today**, and
the fixed `--days 2` window can either (a) miss today's data or (b) re-crawl dates
that are already stored. There is no visibility into what data already exists before
a run starts, so the operator cannot make an informed, minimal-crawl choice.

### Goals
1. `--daily-light` should be able to include **today** (today + yesterday by default).
2. Before crawling, **check the last available data** per scraper and show it.
3. Let the operator **choose the date range** (today only / last 2 days / fill the gap),
   to reduce unnecessary crawling.
4. Stay **cron-safe** — automation must not hang on a prompt.

### Non-goals
- Changing the money-flow web page or its queries.
- Holiday-aware trading calendars (weekday approximation is retained; empty fetches
  are skipped non-fatally, as today).
- Re-architecting `daily_prices` away from its per-ticker incremental model.

## Decision summary (approved choices)

- **Choice model:** interactive prompt **with a non-interactive flag fallback**.
- **Scope:** all three scrapers, unified behind one date model — but `daily_prices`
  keeps its incremental gap-fill as the "fill-gap" path.
- **Menu:** three options — today / 2 days / fill-gap. Fill-gap is recommended when
  the detected gap is > 2 days.
- **Architecture:** Approach A — centralize the pre-flight check, prompt, and date
  resolution in `run_all.py`; pass resolved dates down to each scraper.
- **Cron default:** `2d` (predictable, low-crawl).
- **`daily_prices` minimal-window tradeoff:** accepted (see §4).

## Design

### 1. CLI surface

Add one flag to `run_all.py`:

- `--since {today|2d|gap}` — non-interactive selector for `--daily-light`.
  - `today` → today only (1 trading day)
  - `2d` → today + previous trading day (2 days)
  - `gap` → every trading day from the last stored date through today

Behavior matrix:

| Context | `--since` given? | Action |
|---|---|---|
| Terminal (TTY) | no | Pre-flight check, print summary, **prompt** the 3 options |
| Terminal (TTY) | yes | Skip prompt, use the flag |
| Cron (no TTY) | no | Skip prompt, **default to `2d`** |
| Cron (no TTY) | yes | Use the flag |

`--days` is retained for other modes; for `--daily-light` it is superseded by `--since`.
TTY detection via `sys.stdin.isatty()`.

### 2. Pre-flight freshness check

New helper `_daily_light_freshness()` in `run_all.py`. Before any crawling, query the
last stored date per target table and print a summary:

```
DAILY-LIGHT — data freshness (today = 2026-06-12)
  idx_stock_summary   last: 2026-06-10   (2 days behind)
  broker_flow         last: 2026-06-09   (3 days behind)   ← Stockbit, lags ~1d
  daily_prices        last: 2026-06-11   (1 day behind)
  → largest gap: 3 days
```

- Sources: `idx_stock_summary` → `MAX(date)`; `broker_flow` → `MAX(trade_date)`;
  `daily_prices` → `MAX(date)`.
- "days behind" = weekday count between last-stored and today.
- The **largest gap** drives the recommended menu option: gap > 2 → recommend `gap`;
  else recommend `2d`.

### 3. Date resolution (include-today)

New helper `_recent_trading_dates(n, anchor=today)` returns N weekdays **ending at
today inclusive** (weekend-aware: if today is Sat/Sun, it resolves to the latest
weekday ≤ today). This is the include-today replacement for the yesterday-anchored
logic on this path.

Resolution per choice:
- `today` → `[latest weekday ≤ today]`
- `2d` → that day + the prior weekday
- `gap` → all weekdays from `min(last-stored across the three tables) + 1` through today

Empty fetches (today before IDX publish, or a holiday) are skipped non-fatally —
existing scraper behavior, unchanged.

**Cron default:** when non-interactive and no `--since`, resolve as `2d`.

### 4. Date flow into the three scrapers

The resolved date set is passed down explicitly by `run_daily_light()`:

- **idx_stock_summary** — `run(dates=date_set)`. Already accepts a `dates` list.
  Remains gated to whole-market runs (`if not tickers`).
- **money_flow** — `run(dates=date_set, tickers=...)`. Already accepts `dates`.
- **daily_prices** — gains one new optional param `start_floor: date | None`:
  - `today` / `2d` → `start_floor = min(date_set)`. Per ticker, fetch from
    `start_floor`, capping the crawl to the window. **Tickers with no stored data
    still bootstrap** their full history (start_floor does not suppress bootstrap).
  - `gap` → `start_floor = None`. Existing per-ticker incremental behavior (each
    ticker fetches from its own last stored date).

**Accepted tradeoff:** under `today` / `2d`, a ticker whose stored history is older
than the chosen window will **not** have that gap backfilled — this is the intended
minimal-crawl behavior. Use `gap` for completeness. The pre-flight summary plus the
"recommend `gap` when gap > 2" nudge prevent silently leaving holes.

### 5. Files touched

- **`python/run_all.py`**
  - Add `--since {today|2d|gap}` argument.
  - Add `_daily_light_freshness()` — per-table last-date query + printed summary,
    returns the dates and computed largest gap.
  - Add `_resolve_daily_light_dates(since, freshness)` — applies the flag or runs the
    interactive prompt (TTY) / cron default (no TTY); returns the resolved date set
    and a `start_floor` for `daily_prices`.
  - Rewire `run_daily_light()` to call the above and pass `dates` / `start_floor` down.
- **`python/scrapers/daily_prices.py`**
  - Add `start_floor: date | None = None` to `run()`; when set, use it as the
    per-ticker start (except no-data tickers, which still bootstrap).
- **`python/scrapers/idx_stock_summary.py`**, **`python/scrapers/money_flow.py`**
  - No signature change (both already accept `dates`). Their yesterday-anchored
    default helpers are left untouched for other callers.

## Data flow

```
run_all --daily-light [--since X]
  │
  ├─ _daily_light_freshness()
  │     MAX(date) idx_stock_summary / MAX(trade_date) broker_flow / MAX(date) daily_prices
  │     → print summary + largest gap
  │
  ├─ _resolve_daily_light_dates(since, freshness)
  │     TTY+no flag → prompt(today|2d|gap, recommend by gap)
  │     no-TTY+no flag → "2d"
  │     → (date_set, start_floor)
  │
  └─ run_daily_light(date_set, start_floor)
        daily_prices.run(start_floor=start_floor)
        money_flow.run(dates=date_set)
        idx_stock_summary.run(dates=date_set)          # if not tickers
```

## Edge cases

- **Today before IDX publish / holiday:** date is fetched, returns no data, logged as
  `skip` (non-fatal). No change.
- **Weekend run:** `today` resolves to the latest weekday ≤ today.
- **Empty DB / brand-new ticker (daily_prices):** `start_floor` does not suppress
  bootstrap; no-data tickers still pull full history.
- **No stored data in a table (freshness):** show "none" and treat gap as unbounded →
  recommend `gap`.
- **Single-ticker `--daily-light`:** `idx_stock_summary` stays skipped (`if not
  tickers`); `daily_prices` and `money_flow` honor the resolved dates / `start_floor`.

## Testing

- `_recent_trading_dates`: weekday-ending-today, weekend resolution, N=1/2, gap range.
- `_resolve_daily_light_dates`: flag paths (`today`/`2d`/`gap`), TTY prompt mapping,
  non-TTY default (`2d`), recommendation logic (gap>2 → `gap`).
- `daily_prices.run(start_floor=...)`: existing ticker capped to window; no-data
  ticker still bootstraps; `start_floor=None` preserves incremental behavior.
- Smoke: `--daily-light --since today`, `--since 2d`, `--since gap` resolve the
  expected date sets against a seeded freshness state.
