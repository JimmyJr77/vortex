-- Preserve the migration-404 candidate values while making the task-only
-- physical-difficulty dimension explicit for canonical consumers. Variants
-- whose identity and score were intentionally deferred remain untouched.
-- Fail closed rather than rewrite a reviewed or published family.

DO $adductor_rockback_physical_difficulty_backfill$
DECLARE
  protected_count INTEGER;
  invalid_count INTEGER;
BEGIN
  SELECT count(*)
  INTO protected_count
  FROM coaching.exercise_definition_v1 definition
  LEFT JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id = definition.id
  LEFT JOIN coaching.exercise_score_calibration_v1 calibration
    ON calibration.variant_id = variant.id
  WHERE definition.facility_id = 1
    AND definition.slug = 'adductor-rockback'
    AND definition.status <> 'archived'
    AND (
      definition.status <> 'review'
      OR definition.reviewed_by IS NOT NULL
      OR definition.approved_by IS NOT NULL
      OR definition.last_reviewed_at IS NOT NULL
      OR definition.approved_video_url IS NOT NULL
      OR calibration.status <> 'review'
      OR calibration.reviewed_by IS NOT NULL
      OR calibration.reviewed_at IS NOT NULL
    );

  IF protected_count > 0 THEN
    RAISE EXCEPTION
      '533_coaching_adductor_rockback_physical_difficulty_backfill refused % protected records',
      protected_count;
  END IF;

  UPDATE coaching.exercise_variant_v1 variant
  SET difficulty_json = jsonb_set(
        variant.difficulty_json,
        '{physicalDifficulty}',
        to_jsonb((variant.difficulty_json->>'absoluteLoadDemand')::INTEGER),
        TRUE
      ),
      updated_at = now()
  FROM coaching.exercise_definition_v1 definition
  WHERE variant.definition_id = definition.id
    AND definition.facility_id = 1
    AND definition.slug = 'adductor-rockback'
    AND definition.status = 'review'
    AND variant.difficulty_json ? 'technicalComplexity'
    AND variant.difficulty_json ? 'absoluteLoadDemand'
    AND NOT variant.difficulty_json ? 'physicalDifficulty';

  SELECT count(*)
  INTO invalid_count
  FROM coaching.exercise_variant_v1 variant
  JOIN coaching.exercise_definition_v1 definition
    ON definition.id = variant.definition_id
  WHERE definition.facility_id = 1
    AND definition.slug = 'adductor-rockback'
    AND definition.status = 'review'
    AND variant.difficulty_json ? 'technicalComplexity'
    AND variant.difficulty_json ? 'absoluteLoadDemand'
    AND (
      NOT variant.difficulty_json ? 'physicalDifficulty'
      OR (variant.difficulty_json->>'physicalDifficulty')::INTEGER
        <> (variant.difficulty_json->>'absoluteLoadDemand')::INTEGER
      OR (variant.difficulty_json->>'baseOverallDifficulty')::INTEGER
        <> greatest(
          (variant.difficulty_json->>'technicalComplexity')::INTEGER,
          (variant.difficulty_json->>'physicalDifficulty')::INTEGER
        )
    );

  IF invalid_count > 0 THEN
    RAISE EXCEPTION
      '533_coaching_adductor_rockback_physical_difficulty_backfill found % invalid scored variants',
      invalid_count;
  END IF;
END;
$adductor_rockback_physical_difficulty_backfill$;
