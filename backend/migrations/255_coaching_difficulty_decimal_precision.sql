-- Preserve the internal 1-10 difficulty model while allowing tenths.
-- The product presents these values as 10-100, so 6.7 is displayed as 67/100.

ALTER TABLE coaching.exercise_difficulty_profile
  DROP CONSTRAINT IF EXISTS exercise_difficulty_profile_technical_check,
  DROP CONSTRAINT IF EXISTS exercise_difficulty_profile_load_check,
  DROP CONSTRAINT IF EXISTS exercise_difficulty_profile_overall_check;

ALTER TABLE coaching.exercise_difficulty_profile
  ALTER COLUMN technical TYPE numeric(3,1) USING technical::numeric(3,1),
  ALTER COLUMN load TYPE numeric(3,1) USING load::numeric(3,1),
  ALTER COLUMN overall TYPE numeric(3,1) USING overall::numeric(3,1);

ALTER TABLE coaching.exercise_difficulty_profile
  ADD CONSTRAINT exercise_difficulty_profile_technical_check
    CHECK (technical >= 1.0 AND technical <= 10.0),
  ADD CONSTRAINT exercise_difficulty_profile_load_check
    CHECK (load >= 1.0 AND load <= 10.0),
  ADD CONSTRAINT exercise_difficulty_profile_overall_check
    CHECK (overall >= 1.0 AND overall <= 10.0);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'coaching'
      AND table_name = 'exercise'
      AND column_name = 'complexity'
  ) THEN
    ALTER TABLE coaching.exercise
      DROP CONSTRAINT IF EXISTS exercise_complexity_check;

    ALTER TABLE coaching.exercise
      ALTER COLUMN complexity TYPE numeric(3,1) USING complexity::numeric(3,1);

    ALTER TABLE coaching.exercise
      ADD CONSTRAINT exercise_complexity_check
        CHECK (complexity IS NULL OR (complexity >= 1.0 AND complexity <= 10.0));
  END IF;
END
$$;
