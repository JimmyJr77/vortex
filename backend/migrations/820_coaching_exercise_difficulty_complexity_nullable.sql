-- Keep the legacy complexity score available to authored seed migrations without
-- requiring current exercise writers to populate a retired canonical field.
-- IDEMPOTENT.

ALTER TABLE coaching.exercise_difficulty_profile
  ALTER COLUMN complexity DROP NOT NULL;

COMMENT ON COLUMN coaching.exercise_difficulty_profile.complexity IS
  'Legacy authored complexity score retained for seed compatibility; current canonical writers may leave it null.';
