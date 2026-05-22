-- =============================================================================
-- schema-v30-market-events.sql
-- Market Pulse — important-dates calendar
--
-- Backs the "Important Dates" column in the homepage Market Pulse header:
-- index rebalancing (MSCI / FTSE), monetary decisions (BI rate / Fed FOMC),
-- and macro releases (BPS GDP / inflation) that move the IDX.
--
-- Curated source of truth: shared/market-events.json (owner-editable, like
-- shared/macro-context.json). market_pulse.py reads it and upserts here, so
-- the deployed web app reads from Supabase like the rest of Market Pulse.
--
-- Depends on: schema.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS market_events (
    event_date    DATE NOT NULL,
    title         TEXT NOT NULL,
    category      TEXT,                 -- index_rebalance | monetary | macro_release | global | other
    importance    TEXT DEFAULT 'medium',-- high | medium | low (visual emphasis)
    source        TEXT,                 -- e.g. 'MSCI', 'Bank Indonesia', 'BPS', 'Federal Reserve'
    note          TEXT,                 -- short context shown under the title
    last_updated  TIMESTAMPTZ DEFAULT NOW(),

    PRIMARY KEY (event_date, title)
);

CREATE INDEX IF NOT EXISTS idx_market_events_date
  ON market_events(event_date);

-- RLS — allow anon key read access (NextJS frontend)
ALTER TABLE market_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read" ON market_events FOR SELECT USING (true);
