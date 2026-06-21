-- ============================================================
-- Coaching Module: Persisted Workout Duration
-- Migration: 020_coaching_workout_minutes.sql
--
-- Stores the estimated total minutes on the workout row so it can be
-- queried/filtered (workout duration search) without recomputing from
-- blocks/items. Maintained by the API on every save.
--
-- IDEMPOTENT.
-- ============================================================

ALTER TABLE coaching.workout
  ADD COLUMN IF NOT EXISTS computed_minutes INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_coaching_workout_minutes ON coaching.workout(computed_minutes);
