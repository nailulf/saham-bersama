-- =============================================================================
-- schema-v31-market-events-volatility.sql
-- Market Pulse — volatility windows for the important-dates calendar
--
-- Many high-impact events (especially index rebalancing) are preceded by an
-- announcement days/weeks before the effective date; the window between the
-- two is when the market tends to be most volatile. These columns let the
-- homepage surface a warning during that window.
--
--   window_start : date the volatility window opens (e.g. the announcement
--                  date). Effective date stays in `event_date`.
--   volatility   : 'high' | 'medium' | 'low' | NULL — drives the warning
--                  banner (high) and calendar row emphasis.
--
-- Depends on: schema-v30-market-events.sql
-- =============================================================================

ALTER TABLE market_events
  ADD COLUMN IF NOT EXISTS window_start DATE,
  ADD COLUMN IF NOT EXISTS volatility   TEXT;

COMMENT ON COLUMN market_events.window_start IS
  'Date the elevated-volatility window opens (e.g. index rebalancing '
  'announcement date). event_date holds the effective/decision date.';
COMMENT ON COLUMN market_events.volatility IS
  'high | medium | low | NULL. high drives the homepage volatility warning banner.';
