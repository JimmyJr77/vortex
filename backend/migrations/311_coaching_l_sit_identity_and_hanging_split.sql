-- Consolidate support-position L-sit cards and add the mechanically distinct
-- hanging L-sit as a separate review-only exercise.
--
-- Tuck, one-leg, straddle, support height, and implement stability change the
-- lever, range, or delivery of a straight-arm support compression hold. A
-- hanging L-sit instead suspends the athlete from an overhead grip and therefore
-- changes the support action, shoulder position, grip demand, and safe exit.
--
-- Exercise cards receive exercise-complexity and physical-difficulty scores
-- only. Overall difficulty is their maximum. Athlete/class skill levels remain
-- exclusive to coaching.skill and are neither authored nor inferred here.
--
-- All content, graph edges, media, evidence, and test packets remain in review
-- or quarantine. This migration records no human approval or media verification.
-- IDEMPOTENT.

DO $$
DECLARE
  support_id UUID;
  tuck_definition_id UUID;
  support_baseline_id UUID;
  tuck_variant_id UUID;
  hanging_exercise_id BIGINT;
  hanging_id UUID;
  facility BIGINT;
  active_duplicate_count INTEGER;
  protected_records INTEGER;
BEGIN
  SELECT id, facility_id
  INTO support_id, facility
  FROM coaching.exercise_definition_v1
  WHERE legacy_exercise_id = 603
    AND slug = 'l-sit'
    AND status <> 'archived';

  IF support_id IS NULL THEN
    RAISE EXCEPTION
      'L-sit identity migration requires active legacy exercise 603 / l-sit';
  END IF;

  SELECT id
  INTO tuck_definition_id
  FROM coaching.exercise_definition_v1
  WHERE legacy_exercise_id = 804
    AND slug = 'tuck-l-sit-hold'
    AND status <> 'archived';

  active_duplicate_count := (tuck_definition_id IS NOT NULL)::INTEGER;
  IF active_duplicate_count NOT IN (0, 1) THEN
    RAISE EXCEPTION 'Unexpected L-sit consolidation state';
  END IF;

  SELECT id
  INTO hanging_exercise_id
  FROM coaching.exercise
  WHERE facility_id = facility
    AND slug = 'hanging-l-sit';

  SELECT id
  INTO hanging_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id = facility
    AND slug = 'hanging-l-sit'
    AND status <> 'archived';

  IF hanging_exercise_id IS NOT NULL AND hanging_id IS NULL THEN
    RAISE EXCEPTION
      'L-sit identity migration found a pre-existing legacy hanging-l-sit without canonical migration provenance';
  END IF;

  IF hanging_id IS NOT NULL AND (
    hanging_exercise_id IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM coaching.exercise_definition_v1 d
      WHERE d.id = hanging_id
        AND d.legacy_exercise_id = hanging_exercise_id
        AND d.provenance_json->>'identityMigration'
          = '311_coaching_l_sit_identity_and_hanging_split'
    )
  ) THEN
    RAISE EXCEPTION
      'L-sit identity migration found a conflicting active hanging-l-sit definition';
  END IF;

  IF active_duplicate_count = 1 THEN
    SELECT
      (
        SELECT COUNT(*)
        FROM coaching.exercise_definition_v1
        WHERE id = ANY(ARRAY[support_id, tuck_definition_id])
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
        WHERE definition_id = ANY(ARRAY[support_id, tuck_definition_id])
          AND review_status NOT IN ('candidate', 'superseded')
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_media_candidate_v1
        WHERE definition_id = ANY(ARRAY[support_id, tuck_definition_id])
          AND review_status NOT IN ('candidate', 'superseded')
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_alternate_assessment_v1
        WHERE definition_id = ANY(ARRAY[support_id, tuck_definition_id])
          AND review_status NOT IN ('candidate', 'superseded')
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_card_review_v1
        WHERE definition_id = ANY(ARRAY[support_id, tuck_definition_id])
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_card_revision_v1
        WHERE definition_id = ANY(ARRAY[support_id, tuck_definition_id])
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_media_review_v1
        WHERE definition_id = ANY(ARRAY[support_id, tuck_definition_id])
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_variant_v1
        WHERE definition_id = ANY(ARRAY[support_id, tuck_definition_id])
          AND status = 'published'
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_delivery_profile_v1 p
        JOIN coaching.exercise_variant_v1 v ON v.id = p.variant_id
        WHERE v.definition_id = ANY(ARRAY[support_id, tuck_definition_id])
          AND p.status = 'published'
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_relationship_v1 r
        WHERE (
          r.from_variant_id IN (
            SELECT id FROM coaching.exercise_variant_v1
            WHERE definition_id = ANY(ARRAY[support_id, tuck_definition_id])
          )
          OR r.to_variant_id IN (
            SELECT id FROM coaching.exercise_variant_v1
            WHERE definition_id = ANY(ARRAY[support_id, tuck_definition_id])
          )
        )
          AND (
            r.review_status <> 'review'
            OR r.reviewed_by IS NOT NULL
            OR r.reviewed_at IS NOT NULL
          )
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_score_calibration_v1 c
        JOIN coaching.exercise_variant_v1 v ON v.id = c.variant_id
        WHERE v.definition_id = ANY(ARRAY[support_id, tuck_definition_id])
          AND (
            c.status <> 'review'
            OR c.reviewed_by IS NOT NULL
            OR c.reviewed_at IS NOT NULL
          )
      )
    INTO protected_records;

    IF protected_records > 0 THEN
      RAISE EXCEPTION
        'L-sit identity consolidation requires human review: % protected records',
        protected_records;
    END IF;

    IF (
      SELECT COUNT(*)
      FROM coaching.exercise_definition_source_v1
      WHERE (definition_id = support_id AND legacy_exercise_id = 603)
         OR (definition_id = tuck_definition_id AND legacy_exercise_id = 804)
    ) <> 2 THEN
      RAISE EXCEPTION
        'L-sit identity migration source lineage differs from the expected two-card cluster';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM coaching.exercise_variant_v1
      WHERE definition_id = support_id
        AND variant_key IN ('tuck', 'one-leg', 'straddle', 'ring-support')
    ) THEN
      RAISE EXCEPTION
        'L-sit identity migration conflicts with an existing controlled support variant';
    END IF;

    SELECT id INTO tuck_variant_id
    FROM coaching.exercise_variant_v1
    WHERE definition_id = tuck_definition_id
      AND variant_key = 'baseline';

    IF tuck_variant_id IS NULL THEN
      RAISE EXCEPTION
        'L-sit identity migration requires the historical tuck baseline variant';
    END IF;

    INSERT INTO coaching.exercise_identity_resolution_v1 (
      facility_id,
      survivor_definition_id,
      resolved_definition_id,
      decision,
      rationale,
      evidence_json,
      resolution_source
    )
    VALUES (
      facility,
      support_id,
      tuck_definition_id,
      'duplicate_consolidated',
      'Tuck L-Sit Hold preserves the same straight-arm support compression identity as L-Sit. Knee flexion shortens the lever, so tuck is an explicit regression variant rather than a separate exercise identity or athlete skill level.',
      jsonb_build_object(
        'identityBoundary', 'knee_angle_and_lever_length',
        'targetVariantKey', 'tuck',
        'difficultyModel', 'exercise_complexity_and_physical_difficulty_only',
        'publicationQuarantined', TRUE
      ),
      'deterministic_identity_equivalence'
    )
    ON CONFLICT (survivor_definition_id, resolved_definition_id) DO NOTHING;

    UPDATE coaching.exercise_definition_source_v1
    SET definition_id = support_id,
        source_kind = 'duplicate_consolidation',
        provenance_json = provenance_json || jsonb_build_object(
          'resolvedFromDefinitionId', tuck_definition_id,
          'resolution', 'short_lever_variant',
          'targetVariantKey', 'tuck'
        )
    WHERE definition_id = tuck_definition_id
      AND legacy_exercise_id = 804;

    UPDATE coaching.exercise_variant_v1
    SET definition_id = support_id,
        variant_key = 'tuck',
        display_name = 'Tuck L-Sit',
        updated_at = now()
    WHERE id = tuck_variant_id;

    UPDATE coaching.exercise_definition_v1
    SET status = 'archived',
        reviewed_by = NULL,
        approved_by = NULL,
        last_reviewed_at = NULL,
        approved_video_url = NULL,
        provenance_json = provenance_json || jsonb_build_object(
          'identityResolution', 'short_lever_variant',
          'canonicalSurvivorDefinitionId', support_id,
          'targetVariantKey', 'tuck',
          'humanReviewRequired', TRUE,
          'publicationQuarantined', TRUE
        ),
        updated_at = now()
    WHERE id = tuck_definition_id;
  END IF;

  SELECT id INTO support_baseline_id
  FROM coaching.exercise_variant_v1
  WHERE definition_id = support_id
    AND variant_key = 'baseline';

  IF support_baseline_id IS NULL THEN
    RAISE EXCEPTION 'L-sit identity migration requires the support baseline variant';
  END IF;

  UPDATE coaching.exercise_definition_v1
  SET canonical_name = 'L-Sit',
      display_name = 'L-Sit',
      aliases = ARRAY[
        'L Sit',
        'L Sits',
        'L-Sits',
        'LSit',
        'LSits',
        'Support L-Sit',
        'Tuck L-Sit Hold'
      ]::TEXT[],
      description = 'From a stable straight-arm support on the floor, parallettes, dip bars, boxes, or rings, press the shoulders away from the hands and hold both legs in front at the declared knee angle and height while maintaining controlled breathing and a safe exit.',
      family_key = 'Straight-arm support compression hold',
      status = 'review',
      content_confidence = 76,
      scoring_confidence = 58,
      media_confidence = 20,
      movement_patterns = ARRAY['push', 'brace']::TEXT[],
      body_regions = ARRAY[
        'hand', 'wrist', 'elbow', 'shoulder', 'scapula', 'rib_cage',
        'core', 'spine', 'pelvis', 'hip', 'knee', 'full_body'
      ]::TEXT[],
      required_equipment = ARRAY['none']::TEXT[],
      optional_equipment = ARRAY[
        'parallettes', 'parallel_bars', 'box', 'rings', 'mat', 'timer'
      ]::TEXT[],
      environment_json = jsonb_build_object(
        'support', 'stable_non_slip_and_checked_before_use',
        'clearance', 'feet_and_hips_have_clear_space_for_declared_leg_position',
        'surface', 'level_non_slip_with_safe_step_or_sit_down',
        'rings', 'rated_matched_height_and_still_before_mount',
        'traffic', 'no_person_or_equipment_enters_the_support_or_exit_space',
        'supervision', 'direct_until_hand_support_shoulder_control_and_exit_are_repeatable'
      ),
      population_json = jsonb_build_object(
        'readiness', jsonb_build_array(
          'tolerates_loaded_wrist_or_declared_neutral_grip_support',
          'can_hold_straight_elbows_and_active_shoulders',
          'can lift_the_declared_leg_lever_without_pain_or_breath_distress',
          'can_exit_to_the_floor_or_support_safely'
        ),
        'contraindicationFlags', jsonb_build_array(
          'current_hand_wrist_elbow_shoulder_hip_or_low_back_pain',
          'numbness_tingling_or_instability',
          'painful_hip_pinching_or_cramping_that_changes_mechanics',
          'uncontrolled_elbow_bend_shoulder_collapse_or_fall',
          'unsafe_support_or_exit'
        ),
        'clinicalBoundary', 'Symptoms, recent surgery, instability, neurologic signs, or rehabilitation restrictions require individualized clinician guidance rather than generic card progression.'
      ),
      anatomy_json = jsonb_build_object(
        'jointActions', jsonb_build_array(
          'finger_and_wrist_support_isometric',
          'elbow_extension_isometric',
          'scapular_depression_and_protraction_control',
          'shoulder_extension_relative_to_trunk_isometric',
          'bilateral_hip_flexion_isometric',
          'pelvic_and_trunk_position_control',
          'knee_extension_isometric_by_variant'
        ),
        'primaryMuscles', jsonb_build_array(
          'iliopsoas_and_other_hip_flexors',
          'rectus_abdominis',
          'internal_and_external_obliques',
          'triceps_brachii',
          'serratus_anterior',
          'latissimus_dorsi_and_scapular_depressors'
        ),
        'secondaryMuscles', jsonb_build_array(
          'finger_and_wrist_flexors_and_extensors',
          'rotator_cuff',
          'pectoral_and_anterior_shoulder_stabilizers',
          'deep_trunk_stabilizers',
          'quadriceps_for_extended_knee_variants',
          'hip_abductors_for_straddle_variant'
        ),
        'joints', jsonb_build_array(
          'hand_and_wrist',
          'elbow',
          'glenohumeral_and_scapulothoracic_complex',
          'thoracic_and_lumbar_spine',
          'pelvis',
          'hip',
          'knee'
        ),
        'planes', jsonb_build_array(
          'sagittal_primary',
          'frontal_and_transverse_isometric_control',
          'frontal_hip_abduction_for_straddle_variant'
        ),
        'laterality', 'bilateral_baseline_with_declared_asymmetric_one_leg_variant'
      ),
      athlete_support_json = jsonb_build_object(
        'plainLanguage', 'Push the supports down, keep your elbows long, lift the declared leg shape, breathe, and come down before the shape collapses.',
        'expectedSensations', jsonb_build_array(
          'strong_front_of_hips_and_abdominal_effort',
          'triceps_and_shoulder_support_effort',
          'quadriceps_effort_when_knees_are_long'
        ),
        'selfChecks', jsonb_build_array(
          'support_is_stable',
          'elbows_stay_straight',
          'shoulders_do_not_sink',
          'declared_leg_shape_and_height_are_repeatable',
          'breathing_and_exit_remain_controlled'
        ),
        'accessibility', jsonb_build_array(
          'use_parallettes_or_blocks_for_neutral_wrist_and_more_clearance',
          'use_tuck_or_one_leg_lever',
          'use_heel_taps_or_foot_assistance_as_declared_modifiers',
          'reduce_hold_time_and_increase_rest',
          'provide_visual_timer_plain_language_and_demonstration'
        ),
        'mediaAlternative', 'Written setup, front and side still images, and a coach demonstration must remain available when video is unavailable or unsuitable.'
      ),
      coach_support_json = jsonb_build_object(
        'observation', jsonb_build_array(
          'view_front_and_side',
          'check_support_stability_hand_position_and_exit',
          'watch_elbow_lock_shoulder_height_pelvic_position_knee_angle_leg_height_and_breathing'
        ),
        'corrections', jsonb_build_array(
          'shorten_the_lever_before_accepting_shoulder_or_elbow_collapse',
          'raise_support_height_for_clearance_without_changing_identity',
          'reduce_hold_time_before_shape_or_breathing_fails',
          'separate_ring_support_as_the_higher_stability_variant'
        ),
        'groupManagement', jsonb_build_array(
          'one_athlete_per_support_station',
          'match_support_height_before_the_block',
          'keep_exit_space_clear',
          'sanitize_shared_supports_and_stage_timers'
        ),
        'difficultyBoundary', 'Scores describe exercise complexity and physical demand only. Do not assign or infer athlete, class, or skill-library levels from this exercise card.'
      ),
      support_operations_json = jsonb_build_object(
        'commonIssues', jsonb_build_array(
          'insufficient_clearance',
          'wrist_discomfort',
          'shoulder_collapse',
          'lever_too_long',
          'unclear_hold_standard',
          'unsafe_exit'
        ),
        'escalation', jsonb_build_object(
          'coach', 'Technique, equipment setup, support height, dose, and substitution questions.',
          'clinician', 'Persistent pain, neurologic symptoms, instability, post-operative restrictions, or rehabilitation decisions.',
          'emergency', 'Fall, acute injury, loss of consciousness, chest pain, severe breathing difficulty, or other urgent symptoms.'
        ),
        'feedbackCapture', jsonb_build_array(
          'variant',
          'support_implement_and_height',
          'hold_seconds',
          'clean_sets',
          'first_quality_loss',
          'symptom_response',
          'next_day_response',
          'substitution_used'
        ),
        'changeImpact', 'Changing lever, ring stability, support height, assistance, hold time, or rest requires a new dose comparison; identity changes require a new definition review.'
      ),
      provenance_json = provenance_json || jsonb_build_object(
        'identityMigration', '311_coaching_l_sit_identity_and_hanging_split',
        'consolidatedLegacyExerciseIds', jsonb_build_array(603, 804),
        'difficultyModel', 'exercise_complexity_and_physical_difficulty_only',
        'skillLevelClassification', 'prohibited_on_exercise_cards',
        'humanReviewRequired', TRUE,
        'publicationQuarantined', TRUE,
        'canonicalAuditRequired', TRUE,
        'operationalSupportReviewRequired', TRUE
      ),
      approved_video_url = NULL,
      reviewed_by = NULL,
      approved_by = NULL,
      last_reviewed_at = NULL,
      updated_at = now()
  WHERE id = support_id;

  UPDATE coaching.exercise_variant_v1
  SET display_name = 'L-Sit',
      modifier_keys = ARRAY[
        'straight_knees', 'legs_together', 'bilateral', 'straight_arm_support'
      ]::TEXT[],
      difficulty_json = jsonb_build_object(
        'technicalComplexity', 58,
        'absoluteLoadDemand', 68,
        'coordinationDemand', 58,
        'supervisionDemand', 45,
        'failureConsequence', 44,
        'impact', 1,
        'workCapacityDemand', 66,
        'baseOverallDifficulty', 68
      ),
      requirements_json = jsonb_build_object(
        'supportAction', 'straight_arm_push_support',
        'kneeAngle', 'extended',
        'legPosition', 'together_forward',
        'laterality', 'bilateral',
        'holdStandard', 'declared_repeatable_height_and_time',
        'safeExitRequired', TRUE
      ),
      load_profile_json = jsonb_build_object(
        'loadingType', 'relative_bodyweight_isometric_long_lever_support',
        'gripDemand', 36,
        'spinalLoading', 38,
        'eccentricStress', 12,
        'landingContactsPerRep', 0,
        'externalLoadMethod', 'bodyweight',
        'primaryStress', jsonb_build_array(
          'straight_arm_support',
          'scapular_depression_and_protraction',
          'hip_flexion_isometric',
          'trunk_and_pelvic_control',
          'knee_extension_isometric'
        )
      ),
      fatigue_profile_json = jsonb_build_object(
        'localMuscleFatigue', 72,
        'gripFatigue', 36,
        'technicalFatigueSensitivity', 70,
        'impactAccumulation', 1,
        'recoveryHours', 36,
        'qualityLoss', jsonb_build_array(
          'elbows_bend',
          'shoulders_sink',
          'legs_drop',
          'knees_bend',
          'breath_is_held_uncontrollably',
          'exit_becomes_uncontrolled'
        )
      ),
      programming_profile_json = jsonb_build_object(
        'exerciseComplexity', 58,
        'physicalDifficulty', 68,
        'overallDifficulty', 68,
        'overallFormula', 'max_exercise_complexity_physical_difficulty',
        'trainingStimuli', jsonb_build_array(
          'straight_arm_support_strength',
          'hip_flexion_and_compression_strength',
          'trunk_and_pelvic_control',
          'knee_extension_isometric'
        ),
        'weeklyExposure', jsonb_build_object(
          'minimum', 1, 'typical', 2, 'maximum', 3, 'minimumRecoveryHours', 36
        ),
        'prerequisites', jsonb_build_array(
          'pain_free_straight_arm_support',
          'repeatable_active_shoulders',
          'safe_exit',
          'tuck_or_one_leg_hold_owned'
        ),
        'uncertaintyPolicy', 'Exclude when support stability, wrist or shoulder tolerance, lever ownership, breathing, fatigue state, or safe exit is unknown.'
      ),
      status = 'review',
      updated_at = now()
  WHERE id = support_baseline_id;

  SELECT id INTO tuck_variant_id
  FROM coaching.exercise_variant_v1
  WHERE definition_id = support_id
    AND variant_key = 'tuck';

  IF tuck_variant_id IS NULL THEN
    RAISE EXCEPTION 'L-sit identity migration requires the consolidated tuck variant';
  END IF;

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
  VALUES
    (
      support_id,
      'one-leg',
      'One-Leg L-Sit',
      ARRAY['one_knee_flexed', 'one_knee_extended', 'asymmetric_lever', 'straight_arm_support']::TEXT[],
      jsonb_build_object(
        'technicalComplexity', 50, 'absoluteLoadDemand', 58,
        'coordinationDemand', 54, 'supervisionDemand', 42,
        'failureConsequence', 42, 'impact', 1, 'workCapacityDemand', 56,
        'baseOverallDifficulty', 58
      ),
      jsonb_build_object(
        'supportAction', 'straight_arm_push_support',
        'kneeAngle', 'one_extended_one_flexed',
        'laterality', 'asymmetric_alternating',
        'sideBalanceRequired', TRUE,
        'safeExitRequired', TRUE
      ),
      jsonb_build_object(
        'loadingType', 'relative_bodyweight_isometric_mixed_lever_support',
        'gripDemand', 34, 'spinalLoading', 34, 'eccentricStress', 10,
        'landingContactsPerRep', 0, 'externalLoadMethod', 'bodyweight',
        'primaryStress', jsonb_build_array(
          'straight_arm_support', 'asymmetric_hip_flexion',
          'trunk_anti_rotation', 'single_leg_knee_extension_isometric'
        )
      ),
      jsonb_build_object(
        'localMuscleFatigue', 62, 'gripFatigue', 34,
        'technicalFatigueSensitivity', 66, 'impactAccumulation', 1,
        'recoveryHours', 24,
        'qualityLoss', jsonb_build_array(
          'side_to_side_shift', 'extended_leg_drops', 'elbows_bend',
          'shoulders_sink', 'exit_becomes_uncontrolled'
        )
      ),
      jsonb_build_object(
        'exerciseComplexity', 50, 'physicalDifficulty', 58,
        'overallDifficulty', 58,
        'overallFormula', 'max_exercise_complexity_physical_difficulty',
        'trainingStimuli', jsonb_build_array(
          'mixed_lever_compression_strength',
          'straight_arm_support',
          'anti_rotation_control'
        ),
        'weeklyExposure', jsonb_build_object(
          'minimum', 1, 'typical', 2, 'maximum', 3, 'minimumRecoveryHours', 24
        ),
        'uncertaintyPolicy', 'Exclude when the athlete cannot train both sides symmetrically or the mixed lever causes pain, rotation, or an unsafe exit.'
      ),
      'review'
    ),
    (
      support_id,
      'straddle',
      'Straddle L-Sit',
      ARRAY['straight_knees', 'straddle', 'bilateral', 'straight_arm_support']::TEXT[],
      jsonb_build_object(
        'technicalComplexity', 62, 'absoluteLoadDemand', 66,
        'coordinationDemand', 64, 'supervisionDemand', 46,
        'failureConsequence', 44, 'impact', 1, 'workCapacityDemand', 64,
        'baseOverallDifficulty', 66
      ),
      jsonb_build_object(
        'supportAction', 'straight_arm_push_support',
        'kneeAngle', 'extended',
        'legPosition', 'straddle_forward',
        'laterality', 'bilateral_symmetric',
        'hipAbductionRange', 'declared_owned_range',
        'safeExitRequired', TRUE
      ),
      jsonb_build_object(
        'loadingType', 'relative_bodyweight_isometric_straddle_support',
        'gripDemand', 36, 'spinalLoading', 38, 'eccentricStress', 12,
        'landingContactsPerRep', 0, 'externalLoadMethod', 'bodyweight',
        'primaryStress', jsonb_build_array(
          'straight_arm_support', 'hip_flexion_isometric',
          'hip_abduction_isometric', 'trunk_and_pelvic_control',
          'knee_extension_isometric'
        )
      ),
      jsonb_build_object(
        'localMuscleFatigue', 70, 'gripFatigue', 36,
        'technicalFatigueSensitivity', 72, 'impactAccumulation', 1,
        'recoveryHours', 36,
        'qualityLoss', jsonb_build_array(
          'straddle_becomes_asymmetric', 'knees_bend', 'legs_drop',
          'shoulders_sink', 'exit_becomes_uncontrolled'
        )
      ),
      jsonb_build_object(
        'exerciseComplexity', 62, 'physicalDifficulty', 66,
        'overallDifficulty', 66,
        'overallFormula', 'max_exercise_complexity_physical_difficulty',
        'trainingStimuli', jsonb_build_array(
          'straddle_compression_strength', 'straight_arm_support',
          'hip_abduction_and_trunk_control'
        ),
        'weeklyExposure', jsonb_build_object(
          'minimum', 1, 'typical', 2, 'maximum', 3, 'minimumRecoveryHours', 36
        ),
        'uncertaintyPolicy', 'Exclude when straddle range, hamstring or adductor tolerance, symmetry, support control, or safe exit is unknown.'
      ),
      'review'
    ),
    (
      support_id,
      'ring-support',
      'Ring-Support L-Sit',
      ARRAY['straight_knees', 'legs_together', 'unstable_ring_support', 'straight_arm_support']::TEXT[],
      jsonb_build_object(
        'technicalComplexity', 68, 'absoluteLoadDemand', 74,
        'coordinationDemand', 72, 'supervisionDemand', 70,
        'failureConsequence', 66, 'impact', 1, 'workCapacityDemand', 72,
        'baseOverallDifficulty', 74
      ),
      jsonb_build_object(
        'supportAction', 'straight_arm_ring_support',
        'kneeAngle', 'extended',
        'legPosition', 'together_forward',
        'laterality', 'bilateral',
        'ringStability', 'still_and_controlled',
        'safeMountAndExitRequired', TRUE
      ),
      jsonb_build_object(
        'loadingType', 'relative_bodyweight_isometric_unstable_ring_support',
        'gripDemand', 58, 'spinalLoading', 40, 'eccentricStress', 16,
        'landingContactsPerRep', 0, 'externalLoadMethod', 'bodyweight',
        'primaryStress', jsonb_build_array(
          'ring_grip_and_stability', 'straight_arm_support',
          'scapular_and_rotator_cuff_stabilization',
          'hip_flexion_and_trunk_control'
        )
      ),
      jsonb_build_object(
        'localMuscleFatigue', 78, 'gripFatigue', 58,
        'technicalFatigueSensitivity', 84, 'impactAccumulation', 1,
        'recoveryHours', 48,
        'qualityLoss', jsonb_build_array(
          'rings_drift_or_shake', 'elbows_bend', 'shoulders_sink',
          'legs_drop', 'mount_or_exit_becomes_unsafe'
        )
      ),
      jsonb_build_object(
        'exerciseComplexity', 68, 'physicalDifficulty', 74,
        'overallDifficulty', 74,
        'overallFormula', 'max_exercise_complexity_physical_difficulty',
        'trainingStimuli', jsonb_build_array(
          'unstable_straight_arm_support', 'ring_stability',
          'hip_flexion_and_compression_strength', 'trunk_control'
        ),
        'weeklyExposure', jsonb_build_object(
          'minimum', 1, 'typical', 2, 'maximum', 3, 'minimumRecoveryHours', 48
        ),
        'uncertaintyPolicy', 'Exclude when ring setup, support readiness, direct supervision, clearance, fatigue state, or safe mount and exit is unknown.'
      ),
      'review'
    )
  ON CONFLICT (definition_id, variant_key) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      modifier_keys = EXCLUDED.modifier_keys,
      difficulty_json = EXCLUDED.difficulty_json,
      requirements_json = EXCLUDED.requirements_json,
      load_profile_json = EXCLUDED.load_profile_json,
      fatigue_profile_json = EXCLUDED.fatigue_profile_json,
      programming_profile_json = EXCLUDED.programming_profile_json,
      status = 'review',
      updated_at = now();

  UPDATE coaching.exercise_variant_v1
  SET display_name = 'Tuck L-Sit',
      modifier_keys = ARRAY[
        'bent_knees', 'short_lever', 'bilateral', 'straight_arm_support'
      ]::TEXT[],
      difficulty_json = jsonb_build_object(
        'technicalComplexity', 42,
        'absoluteLoadDemand', 48,
        'coordinationDemand', 44,
        'supervisionDemand', 38,
        'failureConsequence', 38,
        'impact', 1,
        'workCapacityDemand', 48,
        'baseOverallDifficulty', 48
      ),
      requirements_json = jsonb_build_object(
        'supportAction', 'straight_arm_push_support',
        'kneeAngle', 'flexed',
        'leverLength', 'short',
        'laterality', 'bilateral',
        'holdStandard', 'declared_repeatable_height_and_time',
        'safeExitRequired', TRUE
      ),
      load_profile_json = jsonb_build_object(
        'loadingType', 'relative_bodyweight_isometric_short_lever_support',
        'gripDemand', 30,
        'spinalLoading', 28,
        'eccentricStress', 8,
        'landingContactsPerRep', 0,
        'externalLoadMethod', 'bodyweight',
        'primaryStress', jsonb_build_array(
          'straight_arm_support',
          'scapular_depression_and_protraction',
          'short_lever_hip_flexion_isometric',
          'trunk_and_pelvic_control'
        )
      ),
      fatigue_profile_json = jsonb_build_object(
        'localMuscleFatigue', 55,
        'gripFatigue', 30,
        'technicalFatigueSensitivity', 58,
        'impactAccumulation', 1,
        'recoveryHours', 24,
        'qualityLoss', jsonb_build_array(
          'elbows_bend',
          'shoulders_sink',
          'knees_drop',
          'breath_is_held_uncontrollably',
          'exit_becomes_uncontrolled'
        )
      ),
      programming_profile_json = jsonb_build_object(
        'exerciseComplexity', 42,
        'physicalDifficulty', 48,
        'overallDifficulty', 48,
        'overallFormula', 'max_exercise_complexity_physical_difficulty',
        'trainingStimuli', jsonb_build_array(
          'straight_arm_support_strength',
          'short_lever_compression_strength',
          'trunk_and_pelvic_control'
        ),
        'weeklyExposure', jsonb_build_object(
          'minimum', 1, 'typical', 2, 'maximum', 4, 'minimumRecoveryHours', 24
        ),
        'uncertaintyPolicy', 'Exclude when support stability, wrist or shoulder tolerance, breathing, or safe exit is unknown.'
      ),
      status = 'review',
      updated_at = now()
  WHERE id = tuck_variant_id;

  IF hanging_exercise_id IS NULL THEN
    INSERT INTO coaching.exercise (
      facility_id,
      name,
      slug,
      description,
      instructions,
      skill_level,
      default_sets,
      default_work_seconds,
      default_rest_seconds,
      est_seconds_per_set,
      is_published,
      visibility,
      archived,
      card_summary,
      coach_language,
      athlete_language,
      programming_logic,
      why_publish_ready,
      scalable_variables,
      movement_family,
      primary_phase_key,
      phase_subrole,
      primary_order_slot,
      movement_requirements,
      coaching_execution,
      pairing_logic,
      media_library,
      participant_structure,
      programming_kind
    )
    VALUES (
      facility,
      'Hanging L-Sit',
      'hanging-l-sit',
      'From a still two-hand overhead hang, hold both legs forward at the declared knee angle and height while maintaining a secure grip, controlled shoulder position, trunk and pelvic control, breathing, and a safe step-down.',
      'Check the anchor and clearance. Start from a still two-hand hang, set the shoulders without forcing a painful position, lift the declared leg shape, hold only while grip and body position remain controlled, then step down safely.',
      NULL,
      3,
      8,
      120,
      20,
      FALSE,
      'facility',
      FALSE,
      'Review-only static hanging compression hold; distinct from support L-sit and dynamic hanging leg raise.',
      'Score the exercise by complexity and physical difficulty, not athlete skill level. Protect grip, overhead position, stillness, breathing, and exit.',
      'Hang still, lift the shape you can own, breathe, and step down before your grip or body position changes.',
      jsonb_build_object(
        'publicationQuarantined', TRUE,
        'humanReviewRequired', TRUE,
        'difficultyModel', 'exercise_complexity_and_physical_difficulty_only'
      ),
      FALSE,
      ARRAY[
        'knee_angle', 'leg_height', 'hold_seconds', 'sets', 'rest_seconds',
        'assistance', 'implement', 'grip'
      ]::TEXT[],
      'Hanging compression hold',
      'capacity',
      'tissue_capacity_isometric_eccentric_accessory',
      'main_strength',
      jsonb_build_object(
        'anchor', 'rated_and_stable',
        'clearance', 'full_safe_hang_and_step_down',
        'supportAction', 'overhead_suspension'
      ),
      jsonb_build_object(
        'qualityGate', 'Still body, secure grip, declared leg shape, controlled breathing, and safe exit.',
        'stopRules', jsonb_build_array(
          'pain_or_neurologic_symptoms',
          'grip_slip',
          'uncontrolled_swing',
          'shoulder_position_loss',
          'leg_shape_or_height_loss',
          'unsafe_exit'
        )
      ),
      jsonb_build_object(
        'avoidWith', jsonb_build_array(
          'grip_failure', 'exhaustive_vertical_pulling', 'high_consequence_bar_skill'
        )
      ),
      jsonb_build_object(
        'candidateOnly', TRUE,
        'approvedMedia', FALSE
      ),
      'individual',
      'exercise'
    )
    RETURNING id INTO hanging_exercise_id;

    INSERT INTO coaching.exercise_difficulty_profile (
      exercise_id,
      technical,
      load,
      overall,
      recommended_age_min,
      attention_demand,
      notes,
      source,
      complexity
    )
    VALUES (
      hanging_exercise_id,
      5.0,
      6.8,
      6.8,
      7,
      'high',
      'Candidate reassessment: complexity 50/100, physical difficulty 68/100; overall is their maximum.',
      'candidate_canonical_research',
      50
    )
    ON CONFLICT (exercise_id) DO UPDATE
    SET technical = EXCLUDED.technical,
        load = EXCLUDED.load,
        overall = EXCLUDED.overall,
        recommended_age_min = EXCLUDED.recommended_age_min,
        attention_demand = EXCLUDED.attention_demand,
        notes = EXCLUDED.notes,
        source = EXCLUDED.source,
        complexity = EXCLUDED.complexity,
        updated_at = now();

    INSERT INTO coaching.exercise_score_v1 (
      exercise_id,
      technical_complexity,
      absolute_load_demand,
      coordination_demand,
      impact,
      supervision_demand,
      base_overall_difficulty,
      legacy_scores,
      migration_confidence,
      human_review_status,
      review_notes
    )
    VALUES (
      hanging_exercise_id,
      50,
      68,
      54,
      1,
      62,
      68,
      jsonb_build_object(
        'source_table', 'migration_311_candidate_reassessment',
        'source_scale', 100,
        'exerciseComplexity', 50,
        'physicalDifficulty', 68,
        'overallFormula', 'max_exercise_complexity_physical_difficulty'
      ),
      58,
      'queued',
      'Human calibration required; this is an exercise-demand score, not a skill level.'
    )
    ON CONFLICT (exercise_id) DO UPDATE
    SET technical_complexity = EXCLUDED.technical_complexity,
        absolute_load_demand = EXCLUDED.absolute_load_demand,
        coordination_demand = EXCLUDED.coordination_demand,
        impact = EXCLUDED.impact,
        supervision_demand = EXCLUDED.supervision_demand,
        base_overall_difficulty = EXCLUDED.base_overall_difficulty,
        legacy_scores = EXCLUDED.legacy_scores,
        migration_confidence = EXCLUDED.migration_confidence,
        human_review_status = 'queued',
        reviewed_by = NULL,
        reviewed_at = NULL,
        review_notes = EXCLUDED.review_notes,
        updated_at = now();
  END IF;

  IF hanging_id IS NULL THEN
    INSERT INTO coaching.exercise_definition_v1 (
      facility_id,
      legacy_exercise_id,
      slug,
      canonical_name,
      display_name,
      aliases,
      description,
      family_key,
      status,
      content_confidence,
      scoring_confidence,
      media_confidence,
      movement_patterns,
      body_regions,
      required_equipment,
      optional_equipment,
      environment_json,
      population_json,
      provenance_json,
      anatomy_json,
      athlete_support_json,
      coach_support_json,
      support_operations_json
    )
    VALUES (
      facility,
      hanging_exercise_id,
      'hanging-l-sit',
      'Hanging L-Sit',
      'Hanging L-Sit',
      ARRAY['Hanging L Sit', 'Hanging L-Sits', 'Hanging L Sits']::TEXT[],
      'From a still two-hand overhead hang on a secure bar or stable rings, hold both legs forward at the declared knee angle and height while maintaining grip, shoulder position, trunk and pelvic control, breathing, and a safe step-down.',
      'Static hanging compression hold',
      'review',
      72,
      58,
      20,
      ARRAY['hang', 'brace']::TEXT[],
      ARRAY[
        'hand', 'wrist', 'elbow', 'shoulder', 'scapula', 'rib_cage',
        'core', 'spine', 'pelvis', 'hip', 'knee', 'full_body'
      ]::TEXT[],
      ARRAY['bar_or_rings']::TEXT[],
      ARRAY['box', 'mat', 'straps_optional', 'timer']::TEXT[],
      jsonb_build_object(
        'anchor', 'rated_stable_and_checked_before_use',
        'clearance', 'full_safe_hang_leg_position_and_step_down',
        'surface', 'non_slip_with_clear_landing_space',
        'traffic', 'no_person_or_equipment_enters_the_hanging_envelope',
        'supervision', 'direct_until_mount_still_hang_hold_and_exit_are_repeatable'
      ),
      jsonb_build_object(
        'readiness', jsonb_build_array(
          'secure_grip_or_approved_grip_substitute',
          'tolerated_overhead_hang',
          'controlled_still_start',
          'owned_declared_leg_shape_and_height',
          'safe_mount_and_exit'
        ),
        'contraindicationFlags', jsonb_build_array(
          'current_hand_wrist_elbow_shoulder_hip_or_low_back_pain',
          'numbness_tingling_dizziness_or_instability',
          'grip_slip_or_uncontrolled_swing',
          'painful_hip_pinching_or_cramping_that_changes_mechanics',
          'unsafe_mount_or_dismount'
        ),
        'clinicalBoundary', 'Symptoms, recent surgery, instability, neurologic signs, or rehabilitation restrictions require individualized clinician guidance.'
      ),
      jsonb_build_object(
        'source_table', 'coaching.exercise',
        'source_id', hanging_exercise_id,
        'identityMigration', '311_coaching_l_sit_identity_and_hanging_split',
        'identityBoundary', 'overhead_suspension_is_distinct_from_straight_arm_push_support',
        'difficultyModel', 'exercise_complexity_and_physical_difficulty_only',
        'skillLevelClassification', 'prohibited_on_exercise_cards',
        'humanReviewRequired', TRUE,
        'publicationQuarantined', TRUE,
        'canonicalAuditRequired', TRUE,
        'operationalSupportReviewRequired', TRUE
      ),
      jsonb_build_object(
        'jointActions', jsonb_build_array(
          'grip_isometric',
          'elbow_extension_held',
          'overhead_shoulder_and_scapular_position_held',
          'bilateral_hip_flexion_isometric',
          'pelvic_and_trunk_position_control',
          'knee_extension_isometric_by_variant'
        ),
        'primaryMuscles', jsonb_build_array(
          'iliopsoas_and_other_hip_flexors',
          'rectus_abdominis',
          'internal_and_external_obliques',
          'finger_and_wrist_flexors',
          'latissimus_dorsi_and_scapular_stabilizers'
        ),
        'secondaryMuscles', jsonb_build_array(
          'rotator_cuff',
          'deep_trunk_stabilizers',
          'spinal_stabilizers',
          'quadriceps_for_extended_knee_variants'
        ),
        'joints', jsonb_build_array(
          'hand_and_wrist',
          'elbow',
          'glenohumeral_and_scapulothoracic_complex',
          'thoracic_and_lumbar_spine',
          'pelvis',
          'hip',
          'knee'
        ),
        'planes', jsonb_build_array(
          'sagittal_primary',
          'frontal_and_transverse_isometric_control'
        ),
        'laterality', 'bilateral_baseline_with_declared_asymmetric_one_leg_variant'
      ),
      jsonb_build_object(
        'plainLanguage', 'Hang still, lift the declared leg shape, keep breathing, and step down before your grip, shoulders, or body position change.',
        'expectedSensations', jsonb_build_array(
          'grip_and_forearm_effort',
          'front_of_hips_and_abdominal_effort',
          'shoulder_and_upper_back_support_effort',
          'quadriceps_effort_when_knees_are_long'
        ),
        'selfChecks', jsonb_build_array(
          'anchor_and_mount_are_safe',
          'body_starts_and_stays_still',
          'grip_and_shoulder_position_are_secure',
          'declared_leg_shape_and_height_are_repeatable',
          'step_down_is_controlled'
        ),
        'accessibility', jsonb_build_array(
          'use_lower_bar_and_stable_mount_box',
          'use_tuck_or_one_leg_lever',
          'reduce_height_or_hold_time',
          'increase_rest',
          'use_supported_or_supine_substitute_when_overhead_hang_is_not_appropriate'
        ),
        'mediaAlternative', 'Written setup, still images, and a coach demonstration must remain available when video is unavailable or unsuitable.'
      ),
      jsonb_build_object(
        'observation', jsonb_build_array(
          'check_anchor_mount_clearance_and_exit',
          'view_front_and_side',
          'watch_grip_shoulder_position_swing_pelvis_knee_angle_leg_height_breathing_and_dismount'
        ),
        'corrections', jsonb_build_array(
          'settle_the_body_before_lifting',
          'shorten_the_lever_or_height_before_accepting_swing',
          'reduce_hold_time_before_grip_or_shoulder_position_fails',
          'substitute_when_hanging_demands_obscure_the_compression_stimulus'
        ),
        'groupManagement', jsonb_build_array(
          'one_athlete_per_clear_hanging_lane',
          'stage_mount_boxes_before_the_block',
          'keep_exit_and_swing_envelopes_clear',
          'cap_total_hanging_and_grip_volume'
        ),
        'difficultyBoundary', 'Scores describe exercise complexity and physical demand only. Do not assign or infer athlete, class, or skill-library levels.'
      ),
      jsonb_build_object(
        'commonIssues', jsonb_build_array(
          'unsafe_mount_or_clearance',
          'grip_limit',
          'shoulder_discomfort_or_position_loss',
          'swing',
          'lever_too_long',
          'unsafe_exit'
        ),
        'escalation', jsonb_build_object(
          'coach', 'Technique, anchor, mount, dose, fatigue budget, and substitution questions.',
          'clinician', 'Persistent pain, neurologic symptoms, instability, post-operative restrictions, or rehabilitation decisions.',
          'emergency', 'Fall, acute injury, loss of consciousness, chest pain, severe breathing difficulty, or other urgent symptoms.'
        ),
        'feedbackCapture', jsonb_build_array(
          'variant', 'implement', 'grip', 'leg_height', 'hold_seconds',
          'clean_sets', 'swing_events', 'first_quality_loss',
          'symptom_response', 'next_day_response', 'substitution_used'
        ),
        'changeImpact', 'Changing lever, height, implement, assistance, hold time, or rest requires a new dose comparison; changing support action requires an identity review.'
      )
    )
    RETURNING id INTO hanging_id;

    INSERT INTO coaching.exercise_definition_source_v1 (
      definition_id,
      legacy_exercise_id,
      source_kind,
      provenance_json
    )
    VALUES (
      hanging_id,
      hanging_exercise_id,
      'legacy_migration',
      jsonb_build_object(
        'source_table', 'coaching.exercise',
        'created_by_migration', '311_coaching_l_sit_identity_and_hanging_split',
        'publicationQuarantined', TRUE
      )
    );
  END IF;

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
  VALUES
    (
      hanging_id,
      'baseline',
      'Hanging L-Sit',
      ARRAY['straight_knees', 'legs_together', 'bilateral', 'static_hang']::TEXT[],
      jsonb_build_object(
        'technicalComplexity', 50, 'absoluteLoadDemand', 68,
        'coordinationDemand', 54, 'supervisionDemand', 62,
        'failureConsequence', 64, 'impact', 1, 'workCapacityDemand', 68,
        'baseOverallDifficulty', 68
      ),
      jsonb_build_object(
        'supportAction', 'overhead_suspension',
        'kneeAngle', 'extended',
        'legPosition', 'together_forward',
        'laterality', 'bilateral',
        'swingMode', 'still_none',
        'safeMountAndExitRequired', TRUE
      ),
      jsonb_build_object(
        'loadingType', 'relative_bodyweight_isometric_long_lever_hang',
        'gripDemand', 68, 'spinalLoading', 38, 'eccentricStress', 8,
        'landingContactsPerRep', 0, 'externalLoadMethod', 'bodyweight',
        'primaryStress', jsonb_build_array(
          'grip_isometric', 'overhead_shoulder_position',
          'hip_flexion_isometric', 'trunk_and_pelvic_control',
          'knee_extension_isometric'
        )
      ),
      jsonb_build_object(
        'localMuscleFatigue', 72, 'gripFatigue', 68,
        'technicalFatigueSensitivity', 74, 'impactAccumulation', 1,
        'recoveryHours', 36,
        'qualityLoss', jsonb_build_array(
          'grip_opens', 'shoulder_position_changes', 'body_swings',
          'legs_drop', 'knees_bend', 'exit_becomes_uncontrolled'
        )
      ),
      jsonb_build_object(
        'exerciseComplexity', 50, 'physicalDifficulty', 68,
        'overallDifficulty', 68,
        'overallFormula', 'max_exercise_complexity_physical_difficulty',
        'trainingStimuli', jsonb_build_array(
          'static_hanging_compression_strength', 'grip_capacity',
          'overhead_position_tolerance', 'trunk_and_pelvic_control'
        ),
        'weeklyExposure', jsonb_build_object(
          'minimum', 1, 'typical', 2, 'maximum', 3, 'minimumRecoveryHours', 36
        ),
        'uncertaintyPolicy', 'Exclude when anchor, clearance, grip, overhead tolerance, stillness, lever ownership, fatigue state, or safe exit is unknown.'
      ),
      'review'
    ),
    (
      hanging_id,
      'tuck',
      'Tuck Hanging L-Sit',
      ARRAY['bent_knees', 'short_lever', 'bilateral', 'static_hang']::TEXT[],
      jsonb_build_object(
        'technicalComplexity', 38, 'absoluteLoadDemand', 50,
        'coordinationDemand', 42, 'supervisionDemand', 55,
        'failureConsequence', 58, 'impact', 1, 'workCapacityDemand', 52,
        'baseOverallDifficulty', 50
      ),
      jsonb_build_object(
        'supportAction', 'overhead_suspension',
        'kneeAngle', 'flexed',
        'leverLength', 'short',
        'laterality', 'bilateral',
        'swingMode', 'still_none',
        'safeMountAndExitRequired', TRUE
      ),
      jsonb_build_object(
        'loadingType', 'relative_bodyweight_isometric_short_lever_hang',
        'gripDemand', 62, 'spinalLoading', 30, 'eccentricStress', 6,
        'landingContactsPerRep', 0, 'externalLoadMethod', 'bodyweight',
        'primaryStress', jsonb_build_array(
          'grip_isometric', 'overhead_shoulder_position',
          'short_lever_hip_flexion_isometric', 'trunk_and_pelvic_control'
        )
      ),
      jsonb_build_object(
        'localMuscleFatigue', 58, 'gripFatigue', 62,
        'technicalFatigueSensitivity', 62, 'impactAccumulation', 1,
        'recoveryHours', 24,
        'qualityLoss', jsonb_build_array(
          'grip_opens', 'shoulder_position_changes', 'body_swings',
          'knees_drop', 'exit_becomes_uncontrolled'
        )
      ),
      jsonb_build_object(
        'exerciseComplexity', 38, 'physicalDifficulty', 50,
        'overallDifficulty', 50,
        'overallFormula', 'max_exercise_complexity_physical_difficulty',
        'trainingStimuli', jsonb_build_array(
          'short_lever_hanging_compression', 'grip_capacity',
          'still_hang_and_trunk_control'
        ),
        'weeklyExposure', jsonb_build_object(
          'minimum', 1, 'typical', 2, 'maximum', 4, 'minimumRecoveryHours', 24
        ),
        'uncertaintyPolicy', 'Exclude when anchor, grip, overhead tolerance, stillness, breathing, or safe exit is unknown.'
      ),
      'review'
    ),
    (
      hanging_id,
      'one-leg',
      'One-Leg Hanging L-Sit',
      ARRAY['one_knee_flexed', 'one_knee_extended', 'asymmetric_lever', 'static_hang']::TEXT[],
      jsonb_build_object(
        'technicalComplexity', 44, 'absoluteLoadDemand', 58,
        'coordinationDemand', 50, 'supervisionDemand', 58,
        'failureConsequence', 60, 'impact', 1, 'workCapacityDemand', 58,
        'baseOverallDifficulty', 58
      ),
      jsonb_build_object(
        'supportAction', 'overhead_suspension',
        'kneeAngle', 'one_extended_one_flexed',
        'laterality', 'asymmetric_alternating',
        'swingMode', 'still_none',
        'safeMountAndExitRequired', TRUE
      ),
      jsonb_build_object(
        'loadingType', 'relative_bodyweight_isometric_mixed_lever_hang',
        'gripDemand', 65, 'spinalLoading', 34, 'eccentricStress', 7,
        'landingContactsPerRep', 0, 'externalLoadMethod', 'bodyweight',
        'primaryStress', jsonb_build_array(
          'grip_isometric', 'overhead_shoulder_position',
          'asymmetric_hip_flexion_isometric', 'trunk_anti_rotation',
          'single_leg_knee_extension_isometric'
        )
      ),
      jsonb_build_object(
        'localMuscleFatigue', 64, 'gripFatigue', 65,
        'technicalFatigueSensitivity', 68, 'impactAccumulation', 1,
        'recoveryHours', 30,
        'qualityLoss', jsonb_build_array(
          'side_to_side_rotation', 'grip_opens', 'body_swings',
          'extended_leg_drops', 'exit_becomes_uncontrolled'
        )
      ),
      jsonb_build_object(
        'exerciseComplexity', 44, 'physicalDifficulty', 58,
        'overallDifficulty', 58,
        'overallFormula', 'max_exercise_complexity_physical_difficulty',
        'trainingStimuli', jsonb_build_array(
          'mixed_lever_hanging_compression', 'grip_capacity',
          'anti_rotation_control'
        ),
        'weeklyExposure', jsonb_build_object(
          'minimum', 1, 'typical', 2, 'maximum', 3, 'minimumRecoveryHours', 30
        ),
        'uncertaintyPolicy', 'Exclude when both sides cannot be trained symmetrically or the mixed lever causes rotation, swing, pain, or unsafe exit.'
      ),
      'review'
    )
  ON CONFLICT (definition_id, variant_key) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      modifier_keys = EXCLUDED.modifier_keys,
      difficulty_json = EXCLUDED.difficulty_json,
      requirements_json = EXCLUDED.requirements_json,
      load_profile_json = EXCLUDED.load_profile_json,
      fatigue_profile_json = EXCLUDED.fatigue_profile_json,
      programming_profile_json = EXCLUDED.programming_profile_json,
      status = 'review',
      updated_at = now();

  UPDATE coaching.exercise_delivery_profile_v1 p
  SET profile_key = CASE
        WHEN v.variant_key = 'tuck' THEN 'movement-intelligence-tuck-hold'
        ELSE 'capacity-support-hold'
      END,
      updated_at = now()
  FROM coaching.exercise_variant_v1 v
  WHERE p.variant_id = v.id
    AND v.definition_id = support_id
    AND (
      (v.variant_key = 'baseline' AND p.profile_key = 'legacy-capacity')
      OR
      (v.variant_key = 'tuck' AND p.profile_key = 'legacy-movement_intelligence')
    );

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
    time_model_json,
    dose_scaling_json,
    measurement_json,
    support_prompts_json,
    status
  )
  SELECT
    v.id,
    CASE
      WHEN d.id = support_id AND v.variant_key = 'tuck'
        THEN 'movement-intelligence-tuck-hold'
      WHEN d.id = support_id
        THEN 'capacity-support-hold'
      ELSE 'capacity-hanging-hold'
    END,
    CASE
      WHEN d.id = support_id AND v.variant_key = 'tuck'
        THEN 'movement_intelligence'
      ELSE 'capacity'
    END,
    CASE WHEN v.variant_key IN ('baseline', 'tuck') THEN 'primary' ELSE 'conditional' END,
    CASE
      WHEN d.id = support_id
        THEN 'Straight-arm support compression strength with the declared lever, implement, height, and hold time while preserving elbow, shoulder, trunk, breathing, and exit quality.'
      ELSE 'Static overhead hanging compression strength with the declared lever and hold time while preserving grip, shoulder position, stillness, breathing, and a safe step-down.'
    END,
    CASE
      WHEN v.variant_key = 'tuck' THEN 84
      WHEN v.variant_key = 'baseline' THEN 82
      ELSE 76
    END,
    80,
    jsonb_build_object(
      'relativeStrength', 88,
      'trunkControl', 88,
      'supportOrGripCapacity', 78,
      'conditioning', 12
    ),
    jsonb_build_object(
      'sets', jsonb_build_array(2, 5),
      'workSeconds', CASE
        WHEN v.variant_key = 'ring-support' THEN jsonb_build_array(3, 10)
        WHEN v.variant_key = 'tuck' THEN jsonb_build_array(6, 20)
        ELSE jsonb_build_array(4, 15)
      END,
      'restSeconds', CASE
        WHEN v.variant_key = 'ring-support' THEN jsonb_build_array(120, 240)
        ELSE jsonb_build_array(75, 180)
      END,
      'rpeCeiling', 8,
      'qualityReserveSeconds', 2,
      'holdStandard', 'declared_shape_height_and_time'
    ),
    CASE
      WHEN d.id = support_id
        THEN 'Support is stable; elbows remain straight; shoulders do not sink; the declared leg shape and height are held; breathing continues; and the athlete exits under control.'
      ELSE 'Anchor and mount are secure; the body begins and remains still; grip and shoulder position are controlled; the declared leg shape and height are held; and the athlete steps down safely.'
    END,
    CASE
      WHEN d.id = support_id THEN ARRAY[
        'Pain, pinching, numbness, tingling, dizziness, or instability appears.',
        'The support moves, the hands slip, or the athlete cannot exit safely.',
        'Elbows bend or shoulders sink for more than a moment.',
        'The declared knee angle, leg height, trunk position, or breathing cannot be maintained.',
        'The next hold would require a shorter undeclared lever or uncontrolled breath holding.'
      ]::TEXT[]
      ELSE ARRAY[
        'Pain, pinching, numbness, tingling, dizziness, or instability appears.',
        'Grip opens or slips, or the athlete cannot step down safely.',
        'Swing develops or shoulder position cannot be maintained.',
        'The declared knee angle, leg height, trunk position, or breathing cannot be maintained.',
        'The next hold would begin from fatigue rather than a still controlled hang.'
      ]::TEXT[]
    END,
    CASE
      WHEN d.id = support_id
        THEN 'Set support height and the exact lever before the set. End the hold at the first persistent elbow, shoulder, leg, pelvic, breathing, or exit change. Count ring support separately in fatigue and supervision budgets.'
      ELSE 'Check the anchor, mount, clearance, and exit. Start from a settled hang and end before grip, shoulder position, stillness, leg shape, breathing, or step-down quality changes. Count all hanging and pulling fatigue.'
    END,
    CASE
      WHEN d.id = support_id
        THEN 'Push down, keep your elbows long, hold the declared leg shape, breathe, and come down before your shoulders or legs drop.'
      ELSE 'Hang still, hold the declared leg shape, keep breathing, and step down before your grip, shoulders, or legs change.'
    END,
    CASE
      WHEN d.id = support_id
        THEN 'Improved straight-arm support, hip-flexion compression strength, trunk and pelvic control, and repeatable breathing under the declared lever.'
      ELSE 'Improved static hanging compression, grip and overhead-position capacity, trunk and pelvic control, and still-body hold quality.'
    END,
    CASE
      WHEN d.id = support_id AND v.variant_key = 'ring-support'
        THEN ARRAY['rings']::TEXT[]
      WHEN d.id = support_id
        THEN ARRAY['parallettes_or_dip_bars_optional']::TEXT[]
      ELSE ARRAY['bar_or_rings']::TEXT[]
    END,
    jsonb_build_object(
      'station', CASE
        WHEN d.id = support_id THEN 'one_athlete_per_stable_support_station'
        ELSE 'one_athlete_per_clear_hanging_lane'
      END,
      'setupSeconds', CASE WHEN d.id = support_id THEN 15 ELSE 25 END,
      'transitionSeconds', 20,
      'safeExitRequired', TRUE
    ),
    jsonb_build_object(
      'setupSeconds', CASE WHEN d.id = support_id THEN 15 ELSE 25 END,
      'workSeconds', CASE
        WHEN v.variant_key = 'ring-support' THEN jsonb_build_array(3, 10)
        WHEN v.variant_key = 'tuck' THEN jsonb_build_array(6, 20)
        ELSE jsonb_build_array(4, 15)
      END,
      'transitionSeconds', 20,
      'restSeconds', CASE
        WHEN v.variant_key = 'ring-support' THEN jsonb_build_array(120, 240)
        ELSE jsonb_build_array(75, 180)
      END
    ),
    jsonb_build_object(
      'regress', CASE
        WHEN v.variant_key = 'tuck'
          THEN jsonb_build_array('reduce_hold_time', 'raise_support_height_or_use_mount_assistance', 'heel_tap_modifier', 'supported_or_supine_substitute')
        ELSE jsonb_build_array('shorten_lever', 'reduce_leg_height', 'reduce_hold_time', 'increase_rest', 'use_tuck_variant')
      END,
      'progress', CASE
        WHEN v.variant_key = 'tuck'
          THEN jsonb_build_array('increase_clean_hold_time', 'one_leg_variant', 'full_variant')
        ELSE jsonb_build_array('increase_clean_hold_time_within_cap', 'increase_owned_leg_height', 'more_difficult_variant_only_after_readiness_review')
      END,
      'doNotScaleBy', jsonb_build_array('athlete_skill_level', 'class_skill_level')
    ),
    jsonb_build_object(
      'record', jsonb_build_array(
        'variant',
        'implement',
        'support_height_or_mount',
        'knee_angle',
        'leg_height',
        'hold_seconds',
        'sets',
        'rest',
        'first_quality_loss',
        'symptom_and_next_day_response'
      )
    ),
    jsonb_build_object(
      'athlete', 'Could you hold the declared shape while breathing and exit safely?',
      'coach', CASE
        WHEN d.id = support_id
          THEN 'Did support, elbows, shoulders, leg shape, breathing, or exit limit the hold first?'
        ELSE 'Did grip, shoulders, swing, leg shape, breathing, or exit limit the hold first?'
      END,
      'support', 'Record the limiting factor and substitution without assigning an athlete skill level.'
    ),
    'review'
  FROM coaching.exercise_variant_v1 v
  JOIN coaching.exercise_definition_v1 d ON d.id = v.definition_id
  WHERE d.id IN (support_id, hanging_id)
    AND v.status = 'review'
  ON CONFLICT (variant_id, profile_key) DO UPDATE
  SET phase_key = EXCLUDED.phase_key,
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
        support_id, 'tuck', support_id, 'one-leg', 'progression', 90,
        ARRAY['leverage', 'complexity']::TEXT[],
        'One extended leg lengthens the lever while retaining the support L-sit identity.',
        jsonb_build_object('requires', jsonb_build_array('repeatable_tuck_hold', 'both_sides_tolerated'))
      ),
      (
        support_id, 'one-leg', support_id, 'baseline', 'progression', 92,
        ARRAY['leverage', 'complexity']::TEXT[],
        'Extending both knees produces the full bilateral support L-sit lever.',
        jsonb_build_object('requires', jsonb_build_array('repeatable_one_leg_hold_each_side', 'straight_knee_range'))
      ),
      (
        support_id, 'baseline', support_id, 'straddle', 'lateral_substitution', 82,
        ARRAY['range', 'complexity']::TEXT[],
        'Straddle changes frontal-plane hip position and flexibility demand while preserving static straight-arm support compression.',
        jsonb_build_object('requires', jsonb_build_array('pain_free_straddle_range', 'symmetric_leg_height'))
      ),
      (
        support_id, 'baseline', support_id, 'ring-support', 'progression', 78,
        ARRAY['stability', 'complexity', 'fatigue']::TEXT[],
        'Rings retain the support L-sit action but materially increase stability, grip, supervision, and exit demands.',
        jsonb_build_object('requires', jsonb_build_array('stable_ring_support', 'safe_mount_and_exit', 'direct_supervision'))
      ),
      (
        hanging_id, 'tuck', hanging_id, 'one-leg', 'progression', 89,
        ARRAY['leverage', 'complexity']::TEXT[],
        'One extended leg lengthens the lever while retaining the static hanging L-sit identity.',
        jsonb_build_object('requires', jsonb_build_array('still_tuck_hold', 'both_sides_tolerated'))
      ),
      (
        hanging_id, 'one-leg', hanging_id, 'baseline', 'progression', 92,
        ARRAY['leverage', 'complexity']::TEXT[],
        'Extending both knees produces the full bilateral hanging L-sit lever.',
        jsonb_build_object('requires', jsonb_build_array('one_leg_hold_each_side', 'straight_knee_range', 'grip_reserve'))
      )
  ) AS edge(
    from_definition_id,
    from_variant_key,
    to_definition_id,
    to_variant_key,
    relationship,
    similarity_score,
    dimensions,
    reason,
    conditions_json
  )
  JOIN coaching.exercise_variant_v1 source_variant
    ON source_variant.definition_id = edge.from_definition_id
   AND source_variant.variant_key = edge.from_variant_key
  JOIN coaching.exercise_variant_v1 target_variant
    ON target_variant.definition_id = edge.to_definition_id
   AND target_variant.variant_key = edge.to_variant_key
  ON CONFLICT (from_variant_id, to_variant_id, relationship) DO UPDATE
  SET similarity_score = EXCLUDED.similarity_score,
      dimensions = EXCLUDED.dimensions,
      reason = EXCLUDED.reason,
      conditions_json = EXCLUDED.conditions_json,
      review_status = 'review',
      reviewed_by = NULL,
      reviewed_at = NULL,
      updated_at = now();

  UPDATE coaching.exercise_definition_v1 d
  SET athlete_support_json = d.athlete_support_json || jsonb_build_object(
        'whyItMatters', CASE
          WHEN d.id = support_id
            THEN 'Builds straight-arm support and hip-flexion compression capacity while teaching the athlete to preserve shoulder, trunk, leg-shape, breathing, and exit quality.'
          ELSE 'Builds static hanging compression, grip, and overhead-position capacity while teaching the athlete to remain still, breathe, and exit safely.'
        END,
        'primaryCue', CASE
          WHEN d.id = support_id
            THEN 'Push down, keep your elbows long, hold the declared leg shape, and breathe.'
          ELSE 'Hang still, hold the declared leg shape, keep breathing, and step down with reserve.'
        END,
        'unexpectedSensations', jsonb_build_array(
          'sharp_or_increasing_pain',
          'pinching',
          'numbness_or_tingling',
          'dizziness',
          'joint_instability',
          'uncontrolled_cramping',
          'breathing_distress'
        ),
        'painGuidance', 'Stop rather than shortening or changing the movement to work through pain, pinching, neurologic symptoms, instability, or breathing distress. A coach can change the exercise; persistent or concerning symptoms require clinician guidance.',
        'mediaAlternatives', jsonb_build_array(
          'plain_language_setup_and_steps',
          'front_and_side_still_images',
          'coach_demonstration',
          'tactile_or_visual_support_and_leg_height_markers_when_appropriate'
        )
      ),
      coach_support_json = d.coach_support_json || jsonb_build_object(
        'observationChecklist', CASE
          WHEN d.id = support_id THEN jsonb_build_array(
            'support_stability_and_height',
            'hand_or_neutral_grip_position',
            'elbow_extension',
            'shoulder_height_and_scapular_control',
            'pelvis_trunk_knee_angle_and_leg_height',
            'breathing_symmetry_and_exit'
          )
          ELSE jsonb_build_array(
            'anchor_mount_clearance_and_exit',
            'grip_security',
            'shoulder_and_scapular_position',
            'stillness',
            'pelvis_trunk_knee_angle_and_leg_height',
            'breathing_and_step_down'
          )
        END,
        'faultCorrections', CASE
          WHEN d.id = support_id THEN jsonb_build_object(
            'elbow_or_shoulder_collapse', 'Shorten the lever, raise stable support height if clearance is limiting, or reduce hold time.',
            'legs_drop', 'Use tuck or one-leg, reduce the declared height, and stop before shape loss.',
            'wrist_discomfort', 'Stop for pain; if otherwise appropriate, use a stable neutral-grip support or substitute.'
          )
          ELSE jsonb_build_object(
            'swing', 'Settle before the hold, reduce the lever or height, or substitute rather than using momentum.',
            'grip_or_shoulder_limit', 'End the set, increase rest, or use a supported compression substitute.',
            'unsafe_exit', 'Lower the anchor or stage a stable mount box before another attempt.'
          )
        END,
        'demonstrationPlan', jsonb_build_array(
          'show_setup_and_equipment_check',
          'show_the_exact_selected_variant_from_front_and_side',
          'show_the_quality_gate_and_first_stop_signal',
          'show_the_controlled_exit',
          'contrast_one_common_fault_without_asking_the_athlete_to_reproduce_a_risky_failure'
        ),
        'modificationDecisionTree', jsonb_build_object(
          'symptoms', 'Stop and triage; do not solve pain with a shorter lever.',
          'equipment_or_exit_not_safe', 'Do not prescribe; change the station or exercise.',
          'quality_fails_before_minimum_time', 'Shorten lever or height, add safe assistance, or substitute.',
          'quality_passes_with_reserve', 'Keep the dose or progress one dimension after recovery is confirmed.'
        ),
        'doNotUseWhen', CASE
          WHEN d.id = support_id THEN jsonb_build_array(
            'support_is_unstable_or_clearance_is_unsafe',
            'hand_wrist_elbow_or_shoulder_support_is_not_tolerated',
            'fatigue_requires_elbow_or_shoulder_collapse',
            'the_athlete_cannot_exit_under_control'
          )
          ELSE jsonb_build_array(
            'anchor_mount_clearance_or_exit_is_unsafe',
            'grip_or_overhead_hang_is_not_tolerated',
            'the_athlete_cannot_prevent_swing',
            'prior_hanging_or_pulling_fatigue_removes_safe_reserve'
          )
        END
      ),
      support_operations_json = d.support_operations_json || jsonb_build_object(
        'issueCategories', jsonb_build_array(
          'equipment_or_environment',
          'identity_or_variant_selection',
          'technique_or_quality_gate',
          'dose_or_recovery',
          'accessibility_or_media',
          'pain_or_medical',
          'incident_or_emergency'
        ),
        'supportEscalation', jsonb_build_object(
          'coach', 'Equipment setup, variant selection, technique, dose, fatigue, logistics, and substitution.',
          'contentReviewer', 'Identity, taxonomy, anatomy, evidence, difficulty calibration, media exact match, captions, accessibility, and approval.',
          'clinician', 'Persistent pain, neurologic symptoms, instability, post-operative restrictions, or rehabilitation decisions.',
          'emergency', 'Fall, acute injury, loss of consciousness, chest pain, severe breathing difficulty, or other urgent symptoms.'
        ),
        'retentionPolicy', 'Retain the card version, selected variant, dose, quality result, stop reason, substitution, symptom response, reviewer decisions, and media verification timestamps under the canonical audit retention policy.',
        'changeImpactPolicy', 'Changes to identity, support action, difficulty, safety, stop rules, approved media, or graph edges require card-version and downstream workout revalidation. Dose-only changes require profile and duration revalidation.'
      ),
      updated_at = now()
  WHERE d.id IN (support_id, hanging_id);

  UPDATE coaching.exercise_variant_v1 v
  SET programming_profile_json = v.programming_profile_json || jsonb_build_object(
        'stimulusDose', jsonb_build_object(
          'minimumEffectiveSeconds', CASE
            WHEN v.variant_key = 'ring-support' THEN 6
            WHEN v.variant_key = 'tuck' THEN 12
            ELSE 8
          END,
          'typicalTotalSeconds', CASE
            WHEN v.variant_key = 'ring-support' THEN 24
            WHEN v.variant_key = 'tuck' THEN 40
            ELSE 30
          END,
          'maximumUsefulSeconds', CASE
            WHEN v.variant_key = 'ring-support' THEN 40
            WHEN v.variant_key = 'tuck' THEN 80
            ELSE 60
          END
        ),
        'prerequisites', CASE
          WHEN v.definition_id = support_id THEN jsonb_build_array(
            'stable_support_and_clear_exit',
            'pain_free_declared_hand_or_neutral_grip_support',
            'repeatable_straight_elbows_and_active_shoulders',
            'owned_selected_leg_shape'
          )
          ELSE jsonb_build_array(
            'rated_anchor_clearance_and_safe_mount',
            'secure_grip_and_tolerated_overhead_hang',
            'repeatable_still_start',
            'owned_selected_leg_shape_and_safe_step_down'
          )
        END,
        'completionCriteria', jsonb_build_array(
          'complete_the_prescribed_clean_hold_time_in_every_set',
          'preserve_the_declared_shape_breathing_and_exit',
          'finish_with_visible_quality_reserve',
          'report_no_abnormal_same_day_or_next_day_response'
        ),
        'sequenceRules', CASE
          WHEN v.definition_id = support_id THEN jsonb_build_object(
            'preferredAfter', jsonb_build_array('general_warm_up', 'wrist_and_shoulder_preparation', 'shorter_lever_rehearsal'),
            'preferredBefore', jsonb_build_array('fatiguing_pressing', 'ring_support_volume', 'high_volume_compression'),
            'avoidAfter', jsonb_build_array('support_failure', 'hand_or_wrist_fatigue', 'exhaustive_pressing')
          )
          ELSE jsonb_build_object(
            'preferredAfter', jsonb_build_array('general_warm_up', 'grip_and_shoulder_preparation', 'shorter_lever_rehearsal'),
            'preferredBefore', jsonb_build_array('fatiguing_vertical_pull', 'bar_skills', 'high_volume_hanging'),
            'avoidAfter', jsonb_build_array('grip_failure', 'uncontrolled_swing_work', 'exhaustive_pulling')
          )
        END,
        'pairingCompatibility', CASE
          WHEN v.definition_id = support_id THEN jsonb_build_object(
            'recommended', jsonb_build_array('lower_body_strength', 'low_demand_mobility'),
            'acceptable', jsonb_build_array('non_competing_technical_work'),
            'incompatible', jsonb_build_array('high_volume_pressing', 'exhaustive_ring_support', 'high_volume_hip_flexion')
          )
          ELSE jsonb_build_object(
            'recommended', jsonb_build_array('lower_body_strength', 'low_demand_mobility'),
            'acceptable', jsonb_build_array('low_grip_technical_work'),
            'incompatible', jsonb_build_array('high_volume_vertical_pull', 'max_effort_grip', 'high_consequence_bar_skill', 'high_volume_hip_flexion')
          )
        END,
        'interferenceRules', CASE
          WHEN v.definition_id = support_id THEN jsonb_build_array(
            jsonb_build_object('stimulus', 'support_or_pressing_fatigue', 'action', 'reduce_dose_or_substitute'),
            jsonb_build_object('stimulus', 'clearance_limits_leg_height', 'action', 'change_stable_support_height_before_changing_lever'),
            jsonb_build_object('stimulus', 'wrist_or_hand_symptoms', 'action', 'stop_and_triage_not_push_through')
          )
          ELSE jsonb_build_array(
            jsonb_build_object('stimulus', 'grip_or_pulling_fatigue', 'action', 'reduce_dose_or_use_supported_substitute'),
            jsonb_build_object('stimulus', 'swing_or_unsafe_mount', 'action', 'change_station_or_substitute'),
            jsonb_build_object('stimulus', 'overhead_symptoms', 'action', 'stop_and_triage_not_push_through')
          )
        END
      ),
      updated_at = now()
  WHERE v.definition_id IN (support_id, hanging_id)
    AND v.status = 'review';

  UPDATE coaching.exercise_score_v1
  SET technical_complexity = CASE exercise_id
        WHEN 603 THEN 58
        WHEN 804 THEN 42
      END,
      absolute_load_demand = CASE exercise_id
        WHEN 603 THEN 68
        WHEN 804 THEN 48
      END,
      coordination_demand = CASE exercise_id
        WHEN 603 THEN 58
        WHEN 804 THEN 44
      END,
      impact = 1,
      supervision_demand = CASE exercise_id
        WHEN 603 THEN 45
        WHEN 804 THEN 38
      END,
      base_overall_difficulty = CASE exercise_id
        WHEN 603 THEN 68
        WHEN 804 THEN 48
      END,
      legacy_scores = legacy_scores || jsonb_build_object(
        'candidateReassessment', 'migration_311',
        'overallFormula', 'max_exercise_complexity_physical_difficulty',
        'skillLevelClassification', 'prohibited_on_exercise_cards'
      ),
      migration_confidence = 58,
      human_review_status = 'queued',
      reviewed_by = NULL,
      reviewed_at = NULL,
      review_notes = 'Human calibration required; scores describe exercise demand, not athlete skill level.',
      updated_at = now()
  WHERE exercise_id IN (603, 804);

  UPDATE coaching.exercise_difficulty_profile
  SET technical = CASE exercise_id
        WHEN 603 THEN 5.8
        WHEN 804 THEN 4.2
      END,
      load = CASE exercise_id
        WHEN 603 THEN 6.8
        WHEN 804 THEN 4.8
      END,
      overall = CASE exercise_id
        WHEN 603 THEN 6.8
        WHEN 804 THEN 4.8
      END,
      complexity = CASE exercise_id
        WHEN 603 THEN 58
        WHEN 804 THEN 42
      END,
      notes = 'Candidate reassessment: overall equals max(exercise complexity, physical difficulty); no athlete skill level.',
      source = 'candidate_canonical_research',
      updated_at = now()
  WHERE exercise_id IN (603, 804);

  UPDATE coaching.exercise
  SET skill_level = NULL,
      updated_at = now()
  WHERE id IN (603, 804, hanging_exercise_id);

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
    d.id,
    d.facility_id,
    d.card_version,
    'canonical-card-audit-v1',
    'quarantined',
    jsonb_build_object(
      'identityMigration', '311_coaching_l_sit_identity_and_hanging_split',
      'difficultyFormula', 'max_exercise_complexity_physical_difficulty',
      'skillLevelClassification', 'prohibited_on_exercise_cards'
    ),
    jsonb_build_array(
      jsonb_build_object(
        'code', 'l_sit_human_review_required',
        'message', 'Identity, difficulty, dosage, graph edges, instructions, and safety content require human review.'
      ),
      jsonb_build_object(
        'code', 'l_sit_media_review_required',
        'message', 'Candidate videos require exact-match, safety, captions, accessibility, embedding, and availability review.'
      )
    ),
    TRUE
  FROM coaching.exercise_definition_v1 d
  WHERE d.id IN (support_id, hanging_id)
  ON CONFLICT (definition_id) DO UPDATE
  SET facility_id = EXCLUDED.facility_id,
      card_version = EXCLUDED.card_version,
      audit_version = EXCLUDED.audit_version,
      status = 'quarantined',
      checks_json = EXCLUDED.checks_json,
      blocking_issues_json = EXCLUDED.blocking_issues_json,
      human_review_required = TRUE,
      checked_at = now();
END
$$;
