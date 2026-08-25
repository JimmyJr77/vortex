-- Source 69 maps to the canonical A-March definition but arrived without a
-- source-specific variant row. Add an archived skeleton before candidate
-- materialization so consolidated source-878/924 lineage is never repurposed.
DO $a_march_source_69_lineage_skeleton$
DECLARE
  migration_key CONSTANT TEXT := '714_coaching_a_march_source_69_lineage_skeleton';
  definition_id_value UUID;
BEGIN
  SELECT d.id INTO definition_id_value
  FROM coaching.exercise_definition_v1 d
  JOIN coaching.exercise_definition_source_v1 source
    ON source.definition_id=d.id AND source.legacy_exercise_id=69
  WHERE d.facility_id=1 AND d.slug='a-march';
  IF definition_id_value IS NULL THEN
    RAISE EXCEPTION '% requires source 69 mapped to the canonical A-March definition', migration_key;
  END IF;
  IF EXISTS (
    SELECT 1 FROM coaching.exercise_variant_v1
    WHERE definition_id=definition_id_value
      AND variant_key='legacy-source-69-baseline'
      AND status<>'archived'
  ) THEN
    RAISE EXCEPTION '% refuses to overwrite an active source-69 variant', migration_key;
  END IF;
  INSERT INTO coaching.exercise_variant_v1 (
    id,definition_id,variant_key,display_name,modifier_keys,difficulty_json,
    requirements_json,status,load_profile_json,fatigue_profile_json,
    programming_profile_json,created_at,updated_at
  ) VALUES (
    '69000000-0000-4000-8000-000000000001',definition_id_value,
    'legacy-source-69-baseline','A-March Legacy Skeleton — Source 69','{}'::TEXT[],
    '{}'::JSONB,
    jsonb_build_object(
      'selectable',FALSE,
      'representation','legacy_source_skeleton',
      'sourceLegacyExerciseId',69,
      'archiveReason','Source 69 predates the exact no-flight cycle, support, anatomy, dose, fatigue, alternate, and review contract.',
      'humanReviewRequired',TRUE,
      'approvalsCreated',FALSE
    ),
    'archived','{}'::JSONB,'{}'::JSONB,
    jsonb_build_object('selectionStatus','legacy_source_skeleton','selectable',FALSE,'publicationQuarantined',TRUE),
    now(),now()
  )
  ON CONFLICT (id) DO UPDATE SET
    definition_id=EXCLUDED.definition_id,
    variant_key=EXCLUDED.variant_key,
    display_name=EXCLUDED.display_name,
    modifier_keys='{}'::TEXT[],
    difficulty_json='{}'::JSONB,
    requirements_json=EXCLUDED.requirements_json,
    status='archived',
    load_profile_json='{}'::JSONB,
    fatigue_profile_json='{}'::JSONB,
    programming_profile_json=EXCLUDED.programming_profile_json,
    updated_at=now()
  WHERE coaching.exercise_variant_v1.status='archived';
  IF NOT EXISTS (
    SELECT 1 FROM coaching.exercise_variant_v1
    WHERE id='69000000-0000-4000-8000-000000000001'
      AND definition_id=definition_id_value
      AND variant_key='legacy-source-69-baseline'
      AND status='archived'
      AND requirements_json->>'sourceLegacyExerciseId'='69'
  ) THEN
    RAISE EXCEPTION '% failed to preserve source-69 lineage skeleton', migration_key;
  END IF;
END;
$a_march_source_69_lineage_skeleton$;
