-- Complete the candidate-only front-foot-elevated split-squat family after
-- migration 332 consolidates implement-labeled definitions.
--
-- Exercise difficulty is exercise complexity plus physical difficulty, with
-- overall derived as their maximum. Exercise cards receive no skill or
-- proficiency level. Evidence, media, graph, calibration, and publication
-- remain candidate/review-only. IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '333_coaching_front_foot_elevated_split_squat_family_completion';
  target_definition_id UUID;
  facility BIGINT;
  target_card_version INTEGER;
  protected_records INTEGER;
  unexpected_variants INTEGER;
BEGIN
  SELECT id, facility_id
  INTO target_definition_id, facility
  FROM coaching.exercise_definition_v1
  WHERE slug = 'front-foot-elevated-split-squat'
    AND status <> 'archived';

  IF target_definition_id IS NULL THEN
    RAISE EXCEPTION
      'Front-foot-elevated split-squat completion requires the active survivor definition';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_definition_v1
    WHERE slug IN (
      'front-foot-elevated-dumbbell-split-squat',
      'front-foot-elevated-sandbag-split-squat-strength'
    )
      AND status <> 'archived'
  ) THEN
    RAISE EXCEPTION
      'Front-foot-elevated split-squat completion requires migration 332 first';
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
      'Front-foot-elevated split-squat completion refused to override % protected records',
      protected_records;
  END IF;

  SELECT COUNT(*)
  INTO unexpected_variants
  FROM coaching.exercise_variant_v1
  WHERE definition_id = target_definition_id
    AND status <> 'archived'
    AND variant_key NOT IN (
      'baseline',
      'bodyweight-standard-tempo',
      'supported-bodyweight-standard-tempo',
      'two-dumbbell-suitcase-standard-tempo',
      'single-dumbbell-contralateral-standard-tempo',
      'single-dumbbell-ipsilateral-standard-tempo',
      'sandbag-front-hold-standard-tempo'
    );

  IF unexpected_variants > 0 THEN
    RAISE EXCEPTION
      'Front-foot-elevated split-squat completion found % unexpected active variants',
      unexpected_variants;
  END IF;

  UPDATE coaching.exercise_variant_v1
  SET variant_key = 'legacy-generic-front-foot-elevated-source-1389',
      status = 'archived',
      requirements_json = requirements_json || jsonb_build_object(
        'selectable', FALSE,
        'identityQuarantine', TRUE,
        'quarantineReason',
          'The generic source does not declare exact platform height, stance, support, implement, quantity, hold, load, range, tempo, side order, pickup, or set-down.'
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
      canonical_name = 'Front-Foot-Elevated Split Squat',
      display_name = 'Front-Foot-Elevated Split Squat',
      description =
        'In a stationary side-specific split stance, place the whole lead foot on a stable declared platform and keep the rear forefoot on the floor. Brace, lower through the exact pain-free range while the lead knee tracks with the foot and the pelvis and trunk remain controlled, then drive through the whole lead foot to a balanced split-stance finish and reset safely.',
      family_key = 'front_foot_elevated_stationary_split_squat',
      movement_patterns = ARRAY['squat', 'brace']::TEXT[],
      body_regions = ARRAY[
        'foot', 'ankle', 'knee', 'hip', 'pelvis', 'hamstring',
        'core', 'spine', 'shoulder', 'elbow', 'wrist', 'hand'
      ]::TEXT[],
      required_equipment = ARRAY['step']::TEXT[],
      optional_equipment = ARRAY[
        'box', 'platform', 'dumbbell', 'sandbag',
        'rack', 'bench', 'wall'
      ]::TEXT[],
      environment_json = jsonb_build_object(
        'surface', 'level_high_traction_floor_with_declared_footwear_policy',
        'platform',
          'stable_nonslip_exact_height_whole_lead_foot_supported_no_edge_overhang',
        'station',
          'exclusive_clear_platform_rear_foot_load_pickup_and_set_down_zone',
        'support',
          'declared_stable_rack_bench_or_wall_if_supported_variant_is_selected',
        'implement',
          'declared_exact_type_quantity_load_position_pickup_and_set_down',
        'traffic',
          'people_loose_loads_and_unused_equipment_outside_station',
        'lighting',
          'both_feet_knees_hips_pelvis_trunk_support_and_load_visible',
        'coachSightline',
          'front_oblique_or_side_view_outside_fall_load_and_set_down_paths'
      ),
      population_json = jsonb_build_object(
        'readiness', jsonb_build_array(
          'pain_free_stationary_split_stance_on_both_sides',
          'whole_lead_foot_fits_and_stays_stable_on_declared_platform',
          'can_control_lead_knee_pelvis_trunk_and_balance_through_owned_range',
          'can_follow_side_stance_range_tempo_repetition_rest_and_stop_instructions',
          'can_control_declared_support_or_load_pickup_hold_and_set_down'
        ),
        'contraindicationFlags', jsonb_build_array(
          'current_foot_ankle_knee_hip_groin_back_shoulder_wrist_or_hand_pain',
          'numbness_dizziness_pressure_symptoms_or_uncontrolled_breath_holding',
          'unsafe_platform_support_floor_footwear_implement_or_station',
          'uncontrolled_balance_knee_tracking_pelvis_trunk_range_or_load',
          'unassessed_recent_injury_surgery_pregnancy_postpartum_or_rehabilitation_restriction'
        ),
        'supervision',
          'Direct observation until platform fit, stance, rear-foot contact, knee tracking, pelvis, trunk, range, support or load, finish, side change, and set-down are repeatable.',
        'selectionBoundary',
          'Select exact side, platform height, stance, support, implement, quantity, load position, load, range, tempo, repetitions, rest, pickup, side change, and set-down from current control; exercise cards do not carry skill levels.',
        'clinicalBoundary',
          'Pain, neurologic signs, pressure symptoms, recent injury or surgery, pregnancy/postpartum concerns, or rehabilitation restrictions require individualized qualified guidance.'
      ),
      anatomy_json = jsonb_build_object(
        'primaryMuscles', jsonb_build_array(
          'lead_quadriceps', 'lead_gluteus_maximus',
          'lead_adductor_magnus'
        ),
        'secondaryMuscles', jsonb_build_array(
          'gluteus_medius_and_minimus', 'hamstrings', 'adductors',
          'gastrocnemius_and_soleus', 'hip_flexors',
          'abdominal_wall_and_spinal_stabilizers',
          'optional_forearm_and_hand_flexors'
        ),
        'stabilizers', jsonb_build_array(
          'foot_and_ankle_stabilizers', 'hip_abductors_and_adductors',
          'abdominal_wall', 'spinal_stabilizers',
          'optional_scapular_grip_and_forearm_stabilizers'
        ),
        'joints', jsonb_build_array(
          'lead_and_rear_foot', 'lead_and_rear_ankle',
          'lead_and_rear_knee', 'lead_and_rear_hip',
          'pelvis', 'spine',
          'optional_shoulder_elbow_wrist_and_hand'
        ),
        'jointActions', jsonb_build_array(
          'lead_ankle_dorsiflexion_and_plantarflexion',
          'lead_knee_flexion_and_extension',
          'lead_hip_flexion_and_extension',
          'rear_hip_extension_and_flexion',
          'pelvic_and_spinal_stabilization',
          'optional_scapular_and_grip_stabilization'
        ),
        'planes', jsonb_build_array(
          'sagittal', 'frontal_and_transverse_stabilization'
        ),
        'laterality',
          'asymmetrical_side_specific_with_bilateral_support_and_lead_leg_bias',
        'primaryActions', jsonb_build_array(
          'establish_declared_side_specific_split_stance',
          'secure_whole_lead_foot_on_platform',
          'brace_and_control_declared_support_or_load',
          'descend_through_owned_lead_hip_knee_and_ankle_range',
          'maintain_rear_foot_contact_and_pelvic_control',
          'extend_lead_hip_and_knee_to_balanced_finish',
          'reset_change_sides_or_set_down_safely'
        )
      ),
      athlete_support_json = jsonb_build_object(
        'whyItMatters',
          'This task builds side-specific leg strength and controlled ankle, knee, and hip range while you organize both feet, balance, pelvis, trunk, breathing, and any exact support or load.',
        'beforeYouStart', jsonb_build_array(
          'Confirm lead side, platform, stance, support or implement, load, range, tempo, repetitions, rest, side order, and set-down.',
          'Check that the whole front foot fits securely and the rear-foot and load zones are clear.',
          'Use only a pain-free range that keeps your knee, pelvis, trunk, balance, and load controlled.'
        ),
        'primaryCue',
          'Whole front foot, set the split, lower under control, knee tracks, drive through the platform, finish balanced.',
        'expectedSensations', jsonb_build_array(
          'lead_quadriceps_and_glute_effort',
          'controlled_lead_ankle_knee_and_hip_range',
          'balance_and_trunk_bracing',
          'optional_grip_and_front_load_effort'
        ),
        'unexpectedSensations', jsonb_build_array(
          'sharp_pain_or_joint_pinching', 'numbness_or_dizziness',
          'pressure_symptoms', 'uncontrolled_knee_back_balance_or_grip_strain'
        ),
        'selfChecks', jsonb_build_array(
          'My whole front foot stays supported without platform movement.',
          'My lead knee tracks with my foot and my pelvis and trunk stay controlled.',
          'I stop before range, balance, breathing, support, or load changes.',
          'I finish balanced and can change sides or set down safely.'
        ),
        'painGuidance',
          'Stop immediately for pain, pinching, numbness, dizziness, pressure symptoms, platform or foot movement, balance loss, grip or load loss, or a knee, pelvis, trunk, or range position you cannot restore.',
        'accessibility', jsonb_build_array(
          'lower_platform', 'shorter_pain_free_range',
          'stable_hand_support', 'bodyweight_loading',
          'fewer_repetitions', 'longer_rest',
          'plain_text_audio_tactile_visual_or_live_demonstration'
        ),
        'mediaAlternatives',
          'Use the written exact-variant contract and a qualified live demonstration until a matching video is independently reviewed and approved.'
      ),
      coach_support_json = jsonb_build_object(
        'observationChecklist', jsonb_build_array(
          'platform_height_stability_traction_and_whole_foot_fit',
          'lead_side_stance_width_length_and_rear_foot_contact',
          'lead_knee_tracking_and_foot_pressure',
          'pelvis_trunk_balance_and_breathing',
          'support_or_implement_quantity_load_position_and_path',
          'owned_range_tempo_finish_side_change_and_set_down'
        ),
        'faultCorrections', jsonb_build_object(
          'foot_or_platform_instability',
            'Stop, lower or replace the platform, restore full-foot fit, and clear the station.',
          'knee_or_balance_loss',
            'Add stable support, reduce platform height or range, adjust stance, and remove load.',
          'pelvis_or_trunk_change',
            'Shorten range, reduce load, restore stance and brace, and slow the repetition.',
          'load_or_set_down_failure',
            'End the set, clear the station, and choose bodyweight or a controllable implement and load.'
        ),
        'demonstrationPlan', jsonb_build_array(
          'Show exact platform, whole-foot fit, lead side, stance, rear-foot contact, support or implement, brace, descent, range, knee path, ascent, finish, side change, and set-down.',
          'Show one correct repetition and the foot-edge, knee-collapse, balance, trunk-change, range, tempo, and unsafe-set-down stop examples without exposing the athlete to load.'
        ),
        'groupManagement', jsonb_build_array(
          'One athlete per platform station.',
          'Keep platforms, loads, supports, and walking paths separated.',
          'Inspect the platform and support before use and after adjustment.',
          'Position the coach outside fall, pickup, side-change, and set-down paths.'
        ),
        'modificationDecisionTree', jsonb_build_array(
          'Symptoms or unsafe equipment: stop and select a reviewed pain-free alternative.',
          'Balance or position fails: add support, reduce platform height or range, remove load, or adjust stance.',
          'Control holds: change only one of support, load, range, tempo, platform height, or dose at a time.'
        ),
        'doNotUseWhen', jsonb_build_array(
          'pain_numbness_dizziness_pressure_symptoms_or_apprehension',
          'uncontrolled_foot_knee_pelvis_trunk_balance_support_or_load',
          'unsafe_platform_support_floor_footwear_implement_or_station',
          'unresolved_clinical_restriction'
        ),
        'qualityGate',
          'Count only repetitions with the exact platform and side contract, whole-foot support, stationary split stance, stable rear foot, controlled knee path, pelvis and trunk, owned range and tempo, lead-leg-biased ascent, balanced finish, and safe reset.',
        'immediateStop', jsonb_build_array(
          'symptoms_or_pressure_signs',
          'platform_foot_support_implement_or_station_failure',
          'balance_knee_pelvis_trunk_range_or_load_control_loss',
          'missed_tempo_grinding_failed_finish_or_unsafe_side_change_or_set_down'
        )
      ),
      support_operations_json = jsonb_build_object(
        'issueCategories', jsonb_build_array(
          'identity_or_variant_mismatch', 'platform_equipment_or_station_safety',
          'symptoms_or_population_constraint', 'difficulty_or_dose_mismatch',
          'instruction_or_accessibility_gap', 'media_or_link_issue',
          'graph_or_substitution_issue'
        ),
        'supportEscalation', jsonb_build_object(
          'urgent',
            'Stop use for injury, platform or support movement, fall, dropped load, or unsafe station and route through the facility safety process.',
          'clinical',
            'Refer symptom, pregnancy/postpartum, surgery, or rehabilitation questions to the appropriate qualified professional.',
          'content',
            'Quarantine identity, instruction, scoring, relationship, equipment, or media disputes for coach and content review.'
        ),
        'retentionPolicy',
          'Retain exact variant, side, platform, stance, support, implement, load, range, tempo, dose, symptoms, stop reason, substitution, and reviewer history under facility policy.',
        'changeImpactPolicy',
          'Any identity, platform, support, implement, difficulty, range, tempo, equipment, stop-rule, relationship, or media change requires card-version increment, audit rerun, and renewed human review.',
        'selectionInputs', jsonb_build_array(
          'training_intent', 'symptoms_and_readiness',
          'side_platform_stance_and_support',
          'implement_load_position_and_load',
          'range_tempo_and_available_time',
          'weekly_unilateral_leg_knee_extensor_balance_trunk_grip_and_eccentric_budgets'
        )
      ),
      content_confidence = 86,
      scoring_confidence = 65,
      media_confidence = 50,
      approved_video_url = NULL,
      status = 'review',
      reviewed_by = NULL,
      approved_by = NULL,
      last_reviewed_at = NULL,
      provenance_json = provenance_json || jsonb_build_object(
        'identityMigration',
          '332_coaching_front_foot_elevated_split_squat_identity_consolidation',
        'structuralCompletionMigration', migration_key,
        'researchBatch', 'front-foot-elevated-split-squat-family-v1',
        'researchVersion', '2026-07-26.39',
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

  CREATE TEMP TABLE ffe_split_squat_variant_seed (
    variant_key TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    implement_key TEXT NOT NULL,
    implement_quantity TEXT NOT NULL,
    load_position TEXT NOT NULL,
    support_contract TEXT NOT NULL,
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

  INSERT INTO ffe_split_squat_variant_seed VALUES
    (
      'bodyweight-standard-tempo',
      'Front-Foot-Elevated Split Squat — Bodyweight',
      'bodyweight', 'none', 'none', 'unsupported',
      38, 32, 42, 36, 38, 44, 1, 18, 42, 48, 1, 54, 30,
      ARRAY['step']::TEXT[]
    ),
    (
      'supported-bodyweight-standard-tempo',
      'Front-Foot-Elevated Split Squat — Supported Bodyweight',
      'bodyweight', 'none', 'none', 'stable_hand_support',
      32, 28, 32, 30, 30, 38, 6, 16, 38, 42, 4, 42, 24,
      ARRAY['step', 'rack']::TEXT[]
    ),
    (
      'two-dumbbell-suitcase-standard-tempo',
      'Front-Foot-Elevated Split Squat — Two Dumbbells',
      'dumbbell', 'two', 'bilateral_suitcase', 'unsupported',
      42, 50, 46, 44, 46, 48, 52, 42, 52, 58, 48, 64, 42,
      ARRAY['step', 'dumbbell']::TEXT[]
    ),
    (
      'single-dumbbell-contralateral-standard-tempo',
      'Front-Foot-Elevated Split Squat — Contralateral Dumbbell',
      'dumbbell', 'one', 'contralateral_to_lead_leg', 'unsupported',
      46, 44, 54, 46, 46, 46, 42, 38, 50, 54, 40, 68, 36,
      ARRAY['step', 'dumbbell']::TEXT[]
    ),
    (
      'single-dumbbell-ipsilateral-standard-tempo',
      'Front-Foot-Elevated Split Squat — Ipsilateral Dumbbell',
      'dumbbell', 'one', 'ipsilateral_to_lead_leg', 'unsupported',
      44, 44, 52, 44, 44, 46, 42, 38, 50, 54, 40, 66, 36,
      ARRAY['step', 'dumbbell']::TEXT[]
    ),
    (
      'sandbag-front-hold-standard-tempo',
      'Front-Foot-Elevated Split Squat — Sandbag Front Hold',
      'sandbag', 'one', 'front_hold', 'unsupported',
      42, 48, 48, 46, 48, 48, 44, 44, 52, 56, 42, 64, 42,
      ARRAY['step', 'sandbag']::TEXT[]
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
      seed.implement_quantity,
      seed.load_position,
      seed.support_contract,
      'stationary_split_stance',
      'whole_lead_foot_platform',
      'rear_forefoot_floor_contact',
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
      'leadSide', 'declared_and_balanced_across_prescription',
      'platform', 'stable_declared_height_with_whole_lead_foot_supported',
      'stance',
        'stationary_split_stance_with_declared_width_length_and_rear_forefoot_contact',
      'implement', seed.implement_key,
      'implementQuantity', seed.implement_quantity,
      'loadPosition', seed.load_position,
      'supportContract', seed.support_contract,
      'tempoContract', 'standard_controlled',
      'range', 'declared_owned_pain_free_lead_leg_range',
      'kneeContract', 'lead_knee_tracks_with_lead_foot',
      'trunkContract', 'organized_pelvis_spine_and_brace',
      'completion', 'balanced_split_stance_finish_and_safe_reset',
      'selectable', TRUE,
      'identityQuarantine', FALSE
    ),
    jsonb_build_object(
      'gripDemand', seed.grip_demand,
      'spinalLoading', seed.spinal_loading,
      'eccentricStress', seed.eccentric_stress,
      'landingContactsPerRep', 0,
      'externalLoadMethod',
        CASE WHEN seed.implement_key = 'bodyweight'
          THEN 'bodyweight'
          ELSE 'declared_implement_mass'
        END,
      'loadingType',
        'side_specific_split_squat_with_bilateral_support_and_lead_leg_bias',
      'impactClass', 'no_impact',
      'primaryStress', jsonb_build_array(
        'lead_quadriceps_and_gluteal_force',
        'lead_ankle_knee_and_hip_range_control',
        'hip_and_pelvic_stabilization',
        'balance_and_trunk_bracing',
        CASE WHEN seed.implement_key = 'bodyweight'
          THEN 'bodyweight_control'
          ELSE 'grip_load_position_pickup_and_set_down'
        END
      )
    ),
    jsonb_build_object(
      'localMuscleFatigue', seed.local_muscle_fatigue,
      'gripFatigue', seed.grip_fatigue,
      'technicalFatigueSensitivity', seed.technical_fatigue_sensitivity,
      'impactAccumulation', 1,
      'recoveryHours', seed.recovery_hours,
      'cumulativeBudgets', jsonb_build_array(
        'unilateral_leg_volume', 'lead_knee_extensor_loading',
        'gluteal_and_adductor_loading', 'eccentric_tissue_stress',
        'balance_and_technical_sensitivity',
        'trunk_and_grip_load_when_applicable'
      ),
      'fatigueSignals', jsonb_build_array(
        'platform_or_foot_contact_change', 'balance_loss',
        'lead_knee_tracking_or_foot_pressure_loss',
        'pelvis_or_trunk_change', 'range_or_tempo_loss',
        'grip_load_or_set_down_failure', 'side_asymmetry_or_grinding'
      )
    ),
    jsonb_build_object(
      'trainingStimuli', jsonb_build_array(
        'side_specific_lower_body_strength',
        'lead_knee_extensor_and_gluteal_capacity',
        'controlled_ankle_knee_and_hip_range',
        'balance_and_trunk_control'
      ),
      'stimulusDose', jsonb_build_object(
        'primaryUnit', 'quality_repetitions_per_side',
        'variables',
          jsonb_build_array('load', 'range', 'tempo', 'repetitions', 'rest')
      ),
      'weeklyExposure', jsonb_build_object(
        'typical', 'one_to_three_exposures',
        'minimumRecoveryHours', seed.recovery_hours
      ),
      'prerequisites', jsonb_build_array(
        'pain_free_stationary_split_stance',
        'stable_whole_lead_foot_platform_contact',
        'owned_knee_pelvis_trunk_and_balance_control',
        'safe_support_or_load_handling'
      ),
      'completionCriteria', jsonb_build_array(
        'declared_repetitions_or_time_completed_per_side',
        'all_quality_gates_held',
        'balanced_finish_and_safe_reset_or_set_down'
      ),
      'sequenceRules', jsonb_build_array(
        'after_general_access_and_pattern_rehearsal',
        'before_material_unilateral_leg_balance_trunk_or_grip_fatigue',
        'after_freshness_sensitive_speed_power_or_skill_work'
      ),
      'pairingCompatibility', jsonb_build_array(
        'upper_body_strength', 'low_fatigue_trunk_work',
        'noncompeting_mobility_or_restore'
      ),
      'interferenceRules', jsonb_build_array(
        'avoid_before_sprint_jump_cut_or_kick_output',
        'avoid_after_fatiguing_squat_lunge_running_or_knee_extensor_work',
        'do_not_pair_with_uncontrolled_balance_or_grip_fatigue'
      ),
      'uncertaintyPolicy',
        'When platform, stance, support, load, range, symptoms, or fatigue is uncertain, stop and select the supported bodyweight or reviewed floor-based alternative.',
      'primaryPhase', 'capacity',
      'secondaryPhase', 'resilience',
      'difficultyModel', 'max_exercise_complexity_physical_difficulty',
      'proficiencyClassification', NULL
    ),
    'review'
  FROM ffe_split_squat_variant_seed seed
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
        THEN 'Build side-specific lower-body strength through the exact front-foot-elevated range while preserving platform, stance, foot pressure, knee path, pelvis, trunk, support or load, tempo, finish, and side balance.'
      ELSE
        'Develop controlled lead-leg range and positional ownership with conservative load, full reset, and explicit platform, stance, support, symptom, and quality gates.'
    END,
    CASE phase.profile_key WHEN 'capacity-strength' THEN 94 ELSE 88 END,
    CASE phase.profile_key WHEN 'capacity-strength' THEN 94 ELSE 90 END,
    jsonb_build_object(
      'unilateralLegStrength',
        CASE phase.profile_key WHEN 'capacity-strength' THEN 96 ELSE 76 END,
      'rangeAndPositionControl',
        CASE phase.profile_key WHEN 'range-control' THEN 96 ELSE 82 END,
      'balanceAndTrunkControl', 88,
      'fatigueConditioning', 10
    ),
    jsonb_build_object(
      'sets', CASE phase.profile_key WHEN 'capacity-strength' THEN '2-4' ELSE '2-3' END,
      'repetitionsPerSide',
        CASE phase.profile_key WHEN 'capacity-strength' THEN '4-10' ELSE '4-8' END,
      'restSeconds',
        CASE phase.profile_key WHEN 'capacity-strength' THEN '90-180' ELSE '60-120' END,
      'tempo', 'declared_controlled_lowering_and_smooth_ascent',
      'effort',
        CASE phase.profile_key
          WHEN 'capacity-strength'
            THEN 'challenging_only_while_every_quality_gate_holds'
          ELSE 'light_to_moderate_with_range_and_position_priority'
        END,
      'leadSide', 'declare_order_and_balance',
      'platformHeight', 'declared_exact_height',
      'implement', seed.implement_key,
      'quantity', seed.implement_quantity,
      'loadPosition', seed.load_position,
      'support', seed.support_contract,
      'range', 'declared_owned_pain_free_range',
      'reset', 'balanced_finish_and_full_reset_before_next_rep_or_side'
    ),
    'The exact variant and platform are used; the whole lead foot stays supported; stance and rear-foot contact remain stable; the lead knee tracks with the foot; pelvis, trunk, balance, breathing, range, tempo, support or load, finish, and side change remain controlled.',
    ARRAY[
      'Stop for pain, pinching, numbness, dizziness, pressure symptoms, or apprehension.',
      'Stop for platform, foot, support, floor, footwear, implement, or station movement or uncertainty.',
      'Stop for balance loss, uncontrolled knee motion, foot-pressure loss, pelvic shift, trunk collapse, or range that cannot be controlled.',
      'Stop when tempo, breathing, load control, finish, side symmetry, reset, or set-down quality materially declines or grinding begins.'
    ]::TEXT[],
    'Declare side, platform height, stance, support, implement, load position, load, range, tempo, repetitions, rest, side order, pickup, and set-down. Observe both feet, knees, pelvis, trunk, balance, support, load, finish, and side change.',
    'Whole front foot, set the split, lower under control, knee tracks, drive through the platform, finish balanced.',
    CASE phase.profile_key
      WHEN 'capacity-strength'
        THEN 'Greater side-specific quadriceps and gluteal strength with repeatable split-stance mechanics and load control.'
      ELSE
        'Greater controlled ankle, knee, and hip range, balance, knee tracking, pelvic control, and positional confidence.'
    END,
    seed.equipment_required,
    jsonb_build_object(
      'surface', 'level_high_traction_floor',
      'participants', 'one_athlete_per_platform_station',
      'setupSeconds',
        CASE WHEN seed.implement_key = 'bodyweight' THEN 45 ELSE 60 END,
      'transitionSeconds', 20,
      'equipmentInspection',
        'before_session_after_platform_support_or_load_change_and_after_any_shift',
      'sideChangeZone', 'clear_and_exclusive',
      'setDownZone', 'clear_and_exclusive_when_loaded',
      'coachPosition',
        'outside_fall_pickup_side_change_and_set_down_paths'
    ),
    ARRAY[]::UUID[],
    jsonb_build_object(
      'repetitionSeconds', 7,
      'resetSeconds', 5,
      'sideChangeSeconds', 20,
      'setDurationFormula',
        'per_side_repetitions_x_repetition_plus_reset_plus_side_change',
      'setupSeconds',
        CASE WHEN seed.implement_key = 'bodyweight' THEN 45 ELSE 60 END,
      'durationIncludesSetup', TRUE
    ),
    jsonb_build_object(
      'regressFirst', jsonb_build_array(
        'add_stable_hand_support', 'remove_external_load',
        'lower_platform', 'shorten_range', 'reduce_repetitions',
        'increase_rest'
      ),
      'progressOneVariableAtATime', jsonb_build_array(
        'remove_support', 'load', 'range', 'platform_height',
        'tempo', 'repetitions'
      ),
      'symptomRule',
        'stop_and_select_reviewed_pain_free_supported_or_floor_based_alternative'
    ),
    jsonb_build_object(
      'required', jsonb_build_array(
        'variant', 'lead_side', 'platform_height', 'stance',
        'support_or_implement', 'load_position', 'load', 'range',
        'tempo', 'quality_repetitions_per_side', 'rest', 'stop_reason'
      ),
      'optional', jsonb_build_array(
        'depth', 'knee_angle', 'rate_of_perceived_effort',
        'repetitions_in_reserve', 'balance_error',
        'knee_pelvis_or_trunk_error', 'side_difference'
      ),
      'comparisonRule',
        'Compare only when side, platform, stance, support, implement, load position, load, range, tempo, footwear, surface, and measurement method match.'
    ),
    jsonb_build_object(
      'athleteBeforeSet', jsonb_build_array(
        'Confirm side, platform, stance, support or load, range, tempo, repetitions, rest, side order, and set-down.',
        'Report pain, numbness, dizziness, pressure symptoms, apprehension, or equipment uncertainty.'
      ),
      'coachDuringSet', jsonb_build_array(
        'Watch whole-foot contact, rear foot, knee path, pelvis, trunk, balance, range, tempo, support or load, finish, and side change.',
        'Stop immediately on any symptom, platform, equipment, station, or quality trigger.'
      ),
      'afterSet', jsonb_build_array(
        'Record quality repetitions per side, exact setup, load, range, tempo, errors, symptoms, stop reason, and substitutions.',
        'Do not increase platform, load, range, or tempo after a stop trigger.'
      ),
      'supportEscalation',
        'Escalate symptoms, platform or support movement, fall, dropped load, identity mismatch, or inaccessible instruction through the documented support path.',
      'mediaFallback',
        'Use the written contract and a qualified live demonstration until an exact video is independently approved.'
    ),
    'review'
  FROM ffe_split_squat_variant_seed seed
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
        'supported-bodyweight-standard-tempo',
        'bodyweight-standard-tempo',
        'progression', 94, ARRAY['stability', 'complexity']::TEXT[],
        'Removing stable hand support preserves the platform, stance, range, and split-squat action while increasing balance and failure-control demand.',
        '{"requiresStableSupportedVariant":true,"platformAndRangeUnchanged":true,"humanReviewRequired":true}'::JSONB
      ),
      (
        'bodyweight-standard-tempo',
        'supported-bodyweight-standard-tempo',
        'regression', 94, ARRAY['stability', 'complexity']::TEXT[],
        'Adding stable hand support preserves the front-foot-elevated split squat while reducing balance and failure demand.',
        '{"supportMustBeStableAndOutsideFallPath":true,"humanReviewRequired":true}'::JSONB
      ),
      (
        'bodyweight-standard-tempo',
        'two-dumbbell-suitcase-standard-tempo',
        'progression', 92, ARRAY['load', 'complexity']::TEXT[],
        'Adding two suitcase dumbbells preserves the movement while increasing load, grip, path, pickup, bracing, and set-down demand.',
        '{"requiresStableBodyweightVariant":true,"increaseOneVariableAtATime":true,"humanReviewRequired":true}'::JSONB
      ),
      (
        'two-dumbbell-suitcase-standard-tempo',
        'bodyweight-standard-tempo',
        'regression', 92, ARRAY['load', 'complexity']::TEXT[],
        'Removing the dumbbells preserves the movement while reducing load, grip, pickup, and set-down demand.',
        '{"externalLoad":"none","humanReviewRequired":true}'::JSONB
      ),
      (
        'bodyweight-standard-tempo',
        'single-dumbbell-contralateral-standard-tempo',
        'progression', 90, ARRAY['load', 'stability', 'complexity']::TEXT[],
        'Adding one dumbbell opposite the lead leg preserves the movement while increasing side-specific anti-rotation, grip, and load-control demand.',
        '{"requiresStableBodyweightVariant":true,"loadSideMustBeExplicit":true,"humanReviewRequired":true}'::JSONB
      ),
      (
        'single-dumbbell-contralateral-standard-tempo',
        'bodyweight-standard-tempo',
        'regression', 90, ARRAY['load', 'stability', 'complexity']::TEXT[],
        'Removing the contralateral dumbbell preserves the movement while reducing anti-rotation, grip, and load-control demand.',
        '{"externalLoad":"none","humanReviewRequired":true}'::JSONB
      ),
      (
        'bodyweight-standard-tempo',
        'single-dumbbell-ipsilateral-standard-tempo',
        'progression', 90, ARRAY['load', 'stability', 'complexity']::TEXT[],
        'Adding one dumbbell on the lead-leg side preserves the movement while increasing side-specific balance, grip, and load-control demand.',
        '{"requiresStableBodyweightVariant":true,"loadSideMustBeExplicit":true,"humanReviewRequired":true}'::JSONB
      ),
      (
        'single-dumbbell-ipsilateral-standard-tempo',
        'bodyweight-standard-tempo',
        'regression', 90, ARRAY['load', 'stability', 'complexity']::TEXT[],
        'Removing the ipsilateral dumbbell preserves the movement while reducing balance, grip, and load-control demand.',
        '{"externalLoad":"none","humanReviewRequired":true}'::JSONB
      ),
      (
        'bodyweight-standard-tempo',
        'sandbag-front-hold-standard-tempo',
        'progression', 90, ARRAY['load', 'complexity']::TEXT[],
        'Adding a front-held sandbag preserves the movement while increasing load, bracing, pickup, hold, and set-down demand.',
        '{"requiresStableBodyweightVariant":true,"holdAndSetDownMustBeExplicit":true,"humanReviewRequired":true}'::JSONB
      ),
      (
        'sandbag-front-hold-standard-tempo',
        'bodyweight-standard-tempo',
        'regression', 90, ARRAY['load', 'complexity']::TEXT[],
        'Removing the sandbag preserves the movement while reducing load, bracing, pickup, hold, and set-down demand.',
        '{"externalLoad":"none","humanReviewRequired":true}'::JSONB
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
  FROM ffe_split_squat_variant_seed seed
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id = target_definition_id
   AND variant.variant_key = seed.variant_key
   AND variant.status <> 'archived'
  CROSS JOIN LATERAL (
    VALUES
      (
        'technicalComplexity',
        seed.exercise_complexity,
        'Exercise complexity reflects exact platform, side, stance, rear-foot contact, support, implement, load position, knee path, balance, pelvis, trunk, range, tempo, finish, side change, and set-down.'
      ),
      (
        'absoluteLoadDemand',
        seed.physical_difficulty,
        'Physical difficulty reflects bodyweight and external load, lead-leg force, range, eccentric demand, trunk bracing, grip, and set-down for the exact variant.'
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

  CREATE TEMP TABLE ffe_split_squat_source_seed (
    source_key TEXT PRIMARY KEY,
    source_url TEXT NOT NULL,
    source_title TEXT NOT NULL,
    source_publisher TEXT NOT NULL,
    source_kind TEXT NOT NULL,
    evidence_quality INTEGER NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO ffe_split_squat_source_seed VALUES
    (
      'front_foot_elevated_split_squat_clinical_framework',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC11611527/',
      'Oh, My Quad: A Clinical Commentary and Evidence-Based Framework for the Rehabilitation of Quadriceps Size and Strength after Anterior Cruciate Ligament Reconstruction',
      'International Journal of Sports Physical Therapy',
      'peer_reviewed_research',
      86
    ),
    (
      'split_squat_joint_angles_loading',
      'https://pubmed.ncbi.nlm.nih.gov/24345718/',
      'Joint angles of the ankle, knee, and hip and loading conditions during split squats',
      'Journal of Applied Biomechanics',
      'peer_reviewed_research',
      88
    ),
    (
      'split_squat_step_length_biomechanics',
      'https://pubmed.ncbi.nlm.nih.gov/38026855/',
      'Effects of step lengths on biomechanical characteristics of lower extremity during split squat movement',
      'Frontiers in Bioengineering and Biotechnology',
      'peer_reviewed_research',
      87
    ),
    (
      'youtube_embed_help',
      'https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en',
      'Embed videos and playlists',
      'YouTube Help',
      'manufacturer_instruction',
      82
    );

  CREATE TEMP TABLE ffe_split_squat_evidence_seed (
    section_key TEXT PRIMARY KEY,
    source_key TEXT NOT NULL,
    claims_json JSONB NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO ffe_split_squat_evidence_seed VALUES
    (
      'identity', 'front_foot_elevated_split_squat_clinical_framework',
      '["The clinical framework explicitly uses a front-foot-elevated split squat to progress the lead knee through a deeper declared flexion range.","The stable identity is a stationary split stance with the whole lead foot on a platform; implement, load position, support, tempo, and platform height are variant or modifier dimensions, not exercise skill levels."]'::JSONB
    ),
    (
      'taxonomy', 'split_squat_joint_angles_loading',
      '["Step length and lead-tibia angle change split-squat joint motion and loading.","Declare side, stance, platform, rear-foot support, trunk strategy, range, implement, load position, tempo, and return; rear-foot elevation, stepping, heel-only elevation, and jumping remain separate."]'::JSONB
    ),
    (
      'anatomy', 'split_squat_step_length_biomechanics',
      '["The study measures lead hip, knee, and ankle mechanics plus lower-extremity muscle activity across split-squat stance lengths.","Declare both feet and lower-limb joints, pelvis, spine, optional upper-limb load handling, primary muscles, actions, planes, and asymmetrical side-specific laterality."]'::JSONB
    ),
    (
      'biomechanics', 'split_squat_joint_angles_loading',
      '["Lead-tibia angle and step length materially affect front and rear hip and knee ranges and external moments.","Observe full-foot platform contact, stationary rear foot, stance, knee tracking, pelvis, trunk, range, lead-leg-biased ascent, finish, and side change."]'::JSONB
    ),
    (
      'difficulty', 'front_foot_elevated_split_squat_clinical_framework',
      '["Front-foot elevation is used to advance the lead knee into deeper controlled flexion.","Score exercise complexity and physical difficulty per exact support and load contract, derive overall as their maximum, and assign no exercise skill level."]'::JSONB
    ),
    (
      'load_fatigue_recovery', 'split_squat_step_length_biomechanics',
      '["Stance changes joint moments and lower-extremity muscle activity.","Budget unilateral leg volume, knee-extensor and gluteal demand, range, eccentric stress, balance, trunk bracing, optional grip, technical sensitivity, and recovery without impact contacts."]'::JSONB
    ),
    (
      'constraints', 'front_foot_elevated_split_squat_clinical_framework',
      '["The framework treats front-foot elevation and knee-flexion range as purposeful progression variables.","Declare platform height and fit, floor, rear-foot zone, stance, footwear, support, implement, load, pickup, set-down, pain-free range, side order, and coach sightline."]'::JSONB
    ),
    (
      'dosage', 'split_squat_step_length_biomechanics',
      '["Stance changes the task, so repeatable stance and range are required for comparable dosage.","Use side-balanced quality sets with enough rest to preserve foot pressure, knee tracking, pelvis, trunk, range, tempo, ascent, finish, breathing, and load control."]'::JSONB
    ),
    (
      'instructions', 'front_foot_elevated_split_squat_clinical_framework',
      '["The front-foot-elevated split squat progresses controlled knee-flexion range.","Cue whole front foot, set the split stance, lower under control, track the knee, drive through the platform, finish balanced, and reset."]'::JSONB
    ),
    (
      'safety_stop_rules', 'split_squat_joint_angles_loading',
      '["Tibia angle and step length alter loading, so forced stance or range is not equivalent.","Stop for symptoms, platform or foot movement, balance loss, uncontrolled knee, pelvis or trunk motion, load loss, missed tempo, grinding, or unsafe side change or set-down."]'::JSONB
    ),
    (
      'programming', 'front_foot_elevated_split_squat_clinical_framework',
      '["The framework positions front-foot elevation as a progression to greater lead-knee flexion and quadriceps loading.","Use capacity or explicit range-control delivery before material unilateral-leg, knee-extensor, balance, trunk, or grip fatigue."]'::JSONB
    ),
    (
      'athlete_support', 'split_squat_step_length_biomechanics',
      '["Step length changes motion, joint moments, and muscle activity, so stance must be individualized and repeatable.","Expose side, platform, stance, support, implement, load position, range, tempo, dose, rest, sensations, and stop signal without an exercise skill level."]'::JSONB
    ),
    (
      'coach_support', 'split_squat_joint_angles_loading',
      '["The relationship between stance, tibia angle, motion, and loading requires exact observation.","Coach support exposes platform and foot fit, side, stance, rear foot, knee and hip path, pelvis, trunk, support, load, tempo, dose, fatigue, symptoms, and shutdown."]'::JSONB
    ),
    (
      'accessibility', 'front_foot_elevated_split_squat_clinical_framework',
      '["The framework progresses knee-flexion range rather than requiring maximum depth immediately.","Options include lower platform, shorter range, hand support, bodyweight, fewer repetitions, longer rest, and nonvideo instruction."]'::JSONB
    ),
    (
      'alternates', 'split_squat_step_length_biomechanics',
      '["Stance length changes mechanics while a stationary stance and whole-foot platform preserve the identity when declared.","Rear-foot elevation, heel-only elevation, stepping lunges, and jumping split squats change support, contact sequence, or primary action."]'::JSONB
    ),
    (
      'media', 'youtube_embed_help',
      '["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","Five candidates have healthy metadata only; full viewing, exact variant, safety, captions, accessibility, reviewer identity, and approval remain unresolved."]'::JSONB
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
  FROM ffe_split_squat_evidence_seed evidence
  JOIN ffe_split_squat_source_seed source
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
        'two-dumbbell-suitcase-standard-tempo',
        'gj9kEqLoHlM',
        'https://www.youtube.com/watch?v=gj9kEqLoHlM',
        'Front Foot Elevated Dumbbell Split Squat',
        'ZOAR Fitness',
        'Legacy dumbbell candidate rechecked through current YouTube oEmbed',
        'Current title and oEmbed response are healthy. Full viewing, exact quantity, hold, platform, stance, range, tempo, safety, captions, accessibility, reviewer identity, and approval remain pending.'
      ),
      (
        'two-dumbbell-suitcase-standard-tempo',
        'kwKpuqbm-BQ',
        'https://www.youtube.com/watch?v=kwKpuqbm-BQ',
        'How To: Front Foot Elevated Dumbbell Split Squat',
        'Live Lean TV Daily Exercises',
        'Legacy dumbbell candidate rechecked through current YouTube oEmbed',
        'Current title and oEmbed response are healthy. Full viewing and every human review gate remain pending.'
      ),
      (
        'two-dumbbell-suitcase-standard-tempo',
        'UeMBrke0OSc',
        'https://www.youtube.com/watch?v=UeMBrke0OSc',
        'FRONT FOOT ELEVATED DUMBBELL SPLIT SQUAT',
        'Asset Fitness Co.',
        'Legacy dumbbell candidate rechecked through current YouTube oEmbed',
        'Current title and oEmbed response are healthy. Full viewing and every human review gate remain pending.'
      ),
      (
        NULL,
        'b3noiv3QfD8',
        'https://www.youtube.com/watch?v=b3noiv3QfD8',
        'FFE (Front Foot Elevated) Front Rack Split Squat - THIRSTgym.com',
        'Brandon Smitley',
        'Legacy front-rack candidate rechecked through current YouTube oEmbed',
        'The title does not establish exact implement or hold. Retain only as an unassigned family candidate pending full viewing and exact-variant adjudication.'
      ),
      (
        'sandbag-front-hold-standard-tempo',
        'JocgCLw-bLk',
        'https://www.youtube.com/watch?v=JocgCLw-bLk',
        'Sandbag Zercher FFE Split Squat - THIRSTgym.com',
        'Brandon Smitley',
        'Legacy sandbag candidate rechecked through current YouTube oEmbed',
        'Current metadata suggests a sandbag Zercher variant. Full viewing, exact hold and platform match, safety, captions, accessibility, reviewer identity, and approval remain pending.'
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
        'Front-Foot-Elevated Split Squat', 'same_identity',
        'Stable broad identity for the stationary split squat with the whole lead foot on a declared platform.',
        '{"leadFootSupport":"whole_foot_platform","rearFootSupport":"floor","implement":"declared_by_variant"}'::JSONB
      ),
      (
        'Front-Foot-Elevated Dumbbell Split Squat', 'same_identity',
        'Dumbbells change load, grip, hold, and trunk demand without changing the front-foot-elevated stationary split squat.',
        '{"implement":"dumbbell","quantityAndHold":"declared_by_variant"}'::JSONB
      ),
      (
        'Front-Foot-Elevated Sandbag Split Squat', 'same_identity',
        'A deformable front-held sandbag changes load position and bracing within the same split-squat action.',
        '{"implement":"sandbag","hold":"front_hold"}'::JSONB
      ),
      (
        'Supported Front-Foot-Elevated Split Squat', 'new_variant',
        'Stable hand support reduces balance and failure demand while preserving the platform and stationary stance.',
        '{"supportLevel":"stable_hand_support"}'::JSONB
      ),
      (
        'Contralateral Dumbbell Front-Foot-Elevated Split Squat', 'new_variant',
        'A load opposite the lead leg changes anti-rotation and side-specific handling within the same movement.',
        '{"implement":"dumbbell","quantity":"one","loadSide":"contralateral"}'::JSONB
      ),
      (
        'Ipsilateral Dumbbell Front-Foot-Elevated Split Squat', 'new_variant',
        'A load on the lead-leg side changes balance and trunk demand within the same movement.',
        '{"implement":"dumbbell","quantity":"one","loadSide":"ipsilateral"}'::JSONB
      ),
      (
        'Front-Foot-Elevated Split Squat Isometric Hold', 'new_variant',
        'A declared hold changes dosage and fatigue while retaining the same support and joint configuration.',
        '{"contraction":"isometric","holdDepthAndTime":"declared"}'::JSONB
      ),
      (
        'Slow-Eccentric Front-Foot-Elevated Split Squat', 'new_variant',
        'A slow lowering tempo changes eccentric stress and recovery within the same identity.',
        '{"tempo":"slow_eccentric"}'::JSONB
      ),
      (
        'Front-Heel-Elevated Split Squat', 'new_definition',
        'Heel-only wedge support changes foot contact and ankle mechanics and is not the whole-foot platform contract.',
        '{"leadFootSupport":"heel_only_wedge"}'::JSONB
      ),
      (
        'Rear-Foot-Elevated Split Squat', 'new_definition',
        'Elevating the rear foot changes support, balance, rear-limb range, setup, and failure modes.',
        '{"rearFootSupport":"elevated"}'::JSONB
      ),
      (
        'Reverse Lunge', 'new_definition',
        'Stepping backward and returning changes the contact sequence and dynamic balance task.',
        '{"contactSequence":"step_back_and_return"}'::JSONB
      ),
      (
        'Split-Squat Jump', 'new_definition',
        'Flight, projection, and landing replace the controlled no-impact strength contract.',
        '{"primaryAction":"jump_and_land","impact":"planned"}'::JSONB
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
        WHEN 419 THEN 4.2
        WHEN 1008 THEN 4.2
        ELSE 3.8
      END,
      load = CASE profile.exercise_id
        WHEN 419 THEN 5.0
        WHEN 1008 THEN 4.8
        ELSE 3.2
      END,
      overall = greatest(
        CASE profile.exercise_id
          WHEN 419 THEN 4.2
          WHEN 1008 THEN 4.2
          ELSE 3.8
        END,
        CASE profile.exercise_id
          WHEN 419 THEN 5.0
          WHEN 1008 THEN 4.8
          ELSE 3.2
        END
      ),
      notes =
        'Candidate reassessment maps each legacy source only to the closest named support or implement contract; exact variant assignment and independent calibration remain required.',
      updated_at = now()
  WHERE profile.exercise_id IN (
    SELECT legacy_exercise_id
    FROM coaching.exercise_definition_source_v1
    WHERE definition_id = target_definition_id
  );

  UPDATE coaching.exercise_score_v1 score
  SET technical_complexity = CASE score.exercise_id
        WHEN 419 THEN 42
        WHEN 1008 THEN 42
        ELSE 38
      END,
      absolute_load_demand = CASE score.exercise_id
        WHEN 419 THEN 50
        WHEN 1008 THEN 48
        ELSE 32
      END,
      coordination_demand = CASE score.exercise_id
        WHEN 419 THEN 46
        WHEN 1008 THEN 48
        ELSE 42
      END,
      impact = 1,
      supervision_demand = CASE score.exercise_id
        WHEN 419 THEN 44
        WHEN 1008 THEN 46
        ELSE 36
      END,
      base_overall_difficulty = greatest(
        CASE score.exercise_id
          WHEN 419 THEN 42
          WHEN 1008 THEN 42
          ELSE 38
        END,
        CASE score.exercise_id
          WHEN 419 THEN 50
          WHEN 1008 THEN 48
          ELSE 32
        END
      ),
      legacy_scores = score.legacy_scores || jsonb_build_object(
        'candidateReassessment', migration_key,
        'difficultyModel', 'max_exercise_complexity_physical_difficulty',
        'sourceIdentity', 'front_foot_elevated_stationary_split_squat',
        'legacyExactContractSelectable', FALSE,
        'exerciseSkillLevelAllowed', FALSE,
        'independentCalibrationRequired', TRUE
      ),
      migration_confidence = 65,
      human_review_status = 'queued',
      reviewed_by = NULL,
      reviewed_at = NULL,
      review_notes =
        'Research-backed candidate reassessment only; exact variant assignment and independent calibration remain required.',
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
      movement_family = 'Front-foot-elevated stationary split squat',
      primary_phase_key = 'capacity',
      phase_subrole = 'squat_knee_dominant_strength',
      primary_order_slot = 'front_foot_elevated_split_squat',
      card_summary =
        'Stationary side-specific split squat with the whole lead foot on a declared platform and exact support, implement, load, range, tempo, finish, and side-change contracts.',
      description =
        'Place the whole lead foot on a stable platform, set a stationary split stance, lower through owned range, and drive through the lead foot to a balanced finish.',
      instructions =
        'Declare side, platform, stance, support or implement, load, range, tempo, repetitions, rest, side order, pickup, and set-down. Keep the whole front foot supported, track the knee, control the pelvis and trunk, and finish balanced.',
      coach_language =
        'Observe platform, whole-foot fit, stance, rear foot, knee path, pelvis, trunk, balance, support or load, range, tempo, breathing, finish, side change, and set-down. Stop on symptoms, equipment movement, position loss, load loss, or fatigue.',
      athlete_language =
        'Whole front foot, set the split, lower under control, knee tracks, drive through the platform, finish balanced.',
      scalable_variables = ARRAY[
        'side', 'platform_height', 'stance', 'support',
        'implement', 'implement_quantity', 'load_position', 'load',
        'range', 'tempo', 'repetitions', 'rest'
      ]::TEXT[],
      movement_requirements = jsonb_build_object(
        'leadFootSupport', 'whole_foot_on_declared_platform',
        'rearFootSupport', 'forefoot_on_floor',
        'stance', 'stationary_side_specific_split_stance',
        'primaryAction',
          'controlled_split_squat_descent_and_lead_leg_biased_ascent',
        'supportImplementRangeTempo', 'exact_variant_required',
        'completion', 'balanced_finish_full_reset_and_safe_side_change',
        'selectableExactVariant', FALSE
      ),
      coaching_execution = jsonb_build_object(
        'setup', jsonb_build_array(
          'Declare exact side, platform, stance, support or implement, load, range, tempo, dose, rest, side order, and set-down.',
          'Inspect platform, support, floor, footwear, implement, traffic, and coach sightline.'
        ),
        'quality_gate', jsonb_build_array(
          'Whole lead foot and rear-foot contact remain stable.',
          'Knee, pelvis, trunk, balance, range, tempo, breathing, support or load remain controlled.',
          'The athlete drives through the lead foot, finishes balanced, resets, and changes sides or sets down safely.'
        ),
        'stop_signs', jsonb_build_array(
          'Pain, neurologic symptoms, pressure symptoms, dizziness, or apprehension',
          'Platform, foot, support, implement, floor, footwear, station, or set-down failure',
          'Balance, knee, pelvis, trunk, range, tempo, breathing, finish, side-change, or load-control failure'
        )
      ),
      programming_logic = jsonb_build_object(
        'difficulty_model',
          'max_exercise_complexity_physical_difficulty',
        'exercise_skill_level', NULL,
        'identity_rule',
          'select_exact_platform_side_stance_support_implement_load_position_range_and_tempo_contract',
        'fatigue_rule',
          'place_before_material_unilateral_leg_knee_extensor_balance_trunk_or_grip_fatigue',
        'substitution_rule',
          'never_silently_change_lead_foot_support_rear_foot_support_contact_sequence_range_or_primary_action',
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
        '332_coaching_front_foot_elevated_split_squat_identity_consolidation',
      'completenessMigration', migration_key,
      'researchBatch', 'front-foot-elevated-split-squat-family-v1',
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
