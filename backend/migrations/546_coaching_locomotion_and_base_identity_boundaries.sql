-- Deterministic boundaries for cards sharing broad movement-language tokens.
-- No approval is created and neither card is altered.
DO $migration$
DECLARE
  migration_key CONSTANT TEXT := '546_coaching_locomotion_and_base_identity_boundaries';
  rotational_throw_definition UUID;
  band_walk_definition UUID;
  bird_dog_definition UUID;
  dead_bug_definition UUID;
BEGIN
  SELECT id INTO rotational_throw_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND slug='medicine-ball-rotational-throw' AND status='review';
  SELECT id INTO band_walk_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND slug='mini-band-lateral-walk' AND status='review';
  SELECT id INTO bird_dog_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND slug='bird-dog' AND status='review';
  SELECT id INTO dead_bug_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND slug='dead-bug' AND status='review';
  IF rotational_throw_definition IS NULL OR band_walk_definition IS NULL OR bird_dog_definition IS NULL OR dead_bug_definition IS NULL THEN
    RAISE EXCEPTION '% requires four active exact definitions',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1
    WHERE ((survivor_definition_id=rotational_throw_definition AND resolved_definition_id=band_walk_definition)
        OR (survivor_definition_id=bird_dog_definition AND resolved_definition_id=dead_bug_definition))
      AND (reviewed_by IS NOT NULL OR resolution_source='human_review')) THEN
    RAISE EXCEPTION '% refuses to overwrite a human-reviewed identity decision',migration_key;
  END IF;
  INSERT INTO coaching.exercise_identity_resolution_v1(facility_id,survivor_definition_id,resolved_definition_id,decision,rationale,evidence_json,resolution_source,reviewed_by,resolved_at)
  SELECT 1,left_id,right_id,'distinct_exercises',rationale,
    jsonb_build_object('migration',migration_key,'identityBoundary',boundary,
      'leftContract',left_contract,'rightContract',right_contract,'automaticSubstitution',FALSE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'deterministic_identity_equivalence',NULL,now()
  FROM (VALUES
    (rotational_throw_definition,band_walk_definition,'rotational_ball_release_vs_loop_band_lateral_travel',
      'Medicine Ball Rotational Throw has a ballistic ball release, declared target or lane, and throw/retrieval controls. Mini-Band Lateral Walk has continuous loop-band resistance, repeated lateral lead-step/follow travel, and direction reversal. Implement, action, terminal event, station, loading, and risk controls differ.',
      'rotational_medicine_ball_throw_with_ballistic_release_and_declared_target',
      'continuous_loop_band_above_knees_repeated_lateral_lead_step_and_follow_with_reversal'),
    (bird_dog_definition,dead_bug_definition,'quadruped_contralateral_reach_vs_supine_arms_fixed_heel_tap',
      'Bird Dog is a quadruped hand-and-knee supported contralateral arm-and-leg reach-return. Dead Bug is a supine tabletop, arms-fixed alternating bent-leg heel contact and return. Base, support contacts, limb actions, repetition boundary, logistics, and stop rules differ.',
      'quadruped_hand_knee_supported_alternating_contralateral_arm_leg_reach_and_controlled_return',
      'supine_tabletop_arms_vertical_fixed_alternating_bent_leg_light_heel_contact_and_controlled_return')
  ) i(left_id,right_id,boundary,rationale,left_contract,right_contract)
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,evidence_json=EXCLUDED.evidence_json,resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,resolved_at=EXCLUDED.resolved_at;
  IF (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
    WHERE ((survivor_definition_id=rotational_throw_definition AND resolved_definition_id=band_walk_definition)
        OR (survivor_definition_id=bird_dog_definition AND resolved_definition_id=dead_bug_definition))
      AND decision='distinct_exercises' AND resolution_source='deterministic_identity_equivalence' AND reviewed_by IS NULL)<>2 THEN
    RAISE EXCEPTION '% identity-boundary assertions failed',migration_key;
  END IF;
END
$migration$;
