-- v35: is_editable flag on strategies
-- Default true for user-created strategies.
-- Set to false for predefined/system strategies that guests cannot modify.

ALTER TABLE strategies
  ADD COLUMN IF NOT EXISTS is_editable BOOLEAN NOT NULL DEFAULT true;

-- Allow the app to filter/check this efficiently
CREATE INDEX IF NOT EXISTS idx_strategies_editable ON strategies (is_editable);

-- Example: mark predefined strategies as non-editable after seeding them
-- UPDATE strategies SET is_editable = false WHERE name IN ('Hyper Growth', 'Value', 'Dividend');
