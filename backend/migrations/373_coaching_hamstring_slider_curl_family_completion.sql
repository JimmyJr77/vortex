-- Complete the consolidated Hamstring Slider Curl candidate card after
-- migration 372.
--
-- Exact variants declare laterality, range, full-cycle versus eccentric-only
-- action, return method, hip-height policy, tempo, slider/surface, and dose.
-- Five YouTube candidates have current oEmbed title/channel metadata only.
-- No playback, exact-match, media, graph, calibration, card, or publication
-- approval is claimed.
--
-- Exercise difficulty is exercise complexity plus physical difficulty, with
-- overall derived as their maximum. Skill/proficiency levels remain exclusive
-- to coaching.skill and are intentionally absent here.
-- IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '373_coaching_hamstring_slider_curl_family_completion';
  target_definition_id UUID;
  target_card_version INTEGER;
  facility BIGINT;
  protected_records INTEGER;
  unexpected_variants INTEGER;
BEGIN
  SELECT id, card_version, facility_id
  INTO target_definition_id, target_card_version, facility
  FROM coaching.exercise_definition_v1
  WHERE facility_id = 1
    AND slug = 'hamstring-slider-curl'
    AND status <> 'archived';

  IF target_definition_id IS NULL THEN
    RAISE EXCEPTION
      '% requires active hamstring-slider-curl survivor',
      migration_key;
  END IF;

  IF (
    SELECT COUNT(*)
    FROM coaching.exercise_identity_resolution_v1 resolution
    JOIN coaching.exercise_definition_v1 duplicate
      ON duplicate.id = resolution.resolved_definition_id
    WHERE resolution.survivor_definition_id = target_definition_id
      AND duplicate.slug = 'sliding-hamstring-curl-eccentric'
      AND duplicate.status = 'archived'
      AND resolution.decision = 'duplicate_consolidated'
  ) <> 1 THEN
    RAISE EXCEPTION
      '% requires migration 372 identity consolidation',
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
      'baseline-source-573',
      'bilateral-short-range-bridge-reset',
      'bilateral-full-cycle',
      'bilateral-eccentric-only-reset-down',
      'alternating-full-cycle',
      'single-leg-full-cycle',
      'single-leg-eccentric-only-assisted-return'
    );

  IF unexpected_variants > 0 THEN
    RAISE EXCEPTION
      '% found % unexpected active variant(s)',
      migration_key,
      unexpected_variants;
  END IF;

  UPDATE coaching.exercise_variant_v1
  SET variant_key =
        'legacy-underspecified-source-' || left(id::TEXT, 8),
      status = 'archived',
      requirements_json = coalesce(requirements_json, '{}'::JSONB)
        || jsonb_build_object(
          'selectable', FALSE,
          'completionQuarantine', TRUE,
          'identityQuarantine', TRUE,
          'quarantineReason',
            'Legacy baseline does not declare laterality, slider and surface, hip-height policy, knee range, contraction path, return method, tempo, dose, fatigue, finish, and stop rules.'
        ),
      updated_at = now()
  WHERE definition_id = target_definition_id
    AND variant_key IN ('baseline', 'baseline-source-573');

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET status = 'archived',
      updated_at = now()
  FROM coaching.exercise_variant_v1 variant
  WHERE variant.id = profile.variant_id
    AND variant.definition_id = target_definition_id
    AND variant.status = 'archived';

  UPDATE coaching.exercise_definition_v1
  SET canonical_name = 'Hamstring Slider Curl',
      display_name = 'Hamstring Slider Curl',
      aliases = ARRAY(
        SELECT min(alias)
        FROM unnest(
          coalesce(aliases, '{}')
          || ARRAY[
            'Sliding Hamstring Curl',
            'Hamstring Slide Curl',
            'Sliding Leg Curl',
            'Slider Leg Curl',
            'Supine Sliding Leg Curl',
            'Sliding Hamstring Curl Eccentric'
          ]::TEXT[]
        ) alias
        WHERE nullif(btrim(alias), '') IS NOT NULL
          AND lower(btrim(alias)) <> 'hamstring slider curl'
        GROUP BY lower(btrim(alias))
        ORDER BY lower(btrim(alias))
      ),
      description =
        'Lie supine with shoulders, head, and trunk supported on a comfortable level floor and one or both heels centered on declared sliders over a compatible predictable low-friction surface. Declare laterality, heel path, hip-height policy, knee range, full-cycle or eccentric-only action, return method, tempo, repetitions, rest, and finish. Establish the bridge, slide only through the range that preserves heel control and a quiet pelvis and trunk, then curl the heels back or use the exact assisted reset without an uncontrolled final third.',
      family_key = 'supine_sliding_knee_flexion_curl',
      schema_version = '1.0.0',
      card_version = CASE
        WHEN provenance_json->>'structuralCompletionMigration'
          IS DISTINCT FROM migration_key
          THEN card_version + 1
        ELSE card_version
      END,
      status = 'review',
      content_confidence = 90,
      scoring_confidence = 70,
      media_confidence = 55,
      movement_patterns = ARRAY[
        'knee_flexion',
        'bridge',
        'brace'
      ]::TEXT[],
      body_regions = ARRAY[
        'heel',
        'ankle',
        'calf',
        'knee',
        'hamstrings',
        'hip',
        'glutes',
        'pelvis',
        'core',
        'spine'
      ]::TEXT[],
      required_equipment = ARRAY['sliders']::TEXT[],
      optional_equipment = ARRAY[
        'towels',
        'mat',
        'socks_on_compatible_surface'
      ]::TEXT[],
      anatomy_json = '{
        "primaryMuscles":["biceps_femoris_long_and_short_heads","semitendinosus","semimembranosus"],
        "secondaryMuscles":["gluteus_maximus","gastrocnemius","soleus"],
        "stabilizers":["abdominal_wall","spinal_stabilizers","gluteus_medius_and_minimus","hip_external_rotators","foot_and_ankle_stabilizers"],
        "joints":["knee","hip","ankle","pelvis","lumbar_spine","thoracic_spine"],
        "jointActions":["knee_flexion","eccentric_knee_extension_control","hip_extension_isometric_or_controlled","ankle_position_stabilization","pelvic_and_spinal_anti_extension_and_rotation"],
        "planes":["sagittal","frontal_control","transverse_control"],
        "laterality":"variant_declared_bilateral_alternating_or_unilateral",
        "lateralityNote":"Record working side for alternating and single-leg variants and compare heel path, hip height, pelvic rotation, range, tempo, symptoms, and fatigue without assuming symmetry.",
        "kineticChain":"floor_supported_bodyweight_open_and_closed_chain_combination_with_moving_heel_support",
        "evidenceLimit":"Exercise studies characterize slider force and muscle activation in specific cohorts and protocols; they do not validate one universal range, dose, score, injury-prevention effect, or rehabilitation prescription."
      }'::JSONB,
      environment_json = '{
        "surface":{"required":"clean_level_predictable_and_compatible_with_declared_slider","avoid":["wet","dirty","uneven","abrasive_unpredictable_friction","excessively_slippery_without_control"]},
        "space":{"supineFootprintMeters":{"length":3,"width":1.5},"clearHeelTravelMeters":1.5,"crossTrafficProhibited":true},
        "setup":{"matchedIntactSliders":true,"sliderSurfacePairTestedAtLowRange":true,"headShouldersAndTrunkComfortablySupported":true,"rangeTempoReturnAndFinishDeclared":true},
        "observation":{"coachCanSeeBothHeelPathsHipsPelvisAndTrunk":true,"videoOnlyWithConsentAndPolicy":true},
        "traffic":{"oneActiveAthletePerStation":true,"unusedEquipmentOutsideHeelPath":true}
      }'::JSONB,
      population_json = '{
        "prerequisites":["pain_free_supine_bridge","controlled_short_range_bilateral_slide","can_keep_heels_centered_on_sliders","can_follow_laterality_range_tempo_return_finish_and_stop_rules"],
        "useCaution":["current_hamstring_calf_knee_hip_or_back_symptoms","recent_hamstring_strain_or_lower_extremity_procedure","history_of_cramping_with_knee_flexion","meaningful_side_difference","fatigue_from_sprinting_hinging_nordics_jumps_or_prior_hamstring_work"],
        "doNotUseWhen":["sharp_or_increasing_pain_hamstring_pull_or_grab","numbness_dizziness_giving_way_or_apprehension","unsafe_floor_slider_or_clearance","cannot_control_short_range_bilateral_slide","cramping_already_changes_bridge_or_knee_motion"],
        "regressionOrder":["shorten_heel_travel","bilateral_support","hips_lower_between_repetitions","use_assisted_return","reduce_repetitions","increase_rest"],
        "individualizationRequired":true,
        "medicalScope":"This card is not diagnosis, rehabilitation, injury-prevention assurance, or medical clearance; follow the athlete care plan and local scope."
      }'::JSONB,
      athlete_support_json = '{
        "whyItMatters":"Builds hamstring knee-flexion strength and controlled lengthening while the trunk and pelvis stay organized in a floor-supported bridge.",
        "primaryCue":"Heels centered, bridge quietly, slide only as far as you can own, then pull back or reset exactly as assigned.",
        "beforeYouStart":["confirm_variant_side_slider_surface_hip_height_range_tempo_return_repetitions_rest_and_finish","clear_the_heel_path_and_test_slider_friction","rehearse_one_short_pain_free_bilateral_repetition","identify_cramp_and_stop_signal"],
        "expectedSensations":["hamstring_effort_behind_the_thigh","glute_and_trunk_effort_to_hold_the_bridge","controlled_heel_pressure_and_slider_travel","greater_local_effort_as_the_knees_extend"],
        "unexpectedSensations":["sharp_or_increasing_pain","hamstring_pull_or_grab","cramp_that_changes_motion","numbness_or_tingling","knee_or_back_pain","dizziness","slider_escape_or_loss_of_control"],
        "selfChecks":["heels_remain_centered_and_follow_declared_paths","hips_follow_the_declared_height_policy","pelvis_and_ribs_stay_quiet","range_and_tempo_match_the_assignment","return_method_does_not_change","last_repetition_matches_the_first"],
        "painGuidance":"Stop and report pain, pulling, a hamstring grab, cramping that changes motion, numbness, dizziness, slider escape, or a repetition you cannot finish with the declared reset.",
        "accessibility":["shorter_range","bilateral_instead_of_unilateral","hips_lowered_between_repetitions","assisted_return","fewer_repetitions","longer_rest","written_audio_still_image_or_live_walkthrough"],
        "mediaAlternatives":["written_exact_variant_contract","side_view_stills","slow_walkthrough","qualified_live_demonstration"],
        "afterSetCheck":["record_variant_side_slider_surface_range_tempo_quality_repetitions_assistance_rest_cramping_symptoms_and_stop_reason"]
      }'::JSONB,
      coach_support_json = '{
        "observationChecklist":["floor_slider_condition_and_clearance","variant_laterality_and_return_method","heel_center_and_path","hip_height_policy","pelvis_rib_and_lumbar_position","knee_range_and_eccentric_speed","left_right_difference","breathing_cramping_and_fatigue","safe_finish"],
        "faultCorrections":{"hips_drop_or_back_extends":["shorten_range","lower_hips_between_repetitions","reduce_laterality_or_repetitions"],"pelvis_rotates":["return_to_bilateral","shorten_range","reduce_repetitions"],"heel_escapes_or_paths_diverge":["stop_and_reset_slider","shorten_range","change_surface_or_slider"],"eccentric_speeds_up":["end_set_or_reduce_range","use_assisted_return"],"cramp_changes_motion":["stop_set","record_symptom","do_not_auto_progress"],"cannot_return":["use_declared_reset_down_or_assistance","reduce_demand"]},
        "demonstrationPlan":["show_slider_and_surface_test","show_bilateral_full_cycle","show_eccentric_only_slide_out_and_reset_down","show_single_leg_with_assisted_return","contrast_swiss_ball_nordic_machine_curl_bridge_and_rdl"],
        "groupManagement":["one_active_athlete_per_station","heel_paths_clear_of_people_and_equipment","coach_outside_slider_escape_path","variant_and_repetition_counting_standardized"],
        "modificationDecisionTree":{"short_range_bilateral_not_controlled":"stop_or_choose_reviewed_bridge_regression","bilateral_full_cycle_repeatable":"consider_alternating_or_longer_range","goal_is_eccentric_control":"use_declared_eccentric_only_return","side_difference_or_cramp_persists":"stop_and_review","symptom_or_hazard":"stop"},
        "doNotUseWhen":["pain_pull_grab_neurologic_symptom_giving_way_dizziness_or_apprehension","unsafe_floor_slider_or_cross_traffic","short_range_bilateral_control_is_not_repeatable","cramping_or_fatigue_already_changes_motion","declared_return_cannot_be_completed_safely"],
        "recordingFields":["variant_key","working_side","slider","surface","hip_height_policy","range","tempo","return_method","quality_repetitions","assistance","rest","cramping","symptoms","stop_reason"]
      }'::JSONB,
      support_operations_json = '{
        "supportSummary":"Do not improve range, laterality, tempo, or repetition count by accepting slider escape, hip drop, pelvic rotation, lumbar compensation, shortened range, faster lowering, changed return method, cramping, or symptoms.",
        "issueCategories":["identity_or_variant","difficulty_or_dose","surface_or_slider","symptom_or_population_constraint","instruction_or_accessibility","media_exact_match","relationship","calibration"],
        "supportEscalation":{"urgent":["fall_or_acute_hamstring_event","neurologic_or_cardiovascular_symptom"],"coachReview":["repeated_hip_pelvis_or_heel_path_fault","meaningful_side_difference","cramping_or_unclear_range_tempo_return"],"contentReview":["identity_boundary_conflict","media_mismatch","missing_accessibility_or_stop_rule"]},
        "retentionPolicy":"Retain card version, exact variant, side, slider, surface, hip-height policy, range, tempo, return method, repetitions, assistance, rest, quality, cramping, symptoms, stop reason, substitution, media metadata, and reviewer decisions according to facility policy.",
        "knownLimitations":["candidate_media_not_human_viewed","no_universal_range_tempo_dose_or_recovery","scores_doses_edges_and_calibrations_are_unapproved_proposals"],
        "changeImpactPolicy":"Changes to laterality, slider or surface, hip-height policy, knee range, contraction path, return method, tempo, difficulty, dose, stop rule, relationship, or media require a new card version and renewed affected reviews."
      }'::JSONB,
      approved_video_url = NULL,
      reviewed_by = NULL,
      approved_by = NULL,
      last_reviewed_at = NULL,
      provenance_json = provenance_json || jsonb_build_object(
        'structuralCompletionMigration', migration_key,
        'researchBatch', 'hamstring-slider-curl-family-v1',
        'researchVersion', '2026-07-27.54',
        'evidenceState', 'candidate_requires_human_review',
        'mediaState',
          'five_oembed_healthy_candidates_require_full_human_review',
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

  SELECT card_version
  INTO target_card_version
  FROM coaching.exercise_definition_v1
  WHERE id = target_definition_id;

  CREATE TEMP TABLE hamstring_slider_variant_seed (
    variant_key TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    laterality TEXT NOT NULL,
    range_key TEXT NOT NULL,
    contraction_path TEXT NOT NULL,
    return_method TEXT NOT NULL,
    hip_height_policy TEXT NOT NULL,
    complexity SMALLINT NOT NULL,
    physical SMALLINT NOT NULL,
    coordination SMALLINT NOT NULL,
    supervision SMALLINT NOT NULL,
    consequence SMALLINT NOT NULL,
    eccentric SMALLINT NOT NULL,
    local_fatigue SMALLINT NOT NULL,
    technical_fatigue SMALLINT NOT NULL,
    recovery_hours SMALLINT NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO hamstring_slider_variant_seed VALUES
    ('bilateral-short-range-bridge-reset','Bilateral Short-Range Hamstring Slider Curl','bilateral','short_owned_range','full_cycle','active_bilateral_curl','hips_lower_between_repetitions',28,32,30,24,28,38,36,36,24),
    ('bilateral-full-cycle','Bilateral Hamstring Slider Curl','bilateral','full_owned_range','full_cycle','active_bilateral_curl','hips_held_through_cycle',34,44,38,28,34,52,50,48,36),
    ('bilateral-eccentric-only-reset-down','Bilateral Eccentric Hamstring Slider Curl','bilateral','full_owned_range','eccentric_only','lower_hips_and_reset_heels','hips_held_during_slide_out',38,48,42,30,36,64,56,54,48),
    ('alternating-full-cycle','Alternating Hamstring Slider Curl','alternating','full_owned_range','full_cycle','alternating_active_curl','hips_held_through_cycle',44,52,54,34,40,58,60,62,48),
    ('single-leg-full-cycle','Single-Leg Hamstring Slider Curl','unilateral','full_owned_range','full_cycle','active_single_leg_curl','hips_level_and_held_through_cycle',50,62,64,42,52,66,72,72,60),
    ('single-leg-eccentric-only-assisted-return','Single-Leg Eccentric Hamstring Slider','unilateral','full_owned_range','eccentric_only','assisted_or_bilateral_return','hips_level_during_slide_out',52,66,68,46,56,78,78,78,72);

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
      seed.laterality,
      seed.range_key,
      seed.contraction_path,
      seed.return_method,
      seed.hip_height_policy,
      'declared_slider_surface_pair',
      'controlled_tempo'
    ]::TEXT[],
    jsonb_build_object(
      'technicalComplexity', seed.complexity,
      'absoluteLoadDemand', seed.physical,
      'baseOverallDifficulty',
        greatest(seed.complexity, seed.physical),
      'coordinationDemand', seed.coordination,
      'supervisionDemand', seed.supervision,
      'failureConsequence', seed.consequence,
      'impact', 1,
      'workCapacityDemand', seed.local_fatigue,
      'difficultyModel',
        'max_exercise_complexity_physical_difficulty',
      'dimensionMeaning', jsonb_build_object(
        'technicalComplexity', 'exercise_complexity',
        'absoluteLoadDemand', 'physical_difficulty'
      )
    ),
    jsonb_build_object(
      'selectable', TRUE,
      'support', 'supine_head_shoulders_and_trunk_on_floor',
      'laterality', seed.laterality,
      'heelSupport', 'declared_sliders_on_compatible_surface',
      'range', seed.range_key,
      'contractionPath', seed.contraction_path,
      'returnMethod', seed.return_method,
      'hipHeightPolicy', seed.hip_height_policy,
      'tempo', CASE
        WHEN seed.contraction_path = 'eccentric_only'
          THEN 'three_to_six_second_slide_out'
        ELSE 'controlled_out_and_in'
      END,
      'terminalAction',
        'controlled_hips_down_and_sliders_collected',
      'sideBalanceRequired',
        seed.laterality <> 'bilateral'
    ),
    'review',
    jsonb_build_object(
      'externalLoadMethod', 'bodyweight',
      'externalLoadDescription',
        'bodyweight transmitted through declared heel-slider contacts',
      'effectiveLoadDrivers', jsonb_build_array(
        'laterality',
        'heel_travel',
        'knee_extension',
        'hip_height',
        'surface_friction',
        'eccentric_duration',
        'return_method',
        'repetitions'
      ),
      'gripDemand', 1,
      'spinalLoading', 18,
      'eccentricStress', seed.eccentric,
      'landingContactsPerRep', 0,
      'impactClass', 'none',
      'loadTracking', jsonb_build_array(
        'variant',
        'working_side',
        'slider',
        'surface',
        'heel_travel',
        'hip_height_policy',
        'tempo',
        'return_method',
        'repetitions'
      )
    ),
    jsonb_build_object(
      'localMuscleFatigue', seed.local_fatigue,
      'gripFatigue', 1,
      'technicalFatigueSensitivity', seed.technical_fatigue,
      'impactAccumulation', 1,
      'recoveryHours', seed.recovery_hours,
      'primaryFatigueSites', jsonb_build_array(
        'hamstrings',
        'gluteals',
        'calves',
        'lumbopelvic_stabilizers'
      ),
      'earlyFatigueSignals', jsonb_build_array(
        'hip_height_loss',
        'pelvic_rotation',
        'heel_path_divergence',
        'shortened_range',
        'faster_eccentric',
        'changed_return_method',
        'cramping'
      ),
      'downstreamConflicts', jsonb_build_array(
        'max_velocity_sprinting',
        'acceleration',
        'nordic_hamstring_work',
        'high_load_hinges',
        'repeated_jumps'
      )
    ),
    jsonb_build_object(
      'primaryIntent',
        'quality_knee_flexion_strength_and_eccentric_control',
      'appropriatePhases', jsonb_build_array(
        'capacity',
        'resilience'
      ),
      'bestUse', CASE
        WHEN seed.contraction_path = 'eccentric_only'
          THEN 'declared_eccentric_control_with_exact_reset'
        ELSE 'controlled_knee_flexion_strength'
      END,
      'avoidUse', jsonb_build_array(
        'conditioning_race',
        'uncontrolled_to_failure',
        'fatigue_degraded_range_or_return',
        'symptom_provocation'
      ),
      'cumulativeBudget', jsonb_build_object(
        'hamstringStrengthSets', 1,
        'eccentricStress', seed.eccentric,
        'localFatigue', seed.local_fatigue,
        'technicalSensitivity', seed.technical_fatigue,
        'impact', 1
      )
    )
  FROM hamstring_slider_variant_seed seed
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
    'primary',
    CASE profile.profile_key
      WHEN 'capacity-strength'
        THEN 'Build repeatable hamstring knee-flexion strength through the exact slider range and laterality while preserving hip, pelvis, trunk, heel path, and return control.'
      ELSE 'Build controlled hamstring lengthening and return-method ownership at submaximal quality without converting the set into symptom provocation or uncontrolled fatigue.'
    END,
    CASE profile.profile_key
      WHEN 'capacity-strength' THEN 92
      ELSE 88
    END,
    92,
    jsonb_build_object(
      'kneeFlexionStrength', CASE
        WHEN seed.contraction_path = 'full_cycle' THEN 94
        ELSE 78
      END,
      'eccentricControl', CASE
        WHEN seed.contraction_path = 'eccentric_only' THEN 96
        ELSE 84
      END,
      'lumbopelvicControl', seed.coordination,
      'lowImpact', 100,
      'fatigueCost', seed.local_fatigue
    ),
    CASE profile.profile_key
      WHEN 'capacity-strength' THEN jsonb_build_object(
        'sets', jsonb_build_object(
          'minimum', 2,
          'target', 3,
          'maximum', 4
        ),
        'qualityRepetitions', jsonb_build_object(
          'minimum', 4,
          'target', CASE
            WHEN seed.laterality = 'unilateral' THEN 6
            ELSE 8
          END,
          'maximumWithoutReview', CASE
            WHEN seed.laterality = 'unilateral' THEN 8
            ELSE 12
          END
        ),
        'effort', jsonb_build_object(
          'targetRir', 2,
          'minimumRir', 1,
          'technicalFailureProhibited', TRUE
        ),
        'restSeconds', jsonb_build_object(
          'minimum', 60,
          'target', 120,
          'maximum', 180
        )
      )
      ELSE jsonb_build_object(
        'sets', jsonb_build_object(
          'minimum', 2,
          'target', 3,
          'maximum', 4
        ),
        'qualityRepetitions', jsonb_build_object(
          'minimum', 3,
          'target', CASE
            WHEN seed.laterality = 'unilateral' THEN 4
            ELSE 6
          END,
          'maximumWithoutReview', CASE
            WHEN seed.laterality = 'unilateral' THEN 6
            ELSE 8
          END
        ),
        'eccentricSeconds', jsonb_build_object(
          'minimum', 3,
          'target', 4,
          'maximumWithoutReview', 6
        ),
        'restSeconds', jsonb_build_object(
          'minimum', 75,
          'target', 120,
          'maximum', 180
        )
      )
    END,
    'A repetition counts only when the heel remains centered on the slider, the declared path and range are controlled, hips follow the exact height policy, pelvis and ribs remain quiet, tempo and return method match the variant, breathing remains organized, and the finish is controlled.',
    ARRAY[
      'sharp_or_increasing_pain_hamstring_pull_or_grab',
      'cramping_that_changes_motion',
      'numbness_dizziness_giving_way_or_apprehension',
      'unsafe_surface_slider_escape_or_cross_traffic',
      'hip_drop_pelvic_rotation_or_lumbar_compensation',
      'heel_path_range_tempo_or_return_method_changes',
      'cannot_complete_declared_return_or_safe_finish'
    ]::TEXT[],
    'Inspect the floor, sliders, heel path, and head and shoulder support. Declare variant, side, range, hip-height policy, tempo, return, repetitions, rest, and stop signal. Rehearse short range, then observe heel path, hip and pelvis control, range, tempo, breathing, cramping, fatigue, and finish.',
    CASE seed.contraction_path
      WHEN 'eccentric_only'
        THEN 'Set your heel or heels, lift and hold the hips as assigned, slide out for the declared count, then lower or use assistance for the exact reset. Stop before a cramp or loss of control changes the rep.'
      ELSE 'Set your heel or heels, organize the bridge, slide out only as far as you can own, curl back without dropping or turning the hips, then reset before the next rep.'
    END,
    CASE profile.profile_key
      WHEN 'capacity-strength'
        THEN 'More repeatable hamstring knee-flexion strength through the declared range with preserved heel, hip, pelvis, trunk, and return control.'
      ELSE 'More repeatable controlled hamstring lengthening and return-method execution at the declared range and tempo.'
    END,
    ARRAY['sliders']::TEXT[],
    jsonb_build_object(
      'stationFootprintMeters', jsonb_build_object(
        'length', 3,
        'width', 1.5
      ),
      'athletesPerStation', 1,
      'setupSeconds', 60,
      'transitionSeconds', 20,
      'matchedSlidersRequired', TRUE,
      'surfaceCompatibilityCheckRequired', TRUE,
      'clearHeelTravelRequired', TRUE,
      'noCrossTraffic', TRUE
    ),
    '{}'::UUID[],
    'review',
    jsonb_build_object(
      'setupSeconds', 60,
      'secondsPerRep', CASE
        WHEN seed.contraction_path = 'eccentric_only' THEN 7
        ELSE 5
      END,
      'resetSecondsPerRep', CASE
        WHEN seed.contraction_path = 'eccentric_only' THEN 5
        ELSE 2
      END,
      'restSeconds', jsonb_build_object(
        'minimum', CASE
          WHEN profile.profile_key = 'resilience-eccentric-control'
            THEN 75
          ELSE 60
        END,
        'target', 120,
        'maximum', 180
      ),
      'durationFormula',
        'setup + sets * repetitions * (seconds_per_rep + reset_seconds) + interset_rest'
    ),
    jsonb_build_object(
      'progressionOrder', jsonb_build_array(
        'short_range_bilateral_control',
        'full_range_bilateral_control',
        'eccentric_duration_or_alternating_laterality',
        'single_leg_only_for_matching_goal'
      ),
      'regressionOrder', jsonb_build_array(
        'shorten_range',
        'bilateral_support',
        'hips_lower_between_repetitions',
        'assisted_return',
        'fewer_repetitions',
        'longer_rest'
      ),
      'neverAutoScale', jsonb_build_array(
        'pain_pull_or_neurologic_symptom',
        'cramping_that_changes_motion',
        'unsafe_surface_or_slider',
        'persistent_side_difference',
        'hip_pelvis_or_return_control_loss'
      ),
      'sideBalanceRequired',
        seed.laterality <> 'bilateral'
    ),
    jsonb_build_object(
      'record', jsonb_build_array(
        'variant_key',
        'working_side',
        'slider',
        'surface',
        'hip_height_policy',
        'range',
        'tempo',
        'return_method',
        'quality_repetitions',
        'assistance',
        'rest',
        'cramping',
        'symptoms',
        'stop_reason'
      ),
      'successfulRepetitionStandard',
        'Centered heel path, exact range, hip-height policy, quiet pelvis and ribs, declared tempo and return, organized breathing, and controlled finish.',
      'progressionThreshold',
        'Progress only after every planned repetition passes every gate without symptom, cramping that changes motion, or meaningful side difference.'
    ),
    jsonb_build_object(
      'athletePrompt',
        'Report pain, pulling, a hamstring grab, cramping, numbness, dizziness, slider escape, side difference, or uncertainty about the return before continuing.',
      'coachPrompt',
        'Record actual quality repetitions and stopped attempts, not only planned repetitions; do not count a changed return or uncontrolled last third.',
      'accessibilityPrompt',
        'Offer shorter range, bilateral support, hips down between reps, assisted return, fewer repetitions, longer rest, and written, still-image, walkthrough, or live instruction.'
    )
  FROM hamstring_slider_variant_seed seed
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id = target_definition_id
   AND variant.variant_key = seed.variant_key
  CROSS JOIN (
    VALUES
      ('capacity-strength','capacity'),
      ('resilience-eccentric-control','resilience')
  ) AS profile(profile_key, phase_key)
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
    target_card_version,
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
      ('identity','https://pubmed.ncbi.nlm.nih.gov/41318473/','Persistent neuromuscular deficits in the posterior kinetic chain following hamstring strain injury: EMG insights from nordic hamstring curl, kettlebell swing, and supine sliding leg curl','Journal of Orthopaedic Surgery and Research','peer_reviewed_research',82,'["The stable identity is a supine sliding leg curl with declared heel-slider support, knee extension and flexion action, hip-height policy, laterality, range, return, tempo, and dose.","Slider or towel, bilateral or unilateral execution, range, full-cycle or eccentric-only action, and assistance are exact variants when the supine sliding knee-flexion contract remains unchanged."]'::JSONB),
      ('taxonomy','https://pubmed.ncbi.nlm.nih.gov/27467123/','Impact of exercise selection on hamstring muscle activation','British Journal of Sports Medicine','peer_reviewed_research',87,'["Classify the family as floor-supported knee flexion and eccentric knee-extension control with a bridge constraint, not as a hip hinge, machine curl, or locomotor task.","Exact cards declare laterality, support, range, contraction path, return method, tempo, dose, and finish."]'::JSONB),
      ('anatomy','https://pubmed.ncbi.nlm.nih.gov/27467123/','Impact of exercise selection on hamstring muscle activation','British Journal of Sports Medicine','peer_reviewed_research',87,'["Hamstrings provide knee-flexion and eccentric knee-extension force while gluteals and trunk contribute to bridge and lumbopelvic control; calves may assist through heel contact.","The card records regional anatomy without claiming isolation or equal recruitment."]'::JSONB),
      ('biomechanics','https://pubmed.ncbi.nlm.nih.gov/41730607/','Hamstring force and stretch during progressively increasing running speeds and the eccentric phase of resistance training exercises commonly used for injury prevention and rehabilitation','British Journal of Sports Medicine','peer_reviewed_research',91,'["Unilateral eccentric slider execution can create substantial hamstring force, while force and stretch differ from sprinting and other hamstring exercises.","Laterality, range, hip position, eccentric speed, assistance, friction, and fatigue must be declared."]'::JSONB),
      ('difficulty','https://pubmed.ncbi.nlm.nih.gov/41730607/','Hamstring force and stretch during progressively increasing running speeds and the eccentric phase of resistance training exercises commonly used for injury prevention and rehabilitation','British Journal of Sports Medicine','peer_reviewed_research',91,'["Single-leg and eccentric-only execution raise physical and control demand relative to short-range bilateral repetitions.","Each variant is scored for exercise complexity and physical difficulty only; overall is their maximum."]'::JSONB),
      ('load_fatigue_recovery','https://pubmed.ncbi.nlm.nih.gov/41730607/','Hamstring force and stretch during progressively increasing running speeds and the eccentric phase of resistance training exercises commonly used for injury prevention and rehabilitation','British Journal of Sports Medicine','peer_reviewed_research',91,'["Effective bodyweight load changes with laterality, lever length, friction, hip height, range, tempo, assistance, and fatigue.","Track hamstring and calf fatigue, cramping, hip-height loss, range, eccentric speed, pelvic rotation, soreness, and recovery before other high-force hamstring work."]'::JSONB),
      ('constraints','https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/','American College of Sports Medicine Position Stand. Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews','Medicine and Science in Sports and Exercise','professional_standard',96,'["Resistance exercise requires an exact controllable task, appropriate dose, and progression.","Use a clean level floor, matched intact sliders or towels on a compatible surface, clear heel travel, comfortable support, and no cross-traffic."]'::JSONB),
      ('dosage','https://pmc.ncbi.nlm.nih.gov/articles/PMC10579494/','Resistance training prescription for muscle strength and hypertrophy in healthy adults: a systematic review and Bayesian network meta-analysis','British Journal of Sports Medicine','peer_reviewed_research',94,'["Resistance outcomes depend on sets, repetitions, load, effort, frequency, and recovery rather than an exercise name alone.","Use quality repetitions with enough rest to preserve exact range, tempo, bridge, heel path, return, and stop rules."]'::JSONB),
      ('instructions','https://pubmed.ncbi.nlm.nih.gov/41318473/','Persistent neuromuscular deficits in the posterior kinetic chain following hamstring strain injury: EMG insights from nordic hamstring curl, kettlebell swing, and supine sliding leg curl','Journal of Orthopaedic Surgery and Research','peer_reviewed_research',82,'["Instruction establishes the supine start, heel-slider contact, bridge, knee-extension slide, active curl or assisted reset, breathing, and finish.","Cue quiet ribs and pelvis, heel pressure, exact hip-height policy, controlled travel, and a complete reset."]'::JSONB),
      ('safety_stop_rules','https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf','Youth Resistance Training: Updated Position Statement Paper From the NSCA','National Strength and Conditioning Association','professional_standard',88,'["Qualified supervision, correct technique, manageable resistance, and gradual progression are core safeguards.","Stop pain, pull, cramping that changes motion, neurologic symptoms, slider escape, uncontrolled extension, hip or pelvis loss, changed return, or unsafe finish."]'::JSONB),
      ('programming','https://pubmed.ncbi.nlm.nih.gov/41730607/','Hamstring force and stretch during progressively increasing running speeds and the eccentric phase of resistance training exercises commonly used for injury prevention and rehabilitation','British Journal of Sports Medicine','peer_reviewed_research',91,'["Slider curls are one knee-flexion posterior-chain option and differ from sprinting, RDLs, bridges, and Nordic curls.","Account for cumulative sprint, hinge, Nordic, jump, soreness, strain-history, eccentric, and recovery exposure."]'::JSONB),
      ('athlete_support','https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/','American College of Sports Medicine Position Stand. Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews','Medicine and Science in Sports and Exercise','professional_standard',96,'["Athletes need exact side, slider, range, hip height, tempo, return, dose, effort, and stop rules before beginning.","A shorter controlled range is preferable to slider escape, hip drop, pelvic turn, cramping, or uncontrolled travel."]'::JSONB),
      ('coach_support','https://pubmed.ncbi.nlm.nih.gov/41730607/','Hamstring force and stretch during progressively increasing running speeds and the eccentric phase of resistance training exercises commonly used for injury prevention and rehabilitation','British Journal of Sports Medicine','peer_reviewed_research',91,'["Coach observation verifies surface, slider, heel path, hip height, pelvis, ribs, knee range, tempo, assistance, sides, symptoms, fatigue, and finish.","Actual quality and stopped repetitions remain traceable."]'::JSONB),
      ('accessibility','https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/','American College of Sports Medicine Position Stand. Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews','Medicine and Science in Sports and Exercise','professional_standard',96,'["Individualize range, laterality, return assistance, repetitions, rest, equipment, and instruction format without classifying the exercise by athlete proficiency.","Use bilateral, short-range, hips-down reset, or assisted-return variants when appropriate."]'::JSONB),
      ('alternates','https://pubmed.ncbi.nlm.nih.gov/27467123/','Impact of exercise selection on hamstring muscle activation','British Journal of Sports Medicine','peer_reviewed_research',87,'["Nordic curls, machine curls, Swiss-ball curls, bridges, RDLs, and sliders have different support, joint motion, force, or length contracts.","Bilateral, alternating, single-leg, short-range, full-cycle, and eccentric-only sliders are exact variants when fully declared."]'::JSONB),
      ('media','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en','Embed videos and playlists','YouTube Help','manufacturer_instruction',82,'["Five candidates returned current oEmbed title and channel metadata naming the slider-curl family or exact eccentric variant.","Playback, full viewing, exact execution, cue, safety, caption, accessibility, reviewer, and approval remain unresolved."]'::JSONB)
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
    target_card_version,
    'https://www.youtube.com/watch?v=' || media.video_id,
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
    'YouTube oEmbed title/channel metadata checked 2026-07-27. Title-level candidate only; playback, complete viewing, exact variant, cue, safety, caption, accessibility, reviewer, and approval review remain unresolved.'
  FROM (
    VALUES
      ('AlTI3igOaLw','Exercise Tutorial: Hamstring Curl With Slider','Travis Tarrant','inherited hamstring slider curl candidate'),
      ('4lp8W4ztK4k','Slider Hamstring Curl','Peak Athletic Training','inherited slider hamstring curl candidate'),
      ('5HSIt7T8JCk','Alternating Hamstring Slide Curl Demo','Steph Gaudreau - Fuel Your Strength','inherited alternating hamstring slider candidate'),
      ('URPkeNfJN0I','Bilateral (Double) Leg Hamstring Slider   Eccentric Focus','Activ8 Health Club','inherited bilateral eccentric slider candidate'),
      ('2ShLmP5NL5w','Single Leg Eccentric Hamstring Slider','healthandperformance','inherited single-leg eccentric slider candidate')
  ) AS media(
    video_id,
    title,
    channel_name,
    source_query
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
    discovery_method = EXCLUDED.discovery_method,
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
    target_card_version,
    alternate.alternate_name,
    alternate.classification,
    alternate.rationale,
    alternate.dimensions,
    CASE
      WHEN alternate.classification = 'new_definition'
        THEN jsonb_build_object(
          'status', 'proposal_only',
          'humanReviewRequired', TRUE,
          'sourceCard', 'hamstring-slider-curl'
        )
      ELSE NULL
    END,
    'candidate',
    NULL,
    NULL
  FROM (
    VALUES
      ('Sliding Hamstring Curl','same_identity','Sliding and slider describe the same low-friction heel-travel action.','{"alias":true}'::JSONB),
      ('Bilateral Short-Range Slider Curl','new_variant','Shorter heel travel changes lever length and physical demand within the same action.','{"variantKey":"bilateral-short-range-bridge-reset"}'::JSONB),
      ('Sliding Hamstring Curl Eccentric','new_variant','Eccentric-only slide-out with hips lowered for reset changes contraction, return, tempo, and dose.','{"variantKey":"bilateral-eccentric-only-reset-down"}'::JSONB),
      ('Alternating Hamstring Slider Curl','new_variant','Alternating legs changes laterality and stabilization while preserving the action.','{"variantKey":"alternating-full-cycle"}'::JSONB),
      ('Single-Leg Hamstring Slider Curl','new_variant','One working heel changes laterality, load, pelvic control, and fatigue within the same action.','{"variantKey":"single-leg-full-cycle"}'::JSONB),
      ('Single-Leg Eccentric Hamstring Slider','new_variant','Unilateral eccentric travel with assisted return preserves the action while changing contraction and demand.','{"variantKey":"single-leg-eccentric-only-assisted-return"}'::JSONB),
      ('Swiss-Ball Hamstring Curl','new_definition','A rolling unstable ball changes support geometry, friction, ankle contact, balance, and return.','{"implement":"swiss_ball"}'::JSONB),
      ('Nordic Hamstring Curl','new_definition','Tall-kneeling forward fall with fixed ankles changes support, joint action, force direction, and failure response.','{"support":"fixed_ankles_tall_kneeling"}'::JSONB),
      ('Machine Leg Curl','new_definition','A fixed-path machine and external resistance arm change posture, load, setup, and equipment.','{"equipment":"leg_curl_machine"}'::JSONB),
      ('Romanian Deadlift','new_definition','Standing hip-dominant hinge loading differs from floor-supported knee-flexion slider mechanics.','{"primaryAction":"loaded_hip_hinge"}'::JSONB),
      ('Slider Surface Friction','modifier_annotation','Surface and slider pairing changes effective resistance and must be recorded without creating an athlete level.','{"modifier":"declared_slider_surface_pair"}'::JSONB)
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
      ('bilateral-short-range-bridge-reset','bilateral-full-cycle','progression',94,ARRAY['range','load','hip_control']::TEXT[],'Increase heel travel and maintain the bridge only after every short-range repetition is controlled.','{"requires":["pain_free_short_range","centered_heel_paths","quiet_pelvis_and_ribs","no_cramp_or_symptom"]}'::JSONB),
      ('bilateral-full-cycle','bilateral-short-range-bridge-reset','regression',98,ARRAY['range','load','hip_control']::TEXT[],'Shorter range and hips-down reset reduce lever and continuous bridge demand.','{"useWhen":["range_shortens","hip_height_changes","cramping_or_fatigue_increases","confidence_requires_lower_demand"]}'::JSONB),
      ('bilateral-full-cycle','bilateral-eccentric-only-reset-down','lateral_substitution',90,ARRAY['contraction','return_method','tempo']::TEXT[],'Eccentric-only slide-out retains bilateral slider control while removing the active curl return.','{"useWhen":["goal_is_eccentric_control","active_return_not_prescribed","exact_reset_is_safe"]}'::JSONB),
      ('bilateral-eccentric-only-reset-down','bilateral-full-cycle','lateral_substitution',88,ARRAY['contraction','return_method','tempo']::TEXT[],'Full-cycle bilateral execution adds active knee-flexion return when that is the training objective.','{"requires":["controlled_active_return","declared_range_and_tempo"]}'::JSONB),
      ('bilateral-full-cycle','alternating-full-cycle','progression',88,ARRAY['laterality','load','pelvic_control']::TEXT[],'Alternating execution increases unilateral load and pelvic-control demand while preserving full-cycle action.','{"requires":["repeatable_bilateral_full_cycle","no_meaningful_side_difference","quiet_pelvis"]}'::JSONB),
      ('alternating-full-cycle','bilateral-full-cycle','regression',96,ARRAY['laterality','load','pelvic_control']::TEXT[],'Bilateral support reduces unilateral load and rotation demand.','{"useWhen":["pelvic_rotation","side_difference","single_side_fatigue","range_or_return_changes"]}'::JSONB),
      ('alternating-full-cycle','single-leg-full-cycle','progression',84,ARRAY['laterality','load','pelvic_control']::TEXT[],'Single-leg full-cycle execution increases continuous unilateral force and control demand.','{"requires":["repeatable_alternating_full_cycle","level_hips","no_symptom_or_cramp","matched_side_control"]}'::JSONB),
      ('single-leg-full-cycle','alternating-full-cycle','regression',94,ARRAY['laterality','load','pelvic_control']::TEXT[],'Alternating execution reduces continuous single-side load while preserving unilateral exposures.','{"useWhen":["single_leg_return_fails","hip_or_pelvis_control_changes","side_fatigue_accumulates"]}'::JSONB),
      ('single-leg-full-cycle','single-leg-eccentric-only-assisted-return','lateral_substitution',88,ARRAY['contraction','return_method','tempo']::TEXT[],'Eccentric-only assisted-return execution emphasizes controlled lengthening without requiring an active single-leg curl return.','{"useWhen":["goal_is_unilateral_eccentric_control","assisted_return_is_available_and_safe"]}'::JSONB),
      ('single-leg-eccentric-only-assisted-return','bilateral-eccentric-only-reset-down','regression',92,ARRAY['laterality','load','pelvic_control']::TEXT[],'Bilateral eccentric-only execution reduces unilateral force and rotation demand while preserving the slide-out contract.','{"useWhen":["single_leg_control_or_tolerance_is_not_repeatable","side_difference_requires_review"]}'::JSONB)
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
        'Proposed exercise complexity from slider setup, heel-path control, laterality, hip-height policy, range, tempo, return method, pelvic control, breathing, and finish.'
      ),
      (
        'absoluteLoadDemand',
        (variant.difficulty_json ->> 'absoluteLoadDemand')::SMALLINT,
        'Proposed physical difficulty from bodyweight lever length, laterality, knee range, hip height, surface friction, eccentric duration, active or assisted return, local fatigue, and recovery.'
      ),
      (
        'technicalFatigueSensitivity',
        (variant.fatigue_profile_json ->>
          'technicalFatigueSensitivity')::SMALLINT,
        'Proposed from hip-height loss, pelvic rotation, heel-path divergence, shortened range, faster eccentric, changed return, cramping, and symptom response under fatigue.'
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
    target_card_version,
    '1.0.0',
    'canonical-card-audit-v1',
    'quarantined',
    '[]'::JSONB,
    jsonb_build_array(
      jsonb_build_object(
        'code', 'media_human_review_required',
        'message',
          'Five oEmbed-healthy title-level candidates require playback, complete viewing, exact-variant, cue, safety, caption, accessibility, reviewer, and approval review.'
      ),
      jsonb_build_object(
        'code', 'identity_boundary_human_review_required',
        'message',
          'The eccentric-source consolidation, exact variants, and alternate classifications require accountable human review before publication.'
      ),
      jsonb_build_object(
        'code', 'graph_human_review_required',
        'message',
          'Ten progression, regression, and substitution proposals require coach approval.'
      ),
      jsonb_build_object(
        'code', 'calibration_human_review_required',
        'message',
          'Exercise-complexity, physical-difficulty, and technical-fatigue proposals require independent calibration.'
      ),
      jsonb_build_object(
        'code', 'athlete_coach_pilot_required',
        'message',
          'Athlete comprehension, coach scoring, cramp and symptom handling, dose tolerance, side recording, and station logistics require representative pilot evidence.'
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
