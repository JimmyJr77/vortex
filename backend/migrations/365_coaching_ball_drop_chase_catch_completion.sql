-- Complete the Ball Drop partner chase-and-catch survivor with exact
-- tennis-ball and reaction-ball variants, contextual delivery profiles,
-- anatomy, load/fatigue/recovery, equipment/environment/population
-- constraints, athlete and coach support, candidate evidence/media and
-- alternates, review-only graph and calibration proposals, and a quarantined
-- automated test packet.
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
    '365_coaching_ball_drop_chase_catch_completion';
  facility BIGINT;
  target_definition_id UUID;
  protected_records INTEGER;
  unexpected_variants INTEGER;
BEGIN
  SELECT id, facility_id
  INTO target_definition_id, facility
  FROM coaching.exercise_definition_v1
  WHERE facility_id = 1
    AND slug = 'ball-drop-reaction-sprint'
    AND status <> 'archived';

  IF target_definition_id IS NULL THEN
    RAISE EXCEPTION
      '% requires active ball-drop-reaction-sprint survivor',
      migration_key;
  END IF;

  IF (
    SELECT COUNT(*)
    FROM coaching.exercise_identity_resolution_v1 resolution
    JOIN coaching.exercise_definition_v1 duplicate
      ON duplicate.id = resolution.resolved_definition_id
    WHERE resolution.survivor_definition_id = target_definition_id
      AND duplicate.slug = 'partner-tennis-ball-drop-sprint'
      AND resolution.decision = 'duplicate_consolidated'
  ) <> 1 THEN
    RAISE EXCEPTION
      '% requires the Partner Tennis Ball Drop Sprint consolidation',
      migration_key;
  END IF;

  IF (
    SELECT COUNT(*)
    FROM coaching.exercise_identity_resolution_v1 resolution
    JOIN coaching.exercise_definition_v1 related
      ON related.id = resolution.resolved_definition_id
    WHERE resolution.survivor_definition_id = target_definition_id
      AND related.slug IN (
        'ball-drop-point-and-sprint-cone-reaction',
        'reaction-ball-drop-to-hop-and-go',
        'ball-drop-sprint-plus-direction-cue',
        'reaction-ball-drop-catch-to-cut',
        'gate-reaction-drill'
      )
      AND resolution.decision = 'distinct_exercises'
  ) <> 5 THEN
    RAISE EXCEPTION
      '% requires all five Ball Drop identity boundaries',
      migration_key;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM coaching.exercise_identity_resolution_v1 resolution
    JOIN coaching.exercise_definition_v1 left_definition
      ON left_definition.id = resolution.survivor_definition_id
    JOIN coaching.exercise_definition_v1 right_definition
      ON right_definition.id = resolution.resolved_definition_id
    WHERE left_definition.slug = 'reaction-ball-drop-catch-to-cut'
      AND right_definition.slug = 'reaction-ball-drop-to-hop-and-go'
      AND resolution.decision = 'distinct_exercises'
  ) THEN
    RAISE EXCEPTION
      '% requires the catch-to-cut versus hop-and-go boundary',
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
      'baseline-source-738',
      'tennis-ball-partner-drop-catch',
      'reaction-ball-partner-drop-secure'
    );

  IF unexpected_variants > 0 THEN
    RAISE EXCEPTION
      '% found % unexpected active variant(s)',
      migration_key,
      unexpected_variants;
  END IF;

  UPDATE coaching.exercise_definition_v1
  SET canonical_name = 'Partner Ball-Drop Chase and Catch',
      display_name = 'Partner Ball-Drop Chase and Catch',
      description =
        'Wait in a declared stance for a trained partner to release a declared ball without a timing or body-language tell, accelerate from a measured start mark, track and secure the ball before the declared bounce limit without diving, decelerate inside a clear run-out, return the ball, and fully reset.',
      aliases = ARRAY(
        SELECT min(alias)
        FROM unnest(
          aliases
          || ARRAY[
            'Ball Drop Reaction Sprint',
            'Ball Drop Reaction Sprints',
            'Partner Ball Drop Chase and Catch',
            'Partner Ball-Drop Chase-and-Catch'
          ]::TEXT[]
        ) alias
        WHERE nullif(btrim(alias), '') IS NOT NULL
          AND lower(btrim(alias))
            <> 'partner ball-drop chase and catch'
        GROUP BY lower(btrim(alias))
        ORDER BY lower(btrim(alias))
      ),
      family_key = 'live_object_reaction_acceleration_and_capture',
      schema_version = '1.0.0',
      card_version = 2,
      status = 'review',
      content_confidence = 84,
      scoring_confidence = 68,
      media_confidence = 38,
      movement_patterns = ARRAY[
        'locomote',
        'brace',
        'catch'
      ]::TEXT[],
      body_regions = ARRAY[
        'eye_hand',
        'neck',
        'shoulder',
        'elbow',
        'wrist',
        'hand',
        'core',
        'hip',
        'glutes',
        'hamstrings',
        'knee',
        'calf',
        'ankle',
        'foot',
        'full_body'
      ]::TEXT[],
      required_equipment = ARRAY['partner','ball']::TEXT[],
      optional_equipment = ARRAY[
        'tennis_ball',
        'reaction_ball',
        'cones'
      ]::TEXT[],
      anatomy_json = '{
        "primaryMuscles":["gluteus_maximus","hamstrings","quadriceps","soleus","gastrocnemius"],
        "secondaryMuscles":["hip_flexors","gluteus_medius","adductors","tibialis_anterior","deltoids","biceps","forearm_flexors","intrinsic_hand"],
        "stabilizers":["abdominal_wall","spinal_stabilizers","foot_intrinsics","rotator_cuff","scapular_stabilizers"],
        "joints":["cervical_spine","thoracic_spine","lumbar_spine","shoulder","elbow","wrist","hand","hip","knee","ankle","foot"],
        "jointActions":["head_eye_tracking","hip_extension","hip_flexion_control","knee_extension","knee_flexion_control","ankle_plantarflexion","ankle_stiffness","trunk_stabilization","shoulder_positioning","elbow_positioning","wrist_positioning","hand_grasp"],
        "planes":["sagittal","frontal","transverse"],
        "laterality":"asymmetrical",
        "lateralityNote":"Release offset and capture hand are declared or balanced; the athlete must not be exposed repeatedly to one unrecorded side."
      }'::JSONB,
      environment_json = '{
        "surface":{"required":"level_nonslip","avoid":["wet","uneven","soft_unstable","debris"]},
        "space":{"measuredStartToReleaseYards":{"minimum":3,"maximumWithoutReview":8},"clearChaseLane":true,"clearCaptureZone":true,"clearRunOut":true,"noCrossTraffic":true},
        "visibility":{"unobstructedBallSightline":true,"adequateLighting":true,"ballBackgroundContrastChecked":true},
        "partner":{"trainedCuePartnerRequired":true,"neutralHoldRequired":true,"noTimingOrBodyLanguageTell":true,"reachableReleaseRequired":true,"oneActiveAthletePerLane":true},
        "equipmentInspection":{"ballIntactAndAppropriate":true,"conesLowProfileWhenUsed":true},
        "observation":{"coachCanSeePartnerReleaseAthleteStartChaseCaptureAndRunOut":true},
        "sharedStation":{"lanesDoNotCross":true,"ballRetrievalDoesNotEnterAnotherLane":true}
      }'::JSONB,
      population_json = '{
        "prerequisites":["understands_true_release_and_bounce_rules","pain_free_short_acceleration","can_decelerate_inside_declared_run_out","can_track_and_secure_ball_without_diving","can_follow_stop_command"],
        "useCaution":["current_lower_limb_back_shoulder_hand_or_visual_symptoms","recent_concussion_or_head_injury","history_of_falls_or_unsafe_diving","fatigue_from_prior_sprint_jump_change_of_direction_or_calf_work","limited_visual_contrast_or_depth_perception"],
        "doNotUseWhen":["pain_dizziness_visual_disturbance_or_neurologic_symptoms","unsafe_surface_lane_lighting_or_run_out","partner_cannot_deliver_a_neutral_reachable_release","athlete_cannot_capture_without_diving_or_colliding","medical_or_rehabilitation_plan_excludes_sprinting_catching_or_reaction_work"],
        "regressionOrder":["increase_bounce_allowance_within_declared_profile","reduce_start_distance","reduce_intensity","use_predictable_tennis_ball_variant","reduce_successful_trial_target","increase_rest","choose_reviewed_non_capture_substitution_only_when_capture_is_not_the_objective"],
        "individualizationRequired":true,
        "medicalClearancePolicy":"Follow the athlete care plan and local scope; this card does not diagnose visual, neurologic, pain, or concussion symptoms."
      }'::JSONB,
      athlete_support_json = '{
        "whyItMatters":"Connects a real visual release to a fast first step, continuous ball tracking, a controlled capture, and a safe stop.",
        "primaryCue":"Wait for the true drop, see it before you push, track and secure the ball without diving, then run out under control.",
        "beforeYouStart":["confirm_ball_start_mark_release_line_bounce_limit_and_run_out","confirm_valid_release_and_false_start_rule","rehearse_one_submaximal_trial","identify_abort_and_stop_commands"],
        "expectedSensations":["brief_high_intent_leg_drive","continuous_visual_tracking","controlled_reach_and_grasp","firm_but_controlled_braking"],
        "unexpectedSensations":["pain","dizziness_or_visual_disturbance","loss_of_balance","panic_or_compulsion_to_dive","unsafe_reach","uncontrolled_stop","unclear_cue_or_lane"],
        "painGuidance":"Stop, protect the lane, and tell the coach about pain, dizziness, visual change, head symptoms, slip, fall, collision, unsafe reach, or loss of braking control.",
        "selfChecks":["waited_for_true_release","first_step_answered_ball_path","eyes_stayed_on_ball","capture_met_bounce_limit","no_dive_or_collision","run_out_stayed_in_lane","breathing_and_attention_reset_before_next_trial"],
        "accessibility":["higher_release_or_more_bounce_allowance","shorter_distance","lower_speed","predictable_tennis_ball","larger_high_contrast_ball_if_an_exact_reviewed_variant_exists","fewer_trials","longer_rest","written_still_image_walkthrough_or_live_instruction"],
        "mediaAlternatives":["written_setup_and_rule_sequence","still_images_of_start_release_capture_and_run_out","slow_walkthrough","live_coach_demonstration"],
        "afterSetCheck":["variant_and_ball","release_height_offset_and_distance","bounce_limit","successful_and_failed_trials","false_starts","capture_and_braking_quality","symptoms","stop_reason"]
      }'::JSONB,
      coach_support_json = '{
        "observationChecklist":["surface_lane_capture_zone_and_run_out","ball_integrity_and_visual_contrast","start_distance_and_stance","partner_neutral_hold_and_release","false_start_or_guessing","first_organized_step_and_acceleration_path","continuous_ball_tracking","capture_without_dive","braking_and_run_out","repeatability_and_fatigue"],
        "faultCorrections":{
          "guessing":["vary_wait_interval","remove_partner_tells","do_not_count_false_start"],
          "late_or_lost_tracking":["increase_bounce_allowance","reduce_distance_or_speed","use_predictable_ball"],
          "unsafe_reach_or_dive":["stop_trial","make_release_reachable","increase_bounce_allowance","reduce_intensity"],
          "poor_first_step_or_path":["rehearse_submaximally","reduce_offset","reduce_speed"],
          "uncontrolled_braking":["extend_run_out","reduce_speed_or_distance","choose_reviewed_acceleration_regression"],
          "quality_drop":["end_set","increase_rest","reduce_successful_trial_target"]
        },
        "demonstrationPlan":["show_lane_start_release_capture_and_run_out","show_neutral_partner_hold_and_true_release","show_valid_wait_and_first_step","show_track_secure_and_run_out","show_false_start_unsafe_dive_and_abort"],
        "groupManagement":["one_active_athlete_per_lane","separate_release_and_retrieval_areas","never_cross_run_outs","partner_confirms_lane_clear_before_release","retrieve_balls_only_after_lane_closes"],
        "modificationDecisionTree":{
          "guessing_or_cue_tell":"reset_partner_timing_and_neutral_hold",
          "tracking_or_capture_unstable":"more_bounce_allowance_predictable_ball_or_lower_speed",
          "braking_unstable":"longer_run_out_and_lower_speed",
          "pain_dizziness_visual_change_fall_or_collision":"stop",
          "capture_not_session_objective":"use_only_a_reviewed_non_capture_substitution"
        },
        "doNotUseWhen":["unsafe_lane_surface_lighting_or_run_out","ambiguous_or_unreachable_release","pain_dizziness_visual_or_head_symptoms","athlete_dives_or_cannot_decelerate","supervision_or_partner_control_unavailable"],
        "recordingFields":["variant_key","ball_type","start_stance","start_distance","release_height","release_offset","bounce_limit","successful_trials","failed_trials","false_starts","capture_quality","braking_quality","rest","symptoms","stop_reason"]
      }'::JSONB,
      support_operations_json = '{
        "supportSummary":"Never improve the score by making the release unreachable, accepting guessing or diving, shortening the run-out, or continuing after capture or braking quality falls.",
        "issueCategories":["identity_or_variant","difficulty_or_dose","equipment_or_environment","partner_delivery","media_exact_match","accessibility","pain_or_safety","graph_relationship","calibration"],
        "supportEscalation":{
          "urgent":["head_injury_or_concussion_symptom","fall_or_collision","acute_pain_or_neurologic_symptom","unsafe_lane_intrusion"],
          "coachReview":["repeated_guessing","repeated_miss_or_dive","braking_or_path_instability","partner_release_bias"],
          "contentReview":["unclear_bounce_or_capture_rule","media_variant_mismatch","missing_accessibility","identity_boundary_conflict"]
        },
        "retentionPolicy":"Retain card version, exact variant, ball, release geometry, stance, distance, bounce limit, trial result, false start, capture, braking, dose, rest, symptoms, stop reason, and reviewer decisions according to facility policy.",
        "knownLimitations":["candidate_media_not_human_viewed","no_universal_release_distance_or_bounce_limit","reaction_ball_bounce_varies_by_ball_surface_and_release","scores_graph_edges_and_calibrations_are_unapproved_proposals"],
        "changeImpactPolicy":"Changes to cue source, ball trajectory, required ordered actions, capture rule, terminal action, difficulty, dose, environment, media, or graph relationships require a new card version, regenerated test packet, and renewed affected reviews."
      }'::JSONB,
      approved_video_url = NULL,
      reviewed_by = NULL,
      approved_by = NULL,
      last_reviewed_at = NULL,
      provenance_json = provenance_json || jsonb_build_object(
        'structuralCompletionMigration', migration_key,
        'researchBatch', 'ball-drop-chase-catch-family-v1',
        'researchVersion', '2026-07-27.51',
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
            'Legacy baseline does not declare exact ball, release geometry, start, distance, bounce limit, capture, run-out, dose, quality-gate, and stop-rule contracts.'
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

  CREATE TEMP TABLE ball_drop_variant_seed (
    variant_key TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    ball_key TEXT NOT NULL,
    equipment TEXT[] NOT NULL,
    predictability TEXT NOT NULL,
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

  INSERT INTO ball_drop_variant_seed VALUES
    ('tennis-ball-partner-drop-catch','Tennis-Ball Partner Drop Chase and Catch','tennis_ball',ARRAY['partner','tennis_ball']::TEXT[],'predictable_ballistic_flight_and_bounce',48,52,58,60,64,58,42,56,50,66,18),
    ('reaction-ball-partner-drop-secure','Reaction-Ball Partner Drop Chase and Secure','reaction_ball',ARRAY['partner','reaction_ball']::TEXT[],'irregular_after_ground_contact',60,54,72,68,68,60,46,58,52,74,24);

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
      seed.ball_key,
      'partner_live_release',
      'short_acceleration',
      'object_capture',
      'controlled_deceleration'
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
      'cueSource', 'trained_partner_live_ball_release',
      'cuePredictability', 'unpredictable_release_time',
      'ballType', seed.ball_key,
      'ballFlightPredictability', seed.predictability,
      'startStance', 'declared_athletic_or_split_stance',
      'startDistanceYards', jsonb_build_object(
        'minimum', 3,
        'maximumWithoutReview', 8
      ),
      'releaseHeight', 'declared_and_reachable',
      'releaseOffset', 'declared_center_left_or_right',
      'bounceLimit', CASE
        WHEN seed.ball_key = 'reaction_ball'
          THEN 'one_or_more_declared_before_trial'
        ELSE 'zero_one_or_two_declared_before_trial'
      END,
      'captureRule',
        'secure_before_declared_bounce_limit_without_dive_fall_or_collision',
      'terminalAction',
        'controlled_deceleration_inside_clear_run_out',
      'fullResetRequired', TRUE,
      'sideBalanceRequired', TRUE
    ),
    'review',
    jsonb_build_object(
      'gripDemand', 18,
      'spinalLoading', 18,
      'eccentricStress', seed.eccentric,
      'landingContactsPerRep', 0,
      'groundContactsPerTrial',
        'record_or_estimate_all_acceleration_and_deceleration_contacts',
      'externalLoadMethod', 'bodyweight',
      'externalLoadDescription',
        'bodyweight acceleration, interception, and deceleration against a live visual ball-release constraint',
      'impactClass', 'moderate_by_speed_distance_and_braking',
      'loadTracking', jsonb_build_array(
        'ball_type',
        'start_stance',
        'start_distance',
        'release_height',
        'release_offset',
        'bounce_limit',
        'successful_trials',
        'failed_trials',
        'false_starts',
        'sprint_contacts',
        'braking_exposures'
      )
    ),
    jsonb_build_object(
      'localMuscleFatigue', seed.local_fatigue,
      'gripFatigue', 18,
      'technicalFatigueSensitivity', seed.technical_fatigue,
      'impactAccumulation', seed.impact,
      'recoveryHours', seed.recovery_hours,
      'primaryFatigueSites', jsonb_build_array(
        'calves_and_achilles',
        'hamstrings',
        'quadriceps',
        'gluteals',
        'feet',
        'visual_attention'
      ),
      'stopBefore', jsonb_build_array(
        'false_start_or_guessing_increases',
        'release_pickup_or_tracking_delays',
        'first_step_or_path_changes',
        'unsafe_reach_or_dive',
        'capture_quality_declines',
        'braking_or_run_out_control_declines',
        'speed_or_attention_drops'
      )
    ),
    jsonb_build_object(
      'trainingStimuli', jsonb_build_array(
        'live_perception_action_coupling',
        'first_step_acceleration',
        'ball_flight_tracking',
        'interceptive_capture',
        'controlled_deceleration'
      ),
      'stimulusDose', jsonb_build_object(
        'primary', 'successful_high_quality_live_release_trials',
        'fatigueCeiling', 'low'
      ),
      'weeklyExposure', jsonb_build_object(
        'typical', 1,
        'maximumWithoutReview', 3
      ),
      'prerequisites', jsonb_build_array(
        'safe_lane_and_run_out',
        'true_release_rule_understood',
        'pain_free_acceleration_and_deceleration',
        'capture_without_diving'
      ),
      'completionCriteria', jsonb_build_array(
        'waited_for_true_release',
        'clean_first_organized_step',
        'continuous_ball_tracking',
        'capture_before_declared_limit',
        'no_dive_fall_or_collision',
        'controlled_run_out'
      ),
      'sequenceRules', jsonb_build_array(
        'after_specific_running_and_capture_warmup',
        'before_fatiguing_strength_sprint_change_of_direction_or_conditioning_when_output_is_priority',
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
        'counts_toward_sprint_acceleration_impact_braking_and_cognitive_decision_budgets',
        'failed_or_false_start_trials_still_count_toward_attention_and_exposure',
        'release_offsets_are_balanced_and_recorded'
      ),
      'uncertaintyPolicy', jsonb_build_object(
        'release_or_rule_unclear', 'do_not_start',
        'capture_reach_uncertain', 'increase_allowance_or_reduce_distance',
        'lane_or_run_out_unclear', 'stop_and_rebuild_station'
      ),
      'cumulativeBudget', jsonb_build_object(
        'highIntentStarts', 1,
        'sprintDistanceYards', 'actual_distance_per_trial',
        'groundContacts', 'record_or_estimate_per_trial',
        'brakingExposures', 1,
        'impact', seed.impact,
        'technicalSensitivity', seed.technical_fatigue
      )
    )
  FROM ball_drop_variant_seed seed
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
        THEN 'Learn to wait for a neutral live release, organize the first step, track and secure the declared ball, and decelerate safely at controlled speed.'
      ELSE 'Express high-quality live-cue first-step acceleration, object interception, and controlled braking with full recovery.'
    END,
    CASE profile.profile_key
      WHEN 'movement-intelligence-technique' THEN 90
      ELSE 94
    END,
    CASE profile.profile_key
      WHEN 'movement-intelligence-technique' THEN 92
      ELSE 94
    END,
    jsonb_build_object(
      'perceptionActionCoupling', 96,
      'firstStepAcceleration', CASE
        WHEN profile.profile_key = 'output-reactive-acceleration'
          THEN 96
        ELSE 78
      END,
      'objectInterception', 92,
      'controlledDeceleration', 90,
      'fatigueCost', CASE
        WHEN profile.profile_key = 'output-reactive-acceleration'
          THEN 60
        ELSE 42
      END
    ),
    CASE profile.profile_key
      WHEN 'movement-intelligence-technique' THEN jsonb_build_object(
        'sets', jsonb_build_object(
          'minimum', 2,
          'target', 3,
          'maximum', 4
        ),
        'successfulTrialsPerSet', jsonb_build_object(
          'minimum', 2,
          'target', 3,
          'maximum', 4
        ),
        'startDistanceYards', jsonb_build_object(
          'minimum', 3,
          'target', 4,
          'maximumWithoutReview', 5
        ),
        'intensityPercent', jsonb_build_object(
          'minimum', 60,
          'target', 70,
          'maximum', 80
        ),
        'restSeconds', jsonb_build_object(
          'minimum', 45,
          'target', 60,
          'maximum', 90
        ),
        'bounceLimit', 'declare_before_set_and_reduce_only_after_quality',
        'missCapPerSet', 2
      )
      ELSE jsonb_build_object(
        'sets', jsonb_build_object(
          'minimum', 3,
          'target', 4,
          'maximum', 5
        ),
        'successfulTrialsPerSet', jsonb_build_object(
          'minimum', 1,
          'target', 2,
          'maximum', 3
        ),
        'startDistanceYards', jsonb_build_object(
          'minimum', 3,
          'target', 5,
          'maximumWithoutReview', 8
        ),
        'intensityPercent', jsonb_build_object(
          'minimum', 85,
          'target', 95,
          'maximum', 100
        ),
        'restSeconds', jsonb_build_object(
          'minimum', 90,
          'target', 120,
          'maximum', 180
        ),
        'bounceLimit', 'declare_before_set_and_preserve_safe_reach',
        'missCapPerSet', 1
      )
    END,
    'A trial counts only when the athlete waits for the true release, uses an organized first step and chase path, tracks continuously, secures the ball before the declared limit without diving, and decelerates inside the clear run-out.',
    ARRAY[
      'pain_dizziness_visual_disturbance_or_head_symptom',
      'slip_fall_collision_or_lane_intrusion',
      'unreachable_or_ambiguous_partner_release',
      'unsafe_reach_dive_or_ball_chase',
      'repeated_false_start_or_guessing',
      'tracking_capture_or_braking_quality_decline',
      'speed_attention_or_partner_control_decline'
    ]::TEXT[],
    'Inspect the surface, lane, ball, sightline, capture zone, and run-out. Declare stance, distance, release height and offset, bounce limit, successful-trial target, miss cap, and rest. Use a neutral hold and unpredictable safe release. Score the reaction, capture, and stop; end the set before guessing, diving, collision risk, or quality loss.',
    'Wait for the true drop. See it, then push. Track and secure the ball without diving, run out under control, and fully reset before the next release.',
    CASE profile.profile_key
      WHEN 'movement-intelligence-technique'
        THEN 'More repeatable cue waiting, first-step organization, visual tracking, capture timing, and braking at controlled speed.'
      ELSE 'Faster high-quality live-cue acceleration and capture with preserved braking and lane safety.'
    END,
    seed.equipment,
    jsonb_build_object(
      'stationFootprintMeters', jsonb_build_object(
        'length', CASE
          WHEN profile.profile_key = 'output-reactive-acceleration'
            THEN 15
          ELSE 10
        END,
        'width', 3
      ),
      'athletesPerLane', 1,
      'cuePartnersPerLane', 1,
      'setupSeconds', 90,
      'transitionSeconds', 30,
      'laneAndRunOutInspectionRequired', TRUE,
      'ballAndVisibilityInspectionRequired', TRUE,
      'noCrossTraffic', TRUE,
      'releaseAndRetrievalProtocolRequired', TRUE
    ),
    ARRAY(
      SELECT substitution_variant.id
      FROM coaching.exercise_definition_v1 substitution_definition
      JOIN coaching.exercise_variant_v1 substitution_variant
        ON substitution_variant.definition_id = substitution_definition.id
      WHERE substitution_definition.facility_id = facility
        AND substitution_definition.slug = 'gate-reaction-drill'
        AND substitution_definition.status <> 'archived'
        AND substitution_variant.variant_key = 'baseline'
        AND substitution_variant.status <> 'archived'
    ),
    'review',
    jsonb_build_object(
      'setupSeconds', 90,
      'secondsPerTrial', CASE
        WHEN profile.profile_key = 'output-reactive-acceleration'
          THEN 8
        ELSE 10
      END,
      'trialResetSeconds', 20,
      'restSeconds', CASE
        WHEN profile.profile_key = 'output-reactive-acceleration'
          THEN jsonb_build_object(
            'minimum', 90,
            'target', 120,
            'maximum', 180
          )
        ELSE jsonb_build_object(
          'minimum', 45,
          'target', 60,
          'maximum', 90
        )
      END,
      'durationFormula',
        'setup + sets * (trials * (seconds_per_trial + trial_reset)) + interset_rest'
    ),
    jsonb_build_object(
      'progressionOrder', jsonb_build_array(
        'repeatable_wait_track_capture_and_stop',
        'reduce_bounce_allowance',
        'small_distance_or_intensity_increase',
        'lateral_release_offset_with_side_balance',
        'reaction_ball_variant'
      ),
      'regressionOrder', jsonb_build_array(
        'increase_bounce_allowance',
        'reduce_distance',
        'reduce_intensity',
        'predictable_tennis_ball',
        'fewer_successful_trials',
        'longer_rest'
      ),
      'neverAutoScale', jsonb_build_array(
        'pain_dizziness_visual_or_head_symptoms',
        'lane_surface_lighting_or_run_out_safety',
        'unsafe_reach_dive_fall_or_collision',
        'partner_release_ambiguity',
        'capture_or_braking_loss'
      ),
      'sideBalanceRequired', TRUE
    ),
    jsonb_build_object(
      'record', jsonb_build_array(
        'variant_key',
        'ball_type',
        'start_stance',
        'start_distance',
        'release_height',
        'release_offset',
        'bounce_limit',
        'successful_trials',
        'failed_trials',
        'false_starts',
        'capture_quality',
        'braking_quality',
        'rest',
        'symptoms',
        'stop_reason'
      ),
      'successfulTrialStandard',
        'True-cue wait, organized first step, continuous tracking, capture before declared limit without diving, and controlled run-out.',
      'progressionThreshold',
        'Progress only after at least ninety percent correct true-cue responses and all planned successful trials pass capture and braking gates.'
    ),
    jsonb_build_object(
      'athletePrompt',
        'Report pain, dizziness, visual change, uncertainty about the release or bounce rule, loss of tracking, unsafe reach, or difficulty stopping.',
      'coachPrompt',
        'Record exact release conditions and distinguish false starts, misses, unsafe attempts, successful captures, and safe stops; do not hide failed trials.',
      'accessibilityPrompt',
        'Offer more bounce allowance, shorter distance, lower speed, predictable ball flight, fewer trials, longer rest, higher contrast, or nonvideo instruction.'
    )
  FROM ball_drop_variant_seed seed
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id = target_definition_id
   AND variant.variant_key = seed.variant_key
  CROSS JOIN (
    VALUES
      ('movement-intelligence-technique','movement_intelligence'),
      ('output-reactive-acceleration','output')
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
      ('identity','https://pubmed.ncbi.nlm.nih.gov/23435115/','Did you see that? Dissociating advanced visual information and ball flight constrains perception and action processes during one-handed catching','Acta Psychologica','peer_reviewed_research',88,'["The card requires a live partner ball release, chase, secure-before-limit outcome, controlled deceleration, and reset.","Adding a hop, second cue, post-capture cut, or gate-selection finish changes the ordered action."]'::JSONB),
      ('taxonomy','https://pubmed.ncbi.nlm.nih.gov/41710443/','Optimizing Agility Training in Team Sport Players—The Role of Perception-Action Coupling: A Systematic Review with Multi-Level Meta-Analysis','Journal of Sports Science and Medicine','peer_reviewed_research',90,'["Classify the task as live perception-action coupling with acceleration, tracking, capture, and controlled deceleration."]'::JSONB),
      ('anatomy','https://pubmed.ncbi.nlm.nih.gov/26733889/','Sprint Acceleration Mechanics: The Major Role of Hamstrings in Horizontal Force Production','Frontiers in Physiology','peer_reviewed_research',88,'["Short acceleration coordinates hip, knee, and ankle action with posterior-chain contribution; capture adds head-eye and upper-limb demands."]'::JSONB),
      ('biomechanics','https://pubmed.ncbi.nlm.nih.gov/26733889/','Sprint Acceleration Mechanics: The Major Role of Hamstrings in Horizontal Force Production','Frontiers in Physiology','peer_reviewed_research',88,'["Effective horizontal force and coordinated lower-limb mechanics support acceleration; the card also requires safe capture and braking."]'::JSONB),
      ('difficulty','https://pubmed.ncbi.nlm.nih.gov/23435115/','Did you see that? Dissociating advanced visual information and ball flight constrains perception and action processes during one-handed catching','Acta Psychologica','peer_reviewed_research',88,'["Ball-flight information constrains gaze and hand movement; irregular bounce raises coordination uncertainty.","Difficulty uses exercise complexity and physical difficulty only, with overall equal to their maximum."]'::JSONB),
      ('load_fatigue_recovery','https://pubmed.ncbi.nlm.nih.gov/26733889/','Sprint Acceleration Mechanics: The Major Role of Hamstrings in Horizontal Force Production','Frontiers in Physiology','peer_reviewed_research',88,'["Track high-intent starts, distance, contacts, braking exposures, failed captures, technical change, and recovery."]'::JSONB),
      ('constraints','https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf','Developing Linear Speed','National Strength and Conditioning Association','professional_standard',88,'["Use a measured clear lane, safe run-out, appropriate partner delivery, and low-volume quality sprint exposures."]'::JSONB),
      ('dosage','https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf','Developing Linear Speed','National Strength and Conditioning Association','professional_standard',88,'["Program low repetition counts and sufficient recovery to preserve fast, technically controlled efforts."]'::JSONB),
      ('instructions','https://pubmed.ncbi.nlm.nih.gov/23435115/','Did you see that? Dissociating advanced visual information and ball flight constrains perception and action processes during one-handed catching','Acta Psychologica','peer_reviewed_research',88,'["Declare the visual release, ball flight, bounce limit, capture, and run-out rules before speed progresses."]'::JSONB),
      ('safety_stop_rules','https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf','Developing Linear Speed','National Strength and Conditioning Association','professional_standard',88,'["Stop before mechanics, speed, lane safety, partner control, capture, or braking deteriorates."]'::JSONB),
      ('programming','https://pubmed.ncbi.nlm.nih.gov/41710443/','Optimizing Agility Training in Team Sport Players—The Role of Perception-Action Coupling: A Systematic Review with Multi-Level Meta-Analysis','Journal of Sports Science and Medicine','peer_reviewed_research',90,'["Use while fresh when live perception-action coupling serves the objective, and distinguish from preplanned change of direction."]'::JSONB),
      ('athlete_support','https://pubmed.ncbi.nlm.nih.gov/23435115/','Did you see that? Dissociating advanced visual information and ball flight constrains perception and action processes during one-handed catching','Acta Psychologica','peer_reviewed_research',88,'["Athletes need exact release, trajectory, capture, distance, bounce, run-out, dose, and stop rules in plain language."]'::JSONB),
      ('coach_support','https://pubmed.ncbi.nlm.nih.gov/41710443/','Optimizing Agility Training in Team Sport Players—The Role of Perception-Action Coupling: A Systematic Review with Multi-Level Meta-Analysis','Journal of Sports Science and Medicine','peer_reviewed_research',90,'["Coaches observe cue neutrality, reaction accuracy, first step, tracking, capture, braking, repeatability, and fatigue."]'::JSONB),
      ('accessibility','https://www.nsca.com/about-us/position-statements/youth-training-and-long-term-athletic-development/','Youth Training and Long-Term Athletic Development','National Strength and Conditioning Association','professional_standard',89,'["Individualize distance, speed, ball predictability, bounce limit, visual contrast, recovery, instruction, and supervision."]'::JSONB),
      ('alternates','https://pubmed.ncbi.nlm.nih.gov/35922872/','Alternatives to common approaches for training change of direction performance: a scoping review','BMC Sports Science, Medicine and Rehabilitation','peer_reviewed_research',87,'["Point-to-gate, second-cue, capture-to-cut, and hop-and-go tasks change action or perception constraints and remain distinct."]'::JSONB),
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
      ('https://www.youtube.com/watch?v=axhMilEMbnU','axhMilEMbnU','#SpeedWOD: Tennis Ball Drills','Compete Strength and Conditioning','inherited ball-drop candidate','YouTube oEmbed metadata verified 2026-07-26T23:08:00Z. Broad tennis-ball title; full exact live-drop, bounce-limit, capture, run-out, cue, safety, caption, accessibility, and approval review remain unresolved.'),
      ('https://www.youtube.com/watch?v=-CnxAvMs_24','-CnxAvMs_24','Ball Drop Reactive Drill','J Es','inherited ball-drop candidate','YouTube oEmbed metadata verified 2026-07-26T23:08:00Z. Title-level match only; full exact-contract and human quality review remain unresolved.'),
      ('https://www.youtube.com/watch?v=IIeZL5uH23s','IIeZL5uH23s','Ball Drop Reactive Drill','Champion Physical Therapy and Performance','inherited ball-drop candidate','YouTube oEmbed metadata verified 2026-07-26T23:08:00Z. Title-level match only; full variant, population, safety, caption, accessibility, and approval review remain unresolved.'),
      ('https://www.youtube.com/watch?v=r36sPP2pYTw','r36sPP2pYTw','Partner Ball Drop','Hand Eye Coaches','inherited partner ball-drop candidate','YouTube oEmbed metadata verified 2026-07-26T23:08:00Z. Full sprint distance, bounce limit, capture, run-out, cue, safety, caption, accessibility, and approval review remain unresolved.'),
      ('https://www.youtube.com/watch?v=RMV48ID6YV4','RMV48ID6YV4','Tennis Ball Reaction Start l Increase your Speed','Brandon Holder','inherited reaction-start candidate','YouTube oEmbed metadata verified 2026-07-26T23:08:00Z. Title suggests a reaction start; capture-before-limit and safe-run-out exact match require full human review.')
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
          'sourceCard', 'ball-drop-reaction-sprint'
        )
      ELSE NULL
    END,
    'candidate',
    NULL,
    NULL
  FROM (
    VALUES
      ('Partner Tennis Ball Drop Sprint','same_identity','The source preserves live release, chase, capture before a bounce limit, controlled deceleration, and reset.','{"ballType":"tennis_ball","bounceLimit":"declared"}'::JSONB),
      ('Partner Reaction Ball Drop Sprint','new_variant','An irregular reaction-ball bounce changes tracking uncertainty while preserving chase, secure-before-limit, braking, and reset.','{"ballType":"reaction_ball","flightPredictability":"irregular_after_bounce"}'::JSONB),
      ('Ball Drop/Point-and-Sprint Cone Reaction','new_definition','A cone route ending in run-through or stick does not require ball capture.','{"target":"cone_route","terminalAction":"run_through_or_stick"}'::JSONB),
      ('Reaction Ball Drop to Hop-and-Go','new_definition','A required hop contact changes the ordered action and impact exposure.','{"requiredInitialAction":"hop_contact"}'::JSONB),
      ('Ball Drop Sprint plus Direction Cue','new_definition','A second late directional cue creates a two-stimulus compound decision.','{"stimulusCount":2,"secondStimulus":"late_direction"}'::JSONB),
      ('Reaction Ball Drop Catch to Cut','new_definition','A required post-capture cut extends the ordered action beyond capture and braking.','{"postCaptureAction":"called_exit_cut"}'::JSONB),
      ('Gate Reaction Drill','new_definition','Cue-selected gate acceleration has no required object chase or capture.','{"target":"cone_gate","captureRequired":false}'::JSONB),
      ('Rolled Ball Chase','new_definition','Rolling changes object trajectory, pickup mechanics, and capture timing.','{"objectTrajectory":"ground_roll"}'::JSONB),
      ('One-Bounce Limit','modifier_annotation','Bounce limit changes task pressure and dose without changing the base action.','{"bounceLimit":1}'::JSONB),
      ('Two-Bounce Limit','modifier_annotation','A larger bounce allowance is a delivery regression.','{"bounceLimit":2}'::JSONB),
      ('Lateral Release Offset','new_variant','A declared offset changes projection direction and braking while preserving chase and capture.','{"releaseOffset":"left_or_right_declared","sideBalanceRequired":true}'::JSONB),
      ('Pre-Planned Sprint Start','new_definition','A known go time removes live perception-action coupling and object interception.','{"cuePredictability":"preplanned","captureRequired":false}'::JSONB)
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
      ('tennis-ball-partner-drop-catch','reaction-ball-partner-drop-secure','progression',78,ARRAY['complexity','decision_demand']::TEXT[],'Irregular reaction-ball bounce increases tracking, decision, and capture uncertainty after the predictable tennis-ball version is repeatable.','{"requires":["repeatable_true_cue_wait","safe_tennis_ball_capture_and_stop","reaction_ball_release_and_bounce_rule_declared"]}'::JSONB),
      ('reaction-ball-partner-drop-secure','tennis-ball-partner-drop-catch','regression',94,ARRAY['complexity','decision_demand']::TEXT[],'Predictable tennis-ball flight reduces tracking uncertainty while preserving live release, chase, capture, and braking.','{"useWhen":["tracking_or_capture_unstable","reaction_ball_bounce_too_variable","fatigue_or_confidence_requires_predictability"]}'::JSONB)
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
    source_variant.id,
    gate_variant.id,
    'lateral_substitution',
    58,
    ARRAY['decision_demand','complexity']::TEXT[],
    'Gate Reaction Drill can preserve live cue selection and short acceleration only when object tracking and capture are not required session objectives; it is not an identity-equivalent replacement.',
    jsonb_build_object(
      'useWhen', jsonb_build_array(
        'ball_capture_is_not_objective',
        'reviewed_gate_variant_is_available',
        'athlete_can_accelerate_and_decelerate_safely'
      ),
      'notEquivalentFor', jsonb_build_array(
        'object_tracking',
        'capture_timing',
        'ball_flight_interception'
      )
    ),
    'review',
    NULL,
    NULL,
    NULL
  FROM coaching.exercise_variant_v1 source_variant
  JOIN coaching.exercise_definition_v1 gate_definition
    ON gate_definition.facility_id = facility
   AND gate_definition.slug = 'gate-reaction-drill'
   AND gate_definition.status <> 'archived'
  JOIN coaching.exercise_variant_v1 gate_variant
    ON gate_variant.definition_id = gate_definition.id
   AND gate_variant.variant_key = 'baseline'
   AND gate_variant.status <> 'archived'
  WHERE source_variant.definition_id = target_definition_id
    AND source_variant.variant_key IN (
      'tennis-ball-partner-drop-catch',
      'reaction-ball-partner-drop-secure'
    )
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
        'Proposed exercise complexity from live cue waiting, first-step organization, ball-flight tracking, capture timing, release variability, braking, and partner coordination.'
      ),
      (
        'absoluteLoadDemand',
        (variant.difficulty_json ->> 'absoluteLoadDemand')::SMALLINT,
        'Proposed physical difficulty from acceleration intensity, distance, ground contacts, reaching, capture, braking, total trials, and recovery.'
      ),
      (
        'technicalFatigueSensitivity',
        (variant.fatigue_profile_json ->>
          'technicalFatigueSensitivity')::SMALLINT,
        'Proposed from false starts, delayed tracking, path change, unsafe reaching, missed capture, braking loss, speed decline, and attention under fatigue.'
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
          'The consolidated and distinct Ball Drop decisions are deterministic proposals and still require accountable human review before publication.'
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
        'code', 'athlete_comprehension_pilot_required',
        'message',
          'Athlete-facing release, bounce, capture, and run-out instructions require comprehension testing with representative users.'
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
