-- Final deterministic closures for the score-72+ identity queue. Each pair
-- has materially different base, terminal action, laterality, or sequence.
DO $migration$
DECLARE
  migration_key CONSTANT TEXT := '550_coaching_final_high_similarity_identity_boundaries';
  cards JSONB;
BEGIN
  SELECT jsonb_object_agg(slug,id) INTO cards FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND status='review' AND slug IN(
    'forearm-wall-slide-with-reach','wall-slides-with-lift-off','adductor-rockback','frog-rockback',
    'cossack-squat','deep-squat-pry','rock-and-roll-to-stand','squat-to-stand-with-reach',
    'landmine-romanian-deadlift-to-row','meadows-row','standing-calf-raise','wall-supported-hip-cars');
  IF cards IS NULL OR NOT cards ?& ARRAY['forearm-wall-slide-with-reach','wall-slides-with-lift-off','adductor-rockback','frog-rockback','cossack-squat','deep-squat-pry','rock-and-roll-to-stand','squat-to-stand-with-reach','landmine-romanian-deadlift-to-row','meadows-row','standing-calf-raise','wall-supported-hip-cars']::TEXT[] THEN
    RAISE EXCEPTION '% requires twelve active exact definitions',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1 r WHERE
    ((r.survivor_definition_id=(cards->>'forearm-wall-slide-with-reach')::uuid AND r.resolved_definition_id=(cards->>'wall-slides-with-lift-off')::uuid)
    OR (r.survivor_definition_id=(cards->>'adductor-rockback')::uuid AND r.resolved_definition_id=(cards->>'frog-rockback')::uuid)
    OR (r.survivor_definition_id=(cards->>'cossack-squat')::uuid AND r.resolved_definition_id=(cards->>'deep-squat-pry')::uuid)
    OR (r.survivor_definition_id=(cards->>'rock-and-roll-to-stand')::uuid AND r.resolved_definition_id=(cards->>'squat-to-stand-with-reach')::uuid)
    OR (r.survivor_definition_id=(cards->>'landmine-romanian-deadlift-to-row')::uuid AND r.resolved_definition_id=(cards->>'meadows-row')::uuid)
    OR (r.survivor_definition_id=(cards->>'standing-calf-raise')::uuid AND r.resolved_definition_id=(cards->>'wall-supported-hip-cars')::uuid))
    AND (r.reviewed_by IS NOT NULL OR r.resolution_source='human_review')) THEN
    RAISE EXCEPTION '% refuses to overwrite a human-reviewed identity decision',migration_key;
  END IF;
  INSERT INTO coaching.exercise_identity_resolution_v1(facility_id,survivor_definition_id,resolved_definition_id,decision,rationale,evidence_json,resolution_source,reviewed_by,resolved_at)
  SELECT 1,(cards->>left_slug)::uuid,(cards->>right_slug)::uuid,'distinct_exercises',rationale,
    jsonb_build_object('migration',migration_key,'identityBoundary',boundary,'automaticSubstitution',FALSE,'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'deterministic_identity_equivalence',NULL,now()
  FROM (VALUES
    ('forearm-wall-slide-with-reach','wall-slides-with-lift-off','forearm_wall_reach_vs_terminal_full_arm_lift_off','Forearm Wall Slide with Reach maintains forearm wall contact through the declared reach. Wall Slides with Lift-Off ends with a terminal full-arm lift-off and controlled forearm replacement. Terminal contact, arm path, support, and repetition boundary differ.'),
    ('adductor-rockback','frog-rockback','single_side_adductor_rockback_vs_bilateral_frog_rockback','Adductor Rockback uses a declared target-side adductor position and rockback path. Frog Rockback uses bilateral flexed/abducted hip support with a different knee, foot, laterality, and base contract. They are not interchangeable by name.'),
    ('cossack-squat','deep-squat-pry','lateral_single_side_cossack_vs_bilateral_deep_squat_pry','Cossack Squat is a lateral single-side loading and transfer pattern with a declared working side. Deep Squat Pry is bilateral deep-squat positioning with a pry action. Laterality, locomotor transfer, loading, and terminal action differ.'),
    ('rock-and-roll-to-stand','squat-to-stand-with-reach','floor_roll_to_stand_vs_standing_squat_reach','Rock-and-Roll to Stand transitions through a floor roll and ground-to-stand sequence. Squat-to-Stand with Reach begins and ends standing without the rolling transition. Base, contacts, sequence, exit, and safety controls differ.'),
    ('landmine-romanian-deadlift-to-row','meadows-row','compound_landmine_hinge_row_vs_single_arm_meadows_row','Landmine Romanian Deadlift to Row combines a bilateral or declared hinge with a row in one compound sequence. Meadows Row is a unilateral landmine row with a different stance, support, loading path, and repetition boundary. The compound sequence is not a silent row variation.'),
    ('standing-calf-raise','wall-supported-hip-cars','standing_plantarflexion_raise_vs_wall_supported_hip_circle','Standing Calf Raise is repeated ankle plantarflexion with forefoot support. Wall-Supported Hip CAR is a unilateral active hip circle with hand support. Target joint, action, laterality, loading, and coaching criteria differ.')
  ) i(left_slug,right_slug,boundary,rationale)
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,evidence_json=EXCLUDED.evidence_json,resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,resolved_at=EXCLUDED.resolved_at;
  IF (SELECT count(*) FROM coaching.exercise_identity_resolution_v1 WHERE resolution_source='deterministic_identity_equivalence' AND evidence_json->>'migration'=migration_key AND decision='distinct_exercises')<>6 THEN
    RAISE EXCEPTION '% identity-boundary assertions failed',migration_key;
  END IF;
END
$migration$;
