-- Structurally complete the five exercise cards involved in migration 341's
-- researched identity boundaries.
--
-- The migration creates exact review-only variants, delivery profiles,
-- candidate evidence, candidate media, alternate classifications,
-- relationship proposals, and calibration proposals. It intentionally creates
-- no human, media, graph, calibration, or publication approval. Legacy generic
-- baselines are archived and nonselectable. Exercise difficulty is exercise
-- complexity plus physical difficulty, with overall derived as their maximum.
-- Exercise cards receive no skill or proficiency level. IDEMPOTENT and
-- fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '342_coaching_researched_identity_boundary_card_completion';
  target_ids UUID[];
  facility BIGINT;
  protected_records INTEGER;
  unexpected_variants INTEGER;
BEGIN
  SELECT array_agg(id ORDER BY slug), min(facility_id)
  INTO target_ids, facility
  FROM coaching.exercise_definition_v1
  WHERE slug IN (
    'dead-bug-wall-press',
    'medicine-ball-dead-bug-press',
    'lateral-hop-to-stick',
    'medicine-ball-countermovement-throw',
    'med-ball-countermovement-rotational-throw'
  )
    AND status <> 'archived';

  IF coalesce(array_length(target_ids, 1), 0) <> 5 THEN
    RAISE EXCEPTION
      'Boundary-card completion requires five active target definitions';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_definition_v1
    WHERE id = ANY(target_ids)
      AND facility_id <> facility
  ) THEN
    RAISE EXCEPTION
      'Boundary-card completion requires all target definitions in one facility';
  END IF;

  IF (
    SELECT COUNT(*)
    FROM coaching.exercise_identity_resolution_v1 resolution
    JOIN coaching.exercise_definition_v1 left_definition
      ON left_definition.id = resolution.survivor_definition_id
    JOIN coaching.exercise_definition_v1 right_definition
      ON right_definition.id = resolution.resolved_definition_id
    WHERE resolution.decision = 'distinct_exercises'
      AND (
        (left_definition.slug = 'dead-bug-wall-press'
          AND right_definition.slug = 'medicine-ball-dead-bug-press')
        OR
        (left_definition.slug = 'lateral-hop-to-stick'
          AND right_definition.slug = 'single-leg-lateral-hop-to-stick')
        OR
        (left_definition.slug = 'med-ball-countermovement-rotational-throw'
          AND right_definition.slug = 'medicine-ball-countermovement-throw')
      )
  ) <> 3 THEN
    RAISE EXCEPTION
      'Boundary-card completion requires all three migration 341 identity boundaries';
  END IF;

  SELECT
    (
      SELECT COUNT(*)
      FROM coaching.exercise_definition_v1
      WHERE id = ANY(target_ids)
        AND (
          status = 'published'
          OR reviewed_by IS NOT NULL
          OR approved_by IS NOT NULL
          OR last_reviewed_at IS NOT NULL
          OR approved_video_url IS NOT NULL
        )
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_section_evidence_v1
      WHERE definition_id = ANY(target_ids)
        AND review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_media_candidate_v1
      WHERE definition_id = ANY(target_ids)
        AND review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id = ANY(target_ids)
        AND review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_card_review_v1
      WHERE definition_id = ANY(target_ids)
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_card_revision_v1
      WHERE definition_id = ANY(target_ids)
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_media_review_v1
      WHERE definition_id = ANY(target_ids)
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_variant_v1
      WHERE definition_id = ANY(target_ids)
        AND status = 'published'
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_relationship_v1 relationship
      WHERE (
        relationship.from_variant_id IN (
          SELECT id
          FROM coaching.exercise_variant_v1
          WHERE definition_id = ANY(target_ids)
        )
        OR relationship.to_variant_id IN (
          SELECT id
          FROM coaching.exercise_variant_v1
          WHERE definition_id = ANY(target_ids)
        )
      )
        AND (
          relationship.review_status <> 'review'
          OR relationship.reviewed_by IS NOT NULL
          OR relationship.reviewed_at IS NOT NULL
        )
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_score_calibration_v1 calibration
      WHERE calibration.variant_id IN (
        SELECT id
        FROM coaching.exercise_variant_v1
        WHERE definition_id = ANY(target_ids)
      )
        AND (
          calibration.status <> 'review'
          OR calibration.reviewed_by IS NOT NULL
          OR calibration.reviewed_at IS NOT NULL
        )
    )
  INTO protected_records;

  IF protected_records > 0 THEN
    RAISE EXCEPTION
      'Boundary-card completion refused to override % protected records',
      protected_records;
  END IF;

  SELECT COUNT(*)
  INTO unexpected_variants
  FROM coaching.exercise_variant_v1
  WHERE definition_id = ANY(target_ids)
    AND status <> 'archived'
    AND variant_key NOT IN (
      'baseline',
      'alternating-heel-tap',
      'alternating-leg-extension',
      'single-free-limb-control',
      'contralateral-arm-leg-extension',
      'low-amplitude-bilateral-control',
      'distance-bilateral-control',
      'shallow-countermovement-wall-pass',
      'squat-countermovement-wall-pass',
      'fixed-stance-countermovement-wall-throw',
      'pivot-allowed-countermovement-wall-throw'
    );

  IF unexpected_variants > 0 THEN
    RAISE EXCEPTION
      'Boundary-card completion found % unexpected active variants',
      unexpected_variants;
  END IF;

  CREATE TEMP TABLE boundary_definition_seed (
    slug TEXT PRIMARY KEY,
    canonical_name TEXT NOT NULL,
    family_key TEXT NOT NULL,
    aliases TEXT[] NOT NULL,
    description TEXT NOT NULL,
    movement_patterns TEXT[] NOT NULL,
    body_regions TEXT[] NOT NULL,
    required_equipment TEXT[] NOT NULL,
    optional_equipment TEXT[] NOT NULL,
    anatomy_json JSONB NOT NULL,
    environment_json JSONB NOT NULL,
    population_json JSONB NOT NULL,
    athlete_support_json JSONB NOT NULL,
    coach_support_json JSONB NOT NULL,
    support_operations_json JSONB NOT NULL,
    research_batch TEXT NOT NULL,
    content_confidence SMALLINT NOT NULL,
    scoring_confidence SMALLINT NOT NULL,
    media_confidence SMALLINT NOT NULL,
    legacy_summary TEXT NOT NULL,
    legacy_instructions TEXT NOT NULL,
    legacy_coach_language TEXT NOT NULL,
    legacy_athlete_language TEXT NOT NULL,
    legacy_family TEXT NOT NULL,
    legacy_phase TEXT NOT NULL,
    legacy_subrole TEXT NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO boundary_definition_seed VALUES
    (
      'dead-bug-wall-press',
      'Dead Bug Wall Press',
      'fixed_wall_press_dead_bug_anti_extension',
      ARRAY[
        'Wall Press Dead Bug',
        'Dead Bug Wall Push',
        'Wall-Press Dead Bug'
      ]::TEXT[],
      'Lie supine with the head near an inspected wall, hips and knees in a declared tabletop start, and both hands pressing the wall continuously. Maintain a controlled rib-pelvis position and quiet breathing while one declared leg at a time performs the exact heel-tap or extension path, returns to the same start, and resets before the other side.',
      ARRAY['brace']::TEXT[],
      ARRAY['core', 'spine', 'hip', 'shoulder']::TEXT[],
      ARRAY['wall']::TEXT[],
      ARRAY[]::TEXT[],
      '{
        "primaryMuscles":[
          "rectus_abdominis",
          "internal_and_external_obliques",
          "transversus_abdominis"
        ],
        "secondaryMuscles":[
          "latissimus_dorsi",
          "shoulder_extensors_and_stabilizers",
          "hip_flexors",
          "multifidus"
        ],
        "joints":["spine","pelvis","hip","shoulder"],
        "jointActions":[
          "trunk_anti_extension_and_rib_pelvis_control",
          "bilateral_shoulder_extension_isometric_into_wall",
          "declared_hip_flexion_to_extension_and_return"
        ],
        "planes":["sagittal","multiplanar_stabilization"],
        "laterality":"bilateral_hand_press_with_alternating_declared_leg_motion"
      }'::JSONB,
      '{
        "surface":"level_padded_high_traction_floor",
        "wall":"fixed_clear_and_load_tolerant",
        "clearance":"head_hands_and_leg_paths_clear",
        "lighting":"ribs_pelvis_press_and_leg_path_visible",
        "traffic":"one_athlete_per_wall_station",
        "coachSightline":"side_or_oblique_view_of_ribs_pelvis_wall_press_and_leg"
      }'::JSONB,
      '{
        "readiness":[
          "pain_free_supine_position",
          "can_breathe_while_bracing",
          "can_hold_bilateral_wall_press",
          "can_move_one_leg_without_uncontrolled_spinal_motion"
        ],
        "contraindicationFlags":[
          "pain_or_neurologic_symptoms",
          "uncontrolled_pressure_symptoms_or_dizziness",
          "wall_or_floor_is_unsafe",
          "cannot_maintain_breath_or_trunk_position"
        ],
        "selectionBoundary":"Select exact leg path, range, tempo, dose, and rest from current control; exercise cards do not carry skill levels."
      }'::JSONB,
      '{
        "primaryCue":"Press the wall, keep ribs and pelvis quiet, move one leg, exhale, return.",
        "selfChecks":[
          "Both hands keep the same wall pressure.",
          "My ribs and pelvis remain controlled.",
          "Only the declared leg moves.",
          "I can breathe and return without rushing."
        ],
        "painGuidance":"Stop for pain, numbness, dizziness, pressure symptoms, neck strain, breath panic, back arch, rib flare, or lost wall pressure.",
        "accessibility":[
          "alternating_heel_tap",
          "shorter_leg_range",
          "fewer_repetitions",
          "longer_rest",
          "plain_text_image_audio_or_live_instruction"
        ]
      }'::JSONB,
      '{
        "primaryCues":[
          "Hands press the wall.",
          "Ribs over pelvis.",
          "One leg moves.",
          "Long exhale.",
          "Return to the same start."
        ],
        "qualityGate":"Count only reps with continuous bilateral wall pressure, controlled ribs and pelvis, exact leg path, smooth return, and quiet breathing.",
        "observationPriorities":[
          "wall_press_continuity",
          "rib_pelvis_and_lumbar_control",
          "declared_leg_path_and_range",
          "breath_and_neck_tension",
          "symmetric_return"
        ],
        "immediateStop":[
          "symptoms_or_breath_panic",
          "wall_or_floor_failure",
          "lumbar_arch_or_rib_flare",
          "press_loss_or_uncontrolled_leg_drop"
        ],
        "recordAfterSet":[
          "variant_and_leg_range",
          "quality_repetitions_per_side",
          "tempo_rest_and_symptoms",
          "position_press_or_breath_errors"
        ]
      }'::JSONB,
      '{
        "selectionInputs":[
          "symptoms_and_readiness",
          "leg_path_and_range",
          "tempo_and_breath",
          "available_time",
          "trunk_and_hip_flexor_fatigue_budget"
        ],
        "substitutionPolicy":{
          "mustPreserve":[
            "supine_anti_extension_control",
            "declared_external_press_or_explicit_regression",
            "controlled_breath_and_return"
          ],
          "neverSilent":[
            "fixed_wall_to_ball_between_limbs",
            "single_leg_to_double_leg_motion",
            "controlled_to_ballistic",
            "symptom_related_change"
          ]
        },
        "feedbackCapture":[
          "quality_repetitions",
          "position_press_or_breath_error",
          "symptoms",
          "substitution_reason",
          "coach_override"
        ]
      }'::JSONB,
      'dead-bug-press-boundary-v1',
      78,
      68,
      40,
      'Bilateral fixed-wall hand press with exact alternating leg motion, controlled breath, quality gate, and full return.',
      'Declare heel-tap or extension variant, leg range, tempo, repetitions, rest, and stop signal. Press both hands into the wall, keep ribs and pelvis controlled, move one leg, exhale, return, and reset.',
      'Observe wall pressure, ribs, pelvis, lumbar position, exact leg path, range, return, breathing, symptoms, and stop response.',
      'Press the wall, keep ribs and pelvis quiet, move one leg, exhale, return.',
      'Fixed-wall anti-extension dead bug',
      'prepare_and_access',
      'activate'
    ),
    (
      'medicine-ball-dead-bug-press',
      'Medicine-Ball Dead Bug Press',
      'contralateral_ball_press_dead_bug_anti_extension',
      ARRAY[
        'Medicine Ball Dead Bug Press',
        'Med Ball Dead Bug Press',
        'Contralateral Ball-Press Dead Bug'
      ]::TEXT[],
      'Lie supine in a declared tabletop start and press one exact medicine ball between one declared hand and the opposite knee. Maintain that contralateral press, rib-pelvis control, and quiet breathing while the free opposite arm and leg perform the exact single-limb or combined extension path, return, and reset before sides change.',
      ARRAY['brace', 'push']::TEXT[],
      ARRAY['core', 'spine', 'hip', 'shoulder']::TEXT[],
      ARRAY['medicine_ball']::TEXT[],
      ARRAY[]::TEXT[],
      '{
        "primaryMuscles":[
          "rectus_abdominis",
          "internal_and_external_obliques",
          "transversus_abdominis"
        ],
        "secondaryMuscles":[
          "hip_flexors",
          "latissimus_dorsi",
          "serratus_anterior_and_shoulder_stabilizers",
          "multifidus"
        ],
        "joints":["spine","pelvis","hip","shoulder"],
        "jointActions":[
          "trunk_anti_extension_and_rib_pelvis_control",
          "contralateral_shoulders_and_hip_isometric_ball_press",
          "free_shoulder_flexion_or_extension",
          "free_hip_flexion_to_extension_and_return"
        ],
        "planes":["sagittal","multiplanar_stabilization"],
        "laterality":"declared_contralateral_hand_knee_press_with_free_opposite_limb_motion"
      }'::JSONB,
      '{
        "surface":"level_padded_high_traction_floor",
        "ball":"intact_clean_declared_diameter_mass_and_compressibility",
        "clearance":"head_arms_legs_and_ball_clear",
        "lighting":"ribs_pelvis_ball_press_and_free_limbs_visible",
        "traffic":"one_athlete_per_floor_station",
        "coachSightline":"side_or_oblique_view_of_ball_press_ribs_pelvis_and_free_limbs"
      }'::JSONB,
      '{
        "readiness":[
          "pain_free_supine_position",
          "can_breathe_while_bracing",
          "can_hold_contralateral_hand_knee_ball_press",
          "can_move_declared_free_limbs_without_uncontrolled_spinal_motion"
        ],
        "contraindicationFlags":[
          "pain_or_neurologic_symptoms",
          "uncontrolled_pressure_symptoms_or_dizziness",
          "ball_or_floor_is_unsafe",
          "cannot_maintain_press_breath_or_trunk_position"
        ],
        "selectionBoundary":"Select exact ball, pressing side, free-limb pattern, range, tempo, dose, and rest from current control; exercise cards do not carry skill levels."
      }'::JSONB,
      '{
        "primaryCue":"Press hand and opposite knee into the ball; move the free limb or limbs, exhale, return.",
        "selfChecks":[
          "The ball stays between the declared hand and opposite knee.",
          "My ribs and pelvis remain controlled.",
          "Only the declared free limb or limbs move.",
          "I can breathe and return without losing pressure."
        ],
        "painGuidance":"Stop for pain, numbness, dizziness, pressure symptoms, neck strain, breath panic, ball slip, back arch, rib flare, or lost ball pressure.",
        "accessibility":[
          "single_free_limb_motion",
          "shorter_range",
          "larger_or_lighter_ball",
          "fewer_repetitions",
          "longer_rest",
          "plain_text_image_audio_or_live_instruction"
        ]
      }'::JSONB,
      '{
        "primaryCues":[
          "Hand and opposite knee squeeze the ball.",
          "Ribs over pelvis.",
          "Move only the free limb or limbs.",
          "Long exhale.",
          "Return before changing sides."
        ],
        "qualityGate":"Count only reps with continuous declared contralateral ball pressure, controlled ribs and pelvis, exact free-limb path, smooth return, and quiet breathing.",
        "observationPriorities":[
          "ball_position_and_press_continuity",
          "rib_pelvis_and_lumbar_control",
          "free_limb_path_and_range",
          "breath_and_neck_tension",
          "symmetric_side_change_and_return"
        ],
        "immediateStop":[
          "symptoms_or_breath_panic",
          "ball_or_floor_failure",
          "lumbar_arch_or_rib_flare",
          "ball_press_loss_or_uncontrolled_limb_drop"
        ],
        "recordAfterSet":[
          "variant_ball_and_pressing_side",
          "quality_repetitions_per_side",
          "range_tempo_rest_and_symptoms",
          "position_press_or_breath_errors"
        ]
      }'::JSONB,
      '{
        "selectionInputs":[
          "symptoms_and_readiness",
          "ball_size_and_mass",
          "pressing_side_and_free_limb_pattern",
          "range_tempo_and_breath",
          "available_time",
          "trunk_hip_flexor_and_shoulder_fatigue_budget"
        ],
        "substitutionPolicy":{
          "mustPreserve":[
            "supine_anti_extension_control",
            "declared_contralateral_press_or_explicit_regression",
            "controlled_breath_and_return"
          ],
          "neverSilent":[
            "ball_between_limbs_to_fixed_wall",
            "single_free_limb_to_combined_arm_leg_motion",
            "controlled_to_ball_toss",
            "symptom_related_change"
          ]
        },
        "feedbackCapture":[
          "quality_repetitions",
          "position_press_ball_or_breath_error",
          "symptoms",
          "substitution_reason",
          "coach_override"
        ]
      }'::JSONB,
      'dead-bug-press-boundary-v1',
      76,
      66,
      40,
      'Contralateral hand-knee medicine-ball press with exact free-limb motion, controlled breath, quality gate, and full return.',
      'Declare ball, pressing hand and opposite knee, free-limb pattern, range, tempo, repetitions, rest, and stop signal. Maintain the press, move the free limb or limbs, exhale, return, and reset.',
      'Observe ball position and pressure, ribs, pelvis, lumbar position, free-limb path, range, return, breathing, symptoms, and stop response.',
      'Squeeze the ball with hand and opposite knee, move the free limb or limbs, exhale, return.',
      'Contralateral ball-press anti-extension dead bug',
      'prepare_and_access',
      'activate'
    ),
    (
      'lateral-hop-to-stick',
      'Bilateral Lateral Jump to Stick',
      'bilateral_lateral_jump_to_terminal_stick',
      ARRAY[
        'Lateral Hop to Stick',
        'Double-Leg Lateral Jump and Stick',
        'Bilateral Lateral Hop to Stick',
        'Two-Foot Lateral Jump to Stick'
      ]::TEXT[],
      'From a declared two-foot stance, load both legs, project laterally to a declared line or zone, land on both whole feet at the same time, absorb quietly with controlled foot-knee-hip-pelvis-trunk alignment, hold without an extra hop or step, and fully reset.',
      ARRAY['jump', 'land', 'brace']::TEXT[],
      ARRAY['foot', 'ankle', 'knee', 'hip', 'core', 'spine']::TEXT[],
      ARRAY['none']::TEXT[],
      ARRAY['cones']::TEXT[],
      '{
        "primaryMuscles":[
          "gluteus_maximus",
          "gluteus_medius_and_minimus",
          "quadriceps",
          "hamstrings",
          "gastrocnemius_and_soleus"
        ],
        "secondaryMuscles":[
          "hip_adductors_and_rotators",
          "tibialis_anterior",
          "fibularis_group",
          "intrinsic_foot_muscles",
          "abdominal_wall",
          "spinal_stabilizers"
        ],
        "joints":["foot","ankle","knee","hip","pelvis","spine"],
        "jointActions":[
          "bilateral_ankle_knee_and_hip_flexion_during_load",
          "bilateral_plantarflexion_knee_extension_and_hip_extension_during_takeoff",
          "lateral_projection",
          "bilateral_hip_knee_and_ankle_flexion_during_landing_absorption",
          "frontal_and_transverse_plane_alignment_control"
        ],
        "planes":["frontal","sagittal_absorption","transverse_stabilization"],
        "laterality":"bilateral_two_foot_takeoff_and_bilateral_two_foot_landing"
      }'::JSONB,
      '{
        "surface":"level_high_traction_surface_with_declared_footwear_policy",
        "target":"declared_high_contrast_line_or_landing_zone",
        "direction":"declared_left_or_right",
        "distance":"declared_and_repeatable",
        "landingAndFallSpace":"clear_beyond_target",
        "traffic":"one_athlete_per_marked_lateral_lane",
        "lighting":"both_feet_target_landing_and_trunk_visible",
        "coachSightline":"takeoff_flight_bilateral_contact_alignment_hold_and_reset_visible"
      }'::JSONB,
      '{
        "readiness":[
          "pain_free_bilateral_takeoff_and_landing",
          "can_squat_snap_down_and_hold",
          "can_land_both_whole_feet_simultaneously",
          "can_control_foot_knee_hip_pelvis_and_trunk_alignment",
          "can_follow_direction_distance_hold_reset_and_stop_instructions"
        ],
        "contraindicationFlags":[
          "current_lower_limb_or_back_pain_swelling_or_instability",
          "numbness_dizziness_or_neurologic_symptoms",
          "uncontrolled_valgus_trunk_motion_or_split_landing",
          "unsafe_surface_target_space_visibility_or_traffic",
          "unassessed_recent_injury_surgery_or_rehabilitation_restriction"
        ],
        "selectionBoundary":"Select exact direction, distance, target, hold, intent, contacts, and rest from current readiness; exercise cards do not carry skill levels."
      }'::JSONB,
      '{
        "primaryCue":"Both feet load, push sideways, land together on whole feet, absorb quiet, hold, reset.",
        "selfChecks":[
          "I take off from both feet.",
          "Both whole feet land together at the target.",
          "My knees track with my feet and my trunk stays controlled.",
          "I can freeze without a step or extra hop."
        ],
        "painGuidance":"Stop for pain, swelling, numbness, dizziness, instability, target miss, split or loud landing, extra contact, or failed hold.",
        "accessibility":[
          "shorter_distance",
          "wider_high_contrast_zone",
          "snap_down_or_step_to_stick_rehearsal",
          "fewer_contacts",
          "longer_rest",
          "plain_text_image_audio_or_live_instruction"
        ]
      }'::JSONB,
      '{
        "primaryCues":[
          "Two feet load.",
          "Push the floor sideways.",
          "Two whole feet land together.",
          "Knees follow toes.",
          "Quiet hold, then reset."
        ],
        "qualityGate":"Count only a two-foot takeoff, declared lateral target, simultaneous two-foot whole-foot landing, controlled alignment, stable hold, and full reset without symptoms or extra contact.",
        "observationPriorities":[
          "bilateral_takeoff",
          "lateral_projection_and_target",
          "simultaneous_whole_foot_contact_and_landing_sound",
          "foot_knee_hip_pelvis_and_trunk_alignment",
          "hold_extra_contact_and_full_reset"
        ],
        "immediateStop":[
          "symptoms_instability_or_apprehension",
          "unsafe_surface_target_lane_visibility_or_traffic",
          "target_miss_split_partial_foot_or_loud_landing",
          "valgus_trunk_loss_extra_hop_step_failed_hold_or_output_decline"
        ],
        "recordAfterSet":[
          "variant_direction_distance_and_target",
          "quality_repetitions_and_rest",
          "landing_symmetry_alignment_hold_or_extra_contact_errors",
          "symptoms_stop_reason_and_substitution"
        ]
      }'::JSONB,
      '{
        "selectionInputs":[
          "training_intent",
          "symptoms_and_readiness",
          "direction_distance_and_target",
          "hold_and_reset",
          "available_time",
          "weekly_jump_landing_frontal_plane_and_tendon_budgets"
        ],
        "substitutionPolicy":{
          "mustPreserve":[
            "lateral_projection_or_explicit_regression",
            "bilateral_takeoff_and_landing",
            "terminal_control_and_full_reset"
          ],
          "neverSilent":[
            "bilateral_to_single_leg_or_contralateral_landing",
            "discrete_stick_to_continuous_rebound",
            "floor_target_to_hurdle_or_box",
            "planned_to_reactive",
            "bodyweight_to_external_load",
            "symptom_related_change"
          ]
        },
        "feedbackCapture":[
          "quality_repetitions",
          "distance_or_target_error",
          "contact_alignment_or_hold_error",
          "surface_or_lane_issue",
          "symptoms",
          "substitution_reason",
          "coach_override"
        ]
      }'::JSONB,
      'bilateral-lateral-jump-stick-boundary-v1',
      80,
      70,
      40,
      'Bilateral two-foot lateral jump to simultaneous two-foot terminal stick with exact distance, target, hold, contact budget, and full reset.',
      'Declare direction, distance, target, hold, repetitions, rest, and stop signal. Load both feet, jump sideways, land on both whole feet together, absorb quietly, hold, and reset.',
      'Observe two-foot takeoff, lateral projection, target, simultaneous whole-foot landing, alignment, landing sound, hold, reset, symptoms, and stop response.',
      'Load both feet, jump sideways, land together, absorb quiet, hold, reset.',
      'Bilateral lateral jump to terminal stick',
      'resilience',
      'landing_braking_control'
    ),
    (
      'medicine-ball-countermovement-throw',
      'Countermovement Medicine-Ball Chest Pass',
      'forward_countermovement_medicine_ball_chest_projection',
      ARRAY[
        'Medicine Ball Countermovement Throw',
        'Med Ball Countermovement Throw',
        'Countermovement Medicine Ball Chest Throw',
        'Squat to Medicine-Ball Chest Pass'
      ]::TEXT[],
      'Face an inspected wall or trained partner with one exact medicine ball held at the chest. Use the declared bilateral shallow or squat countermovement, drive through the feet and hips, keep the trunk organized, project the ball forward from the chest with two hands, finish with declared contacts, wait for the return path to clear, retrieve or receive only as prescribed, and fully reset.',
      ARRAY['squat', 'push', 'brace']::TEXT[],
      ARRAY['foot', 'ankle', 'knee', 'hip', 'core', 'spine', 'shoulder', 'elbow', 'wrist']::TEXT[],
      ARRAY['medicine_ball', 'wall']::TEXT[],
      ARRAY[]::TEXT[],
      '{
        "primaryMuscles":[
          "gluteus_maximus",
          "quadriceps",
          "pectoralis_major",
          "triceps_brachii",
          "anterior_deltoid"
        ],
        "secondaryMuscles":[
          "hamstrings",
          "gastrocnemius_and_soleus",
          "abdominal_wall",
          "spinal_stabilizers",
          "serratus_anterior",
          "forearm_and_hand_muscles"
        ],
        "joints":["foot","ankle","knee","hip","pelvis","spine","shoulder","elbow","wrist","hand"],
        "jointActions":[
          "bilateral_hip_and_knee_flexion_to_extension",
          "ankle_plantarflexion",
          "trunk_force_transfer_and_anti_extension",
          "shoulder_horizontal_adduction",
          "elbow_extension",
          "wrist_and_hand_release"
        ],
        "planes":["sagittal","transverse_stabilization"],
        "laterality":"bilateral_two_hand_forward_projection"
      }'::JSONB,
      '{
        "surface":"level_high_traction_surface",
        "ball":"intact_declared_type_mass_diameter_and_rebound_behavior",
        "target":"inspected_forward_wall_or_trained_partner",
        "wall":"rated_for_medicine_ball_impact",
        "distance":"declared_safe_release_and_return_distance",
        "returnPolicy":"throw_only_or_trained_catch_declared_before_set",
        "clearance":"forward_release_return_and_retrieval_paths_clear",
        "traffic":"one_active_thrower_per_marked_lane",
        "lighting":"ball_body_target_contacts_and_return_visible",
        "coachSightline":"preload_release_contacts_finish_target_and_return_visible"
      }'::JSONB,
      '{
        "readiness":[
          "pain_free_squat_or_shallow_countermovement",
          "pain_free_two_hand_chest_release",
          "can_control_ribs_pelvis_and_foot_contacts",
          "can_follow_target_return_retrieval_and_stop_instructions"
        ],
        "contraindicationFlags":[
          "current_lower_body_shoulder_elbow_wrist_hand_or_back_pain",
          "dizziness_pressure_or_neurologic_symptoms",
          "unsafe_ball_wall_partner_lane_or_return_path",
          "uncontrolled_trunk_extension_balance_or_release",
          "unassessed_recent_injury_surgery_or_rehabilitation_restriction"
        ],
        "selectionBoundary":"Select exact ball, mass, preload, target, contacts, attempts, rest, and return policy from current readiness; exercise cards do not carry skill levels."
      }'::JSONB,
      '{
        "primaryCue":"Ball at chest, dip as declared, drive through the floor, pass forward fast, finish, wait, reset.",
        "selfChecks":[
          "I use the declared bilateral preload.",
          "The ball leaves forward from my chest.",
          "My ribs and pelvis stay organized.",
          "I finish balanced and wait before retrieval or catch."
        ],
        "painGuidance":"Stop for symptoms, balance loss, trunk extension, target miss, unexpected contact, unsafe rebound or partner, damaged ball, or material speed loss.",
        "accessibility":[
          "lighter_or_softer_ball",
          "shallower_countermovement",
          "throw_only_without_catch",
          "larger_high_contrast_target",
          "fewer_attempts",
          "longer_rest",
          "plain_text_image_audio_or_live_instruction"
        ]
      }'::JSONB,
      '{
        "primaryCues":[
          "Ball starts at chest.",
          "Bilateral dip.",
          "Drive from the floor.",
          "Pass straight forward.",
          "Finish, wait, reset."
        ],
        "qualityGate":"Count only throws with the exact ball, bilateral preload, organized trunk, forward chest release, declared contacts, target accuracy, balanced finish, safe return behavior, and full reset.",
        "observationPriorities":[
          "ball_mass_and_start",
          "bilateral_preload_and_ground_up_drive",
          "rib_pelvis_control",
          "forward_chest_release_and_target",
          "foot_contacts_finish_return_and_reset"
        ],
        "immediateStop":[
          "symptoms_or_apprehension",
          "ball_wall_partner_lane_or_return_failure",
          "trunk_extension_balance_contact_or_release_error",
          "target_accuracy_or_output_decline"
        ],
        "recordAfterSet":[
          "variant_ball_mass_target_and_contacts",
          "attempts_rest_and_output_measure",
          "accuracy_finish_or_return_errors",
          "symptoms_stop_reason_and_substitution"
        ]
      }'::JSONB,
      '{
        "selectionInputs":[
          "training_intent",
          "symptoms_and_readiness",
          "ball_type_and_mass",
          "preload_target_contacts_and_return_policy",
          "attempts_rest_and_available_time",
          "weekly_throw_upper_body_lower_body_and_trunk_power_budgets"
        ],
        "substitutionPolicy":{
          "mustPreserve":[
            "forward_two_hand_chest_projection",
            "declared_bilateral_countermovement",
            "high_intent_with_full_reset"
          ],
          "neverSilent":[
            "forward_to_rotational_overhead_vertical_or_slam_projection",
            "throw_only_to_reactive_catch",
            "stationary_to_jump_or_step",
            "ball_mass_change_when_measuring_output",
            "symptom_related_change"
          ]
        },
        "feedbackCapture":[
          "valid_attempts",
          "output_or_accuracy",
          "contact_finish_or_return_error",
          "symptoms",
          "substitution_reason",
          "coach_override"
        ]
      }'::JSONB,
      'countermovement-medicine-ball-projection-boundary-v1',
      78,
      68,
      40,
      'Bilateral countermovement medicine-ball chest pass with exact ball, preload, forward target, contacts, return policy, output budget, and full reset.',
      'Declare ball, mass, shallow or squat countermovement, forward wall target, contacts, attempts, rest, return policy, and stop signal. Dip, drive, pass forward from the chest, finish, wait, and reset.',
      'Observe ball and start, bilateral preload, ground-up drive, ribs and pelvis, forward chest release, contacts, target, return, output, symptoms, and stop response.',
      'Ball at chest, dip, drive, pass forward fast, finish, wait, reset.',
      'Forward countermovement medicine-ball chest projection',
      'output',
      'jump_throw_explosive_power'
    ),
    (
      'med-ball-countermovement-rotational-throw',
      'Countermovement Rotational Medicine-Ball Throw',
      'countermovement_rotational_medicine_ball_projection',
      ARRAY[
        'Med Ball Countermovement Rotational Throw',
        'Medicine Ball Countermovement Rotational Throw',
        'Countermovement Rotational Med Ball Throw',
        'Rotational Countermovement Wall Throw'
      ]::TEXT[],
      'Stand side-on to an inspected wall with one exact medicine ball and a declared throwing side. Use the declared fixed-stance or pivot-allowed rotational countermovement, sequence force from feet through hips, pelvis, trunk, shoulders, arms, and ball, release transversely to the declared wall target, finish under control, wait for the return path, retrieve without crossing an active lane, and fully reset.',
      ARRAY['rotate', 'push', 'brace']::TEXT[],
      ARRAY['foot', 'ankle', 'knee', 'hip', 'core', 'spine', 'shoulder', 'elbow', 'wrist']::TEXT[],
      ARRAY['medicine_ball', 'wall']::TEXT[],
      ARRAY[]::TEXT[],
      '{
        "primaryMuscles":[
          "gluteus_maximus",
          "hip_rotators",
          "internal_and_external_obliques",
          "pectoralis_major",
          "serratus_anterior"
        ],
        "secondaryMuscles":[
          "quadriceps",
          "hamstrings",
          "gastrocnemius_and_soleus",
          "spinal_stabilizers",
          "deltoids",
          "triceps_brachii",
          "forearm_and_hand_muscles"
        ],
        "joints":["foot","ankle","knee","hip","pelvis","spine","shoulder","elbow","wrist","hand"],
        "jointActions":[
          "declared_hip_and_knee_flexion_to_extension",
          "foot_and_hip_pivot_when_declared",
          "hip_pelvis_and_thoracic_rotation",
          "trunk_force_transfer_with_lumbar_control",
          "shoulder_horizontal_adduction_and_rotation",
          "elbow_extension",
          "wrist_and_hand_release"
        ],
        "planes":["transverse","frontal_stabilization","sagittal_preload"],
        "laterality":"declared_side_specific_two_hand_rotational_projection"
      }'::JSONB,
      '{
        "surface":"level_high_traction_surface",
        "ball":"intact_declared_type_mass_diameter_and_rebound_behavior",
        "target":"inspected_side_wall_target",
        "wall":"rated_for_medicine_ball_impact",
        "distance":"declared_safe_release_and_return_distance",
        "returnPolicy":"throw_only_and_retrieve_unless_trained_catch_is_explicit",
        "clearance":"rotation_release_return_and_retrieval_paths_clear",
        "traffic":"one_active_thrower_per_marked_side_wall_lane",
        "lighting":"ball_body_target_feet_and_return_visible",
        "coachSightline":"preload_sequence_release_contacts_finish_target_and_return_visible"
      }'::JSONB,
      '{
        "readiness":[
          "pain_free_rotational_preload_and_release",
          "can_rotate_through_feet_hips_pelvis_and_thoracic_spine_without_forced_lumbar_twist",
          "can_control_ribs_pelvis_foot_contacts_and_finish",
          "can_follow_side_target_return_retrieval_and_stop_instructions"
        ],
        "contraindicationFlags":[
          "current_lower_body_shoulder_elbow_wrist_hand_or_back_pain",
          "dizziness_pressure_or_neurologic_symptoms",
          "unsafe_ball_wall_lane_or_return_path",
          "uncontrolled_lumbar_rotation_balance_or_release",
          "unassessed_recent_injury_surgery_or_rehabilitation_restriction"
        ],
        "selectionBoundary":"Select exact ball, mass, side, stance, pivot, preload, target, contacts, attempts, rest, and return policy from current readiness; exercise cards do not carry skill levels."
      }'::JSONB,
      '{
        "primaryCue":"Load away, drive from the floor, rotate through hips and trunk, throw across, finish, wait, reset.",
        "selfChecks":[
          "I use the declared side, stance, and pivot rule.",
          "My feet and hips start the rotation.",
          "The ball leaves transversely toward the side wall target.",
          "I finish balanced and wait before retrieval."
        ],
        "painGuidance":"Stop for symptoms, forced low-back twist, balance loss, target miss, unexpected contact, unsafe rebound, damaged ball, or material speed loss.",
        "accessibility":[
          "lighter_or_softer_ball",
          "smaller_rotational_preload",
          "fixed_stance_no_pivot",
          "larger_high_contrast_target",
          "fewer_attempts",
          "longer_rest",
          "plain_text_image_audio_or_live_instruction"
        ]
      }'::JSONB,
      '{
        "primaryCues":[
          "Declare the side.",
          "Load away.",
          "Feet and hips lead.",
          "Throw across the target.",
          "Finish, wait, reset."
        ],
        "qualityGate":"Count only throws with the exact ball, side, stance and pivot, organized ground-up sequence, transverse target, controlled lumbar contribution, declared contacts, balanced finish, safe return behavior, and full reset.",
        "observationPriorities":[
          "ball_side_stance_and_preload",
          "foot_hip_pelvis_trunk_sequence",
          "lumbar_control",
          "transverse_release_and_target",
          "contacts_finish_return_and_reset"
        ],
        "immediateStop":[
          "symptoms_or_apprehension",
          "ball_wall_lane_or_return_failure",
          "forced_lumbar_rotation_balance_contact_or_release_error",
          "target_accuracy_or_output_decline"
        ],
        "recordAfterSet":[
          "variant_ball_mass_side_target_and_contacts",
          "attempts_rest_and_output_measure",
          "sequence_accuracy_finish_or_return_errors",
          "symptoms_stop_reason_and_substitution"
        ]
      }'::JSONB,
      '{
        "selectionInputs":[
          "training_intent",
          "symptoms_and_readiness",
          "ball_type_and_mass",
          "side_stance_pivot_preload_target_contacts_and_return_policy",
          "attempts_rest_and_available_time",
          "weekly_rotational_throw_upper_body_lower_body_and_trunk_power_budgets"
        ],
        "substitutionPolicy":{
          "mustPreserve":[
            "side_specific_transverse_projection",
            "declared_rotational_countermovement",
            "ground_up_sequence_and_full_reset"
          ],
          "neverSilent":[
            "rotational_to_forward_overhead_vertical_or_slam_projection",
            "fixed_stance_to_pivot_step_or_shuffle",
            "throw_only_to_reactive_catch",
            "ball_mass_change_when_measuring_output",
            "symptom_related_change"
          ]
        },
        "feedbackCapture":[
          "valid_attempts_per_side",
          "output_or_accuracy",
          "sequence_contact_finish_or_return_error",
          "symptoms",
          "substitution_reason",
          "coach_override"
        ]
      }'::JSONB,
      'countermovement-medicine-ball-projection-boundary-v1',
      80,
      70,
      40,
      'Side-specific countermovement rotational medicine-ball wall throw with exact ball, stance, pivot, preload, target, contacts, return policy, output budget, and full reset.',
      'Declare ball, mass, throwing side, fixed stance or pivot, rotational countermovement, side-wall target, contacts, attempts, rest, return policy, and stop signal. Load away, drive and rotate from the floor, throw across, finish, wait, and reset.',
      'Observe ball, side, stance and pivot, preload, ground-up sequence, lumbar control, transverse release, contacts, target, return, output, symptoms, and stop response.',
      'Load away, drive from the floor, rotate through hips and trunk, throw across, finish, wait, reset.',
      'Countermovement rotational medicine-ball projection',
      'output',
      'jump_throw_explosive_power'
    );

  UPDATE coaching.exercise_variant_v1
  SET variant_key = 'legacy-generic-baseline',
      display_name = 'Legacy Generic Baseline',
      status = 'archived',
      requirements_json = requirements_json || jsonb_build_object(
        'selectable', FALSE,
        'identityQuarantine', TRUE,
        'quarantineReason',
          'The legacy baseline does not declare the exact movement, constraint, laterality, range, target, return, dosage, logistics, or stop contract.'
      ),
      updated_at = now()
  WHERE definition_id = ANY(target_ids)
    AND variant_key = 'baseline';

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET status = 'archived',
      updated_at = now()
  FROM coaching.exercise_variant_v1 variant
  WHERE variant.id = profile.variant_id
    AND variant.definition_id = ANY(target_ids)
    AND variant.status = 'archived';

  UPDATE coaching.exercise_definition_v1 definition
  SET canonical_name = seed.canonical_name,
      display_name = seed.canonical_name,
      aliases = (
        SELECT ARRAY_AGG(DISTINCT alias_value ORDER BY alias_value)
        FROM unnest(
          definition.aliases
          || seed.aliases
          || ARRAY[definition.canonical_name, definition.display_name]::TEXT[]
        ) AS alias_value
        WHERE btrim(alias_value) <> ''
          AND lower(btrim(alias_value)) <> lower(seed.canonical_name)
      ),
      description = seed.description,
      family_key = seed.family_key,
      card_version = greatest(definition.card_version, 2),
      status = 'review',
      content_confidence = seed.content_confidence,
      scoring_confidence = seed.scoring_confidence,
      media_confidence = seed.media_confidence,
      movement_patterns = seed.movement_patterns,
      body_regions = seed.body_regions,
      required_equipment = seed.required_equipment,
      optional_equipment = seed.optional_equipment,
      environment_json = seed.environment_json,
      population_json = seed.population_json,
      anatomy_json = seed.anatomy_json,
      athlete_support_json = seed.athlete_support_json,
      coach_support_json = seed.coach_support_json,
      support_operations_json = seed.support_operations_json,
      approved_video_url = NULL,
      reviewed_by = NULL,
      approved_by = NULL,
      last_reviewed_at = NULL,
      provenance_json = definition.provenance_json || jsonb_build_object(
        'researchBatch', seed.research_batch,
        'researchVersion', '2026-07-26.42',
        'structuralCompletionMigration', migration_key,
        'difficultyModel',
          'max_exercise_complexity_physical_difficulty',
        'humanReviewRequired', TRUE,
        'publicationQuarantined', TRUE,
        'mediaApprovalCreated', FALSE,
        'graphApprovalCreated', FALSE,
        'calibrationApprovalCreated', FALSE
      ),
      updated_at = now()
  FROM boundary_definition_seed seed
  WHERE definition.slug = seed.slug
    AND definition.id = ANY(target_ids);

  CREATE TEMP TABLE boundary_variant_seed (
    slug TEXT NOT NULL,
    variant_key TEXT NOT NULL,
    display_name TEXT NOT NULL,
    modifier_keys TEXT[] NOT NULL,
    technical_complexity SMALLINT NOT NULL,
    physical_difficulty SMALLINT NOT NULL,
    supervision_demand SMALLINT NOT NULL,
    failure_consequence SMALLINT NOT NULL,
    impact SMALLINT NOT NULL,
    work_capacity SMALLINT NOT NULL,
    requirements_json JSONB NOT NULL,
    load_profile_json JSONB NOT NULL,
    fatigue_profile_json JSONB NOT NULL,
    programming_profile_json JSONB NOT NULL,
    phase_key TEXT NOT NULL,
    purpose TEXT NOT NULL,
    dosage_json JSONB NOT NULL,
    quality_gate TEXT NOT NULL,
    stop_rules TEXT[] NOT NULL,
    coach_instructions TEXT NOT NULL,
    athlete_instructions TEXT NOT NULL,
    expected_adaptation TEXT NOT NULL,
    equipment_required TEXT[] NOT NULL,
    logistics_json JSONB NOT NULL,
    time_model_json JSONB NOT NULL,
    dose_scaling_json JSONB NOT NULL,
    measurement_json JSONB NOT NULL,
    PRIMARY KEY (slug, variant_key)
  ) ON COMMIT DROP;

  INSERT INTO boundary_variant_seed VALUES
    (
      'dead-bug-wall-press',
      'alternating-heel-tap',
      'Dead Bug Wall Press — Alternating Heel Tap',
      ARRAY['alternating', 'heel_tap', 'bilateral_wall_press']::TEXT[],
      26, 22, 20, 18, 5, 20,
      '{
        "selectable":true,
        "pressContract":"both_hands_continuously_press_fixed_wall",
        "legAction":"one_declared_heel_tap_at_a_time",
        "returnContract":"same_tabletop_start",
        "tempo":"declared_slow_controlled"
      }'::JSONB,
      '{
        "loadingType":"bodyweight_with_bilateral_wall_press_isometric",
        "externalLoadMethod":"bodyweight_and_fixed_wall_isometric",
        "gripDemand":2,
        "spinalLoading":8,
        "eccentricStress":14,
        "landingContactsPerRep":0,
        "primaryStress":[
          "abdominal_anti_extension",
          "bilateral_shoulder_extension_isometric",
          "alternating_hip_control"
        ]
      }'::JSONB,
      '{
        "localMuscleFatigue":22,
        "gripFatigue":2,
        "technicalFatigueSensitivity":34,
        "impactAccumulation":1,
        "recoveryHours":8,
        "failureSignals":[
          "wall_press_loss",
          "rib_flare_or_lumbar_arch",
          "heel_tap_range_or_return_error",
          "breath_or_neck_compensation"
        ]
      }'::JSONB,
      '{
        "trainingIntent":"low_fatigue_anti_extension_activation",
        "identityRule":"both_hands_press_fixed_wall_and_one_heel_taps",
        "difficultyModel":"max_exercise_complexity_physical_difficulty",
        "fatigueBudgetKeys":["trunk_control","hip_flexor","shoulder_isometric"],
        "impactBudgetPerRep":0,
        "cumulativeBudgetRule":"stop_before_press_posture_breath_or_range_changes"
      }'::JSONB,
      'prepare_and_access',
      'Create low-fatigue anti-extension control with a fixed wall constraint before higher-cost work.',
      '{"sets":2,"repsPerSide":[4,8],"tempo":"3_seconds_out_1_pause_2_return","restSeconds":[20,45],"fullReset":true}'::JSONB,
      'Both hands maintain wall pressure while ribs and pelvis stay controlled, one heel reaches the declared target, breath continues, and the leg returns to the same start.',
      ARRAY[
        'Stop for pain, numbness, dizziness, pressure symptoms, or breath panic.',
        'Stop when wall pressure, rib-pelvis control, declared range, tempo, or return fails.',
        'Stop when neck tension or hip-flexor fatigue replaces trunk control.'
      ]::TEXT[],
      'Set head distance and tabletop position, confirm wall integrity, declare heel target and tempo, observe from the side, and count only repeatable press-posture-breath reps.',
      'Press both hands into the wall. Keep ribs and pelvis quiet. Tap one heel, exhale, return, then change sides.',
      'Improved low-threat anti-extension organization, leg dissociation, and breathing under a fixed upper-body constraint.',
      ARRAY['wall']::TEXT[],
      '{"participants":1,"station":"padded_floor_at_fixed_wall","coachPosition":"side_or_oblique","fullResetRequired":true,"sharedStationRule":"one_athlete_per_wall_segment"}'::JSONB,
      '{"setupSeconds":30,"secondsPerRep":6,"transitionSeconds":10,"restIncluded":true,"durationFormula":"setup_plus_sets_times_reps_six_seconds_plus_rest"}'::JSONB,
      '{"regress":["shorter_heel_path","fewer_reps","longer_rest"],"progress":["longer_leg_extension","slower_eccentric"],"changeOneVariableAtATime":true}'::JSONB,
      '{"unit":"quality_repetitions_per_side","record":["heel_target","press_continuity","rib_pelvis_error","breath_error","symptoms"]}'::JSONB
    ),
    (
      'dead-bug-wall-press',
      'alternating-leg-extension',
      'Dead Bug Wall Press — Alternating Leg Extension',
      ARRAY['alternating', 'leg_extension', 'bilateral_wall_press']::TEXT[],
      34, 28, 24, 22, 5, 28,
      '{
        "selectable":true,
        "pressContract":"both_hands_continuously_press_fixed_wall",
        "legAction":"one_declared_leg_extension_at_a_time",
        "returnContract":"same_tabletop_start",
        "tempo":"declared_slow_controlled"
      }'::JSONB,
      '{
        "loadingType":"bodyweight_longer_lever_with_bilateral_wall_press_isometric",
        "externalLoadMethod":"bodyweight_and_fixed_wall_isometric",
        "gripDemand":2,
        "spinalLoading":12,
        "eccentricStress":20,
        "landingContactsPerRep":0,
        "primaryStress":[
          "abdominal_anti_extension",
          "bilateral_shoulder_extension_isometric",
          "longer_lever_hip_control"
        ]
      }'::JSONB,
      '{
        "localMuscleFatigue":30,
        "gripFatigue":2,
        "technicalFatigueSensitivity":44,
        "impactAccumulation":1,
        "recoveryHours":12,
        "failureSignals":[
          "wall_press_loss",
          "rib_flare_or_lumbar_arch",
          "leg_extension_range_or_return_error",
          "breath_neck_or_hip_flexor_compensation"
        ]
      }'::JSONB,
      '{
        "trainingIntent":"controlled_anti_extension_capacity",
        "identityRule":"both_hands_press_fixed_wall_and_one_leg_extends",
        "difficultyModel":"max_exercise_complexity_physical_difficulty",
        "fatigueBudgetKeys":["trunk_control","hip_flexor","shoulder_isometric"],
        "impactBudgetPerRep":0,
        "cumulativeBudgetRule":"stop_before_press_posture_breath_range_or_return_changes"
      }'::JSONB,
      'prepare_and_access',
      'Increase controlled anti-extension range while retaining a low-cost fixed-wall constraint.',
      '{"sets":2,"repsPerSide":[4,6],"tempo":"3_seconds_out_1_pause_2_return","restSeconds":[30,60],"fullReset":true}'::JSONB,
      'Both hands maintain wall pressure while ribs and pelvis stay controlled through the declared leg extension, breath continues, and the leg returns without momentum.',
      ARRAY[
        'Stop for pain, numbness, dizziness, pressure symptoms, or breath panic.',
        'Stop when wall pressure, rib-pelvis control, declared extension, tempo, or return fails.',
        'Stop when neck tension or hip-flexor fatigue replaces trunk control.'
      ]::TEXT[],
      'Declare exact leg-extension range and tempo, confirm the heel path is clear, observe the side view, and shorten range immediately when ribs, pelvis, wall pressure, or breath changes.',
      'Press the wall. Extend one leg only as far as ribs and pelvis stay quiet. Exhale, return, then change sides.',
      'Greater anti-extension control and leg dissociation through a longer lever without meaningful impact.',
      ARRAY['wall']::TEXT[],
      '{"participants":1,"station":"padded_floor_at_fixed_wall","coachPosition":"side_or_oblique","fullResetRequired":true,"sharedStationRule":"one_athlete_per_wall_segment"}'::JSONB,
      '{"setupSeconds":30,"secondsPerRep":7,"transitionSeconds":10,"restIncluded":true,"durationFormula":"setup_plus_sets_times_reps_seven_seconds_plus_rest"}'::JSONB,
      '{"regress":["heel_tap","shorter_extension","fewer_reps","longer_rest"],"progress":["longer_owned_range","slower_eccentric"],"changeOneVariableAtATime":true}'::JSONB,
      '{"unit":"quality_repetitions_per_side","record":["extension_range","press_continuity","rib_pelvis_error","breath_error","symptoms"]}'::JSONB
    ),
    (
      'medicine-ball-dead-bug-press',
      'single-free-limb-control',
      'Medicine-Ball Dead Bug Press — Single Free-Limb Control',
      ARRAY['contralateral_ball_press', 'single_free_limb']::TEXT[],
      32, 26, 26, 22, 5, 22,
      '{
        "selectable":true,
        "pressContract":"declared_hand_and_opposite_knee_press_medicine_ball",
        "freeLimbAction":"one_declared_free_arm_or_leg_moves",
        "returnContract":"same_tabletop_and_ball_press_start"
      }'::JSONB,
      '{
        "loadingType":"bodyweight_with_contralateral_ball_compression_isometric",
        "externalLoadMethod":"medicine_ball_compression_between_hand_and_opposite_knee",
        "gripDemand":8,
        "spinalLoading":10,
        "eccentricStress":16,
        "landingContactsPerRep":0,
        "primaryStress":[
          "abdominal_anti_extension",
          "contralateral_hand_knee_compression",
          "single_free_limb_dissociation"
        ]
      }'::JSONB,
      '{
        "localMuscleFatigue":26,
        "gripFatigue":6,
        "technicalFatigueSensitivity":42,
        "impactAccumulation":1,
        "recoveryHours":10,
        "failureSignals":[
          "ball_press_or_position_loss",
          "rib_flare_or_lumbar_arch",
          "free_limb_path_or_return_error",
          "breath_or_neck_compensation"
        ]
      }'::JSONB,
      '{
        "trainingIntent":"contralateral_press_anti_extension_activation",
        "identityRule":"ball_remains_between_declared_hand_and_opposite_knee_while_one_free_limb_moves",
        "difficultyModel":"max_exercise_complexity_physical_difficulty",
        "fatigueBudgetKeys":["trunk_control","hip_flexor","shoulder_and_ball_press"],
        "impactBudgetPerRep":0,
        "cumulativeBudgetRule":"stop_before_ball_press_posture_breath_or_free_limb_path_changes"
      }'::JSONB,
      'prepare_and_access',
      'Establish the contralateral ball-press constraint with a single moving limb before combined arm-leg extension.',
      '{"sets":2,"repsPerSide":[4,8],"tempo":"3_seconds_out_1_pause_2_return","restSeconds":[20,45],"fullReset":true}'::JSONB,
      'The ball remains compressed between the declared hand and opposite knee while ribs and pelvis stay controlled, only the declared free limb moves, breath continues, and the start is recovered.',
      ARRAY[
        'Stop for pain, numbness, dizziness, pressure symptoms, or breath panic.',
        'Stop when the ball slips or press, rib-pelvis control, free-limb path, or return fails.',
        'Stop when neck tension or hip-flexor fatigue replaces trunk control.'
      ]::TEXT[],
      'Choose an intact ball that fits the athlete, declare pressing hand and opposite knee plus the one free limb, observe ball pressure and trunk position, and switch sides only after a full reset.',
      'Squeeze the ball with hand and opposite knee. Move one free limb, exhale, return, then reset the side.',
      'Improved contralateral trunk organization and limb dissociation under a movable press constraint.',
      ARRAY['medicine_ball']::TEXT[],
      '{"participants":1,"station":"padded_floor_with_clean_ball","coachPosition":"side_or_oblique","fullResetRequired":true,"sharedStationRule":"one_ball_and_floor_space_per_athlete"}'::JSONB,
      '{"setupSeconds":35,"secondsPerRep":6,"transitionSeconds":15,"restIncluded":true,"durationFormula":"setup_plus_sets_times_reps_six_seconds_plus_side_change_and_rest"}'::JSONB,
      '{"regress":["shorter_free_limb_path","lighter_or_larger_ball","fewer_reps","longer_rest"],"progress":["combined_free_arm_leg_extension","longer_owned_range"],"changeOneVariableAtATime":true}'::JSONB,
      '{"unit":"quality_repetitions_per_side","record":["ball_and_pressing_side","free_limb","range","press_or_position_error","symptoms"]}'::JSONB
    ),
    (
      'medicine-ball-dead-bug-press',
      'contralateral-arm-leg-extension',
      'Medicine-Ball Dead Bug Press — Contralateral Arm-Leg Extension',
      ARRAY['contralateral_ball_press', 'opposite_arm_leg_extension']::TEXT[],
      40, 30, 32, 28, 5, 30,
      '{
        "selectable":true,
        "pressContract":"declared_hand_and_opposite_knee_press_medicine_ball",
        "freeLimbAction":"free_opposite_arm_and_leg_extend_together",
        "returnContract":"same_tabletop_and_ball_press_start"
      }'::JSONB,
      '{
        "loadingType":"bodyweight_combined_long_levers_with_contralateral_ball_compression",
        "externalLoadMethod":"medicine_ball_compression_between_hand_and_opposite_knee",
        "gripDemand":10,
        "spinalLoading":14,
        "eccentricStress":22,
        "landingContactsPerRep":0,
        "primaryStress":[
          "abdominal_anti_extension",
          "contralateral_hand_knee_compression",
          "opposite_arm_leg_coordination"
        ]
      }'::JSONB,
      '{
        "localMuscleFatigue":34,
        "gripFatigue":8,
        "technicalFatigueSensitivity":52,
        "impactAccumulation":1,
        "recoveryHours":12,
        "failureSignals":[
          "ball_press_or_position_loss",
          "rib_flare_or_lumbar_arch",
          "arm_leg_timing_or_return_error",
          "breath_neck_or_hip_flexor_compensation"
        ]
      }'::JSONB,
      '{
        "trainingIntent":"contralateral_press_anti_extension_coordination",
        "identityRule":"ball_remains_between_declared_hand_and_opposite_knee_while_free_opposite_arm_and_leg_extend",
        "difficultyModel":"max_exercise_complexity_physical_difficulty",
        "fatigueBudgetKeys":["trunk_control","hip_flexor","shoulder_and_ball_press","coordination"],
        "impactBudgetPerRep":0,
        "cumulativeBudgetRule":"stop_before_ball_press_posture_breath_timing_range_or_return_changes"
      }'::JSONB,
      'prepare_and_access',
      'Coordinate opposite arm-leg motion while maintaining a contralateral ball press and trunk control.',
      '{"sets":2,"repsPerSide":[3,6],"tempo":"3_seconds_out_1_pause_2_return","restSeconds":[30,60],"fullReset":true}'::JSONB,
      'The ball remains compressed between the declared hand and opposite knee while the free opposite arm and leg move together, ribs and pelvis stay controlled, breath continues, and both limbs return smoothly.',
      ARRAY[
        'Stop for pain, numbness, dizziness, pressure symptoms, or breath panic.',
        'Stop when the ball slips or press, rib-pelvis control, arm-leg timing, range, or return fails.',
        'Stop when neck tension or hip-flexor fatigue replaces trunk control.'
      ]::TEXT[],
      'Declare pressing side and free opposite arm-leg pair, set the exact reach, observe timing and trunk position, and regress to one free limb at the first press, breath, or position error.',
      'Squeeze the ball. Reach the free opposite arm and leg together, exhale, return together, then reset the side.',
      'Improved anti-extension control and contralateral limb coordination under a movable press constraint.',
      ARRAY['medicine_ball']::TEXT[],
      '{"participants":1,"station":"padded_floor_with_clean_ball","coachPosition":"side_or_oblique","fullResetRequired":true,"sharedStationRule":"one_ball_and_floor_space_per_athlete"}'::JSONB,
      '{"setupSeconds":35,"secondsPerRep":7,"transitionSeconds":15,"restIncluded":true,"durationFormula":"setup_plus_sets_times_reps_seven_seconds_plus_side_change_and_rest"}'::JSONB,
      '{"regress":["single_free_limb","shorter_combined_range","lighter_or_larger_ball","fewer_reps","longer_rest"],"progress":["longer_owned_range","slower_eccentric"],"changeOneVariableAtATime":true}'::JSONB,
      '{"unit":"quality_repetitions_per_side","record":["ball_and_pressing_side","combined_range","timing","press_or_position_error","symptoms"]}'::JSONB
    ),
    (
      'lateral-hop-to-stick',
      'low-amplitude-bilateral-control',
      'Bilateral Lateral Jump to Stick — Low-Amplitude Control',
      ARRAY['bilateral', 'lateral', 'low_amplitude', 'terminal_stick']::TEXT[],
      34, 34, 45, 45, 35, 30,
      '{
        "selectable":true,
        "takeoffLandingContract":"bilateral_two_foot_to_bilateral_two_foot",
        "projection":"lateral",
        "amplitude":"low_declared_distance",
        "completion":"stable_terminal_hold_and_full_reset"
      }'::JSONB,
      '{
        "loadingType":"bodyweight_ballistic_lateral_projection_and_bilateral_landing",
        "externalLoadMethod":"bodyweight",
        "gripDemand":1,
        "spinalLoading":14,
        "eccentricStress":34,
        "landingContactsPerRep":2,
        "primaryStress":[
          "bilateral_lateral_takeoff_impulse",
          "bilateral_foot_ankle_knee_and_hip_absorption",
          "frontal_plane_alignment",
          "terminal_balance_and_hold"
        ]
      }'::JSONB,
      '{
        "localMuscleFatigue":34,
        "gripFatigue":1,
        "technicalFatigueSensitivity":50,
        "impactAccumulation":35,
        "recoveryHours":24,
        "failureSignals":[
          "target_miss",
          "split_partial_foot_or_loud_landing",
          "valgus_or_trunk_loss",
          "extra_step_hop_or_failed_hold"
        ]
      }'::JSONB,
      '{
        "trainingIntent":"bilateral_lateral_landing_control",
        "identityRule":"two_feet_take_off_and_two_whole_feet_land_together_then_hold_and_reset",
        "difficultyModel":"max_exercise_complexity_physical_difficulty",
        "fatigueBudgetKeys":["jump_contacts","landing_contacts","frontal_plane","lower_leg_tendon","technical_control"],
        "impactBudgetPerRep":2,
        "cumulativeBudgetRule":"stop_before_target_contact_alignment_hold_or_output_changes"
      }'::JSONB,
      'resilience',
      'Develop bilateral lateral braking, alignment, quiet absorption, and terminal control at low amplitude.',
      '{"sets":[2,3],"repsPerDirection":[3,5],"holdSeconds":[2,3],"restSeconds":[45,75],"fullReset":true}'::JSONB,
      'Both feet take off, the body projects laterally to the declared target, both whole feet land together quietly, alignment is controlled, the hold succeeds without extra contact, and the athlete fully resets.',
      ARRAY[
        'Stop for pain, swelling, numbness, dizziness, instability, or apprehension.',
        'Stop for unsafe surface, target, landing space, visibility, or traffic.',
        'Stop on target miss, split or loud landing, alignment loss, extra contact, failed hold, or output decline.'
      ]::TEXT[],
      'Mark direction and low-amplitude target, inspect traction and landing space, observe front or oblique, and count only simultaneous two-foot landings with a stable hold and full reset.',
      'Load both feet, jump sideways a small distance, land on both whole feet together, absorb quiet, hold, reset.',
      'Improved bilateral lateral landing symmetry, braking control, alignment, and confidence.',
      ARRAY['none']::TEXT[],
      '{"participants":1,"station":"marked_lateral_lane","coachPosition":"outside_takeoff_landing_and_fall_paths","fullResetRequired":true,"sharedStationRule":"one_active_athlete_per_lane"}'::JSONB,
      '{"setupSeconds":45,"secondsPerRep":8,"transitionSeconds":15,"restIncluded":true,"durationFormula":"setup_plus_sets_times_directions_times_reps_eight_seconds_plus_rest"}'::JSONB,
      '{"regress":["shorter_distance","wider_target","snap_down_or_step_to_stick","fewer_contacts","longer_rest"],"progress":["distance_bilateral_control"],"changeOneVariableAtATime":true}'::JSONB,
      '{"unit":"quality_landings","record":["direction","distance","target_contact","landing_symmetry_and_sound","alignment","hold","symptoms"]}'::JSONB
    ),
    (
      'lateral-hop-to-stick',
      'distance-bilateral-control',
      'Bilateral Lateral Jump to Stick — Distance Control',
      ARRAY['bilateral', 'lateral', 'distance', 'terminal_stick']::TEXT[],
      40, 42, 55, 55, 55, 35,
      '{
        "selectable":true,
        "takeoffLandingContract":"bilateral_two_foot_to_bilateral_two_foot",
        "projection":"lateral",
        "amplitude":"declared_distance_high_intent",
        "completion":"stable_terminal_hold_and_full_reset"
      }'::JSONB,
      '{
        "loadingType":"bodyweight_high_intent_lateral_projection_and_bilateral_landing",
        "externalLoadMethod":"bodyweight",
        "gripDemand":1,
        "spinalLoading":18,
        "eccentricStress":46,
        "landingContactsPerRep":2,
        "primaryStress":[
          "bilateral_lateral_takeoff_impulse",
          "bilateral_foot_ankle_knee_and_hip_absorption",
          "frontal_plane_alignment",
          "higher_distance_braking_and_terminal_hold"
        ]
      }'::JSONB,
      '{
        "localMuscleFatigue":42,
        "gripFatigue":1,
        "technicalFatigueSensitivity":62,
        "impactAccumulation":55,
        "recoveryHours":36,
        "failureSignals":[
          "distance_or_speed_decline",
          "target_miss",
          "split_partial_foot_or_loud_landing",
          "valgus_trunk_loss_extra_contact_or_failed_hold"
        ]
      }'::JSONB,
      '{
        "trainingIntent":"bilateral_lateral_projection_and_braking_output",
        "identityRule":"two_feet_take_off_and_two_whole_feet_land_together_at_declared_distance_then_hold_and_reset",
        "difficultyModel":"max_exercise_complexity_physical_difficulty",
        "fatigueBudgetKeys":["jump_contacts","landing_contacts","frontal_plane","lower_leg_tendon","neural_output","technical_control"],
        "impactBudgetPerRep":2,
        "cumulativeBudgetRule":"stop_before_distance_target_contact_alignment_hold_or_output_changes"
      }'::JSONB,
      'output',
      'Express bilateral lateral distance while preserving simultaneous landing, braking, alignment, and terminal control.',
      '{"sets":[2,4],"repsPerDirection":[2,4],"holdSeconds":[2,3],"restSeconds":[60,120],"fullReset":true}'::JSONB,
      'Both feet take off with high intent, the declared distance and target are reached, both whole feet land together quietly, alignment is controlled, the hold succeeds without extra contact, and output remains repeatable.',
      ARRAY[
        'Stop for pain, swelling, numbness, dizziness, instability, or apprehension.',
        'Stop for unsafe surface, target, landing space, visibility, or traffic.',
        'Stop on distance loss, target miss, split or loud landing, alignment loss, extra contact, failed hold, or output decline.'
      ]::TEXT[],
      'Place early and fresh, declare direction and distance, control contact count and rest, observe front or oblique, and end the set at the first material distance, landing, alignment, or hold decline.',
      'Load both feet, jump sideways to the target, land together, absorb quiet, hold, reset fully before the next attempt.',
      'Improved bilateral lateral projection, braking capacity, alignment, and high-quality terminal control.',
      ARRAY['none']::TEXT[],
      '{"participants":1,"station":"marked_lateral_distance_lane","coachPosition":"outside_takeoff_landing_and_fall_paths","fullResetRequired":true,"sharedStationRule":"one_active_athlete_per_lane"}'::JSONB,
      '{"setupSeconds":45,"secondsPerRep":9,"transitionSeconds":15,"restIncluded":true,"durationFormula":"setup_plus_sets_times_directions_times_reps_nine_seconds_plus_rest"}'::JSONB,
      '{"regress":["low_amplitude_bilateral_control","shorter_distance","wider_target","fewer_contacts","longer_rest"],"progress":["greater_owned_distance_without_support_change"],"changeOneVariableAtATime":true}'::JSONB,
      '{"unit":"quality_distance_landings","record":["direction","distance","target_contact","landing_symmetry_and_sound","alignment","hold","output_loss","symptoms"]}'::JSONB
    ),
    (
      'medicine-ball-countermovement-throw',
      'shallow-countermovement-wall-pass',
      'Countermovement Medicine-Ball Chest Pass — Shallow Wall Pass',
      ARRAY['forward_chest_pass', 'shallow_countermovement', 'wall_throw_only']::TEXT[],
      38, 38, 50, 45, 10, 32,
      '{
        "selectable":true,
        "projection":"forward_horizontal_chest",
        "preload":"shallow_bilateral_countermovement",
        "contacts":"feet_remain_grounded",
        "target":"inspected_wall",
        "return":"throw_only_wait_retrieve"
      }'::JSONB,
      '{
        "loadingType":"ballistic_two_hand_forward_medicine_ball_projection",
        "externalLoadMethod":"declared_medicine_ball_mass",
        "gripDemand":20,
        "spinalLoading":20,
        "eccentricStress":22,
        "landingContactsPerRep":0,
        "primaryStress":[
          "bilateral_lower_body_preload_and_drive",
          "trunk_force_transfer",
          "chest_shoulder_and_elbow_ballistic_push",
          "ball_control_and_retrieval"
        ]
      }'::JSONB,
      '{
        "localMuscleFatigue":34,
        "gripFatigue":18,
        "technicalFatigueSensitivity":58,
        "impactAccumulation":8,
        "recoveryHours":24,
        "failureSignals":[
          "ball_speed_or_accuracy_loss",
          "trunk_extension_or_balance_loss",
          "release_or_contact_error",
          "unsafe_return_or_retrieval"
        ]
      }'::JSONB,
      '{
        "trainingIntent":"forward_full_body_chest_pass_power",
        "identityRule":"bilateral_shallow_countermovement_then_two_hand_forward_chest_projection_to_wall",
        "difficultyModel":"max_exercise_complexity_physical_difficulty",
        "fatigueBudgetKeys":["medicine_ball_throws","upper_body_power","lower_body_power","trunk_power","technical_output"],
        "impactBudgetPerRep":0,
        "cumulativeBudgetRule":"stop_before_speed_accuracy_posture_contacts_or_return_discipline_declines"
      }'::JSONB,
      'output',
      'Express forward medicine-ball chest-pass speed using a shallow bilateral preload and no catch.',
      '{"sets":[3,5],"reps":[3,5],"restSeconds":[60,120],"intent":"maximal_crisp","fullReset":true}'::JSONB,
      'The exact ball starts at the chest, the shallow bilateral preload and ground-up drive are repeatable, release is forward, the target is hit, contacts and finish are controlled, and the lane remains safe.',
      ARRAY[
        'Stop for pain, dizziness, pressure or neurologic symptoms, or apprehension.',
        'Stop for unsafe ball, wall, lane, traffic, return, or retrieval.',
        'Stop for trunk extension, balance or contact error, target miss, or material speed loss.'
      ]::TEXT[],
      'Inspect ball, wall and lane; declare mass, shallow preload, no-jump contacts, target, attempts and rest; place early; observe side and front; shut down the lane before retrieval.',
      'Ball at chest, small dip, drive and pass straight forward, finish balanced, wait, retrieve, reset.',
      'Improved forward full-body medicine-ball chest projection and high-intent force transfer.',
      ARRAY['medicine_ball', 'wall']::TEXT[],
      '{"participants":1,"station":"marked_forward_wall_throw_lane","coachPosition":"outside_release_return_and_retrieval_paths","fullResetRequired":true,"sharedStationRule":"one_active_thrower_per_lane"}'::JSONB,
      '{"setupSeconds":60,"secondsPerRep":12,"transitionSeconds":20,"restIncluded":true,"durationFormula":"setup_plus_sets_times_reps_twelve_seconds_plus_rest"}'::JSONB,
      '{"regress":["lighter_or_softer_ball","smaller_preload","lower_intent_rehearsal","fewer_attempts","longer_rest"],"progress":["squat_countermovement_wall_pass"],"changeOneVariableAtATime":true}'::JSONB,
      '{"unit":"valid_high_intent_throws","record":["ball_mass","target","contacts","attempts","rest","accuracy_or_output","invalid_reason","symptoms"]}'::JSONB
    ),
    (
      'medicine-ball-countermovement-throw',
      'squat-countermovement-wall-pass',
      'Countermovement Medicine-Ball Chest Pass — Squat Wall Pass',
      ARRAY['forward_chest_pass', 'squat_countermovement', 'wall_throw_only']::TEXT[],
      44, 46, 55, 50, 10, 38,
      '{
        "selectable":true,
        "projection":"forward_horizontal_chest",
        "preload":"declared_bilateral_squat_countermovement",
        "contacts":"feet_remain_grounded",
        "target":"inspected_wall",
        "return":"throw_only_wait_retrieve"
      }'::JSONB,
      '{
        "loadingType":"ballistic_two_hand_forward_medicine_ball_projection_with_deeper_preload",
        "externalLoadMethod":"declared_medicine_ball_mass",
        "gripDemand":22,
        "spinalLoading":26,
        "eccentricStress":30,
        "landingContactsPerRep":0,
        "primaryStress":[
          "bilateral_squat_preload_and_drive",
          "trunk_force_transfer",
          "chest_shoulder_and_elbow_ballistic_push",
          "ball_control_and_retrieval"
        ]
      }'::JSONB,
      '{
        "localMuscleFatigue":44,
        "gripFatigue":20,
        "technicalFatigueSensitivity":64,
        "impactAccumulation":10,
        "recoveryHours":30,
        "failureSignals":[
          "ball_speed_or_accuracy_loss",
          "squat_depth_or_drive_change",
          "trunk_extension_balance_release_or_contact_error",
          "unsafe_return_or_retrieval"
        ]
      }'::JSONB,
      '{
        "trainingIntent":"forward_full_body_chest_pass_power_with_squat_preload",
        "identityRule":"declared_bilateral_squat_countermovement_then_two_hand_forward_chest_projection_to_wall",
        "difficultyModel":"max_exercise_complexity_physical_difficulty",
        "fatigueBudgetKeys":["medicine_ball_throws","upper_body_power","lower_body_power","trunk_power","technical_output"],
        "impactBudgetPerRep":0,
        "cumulativeBudgetRule":"stop_before_speed_accuracy_squat_drive_posture_contacts_or_return_discipline_declines"
      }'::JSONB,
      'output',
      'Express forward medicine-ball chest-pass power using a standardized bilateral squat countermovement and no catch.',
      '{"sets":[3,5],"reps":[2,4],"restSeconds":[75,150],"intent":"maximal_crisp","fullReset":true}'::JSONB,
      'The exact ball starts at the chest, the declared squat depth and ground-up drive are repeatable, release is forward, the target is hit, contacts and finish are controlled, and the lane remains safe.',
      ARRAY[
        'Stop for pain, dizziness, pressure or neurologic symptoms, or apprehension.',
        'Stop for unsafe ball, wall, lane, traffic, return, or retrieval.',
        'Stop for squat, trunk, balance, contact or release error, target miss, or material speed loss.'
      ]::TEXT[],
      'Inspect ball, wall and lane; standardize squat depth, mass, grounded contacts, target, attempts and rest; place early; observe side and front; shut down the lane before retrieval.',
      'Ball at chest, squat to the mark, drive and pass straight forward, finish balanced, wait, retrieve, reset.',
      'Improved coordinated lower-to-upper-body force transfer in a forward medicine-ball chest projection.',
      ARRAY['medicine_ball', 'wall']::TEXT[],
      '{"participants":1,"station":"marked_forward_wall_throw_lane","coachPosition":"outside_release_return_and_retrieval_paths","fullResetRequired":true,"sharedStationRule":"one_active_thrower_per_lane"}'::JSONB,
      '{"setupSeconds":60,"secondsPerRep":14,"transitionSeconds":20,"restIncluded":true,"durationFormula":"setup_plus_sets_times_reps_fourteen_seconds_plus_rest"}'::JSONB,
      '{"regress":["shallow_countermovement_wall_pass","lighter_or_softer_ball","reduced_squat_depth","fewer_attempts","longer_rest"],"progress":["greater_output_without_mass_or_contact_change"],"changeOneVariableAtATime":true}'::JSONB,
      '{"unit":"valid_high_intent_throws","record":["ball_mass","squat_depth","target","contacts","attempts","rest","accuracy_or_output","invalid_reason","symptoms"]}'::JSONB
    ),
    (
      'med-ball-countermovement-rotational-throw',
      'fixed-stance-countermovement-wall-throw',
      'Countermovement Rotational Medicine-Ball Throw — Fixed Stance',
      ARRAY['rotational_throw', 'countermovement', 'fixed_stance', 'wall_throw_only']::TEXT[],
      48, 42, 58, 55, 10, 34,
      '{
        "selectable":true,
        "projection":"transverse_rotational",
        "preload":"declared_rotational_countermovement",
        "contacts":"fixed_stance_no_pivot_or_step",
        "target":"inspected_side_wall",
        "return":"throw_only_wait_retrieve"
      }'::JSONB,
      '{
        "loadingType":"ballistic_two_hand_rotational_medicine_ball_projection",
        "externalLoadMethod":"declared_medicine_ball_mass",
        "gripDemand":22,
        "spinalLoading":24,
        "eccentricStress":24,
        "landingContactsPerRep":0,
        "primaryStress":[
          "hip_pelvis_and_trunk_rotational_preload",
          "ground_up_transverse_force_transfer",
          "shoulder_elbow_and_hand_release",
          "anti_excess_lumbar_rotation",
          "ball_control_and_retrieval"
        ]
      }'::JSONB,
      '{
        "localMuscleFatigue":38,
        "gripFatigue":20,
        "technicalFatigueSensitivity":68,
        "impactAccumulation":8,
        "recoveryHours":28,
        "failureSignals":[
          "ball_speed_or_accuracy_loss",
          "forced_lumbar_rotation",
          "sequence_balance_release_or_contact_error",
          "unsafe_return_or_retrieval"
        ]
      }'::JSONB,
      '{
        "trainingIntent":"fixed_stance_rotational_medicine_ball_power",
        "identityRule":"side_specific_rotational_countermovement_with_fixed_feet_then_transverse_wall_release",
        "difficultyModel":"max_exercise_complexity_physical_difficulty",
        "fatigueBudgetKeys":["medicine_ball_throws","rotational_power","upper_body_power","lower_body_power","trunk_power","technical_output"],
        "impactBudgetPerRep":0,
        "cumulativeBudgetRule":"stop_before_speed_accuracy_sequence_lumbar_control_contacts_or_return_discipline_declines"
      }'::JSONB,
      'output',
      'Develop side-specific rotational force transfer while constraining the feet to a fixed stance.',
      '{"sets":[3,5],"repsPerSide":[3,5],"restSeconds":[60,120],"intent":"maximal_crisp","fullReset":true}'::JSONB,
      'The exact ball, throwing side, fixed stance, rotational preload, ground-up sequence, lumbar control, transverse release, target, finish, return behavior, and full reset remain repeatable.',
      ARRAY[
        'Stop for pain, dizziness, pressure or neurologic symptoms, or apprehension.',
        'Stop for unsafe ball, wall, lane, traffic, return, or retrieval.',
        'Stop for forced lumbar rotation, foot movement, balance or release error, target miss, or material speed loss.'
      ]::TEXT[],
      'Inspect ball, wall and side lane; declare mass, side, fixed stance, preload, target, attempts and rest; place early; observe feet, hips and trunk; shut down the lane before retrieval.',
      'Set the side and feet. Load away, drive from the floor, throw across, finish balanced, wait, retrieve, reset.',
      'Improved fixed-stance rotational sequencing, transverse force transfer, and medicine-ball output.',
      ARRAY['medicine_ball', 'wall']::TEXT[],
      '{"participants":1,"station":"marked_side_wall_throw_lane","coachPosition":"outside_rotation_release_return_and_retrieval_paths","fullResetRequired":true,"sharedStationRule":"one_active_thrower_per_lane"}'::JSONB,
      '{"setupSeconds":60,"secondsPerRep":13,"transitionSeconds":25,"restIncluded":true,"durationFormula":"setup_plus_sets_times_sides_times_reps_thirteen_seconds_plus_rest"}'::JSONB,
      '{"regress":["lighter_or_softer_ball","smaller_rotational_preload","lower_intent_rehearsal","fewer_attempts","longer_rest"],"progress":["pivot_allowed_countermovement_wall_throw"],"changeOneVariableAtATime":true}'::JSONB,
      '{"unit":"valid_high_intent_throws_per_side","record":["ball_mass","side","stance","target","attempts","rest","accuracy_or_output","sequence_or_invalid_reason","symptoms"]}'::JSONB
    ),
    (
      'med-ball-countermovement-rotational-throw',
      'pivot-allowed-countermovement-wall-throw',
      'Countermovement Rotational Medicine-Ball Throw — Pivot Allowed',
      ARRAY['rotational_throw', 'countermovement', 'declared_pivot', 'wall_throw_only']::TEXT[],
      54, 44, 65, 60, 10, 38,
      '{
        "selectable":true,
        "projection":"transverse_rotational",
        "preload":"declared_rotational_countermovement",
        "contacts":"declared_foot_pivot_no_step",
        "target":"inspected_side_wall",
        "return":"throw_only_wait_retrieve"
      }'::JSONB,
      '{
        "loadingType":"ballistic_two_hand_rotational_medicine_ball_projection_with_pivot",
        "externalLoadMethod":"declared_medicine_ball_mass",
        "gripDemand":22,
        "spinalLoading":22,
        "eccentricStress":26,
        "landingContactsPerRep":0,
        "primaryStress":[
          "foot_hip_pelvis_and_trunk_rotational_preload",
          "ground_up_transverse_force_transfer_with_pivot",
          "shoulder_elbow_and_hand_release",
          "controlled_lumbar_contribution",
          "ball_control_and_retrieval"
        ]
      }'::JSONB,
      '{
        "localMuscleFatigue":40,
        "gripFatigue":20,
        "technicalFatigueSensitivity":74,
        "impactAccumulation":10,
        "recoveryHours":30,
        "failureSignals":[
          "ball_speed_or_accuracy_loss",
          "pivot_or_ground_sequence_error",
          "forced_lumbar_rotation_balance_release_or_contact_error",
          "unsafe_return_or_retrieval"
        ]
      }'::JSONB,
      '{
        "trainingIntent":"pivot_allowed_rotational_medicine_ball_power",
        "identityRule":"side_specific_rotational_countermovement_with_declared_pivot_then_transverse_wall_release",
        "difficultyModel":"max_exercise_complexity_physical_difficulty",
        "fatigueBudgetKeys":["medicine_ball_throws","rotational_power","upper_body_power","lower_body_power","trunk_power","technical_output"],
        "impactBudgetPerRep":0,
        "cumulativeBudgetRule":"stop_before_speed_accuracy_pivot_sequence_lumbar_control_contacts_or_return_discipline_declines"
      }'::JSONB,
      'output',
      'Develop side-specific rotational force transfer using a declared foot pivot without adding a step or shuffle.',
      '{"sets":[3,5],"repsPerSide":[2,4],"restSeconds":[75,150],"intent":"maximal_crisp","fullReset":true}'::JSONB,
      'The exact ball, throwing side, stance and pivot, rotational preload, ground-up sequence, lumbar control, transverse release, target, finish, return behavior, and full reset remain repeatable.',
      ARRAY[
        'Stop for pain, dizziness, pressure or neurologic symptoms, or apprehension.',
        'Stop for unsafe ball, wall, lane, traffic, return, or retrieval.',
        'Stop for pivot, forced lumbar rotation, balance or release error, target miss, or material speed loss.'
      ]::TEXT[],
      'Inspect ball, wall and side lane; declare mass, side, exact pivot and no-step rule, preload, target, attempts and rest; place early; observe feet through release; shut down the lane before retrieval.',
      'Set the side. Load away, pivot and drive from the floor, throw across, finish balanced, wait, retrieve, reset.',
      'Improved rotational sequencing and transverse force transfer through a declared foot pivot.',
      ARRAY['medicine_ball', 'wall']::TEXT[],
      '{"participants":1,"station":"marked_side_wall_throw_lane","coachPosition":"outside_rotation_release_return_and_retrieval_paths","fullResetRequired":true,"sharedStationRule":"one_active_thrower_per_lane"}'::JSONB,
      '{"setupSeconds":60,"secondsPerRep":14,"transitionSeconds":25,"restIncluded":true,"durationFormula":"setup_plus_sets_times_sides_times_reps_fourteen_seconds_plus_rest"}'::JSONB,
      '{"regress":["fixed_stance_countermovement_wall_throw","lighter_or_softer_ball","smaller_preload","fewer_attempts","longer_rest"],"progress":["greater_output_without_step_or_mass_change"],"changeOneVariableAtATime":true}'::JSONB,
      '{"unit":"valid_high_intent_throws_per_side","record":["ball_mass","side","pivot","target","attempts","rest","accuracy_or_output","sequence_or_invalid_reason","symptoms"]}'::JSONB
    );

  INSERT INTO coaching.exercise_variant_v1 (
    definition_id,
    variant_key,
    display_name,
    modifier_keys,
    difficulty_json,
    requirements_json,
    status,
    load_profile_json,
    fatigue_profile_json,
    programming_profile_json,
    created_at,
    updated_at
  )
  SELECT
    definition.id,
    seed.variant_key,
    seed.display_name,
    seed.modifier_keys,
    jsonb_build_object(
      'technicalComplexity', seed.technical_complexity,
      'absoluteLoadDemand', seed.physical_difficulty,
      'coordinationDemand', greatest(seed.technical_complexity, 20),
      'supervisionDemand', seed.supervision_demand,
      'failureConsequence', seed.failure_consequence,
      'impact', seed.impact,
      'workCapacityDemand', seed.work_capacity,
      'baseOverallDifficulty',
        greatest(seed.technical_complexity, seed.physical_difficulty),
      'difficultyModel',
        'max_exercise_complexity_physical_difficulty'
    ),
    seed.requirements_json,
    'review',
    seed.load_profile_json,
    seed.fatigue_profile_json,
    seed.programming_profile_json,
    now(),
    now()
  FROM boundary_variant_seed seed
  JOIN coaching.exercise_definition_v1 definition
    ON definition.slug = seed.slug
   AND definition.id = ANY(target_ids)
  ON CONFLICT (definition_id, variant_key)
  DO UPDATE SET
    display_name = EXCLUDED.display_name,
    modifier_keys = EXCLUDED.modifier_keys,
    difficulty_json = EXCLUDED.difficulty_json,
    requirements_json = EXCLUDED.requirements_json,
    status = 'review',
    load_profile_json = EXCLUDED.load_profile_json,
    fatigue_profile_json = EXCLUDED.fatigue_profile_json,
    programming_profile_json = EXCLUDED.programming_profile_json,
    updated_at = now();

  INSERT INTO coaching.exercise_delivery_profile_v1 (
    variant_id,
    profile_key,
    phase_key,
    role,
    purpose,
    phase_suitability,
    methodology_alignment,
    objective_relevance_json,
    dosage_json,
    quality_gate,
    stop_rules,
    coach_instructions,
    athlete_instructions,
    expected_adaptation,
    equipment_required,
    logistics_json,
    substitution_ids,
    status,
    time_model_json,
    dose_scaling_json,
    measurement_json,
    support_prompts_json,
    created_at,
    updated_at
  )
  SELECT
    variant.id,
    seed.phase_key || '-quality',
    seed.phase_key,
    'primary',
    seed.purpose,
    CASE seed.phase_key
      WHEN 'output' THEN 94
      WHEN 'resilience' THEN 92
      ELSE 90
    END,
    92,
    jsonb_build_object(
      'primaryIntent', seed.purpose,
      'qualityFirst', TRUE,
      'conditioningUse', FALSE
    ),
    seed.dosage_json,
    seed.quality_gate,
    seed.stop_rules,
    seed.coach_instructions,
    seed.athlete_instructions,
    seed.expected_adaptation,
    seed.equipment_required,
    seed.logistics_json,
    ARRAY[]::UUID[],
    'review',
    seed.time_model_json,
    seed.dose_scaling_json,
    seed.measurement_json,
    jsonb_build_object(
      'beforeSet',
        'Confirm exact variant, equipment, setup, dose, rest, quality gate, and stop signal.',
      'duringSet',
        'Capture symptoms, target or path error, position or contact error, output decline, and immediate substitutions.',
      'afterSet',
        'Record valid quality repetitions, dose, rest, errors, symptoms, stop reason, substitution, and coach override.'
    ),
    now(),
    now()
  FROM boundary_variant_seed seed
  JOIN coaching.exercise_definition_v1 definition
    ON definition.slug = seed.slug
   AND definition.id = ANY(target_ids)
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id = definition.id
   AND variant.variant_key = seed.variant_key
  ON CONFLICT (variant_id, profile_key)
  DO UPDATE SET
    phase_key = EXCLUDED.phase_key,
    role = EXCLUDED.role,
    purpose = EXCLUDED.purpose,
    phase_suitability = EXCLUDED.phase_suitability,
    methodology_alignment = EXCLUDED.methodology_alignment,
    objective_relevance_json = EXCLUDED.objective_relevance_json,
    dosage_json = EXCLUDED.dosage_json,
    quality_gate = EXCLUDED.quality_gate,
    stop_rules = EXCLUDED.stop_rules,
    coach_instructions = EXCLUDED.coach_instructions,
    athlete_instructions = EXCLUDED.athlete_instructions,
    expected_adaptation = EXCLUDED.expected_adaptation,
    equipment_required = EXCLUDED.equipment_required,
    logistics_json = EXCLUDED.logistics_json,
    substitution_ids = ARRAY[]::UUID[],
    status = 'review',
    time_model_json = EXCLUDED.time_model_json,
    dose_scaling_json = EXCLUDED.dose_scaling_json,
    measurement_json = EXCLUDED.measurement_json,
    support_prompts_json = EXCLUDED.support_prompts_json,
    updated_at = now();

  CREATE TEMP TABLE boundary_evidence_catalog (
    source_key TEXT PRIMARY KEY,
    source_url TEXT NOT NULL,
    source_title TEXT NOT NULL,
    source_publisher TEXT NOT NULL,
    source_kind TEXT NOT NULL,
    evidence_quality SMALLINT NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO boundary_evidence_catalog VALUES
    ('dead_bug_emg', 'https://pubmed.ncbi.nlm.nih.gov/11689975/', 'Electromyographic activity of selected trunk muscles during dynamic spine stabilization exercises', 'Archives of Physical Medicine and Rehabilitation', 'peer_reviewed_research', 86),
    ('dead_bug_speed', 'https://doi.org/10.14474/ptrs.2017.6.1.1', 'Changes in muscle activity of the abdominal muscles according to exercise method and speed during dead bug exercise', 'Physical Therapy Rehabilitation Science', 'peer_reviewed_research', 82),
    ('dead_bug_wall', 'https://elite-performance-institute.com/exercise-library/core-exercises/dead-bug-wall-press/', 'Dead Bug Wall Press', 'Elite Performance Institute', 'expert_instruction', 72),
    ('dead_bug_ball', 'https://www.muscleandstrength.com/exercises/medicine-ball-dead-bug', 'Medicine Ball Dead Bug', 'Muscle & Strength', 'expert_instruction', 68),
    ('dead_bug_variations', 'https://total-pt.com/2020/03/27/core-stability-exercises-dead-bug-variations/', 'Dead Bug Exercise Variations', 'Total Physical Therapy', 'expert_instruction', 72),
    ('lateral_line', 'https://www.nsca.com/education/articles/kinetic-select/7-line-drills-to-improve-agility/', '7 Line Drills to Improve Agility', 'National Strength and Conditioning Association', 'professional_standard', 80),
    ('bilateral_landing', 'https://pubmed.ncbi.nlm.nih.gov/17620779/', 'Biomechanical differences between unilateral and bilateral landings from a jump', 'Clinical Journal of Sport Medicine', 'peer_reviewed_research', 83),
    ('landing_feedback', 'https://pubmed.ncbi.nlm.nih.gov/29564872/', 'The effects of feedback on jump-landing biomechanics and lower extremity injury risk', 'Sports Medicine', 'peer_reviewed_research', 88),
    ('mb_protocols', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8157825/', 'Factorial Structure of Trunk Motor Qualities and Their Association with Explosive Movement Performance in Young Footballers', 'International Journal of Environmental Research and Public Health', 'peer_reviewed_research', 84),
    ('mb_rotational', 'https://pubmed.ncbi.nlm.nih.gov/39589937/', 'Criterion Validity and Reliability of a New Medicine Ball Rotational Power Test', 'Journal of Strength and Conditioning Research', 'peer_reviewed_research', 84),
    ('mb_rotator', 'https://pubmed.ncbi.nlm.nih.gov/37721721/', 'Influence of trunk rotator strength on rotational medicine ball throwing performance', 'Journal of Sports Medicine and Physical Fitness', 'peer_reviewed_research', 81),
    ('mb_chest', 'https://www.dvidshub.net/video/640987/med-ball-chest-throw-againt-wall', 'Med Ball Chest Throw Against Wall', 'U.S. Marine Corps Training and Education Command', 'governing_body', 78),
    ('mb_ace', 'https://www.acefitness.org/resources/everyone/exercise-library/264/medicine-ball-lunge-to-chest-pass/', 'Medicine Ball Lunge to Chest Pass', 'American Council on Exercise', 'professional_standard', 80),
    ('mb_nsca', 'https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf', 'NSCA Coach 5.4', 'National Strength and Conditioning Association', 'professional_standard', 80),
    ('youtube', 'https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en', 'Embed videos and playlists', 'YouTube Help', 'manufacturer_instruction', 82);

  CREATE TEMP TABLE boundary_section_seed (
    section_key TEXT PRIMARY KEY,
    ordinal SMALLINT NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO boundary_section_seed VALUES
    ('identity', 1),
    ('taxonomy', 2),
    ('anatomy', 3),
    ('biomechanics', 4),
    ('difficulty', 5),
    ('load_fatigue_recovery', 6),
    ('constraints', 7),
    ('dosage', 8),
    ('instructions', 9),
    ('safety_stop_rules', 10),
    ('programming', 11),
    ('athlete_support', 12),
    ('coach_support', 13),
    ('accessibility', 14),
    ('alternates', 15),
    ('media', 16);

  INSERT INTO coaching.exercise_section_evidence_v1 (
    definition_id,
    reviewed_card_version,
    section_key,
    source_url,
    source_title,
    source_publisher,
    source_kind,
    claims_json,
    evidence_quality,
    review_status,
    reviewer_user_id,
    reviewed_at,
    created_at,
    updated_at
  )
  SELECT
    definition.id,
    definition.card_version,
    section.section_key,
    catalog.source_url,
    catalog.source_title,
    catalog.source_publisher,
    catalog.source_kind,
    jsonb_build_array(
      CASE section.section_key
        WHEN 'identity' THEN
          'The exact movement contract and researched identity boundary are recorded; ambiguous legacy wording is not selectable.'
        WHEN 'taxonomy' THEN
          'The card declares controlled movement pattern, direction, support, laterality, constraint, completion, and reset taxonomy.'
        WHEN 'anatomy' THEN
          'Muscles, joints, joint actions, planes, and laterality are declared without claiming isolated action.'
        WHEN 'biomechanics' THEN
          'Observable movement sequence, force transfer, contact, position, and return gates are explicit.'
        WHEN 'difficulty' THEN
          'Exercise complexity and physical difficulty are scored separately and overall equals their maximum; no exercise skill level is assigned.'
        WHEN 'load_fatigue_recovery' THEN
          'Load, cumulative fatigue, technical-sensitivity, impact, and recovery budgets are declared for each exact variant.'
        WHEN 'constraints' THEN
          'Equipment, surface, target, clearance, lighting, traffic, return, retrieval, and observation constraints are explicit.'
        WHEN 'dosage' THEN
          'Quality-first sets, repetitions, rest, reset, side balance, and output-loss rules are declared.'
        WHEN 'instructions' THEN
          'Coach and athlete instructions name exact setup, sequence, cue, completion, reset, and stop signal.'
        WHEN 'safety_stop_rules' THEN
          'Symptoms, unsafe logistics, position or contact failure, target error, and output decline trigger immediate stop.'
        WHEN 'programming' THEN
          'The card declares freshness, cumulative budgets, placement, conditioning exclusion, and substitution boundaries.'
        WHEN 'athlete_support' THEN
          'Self-checks, pain guidance, accessibility options, and nonvideo instruction are present.'
        WHEN 'coach_support' THEN
          'Observation priorities, station control, immediate shutdown, and post-set recording are present.'
        WHEN 'accessibility' THEN
          'Range, load, target, contact, repetition, rest, and instruction-format adjustments preserve the declared identity or record an explicit substitution.'
        WHEN 'alternates' THEN
          'Progressions, regressions, variants, modifiers, substitutions, and separate definitions are classified by identity-defining dimensions.'
        ELSE
          'YouTube links are candidate metadata only; full viewing, exact match, safety, captions, accessibility, reviewer identity, and approval remain unresolved.'
      END,
      'Research batch: ' || seed.research_batch || '. Human review remains required.'
    ),
    catalog.evidence_quality,
    'candidate',
    NULL,
    NULL,
    now(),
    now()
  FROM boundary_definition_seed seed
  JOIN coaching.exercise_definition_v1 definition
    ON definition.slug = seed.slug
   AND definition.id = ANY(target_ids)
  CROSS JOIN boundary_section_seed section
  JOIN boundary_evidence_catalog catalog
    ON catalog.source_key = CASE
      WHEN section.section_key = 'media' THEN 'youtube'
      WHEN seed.research_batch = 'dead-bug-press-boundary-v1'
        AND section.section_key = 'identity'
        AND seed.slug = 'dead-bug-wall-press' THEN 'dead_bug_wall'
      WHEN seed.research_batch = 'dead-bug-press-boundary-v1'
        AND section.section_key = 'identity'
        AND seed.slug = 'medicine-ball-dead-bug-press' THEN 'dead_bug_ball'
      WHEN seed.research_batch = 'dead-bug-press-boundary-v1'
        AND section.section_key IN ('biomechanics', 'difficulty', 'coach_support') THEN 'dead_bug_speed'
      WHEN seed.research_batch = 'dead-bug-press-boundary-v1'
        AND section.section_key IN ('constraints', 'safety_stop_rules', 'accessibility', 'alternates') THEN 'dead_bug_variations'
      WHEN seed.research_batch = 'dead-bug-press-boundary-v1' THEN 'dead_bug_emg'
      WHEN seed.research_batch = 'bilateral-lateral-jump-stick-boundary-v1'
        AND section.section_key IN ('identity', 'taxonomy', 'constraints', 'instructions', 'alternates') THEN 'lateral_line'
      WHEN seed.research_batch = 'bilateral-lateral-jump-stick-boundary-v1'
        AND section.section_key IN ('dosage', 'safety_stop_rules', 'accessibility') THEN 'landing_feedback'
      WHEN seed.research_batch = 'bilateral-lateral-jump-stick-boundary-v1' THEN 'bilateral_landing'
      WHEN seed.research_batch = 'countermovement-medicine-ball-projection-boundary-v1'
        AND section.section_key = 'identity'
        AND seed.slug = 'medicine-ball-countermovement-throw' THEN 'mb_chest'
      WHEN seed.research_batch = 'countermovement-medicine-ball-projection-boundary-v1'
        AND section.section_key = 'identity'
        AND seed.slug = 'med-ball-countermovement-rotational-throw' THEN 'mb_rotational'
      WHEN seed.research_batch = 'countermovement-medicine-ball-projection-boundary-v1'
        AND section.section_key IN ('constraints', 'safety_stop_rules', 'athlete_support', 'accessibility') THEN 'mb_ace'
      WHEN seed.research_batch = 'countermovement-medicine-ball-projection-boundary-v1'
        AND section.section_key IN ('dosage', 'programming') THEN 'mb_nsca'
      WHEN seed.research_batch = 'countermovement-medicine-ball-projection-boundary-v1'
        AND section.section_key IN ('anatomy', 'coach_support') THEN 'mb_rotator'
      ELSE 'mb_protocols'
    END
  ON CONFLICT (
    definition_id,
    reviewed_card_version,
    section_key,
    source_url
  )
  DO UPDATE SET
    source_title = EXCLUDED.source_title,
    source_publisher = EXCLUDED.source_publisher,
    source_kind = EXCLUDED.source_kind,
    claims_json = EXCLUDED.claims_json,
    evidence_quality = EXCLUDED.evidence_quality,
    review_status = 'candidate',
    reviewer_user_id = NULL,
    reviewed_at = NULL,
    updated_at = now();

  CREATE TEMP TABLE boundary_media_seed (
    slug TEXT NOT NULL,
    video_id TEXT NOT NULL,
    title TEXT NOT NULL,
    channel_name TEXT NOT NULL,
    source_query TEXT NOT NULL,
    notes TEXT NOT NULL,
    PRIMARY KEY (slug, video_id)
  ) ON COMMIT DROP;

  INSERT INTO boundary_media_seed VALUES
    ('dead-bug-wall-press', '1WYgMMMTJCE', 'How To Perform The Wall Press Dead Bug', 'Champion Physical Therapy and Performance', 'dead bug wall press', 'Candidate metadata only; exact limb and press contract requires human viewing.'),
    ('dead-bug-wall-press', '9V3N2q1TyOY', 'DeadBug Wall Press', 'Onsight Fitness', 'dead bug wall press', 'Candidate metadata only; full review remains pending.'),
    ('dead-bug-wall-press', 'Jtpc4jcM4wA', 'Dead Bug/Wall Press', 'Austin Longevity Clinic', 'dead bug wall press', 'Candidate metadata only; full review remains pending.'),
    ('dead-bug-wall-press', '5jdTVN5tpf4', 'Wall Press Deadbug - Low Back Pain Exercise and Core Workout', 'Rehab Hero', 'dead bug wall press', 'Candidate metadata only; clinical wording and exact contract require human review.'),
    ('dead-bug-wall-press', 'zcCFmBkJxLM', 'Wall Press Dead Bug', 'AMP Fitness', 'dead bug wall press', 'Candidate metadata only; full review remains pending.'),
    ('medicine-ball-dead-bug-press', 'p-BgARBenTY', 'Deadbug with Medball', 'The Active Life', 'medicine ball dead bug press', 'Candidate metadata only; exact ball and limb contract requires human viewing.'),
    ('medicine-ball-dead-bug-press', 'E_L-PYfY4ZI', 'Med Ball Dead bug', 'MVMT Performance & Rehabilitation', 'medicine ball dead bug press', 'Candidate metadata only; full review remains pending.'),
    ('medicine-ball-dead-bug-press', 'G-18G_nzguU', 'Deadbug with MB press', 'Wolfe PT', 'medicine ball dead bug press', 'Candidate metadata only; exact contract and quality require human review.'),
    ('medicine-ball-dead-bug-press', '2_oeZkkptX0', 'Dead Bug with Med Ball Squeeze', 'Mountaineers Fitness', 'medicine ball dead bug press', 'Candidate metadata only; exact contract and quality require human review.'),
    ('medicine-ball-dead-bug-press', 'LIVmJORD_lI', 'DEAD BUG w/ CONTRALATERAL BALL PRESS', 'Velocity Sports Physical Therapy', 'medicine ball dead bug press', 'Candidate metadata only; exact contract and full quality review remain pending.'),
    ('lateral-hop-to-stick', 'sJo6A7-WTTY', 'Double Leg Lateral Jump and Stick', 'GAA RT', 'double leg lateral jump stick', 'Candidate metadata only; exact takeoff, landing, hold, and quality require human viewing.'),
    ('lateral-hop-to-stick', 'biE2xfUKyKk', 'Double Leg Lateral Line Jump with Stick', 'UR Fitness Science', 'double leg lateral jump stick', 'Candidate metadata only; full review remains pending.'),
    ('lateral-hop-to-stick', 'iTg6PmDTixo', 'double leg lateral hop with stick', 'Coach Blayne Lapan - Sports Performance', 'double leg lateral jump stick', 'Candidate metadata only; full review remains pending.'),
    ('lateral-hop-to-stick', 'h5MUUMuH8T4', 'Double Leg lateral Jump stick landing', 'CaseStrength', 'double leg lateral jump stick', 'Candidate metadata only; full review remains pending.'),
    ('lateral-hop-to-stick', 'XzlyauR-wQA', 'Lateral Jump to Stick', 'Mountain Edge Performance', 'two foot lateral jump to two foot stick', 'Candidate metadata only; bilateral support and full quality review remain pending.'),
    ('medicine-ball-countermovement-throw', 'PMjqv9Up3Fo', 'Med Ball Squat to Chest Pass', 'FITPARTUM', 'medicine ball squat chest pass wall', 'Candidate metadata only; exact target, return, contacts, and quality require human viewing.'),
    ('medicine-ball-countermovement-throw', 'odBbcN_e-XI', 'Med Ball Squat to Chest Pass', 'Josh Williams Fitness', 'medicine ball squat chest pass wall', 'Candidate metadata only; full review remains pending.'),
    ('medicine-ball-countermovement-throw', 'aJdYjyRiYqs', 'Med Ball Squat to Chest Pass', 'Evolve Flagstaff', 'medicine ball squat chest pass wall', 'Candidate metadata only; full review remains pending.'),
    ('medicine-ball-countermovement-throw', 'pliz_HRQyL8', 'Resilient Performance - Med Ball Squat Chest Pass', 'Resilient Performance Physical Therapy', 'medicine ball squat chest pass wall', 'Candidate metadata only; full review remains pending.'),
    ('medicine-ball-countermovement-throw', 'e-zHTwXA8mE', 'Standing Medicine Ball Chest Pass - Viking Strength Systems', 'Viking Strength Systems', 'medicine ball countermovement chest pass wall', 'Candidate metadata only; countermovement and exact quality require human viewing.'),
    ('med-ball-countermovement-rotational-throw', 'zBeW-8vuiz0', 'Medball Counter Movement Rotational Throw', 'Mines Strength and Conditioning', 'countermovement rotational medicine ball throw', 'Candidate metadata only; exact stance, pivot, target, and quality require human viewing.'),
    ('med-ball-countermovement-rotational-throw', '02c2YLgF8iE', 'Medball Rotational Throw', 'Speed School Performance', 'countermovement rotational medicine ball throw', 'Candidate metadata only; countermovement and full review remain pending.'),
    ('med-ball-countermovement-rotational-throw', 'DttZ5JU-b_U', 'How to Perform Rotational Med Ball Throws', 'CORE Strong Fitness', 'countermovement rotational medicine ball throw', 'Candidate metadata only; exact variant and full review remain pending.'),
    ('med-ball-countermovement-rotational-throw', 'c7fB-K8Ih54', 'How to Properly Execute Rotational Med Ball Throws | CrossFit Invictus', 'CrossFit Invictus', 'countermovement rotational medicine ball throw', 'Candidate metadata only; exact variant and full review remain pending.'),
    ('med-ball-countermovement-rotational-throw', 'ZkwXZfk6w8A', 'Counter Movement MB Scoop Toss', 'Derek Ward', 'countermovement rotational medicine ball throw', 'Candidate metadata only for a scoop variant; exact transverse projection and full review remain pending.');

  UPDATE coaching.exercise_media_candidate_v1 media
  SET review_status = 'superseded',
      reviewer_user_id = NULL,
      reviewed_at = NULL,
      updated_at = now()
  WHERE media.definition_id = ANY(target_ids)
    AND media.reviewed_card_version < 2
    AND media.review_status = 'candidate';

  INSERT INTO coaching.exercise_media_candidate_v1 (
    definition_id,
    variant_id,
    reviewed_card_version,
    url,
    embed_url,
    video_id,
    title,
    channel_name,
    language_code,
    captions_available,
    embedding_allowed,
    exact_variant_match,
    demonstration_quality_score,
    link_status,
    review_status,
    discovery_method,
    source_query,
    reviewer_user_id,
    reviewed_at,
    notes,
    created_at,
    updated_at
  )
  SELECT
    definition.id,
    NULL,
    definition.card_version,
    'https://www.youtube.com/watch?v=' || seed.video_id,
    'https://www.youtube-nocookie.com/embed/' || seed.video_id,
    seed.video_id,
    seed.title,
    seed.channel_name,
    'en',
    NULL,
    TRUE,
    NULL,
    NULL,
    'healthy',
    'candidate',
    'manual_research',
    seed.source_query,
    NULL,
    NULL,
    seed.notes
      || ' Current oEmbed metadata was healthy on 2026-07-27; full viewing, exact match, instruction and safety quality, captions, accessibility, reviewer identity, and approval remain pending.',
    now(),
    now()
  FROM boundary_media_seed seed
  JOIN coaching.exercise_definition_v1 definition
    ON definition.slug = seed.slug
   AND definition.id = ANY(target_ids)
  ON CONFLICT (
    definition_id,
    reviewed_card_version,
    video_id
  )
  DO UPDATE SET
    variant_id = NULL,
    url = EXCLUDED.url,
    embed_url = EXCLUDED.embed_url,
    title = EXCLUDED.title,
    channel_name = EXCLUDED.channel_name,
    language_code = 'en',
    captions_available = NULL,
    embedding_allowed = TRUE,
    exact_variant_match = NULL,
    demonstration_quality_score = NULL,
    link_status = 'healthy',
    review_status = 'candidate',
    discovery_method = 'manual_research',
    source_query = EXCLUDED.source_query,
    reviewer_user_id = NULL,
    reviewed_at = NULL,
    notes = EXCLUDED.notes,
    updated_at = now();

  CREATE TEMP TABLE boundary_alternate_seed (
    slug TEXT NOT NULL,
    alternate_name TEXT NOT NULL,
    classification TEXT NOT NULL,
    rationale TEXT NOT NULL,
    dimensions JSONB NOT NULL,
    PRIMARY KEY (slug, alternate_name)
  ) ON COMMIT DROP;

  INSERT INTO boundary_alternate_seed VALUES
    ('dead-bug-wall-press', 'Alternating Heel Tap', 'new_variant', 'Shorter leg travel preserves the fixed-wall press identity at lower physical demand.', '{"legAction":"heel_tap","handConstraint":"bilateral_fixed_wall_press"}'),
    ('dead-bug-wall-press', 'Alternating Leg Extension', 'new_variant', 'Longer lever travel preserves identity while increasing anti-extension demand.', '{"legAction":"declared_extension","handConstraint":"bilateral_fixed_wall_press"}'),
    ('dead-bug-wall-press', 'Double-Leg Wall-Press Lower', 'new_variant', 'Moving both legs materially increases physical demand and requires separate calibration.', '{"movingLimbs":"bilateral_legs"}'),
    ('dead-bug-wall-press', 'Medicine-Ball Dead Bug Press', 'new_definition', 'The ball is pressed between contralateral limbs while the free arm and leg move.', '{"forceSource":"movable_ball_between_limbs","movingLimbs":"opposite_arm_and_leg"}'),
    ('dead-bug-wall-press', 'Band Pulldown Dead Bug', 'new_definition', 'An anchored elastic pulldown changes force direction and load behavior.', '{"forceSource":"anchored_elastic_resistance"}'),
    ('dead-bug-wall-press', 'Unloaded Dead Bug', 'new_definition', 'Removing the external press changes the defining constraint.', '{"pressConstraint":"none"}'),
    ('medicine-ball-dead-bug-press', 'Single Free-Limb Control', 'new_variant', 'Only one free limb moves while the contralateral ball press remains fixed.', '{"movingLimbs":"one_free_limb"}'),
    ('medicine-ball-dead-bug-press', 'Contralateral Arm-Leg Extension', 'new_variant', 'The free opposite arm and leg extend together while the ball stays pressed.', '{"movingLimbs":"free_opposite_arm_and_leg"}'),
    ('medicine-ball-dead-bug-press', 'Stability-Ball Dead Bug Press', 'modifier_annotation', 'A larger compressible ball can preserve the press and limb sequence when size is recorded.', '{"ballType":"stability_ball"}'),
    ('medicine-ball-dead-bug-press', 'Dead Bug Wall Press', 'new_definition', 'Both hands press a fixed wall while the arms do not move.', '{"forceSource":"fixed_wall","movingLimbs":"legs_only"}'),
    ('medicine-ball-dead-bug-press', 'Medicine-Ball Dead Bug Toss', 'new_definition', 'Releasing and catching the ball changes the task to reactive object control.', '{"ballContract":"release_and_catch"}'),
    ('medicine-ball-dead-bug-press', 'Loaded Overhead Dead Bug', 'new_definition', 'Holding an external load overhead changes force direction and limb availability.', '{"loadPosition":"overhead"}'),
    ('lateral-hop-to-stick', 'Low-Amplitude Bilateral Lateral Jump to Stick', 'new_variant', 'Short distance preserves the bilateral identity at lower physical demand.', '{"laterality":"bilateral","amplitude":"low"}'),
    ('lateral-hop-to-stick', 'Distance Bilateral Lateral Jump to Stick', 'new_variant', 'Greater declared distance raises projection and landing demand without changing support.', '{"laterality":"bilateral","amplitude":"distance"}'),
    ('lateral-hop-to-stick', 'Bilateral Lateral Line Jump to Stick', 'modifier_annotation', 'A floor line is a target boundary when takeoff, landing, hold, and reset remain bilateral.', '{"target":"line"}'),
    ('lateral-hop-to-stick', 'Single-Leg Lateral Hop to Stick', 'new_definition', 'One declared leg takes off and lands.', '{"laterality":"ipsilateral_single_leg"}'),
    ('lateral-hop-to-stick', 'Skater Bound to Stick', 'new_definition', 'Contralateral landing changes the takeoff-to-landing contract.', '{"laterality":"contralateral_single_leg"}'),
    ('lateral-hop-to-stick', 'Continuous Bilateral Lateral Line Hops', 'new_definition', 'Repeated rebounds remove the defining terminal hold and full reset.', '{"cadence":"continuous_rebound"}'),
    ('medicine-ball-countermovement-throw', 'Shallow Countermovement Wall Chest Pass', 'new_variant', 'A small bilateral preload preserves the forward chest-pass identity.', '{"preload":"shallow_countermovement","projection":"forward_chest"}'),
    ('medicine-ball-countermovement-throw', 'Squat Countermovement Wall Chest Pass', 'new_variant', 'A deeper declared squat increases lower-body contribution and physical demand.', '{"preload":"declared_squat_depth","projection":"forward_chest"}'),
    ('medicine-ball-countermovement-throw', 'Countermovement Chest Pass for Distance', 'modifier_annotation', 'A standardized open-lane distance measure is a delivery annotation.', '{"target":"open_distance_lane"}'),
    ('medicine-ball-countermovement-throw', 'Countermovement Rotational Throw', 'new_definition', 'Transverse projection and side-specific rotation change stance, sequencing, and target.', '{"projection":"transverse_rotational"}'),
    ('medicine-ball-countermovement-throw', 'Countermovement Overhead Throw', 'new_definition', 'Overhead release changes arm path and projection.', '{"release":"overhead"}'),
    ('medicine-ball-countermovement-throw', 'Wall-Ball Squat Throw and Catch', 'new_definition', 'Upward projection plus repeated catch-and-squat cadence changes the exercise.', '{"projection":"upward","return":"repeated_catch"}'),
    ('med-ball-countermovement-rotational-throw', 'Fixed-Stance Countermovement Rotational Wall Throw', 'new_variant', 'A fixed stance constrains foot contacts while preserving transverse projection.', '{"footwork":"fixed_stance","projection":"transverse_rotational"}'),
    ('med-ball-countermovement-rotational-throw', 'Pivot-Allowed Countermovement Rotational Wall Throw', 'new_variant', 'A declared pivot changes coordination while preserving the same projection identity.', '{"footwork":"declared_pivot","projection":"transverse_rotational"}'),
    ('med-ball-countermovement-rotational-throw', 'Countermovement Rotational Scoop Toss', 'new_variant', 'A low scoop release may be a variant only when side-on transverse projection is preserved.', '{"releasePath":"low_scoop"}'),
    ('med-ball-countermovement-rotational-throw', 'Step-Behind Rotational Throw', 'new_definition', 'A step-behind entry adds locomotor contacts and sequencing.', '{"entry":"step_behind"}'),
    ('med-ball-countermovement-rotational-throw', 'Countermovement Chest Pass', 'new_definition', 'Forward bilateral projection changes stance, sequence, plane, and target.', '{"projection":"forward_chest"}'),
    ('med-ball-countermovement-rotational-throw', 'Rotational Medicine-Ball Slam', 'new_definition', 'Downward floor projection changes release and return behavior.', '{"projection":"downward_floor"}');

  INSERT INTO coaching.exercise_alternate_assessment_v1 (
    definition_id,
    reviewed_card_version,
    alternate_name,
    classification,
    rationale,
    distinguishing_dimensions,
    proposed_card_json,
    review_status,
    reviewer_user_id,
    reviewed_at,
    created_at,
    updated_at
  )
  SELECT
    definition.id,
    definition.card_version,
    seed.alternate_name,
    seed.classification,
    seed.rationale,
    seed.dimensions,
    NULL,
    'candidate',
    NULL,
    NULL,
    now(),
    now()
  FROM boundary_alternate_seed seed
  JOIN coaching.exercise_definition_v1 definition
    ON definition.slug = seed.slug
   AND definition.id = ANY(target_ids)
  ON CONFLICT (
    definition_id,
    reviewed_card_version,
    alternate_name
  )
  DO UPDATE SET
    classification = EXCLUDED.classification,
    rationale = EXCLUDED.rationale,
    distinguishing_dimensions = EXCLUDED.distinguishing_dimensions,
    proposed_card_json = NULL,
    review_status = 'candidate',
    reviewer_user_id = NULL,
    reviewed_at = NULL,
    updated_at = now();

  INSERT INTO coaching.exercise_relationship_v1 (
    from_variant_id,
    to_variant_id,
    relationship,
    similarity_score,
    dimensions,
    reason,
    conditions_json,
    review_status,
    created_by,
    reviewed_by,
    reviewed_at,
    created_at,
    updated_at
  )
  SELECT
    easier.id,
    harder.id,
    'progression',
    92,
    ARRAY['range', 'complexity', 'load']::TEXT[],
    'Progress only after the easier exact contract is repeatable without symptoms, position or contact error, target error, or material output decline.',
    jsonb_build_object(
      'humanApprovalRequired', TRUE,
      'publicationQuarantined', TRUE,
      'neverSilent', TRUE,
      'exerciseDifficultyModel',
        'max_exercise_complexity_physical_difficulty'
    ),
    'review',
    NULL,
    NULL,
    NULL,
    now(),
    now()
  FROM (VALUES
    ('dead-bug-wall-press', 'alternating-heel-tap', 'alternating-leg-extension'),
    ('medicine-ball-dead-bug-press', 'single-free-limb-control', 'contralateral-arm-leg-extension'),
    ('lateral-hop-to-stick', 'low-amplitude-bilateral-control', 'distance-bilateral-control'),
    ('medicine-ball-countermovement-throw', 'shallow-countermovement-wall-pass', 'squat-countermovement-wall-pass'),
    ('med-ball-countermovement-rotational-throw', 'fixed-stance-countermovement-wall-throw', 'pivot-allowed-countermovement-wall-throw')
  ) AS pair(slug, easier_key, harder_key)
  JOIN coaching.exercise_definition_v1 definition
    ON definition.slug = pair.slug
   AND definition.id = ANY(target_ids)
  JOIN coaching.exercise_variant_v1 easier
    ON easier.definition_id = definition.id
   AND easier.variant_key = pair.easier_key
  JOIN coaching.exercise_variant_v1 harder
    ON harder.definition_id = definition.id
   AND harder.variant_key = pair.harder_key
  ON CONFLICT (from_variant_id, to_variant_id, relationship)
  DO UPDATE SET
    similarity_score = EXCLUDED.similarity_score,
    dimensions = EXCLUDED.dimensions,
    reason = EXCLUDED.reason,
    conditions_json = EXCLUDED.conditions_json,
    review_status = 'review',
    reviewed_by = NULL,
    reviewed_at = NULL,
    updated_at = now();

  INSERT INTO coaching.exercise_relationship_v1 (
    from_variant_id,
    to_variant_id,
    relationship,
    similarity_score,
    dimensions,
    reason,
    conditions_json,
    review_status,
    created_by,
    reviewed_by,
    reviewed_at,
    created_at,
    updated_at
  )
  SELECT
    harder.id,
    easier.id,
    'regression',
    92,
    ARRAY['range', 'complexity', 'load']::TEXT[],
    'Regress when symptoms, position, contact, target, hold, breath, sequence, or output quality cannot be preserved.',
    jsonb_build_object(
      'humanApprovalRequired', TRUE,
      'publicationQuarantined', TRUE,
      'neverSilent', TRUE,
      'exerciseDifficultyModel',
        'max_exercise_complexity_physical_difficulty'
    ),
    'review',
    NULL,
    NULL,
    NULL,
    now(),
    now()
  FROM (VALUES
    ('dead-bug-wall-press', 'alternating-heel-tap', 'alternating-leg-extension'),
    ('medicine-ball-dead-bug-press', 'single-free-limb-control', 'contralateral-arm-leg-extension'),
    ('lateral-hop-to-stick', 'low-amplitude-bilateral-control', 'distance-bilateral-control'),
    ('medicine-ball-countermovement-throw', 'shallow-countermovement-wall-pass', 'squat-countermovement-wall-pass'),
    ('med-ball-countermovement-rotational-throw', 'fixed-stance-countermovement-wall-throw', 'pivot-allowed-countermovement-wall-throw')
  ) AS pair(slug, easier_key, harder_key)
  JOIN coaching.exercise_definition_v1 definition
    ON definition.slug = pair.slug
   AND definition.id = ANY(target_ids)
  JOIN coaching.exercise_variant_v1 easier
    ON easier.definition_id = definition.id
   AND easier.variant_key = pair.easier_key
  JOIN coaching.exercise_variant_v1 harder
    ON harder.definition_id = definition.id
   AND harder.variant_key = pair.harder_key
  ON CONFLICT (from_variant_id, to_variant_id, relationship)
  DO UPDATE SET
    similarity_score = EXCLUDED.similarity_score,
    dimensions = EXCLUDED.dimensions,
    reason = EXCLUDED.reason,
    conditions_json = EXCLUDED.conditions_json,
    review_status = 'review',
    reviewed_by = NULL,
    reviewed_at = NULL,
    updated_at = now();

  INSERT INTO coaching.exercise_relationship_v1 (
    from_variant_id,
    to_variant_id,
    relationship,
    similarity_score,
    dimensions,
    reason,
    conditions_json,
    review_status,
    created_by,
    reviewed_by,
    reviewed_at,
    created_at,
    updated_at
  )
  SELECT
    source_variant.id,
    target_variant.id,
    'lateral_substitution',
    relation.similarity_score,
    relation.dimensions,
    relation.reason,
    relation.conditions,
    'review',
    NULL,
    NULL,
    NULL,
    now(),
    now()
  FROM (VALUES
    (
      'dead-bug-wall-press',
      'alternating-heel-tap',
      'medicine-ball-dead-bug-press',
      'single-free-limb-control',
      72,
      ARRAY['supine_anti_extension', 'external_press', 'low_fatigue']::TEXT[],
      'Use only when the training intent permits a recorded change from fixed bilateral wall pressure to contralateral ball pressure and the athlete can follow the new limb contract.',
      '{"mustPreserve":["supine_anti_extension","controlled_breath","quality_first"],"neverSilent":["force_source","pressing_limbs","moving_limbs","equipment","symptom_related_change"],"humanApprovalRequired":true}'::JSONB
    ),
    (
      'medicine-ball-dead-bug-press',
      'single-free-limb-control',
      'dead-bug-wall-press',
      'alternating-heel-tap',
      72,
      ARRAY['supine_anti_extension', 'external_press', 'low_fatigue']::TEXT[],
      'Use only when the training intent permits a recorded change from contralateral ball pressure to fixed bilateral wall pressure and the athlete can follow the new leg-only contract.',
      '{"mustPreserve":["supine_anti_extension","controlled_breath","quality_first"],"neverSilent":["force_source","pressing_limbs","moving_limbs","equipment","symptom_related_change"],"humanApprovalRequired":true}'::JSONB
    ),
    (
      'medicine-ball-countermovement-throw',
      'shallow-countermovement-wall-pass',
      'med-ball-countermovement-rotational-throw',
      'fixed-stance-countermovement-wall-throw',
      58,
      ARRAY['medicine_ball_power', 'wall_throw', 'full_reset']::TEXT[],
      'Use only when general medicine-ball power is acceptable and forward versus transverse projection is explicitly changed and recorded; never substitute when directional specificity is required.',
      '{"mustPreserve":["high_intent_medicine_ball_power","safe_wall_lane","full_reset"],"neverSilent":["projection_plane","orientation","laterality","target","symptom_related_change"],"humanApprovalRequired":true}'::JSONB
    ),
    (
      'med-ball-countermovement-rotational-throw',
      'fixed-stance-countermovement-wall-throw',
      'medicine-ball-countermovement-throw',
      'shallow-countermovement-wall-pass',
      58,
      ARRAY['medicine_ball_power', 'wall_throw', 'full_reset']::TEXT[],
      'Use only when general medicine-ball power is acceptable and transverse versus forward projection is explicitly changed and recorded; never substitute when directional specificity is required.',
      '{"mustPreserve":["high_intent_medicine_ball_power","safe_wall_lane","full_reset"],"neverSilent":["projection_plane","orientation","laterality","target","symptom_related_change"],"humanApprovalRequired":true}'::JSONB
    )
  ) AS relation(
    source_slug,
    source_key,
    target_slug,
    target_key,
    similarity_score,
    dimensions,
    reason,
    conditions
  )
  JOIN coaching.exercise_definition_v1 source_definition
    ON source_definition.slug = relation.source_slug
   AND source_definition.id = ANY(target_ids)
  JOIN coaching.exercise_variant_v1 source_variant
    ON source_variant.definition_id = source_definition.id
   AND source_variant.variant_key = relation.source_key
  JOIN coaching.exercise_definition_v1 target_definition
    ON target_definition.slug = relation.target_slug
   AND target_definition.id = ANY(target_ids)
  JOIN coaching.exercise_variant_v1 target_variant
    ON target_variant.definition_id = target_definition.id
   AND target_variant.variant_key = relation.target_key
  ON CONFLICT (from_variant_id, to_variant_id, relationship)
  DO UPDATE SET
    similarity_score = EXCLUDED.similarity_score,
    dimensions = EXCLUDED.dimensions,
    reason = EXCLUDED.reason,
    conditions_json = EXCLUDED.conditions_json,
    review_status = 'review',
    reviewed_by = NULL,
    reviewed_at = NULL,
    updated_at = now();

  INSERT INTO coaching.exercise_score_calibration_v1 (
    facility_id,
    variant_id,
    dimension,
    proposed_score,
    anchor_tier,
    rationale,
    status,
    version,
    created_by,
    reviewed_by,
    review_notes,
    reviewed_at,
    created_at,
    updated_at
  )
  SELECT
    facility,
    variant.id,
    dimension.dimension,
    CASE dimension.dimension
      WHEN 'technicalComplexity' THEN seed.technical_complexity
      ELSE seed.physical_difficulty
    END,
    CASE
      WHEN (
        CASE dimension.dimension
          WHEN 'technicalComplexity' THEN seed.technical_complexity
          ELSE seed.physical_difficulty
        END
      ) <= 30 THEN 20
      WHEN (
        CASE dimension.dimension
          WHEN 'technicalComplexity' THEN seed.technical_complexity
          ELSE seed.physical_difficulty
        END
      ) <= 50 THEN 40
      WHEN (
        CASE dimension.dimension
          WHEN 'technicalComplexity' THEN seed.technical_complexity
          ELSE seed.physical_difficulty
        END
      ) <= 70 THEN 60
      ELSE 80
    END,
    CASE dimension.dimension
      WHEN 'technicalComplexity' THEN
        'Research-backed proposal based on the exact movement sequence, laterality, constraint, range, target, contacts, return, and observable coordination gates; independent coach calibration remains required.'
      ELSE
        'Research-backed proposal based on exact lever, amplitude, ball mass, force direction, eccentric or landing load, impact, repetitions, and recovery; independent coach calibration remains required.'
    END,
    'review',
    1,
    NULL,
    NULL,
    'Candidate calibration proposal only; no human review or approval is implied.',
    NULL,
    now(),
    now()
  FROM boundary_variant_seed seed
  JOIN coaching.exercise_definition_v1 definition
    ON definition.slug = seed.slug
   AND definition.id = ANY(target_ids)
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id = definition.id
   AND variant.variant_key = seed.variant_key
  CROSS JOIN (
    VALUES ('technicalComplexity'), ('absoluteLoadDemand')
  ) AS dimension(dimension)
  ON CONFLICT (
    facility_id,
    variant_id,
    dimension,
    version
  )
  DO UPDATE SET
    proposed_score = EXCLUDED.proposed_score,
    anchor_tier = EXCLUDED.anchor_tier,
    rationale = EXCLUDED.rationale,
    status = 'review',
    reviewed_by = NULL,
    review_notes = EXCLUDED.review_notes,
    reviewed_at = NULL,
    updated_at = now();

  UPDATE coaching.exercise_score_v1 score
  SET technical_complexity = seed.technical_complexity,
      absolute_load_demand = seed.physical_difficulty,
      coordination_demand = greatest(seed.technical_complexity, 20),
      supervision_demand = seed.supervision_demand,
      impact = seed.impact,
      base_overall_difficulty =
        greatest(seed.technical_complexity, seed.physical_difficulty),
      legacy_scores = score.legacy_scores || jsonb_build_object(
        'candidateReassessment', migration_key,
        'difficultyModel',
          'max_exercise_complexity_physical_difficulty',
        'independentCalibrationRequired', TRUE
      ),
      migration_confidence = 70,
      human_review_status = 'queued',
      reviewed_by = NULL,
      reviewed_at = NULL,
      review_notes =
        'Research-backed candidate reassessment only; exact variant and independent calibration remain required.',
      updated_at = now()
  FROM (
    SELECT DISTINCT ON (slug)
      slug,
      technical_complexity,
      physical_difficulty,
      supervision_demand,
      impact
    FROM boundary_variant_seed
    ORDER BY slug, technical_complexity, physical_difficulty
  ) seed
  JOIN coaching.exercise legacy
    ON legacy.slug = seed.slug
  WHERE score.exercise_id = legacy.id;

  UPDATE coaching.exercise legacy
  SET name = seed.canonical_name,
      description = seed.description,
      instructions = seed.legacy_instructions,
      card_summary = seed.legacy_summary,
      coach_language = seed.legacy_coach_language,
      athlete_language = seed.legacy_athlete_language,
      movement_family = seed.legacy_family,
      primary_phase_key = seed.legacy_phase,
      phase_subrole = seed.legacy_subrole,
      primary_order_slot = replace(seed.slug, '-', '_'),
      archived = TRUE,
      is_published = FALSE,
      why_publish_ready = FALSE,
      skill_level = NULL,
      scalable_variables = ARRAY[
        'exact_variant',
        'range_or_amplitude',
        'load_or_ball',
        'target_or_constraint',
        'repetitions_or_attempts',
        'rest',
        'tempo_or_intent',
        'quality_gate'
      ]::TEXT[],
      movement_requirements = jsonb_build_object(
        'exactVariantRequired', TRUE,
        'selectableExactVariant', FALSE,
        'canonicalDefinitionStatus', 'review',
        'publicationQuarantined', TRUE
      ),
      coaching_execution = jsonb_build_object(
        'qualityGate',
          seed.coach_support_json -> 'qualityGate',
        'stopSigns',
          seed.coach_support_json -> 'immediateStop',
        'observationPriorities',
          seed.coach_support_json -> 'observationPriorities'
      ),
      programming_logic = jsonb_build_object(
        'difficultyModel',
          'max_exercise_complexity_physical_difficulty',
        'identityRule', 'select_exact_reviewed_variant',
        'fatigueRule',
          'stop_before_quality_output_position_contact_target_breath_or_logistics_decline',
        'substitutionRule',
          'record_every_identity_or_symptom_related_change'
      ),
      media_library = jsonb_build_object(
        'candidateCount', 5,
        'approvalStatus', 'human_review_required',
        'approvedVideoUrl', NULL
      ),
      updated_at = now()
  FROM boundary_definition_seed seed
  WHERE legacy.slug = seed.slug;

  UPDATE coaching.exercise_scaling_profile scaling
  SET skill_level = NULL,
      load_guidance = trim(
        coalesce(scaling.load_guidance, '')
        || ' Select the exact variant, range or amplitude, load or ball, target or constraint, dose, rest, and intent from current pain-free control; this is exercise difficulty and readiness guidance, not an exercise skill level.'
      )
  FROM boundary_definition_seed seed
  JOIN coaching.exercise legacy
    ON legacy.slug = seed.slug
  WHERE scaling.exercise_id = legacy.id
    AND coalesce(scaling.load_guidance, '') NOT LIKE
      '%this is exercise difficulty and readiness guidance, not an exercise skill level.%';

  UPDATE coaching.exercise_scaling_profile scaling
  SET skill_level = NULL
  FROM boundary_definition_seed seed
  JOIN coaching.exercise legacy
    ON legacy.slug = seed.slug
  WHERE scaling.exercise_id = legacy.id;

  UPDATE coaching.exercise_safety_profile safety
  SET minimum_skill_level = NULL,
      minimum_prerequisite_notes =
        'Pain-free exact setup and movement contract; controlled quality gate, logistics, stop response, and full reset.',
      requires_coach_supervision = 'required'
  FROM boundary_definition_seed seed
  JOIN coaching.exercise legacy
    ON legacy.slug = seed.slug
  WHERE safety.exercise_id = legacy.id;

  UPDATE coaching.exercise_card_test_packet_v1 packet
  SET status = 'quarantined',
      blocking_issues_json =
        packet.blocking_issues_json
        || jsonb_build_array(
          jsonb_build_object(
            'code', 'HUMAN-REVIEW-REQUIRED',
            'category', 'publication',
            'message',
              'Structural completion does not create human, media, graph, calibration, or publication approval.'
          )
        ),
      human_review_required = TRUE,
      checked_at = now()
  WHERE packet.definition_id = ANY(target_ids);
END
$$;
