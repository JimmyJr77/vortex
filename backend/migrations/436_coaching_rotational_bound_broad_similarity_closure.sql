-- Close the two name-similarity neighbors surfaced after migration 435.
-- This records movement-identity boundaries only. It creates no card, media,
-- graph, calibration, reviewer, or publication approval and no exercise level.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '436_coaching_rotational_bound_broad_similarity_closure';
  exact_broad_id CONSTANT UUID :=
    '866cff83-dc6c-4131-b6d8-e471ef92d859';
  quarter_turn_id UUID;
  half_turn_id UUID;
  protected_count INTEGER;
  completed_count INTEGER;
BEGIN
  SELECT id INTO quarter_turn_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='two-foot-quarter-turn-jump-to-stick';
  SELECT id INTO half_turn_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='180-jump-to-stick';

  IF(SELECT count(*) FROM coaching.exercise_definition_v1
     WHERE id IN(exact_broad_id,quarter_turn_id,half_turn_id)
       AND facility_id=1)<>3 THEN
    RAISE EXCEPTION '% cannot find all three identity-boundary definitions',
      migration_key;
  END IF;

  SELECT count(*) INTO completed_count
  FROM coaching.exercise_identity_resolution_v1 resolution
  WHERE resolution.survivor_definition_id=exact_broad_id
    AND resolution.resolved_definition_id IN(quarter_turn_id,half_turn_id)
    AND resolution.decision='distinct_exercises'
    AND resolution.reviewed_by IS NULL
    AND resolution.evidence_json->>'migration'=migration_key;
  IF completed_count=2 THEN RETURN; END IF;
  IF completed_count<>0 THEN
    RAISE EXCEPTION '% found partial prior identity closure',migration_key;
  END IF;

  SELECT count(*) INTO protected_count
  FROM coaching.exercise_identity_resolution_v1 resolution
  WHERE resolution.survivor_definition_id=exact_broad_id
    AND resolution.resolved_definition_id IN(quarter_turn_id,half_turn_id)
    AND(resolution.reviewed_by IS NOT NULL
      OR resolution.resolution_source='human_review');
  IF protected_count>0 THEN
    RAISE EXCEPTION '% refused to overwrite % human-reviewed decision(s)',
      migration_key,protected_count;
  END IF;

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by)
  VALUES
    (1,exact_broad_id,quarter_turn_id,'distinct_exercises',
      'Both use stationary bilateral takeoff, a 90-degree whole-body turn, bilateral landing, and a terminal stick. The rotational broad jump additionally requires purposeful forward-diagonal horizontal projection and a displaced landing target; the quarter-turn jump requires minimal horizontal displacement.',
      jsonb_build_object('migration',migration_key,
        'researchBatch','rotational-bound-broad-identity-v1',
        'leftSlug','bilateral-90-degree-rotational-broad-jump-to-stick',
        'rightSlug','two-foot-quarter-turn-jump-to-stick',
        'identityBoundary','horizontal_displaced_quarter_turn_broad_jump_vs_minimal_displacement_quarter_turn_jump',
        'sharedDimensions',jsonb_build_array('stationary_start',
          'bilateral_takeoff','90_degree_whole_body_turn','bilateral_landing',
          'terminal_stick','full_reset'),
        'changedDimensions',jsonb_build_array('purposeful_horizontal_projection',
          'diagonal_flight','displaced_landing_target','space_requirement',
          'physical_difficulty'),
        'missingIdentityFacts',FALSE,
        'decisionScope','identity_only_not_card_media_graph_calibration_or_publication_approval',
        'exerciseDifficultyModel','exercise_complexity_and_physical_difficulty_only',
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_exact_identity',NULL),
    (1,exact_broad_id,half_turn_id,'distinct_exercises',
      'The exact rotational broad jump fixes a 90-degree quarter turn and a forward-diagonal displaced landing target. The neighboring card names a 180-degree half turn and therefore finishes on a different heading even before its remaining support and displacement details are reviewed.',
      jsonb_build_object('migration',migration_key,
        'researchBatch','rotational-bound-broad-identity-v1',
        'leftSlug','bilateral-90-degree-rotational-broad-jump-to-stick',
        'rightSlug','180-jump-to-stick',
        'identityBoundary','quarter_turn_horizontal_rotational_broad_jump_vs_half_turn_jump',
        'knownChangedDimensions',jsonb_build_array('turn_angle',
          'finish_heading','projection_contract'),
        'leftTurnAngleDegrees',90,'rightTurnAngleDegrees',180,
        'missingIdentityFactsOnHalfTurnCard',TRUE,
        'decisionScope','identity_only_not_card_media_graph_calibration_or_publication_approval',
        'exerciseDifficultyModel','exercise_complexity_and_physical_difficulty_only',
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_exact_identity',NULL)
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,
    resolved_at=now();

  IF(SELECT count(*) FROM coaching.exercise_identity_resolution_v1 resolution
     WHERE resolution.survivor_definition_id=exact_broad_id
       AND resolution.resolved_definition_id IN(quarter_turn_id,half_turn_id)
       AND resolution.decision='distinct_exercises'
       AND resolution.resolution_source='deterministic_exact_identity'
       AND resolution.reviewed_by IS NULL
       AND resolution.evidence_json->>'migration'=migration_key
       AND resolution.evidence_json->>'approvalsCreated'='false')<>2 THEN
    RAISE EXCEPTION '% failed to close both similarity neighbors',migration_key;
  END IF;

  IF EXISTS(
    SELECT 1 FROM coaching.exercise_identity_resolution_v1 resolution
    WHERE resolution.survivor_definition_id=exact_broad_id
      AND resolution.resolved_definition_id IN(quarter_turn_id,half_turn_id)
      AND coaching.exercise_json_has_level_classification(
        resolution.evidence_json)
  ) THEN
    RAISE EXCEPTION '% created forbidden exercise level metadata',migration_key;
  END IF;
END $$;
