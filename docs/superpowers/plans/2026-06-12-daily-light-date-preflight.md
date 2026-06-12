# `--daily-light` Date Pre-flight & Choice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `run_all.py --daily-light` show the last stored data per scraper, let the operator choose the crawl range (today / today+yesterday / fill-gap), include **today** by default, and stay cron-safe via a `--since` flag.

**Architecture:** Approach A — centralize the pre-flight freshness check, the choice (interactive prompt or `--since` flag or cron default), and date resolution in `run_all.py` as small pure helpers. Resolved date lists are passed down to the three scrapers. `daily_prices` gains a `start_floor` param; the two date-based scrapers already accept a `dates` list.

**Tech Stack:** Python 3.10+, pytest, Supabase Python client, rich (console).

**Spec:** [docs/superpowers/specs/2026-06-12-daily-light-date-preflight-design.md](../specs/2026-06-12-daily-light-date-preflight-design.md)

---

## File Structure

- **`python/run_all.py`** (modify) — owns the new UX and date resolution:
  - Pure: `_recent_trading_dates`, `_trading_dates_between`, `_days_behind`, `_recommend_mode`, `_resolve_since_dates` (+ `DailyLightPlan` NamedTuple).
  - I/O: `_max_date`, `_daily_light_freshness`, `_prompt_daily_light_mode`, `_choose_daily_light_mode`.
  - Rewire: `run_daily_light()` signature + body; `--since` argparse flag; `main()` call site.
- **`python/scrapers/daily_prices.py`** (modify) — extract `_compute_start_ranges()` (pure) and add `start_floor` param to `run()`.
- **`python/scrapers/idx_stock_summary.py`**, **`python/scrapers/money_flow.py`** — unchanged (already accept `dates`); wiring skips them when the resolved list is empty.
- **`python/tests/test_daily_light.py`** (create) — unit tests for the pure helpers + wiring.

Conventions (from existing tests): `sys.path.insert(0, ...)` to import from `python/`; argparse flags verified via `subprocess` + `--help`; pure functions imported directly; DB/scraper calls replaced with `monkeypatch`.

---

### Task 1: Pure trading-date helpers

**Files:**
- Modify: `python/run_all.py` (add helpers near the top, after the imports block ~line 34)
- Test: `python/tests/test_daily_light.py` (create)

- [ ] **Step 1: Write the failing test**

Create `python/tests/test_daily_light.py`:

```python
"""Tests for --daily-light date pre-flight, choice, and resolution."""
import os
import sys
from datetime import date

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


class TestRecentTradingDates:
    def test_includes_today_when_weekday(self):
        from run_all import _recent_trading_dates
        # 2026-06-12 is a Friday
        assert _recent_trading_dates(1, date(2026, 6, 12)) == [date(2026, 6, 12)]

    def test_two_days_are_today_and_prev_weekday(self):
        from run_all import _recent_trading_dates
        # Fri 2026-06-12 + Thu 2026-06-11
        assert _recent_trading_dates(2, date(2026, 6, 12)) == [
            date(2026, 6, 11), date(2026, 6, 12),
        ]

    def test_weekend_anchor_resolves_to_latest_weekday(self):
        from run_all import _recent_trading_dates
        # Sun 2026-06-14 -> latest weekday <= anchor is Fri 2026-06-12
        assert _recent_trading_dates(1, date(2026, 6, 14)) == [date(2026, 6, 12)]

    def test_two_days_span_a_weekend(self):
        from run_all import _recent_trading_dates
        # Mon 2026-06-15 + prev weekday Fri 2026-06-12
        assert _recent_trading_dates(2, date(2026, 6, 15)) == [
            date(2026, 6, 12), date(2026, 6, 15),
        ]


class TestTradingDatesBetween:
    def test_excludes_after_includes_through(self):
        from run_all import _trading_dates_between
        # after Tue 6-09, through Fri 6-12 -> Wed, Thu, Fri
        assert _trading_dates_between(date(2026, 6, 9), date(2026, 6, 12)) == [
            date(2026, 6, 10), date(2026, 6, 11), date(2026, 6, 12),
        ]

    def test_empty_when_up_to_date(self):
        from run_all import _trading_dates_between
        assert _trading_dates_between(date(2026, 6, 12), date(2026, 6, 12)) == []

    def test_skips_weekends(self):
        from run_all import _trading_dates_between
        # after Fri 6-12, through Mon 6-15 -> only Mon (Sat/Sun skipped)
        assert _trading_dates_between(date(2026, 6, 12), date(2026, 6, 15)) == [
            date(2026, 6, 15),
        ]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd python && python -m pytest tests/test_daily_light.py -v`
Expected: FAIL with `ImportError: cannot import name '_recent_trading_dates' from 'run_all'`

- [ ] **Step 3: Write minimal implementation**

In `python/run_all.py`, add after the `logger = logging.getLogger("run_all")` line (~line 33):

```python
from datetime import date as _date, timedelta as _timedelta


def _recent_trading_dates(n: int, anchor: _date) -> list[_date]:
    """Last N weekdays ending at `anchor` inclusive (weekend-aware).

    If `anchor` is a weekend, the most recent weekday <= anchor is the end of
    the window. Returns ascending dates.
    """
    out: list[_date] = []
    d = anchor
    while len(out) < n:
        if d.weekday() < 5:  # Mon-Fri
            out.append(d)
        d -= _timedelta(days=1)
    return sorted(out)


def _trading_dates_between(after: _date, through: _date) -> list[_date]:
    """Weekdays d where `after` < d <= `through`. Ascending. Empty if none."""
    out: list[_date] = []
    d = through
    while d > after:
        if d.weekday() < 5:
            out.append(d)
        d -= _timedelta(days=1)
    return sorted(out)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd python && python -m pytest tests/test_daily_light.py -v`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add python/run_all.py python/tests/test_daily_light.py
git commit -m "feat(run_all): add include-today trading-date helpers for daily-light"
```

---

### Task 2: Freshness check (DB last-date per table)

**Files:**
- Modify: `python/run_all.py` (add after the helpers from Task 1)
- Test: `python/tests/test_daily_light.py`

- [ ] **Step 1: Write the failing test**

Append to `python/tests/test_daily_light.py`:

```python
class TestDaysBehind:
    def test_counts_weekdays_between_last_and_today(self):
        from run_all import _days_behind
        # last Tue 6-09, today Fri 6-12 -> Wed/Thu/Fri = 3
        assert _days_behind(date(2026, 6, 9), date(2026, 6, 12)) == 3

    def test_zero_when_current(self):
        from run_all import _days_behind
        assert _days_behind(date(2026, 6, 12), date(2026, 6, 12)) == 0

    def test_none_when_no_data(self):
        from run_all import _days_behind
        assert _days_behind(None, date(2026, 6, 12)) is None


class TestFreshness:
    def test_queries_each_table_max_date(self, monkeypatch):
        import run_all
        calls = []

        def fake_max_date(table, col):
            calls.append((table, col))
            return {
                ("idx_stock_summary", "date"): date(2026, 6, 10),
                ("broker_flow", "trade_date"): date(2026, 6, 9),
                ("daily_prices", "date"): date(2026, 6, 11),
            }[(table, col)]

        monkeypatch.setattr(run_all, "_max_date", fake_max_date)
        fresh = run_all._daily_light_freshness(today=date(2026, 6, 12))
        assert fresh == {
            "idx_stock_summary": date(2026, 6, 10),
            "broker_flow": date(2026, 6, 9),
            "daily_prices": date(2026, 6, 11),
        }
        assert set(calls) == {
            ("idx_stock_summary", "date"),
            ("broker_flow", "trade_date"),
            ("daily_prices", "date"),
        }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd python && python -m pytest tests/test_daily_light.py::TestFreshness -v`
Expected: FAIL with `AttributeError: module 'run_all' has no attribute '_max_date'`

- [ ] **Step 3: Write minimal implementation**

In `python/run_all.py`, add after the Task 1 helpers:

```python
# Tables whose freshness gates the --daily-light run: name -> date column.
_DAILY_LIGHT_TABLES = {
    "idx_stock_summary": "date",
    "broker_flow": "trade_date",
    "daily_prices": "date",
}


def _max_date(table: str, col: str) -> _date | None:
    """Return MAX(col) from `table` as a date, or None if the table is empty."""
    from utils.supabase_client import get_client
    resp = (
        get_client().table(table).select(col).order(col, desc=True).limit(1).execute()
    )
    rows = resp.data or []
    if not rows or not rows[0].get(col):
        return None
    return datetime.strptime(str(rows[0][col])[:10], "%Y-%m-%d").date()


def _days_behind(last: _date | None, today: _date) -> int | None:
    """Weekday count between `last` (exclusive) and `today` (inclusive). None if no data."""
    if last is None:
        return None
    return len(_trading_dates_between(last, today))


def _daily_light_freshness(today: _date | None = None) -> dict[str, _date | None]:
    """Query last stored date per --daily-light table and print a summary."""
    today = today or _date.today()
    fresh = {t: _max_date(t, col) for t, col in _DAILY_LIGHT_TABLES.items()}

    console.rule(f"[bold]DAILY-LIGHT — data freshness (today = {today.isoformat()})")
    largest = 0
    for t, last in fresh.items():
        behind = _days_behind(last, today)
        last_str = last.isoformat() if last else "none"
        behind_str = "no data" if behind is None else f"{behind} days behind"
        console.print(f"  {t:<20} last: {last_str:<12} ({behind_str})")
        largest = max(largest, behind if behind is not None else 9999)
    console.print(f"  [cyan]→ largest gap: {largest if largest < 9999 else 'unbounded'} days[/cyan]")
    return fresh
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd python && python -m pytest tests/test_daily_light.py -v`
Expected: PASS (all tests including TestDaysBehind, TestFreshness)

- [ ] **Step 5: Commit**

```bash
git add python/run_all.py python/tests/test_daily_light.py
git commit -m "feat(run_all): add daily-light freshness check (last date per table)"
```

---

### Task 3: Recommend mode + resolve dates per choice

**Files:**
- Modify: `python/run_all.py`
- Test: `python/tests/test_daily_light.py`

- [ ] **Step 1: Write the failing test**

Append to `python/tests/test_daily_light.py`:

```python
class TestRecommendMode:
    def test_recommends_2d_when_gap_small(self):
        from run_all import _recommend_mode
        fresh = {
            "idx_stock_summary": date(2026, 6, 11),
            "broker_flow": date(2026, 6, 11),
            "daily_prices": date(2026, 6, 11),
        }
        assert _recommend_mode(fresh, date(2026, 6, 12)) == "2d"

    def test_recommends_gap_when_gap_large(self):
        from run_all import _recommend_mode
        fresh = {
            "idx_stock_summary": date(2026, 6, 3),  # >2 weekdays behind
            "broker_flow": date(2026, 6, 11),
            "daily_prices": date(2026, 6, 11),
        }
        assert _recommend_mode(fresh, date(2026, 6, 12)) == "gap"

    def test_recommends_gap_when_table_empty(self):
        from run_all import _recommend_mode
        fresh = {"idx_stock_summary": None, "broker_flow": date(2026, 6, 11),
                 "daily_prices": date(2026, 6, 11)}
        assert _recommend_mode(fresh, date(2026, 6, 12)) == "gap"


class TestResolveSinceDates:
    FRESH = {
        "idx_stock_summary": date(2026, 6, 10),
        "broker_flow": date(2026, 6, 9),
        "daily_prices": date(2026, 6, 11),
    }

    def test_today_same_window_both_floor_today(self):
        from run_all import _resolve_since_dates
        plan = _resolve_since_dates("today", self.FRESH, date(2026, 6, 12))
        assert plan.idx_dates == [date(2026, 6, 12)]
        assert plan.mf_dates == [date(2026, 6, 12)]
        assert plan.start_floor == date(2026, 6, 12)

    def test_2d_same_window_floor_min(self):
        from run_all import _resolve_since_dates
        plan = _resolve_since_dates("2d", self.FRESH, date(2026, 6, 12))
        assert plan.idx_dates == [date(2026, 6, 11), date(2026, 6, 12)]
        assert plan.mf_dates == [date(2026, 6, 11), date(2026, 6, 12)]
        assert plan.start_floor == date(2026, 6, 11)

    def test_gap_per_table_floor_none(self):
        from run_all import _resolve_since_dates
        plan = _resolve_since_dates("gap", self.FRESH, date(2026, 6, 12))
        # idx last 6-10 -> 6-11, 6-12 ; broker_flow last 6-9 -> 6-10, 6-11, 6-12
        assert plan.idx_dates == [date(2026, 6, 11), date(2026, 6, 12)]
        assert plan.mf_dates == [date(2026, 6, 10), date(2026, 6, 11), date(2026, 6, 12)]
        assert plan.start_floor is None

    def test_gap_falls_back_to_2d_when_table_empty(self):
        from run_all import _resolve_since_dates
        fresh = {"idx_stock_summary": None, "broker_flow": date(2026, 6, 9),
                 "daily_prices": date(2026, 6, 11)}
        plan = _resolve_since_dates("gap", fresh, date(2026, 6, 12))
        assert plan.idx_dates == [date(2026, 6, 11), date(2026, 6, 12)]  # 2d fallback
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd python && python -m pytest tests/test_daily_light.py::TestResolveSinceDates -v`
Expected: FAIL with `ImportError: cannot import name '_resolve_since_dates'`

- [ ] **Step 3: Write minimal implementation**

In `python/run_all.py`, add (and add `from typing import NamedTuple` to the imports if not present):

```python
class DailyLightPlan(NamedTuple):
    idx_dates: list[_date]       # dates for idx_stock_summary.run(dates=...)
    mf_dates: list[_date]        # dates for money_flow.run(dates=...)
    start_floor: _date | None    # per-ticker start floor for daily_prices.run(...)


def _recommend_mode(freshness: dict[str, _date | None], today: _date) -> str:
    """'gap' when any table is empty or >2 weekdays behind, else '2d'."""
    largest = 0
    for last in freshness.values():
        behind = _days_behind(last, today)
        if behind is None:
            return "gap"
        largest = max(largest, behind)
    return "gap" if largest > 2 else "2d"


def _resolve_since_dates(mode: str, freshness: dict[str, _date | None],
                         today: _date) -> DailyLightPlan:
    """Map a chosen mode (today|2d|gap) to concrete per-scraper date lists."""
    if mode == "today":
        window = _recent_trading_dates(1, today)
        return DailyLightPlan(window, window, min(window))
    if mode == "2d":
        window = _recent_trading_dates(2, today)
        return DailyLightPlan(window, window, min(window))
    if mode == "gap":
        def _gap(last: _date | None) -> list[_date]:
            # No stored data -> fall back to a bounded 2-day window.
            return _trading_dates_between(last, today) if last else _recent_trading_dates(2, today)
        return DailyLightPlan(
            _gap(freshness.get("idx_stock_summary")),
            _gap(freshness.get("broker_flow")),
            None,
        )
    raise ValueError(f"unknown --since mode: {mode!r}")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd python && python -m pytest tests/test_daily_light.py -v`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add python/run_all.py python/tests/test_daily_light.py
git commit -m "feat(run_all): recommend mode + resolve per-scraper dates for daily-light"
```

---

### Task 4: Choice selection (flag / prompt / cron default) + `--since` flag

**Files:**
- Modify: `python/run_all.py`
- Test: `python/tests/test_daily_light.py`

- [ ] **Step 1: Write the failing test**

Append to `python/tests/test_daily_light.py`:

```python
import subprocess

PYTHON = sys.executable
RUN_ALL = os.path.join(os.path.dirname(__file__), "..", "run_all.py")


class TestChooseMode:
    FRESH = {"idx_stock_summary": date(2026, 6, 10), "broker_flow": date(2026, 6, 9),
             "daily_prices": date(2026, 6, 11)}

    def test_flag_takes_precedence_no_prompt(self, monkeypatch):
        import run_all
        # Even on a TTY, an explicit flag must not prompt.
        monkeypatch.setattr(run_all.sys.stdin, "isatty", lambda: True)
        monkeypatch.setattr(run_all, "_prompt_daily_light_mode",
                            lambda *a, **k: pytest.fail("should not prompt"))
        assert run_all._choose_daily_light_mode("gap", self.FRESH, date(2026, 6, 12)) == "gap"

    def test_non_tty_defaults_to_2d(self, monkeypatch):
        import run_all
        monkeypatch.setattr(run_all.sys.stdin, "isatty", lambda: False)
        assert run_all._choose_daily_light_mode(None, self.FRESH, date(2026, 6, 12)) == "2d"

    def test_tty_no_flag_calls_prompt(self, monkeypatch):
        import run_all
        monkeypatch.setattr(run_all.sys.stdin, "isatty", lambda: True)
        monkeypatch.setattr(run_all, "_prompt_daily_light_mode", lambda *a, **k: "today")
        assert run_all._choose_daily_light_mode(None, self.FRESH, date(2026, 6, 12)) == "today"


class TestSinceFlag:
    def test_since_flag_in_help(self):
        result = subprocess.run([PYTHON, RUN_ALL, "--help"],
                                capture_output=True, text=True, timeout=10)
        assert result.returncode == 0
        assert "--since" in result.stdout

    def test_since_rejects_bad_value(self):
        result = subprocess.run([PYTHON, RUN_ALL, "--daily-light", "--since", "bogus"],
                                capture_output=True, text=True, timeout=10)
        assert result.returncode != 0
        assert "since" in result.stderr.lower()
```

`pytest` is already imported at top of the file? Add `import pytest` to the test module imports if not present.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd python && python -m pytest tests/test_daily_light.py::TestChooseMode tests/test_daily_light.py::TestSinceFlag -v`
Expected: FAIL — `_choose_daily_light_mode` missing and `--since` not in help.

- [ ] **Step 3: Write minimal implementation**

3a. In `python/run_all.py`, add the prompt + chooser after the Task 3 helpers:

```python
def _prompt_daily_light_mode(freshness: dict[str, _date | None], today: _date) -> str:
    """Interactive menu. Returns 'today' | '2d' | 'gap'. Empty input -> recommended."""
    rec = _recommend_mode(freshness, today)
    console.print("\n[bold]Which dates to fetch?[/bold]")
    console.print("  1) today only")
    console.print("  2) today + previous trading day")
    console.print("  3) fill the gap since last stored date")
    console.print(f"  [dim](press Enter for recommended: {rec})[/dim]")
    choice = input("Choice [1/2/3]: ").strip()
    return {"1": "today", "2": "2d", "3": "gap", "": rec}.get(choice, rec)


def _choose_daily_light_mode(since: str | None, freshness: dict[str, _date | None],
                             today: _date) -> str:
    """Resolve the mode: explicit flag > interactive prompt (TTY) > cron default '2d'."""
    if since:
        return since
    if sys.stdin.isatty():
        return _prompt_daily_light_mode(freshness, today)
    return "2d"
```

3b. Add the argparse flag. In `main()`, next to `--days` (~line 1046), add:

```python
    parser.add_argument(
        "--since",
        choices=["today", "2d", "gap"],
        default=None,
        help="--daily-light: which dates to fetch — today, 2d (today+prev), or gap "
             "(fill since last stored date). Omit for an interactive prompt; "
             "non-interactive runs default to 2d.",
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd python && python -m pytest tests/test_daily_light.py -v`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add python/run_all.py python/tests/test_daily_light.py
git commit -m "feat(run_all): add --since flag, prompt, and cron-default mode chooser"
```

---

### Task 5: `daily_prices` start_floor

**Files:**
- Modify: `python/scrapers/daily_prices.py` (extract `_compute_start_ranges`, add `start_floor` to `run()`)
- Test: `python/tests/test_daily_light.py`

- [ ] **Step 1: Write the failing test**

Append to `python/tests/test_daily_light.py`:

```python
class TestComputeStartRanges:
    BOOTSTRAP = date(2021, 6, 12)

    def test_start_floor_caps_existing_ticker(self):
        from scrapers.daily_prices import _compute_start_ranges
        last = {"BBRI": date(2026, 6, 1)}  # old data
        ranges = _compute_start_ranges(
            ["BBRI"], last, self.BOOTSTRAP, force_full=False, start_floor=date(2026, 6, 11),
        )
        # floor raises the start so we only crawl the recent window
        assert ranges["BBRI"] == date(2026, 6, 11)

    def test_no_floor_uses_incremental_minus_one(self):
        from scrapers.daily_prices import _compute_start_ranges
        last = {"BBRI": date(2026, 6, 10)}
        ranges = _compute_start_ranges(
            ["BBRI"], last, self.BOOTSTRAP, force_full=False, start_floor=None,
        )
        assert ranges["BBRI"] == date(2026, 6, 9)  # last - 1 day overlap

    def test_floor_does_not_suppress_bootstrap_for_new_ticker(self):
        from scrapers.daily_prices import _compute_start_ranges
        ranges = _compute_start_ranges(
            ["NEWCO"], {}, self.BOOTSTRAP, force_full=False, start_floor=date(2026, 6, 11),
        )
        assert ranges["NEWCO"] == self.BOOTSTRAP

    def test_recent_ticker_stays_minimal_under_floor(self):
        from scrapers.daily_prices import _compute_start_ranges
        last = {"BBRI": date(2026, 6, 12)}  # already current, base = 6-11
        ranges = _compute_start_ranges(
            ["BBRI"], last, self.BOOTSTRAP, force_full=False, start_floor=date(2026, 6, 10),
        )
        # max(base 6-11, floor 6-10) -> 6-11, never re-crawls older than needed
        assert ranges["BBRI"] == date(2026, 6, 11)

    def test_force_full_ignores_floor(self):
        from scrapers.daily_prices import _compute_start_ranges
        ranges = _compute_start_ranges(
            ["BBRI"], {"BBRI": date(2026, 6, 10)}, self.BOOTSTRAP,
            force_full=True, start_floor=date(2026, 6, 11),
        )
        assert ranges["BBRI"] == self.BOOTSTRAP
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd python && python -m pytest tests/test_daily_light.py::TestComputeStartRanges -v`
Expected: FAIL with `ImportError: cannot import name '_compute_start_ranges'`

- [ ] **Step 3: Write minimal implementation**

3a. In `python/scrapers/daily_prices.py`, add this pure helper above `def run(` (~line 355):

```python
def _compute_start_ranges(
    ticker_list: list[str],
    last_dates: dict[str, date],
    bootstrap_start: date,
    force_full: bool,
    start_floor: date | None,
) -> dict[str, date]:
    """Per-ticker fetch start date.

    - force_full: every ticker re-fetches from bootstrap_start.
    - ticker with stored data: start = last_date - 1 day (overlap for safety),
      raised to `start_floor` when set (caps the crawl to the chosen window).
    - ticker with no data: always bootstrap (start_floor never suppresses this).
    """
    if force_full:
        return {t: bootstrap_start for t in ticker_list}
    ranges: dict[str, date] = {}
    for t in ticker_list:
        if t in last_dates:
            base = last_dates[t] - timedelta(days=1)
            ranges[t] = max(base, start_floor) if start_floor else base
        else:
            ranges[t] = bootstrap_start
    return ranges
```

3b. Change `run()`'s signature (~line 355) to add the param:

```python
def run(
    tickers: list[str] | None = None,
    force_full: bool = False,
    start_floor: date | None = None,
) -> RunResult:
```

3c. Replace the inline date-range block (the `if force_full: ... else: ...` spanning ~lines 391-409) with a call to the helper:

```python
    today = date.today()
    bootstrap_start = _bootstrap_start()

    last_dates = {} if force_full else _get_last_dates(ticker_list)
    date_ranges = _compute_start_ranges(
        ticker_list, last_dates, bootstrap_start, force_full, start_floor,
    )
    new_tickers = [t for t in ticker_list if t not in last_dates]
    existing_tickers = [t for t in ticker_list if t in last_dates]
    logger.info(
        "New tickers (bootstrap): %d | Incremental updates: %d | start_floor=%s",
        len(new_tickers), len(existing_tickers), start_floor,
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd python && python -m pytest tests/test_daily_light.py::TestComputeStartRanges -v`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add python/scrapers/daily_prices.py python/tests/test_daily_light.py
git commit -m "feat(daily_prices): add start_floor to cap incremental crawl window"
```

---

### Task 6: Wire `run_daily_light` to the resolved plan

**Files:**
- Modify: `python/run_all.py` (`run_daily_light` body + signature ~lines 248-273; `main()` call site ~line 1234)
- Test: `python/tests/test_daily_light.py`

- [ ] **Step 1: Write the failing test**

Append to `python/tests/test_daily_light.py`:

```python
class TestRunDailyLightWiring:
    def _patch(self, monkeypatch, fresh, mode):
        """Stub freshness + chooser + the three scraper modules; capture calls."""
        import run_all
        calls = {}

        monkeypatch.setattr(run_all, "_daily_light_freshness", lambda today=None: fresh)
        monkeypatch.setattr(run_all, "_choose_daily_light_mode", lambda *a, **k: mode)

        class _Res:
            n_ok = 0

        def make(name):
            def _run(**kwargs):
                calls[name] = kwargs
                return _Res()
            return _run

        dp = type("M", (), {"run": staticmethod(make("daily_prices"))})
        mf = type("M", (), {"run": staticmethod(make("money_flow"))})
        idx = type("M", (), {"run": staticmethod(make("idx_stock_summary"))})
        monkeypatch.setattr(run_all, "_import_scrapers", lambda: (None, dp, None, mf))
        monkeypatch.setattr(run_all, "_import_idx_summary", lambda: idx)
        return calls

    def test_2d_passes_same_window_and_floor(self, monkeypatch):
        import run_all
        fresh = {"idx_stock_summary": date(2026, 6, 10), "broker_flow": date(2026, 6, 9),
                 "daily_prices": date(2026, 6, 11)}
        calls = self._patch(monkeypatch, fresh, "2d")
        run_all.run_daily_light(tickers=None, since="2d")
        # daily_prices gets a start_floor; money_flow + idx get a non-empty dates list
        assert "start_floor" in calls["daily_prices"]
        assert calls["daily_prices"]["start_floor"] is not None
        assert calls["money_flow"]["dates"]
        assert calls["idx_stock_summary"]["dates"]

    def test_idx_skipped_when_dates_empty(self, monkeypatch):
        import run_all
        # idx already current today -> gap yields empty idx_dates -> must NOT call idx
        fresh = {"idx_stock_summary": date(2026, 6, 12), "broker_flow": date(2026, 6, 9),
                 "daily_prices": date(2026, 6, 12)}
        calls = self._patch(monkeypatch, fresh, "gap")
        run_all.run_daily_light(tickers=None, since="gap")
        assert "idx_stock_summary" not in calls   # skipped: empty date list
        assert calls["money_flow"]["dates"]        # broker_flow behind -> still called

    def test_single_ticker_skips_idx(self, monkeypatch):
        import run_all
        fresh = {"idx_stock_summary": date(2026, 6, 10), "broker_flow": date(2026, 6, 9),
                 "daily_prices": date(2026, 6, 11)}
        calls = self._patch(monkeypatch, fresh, "2d")
        run_all.run_daily_light(tickers=["BBRI"], since="2d")
        assert "idx_stock_summary" not in calls    # gated by `if not tickers`
        assert calls["daily_prices"]["tickers"] == ["BBRI"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd python && python -m pytest tests/test_daily_light.py::TestRunDailyLightWiring -v`
Expected: FAIL — `run_daily_light()` has no `since` kwarg (TypeError) / old behavior.

- [ ] **Step 3: Write minimal implementation**

3a. Replace `run_daily_light` (lines 248-273) with:

```python
def run_daily_light(
    tickers: list[str] | None,
    since: str | None = None,
    job_id: int | None = None,
) -> None:
    """
    Lightweight daily refresh: daily_prices -> money_flow -> idx_stock_summary.

    Runs a pre-flight freshness check, resolves a date range (interactive prompt,
    --since flag, or cron default '2d'), and crawls only the chosen dates. See
    docs/superpowers/specs/2026-06-12-daily-light-date-preflight-design.md.
    """
    today = _date.today()
    freshness = _daily_light_freshness(today=today)
    mode = _choose_daily_light_mode(since, freshness, today)
    plan = _resolve_since_dates(mode, freshness, today)
    console.print(f"[cyan]Mode: {mode} — daily_prices start_floor={plan.start_floor}, "
                  f"idx={len(plan.idx_dates)}d, money_flow={len(plan.mf_dates)}d[/cyan]")

    _, dp, _, mf = _import_scrapers()
    console.rule("[bold blue]DAILY-LIGHT: daily_prices")
    _run_tracked(dp.run, "daily_prices", job_id, tickers=tickers, start_floor=plan.start_floor)

    if plan.mf_dates:
        console.rule("[bold blue]DAILY-LIGHT: money_flow")
        _run_tracked(mf.run, "money_flow", job_id, tickers=tickers, dates=plan.mf_dates)
    else:
        console.print("[dim]money_flow up to date — skipping[/dim]")

    # IDX official whole-market summary feeds the money-flow page. Public,
    # ticker-independent endpoint — only on full refreshes (skip single-ticker
    # jobs). Skip when the resolved date list is empty (already current) — an
    # empty list would otherwise fall back to the scraper's own default window.
    if not tickers and plan.idx_dates:
        console.rule("[bold blue]DAILY-LIGHT: idx_stock_summary")
        _run_tracked_optional(_import_idx_summary().run, "idx_stock_summary", None,
                              dates=plan.idx_dates)
```

3b. Update the `main()` call site (~line 1234):

```python
            if args.daily_light:
                run_daily_light(tickers, args.since, job_id=job_id)
```

3c. Update the `--daily-light` flag help text (~line 982) and the module docstring (~line 10) to mention `--since`:

```python
    mode.add_argument("--daily-light", action="store_true",
                      help="Run: daily_prices + money_flow + idx_stock_summary "
                           "(money-flow page data) with a pre-flight freshness check and "
                           "date choice (--since today|2d|gap; prompts if a TTY).")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd python && python -m pytest tests/test_daily_light.py -v`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add python/run_all.py python/tests/test_daily_light.py
git commit -m "feat(run_all): wire --daily-light to freshness-aware date resolution"
```

---

### Task 7: Full-suite regression + manual smoke

**Files:** none (verification only)

- [ ] **Step 1: Run the whole test suite**

Run: `cd python && python -m pytest tests/ -q`
Expected: PASS — no regressions in `test_run_all_modes.py` or others. (Existing `run_daily_light` had no callers in tests besides this plan; if any test referenced the old `days` param, update it to `since`.)

- [ ] **Step 2: Smoke the help + flag validation (no DB writes)**

Run: `cd python && python run_all.py --help | grep -A2 -- --since`
Expected: shows the `--since` flag with `today|2d|gap`.

Run: `cd python && python run_all.py --daily-light --since bogus`
Expected: argparse error (exit ≠ 0), mentions invalid choice.

- [ ] **Step 3: Commit (if any test fixups were needed)**

```bash
git add -A
git commit -m "test: fix up daily-light regressions"
```

(If Step 1 was clean with nothing to change, skip this commit.)

---

## Notes for the implementer

- **Run from `python/`** so imports resolve (`cd python && python -m pytest ...`).
- **No live DB needed** — every test stubs `_max_date`, `_daily_light_freshness`, the chooser, or the scraper modules via `monkeypatch`. Do not hit Supabase in tests.
- **Empty-list guard is load-bearing:** `idx_stock_summary.run(dates=[])` and `money_flow.run(dates=[])` treat an empty list as falsy and fall back to their own yesterday-anchored default. The wiring in Task 6 must skip the call when the list is empty — covered by `test_idx_skipped_when_dates_empty`.
- **`money_flow` is Stockbit-bound** — "today" often has no broker data yet; the scraper logs those dates as `skip` (non-fatal). No special handling required.
- **`_date`/`_timedelta` aliases** in `run_all.py` avoid colliding with the function-local `import datetime as _dt` inside `run_daily` (line ~222). Keep the aliases.
