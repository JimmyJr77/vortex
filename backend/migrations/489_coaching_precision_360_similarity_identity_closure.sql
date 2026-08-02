-- Close the six name/mechanics similarity pairs surfaced when migration 487
-- added the Bilateral 360-Degree Jump to Stick definition. These are explicit
-- distinct-action boundaries, not approvals and not duplicate consolidations.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '489_coaching_precision_360_similarity_identity_closure';
  prerequisite_filename CONSTANT TEXT :=
    '487_coaching_precision_jump_identity_and_360_family_audit_hardening.sql';
  prerequisite_checksum CONSTANT TEXT := '2192026862';
  rotation_definition CONSTANT UUID :=
    '1101413d-55c7-4585-abc2-6e63484ec434';
  quarter_turn_definition CONSTANT UUID :=
    'c66bd9c5-a3f9-4afe-bdde-68c4d2904a04';
  lateral_definition CONSTANT UUID :=
    '17ba05de-abea-4b9f-b117-a4f12cfadc6f';
  tuck_definition CONSTANT UUID :=
    '8496ad9b-ef69-4d0b-8279-650d92ca3239';
  squat_definition CONSTANT UUID :=
    '91c2fab1-0fc9-4d68-88b8-75b7ba2b06c9';
  lateral_hurdle_definition CONSTANT UUID :=
    '452c5f80-c157-42f8-9882-fa83c6a38c98';
  tuck_lateral_definition CONSTANT UUID :=
    'bf4e454b-7514-44af-bcfb-698e95b906dc';
  neighbor_ids CONSTANT UUID[] := ARRAY[
    quarter_turn_definition,lateral_definition,tuck_definition,
    squat_definition,lateral_hurdle_definition,tuck_lateral_definition
  ]::UUID[];
BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM schema_migrations
    WHERE filename=prerequisite_filename
      AND checksum=prerequisite_checksum
  ) THEN
    RAISE EXCEPTION '% requires registered % at checksum %',
      migration_key,prerequisite_filename,prerequisite_checksum;
  END IF;

  IF NOT EXISTS(
      SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=rotation_definition AND facility_id=1
        AND slug='bilateral-360-degree-jump-to-stick'
        AND family_key='bilateral_360_horizontal_jump_terminal_stick'
        AND status='review' AND reviewed_by IS NULL AND approved_by IS NULL)
    OR (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=ANY(neighbor_ids) AND facility_id=1 AND status='review')<>6
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=quarter_turn_definition
        AND slug='two-foot-quarter-turn-jump-to-stick')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=lateral_definition AND slug='lateral-hop-to-stick')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=tuck_definition AND slug='tuck-jump')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=squat_definition AND slug='squat-jump')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=lateral_hurdle_definition
        AND slug='bilateral-lateral-low-hurdle-jump-to-stick')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=tuck_lateral_definition
        AND slug='tuck-jump-to-lateral-stick') THEN
    RAISE EXCEPTION '% found missing or drifted active definition contracts',
      migration_key;
  END IF;

  IF EXISTS(
    SELECT 1 FROM coaching.exercise_identity_resolution_v1 resolution
    WHERE resolution.survivor_definition_id=rotation_definition
      AND resolution.resolved_definition_id=ANY(neighbor_ids)
      AND (
        resolution.reviewed_by IS NOT NULL
        OR resolution.decision<>'distinct_exercises'
        OR resolution.resolution_source<>'deterministic_identity_equivalence'
        OR resolution.evidence_json->>'migration'<>migration_key)
  ) THEN
    RAISE EXCEPTION '% refuses to overwrite an existing or human-reviewed identity decision',
      migration_key;
  END IF;

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by,resolved_at)
  VALUES
    (1,rotation_definition,quarter_turn_definition,'distinct_exercises',
      'The 360 card requires one complete whole-body turn, declared direction, target reacquisition, final heading, and rotational braking during a forward jump. The quarter-turn card requires approximately 90 degrees of reorientation and a different spotting and landing-heading window.',
      $json${"migration":"489_coaching_precision_360_similarity_identity_closure","identityBoundary":"full_360_turn_vs_90_degree_quarter_turn","dimensions":["rotation_amount","turn_direction","projection","target_reacquisition","final_heading","braking"],"evidenceSources":["world_gymnastics_parkour_table_of_tricks_2026","current_exact_canonical_contracts"],"exerciseScoresDescribeTasksOnly":true,"humanReviewRequired":true,"approvalsCreated":false}$json$::JSONB,
      'deterministic_identity_equivalence',NULL,now()),
    (1,rotation_definition,lateral_definition,'distinct_exercises',
      'The 360 card combines forward projection with a full whole-body turn and final-heading recovery. Bilateral Lateral Jump to Stick projects laterally in the frontal plane without a required full turn or target-reacquisition action.',
      $json${"migration":"489_coaching_precision_360_similarity_identity_closure","identityBoundary":"forward_full_turn_vs_nonrotational_lateral_projection","dimensions":["projection_direction","plane","rotation_amount","target_heading","terminal_stick"],"evidenceSources":["current_exact_canonical_contracts"],"exerciseScoresDescribeTasksOnly":true,"humanReviewRequired":true,"approvalsCreated":false}$json$::JSONB,
      'deterministic_identity_equivalence',NULL,now()),
    (1,rotation_definition,tuck_definition,'distinct_exercises',
      'The 360 card scores a complete whole-body turn and target reacquisition during forward flight. Tuck Jump scores a vertical flight with a deliberate airborne hip-and-knee tuck and re-extension, without a required full turn or horizontal target.',
      $json${"migration":"489_coaching_precision_360_similarity_identity_closure","identityBoundary":"full_turn_forward_flight_vs_vertical_airborne_tuck_action","dimensions":["rotation_action","airborne_joint_action","projection_direction","target","landing_heading"],"evidenceSources":["world_gymnastics_parkour_table_of_tricks_2026","current_exact_canonical_contracts"],"exerciseScoresDescribeTasksOnly":true,"humanReviewRequired":true,"approvalsCreated":false}$json$::JSONB,
      'deterministic_identity_equivalence',NULL,now()),
    (1,rotation_definition,squat_definition,'distinct_exercises',
      'The 360 card starts from stationary bilateral support, uses a declared countermovement, projects forward, completes a full turn, reacquires the target, and sticks. Squat Jump begins from a static held squat and projects vertically without a required full turn or horizontal target.',
      $json${"migration":"489_coaching_precision_360_similarity_identity_closure","identityBoundary":"countermovement_forward_full_turn_vs_static_squat_vertical_jump","dimensions":["start_contract","countermovement","projection_direction","rotation_amount","target","final_heading"],"evidenceSources":["current_exact_canonical_contracts"],"exerciseScoresDescribeTasksOnly":true,"humanReviewRequired":true,"approvalsCreated":false}$json$::JSONB,
      'deterministic_identity_equivalence',NULL,now()),
    (1,rotation_definition,lateral_hurdle_definition,'distinct_exercises',
      'The 360 card scores a full turn and forward target landing with no obstacle-clearance requirement. Bilateral Lateral Low-Hurdle Jump to Stick scores lateral projection across a declared hurdle and a terminal landing without a required full turn.',
      $json${"migration":"489_coaching_precision_360_similarity_identity_closure","identityBoundary":"forward_full_turn_target_vs_lateral_obstacle_clearance","dimensions":["projection_direction","rotation_amount","obstacle","clearance","target_interface","landing_heading"],"evidenceSources":["current_exact_canonical_contracts"],"exerciseScoresDescribeTasksOnly":true,"humanReviewRequired":true,"approvalsCreated":false}$json$::JSONB,
      'deterministic_identity_equivalence',NULL,now()),
    (1,rotation_definition,tuck_lateral_definition,'distinct_exercises',
      'The 360 card requires a complete whole-body turn, forward travel, target reacquisition, and a declared final heading. Tuck Jump to Lateral Stick adds a deliberate airborne tuck and lateral terminal displacement without requiring a complete turn.',
      $json${"migration":"489_coaching_precision_360_similarity_identity_closure","identityBoundary":"full_turn_forward_target_vs_airborne_tuck_to_lateral_stick","dimensions":["rotation_action","airborne_joint_action","projection_direction","terminal_displacement","target_heading"],"evidenceSources":["world_gymnastics_parkour_table_of_tricks_2026","current_exact_canonical_contracts"],"exerciseScoresDescribeTasksOnly":true,"humanReviewRequired":true,"approvalsCreated":false}$json$::JSONB,
      'deterministic_identity_equivalence',NULL,now())
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,
    resolved_at=EXCLUDED.resolved_at
  WHERE coaching.exercise_identity_resolution_v1.reviewed_by IS NULL
    AND coaching.exercise_identity_resolution_v1.decision='distinct_exercises'
    AND coaching.exercise_identity_resolution_v1.resolution_source=
      'deterministic_identity_equivalence'
    AND coaching.exercise_identity_resolution_v1.evidence_json->>'migration'=
      migration_key;

  IF (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=rotation_definition
        AND resolved_definition_id=ANY(neighbor_ids)
        AND decision='distinct_exercises'
        AND resolution_source='deterministic_identity_equivalence'
        AND evidence_json->>'migration'=migration_key
        AND evidence_json->>'humanReviewRequired'='true'
        AND evidence_json->>'approvalsCreated'='false'
        AND reviewed_by IS NULL)<>6 THEN
    RAISE EXCEPTION '% did not persist all six review-quarantined boundaries',
      migration_key;
  END IF;

  IF EXISTS(
      SELECT 1 FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=rotation_definition
        AND resolved_definition_id=ANY(neighbor_ids)
        AND coaching.exercise_json_has_level_classification(evidence_json))
    OR EXISTS(
      SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=rotation_definition
        AND (status<>'review' OR reviewed_by IS NOT NULL
          OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)) THEN
    RAISE EXCEPTION '% created a proficiency classification or approval',
      migration_key;
  END IF;
END;
$$;
