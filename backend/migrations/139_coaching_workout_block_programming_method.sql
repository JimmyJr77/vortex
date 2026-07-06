-- Link workout blocks to programming methods.
-- IDEMPOTENT.

ALTER TABLE coaching.workout_block
  ADD COLUMN IF NOT EXISTS programming_method_id BIGINT REFERENCES coaching.programming_method(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS programming_method_slug TEXT,
  ADD COLUMN IF NOT EXISTS quality_standard TEXT,
  ADD COLUMN IF NOT EXISTS stop_rules_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS scoring_mode TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS station_count INTEGER,
  ADD COLUMN IF NOT EXISTS density_target TEXT,
  ADD COLUMN IF NOT EXISTS work_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS rest_seconds INTEGER;

CREATE INDEX IF NOT EXISTS idx_workout_block_programming_method ON coaching.workout_block(programming_method_id);
