-- Close the remaining score-72+ similarity queue with explicit movement-identity
-- boundaries. These are deterministic distinctness decisions only: no media,
-- calibration, relationship, review, or publication approval is created.
DO $final_identity_queue_distinct_boundaries$
DECLARE
  migration_key CONSTANT TEXT := '672_coaching_final_identity_queue_distinct_boundaries';
  front_plank_id UUID;
  high_front_support_id UUID;
  dynamic_tuck_rock_id UUID;
  static_tuck_hold_id UUID;
  bar_hollow_arch_id UUID;
  hollow_arch_roll_id UUID;
  hollow_body_hold_id UUID;
BEGIN
  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE facility_id=1 AND slug=ANY(ARRAY[
        'front-plank','front-support-shape-hold','dynamic-supine-tuck-rock',
        'static-supine-tuck-hold','bar-hollow-arch-tap-swing',
        'hollow-to-arch-roll','hollow-body-hold'
      ]))<>7 THEN
    RAISE EXCEPTION '% requires all seven active identity definitions', migration_key;
  END IF;

  SELECT id INTO front_plank_id FROM coaching.exercise_definition_v1
   WHERE facility_id=1 AND slug='front-plank';
  SELECT id INTO high_front_support_id FROM coaching.exercise_definition_v1
   WHERE facility_id=1 AND slug='front-support-shape-hold';
  SELECT id INTO dynamic_tuck_rock_id FROM coaching.exercise_definition_v1
   WHERE facility_id=1 AND slug='dynamic-supine-tuck-rock';
  SELECT id INTO static_tuck_hold_id FROM coaching.exercise_definition_v1
   WHERE facility_id=1 AND slug='static-supine-tuck-hold';
  SELECT id INTO bar_hollow_arch_id FROM coaching.exercise_definition_v1
   WHERE facility_id=1 AND slug='bar-hollow-arch-tap-swing';
  SELECT id INTO hollow_arch_roll_id FROM coaching.exercise_definition_v1
   WHERE facility_id=1 AND slug='hollow-to-arch-roll';
  SELECT id INTO hollow_body_hold_id FROM coaching.exercise_definition_v1
   WHERE facility_id=1 AND slug='hollow-body-hold';

  IF EXISTS(
    SELECT 1 FROM coaching.exercise_identity_resolution_v1 resolution
     WHERE (resolution.survivor_definition_id,resolution.resolved_definition_id) IN (
       (front_plank_id,high_front_support_id),
       (dynamic_tuck_rock_id,static_tuck_hold_id),
       (bar_hollow_arch_id,hollow_arch_roll_id),
       (hollow_body_hold_id,static_tuck_hold_id)
     )
       AND (resolution.resolution_source='human_review' OR resolution.reviewed_by IS NOT NULL)
  ) THEN
    RAISE EXCEPTION '% refuses to overwrite a human identity decision', migration_key;
  END IF;

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by,resolved_at
  ) VALUES
    (1,front_plank_id,high_front_support_id,'distinct_exercises',
      'Front Plank uses bilateral forearm support; High Front Support Shape Hold uses bilateral extended-hand support. The support surface and elbow state change the stable movement contract and loading geometry, so they are distinct exercises rather than aliases.',
      jsonb_build_object('identityBoundary','forearm_support_vs_extended_hand_support','decisionScope','identity_only_not_human_approval','humanReviewRequired',TRUE,'approvalsCreated',FALSE,'migration',migration_key),
      'deterministic_identity_equivalence',NULL,now()),
    (1,dynamic_tuck_rock_id,static_tuck_hold_id,'distinct_exercises',
      'Dynamic Supine Tuck Rock has a controlled rocking contact path and repetition cycle; Static Supine Tuck Hold is an isometric position with duration as its dose boundary. Dynamic travel and static hold are separate identities.',
      jsonb_build_object('identityBoundary','dynamic_rock_cycle_vs_static_tuck_hold','decisionScope','identity_only_not_human_approval','humanReviewRequired',TRUE,'approvalsCreated',FALSE,'migration',migration_key),
      'deterministic_identity_equivalence',NULL,now()),
    (1,bar_hollow_arch_id,hollow_arch_roll_id,'distinct_exercises',
      'Bar Hollow–Arch Tap Swing requires suspended bar support and a swing/tap sequence; Hollow-to-Arch Roll Cycle is a floor rolling sequence. Apparatus, support contract, orientation, and action path are identity-bearing differences.',
      jsonb_build_object('identityBoundary','suspended_bar_swing_vs_floor_roll_cycle','decisionScope','identity_only_not_human_approval','humanReviewRequired',TRUE,'approvalsCreated',FALSE,'migration',migration_key),
      'deterministic_identity_equivalence',NULL,now()),
    (1,hollow_body_hold_id,static_tuck_hold_id,'distinct_exercises',
      'Hollow Body Hold uses an extended hollow-body shape; Static Supine Tuck Hold uses a compact flexed tuck shape. The torso and limb geometry, leverage, and isometric position are distinct identity contracts.',
      jsonb_build_object('identityBoundary','extended_hollow_hold_vs_compact_tuck_hold','decisionScope','identity_only_not_human_approval','humanReviewRequired',TRUE,'approvalsCreated',FALSE,'migration',migration_key),
      'deterministic_identity_equivalence',NULL,now())
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE
    SET decision=EXCLUDED.decision,
        rationale=EXCLUDED.rationale,
        evidence_json=EXCLUDED.evidence_json,
        resolution_source=EXCLUDED.resolution_source,
        reviewed_by=NULL,
        resolved_at=now()
  WHERE coaching.exercise_identity_resolution_v1.resolution_source<>'human_review'
    AND coaching.exercise_identity_resolution_v1.reviewed_by IS NULL;

  IF (SELECT count(*) FROM coaching.exercise_identity_resolution_v1 resolution
      WHERE (resolution.survivor_definition_id,resolution.resolved_definition_id) IN (
        (front_plank_id,high_front_support_id),
        (dynamic_tuck_rock_id,static_tuck_hold_id),
        (bar_hollow_arch_id,hollow_arch_roll_id),
        (hollow_body_hold_id,static_tuck_hold_id)
      )
        AND resolution.decision='distinct_exercises'
        AND resolution.resolution_source='deterministic_identity_equivalence'
        AND resolution.reviewed_by IS NULL)<>4 THEN
    RAISE EXCEPTION '% failed to persist every identity boundary', migration_key;
  END IF;
END;
$final_identity_queue_distinct_boundaries$;
