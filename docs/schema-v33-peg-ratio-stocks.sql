-- schema-v33-peg-ratio-stocks.sql
-- Add peg_ratio screener column to stocks table.
-- Populated by ratio_enricher._sync_screener_ratios from the latest annual financials row.

ALTER TABLE stocks ADD COLUMN IF NOT EXISTS peg_ratio DECIMAL;
