-- Complete the candidate-only standing medicine-ball rotational wall-throw
-- family after migration 319 consolidates its duplicate definition.
--
-- The stable broad identity receives two exact selectable variants:
--   * athletic stance, wall throw only / retrieve
--   * athletic stance, predictable wall rebound / controlled catch
--
-- Both legacy sources leave the return contract unspecified. Their source
-- variants remain archived, nonselectable provenance. Exercise difficulty is
-- exercise complexity plus physical difficulty, with overall difficulty equal
-- to the maximum of those two values. Exercise cards receive no proficiency
-- level. All evidence, media, graph, calibration, and publication decisions
-- remain candidate/review-only. IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT := '320_coaching_rotational_wall_throw_family_completion';
  target_definition_id UUID;
  facility BIGINT;
  target_card_version INTEGER;
  protected_records INTEGER;
  unexpected_variants INTEGER;
BEGIN
  SELECT id, facility_id
  INTO target_definition_id, facility
  FROM coaching.exercise_definition_v1
  WHERE slug = 'medicine-ball-rotational-throw'
    AND status <> 'archived';

  IF target_definition_id IS NULL THEN
    RAISE EXCEPTION
      'Rotational wall-throw family completion requires the active survivor definition';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_definition_v1
    WHERE slug = 'medicine-ball-rotational-wall-throw'
      AND status <> 'archived'
  ) THEN
    RAISE EXCEPTION
      'Rotational wall-throw family completion requires migration 319 duplicate consolidation first';
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
      'Rotational wall-throw family completion refused to override % protected records',
      protected_records;
  END IF;

  SELECT COUNT(*)
  INTO unexpected_variants
  FROM coaching.exercise_variant_v1
  WHERE definition_id = target_definition_id
    AND status <> 'archived'
    AND variant_key NOT IN (
      'baseline',
      'athletic-stance-wall-throw-only',
      'athletic-stance-wall-rebound-catch'
    );

  IF unexpected_variants > 0 THEN
    RAISE EXCEPTION
      'Rotational wall-throw family completion found % unexpected active variants',
      unexpected_variants;
  END IF;

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET status = 'archived',
      updated_at = now()
  FROM coaching.exercise_variant_v1 variant
  WHERE variant.id = profile.variant_id
    AND variant.definition_id = target_definition_id
    AND variant.status = 'archived';

  UPDATE coaching.exercise_variant_v1
  SET variant_key = 'legacy-unspecified-return-source-733',
      status = 'archived',
      requirements_json = requirements_json || jsonb_build_object(
        'sourceStance', 'standing_athletic',
        'sourceTarget', 'wall_or_partner',
        'sourceReturnContract', 'unspecified',
        'selectable', FALSE,
        'identityQuarantine', TRUE,
        'quarantineReason',
          'The legacy source does not declare whether the ball is retrieved or must return for a controlled catch.'
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
      canonical_name = 'Medicine Ball Rotational Throw',
      display_name = 'Medicine Ball Rotational Throw',
      description =
        'Project a declared medicine ball with two hands from a standing athletic base into an inspected wall using sequenced whole-body rotation. The exact variant states whether the athlete throws and retrieves or tracks, catches, and absorbs a predictable rebound.',
      family_key = 'standing_medicine_ball_rotational_wall_projection',
      movement_patterns = ARRAY['rotate', 'push', 'brace']::TEXT[],
      body_regions = ARRAY[
        'foot',
        'ankle',
        'knee',
        'hip',
        'pelvis',
        'core',
        'spine',
        'rib_cage',
        'scapula',
        'shoulder',
        'elbow',
        'wrist',
        'hand',
        'eye_hand'
      ]::TEXT[],
      required_equipment = ARRAY['medicine_ball', 'inspected_wall']::TEXT[],
      optional_equipment = ARRAY[
        'target_marker',
        'line_tape',
        'radar_or_ball_tracker',
        'video_feedback',
        'timer'
      ]::TEXT[],
      environment_json = jsonb_build_object(
        'surface', 'level_non_slip_surface_with_clear_pivot_space',
        'ballSpecification', 'declared_mass_material_diameter_and_rebound_behavior',
        'target', 'structurally_suitable_inspected_wall',
        'distance', 'declared_and_repeatable',
        'targetHeight', 'declared_relative_to_thrower_and_ball_path',
        'flightLane', 'clear_from_release_to_wall',
        'returnPath', 'clear_and_predictable_when_rebound_catch_is_prescribed',
        'wallRule', 'surface_is_structurally_suitable_and_return_behavior_is_tested_before_output',
        'traffic', 'one_active_thrower_per_lane_no_cross_traffic_or_ball_collection_during_throw',
        'lighting', 'ball_target_feet_and_return_path_clearly_visible',
        'coachSightline', 'base_pivot_hip_and_trunk_sequence_release_target_and_return_visible'
      ),
      population_json = jsonb_build_object(
        'readiness', jsonb_build_array(
          'pain_free_standing_rotation_and_pivot',
          'pain_free_two_hand_rotational_throw_with_light_ball',
          'stable_athletic_base_and_deceleration',
          'can_hit_declared_wall_target_without_uncontrolled_spine_motion',
          'can_track_and_absorb_return_when_catch_is_prescribed',
          'can_follow_stop_lane_clear_and_ball_collection_instructions'
        ),
        'contraindicationFlags', jsonb_build_array(
          'current_foot_ankle_knee_hip_back_shoulder_elbow_wrist_or_hand_pain',
          'numbness_dizziness_instability_or_neurologic_symptoms',
          'uncontrolled_lumbar_extension_rotation_or_balance_loss',
          'unsafe_ball_wall_lane_surface_pivot_space_or_return_path',
          'unassessed_recent_injury_surgery_or_rehabilitation_restriction'
        ),
        'supervision', 'direct_observation_until_base_sequence_target_and_return_contract_are_repeatable',
        'selectionBoundary',
          'Select return contract, throw side, ball, target, distance, and dose from current readiness and intended stimulus; exercise cards do not carry proficiency levels.',
        'clinicalBoundary',
          'Symptoms, instability, recent surgery, neurologic signs, or rehabilitation restrictions require individualized clinician guidance; this card is not rehabilitation instruction.'
      ),
      anatomy_json = jsonb_build_object(
        'primaryMuscles', jsonb_build_array(
          'internal_and_external_obliques',
          'gluteus_maximus',
          'hip_rotators',
          'pectoralis_major'
        ),
        'secondaryMuscles', jsonb_build_array(
          'transversus_abdominis',
          'erector_spinae_and_multifidus',
          'gluteus_medius',
          'quadriceps',
          'hamstrings',
          'gastrocnemius_and_soleus',
          'anterior_deltoid',
          'triceps_brachii',
          'serratus_anterior',
          'rotator_cuff'
        ),
        'stabilizers', jsonb_build_array(
          'foot_and_ankle_stabilizers',
          'gluteus_medius',
          'abdominal_wall',
          'spinal_stabilizers',
          'scapular_stabilizers',
          'rotator_cuff'
        ),
        'joints', jsonb_build_array(
          'foot_and_ankle',
          'knee',
          'hip',
          'pelvis',
          'spine',
          'scapulothoracic_articulation',
          'shoulder',
          'elbow',
          'wrist_and_hand'
        ),
        'jointActions', jsonb_build_array(
          'ankle_knee_and_hip_flexion_extension',
          'hip_internal_and_external_rotation',
          'pelvic_and_thoracic_rotation',
          'shoulder_horizontal_adduction_and_flexion',
          'elbow_extension',
          'scapular_protraction',
          'wrist_and_hand_release',
          'whole_body_deceleration_after_release',
          'shoulder_elbow_and_trunk_absorption_during_declared_catch'
        ),
        'planes', jsonb_build_array(
          'transverse',
          'sagittal',
          'frontal_stabilization'
        ),
        'laterality', 'bilateral_implement_with_declared_left_or_right_throw_side',
        'primaryActions', jsonb_build_array(
          'establish_athletic_base_perpendicular_or_oblique_to_wall',
          'load_declared_outside_hip_and_trunk',
          'reverse_and_sequence_rotation_from_ground_to_hands',
          'project_ball_to_declared_wall_target',
          'decelerate_body_and_reset_or_absorb_declared_return'
        )
      ),
      athlete_support_json = jsonb_build_object(
        'whyItMatters',
          'This task develops fast force transfer from the ground through the hips and trunk into a controlled two-hand rotational throw.',
        'plainLanguagePurpose',
          'Turn from the ground up and throw the ball fast into the target without losing your base.',
        'beforeYouStart', jsonb_build_array(
          'Confirm your throw side, ball, target, distance, and whether the ball will return.',
          'Make sure the pivot space, flight lane, and return path are empty.',
          'Use a ball you can throw quickly and control.'
        ),
        'primaryCue', 'Load the outside hip, turn from the ground up, throw through the target.',
        'expectedSensations', jsonb_build_array(
          'brief_fast_effort_through_legs_hips_trunk_chest_and_arms',
          'controlled_pivot_and_deceleration',
          'controlled_ball_contact_in_hands_when_catching'
        ),
        'unexpectedSensations', jsonb_build_array(
          'sharp_burning_or_increasing_joint_or_back_pain',
          'numbness_tingling_dizziness_or_giving_way',
          'pinching_in_hip_back_shoulder_elbow_wrist_or_knee',
          'fear_or_inability_to_track_a_returning_ball'
        ),
        'painGuidance',
          'Stop immediately for pain, numbness, tingling, dizziness, instability, or a return you cannot control; do not throw through symptoms.',
        'selfChecks', jsonb_build_array(
          'My feet stay connected and the pivot is controlled.',
          'My hips and trunk lead before my arms finish the throw.',
          'The ball reaches the declared target without uncontrolled back extension.',
          'If catching, I see the return early and absorb it away from my face.'
        )
      ),
      coach_support_json = jsonb_build_object(
        'stationSetup', jsonb_build_array(
          'Declare exact variant, throw side, ball mass and rebound type, wall, distance, target height, lane, and collection procedure.',
          'Inspect the ball, wall, surface, pivot space, lighting, flight lane, and return path.',
          'Test rebound behavior at low intensity before permitting a catch or high-intent throw.'
        ),
        'observationPriorities', jsonb_build_array(
          'base_and_pivot',
          'hip_pelvis_trunk_arm_sequence',
          'spine_and_rib_control',
          'release_path_and_target_accuracy',
          'deceleration_and_balance',
          'return_tracking_and_absorption_when_prescribed'
        ),
        'primaryCues', jsonb_build_array(
          'Athletic base.',
          'Load the outside hip.',
          'Ground, hips, trunk, hands.',
          'Throw through the target.',
          'Own the finish.'
        ),
        'commonFaults', jsonb_build_array(
          'ball_too_heavy_and_slow',
          'arms_start_before_hips_and_trunk',
          'uncontrolled_lumbar_extension_or_spin',
          'foot_sticks_or_pivot_collapses',
          'target_and_distance_are_undefined',
          'catch_is_required_without_predictable_return',
          'repetitions_continue_after_output_or_accuracy_declines'
        ),
        'qualityGate',
          'Count a repetition only when the declared base, side, sequence, release, target, deceleration, and exact return contract are satisfied without symptoms.',
        'immediateStop', jsonb_build_array(
          'pain_numbness_dizziness_instability_or_apprehension',
          'unsafe_wall_ball_surface_lane_pivot_space_or_return',
          'uncontrolled_spine_motion_pivot_or_balance_loss',
          'target_loss_wild_release_material_velocity_decline_or_missed_catch'
        ),
        'recordAfterSet', jsonb_build_array(
          'variant_and_throw_side',
          'ball_mass_material_and_rebound_type',
          'distance_and_target_height',
          'completed_high_quality_repetitions',
          'target_hits_and_output_measure_when_available',
          'sequence_pivot_balance_or_catch_errors',
          'symptoms_and_stop_reason'
        )
      ),
      support_operations_json = jsonb_build_object(
        'selectionInputs', jsonb_build_array(
          'training_intent',
          'readiness_and_symptoms',
          'throw_side',
          'ball_mass_material_diameter_and_rebound_type',
          'wall_distance_and_target',
          'return_contract',
          'lane_and_pivot_space',
          'available_time',
          'weekly_rotational_throwing_and_catch_budgets'
        ),
        'logistics', jsonb_build_object(
          'participantStructure', 'individual_thrower_in_exclusive_lane',
          'oneActiveThrowerPerLane', TRUE,
          'ballCollectionRule', 'collect_only_after_lane_is_closed_and_thrower_is_stationary',
          'coachPosition', 'outside_flight_and_return_path_with_feet_hips_trunk_release_and_wall_visible',
          'shutdownControl', 'coach_or_athlete_can_stop_lane_immediately'
        ),
        'substitutionPolicy', jsonb_build_object(
          'mustPreserve', jsonb_build_array(
            'rotational_power_intent',
            'declared_side',
            'standing_base_or_explicitly_changed_base',
            'ballistic_projection',
            'target_direction',
            'return_contract_or_lower_demand'
          ),
          'mayAdjust', jsonb_build_array(
            'ball_mass',
            'ball_softness',
            'distance',
            'target_size_and_height',
            'backswing_range',
            'repetitions',
            'rest',
            'throw_only_delivery'
          ),
          'neverSilent', jsonb_build_array(
            'throw_to_catch',
            'standing_to_kneeling',
            'wall_to_partner',
            'rotational_throw_to_slam_scoop_or_shot_put',
            'planned_side',
            'symptom_related_change'
          ),
          'uncertaintyRule',
            'When ball behavior, wall, lane, readiness, or return contract is unclear, use a light-ball throw-only regression or select a reviewed nonthrowing rotational alternative.'
        ),
        'feedbackCapture', jsonb_build_array(
          'pain_or_symptoms',
          'target_hit_rate',
          'release_velocity_or_distance_when_available',
          'sequence_pivot_or_balance_error',
          'catch_or_return_error',
          'ball_wall_lane_or_surface_issue',
          'substitution_reason',
          'coach_override'
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
        'identityMigration', '319_coaching_rotational_wall_throw_identity_consolidation',
        'structuralCompletionMigration', migration_key,
        'researchBatch', 'medicine-ball-rotational-wall-throw-family-v1',
        'researchVersion', '2026-07-26.33',
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

  CREATE TEMP TABLE rotational_wall_variant_seed (
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
    spinal_loading INTEGER NOT NULL,
    eccentric_stress INTEGER NOT NULL,
    local_muscle_fatigue INTEGER NOT NULL,
    technical_fatigue_sensitivity INTEGER NOT NULL,
    recovery_hours INTEGER NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO rotational_wall_variant_seed VALUES
    (
      'athletic-stance-wall-throw-only',
      'Medicine Ball Rotational Wall Throw — Throw and Retrieve',
      'throw_only_no_required_catch',
      ARRAY['athletic_stance', 'wall_target', 'throw_only']::TEXT[],
      42, 46, 52, 50, 46, 14, 28, 30, 24, 48, 64, 30
    ),
    (
      'athletic-stance-wall-rebound-catch',
      'Medicine Ball Rotational Wall Throw — Rebound and Catch',
      'rebound_and_controlled_catch',
      ARRAY['athletic_stance', 'wall_target', 'rebound_catch']::TEXT[],
      50, 48, 62, 62, 60, 14, 32, 32, 40, 54, 72, 36
    );

  INSERT INTO coaching.exercise_variant_v1 (
    definition_id,
    variant_key,
    display_name,
    modifier_keys,
    difficulty_json,
    requirements_json,
    load_profile_json,
    fatigue_profile_json,
    programming_profile_json,
    status
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
      'orientation', 'perpendicular_or_oblique_to_wall',
      'laterality', 'bilateral_implement_declared_left_or_right_throw_side',
      'sideRule', 'declare_each_set_and_balance_sides_unless_documented_otherwise',
      'returnContract', seed.return_contract,
      'ballPath', 'outside_hip_or_lateral_load_to_horizontal_wall_target',
      'projection', 'whole_body_rotational_to_inspected_wall',
      'release', 'complete_two_hand_release',
      'pivot', 'feet_knees_hips_and_trunk_turn_as_a_controlled_sequence',
      'ballRule',
        'Declare mass, diameter, material, and rebound behavior; use a ball light enough to preserve speed, sequencing, target accuracy, posture, pivot, and any prescribed catch.',
      'wallRule', CASE seed.return_contract
        WHEN 'rebound_and_controlled_catch'
          THEN 'use_only_a_ball_and_inspected_wall_that_produce_a_tested_predictable_catchable_return'
        ELSE 'the_ball_may_stop_drop_or_return_but_the_thrower_is_not_required_to_catch'
      END,
      'selectable', TRUE,
      'identityQuarantine', FALSE
    ),
    jsonb_build_object(
      'gripDemand', CASE seed.return_contract
        WHEN 'rebound_and_controlled_catch' THEN 34
        ELSE 26
      END,
      'spinalLoading', seed.spinal_loading,
      'eccentricStress', seed.eccentric_stress,
      'landingContactsPerRep', 0,
      'externalLoadMethod', 'declared_medicine_ball_mass_material_diameter_and_rebound_type',
      'loadingType', CASE seed.return_contract
        WHEN 'rebound_and_controlled_catch'
          THEN 'whole_body_ballistic_rotational_projection_plus_return_absorption'
        ELSE 'whole_body_ballistic_rotational_projection_throw_only'
      END,
      'impactClass', 'low_ground_impact_with_ball_flight_and_return_consequence',
      'primaryStress', CASE seed.return_contract
        WHEN 'rebound_and_controlled_catch' THEN jsonb_build_array(
          'rapid_hip_pelvis_and_trunk_rotation',
          'shoulder_horizontal_projection_and_elbow_extension',
          'pivot_and_whole_body_deceleration',
          'visual_tracking_and_return_absorption'
        )
        ELSE jsonb_build_array(
          'rapid_hip_pelvis_and_trunk_rotation',
          'shoulder_horizontal_projection_and_elbow_extension',
          'pivot_and_whole_body_deceleration'
        )
      END
    ),
    jsonb_build_object(
      'localMuscleFatigue', seed.local_muscle_fatigue,
      'gripFatigue', CASE seed.return_contract
        WHEN 'rebound_and_controlled_catch' THEN 34
        ELSE 22
      END,
      'technicalFatigueSensitivity', seed.technical_fatigue_sensitivity,
      'impactAccumulation', 14,
      'recoveryHours', seed.recovery_hours,
      'fatigueSignals', jsonb_build_array(
        'release_velocity_decline',
        'target_accuracy_loss',
        'arm_dominant_or_out_of_sequence_throw',
        'uncontrolled_lumbar_extension_or_rotation',
        'pivot_or_balance_error',
        'shoulder_elbow_wrist_hip_knee_or_back_discomfort',
        'late_unsafe_or_missed_catch_when_prescribed'
      ),
      'cumulativeBudgets', jsonb_build_array(
        'rotational_ballistic_repetitions_per_side',
        'throwing_and_pressing_load',
        'anterior_shoulder_and_elbow_stress',
        'trunk_rotation_and_deceleration',
        'pivot_and_lower_body_power_exposures',
        'catch_absorption_exposures',
        'technical_sensitivity'
      ),
      'recoveryRule',
        'Do not repeat high-intent exposure while pain, soreness, output loss, target loss, sequence error, balance error, or catch hesitation persists.'
    ),
    jsonb_build_object(
      'trainingStimuli', CASE seed.return_contract
        WHEN 'rebound_and_controlled_catch' THEN jsonb_build_array(
          'whole_body_rotational_power',
          'wall_target_accuracy',
          'pivot_and_deceleration_control',
          'return_tracking_and_absorption'
        )
        ELSE jsonb_build_array(
          'whole_body_rotational_power',
          'wall_target_accuracy',
          'pivot_and_deceleration_control'
        )
      END,
      'stimulusDose', jsonb_build_object(
        'sets', '2-4',
        'repetitionsPerSide', '3-5',
        'interRepetitionResetSeconds', '6-15',
        'interSetRestSeconds', '90-180',
        'effort', 'high_intent_while_every_quality_gate_remains_repeatable'
      ),
      'weeklyExposure',
        'Count with all weekly rotational throws, medicine-ball power, sport throwing, pressing, trunk rotation, pivot, and prescribed catch exposures.',
      'prerequisites', jsonb_build_array(
        'pain_free_standing_rotation_and_pivot',
        'stable_athletic_base_and_deceleration',
        'repeatable_two_hand_light_ball_rotational_throw_to_target',
        CASE seed.return_contract
          WHEN 'rebound_and_controlled_catch'
            THEN 'repeatable_tracking_and_safe_return_absorption'
          ELSE 'safe_lane_close_and_ball_retrieval'
        END
      ),
      'completionCriteria', jsonb_build_array(
        'declared_base_throw_side_and_pivot_are_preserved',
        'hips_and_trunk_lead_before_the_arms_finish_projection',
        'release_reaches_declared_target_without_uncontrolled_spine_motion',
        CASE seed.return_contract
          WHEN 'rebound_and_controlled_catch'
            THEN 'return_is_seen_early_caught_away_from_face_and_absorbed_without_balance_loss'
          ELSE 'throw_is_completed_and_ball_is_retrieved_only_after_lane_closure'
        END
      ),
      'sequenceRules', jsonb_build_array(
        'place_after_readiness_and_before_material_throwing_or_rotational_fatigue',
        'declare_side_ball_wall_distance_target_and_return_contract',
        'full_reset_between_repetitions',
        'do_not_use_output_profile_as_density_conditioning'
      ),
      'pairingCompatibility', jsonb_build_object(
        'compatible', jsonb_build_array(
          'low_fatigue_mobility_or_readiness_work',
          'noncompeting_lower_body_strength_afterward',
          'noncompeting_restore_work'
        ),
        'conditional', jsonb_build_array(
          'sport_throwing',
          'heavy_pressing',
          'other_upper_body_plyometrics',
          'high_volume_trunk_rotation',
          'high_volume_pivot_or_change_of_direction'
        )
      ),
      'interferenceRules', jsonb_build_array(
        'do_not_pre_fatigue_trunk_hips_shoulders_or_triceps_before_output_scoring',
        'do_not_combine_untracked_rotational_throwing_and_catch_volume',
        'do_not_increase_ball_mass_when_speed_sequence_target_or_posture_worsens',
        'do_not_select_catch_variant_without_tested_predictable_return_and_clear_lane'
      ),
      'uncertaintyPolicy',
        'When ball behavior, wall, lane, readiness, or return contract is unclear, use a light-ball throw-only regression and keep the uncertain exact variant out of automatic selection.'
    ),
    'review'
  FROM rotational_wall_variant_seed seed
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

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET status = 'archived',
      updated_at = now()
  FROM coaching.exercise_variant_v1 variant
  WHERE variant.id = profile.variant_id
    AND variant.definition_id = target_definition_id
    AND variant.status <> 'archived'
    AND profile.profile_key NOT IN ('output-power', 'technique-control');

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
    time_model_json,
    dose_scaling_json,
    measurement_json,
    support_prompts_json,
    status
  )
  SELECT
    variant.id,
    profile.profile_key,
    profile.phase_key,
    profile.role,
    CASE profile.profile_key
      WHEN 'output-power' THEN
        'Train repeatable high-intent whole-body rotational projection to an inspected wall while the athlete is fresh and the exact return contract remains safe.'
      ELSE
        'Teach the athletic base, side, pivot, ground-to-hands sequence, target, deceleration, and exact return contract with a light ball and controlled intent.'
    END,
    CASE profile.profile_key
      WHEN 'output-power' THEN 92
      ELSE 82
    END,
    CASE profile.profile_key
      WHEN 'output-power' THEN 90
      ELSE 84
    END,
    jsonb_build_object(
      'rotationalPower', CASE profile.profile_key WHEN 'output-power' THEN 95 ELSE 68 END,
      'targetAccuracy', CASE profile.profile_key WHEN 'output-power' THEN 80 ELSE 94 END,
      'sequenceAndPivotControl', CASE profile.profile_key WHEN 'output-power' THEN 76 ELSE 96 END,
      'returnControl', CASE
        WHEN variant.requirements_json->>'returnContract' = 'rebound_and_controlled_catch'
          THEN CASE profile.profile_key WHEN 'output-power' THEN 76 ELSE 95 END
        ELSE 18
      END,
      'conditioning', 10
    ),
    jsonb_build_object(
      'sets', CASE profile.profile_key WHEN 'output-power' THEN '2-4' ELSE '2-3' END,
      'repetitionsPerSide', CASE profile.profile_key WHEN 'output-power' THEN '3-5' ELSE '3-6' END,
      'effort', CASE profile.profile_key
        WHEN 'output-power' THEN 'high_intent_with_repeatable_sequence_speed_target_and_balance'
        ELSE 'submaximal_sequence_target_and_return_learning'
      END,
      'interRepetitionResetSeconds', CASE profile.profile_key
        WHEN 'output-power' THEN '6-15'
        ELSE '6-12'
      END,
      'interSetRestSeconds', CASE profile.profile_key
        WHEN 'output-power' THEN '90-180'
        ELSE '60-120'
      END,
      'ballRule',
        'Use a mass and ball type that preserve intended speed, sequence, target accuracy, posture, pivot, and declared return behavior.',
      'sideRule',
        'Declare the throw side and balance high-quality repetitions across sides unless a documented reason says otherwise.',
      'termination',
        'Stop on the first symptom, unsafe wall or return, lane issue, missed catch, material output decline, target loss, uncontrolled spine motion, or pivot-quality failure.'
    ),
    CASE profile.profile_key
      WHEN 'output-power' THEN
        'Every counted repetition preserves the declared base and side, ground-to-hands sequence, fast release, wall target, controlled deceleration, and exact return contract.'
      ELSE
        'The athlete can describe and repeat the declared base, side, pivot, sequence, target, reset, and exact return contract without symptoms or unsafe compensation.'
    END,
    ARRAY[
      'Pain, numbness, tingling, dizziness, instability, or apprehension.',
      'Ball, wall, surface, pivot space, flight lane, or return path becomes unsafe.',
      'Uncontrolled spine motion, pivot error, balance loss, target loss, or wild release.',
      'Material release-speed decline or late, unsafe, or missed catch when prescribed.'
    ]::TEXT[],
    CASE profile.profile_key
      WHEN 'output-power' THEN
        'Confirm readiness and station safety; declare side, ball, target, distance, and return contract; observe from outside the lane; end the set at the first material quality or output decline.'
      ELSE
        'Teach one sequence at a time with a light ball; verify pivot and deceleration before speed; test any rebound at low intent before allowing a catch.'
    END,
    CASE profile.profile_key
      WHEN 'output-power' THEN
        'Athletic base. Load the outside hip. Turn from the ground up and throw fast through the target. Own the finish, then reset.'
      ELSE
        'Set your base and side. Turn feet, hips, trunk, then hands. Hit the target and finish balanced. Catch only if that is your declared version.'
    END,
    CASE profile.profile_key
      WHEN 'output-power' THEN
        'More repeatable high-intent whole-body rotational projection with preserved side-to-side quality and target accuracy.'
      ELSE
        'More repeatable base, pivot, pelvis-to-trunk-to-arms sequence, target release, deceleration, and declared return control.'
    END,
    ARRAY['medicine_ball', 'inspected_wall']::TEXT[],
    jsonb_build_object(
      'oneActiveThrowerPerLane', TRUE,
      'ballCollection', 'only_after_lane_is_closed_and_thrower_is_stationary',
      'surface', 'level_non_slip_with_clear_pivot_space',
      'wall', 'structurally_suitable_inspected_surface',
      'target', 'declared_height_and_location',
      'flightAndReturnLane', 'clear_no_cross_traffic',
      'coachSightline', 'feet_hips_trunk_release_wall_and_return_visible',
      'reboundRule', CASE
        WHEN variant.requirements_json->>'returnContract' = 'rebound_and_controlled_catch'
          THEN 'test_ball_and_wall_at_low_intent_before_catch_variant'
        ELSE 'no_catch_required_collect_after_lane_close'
      END
    ),
    ARRAY[]::UUID[],
    jsonb_build_object(
      'setupSeconds', '45-90',
      'workSecondsPerSet', CASE profile.profile_key
        WHEN 'output-power' THEN '30-75'
        ELSE '35-90'
      END,
      'restSecondsPerSet', CASE profile.profile_key
        WHEN 'output-power' THEN '90-180'
        ELSE '60-120'
      END,
      'transitionSeconds', '20-45',
      'durationInputs', jsonb_build_array(
        'sets',
        'repetitions_per_side',
        'inter_repetition_reset',
        'ball_collection',
        'inter_set_rest',
        'side_change',
        'station_transition'
      )
    ),
    jsonb_build_object(
      'reduceFirst', jsonb_build_array(
        'ball_mass',
        'backswing_range',
        'repetitions',
        'target_precision',
        'catch_requirement'
      ),
      'increaseOnlyWhen', jsonb_build_array(
        'symptom_free',
        'sequence_repeatable',
        'target_repeatable',
        'pivot_and_deceleration_controlled',
        'no_material_output_decline'
      ),
      'fatigueAdjustment',
        'Reduce repetitions or end the exercise; do not preserve volume by accepting slow, inaccurate, arm-dominant, or uncontrolled throws.',
      'uncertaintyAdjustment',
        'Use a light ball, shorter backswing, throw-only contract, larger target, and longer reset.'
    ),
    jsonb_build_object(
      'required', jsonb_build_array(
        'completed_high_quality_repetitions_by_side',
        'target_hits',
        'sequence_pivot_or_balance_errors',
        'symptoms',
        'stop_reason'
      ),
      'optional', jsonb_build_array(
        'release_velocity',
        'throw_distance_when_not_wall_bound',
        'video_review',
        'session_rpe'
      ),
      'comparisonRule',
        'Compare output only when variant, side, ball, wall distance, target, technique, rebound behavior, and measurement method are unchanged.'
    ),
    jsonb_build_object(
      'before', jsonb_build_array(
        'Which side are you throwing from?',
        'What ball, target, distance, and return contract are declared?',
        'Is the pivot, flight, and return space clear?',
        'Any pain, dizziness, instability, or apprehension?'
      ),
      'during', jsonb_build_array(
        'Did the hips and trunk lead the hands?',
        'Did the ball hit the target?',
        'Did you finish balanced?',
        'If catching, was the return early, predictable, and controlled?'
      ),
      'after', jsonb_build_array(
        'Were both sides equally sharp?',
        'Did speed, accuracy, sequence, pivot, or catch quality decline?',
        'Was a substitution or coach override needed?'
      )
    ),
    'review'
  FROM coaching.exercise_variant_v1 variant
  CROSS JOIN (
    VALUES
      ('output-power', 'output', 'primary'),
      ('technique-control', 'movement_intelligence', 'conditional')
  ) AS profile(profile_key, phase_key, role)
  WHERE variant.definition_id = target_definition_id
    AND variant.status <> 'archived'
    AND variant.variant_key IN (
      'athletic-stance-wall-throw-only',
      'athletic-stance-wall-rebound-catch'
    )
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
    from_variant_id,
    to_variant_id,
    relationship,
    similarity_score,
    dimensions,
    reason,
    conditions_json,
    review_status
  )
  SELECT
    source_variant.id,
    target_variant.id,
    edge.relationship,
    edge.similarity_score,
    edge.dimensions,
    edge.reason,
    edge.conditions_json,
    'review'
  FROM (
    VALUES
      (
        'athletic-stance-wall-throw-only',
        'athletic-stance-wall-rebound-catch',
        'progression',
        92,
        ARRAY['complexity', 'decision_demand', 'load']::TEXT[],
        'Adding a predictable rebound and controlled catch preserves the standing rotational projection while adding tracking, timing, grip, and eccentric absorption demand.',
        '{"requiresTestedPredictableReturn":true,"requiresSafeCatch":true,"humanReviewRequired":true}'::JSONB
      ),
      (
        'athletic-stance-wall-rebound-catch',
        'athletic-stance-wall-throw-only',
        'regression',
        92,
        ARRAY['complexity', 'decision_demand', 'load']::TEXT[],
        'Removing the required catch preserves the standing rotational projection while reducing return tracking and absorption demand.',
        '{"returnContract":"throw_only_no_required_catch","humanReviewRequired":true}'::JSONB
      )
  ) AS edge(
    from_variant_key,
    to_variant_key,
    relationship,
    similarity_score,
    dimensions,
    reason,
    conditions_json
  )
  JOIN coaching.exercise_variant_v1 source_variant
    ON source_variant.definition_id = target_definition_id
   AND source_variant.variant_key = edge.from_variant_key
   AND source_variant.status <> 'archived'
  JOIN coaching.exercise_variant_v1 target_variant
    ON target_variant.definition_id = target_definition_id
   AND target_variant.variant_key = edge.to_variant_key
   AND target_variant.status <> 'archived'
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
  FROM rotational_wall_variant_seed seed
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
            THEN 'Whole-body rotational sequencing, declared side, target release, deceleration, and a returning catch create a moderately complex exact task.'
          ELSE 'Whole-body rotational sequencing, declared side, target release, and controlled deceleration create moderate exercise complexity without a required catch.'
        END
      ),
      (
        'absoluteLoadDemand',
        seed.physical_difficulty,
        CASE seed.return_contract
          WHEN 'rebound_and_controlled_catch'
            THEN 'Ballistic whole-body projection plus controlled return absorption creates moderate physical difficulty when the medicine ball remains speed appropriate.'
          ELSE 'Ballistic whole-body projection creates moderate physical difficulty when the medicine ball remains light enough for speed and target control.'
        END
      ),
      (
        'baseOverallDifficulty',
        greatest(seed.exercise_complexity, seed.physical_difficulty),
        'Overall exercise difficulty is derived only as the maximum of exercise complexity and physical difficulty; it is not a proficiency classification.'
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

  CREATE TEMP TABLE rotational_wall_source_seed (
    source_key TEXT PRIMARY KEY,
    source_url TEXT NOT NULL,
    source_title TEXT NOT NULL,
    source_publisher TEXT NOT NULL,
    source_kind TEXT NOT NULL,
    evidence_quality INTEGER NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO rotational_wall_source_seed VALUES
    (
      'nsca_standing_rotational_wall_toss',
      'https://dxpprod.nsca.com/contentassets/574ab3a9e81e4063a759c38f29a717f8/land-based_strength_and_conditioning_-for_swimming.pdf',
      'Land-Based Strength and Conditioning for Swimming',
      'National Strength and Conditioning Association',
      'professional_standard',
      82
    ),
    (
      'upper_body_plyometric_meta_analysis',
      'https://pubmed.ncbi.nlm.nih.gov/37833510/',
      'Effects of Upper-Body Plyometric Training on Physical Fitness in Healthy Youth and Young Adult Participants: A Systematic Review with Meta-Analysis',
      'Sports Medicine - Open',
      'peer_reviewed_research',
      91
    ),
    (
      'side_medicine_ball_throw_emg',
      'https://pubmed.ncbi.nlm.nih.gov/19826303/',
      'Analysis of trunk muscle activity in the side medicine-ball throw',
      'Journal of Strength and Conditioning Research',
      'peer_reviewed_research',
      80
    ),
    (
      'medicine_ball_rotational_power_validity',
      'https://pubmed.ncbi.nlm.nih.gov/39589937/',
      'Criterion Validity and Reliability of a New Medicine Ball Rotational Power Test',
      'Journal of Strength and Conditioning Research',
      'peer_reviewed_research',
      84
    ),
    (
      'medicine_ball_velocity_reliability',
      'https://pubmed.ncbi.nlm.nih.gov/22744301/',
      'Reliability of seated and standing throwing velocity using differently weighted medicine balls',
      'Journal of Strength and Conditioning Research',
      'peer_reviewed_research',
      81
    ),
    (
      'ace_lateral_wall_ball',
      'https://www.acefitness.org/resources/pros/expert-articles/5289/8-creative-ways-to-use-a-medicine-ball/',
      '8 Creative Ways to Use a Medicine Ball',
      'American Council on Exercise',
      'expert_instruction',
      76
    ),
    (
      'ace_medicine_ball_ift_workout',
      'https://www.acefitness.org/continuing-education/certified/june-2019/7306/medicine-balls-an-ace-integrated-fitness-training-reg-model-workout/',
      'Medicine Balls: An ACE Integrated Fitness Training Model Workout',
      'American Council on Exercise',
      'expert_instruction',
      78
    ),
    (
      'trunk_rotator_strength_rotational_throw',
      'https://pubmed.ncbi.nlm.nih.gov/37721721/',
      'Influence of trunk rotator strength on rotational medicine ball throwing performance',
      'Journal of Sports Medicine and Physical Fitness',
      'peer_reviewed_research',
      81
    ),
    (
      'youtube_embed_help',
      'https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en',
      'Embed videos and playlists',
      'YouTube Help',
      'manufacturer_instruction',
      82
    );

  CREATE TEMP TABLE rotational_wall_evidence_seed (
    section_key TEXT PRIMARY KEY,
    source_key TEXT NOT NULL,
    claims_json JSONB NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO rotational_wall_evidence_seed VALUES
    (
      'identity',
      'nsca_standing_rotational_wall_toss',
      '[
        "The NSCA source names and describes a standing rotational medicine-ball wall toss.",
        "The generic rotational throw and wall-named legacy card are the same identity; exact return behavior belongs in variants."
      ]'::JSONB
    ),
    (
      'taxonomy',
      'upper_body_plyometric_meta_analysis',
      '[
        "Medicine-ball throws are upper-body plyometric tasks for rapid force expression.",
        "The controlled taxonomy is rotate, push, and brace with explicit stance, side, target, release, and return contract."
      ]'::JSONB
    ),
    (
      'anatomy',
      'side_medicine_ball_throw_emg',
      '[
        "Side medicine-ball throwing recruits trunk musculature during rapid rotation and force transfer.",
        "The card declares contributing hip and trunk rotators, legs, chest, shoulders, arms, and stabilizers without claiming isolated action."
      ]'::JSONB
    ),
    (
      'biomechanics',
      'nsca_standing_rotational_wall_toss',
      '[
        "The NSCA execution permits the ankles, knees, and hips to move during the rotational load and throw.",
        "Observable mechanics are athletic base, declared side, whole-body load and pivot, pelvis-to-trunk-to-arms sequence, release, target, and controlled reset or catch."
      ]'::JSONB
    ),
    (
      'difficulty',
      'medicine_ball_rotational_power_validity',
      '[
        "Rotational medicine-ball performance depends on a standardized task and load.",
        "Exercise complexity and physical difficulty are assessed independently; overall difficulty is their maximum."
      ]'::JSONB
    ),
    (
      'load_fatigue_recovery',
      'medicine_ball_velocity_reliability',
      '[
        "Ball mass and technique change release velocity and must be standardized for comparison.",
        "Cumulative budgets include rotational throws, sport throwing, pressing, trunk rotation and deceleration, pivot, and prescribed catch exposures."
      ]'::JSONB
    ),
    (
      'constraints',
      'ace_lateral_wall_ball',
      '[
        "ACE distinguishes ball rebound behavior and describes a lateral wall ball with a whole-body pivot and rapid catch.",
        "Ball, wall, surface, pivot space, target, flight lane, return path, lighting, traffic, and coach sightline must be declared and checked."
      ]'::JSONB
    ),
    (
      'dosage',
      'nsca_standing_rotational_wall_toss',
      '[
        "One NSCA circuit example is contextual evidence, not a universal high-intent prescription.",
        "Candidate output dosage uses short side-balanced sets and generous recovery; technique dosage uses a light ball and stops at the first quality decline."
      ]'::JSONB
    ),
    (
      'instructions',
      'ace_lateral_wall_ball',
      '[
        "ACE describes loading from the outside hip, rotating and pivoting, throwing to a wall target, and catching the return.",
        "The concise instruction is athletic base, load outside hip, turn from the ground up, throw through target, and reset or absorb the declared return."
      ]'::JSONB
    ),
    (
      'safety_stop_rules',
      'ace_medicine_ball_ift_workout',
      '[
        "Ball construction determines rebound behavior and a catch requires whole-body absorption.",
        "Stop for symptoms, unsafe equipment or space, uncontrolled spine or pivot, target loss, output decline, unpredictable return, or missed catch."
      ]'::JSONB
    ),
    (
      'programming',
      'trunk_rotator_strength_rotational_throw',
      '[
        "Rotational throw output is related to trunk-rotation strength in the cited active-adult sample.",
        "Use the task as freshness-sensitive output or movement learning rather than hidden fatigue conditioning."
      ]'::JSONB
    ),
    (
      'athlete_support',
      'ace_lateral_wall_ball',
      '[
        "Athlete support displays side, stance, ball, wall target, distance, return contract, primary cue, and stop signal.",
        "Regressions use readiness and task changes without assigning a proficiency label to the exercise."
      ]'::JSONB
    ),
    (
      'coach_support',
      'medicine_ball_rotational_power_validity',
      '[
        "Meaningful comparison requires a standardized ball, technique, side, and measurement method.",
        "Coach support records exact variant, side, ball, wall, target, distance, return behavior, dose, rest, output, errors, fatigue, and station controls."
      ]'::JSONB
    ),
    (
      'accessibility',
      'ace_medicine_ball_ift_workout',
      '[
        "Ball construction and the ability to absorb a return materially affect safe participation.",
        "Options include lighter or softer ball, larger target, throw-only delivery, reduced backswing, fewer repetitions, longer reset, plain text, and non-video instruction."
      ]'::JSONB
    ),
    (
      'alternates',
      'nsca_standing_rotational_wall_toss',
      '[
        "Rotational wall toss and rotational wall throw name the same identity.",
        "Throw-only and rebound-catch are exact variants; scoop, slam, shot-put, chest-pass, kneeling, and step-behind tasks require separate identity or variant review."
      ]'::JSONB
    ),
    (
      'media',
      'youtube_embed_help',
      '[
        "YouTube supports privacy-enhanced embedding through youtube-nocookie.com.",
        "Current oEmbed health is a link check only; full viewing, exact match, safety, captions, accessibility, reviewer identity, and approval remain unresolved."
      ]'::JSONB
    );

  UPDATE coaching.exercise_section_evidence_v1
  SET review_status = 'superseded',
      updated_at = now()
  WHERE definition_id = target_definition_id
    AND reviewed_card_version <> target_card_version
    AND review_status = 'candidate';

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
    reviewed_at
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
  FROM rotational_wall_evidence_seed evidence
  JOIN rotational_wall_source_seed source
    ON source.source_key = evidence.source_key
  ON CONFLICT (
    definition_id,
    reviewed_card_version,
    section_key,
    source_url
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
    definition_id,
    variant_id,
    reviewed_card_version,
    url,
    embed_url,
    video_id,
    title,
    channel_name,
    embedding_allowed,
    exact_variant_match,
    demonstration_quality_score,
    link_status,
    review_status,
    discovery_method,
    source_query,
    reviewer_user_id,
    reviewed_at,
    notes
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
    'legacy_import',
    'Legacy candidate rechecked through current YouTube oEmbed',
    NULL,
    NULL,
    media.notes
  FROM (
    VALUES
      (
        '862y57v-u5k',
        'https://www.youtube.com/watch?v=862y57v-u5k',
        'Medicine-Ball Rotational Throw',
        'Muscle & Motion',
        'Current title and oEmbed response are healthy. Full viewing, exact stance, wall, side, return contract, ball behavior, safety, captions, accessibility, reviewer identity, and approval remain pending.'
      ),
      (
        'MA5W6TA768k',
        'https://www.youtube.com/watch?v=MA5W6TA768k',
        'Rotational Med Ball Throw',
        'Elite Performance Institute',
        'Current title and oEmbed response are healthy. Full viewing, exact wall and return contract, ball behavior, safety, captions, accessibility, reviewer identity, and approval remain pending.'
      ),
      (
        'NP2e1Szrj28',
        'https://www.youtube.com/watch?v=NP2e1Szrj28',
        'How To Do A MEDICINE BALL ROTATIONAL THROW AGAINST WALL | Exercise Demonstration Video and Guide',
        'Live Lean TV Daily Exercises',
        'Current title and oEmbed response are healthy and the title names a wall. Full viewing, exact stance and return contract, ball behavior, safety, captions, accessibility, reviewer identity, and approval remain pending.'
      ),
      (
        'YPQuvSJL2FM',
        'https://www.youtube.com/watch?v=YPQuvSJL2FM',
        'Medicine Ball Rotational Throw',
        'Nick Brattain',
        'Current title and oEmbed response are healthy. Full viewing, exact wall and return contract, ball behavior, safety, captions, accessibility, reviewer identity, and approval remain pending.'
      ),
      (
        'z68C-BpMcyc',
        'https://www.youtube.com/watch?v=z68C-BpMcyc',
        'Medicine Ball Rotational Throw Demo',
        'Steph Gaudreau - Fuel Your Strength',
        'Current title and oEmbed response are healthy. Full viewing, exact wall and return contract, ball behavior, safety, captions, accessibility, reviewer identity, and approval remain pending.'
      )
  ) AS media(video_id, url, title, channel_name, notes)
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
    definition_id,
    reviewed_card_version,
    alternate_name,
    classification,
    rationale,
    distinguishing_dimensions,
    proposed_card_json,
    review_status,
    reviewer_user_id,
    reviewed_at
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
        'Medicine Ball Rotational Wall Throw',
        'same_identity',
        'The wall-named source preserves the same standing two-hand rotational projection and only makes the target explicit.',
        '{"target":"inspected_wall","identityDisposition":"duplicate_source_identity"}'::JSONB
      ),
      (
        'Standing Rotational Wall Toss',
        'same_identity',
        'Wall toss and wall throw are aliases when stance, side, path, target, and return contract match.',
        '{"stance":"standing_athletic","target":"inspected_wall"}'::JSONB
      ),
      (
        'Lateral Wall Ball',
        'same_identity',
        'The ACE name describes the same standing rotational wall projection with an explicit pivot and rebound catch.',
        '{"returnContract":"rebound_and_controlled_catch","ballBehavior":"predictable_rebound"}'::JSONB
      ),
      (
        'Rotational Wall Throw — Throw and Retrieve',
        'new_variant',
        'The same rotational projection ends after release and uses ball retrieval instead of a required returning catch.',
        '{"returnContract":"throw_only_no_required_catch"}'::JSONB
      ),
      (
        'Rotational Wall Throw — Rebound and Catch',
        'new_variant',
        'The same rotational projection includes visual tracking and controlled absorption of a predictable wall return.',
        '{"returnContract":"rebound_and_controlled_catch"}'::JSONB
      ),
      (
        'Partner Rotational Medicine Ball Pass',
        'new_variant',
        'A trained partner preserves rotational projection but changes targeting, return timing, communication, and catch logistics enough to require an exact contract.',
        '{"target":"trained_partner","operations":"partner_timing_communication_and_return_control"}'::JSONB
      ),
      (
        'Step-Behind Rotational Medicine Ball Throw',
        'new_variant',
        'A step-behind approach preserves rotational projection but adds locomotion, footwork sequencing, momentum, spacing, and deceleration demand.',
        '{"approach":"step_behind","footwork":"dynamic"}'::JSONB
      ),
      (
        'Half-Kneeling Rotational Medicine Ball Throw',
        'new_definition',
        'Half kneeling changes the base, lead-leg relationship, lower-body contribution, pelvic control, and balance constraints.',
        '{"stance":"half_kneeling","lowerBodyContribution":"restricted"}'::JSONB
      ),
      (
        'Medicine Ball Rotational Scoop Toss',
        'new_definition',
        'A scoop toss uses a low-to-high underhand arc and different hand path, target, release angle, and lower-body contribution.',
        '{"projection":"low_to_high_scoop","releasePath":"underhand_arc"}'::JSONB
      ),
      (
        'Medicine Ball Rotational Slam',
        'new_definition',
        'A rotational slam projects to the floor rather than horizontally to a wall and changes direction, impact, ball requirements, and retrieval.',
        '{"target":"floor","projection":"downward_slam"}'::JSONB
      ),
      (
        'Medicine Ball Shot-Put Throw',
        'new_definition',
        'A unilateral shot-put release changes implement position, arm action, laterality, shoulder demand, and release path.',
        '{"armUse":"unilateral","releasePattern":"shot_put"}'::JSONB
      ),
      (
        'Standing Medicine Ball Chest Pass',
        'new_definition',
        'A chest pass projects forward from the chest without the defining side-on rotational load and throw direction.',
        '{"movementPattern":"bilateral_horizontal_push","rotation":"not_primary"}'::JSONB
      )
  ) AS alternate(
    alternate_name,
    classification,
    rationale,
    dimensions
  )
  ON CONFLICT (
    definition_id,
    reviewed_card_version,
    alternate_name
  ) DO UPDATE SET
    classification = EXCLUDED.classification,
    rationale = EXCLUDED.rationale,
    distinguishing_dimensions = EXCLUDED.distinguishing_dimensions,
    proposed_card_json = NULL,
    review_status = 'candidate',
    reviewer_user_id = NULL,
    reviewed_at = NULL,
    updated_at = now();

  UPDATE coaching.exercise_difficulty_profile
  SET technical = 4.2,
      load = 4.6,
      overall = 4.6,
      notes =
        'Legacy return contract is unspecified; candidate values represent throw-only baseline only and remain quarantined pending independent calibration.',
      updated_at = now()
  WHERE exercise_id IN (733, 1156);

  UPDATE coaching.exercise_score_v1 score
  SET technical_complexity = 42,
      absolute_load_demand = 46,
      coordination_demand = 52,
      impact = 14,
      supervision_demand = 56,
      base_overall_difficulty = 46,
      legacy_scores = score.legacy_scores || jsonb_build_object(
        'candidateReassessment', migration_key,
        'difficultyModel', 'max_exercise_complexity_physical_difficulty',
        'sourceIdentity', 'standing_rotational_wall_throw_return_contract_unspecified',
        'identityQuarantined', TRUE,
        'independentCalibrationRequired', TRUE
      ),
      migration_confidence = 62,
      human_review_status = 'queued',
      reviewed_by = NULL,
      reviewed_at = NULL,
      review_notes =
        'Research-backed candidate reassessment only; exact return-contract assignment and independent human calibration remain required.',
      updated_at = now()
  WHERE score.exercise_id IN (733, 1156);

  UPDATE coaching.exercise legacy
  SET archived = TRUE,
      is_published = FALSE,
      why_publish_ready = FALSE,
      skill_level = NULL,
      movement_family = 'Standing medicine-ball rotational wall projection',
      primary_phase_key = 'output',
      phase_subrole = 'jump_throw_explosive_power',
      primary_order_slot = 'rotational_throw_power',
      card_summary =
        'Standing two-hand rotational medicine-ball projection to an inspected wall. The legacy source does not declare throw-only versus rebound-and-catch and remains nonselectable provenance.',
      description =
        'Project a declared medicine ball with two hands from a standing athletic base into an inspected wall using sequenced whole-body rotation. This legacy source does not declare whether the ball must return for a catch; select an exact canonical variant instead.',
      instructions =
        'Declare side, ball, wall, distance, target, and return contract. Use an athletic base, load the outside hip, turn from the ground up, release to target, decelerate under control, and retrieve or catch only as the exact variant specifies.',
      coach_language =
        'Observe base, pivot, pelvis-to-trunk-to-arms sequence, spine position, release, target, deceleration, and any prescribed catch. Stop for symptoms, unsafe equipment or space, sequence loss, target loss, output decline, or catch error.',
      athlete_language =
        'Athletic base. Load the outside hip, turn from the ground up, throw through the target, and finish balanced. Catch only if your version says to catch.',
      scalable_variables = ARRAY[
        'ball_mass',
        'ball_material_and_rebound',
        'wall_distance',
        'target_height_and_size',
        'backswing_range',
        'throw_side',
        'repetitions_per_side',
        'rest',
        'return_contract'
      ]::TEXT[],
      movement_requirements = jsonb_build_object(
        'stance', 'standing_athletic',
        'orientation', 'perpendicular_or_oblique_to_wall',
        'laterality', 'bilateral_implement_declared_left_or_right_throw_side',
        'projection', 'whole_body_rotational_to_wall',
        'return_contract', 'unspecified_legacy_provenance',
        'selectable_exact_variant', FALSE,
        'ball_wall_side_target_and_return_contract_must_be_declared', TRUE
      ),
      coaching_execution = jsonb_build_object(
        'setup', jsonb_build_array(
          'Declare exact variant, side, ball mass and rebound type, wall, distance, target, lane, and collection procedure.',
          'Inspect the ball, wall, surface, pivot space, flight lane, return path, lighting, and traffic boundary.',
          'Confirm pain-free light-ball rotation and test any rebound at low intent.'
        ),
        'quality_gate', jsonb_build_array(
          'Athletic base and controlled pivot remain stable.',
          'Hips and trunk lead before the arms finish the throw.',
          'Release reaches the declared target without uncontrolled spine motion.',
          'Declared retrieval or catch is safe and repeatable.'
        ),
        'stop_signs', jsonb_build_array(
          'Pain, numbness, dizziness, instability, or apprehension',
          'Damaged ball or unsafe wall, surface, pivot space, lane, or return path',
          'Sequence loss, uncontrolled spine motion, balance loss, wild release, target loss, or material speed decline',
          'Unexpected return or missed or unsafe catch'
        )
      ),
      programming_logic = jsonb_build_object(
        'difficulty_model', 'max_exercise_complexity_physical_difficulty',
        'identity_rule', 'select_exact_return_contract',
        'fatigue_rule', 'place_before_material_throwing_rotational_or_upper_body_fatigue',
        'substitution_rule', 'never_silently_change_stance_side_projection_target_or_return_contract',
        'legacy_source_rule', 'return_contract_unspecified_sources_are_nonselectable'
      ),
      updated_at = now()
  WHERE legacy.id IN (733, 1156);

  INSERT INTO coaching.exercise_card_test_packet_v1 (
    definition_id,
    facility_id,
    card_version,
    audit_version,
    status,
    checks_json,
    blocking_issues_json,
    human_review_required
  )
  SELECT
    target_definition_id,
    facility,
    target_card_version,
    'canonical-card-audit-v1',
    'quarantined',
    jsonb_build_object(
      'identityMigration', '319_coaching_rotational_wall_throw_identity_consolidation',
      'completenessMigration', migration_key,
      'researchBatch', 'medicine-ball-rotational-wall-throw-family-v1',
      'difficultyFormula', 'max_exercise_complexity_physical_difficulty',
      'exerciseDifficultyDimensions', jsonb_build_array(
        'exercise_complexity',
        'physical_difficulty'
      ),
      'proficiencyClassificationScope', 'coaching_skill_library_only',
      'genericLegacySourcesSelectable', FALSE,
      'auditRerunRequired', TRUE
    ),
    jsonb_build_array(
      jsonb_build_object(
        'code', 'CARD-CALIBRATION-01',
        'category', 'calibration',
        'message', 'Independent score-anchor review remains required for both exact variants.'
      ),
      jsonb_build_object(
        'code', 'CARD-GRAPH-03',
        'category', 'relationship_graph',
        'message', 'Progression and regression edges remain review-only.'
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
