-- Correct migration 479's Back Bridge anatomy aliases to the canonical audit
-- keys. Preserve the richer source fields and all human-review quarantine.

DO $$
DECLARE
  migration_key CONSTANT TEXT := '481_coaching_back_bridge_anatomy_contract_correction';
  prerequisite_migration CONSTANT TEXT := '480_coaching_back_bridge_score_contract_correction.sql';
  canonical_definition UUID;
BEGIN
  SELECT definition_id INTO canonical_definition
  FROM coaching.exercise_definition_source_v1
  WHERE legacy_exercise_id=16;

  IF NOT EXISTS(
      SELECT 1 FROM schema_migrations
      WHERE filename=prerequisite_migration)
    OR NOT EXISTS(
      SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition AND card_version=2 AND status='review'
        AND jsonb_typeof(anatomy_json->'primeMovers')='array'
        AND jsonb_array_length(anatomy_json->'primeMovers')>0
        AND jsonb_typeof(anatomy_json->'actions')='array'
        AND jsonb_array_length(anatomy_json->'actions')>0) THEN
    RAISE EXCEPTION '% prerequisite migration or Back Bridge anatomy is missing or drifted',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition
        AND (status IN('published','deprecated') OR reviewed_by IS NOT NULL
          OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL
          OR approved_video_url IS NOT NULL)) THEN
    RAISE EXCEPTION '% refuses to overwrite human-reviewed or published state',migration_key;
  END IF;

  UPDATE coaching.exercise_definition_v1 SET
    anatomy_json=anatomy_json||jsonb_build_object(
      'primaryMuscles',anatomy_json->'primeMovers',
      'jointActions',anatomy_json->'actions',
      'canonicalAnatomyKeyCorrection',migration_key),
    updated_at=now()
  WHERE id=canonical_definition AND status='review'
    AND reviewed_by IS NULL AND approved_by IS NULL AND last_reviewed_at IS NULL;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition AND status='review'
        AND jsonb_typeof(anatomy_json->'primaryMuscles')='array'
        AND jsonb_array_length(anatomy_json->'primaryMuscles')>=5
        AND jsonb_typeof(anatomy_json->'secondaryMuscles')='array'
        AND jsonb_array_length(anatomy_json->'secondaryMuscles')>=5
        AND jsonb_typeof(anatomy_json->'stabilizers')='array'
        AND jsonb_array_length(anatomy_json->'stabilizers')>=5
        AND jsonb_typeof(anatomy_json->'joints')='array'
        AND jsonb_array_length(anatomy_json->'joints')>=10
        AND jsonb_typeof(anatomy_json->'jointActions')='array'
        AND jsonb_array_length(anatomy_json->'jointActions')>=8
        AND jsonb_typeof(anatomy_json->'planes')='array'
        AND jsonb_array_length(anatomy_json->'planes')=3
        AND coalesce(anatomy_json->>'laterality','')<>''
        AND anatomy_json->'primaryMuscles'=anatomy_json->'primeMovers'
        AND anatomy_json->'jointActions'=anatomy_json->'actions'
        AND reviewed_by IS NULL AND approved_by IS NULL
        AND last_reviewed_at IS NULL AND approved_video_url IS NULL) THEN
    RAISE EXCEPTION '% did not restore canonical anatomy keys or preserve quarantine',migration_key;
  END IF;
END;
$$;
