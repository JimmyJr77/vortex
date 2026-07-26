-- Structurally complete the researched Pallof Press and Pallof Step-Out cards
-- after migration 345 consolidates their fragmented source identities.
--
-- Creates twelve exact review-only variants and delivery profiles, sixteen
-- evidence sections per card, five current oEmbed-healthy media candidates per
-- card, alternate classifications, relationship proposals, and calibration
-- proposals. It intentionally creates no human, media, graph, calibration, or
-- publication approval. Exercise difficulty is exercise complexity plus
-- physical difficulty and overall is their maximum. Exercise cards receive no
-- skill or proficiency level. IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '346_coaching_pallof_press_step_out_family_completion';
  target_ids UUID[];
  facility BIGINT;
  protected_records INTEGER;
  unexpected_variants INTEGER;
BEGIN
  SELECT array_agg(id ORDER BY slug), min(facility_id)
  INTO target_ids, facility
  FROM coaching.exercise_definition_v1
  WHERE slug IN (
      'pallof-press-pallof-hold',
      'pallof-press-step-out'
    )
    AND status <> 'archived';

  IF coalesce(array_length(target_ids, 1), 0) <> 2 THEN
    RAISE EXCEPTION
      'Pallof family completion requires exactly two active survivors';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_definition_v1
    WHERE id = ANY(target_ids)
      AND facility_id <> facility
  ) THEN
    RAISE EXCEPTION
      'Pallof family completion requires both survivors in one facility';
  END IF;

  IF (
    SELECT COUNT(*)
    FROM coaching.exercise_definition_source_v1 source
    WHERE source.definition_id = ANY(target_ids)
  ) < 17 THEN
    RAISE EXCEPTION
      'Pallof family completion requires all 17 preserved legacy source mappings';
  END IF;

  IF (
    SELECT COUNT(*)
    FROM coaching.exercise_identity_resolution_v1 resolution
    JOIN coaching.exercise_definition_v1 survivor
      ON survivor.id = resolution.survivor_definition_id
    JOIN coaching.exercise_definition_v1 resolved
      ON resolved.id = resolution.resolved_definition_id
    WHERE resolution.decision = 'duplicate_consolidated'
      AND (
        (
          survivor.slug = 'pallof-press-pallof-hold'
          AND resolved.slug IN (
            'anti-rotation-cable-press-out',
            'band-pallof-press',
            'half-kneeling-pallof-press',
            'pallof-press-eccentric-return',
            'pallof-press-reps',
            'partner-pallof-band-hold',
            'split-stance-cable-pallof-iso-hold',
            'split-stance-pallof-press'
          )
        )
        OR (
          survivor.slug = 'pallof-press-step-out'
          AND resolved.slug IN (
            'band-anti-rotation-walkout',
            'cable-anti-rotation-step-out'
          )
        )
      )
  ) <> 10 THEN
    RAISE EXCEPTION
      'Pallof family completion requires all direct migration 345 consolidations';
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
      FROM coaching.exercise_delivery_profile_v1 profile
      JOIN coaching.exercise_variant_v1 variant
        ON variant.id = profile.variant_id
      WHERE variant.definition_id = ANY(target_ids)
        AND profile.status = 'published'
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
      JOIN coaching.exercise_variant_v1 variant
        ON variant.id = calibration.variant_id
      WHERE variant.definition_id = ANY(target_ids)
        AND (
          calibration.status <> 'review'
          OR calibration.reviewed_by IS NOT NULL
          OR calibration.reviewed_at IS NOT NULL
        )
    )
  INTO protected_records;

  IF protected_records > 0 THEN
    RAISE EXCEPTION
      'Pallof family completion refused to overwrite % protected record(s)',
      protected_records;
  END IF;

  SELECT COUNT(*)
  INTO unexpected_variants
  FROM coaching.exercise_variant_v1
  WHERE definition_id = ANY(target_ids)
    AND status <> 'archived'
    AND variant_key NOT IN (
      'baseline',
      'legacy-generic-baseline',
      'standing-band-repetition',
      'standing-cable-repetition',
      'standing-cable-isometric-hold',
      'half-kneeling-band-repetition',
      'tall-kneeling-band-isometric-hold',
      'split-stance-cable-isometric-hold',
      'standing-cable-four-second-return',
      'partner-anchored-band-isometric-hold',
      'band-hands-at-chest-step-out',
      'band-arms-extended-step-out',
      'cable-hands-at-chest-step-out',
      'cable-arms-extended-step-out'
    );

  IF unexpected_variants > 0 THEN
    RAISE EXCEPTION
      'Pallof family completion found % unexpected active variant(s)',
      unexpected_variants;
  END IF;

  CREATE TEMP TABLE pallof_definition_seed (
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

  INSERT INTO pallof_definition_seed VALUES
    (
      'pallof-press-pallof-hold',
      'Pallof Press',
      'fixed_stance_side_anchored_anti_rotation_press',
      ARRAY[
        'Anti-Rotation Cable Press-Out',
        'Band Pallof Press',
        'Cable Pallof Press',
        'Half-Kneeling Pallof Press',
        'Pallof Hold',
        'Pallof Press Eccentric Return',
        'Pallof Press Iso Hold',
        'Pallof Press Reps',
        'Partner Pallof Band Hold',
        'Split-Stance Pallof Press',
        'Tall-Kneeling Pallof Press Hold'
      ]::TEXT[],
      'Stand, half-kneel, tall-kneel, or hold an exact split stance side-on to a secure band anchor, inspected cable station, or supervised partner anchor. Hold the resistance with both hands at the sternum, preserve the declared foot, knee, hip, pelvis, rib-cage, and head position, press horizontally to the declared reach or maintain that reach, breathe, and return without rotation, lateral lean, stance drift, or uncontrolled recoil.',
      ARRAY['brace', 'push']::TEXT[],
      ARRAY[
        'core',
        'spine',
        'pelvis',
        'rib_cage',
        'hip',
        'shoulder',
        'elbow',
        'hand'
      ]::TEXT[],
      ARRAY[]::TEXT[],
      ARRAY[
        'anchor_point',
        'bands',
        'cable_machine',
        'mat',
        'partner'
      ]::TEXT[],
      '{
        "primaryMuscles":[
          "internal_and_external_obliques",
          "transversus_abdominis",
          "rectus_abdominis",
          "multifidus_and_erector_spinae"
        ],
        "secondaryMuscles":[
          "gluteus_maximus_and_medius",
          "hip_rotators",
          "serratus_anterior",
          "pectoralis_major",
          "triceps_brachii",
          "forearm_and_hand_stabilizers"
        ],
        "joints":[
          "spine",
          "pelvis",
          "hip",
          "knee",
          "ankle",
          "shoulder",
          "elbow",
          "wrist_and_hand"
        ],
        "jointActions":[
          "trunk_anti_rotation_and_anti_lateral_flexion",
          "declared_stance_isometric_control",
          "bilateral_horizontal_shoulder_flexion_and_elbow_extension",
          "controlled_elbow_flexion_and_shoulder_extension_to_return"
        ],
        "planes":[
          "transverse_anti_rotation",
          "frontal_anti_lateral_flexion",
          "sagittal_horizontal_press_and_return"
        ],
        "laterality":"asymmetrical_side_anchor_with_bilateral_hand_press_and_both_sides_prescribed"
      }'::JSONB,
      '{
        "surface":"level_dry_high_traction_floor",
        "anchor":"secure_fixed_band_anchor_inspected_cable_station_or_supervised_partner",
        "anchorHeight":"declared_at_sternum_unless_variant_says_otherwise",
        "band":"intact_correctly_routed_and_recoil_lane_clear",
        "cable":"pin_attachment_cable_and_stack_travel_inspected",
        "kneelingSupport":"clean_mat_when_required",
        "clearance":"full_press_path_and_lateral_recoil_lane_clear",
        "traffic":"one_athlete_per_declared_station_side",
        "lighting":"hands_ribs_pelvis_knees_and_feet_visible",
        "coachSightline":"front_oblique_or_side_view_of_press_path_and_rotation"
      }'::JSONB,
      '{
        "readiness":[
          "can_hold_declared_stance_without_pain_or_instability",
          "can_breathe_while_bracing",
          "can_press_both_hands_without_visible_trunk_rotation",
          "can_control_the_return_without_recoil",
          "understands_anchor_side_and_side_change"
        ],
        "contraindicationFlags":[
          "pain_neurologic_or_pressure_symptoms",
          "dizziness_breath_panic_or_uncontrolled_breath_holding",
          "unsafe_anchor_band_cable_mat_floor_or_clearance",
          "cannot_prevent_rotation_lateral_lean_or_stance_drift",
          "unassessed_recent_surgery_injury_or_rehabilitation_restriction"
        ],
        "selectionBoundary":"Select exact stance, resistance source, load, anchor side, reach, repetition or hold dose, return tempo, and rest from current control. These are exercise difficulty and readiness variables, not exercise skill levels."
      }'::JSONB,
      '{
        "primaryCue":"Side-on, ribs over pelvis, press straight out, do not turn, breathe, return under control.",
        "selfChecks":[
          "My hands travel straight from my sternum.",
          "My ribs and pelvis stay facing forward.",
          "My feet or knees keep the declared stance.",
          "I can breathe and control the return."
        ],
        "painGuidance":"Stop for pain, numbness, dizziness, pressure symptoms, breath panic, anchor or cable fault, band damage, recoil loss, trunk turn, lateral lean, stance drift, or lost hand path.",
        "accessibility":[
          "lighter_resistance",
          "closer_anchor_distance",
          "shorter_reach",
          "wider_stance",
          "supported_kneeling",
          "shorter_hold_or_fewer_repetitions",
          "longer_rest",
          "plain_text_image_audio_or_live_instruction"
        ]
      }'::JSONB,
      '{
        "primaryCues":[
          "Square ribs and pelvis.",
          "Hands start at sternum.",
          "Press straight ahead.",
          "No turn or side bend.",
          "Breathe and control the return."
        ],
        "qualityGate":"Count only repetitions or hold seconds with the exact stance, straight hand path, stable ribs and pelvis, no rotation or lateral lean, quiet breath, and controlled return.",
        "observationPriorities":[
          "anchor_and_resistance_setup",
          "stance_and_side_assignment",
          "hand_path_and_reach",
          "rib_pelvis_rotation_or_lateral_lean",
          "knee_foot_or_kneeling_drift",
          "breathing_fatigue_and_controlled_return"
        ],
        "immediateStop":[
          "symptoms_or_breath_panic",
          "anchor_band_cable_mat_floor_or_clearance_failure",
          "uncontrolled_recoil_or_grip_loss",
          "rotation_lateral_lean_stance_or_hand_path_failure"
        ],
        "recordAfterSet":[
          "variant_stance_resistance_and_anchor_side",
          "load_band_or_cable_setting_and_anchor_distance",
          "quality_repetitions_or_hold_seconds",
          "reach_tempo_rest_symptoms_and_stop_reason",
          "rotation_lean_stance_breath_or_return_errors"
        ]
      }'::JSONB,
      '{
        "selectionInputs":[
          "training_intent",
          "symptoms_and_readiness",
          "available_band_cable_anchor_mat_or_partner",
          "stance_and_anchor_side",
          "reach_dose_tempo_and_rest",
          "available_time",
          "trunk_shoulder_grip_and_total_session_fatigue_budgets"
        ],
        "substitutionPolicy":{
          "mustPreserve":[
            "side_anchored_anti_rotation",
            "fixed_declared_stance",
            "bilateral_horizontal_press_or_hold",
            "controlled_breath_and_return"
          ],
          "neverSilent":[
            "fixed_stance_to_step_out_or_march",
            "horizontal_press_to_row_pulldown_lift_rotation_or_overhead_path",
            "band_cable_or_partner_anchor_change",
            "stance_or_side_change",
            "symptom_related_change"
          ]
        },
        "feedbackCapture":[
          "valid_repetitions_or_hold_seconds",
          "resistance_and_anchor_distance",
          "position_path_breath_or_return_error",
          "symptoms",
          "substitution_reason",
          "coach_override"
        ]
      }'::JSONB,
      'pallof-press-step-out-family-v1',
      82,
      72,
      40,
      'Fixed-stance side-anchored bilateral horizontal anti-rotation press or hold with exact stance, resistance, dose, quality gate, and controlled return.',
      'Declare stance, resistance, anchor side, reach, repetitions or hold, return tempo, rest, and stop signal. Start at the sternum, press straight ahead without turning, breathe, and return under control.',
      'Inspect the station, declare the exact variant and side, observe hand path, ribs, pelvis, stance, breath, fatigue, return, symptoms, and stop response.',
      'Stay square, press straight out, breathe, and return without turning.',
      'Fixed-stance Pallof anti-rotation press',
      'resilience',
      'trunk_control'
    ),
    (
      'pallof-press-step-out',
      'Pallof Step-Out',
      'side_anchored_anti_rotation_lateral_step_out',
      ARRAY[
        'Anti-Rotation Walkout',
        'Band Anti-Rotation Walkout',
        'Cable Anti-Rotation Step-Out',
        'Lateral Pallof Walk',
        'Pallof Lateral Walk-Out',
        'Pallof Press Step-Out',
        'Pallof Press Walkout',
        'Pallof Walkout'
      ]::TEXT[],
      'Stand side-on to a secure band anchor or inspected cable station with both hands at the sternum or the declared horizontal reach. Preserve the declared hand position, rib-pelvis orientation, hip-knee-foot alignment, and quiet breathing while taking the exact number of lateral steps away from the anchor and then returning along the same path without rotation, lateral lean, foot drag, crossover, or uncontrolled recoil.',
      ARRAY['brace', 'locomote']::TEXT[],
      ARRAY[
        'core',
        'spine',
        'pelvis',
        'rib_cage',
        'hip',
        'knee',
        'ankle',
        'foot',
        'shoulder',
        'elbow',
        'hand'
      ]::TEXT[],
      ARRAY[]::TEXT[],
      ARRAY['anchor_point', 'bands', 'cable_machine']::TEXT[],
      '{
        "primaryMuscles":[
          "internal_and_external_obliques",
          "transversus_abdominis",
          "rectus_abdominis",
          "multifidus_and_erector_spinae",
          "gluteus_medius_and_minimus"
        ],
        "secondaryMuscles":[
          "gluteus_maximus",
          "hip_adductors_and_rotators",
          "quadriceps",
          "gastrocnemius_and_soleus",
          "intrinsic_foot_muscles",
          "serratus_anterior",
          "forearm_and_hand_stabilizers"
        ],
        "joints":[
          "spine",
          "pelvis",
          "hip",
          "knee",
          "ankle",
          "foot",
          "shoulder",
          "elbow",
          "wrist_and_hand"
        ],
        "jointActions":[
          "trunk_anti_rotation_and_anti_lateral_flexion",
          "lateral_hip_abduction_adduction_and_stance_control",
          "controlled_knee_and_ankle_flexion_extension_during_steps",
          "declared_bilateral_hand_position_isometric",
          "same_path_lateral_return"
        ],
        "planes":[
          "frontal_lateral_travel",
          "transverse_anti_rotation",
          "sagittal_postural_and_hand_position_control"
        ],
        "laterality":"asymmetrical_side_anchor_with_bilateral_hand_constraint_and_both_travel_directions_prescribed"
      }'::JSONB,
      '{
        "surface":"level_dry_high_traction_floor",
        "anchor":"secure_fixed_band_anchor_or_inspected_cable_station",
        "anchorHeight":"declared_at_sternum",
        "band":"intact_correctly_routed_and_recoil_lane_clear",
        "cable":"pin_attachment_cable_and_stack_travel_inspected",
        "travelLane":"marked_clear_lateral_lane_with_return_space",
        "clearance":"hands_body_feet_cable_and_band_recoil_clear",
        "traffic":"one_athlete_per_marked_station_lane",
        "lighting":"hands_ribs_pelvis_knees_feet_and_lane_visible",
        "coachSightline":"front_oblique_view_of_hand_position_rotation_and_each_step"
      }'::JSONB,
      '{
        "readiness":[
          "can_hold_declared_hand_position_without_rotation",
          "can_laterally_step_and_return_without_pain_or_instability",
          "can_keep_feet_forward_without_drag_or_crossover",
          "can_breathe_under_asymmetrical_tension",
          "understands_anchor_side_step_count_direction_and_stop"
        ],
        "contraindicationFlags":[
          "pain_neurologic_pressure_or_balance_symptoms",
          "dizziness_breath_panic_or_uncontrolled_breath_holding",
          "unsafe_anchor_band_cable_floor_lane_or_traffic",
          "cannot_control_rotation_lean_footwork_or_recoil",
          "unassessed_recent_surgery_injury_or_rehabilitation_restriction"
        ],
        "selectionBoundary":"Select resistance source, hand position, anchor side, tension, step count, step width, travel distance, dose, and rest from current control. These are exercise complexity and physical difficulty variables, not exercise skill levels."
      }'::JSONB,
      '{
        "primaryCue":"Stay square, hold the hands still, step away, bring the feet together without dragging, then return the same way.",
        "selfChecks":[
          "My hands stay at the declared position.",
          "My ribs and pelvis keep facing forward.",
          "My feet step without crossing or dragging.",
          "I control both the away and return directions."
        ],
        "painGuidance":"Stop for pain, numbness, dizziness, pressure symptoms, breath panic, anchor or cable fault, band damage, recoil loss, trunk turn, lean, balance loss, crossover, foot drag, or lane conflict.",
        "accessibility":[
          "lighter_resistance",
          "hands_at_sternum",
          "smaller_steps",
          "one_step_out_and_return",
          "fewer_repetitions",
          "longer_rest",
          "high_contrast_lane_marks",
          "plain_text_image_audio_or_live_instruction"
        ]
      }'::JSONB,
      '{
        "primaryCues":[
          "Hands stay fixed.",
          "Ribs and pelvis stay square.",
          "Small lateral steps.",
          "No drag or crossover.",
          "Return the same path under control."
        ],
        "qualityGate":"Count only complete away-and-return cycles with exact hand position, no trunk rotation or lateral lean, controlled small lateral steps, no foot drag or crossover, clear lane, quiet breath, and controlled recoil.",
        "observationPriorities":[
          "anchor_resistance_and_lane_setup",
          "hand_position_and_anchor_side",
          "rib_pelvis_rotation_or_lateral_lean",
          "step_direction_width_count_and_foot_clearance",
          "knee_foot_alignment_balance_and_return_path",
          "breathing_fatigue_recoil_and_traffic"
        ],
        "immediateStop":[
          "symptoms_dizziness_or_balance_loss",
          "anchor_band_cable_floor_lane_or_traffic_failure",
          "uncontrolled_recoil_or_grip_loss",
          "rotation_lean_hand_position_crossover_drag_or_return_failure"
        ],
        "recordAfterSet":[
          "variant_resistance_hand_position_and_anchor_side",
          "load_band_or_cable_setting_and_anchor_distance",
          "step_count_width_distance_and_quality_cycles",
          "rest_symptoms_stop_reason_and_substitution",
          "rotation_lean_hand_footwork_breath_or_recoil_errors"
        ]
      }'::JSONB,
      '{
        "selectionInputs":[
          "training_intent",
          "symptoms_balance_and_readiness",
          "available_band_cable_anchor_and_lane",
          "hand_position_anchor_side_and_tension",
          "step_count_width_distance_dose_and_rest",
          "available_time",
          "trunk_hip_footwork_grip_and_total_session_fatigue_budgets"
        ],
        "substitutionPolicy":{
          "mustPreserve":[
            "side_anchored_anti_rotation",
            "declared_bilateral_hand_position",
            "lateral_steps_away_and_same_path_return",
            "controlled_breath_footwork_and_recoil"
          ],
          "neverSilent":[
            "step_out_to_fixed_stance_press_or_march",
            "hands_at_sternum_to_arms_extended",
            "band_to_cable",
            "lateral_to_diagonal_or_overhead_travel",
            "planned_to_reactive",
            "symptom_related_change"
          ]
        },
        "feedbackCapture":[
          "valid_away_and_return_cycles",
          "resistance_anchor_distance_and_step_distance",
          "position_hand_footwork_breath_or_recoil_error",
          "symptoms",
          "substitution_reason",
          "coach_override"
        ]
      }'::JSONB,
      'pallof-press-step-out-family-v1',
      82,
      72,
      40,
      'Side-anchored anti-rotation lateral step-out with exact hand position, travel and return, equipment, dosage, fatigue, quality gate, and stop rules.',
      'Declare resistance, hand position, anchor side, step count and width, repetitions, rest, and stop signal. Stay square, step away, bring the feet together, then return along the same path under control.',
      'Inspect anchor and lane, declare exact variant and side, observe hands, ribs, pelvis, feet, knees, step count, return, breath, recoil, symptoms, and stop response.',
      'Keep hands and trunk quiet, take small side steps away, then return the same path.',
      'Pallof anti-rotation lateral step-out',
      'resilience',
      'trunk_and_lateral_step_control'
    );

  UPDATE coaching.exercise_variant_v1
  SET variant_key = 'legacy-generic-baseline',
      display_name = 'Legacy Generic Baseline',
      status = 'archived',
      difficulty_json = difficulty_json
        - 'skillLevel'
        - 'skill_level'
        - 'proficiencyLevel'
        - 'proficiency_level',
      requirements_json = requirements_json
        - 'skillLevel'
        - 'skill_level'
        - 'proficiencyLevel'
        - 'proficiency_level'
        || jsonb_build_object(
          'selectable', FALSE,
          'identityQuarantine', TRUE,
          'quarantineReason',
            'The legacy baseline does not declare exact stance, resistance source, anchor, hand position, dose mode, travel, return, logistics, quality gate, or stop contract.'
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
          || ARRAY[
            definition.canonical_name,
            definition.display_name
          ]::TEXT[]
        ) AS alias_value
        WHERE btrim(alias_value) <> ''
          AND lower(btrim(alias_value)) <>
            lower(seed.canonical_name)
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
      provenance_json = definition.provenance_json
        || jsonb_build_object(
          'researchBatch', seed.research_batch,
          'researchVersion', '2026-07-26.43',
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
  FROM pallof_definition_seed seed
  WHERE definition.slug = seed.slug
    AND definition.id = ANY(target_ids);

  CREATE TEMP TABLE pallof_variant_seed (
    slug TEXT NOT NULL,
    variant_key TEXT NOT NULL,
    display_name TEXT NOT NULL,
    modifier_keys TEXT[] NOT NULL,
    stance TEXT NOT NULL,
    resistance_source TEXT NOT NULL,
    anchor_type TEXT NOT NULL,
    hand_position TEXT NOT NULL,
    dose_mode TEXT NOT NULL,
    travel_contract TEXT NOT NULL,
    technical_complexity SMALLINT NOT NULL,
    physical_difficulty SMALLINT NOT NULL,
    supervision_demand SMALLINT NOT NULL,
    failure_consequence SMALLINT NOT NULL,
    impact SMALLINT NOT NULL,
    work_capacity SMALLINT NOT NULL,
    phase_key TEXT NOT NULL,
    equipment_required TEXT[] NOT NULL,
    dosage_json JSONB NOT NULL,
    quality_gate TEXT NOT NULL,
    coach_instructions TEXT NOT NULL,
    athlete_instructions TEXT NOT NULL,
    purpose TEXT NOT NULL,
    expected_adaptation TEXT NOT NULL,
    PRIMARY KEY (slug, variant_key)
  ) ON COMMIT DROP;

  INSERT INTO pallof_variant_seed VALUES
    (
      'pallof-press-pallof-hold',
      'standing-band-repetition',
      'Pallof Press — Standing Band Repetitions',
      ARRAY[
        'standing_parallel',
        'resistance_band',
        'repetitions'
      ]::TEXT[],
      'standing_parallel',
      'resistance_band',
      'fixed_anchor',
      'sternum_to_declared_horizontal_reach',
      'repetitions',
      'fixed_stance_no_travel',
      28, 24, 24, 20, 1, 24,
      'resilience',
      ARRAY['bands', 'anchor_point']::TEXT[],
      '{"sets":[2,3],"repsPerSide":[8,12],"tempo":"2_press_1_pause_3_return","restSeconds":[30,60],"fullResetBetweenSides":true}'::JSONB,
      'Exact standing stance, straight press and return, stable ribs and pelvis, no rotation or lean, quiet breath, and repeatable range.',
      'Inspect the band and anchor, declare side and distance, set a stable stance, observe hand path and trunk position, and stop at the first compensation.',
      'Stand side-on. Start at your sternum, press straight ahead, stay square, breathe, and return slowly.',
      'Build low-to-moderate fixed-stance anti-rotation control through controlled repetitions.',
      'Improved anti-rotation control and repeatable bilateral press mechanics under elastic resistance.'
    ),
    (
      'pallof-press-pallof-hold',
      'standing-cable-repetition',
      'Pallof Press — Standing Cable Repetitions',
      ARRAY[
        'standing_parallel',
        'cable_machine',
        'repetitions'
      ]::TEXT[],
      'standing_parallel',
      'cable_machine',
      'cable_station',
      'sternum_to_declared_horizontal_reach',
      'repetitions',
      'fixed_stance_no_travel',
      30, 28, 22, 22, 1, 28,
      'resilience',
      ARRAY['cable_machine']::TEXT[],
      '{"sets":[2,3],"repsPerSide":[8,12],"tempo":"2_press_1_pause_3_return","restSeconds":[30,60],"fullResetBetweenSides":true}'::JSONB,
      'Exact standing stance, straight cable path and return, stable ribs and pelvis, no rotation or lean, quiet breath, and repeatable range.',
      'Inspect pin, cable and attachment, declare side and load, align the pulley at sternum height, observe path and trunk position, and stop at the first compensation.',
      'Stand side-on. Press the cable straight from your sternum, stay square, breathe, and return under control.',
      'Build fixed-stance anti-rotation strength-control with a declared cable setting.',
      'Improved anti-rotation control and bilateral press mechanics under cable resistance.'
    ),
    (
      'pallof-press-pallof-hold',
      'standing-cable-isometric-hold',
      'Pallof Press — Standing Cable Isometric Hold',
      ARRAY[
        'standing_parallel',
        'cable_machine',
        'isometric_hold'
      ]::TEXT[],
      'standing_parallel',
      'cable_machine',
      'cable_station',
      'declared_horizontal_reach',
      'isometric_hold',
      'fixed_stance_no_travel',
      32, 30, 24, 24, 1, 34,
      'resilience',
      ARRAY['cable_machine']::TEXT[],
      '{"sets":[2,3],"holdSecondsPerSide":[10,25],"restSeconds":[40,75],"fullResetBetweenSides":true}'::JSONB,
      'The declared reach remains fixed for every valid second with stable stance, ribs and pelvis, no turn or lean, quiet breath, and controlled return.',
      'Declare reach, side, cable load and hold time, count only valid seconds, and terminate before drift, breath holding, or recoil.',
      'Press to the target, stay square, breathe through the hold, then return slowly.',
      'Develop time-under-tension anti-rotation control without lateral travel.',
      'Improved fixed-position trunk endurance and breathing under asymmetrical cable tension.'
    ),
    (
      'pallof-press-pallof-hold',
      'half-kneeling-band-repetition',
      'Pallof Press — Half-Kneeling Band Repetitions',
      ARRAY[
        'half_kneeling',
        'resistance_band',
        'repetitions'
      ]::TEXT[],
      'half_kneeling_declared_lead_side',
      'resistance_band',
      'fixed_anchor',
      'sternum_to_declared_horizontal_reach',
      'repetitions',
      'fixed_stance_no_travel',
      34, 26, 28, 24, 1, 28,
      'resilience',
      ARRAY['bands', 'anchor_point', 'mat']::TEXT[],
      '{"sets":[2,3],"repsPerSide":[6,10],"tempo":"2_press_1_pause_3_return","restSeconds":[35,65],"switchLeadSideWithAnchorSide":true,"fullReset":true}'::JSONB,
      'Kneeling contacts and lead side stay exact while hands press straight, ribs and pelvis remain square, breath continues, and return is controlled.',
      'Inspect anchor, band and mat, declare down knee, lead foot and anchor side, observe pelvic drift and press path, and reset fully before changing sides.',
      'Set your half-kneeling stance. Press straight out, keep ribs and pelvis square, breathe, and return.',
      'Train anti-rotation control with a narrower asymmetrical kneeling base.',
      'Improved lumbopelvic and hip control during a half-kneeling bilateral press.'
    ),
    (
      'pallof-press-pallof-hold',
      'tall-kneeling-band-isometric-hold',
      'Pallof Press — Tall-Kneeling Band Isometric Hold',
      ARRAY[
        'tall_kneeling',
        'resistance_band',
        'isometric_hold'
      ]::TEXT[],
      'tall_kneeling',
      'resistance_band',
      'fixed_anchor',
      'declared_horizontal_reach',
      'isometric_hold',
      'fixed_stance_no_travel',
      36, 28, 28, 24, 1, 32,
      'resilience',
      ARRAY['bands', 'anchor_point', 'mat']::TEXT[],
      '{"sets":[2,3],"holdSecondsPerSide":[10,25],"restSeconds":[40,75],"fullResetBetweenSides":true}'::JSONB,
      'Both knees and hips remain aligned while the reach, ribs and pelvis stay fixed, breath continues, and the hands return without recoil.',
      'Inspect anchor, band and mat, set knee width and hip extension, declare side and hold, count only valid seconds, and stop before hip shift or trunk turn.',
      'Kneel tall, squeeze glutes gently, press to the target, stay square, breathe, and return slowly.',
      'Develop anti-rotation control in a tall-kneeling base without foot assistance.',
      'Improved trunk and hip isometric control under asymmetrical elastic tension.'
    ),
    (
      'pallof-press-pallof-hold',
      'split-stance-cable-isometric-hold',
      'Pallof Press — Split-Stance Cable Isometric Hold',
      ARRAY[
        'split_stance',
        'cable_machine',
        'isometric_hold'
      ]::TEXT[],
      'split_stance_declared_lead_side',
      'cable_machine',
      'cable_station',
      'declared_horizontal_reach',
      'isometric_hold',
      'fixed_stance_no_travel',
      38, 32, 26, 26, 1, 36,
      'resilience',
      ARRAY['cable_machine']::TEXT[],
      '{"sets":[2,3],"holdSecondsPerSide":[10,25],"restSeconds":[45,75],"switchLeadSideWithAnchorSide":true,"fullReset":true}'::JSONB,
      'Lead side, foot contacts and reach remain exact with square ribs and pelvis, no turn or lean, quiet breath, and controlled return.',
      'Inspect cable setup, declare lead foot and anchor side, set stance length and width, count only valid seconds, and stop before foot, knee, pelvic, or hand drift.',
      'Set the split stance. Press to the target, stay square over both feet, breathe, and return slowly.',
      'Train anti-rotation control in an asymmetrical split stance.',
      'Improved trunk, hip and stance control during an isometric cable reach.'
    ),
    (
      'pallof-press-pallof-hold',
      'standing-cable-four-second-return',
      'Pallof Press — Standing Cable Four-Second Return',
      ARRAY[
        'standing_parallel',
        'cable_machine',
        'slow_eccentric_return'
      ]::TEXT[],
      'standing_parallel',
      'cable_machine',
      'cable_station',
      'sternum_to_declared_horizontal_reach',
      'repetitions_with_four_second_return',
      'fixed_stance_no_travel',
      34, 30, 24, 24, 1, 34,
      'resilience',
      ARRAY['cable_machine']::TEXT[],
      '{"sets":[2,3],"repsPerSide":[5,8],"tempo":"2_press_1_pause_4_return","restSeconds":[40,75],"fullResetBetweenSides":true}'::JSONB,
      'Every return lasts four controlled seconds with unchanged stance, straight hand path, stable ribs and pelvis, quiet breath, and no cable recoil.',
      'Declare side, load and reach, time every return, and reduce load or stop if the athlete turns, leans, rushes, or loses cable control.',
      'Press out, pause, then take four full seconds to return without turning.',
      'Increase controlled return time and anti-rotation time under tension.',
      'Improved eccentric return control and trunk endurance under cable resistance.'
    ),
    (
      'pallof-press-pallof-hold',
      'partner-anchored-band-isometric-hold',
      'Pallof Press — Partner-Anchored Band Isometric Hold',
      ARRAY[
        'standing_parallel',
        'resistance_band',
        'partner_anchor',
        'isometric_hold'
      ]::TEXT[],
      'standing_parallel',
      'resistance_band',
      'supervised_partner',
      'declared_horizontal_reach',
      'isometric_hold',
      'fixed_stance_no_travel',
      36, 26, 42, 32, 1, 30,
      'resilience',
      ARRAY['bands', 'partner']::TEXT[],
      '{"sets":[2,3],"holdSecondsPerSide":[8,20],"restSeconds":[45,75],"partnerMaintainsFixedPredictableAnchor":true,"fullResetBetweenSides":true}'::JSONB,
      'The partner supplies a fixed predictable anchor while the athlete maintains exact reach, stance, square ribs and pelvis, quiet breath, and controlled release.',
      'Brief both people, inspect the band, mark partner and athlete positions, require a fixed predictable anchor, use a verbal release signal, and stop if either person moves unexpectedly.',
      'Hold the reach and stay square. Your partner keeps the band still. Breathe, then release only on the signal.',
      'Provide a supervised portable Pallof hold when a fixed anchor is unavailable.',
      'Improved anti-rotation control with explicit partner communication and station supervision.'
    ),
    (
      'pallof-press-step-out',
      'band-hands-at-chest-step-out',
      'Pallof Step-Out — Band, Hands at Chest',
      ARRAY[
        'resistance_band',
        'hands_at_chest',
        'lateral_step_out'
      ]::TEXT[],
      'standing_parallel',
      'resistance_band',
      'fixed_anchor',
      'hands_fixed_at_sternum',
      'away_and_return_cycles',
      'declared_lateral_steps_away_and_same_path_return',
      36, 28, 30, 26, 1, 32,
      'resilience',
      ARRAY['bands', 'anchor_point']::TEXT[],
      '{"sets":[2,3],"cyclesPerSide":[4,8],"stepsEachDirection":[1,3],"restSeconds":[40,70],"fullResetBetweenSides":true}'::JSONB,
      'Hands remain at the sternum while every away-and-return cycle preserves square ribs and pelvis, small clear steps, no drag or crossover, quiet breath, and controlled recoil.',
      'Inspect band, anchor and lane, declare side and step count, observe hand position and both feet, and stop at the first turn, lean, drag, crossover, or balance error.',
      'Keep hands at your chest. Take small side steps away, bring your feet together, then return the same way.',
      'Introduce lateral travel under a shorter anti-rotation lever.',
      'Improved anti-rotation and lateral footwork control under elastic resistance.'
    ),
    (
      'pallof-press-step-out',
      'band-arms-extended-step-out',
      'Pallof Step-Out — Band, Arms Extended',
      ARRAY[
        'resistance_band',
        'arms_extended',
        'lateral_step_out'
      ]::TEXT[],
      'standing_parallel',
      'resistance_band',
      'fixed_anchor',
      'hands_fixed_at_declared_horizontal_reach',
      'away_and_return_cycles',
      'declared_lateral_steps_away_and_same_path_return',
      42, 32, 32, 28, 1, 38,
      'resilience',
      ARRAY['bands', 'anchor_point']::TEXT[],
      '{"sets":[2,3],"cyclesPerSide":[3,6],"stepsEachDirection":[1,3],"restSeconds":[45,75],"fullResetBetweenSides":true}'::JSONB,
      'Hands remain at the declared reach while every away-and-return cycle preserves square ribs and pelvis, clear footwork, quiet breath, and controlled elastic recoil.',
      'Inspect band, anchor and lane, set exact reach and side, observe lever position and footwork, and regress to hands at chest at the first compensation.',
      'Hold your arms at the target. Take small side steps away, stay square, then return the same path.',
      'Increase anti-rotation moment arm while retaining controlled lateral travel.',
      'Improved anti-rotation, shoulder-position and lateral footwork control under a longer elastic lever.'
    ),
    (
      'pallof-press-step-out',
      'cable-hands-at-chest-step-out',
      'Pallof Step-Out — Cable, Hands at Chest',
      ARRAY[
        'cable_machine',
        'hands_at_chest',
        'lateral_step_out'
      ]::TEXT[],
      'standing_parallel',
      'cable_machine',
      'cable_station',
      'hands_fixed_at_sternum',
      'away_and_return_cycles',
      'declared_lateral_steps_away_and_same_path_return',
      38, 32, 30, 28, 1, 34,
      'resilience',
      ARRAY['cable_machine']::TEXT[],
      '{"sets":[2,3],"cyclesPerSide":[4,8],"stepsEachDirection":[1,3],"restSeconds":[45,75],"fullResetBetweenSides":true}'::JSONB,
      'Hands remain at the sternum while cable travel, away-and-return footwork, ribs and pelvis, breath, and return remain controlled without lane conflict.',
      'Inspect pin, attachment, cable and lane, declare side and steps, monitor stack and feet, and stop at the first turn, lean, drag, crossover, balance, or cable error.',
      'Keep the handle at your chest. Step sideways away, bring your feet together, then return without turning.',
      'Train lateral travel under a shorter cable anti-rotation lever.',
      'Improved anti-rotation and lateral footwork control under cable resistance.'
    ),
    (
      'pallof-press-step-out',
      'cable-arms-extended-step-out',
      'Pallof Step-Out — Cable, Arms Extended',
      ARRAY[
        'cable_machine',
        'arms_extended',
        'lateral_step_out'
      ]::TEXT[],
      'standing_parallel',
      'cable_machine',
      'cable_station',
      'hands_fixed_at_declared_horizontal_reach',
      'away_and_return_cycles',
      'declared_lateral_steps_away_and_same_path_return',
      44, 36, 32, 30, 1, 40,
      'resilience',
      ARRAY['cable_machine']::TEXT[],
      '{"sets":[2,3],"cyclesPerSide":[3,6],"stepsEachDirection":[1,3],"restSeconds":[50,80],"fullResetBetweenSides":true}'::JSONB,
      'Hands remain at the declared reach while cable travel, away-and-return footwork, ribs and pelvis, breath, and return remain controlled without lane conflict.',
      'Inspect cable and lane, set exact reach, side and step count, monitor stack, lever position and feet, and regress immediately at the first compensation.',
      'Hold the handle at the target. Step sideways away, stay square, then return the same path under control.',
      'Increase moment arm during controlled cable-resisted lateral travel.',
      'Improved anti-rotation, shoulder-position and lateral footwork control under a longer cable lever.'
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
        greatest(
          seed.technical_complexity,
          seed.physical_difficulty
        ),
      'difficultyModel',
        'max_exercise_complexity_physical_difficulty'
    ),
    jsonb_build_object(
      'selectable', TRUE,
      'stance', seed.stance,
      'resistanceSource', seed.resistance_source,
      'anchorType', seed.anchor_type,
      'anchorSide', 'declared_and_both_sides_prescribed',
      'anchorHeight', 'sternum_height',
      'handPosition', seed.hand_position,
      'doseMode', seed.dose_mode,
      'travelContract', seed.travel_contract,
      'returnContract',
        CASE
          WHEN seed.slug = 'pallof-press-step-out'
            THEN 'same_lateral_path_under_control'
          ELSE 'same_sternum_start_under_control'
        END,
      'breathing', 'continuous_no_brace_related_breath_holding',
      'identityRule',
        CASE
          WHEN seed.slug = 'pallof-press-step-out'
            THEN 'side_anchored_anti_rotation_with_declared_lateral_travel_and_return'
          ELSE 'side_anchored_fixed_stance_bilateral_horizontal_press_or_hold'
        END
    ),
    'review',
    jsonb_build_object(
      'loadingType',
        seed.resistance_source
          || '_side_anchored_anti_rotation',
      'externalLoadMethod', seed.resistance_source,
      'gripDemand',
        CASE WHEN seed.anchor_type = 'supervised_partner' THEN 18 ELSE 14 END,
      'spinalLoading', 12,
      'eccentricStress',
        CASE
          WHEN seed.dose_mode =
              'repetitions_with_four_second_return'
            THEN 34
          ELSE 18
        END,
      'landingContactsPerRep', 0,
      'primaryStress', jsonb_build_array(
        'trunk_anti_rotation',
        'anti_lateral_flexion',
        'bilateral_hand_and_shoulder_control',
        CASE
          WHEN seed.slug = 'pallof-press-step-out'
            THEN 'lateral_footwork_under_asymmetrical_tension'
          ELSE 'fixed_stance_control_under_asymmetrical_tension'
        END
      )
    ),
    jsonb_build_object(
      'localMuscleFatigue', seed.physical_difficulty,
      'gripFatigue',
        CASE WHEN seed.anchor_type = 'supervised_partner' THEN 18 ELSE 14 END,
      'technicalFatigueSensitivity',
        seed.technical_complexity + 8,
      'impactAccumulation', 1,
      'recoveryHours',
        CASE WHEN seed.physical_difficulty <= 28 THEN 12 ELSE 18 END,
      'failureSignals', jsonb_build_array(
        'trunk_rotation_or_lateral_lean',
        'hand_position_or_path_error',
        'stance_footwork_or_balance_error',
        'breath_holding_or_uncontrolled_recoil',
        'symptoms_or_station_fault'
      )
    ),
    jsonb_build_object(
      'trainingIntent', seed.purpose,
      'identityRule',
        CASE
          WHEN seed.slug = 'pallof-press-step-out'
            THEN 'preserve_lateral_away_and_same_path_return'
          ELSE 'preserve_fixed_stance_press_or_hold'
        END,
      'difficultyModel',
        'max_exercise_complexity_physical_difficulty',
      'fatigueBudgetKeys', jsonb_build_array(
        'trunk_control',
        'shoulder_and_grip',
        CASE
          WHEN seed.slug = 'pallof-press-step-out'
            THEN 'lateral_footwork_and_balance'
          ELSE 'stance_control'
        END
      ),
      'impactBudgetPerCycle', 0,
      'cumulativeBudgetRule',
        'stop_before_position_path_stance_footwork_breath_or_recoil_changes',
      'conditioningUse', FALSE
    ),
    now(),
    now()
  FROM pallof_variant_seed seed
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
    92,
    92,
    jsonb_build_object(
      'primaryIntent', seed.purpose,
      'qualityFirst', TRUE,
      'conditioningUse', FALSE,
      'exactStance', seed.stance,
      'exactTravelContract', seed.travel_contract
    ),
    seed.dosage_json,
    seed.quality_gate,
    ARRAY[
      'Stop for pain, numbness, dizziness, pressure symptoms, breath panic, or balance loss.',
      'Stop for anchor, band, cable, attachment, floor, mat, lane, clearance, traffic, or partner failure.',
      'Stop when trunk rotation, lateral lean, hand path, stance, footwork, breath, grip, or recoil no longer meets the exact contract.'
    ]::TEXT[],
    seed.coach_instructions,
    seed.athlete_instructions,
    seed.expected_adaptation,
    seed.equipment_required,
    jsonb_build_object(
      'participants',
        CASE WHEN seed.anchor_type = 'supervised_partner' THEN 2 ELSE 1 END,
      'station',
        CASE
          WHEN seed.resistance_source = 'cable_machine'
            THEN 'inspected_cable_station'
          WHEN seed.anchor_type = 'supervised_partner'
            THEN 'marked_partner_band_station'
          ELSE 'inspected_fixed_band_anchor_station'
        END,
      'anchorType', seed.anchor_type,
      'anchorHeight', 'sternum_height',
      'surface', 'level_dry_high_traction',
      'lane',
        CASE
          WHEN seed.slug = 'pallof-press-step-out'
            THEN 'marked_clear_lateral_away_and_return_lane'
          ELSE 'fixed_stance_press_and_recoil_clearance'
        END,
      'coachPosition', 'front_oblique_or_side',
      'fullResetRequired', TRUE,
      'sharedStationRule',
        'one_active_athlete_per_anchor_side_or_marked_lane'
    ),
    ARRAY[]::UUID[],
    'review',
    jsonb_build_object(
      'setupSeconds',
        CASE WHEN seed.anchor_type = 'supervised_partner' THEN 45 ELSE 35 END,
      'secondsPerRepetitionOrCycle',
        CASE
          WHEN seed.slug = 'pallof-press-step-out' THEN 8
          WHEN seed.dose_mode =
              'repetitions_with_four_second_return' THEN 8
          ELSE 6
        END,
      'transitionSeconds', 15,
      'sideChangeSeconds', 15,
      'restIncluded', TRUE,
      'durationFormula',
        'setup_plus_declared_sets_dose_side_change_and_rest'
    ),
    jsonb_build_object(
      'regress', jsonb_build_array(
        'lighter_resistance',
        'closer_anchor_distance',
        CASE
          WHEN seed.slug = 'pallof-press-step-out'
            THEN 'hands_at_sternum_or_fewer_smaller_steps'
          ELSE 'shorter_reach_or_wider_stance'
        END,
        'shorter_dose',
        'longer_rest'
      ),
      'progress', jsonb_build_array(
        'slightly_more_resistance',
        'slightly_greater_anchor_distance',
        CASE
          WHEN seed.slug = 'pallof-press-step-out'
            THEN 'longer_hand_lever_or_one_additional_controlled_step'
          ELSE 'longer_owned_reach_hold_or_return'
        END
      ),
      'changeOneVariableAtATime', TRUE
    ),
    jsonb_build_object(
      'unit',
        CASE
          WHEN seed.dose_mode = 'isometric_hold'
            THEN 'valid_hold_seconds_per_side'
          WHEN seed.slug = 'pallof-press-step-out'
            THEN 'valid_away_and_return_cycles_per_side'
          ELSE 'quality_repetitions_per_side'
        END,
      'record', jsonb_build_array(
        'variant_and_anchor_side',
        'resistance_and_anchor_distance',
        'valid_dose',
        'position_path_stance_or_footwork_errors',
        'breath_recoil_symptoms_and_stop_reason'
      )
    ),
    jsonb_build_object(
      'beforeSet',
        'Confirm exact variant, station, side, stance or lane, resistance, dose, rest, quality gate, and stop signal.',
      'duringSet',
        'Capture symptoms, rotation, lean, hand path, stance or footwork, breath, recoil, balance, and station faults.',
      'afterSet',
        'Record valid dose, resistance, anchor distance, errors, symptoms, stop reason, substitution, and coach override.'
    ),
    now(),
    now()
  FROM pallof_variant_seed seed
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

  CREATE TEMP TABLE pallof_evidence_catalog (
    source_key TEXT PRIMARY KEY,
    source_url TEXT NOT NULL,
    source_title TEXT NOT NULL,
    source_publisher TEXT NOT NULL,
    source_kind TEXT NOT NULL,
    evidence_quality SMALLINT NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO pallof_evidence_catalog VALUES
    (
      'nasm',
      'https://blog.nasm.org/progressive-core-training',
      'Core Objectives: Making a Case for Progressive Core Training',
      'National Academy of Sports Medicine',
      'professional_standard',
      84
    ),
    (
      'nsca',
      'https://www.nsca.com/contentassets/8323553f698a466a98220b21d9eb9a65/foundationsoffitnessprogramming_201508.pdf',
      'Foundations of Fitness Programming',
      'National Strength and Conditioning Association',
      'professional_standard',
      87
    ),
    (
      'reliability',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC11244540/',
      'Using Resistance-Band Tests to Evaluate Trunk Muscle Strength in Chronic Low Back Pain: A Test-Retest Reliability Study',
      'Journal of Functional Morphology and Kinesiology',
      'peer_reviewed_research',
      82
    ),
    (
      'position',
      'https://pubmed.ncbi.nlm.nih.gov/40005429/',
      'Effect of Body Position and Support Surface on the Postural Control Challenge During the Pallof Press Exercise: A Smartphone Accelerometer-Based Study',
      'Medicina',
      'peer_reviewed_research',
      84
    ),
    (
      'torque',
      'https://pubmed.ncbi.nlm.nih.gov/2942653/',
      'Electromyographic Studies of the Lumbar Trunk Musculature During the Development of Axial Torques',
      'Journal of Orthopaedic Research',
      'peer_reviewed_research',
      81
    ),
    (
      'youtube',
      'https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en',
      'Embed videos and playlists',
      'YouTube Help',
      'manufacturer_instruction',
      82
    );

  CREATE TEMP TABLE pallof_section_seed (
    section_key TEXT PRIMARY KEY,
    source_key TEXT NOT NULL,
    claim TEXT NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO pallof_section_seed VALUES
    (
      'identity',
      'nasm',
      'Pallof Press is a side-anchored horizontal press with an observable no-rotation contract; adding lateral travel creates a separate step-out identity.'
    ),
    (
      'taxonomy',
      'nsca',
      'Stance, resistance source, anchor side, hand position, dose mode, travel and return are explicit controlled variant dimensions.'
    ),
    (
      'anatomy',
      'torque',
      'Axial-torque control uses bilateral trunk co-contraction with substantial oblique contribution; the card does not claim isolated muscle action.'
    ),
    (
      'biomechanics',
      'nasm',
      'Moment demand changes with resistance, anchor distance, arm reach, stance, base of support and lateral travel while trunk rotation remains constrained.'
    ),
    (
      'difficulty',
      'position',
      'Body position changes postural-control challenge; exact variants use exercise complexity and physical difficulty only, and overall equals their maximum.'
    ),
    (
      'load_fatigue_recovery',
      'reliability',
      'Load progresses only while the initial position remains controlled; trunk, shoulder, grip, stance, breath and footwork fatigue are tracked.'
    ),
    (
      'constraints',
      'nasm',
      'Exact anchor, band or cable, surface, mat, partner, clearance, recoil lane, traffic and observation constraints are declared.'
    ),
    (
      'dosage',
      'nasm',
      'Quality-first repetitions or timed holds use side balance, full reset and sufficient rest to avoid exhaustion-driven compensation.'
    ),
    (
      'instructions',
      'nasm',
      'Coach and athlete instructions name the side-on setup, exact stance, hand path, no-rotation cue, breath, return and stop signal.'
    ),
    (
      'safety_stop_rules',
      'reliability',
      'Symptoms, station failure, uncontrolled recoil, rotation, lean, hand-path error, stance drift, footwork error or balance loss trigger stop.'
    ),
    (
      'programming',
      'nsca',
      'Fixed-stance press variants precede lateral walk-out variants when the athlete cannot yet preserve anti-rotation control during travel.'
    ),
    (
      'athlete_support',
      'nasm',
      'Self-checks, symptom guidance, shorter lever, wider stance, smaller steps, lower resistance, longer rest and nonvideo instruction are available.'
    ),
    (
      'coach_support',
      'position',
      'Coach records body position, support, resistance, side, reach, dose, step contract, compensation, symptoms and why the set ended.'
    ),
    (
      'accessibility',
      'nsca',
      'Exact standing, kneeling, split-stance and reduced-travel options preserve identity when all changed constraints are explicit.'
    ),
    (
      'alternates',
      'nsca',
      'Marches, rows, pulldowns, diagonal lifts, rotations, landmine paths, overhead reaches and reactive perturbations require separate identity review.'
    ),
    (
      'media',
      'youtube',
      'YouTube links are current oEmbed-healthy candidate metadata only; exact match, cue quality, safety, captions, accessibility and approval require human review.'
    );

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
      section.claim,
      'Research batch: pallof-press-step-out-family-v1. Human review remains required.'
    ),
    catalog.evidence_quality,
    'candidate',
    NULL,
    NULL,
    now(),
    now()
  FROM coaching.exercise_definition_v1 definition
  CROSS JOIN pallof_section_seed section
  JOIN pallof_evidence_catalog catalog
    ON catalog.source_key = section.source_key
  WHERE definition.id = ANY(target_ids)
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

  CREATE TEMP TABLE pallof_media_seed (
    slug TEXT NOT NULL,
    video_id TEXT NOT NULL,
    title TEXT NOT NULL,
    channel_name TEXT NOT NULL,
    source_query TEXT NOT NULL,
    notes TEXT NOT NULL,
    PRIMARY KEY (slug, video_id)
  ) ON COMMIT DROP;

  INSERT INTO pallof_media_seed VALUES
    (
      'pallof-press-pallof-hold',
      'axgv7H_VQOo',
      'Pallof Press Exercise Guide — Tutorial, Benefits, Variations',
      'BarBend',
      'Pallof press exercise',
      'Candidate metadata only; exact variants, cues, safety, captions, and accessibility require human viewing.'
    ),
    (
      'pallof-press-pallof-hold',
      'ma2OjgP5XDc',
      'Cable Pallof Press',
      'Warbird Academy',
      'cable Pallof press',
      'Candidate metadata only; exact standing cable contract requires human viewing.'
    ),
    (
      'pallof-press-pallof-hold',
      'y1fOBVtANdM',
      'How to do a Standing Banded Pallof Press',
      'TurnFit - Vancouver Personal Trainers',
      'band Pallof press',
      'Candidate metadata only; exact standing band contract requires human viewing.'
    ),
    (
      'pallof-press-pallof-hold',
      'CRHHSmoakC8',
      'Half-Kneeling Pallof Press with Band',
      'Power Plant Gym',
      'half kneeling Pallof press',
      'Candidate metadata only; exact half-kneeling contract requires human viewing.'
    ),
    (
      'pallof-press-pallof-hold',
      '4a7AYClqdnc',
      'Half-Kneeling Banded Pallof Hold',
      'Greg Lewandowski',
      'half kneeling Pallof hold',
      'Candidate metadata only; exact hold, stance and cue quality require human viewing.'
    ),
    (
      'pallof-press-step-out',
      'iBSUl2wUC1U',
      'Pallof Walkouts',
      'Ochsner Performance Training',
      'Pallof press walkout',
      'Candidate metadata only; exact hand position, step path, cues and safety require human viewing.'
    ),
    (
      'pallof-press-step-out',
      'W7pHDQYeWXY',
      'Pallof Walk Outs',
      'All Out Gym',
      'Pallof press walkout',
      'Candidate metadata only; full contract and accessibility review remain pending.'
    ),
    (
      'pallof-press-step-out',
      'wMvRMDdjslg',
      'Cable Pallof Walkout',
      'Towson Strength and Conditioning',
      'cable Pallof walkout',
      'Candidate metadata only; exact cable setup and travel contract require human viewing.'
    ),
    (
      'pallof-press-step-out',
      'DnmkdxCGFqg',
      'Pallof Press Walkouts',
      'Regain Your Game',
      'Pallof press walkout',
      'Candidate metadata only; full contract and cue review remain pending.'
    ),
    (
      'pallof-press-step-out',
      '7pGx7Z-iVcc',
      'How To Do a Pallof Press Walkout',
      'Swift Movement Academy',
      'Pallof press walkout',
      'Candidate metadata only; exact identity, cue quality, safety, captions and accessibility require human viewing.'
    );

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
  FROM pallof_media_seed seed
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

  CREATE TEMP TABLE pallof_alternate_seed (
    slug TEXT NOT NULL,
    alternate_name TEXT NOT NULL,
    classification TEXT NOT NULL,
    rationale TEXT NOT NULL,
    dimensions JSONB NOT NULL,
    PRIMARY KEY (slug, alternate_name)
  ) ON COMMIT DROP;

  INSERT INTO pallof_alternate_seed VALUES
    ('pallof-press-pallof-hold', 'Standing Band Pallof Press', 'new_variant', 'Elastic resistance changes the load curve while preserving the fixed-stance bilateral horizontal press.', '{"resistanceSource":"resistance_band","stance":"standing_parallel","doseMode":"repetitions"}'),
    ('pallof-press-pallof-hold', 'Standing Cable Pallof Press', 'new_variant', 'Cable resistance changes load and station logistics while preserving the press identity.', '{"resistanceSource":"cable_machine","stance":"standing_parallel"}'),
    ('pallof-press-pallof-hold', 'Half-Kneeling Pallof Press', 'new_variant', 'Half-kneeling changes base of support and lead-side contract without changing the press action.', '{"stance":"half_kneeling","leadSide":"declared"}'),
    ('pallof-press-pallof-hold', 'Tall-Kneeling Pallof Hold', 'new_variant', 'Tall-kneeling and a timed reach hold are stance and dosage modifiers.', '{"stance":"tall_kneeling","doseMode":"isometric_hold"}'),
    ('pallof-press-pallof-hold', 'Split-Stance Pallof Hold', 'new_variant', 'Split stance changes support while the fixed press and anti-rotation contract remain.', '{"stance":"split_stance","doseMode":"isometric_hold"}'),
    ('pallof-press-pallof-hold', 'Pallof Press Four-Second Return', 'new_variant', 'A four-second return changes tempo and fatigue without adding a primary action.', '{"returnTempoSeconds":4}'),
    ('pallof-press-pallof-hold', 'Pallof Step-Out', 'new_definition', 'Lateral travel away from and back toward the anchor adds a primary stepping action.', '{"locomotorAction":"lateral_step_out_and_return"}'),
    ('pallof-press-pallof-hold', 'Pallof Press with March', 'new_definition', 'Alternating hip flexion and single-leg support add a marching and balance contract.', '{"locomotorAction":"alternating_march"}'),
    ('pallof-press-pallof-hold', 'Split-Stance Anti-Rotation Row', 'new_definition', 'A unilateral pulling action is not the bilateral horizontal press.', '{"upperBodyAction":"row"}'),
    ('pallof-press-pallof-hold', 'Half-Kneeling Anti-Rotation Press-Lift Hold', 'new_definition', 'A diagonal lift adds shoulder elevation and a different force path.', '{"handPath":"diagonal_lift"}'),
    ('pallof-press-step-out', 'Band Anti-Rotation Walkout', 'new_variant', 'Band resistance preserves the lateral away-and-return travel identity.', '{"resistanceSource":"resistance_band"}'),
    ('pallof-press-step-out', 'Cable Anti-Rotation Step-Out', 'new_variant', 'Cable resistance changes load and logistics but preserves the travel identity.', '{"resistanceSource":"cable_machine"}'),
    ('pallof-press-step-out', 'Arms-Extended Pallof Walkout', 'new_variant', 'Maintaining the reached position increases moment arm without changing the travel identity.', '{"handPosition":"horizontal_reach"}'),
    ('pallof-press-step-out', 'Hands-at-Chest Pallof Step-Out', 'new_variant', 'A shorter lever is an exact regression within the same lateral travel identity.', '{"handPosition":"sternum"}'),
    ('pallof-press-step-out', 'Fixed-Stance Pallof Press', 'new_definition', 'Removing lateral travel leaves a fixed-stance press or hold.', '{"locomotorAction":"none"}'),
    ('pallof-press-step-out', 'Pallof Press with March', 'new_definition', 'Alternating sagittal hip flexion differs from lateral travel away from the anchor.', '{"locomotorAction":"alternating_march"}'),
    ('pallof-press-step-out', 'Mini-Band Lateral Walk', 'new_definition', 'A lower-limb loop band walk has no side-anchored hand constraint.', '{"resistanceLocation":"lower_limbs","handConstraint":"none"}'),
    ('pallof-press-step-out', 'Pallof Diagonal Walkout', 'new_definition', 'Diagonal travel changes direction, footwork and force-vector management.', '{"travelDirection":"diagonal"}'),
    ('pallof-press-step-out', 'Reactive Partner Pallof Walkout', 'new_definition', 'Unpredictable perturbation adds a reactive decision and supervision contract.', '{"forcePredictability":"reactive_variable"}'),
    ('pallof-press-step-out', 'Overhead Pallof Walkout', 'new_definition', 'Overhead arm position adds shoulder elevation and anti-extension demand.', '{"handPosition":"overhead"}');

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
  FROM pallof_alternate_seed seed
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

  CREATE TEMP TABLE pallof_relation_seed (
    source_slug TEXT NOT NULL,
    source_key TEXT NOT NULL,
    target_slug TEXT NOT NULL,
    target_key TEXT NOT NULL,
    relationship TEXT NOT NULL,
    similarity_score SMALLINT NOT NULL,
    dimensions TEXT[] NOT NULL,
    reason TEXT NOT NULL,
    conditions JSONB NOT NULL,
    PRIMARY KEY (
      source_slug,
      source_key,
      target_slug,
      target_key,
      relationship
    )
  ) ON COMMIT DROP;

  INSERT INTO pallof_relation_seed VALUES
    ('pallof-press-pallof-hold', 'standing-band-repetition', 'pallof-press-pallof-hold', 'half-kneeling-band-repetition', 'progression', 86, ARRAY['stability','complexity']::TEXT[], 'Use only after the standing press is repeatable; the kneeling base changes postural-control demand and lead-side setup.', '{"mustPreserve":["band_resistance","horizontal_press","anti_rotation","side_balance"],"humanApprovalRequired":true,"publicationQuarantined":true}'::JSONB),
    ('pallof-press-pallof-hold', 'half-kneeling-band-repetition', 'pallof-press-pallof-hold', 'standing-band-repetition', 'regression', 86, ARRAY['stability','complexity']::TEXT[], 'Return to the standing base when kneeling position, hip control, symptoms or setup cannot be preserved.', '{"mustPreserve":["band_resistance","horizontal_press","anti_rotation","side_balance"],"humanApprovalRequired":true,"publicationQuarantined":true}'::JSONB),
    ('pallof-press-pallof-hold', 'half-kneeling-band-repetition', 'pallof-press-pallof-hold', 'tall-kneeling-band-isometric-hold', 'progression', 80, ARRAY['stability','complexity','fatigue']::TEXT[], 'Use only when the athlete can own both kneeling contacts and tolerate a declared isometric dose without hip shift or breath compensation.', '{"neverSilent":["stance","dose_mode"],"humanApprovalRequired":true,"publicationQuarantined":true}'::JSONB),
    ('pallof-press-pallof-hold', 'tall-kneeling-band-isometric-hold', 'pallof-press-pallof-hold', 'half-kneeling-band-repetition', 'regression', 80, ARRAY['stability','complexity','fatigue']::TEXT[], 'Regress when tall-kneeling hold position, breathing or time under tension cannot be preserved.', '{"neverSilent":["stance","dose_mode"],"humanApprovalRequired":true,"publicationQuarantined":true}'::JSONB),
    ('pallof-press-step-out', 'band-hands-at-chest-step-out', 'pallof-press-step-out', 'band-arms-extended-step-out', 'progression', 94, ARRAY['leverage','complexity','fatigue']::TEXT[], 'Extend the arms only after the same band step-out is repeatable with hands at the sternum.', '{"mustPreserve":["band_resistance","lateral_away_and_return","step_count","anchor_side"],"humanApprovalRequired":true,"publicationQuarantined":true}'::JSONB),
    ('pallof-press-step-out', 'band-arms-extended-step-out', 'pallof-press-step-out', 'band-hands-at-chest-step-out', 'regression', 94, ARRAY['leverage','complexity','fatigue']::TEXT[], 'Shorten the lever when reach, trunk position, footwork, breath or recoil cannot be preserved.', '{"mustPreserve":["band_resistance","lateral_away_and_return","step_count","anchor_side"],"humanApprovalRequired":true,"publicationQuarantined":true}'::JSONB),
    ('pallof-press-step-out', 'cable-hands-at-chest-step-out', 'pallof-press-step-out', 'cable-arms-extended-step-out', 'progression', 94, ARRAY['leverage','complexity','fatigue']::TEXT[], 'Extend the arms only after the same cable step-out is repeatable with hands at the sternum.', '{"mustPreserve":["cable_resistance","lateral_away_and_return","step_count","anchor_side"],"humanApprovalRequired":true,"publicationQuarantined":true}'::JSONB),
    ('pallof-press-step-out', 'cable-arms-extended-step-out', 'pallof-press-step-out', 'cable-hands-at-chest-step-out', 'regression', 94, ARRAY['leverage','complexity','fatigue']::TEXT[], 'Shorten the lever when reach, trunk position, footwork, breath or cable control cannot be preserved.', '{"mustPreserve":["cable_resistance","lateral_away_and_return","step_count","anchor_side"],"humanApprovalRequired":true,"publicationQuarantined":true}'::JSONB),
    ('pallof-press-pallof-hold', 'standing-band-repetition', 'pallof-press-step-out', 'band-hands-at-chest-step-out', 'progression', 76, ARRAY['complexity','stability','fatigue']::TEXT[], 'Add lateral travel only when fixed-stance band anti-rotation control is repeatable and the training intent calls for footwork integration.', '{"neverSilent":["exercise_identity","lateral_travel","dose_mode"],"humanApprovalRequired":true,"publicationQuarantined":true}'::JSONB),
    ('pallof-press-step-out', 'band-hands-at-chest-step-out', 'pallof-press-pallof-hold', 'standing-band-repetition', 'regression', 76, ARRAY['complexity','stability','fatigue']::TEXT[], 'Remove lateral travel when balance, footwork or trunk control fails while preserving side-anchored band anti-rotation.', '{"neverSilent":["exercise_identity","lateral_travel","dose_mode"],"humanApprovalRequired":true,"publicationQuarantined":true}'::JSONB),
    ('pallof-press-pallof-hold', 'standing-band-repetition', 'pallof-press-pallof-hold', 'standing-cable-repetition', 'lateral_substitution', 78, ARRAY['load','fatigue']::TEXT[], 'Band and cable versions may substitute only when stance, side, reach and dose are preserved and resistance is reassessed.', '{"mustPreserve":["fixed_stance","horizontal_press","anchor_side","reach","dose"],"neverSilent":["resistance_source","load_setting"],"humanApprovalRequired":true}'::JSONB),
    ('pallof-press-pallof-hold', 'standing-cable-repetition', 'pallof-press-pallof-hold', 'standing-band-repetition', 'lateral_substitution', 78, ARRAY['load','fatigue']::TEXT[], 'Cable and band versions may substitute only when stance, side, reach and dose are preserved and resistance is reassessed.', '{"mustPreserve":["fixed_stance","horizontal_press","anchor_side","reach","dose"],"neverSilent":["resistance_source","load_setting"],"humanApprovalRequired":true}'::JSONB),
    ('pallof-press-step-out', 'band-hands-at-chest-step-out', 'pallof-press-step-out', 'cable-hands-at-chest-step-out', 'lateral_substitution', 76, ARRAY['load','fatigue']::TEXT[], 'Band and cable step-outs may substitute only when hand position, side, step count, distance and return path are preserved and resistance is reassessed.', '{"mustPreserve":["hands_at_sternum","lateral_away_and_return","step_count","anchor_side"],"neverSilent":["resistance_source","load_setting"],"humanApprovalRequired":true}'::JSONB),
    ('pallof-press-step-out', 'cable-hands-at-chest-step-out', 'pallof-press-step-out', 'band-hands-at-chest-step-out', 'lateral_substitution', 76, ARRAY['load','fatigue']::TEXT[], 'Cable and band step-outs may substitute only when hand position, side, step count, distance and return path are preserved and resistance is reassessed.', '{"mustPreserve":["hands_at_sternum","lateral_away_and_return","step_count","anchor_side"],"neverSilent":["resistance_source","load_setting"],"humanApprovalRequired":true}'::JSONB);

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
    relation.relationship,
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
  FROM pallof_relation_seed relation
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
      WHEN 'technicalComplexity'
        THEN seed.technical_complexity
      ELSE seed.physical_difficulty
    END,
    CASE
      WHEN (
        CASE dimension.dimension
          WHEN 'technicalComplexity'
            THEN seed.technical_complexity
          ELSE seed.physical_difficulty
        END
      ) <= 30 THEN 20
      WHEN (
        CASE dimension.dimension
          WHEN 'technicalComplexity'
            THEN seed.technical_complexity
          ELSE seed.physical_difficulty
        END
      ) <= 50 THEN 40
      WHEN (
        CASE dimension.dimension
          WHEN 'technicalComplexity'
            THEN seed.technical_complexity
          ELSE seed.physical_difficulty
        END
      ) <= 70 THEN 60
      ELSE 80
    END,
    CASE dimension.dimension
      WHEN 'technicalComplexity' THEN
        'Research-backed candidate based on exact stance, resistance source, anchor, hand position, dose mode, travel, return, side change, and observable coordination gates; independent coach calibration remains required.'
      ELSE
        'Research-backed candidate based on resistance source and magnitude, anchor distance, lever, time under tension, step distance, local fatigue, and recovery; independent coach calibration remains required.'
    END,
    'review',
    1,
    NULL,
    NULL,
    'Candidate calibration proposal only; no human review or approval is implied.',
    NULL,
    now(),
    now()
  FROM pallof_variant_seed seed
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
      coordination_demand =
        greatest(seed.technical_complexity, 20),
      supervision_demand = seed.supervision_demand,
      impact = seed.impact,
      base_overall_difficulty =
        greatest(
          seed.technical_complexity,
          seed.physical_difficulty
        ),
      legacy_scores = score.legacy_scores
        || jsonb_build_object(
          'candidateReassessment', migration_key,
          'difficultyModel',
            'max_exercise_complexity_physical_difficulty',
          'independentCalibrationRequired', TRUE
        ),
      migration_confidence = 72,
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
    FROM pallof_variant_seed
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
        'stance',
        'resistance_source_and_load',
        'anchor_side_and_distance',
        'hand_position_or_reach',
        'repetitions_hold_or_step_count',
        'return_tempo',
        'rest',
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
          'stop_before_position_path_stance_footwork_breath_or_recoil_decline',
        'substitutionRule',
          'record_every_identity_equipment_or_symptom_related_change'
      ),
      media_library = jsonb_build_object(
        'candidateCount', 5,
        'approvalStatus', 'human_review_required',
        'approvedVideoUrl', NULL
      ),
      updated_at = now()
  FROM pallof_definition_seed seed
  WHERE legacy.slug = seed.slug;

  UPDATE coaching.exercise legacy
  SET archived = TRUE,
      is_published = FALSE,
      why_publish_ready = FALSE,
      skill_level = NULL,
      updated_at = now()
  WHERE legacy.id IN (
    SELECT source.legacy_exercise_id
    FROM coaching.exercise_definition_source_v1 source
    WHERE source.definition_id = ANY(target_ids)
  );

  UPDATE coaching.exercise_scaling_profile scaling
  SET skill_level = NULL,
      load_guidance = trim(
        coalesce(scaling.load_guidance, '')
        || ' Select exact stance, resistance, anchor side and distance, hand position, dose, travel, return, rest, and stop rule from current control. This is exercise difficulty and readiness guidance, not an exercise skill level.'
      )
  WHERE scaling.exercise_id IN (
      SELECT source.legacy_exercise_id
      FROM coaching.exercise_definition_source_v1 source
      WHERE source.definition_id = ANY(target_ids)
    )
    AND coalesce(scaling.load_guidance, '') NOT LIKE
      '%This is exercise difficulty and readiness guidance, not an exercise skill level.%';

  UPDATE coaching.exercise_scaling_profile scaling
  SET skill_level = NULL
  WHERE scaling.exercise_id IN (
    SELECT source.legacy_exercise_id
    FROM coaching.exercise_definition_source_v1 source
    WHERE source.definition_id = ANY(target_ids)
  );

  UPDATE coaching.exercise_safety_profile safety
  SET minimum_skill_level = NULL,
      minimum_prerequisite_notes =
        'Pain-free exact setup and movement contract; controlled stance or footwork, hand path, breath, return, logistics, stop response, and full reset.',
      requires_coach_supervision = 'required'
  WHERE safety.exercise_id IN (
    SELECT source.legacy_exercise_id
    FROM coaching.exercise_definition_source_v1 source
    WHERE source.definition_id = ANY(target_ids)
  );

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
END;
$$;
