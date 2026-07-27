-- Finish the exercise-card/skill-library boundary by removing neutral
-- skill/proficiency audit markers from identity-resolution evidence. Identity
-- evidence is part of the exercise-card governance surface, so it must not
-- carry a level classification even when the stored value says that levels
-- are disallowed. Dedicated coaching.skill level assignments are preserved.
--
-- This migration changes evidence JSON only. It refuses any non-neutral level
-- value and verifies that identity decisions, rationale, provenance, reviewer
-- state, and timestamps are unchanged. IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '374_coaching_exercise_identity_proficiency_metadata_guard';
  non_neutral_records INTEGER;
  skill_library_levels_before INTEGER;
  skill_library_levels_after INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO skill_library_levels_before
  FROM coaching.skill
  WHERE skill_level IS NOT NULL;

  SELECT COUNT(*)
  INTO non_neutral_records
  FROM coaching.exercise_identity_resolution_v1
  WHERE coaching.exercise_json_has_non_neutral_level_classification(
    evidence_json
  );

  IF non_neutral_records > 0 THEN
    RAISE EXCEPTION
      '% refused to remove non-neutral level classifications from % identity evidence record(s)',
      migration_key,
      non_neutral_records;
  END IF;

  CREATE TEMP TABLE
    exercise_identity_proficiency_guard_snapshot
  ON COMMIT DROP
  AS
  SELECT
    id,
    facility_id,
    survivor_definition_id,
    resolved_definition_id,
    decision,
    rationale,
    resolution_source,
    reviewed_by,
    resolved_at
  FROM coaching.exercise_identity_resolution_v1
  WHERE coaching.exercise_json_has_level_classification(evidence_json);

  UPDATE coaching.exercise_identity_resolution_v1
  SET evidence_json =
        coaching.strip_exercise_level_classification(evidence_json)
  WHERE coaching.exercise_json_has_level_classification(evidence_json);

  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_identity_resolution_v1
    WHERE coaching.exercise_json_has_level_classification(evidence_json)
  ) THEN
    RAISE EXCEPTION
      '% left level classifications in exercise identity evidence',
      migration_key;
  END IF;

  IF EXISTS (
    SELECT
      id,
      facility_id,
      survivor_definition_id,
      resolved_definition_id,
      decision,
      rationale,
      resolution_source,
      reviewed_by,
      resolved_at
    FROM exercise_identity_proficiency_guard_snapshot
    EXCEPT
    SELECT
      id,
      facility_id,
      survivor_definition_id,
      resolved_definition_id,
      decision,
      rationale,
      resolution_source,
      reviewed_by,
      resolved_at
    FROM coaching.exercise_identity_resolution_v1
  ) THEN
    RAISE EXCEPTION
      '% changed identity resolution state while cleaning evidence',
      migration_key;
  END IF;

  SELECT COUNT(*)
  INTO skill_library_levels_after
  FROM coaching.skill
  WHERE skill_level IS NOT NULL;

  IF skill_library_levels_after <> skill_library_levels_before THEN
    RAISE EXCEPTION
      '% changed dedicated skill-library level assignments (% -> %)',
      migration_key,
      skill_library_levels_before,
      skill_library_levels_after;
  END IF;
END;
$$;

ALTER TABLE coaching.exercise_identity_resolution_v1
  DROP CONSTRAINT IF EXISTS
    exercise_identity_resolution_no_level_classification_check;
ALTER TABLE coaching.exercise_identity_resolution_v1
  ADD CONSTRAINT
    exercise_identity_resolution_no_level_classification_check
  CHECK (
    NOT coaching.exercise_json_has_level_classification(evidence_json)
  );

COMMENT ON CONSTRAINT
  exercise_identity_resolution_no_level_classification_check
  ON coaching.exercise_identity_resolution_v1 IS
  'Exercise identity evidence cannot carry skill/proficiency levels; those classifications belong only to coaching.skill cards.';
