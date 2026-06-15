from __future__ import annotations

"""
ratio_enricher.py — Fill NULL computed fields in the financials table
from raw data that is already stored in the database.

No external API calls are made. This enricher reads raw financial data
(revenue, net_income, total_assets, etc.) and derives any missing ratio
fields using the same formulas as financials.py.

High-impact situations where this helps:
  • market_cap / listed_shares was NULL when a ticker was first scraped
    → pe_ratio and pbv_ratio could not be computed at the time.
  • yfinance returned partial data on a flaky request — raw rows exist
    but ratio columns came back None.
  • Newer stocks that were added to the universe after the last full run
    got prices later, so ratios can now be back-filled.

Run:
    cd python && python -m scrapers.ratio_enricher
    cd python && python -m scrapers.ratio_enricher --ticker BBRI ASII
    cd python && python -m scrapers.ratio_enricher --dry-run
"""

import argparse
import logging
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).parent.parent))

from utils.helpers import RunResult, setup_logging, safe_float, safe_int, compute_ratio
from utils.supabase_client import get_client, fetch_column, start_run, finish_run

logger = logging.getLogger(__name__)

# Recompute denormalized screener metrics (CAGR + div-yield avg) for a stock at
# most this often — skip any stock refreshed within this many days.
_SCREENER_STALE_DAYS = 30

# Columns we may write — never touch raw data columns
_RATIO_COLS = [
    "eps", "book_value_per_share",
    "gross_margin", "operating_margin", "net_margin",
    "roe", "roa", "current_ratio", "debt_to_equity",
    "free_cash_flow",
    "pe_ratio", "pbv_ratio", "dividend_yield", "payout_ratio",
    "peg_ratio",
]

# Raw data columns we read (must exist in the row)
_RAW_COLS = ",".join([
    "ticker", "year", "quarter", "is_ttm",
    "revenue", "gross_profit", "operating_income", "net_income",
    "total_assets", "current_assets", "total_liabilities",
    "total_equity", "current_liabilities", "total_debt",
    "operating_cash_flow", "capex", "free_cash_flow",
    "dividends_paid",
] + _RATIO_COLS)


# ---------------------------------------------------------------------------
# Per-row enrichment logic
# ---------------------------------------------------------------------------

def _compute_updates(
    row: dict,
    price_per_share: float | None,
    listed_shares: int | None,
) -> dict[str, Any]:
    """
    Compute only the ratio fields that are currently NULL but can be derived
    from available raw data.  Returns a dict of {column: value} to update.
    Returns an empty dict if nothing can be improved.
    """
    updates: dict[str, Any] = {}

    def _needs(col: str) -> bool:
        return row.get(col) is None

    # Short-hands for raw fields
    revenue          = row.get("revenue")
    gross_profit     = row.get("gross_profit")
    operating_income = row.get("operating_income")
    net_income       = row.get("net_income")
    total_assets     = row.get("total_assets")
    current_assets   = row.get("current_assets")
    total_equity     = row.get("total_equity")
    current_liab     = row.get("current_liabilities")
    total_debt       = row.get("total_debt")
    ocf              = row.get("operating_cash_flow")
    capex            = row.get("capex")
    dividends_paid   = row.get("dividends_paid")

    # ---- Ratios derivable purely from stored raw data ----

    if _needs("gross_margin"):
        v = compute_ratio(gross_profit, revenue, scale=100)
        if v is not None:
            updates["gross_margin"] = v

    if _needs("operating_margin"):
        v = compute_ratio(operating_income, revenue, scale=100)
        if v is not None:
            updates["operating_margin"] = v

    if _needs("net_margin"):
        v = compute_ratio(net_income, revenue, scale=100)
        if v is not None:
            updates["net_margin"] = v

    if _needs("roe"):
        v = compute_ratio(net_income, total_equity, scale=100)
        if v is not None:
            updates["roe"] = v

    if _needs("roa"):
        v = compute_ratio(net_income, total_assets, scale=100)
        if v is not None:
            updates["roa"] = v

    if _needs("current_ratio"):
        v = compute_ratio(current_assets, current_liab)
        if v is not None:
            updates["current_ratio"] = v

    if _needs("debt_to_equity"):
        v = compute_ratio(total_debt, total_equity)
        if v is not None:
            updates["debt_to_equity"] = v

    if _needs("free_cash_flow") and ocf is not None and capex is not None:
        fcf = safe_int(ocf - abs(capex))
        if fcf is not None:
            updates["free_cash_flow"] = fcf

    if _needs("payout_ratio") and dividends_paid and net_income and net_income != 0:
        v = safe_float(abs(dividends_paid) / net_income * 100, 4)
        if v is not None:
            updates["payout_ratio"] = v

    # ---- Per-share ratios: need listed_shares ----

    effective_eps  = row.get("eps")
    effective_bvps = row.get("book_value_per_share")

    if _needs("eps") and net_income is not None and listed_shares and listed_shares > 0:
        eps = safe_float(net_income / listed_shares, 4)
        if eps is not None:
            updates["eps"] = eps
            effective_eps = eps   # use it downstream in same pass

    if _needs("book_value_per_share") and total_equity is not None and listed_shares and listed_shares > 0:
        bvps = safe_float(total_equity / listed_shares, 4)
        if bvps is not None:
            updates["book_value_per_share"] = bvps
            effective_bvps = bvps

    # ---- Market ratios: need price_per_share ----

    if price_per_share is not None:
        if _needs("pe_ratio") and effective_eps and effective_eps != 0:
            pe = safe_float(price_per_share / effective_eps, 2)
            if pe and 0 < pe < 500:
                updates["pe_ratio"] = pe

        if _needs("pbv_ratio") and effective_bvps and effective_bvps != 0:
            pbv = safe_float(price_per_share / effective_bvps, 2)
            if pbv and 0 < pbv < 100:
                updates["pbv_ratio"] = pbv

        if _needs("dividend_yield") and dividends_paid and listed_shares and listed_shares > 0:
            dps = abs(dividends_paid) / listed_shares
            dy = safe_float(dps / price_per_share * 100, 4)
            if dy is not None:
                updates["dividend_yield"] = dy

    return updates


# ---------------------------------------------------------------------------
# Per-ticker orchestration
# ---------------------------------------------------------------------------

def _get_price_per_share(client, ticker: str) -> tuple[float | None, int | None]:
    """
    Return (price_per_share, listed_shares) for ticker using the latest
    available close price from daily_prices and listed_shares from stocks.
    Falls back to market_cap / listed_shares if no price row found.
    """
    stock_resp = (
        client.table("stocks")
        .select("market_cap, listed_shares")
        .eq("ticker", ticker)
        .execute()
    )
    stock = (stock_resp.data or [{}])[0]
    listed_shares: int | None = safe_int(stock.get("listed_shares"))

    # Prefer actual latest close price over market_cap approximation
    price_resp = (
        client.table("daily_prices")
        .select("close")
        .eq("ticker", ticker)
        .order("date", desc=True)
        .limit(1)
        .execute()
    )
    price_data = price_resp.data or []

    if price_data and price_data[0].get("close") is not None:
        price_per_share = safe_float(price_data[0]["close"])
    elif listed_shares and listed_shares > 0 and stock.get("market_cap"):
        price_per_share = safe_float(stock["market_cap"]) / listed_shares
    else:
        price_per_share = None

    return price_per_share, listed_shares


def _compute_peg(rows: list[dict], pe: float | None) -> float | None:
    """
    Compute PEG ratio = PE / EPS_CAGR_3yr (%).

    Uses the 3 most recent full annual rows (quarter=0, non-TTM, positive EPS).
    Returns None when PE or growth is unavailable, negative, or zero.
    PEG is not meaningful for cyclicals / negative earnings — callers should
    decide whether to store it; we just compute the number here.
    """
    if not pe or pe <= 0:
        return None

    annual = sorted(
        [r for r in rows if r.get("quarter") == 0 and not r.get("is_ttm") and (r.get("eps") or 0) > 0],
        key=lambda r: r["year"],
    )
    if len(annual) < 2:
        return None

    # Use up to 4 years back to get a stable 3yr CAGR anchor
    window = annual[-4:] if len(annual) >= 4 else annual
    eps_start = safe_float(window[0].get("eps"))
    eps_end   = safe_float(window[-1].get("eps"))
    n_years   = window[-1]["year"] - window[0]["year"]

    if not eps_start or eps_start <= 0 or not eps_end or eps_end <= 0 or n_years <= 0:
        return None

    eps_cagr_pct = ((eps_end / eps_start) ** (1 / n_years) - 1) * 100
    if eps_cagr_pct <= 0:
        return None  # negative or flat growth makes PEG meaningless

    return safe_float(pe / eps_cagr_pct, 2)


def _enrich_ticker(
    client,
    ticker: str,
    dry_run: bool = False,
) -> tuple[int, int]:
    """
    Enrich all financials rows for one ticker.
    Returns (rows_checked, rows_updated).
    """
    resp = (
        client.table("financials")
        .select(_RAW_COLS)
        .eq("ticker", ticker)
        .execute()
    )
    rows = resp.data or []
    if not rows:
        return 0, 0

    price_per_share, listed_shares = _get_price_per_share(client, ticker)
    rows_updated = 0

    # PEG is a cross-row metric — compute once at ticker level and apply only
    # to the latest annual row (the one that also holds current pe_ratio).
    latest_annual = max(
        (r for r in rows if r.get("quarter") == 0 and not r.get("is_ttm")),
        key=lambda r: r["year"],
        default=None,
    )
    peg_for_latest: float | None = None
    if latest_annual and latest_annual.get("peg_ratio") is None:
        current_pe = latest_annual.get("pe_ratio")
        # If pe_ratio isn't stored yet, approximate from price if available
        if current_pe is None and price_per_share and latest_annual.get("eps"):
            eps_v = safe_float(latest_annual["eps"])
            if eps_v and eps_v > 0:
                current_pe = safe_float(price_per_share / eps_v)
        peg_for_latest = _compute_peg(rows, current_pe)

    for row in rows:
        updates = _compute_updates(row, price_per_share, listed_shares)

        # Attach PEG to the latest annual row only
        if (
            peg_for_latest is not None
            and latest_annual
            and row["year"] == latest_annual["year"]
            and row["quarter"] == latest_annual["quarter"]
        ):
            updates["peg_ratio"] = peg_for_latest

        if not updates:
            continue

        updates["last_updated"] = datetime.now(timezone.utc).isoformat()
        logger.debug(
            "  %s %d Q%d: updating %s",
            ticker, row["year"], row["quarter"], list(updates.keys()),
        )

        if not dry_run:
            client.table("financials").update(updates).eq(
                "ticker", ticker
            ).eq("year", row["year"]).eq("quarter", row["quarter"]).execute()

        rows_updated += 1

    return len(rows), rows_updated


# ---------------------------------------------------------------------------
# Screener denormalization — copy latest annual ratios → stocks table
# ---------------------------------------------------------------------------

_SCREENER_RATIO_COLS = ["pe_ratio", "pbv_ratio", "roe", "net_margin", "dividend_yield", "peg_ratio"]


def _sync_screener_ratios(client, tickers: list[str]) -> int:
    """
    For each ticker, read the latest annual financials row (quarter=0)
    and copy the 5 key screener ratios into the stocks table.
    Returns number of stocks updated.
    """
    from utils.supabase_client import bulk_upsert

    # Fetch latest annual financials for the given tickers
    select_cols = "ticker, year, " + ", ".join(_SCREENER_RATIO_COLS)
    resp = (
        client.table("financials")
        .select(select_cols)
        .in_("ticker", tickers)
        .eq("quarter", 0)
        .neq("is_ttm", True)
        .order("year", desc=True)
        .execute()
    )

    # Keep only the latest year per ticker
    latest: dict[str, dict] = {}
    for row in (resp.data or []):
        t = row["ticker"]
        if t not in latest:
            latest[t] = row

    updates: list[dict] = []
    for ticker, row in latest.items():
        update: dict[str, Any] = {"ticker": ticker}
        has_data = False
        for col in _SCREENER_RATIO_COLS:
            v = row.get(col)
            if v is not None:
                update[col] = v
                has_data = True
        if has_data:
            updates.append(update)

    if updates:
        bulk_upsert("stocks", updates, on_conflict="ticker")

    return len(updates)


def _paginate(make_query, page: int = 1000) -> list[dict]:
    """
    Read every row from a PostgREST query, working around the default 1000-row
    cap. `make_query` must return a fresh (un-executed) query each call so we can
    re-apply `.range()` per page.
    """
    out: list[dict] = []
    offset = 0
    while True:
        resp = make_query().range(offset, offset + page - 1).execute()
        batch = resp.data or []
        out.extend(batch)
        if len(batch) < page:
            break
        offset += page
    return out


def _close_on_or_before(client, ticker: str, cutoff: str) -> float | None:
    """Latest daily_prices close on or before `cutoff` (YYYY-MM-DD), or None."""
    resp = (
        client.table("daily_prices")
        .select("close")
        .eq("ticker", ticker)
        .lte("date", cutoff)
        .order("date", desc=True)
        .limit(1)
        .execute()
    )
    rows = resp.data or []
    if rows and rows[0].get("close") is not None:
        return safe_float(rows[0]["close"])
    return None


# --- Canonical CAGR (mirror of web/src/lib/calculations/cagr.ts) ------------
# See docs/cagr-spec.md. Keep equivalent to the TypeScript widget so the
# screener columns and the detail-page widget agree.

def _cagr(start: float | None, end: float | None, span: int) -> float | None:
    """Standard CAGR as a percent over `span` years; positive endpoints only."""
    if start is None or end is None or span <= 0:
        return None
    if start <= 0 or end <= 0:
        return None
    return safe_float((pow(end / start, 1.0 / span) - 1) * 100, 4)


def _growth_rate(start: float | None, end: float | None, span: int) -> float | None:
    """CAGR variant for sign-changing metrics (uses |start| as the base)."""
    if start is None or end is None or span <= 0:
        return None
    if start == 0:
        return None
    if start > 0 and end > 0:
        return _cagr(start, end, span)
    total_growth = (end - start) / abs(start)
    base = 1 + total_growth
    if base <= 0:
        return None  # can't take a real root
    return safe_float((pow(base, 1.0 / span) - 1) * 100, 4)


def _series_cagr(
    series: list[dict], key: str, n: int, allow_negative: bool = False
) -> float | None:
    """
    N-year CAGR for `key` over an annual series (year-aware window + actual span).
    `series` must be non-TTM annual rows sorted ascending by year.
    """
    if len(series) < 2:
        return None
    end = series[-1]
    end_year = safe_int(end.get("year"))
    if end_year is None:
        return None
    window = [r for r in series if (safe_int(r.get("year")) or 0) >= end_year - n]
    if len(window) < 2:
        return None
    start = window[0]
    span = end_year - (safe_int(start.get("year")) or 0)
    if span <= 0:
        return None
    fn = _growth_rate if allow_negative else _cagr
    return fn(safe_float(start.get(key)), safe_float(end.get(key)), span)


def _sync_screener_metrics(
    client,
    tickers: list[str],
    stale_days: int = _SCREENER_STALE_DAYS,
    dry_run: bool = False,
) -> int:
    """
    Recompute the denormalized screener metrics on the stocks table — revenue,
    price and operating-cash-flow CAGR (3yr/5yr) plus 3yr/5yr dividend-yield
    averages.

    Revenue/OCF CAGR are computed from the annual financials series using the
    canonical spec (docs/cagr-spec.md) so they match the stock-detail widget
    exactly. Price CAGR is from daily_prices; div-yield avg from financials.

    A stock is refreshed when it has never been refreshed, when its financials
    changed since the last refresh (last_data_change_at > screener_metrics_updated_at),
    or as a ~monthly safety net (`stale_days`). Stamps screener_metrics_updated_at
    for every stock it processes. Returns stocks updated.
    """
    from utils.supabase_client import bulk_upsert

    ticker_set = {t.upper() for t in tickers}
    cutoff = datetime.now(timezone.utc) - timedelta(days=stale_days)

    # Read the staleness markers for the requested stocks and decide in Python
    # (avoids fragile timestamp encoding in a PostgREST or() filter).
    stock_rows = _paginate(
        lambda: client.table("stocks")
        .select("ticker, current_price, screener_metrics_updated_at, last_data_change_at")
        .eq("status", "Active")
    )

    def _parse(ts: str | None) -> datetime | None:
        if not ts:
            return None
        try:
            return datetime.fromisoformat(ts)
        except (ValueError, TypeError):
            return None

    def _is_stale(row: dict) -> bool:
        refreshed = _parse(row.get("screener_metrics_updated_at"))
        if refreshed is None:
            return True  # never refreshed
        if refreshed < cutoff:
            return True  # monthly safety net
        changed = _parse(row.get("last_data_change_at"))
        if changed is not None and changed > refreshed:
            return True  # financials changed since last refresh
        return False

    stale = [
        r for r in stock_rows
        if r["ticker"] in ticker_set and _is_stale(r)
    ]
    if not stale:
        logger.info("Screener metrics fresh for all %d tickers — nothing to refresh", len(ticker_set))
        return 0

    stale_tickers = {r["ticker"] for r in stale}
    current_price = {r["ticker"]: safe_float(r.get("current_price")) for r in stale}
    logger.info(
        "Refreshing screener metrics for %d stale stocks (>%d days)%s",
        len(stale_tickers), stale_days, " [DRY RUN]" if dry_run else "",
    )

    # --- One read of annual financials drives both CAGR and div-yield avg ---
    # Same source the widget uses (financials, quarter=0). TTM rows are excluded
    # for CAGR (see canonical spec); kept here so we can filter in Python exactly
    # like the widget does.
    fin_rows = _paginate(
        lambda: client.table("financials")
        .select("ticker, year, is_ttm, revenue, operating_cash_flow, dividend_yield")
        .eq("quarter", 0)
    )

    # Build a non-TTM annual series per stale ticker, sorted ascending by year.
    series_by_ticker: dict[str, list[dict]] = {}
    this_year = datetime.now(timezone.utc).year
    div_acc: dict[str, dict[str, list[float]]] = {}
    for row in fin_rows:
        t = row["ticker"]
        if t not in stale_tickers or row.get("is_ttm"):
            continue
        series_by_ticker.setdefault(t, []).append(row)

        dy = safe_float(row.get("dividend_yield"))
        yr = safe_int(row.get("year"))
        if dy is not None and dy > 0 and yr is not None:
            acc = div_acc.setdefault(t, {"y3": [], "y5": []})
            if yr >= this_year - 5:
                acc["y5"].append(dy)
            if yr >= this_year - 3:
                acc["y3"].append(dy)

    for rows in series_by_ticker.values():
        rows.sort(key=lambda r: safe_int(r.get("year")) or 0)

    # revenue is always-positive (strict CAGR); OCF can change sign (growth rate)
    cagr: dict[str, dict[str, float | None]] = {}
    for t, series in series_by_ticker.items():
        cagr[t] = {
            "revenue_cagr_3yr": _series_cagr(series, "revenue", 3),
            "revenue_cagr_5yr": _series_cagr(series, "revenue", 5),
            "ocf_cagr_3yr": _series_cagr(series, "operating_cash_flow", 3, allow_negative=True),
            "ocf_cagr_5yr": _series_cagr(series, "operating_cash_flow", 5, allow_negative=True),
        }

    # --- Assemble per-ticker updates (price CAGR needs a per-ticker lookup) ---
    cutoff_3yr = (datetime.now(timezone.utc) - timedelta(days=365 * 3)).date().isoformat()
    cutoff_5yr = (datetime.now(timezone.utc) - timedelta(days=365 * 5)).date().isoformat()
    now_iso = datetime.now(timezone.utc).isoformat()

    updates: list[dict] = []
    for i, ticker in enumerate(sorted(stale_tickers), 1):
        update: dict[str, Any] = {"ticker": ticker, "screener_metrics_updated_at": now_iso}

        # revenue / ocf CAGR
        update.update(cagr.get(ticker, {}))

        # price CAGR (current vs close ~3y/5y ago; span is 3/5 by construction)
        cur = current_price.get(ticker)
        if cur and cur > 0:
            update["price_cagr_3yr"] = _cagr(_close_on_or_before(client, ticker, cutoff_3yr), cur, 3)
            update["price_cagr_5yr"] = _cagr(_close_on_or_before(client, ticker, cutoff_5yr), cur, 5)

        # dividend-yield averages
        acc = div_acc.get(ticker)
        if acc:
            update["div_yield_avg_3yr"] = round(sum(acc["y3"]) / len(acc["y3"]), 4) if acc["y3"] else None
            update["div_yield_avg_5yr"] = round(sum(acc["y5"]) / len(acc["y5"]), 4) if acc["y5"] else None

        updates.append(update)

        if i % 100 == 0:
            time.sleep(0.5)  # avoid hammering daily_prices

    if dry_run:
        logger.info("[DRY RUN] would update screener metrics for %d stocks", len(updates))
        return len(updates)

    if updates:
        bulk_upsert("stocks", updates, on_conflict="ticker")
    return len(updates)


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def run(
    tickers: list[str] | None = None,
    dry_run: bool = False,
) -> RunResult:
    """
    Re-derive NULL ratio columns from stored raw data for all (or specified) tickers.

    Args:
        tickers: Limit to these tickers. None = all active stocks.
        dry_run: If True, compute but do not write to the database.
    """
    result = RunResult("ratio_enricher")
    run_id = start_run(
        "ratio_enricher",
        metadata={
            "mode": "single" if tickers else "full",
            "dry_run": dry_run,
        },
    )

    client = get_client()

    if tickers:
        ticker_list = [t.upper() for t in tickers]
    else:
        ticker_list = fetch_column("stocks", "ticker", filters={"status": "Active"})
        if not ticker_list:
            logger.error("No active stocks found. Run stock_universe.py first.")
            finish_run(run_id, "failed", error_message="stocks table empty")
            return result

    logger.info(
        "Enriching ratios for %d tickers%s",
        len(ticker_list),
        " [DRY RUN]" if dry_run else "",
    )

    total_checked = 0
    total_updated = 0

    for i, ticker in enumerate(ticker_list, 1):
        try:
            checked, updated = _enrich_ticker(client, ticker, dry_run=dry_run)
            total_checked += checked
            total_updated += updated
            if updated > 0:
                logger.info("[%d/%d] %s: enriched %d/%d rows", i, len(ticker_list), ticker, updated, checked)
                result.ok(ticker)
            else:
                result.skip(ticker, f"all ratios already populated ({checked} rows)")
        except Exception as e:
            logger.warning("Failed %s: %s", ticker, e)
            result.fail(ticker, str(e))

        # Small pause to avoid hammering Supabase
        if i % 100 == 0:
            time.sleep(0.5)

    logger.info(
        "Ratio enrichment complete: %d rows checked, %d rows updated across %d tickers",
        total_checked, total_updated, len(ticker_list),
    )

    # --- Sync screener ratios into the stocks table ---
    if not dry_run:
        synced = _sync_screener_ratios(client, ticker_list)
        logger.info("Synced screener ratios for %d stocks", synced)

    # --- Refresh denormalized screener CAGR + div-yield averages ---
    # Recurring counterpart to the v16/v20 one-time backfills; gated so each
    # stock is recomputed at most ~monthly (see _SCREENER_STALE_DAYS).
    refreshed = _sync_screener_metrics(client, ticker_list, dry_run=dry_run)
    logger.info("Refreshed screener CAGR/div-yield for %d stale stocks", refreshed)

    result.print_summary()
    finish_run(run_id, **result.to_db_kwargs())
    return result


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Ratio enricher — fill NULL ratio columns in financials table from existing raw data"
    )
    parser.add_argument("--ticker", nargs="+", help="Limit to specific tickers")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Compute enrichments but do not write to the database",
    )
    args = parser.parse_args()

    setup_logging("ratio_enricher")
    run(tickers=args.ticker, dry_run=args.dry_run)
