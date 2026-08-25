-- Follow-up to migration 555: the definition table also carried a one-to-one
-- legacy-source uniqueness constraint. Keep canonical slug uniqueness and the
-- primary key, but permit multiple review-only exact definitions to retain the
-- same conflated legacy source in their provenance and source links.
DO $migration$
BEGIN
  ALTER TABLE coaching.exercise_definition_v1
    DROP CONSTRAINT IF EXISTS exercise_definition_v1_legacy_exercise_id_key;
  CREATE INDEX IF NOT EXISTS exercise_definition_v1_legacy_exercise_id_idx
    ON coaching.exercise_definition_v1(legacy_exercise_id);
END
$migration$;
