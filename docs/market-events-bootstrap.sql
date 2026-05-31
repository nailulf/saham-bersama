-- =============================================================================
-- BOOTSTRAP: market_events table (v30 + v31) + seed from shared/market-events.json
-- Idempotent: safe to paste/run in the production Supabase SQL editor.
-- Generated from shared/market-events.json; 27 events as of 2026-05-22.
-- =============================================================================

CREATE TABLE IF NOT EXISTS market_events (
    event_date    DATE NOT NULL,
    title         TEXT NOT NULL,
    category      TEXT,
    importance    TEXT DEFAULT 'medium',
    source        TEXT,
    note          TEXT,
    last_updated  TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (event_date, title)
);
ALTER TABLE market_events ADD COLUMN IF NOT EXISTS window_start DATE;
ALTER TABLE market_events ADD COLUMN IF NOT EXISTS volatility   TEXT;
CREATE INDEX IF NOT EXISTS idx_market_events_date ON market_events(event_date);
ALTER TABLE market_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='market_events' AND policyname='Allow public read') THEN
    CREATE POLICY "Allow public read" ON market_events FOR SELECT USING (true);
  END IF;
END $$;

INSERT INTO market_events (event_date, title, category, importance, volatility, window_start, source, note, last_updated) VALUES (
  '2026-06-01', 'MSCI Semi-Annual Index Review effective', 'index_rebalance', 'high',
  'high', '2026-05-12', 'MSCI', 'May 2026 SAIR. Constituents announced 12 May; elevated volatility through the month-end rebalance.', NOW()
) ON CONFLICT (event_date, title) DO UPDATE SET
  category=EXCLUDED.category, importance=EXCLUDED.importance, volatility=EXCLUDED.volatility,
  window_start=EXCLUDED.window_start, source=EXCLUDED.source, note=EXCLUDED.note, last_updated=NOW();
INSERT INTO market_events (event_date, title, category, importance, volatility, window_start, source, note, last_updated) VALUES (
  '2026-06-22', 'FTSE GEIS Quarterly Review effective', 'index_rebalance', 'high',
  'high', '2026-06-05', 'FTSE Russell', 'Effective at open after the 19 Jun review; changes published ~2 weeks prior (approx). Vanguard FTSE EM ETF tracks this.', NOW()
) ON CONFLICT (event_date, title) DO UPDATE SET
  category=EXCLUDED.category, importance=EXCLUDED.importance, volatility=EXCLUDED.volatility,
  window_start=EXCLUDED.window_start, source=EXCLUDED.source, note=EXCLUDED.note, last_updated=NOW();
INSERT INTO market_events (event_date, title, category, importance, volatility, window_start, source, note, last_updated) VALUES (
  '2026-06-23', 'MSCI Annual Market Classification Review', 'rerating', 'high',
  'medium', NULL, 'MSCI', 'Decisions on market reclassifications / review-list changes (re-rating). Global Market Accessibility Review 18 Jun.', NOW()
) ON CONFLICT (event_date, title) DO UPDATE SET
  category=EXCLUDED.category, importance=EXCLUDED.importance, volatility=EXCLUDED.volatility,
  window_start=EXCLUDED.window_start, source=EXCLUDED.source, note=EXCLUDED.note, last_updated=NOW();
INSERT INTO market_events (event_date, title, category, importance, volatility, window_start, source, note, last_updated) VALUES (
  '2026-09-01', 'MSCI Quarterly Index Review effective', 'index_rebalance', 'high',
  'high', '2026-08-12', 'MSCI', 'Aug 2026 QIR. Constituents announced 12 Aug; elevated volatility into the effective date.', NOW()
) ON CONFLICT (event_date, title) DO UPDATE SET
  category=EXCLUDED.category, importance=EXCLUDED.importance, volatility=EXCLUDED.volatility,
  window_start=EXCLUDED.window_start, source=EXCLUDED.source, note=EXCLUDED.note, last_updated=NOW();
INSERT INTO market_events (event_date, title, category, importance, volatility, window_start, source, note, last_updated) VALUES (
  '2026-08-12', 'MSCI Quarterly Index Review – constituents announced', 'index_rebalance', 'medium',
  'medium', NULL, 'MSCI', 'Adds/deletes revealed. Opens the positioning window into the 1 Sep effective date.', NOW()
) ON CONFLICT (event_date, title) DO UPDATE SET
  category=EXCLUDED.category, importance=EXCLUDED.importance, volatility=EXCLUDED.volatility,
  window_start=EXCLUDED.window_start, source=EXCLUDED.source, note=EXCLUDED.note, last_updated=NOW();
INSERT INTO market_events (event_date, title, category, importance, volatility, window_start, source, note, last_updated) VALUES (
  '2026-09-21', 'FTSE GEIS Quarterly Review effective', 'index_rebalance', 'high',
  'high', '2026-09-04', 'FTSE Russell', 'Effective after the 18 Sep review; changes published ~2 weeks prior (approx). Vanguard FTSE EM ETF tracks this.', NOW()
) ON CONFLICT (event_date, title) DO UPDATE SET
  category=EXCLUDED.category, importance=EXCLUDED.importance, volatility=EXCLUDED.volatility,
  window_start=EXCLUDED.window_start, source=EXCLUDED.source, note=EXCLUDED.note, last_updated=NOW();
INSERT INTO market_events (event_date, title, category, importance, volatility, window_start, source, note, last_updated) VALUES (
  '2026-11-11', 'MSCI Semi-Annual Index Review – constituents announced', 'index_rebalance', 'medium',
  'medium', NULL, 'MSCI', 'Adds/deletes revealed. Opens the positioning window into the 1 Dec effective date.', NOW()
) ON CONFLICT (event_date, title) DO UPDATE SET
  category=EXCLUDED.category, importance=EXCLUDED.importance, volatility=EXCLUDED.volatility,
  window_start=EXCLUDED.window_start, source=EXCLUDED.source, note=EXCLUDED.note, last_updated=NOW();
INSERT INTO market_events (event_date, title, category, importance, volatility, window_start, source, note, last_updated) VALUES (
  '2026-12-01', 'MSCI Semi-Annual Index Review effective', 'index_rebalance', 'high',
  'high', '2026-11-11', 'MSCI', 'Nov 2026 SAIR. Constituents announced 11 Nov; elevated volatility into the effective date.', NOW()
) ON CONFLICT (event_date, title) DO UPDATE SET
  category=EXCLUDED.category, importance=EXCLUDED.importance, volatility=EXCLUDED.volatility,
  window_start=EXCLUDED.window_start, source=EXCLUDED.source, note=EXCLUDED.note, last_updated=NOW();
INSERT INTO market_events (event_date, title, category, importance, volatility, window_start, source, note, last_updated) VALUES (
  '2026-12-21', 'FTSE GEIS Quarterly Review effective', 'index_rebalance', 'high',
  'high', '2026-12-04', 'FTSE Russell', 'Effective after the 18 Dec review; changes published ~2 weeks prior (approx). Vanguard FTSE EM ETF tracks this.', NOW()
) ON CONFLICT (event_date, title) DO UPDATE SET
  category=EXCLUDED.category, importance=EXCLUDED.importance, volatility=EXCLUDED.volatility,
  window_start=EXCLUDED.window_start, source=EXCLUDED.source, note=EXCLUDED.note, last_updated=NOW();
INSERT INTO market_events (event_date, title, category, importance, volatility, window_start, source, note, last_updated) VALUES (
  '2026-06-18', 'BI Rate decision (RDG)', 'monetary', 'high',
  NULL, NULL, 'Bank Indonesia', 'RDG 17–18 Jun. BI-Rate announced on day two.', NOW()
) ON CONFLICT (event_date, title) DO UPDATE SET
  category=EXCLUDED.category, importance=EXCLUDED.importance, volatility=EXCLUDED.volatility,
  window_start=EXCLUDED.window_start, source=EXCLUDED.source, note=EXCLUDED.note, last_updated=NOW();
INSERT INTO market_events (event_date, title, category, importance, volatility, window_start, source, note, last_updated) VALUES (
  '2026-07-22', 'BI Rate decision (RDG)', 'monetary', 'high',
  NULL, NULL, 'Bank Indonesia', 'RDG 21–22 Jul.', NOW()
) ON CONFLICT (event_date, title) DO UPDATE SET
  category=EXCLUDED.category, importance=EXCLUDED.importance, volatility=EXCLUDED.volatility,
  window_start=EXCLUDED.window_start, source=EXCLUDED.source, note=EXCLUDED.note, last_updated=NOW();
INSERT INTO market_events (event_date, title, category, importance, volatility, window_start, source, note, last_updated) VALUES (
  '2026-08-19', 'BI Rate decision (RDG)', 'monetary', 'high',
  NULL, NULL, 'Bank Indonesia', 'RDG 18–19 Aug.', NOW()
) ON CONFLICT (event_date, title) DO UPDATE SET
  category=EXCLUDED.category, importance=EXCLUDED.importance, volatility=EXCLUDED.volatility,
  window_start=EXCLUDED.window_start, source=EXCLUDED.source, note=EXCLUDED.note, last_updated=NOW();
INSERT INTO market_events (event_date, title, category, importance, volatility, window_start, source, note, last_updated) VALUES (
  '2026-09-23', 'BI Rate decision (RDG)', 'monetary', 'high',
  NULL, NULL, 'Bank Indonesia', 'RDG 22–23 Sep.', NOW()
) ON CONFLICT (event_date, title) DO UPDATE SET
  category=EXCLUDED.category, importance=EXCLUDED.importance, volatility=EXCLUDED.volatility,
  window_start=EXCLUDED.window_start, source=EXCLUDED.source, note=EXCLUDED.note, last_updated=NOW();
INSERT INTO market_events (event_date, title, category, importance, volatility, window_start, source, note, last_updated) VALUES (
  '2026-10-21', 'BI Rate decision (RDG)', 'monetary', 'high',
  NULL, NULL, 'Bank Indonesia', 'RDG 20–21 Oct.', NOW()
) ON CONFLICT (event_date, title) DO UPDATE SET
  category=EXCLUDED.category, importance=EXCLUDED.importance, volatility=EXCLUDED.volatility,
  window_start=EXCLUDED.window_start, source=EXCLUDED.source, note=EXCLUDED.note, last_updated=NOW();
INSERT INTO market_events (event_date, title, category, importance, volatility, window_start, source, note, last_updated) VALUES (
  '2026-11-18', 'BI Rate decision (RDG)', 'monetary', 'high',
  NULL, NULL, 'Bank Indonesia', 'RDG 17–18 Nov.', NOW()
) ON CONFLICT (event_date, title) DO UPDATE SET
  category=EXCLUDED.category, importance=EXCLUDED.importance, volatility=EXCLUDED.volatility,
  window_start=EXCLUDED.window_start, source=EXCLUDED.source, note=EXCLUDED.note, last_updated=NOW();
INSERT INTO market_events (event_date, title, category, importance, volatility, window_start, source, note, last_updated) VALUES (
  '2026-12-16', 'BI Rate decision (RDG)', 'monetary', 'high',
  NULL, NULL, 'Bank Indonesia', 'RDG 15–16 Dec.', NOW()
) ON CONFLICT (event_date, title) DO UPDATE SET
  category=EXCLUDED.category, importance=EXCLUDED.importance, volatility=EXCLUDED.volatility,
  window_start=EXCLUDED.window_start, source=EXCLUDED.source, note=EXCLUDED.note, last_updated=NOW();
INSERT INTO market_events (event_date, title, category, importance, volatility, window_start, source, note, last_updated) VALUES (
  '2026-06-17', 'Fed FOMC decision', 'global', 'high',
  NULL, NULL, 'Federal Reserve', 'Meeting 16–17 Jun. Statement 14:00 ET; sets global risk tone for EM.', NOW()
) ON CONFLICT (event_date, title) DO UPDATE SET
  category=EXCLUDED.category, importance=EXCLUDED.importance, volatility=EXCLUDED.volatility,
  window_start=EXCLUDED.window_start, source=EXCLUDED.source, note=EXCLUDED.note, last_updated=NOW();
INSERT INTO market_events (event_date, title, category, importance, volatility, window_start, source, note, last_updated) VALUES (
  '2026-07-29', 'Fed FOMC decision', 'global', 'high',
  NULL, NULL, 'Federal Reserve', 'Meeting 28–29 Jul.', NOW()
) ON CONFLICT (event_date, title) DO UPDATE SET
  category=EXCLUDED.category, importance=EXCLUDED.importance, volatility=EXCLUDED.volatility,
  window_start=EXCLUDED.window_start, source=EXCLUDED.source, note=EXCLUDED.note, last_updated=NOW();
INSERT INTO market_events (event_date, title, category, importance, volatility, window_start, source, note, last_updated) VALUES (
  '2026-09-16', 'Fed FOMC decision', 'global', 'high',
  NULL, NULL, 'Federal Reserve', 'Meeting 15–16 Sep. Includes updated dot plot / projections.', NOW()
) ON CONFLICT (event_date, title) DO UPDATE SET
  category=EXCLUDED.category, importance=EXCLUDED.importance, volatility=EXCLUDED.volatility,
  window_start=EXCLUDED.window_start, source=EXCLUDED.source, note=EXCLUDED.note, last_updated=NOW();
INSERT INTO market_events (event_date, title, category, importance, volatility, window_start, source, note, last_updated) VALUES (
  '2026-10-28', 'Fed FOMC decision', 'global', 'high',
  NULL, NULL, 'Federal Reserve', 'Meeting 27–28 Oct.', NOW()
) ON CONFLICT (event_date, title) DO UPDATE SET
  category=EXCLUDED.category, importance=EXCLUDED.importance, volatility=EXCLUDED.volatility,
  window_start=EXCLUDED.window_start, source=EXCLUDED.source, note=EXCLUDED.note, last_updated=NOW();
INSERT INTO market_events (event_date, title, category, importance, volatility, window_start, source, note, last_updated) VALUES (
  '2026-12-09', 'Fed FOMC decision', 'global', 'high',
  NULL, NULL, 'Federal Reserve', 'Meeting 8–9 Dec. Includes updated dot plot / projections.', NOW()
) ON CONFLICT (event_date, title) DO UPDATE SET
  category=EXCLUDED.category, importance=EXCLUDED.importance, volatility=EXCLUDED.volatility,
  window_start=EXCLUDED.window_start, source=EXCLUDED.source, note=EXCLUDED.note, last_updated=NOW();
INSERT INTO market_events (event_date, title, category, importance, volatility, window_start, source, note, last_updated) VALUES (
  '2026-08-05', 'Indonesia GDP Q2-2026', 'macro_release', 'high',
  NULL, NULL, 'BPS', 'BPS quarterly GDP release (~5th of the month).', NOW()
) ON CONFLICT (event_date, title) DO UPDATE SET
  category=EXCLUDED.category, importance=EXCLUDED.importance, volatility=EXCLUDED.volatility,
  window_start=EXCLUDED.window_start, source=EXCLUDED.source, note=EXCLUDED.note, last_updated=NOW();
INSERT INTO market_events (event_date, title, category, importance, volatility, window_start, source, note, last_updated) VALUES (
  '2026-11-05', 'Indonesia GDP Q3-2026', 'macro_release', 'high',
  NULL, NULL, 'BPS', 'BPS quarterly GDP release (~5th of the month).', NOW()
) ON CONFLICT (event_date, title) DO UPDATE SET
  category=EXCLUDED.category, importance=EXCLUDED.importance, volatility=EXCLUDED.volatility,
  window_start=EXCLUDED.window_start, source=EXCLUDED.source, note=EXCLUDED.note, last_updated=NOW();
INSERT INTO market_events (event_date, title, category, importance, volatility, window_start, source, note, last_updated) VALUES (
  '2026-06-01', 'Indonesia CPI / inflation (May)', 'macro_release', 'medium',
  NULL, NULL, 'BPS', 'BPS first-business-day release; exact date approximate.', NOW()
) ON CONFLICT (event_date, title) DO UPDATE SET
  category=EXCLUDED.category, importance=EXCLUDED.importance, volatility=EXCLUDED.volatility,
  window_start=EXCLUDED.window_start, source=EXCLUDED.source, note=EXCLUDED.note, last_updated=NOW();
INSERT INTO market_events (event_date, title, category, importance, volatility, window_start, source, note, last_updated) VALUES (
  '2026-07-01', 'Indonesia CPI / inflation (Jun)', 'macro_release', 'medium',
  NULL, NULL, 'BPS', 'BPS first-business-day release; exact date approximate.', NOW()
) ON CONFLICT (event_date, title) DO UPDATE SET
  category=EXCLUDED.category, importance=EXCLUDED.importance, volatility=EXCLUDED.volatility,
  window_start=EXCLUDED.window_start, source=EXCLUDED.source, note=EXCLUDED.note, last_updated=NOW();
INSERT INTO market_events (event_date, title, category, importance, volatility, window_start, source, note, last_updated) VALUES (
  '2026-08-03', 'Indonesia CPI / inflation (Jul)', 'macro_release', 'medium',
  NULL, NULL, 'BPS', 'BPS first-business-day release; exact date approximate.', NOW()
) ON CONFLICT (event_date, title) DO UPDATE SET
  category=EXCLUDED.category, importance=EXCLUDED.importance, volatility=EXCLUDED.volatility,
  window_start=EXCLUDED.window_start, source=EXCLUDED.source, note=EXCLUDED.note, last_updated=NOW();
INSERT INTO market_events (event_date, title, category, importance, volatility, window_start, source, note, last_updated) VALUES (
  '2026-09-01', 'Indonesia CPI / inflation (Aug)', 'macro_release', 'medium',
  NULL, NULL, 'BPS', 'BPS first-business-day release; exact date approximate.', NOW()
) ON CONFLICT (event_date, title) DO UPDATE SET
  category=EXCLUDED.category, importance=EXCLUDED.importance, volatility=EXCLUDED.volatility,
  window_start=EXCLUDED.window_start, source=EXCLUDED.source, note=EXCLUDED.note, last_updated=NOW();
