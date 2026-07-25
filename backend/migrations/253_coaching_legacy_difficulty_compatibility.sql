-- Compatibility for authored exercise-library migrations 206-213.
-- The canonical score model no longer reads `complexity`, but those historical
-- seed migrations still populate it. Retaining the authored value allows the
-- one-time migrations to complete without changing current score consumers.

ALTER TABLE coaching.exercise_difficulty_profile
  ADD COLUMN IF NOT EXISTS complexity SMALLINT;

COMMENT ON COLUMN coaching.exercise_difficulty_profile.complexity IS
  'Legacy authored complexity score retained for migrations 206-213; canonical consumers use current score fields.';
