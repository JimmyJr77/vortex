-- Complete the candidate-only shuffle-to-rotational medicine-ball throw family
-- after migration 322 consolidates its duplicate definition.
--
-- Exact selectable variants:
--   * lateral shuffle, wall throw only / retrieve
--   * lateral shuffle, predictable wall rebound / controlled catch
--
-- Planned versus reactive cueing, shuffle count, approach distance, ball
-- specification, wall distance, and target are explicit modifiers. Both legacy
-- sources leave the return contract unspecified and remain archived,
-- nonselectable provenance. Exercise difficulty uses exercise complexity and
-- physical difficulty, with overall equal to their maximum. Exercise cards
-- receive no proficiency level. Evidence, media, graph, calibration, and
-- publication decisions remain candidate/review-only. IDEMPOTENT and
-- fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT := '323_coaching_shuffle_rotational_throw_family_completion';
  target_definition_id UUID;
  facility BIGINT;
  target_card_version INTEGER;
  protected_records INTEGER;
  unexpected_variants INTEGER;
BEGIN
  SELECT id, facility_id
  INTO target_definition_id, facility
  FROM coaching.exercise_definition_v1
  WHERE slug = 'shuffle-to-rotational-medicine-ball-throw'
    AND status <> 'archived';

  IF target_definition_id IS NULL THEN
    RAISE EXCEPTION
      'Shuffle rotational-throw family completion requires the active survivor definition';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_definition_v1
    WHERE slug = 'med-ball-shuffle-to-rotation-throw'
      AND status <> 'archived'
  ) THEN
    RAISE EXCEPTION
      'Shuffle rotational-throw family completion requires migration 322 first';
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
          SELECT id
          FROM coaching.exercise_variant_v1
          WHERE definition_id = target_definition_id
        )
        OR relationship.to_variant_id IN (
          SELECT id
          FROM coaching.exercise_variant_v1
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
      'Shuffle rotational-throw family completion refused to override % protected records',
      protected_records;
  END IF;

  SELECT COUNT(*)
  INTO unexpected_variants
  FROM coaching.exercise_variant_v1
  WHERE definition_id = target_definition_id
    AND status <> 'archived'
    AND variant_key NOT IN (
      'baseline',
      'lateral-shuffle-wall-throw-only',
      'lateral-shuffle-wall-rebound-catch'
    );

  IF unexpected_variants > 0 THEN
    RAISE EXCEPTION
      'Shuffle rotational-throw family completion found % unexpected active variants',
      unexpected_variants;
  END IF;

  UPDATE coaching.exercise_variant_v1
  SET variant_key = 'legacy-unspecified-return-source-1317',
      status = 'archived',
      requirements_json = requirements_json || jsonb_build_object(
        'sourceApproach', 'lateral_shuffle_or_crow_hop',
        'sourceReturnContract', 'unspecified',
        'selectable', FALSE,
        'identityQuarantine', TRUE,
        'quarantineReason',
          'The legacy source does not declare throw-only versus rebound-and-catch.'
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
      canonical_name = 'Shuffle-to-Rotational Medicine Ball Throw',
      display_name = 'Shuffle-to-Rotational Medicine Ball Throw',
      description =
        'Use a declared lateral shuffle or crow-hop to create momentum into a controlled plant, whole-body rotational two-hand medicine-ball projection to an inspected wall, and balanced finish. The exact variant states whether the athlete retrieves the ball or tracks and absorbs a predictable rebound.',
      family_key = 'lateral_shuffle_to_rotational_medicine_ball_wall_projection',
      movement_patterns = ARRAY['locomote', 'rotate', 'push', 'brace']::TEXT[],
      body_regions = ARRAY[
        'foot', 'ankle', 'knee', 'hip', 'pelvis', 'core', 'spine',
        'rib_cage', 'scapula', 'shoulder', 'elbow', 'wrist', 'hand',
        'eye_hand'
      ]::TEXT[],
      required_equipment = ARRAY['medicine_ball', 'wall']::TEXT[],
      optional_equipment = ARRAY['cones', 'line_tape', 'timer', 'mirror']::TEXT[],
      environment_json = jsonb_build_object(
        'surface', 'level_non_slip_surface_with_declared_lateral_approach_and_pivot_space',
        'ballSpecification', 'declared_mass_material_diameter_and_rebound_behavior',
        'target', 'structurally_suitable_inspected_wall_with_declared_target',
        'startMark', 'declared_and_visible',
        'plantZone', 'declared_and_visible',
        'approachDistance', 'declared_and_repeatable',
        'flightLane', 'clear_from_release_to_wall',
        'returnPath', 'clear_and_predictable_when_rebound_catch_is_prescribed',
        'traffic', 'one_active_thrower_per_lane_no_cross_traffic_or_collection_during_attempt',
        'lighting', 'ball_target_feet_plant_zone_and_return_path_clearly_visible',
        'coachSightline', 'approach_plant_pivot_sequence_release_target_finish_and_return_visible'
      ),
      population_json = jsonb_build_object(
        'readiness', jsonb_build_array(
          'pain_free_lateral_shuffle_plant_pivot_and_two_hand_throw',
          'can_brake_and_redirect_lateral_momentum',
          'stable_plant_and_balanced_finish',
          'can_project_a_light_ball_without_uncontrolled_spine_motion',
          'can_track_and_absorb_return_when_catch_is_prescribed',
          'can_follow_stop_lane_clear_and_collection_instructions'
        ),
        'contraindicationFlags', jsonb_build_array(
          'current_foot_ankle_knee_hip_back_shoulder_elbow_wrist_or_hand_pain',
          'numbness_dizziness_instability_or_neurologic_symptoms',
          'uncontrolled_plant_pivot_spine_motion_or_balance_loss',
          'unsafe_ball_wall_lane_surface_approach_space_or_return_path',
          'unassessed_recent_injury_surgery_or_rehabilitation_restriction'
        ),
        'supervision', 'direct_observation_until_approach_plant_sequence_target_and_return_contract_are_repeatable',
        'selectionBoundary',
          'Select the exact return contract, approach, throw side, ball, target, distance, cueing, and dose from current readiness and intent; exercise cards do not carry proficiency levels.',
        'clinicalBoundary',
          'Symptoms, instability, recent surgery, neurologic signs, or rehabilitation restrictions require individualized clinician guidance.'
      ),
      anatomy_json = jsonb_build_object(
        'primaryMuscles', jsonb_build_array(
          'gluteus_maximus',
          'gluteus_medius',
          'hip_rotators_and_adductors',
          'internal_and_external_obliques',
          'pectoralis_major'
        ),
        'secondaryMuscles', jsonb_build_array(
          'quadriceps', 'hamstrings', 'gastrocnemius_and_soleus',
          'transversus_abdominis', 'erector_spinae_and_multifidus',
          'anterior_deltoid', 'triceps_brachii', 'serratus_anterior',
          'rotator_cuff'
        ),
        'stabilizers', jsonb_build_array(
          'foot_and_ankle_stabilizers', 'gluteus_medius',
          'abdominal_wall', 'spinal_stabilizers',
          'scapular_stabilizers', 'rotator_cuff'
        ),
        'joints', jsonb_build_array(
          'foot_and_ankle', 'knee', 'hip', 'pelvis', 'spine',
          'scapulothoracic_articulation', 'shoulder', 'elbow',
          'wrist_and_hand'
        ),
        'jointActions', jsonb_build_array(
          'lateral_ankle_knee_and_hip_flexion_extension',
          'hip_abduction_adduction_and_internal_external_rotation',
          'plant_braking_and_redirection',
          'pelvic_and_thoracic_rotation',
          'shoulder_horizontal_adduction_and_flexion',
          'elbow_extension', 'scapular_protraction',
          'wrist_and_hand_release',
          'whole_body_deceleration_after_release',
          'return_absorption_when_catch_is_prescribed'
        ),
        'planes', jsonb_build_array('transverse', 'frontal', 'sagittal'),
        'laterality', 'bilateral_implement_with_declared_left_or_right_approach_and_throw_side',
        'primaryActions', jsonb_build_array(
          'load_trail_hip',
          'shuffle_laterally_into_declared_plant_zone',
          'brake_and_redirect_lateral_momentum',
          'sequence_rotation_from_ground_to_hands',
          'project_ball_to_declared_wall_target',
          'decelerate_and_reset_or_absorb_declared_return'
        )
      ),
      athlete_support_json = jsonb_build_object(
        'whyItMatters',
          'This task develops fast transfer of lateral momentum through a controlled plant, hips, trunk, and arms into a rotational throw.',
        'beforeYouStart', jsonb_build_array(
          'Confirm your start mark, shuffle direction and count, throw side, plant zone, ball, target, and whether the ball returns.',
          'Make sure the approach, pivot, flight, and return lanes are empty.',
          'Use a ball you can move quickly and control.'
        ),
        'primaryCue', 'Load, shuffle, plant, turn from the ground up, throw through the target.',
        'selfChecks', jsonb_build_array(
          'My shuffle stays inside the marked lane.',
          'I plant under control without reaching or collapsing.',
          'My hips and trunk lead before my arms finish.',
          'I finish balanced and catch only when my version requires it.'
        ),
        'painGuidance',
          'Stop immediately for pain, numbness, tingling, dizziness, instability, a failed plant, or a return you cannot control.',
        'accessibility', jsonb_build_array(
          'lighter_or_softer_ball', 'larger_high_contrast_target',
          'shorter_or_slower_approach', 'throw_only_delivery',
          'fewer_repetitions', 'longer_reset', 'plain_text_and_nonvideo_instruction'
        )
      ),
      coach_support_json = jsonb_build_object(
        'stationSetup', jsonb_build_array(
          'Declare exact variant, approach, side, shuffle count, cueing, ball, wall, target, plant zone, lane, and collection procedure.',
          'Inspect the ball, wall, surface, start and plant marks, lighting, flight lane, and return path.',
          'Test rebound behavior at low intent before permitting a catch.'
        ),
        'observationPriorities', jsonb_build_array(
          'approach_rhythm_and_spacing', 'plant_and_pivot',
          'ground_hip_trunk_hand_sequence', 'spine_and_rib_control',
          'release_and_target_accuracy', 'finish_balance',
          'return_tracking_and_absorption_when_prescribed'
        ),
        'primaryCues', jsonb_build_array(
          'Own the lane.', 'Load then shuffle.', 'Plant under your hips.',
          'Ground, hips, trunk, hands.', 'Throw through the target.',
          'Own the finish.'
        ),
        'qualityGate',
          'Count a repetition only when the declared approach, plant, side, sequence, release, target, finish, and exact return contract are satisfied without symptoms.',
        'immediateStop', jsonb_build_array(
          'pain_numbness_dizziness_instability_or_apprehension',
          'unsafe_ball_wall_surface_lane_plant_zone_or_return',
          'plant_collapse_uncontrolled_spine_motion_or_balance_loss',
          'target_loss_wild_release_material_velocity_decline_or_missed_catch'
        ),
        'recordAfterSet', jsonb_build_array(
          'variant_approach_and_side', 'ball_and_rebound_type',
          'distance_target_and_plant_zone', 'completed_quality_repetitions',
          'target_hits_and_output_measure', 'plant_sequence_balance_or_catch_errors',
          'symptoms_stop_reason_and_substitution'
        )
      ),
      support_operations_json = jsonb_build_object(
        'selectionInputs', jsonb_build_array(
          'training_intent', 'readiness_and_symptoms', 'approach_and_throw_side',
          'shuffle_count_and_distance', 'planned_or_reactive_cue',
          'ball_and_wall_contract', 'target_and_return_contract',
          'available_time', 'weekly_lateral_plant_rotational_throw_and_catch_budgets'
        ),
        'logistics', jsonb_build_object(
          'participantStructure', 'individual_thrower_in_exclusive_lane',
          'oneActiveThrowerPerLane', TRUE,
          'ballCollectionRule', 'collect_only_after_lane_is_closed_and_thrower_is_stationary',
          'coachPosition', 'outside_approach_flight_and_return_paths_with_full_sequence_visible',
          'shutdownControl', 'coach_or_athlete_can_stop_lane_immediately'
        ),
        'substitutionPolicy', jsonb_build_object(
          'mustPreserve', jsonb_build_array(
            'rotational_power_intent', 'declared_side',
            'lateral_approach_or_explicit_regression', 'controlled_plant',
            'ballistic_projection', 'target_direction',
            'return_contract_or_lower_demand'
          ),
          'mayAdjust', jsonb_build_array(
            'ball_mass_and_softness', 'shuffle_count', 'approach_distance',
            'target_size_and_height', 'cueing', 'repetitions', 'rest',
            'throw_only_delivery'
          ),
          'neverSilent', jsonb_build_array(
            'planned_to_reactive', 'throw_to_catch', 'shuffle_to_bound',
            'wall_to_partner', 'bilateral_to_unilateral_release',
            'rotational_throw_to_scoop_slam_or_shot_put', 'symptom_related_change'
          ),
          'uncertaintyRule',
            'When approach, plant, ball, wall, lane, readiness, or return contract is unclear, use a reviewed static throw-only regression or a nonthrowing rotational alternative.'
        ),
        'feedbackCapture', jsonb_build_array(
          'pain_or_symptoms', 'target_hit_rate', 'release_output_when_available',
          'approach_plant_sequence_or_balance_error', 'catch_or_return_error',
          'equipment_or_lane_issue', 'substitution_reason', 'coach_override'
        )
      ),
      content_confidence = 84,
      scoring_confidence = 64,
      media_confidence = 50,
      approved_video_url = NULL,
      status = 'review',
      reviewed_by = NULL,
      approved_by = NULL,
      last_reviewed_at = NULL,
      provenance_json = provenance_json || jsonb_build_object(
        'identityMigration', '322_coaching_shuffle_rotational_throw_identity_consolidation',
        'structuralCompletionMigration', migration_key,
        'researchBatch', 'shuffle-rotational-medicine-ball-throw-family-v1',
        'researchVersion', '2026-07-26.34',
        'difficultyModel', 'max_exercise_complexity_physical_difficulty',
        'legacySourceReturnContract', 'unresolved_and_archived',
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

  CREATE TEMP TABLE shuffle_rotational_variant_seed (
    variant_key TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    return_contract TEXT NOT NULL,
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

  INSERT INTO shuffle_rotational_variant_seed VALUES
    (
      'lateral-shuffle-wall-throw-only',
      'Shuffle-to-Rotational Wall Throw — Throw and Retrieve',
      'throw_only_no_required_catch',
      ARRAY['lateral_shuffle', 'planned_cue', 'wall_target', 'throw_only']::TEXT[],
      56, 52, 68, 62, 56, 24, 32, 28, 34, 30, 54, 74, 28, 36
    ),
    (
      'lateral-shuffle-wall-rebound-catch',
      'Shuffle-to-Rotational Wall Throw — Rebound and Catch',
      'rebound_and_controlled_catch',
      ARRAY['lateral_shuffle', 'planned_cue', 'wall_target', 'rebound_catch']::TEXT[],
      64, 54, 76, 70, 68, 24, 36, 38, 36, 46, 60, 82, 32, 42
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
      'baseOverallDifficulty', greatest(
        seed.exercise_complexity,
        seed.physical_difficulty
      ),
      'overallFormula', 'max_exercise_complexity_physical_difficulty'
    ),
    jsonb_build_object(
      'stance', 'standing_athletic',
      'approach', 'declared_lateral_shuffle_or_crow_hop',
      'shuffleCount', 'declared_before_set',
      'approachDistance', 'declared_and_marked',
      'cueing', 'planned_unless_reactive_modifier_is_explicit',
      'plant', 'declared_zone_with_controlled_braking_and_pivot',
      'laterality', 'bilateral_implement_declared_left_or_right_approach_and_throw_side',
      'returnContract', seed.return_contract,
      'projection', 'whole_body_rotational_to_inspected_wall',
      'release', 'complete_two_hand_release',
      'ballRule', 'declare_mass_material_diameter_and_rebound_behavior_and_preserve_ballistic_speed',
      'selectable', TRUE,
      'identityQuarantine', FALSE
    ),
    jsonb_build_object(
      'gripDemand', seed.grip_demand,
      'spinalLoading', seed.spinal_loading,
      'eccentricStress', seed.eccentric_stress,
      'landingContactsPerRep', 1,
      'externalLoadMethod', 'relative_external',
      'loadingType', CASE seed.return_contract
        WHEN 'rebound_and_controlled_catch'
          THEN 'lateral_approach_rotational_projection_plus_return_absorption'
        ELSE 'lateral_approach_rotational_projection_throw_only'
      END,
      'impactClass', 'low_to_moderate_ground_impact_with_ball_flight_consequence',
      'primaryStress', jsonb_build_array(
        'lateral_acceleration_and_plant_braking',
        'hip_pelvis_and_trunk_rotation',
        'shoulder_projection_and_elbow_extension',
        'pivot_and_whole_body_deceleration',
        CASE seed.return_contract
          WHEN 'rebound_and_controlled_catch' THEN 'visual_tracking_and_return_absorption'
          ELSE 'ball_retrieval_after_lane_close'
        END
      )
    ),
    jsonb_build_object(
      'localMuscleFatigue', seed.local_muscle_fatigue,
      'gripFatigue', CASE seed.return_contract
        WHEN 'rebound_and_controlled_catch' THEN 40 ELSE 26 END,
      'technicalFatigueSensitivity', seed.technical_fatigue_sensitivity,
      'impactAccumulation', seed.impact_accumulation,
      'recoveryHours', seed.recovery_hours,
      'cumulativeBudgets', jsonb_build_array(
        'lateral_acceleration_and_change_of_direction_contacts',
        'plant_and_pivot_exposures',
        'rotational_ballistic_repetitions_per_side',
        'throwing_and_pressing_load',
        'anterior_shoulder_and_elbow_stress',
        'trunk_rotation_and_deceleration',
        CASE seed.return_contract
          WHEN 'rebound_and_controlled_catch' THEN 'catch_absorption_exposures'
          ELSE 'ball_flight_and_retrieval_exposures'
        END
      ),
      'fatigueSignals', jsonb_build_array(
        'approach_rhythm_or_spacing_loss', 'plant_collapse_or_overstride',
        'release_velocity_decline', 'target_accuracy_loss',
        'arm_dominant_throw', 'uncontrolled_spine_motion',
        'late_or_unsafe_return_response'
      )
    ),
    jsonb_build_object(
      'primaryPhase', 'output',
      'secondaryPhase', 'movement_intelligence',
      'placement', 'early_after_preparation_before_material_lateral_rotational_or_upper_body_fatigue',
      'freshnessSensitive', TRUE,
      'prescriptionUnit', 'quality_attempts_per_side',
      'sideBalanceRequired', TRUE,
      'reactiveCueMustBeExplicit', TRUE,
      'returnContractMustBeExplicit', TRUE,
      'difficultyModel', 'max_exercise_complexity_physical_difficulty',
      'proficiencyClassification', NULL
    ),
    'review'
  FROM shuffle_rotational_variant_seed seed
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
        THEN 'Develop high-intent lateral-momentum transfer into a fast, accurate rotational wall throw while preserving approach, plant, sequence, finish, and the declared return contract.'
      ELSE
        'Learn repeatable approach rhythm, plant geometry, rotational sequence, target release, balanced finish, and the declared return contract at submaximal speed.'
    END,
    CASE phase.phase_key WHEN 'output' THEN 94 ELSE 78 END,
    CASE phase.phase_key WHEN 'output' THEN 92 ELSE 82 END,
    jsonb_build_object(
      'rotationalPower', CASE phase.phase_key WHEN 'output' THEN 96 ELSE 70 END,
      'movementLearning', CASE phase.phase_key WHEN 'output' THEN 70 ELSE 94 END,
      'lateralMomentumTransfer', CASE phase.phase_key WHEN 'output' THEN 96 ELSE 82 END,
      'fatigueConditioning', 8
    ),
    jsonb_build_object(
      'sets', CASE phase.phase_key WHEN 'output' THEN '2-4' ELSE '2-3' END,
      'repetitionsPerSide', CASE phase.phase_key WHEN 'output' THEN '2-4' ELSE '2-5' END,
      'restSeconds', CASE phase.phase_key WHEN 'output' THEN '120-240' ELSE '90-180' END,
      'effort', CASE phase.phase_key
        WHEN 'output' THEN 'high_intent_only_while_every_quality_gate_holds'
        ELSE 'submaximal_rehearsal_with_crisp_sequence_and_full_reset'
      END,
      'shuffleCount', 'declared_and_repeatable',
      'sideRule', 'balance_quality_attempts_unless_documented_otherwise',
      'returnContract', seed.return_contract
    ),
    'Approach stays in lane, plant is controlled, rotation sequences from ground to hands, release reaches target, finish is balanced, and the exact return contract is completed without symptoms.',
    ARRAY[
      'Stop for pain, numbness, tingling, dizziness, instability, or apprehension.',
      'Stop for unsafe ball, wall, surface, start mark, plant zone, lane, traffic, or return path.',
      'Stop when approach rhythm, plant, pivot, spine control, sequence, target, release speed, finish balance, or catch quality materially declines.',
      'Stop on an unpredictable return, missed catch, or lane intrusion.'
    ]::TEXT[],
    'Declare approach, side, shuffle count, cue, ball, wall, target, plant zone, and return contract. Observe the whole sequence from outside the lane and close the lane before ball collection.',
    'Load, shuffle, plant, turn from the ground up, throw through the target, and own the finish. Catch only when your exact version requires it.',
    CASE phase.phase_key
      WHEN 'output'
        THEN 'Higher-quality lateral-to-rotational ballistic force transfer without fatigue-driven technique loss.'
      ELSE
        'More repeatable approach, plant, sequencing, targeting, finish, and return management.'
    END,
    ARRAY['medicine_ball', 'wall']::TEXT[],
    jsonb_build_object(
      'space', 'exclusive_marked_lateral_approach_pivot_flight_and_return_lane',
      'participants', 'one_active_thrower_per_lane',
      'setupSeconds', 75,
      'transitionSeconds', 20,
      'collectionRule', 'collect_only_after_lane_close',
      'coachPosition', 'outside_approach_flight_and_return_paths'
    ),
    ARRAY(
      SELECT static_variant.id
      FROM coaching.exercise_definition_v1 static_definition
      JOIN coaching.exercise_variant_v1 static_variant
        ON static_variant.definition_id = static_definition.id
      WHERE static_definition.slug = 'medicine-ball-rotational-throw'
        AND static_definition.status <> 'archived'
        AND static_variant.status <> 'archived'
        AND static_variant.variant_key = CASE seed.return_contract
          WHEN 'rebound_and_controlled_catch'
            THEN 'athletic-stance-wall-rebound-catch'
          ELSE 'athletic-stance-wall-throw-only'
        END
    ),
    jsonb_build_object(
      'attemptSeconds', CASE phase.phase_key WHEN 'output' THEN 8 ELSE 10 END,
      'resetSeconds', CASE phase.phase_key WHEN 'output' THEN 22 ELSE 20 END,
      'sideChangeSeconds', 25,
      'setDurationFormula', 'attempts_per_side_x_two_x_attempt_plus_reset',
      'durationIncludesSetup', TRUE
    ),
    jsonb_build_object(
      'regressFirst', jsonb_build_array(
        'remove_reactive_cue', 'reduce_shuffle_count_or_distance',
        'use_static_rotational_throw', 'reduce_ball_mass',
        'increase_target_size', 'use_throw_only', 'reduce_repetitions',
        'increase_rest'
      ),
      'progressOneVariableAtATime', jsonb_build_array(
        'intent', 'approach_speed_or_distance', 'ball_mass',
        'target_precision', 'reactive_cue', 'rebound_catch'
      ),
      'symptomRule', 'stop_and_select_reviewed_pain_free_alternative'
    ),
    jsonb_build_object(
      'required', jsonb_build_array(
        'variant', 'approach_and_throw_side', 'shuffle_count',
        'ball_mass_and_type', 'wall_distance_and_target',
        'return_contract', 'quality_attempts', 'rest', 'stop_reason'
      ),
      'optional', jsonb_build_array(
        'release_velocity', 'throw_distance', 'target_hit_rate',
        'approach_time', 'plant_error', 'sequence_error', 'catch_error'
      ),
      'comparisonRule',
        'Compare output only when ball, approach, side, target, distance, return contract, and measurement method match.'
    ),
    jsonb_build_object(
      'athleteBeforeSet', jsonb_build_array(
        'Confirm side, shuffle count, ball, target, and catch rule.',
        'Report pain, instability, dizziness, or uncertainty before starting.'
      ),
      'coachDuringSet', jsonb_build_array(
        'Watch lane, approach, plant, sequence, target, finish, and return.',
        'Stop immediately on any safety or quality trigger.'
      ),
      'afterSet', jsonb_build_array(
        'Record quality reps, target hits, errors, symptoms, and substitutions.',
        'Do not progress if any stop trigger occurred.'
      ),
      'mediaFallback',
        'Use the written setup, sequence, and coach demonstration until an exact video is independently approved.'
    ),
    'review'
  FROM shuffle_rotational_variant_seed seed
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
        'lateral-shuffle-wall-throw-only',
        'lateral-shuffle-wall-rebound-catch',
        'progression',
        92,
        ARRAY['complexity', 'decision_demand', 'load']::TEXT[],
        'A predictable rebound and catch preserve the approach and projection while adding tracking, timing, grip, and absorption demand.',
        '{"requiresTestedPredictableReturn":true,"requiresSafeCatch":true,"humanReviewRequired":true}'::JSONB
      ),
      (
        'lateral-shuffle-wall-rebound-catch',
        'lateral-shuffle-wall-throw-only',
        'regression',
        92,
        ARRAY['complexity', 'decision_demand', 'load']::TEXT[],
        'Removing the required catch preserves the approach and projection while reducing return and absorption demand.',
        '{"returnContract":"throw_only_no_required_catch","humanReviewRequired":true}'::JSONB
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
    shuffle_variant.id,
    static_variant.id,
    'regression',
    88,
    ARRAY['complexity', 'speed', 'stability']::TEXT[],
    'Removing the lateral approach preserves the rotational wall projection while reducing approach timing, plant, spacing, and deceleration demand.',
    '{"approach":"none_static_athletic_stance","humanReviewRequired":true}'::JSONB,
    'review'
  FROM shuffle_rotational_variant_seed seed
  JOIN coaching.exercise_variant_v1 shuffle_variant
    ON shuffle_variant.definition_id = target_definition_id
   AND shuffle_variant.variant_key = seed.variant_key
   AND shuffle_variant.status <> 'archived'
  JOIN coaching.exercise_definition_v1 static_definition
    ON static_definition.slug = 'medicine-ball-rotational-throw'
   AND static_definition.status <> 'archived'
  JOIN coaching.exercise_variant_v1 static_variant
    ON static_variant.definition_id = static_definition.id
   AND static_variant.status <> 'archived'
   AND static_variant.variant_key = CASE seed.return_contract
     WHEN 'rebound_and_controlled_catch'
       THEN 'athletic-stance-wall-rebound-catch'
     ELSE 'athletic-stance-wall-throw-only'
   END
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
  FROM shuffle_rotational_variant_seed seed
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id = target_definition_id
   AND variant.variant_key = seed.variant_key
   AND variant.status <> 'archived'
  CROSS JOIN LATERAL (
    VALUES
      (
        'technicalComplexity',
        seed.exercise_complexity,
        CASE seed.return_contract
          WHEN 'rebound_and_controlled_catch'
            THEN 'Lateral approach, controlled plant, rotational sequence, target release, finish, return tracking, and catch create high exercise complexity.'
          ELSE 'Lateral approach, controlled plant, rotational sequence, target release, and balanced finish create moderately high exercise complexity.'
        END
      ),
      (
        'absoluteLoadDemand',
        seed.physical_difficulty,
        CASE seed.return_contract
          WHEN 'rebound_and_controlled_catch'
            THEN 'Ballistic approach and projection plus return absorption create moderate physical difficulty with a speed-appropriate ball.'
          ELSE 'Ballistic approach, plant, rotation, and projection create moderate physical difficulty with a speed-appropriate ball.'
        END
      ),
      (
        'baseOverallDifficulty',
        greatest(seed.exercise_complexity, seed.physical_difficulty),
        'Overall exercise difficulty is the maximum of exercise complexity and physical difficulty; it is not an athlete proficiency label.'
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

  CREATE TEMP TABLE shuffle_rotational_source_seed (
    source_key TEXT PRIMARY KEY,
    source_url TEXT NOT NULL,
    source_title TEXT NOT NULL,
    source_publisher TEXT NOT NULL,
    source_kind TEXT NOT NULL,
    evidence_quality INTEGER NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO shuffle_rotational_source_seed VALUES
    (
      'exact_instruction',
      'https://www.muscleandstrength.com/exercises/shuffle-into-rotational-medicine-ball-throw',
      'Shuffle Into Rotational Medicine Ball Throw Video Exercise Guide',
      'Muscle & Strength',
      'expert_instruction',
      66
    ),
    (
      'side_throw_emg',
      'https://pubmed.ncbi.nlm.nih.gov/17047981/',
      'Relationship between side medicine-ball throw performance and physical ability for male and female athletes',
      'European Journal of Applied Physiology',
      'peer_reviewed_research',
      78
    ),
    (
      'validity',
      'https://pubmed.ncbi.nlm.nih.gov/39589937/',
      'Criterion Validity and Reliability of a New Medicine Ball Rotational Power Test',
      'Journal of Strength and Conditioning Research',
      'peer_reviewed_research',
      88
    ),
    (
      'trunk_strength',
      'https://pubmed.ncbi.nlm.nih.gov/37721721/',
      'Influence of trunk rotator strength on rotational medicine ball throwing performance',
      'Journal of Sports Medicine and Physical Fitness',
      'peer_reviewed_research',
      81
    ),
    (
      'ace_wall_ball',
      'https://www.acefitness.org/resources/pros/expert-articles/5289/8-creative-ways-to-use-a-medicine-ball/',
      '8 Creative Ways to Use a Medicine Ball',
      'American Council on Exercise',
      'expert_instruction',
      76
    ),
    (
      'nsca_alactic',
      'https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf',
      'NSCA Coach 5.4',
      'National Strength and Conditioning Association',
      'professional_standard',
      80
    ),
    (
      'youtube_embed',
      'https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en',
      'Embed videos and playlists',
      'YouTube Help',
      'manufacturer_instruction',
      82
    );

  CREATE TEMP TABLE shuffle_rotational_evidence_seed (
    section_key TEXT PRIMARY KEY,
    source_key TEXT NOT NULL,
    claims_json JSONB NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO shuffle_rotational_evidence_seed VALUES
    (
      'identity', 'exact_instruction',
      '["The exact source defines an athletic base, trail-hip load, lateral shuffle, rotational wall projection, and reset or catch.","Both legacy names preserve the same primary sequence and are one identity."]'::JSONB
    ),
    (
      'taxonomy', 'exact_instruction',
      '["The defining sequence combines lateral locomotion, whole-body rotation, two-hand projection, and controlled deceleration.","Approach, side, cueing, target, and return contract must be explicit."]'::JSONB
    ),
    (
      'anatomy', 'side_throw_emg',
      '["Side medicine-ball throwing recruits trunk musculature during rapid rotation and force transfer.","The lateral approach adds foot, ankle, knee, hip, and frontal-plane stabilization demand."]'::JSONB
    ),
    (
      'biomechanics', 'exact_instruction',
      '["The source describes loading the trail hip, shuffling once, driving from the back leg, transferring weight, rotating around the front leg, and throwing to a wall.","Plant, ground-to-hand sequence, release, target, finish, and return are observable gates."]'::JSONB
    ),
    (
      'difficulty', 'validity',
      '["Rotational medicine-ball comparisons require standardized load, direction, technique, and measurement.","Overall difficulty is max(exercise complexity, physical difficulty); exercise cards have no proficiency label."]'::JSONB
    ),
    (
      'load_fatigue_recovery', 'trunk_strength',
      '["Rotational medicine-ball output relates to trunk-rotation strength in the cited sample.","Track lateral plant, rotational throw, shoulder-elbow, trunk, pivot, and catch exposures together."]'::JSONB
    ),
    (
      'constraints', 'ace_wall_ball',
      '["Ball construction and wall interaction determine rebound behavior and catch feasibility.","Declare ball, inspected wall, approach and plant zones, target, floor traction, traffic, and return path."]'::JSONB
    ),
    (
      'dosage', 'nsca_alactic',
      '["NSCA places explosive medicine-ball work with maximal-effort alactic methods and multi-minute recovery.","Use short side-balanced sets and full recovery when power is intended."]'::JSONB
    ),
    (
      'instructions', 'exact_instruction',
      '["Use athletic base, trail-hip load, lateral shuffle, controlled plant, ground-up rotation, wall projection, and declared reset or catch.","Cue: load, shuffle, plant, turn, throw, own the finish."]'::JSONB
    ),
    (
      'safety_stop_rules', 'ace_wall_ball',
      '["A catch requires predictable rebound and whole-body absorption.","Stop for symptoms, unsafe footing or lane, plant or spine loss, target or output decline, unpredictable return, or missed catch."]'::JSONB
    ),
    (
      'programming', 'nsca_alactic',
      '["Explosive medicine-ball work is freshness-sensitive when maximal intent is required.","Use early in output or as controlled technique; never silently add reactive cueing."]'::JSONB
    ),
    (
      'athlete_support', 'exact_instruction',
      '["Show start, approach, side, plant, ball, target, return, primary cue, and stop signal.","Offer static, shorter, lighter, throw-only, larger-target, and longer-reset options without exercise skill levels."]'::JSONB
    ),
    (
      'coach_support', 'validity',
      '["Measurement requires standardized ball and protocol.","Expose approach, side, ball, wall, target, return, dose, rest, quality errors, output metric, fatigue, and shutdown control."]'::JSONB
    ),
    (
      'accessibility', 'ace_wall_ball',
      '["Rebound and catch demand depend on equipment and participant control.","Options include lighter or softer ball, visible marks, shorter approach, throw-only, fewer reps, longer reset, and nonvideo instruction."]'::JSONB
    ),
    (
      'alternates', 'exact_instruction',
      '["The two legacy names are aliases for one identity.","Return contract is an exact variant; approach length, ball, target, and planned cue are modifiers; bound, scoop, slam, and shot-put tasks require separate review."]'::JSONB
    ),
    (
      'media', 'youtube_embed',
      '["YouTube supports privacy-enhanced embedding.","oEmbed health is only a link and metadata check; exact movement, safety, captions, accessibility, reviewer identity, and approval remain unresolved."]'::JSONB
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
  FROM shuffle_rotational_evidence_seed evidence
  JOIN shuffle_rotational_source_seed source
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
    'Current title and oEmbed response are healthy. Full viewing, exact approach and return-contract match, instruction quality, safety, captions, accessibility, reviewer identity, and approval remain pending.'
  FROM (
    VALUES
      (
        'bVKzF94Rwv4',
        'https://www.youtube.com/watch?v=bVKzF94Rwv4',
        'Rotational Medicine Ball Throw (Shuffle Into)',
        'Muscle & Strength',
        'Exact exercise page embed rechecked through current YouTube oEmbed'
      ),
      (
        'c_wmZ08-UG8',
        'https://www.youtube.com/watch?v=c_wmZ08-UG8',
        'Shuffle to Rotational Med Ball Throw',
        'NeuStrength | Personal Trainer Wilmington NC',
        'YouTube exact-name discovery rechecked through current oEmbed'
      ),
      (
        'TvYcmAexRYE',
        'https://www.youtube.com/watch?v=TvYcmAexRYE',
        'Medicine Ball Shuffle to Rotational Throw',
        'NK Fitness',
        'YouTube exact-name discovery rechecked through current oEmbed'
      ),
      (
        'd3_P6xMR9r8',
        'https://www.youtube.com/watch?v=d3_P6xMR9r8',
        'Med Ball Rotational Throw with Shuffle - Viking Strength Systems',
        'Viking Strength Systems',
        'YouTube exact-name discovery rechecked through current oEmbed'
      ),
      (
        'lHO1XpNCtQA',
        'https://www.youtube.com/watch?v=lHO1XpNCtQA',
        'Med Ball Shuffle Rotational Throw',
        'Christian Ballard',
        'YouTube exact-name discovery rechecked through current oEmbed'
      )
  ) AS media(video_id, url, title, channel_name, source_query)
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
        'Med Ball Shuffle-to-Rotation Throw', 'same_identity',
        'The legacy name preserves the same lateral-shuffle approach and rotational projection.',
        '{"identityDisposition":"duplicate_source_identity"}'::JSONB
      ),
      (
        'Shuffle Into Rotational Medicine Ball Throw', 'same_identity',
        'This is the common naming order for the same movement sequence.',
        '{"approach":"lateral_shuffle_or_crow_hop"}'::JSONB
      ),
      (
        'Shuffle Rotational Wall Throw — Throw and Retrieve', 'new_variant',
        'The defining approach and projection end after release without a required catch.',
        '{"returnContract":"throw_only_no_required_catch"}'::JSONB
      ),
      (
        'Shuffle Rotational Wall Throw — Rebound and Catch', 'new_variant',
        'The same approach and projection add a predictable return and controlled catch.',
        '{"returnContract":"rebound_and_controlled_catch"}'::JSONB
      ),
      (
        'Reactive Shuffle-to-Rotational Throw', 'modifier_annotation',
        'A cue changes decision demand and side selection but preserves the primary sequence.',
        '{"cueing":"reactive","mustBeExplicit":true}'::JSONB
      ),
      (
        'Static Rotational Medicine Ball Wall Throw', 'new_variant',
        'Removing the approach preserves projection but lowers locomotion, plant, timing, and spacing demand.',
        '{"approach":"none_static_athletic_stance"}'::JSONB
      ),
      (
        'Step-Behind Rotational Medicine Ball Throw', 'new_variant',
        'Step-behind footwork changes approach sequencing and plant geometry.',
        '{"approach":"step_behind"}'::JSONB
      ),
      (
        'Lateral Bound to Rotational Throw', 'new_definition',
        'A bound adds aerial projection, landing impact, and single-leg absorption.',
        '{"approach":"lateral_bound","landing":"required"}'::JSONB
      ),
      (
        'Shuffle-to-Rotational Scoop Toss', 'new_definition',
        'A scoop changes implement position, release angle, and shoulder action.',
        '{"projection":"low_to_high_scoop"}'::JSONB
      ),
      (
        'Shuffle-to-Shot-Put Throw', 'new_definition',
        'A unilateral shot-put release changes arm use, ball position, and shoulder demand.',
        '{"armUse":"unilateral","releasePattern":"shot_put"}'::JSONB
      ),
      (
        'Shuffle-to-Rotational Slam', 'new_definition',
        'A floor-directed slam changes target, direction, impact, and retrieval.',
        '{"target":"floor","projection":"downward_slam"}'::JSONB
      ),
      (
        'Partner-Reactive Shuffle Rotational Pass', 'new_variant',
        'A partner and reactive return alter cueing, target behavior, communication, and catch logistics.',
        '{"target":"trained_partner","cueing":"reactive"}'::JSONB
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
  SET technical = 5.6,
      load = 5.2,
      overall = 5.6,
      notes =
        'Legacy return contract remains unspecified; candidate values represent the throw-only exact baseline and require independent calibration.',
      updated_at = now()
  WHERE profile.exercise_id IN (
    SELECT legacy_exercise_id
    FROM coaching.exercise_definition_source_v1
    WHERE definition_id = target_definition_id
  );

  UPDATE coaching.exercise_score_v1 score
  SET technical_complexity = 56,
      absolute_load_demand = 52,
      coordination_demand = 68,
      impact = 24,
      supervision_demand = 66,
      base_overall_difficulty = greatest(56, 52),
      legacy_scores = score.legacy_scores || jsonb_build_object(
        'candidateReassessment', migration_key,
        'difficultyModel', 'max_exercise_complexity_physical_difficulty',
        'sourceIdentity', 'lateral_shuffle_rotational_throw_return_contract_unspecified',
        'identityQuarantined', TRUE,
        'independentCalibrationRequired', TRUE
      ),
      migration_confidence = 62,
      human_review_status = 'queued',
      reviewed_by = NULL,
      reviewed_at = NULL,
      review_notes =
        'Research-backed candidate reassessment only; exact return-contract assignment and independent calibration remain required.',
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
      movement_family = 'Lateral shuffle to rotational medicine-ball wall projection',
      primary_phase_key = 'output',
      phase_subrole = 'jump_throw_explosive_power',
      primary_order_slot = 'shuffle_rotational_throw_power',
      card_summary =
        'Lateral shuffle or crow-hop into a controlled plant and two-hand rotational medicine-ball wall projection. The legacy return contract is unspecified and nonselectable.',
      description =
        'Use a declared lateral shuffle to create momentum into a controlled plant, whole-body rotational medicine-ball wall throw, and balanced finish. Select an exact canonical return-contract variant.',
      instructions =
        'Declare approach, side, shuffle count, cue, ball, wall, target, plant zone, and return contract. Load, shuffle, plant, rotate from the ground up, release to target, and retrieve or catch only as specified.',
      coach_language =
        'Observe approach spacing, plant, pivot, ground-to-hand sequence, spine position, release, target, finish, and any prescribed catch. Stop on symptoms, unsafe logistics, quality loss, or output decline.',
      athlete_language =
        'Load, shuffle, plant, turn from the ground up, throw through the target, and own the finish. Catch only if your version says to catch.',
      scalable_variables = ARRAY[
        'ball_mass', 'ball_material_and_rebound', 'shuffle_count',
        'approach_distance_and_speed', 'plant_zone', 'wall_distance',
        'target_height_and_size', 'throw_side', 'planned_or_reactive_cue',
        'repetitions_per_side', 'rest', 'return_contract'
      ]::TEXT[],
      movement_requirements = jsonb_build_object(
        'approach', 'lateral_shuffle_or_crow_hop',
        'plant', 'controlled_and_declared',
        'projection', 'whole_body_two_hand_rotational_to_wall',
        'return_contract', 'unspecified_legacy_provenance',
        'selectable_exact_variant', FALSE
      ),
      coaching_execution = jsonb_build_object(
        'setup', jsonb_build_array(
          'Declare exact variant, approach, side, shuffle count, cue, ball, wall, target, lane, and collection procedure.',
          'Inspect the ball, wall, surface, marks, plant space, flight lane, return path, lighting, and traffic boundary.',
          'Confirm pain-free light-ball sequence and test any rebound at low intent.'
        ),
        'quality_gate', jsonb_build_array(
          'Approach stays inside the lane.',
          'Plant and pivot remain controlled.',
          'Hips and trunk lead before the arms.',
          'Release reaches target and the exact return contract is safe.'
        ),
        'stop_signs', jsonb_build_array(
          'Pain, neurologic symptoms, instability, or apprehension',
          'Unsafe equipment, surface, lane, plant zone, or return path',
          'Approach, plant, sequence, spine, target, output, finish, or catch failure'
        )
      ),
      programming_logic = jsonb_build_object(
        'difficulty_model', 'max_exercise_complexity_physical_difficulty',
        'identity_rule', 'select_exact_return_contract',
        'cue_rule', 'reactive_cueing_must_be_explicit',
        'fatigue_rule', 'place_before_material_lateral_rotational_or_upper_body_fatigue',
        'substitution_rule', 'never_silently_change_approach_side_projection_target_or_return_contract',
        'legacy_source_rule', 'unspecified_return_sources_are_nonselectable'
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
      'identityMigration', '322_coaching_shuffle_rotational_throw_identity_consolidation',
      'completenessMigration', migration_key,
      'researchBatch', 'shuffle-rotational-medicine-ball-throw-family-v1',
      'difficultyFormula', 'max_exercise_complexity_physical_difficulty',
      'exerciseDifficultyDimensions', jsonb_build_array(
        'exercise_complexity', 'physical_difficulty'
      ),
      'proficiencyClassificationScope', 'coaching_skill_library_only',
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
        'message', 'Exact-match full-video, safety, caption, accessibility, and approval review remains required.'
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
