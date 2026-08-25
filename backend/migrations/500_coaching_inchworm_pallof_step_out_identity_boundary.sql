-- Close the score-75 false-positive created by the generic Walkout / Step-Out
-- name tokens. This records a deterministic mechanics boundary only; it does
-- not create a human identity, graph, content, calibration, or publication approval.
DO $migration$
DECLARE
  migration_key CONSTANT TEXT := '500_coaching_inchworm_pallof_step_out_identity_boundary';
  inchworm_definition UUID;
  pallof_definition UUID;
BEGIN
  SELECT definition_id INTO inchworm_definition FROM coaching.exercise_definition_source_v1
  WHERE legacy_exercise_id=29;
  SELECT id INTO pallof_definition FROM coaching.exercise_definition_v1
  WHERE slug='pallof-press-step-out';

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=inchworm_definition AND legacy_exercise_id=29
        AND slug='inchworm-walkout' AND status='review' AND card_version=2)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=pallof_definition AND slug='pallof-press-step-out'
        AND status='review') THEN
    RAISE EXCEPTION '% prerequisite definitions are missing or changed',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=inchworm_definition
        AND resolved_definition_id=pallof_definition
        AND (reviewed_by IS NOT NULL OR resolution_source='human_review')) THEN
    RAISE EXCEPTION '% refuses to overwrite a human-reviewed identity decision',migration_key;
  END IF;

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,rationale,
    evidence_json,resolution_source,reviewed_by,resolved_at)
  VALUES(
    1,inchworm_definition,pallof_definition,'distinct_exercises',
    'Inchworm Walkout is an unloaded standing-to-floor hand-walk to high plank with a declared hands-back or feet-in return and standing finish. Pallof Step-Out uses an external lateral anchor, held anti-rotation press position, lateral foot steps, and resisted return. The shared out token and locomotion wording do not preserve base, contacts, force direction, implement, actions, repetition boundary, or purpose.',
    jsonb_build_object(
      'migration',migration_key,
      'identityBoundary','standing_bodyweight_hand_walk_to_high_plank_vs_anchored_lateral_anti_rotation_step_out',
      'similarityScoreObserved',75,
      'inchwormFacts',jsonb_build_array('standing_start_and_finish','hands_walk_to_high_plank','stationary_hands_back_or_traveling_feet_in_return','no_external_anchor','no_push_up'),
      'pallofFacts',jsonb_build_array('external_lateral_anchor','anti_rotation_press_position','lateral_step_out_and_return','resisted_force_direction'),
      'nameTokenCollisionOnly',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'deterministic_identity_equivalence',NULL,now())
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,
    reviewed_by=NULL,resolved_at=now();

  UPDATE coaching.exercise_definition_v1 SET
    provenance_json=provenance_json||jsonb_build_object(
      'identityQueueClosureMigration',migration_key,
      'pallofStepOutBoundary','distinct_exercises',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    updated_at=now()
  WHERE id=inchworm_definition;

  UPDATE coaching.exercise_card_test_packet_v1 SET
    checks_json=jsonb_set(
      checks_json,
      '{identity}',
      coalesce(checks_json->'identity','{}'::JSONB)||jsonb_build_object(
        'distinctDefinitions',5,
        'pallofStepOutSimilarityPairClosed',TRUE,
        'identityQueueClosureMigration',migration_key),
      TRUE),
    checked_at=now()
  WHERE definition_id=inchworm_definition AND card_version=2;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=inchworm_definition
        AND resolved_definition_id=pallof_definition
        AND decision='distinct_exercises'
        AND resolution_source='deterministic_identity_equivalence'
        AND reviewed_by IS NULL
        AND evidence_json->>'identityBoundary'='standing_bodyweight_hand_walk_to_high_plank_vs_anchored_lateral_anti_rotation_step_out'
        AND evidence_json->>'approvalsCreated'='false')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=inchworm_definition AND card_version=2
        AND status='quarantined' AND human_review_required IS TRUE
        AND jsonb_array_length(blocking_issues_json)=4
        AND checks_json->'identity'->>'pallofStepOutSimilarityPairClosed'='true')
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=inchworm_definition AND (status='published'
        OR reviewed_by IS NOT NULL OR approved_by IS NOT NULL
        OR approved_video_url IS NOT NULL)) THEN
    RAISE EXCEPTION '% identity boundary or quarantine assertion failed',migration_key;
  END IF;
END
$migration$;
