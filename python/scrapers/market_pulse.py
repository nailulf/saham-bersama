from __future__ import annotations

"""
market_pulse.py — Market Pulse header data pool

Populates three tables that back the homepage "Market Pulse" header:
  - market_indicators          (latest-only snapshot, one row per indicator)
  - market_indicator_history   (thin time series, for prev/change + sparklines)
  - market_news                (Indonesian-market RSS headlines)

Indicators and feeds are defined in market_pulse_config.py (data-driven
registry). Three providers, each non-fatal so one failing source never blocks
the others:
  - yfinance  : live daily quotes (FX, indices, gold, silver, crude)
  - esdm_hba  : monthly coal reference price (Harga Batubara Acuan)
  - esdm_hma  : monthly mineral reference prices (nickel, ferronickel)
  - RSS       : news headlines via feedparser

This scraper is ticker-independent and uses only public sources, so it is safe
to run on GitHub Actions / cron. Recommended cadence: daily ~07:00 WIB
(post-US-close / pre-IDX-open). The monthly ESDM fetch is a harmless daily
no-op until the reference month rolls over.

Run:
    cd python && python -m scrapers.market_pulse
    cd python && python -m scrapers.market_pulse --indicators-only
    cd python && python -m scrapers.market_pulse --news-only
"""
import argparse
import hashlib
import logging
import sys
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd
import yfinance as yf
import requests
from tenacity import retry, stop_after_attempt, wait_exponential

sys.path.insert(0, str(Path(__file__).parent.parent))

from utils.helpers import RunResult, setup_logging, safe_float
from utils.supabase_client import bulk_upsert, start_run, finish_run
from scrapers.market_pulse_config import (
    INDICATORS,
    NEWS_FEEDS,
    MAX_HEADLINES_PER_FEED,
    MARKET_KEYWORDS,
    GOOGLE_NEWS_QUERY_TERMS,
)

logger = logging.getLogger(__name__)

_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)


# ------------------------------------------------------------------
# Provider: yfinance (live daily quotes)
# ------------------------------------------------------------------

def _provider_yfinance(indicators: list[dict]) -> dict[str, dict]:
    """
    Fetch the last two closes for every yfinance-backed indicator in one
    bulk download. Returns {indicator_key: {value, prev_value, as_of}}.
    Non-fatal: any failure logs and returns whatever was parsed.
    """
    out: dict[str, dict] = {}
    yf_indicators = [i for i in indicators if i["provider"] == "yfinance"]
    if not yf_indicators:
        return out

    symbol_to_key = {i["symbol"]: i["key"] for i in yf_indicators}
    symbols = list(symbol_to_key.keys())

    try:
        df = yf.download(
            symbols,
            period="5d",
            auto_adjust=True,
            progress=False,
            threads=True,
        )
    except Exception as e:
        logger.warning("yfinance download failed: %s", e)
        return out

    if df is None or df.empty:
        logger.warning("yfinance returned no data for %d symbols", len(symbols))
        return out

    is_multi = isinstance(df.columns, pd.MultiIndex)

    for symbol, key in symbol_to_key.items():
        try:
            if is_multi:
                try:
                    close = df["Close"][symbol]
                except KeyError:
                    close = df.xs(symbol, level=1, axis=1)["Close"]
            else:
                close = df["Close"]
            close = close.dropna()
            if close.empty:
                logger.debug("No close data for %s (%s)", key, symbol)
                continue

            value = safe_float(close.iloc[-1], 4)
            prev = safe_float(close.iloc[-2], 4) if len(close) >= 2 else None
            as_of = close.index[-1]
            as_of = as_of.date() if hasattr(as_of, "date") else date.today()
            out[key] = {"value": value, "prev_value": prev, "as_of": as_of.isoformat()}
        except Exception as e:
            logger.debug("yfinance parse failed for %s (%s): %s", key, symbol, e)

    logger.info("yfinance: resolved %d/%d indicators", len(out), len(yf_indicators))
    return out


# ------------------------------------------------------------------
# Provider: ESDM minerba reference prices (monthly)
# ------------------------------------------------------------------

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=8))
def _fetch_json(url: str) -> Any:
    resp = requests.get(
        url,
        headers={"User-Agent": _UA, "Accept": "application/json, text/plain, */*"},
        timeout=20,
    )
    resp.raise_for_status()
    return resp.json()


def _provider_esdm() -> dict[str, dict]:
    """
    Fetch Indonesia's monthly minerba reference prices from ESDM:
      - HBA  (Harga Batubara Acuan)   → coal
      - HMA  (Harga Mineral Acuan)    → nickel, ferronickel

    Returns {esdm_metric: {value, prev_value, as_of, reference_period}}.

    NOTE: ESDM publishes these on minerba.esdm.go.id; the public JSON shape is
    not contractually stable and may change. This provider is fully non-fatal —
    on any failure it returns {} and the latest-only `market_indicators` table
    keeps the last-good values (visible staleness via `reference_period`).
    The endpoint/field mapping below is best-effort and may need tuning against
    the live response; see docs note in the v29 migration.
    """
    out: dict[str, dict] = {}

    # Best-effort: ESDM exposes the acuan price table behind its harga-acuan page.
    # Keep the URL configurable-by-edit; failures are swallowed.
    endpoints = {
        "hba": "https://www.minerba.esdm.go.id/api/harga_acuan/hba",
        "hma": "https://www.minerba.esdm.go.id/api/harga_acuan/hma",
    }

    def _period_now() -> str:
        return date.today().strftime("%Y-%m")

    # --- HBA (coal) ---
    try:
        data = _fetch_json(endpoints["hba"])
        # Expected: a list/dict with the most recent HBA value in USD/ton.
        value, prev = _extract_two(data, value_keys=("hba", "harga", "value", "nilai"))
        if value is not None:
            out["hba"] = {
                "value": value, "prev_value": prev,
                "as_of": date.today().isoformat(),
                "reference_period": _period_now(),
            }
    except Exception as e:
        logger.warning("ESDM HBA fetch failed (non-fatal): %s", e)

    # --- HMA (nickel, ferronickel) ---
    try:
        data = _fetch_json(endpoints["hma"])
        for metric, names in (
            ("nickel", ("nikel", "nickel")),
            ("ferronickel", ("feronikel", "ferronickel", "fe-ni")),
        ):
            value = _extract_metal(data, names)
            if value is not None:
                out[metric] = {
                    "value": value, "prev_value": None,
                    "as_of": date.today().isoformat(),
                    "reference_period": _period_now(),
                }
    except Exception as e:
        logger.warning("ESDM HMA fetch failed (non-fatal): %s", e)

    logger.info("ESDM: resolved %d minerba reference price(s)", len(out))
    return out


def _extract_two(data: Any, value_keys: tuple[str, ...]) -> tuple[float | None, float | None]:
    """Best-effort: pull the latest and previous numeric value from an ESDM payload."""
    rows = data.get("data", data) if isinstance(data, dict) else data
    if not isinstance(rows, list) or not rows:
        return None, None

    def _val(row: dict) -> float | None:
        for k in value_keys:
            if k in row:
                return safe_float(row[k], 4)
        return None

    latest = _val(rows[0]) if isinstance(rows[0], dict) else None
    prev = _val(rows[1]) if len(rows) > 1 and isinstance(rows[1], dict) else None
    return latest, prev


def _extract_metal(data: Any, names: tuple[str, ...]) -> float | None:
    """Best-effort: find a mineral's price by fuzzy name match in an HMA payload."""
    rows = data.get("data", data) if isinstance(data, dict) else data
    if not isinstance(rows, list):
        return None
    for row in rows:
        if not isinstance(row, dict):
            continue
        label = " ".join(str(v).lower() for v in row.values() if isinstance(v, str))
        if any(n in label for n in names):
            for k in ("hma", "harga", "value", "nilai"):
                if k in row:
                    return safe_float(row[k], 4)
    return None


# ------------------------------------------------------------------
# Provider: RSS news headlines
# ------------------------------------------------------------------

def _is_market_relevant(title: str, summary: str) -> bool:
    """True if the headline/summary mentions a market-relevant keyword.
    Used to filter broad finance/economy feeds down to market news."""
    haystack = f"{title} {summary}".lower()
    return any(kw in haystack for kw in MARKET_KEYWORDS)


def _feed_url(feed: dict) -> str:
    """Resolve a NEWS_FEEDS entry to a fetchable URL. Direct feeds use 'url';
    'google_news_site' feeds build a domain-scoped Google News RSS query.

    Optional per-feed overrides for Google News feeds:
      google_news_window : recency window, e.g. '3d' (default), '14d' for
                           low-volume daily digests like Stockbit Snips.
      google_news_query  : replaces the default market terms — used to tune
                           noisy domains (e.g. drop bare 'saham', which matches
                           Ajaib's auto-generated quote pages). NOTE: Google
                           News RSS rejects negative terms / parentheses, so
                           keep overrides to a plain 'A OR B OR C' form.
    """
    if feed.get("url"):
        return feed["url"]
    import urllib.parse
    site = feed["google_news_site"]
    window = feed.get("google_news_window", "3d")
    terms = feed.get("google_news_query", GOOGLE_NEWS_QUERY_TERMS)
    query = f"site:{site} when:{window} {terms}"
    return "https://news.google.com/rss/search?" + urllib.parse.urlencode(
        {"q": query, "hl": "id", "gl": "ID", "ceid": "ID:id"}
    )


def _clean_google_title(title: str) -> str:
    """Google News appends ' - Publisher' to titles; drop it for cleaner cards."""
    return title.rsplit(" - ", 1)[0].strip() if " - " in title else title


def _provider_rss() -> tuple[list[dict], int, int]:
    """
    Parse every feed in NEWS_FEEDS. Returns (rows, n_ok_feeds, n_failed_feeds).
    Each row matches the market_news table. Deduped by sha1(link).
    Non-fatal per feed.
    """
    import feedparser
    from dateutil import parser as date_parser

    seen: set[str] = set()
    rows: list[dict] = []
    n_ok = n_failed = 0
    now_iso = datetime.now(timezone.utc).isoformat()

    for feed in NEWS_FEEDS:
        source = feed["source"]
        url = _feed_url(feed)
        is_broad = feed.get("broad", False)
        is_google = bool(feed.get("google_news_site"))
        kept = 0
        try:
            parsed = feedparser.parse(url, request_headers={"User-Agent": _UA})
            entries = parsed.entries  # filter first, then cap (broad feeds need headroom)
            if not entries:
                logger.warning("RSS '%s' returned no entries", source)
                n_failed += 1
                continue

            for e in entries:
                if kept >= MAX_HEADLINES_PER_FEED:
                    break
                link = (e.get("link") or "").strip()
                title = (e.get("title") or "").strip()
                if not link or not title:
                    continue
                if is_google:
                    title = _clean_google_title(title)

                # Broad feeds (general finance/economy): keep only market-relevant.
                if is_broad and not _is_market_relevant(title, e.get("summary") or ""):
                    continue

                news_id = hashlib.sha1(link.encode("utf-8")).hexdigest()
                if news_id in seen:
                    continue
                seen.add(news_id)

                published_at = None
                raw_date = e.get("published") or e.get("updated")
                if raw_date:
                    try:
                        published_at = date_parser.parse(raw_date).isoformat()
                    except (ValueError, TypeError, OverflowError):
                        published_at = None

                summary = (e.get("summary") or "").strip() or None
                if summary and len(summary) > 500:
                    summary = summary[:497] + "…"

                rows.append({
                    "id": news_id,
                    "title": title[:500],
                    "link": link,
                    "source": source,
                    "published_at": published_at,
                    "summary": summary,
                    "fetched_at": now_iso,
                })
                kept += 1
            logger.debug("RSS '%s': kept %d headlines", source, kept)
            n_ok += 1
        except Exception as e:
            logger.warning("RSS '%s' failed (non-fatal): %s", source, e)
            n_failed += 1

    logger.info("RSS: %d headlines from %d feed(s) (%d failed)", len(rows), n_ok, n_failed)
    return rows, n_ok, n_failed


# ------------------------------------------------------------------
# Provider: curated market-events calendar (shared/market-events.json)
# ------------------------------------------------------------------

def _provider_events() -> list[dict]:
    """
    Load the owner-curated important-dates calendar from
    shared/market-events.json into market_events rows. Non-fatal: a missing or
    malformed file logs a warning and returns []. Idempotent via on_conflict.
    """
    import json
    path = Path(__file__).resolve().parents[2] / "shared" / "market-events.json"
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        logger.warning("market-events.json load failed (non-fatal): %s", e)
        return []

    now_iso = datetime.now(timezone.utc).isoformat()
    rows: list[dict] = []
    for ev in data.get("events", []):
        date_str = (ev.get("date") or "").strip()
        title = (ev.get("title") or "").strip()
        if not date_str or not title:
            continue
        rows.append({
            "event_date": date_str,
            "title": title,
            "category": ev.get("category"),
            "importance": ev.get("importance") or "medium",
            "volatility": ev.get("volatility"),
            "window_start": (ev.get("window_start") or "").strip() or None,
            "source": ev.get("source"),
            "note": ev.get("note"),
            "last_updated": now_iso,
        })
    logger.info("Events: loaded %d calendar entries", len(rows))
    return rows


# ------------------------------------------------------------------
# Row assembly
# ------------------------------------------------------------------

def _build_indicator_rows(
    yf_values: dict[str, dict],
    esdm_values: dict[str, dict],
) -> tuple[list[dict], list[dict]]:
    """
    Merge the registry's static fields with provider values into
    (market_indicators rows, market_indicator_history rows).
    Indicators with no fresh value are skipped (latest-only table keeps
    the previous row untouched, preserving last-good data).
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    snapshot_rows: list[dict] = []
    history_rows: list[dict] = []

    for ind in INDICATORS:
        key = ind["key"]
        if ind["provider"] == "yfinance":
            vals = yf_values.get(key)
        else:  # esdm_hba / esdm_hma
            vals = esdm_values.get(ind.get("esdm_metric", key))

        if not vals or vals.get("value") is None:
            continue

        value = vals["value"]
        prev = vals.get("prev_value")
        change_abs = round(value - prev, 4) if prev is not None else None
        change_pct = (
            round((value - prev) / prev * 100, 4)
            if prev not in (None, 0)
            else None
        )

        snapshot_rows.append({
            "indicator_key": key,
            "label": ind["label"],
            "category": ind["category"],
            "unit": ind.get("unit"),
            "provider": ind["provider"],
            "cadence": ind["cadence"],
            "value": value,
            "prev_value": prev,
            "change_abs": change_abs,
            "change_pct": change_pct,
            "as_of": vals.get("as_of"),
            "reference_period": vals.get("reference_period"),
            "sort_order": ind["sort_order"],
            "is_active": ind["is_active"],
            "last_updated": now_iso,
        })
        history_rows.append({
            "indicator_key": key,
            "as_of": vals.get("as_of"),
            "value": value,
            "reference_period": vals.get("reference_period"),
            "last_updated": now_iso,
        })

    return snapshot_rows, history_rows


# ------------------------------------------------------------------
# Main scraper
# ------------------------------------------------------------------

def run(indicators_only: bool = False, news_only: bool = False) -> RunResult:
    """
    Fetch indicators + news and upsert into the market_* tables.

    Args:
        indicators_only: skip the RSS news fetch.
        news_only:       skip the indicator (yfinance + ESDM) fetch.
    """
    result = RunResult("market_pulse")
    run_id = start_run(
        "market_pulse",
        metadata={"indicators_only": indicators_only, "news_only": news_only},
    )

    do_indicators = not news_only
    do_news = not indicators_only

    if do_indicators:
        yf_values = _provider_yfinance(INDICATORS)
        esdm_values = _provider_esdm()
        snapshot_rows, history_rows = _build_indicator_rows(yf_values, esdm_values)

        if snapshot_rows:
            bulk_upsert("market_indicators", snapshot_rows, on_conflict="indicator_key")
            bulk_upsert("market_indicator_history", history_rows, on_conflict="indicator_key,as_of")
            logger.info("Upserted %d indicator snapshot rows", len(snapshot_rows))

        # Track outcome per active indicator so status reflects coverage.
        resolved = {r["indicator_key"] for r in snapshot_rows}
        for ind in INDICATORS:
            if not ind["is_active"]:
                result.skip(ind["key"], "inactive")
            elif ind["key"] in resolved:
                result.ok(ind["key"])
            else:
                result.fail(ind["key"], "no value from provider")

    if do_news:
        news_rows, _, feeds_failed = _provider_rss()
        if news_rows:
            bulk_upsert("market_news", news_rows, on_conflict="id")
            logger.info("Upserted %d news headlines", len(news_rows))
        if feeds_failed:
            result.fail("news_feeds", f"{feeds_failed} feed(s) failed")
        else:
            result.ok("news_feeds")

    # Curated important-dates calendar (cheap local-file load; always refreshed
    # so DB reflects edits to shared/market-events.json). Non-fatal — e.g. if the
    # v30 migration hasn't been applied yet, this shouldn't sink the whole run.
    event_rows = _provider_events()
    if event_rows:
        try:
            bulk_upsert("market_events", event_rows, on_conflict="event_date,title")
            logger.info("Upserted %d calendar events", len(event_rows))
            result.ok("market_events")
        except Exception as e:
            logger.warning("market_events upsert failed (non-fatal): %s", e)
            result.fail("market_events", str(e))

    result.print_summary()
    finish_run(run_id, **result.to_db_kwargs())
    return result


# ------------------------------------------------------------------
# Entry point
# ------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Scrape market indicators + news → Supabase market_* tables"
    )
    parser.add_argument("--indicators-only", action="store_true",
                        help="Fetch indicators only (skip RSS news)")
    parser.add_argument("--news-only", action="store_true",
                        help="Fetch RSS news only (skip indicators)")
    args = parser.parse_args()

    setup_logging("market_pulse")
    run(indicators_only=args.indicators_only, news_only=args.news_only)
