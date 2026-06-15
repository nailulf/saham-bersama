from __future__ import annotations

"""
run_all.py — Master orchestrator

Controls which scrapers run, in what order, and with what arguments.

Usage:
    python run_all.py --daily          # quarterly (current year) + daily_prices + money_flow + scores + signals
    python run_all.py --daily-light    # daily_prices + money_flow (broker summary) + idx_stock_summary — no quarterly, no signals
    python run_all.py --weekly         # stock_universe
    python run_all.py --quarterly      # financials + company_profiles
    python run_all.py --full           # everything (weekly + quarterly + daily)
    python run_all.py --ticker BBRI    # all scrapers for one stock (testing)
    python run_all.py --broker-backfill   # Stockbit broker flow + bandar signals
    python run_all.py --insider           # KSEI insider transactions
    python run_all.py --compute-signals   # market phases + Wyckoff v1 + Wyckoff v2 + MACD/RSI/volume

    # Mix and match:
    python run_all.py --daily --ticker BBRI ASII
    python run_all.py --quarterly --period annual
"""
import argparse
import logging
import sys
import time
from datetime import datetime, timezone
from typing import NamedTuple

from utils.helpers import setup_logging
from rich.console import Console

console = Console()
logger = logging.getLogger("run_all")

from datetime import date as _date, timedelta as _timedelta


def _recent_trading_dates(n: int, anchor: _date) -> list[_date]:
    """Last N weekdays ending at `anchor` inclusive (weekend-aware).

    If `anchor` is a weekend, the most recent weekday <= anchor is the end of
    the window. Returns ascending dates.
    """
    if n <= 0:
        return []
    out: list[_date] = []
    d = anchor
    while len(out) < n:
        if d.weekday() < 5:  # Mon-Fri
            out.append(d)
        d -= _timedelta(days=1)
    return sorted(out)


def _trading_dates_between(after: _date, through: _date) -> list[_date]:
    """Weekdays d where `after` < d <= `through`. Ascending.

    Returns [] when `after` >= `through` (caller is already up to date) — the
    wiring treats an empty list as "nothing to fetch, skip this scraper".
    """
    out: list[_date] = []
    d = through
    while d > after:
        if d.weekday() < 5:
            out.append(d)
        d -= _timedelta(days=1)
    return sorted(out)


# Tables whose freshness gates the --daily-light run: name -> date column.
_DAILY_LIGHT_TABLES = {
    "idx_stock_summary": "date",
    "broker_flow": "trade_date",
    "daily_prices": "date",
}

# Sentinel for "table has no data at all" — gap is effectively unbounded.
_UNBOUNDED_GAP = 9999


def _max_date(table: str, col: str) -> _date | None:
    """Return MAX(col) from `table` as a date, or None if the table is empty."""
    from utils.supabase_client import get_client
    resp = (
        get_client().table(table).select(col).order(col, desc=True).limit(1).execute()
    )
    rows = resp.data or []
    if not rows:
        return None
    val = rows[0].get(col)
    if val is None:
        return None
    return datetime.strptime(str(val)[:10], "%Y-%m-%d").date()


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
        largest = max(largest, behind if behind is not None else _UNBOUNDED_GAP)
    console.print(f"  [cyan]→ largest gap: {largest if largest < _UNBOUNDED_GAP else 'unbounded'} days[/cyan]")
    return fresh


class DailyLightPlan(NamedTuple):
    idx_dates: list[_date]       # dates for idx_stock_summary.run(dates=...)
    mf_dates: list[_date]        # dates for money_flow.run(dates=...)
    start_floor: _date | None    # daily_prices.run() per-ticker start floor; None in
                                 # "gap" mode -> daily_prices uses its own per-ticker
                                 # incremental fill (each ticker from its last stored date)


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
        return DailyLightPlan(window, list(window), min(window))
    if mode == "2d":
        window = _recent_trading_dates(2, today)
        return DailyLightPlan(window, list(window), min(window))
    if mode == "gap":
        def _gap(last: _date | None) -> list[_date]:
            # No stored data -> fall back to a bounded 2-day window.
            return _trading_dates_between(last, today) if last else _recent_trading_dates(2, today)
        # daily_prices is not date-listed here; in gap mode it keeps its own
        # per-ticker incremental fill, so start_floor stays None (no shared floor).
        return DailyLightPlan(
            _gap(freshness.get("idx_stock_summary")),
            _gap(freshness.get("broker_flow")),
            None,
        )
    raise ValueError(f"unknown --since mode: {mode!r}")


def _prompt_daily_light_mode(freshness: dict[str, _date | None], today: _date) -> str:
    """Interactive menu. Returns 'today' | '2d' | 'gap'. Empty/invalid -> recommended."""
    rec = _recommend_mode(freshness, today)
    console.print("\n[bold]Which dates to fetch?[/bold]")
    console.print("  1) today only")
    console.print("  2) today + previous trading day")
    console.print("  3) fill the gap since last stored date")
    console.print(f"  [dim](press Enter for recommended: {rec})[/dim]")
    try:
        choice = input("Choice [1/2/3]: ").strip()
    except EOFError:
        choice = ""
    return {"1": "today", "2": "2d", "3": "gap", "": rec}.get(choice, rec)


def _choose_daily_light_mode(since: str | None, freshness: dict[str, _date | None],
                             today: _date) -> str:
    """Resolve the mode: explicit flag > interactive prompt (TTY) > cron default '2d'."""
    if since:
        return since
    if sys.stdin.isatty():
        return _prompt_daily_light_mode(freshness, today)
    return "2d"


# Scraper import is deferred to avoid slow imports when only one flag is used
def _import_scrapers():
    from scrapers import stock_universe, daily_prices, company_profiles, money_flow
    return stock_universe, daily_prices, company_profiles, money_flow


def _import_phase2_scrapers():
    from scrapers import document_links, corporate_events
    return document_links, corporate_events


def _import_enrichment_scrapers():
    from scrapers import ratio_enricher, dividend_scraper, gap_filler, financials_fallback
    return ratio_enricher, dividend_scraper, gap_filler, financials_fallback


def _import_market_pulse():
    from scrapers import market_pulse
    return market_pulse


def _import_idx_summary():
    from scrapers import idx_stock_summary
    return idx_stock_summary


# ------------------------------------------------------------------
# Refresh job helpers
# ------------------------------------------------------------------

def _sector_matches(user_term: str, sector: str) -> bool:
    """
    Return True if user_term loosely matches a sector name.

    Matching strategy (applied in order, first match wins):
      1. Substring: "health" matches "Healthcare", "barang" matches "Barang Konsumen Primer"
      2. Reverse substring: "Financials" matches search term "fullfinancials" (edge case)
      3. Fuzzy: SequenceMatcher ratio > 0.70 — catches "finance" → "Financials" (ratio ≈ 0.71)
    """
    from difflib import SequenceMatcher
    u = user_term.lower().strip()
    s = sector.lower().strip()
    if len(u) < 3:
        return u == s
    if u in s or s in u:
        return True
    return SequenceMatcher(None, u, s).ratio() > 0.70


def _tickers_for_sectors(sectors: list[str]) -> list[str]:
    """
    Resolve a list of sector names to their constituent tickers from the DB.

    Sector matching is case-insensitive, supports partial names, and fuzzy matches:
        "finance"  → matches "Financials"
        "energy"   → matches "Energy"
        "consumer" → matches both "Barang Konsumen Primer" and "Barang Konsumen Non-Primer"
        "health"   → matches "Healthcare"

    Raises SystemExit if no tickers are found (likely a typo in sector name).
    """
    from utils.supabase_client import get_client
    db = get_client()
    resp = db.from_("stocks").select("ticker, sector").eq("status", "Active").execute()
    all_stocks = resp.data or []

    matched: list[str] = []
    matched_sectors: set[str] = set()
    for row in all_stocks:
        sector = (row.get("sector") or "").strip()
        if any(_sector_matches(s, sector) for s in sectors):
            matched.append(row["ticker"])
            matched_sectors.add(sector)

    if not matched:
        available = sorted({(r.get("sector") or "").strip() for r in all_stocks if r.get("sector")})
        console.print(f"[red]No tickers found for sector(s): {sectors}[/red]")
        console.print(f"[yellow]Available sectors:[/yellow]")
        for s in available:
            count = sum(1 for r in all_stocks if (r.get("sector") or "").strip() == s)
            console.print(f"  {s}  ({count} stocks)")
        sys.exit(1)

    console.print(f"[cyan]Sector filter → {len(matched)} tickers across: {sorted(matched_sectors)}[/cyan]")
    return sorted(matched)


def _detect_job(tickers: list[str] | None) -> int | None:
    """Auto-detect a pending UI refresh job when running for exactly one ticker."""
    if not tickers or len(tickers) != 1:
        return None
    from utils.supabase_client import get_pending_refresh_job
    job_id = get_pending_refresh_job(tickers[0])
    if job_id:
        logger.info("Detected pending refresh job %d for %s", job_id, tickers[0])
    return job_id


def _run_tracked(scraper_fn, scraper_name: str, job_id: int | None, **kwargs):
    """
    Call scraper_fn(**kwargs). If job_id is set, bracket the call with
    refresh_scraper_progress updates (running → done/failed).
    Exceptions propagate after marking the progress row as failed.
    """
    if job_id is None:
        return scraper_fn(**kwargs)

    from utils.supabase_client import update_refresh_scraper_progress
    update_refresh_scraper_progress(job_id, scraper_name, "running")
    t0 = datetime.now(timezone.utc)
    try:
        result = scraper_fn(**kwargs)
        duration_ms = int((datetime.now(timezone.utc) - t0).total_seconds() * 1000)
        update_refresh_scraper_progress(
            job_id, scraper_name, "done",
            rows_added=result.n_ok,
            duration_ms=duration_ms,
        )
        return result
    except Exception as exc:
        duration_ms = int((datetime.now(timezone.utc) - t0).total_seconds() * 1000)
        update_refresh_scraper_progress(
            job_id, scraper_name, "failed",
            duration_ms=duration_ms,
            error_msg=str(exc),
        )
        raise


def _run_tracked_optional(scraper_fn, scraper_name: str, job_id: int | None, **kwargs):
    """
    Like _run_tracked but non-fatal — exceptions are caught, logged, and the
    progress row is marked 'failed', but execution continues.
    Used for Phase 2 scrapers (document_links, corporate_events) whose DB tables
    may not be created yet, so a failure should never block score recalculation.
    """
    try:
        return _run_tracked(scraper_fn, scraper_name, job_id, **kwargs)
    except Exception as exc:
        logger.warning("Scraper '%s' failed (non-fatal, pipeline continues): %s", scraper_name, exc)
        return None


def _finalize_job(job_id: int, ticker: str, status: str, error_message: str | None = None) -> None:
    """
    Close out a stock_refresh_requests job: write after-scores, set status + finished_at.
    Sets no_new_data=True when the job succeeded but all scrapers added 0 rows.
    """
    from utils.supabase_client import update_refresh_job, fetch_one, fetch_all
    stock = fetch_one("stocks", "completeness_score, confidence_score", {"ticker": ticker.upper()})
    prog = fetch_all("refresh_scraper_progress", "rows_added", {"request_id": job_id})
    total_rows = sum((r.get("rows_added") or 0) for r in prog)
    fields: dict = {
        "status": status,
        "finished_at": datetime.now(timezone.utc).isoformat(),
        "completeness_after": (stock or {}).get("completeness_score"),
        "confidence_after": (stock or {}).get("confidence_score"),
        "no_new_data": (total_rows == 0 and status == "done"),
    }
    if error_message:
        fields["error_message"] = error_message
    update_refresh_job(job_id, **fields)
    logger.info("Finalized refresh job %d: status=%s no_new_data=%s", job_id, status, fields["no_new_data"])


# ------------------------------------------------------------------
# Run modes
# ------------------------------------------------------------------

def run_daily(
    tickers: list[str] | None,
    days: int,
    job_id: int | None = None,
    period: str = "both",
    year_from: int | None = None,
    year_to: int | None = None,
) -> None:
    """
    Runs the daily refresh chain:
        quarterly (current year by default) →
        daily_prices → money_flow → technical_signals

    The quarterly portion (financials, company_profiles, document_links,
    corporate_events) is folded in so latest filings get picked up the same
    day they're published. To keep the daily run fast, year_from/year_to
    default to the current calendar year — pass explicit values to widen.
    """
    import datetime as _dt
    _yr = _dt.date.today().year
    run_quarterly(
        tickers, period, job_id=job_id,
        year_from=year_from if year_from is not None else _yr,
        year_to=year_to if year_to is not None else _yr,
    )

    _, dp, _, mf = _import_scrapers()
    console.rule("[bold blue]DAILY: daily_prices")
    _run_tracked(dp.run, "daily_prices", job_id, tickers=tickers)
    console.rule("[bold blue]DAILY: money_flow")
    _run_tracked(mf.run, "money_flow", job_id, tickers=tickers, days=days)
    # IDX official whole-market summary (public endpoint, ticker-independent).
    # Only on full refreshes — skip on single-ticker jobs to avoid a market-wide
    # scrape. Non-fatal so a down IDX endpoint never blocks the daily chain.
    if not tickers:
        console.rule("[bold blue]DAILY: idx_stock_summary")
        _run_tracked_optional(_import_idx_summary().run, "idx_stock_summary", None, days=days)
    _run_technical_signals(tickers)
    # Market Pulse header data is ticker-independent — refresh once, never tied
    # to a per-ticker job, and never block the daily chain if a feed is down.
    console.rule("[bold blue]DAILY: market_pulse")
    _run_tracked_optional(_import_market_pulse().run, "market_pulse", None)


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
    floor_str = plan.start_floor.isoformat() if plan.start_floor else "per-ticker (gap)"
    console.print(f"[cyan]Mode: {mode} — daily_prices start_floor={floor_str}, "
                  f"idx={len(plan.idx_dates)}d, money_flow={len(plan.mf_dates)}d[/cyan]")

    _, dp, _, mf = _import_scrapers()
    console.rule("[bold blue]DAILY-LIGHT: daily_prices")
    _run_tracked(dp.run, "daily_prices", job_id, tickers=tickers, start_floor=plan.start_floor)

    if plan.mf_dates:
        console.rule("[bold blue]DAILY-LIGHT: money_flow")
        _run_tracked(mf.run, "money_flow", job_id, tickers=tickers, dates=plan.mf_dates)
    else:
        console.print("[dim]money_flow up to date — skipping[/dim]")
        if job_id is not None:
            from utils.supabase_client import update_refresh_scraper_progress
            update_refresh_scraper_progress(job_id, "money_flow", "done", rows_added=0)

    # IDX official whole-market summary feeds the money-flow page. Public,
    # ticker-independent endpoint — only on full refreshes (skip single-ticker
    # jobs). Skip when the resolved date list is empty (already current) — an
    # empty list would otherwise fall back to the scraper's own default window.
    if not tickers and plan.idx_dates:
        console.rule("[bold blue]DAILY-LIGHT: idx_stock_summary")
        _run_tracked_optional(_import_idx_summary().run, "idx_stock_summary", None,
                              dates=plan.idx_dates)


def run_weekly(tickers: list[str] | None, job_id: int | None = None) -> None:
    """Runs: stock_universe"""
    su, *_ = _import_scrapers()
    console.rule("[bold green]WEEKLY: stock_universe")
    _run_tracked(su.run, "stock_universe", job_id, tickers=tickers)


def run_quarterly(tickers: list[str] | None, period: str, job_id: int | None = None,
                   year_from: int | None = None, year_to: int | None = None) -> None:
    """Runs: stockbit financials → company_profiles → docs → events → ratio_enricher"""
    _, _, cp, _ = _import_scrapers()
    dl, ce = _import_phase2_scrapers()
    _, _, _, ff = _import_enrichment_scrapers()
    console.rule("[bold yellow]QUARTERLY: financials (Stockbit)")
    _run_tracked(ff.run, "financials_fallback", job_id,
                 tickers=tickers, source="stockbit", only_missing=False,
                 annual=(period in ("annual", "both")),
                 quarterly=(period in ("quarterly", "both")),
                 year_from=year_from, year_to=year_to)
    console.rule("[bold yellow]QUARTERLY: company_profiles")
    _run_tracked(cp.run, "company_profiles", job_id, tickers=tickers)
    console.rule("[bold yellow]QUARTERLY: document_links")
    _run_tracked_optional(dl.run, "document_links", job_id, tickers=tickers)
    console.rule("[bold yellow]QUARTERLY: corporate_events")
    _run_tracked_optional(ce.run, "corporate_events", job_id, tickers=tickers)
    # Always re-enrich ratios after new financials land so PEG and other
    # cross-row metrics stay current without a separate manual step.
    run_enrich_ratios(tickers)


def run_enrich_ratios(tickers: list[str] | None, dry_run: bool = False) -> None:
    """Runs: ratio_enricher"""
    re_, _, _, _ = _import_enrichment_scrapers()
    console.rule("[bold magenta]ENRICH: ratio_enricher")
    _run_tracked(re_.run, "ratio_enricher", None, tickers=tickers, dry_run=dry_run)


def run_dividends(tickers: list[str] | None, job_id: int | None = None) -> None:
    """Runs: dividend_scraper"""
    _, ds, _, _ = _import_enrichment_scrapers()
    console.rule("[bold magenta]ENRICH: dividend_scraper")
    _run_tracked(ds.run, "dividend_scraper", job_id, tickers=tickers)


def run_market_pulse(indicators_only: bool = False, news_only: bool = False) -> None:
    """Runs: market_pulse (homepage header indicators + news). Ticker-independent."""
    mp = _import_market_pulse()
    console.rule("[bold blue]MARKET PULSE: indicators + news")
    mp.run(indicators_only=indicators_only, news_only=news_only)


def run_financials_fallback(
    tickers: list[str] | None,
    source: str,
    only_missing: bool,
    dry_run: bool = False,
    year_from: int | None = None,
    year_to: int | None = None,
) -> None:
    """Runs: financials from Stockbit (standalone)"""
    _, _, _, ff = _import_enrichment_scrapers()
    console.rule("[bold magenta]STOCKBIT: financials")
    _run_tracked(ff.run, "financials_fallback", None,
                 tickers=tickers, source=source, only_missing=only_missing, dry_run=dry_run,
                 year_from=year_from, year_to=year_to)


def run_fill_gaps(
    tickers: list[str] | None,
    min_score: int,
    limit: int | None,
    categories: list[str] | None,
    dry_run: bool = False,
) -> None:
    """Runs: gap_filler"""
    _, _, gf, _ = _import_enrichment_scrapers()
    console.rule("[bold magenta]GAPS: gap_filler")
    gf.run(
        tickers=tickers,
        min_score=min_score,
        limit=limit,
        categories=categories,
        dry_run=dry_run,
    )


def run_broker_backfill(tickers: list[str] | None, days: int = 30,
                        offset: int = 0, limit: int | None = None,
                        job_id: int | None = None) -> None:
    """Runs: money_flow broker backfill from Stockbit"""
    from scrapers.money_flow import run_broker_backfill as _backfill
    console.rule("[bold blue]BROKER BACKFILL: broker_flow + bandar_signal")
    _run_tracked(_backfill, "broker_backfill", job_id,
                 tickers=tickers, days=days, offset=offset, limit=limit)


def run_insider(tickers: list[str] | None, max_pages: int = 5,
                offset: int = 0, limit: int | None = None,
                days: int | None = None) -> None:
    """Runs: money_flow insider scrape from Stockbit/KSEI"""
    from scrapers.money_flow import run_insider_scrape as _insider
    console.rule("[bold blue]INSIDER: insider_transactions (KSEI)")
    _insider(tickers=tickers, max_pages=max_pages, offset=offset, limit=limit, days=days)


def run_full(tickers: list[str] | None, period: str, days: int, job_id: int | None = None,
             year_from: int | None = None, year_to: int | None = None,
             scraper_filter: set[str] | None = None,
             backfill_days: int = 90, offset: int = 0, batch_limit: int | None = None,
             ai_provider: str = "openai", ai_model: str | None = None,
             min_composite: int = 50, dry_run: bool = False) -> None:
    """Runs everything in dependency order. Scores updated once at the end.

    If scraper_filter is set, only matching scrapers execute; others are skipped
    (their progress rows are marked 'done' with rows_added=0 when job_id is set).
    """
    def _should_run(name: str) -> bool:
        if scraper_filter is None:
            return True
        if name in scraper_filter:
            return True
        # Mark skipped scrapers as done in the progress table
        if job_id is not None:
            from utils.supabase_client import update_refresh_scraper_progress
            update_refresh_scraper_progress(job_id, name, "done", rows_added=0)
        logger.info("Skipping %s (not in scraper filter)", name)
        return False

    su, dp, cp, mf = _import_scrapers()
    dl, ce = _import_phase2_scrapers()
    _, _, _, ff = _import_enrichment_scrapers()
    if _should_run("stock_universe"):
        console.rule("[bold green]WEEKLY: stock_universe")
        _run_tracked(su.run, "stock_universe", job_id, tickers=tickers)
    if _should_run("financials_fallback"):
        console.rule("[bold yellow]QUARTERLY: financials (Stockbit)")
        _run_tracked(ff.run, "financials_fallback", job_id,
                     tickers=tickers, source="stockbit", only_missing=False,
                     annual=(period in ("annual", "both")),
                     quarterly=(period in ("quarterly", "both")),
                     year_from=year_from, year_to=year_to)
    if _should_run("company_profiles"):
        console.rule("[bold yellow]QUARTERLY: company_profiles")
        _run_tracked(cp.run, "company_profiles", job_id, tickers=tickers)
    if _should_run("document_links"):
        console.rule("[bold yellow]QUARTERLY: document_links")
        _run_tracked_optional(dl.run, "document_links", job_id, tickers=tickers)
    if _should_run("corporate_events"):
        console.rule("[bold yellow]QUARTERLY: corporate_events")
        _run_tracked_optional(ce.run, "corporate_events", job_id, tickers=tickers)
    if _should_run("daily_prices"):
        console.rule("[bold blue]DAILY: daily_prices")
        _run_tracked(dp.run, "daily_prices", job_id, tickers=tickers)
    if _should_run("money_flow"):
        console.rule("[bold blue]DAILY: money_flow")
        _run_tracked(mf.run, "money_flow", job_id, tickers=tickers, days=days)
    if _should_run("broker_backfill"):
        from scrapers.money_flow import run_broker_backfill as _backfill
        console.rule("[bold blue]FULL: broker_flow + bandar_signal (backfill)")
        _run_tracked(_backfill, "broker_backfill", job_id,
                     tickers=tickers, days=backfill_days, offset=offset, limit=batch_limit)

    # ── Enrich ratios (denormalize PE/PBV/ROE etc. to stocks table) ──
    if _should_run("ratio_enricher"):
        console.rule("[bold cyan]ENRICH: screener ratios")
        run_enrich_ratios(tickers, dry_run=dry_run)

    # ── Phase 7: Market phase detection ──
    if _should_run("market_phases"):
        _run_market_phase_detection(tickers, dry_run=dry_run)

    # ── Phase 8: Technical signals (MACD, RSI, volume) ──
    if _should_run("technical_signals"):
        _run_technical_signals(tickers, dry_run=dry_run)

    # ── Market Pulse header data (ticker-independent; non-fatal) ──
    if _should_run("market_pulse"):
        console.rule("[bold blue]FULL: market_pulse (indicators + news)")
        _run_tracked_optional(_import_market_pulse().run, "market_pulse", job_id)

    # ── Phase 6: AI pipeline (context + analysis) ──
    if _should_run("ai_context"):
        _run_ai_context_pipeline(tickers, job_id=job_id, dry_run=dry_run)
    if _should_run("ai_analysis"):
        _run_ai_analysis_pipeline(
            tickers, provider=ai_provider, model=ai_model,
            min_composite=min_composite, job_id=job_id, dry_run=dry_run,
        )


# ------------------------------------------------------------------
# CLI
# ------------------------------------------------------------------

# ------------------------------------------------------------------
# Phase 6: AI pipeline functions
# ------------------------------------------------------------------

def _run_market_phase_detection(
    tickers: list[str] | None,
    dry_run: bool = False,
) -> None:
    """
    Phase 7: Detect market cycle phases from price/volume patterns.
    Writes to: market_phases table.
    """
    from scripts.analysis.market_phase_detector import MarketPhaseDetector

    console.rule("[bold cyan]PHASE 7: Market Phase Detection[/bold cyan]")

    detector = MarketPhaseDetector()
    results = detector.detect_batch(tickers, dry_run=dry_run)

    ok = sum(1 for v in results.values() if v >= 0)
    failed = sum(1 for v in results.values() if v < 0)
    total_phases = sum(v for v in results.values() if v > 0)

    console.print(
        f"[green]Phase detection complete:[/green] "
        f"{ok} tickers processed, {total_phases} phases detected, {failed} failed"
    )


def _run_wyckoff_detection(
    tickers: list[str] | None,
    dry_run: bool = False,
) -> None:
    """
    Phase 7b v1: Detect Wyckoff structural events from price/volume bars (flat-pass).
    Writes to: wyckoff_events table with detection_version='1.0'.
    """
    from scripts.analysis.wyckoff_detector import WyckoffDetector

    console.rule("[bold cyan]PHASE 7b v1: Wyckoff Structural Events (flat-pass)[/bold cyan]")

    detector = WyckoffDetector()
    results = detector.detect_batch(tickers, dry_run=dry_run)

    ok = sum(1 for v in results.values() if v >= 0)
    failed = sum(1 for v in results.values() if v < 0)
    total_events = sum(v for v in results.values() if v > 0)

    console.print(
        f"[green]Wyckoff v1 detection complete:[/green] "
        f"{ok} tickers processed, {total_events} events detected, {failed} failed"
    )


def _run_wyckoff_v2_detection(
    tickers: list[str] | None,
    dry_run: bool = False,
) -> None:
    """
    Phase 7b v2: FSM-based Wyckoff detector (sequence-enforced).
    Writes to: wyckoff_events table with detection_version='2.0' and
    denormalizes latest event + final FSM phase onto stocks.* v2 columns.
    """
    from scripts.analysis.wyckoff_detector_v2 import WyckoffDetectorV2

    console.rule("[bold cyan]PHASE 7b v2: Wyckoff FSM Detection[/bold cyan]")

    detector = WyckoffDetectorV2()
    results = detector.detect_batch(tickers, dry_run=dry_run)

    ok = sum(1 for v in results.values() if v >= 0)
    failed = sum(1 for v in results.values() if v < 0)
    total_events = sum(v for v in results.values() if v > 0)

    console.print(
        f"[green]Wyckoff v2 detection complete:[/green] "
        f"{ok} tickers processed, {total_events} events detected, {failed} failed"
    )


def _run_technical_signals(
    tickers: list[str] | None,
    dry_run: bool = False,
) -> None:
    """
    Phase 8: Compute MACD, RSI, volume change from price data.
    Writes to: technical_signals table + denormalized to stocks table.
    """
    from scripts.analysis.technical_signal_detector import TechnicalSignalDetector

    console.rule("[bold cyan]PHASE 8: Technical Signals (MACD / RSI / Volume)[/bold cyan]")

    detector = TechnicalSignalDetector()
    results = detector.compute_batch(tickers, dry_run=dry_run)

    ok = sum(1 for v in results.values() if v >= 0)
    failed = sum(1 for v in results.values() if v < 0)
    total_rows = sum(v for v in results.values() if v > 0)

    console.print(
        f"[green]Technical signals complete:[/green] "
        f"{ok} tickers processed, {total_rows} signal rows, {failed} failed"
    )


def _run_ai_context_pipeline(
    tickers: list[str] | None,
    job_id: int | None = None,
    dry_run: bool = False,
) -> None:
    """
    Phase 6 Stages 1-4: clean → normalize → score → build context bundle.
    Writes to: data_quality_flags, normalized_metrics, stock_scores, ai_context_cache.
    """
    from scripts.scoring.data_cleaner import DataCleaner
    from scripts.scoring.data_normalizer import DataNormalizer
    from scripts.scoring.scoring_engine import ScoringPipeline
    from scripts.scoring.context_builder import ContextBuilder
    from utils.supabase_client import get_client

    console.rule("[bold cyan]PHASE 6: Build AI Context[/bold cyan]")

    sb = get_client()
    cleaner = DataCleaner()
    normalizer = DataNormalizer()
    scorer = ScoringPipeline()
    builder = ContextBuilder()

    # Resolve tickers
    if tickers is None:
        resp = sb.table("stocks").select("ticker").eq("status", "Active").execute()
        tickers = [r["ticker"] for r in (resp.data or [])]
    console.print(f"[cyan]Processing {len(tickers)} tickers[/cyan]")

    from datetime import timedelta
    from utils.helpers import RunResult
    result = RunResult("ai_context_pipeline")

    for ticker in tickers:
        try:
            # Fetch data
            stock = (sb.table("stocks").select("*").eq("ticker", ticker).execute().data or [{}])[0]
            financials = (sb.table("financials").select("*")
                         .eq("ticker", ticker).eq("quarter", 0).order("year").execute().data or [])

            if not financials:
                result.skip(ticker, "no annual financials")
                continue

            # Stage 1: Clean
            clean_rows, flags, cleaning = cleaner.clean_ticker(financials, stock)

            # Stage 2: Normalize
            metrics = normalizer.normalize(clean_rows, flags, stock)

            # Stage 3: Score
            score = scorer.run(metrics, flags, clean_rows, stock)

            # Stage 4: Build context
            price = (sb.table("daily_prices").select("date, close")
                     .eq("ticker", ticker).order("date", desc=True).limit(1).execute().data or [{}])[0]

            cutoff_30d = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
            broker_flow = (sb.table("broker_flow").select("trade_date, broker_type, net_value")
                          .eq("ticker", ticker).gte("trade_date", cutoff_30d).execute().data or [])

            bandar = (sb.table("bandar_signal").select("trade_date, broker_accdist, top5_accdist")
                     .eq("ticker", ticker).order("trade_date", desc=True).limit(1).execute().data or [None])[0]

            cutoff_90d = (datetime.now() - timedelta(days=90)).strftime("%Y-%m-%d")
            insiders = (sb.table("insider_transactions").select("action, ownership_change_pct")
                       .eq("ticker", ticker).gte("transaction_date", cutoff_90d).execute().data or [])

            shareholders = (sb.table("shareholders_major").select("holder_name, holder_type, percentage")
                           .eq("ticker", ticker).order("percentage", desc=True).limit(5).execute().data or [])

            # Domain notes (optional)
            notes_row = (sb.table("stock_notes").select("domain_notes")
                        .eq("ticker", ticker).execute().data or [{}])[0]
            domain_notes = notes_row.get("domain_notes")

            # Sector template (optional)
            subsector = stock.get("subsector")
            template_row = (sb.table("sector_templates").select("*")
                           .eq("subsector", subsector).execute().data or [{}])[0] if subsector else {}

            # Block 9: technical context data (need ≥200 price rows for SMA-200)
            price_history = (sb.table("daily_prices").select("date, close, volume")
                             .eq("ticker", ticker).order("date", desc=True).limit(210).execute().data or [])
            tech_signals = (sb.table("technical_signals")
                            .select("date, rsi_14, macd_line, macd_signal, macd_histogram, volume_sma_20, volume_change_pct")
                            .eq("ticker", ticker).order("date", desc=True).limit(30).execute().data or [])
            wyckoff_evts = (sb.table("wyckoff_events")
                            .select("event_type, event_date, price, confidence, inferred_phase, notes, detection_version")
                            .eq("ticker", ticker).order("event_date", desc=True).limit(5).execute().data or [])
            mkt_phase = (sb.table("market_phases")
                         .select("phase_type, trend_strength, change_pct, days, start_date, range_low, range_high, smart_money_alignment, broker_flow_alignment")
                         .eq("ticker", ticker).eq("is_current", True).limit(1).execute().data or [{}])[0]

            # Block 10: quarterly financials (last 8 quarters for QoQ/YoY)
            quarterly_rows = (sb.table("financials")
                              .select("year,quarter,revenue,net_income,net_margin,gross_margin,operating_income,eps")
                              .eq("ticker", ticker).gt("quarter", 0)
                              .order("year", desc=True).order("quarter", desc=True)
                              .limit(8).execute().data or [])

            # Block 11: dividend history (last 10 dividends for TTM DPS + yield)
            dividend_history_rows = (sb.table("dividend_history")
                                     .select("ex_date,amount")
                                     .eq("ticker", ticker)
                                     .order("ex_date", desc=True)
                                     .limit(10).execute().data or [])

            bundle = builder.build(
                ticker=ticker, stock=stock, metrics=metrics, score=score,
                flags=flags, clean_rows=clean_rows, latest_price=price,
                broker_flow_30d=broker_flow, bandar_latest=bandar,
                insider_90d=insiders, shareholders=shareholders,
                domain_notes=domain_notes,
                sector_template=template_row if template_row.get("subsector") else None,
                price_history=price_history,
                technical_signals=tech_signals,
                wyckoff_events=wyckoff_evts,
                market_phase=mkt_phase if mkt_phase.get("phase_type") else None,
                quarterly_rows=quarterly_rows,
                dividend_history_rows=dividend_history_rows,
            )

            if not dry_run:
                import json
                # Write data_quality_flags
                flag_rows = []
                for yr, f in flags.items():
                    flag_rows.append({
                        "ticker": ticker, "year": yr,
                        "is_covid_year": f.is_covid_year, "is_ipo_year": f.is_ipo_year,
                        "has_anomaly": f.has_anomaly, "has_one_time_items": f.has_one_time_items,
                        "scale_warning": f.scale_warning, "source_conflict": f.source_conflict,
                        "usability_flag": f.usability_flag,
                        "anomaly_metrics": json.dumps(f.anomaly_metrics) if f.anomaly_metrics else None,
                        "cleaner_notes": json.dumps(f.notes) if f.notes else None,
                    })
                if flag_rows:
                    sb.table("data_quality_flags").upsert(flag_rows, on_conflict="ticker,year").execute()

                # Write normalized_metrics
                metric_rows = []
                for m in metrics:
                    metric_rows.append({
                        "ticker": ticker, "metric_name": m.metric_name, "unit": m.unit,
                        "latest_value": m.latest_value, "latest_year": m.latest_year,
                        "cagr_full": m.cagr_full, "cagr_3yr": m.cagr_3yr, "cagr_5yr": m.cagr_5yr,
                        "trend_direction": m.trend_direction, "trend_r2": m.trend_r2,
                        "trend_slope_pct": m.trend_slope_pct, "volatility": m.volatility,
                        "z_score_vs_sector": m.z_score_vs_sector,
                        "percentile_vs_sector": m.percentile_vs_sector,
                        "peer_group_level": m.peer_group_level, "peer_count": m.peer_count,
                        "data_years_count": m.data_years_count,
                        "anomaly_years": json.dumps(m.anomaly_years) if m.anomaly_years else None,
                        "missing_years": json.dumps(m.missing_years) if m.missing_years else None,
                        "years_json": json.dumps(m.years), "values_json": json.dumps(m.values),
                    })
                if metric_rows:
                    sb.table("normalized_metrics").upsert(metric_rows, on_conflict="ticker,metric_name").execute()

                # Write stock_scores
                sb.table("stock_scores").upsert({
                    "ticker": ticker,
                    "reliability_total": score.reliability_total,
                    "reliability_grade": score.reliability_grade,
                    "reliability_completeness": score.reliability_completeness,
                    "reliability_consistency": score.reliability_consistency,
                    "reliability_freshness": score.reliability_freshness,
                    "reliability_source": score.reliability_source,
                    "reliability_penalties": score.reliability_penalties,
                    "confidence_total": score.confidence_total,
                    "confidence_grade": score.confidence_grade,
                    "confidence_signal": score.confidence_signal,
                    "confidence_trend": score.confidence_trend,
                    "confidence_depth": score.confidence_depth,
                    "confidence_peers": score.confidence_peers,
                    "confidence_valuation": score.confidence_valuation,
                    "composite_score": score.composite_score,
                    "ready_for_ai": score.ready_for_ai,
                    "bullish_signals": json.dumps(score.bullish_signals),
                    "bearish_signals": json.dumps(score.bearish_signals),
                    "data_gap_flags": json.dumps(score.data_gap_flags),
                    "missing_metrics": json.dumps(score.missing_metrics),
                    "data_years_available": score.data_years_available,
                    "primary_source": score.primary_source,
                    "sector_peers_count": score.sector_peers_count,
                }, on_conflict="ticker").execute()

                # Write ai_context_cache
                sb.table("ai_context_cache").upsert({
                    "ticker": ticker,
                    "context_json": bundle.context,
                    "context_version": bundle.context_version,
                    "token_estimate": bundle.token_estimate,
                    "ready_for_ai": bundle.ready_for_ai,
                    "data_as_of": price.get("date"),
                }, on_conflict="ticker").execute()

            console.print(
                f"  [green]✓[/green] {ticker}: reliability={score.reliability_grade} "
                f"confidence={score.confidence_grade} composite={score.composite_score} "
                f"ready={'✓' if score.ready_for_ai else '✗'} tokens={bundle.token_estimate}"
            )
            result.ok(ticker)

        except Exception as e:
            logger.warning("AI context failed for %s: %s", ticker, e, exc_info=True)
            result.fail(ticker, str(e))

    result.print_summary()


def _run_ai_analysis_pipeline(
    tickers: list[str] | None,
    provider: str = "openai",
    model: str | None = None,
    min_composite: int = 50,
    job_id: int | None = None,
    dry_run: bool = False,
) -> None:
    """
    Phase 6 Stage 5: Call LLM to generate investment thesis.
    Reads from ai_context_cache, writes to ai_analysis.
    """
    from scripts.scoring.ai_analyst import AIAnalyst
    from utils.supabase_client import get_client, update_refresh_scraper_progress

    console.rule("[bold cyan]PHASE 6: AI Analysis[/bold cyan]")

    sb = get_client()
    analyst = AIAnalyst(provider=provider, model=model)
    console.print(f"[cyan]Provider: {analyst.provider_name} / Model: {analyst.model_name}[/cyan]")

    # Get tickers with context cache
    query = sb.table("ai_context_cache").select("ticker, context_json, ready_for_ai")
    if tickers:
        query = query.in_("ticker", tickers)
    rows = query.execute().data or []

    if not rows:
        console.print("[yellow]No tickers with context cache found. Run --build-ai-context first.[/yellow]")
        return

    # For batch runs (no explicit tickers), apply min_composite to save API costs
    is_batch = tickers is None
    if is_batch and min_composite > 0:
        score_resp = sb.table("stock_scores").select("ticker, composite_score").execute()
        score_map = {r["ticker"]: r.get("composite_score", 0) for r in (score_resp.data or [])}
        rows = [r for r in rows if score_map.get(r["ticker"], 0) >= min_composite]
        console.print(f"[cyan]Analyzing {len(rows)} tickers (batch mode, composite>={min_composite})[/cyan]")
    else:
        low_quality = [r["ticker"] for r in rows if not r.get("ready_for_ai")]
        if low_quality:
            console.print(f"[yellow]Note: {low_quality} have low data quality — AI will reason about data gaps in its analysis[/yellow]")
        console.print(f"[cyan]Analyzing {len(rows)} tickers[/cyan]")

    from utils.helpers import RunResult
    result = RunResult("ai_analysis")

    if job_id:
        update_refresh_scraper_progress(job_id, "ai_analyst", "running")

    for row in rows:
        ticker = row["ticker"]
        context = row["context_json"]
        if isinstance(context, str):
            import json
            context = json.loads(context)

        try:
            # Get score metadata for validation
            score_row = (sb.table("stock_scores").select("reliability_grade, data_gap_flags")
                        .eq("ticker", ticker).execute().data or [{}])[0]

            current_price = context.get("valuation", {}).get("current_price")
            data_gaps = score_row.get("data_gap_flags")
            if isinstance(data_gaps, str):
                import json
                data_gaps = json.loads(data_gaps)

            # Get sector template and domain notes
            subsector = context.get("sub_sector")
            template = (sb.table("sector_templates").select("*")
                       .eq("subsector", subsector).execute().data or [{}])[0] if subsector else {}
            notes_row = (sb.table("stock_notes").select("domain_notes")
                        .eq("ticker", ticker).execute().data or [{}])[0]

            if dry_run:
                console.print(f"  [dim]DRY RUN: {ticker} — would call {analyst.model_name}[/dim]")
                result.ok(ticker)
                continue

            analysis = analyst.analyze(
                context_bundle=context,
                current_price=current_price,
                data_gap_flags=data_gaps,
                reliability_grade=score_row.get("reliability_grade"),
                sector_template=template if template.get("subsector") else None,
                domain_notes=notes_row.get("domain_notes"),
            )

            if analysis.success:
                import json
                from datetime import datetime, timezone
                sb.table("ai_analysis").upsert({
                    "ticker": ticker,
                    "lynch_category": analysis.lynch_category,
                    "lynch_rationale": analysis.lynch_rationale,
                    "buffett_moat": analysis.buffett_moat,
                    "buffett_moat_source": analysis.buffett_moat_source,
                    "business_narrative": analysis.business_narrative,
                    "financial_health_signal": analysis.financial_health_signal,
                    "analyst_verdict": analysis.analyst_verdict,
                    "confidence_level": analysis.confidence_level,
                    "bull_case": analysis.bull_case,
                    "bear_case": analysis.bear_case,
                    "neutral_case": analysis.neutral_case,
                    "strategy_fit": analysis.strategy_fit,
                    "what_to_watch": analysis.what_to_watch,
                    "caveats": analysis.caveats,
                    "data_gaps_acknowledged": analysis.data_gaps_acknowledged,
                    "model_used": analyst.model_name,
                    "prompt_tokens": analysis.prompt_tokens,
                    "output_tokens": analysis.output_tokens,
                    "generated_at": datetime.now(timezone.utc).isoformat(),
                }, on_conflict="ticker").execute()

                console.print(
                    f"  [green]✓[/green] {ticker}: {analysis.lynch_category} / "
                    f"{analysis.analyst_verdict} / confidence={analysis.confidence_level} "
                    f"(${analysis.cost_usd_estimate:.4f})"
                )
                result.ok(ticker)
                if job_id:
                    update_refresh_scraper_progress(job_id, "ai_analyst", "done", rows_added=1)
            else:
                console.print(f"  [red]✗[/red] {ticker}: {analysis.error}")
                result.fail(ticker, analysis.error or "unknown")
                if job_id:
                    update_refresh_scraper_progress(job_id, "ai_analyst", "failed", error_msg=analysis.error or "unknown")

        except Exception as e:
            logger.warning("AI analysis failed for %s: %s", ticker, e, exc_info=True)
            result.fail(ticker, str(e))
            if job_id:
                update_refresh_scraper_progress(job_id, "ai_analyst", "failed", error_msg=str(e))

    result.print_summary()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="IDX Stock Analyzer — Data Pipeline Orchestrator",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python run_all.py --daily
  python run_all.py --weekly
  python run_all.py --quarterly
  python run_all.py --full
  python run_all.py --ticker BBRI ASII BBCA
  python run_all.py --daily --ticker BBRI
  python run_all.py --quarterly --period annual

  # Sector-based scraping (partial match, case-insensitive):
  python run_all.py --fallback-financials --sector finance
  python run_all.py --quarterly --sector energy
  python run_all.py --fallback-financials --sector "barang konsumen"   # both consumer sectors
  python run_all.py --daily --sector healthcare technology
  python run_all.py --fallback-financials --sector finance --dry-run

  # Enrichment & gap filling:
  python run_all.py --enrich-ratios                    # fill NULL ratios + refresh screener CAGR (stale >1mo)
  python run_all.py --enrich-ratios --ticker BBRI      # single ticker
  python run_all.py --enrich-ratios --dry-run          # preview only
  python run_all.py --dividends                        # fetch all dividend history
  python run_all.py --fill-gaps                        # fix top-100 most incomplete stocks
  python run_all.py --fill-gaps --min-score 50         # only very incomplete stocks
  python run_all.py --fill-gaps --gap-limit 20         # process 20 stocks per run
  python run_all.py --fill-gaps --gap-category ratios prices  # specific gap types
  python run_all.py --fill-gaps --dry-run              # detect gaps, no writes
  python run_all.py --fallback-financials              # Stockbit backfill (only missing)
  python run_all.py --fallback-financials --ticker BBRI --dry-run

  # Broker flow & insider transactions (Stockbit):
  python run_all.py --broker-backfill                  # last 30 days, top stocks by mcap
  python run_all.py --broker-backfill --backfill-days 60 --ticker BBRI
  python run_all.py --broker-backfill --offset 100 --batch-limit 50
  python run_all.py --insider                          # KSEI insider transactions
  python run_all.py --insider --ticker BBRI --insider-pages 10

  # Full pipeline with AI analysis:
  python run_all.py --full --ticker BBRI                       # scrape + AI (openai default)
  python run_all.py --full --ticker BBRI --ai-provider anthropic
  python run_all.py --full --ticker BBRI --dry-run             # scrape only, skip AI writes

  # Market phase detection:
  python run_all.py --detect-phases                            # all active tickers
  python run_all.py --detect-phases --ticker BBCA BBRI         # specific tickers
  python run_all.py --detect-phases --dry-run                  # detect but don't save
        """,
    )

    # Mode flags (at least one required)
    mode = parser.add_argument_group("Run modes (pick one or more)")
    mode.add_argument("--daily", action="store_true",
                      help="Run: quarterly (current year) + daily_prices + money_flow + technical_signals")
    mode.add_argument("--daily-light", action="store_true",
                      help="Run: daily_prices + money_flow + idx_stock_summary "
                           "(money-flow page data) with a pre-flight freshness check and "
                           "date choice (--since today|2d|gap; prompts if a TTY).")
    mode.add_argument("--weekly", action="store_true", help="Run: stock_universe")
    mode.add_argument("--quarterly", action="store_true",
                      help="Run: financials + company_profiles + docs + events "
                           "(full history by default; --daily folds this in for current year)")
    mode.add_argument("--full", action="store_true", help="Run everything (weekly + quarterly + daily + broker backfill + AI analysis)")
    mode.add_argument("--enrich-ratios", action="store_true", help="Fill NULL ratio columns + refresh screener CAGR/div-yield for stocks stale >1mo (no API calls)")
    mode.add_argument("--dividends", action="store_true", help="Fetch full dividend history from yfinance")
    mode.add_argument("--fill-gaps", action="store_true", help="Detect and fill data gaps for low-completeness stocks")
    mode.add_argument("--fallback-financials", action="store_true", help="Run Stockbit financials standalone (primary source, fills all tickers)")
    mode.add_argument("--broker-backfill", action="store_true", help="Backfill broker flow + bandar signals from Stockbit")
    mode.add_argument("--insider", action="store_true", help="Fetch KSEI insider transactions from Stockbit")

    # Phase 6: AI pipeline modes
    mode.add_argument("--build-ai-context", action="store_true",
                      help="Phase 6: clean → normalize → score → build AI context bundle")
    mode.add_argument("--run-ai-analysis", action="store_true",
                      help="Phase 6: call LLM to generate investment thesis (requires ai_context_cache)")
    mode.add_argument("--ai-full", action="store_true",
                      help="Phase 6: full pipeline = build-ai-context + run-ai-analysis")

    # Phase 7: Market phase detection
    mode.add_argument("--detect-phases", action="store_true",
                      help="Phase 7: detect market cycle phases from price/volume patterns")

    # Phase 7b: Wyckoff structural events (climaxes, springs, UTAD, absorption)
    mode.add_argument("--detect-wyckoff", action="store_true",
                      help="Phase 7b v1: flat-pass Wyckoff detector (SC/BC, Spring/UTAD, passive drifts)")
    mode.add_argument("--detect-wyckoff-v2", action="store_true",
                      help="Phase 7b v2: FSM-based Wyckoff detector (sequence-enforced, fine-grained phases)")

    # Phase 8: Technical signals
    mode.add_argument("--compute-signals", action="store_true",
                      help="Phase 7+8: market phase detection + Wyckoff v1 + Wyckoff v2 FSM + MACD/RSI/volume signals")

    # Market Pulse: homepage header indicators + news (ticker-independent)
    mode.add_argument("--market-pulse", action="store_true",
                      help="Refresh homepage Market Pulse data (FX/commodity/index indicators + RSS news)")

    # Scope modifiers
    parser.add_argument("--ticker", nargs="+", metavar="TICKER", help="Limit to specific tickers")
    parser.add_argument(
        "--sector",
        nargs="+",
        metavar="SECTOR",
        help="Limit to tickers in these sectors (case-insensitive, partial match). "
             "E.g. --sector finance energy  or  --sector 'Barang Konsumen'",
    )
    parser.add_argument(
        "--job-id",
        type=int,
        default=None,
        metavar="ID",
        help="Link this run to a stock_refresh_requests job (auto-detected for single --ticker runs)",
    )
    parser.add_argument(
        "--period",
        choices=["annual", "quarterly", "both"],
        default="both",
        help="Financials period type (default: both)",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=2,
        help="Number of recent trading days for money_flow (default: 2)",
    )
    parser.add_argument(
        "--since",
        choices=["today", "2d", "gap"],
        default=None,
        help="--daily-light: which dates to fetch — today, 2d (today+prev), or gap "
             "(fill since last stored date). Omit for an interactive prompt; "
             "non-interactive runs default to 2d.",
    )
    # Gap filler options
    parser.add_argument(
        "--min-score",
        type=int,
        default=70,
        metavar="N",
        help="--fill-gaps: process stocks with completeness < N (default: 70)",
    )
    parser.add_argument(
        "--gap-limit",
        type=int,
        default=100,
        metavar="N",
        help="--fill-gaps: max tickers to process per run (default: 100)",
    )
    parser.add_argument(
        "--gap-category",
        nargs="+",
        metavar="CAT",
        help="--fill-gaps: limit to specific gap categories "
             "(prices, financials_annual, financials_quarterly, ratios, profile, officers, shareholders, dividends)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="--fill-gaps / --enrich-ratios / --fallback-financials: detect issues but do not write to DB",
    )
    # Fallback financials options
    parser.add_argument(
        "--fallback-all",
        action="store_true",
        help="--fallback-financials: process all tickers even if data exists (default: only missing)",
    )
    # Broker backfill / insider options
    parser.add_argument(
        "--backfill-days",
        type=int,
        default=90,
        metavar="N",
        help="--broker-backfill / --full: number of days to backfill (default: 90)",
    )
    parser.add_argument(
        "--insider-pages",
        type=int,
        default=5,
        metavar="N",
        help="--insider: max pages per ticker (default: 5; hard ceiling even with --insider-days)",
    )
    parser.add_argument(
        "--insider-days",
        type=int,
        default=None,
        metavar="N",
        help="--insider: only keep transactions from the last N days (stops paging early once crossed)",
    )
    parser.add_argument(
        "--offset",
        type=int,
        default=0,
        metavar="N",
        help="--broker-backfill / --insider: skip first N tickers (for batching)",
    )
    parser.add_argument(
        "--batch-limit",
        type=int,
        default=None,
        metavar="N",
        help="--broker-backfill / --insider: max tickers to process (for batching)",
    )
    # Scraper filter (for selective refresh from UI)
    parser.add_argument(
        "--scrapers",
        type=str,
        default="",
        help="Comma-separated scraper names to run. When set, only matching scrapers execute "
             "in --full mode. Others are skipped. Empty = run all (default).",
    )
    # Phase 6: AI pipeline options
    parser.add_argument(
        "--ai-provider",
        type=str,
        default="openai",
        choices=["openai", "anthropic"],
        help="LLM provider for --run-ai-analysis (default: openai)",
    )
    parser.add_argument(
        "--ai-model",
        type=str,
        default=None,
        metavar="MODEL",
        help="LLM model name (default: gpt-5.2 for openai, claude-sonnet-4 for anthropic)",
    )
    parser.add_argument(
        "--min-composite",
        type=int,
        default=50,
        metavar="N",
        help="--ai-full batch: only analyze stocks with composite_score >= N (default: 50)",
    )

    # Year range (applies to --quarterly, --full, --fallback-financials)
    parser.add_argument(
        "--year-from",
        type=int,
        default=None,
        metavar="YEAR",
        help="Earliest fiscal year to fetch from Stockbit (default: current_year - 10)",
    )
    parser.add_argument(
        "--year-to",
        type=int,
        default=None,
        metavar="YEAR",
        help="Latest fiscal year to fetch from Stockbit (default: current_year)",
    )

    args = parser.parse_args()

    all_modes = [args.daily, args.daily_light, args.weekly, args.quarterly, args.full,
                 args.enrich_ratios, args.dividends, args.fill_gaps, args.fallback_financials,
                 args.broker_backfill, args.insider,
                 args.build_ai_context, args.run_ai_analysis, args.ai_full,
                 args.detect_phases, args.detect_wyckoff, args.detect_wyckoff_v2,
                 args.compute_signals, args.market_pulse]
    if not any(all_modes):
        parser.print_help()
        console.print("\n[red]Error: specify at least one run mode.[/red]")
        sys.exit(1)

    setup_logging("run_all")

    start = datetime.now()
    console.rule(f"[bold]IDX Stock Analyzer — {start.strftime('%Y-%m-%d %H:%M')}[/bold]")

    # Resolve --sector into a ticker list (merges with any explicit --ticker)
    tickers: list[str] | None = args.ticker
    if args.sector:
        sector_tickers = _tickers_for_sectors(args.sector)
        if tickers:
            # Union: explicit tickers + sector tickers (deduplicated)
            tickers = sorted(set(tickers) | set(sector_tickers))
            console.print(f"[cyan]Scope: {len(tickers)} tickers (--ticker + --sector combined)[/cyan]")
        else:
            tickers = sector_tickers
    elif tickers:
        console.print(f"[cyan]Scope: tickers = {tickers}[/cyan]")

    # Parse --scrapers filter (comma-separated → set, empty string → None = run all)
    scraper_filter: set[str] | None = None
    if args.scrapers:
        scraper_filter = {s.strip() for s in args.scrapers.split(",") if s.strip()}
        console.print(f"[cyan]Scraper filter: {sorted(scraper_filter)}[/cyan]")

    # Detect or use explicit refresh job id (only meaningful for single-ticker runs)
    job_id: int | None = args.job_id or _detect_job(tickers)
    if job_id:
        from utils.supabase_client import update_refresh_job
        update_refresh_job(job_id, status="running")
        console.print(f"[cyan]Linked to refresh job #{job_id}[/cyan]")

    try:
        # ── Core pipeline modes (mutually exclusive: --full vs individual) ──
        if args.full:
            run_full(tickers, args.period, args.days, job_id=job_id,
                     year_from=args.year_from, year_to=args.year_to,
                     scraper_filter=scraper_filter,
                     backfill_days=args.backfill_days,
                     offset=args.offset, batch_limit=args.batch_limit,
                     ai_provider=args.ai_provider, ai_model=args.ai_model,
                     min_composite=args.min_composite, dry_run=args.dry_run)
        else:
            if args.weekly:
                run_weekly(tickers, job_id=job_id)
            # --daily already includes quarterly (current year by default), so
            # only run --quarterly standalone when --daily is NOT also set.
            if args.quarterly and not args.daily:
                run_quarterly(tickers, args.period, job_id=job_id,
                              year_from=args.year_from, year_to=args.year_to)
            if args.daily:
                run_daily(tickers, args.days, job_id=job_id,
                          period=args.period,
                          year_from=args.year_from, year_to=args.year_to)
            if args.daily_light:
                run_daily_light(tickers, args.since, job_id=job_id)
            if args.fallback_financials:
                run_financials_fallback(
                    tickers=tickers,
                    source="stockbit",
                    only_missing=not args.fallback_all,
                    dry_run=args.dry_run,
                    year_from=args.year_from,
                    year_to=args.year_to,
                )

        # ── Enrichment modes (can combine with --full or run standalone) ──
        # When --scrapers filter is active, only run enrichment if the scraper is in the filter
        def _filter_ok(name: str) -> bool:
            return scraper_filter is None or name in scraper_filter

        if args.enrich_ratios and _filter_ok("ratio_enricher"):
            run_enrich_ratios(tickers, dry_run=args.dry_run)
        if args.dividends and _filter_ok("dividend_scraper"):
            run_dividends(tickers, job_id=job_id)
        if args.fill_gaps:
            run_fill_gaps(
                tickers=tickers,
                min_score=args.min_score,
                limit=args.gap_limit,
                categories=args.gap_category,
                dry_run=args.dry_run,
            )
        if args.broker_backfill and _filter_ok("broker_backfill"):
            run_broker_backfill(
                tickers=tickers,
                days=args.backfill_days,
                offset=args.offset,
                limit=args.batch_limit,
                job_id=job_id,
            )
        if args.insider:
            run_insider(
                tickers=tickers,
                max_pages=args.insider_pages,
                offset=args.offset,
                limit=args.batch_limit,
                days=args.insider_days,
            )

        # ── Phase 6: AI pipeline modes ────────────────────────────────
        if args.build_ai_context or args.ai_full:
            _run_ai_context_pipeline(tickers, job_id=job_id, dry_run=args.dry_run)
        if args.run_ai_analysis or args.ai_full:
            _run_ai_analysis_pipeline(
                tickers,
                provider=args.ai_provider,
                model=args.ai_model,
                min_composite=args.min_composite,
                job_id=job_id,
                dry_run=args.dry_run,
            )

        # ── Phase 7: Market phase detection ──────────────────────────
        if args.detect_phases:
            _run_market_phase_detection(tickers, dry_run=args.dry_run)

        # ── Phase 7b: Wyckoff structural events ──────────────────────
        if args.detect_wyckoff:
            _run_wyckoff_detection(tickers, dry_run=args.dry_run)

        # ── Phase 7b v2: FSM-based Wyckoff ───────────────────────────
        if args.detect_wyckoff_v2:
            _run_wyckoff_v2_detection(tickers, dry_run=args.dry_run)

        # ── Phase 7+8: compute-signals (market phases + Wyckoff + technical) ──
        if args.compute_signals:
            _run_market_phase_detection(tickers, dry_run=args.dry_run)
            _run_wyckoff_detection(tickers, dry_run=args.dry_run)
            _run_wyckoff_v2_detection(tickers, dry_run=args.dry_run)
            _run_technical_signals(tickers, dry_run=args.dry_run)

        # ── Market Pulse: homepage header data ───────────────────────
        if args.market_pulse:
            run_market_pulse()
    except KeyboardInterrupt:
        if job_id and tickers and len(tickers) == 1:
            _finalize_job(job_id, tickers[0], "failed", "interrupted by user")
        console.print("\n[yellow]Run interrupted by user.[/yellow]")
        sys.exit(130)
    except Exception as e:
        if job_id and tickers and len(tickers) == 1:
            _finalize_job(job_id, tickers[0], "failed", str(e))
        logger.exception("Unhandled error: %s", e)
        console.print(f"\n[red]Fatal error: {e}[/red]")
        sys.exit(1)
    else:
        if job_id and tickers and len(tickers) == 1:
            _finalize_job(job_id, tickers[0], "done")

    elapsed = (datetime.now() - start).total_seconds()
    console.rule(f"[bold green]Done in {elapsed:.1f}s[/bold green]")


if __name__ == "__main__":
    main()
