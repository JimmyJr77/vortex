-- Close name-similarity warnings introduced by the richer aliases and card
-- contracts in the recently completed landmine, Cossack, and press families.
--
-- Every pair below has an authored identity-critical difference in support,
-- stance, action order, projection/release, or fixed-pivot equipment path.
-- Ambiguous Arc Press, general Split Squat, and underspecified deadlift pairs
-- are intentionally absent and remain in needs_human_review.
--
-- These deterministic decisions are identity-only. They do not approve a
-- card, score, media candidate, relationship, calibration, or publication.
-- Exercise cards contain difficulty, never athlete proficiency levels.
-- IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '405_coaching_recent_family_identity_boundary_closure';
  expected_count CONSTANT INTEGER := 18;
  boundary RECORD;
  left_id UUID;
  right_id UUID;
  existing_count INTEGER;
  persisted_count INTEGER;
BEGIN
  CREATE TEMP TABLE recent_identity_boundary_seed (
    left_slug TEXT NOT NULL,
    right_slug TEXT NOT NULL,
    boundary_key TEXT NOT NULL,
    left_contract TEXT NOT NULL,
    right_contract TEXT NOT NULL,
    changed_dimensions TEXT[] NOT NULL,
    rationale TEXT NOT NULL,
    PRIMARY KEY (left_slug, right_slug),
    CHECK (left_slug < right_slug)
  ) ON COMMIT DROP;

  INSERT INTO recent_identity_boundary_seed VALUES
    (
      'landmine-front-squat',
      'landmine-squat-to-press',
      'squat_only_vs_squat_then_press',
      'fixed-pivot squat ending at the declared rack',
      'full squat followed by an ordered angled press',
      ARRAY['ordered_actions','upper_body_action','repetition_finish'],
      'Landmine Front Squat ends after the squat return at the declared rack. Landmine Squat-to-Press adds a required angled press before the repetition is complete.'
    ),
    (
      'cossack-squat',
      'landmine-front-squat',
      'frontal_lateral_shift_vs_sagittal_bilateral_squat',
      'fixed-wide-stance frontal-plane lateral squat with declared side transfer',
      'fixed-pivot sagittal bilateral squat facing the anchor',
      ARRAY['plane','stance','laterality','load_path'],
      'Cossack Squat is a side-specific frontal-plane lateral squat. Landmine Front Squat is a bilateral sagittal squat constrained by an angled fixed-pivot load path.'
    ),
    (
      'landmine-press',
      'landmine-reverse-lunge-to-press',
      'strict_press_vs_step_back_lunge_then_press',
      'strict press from a fixed standing stance without a required lower-body step',
      'reverse-lunge step and return ordered into the angled press',
      ARRAY['foot_motion','lower_body_action','action_order','repetition_start'],
      'Landmine Press has no required lunge or foot displacement. Landmine Reverse Lunge to Press requires a step back, lunge, return, and ordered press.'
    ),
    (
      'landmine-squat-to-press',
      'one-arm-landmine-push-press',
      'full_squat_press_vs_dip_drive_press',
      'deliberate full squat followed by continuous force transfer into a press',
      'shallow dip-and-drive used to accelerate the press',
      ARRAY['lower_body_depth','lower_body_purpose','action_order','repetition_boundary'],
      'Landmine Squat-to-Press requires a full squat as part of the task. Landmine Push Press uses a dip-and-drive whose purpose is to accelerate the press.'
    ),
    (
      'cossack-shift-to-wall-ball-toss',
      'cossack-squat',
      'lateral_squat_vs_lateral_squat_release_target_protocol',
      'lateral shift plus an externally projected wall-ball release and target protocol',
      'lateral squat or shift with no required implement release',
      ARRAY['release','target','ball_flight','reception_or_retrieval','lane'],
      'Cossack Shift to Wall Ball Toss adds release, target, flight, retrieval or reception, and lane requirements that are absent from Cossack Squat.'
    ),
    (
      'half-kneeling-one-arm-landmine-press',
      'pallof-press-pallof-hold',
      'angled_shoulder_press_vs_anti_rotation_press_out',
      'one-arm angled shoulder press around a landmine pivot',
      'horizontal cable-or-band press-out held against transverse rotation',
      ARRAY['force_direction','joint_action','implement_path','task_intent'],
      'The landmine press moves one arm through an angled shoulder-press path. The Pallof task presses horizontally away from a cable or band anchor to resist trunk rotation.'
    ),
    (
      'half-kneeling-single-arm-press',
      'tall-kneeling-one-arm-landmine-press',
      'asymmetric_kneeling_free_or_cable_press_vs_symmetric_tall_kneeling_pivot_press',
      'half-kneeling single-arm press with one foot planted and one knee down',
      'tall-kneeling one-arm press with both knees down and a fixed landmine pivot',
      ARRAY['support','base_symmetry','equipment_path','hip_position'],
      'Half-kneeling and tall-kneeling supports are different bases, and the landmine card additionally requires a fixed angled pivot path.'
    ),
    (
      'landmine-reverse-lunge-to-press',
      'one-arm-landmine-z-press',
      'stepping_lunge_press_vs_seated_no_leg_press',
      'standing reverse-lunge step and return ordered into a press',
      'long-sitting press with both legs extended and no lower-body drive',
      ARRAY['support','foot_motion','lower_body_action','leg_drive'],
      'Reverse Lunge to Press is a standing stepping task with lower-body force transfer. Z-Press is a seated, legs-extended press with no step or leg drive.'
    ),
    (
      'landmine-split-squat',
      'one-arm-landmine-split-jerk',
      'stationary_split_squat_vs_dynamic_split_receive',
      'stationary fore-aft stance with squat descent and return',
      'rapid foot split into an extended-arm receive followed by ordered recovery',
      ARRAY['foot_motion','velocity_intent','receive_position','recovery_order'],
      'Landmine Split Squat keeps both feet fixed. Landmine Split Jerk requires rapid split footwork, a catch or receive, stabilization, and recovery.'
    ),
    (
      'landmine-split-squat',
      'landmine-squat-to-press',
      'stationary_unilateral_squat_vs_bilateral_squat_press',
      'stationary asymmetrical split stance with no required press',
      'bilateral full squat followed by an angled press',
      ARRAY['stance','laterality','upper_body_action','action_order'],
      'The split-squat task uses a fixed asymmetrical stance and ends without a required press. Squat-to-Press uses a bilateral squat followed by a press.'
    ),
    (
      'half-kneeling-one-arm-landmine-press',
      'one-arm-landmine-floor-press',
      'vertical_kneeling_support_vs_supine_floor_support',
      'half-kneeling angled press with one knee and the opposite foot supporting',
      'supine floor press with the torso and upper arm constrained by the floor',
      ARRAY['body_orientation','support','range_constraint','failure_response'],
      'Half-kneeling and supine floor support change body orientation, base, available range, and safe failure response even with the same pivoted implement.'
    ),
    (
      'landmine-reverse-lunge-to-press',
      'one-arm-landmine-push-press',
      'reverse_lunge_return_press_vs_stationary_dip_drive_press',
      'step-back lunge and return ordered into the press',
      'fixed-stance dip-and-drive press without a lunge step',
      ARRAY['foot_motion','lower_body_action','stance','action_order'],
      'Reverse Lunge to Press requires a full step-back lunge and return. Push Press keeps the stance fixed and uses only a dip-and-drive.'
    ),
    (
      'one-arm-landmine-floor-press',
      'tall-kneeling-one-arm-landmine-press',
      'supine_floor_press_vs_tall_kneeling_press',
      'supine floor-supported press with floor-limited shoulder excursion',
      'upright tall-kneeling press with both knees supporting',
      ARRAY['body_orientation','support','range_constraint','trunk_demand'],
      'Supine floor support and upright tall-kneeling support create different range constraints, trunk demands, setup, and failure responses.'
    ),
    (
      'cossack-squat',
      'landmine-squat-to-press',
      'frontal_lateral_squat_vs_bilateral_squat_press',
      'fixed-wide-stance side-specific lateral squat without required press',
      'bilateral sagittal full squat followed by an angled press',
      ARRAY['plane','stance','laterality','upper_body_action'],
      'Cossack Squat is a frontal-plane side transfer. Landmine Squat-to-Press is a bilateral sagittal squat with a required upper-body press.'
    ),
    (
      'landmine-hack-squat',
      'landmine-squat-to-press',
      'away_facing_shoulder_supported_squat_vs_facing_squat_press',
      'away-facing shoulder-supported squat ending after the stand',
      'pivot-facing full squat followed by an angled press',
      ARRAY['orientation','load_support','upper_body_action','failure_response'],
      'Landmine Hack Squat faces away and uses shoulder support without a required press. Squat-to-Press faces the pivot and adds the press action.'
    ),
    (
      'landmine-reverse-lunge-to-press',
      'one-arm-landmine-floor-press',
      'standing_step_lunge_press_vs_supine_floor_press',
      'standing reverse-lunge step and return ordered into a press',
      'supine floor-supported press with no standing or stepping action',
      ARRAY['body_orientation','support','foot_motion','lower_body_action'],
      'The reverse-lunge card is a standing compound step-and-press task. The floor press is supine and contains no lunge or foot motion.'
    ),
    (
      'landmine-press',
      'landmine-split-squat',
      'upper_body_strict_press_vs_lower_body_stationary_split_squat',
      'strict upper-body angled press from a declared fixed stance',
      'stationary lower-body split squat with no required press',
      ARRAY['primary_action','stance','joint_sequence','repetition_finish'],
      'Landmine Press is an upper-body press identity. Landmine Split Squat is a lower-body stationary unilateral squat identity with no required press.'
    ),
    (
      'landmine-squat-to-press',
      'one-arm-landmine-z-press',
      'standing_full_squat_press_vs_seated_no_leg_press',
      'standing bilateral full squat followed by a press',
      'long-sitting press with extended legs and no lower-body drive',
      ARRAY['support','lower_body_action','leg_drive','action_order'],
      'Squat-to-Press requires a standing full squat and lower-body force transfer. Z-Press is seated and deliberately removes leg drive.'
    );

  SELECT count(*) INTO existing_count
  FROM recent_identity_boundary_seed;

  IF existing_count <> expected_count THEN
    RAISE EXCEPTION '% expected % boundary seeds; found %',
      migration_key, expected_count, existing_count;
  END IF;

  FOR boundary IN
    SELECT * FROM recent_identity_boundary_seed ORDER BY left_slug, right_slug
  LOOP
    left_id := NULL;
    right_id := NULL;

    SELECT id INTO left_id
    FROM coaching.exercise_definition_v1
    WHERE facility_id = 1
      AND slug = boundary.left_slug
      AND status <> 'archived';

    SELECT id INTO right_id
    FROM coaching.exercise_definition_v1
    WHERE facility_id = 1
      AND slug = boundary.right_slug
      AND status <> 'archived';

    IF left_id IS NULL OR right_id IS NULL THEN
      RAISE EXCEPTION '% requires one active definition for % and %',
        migration_key, boundary.left_slug, boundary.right_slug;
    END IF;

    SELECT count(*) INTO existing_count
    FROM coaching.exercise_identity_resolution_v1 resolution
    WHERE resolution.facility_id = 1
      AND resolution.survivor_definition_id IN (left_id, right_id)
      AND resolution.resolved_definition_id IN (left_id, right_id)
      AND NOT (
        resolution.decision = 'distinct_exercises'
        AND resolution.resolution_source = 'deterministic_identity_equivalence'
        AND resolution.reviewed_by IS NULL
        AND resolution.evidence_json->>'migration' = migration_key
      );

    IF existing_count > 0 THEN
      RAISE EXCEPTION '% refused to overwrite an existing decision for % and %',
        migration_key, boundary.left_slug, boundary.right_slug;
    END IF;

    INSERT INTO coaching.exercise_identity_resolution_v1 (
      facility_id,
      survivor_definition_id,
      resolved_definition_id,
      decision,
      rationale,
      evidence_json,
      resolution_source,
      reviewed_by,
      resolved_at
    )
    SELECT
      1,
      left_id,
      right_id,
      'distinct_exercises',
      boundary.rationale,
      jsonb_build_object(
        'identityBoundary',boundary.boundary_key,
        'leftContract',boundary.left_contract,
        'rightContract',boundary.right_contract,
        'changedDimensions',to_jsonb(boundary.changed_dimensions),
        'evidenceSource','current_authored_candidate_card_contracts',
        'decisionScope','identity_only_not_card_media_graph_calibration_or_publication_approval',
        'cardsRemainReviewOnly',TRUE,
        'approvalsCreated',FALSE,
        'exerciseDifficultyModel','exercise_complexity_and_physical_difficulty_only',
        'migration',migration_key
      ),
      'deterministic_identity_equivalence',
      NULL,
      now()
    WHERE NOT EXISTS (
      SELECT 1
      FROM coaching.exercise_identity_resolution_v1 resolution
      WHERE resolution.facility_id = 1
        AND resolution.survivor_definition_id IN (left_id, right_id)
        AND resolution.resolved_definition_id IN (left_id, right_id)
    );
  END LOOP;

  SELECT count(*) INTO persisted_count
  FROM coaching.exercise_identity_resolution_v1 resolution
  WHERE resolution.facility_id = 1
    AND resolution.decision = 'distinct_exercises'
    AND resolution.resolution_source = 'deterministic_identity_equivalence'
    AND resolution.reviewed_by IS NULL
    AND resolution.evidence_json->>'migration' = migration_key;

  IF persisted_count <> expected_count THEN
    RAISE EXCEPTION '% expected % persisted boundaries; found %',
      migration_key, expected_count, persisted_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_identity_resolution_v1 resolution
    WHERE resolution.evidence_json->>'migration' = migration_key
      AND (
        resolution.decision <> 'distinct_exercises'
        OR resolution.reviewed_by IS NOT NULL
        OR resolution.evidence_json->>'approvalsCreated' <> 'false'
      )
  ) THEN
    RAISE EXCEPTION '% created or retained an unsupported approval state',
      migration_key;
  END IF;
END
$$;
