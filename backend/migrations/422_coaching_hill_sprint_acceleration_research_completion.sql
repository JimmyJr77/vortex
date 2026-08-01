-- Complete one planning-ready Hill Sprint Acceleration candidate card.
--
-- Migration 339 is the identity authority: legacy sources 126 and 332 are one
-- stable incline-resisted acceleration definition. Two-point and controlled
-- falling starts are exact variants. Grade, distance, unit, markers, timing,
-- intent, and recovery are delivery dimensions. Steep grinding, long hill
-- conditioning, stairs, treadmill, sled, downhill, bounding, and shuttle work
-- remain outside this card until separately authored.
--
-- Difficulty means exercise complexity plus physical difficulty, with overall
-- derived as their maximum. Athlete proficiency belongs only to coaching.skill.
-- Evidence, media, graph, calibration, and card states remain review-only; this
-- migration creates no approval or external-media verification.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '422_coaching_hill_sprint_acceleration_research_completion';
  research_batch CONSTANT TEXT := 'hill-sprint-acceleration-family-v1';
  research_version CONSTANT TEXT := '2026-08-01.1';
  active_slug CONSTANT TEXT := 'hill-sprint-acceleration';
  audited_source_ids CONSTANT BIGINT[] := ARRAY[126,332];
  exact_variant_keys CONSTANT TEXT[] := ARRAY[
    'two-point-shallow-grade','falling-shallow-grade'
  ];
  already_applied_count INTEGER;
  actual_count INTEGER;
  protected_count INTEGER;
BEGIN
  SELECT count(*) INTO actual_count
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.facility_id=1 AND definition.slug=active_slug
    AND definition.status<>'archived';
  IF actual_count<>1 THEN
    RAISE EXCEPTION '% requires exactly one active prepared survivor; found %',
      migration_key,actual_count;
  END IF;

  SELECT count(*) INTO already_applied_count
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.facility_id=1 AND definition.slug=active_slug
    AND definition.status<>'archived'
    AND definition.provenance_json->>'researchCompletionMigration'=migration_key;
  IF already_applied_count NOT IN(0,1) THEN
    RAISE EXCEPTION '% found partial prior application',migration_key;
  END IF;
  IF already_applied_count=0 AND EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    WHERE definition.facility_id=1 AND definition.slug=active_slug
      AND definition.status<>'archived' AND definition.card_version<>1
  ) THEN
    RAISE EXCEPTION '% expected card version 1 before first application',migration_key;
  END IF;
  IF already_applied_count = 1 AND EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    WHERE definition.facility_id=1 AND definition.slug=active_slug
      AND definition.status<>'archived' AND definition.card_version <> 2
  ) THEN
    RAISE EXCEPTION '% found card-version drift after completion',migration_key;
  END IF;

  SELECT count(DISTINCT source.legacy_exercise_id) INTO actual_count
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_definition_source_v1 source
    ON source.definition_id=definition.id
  WHERE definition.facility_id=1 AND definition.slug=active_slug
    AND definition.status<>'archived'
    AND source.legacy_exercise_id=ANY(audited_source_ids);
  IF actual_count<>cardinality(audited_source_ids) OR EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_definition_source_v1 source
      ON source.definition_id=definition.id
    WHERE definition.facility_id=1 AND definition.slug=active_slug
      AND definition.status<>'archived'
      AND NOT(source.legacy_exercise_id=ANY(audited_source_ids))
  ) THEN
    RAISE EXCEPTION '% requires exactly legacy sources 126 and 332',migration_key;
  END IF;

  SELECT
    (SELECT count(*) FROM coaching.exercise_definition_v1 definition
      WHERE definition.facility_id=1 AND definition.slug=active_slug AND(
        definition.status IN('published','deprecated')
        OR definition.reviewed_by IS NOT NULL
        OR definition.approved_by IS NOT NULL
        OR definition.last_reviewed_at IS NOT NULL
        OR definition.approved_video_url IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_section_evidence_v1 evidence
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=evidence.definition_id
      WHERE definition.slug=active_slug
        AND evidence.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_media_candidate_v1 media
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=media.definition_id
      WHERE definition.slug=active_slug
        AND media.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_alternate_assessment_v1 alternate
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=alternate.definition_id
      WHERE definition.slug=active_slug
        AND alternate.review_status NOT IN('candidate','superseded'))
    +(SELECT count(*) FROM coaching.exercise_card_review_v1 review
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=review.definition_id
      WHERE definition.slug=active_slug)
    +(SELECT count(*) FROM coaching.exercise_card_revision_v1 revision
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=revision.definition_id
      WHERE definition.slug=active_slug)
    +(SELECT count(*) FROM coaching.exercise_media_review_v1 review
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=review.definition_id
      WHERE definition.slug=active_slug)
    +(SELECT count(*) FROM coaching.exercise_variant_v1 variant
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=variant.definition_id
      WHERE definition.slug=active_slug AND variant.status='published')
    +(SELECT count(*) FROM coaching.exercise_delivery_profile_v1 profile
      JOIN coaching.exercise_variant_v1 variant ON variant.id=profile.variant_id
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=variant.definition_id
      WHERE definition.slug=active_slug AND profile.status='published')
    +(SELECT count(*) FROM coaching.exercise_relationship_v1 relationship
      JOIN coaching.exercise_variant_v1 variant
        ON variant.id=relationship.from_variant_id
          OR variant.id=relationship.to_variant_id
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=variant.definition_id
      WHERE definition.slug=active_slug AND(
        relationship.review_status<>'review'
        OR relationship.reviewed_by IS NOT NULL
        OR relationship.reviewed_at IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_score_calibration_v1 calibration
      JOIN coaching.exercise_variant_v1 variant ON variant.id=calibration.variant_id
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=variant.definition_id
      WHERE definition.slug=active_slug AND(
        calibration.status<>'review' OR calibration.reviewed_by IS NOT NULL
        OR calibration.reviewed_at IS NOT NULL))
    +(SELECT count(*) FROM coaching.exercise_score_v1 score
      WHERE score.exercise_id=ANY(audited_source_ids) AND(
        score.human_review_status<>'queued' OR score.reviewed_by IS NOT NULL
        OR score.reviewed_at IS NOT NULL))
  INTO protected_count;
  IF protected_count>0 THEN
    RAISE EXCEPTION '% refused to overwrite % reviewed or published record(s)',
      migration_key,protected_count;
  END IF;

  IF already_applied_count=0 THEN
    UPDATE coaching.exercise_delivery_profile_v1 profile
    SET status='archived',updated_at=now()
    FROM coaching.exercise_variant_v1 variant
    JOIN coaching.exercise_definition_v1 definition
      ON definition.id=variant.definition_id
    WHERE profile.variant_id=variant.id AND definition.facility_id=1
      AND definition.slug=active_slug;

    UPDATE coaching.exercise_variant_v1 variant
    SET variant_key=CASE variant.variant_key
          WHEN 'baseline' THEN 'two-point-shallow-grade'
          WHEN 'legacy-source-126-baseline' THEN 'falling-shallow-grade'
          ELSE left('legacy-pre-422-'||variant.variant_key,120) END,
        display_name=CASE variant.variant_key
          WHEN 'baseline' THEN 'Hill Sprint Acceleration — Two-Point Shallow Grade'
          WHEN 'legacy-source-126-baseline' THEN 'Hill Sprint Acceleration — Falling Shallow Grade'
          ELSE variant.display_name END,
        status=CASE WHEN variant.variant_key IN(
          'baseline','legacy-source-126-baseline') THEN 'review' ELSE 'archived' END,
        updated_at=now()
    FROM coaching.exercise_definition_v1 definition
    WHERE variant.definition_id=definition.id AND definition.facility_id=1
      AND definition.slug=active_slug;
  END IF;

  UPDATE coaching.exercise_definition_v1 definition
  SET canonical_name='Hill Sprint Acceleration',
      display_name='Hill Sprint Acceleration',
      aliases=ARRAY(
        SELECT min(alias) FROM unnest(coalesce(definition.aliases,'{}')
          ||ARRAY['Low-Incline Hill Sprint Acceleration','Short Uphill Acceleration']::TEXT[]) alias
        WHERE nullif(btrim(alias),'') IS NOT NULL
          AND lower(btrim(alias))<>'hill sprint acceleration'
        GROUP BY lower(btrim(alias)) ORDER BY lower(btrim(alias))),
      description='From an explicit two-point or controlled falling start, accelerate continuously for a short marked distance up a measured, uniform, traction-safe positive grade. Sprint through the target, use the safe summit run-out, and walk back under control on the assigned route.',
      family_key='incline_resisted_acceleration',
      schema_version='1.0.0',
      card_version=CASE WHEN definition.provenance_json
        ->>'researchCompletionMigration' IS DISTINCT FROM migration_key
        THEN definition.card_version+1 ELSE definition.card_version END,
      status='review',content_confidence=80,scoring_confidence=70,
      media_confidence=20,
      movement_patterns=ARRAY[
        'incline_resisted_linear_acceleration','sprint_start',
        'continuous_uphill_sprint']::TEXT[],
      body_regions=ARRAY[
        'foot','ankle','calf','knee','thigh','hip','pelvis','core',
        'spine','shoulder','full_body']::TEXT[],
      required_equipment=ARRAY['incline_surface']::TEXT[],
      optional_equipment=ARRAY[
        'cones','grade_meter','timing_gates','video_capture']::TEXT[],
      anatomy_json=jsonb_build_object(
        'primaryMusclesAndTissues',jsonb_build_array(
          'gluteus_maximus','hamstrings','quadriceps','soleus','gastrocnemius'),
        'secondaryMusclesAndTissues',jsonb_build_array(
          'hip_flexors','gluteus_medius','adductors','intrinsic_foot',
          'tibialis_anterior','obliques','spinal_extensors','shoulder_girdle'),
        'joints',jsonb_build_array(
          'foot','ankle','knee','hip','pelvis','spine','shoulder'),
        'actions',jsonb_build_array(
          'hip_knee_ankle_extension','swing_leg_recovery',
          'reciprocal_arm_action','trunk_and_pelvis_stabilization'),
        'planes',jsonb_build_array(
          'sagittal','frontal_control','transverse_control'),
        'laterality','declared_start_lead_then_alternating_sprint_contacts'),
      environment_json=jsonb_build_object(
        'surface','dry_stable_non_slip_incline',
        'gradeContract','measured_declared_uniform_positive_grade_that_preserves_sprint_gait',
        'lane','clear_marked_no_holes_cross_slope_or_cross_traffic',
        'finish','visible_target_and_safe_summit_run_out',
        'returnRoute','separate_controlled_non_sprinted_walk_back',
        'weatherPolicy','stop_for_surface_traction_visibility_or_weather_deterioration'),
      population_json=jsonb_build_object(
        'selectionStatus','candidate_requires_human_review',
        'readinessChecks',jsonb_build_array(
          'progressive_sprint_warm_up_complete','pain_free_walk_jog_and_submaximal_uphill_acceleration',
          'selected_start_controlled','safe_finish_and_walk_down',
          'current_calf_Achilles_hamstring_and_back_tolerance'),
        'constraints',jsonb_build_array(
          'grade_preserves_sprint_gait','no_sprinted_descent','no_forced_start_shape',
          'full_recovery_preserves_output','symptoms_and_surface_state_checked_each_effort'),
        'contraindications',jsonb_build_array(
          'pain_limp_or_protective_mechanics','calf_or_Achilles_warning',
          'unsafe_traction_grade_lane_summit_or_descent','cannot_control_selected_start_or_finish')),
      athlete_support_json=jsonb_build_object(
        'plainLanguageSummary','Use the assigned start, sprint up the marked uniform hill through the finish, run out safely, and walk down on the assigned route.',
        'setupChecklist',jsonb_build_array(
          'confirm_start_and_lead_side','see_start_finish_and_summit',
          'confirm_walk_back_route','complete_submaximal_rehearsal'),
        'cues',jsonb_build_array(
          'project_with_the_hill','push_the_hill_away','fast_coordinated_arms',
          'complete_contacts','sprint_through_run_out_then_walk_down'),
        'feedbackPrompt','Did the effort stay fast and rhythmic without pain, slipping, grinding, or an unsafe finish?',
        'accessibilityOptions',jsonb_build_array(
          'shallower_uniform_grade','two_point_start','submaximal_intent',
          'shorter_distance','fewer_efforts','untimed_trials','visual_markers',
          'extra_demonstration','longer_recovery','separate_level_acceleration_substitute')),
      coach_support_json=jsonb_build_object(
        'observationPriorities',jsonb_build_array(
          'measured_grade_and_lane','exact_start_and_lead_side','first_contacts',
          'sprint_rhythm_and_projection','finish_and_summit_control','walk_back',
          'effort_contact_and_side_totals','timing_and_symptom_response'),
        'qualityGate','Count only efforts with the exact start, safe traction, continuous sprint gait, coordinated projection, repeatable rhythm or split, sprint through the target, controlled summit, and non-sprinted walk-back.',
        'stopRules',jsonb_build_array(
          'pain_calf_or_Achilles_warning_or_limp','slip_stumble_or_fall',
          'loss_of_sprint_gait_or_grinding','uncontrolled_trunk_collapse',
          'repeated_speed_or_rhythm_loss','unsafe_finish_descent_or_lane_conflict',
          'surface_weather_or_visibility_deterioration'),
        'reviewFlags',jsonb_build_array(
          'no_universal_grade_claim','grade_distance_and_surface_change_load',
          'steep_long_treadmill_sled_downhill_bound_and_shuttle_tasks_excluded',
          'all_evidence_media_graph_calibration_and_card_states_candidate_only')),
      support_operations_json=jsonb_build_object(
        'supportSummary','Expose grade, distance and unit, start, lead side, intent, effort count, recovery, lane, finish, walk-back, timing, symptoms, and quality stop.',
        'issueCategories',jsonb_build_array(
          'identity_or_variant','grade_surface_or_weather','difficulty_or_dose',
          'equipment_or_logistics','symptom_or_population_constraint',
          'instruction_or_accessibility','media_exact_match','relationship','calibration'),
        'supportEscalation',jsonb_build_object(
          'urgent',jsonb_build_array('acute_injury','fall','unsafe_lane_surface_summit_or_descent'),
          'coachReview',jsonb_build_array('repeated_sprint_gait_speed_rhythm_or_start_fault','persistent_symptom_or_asymmetry','dose_or_recovery_conflict'),
          'contentReview',jsonb_build_array('grade_identity_ambiguity','excluded_task_requested','media_mismatch','missing_accessibility_or_stop_rule')),
        'knownLimitations',jsonb_build_array(
          'no_single_universal_grade_or_dose','candidate_scores_need_independent_calibration',
          'media_not_externally_verified','relationships_unapproved','publication_and_pilot_review_incomplete'),
        'changeImpactPolicy','Changes to grade, surface, start, distance, intent, finish, descent, dose, stop rule, relationship, or media require renewed affected reviews.'),
      approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,
      last_reviewed_at=NULL,
      provenance_json=definition.provenance_json||jsonb_build_object(
        'researchCompletionMigration',migration_key,
        'researchBatch',research_batch,'researchVersion',research_version,
        'identityAuthorityMigration','339_coaching_high_confidence_implement_identity_consolidation',
        'difficultyModel','max_exercise_complexity_physical_difficulty',
        'evidenceState','candidate_requires_human_review',
        'mediaState','public_candidates_unverified_and_non_embeddable',
        'humanReviewRequired',TRUE,'publicationQuarantined',TRUE,
        'approvalsCreated',FALSE,'externalMediaVerificationPerformed',FALSE),
      updated_at=now()
  WHERE definition.facility_id=1 AND definition.slug=active_slug
    AND definition.status<>'archived';

  CREATE TEMP TABLE hill_variant_seed(
    variant_key TEXT PRIMARY KEY,display_name TEXT NOT NULL,
    start_geometry TEXT NOT NULL,complexity SMALLINT NOT NULL,
    physical SMALLINT NOT NULL,coordination SMALLINT NOT NULL,
    supervision SMALLINT NOT NULL,consequence SMALLINT NOT NULL,
    impact SMALLINT NOT NULL,work_capacity SMALLINT NOT NULL,
    technical_fatigue SMALLINT NOT NULL
  ) ON COMMIT DROP;
  INSERT INTO hill_variant_seed VALUES
    ('two-point-shallow-grade','Hill Sprint Acceleration — Two-Point Shallow Grade',
      'static_staggered_two_point',52,72,60,62,66,56,48,90),
    ('falling-shallow-grade','Hill Sprint Acceleration — Falling Shallow Grade',
      'controlled_whole_body_fall_to_first_recovery_step',56,72,64,66,70,56,48,92);

  UPDATE coaching.exercise_variant_v1 variant
  SET display_name=seed.display_name,
      modifier_keys=ARRAY[
        seed.start_geometry,'measured_uniform_positive_grade',
        'short_continuous_uphill_acceleration','safe_summit_run_out',
        'controlled_non_sprinted_walk_back']::TEXT[],
      difficulty_json=jsonb_build_object(
        'technicalComplexity',seed.complexity,
        'absoluteLoadDemand',seed.physical,
        'baseOverallDifficulty',greatest(seed.complexity,seed.physical),
        'coordinationDemand',seed.coordination,
        'supervisionDemand',seed.supervision,
        'failureConsequence',seed.consequence,'impact',seed.impact,
        'workCapacityDemand',seed.work_capacity,
        'difficultyModel','max_exercise_complexity_physical_difficulty',
        'dimensionMeaning',jsonb_build_object(
          'technicalComplexity','exercise_complexity',
          'absoluteLoadDemand','physical_difficulty'),
        'provisional',TRUE),
      requirements_json=jsonb_build_object(
        'selectable',TRUE,'identityQuarantine',FALSE,
        'startGeometry',seed.start_geometry,
        'grade','measured_declared_uniform_positive_grade_that_preserves_sprint_gait',
        'distance','declared_5_to_20_metres_or_equivalent_yards',
        'lane','traction_safe_marked_clear_uphill_lane',
        'finish','visible_target_with_safe_summit_run_out',
        'return','separate_controlled_non_sprinted_walk_back',
        'deliveryVariables',jsonb_build_array(
          'grade','distance','unit','markers','lead_side','timing',
          'intent','effort_count','recovery','surface','footwear'),
        'excludedIdentities',jsonb_build_array(
          'steep_grinding','long_hill_conditioning','stairs',
          'incline_treadmill','external_sled_or_band','downhill_overspeed',
          'uphill_bounding','shuttle_or_sprinted_descent')),
      status='review',
      load_profile_json=jsonb_build_object(
        'externalLoadMethod','bodyweight_acceleration_against_gravity_on_positive_grade',
        'externalLoadDescription','No external implement; grade and gravity materially raise physical demand.',
        'effectiveLoadDrivers',jsonb_build_array(
          'body_mass','grade','distance','speed_intent','surface','footwear',
          'uphill_contacts','run_out_contacts','effort_count','recovery'),
        'gripDemand',1,'spinalLoading',50,'eccentricStress',70,
        'landingContactsPerRep',14,
        'impactClass','moderate_to_high_by_speed_grade_surface_and_body_mass',
        'loadTracking',jsonb_build_array(
          'variant_key','grade','distance','unit','intent','efforts',
          'uphill_contacts','run_out_contacts','surface','footwear','timing')),
      fatigue_profile_json=jsonb_build_object(
        'localMuscleFatigue',78,'gripFatigue',1,
        'technicalFatigueSensitivity',seed.technical_fatigue,
        'impactAccumulation',65,'recoveryHours',48,
        'primaryFatigueSites',jsonb_build_array(
          'calf_Achilles_complex','plantar_flexors','posterior_chain',
          'quadriceps','hip_extensors','trunk_and_whole_body_coordination'),
        'earlyFatigueSignals',jsonb_build_array(
          'slower_split','rhythm_loss','long_grinding_contacts',
          'reaching_or_waist_bend','reduced_projection','calf_Achilles_warning',
          'unsafe_finish_or_walk_back'),
        'downstreamConflicts',jsonb_build_array(
          'other_high_intent_sprint_exposure','plyometric_contact_volume',
          'heavy_posterior_chain_or_calf_loading','fatigue_degraded_change_of_direction',
          'dense_conditioning')),
      programming_profile_json=jsonb_build_object(
        'selectionStatus','candidate_requires_human_review',
        'primaryIntent','high_quality_short_incline_resisted_acceleration',
        'appropriatePhases',jsonb_build_array('output'),
        'avoidUse',jsonb_build_array(
          'conditioning_by_shortening_rest','max_velocity_replacement',
          'level_sprint_replacement_without_level_exposure','unmeasured_or_variable_grade',
          'unsafe_or_wet_surface','sprinted_descent','fatigued_session_placement'),
        'cumulativeBudget',jsonb_build_object(
          'efforts',1,'sprintDistanceMetres',20,'uphillAndRunOutContacts',14,
          'impact',65,'localFatigue',78,'technicalFatigue',seed.technical_fatigue,
          'recoveryHours',48,'countInWorkout',TRUE)),
      updated_at=now()
  FROM hill_variant_seed seed,coaching.exercise_definition_v1 definition
  WHERE definition.id=variant.definition_id
    AND definition.facility_id=1 AND definition.slug=active_slug
    AND variant.variant_key=seed.variant_key;

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_variant_v1 variant
  JOIN coaching.exercise_definition_v1 definition
    ON definition.id=variant.definition_id
  WHERE definition.facility_id=1 AND definition.slug=active_slug
    AND variant.status<>'archived' AND variant.variant_key=ANY(exact_variant_keys);
  IF actual_count<>2 THEN
    RAISE EXCEPTION '% requires both exact prepared start variants; found %',
      migration_key,actual_count;
  END IF;

  INSERT INTO coaching.exercise_delivery_profile_v1(
    variant_id,profile_key,phase_key,role,purpose,phase_suitability,
    methodology_alignment,objective_relevance_json,dosage_json,quality_gate,
    stop_rules,coach_instructions,athlete_instructions,expected_adaptation,
    equipment_required,logistics_json,substitution_ids,status,time_model_json,
    dose_scaling_json,measurement_json,support_prompts_json)
  SELECT variant.id,'high-quality-output','output','primary',
    'Develop short acceleration against a uniform positive grade while preserving sprint gait, output quality, a safe summit finish, and full recovery.',
    CASE seed.variant_key WHEN 'two-point-shallow-grade' THEN 95 ELSE 90 END,
    92,
    jsonb_build_object(
      'shortAcceleration',96,'inclineResistance',96,'firstStepProjection',92,
      'sprintOutput',94,'conditioning',10,'identityResolved',TRUE,
      'humanReviewRequired',TRUE),
    jsonb_build_object(
      'sets',jsonb_build_array(1,3),'effortsPerSet',jsonb_build_array(1,3),
      'totalEfforts',jsonb_build_array(2,6),
      'distance',jsonb_build_array(5,20),'distanceUnit','metres_or_declared_yards',
      'targetRpe',9,'intent','maximal_or_near_maximal_after_submaximal_rehearsal',
      'restSeconds',jsonb_build_array(90,240),'walkBackIsRecovery',FALSE,
      'fullRecoveryRequired',TRUE,
      'stopBeforeConditioning',TRUE),
    'Every counted effort uses the exact start on the measured uniform grade, preserves fast continuous sprint gait and repeatable rhythm or split, crosses the target at speed, controls the summit, and walks down on the assigned route.',
    ARRAY[
      'Stop for pain, calf or Achilles warning, limp, protective mechanics, slip, stumble, or fall.',
      'Stop for long grinding contacts, loss of sprint rhythm or projection, uncontrolled trunk collapse, or repeated speed loss.',
      'Stop for lane conflict, unsafe finish or descent, or deterioration in traction, surface, weather, lighting, or visibility.',
      'Do not sprint the descent, shorten recovery to create conditioning, or substitute an excluded identity.'
    ]::TEXT[],
    ARRAY[
      'Measure and declare the uniform grade, distance and unit; inspect the lane, summit, run-out, walk-back, surface, footwear, weather, and athlete spacing.',
      'Declare the exact start and lead side, rehearse submaximally, and observe the first contacts, whole-body projection, rhythm, target crossing, summit, and walk-back.',
      'Record effort count, grade, distance, timing when used, uphill and run-out contacts, symptoms, faults, and the exact quality stop.'
    ]::TEXT[],
    ARRAY[
      'Use the called start and lead side. Look through the clear lane and wait for the start instruction.',
      'Project with the hill, push it away with complete contacts, and coordinate fast arms while staying in sprint rhythm.',
      'Sprint through the finish, control the summit run-out, then walk down on the assigned route. Stop for pain, slipping, grinding, or an unsafe finish.'
    ]::TEXT[],
    'Improved expression and repeatability of short incline-resisted acceleration without promising superiority to equal-volume level sprint training.',
    ARRAY['incline_surface']::TEXT[],
    jsonb_build_object(
      'athletesPerLane',1,'laneSpacing','one_athlete_per_clear_uphill_lane',
      'coachSightline','side_for_projection_and_contacts_plus_finish_view_for_summit_and_walk_back',
      'requiredClearance','marked_uphill_lane_safe_summit_run_out_and_separate_walk_back',
      'setupSeconds',180,'transitionSeconds',30,
      'weatherAndSurfaceRecheck','before_each_set_and_after_any_change',
      'optionalTools',jsonb_build_array('cones','grade_meter','timing_gates','video_capture')),
    '{}'::UUID[],'review',
    jsonb_build_object(
      'setupSeconds',180,'effortSeconds',jsonb_build_array(2,8),
      'restSeconds',jsonb_build_array(90,240),'transitionSeconds',30,
      'estimatedTotalMinutes',jsonb_build_array(6,24),'restIsExplicit',TRUE,
      'walkBackDoesNotReplaceRest',TRUE),
    jsonb_build_object(
      'scaleDown',jsonb_build_array(
        'use_shallower_uniform_grade','use_two_point_start','reduce_intent_after_rehearsal',
        'shorten_distance','reduce_efforts','remove_timing','increase_recovery',
        'use_separate_level_acceleration_definition'),
      'scaleUp',jsonb_build_array(
        'improve_repeatability','add_timing_without_changing_identity',
        'increase_distance_within_5_to_20_metres','increase_efforts_within_budget',
        'use_controlled_falling_start'),
      'neverScaleBy',jsonb_build_array(
        'steepening_until_grinding','sprinting_descent','adding_sled_or_band',
        'moving_to_stairs_or_treadmill','lengthening_into_conditioning',
        'shortening_rest_until_fatigued','continuing_through_pain_or_quality_loss')),
    jsonb_build_object(
      'track',jsonb_build_array(
        'variant_key','grade','distance','unit','lead_side','intent','efforts',
        'rest_seconds','split_or_rhythm','uphill_contacts','run_out_contacts',
        'surface','footwear','weather','symptoms','faults','quality_stop'),
      'qualityThreshold','Repeatable start, rhythm or split, sprint gait, target crossing, summit control, symptoms, and walk-back.',
      'productionSelectable',TRUE),
    jsonb_build_object(
      'beforeSet',jsonb_build_array(
        'confirm_grade_lane_finish_run_out_walk_back_surface_weather_and_footwear',
        'confirm_variant_lead_side_distance_unit_intent_efforts_recovery_and_stop_signal',
        'complete_submaximal_rehearsal'),
      'duringSet',jsonb_build_array(
        'watch_start_first_contacts_projection_rhythm_target_summit_and_walk_back',
        'announce_first_material_quality_or_safety_stop','protect_lane_spacing_and_full_recovery'),
      'afterSet',jsonb_build_array(
        'record_grade_dose_timing_contacts_symptoms_faults_and_stop_reason',
        'update_cumulative_sprint_impact_local_fatigue_and_recovery_budgets',
        'regress_or_substitute_without_silently_changing_identity'))
  FROM hill_variant_seed seed
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id=1 AND definition.slug=active_slug
      AND definition.status<>'archived'
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id=definition.id
      AND variant.variant_key=seed.variant_key AND variant.status<>'archived'
  ON CONFLICT(variant_id,profile_key)
  DO UPDATE SET phase_key=EXCLUDED.phase_key,role=EXCLUDED.role,
    purpose=EXCLUDED.purpose,phase_suitability=EXCLUDED.phase_suitability,
    methodology_alignment=EXCLUDED.methodology_alignment,
    objective_relevance_json=EXCLUDED.objective_relevance_json,
    dosage_json=EXCLUDED.dosage_json,quality_gate=EXCLUDED.quality_gate,
    stop_rules=EXCLUDED.stop_rules,coach_instructions=EXCLUDED.coach_instructions,
    athlete_instructions=EXCLUDED.athlete_instructions,
    expected_adaptation=EXCLUDED.expected_adaptation,
    equipment_required=EXCLUDED.equipment_required,
    logistics_json=EXCLUDED.logistics_json,
    substitution_ids=EXCLUDED.substitution_ids,status='review',
    time_model_json=EXCLUDED.time_model_json,
    dose_scaling_json=EXCLUDED.dose_scaling_json,
    measurement_json=EXCLUDED.measurement_json,
    support_prompts_json=EXCLUDED.support_prompts_json,updated_at=now();

  CREATE TEMP TABLE family_packet_seed(
    packet_slug TEXT PRIMARY KEY,research_version TEXT NOT NULL,
    packet_json JSONB NOT NULL
  ) ON COMMIT DROP;
  INSERT INTO family_packet_seed VALUES
  -- BEGIN GENERATED CANONICAL RESEARCH PACKETS
    ('hill-sprint-acceleration','2026-08-01.1',$packet${"assessmentSummary":{"identity":"A short maximal or near-maximal continuous linear acceleration up a measured, uniform, traction-safe positive grade from an explicitly selected two-point or controlled falling start, followed by a safe summit run-out and non-sprinted walk-back.","currentCardFindings":["The current card merges a mild 10–20 m source and a low-incline 5–15 yard source but does not store grade measurement, grade acceptance, runway, summit, descent, start, finish, or walk-back contracts.","The baseline 40 complexity and 10 physical-demand scores treat no implement as low physical difficulty despite maximal acceleration against gravity.","Anatomy, load, fatigue, environment, population, athlete support, coach operations, graph, calibration, and current-version research are empty.","Five legacy video IDs have no title, channel, availability, embedding, exact-match, content-quality, accessibility, or reviewer decision."],"proposedTaxonomy":{"movementPatterns":["incline_resisted_linear_acceleration","sprint_start","continuous_uphill_sprint"],"jointActions":["hip_knee_ankle_extension","swing_leg_recovery","reciprocal_arm_action","trunk_and_pelvis_stabilization"],"planes":["sagittal","frontal_control","transverse_control"],"laterality":"declared_start_lead_then_alternating_sprint_contacts","intent":"high_quality_short_acceleration_against_uniform_positive_grade"},"proposedAnatomy":{"primaryMuscles":["gluteus_maximus","hamstrings","quadriceps","soleus","gastrocnemius"],"secondaryMuscles":["hip_flexors","gluteus_medius","adductors","intrinsic_foot","tibialis_anterior","obliques","spinal_extensors","shoulder_girdle"],"joints":["foot","ankle","knee","hip","pelvis","spine","shoulder"]},"proposedDifficulty":{"technicalComplexity":52,"absoluteLoadDemand":72,"coordinationDemand":60,"supervisionDemand":62,"failureConsequence":66,"impact":56,"workCapacityDemand":48,"baseOverallDifficulty":72},"proposedLoadProfile":{"loadingType":"maximal_bodyweight_acceleration_against_gravity_on_positive_grade","impactClass":"moderate_to_high_by_speed_grade_surface_and_body_mass","landingContactsPerRep":"count_all_uphill_and_run_out_contacts_separately_from_walk_back","primaryStress":["hip_extensor_work","knee_extensor_work","plantar_flexor_and_Achilles_demand","posterior_chain","whole_body_coordination"],"fatigueSensitivity":"grade_speed_stride_rhythm_projection_contact_quality_calf_Achilles_response_and_summit_control"},"proposedConstraints":{"requiredEquipment":["measured_uniform_positive_grade","traction_safe_uphill_lane","start_and_finish_markers","safe_summit_run_out","separate_controlled_walk_back_route"],"optionalEquipment":["cones","grade_meter_or_inclinometer","timing_gates","video"],"environment":["dry_stable_non_slip_surface","uniform_grade_without_holes_or_cross_slope","no_cross_traffic","adequate_lighting_and_visibility"],"population":["pain_free_walking_jogging_and_submaximal_hill_acceleration","can_control_selected_start","can_finish_and_walk_down_safely","current_calf_Achilles_hamstring_and_back_tolerance"]},"proposedDosage":{"setsAndReps":"2-6_quality_efforts","distance":"5-20_metres_or_equivalent_declared_yards","restSeconds":"90-240_by_distance_grade_timing_and_response","intensity":"maximal_or_near_maximal_only_after_submaximal_rehearsal","progressWhen":"grade, split, rhythm, projection, symptoms, finish, and walk-back remain repeatable"},"proposedInstructions":{"coachCues":["Name the start and grade","Project with the hill","Push the hill away","Fast arms and complete contacts","Sprint through, run out, then walk down"],"athleteInstructions":["Use the assigned start, accelerate up the marked uniform hill through the finish, stay in sprint rhythm, control the summit, and walk back on the assigned route"],"commonFaults":["unmeasured_or_changing_grade","hill_too_steep_for_sprint_gait","waist_bend_instead_of_whole_body_projection","slow_grinding_contacts","looking_down_without_lane_awareness","stopping_at_finish","sprinting_downhill","insufficient_recovery"]},"proposedSafety":{"readiness":["completed_progressive_sprint_warm_up","pain_free_submaximal_uphill_effort","inspected_grade_lane_summit_and_descent","safe_footwear_and_spacing"],"stopRules":["pain_or_sharp_discomfort","calf_or_Achilles_warning","limp_or_protective_mechanics","slip_or_stumble","loss_of_sprint_gait_or_grinding","repeated_speed_or_rhythm_loss","unsafe_summit_or_descent","lane_conflict_or_surface_change"]},"programmingDecision":"Retain one distinct incline-resisted acceleration definition. Use exact two-point and controlled falling-start variants. Treat declared safe grade, distance, unit, cones, timing, intent, and recovery as delivery variables; keep steep grinding, long conditioning, stairs, treadmills, sleds, downhill, bounding, and shuttle formats outside this card until separately authored.","currentCardSnapshot":{"capturedAt":"2026-08-01T09:10:00.000Z","cardVersion":1,"status":"review","description":"Hill Sprint Acceleration is a acceleration & first-step output exercise for speed, sprinting, and quick-release athletes. It emphasizes hip extension, knee drive, ankle stiffness while keeping the session intent aligned with the Vortex phase sequence.","familyKey":"Acceleration Starts","movementPatterns":[],"bodyRegions":[],"requiredEquipment":[],"optionalEquipment":[],"environment":{},"population":{},"difficulty":{"absoluteLoadDemand":10,"coordinationDemand":40,"technicalComplexity":40,"baseOverallDifficulty":40},"loadProfile":{},"fatigueProfile":{}}},"evidence":[{"sectionKey":"identity","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/11217013/","sourceTitle":"Kinematic and postural characteristics of sprint running on sloping surfaces","sourcePublisher":"Journal of Sports Sciences","sourceKind":"peer_reviewed_research","evidenceQuality":87,"claims":["Uphill sprinting changes speed, step length, flight distance, and posture compared with level sprinting, so the inclined surface is identity-bearing rather than a cosmetic setting.","Hill Sprint Acceleration is a short continuous uphill acceleration on a declared uniform positive grade; level acceleration, downhill assisted sprinting, stairs, and repeated hill conditioning are not aliases."]},{"sectionKey":"taxonomy","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC11382779/","sourceTitle":"The Effect of Resisted Sprint Training on Acceleration: A Systematic Review and Meta-Analysis","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["Resisted sprinting is used to overload the force task of acceleration, although pooled evidence does not establish superiority over equal-volume unresisted training.","Classify Hill Sprint Acceleration as incline-resisted linear acceleration, not as a generic leg-strength drill or a guaranteed superior replacement for level sprinting."]},{"sectionKey":"anatomy","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC12592170/","sourceTitle":"A review of uphill and downhill running: biomechanics, physiology and modulating factors","sourcePublisher":"Frontiers in Physiology","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["Positive grade increases lower-limb joint work and power demands, with especially important hip contribution as incline increases.","Represent gluteal, hamstring, quadriceps, plantar-flexor, hip-flexor, foot, trunk, and reciprocal arm roles across start, uphill contacts, finish, and walk-back recovery."]},{"sectionKey":"biomechanics","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/11217013/","sourceTitle":"Kinematic and postural characteristics of sprint running on sloping surfaces","sourcePublisher":"Journal of Sports Sciences","sourceKind":"peer_reviewed_research","evidenceQuality":87,"claims":["A slope changes stride length and touchdown and take-off posture; steeper is not automatically more specific or better.","Use a natural whole-body projection relative to the slope, push through complete contacts, coordinate the arms, and preserve sprint rhythm without forcing one universal torso angle, knee height, or step length."]},{"sectionKey":"difficulty","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/39191977/","sourceTitle":"Energy cost of running uphill as compared to running on the level with impeding horizontal forces","sourcePublisher":"European Journal of Applied Physiology","sourceKind":"peer_reviewed_research","evidenceQuality":87,"claims":["Uphill running requires additional work against gravity and has a higher energy cost than level running at the same speed.","Score exercise complexity and physical difficulty separately; lack of an external implement does not make maximal uphill acceleration low-load or low-difficulty. Athlete experience remains selection context only."]},{"sectionKey":"load_fatigue_recovery","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC12592170/","sourceTitle":"A review of uphill and downhill running: biomechanics, physiology and modulating factors","sourcePublisher":"Frontiers in Physiology","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["Incline changes joint work, muscle demand, stride mechanics, and metabolic cost, with effects that depend on grade and speed.","Track grade, distance, effort count, uphill and walk-back contacts, intensity, calf/Achilles and posterior-chain response, technical fatigue, surface, footwear, recovery, and total sprint exposure."]},{"sectionKey":"constraints","sourceUrl":"https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf","sourceTitle":"Developing Linear Speed","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Quality sprint work requires an appropriate surface, clear lane, marked distance, safe finish, athlete spacing, and recovery.","Require a measured uniform uphill lane with reliable traction, no holes or cross-traffic, a visible target, a safe summit run-out, and a controlled non-sprint walk-back route."]},{"sectionKey":"dosage","sourceUrl":"https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf","sourceTitle":"Developing Linear Speed","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Acceleration work should prescribe distance, intensity, efforts, sets, and recovery rather than repetitions alone.","Use short high-quality efforts and enough recovery to preserve output; a longer effort, steep grind, incomplete-rest shuttle, or sprinted descent requires a different profile or definition."]},{"sectionKey":"instructions","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/11217013/","sourceTitle":"Kinematic and postural characteristics of sprint running on sloping surfaces","sourcePublisher":"Journal of Sports Sciences","sourceKind":"peer_reviewed_research","evidenceQuality":87,"claims":["Slope changes the athlete's posture and stride geometry compared with horizontal sprinting.","Name the exact start, look through the lane, project the whole body with the slope, push the hill away, coordinate fast arms, sprint through the target, run out safely, and walk back under control."]},{"sectionKey":"safety_stop_rules","sourceUrl":"https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf","sourceTitle":"Youth Resistance Training: Updated Position Statement Paper From the NSCA","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":88,"claims":["High-intent training should use qualified supervision, appropriate progression, correct technique, and manageable demands.","Stop for pain, calf or Achilles warning, limp, slip, stumble, loss of sprint gait, uncontrolled trunk collapse, unsafe finish or descent, repeated speed loss, lane conflict, or surface deterioration."]},{"sectionKey":"programming","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC11382779/","sourceTitle":"The Effect of Resisted Sprint Training on Acceleration: A Systematic Review and Meta-Analysis","sourcePublisher":"International Journal of Exercise Science","sourceKind":"peer_reviewed_research","evidenceQuality":91,"claims":["Resisted sprint training can improve acceleration, but pooled comparisons do not prove that it is better than equal-volume unresisted sprinting.","Place Hill Sprint Acceleration while fresh as a specific uphill resistance option; retain level sprint exposure when level acceleration is the target and do not promise automatic transfer."]},{"sectionKey":"athlete_support","sourceUrl":"https://worldathletics.org/download/downloadnsa?filename=a0cae133-1056-4b89-9f93-16d87fd3bbd4.pdf&urlslug=introduction-to-sprinting","sourceTitle":"Introduction to Sprinting","sourcePublisher":"World Athletics","sourceKind":"governing_body","evidenceQuality":78,"claims":["Acceleration develops through successive projected steps and should retain coordinated relaxation rather than forced shapes.","Show the measured grade, start, first contacts, side and rear views, finish and summit run-out, walk-back route, successful rhythm, slipping and grinding faults, and the level-sprint alternative."]},{"sectionKey":"coach_support","sourceUrl":"https://pmc.ncbi.nlm.nih.gov/articles/PMC12592170/","sourceTitle":"A review of uphill and downhill running: biomechanics, physiology and modulating factors","sourcePublisher":"Frontiers in Physiology","sourceKind":"peer_reviewed_research","evidenceQuality":88,"claims":["The biomechanical and physiological response to uphill running depends on grade, speed, and task duration.","Provide grade and distance measurement, lane inspection, start selection, observation position, timing method, contact and effort totals, side balance, fatigue and symptom checks, walk-back control, and exact substitution rules."]},{"sectionKey":"accessibility","sourceUrl":"https://www.nsca.com/about-us/position-statements/youth-training-and-long-term-athletic-development/","sourceTitle":"Youth Training and Long-Term Athletic Development","sourcePublisher":"National Strength and Conditioning Association","sourceKind":"professional_standard","evidenceQuality":82,"claims":["Speed training should be developmentally appropriate and based on current movement competency and readiness.","Scale with a shallower uniform grade, standing start, submaximal intent, shorter distance, fewer efforts, untimed trials, visual markers, extra demonstration, longer recovery, or level acceleration while keeping exercise-card proficiency labels absent."]},{"sectionKey":"alternates","sourceUrl":"https://pubmed.ncbi.nlm.nih.gov/11217013/","sourceTitle":"Kinematic and postural characteristics of sprint running on sloping surfaces","sourcePublisher":"Journal of Sports Sciences","sourceKind":"peer_reviewed_research","evidenceQuality":87,"claims":["Level, uphill, and downhill sprint conditions produce different acute kinematics and posture.","Two-point and falling starts are controlled variants; safe shallow grade and distance are dosage constraints; steep grinding, stairs, treadmill incline, sled towing, downhill overspeed, long conditioning repeats, and uphill bounding require separate assessment."]},{"sectionKey":"media","sourceUrl":"https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en","sourceTitle":"Embed videos and playlists","sourcePublisher":"YouTube Help","sourceKind":"manufacturer_instruction","evidenceQuality":82,"claims":["YouTube supports privacy-enhanced embed URLs.","The three visible links for Hill Sprint Acceleration are discovery candidates only. Current availability, embedding, exact grade and distance, complete setup and finish, safety, captions, cue quality, reviewer identity, and approval remain independent human gates."]}],"mediaCandidates":[{"url":"https://www.youtube.com/watch?v=otxUWltMTRE","title":"Hill Sprints [SPEED TRAINING]","channelName":"Simone Sports Performance","sourceQuery":"hill sprint acceleration technique discovery","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Discovery result describes multiple sprint-start variations on a hill. Exact grade, distance, full setup and finish, safety, captions, availability, embedding, and coaching quality require complete human review."},{"url":"https://www.youtube.com/watch?v=ZuKBLCR7TEw","title":"Hill Sprints for Absolute Speed and Sprint Velocity","channelName":"Jevon S.","sourceQuery":"hill sprint acceleration technique discovery","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Discovery result discusses uphill and downhill sprint uses. Exact low-grade acceleration variant, claims, full content, safety, captions, availability, embedding, and coaching quality require complete human review."},{"url":"https://www.youtube.com/watch?v=SCI98hvhLqE","title":"How To Do Hill Sprints - Run Faster & Burn Fat With Hill Sprints","channelName":"Athlete.X","sourceQuery":"how to do hill sprints acceleration discovery","linkStatus":"unverified","embeddingAllowed":false,"externalVerification":null,"notes":"Discovery result spans acceleration and conditioning uses. Exact short-output dose, grade, movement contract, full content, safety, captions, availability, embedding, and coaching quality require complete human review."}],"alternateAssessments":[{"name":"Low-Incline Hill Sprint Acceleration","classification":"same_identity","rationale":"Low incline describes the accepted grade range of the same short uphill acceleration identity.","distinguishingDimensions":{"grade":"declared_safe_shallow_positive_grade"}},{"name":"Falling-Start Hill Sprint","classification":"new_variant","rationale":"The controlled loss-of-balance trigger changes initiation while retaining short continuous uphill acceleration.","distinguishingDimensions":{"startGeometry":"controlled_falling_start"}},{"name":"Steep Hill Power Sprint","classification":"new_variant","rationale":"A steeper grade changes contact time, stride, force demand, and possibly gait; it requires a measured grade and explicit sprint-versus-grind boundary before activation.","distinguishingDimensions":{"grade":"steep_declared","identityStatus":"requires_human_authorship"}},{"name":"Long Hill Sprint Conditioning","classification":"new_definition","rationale":"Long duration and incomplete recovery target glycolytic or aerobic power and create a different fatigue, recovery, and stop-rule contract.","distinguishingDimensions":{"adaptation":"conditioning","duration":"long","recovery":"incomplete"}},{"name":"Incline Treadmill Sprint","classification":"new_definition","rationale":"A moving belt, fixed machine grade, speed controls, emergency stop, mounting and dismounting create different equipment and failure conditions.","distinguishingDimensions":{"equipment":"motorized_treadmill","surface":"moving_belt"}},{"name":"Uphill Bound","classification":"new_definition","rationale":"Bounding uses deliberately exaggerated alternating flight and projection contacts rather than continuous sprint steps.","distinguishingDimensions":{"movementPattern":"alternating_bound","contactIntent":"exaggerated_projection"}},{"name":"Downhill Overspeed Sprint","classification":"new_definition","rationale":"Negative grade assists rather than resists speed and changes posture, velocity, braking, and fall risk.","distinguishingDimensions":{"grade":"negative","resistanceDirection":"assisted"}}]}$packet$::JSONB);
  -- END GENERATED CANONICAL RESEARCH PACKETS

  WITH packet_evidence AS(
    SELECT evidence.item->>'sectionKey' section_key,
      evidence.item->>'sourceUrl' source_url,
      evidence.item->>'sourceTitle' source_title,
      evidence.item->>'sourcePublisher' source_publisher,
      evidence.item->>'sourceKind' source_kind,
      (evidence.item->>'evidenceQuality')::SMALLINT evidence_quality,
      to_jsonb(ARRAY(SELECT jsonb_array_elements_text(
        evidence.item->'claims'))) claims_json
    FROM family_packet_seed packet
    CROSS JOIN LATERAL jsonb_array_elements(packet.packet_json->'evidence') evidence(item)
    WHERE packet.packet_slug=active_slug
  )
  INSERT INTO coaching.exercise_section_evidence_v1(
    definition_id,reviewed_card_version,section_key,source_url,source_title,
    source_publisher,source_kind,claims_json,evidence_quality,review_status,
    reviewer_user_id,reviewed_at)
  SELECT definition.id,definition.card_version,evidence.section_key,
    evidence.source_url,evidence.source_title,evidence.source_publisher,
    evidence.source_kind,evidence.claims_json,evidence.evidence_quality,
    'candidate',NULL,NULL
  FROM packet_evidence evidence
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id=1 AND definition.slug=active_slug
      AND definition.status<>'archived'
  ON CONFLICT(definition_id,reviewed_card_version,section_key,source_url)
  DO UPDATE SET source_title=EXCLUDED.source_title,
    source_publisher=EXCLUDED.source_publisher,source_kind=EXCLUDED.source_kind,
    claims_json=EXCLUDED.claims_json,evidence_quality=EXCLUDED.evidence_quality,
    review_status='candidate',reviewer_user_id=NULL,reviewed_at=NULL,
    updated_at=now();

  INSERT INTO coaching.exercise_media_candidate_v1(
    definition_id,variant_id,reviewed_card_version,url,embed_url,video_id,title,
    channel_name,duration_seconds,language_code,captions_available,
    embedding_allowed,exact_variant_match,demonstration_quality_score,
    link_status,review_status,discovery_method,source_query,reviewer_user_id,
    reviewed_at,next_review_at,notes)
  SELECT definition.id,NULL,definition.card_version,media.item->>'url',
    'https://www.youtube-nocookie.com/embed/'
      ||substring(media.item->>'url' FROM 'v=([^&]+)'),
    substring(media.item->>'url' FROM 'v=([^&]+)'),media.item->>'title',
    media.item->>'channelName',NULL,'en',NULL,FALSE,NULL,NULL,
    'unverified','candidate','manual_research',media.item->>'sourceQuery',
    NULL,NULL,NULL,media.item->>'notes'
  FROM family_packet_seed packet
  CROSS JOIN LATERAL jsonb_array_elements(packet.packet_json->'mediaCandidates') media(item)
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id=1 AND definition.slug=active_slug
      AND definition.status<>'archived'
  WHERE packet.packet_slug=active_slug
  ON CONFLICT(definition_id,reviewed_card_version,video_id)
  DO UPDATE SET variant_id=NULL,url=EXCLUDED.url,embed_url=EXCLUDED.embed_url,
    title=EXCLUDED.title,channel_name=EXCLUDED.channel_name,
    duration_seconds=NULL,language_code='en',captions_available=NULL,
    embedding_allowed=FALSE,exact_variant_match=NULL,
    demonstration_quality_score=NULL,link_status='unverified',
    review_status='candidate',discovery_method='manual_research',
    source_query=EXCLUDED.source_query,reviewer_user_id=NULL,reviewed_at=NULL,
    next_review_at=NULL,notes=EXCLUDED.notes,updated_at=now();

  INSERT INTO coaching.exercise_alternate_assessment_v1(
    definition_id,reviewed_card_version,alternate_name,classification,rationale,
    distinguishing_dimensions,proposed_card_json,review_status,reviewer_user_id,
    reviewed_at)
  SELECT definition.id,definition.card_version,alternate.item->>'name',
    alternate.item->>'classification',alternate.item->>'rationale',
    coalesce(alternate.item->'distinguishingDimensions','{}'::JSONB),
    NULL,'candidate',NULL,NULL
  FROM family_packet_seed packet
  CROSS JOIN LATERAL jsonb_array_elements(
    packet.packet_json->'alternateAssessments') alternate(item)
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id=1 AND definition.slug=active_slug
      AND definition.status<>'archived'
  WHERE packet.packet_slug=active_slug
  ON CONFLICT(definition_id,reviewed_card_version,alternate_name)
  DO UPDATE SET classification=EXCLUDED.classification,
    rationale=EXCLUDED.rationale,
    distinguishing_dimensions=EXCLUDED.distinguishing_dimensions,
    proposed_card_json=NULL,review_status='candidate',reviewer_user_id=NULL,
    reviewed_at=NULL,updated_at=now();

  CREATE TEMP TABLE hill_relationship_seed(
    from_key TEXT NOT NULL,to_key TEXT NOT NULL,relationship TEXT NOT NULL,
    similarity SMALLINT NOT NULL,dimensions TEXT[] NOT NULL,
    reason TEXT NOT NULL,conditions JSONB NOT NULL,
    PRIMARY KEY(from_key,to_key,relationship)
  ) ON COMMIT DROP;
  INSERT INTO hill_relationship_seed VALUES
    ('two-point-shallow-grade','falling-shallow-grade','progression',84,
      ARRAY['start_geometry','balance_trigger','first_recovery_step','coordination','failure_consequence'],
      'The controlled falling start adds a balance-triggered initiation and recovery-step timing while preserving the same measured shallow-grade acceleration, finish, and walk-back.',
      '{"requires":["repeatable_two_point_hill_start","controlled_whole_body_fall","safe_first_recovery_step"],"humanReviewRequired":true}'::JSONB),
    ('falling-shallow-grade','two-point-shallow-grade','regression',84,
      ARRAY['start_geometry','balance_trigger','first_recovery_step','coordination','failure_consequence'],
      'The fixed two-point start removes the falling trigger while preserving the same measured shallow-grade acceleration, finish, and walk-back.',
      '{"useWhen":["falling_trigger_disrupts_start_quality","simpler_repeatable_start_needed"],"humanReviewRequired":true}'::JSONB),
    ('two-point-shallow-grade','falling-shallow-grade','lateral_substitution',76,
      ARRAY['start_geometry','lead_side','balance_trigger'],
      'The falling start is an adjacent start substitution only when the objective tolerates a balance-triggered initiation and all grade, distance, output, finish, and recovery constraints remain unchanged.',
      '{"condition":"objective_accepts_falling_trigger_and_start_is_controlled","humanReviewRequired":true}'::JSONB),
    ('falling-shallow-grade','two-point-shallow-grade','lateral_substitution',88,
      ARRAY['start_geometry','lead_side','balance_trigger'],
      'The two-point start is an adjacent start substitution that preserves incline-resisted acceleration while removing the balance trigger.',
      '{"condition":"fixed_staggered_start_is_safe_and_objective_compatible","humanReviewRequired":true}'::JSONB);

  INSERT INTO coaching.exercise_relationship_v1(
    from_variant_id,to_variant_id,relationship,similarity_score,dimensions,
    reason,conditions_json,review_status,created_by,reviewed_by,reviewed_at)
  SELECT from_variant.id,to_variant.id,seed.relationship,seed.similarity,
    seed.dimensions,seed.reason,seed.conditions,'review',NULL,NULL,NULL
  FROM hill_relationship_seed seed
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id=1 AND definition.slug=active_slug
      AND definition.status<>'archived'
  JOIN coaching.exercise_variant_v1 from_variant
    ON from_variant.definition_id=definition.id
      AND from_variant.variant_key=seed.from_key AND from_variant.status<>'archived'
  JOIN coaching.exercise_variant_v1 to_variant
    ON to_variant.definition_id=definition.id
      AND to_variant.variant_key=seed.to_key AND to_variant.status<>'archived'
  ON CONFLICT(from_variant_id,to_variant_id,relationship)
  DO UPDATE SET similarity_score=EXCLUDED.similarity_score,
    dimensions=EXCLUDED.dimensions,reason=EXCLUDED.reason,
    conditions_json=EXCLUDED.conditions_json,review_status='review',
    created_by=NULL,reviewed_by=NULL,reviewed_at=NULL,updated_at=now()
  WHERE coaching.exercise_relationship_v1.review_status='review';

  INSERT INTO coaching.exercise_score_calibration_v1(
    facility_id,variant_id,dimension,proposed_score,anchor_tier,rationale,status,
    version,created_by,reviewed_by,review_notes,reviewed_at)
  SELECT 1,variant.id,dimension.dimension,
    CASE dimension.dimension WHEN 'technicalComplexity' THEN seed.complexity
      ELSE seed.physical END,
    CASE WHEN(CASE dimension.dimension WHEN 'technicalComplexity'
      THEN seed.complexity ELSE seed.physical END)<=30 THEN 20
      WHEN(CASE dimension.dimension WHEN 'technicalComplexity'
      THEN seed.complexity ELSE seed.physical END)<=50 THEN 40
      WHEN(CASE dimension.dimension WHEN 'technicalComplexity'
      THEN seed.complexity ELSE seed.physical END)<=70 THEN 60 ELSE 80 END,
    CASE dimension.dimension WHEN 'technicalComplexity' THEN
      'Candidate exercise-complexity anchor reflects exact start geometry, lead side, balance trigger when present, grade perception, projection, first contacts, target crossing, summit, walk-back, supervision, and failure consequence; independent comparison is pending.'
      ELSE
      'Candidate physical-difficulty anchor reflects maximal bodyweight acceleration against gravity, measured grade, speed intent, uphill and run-out contacts, impact, calf/Achilles and posterior-chain load, repeated efforts, and recovery; no external implement does not mean low physical demand.' END,
    'review',1,NULL,NULL,
    'Candidate migration-422 anchor; independent human review required.',NULL
  FROM hill_variant_seed seed
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id=1 AND definition.slug=active_slug
      AND definition.status<>'archived'
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id=definition.id
      AND variant.variant_key=seed.variant_key AND variant.status<>'archived'
  CROSS JOIN(VALUES('technicalComplexity'),('absoluteLoadDemand')) dimension(dimension)
  ON CONFLICT(facility_id,variant_id,dimension,version)
  DO UPDATE SET proposed_score=EXCLUDED.proposed_score,
    anchor_tier=EXCLUDED.anchor_tier,rationale=EXCLUDED.rationale,
    status='review',created_by=NULL,reviewed_by=NULL,
    review_notes=EXCLUDED.review_notes,reviewed_at=NULL,updated_at=now()
  WHERE coaching.exercise_score_calibration_v1.status='review';

  CREATE TEMP TABLE hill_source_score_seed(
    exercise_id BIGINT PRIMARY KEY,variant_key TEXT NOT NULL,notes TEXT NOT NULL
  ) ON COMMIT DROP;
  INSERT INTO hill_source_score_seed VALUES
    (126,'falling-shallow-grade',
      'Low-incline source permits an exact two-point or controlled falling start; the controlled falling variant is the more conservative source-specific score mapping.'),
    (332,'two-point-shallow-grade',
      'Hill Sprint Acceleration source explicitly uses a two-point start on a mild hill.');

  INSERT INTO coaching.exercise_score_v1(
    exercise_id,legacy_scores,migration_confidence,human_review_status,review_notes)
  SELECT seed.exercise_id,jsonb_build_object(
      'migration',migration_key,'researchBatch',research_batch,
      'sourceScoreCreatedForCanonicalBackfill',TRUE,'candidateOnly',TRUE,
      'humanReviewRequired',TRUE),70,'queued',
    seed.notes||' Calibration review required.'
  FROM hill_source_score_seed seed
  ON CONFLICT(exercise_id) DO NOTHING;

  UPDATE coaching.exercise_score_v1 score
  SET technical_complexity=(variant.difficulty_json
      ->>'technicalComplexity')::SMALLINT,
    absolute_load_demand=(variant.difficulty_json
      ->>'absoluteLoadDemand')::SMALLINT,
    coordination_demand=(variant.difficulty_json
      ->>'coordinationDemand')::SMALLINT,
    impact=(variant.difficulty_json->>'impact')::SMALLINT,
    supervision_demand=(variant.difficulty_json
      ->>'supervisionDemand')::SMALLINT,
    base_overall_difficulty=greatest(
      (variant.difficulty_json->>'technicalComplexity')::SMALLINT,
      (variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT),
    legacy_scores=coalesce(score.legacy_scores,'{}'::JSONB)
      ||jsonb_build_object(
        'migration',migration_key,'researchBatch',research_batch,
        'difficultyModel','max_exercise_complexity_physical_difficulty',
        'candidateOnly',TRUE,'humanReviewRequired',TRUE,
        'approvalsCreated',FALSE),
    migration_confidence=70,human_review_status='queued',
    reviewed_by=NULL,reviewed_at=NULL,
    review_notes=seed.notes||' Calibration review required.',updated_at=now()
  FROM hill_source_score_seed seed
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id=1 AND definition.slug=active_slug
      AND definition.status<>'archived'
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id=definition.id
      AND variant.variant_key=seed.variant_key AND variant.status<>'archived'
  WHERE score.exercise_id=seed.exercise_id
    AND score.human_review_status='queued'
    AND score.reviewed_by IS NULL AND score.reviewed_at IS NULL;

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  SELECT definition.id,definition.facility_id,definition.card_version,
    definition.schema_version,migration_key,'quarantined',
    jsonb_build_object(
      'stableIdentityAndAliases',TRUE,
      'bothLegacySourcesAuditedAndTraceable',TRUE,
      'twoExactSelectableStartVariantsPresent',TRUE,
      'gradeDistanceUnitMarkersTimingIntentAndRecoveryAreDeliveryDimensions',TRUE,
      'excludedAdjacentIdentitiesDocumented',TRUE,
      'controlledTaxonomyPresent',TRUE,
      'anatomyJointsActionsPlanesLateralityPresent',TRUE,
      'complexityAndPhysicalDifficultyPresent',TRUE,
      'overallDifficultyDerivedAsMaximum',TRUE,
      'exerciseSkillClassificationAbsent',TRUE,
      'numericLoadFatigueImpactAndRecoveryPresent',TRUE,
      'equipmentEnvironmentPopulationConstraintsPresent',TRUE,
      'deliveryDosageTimeLogisticsMeasurementAndScalingPresent',TRUE,
      'coachAthleteAndOperationsSupportPresent',TRUE,
      'qualityGatesAndStopRulesPresent',TRUE,
      'sixteenCandidateEvidenceSectionsPresent',TRUE,
      'threeQuarantinedMediaCandidatesPresent',TRUE,
      'sevenAlternateAssessmentsPresent',TRUE,
      'progressionRegressionAndSubstitutionProposalsPresent',TRUE,
      'complexityAndPhysicalCalibrationProposalsPresent',TRUE,
      'sourceScoresQueuedNotApproved',TRUE,'approvalsCreated',FALSE,
      'externalMediaVerificationPerformed',FALSE),
    jsonb_build_array(
      jsonb_build_object('code','CARD-GRADE-01','message','No universal grade is approved; every selectable delivery must measure and declare a uniform positive grade that preserves sprint gait.'),
      jsonb_build_object('code','CARD-EVIDENCE-02','message','Candidate evidence and authored section claims require independent review.'),
      jsonb_build_object('code','CARD-MEDIA-01','message','Three media candidates require playback, continuing availability, embedding, exact-match, complete-content, safety, caption, accessibility, and reviewer approval.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','Progression, regression, and substitution relationships remain review-only.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','Complexity and physical-difficulty anchors remain review-only.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','Two-person card review, version approval, media approval, pilot evidence, and production rollout are incomplete.')),
    TRUE,now()
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.facility_id=1 AND definition.slug=active_slug
    AND definition.status<>'archived'
  ON CONFLICT(definition_id)
  DO UPDATE SET facility_id=EXCLUDED.facility_id,
    card_version=EXCLUDED.card_version,schema_version=EXCLUDED.schema_version,
    audit_version=EXCLUDED.audit_version,status='quarantined',
    checks_json=EXCLUDED.checks_json,
    blocking_issues_json=EXCLUDED.blocking_issues_json,
    human_review_required=TRUE,checked_at=now();

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_section_evidence_v1 evidence
  JOIN coaching.exercise_definition_v1 definition
    ON definition.id=evidence.definition_id
  WHERE definition.slug=active_slug
    AND evidence.reviewed_card_version=definition.card_version
    AND evidence.review_status='candidate';
  IF actual_count<>16 OR(SELECT count(DISTINCT evidence.section_key)
      FROM coaching.exercise_section_evidence_v1 evidence
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=evidence.definition_id
      WHERE definition.slug=active_slug
        AND evidence.reviewed_card_version=definition.card_version
        AND evidence.review_status='candidate')<>16 THEN
    RAISE EXCEPTION '% requires exactly 16 candidate evidence sections; found %',
      migration_key,actual_count;
  END IF;

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_media_candidate_v1 media
  JOIN coaching.exercise_definition_v1 definition
    ON definition.id=media.definition_id
  WHERE definition.slug=active_slug
    AND media.reviewed_card_version=definition.card_version
    AND media.review_status='candidate' AND media.link_status='unverified'
    AND media.embedding_allowed=FALSE AND media.exact_variant_match IS NULL
    AND media.demonstration_quality_score IS NULL
    AND media.reviewer_user_id IS NULL AND media.reviewed_at IS NULL;
  IF actual_count<>3 THEN
    RAISE EXCEPTION '% requires exactly three quarantined media candidates; found %',
      migration_key,actual_count;
  END IF;

  SELECT count(*) INTO actual_count
  FROM coaching.exercise_alternate_assessment_v1 alternate
  JOIN coaching.exercise_definition_v1 definition
    ON definition.id=alternate.definition_id
  WHERE definition.slug=active_slug
    AND alternate.reviewed_card_version=definition.card_version
    AND alternate.review_status='candidate';
  IF actual_count<>7 THEN
    RAISE EXCEPTION '% requires exactly seven candidate alternate assessments; found %',
      migration_key,actual_count;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_delivery_profile_v1 profile
      JOIN coaching.exercise_variant_v1 variant ON variant.id=profile.variant_id
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=variant.definition_id
      WHERE definition.slug=active_slug AND definition.status<>'archived'
        AND variant.status<>'archived' AND profile.status<>'archived')<>2 THEN
    RAISE EXCEPTION '% expected one active delivery profile per exact variant',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_relationship_v1 relationship
      JOIN coaching.exercise_variant_v1 from_variant
        ON from_variant.id=relationship.from_variant_id
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=from_variant.definition_id
      WHERE definition.slug=active_slug
        AND relationship.review_status='review'
        AND relationship.reviewed_by IS NULL
        AND relationship.reviewed_at IS NULL)<>4 THEN
    RAISE EXCEPTION '% expected four review-only graph proposals',migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_score_calibration_v1 calibration
      JOIN coaching.exercise_variant_v1 variant ON variant.id=calibration.variant_id
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=variant.definition_id
      WHERE definition.slug=active_slug AND variant.status<>'archived'
        AND calibration.status='review'
        AND calibration.dimension IN(
          'technicalComplexity','absoluteLoadDemand')
        AND calibration.reviewed_by IS NULL
        AND calibration.reviewed_at IS NULL)<>4 THEN
    RAISE EXCEPTION '% expected four review-only calibration proposals',
      migration_key;
  END IF;

  IF EXISTS(
    SELECT 1 FROM coaching.exercise_variant_v1 variant
    JOIN coaching.exercise_definition_v1 definition
      ON definition.id=variant.definition_id
    WHERE definition.slug=active_slug AND variant.status<>'archived' AND(
      (variant.difficulty_json->>'baseOverallDifficulty')::SMALLINT
        <>greatest(
          (variant.difficulty_json->>'technicalComplexity')::SMALLINT,
          (variant.difficulty_json->>'absoluteLoadDemand')::SMALLINT)
      OR(variant.programming_profile_json->'cumulativeBudget'
        ->>'countInWorkout')::BOOLEAN IS DISTINCT FROM TRUE)) THEN
    RAISE EXCEPTION '% found invalid difficulty derivation or budget contract',
      migration_key;
  END IF;

  IF(SELECT count(*) FROM coaching.exercise_score_v1 score
      WHERE score.exercise_id=ANY(audited_source_ids)
        AND score.human_review_status='queued'
        AND score.reviewed_by IS NULL AND score.reviewed_at IS NULL
        AND score.base_overall_difficulty=greatest(
          score.technical_complexity,score.absolute_load_demand))
      <>cardinality(audited_source_ids) THEN
    RAISE EXCEPTION '% expected two queued source-score packets',migration_key;
  END IF;

  IF EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    LEFT JOIN coaching.exercise_variant_v1 variant
      ON variant.definition_id=definition.id
    LEFT JOIN coaching.exercise_delivery_profile_v1 profile
      ON profile.variant_id=variant.id
    WHERE definition.slug=active_slug AND(
      definition.status='published' OR definition.reviewed_by IS NOT NULL
      OR definition.approved_by IS NOT NULL
      OR definition.last_reviewed_at IS NOT NULL
      OR definition.approved_video_url IS NOT NULL
      OR variant.status='published' OR profile.status='published'))
    OR EXISTS(SELECT 1 FROM coaching.exercise_media_candidate_v1 media
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=media.definition_id
      WHERE definition.slug=active_slug
        AND media.review_status IN('shortlisted','approved','rejected'))
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1 relationship
      JOIN coaching.exercise_variant_v1 variant
        ON variant.id=relationship.from_variant_id
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=variant.definition_id
      WHERE definition.slug=active_slug AND relationship.review_status<>'review')
    OR EXISTS(SELECT 1 FROM coaching.exercise_score_calibration_v1 calibration
      JOIN coaching.exercise_variant_v1 variant ON variant.id=calibration.variant_id
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=variant.definition_id
      WHERE definition.slug=active_slug AND calibration.status<>'review') THEN
    RAISE EXCEPTION '% created forbidden approval or publication state',migration_key;
  END IF;

  IF EXISTS(
    SELECT 1 FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
    JOIN coaching.exercise_delivery_profile_v1 profile
      ON profile.variant_id=variant.id
    WHERE definition.slug=active_slug AND variant.status<>'archived'
      AND profile.status<>'archived' AND(
        coaching.exercise_json_has_non_neutral_level_classification(
          definition.provenance_json)
        OR coaching.exercise_json_has_non_neutral_level_classification(
          definition.population_json)
        OR coaching.exercise_json_has_non_neutral_level_classification(
          variant.difficulty_json)
        OR coaching.exercise_json_has_non_neutral_level_classification(
          variant.requirements_json)
        OR coaching.exercise_json_has_non_neutral_level_classification(
          variant.programming_profile_json)
        OR coaching.exercise_json_has_non_neutral_level_classification(
          profile.dosage_json)
        OR coaching.exercise_json_has_non_neutral_level_classification(
          profile.logistics_json)
        OR coaching.exercise_json_has_non_neutral_level_classification(
          profile.support_prompts_json))) THEN
    RAISE EXCEPTION '% found forbidden exercise skill/proficiency classification',
      migration_key;
  END IF;

  IF(SELECT card_version FROM coaching.exercise_definition_v1
      WHERE facility_id=1 AND slug=active_slug AND status<>'archived')<>2
    OR(SELECT count(*) FROM coaching.exercise_card_test_packet_v1 packet
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id=packet.definition_id
      WHERE definition.slug=active_slug AND packet.card_version=2
        AND packet.audit_version=migration_key AND packet.status='quarantined'
        AND packet.human_review_required=TRUE)<>1 THEN
    RAISE EXCEPTION '% expected one current quarantined version-2 test packet',
      migration_key;
  END IF;
END
$$;
