-- Resolve the Bound to Stick / Lateral Bound collision by making direction,
-- takeoff side, landing side, terminal action, and reset policy explicit.
--
-- Both stable slugs remain. Bound to Stick becomes an opposite-leg forward
-- bound to a terminal hold; Lateral Bound becomes an opposite-leg lateral
-- bound to a terminal hold. Same-leg hops, diagonal bounds, continuous bounds,
-- reactive continuations, and approach variants remain separate contracts.
-- oEmbed health is candidate metadata only and creates no human approval.
-- Exercise difficulty is complexity plus physical difficulty; overall is the
-- maximum. Athlete proficiency belongs only to coaching.skill.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '426_coaching_opposite_leg_bound_direction_identity_resolution';
  research_batch CONSTANT TEXT :=
    'opposite-leg-bound-stick-direction-family-v1';
  research_version CONSTANT TEXT := '2026-08-01.5';
  forward_slug CONSTANT TEXT := 'bound-to-stick';
  lateral_slug CONSTANT TEXT := 'lateral-bound';
  forward_legacy_id CONSTANT BIGINT := 992;
  lateral_legacy_id CONSTANT BIGINT := 7;
  forward_id UUID;
  lateral_id UUID;
  forward_variant_id UUID;
  lateral_variant_id UUID;
  diagonal_id UUID;
  rotational_id UUID;
  same_leg_lateral_id UUID;
  loop_definition_id UUID;
  loop_variant_id UUID;
  target_slug TEXT;
  direction_label TEXT;
  evidence_section TEXT;
  evidence_source_url TEXT;
  evidence_source_title TEXT;
  evidence_source_publisher TEXT;
  evidence_source_kind TEXT;
  evidence_source_quality SMALLINT;
  evidence_source_claims JSONB;
  applied_count INTEGER;
  protected_count INTEGER;
  actual_count INTEGER;
  evidence_sections CONSTANT TEXT[] := ARRAY[
    'identity','taxonomy','anatomy','biomechanics','difficulty',
    'load_fatigue_recovery','constraints','dosage','instructions',
    'safety_stop_rules','programming','athlete_support','coach_support',
    'accessibility','alternates','media'
  ];
BEGIN
  SELECT id INTO forward_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug=forward_slug;
  SELECT id INTO lateral_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND slug=lateral_slug;
  SELECT id INTO forward_variant_id
  FROM coaching.exercise_variant_v1 variant
  WHERE variant.definition_id=forward_id AND variant.variant_key='baseline';
  SELECT id INTO lateral_variant_id
  FROM coaching.exercise_variant_v1 variant
  WHERE variant.definition_id=lateral_id AND variant.variant_key='baseline';
  SELECT id INTO diagonal_id
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.facility_id=1 AND definition.slug='diagonal-bound-to-stick';
  SELECT id INTO rotational_id
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.facility_id=1 AND definition.slug='rotational-bound-to-stick';
  SELECT id INTO same_leg_lateral_id
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.facility_id=1
    AND definition.slug='single-leg-lateral-hop-to-stick';

  IF forward_id IS NULL OR lateral_id IS NULL
      OR forward_variant_id IS NULL OR lateral_variant_id IS NULL
      OR diagonal_id IS NULL OR rotational_id IS NULL
      OR same_leg_lateral_id IS NULL THEN
    RAISE EXCEPTION '% requires both definitions, adjacent boundaries, and baseline variants',
      migration_key;
  END IF;

  SELECT count(*) INTO applied_count
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.id IN(forward_id,lateral_id)
    AND definition.provenance_json->>'directionIdentityMigration'=migration_key;
  IF applied_count NOT IN(0,2) THEN
    RAISE EXCEPTION '% found a partial prior application',migration_key;
  END IF;

  IF applied_count=0 THEN
    IF(SELECT count(*) FROM coaching.exercise_definition_v1 definition
       WHERE definition.id IN(forward_id,lateral_id)
         AND definition.status='review' AND definition.card_version=1)<>2 THEN
      RAISE EXCEPTION '% expected two review cards at version 1',migration_key;
    END IF;
    IF NOT EXISTS(
      SELECT 1 FROM coaching.exercise_definition_source_v1 source
      WHERE source.definition_id=forward_id
        AND source.legacy_exercise_id=forward_legacy_id
    ) OR NOT EXISTS(
      SELECT 1 FROM coaching.exercise_definition_source_v1 source
      WHERE source.definition_id=lateral_id
        AND source.legacy_exercise_id=lateral_legacy_id
    ) THEN
      RAISE EXCEPTION '% requires legacy source lineage 992 and 7',migration_key;
    END IF;
  ELSE
    IF(SELECT count(*) FROM coaching.exercise_definition_v1 definition
       WHERE definition.id IN(forward_id,lateral_id)
         AND definition.status IN('review','published','deprecated')
         AND definition.card_version=2)<>2 THEN
      RAISE EXCEPTION '% found prior-application card drift',migration_key;
    END IF;
  END IF;

  IF EXISTS(
    SELECT 1 FROM coaching.exercise_identity_resolution_v1 resolution
    WHERE resolution.resolution_source='human_review'
      AND resolution.reviewed_by IS NOT NULL
      AND(
        ARRAY[resolution.survivor_definition_id,
          resolution.resolved_definition_id] @> ARRAY[forward_id,lateral_id]
        OR ARRAY[resolution.survivor_definition_id,
          resolution.resolved_definition_id] @> ARRAY[forward_id,diagonal_id]
        OR ARRAY[resolution.survivor_definition_id,
          resolution.resolved_definition_id] @> ARRAY[forward_id,rotational_id]
        OR ARRAY[resolution.survivor_definition_id,
          resolution.resolved_definition_id] @> ARRAY[lateral_id,same_leg_lateral_id]
      )
  ) THEN
    RAISE EXCEPTION '% refused to override a human identity decision',
      migration_key;
  END IF;

  SELECT
    (SELECT count(*) FROM coaching.exercise_definition_v1 definition
      WHERE definition.id IN(forward_id,lateral_id)
        AND(definition.status IN('published','deprecated')
          OR definition.reviewed_by IS NOT NULL
          OR definition.approved_by IS NOT NULL
          OR definition.last_reviewed_at IS NOT NULL
          OR definition.approved_video_url IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_section_evidence_v1 evidence
      WHERE evidence.definition_id IN(forward_id,lateral_id)
        AND evidence.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_media_candidate_v1 media
      WHERE media.definition_id IN(forward_id,lateral_id)
        AND media.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_alternate_assessment_v1 alternate
      WHERE alternate.definition_id IN(forward_id,lateral_id)
        AND alternate.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_card_review_v1 review
      WHERE review.definition_id IN(forward_id,lateral_id))
    +(SELECT count(*) FROM coaching.exercise_card_revision_v1 revision
      WHERE revision.definition_id IN(forward_id,lateral_id))
    +(SELECT count(*) FROM coaching.exercise_media_review_v1 review
      WHERE review.definition_id IN(forward_id,lateral_id))
    +(SELECT count(*) FROM coaching.exercise_variant_v1 variant
      WHERE variant.definition_id IN(forward_id,lateral_id)
        AND variant.variant_key='baseline' AND variant.status='published')
    +(SELECT count(*) FROM coaching.exercise_delivery_profile_v1 profile
      WHERE profile.variant_id IN(forward_variant_id,lateral_variant_id)
        AND profile.status='published')
    +(SELECT count(*) FROM coaching.exercise_score_calibration_v1 calibration
      WHERE calibration.variant_id IN(forward_variant_id,lateral_variant_id)
        AND(calibration.status<>'review'
          OR calibration.reviewed_by IS NOT NULL
          OR calibration.reviewed_at IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_relationship_v1 relationship
      WHERE relationship.from_variant_id IN(
          forward_variant_id,lateral_variant_id)
        AND relationship.to_variant_id IN(
          forward_variant_id,lateral_variant_id)
        AND(relationship.review_status<>'review'
          OR relationship.reviewed_by IS NOT NULL
          OR relationship.reviewed_at IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_score_v1 score
      WHERE score.exercise_id IN(forward_legacy_id,lateral_legacy_id)
        AND(score.human_review_status<>'queued'
          OR score.reviewed_by IS NOT NULL OR score.reviewed_at IS NOT NULL))
  INTO protected_count;
  IF protected_count>0 THEN
    RAISE EXCEPTION '% refused to overwrite % reviewed or published record(s)',
      migration_key,protected_count;
  END IF;

  IF applied_count=0 THEN
    UPDATE coaching.exercise_section_evidence_v1 evidence
    SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
      updated_at=now()
    WHERE evidence.definition_id IN(forward_id,lateral_id)
      AND evidence.reviewed_card_version=1
      AND evidence.review_status='candidate';
    UPDATE coaching.exercise_media_candidate_v1 media
    SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
      exact_variant_match=NULL,demonstration_quality_score=NULL,
      updated_at=now()
    WHERE media.definition_id IN(forward_id,lateral_id)
      AND media.reviewed_card_version=1
      AND media.review_status='candidate';
    UPDATE coaching.exercise_alternate_assessment_v1 alternate
    SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
      updated_at=now()
    WHERE alternate.definition_id IN(forward_id,lateral_id)
      AND alternate.reviewed_card_version=1
      AND alternate.review_status='candidate';
  END IF;

  UPDATE coaching.exercise_definition_v1 definition
  SET card_version=2,status='review',reviewed_by=NULL,approved_by=NULL,
    last_reviewed_at=NULL,approved_video_url=NULL,
    canonical_name=CASE definition.id
      WHEN forward_id THEN 'Opposite-Leg Forward Bound to Stick'
      ELSE 'Opposite-Leg Lateral Bound to Stick' END,
    display_name=CASE definition.id
      WHEN forward_id THEN 'Opposite-Leg Forward Bound to Stick'
      ELSE 'Opposite-Leg Lateral Bound to Stick' END,
    aliases=ARRAY(
      SELECT DISTINCT alias_value
      FROM unnest(coalesce(definition.aliases,'{}')||CASE definition.id
        WHEN forward_id THEN ARRAY[
          'Bound to Stick','Forward Bound to Stick','Forward Bound and Stick',
          'Opposite Leg Forward Bound to Stick']
        ELSE ARRAY[
          'Lateral Bound','Lateral Bound to Stick','Lateral Bound and Stick',
          'Opposite Leg Lateral Bound to Stick','Skater Bound to Stick'] END)
        alias_value
      ORDER BY alias_value),
    description=CASE definition.id
      WHEN forward_id THEN
        'From one declared support leg, project forward through flight, land on the opposite leg, absorb to a stable terminal hold without an extra hop or free-foot touch, then reset fully.'
      ELSE
        'From one declared support leg, project laterally through flight, land on the opposite leg, absorb to a stable terminal hold without an extra hop or free-foot touch, then reset fully.' END,
    family_key=CASE definition.id
      WHEN forward_id THEN 'opposite_leg_forward_bound_terminal_stick'
      ELSE 'opposite_leg_lateral_bound_terminal_stick' END,
    content_confidence=88,scoring_confidence=66,media_confidence=50,
    movement_patterns=ARRAY['brace','jump','land','locomote'],
    body_regions=ARRAY['ankle','core','foot','hip','knee'],
    required_equipment=ARRAY['none'],
    optional_equipment=ARRAY[]::TEXT[],
    environment_json=jsonb_build_object(
      'required',jsonb_build_array(
        'flat_dry_high_traction_surface','clear_visible_landing_zone',
        CASE definition.id WHEN forward_id THEN 'clear_forward_lane'
          ELSE 'clear_bilateral_lateral_lane' END,
        'adequate_fall_and_exit_space','no_cross_traffic'),
      'oneAthletePerLane',TRUE,'surfaceInspectionRequired',TRUE),
    population_json=jsonb_build_object(
      'readinessChecks',jsonb_build_array(
        'pain_free_bilateral_landing_warmup',
        CASE definition.id WHEN forward_id THEN
          'controlled_step_to_opposite_leg_forward_stick'
          ELSE 'controlled_step_to_opposite_leg_lateral_stick' END,
        'single_leg_finish_without_touchdown','can_stop_on_command'),
      'symptomExclusions',jsonb_build_array(
        'pain','guarding','instability','apprehension','neurologic_symptoms'),
      'individualizeDistanceAndDose',TRUE),
    anatomy_json=jsonb_build_object(
      'primaryMuscles',CASE definition.id WHEN forward_id THEN
        jsonb_build_array('gluteus_maximus','quadriceps','hamstrings',
          'soleus','gastrocnemius') ELSE
        jsonb_build_array('gluteus_medius','gluteus_maximus','adductors',
          'quadriceps','soleus','gastrocnemius') END,
      'secondaryMuscles',CASE definition.id WHEN forward_id THEN
        jsonb_build_array('gluteus_medius','adductors','foot_intrinsics',
          'tibialis_anterior','hip_flexors','abdominal_wall') ELSE
        jsonb_build_array('hamstrings','foot_intrinsics','tibialis_anterior',
          'peroneals','abdominal_wall') END,
      'joints',jsonb_build_array('foot','ankle','knee','hip','pelvis',
        'lumbar_spine','thoracic_spine','shoulder'),
      'jointActions',CASE definition.id WHEN forward_id THEN
        jsonb_build_array('forward_projection',
          'opposite_leg_landing_absorption','terminal_single_leg_stabilization')
        ELSE jsonb_build_array('lateral_projection',
          'opposite_leg_landing_absorption','terminal_single_leg_stabilization') END,
      'planes',CASE definition.id WHEN forward_id THEN
        jsonb_build_array('sagittal','frontal_and_transverse_control')
        ELSE jsonb_build_array('frontal','sagittal_and_transverse_control') END,
      'laterality','unilateral_takeoff_to_opposite_leg_landing_balanced_sides'),
    athlete_support_json=jsonb_build_object(
      'whyItMatters',CASE definition.id WHEN forward_id THEN
        'Builds forward unilateral projection and the ability to receive force on the opposite leg under control.'
        ELSE 'Builds lateral unilateral projection and the ability to receive force on the opposite leg under frontal-plane control.' END,
      'primaryCue',CASE definition.id WHEN forward_id THEN
        'Drive forward, land on the other leg, and own the brake.'
        ELSE 'Push sideways, land on the other leg, and own the brake.' END,
      'secondaryCues',jsonb_build_array(
        'Quiet whole foot','Hold without another hop','Reset before the next attempt'),
      'expectedSensations',jsonb_build_array(
        'brief_powerful_push_from_the_takeoff_leg',
        'foot_calf_thigh_and_hip_effort_on_landing',
        'balance_and_trunk_effort_during_the_hold'),
      'unexpectedSensations',jsonb_build_array(
        'sharp_or_increasing_joint_pain','Achilles_or_foot_pain',
        'giving_way_numbness_or_dizziness'),
      'painGuidance','Stop immediately for sharp, increasing, radiating, tendon, joint, or neurologic symptoms and tell the coach. Normal brief muscle effort should settle during full rest.',
      'selfChecks',jsonb_build_array(
        'I_land_on_the_declared_opposite_leg',
        'my_whole_foot_contacts_quietly',
        'I_hold_without_an_extra_hop_or_free_foot_touch',
        'the_next_attempt_would_be_as_crisp_as_the_first'),
      'accessibility',jsonb_build_object(
        'reducedImpact','Reduce distance and intent or use the step-to-stick regression.',
        'balanceSupport','Use the lower-impact step-to-stick task; do not add hand support to this exact bound identity.',
        'hearingSupport','Use visible direction, start, hold, and stop signals.',
        'cognitiveSupport','Use one marked target, name both legs, and rehearse one controlled attempt.'),
      'mediaAlternatives',jsonb_build_object(
        'captionsRequired',TRUE,'transcriptRequired',TRUE,
        'stillSequenceRequired',TRUE,'audioDescriptionRequired',TRUE,
        'requiredAngles',jsonb_build_array('front_or_back','side_or_frontal_plane')),
      'plainLanguage',CASE definition.id WHEN forward_id THEN
        'Push forward from one leg, land on the other leg, absorb quietly, hold, then reset.'
        ELSE 'Push sideways from one leg, land on the other leg, absorb quietly, hold, then reset.' END,
      'beforeYouStart',jsonb_build_array(
        'Confirm the lane and landing zone are dry, level, clear, and visible.',
        'Agree on takeoff leg, landing leg, direction, distance, hold, and stop signal.'),
      'expectedEffort',jsonb_build_array(
        'brief_high_intent_takeoff','single_leg_landing_and_braking_effort',
        'full_recovery_between_attempts'),
      'stopAndReport',jsonb_build_array(
        'pain_or_guarding','numbness_or_instability','slip_or_target_miss',
        'wrong_leg_or_direction','failed_hold_or_extra_contact'),
      'textAlternative',TRUE,'captionsRequiredForApproval',TRUE),
    coach_support_json=jsonb_build_object(
      'observationChecklist',jsonb_build_array(
        'declared_leg_takes_off_and_opposite_leg_lands',
        CASE definition.id WHEN forward_id THEN 'projection_is_forward_without_lateral_drift'
          ELSE 'projection_is_lateral_without_forward_or_diagonal_drift' END,
        'whole_foot_contacts_the_target_quietly',
        'foot_knee_hip_pelvis_and_trunk_remain_controlled',
        'hold_finishes_without_extra_hop_touchdown_or_foot_turn',
        'output_and_landing_quality_are_repeatable_on_both_sides'),
      'faultCorrections',jsonb_build_array(
        jsonb_build_object('fault','wrong_landing_leg','action','stop_rehearse_step_to_opposite_leg_stick_and_reduce_distance'),
        jsonb_build_object('fault','direction_drift','action','use_one_visible_target_and_reduce_distance'),
        jsonb_build_object('fault','loud_or_partial_foot_landing','action','reduce_intent_and_distance_or_use_step_to_stick'),
        jsonb_build_object('fault','extra_hop_or_free_foot_touch','action','widen_target_reduce_distance_and_lengthen_rest'),
        jsonb_build_object('fault','alignment_or_trunk_loss','action','end_set_or_regress_and_record_stop_reason')),
      'demonstrationPlan',jsonb_build_object(
        'angles',jsonb_build_array('front_or_back','side_or_frontal_plane'),
        'showCorrectReps',2,
        'showCommonFaults',jsonb_build_array('wrong_landing_leg','direction_drift','extra_hop'),
        'comprehensionCheck','Ask the athlete to name takeoff leg, opposite landing leg, direction, hold, and stop rule.'),
      'groupManagement',jsonb_build_object(
        'format','one_athlete_per_lane','athletesPerStation',1,
        'coachSightLine','see_full_flight_path_and_front_of_landing_leg',
        'queueRule','next_athlete_waits_outside_lane_until_full_reset',
        'equipmentSharing','targets_are_not_moved_during_a_set'),
      'modificationDecisionTree',jsonb_build_array(
        jsonb_build_object('when','pain_instability_or_neurologic_symptoms','action','stop_and_escalate'),
        jsonb_build_object('when','wrong_leg_direction_or_failed_hold','action','reduce_distance_and_rehearse_step_to_stick'),
        jsonb_build_object('when','quality_fails_twice_or_output_drops','action','end_set_and_record_stop_reason'),
        jsonb_build_object('when','all_attempts_are_clean_and_symmetric','action','progress_one_variable_next_exposure_after_review')),
      'doNotUseWhen',jsonb_build_array(
        'lane_surface_landing_zone_or_fall_space_is_unsafe',
        'pain_guarding_instability_apprehension_or_neurologic_symptoms_are_present',
        'the_athlete_cannot_preserve_direction_opposite_leg_landing_hold_and_reset',
        'prior_sprint_jump_change_of_direction_or_lower_body_work_has_reduced_quality'),
      'identityChecklist',jsonb_build_array(
        CASE definition.id WHEN forward_id THEN 'forward_projection'
          ELSE 'lateral_projection' END,
        'declared_takeoff_leg','opposite_leg_landing','terminal_hold',
        'full_reset_no_immediate_rebound'),
      'observe',jsonb_build_array(
        'whole_foot_contact','foot_knee_hip_pelvis_trunk_alignment',
        'contact_sound','absorption','hold','free_foot_touch','extra_hop',
        'direction_drift','side_difference','output_decline'),
      'cues',CASE definition.id WHEN forward_id THEN
        jsonb_build_array('Drive forward','Land on the other leg',
          'Quiet whole foot','Own the brake','Hold then reset')
        ELSE jsonb_build_array('Push sideways','Land on the other leg',
          'Quiet whole foot','Own hip knee and foot','Hold then reset') END,
      'qualityGate','Correct direction, opposite-leg landing, quiet whole-foot absorption, controlled alignment, declared hold, and full reset.',
      'stopRules',jsonb_build_array(
        'symptoms_or_apprehension','unsafe_surface_lane_or_traffic',
        'wrong_leg_or_direction','target_miss_slip_or_partial_foot',
        'loud_stiff_or_collapsing_landing','extra_hop_free_foot_touch_or_failed_hold',
        'two_consecutive_quality_failures_or_clear_output_decline')),
    support_operations_json=jsonb_build_object(
      'issueCategories',jsonb_build_array(
        'unsafe','unclear_instruction','inaccurate_identity','duplicate',
        'inaccessible','broken_media','dose_or_fatigue_mismatch'),
      'supportEscalation',jsonb_build_object(
        'safety','remove_from_selection_and_alert_library_owner',
        'brokenMedia','quarantine_candidate_and_schedule_re_review',
        'identityQuestion','route_to_canonical_identity_queue',
        'doseOrFatigue','route_to_coach_and_programming_review'),
      'retentionPolicy',jsonb_build_object(
        'athleteFeedbackDays',365,'incidentEvidence','facility_policy',
        'healthData','restrict_and_retain_per_facility_policy'),
      'changeImpactPolicy',jsonb_build_object(
        'identityOrSafetyChange','invalidate_current_release_and_revalidate_saved_workouts',
        'instructionChange','new_card_version',
        'mediaChange','invalidate_media_review',
        'scoreOrDoseChange','revalidate_saved_templates_and_fatigue_budgets'),
      'recordFields',jsonb_build_array(
        'takeoff_leg','landing_leg','direction','distance','hold_duration',
        'attempted_contacts','successful_contacts','rest_seconds','surface',
        'footwear','quality','symptoms','stop_reason'),
      'substitutionGuard','Never silently change direction, landing side, terminal action, approach, target, or cadence.',
      'impactBudgetUnit','one_opposite_leg_landing_contact_per_attempt',
      'rendering',jsonb_build_object(
        'athlete','plain_language_setup_action_finish_expected_effort_and_stop_path',
        'coach','identity_logistics_dose_observation_faults_stop_and_substitution'),
      'mediaReviewRequired',TRUE,'humanCalibrationRequired',TRUE,
      'pilotReviewRequired',TRUE),
    provenance_json=definition.provenance_json||jsonb_build_object(
      'directionIdentityMigration',migration_key,
      'researchBatch',research_batch,'researchVersion',research_version,
      'identityBoundary','forward_vs_lateral_projection_with_opposite_leg_terminal_stick',
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'mediaState','candidate_oembed_healthy_embedding_metadata_only',
      'humanReviewRequired',TRUE,'publicationQuarantined',TRUE,
      'approvalsCreated',FALSE),
    updated_at=now()
  WHERE definition.id IN(forward_id,lateral_id);

  UPDATE coaching.exercise_variant_v1 variant
  SET display_name=CASE variant.id WHEN forward_variant_id THEN
      'Opposite-Leg Forward Bound to Stick'
      ELSE 'Opposite-Leg Lateral Bound to Stick' END,
    modifier_keys=CASE variant.id WHEN forward_variant_id THEN
      ARRAY['forward','opposite_leg_landing','terminal_stick','full_reset']
      ELSE ARRAY['lateral','opposite_leg_landing','terminal_stick','full_reset'] END,
    difficulty_json=CASE variant.id WHEN forward_variant_id THEN
      jsonb_build_object(
        'technicalComplexity',56,'absoluteLoadDemand',64,
        'baseOverallDifficulty',64,'coordinationDemand',60,
        'supervisionDemand',54,'failureConsequence',58,'impact',4,
        'workCapacityDemand',38,
        'difficultyModel','max_exercise_complexity_physical_difficulty')
      ELSE jsonb_build_object(
        'technicalComplexity',60,'absoluteLoadDemand',66,
        'baseOverallDifficulty',66,'coordinationDemand',64,
        'supervisionDemand',58,'failureConsequence',62,'impact',4,
        'workCapacityDemand',40,
        'difficultyModel','max_exercise_complexity_physical_difficulty') END,
    requirements_json=jsonb_build_object(
      'selectable',TRUE,
      'direction',CASE variant.id WHEN forward_variant_id THEN 'forward'
        ELSE 'lateral' END,
      'takeoff','one_declared_leg','landing','opposite_leg',
      'terminalAction','stable_hold_declared_duration',
      'reset','full_reset_before_next_attempt',
      'prohibited',jsonb_build_array(
        'same_leg_landing','immediate_rebound','continuous_cadence',
        'undeclared_approach','undeclared_direction_change'),
      'humanReviewRequired',TRUE),
    status='review',
    load_profile_json=CASE variant.id WHEN forward_variant_id THEN
      jsonb_build_object(
        'loadingType','bodyweight_discrete_unilateral_forward_plyometric',
        'gripDemand',4,'spinalLoading',28,'eccentricStress',72,
        'landingContactsPerRep',1,'externalLoadMethod','bodyweight_only',
        'primaryStress',jsonb_build_array(
          'landing_foot_ankle_Achilles','landing_knee_hip_eccentric',
          'takeoff_posterior_chain','single_leg_braking'))
      ELSE jsonb_build_object(
        'loadingType','bodyweight_discrete_unilateral_lateral_plyometric',
        'gripDemand',4,'spinalLoading',32,'eccentricStress',74,
        'landingContactsPerRep',1,'externalLoadMethod','bodyweight_only',
        'primaryStress',jsonb_build_array(
          'landing_foot_ankle_Achilles_peroneals',
          'landing_knee_hip_eccentric','takeoff_lateral_hip',
          'frontal_plane_braking')) END,
    fatigue_profile_json=CASE variant.id WHEN forward_variant_id THEN
      jsonb_build_object(
        'localMuscleFatigue',64,'gripFatigue',4,
        'technicalFatigueSensitivity',78,'impactAccumulation',76,
        'impactBudget',76,
        'lowerLegBudget',70,'kneeHipEccentricBudget',72,
        'recoveryHours',72,'recoveryRangeHours','48_to_72',
        'overlap',jsonb_build_array(
          'sprinting','jumping','Achilles_loading','heavy_lower_body'))
      ELSE jsonb_build_object(
        'localMuscleFatigue',66,'gripFatigue',4,
        'technicalFatigueSensitivity',82,'impactAccumulation',78,
        'impactBudget',78,
        'lowerLegBudget',74,'kneeHipEccentricBudget',74,
        'frontalPlaneBudget',78,
        'recoveryHours',72,'recoveryRangeHours','48_to_72',
        'overlap',jsonb_build_array(
          'change_of_direction','jumping','Achilles_peroneal_loading',
          'heavy_lower_body')) END,
    programming_profile_json=jsonb_build_object(
      'primaryPhase','output','secondaryPhase','movement_intelligence',
      'freshnessRequired',TRUE,'countsAsHighIntensity',TRUE,
      'countsAsHighImpact',TRUE,'countsAsConditioning',FALSE,
      'doseUnit','attempts_each_takeoff_side',
      'sessionContactCapWithoutReview',18,
      'placement','before_material_sprint_jump_change_of_direction_or_lower_body_fatigue',
      'substitutionRule','preserve_direction_landing_side_terminal_action_and_reset',
      'trainingStimuli',CASE variant.id WHEN forward_variant_id THEN
        jsonb_build_array('forward_horizontal_power','opposite_leg_braking',
          'single_leg_landing_control')
        ELSE jsonb_build_array('lateral_power','frontal_plane_braking',
          'single_leg_landing_control') END,
      'stimulusDose',jsonb_build_object(
        'minimumEffectiveContacts',4,'typicalContacts',12,
        'maximumWithoutReview',18,'countUnit','landing_contacts'),
      'weeklyExposure',jsonb_build_object(
        'minimum',1,'typical',2,'maximum',3,'minimumRecoveryHours',48),
      'prerequisites',CASE variant.id WHEN forward_variant_id THEN
        jsonb_build_array('pain_free_landing_warmup',
          'controlled_step_to_opposite_leg_forward_stick',
          'stable_single_leg_finish','safe_forward_lane')
        ELSE jsonb_build_array('pain_free_landing_warmup',
          'controlled_step_to_opposite_leg_lateral_stick',
          'stable_single_leg_finish','safe_bilateral_lateral_lane') END,
      'completionCriteria',jsonb_build_array(
        'all_attempts_use_declared_direction_and_opposite_leg_landing',
        'quiet_whole_foot_contact_and_controlled_alignment',
        'declared_hold_without_extra_contact',
        'left_and_right_quality_remain_repeatable'),
      'sequenceRules',jsonb_build_object(
        'preferredAfter',jsonb_build_array(
          'general_warm_up','landing_pattern_rehearsal'),
        'preferredBefore',jsonb_build_array(
          'high_volume_sprinting','change_of_direction','heavy_lower_body',
          'conditioning'),
        'avoidAfter',jsonb_build_array(
          'material_jump_or_landing_fatigue','calf_or_Achilles_fatigue',
          'lower_body_conditioning')),
      'pairingCompatibility',jsonb_build_object(
        'recommended',jsonb_build_array(
          'low_demand_upper_body_power','full_recovery_mobility'),
        'acceptable',jsonb_build_array('low_volume_sprint_or_jump_power'),
        'incompatible',jsonb_build_array(
          'high_impact_density','fatigue_circuit','same_tissue_max_effort_pairing')),
      'interferenceRules',jsonb_build_array(
        jsonb_build_object('stimulus','sprint_or_change_of_direction_priority',
          'action','place_priority_task_first_or_reduce_bound_contacts'),
        jsonb_build_object('stimulus','Achilles_knee_hip_or_landing_fatigue',
          'action','regress_reduce_or_omit'),
        jsonb_build_object('stimulus','same_session_high_impact_volume',
          'action','count_all_contacts_in_one_cumulative_budget')),
      'uncertaintyPolicy','Exclude when direction, takeoff or landing side, surface, lane, current symptoms, prior impact exposure, or recovery state is unknown.'),
    updated_at=now()
  WHERE variant.id IN(forward_variant_id,lateral_variant_id);

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET status='archived',updated_at=now()
  WHERE profile.variant_id IN(forward_variant_id,lateral_variant_id)
    AND profile.profile_key NOT IN(
      'movement-intelligence-opposite-leg-forward-stick',
      'output-opposite-leg-forward-stick',
      'movement-intelligence-opposite-leg-lateral-stick',
      'output-opposite-leg-lateral-stick')
    AND profile.status='review';

  INSERT INTO coaching.exercise_delivery_profile_v1(
    id,variant_id,profile_key,phase_key,role,purpose,phase_suitability,
    methodology_alignment,objective_relevance_json,dosage_json,quality_gate,
    stop_rules,coach_instructions,athlete_instructions,expected_adaptation,
    equipment_required,logistics_json,substitution_ids,status,time_model_json,
    dose_scaling_json,measurement_json,support_prompts_json)
  SELECT gen_random_uuid(),seed.variant_id,seed.profile_key,seed.phase_key,
    seed.role,seed.purpose,seed.phase_suitability,seed.methodology_alignment,
    seed.objective_relevance,seed.dosage,seed.quality_gate,seed.stop_rules,
    seed.coach_instructions,seed.athlete_instructions,seed.expected_adaptation,
    ARRAY['none'],seed.logistics,ARRAY[]::UUID[],'review',seed.time_model,
    seed.dose_scaling,seed.measurement,seed.support_prompts
  FROM(VALUES
    (forward_variant_id,'movement-intelligence-opposite-leg-forward-stick',
      'movement_intelligence','secondary',
      'Learn exact forward projection, opposite-leg landing, terminal hold, and reset.',
      82::SMALLINT,88::SMALLINT,
      '{"landing_control":92,"directional_control":88}'::JSONB,
      '{"sets":"2_to_3","attemptsEachTakeoffSide":"2_to_3","restSeconds":"75_to_120","intent":"controlled_submaximal"}'::JSONB,
      'Forward path, opposite-leg landing, quiet whole-foot absorption, stable hold, and full reset.',
      ARRAY['symptoms_or_apprehension','wrong_leg_or_direction','unsafe_lane_or_surface','failed_hold_or_extra_contact','two_consecutive_quality_failures'],
      'Declare both legs, forward target, hold, dose, rest, lane, and stop signal. Observe every landing.',
      'Push forward, land on the other leg, absorb quietly, hold, and reset.',
      'Direction-specific opposite-leg landing control.',
      '{"lane":"clear_forward_lane","stationCapacity":1,"traffic":"none","surface":"dry_level_high_traction"}'::JSONB,
      '{"secondsPerAttempt":6,"restSeconds":"75_to_120","transitionSeconds":20,"sideChangeSeconds":15}'::JSONB,
      '{"scaleOrder":["distance","intent","contacts","target_width","hold","rest"],"preserve":["forward_direction","opposite_leg_landing","terminal_hold","full_reset"]}'::JSONB,
      '{"unit":"attempts_each_takeoff_side","record":["takeoff_leg","landing_leg","distance","hold","quality","symptoms"]}'::JSONB,
      '{"athlete":["show_forward_target","name_landing_leg","state_hold_and_stop_signal"],"coach":["confirm_lane","count_contacts","record_stop_reason"]}'::JSONB),
    (forward_variant_id,'output-opposite-leg-forward-stick','output','primary',
      'Express forward horizontal power with opposite-leg braking while fresh.',
      96::SMALLINT,94::SMALLINT,
      '{"horizontal_power":96,"landing_control":94,"deceleration":90}'::JSONB,
      '{"sets":"3_to_5","attemptsEachTakeoffSide":"1_to_3","restSeconds":"120_to_180","intent":"high_quality_high_intent","sessionContactCap":18}'::JSONB,
      'High-intent forward projection with unchanged opposite-leg landing, quiet absorption, stable hold, and full reset.',
      ARRAY['symptoms_or_apprehension','wrong_leg_or_direction','unsafe_lane_or_surface','loud_or_collapsing_landing','failed_hold_or_extra_contact','clear_output_decline'],
      'Place before material sprint, jump, or lower-body fatigue. End the set on the first clear loss of output or landing ownership.',
      'Drive forward, land on the other leg, own the brake, hold, then reset fully.',
      'Forward power expression with controlled opposite-leg braking.',
      '{"lane":"clear_forward_lane","stationCapacity":1,"traffic":"none","surface":"dry_level_high_traction"}'::JSONB,
      '{"secondsPerAttempt":6,"restSeconds":"120_to_180","transitionSeconds":20,"sideChangeSeconds":15}'::JSONB,
      '{"scaleOrder":["distance","intent","contacts","target_width","hold","rest"],"preserve":["forward_direction","opposite_leg_landing","terminal_hold","full_reset"]}'::JSONB,
      '{"unit":"attempts_each_takeoff_side","record":["takeoff_leg","landing_leg","distance","hold","successful_contacts","rest","quality","symptoms"]}'::JSONB,
      '{"athlete":["state_direction_and_landing_leg","state_expected_effort","state_stop_signal"],"coach":["verify_freshness","protect_contact_budget","record_output_drop"]}'::JSONB),
    (lateral_variant_id,'movement-intelligence-opposite-leg-lateral-stick',
      'movement_intelligence','secondary',
      'Learn exact lateral projection, opposite-leg landing, terminal hold, and reset.',
      84::SMALLINT,90::SMALLINT,
      '{"landing_control":94,"frontal_plane_control":92,"directional_control":90}'::JSONB,
      '{"sets":"2_to_3","attemptsEachTakeoffSide":"2_to_3","restSeconds":"90_to_120","intent":"controlled_submaximal"}'::JSONB,
      'Lateral path, opposite-leg landing, quiet whole-foot absorption, stable hold, and full reset.',
      ARRAY['symptoms_or_apprehension','wrong_leg_or_direction','unsafe_lane_or_surface','slip_or_failed_hold','two_consecutive_quality_failures'],
      'Declare both legs, lateral target, hold, dose, rest, bilateral fall space, and stop signal. Observe every landing.',
      'Push sideways, land on the other leg, absorb quietly, hold, and reset.',
      'Direction-specific opposite-leg lateral landing control.',
      '{"lane":"clear_bilateral_lateral_lane","stationCapacity":1,"traffic":"none","surface":"dry_level_high_traction"}'::JSONB,
      '{"secondsPerAttempt":6,"restSeconds":"90_to_120","transitionSeconds":20,"sideChangeSeconds":15}'::JSONB,
      '{"scaleOrder":["distance","intent","contacts","target_width","hold","rest"],"preserve":["lateral_direction","opposite_leg_landing","terminal_hold","full_reset"]}'::JSONB,
      '{"unit":"attempts_each_takeoff_side","record":["takeoff_leg","landing_leg","direction","distance","hold","quality","symptoms"]}'::JSONB,
      '{"athlete":["show_lateral_target","name_landing_leg","state_hold_and_stop_signal"],"coach":["confirm_both_landing_zones","count_contacts","record_stop_reason"]}'::JSONB),
    (lateral_variant_id,'output-opposite-leg-lateral-stick','output','primary',
      'Express lateral power with opposite-leg braking while fresh.',
      96::SMALLINT,96::SMALLINT,
      '{"lateral_power":96,"landing_control":96,"deceleration":94}'::JSONB,
      '{"sets":"3_to_5","attemptsEachTakeoffSide":"1_to_3","restSeconds":"120_to_180","intent":"high_quality_high_intent","sessionContactCap":18}'::JSONB,
      'High-intent lateral projection with unchanged opposite-leg landing, quiet absorption, stable hold, and full reset.',
      ARRAY['symptoms_or_apprehension','wrong_leg_or_direction','unsafe_lane_or_surface','slip_loud_or_collapsing_landing','failed_hold_or_extra_contact','clear_output_decline'],
      'Place before material change-of-direction, jump, or lower-body fatigue. End the set on the first clear loss of output or landing ownership.',
      'Push sideways, land on the other leg, own the brake, hold, then reset fully.',
      'Lateral power expression with controlled opposite-leg braking.',
      '{"lane":"clear_bilateral_lateral_lane","stationCapacity":1,"traffic":"none","surface":"dry_level_high_traction"}'::JSONB,
      '{"secondsPerAttempt":6,"restSeconds":"120_to_180","transitionSeconds":20,"sideChangeSeconds":15}'::JSONB,
      '{"scaleOrder":["distance","intent","contacts","target_width","hold","rest"],"preserve":["lateral_direction","opposite_leg_landing","terminal_hold","full_reset"]}'::JSONB,
      '{"unit":"attempts_each_takeoff_side","record":["takeoff_leg","landing_leg","direction","distance","hold","successful_contacts","rest","quality","symptoms"]}'::JSONB,
      '{"athlete":["state_direction_and_landing_leg","state_expected_effort","state_stop_signal"],"coach":["verify_freshness","protect_contact_and_frontal_plane_budgets","record_output_drop"]}'::JSONB)
  ) AS seed(variant_id,profile_key,phase_key,role,purpose,phase_suitability,
    methodology_alignment,objective_relevance,dosage,quality_gate,stop_rules,
    coach_instructions,athlete_instructions,expected_adaptation,logistics,
    time_model,dose_scaling,measurement,support_prompts)
  ON CONFLICT(variant_id,profile_key) DO UPDATE SET
    phase_key=EXCLUDED.phase_key,role=EXCLUDED.role,purpose=EXCLUDED.purpose,
    phase_suitability=EXCLUDED.phase_suitability,
    methodology_alignment=EXCLUDED.methodology_alignment,
    objective_relevance_json=EXCLUDED.objective_relevance_json,
    dosage_json=EXCLUDED.dosage_json,quality_gate=EXCLUDED.quality_gate,
    stop_rules=EXCLUDED.stop_rules,
    coach_instructions=EXCLUDED.coach_instructions,
    athlete_instructions=EXCLUDED.athlete_instructions,
    expected_adaptation=EXCLUDED.expected_adaptation,
    equipment_required=EXCLUDED.equipment_required,
    logistics_json=EXCLUDED.logistics_json,substitution_ids='{}'::UUID[],
    status='review',time_model_json=EXCLUDED.time_model_json,
    dose_scaling_json=EXCLUDED.dose_scaling_json,
    measurement_json=EXCLUDED.measurement_json,
    support_prompts_json=EXCLUDED.support_prompts_json,updated_at=now()
  WHERE coaching.exercise_delivery_profile_v1.status='review';

  FOREACH target_slug IN ARRAY ARRAY[forward_slug,lateral_slug] LOOP
    SELECT definition.id,variant.id,
      CASE target_slug WHEN forward_slug THEN 'forward' ELSE 'lateral' END
    INTO loop_definition_id,loop_variant_id,direction_label
    FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_variant_v1 variant
      ON variant.definition_id=definition.id AND variant.variant_key='baseline'
    WHERE definition.facility_id=1 AND definition.slug=target_slug;

    FOREACH evidence_section IN ARRAY evidence_sections LOOP
      IF evidence_section='media' THEN
        evidence_source_url := 'https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en';
        evidence_source_title := 'Embed videos and playlists';
        evidence_source_publisher := 'YouTube Help';evidence_source_kind := 'manufacturer_instruction';
        evidence_source_quality := 82;
        evidence_source_claims := jsonb_build_array(
          'Five candidate URLs returned current oEmbed metadata and iframe markup on 2026-08-01.',
          'Exact movement, complete playback, safety, cues, captions, accessibility, quality, reviewer identity, and approval remain unverified.');
      ELSIF evidence_section IN('identity','difficulty','load_fatigue_recovery',
          'constraints','dosage','programming','accessibility') THEN
        evidence_source_url := 'https://worldathletics.org/download/downloadnsa?filename=8877d8be-01c8-4d52-aa69-7e98c6920706.pdf&urlslug=plyometric-training-and-the-high-jump';
        evidence_source_title := 'Plyometric Training and the High Jump';
        evidence_source_publisher := 'World Athletics';evidence_source_kind := 'governing_body';
        evidence_source_quality := 82;
        evidence_source_claims := jsonb_build_array(
          'Single-leg bounding is a high-intensity task involving rapid body-mass acceleration and deceleration.',
          format('This card requires %s direction, opposite-leg landing, terminal hold, full reset, contact accounting, and fresh placement.',direction_label));
      ELSIF evidence_section IN('safety_stop_rules','athlete_support') THEN
        evidence_source_url := 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11366841/';
        evidence_source_title := 'Unilateral Plyometric Jump Training Shows Significantly More Effective than Bilateral Training in Improving Both Time to Stabilization and Peak Landing Force in Single-Leg Lend and Hold Test';
        evidence_source_publisher := 'Journal of Sports Science and Medicine';
        evidence_source_kind := 'peer_reviewed_research';evidence_source_quality := 90;
        evidence_source_claims := jsonb_build_array(
          'Single-leg landing force and time to stabilization are meaningful task outcomes.',
          'Use observable contact, alignment, stabilization, symptom, and output stop rules without inferring injury prediction.');
      ELSIF evidence_section IN('taxonomy','biomechanics','instructions','alternates') THEN
        evidence_source_url := 'https://pubmed.ncbi.nlm.nih.gov/17544325/';
        evidence_source_title := 'Jump-landing direction influences dynamic postural stability scores';
        evidence_source_publisher := 'Journal of Science and Medicine in Sport';
        evidence_source_kind := 'peer_reviewed_research';evidence_source_quality := 88;
        evidence_source_claims := jsonb_build_array(
          'Forward, diagonal, and lateral jump-landings produce direction-specific stabilization demands.',
          format('%s direction, opposite-leg landing, terminal hold, and reset are controlled identity fields.',initcap(direction_label)));
      ELSE
        evidence_source_url := 'https://pubmed.ncbi.nlm.nih.gov/29619806/';
        evidence_source_title := 'The influence of single-leg landing direction on lower limbs biomechanics';
        evidence_source_publisher := 'Journal of Sports Medicine and Physical Fitness';
        evidence_source_kind := 'peer_reviewed_research';evidence_source_quality := 88;
        evidence_source_claims := jsonb_build_array(
          'Landing direction changes whole-body configuration and joint energy-absorption strategy.',
          format('Record exact %s task anatomy, direction, sides, dose, quality, symptoms, and stop reason.',direction_label));
      END IF;

      INSERT INTO coaching.exercise_section_evidence_v1(
        id,definition_id,reviewed_card_version,section_key,source_url,
        source_title,source_publisher,source_kind,claims_json,evidence_quality,
        review_status,reviewer_user_id,reviewed_at)
      VALUES(gen_random_uuid(),loop_definition_id,2,evidence_section,evidence_source_url,
        evidence_source_title,evidence_source_publisher,evidence_source_kind,
        evidence_source_claims,evidence_source_quality,
        'candidate',NULL,NULL)
      ON CONFLICT(definition_id,reviewed_card_version,section_key,source_url)
      DO UPDATE SET source_title=EXCLUDED.source_title,
        source_publisher=EXCLUDED.source_publisher,
        source_kind=EXCLUDED.source_kind,claims_json=EXCLUDED.claims_json,
        evidence_quality=EXCLUDED.evidence_quality,review_status='candidate',
        reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now()
      WHERE coaching.exercise_section_evidence_v1.review_status IN(
        'candidate','superseded');
    END LOOP;
  END LOOP;

  INSERT INTO coaching.exercise_media_candidate_v1(
    id,definition_id,variant_id,reviewed_card_version,url,embed_url,video_id,
    title,channel_name,embedding_allowed,exact_variant_match,
    demonstration_quality_score,link_status,review_status,discovery_method,
    source_query,reviewer_user_id,reviewed_at,next_review_at,notes)
  SELECT gen_random_uuid(),seed.definition_id,seed.variant_id,2,
    'https://www.youtube.com/watch?v='||seed.video_id,
    'https://www.youtube-nocookie.com/embed/'||seed.video_id,seed.video_id,
    seed.title,seed.channel,TRUE,NULL,NULL,'healthy','candidate',
    'manual_research',seed.query,NULL,NULL,DATE '2026-11-01',seed.notes
  FROM(VALUES
    (forward_id,forward_variant_id,'braZR7YUo-g','Forward Bound with Stick','Mike Boyle Strength & Conditioning','forward bound to stick exercise','oEmbed metadata and iframe were healthy on 2026-08-01; exact opposite-leg contact order, full playback, safety, cues, captions, accessibility, quality, reviewer, and approval remain pending.'),
    (forward_id,forward_variant_id,'3od1hdaUTaY','Forward Bound and Stick','Dr. Alex St.Pierre DC','forward bound to stick exercise','oEmbed metadata and iframe were healthy on 2026-08-01; exact opposite-leg contact order, full playback, safety, cues, captions, accessibility, quality, reviewer, and approval remain pending.'),
    (forward_id,forward_variant_id,'fHkLmQEPGzg','Forward Bound and Stick','Steady State Health','forward bound to stick exercise','oEmbed metadata and iframe were healthy on 2026-08-01; indexed description names an opposite-foot landing, but full exact-match, safety, accessibility, quality, reviewer, and approval review remain pending.'),
    (forward_id,forward_variant_id,'SiTWaxZlBR8','Forward Bound w: Stick','Saint Joseph''s College Strength & Conditioning','forward bound to stick exercise','oEmbed metadata and iframe were healthy on 2026-08-01; exact opposite-leg contact order, full playback, safety, cues, captions, accessibility, quality, reviewer, and approval remain pending.'),
    (forward_id,forward_variant_id,'4nUyioG4Isk','SL Forward Bound and Stick','Theory of Motion Exercise Library','forward bound to stick exercise','oEmbed metadata and iframe were healthy on 2026-08-01; the SL title is ambiguous about landing side, and exact-match, safety, accessibility, quality, reviewer, and approval remain pending.'),
    (lateral_id,lateral_variant_id,'4nTDP0G3nhc','Lateral Bound with Stick','ken whittier','lateral bound to stick exercise','oEmbed metadata and iframe were healthy on 2026-08-01; exact opposite-leg contact order, full playback, safety, cues, captions, accessibility, quality, reviewer, and approval remain pending.'),
    (lateral_id,lateral_variant_id,'XDBHOQoAa3w','Lateral Bound with Stick','Champion Physical Therapy and Performance','lateral bound to stick exercise','oEmbed metadata and iframe were healthy on 2026-08-01; exact opposite-leg contact order, full playback, safety, cues, captions, accessibility, quality, reviewer, and approval remain pending.'),
    (lateral_id,lateral_variant_id,'2LUI7bkq5dE','Lateral Bound with Stick','Champion Physical Therapy and Performance','lateral bound to stick exercise','oEmbed metadata and iframe were healthy on 2026-08-01; exact opposite-leg contact order, full playback, safety, cues, captions, accessibility, quality, reviewer, and approval remain pending.'),
    (lateral_id,lateral_variant_id,'vbHLWvhNoOg','Lateral Bound and Stick','Theory of Motion Exercise Library','lateral bound to stick exercise','oEmbed metadata and iframe were healthy on 2026-08-01; exact opposite-leg contact order, full playback, safety, cues, captions, accessibility, quality, reviewer, and approval remain pending.'),
    (lateral_id,lateral_variant_id,'Biqvx8sMuvs','How To Perform The Lateral Bound and Stick','Exercise Healthcare Australia','lateral bound to stick exercise','oEmbed metadata and iframe were healthy on 2026-08-01; exact opposite-leg contact order, full playback, safety, cues, captions, accessibility, quality, reviewer, and approval remain pending.')
  ) AS seed(definition_id,variant_id,video_id,title,channel,query,notes)
  ON CONFLICT(definition_id,reviewed_card_version,video_id) DO UPDATE SET
    variant_id=EXCLUDED.variant_id,url=EXCLUDED.url,embed_url=EXCLUDED.embed_url,
    title=EXCLUDED.title,channel_name=EXCLUDED.channel_name,
    embedding_allowed=TRUE,exact_variant_match=NULL,
    demonstration_quality_score=NULL,link_status='healthy',
    review_status='candidate',discovery_method='manual_research',
    source_query=EXCLUDED.source_query,reviewer_user_id=NULL,reviewed_at=NULL,
    next_review_at=EXCLUDED.next_review_at,notes=EXCLUDED.notes,updated_at=now()
  WHERE coaching.exercise_media_candidate_v1.review_status IN(
    'candidate','superseded');

  INSERT INTO coaching.exercise_alternate_assessment_v1(
    id,definition_id,reviewed_card_version,alternate_name,classification,
    rationale,distinguishing_dimensions,proposed_card_json,review_status,
    reviewer_user_id,reviewed_at)
  SELECT gen_random_uuid(),seed.definition_id,2,seed.alternate_name,
    seed.classification,seed.rationale,seed.dimensions,NULL,'candidate',NULL,NULL
  FROM(VALUES
    (forward_id,'Small Opposite-Leg Forward Bound to Stick','same_identity','Reduced distance preserves direction, landing side, hold, and reset.','{"projectionDistance":"reduced"}'::JSONB),
    (forward_id,'Single-Leg Forward Hop to Same-Leg Stick','new_definition','Same-leg landing changes contact sequence and limb loading.','{"landingSide":"same_leg"}'::JSONB),
    (forward_id,'Opposite-Leg Lateral Bound to Stick','new_definition','Frontal projection changes direction-specific landing demand.','{"direction":"lateral"}'::JSONB),
    (forward_id,'Diagonal Bound to Stick','new_definition','Diagonal projection requires its own direction and target contract.','{"direction":"diagonal"}'::JSONB),
    (forward_id,'Continuous Alternating Bounds','new_definition','Immediate reacceleration removes the terminal hold and full reset.','{"terminalAction":"rebound","cadence":"continuous"}'::JSONB),
    (forward_id,'Approach Forward Bound to Stick','new_variant','An approach changes entry speed and loading.','{"approach":"run_in"}'::JSONB),
    (forward_id,'Loaded Forward Bound to Stick','new_variant','External load changes force, arm action, failure consequence, and dose.','{"externalLoad":"declared"}'::JSONB),
    (forward_id,'Forward Bound to Reactive Second Action','new_definition','A planned or reactive continuation changes the terminal contract.','{"terminalAction":"second_action"}'::JSONB),
    (forward_id,'Distance, Hold, Arm Policy, Target, Rest, or Starting Side','modifier_annotation','These parameters preserve identity when the exact base contract remains fixed.','{"modifiers":["distance","hold","arm_policy","target","rest","starting_side"]}'::JSONB),
    (lateral_id,'Small Opposite-Leg Lateral Bound to Stick','same_identity','Reduced distance preserves direction, landing side, hold, and reset.','{"projectionDistance":"reduced"}'::JSONB),
    (lateral_id,'Single-Leg Lateral Hop to Same-Leg Stick','new_definition','Same-leg landing changes contact sequence and limb loading.','{"landingSide":"same_leg"}'::JSONB),
    (lateral_id,'Opposite-Leg Forward Bound to Stick','new_definition','Sagittal projection changes direction-specific landing demand.','{"direction":"forward"}'::JSONB),
    (lateral_id,'Continuous Skater Bounds','new_definition','Immediate side-to-side reacceleration removes hold and reset.','{"terminalAction":"rebound","cadence":"continuous"}'::JSONB),
    (lateral_id,'Diagonal Bound to Stick','new_definition','Diagonal projection requires its own direction and target contract.','{"direction":"diagonal"}'::JSONB),
    (lateral_id,'Step-Behind Lateral Bound to Stick','new_variant','A step-behind approach changes entry speed, foot sequence, and loading.','{"approach":"step_behind"}'::JSONB),
    (lateral_id,'Loaded Lateral Bound to Stick','new_variant','External load changes force, arm action, failure consequence, and dose.','{"externalLoad":"declared"}'::JSONB),
    (lateral_id,'Reactive Lateral Bound Series','new_definition','Reactive cues or an immediate rebound change decision and terminal contracts.','{"response":"reactive","terminalAction":"continuation"}'::JSONB),
    (lateral_id,'Distance, Hold, Arm Policy, Trail Leg, Target, Rest, or Starting Side','modifier_annotation','These parameters preserve identity when the exact base contract remains fixed.','{"modifiers":["distance","hold","arm_policy","trail_leg","target","rest","starting_side"]}'::JSONB)
  ) AS seed(definition_id,alternate_name,classification,rationale,dimensions)
  ON CONFLICT(definition_id,reviewed_card_version,alternate_name)
  DO UPDATE SET classification=EXCLUDED.classification,
    rationale=EXCLUDED.rationale,
    distinguishing_dimensions=EXCLUDED.distinguishing_dimensions,
    proposed_card_json=NULL,review_status='candidate',reviewer_user_id=NULL,
    reviewed_at=NULL,updated_at=now()
  WHERE coaching.exercise_alternate_assessment_v1.review_status IN(
    'candidate','superseded');

  INSERT INTO coaching.exercise_score_calibration_v1(
    id,facility_id,variant_id,dimension,proposed_score,anchor_tier,rationale,
    status,version,created_by,reviewed_by,review_notes,reviewed_at)
  VALUES
    (gen_random_uuid(),1,forward_variant_id,'technicalComplexity',56,60,
      'Candidate complexity reflects declared direction and sides, opposite-leg flight transition, target control, whole-foot absorption, terminal stabilization, and full reset. Human anchor review is required.',
      'review',1,NULL,NULL,'Proposal only; no scoring or card approval is created.',NULL),
    (gen_random_uuid(),1,forward_variant_id,'absoluteLoadDemand',64,60,
      'Candidate physical difficulty reflects high-intent unilateral forward projection, opposite-leg impact, lower-leg and knee-hip eccentric braking, and accumulated sprint or jump exposure. Human anchor review is required.',
      'review',1,NULL,NULL,'Proposal only; no scoring or card approval is created.',NULL),
    (gen_random_uuid(),1,lateral_variant_id,'technicalComplexity',60,60,
      'Candidate complexity reflects declared lateral direction and sides, opposite-leg flight transition, frontal-plane target control, terminal stabilization, and full reset. Human anchor review is required.',
      'review',1,NULL,NULL,'Proposal only; no scoring or card approval is created.',NULL),
    (gen_random_uuid(),1,lateral_variant_id,'absoluteLoadDemand',66,60,
      'Candidate physical difficulty reflects high-intent unilateral lateral projection, opposite-leg impact, lower-leg, peroneal, adductor, and knee-hip braking, plus change-of-direction overlap. Human anchor review is required.',
      'review',1,NULL,NULL,'Proposal only; no scoring or card approval is created.',NULL)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
    proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,
    reviewed_by=NULL,review_notes=EXCLUDED.review_notes,reviewed_at=NULL,
    updated_at=now()
  WHERE coaching.exercise_score_calibration_v1.status='review';

  INSERT INTO coaching.exercise_relationship_v1(
    id,from_variant_id,to_variant_id,relationship,similarity_score,dimensions,
    reason,conditions_json,review_status,created_by,reviewed_by,reviewed_at)
  VALUES
    (gen_random_uuid(),forward_variant_id,lateral_variant_id,
      'lateral_substitution',72,
      ARRAY['bodyweight','opposite_leg_landing','terminal_stick','full_reset'],
      'Both are discrete opposite-leg bounds to a terminal hold, but forward versus lateral projection changes anatomy, stabilization, space, fatigue budget, and training purpose.',
      '{"onlyWhen":"directional_training_goal_can_change","mustPreserve":["opposite_leg_landing","terminal_hold","full_reset"],"coachConfirmationRequired":true}'::JSONB,
      'review',NULL,NULL,NULL),
    (gen_random_uuid(),lateral_variant_id,forward_variant_id,
      'lateral_substitution',72,
      ARRAY['bodyweight','opposite_leg_landing','terminal_stick','full_reset'],
      'Both are discrete opposite-leg bounds to a terminal hold, but lateral versus forward projection changes anatomy, stabilization, space, fatigue budget, and training purpose.',
      '{"onlyWhen":"directional_training_goal_can_change","mustPreserve":["opposite_leg_landing","terminal_hold","full_reset"],"coachConfirmationRequired":true}'::JSONB,
      'review',NULL,NULL,NULL)
  ON CONFLICT(from_variant_id,to_variant_id,relationship) DO UPDATE SET
    similarity_score=EXCLUDED.similarity_score,dimensions=EXCLUDED.dimensions,
    reason=EXCLUDED.reason,conditions_json=EXCLUDED.conditions_json,
    review_status='review',created_by=NULL,reviewed_by=NULL,reviewed_at=NULL,
    updated_at=now()
  WHERE coaching.exercise_relationship_v1.review_status='review';

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by,resolved_at)
  VALUES(1,forward_id,lateral_id,'distinct_exercises',
    'Both tasks take off from one leg, land on the opposite leg, terminate in a stable hold, and reset. They remain distinct because forward sagittal projection and lateral frontal projection create different direction-specific mechanics, landing demands, spatial constraints, fatigue budgets, coaching observations, and objectives.',
    jsonb_build_object(
      'boundary','forward_vs_lateral_projection',
      'sharedContract',jsonb_build_array(
        'one_leg_takeoff','opposite_leg_landing','terminal_hold','full_reset'),
      'distinctDimensions',jsonb_build_array(
        'direction','planes','joint_actions','stabilization','space',
        'fatigue_budget','objective'),
      'researchBatch',research_batch,'researchVersion',research_version,
      'decisionScope','deterministic_identity_boundary_not_human_approval',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,
      'migration',migration_key),
    'deterministic_identity_equivalence',NULL,now())
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,
    resolved_at=now()
  WHERE coaching.exercise_identity_resolution_v1.resolution_source<>'human_review'
    AND coaching.exercise_identity_resolution_v1.reviewed_by IS NULL;

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by,resolved_at)
  SELECT 1,seed.survivor_id,seed.resolved_id,'distinct_exercises',
    seed.rationale,
    jsonb_build_object(
      'boundary',seed.boundary_key,'researchBatch',research_batch,
      'researchVersion',research_version,
      'decisionScope','deterministic_identity_boundary_not_human_approval',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,
      'migration',migration_key),
    'deterministic_identity_equivalence',NULL,now()
  FROM(VALUES
    (forward_id,diagonal_id,'forward_vs_diagonal_projection',
      'Both finish on the opposite leg with a terminal hold, but a forward sagittal bound and a diagonal bound have different direction, target, stabilization, spatial, and coaching contracts.'),
    (forward_id,rotational_id,'forward_projection_vs_rotational_orientation_change',
      'Both use bound-to-stick language, but the forward card requires forward projection without a rotation task while the rotational card requires an orientation change with its own angle and landing contract.'),
    (lateral_id,same_leg_lateral_id,'opposite_leg_lateral_bound_vs_same_leg_lateral_hop',
      'Both travel laterally to a terminal hold, but the lateral bound lands on the opposite leg while the single-leg lateral hop lands on the same leg, changing ordered contacts and limb loading.')
  ) AS seed(survivor_id,resolved_id,boundary_key,rationale)
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,
    resolved_at=now()
  WHERE coaching.exercise_identity_resolution_v1.resolution_source<>'human_review'
    AND coaching.exercise_identity_resolution_v1.reviewed_by IS NULL;

  UPDATE coaching.exercise exercise
  SET name=CASE exercise.id WHEN forward_legacy_id THEN
      'Opposite-Leg Forward Bound to Stick'
      ELSE 'Opposite-Leg Lateral Bound to Stick' END,
    description=CASE exercise.id WHEN forward_legacy_id THEN
      'From one declared support leg, project forward, land on the opposite leg, absorb to a stable hold, then reset fully.'
      ELSE 'From one declared support leg, project laterally, land on the opposite leg, absorb to a stable hold, then reset fully.' END,
    instructions=CASE exercise.id WHEN forward_legacy_id THEN
      'Declare takeoff and landing legs, forward target, distance, hold, dose, rest, and stop signal. Drive forward, land on the other leg, absorb quietly, hold, then reset.'
      ELSE 'Declare takeoff and landing legs, lateral target, distance, hold, dose, rest, and stop signal. Push sideways, land on the other leg, absorb quietly, hold, then reset.' END,
    default_sets=3,default_reps=2,default_work_seconds=NULL,
    default_rest_seconds=CASE exercise.id WHEN forward_legacy_id THEN 120 ELSE 150 END,
    est_seconds_per_set=150,skill_level=NULL,
    card_summary=CASE exercise.id WHEN forward_legacy_id THEN
      'Discrete opposite-leg forward bound with terminal landing control and full reset.'
      ELSE 'Discrete opposite-leg lateral bound with terminal landing control and full reset.' END,
    coach_language=CASE exercise.id WHEN forward_legacy_id THEN
      'Verify forward projection, opposite-leg landing, quiet whole-foot absorption, alignment, hold, and reset. Stop for symptoms, wrong direction or leg, landing failure, or output decline.'
      ELSE 'Verify lateral projection, opposite-leg landing, quiet whole-foot absorption, frontal-plane alignment, hold, and reset. Stop for symptoms, wrong direction or leg, slip, landing failure, or output decline.' END,
    athlete_language=CASE exercise.id WHEN forward_legacy_id THEN
      'Drive forward, land on the other leg, own the brake, hold, then reset.'
      ELSE 'Push sideways, land on the other leg, own the brake, hold, then reset.' END,
    programming_logic=jsonb_build_object(
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'identityRule',CASE exercise.id WHEN forward_legacy_id THEN
        'forward_opposite_leg_terminal_stick_full_reset'
        ELSE 'lateral_opposite_leg_terminal_stick_full_reset' END,
      'fatigueRule','place_before_material_sprint_jump_change_of_direction_or_lower_body_fatigue',
      'impactBudgetUnit','one_landing_contact_per_attempt',
      'substitutionRule','never_silently_change_direction_landing_side_terminal_action_approach_or_cadence'),
    scalable_variables=ARRAY[
      'projection_distance','intent','attempts_each_takeoff_side',
      'target_width','hold_duration','rest_seconds'],
    movement_family=CASE exercise.id WHEN forward_legacy_id THEN
      'Opposite-leg forward bound terminal stick'
      ELSE 'Opposite-leg lateral bound terminal stick' END,
    primary_phase_key='output',
    phase_subrole=CASE exercise.id WHEN forward_legacy_id THEN
      'forward_horizontal_power_and_braking'
      ELSE 'lateral_power_and_braking' END,
    primary_order_slot=CASE exercise.id WHEN forward_legacy_id THEN
      'opposite_leg_forward_bound_stick'
      ELSE 'opposite_leg_lateral_bound_stick' END,
    movement_requirements=jsonb_build_object(
      'direction',CASE exercise.id WHEN forward_legacy_id THEN 'forward'
        ELSE 'lateral' END,
      'takeoff','one_declared_leg','landing','opposite_leg',
      'terminalAction','stable_hold','reset','full',
      'requiredEquipment',jsonb_build_array('none'),
      'requiredEnvironment',jsonb_build_array(
        'flat_dry_high_traction_surface','clear_lane','visible_landing_zone',
        'adequate_fall_space','no_cross_traffic')),
    coaching_execution=jsonb_build_object(
      'setup',jsonb_build_array(
        'Declare takeoff leg, landing leg, direction, target, distance, hold, dose, rest, and stop signal.',
        'Inspect the full lane, landing zone, traction, fall space, lighting, and traffic.'),
      'executionSteps',CASE exercise.id WHEN forward_legacy_id THEN
        jsonb_build_array('Load the declared support leg and drive forward.',
          'Land on the opposite leg with whole-foot contact.',
          'Absorb through ankle knee and hip while controlling pelvis and trunk.',
          'Hold without extra hop or free-foot touch, then reset fully.')
        ELSE jsonb_build_array('Load the declared support leg and push sideways.',
          'Land on the opposite leg with whole-foot contact.',
          'Absorb through ankle knee and hip while controlling pelvis and trunk.',
          'Hold without extra hop or free-foot touch, then reset fully.') END,
      'qualityGate','Correct direction, opposite-leg landing, quiet whole-foot absorption, controlled alignment, declared hold, and full reset.',
      'stopSigns',jsonb_build_array(
        'symptoms_or_apprehension','unsafe_lane_surface_or_traffic',
        'wrong_leg_or_direction','target_miss_slip_or_partial_foot',
        'loud_stiff_or_collapsing_landing','extra_hop_touchdown_or_failed_hold',
        'two_quality_failures_or_output_decline')),
    is_published=FALSE,why_publish_ready=FALSE,updated_at=now()
  WHERE exercise.id IN(forward_legacy_id,lateral_legacy_id);

  INSERT INTO coaching.exercise_difficulty_profile(
    exercise_id,technical,load,overall,recommended_age_min,
    recommended_age_max,attention_demand,notes,source,complexity,updated_at)
  VALUES
    (forward_legacy_id,5.6,6.4,6.4,NULL,NULL,'high',
      'Exercise complexity 56/100; physical difficulty 64/100; overall is max=64. Athlete proficiency is not an exercise field.',
      'candidate_research',NULL,now()),
    (lateral_legacy_id,6.0,6.6,6.6,NULL,NULL,'high',
      'Exercise complexity 60/100; physical difficulty 66/100; overall is max=66. Athlete proficiency is not an exercise field.',
      'candidate_research',NULL,now())
  ON CONFLICT(exercise_id) DO UPDATE SET technical=EXCLUDED.technical,
    load=EXCLUDED.load,overall=EXCLUDED.overall,recommended_age_min=NULL,
    recommended_age_max=NULL,attention_demand=EXCLUDED.attention_demand,
    notes=EXCLUDED.notes,source=EXCLUDED.source,complexity=NULL,
    updated_at=now();

  INSERT INTO coaching.exercise_dosage_profile(
    exercise_id,profile_name,is_default,volume_unit,default_sets,default_reps,
    default_work_seconds,default_distance,default_contacts,default_rounds,
    default_rest_seconds,tempo,load_type,default_intensity,default_rpe_min,
    default_rpe_max,default_load_note,est_seconds_per_set,session_volume_min,
    session_volume_max,weekly_volume_min,weekly_volume_max)
  VALUES
    (forward_legacy_id,'Default',TRUE,'reps_each_side',3,2,NULL,NULL,NULL,NULL,
      120,NULL,'bodyweight','high_quality_high_intent',7,9,
      'One opposite-leg landing contact per attempt; cap at 18 total contacts without review.',
      150,'1 attempt each takeoff side','3 attempts each takeoff side',NULL,36),
    (lateral_legacy_id,'Default',TRUE,'reps_each_side',3,2,NULL,NULL,NULL,NULL,
      150,NULL,'bodyweight','high_quality_high_intent',7,9,
      'One opposite-leg landing contact per attempt; cap at 18 total contacts without review.',
      150,'1 attempt each takeoff side','3 attempts each takeoff side',NULL,36)
  ON CONFLICT(exercise_id,profile_name) DO UPDATE SET is_default=TRUE,
    volume_unit=EXCLUDED.volume_unit,default_sets=EXCLUDED.default_sets,
    default_reps=EXCLUDED.default_reps,default_work_seconds=NULL,
    default_distance=NULL,default_contacts=NULL,default_rounds=NULL,
    default_rest_seconds=EXCLUDED.default_rest_seconds,tempo=NULL,
    load_type=EXCLUDED.load_type,default_intensity=EXCLUDED.default_intensity,
    default_rpe_min=EXCLUDED.default_rpe_min,
    default_rpe_max=EXCLUDED.default_rpe_max,
    default_load_note=EXCLUDED.default_load_note,
    est_seconds_per_set=EXCLUDED.est_seconds_per_set,
    session_volume_min=EXCLUDED.session_volume_min,
    session_volume_max=EXCLUDED.session_volume_max,
    weekly_volume_min=NULL,weekly_volume_max=EXCLUDED.weekly_volume_max;

  DELETE FROM coaching.exercise_phase_profile profile
  WHERE profile.exercise_id=lateral_legacy_id AND profile.phase_id=4;

  INSERT INTO coaching.exercise_phase_profile(
    exercise_id,phase_id,fit_weight,role,order_slot,order_index,
    freshness_required,fatigue_sensitivity,fatigue_cost,technical_complexity,
    impact_level,intensity_ceiling,notes)
  SELECT seed.exercise_id,phase.id,seed.fit_weight,seed.role,seed.order_slot,
    seed.order_index,seed.freshness_required,seed.fatigue_sensitivity,
    seed.fatigue_cost,seed.technical_complexity,seed.impact_level,
    seed.intensity_ceiling,seed.notes
  FROM(VALUES
    (forward_legacy_id,'movement_intelligence',4::SMALLINT,'secondary','opposite_leg_forward_bound_stick',700,FALSE,4::SMALLINT,3::SMALLINT,4::SMALLINT,3::SMALLINT,'moderate','Direction and landing-control patterning; preserve exact identity.'),
    (forward_legacy_id,'output',5::SMALLINT,'primary','opposite_leg_forward_bound_stick',710,TRUE,5::SMALLINT,4::SMALLINT,4::SMALLINT,4::SMALLINT,'high','High-intent forward power before fatigue; count every landing contact.'),
    (lateral_legacy_id,'movement_intelligence',4::SMALLINT,'secondary','opposite_leg_lateral_bound_stick',700,FALSE,4::SMALLINT,3::SMALLINT,4::SMALLINT,3::SMALLINT,'moderate','Direction and frontal-plane landing-control patterning; preserve exact identity.'),
    (lateral_legacy_id,'output',5::SMALLINT,'primary','opposite_leg_lateral_bound_stick',710,TRUE,5::SMALLINT,4::SMALLINT,4::SMALLINT,4::SMALLINT,'high','High-intent lateral power before fatigue; count every landing contact.')
  ) AS seed(exercise_id,phase_key,fit_weight,role,order_slot,order_index,
    freshness_required,fatigue_sensitivity,fatigue_cost,technical_complexity,
    impact_level,intensity_ceiling,notes)
  JOIN coaching.session_phase phase ON phase.key=seed.phase_key
  ON CONFLICT(exercise_id,phase_id) DO UPDATE SET
    fit_weight=EXCLUDED.fit_weight,role=EXCLUDED.role,
    order_slot=EXCLUDED.order_slot,order_index=EXCLUDED.order_index,
    freshness_required=EXCLUDED.freshness_required,
    fatigue_sensitivity=EXCLUDED.fatigue_sensitivity,
    fatigue_cost=EXCLUDED.fatigue_cost,
    technical_complexity=EXCLUDED.technical_complexity,
    impact_level=EXCLUDED.impact_level,
    intensity_ceiling=EXCLUDED.intensity_ceiling,notes=EXCLUDED.notes;

  UPDATE coaching.exercise_safety_profile safety
  SET risk_level=4,impact_level=4,requires_spotting=FALSE,
    requires_coach_supervision='recommended',minimum_age_recommended=NULL,
    minimum_skill_level=NULL,
    minimum_prerequisite_notes='Pain-free landing warm-up, controlled step to opposite-leg stick, stable single-leg finish, safe lane, and understood stop signal.',
    readiness_checks=ARRAY[
      'Inspect surface, lane, landing zone, traction, traffic, and fall space.',
      'Confirm pain-free bilateral landing and a controlled step to opposite-leg stick.',
      'Confirm the athlete can hold a single-leg finish and stop on command.'],
    contraindications=ARRAY[
      'Pain, guarding, instability, apprehension, or neurologic symptoms.',
      'Unsafe surface, traction, traffic, lighting, landing zone, or fall space.',
      'Cannot preserve the declared direction, opposite-leg landing, hold, and reset.'],
    stop_signs=ARRAY[
      'Pain, guarding, numbness, instability, dizziness, or unusual breathlessness.',
      'Wrong direction or landing leg, target miss, slip, or partial-foot contact.',
      'Loud, stiff, or collapsing landing; extra hop, free-foot touch, or failed hold.',
      'Two consecutive quality failures or clear output decline.'],
    common_substitutions=CASE safety.exercise_id WHEN forward_legacy_id THEN
      ARRAY['Step to Opposite-Leg Forward Stick','Small Opposite-Leg Forward Bound to Stick','Bilateral Forward Jump to Stick']
      ELSE ARRAY['Lateral Step to Opposite-Leg Stick','Small Opposite-Leg Lateral Bound to Stick','Bilateral Lateral Jump to Stick'] END
  WHERE safety.exercise_id IN(forward_legacy_id,lateral_legacy_id);

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  SELECT definition.id,1,2,'1.0.0',migration_key,'quarantined',
    jsonb_build_object(
      'stableSlugPreserved',TRUE,'directionExplicit',TRUE,
      'takeoffAndLandingSidesExplicit',TRUE,'terminalActionExplicit',TRUE,
      'resetExplicit',TRUE,'difficultyModel',
        'max_exercise_complexity_physical_difficulty',
      'requiredEvidenceSections',16,'candidateMediaCount',5,
      'mediaExactMatchReviewed',FALSE,'mediaApprovalCreated',FALSE,
      'deliveryProfileCount',2,'relationshipApprovalCreated',FALSE,
      'calibrationApprovalCreated',FALSE,'legacyPlanningProfilesUpdated',TRUE,
      'humanReviewRequired',TRUE,'publicationQuarantined',TRUE),
    jsonb_build_array(
      'human_content_review_required','human_media_exact_match_review_required',
      'human_scoring_calibration_required','human_relationship_review_required',
      'pilot_dosage_and_workout_flow_validation_required'),TRUE,now()
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.id IN(forward_id,lateral_id)
  ON CONFLICT(definition_id) DO UPDATE SET facility_id=1,card_version=2,
    schema_version='1.0.0',audit_version=EXCLUDED.audit_version,
    status='quarantined',checks_json=EXCLUDED.checks_json,
    blocking_issues_json=EXCLUDED.blocking_issues_json,
    human_review_required=TRUE,checked_at=now();

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.id IN(forward_id,lateral_id)
    AND definition.card_version=2 AND definition.status='review'
    AND definition.reviewed_by IS NULL AND definition.approved_by IS NULL
    AND definition.approved_video_url IS NULL
    AND definition.provenance_json->>'directionIdentityMigration'=migration_key;
  IF actual_count<>2 THEN
    RAISE EXCEPTION '% expected two quarantined version-2 cards, found %',
      migration_key,actual_count;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_section_evidence_v1 evidence
     WHERE evidence.definition_id IN(forward_id,lateral_id)
       AND evidence.reviewed_card_version=2
       AND evidence.review_status='candidate')<>32
    OR(SELECT count(DISTINCT evidence.section_key)
       FROM coaching.exercise_section_evidence_v1 evidence
       WHERE evidence.definition_id=forward_id
         AND evidence.reviewed_card_version=2
         AND evidence.review_status='candidate')<>16
    OR(SELECT count(DISTINCT evidence.section_key)
       FROM coaching.exercise_section_evidence_v1 evidence
       WHERE evidence.definition_id=lateral_id
         AND evidence.reviewed_card_version=2
         AND evidence.review_status='candidate')<>16 THEN
    RAISE EXCEPTION '% expected complete candidate evidence coverage',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_media_candidate_v1 media
     WHERE media.definition_id IN(forward_id,lateral_id)
       AND media.reviewed_card_version=2 AND media.review_status='candidate'
       AND media.link_status='healthy' AND media.embedding_allowed IS TRUE
       AND media.exact_variant_match IS NULL
       AND media.demonstration_quality_score IS NULL
       AND media.reviewer_user_id IS NULL AND media.reviewed_at IS NULL)<>10
    OR(SELECT count(*) FROM coaching.exercise_alternate_assessment_v1 alternate
       WHERE alternate.definition_id IN(forward_id,lateral_id)
         AND alternate.reviewed_card_version=2
         AND alternate.review_status='candidate'
         AND alternate.reviewer_user_id IS NULL
         AND alternate.reviewed_at IS NULL)<>18 THEN
    RAISE EXCEPTION '% expected candidate-only media and alternate packets',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_delivery_profile_v1 profile
     WHERE profile.variant_id IN(forward_variant_id,lateral_variant_id)
       AND profile.profile_key IN(
         'movement-intelligence-opposite-leg-forward-stick',
         'output-opposite-leg-forward-stick',
         'movement-intelligence-opposite-leg-lateral-stick',
         'output-opposite-leg-lateral-stick')
       AND profile.status='review')<>4
    OR(SELECT count(*) FROM coaching.exercise_score_calibration_v1 calibration
       WHERE calibration.variant_id IN(forward_variant_id,lateral_variant_id)
         AND calibration.status='review' AND calibration.reviewed_by IS NULL
         AND calibration.reviewed_at IS NULL)<>4
    OR(SELECT count(*) FROM coaching.exercise_relationship_v1 relationship
       WHERE relationship.from_variant_id IN(
           forward_variant_id,lateral_variant_id)
         AND relationship.to_variant_id IN(
           forward_variant_id,lateral_variant_id)
         AND relationship.relationship='lateral_substitution'
         AND relationship.review_status='review'
         AND relationship.reviewed_by IS NULL
         AND relationship.reviewed_at IS NULL)<>2 THEN
    RAISE EXCEPTION '% expected review-only delivery, calibration, and graph rows',
      migration_key;
  END IF;

  IF NOT EXISTS(
    SELECT 1 FROM coaching.exercise_identity_resolution_v1 resolution
    WHERE resolution.survivor_definition_id=forward_id
      AND resolution.resolved_definition_id=lateral_id
      AND resolution.decision='distinct_exercises'
      AND resolution.reviewed_by IS NULL
  ) THEN
    RAISE EXCEPTION '% did not resolve the direct identity collision',
      migration_key;
  END IF;
  IF(SELECT count(*) FROM coaching.exercise_identity_resolution_v1 resolution
     WHERE resolution.decision='distinct_exercises'
       AND resolution.reviewed_by IS NULL
       AND(
         (resolution.survivor_definition_id=forward_id
           AND resolution.resolved_definition_id=diagonal_id)
         OR(resolution.survivor_definition_id=forward_id
           AND resolution.resolved_definition_id=rotational_id)
         OR(resolution.survivor_definition_id=lateral_id
           AND resolution.resolved_definition_id=same_leg_lateral_id)
       ))<>3 THEN
    RAISE EXCEPTION '% did not close adjacent direction or landing-side collisions',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_difficulty_profile difficulty
     WHERE difficulty.exercise_id IN(forward_legacy_id,lateral_legacy_id)
       AND difficulty.overall=greatest(difficulty.technical,difficulty.load))<>2
    OR(SELECT count(*) FROM coaching.exercise_dosage_profile dosage
       WHERE dosage.exercise_id IN(forward_legacy_id,lateral_legacy_id)
         AND dosage.profile_name='Default'
         AND dosage.volume_unit='reps_each_side')<>2
    OR EXISTS(
      SELECT 1 FROM coaching.exercise exercise
      WHERE exercise.id IN(forward_legacy_id,lateral_legacy_id)
        AND(exercise.skill_level IS NOT NULL
          OR coaching.exercise_json_has_level_classification(
            jsonb_build_array(exercise.programming_logic,
              exercise.movement_requirements,exercise.coaching_execution)))
  ) THEN
    RAISE EXCEPTION '% found invalid legacy planning or level-classification state',
      migration_key;
  END IF;

  IF EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    WHERE definition.id IN(forward_id,lateral_id)
      AND coaching.exercise_json_has_level_classification(jsonb_build_array(
        definition.anatomy_json,definition.athlete_support_json,
        definition.coach_support_json,definition.support_operations_json,
        definition.provenance_json))
  ) OR EXISTS(
    SELECT 1 FROM coaching.exercise_media_candidate_v1 media
    WHERE media.definition_id IN(forward_id,lateral_id)
      AND(media.review_status IN('approved','shortlisted','rejected')
        OR media.reviewer_user_id IS NOT NULL OR media.reviewed_at IS NOT NULL
        OR media.exact_variant_match IS NOT NULL)
  ) THEN
    RAISE EXCEPTION '% created forbidden level or media approval state',
      migration_key;
  END IF;
END $$;
