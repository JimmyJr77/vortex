-- Complete the consolidated Alternating Bounds survivor.
--
-- The stable slug remains alternate-leg-bound-for-distance. Exact selectable
-- variants separate traditional mixed height-distance bounding from
-- sprint-oriented distance bounding. Projection emphasis, contact-time intent,
-- distance, contacts, effort, and measurement are explicit.
--
-- Five title-matched YouTube candidates have current oEmbed metadata only.
-- Three inherited links are retained as traceable title-level mismatches.
-- No full-video review, exact-match approval, accessibility approval, graph
-- approval, calibration approval, human review, or publication is claimed.
--
-- Exercise difficulty is exercise complexity plus physical difficulty, with
-- overall derived as their maximum. Skill/proficiency levels belong only to
-- coaching.skill and are intentionally absent here.
-- IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '367_coaching_alternating_bounds_family_completion';
  target_definition_id UUID;
  facility BIGINT;
  protected_records INTEGER;
  unexpected_variants INTEGER;
BEGIN
  SELECT id, facility_id
  INTO target_definition_id, facility
  FROM coaching.exercise_definition_v1
  WHERE facility_id = 1
    AND slug = 'alternate-leg-bound-for-distance'
    AND status <> 'archived';

  IF target_definition_id IS NULL THEN
    RAISE EXCEPTION
      '% requires active alternate-leg-bound-for-distance survivor',
      migration_key;
  END IF;

  IF (
    SELECT COUNT(*)
    FROM coaching.exercise_identity_resolution_v1 resolution
    JOIN coaching.exercise_definition_v1 duplicate
      ON duplicate.id = resolution.resolved_definition_id
    WHERE resolution.survivor_definition_id = target_definition_id
      AND duplicate.slug = 'alternate-bounds-for-height-and-distance'
      AND resolution.decision = 'duplicate_consolidated'
  ) <> 1 THEN
    RAISE EXCEPTION
      '% requires the alternating-bound identity consolidation',
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
      'traditional-height-distance',
      'sprint-bound-distance'
    );

  IF unexpected_variants > 0 THEN
    RAISE EXCEPTION
      '% found % unexpected active variant(s)',
      migration_key,
      unexpected_variants;
  END IF;

  UPDATE coaching.exercise_definition_v1
  SET canonical_name = 'Alternating Bounds',
      display_name = 'Alternating Bounds',
      description =
        'From a declared start, perform consecutive forward bounds with one-foot takeoff and landing on alternating legs, coordinated contralateral arm action, and the exact projection and contact-time intent named by the variant. Preserve posture, active contacts under the body, side-to-side rhythm, and a controlled run-out; stop before reaching, collapse, asymmetry, contact noise, or output loss.',
      aliases = ARRAY(
        SELECT min(alias)
        FROM unnest(
          aliases
          || ARRAY[
            'Alternate-Leg Bound for Distance',
            'Alternate Leg Bound for Distance',
            'Alternating Bounds for Distance',
            'Alternate Bounds for Height and Distance',
            'Alternating Bounds for Height and Distance',
            'Alternate-Leg Bounds',
            'Sprint Bounds',
            'Power Bounds'
          ]::TEXT[]
        ) alias
        WHERE nullif(btrim(alias), '') IS NOT NULL
          AND lower(btrim(alias)) <> 'alternating bounds'
        GROUP BY lower(btrim(alias))
        ORDER BY lower(btrim(alias))
      ),
      family_key = 'alternating_unilateral_horizontal_multistep_bound',
      schema_version = '1.0.0',
      card_version = 2,
      status = 'review',
      content_confidence = 88,
      scoring_confidence = 70,
      media_confidence = 42,
      movement_patterns = ARRAY['jump','locomote']::TEXT[],
      body_regions = ARRAY[
        'foot',
        'ankle',
        'calf',
        'knee',
        'hip',
        'glutes',
        'hamstrings',
        'core',
        'shoulder',
        'full_body'
      ]::TEXT[],
      required_equipment = '{}'::TEXT[],
      optional_equipment = ARRAY[
        'cones',
        'line_tape',
        'timing_gates'
      ]::TEXT[],
      anatomy_json = '{
        "primaryMuscles":["gluteus_maximus","hamstrings","quadriceps","soleus","gastrocnemius"],
        "secondaryMuscles":["hip_flexors","gluteus_medius","adductors","tibialis_anterior","foot_intrinsics","deltoids","latissimus_dorsi"],
        "stabilizers":["abdominal_wall","spinal_stabilizers","hip_external_rotators","peroneals","rotator_cuff","scapular_stabilizers"],
        "joints":["shoulder","thoracic_spine","lumbar_spine","pelvis","hip","knee","ankle","subtalar","metatarsophalangeal"],
        "jointActions":["contralateral_arm_swing","trunk_stabilization","hip_flexion_and_extension","knee_flexion_and_extension","ankle_dorsiflexion_and_plantarflexion","foot_ankle_stiffness_regulation","alternating_single_support_landing_and_takeoff"],
        "planes":["sagittal","frontal_control","transverse_control"],
        "laterality":"alternating_unilateral",
        "lateralityNote":"Every counted sequence alternates contacts; record the starting leg and inspect side-to-side projection, contact, hip height, trunk rotation, and confidence.",
        "kineticChain":"repeated_alternating_unilateral_closed_chain_stretch_shortening_contacts",
        "evidenceLimit":"Research supports horizontal multi-step plyometrics and distinguishes traditional from sprint bounding, but it does not validate these exact card scores, doses, or outcomes for every athlete."
      }'::JSONB,
      environment_json = '{
        "surface":{"required":"flat_dry_stable_high_traction_with_appropriate_compliance","avoid":["wet","uneven","debris","very_hard_for_repeated_maximal_contacts","soft_unstable"]},
        "space":{"straightLaneMeters":{"minimum":15,"target":25,"maximumWithoutReview":40},"clearRunOutMeters":{"minimum":5,"target":8},"crossTrafficProhibited":true,"returnTrafficOutsideActiveLane":true},
        "setup":{"variant_distance_or_contacts_intensity_start_finish_and_run_out_declared":true,"startAndFinishMarked":true,"footwearAndSurfaceRecorded":true},
        "observation":{"coachCanSeeFrontalAndSagittalMechanics":true,"videoOnlyWithConsentAndPolicy":true},
        "traffic":{"oneActiveAthletePerLane":true,"laneSeparationMeters":3,"athleteWaitsForLaneClearCommand":true}
      }'::JSONB,
      population_json = '{
        "prerequisites":["pain_free_running_jumping_and_landing","repeatable_bilateral_pogo","repeatable_single_leg_hop_or_pogo","can_control_single_leg_landing_and_run_out","understands_variant_contact_and_stop_rules"],
        "useCaution":["current_foot_ankle_achilles_calf_knee_hamstring_hip_or_back_symptoms","recent_lower_extremity_procedure","limited_unilateral_plyometric_exposure","meaningful_side_difference","fatigue_from_prior_sprint_jump_or_calf_work"],
        "doNotUseWhen":["pain_limp_giving_way_or_neurologic_symptom","unsafe_surface_lane_or_run_out","cannot_control_submaximal_alternating_contacts","contacts_are_loud_reaching_or_collapsing","fatigue_already_changes_running_or_landing"],
        "regressionOrder":["reduce_intensity","reduce_distance_or_contacts","traditional_mixed_projection_variant","lower_amplitude","longer_rest","reviewed_single_leg_pogo_or_running_substitution"],
        "individualizationRequired":true,
        "medicalScope":"This card is not rehabilitation, tendon treatment, diagnosis, or clearance; follow the athlete care plan and local scope."
      }'::JSONB,
      athlete_support_json = '{
        "whyItMatters":"Builds repeated alternating single-leg projection, rhythm, and elastic force application for sprinting and horizontal jumping.",
        "primaryCue":"Project from the ground, switch legs in the air, land actively under you, keep the hips tall, and run out under control.",
        "beforeYouStart":["confirm_variant_start_leg_distance_or_contacts_intensity_finish_and_run_out","inspect_surface_footwear_and_lane","rehearse_two_to_four_submaximal_contacts","identify_stop_signal"],
        "expectedSensations":["brief_powerful_glute_hamstring_quadriceps_and_calf_effort","spring_like_but_controlled_contacts","coordinated_arm_drive","high_attention_to_rhythm"],
        "unexpectedSensations":["sharp_or_increasing_pain","achilles_or_calf_grab","hamstring_pull","giving_way","numbness_or_tingling","dizziness","fear_or_loss_of_control"],
        "selfChecks":["legs_alternate_every_contact","foot_contacts_under_or_near_hips_without_reaching","hips_and_trunk_remain_organized","left_and_right_contacts_look_similar","contact_sound_and_rhythm_remain_repeatable","run_out_stays_inside_lane"],
        "painGuidance":"Stop, use the run-out, and report pain, pulling, giving way, numbness, dizziness, fall, or loss of lane or landing control.",
        "accessibility":["lower_intensity","shorter_distance","fewer_contacts","traditional_variant_before_sprint_variant","longer_rest","live_walkthrough","still_image_contact_sequence","nonvideo_written_cues"],
        "mediaAlternatives":["lane_and_contact_diagram","front_and_side_stills","slow_walkthrough","live_coach_demonstration","written_contact_checklist"],
        "afterSetCheck":["record_variant_start_leg_actual_distance_contacts_time_quality_asymmetry_symptoms_and_stop_reason"]
      }'::JSONB,
      coach_support_json = '{
        "observationChecklist":["surface_footwear_lane_and_run_out","variant_and_start_leg","approach_or_first_contact","projection_angle","foot_contact_relative_to_hips","contact_time_intent","hip_height","knee_and_foot_alignment","contralateral_arm_timing","left_right_symmetry","finish_and_run_out","output_and_fatigue"],
        "faultCorrections":{"reaching_or_braking_contact":["reduce_distance_intent","cue_hips_through_and_land_under_body"],"low_or_collapsing_hips":["reduce_contacts","return_to_submaximal_traditional_variant"],"loud_or_slow_contacts":["end_set_or_reduce_intensity","increase_recovery"],"side_difference":["record_start_leg_and_side","reduce_dose","use_reviewed_unilateral_regression"],"arm_leg_timing_loss":["walkthrough_alternation","reduce_speed_and_contacts"],"unsafe_finish":["extend_run_out","reduce_distance","rebuild_lane"]},
        "demonstrationPlan":["show_alternating_one_foot_contacts","show_traditional_mixed_projection","show_sprint_bound_shorter_contact_intent","show_active_contact_under_body","show_controlled_run_out","contrast_same_leg_hops_straight_leg_bounds_skips_and_reaching"],
        "groupManagement":["one_active_athlete_per_lane","athlete_starts_only_on_clear_command","return_outside_active_lane","separate_maximal_attempts_with_full_recovery","count_contacts_and_distance_consistently"],
        "modificationDecisionTree":{"alternation_or_landing_not_controlled":"reduce_to_submaximal_traditional_contacts","traditional_repeatable_and_goal_is_speed":"consider_sprint_bound_variant","contact_or_output_declines":"end_set_or_increase_rest","side_difference_persists":"stop_and_review","symptom_or_lane_hazard":"stop"},
        "doNotUseWhen":["pain_limp_giving_way_or_neurologic_symptom","unsafe_surface_lane_cross_traffic_or_run_out","submaximal_alternating_contacts_are_not_controlled","reaching_collapse_or_meaningful_asymmetry_persists","fatigue_already_changes_running_jumping_or_landing"],
        "recordingFields":["variant_key","start_leg","distance_target","contact_target","actual_distance","actual_contacts","time_when_used","intensity","contact_quality","side_difference","rest","symptoms","stop_reason"]
      }'::JSONB,
      support_operations_json = '{
        "supportSummary":"Never improve a distance or time result by accepting reaching, alternating errors, collapse, asymmetry, unsafe surface, shortened run-out, or fatigue-degraded contacts.",
        "issueCategories":["identity_or_variant","difficulty_or_dose","surface_or_lane","media_exact_match","accessibility","pain_or_impact","relationship","calibration"],
        "supportEscalation":{"urgent":["fall_or_acute_lower_extremity_event","suspected_achilles_calf_or_hamstring_injury","neurologic_or_cardiovascular_symptom"],"coachReview":["repeated_reaching_or_contact_collapse","persistent_side_difference","unclear_variant_or_dose"],"contentReview":["media_mismatch","conflicting_traditional_or_sprint_instruction","missing_accessibility","identity_boundary_conflict"]},
        "retentionPolicy":"Retain card version, exact variant, start leg, surface, footwear, distance, contacts, time when used, intensity, quality, asymmetry, rest, symptoms, stop reason, media metadata, and reviewer decisions according to facility policy.",
        "knownLimitations":["candidate_media_not_human_viewed","no_universal_contact_time_or_distance_target","exact_scores_doses_edges_and_calibrations_are_unapproved_proposals"],
        "changeImpactPolicy":"Changes to contact pattern, leg sequence, knee strategy, direction, obstacle, external load, linked sprint, terminal stick, difficulty, dose, media, or graph require a new card version and renewed affected reviews."
      }'::JSONB,
      approved_video_url = NULL,
      reviewed_by = NULL,
      approved_by = NULL,
      last_reviewed_at = NULL,
      provenance_json = provenance_json || jsonb_build_object(
        'structuralCompletionMigration', migration_key,
        'researchBatch', 'alternating-bounds-family-v1',
        'researchVersion', '2026-07-27.52',
        'evidenceState', 'candidate_requires_human_review',
        'mediaState',
          'five_title_matched_candidates_plus_three_quarantined_legacy_mismatches',
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
            'Legacy baseline does not declare exact traditional-versus-sprint mechanics, distance or contacts, intensity, run-out, dose, quality gates, and stop rules.'
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

  CREATE TEMP TABLE alternating_bounds_variant_seed (
    variant_key TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    form_key TEXT NOT NULL,
    projection TEXT NOT NULL,
    contact_intent TEXT NOT NULL,
    complexity SMALLINT NOT NULL,
    physical SMALLINT NOT NULL,
    coordination SMALLINT NOT NULL,
    supervision SMALLINT NOT NULL,
    consequence SMALLINT NOT NULL,
    impact SMALLINT NOT NULL,
    work_capacity SMALLINT NOT NULL,
    eccentric SMALLINT NOT NULL,
    local_fatigue SMALLINT NOT NULL,
    technical_fatigue SMALLINT NOT NULL,
    recovery_hours SMALLINT NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO alternating_bounds_variant_seed VALUES
    ('traditional-height-distance','Traditional Alternating Bound — Height and Distance','traditional_bound','mixed_horizontal_and_vertical','powerful_controlled_contact_with_full_projection',58,62,68,62,70,76,54,68,64,72,36),
    ('sprint-bound-distance','Sprint Alternating Bound — Distance and Rhythm','sprint_bound','horizontal_speed_emphasis','active_shorter_contact_and_fast_alternation',66,68,78,68,76,80,60,70,68,82,48);

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
      seed.form_key,
      seed.projection,
      seed.contact_intent,
      'alternating_unilateral_contacts',
      'contralateral_arm_action',
      'controlled_run_out'
    ]::TEXT[],
    jsonb_build_object(
      'technicalComplexity', seed.complexity,
      'absoluteLoadDemand', seed.physical,
      'baseOverallDifficulty', greatest(seed.complexity, seed.physical),
      'coordinationDemand', seed.coordination,
      'supervisionDemand', seed.supervision,
      'failureConsequence', seed.consequence,
      'impact', seed.impact,
      'workCapacityDemand', seed.work_capacity,
      'difficultyModel', 'max_exercise_complexity_physical_difficulty',
      'dimensionMeaning', jsonb_build_object(
        'technicalComplexity', 'exercise_complexity',
        'absoluteLoadDemand', 'physical_difficulty'
      )
    ),
    jsonb_build_object(
      'selectable', TRUE,
      'contactPattern', 'alternating_unilateral',
      'takeoffAndLanding', 'one_foot_to_opposite_foot',
      'form', seed.form_key,
      'projectionEmphasis', seed.projection,
      'contactTimeIntent', seed.contact_intent,
      'armAction', 'contralateral_running_style',
      'startLeg', 'declared_and_balanced_across_work',
      'distanceOrContacts', 'declared_before_set',
      'terminalAction', 'controlled_run_out',
      'externalLoad', 'none',
      'sideBalanceRequired', TRUE
    ),
    'review',
    jsonb_build_object(
      'gripDemand', 1,
      'spinalLoading', 26,
      'eccentricStress', seed.eccentric,
      'landingContactsPerRep', 1,
      'groundContactsPerSet',
        'actual_alternating_bound_contacts_plus_run_out_contacts_recorded_or_estimated',
      'externalLoadMethod', 'bodyweight',
      'externalLoadDescription',
        'bodyweight alternating unilateral horizontal plyometric contacts',
      'impactClass', 'high_repeated_unilateral_plyometric',
      'loadTracking', jsonb_build_array(
        'variant',
        'start_leg',
        'distance',
        'contacts',
        'time_when_used',
        'intensity',
        'surface',
        'footwear',
        'run_out'
      )
    ),
    jsonb_build_object(
      'localMuscleFatigue', seed.local_fatigue,
      'gripFatigue', 1,
      'technicalFatigueSensitivity', seed.technical_fatigue,
      'impactAccumulation', seed.impact,
      'recoveryHours', seed.recovery_hours,
      'primaryFatigueSites', jsonb_build_array(
        'calves_and_achilles',
        'hamstrings',
        'quadriceps',
        'gluteals',
        'feet',
        'hip_stabilizers',
        'trunk'
      ),
      'stopBefore', jsonb_build_array(
        'reaching_or_braking_contact',
        'contact_sound_or_time_increases',
        'hip_height_or_posture_drops',
        'leg_alternation_or_arm_timing_fails',
        'side_to_side_difference_increases',
        'distance_speed_or_rhythm_declines',
        'run_out_control_declines'
      )
    ),
    jsonb_build_object(
      'trainingStimuli', jsonb_build_array(
        'alternating_unilateral_projection',
        'horizontal_force_orientation',
        'stretch_shortening_cycle',
        'contralateral_coordination',
        'contact_rhythm',
        'sprint_or_jump_transfer'
      ),
      'stimulusDose', jsonb_build_object(
        'primary', 'high_quality_alternating_bound_contacts',
        'secondary', 'distance_and_time_only_when_the_profile_declares_them',
        'fatigueCeiling', 'low'
      ),
      'weeklyExposure', jsonb_build_object(
        'typical', 1,
        'maximumWithoutReview', 2
      ),
      'prerequisites', jsonb_build_array(
        'pain_free_running_jumping_and_landing',
        'single_leg_contact_control',
        'bilateral_and_unilateral_pogo_readiness',
        'safe_lane_and_run_out'
      ),
      'completionCriteria', jsonb_build_array(
        'legs_alternate_every_contact',
        'active_contact_near_under_hips',
        'projection_matches_variant',
        'posture_and_arm_timing_preserved',
        'side_to_side_rhythm_repeatable',
        'controlled_run_out'
      ),
      'sequenceRules', jsonb_build_array(
        'after_running_and_landing_specific_warmup',
        'before_fatiguing_sprint_jump_strength_or_conditioning_when_output_is_priority',
        'never_as_a_dense_fatigue_finisher'
      ),
      'pairingCompatibility', jsonb_build_object(
        'preferred', jsonb_build_array(
          'low_fatigue_mobility',
          'upper_body_strength'
        ),
        'avoid', jsonb_build_array(
          'dense_sprint_jump_change_of_direction_or_calf_work'
        )
      ),
      'interferenceRules', jsonb_build_array(
        'counts_toward_unilateral_jump_sprint_impact_calf_achilles_hamstring_and_eccentric_budgets',
        'warmup_or_failed_contacts_still_count_toward_exposure',
        'start_leg_and_side_difference_are_recorded'
      ),
      'uncertaintyPolicy', jsonb_build_object(
        'variant_or_contact_rule_unclear', 'do_not_start',
        'readiness_unclear', 'use_submaximal_regression_or_exclude',
        'surface_lane_or_run_out_unclear', 'stop_and_rebuild_station'
      ),
      'cumulativeBudget', jsonb_build_object(
        'highIntentPlyometricSequences', 1,
        'unilateralBoundContacts', 'actual_contacts',
        'distanceMeters', 'actual_distance',
        'impact', seed.impact,
        'eccentricStress', seed.eccentric,
        'technicalSensitivity', seed.technical_fatigue
      )
    )
  FROM alternating_bounds_variant_seed seed
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
      WHEN 'movement-intelligence-technique'
        THEN 'Learn exact alternating contacts, active foot placement, contralateral arm timing, declared projection, and a safe run-out at controlled intent.'
      ELSE 'Express high-quality alternating unilateral projection and rhythm with full recovery for horizontal power or sprint transfer.'
    END,
    CASE profile.profile_key
      WHEN 'movement-intelligence-technique' THEN 88
      ELSE 94
    END,
    CASE profile.profile_key
      WHEN 'movement-intelligence-technique' THEN 92
      ELSE 94
    END,
    jsonb_build_object(
      'horizontalProjection', CASE
        WHEN seed.form_key = 'sprint_bound' THEN 96
        ELSE 88
      END,
      'verticalProjection', CASE
        WHEN seed.form_key = 'traditional_bound' THEN 86
        ELSE 66
      END,
      'contactRhythm', 94,
      'sprintTransfer', CASE
        WHEN seed.form_key = 'sprint_bound' THEN 96
        ELSE 86
      END,
      'fatigueCost', CASE
        WHEN profile.profile_key = 'output-horizontal-power' THEN 76
        ELSE 52
      END
    ),
    CASE profile.profile_key
      WHEN 'movement-intelligence-technique' THEN jsonb_build_object(
        'sets', jsonb_build_object(
          'minimum', 2,
          'target', 3,
          'maximum', 4
        ),
        'contactsPerSet', jsonb_build_object(
          'minimum', 4,
          'target', 6,
          'maximum', 8
        ),
        'distanceMeters', jsonb_build_object(
          'minimum', 8,
          'target', 12,
          'maximumWithoutReview', 15
        ),
        'intensityPercent', jsonb_build_object(
          'minimum', 60,
          'target', 75,
          'maximum', 85
        ),
        'restSeconds', jsonb_build_object(
          'minimum', 60,
          'target', 90,
          'maximum', 150
        )
      )
      ELSE jsonb_build_object(
        'sets', jsonb_build_object(
          'minimum', 2,
          'target', 3,
          'maximum', 4
        ),
        'contactsPerSet', jsonb_build_object(
          'minimum', 6,
          'target', 8,
          'maximumWithoutReview', 12
        ),
        'distanceMeters', jsonb_build_object(
          'minimum', 15,
          'target', 20,
          'maximumWithoutReview', 30
        ),
        'intensityPercent', jsonb_build_object(
          'minimum', 85,
          'target', 95,
          'maximum', 100
        ),
        'restSeconds', jsonb_build_object(
          'minimum', 120,
          'target', 180,
          'maximum', 240
        )
      )
    END,
    'A sequence counts only when legs alternate on every contact, the foot contacts actively near the body rather than reaching, projection matches the variant, hip and trunk posture and contralateral arm timing remain organized, left-right rhythm is repeatable, and the run-out is controlled.',
    ARRAY[
      'pain_pull_giving_way_numbness_dizziness_or_fear',
      'unsafe_surface_lane_cross_traffic_or_run_out',
      'reaching_braking_or_loud_contact',
      'leg_alternation_or_arm_timing_error',
      'hip_knee_foot_or_trunk_collapse',
      'meaningful_side_to_side_difference',
      'distance_speed_contact_or_rhythm_decline'
    ]::TEXT[],
    'Inspect surface, footwear, lane, finish, and run-out. Declare variant, start leg, contacts or distance, effort, rest, and stop signal. Rehearse submaximally. Observe projection, foot placement, hip height, arm timing, symmetry, contact sound and rhythm, and finish; stop before fatigue changes any of them.',
    CASE seed.form_key
      WHEN 'traditional_bound'
        THEN 'Alternate legs on every bound. Push for the declared blend of height and distance, land actively under you, keep the hips tall and arms coordinated, then run out under control.'
      ELSE 'Alternate legs with fast, active contacts. Project forward without reaching, keep hips and rhythm tall and quick, and run out under control.'
    END,
    CASE profile.profile_key
      WHEN 'movement-intelligence-technique'
        THEN 'More repeatable alternating contacts, projection, foot placement, posture, arm timing, symmetry, and run-out at controlled intent.'
      ELSE 'Greater high-quality horizontal multi-step projection and rhythm with preserved contact and landing control.'
    END,
    ARRAY['none']::TEXT[],
    jsonb_build_object(
      'stationFootprintMeters', jsonb_build_object(
        'length', CASE
          WHEN profile.profile_key = 'output-horizontal-power' THEN 40
          ELSE 25
        END,
        'width', 3
      ),
      'runOutMeters', 8,
      'athletesPerLane', 1,
      'setupSeconds', 90,
      'transitionSeconds', 30,
      'surfaceFootwearAndLaneInspectionRequired', TRUE,
      'startFinishAndRunOutMarkersRequired', TRUE,
      'noCrossTraffic', TRUE
    ),
    '{}'::UUID[],
    'review',
    jsonb_build_object(
      'setupSeconds', 90,
      'secondsPerSequence', CASE
        WHEN profile.profile_key = 'output-horizontal-power' THEN 8
        ELSE 10
      END,
      'walkBackAndResetSeconds', CASE
        WHEN profile.profile_key = 'output-horizontal-power' THEN 90
        ELSE 60
      END,
      'restSeconds', CASE
        WHEN profile.profile_key = 'output-horizontal-power'
          THEN jsonb_build_object(
            'minimum', 120,
            'target', 180,
            'maximum', 240
          )
        ELSE jsonb_build_object(
          'minimum', 60,
          'target', 90,
          'maximum', 150
        )
      END,
      'durationFormula',
        'setup + sets * (sequence_seconds + walkback_reset) + interset_rest'
    ),
    jsonb_build_object(
      'progressionOrder', jsonb_build_array(
        'repeatable_submaximal_alternation_and_run_out',
        'increase_to_target_contacts_or_distance',
        'increase_projection_or_contact_speed',
        'sprint_bound_variant_for_matching_goal'
      ),
      'regressionOrder', jsonb_build_array(
        'reduce_intensity',
        'reduce_contacts',
        'reduce_distance',
        'traditional_mixed_projection_variant',
        'longer_rest',
        'reviewed_single_leg_pogo_or_running_substitution'
      ),
      'neverAutoScale', jsonb_build_array(
        'pain_or_neurologic_symptom',
        'surface_lane_or_run_out_safety',
        'reaching_collapse_or_alternation_error',
        'persistent_side_difference',
        'fatigue_related_contact_decline'
      ),
      'sideBalanceRequired', TRUE
    ),
    jsonb_build_object(
      'record', jsonb_build_array(
        'variant_key',
        'start_leg',
        'distance_target',
        'contact_target',
        'actual_distance',
        'actual_contacts',
        'time_when_used',
        'intensity',
        'contact_quality',
        'side_difference',
        'rest',
        'symptoms',
        'stop_reason'
      ),
      'successfulSequenceStandard',
        'Correct alternation, active non-reaching contacts, variant-matched projection, organized posture and arms, repeatable side-to-side rhythm, and controlled run-out.',
      'progressionThreshold',
        'Progress only after every planned sequence passes all contact and run-out gates without a meaningful side difference or symptom.'
    ),
    jsonb_build_object(
      'athletePrompt',
        'Report pain, pulling, giving way, numbness, dizziness, uncertainty about the contact rule, a large side difference, or difficulty controlling the run-out.',
      'coachPrompt',
        'Record actual contacts and distance, not only planned dose; failed or stopped sequences still count toward exposure.',
      'accessibilityPrompt',
        'Offer lower intent, shorter distance, fewer contacts, the traditional variant, longer rest, and written, still-image, walkthrough, or live instruction.'
    )
  FROM alternating_bounds_variant_seed seed
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id = target_definition_id
   AND variant.variant_key = seed.variant_key
  CROSS JOIN (
    VALUES
      ('movement-intelligence-technique','movement_intelligence'),
      ('output-horizontal-power','output')
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
      ('identity','https://pmc.ncbi.nlm.nih.gov/articles/PMC10407309/','Plyometric Training Practices of Brazilian Olympic Sprint and Jump Coaches: Toward a Deeper Understanding of Their Choices and Insights','Sports','peer_reviewed_research',83,'["Alternate bounding uses consecutive unilateral horizontal contacts with alternating legs and running-style arms; traditional and sprint forms differ chiefly in contact-time intent and movement strategy.","Height-versus-distance emphasis is represented as an exact form or delivery dimension rather than athlete proficiency."]'::JSONB),
      ('taxonomy','https://pmc.ncbi.nlm.nih.gov/articles/PMC13028155/','Relationship and Training Effects of Horizontal Multi-Step Jumps on Sprint Performance: A Systematic Review','Sports Medicine - Open','peer_reviewed_research',90,'["The card is a rectilinear horizontal multi-step plyometric with alternating unilateral contacts.","Same-leg hops, straight-leg bounds, skips, lateral bounds, obstacle bounds, and bounds linked to a sprint change the contact pattern, knee strategy, direction, constraint, or terminal action."]'::JSONB),
      ('anatomy','https://pmc.ncbi.nlm.nih.gov/articles/PMC8938535/','Effects of Plyometric Training on Lower Body Muscle Architecture, Tendon Structure, Stiffness and Physical Performance: A Systematic Review and Meta-analysis','Sports Medicine - Open','peer_reviewed_research',91,'["Repeated plyometric contacts load the lower-limb muscle-tendon system; the card records plantarflexors, Achilles exposure, knee and hip extensors, foot structures, trunk control, and coordinated arm action without claiming isolation."]'::JSONB),
      ('biomechanics','https://pmc.ncbi.nlm.nih.gov/articles/PMC10407309/','Plyometric Training Practices of Brazilian Olympic Sprint and Jump Coaches: Toward a Deeper Understanding of Their Choices and Insights','Sports','peer_reviewed_research',83,'["Traditional and sprint alternate bounds have different contact-time intent and force-orientation strategies while retaining the same alternating unilateral base action.","The card does not prescribe a universal contact time and stops reaching, collapse, asymmetry, or fatigue-driven strategy changes."]'::JSONB),
      ('difficulty','https://pmc.ncbi.nlm.nih.gov/articles/PMC12733884/','Comparison of Training Effects of Bounding and Single Leg Jumps for Speed on Sprint and Jump Kinematics in Young Female Football Players','Sports','peer_reviewed_research',84,'["Bounding combines high velocity with long alternating steps and is technically demanding relative to simpler single-leg speed jumps.","Each exact variant is scored only for exercise complexity and physical difficulty; overall is their maximum, while athlete readiness is handled separately."]'::JSONB),
      ('load_fatigue_recovery','https://pmc.ncbi.nlm.nih.gov/articles/PMC8938535/','Effects of Plyometric Training on Lower Body Muscle Architecture, Tendon Structure, Stiffness and Physical Performance: A Systematic Review and Meta-analysis','Sports Medicine - Open','peer_reviewed_research',91,'["Track actual unilateral contacts, distance, intensity, surface, calf-Achilles, hamstring, quadriceps and gluteal fatigue, eccentric stress, asymmetry, and recovery.","Sets stop before contact, projection, posture, rhythm, symmetry, or run-out quality declines."]'::JSONB),
      ('constraints','https://worldathletics.org/download/downloadnsa?filename=8c33cc0b-ba23-4d3d-9dbe-168e10d5fcfb.pdf&urlslug=plyometrics-for-beginners-basic-considerati','Plyometrics for Beginners: Basic Considerations','World Athletics','governing_body',76,'["Use an appropriate surface, safe straight lane, clear run-out, progressive exposure, and direct observation.","Readiness and environmental safety determine use; no athlete skill level is attached to the exercise card."]'::JSONB),
      ('dosage','https://pmc.ncbi.nlm.nih.gov/articles/PMC10692103/','Maximizing plyometric training for adolescents: a meta-analysis of ground contact frequency and overall intervention time on jumping ability','BMC Sports Science, Medicine and Rehabilitation','peer_reviewed_research',88,'["Ground contacts and total intervention exposure are material plyometric dose variables.","The card uses conservative contact and distance ranges, full recovery, and stop rules rather than asserting one universal prescription."]'::JSONB),
      ('instructions','https://pmc.ncbi.nlm.nih.gov/articles/PMC10407309/','Plyometric Training Practices of Brazilian Olympic Sprint and Jump Coaches: Toward a Deeper Understanding of Their Choices and Insights','Sports','peer_reviewed_research',83,'["Instruction declares traditional or sprint form, start leg, distance or contacts, effort, finish, run-out, rest, and stop signal.","Alternation, active non-reaching contact, posture, contralateral arm rhythm, and controlled run-out are visible quality gates."]'::JSONB),
      ('safety_stop_rules','https://worldathletics.org/download/downloadnsa?filename=8c33cc0b-ba23-4d3d-9dbe-168e10d5fcfb.pdf&urlslug=plyometrics-for-beginners-basic-considerati','Plyometrics for Beginners: Basic Considerations','World Athletics','governing_body',76,'["Stop for pain, pulling, giving way, unsafe surface or traffic, reaching, loud or collapsing contacts, alternation error, meaningful asymmetry, output loss, or uncontrolled run-out.","Reduce intensity, contacts, and distance before progressing form or speed."]'::JSONB),
      ('programming','https://pubmed.ncbi.nlm.nih.gov/32897526/','Effects of Vertically and Horizontally Orientated Plyometric Training on Physical Performance: A Meta-analytical Comparison','Sports Medicine','peer_reviewed_research',91,'["Horizontal orientation is relevant to horizontal performance, but programming still depends on the session objective and the rest of the training load.","Place high-intent bounds while fresh and count them against unilateral jump, sprint, impact, calf-Achilles, hamstring, eccentric, and technical budgets."]'::JSONB),
      ('athlete_support','https://worldathletics.org/download/downloadnsa?filename=8c33cc0b-ba23-4d3d-9dbe-168e10d5fcfb.pdf&urlslug=plyometrics-for-beginners-basic-considerati','Plyometrics for Beginners: Basic Considerations','World Athletics','governing_body',76,'["Athletes receive exact setup, contact, dose, finish, self-check, symptom, and stop guidance before the first sequence.","Written, still-image, walkthrough, and live-demonstration alternatives remain available."]'::JSONB),
      ('coach_support','https://pmc.ncbi.nlm.nih.gov/articles/PMC10407309/','Plyometric Training Practices of Brazilian Olympic Sprint and Jump Coaches: Toward a Deeper Understanding of Their Choices and Insights','Sports','peer_reviewed_research',83,'["Coach observation distinguishes traditional from sprint form and tracks projection, foot placement, contact intent, posture, arms, symmetry, rhythm, fatigue, and finish.","Actual contacts, distance, stopped attempts, faults, and symptoms remain traceable."]'::JSONB),
      ('accessibility','https://pmc.ncbi.nlm.nih.gov/articles/PMC10692103/','Maximizing plyometric training for adolescents: a meta-analysis of ground contact frequency and overall intervention time on jumping ability','BMC Sports Science, Medicine and Rehabilitation','peer_reviewed_research',88,'["Intensity, distance, contacts, form, recovery, instruction format, and supervision can be individualized without classifying the exercise by athlete skill level.","If the base alternating contact cannot be controlled, select a reviewed regression rather than relabeling the card."]'::JSONB),
      ('alternates','https://pmc.ncbi.nlm.nih.gov/articles/PMC13028155/','Relationship and Training Effects of Horizontal Multi-Step Jumps on Sprint Performance: A Systematic Review','Sports Medicine - Open','peer_reviewed_research',90,'["Traditional mixed-projection and sprint-oriented distance bounds are exact variants of alternating bounds.","Same-leg bounds, straight-leg bounds, power skips, lateral bounds, obstacle bounds, resisted bounds, and bounds-to-sprint compounds require separate identity or variant review according to their changed mechanics."]'::JSONB),
      ('media','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en','Embed videos and playlists','YouTube Help','manufacturer_instruction',82,'["Five title-matched candidates returned current oEmbed title, channel, and embed metadata.","Three inherited links are title-level mismatches and remain quarantined provenance; no playback, exact variant, cue, safety, caption, accessibility, reviewer, or approval claim is made."]'::JSONB)
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

  UPDATE coaching.exercise_media_candidate_v1
  SET reviewed_card_version = 2,
      embed_url =
        'https://www.youtube-nocookie.com/embed/' || video_id,
      title = CASE video_id
        WHEN 'CCJWB9bCBEo' THEN 'Lateral Bound w/ stick'
        WHEN '4nTDP0G3nhc' THEN 'Lateral Bound with Stick'
        WHEN 'cfR4qXuQAfY' THEN 'Scissor Jump Exercise'
      END,
      channel_name = CASE video_id
        WHEN 'CCJWB9bCBEo' THEN 'ken whittier'
        WHEN '4nTDP0G3nhc' THEN 'ken whittier'
        WHEN 'cfR4qXuQAfY' THEN 'Physical Therapy San Pedro'
      END,
      captions_available = NULL,
      embedding_allowed = TRUE,
      exact_variant_match = FALSE,
      demonstration_quality_score = NULL,
      link_status = 'mismatched',
      review_status = 'candidate',
      reviewer_user_id = NULL,
      reviewed_at = NULL,
      next_review_at = NULL,
      notes =
        'YouTube oEmbed title/channel metadata checked 2026-07-26. The title identifies a lateral-bound or scissor-jump exercise, not forward alternating bounds. Retained only as quarantined legacy provenance; no human viewing, rejection, accessibility review, or approval is claimed.',
      updated_at = now()
  WHERE definition_id = target_definition_id
    AND video_id IN (
      'CCJWB9bCBEo',
      '4nTDP0G3nhc',
      'cfR4qXuQAfY'
    );

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
    'YouTube oEmbed title/channel metadata checked 2026-07-26. Title-level candidate only; full playback, exact traditional-or-sprint variant, cue, safety, caption, accessibility, reviewer, and approval review remain unresolved.'
  FROM (
    VALUES
      ('eIjuMzIFREs','How To: Alternating Leg Bounds | Sprint Bounding','Simple Speed Coach','alternate leg bounding drill'),
      ('b3124L0KK3Q','BOUNDING: Bounding Routine Alternate Leg Bounds','Trackwired','alternate leg bounding drill'),
      ('LwsQ-AGc8JU','BOUNDING DRILLS - ALTERNATE BOUND FOR SPEED','Trackwired','alternate bound for speed'),
      ('bIUl_AsST0c','BOUNDING DRILLS - ALTERNATING LEG BOUND','Trackwired','alternating leg bound'),
      ('NgclB0lb5DA','BOUNDING DRILLS - ALTERNATE BOUND FOR DISTANCE','Trackwired','alternate bound for distance')
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
          'sourceCard', 'alternate-leg-bound-for-distance'
        )
      ELSE NULL
    END,
    'candidate',
    NULL,
    NULL
  FROM (
    VALUES
      ('Alternate Bounds for Height and Distance','same_identity','The source retains alternating unilateral forward contacts; mixed height-distance projection is the traditional exact variant.','{"variantKey":"traditional-height-distance"}'::JSONB),
      ('Alternate-Leg Bound for Distance','same_identity','The stable source retains alternating unilateral forward contacts; sprint-distance emphasis is an exact variant.','{"variantKey":"sprint-bound-distance"}'::JSONB),
      ('Traditional Alternating Bound','new_variant','Longer powerful contacts with mixed vertical-horizontal projection preserve the base alternating action.','{"form":"traditional_bound","projection":"mixed"}'::JSONB),
      ('Sprint Alternating Bound','new_variant','Shorter active contacts and faster horizontal rhythm preserve the base alternating action.','{"form":"sprint_bound","projection":"horizontal_speed"}'::JSONB),
      ('Same-Leg Bounds','new_definition','Repeated takeoff and landing on the same leg changes contact sequence, unilateral accumulation, rhythm, and side dosing.','{"contactPattern":"same_leg_repeated"}'::JSONB),
      ('Straight-Leg Bounds','new_definition','A deliberately stiff-knee cyclic action changes joint strategy and exercise intent.','{"kneeStrategy":"deliberately_straight_leg"}'::JSONB),
      ('Power Skip for Height','new_definition','A step-hop skip cycle and height emphasis differ from alternating bound-to-opposite-leg contacts.','{"contactPattern":"step_hop_skip","projection":"vertical"}'::JSONB),
      ('Power Skip for Distance','new_definition','A step-hop skip cycle differs from consecutive opposite-leg bounding contacts.','{"contactPattern":"step_hop_skip","projection":"horizontal"}'::JSONB),
      ('Lateral Alternating Bound','new_definition','Frontal-plane side-to-side projection changes direction, landing strategy, space, and coaching.','{"direction":"lateral"}'::JSONB),
      ('Hurdle Alternating Bounds','new_definition','An obstacle fixes flight and clearance constraints and changes failure consequence and equipment.','{"obstacle":"hurdle"}'::JSONB),
      ('Resisted Alternating Bounds','new_variant','A declared light resistance can preserve the alternating action but materially changes external load and contact timing and requires exact review.','{"externalLoad":"declared_resistance","proposalOnly":true}'::JSONB),
      ('Straight-Leg Bounds to Sprint','new_definition','A prescribed transition into sprinting adds an ordered terminal action and a separate acceleration dose.','{"orderedActions":["straight_leg_bounds","sprint"]}'::JSONB)
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
      ('traditional-height-distance','sprint-bound-distance','progression',82,ARRAY['complexity','load','speed']::TEXT[],'Sprint-oriented bounding raises contact-speed, timing, rhythm, and horizontal-output demands after traditional alternating mechanics are repeatable.','{"requires":["pain_free_repeatable_traditional_bounds","active_non_reaching_contacts","no_meaningful_side_difference","controlled_run_out"]}'::JSONB),
      ('sprint-bound-distance','traditional-height-distance','regression',94,ARRAY['complexity','load','speed']::TEXT[],'Traditional mixed-projection bounding reduces contact-speed pressure while preserving alternating unilateral projection and arm-leg coordination.','{"useWhen":["sprint_bound_contact_or_timing_unstable","projection_needs_more_time","fatigue_or_confidence_requires_lower_speed"]}'::JSONB)
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
        'Proposed exercise complexity from alternating unilateral timing, projection, active foot placement, contralateral arm action, posture, rhythm, symmetry, and run-out control.'
      ),
      (
        'absoluteLoadDemand',
        (variant.difficulty_json ->> 'absoluteLoadDemand')::SMALLINT,
        'Proposed physical difficulty from repeated unilateral plyometric contacts, horizontal and vertical projection, speed, distance, impact, eccentric stress, and recovery.'
      ),
      (
        'technicalFatigueSensitivity',
        (variant.fatigue_profile_json ->>
          'technicalFatigueSensitivity')::SMALLINT,
        'Proposed from reaching, longer or louder contacts, hip-height loss, alternation or arm-timing errors, asymmetry, output decline, and run-out loss under fatigue.'
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
          'Five title-matched oEmbed-healthy candidates require full-video exact-variant, cue, safety, caption, accessibility, reviewer, and approval review; three inherited mismatches remain quarantined provenance.'
      ),
      jsonb_build_object(
        'code', 'identity_boundary_human_review_required',
        'message',
          'The alternating-bound consolidation and alternate classifications are deterministic proposals and still require accountable human review before publication.'
      ),
      jsonb_build_object(
        'code', 'graph_human_review_required',
        'message',
          'Traditional-to-sprint progression and regression proposals require coach approval.'
      ),
      jsonb_build_object(
        'code', 'calibration_human_review_required',
        'message',
          'Exercise-complexity, physical-difficulty, and technical-fatigue proposals require independent calibration.'
      ),
      jsonb_build_object(
        'code', 'athlete_coach_pilot_required',
        'message',
          'Athlete comprehension, coach scoring, dose tolerance, side-balance recording, and station logistics require representative pilot evidence.'
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
