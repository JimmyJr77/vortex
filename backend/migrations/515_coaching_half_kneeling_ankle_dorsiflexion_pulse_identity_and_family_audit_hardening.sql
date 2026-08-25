-- Source 41: replace the skeletal half-kneeling ankle card with one exact,
-- rear-knee-supported, unloaded end-range pulse. Standing, full-return,
-- isometric, banded, loaded, elevated, activation, calf, and clinical tasks
-- remain distinct. Evidence, media, graph, calibration, content, and
-- publication authority remain human-only. Difficulty describes the task.
DO $migration$
DECLARE
  migration_key CONSTANT TEXT := '515_coaching_half_kneeling_ankle_dorsiflexion_pulse_identity_and_family_audit_hardening';
  research_version CONSTANT TEXT := '2026-08-09.108';
  canonical_definition UUID; source_variant UUID; exact_variant UUID;
  active_variant_ids UUID[]; all_owned_variant_ids UUID[];
  standing_definition UUID; standing_variant UUID; iso_definition UUID; iso_variant UUID;
  ankle_car_definition UUID; ankle_car_variant UUID; calf_pulse_definition UUID; calf_pulse_variant UUID;
  calf_raise_definition UUID; calf_raise_variant UUID;
  protected_count INTEGER;
BEGIN
  SELECT id INTO canonical_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=41;
  SELECT id INTO source_variant FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='baseline';
  SELECT coalesce((SELECT id FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='rear-knee-supported-end-range-pulse'),gen_random_uuid()) INTO exact_variant;
  SELECT id INTO standing_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=40;
  SELECT id INTO standing_variant FROM coaching.exercise_variant_v1 WHERE definition_id=standing_definition AND variant_key='standing-knee-to-wall-forward-return-cycle';
  SELECT id INTO iso_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=844;
  SELECT id INTO iso_variant FROM coaching.exercise_variant_v1 WHERE definition_id=iso_definition AND variant_key='baseline';
  SELECT id INTO ankle_car_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=42;
  SELECT id INTO ankle_car_variant FROM coaching.exercise_variant_v1 WHERE definition_id=ankle_car_definition AND variant_key='baseline';
  SELECT id INTO calf_pulse_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=1364;
  SELECT id INTO calf_pulse_variant FROM coaching.exercise_variant_v1 WHERE definition_id=calf_pulse_definition AND variant_key='baseline';
  SELECT id INTO calf_raise_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=44;
  SELECT id INTO calf_raise_variant FROM coaching.exercise_variant_v1 WHERE definition_id=calf_raise_definition AND variant_key='baseline';
  active_variant_ids:=ARRAY[exact_variant]; all_owned_variant_ids:=ARRAY[source_variant,exact_variant];

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=41 AND facility_id=1)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition AND facility_id=1 AND legacy_exercise_id=41)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=41 AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source_variant AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=standing_variant AND definition_id=standing_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=iso_variant AND definition_id=iso_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=ankle_car_variant AND definition_id=ankle_car_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=calf_pulse_variant AND definition_id=calf_pulse_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=calf_raise_variant AND definition_id=calf_raise_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1 WHERE exercise_id=41)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_difficulty_profile WHERE exercise_id=41)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_safety_profile WHERE exercise_id=41) THEN
    RAISE EXCEPTION '% prerequisite source or neighbor rows are missing',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=exact_variant AND definition_id<>canonical_definition)
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE slug='half-kneeling-ankle-dorsiflexion-pulse' AND id<>canonical_definition) THEN
    RAISE EXCEPTION '% working UUID or slug already belongs to another card',migration_key;
  END IF;

  SELECT coalesce(sum(n),0) INTO protected_count FROM (
    SELECT count(*) n FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition
        AND (status IN('published','deprecated') OR reviewed_by IS NOT NULL
          OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)
    UNION ALL SELECT count(*) FROM coaching.exercise_section_evidence_v1
      WHERE definition_id=canonical_definition
        AND (reviewer_user_id IS NOT NULL OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=canonical_definition
        AND (reviewer_user_id IS NOT NULL OR reviewed_at IS NOT NULL
          OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id=canonical_definition
        AND (reviewer_user_id IS NOT NULL OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_card_review_v1
      WHERE definition_id=canonical_definition
    UNION ALL SELECT count(*) FROM coaching.exercise_card_revision_v1
      WHERE definition_id=canonical_definition
    UNION ALL SELECT count(*) FROM coaching.exercise_media_review_v1
      WHERE definition_id=canonical_definition
    UNION ALL SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=ANY(all_owned_variant_ids) OR to_variant_id=ANY(all_owned_variant_ids))
        AND (reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL OR review_status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(all_owned_variant_ids)
        AND (reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL OR status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE (survivor_definition_id=canonical_definition OR resolved_definition_id=canonical_definition)
        AND (reviewed_by IS NOT NULL OR resolution_source='human_review')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_v1
      WHERE exercise_id=41
        AND (human_review_status<>'queued' OR reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL)
  ) protected;
  IF protected_count<>0 THEN
    RAISE EXCEPTION '% refuses to overwrite % human-reviewed records',migration_key,protected_count;
  END IF;

  UPDATE coaching.exercise_section_evidence_v1 SET
    review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now()
  WHERE definition_id=canonical_definition AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_media_candidate_v1 SET
    review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
    exact_variant_match=NULL,demonstration_quality_score=NULL,updated_at=now()
  WHERE definition_id=canonical_definition AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_alternate_assessment_v1 SET
    review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now()
  WHERE definition_id=canonical_definition AND review_status='candidate' AND reviewer_user_id IS NULL;
  DELETE FROM coaching.exercise_relationship_v1
  WHERE (from_variant_id=ANY(all_owned_variant_ids) OR to_variant_id=ANY(all_owned_variant_ids))
    AND reviewed_by IS NULL AND review_status<>'approved';
  DELETE FROM coaching.exercise_score_calibration_v1
  WHERE variant_id=ANY(all_owned_variant_ids) AND reviewed_by IS NULL AND status<>'approved';

  UPDATE coaching.exercise_definition_source_v1 SET
    source_kind='legacy_migration',
    provenance_json=jsonb_build_object(
      'source_table','coaching.exercise','migration',migration_key,
      'researchVersion',research_version,'sourceDisposition','canonical_half_kneeling_pulse_reauthored',
      'exactWorkingSpecification','rear_knee_and_lower_leg_padded_front_target_foot_tripod_fixed_initial_endpoint_setup_then_partial_retreat_and_readvance_pulse',
      'exerciseDifficultyDescribesTaskOnly',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=41 AND definition_id=canonical_definition;

  UPDATE coaching.exercise_delivery_profile_v1 SET status='archived',updated_at=now()
  WHERE variant_id=source_variant;
  UPDATE coaching.exercise_variant_v1 SET
    variant_key='superseded-source-41-skeleton',
    display_name='Half-Kneeling Ankle Dorsiflexion Pulse Legacy Skeleton — Source 41',
    modifier_keys='{}'::TEXT[],difficulty_json='{}'::JSONB,status='archived',
    requirements_json=jsonb_build_object(
      'selectable',FALSE,'representation','superseded_source_skeleton',
      'sourceLegacyExerciseId',41,
      'archiveReason','exact rear knee support front foot contacts pulse endpoints count anatomy loading budgets duration constraints substitutions persistence support and review contracts were missing',
      'replacementVariantIds',to_jsonb(active_variant_ids),'humanReviewRequired',TRUE),
    load_profile_json=jsonb_build_object('selectable',FALSE),
    fatigue_profile_json=jsonb_build_object('selectable',FALSE),
    programming_profile_json=jsonb_build_object(
      'selectionStatus','superseded_source_skeleton','selectable',FALSE,
      'publicationQuarantined',TRUE),updated_at=now()
  WHERE id=source_variant;

  INSERT INTO coaching.exercise_definition_v1(
    id,facility_id,legacy_exercise_id,slug,canonical_name,display_name,aliases,
    description,family_key,schema_version,card_version,status,
    content_confidence,scoring_confidence,media_confidence,movement_patterns,
    body_regions,required_equipment,optional_equipment,environment_json,
    population_json,provenance_json,approved_video_url,reviewed_by,approved_by,
    last_reviewed_at,anatomy_json,athlete_support_json,coach_support_json,
    support_operations_json)
  VALUES(
    canonical_definition,1,41,'half-kneeling-ankle-dorsiflexion-pulse',
    'Half-Kneeling Ankle Dorsiflexion Pulse','Half-Kneeling Ankle Dorsiflexion Pulse',
    ARRAY['Half-Kneeling End-Range Ankle Pulse','Half-Kneel Ankle Dorsiflexion Pulse','Kneeling Ankle Dorsiflexion Pulse'],
    'Place the rear knee and lower leg on a pad and plant the target-side front foot through the heel, first metatarsal head, and fifth metatarsal head. Advance the front knee over the middle toes to a comfortable endpoint without lifting or spinning the foot; this first advance is setup, not a repetition. Retreat only a small declared distance without returning to the upright half-kneeling start, then re-advance to the same endpoint. Count one partial retreat-and-re-advance as one pulse. Foot placement, comfortable endpoint, retreat distance, pad thickness, light fingertips on the front thigh without unloading the foot, visual target, tempo, breathing, dose, rest, and workout context are annotations. Full return, standing, loaded hand support, a hold, band, weight, elevation, active dorsiflexor lift, clinician force, calf raise, clinical measurement, or added sport action changes the task.',
    'half_kneeling_ankle_dorsiflexion_end_range_pulse','2.0.0',2,'review',86,58,50,
    ARRAY['squat','brace']::TEXT[],
    ARRAY['foot','ankle','calf','knee','hip','core']::TEXT[],
    ARRAY['mat']::TEXT[],ARRAY['none']::TEXT[],
    jsonb_build_object(
      'surface','clean flat dry stable nonslip floor with an intact clean mat under the rear knee and lower leg',
      'space','one half-kneeling station with front-foot pulse side-change entry and exit clearance no cross traffic and a clear controlled exit route',
      'stationCapacity',1,'equipmentKey','mat','optionalEquipment',jsonb_build_array('none'),
      'coachSightline','front-quarter and side views of pad rear knee and lower leg front heel tripod knee path endpoints pelvis trunk breathing and symptoms',
      'inspection',jsonb_build_array('mat integrity cleanliness thickness traction and placement','floor traction cleanliness and debris','front-foot and footwear compatibility','neighbor and cross-traffic separation','entry side-change exit sightline communication and emergency route'),
      'changeRule','Any support contact pad surface hand loading external force load action endpoint count dose symptom space or downstream-demand change requires full revalidation.'),
    jsonb_build_object(
      'exerciseCardDoesNotClassifyParticipants',TRUE,'readinessIsWorkoutInput',TRUE,
      'selectionPrerequisites',jsonb_build_array('safe controlled kneeling entry side change and exit','clean intact stable mat and nonslip floor','comfortable rear-knee and lower-leg support','comfortable front-foot loading with heel and tripod contact','comfortable front-knee progression and small partial retreat and re-advance','understands initial setup is uncounted exact pulse count and stop signal','same-session foot ankle Achilles calf knee kneeling lunge squat landing sprint cutting kicking and balance budgets fit'),
      'excludeOrEscalate',jsonb_build_array('recent significant trauma surgery or procedure without applicable clearance','worsening night post-trauma sharp increasing or unfamiliar pain','new numbness tingling weakness altered circulation or loss of control','front foot ankle Achilles calf knee rear knee hip or back symptoms preventing exact task','inability to kneel change sides rise or exit safely','dizziness faintness nausea visual change chest pain unusual breathlessness disorientation or inability to communicate','clinical restriction conflicting with weight-bearing dorsiflexion or kneeling','unsafe mat floor footwear space traffic sightline or emergency route','participant requests stop'),
      'notEstablishedByEvidence',jsonb_build_array('universal eligibility normal range ideal alignment foot position retreat amplitude or joint contribution','diagnosis treatment prevention correction readiness clearance or clinical threshold','isolated tissue or talocrural motion','one universal dose frequency fatigue ceiling recovery progression or warm-up outcome','guaranteed squat landing sprint cutting or kicking transfer','age floor or participant classification')),
    jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'canonicalAuthoredFromResearch',TRUE,
      'primaryIdentitySource','https://pmc.ncbi.nlm.nih.gov/articles/PMC6063060/',
      'legacySources',jsonb_build_array(41),
      'identityContract','rear_knee_and_lower_leg_padded_front_target_foot_tripod_fixed_initial_forward_endpoint_is_setup_partial_retreat_and_readvance_is_one_pulse',
      'researchSources',jsonb_build_array(
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC6063060/',
        'https://pubmed.ncbi.nlm.nih.gov/23997389/',
        'https://pubmed.ncbi.nlm.nih.gov/31337266/',
        'https://pubmed.ncbi.nlm.nih.gov/31935136/',
        'https://pubmed.ncbi.nlm.nih.gov/39514236/',
        'https://pubmed.ncbi.nlm.nih.gov/42486468/',
        'https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en'),
      'confidenceBySection',jsonb_build_object('identity',86,'taxonomy',84,'anatomy',74,'difficulty',58,'load',70,'fatigueRecovery',52,'constraints',82,'dosage',54,'instructions',86,'alternates',90,'media',50),
      'unresolvedClaims',jsonb_build_array('one universal support geometry foot position endpoint retreat amplitude alignment dose frequency fatigue ceiling recovery progression or outcome','numeric difficulty calibration','media playback exact pulse contacts endpoints count captions accessibility quality safety and approval','individual symptom interpretation or clinical eligibility'),
      'externalPlaybackVerificationPerformed',FALSE,'sourceLimitationsExplicit',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,'publicationQuarantined',TRUE),
    NULL,NULL,NULL,NULL,
    jsonb_build_object(
      'primaryMuscles',jsonb_build_array('soleus','intrinsic_foot_stabilizers','quadriceps'),
      'secondaryMuscles',jsonb_build_array('gastrocnemius','tibialis_anterior','fibularis_group','tibialis_posterior','hamstrings','gluteals','hip_and_trunk_stabilizers'),
      'joints',jsonb_build_array('interphalangeal_and_metatarsophalangeal','subtalar_and_midfoot','talocrural_ankle','front_knee','rear_knee','hip','lumbopelvic_complex'),
      'jointActions',jsonb_build_array('target_ankle_weight_bearing_dorsiflexion_during_readvance','target_ankle_small_controlled_relative_plantarflexion_during_partial_retreat','front_knee_small_flexion_and_extension','foot_tripod_and_subtalar_control','rear_knee_and_lower_leg_isometric_support','hip_and_trunk_stabilization'),
      'planes',jsonb_build_array('sagittal','multiplanar_stabilization'),
      'laterality','unilateral target ankle with contralateral rear knee and lower leg support',
      'supportContacts',jsonb_build_array('target_heel','target_first_metatarsal_head','target_fifth_metatarsal_head','contralateral_rear_knee','contralateral_rear_lower_leg_or_foot'),
      'sequence',jsonb_build_array('padded_half_kneeling_start','uncounted_forward_advance_to_comfortable_endpoint','small_partial_retreat_near_end_range','readvance_to_same_endpoint','one_pulse'),
      'claimsBoundary','The whole-chain half-kneeling movement does not isolate one joint or tissue. Anatomy labels describe plausible task demands and do not prove diagnosis treatment ideal alignment clinical threshold or outcome.'),
    jsonb_build_object(
      'plainLanguageSummary','Pad your back knee, keep the whole front foot planted, set a comfortable knee-forward endpoint, then make small smooth back-and-forward pulses near that endpoint.',
      'expectedSensations',jsonb_build_array('gentle ankle or calf effort or stretch may occur without forcing','steady front-foot pressure','comfortable padded rear-knee contact','light front-thigh hip and trunk effort'),
      'unexpectedSensations',jsonb_build_array('sharp increasing or unfamiliar pain','front ankle pinch catching instability or giving way','Achilles front-knee or rear-knee pain that increases','numbness tingling weakness or circulation change','dizziness faintness nausea visual change chest pain or unusual breathlessness'),
      'selfCheck',jsonb_build_array('rear_knee_stays_comfortably_padded','front_heel_and_tripod_stay_down','knee_moves_over_middle_toes','retreat_stays_small_and_near_endpoint','readvance_reaches_same_endpoint','initial_advance_not_counted','breathing_continues','stop_signal_available'),
      'permissionToScaleOrStop','Use a thicker pad, smaller comfortable endpoint, shorter retreat, slower tempo, fewer pulses, or more rest. Stop and tell the coach whenever pain, pinching, rear-knee comfort, balance, sensation, breathing, vision, or confidence changes.'),
    jsonb_build_object(
      'prebrief',jsonb_build_array('confirm exact unloaded half-kneeling pulse and no full return wall loading hold band weight elevation activation or clinical test','inspect mat floor footwear space side-change and exit','screen current symptoms restrictions kneeling and target-foot loading','set side order pulses endpoint retreat amplitude duration and downstream budgets'),
      'observation',jsonb_build_array('mat rear knee and lower leg support','front heel and tripod','knee path endpoint retreat and readvance','foot rotation collapse or compensation','pelvis trunk breathing and hand loading','count side change symptoms first fault actual seconds and exit'),
      'cueHierarchy',jsonb_build_array('pad_back_knee','whole_front_foot_down','set_comfortable_endpoint','small_retreat','same_endpoint','one_pulse','keep_breathing'),
      'scopeBoundary','Coach observable setup action count exposure and stop rules; do not diagnose restriction impingement instability, interpret a clinical threshold, provide treatment, promise prevention, infer clearance, or force range.'),
    jsonb_build_object(
      'accessibility',jsonb_build_array('front-quarter and side demonstration','written five-step sequence','visual front-foot and knee-path marks','thicker pad smaller endpoint shorter retreat fewer pulses slower tempo and more rest','light fingertips on front thigh without unloading target foot','still images captions transcript or live instruction','separately validated standing seated elevated wall-supported or externally assisted alternative'),
      'incidentResponse',jsonb_build_array('stop_and_stabilize','assist_controlled_kneeling_or_standing_exit_within_scope','follow_facility_emergency_and_clinical_escalation_policy','record_variant_side_exposure_first_fault_symptom_stop_and_action','do_not_resume_without_required_reassessment'),
      'persistence',jsonb_build_array('definition_variant_profile_and_card_version','mat_floor_footwear_and_station','target_side_and_side_order','planned_and_actual_valid_pulses','initial_setup_endpoint_front_foot_position_retreat_amplitude_tempo_and_pauses','valid_invalid_partial_and_symptom_limited_attempts','rear_knee_front_heel_tripod_foot_knee_pelvis_trunk_breathing_and_first_fault','symptoms_stop_reason_rest_duration_substitution_side_change_and_exit','overlapping_ankle_lower_leg_kneeling_lower_body_and_downstream_budget')))
  ON CONFLICT(id) DO UPDATE SET
    canonical_name=EXCLUDED.canonical_name,display_name=EXCLUDED.display_name,
    aliases=EXCLUDED.aliases,description=EXCLUDED.description,
    family_key=EXCLUDED.family_key,schema_version=EXCLUDED.schema_version,
    card_version=EXCLUDED.card_version,status='review',
    content_confidence=EXCLUDED.content_confidence,
    scoring_confidence=EXCLUDED.scoring_confidence,
    media_confidence=EXCLUDED.media_confidence,
    movement_patterns=EXCLUDED.movement_patterns,body_regions=EXCLUDED.body_regions,
    required_equipment=EXCLUDED.required_equipment,
    optional_equipment=EXCLUDED.optional_equipment,
    environment_json=EXCLUDED.environment_json,population_json=EXCLUDED.population_json,
    provenance_json=EXCLUDED.provenance_json,approved_video_url=NULL,
    reviewed_by=NULL,approved_by=NULL,last_reviewed_at=NULL,
    anatomy_json=EXCLUDED.anatomy_json,
    athlete_support_json=EXCLUDED.athlete_support_json,
    coach_support_json=EXCLUDED.coach_support_json,
    support_operations_json=EXCLUDED.support_operations_json,updated_at=now();

  INSERT INTO coaching.exercise_variant_v1(
    id,definition_id,variant_key,display_name,modifier_keys,difficulty_json,
    requirements_json,status,load_profile_json,fatigue_profile_json,
    programming_profile_json)
  VALUES(
    exact_variant,canonical_definition,'rear-knee-supported-end-range-pulse',
    'Rear-Knee-Supported End-Range Ankle Dorsiflexion Pulse',
    ARRAY['comfortable_endpoint','partial_retreat_distance','front_foot_position','mat_thickness','light_fingertips_front_thigh','visual_knee_target','tempo','endpoint_pause','breathing_prompt','pulses','sets','rest_seconds','side_order','delivery_context']::TEXT[],
    jsonb_build_object(
      'technicalComplexity',22,'absoluteLoadDemand',14,'physicalDifficulty',14,
      'coordinationDemand',20,'supervisionDemand',14,'failureConsequence',14,
      'impact',1,'workCapacityDemand',14,'baseOverallDifficulty',greatest(22,14),
      'overallFormula','max_exercise_complexity_physical_difficulty',
      'scoringScope','exact_rear_knee_supported_unloaded_end_range_pulse',
      'exerciseScoresDescribeTaskOnly',TRUE,'participantClassificationAbsent',TRUE,
      'independentCalibrationRequired',TRUE,'humanReviewRequired',TRUE),
    jsonb_build_object(
      'selectable',TRUE,'equipment',jsonb_build_array('mat'),
      'surface','clean_flat_dry_stable_nonslip_floor_with_intact_clean_mat',
      'base','half_kneeling_rear_knee_and_lower_leg_supported',
      'supportContacts',jsonb_build_array('target_heel','target_first_metatarsal_head','target_fifth_metatarsal_head','contralateral_rear_knee','contralateral_rear_lower_leg_or_foot'),
      'targetFootRule','target_heel_and_tripod_remain supported_without_spin_or_uncontrolled_collapse',
      'exactSequence',jsonb_build_array('padded_half_kneeling_start','uncounted_forward_advance_to_comfortable_endpoint','small_partial_retreat_without_upright_return','readvance_to_same_endpoint','one_pulse'),
      'countingRule','the_initial_forward_advance_is_setup_and_one_partial_retreat_and_readvance_to_the_same_endpoint_is_one_pulse',
      'validCompletion','rear knee and lower leg remain comfortably supported target heel and tripod remain planted knee stays in the declared corridor the retreat remains small the readvance restores the comfortable endpoint breathing continues and no stop rule occurs',
      'invalidCompletion',jsonb_build_array('rear_knee_or_pad_shift','target_heel_lift','target_foot_spin_or_uncontrolled_collapse','knee_path_outside_declared_corridor','return_to_upright_start','endpoint_or_retreat_drift','uncontrolled_bounce','meaningful_hand_unloading','added_wall_band_load_elevation_activation_hold_raise_or_clinician_force','breath_hold','symptom_stop'),
      'variantBoundaries',jsonb_build_array('support_position','hand_loading','knee_position','support_surface','external_force','external_load','added_action','isometric_hold','endpoint','return_mode','clinical_measurement','count'),
      'clinicalAssessmentOrTreatment',FALSE,'humanReviewRequired',TRUE),
    'review',
    jsonb_build_object(
      'loadingType','unloaded_bodyweight_closed_chain_unilateral_target_ankle_small_amplitude_weight_shift_with_rear_knee_support',
      'externalLoadMethod','none_body_mass_through_front_target_foot_and_padded_rear_knee_support',
      'gripDemand',1,'jointStress',14,'spinalLoading',4,'eccentricStress',8,
      'landingContactsPerRep',0,'handImpactContactsPerRep',0,'impactClass','none',
      'primaryExposure',jsonb_build_array('target_ankle_weight_bearing_dorsiflexion_near_comfortable_endpoint','target_foot_tripod_support','front_knee_small_flexion_and_extension','rear_knee_and_lower_leg_floor_support','small_amplitude_tibial_progression'),
      'tracking',jsonb_build_array('variant_and_profile','mat_floor_and_footwear','side_and_side_order','planned_and_actual_valid_pulses','initial_endpoint_front_foot_position_and_retreat_amplitude','tempo_and_pauses','valid_invalid_partial_and_symptom_limited_attempts','rear_knee_heel_tripod_foot_rotation_knee_path_endpoint_and_count_faults','first_fault','symptoms','rest','duration','same_session_ankle_lower_leg_kneeling_lower_body_and_sport_exposure')),
    jsonb_build_object(
      'localMuscleFatigue',14,'gripFatigue',1,'technicalFatigueSensitivity',22,
      'impactAccumulation',1,'recoveryHours',8,'recoveryRangeHours',jsonb_build_array(4,18),
      'primaryFatigueSites',jsonb_build_array('target_foot_and_ankle_stabilizers','soleus_and_calf','front_quadriceps','rear_knee_and_hip_support','hip_and_trunk_stabilizers','attention_to_endpoint_and_count'),
      'cumulativeBudget',jsonb_build_object('pulsesPerSide',30,'weightBearingDorsiflexionSecondsPerSide',180,'kneelingSecondsPerSide',240,'ankleMobilityLoad',26,'calfAchillesExposure',24,'technicalSensitivity',22,'impact',0),
      'interference',jsonb_build_array('later_high_priority_landing_sprint_cutting_kicking_squat_or_ankle_work','same_session_foot_ankle_Achilles_calf_knee_kneeling_or_balance_loading','fatigue_that_changes_pad_support_heel_tripod_knee_path_endpoint_retreat_readvance_or_count'),
      'recoveryIsPlanningEstimate',TRUE,'tissueThresholdNotEstablished',TRUE),
    jsonb_build_object(
      'trainingStimuli',jsonb_build_array('half_kneeling_weight_bearing_ankle_dorsiflexion_control','target_foot_tripod_support','controlled_small_amplitude_tibial_progression','rear_knee_supported_position_control'),
      'stimulusDose',jsonb_build_object('sets',jsonb_build_array(1,3),'pulsesPerSide',jsonb_build_array(4,10),'secondsPerPulse',jsonb_build_array(2,5),'restSeconds',jsonb_build_array(15,45)),
      'weeklyExposure',jsonb_build_object('minimum',0,'maximumWithoutReview',7,'unit','sessions','contextDependent',TRUE),
      'prerequisites',jsonb_build_array('safe_controlled_kneeling_entry_side_change_and_exit','clean_intact_mat_and_nonslip_floor','comfortable_rear_knee_and_lower_leg_support','target_heel_and_tripod_contact','comfortable_endpoint_and_small_retreat_readvance','understands_uncounted_setup_exact_pulse_count_and_stop','same_session_ankle_lower_leg_kneeling_lower_body_and_sport_budgets_fit'),
      'completionCriteria',jsonb_build_array('rear_knee_and_lower_leg_supported','target_heel_and_tripod_supported','knee_over_declared_middle_toe_corridor','comfortable_endpoint','small_partial_retreat','same_endpoint_readvance','stable_pelvis_and_trunk','continuous_breathing','no_stop_symptoms'),
      'sequenceRules',jsonb_build_array('prepare_and_access_or_restore_context_only','initial_forward_advance_is_setup_not_a_pulse','do_not_turn_range_retreat_visual_target_fingertips_tempo_pause_breathing_dose_side_order_or_context_into_hidden_variants','do_not_add_full_return_standing_wall_loading_isometric_band_weight_elevation_activation_raise_clinician_force_or_clinical_test_silently','revalidate_downstream_foot_ankle_Achilles_calf_knee_kneeling_lunge_squat_landing_sprint_cutting_kicking_and_balance_load'),
      'pairingCompatibility',jsonb_build_object('compatible',jsonb_build_array('low_impact_lower_body_preparation_or_restore_when_all_kneeling_contact_symptom_and_fatigue_budgets_fit'),'avoid',jsonb_build_array('fatiguing_ankle_or_calf_work_before_priority_landing_sprint_cutting_or_kicking','symptom_provoking_weight_bearing_dorsiflexion_or_kneeling','time_critical_work_when_pad_setup_side_change_or_reassessment_displaces_priority_training')),
      'interferenceRules',jsonb_build_array('count_all_overlapping_ankle_mobility_calf_Achilles_kneeling_balance_lunge_squat_landing_sprint_cutting_and_kicking_work','stop_before_pad_support_heel_tripod_knee_path_endpoint_retreat_readvance_count_or_exit_changes'),
      'uncertaintyPolicy','When exact rear-knee support front-foot contacts endpoint retreat readvance count symptoms mat safety or available time is uncertain do not select; request clarification or choose a separately validated card.',
      'selectionStatus','review_only_machine_complete','publicationQuarantined',TRUE,
      'exerciseDifficultyDescribesTaskOnly',TRUE,'approvalsCreated',FALSE)
  )
  ON CONFLICT(id) DO UPDATE SET
    definition_id=EXCLUDED.definition_id,variant_key=EXCLUDED.variant_key,
    display_name=EXCLUDED.display_name,modifier_keys=EXCLUDED.modifier_keys,
    difficulty_json=EXCLUDED.difficulty_json,
    requirements_json=EXCLUDED.requirements_json,status='review',
    load_profile_json=EXCLUDED.load_profile_json,
    fatigue_profile_json=EXCLUDED.fatigue_profile_json,
    programming_profile_json=EXCLUDED.programming_profile_json,updated_at=now();

  INSERT INTO coaching.exercise_delivery_profile_v1(
    id,variant_id,profile_key,phase_key,role,purpose,phase_suitability,
    methodology_alignment,objective_relevance_json,dosage_json,quality_gate,
    stop_rules,coach_instructions,athlete_instructions,expected_adaptation,
    equipment_required,logistics_json,substitution_ids,status,time_model_json,
    dose_scaling_json,measurement_json,support_prompts_json)
  SELECT p.id,exact_variant,p.profile_key,p.phase_key,'primary',p.purpose,
    p.phase_suitability,p.methodology_alignment,
    jsonb_build_object('weight_bearing_ankle_control',92,'foot_tripod_support',88,
      'rear_knee_supported_position',88,'low_impact',96,
      'restore_context',CASE WHEN p.phase_key='restore' THEN 90 ELSE 68 END),
    jsonb_build_object('sets',jsonb_build_array(1,2),
      'pulsesPerSide',CASE WHEN p.phase_key='restore' THEN jsonb_build_array(4,8) ELSE jsonb_build_array(4,10) END,
      'secondsPerPulse',jsonb_build_array(2,5),'restSeconds',jsonb_build_array(15,45),
      'initialForwardAdvanceIsUncountedSetup',TRUE,'exampleDoseIsNotUniversal',TRUE),
    'The rear knee and lower leg remain comfortably supported, the front heel and tripod remain planted without spin or uncontrolled collapse, the knee stays over the declared middle-toe corridor, the retreat remains small and near end range, the readvance restores the same comfortable endpoint, the initial advance is not counted, breathing continues, and no stop symptom occurs.',
    ARRAY[
      'Sharp, increasing, night, post-trauma, or unfamiliar pain or participant stop request.',
      'Front foot, ankle, Achilles, calf, front knee, rear knee, hip, or back symptoms prevent the exact support.',
      'Pinching, catching, painful clicking, instability, giving way, uncontrolled collapse, or inability to exit safely.',
      'Numbness, tingling, weakness, altered circulation, loss of control, or another neurologic sign.',
      'Dizziness, faintness, nausea, visual change, chest pain, unusual breathlessness, disorientation, or inability to communicate.',
      'The mat or rear knee shifts, the front heel lifts, the tripod is lost, the foot spins, or meaningful hand unloading occurs.',
      'Knee path, comfortable endpoint, small retreat, same-endpoint readvance, pelvis, trunk, breathing, or count cannot be restored by reducing amplitude, pulses, or pace.',
      'A full return, standing support, wall loading, hold, band, weight, elevation, active lift, calf raise, clinician force, or another wrong task cannot be corrected safely.',
      'Mat integrity, floor traction, footwear, space, traffic, hygiene, sightline, communication, or emergency route becomes unsafe.',
      'The planned pulse, weight-bearing ankle, kneeling, calf-Achilles, technical-fatigue, duration, or downstream exposure budget is reached.'
    ]::TEXT[],
    'Verify the exact unloaded half-kneeling pulse, clean intact mat, nonslip floor, target side, comfortable rear-knee support, front heel and tripod, current symptoms and restrictions, planned pulses, actual endpoint, retreat, time, and downstream lower-body work. Demonstrate the uncounted initial advance, small retreat, same-endpoint readvance, one-pulse count, stop, side change, rise, and exit. Observe support contacts, knee path, endpoints, breathing, symptoms, first fault, actual duration, and controlled exit. Do not diagnose restriction, impingement, or instability, provide mobilization treatment, or imply readiness.',
    'Pad your back knee and keep your whole front foot down. Set a comfortable knee-forward endpoint; that first move is setup. Move back only a little, then return to the same endpoint for one pulse. Stop for pain, pinching, tingling, weakness, dizziness, instability, or rear-knee discomfort.',
    CASE WHEN p.phase_key='restore'
      THEN 'More consistent low-intensity control of the exact half-kneeling end-range pulse during restore; no treatment, structural, readiness, prevention, or performance outcome is guaranteed.'
      ELSE 'More consistent control of the exact half-kneeling end-range pulse during preparation; no treatment, structural, readiness, prevention, or performance outcome is guaranteed.' END,
    ARRAY['mat']::TEXT[],
    jsonb_build_object('stationCapacity',1,
      'base','half_kneeling_rear_knee_and_lower_leg_supported',
      'requiredEquipment','mat','space','one_padded_half_kneeling_station_with_front_foot_side_change_rise_and_exit_clearance',
      'setupSeconds',25,'sideChangeSeconds',20,'coachSightline','front_quarter_and_side',
      'crossTrafficProhibited',TRUE,'matAndFloorInspectionRequired',TRUE,
      'revalidateAfterAnyChange',TRUE),
    ARRAY[standing_variant,iso_variant,ankle_car_variant,calf_pulse_variant]::UUID[],
    'review',
    jsonb_build_object('durationFormula','setup_and_pad_adjustment_seconds + initial_uncounted_endpoint_advance_seconds + sum(actual_valid_pulses * actual_seconds_per_pulse) + side_change_seconds + rest_seconds + invalid_or_partial_attempt_seconds + symptom_response_seconds + substitution_seconds + station_reset_rise_and_exit_seconds','secondsPerPulse',jsonb_build_array(2,5),'minimumSeconds',55,'typicalSeconds',130,'maximumSecondsWithoutReview',300,'includeActualNotPlanned',TRUE,'recomputeAfterSubstitution',TRUE),
    jsonb_build_object('regressionOrder',jsonb_build_array('increase_pad_thickness','reduce_comfortable_endpoint','reduce_partial_retreat_distance','reduce_to_four_clean_pulses','slow_the_pulse','increase_rest','end_set','select_a_separately_validated_non_kneeling_task'),'progressionOrder',jsonb_build_array('complete_clean_pulses','increase_within_four_to_ten_pulse_profile','increase_comfortable_endpoint_without_forcing_or_losing_contacts','increase_partial_retreat_only_while_remaining_near_endpoint','select_a_distinct_full_return_standing_loaded_banded_elevated_activation_or_sport_action_only_after_full_revalidation'),'neverScaleByForcingRangeAddingLoadIgnoringRearKneeComfortOrChangingTheCount',TRUE),
    jsonb_build_object('record',jsonb_build_array('definition_variant_profile_and_card_version','mat_floor_footwear_and_station','target_side_and_side_order','planned_and_actual_valid_pulses','initial_setup_endpoint_front_foot_position_retreat_amplitude_tempo_pause_and_rest','valid_invalid_partial_and_symptom_limited_attempts','rear_knee_front_heel_tripod_foot_knee_pelvis_trunk_breathing_and_hand_loading','first_fault','symptoms_and_stop_reason','weight_bearing_dorsiflexion_and_kneeling_seconds','duration','substitution','side_change_station_reset_rise_and_exit'),'validUnit','one_small_partial_retreat_and_readvance_to_the_same_comfortable_endpoint_while_exact_half_kneeling_contacts_remain_valid','invalidUnitsTrackedSeparately',TRUE,'doNotConvertPulsesToFullRockersOrSeconds',TRUE),
    jsonb_build_object('athlete',jsonb_build_array('pad_back_knee','whole_front_foot_down','first_move_sets_endpoint','small_back_and_forward_is_one_pulse','stop_for_pain_pinch_instability_tingling_dizziness_or_rear_knee_discomfort'),'coach',jsonb_build_array('verify_unloaded_half_kneeling_identity','inspect_mat_floor_and_space','observe_contacts_endpoint_retreat_readvance_and_count','record_actual_exposure_and_first_fault','revalidate_every_substitution'),'accessibility',jsonb_build_array('front_quarter_and_side_visual','written_five_step_sequence','visual_foot_and_knee_path_marks','thicker_pad_smaller_endpoint_shorter_retreat_fewer_pulses_slower_tempo_more_rest','captions_transcript_still_images_or_live_instruction'),'escalation',jsonb_build_array('stop','stabilize','assist_safe_exit_within_scope','follow_facility_policy','record','do_not_resume_without_reassessment'))
  FROM (VALUES
    ('9d236b7c-82ab-4b0f-aa89-2aa8fd7b4d61'::UUID,
      'prepare-half-kneeling-ankle-pulse','prepare_and_access',92,90,
      'Use the exact unloaded half-kneeling end-range pulse as low-impact ankle preparation only when mat, kneeling tolerance, front-foot contacts, symptoms, duration, and cumulative ankle and lower-body budgets fit.'),
    ('1d0a424c-cdb3-4979-bad3-8d8dfc3c2db3'::UUID,
      'restore-half-kneeling-ankle-pulse','restore',86,82,
      'Use the same exact pulse as a low-intensity restore option only when kneeling and weight-bearing dorsiflexion are comfortable and it does not replace assessment, treatment, or recovery guidance.' )
  ) p(id,profile_key,phase_key,phase_suitability,methodology_alignment,purpose)
  ON CONFLICT(id) DO UPDATE SET
    variant_id=EXCLUDED.variant_id,profile_key=EXCLUDED.profile_key,
    phase_key=EXCLUDED.phase_key,role=EXCLUDED.role,purpose=EXCLUDED.purpose,
    phase_suitability=EXCLUDED.phase_suitability,
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

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,rationale,
    evidence_json,resolution_source,reviewed_by,resolved_at)
  SELECT 1,canonical_definition,i.definition_id,'distinct_exercises',i.rationale,
    jsonb_build_object('migration',migration_key,'identityBoundary',i.boundary_key,
      'canonicalContract','rear_knee_and_lower_leg_padded_front_target_foot_tripod_fixed_initial_forward_endpoint_is_setup_partial_retreat_and_readvance_is_one_pulse',
      'neighborContract',i.neighbor_contract,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'deterministic_identity_equivalence',NULL,now()
  FROM (VALUES
    (standing_definition,'half_kneeling_pulse_vs_standing_full_return','Standing rocker uses bilateral foot support and a complete forward-and-return cycle; Source 41 uses rear-knee support and stays near end range.','standing_staggered_forward_and_return_cycle'),
    (iso_definition,'dynamic_pulse_vs_isometric_press','The iso press sustains a wall-directed contraction without the small retreat-and-re-advance pulse.','wall_ankle_dorsiflexion_isometric_press'),
    (ankle_car_definition,'weight_bearing_sagittal_pulse_vs_circumduction','Ankle CARs use controlled circumduction without the half-kneeling planted-front-foot endpoint contract.','controlled_ankle_circumduction'),
    (calf_pulse_definition,'half_kneeling_dorsiflexion_vs_standing_calf_pulse','Wall Lean Calf-Soleus Pulse uses standing wall support and plantarflexor lower-leg pulsing rather than rear-knee-supported dorsiflexion.','standing_wall_lean_calf_soleus_pulse'),
    (calf_raise_definition,'heel_planted_pulse_vs_calf_raise','Calf Raise to Controlled Heel Drop deliberately lifts and lowers the heel through plantarflexion and eccentric return.','calf_raise_and_controlled_heel_drop')
  ) i(definition_id,boundary_key,rationale,neighbor_contract)
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,
    reviewed_by=NULL,resolved_at=now();

  INSERT INTO coaching.exercise_section_evidence_v1(
    definition_id,reviewed_card_version,section_key,source_url,source_title,
    source_publisher,source_kind,claims_json,evidence_quality,review_status,
    reviewer_user_id,reviewed_at)
  SELECT canonical_definition,2,e.section_key,e.source_url,e.source_title,e.publisher,
    e.source_kind,jsonb_build_array(
      jsonb_build_object('supported',e.supported_claim,'scope',e.scope),
      jsonb_build_object('limitation',e.limitation,
        'noUniversalRangeAlignmentSafetyEligibilityDoseRecoveryOutcomeOrDifficultyClaim',TRUE)),
    e.quality,'candidate',NULL,NULL
  FROM (VALUES
    ('identity','https://pmc.ncbi.nlm.nih.gov/articles/PMC6063060/','Immediate and Short Term Effect of Dry Needling on Triceps Surae Range of Motion and Functional Movement: A Randomized Trial','International Journal of Sports Physical Therapy','peer_reviewed_research','The study describes closed-chain half-kneeling dorsiflexion with the target foot forward, body weight moving forward, and heel kept down.','direct half-kneeling support and forward action context','The procedure is a maximal measure and does not define repeated end-range pulses, an uncounted initial advance, partial retreat, or Vortex publication rules.',84),
    ('taxonomy','https://pubmed.ncbi.nlm.nih.gov/23997389/','Reliability and validity of a weight-bearing measure of ankle dorsiflexion range of motion','Physiotherapy Canada','peer_reviewed_research','Weight-bearing dorsiflexion uses a planted target foot and forward tibial progression.','direct movement and contact context','The study does not create Vortex support pulse or taxonomy keys and does not classify participant skill.',90),
    ('anatomy','https://pubmed.ncbi.nlm.nih.gov/31337266/','How Much Does the Talocrural Joint Contribute to Ankle Dorsiflexion Range of Motion During the Weight-Bearing Lunge Test? A Cross-sectional Radiographic Validity Study','Journal of Orthopaedic & Sports Physical Therapy','peer_reviewed_research','Weight-bearing lunge displacement reflects multisegment contributions rather than isolated talocrural motion.','whole-chain anatomy and joint-contribution boundary','The study does not isolate one tissue or validate half-kneeling pulse anatomy claims.',92),
    ('biomechanics','https://pmc.ncbi.nlm.nih.gov/articles/PMC6063060/','Immediate and Short Term Effect of Dry Needling on Triceps Surae Range of Motion and Functional Movement: A Randomized Trial','International Journal of Sports Physical Therapy','peer_reviewed_research','The half-kneeling procedure advances body weight over the forward foot while the heel remains down.','direct support and forward-path context','Vortex adds tripod contact, comfortable rather than maximal endpoint, small retreat, readvance, and no-upright-return count.',84),
    ('difficulty','https://pubmed.ncbi.nlm.nih.gov/23997389/','Reliability and validity of a weight-bearing measure of ankle dorsiflexion range of motion','Physiotherapy Canada','peer_reviewed_research','Repeatable planted-foot execution requires position and contact control with low external load and no impact.','exercise-task complexity and physical-demand context','The study does not score Vortex exercises or classify a participant.',90),
    ('load_fatigue_recovery','https://pubmed.ncbi.nlm.nih.gov/31935136/','Ankle-Joint Self-Mobilization and CrossFit Training in Patients With Chronic Ankle Instability: A Randomized Controlled Trial','Journal of Athletic Training','peer_reviewed_research','The trial combined multiple ankle self-mobilizations with CrossFit, including loaded kneeling-lunge dorsiflexion.','adjacent load response and variant-boundary context','The combined loaded clinical protocol cannot establish unloaded-pulse fatigue ceilings cumulative budgets or recovery hours.',90),
    ('constraints','https://pubmed.ncbi.nlm.nih.gov/42486468/','Sensory-Mapping During the Weight-Bearing Lunge Test Across Chronic Ankle Instability, Copers, and Healthy Controls','Journal of Sport Rehabilitation','peer_reviewed_research','Pain frequency and sensation location varied across groups during weight-bearing dorsiflexion.','symptom and population boundary','Sensation alone does not establish eligibility pathology clearance or a universal normal response.',88),
    ('dosage','https://pubmed.ncbi.nlm.nih.gov/31935136/','Ankle-Joint Self-Mobilization and CrossFit Training in Patients With Chronic Ankle Instability: A Randomized Controlled Trial','Journal of Athletic Training','peer_reviewed_research','The randomized protocol used three different self-mobilization tasks in a clinical population.','adjacent dose context only','Its dose is not transferable as a universal prescription for the unloaded Vortex pulse.',90),
    ('instructions','https://pmc.ncbi.nlm.nih.gov/articles/PMC6063060/','Immediate and Short Term Effect of Dry Needling on Triceps Surae Range of Motion and Functional Movement: A Randomized Trial','International Journal of Sports Physical Therapy','peer_reviewed_research','The direct procedure supplies the half-kneeling forward-foot and heel-down setup.','direct setup context','Vortex adds padding tripod contact uncounted setup endpoint partial retreat readvance exact count stop persistence and side-change rules.',84),
    ('safety_stop_rules','https://pubmed.ncbi.nlm.nih.gov/42486468/','Sensory-Mapping During the Weight-Bearing Lunge Test Across Chronic Ankle Instability, Copers, and Healthy Controls','Journal of Sport Rehabilitation','peer_reviewed_research','Pain and sensation location during weight-bearing dorsiflexion are variable.','symptom observation and escalation context','Facility trauma neurologic systemic rear-knee incident and emergency rules remain separately required.',88),
    ('programming','https://pubmed.ncbi.nlm.nih.gov/39514236/','Effect duration of a self-applied talocrural joint mobilization on restricted dorsiflexion: a repeated measures design','Journal of Manual & Manipulative Therapy','peer_reviewed_research','A banded self-mobilization changed static lunge dorsiflexion transiently but did not change dynamic forward-step-down dorsiflexion.','programming transfer and adjacent-variant boundary','The banded task does not establish transfer or outcomes for this unloaded pulse.',86),
    ('athlete_support','https://pmc.ncbi.nlm.nih.gov/articles/PMC6063060/','Immediate and Short Term Effect of Dry Needling on Triceps Surae Range of Motion and Functional Movement: A Randomized Trial','International Journal of Sports Physical Therapy','peer_reviewed_research','Half-kneeling provides visible front-foot heel forward-knee and rear-knee landmarks.','plain-language participant support','The source does not define expected sensations accessibility or Vortex stop communication.',84),
    ('coach_support','https://pubmed.ncbi.nlm.nih.gov/23997389/','Reliability and validity of a weight-bearing measure of ankle dorsiflexion range of motion','Physiotherapy Canada','peer_reviewed_research','Repeatable weight-bearing dorsiflexion observation depends on standardized setup and contact monitoring.','coach observation and measurement boundary','The study does not prescribe Vortex layout escalation rendering or approval.',90),
    ('accessibility','https://pmc.ncbi.nlm.nih.gov/articles/PMC6063060/','Immediate and Short Term Effect of Dry Needling on Triceps Surae Range of Motion and Functional Movement: A Randomized Trial','International Journal of Sports Physical Therapy','peer_reviewed_research','Half-kneeling support and heel contact are visible landmarks.','communication and task-scaling context','Standing elevated wall-loaded or clinician-assisted support changes the task and requires separate review.',84),
    ('alternates','https://pubmed.ncbi.nlm.nih.gov/31935136/','Ankle-Joint Self-Mobilization and CrossFit Training in Patients With Chronic Ankle Instability: A Randomized Controlled Trial','Journal of Athletic Training','peer_reviewed_research','The trial distinguishes banded step-supported, kettlebell-loaded kneeling, and seated band-pull tasks.','alternate identity and variant boundary','The study does not equate those tasks with an unloaded end-range pulse.',90),
    ('media','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en','Embed videos and playlists','YouTube Help','manufacturer_instruction','Five candidates returned current oEmbed title channel thumbnail and iframe metadata on 2026-08-10.','candidate metadata only','oEmbed does not prove playback unloaded half-kneeling support exact pulse contacts endpoints count captions accessibility quality safety card match or approval; two titles identify adjacent variants.',82)
  ) e(section_key,source_url,source_title,publisher,source_kind,supported_claim,scope,limitation,quality)
  ON CONFLICT(definition_id,reviewed_card_version,section_key,source_url) DO UPDATE SET
    source_title=EXCLUDED.source_title,source_publisher=EXCLUDED.source_publisher,
    source_kind=EXCLUDED.source_kind,claims_json=EXCLUDED.claims_json,
    evidence_quality=EXCLUDED.evidence_quality,review_status='candidate',
    reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_media_candidate_v1(
    definition_id,variant_id,reviewed_card_version,url,embed_url,video_id,title,
    channel_name,duration_seconds,language_code,captions_available,
    embedding_allowed,exact_variant_match,demonstration_quality_score,
    link_status,review_status,discovery_method,source_query,reviewer_user_id,
    reviewed_at,next_review_at,notes)
  SELECT canonical_definition,exact_variant,2,
    'https://www.youtube.com/watch?v='||m.video_id,
    'https://www.youtube-nocookie.com/embed/'||m.video_id,
    m.video_id,m.title,m.channel,NULL,'en',NULL,TRUE,NULL,NULL,
    'healthy','candidate','manual_research',m.query,NULL,NULL,
    '2026-11-10'::TIMESTAMPTZ,
    'Current YouTube oEmbed metadata only. Playback unloaded half-kneeling support exact rear-knee and front-foot contacts partial-retreat pulse endpoints count captions accessibility cue quality safety reviewer identity card-version match and approval remain unverified. Candidate-specific title mismatches remain quarantined.'
  FROM (VALUES
    ('Kn-TjcmuzYQ','Half Kneeling Ankle Mobility - Kinetic U Exercise Series','Tangelo - Seattle Chiropractor + Rehab','Source 41 legacy candidate checked by YouTube oEmbed; full exact-pulse review pending'),
    ('NrZ4NuSlJ88','How to Do a Half Kneel Ankle Dorsiflexion Self-Mobilization Exercise | MedBridge','Medbridge','Source 41 legacy candidate checked by YouTube oEmbed; full exact-pulse review pending'),
    ('wIUdrQsqhKs','Open Half Kneeling Ankle Mobility with KB','The Setup - Golf Performance by Tiffany','Source 41 legacy candidate checked by YouTube oEmbed; title indicates a loaded adjacent variant'),
    ('yc27kCW8aco','Half kneeling ankle mobilization','Jakob Richloow','Half-kneeling ankle-mobilization candidate checked by YouTube oEmbed; full exact-pulse review pending'),
    ('1uk2j8TyHvk','Half Kneeling Ankle Dorsiflexion with End Range Activation','Keep It Moving Physical Therapy & Wellness','Half-kneeling candidate checked by YouTube oEmbed; title and public description indicate an active end-range lift adjacent variant')
  ) m(video_id,title,channel,query)
  ON CONFLICT(definition_id,reviewed_card_version,url) DO UPDATE SET
    variant_id=exact_variant,embed_url=EXCLUDED.embed_url,video_id=EXCLUDED.video_id,
    title=EXCLUDED.title,channel_name=EXCLUDED.channel_name,duration_seconds=NULL,
    language_code='en',captions_available=NULL,embedding_allowed=TRUE,
    exact_variant_match=NULL,demonstration_quality_score=NULL,link_status='healthy',
    review_status='candidate',discovery_method='manual_research',
    source_query=EXCLUDED.source_query,reviewer_user_id=NULL,reviewed_at=NULL,
    next_review_at=EXCLUDED.next_review_at,notes=EXCLUDED.notes,updated_at=now();

  INSERT INTO coaching.exercise_alternate_assessment_v1(
    definition_id,reviewed_card_version,alternate_name,classification,rationale,
    distinguishing_dimensions,proposed_card_json,review_status,reviewer_user_id,reviewed_at)
  SELECT canonical_definition,2,a.name,a.classification,a.rationale,
    jsonb_build_object('boundaryKey',a.boundary_key,'factsRequired',a.facts,
      'neverInferFromNameOrParticipantRanking',TRUE),
    jsonb_build_object('status',a.proposed_status,'classificationCandidate',a.classification,
      'humanIdentityContentAndSafetyReviewRequired',TRUE,'approvalsCreated',FALSE),
    'candidate',NULL,NULL
  FROM (VALUES
    ('Half-Kneeling Ankle Dorsiflexion Pulse','same_identity','Source 41 name matches the rear-knee-supported planted-front-foot end-range pulse.','source41_identity',jsonb_build_array('legacy_exercise_41','same_support_action_count'),'canonical_name'),
    ('Half-Kneeling End-Range Ankle Pulse','same_identity','The alias preserves support contacts partial retreat readvance and count.','canonical_alias',jsonb_build_array('same_support','same_endpoints','same_count'),'merge_alias'),
    ('Comfortable Forward Endpoint','modifier_annotation','A smaller symptom-free endpoint changes amplitude without changing support pulse action or count.','endpoint_annotation',jsonb_build_array('comfortable_endpoint'),'delivery_annotation'),
    ('Declared Partial-Retreat Distance','modifier_annotation','A small retreat remains a pulse parameter when the knee stays near end range and returns to the same endpoint.','retreat_annotation',jsonb_build_array('partial_retreat_distance'),'delivery_annotation'),
    ('Front-Foot Placement','modifier_annotation','Declared foot placement is setup when contacts and the pulse contract remain fixed.','foot_position_annotation',jsonb_build_array('front_foot_position'),'delivery_annotation'),
    ('Light Fingertips on Front Thigh','modifier_annotation','Light non-unloading contact may support orientation while preserving front-foot and rear-knee loading.','fingertip_annotation',jsonb_build_array('light_fingertips','no_unloading'),'delivery_annotation'),
    ('Mat Thickness or Rear-Knee Padding','modifier_annotation','Approved padding changes comfort but not the rear-knee support identity.','padding_annotation',jsonb_build_array('mat_thickness'),'delivery_annotation'),
    ('Controlled Tempo or Brief Endpoint Pause','modifier_annotation','Pace and a brief pause alter exposure time while preserving the pulse.','tempo_pause_annotation',jsonb_build_array('tempo','endpoint_pause'),'delivery_annotation'),
    ('Pulse Count Sets Rest or Side Order','modifier_annotation','Volume recovery and side sequence change delivery rather than identity.','dose_annotation',jsonb_build_array('pulses','sets','rest','side_order'),'delivery_annotation'),
    ('Visual Knee Target or Breathing Prompt','modifier_annotation','Non-contact visual and breathing prompts clarify execution without adding an action.','cue_annotation',jsonb_build_array('visual_target','breathing_prompt'),'delivery_annotation'),
    ('Half-Kneeling Full-Return Ankle Rocker','new_variant','Returning to the upright half-kneeling start changes the endpoint and repetition count.','full_return_variant',jsonb_build_array('return_mode','count'),'research_queue'),
    ('Wall-Supported Half-Kneeling Ankle Pulse','new_variant','Meaningful hand loading changes support load distribution station needs and balance demand.','wall_support_variant',jsonb_build_array('hand_loading','wall'),'research_queue'),
    ('Band-Assisted Half-Kneeling Talocrural Mobilization','new_variant','External band force changes equipment anchor safety force direction setup and clinical scope.','band_assisted_variant',jsonb_build_array('external_force','anchor'),'research_queue'),
    ('Kettlebell-Loaded Half-Kneeling Dorsiflexion','new_variant','A kettlebell on the front knee changes load difficulty balance failure consequences and supervision.','loaded_variant',jsonb_build_array('external_load','kettlebell'),'research_queue'),
    ('Elevated-Front-Foot Half-Kneeling Mobilization','new_variant','A step or box changes support geometry equipment range interpretation and fall exposure.','elevated_variant',jsonb_build_array('support_surface','elevation'),'research_queue'),
    ('Half-Kneeling Dorsiflexion with End-Range Activation','new_variant','Actively lifting the forefoot adds dorsiflexor contraction and a timed activation action.','activation_variant',jsonb_build_array('added_action','active_dorsiflexor_lift'),'research_queue'),
    ('Clinician-Assisted Half-Kneeling Mobilization','new_variant','Manual force clinical interpretation consent provider scope and documentation change the task and service.','clinician_assisted_variant',jsonb_build_array('clinician_force','clinical_scope'),'research_queue'),
    ('Standing Knee-to-Wall Ankle Rocker','new_definition','Source 40 uses staggered standing bilateral-foot support and a complete forward-and-return cycle.','standing_rocker_distinct',jsonb_build_array('standing_support','full_return'),'existing_distinct_definition'),
    ('Wall Ankle Dorsiflexion Iso Press','new_definition','Source 844 sustains an isometric press rather than repeating a small dynamic pulse.','iso_press_distinct',jsonb_build_array('isometric_action'),'existing_distinct_definition'),
    ('Ankle CARs','new_definition','Source 42 uses controlled ankle circumduction rather than weight-bearing sagittal pulsing.','ankle_car_distinct',jsonb_build_array('circular_action'),'existing_distinct_definition'),
    ('Wall Lean Calf-Soleus Pulse','new_definition','Source 1364 uses standing wall-lean support and a plantarflexor lower-leg pulse.','calf_pulse_distinct',jsonb_build_array('standing_wall_lean','plantarflexor_pulse'),'existing_distinct_definition'),
    ('Calf Raise to Controlled Heel Drop','new_definition','Source 44 lifts and lowers the heel through plantarflexion and eccentric return.','calf_raise_distinct',jsonb_build_array('heel_raise','controlled_lower'),'existing_distinct_definition'),
    ('Clinical Half-Kneeling Dorsiflexion Test','new_definition','A standardized maximal measure adds interpretation comparison documentation consent and clinical scope.','clinical_test_distinct',jsonb_build_array('maximal_measurement','clinical_scope'),'research_queue'),
    ('Static Bent-Knee Calf or Soleus Stretch','new_definition','A sustained stretch has a hold duration and tissue-bias contract rather than repeated pulses.','static_stretch_distinct',jsonb_build_array('static_hold'),'research_queue')
  ) a(name,classification,rationale,boundary_key,facts,proposed_status)
  ON CONFLICT(definition_id,reviewed_card_version,alternate_name) DO UPDATE SET
    classification=EXCLUDED.classification,rationale=EXCLUDED.rationale,
    distinguishing_dimensions=EXCLUDED.distinguishing_dimensions,
    proposed_card_json=EXCLUDED.proposed_card_json,review_status='candidate',
    reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_relationship_v1(
    from_variant_id,to_variant_id,relationship,similarity_score,dimensions,reason,
    conditions_json,review_status,created_by,reviewed_by,reviewed_at)
  SELECT exact_variant,r.to_id,r.relationship,r.score,r.dimensions,r.reason,
    jsonb_build_object('migration',migration_key,'reviewOnly',TRUE,'automaticSubstitution',FALSE,
      'revalidate',jsonb_build_array('identity and purpose','support contacts endpoint action and count','mat wall floor footwear equipment space and side change','symptoms and restrictions','dose duration and logistics','foot ankle Achilles calf knee kneeling lower-body balance and sport budgets','persistence','coach rendering','athlete rendering'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'review',NULL,NULL,NULL
  FROM (VALUES
    (standing_variant,'progression',64,ARRAY['stability','complexity','range']::TEXT[],'Moves from rear-knee support and an end-range pulse to standing support and a full forward-and-return cycle; use only after full reselection.'),
    (iso_variant,'lateral_substitution',52,ARRAY['complexity','fatigue','range']::TEXT[],'Changes the dynamic pulse to an isometric press with a different support endpoint count and exposure measure.'),
    (ankle_car_variant,'lateral_substitution',42,ARRAY['complexity','range','stability']::TEXT[],'Changes weight-bearing sagittal pulsing to controlled ankle circumduction and a different support contract.'),
    (calf_pulse_variant,'lateral_substitution',40,ARRAY['load','fatigue','stability']::TEXT[],'Changes rear-knee-supported dorsiflexion to a standing wall-lean plantarflexor pulse and different loading intent.')
  ) r(to_id,relationship,score,dimensions,reason)
  ON CONFLICT(from_variant_id,to_variant_id,relationship) DO UPDATE SET
    similarity_score=EXCLUDED.similarity_score,dimensions=EXCLUDED.dimensions,
    reason=EXCLUDED.reason,conditions_json=EXCLUDED.conditions_json,
    review_status='review',created_by=NULL,reviewed_by=NULL,reviewed_at=NULL,updated_at=now()
  WHERE coaching.exercise_relationship_v1.reviewed_by IS NULL
    AND coaching.exercise_relationship_v1.review_status<>'approved';

  INSERT INTO coaching.exercise_score_calibration_v1(
    facility_id,variant_id,dimension,proposed_score,anchor_tier,rationale,status,
    version,created_by,reviewed_by,review_notes,reviewed_at)
  SELECT 1,exact_variant,d.dimension,
    CASE d.dimension WHEN 'technicalComplexity' THEN 22 ELSE 14 END,
    20,
    CASE d.dimension WHEN 'technicalComplexity' THEN
      'Review-only task-complexity anchor based on padded half-kneeling support, front heel and tripod contact, an uncounted endpoint setup, small partial retreat, same-endpoint readvance, breathing, quality gates, and exact pulse count.'
    ELSE
      'Review-only task physical-demand anchor based on unloaded bodyweight distribution, unilateral target-ankle dorsiflexion near a comfortable endpoint, front-foot control, rear-knee support, and no impact.'
    END||' This scores the exercise task, not the participant.',
    'review',1,NULL,NULL,
    'Research-informed proposal only; independent comparison and qualified human approval remain required.',NULL
  FROM (VALUES('technicalComplexity'),('absoluteLoadDemand')) d(dimension)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
    proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,reviewed_by=NULL,
    review_notes=EXCLUDED.review_notes,reviewed_at=NULL,updated_at=now();

  UPDATE coaching.exercise SET
    name='Half-Kneeling Ankle Dorsiflexion Pulse',
    slug='half-kneeling-ankle-dorsiflexion-pulse',
    description='Place the rear knee and lower leg on a pad and plant the target-side front foot through the heel, first metatarsal head, and fifth metatarsal head. Advance the front knee over the middle toes to a comfortable endpoint without lifting or spinning the foot; this first advance is setup, not a repetition. Retreat only a small declared distance without returning to the upright half-kneeling start, then re-advance to the same endpoint. Count one partial retreat-and-re-advance as one pulse.',
    instructions='Use the exact unloaded half-kneeling variant on a clean intact mat and nonslip floor. Pad the rear knee and lower leg, plant the front heel and tripod, and set a comfortable knee-forward endpoint. Do not count that first advance. Retreat a small distance, then re-advance to the same endpoint for one pulse. Change sides and rise under control. Stop for pain, pinching, instability, rear-knee discomfort, numbness, tingling, weakness, altered circulation, dizziness, faintness, nausea, visual change, chest pain, unusual breathlessness, unsafe mat or floor, or participant request.',
    skill_level=NULL,age_min=NULL,age_max=NULL,
    default_sets=1,default_reps=6,default_work_seconds=40,default_rest_seconds=20,
    tempo='controlled two to five seconds per partial-retreat and re-advance pulse',
    load_note='Track mat, floor, footwear, target side, side order, planned and actual valid pulses, initial uncounted endpoint, front-foot position, comfortable endpoint, retreat amplitude, tempo, pauses, rear-knee comfort, heel and tripod continuity, foot rotation, knee path, pelvis and trunk faults, hand loading, breathing, first fault, symptoms, invalid or partial attempts, weight-bearing dorsiflexion and kneeling time, rest, duration, substitution, side change, rise, exit, and overlapping foot ankle Achilles calf knee kneeling lunge squat landing sprint cutting kicking and balance exposure.',
    est_seconds_per_set=130,is_published=FALSE,archived=FALSE,
    card_summary='Padded rear-knee-supported, front-foot-planted ankle dorsiflexion pulse that stays near a comfortable endpoint.',
    coach_language='Verify the exact unloaded pulse, clean intact mat, nonslip floor, front-foot and rear-knee comfort, initial uncounted endpoint, small retreat, same-endpoint readvance, current symptoms and restrictions, planned pulses, actual exposure, first fault, duration, downstream ankle and lower-body budget, persistence, side change, rise, exit, and escalation.',
    athlete_language='Pad your back knee and keep your whole front foot down. Set a comfortable knee-forward endpoint; that first move is setup. Move back only a little, then return to the same endpoint for one pulse. Stop for pain, pinching, tingling, weakness, dizziness, instability, or rear-knee discomfort.',
    programming_logic=jsonb_build_object(
      'selectionStatus','canonical_variant_required','selectable',TRUE,
      'canonicalDefinitionId',canonical_definition,'exactVariantIds',to_jsonb(active_variant_ids),
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'exerciseDifficultyDescribesTaskOnly',TRUE,
      'selectionInputs',jsonb_build_array('workout purpose and delivery context','clean mat nonslip floor footwear station and exit','kneeling rear-knee front-foot ankle Achilles calf and front-knee tolerance','exact uncounted setup endpoint small-retreat readvance and pulse-count comprehension','pulse dose pace endpoint retreat rest side order and duration','cumulative ankle lower-leg kneeling lower-body landing sprint cutting kicking and balance exposure','coach scope and sightline'),
      'substitutionRevalidation',jsonb_build_array('identity','support contacts endpoint action and count','mat wall floor footwear equipment space side change rise and exit','restrictions and symptoms','purpose','dose','fatigue and impact budgets','duration','logistics','persistence','coach rendering','athlete rendering'),
      'legacySourceIds',jsonb_build_array(41),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    scalable_variables=ARRAY['comfortable_endpoint','partial_retreat_distance','front_foot_position','mat_thickness','light_fingertips_front_thigh','visual_knee_target','tempo','endpoint_pause','breathing_prompt','pulses','rest_seconds','sets','side_order','delivery_context']::TEXT[],
    movement_family='Half-kneeling ankle dorsiflexion end-range pulse',
    primary_phase_key='prepare_and_access',phase_subrole='mobilize',
    primary_order_slot='ankle_mobility',
    movement_requirements=jsonb_build_object(
      'impact_level',0,'balance_demand','low','postural_shape','half_kneeling_rear_knee_supported',
      'primary_tissues',jsonb_build_array('soleus','gastrocnemius','Achilles_tendon','ankle_and_foot_structures','rear_knee_contact_tissues'),
      'breathing_demand','continuous_relaxed_breathing','coordination_demand','low',
      'primary_joint_actions',jsonb_build_array('target_ankle_weight_bearing_dorsiflexion_near_endpoint','front_knee_small_flexion_and_extension','foot_tripod_control','rear_knee_isometric_support'),
      'supportContacts',jsonb_build_array('target_heel','target_first_metatarsal_head','target_fifth_metatarsal_head','contralateral_rear_knee','contralateral_rear_lower_leg_or_foot'),
      'exactSequence',jsonb_build_array('padded_half_kneeling_start','uncounted_endpoint_advance','small_partial_retreat','same_endpoint_readvance','one_pulse'),
      'exerciseDifficulty',jsonb_build_object('complexity',22,'physicalDifficulty',14,'overall',22,'formula','max')),
    coaching_execution=jsonb_build_object(
      'setup',jsonb_build_array('clean intact mat and nonslip floor','rear knee and lower leg comfortably supported','target-side front foot flat with heel and tripod supported','target knee aligned toward middle toes','comfortable starting position and clear side-change rise and exit'),
      'execution_steps',jsonb_build_array('advance front knee to a comfortable endpoint','do not count that initial advance','retreat only a small declared distance without returning upright','re-advance to the same endpoint','count one retreat-and-readvance as one pulse','change sides and rise under control'),
      'coach_cues',jsonb_build_array('pad back knee','whole front foot down','set endpoint','small retreat','same endpoint','one pulse','keep breathing'),
      'athlete_cues',jsonb_build_array('back knee comfortable','whole front foot stays down','first move is setup','small back and forward','no pinching'),
      'common_faults',jsonb_build_array('rear knee or mat shifting','front heel lifting','foot spinning outward','arch or tripod collapsing','knee leaving corridor','returning upright','endpoint or retreat drift','bouncing','meaningful hand unloading','counting the initial advance','adding a hold band weight elevation active lift or calf raise'),
      'quality_gate',jsonb_build_array('rear knee and lower leg supported','front heel and tripod supported','clean knee path','comfortable endpoint','small partial retreat','same-endpoint readvance','correct count','continuous breathing','no stop symptom'),
      'stop_signs',jsonb_build_array('sharp increasing night post-trauma or unfamiliar pain','front-ankle pinch Achilles front-knee or rear-knee pain that increases','instability giving way or uncontrolled collapse','numbness tingling weakness or circulation change','dizziness faintness nausea visual change chest pain unusual breathlessness or disorientation','unsafe mat floor footwear space rise or exit','participant stop request'),
      'breathing_cues',jsonb_build_array('breathe continuously','exhale gently during readvance if helpful','do not hold breath to force range'),
      'clinical_scope','This is a workout exercise, not a diagnostic half-kneeling dorsiflexion test, joint mobilization treatment, clearance, or proof of readiness.'),
    pairing_logic=jsonb_build_object(
      'sameSessionBudget',jsonb_build_array('valid_pulses_per_side','weight_bearing_dorsiflexion_seconds','kneeling_seconds','ankle_mobility_load','foot_tripod_support','calf_Achilles_exposure','technical_fatigue','downstream_lunge_squat_landing_sprint_cutting_kicking_and_lower_body_work','impact'),
      'avoidAutomaticPairingWith',jsonb_build_array('fatiguing_ankle_or_calf_work_before_priority_landing_sprint_cutting_or_kicking','symptom_provoking_weight_bearing_dorsiflexion_or_kneeling','same_session_ankle_or_lower_body_work_exceeding_budget'),
      'revalidateAfterSubstitution',TRUE),
    media_library=jsonb_build_object(
      'candidate_video_ids',jsonb_build_array('Kn-TjcmuzYQ','NrZ4NuSlJ88','wIUdrQsqhKs','yc27kCW8aco','1uk2j8TyHvk'),
      'reviewState','oembed_metadata_only_candidate_quarantine',
      'knownTitleMismatches',jsonb_build_array('wIUdrQsqhKs adds kettlebell load','1uk2j8TyHvk adds end-range activation'),
      'playbackUnloadedHalfKneelingExactPulseContactsEndpointsCountCaptionsAccessibilityQualitySafetyAndApprovalVerified',FALSE,
      'humanReviewRequired',TRUE),
    participant_structure='individual',programming_kind='exercise',linked_skill_id=NULL,
    why_publish_ready=FALSE,updated_at=now()
  WHERE id=41;

  UPDATE coaching.exercise_safety_profile SET
    risk_level=1,impact_level=0,minimum_age_recommended=NULL,
    minimum_skill_level=NULL,requires_spotting=FALSE,
    requires_coach_supervision='recommended',
    minimum_prerequisite_notes='Readiness uses safe kneeling entry side change rise and exit, clean intact mat and nonslip floor, comfortable rear-knee support, front heel and tripod contact, exact uncounted setup and pulse-count comprehension, current symptoms, communication, workout dose, and downstream ankle and lower-body loading; never participant classification or age.',
    readiness_checks=ARRAY[
      'Confirm exact unloaded half-kneeling variant, clean intact mat, nonslip floor, footwear, station and side-change clearance, sightline, communication, rise, and emergency route.',
      'Confirm front foot ankle Achilles calf front knee rear knee hip back and kneeling tolerance and no current symptom or restriction conflict.',
      'Confirm the participant understands rear-knee padding, front heel and tripod, knee path, comfortable endpoint, uncounted initial advance, small retreat, same-endpoint readvance, pulse count, stop signal, side change, rise, and exit.',
      'Review cumulative pulses, weight-bearing dorsiflexion and kneeling time, ankle and foot load, calf-Achilles exposure, technical fatigue, and later lunge squat landing sprint cutting kicking or lower-body demand.'
    ]::TEXT[],
    stop_signs=ARRAY[
      'Sharp, increasing, night, post-trauma, or unfamiliar pain, guarding, or participant stop request.',
      'Front foot, ankle, Achilles, calf, front knee, rear knee, hip, or back symptoms prevent exact support.',
      'Pinching, catching, painful clicking, instability, giving way, uncontrolled collapse, or inability to rise or exit safely.',
      'Numbness, tingling, weakness, altered circulation, loss of control, or another neurologic sign.',
      'Dizziness, faintness, nausea, visual change, chest pain, unusual breathlessness, disorientation, or inability to communicate.',
      'The mat or rear knee shifts, front heel lifts, tripod is lost, foot spins, or meaningful hand unloading occurs.',
      'Knee path, endpoint, small retreat, same-endpoint readvance, pelvis, trunk, breathing, or exact count cannot be restored despite reduced amplitude, pulses, or pace.',
      'Mat, floor, footwear, space, traffic, hygiene, sightline, communication, duration, budget, rise, or emergency route becomes inadequate.'
    ]::TEXT[],
    contraindications=ARRAY[
      'Current symptoms, trauma, procedure, instability, or clinical restrictions conflict with weight-bearing dorsiflexion, rear-knee support, or kneeling.',
      'No clean intact mat, nonslip floor, appropriate footwear, controlled entry side change rise and exit, sightline, communication, or emergency route.',
      'The intended service is diagnosis, treatment, injury management, readiness clearance, maximal clinical measurement, manual assistance, band mobilization, loaded mobilization, isometric press, full-return rocker, active dorsiflexor lift, calf raise, sport action, or another identity.'
    ]::TEXT[],
    common_substitutions=ARRAY[
      'Use Standing Knee-to-Wall Ankle Rocker only when the changed standing support and full-return count fit and all checks are rerun.',
      'Use Wall Ankle Dorsiflexion Iso Press, Ankle CARs, or Wall Lean Calf-Soleus Pulse only when the changed action and support fit and all checks are rerun.',
      'Do not infer that wall-supported, banded, loaded, elevated, active-lift, clinician-assisted, full-return, calf-raise, or clinical-test versions are equivalent.',
      'Author and review any changed-support, external-force, loaded, or added-action alternative before selection.'
    ]::TEXT[]
  WHERE exercise_id=41;

  UPDATE coaching.exercise_score_v1 SET
    technical_complexity=22,absolute_load_demand=14,coordination_demand=20,
    impact=1,supervision_demand=14,base_overall_difficulty=greatest(22,14),
    legacy_scores=coalesce(legacy_scores,'{}'::JSONB)||jsonb_build_object(
      'candidateReassessment',migration_key,
      'projectionScope','rear_knee_supported_unloaded_end_range_pulse_exact_variant',
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'variantScores',jsonb_build_object('halfKneelingEndRangePulse',
        jsonb_build_object('complexity',22,'physicalDifficulty',14,'overall',22)),
      'exerciseScoresDescribeTaskOnly',TRUE,'independentCalibrationRequired',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    migration_confidence=58,human_review_status='queued',reviewed_by=NULL,reviewed_at=NULL,
    review_notes='Research-informed candidate reassessment only. Scores describe exercise complexity and physical difficulty, not participant classification, age, readiness, or proficiency. Exact rear-knee support, front-foot contacts, pulse endpoints and count, and independent calibration remain required.',
    updated_at=now()
  WHERE exercise_id=41;

  UPDATE coaching.exercise_difficulty_profile SET
    technical=2.2,complexity=2,load=1.4,overall=2.2,
    recommended_age_min=NULL,recommended_age_max=NULL,attention_demand='low',
    notes='Candidate projection from the exact rear-knee-supported unloaded end-range pulse. Complexity is 22/100, physical difficulty 14/100, and overall 22/100 by maximum. This is not participant classification, readiness, age, or proficiency.',
    source='canonical_research_candidate',updated_at=now()
  WHERE exercise_id=41;

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  VALUES(canonical_definition,1,2,'2.0.0',migration_key,'quarantined',
    jsonb_build_object(
      'identity',jsonb_build_object('passed',TRUE,'identityKey','rear_knee_and_lower_leg_padded_front_target_foot_tripod_fixed_initial_endpoint_setup_partial_retreat_and_readvance_pulse','legacySources',1,'activeVariants',1,'archivedSourceSkeletons',1,'neighborBoundaries',5),
      'taxonomy',jsonb_build_object('passed',TRUE,'controlledTerms',TRUE,'movementPatterns',jsonb_build_array('squat','brace'),'bodyRegions',jsonb_build_array('foot','ankle','calf','knee','hip','core'),'equipment',jsonb_build_array('mat')),
      'anatomy',jsonb_build_object('passed',TRUE,'musclesJointsActionsPlanesLateralityContactsSequenceAndWholeChainBoundary',TRUE),
      'difficulty',jsonb_build_object('passed',TRUE,'model','max_exercise_complexity_physical_difficulty','variantVectors',jsonb_build_array('22/14/22'),'participantClassificationAbsent',TRUE,'independentCalibrationRequired',TRUE),
      'loadFatigueRecovery',jsonb_build_object('passed',TRUE,'actualPulsesEndpointRetreatContactsFaultSymptomsKneelingAndOverlappingAnkleLowerBodyExposureTracked',TRUE,'impactNone',TRUE,'recoveryIsPlanningEstimate',TRUE),
      'constraints',jsonb_build_object('passed',TRUE,'matFloorFootwearRearKneeFrontFootSymptomsRestrictionsSpaceTrafficRiseScopeAndEmergencyRoute',TRUE),
      'delivery',jsonb_build_object('passed',TRUE,'profiles',2,'prepareAndRestore',TRUE,'durationDoseRestPadSetupSideChangeRiseExitAndSubstitutionRevalidation',TRUE),
      'instructions',jsonb_build_object('passed',TRUE,'athleteCoachAccessibilityAndSupportOperations',TRUE,'uncountedSetupEndpointPartialRetreatReadvanceCountSymptomsKneelingAndClinicalScope',TRUE),
      'research',jsonb_build_object('passed',TRUE,'sections',16,'registryVersion',research_version,'directAndAdjacentEvidenceSeparated',TRUE,'exampleDoseNotUniversal',TRUE),
      'media',jsonb_build_object('passed',FALSE,'candidateCount',5,'currentOEmbedMetadataHealthy',TRUE,'playbackReviewed',FALSE,'exactUnloadedPulseReviewed',FALSE,'knownTitleMismatches',2,'captionsAccessibilityQualitySafetyAndApprovalReviewed',FALSE),
      'relationships',jsonb_build_object('passed',FALSE,'reviewOnly',4,'approved',0,'automaticSubstitution',FALSE),
      'calibration',jsonb_build_object('passed',FALSE,'reviewOnly',2,'approved',0),
      'alternates',jsonb_build_object('passed',TRUE,'assessments',24,'sameIdentity',2,'modifierAnnotations',8,'newVariants',7,'newDefinitions',7,'singleExactVariant',TRUE),
      'generationSupport',jsonb_build_object('passed',TRUE,'selectionConstraints',TRUE,'cumulativeFatigueAndImpactBudgets',TRUE,'duration',TRUE,'matKneelingSideChangeRiseAndExit',TRUE,'substitutionRevalidation',TRUE,'renderingAndPersistence',TRUE),
      'publication',jsonb_build_object('passed',FALSE,'reviewer',NULL,'approver',NULL)),
    jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01','message','A qualified human must watch all five candidates in full and verify playback, unloaded half-kneeling support, exact rear-knee and front-foot contacts, initial uncounted advance, partial retreat, same-endpoint readvance, count, captions, accessibility, cue quality, safety, conflicts, reviewer identity, timestamp, card version, and approval rationale. The kettlebell and active-lift title mismatches cannot be approved for the exact variant without contrary full-review evidence.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','A qualified coach must approve or reject all four relationships; no automatic substitution to standing, isometric, circular, plantarflexor, full-return, wall-supported, banded, loaded, elevated, activation, calf-raise, clinical, or sport-action tasks is authorized.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','An independent qualified reviewer must calibrate exercise complexity 22 and physical difficulty 14. Scores do not classify a participant or create an age, readiness, or proficiency level.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','A qualified reviewer and separate approver must complete content review before publication. Pulse identity, anatomy, whole-chain loading, rear-knee and mat safety, clinical scope, dose, stop, accessibility, persistence, restore context, and support rules remain quarantined.')),
    TRUE,now())
  ON CONFLICT(definition_id) DO UPDATE SET
    facility_id=EXCLUDED.facility_id,card_version=EXCLUDED.card_version,
    schema_version=EXCLUDED.schema_version,audit_version=EXCLUDED.audit_version,
    status='quarantined',checks_json=EXCLUDED.checks_json,
    blocking_issues_json=EXCLUDED.blocking_issues_json,
    human_review_required=TRUE,checked_at=now();

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition AND status='review' AND card_version=2
        AND schema_version='2.0.0' AND approved_video_url IS NULL
        AND reviewed_by IS NULL AND approved_by IS NULL AND last_reviewed_at IS NULL
        AND movement_patterns=ARRAY['squat','brace']::TEXT[]
        AND required_equipment=ARRAY['mat']::TEXT[]
        AND anatomy_json<>'{}'::JSONB AND environment_json<>'{}'::JSONB
        AND population_json<>'{}'::JSONB AND athlete_support_json<>'{}'::JSONB
        AND coach_support_json<>'{}'::JSONB AND support_operations_json<>'{}'::JSONB
        AND provenance_json->>'approvalsCreated'='false')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source_variant AND status='archived'
        AND requirements_json->>'representation'='superseded_source_skeleton')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=exact_variant AND definition_id=canonical_definition AND status='review'
        AND requirements_json->>'selectable'='true'
        AND (difficulty_json->>'technicalComplexity')::INTEGER=22
        AND (difficulty_json->>'physicalDifficulty')::INTEGER=14
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=greatest(22,14)
        AND (difficulty_json->>'coordinationDemand')::INTEGER=20
        AND (difficulty_json->>'supervisionDemand')::INTEGER=14
        AND (difficulty_json->>'failureConsequence')::INTEGER=14
        AND (difficulty_json->>'impact')::INTEGER=1
        AND (difficulty_json->>'workCapacityDemand')::INTEGER=14
        AND (load_profile_json->>'gripDemand')::INTEGER=1
        AND (load_profile_json->>'landingContactsPerRep')::INTEGER=0
        AND (fatigue_profile_json->>'gripFatigue')::INTEGER=1
        AND (fatigue_profile_json->>'impactAccumulation')::INTEGER=1
        AND (fatigue_profile_json->'cumulativeBudget'->>'impact')::INTEGER=0
        AND programming_profile_json->>'publicationQuarantined'='true') THEN
    RAISE EXCEPTION '% definition variant source or quarantine assertion failed',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=exact_variant AND status='review'
        AND equipment_required=ARRAY['mat']::TEXT[]
        AND coalesce(time_model_json->>'durationFormula','')<>''
        AND dose_scaling_json<>'{}'::JSONB AND measurement_json<>'{}'::JSONB
        AND support_prompts_json<>'{}'::JSONB AND length(coach_instructions)>=100
        AND length(athlete_instructions) BETWEEN 10 AND 400
        AND cardinality(stop_rules)>=8)<>2
    OR (SELECT count(DISTINCT section_key) FROM coaching.exercise_section_evidence_v1
      WHERE definition_id=canonical_definition AND reviewed_card_version=2
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>16
    OR (SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=canonical_definition AND reviewed_card_version=2
        AND link_status='healthy' AND review_status='candidate' AND embedding_allowed
        AND captions_available IS NULL AND exact_variant_match IS NULL
        AND demonstration_quality_score IS NULL AND reviewer_user_id IS NULL
        AND reviewed_at IS NULL)<>5
    OR (SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id=canonical_definition AND reviewed_card_version=2
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>24
    OR (SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE from_variant_id=exact_variant
        AND review_status='review' AND reviewed_by IS NULL)<>4
    OR (SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=exact_variant AND status='review' AND reviewed_by IS NULL)<>2
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=canonical_definition
        AND decision='distinct_exercises' AND reviewed_by IS NULL)<>5 THEN
    RAISE EXCEPTION '% authored row-count or quarantine assertion failed',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 d
      CROSS JOIN LATERAL unnest(d.movement_patterns) key
      WHERE d.id=canonical_definition
        AND NOT EXISTS(SELECT 1 FROM coaching.movement_pattern allowed WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 d
      CROSS JOIN LATERAL unnest(d.body_regions) key
      WHERE d.id=canonical_definition
        AND NOT EXISTS(SELECT 1 FROM coaching.body_region allowed WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 v
      CROSS JOIN LATERAL jsonb_array_elements_text(v.requirements_json->'equipment') key
      WHERE v.id=exact_variant
        AND NOT EXISTS(SELECT 1 FROM coaching.equipment allowed WHERE allowed.key=key)) THEN
    RAISE EXCEPTION '% uncontrolled taxonomy was authored',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1 r
      CROSS JOIN LATERAL unnest(r.dimensions) dimension
      WHERE r.from_variant_id=exact_variant
        AND dimension<>ALL(ARRAY['load','leverage','range','speed','stability','complexity','impact','decision_demand','fatigue']))
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1
      WHERE from_variant_id=exact_variant AND review_status='approved') THEN
    RAISE EXCEPTION '% relationship dimension or approval assertion failed',migration_key;
  END IF;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=41
      AND skill_level IS NULL AND age_min IS NULL AND age_max IS NULL
      AND linked_skill_id IS NULL AND is_published=FALSE AND archived=FALSE
      AND programming_kind='exercise' AND why_publish_ready=FALSE)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1
      WHERE exercise_id=41 AND technical_complexity=22
        AND absolute_load_demand=14 AND coordination_demand=20
        AND impact=1 AND supervision_demand=14 AND base_overall_difficulty=22
        AND human_review_status='queued' AND reviewed_by IS NULL AND reviewed_at IS NULL)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_difficulty_profile
      WHERE exercise_id=41 AND technical=2.2 AND complexity=2
        AND load=1.4 AND overall=2.2 AND recommended_age_min IS NULL
        AND recommended_age_max IS NULL)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_safety_profile
      WHERE exercise_id=41 AND minimum_age_recommended IS NULL
        AND minimum_skill_level IS NULL)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=canonical_definition AND card_version=2
        AND status='quarantined' AND human_review_required=TRUE
        AND jsonb_array_length(blocking_issues_json)=4) THEN
    RAISE EXCEPTION '% legacy projection or packet assertion failed: %',migration_key,
      jsonb_build_object(
        'exercise',EXISTS(SELECT 1 FROM coaching.exercise WHERE id=41
          AND skill_level IS NULL AND age_min IS NULL AND age_max IS NULL
          AND linked_skill_id IS NULL AND is_published=FALSE AND archived=FALSE
          AND programming_kind='exercise' AND why_publish_ready=FALSE),
        'score',EXISTS(SELECT 1 FROM coaching.exercise_score_v1
          WHERE exercise_id=41 AND technical_complexity=22
            AND absolute_load_demand=14 AND coordination_demand=20
            AND impact=1 AND supervision_demand=14 AND base_overall_difficulty=22
            AND human_review_status='queued' AND reviewed_by IS NULL AND reviewed_at IS NULL),
        'difficulty',EXISTS(SELECT 1 FROM coaching.exercise_difficulty_profile
          WHERE exercise_id=41 AND technical=2.2 AND complexity=2
            AND load=1.4 AND overall=2.2 AND recommended_age_min IS NULL
            AND recommended_age_max IS NULL),
        'safety',EXISTS(SELECT 1 FROM coaching.exercise_safety_profile
          WHERE exercise_id=41 AND minimum_age_recommended IS NULL
            AND minimum_skill_level IS NULL),
        'packet',EXISTS(SELECT 1 FROM coaching.exercise_card_test_packet_v1
          WHERE definition_id=canonical_definition AND card_version=2
            AND status='quarantined' AND human_review_required=TRUE
            AND jsonb_array_length(blocking_issues_json)=4));
  END IF;
END
$migration$;
