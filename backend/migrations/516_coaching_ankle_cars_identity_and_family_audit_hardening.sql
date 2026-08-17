-- Source 42: replace the mixed-base Ankle CAR skeleton with one exact seated,
-- actively controlled ankle-joint-complex circuit. Standing, alternate-body-
-- position, resisted, loaded, passive, weight-bearing, pump, alphabet, calf,
-- assessment, and sport tasks remain distinct. Evidence, media, graph,
-- calibration, content, and publication authority remain human-only.
-- Difficulty describes the exercise task, never participant proficiency.
DO $migration$
DECLARE
  migration_key CONSTANT TEXT := '516_coaching_ankle_cars_identity_and_family_audit_hardening';
  research_version CONSTANT TEXT := '2026-08-09.109';
  canonical_definition UUID; source_variant UUID; exact_variant UUID;
  active_variant_ids UUID[]; all_owned_variant_ids UUID[];
  full_body_definition UUID; full_body_variant UUID; rocker_definition UUID; rocker_variant UUID;
  tibialis_definition UUID; tibialis_variant UUID; calf_raise_definition UUID; calf_raise_variant UUID;
  toe_yoga_definition UUID; toe_yoga_variant UUID;
  protected_count INTEGER;
BEGIN
  SELECT id INTO canonical_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=42;
  SELECT id INTO source_variant FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='baseline';
  SELECT coalesce((SELECT id FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='seated-thigh-supported-active-ankle-circuit'),gen_random_uuid()) INTO exact_variant;
  SELECT id INTO full_body_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=23;
  SELECT id INTO full_body_variant FROM coaching.exercise_variant_v1 WHERE definition_id=full_body_definition AND variant_key='standing-independent-eight-region-sequence';
  SELECT id INTO rocker_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=40;
  SELECT id INTO rocker_variant FROM coaching.exercise_variant_v1 WHERE definition_id=rocker_definition AND variant_key='standing-knee-to-wall-forward-return-cycle';
  SELECT id INTO tibialis_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=43;
  SELECT id INTO tibialis_variant FROM coaching.exercise_variant_v1 WHERE definition_id=tibialis_definition AND variant_key='baseline';
  SELECT id INTO calf_raise_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=44;
  SELECT id INTO calf_raise_variant FROM coaching.exercise_variant_v1 WHERE definition_id=calf_raise_definition AND variant_key='baseline';
  SELECT id INTO toe_yoga_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=45;
  SELECT id INTO toe_yoga_variant FROM coaching.exercise_variant_v1 WHERE definition_id=toe_yoga_definition AND variant_key='baseline';
  active_variant_ids:=ARRAY[exact_variant]; all_owned_variant_ids:=ARRAY[source_variant,exact_variant];

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=42 AND facility_id=1)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition AND facility_id=1 AND legacy_exercise_id=42)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=42 AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source_variant AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=full_body_variant AND definition_id=full_body_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=rocker_variant AND definition_id=rocker_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=tibialis_variant AND definition_id=tibialis_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=calf_raise_variant AND definition_id=calf_raise_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=toe_yoga_variant AND definition_id=toe_yoga_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1 WHERE exercise_id=42)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_difficulty_profile WHERE exercise_id=42)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_safety_profile WHERE exercise_id=42) THEN
    RAISE EXCEPTION '% prerequisite source or neighbor rows are missing',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=exact_variant AND definition_id<>canonical_definition)
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE slug='ankle-cars' AND id<>canonical_definition) THEN
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
      WHERE exercise_id=42
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
      'researchVersion',research_version,'sourceDisposition','canonical_ankle_cars_reauthored',
      'exactWorkingSpecification','seated_thigh_supported_active_ordered_ankle_circuit_each_direction_counted_separately',
      'exerciseDifficultyDescribesTaskOnly',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=42 AND definition_id=canonical_definition;

  UPDATE coaching.exercise_delivery_profile_v1 SET status='archived',updated_at=now()
  WHERE variant_id=source_variant;
  UPDATE coaching.exercise_variant_v1 SET
    variant_key='superseded-source-42-mixed-base-skeleton',
    display_name='Ankle CARs Mixed-Base Legacy Skeleton — Source 42',
    modifier_keys='{}'::TEXT[],difficulty_json='{}'::JSONB,status='archived',
    requirements_json=jsonb_build_object(
      'selectable',FALSE,'representation','superseded_source_skeleton',
      'sourceLegacyExerciseId',42,
      'archiveReason','seated standing and supported bases were mixed and exact support path start endpoint direction count anatomy load fatigue duration constraints substitutions persistence and review contracts were missing',
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
    canonical_definition,1,42,'ankle-cars','Ankle CARs','Ankle CARs',
    ARRAY['Seated Ankle CARs','Seated Active Ankle Circumduction','Ankle Controlled Articular Rotations'],
    'Sit on a stable bench with the non-target foot planted, the target thigh supported, and the target foot clear of the floor. Lightly monitor the thigh and tibia without moving the foot. From a declared comfortable dorsiflexed start, actively trace one slow circuit through inversion, plantarflexion, eversion, and back to the same start while the tibia, knee, pelvis, and trunk remain quiet; that closed circuit is one repetition. Reverse the ordered path for the other direction. Range, knee angle, light monitoring, trace cue, direction order, tempo, brief non-forced pauses, breathing, dose, rest, and context are annotations. Standing, another body position, resistance, load, passive force, weight bearing, isometric holds, pumps, alphabet tracing, calf raises, assessment, or sport action changes the task.',
    'seated_active_ankle_controlled_articular_rotation','2.0.0',2,'review',86,58,50,
    ARRAY['rotate','brace']::TEXT[],
    ARRAY['foot','ankle','lower_leg','knee','thigh','core']::TEXT[],
    ARRAY['bench']::TEXT[],ARRAY['none']::TEXT[],
    jsonb_build_object(
      'surface','clean flat dry stable nonslip floor with an intact stable bench',
      'space','one seated station with target-foot clearance side-change transfer and exit space no cross traffic and a clear emergency route',
      'stationCapacity',1,'equipmentKey','bench','optionalEquipment',jsonb_build_array('none'),
      'coachSightline','front-quarter and side views of bench thigh foot clearance tibia knee pelvis trunk ordered path breathing and symptoms',
      'inspection',jsonb_build_array('bench integrity stability cleanliness height and placement','floor traction cleanliness and debris','target-foot clearance','non-target-foot support','neighbor and cross-traffic separation','transfer exit sightline communication and emergency route'),
      'changeRule','Any base support vision assistance resistance load contact path endpoint count dose symptom space or downstream-demand change requires full revalidation.'),
    jsonb_build_object(
      'exerciseCardDoesNotClassifyParticipants',TRUE,'readinessIsWorkoutInput',TRUE,
      'selectionPrerequisites',jsonb_build_array('safe controlled sit side change stand and exit','stable inspected bench and nonslip floor','comfortable target-thigh support and target-foot clearance','comfortable active ankle motion in the ordered path','can keep tibia knee pelvis and trunk sufficiently quiet','understands circuit start direction count reverse and stop signal','same-session foot ankle lower-leg calf balance landing sprint cutting kicking and lower-body budgets fit'),
      'excludeOrEscalate',jsonb_build_array('recent significant trauma surgery or procedure without applicable clearance','worsening night post-trauma sharp increasing or unfamiliar pain','new numbness tingling weakness altered circulation or loss of control','foot ankle Achilles calf shin knee hip or back symptoms preventing exact task','inability to sit change sides stand or exit safely','dizziness faintness nausea visual change chest pain unusual breathlessness disorientation or inability to communicate','clinical restriction conflicting with active ankle motion','unsafe bench floor space traffic sightline or emergency route','participant requests stop'),
      'notEstablishedByEvidence',jsonb_build_array('universal eligibility normal circle ideal range knee angle path or joint contribution','diagnosis treatment prevention correction readiness clearance or clinical threshold','isolated talocrural subtalar tissue or joint motion','one universal dose frequency fatigue ceiling recovery progression or warm-up outcome','guaranteed balance landing sprint cutting kicking or performance transfer','age floor or participant classification')),
    jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'canonicalAuthoredFromResearch',TRUE,
      'primaryIdentitySource','https://www.acefitness.org/continuing-education/certified/october-2024/8725/controlled-articular-rotations-shifting-mobility-into-high-gear/',
      'legacySources',jsonb_build_array(42),
      'identityContract','seated_stable_bench_target_thigh_supported_foot_clear_active_dorsiflexion_inversion_plantarflexion_eversion_closed_circuit_then_reverse',
      'researchSources',jsonb_build_array(
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC1550229/',
        'https://pubmed.ncbi.nlm.nih.gov/8423170/',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC4994968/',
        'https://www.acefitness.org/continuing-education/certified/october-2024/8725/controlled-articular-rotations-shifting-mobility-into-high-gear/',
        'https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en'),
      'confidenceBySection',jsonb_build_object('identity',86,'taxonomy',84,'anatomy',76,'difficulty',58,'load',68,'fatigueRecovery',50,'constraints',80,'dosage',52,'instructions',84,'alternates',90,'media',50),
      'unresolvedClaims',jsonb_build_array('one universal seated geometry range path tempo dose frequency fatigue ceiling recovery progression or outcome','numeric difficulty calibration','media playback exact support ordered circuit direction count captions accessibility quality safety and approval','individual symptom interpretation or clinical eligibility'),
      'externalPlaybackVerificationPerformed',FALSE,'sourceLimitationsExplicit',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,'publicationQuarantined',TRUE),
    NULL,NULL,NULL,NULL,
    jsonb_build_object(
      'primaryMuscles',jsonb_build_array('tibialis_anterior','gastrocnemius','soleus','tibialis_posterior','fibularis_group'),
      'secondaryMuscles',jsonb_build_array('toe_extensors_and_flexors','intrinsic_foot_muscles','knee_and_thigh_stabilizers','hip_and_trunk_stabilizers'),
      'joints',jsonb_build_array('interphalangeal_and_metatarsophalangeal','midfoot','subtalar','talocrural_ankle','distal_tibiofibular_complex','knee','hip','lumbopelvic_complex'),
      'jointActions',jsonb_build_array('active_ankle_dorsiflexion','active_foot_and_ankle_inversion','active_ankle_plantarflexion','active_foot_and_ankle_eversion','coupled_multiplanar_foot_motion','tibia_knee_pelvis_and_trunk_stabilization'),
      'planes',jsonb_build_array('sagittal','frontal','transverse','multiplanar_stabilization'),
      'laterality','unilateral target ankle with each side and direction recorded',
      'supportContacts',jsonb_build_array('pelvis_on_bench','target_posterior_thigh_on_bench','non_target_foot_on_floor','light_non_assisting_hands_on_target_thigh_or_tibia_optional'),
      'sequence',jsonb_build_array('seated_supported_start','target_foot_clear','declared_comfortable_dorsiflexed_start','active_inversion','active_plantarflexion','active_eversion','return_to_same_dorsiflexed_start_one_circuit','reverse_order_for_other_direction'),
      'claimsBoundary','The visible foot circle is coupled ankle-joint-complex motion and does not isolate one axis joint or tissue. Anatomy labels are plausible task demands, not diagnosis treatment ideal alignment threshold or outcome.'),
    jsonb_build_object(
      'plainLanguageSummary','Sit securely, keep your thigh and lower leg quiet, lift the working foot clear, and slowly draw one smooth ankle circle in each direction.',
      'expectedSensations',jsonb_build_array('light effort around the foot ankle and lower leg','gentle non-forced stretch at parts of the path','steady seated support and normal breathing'),
      'unexpectedSensations',jsonb_build_array('sharp increasing or unfamiliar pain','painful pinching catching clicking instability or cramping that does not ease','numbness tingling weakness or circulation change','dizziness faintness nausea visual change chest pain or unusual breathlessness'),
      'selfCheck',jsonb_build_array('bench_and_thigh_stay_stable','working_foot_stays_clear','tibia_knee_pelvis_and_trunk_stay_quiet','path_follows_declared_order','circuit_returns_to_same_start','each_direction_counted_separately','breathing_continues','stop_signal_available'),
      'permissionToScaleOrStop','Use a smaller comfortable active circle, slower pace, fewer circuits, or more rest. Stop and tell the coach whenever pain, pinching, catching, cramping, sensation, circulation, balance, breathing, vision, or confidence changes.'),
    jsonb_build_object(
      'prebrief',jsonb_build_array('confirm exact seated unloaded active circuit and no standing resistance load passive force weight bearing pump alphabet calf raise or assessment','inspect bench floor foot clearance space and exit','screen current symptoms restrictions transfer and active ankle tolerance','set side direction order circuits range pace duration and downstream budgets'),
      'observation',jsonb_build_array('bench pelvis thigh non-target foot and target-foot clearance','tibia knee pelvis and trunk movement','ordered path start endpoint direction and closed-circuit count','toe gripping or substitution','pace breathing effort cramping symptoms first fault actual seconds transfer and exit'),
      'cueHierarchy',jsonb_build_array('sit_stable','foot_clear','quiet_leg','pull_up','turn_in','point_down','turn_out','return_to_start','reverse','keep_breathing'),
      'scopeBoundary','Coach observable setup action count exposure and stop rules; do not diagnose restriction instability or pathology, interpret a clinical range threshold, provide treatment, promise prevention, infer clearance, or force range.'),
    jsonb_build_object(
      'accessibility',jsonb_build_array('front-quarter and side demonstration','written ordered-path diagram','visual toe-trace cue without contact','smaller active range slower pace fewer circuits and more rest','light non-assisting hand monitoring','captions transcript still images or live instruction','separately validated alternative if seated transfer bench support vision or active motion does not fit'),
      'persistence',jsonb_build_object('record',jsonb_build_array('definition_variant_profile_card_version','bench_floor_space','side_direction_order','planned_and_actual_valid_circuits','range_tempo_pauses_rest','invalid_partial_and_symptom_limited_attempts','first_fault','symptoms_stop_reason','actual_seconds','substitution','transfer_station_reset_and_exit'),'neverPersistAs',jsonb_build_array('clinical_range_measurement','diagnosis','readiness_clearance','participant_skill_level')),
      'incidentResponse',jsonb_build_array('stop','stabilize_seated_position','assist_safe_transfer_or_exit_within_scope','follow_facility_emergency_and_reporting_policy','record_observed_facts','do_not_resume_without_reassessment'),
      'supportBoundary','Offer instruction communication and safe exercise alternatives within scope; refer clinical questions or persistent concerning symptoms through facility policy.'))
  ON CONFLICT(id) DO UPDATE SET
    facility_id=EXCLUDED.facility_id,legacy_exercise_id=EXCLUDED.legacy_exercise_id,
    slug=EXCLUDED.slug,canonical_name=EXCLUDED.canonical_name,
    display_name=EXCLUDED.display_name,aliases=EXCLUDED.aliases,
    description=EXCLUDED.description,family_key=EXCLUDED.family_key,
    schema_version=EXCLUDED.schema_version,card_version=EXCLUDED.card_version,
    status='review',content_confidence=EXCLUDED.content_confidence,
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
    exact_variant,canonical_definition,'seated-thigh-supported-active-ankle-circuit',
    'Seated Thigh-Supported Active Ankle CAR',
    ARRAY['active_range','knee_angle','monitoring_contact','visual_trace','direction_order','tempo','brief_pause','breathing','circuits','sets','rest','side_order','delivery_context'],
    jsonb_build_object(
      'technicalComplexity',24,'absoluteLoadDemand',12,'physicalDifficulty',12,
      'coordinationDemand',22,'supervisionDemand',12,'failureConsequence',10,
      'impact',1,'workCapacityDemand',10,'baseOverallDifficulty',greatest(24,12),
      'overallFormula','max(exercise_complexity,physical_difficulty)',
      'exerciseDifficultyDescribesTaskOnly',TRUE,
      'candidateCalibrationOnly',TRUE,'humanReviewRequired',TRUE),
    jsonb_build_object(
      'selectable',TRUE,'equipment',jsonb_build_array('bench'),
      'base','seated_stable_bench_target_thigh_supported_target_foot_clear',
      'supportContacts',jsonb_build_array('pelvis_on_bench','target_posterior_thigh_on_bench','non_target_foot_on_floor','optional_light_non_assisting_hand_monitoring'),
      'targetFootRule','target foot remains clear of floor and moves actively without external assistance resistance or load',
      'exactSequence',jsonb_build_array('declared_comfortable_dorsiflexed_start','inversion','plantarflexion','eversion','same_dorsiflexed_start','one_circuit','reverse_order_other_direction'),
      'countingRule','one complete ordered closed circuit returning to the declared start is one repetition in that direction; reverse direction is counted separately',
      'validCompletion','bench thigh and non-target foot remain supported target foot remains clear tibia knee pelvis and trunk remain sufficiently quiet the active path follows the declared order and returns to the same start breathing continues and no stop rule occurs',
      'invalidCompletion',jsonb_build_array('target_foot_contacts_floor_or_object','tibia_or_knee_rotates_to_create_path','pelvis_or_trunk_compensation','wrong_or_incomplete_order','does_not_return_to_declared_start','passive_hand_or_clinician_force','added_resistance_or_load','standing_or_weight_bearing','forced_range_or_sustained_isometric','pump_alphabet_calf_raise_or_assessment_action','breath_hold','symptom_stop'),
      'variantBoundaries',jsonb_build_array('base_position','support_contacts','vision','external_force','external_load','passive_assistance','weight_bearing','path','start_endpoint','action_order','isometric_hold','clinical_measurement','count'),
      'clinicalAssessmentOrTreatment',FALSE,'humanReviewRequired',TRUE),
    'review',
    jsonb_build_object(
      'loadingType','unloaded_active_non_weight_bearing_multiplanar_ankle_joint_complex_circuit',
      'externalLoadMethod','none_active_foot_and_ankle_motion_with_seated_support',
      'gripDemand',1,'jointStress',12,'spinalLoading',1,'eccentricStress',8,
      'landingContactsPerRep',0,'handImpactContactsPerRep',0,'impactClass','none',
      'primaryExposure',jsonb_build_array('active_dorsiflexion','active_inversion','active_plantarflexion','active_eversion','foot_and_lower_leg_motor_control','quiet_tibia_knee_pelvis_and_trunk','ordered_path_attention'),
      'tracking',jsonb_build_array('variant_and_profile','bench_floor_and_space','side_and_direction_order','planned_and_actual_valid_circuits','active_range_tempo_and_pauses','valid_invalid_partial_and_symptom_limited_attempts','foot_clearance_tibia_knee_pelvis_trunk_path_endpoint_and_count_faults','first_fault','symptoms','rest','duration','same_session_ankle_lower_leg_balance_lower_body_and_sport_exposure')),
    jsonb_build_object(
      'localMuscleFatigue',12,'gripFatigue',1,'technicalFatigueSensitivity',24,
      'impactAccumulation',1,'recoveryHours',6,'recoveryRangeHours',jsonb_build_array(3,12),
      'primaryFatigueSites',jsonb_build_array('foot_and_ankle_movers','lower_leg_muscles','thigh_and_postural_stabilizers','attention_to_path_direction_and_count'),
      'cumulativeBudget',jsonb_build_object('circuitsPerDirectionPerSide',15,'activeAnkleMotionSecondsPerSide',240,'ankleMobilityLoad',24,'lowerLegExposure',20,'technicalSensitivity',24,'impact',0),
      'interference',jsonb_build_array('later_high_priority_balance_landing_sprint_cutting_kicking_or_ankle_work','same_session_foot_ankle_Achilles_calf_shin_or_lower_leg_loading','fatigue_that_changes_foot_clearance_quiet_leg_ordered_path_endpoint_or_count'),
      'recoveryIsPlanningEstimate',TRUE,'tissueThresholdNotEstablished',TRUE),
    jsonb_build_object(
      'trainingStimuli',jsonb_build_array('seated_active_multiplanar_ankle_control','ordered_ankle_joint_complex_path','quiet_lower_leg_and_trunk_control'),
      'stimulusDose',jsonb_build_object('sets',jsonb_build_array(1,3),'circuitsPerDirectionPerSide',jsonb_build_array(2,5),'secondsPerCircuit',jsonb_build_array(4,10),'restSeconds',jsonb_build_array(10,45)),
      'weeklyExposure',jsonb_build_object('minimum',0,'maximumWithoutReview',7,'unit','sessions','contextDependent',TRUE),
      'prerequisites',jsonb_build_array('safe_seated_transfer_side_change_and_exit','stable_inspected_bench_and_nonslip_floor','target_thigh_support_and_target_foot_clearance','comfortable_active_ordered_ankle_path','quiet_tibia_knee_pelvis_and_trunk','understands_start_direction_reverse_count_and_stop','same_session_ankle_lower_leg_balance_lower_body_and_sport_budgets_fit'),
      'completionCriteria',jsonb_build_array('stable_bench_pelvis_thigh_and_non_target_foot','target_foot_clear','quiet_tibia_knee_pelvis_and_trunk','comfortable_active_range','correct_ordered_path','same_start_and_endpoint','direction_recorded','continuous_breathing','no_stop_symptoms'),
      'sequenceRules',jsonb_build_array('prepare_and_access_or_restore_context_only','count_each_complete_directional_circuit_separately','do_not_turn_range_knee_angle_monitoring_trace_tempo_pause_breathing_dose_side_order_or_context_into_hidden_variants','do_not_add_standing_alternate_base_closed_eyes_resistance_load_passive_force_weight_bearing_hold_pump_alphabet_calf_raise_assessment_or_sport_action_silently','revalidate_downstream_foot_ankle_lower_leg_balance_landing_sprint_cutting_kicking_and_lower_body_load'),
      'pairingCompatibility',jsonb_build_object('compatible',jsonb_build_array('low_load_ankle_preparation_or_restore_when_all_support_symptom_time_and_fatigue_budgets_fit'),'avoid',jsonb_build_array('fatiguing_ankle_or_lower_leg_work_before_priority_balance_landing_sprint_cutting_or_kicking','symptom_provoking_active_ankle_motion','time_critical_work_when_bench_setup_or_reassessment_displaces_priority_training')),
      'interferenceRules',jsonb_build_array('count_all_overlapping_ankle_mobility_lower_leg_balance_landing_sprint_cutting_and_kicking_work','stop_before_foot_clearance_quiet_leg_ordered_path_endpoint_direction_count_or_transfer_changes'),
      'uncertaintyPolicy','When exact seated support foot clearance active path direction count symptoms bench safety or available time is uncertain do not select; request clarification or choose a separately validated card.',
      'selectionStatus','review_only_machine_complete','publicationQuarantined',TRUE,
      'exerciseDifficultyDescribesTaskOnly',TRUE,'approvalsCreated',FALSE))
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
    jsonb_build_object('active_ankle_control',92,'multiplanar_path',88,
      'quiet_lower_leg_control',88,'low_impact',98,
      'restore_context',CASE WHEN p.phase_key='restore' THEN 90 ELSE 68 END),
    jsonb_build_object('sets',jsonb_build_array(1,2),
      'circuitsPerDirectionPerSide',CASE WHEN p.phase_key='restore' THEN jsonb_build_array(2,4) ELSE jsonb_build_array(2,5) END,
      'secondsPerCircuit',jsonb_build_array(4,10),'restSeconds',jsonb_build_array(10,45),
      'eachDirectionCountedSeparately',TRUE,'exampleDoseIsNotUniversal',TRUE),
    'The bench, pelvis, target thigh, and non-target foot remain stable; the target foot remains clear; the tibia, knee, pelvis, and trunk remain sufficiently quiet; the foot actively follows the declared ordered circuit and returns to the same start; the direction and count are correct; breathing continues; and no stop symptom occurs.',
    ARRAY[
      'Sharp, increasing, night, post-trauma, or unfamiliar pain or participant stop request.',
      'Foot, ankle, Achilles, calf, shin, knee, hip, or back symptoms prevent the exact task.',
      'Painful pinching, catching, clicking, instability, giving way, uncontrolled cramping, or inability to transfer or exit safely.',
      'Numbness, tingling, weakness, altered circulation, loss of control, or another neurologic sign.',
      'Dizziness, faintness, nausea, visual change, chest pain, unusual breathlessness, disorientation, or inability to communicate.',
      'The bench, pelvis, thigh, or non-target foot shifts, or the target foot contacts the floor or another object.',
      'Tibia, knee, pelvis, trunk, path, start/end, direction, breathing, or count cannot be restored by reducing range, circuits, or pace.',
      'Standing, closed eyes, resistance, load, passive force, weight bearing, hold, pump, alphabet, calf raise, assessment, or another wrong task cannot be corrected safely.',
      'Bench integrity, floor traction, foot clearance, space, traffic, hygiene, sightline, communication, or emergency route becomes unsafe.',
      'The planned circuit, active-ankle-motion, lower-leg, technical-fatigue, duration, or downstream exposure budget is reached.'
    ]::TEXT[],
    'Verify the exact seated unloaded active circuit, stable inspected bench, nonslip floor, foot clearance, target side, current symptoms and restrictions, planned circuits, active range, direction order, time, and downstream work. Demonstrate the declared start, inversion-plantarflexion-eversion return, reverse path, one-circuit count, stop, side change, transfer, and exit. Observe support, tibia, knee, pelvis, trunk, path, breathing, symptoms, first fault, actual duration, and safe exit. Do not diagnose restriction or instability, provide treatment, force range, or imply readiness.',
    'Sit securely with your working thigh supported and foot clear. Keep your shin, knee, hips, and trunk quiet. Slowly pull up, turn in, point down, turn out, and return to the same start for one circle; reverse for the other direction. Stop for pain, pinching, catching, cramping, tingling, weakness, dizziness, or instability.',
    CASE WHEN p.phase_key='restore'
      THEN 'More consistent low-intensity control of the exact seated active ankle circuit during restore; no treatment, structural, readiness, prevention, or performance outcome is guaranteed.'
      ELSE 'More consistent control of the exact seated active ankle circuit during preparation; no treatment, structural, readiness, prevention, or performance outcome is guaranteed.' END,
    ARRAY['bench']::TEXT[],
    jsonb_build_object('stationCapacity',1,'base','seated_stable_bench_target_thigh_supported',
      'requiredEquipment','bench','space','one_seated_station_with_target_foot_side_change_transfer_and_exit_clearance',
      'setupSeconds',20,'directionChangeSeconds',5,'sideChangeSeconds',15,
      'coachSightline','front_quarter_and_side','crossTrafficProhibited',TRUE,
      'benchAndFloorInspectionRequired',TRUE,'revalidateAfterAnyChange',TRUE),
    ARRAY[full_body_variant,rocker_variant,tibialis_variant,toe_yoga_variant]::UUID[],
    'review',
    jsonb_build_object('durationFormula','bench_and_body_setup_seconds + sum(actual_valid_circuits * actual_seconds_per_circuit) + direction_change_seconds + side_change_seconds + rest_seconds + invalid_or_partial_attempt_seconds + symptom_response_seconds + substitution_seconds + station_reset_transfer_and_exit_seconds','secondsPerCircuit',jsonb_build_array(4,10),'minimumSeconds',45,'typicalSeconds',105,'maximumSecondsWithoutReview',270,'includeActualNotPlanned',TRUE,'recomputeAfterSubstitution',TRUE),
    jsonb_build_object('regressionOrder',jsonb_build_array('reduce_to_comfortable_active_range','slow_the_circuit','reduce_to_two_clean_circuits_each_direction','increase_rest','use_visual_path_diagram','end_set','select_a_separately_validated_task'),'progressionOrder',jsonb_build_array('complete_clean_circuits','increase_within_two_to_five_circuit_profile','increase_comfortable_active_range_without_compensation','select_a_distinct_standing_resisted_loaded_or_sport_task_only_after_full_revalidation'),'neverScaleByForcingRangeAddingAssistanceResistanceOrLoadIgnoringSymptomsOrChangingTheCount',TRUE),
    jsonb_build_object('record',jsonb_build_array('definition_variant_profile_and_card_version','bench_floor_space_and_foot_clearance','target_side_and_direction_order','planned_and_actual_valid_circuits','active_range_tempo_pauses_and_rest','valid_invalid_partial_and_symptom_limited_attempts','tibia_knee_pelvis_trunk_path_endpoint_breathing_and_count','first_fault','symptoms_and_stop_reason','active_ankle_motion_seconds','duration','substitution','side_change_transfer_station_reset_and_exit'),'validUnit','one_active_ordered_closed_circuit_returning_to_the_declared_start_while_exact_seated_support_and_quiet_leg_rules_remain_valid','invalidUnitsTrackedSeparately',TRUE,'doNotConvertCircuitsToSecondsPumpsLettersOrClinicalDegrees',TRUE),
    jsonb_build_object('athlete',jsonb_build_array('sit_stable','foot_clear','quiet_leg','slow_ordered_circle','same_start','reverse','stop_for_pain_pinch_catching_cramping_tingling_weakness_dizziness_or_instability'),'coach',jsonb_build_array('verify_seated_active_identity','inspect_bench_floor_space_and_clearance','observe_support_path_direction_endpoint_and_count','record_actual_exposure_and_first_fault','revalidate_every_substitution'),'accessibility',jsonb_build_array('front_quarter_and_side_visual','written_path_diagram','smaller_range_fewer_circuits_slower_tempo_more_rest','light_non_assisting_monitoring','captions_transcript_still_images_or_live_instruction'),'escalation',jsonb_build_array('stop','stabilize_seated_position','assist_safe_transfer_or_exit_within_scope','follow_facility_policy','record','do_not_resume_without_reassessment'))
  FROM (VALUES
    ('5486bb15-08bc-44f3-90d8-921535589b02'::UUID,
      'prepare-seated-ankle-cars','prepare_and_access',92,90,
      'Use the exact seated active ankle circuit as low-load preparation only when bench support, foot clearance, active motion, symptoms, duration, and cumulative ankle and lower-body budgets fit.'),
    ('8a0d6161-6e19-481d-b3b5-7710d010e4b4'::UUID,
      'restore-seated-ankle-cars','restore',86,82,
      'Use the same exact seated circuit as a low-intensity restore option only when active motion is comfortable and it does not replace assessment, treatment, or recovery guidance.')
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
      'canonicalContract','seated_thigh_supported_active_ordered_ankle_circuit_each_direction_counted_separately',
      'neighborContract',i.neighbor_contract,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'deterministic_identity_equivalence',NULL,now()
  FROM (VALUES
    (full_body_definition,'ankle_only_vs_multi_region_flow','Full-Body Joint CARs Flow requires an ordered multi-region sequence; Source 42 is one ankle-only circuit.','standing_multi_region_joint_sequence'),
    (rocker_definition,'non_weight_bearing_circuit_vs_weight_bearing_rocker','Standing Knee-to-Wall Ankle Rocker uses planted-foot sagittal weight bearing and a forward-return cycle.','standing_weight_bearing_dorsiflexion_cycle'),
    (tibialis_definition,'multiplanar_circuit_vs_dorsiflexor_raise','Tibialis Raises use repeated loaded dorsiflexion with heel support rather than a free multiplanar circuit.','wall_supported_dorsiflexor_raise'),
    (calf_raise_definition,'multiplanar_circuit_vs_calf_raise','Calf Raise to Controlled Heel Drop lifts and lowers body mass through plantarflexion and eccentric return.','standing_calf_raise_and_lower'),
    (toe_yoga_definition,'ankle_circuit_vs_toe_dissociation','Toe Yoga isolates big-toe and lesser-toe actions with the foot supported rather than rotating the ankle joint complex.','supported_toe_dissociation')
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
    ('identity','https://www.acefitness.org/continuing-education/certified/october-2024/8725/controlled-articular-rotations-shifting-mobility-into-high-gear/','Controlled Articular Rotations: Shifting Mobility into High Gear','American Council on Exercise','professional_standard','CARs are slow deliberate active rotations through available pain-free joint range.','direct general CAR identity context','The source does not define the complete Vortex seated support start sequence count invalidation or dosage.',88),
    ('taxonomy','https://pubmed.ncbi.nlm.nih.gov/8423170/','A method to determine the range of motion of the ankle joint complex, in vivo','Journal of Biomechanics','peer_reviewed_research','Active ankle-joint-complex motion includes dorsiflexion-plantarflexion inversion-eversion and abduction-adduction components.','direct active multiplanar ankle context','The measurement apparatus is not the Vortex exercise.',88),
    ('anatomy','https://pmc.ncbi.nlm.nih.gov/articles/PMC4994968/','Biomechanics of the ankle','Orthopaedics and Trauma','peer_reviewed_research','Ankle and foot motion is distributed across the ankle joint complex.','direct regional anatomy and coupled-motion context','The review does not establish isolated tissue loading for this circuit.',90),
    ('biomechanics','https://pubmed.ncbi.nlm.nih.gov/8423170/','A method to determine the range of motion of the ankle joint complex, in vivo','Journal of Biomechanics','peer_reviewed_research','Unconstrained active range can be represented across multiple angular components and maxima need not occur from neutral.','direct active multiaxial motion context','The study does not validate one drawn path start or exercise count.',88),
    ('difficulty','https://pmc.ncbi.nlm.nih.gov/articles/PMC1550229/','Reliability of two goniometric methods of measuring active inversion and eversion range of motion at the ankle','BMC Musculoskeletal Disorders','peer_reviewed_research','Active inversion and eversion can be repeated in seated testing under a defined protocol.','adjacent coordination and repeatability context','The study does not validate Vortex scores.',88),
    ('load_fatigue_recovery','https://pmc.ncbi.nlm.nih.gov/articles/PMC4994968/','Biomechanics of the ankle','Orthopaedics and Trauma','peer_reviewed_research','The ankle joint complex permits multiplanar motion.','adjacent load-distribution context','The review does not establish fatigue recovery or tissue thresholds for slow unloaded circles.',90),
    ('constraints','https://pmc.ncbi.nlm.nih.gov/articles/PMC1550229/','Reliability of two goniometric methods of measuring active inversion and eversion range of motion at the ankle','BMC Musculoskeletal Disorders','peer_reviewed_research','Observed active ROM depends on position direction observer and session.','direct protocol-sensitivity context','It does not establish universal eligibility or safe range.',88),
    ('dosage','https://www.acefitness.org/continuing-education/certified/october-2024/8725/controlled-articular-rotations-shifting-mobility-into-high-gear/','Controlled Articular Rotations: Shifting Mobility into High Gear','American Council on Exercise','professional_standard','CAR instruction emphasizes slow deliberate active range.','direct pace context','It does not establish one universal ankle dose.',88),
    ('instructions','https://www.acefitness.org/continuing-education/certified/october-2024/8725/controlled-articular-rotations-shifting-mobility-into-high-gear/','Controlled Articular Rotations: Shifting Mobility into High Gear','American Council on Exercise','professional_standard','The task should remain actively controlled and pain free.','direct instruction context','Vortex adds the exact seated support ordered path count and stop rules.',88),
    ('safety_stop_rules','https://pmc.ncbi.nlm.nih.gov/articles/PMC4994968/','Biomechanics of the ankle','Orthopaedics and Trauma','peer_reviewed_research','Ankle motion is coupled and varies across people and methods.','adjacent safety-scope context','No universal safe endpoint normal circle or clinical interpretation is established.',90),
    ('programming','https://pubmed.ncbi.nlm.nih.gov/8423170/','A method to determine the range of motion of the ankle joint complex, in vivo','Journal of Biomechanics','peer_reviewed_research','Active range can be described across multiple components.','adjacent exercise-selection context','No warm-up recovery sport-transfer or prevention outcome was tested.',88),
    ('athlete_support','https://www.acefitness.org/continuing-education/certified/october-2024/8725/controlled-articular-rotations-shifting-mobility-into-high-gear/','Controlled Articular Rotations: Shifting Mobility into High Gear','American Council on Exercise','professional_standard','Slow deliberate active rotation supplies visible pace and range cues.','direct plain-language cue context','Exact support path count scaling and escalation remain Vortex candidate rules.',88),
    ('coach_support','https://pmc.ncbi.nlm.nih.gov/articles/PMC1550229/','Reliability of two goniometric methods of measuring active inversion and eversion range of motion at the ankle','BMC Musculoskeletal Disorders','peer_reviewed_research','Standardized position and observation affect repeatability.','direct observation context','The measurement protocol does not authorize diagnosis or treatment.',88),
    ('accessibility','https://www.acefitness.org/continuing-education/certified/october-2024/8725/controlled-articular-rotations-shifting-mobility-into-high-gear/','Controlled Articular Rotations: Shifting Mobility into High Gear','American Council on Exercise','professional_standard','Slow active rotation can be demonstrated and scaled within available pain-free range.','direct communication context','The source does not validate every accessibility adaptation.',88),
    ('alternates','https://pmc.ncbi.nlm.nih.gov/articles/PMC4994968/','Biomechanics of the ankle','Orthopaedics and Trauma','peer_reviewed_research','Sagittal frontal and coupled components should not be treated as one isolated hinge action.','direct alternate-action boundary context','Identity decisions still require exact support force action endpoint and count facts.',90),
    ('media','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en','Embed videos and playlists','YouTube Help','manufacturer_instruction','Five URLs returned current oEmbed title channel thumbnail and iframe metadata on 2026-08-10.','link and embed metadata only','Playback exact seated mechanics captions accessibility quality safety reviewer and approval remain unverified.',82)
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
    'Current YouTube oEmbed metadata only. Playback exact seated bench and thigh support target-foot clearance active ordered path quiet tibia knee pelvis and trunk directional count captions accessibility cue quality safety reviewer identity card-version match and approval remain unverified.'
  FROM (VALUES
    ('BDNGAnp7u7s','Controlled Articular Rotations (CARs) - Ankle','Tangelo - Seattle Chiropractor + Rehab','Source 42 legacy candidate checked by YouTube oEmbed; full exact seated-circuit review pending'),
    ('fyShbLKXMkY','How To Do Ankle CARs','Alex Murphy','Source 42 legacy candidate checked by YouTube oEmbed; full exact seated-circuit review pending'),
    ('M2hhS_XJjww','Ankle MOBILITY "Ankle CARs" for Joint Health Controlled Articular Rotations','Coach Rich Thurman','Source 42 legacy candidate checked by YouTube oEmbed; full exact seated-circuit review pending'),
    ('IYdRxX95vNE','Ankle CARS: Controlled Articular Rotations','Osteopathic Movement','Ankle CAR candidate checked by YouTube oEmbed; full exact seated-circuit review pending'),
    ('gLtItpjgi3M','Ankle Controlled Articular Rotations','Movement As Medicine','Ankle CAR candidate checked by YouTube oEmbed; full exact seated-circuit review pending')
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
    ('Ankle CARs','same_identity','Source 42 name maps to the exact seated active ankle circuit.','source42_identity',jsonb_build_array('legacy_exercise_42','same_support_action_count'),'canonical_name'),
    ('Seated Active Ankle Circumduction','same_identity','The alias preserves seated support active ordered path quiet tibia and closed-circuit count.','canonical_alias',jsonb_build_array('same_support','same_path','same_count'),'merge_alias'),
    ('Comfortable Active Range','modifier_annotation','A smaller symptom-free path changes amplitude without changing support ordered action or count.','range_annotation',jsonb_build_array('active_range'),'delivery_annotation'),
    ('Controlled Tempo','modifier_annotation','Slower pace changes exposure time while preserving the same circuit.','tempo_annotation',jsonb_build_array('tempo'),'delivery_annotation'),
    ('Brief Non-Forced Quadrant Pause','modifier_annotation','A brief pause changes timing without becoming a sustained isometric dose.','pause_annotation',jsonb_build_array('brief_pause'),'delivery_annotation'),
    ('Circuit Count Sets Rest or Direction Order','modifier_annotation','Volume recovery and first direction change delivery rather than identity.','dose_annotation',jsonb_build_array('circuits','sets','rest','direction_order'),'delivery_annotation'),
    ('Declared Comfortable Seated Knee Angle','modifier_annotation','Knee angle is setup while the thigh remains supported and foot remains clear.','knee_angle_annotation',jsonb_build_array('knee_angle'),'delivery_annotation'),
    ('Light Hands Monitoring Thigh or Tibia','modifier_annotation','Light non-assisting monitoring detects compensation without moving the foot.','monitoring_annotation',jsonb_build_array('monitoring_contact','no_assistance'),'delivery_annotation'),
    ('Visual Toe-Trace Cue','modifier_annotation','A non-contact visual trace clarifies the path without external force.','trace_annotation',jsonb_build_array('visual_trace'),'delivery_annotation'),
    ('Breathing Prompt Side Order or Workout Context','modifier_annotation','Breathing side sequence and context do not change the exact circuit.','context_annotation',jsonb_build_array('breathing','side_order','context'),'delivery_annotation'),
    ('Standing Hand-Supported Ankle CAR','new_variant','Standing adds weight bearing balance fall exposure and hand-support requirements.','standing_variant',jsonb_build_array('standing','hand_support','balance'),'research_queue'),
    ('Long-Sit Ankle CAR','new_variant','Long sitting changes hip knee hamstring trunk and support constraints.','long_sit_variant',jsonb_build_array('long_sit','support'),'research_queue'),
    ('Supine Ankle CAR','new_variant','Supine support changes sightline transfer trunk demand and station logistics.','supine_variant',jsonb_build_array('supine','transfer'),'research_queue'),
    ('Prone Knee-Flexed Ankle CAR','new_variant','Prone knee flexion changes muscle length visibility support and transfer demands.','prone_variant',jsonb_build_array('prone','knee_flexed'),'research_queue'),
    ('Eyes-Closed Seated Ankle CAR','new_variant','Removing vision changes sensory constraints supervision and stop rules.','eyes_closed_variant',jsonb_build_array('vision','supervision'),'research_queue'),
    ('Band-Resisted Ankle CAR','new_variant','External resistance changes force direction anchor safety load fatigue and progression.','band_variant',jsonb_build_array('resistance_band','anchor'),'research_queue'),
    ('Ankle-Weighted Seated CAR','new_variant','Added distal load changes torque fatigue failure consequence and supervision.','loaded_variant',jsonb_build_array('ankle_weight','external_load'),'research_queue'),
    ('Ankle Pumps','new_definition','Sagittal dorsiflexion and plantarflexion oscillation omits the inversion-eversion circuit.','pump_distinct',jsonb_build_array('sagittal_oscillation'),'research_queue'),
    ('Ankle Alphabet','new_definition','Letter tracing uses a variable multistroke sequence rather than one fixed circuit.','alphabet_distinct',jsonb_build_array('alphabet_trace'),'research_queue'),
    ('Four-Way Band Ankle Strengthening','new_definition','Separate resisted directional repetitions use external force and strength dosage.','four_way_band_distinct',jsonb_build_array('resisted_strength','four_directions'),'research_queue'),
    ('Standing Knee-to-Wall Ankle Rocker','new_definition','Source 40 is a planted-foot weight-bearing sagittal forward-return cycle.','rocker_distinct',jsonb_build_array('weight_bearing','sagittal_cycle'),'existing_distinct_definition'),
    ('Calf Raise to Controlled Heel Drop','new_definition','Source 44 lifts and lowers body mass through plantarflexion and eccentric return.','calf_raise_distinct',jsonb_build_array('heel_raise','controlled_lower'),'existing_distinct_definition'),
    ('Full-Body Joint CARs Flow','new_definition','Source 23 is an ordered multi-region flow rather than an ankle-only circuit.','full_body_distinct',jsonb_build_array('multi_region_flow'),'existing_distinct_definition'),
    ('Clinical Ankle Range-of-Motion Assessment','new_definition','Standardized maximal measurement adds procedure interpretation comparison documentation consent and clinical scope.','clinical_assessment_distinct',jsonb_build_array('maximal_measurement','clinical_scope'),'research_queue')
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
      'revalidate',jsonb_build_array('identity and purpose','base support path action and count','bench wall floor equipment space transfer and exit','symptoms and restrictions','dose duration and logistics','foot ankle lower-leg balance lower-body and sport budgets','persistence','coach rendering','athlete rendering'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'review',NULL,NULL,NULL
  FROM (VALUES
    (full_body_variant,'progression',58,ARRAY['complexity','duration','range']::TEXT[],'Moves from one ankle circuit to an ordered multi-region flow; use only after full reselection.'),
    (rocker_variant,'lateral_substitution',44,ARRAY['stability','range','load']::TEXT[],'Changes non-weight-bearing multiplanar motion to a standing planted-foot sagittal cycle.'),
    (tibialis_variant,'lateral_substitution',42,ARRAY['load','fatigue','range']::TEXT[],'Changes an unloaded ankle circuit to repeated dorsiflexor strengthening.'),
    (toe_yoga_variant,'lateral_substitution',38,ARRAY['complexity','range','stability']::TEXT[],'Changes ankle-joint-complex rotation to supported toe dissociation and foot-control work.')
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
    CASE d.dimension WHEN 'technicalComplexity' THEN 24 ELSE 12 END,
    20,
    CASE d.dimension WHEN 'technicalComplexity' THEN
      'Review-only task-complexity anchor based on stable seated support, target-foot clearance, quiet tibia knee pelvis and trunk, a declared start, ordered multiplanar active path, same-start completion, direction reversal, breathing, quality gates, and exact circuit count.'
    ELSE
      'Review-only task physical-demand anchor based on unloaded active foot and lower-leg motion, low postural demand, no impact, and no external resistance or weight bearing.'
    END||' This scores the exercise task, not the participant.',
    'review',1,NULL,NULL,
    'Research-informed proposal only; independent comparison and qualified human approval remain required.',NULL
  FROM (VALUES('technicalComplexity'),('absoluteLoadDemand')) d(dimension)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
    proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,reviewed_by=NULL,
    review_notes=EXCLUDED.review_notes,reviewed_at=NULL,updated_at=now();

  UPDATE coaching.exercise SET
    name='Ankle CARs',slug='ankle-cars',
    description='Sit on a stable bench with the non-target foot planted, target thigh supported, and target foot clear. From a comfortable dorsiflexed start, actively trace inversion, plantarflexion, eversion, and return to the same start while the tibia, knee, pelvis, and trunk remain quiet. Count one closed circuit, then reverse the ordered path for the other direction.',
    instructions='Use the exact seated unloaded active variant on an inspected stable bench and nonslip floor. Keep the target foot clear and the rest of the leg quiet. Pull up, turn in, point down, turn out, and return to the same start for one circuit; reverse for the other direction. Stop for pain, pinching, catching, cramping, instability, numbness, tingling, weakness, altered circulation, dizziness, faintness, nausea, visual change, chest pain, unusual breathlessness, unsafe bench or floor, or participant request.',
    skill_level=NULL,age_min=NULL,age_max=NULL,
    default_sets=1,default_reps=3,default_work_seconds=50,default_rest_seconds=20,
    tempo='controlled four to ten seconds per complete active circuit',
    load_note='Track bench, floor, foot clearance, side, direction order, planned and actual valid circuits, active range, knee angle, tempo, pauses, tibia knee pelvis and trunk compensation, toe gripping, breathing, first fault, symptoms, invalid or partial attempts, active-motion time, rest, duration, substitution, side change, transfer, exit, and overlapping foot ankle Achilles calf shin lower-leg balance landing sprint cutting kicking and lower-body exposure.',
    est_seconds_per_set=105,is_published=FALSE,archived=FALSE,
    card_summary='Seated, thigh-supported, unloaded active ankle circuit with an exact ordered path and separate count for each direction.',
    coach_language='Verify the exact seated active circuit, bench and floor safety, foot clearance, target-thigh support, quiet tibia knee pelvis and trunk, ordered path, direction count, symptoms and restrictions, planned dose, actual exposure, first fault, duration, downstream budget, persistence, transfer, exit, and escalation.',
    athlete_language='Sit securely with your working foot clear. Keep the rest of your leg quiet. Slowly pull up, turn in, point down, turn out, and return to the same start for one circle; reverse. Stop for pain, pinching, catching, cramping, tingling, weakness, dizziness, or instability.',
    programming_logic=jsonb_build_object(
      'selectionStatus','canonical_variant_required','selectable',TRUE,
      'canonicalDefinitionId',canonical_definition,'exactVariantIds',to_jsonb(active_variant_ids),
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'exerciseDifficultyDescribesTaskOnly',TRUE,
      'selectionInputs',jsonb_build_array('workout purpose and delivery context','stable bench nonslip floor foot clearance station transfer and exit','active ankle motion and seated tolerance','exact start ordered path reverse and circuit-count comprehension','dose pace range rest side direction order and duration','cumulative ankle lower-leg balance lower-body landing sprint cutting kicking exposure','coach scope and sightline'),
      'substitutionRevalidation',jsonb_build_array('identity','base support path action and count','bench floor equipment space transfer and exit','restrictions and symptoms','purpose','dose','fatigue and impact budgets','duration','logistics','persistence','coach rendering','athlete rendering'),
      'legacySourceIds',jsonb_build_array(42),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    scalable_variables=ARRAY['active_range','knee_angle','light_monitoring_contact','visual_trace','direction_order','tempo','brief_pause','breathing_prompt','circuits','rest_seconds','sets','side_order','delivery_context']::TEXT[],
    movement_family='Seated active ankle controlled articular rotation',
    primary_phase_key='prepare_and_access',phase_subrole='mobilize',
    primary_order_slot='ankle_cars',
    movement_requirements=jsonb_build_object(
      'impact_level',0,'balance_demand','low','postural_shape','seated_target_thigh_supported_target_foot_clear',
      'primary_tissues',jsonb_build_array('foot_and_ankle_movers','lower_leg_muscles','ankle_and_foot_structures'),
      'breathing_demand','continuous_relaxed_breathing','coordination_demand','low_to_moderate',
      'primary_joint_actions',jsonb_build_array('ankle_dorsiflexion','foot_and_ankle_inversion','ankle_plantarflexion','foot_and_ankle_eversion','multiplanar_foot_control'),
      'supportContacts',jsonb_build_array('pelvis_on_bench','target_posterior_thigh_on_bench','non_target_foot_on_floor'),
      'exactSequence',jsonb_build_array('dorsiflexed_start','inversion','plantarflexion','eversion','same_start','reverse'),
      'exerciseDifficulty',jsonb_build_object('complexity',24,'physicalDifficulty',12,'overall',24,'formula','max')),
    coaching_execution=jsonb_build_object(
      'setup',jsonb_build_array('stable inspected bench and nonslip floor','pelvis and target thigh supported','non-target foot planted','target foot clear of floor and objects','comfortable seated position and clear side-change transfer and exit'),
      'execution_steps',jsonb_build_array('set a comfortable dorsiflexed start','actively turn inward','actively point down','actively turn outward','return to the same start and count one circuit','reverse the ordered path','change sides under control'),
      'coach_cues',jsonb_build_array('sit stable','foot clear','quiet leg','pull up','turn in','point down','turn out','same start','reverse','keep breathing'),
      'athlete_cues',jsonb_build_array('keep your leg quiet','draw a slow smooth circle','use comfortable range','finish where you started','reverse','no forcing'),
      'common_faults',jsonb_build_array('unstable bench or shifting pelvis','target foot touching floor','tibia or knee rotating','pelvis or trunk creating range','skipping a quadrant','not returning to start','rushing or bouncing','toe gripping or cramping','hand assistance','adding resistance load weight bearing pumps alphabet holds calf raises or assessment'),
      'quality_gate',jsonb_build_array('stable seated support','target foot clear','quiet tibia knee pelvis and trunk','comfortable active range','correct ordered path','same start and endpoint','correct direction count','continuous breathing','no stop symptom'),
      'stop_signs',jsonb_build_array('sharp increasing night post-trauma or unfamiliar pain','painful pinching catching clicking instability or cramping','numbness tingling weakness or circulation change','dizziness faintness nausea visual change chest pain unusual breathlessness or disorientation','unsafe bench floor clearance transfer or exit','participant stop request'),
      'breathing_cues',jsonb_build_array('breathe continuously','do not hold breath to force range'),
      'clinical_scope','This is a workout exercise, not a diagnostic ankle range-of-motion test, passive mobilization treatment, clearance, or proof of readiness.'),
    pairing_logic=jsonb_build_object(
      'sameSessionBudget',jsonb_build_array('valid_circuits_per_direction_per_side','active_ankle_motion_seconds','ankle_mobility_load','lower_leg_exposure','technical_fatigue','downstream_balance_landing_sprint_cutting_kicking_and_lower_body_work','impact'),
      'avoidAutomaticPairingWith',jsonb_build_array('fatiguing_ankle_or_lower_leg_work_before_priority_balance_landing_sprint_cutting_or_kicking','symptom_provoking_active_ankle_motion','same_session_ankle_or_lower_body_work_exceeding_budget'),
      'revalidateAfterSubstitution',TRUE),
    media_library=jsonb_build_object(
      'candidate_video_ids',jsonb_build_array('BDNGAnp7u7s','fyShbLKXMkY','M2hhS_XJjww','IYdRxX95vNE','gLtItpjgi3M'),
      'reviewState','oembed_metadata_only_candidate_quarantine',
      'playbackExactSeatedSupportActivePathDirectionCountCompensationCaptionsAccessibilityQualitySafetyAndApprovalVerified',FALSE,
      'humanReviewRequired',TRUE),
    participant_structure='individual',programming_kind='exercise',linked_skill_id=NULL,
    why_publish_ready=FALSE,updated_at=now()
  WHERE id=42;

  UPDATE coaching.exercise_safety_profile SET
    risk_level=1,impact_level=0,minimum_age_recommended=NULL,
    minimum_skill_level=NULL,requires_spotting=FALSE,
    requires_coach_supervision='recommended',
    minimum_prerequisite_notes='Readiness uses safe seated transfer, stable inspected bench and nonslip floor, foot clearance, comfortable active ankle motion, quiet-leg and exact directional-circuit comprehension, symptoms, communication, workout dose, and downstream ankle and lower-body loading; never participant classification or age.',
    readiness_checks=ARRAY[
      'Confirm exact seated unloaded active variant, stable inspected bench, nonslip floor, foot clearance, station, sightline, communication, transfer, exit, and emergency route.',
      'Confirm foot, ankle, Achilles, calf, shin, knee, hip, back, seated tolerance, and no current symptom or restriction conflict.',
      'Confirm the participant understands support, foot clearance, quiet tibia knee pelvis and trunk, declared start, ordered path, reverse direction, count, stop signal, side change, transfer, and exit.',
      'Review cumulative circuits, active ankle motion time, ankle and lower-leg load, technical fatigue, and later balance landing sprint cutting kicking or lower-body demand.'
    ]::TEXT[],
    stop_signs=ARRAY[
      'Sharp, increasing, night, post-trauma, or unfamiliar pain, guarding, or participant stop request.',
      'Foot, ankle, Achilles, calf, shin, knee, hip, or back symptoms prevent exact motion or support.',
      'Pinching, catching, painful clicking, instability, giving way, uncontrolled cramping, or unsafe transfer.',
      'Numbness, tingling, weakness, altered circulation, loss of control, or another neurologic sign.',
      'Dizziness, faintness, nausea, visual change, chest pain, unusual breathlessness, disorientation, or inability to communicate.',
      'Bench, pelvis, thigh, or non-target foot shifts, or the target foot contacts the floor or another object.',
      'Tibia, knee, pelvis, trunk, ordered path, same-start completion, direction, breathing, or exact count cannot be restored despite reduced range, circuits, or pace.',
      'Bench, floor, foot clearance, space, traffic, hygiene, sightline, communication, duration, budget, transfer, exit, or emergency route becomes inadequate.'
    ]::TEXT[],
    contraindications=ARRAY[
      'Current symptoms, trauma, procedure, instability, or clinical restrictions conflict with active ankle motion or seated support.',
      'No stable inspected bench, nonslip floor, target-foot clearance, controlled transfer and exit, sightline, communication, or emergency route.',
      'The intended service is diagnosis, treatment, injury management, readiness clearance, maximal clinical measurement, passive assistance, resisted strengthening, weight-bearing mobilization, calf raising, balance training, or another identity.'
    ]::TEXT[],
    common_substitutions=ARRAY[
      'Use Full-Body Joint CARs Flow only when the added regions, standing support, duration, and all checks fit.',
      'Use Standing Knee-to-Wall Ankle Rocker, Tibialis Raises, Toe Yoga, or Calf Raise to Controlled Heel Drop only when the changed action and support fit and all checks are rerun.',
      'Do not infer that standing, long-sit, supine, prone, eyes-closed, resisted, loaded, passive, pump, alphabet, clinical-test, or sport versions are equivalent.',
      'Author and review any changed-base, external-force, loaded, passive, or added-action alternative before selection.'
    ]::TEXT[]
  WHERE exercise_id=42;

  UPDATE coaching.exercise_score_v1 SET
    technical_complexity=24,absolute_load_demand=12,coordination_demand=22,
    impact=1,supervision_demand=12,base_overall_difficulty=greatest(24,12),
    legacy_scores=coalesce(legacy_scores,'{}'::JSONB)||jsonb_build_object(
      'candidateReassessment',migration_key,
      'projectionScope','seated_thigh_supported_unloaded_active_ordered_ankle_circuit_exact_variant',
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'variantScores',jsonb_build_object('seatedActiveAnkleCircuit',
        jsonb_build_object('complexity',24,'physicalDifficulty',12,'overall',24)),
      'exerciseScoresDescribeTaskOnly',TRUE,'independentCalibrationRequired',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    migration_confidence=58,human_review_status='queued',reviewed_by=NULL,reviewed_at=NULL,
    review_notes='Research-informed candidate reassessment only. Scores describe exercise complexity and physical difficulty, not participant classification, age, readiness, or proficiency. Exact seated support, ordered path, directional count, and independent calibration remain required.',
    updated_at=now()
  WHERE exercise_id=42;

  UPDATE coaching.exercise_difficulty_profile SET
    technical=2.4,complexity=2.2,load=1.2,overall=2.4,
    recommended_age_min=NULL,recommended_age_max=NULL,attention_demand='low',
    notes='Candidate projection from the exact seated thigh-supported unloaded active ankle circuit. Complexity is 24/100, physical difficulty 12/100, and overall 24/100 by maximum. This is not participant classification, readiness, age, or proficiency.',
    source='canonical_research_candidate',updated_at=now()
  WHERE exercise_id=42;

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  VALUES(canonical_definition,1,2,'2.0.0',migration_key,'quarantined',
    jsonb_build_object(
      'identity',jsonb_build_object('passed',TRUE,'identityKey','seated_thigh_supported_active_ordered_ankle_circuit_each_direction_counted_separately','legacySources',1,'activeVariants',1,'archivedSourceSkeletons',1,'neighborBoundaries',5),
      'taxonomy',jsonb_build_object('passed',TRUE,'controlledTerms',TRUE,'movementPatterns',jsonb_build_array('rotate','brace'),'bodyRegions',jsonb_build_array('foot','ankle','lower_leg','knee','thigh','core'),'equipment',jsonb_build_array('bench')),
      'anatomy',jsonb_build_object('passed',TRUE,'musclesJointsActionsPlanesLateralityContactsSequenceAndCoupledMotionBoundary',TRUE),
      'difficulty',jsonb_build_object('passed',TRUE,'model','max_exercise_complexity_physical_difficulty','variantVectors',jsonb_build_array('24/12/24'),'participantClassificationAbsent',TRUE,'independentCalibrationRequired',TRUE),
      'loadFatigueRecovery',jsonb_build_object('passed',TRUE,'actualCircuitsPathRangeCompensationFaultSymptomsAndOverlappingAnkleLowerBodyExposureTracked',TRUE,'impactNone',TRUE,'recoveryIsPlanningEstimate',TRUE),
      'constraints',jsonb_build_object('passed',TRUE,'benchFloorClearanceTransferSymptomsRestrictionsSpaceTrafficScopeAndEmergencyRoute',TRUE),
      'delivery',jsonb_build_object('passed',TRUE,'profiles',2,'prepareAndRestore',TRUE,'durationDoseRestSetupDirectionSideTransferExitAndSubstitutionRevalidation',TRUE),
      'instructions',jsonb_build_object('passed',TRUE,'athleteCoachAccessibilityAndSupportOperations',TRUE,'supportPathDirectionCountSymptomsTransferAndClinicalScope',TRUE),
      'research',jsonb_build_object('passed',TRUE,'sections',16,'registryVersion',research_version,'directAndAdjacentEvidenceSeparated',TRUE,'exampleDoseNotUniversal',TRUE),
      'media',jsonb_build_object('passed',FALSE,'candidateCount',5,'currentOEmbedMetadataHealthy',TRUE,'playbackReviewed',FALSE,'exactSeatedCircuitReviewed',FALSE,'captionsAccessibilityQualitySafetyAndApprovalReviewed',FALSE),
      'relationships',jsonb_build_object('passed',FALSE,'reviewOnly',4,'approved',0,'automaticSubstitution',FALSE),
      'calibration',jsonb_build_object('passed',FALSE,'reviewOnly',2,'approved',0),
      'alternates',jsonb_build_object('passed',TRUE,'assessments',24,'sameIdentity',2,'modifierAnnotations',8,'newVariants',7,'newDefinitions',7,'singleExactVariant',TRUE),
      'generationSupport',jsonb_build_object('passed',TRUE,'selectionConstraints',TRUE,'cumulativeFatigueAndImpactBudgets',TRUE,'duration',TRUE,'benchClearanceTransferDirectionSideAndExit',TRUE,'substitutionRevalidation',TRUE,'renderingAndPersistence',TRUE),
      'publication',jsonb_build_object('passed',FALSE,'reviewer',NULL,'approver',NULL)),
    jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01','message','A qualified human must watch all five candidates in full and verify playback, exact seated support, target-foot clearance, active ordered circuit, quiet tibia knee pelvis and trunk, start and endpoint, direction count, captions, accessibility, cue quality, safety, conflicts, reviewer identity, timestamp, card version, and approval rationale.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','A qualified coach must approve or reject all four relationships; no automatic substitution to full-body, weight-bearing, dorsiflexor-strength, toe-control, calf, standing, alternate-base, resisted, loaded, passive, pump, alphabet, clinical, or sport tasks is authorized.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','An independent qualified reviewer must calibrate exercise complexity 24 and physical difficulty 12. Scores do not classify a participant or create an age, readiness, or proficiency level.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','A qualified reviewer and separate approver must complete content review before publication. Identity, coupled anatomy, bench and transfer safety, path and count, clinical scope, dose, stop, accessibility, persistence, restore context, and support rules remain quarantined.')),
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
        AND movement_patterns=ARRAY['rotate','brace']::TEXT[]
        AND required_equipment=ARRAY['bench']::TEXT[]
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
        AND (difficulty_json->>'technicalComplexity')::INTEGER=24
        AND (difficulty_json->>'physicalDifficulty')::INTEGER=12
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=greatest(24,12)
        AND (difficulty_json->>'coordinationDemand')::INTEGER=22
        AND (difficulty_json->>'supervisionDemand')::INTEGER=12
        AND (difficulty_json->>'failureConsequence')::INTEGER=10
        AND (difficulty_json->>'impact')::INTEGER=1
        AND (difficulty_json->>'workCapacityDemand')::INTEGER=10
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
        AND equipment_required=ARRAY['bench']::TEXT[]
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

  IF EXISTS(SELECT 1 FROM coaching.exercise WHERE id=42
      AND (skill_level IS NOT NULL OR age_min IS NOT NULL OR age_max IS NOT NULL
        OR linked_skill_id IS NOT NULL OR is_published OR why_publish_ready))
    OR EXISTS(SELECT 1 FROM coaching.exercise_safety_profile WHERE exercise_id=42
      AND (minimum_skill_level IS NOT NULL OR minimum_age_recommended IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 WHERE id=canonical_definition
      AND (approved_video_url IS NOT NULL OR reviewed_by IS NOT NULL
        OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL OR status='published'))
    OR EXISTS(SELECT 1 FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=canonical_definition AND review_status='candidate'
        AND (exact_variant_match IS NOT NULL OR demonstration_quality_score IS NOT NULL
          OR captions_available IS NOT NULL OR reviewer_user_id IS NOT NULL OR reviewed_at IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1
      WHERE from_variant_id=exact_variant AND review_status='approved')
    OR EXISTS(SELECT 1 FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=exact_variant AND status='approved') THEN
    RAISE EXCEPTION '% fabricated participant classification approval or publication state detected',migration_key;
  END IF;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=canonical_definition AND status='quarantined'
        AND human_review_required
        AND jsonb_array_length(blocking_issues_json)=4
        AND (SELECT array_agg(item->>'code' ORDER BY item->>'code')
             FROM jsonb_array_elements(blocking_issues_json) item)
          =ARRAY['CARD-CALIBRATION-01','CARD-GRAPH-03','CARD-MEDIA-01','CARD-PUBLISH-01']::TEXT[])
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=42
      AND programming_logic->>'exerciseDifficultyDescribesTaskOnly'='true'
      AND movement_requirements->'exerciseDifficulty'->>'overall'='24'
      AND media_library->>'reviewState'='oembed_metadata_only_candidate_quarantine'
      AND participant_structure='individual' AND programming_kind='exercise'
      AND linked_skill_id IS NULL AND NOT is_published) THEN
    RAISE EXCEPTION '% test packet legacy projection or task-only difficulty assertion failed',migration_key;
  END IF;
END
$migration$;
