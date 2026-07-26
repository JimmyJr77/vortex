-- Complete the candidate-only half-kneeling single-arm vertical press family
-- after migration 334 consolidates implement-labeled definitions.
--
-- Exercise difficulty is exercise complexity plus physical difficulty, with
-- overall derived as their maximum. Exercise cards receive no skill or
-- proficiency level. Evidence, media, graph, calibration, and publication
-- remain candidate/review-only. IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '335_coaching_half_kneeling_single_arm_press_family_completion';
  target_definition_id UUID;
  facility BIGINT;
  target_card_version INTEGER;
  protected_records INTEGER;
  unexpected_variants INTEGER;
BEGIN
  SELECT id, facility_id
  INTO target_definition_id, facility
  FROM coaching.exercise_definition_v1
  WHERE slug = 'half-kneeling-single-arm-press'
    AND status <> 'archived';

  IF target_definition_id IS NULL THEN
    RAISE EXCEPTION
      'Half-kneeling single-arm press completion requires the active survivor definition';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_definition_v1
    WHERE slug IN (
      'half-kneeling-single-arm-dumbbell-press',
      'half-kneeling-kettlebell-press',
      'half-kneeling-band-overhead-press'
    )
      AND status <> 'archived'
  ) THEN
    RAISE EXCEPTION
      'Half-kneeling single-arm press completion requires migration 334 first';
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
      'Half-kneeling single-arm press completion refused to override % protected records',
      protected_records;
  END IF;

  SELECT COUNT(*)
  INTO unexpected_variants
  FROM coaching.exercise_variant_v1
  WHERE definition_id = target_definition_id
    AND status <> 'archived'
    AND variant_key NOT IN (
      'baseline',
      'dumbbell-ipsilateral-to-down-knee-standard',
      'dumbbell-contralateral-to-down-knee-standard',
      'kettlebell-ipsilateral-to-down-knee-standard',
      'kettlebell-contralateral-to-down-knee-standard',
      'band-low-anchor-ipsilateral-to-down-knee-standard',
      'band-low-anchor-contralateral-to-down-knee-standard'
    );

  IF unexpected_variants > 0 THEN
    RAISE EXCEPTION
      'Half-kneeling single-arm press completion found % unexpected active variants',
      unexpected_variants;
  END IF;

  UPDATE coaching.exercise_variant_v1
  SET variant_key = 'legacy-generic-half-kneeling-press-source-190',
      status = 'archived',
      requirements_json = requirements_json || jsonb_build_object(
        'selectable', FALSE,
        'identityQuarantine', TRUE,
        'quarantineReason',
          'The generic source does not declare exact implement, grip, rack, pressing-arm relationship to the down knee, stance, load, range, tempo, pickup, or set-down.'
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
        WHEN provenance_json->>'structuralCompletionMigration'
          IS DISTINCT FROM migration_key
          THEN card_version + 1
        ELSE card_version
      END,
      canonical_name = 'Half-Kneeling Single-Arm Press',
      display_name = 'Half-Kneeling Single-Arm Press',
      description =
        'From a declared half-kneeling stance with one padded knee down and the opposite foot flat, hold one exact implement at the pressing shoulder. Brace the pelvis and trunk, press one arm vertically without leg drive, rib flare, or uncontrolled trunk motion, reach the declared pain-free overhead finish, then lower under control to the exact rack and reset.',
      family_key = 'half_kneeling_single_arm_vertical_press',
      movement_patterns = ARRAY['push', 'brace']::TEXT[],
      body_regions = ARRAY[
        'shoulder', 'scapula', 'elbow',
        'wrist', 'hand', 'core', 'spine', 'pelvis', 'hip', 'knee', 'foot'
      ]::TEXT[],
      required_equipment = ARRAY['mat']::TEXT[],
      optional_equipment = ARRAY[
        'dumbbell', 'kettlebell', 'bands', 'rack'
      ]::TEXT[],
      environment_json = jsonb_build_object(
        'surface',
          'level_high_traction_floor_with_padded_down_knee_and_declared_footwear',
        'station',
          'exclusive_clear_kneeling_press_pickup_lowering_and_set_down_zone',
        'overheadClearance',
          'full_arm_implement_and_band_path_clear_of_ceiling_people_and_objects',
        'implement',
          'declared_exact_type_quantity_grip_rack_load_pickup_and_set_down',
        'bandAnchor',
          'for_band_variants_use_only_a_low_fixed_rated_anchor_inspected_for_direction_and_recoil',
        'traffic',
          'people_loose_loads_and_unused_equipment_outside_press_and_recoil_paths',
        'lighting',
          'front_foot_down_knee_pelvis_trunk_scapula_arm_wrist_and_implement_visible',
        'coachSightline',
          'front_oblique_or_side_view_outside_overhead_drop_band_recoil_and_set_down_paths'
      ),
      population_json = jsonb_build_object(
        'readiness', jsonb_build_array(
          'pain_free_supported_half_kneeling_on_both_sides',
          'pain_free_single_arm_overhead_reach_through_declared_range',
          'can_control pelvis_ribs_trunk_scapula_elbow_and_wrist_without_leg_drive',
          'can_follow exact_side_stance_grip_rack_range_tempo_repetition_rest_and_stop_instructions',
          'can_control declared_load_pickup_and_set_down_or_band_anchor_and_recoil'
        ),
        'contraindicationFlags', jsonb_build_array(
          'current_shoulder_neck_back_elbow_wrist_hand_hip_knee_or_foot_pain',
          'numbness_dizziness_pressure_symptoms_or_uncontrolled_breath_holding',
          'unsafe_overhead_clearance_mat_floor_implement_anchor_band_or_station',
          'uncontrolled_half_kneeling_balance_rib_flare_trunk_motion_or_load_path',
          'unassessed_recent_injury_surgery_pregnancy_postpartum_or_rehabilitation_restriction'
        ),
        'supervision',
          'Direct observation until stance, side relationship, rack, grip, brace, scapular motion, vertical path, overhead finish, lowering, breathing, and set-down are repeatable.',
        'selectionBoundary',
          'Select exact implement, pressing arm, down knee, front foot, grip, rack, load or band tension, anchor, range, tempo, repetitions, rest, pickup, and set-down from current control; exercise cards do not carry skill levels.',
        'clinicalBoundary',
          'Pain, neurologic signs, pressure symptoms, recent injury or surgery, pregnancy/postpartum concerns, or rehabilitation restrictions require individualized qualified guidance.'
      ),
      anatomy_json = jsonb_build_object(
        'primaryMuscles', jsonb_build_array(
          'anterior_and_middle_deltoid', 'triceps_brachii',
          'serratus_anterior'
        ),
        'secondaryMuscles', jsonb_build_array(
          'upper_and_lower_trapezius', 'rotator_cuff',
          'clavicular_pectoralis_major',
          'abdominal_wall_and_obliques', 'spinal_stabilizers',
          'gluteals_and_half_kneeling_hip_stabilizers',
          'forearm_and_hand_flexors'
        ),
        'stabilizers', jsonb_build_array(
          'rotator_cuff', 'scapular_stabilizers',
          'contralateral_and_ipsilateral_obliques',
          'deep_abdominal_and_spinal_stabilizers',
          'pelvic_and_hip_stabilizers', 'grip_and_wrist_stabilizers'
        ),
        'joints', jsonb_build_array(
          'glenohumeral', 'scapulothoracic', 'acromioclavicular',
          'elbow', 'radioulnar', 'wrist', 'hand',
          'spine', 'pelvis', 'bilateral_hip', 'down_knee',
          'front_ankle_and_foot'
        ),
        'jointActions', jsonb_build_array(
          'shoulder_flexion_and_abduction_in_individual_scapular_plane',
          'scapular_upward_rotation_posterior_tilt_and_elevation',
          'elbow_extension_and_flexion',
          'wrist_and_grip_stabilization',
          'anti_extension_anti_lateral_flexion_and_anti_rotation_trunk_stabilization',
          'half_kneeling_pelvic_hip_knee_and_foot_stabilization'
        ),
        'planes', jsonb_build_array(
          'scapular_and_sagittal_press_motion',
          'frontal_and_transverse_stabilization'
        ),
        'laterality',
          'unilateral_press_with_declared_pressing_arm_relationship_to_down_knee_and_both_stances_balanced',
        'primaryActions', jsonb_build_array(
          'establish_declared_half_kneeling_stance',
          'rack_one_exact_implement_at_pressing_shoulder',
          'brace_pelvis_ribs_and_trunk',
          'press_one_arm_vertically_without_leg_drive',
          'permit_controlled_scapular_upward_rotation',
          'reach_declared_pain_free_overhead_finish',
          'lower_to_exact_rack_and_reset_or_set_down_safely'
        )
      ),
      athlete_support_json = jsonb_build_object(
        'whyItMatters',
          'This task builds one-arm overhead pressing strength while you control the shoulder blade, ribs, pelvis, half-kneeling base, breathing, and an offset load.',
        'beforeYouStart', jsonb_build_array(
          'Confirm pressing arm, down knee, front foot, implement, grip, rack, load or band tension, anchor, range, tempo, repetitions, rest, and set-down.',
          'Check knee padding, overhead clearance, floor, load, band and anchor, and recoil path.',
          'Use only a pain-free range that keeps your ribs, pelvis, trunk, shoulder, elbow, wrist, and balance controlled.'
        ),
        'primaryCue',
          'Set the half kneel, rack and brace, press tall without leaning, lower to the same rack.',
        'expectedSensations', jsonb_build_array(
          'pressing_shoulder_and_triceps_effort',
          'scapular_and_rotator_cuff_control',
          'abdominal_and_hip_bracing',
          'grip_and_forearm_effort'
        ),
        'unexpectedSensations', jsonb_build_array(
          'sharp_pain_or_joint_pinching', 'numbness_or_dizziness',
          'pressure_symptoms', 'uncontrolled_neck_back_knee_or_wrist_strain'
        ),
        'selfChecks', jsonb_build_array(
          'My front foot and down knee stay planted and my pelvis stays level.',
          'My ribs stay stacked without leaning, twisting, or leg drive.',
          'My forearm and wrist control the exact path and the load returns to the same rack.',
          'I stop before range, breathing, balance, anchor, or load control changes.'
        ),
        'painGuidance',
          'Stop immediately for pain, pinching, numbness, dizziness, pressure symptoms, loss of balance, rib flare or trunk motion, grip or wrist failure, a moving anchor, band damage, or an overhead path you cannot control.',
        'accessibility', jsonb_build_array(
          'lighter_load_or_band_tension', 'shorter_pain_free_range',
          'taller_knee_padding', 'fewer_repetitions',
          'longer_rest', 'non_overhead_reviewed_press_substitution',
          'plain_text_audio_tactile_visual_or_live_demonstration'
        ),
        'mediaAlternatives',
          'Use the written exact-variant contract and a qualified live demonstration until a matching video is independently reviewed and approved.'
      ),
      coach_support_json = jsonb_build_object(
        'observationChecklist', jsonb_build_array(
          'pressing_arm_down_knee_front_foot_and_stance_width',
          'mat_floor_overhead_clearance_implement_or_band_anchor',
          'grip_rack_wrist_elbow_and_load_or_band_path',
          'pelvis_ribs_trunk_neck_balance_and_breathing',
          'scapular_motion_owned_range_tempo_finish_lowering_and_set_down'
        ),
        'faultCorrections', jsonb_build_object(
          'rib_flare_lean_or_rotation',
            'Reduce load or tension, shorten range, widen stance slightly, restore brace, and slow the repetition.',
          'shoulder_shrug_or_uncontrolled_path',
            'Reduce load or range, restore rack and grip, cue controlled scapular motion, and stop if symptoms persist.',
          'base_or_balance_change',
            'Stop, restore knee padding and stance, remove load, and choose a reviewed more-supported press if needed.',
          'anchor_grip_or_set_down_failure',
            'End the set, clear the station, replace unsafe equipment, and choose a controllable exact variant.'
        ),
        'demonstrationPlan', jsonb_build_array(
          'Show exact pressing arm, down knee, front foot, stance, implement, grip, rack, brace, vertical path, scapular motion, finish, lowering, side change, and set-down.',
          'Show one correct repetition and the rib-flare, lean, rotation, shrug, wrist, balance, range, anchor, and unsafe-set-down stop examples without exposing the athlete to load.'
        ),
        'groupManagement', jsonb_build_array(
          'One athlete per overhead press station.',
          'Keep overhead, load-drop, band-recoil, kneeling, and walking paths separated.',
          'Inspect the mat, implement, band, and anchor before use and after adjustment.',
          'Position the coach outside overhead drop, recoil, pickup, side-change, and set-down paths.'
        ),
        'modificationDecisionTree', jsonb_build_array(
          'Symptoms or unsafe equipment: stop and select a reviewed pain-free alternative.',
          'Position or path fails: reduce load or tension, shorten range, adjust stance or padding, or choose a more-supported non-overhead press.',
          'Control holds: change only one of load, tension, range, tempo, repetitions, or stance relationship at a time.'
        ),
        'doNotUseWhen', jsonb_build_array(
          'pain_numbness_dizziness_pressure_symptoms_or_apprehension',
          'uncontrolled_base_pelvis_ribs_trunk_scapula_elbow_wrist_or_load_path',
          'unsafe_mat_floor_overhead_clearance_implement_band_anchor_or_station',
          'unresolved_clinical_restriction'
        ),
        'qualityGate',
          'Count only repetitions with the exact side and implement contract, stable half-kneeling base, controlled rack and grip, stacked pelvis and ribs, no leg drive, controlled scapular motion and vertical press, owned pain-free finish, same-path lowering, and safe reset.',
        'immediateStop', jsonb_build_array(
          'symptoms_or_pressure_signs',
          'mat_floor_overhead_implement_band_anchor_or_station_failure',
          'balance_pelvis_rib_trunk_shoulder_elbow_wrist_or_load_control_loss',
          'missed_tempo_grinding_failed_finish_uncontrolled_lowering_or_unsafe_set_down'
        )
      ),
      support_operations_json = jsonb_build_object(
        'issueCategories', jsonb_build_array(
          'identity_or_variant_mismatch', 'equipment_anchor_or_station_safety',
          'symptoms_or_population_constraint', 'difficulty_or_dose_mismatch',
          'instruction_or_accessibility_gap', 'media_or_link_issue',
          'graph_or_substitution_issue'
        ),
        'supportEscalation', jsonb_build_object(
          'urgent',
            'Stop use for injury, overhead drop, band recoil event, anchor failure, fall, or unsafe station and route through the facility safety process.',
          'clinical',
            'Refer symptom, pregnancy/postpartum, surgery, or rehabilitation questions to the appropriate qualified professional.',
          'content',
            'Quarantine identity, instruction, scoring, relationship, equipment, or media disputes for coach and content review.'
        ),
        'retentionPolicy',
          'Retain exact variant, pressing arm, down knee, stance, implement, grip, rack, load or tension, anchor, range, tempo, dose, symptoms, stop reason, substitution, and reviewer history under facility policy.',
        'changeImpactPolicy',
          'Any identity, stance, implement, grip, rack, anchor, difficulty, range, tempo, equipment, stop-rule, relationship, or media change requires card-version increment, audit rerun, and renewed human review.',
        'selectionInputs', jsonb_build_array(
          'training_intent', 'symptoms_and_readiness',
          'pressing_arm_down_knee_stance_and_padding',
          'implement_grip_rack_load_or_band_anchor_and_tension',
          'range_tempo_and_available_time',
          'weekly_overhead_press_shoulder_triceps_trunk_grip_and_eccentric_budgets'
        )
      ),
      content_confidence = 86,
      scoring_confidence = 64,
      media_confidence = 50,
      approved_video_url = NULL,
      status = 'review',
      reviewed_by = NULL,
      approved_by = NULL,
      last_reviewed_at = NULL,
      provenance_json = provenance_json || jsonb_build_object(
        'identityMigration',
          '334_coaching_half_kneeling_single_arm_press_identity_consolidation',
        'structuralCompletionMigration', migration_key,
        'researchBatch', 'half-kneeling-single-arm-press-family-v1',
        'researchVersion', '2026-07-26.40',
        'difficultyModel', 'max_exercise_complexity_physical_difficulty',
        'exerciseDifficultyDimensions',
          jsonb_build_array('exercise_complexity', 'physical_difficulty'),
        'proficiencyClassificationScope', 'coaching_skill_library_only',
        'exerciseSkillLevelAllowed', FALSE,
        'legacyExactContractsSelectable', FALSE,
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

  CREATE TEMP TABLE hk_press_variant_seed (
    variant_key TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    implement_key TEXT NOT NULL,
    press_arm_relation TEXT NOT NULL,
    rack_contract TEXT NOT NULL,
    grip_contract TEXT NOT NULL,
    exercise_complexity INTEGER NOT NULL,
    physical_difficulty INTEGER NOT NULL,
    coordination_demand INTEGER NOT NULL,
    supervision_demand INTEGER NOT NULL,
    failure_consequence INTEGER NOT NULL,
    work_capacity_demand INTEGER NOT NULL,
    grip_demand INTEGER NOT NULL,
    spinal_loading INTEGER NOT NULL,
    eccentric_stress INTEGER NOT NULL,
    local_muscle_fatigue INTEGER NOT NULL,
    grip_fatigue INTEGER NOT NULL,
    technical_fatigue_sensitivity INTEGER NOT NULL,
    recovery_hours INTEGER NOT NULL,
    equipment_required TEXT[] NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO hk_press_variant_seed VALUES
    (
      'dumbbell-ipsilateral-to-down-knee-standard',
      'Half-Kneeling Single-Arm Press — Dumbbell, Press Arm Same as Down Knee',
      'dumbbell', 'ipsilateral_to_down_knee',
      'single_dumbbell_at_pressing_shoulder',
      'neutral_grip_wrist_stacked',
      44, 44, 50, 42, 44, 44, 46, 34, 38, 50, 44, 62, 36,
      ARRAY['dumbbell', 'mat']::TEXT[]
    ),
    (
      'dumbbell-contralateral-to-down-knee-standard',
      'Half-Kneeling Single-Arm Press — Dumbbell, Press Arm Opposite Down Knee',
      'dumbbell', 'contralateral_to_down_knee',
      'single_dumbbell_at_pressing_shoulder',
      'neutral_grip_wrist_stacked',
      46, 44, 54, 44, 44, 44, 46, 36, 38, 50, 44, 66, 36,
      ARRAY['dumbbell', 'mat']::TEXT[]
    ),
    (
      'kettlebell-ipsilateral-to-down-knee-standard',
      'Half-Kneeling Single-Arm Press — Kettlebell, Press Arm Same as Down Knee',
      'kettlebell', 'ipsilateral_to_down_knee',
      'single_kettlebell_rack_bell_behind_forearm',
      'handle_diagonal_wrist_neutral',
      46, 46, 54, 44, 46, 46, 50, 36, 40, 52, 48, 66, 36,
      ARRAY['kettlebell', 'mat']::TEXT[]
    ),
    (
      'kettlebell-contralateral-to-down-knee-standard',
      'Half-Kneeling Single-Arm Press — Kettlebell, Press Arm Opposite Down Knee',
      'kettlebell', 'contralateral_to_down_knee',
      'single_kettlebell_rack_bell_behind_forearm',
      'handle_diagonal_wrist_neutral',
      48, 46, 58, 46, 46, 46, 50, 38, 40, 52, 48, 70, 36,
      ARRAY['kettlebell', 'mat']::TEXT[]
    ),
    (
      'band-low-anchor-ipsilateral-to-down-knee-standard',
      'Half-Kneeling Single-Arm Press — Low Band, Press Arm Same as Down Knee',
      'bands', 'ipsilateral_to_down_knee',
      'single_handle_at_pressing_shoulder_from_low_fixed_anchor',
      'neutral_handle_grip_wrist_stacked',
      44, 38, 52, 46, 46, 42, 42, 28, 28, 46, 40, 64, 24,
      ARRAY['bands', 'rack', 'mat']::TEXT[]
    ),
    (
      'band-low-anchor-contralateral-to-down-knee-standard',
      'Half-Kneeling Single-Arm Press — Low Band, Press Arm Opposite Down Knee',
      'bands', 'contralateral_to_down_knee',
      'single_handle_at_pressing_shoulder_from_low_fixed_anchor',
      'neutral_handle_grip_wrist_stacked',
      46, 38, 56, 48, 46, 42, 42, 30, 28, 46, 40, 68, 24,
      ARRAY['bands', 'rack', 'mat']::TEXT[]
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
    ARRAY[
      seed.implement_key,
      seed.press_arm_relation,
      seed.rack_contract,
      seed.grip_contract,
      'half_kneeling',
      'single_arm_vertical_press',
      'strict_no_leg_drive',
      'standard_controlled_tempo'
    ]::TEXT[],
    jsonb_build_object(
      'exerciseComplexity', seed.exercise_complexity,
      'technicalComplexity', seed.exercise_complexity,
      'physicalDifficulty', seed.physical_difficulty,
      'absoluteLoadDemand', seed.physical_difficulty,
      'coordinationDemand', seed.coordination_demand,
      'supervisionDemand', seed.supervision_demand,
      'failureConsequence', seed.failure_consequence,
      'impact', 1,
      'workCapacityDemand', seed.work_capacity_demand,
      'baseOverallDifficulty',
        greatest(seed.exercise_complexity, seed.physical_difficulty),
      'overallFormula', 'max_exercise_complexity_physical_difficulty'
    ),
    jsonb_build_object(
      'pressingArm', 'declared_and_balanced_across_prescription',
      'downKnee', 'declared_opposite_or_same_relation_per_exact_variant',
      'pressArmRelationToDownKnee', seed.press_arm_relation,
      'stance',
        'one_padded_knee_down_opposite_foot_flat_stable_width_pelvis_level',
      'implement', seed.implement_key,
      'implementQuantity', 'one',
      'rackContract', seed.rack_contract,
      'gripContract', seed.grip_contract,
      'bandAnchor',
        CASE WHEN seed.implement_key = 'bands'
          THEN 'low_fixed_rated_anchor_aligned_with_declared_press_path'
          ELSE 'not_applicable'
        END,
      'tempoContract', 'two_second_controlled_lowering_smooth_press',
      'range', 'declared_owned_pain_free_overhead_range',
      'trunkContract', 'stacked_pelvis_ribs_no_lean_rotation_or_leg_drive',
      'completion', 'controlled_overhead_finish_same_path_return_and_safe_reset',
      'selectable', TRUE,
      'identityQuarantine', FALSE
    ),
    jsonb_build_object(
      'gripDemand', seed.grip_demand,
      'spinalLoading', seed.spinal_loading,
      'eccentricStress', seed.eccentric_stress,
      'landingContactsPerRep', 0,
      'externalLoadMethod',
        CASE WHEN seed.implement_key = 'bands'
          THEN 'declared_band_tension_anchor_distance_and_curve'
          ELSE 'declared_implement_mass'
        END,
      'loadingType',
        'unilateral_vertical_press_with_half_kneeling_anti_motion_base',
      'impactClass', 'no_impact',
      'primaryStress', jsonb_build_array(
        'pressing_deltoid_and_triceps_force',
        'scapular_and_rotator_cuff_control',
        'anti_extension_lateral_flexion_and_rotation_bracing',
        'half_kneeling_pelvic_and_hip_stabilization',
        'grip_rack_lowering_and_set_down_or_band_recoil_control'
      )
    ),
    jsonb_build_object(
      'localMuscleFatigue', seed.local_muscle_fatigue,
      'gripFatigue', seed.grip_fatigue,
      'technicalFatigueSensitivity', seed.technical_fatigue_sensitivity,
      'impactAccumulation', 1,
      'recoveryHours', seed.recovery_hours,
      'cumulativeBudgets', jsonb_build_array(
        'unilateral_overhead_press_volume',
        'shoulder_and_triceps_loading',
        'scapular_and_rotator_cuff_demand',
        'trunk_anti_motion_and_half_kneeling_stability',
        'grip_and_eccentric_lowering',
        'technical_and_overhead_failure_sensitivity'
      ),
      'fatigueSignals', jsonb_build_array(
        'stance_or_balance_change', 'rib_flare_lean_or_rotation',
        'scapular_shrug_or_path_change', 'elbow_or_wrist_stack_loss',
        'range_or_tempo_loss', 'grip_anchor_band_or_set_down_failure',
        'side_asymmetry_or_grinding'
      )
    ),
    jsonb_build_object(
      'trainingStimuli', jsonb_build_array(
        'unilateral_vertical_press_strength',
        'shoulder_and_triceps_capacity',
        'scapular_and_rotator_cuff_control',
        'half_kneeling_trunk_and_pelvic_control'
      ),
      'stimulusDose', jsonb_build_object(
        'primaryUnit', 'quality_repetitions_per_pressing_side',
        'variables',
          jsonb_build_array(
            'load_or_band_tension', 'range', 'tempo', 'repetitions', 'rest'
          )
      ),
      'weeklyExposure', jsonb_build_object(
        'typical', 'one_to_three_exposures',
        'minimumRecoveryHours', seed.recovery_hours
      ),
      'prerequisites', jsonb_build_array(
        'pain_free_half_kneeling_base',
        'pain_free_owned_single_arm_overhead_range',
        'stable_pelvis_ribs_trunk_scapula_elbow_and_wrist',
        'safe_load_or_band_anchor_handling'
      ),
      'completionCriteria', jsonb_build_array(
        'declared_quality_repetitions_completed_per_pressing_side',
        'all_quality_gates_held',
        'same_path_lowering_and_safe_reset_or_set_down'
      ),
      'sequenceRules', jsonb_build_array(
        'after_general_access_and_overhead_pattern_rehearsal',
        'before_material_overhead_press_shoulder_triceps_trunk_or_grip_fatigue',
        'after_freshness_sensitive_speed_power_or_sport_skill_work'
      ),
      'pairingCompatibility', jsonb_build_array(
        'lower_body_strength', 'low_fatigue_mobility',
        'noncompeting_pull_or_restore_work'
      ),
      'interferenceRules', jsonb_build_array(
        'avoid_before_fresh_overhead_throwing_or_contact_skill',
        'avoid_after_fatiguing_press_throw_carry_or_trunk_work',
        'do_not_pair_with_uncontrolled_grip_or_band_anchor_fatigue'
      ),
      'uncertaintyPolicy',
        'When symptoms, overhead range, stance, load, anchor, or fatigue are uncertain, stop and select a reviewed pain-free non-overhead or more-supported alternative.',
      'primaryPhase', 'capacity',
      'secondaryPhase', 'resilience',
      'difficultyModel', 'max_exercise_complexity_physical_difficulty',
      'proficiencyClassification', NULL
    ),
    'review'
  FROM hk_press_variant_seed seed
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
    CASE phase.profile_key
      WHEN 'capacity-strength'
        THEN 'Build unilateral vertical pressing strength while preserving the exact half-kneeling base, side relationship, rack, grip, pelvis, ribs, scapular motion, path, range, lowering, and equipment contract.'
      ELSE
        'Develop controlled overhead range and trunk-pelvis ownership with conservative resistance, full reset, and explicit stance, symptom, equipment, and quality gates.'
    END,
    CASE phase.profile_key WHEN 'capacity-strength' THEN 93 ELSE 87 END,
    CASE phase.profile_key WHEN 'capacity-strength' THEN 93 ELSE 89 END,
    jsonb_build_object(
      'unilateralOverheadPressStrength',
        CASE phase.profile_key WHEN 'capacity-strength' THEN 96 ELSE 72 END,
      'overheadRangeAndPositionControl',
        CASE phase.profile_key WHEN 'range-control' THEN 96 ELSE 82 END,
      'trunkAndPelvicControl', 90,
      'fatigueConditioning', 8
    ),
    jsonb_build_object(
      'sets', CASE phase.profile_key WHEN 'capacity-strength' THEN '2-4' ELSE '2-3' END,
      'repetitionsPerPressingSide',
        CASE phase.profile_key WHEN 'capacity-strength' THEN '4-10' ELSE '4-8' END,
      'restSeconds',
        CASE phase.profile_key WHEN 'capacity-strength' THEN '90-180' ELSE '60-120' END,
      'tempo', 'smooth_press_two_second_controlled_lowering',
      'effort',
        CASE phase.profile_key
          WHEN 'capacity-strength'
            THEN 'challenging_only_while_every_quality_gate_holds'
          ELSE 'light_to_moderate_with_range_and_position_priority'
        END,
      'pressArmRelationToDownKnee', seed.press_arm_relation,
      'implement', seed.implement_key,
      'quantity', 'one',
      'rack', seed.rack_contract,
      'grip', seed.grip_contract,
      'range', 'declared_owned_pain_free_overhead_range',
      'reset', 'same_path_return_full_reset_before_next_rep_or_side'
    ),
    'The exact variant is used; front foot and padded down knee stay planted; pelvis and ribs remain stacked; there is no leg drive, lean, or rotation; grip, wrist, elbow, scapular motion, press path, pain-free finish, controlled lowering, breathing, and equipment remain controlled.',
    ARRAY[
      'Stop for pain, pinching, numbness, dizziness, pressure symptoms, or apprehension.',
      'Stop for mat, floor, overhead-clearance, implement, band, anchor, recoil-path, or station movement or uncertainty.',
      'Stop for balance loss, pelvic shift, rib flare, trunk lean or rotation, shrugging, elbow flare, wrist collapse, or a range that cannot be controlled.',
      'Stop when tempo, breathing, load or tension control, overhead finish, lowering, side symmetry, reset, or set-down quality materially declines or grinding begins.'
    ]::TEXT[],
    'Declare pressing arm, down knee, front foot, stance, implement, grip, rack, load or band tension, anchor, range, tempo, repetitions, rest, side order, pickup, and set-down. Observe base, pelvis, ribs, trunk, scapula, elbow, wrist, path, finish, lowering, breathing, and equipment.',
    'Set the half kneel, rack and brace, press tall without leaning, lower to the same rack.',
    CASE phase.profile_key
      WHEN 'capacity-strength'
        THEN 'Greater unilateral deltoid and triceps strength with repeatable scapular, trunk, pelvic, and load control.'
      ELSE
        'Greater pain-free overhead range ownership, scapular control, trunk-pelvis stability, breathing, and positional confidence.'
    END,
    seed.equipment_required,
    jsonb_build_object(
      'surface', 'level_high_traction_floor_with_knee_padding',
      'participants', 'one_athlete_per_overhead_press_station',
      'setupSeconds',
        CASE WHEN seed.implement_key = 'bands' THEN 75 ELSE 45 END,
      'transitionSeconds', 20,
      'equipmentInspection',
        CASE WHEN seed.implement_key = 'bands'
          THEN 'before_session_after_anchor_or_tension_change_and_after_any_shift'
          ELSE 'before_session_after_load_change_and_after_any_drop'
        END,
      'overheadAndRecoilZone', 'clear_and_exclusive',
      'setDownZone', 'clear_and_exclusive',
      'coachPosition',
        'outside_overhead_drop_band_recoil_pickup_side_change_and_set_down_paths'
    ),
    ARRAY[]::UUID[],
    jsonb_build_object(
      'repetitionSeconds', 6,
      'resetSeconds', 4,
      'sideChangeSeconds', 20,
      'setDurationFormula',
        'per_side_repetitions_x_repetition_plus_reset_plus_side_change',
      'setupSeconds',
        CASE WHEN seed.implement_key = 'bands' THEN 75 ELSE 45 END,
      'durationIncludesSetup', TRUE
    ),
    jsonb_build_object(
      'regressFirst', jsonb_build_array(
        'reduce_load_or_band_tension', 'shorten_pain_free_range',
        'increase_knee_padding_or_stance_width',
        'reduce_repetitions', 'increase_rest',
        'select_reviewed_more_supported_non_overhead_press'
      ),
      'progressOneVariableAtATime', jsonb_build_array(
        'load_or_band_tension', 'range', 'tempo', 'repetitions',
        'press_arm_relationship_to_down_knee'
      ),
      'symptomRule',
        'stop_and_select_reviewed_pain_free_non_overhead_or_more_supported_alternative'
    ),
    jsonb_build_object(
      'required', jsonb_build_array(
        'variant', 'pressing_arm', 'down_knee', 'front_foot', 'stance',
        'implement', 'grip', 'rack', 'load_or_band_tension',
        'anchor_when_applicable', 'range', 'tempo',
        'quality_repetitions_per_side', 'rest', 'stop_reason'
      ),
      'optional', jsonb_build_array(
        'rate_of_perceived_effort', 'repetitions_in_reserve',
        'range_angle', 'rib_flare_or_trunk_error',
        'path_or_wrist_error', 'side_difference'
      ),
      'comparisonRule',
        'Compare only when pressing arm relationship, stance, implement, grip, rack, load or tension, anchor, range, tempo, floor, padding, and measurement method match.'
    ),
    jsonb_build_object(
      'athleteBeforeSet', jsonb_build_array(
        'Confirm side relationship, stance, implement, grip, rack, load or tension, anchor, range, tempo, repetitions, rest, side order, and set-down.',
        'Report pain, numbness, dizziness, pressure symptoms, apprehension, or equipment uncertainty.'
      ),
      'coachDuringSet', jsonb_build_array(
        'Watch base, pelvis, ribs, trunk, scapula, elbow, wrist, path, range, tempo, breathing, equipment, finish, lowering, and side change.',
        'Stop immediately on any symptom, overhead, anchor, equipment, station, or quality trigger.'
      ),
      'afterSet', jsonb_build_array(
        'Record quality repetitions per side, exact setup, load or tension, range, tempo, errors, symptoms, stop reason, and substitutions.',
        'Do not increase load, tension, range, or tempo after a stop trigger.'
      ),
      'supportEscalation',
        'Escalate symptoms, dropped load, anchor or band failure, identity mismatch, or inaccessible instruction through the documented support path.',
      'mediaFallback',
        'Use the written contract and a qualified live demonstration until an exact video is independently approved.'
    ),
    'review'
  FROM hk_press_variant_seed seed
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id = target_definition_id
   AND variant.variant_key = seed.variant_key
   AND variant.status <> 'archived'
  CROSS JOIN (
    VALUES
      ('capacity-strength', 'capacity', 'primary'),
      ('range-control', 'resilience', 'secondary')
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
        'band-low-anchor-ipsilateral-to-down-knee-standard',
        'dumbbell-ipsilateral-to-down-knee-standard',
        'progression', 88, ARRAY['load', 'stability', 'complexity']::TEXT[],
        'A controllable dumbbell preserves the side relationship and press action while replacing rising band tension and anchor management with freely loaded rack, path, lowering, and set-down demand.',
        '{"requiresStableBandVariant":true,"sameSideRelationship":true,"humanReviewRequired":true}'::JSONB
      ),
      (
        'dumbbell-ipsilateral-to-down-knee-standard',
        'band-low-anchor-ipsilateral-to-down-knee-standard',
        'regression', 88, ARRAY['load', 'stability', 'complexity']::TEXT[],
        'A light low-anchored band may reduce absolute load while preserving the side relationship, but anchor and recoil safety must be independently controlled.',
        '{"useLightBand":true,"anchorInspectionRequired":true,"humanReviewRequired":true}'::JSONB
      ),
      (
        'band-low-anchor-contralateral-to-down-knee-standard',
        'dumbbell-contralateral-to-down-knee-standard',
        'progression', 88, ARRAY['load', 'stability', 'complexity']::TEXT[],
        'A controllable dumbbell preserves the opposite-side relationship and press action while changing resistance curve, rack, lowering, and set-down demand.',
        '{"requiresStableBandVariant":true,"sameSideRelationship":true,"humanReviewRequired":true}'::JSONB
      ),
      (
        'dumbbell-contralateral-to-down-knee-standard',
        'band-low-anchor-contralateral-to-down-knee-standard',
        'regression', 88, ARRAY['load', 'stability', 'complexity']::TEXT[],
        'A light low-anchored band may reduce absolute load while preserving the opposite-side relationship, subject to exact anchor and recoil controls.',
        '{"useLightBand":true,"anchorInspectionRequired":true,"humanReviewRequired":true}'::JSONB
      ),
      (
        'dumbbell-ipsilateral-to-down-knee-standard',
        'kettlebell-ipsilateral-to-down-knee-standard',
        'equipment_equivalent', 90, ARRAY['implement', 'rack', 'stability']::TEXT[],
        'A kettlebell preserves stance and press side while its offset mass changes rack, wrist, forearm, path, and stabilization demand.',
        '{"sameSideRelationship":true,"loadMustBeRecalibrated":true,"humanReviewRequired":true}'::JSONB
      ),
      (
        'kettlebell-ipsilateral-to-down-knee-standard',
        'dumbbell-ipsilateral-to-down-knee-standard',
        'equipment_equivalent', 90, ARRAY['implement', 'rack', 'stability']::TEXT[],
        'A dumbbell preserves stance and press side while centering implement mass and changing rack, wrist, path, and stabilization demand.',
        '{"sameSideRelationship":true,"loadMustBeRecalibrated":true,"humanReviewRequired":true}'::JSONB
      ),
      (
        'dumbbell-contralateral-to-down-knee-standard',
        'kettlebell-contralateral-to-down-knee-standard',
        'equipment_equivalent', 90, ARRAY['implement', 'rack', 'stability']::TEXT[],
        'A kettlebell preserves the opposite-side relationship while changing rack and offset-mass stabilization demand.',
        '{"sameSideRelationship":true,"loadMustBeRecalibrated":true,"humanReviewRequired":true}'::JSONB
      ),
      (
        'kettlebell-contralateral-to-down-knee-standard',
        'dumbbell-contralateral-to-down-knee-standard',
        'equipment_equivalent', 90, ARRAY['implement', 'rack', 'stability']::TEXT[],
        'A dumbbell preserves the opposite-side relationship while changing rack and implement stability.',
        '{"sameSideRelationship":true,"loadMustBeRecalibrated":true,"humanReviewRequired":true}'::JSONB
      ),
      (
        'dumbbell-ipsilateral-to-down-knee-standard',
        'dumbbell-contralateral-to-down-knee-standard',
        'lateral_substitution', 92, ARRAY['laterality', 'trunk_demand']::TEXT[],
        'Changing which knee is down preserves the dumbbell press but changes the side-specific base and trunk-pelvis stabilization relationship.',
        '{"notAnAutomaticProgression":true,"sideRelationshipMustBeExplicit":true,"humanReviewRequired":true}'::JSONB
      ),
      (
        'dumbbell-contralateral-to-down-knee-standard',
        'dumbbell-ipsilateral-to-down-knee-standard',
        'lateral_substitution', 92, ARRAY['laterality', 'trunk_demand']::TEXT[],
        'Changing which knee is down preserves the dumbbell press but is not assumed easier or harder without individual assessment.',
        '{"notAnAutomaticRegression":true,"sideRelationshipMustBeExplicit":true,"humanReviewRequired":true}'::JSONB
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
  FROM hk_press_variant_seed seed
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id = target_definition_id
   AND variant.variant_key = seed.variant_key
   AND variant.status <> 'archived'
  CROSS JOIN LATERAL (
    VALUES
      (
        'technicalComplexity',
        seed.exercise_complexity,
        'Exercise complexity reflects the exact half-kneeling base, pressing-arm relationship, implement, grip, rack, anchor when applicable, brace, scapular motion, path, range, finish, lowering, side change, and set-down.'
      ),
      (
        'absoluteLoadDemand',
        seed.physical_difficulty,
        'Physical difficulty reflects implement mass or band tension, deltoid and triceps force, overhead range, eccentric lowering, trunk and pelvic bracing, grip, and equipment control for the exact variant.'
      ),
      (
        'baseOverallDifficulty',
        greatest(seed.exercise_complexity, seed.physical_difficulty),
        'Overall exercise difficulty is mechanically derived as the maximum of exercise complexity and physical difficulty; it is not a skill or proficiency level.'
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

  CREATE TEMP TABLE hk_press_source_seed (
    source_key TEXT PRIMARY KEY,
    source_url TEXT NOT NULL,
    source_title TEXT NOT NULL,
    source_publisher TEXT NOT NULL,
    source_kind TEXT NOT NULL,
    evidence_quality INTEGER NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO hk_press_source_seed VALUES
    (
      'nsca_foundations_single_arm_half_kneeling_press',
      'https://www.nsca.com/contentassets/8323553f698a466a98220b21d9eb9a65/foundationsoffitnessprogramming_201508.pdf',
      'Foundations of Fitness Programming',
      'National Strength and Conditioning Association',
      'professional_standard',
      86
    ),
    (
      'unilateral_dumbbell_press_core_emg',
      'https://pubmed.ncbi.nlm.nih.gov/21877146/',
      'Muscle activity of the core during bilateral, unilateral, seated and standing resistance exercise',
      'European Journal of Applied Physiology',
      'peer_reviewed_research',
      88
    ),
    (
      'dumbbell_kettlebell_overhead_press_emg',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC6033506/',
      'Stability of Resistance Training Implement Alters EMG Activity during the Overhead Press',
      'International Journal of Exercise Science',
      'peer_reviewed_research',
      84
    ),
    (
      'overhead_press_muscle_emg',
      'https://pubmed.ncbi.nlm.nih.gov/35936912/',
      'Front vs Back and Barbell vs Machine Overhead Press: An Electromyographic Analysis and Implications For Resistance Training',
      'Frontiers in Physiology',
      'peer_reviewed_research',
      86
    ),
    (
      'youtube_embed_help',
      'https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en',
      'Embed videos and playlists',
      'YouTube Help',
      'manufacturer_instruction',
      82
    );

  CREATE TEMP TABLE hk_press_evidence_seed (
    section_key TEXT PRIMARY KEY,
    source_key TEXT NOT NULL,
    claims_json JSONB NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO hk_press_evidence_seed VALUES
    (
      'identity', 'nsca_foundations_single_arm_half_kneeling_press',
      '["NSCA explicitly lists the Single-Arm Half-Kneeling Shoulder Press as a press exercise.","The stable identity is a strict one-arm vertical press from half kneeling; dumbbell, kettlebell, and low-anchored band are exact implement variants, while landmine, Pallof, seated, standing, and push-press tasks remain separate."]'::JSONB
    ),
    (
      'taxonomy', 'nsca_foundations_single_arm_half_kneeling_press',
      '["NSCA classifies the named movement under pressing patterns.","Declare half-kneeling contacts, pressing-arm relationship to the down knee, implement, grip, rack, strict vertical path, range, controlled return, and no leg drive."]'::JSONB
    ),
    (
      'anatomy', 'overhead_press_muscle_emg',
      '["Overhead pressing recruits deltoid, triceps, trapezius, pectoralis major, and stabilizing musculature, with activation affected by press configuration.","The card declares glenohumeral, scapulothoracic, elbow, wrist, trunk, pelvis, hip, knee, and foot roles plus scapular-plane motion and multiplanar stabilization."]'::JSONB
    ),
    (
      'biomechanics', 'unilateral_dumbbell_press_core_emg',
      '["Unilateral versus bilateral and standing versus seated dumbbell shoulder presses alter superficial core muscle activation.","Half-kneeling side-relationship demands are a conservative programming inference, so exact stance, pelvis, ribs, trunk, scapula, elbow, wrist, press path, range, and lowering must be observed and not treated as validated superiority."]'::JSONB
    ),
    (
      'difficulty', 'dumbbell_kettlebell_overhead_press_emg',
      '["Dumbbell and kettlebell center-of-mass and stability differences can change overhead-press muscle activity and control demands.","Score exercise complexity and physical difficulty for each exact implement and stance-side contract, derive overall as their maximum, and assign no exercise skill level."]'::JSONB
    ),
    (
      'load_fatigue_recovery', 'overhead_press_muscle_emg',
      '["Overhead press configuration changes the stimulus to shoulder muscles.","Budget unilateral press volume, deltoid and triceps load, scapular and rotator-cuff demand, trunk anti-motion, grip, eccentric lowering, technical sensitivity, and recovery without planned impact."]'::JSONB
    ),
    (
      'constraints', 'nsca_foundations_single_arm_half_kneeling_press',
      '["The named exercise requires both a half-kneeling base and a single-arm shoulder press.","Declare knee padding, floor, overhead clearance, stance, side relationship, implement, grip, rack, load or band tension, anchor and recoil when applicable, range, pickup, set-down, and coach sightline."]'::JSONB
    ),
    (
      'dosage', 'unilateral_dumbbell_press_core_emg',
      '["The study standardized repetitions and relative load to compare press conditions, supporting the need for repeatable setup when tracking dose.","Use side-balanced quality sets and enough rest to preserve the exact base, rack, brace, scapular motion, path, range, finish, lowering, breathing, and equipment control."]'::JSONB
    ),
    (
      'instructions', 'nsca_foundations_single_arm_half_kneeling_press',
      '["NSCA names the single-arm half-kneeling shoulder press as a distinct press exercise.","Cue set the half kneel, rack and brace, press tall without leaning or leg drive, reach owned range, lower to the same rack, and reset."]'::JSONB
    ),
    (
      'safety_stop_rules', 'overhead_press_muscle_emg',
      '["Overhead press variations change muscle demands and require configuration-specific technique control.","Stop for symptoms, balance or base loss, rib flare, lean or rotation, shrugging, elbow or wrist loss, uncontrolled path or lowering, grinding, dropped load, band or anchor failure, or unsafe set-down."]'::JSONB
    ),
    (
      'programming', 'unilateral_dumbbell_press_core_emg',
      '["Unilateral shoulder pressing changes core activation compared with bilateral conditions.","Use strength or controlled-range delivery before material overhead, shoulder, triceps, trunk, grip, throwing, or contact-skill fatigue; do not infer that either knee relationship is universally easier."]'::JSONB
    ),
    (
      'athlete_support', 'nsca_foundations_single_arm_half_kneeling_press',
      '["The exercise name communicates the half-kneeling base and unilateral shoulder press.","Expose pressing arm, down knee, stance, implement, grip, rack, load or tension, anchor, range, tempo, dose, rest, sensations, and stop signal without assigning an exercise skill level."]'::JSONB
    ),
    (
      'coach_support', 'unilateral_dumbbell_press_core_emg',
      '["Press position and unilateral loading affect trunk muscle demand.","Coach support should expose and observe side relationship, base, pelvis, ribs, trunk, scapula, elbow, wrist, path, range, tempo, dose, fatigue, symptoms, and shutdown actions."]'::JSONB
    ),
    (
      'accessibility', 'nsca_foundations_single_arm_half_kneeling_press',
      '["The named exercise provides a specific posture and press pattern but does not require a universal load or range.","Options include lighter load or band tension, shorter pain-free range, more knee padding, fewer repetitions, longer rest, a reviewed non-overhead substitution, and nonvideo instruction."]'::JSONB
    ),
    (
      'alternates', 'dumbbell_kettlebell_overhead_press_emg',
      '["Changing between dumbbell and kettlebell changes implement stability while preserving the overhead press when all other identity features remain declared.","Landmine fixed arcs, horizontal Pallof presses, standing or seated bases, bilateral presses, and push presses change path, base, laterality, or leg-drive contract and remain separate identities."]'::JSONB
    ),
    (
      'media', 'youtube_embed_help',
      '["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","Five candidates have healthy oEmbed metadata only; full viewing, exact variant, safety, captions, accessibility, reviewer identity, and approval remain unresolved."]'::JSONB
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
  FROM hk_press_evidence_seed evidence
  JOIN hk_press_source_seed source
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
    variant.id,
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
        NULL,
        '2WoOrh3dqss',
        'https://www.youtube.com/watch?v=2WoOrh3dqss',
        'Single Arm Half Kneeling Dumbbell Press - OPEX Exercise Library',
        'OPEX Fitness',
        'Legacy generic-family candidate rechecked through current YouTube oEmbed',
        'Current title and oEmbed response are healthy. The title does not establish the pressing-arm relationship to the down knee or full exact contract, so the candidate remains unassigned pending full viewing and review.'
      ),
      (
        NULL,
        '4DUIY95jX6Y',
        'https://www.youtube.com/watch?v=4DUIY95jX6Y',
        'Half Kneeling Single Arm Dumbbell Press',
        'Functional Bodybuilding',
        'Legacy dumbbell candidate rechecked through current YouTube oEmbed',
        'Current metadata suggests the family and implement only. Full viewing, side relationship, grip, rack, range, tempo, safety, captions, accessibility, reviewer identity, and approval remain pending.'
      ),
      (
        NULL,
        '-UZpZ4Vvc28',
        'https://www.youtube.com/watch?v=-UZpZ4Vvc28',
        'Half-Kneeling Single-Arm Dumbbell Press, Neutral Grip | Build Shoulder Stability',
        'Kelly Mac Mobility',
        'Legacy dumbbell neutral-grip candidate rechecked through current YouTube oEmbed',
        'Current metadata suggests a neutral-grip dumbbell family candidate. Exact side relationship and all full-video human review gates remain unresolved.'
      ),
      (
        NULL,
        'Qf_czCGqu-8',
        'https://www.youtube.com/watch?v=Qf_czCGqu-8',
        'Half Kneeling Kettlebell Press - OPEX Exercise Library',
        'OPEX Fitness',
        'Legacy kettlebell candidate rechecked through current YouTube oEmbed',
        'Current metadata suggests the kettlebell family only. Exact rack, grip, side relationship, range, tempo, safety, captions, accessibility, reviewer identity, and approval remain pending.'
      ),
      (
        NULL,
        'EBB2-A5JRKk',
        'https://www.youtube.com/watch?v=EBB2-A5JRKk',
        'Banded 1/2 Kneeling Single Arm Overhead Press',
        'RADCENTRE',
        'Legacy band candidate rechecked through current YouTube oEmbed',
        'Current metadata establishes a banded one-arm half-kneeling overhead press only. Exact anchor, recoil path, side relationship, grip, range, tempo, safety, captions, accessibility, reviewer identity, and approval remain pending.'
      )
  ) AS media(
    variant_key, video_id, url, title, channel_name, source_query, notes
  )
  LEFT JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id = target_definition_id
   AND variant.variant_key = media.variant_key
   AND variant.status <> 'archived'
  ON CONFLICT (definition_id, reviewed_card_version, video_id) DO UPDATE SET
    variant_id = EXCLUDED.variant_id,
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
        'Half-Kneeling Single-Arm Press', 'same_identity',
        'Stable broad identity for a strict unilateral vertical press from an exact half-kneeling base.',
        '{"base":"half_kneeling","press":"single_arm_vertical","legDrive":false}'::JSONB
      ),
      (
        'Half-Kneeling Single-Arm Dumbbell Press', 'same_identity',
        'A dumbbell changes rack, grip, load, path, and set-down within the same strict half-kneeling one-arm vertical press.',
        '{"implement":"dumbbell","quantity":"one","exactVariantRequired":true}'::JSONB
      ),
      (
        'Half-Kneeling Kettlebell Press', 'same_identity',
        'A kettlebell changes center of mass, rack, grip, wrist, and stabilization within the same press identity.',
        '{"implement":"kettlebell","quantity":"one","exactVariantRequired":true}'::JSONB
      ),
      (
        'Half-Kneeling Band Overhead Press', 'same_identity',
        'A low-anchored band changes resistance curve, anchor, recoil, handle, and station safety while preserving the strict one-arm vertical press.',
        '{"implement":"bands","anchor":"low_fixed","exactVariantRequired":true}'::JSONB
      ),
      (
        'Press Arm Same as Down Knee', 'new_variant',
        'The pressing arm and down knee are on the same side; this side-specific base relationship must be explicit.',
        '{"pressArmRelationToDownKnee":"ipsilateral"}'::JSONB
      ),
      (
        'Press Arm Opposite Down Knee', 'new_variant',
        'The pressing arm and down knee are on opposite sides; this changes trunk-pelvis stabilization without creating a skill level.',
        '{"pressArmRelationToDownKnee":"contralateral"}'::JSONB
      ),
      (
        'Slow-Eccentric Half-Kneeling Single-Arm Press', 'new_variant',
        'A declared slower lowering phase changes eccentric stress, set duration, fatigue, and recovery within the same identity.',
        '{"tempo":"slow_eccentric","exactSecondsRequired":true}'::JSONB
      ),
      (
        'Bottom-Up Kettlebell Half-Kneeling Press', 'new_variant',
        'Bottom-up orientation materially increases grip and implement-stability demand but preserves base and press action.',
        '{"implement":"kettlebell","orientation":"bottom_up","reviewRequired":true}'::JSONB
      ),
      (
        'Half-Kneeling One-Arm Landmine Press', 'new_definition',
        'A landmine uses a fixed angled arc and different equipment and overhead-clearance contract rather than a free vertical press.',
        '{"path":"fixed_diagonal_arc","implement":"landmine"}'::JSONB
      ),
      (
        'Half-Kneeling Pallof Press', 'new_definition',
        'A horizontal anti-rotation press is primarily a trunk anti-motion task and not a vertical shoulder press.',
        '{"path":"horizontal","primaryIntent":"anti_rotation"}'::JSONB
      ),
      (
        'Standing Single-Arm Overhead Press', 'new_definition',
        'Standing changes the support base, lower-limb contribution, balance, logistics, and failure contract.',
        '{"base":"standing"}'::JSONB
      ),
      (
        'Half-Kneeling Single-Arm Push Press', 'new_definition',
        'Deliberate hip or leg drive changes the force strategy, intent, coordination, and loading potential.',
        '{"legDrive":true,"intent":"ballistic_or_power"}'::JSONB
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
  SET technical = CASE profile.exercise_id
        WHEN 190 THEN 4.4
        WHEN 439 THEN 4.4
        WHEN 492 THEN 4.6
        WHEN 1065 THEN 4.4
        ELSE 4.4
      END,
      load = CASE profile.exercise_id
        WHEN 190 THEN 4.4
        WHEN 439 THEN 4.4
        WHEN 492 THEN 4.6
        WHEN 1065 THEN 3.8
        ELSE 4.4
      END,
      overall = greatest(
        CASE profile.exercise_id
          WHEN 190 THEN 4.4
          WHEN 439 THEN 4.4
          WHEN 492 THEN 4.6
          WHEN 1065 THEN 4.4
          ELSE 4.4
        END,
        CASE profile.exercise_id
          WHEN 190 THEN 4.4
          WHEN 439 THEN 4.4
          WHEN 492 THEN 4.6
          WHEN 1065 THEN 3.8
          ELSE 4.4
        END
      ),
      notes =
        'Candidate reassessment maps each legacy source only to the closest named implement contract; exact side relationship and independent calibration remain required.',
      updated_at = now()
  WHERE profile.exercise_id IN (
    SELECT legacy_exercise_id
    FROM coaching.exercise_definition_source_v1
    WHERE definition_id = target_definition_id
  );

  UPDATE coaching.exercise_score_v1 score
  SET technical_complexity = CASE score.exercise_id
        WHEN 190 THEN 44
        WHEN 439 THEN 44
        WHEN 492 THEN 46
        WHEN 1065 THEN 44
        ELSE 44
      END,
      absolute_load_demand = CASE score.exercise_id
        WHEN 190 THEN 44
        WHEN 439 THEN 44
        WHEN 492 THEN 46
        WHEN 1065 THEN 38
        ELSE 44
      END,
      coordination_demand = CASE score.exercise_id
        WHEN 492 THEN 54
        WHEN 1065 THEN 52
        ELSE 50
      END,
      impact = 1,
      supervision_demand = CASE score.exercise_id
        WHEN 1065 THEN 46
        ELSE 42
      END,
      base_overall_difficulty = greatest(
        CASE score.exercise_id
          WHEN 190 THEN 44
          WHEN 439 THEN 44
          WHEN 492 THEN 46
          WHEN 1065 THEN 44
          ELSE 44
        END,
        CASE score.exercise_id
          WHEN 190 THEN 44
          WHEN 439 THEN 44
          WHEN 492 THEN 46
          WHEN 1065 THEN 38
          ELSE 44
        END
      ),
      legacy_scores = score.legacy_scores || jsonb_build_object(
        'candidateReassessment', migration_key,
        'difficultyModel', 'max_exercise_complexity_physical_difficulty',
        'sourceIdentity', 'half_kneeling_single_arm_vertical_press',
        'legacyExactContractSelectable', FALSE,
        'exerciseSkillLevelAllowed', FALSE,
        'independentCalibrationRequired', TRUE
      ),
      migration_confidence = 64,
      human_review_status = 'queued',
      reviewed_by = NULL,
      reviewed_at = NULL,
      review_notes =
        'Research-backed candidate reassessment only; exact side relationship and independent calibration remain required.',
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
      movement_family = 'Half-kneeling single-arm vertical press',
      primary_phase_key = 'capacity',
      phase_subrole = 'upper_body_push_strength',
      primary_order_slot = 'half_kneeling_single_arm_vertical_press',
      card_summary =
        'Strict one-arm vertical press from a declared half-kneeling base with exact implement, side relationship, grip, rack, load or tension, range, tempo, lowering, and set-down contracts.',
      description =
        'Set one padded knee down and the opposite foot flat, rack one exact implement, brace the pelvis and ribs, press vertically without leg drive or leaning, and lower under control.',
      instructions =
        'Declare pressing arm, down knee, stance, implement, grip, rack, load or tension, anchor, range, tempo, repetitions, rest, side order, pickup, and set-down. Keep the base stable, press tall without rib flare or rotation, and return to the same rack.',
      coach_language =
        'Observe base, pelvis, ribs, trunk, scapula, elbow, wrist, path, range, tempo, breathing, implement or anchor, overhead finish, lowering, side change, and set-down. Stop on symptoms, equipment failure, position loss, path loss, or fatigue.',
      athlete_language =
        'Set the half kneel, rack and brace, press tall without leaning, lower to the same rack.',
      scalable_variables = ARRAY[
        'pressing_arm', 'down_knee', 'stance', 'knee_padding',
        'implement', 'grip', 'rack', 'load', 'band_tension',
        'anchor', 'range', 'tempo', 'repetitions', 'rest'
      ]::TEXT[],
      movement_requirements = jsonb_build_object(
        'base', 'declared_half_kneeling_with_padded_down_knee_and_front_foot_flat',
        'laterality', 'declared_pressing_arm_relationship_to_down_knee',
        'primaryAction', 'strict_single_arm_vertical_press_and_controlled_return',
        'legDrive', FALSE,
        'implementGripRackRangeTempo', 'exact_variant_required',
        'completion', 'owned_overhead_finish_same_path_return_and_safe_reset',
        'selectableExactVariant', FALSE
      ),
      coaching_execution = jsonb_build_object(
        'setup', jsonb_build_array(
          'Declare exact pressing arm, down knee, stance, implement, grip, rack, load or tension, anchor, range, tempo, dose, rest, side order, and set-down.',
          'Inspect mat, floor, overhead clearance, implement, band, anchor, traffic, recoil path, and coach sightline.'
        ),
        'quality_gate', jsonb_build_array(
          'Front foot and down knee remain stable with pelvis and ribs stacked.',
          'No leg drive, lean, rotation, uncontrolled shrug, elbow flare, or wrist collapse.',
          'The athlete owns the overhead range, lowers to the same rack, resets, and changes sides or sets down safely.'
        ),
        'stop_signs', jsonb_build_array(
          'Pain, neurologic symptoms, pressure symptoms, dizziness, or apprehension',
          'Mat, floor, overhead, implement, band, anchor, recoil path, station, or set-down failure',
          'Balance, pelvis, rib, trunk, scapula, elbow, wrist, range, tempo, breathing, path, lowering, or load-control failure'
        )
      ),
      programming_logic = jsonb_build_object(
        'difficulty_model',
          'max_exercise_complexity_physical_difficulty',
        'exercise_skill_level', NULL,
        'identity_rule',
          'select_exact_half_kneeling_side_relationship_implement_grip_rack_load_anchor_range_and_tempo_contract',
        'fatigue_rule',
          'place_before_material_overhead_press_shoulder_triceps_trunk_grip_throwing_or_contact_skill_fatigue',
        'substitution_rule',
          'never_silently_change_base_press_path_laterality_leg_drive_anchor_or_primary_action',
        'legacy_source_rule',
          'incomplete_exact_contract_sources_are_nonselectable'
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
        '334_coaching_half_kneeling_single_arm_press_identity_consolidation',
      'completenessMigration', migration_key,
      'researchBatch', 'half-kneeling-single-arm-press-family-v1',
      'difficultyFormula',
        'max_exercise_complexity_physical_difficulty',
      'exerciseDifficultyDimensions',
        jsonb_build_array('exercise_complexity', 'physical_difficulty'),
      'proficiencyClassificationScope', 'coaching_skill_library_only',
      'exerciseSkillLevelAllowed', FALSE,
      'legacySourcesSelectable', FALSE,
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
        'message',
          'Progression, regression, and substitution edges remain review-only.'
      ),
      jsonb_build_object(
        'code', 'CARD-MEDIA-01',
        'category', 'media',
        'message',
          'Exact-variant full-video, safety, caption, accessibility, and approval review remains required.'
      ),
      jsonb_build_object(
        'code', 'CARD-PUBLISH-01',
        'category', 'publication',
        'message',
          'Independent content and publication review remains required.'
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
