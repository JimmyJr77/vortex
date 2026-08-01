-- Close the three similarity pairs exposed when the short-acceleration start
-- sources were consolidated. Incline resistance, an ordered brake/re-accelerate
-- sequence, and a live multi-option gate decision each change the stable
-- movement contract; they are not aliases of an unresisted short acceleration.
-- This records deterministic identity boundaries only. It creates no review,
-- media, calibration, publication, or exercise-level proficiency approval.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '421_coaching_short_acceleration_identity_queue_closure';
  scope_slugs CONSTANT TEXT[] := ARRAY[
    '10-yard-sprint','hill-sprint-acceleration',
    'deceleration-re-acceleration-sprint','random-gate-acceleration'
  ];
  short_id UUID;
  hill_id UUID;
  reacceleration_id UUID;
  random_gate_id UUID;
BEGIN
  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE facility_id=1 AND slug=ANY(scope_slugs))<>cardinality(scope_slugs) THEN
    RAISE EXCEPTION '% requires all four traceable definitions',migration_key;
  END IF;

  SELECT id INTO short_id FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='10-yard-sprint';
  SELECT id INTO hill_id FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='hill-sprint-acceleration';
  SELECT id INTO reacceleration_id FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='deceleration-re-acceleration-sprint';
  SELECT id INTO random_gate_id FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='random-gate-acceleration';

  IF EXISTS(
    SELECT 1 FROM coaching.exercise_identity_resolution_v1 resolution
    WHERE ((resolution.survivor_definition_id=short_id
          AND resolution.resolved_definition_id=hill_id)
        OR (resolution.survivor_definition_id=hill_id
          AND resolution.resolved_definition_id=short_id)
        OR (resolution.survivor_definition_id=short_id
          AND resolution.resolved_definition_id=reacceleration_id)
        OR (resolution.survivor_definition_id=reacceleration_id
          AND resolution.resolved_definition_id=short_id)
        OR (resolution.survivor_definition_id=short_id
          AND resolution.resolved_definition_id=random_gate_id)
        OR (resolution.survivor_definition_id=random_gate_id
          AND resolution.resolved_definition_id=short_id))
      AND (resolution.resolution_source='human_review'
        OR resolution.reviewed_by IS NOT NULL)
  ) THEN
    RAISE EXCEPTION '% refused to override a human identity decision',migration_key;
  END IF;

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by,resolved_at)
  VALUES
    (1,short_id,hill_id,'distinct_exercises',
      'Hill Sprint Acceleration requires a measured incline that supplies external gravitational resistance and changes the environment and force-velocity contract. Short Acceleration Sprint requires a level unresisted lane. Incline is therefore an identity-bearing resistance and environment boundary, not a dosage alias.',
      jsonb_build_object(
        'identityBoundary','level_unresisted_acceleration_vs_measured_incline_resisted_acceleration',
        'shortContract',jsonb_build_array(
          'level_surface','unresisted','single_acceleration','planned_run_out'),
        'hillContract',jsonb_build_array(
          'measured_incline','gravity_resisted','single_acceleration','planned_run_out'),
        'variantDecision','retain_distinct_cards_with_future_substitution_relationship',
        'decisionScope','identity_only_not_human_approval',
        'difficultyModel','max_exercise_complexity_physical_difficulty',
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE,
        'migration',migration_key),
      'deterministic_identity_equivalence',NULL,now()),
    (1,short_id,reacceleration_id,'distinct_exercises',
      'Deceleration Re-Acceleration Sprint contains an ordered high-speed entry, braking phase, transition, and second acceleration. Short Acceleration Sprint begins from a controlled start and contains one acceleration before its terminal run-out. The required braking and second projection are stable ordered actions, not delivery modifiers.',
      jsonb_build_object(
        'identityBoundary','single_start_acceleration_vs_ordered_brake_and_reacceleration',
        'shortContract',jsonb_build_array(
          'controlled_start','single_acceleration','planned_run_out'),
        'reaccelerationContract',jsonb_build_array(
          'entry_speed','planned_braking','transition','second_acceleration'),
        'variantDecision','retain_distinct_cards_with_future_progression_or_substitution_relationship',
        'decisionScope','identity_only_not_human_approval',
        'difficultyModel','max_exercise_complexity_physical_difficulty',
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE,
        'migration',migration_key),
      'deterministic_identity_equivalence',NULL,now()),
    (1,short_id,random_gate_id,'distinct_exercises',
      'Reactive Acceleration Start requires a live unpredictable multi-option gate cue, answer selection, and direction-specific movement response. Short Acceleration Sprint may use one simple go signal, but it does not require stimulus discrimination or choice selection. Choice reaction is the stable identity boundary.',
      jsonb_build_object(
        'identityBoundary','simple_go_signal_acceleration_vs_live_multi_option_choice_reaction',
        'shortContract',jsonb_build_array(
          'controlled_start','single_go_signal_optional','predetermined_linear_target'),
        'randomGateContract',jsonb_build_array(
          'live_unpredictable_cue','multiple_possible_gates',
          'stimulus_discrimination','choice_response','direction_specific_acceleration'),
        'variantDecision','retain_distinct_cards_with_future_progression_or_substitution_relationship',
        'decisionScope','identity_only_not_human_approval',
        'difficultyModel','max_exercise_complexity_physical_difficulty',
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE,
        'migration',migration_key),
      'deterministic_identity_equivalence',NULL,now())
  ON CONFLICT(survivor_definition_id,resolved_definition_id)
  DO UPDATE SET decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,
    resolved_at=now()
  WHERE coaching.exercise_identity_resolution_v1.resolution_source<>'human_review'
    AND coaching.exercise_identity_resolution_v1.reviewed_by IS NULL;

  -- The shared values apply to all rows while preserving explicit quarantine.
  UPDATE coaching.exercise_identity_resolution_v1 resolution
  SET resolution_source='deterministic_identity_equivalence',
    reviewed_by=NULL,resolved_at=now()
  WHERE resolution.survivor_definition_id=short_id
    AND resolution.resolved_definition_id=ANY(
      ARRAY[hill_id,reacceleration_id,random_gate_id])
    AND resolution.resolution_source<>'human_review'
    AND resolution.reviewed_by IS NULL;

  IF (SELECT count(*) FROM coaching.exercise_identity_resolution_v1 resolution
      WHERE resolution.survivor_definition_id=short_id
        AND resolution.resolved_definition_id=ANY(
          ARRAY[hill_id,reacceleration_id,random_gate_id])
        AND resolution.decision='distinct_exercises'
        AND resolution.resolution_source='deterministic_identity_equivalence'
        AND resolution.reviewed_by IS NULL)<>3 THEN
    RAISE EXCEPTION '% failed to persist all three identity boundaries',migration_key;
  END IF;
END
$$;
