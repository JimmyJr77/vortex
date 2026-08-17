-- A legacy source can contain more than one task.  Retaining a one-to-one
-- uniqueness constraint forces later audits to pick a false survivor or hide
-- part of the source.  The composite primary key still prevents duplicate
-- source-to-definition links; this change permits explicit one-to-many lineage
-- only for research-reviewed candidate splits.
DO $migration$
BEGIN
  ALTER TABLE coaching.exercise_definition_source_v1
    DROP CONSTRAINT IF EXISTS exercise_definition_source_v1_legacy_exercise_id_key;
  CREATE INDEX IF NOT EXISTS exercise_definition_source_v1_legacy_exercise_id_idx
    ON coaching.exercise_definition_source_v1(legacy_exercise_id);
END
$migration$;
