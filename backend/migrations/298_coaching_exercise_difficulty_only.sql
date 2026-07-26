-- Exercise cards use multidimensional difficulty, not skill-library levels.
--
-- Keep the legacy enum columns temporarily so historical migrations and older
-- read models remain schema-compatible, but clear and constrain them to NULL.
-- Skill level remains valid on coaching.skill and other skill-library models.

UPDATE coaching.exercise
SET skill_level = NULL
WHERE skill_level IS NOT NULL;

UPDATE coaching.exercise_scaling_profile
SET skill_level = NULL
WHERE skill_level IS NOT NULL;

UPDATE coaching.exercise_safety_profile
SET minimum_skill_level = NULL
WHERE minimum_skill_level IS NOT NULL;

DROP INDEX IF EXISTS coaching.idx_coaching_exercise_level;

ALTER TABLE coaching.exercise
  DROP CONSTRAINT IF EXISTS coaching_exercise_skill_level_deprecated_check;
ALTER TABLE coaching.exercise
  ADD CONSTRAINT coaching_exercise_skill_level_deprecated_check
  CHECK (skill_level IS NULL);

ALTER TABLE coaching.exercise_scaling_profile
  DROP CONSTRAINT IF EXISTS coaching_exercise_scaling_skill_level_deprecated_check;
ALTER TABLE coaching.exercise_scaling_profile
  ADD CONSTRAINT coaching_exercise_scaling_skill_level_deprecated_check
  CHECK (skill_level IS NULL);

ALTER TABLE coaching.exercise_safety_profile
  DROP CONSTRAINT IF EXISTS coaching_exercise_safety_skill_level_deprecated_check;
ALTER TABLE coaching.exercise_safety_profile
  ADD CONSTRAINT coaching_exercise_safety_skill_level_deprecated_check
  CHECK (minimum_skill_level IS NULL);

COMMENT ON COLUMN coaching.exercise.skill_level IS
  'Deprecated compatibility column. Exercise selection uses coaching.exercise_difficulty_profile; skill levels belong to coaching.skill.';
COMMENT ON COLUMN coaching.exercise_scaling_profile.skill_level IS
  'Deprecated compatibility column. Use cohort, training age, and difficulty-specific scaling guidance.';
COMMENT ON COLUMN coaching.exercise_safety_profile.minimum_skill_level IS
  'Deprecated compatibility column. Use readiness checks, supervision, age guidance, and difficulty/risk profiles.';
