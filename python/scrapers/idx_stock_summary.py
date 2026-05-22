from __future__ import annotations

"""
idx_stock_summary.py — IDX official daily stock summary scraper

Populates the `idx_stock_summary` table (schema-v30). A SINGLE IDX API call per
date returns one record per listed stock with OHLCV, total transaction Value
(IDR), Frequency, and official ForeignBuy/ForeignSell (in SHARES, not IDR).

This is the source of truth for the Money Flow page's "Most Active (Total)" view
and a cross-check for the Stockbit-derived foreign net-flow leaderboard. Unlike
broker_flow (Stockbit, ~1 trading day behind), this endpoint is current to the
last completed trading day.

Runs on owner's machine or CI — IDX endpoints are public (no IP binding).

Run:
    cd python && python -m scrapers.idx_stock_summary
    cd python && python -m scrapers.idx_stock_summary --days 5
    cd python && python -m scrapers.idx_stock_summary --date 2026-05-20
"""
import argparse
import logging
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from utils.helpers import RunResult, setup_logging, safe_int, safe_float
from utils.idx_client import IDXClient
from utils.supabase_client import bulk_upsert, fetch_column, start_run, finish_run

logger = logging.getLogger(__name__)


# ------------------------------------------------------------------
# Date helpers
# ------------------------------------------------------------------

def _last_n_trading_dates(n: int) -> list[date]:
    """Last N weekday dates ending yesterday (ignores IDX holidays)."""
    dates: list[date] = []
    d = date.today() - timedelta(days=1)
    while len(dates) < n:
        if d.weekday() < 5:  # Mon-Fri
            dates.append(d)
        d -= timedelta(days=1)
    return dates


def _parse_iso_date(value) -> str | None:
    """IDX returns 'YYYY-MM-DDT00:00:00'. Return 'YYYY-MM-DD'."""
    if not value:
        return None
    try:
        return datetime.strptime(str(value)[:10], "%Y-%m-%d").strftime("%Y-%m-%d")
    except ValueError:
        return None


# ------------------------------------------------------------------
# Row parser
# ------------------------------------------------------------------

def _parse_row(rec: dict, fallback_date: str, known: set[str], now_iso: str) -> dict | None:
    """Map one IDX GetStockSummary record to an idx_stock_summary row.

    Returns None for unknown tickers (not in our stocks table — FK would fail).
    """
    ticker = (rec.get("StockCode") or "").strip().upper()
    if not ticker or ticker not in known:
        return None

    row_date = _parse_iso_date(rec.get("Date")) or fallback_date

    prev_close = safe_float(rec.get("Previous"))
    close = safe_float(rec.get("Close"))
    change = safe_float(rec.get("Change"))
    if change is None and close is not None and prev_close is not None:
        change = round(close - prev_close, 2)

    return {
        "ticker": ticker,
        "date": row_date,
        "prev_close": prev_close,
        "open": safe_float(rec.get("OpenPrice")),
        "high": safe_float(rec.get("High")),
        "low": safe_float(rec.get("Low")),
        "close": close,
        "change": change,
        "volume": safe_int(rec.get("Volume")),
        "value": safe_int(rec.get("Value")),
        "frequency": safe_int(rec.get("Frequency")),
        "foreign_buy": safe_int(rec.get("ForeignBuy")),
        "foreign_sell": safe_int(rec.get("ForeignSell")),
        "listed_shares": safe_int(rec.get("ListedShares")),
        "last_updated": now_iso,
    }


# ------------------------------------------------------------------
# Main scraper
# ------------------------------------------------------------------

def run(dates: list[date] | None = None, days: int = 2) -> RunResult:
    """Fetch + upsert the IDX stock summary for the given dates.

    Args:
        dates: Explicit dates to fetch. If None, last `days` trading days.
        days:  Number of recent trading days when `dates` is None (default: 2,
               to cover the weekend / publish-lag boundary).
    """
    result = RunResult("idx_stock_summary")
    run_id = start_run("idx_stock_summary", metadata={"days": days})

    date_list = (
        [d if isinstance(d, date) else d for d in dates]
        if dates
        else _last_n_trading_dates(days)
    )
    logger.info("Fetching IDX stock summary for: %s",
                [d.isoformat() for d in date_list])

    # Known tickers — skip anything not in stocks (FK constraint).
    known = {t.upper() for t in fetch_column("stocks", "ticker")}
    logger.info("%d known tickers", len(known))

    client = IDXClient()
    now_iso = datetime.now(timezone.utc).isoformat()

    for d in date_list:
        iso = d.isoformat()
        yyyymmdd = d.strftime("%Y%m%d")
        try:
            records = client.get_stock_summary(yyyymmdd)
        except Exception as e:
            logger.warning("Fetch failed for %s: %s", iso, e)
            result.fail(iso, str(e))
            continue

        if not records:
            logger.info("%s: no data (holiday / not yet published)", iso)
            result.skip(iso, "no data")
            continue

        rows = [
            r for r in (_parse_row(rec, iso, known, now_iso) for rec in records)
            if r is not None
        ]
        if not rows:
            result.skip(iso, "no matching tickers")
            continue

        bulk_upsert("idx_stock_summary", rows, on_conflict="ticker,date")
        logger.info("%s: upserted %d rows (of %d records)", iso, len(rows), len(records))
        result.ok(iso)

    result.print_summary()
    finish_run(run_id, **result.to_db_kwargs())
    return result


if __name__ == "__main__":
    setup_logging("idx_stock_summary")
    parser = argparse.ArgumentParser(description="Scrape IDX official daily stock summary")
    parser.add_argument("--date", help="Specific date to fetch (YYYY-MM-DD)")
    parser.add_argument("--days", type=int, default=2,
                        help="Number of recent trading days (default: 2)")
    args = parser.parse_args()

    if args.date:
        run(dates=[datetime.strptime(args.date, "%Y-%m-%d").date()])
    else:
        run(days=args.days)
