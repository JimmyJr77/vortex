-- Close the final two unclassified score-72-or-higher similarity pairs.
--
-- Box Squat and Split Squat have an authored bilateral box-support versus
-- stationary split-stance boundary. Landmine Squat-to-Press cannot be safely
-- compared with the unresolved One-Arm Landmine Arc Press source, so that pair
-- is explicitly quarantined rather than guessed.
--
-- These records are identity governance only. They create no card, media,
-- relationship, calibration, reviewer, or publication approval and add no
-- athlete proficiency classification to exercise records.
-- IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '406_coaching_remaining_unclassified_identity_queue_closure';
  left_id UUID;
  right_id UUID;
  conflicting_count INTEGER;
  persisted_count INTEGER;
BEGIN
  SELECT id INTO left_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id = 1
    AND slug = 'box-squat'
    AND status <> 'archived';

  SELECT id INTO right_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id = 1
    AND slug = 'split-squat'
    AND status <> 'archived';

  IF left_id IS NULL OR right_id IS NULL THEN
    RAISE EXCEPTION '% requires active Box Squat and Split Squat definitions',
      migration_key;
  END IF;

  SELECT count(*) INTO conflicting_count
  FROM coaching.exercise_identity_resolution_v1 resolution
  WHERE resolution.facility_id = 1
    AND resolution.survivor_definition_id IN (left_id, right_id)
    AND resolution.resolved_definition_id IN (left_id, right_id)
    AND NOT (
      resolution.decision = 'distinct_exercises'
      AND resolution.resolution_source = 'deterministic_identity_equivalence'
      AND resolution.reviewed_by IS NULL
      AND resolution.evidence_json->>'migration' = migration_key
    );

  IF conflicting_count > 0 THEN
    RAISE EXCEPTION '% refused to overwrite the Box Squat / Split Squat decision',
      migration_key;
  END IF;

  INSERT INTO coaching.exercise_identity_resolution_v1 (
    facility_id,
    survivor_definition_id,
    resolved_definition_id,
    decision,
    rationale,
    evidence_json,
    resolution_source,
    reviewed_by,
    resolved_at
  )
  SELECT
    1,
    left_id,
    right_id,
    'distinct_exercises',
    'Box Squat uses a bilateral stance and an external box contact or target at the bottom. Split Squat uses a stationary asymmetrical fore-aft stance with declared lead- and trail-leg roles and no required box contact. Support, stance, laterality, balance, range constraint, and failure response are identity-defining differences.',
    jsonb_build_object(
      'identityBoundary','bilateral_box_supported_squat_vs_stationary_split_stance_squat',
      'leftContract',jsonb_build_object(
        'stance','bilateral',
        'externalSupportOrTarget','box_at_bottom'
      ),
      'rightContract',jsonb_build_object(
        'stance','stationary_fore_aft_split',
        'laterality','declared_lead_and_trail_leg',
        'externalSupportOrTarget','none_required'
      ),
      'changedDimensions',jsonb_build_array(
        'stance','support','laterality','balance','range_constraint','failure_response'
      ),
      'evidenceSource','current_authored_candidate_card_contracts',
      'decisionScope','identity_only_not_card_media_graph_calibration_or_publication_approval',
      'approvalsCreated',FALSE,
      'exerciseDifficultyModel','exercise_complexity_and_physical_difficulty_only',
      'migration',migration_key
    ),
    'deterministic_identity_equivalence',
    NULL,
    now()
  WHERE NOT EXISTS (
    SELECT 1
    FROM coaching.exercise_identity_resolution_v1 resolution
    WHERE resolution.facility_id = 1
      AND resolution.survivor_definition_id IN (left_id, right_id)
      AND resolution.resolved_definition_id IN (left_id, right_id)
  );

  SELECT id INTO left_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id = 1
    AND slug = 'landmine-squat-to-press'
    AND status <> 'archived';

  SELECT id INTO right_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id = 1
    AND slug = 'one-arm-landmine-arc-press'
    AND status <> 'archived';

  IF left_id IS NULL OR right_id IS NULL THEN
    RAISE EXCEPTION '% requires active Squat-to-Press and Arc Press definitions',
      migration_key;
  END IF;

  SELECT count(*) INTO conflicting_count
  FROM coaching.exercise_identity_resolution_v1 resolution
  WHERE resolution.facility_id = 1
    AND resolution.survivor_definition_id IN (left_id, right_id)
    AND resolution.resolved_definition_id IN (left_id, right_id)
    AND NOT (
      resolution.decision = 'needs_human_review'
      AND resolution.resolution_source = 'deterministic_identity_equivalence'
      AND resolution.reviewed_by IS NULL
      AND resolution.evidence_json->>'migration' = migration_key
    );

  IF conflicting_count > 0 THEN
    RAISE EXCEPTION '% refused to overwrite the Squat-to-Press / Arc Press decision',
      migration_key;
  END IF;

  INSERT INTO coaching.exercise_identity_resolution_v1 (
    facility_id,
    survivor_definition_id,
    resolved_definition_id,
    decision,
    rationale,
    evidence_json,
    resolution_source,
    reviewed_by,
    resolved_at
  )
  SELECT
    1,
    left_id,
    right_id,
    'needs_human_review',
    'Landmine Squat-to-Press has an authored full-squat-then-press contract, but One-Arm Landmine Arc Press remains nonselectable because public usages conflict on support position, stance, path, and action. The comparison cannot be classified as duplicate or distinct until the Arc Press source identity is established.',
    jsonb_build_object(
      'identityBoundary','authored_squat_to_press_vs_unresolved_arc_press_source',
      'leftContract','full_squat_followed_by_angled_press',
      'rightContract','unresolved_support_stance_path_and_action',
      'missingDimensions',jsonb_build_array(
        'arc_press_support_position',
        'arc_press_stance',
        'arc_press_path',
        'arc_press_primary_action',
        'arc_press_repetition_boundary'
      ),
      'evidenceSource','current_authored_candidate_card_contracts',
      'decisionScope','identity_quarantine_not_card_media_graph_calibration_or_publication_approval',
      'publicationQuarantined',TRUE,
      'approvalsCreated',FALSE,
      'exerciseDifficultyModel','exercise_complexity_and_physical_difficulty_only',
      'migration',migration_key
    ),
    'deterministic_identity_equivalence',
    NULL,
    now()
  WHERE NOT EXISTS (
    SELECT 1
    FROM coaching.exercise_identity_resolution_v1 resolution
    WHERE resolution.facility_id = 1
      AND resolution.survivor_definition_id IN (left_id, right_id)
      AND resolution.resolved_definition_id IN (left_id, right_id)
  );

  SELECT count(*) INTO persisted_count
  FROM coaching.exercise_identity_resolution_v1 resolution
  WHERE resolution.facility_id = 1
    AND resolution.resolution_source = 'deterministic_identity_equivalence'
    AND resolution.reviewed_by IS NULL
    AND resolution.evidence_json->>'migration' = migration_key
    AND resolution.evidence_json->>'approvalsCreated' = 'false';

  IF persisted_count <> 2 THEN
    RAISE EXCEPTION '% expected 2 persisted closure decisions; found %',
      migration_key, persisted_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM coaching.exercise_identity_resolution_v1 resolution
    WHERE resolution.evidence_json->>'migration' = migration_key
      AND resolution.decision = 'distinct_exercises'
      AND resolution.evidence_json->>'identityBoundary' =
        'bilateral_box_supported_squat_vs_stationary_split_stance_squat'
  ) OR NOT EXISTS (
    SELECT 1
    FROM coaching.exercise_identity_resolution_v1 resolution
    WHERE resolution.evidence_json->>'migration' = migration_key
      AND resolution.decision = 'needs_human_review'
      AND resolution.evidence_json->>'identityBoundary' =
        'authored_squat_to_press_vs_unresolved_arc_press_source'
  ) THEN
    RAISE EXCEPTION '% did not retain the intended distinct and quarantine states',
      migration_key;
  END IF;
END
$$;
