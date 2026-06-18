-- v37: IDX corporate-action calendar (RUPS, dividends, public expose, etc.)
-- Populated by python/scrapers/idx_calendar.py from /primary/Home/GetCalendar.
-- Read by the web home Market Calendar widget (lib/queries/idx-calendar.ts).

CREATE TABLE IF NOT EXISTS corporate_calendar (
  idx_id       BIGINT PRIMARY KEY,          -- stable IDX agenda id
  ticker       TEXT NOT NULL,
  event_date   DATE NOT NULL,
  event_type   TEXT NOT NULL,               -- rups | dividend | public_expose | bond | ipo | other
  jenis        TEXT,
  step         TEXT,
  title        TEXT,                          -- IDX description
  location     TEXT,
  rups_at      TIMESTAMPTZ,
  pe_at        TIMESTAMPTZ,
  source       TEXT DEFAULT 'idx_getcalendar',
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_corpcal_event_date ON corporate_calendar (event_date);
CREATE INDEX IF NOT EXISTS idx_corpcal_ticker     ON corporate_calendar (ticker);

-- Public read for the anon (frontend) role, matching market_events.
ALTER TABLE corporate_calendar ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read" ON corporate_calendar;
CREATE POLICY "Allow public read" ON corporate_calendar FOR SELECT USING (true);