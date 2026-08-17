-- Close mechanically incompatible high-similarity pairs. These are not
-- substitutions and remain independently review-gated cards.
DO $migration$
DECLARE
  migration_key CONSTANT TEXT := '548_coaching_remaining_obvious_identity_boundaries';
  definitions JSONB := '{}'::JSONB;
BEGIN
  SELECT jsonb_object_agg(slug,id) INTO definitions FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND status='review' AND slug IN(
    'hanging-leg-raise','standing-calf-raise','medicine-ball-rotational-catch-and-stick','slam-ball-rotational-slam',
    'kneeling-medicine-ball-chest-pass','walking-knee-hug','shuffle-to-rotational-medicine-ball-throw',
    'arm-circles','hip-cars','landmine-press','two-hand-landmine-bent-over-row','lateral-ape-walk','mini-band-lateral-walk');
  IF definitions IS NULL OR NOT definitions ?& ARRAY[
    'hanging-leg-raise','standing-calf-raise','medicine-ball-rotational-catch-and-stick','slam-ball-rotational-slam',
    'kneeling-medicine-ball-chest-pass','walking-knee-hug','shuffle-to-rotational-medicine-ball-throw',
    'arm-circles','hip-cars','landmine-press','two-hand-landmine-bent-over-row','lateral-ape-walk','mini-band-lateral-walk'
  ]::TEXT[] THEN RAISE EXCEPTION '% requires thirteen active exact definitions',migration_key; END IF;
  INSERT INTO coaching.exercise_identity_resolution_v1(facility_id,survivor_definition_id,resolved_definition_id,decision,rationale,evidence_json,resolution_source,reviewed_by,resolved_at)
  SELECT 1,(definitions->>left_slug)::uuid,(definitions->>right_slug)::uuid,'distinct_exercises',rationale,
    jsonb_build_object('migration',migration_key,'identityBoundary',boundary,'automaticSubstitution',FALSE,'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'deterministic_identity_equivalence',NULL,now()
  FROM (VALUES
    ('hanging-leg-raise','standing-calf-raise','suspended_hip_flexion_vs_standing_plantarflexion','Hanging Leg Raise uses suspended upper-limb support and controlled hip/trunk flexion. Standing Calf Raise uses standing forefoot support and ankle plantarflexion. Base, contacts, joints, loading, and exit differ.'),
    ('medicine-ball-rotational-catch-and-stick','slam-ball-rotational-slam','catch_and_stick_vs_floor_slam','Rotational Catch-and-Stick receives and decelerates an incoming ball before a controlled finish. Rotational Ball Slam is a floor-directed release and retrieval task. Incoming-ball exposure, terminal action, and station controls differ.'),
    ('kneeling-medicine-ball-chest-pass','walking-knee-hug','kneeling_bilateral_ball_pass_vs_locomotor_knee_hug','Kneeling Chest Pass is a bilateral ball release from a kneeling base. Walking Knee Hug is alternating locomotion with a manual knee-hug. Implement, contacts, action, and station needs differ.'),
    ('shuffle-to-rotational-medicine-ball-throw','slam-ball-rotational-slam','shuffle_ballistic_throw_vs_floor_slam','Shuffle Rotational Throw adds lateral approach footwork and a ballistic throw release. Rotational Ball Slam has a floor-directed slam and retrieval. Entry, release trajectory, target, and safety zone differ.'),
    ('arm-circles','hip-cars','standing_shoulder_car_vs_hip_car','Standing Single-Arm Shoulder CAR is an upper-limb glenohumeral path. Hip CAR is a unilateral hip circle with pelvis/trunk control. Target joint, limb, base demands, and observation criteria differ.'),
    ('landmine-press','two-hand-landmine-bent-over-row','landmine_press_vs_bent_over_row','Landmine Press drives the implement away through a pressing path. Two-Hand Landmine Bent-Over Row pulls it toward the torso from a hinge. Force direction, trunk position, action, and terminal condition differ.'),
    ('lateral-ape-walk','mini-band-lateral-walk','quadrupedal_lateral_ape_walk_vs_upright_band_walk','Lateral Ape Walk is quadrupedal lateral locomotion with hand and foot support. Mini-Band Lateral Walk is upright level-lane travel against a loop band. Base contacts, implement, loading, and fall-space controls differ.')
  ) i(left_slug,right_slug,boundary,rationale)
  WHERE NOT EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1 r
    WHERE r.survivor_definition_id=(definitions->>left_slug)::uuid AND r.resolved_definition_id=(definitions->>right_slug)::uuid
      AND (r.reviewed_by IS NOT NULL OR r.resolution_source='human_review'))
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,evidence_json=EXCLUDED.evidence_json,resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,resolved_at=EXCLUDED.resolved_at;
  IF (SELECT count(*) FROM coaching.exercise_identity_resolution_v1 WHERE resolution_source='deterministic_identity_equivalence' AND evidence_json->>'migration'=migration_key AND decision='distinct_exercises')<>7 THEN
    RAISE EXCEPTION '% identity-boundary assertions failed',migration_key;
  END IF;
END
$migration$;
