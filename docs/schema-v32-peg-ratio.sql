-- schema-v32-peg-ratio.sql
-- Add peg_ratio column to financials table.
-- PEG = P/E ÷ EPS_CAGR_3yr (%). NULL for cyclicals, banks, negative EPS, or negative growth.
-- Computed by ratio_enricher.py at the latest annual row per ticker.

ALTER TABLE financials ADD COLUMN IF NOT EXISTS peg_ratio DECIMAL;
