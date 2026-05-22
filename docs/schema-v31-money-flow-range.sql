-- =============================================================================
-- schema-v31-money-flow-range.sql
-- Money Flow duration filter — range-aware aggregation RPCs
--
-- The Money Flow page gains a duration filter (1D / 7D / 30D / YTD). Single-day
-- (1D) is just from = to. Multi-day windows aggregate (sum) over the range.
--
-- Replaces the single-date RPCs from schema-v30 with range versions:
--   mf_summary_range(from, to)                     — idx_stock_summary, 1 row/ticker
--   mf_top_brokers(from, to, dir, limit)           — market-wide top brokers
--   mf_broker_top_tickers(from, to, broker, dir, n) — a broker's top emiten
--
-- mf_summary_range returns ≤ ~960 rows (one per ticker) regardless of window
-- length, so it stays under the PostgREST 1000-row cap even for YTD. close /
-- change reflect the LAST day in the window (for display); value / volume /
-- foreign_buy / foreign_sell are summed across the window.
--
-- Depends on: schema-v30 (idx_stock_summary, broker_flow date index).
-- Idempotent: safe to re-run.
-- =============================================================================


-- ── Aggregate idx_stock_summary over a date range (1 row per ticker) ─────────
CREATE OR REPLACE FUNCTION mf_summary_range(p_from DATE, p_to DATE)
RETURNS TABLE (
    ticker        VARCHAR,
    name          TEXT,
    close         NUMERIC,
    prev_close    NUMERIC,
    change        NUMERIC,
    value         NUMERIC,
    volume        NUMERIC,
    foreign_buy   NUMERIC,
    foreign_sell  NUMERIC,
    days          INT
)
LANGUAGE sql STABLE AS $$
    WITH agg AS (
        SELECT
            ss.ticker,
            SUM(ss.value)        AS value,
            SUM(ss.volume)       AS volume,
            SUM(ss.foreign_buy)  AS foreign_buy,
            SUM(ss.foreign_sell) AS foreign_sell,
            COUNT(*)             AS days,
            MAX(ss.date)         AS last_date
        FROM idx_stock_summary ss
        WHERE ss.date BETWEEN p_from AND p_to
        GROUP BY ss.ticker
    )
    SELECT
        a.ticker,
        s.name,
        last.close::NUMERIC,
        last.prev_close::NUMERIC,
        last.change::NUMERIC,
        a.value::NUMERIC,
        a.volume::NUMERIC,
        a.foreign_buy::NUMERIC,
        a.foreign_sell::NUMERIC,
        a.days::INT
    FROM agg a
    LEFT JOIN stocks s ON s.ticker = a.ticker
    LEFT JOIN LATERAL (
        SELECT i.close, i.prev_close, i.change
        FROM idx_stock_summary i
        WHERE i.ticker = a.ticker AND i.date = a.last_date
        LIMIT 1
    ) last ON TRUE;
$$;


-- ── Market-wide top brokers by buy/sell value over a range ───────────────────
DROP FUNCTION IF EXISTS mf_top_brokers(DATE, TEXT, INT);
CREATE OR REPLACE FUNCTION mf_top_brokers(
    p_from  DATE,
    p_to    DATE,
    p_dir   TEXT,
    p_limit INT DEFAULT 10
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
        MAX(bf.broker_type)         AS broker_type,
        SUM(bf.buy_value)::NUMERIC  AS buy_value,
        SUM(bf.sell_value)::NUMERIC AS sell_value,
        SUM(bf.net_value)::NUMERIC  AS net_value,
        SUM(bf.frequency)::NUMERIC  AS frequency,
        COUNT(DISTINCT bf.ticker)   AS ticker_count
    FROM broker_flow bf
    WHERE bf.trade_date BETWEEN p_from AND p_to
    GROUP BY bf.broker_code
    ORDER BY (CASE WHEN p_dir = 'buy' THEN SUM(bf.buy_value)
                   ELSE SUM(bf.sell_value) END) DESC
    LIMIT p_limit;
$$;


-- ── A single broker's top emiten over a range ────────────────────────────────
DROP FUNCTION IF EXISTS mf_broker_top_tickers(DATE, TEXT, TEXT, INT);
CREATE OR REPLACE FUNCTION mf_broker_top_tickers(
    p_from   DATE,
    p_to     DATE,
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
        SUM(bf.buy_value)::NUMERIC  AS buy_value,
        SUM(bf.sell_value)::NUMERIC AS sell_value,
        SUM(bf.net_value)::NUMERIC  AS net_value
    FROM broker_flow bf
    LEFT JOIN stocks s ON s.ticker = bf.ticker
    WHERE bf.trade_date BETWEEN p_from AND p_to
      AND bf.broker_code = p_broker
    GROUP BY bf.ticker, s.name
    ORDER BY (CASE WHEN p_dir = 'buy' THEN SUM(bf.buy_value)
                   ELSE SUM(bf.sell_value) END) DESC
    LIMIT p_limit;
$$;
