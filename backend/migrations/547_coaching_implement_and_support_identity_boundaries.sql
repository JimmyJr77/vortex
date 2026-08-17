-- Close deterministic similarity false positives with mutually exclusive
-- implements, bases, or release paths. No review or approval is created.
DO $migration$
DECLARE
  migration_key CONSTANT TEXT := '547_coaching_implement_and_support_identity_boundaries';
  beam_walk UUID;
  band_walk UUID;
  overhead_throw UUID;
  rotational_slam UUID;
  big_toe_press UUID;
  pallof_hold UUID;
BEGIN
  SELECT id INTO beam_walk FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND slug='balance-beam-lateral-walk' AND status='review';
  SELECT id INTO band_walk FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND slug='mini-band-lateral-walk' AND status='review';
  SELECT id INTO overhead_throw FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND slug='medicine-ball-overhead-throw' AND status='review';
  SELECT id INTO rotational_slam FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND slug='slam-ball-rotational-slam' AND status='review';
  SELECT id INTO big_toe_press FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND slug='big-toe-press-iso-hold' AND status='review';
  SELECT id INTO pallof_hold FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND slug='pallof-press-pallof-hold' AND status='review';
  IF beam_walk IS NULL OR band_walk IS NULL OR overhead_throw IS NULL OR rotational_slam IS NULL OR big_toe_press IS NULL OR pallof_hold IS NULL THEN
    RAISE EXCEPTION '% requires six active exact definitions',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1
    WHERE ((survivor_definition_id=beam_walk AND resolved_definition_id=band_walk)
        OR (survivor_definition_id=overhead_throw AND resolved_definition_id=rotational_slam)
        OR (survivor_definition_id=big_toe_press AND resolved_definition_id=pallof_hold))
      AND (reviewed_by IS NOT NULL OR resolution_source='human_review')) THEN
    RAISE EXCEPTION '% refuses to overwrite a human-reviewed identity decision',migration_key;
  END IF;
  INSERT INTO coaching.exercise_identity_resolution_v1(facility_id,survivor_definition_id,resolved_definition_id,decision,rationale,evidence_json,resolution_source,reviewed_by,resolved_at)
  SELECT 1,left_id,right_id,'distinct_exercises',rationale,
    jsonb_build_object('migration',migration_key,'identityBoundary',boundary,
      'leftContract',left_contract,'rightContract',right_contract,
      'automaticSubstitution',FALSE,'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'deterministic_identity_equivalence',NULL,now()
  FROM (VALUES
    (beam_walk,band_walk,'narrow_beam_lateral_walk_vs_loop_band_lateral_walk',
      'Balance Beam Lateral Walk is constrained lateral locomotion on a narrow elevated or marked beam with balance and fall-space controls. Mini-Band Lateral Walk uses a continuous loop band above the knees with lateral lead-step/follow travel on a level lane. Support surface, implement, exposure, station capacity, and stop conditions differ.',
      'lateral_travel_on_declared_narrow_beam_or_line_with_balance_and_exit_control',
      'continuous_loop_band_above_knees_repeated_lateral_lead_step_and_follow_on_level_lane'),
    (overhead_throw,rotational_slam,'overhead_ball_release_vs_rotational_floor_slam',
      'Forward Overhead Medicine-Ball Throw releases a ball forward from an overhead path into a declared target or landing sector. Rotational Ball Slam drives a slam ball to a floor release zone with rotational and retrieval controls. Release direction, target, implement behavior, terminal action, and station safety differ.',
      'forward_overhead_medicine_ball_ballistic_release_to_declared_target_or_sector',
      'rotational_overhead_to_floor_slam_ball_release_and_safe_retrieval'),
    (big_toe_press,pallof_hold,'foot_hallux_isometric_press_vs_anchored_anti_rotation_hold',
      'Big Toe Press Iso Hold is local foot-to-floor hallux pressure with a declared foot support and hold. Pallof Press Hold uses an external lateral anchor and upper-limb anti-rotation press position. Target joint region, equipment, contacts, loading, and observation rules differ.',
      'target_foot_hallux_press_against_floor_with_declared_isometric_hold_and_controlled_release',
      'standing_or_kneeling_anchored_lateral_anti_rotation_press_position_isometric_hold')
  ) i(left_id,right_id,boundary,rationale,left_contract,right_contract)
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,evidence_json=EXCLUDED.evidence_json,resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,resolved_at=EXCLUDED.resolved_at;
  IF (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
    WHERE ((survivor_definition_id=beam_walk AND resolved_definition_id=band_walk)
        OR (survivor_definition_id=overhead_throw AND resolved_definition_id=rotational_slam)
        OR (survivor_definition_id=big_toe_press AND resolved_definition_id=pallof_hold))
      AND decision='distinct_exercises' AND resolution_source='deterministic_identity_equivalence' AND reviewed_by IS NULL)<>3 THEN
    RAISE EXCEPTION '% identity-boundary assertions failed',migration_key;
  END IF;
END
$migration$;
