-- =============================================================================
-- schema-v38-admin-audit-log.sql
-- Admin audit log for /admin raw-data access (RBAC + compliance trail)
-- =============================================================================

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor      TEXT NOT NULL,
  action     TEXT NOT NULL,
  route      TEXT NOT NULL,
  query      JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip         TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action ON admin_audit_log (action);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

