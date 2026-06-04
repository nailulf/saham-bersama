from __future__ import annotations

"""
market_pulse_config.py — registry for the homepage Market Pulse header.

Single source of truth for which indicators and news feeds the
`market_pulse.py` scraper collects. Pure data, no I/O — add or remove an
indicator here and the scraper + header pick it up without code changes.

Each INDICATORS entry maps to one row in the `market_indicators` table.
  key         : stable primary key (also the indicator_key column)
  label       : display label shown on the card
  category    : fx | index_id | index_us | metal | energy | minerba
  unit        : IDR | points | USD/oz | USD/ton | USD/bbl
  provider   : yfinance  (Trading Economics commodities are fetched dynamically —
               see _provider_trading_economics_bulk() in market_pulse.py)
  cadence    : live_daily | monthly_reference
  sort_order : ascending display order in the header (TE commodities start at 200)
  is_active  : False → hidden in the UI (kept here for future sourcing)
  symbol     : yfinance ticker (provider == 'yfinance' only)
"""

# yfinance covers FX, indices, gold, silver, crude, and LME nickel (NI=F).
# All other commodities (coal, iron ore, nickel spot, tin, zinc, …) are bulk-
# fetched from the Trading Economics guest API and stored with "te_" key prefix.
# CPO has no reliable free source so it ships inactive.
INDICATORS: list[dict] = [
    # --- FX + local index (live daily) ---
    {"key": "usd_idr", "label": "USD/IDR", "category": "fx", "unit": "IDR",
     "provider": "yfinance", "cadence": "live_daily", "sort_order": 10,
     "is_active": True, "symbol": "IDR=X"},
    {"key": "ihsg", "label": "IHSG", "category": "index_id", "unit": "points",
     "provider": "yfinance", "cadence": "live_daily", "sort_order": 20,
     "is_active": True, "symbol": "^JKSE"},

    # --- Minerba / commodity reference prices ---
    # Nickel kept here explicitly as the LME contract (NI=F) — a specific
    # tradeable instrument distinct from TE's spot/composite nickel price.
    # All other commodities (coal, iron ore, ferroalloy, etc.) are fetched
    # automatically by _provider_trading_economics_bulk() and stored with
    # keys prefixed "te_" (e.g. te_coal, te_iron_ore). No config entries needed.
    {"key": "nickel_hma", "label": "Nickel (LME)", "category": "minerba", "unit": "USD/ton",
     "provider": "yfinance", "cadence": "live_daily", "sort_order": 40,
     "is_active": True, "symbol": "NI=F"},

    # --- Metals (live daily) ---
    {"key": "gold", "label": "Gold", "category": "metal", "unit": "USD/oz",
     "provider": "yfinance", "cadence": "live_daily", "sort_order": 60,
     "is_active": True, "symbol": "GC=F"},
    {"key": "silver", "label": "Silver", "category": "metal", "unit": "USD/oz",
     "provider": "yfinance", "cadence": "live_daily", "sort_order": 70,
     "is_active": True, "symbol": "SI=F"},

    # --- CPO — no minerba source yet; hidden until sourced ---
    {"key": "cpo", "label": "CPO", "category": "metal", "unit": "USD/ton",
     "provider": "yfinance", "cadence": "live_daily", "sort_order": 80,
     "is_active": False, "symbol": "KO=F"},

    # --- Energy (live daily) ---
    {"key": "brent", "label": "Brent", "category": "energy", "unit": "USD/bbl",
     "provider": "yfinance", "cadence": "live_daily", "sort_order": 90,
     "is_active": True, "symbol": "BZ=F"},
    {"key": "wti", "label": "WTI", "category": "energy", "unit": "USD/bbl",
     "provider": "yfinance", "cadence": "live_daily", "sort_order": 100,
     "is_active": True, "symbol": "CL=F"},

    # --- US indices (overnight backdrop) ---
    {"key": "sp500", "label": "S&P 500", "category": "index_us", "unit": "points",
     "provider": "yfinance", "cadence": "live_daily", "sort_order": 110,
     "is_active": True, "symbol": "^GSPC"},
    {"key": "dow", "label": "Dow Jones", "category": "index_us", "unit": "points",
     "provider": "yfinance", "cadence": "live_daily", "sort_order": 120,
     "is_active": True, "symbol": "^DJI"},
    {"key": "nasdaq", "label": "Nasdaq", "category": "index_us", "unit": "points",
     "provider": "yfinance", "cadence": "live_daily", "sort_order": 130,
     "is_active": True, "symbol": "^IXIC"},
]


# Indonesian-market RSS feeds. Headlines link out to the source.
#
# Each entry: {source, url, broad?}.
#   broad=True  → general finance/economy feed; headlines are filtered to
#                 market-relevant ones (see MARKET_KEYWORDS) to drop off-topic
#                 stories (crime, lifestyle, etc.).
#   broad=False → already market/bourse-focused; kept as-is.
#
# Two ways to declare a feed:
#   {"source", "url"}              → fetch this RSS URL directly.
#   {"source", "google_news_site"} → build a Google News RSS query scoped to
#                                    that domain (for publishers that have
#                                    retired native RSS, e.g. bisnis.com,
#                                    investor.id). Links go via a Google
#                                    redirect; titles get the " - Publisher"
#                                    suffix stripped.
#
# Direct URLs below were verified to return valid RSS. Feeds that only serve an
# HTML landing page (e.g. www.kontan.co.id/rss) or 404 are intentionally
# excluded — use the channel-specific feed (or Google News) instead.
NEWS_FEEDS: list[dict] = [
    {"source": "Kontan Investasi", "url": "https://investasi.kontan.co.id/rss"},
    {"source": "CNBC Indonesia", "url": "https://www.cnbcindonesia.com/market/rss"},
    {"source": "Detik Finance", "url": "https://finance.detik.com/rss", "broad": True},
    {"source": "Antara Ekonomi", "url": "https://www.antaranews.com/rss/ekonomi", "broad": True},
    # These publishers have no working native RSS (retired/disallowed/500/204)
    # → pulled via a domain-scoped Google News query.
    {"source": "Bisnis.com", "google_news_site": "bisnis.com"},
    {"source": "investor.id", "google_news_site": "investor.id"},
    {"source": "EmitenNews", "google_news_site": "emitennews.com"},
    {"source": "IDNFinancials", "google_news_site": "idnfinancials.com"},
    # Stockbit Snips is a ~daily digest → widen the window to gather a few editions.
    {"source": "Stockbit Snips", "google_news_site": "snips.stockbit.com",
     "google_news_window": "14d", "broad": True},
    # Ajaib mixes IDX news with crypto, US stocks, and auto-generated quote
    # pages. Drop the bare 'saham' term (it matches "Harga Saham X" quote pages)
    # and scope to IDX-specific terms. (No negatives — Google News RSS rejects them.)
    {"source": "Ajaib", "google_news_site": "ajaib.co.id", "broad": True,
     "google_news_query": 'IHSG OR emiten OR dividen OR bursa OR "pasar modal"'},
]

# Market terms used to build the Google News query for google_news_site feeds.
GOOGLE_NEWS_QUERY_TERMS = (
    'saham OR IHSG OR emiten OR "pasar modal" OR rupiah OR dividen OR bursa'
)

# Cap headlines kept per feed per run (most recent first).
MAX_HEADLINES_PER_FEED = 12

# Market-relevance keywords. Applied (case-insensitive, title + summary) only to
# feeds flagged broad=True, so general finance/economy feeds contribute market
# news instead of crime/lifestyle filler. Kept broad enough to retain macro
# items that move the bourse (rupiah, BI rate, commodities).
MARKET_KEYWORDS: tuple[str, ...] = (
    "saham", "ihsg", "bursa", "bei", "idx", "emiten", "dividen", "obligasi",
    "reksa dana", "reksadana", "ipo", "rights issue", "right issue", "akuisisi",
    "merger", "lq45", "indeks", "investasi", "investor", "rupiah", "kurs",
    "the fed", "bi rate", "suku bunga", "inflasi", "komoditas", "nikel",
    "batu bara", "batubara", "emas", "minyak", "cpo", "sawit", "laba bersih",
    "kinerja keuangan", "pendapatan", "wall street", "asing", "net buy",
    "net sell", "valuasi", "obligasi", "sbn", "tbk",
)
