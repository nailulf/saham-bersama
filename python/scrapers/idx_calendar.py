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