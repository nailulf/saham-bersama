-- schema-v34: extend market_indicators check constraints for Trading Economics
--
-- Changes:
--   1. category: add 'commodity' (for all TE bulk-scraped commodity rows)
--   2. provider:  replace esdm_hba/esdm_hma (defunct) with 'trading_economics'
--
-- Safe to re-run: ALTER CONSTRAINT operations are idempotent via DROP IF EXISTS
-- + re-add pattern.

-- 1. category check — add 'commodity'
ALTER TABLE market_indicators
  DROP CONSTRAINT IF EXISTS market_indicators_category_check;

ALTER TABLE market_indicators
  ADD CONSTRAINT market_indicators_category_check
  CHECK (category IN ('fx', 'index_id', 'index_us', 'metal', 'energy', 'minerba', 'commodity'));

-- 2. provider check — replace defunct ESDM providers with trading_economics
ALTER TABLE market_indicators
  DROP CONSTRAINT IF EXISTS market_indicators_provider_check;

ALTER TABLE market_indicators
  ADD CONSTRAINT market_indicators_provider_check
  CHECK (provider IN ('yfinance', 'trading_economics'));
