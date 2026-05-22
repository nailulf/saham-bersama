-- =============================================================================
-- schema-v29-market-pulse.sql
-- Market Pulse — homepage header data pool
--
-- Powers the homepage "Market Pulse" header: a row of global/market indicator
-- cards (USD/IDR, IHSG, gold, silver, crude, US indices, plus monthly minerba
-- reference prices from ESDM HBA/HMA) and a list of Indonesian-market news
-- headlines from RSS feeds.
--
-- Populated by python/scrapers/market_pulse.py (yfinance + ESDM + feedparser),
-- read by web/src/lib/queries/market-pulse.ts.
--
-- Source-agnostic by design: the indicator set is data-driven (a registry in
-- python/scrapers/market_pulse_config.py), so indicators can be added/removed
-- without schema changes. Values are DECIMAL — the IDR-BIGINT convention applies
-- only to stock currency columns, not index/commodity quotes.
--
-- Depends on: schema.sql
-- =============================================================================


-- =============================================================================
-- 1. market_indicators — latest-only snapshot, one row per indicator.
--    on_conflict = indicator_key (upserted in place each scraper run).
-- =============================================================================

CREATE TABLE IF NOT EXISTS market_indicators (
    indicator_key     TEXT PRIMARY KEY,            -- e.g. 'usd_idr', 'ihsg', 'coal_hba'
    label             TEXT NOT NULL,               -- display label, e.g. 'USD/IDR'
    category          TEXT NOT NULL CHECK (category IN (
                        'fx', 'index_id', 'index_us', 'metal', 'energy', 'minerba'
                      )),
    unit              TEXT,                         -- 'IDR' | 'points' | 'USD/oz' | 'USD/ton' | 'USD/bbl'
    provider          TEXT NOT NULL CHECK (provider IN (
                        'yfinance', 'esdm_hba', 'esdm_hma'
                      )),
    cadence           TEXT NOT NULL DEFAULT 'live_daily' CHECK (cadence IN (
                        'live_daily', 'monthly_reference'
                      )),

    value             DECIMAL(20,4),               -- latest value (NULL until first successful fetch)
    prev_value        DECIMAL(20,4),               -- prior period value (for change computation)
    change_abs        DECIMAL(20,4),               -- value - prev_value
    change_pct        DECIMAL(10,4),               -- (value - prev_value)/prev_value * 100 (whole-percent)

    as_of             DATE,                         -- date the value applies to
    reference_period  TEXT,                         -- 'YYYY-MM' for monthly_reference; NULL for live_daily

    sort_order        INTEGER NOT NULL DEFAULT 100, -- display order in the header
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,-- inactive indicators are hidden (e.g. CPO until sourced)
    last_updated      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_indicators_active
  ON market_indicators(is_active, sort_order);


-- =============================================================================
-- 2. market_indicator_history — thin time series per indicator.
--    on_conflict = indicator_key,as_of. Powers prev/change computation and
--    future sparklines. Cards read latest-only from market_indicators.
-- =============================================================================

CREATE TABLE IF NOT EXISTS market_indicator_history (
    indicator_key     TEXT NOT NULL,
    as_of             DATE NOT NULL,
    value             DECIMAL(20,4),
    reference_period  TEXT,
    last_updated      TIMESTAMPTZ DEFAULT NOW(),

    PRIMARY KEY (indicator_key, as_of)
);

CREATE INDEX IF NOT EXISTS idx_market_indicator_history_key_date
  ON market_indicator_history(indicator_key, as_of DESC);


-- =============================================================================
-- 3. market_news — Indonesian-market news headlines from RSS feeds.
--    on_conflict = id (sha1 of link) so re-runs dedupe instead of duplicating.
-- =============================================================================

CREATE TABLE IF NOT EXISTS market_news (
    id                TEXT PRIMARY KEY,            -- sha1(link)
    title             TEXT NOT NULL,
    link              TEXT NOT NULL,
    source            TEXT NOT NULL,               -- e.g. 'Kontan', 'Bisnis.com'
    published_at      TIMESTAMPTZ,
    summary           TEXT,
    fetched_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_news_published
  ON market_news(published_at DESC);


-- =============================================================================
-- 4. RLS policies — allow anon key read access (NextJS frontend)
-- =============================================================================

ALTER TABLE market_indicators        ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_indicator_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_news              ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON market_indicators        FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON market_indicator_history FOR SELECT USING (true);
CREATE POLICY "Allow public read" ON market_news              FOR SELECT USING (true);
