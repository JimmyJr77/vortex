-- Complete the candidate-only single-leg lateral hop-to-stick family after
-- migration 326 consolidates its line-target duplicate.
--
-- Exact selectable variants:
--   * low-amplitude same-leg lateral hop for landing control
--   * declared-distance same-leg lateral hop for output
--
-- The stance leg, same-leg landing, direction relative to the stance leg,
-- distance, line or target, hold, intent, and dose are explicit. Continuous
-- line hops, bilateral hops, raised hurdles, and contralateral skater bounds
-- remain separate tasks. Exercise difficulty uses exercise complexity and
-- physical difficulty, with overall equal to their maximum. Exercise cards
-- receive no skill or proficiency level. Evidence, media, graph, calibration,
-- and publication remain candidate/review-only. IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT := '327_coaching_single_leg_lateral_hop_stick_family_completion';
  target_definition_id UUID;
  facility BIGINT;
  target_card_version INTEGER;
  protected_records INTEGER;
  unexpected_variants INTEGER;
BEGIN
  SELECT id, facility_id
  INTO target_definition_id, facility
  FROM coaching.exercise_definition_v1
  WHERE slug = 'single-leg-lateral-hop-to-stick'
    AND status <> 'archived';

  IF target_definition_id IS NULL THEN
    RAISE EXCEPTION
      'Single-leg lateral hop-stick completion requires the active survivor definition';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_definition_v1
    WHERE slug = 'lateral-line-hop-to-single-leg-stick'
      AND status <> 'archived'
  ) THEN
    RAISE EXCEPTION
      'Single-leg lateral hop-stick completion requires migration 326 first';
  END IF;

  SELECT
    (
      SELECT COUNT(*)
      FROM coaching.exercise_definition_v1
      WHERE id = target_definition_id
        AND (
          status = 'published'
          OR reviewed_by IS NOT NULL
          OR approved_by IS NOT NULL
          OR last_reviewed_at IS NOT NULL
        )
    )
    + (
      SELECT COUNT(*) FROM coaching.exercise_section_evidence_v1
      WHERE definition_id = target_definition_id
        AND review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id = target_definition_id
        AND review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id = target_definition_id
        AND review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*) FROM coaching.exercise_card_review_v1
      WHERE definition_id = target_definition_id
    )
    + (
      SELECT COUNT(*) FROM coaching.exercise_card_revision_v1
      WHERE definition_id = target_definition_id
    )
    + (
      SELECT COUNT(*) FROM coaching.exercise_media_review_v1
      WHERE definition_id = target_definition_id
    )
    + (
      SELECT COUNT(*) FROM coaching.exercise_variant_v1
      WHERE definition_id = target_definition_id
        AND status = 'published'
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_delivery_profile_v1 profile
      JOIN coaching.exercise_variant_v1 variant ON variant.id = profile.variant_id
      WHERE variant.definition_id = target_definition_id
        AND profile.status = 'published'
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_relationship_v1 relationship
      WHERE (
        relationship.from_variant_id IN (
          SELECT id FROM coaching.exercise_variant_v1
          WHERE definition_id = target_definition_id
        )
        OR relationship.to_variant_id IN (
          SELECT id FROM coaching.exercise_variant_v1
          WHERE definition_id = target_definition_id
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
      JOIN coaching.exercise_variant_v1 variant ON variant.id = calibration.variant_id
      WHERE variant.definition_id = target_definition_id
        AND (
          calibration.status <> 'review'
          OR calibration.reviewed_by IS NOT NULL
          OR calibration.reviewed_at IS NOT NULL
        )
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_score_v1 score
      WHERE score.exercise_id IN (
        SELECT source.legacy_exercise_id
        FROM coaching.exercise_definition_source_v1 source
        WHERE source.definition_id = target_definition_id
      )
        AND (
          score.human_review_status <> 'queued'
          OR score.reviewed_by IS NOT NULL
          OR score.reviewed_at IS NOT NULL
        )
    )
  INTO protected_records;

  IF protected_records > 0 THEN
    RAISE EXCEPTION
      'Single-leg lateral hop-stick completion refused to override % protected records',
      protected_records;
  END IF;

  SELECT COUNT(*)
  INTO unexpected_variants
  FROM coaching.exercise_variant_v1
  WHERE definition_id = target_definition_id
    AND status <> 'archived'
    AND variant_key NOT IN (
      'baseline',
      'baseline-source-1505',
      'low-amplitude-control',
      'distance-output'
    );

  IF unexpected_variants > 0 THEN
    RAISE EXCEPTION
      'Single-leg lateral hop-stick completion found % unexpected active variants',
      unexpected_variants;
  END IF;

  UPDATE coaching.exercise_variant_v1
  SET variant_key = CASE variant_key
        WHEN 'baseline'
          THEN 'legacy-ipsilateral-low-amplitude-source-543'
        WHEN 'baseline-source-1505'
          THEN 'legacy-ipsilateral-output-source-1505'
        ELSE variant_key
      END,
      status = 'archived',
      requirements_json = requirements_json || jsonb_build_object(
        'sourceTakeoffLandingContract', 'ipsilateral_single_leg',
        'sourceAmplitudeContract',
          CASE variant_key
            WHEN 'baseline' THEN 'low_amplitude'
            ELSE 'output_generic'
          END,
        'selectable', FALSE,
        'identityQuarantine', TRUE,
        'quarantineReason',
          'The legacy profile lacks the complete current variant, target, hold, dosage, and stop-rule contract.'
      ),
      updated_at = now()
  WHERE definition_id = target_definition_id
    AND variant_key IN ('baseline', 'baseline-source-1505');

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET status = 'archived',
      updated_at = now()
  FROM coaching.exercise_variant_v1 variant
  WHERE variant.id = profile.variant_id
    AND variant.definition_id = target_definition_id
    AND variant.status = 'archived';

  UPDATE coaching.exercise_definition_v1
  SET card_version = CASE
        WHEN provenance_json->>'structuralCompletionMigration' IS DISTINCT FROM migration_key
          THEN card_version + 1
        ELSE card_version
      END,
      canonical_name = 'Single-Leg Lateral Hop to Stick',
      display_name = 'Single-Leg Lateral Hop to Stick',
      description =
        'From one declared leg, hop laterally to a declared target and land on the same leg. Contact with the whole foot, absorb through the ankle, knee, and hip, control foot-knee-hip-pelvis-trunk alignment, hold without a free-foot touch or extra hop, then reset fully.',
      family_key = 'ipsilateral_single_leg_lateral_hop_to_terminal_stick',
      movement_patterns = ARRAY['jump', 'land', 'brace']::TEXT[],
      body_regions = ARRAY[
        'foot', 'ankle', 'knee', 'hip', 'pelvis', 'core', 'spine'
      ]::TEXT[],
      required_equipment = ARRAY['none']::TEXT[],
      optional_equipment = ARRAY['line_tape', 'cones', 'mat', 'mirror']::TEXT[],
      environment_json = jsonb_build_object(
        'surface', 'level_high_traction_surface_with_declared_footwear_or_barefoot_policy',
        'target', 'declared_high_contrast_line_or_landing_zone',
        'direction', 'declared_relative_to_stance_leg',
        'distance', 'declared_and_repeatable',
        'landingAndFallSpace', 'clear_beyond_target',
        'traffic', 'one_active_athlete_per_marked_lateral_lane',
        'lighting', 'stance_foot_target_landing_foot_and_trunk_clearly_visible',
        'coachSightline', 'takeoff_flight_contact_alignment_hold_and_reset_visible'
      ),
      population_json = jsonb_build_object(
        'readiness', jsonb_build_array(
          'pain_free_single_leg_takeoff_and_landing',
          'can_hold_single_leg_stance_and_floor_step_to_stick',
          'can_control_foot_knee_hip_pelvis_and_trunk_alignment',
          'can_land_whole_foot_without_free_foot_contact',
          'can_follow_leg_direction_distance_hold_reset_and_stop_instructions'
        ),
        'contraindicationFlags', jsonb_build_array(
          'current_foot_ankle_knee_hip_back_pain_swelling_or_instability',
          'numbness_dizziness_or_neurologic_symptoms',
          'uncontrolled_valgus_pelvic_drop_trunk_lean_or_rotation',
          'unsafe_surface_target_space_visibility_or_traffic',
          'unassessed_recent_injury_surgery_or_rehabilitation_restriction'
        ),
        'supervision',
          'direct_observation_until_same_leg_projection_contact_alignment_hold_and_reset_are_repeatable',
        'selectionBoundary',
          'Select exact stance leg, direction, amplitude, target, hold, intent, and dose from current readiness; exercise cards do not carry skill levels.',
        'clinicalBoundary',
          'Pain, swelling, instability, recent surgery, neurologic signs, or rehabilitation restrictions require individualized clinician guidance.'
      ),
      anatomy_json = jsonb_build_object(
        'primaryMuscles', jsonb_build_array(
          'gluteus_maximus', 'gluteus_medius_and_minimus',
          'quadriceps', 'hamstrings', 'gastrocnemius_and_soleus'
        ),
        'secondaryMuscles', jsonb_build_array(
          'hip_adductors_and_rotators', 'tibialis_anterior',
          'fibularis_group', 'intrinsic_foot_muscles',
          'abdominal_wall', 'erector_spinae_and_multifidus'
        ),
        'stabilizers', jsonb_build_array(
          'foot_and_ankle_stabilizers', 'gluteus_medius',
          'hip_rotators_and_adductors', 'abdominal_wall',
          'spinal_stabilizers'
        ),
        'joints', jsonb_build_array(
          'foot', 'ankle', 'knee', 'hip', 'pelvis', 'spine'
        ),
        'jointActions', jsonb_build_array(
          'stance_ankle_knee_and_hip_flexion_during_load',
          'ankle_plantarflexion_knee_extension_and_hip_extension_during_takeoff',
          'hip_abduction_or_adduction_relative_to_target_direction',
          'hip_knee_and_ankle_flexion_during_landing_absorption',
          'frontal_and_transverse_plane_hip_knee_foot_stabilization'
        ),
        'planes', jsonb_build_array(
          'frontal', 'sagittal_absorption', 'transverse_stabilization'
        ),
        'laterality', 'declared_ipsilateral_single_leg_takeoff_and_landing',
        'primaryActions', jsonb_build_array(
          'load_declared_stance_leg',
          'project_laterally_to_declared_target',
          'contact_the_same_declared_foot',
          'absorb_and_stabilize_without_extra_contact',
          'hold_and_reset'
        )
      ),
      athlete_support_json = jsonb_build_object(
        'whyItMatters',
          'This task develops lateral single-leg projection, braking, alignment, balance, and a clean terminal landing.',
        'beforeYouStart', jsonb_build_array(
          'Confirm your stance leg, hop direction, target, distance, hold, and reset.',
          'Check that the surface grips and the target, landing space, and lane are clear.',
          'Begin with a distance you can land without a free-foot touch or extra hop.'
        ),
        'primaryCue',
          'Load, push sideways, land under your hip, absorb quiet, hold, reset.',
        'selfChecks', jsonb_build_array(
          'I take off and land on the same declared foot.',
          'My whole foot lands at the target.',
          'My knee tracks with my foot and my pelvis and trunk stay controlled.',
          'I can freeze without a free-foot touch, extra hop, or foot turn.'
        ),
        'painGuidance',
          'Stop immediately for pain, swelling, numbness, dizziness, instability, a target miss, or a landing you cannot control.',
        'accessibility', jsonb_build_array(
          'shorter_target_distance', 'wider_high_contrast_zone',
          'step_to_single_leg_stick', 'bilateral_landing_regression',
          'fewer_repetitions', 'longer_rest',
          'plain_text_audio_and_live_demonstration'
        )
      ),
      coach_support_json = jsonb_build_object(
        'stationSetup', jsonb_build_array(
          'Declare variant, stance leg, direction, target, distance, hold, dose, rest, and reset.',
          'Inspect traction, target visibility, lateral landing and fall space, lighting, traffic, and observation angle.',
          'Rehearse a step-to-stick and short hop before distance or high intent.'
        ),
        'observationPriorities', jsonb_build_array(
          'same_leg_takeoff_and_landing', 'lateral_projection_and_target',
          'whole_foot_contact_and_landing_sound',
          'foot_knee_hip_pelvis_and_trunk_alignment',
          'absorption_and_stable_hold',
          'free_foot_extra_hop_foot_turn_and_full_reset'
        ),
        'primaryCues', jsonb_build_array(
          'Small load.', 'Push the floor sideways.', 'Land under your hip.',
          'Whole foot, quiet contact.', 'Knee follows toes.',
          'Freeze, then reset.'
        ),
        'qualityGate',
          'Count only a declared same-leg takeoff and landing, target contact, whole-foot quiet absorption, controlled alignment, stable hold, and full reset without symptoms or extra contact.',
        'immediateStop', jsonb_build_array(
          'pain_swelling_numbness_dizziness_instability_or_apprehension',
          'unsafe_surface_target_lane_visibility_or_traffic',
          'target_miss_partial_foot_or_loud_landing',
          'valgus_pelvic_drop_trunk_lean_rotation_or_foot_turn',
          'free_foot_touch_extra_hop_failed_hold_or_output_decline'
        ),
        'recordAfterSet', jsonb_build_array(
          'variant_stance_leg_and_direction', 'distance_target_and_hold',
          'quality_repetitions_per_side_and_rest',
          'target_contact_alignment_hold_or_extra_contact_errors',
          'symptoms_stop_reason_and_substitution'
        )
      ),
      support_operations_json = jsonb_build_object(
        'selectionInputs', jsonb_build_array(
          'training_intent', 'symptoms_swelling_and_readiness',
          'stance_leg_and_direction', 'amplitude_distance_and_target',
          'hold_and_reset', 'available_time',
          'weekly_hop_landing_frontal_plane_and_tendon_budgets'
        ),
        'logistics', jsonb_build_object(
          'participantStructure', 'one_active_athlete_per_marked_lateral_lane',
          'targetInspectionRequired', TRUE,
          'fullResetRequired', TRUE,
          'coachPosition', 'outside_takeoff_landing_fall_and_reset_paths',
          'shutdownControl', 'coach_or_athlete_can_stop_lane_immediately'
        ),
        'substitutionPolicy', jsonb_build_object(
          'mustPreserve', jsonb_build_array(
            'lateral_plane_or_explicit_regression', 'declared_stance_side',
            'terminal_single_leg_control', 'alignment_hold_and_full_reset'
          ),
          'mayAdjust', jsonb_build_array(
            'distance', 'target_size', 'intent', 'hold_time',
            'repetitions', 'rest', 'step_instead_of_hop'
          ),
          'neverSilent', jsonb_build_array(
            'ipsilateral_to_contralateral_landing',
            'single_leg_to_bilateral_landing',
            'discrete_stick_to_continuous_rebound',
            'floor_target_to_raised_hurdle', 'planned_to_reactive',
            'bodyweight_to_external_load', 'symptom_related_change'
          ),
          'uncertaintyRule',
            'When readiness, surface, target, landing, or hold safety is unclear, use a reviewed step-to-stick or static single-leg balance alternative.'
        ),
        'feedbackCapture', jsonb_build_array(
          'pain_swelling_or_symptoms', 'quality_repetitions',
          'distance_or_target_error', 'contact_alignment_or_hold_error',
          'surface_or_lane_issue', 'substitution_reason', 'coach_override'
        )
      ),
      content_confidence = 86,
      scoring_confidence = 66,
      media_confidence = 50,
      approved_video_url = NULL,
      status = 'review',
      reviewed_by = NULL,
      approved_by = NULL,
      last_reviewed_at = NULL,
      provenance_json = provenance_json || jsonb_build_object(
        'identityMigration',
          '326_coaching_single_leg_lateral_hop_stick_identity_consolidation',
        'structuralCompletionMigration', migration_key,
        'researchBatch', 'single-leg-lateral-hop-stick-family-v1',
        'researchVersion', '2026-07-26.36',
        'difficultyModel', 'max_exercise_complexity_physical_difficulty',
        'lineSourceTakeoffContract', 'unresolved_and_archived',
        'exerciseSkillLevelAllowed', FALSE,
        'humanReviewRequired', TRUE,
        'publicationQuarantined', TRUE,
        'mediaApprovalCreated', FALSE,
        'graphApprovalCreated', FALSE,
        'calibrationApprovalCreated', FALSE
      ),
      updated_at = now()
  WHERE id = target_definition_id;

  SELECT card_version
  INTO target_card_version
  FROM coaching.exercise_definition_v1
  WHERE id = target_definition_id;

  CREATE TEMP TABLE single_leg_lateral_hop_variant_seed (
    variant_key TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    intent_contract TEXT NOT NULL,
    distance_contract TEXT NOT NULL,
    modifier_keys TEXT[] NOT NULL,
    exercise_complexity INTEGER NOT NULL,
    physical_difficulty INTEGER NOT NULL,
    coordination_demand INTEGER NOT NULL,
    supervision_demand INTEGER NOT NULL,
    failure_consequence INTEGER NOT NULL,
    impact INTEGER NOT NULL,
    work_capacity_demand INTEGER NOT NULL,
    grip_demand INTEGER NOT NULL,
    spinal_loading INTEGER NOT NULL,
    eccentric_stress INTEGER NOT NULL,
    local_muscle_fatigue INTEGER NOT NULL,
    technical_fatigue_sensitivity INTEGER NOT NULL,
    impact_accumulation INTEGER NOT NULL,
    recovery_hours INTEGER NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO single_leg_lateral_hop_variant_seed VALUES
    (
      'low-amplitude-control',
      'Single-Leg Lateral Hop to Stick — Low-Amplitude Control',
      'landing_control',
      'short_declared_distance',
      ARRAY[
        'ipsilateral_single_leg', 'low_amplitude',
        'terminal_stick', 'full_reset'
      ]::TEXT[],
      42, 36, 58, 56, 54, 42, 24, 2, 24, 54, 48, 72, 46, 36
    ),
    (
      'distance-output',
      'Single-Leg Lateral Hop to Stick — Distance Output',
      'lateral_power_output',
      'challenging_declared_distance_with_quality_limit',
      ARRAY[
        'ipsilateral_single_leg', 'distance_output',
        'terminal_stick', 'full_reset'
      ]::TEXT[],
      50, 48, 68, 64, 62, 54, 28, 2, 28, 64, 56, 82, 56, 42
    );

  INSERT INTO coaching.exercise_variant_v1 (
    definition_id, variant_key, display_name, modifier_keys,
    difficulty_json, requirements_json, load_profile_json,
    fatigue_profile_json, programming_profile_json, status
  )
  SELECT
    target_definition_id,
    seed.variant_key,
    seed.display_name,
    seed.modifier_keys,
    jsonb_build_object(
      'exerciseComplexity', seed.exercise_complexity,
      'technicalComplexity', seed.exercise_complexity,
      'physicalDifficulty', seed.physical_difficulty,
      'absoluteLoadDemand', seed.physical_difficulty,
      'coordinationDemand', seed.coordination_demand,
      'supervisionDemand', seed.supervision_demand,
      'failureConsequence', seed.failure_consequence,
      'impact', seed.impact,
      'workCapacityDemand', seed.work_capacity_demand,
      'baseOverallDifficulty',
        greatest(seed.exercise_complexity, seed.physical_difficulty),
      'overallFormula', 'max_exercise_complexity_physical_difficulty'
    ),
    jsonb_build_object(
      'start', 'declared_single_leg_athletic_stance',
      'takeoffLandingContract', 'ipsilateral_single_leg',
      'projection', 'lateral_to_declared_target',
      'directionRelativeToStanceLeg', 'declared_before_set',
      'distanceContract', seed.distance_contract,
      'landingContact', 'whole_foot_at_declared_target',
      'absorption', 'ankle_knee_hip_with_alignment_control',
      'hold', 'declared_and_stable_without_free_foot_or_extra_hop',
      'completion', 'full_reset_before_next_attempt',
      'selectable', TRUE,
      'identityQuarantine', FALSE
    ),
    jsonb_build_object(
      'gripDemand', seed.grip_demand,
      'spinalLoading', seed.spinal_loading,
      'eccentricStress', seed.eccentric_stress,
      'landingContactsPerRep', 1,
      'externalLoadMethod', 'bodyweight',
      'loadingType', 'single_leg_ballistic_lateral_projection_and_ipsilateral_landing',
      'impactClass', 'moderate_single_leg_lateral_landing',
      'primaryStress', jsonb_build_array(
        'single_leg_lateral_takeoff_impulse',
        'foot_ankle_knee_and_hip_absorption',
        'frontal_plane_hip_and_knee_control',
        'foot_pressure_and_ankle_stability',
        'trunk_and_pelvis_stabilization',
        'balance_hold_and_reset'
      )
    ),
    jsonb_build_object(
      'localMuscleFatigue', seed.local_muscle_fatigue,
      'gripFatigue', 1,
      'technicalFatigueSensitivity', seed.technical_fatigue_sensitivity,
      'impactAccumulation', seed.impact_accumulation,
      'recoveryHours', seed.recovery_hours,
      'cumulativeBudgets', jsonb_build_array(
        'unilateral_takeoff_contacts_per_side',
        'unilateral_landing_contacts_per_side',
        'lateral_hop_distance_and_intent',
        'lower_leg_and_tendon_loading',
        'single_leg_balance_and_absorption',
        'frontal_plane_braking',
        'technical_sensitivity'
      ),
      'fatigueSignals', jsonb_build_array(
        'distance_or_speed_decline', 'target_or_line_miss',
        'partial_foot_or_loud_contact', 'knee_valgus_or_pelvic_drop',
        'trunk_lean_or_rotation', 'free_foot_touch_extra_hop_or_foot_turn',
        'failed_hold'
      )
    ),
    jsonb_build_object(
      'primaryPhase',
        CASE seed.intent_contract
          WHEN 'lateral_power_output' THEN 'output'
          ELSE 'resilience'
        END,
      'secondaryPhase', 'movement_intelligence',
      'placement',
        'early_before_material_hop_landing_lower_leg_tendon_or_unilateral_fatigue',
      'freshnessSensitive', TRUE,
      'prescriptionUnit', 'quality_repetitions_per_stance_side',
      'sideBalanceRequired', TRUE,
      'sameLegContractMustBeExplicit', TRUE,
      'terminalHoldAndResetRequired', TRUE,
      'difficultyModel', 'max_exercise_complexity_physical_difficulty',
      'proficiencyClassification', NULL
    ),
    'review'
  FROM single_leg_lateral_hop_variant_seed seed
  ON CONFLICT (definition_id, variant_key) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    modifier_keys = EXCLUDED.modifier_keys,
    difficulty_json = EXCLUDED.difficulty_json,
    requirements_json = EXCLUDED.requirements_json,
    load_profile_json = EXCLUDED.load_profile_json,
    fatigue_profile_json = EXCLUDED.fatigue_profile_json,
    programming_profile_json = EXCLUDED.programming_profile_json,
    status = 'review',
    updated_at = now();

  INSERT INTO coaching.exercise_delivery_profile_v1 (
    variant_id, profile_key, phase_key, role, purpose,
    phase_suitability, methodology_alignment, objective_relevance_json,
    dosage_json, quality_gate, stop_rules, coach_instructions,
    athlete_instructions, expected_adaptation, equipment_required,
    logistics_json, substitution_ids, time_model_json, dose_scaling_json,
    measurement_json, support_prompts_json, status
  )
  SELECT
    variant.id,
    phase.profile_key,
    phase.phase_key,
    phase.role,
    CASE
      WHEN phase.profile_key = 'output-power'
        THEN 'Develop high-intent same-leg lateral projection while preserving target contact, whole-foot absorption, alignment, terminal hold, and full reset.'
      WHEN phase.profile_key = 'landing-control'
        THEN 'Develop repeatable frontal-plane braking, foot-knee-hip alignment, balance, and terminal same-leg landing control.'
      ELSE
        'Learn the same-leg takeoff and landing contract, target, whole-foot contact, absorption, alignment, hold, and reset at submaximal distance and speed.'
    END,
    CASE phase.profile_key
      WHEN 'output-power' THEN 92
      WHEN 'landing-control' THEN 94
      ELSE 86
    END,
    CASE phase.profile_key
      WHEN 'output-power' THEN 90
      WHEN 'landing-control' THEN 94
      ELSE 88
    END,
    jsonb_build_object(
      'lateralPower', CASE phase.profile_key WHEN 'output-power' THEN 94 ELSE 62 END,
      'singleLegLandingControl',
        CASE phase.profile_key WHEN 'landing-control' THEN 96 ELSE 84 END,
      'movementLearning',
        CASE phase.profile_key WHEN 'movement-learning' THEN 96 ELSE 72 END,
      'fatigueConditioning', 5
    ),
    jsonb_build_object(
      'sets', CASE phase.profile_key WHEN 'output-power' THEN '2-4' ELSE '2-3' END,
      'repetitionsPerSide',
        CASE phase.profile_key WHEN 'movement-learning' THEN '2-5' ELSE '2-4' END,
      'restSeconds',
        CASE phase.profile_key
          WHEN 'output-power' THEN '90-180'
          WHEN 'landing-control' THEN '60-120'
          ELSE '60-120'
        END,
      'effort', CASE phase.profile_key
        WHEN 'output-power' THEN 'high_intent_only_while_every_quality_gate_holds'
        ELSE 'controlled_rehearsal_with_exact_hold_and_full_reset'
      END,
      'stanceSide', 'declared_and_balanced_unless_documented_otherwise',
      'direction', 'declared_relative_to_stance_leg',
      'distanceContract', seed.distance_contract,
      'hold', 'declared_two_seconds_by_default',
      'cadence', 'discrete_no_rebound'
    ),
    'The declared foot takes off and lands, target and whole-foot contact are accurate, ankle-knee-hip absorption and foot-knee-hip-pelvis-trunk alignment remain controlled, the hold is stable without free-foot contact or extra hop, and a full reset occurs without symptoms.',
    ARRAY[
      'Stop for pain, swelling, numbness, tingling, dizziness, instability, or apprehension.',
      'Stop for an unsafe surface, target, lane, visibility, traffic condition, or fall space.',
      'Stop on a target miss, partial-foot or loud landing, valgus, pelvic drop, trunk lean or rotation, foot turn, free-foot touch, extra hop, or failed hold.',
      'Stop when distance, speed, contact, alignment, balance, or full-reset quality materially declines.'
    ]::TEXT[],
    'Declare variant, stance leg, direction, target, distance, hold, repetitions, rest, and reset. Observe from outside the lateral lane with takeoff, contact, alignment, hold, and reset visible.',
    'Load, push sideways, land under your hip, absorb quiet, hold, reset.',
    CASE phase.profile_key
      WHEN 'output-power'
        THEN 'Higher-quality lateral single-leg power expression with controlled ipsilateral landing under low fatigue.'
      WHEN 'landing-control'
        THEN 'More repeatable frontal-plane braking, whole-foot contact, alignment, and stabilization.'
      ELSE
        'More repeatable same-leg movement contract, target accuracy, absorption, balance, and reset.'
    END,
    ARRAY['none']::TEXT[],
    jsonb_build_object(
      'space', 'exclusive_marked_lateral_takeoff_landing_fall_and_reset_lane',
      'participants', 'one_active_athlete_per_lane',
      'setupSeconds', 45,
      'transitionSeconds', 15,
      'targetInspection', 'before_session_and_after_any_shift',
      'fullResetRule', TRUE,
      'coachPosition', 'outside_takeoff_landing_fall_and_reset_paths'
    ),
    ARRAY(
      SELECT regression_variant.id
      FROM coaching.exercise_definition_v1 regression_definition
      JOIN coaching.exercise_variant_v1 regression_variant
        ON regression_variant.definition_id = regression_definition.id
      WHERE regression_definition.slug = 'lateral-quick-step-to-stick'
        AND regression_definition.status <> 'archived'
        AND regression_variant.status <> 'archived'
    ),
    jsonb_build_object(
      'attemptSeconds', CASE phase.profile_key WHEN 'output-power' THEN 5 ELSE 7 END,
      'holdSeconds', 2,
      'resetSeconds', CASE phase.profile_key WHEN 'output-power' THEN 20 ELSE 16 END,
      'sideChangeSeconds', 20,
      'setDurationFormula',
        'quality_repetitions_per_side_x_two_x_attempt_plus_hold_and_reset',
      'durationIncludesSetup', TRUE
    ),
    jsonb_build_object(
      'regressFirst', jsonb_build_array(
        'reduce_distance', 'increase_target_size', 'reduce_intent',
        'use_lateral_step_to_stick', 'use_static_single_leg_balance',
        'reduce_repetitions', 'increase_rest'
      ),
      'progressOneVariableAtATime', jsonb_build_array(
        'distance', 'intent', 'target_precision',
        'hold_duration', 'medial_crossover_direction', 'reactive_cue'
      ),
      'symptomRule', 'stop_and_select_reviewed_pain_free_alternative'
    ),
    jsonb_build_object(
      'required', jsonb_build_array(
        'variant', 'stance_leg', 'direction', 'distance',
        'target', 'hold', 'quality_repetitions', 'rest', 'stop_reason'
      ),
      'optional', jsonb_build_array(
        'hop_distance_or_flight_time', 'takeoff_force',
        'landing_sound', 'stabilization_time',
        'target_error', 'free_foot_contact', 'alignment_error'
      ),
      'comparisonRule',
        'Compare only when stance leg, direction, distance, target, hold, intent, surface, and measurement method match.'
    ),
    jsonb_build_object(
      'athleteBeforeSet', jsonb_build_array(
        'Confirm stance leg, direction, target, distance, hold, and reset.',
        'Report pain, swelling, instability, dizziness, apprehension, or uncertainty before starting.'
      ),
      'coachDuringSet', jsonb_build_array(
        'Watch same-leg contract, target, contact, alignment, absorption, hold, and reset.',
        'Stop immediately on any equipment, symptom, safety, or quality trigger.'
      ),
      'afterSet', jsonb_build_array(
        'Record quality repetitions, side, direction, errors, symptoms, and substitutions.',
        'Do not increase distance or intent after a stop trigger.'
      ),
      'mediaFallback',
        'Use the written contract and a qualified live demonstration until an exact video is independently approved.'
    ),
    'review'
  FROM single_leg_lateral_hop_variant_seed seed
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id = target_definition_id
   AND variant.variant_key = seed.variant_key
   AND variant.status <> 'archived'
  CROSS JOIN LATERAL (
    VALUES
      (
        CASE seed.intent_contract
          WHEN 'lateral_power_output' THEN 'output-power'
          ELSE 'landing-control'
        END,
        CASE seed.intent_contract
          WHEN 'lateral_power_output' THEN 'output'
          ELSE 'resilience'
        END,
        'primary'
      ),
      (
        'movement-learning',
        'movement_intelligence',
        'secondary'
      )
  ) AS phase(profile_key, phase_key, role)
  ON CONFLICT (variant_id, profile_key) DO UPDATE SET
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
    substitution_ids = EXCLUDED.substitution_ids,
    time_model_json = EXCLUDED.time_model_json,
    dose_scaling_json = EXCLUDED.dose_scaling_json,
    measurement_json = EXCLUDED.measurement_json,
    support_prompts_json = EXCLUDED.support_prompts_json,
    status = 'review',
    updated_at = now();

  INSERT INTO coaching.exercise_relationship_v1 (
    from_variant_id, to_variant_id, relationship, similarity_score,
    dimensions, reason, conditions_json, review_status
  )
  SELECT
    from_variant.id,
    to_variant.id,
    edge.relationship,
    edge.similarity_score,
    edge.dimensions,
    edge.reason,
    edge.conditions_json,
    'review'
  FROM (
    VALUES
      (
        'low-amplitude-control',
        'distance-output',
        'progression',
        94,
        ARRAY['complexity', 'load', 'impact']::TEXT[],
        'Increasing declared lateral distance and intent preserves same-leg takeoff, same-leg landing, target, hold, and reset while increasing impulse, flight, braking, and stabilization demand.',
        '{"requiresStableLowAmplitudeVariant":true,"increaseOneVariableAtATime":true,"humanReviewRequired":true}'::JSONB
      ),
      (
        'distance-output',
        'low-amplitude-control',
        'regression',
        94,
        ARRAY['complexity', 'load', 'impact']::TEXT[],
        'Reducing distance and intent preserves the same-leg terminal-stick contract while lowering impulse, landing force, and stabilization demand.',
        '{"distanceContract":"short_declared_distance","humanReviewRequired":true}'::JSONB
      )
  ) AS edge(
    from_variant_key, to_variant_key, relationship, similarity_score,
    dimensions, reason, conditions_json
  )
  JOIN coaching.exercise_variant_v1 from_variant
    ON from_variant.definition_id = target_definition_id
   AND from_variant.variant_key = edge.from_variant_key
   AND from_variant.status <> 'archived'
  JOIN coaching.exercise_variant_v1 to_variant
    ON to_variant.definition_id = target_definition_id
   AND to_variant.variant_key = edge.to_variant_key
   AND to_variant.status <> 'archived'
  ON CONFLICT (from_variant_id, to_variant_id, relationship) DO UPDATE SET
    similarity_score = EXCLUDED.similarity_score,
    dimensions = EXCLUDED.dimensions,
    reason = EXCLUDED.reason,
    conditions_json = EXCLUDED.conditions_json,
    review_status = 'review',
    reviewed_by = NULL,
    reviewed_at = NULL,
    updated_at = now();

  INSERT INTO coaching.exercise_relationship_v1 (
    from_variant_id, to_variant_id, relationship, similarity_score,
    dimensions, reason, conditions_json, review_status
  )
  SELECT
    hop_variant.id,
    step_variant.id,
    'regression',
    78,
    ARRAY['complexity', 'load', 'impact', 'stability']::TEXT[],
    'A lateral quick step to stick preserves direction, terminal control, alignment, and hold while removing aerial projection and reducing takeoff and landing impact.',
    jsonb_build_object(
      'aerialPhaseRemoved', TRUE,
      'requiresExplicitCoachSelection', TRUE,
      'humanReviewRequired', TRUE
    ),
    'review'
  FROM single_leg_lateral_hop_variant_seed seed
  JOIN coaching.exercise_variant_v1 hop_variant
    ON hop_variant.definition_id = target_definition_id
   AND hop_variant.variant_key = seed.variant_key
   AND hop_variant.status <> 'archived'
  JOIN coaching.exercise_definition_v1 step_definition
    ON step_definition.slug = 'lateral-quick-step-to-stick'
   AND step_definition.status <> 'archived'
  JOIN LATERAL (
    SELECT candidate.id
    FROM coaching.exercise_variant_v1 candidate
    WHERE candidate.definition_id = step_definition.id
      AND candidate.status <> 'archived'
    ORDER BY candidate.variant_key
    LIMIT 1
  ) step_variant ON TRUE
  ON CONFLICT (from_variant_id, to_variant_id, relationship) DO UPDATE SET
    similarity_score = EXCLUDED.similarity_score,
    dimensions = EXCLUDED.dimensions,
    reason = EXCLUDED.reason,
    conditions_json = EXCLUDED.conditions_json,
    review_status = 'review',
    reviewed_by = NULL,
    reviewed_at = NULL,
    updated_at = now();

  INSERT INTO coaching.exercise_score_calibration_v1 (
    facility_id, variant_id, dimension, proposed_score, anchor_tier,
    rationale, status, version, created_by, reviewed_by, review_notes,
    reviewed_at
  )
  SELECT
    facility,
    variant.id,
    calibration.dimension,
    calibration.proposed_score,
    CASE
      WHEN calibration.proposed_score <= 30 THEN 20
      WHEN calibration.proposed_score <= 50 THEN 40
      WHEN calibration.proposed_score <= 70 THEN 60
      ELSE 80
    END,
    calibration.rationale,
    'review',
    1,
    NULL,
    NULL,
    'Research-backed proposal only; independent anchor comparison and human approval remain required.',
    NULL
  FROM single_leg_lateral_hop_variant_seed seed
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id = target_definition_id
   AND variant.variant_key = seed.variant_key
   AND variant.status <> 'archived'
  CROSS JOIN LATERAL (
    VALUES
      (
        'technicalComplexity',
        seed.exercise_complexity,
        CASE seed.intent_contract
          WHEN 'lateral_power_output'
            THEN 'Same-leg lateral projection to a challenging target, whole-foot contact, alignment, absorption, stable hold, and full reset create moderately high exercise complexity.'
          ELSE 'Same-leg low-amplitude lateral projection, whole-foot contact, alignment, balance, stable hold, and reset create moderate exercise complexity.'
        END
      ),
      (
        'absoluteLoadDemand',
        seed.physical_difficulty,
        CASE seed.intent_contract
          WHEN 'lateral_power_output'
            THEN 'Greater lateral distance and intent increase unilateral takeoff impulse, mediolateral landing force, braking, and stabilization demand.'
          ELSE 'Short distance limits impulse and landing force while retaining unilateral takeoff, landing, and stabilization demand.'
        END
      ),
      (
        'baseOverallDifficulty',
        greatest(seed.exercise_complexity, seed.physical_difficulty),
        'Overall exercise difficulty is the maximum of exercise complexity and physical difficulty; it is not an athlete skill or proficiency level.'
      )
  ) AS calibration(dimension, proposed_score, rationale)
  ON CONFLICT (facility_id, variant_id, dimension, version) DO UPDATE SET
    proposed_score = EXCLUDED.proposed_score,
    anchor_tier = EXCLUDED.anchor_tier,
    rationale = EXCLUDED.rationale,
    status = 'review',
    created_by = NULL,
    reviewed_by = NULL,
    review_notes = EXCLUDED.review_notes,
    reviewed_at = NULL,
    updated_at = now();

  CREATE TEMP TABLE single_leg_lateral_hop_source_seed (
    source_key TEXT PRIMARY KEY,
    source_url TEXT NOT NULL,
    source_title TEXT NOT NULL,
    source_publisher TEXT NOT NULL,
    source_kind TEXT NOT NULL,
    evidence_quality INTEGER NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO single_leg_lateral_hop_source_seed VALUES
    (
      'emory_line_hold',
      'https://www.emoryhealthcare.org/centers-programs/acl-program/return-to-play/single-leg-line-jump',
      'Single-Leg Line Jump',
      'Emory Healthcare',
      'expert_instruction',
      80
    ),
    (
      'nsca_line_drills',
      'https://www.nsca.com/education/articles/kinetic-select/7-line-drills-to-improve-agility/',
      '7 Line Drills to Improve Agility',
      'National Strength and Conditioning Association',
      'professional_standard',
      80
    ),
    (
      'physitrack_instruction',
      'https://uk.physitrack.com/home-exercise-video/lateral-hop-and-stick',
      'Lateral hop and stick',
      'Physitrack',
      'expert_instruction',
      72
    ),
    (
      'lateral_balance_study',
      'https://pubmed.ncbi.nlm.nih.gov/28090004/',
      'Difference in Dynamic Body Balance between Forward and Lateral Single-Leg Hop Landing',
      'Kurume Medical Journal',
      'peer_reviewed_research',
      82
    ),
    (
      'direction_load_biomechanics',
      'https://pubmed.ncbi.nlm.nih.gov/32148612/',
      'Effect of Jump Direction and External Load on Single-Legged Jump-Landing Biomechanics',
      'International Journal of Sports Physical Therapy',
      'peer_reviewed_research',
      84
    ),
    (
      'side_hop_quality',
      'https://pubmed.ncbi.nlm.nih.gov/37300972/',
      'The side hop test: Validity, reliability, and quality aspects in relation to sex, age and anterior cruciate ligament reconstruction, in soccer players',
      'Physical Therapy in Sport',
      'peer_reviewed_research',
      86
    ),
    (
      'landing_feedback',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC6208302/',
      'The Use of Augmented Information for Reducing Anterior Cruciate Ligament Injury Risk During Jump Landings: A Systematic Review',
      'Journal of Athletic Training',
      'peer_reviewed_research',
      87
    ),
    (
      'landing_intervention',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC10254820/',
      'Training interventions to reduce the risk of injury to the lower extremity joints during landing movements in adult athletes: a systematic review and meta-analysis',
      'BMJ Open Sport & Exercise Medicine',
      'peer_reviewed_research',
      89
    ),
    (
      'youtube_embed',
      'https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en',
      'Embed videos and playlists',
      'YouTube Help',
      'manufacturer_instruction',
      82
    );

  CREATE TEMP TABLE single_leg_lateral_hop_evidence_seed (
    section_key TEXT PRIMARY KEY,
    source_key TEXT NOT NULL,
    claims_json JSONB NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO single_leg_lateral_hop_evidence_seed VALUES
    (
      'identity', 'emory_line_hold',
      '["Emory defines a single-leg lateral line jump with a same-leg landing and two-second hold.","The line is a target constraint; amplitude is a difficulty-bearing variant, not a separate exercise identity or skill level."]'::JSONB
    ),
    (
      'taxonomy', 'nsca_line_drills',
      '["NSCA distinguishes single-leg from two-foot lateral line hopping and treats the line as a boundary.","Takeoff leg, landing leg, direction, distance, target, hold, cadence, cueing, and reset must be explicit."]'::JSONB
    ),
    (
      'anatomy', 'direction_load_biomechanics',
      '["Single-leg jump-landing direction changes hip and knee motion and time-to-stabilization demands.","The foot, ankle, knee, hip, pelvis, and trunk coordinate lateral propulsion, absorption, alignment, balance, hold, and reset."]'::JSONB
    ),
    (
      'biomechanics', 'lateral_balance_study',
      '["Lateral single-leg hopping produced greater immediate postural sway and mediolateral and vertical force than forward hopping in the cited sample.","Observable gates are same-leg takeoff and landing, target, whole-foot contact, ankle-knee-hip absorption, alignment, stable hold, and reset."]'::JSONB
    ),
    (
      'difficulty', 'direction_load_biomechanics',
      '["Jump direction and external load materially change single-leg jump-landing demands.","Score exercise complexity and physical difficulty for each exact amplitude contract; overall is their maximum and no exercise skill level is assigned."]'::JSONB
    ),
    (
      'load_fatigue_recovery', 'side_hop_quality',
      '["Side-hop flaws include boundary contact, free-foot contact, double hops, and foot turns.","Track unilateral takeoff and landing contacts, distance and intent, frontal-plane braking, lower-leg and tendon loading, balance, and technical sensitivity."]'::JSONB
    ),
    (
      'constraints', 'emory_line_hold',
      '["Emory uses a taped line, athletic single-leg start, controlled lateral jump, aligned landing, and timed hold.","Declare surface, target, direction, distance, landing and fall space, lighting, traffic, footwear policy, and coach sightline."]'::JSONB
    ),
    (
      'dosage', 'landing_feedback',
      '["Landing feedback is most useful when directed to defined observable mechanics.","Use low side-balanced repetitions, full resets, and rest sufficient to preserve projection, contact, alignment, hold, and reset."]'::JSONB
    ),
    (
      'instructions', 'physitrack_instruction',
      '["Physitrack describes a single-leg start, countermovement, lateral hop, soft landing, stabilization, and opposite-side repetition.","Declare leg and target, load, push sideways, land under the hip, absorb quietly, hold, and reset."]'::JSONB
    ),
    (
      'safety_stop_rules', 'landing_feedback',
      '["Landing feedback can target trunk, knee, foot, and contact errors.","Stop for symptoms, unsafe surface or lane, target miss, partial-foot contact, uncontrolled alignment, free-foot touch, extra hop, foot turn, failed hold, or output decline."]'::JSONB
    ),
    (
      'programming', 'side_hop_quality',
      '["Side-hop count alone does not capture movement quality; observable flaws must be recorded.","Use low amplitude for landing control and distance for fresh output; never silently convert a terminal stick to continuous rebound conditioning."]'::JSONB
    ),
    (
      'athlete_support', 'emory_line_hold',
      '["Show stance leg, direction, target, distance, landing foot, hold, reset, cue, and stop signal.","Offer shorter distance, wider target, step-to-stick, bilateral regression, fewer contacts, and longer rest without exercise skill levels."]'::JSONB
    ),
    (
      'coach_support', 'lateral_balance_study',
      '["Lateral hopping challenges dynamic balance differently from forward hopping.","Expose leg, direction, distance, target, dose, rest, contact budget, observation angle, contact, alignment, hold, reset, symptoms, and shutdown."]'::JSONB
    ),
    (
      'accessibility', 'landing_intervention',
      '["Landing tasks can be modified through instruction, feedback, progression, and environmental constraints.","Options include shorter distance, wider high-contrast target, step-to-stick, bilateral regression, fewer contacts, longer rest, and nonvideo instruction."]'::JSONB
    ),
    (
      'alternates', 'nsca_line_drills',
      '["A line is a target, while a terminal hold separates a discrete hop-to-stick from repeated line hopping.","Contralateral bounds, bilateral hops, continuous rebounds, hurdles, external load, and reactive cues require separate review."]'::JSONB
    ),
    (
      'media', 'youtube_embed',
      '["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","The five links have healthy metadata only; full viewing, exact same-leg and amplitude match, safety, captions, accessibility, reviewer identity, and approval remain unresolved."]'::JSONB
    );

  UPDATE coaching.exercise_section_evidence_v1
  SET review_status = 'superseded',
      updated_at = now()
  WHERE definition_id = target_definition_id
    AND reviewed_card_version <> target_card_version
    AND review_status = 'candidate';

  INSERT INTO coaching.exercise_section_evidence_v1 (
    definition_id, reviewed_card_version, section_key, source_url,
    source_title, source_publisher, source_kind, claims_json,
    evidence_quality, review_status, reviewer_user_id, reviewed_at
  )
  SELECT
    target_definition_id,
    target_card_version,
    evidence.section_key,
    source.source_url,
    source.source_title,
    source.source_publisher,
    source.source_kind,
    evidence.claims_json,
    source.evidence_quality,
    'candidate',
    NULL,
    NULL
  FROM single_leg_lateral_hop_evidence_seed evidence
  JOIN single_leg_lateral_hop_source_seed source
    ON source.source_key = evidence.source_key
  ON CONFLICT (
    definition_id, reviewed_card_version, section_key, source_url
  ) DO UPDATE SET
    source_title = EXCLUDED.source_title,
    source_publisher = EXCLUDED.source_publisher,
    source_kind = EXCLUDED.source_kind,
    claims_json = EXCLUDED.claims_json,
    evidence_quality = EXCLUDED.evidence_quality,
    review_status = 'candidate',
    reviewer_user_id = NULL,
    reviewed_at = NULL,
    updated_at = now();

  UPDATE coaching.exercise_media_candidate_v1
  SET review_status = 'superseded',
      updated_at = now()
  WHERE definition_id = target_definition_id
    AND reviewed_card_version <> target_card_version
    AND review_status = 'candidate';

  INSERT INTO coaching.exercise_media_candidate_v1 (
    definition_id, variant_id, reviewed_card_version, url, embed_url,
    video_id, title, channel_name, embedding_allowed, exact_variant_match,
    demonstration_quality_score, link_status, review_status,
    discovery_method, source_query, reviewer_user_id, reviewed_at, notes
  )
  SELECT
    target_definition_id,
    NULL,
    target_card_version,
    media.url,
    'https://www.youtube-nocookie.com/embed/' || media.video_id,
    media.video_id,
    media.title,
    media.channel_name,
    TRUE,
    NULL,
    NULL,
    'healthy',
    'candidate',
    'manual_research',
    media.source_query,
    NULL,
    NULL,
    media.notes
  FROM (
    VALUES
      (
        '-pHyWzHnSLY',
        'https://www.youtube.com/watch?v=-pHyWzHnSLY',
        'Single-Leg Line Jump (Lateral) - Hold',
        'Emory Healthcare',
        'Emory exercise page link rechecked through current YouTube oEmbed',
        'Current title and oEmbed response are healthy. Full viewing, exact same-leg and hold contract, instruction quality, safety, captions, accessibility, reviewer identity, and approval remain pending.'
      ),
      (
        '5SRFVJejwb4',
        'https://www.youtube.com/watch?v=5SRFVJejwb4',
        'Single Leg Lateral Hop and Stick',
        'Basil Performance',
        'YouTube exact-name discovery rechecked through current oEmbed',
        'Current title and oEmbed response are healthy. Full viewing and every human review gate remain pending.'
      ),
      (
        'vxP50u3UXcM',
        'https://www.youtube.com/watch?v=vxP50u3UXcM',
        'Lateral Hop & Stick',
        'Jono Hayes',
        'YouTube exact-name discovery rechecked through current oEmbed',
        'Current title and oEmbed response are healthy. Full viewing and every human review gate remain pending.'
      ),
      (
        'GDQBKxNNt-g',
        'https://www.youtube.com/watch?v=GDQBKxNNt-g',
        'Lateral Single Leg Hop and Stick',
        'Perform For Sport',
        'YouTube exact-name discovery rechecked through current oEmbed',
        'Current title and oEmbed response are healthy. Full viewing and every human review gate remain pending.'
      ),
      (
        'CB_v-YIijMs',
        'https://www.youtube.com/watch?v=CB_v-YIijMs',
        'How to perform the Single Leg Lateral Hop and Stick',
        'Zaffino Training',
        'YouTube exact-name discovery rechecked through current oEmbed',
        'Current title and oEmbed response are healthy. Full viewing and every human review gate remain pending.'
      )
  ) AS media(
    video_id, url, title, channel_name, source_query, notes
  )
  ON CONFLICT (definition_id, reviewed_card_version, video_id) DO UPDATE SET
    url = EXCLUDED.url,
    embed_url = EXCLUDED.embed_url,
    title = EXCLUDED.title,
    channel_name = EXCLUDED.channel_name,
    embedding_allowed = TRUE,
    exact_variant_match = NULL,
    demonstration_quality_score = NULL,
    link_status = 'healthy',
    review_status = 'candidate',
    discovery_method = EXCLUDED.discovery_method,
    source_query = EXCLUDED.source_query,
    reviewer_user_id = NULL,
    reviewed_at = NULL,
    notes = EXCLUDED.notes,
    updated_at = now();

  UPDATE coaching.exercise_alternate_assessment_v1
  SET review_status = 'superseded',
      updated_at = now()
  WHERE definition_id = target_definition_id
    AND reviewed_card_version <> target_card_version
    AND review_status = 'candidate';

  INSERT INTO coaching.exercise_alternate_assessment_v1 (
    definition_id, reviewed_card_version, alternate_name, classification,
    rationale, distinguishing_dimensions, proposed_card_json, review_status,
    reviewer_user_id, reviewed_at
  )
  SELECT
    target_definition_id,
    target_card_version,
    alternate.alternate_name,
    alternate.classification,
    alternate.rationale,
    alternate.dimensions,
    NULL,
    'candidate',
    NULL,
    NULL
  FROM (
    VALUES
      (
        'Single-Leg Lateral Hop to Stick', 'same_identity',
        'This is the stable exact identity: one-leg lateral takeoff to the same-leg landing and terminal hold.',
        '{"takeoff":"unilateral","landing":"ipsilateral_unilateral","cadence":"discrete_stick"}'::JSONB
      ),
      (
        'Lateral Line Hop to Single-Leg Stick', 'same_identity',
        'The line is a target boundary; the terminal single-leg stick preserves the same primary task.',
        '{"target":"floor_line","sourceTakeoffContract":"unresolved"}'::JSONB
      ),
      (
        'Single-Leg Lateral Line Jump with Hold', 'same_identity',
        'This name explicitly describes the same one-leg lateral line crossing and held same-leg landing.',
        '{"target":"floor_line","hold":"declared"}'::JSONB
      ),
      (
        'Low-Amplitude Single-Leg Lateral Hop to Stick', 'new_variant',
        'Short distance prioritizes landing control and reduces takeoff impulse and landing force.',
        '{"distance":"low_amplitude","intent":"landing_control"}'::JSONB
      ),
      (
        'Single-Leg Lateral Hop to Stick for Distance', 'new_variant',
        'Greater declared distance and intent increase propulsion, flight, braking, and stabilization demand.',
        '{"distance":"declared_output","intent":"lateral_power"}'::JSONB
      ),
      (
        'Single-Leg Medial Crossover Hop to Stick', 'new_variant',
        'Hopping across the stance leg changes direction relative to the foot, hip strategy, and landing control while preserving same-leg takeoff and landing.',
        '{"directionRelativeToStanceLeg":"medial_crossover"}'::JSONB
      ),
      (
        'Reactive-Cue Single-Leg Lateral Hop to Stick', 'modifier_annotation',
        'A late direction or distance cue changes decision demand but preserves the one-hop terminal-stick identity.',
        '{"cueing":"reactive","mustBeExplicit":true}'::JSONB
      ),
      (
        'Weighted-Vest Single-Leg Lateral Hop to Stick', 'new_variant',
        'External torso load preserves the path but materially changes physical difficulty, landing load, and readiness.',
        '{"externalLoad":"weighted_vest"}'::JSONB
      ),
      (
        'Skater Bound to Stick', 'new_definition',
        'A skater bound takes off from one leg and lands on the opposite leg, changing the takeoff-to-landing relationship.',
        '{"takeoffLandingRelationship":"contralateral"}'::JSONB
      ),
      (
        'Bilateral Lateral Hop to Stick', 'new_definition',
        'Two-foot takeoff and landing change base of support, per-leg impulse, absorption, and balance demand.',
        '{"takeoff":"bilateral","landing":"bilateral"}'::JSONB
      ),
      (
        'Continuous Single-Leg Lateral Line Hops', 'new_definition',
        'Repeated rebound contacts remove the terminal hold and full reset, changing stiffness, cadence, fatigue, and safety.',
        '{"cadence":"continuous_reactive","terminalHold":false}'::JSONB
      ),
      (
        'Single-Leg Lateral Hurdle Hop to Stick', 'new_definition',
        'A raised obstacle adds clearance, trip, and landing-location demands beyond a floor target.',
        '{"obstacle":"raised_hurdle","clearanceRequired":true}'::JSONB
      )
  ) AS alternate(alternate_name, classification, rationale, dimensions)
  ON CONFLICT (
    definition_id, reviewed_card_version, alternate_name
  ) DO UPDATE SET
    classification = EXCLUDED.classification,
    rationale = EXCLUDED.rationale,
    distinguishing_dimensions = EXCLUDED.distinguishing_dimensions,
    proposed_card_json = NULL,
    review_status = 'candidate',
    reviewer_user_id = NULL,
    reviewed_at = NULL,
    updated_at = now();

  UPDATE coaching.exercise_difficulty_profile profile
  SET technical = 4.2,
      load = 3.6,
      overall = 4.2,
      notes =
        'Candidate values represent the low-amplitude same-leg baseline; exact variant assignment and independent calibration remain required.',
      updated_at = now()
  WHERE profile.exercise_id IN (
    SELECT legacy_exercise_id
    FROM coaching.exercise_definition_source_v1
    WHERE definition_id = target_definition_id
  );

  UPDATE coaching.exercise_score_v1 score
  SET technical_complexity = 42,
      absolute_load_demand = 36,
      coordination_demand = 58,
      impact = 42,
      supervision_demand = 56,
      base_overall_difficulty = greatest(42, 36),
      legacy_scores = score.legacy_scores || jsonb_build_object(
        'candidateReassessment', migration_key,
        'difficultyModel', 'max_exercise_complexity_physical_difficulty',
        'sourceIdentity',
          'ipsilateral_single_leg_lateral_hop_to_terminal_stick',
        'lineSourceTakeoffContract', 'unresolved',
        'identityQuarantined', TRUE,
        'exerciseSkillLevelAllowed', FALSE,
        'independentCalibrationRequired', TRUE
      ),
      migration_confidence = 66,
      human_review_status = 'queued',
      reviewed_by = NULL,
      reviewed_at = NULL,
      review_notes =
        'Research-backed candidate reassessment only; exact amplitude assignment and independent calibration remain required.',
      updated_at = now()
  WHERE score.exercise_id IN (
    SELECT legacy_exercise_id
    FROM coaching.exercise_definition_source_v1
    WHERE definition_id = target_definition_id
  );

  UPDATE coaching.exercise legacy
  SET archived = TRUE,
      is_published = FALSE,
      why_publish_ready = FALSE,
      skill_level = NULL,
      movement_family = 'Ipsilateral single-leg lateral hop to terminal stick',
      primary_phase_key = CASE
        WHEN legacy.id = 1505 THEN 'output'
        ELSE 'resilience'
      END,
      phase_subrole = CASE
        WHEN legacy.id = 1505 THEN 'single_leg_lateral_power'
        ELSE 'landing_braking_control'
      END,
      primary_order_slot = 'single_leg_lateral_hop_stick',
      card_summary =
        'Discrete same-leg lateral hop to a declared target, whole-foot absorption, stable terminal hold, and full reset. Legacy amplitude and line-source contracts are nonselectable.',
      description =
        'From one declared leg, hop laterally to a declared target and land on the same leg. Absorb quietly with controlled alignment, hold without extra contact, and reset fully.',
      instructions =
        'Declare stance leg, direction, distance, target, hold, dose, rest, and reset. Load, push sideways, land under the hip, absorb quietly, hold, and reset.',
      coach_language =
        'Observe same-leg takeoff and landing, lateral projection, target and whole-foot contact, foot-knee-hip-pelvis-trunk alignment, absorption, hold, free-foot contact, extra hops, foot turns, and reset. Stop on symptoms, unsafe logistics, quality loss, or output decline.',
      athlete_language =
        'Load, push sideways, land under your hip, absorb quiet, hold, reset.',
      scalable_variables = ARRAY[
        'stance_leg', 'direction_relative_to_stance_leg',
        'distance_and_amplitude', 'target_type_and_size',
        'intent', 'hold_duration', 'planned_or_reactive_cue',
        'repetitions_per_side', 'rest'
      ]::TEXT[],
      movement_requirements = jsonb_build_object(
        'projection', 'lateral',
        'takeoff_landing_contract', 'ipsilateral_single_leg',
        'target', 'declared_line_or_zone',
        'completion', 'stable_terminal_hold_and_full_reset',
        'selectable_exact_variant', FALSE
      ),
      coaching_execution = jsonb_build_object(
        'setup', jsonb_build_array(
          'Declare exact variant, stance leg, direction, distance, target, hold, dose, rest, and reset.',
          'Inspect traction, target visibility, lateral landing and fall space, lighting, traffic, and observation angle.',
          'Confirm a pain-free step-to-stick and short-hop trial before distance or high intent.'
        ),
        'quality_gate', jsonb_build_array(
          'The declared foot takes off and lands.',
          'The whole foot contacts the target quietly.',
          'Foot, knee, hip, pelvis, and trunk remain controlled.',
          'The hold and full reset occur without free-foot touch, extra hop, or foot turn.'
        ),
        'stop_signs', jsonb_build_array(
          'Pain, swelling, neurologic symptoms, instability, fear, or apprehension',
          'Unsafe surface, target, lane, visibility, traffic, or fall space',
          'Target miss, partial-foot or loud landing, alignment loss, free-foot contact, extra hop, foot turn, failed hold, or output decline'
        )
      ),
      programming_logic = jsonb_build_object(
        'difficulty_model', 'max_exercise_complexity_physical_difficulty',
        'exercise_skill_level', NULL,
        'identity_rule', 'select_exact_amplitude_and_intent_contract',
        'cadence_rule', 'terminal_stick_and_full_reset_are_required',
        'fatigue_rule',
          'place_before_material_hop_landing_lower_leg_tendon_or_unilateral_fatigue',
        'substitution_rule',
          'never_silently_change_same_leg_contract_direction_target_hold_or_cadence',
        'legacy_source_rule', 'incomplete_exact_contract_sources_are_nonselectable'
      ),
      updated_at = now()
  WHERE legacy.id IN (
    SELECT legacy_exercise_id
    FROM coaching.exercise_definition_source_v1
    WHERE definition_id = target_definition_id
  );

  INSERT INTO coaching.exercise_card_test_packet_v1 (
    definition_id, facility_id, card_version, audit_version, status,
    checks_json, blocking_issues_json, human_review_required
  )
  SELECT
    target_definition_id,
    facility,
    target_card_version,
    'canonical-card-audit-v1',
    'quarantined',
    jsonb_build_object(
      'identityMigration',
        '326_coaching_single_leg_lateral_hop_stick_identity_consolidation',
      'completenessMigration', migration_key,
      'researchBatch', 'single-leg-lateral-hop-stick-family-v1',
      'difficultyFormula', 'max_exercise_complexity_physical_difficulty',
      'exerciseDifficultyDimensions', jsonb_build_array(
        'exercise_complexity', 'physical_difficulty'
      ),
      'proficiencyClassificationScope', 'coaching_skill_library_only',
      'exerciseSkillLevelAllowed', FALSE,
      'genericLegacySourcesSelectable', FALSE,
      'auditRerunRequired', TRUE
    ),
    jsonb_build_array(
      jsonb_build_object(
        'code', 'CARD-CALIBRATION-01',
        'category', 'calibration',
        'message', 'Independent score-anchor review remains required.'
      ),
      jsonb_build_object(
        'code', 'CARD-GRAPH-03',
        'category', 'relationship_graph',
        'message', 'Progression and regression edges remain review-only.'
      ),
      jsonb_build_object(
        'code', 'CARD-MEDIA-01',
        'category', 'media',
        'message', 'Exact-contract full-video, safety, caption, accessibility, and approval review remains required.'
      ),
      jsonb_build_object(
        'code', 'CARD-PUBLISH-01',
        'category', 'publication',
        'message', 'Independent content and publication review remains required.'
      )
    ),
    TRUE
  ON CONFLICT (definition_id) DO UPDATE SET
    facility_id = EXCLUDED.facility_id,
    card_version = EXCLUDED.card_version,
    audit_version = EXCLUDED.audit_version,
    status = EXCLUDED.status,
    checks_json = EXCLUDED.checks_json,
    blocking_issues_json = EXCLUDED.blocking_issues_json,
    human_review_required = TRUE,
    checked_at = now();
END;
$$;
