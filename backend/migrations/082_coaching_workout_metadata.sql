-- Workout session metadata + phase-linked blocks.
-- IDEMPOTENT.

ALTER TABLE coaching.workout
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;
ALTER TABLE coaching.workout
  ADD COLUMN IF NOT EXISTS session_objective TEXT;
ALTER TABLE coaching.workout
  ADD COLUMN IF NOT EXISTS audience_json JSONB NOT NULL DEFAULT '{}';
ALTER TABLE coaching.workout
  ADD COLUMN IF NOT EXISTS format_json JSONB NOT NULL DEFAULT '{}';
ALTER TABLE coaching.workout
  ADD COLUMN IF NOT EXISTS coach_rationale_json JSONB NOT NULL DEFAULT '{}';
ALTER TABLE coaching.workout
  ADD COLUMN IF NOT EXISTS phase_plan_json JSONB NOT NULL DEFAULT '[]';
ALTER TABLE coaching.workout
  ADD COLUMN IF NOT EXISTS validation_snapshot_json JSONB NOT NULL DEFAULT '{}';
ALTER TABLE coaching.workout
  ADD COLUMN IF NOT EXISTS validation_override_reason TEXT;

ALTER TABLE coaching.workout_block
  ADD COLUMN IF NOT EXISTS phase_id BIGINT REFERENCES coaching.session_phase(id) ON DELETE SET NULL;
ALTER TABLE coaching.workout_block
  ADD COLUMN IF NOT EXISTS order_slot TEXT;
ALTER TABLE coaching.workout_block
  ADD COLUMN IF NOT EXISTS phase_order_index INTEGER;
ALTER TABLE coaching.workout_block
  ADD COLUMN IF NOT EXISTS minutes_budget INTEGER;
ALTER TABLE coaching.workout_block
  ADD COLUMN IF NOT EXISTS phase_goal TEXT;
ALTER TABLE coaching.workout_block
  ADD COLUMN IF NOT EXISTS contains_tumbling BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE coaching.workout_block
  ADD COLUMN IF NOT EXISTS add_on_focus TEXT;

CREATE INDEX IF NOT EXISTS idx_coaching_workout_block_phase ON coaching.workout_block(phase_id);
