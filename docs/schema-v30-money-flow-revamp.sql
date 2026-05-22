-- =============================================================================
-- schema-v30-money-flow-revamp.sql
-- Money Flow page revamp — market-wide daily flow views
--
-- Powers the redesigned /money-flow page, which answers, for the last active
-- trading day:
--   1. Most active stocks by total transaction value (Total)
--   2. Top net foreign (Asing) buyers / sellers      (Foreign net flow)
--   3. Top net domestic (Lokal) buyers / sellers     (Domestic net flow)
--   4. Top buy brokers market-wide + their top-10 emiten
--   5. Top sell brokers market-wide + their top-10 emiten
--
-- Adds:
--   A. idx_stock_summary  — IDX OFFICIAL per-stock daily summary. One row per
--      (ticker, date). Source of truth for total transaction VALUE (IDR) and
--      official foreign buy/sell (in SHARES — note: NOT IDR). Populated by
--      python/scrapers/idx_stock_summary.py (IDX GetStockSummary, one call/date).
--      It is more current than broker_flow (Stockbit lags ~1 trading day) and is
--      used both for the "Most Active" view and as a cross-check against the
--      Stockbit-derived net-flow leaderboards.
--
--      WHY two foreign numbers can disagree (by design, not a bug):
--        - IDX foreign buy/sell  = transaction-level foreign flag, in SHARES.
--        - broker_flow 'Asing'   = Stockbit broker-type classification, in IDR.
--        A foreign fund trading via a local broker (or vice-versa) lands on the
--        opposite side, so direction and magnitude can differ.
--
--   B. idx_bf_trade_date  — index on broker_flow(trade_date). The market-wide
--      RPCs below filter by a single date across ALL tickers; without this index
--      a date-only scan over broker_flow times out.
--
--   C. RPC functions (mf_*) — aggregate broker_flow server-side and return
--      already-sorted top-N rows. This sidesteps the PostgREST 1000-row cap that
--      a client-side aggregate over ~959 tickers × ~50 brokers would hit.
--
-- Read by web/src/lib/queries/money-flow.ts.
-- Depends on: schema.sql (stocks, daily_prices), schema-v9-smart-money.sql (broker_flow)
-- Idempotent: safe to re-run.
-- =============================================================================


-- =============================================================================
-- A. idx_stock_summary — IDX official daily per-stock trading summary
-- =============================================================================

CREATE TABLE IF NOT EXISTS idx_stock_summary (
    ticker         VARCHAR(10) NOT NULL REFERENCES stocks(ticker) ON DELETE CASCADE,
    date           DATE        NOT NULL,
    prev_close     DECIMAL(12, 2),
    open           DECIMAL(12, 2),
    high           DECIMAL(12, 2),
    low            DECIMAL(12, 2),
    close          DECIMAL(12, 2),
    change         DECIMAL(12, 2),                 -- close - prev_close
    volume         BIGINT,                         -- shares
    value          BIGINT,                         -- IDR — total transaction value
    frequency      INTEGER,
    foreign_buy    BIGINT,                         -- SHARES (IDX official, NOT IDR)
    foreign_sell   BIGINT,                         -- SHARES (IDX official, NOT IDR)
    foreign_net    BIGINT GENERATED ALWAYS AS (foreign_buy - foreign_sell) STORED,  -- SHARES
    listed_shares  BIGINT,
    last_updated   TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (ticker, date)
);

CREATE INDEX IF NOT EXISTS idx_iss_date  ON idx_stock_summary(date);
CREATE INDEX IF NOT EXISTS idx_iss_value ON idx_stock_summary(date, value DESC);

-- RLS: web reads via the anon key, so a public-read policy is required (same
-- pattern as every other web-readable table, see schema-v11-rls-policies.sql).
-- Without it the table denies anon SELECT and the Money Flow page shows empty
-- even though the scraper (service key, bypasses RLS) populated it.
ALTER TABLE idx_stock_summary ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON idx_stock_summary;
CREATE POLICY "Allow public read" ON idx_stock_summary FOR SELECT USING (true);


-- =============================================================================
-- B. broker_flow date-only index (market-wide single-day aggregates)
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_bf_trade_date ON broker_flow(trade_date);


-- =============================================================================
-- C1. mf_top_flow_by_type — top net buyers/sellers for a broker type on a date
--     p_type: 'Asing' | 'Lokal' | 'Pemerintah'
--     p_dir : 'buy'  → net_value > 0, most positive first
--             'sell' → net_value < 0, most negative first
-- =============================================================================

CREATE OR REPLACE FUNCTION mf_top_flow_by_type(
    p_date  DATE,
    p_type  TEXT,
    p_dir   TEXT,
    p_limit INT DEFAULT 15
)
RETURNS TABLE (
    ticker      VARCHAR,
    name        TEXT,
    net_value   NUMERIC,
    buy_value   NUMERIC,
    sell_value  NUMERIC
)
LANGUAGE sql STABLE AS $$
    SELECT
        bf.ticker,
        s.name,
        SUM(bf.net_value)::NUMERIC  AS net_value,
        SUM(bf.buy_value)::NUMERIC  AS buy_value,
        SUM(bf.sell_value)::NUMERIC AS sell_value
    FROM broker_flow bf
    LEFT JOIN stocks s ON s.ticker = bf.ticker
    WHERE bf.trade_date = p_date
      AND bf.broker_type = p_type
    GROUP BY bf.ticker, s.name
    HAVING (p_dir = 'buy'  AND SUM(bf.net_value) > 0)
        OR (p_dir = 'sell' AND SUM(bf.net_value) < 0)
    ORDER BY (CASE WHEN p_dir = 'buy' THEN SUM(bf.net_value)
                   ELSE -SUM(bf.net_value) END) DESC
    LIMIT p_limit;
$$;


-- =============================================================================
-- C2. mf_top_brokers — market-wide top brokers by total buy or sell value
--     p_dir: 'buy' → rank by SUM(buy_value); 'sell' → rank by SUM(sell_value)
-- =============================================================================

CREATE OR REPLACE FUNCTION mf_top_brokers(
    p_date  DATE,
    p_dir   TEXT,
    p_limit INT DEFAULT 15
)
RETURNS TABLE (
    broker_code   VARCHAR,
    broker_type   VARCHAR,
    buy_value     NUMERIC,
    sell_value    NUMERIC,
    net_value     NUMERIC,
    frequency     NUMERIC,
    ticker_count  BIGINT
)
LANGUAGE sql STABLE AS $$
    SELECT
        bf.broker_code,
        MAX(bf.broker_type)            AS broker_type,
        SUM(bf.buy_value)::NUMERIC     AS buy_value,
        SUM(bf.sell_value)::NUMERIC    AS sell_value,
        SUM(bf.net_value)::NUMERIC     AS net_value,
        SUM(bf.frequency)::NUMERIC     AS frequency,
        COUNT(DISTINCT bf.ticker)      AS ticker_count
    FROM broker_flow bf
    WHERE bf.trade_date = p_date
    GROUP BY bf.broker_code
    ORDER BY (CASE WHEN p_dir = 'buy' THEN SUM(bf.buy_value)
                   ELSE SUM(bf.sell_value) END) DESC
    LIMIT p_limit;
$$;


-- =============================================================================
-- C3. mf_broker_top_tickers — a single broker's top emiten on a date
--     p_dir: 'buy' → rank by buy_value; 'sell' → rank by sell_value
-- =============================================================================

CREATE OR REPLACE FUNCTION mf_broker_top_tickers(
    p_date   DATE,
    p_broker TEXT,
    p_dir    TEXT,
    p_limit  INT DEFAULT 10
)
RETURNS TABLE (
    ticker      VARCHAR,
    name        TEXT,
    buy_value   NUMERIC,
    sell_value  NUMERIC,
    net_value   NUMERIC
)
LANGUAGE sql STABLE AS $$
    SELECT
        bf.ticker,
        s.name,
        bf.buy_value::NUMERIC  AS buy_value,
        bf.sell_value::NUMERIC AS sell_value,
        bf.net_value::NUMERIC  AS net_value
    FROM broker_flow bf
    LEFT JOIN stocks s ON s.ticker = bf.ticker
    WHERE bf.trade_date = p_date
      AND bf.broker_code = p_broker
    ORDER BY (CASE WHEN p_dir = 'buy' THEN bf.buy_value
                   ELSE bf.sell_value END) DESC
    LIMIT p_limit;
$$;
