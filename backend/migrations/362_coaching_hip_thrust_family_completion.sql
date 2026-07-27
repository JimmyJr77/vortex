-- Complete the consolidated Hip Thrust survivor with exact selectable
-- variants, contextual delivery profiles, anatomy, load/fatigue/recovery,
-- equipment/environment/population constraints, athlete and coach support,
-- candidate evidence/media/alternates, review-only relationship and
-- calibration proposals, and a quarantined automated test packet.
--
-- Media records contain current oEmbed metadata only. No full-video review,
-- exact-match approval, accessibility approval, graph approval, calibration
-- approval, human review, or publication approval is claimed.
--
-- Exercise difficulty is exercise complexity plus physical difficulty, with
-- overall derived as their maximum. Skill/proficiency levels belong only to
-- coaching.skill and are intentionally absent here.
-- IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '362_coaching_hip_thrust_family_completion';
  facility BIGINT;
  target_definition_id UUID;
  protected_records INTEGER;
  unexpected_variants INTEGER;
BEGIN
  SELECT id, facility_id
  INTO target_definition_id, facility
  FROM coaching.exercise_definition_v1
  WHERE slug = 'distance-jump-hip-thrust'
    AND status <> 'archived';

  IF target_definition_id IS NULL THEN
    RAISE EXCEPTION
      '% requires active distance-jump-hip-thrust survivor',
      migration_key;
  END IF;

  IF (
    SELECT COUNT(*)
    FROM coaching.exercise_identity_resolution_v1 resolution
    JOIN coaching.exercise_definition_v1 duplicate
      ON duplicate.id = resolution.resolved_definition_id
    WHERE resolution.survivor_definition_id = target_definition_id
      AND duplicate.slug IN (
        'band-hip-thrust',
        'barbell-hip-thrust',
        'hip-thrust-loaded-glute-bridge',
        'sandbag-hip-thrust-strength',
        'single-leg-hip-thrust'
      )
      AND resolution.decision = 'duplicate_consolidated'
  ) <> 5 THEN
    RAISE EXCEPTION
      '% requires all five migration 361 identity consolidations',
      migration_key;
  END IF;

  IF (
    SELECT COUNT(*)
    FROM coaching.exercise_identity_resolution_v1 resolution
    JOIN coaching.exercise_definition_v1 unresolved
      ON unresolved.id = resolution.resolved_definition_id
    WHERE resolution.survivor_definition_id = target_definition_id
      AND unresolved.slug IN (
        'feet-elevated-hip-thrust',
        'hip-thrust-eccentric-lower'
      )
      AND resolution.decision = 'needs_human_review'
  ) <> 2 THEN
    RAISE EXCEPTION
      '% requires both migration 361 human-review identity boundaries',
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
      'baseline-source-1330',
      'bodyweight-bilateral-upper-back-supported',
      'barbell-bilateral-upper-back-supported',
      'band-bilateral-upper-back-supported',
      'dumbbell-bilateral-upper-back-supported',
      'kettlebell-bilateral-upper-back-supported',
      'plate-bilateral-upper-back-supported',
      'sandbag-bilateral-upper-back-supported',
      'bodyweight-single-leg-upper-back-supported'
    );

  IF unexpected_variants > 0 THEN
    RAISE EXCEPTION
      '% found % unexpected active variant(s)',
      migration_key,
      unexpected_variants;
  END IF;

  UPDATE coaching.exercise_definition_v1
  SET canonical_name = 'Hip Thrust',
      display_name = 'Hip Thrust',
      description =
        'Upper-back-supported hip extension from a declared stable bench or box with feet supported on the floor, exact laterality and implement declared, an owned top position without lumbar substitution, controlled lowering, and a safe setup and exit.',
      family_key = 'supported_horizontal_hip_extension',
      schema_version = '1.0.0',
      card_version = 2,
      status = 'review',
      content_confidence = 82,
      scoring_confidence = 66,
      media_confidence = 38,
      movement_patterns = ARRAY['hinge','brace']::TEXT[],
      body_regions = ARRAY[
        'hip',
        'glutes',
        'hamstrings',
        'posterior_chain',
        'pelvis',
        'core',
        'spine',
        'knee',
        'foot'
      ]::TEXT[],
      required_equipment = ARRAY['bench_or_box']::TEXT[],
      optional_equipment = ARRAY[
        'barbell',
        'bands',
        'dumbbell',
        'kettlebell',
        'plates',
        'sandbag',
        'pad'
      ]::TEXT[],
      anatomy_json = '{
        "primaryMuscles":["gluteus_maximus"],
        "secondaryMuscles":["hamstrings","adductor_magnus","quadriceps"],
        "stabilizers":["gluteus_medius","abdominal_wall","spinal_stabilizers","calves","foot_intrinsics"],
        "joints":["hip","knee","ankle","lumbar_spine","pelvis","thoracic_spine"],
        "jointActions":["hip_extension","hip_flexion_control","knee_position_stabilization","ankle_position_stabilization","thoracolumbar_anti_extension","pelvic_rotation_control"],
        "planes":["sagittal"],
        "laterality":"asymmetrical",
        "lateralityNote":"Exact bilateral or unilateral laterality is declared per variant."
      }'::JSONB,
      environment_json = '{
        "surface":{"required":"level_nonslip","avoid":["wet","uneven","soft_unstable"]},
        "support":{"type":"stable_bench_or_box","height":"declared_and_fitted","mustNotSlide":true,"edgeContactComfortChecked":true},
        "space":{"clearLoadingAndExitZone":true,"noTrafficThroughWorkingZone":true,"headAndImplementClearanceRequired":true},
        "equipmentInspection":{"support":true,"implement":true,"padding":true,"platesAndCollarsWhenUsed":true,"bandAndAnchorWhenUsed":true},
        "observation":{"coachCanSeeFeetKneesPelvisRibsAndUpperBackContact":true},
        "sharedStation":{"oneActiveAthletePerSupport":true,"loadChangesVerballyConfirmed":true,"implementsKeptOutOfWalkways":true}
      }'::JSONB,
      population_json = '{
        "prerequisites":["can_enter_and_exit_support_position_safely","pain_free_owned_hip_extension_range","can_hold_foot_pressure_and_knee_position","can_control_selected_load"],
        "useCaution":["current_hip_knee_back_or_neck_symptoms","recent_lower_body_or_spine_procedure","history_of_hamstring_cramping","contact_pressure_intolerance","fatigue_from_prior_sprint_jump_hinge_or_deadlift_work"],
        "doNotUseWhen":["pain_or_neurologic_symptoms","support_or_floor_is_unsafe","band_anchor_or_loaded_implement_is_unsecured","cannot_control_setup_top_position_or_exit","medical_or_rehabilitation_plan_excludes_the_task"],
        "regressionOrder":["reduce_external_load","use_bilateral_bodyweight_variant","reduce_owned_range","reduce_repetitions","increase_rest","use_reviewed_floor_bridge_or_other_substitution_if_support_contact_is_unsuitable"],
        "individualizationRequired":true,
        "medicalClearancePolicy":"Follow the athlete care plan and local scope; this card does not diagnose symptoms or prescribe through pain."
      }'::JSONB,
      athlete_support_json = '{
        "whyItMatters":"Builds repeatable hip-extension strength while teaching the pelvis and ribs to stay controlled against an exact load.",
        "primaryCue":"Upper back stays on the support; press through your whole foot, extend the hips without arching the low back, then lower under control.",
        "beforeYouStart":["inspect_support_floor_and_implement","declare_variant_load_range_tempo_and_dose","fit_upper_back_contact_and_foot_position","rehearse_loading_unloading_and_abort"],
        "expectedSensations":["glute_and_posterior_hip_effort","firm_foot_pressure","abdominal_bracing","comfortable_upper_back_contact"],
        "unexpectedSensations":["sharp_or_increasing_pain","numbness_or_tingling","dizziness_or_pressure_symptoms","hamstring_cramp_that_changes_motion","low_back_pinch_or_dominance","support_or_implement_movement"],
        "painGuidance":"Stop, control the load, exit safely, and tell the coach about pain, neurologic symptoms, dizziness, cramping that changes motion, contact injury, or loss of control.",
        "selfChecks":["upper_back_contact_stays_set","whole_foot_pressure_stays_stable","knees_track_without_collapse_or_shift","ribs_do_not_flare","pelvis_does_not_rotate","top_position_comes_from_hip_extension","lowering_is_controlled","implement_is_secure_before_exit"],
        "accessibility":["bodyweight_or_lighter_load","padded_load_and_support","lower_stable_support","shorter_pain_free_range","bilateral_instead_of_single_leg","fewer_repetitions","longer_rest","live_tactile_or_still_image_instruction"],
        "mediaAlternatives":["written_setup_sequence","still_images_from_side_and_front","coach_demonstration","live_verbal_or_tactile_setup_with_consent"],
        "afterSetCheck":["variant_and_load","repetitions_and_range","tempo_and_top_control","effort_or_repetitions_in_reserve","symmetry_and_cramping","symptoms","equipment_control","stop_reason"]
      }'::JSONB,
      coach_support_json = '{
        "observationChecklist":["support_height_stability_and_contact","foot_distance_and_pressure","knee_tracking","pelvis_and_rib_position","upper_back_contact","owned_range_and_top_position","tempo_and_symmetry","breathing_and_effort","implement_control","safe_loading_and_exit"],
        "faultCorrections":{
          "lumbar_overextension":["reduce_load","shorten_range","cue_ribs_over_pelvis_and_stop_at_owned_hip_extension"],
          "foot_or_knee_shift":["reset_foot_distance","reduce_load_or_range","use_bilateral_variant"],
          "pelvic_rotation":["stop_set","use_bilateral_variant","reduce_load","restore_side_control"],
          "hamstring_cramp":["stop_and_unload","reassess_foot_position_range_and_fatigue","do_not_force_repetition"],
          "support_or_load_movement":["stop_and_secure_station","replace_or_refit_equipment_before_restarting"],
          "range_loss_or_grinding":["end_set","increase_rest","reduce_load_or_repetitions"]
        },
        "demonstrationPlan":["show_support_and_equipment_inspection","show_exact_upper_back_and_foot_setup","show_loading_and_start","show_owned_hip_extension_without_lumbar_substitution","show_controlled_return","show_abort_unloading_and_exit","contrast_foot_shift_knee_collapse_pelvic_rotation_and_overextension"],
        "groupManagement":["one_active_athlete_per_support","keep_head_and_loading_zone_clear","confirm_load_changes","keep_bands_and_implements_out_of_walkways","close_station_before_support_height_changes"],
        "modificationDecisionTree":{
          "setup_not_owned":"bodyweight_and_rehearse",
          "pelvis_or_knee_control_changes":"bilateral_lower_load_or_shorter_range",
          "contact_discomfort":"pad_or_refit_support_then_choose_reviewed_substitution",
          "symptoms_cramp_or_equipment_fault":"stop",
          "cannot_load_or_exit_safely":"different_implement_or_reviewed_substitution"
        },
        "doNotUseWhen":["unsafe_support_or_floor","unsecured_band_barbell_or_plate","pain_or_neurologic_symptoms","cannot_control_setup_top_or_exit","required_supervision_or_space_is_unavailable"],
        "recordingFields":["variant_key","support_height","laterality","implement","load_position","load_or_band_setup","foot_position","range","tempo","top_hold","repetitions","rir_or_rpe","symmetry","compensation","symptoms","stop_reason"]
      }'::JSONB,
      support_operations_json = '{
        "supportSummary":"Never chase planned load or repetitions by losing upper-back contact, foot pressure, pelvic control, owned range, or safe equipment handling.",
        "issueCategories":["identity_or_variant","difficulty_or_dose","equipment_or_environment","media_exact_match","accessibility","pain_or_safety","graph_relationship","calibration"],
        "supportEscalation":{
          "urgent":["injury_event","dropped_or_rolling_implement","band_or_anchor_failure","neurologic_symptom"],
          "coachReview":["repeated_pelvic_rotation","repeated_cramping","range_or_load_mismatch","support_fit_or_contact_problem"],
          "contentReview":["conflicting_support_geometry","missing_accessibility","media_variant_mismatch","unclear_loading_or_exit"]
        },
        "retentionPolicy":"Retain card version, exact variant, support height, laterality, implement, load position, load, range, tempo, dose, effort, quality, symptoms, stop reason, and reviewer decisions according to facility policy.",
        "knownLimitations":["candidate_media_not_human_viewed","feet_elevated_source_identity_unresolved","eccentric_source_identity_unresolved","no_universal_implement_or_support_height_superiority","scores_and_graph_edges_are_unapproved_proposals"],
        "changeImpactPolicy":"Changes to support geometry, laterality, implement, load position, range, tempo, top standard, difficulty, dose, equipment operations, media, or graph relationships require a new card version, regenerated test packet, and renewed affected reviews."
      }'::JSONB,
      approved_video_url = NULL,
      reviewed_by = NULL,
      approved_by = NULL,
      last_reviewed_at = NULL,
      provenance_json = provenance_json || jsonb_build_object(
        'structuralCompletionMigration', migration_key,
        'researchBatch', 'hip-thrust-family-v1',
        'researchVersion', '2026-07-27.50',
        'evidenceState', 'candidate_requires_human_review',
        'mediaState', 'candidate_oembed_metadata_only',
        'difficultyModel',
          'max_exercise_complexity_physical_difficulty',
        'humanReviewRequired', TRUE,
        'publicationQuarantined', TRUE,
        'operationalSupportReviewRequired', TRUE,
        'mediaApprovalCreated', FALSE,
        'graphApprovalCreated', FALSE,
        'calibrationApprovalCreated', FALSE
      ),
      updated_at = now()
  WHERE id = target_definition_id;

  UPDATE coaching.exercise_variant_v1
  SET status = 'archived',
      requirements_json = coalesce(requirements_json, '{}'::JSONB)
        || jsonb_build_object(
          'selectable', FALSE,
          'completionQuarantine', TRUE,
          'quarantineReason',
            'Legacy baseline does not declare the exact support, laterality, implement, load, range, tempo, dose, quality-gate, stop-rule, and equipment-operation contract.'
        ),
      updated_at = now()
  WHERE definition_id = target_definition_id
    AND status <> 'archived';

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET status = 'archived',
      updated_at = now()
  FROM coaching.exercise_variant_v1 variant
  WHERE variant.id = profile.variant_id
    AND variant.definition_id = target_definition_id
    AND variant.status = 'archived';

  CREATE TEMP TABLE hip_thrust_variant_seed (
    variant_key TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    implement TEXT NOT NULL,
    equipment TEXT[] NOT NULL,
    laterality TEXT NOT NULL,
    complexity SMALLINT NOT NULL,
    physical SMALLINT NOT NULL,
    supervision SMALLINT NOT NULL,
    consequence SMALLINT NOT NULL,
    work_capacity SMALLINT NOT NULL,
    grip SMALLINT NOT NULL,
    spinal SMALLINT NOT NULL,
    eccentric SMALLINT NOT NULL,
    local_fatigue SMALLINT NOT NULL,
    technical_fatigue SMALLINT NOT NULL,
    recovery_hours SMALLINT NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO hip_thrust_variant_seed VALUES
    ('bodyweight-bilateral-upper-back-supported','Bodyweight Bilateral Hip Thrust','bodyweight',ARRAY['bench_or_box']::TEXT[],'bilateral',38,30,34,30,44,8,24,42,42,46,18),
    ('barbell-bilateral-upper-back-supported','Barbell Bilateral Hip Thrust','barbell',ARRAY['bench_or_box','barbell','plates','pad']::TEXT[],'bilateral',48,62,58,54,62,28,42,60,68,66,36),
    ('band-bilateral-upper-back-supported','Band Bilateral Hip Thrust','anchored_band',ARRAY['bench_or_box','bands']::TEXT[],'bilateral',44,46,46,42,54,10,30,50,56,58,24),
    ('dumbbell-bilateral-upper-back-supported','Dumbbell Bilateral Hip Thrust','dumbbell',ARRAY['bench_or_box','dumbbell','pad']::TEXT[],'bilateral',42,44,42,40,52,22,30,50,54,54,24),
    ('kettlebell-bilateral-upper-back-supported','Kettlebell Bilateral Hip Thrust','kettlebell',ARRAY['bench_or_box','kettlebell','pad']::TEXT[],'bilateral',42,44,42,40,52,24,30,50,54,54,24),
    ('plate-bilateral-upper-back-supported','Plate Bilateral Hip Thrust','weight_plate',ARRAY['bench_or_box','plates','pad']::TEXT[],'bilateral',42,42,42,40,50,24,30,50,52,54,24),
    ('sandbag-bilateral-upper-back-supported','Sandbag Bilateral Hip Thrust','sandbag',ARRAY['bench_or_box','sandbag']::TEXT[],'bilateral',46,50,48,44,56,26,34,54,60,60,30),
    ('bodyweight-single-leg-upper-back-supported','Bodyweight Single-Leg Hip Thrust','bodyweight',ARRAY['bench_or_box']::TEXT[],'unilateral',58,48,52,44,56,8,30,52,58,70,30);

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
    ARRAY[
      seed.implement,
      seed.laterality,
      'upper_back_supported',
      'feet_floor_supported',
      'controlled_eccentric'
    ]::TEXT[],
    jsonb_build_object(
      'technicalComplexity', seed.complexity,
      'absoluteLoadDemand', seed.physical,
      'baseOverallDifficulty', greatest(seed.complexity, seed.physical),
      'coordinationDemand', seed.complexity,
      'supervisionDemand', seed.supervision,
      'failureConsequence', seed.consequence,
      'impact', 1,
      'workCapacityDemand', seed.work_capacity,
      'difficultyModel', 'max_exercise_complexity_physical_difficulty',
      'dimensionMeaning', jsonb_build_object(
        'technicalComplexity', 'exercise_complexity',
        'absoluteLoadDemand', 'physical_difficulty'
      )
    ),
    jsonb_build_object(
      'selectable', TRUE,
      'upperBodySupport', 'upper_back_on_stable_bench_or_box',
      'footSupport', CASE
        WHEN seed.laterality = 'unilateral'
          THEN 'one_working_foot_on_level_nonslip_floor'
        ELSE 'both_feet_on_level_nonslip_floor'
      END,
      'laterality', seed.laterality,
      'implement', seed.implement,
      'implementQuantity', CASE
        WHEN seed.implement = 'bodyweight' THEN 0
        ELSE 1
      END,
      'loadPosition', CASE
        WHEN seed.implement = 'bodyweight' THEN 'none'
        WHEN seed.implement = 'anchored_band'
          THEN 'band_across_pelvis_with_declared_anchor'
        ELSE 'padded_or_body_compatible_load_across_pelvis'
      END,
      'range', 'owned_hip_flexion_to_controlled_hip_extension',
      'topPosition', 'hips_extended_without_lumbar_overextension_or_pelvic_rotation',
      'tempo', 'declared_controlled_eccentric_no_bounce',
      'setup', 'support_height_foot_position_load_and_contact_declared',
      'exit', 'implement_secured_before_leaving_support',
      'sideBalanceRequired', seed.laterality = 'unilateral'
    ),
    'review',
    jsonb_build_object(
      'gripDemand', seed.grip,
      'spinalLoading', seed.spinal,
      'eccentricStress', seed.eccentric,
      'landingContactsPerRep', 0,
      'externalLoadMethod', CASE
        WHEN seed.implement = 'bodyweight' THEN 'bodyweight'
        ELSE 'fixed_external'
      END,
      'externalLoadDescription', CASE seed.implement
        WHEN 'bodyweight' THEN 'body mass through a declared upper-back and foot support geometry'
        WHEN 'anchored_band' THEN 'one inspected anchored band across the pelvis with setup and tension declared'
        ELSE 'one declared ' || seed.implement || ' placed and controlled across the pelvis'
      END,
      'loadTracking', jsonb_build_array(
        'implement',
        'external_mass_or_band_setup',
        'laterality',
        'repetitions',
        'tempo',
        'range',
        'top_hold',
        'rir_or_rpe'
      )
    ),
    jsonb_build_object(
      'localMuscleFatigue', seed.local_fatigue,
      'gripFatigue', seed.grip,
      'technicalFatigueSensitivity', seed.technical_fatigue,
      'impactAccumulation', 1,
      'recoveryHours', seed.recovery_hours,
      'primaryFatigueSites', jsonb_build_array(
        'gluteals',
        'hamstrings',
        'posterior_hip',
        'trunk_stabilizers'
      ),
      'stopBefore', jsonb_build_array(
        'upper_back_contact_loss',
        'foot_or_knee_shift',
        'pelvic_rotation',
        'lumbar_overextension',
        'range_or_tempo_loss',
        'cramping_that_changes_motion',
        'grinding_or_failed_rep',
        'unsafe_unloading'
      )
    ),
    jsonb_build_object(
      'trainingStimuli', jsonb_build_array(
        'supported_hip_extension_strength',
        'gluteal_force',
        'lumbopelvic_control',
        CASE
          WHEN seed.laterality = 'unilateral'
            THEN 'unilateral_pelvic_control'
          ELSE 'bilateral_force'
        END
      ),
      'stimulusDose', jsonb_build_object(
        'primary', 'quality_repetitions_through_owned_range',
        'fatigueCeiling', 'moderate'
      ),
      'weeklyExposure', jsonb_build_object(
        'typical', 1,
        'maximumWithoutReview', 3
      ),
      'prerequisites', jsonb_build_array(
        'stable_fitted_support',
        'owned_hip_extension_range',
        'controlled_foot_and_pelvis_position',
        'safe_loading_and_exit'
      ),
      'completionCriteria', jsonb_build_array(
        'upper_back_contact_preserved',
        'foot_pressure_and_knee_position_preserved',
        'owned_top_without_lumbar_substitution',
        'controlled_return',
        'safe_equipment_exit'
      ),
      'sequenceRules', jsonb_build_array(
        'after_specific_warmup',
        'before_fatigue_sensitive_sprinting_jumping_or_hinge_skill_when_quality_is_priority',
        'before_dense_posterior_chain_conditioning'
      ),
      'pairingCompatibility', jsonb_build_object(
        'preferred', jsonb_build_array(
          'upper_body_strength',
          'low_fatigue_mobility'
        ),
        'avoid', jsonb_build_array(
          'high_density_hinge_sprint_or_hamstring_work'
        )
      ),
      'interferenceRules', jsonb_build_array(
        'counts_toward_hip_extension_gluteal_hamstring_and_trunk_budgets',
        'loaded_repetitions_count_toward_external_load_budget',
        'unilateral_repetitions_are_recorded_per_side'
      ),
      'uncertaintyPolicy', jsonb_build_object(
        'support_or_loading_unclear', 'do_not_start',
        'range_or_load_uncertain', 'reduce_load_or_range',
        'identity_geometry_unclear', 'use_only_an_exact_completed_variant'
      ),
      'cumulativeBudget', jsonb_build_object(
        'hipExtensionVolume', 'external_load_or_bodyweight_repetitions',
        'posteriorChainFatigue', seed.local_fatigue,
        'technicalSensitivity', seed.technical_fatigue,
        'impact', 1
      )
    )
  FROM hip_thrust_variant_seed seed
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
    support_prompts_json
  )
  SELECT
    variant.id,
    profile.profile_key,
    profile.phase_key,
    profile.role,
    CASE profile.profile_key
      WHEN 'capacity-strength'
        THEN 'Develop supported hip-extension strength through an owned range with exact support, laterality, implement, load, tempo, effort, rest, and equipment operations declared.'
      ELSE 'Build controlled submaximal hip-extension volume while preserving support contact, foot pressure, knee tracking, pelvis and rib position, range, tempo, symmetry, and safe exit.'
    END,
    CASE profile.profile_key
      WHEN 'capacity-strength' THEN 94
      ELSE 88
    END,
    CASE profile.profile_key
      WHEN 'capacity-strength' THEN 92
      ELSE 88
    END,
    jsonb_build_object(
      'strength', CASE
        WHEN profile.profile_key = 'capacity-strength' THEN 94
        ELSE 80
      END,
      'hipExtensionControl', 90,
      'workCapacity', CASE
        WHEN profile.profile_key = 'resilience-controlled-volume' THEN 88
        ELSE 68
      END,
      'fatigueCost', CASE
        WHEN profile.profile_key = 'capacity-strength' THEN 66
        ELSE 56
      END,
      'context', 'supported_horizontal_hip_extension'
    ),
    CASE profile.profile_key
      WHEN 'capacity-strength' THEN jsonb_build_object(
        'sets', jsonb_build_object(
          'minimum', 3,
          'target', 4,
          'maximum', 5
        ),
        'repetitions', jsonb_build_object(
          'minimum', 4,
          'target', 6,
          'maximum', 10
        ),
        'loadTarget',
          'declared_load_at_two_to_three_repetitions_in_reserve',
        'tempo', 'controlled_two_to_three_second_eccentric',
        'restSeconds', jsonb_build_object(
          'minimum', 120,
          'target', 180,
          'maximum', 300
        ),
        'stopAtRir', 2,
        'sideBalance', CASE
          WHEN seed.laterality = 'unilateral'
            THEN 'equal_successful_repetitions_per_side'
          ELSE 'not_applicable'
        END
      )
      ELSE jsonb_build_object(
        'sets', jsonb_build_object(
          'minimum', 2,
          'target', 3,
          'maximum', 4
        ),
        'repetitions', jsonb_build_object(
          'minimum', 8,
          'target', 10,
          'maximum', 15
        ),
        'loadTarget',
          'submaximal_load_at_three_repetitions_in_reserve',
        'tempo', 'three_second_eccentric_and_owned_top',
        'restSeconds', jsonb_build_object(
          'minimum', 75,
          'target', 120,
          'maximum', 180
        ),
        'stopAtRir', 3,
        'sideBalance', CASE
          WHEN seed.laterality = 'unilateral'
            THEN 'equal_successful_repetitions_per_side'
          ELSE 'not_applicable'
        END
      )
    END,
    'Every repetition preserves stable upper-back contact, whole-foot pressure, knee tracking, ribs over pelvis, exact laterality, owned hip extension without lumbar substitution, controlled lowering, and secure equipment control.',
    ARRAY[
      'pain_numbness_dizziness_or_pressure_symptoms',
      'support_floor_implement_padding_or_anchor_fault',
      'upper_back_contact_or_foot_pressure_loss',
      'knee_shift_or_collapse',
      'pelvic_rotation_or_lumbar_overextension',
      'range_tempo_or_symmetry_loss',
      'cramping_grinding_or_failed_repetition',
      'unsafe_loading_unloading_or_exit'
    ]::TEXT[],
    'Inspect and fit the support, floor, implement, padding, band anchor, loading zone, and exit. Declare laterality, foot position, range, tempo, dose, and effort. Observe the pelvis, ribs, knees, feet, contact, and load; stop before compensation, cramping, grinding, failure, or unsafe handling.',
    'Set your upper back and feet, keep ribs over pelvis, press through the whole foot, extend the hips without arching, lower under control, and secure the load before you exit.',
    CASE profile.profile_key
      WHEN 'capacity-strength'
        THEN 'Greater supported hip-extension strength with repeatable support, pelvis, foot, range, and equipment control.'
      ELSE 'More submaximal hip-extension volume with stable support contact, pelvis, foot pressure, range, tempo, and symmetry.'
    END,
    seed.equipment,
    jsonb_build_object(
      'stationFootprintMeters', jsonb_build_object(
        'length', 2.5,
        'width', 2.5
      ),
      'athletesPerSupport', 1,
      'setupSeconds', CASE
        WHEN seed.implement IN ('barbell','anchored_band') THEN 120
        ELSE 75
      END,
      'transitionSeconds', 45,
      'supportAndSurfaceInspectionRequired', TRUE,
      'equipmentInspectionRequired', TRUE,
      'loadingAndExitZoneControlled', TRUE,
      'spotterOrAssistantByLoadRiskAndPolicy', TRUE
    ),
    ARRAY[]::UUID[],
    'review',
    jsonb_build_object(
      'setupSeconds', CASE
        WHEN seed.implement IN ('barbell','anchored_band') THEN 120
        ELSE 75
      END,
      'secondsPerRepetition', CASE
        WHEN profile.profile_key = 'capacity-strength' THEN 5
        ELSE 6
      END,
      'setTransitionSeconds', 30,
      'restSeconds', CASE profile.profile_key
        WHEN 'capacity-strength' THEN jsonb_build_object(
          'minimum', 120,
          'target', 180,
          'maximum', 300
        )
        ELSE jsonb_build_object(
          'minimum', 75,
          'target', 120,
          'maximum', 180
        )
      END,
      'durationFormula',
        'setup + sets * (repetitions * seconds_per_repetition + set_transition) + interset_rest'
    ),
    jsonb_build_object(
      'progressionOrder', jsonb_build_array(
        'repeatable_setup_contact_and_range',
        'additional_repetitions_within_cap',
        'small_load_or_band_tension_increase',
        'single_leg_variant_only_when_objective_and_control_support_it'
      ),
      'regressionOrder', jsonb_build_array(
        'reduce_load_or_band_tension',
        'increase_rest',
        'fewer_repetitions',
        'bodyweight_bilateral',
        'shorter_owned_range'
      ),
      'neverAutoScale', jsonb_build_array(
        'pain_or_neurologic_symptoms',
        'equipment_or_support_integrity',
        'cramping_that_changes_motion',
        'uncontrolled_pelvic_rotation',
        'unsafe_loading_or_exit'
      ),
      'sideBalanceRequired', seed.laterality = 'unilateral'
    ),
    jsonb_build_object(
      'record', jsonb_build_array(
        'variant_key',
        'support_height',
        'laterality',
        'implement',
        'load_or_band_setup',
        'foot_position',
        'range',
        'tempo',
        'repetitions',
        'rir_or_rpe',
        'symmetry',
        'compensation',
        'cramping_or_symptoms',
        'stop_reason'
      ),
      'successfulRepStandard',
        'Upper-back contact, foot pressure, knee tracking, ribs and pelvis, owned hip-extension top, and controlled return remain repeatable.',
      'loadProgressionThreshold',
        'Increase load only after all planned repetitions pass the quality gate with declared reserve and safe equipment operations.'
    ),
    jsonb_build_object(
      'athletePrompt',
        'Report pain, tingling, dizziness, contact discomfort, cramping, low-back dominance, foot shift, or uncertainty about the support, load, band anchor, or exit.',
      'coachPrompt',
        'Record the exact support, variant, load, range, tempo, reserve, compensation, symptoms, and exit; do not progress when any quality or equipment gate fails.',
      'accessibilityPrompt',
        'Offer bodyweight, lighter or padded load, lower stable support, shorter range, bilateral execution, fewer repetitions, longer rest, or nonvideo instruction.'
    )
  FROM hip_thrust_variant_seed seed
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id = target_definition_id
   AND variant.variant_key = seed.variant_key
  CROSS JOIN (
    VALUES
      ('capacity-strength','capacity','primary'),
      ('resilience-controlled-volume','resilience','secondary')
  ) AS profile(profile_key, phase_key, role)
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
    evidence.claims,
    evidence.evidence_quality,
    'candidate',
    NULL,
    NULL
  FROM (
    VALUES
      ('identity','https://pubmed.ncbi.nlm.nih.gov/35586943/','Electromyographic differences of the gluteus maximus, gluteus medius, biceps femoris, and vastus lateralis between the barbell hip thrust and barbell glute bridge','Sports Biomechanics','peer_reviewed_research',87,'["Upper-back-supported Hip Thrust and floor-supported Glute Bridge are not collapsed into one identity.","Implement and laterality changes remain exact Hip Thrust variants when support geometry and joint action remain the same."]'::JSONB),
      ('taxonomy','https://pubmed.ncbi.nlm.nih.gov/31191088/','Barbell Hip Thrust, Muscular Activation and Performance: A Systematic Review','Journal of Sports Science & Medicine','peer_reviewed_research',90,'["Classify the family as supported horizontal hip extension with exact support, laterality, implement, load position, range, tempo, and dose declared."]'::JSONB),
      ('anatomy','https://pubmed.ncbi.nlm.nih.gov/33780488/','A comprehensive biomechanical analysis of the barbell hip thrust','PLOS ONE','peer_reviewed_research',92,'["Hip extensors are primary while knee, ankle, pelvis, and trunk contribute supporting and stabilizing roles across the repetition."]'::JSONB),
      ('biomechanics','https://pubmed.ncbi.nlm.nih.gov/33780488/','A comprehensive biomechanical analysis of the barbell hip thrust','PLOS ONE','peer_reviewed_research',92,'["Hip-extension demand changes through the lift, so range, support, foot position, external load, and top-position control must be declared."]'::JSONB),
      ('difficulty','https://pubmed.ncbi.nlm.nih.gov/36918403/','Gluteal Muscle Forces during Hip-Focused Injury Prevention and Rehabilitation Exercises','Medicine & Science in Sports & Exercise','peer_reviewed_research',88,'["External loading and single-leg execution alter force and stabilization demands; difficulty is scored per exact variant as complexity and physical difficulty only."]'::JSONB),
      ('load_fatigue_recovery','https://pubmed.ncbi.nlm.nih.gov/33780488/','A comprehensive biomechanical analysis of the barbell hip thrust','PLOS ONE','peer_reviewed_research',92,'["Track load, laterality, repetitions, range, tempo, top holds, proximity to failure, local fatigue, cramping, technical change, and recovery."]'::JSONB),
      ('constraints','https://us.humankinetics.com/products/essentials-of-strength-training-and-conditioning-4th-edition-with-hkpropel-access','Essentials of Strength Training and Conditioning','National Strength and Conditioning Association','professional_standard',92,'["Use inspected equipment, stable setup, appropriate technique, supervision, and controlled progression."]'::JSONB),
      ('dosage','https://us.humankinetics.com/products/essentials-of-strength-training-and-conditioning-4th-edition-with-hkpropel-access','Essentials of Strength Training and Conditioning','National Strength and Conditioning Association','professional_standard',92,'["Dose depends on load, repetitions, sets, rest, exercise order, objective, and preservation of technique."]'::JSONB),
      ('instructions','https://us.humankinetics.com/products/essentials-of-strength-training-and-conditioning-4th-edition-with-hkpropel-access','Essentials of Strength Training and Conditioning','National Strength and Conditioning Association','professional_standard',92,'["Establish equipment, support, body position, action, breathing, and safe finish before progressing load."]'::JSONB),
      ('safety_stop_rules','https://www.nsca.com/about-us/position-statements/youth-resistance-training-the-2014-international-consensus/','Youth Resistance Training: Updated Position Statement Paper From the National Strength and Conditioning Association','National Strength and Conditioning Association','professional_standard',91,'["Qualified supervision, correct technique, manageable resistance, and gradual progression are central safeguards."]'::JSONB),
      ('programming','https://pubmed.ncbi.nlm.nih.gov/31191088/','Barbell Hip Thrust, Muscular Activation and Performance: A Systematic Review','Journal of Sports Science & Medicine','peer_reviewed_research',90,'["Select and sequence Hip Thrust according to the session objective and cumulative posterior-chain load rather than assuming universal transfer."]'::JSONB),
      ('athlete_support','https://us.humankinetics.com/products/essentials-of-strength-training-and-conditioning-4th-edition-with-hkpropel-access','Essentials of Strength Training and Conditioning','National Strength and Conditioning Association','professional_standard',92,'["Athletes need exact support, foot, load, start, action, finish, breathing, dose, symptom, and equipment-exit guidance."]'::JSONB),
      ('coach_support','https://pubmed.ncbi.nlm.nih.gov/33780488/','A comprehensive biomechanical analysis of the barbell hip thrust','PLOS ONE','peer_reviewed_research',92,'["Coaches should observe setup, support contact, foot and knee position, pelvis and ribs, range, tempo, symmetry, fatigue, and equipment control."]'::JSONB),
      ('accessibility','https://www.nsca.com/about-us/position-statements/youth-resistance-training-the-2014-international-consensus/','Youth Resistance Training: Updated Position Statement Paper From the National Strength and Conditioning Association','National Strength and Conditioning Association','professional_standard',91,'["Individualize load, support fit, range, laterality, repetitions, rest, instruction format, and supervision."]'::JSONB),
      ('alternates','https://pubmed.ncbi.nlm.nih.gov/35586943/','Electromyographic differences of the gluteus maximus, gluteus medius, biceps femoris, and vastus lateralis between the barbell hip thrust and barbell glute bridge','Sports Biomechanics','peer_reviewed_research',87,'["Support geometry separates Hip Thrust from floor Glute Bridge; exact implement, laterality, range, tempo, and pause changes remain variant dimensions."]'::JSONB),
      ('media','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en','Embed videos and playlists','YouTube Help','manufacturer_instruction',82,'["Five candidates returned oEmbed metadata, but full viewing, exact-match review, captions, accessibility, cue quality, safety, and human approval remain unresolved."]'::JSONB)
  ) AS evidence(
    section_key,
    source_url,
    source_title,
    source_publisher,
    source_kind,
    evidence_quality,
    claims
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
    duration_seconds,
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
    NULL,
    'en',
    NULL,
    TRUE,
    NULL,
    NULL,
    'healthy',
    'candidate',
    'manual_research',
    media.source_query,
    NULL,
    NULL,
    NULL,
    media.notes
  FROM (
    VALUES
      ('https://www.youtube.com/watch?v=LM8XHLYJoYs','LM8XHLYJoYs','Proper Hip Thrust Form','Bret Contreras Glute Guy','inherited hip thrust candidate','YouTube oEmbed metadata verified 2026-07-26T22:46:26Z. Family-level title match. Full support, implement, range, cue, safety, caption, accessibility, exact-variant, and approval review remain unresolved.'),
      ('https://www.youtube.com/watch?v=1QSrtSBJ2Xo','1QSrtSBJ2Xo','Band Hip Thrust','Girls Gone Strong','inherited band hip thrust candidate','YouTube oEmbed metadata verified 2026-07-26T22:46:26Z. Title-level band match. Full viewing, support geometry, anchor, range, cues, safety, captions, accessibility, and approval remain unresolved.'),
      ('https://www.youtube.com/watch?v=29OfN4ztW_g','29OfN4ztW_g','Dumbbell Hip Thrust (FULL TUTORIAL) - Glute Exercises for Beginners','J2FIT Strength & Conditioning','inherited dumbbell hip thrust candidate','YouTube oEmbed metadata verified 2026-07-26T22:46:26Z. Title-level dumbbell match. Full exact-variant and human demonstration review remain unresolved.'),
      ('https://www.youtube.com/watch?v=J7L0749hx_w','J7L0749hx_w','Kettlebell Hip Thrust','Functional Bodybuilding','inherited kettlebell hip thrust candidate','YouTube oEmbed metadata verified 2026-07-26T22:46:26Z. Title-level kettlebell match. Full exact-variant and human demonstration review remain unresolved.'),
      ('https://www.youtube.com/watch?v=c3_Pbv_FQZg','c3_Pbv_FQZg','Sandbag Hip Thrust Demo','Steph Gaudreau','inherited sandbag hip thrust candidate','YouTube oEmbed metadata verified 2026-07-26T22:46:26Z. Title-level sandbag match. Full support, load placement, cue, safety, caption, accessibility, exact-variant, and approval review remain unresolved.')
  ) AS media(
    url,
    video_id,
    title,
    channel_name,
    source_query,
    notes
  )
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
    duration_seconds = NULL,
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
          'sourceCard', 'distance-jump-hip-thrust'
        )
      ELSE NULL
    END,
    'candidate',
    NULL,
    NULL
  FROM (
    VALUES
      ('Bodyweight Bilateral Hip Thrust','new_variant','Removing external load preserves the upper-back-supported bilateral hip-extension action.','{"implement":"bodyweight","laterality":"bilateral"}'::JSONB),
      ('Barbell Hip Thrust','new_variant','A padded barbell changes load and equipment operations without changing identity.','{"implement":"barbell","loadPosition":"across_pelvis"}'::JSONB),
      ('Band Hip Thrust','new_variant','An anchored band changes resistance profile and setup while preserving identity.','{"implement":"anchored_band","resistanceProfile":"increasing_tension"}'::JSONB),
      ('Dumbbell Hip Thrust','new_variant','A dumbbell changes load handling while preserving support and action.','{"implement":"dumbbell","loadPosition":"across_pelvis"}'::JSONB),
      ('Kettlebell Hip Thrust','new_variant','A kettlebell changes load contact and handling while preserving support and action.','{"implement":"kettlebell","loadPosition":"across_pelvis"}'::JSONB),
      ('Plate Hip Thrust','new_variant','A plate is an implement and handling variant of the same supported action.','{"implement":"weight_plate","loadPosition":"across_pelvis"}'::JSONB),
      ('Sandbag Hip Thrust','new_variant','A sandbag changes load distribution and setup while preserving support and action.','{"implement":"sandbag","loadPosition":"across_pelvis"}'::JSONB),
      ('Single-Leg Hip Thrust','new_variant','One-foot support changes laterality, pelvic control, load distribution, and side-balanced dose.','{"laterality":"unilateral","footSupport":"one_foot"}'::JSONB),
      ('Feet-Elevated Hip Thrust','new_variant','Foot elevation is a variant only when upper-back support and both support heights are explicit; the existing source remains quarantined.','{"footSupportHeight":"elevated_declared","identityReview":"required_for_existing_source"}'::JSONB),
      ('Eccentric Hip Thrust','new_variant','Eccentric emphasis is a tempo variant only with explicit upper-back support; the existing mixed source remains quarantined.','{"tempo":"eccentric_emphasis","identityReview":"required_for_existing_source"}'::JSONB),
      ('Barbell Glute Bridge','new_definition','Floor upper-body support changes support geometry, range, setup, and mechanics.','{"upperBodySupport":"floor","movementIdentity":"glute_bridge"}'::JSONB),
      ('Hip Thrust Machine','new_definition','A machine constrains path, support geometry, pad or belt, setup, and failure protocol.','{"resistanceConstraint":"machine_fixed_path"}'::JSONB),
      ('Frog Pump','new_definition','A frog-leg floor position changes hip rotation, foot contact, range, support, and identity.','{"upperBodySupport":"floor","hipPosition":"abducted_externally_rotated"}'::JSONB),
      ('Paused Hip Thrust','modifier_annotation','A declared top hold changes tempo and fatigue without changing identity when all other dimensions are unchanged.','{"topHoldSeconds":"declared"}'::JSONB)
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
    edge.similarity,
    edge.dimensions,
    edge.reason,
    edge.conditions,
    'review',
    NULL,
    NULL,
    NULL
  FROM (
    VALUES
      ('bodyweight-bilateral-upper-back-supported','barbell-bilateral-upper-back-supported','progression',78,ARRAY['load','complexity']::TEXT[],'A barbell increases external load and equipment-operation demand after bodyweight control is repeatable.','{"requires":["repeatable_bodyweight_setup_range_and_top","safe_barbell_loading_and_exit"]}'::JSONB),
      ('barbell-bilateral-upper-back-supported','bodyweight-bilateral-upper-back-supported','regression',94,ARRAY['load','complexity']::TEXT[],'Removing the barbell preserves bilateral support and action while reducing load and setup demand.','{"useWhen":["load_or_equipment_control_changes","fatigue","barbell_unavailable"]}'::JSONB),
      ('bodyweight-bilateral-upper-back-supported','band-bilateral-upper-back-supported','progression',82,ARRAY['load','complexity']::TEXT[],'An anchored band adds resistance and setup demand while preserving bilateral support and action.','{"requires":["safe_anchor","repeatable_bodyweight_control"]}'::JSONB),
      ('band-bilateral-upper-back-supported','bodyweight-bilateral-upper-back-supported','regression',92,ARRAY['load','complexity']::TEXT[],'Removing band tension preserves the action while reducing resistance and anchor operations.','{"useWhen":["anchor_unavailable","band_setup_or_top_control_changes"]}'::JSONB),
      ('bodyweight-bilateral-upper-back-supported','bodyweight-single-leg-upper-back-supported','progression',76,ARRAY['stability','complexity']::TEXT[],'One-foot support increases pelvic-control and side-balanced dose demands.','{"requires":["repeatable_bilateral_control","pain_free_single_leg_support","side_symmetry"]}'::JSONB),
      ('bodyweight-single-leg-upper-back-supported','bodyweight-bilateral-upper-back-supported','regression',94,ARRAY['stability','complexity']::TEXT[],'Two-foot support reduces pelvic-control and side-balance demand while preserving support geometry.','{"useWhen":["pelvic_rotation","foot_shift","side_asymmetry","fatigue"]}'::JSONB),
      ('dumbbell-bilateral-upper-back-supported','kettlebell-bilateral-upper-back-supported','equipment_equivalent',86,ARRAY['load']::TEXT[],'A kettlebell can preserve the loaded bilateral purpose when mass, contact, range, and setup are matched, but handling differs.','{"requires":["matched_load_and_safe_contact"],"notEquivalentFor":["implement_specific_skill"]}'::JSONB),
      ('kettlebell-bilateral-upper-back-supported','dumbbell-bilateral-upper-back-supported','equipment_equivalent',86,ARRAY['load']::TEXT[],'A dumbbell can preserve the loaded bilateral purpose when mass, contact, range, and setup are matched, but handling differs.','{"requires":["matched_load_and_safe_contact"],"notEquivalentFor":["implement_specific_skill"]}'::JSONB),
      ('dumbbell-bilateral-upper-back-supported','plate-bilateral-upper-back-supported','lateral_substitution',84,ARRAY['load']::TEXT[],'A plate can preserve submaximal bilateral hip-extension intent when load and contact are appropriate.','{"useWhen":["dumbbell_unavailable"],"notEquivalentFor":["exact_implement_tracking"]}'::JSONB),
      ('plate-bilateral-upper-back-supported','dumbbell-bilateral-upper-back-supported','lateral_substitution',84,ARRAY['load']::TEXT[],'A dumbbell can preserve submaximal bilateral hip-extension intent when load and contact are appropriate.','{"useWhen":["plate_unavailable"],"notEquivalentFor":["exact_implement_tracking"]}'::JSONB),
      ('sandbag-bilateral-upper-back-supported','dumbbell-bilateral-upper-back-supported','lateral_substitution',74,ARRAY['load','stability']::TEXT[],'A dumbbell can preserve loaded bilateral intent when sandbag distribution is unsuitable, but contact and stability differ.','{"useWhen":["sandbag_unavailable_or_contact_unsuitable"],"notEquivalentFor":["sandbag_specific_handling"]}'::JSONB),
      ('dumbbell-bilateral-upper-back-supported','sandbag-bilateral-upper-back-supported','lateral_substitution',74,ARRAY['load','stability']::TEXT[],'A sandbag can preserve loaded bilateral intent when a dumbbell is unavailable, but contact and stability differ.','{"useWhen":["dumbbell_unavailable","sandbag_contact_is_safe"],"notEquivalentFor":["dumbbell_specific_loading"]}'::JSONB)
  ) AS edge(
    from_key,
    to_key,
    relationship,
    similarity,
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
        'Proposed from support setup, laterality, implement and load handling, foot and knee control, pelvis and ribs, range, tempo, top standard, and safe exit.'
      ),
      (
        'absoluteLoadDemand',
        (variant.difficulty_json ->> 'absoluteLoadDemand')::SMALLINT,
        'Proposed physical difficulty from body mass or external load, laterality, range, repetitions, tempo, effort, hip-extensor demand, and equipment handling.'
      ),
      (
        'technicalFatigueSensitivity',
        (variant.fatigue_profile_json ->>
          'technicalFatigueSensitivity')::SMALLINT,
        'Proposed from support-contact, foot-pressure, knee, pelvic, rib, range, tempo, symmetry, cramping, and equipment-control deterioration under fatigue.'
      )
  ) AS calibration(dimension, score, rationale)
  WHERE variant.definition_id = target_definition_id
    AND variant.status <> 'archived'
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

  INSERT INTO coaching.exercise_card_test_packet_v1 (
    definition_id,
    facility_id,
    card_version,
    schema_version,
    audit_version,
    status,
    checks_json,
    blocking_issues_json,
    human_review_required,
    checked_at
  )
  VALUES (
    target_definition_id,
    facility,
    2,
    '1.0.0',
    'canonical-card-audit-v1',
    'quarantined',
    '[]'::JSONB,
    jsonb_build_array(
      jsonb_build_object(
        'code', 'media_human_review_required',
        'message',
          'Five oEmbed-healthy candidates require full-video exact-variant, cue, safety, caption, accessibility, reviewer, and approval review.'
      ),
      jsonb_build_object(
        'code', 'identity_boundary_human_review_required',
        'message',
          'Feet-Elevated Hip Thrust and Hip Thrust Eccentric Lower remain quarantined until support geometry is resolved.'
      ),
      jsonb_build_object(
        'code', 'graph_human_review_required',
        'message',
          'Progression, regression, equipment-equivalent, and substitution proposals require coach approval.'
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
    TRUE,
    now()
  )
  ON CONFLICT (definition_id)
  DO UPDATE SET
    facility_id = EXCLUDED.facility_id,
    card_version = EXCLUDED.card_version,
    schema_version = EXCLUDED.schema_version,
    audit_version = EXCLUDED.audit_version,
    status = 'quarantined',
    checks_json = EXCLUDED.checks_json,
    blocking_issues_json = EXCLUDED.blocking_issues_json,
    human_review_required = TRUE,
    checked_at = now();
END;
$$;
