-- Restore the complete exercise difficulty profile expected by authored cards.
-- IDEMPOTENT. Older databases can have this table without the complexity column
-- because CREATE TABLE IF NOT EXISTS in migration 202 could not evolve it.

ALTER TABLE coaching.exercise_difficulty_profile
  ADD COLUMN IF NOT EXISTS complexity SMALLINT;

UPDATE coaching.exercise_difficulty_profile
SET complexity = overall
WHERE complexity IS NULL;

ALTER TABLE coaching.exercise_difficulty_profile
  ALTER COLUMN complexity SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'coaching.exercise_difficulty_profile'::regclass
      AND conname = 'exercise_difficulty_profile_complexity_check'
  ) THEN
    ALTER TABLE coaching.exercise_difficulty_profile
      ADD CONSTRAINT exercise_difficulty_profile_complexity_check
      CHECK (complexity BETWEEN 1 AND 10);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_exercise_difficulty_complexity
  ON coaching.exercise_difficulty_profile(complexity);
