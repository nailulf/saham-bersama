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
  - yfinance          : live daily quotes (FX, indices, gold, silver, crude, nickel)
  - trading_economics : commodity prices scraped from category pages on
                        tradingeconomics.com (guest API was discontinued)
  - RSS               : news headlines via feedparser

This scraper is ticker-independent and uses only public sources, so it is safe
to run on GitHub Actions / cron. Recommended cadence: daily ~07:00 WIB
(post-US-close / pre-IDX-open).

Run:
    cd python && python -m scrapers.market_pulse
    cd python && python -m scrapers.market_pulse --indicators-only
    cd python && python -m scrapers.market_pulse --news-only
"""
import argparse
import hashlib
import logging
import re
import sys
import time
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd
import yfinance as yf
import requests

try:
    from curl_cffi import requests as cffi_requests
    _HAS_CFFI = True
except ImportError:
    _HAS_CFFI = False

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
# Provider: Trading Economics — category-page HTML scraper
# ------------------------------------------------------------------

# One representative URL per commodity category. Each page contains a server-
# side-rendered table covering its whole category (~17-18 rows). Scraping these
# 7 pages gives ~80-100 unique commodities without hitting the defunct guest API.
_TE_BASE = "https://tradingeconomics.com"
_TE_CATEGORY_PATHS: list[str] = [
    "/commodity/nickel",        # industrial metals: Ni, Zn, Sn, Al, Co, Pb, …
    "/commodity/gold",          # precious metals: Au, Ag, Pt, Pd
    "/commodity/coal",          # energy: Coal, Crude, Brent, Natural Gas, LNG, …
    "/commodity/coking-coal",   # coking coal + other energy/mining variants
    "/commodity/corn",          # agriculture: Corn, Soy, Wheat, Palm Oil, Cocoa, …
    "/commodity/steel",         # iron & steel
    "/commodity/lithium",       # tech / battery metals: Li, Co (may overlap metals)
    "/commodity/urea",          # fertilisers: Urea, Ammonia, DAP, Potash
]


def _te_parse_date(raw: str) -> str:
    """Convert TE's "Jun/03" format to an ISO date string."""
    raw = raw.strip()
    try:
        d = datetime.strptime(raw, "%b/%d")
        year = date.today().year
        candidate = d.replace(year=year).date()
        # If the parsed date is more than 10 days in the future it's from last year.
        if (candidate - date.today()).days > 10:
            candidate = candidate.replace(year=year - 1)
        return candidate.isoformat()
    except ValueError:
        return date.today().isoformat()


def _te_parse_table(html: str) -> list[dict]:
    """
    Extract all commodity rows from the market summary table on a TE category page.
    Each <tr data-symbol="…"> row yields: slug, name, price, prev_price, as_of.
    """
    rows: list[dict] = []
    for tr_m in re.finditer(
        r'<tr[^>]*data-symbol="([^"]+)"[^>]*>(.*?)</tr>', html, re.DOTALL
    ):
        row_html = tr_m.group(2)

        link_m = re.search(
            r'href="/commodity/([a-z0-9-]+)"[^>]*>(.*?)</a>', row_html, re.DOTALL
        )
        price_m = re.search(r'id="p"[^>]*>([\d,\.]+)', row_html)
        nch_m = re.search(r'id="nch"[^>]*>([-\d,\.]+)', row_html)
        date_m = re.search(r'id="date"[^>]*>([^<]+)', row_html)

        if not link_m or not price_m:
            continue

        slug = link_m.group(1)
        name = re.sub(r"<[^>]+>", "", link_m.group(2)).strip()
        price = safe_float(price_m.group(1).replace(",", ""), 4)
        if price is None:
            continue

        nch = safe_float(nch_m.group(1).replace(",", ""), 4) if nch_m else None
        prev = round(price - nch, 4) if nch is not None else None
        as_of = _te_parse_date(date_m.group(1)) if date_m else date.today().isoformat()

        rows.append({"slug": slug, "name": name, "price": price, "prev": prev, "as_of": as_of})
    return rows


def _provider_trading_economics_bulk() -> tuple[list[dict], list[dict]]:
    """
    Scrape commodity prices from Trading Economics category pages and return
    (snapshot_rows, history_rows) ready for direct upsert.

    Uses curl_cffi browser impersonation (already a project dependency via
    idx_client). Scrapes _TE_CATEGORY_PATHS (~7 pages) at 0.4 s intervals;
    deduplicates by slug so overlapping categories don't double-count.

    Keys: "te_" + slug-with-underscores  e.g. te_iron_ore, te_coking_coal.
    Non-fatal: on any error returns ([], []) so DB rows keep their last-good values.
    """
    if not _HAS_CFFI:
        logger.warning("curl_cffi not installed — Trading Economics scraping skipped")
        return [], []

    snapshot_rows: list[dict] = []
    history_rows: list[dict] = []
    now_iso = datetime.now(timezone.utc).isoformat()
    seen: set[str] = set()
    sort_idx = 0

    for path in _TE_CATEGORY_PATHS:
        url = f"{_TE_BASE}{path}"
        try:
            resp = cffi_requests.get(
                url,
                headers={"User-Agent": _UA, "Referer": f"{_TE_BASE}/commodities"},
                impersonate="chrome",
                timeout=20,
            )
            if resp.status_code != 200:
                logger.warning("TE %s → HTTP %d (non-fatal)", path, resp.status_code)
                time.sleep(0.4)
                continue

            page_rows = _te_parse_table(resp.text)
            new_count = 0
            for row in page_rows:
                slug = row["slug"]
                if slug in seen:
                    continue
                seen.add(slug)

                key = "te_" + slug.replace("-", "_")
                price = row["price"]
                prev = row["prev"]
                as_of = row["as_of"]
                change_abs = round(price - prev, 4) if prev is not None else None
                change_pct = (
                    round((price - prev) / prev * 100, 4) if prev not in (None, 0) else None
                )

                snapshot_rows.append({
                    "indicator_key": key,
                    "label": row["name"],
                    "category": "commodity",
                    "unit": "USD/unit",
                    "provider": "trading_economics",
                    "cadence": "live_daily",
                    "value": price,
                    "prev_value": prev,
                    "change_abs": change_abs,
                    "change_pct": change_pct,
                    "as_of": as_of,
                    "reference_period": None,
                    "sort_order": 200 + sort_idx,
                    "is_active": True,
                    "last_updated": now_iso,
                })
                history_rows.append({
                    "indicator_key": key,
                    "as_of": as_of,
                    "value": price,
                    "reference_period": None,
                    "last_updated": now_iso,
                })
                sort_idx += 1
                new_count += 1

            logger.debug("TE %s → %d rows (%d new)", path, len(page_rows), new_count)
        except Exception as exc:
            logger.warning("TE %s failed (non-fatal): %s", path, exc)

        time.sleep(0.4)

    logger.info(
        "Trading Economics: %d unique commodities from %d category pages",
        len(snapshot_rows), len(_TE_CATEGORY_PATHS),
    )
    return snapshot_rows, history_rows


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
) -> tuple[list[dict], list[dict]]:
    """
    Merge the INDICATORS registry (yfinance entries) with fetched values into
    (market_indicators rows, market_indicator_history rows).
    Indicators with no fresh value are skipped — the latest-only table keeps
    the previous row untouched, preserving last-good data.
    Trading Economics commodities are assembled directly in
    _provider_trading_economics_bulk() and bypass this function.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    snapshot_rows: list[dict] = []
    history_rows: list[dict] = []

    for ind in INDICATORS:
        key = ind["key"]
        vals = yf_values.get(key) if ind["provider"] == "yfinance" else None

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
        snapshot_rows, history_rows = _build_indicator_rows(yf_values)

        te_snapshot, te_history = _provider_trading_economics_bulk()
        snapshot_rows.extend(te_snapshot)
        history_rows.extend(te_history)

        if snapshot_rows:
            bulk_upsert("market_indicators", snapshot_rows, on_conflict="indicator_key")
            bulk_upsert("market_indicator_history", history_rows, on_conflict="indicator_key,as_of")
            logger.info("Upserted %d indicator snapshot rows (%d TE commodities)",
                        len(snapshot_rows), len(te_snapshot))

        # Track outcome for config-driven indicators (yfinance).
        resolved = {r["indicator_key"] for r in snapshot_rows}
        for ind in INDICATORS:
            if not ind["is_active"]:
                result.skip(ind["key"], "inactive")
            elif ind["key"] in resolved:
                result.ok(ind["key"])
            else:
                result.fail(ind["key"], "no value from provider")
        # TE bulk result: single summary entry.
        if te_snapshot:
            result.ok(f"trading_economics ({len(te_snapshot)} commodities)")
        else:
            result.fail("trading_economics", "no commodities returned")

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
