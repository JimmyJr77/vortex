-- Correct the new rotational wall-throw family's card/profile equipment arrays
-- to controlled coaching.equipment keys. Detailed wall suitability, target,
-- ball-tracking, and video-feedback requirements remain in environment,
-- logistics, and measurement JSON rather than masquerading as equipment keys.
-- No approval, review, media, graph, calibration, publication, or exercise
-- proficiency state is created or overwritten. IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT := '321_coaching_rotational_wall_throw_equipment_taxonomy';
  target_definition_id UUID;
  protected_records INTEGER;
BEGIN
  SELECT id
  INTO target_definition_id
  FROM coaching.exercise_definition_v1
  WHERE slug = 'medicine-ball-rotational-throw'
    AND status <> 'archived';

  IF target_definition_id IS NULL THEN
    RAISE EXCEPTION
      'Rotational wall-throw equipment correction requires the active survivor definition';
  END IF;

  SELECT
    (
      SELECT COUNT(*)
      FROM coaching.exercise_definition_v1
      WHERE id = target_definition_id
        AND (
          status = 'published'
          OR reviewed_by IS NOT NULL
          OR approved_by IS NOT NULL
          OR last_reviewed_at IS NOT NULL
        )
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_section_evidence_v1
      WHERE definition_id = target_definition_id
        AND review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_media_candidate_v1
      WHERE definition_id = target_definition_id
        AND review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id = target_definition_id
        AND review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_card_review_v1
      WHERE definition_id = target_definition_id
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_card_revision_v1
      WHERE definition_id = target_definition_id
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_media_review_v1
      WHERE definition_id = target_definition_id
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_score_calibration_v1 calibration
      JOIN coaching.exercise_variant_v1 variant
        ON variant.id = calibration.variant_id
      WHERE variant.definition_id = target_definition_id
        AND (
          calibration.status <> 'review'
          OR calibration.reviewed_by IS NOT NULL
          OR calibration.reviewed_at IS NOT NULL
        )
    )
  INTO protected_records;

  IF protected_records > 0 THEN
    RAISE EXCEPTION
      'Rotational wall-throw equipment correction refused to override % protected records',
      protected_records;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    WHERE (
      SELECT COUNT(DISTINCT key)
      FROM coaching.equipment
      WHERE key IN ('medicine_ball', 'wall', 'line_tape', 'timer', 'mirror')
    ) = 5
  ) THEN
    RAISE EXCEPTION
      'Rotational wall-throw equipment correction requires controlled equipment keys medicine_ball, wall, line_tape, timer, and mirror';
  END IF;

  UPDATE coaching.exercise_definition_v1
  SET required_equipment = ARRAY['medicine_ball', 'wall']::TEXT[],
      optional_equipment = ARRAY['line_tape', 'timer', 'mirror']::TEXT[],
      provenance_json = provenance_json || jsonb_build_object(
        'equipmentTaxonomyCorrectionMigration', migration_key,
        'equipmentTaxonomyControlled', TRUE,
        'descriptiveRequirementsRemainInContextJson', TRUE,
        'humanReviewRequired', TRUE,
        'publicationQuarantined', TRUE
      ),
      updated_at = now()
  WHERE id = target_definition_id;

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET equipment_required = ARRAY['medicine_ball', 'wall']::TEXT[],
      updated_at = now()
  FROM coaching.exercise_variant_v1 variant
  WHERE variant.id = profile.variant_id
    AND variant.definition_id = target_definition_id
    AND variant.status <> 'archived'
    AND profile.status <> 'archived';

  UPDATE coaching.exercise_card_test_packet_v1
  SET status = 'quarantined',
      checks_json = checks_json || jsonb_build_object(
        'equipmentTaxonomyCorrectionMigration', migration_key,
        'controlledCardEquipment', jsonb_build_array(
          'medicine_ball',
          'wall',
          'line_tape',
          'timer',
          'mirror'
        ),
        'auditRerunRequired', TRUE
      ),
      human_review_required = TRUE,
      checked_at = now()
  WHERE definition_id = target_definition_id;
END;
$$;
