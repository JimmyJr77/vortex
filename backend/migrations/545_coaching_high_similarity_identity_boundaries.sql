-- Close only deterministic high-similarity false positives. These records
-- preserve distinct cards and create no media, calibration, or publication approval.
DO $migration$
DECLARE
  migration_key CONSTANT TEXT := '545_coaching_high_similarity_identity_boundaries';
  ankle_definition UUID;
  hip_definition UUID;
  neck_definition UUID;
  shot_put_definition UUID;
  slam_definition UUID;
  protected_count INTEGER;
BEGIN
  SELECT id INTO ankle_definition FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='ankle-cars' AND status='review';
  SELECT id INTO hip_definition FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='hip-cars' AND status='review';
  SELECT id INTO neck_definition FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='neck-cars' AND status='review';
  SELECT id INTO shot_put_definition FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='medicine-ball-shot-put-throw' AND status='review';
  SELECT id INTO slam_definition FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug='slam-ball-rotational-slam' AND status='review';

  IF ankle_definition IS NULL OR hip_definition IS NULL OR neck_definition IS NULL
    OR shot_put_definition IS NULL OR slam_definition IS NULL THEN
    RAISE EXCEPTION '% requires the five exact active definitions', migration_key;
  END IF;

  SELECT coalesce(sum(n),0) INTO protected_count FROM (
    SELECT count(*) n FROM coaching.exercise_identity_resolution_v1
    WHERE ((survivor_definition_id=hip_definition AND resolved_definition_id IN(ankle_definition,neck_definition))
       OR (survivor_definition_id=shot_put_definition AND resolved_definition_id=slam_definition))
      AND (reviewed_by IS NOT NULL OR resolution_source='human_review')
  ) protected;
  IF protected_count<>0 THEN
    RAISE EXCEPTION '% refuses to overwrite % human-reviewed identity decisions',migration_key,protected_count;
  END IF;

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,rationale,
    evidence_json,resolution_source,reviewed_by,resolved_at)
  SELECT 1,i.left_definition,i.right_definition,'distinct_exercises',i.rationale,
    jsonb_build_object('migration',migration_key,'identityBoundary',i.boundary,
      'leftContract',i.left_contract,'rightContract',i.right_contract,
      'automaticSubstitution',FALSE,'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'deterministic_identity_equivalence',NULL,now()
  FROM (VALUES
    (hip_definition,ankle_definition,'hip_car_vs_ankle_car',
      'Hip CARs are a unilateral hip circumduction with a standing-supported or quadruped base and quiet pelvis/spine. Ankle CARs are a seated thigh-supported foot-and-ankle circuit. The target joint complex, support, actions, laterality, coaching observation, and stop conditions differ.',
      'slow_active_unilateral_hip_circle_with_assigned_base_and_quiet_pelvis_spine',
      'seated_thigh_supported_active_ankle_joint_complex_circuit_each_direction_counted_separately'),
    (hip_definition,neck_definition,'hip_car_vs_cervical_car',
      'Hip CARs move one hip through a controlled circle while managing pelvis and trunk. Neck CARs use a composite cervical path with a different target region, base, movement path, safety observation, and stop rules.',
      'slow_active_unilateral_hip_circle_with_assigned_base_and_quiet_pelvis_spine',
      'controlled_composite_cervical_path_in_both_directions_with_organized_torso'),
    (shot_put_definition,slam_definition,'unilateral_shot_put_throw_vs_rotational_floor_slam',
      'Medicine-Ball Shot-Put Throw is a unilateral shoulder-level ballistic release toward a declared target or lane. Rotational Ball Slam is an overhead-to-floor slam with a floor release zone and retrieval. Implement behavior, release trajectory, terminal action, rebound/retrieval exposure, and station controls differ.',
      'side_on_unilateral_shoulder_level_medicine_ball_shot_put_release_with_declared_target',
      'overhead_to_side_directed_rotational_slam_ball_floor_release_and_safe_retrieval')
  ) i(left_definition,right_definition,boundary,rationale,left_contract,right_contract)
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,resolved_at=EXCLUDED.resolved_at;

  IF (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE ((survivor_definition_id=hip_definition AND resolved_definition_id IN(ankle_definition,neck_definition))
         OR (survivor_definition_id=shot_put_definition AND resolved_definition_id=slam_definition))
        AND decision='distinct_exercises' AND resolution_source='deterministic_identity_equivalence'
        AND reviewed_by IS NULL)<>3 THEN
    RAISE EXCEPTION '% identity-boundary assertions failed',migration_key;
  END IF;
END
$migration$;
