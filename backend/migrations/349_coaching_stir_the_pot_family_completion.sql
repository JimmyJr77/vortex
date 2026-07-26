-- Complete the consolidated Stir-the-Pot card with exact knee-supported and
-- toe-supported circle variants, contextual delivery, support contracts,
-- evidence, media candidates, alternate assessments, graph proposals, and
-- calibration proposals.
--
-- Every inserted review artifact remains candidate/review only. No external
-- media viewing, human approval, calibration approval, graph approval, or
-- publication is claimed. Exercise difficulty is complexity plus physical
-- difficulty, with overall derived as their maximum. IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '349_coaching_stir_the_pot_family_completion';
  target_definition_id UUID;
  facility BIGINT;
  protected_records INTEGER;
  unexpected_variants INTEGER;
  front_plank_variant_id UUID;
BEGIN
  SELECT id, facility_id
  INTO target_definition_id, facility
  FROM coaching.exercise_definition_v1
  WHERE slug = 'stir-the-pot'
    AND status <> 'archived';

  IF target_definition_id IS NULL THEN
    RAISE EXCEPTION
      '% requires the consolidated Stir-the-Pot definition',
      migration_key;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM coaching.exercise_identity_resolution_v1 resolution
    JOIN coaching.exercise_definition_v1 duplicate
      ON duplicate.id = resolution.resolved_definition_id
    WHERE resolution.survivor_definition_id = target_definition_id
      AND duplicate.slug = 'stir-the-pot-plank'
      AND resolution.decision = 'duplicate_consolidated'
  ) THEN
    RAISE EXCEPTION
      '% requires the Stir-the-Pot Plank identity consolidation',
      migration_key;
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
          OR approved_video_url IS NOT NULL
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
      WHERE calibration.variant_id IN (
        SELECT id
        FROM coaching.exercise_variant_v1
        WHERE definition_id = target_definition_id
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
      '% refused to overwrite % protected record(s)',
      migration_key,
      protected_records;
  END IF;

  SELECT COUNT(*)
  INTO unexpected_variants
  FROM coaching.exercise_variant_v1
  WHERE definition_id = target_definition_id
    AND status <> 'archived'
    AND variant_key NOT IN (
      'baseline',
      'knee-supported-small-circles',
      'toe-supported-small-circles',
      'toe-supported-large-circles'
    );

  IF unexpected_variants > 0 THEN
    RAISE EXCEPTION
      '% found % unexpected active variant(s)',
      migration_key,
      unexpected_variants;
  END IF;

  UPDATE coaching.exercise_variant_v1
  SET variant_key = 'legacy-generic-baseline',
      display_name = 'Legacy Generic Stir-the-Pot Source',
      status = 'archived',
      requirements_json = coalesce(requirements_json, '{}'::JSONB)
        || jsonb_build_object(
          'selectable', FALSE,
          'identityQuarantine', TRUE,
          'quarantineReason',
            'Legacy source does not declare exact knee or toe support, circle size, direction order, ball specification, dose, or stop rules.'
        ),
      updated_at = now()
  WHERE definition_id = target_definition_id
    AND variant_key = 'baseline'
    AND status <> 'archived';

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET status = 'archived',
      updated_at = now()
  FROM coaching.exercise_variant_v1 variant
  WHERE variant.id = profile.variant_id
    AND variant.definition_id = target_definition_id
    AND variant.status = 'archived';

  UPDATE coaching.exercise_definition_v1
  SET canonical_name = 'Stir-the-Pot',
      display_name = 'Stir-the-Pot',
      description =
        'Set the forearms on an inspected stability ball in the exact knee-supported or toe-supported plank. Establish the declared shoulder, rib-cage, spine, pelvis, hip, knee, and foot position; trace controlled circles of the prescribed size in both directions without the ball escaping or the trunk changing shape; then stop and kneel before contact, alignment, breathing, or circle consistency fails.',
      family_key = 'stability_ball_circular_plank_control',
      schema_version = '1.0.0',
      card_version = greatest(card_version, 2),
      status = 'review',
      content_confidence = 86,
      scoring_confidence = 78,
      media_confidence = 35,
      movement_patterns = ARRAY['brace', 'push']::TEXT[],
      body_regions = ARRAY['core', 'full_body']::TEXT[],
      required_equipment = ARRAY['stability_ball']::TEXT[],
      optional_equipment = ARRAY['mat']::TEXT[],
      environment_json = '{
        "surface":{"required":"level_nonslip","avoid":["wet","loose","uneven"]},
        "space":{"clearRadiusMeters":1.5,"overheadClearance":"ordinary","trafficControlRequired":true},
        "stabilityBall":{"size":"declared_for_athlete","inflation":"manufacturer_range","inspection":["shell_intact","plug_secure","surface_clean_and_dry","no_visible_damage"]},
        "setup":{"ballMustNotBePinnedAgainstHazard":true,"safeKneelExitRequired":true},
        "sharedStation":{"oneAthletePerBall":true,"coachMustControlCrossTraffic":true}
      }'::JSONB,
      population_json = '{
        "prerequisites":["pain_free_supported_plank_setup","controlled_breathing_under_brace","safe_floor_transfer","shoulder_support_tolerance"],
        "useCaution":["current_shoulder_wrist_elbow_back_or_knee_symptoms","recent_abdominal_or_spinal_procedure","dizziness_or_pressure_symptoms","inability_to_exit_to_kneeling"],
        "doNotUseWhen":["damaged_or_slipping_ball","unsafe_floor_or_traffic","pain_or_neurologic_symptoms","unable_to_hold_start_shape"],
        "regressionOrder":["stable_forearm_plank","knee_supported_small_circle","smaller_circle","fewer_repetitions","wider_foot_base"],
        "individualizationRequired":true,
        "medicalClearancePolicy":"Follow the athlete care plan and local scope; the card does not diagnose or clear symptoms."
      }'::JSONB,
      anatomy_json = '{
        "primaryMuscles":["rectus_abdominis","external_oblique","internal_oblique","transverse_abdominis"],
        "secondaryMuscles":["serratus_anterior","latissimus_dorsi","pectoralis_major","anterior_deltoid","spinal_erectors"],
        "stabilizers":["rotator_cuff","gluteus_maximus","gluteus_medius","quadriceps","forearm_flexors"],
        "joints":["glenohumeral","scapulothoracic","elbow","lumbar_spine","thoracic_spine","hip","knee","ankle"],
        "jointActions":["shoulder_flexion_isometric","scapular_protraction_control","elbow_support_isometric","lumbar_anti_extension","trunk_anti_rotation","hip_extension_isometric","knee_extension_isometric"],
        "planes":["sagittal","transverse","multiplanar"],
        "laterality":"bilateral",
        "kineticChain":"closed_chain_upper_limb_with_grounded_lower_limb_support",
        "biomechanics":{"definingAction":"controlled_circular_forearm_path_on_unstable_ball","trunkOutcome":"declared_rib_pelvis_relationship_without_visible_sag_or_rotation","difficultyLevers":["support_base","foot_width","circle_diameter","shoulder_reach","tempo","continuous_repetitions"]},
        "evidenceLimit":"Muscle roles are based on related gym-ball and unstable closed-chain evidence; exact Stir-the-Pot muscle activation and clinical outcomes require direct study."
      }'::JSONB,
      athlete_support_json = '{
        "whyItMatters":"Builds controlled trunk and shoulder support while the arms move an unstable ball.",
        "primaryCue":"Make the circle with your elbows; keep ribs, belt line, and hips quiet.",
        "expectedSensations":["abdominal_wall_tension","shoulder_and_serratus_support","glute_and_leg_tension_in_toe_support","steady_breathing_effort"],
        "unexpectedSensations":["sharp_or_increasing_pain","numbness_or_tingling","dizziness","pressure_symptoms","neck_or_low_back_pinching"],
        "painGuidance":"Stop immediately for pain or neurologic, dizziness, or pressure symptoms; kneel safely and tell the coach.",
        "selfChecks":["ball_stays_under_control","forearms_keep_contact","ribs_do_not_flare","low_back_does_not_sag","hips_do_not_rotate","circle_size_matches_both_directions","breathing_remains_controlled"],
        "accessibility":["knee_supported_base","mat_under_knees","smaller_circle","wider_foot_base","fewer_repetitions","longer_rest","stable_forearm_plank_alternative"],
        "mediaAlternatives":["step_by_step_text","front_and_side_still_sequence","coach_demonstration","verbal_circle_clock_cues"],
        "beforeYouStart":["inspect_ball_and_floor","clear_space","confirm_safe_kneel_exit","declare_support_base_circle_size_and_repetitions"],
        "afterSetCheck":["record_direction_balance","record_compensation_or_symptoms","stop_reason","next_set_regression_or_progression"]
      }'::JSONB,
      coach_support_json = '{
        "observationChecklist":["ball_condition_and_floor_traction","forearm_contact","shoulder_support","rib_pelvis_alignment","lumbar_sag_or_rotation","hip_height_and_rotation","circle_diameter_and_symmetry","breathing","safe_exit"],
        "faultCorrections":{"lumbar_sag":["kneel","shorten_lever","reduce_circle","cue_exhale_and_rib_position"],"hip_rotation":["widen_feet","reduce_circle","slow_tempo"],"ball_escape":["reduce_circle","reset_forearms","change_ball_size_or_inflation"],"shoulder_collapse":["stop","regress_to_stable_or_knee_supported_plank"],"breath_holding":["reduce_dose","pause_between_directions","use_short_exhale"]},
        "demonstrationPlan":["show_ball_inspection_and_safe_exit","show_exact_start_from_side","show_small_clockwise_and_counterclockwise_paths","contrast_quiet_trunk_with_sag_and_rotation","show_stop_and_kneel"],
        "groupManagement":["one_athlete_per_ball","offset_stations_out_of_recoil_and_traffic_paths","pair_observer_uses_only_declared_checks","do_not_roll_balls_across_active_lanes"],
        "modificationDecisionTree":{"cannot_hold_start":"stable_forearm_plank","toe_support_loses_shape":"knee_supported_small_circles","small_circles_clean":"add_repetitions_before_circle_size","symptoms_or_unsafe_setup":"stop_and_replace"},
        "doNotUseWhen":["ball_or_floor_fails_inspection","safe_exit_unavailable","athlete_cannot_hold_start_shape","pain_neurologic_dizziness_or_pressure_symptoms","coach_cannot_control_station_traffic"],
        "recordingFields":["variant_key","ball_size_and_inflation_check","support_base","foot_width","circle_size","direction_order","repetitions_each_direction","tempo","quality_result","symptoms","stop_reason","cue_response"]
      }'::JSONB,
      support_operations_json = '{
        "issueCategories":["identity_or_variant","difficulty_or_dose","equipment_or_environment","media_exact_match","accessibility","pain_or_safety","graph_relationship","calibration"],
        "supportEscalation":{"urgent":["injury_event","neurologic_symptom","ball_failure_or_collision"],"coachReview":["repeated_compensation","unclear_variant","dose_or_equipment_mismatch"],"contentReview":["conflicting_instruction","missing_accessibility","media_mismatch"]},
        "retentionPolicy":"Retain card version, source evidence, media metadata, exact variant and dose, equipment check, quality result, symptoms, stop reason, and reviewer decisions according to facility policy.",
        "changeImpactPolicy":"Changes to support base, circle contract, stop rules, difficulty, dose, equipment, media, or graph relationships require a new card version, regenerated test packet, and renewed affected reviews.",
        "knownLimitations":["candidate_media_not_human_viewed","no_direct_exact_variant_outcome_trial","scores_are_review_proposals_not_approved_anchors"],
        "supportSummary":"Never infer a larger circle, toe support, or continued set after the declared quality gate fails."
      }'::JSONB,
      approved_video_url = NULL,
      reviewed_by = NULL,
      approved_by = NULL,
      last_reviewed_at = NULL,
      provenance_json = provenance_json || jsonb_build_object(
        'structuralCompletionMigration', migration_key,
        'researchBatch', 'stir-the-pot-family-v1',
        'researchVersion', '2026-07-27.44',
        'difficultyModel',
          'max_exercise_complexity_physical_difficulty',
        'evidenceState', 'candidate_requires_human_review',
        'mediaState', 'candidate_oembed_metadata_only',
        'humanReviewRequired', TRUE,
        'publicationQuarantined', TRUE,
        'mediaApprovalCreated', FALSE,
        'graphApprovalCreated', FALSE,
        'calibrationApprovalCreated', FALSE
      ),
      updated_at = now()
  WHERE id = target_definition_id;

  CREATE TEMP TABLE stir_variant_seed (
    variant_key TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    modifier_keys TEXT[] NOT NULL,
    exercise_complexity SMALLINT NOT NULL,
    physical_difficulty SMALLINT NOT NULL,
    supervision_demand SMALLINT NOT NULL,
    failure_consequence SMALLINT NOT NULL,
    work_capacity_demand SMALLINT NOT NULL,
    requirements JSONB NOT NULL,
    load_profile JSONB NOT NULL,
    fatigue_profile JSONB NOT NULL,
    programming_profile JSONB NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO stir_variant_seed VALUES
    (
      'knee-supported-small-circles',
      'Knee-Supported Stir-the-Pot — Small Circles',
      ARRAY['knee_supported', 'small_circle', 'bidirectional']::TEXT[],
      32, 24, 26, 22, 26,
      '{
        "selectable":true,
        "supportBase":"bilateral_knees_and_forearms",
        "ballSupport":"forearms_or_elbows_on_stability_ball",
        "circleSize":"small_declared",
        "directionOrder":"equal_clockwise_and_counterclockwise",
        "footPosition":"lower_legs_relaxed_or_declared",
        "startShape":"shoulders_to_knees_declared_line",
        "rangeLimit":"largest_circle_that_preserves_contact_alignment_and_breath",
        "equipmentInspectionRequired":true,
        "safeExit":"stop_ball_and_return_hips_to_heels_or_supported_kneel"
      }'::JSONB,
      '{
        "gripDemand":8,
        "spinalLoading":12,
        "eccentricStress":10,
        "landingContactsPerRep":0,
        "externalLoadMethod":"bodyweight",
        "externalLoadDescription":"bodyweight lever over knee and forearm supports on an unstable stability ball",
        "loadTracking":["support_base","ball_size","circle_diameter","repetitions_each_direction","tempo"]
      }'::JSONB,
      '{
        "localMuscleFatigue":28,
        "gripFatigue":8,
        "technicalFatigueSensitivity":34,
        "impactAccumulation":1,
        "recoveryHours":12,
        "primaryFatigueSites":["abdominal_wall","shoulder_girdle"],
        "stopBefore":["lumbar_sag","pelvic_rotation","shoulder_collapse","ball_escape","breath_holding"]
      }'::JSONB,
      '{
        "trainingStimuli":["trunk_anti_extension_control","trunk_anti_rotation_control","closed_chain_shoulder_support"],
        "stimulusDose":{"primary":"quality_circles_each_direction","fatigueCeiling":"low_to_moderate"},
        "weeklyExposure":{"typical":2,"maximumWithoutReview":3},
        "prerequisites":["pain_free_knee_supported_forearm_plank","controlled_breathing","safe_floor_transfer"],
        "completionCriteria":["equal_direction_repetitions","quiet_ribs_and_pelvis","controlled_ball","safe_exit"],
        "sequenceRules":["after_general_prepare","before_high_fatigue_trunk_work","do_not_pre_fatigue_before_high_priority_overhead_or_throwing_work"],
        "pairingCompatibility":{"preferred":["low_fatigue_mobility","lower_body_strength"],"avoid":["shoulder_fatigue_density","ballistic_upper_body_output"]},
        "interferenceRules":["reduce_or_omit_when_shoulders_or_trunk_are_already_fatigued"],
        "uncertaintyPolicy":{"unknown_ball_or_surface":"do_not_use","unclear_support_contract":"use_stable_forearm_plank"},
        "cumulativeBudget":{"technicalSensitivity":34,"impact":1,"shoulderSupport":24}
      }'::JSONB
    ),
    (
      'toe-supported-small-circles',
      'Toe-Supported Stir-the-Pot — Small Circles',
      ARRAY['toe_supported', 'small_circle', 'bidirectional']::TEXT[],
      42, 34, 30, 28, 36,
      '{
        "selectable":true,
        "supportBase":"bilateral_toes_and_forearms",
        "ballSupport":"forearms_or_elbows_on_stability_ball",
        "circleSize":"small_declared",
        "directionOrder":"equal_clockwise_and_counterclockwise",
        "footWidth":"declared_and_repeatable",
        "startShape":"head_shoulders_ribs_pelvis_knees_and_ankles_in_declared_plank_line",
        "rangeLimit":"largest_circle_that_preserves_contact_alignment_and_breath",
        "equipmentInspectionRequired":true,
        "safeExit":"stop_ball_then_lower_knees_under_control"
      }'::JSONB,
      '{
        "gripDemand":10,
        "spinalLoading":18,
        "eccentricStress":12,
        "landingContactsPerRep":0,
        "externalLoadMethod":"bodyweight",
        "externalLoadDescription":"full bodyweight plank lever over toe and forearm supports on an unstable stability ball",
        "loadTracking":["foot_width","ball_size","circle_diameter","repetitions_each_direction","tempo"]
      }'::JSONB,
      '{
        "localMuscleFatigue":40,
        "gripFatigue":10,
        "technicalFatigueSensitivity":46,
        "impactAccumulation":1,
        "recoveryHours":18,
        "primaryFatigueSites":["abdominal_wall","shoulder_girdle","hip_extensors"],
        "stopBefore":["lumbar_sag","pelvic_rotation","shoulder_collapse","ball_escape","breath_holding"]
      }'::JSONB,
      '{
        "trainingStimuli":["trunk_anti_extension_capacity","trunk_anti_rotation_control","closed_chain_shoulder_support"],
        "stimulusDose":{"primary":"quality_circles_each_direction","fatigueCeiling":"moderate"},
        "weeklyExposure":{"typical":2,"maximumWithoutReview":3},
        "prerequisites":["clean_knee_supported_small_circles","pain_free_full_forearm_plank","controlled_breathing","safe_kneel_exit"],
        "completionCriteria":["equal_direction_repetitions","quiet_ribs_and_pelvis","fixed_foot_base","controlled_ball","safe_exit"],
        "sequenceRules":["after_prepare","before_high_fatigue_trunk_work","preserve_priority_throwing_or_overhead_quality"],
        "pairingCompatibility":{"preferred":["lower_body_strength","low_fatigue_mobility"],"avoid":["high_density_push_or_overhead_work"]},
        "interferenceRules":["count_other_plank_and_unstable_shoulder_support_toward_local_fatigue"],
        "uncertaintyPolicy":{"unknown_ball_or_surface":"do_not_use","unclear_foot_width_or_circle":"regress_and_declare"},
        "cumulativeBudget":{"technicalSensitivity":46,"impact":1,"shoulderSupport":36}
      }'::JSONB
    ),
    (
      'toe-supported-large-circles',
      'Toe-Supported Stir-the-Pot — Large Circles',
      ARRAY['toe_supported', 'large_circle', 'bidirectional']::TEXT[],
      48, 40, 34, 32, 44,
      '{
        "selectable":true,
        "supportBase":"bilateral_toes_and_forearms",
        "ballSupport":"forearms_or_elbows_on_stability_ball",
        "circleSize":"large_declared_after_small_circle_ownership",
        "directionOrder":"equal_clockwise_and_counterclockwise",
        "footWidth":"declared_and_repeatable",
        "startShape":"head_shoulders_ribs_pelvis_knees_and_ankles_in_declared_plank_line",
        "rangeLimit":"large_but_never_beyond_contact_alignment_breath_or_safe_return",
        "equipmentInspectionRequired":true,
        "safeExit":"stop_ball_then_lower_knees_under_control"
      }'::JSONB,
      '{
        "gripDemand":12,
        "spinalLoading":22,
        "eccentricStress":16,
        "landingContactsPerRep":0,
        "externalLoadMethod":"bodyweight",
        "externalLoadDescription":"long full-body plank lever with increased circular shoulder reach on an unstable stability ball",
        "loadTracking":["foot_width","ball_size","circle_diameter","repetitions_each_direction","tempo"]
      }'::JSONB,
      '{
        "localMuscleFatigue":48,
        "gripFatigue":12,
        "technicalFatigueSensitivity":54,
        "impactAccumulation":1,
        "recoveryHours":24,
        "primaryFatigueSites":["abdominal_wall","shoulder_girdle","latissimus_dorsi","hip_extensors"],
        "stopBefore":["circle_size_creep","lumbar_sag","pelvic_rotation","shoulder_collapse","ball_escape","breath_holding"]
      }'::JSONB,
      '{
        "trainingStimuli":["trunk_anti_extension_capacity","trunk_anti_rotation_capacity","closed_chain_shoulder_control"],
        "stimulusDose":{"primary":"large_quality_circles_each_direction","fatigueCeiling":"moderate"},
        "weeklyExposure":{"typical":1,"maximumWithoutReview":2},
        "prerequisites":["repeatable_toe_supported_small_circles","pain_free_shoulder_support","controlled_breathing","safe_kneel_exit"],
        "completionCriteria":["declared_large_circle_repeated_both_directions","quiet_ribs_and_pelvis","controlled_ball","no_range_creep","safe_exit"],
        "sequenceRules":["use_after_small_circle_ownership","before_high_fatigue_trunk_work","avoid_before_priority_throwing_or_overhead_output"],
        "pairingCompatibility":{"preferred":["lower_body_strength","low_fatigue_accessory"],"avoid":["high_density_push_overhead_or_throwing_work"]},
        "interferenceRules":["large_reach_counts_toward_shoulder_and_trunk_fatigue_budgets"],
        "uncertaintyPolicy":{"unclear_circle_ownership":"use_small_circle","unknown_ball_or_surface":"do_not_use"},
        "cumulativeBudget":{"technicalSensitivity":54,"impact":1,"shoulderSupport":44}
      }'::JSONB
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
    programming_profile_json
  )
  SELECT
    target_definition_id,
    seed.variant_key,
    seed.display_name,
    seed.modifier_keys,
    jsonb_build_object(
      'technicalComplexity', seed.exercise_complexity,
      'absoluteLoadDemand', seed.physical_difficulty,
      'baseOverallDifficulty',
        greatest(seed.exercise_complexity, seed.physical_difficulty),
      'coordinationDemand', seed.exercise_complexity,
      'supervisionDemand', seed.supervision_demand,
      'failureConsequence', seed.failure_consequence,
      'impact', 1,
      'workCapacityDemand', seed.work_capacity_demand,
      'difficultyModel',
        'max_exercise_complexity_physical_difficulty'
    ),
    seed.requirements,
    'review',
    seed.load_profile,
    seed.fatigue_profile,
    seed.programming_profile
  FROM stir_variant_seed seed
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

  CREATE TEMP TABLE stir_profile_seed (
    variant_key TEXT NOT NULL,
    profile_key TEXT NOT NULL,
    phase_key TEXT NOT NULL,
    role TEXT NOT NULL,
    purpose TEXT NOT NULL,
    suitability SMALLINT NOT NULL,
    alignment SMALLINT NOT NULL,
    dosage JSONB NOT NULL,
    quality_gate TEXT NOT NULL,
    stop_rules TEXT[] NOT NULL,
    expected_adaptation TEXT NOT NULL,
    PRIMARY KEY (variant_key, profile_key)
  ) ON COMMIT DROP;

  INSERT INTO stir_profile_seed VALUES
    (
      'knee-supported-small-circles',
      'resilience-control',
      'resilience',
      'primary',
      'Practice direction-balanced circular ball control from a shorter knee-supported lever without accumulating high fatigue.',
      90, 90,
      '{"sets":2,"repetitionsPerDirection":{"minimum":5,"target":6,"maximum":8},"tempo":"two_to_three_seconds_per_circle","restSeconds":{"minimum":45,"target":60,"maximum":90},"directionOrder":"alternate_first_direction_between_sets","stopAtTechnicalRir":2}'::JSONB,
      'Every circle preserves forearm contact, ball control, the declared shoulder-to-knee line, quiet ribs and pelvis, and controlled breathing in both directions.',
      ARRAY['pain_or_neurologic_dizziness_or_pressure_symptoms','ball_or_floor_fault','forearm_contact_loss','lumbar_sag_or_rib_flare','pelvic_rotation','shoulder_collapse','uncontrolled_ball','breath_holding','unsafe_exit']::TEXT[],
      'Repeatable low-fatigue trunk and shoulder control on an unstable support.'
    ),
    (
      'knee-supported-small-circles',
      'prepare-access',
      'prepare_and_access',
      'secondary',
      'Use the shortest reviewed Stir-the-Pot lever to assess and prepare circular shoulder support before a later trunk or upper-body block.',
      82, 84,
      '{"sets":1,"repetitionsPerDirection":{"minimum":3,"target":4,"maximum":5},"tempo":"controlled","restSeconds":{"minimum":30,"target":45,"maximum":60},"stopAtTechnicalRir":3}'::JSONB,
      'The athlete owns the start, four equal small circles each direction, normal breathing, and a controlled kneeling exit with no coach rescue.',
      ARRAY['any_symptom','ball_or_floor_fault','shape_change','direction_asymmetry','ball_escape','breath_holding']::TEXT[],
      'Readiness information and low-dose trunk organization without stealing quality from later work.'
    ),
    (
      'toe-supported-small-circles',
      'resilience-control',
      'resilience',
      'primary',
      'Develop full-plank anti-extension and anti-rotation control with small repeatable circles.',
      92, 92,
      '{"sets":{"minimum":2,"target":2,"maximum":3},"repetitionsPerDirection":{"minimum":4,"target":6,"maximum":8},"tempo":"two_to_three_seconds_per_circle","restSeconds":{"minimum":60,"target":75,"maximum":120},"directionOrder":"alternate_first_direction_between_sets","stopAtTechnicalRir":2}'::JSONB,
      'Both directions retain the declared head-to-heel line, fixed foot width, quiet ribs and pelvis, controlled ball, equal circle size, and breathing.',
      ARRAY['pain_or_neurologic_dizziness_or_pressure_symptoms','ball_or_floor_fault','forearm_contact_loss','lumbar_sag_or_rib_flare','pelvic_rotation','shoulder_collapse','circle_size_change','ball_escape','breath_holding','unsafe_exit']::TEXT[],
      'Full-lever trunk control and closed-chain shoulder support under controlled perturbation.'
    ),
    (
      'toe-supported-small-circles',
      'capacity-quality',
      'capacity',
      'secondary',
      'Build modest trunk and shoulder-support capacity while retaining exact circle quality.',
      84, 86,
      '{"sets":{"minimum":2,"target":3,"maximum":3},"repetitionsPerDirection":{"minimum":5,"target":7,"maximum":10},"tempo":"controlled_no_rush","restSeconds":{"minimum":60,"target":90,"maximum":120},"stopAtTechnicalRir":2,"maximumTotalCircles":60}'::JSONB,
      'No repetition is counted after alignment, contact, breathing, direction balance, or circle diameter changes.',
      ARRAY['any_symptom','ball_or_floor_fault','alignment_loss','shoulder_collapse','direction_asymmetry','ball_escape','breath_holding','technical_rir_below_two']::TEXT[],
      'Submaximal trunk and shoulder-support work capacity with observable quality retention.'
    ),
    (
      'toe-supported-large-circles',
      'resilience-control',
      'resilience',
      'conditional',
      'Increase controlled circular reach only after the toe-supported small-circle contract is repeatable.',
      86, 88,
      '{"sets":2,"repetitionsPerDirection":{"minimum":3,"target":4,"maximum":6},"tempo":"three_seconds_per_circle","restSeconds":{"minimum":75,"target":90,"maximum":150},"directionOrder":"alternate_first_direction_between_sets","stopAtTechnicalRir":3}'::JSONB,
      'The predeclared large circle remains identical in both directions without increased lumbar extension, pelvic rotation, shoulder collapse, ball escape, or breath holding.',
      ARRAY['any_symptom','ball_or_floor_fault','circle_exceeds_owned_range','circle_size_creep','forearm_contact_loss','alignment_loss','shoulder_collapse','ball_escape','breath_holding']::TEXT[],
      'Greater controlled shoulder reach and trunk moment resistance without using momentum.'
    ),
    (
      'toe-supported-large-circles',
      'capacity-quality',
      'capacity',
      'conditional',
      'Use a low-volume large-circle dose for advanced trunk capacity when small circles remain owned under fatigue.',
      76, 82,
      '{"sets":2,"repetitionsPerDirection":{"minimum":3,"target":5,"maximum":6},"tempo":"controlled_no_rush","restSeconds":{"minimum":90,"target":120,"maximum":180},"stopAtTechnicalRir":3,"maximumTotalCircles":24}'::JSONB,
      'The set ends before range, alignment, shoulder support, breath, contact, or direction symmetry changes; large circles are never chased under fatigue.',
      ARRAY['any_symptom','ball_or_floor_fault','technical_rir_below_three','circle_size_creep','alignment_loss','shoulder_collapse','ball_escape','breath_holding']::TEXT[],
      'Low-volume advanced circular-plank capacity with strict technical reserve.'
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
    substitution_ids,
    status,
    time_model_json,
    dose_scaling_json,
    measurement_json,
    support_prompts_json
  )
  SELECT
    variant.id,
    profile.profile_key,
    profile.phase_key,
    profile.role,
    profile.purpose,
    profile.suitability,
    profile.alignment,
    jsonb_build_object(
      'trunkControl', 94,
      'shoulderSupport', 78,
      'strength', CASE
        WHEN profile.phase_key = 'capacity' THEN 66
        ELSE 48
      END,
      'power', 5,
      'fatigueCost', CASE
        WHEN profile.phase_key = 'prepare_and_access' THEN 18
        WHEN profile.variant_key = 'toe-supported-large-circles' THEN 54
        ELSE 38
      END,
      'context',
        CASE
          WHEN profile.profile_key = 'prepare-access'
            THEN 'low_dose_readiness_and_organization'
          ELSE 'quality_first_trunk_and_shoulder_control'
        END
    ),
    profile.dosage,
    profile.quality_gate,
    profile.stop_rules,
    'Inspect the ball, floor, clearance, and safe exit. Name the support base, foot width, circle size, first direction, and dose. Observe from side and front; stop the set before contact, alignment, breathing, or circle consistency changes.',
    'Set your exact plank, keep the ball under your elbows, and draw the declared circle. Keep ribs, belt line, and hips quiet. Match the other direction, breathe, and lower your knees before shape changes.',
    profile.expected_adaptation,
    ARRAY['stability_ball']::TEXT[],
    jsonb_build_object(
      'stationFootprintMeters', jsonb_build_object(
        'length', 2.5,
        'width', 2.0
      ),
      'athletesPerStation', 1,
      'setupSeconds', 35,
      'transitionSeconds', 20,
      'ballInspectionRequired', TRUE,
      'trafficControlRequired', TRUE,
      'safeExit', 'stop_ball_then_lower_to_knees',
      'optionalEquipment', jsonb_build_array('mat')
    ),
    '{}'::UUID[],
    'review',
    jsonb_build_object(
      'setupSeconds', 35,
      'secondsPerCircle', CASE
        WHEN profile.variant_key = 'toe-supported-large-circles' THEN 3
        ELSE 2.5
      END,
      'directionChangeSeconds', 5,
      'setResetSeconds', 15,
      'restSeconds', profile.dosage -> 'restSeconds',
      'durationFormula',
        'setup + sets * (circles_each_direction * 2 * seconds_per_circle + direction_change + set_reset) + interset_rest'
    ),
    jsonb_build_object(
      'progressionOrder', jsonb_build_array(
        'cleaner_contact_and_breath',
        'equal_direction_repetitions',
        'additional_repetitions_within_cap',
        'toe_support',
        'narrower_declared_foot_width',
        'larger_circle'
      ),
      'regressionOrder', jsonb_build_array(
        'smaller_circle',
        'wider_foot_width',
        'fewer_repetitions',
        'knee_support',
        'stable_forearm_plank'
      ),
      'neverAutoScale', jsonb_build_array(
        'pain',
        'ball_integrity',
        'unsafe_surface',
        'safe_exit',
        'unilateral_support',
        'reactive_perturbation'
      ),
      'directionBalanceRequired', TRUE
    ),
    jsonb_build_object(
      'record', jsonb_build_array(
        'support_base',
        'foot_width',
        'ball_size',
        'circle_size',
        'repetitions_each_direction',
        'tempo',
        'quality_pass',
        'compensation',
        'symptoms',
        'stop_reason'
      ),
      'repStandard',
        'One circle returns the elbows to the declared start point without losing contact, alignment, breathing, or ball control.',
      'directionDifferenceThreshold',
        'Any visible path or quality difference requires regression or coach review.'
    ),
    jsonb_build_object(
      'athletePrompt',
        'Tell the coach about pain, tingling, dizziness, pressure, slipping, or a direction that feels different.',
      'coachPrompt',
        'Record exact variant and dose; do not promote a larger circle solely because the athlete finished the count.',
      'accessibilityPrompt',
        'Offer knee padding, knee support, smaller circles, wider feet, fewer repetitions, longer rest, or a stable plank.'
    )
  FROM stir_profile_seed profile
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id = target_definition_id
   AND variant.variant_key = profile.variant_key
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
    substitution_ids = EXCLUDED.substitution_ids,
    status = 'review',
    time_model_json = EXCLUDED.time_model_json,
    dose_scaling_json = EXCLUDED.dose_scaling_json,
    measurement_json = EXCLUDED.measurement_json,
    support_prompts_json = EXCLUDED.support_prompts_json,
    updated_at = now();

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
    2,
    evidence.section_key,
    evidence.source_url,
    evidence.source_title,
    evidence.source_publisher,
    evidence.source_kind,
    evidence.claims_json,
    evidence.evidence_quality,
    'candidate',
    NULL,
    NULL
  FROM (
    VALUES
      ('identity','https://www.acefitness.org/continuing-education/prosource/february-2014/3680/reality-check-are-planks-really-the-best-core-exercise/','Reality Check: Are Planks Really the Best Core Exercise?','American Council on Exercise','professional_standard','["Stir-the-Pot is a stability-ball plank with a circular elbow path and a stable trunk.","Adding the word plank does not create another exercise identity."]'::JSONB,83),
      ('taxonomy','https://www.acefitness.org/continuing-education/prosource/february-2014/3680/reality-check-are-planks-really-the-best-core-exercise/','Reality Check: Are Planks Really the Best Core Exercise?','American Council on Exercise','professional_standard','["Declare knee or toe support, circle size, direction, repetitions, and trunk-position standard.","Static planks, linear roll-outs, body saws, pikes, and push-ups are different actions."]'::JSONB,83),
      ('anatomy','https://pubmed.ncbi.nlm.nih.gov/15008027/','Electromyographic Activity of Selected Trunk Muscles During Stabilization Exercises Using a Gym Ball','Electromyography and Clinical Neurophysiology','peer_reviewed_research','["Gym-ball stabilization tasks recruit abdominal and back musculature according to the exact support and task.","Shoulder-girdle and hip musculature support the closed-chain plank; the card does not claim muscle isolation."]'::JSONB,82),
      ('biomechanics','https://www.acefitness.org/continuing-education/prosource/february-2014/3680/reality-check-are-planks-really-the-best-core-exercise/','Reality Check: Are Planks Really the Best Core Exercise?','American Council on Exercise','professional_standard','["Move the elbows in controlled circles while maintaining neutral alignment.","A larger circle increases intensity and the toe-supported base increases challenge."]'::JSONB,83),
      ('difficulty','https://pmc.ncbi.nlm.nih.gov/articles/PMC11055131/','Comparison of the Electromyography Activity During Exercises With Stable and Unstable Surfaces: A Systematic Review and Meta-Analysis','Journal of Clinical Medicine','peer_reviewed_research','["Unstable support can alter core and upper-limb activation, with task-specific effects.","Difficulty uses exercise complexity and physical difficulty only; overall is their maximum."]'::JSONB,89),
      ('load_fatigue_recovery','https://pmc.ncbi.nlm.nih.gov/articles/PMC9250763/','Electromyographic Analysis of the Serratus Anterior and Upper Trapezius in Closed Kinetic Chain Exercises Performed on Different Unstable Support Surfaces','PeerJ','peer_reviewed_research','["Unstable closed-chain support changes shoulder-girdle demand.","Track trunk, shoulder, and forearm fatigue plus loss of contact, alignment, breathing, and ball control."]'::JSONB,87),
      ('constraints','https://www.acefitness.org/continuing-education/prosource/february-2014/3680/reality-check-are-planks-really-the-best-core-exercise/','Reality Check: Are Planks Really the Best Core Exercise?','American Council on Exercise','professional_standard','["Use a stability ball and a clear level nonslip surface.","Declare ball condition and size, support base, knee padding, traffic clearance, and safe exit."]'::JSONB,83),
      ('dosage','https://www.acefitness.org/continuing-education/prosource/february-2014/3680/reality-check-are-planks-really-the-best-core-exercise/','Reality Check: Are Planks Really the Best Core Exercise?','American Council on Exercise','professional_standard','["ACE describes five to ten repetitions in each direction.","Direction-balanced quality repetitions stop before position, breath, contact, or path changes."]'::JSONB,83),
      ('instructions','https://www.acefitness.org/continuing-education/prosource/february-2014/3680/reality-check-are-planks-really-the-best-core-exercise/','Reality Check: Are Planks Really the Best Core Exercise?','American Council on Exercise','professional_standard','["Establish the supported plank before moving the elbows around the ball.","Instruction names the base, circle size, direction order, dose, breath, and safe finish."]'::JSONB,83),
      ('safety_stop_rules','https://pmc.ncbi.nlm.nih.gov/articles/PMC9250763/','Electromyographic Analysis of the Serratus Anterior and Upper Trapezius in Closed Kinetic Chain Exercises Performed on Different Unstable Support Surfaces','PeerJ','peer_reviewed_research','["Unstable closed-chain work adds shoulder-support demand.","Stop for symptoms, ball or floor failure, loss of contact, shoulder collapse, lumbar sag, pelvic rotation, breath holding, or unsafe exit."]'::JSONB,87),
      ('programming','https://pmc.ncbi.nlm.nih.gov/articles/PMC11055131/','Comparison of the Electromyography Activity During Exercises With Stable and Unstable Surfaces: A Systematic Review and Meta-Analysis','Journal of Clinical Medicine','peer_reviewed_research','["Instability is a specific constraint rather than a universal progression.","Use knee support before toe support and larger circles only after smaller paths are repeatable."]'::JSONB,89),
      ('athlete_support','https://www.acefitness.org/continuing-education/prosource/february-2014/3680/reality-check-are-planks-really-the-best-core-exercise/','Reality Check: Are Planks Really the Best Core Exercise?','American Council on Exercise','professional_standard','["Show the start, elbow contact, circle path, quiet trunk, direction change, and safe finish.","Offer knee support, smaller circles, wider feet, fewer repetitions, rest, and nonvideo instruction."]'::JSONB,83),
      ('coach_support','https://pubmed.ncbi.nlm.nih.gov/15008027/','Electromyographic Activity of Selected Trunk Muscles During Stabilization Exercises Using a Gym Ball','Electromyography and Clinical Neurophysiology','peer_reviewed_research','["Verify the exact support and task instead of relying on a family label.","Record ball, base, foot width, circle, direction, dose, tempo, compensation, symptoms, and stop reason."]'::JSONB,82),
      ('accessibility','https://www.acefitness.org/continuing-education/prosource/february-2014/3680/reality-check-are-planks-really-the-best-core-exercise/','Reality Check: Are Planks Really the Best Core Exercise?','American Council on Exercise','professional_standard','["ACE presents knee support before toe support.","Accessibility includes knee padding, smaller circles, wider feet, reduced dose, rest, stable plank, and nonvideo guidance."]'::JSONB,83),
      ('alternates','https://www.acefitness.org/continuing-education/prosource/february-2014/3680/reality-check-are-planks-really-the-best-core-exercise/','Reality Check: Are Planks Really the Best Core Exercise?','American Council on Exercise','professional_standard','["Circle size and support base are variants.","Static planks, roll-outs, body saws, push-ups, pikes, and unilateral or reactive versions need separate review."]'::JSONB,83),
      ('media','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en','Embed videos and playlists','YouTube Help','manufacturer_instruction','["YouTube supports privacy-enhanced embedding.","Healthy oEmbed metadata is not human viewing, exact-match review, accessibility review, or approval."]'::JSONB,82)
  ) AS evidence(
    section_key,
    source_url,
    source_title,
    source_publisher,
    source_kind,
    claims_json,
    evidence_quality
  )
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
    next_review_at,
    notes
  )
  SELECT
    target_definition_id,
    NULL,
    2,
    media.url,
    'https://www.youtube-nocookie.com/embed/' || media.video_id,
    media.video_id,
    media.title,
    media.channel_name,
    'en',
    NULL,
    TRUE,
    NULL,
    NULL,
    'healthy',
    'candidate',
    'manual_research',
    'Swiss ball Stir-the-Pot exercise',
    NULL,
    NULL,
    NULL,
    'Current YouTube oEmbed metadata verified 2026-07-27. Human review of the full video, exact variant, cue and safety quality, captions, accessibility, reviewer identity, and approval remains required.'
  FROM (
    VALUES
      ('https://www.youtube.com/watch?v=1BEsVpjmnNE','1BEsVpjmnNE','How To Do A Swiss Ball Stir The Pot','Live Lean TV Daily Exercises'),
      ('https://www.youtube.com/watch?v=1m_ru6EpyRo','1m_ru6EpyRo','Swiss Ball Stir the Pot','Andrew Heming'),
      ('https://www.youtube.com/watch?v=gLTkpNe-1lE','gLTkpNe-1lE','How To Perform A Swiss Ball Stir The Pot Exercise','Dimitri Giankoulas'),
      ('https://www.youtube.com/watch?v=Vt9au65_2yk','Vt9au65_2yk','Swiss Ball Stir the Pot Tutorial - Proper Form and Technique','Runna')
  ) AS media(url, video_id, title, channel_name)
  ON CONFLICT (
    definition_id,
    reviewed_card_version,
    video_id
  )
  DO UPDATE SET
    url = EXCLUDED.url,
    embed_url = EXCLUDED.embed_url,
    title = EXCLUDED.title,
    channel_name = EXCLUDED.channel_name,
    embedding_allowed = TRUE,
    exact_variant_match = NULL,
    demonstration_quality_score = NULL,
    link_status = 'healthy',
    review_status = 'candidate',
    discovery_method = 'manual_research',
    source_query = EXCLUDED.source_query,
    reviewer_user_id = NULL,
    reviewed_at = NULL,
    next_review_at = NULL,
    notes = EXCLUDED.notes,
    updated_at = now();

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
    2,
    alternate.alternate_name,
    alternate.classification,
    alternate.rationale,
    alternate.dimensions,
    CASE
      WHEN alternate.classification = 'new_definition'
        THEN jsonb_build_object(
          'status', 'proposal_only',
          'humanReviewRequired', TRUE,
          'sourceCard', 'stir-the-pot'
        )
      ELSE NULL
    END,
    'candidate',
    NULL,
    NULL
  FROM (
    VALUES
      ('Kneeling Stir-the-Pot','new_variant','Knee support shortens the lever and reduces physical demand while retaining the circular ball action.','{"supportBase":"knees","circleSize":"small"}'::JSONB),
      ('Full-Plank Stir-the-Pot','new_variant','Toe support lengthens the plank lever while retaining the same circular forearm action.','{"supportBase":"toes","circleSize":"small"}'::JSONB),
      ('Large-Circle Stir-the-Pot','new_variant','A larger declared circle increases reach and perturbation while preserving identity.','{"supportBase":"toes","circleSize":"large"}'::JSONB),
      ('Stir-the-Pot Plank','same_identity','The added word plank names the existing position and adds no movement action.','{"nameOnly":true}'::JSONB),
      ('Stability-Ball Forearm Plank','new_definition','A static hold omits the defining circular elbow path.','{"armAction":"static_hold"}'::JSONB),
      ('Stability-Ball Roll-Out','new_definition','Straight out-and-back travel is a different primary arm and ball path.','{"ballPath":"linear_out_and_back"}'::JSONB),
      ('Stability-Ball Body Saw','new_definition','Whole-body sagittal translation replaces the circular forearm path.','{"bodyAction":"sagittal_translation"}'::JSONB),
      ('Stability-Ball Pike','new_definition','Dynamic hip flexion and lower-limb ball support change the primary action and setup.','{"primaryJointAction":"hip_flexion","ballSupport":"lower_limbs"}'::JSONB),
      ('Single-Arm Stir-the-Pot','new_definition','Unilateral support materially changes laterality, shoulder loading, balance, and failure consequence and needs dedicated review.','{"upperLimbSupport":"unilateral"}'::JSONB),
      ('Reactive Partner Stir-the-Pot','new_definition','Unpredictable external perturbation adds a reactive and supervision contract.','{"forcePredictability":"reactive_variable"}'::JSONB)
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
  )
  DO UPDATE SET
    classification = EXCLUDED.classification,
    rationale = EXCLUDED.rationale,
    distinguishing_dimensions = EXCLUDED.distinguishing_dimensions,
    proposed_card_json = EXCLUDED.proposed_card_json,
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
    reviewed_at
  )
  SELECT
    from_variant.id,
    to_variant.id,
    edge.relationship,
    edge.similarity_score,
    edge.dimensions,
    edge.reason,
    edge.conditions,
    'review',
    NULL,
    NULL,
    NULL
  FROM (
    VALUES
      ('knee-supported-small-circles','toe-supported-small-circles','progression',88,ARRAY['complexity','stability']::TEXT[],'Toe support lengthens the plank lever and raises trunk and shoulder-support demand while preserving the same small-circle action.','{"requires":["repeatable_knee_supported_circles","pain_free_full_plank","safe_kneel_exit"]}'::JSONB),
      ('toe-supported-small-circles','knee-supported-small-circles','regression',92,ARRAY['complexity','stability']::TEXT[],'Knee support shortens the lever and is the preferred in-family regression when full-plank alignment or breathing changes.','{"useWhen":["full_plank_shape_changes","shoulder_support_fatigue","dose_needs_reduction"]}'::JSONB),
      ('toe-supported-small-circles','toe-supported-large-circles','progression',86,ARRAY['range','complexity']::TEXT[],'A larger declared circle increases shoulder reach and trunk moment demand after small-circle ownership.','{"requires":["equal_small_circles_both_directions","technical_reserve_at_least_three"]}'::JSONB),
      ('toe-supported-large-circles','toe-supported-small-circles','regression',94,ARRAY['range','complexity']::TEXT[],'Reducing circle size preserves the action while restoring contact, alignment, breathing, and path control.','{"useWhen":["circle_size_creep","ball_control_loss","alignment_change"]}'::JSONB)
  ) AS edge(
    from_key,
    to_key,
    relationship,
    similarity_score,
    dimensions,
    reason,
    conditions
  )
  JOIN coaching.exercise_variant_v1 from_variant
    ON from_variant.definition_id = target_definition_id
   AND from_variant.variant_key = edge.from_key
  JOIN coaching.exercise_variant_v1 to_variant
    ON to_variant.definition_id = target_definition_id
   AND to_variant.variant_key = edge.to_key
  ON CONFLICT (
    from_variant_id,
    to_variant_id,
    relationship
  )
  DO UPDATE SET
    similarity_score = EXCLUDED.similarity_score,
    dimensions = EXCLUDED.dimensions,
    reason = EXCLUDED.reason,
    conditions_json = EXCLUDED.conditions_json,
    review_status = 'review',
    created_by = NULL,
    reviewed_by = NULL,
    reviewed_at = NULL,
    updated_at = now();

  SELECT variant.id
  INTO front_plank_variant_id
  FROM coaching.exercise_variant_v1 variant
  JOIN coaching.exercise_definition_v1 definition
    ON definition.id = variant.definition_id
  WHERE definition.facility_id = facility
    AND definition.slug IN ('front-plank', 'plank-hold')
    AND definition.status <> 'archived'
    AND variant.status <> 'archived'
  ORDER BY
    CASE definition.slug
      WHEN 'front-plank' THEN 1
      ELSE 2
    END,
    CASE variant.variant_key
      WHEN 'baseline' THEN 1
      ELSE 2
    END,
    variant.variant_key
  LIMIT 1;

  IF front_plank_variant_id IS NOT NULL THEN
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
      reviewed_at
    )
    SELECT
      variant.id,
      front_plank_variant_id,
      'lateral_substitution',
      70,
      ARRAY['stability', 'complexity']::TEXT[],
      'A stable forearm plank can preserve a trunk-bracing purpose when no inspected stability ball is available or circular unstable support is not appropriate, but it does not reproduce the circular perturbation.',
      '{"useWhen":["stability_ball_unavailable","unstable_support_not_appropriate"],"notEquivalentFor":["circular_ball_control","unstable_shoulder_support"]}'::JSONB,
      'review',
      NULL,
      NULL,
      NULL
    FROM coaching.exercise_variant_v1 variant
    WHERE variant.definition_id = target_definition_id
      AND variant.variant_key = 'knee-supported-small-circles'
    ON CONFLICT (
      from_variant_id,
      to_variant_id,
      relationship
    )
    DO UPDATE SET
      similarity_score = EXCLUDED.similarity_score,
      dimensions = EXCLUDED.dimensions,
      reason = EXCLUDED.reason,
      conditions_json = EXCLUDED.conditions_json,
      review_status = 'review',
      created_by = NULL,
      reviewed_by = NULL,
      reviewed_at = NULL,
      updated_at = now();
  END IF;

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
    calibration.score,
    CASE
      WHEN calibration.score < 30 THEN 20
      WHEN calibration.score < 50 THEN 40
      WHEN calibration.score < 70 THEN 60
      ELSE 80
    END,
    calibration.rationale,
    'review',
    1,
    NULL,
    NULL,
    'Independent calibration review required; this migration does not approve the proposed score.',
    NULL
  FROM coaching.exercise_variant_v1 variant
  CROSS JOIN LATERAL (
    VALUES
      (
        'technicalComplexity',
        (variant.difficulty_json ->> 'technicalComplexity')::SMALLINT,
        'Proposed from support base, unstable forearm contact, bidirectional circle control, path size, and the requirement to preserve alignment and breathing.'
      ),
      (
        'absoluteLoadDemand',
        (variant.difficulty_json ->> 'absoluteLoadDemand')::SMALLINT,
        'Proposed from the knee or full-plank bodyweight lever, shoulder reach, circle size, and local trunk and shoulder-support demand.'
      ),
      (
        'technicalFatigueSensitivity',
        (variant.fatigue_profile_json ->>
          'technicalFatigueSensitivity')::SMALLINT,
        'Proposed from observed failure modes: ball escape, path drift, forearm contact loss, shoulder collapse, lumbar sag, pelvic rotation, and breath holding.'
      )
  ) AS calibration(dimension, score, rationale)
  WHERE variant.definition_id = target_definition_id
    AND variant.variant_key IN (
      'knee-supported-small-circles',
      'toe-supported-small-circles',
      'toe-supported-large-circles'
    )
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
    created_by = NULL,
    reviewed_by = NULL,
    review_notes = EXCLUDED.review_notes,
    reviewed_at = NULL,
    updated_at = now();

  UPDATE coaching.exercise_card_test_packet_v1
  SET status = 'quarantined',
      blocking_issues_json = jsonb_build_array(
        jsonb_build_object(
          'code', 'media_human_review_required',
          'message',
            'Four embeddable candidates have current oEmbed metadata but require full-video exact-match, cue, safety, caption, and accessibility review.'
        ),
        jsonb_build_object(
          'code', 'graph_human_review_required',
          'message',
            'Progression, regression, and conditional substitution proposals require coach approval.'
        ),
        jsonb_build_object(
          'code', 'calibration_human_review_required',
          'message',
            'Complexity, physical-difficulty, and technical-fatigue proposals require independent calibration.'
        ),
        jsonb_build_object(
          'code', 'publication_approval_required',
          'message',
            'The completed candidate card remains in review and requires current two-person publication approval.'
        )
      ),
      human_review_required = TRUE,
      checked_at = now()
  WHERE definition_id = target_definition_id;
END;
$$;
