-- Correct the controlled body-region and optional-equipment taxonomy for the
-- two exact kettlebell-swing definitions introduced by migration 472.
-- This migration does not approve content, media, relationships, calibration,
-- or publication. It is intentionally safe to re-run.
-- IDEMPOTENT.

BEGIN;

DO $$
DECLARE
  migration_key CONSTANT TEXT := '474_coaching_kettlebell_swing_taxonomy_gate_completion';
  swing_definition CONSTANT UUID := 'f0f47f37-e892-4689-99a0-16cba58a3f40';
  overhead_definition CONSTANT UUID := '5c671a58-1beb-44db-9d5b-a0951630fc6f';
  target_ids CONSTANT UUID[] := ARRAY[swing_definition, overhead_definition]::UUID[];
  target_count INTEGER;
  invalid_taxonomy_count INTEGER;
BEGIN
  SELECT count(*) INTO target_count
  FROM coaching.exercise_definition_v1
  WHERE id = ANY(target_ids)
    AND facility_id = 1;

  IF target_count <> 2 THEN
    RAISE EXCEPTION '% expected both kettlebell-swing definitions; found %',
      migration_key, target_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_definition_v1
    WHERE id = ANY(target_ids)
      AND (
        status <> 'review'
        OR reviewed_by IS NOT NULL
        OR approved_by IS NOT NULL
        OR last_reviewed_at IS NOT NULL
      )
  ) THEN
    RAISE EXCEPTION '% refused to overwrite human-reviewed or non-review kettlebell-swing cards',
      migration_key;
  END IF;

  UPDATE coaching.exercise_definition_v1
  SET body_regions = ARRAY[
        'full_body','hip','hamstrings','knee','ankle','core','shoulder',
        'elbow','wrist','hand'
      ]::TEXT[],
      optional_equipment = ARRAY['line_tape','timer']::TEXT[],
      provenance_json = provenance_json || jsonb_build_object(
        'controlledTaxonomyCorrection', jsonb_build_object(
          'migration', migration_key,
          'removedInvalidBodyRegion', 'forearm',
          'replacementBodyRegions', jsonb_build_array('elbow','wrist','hand'),
          'removedInvalidOptionalEquipment', jsonb_build_array(
            'floor_marker','video_capture'
          ),
          'replacementOptionalEquipment', jsonb_build_array('line_tape','timer'),
          'videoCaptureRemainsAWorkflowCapabilityNotControlledRequiredEquipment', TRUE,
          'approvalCreated', FALSE
        )
      ),
      updated_at = now()
  WHERE id = ANY(target_ids);

  SELECT count(*) INTO invalid_taxonomy_count
  FROM coaching.exercise_definition_v1 definition
  CROSS JOIN LATERAL unnest(
    definition.body_regions
  ) body_region_key
  WHERE definition.id = ANY(target_ids)
    AND NOT EXISTS (
      SELECT 1
      FROM coaching.body_region controlled
      WHERE controlled.key = body_region_key
    );

  SELECT invalid_taxonomy_count + count(*) INTO invalid_taxonomy_count
  FROM coaching.exercise_definition_v1 definition
  CROSS JOIN LATERAL unnest(
    definition.required_equipment || definition.optional_equipment
  ) equipment_key
  WHERE definition.id = ANY(target_ids)
    AND NOT EXISTS (
      SELECT 1
      FROM coaching.equipment controlled
      WHERE controlled.key = equipment_key
    );

  IF invalid_taxonomy_count <> 0 THEN
    RAISE EXCEPTION '% left % uncontrolled body-region or equipment keys',
      migration_key, invalid_taxonomy_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_variant_v1 variant
    WHERE variant.definition_id = ANY(target_ids)
      AND variant.status <> 'archived'
      AND (
        (variant.difficulty_json->>'baseOverallDifficulty')::INTEGER
          <> GREATEST(
            (variant.difficulty_json->>'technicalComplexity')::INTEGER,
            (variant.difficulty_json->>'absoluteLoadDemand')::INTEGER
          )
        OR variant.difficulty_json ?| ARRAY[
          'exerciseSkillLevel','skillLevel','minimumSkillLevel',
          'proficiencyLevel','exerciseCardSkillLevel'
        ]
      )
  ) THEN
    RAISE EXCEPTION '% found an invalid difficulty formula or exercise skill/proficiency field',
      migration_key;
  END IF;

  UPDATE coaching.exercise_card_test_packet_v1 packet
  SET audit_version = migration_key,
      status = 'quarantined',
      checks_json = jsonb_build_object(
        'identity', jsonb_build_object('passed', TRUE),
        'taxonomy', jsonb_build_object(
          'passed', TRUE,
          'controlledBodyRegions', TRUE,
          'controlledEquipment', TRUE,
          'correctedBy', migration_key
        ),
        'difficulty', jsonb_build_object(
          'passed', TRUE,
          'model', 'max_exercise_complexity_physical_difficulty',
          'exerciseSkillOrProficiencyFieldPresent', FALSE
        ),
        'machineContent', jsonb_build_object(
          'passed', TRUE,
          'independentCanonicalAuditRequiredAfterMigration', TRUE
        ),
        'media', jsonb_build_object(
          'passed', FALSE,
          'humanExactMatchPlaybackAccessibilityAndQualityReviewRequired', TRUE,
          'approvalCreated', FALSE
        ),
        'relationships', jsonb_build_object(
          'passed', FALSE,
          'humanReviewRequired', TRUE,
          'approvalCreated', FALSE
        ),
        'calibration', jsonb_build_object(
          'passed', FALSE,
          'independentReviewRequired', TRUE,
          'approvalCreated', FALSE
        ),
        'publication', jsonb_build_object(
          'passed', FALSE,
          'separateApprovalRequired', TRUE,
          'approvalCreated', FALSE
        )
      ),
      blocking_issues_json = jsonb_build_array(
        jsonb_build_object(
          'code','CARD-MEDIA-01','category','media',
          'message','Exact current-card playback, accessibility, safety, quality, reviewer identity, and approval remain unresolved.'
        ),
        jsonb_build_object(
          'code','CARD-GRAPH-03','category','relationships',
          'message','Progression, regression, and substitution proposals require qualified human review.'
        ),
        jsonb_build_object(
          'code','CARD-CALIBRATION-01','category','calibration',
          'message','Complexity and physical-difficulty anchors require independent calibration review.'
        ),
        jsonb_build_object(
          'code','CARD-PUBLISH-01','category','publication',
          'message','Separate content and publication approval has not occurred.'
        )
      ),
      human_review_required = TRUE,
      checked_at = now()
  FROM coaching.exercise_definition_v1 definition
  WHERE packet.definition_id = definition.id
    AND definition.id = ANY(target_ids)
    AND packet.card_version = definition.card_version;

  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_card_test_packet_v1 packet
    WHERE packet.definition_id = ANY(target_ids)
      AND (
        packet.status <> 'quarantined'
        OR packet.human_review_required IS NOT TRUE
        OR jsonb_array_length(packet.blocking_issues_json) <> 4
      )
  ) THEN
    RAISE EXCEPTION '% failed to preserve the four human-review blockers',
      migration_key;
  END IF;
END
$$;

COMMIT;
