-- schema-v32-screener-metrics-refresh.sql
-- Track when a stock's denormalized screener metrics (revenue/price/OCF CAGR
-- and dividend-yield averages) were last recomputed.
--
-- Background: the v16/v20 migrations backfilled stocks.{revenue,price,ocf}_cagr_*
-- and stocks.div_yield_avg_* once, by hand. They had no recurring refresh, so
-- price CAGR in particular drifted stale (current_price moves daily). The
-- ratio_enricher scraper (`run_all.py --enrich-ratios`) now refreshes these in
-- Python, but only for stocks not refreshed in the last month — this column is
-- the staleness gate it reads and stamps.

ALTER TABLE stocks
  ADD COLUMN IF NOT EXISTS screener_metrics_updated_at TIMESTAMPTZ;

-- Partial index so "stale or never-refreshed" lookups stay cheap as coverage grows.
CREATE INDEX IF NOT EXISTS idx_stocks_screener_metrics_updated_at
  ON stocks (screener_metrics_updated_at);

COMMENT ON COLUMN stocks.screener_metrics_updated_at IS
  'Last time revenue/price/ocf CAGR + div_yield_avg were recomputed by ratio_enricher (--enrich-ratios). NULL = never refreshed since v32.';
