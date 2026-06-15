-- schema-v33-bandar-screener.sql
-- Denormalize the latest bandar accumulation/distribution signal onto stocks so
-- the screener can filter by it (the "Identifikasi broker bandar" data already
-- lives per-day in bandar_signal; the screener only queries `stocks`).
--
-- Populated by money_flow.py sync_bandar_to_stocks() (run_all --daily-light /
-- broker-backfill, or `python scrapers/money_flow.py --sync-bandar`). Only the
-- latest signal within a recent window is used — a stale accdist is meaningless,
-- so stocks without a recent bandar_signal stay NULL.

ALTER TABLE stocks
  ADD COLUMN IF NOT EXISTS bandar_accdist       TEXT,   -- broker_accdist: 'Acc' | 'Dist'
  ADD COLUMN IF NOT EXISTS bandar_top3_accdist  TEXT,   -- top3_accdist: 'Big Acc'..'Big Dist' | 'Neutral'
  ADD COLUMN IF NOT EXISTS bandar_signal_date   DATE;   -- trade_date of the source bandar_signal row

CREATE INDEX IF NOT EXISTS idx_stocks_bandar_accdist ON stocks (bandar_accdist);

COMMENT ON COLUMN stocks.bandar_accdist IS
  'Latest overall bandar signal from bandar_signal.broker_accdist (Acc/Dist), within a recent window. NULL = no recent signal. (v33)';
COMMENT ON COLUMN stocks.bandar_top3_accdist IS
  'Latest graded top-3-broker signal from bandar_signal.top3_accdist (Big/Normal/Small Acc|Dist, Neutral). (v33)';
COMMENT ON COLUMN stocks.bandar_signal_date IS
  'trade_date of the bandar_signal row denormalized into bandar_accdist/bandar_top3_accdist. (v33)';
