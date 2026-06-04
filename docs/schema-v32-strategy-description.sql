-- =============================================================================
-- schema-v32-strategy-description.sql
-- Adds an optional free-text description to strategies.
-- Depends on: schema-v19-strategies.sql
-- =============================================================================

ALTER TABLE strategies
  ADD COLUMN IF NOT EXISTS description TEXT;
