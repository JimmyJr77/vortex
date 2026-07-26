-- Complete the candidate-only box-jump-to-single-leg-landing family after
-- migration 324 consolidates its duplicate definition.
--
-- Exact selectable variants:
--   * bilateral takeoff to declared single-leg box landing
--   * same-leg unilateral takeoff and single-leg box landing
--
-- Box height, start distance, landing side, intent, target zone, hold time,
-- and dose are explicit modifiers. Both legacy sources omit a complete
-- takeoff-to-landing leg contract and remain archived, nonselectable
-- provenance. Exercise difficulty uses exercise complexity and physical
-- difficulty, with overall equal to their maximum. Exercise cards receive no
-- skill or proficiency level. Evidence, media, graph, calibration, and
-- publication decisions remain candidate/review-only. IDEMPOTENT and
-- fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT := '325_coaching_box_jump_single_leg_landing_family_completion';
  target_definition_id UUID;
  facility BIGINT;
  target_card_version INTEGER;
  protected_records INTEGER;
  unexpected_variants INTEGER;
BEGIN
  SELECT id, facility_id
  INTO target_definition_id, facility
  FROM coaching.exercise_definition_v1
  WHERE slug = 'standing-box-jump-to-single-leg-landing'
    AND status <> 'archived';

  IF target_definition_id IS NULL THEN
    RAISE EXCEPTION
      'Box-jump single-leg-landing completion requires the active survivor definition';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_definition_v1
    WHERE slug = 'single-leg-box-jump-to-single-leg-landing'
      AND status <> 'archived'
  ) THEN
    RAISE EXCEPTION
      'Box-jump single-leg-landing completion requires migration 324 first';
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
      SELECT COUNT(*)
      FROM coaching.exercise_section_evidence_v1
      WHERE definition_id = target_definition_id
        AND review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_media_candidate_v1
      WHERE definition_id = target_definition_id
        AND review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id = target_definition_id
        AND review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_card_review_v1
      WHERE definition_id = target_definition_id
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_card_revision_v1
      WHERE definition_id = target_definition_id
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_media_review_v1
      WHERE definition_id = target_definition_id
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_variant_v1
      WHERE definition_id = target_definition_id
        AND status = 'published'
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_delivery_profile_v1 profile
      JOIN coaching.exercise_variant_v1 variant
        ON variant.id = profile.variant_id
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
      JOIN coaching.exercise_variant_v1 variant
        ON variant.id = calibration.variant_id
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
      'Box-jump single-leg-landing completion refused to override % protected records',
      protected_records;
  END IF;

  SELECT COUNT(*)
  INTO unexpected_variants
  FROM coaching.exercise_variant_v1
  WHERE definition_id = target_definition_id
    AND status <> 'archived'
    AND variant_key NOT IN (
      'baseline',
      'bilateral-takeoff-single-leg-landing',
      'same-leg-unilateral-takeoff-and-landing'
    );

  IF unexpected_variants > 0 THEN
    RAISE EXCEPTION
      'Box-jump single-leg-landing completion found % unexpected active variants',
      unexpected_variants;
  END IF;

  UPDATE coaching.exercise_variant_v1
  SET variant_key = 'legacy-bilateral-takeoff-unspecified-landing-source-1561',
      status = 'archived',
      requirements_json = requirements_json || jsonb_build_object(
        'sourceTakeoffLaterality', 'bilateral',
        'sourceLandingLaterality', 'single_leg_unspecified_side_contract',
        'selectable', FALSE,
        'identityQuarantine', TRUE,
        'quarantineReason',
          'The legacy source does not declare landing side or a complete exact-variant contract.'
      ),
      updated_at = now()
  WHERE definition_id = target_definition_id
    AND variant_key = 'baseline';

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
      canonical_name = 'Box Jump to Single-Leg Landing',
      display_name = 'Box Jump to Single-Leg Landing',
      description =
        'Jump vertically from a declared bilateral or unilateral standing takeoff to an inspected box, land with the whole declared foot inside the target zone, absorb through the ankle, knee, and hip, hold balance, stand fully, and step down. The exact variant declares takeoff laterality and its relationship to the landing leg.',
      family_key = 'standing_vertical_box_jump_to_single_leg_box_landing',
      movement_patterns = ARRAY['jump', 'land', 'brace']::TEXT[],
      body_regions = ARRAY[
        'foot', 'ankle', 'knee', 'hip', 'pelvis', 'core', 'spine'
      ]::TEXT[],
      required_equipment = ARRAY['box']::TEXT[],
      optional_equipment = ARRAY['mat', 'line_tape', 'cones', 'mirror']::TEXT[],
      environment_json = jsonb_build_object(
        'box', 'stable_inspected_non_slip_box_with_declared_height_and_top_dimensions',
        'frontEdge', 'high_contrast_and_fully_visible',
        'landingZone', 'marked_inside_box_top_away_from_edges',
        'takeoffSurface', 'level_high_traction_and_clear',
        'stepDownSurface', 'level_high_traction_and_separate_from_takeoff_lane',
        'startDistance', 'declared_and_repeatable',
        'ceilingAndFallZone', 'clear',
        'traffic', 'one_active_jumper_per_station_no_cross_traffic',
        'coachSightline', 'takeoff_box_clearance_foot_contact_alignment_hold_stand_and_exit_visible'
      ),
      population_json = jsonb_build_object(
        'readiness', jsonb_build_array(
          'pain_free_takeoff_and_single_leg_landing',
          'can_hold_a_floor_single_leg_landing_without_extra_contact',
          'can_clear_a_low_box_without_forward_dive_or_excessive_tuck',
          'can_contact_the_whole_foot_inside_the_box_top',
          'can_stand_and_step_down_without_jumping_from_the_box',
          'can_follow_side_hold_exit_and_stop_instructions'
        ),
        'contraindicationFlags', jsonb_build_array(
          'current_foot_ankle_knee_hip_back_pain_or_instability',
          'numbness_dizziness_or_neurologic_symptoms',
          'uncontrolled_valgus_pelvic_drop_trunk_collapse_or_rotation',
          'unsafe_box_surface_visibility_clearance_or_traffic',
          'unassessed_recent_injury_surgery_or_rehabilitation_restriction'
        ),
        'supervision',
          'direct_observation_until_takeoff_clearance_unilateral_landing_hold_and_step_down_are_repeatable',
        'selectionBoundary',
          'Select exact takeoff laterality, landing side, box height, start distance, target zone, intent, hold, and dose from current readiness; exercise cards do not carry skill levels.',
        'clinicalBoundary',
          'Symptoms, instability, recent surgery, neurologic signs, or rehabilitation restrictions require individualized clinician guidance.'
      ),
      anatomy_json = jsonb_build_object(
        'primaryMuscles', jsonb_build_array(
          'gluteus_maximus', 'quadriceps', 'hamstrings',
          'gastrocnemius_and_soleus'
        ),
        'secondaryMuscles', jsonb_build_array(
          'gluteus_medius_and_minimus', 'hip_adductors_and_rotators',
          'tibialis_anterior', 'fibularis_group',
          'intrinsic_foot_muscles', 'abdominal_wall',
          'erector_spinae_and_multifidus'
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
          'ankle_knee_and_hip_flexion_during_countermovement',
          'ankle_plantarflexion_knee_extension_and_hip_extension_during_takeoff',
          'hip_knee_and_ankle_flexion_during_landing_absorption',
          'frontal_and_transverse_plane_hip_knee_foot_stabilization',
          'hip_and_knee_extension_to_stand'
        ),
        'planes', jsonb_build_array(
          'sagittal', 'frontal_stabilization', 'transverse_stabilization'
        ),
        'laterality',
          'declared_bilateral_or_unilateral_takeoff_to_declared_single_leg_landing',
        'primaryActions', jsonb_build_array(
          'load_declared_takeoff_leg_or_legs',
          'project_vertically_and_clear_box_edge',
          'contact_declared_landing_foot_inside_zone',
          'absorb_and_stabilize_without_extra_contact',
          'hold_stand_and_step_down'
        )
      ),
      athlete_support_json = jsonb_build_object(
        'whyItMatters',
          'This task combines vertical projection with accurate, controlled single-leg landing on a raised surface.',
        'beforeYouStart', jsonb_build_array(
          'Confirm your takeoff version, landing side, box height, start mark, target zone, hold, and step-down route.',
          'Check that the box does not move and the edge, landing zone, and floor are clear.',
          'Begin with a height you can clear without diving or pulling your knees excessively high.'
        ),
        'primaryCue',
          'Jump up, clear the edge, land whole-foot and quiet, hold, stand, then step down.',
        'selfChecks', jsonb_build_array(
          'My whole foot lands inside the marked zone.',
          'My knee tracks with my foot and my pelvis stays controlled.',
          'I can freeze without another hop or opposite-foot touch.',
          'I stand fully and step down instead of jumping down.'
        ),
        'painGuidance',
          'Stop immediately for pain, numbness, dizziness, instability, a clipped edge, partial-foot contact, or a landing you cannot control.',
        'accessibility', jsonb_build_array(
          'lower_box_or_raised_target', 'larger_high_contrast_landing_zone',
          'bilateral_takeoff', 'floor_level_single_leg_landing',
          'shorter_hold', 'fewer_repetitions', 'longer_rest',
          'plain_text_audio_and_live_demonstration'
        )
      ),
      coach_support_json = jsonb_build_object(
        'stationSetup', jsonb_build_array(
          'Declare exact takeoff variant, landing side, box, height, start distance, target, hold, dose, and exit.',
          'Inspect stability, top traction, visible edge, landing zone, takeoff surface, ceiling, fall zone, and step-down route.',
          'Rehearse a floor landing and low-box trial before high intent.'
        ),
        'observationPriorities', jsonb_build_array(
          'countermovement_and_takeoff_symmetry_or_declared_unilateral_leg',
          'vertical_projection_and_box_edge_clearance',
          'whole_foot_contact_inside_landing_zone',
          'foot_knee_hip_pelvis_and_trunk_alignment',
          'quiet_absorption_and_stable_hold',
          'full_stand_and_controlled_step_down'
        ),
        'primaryCues', jsonb_build_array(
          'Jump up, not forward.', 'Clear the edge.',
          'Whole foot in the zone.', 'Knee follows toes.',
          'Land quiet and freeze.', 'Stand, then step down.'
        ),
        'qualityGate',
          'Count only a declared takeoff, clean edge clearance, whole-foot unilateral landing inside the zone, controlled alignment, stable hold, full stand, and step-down without symptoms or extra contact.',
        'immediateStop', jsonb_build_array(
          'pain_numbness_dizziness_instability_or_apprehension',
          'moving_box_poor_traction_hidden_edge_or_lane_intrusion',
          'edge_contact_missed_box_or_partial_foot_landing',
          'valgus_pelvic_drop_trunk_collapse_rotation_or_extra_contact',
          'failed_hold_material_output_decline_or_unsafe_exit'
        ),
        'recordAfterSet', jsonb_build_array(
          'variant_takeoff_leg_and_landing_side',
          'box_height_start_distance_and_target_zone',
          'quality_repetitions_per_side_and_rest',
          'edge_contact_foot_contact_alignment_hold_or_exit_errors',
          'symptoms_stop_reason_and_substitution'
        )
      ),
      support_operations_json = jsonb_build_object(
        'selectionInputs', jsonb_build_array(
          'training_intent', 'symptoms_and_readiness',
          'takeoff_laterality_and_landing_side', 'box_height_and_dimensions',
          'start_distance_and_target_zone', 'hold_and_exit',
          'available_time', 'weekly_jump_unilateral_landing_and_tendon_budgets'
        ),
        'logistics', jsonb_build_object(
          'participantStructure', 'one_active_jumper_per_box_station',
          'boxInspectionRequired', TRUE,
          'stepDownOnly', TRUE,
          'coachPosition', 'outside_takeoff_fall_and_exit_paths_with_full_sequence_visible',
          'shutdownControl', 'coach_or_athlete_can_stop_station_immediately'
        ),
        'substitutionPolicy', jsonb_build_object(
          'mustPreserve', jsonb_build_array(
            'vertical_projection_or_explicit_regression',
            'declared_landing_side', 'unilateral_absorption',
            'alignment_hold_and_controlled_exit'
          ),
          'mayAdjust', jsonb_build_array(
            'box_height', 'start_distance', 'target_size',
            'bilateral_takeoff', 'intent', 'hold_time',
            'repetitions', 'rest'
          ),
          'neverSilent', jsonb_build_array(
            'bilateral_to_unilateral_takeoff',
            'single_leg_to_bilateral_landing',
            'box_to_floor_landing', 'vertical_to_lateral_or_reactive_task',
            'step_down_to_jump_down', 'symptom_related_change'
          ),
          'uncertaintyRule',
            'When readiness, box, clearance, landing, or exit safety is unclear, use a reviewed floor-level landing or lower-risk jump alternative.'
        ),
        'feedbackCapture', jsonb_build_array(
          'pain_or_symptoms', 'quality_repetitions',
          'takeoff_or_clearance_error', 'landing_contact_alignment_or_hold_error',
          'box_or_station_issue', 'substitution_reason', 'coach_override'
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
          '324_coaching_box_jump_single_leg_landing_identity_consolidation',
        'structuralCompletionMigration', migration_key,
        'researchBatch', 'box-jump-single-leg-landing-family-v1',
        'researchVersion', '2026-07-26.35',
        'difficultyModel', 'max_exercise_complexity_physical_difficulty',
        'legacySourceLegContract', 'unresolved_and_archived',
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

  CREATE TEMP TABLE box_jump_single_leg_variant_seed (
    variant_key TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    takeoff_contract TEXT NOT NULL,
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

  INSERT INTO box_jump_single_leg_variant_seed VALUES
    (
      'bilateral-takeoff-single-leg-landing',
      'Box Jump to Single-Leg Landing — Bilateral Takeoff',
      'bilateral_takeoff_to_declared_single_leg_landing',
      ARRAY[
        'bilateral_takeoff', 'single_leg_box_landing',
        'stable_hold', 'step_down_exit'
      ]::TEXT[],
      62, 60, 72, 74, 78, 52, 30, 4, 34, 66, 58, 78, 54, 48
    ),
    (
      'same-leg-unilateral-takeoff-and-landing',
      'Box Jump to Single-Leg Landing — Same-Leg Unilateral Takeoff',
      'same_leg_unilateral_takeoff_and_landing',
      ARRAY[
        'unilateral_takeoff', 'same_leg_single_leg_box_landing',
        'stable_hold', 'step_down_exit'
      ]::TEXT[],
      74, 72, 82, 82, 84, 56, 34, 4, 36, 72, 66, 88, 58, 54
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
      'start', 'standing_at_declared_distance',
      'takeoffContract', seed.takeoff_contract,
      'projection', 'vertical_to_inspected_box',
      'landingSide', 'declared_before_set',
      'landingContact', 'whole_foot_inside_marked_zone',
      'absorption', 'ankle_knee_hip_with_alignment_control',
      'hold', 'declared_and_stable_without_extra_contact',
      'completion', 'full_stand_then_step_down',
      'boxHeight', 'declared_and_below_maximum_jump_capacity',
      'selectable', TRUE,
      'identityQuarantine', FALSE
    ),
    jsonb_build_object(
      'gripDemand', seed.grip_demand,
      'spinalLoading', seed.spinal_loading,
      'eccentricStress', seed.eccentric_stress,
      'landingContactsPerRep', 1,
      'externalLoadMethod', 'bodyweight',
      'loadingType', 'ballistic_vertical_projection_to_raised_surface',
      'impactClass', 'moderate_unilateral_landing_with_box_edge_and_fall_consequence',
      'primaryStress', jsonb_build_array(
        'rapid_ankle_knee_and_hip_extension',
        CASE seed.takeoff_contract
          WHEN 'same_leg_unilateral_takeoff_and_landing'
            THEN 'unilateral_takeoff_impulse'
          ELSE 'bilateral_takeoff_impulse'
        END,
        'box_clearance_and_in_flight_position',
        'single_leg_foot_ankle_knee_and_hip_absorption',
        'frontal_and_transverse_plane_stabilization',
        'balance_hold_stand_and_step_down'
      )
    ),
    jsonb_build_object(
      'localMuscleFatigue', seed.local_muscle_fatigue,
      'gripFatigue', 2,
      'technicalFatigueSensitivity', seed.technical_fatigue_sensitivity,
      'impactAccumulation', seed.impact_accumulation,
      'recoveryHours', seed.recovery_hours,
      'cumulativeBudgets', jsonb_build_array(
        'total_takeoff_contacts',
        CASE seed.takeoff_contract
          WHEN 'same_leg_unilateral_takeoff_and_landing'
            THEN 'unilateral_takeoff_contacts_per_side'
          ELSE 'bilateral_takeoff_contacts'
        END,
        'unilateral_landing_contacts_per_side',
        'high_intent_vertical_jump_exposures',
        'lower_leg_and_tendon_loading',
        'single_leg_balance_and_absorption',
        'box_edge_and_fall_consequence',
        'technical_sensitivity'
      ),
      'fatigueSignals', jsonb_build_array(
        'takeoff_height_or_speed_decline', 'forward_dive_or_box_edge_contact',
        'toe_only_or_partial_foot_landing', 'knee_valgus_or_pelvic_drop',
        'trunk_collapse_or_rotation', 'extra_hop_or_opposite_foot_touch',
        'failed_hold_or_unsafe_exit'
      )
    ),
    jsonb_build_object(
      'primaryPhase', 'output',
      'secondaryPhase', 'movement_intelligence',
      'placement',
        'early_after_preparation_before_material_jump_landing_lower_leg_or_unilateral_fatigue',
      'freshnessSensitive', TRUE,
      'prescriptionUnit', 'quality_repetitions_per_landing_side',
      'sideBalanceRequired', TRUE,
      'takeoffAndLandingContractMustBeExplicit', TRUE,
      'stepDownExitRequired', TRUE,
      'difficultyModel', 'max_exercise_complexity_physical_difficulty',
      'proficiencyClassification', NULL
    ),
    'review'
  FROM box_jump_single_leg_variant_seed seed
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
    CASE phase.phase_key
      WHEN 'output'
        THEN 'Develop high-quality vertical projection to an accurate, stable single-leg box landing while preserving clearance, whole-foot contact, alignment, hold, stand, and step-down.'
      ELSE
        'Learn repeatable takeoff, box clearance, whole-foot contact, ankle-knee-hip absorption, alignment, balance hold, full stand, and controlled step-down at submaximal intent.'
    END,
    CASE phase.phase_key WHEN 'output' THEN 90 ELSE 82 END,
    CASE phase.phase_key WHEN 'output' THEN 90 ELSE 86 END,
    jsonb_build_object(
      'verticalPower', CASE phase.phase_key WHEN 'output' THEN 92 ELSE 66 END,
      'singleLegLandingControl',
        CASE phase.phase_key WHEN 'output' THEN 84 ELSE 96 END,
      'movementLearning',
        CASE phase.phase_key WHEN 'output' THEN 68 ELSE 96 END,
      'fatigueConditioning', 6
    ),
    jsonb_build_object(
      'sets', CASE phase.phase_key WHEN 'output' THEN '2-4' ELSE '2-3' END,
      'repetitionsPerSide', '2-4',
      'restSeconds',
        CASE phase.phase_key WHEN 'output' THEN '120-240' ELSE '90-180' END,
      'effort', CASE phase.phase_key
        WHEN 'output' THEN 'high_intent_only_while_every_quality_gate_holds'
        ELSE 'submaximal_rehearsal_with_full_reset_and_stable_hold'
      END,
      'takeoffContract', seed.takeoff_contract,
      'landingSide', 'declared_and_balanced_unless_documented_otherwise',
      'boxHeightRule',
        'lowest_height_that_preserves_vertical_projection_clearance_whole_foot_contact_alignment_hold_and_exit',
      'exit', 'step_down_only'
    ),
    'Declared takeoff is correct, the front edge is cleared, the whole landing foot contacts inside the zone, ankle-knee-hip absorption and alignment remain controlled, the hold is stable without extra contact, and the athlete stands and steps down without symptoms.',
    ARRAY[
      'Stop for pain, numbness, tingling, dizziness, instability, or apprehension.',
      'Stop for a moving box, poor traction, obscured edge, unsafe clearance, lane intrusion, or blocked step-down route.',
      'Stop on edge contact, missed box, toe-only or partial-foot landing, valgus, pelvic drop, trunk collapse or rotation, extra hop, opposite-foot touch, or failed hold.',
      'Stop when takeoff height, speed, landing control, or safe exit materially declines.'
    ]::TEXT[],
    'Declare takeoff contract, landing side, box height, start distance, target zone, hold, repetitions, rest, and exit. Stand outside the takeoff, fall, and step-down paths while observing the full sequence.',
    'Jump up, clear the edge, land whole-foot and quiet, hold, stand tall, then step down.',
    CASE phase.phase_key
      WHEN 'output'
        THEN 'Higher-quality vertical power expression with accurate unilateral box landing under low fatigue.'
      ELSE
        'More repeatable clearance, whole-foot contact, alignment, absorption, balance, and exit control.'
    END,
    ARRAY['box']::TEXT[],
    jsonb_build_object(
      'space', 'exclusive_marked_takeoff_box_landing_fall_and_step_down_station',
      'participants', 'one_active_jumper_per_box',
      'setupSeconds', 75,
      'transitionSeconds', 20,
      'boxInspection', 'before_session_and_after_any_shift',
      'exitRule', 'step_down_only',
      'coachPosition', 'outside_takeoff_fall_and_exit_paths'
    ),
    ARRAY(
      SELECT regression_variant.id
      FROM coaching.exercise_definition_v1 regression_definition
      JOIN coaching.exercise_variant_v1 regression_variant
        ON regression_variant.definition_id = regression_definition.id
      WHERE regression_definition.slug = 'box-jump'
        AND regression_definition.status <> 'archived'
        AND regression_variant.status <> 'archived'
    ),
    jsonb_build_object(
      'attemptSeconds', CASE phase.phase_key WHEN 'output' THEN 6 ELSE 8 END,
      'resetSeconds', CASE phase.phase_key WHEN 'output' THEN 24 ELSE 22 END,
      'sideChangeSeconds', 25,
      'stepDownSeconds', 5,
      'setDurationFormula',
        'quality_repetitions_per_side_x_two_x_attempt_plus_hold_step_down_and_reset',
      'durationIncludesSetup', TRUE
    ),
    jsonb_build_object(
      'regressFirst', jsonb_build_array(
        'reduce_box_height', 'use_bilateral_takeoff',
        'increase_landing_target_size', 'reduce_intent',
        'use_floor_level_single_leg_landing', 'reduce_repetitions',
        'increase_rest'
      ),
      'progressOneVariableAtATime', jsonb_build_array(
        'takeoff_intent', 'box_height', 'start_distance_precision',
        'target_precision', 'hold_duration', 'unilateral_takeoff'
      ),
      'symptomRule', 'stop_and_select_reviewed_pain_free_alternative'
    ),
    jsonb_build_object(
      'required', jsonb_build_array(
        'variant', 'takeoff_leg_or_legs', 'landing_side',
        'box_height_and_dimensions', 'start_distance', 'landing_zone',
        'hold', 'quality_repetitions', 'rest', 'stop_reason'
      ),
      'optional', jsonb_build_array(
        'jump_height_or_flight_time', 'takeoff_force',
        'landing_sound', 'stabilization_time',
        'edge_contact', 'foot_contact_error', 'alignment_error'
      ),
      'comparisonRule',
        'Compare only when takeoff contract, landing side, box, height, start distance, target, hold, intent, and measurement method match.'
    ),
    jsonb_build_object(
      'athleteBeforeSet', jsonb_build_array(
        'Confirm takeoff version, landing side, box height, target, hold, and step-down route.',
        'Report pain, instability, dizziness, apprehension, or uncertainty before starting.'
      ),
      'coachDuringSet', jsonb_build_array(
        'Watch takeoff, clearance, contact, alignment, absorption, hold, stand, and exit.',
        'Stop immediately on any equipment, symptom, safety, or quality trigger.'
      ),
      'afterSet', jsonb_build_array(
        'Record quality repetitions, side, errors, symptoms, and substitutions.',
        'Do not progress box height or takeoff demand after a stop trigger.'
      ),
      'mediaFallback',
        'Use the written contract and a qualified live demonstration until an exact video is independently approved.'
    ),
    'review'
  FROM box_jump_single_leg_variant_seed seed
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id = target_definition_id
   AND variant.variant_key = seed.variant_key
   AND variant.status <> 'archived'
  CROSS JOIN (
    VALUES
      ('output-power', 'output', 'primary'),
      ('movement-learning', 'movement_intelligence', 'secondary')
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
        'bilateral-takeoff-single-leg-landing',
        'same-leg-unilateral-takeoff-and-landing',
        'progression',
        91,
        ARRAY['complexity', 'load', 'stability']::TEXT[],
        'Using one leg for both takeoff and landing preserves the box, unilateral landing, hold, stand, and exit while increasing propulsion, coordination, balance, and per-leg demand.',
        '{"requiresPainFreeUnilateralTakeoff":true,"requiresStableBilateralTakeoffVariant":true,"humanReviewRequired":true}'::JSONB
      ),
      (
        'same-leg-unilateral-takeoff-and-landing',
        'bilateral-takeoff-single-leg-landing',
        'regression',
        91,
        ARRAY['complexity', 'load', 'stability']::TEXT[],
        'Restoring bilateral takeoff preserves the unilateral box landing while reducing per-leg propulsion and takeoff-balance demand.',
        '{"takeoffContract":"bilateral_takeoff_to_declared_single_leg_landing","humanReviewRequired":true}'::JSONB
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
    family_variant.id,
    box_variant.id,
    'lateral_substitution',
    72,
    ARRAY['equipment', 'landing', 'complexity', 'load']::TEXT[],
    'A reviewed generic box-jump variant may preserve vertical projection and box logistics while changing unilateral landing demand; it is never a silent equivalent.',
    jsonb_build_object(
      'landingContractChanges', TRUE,
      'requiresExplicitCoachSelection', TRUE,
      'humanReviewRequired', TRUE
    ),
    'review'
  FROM box_jump_single_leg_variant_seed seed
  JOIN coaching.exercise_variant_v1 family_variant
    ON family_variant.definition_id = target_definition_id
   AND family_variant.variant_key = seed.variant_key
   AND family_variant.status <> 'archived'
  JOIN coaching.exercise_definition_v1 box_definition
    ON box_definition.slug = 'box-jump'
   AND box_definition.status <> 'archived'
  JOIN LATERAL (
    SELECT candidate.id
    FROM coaching.exercise_variant_v1 candidate
    WHERE candidate.definition_id = box_definition.id
      AND candidate.status <> 'archived'
    ORDER BY candidate.variant_key
    LIMIT 1
  ) box_variant ON TRUE
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
  FROM box_jump_single_leg_variant_seed seed
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id = target_definition_id
   AND variant.variant_key = seed.variant_key
   AND variant.status <> 'archived'
  CROSS JOIN LATERAL (
    VALUES
      (
        'technicalComplexity',
        seed.exercise_complexity,
        CASE seed.takeoff_contract
          WHEN 'same_leg_unilateral_takeoff_and_landing'
            THEN 'One-leg takeoff, edge clearance, accurate same-leg box contact, unilateral absorption, alignment, stable hold, stand, and exit create high exercise complexity.'
          ELSE 'Bilateral takeoff reduces propulsion complexity while accurate unilateral box contact, absorption, alignment, stable hold, stand, and exit remain moderately high.'
        END
      ),
      (
        'absoluteLoadDemand',
        seed.physical_difficulty,
        CASE seed.takeoff_contract
          WHEN 'same_leg_unilateral_takeoff_and_landing'
            THEN 'One leg supplies the takeoff impulse and accepts the landing before standing, creating high per-leg physical demand.'
          ELSE 'Two legs share takeoff while one leg accepts and stabilizes the landing, creating moderately high physical demand.'
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

  CREATE TEMP TABLE box_jump_single_leg_source_seed (
    source_key TEXT PRIMARY KEY,
    source_url TEXT NOT NULL,
    source_title TEXT NOT NULL,
    source_publisher TEXT NOT NULL,
    source_kind TEXT NOT NULL,
    evidence_quality INTEGER NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO box_jump_single_leg_source_seed VALUES
    (
      'nsca_progression',
      'https://www.nsca.com/globalassets/education/ptq/ptq-1.3.pdf',
      'Complex Set Variations—Improving Strength and Power',
      'National Strength and Conditioning Association',
      'professional_standard',
      82
    ),
    (
      'nsca_contrast',
      'https://www.nsca.com/globalassets/education/ptq/ptq-7.3--updated.pdf',
      'How to Utilize Contrast Training for Strength, Power, and Performance',
      'National Strength and Conditioning Association',
      'professional_standard',
      80
    ),
    (
      'ace_instruction',
      'https://www.acefitness.org/resources/everyone/exercise-library/115/box-jumps/',
      'Box Jumps',
      'American Council on Exercise',
      'expert_instruction',
      76
    ),
    (
      'landing_biomechanics',
      'https://pubmed.ncbi.nlm.nih.gov/17620779/',
      'Biomechanical differences between unilateral and bilateral landings from a jump',
      'Clinical Journal of Sport Medicine',
      'peer_reviewed_research',
      83
    ),
    (
      'plyometric_meta_analysis',
      'https://pubmed.ncbi.nlm.nih.gov/40281589/',
      'Effect of unilateral and bilateral plyometric training on jumping, sprinting, and change of direction abilities',
      'BMC Sports Science, Medicine and Rehabilitation',
      'peer_reviewed_research',
      88
    ),
    (
      'box_height_study',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC11166134/',
      'Does Box Height Matter? A Comparative Analysis of Box Height on Box Jump Performance in Men and Women',
      'International Journal of Exercise Science',
      'peer_reviewed_research',
      84
    ),
    (
      'world_athletics',
      'https://worldathletics.org/download/downloadnsa?filename=8c33cc0b-ba23-4d3d-9dbe-168e10d5fcfb.pdf&urlslug=plyometrics-for-beginners-basic-considerati',
      'Plyometrics for Beginners: Basic Considerations',
      'World Athletics',
      'governing_body',
      76
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

  CREATE TEMP TABLE box_jump_single_leg_evidence_seed (
    section_key TEXT PRIMARY KEY,
    source_key TEXT NOT NULL,
    claims_json JSONB NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO box_jump_single_leg_evidence_seed VALUES
    (
      'identity', 'nsca_progression',
      '["NSCA presents two-foot takeoff to one-foot box landing and one-foot hopping to one-foot box landing as progressive variations of the same box-jump task.","Takeoff laterality is an exact difficulty-bearing variant, not a skill-level label or a duplicate identity."]'::JSONB
    ),
    (
      'taxonomy', 'nsca_progression',
      '["Both exact variants preserve standing vertical projection to a raised box and a controlled single-leg terminal landing.","Takeoff leg count, takeoff-to-landing relationship, box, side, target, hold, and exit must be explicit."]'::JSONB
    ),
    (
      'anatomy', 'landing_biomechanics',
      '["Unilateral landing changes knee kinematics and lower-limb muscle activation compared with bilateral landing.","Foot, ankle, knee, hip, pelvis, and trunk tissues coordinate propulsion, absorption, alignment, balance, stand, and exit."]'::JSONB
    ),
    (
      'biomechanics', 'ace_instruction',
      '["ACE describes countermovement, coordinated ankle-knee-hip extension, level feet in flight, soft whole-foot landing, hip displacement for absorption, and organized trunk position.","This family adds declared takeoff laterality, box clearance, one-foot target contact, frontal-plane control, stable hold, full stand, and step-down."]'::JSONB
    ),
    (
      'difficulty', 'plyometric_meta_analysis',
      '["Unilateral and bilateral plyometric modes have modality-specific effects and are not interchangeable.","Score exercise complexity and physical difficulty for each exact takeoff contract; overall is their maximum and no exercise skill level is assigned."]'::JSONB
    ),
    (
      'load_fatigue_recovery', 'box_height_study',
      '["Box height changes box-jump execution and must be prescribed rather than inferred from aspiration.","Track takeoff contacts, unilateral landing contacts, lower-leg and tendon loading, per-leg propulsion and absorption, balance, and technical sensitivity."]'::JSONB
    ),
    (
      'constraints', 'ace_instruction',
      '["ACE requires a stable raised platform on a non-slip surface and limits height relative to jump ability.","Declare inspected box geometry, visible edge and target, traction, start distance, landing side, ceiling and fall clearance, step-down route, traffic, and coach sightline."]'::JSONB
    ),
    (
      'dosage', 'world_athletics',
      '["Plyometric exposure should progress from technically controlled tasks with appropriate recovery and contact volume.","Use low side-balanced repetitions, full resets, and rest sufficient to preserve takeoff, clearance, contact, alignment, quiet absorption, hold, and exit."]'::JSONB
    ),
    (
      'instructions', 'nsca_progression',
      '["The two-foot variation extends explosively and lands on one foot; the progression uses a one-foot hop and one-foot landing.","Declare side, load, drive up, clear the edge, land whole-foot, absorb, hold, stand, and step down."]'::JSONB
    ),
    (
      'safety_stop_rules', 'landing_feedback',
      '["Landing feedback should target defined observable mechanics rather than vague effort.","Stop for symptoms, unsafe equipment or surface, edge contact, missed or partial-foot landing, alignment loss, extra contact, failed hold, output decline, or unsafe exit."]'::JSONB
    ),
    (
      'programming', 'nsca_contrast',
      '["NSCA treats single-leg box jumps as unilateral vertical jump work and recommends two-leg landing when reducing risk in contrast pairing.","A one-leg landing requires explicit intent and a higher technical and safety gate; place it early and fresh, not as conditioning."]'::JSONB
    ),
    (
      'athlete_support', 'ace_instruction',
      '["Athlete support should show takeoff feet, landing side, box and target, distance, hold, stand, step-down, primary cue, and stop signal.","Offer lower height, bilateral takeoff, floor-level landing, fewer contacts, and longer rest without assigning an exercise skill level."]'::JSONB
    ),
    (
      'coach_support', 'landing_biomechanics',
      '["Unilateral landing is biomechanically distinct from bilateral landing and requires observation of sagittal- and frontal-plane control.","Expose takeoff contract, side, box, dose, rest, contact budget, observation angle, clearance, contact, alignment, hold, exit, and shutdown."]'::JSONB
    ),
    (
      'accessibility', 'landing_intervention',
      '["Landing tasks can be modified through task progression, instruction, feedback, and environmental constraints.","Options include lower or wider box, high-contrast edge and target, bilateral takeoff, floor stick, fewer contacts, longer rest, and nonvideo instruction."]'::JSONB
    ),
    (
      'alternates', 'nsca_progression',
      '["Two-foot takeoff to one-foot landing and one-foot takeoff to one-foot landing are exact variants of one terminal box-jump identity.","Bilateral landing, opposite-leg transfer, lateral approach, seated start, hurdle entry, depth-drop sequence, and rebound require separate review."]'::JSONB
    ),
    (
      'media', 'youtube_embed',
      '["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","The five links have healthy metadata only; full viewing, exact-contract, safety, captions, accessibility, reviewer identity, and approval remain unresolved."]'::JSONB
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
  FROM box_jump_single_leg_evidence_seed evidence
  JOIN box_jump_single_leg_source_seed source
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
        'TY40H0801xc',
        'https://www.youtube.com/watch?v=TY40H0801xc',
        'Box Jump to Single Leg Landing',
        'FlowZone Performance Coaching',
        'YouTube exact-name discovery rechecked through current oEmbed',
        'Current title and oEmbed response are healthy. Full viewing, exact takeoff contract, landing side, box setup, hold, exit, instruction quality, safety, captions, accessibility, reviewer identity, and approval remain pending.'
      ),
      (
        'x2scn5kx5pw',
        'https://www.youtube.com/watch?v=x2scn5kx5pw',
        'Box Jump 2-1 (Single Leg Landing)',
        'RC Strength Training',
        'YouTube bilateral-to-unilateral title discovery rechecked through current oEmbed',
        'Title suggests a two-foot to one-foot contract. Full viewing and every human review gate remain pending.'
      ),
      (
        'eM3qqx0Eli0',
        'https://www.youtube.com/watch?v=eM3qqx0Eli0',
        'Box Jump to Single Leg Landing',
        'Champion Physical Therapy and Performance',
        'YouTube exact-name discovery rechecked through current oEmbed',
        'Current title and oEmbed response are healthy. Full viewing and every human review gate remain pending.'
      ),
      (
        'HFCuJR1T0Ek',
        'https://www.youtube.com/watch?v=HFCuJR1T0Ek',
        'Single leg box jump with single leg landing',
        'Mike Guadango (Freak Strength)',
        'YouTube unilateral-to-unilateral title discovery rechecked through current oEmbed',
        'Title suggests a one-foot takeoff and one-foot landing. Full viewing and every human review gate remain pending.'
      ),
      (
        'qEhhx87Dox8',
        'https://www.youtube.com/watch?v=qEhhx87Dox8',
        'Single Leg Box Jump (Single Leg Landing)',
        'Forever Strong Training Center',
        'YouTube unilateral-to-unilateral title discovery rechecked through current oEmbed',
        'Title suggests a one-foot takeoff and one-foot landing. Full viewing and every human review gate remain pending.'
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
        'Single-Leg Box Jump to Single-Leg Landing', 'same_identity',
        'The one-foot takeoff progression preserves the same vertical box jump ending in a controlled one-foot landing.',
        '{"takeoff":"unilateral","landing":"unilateral","identityDisposition":"exact_takeoff_variant"}'::JSONB
      ),
      (
        'Standing Box Jump to Single-Leg Landing', 'same_identity',
        'Standing names the same broad identity and the source summary specifies its bilateral-takeoff exact variant.',
        '{"takeoff":"bilateral","landing":"unilateral"}'::JSONB
      ),
      (
        'Box Jump 2-to-1', 'same_identity',
        'Two-to-one is shorthand for bilateral takeoff and unilateral landing.',
        '{"takeoff":"bilateral","landing":"unilateral"}'::JSONB
      ),
      (
        'Bilateral Takeoff to Single-Leg Box Landing', 'new_variant',
        'This exact selectable contract declares two-foot propulsion and a left or right one-foot landing.',
        '{"takeoff":"bilateral","landing":"declared_unilateral"}'::JSONB
      ),
      (
        'Same-Leg Single-Leg Box Jump and Landing', 'new_variant',
        'This exact contract uses the same declared leg for takeoff and landing.',
        '{"takeoff":"unilateral","landing":"ipsilateral_unilateral"}'::JSONB
      ),
      (
        'Opposite-Leg Box Jump Landing', 'new_variant',
        'Taking off from one leg and landing on the opposite leg changes transfer, flight organization, and landing-side demand.',
        '{"takeoffLandingRelationship":"contralateral"}'::JSONB
      ),
      (
        'Box Jump to Bilateral Landing', 'new_variant',
        'A two-foot landing reduces unilateral absorption and balance demand and changes the terminal contract.',
        '{"landing":"bilateral"}'::JSONB
      ),
      (
        'Lateral Box Jump to Single-Leg Landing', 'new_definition',
        'A lateral approach changes projection plane, edge relationship, frontal-plane impulse, and landing geometry.',
        '{"projection":"lateral"}'::JSONB
      ),
      (
        'Seated Box Jump to Single-Leg Landing', 'new_variant',
        'A seated start removes the countermovement and changes starting force and timing while preserving the target and terminal landing.',
        '{"start":"seated"}'::JSONB
      ),
      (
        'Hurdle Hop to Box Single-Leg Landing', 'new_definition',
        'A hurdle entry adds an earlier flight and landing contact, reactive coupling, spacing, and cumulative impact.',
        '{"entry":"hurdle_hop","contactSequence":"multi_contact"}'::JSONB
      ),
      (
        'Box Jump to Single-Leg Landing and Depth Drop', 'new_definition',
        'A drop from the box creates a second aerial and landing action with a different impact and order contract.',
        '{"terminalAction":"depth_drop_after_box_landing"}'::JSONB
      ),
      (
        'Continuous Rebound Single-Leg Box Jump', 'new_definition',
        'Removing the stable hold and step-down creates a repeated reactive-contact task with different stiffness, fatigue, and safety requirements.',
        '{"cadence":"continuous_reactive","exit":"rebound"}'::JSONB
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
  SET technical = 6.2,
      load = 6.0,
      overall = 6.2,
      notes =
        'Legacy takeoff-to-landing leg contract remains incomplete; candidate values represent the bilateral-takeoff exact baseline and require independent calibration.',
      updated_at = now()
  WHERE profile.exercise_id IN (
    SELECT legacy_exercise_id
    FROM coaching.exercise_definition_source_v1
    WHERE definition_id = target_definition_id
  );

  UPDATE coaching.exercise_score_v1 score
  SET technical_complexity = 62,
      absolute_load_demand = 60,
      coordination_demand = 72,
      impact = 52,
      supervision_demand = 74,
      base_overall_difficulty = greatest(62, 60),
      legacy_scores = score.legacy_scores || jsonb_build_object(
        'candidateReassessment', migration_key,
        'difficultyModel', 'max_exercise_complexity_physical_difficulty',
        'sourceIdentity',
          'standing_vertical_box_jump_to_single_leg_landing_incomplete_leg_contract',
        'identityQuarantined', TRUE,
        'exerciseSkillLevelAllowed', FALSE,
        'independentCalibrationRequired', TRUE
      ),
      migration_confidence = 66,
      human_review_status = 'queued',
      reviewed_by = NULL,
      reviewed_at = NULL,
      review_notes =
        'Research-backed candidate reassessment only; exact takeoff-to-landing contract assignment and independent calibration remain required.',
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
      movement_family = 'Standing vertical box jump to single-leg box landing',
      primary_phase_key = 'output',
      phase_subrole = 'jump_land_explosive_power',
      primary_order_slot = 'box_jump_single_leg_landing_power',
      card_summary =
        'Standing vertical box jump to a declared one-foot box landing, stable hold, full stand, and step-down. Legacy leg contracts are incomplete and nonselectable.',
      description =
        'Jump vertically from a declared bilateral or unilateral takeoff to an inspected box, clear the front edge, land whole-foot on the declared side, absorb and stabilize, stand fully, and step down.',
      instructions =
        'Declare takeoff leg or legs, landing side, box height, start distance, target zone, hold, dose, and step-down route. Jump up, clear the edge, land whole-foot and quiet, hold, stand, and step down.',
      coach_language =
        'Observe takeoff, vertical projection, edge clearance, whole-foot contact, foot-knee-hip-pelvis-trunk alignment, absorption, hold, stand, and exit. Stop on symptoms, unsafe logistics, contact error, alignment loss, or output decline.',
      athlete_language =
        'Jump up, clear the edge, land whole-foot and quiet, hold, stand tall, then step down.',
      scalable_variables = ARRAY[
        'takeoff_laterality', 'landing_side',
        'takeoff_to_landing_leg_relationship', 'box_height_and_dimensions',
        'start_distance', 'landing_zone', 'countermovement_and_arm_action',
        'intent', 'hold_duration', 'repetitions_per_side', 'rest'
      ]::TEXT[],
      movement_requirements = jsonb_build_object(
        'projection', 'standing_vertical_to_raised_box',
        'takeoff_contract', 'incomplete_legacy_provenance',
        'landing', 'declared_single_leg_whole_foot_inside_zone',
        'completion', 'stable_hold_full_stand_step_down',
        'selectable_exact_variant', FALSE
      ),
      coaching_execution = jsonb_build_object(
        'setup', jsonb_build_array(
          'Declare exact variant, side, box, height, start mark, target zone, hold, dose, rest, and exit.',
          'Inspect box stability, traction, visible edge, target, takeoff floor, clearance, fall zone, step-down route, and traffic.',
          'Confirm a pain-free floor landing and low-box trial before high intent.'
        ),
        'quality_gate', jsonb_build_array(
          'Declared takeoff is correct and vertically directed.',
          'Front edge is cleared without a forward dive.',
          'Whole landing foot contacts inside the zone with controlled alignment.',
          'Stable hold, full stand, and step-down are completed without extra contact.'
        ),
        'stop_signs', jsonb_build_array(
          'Pain, neurologic symptoms, instability, fear, or apprehension',
          'Unsafe box, surface, edge visibility, clearance, traffic, or exit',
          'Edge contact, missed or partial-foot landing, alignment loss, extra contact, failed hold, output decline, or unsafe exit'
        )
      ),
      programming_logic = jsonb_build_object(
        'difficulty_model', 'max_exercise_complexity_physical_difficulty',
        'exercise_skill_level', NULL,
        'identity_rule', 'select_exact_takeoff_and_landing_contract',
        'fatigue_rule',
          'place_before_material_jump_landing_lower_leg_tendon_or_unilateral_fatigue',
        'substitution_rule',
          'never_silently_change_takeoff_laterality_landing_side_box_target_or_exit',
        'legacy_source_rule', 'incomplete_leg_contract_sources_are_nonselectable'
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
        '324_coaching_box_jump_single_leg_landing_identity_consolidation',
      'completenessMigration', migration_key,
      'researchBatch', 'box-jump-single-leg-landing-family-v1',
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
        'message', 'Progression, regression, and substitution edges remain review-only.'
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
