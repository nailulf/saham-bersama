-- =============================================================================
-- schema-v39-admin-job-runs.sql
-- Tracks manual /admin "Run Job" executions of run_all.py (status + history)
-- =============================================================================

CREATE TABLE IF NOT EXISTS admin_job_runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job          TEXT NOT NULL,                 -- registry job id (e.g. 'daily')
  status       TEXT NOT NULL DEFAULT 'running', -- running | success | failed | stopped
  pid          INTEGER,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at  TIMESTAMPTZ,
  exit_code    INTEGER,
  triggered_by TEXT NOT NULL,                 -- assertAdmin subject
  log_path     TEXT
);

CREATE INDEX IF NOT EXISTS idx_admin_job_runs_started_at ON admin_job_runs (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_job_runs_job ON admin_job_runs (job, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_job_runs_status ON admin_job_runs (status);

ALTER TABLE admin_job_runs ENABLE ROW LEVEL SECURITY;
-- Access is via service-role key (admin API only); no anon policies by design.
