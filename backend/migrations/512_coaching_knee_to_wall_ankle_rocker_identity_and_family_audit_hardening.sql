-- Sources 40, 875, and 1359: consolidate the same standing knee-to-wall
-- ankle-rocker cycle, preserve sport-transfer wording as delivery context,
-- replace skeletal source variants with one exact task, and keep half-kneeling,
-- isometric, circular, and foot-control neighbors distinct. Evidence, media,
-- graph, calibration, content, and publication authority remain human-only.
-- Exercise difficulty describes the task, never the participant.
DO $migration$
DECLARE
  migration_key CONSTANT TEXT := '512_coaching_knee_to_wall_ankle_rocker_identity_and_family_audit_hardening';
  research_version CONSTANT TEXT := '2026-08-09.107';
  canonical_definition UUID; source875_definition UUID; source1359_definition UUID;
  source40_variant UUID; source875_variant UUID; source1359_variant UUID; exact_variant UUID;
  active_variant_ids UUID[]; all_owned_variant_ids UUID[];
  half_kneeling_definition UUID; half_kneeling_variant UUID; iso_press_definition UUID; iso_press_variant UUID;
  ankle_car_definition UUID; ankle_car_variant UUID; foot_tripod_definition UUID; foot_tripod_variant UUID;
  protected_count INTEGER;
BEGIN
  SELECT id INTO canonical_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=40;
  SELECT id INTO source875_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=875;
  SELECT id INTO source1359_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=1359;
  SELECT id INTO source40_variant FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='baseline';
  SELECT id INTO source875_variant FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='baseline-source-875';
  SELECT id INTO source1359_variant FROM coaching.exercise_variant_v1 WHERE definition_id=source1359_definition AND variant_key='baseline';
  SELECT coalesce((SELECT id FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='standing-knee-to-wall-forward-return-cycle'),gen_random_uuid()) INTO exact_variant;
  SELECT id INTO half_kneeling_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=41;
  SELECT id INTO half_kneeling_variant FROM coaching.exercise_variant_v1 WHERE definition_id=half_kneeling_definition AND variant_key='baseline';
  SELECT id INTO iso_press_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=844;
  SELECT id INTO iso_press_variant FROM coaching.exercise_variant_v1 WHERE definition_id=iso_press_definition AND variant_key='baseline';
  SELECT id INTO ankle_car_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=42;
  SELECT id INTO ankle_car_variant FROM coaching.exercise_variant_v1 WHERE definition_id=ankle_car_definition AND variant_key='baseline';
  SELECT id INTO foot_tripod_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=47;
  SELECT id INTO foot_tripod_variant FROM coaching.exercise_variant_v1 WHERE definition_id=foot_tripod_definition AND variant_key='baseline';
  active_variant_ids:=ARRAY[exact_variant]; all_owned_variant_ids:=ARRAY[source40_variant,source875_variant,source1359_variant,exact_variant];

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=40 AND facility_id=1)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=875 AND facility_id=1)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=1359 AND facility_id=1)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition AND facility_id=1 AND legacy_exercise_id=40)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=source875_definition AND facility_id=1 AND legacy_exercise_id=875 AND status='archived')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=source1359_definition AND facility_id=1 AND legacy_exercise_id=1359)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=40 AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=875 AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=1359 AND definition_id=source1359_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source40_variant AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source875_variant AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source1359_variant AND definition_id=source1359_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=half_kneeling_variant AND definition_id=half_kneeling_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=iso_press_variant AND definition_id=iso_press_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=ankle_car_variant AND definition_id=ankle_car_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=foot_tripod_variant AND definition_id=foot_tripod_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1 WHERE exercise_id=40)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_difficulty_profile WHERE exercise_id=40)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_safety_profile WHERE exercise_id=40) THEN
    RAISE EXCEPTION '% prerequisite source or neighbor rows are missing',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=exact_variant AND definition_id<>canonical_definition)
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE slug='knee-to-wall-ankle-rockers' AND id<>canonical_definition) THEN
    RAISE EXCEPTION '% working UUID or slug already belongs to another card',migration_key;
  END IF;

  SELECT coalesce(sum(n),0) INTO protected_count FROM (
    SELECT count(*) n FROM coaching.exercise_definition_v1
      WHERE id IN(canonical_definition,source875_definition,source1359_definition)
        AND (status IN('published','deprecated') OR reviewed_by IS NOT NULL
          OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)
    UNION ALL SELECT count(*) FROM coaching.exercise_section_evidence_v1
      WHERE definition_id IN(canonical_definition,source875_definition,source1359_definition)
        AND (reviewer_user_id IS NOT NULL OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id IN(canonical_definition,source875_definition,source1359_definition)
        AND (reviewer_user_id IS NOT NULL OR reviewed_at IS NOT NULL
          OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id IN(canonical_definition,source875_definition,source1359_definition)
        AND (reviewer_user_id IS NOT NULL OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_card_review_v1
      WHERE definition_id IN(canonical_definition,source875_definition,source1359_definition)
    UNION ALL SELECT count(*) FROM coaching.exercise_card_revision_v1
      WHERE definition_id IN(canonical_definition,source875_definition,source1359_definition)
    UNION ALL SELECT count(*) FROM coaching.exercise_media_review_v1
      WHERE definition_id IN(canonical_definition,source875_definition,source1359_definition)
    UNION ALL SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=ANY(all_owned_variant_ids) OR to_variant_id=ANY(all_owned_variant_ids))
        AND (reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL OR review_status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(all_owned_variant_ids)
        AND (reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL OR status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE (survivor_definition_id IN(canonical_definition,source875_definition,source1359_definition)
          OR resolved_definition_id IN(canonical_definition,source875_definition,source1359_definition))
        AND (reviewed_by IS NOT NULL OR resolution_source='human_review')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_v1
      WHERE exercise_id=40
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
    source_kind=CASE WHEN legacy_exercise_id=40 THEN 'legacy_migration' ELSE 'duplicate_consolidation' END,
    provenance_json=jsonb_build_object(
      'source_table','coaching.exercise','migration',migration_key,
      'researchVersion',research_version,
      'sourceDisposition',CASE legacy_exercise_id
        WHEN 40 THEN 'canonical_standing_knee_to_wall_rocker_reauthored'
        ELSE 'exact_duplicate_consolidated_word_order_alias' END,
      'exactWorkingSpecification','standing_staggered_bilateral_foot_support_target_foot_tripod_fixed_knee_forward_and_return_cycle',
      'exerciseDifficultyDescribesTaskOnly',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id IN(40,875) AND definition_id=canonical_definition;

  UPDATE coaching.exercise_definition_source_v1 SET
    definition_id=canonical_definition,source_kind='duplicate_consolidation',
    provenance_json=jsonb_build_object(
      'source_table','coaching.exercise','migration',migration_key,
      'researchVersion',research_version,
      'sourceDisposition','exact_duplicate_consolidated_kicking_context',
      'resolvedFromDefinitionId',source1359_definition,
      'identityMatch','same_standing_target_foot_planted_knee_forward_and_return_cycle',
      'kickingPlantAndPivotWordingIsDeliveryContextUnlessPhysicalSportActionIsAdded',TRUE,
      'exerciseDifficultyDescribesTaskOnly',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=1359 AND definition_id=source1359_definition;

  UPDATE coaching.exercise_definition_v1 SET
    status='archived',approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,
    last_reviewed_at=NULL,
    provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'identityStatus','exact_duplicate_consolidated','survivorDefinitionId',canonical_definition,
      'selectable',FALSE,'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    updated_at=now()
  WHERE id IN(source875_definition,source1359_definition);

  UPDATE coaching.exercise_delivery_profile_v1 SET status='archived',updated_at=now()
  WHERE variant_id IN(source40_variant,source875_variant,source1359_variant);
  UPDATE coaching.exercise_variant_v1 SET
    variant_key=CASE id
      WHEN source40_variant THEN 'superseded-source-40-skeleton'
      WHEN source875_variant THEN 'superseded-source-875-skeleton'
      ELSE 'superseded-source-1359-skeleton' END,
    display_name=CASE id
      WHEN source40_variant THEN 'Knee-to-Wall Ankle Rockers Legacy Skeleton — Source 40'
      WHEN source875_variant THEN 'Ankle Knee-to-Wall Rocker Legacy Skeleton — Source 875'
      ELSE 'Ankle Knee-to-Wall Mobilization Legacy Skeleton — Source 1359' END,
    modifier_keys='{}'::TEXT[],difficulty_json='{}'::JSONB,status='archived',
    requirements_json=jsonb_build_object(
      'selectable',FALSE,'representation','superseded_source_skeleton',
      'sourceLegacyExerciseId',CASE id WHEN source40_variant THEN 40 WHEN source875_variant THEN 875 ELSE 1359 END,
      'archiveReason','exact standing support contacts endpoints return count anatomy loading budgets duration constraints substitutions persistence support and review contracts were missing',
      'replacementVariantIds',to_jsonb(active_variant_ids),'humanReviewRequired',TRUE),
    load_profile_json=jsonb_build_object('selectable',FALSE),
    fatigue_profile_json=jsonb_build_object('selectable',FALSE),
    programming_profile_json=jsonb_build_object(
      'selectionStatus','superseded_source_skeleton','selectable',FALSE,
      'publicationQuarantined',TRUE),updated_at=now()
  WHERE id IN(source40_variant,source875_variant,source1359_variant);

  INSERT INTO coaching.exercise_definition_v1(
    id,facility_id,legacy_exercise_id,slug,canonical_name,display_name,aliases,
    description,family_key,schema_version,card_version,status,
    content_confidence,scoring_confidence,media_confidence,movement_patterns,
    body_regions,required_equipment,optional_equipment,environment_json,
    population_json,provenance_json,approved_video_url,reviewed_by,approved_by,
    last_reviewed_at,anatomy_json,athlete_support_json,coach_support_json,
    support_operations_json)
  VALUES(
    canonical_definition,1,40,'knee-to-wall-ankle-rockers',
    'Standing Knee-to-Wall Ankle Rocker','Standing Knee-to-Wall Ankle Rocker',
    ARRAY['Knee-to-Wall Ankle Rockers','Ankle Knee-to-Wall Rocker','Ankle Knee-to-Wall Mobilization','Weight-Bearing Ankle Rocker','Standing Knee-to-Wall Rocker'],
    'Stand facing a stable wall or upright in a staggered stance. Keep the target-side foot flat with the heel, first metatarsal head, and fifth metatarsal head supported while the rear foot provides balance. Move the target knee forward toward the wall over the middle toes through a comfortable range without lifting the heel, then return the knee to the declared start while both feet remain planted. Count one complete forward-and-return cycle as one repetition. Foot distance, comfortable range, light fingertip balance support, visual knee target, tempo, pause, breathing, repetitions, sets, rest, and sport context are annotations. Half-kneeling, straight-knee stretching, sustained isometric pressing, added band force, elevated support, external load, rotation, calf raising, clinical measurement, or failure to return changes the task.',
    'standing_knee_to_wall_ankle_dorsiflexion_cycle','2.0.0',2,'review',88,60,50,
    ARRAY['squat','brace']::TEXT[],
    ARRAY['foot','ankle','calf','knee','hip','core']::TEXT[],
    ARRAY['wall']::TEXT[],ARRAY['none']::TEXT[],
    jsonb_build_object(
      'surface','clean flat dry stable nonslip floor suitable for bilateral standing foot support',
      'space','one wall or stable upright station with staggered-stance and side-change clearance no cross traffic and a clear controlled exit route',
      'stationCapacity',1,'equipmentKey','wall','optionalEquipment',jsonb_build_array('none'),
      'coachSightline','front-quarter and side views of both feet target heel tripod knee path pelvis trunk balance wall clearance breathing and symptoms',
      'inspection',jsonb_build_array('wall or upright stability cleanliness and clearance','floor traction cleanliness and debris','footwear compatibility','neighbor and cross-traffic separation','entry side-change exit sightline communication and emergency route'),
      'changeRule','Any stance support contact knee position target surface external force load action range dose symptom space or downstream-demand change requires full revalidation.'),
    jsonb_build_object(
      'exerciseCardDoesNotClassifyParticipants',TRUE,'readinessIsWorkoutInput',TRUE,
      'selectionPrerequisites',jsonb_build_array('safe controlled standing entry side change and exit','stable wall or upright target and nonslip floor','comfortable bilateral foot support with target heel and tripod contact','comfortable target-side forward knee travel and return','understands exact standing support complete-cycle count and stop signal','same-session foot ankle Achilles calf knee lunge squat landing sprint cutting kicking and balance budgets fit'),
      'excludeOrEscalate',jsonb_build_array('recent significant trauma surgery or procedure without applicable clearance','worsening night post-trauma sharp increasing or unfamiliar pain','new numbness tingling weakness altered circulation or loss of control','foot ankle Achilles calf knee hip or back symptoms preventing exact task','instability uncontrolled collapse or inability to stand change sides or exit safely','dizziness faintness nausea visual change chest pain unusual breathlessness disorientation or inability to communicate','clinical restriction conflicting with weight-bearing dorsiflexion or standing balance','unsafe wall floor footwear space traffic sightline or emergency route','participant requests stop'),
      'notEstablishedByEvidence',jsonb_build_array('universal eligibility normal range ideal alignment foot distance knee target or joint contribution','diagnosis treatment prevention correction readiness clearance or clinical threshold','isolated tissue or talocrural motion','one universal dose frequency fatigue ceiling recovery progression or warm-up outcome','guaranteed squat landing sprint cutting or kicking transfer','age floor or participant classification')),
    jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'canonicalAuthoredFromResearch',TRUE,
      'primaryIdentitySource','https://pmc.ncbi.nlm.nih.gov/articles/PMC7309406/',
      'legacySources',jsonb_build_array(40,875,1359),
      'identityContract','standing_staggered_bilateral_foot_support_target_foot_tripod_fixed_knee_forward_toward_wall_and_return_to_declared_start_cycle',
      'researchSources',jsonb_build_array(
        'https://pubmed.ncbi.nlm.nih.gov/23997389/',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC7309406/',
        'https://pubmed.ncbi.nlm.nih.gov/31337266/',
        'https://pubmed.ncbi.nlm.nih.gov/42486468/',
        'https://pubmed.ncbi.nlm.nih.gov/35133995/',
        'https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en'),
      'confidenceBySection',jsonb_build_object('identity',88,'taxonomy',86,'anatomy',76,'difficulty',60,'load',72,'fatigueRecovery',54,'constraints',84,'dosage',56,'instructions',88,'alternates',90,'media',50),
      'unresolvedClaims',jsonb_build_array('one universal stance foot distance range knee path joint contribution dose frequency fatigue ceiling recovery progression or outcome','numeric difficulty calibration','media playback standing-support exactness captions accessibility quality safety and approval','individual symptom interpretation or clinical eligibility'),
      'externalPlaybackVerificationPerformed',FALSE,'sourceLimitationsExplicit',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,'publicationQuarantined',TRUE),
    NULL,NULL,NULL,NULL,
    jsonb_build_object(
      'primaryMuscles',jsonb_build_array('soleus','gastrocnemius','tibialis_anterior','intrinsic_foot_stabilizers'),
      'secondaryMuscles',jsonb_build_array('fibularis_group','tibialis_posterior','quadriceps','hamstrings','gluteals','hip_and_trunk_stabilizers'),
      'joints',jsonb_build_array('interphalangeal_and_metatarsophalangeal','subtalar_and_midfoot','talocrural_ankle','knee','hip','lumbopelvic_complex'),
      'jointActions',jsonb_build_array('target_ankle_weight_bearing_dorsiflexion_during_forward_phase','target_ankle_controlled_plantarflexion_relative_return','target_knee_flexion_and_extension','foot_tripod_and_subtalar_control','rear_leg_and_trunk_balance_stabilization'),
      'planes',jsonb_build_array('sagittal','multiplanar_stabilization'),'laterality','unilateral target ankle with bilateral staggered stance support',
      'supportContacts',jsonb_build_array('target_heel','target_first_metatarsal_head','target_fifth_metatarsal_head','rear_foot'),
      'sequence',jsonb_build_array('declared_staggered_stance_start','target_knee_forward_toward_wall_over_middle_toes','comfortable_forward_endpoint','controlled_return_to_declared_start'),
      'claimsBoundary','The whole-chain weight-bearing lunge does not isolate one joint or tissue. Anatomy labels describe plausible task demands and do not prove diagnosis treatment ideal alignment clinical threshold or outcome.'),
    jsonb_build_object(
      'plainLanguageSummary','Keep your target heel and whole foot planted, glide that knee toward the wall over the middle toes, then return to the same start.',
      'expectedSensations',jsonb_build_array('gentle ankle or calf effort or stretch may occur without forcing','steady foot pressure','light balance and thigh effort','controlled forward shin movement'),
      'unexpectedSensations',jsonb_build_array('sharp increasing or unfamiliar pain','front ankle pinch catching instability or giving way','Achilles or knee pain that increases','numbness tingling weakness or circulation change','dizziness faintness nausea visual change chest pain or unusual breathlessness'),
      'selfCheck',jsonb_build_array('target_heel_and_tripod_stay_down','knee_moves_toward_wall_over_middle_toes','foot_does_not_spin_or_collapse','both_feet_stay_planted','return_reaches_same_start','breathing_continues','stop_signal_available'),
      'permissionToScaleOrStop','Move the foot closer, use a smaller comfortable range, slow down, do fewer cycles, rest longer, or use light fingertip balance support. Stop and tell the coach whenever pain, pinching, balance, sensation, breathing, vision, or confidence changes.'),
    jsonb_build_object(
      'prebrief',jsonb_build_array('confirm standing variant and no kneeling hold band load stretch or clinical test','inspect wall floor footwear space side-change and exit','screen current symptoms restrictions standing balance and target-foot loading','set side order cycles range duration and downstream budgets'),
      'observation',jsonb_build_array('both feet and floor traction','target heel and tripod','knee path and comfortable endpoint','foot rotation collapse or compensation','pelvis trunk and rear-foot balance','controlled return side change breathing symptoms first fault actual seconds and exit'),
      'cueHierarchy',jsonb_build_array('whole_target_foot_down','knee_toward_wall','middle_toes','comfortable_range','return_same_start','keep_breathing'),
      'scopeBoundary','Coach observable setup action count exposure and stop rules; do not diagnose restriction impingement instability, interpret a clinical threshold, provide treatment, promise prevention, infer clearance, or force range.'),
    jsonb_build_object(
      'accessibility',jsonb_build_array('front-quarter and side demonstration','written four-step sequence','visual floor and knee-path targets','closer foot position smaller range fewer cycles slower tempo and more rest','light fingertip balance support without unloading the target foot','still images captions transcript or live instruction','separately validated half-kneeling seated or externally assisted alternative'),
      'incidentResponse',jsonb_build_array('stop_and_stabilize','assist_controlled_standing_exit_within_scope','follow_facility_emergency_and_clinical_escalation_policy','record_variant_side_exposure_first_fault_symptom_stop_and_action','do_not_resume_without_required_reassessment'),
      'persistence',jsonb_build_array('definition_variant_profile_and_card_version','wall_floor_footwear_and_station','target_side_and_side_order','planned_and_actual_complete_cycles','foot_distance_range_knee_path_tempo_pause_and_breathing','valid_invalid_partial_and_symptom_limited_attempts','heel_tripod_foot_knee_pelvis_trunk_balance_and_first_fault','symptoms_stop_reason_rest_duration_substitution_side_change_and_exit','overlapping_ankle_lower_leg_lower_body_and_downstream_budget')))
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
    exact_variant,canonical_definition,'standing-knee-to-wall-forward-return-cycle',
    'Standing Knee-to-Wall Forward-and-Return Cycle',
    ARRAY['comfortable_range','foot_to_wall_distance','visual_knee_target','light_fingertip_balance_support','tempo','pause','breathing_prompt','complete_cycles','sets','rest_seconds','side_order','delivery_context']::TEXT[],
    jsonb_build_object(
      'technicalComplexity',18,'absoluteLoadDemand',12,'physicalDifficulty',12,
      'baseOverallDifficulty',greatest(18,12),
      'overallFormula','max_exercise_complexity_physical_difficulty',
      'scoringScope','exact_standing_knee_to_wall_forward_and_return_cycle',
      'exerciseScoresDescribeTaskOnly',TRUE,
      'participantClassificationAbsent',TRUE,
      'independentCalibrationRequired',TRUE,'humanReviewRequired',TRUE),
    jsonb_build_object(
      'selectable',TRUE,'equipment',jsonb_build_array('wall'),
      'surface','clean_flat_dry_stable_nonslip_floor',
      'base','standing_staggered_bilateral_foot_support',
      'supportContacts',jsonb_build_array('target_heel','target_first_metatarsal_head','target_fifth_metatarsal_head','rear_foot'),
      'targetFootRule','target_heel_and_tripod_remain_supported_without_spin_or_uncontrolled_collapse',
      'exactSequence',jsonb_build_array('declared_staggered_stance_start','target_knee_forward_toward_wall_over_middle_toes','comfortable_forward_endpoint','controlled_return','same_declared_start'),
      'countingRule','one_complete_forward_knee_travel_and_return_to_declared_start_is_one_repetition',
      'validCompletion','both feet remain planted target heel and tripod remain supported knee travels forward over the declared middle-toe corridor through comfortable range and controlled return restores the declared start breathing continues and no stop rule occurs',
      'invalidCompletion',jsonb_build_array('target_heel_lift','target_foot_spin_or_uncontrolled_collapse','rear_foot_step','knee_path_outside_declared_corridor','forced_wall_contact_or_range','incomplete_return','uncontrolled_bounce','added_raise_rotation_band_load_or_hold','breath_hold','symptom_stop'),
      'variantBoundaries',jsonb_build_array('support_position','knee_position','target_surface','support_height','external_force','external_load','added_action','isometric_hold','clinical_measurement','count'),
      'clinicalAssessmentOrTreatment',FALSE,'humanReviewRequired',TRUE),
    'review',
    jsonb_build_object(
      'loadingType','bodyweight_closed_chain_unilateral_target_ankle_dynamic_weight_shift',
      'externalLoadMethod','none_body_mass_through_bilateral_feet',
      'gripDemand',0,'jointStress',12,'spinalLoading',4,'eccentricStress',6,
      'landingContactsPerRep',0,'handImpactContactsPerRep',0,'impactClass','none',
      'primaryExposure',jsonb_build_array('target_ankle_weight_bearing_dorsiflexion','target_foot_tripod_support','target_knee_flexion_and_tracking','rear_foot_balance_support','controlled_forward_and_backward_center_of_mass_shift'),
      'tracking',jsonb_build_array('variant_and_profile','wall_floor_and_footwear','side_and_side_order','planned_and_actual_complete_cycles','foot_distance_and_comfortable_range','tempo_and_pauses','valid_invalid_partial_and_symptom_limited_attempts','heel_tripod_foot_rotation_knee_path_balance_and_return_faults','first_fault','symptoms','rest','duration','same_session_ankle_lower_leg_lower_body_and_sport_exposure')),
    jsonb_build_object(
      'localMuscleFatigue',12,'gripFatigue',0,'technicalFatigueSensitivity',18,
      'impactAccumulation',0,'recoveryHours',8,'recoveryRangeHours',jsonb_build_array(4,18),
      'primaryFatigueSites',jsonb_build_array('target_foot_and_ankle_stabilizers','soleus_and_calf','target_quadriceps','rear_leg_balance_support','hip_and_trunk_stabilizers','attention_to_contacts_and_return'),
      'cumulativeBudget',jsonb_build_object('completeCyclesPerSide',30,'weightBearingDorsiflexionSecondsPerSide',240,'ankleMobilityLoad',24,'calfAchillesExposure',22,'balanceSeconds',300,'technicalSensitivity',18,'impact',0),
      'interference',jsonb_build_array('later_high_priority_landing_sprint_cutting_kicking_squat_or_ankle_work','same_session_foot_ankle_Achilles_calf_knee_or_balance_loading','fatigue_that_changes_heel_tripod_knee_path_range_balance_or_return'),
      'recoveryIsPlanningEstimate',TRUE,'tissueThresholdNotEstablished',TRUE),
    jsonb_build_object(
      'trainingStimuli',jsonb_build_array('standing_weight_bearing_ankle_dorsiflexion_control','target_foot_tripod_support','controlled_sagittal_knee_and_shin_progression','staggered_stance_balance'),
      'stimulusDose',jsonb_build_object('sets',jsonb_build_array(1,3),'completeCyclesPerSide',jsonb_build_array(4,10),'secondsPerCycle',jsonb_build_array(3,8),'restSeconds',jsonb_build_array(15,45)),
      'weeklyExposure',jsonb_build_object('minimum',0,'maximumWithoutReview',7,'unit','sessions','contextDependent',TRUE),
      'prerequisites',jsonb_build_array('safe_controlled_standing_entry_side_change_and_exit','stable_wall_and_nonslip_floor','comfortable_bilateral_foot_support','target_heel_and_tripod_contact','comfortable_forward_knee_travel_and_return','understands_exact_standing_support_count_and_stop','same_session_ankle_lower_leg_lower_body_and_sport_budgets_fit'),
      'completionCriteria',jsonb_build_array('both_feet_planted','target_heel_and_tripod_supported','knee_over_declared_middle_toe_corridor','comfortable_forward_endpoint','controlled_same_start_return','stable_pelvis_and_trunk','continuous_breathing','no_stop_symptoms'),
      'sequenceRules',jsonb_build_array('prepare_and_access_context_only','do_not_turn_range_distance_visual_target_fingertip_balance_tempo_pause_breathing_dose_side_order_or_sport_context_into_hidden_variants','do_not_add_kneeling_isometric_press_band_load_elevation_rotation_raise_or_clinical_test_silently','revalidate_downstream_foot_ankle_Achilles_calf_knee_lunge_squat_landing_sprint_cutting_kicking_and_balance_load'),
      'pairingCompatibility',jsonb_build_object('compatible',jsonb_build_array('low_impact_lower_body_preparation_when_all_standing_contact_symptom_and_fatigue_budgets_fit'),'avoid',jsonb_build_array('fatiguing_ankle_or_calf_work_before_priority_landing_sprint_cutting_or_kicking','symptom_provoking_weight_bearing_dorsiflexion','time_critical_work_when_wall_station_side_change_or_reassessment_displaces_priority_training')),
      'interferenceRules',jsonb_build_array('count_all_overlapping_ankle_mobility_calf_Achilles_balance_lunge_squat_landing_sprint_cutting_and_kicking_work','stop_before_heel_tripod_knee_path_range_balance_return_or_exit_changes'),
      'uncertaintyPolicy','When exact standing support contacts endpoint return count symptoms wall safety or available time is uncertain do not select; request clarification or choose a separately validated card.',
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
  SELECT p.id,exact_variant,p.profile_key,'prepare_and_access','primary',
    CASE p.profile_key WHEN 'prepare-standing-knee-to-wall' THEN
      'Use the exact standing knee-to-wall forward-and-return cycle as low-impact ankle and lower-body preparation only when the wall station, standing balance, symptoms, duration, and cumulative ankle and lower-body budgets fit.'
    ELSE
      'Use the same exact standing cycle before kicking, striking, pivoting, planting, or decelerating only as contextual preparation; do not add the sport action or promise transfer, readiness, prevention, or performance.' END,
    CASE p.profile_key WHEN 'prepare-standing-knee-to-wall' THEN 94 ELSE 88 END,
    CASE p.profile_key WHEN 'prepare-standing-knee-to-wall' THEN 90 ELSE 84 END,
    jsonb_build_object('weight_bearing_ankle_control',94,'foot_tripod_support',90,'sagittal_knee_progression',92,'sport_context',CASE WHEN p.profile_key='prepare-kicking-plant-and-pivot' THEN 90 ELSE 72 END),
    jsonb_build_object('sets',jsonb_build_array(1,2),'completeCyclesPerSide',jsonb_build_array(4,10),'secondsPerCycle',jsonb_build_array(3,8),'restSeconds',jsonb_build_array(15,45),'exampleDoseIsNotUniversal',TRUE),
    'Both feet remain planted, the target heel and tripod remain supported without spin or uncontrolled collapse, the knee travels toward the wall over the declared middle-toe corridor through a comfortable range, the controlled return restores the declared start, breathing continues, and no stop symptom occurs.',
    ARRAY[
      'Sharp, increasing, night, post-trauma, or unfamiliar pain or participant stop request.',
      'Foot, ankle, Achilles, calf, knee, hip, or back symptoms prevent exact standing support.',
      'Pinching, catching, painful clicking, instability, giving way, uncontrolled collapse, or inability to exit safely.',
      'Numbness, tingling, weakness, altered circulation, loss of control, or another neurologic sign.',
      'Dizziness, faintness, nausea, visual change, chest pain, unusual breathlessness, disorientation, or inability to communicate.',
      'The target heel lifts, tripod is lost, foot spins, rear foot steps, or balance cannot be restored safely.',
      'Knee path, comfortable range, pelvis, trunk, or same-start return cannot be restored by reducing range, cycles, or pace.',
      'Forced wall contact, bouncing, breath holding, added kneeling, band, load, raise, rotation, hold, or another wrong task cannot be corrected safely.',
      'Wall stability, floor traction, footwear, space, traffic, hygiene, sightline, communication, or emergency route becomes unsafe.',
      'The planned cycle, range, weight-bearing ankle, calf-Achilles, balance, technical-fatigue, duration, or downstream exposure budget is reached.'
    ]::TEXT[],
    'Verify the exact standing variant, wall and floor safety, footwear, target side, foot tripod and heel tolerance, current symptoms and restrictions, planned cycles, actual range and time, and downstream lower-body work. Demonstrate stance, knee-forward path, comfortable endpoint, return, count, stop, side change, and exit. Observe feet, heel, tripod, knee path, pelvis, trunk, balance, breathing, symptoms, first fault, actual duration, and controlled exit. Do not diagnose restriction, impingement, or instability, interpret a clinical threshold, treat, or imply readiness.',
    'Keep your target heel and whole foot planted. Glide that knee toward the wall over the middle toes through a comfortable range, then return to the same start. Stop for pain, pinching, tingling, weakness, dizziness, instability, or loss of balance.',
    'More consistent control of the exact standing knee-to-wall forward-and-return cycle in the selected preparation context; no treatment, structural, readiness, prevention, or performance outcome is guaranteed.',
    ARRAY['wall']::TEXT[],
    jsonb_build_object('stationCapacity',1,'base','standing_staggered_bilateral_foot_support','requiredEquipment','wall','space','one_stable_wall_station_with_staggered_stance_side_change_and_exit_clearance','setupSeconds',20,'sideChangeSeconds',15,'coachSightline','front_quarter_and_side','crossTrafficProhibited',TRUE,'wallAndFloorInspectionRequired',TRUE,'revalidateAfterAnyChange',TRUE),
    ARRAY[half_kneeling_variant,iso_press_variant,ankle_car_variant,foot_tripod_variant]::UUID[],
    'review',
    jsonb_build_object('durationFormula','setup_seconds + side_change_seconds + sum(actual_valid_cycles * actual_seconds_per_cycle) + rest_seconds + invalid_or_partial_attempt_seconds + symptom_response_seconds + substitution_seconds + station_reset_and_exit_seconds','secondsPerCycle',jsonb_build_array(3,8),'minimumSeconds',45,'typicalSeconds',120,'maximumSecondsWithoutReview',300,'includeActualNotPlanned',TRUE,'recomputeAfterSubstitution',TRUE),
    jsonb_build_object('regressionOrder',jsonb_build_array('move_target_foot_closer','reduce_comfortable_range','use_light_fingertip_balance_support_without_unloading_target_foot','reduce_to_four_clean_cycles','slow_the_cycle','increase_rest','end_set','select_a_separately_validated_support_variant'),'progressionOrder',jsonb_build_array('complete_clean_cycles','increase_within_four_to_ten_cycle_profile','increase_comfortable_range_without_forcing_or_losing_contacts','add_brief_forward_pause','select_a_distinct_loaded_band_half_kneeling_isometric_or_sport_action_only_after_full_revalidation'),'neverScaleByForcingWallContactChasingThresholdsAddingSpeedLoadOrIgnoringSymptoms',TRUE),
    jsonb_build_object('record',jsonb_build_array('definition_variant_profile_and_card_version','wall_floor_footwear_and_station','target_side_and_side_order','planned_and_actual_complete_cycles','foot_distance_range_knee_path_tempo_pause_and_rest','valid_invalid_partial_and_symptom_limited_attempts','heel_tripod_foot_rotation_knee_pelvis_trunk_balance_and_breathing','first_fault','symptoms_and_stop_reason','weight_bearing_dorsiflexion_and_balance_seconds','duration','substitution','side_change_station_reset_and_exit'),'validUnit','one_controlled_target_knee_forward_and_return_to_declared_standing_start_with_both_feet_planted_target_heel_and_tripod_supported_clean_knee_path_stable_balance_and_no_stop','partial_cycles_do_not_count',TRUE),
    jsonb_build_object('athlete',jsonb_build_array('whole_target_foot_down','knee_toward_wall','middle_toe_corridor','comfortable_range','same_start_return','warning_symptom_and_balance_stop'),'coach',jsonb_build_array('wall_floor_footwear_and_station','support_endpoint_and_count_identity','heel_tripod_knee_path_pelvis_trunk_and_balance','valid_cycle_and_first_fault','actual_exposure_and_downstream_budget','clinical_scope','logging_and_escalation'),'accessibility',jsonb_build_array('front_quarter_and_side_demonstration','written_four_step_sequence','visual_floor_and_knee_path_targets','closer_foot_smaller_range_fewer_cycles_slower_tempo_and_more_rest','light_fingertip_balance_support','still_images_captions_transcript_or_live_instruction','separately_validated_half_kneeling_seated_or_assisted_alternative'))
  FROM (VALUES
    ('08e1c00c-ab26-40a6-a383-52dd74594e22'::UUID,'prepare-standing-knee-to-wall'),
    ('458d7b30-4e0e-437a-af35-ea13ba694176'::UUID,'prepare-kicking-plant-and-pivot')
  ) p(id,profile_key)
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
  SELECT 1,canonical_definition,i.definition_id,i.decision,i.rationale,
    jsonb_build_object('migration',migration_key,'identityBoundary',i.boundary_key,
      'canonicalContract','standing_staggered_bilateral_foot_support_target_foot_tripod_fixed_knee_forward_toward_wall_and_return_cycle',
      'neighborContract',i.neighbor_contract,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'deterministic_identity_equivalence',NULL,now()
  FROM (VALUES
    (source875_definition,'duplicate_consolidated','word_order_alias_same_standing_cycle','Source 875 is the same knee-to-wall rocker with word order changed and no different support action endpoint or count.','standing_knee_to_wall_forward_and_return_cycle'),
    (source1359_definition,'duplicate_consolidated','kicking_context_same_standing_cycle','Source 1359 adds plant and pivot transfer language but no physical pivot kick strike load or added action; the context belongs in a delivery profile.','standing_knee_to_wall_cycle_with_kicking_context'),
    (half_kneeling_definition,'distinct_exercises','standing_support_vs_half_kneeling_support','Source 41 places the rear knee on the floor and uses a half-kneeling pulse, changing support balance loading and exact repetition contract.','half_kneeling_dorsiflexion_pulse'),
    (iso_press_definition,'distinct_exercises','dynamic_return_cycle_vs_isometric_press','Source 844 sustains an isometric wall press rather than completing forward-and-return repetitions.','standing_wall_ankle_isometric_press'),
    (ankle_car_definition,'distinct_exercises','sagittal_weight_bearing_cycle_vs_circular_joint_action','Ankle CARs use a controlled circumduction sequence without the standing knee-to-wall support and endpoint contract.','controlled_ankle_circumduction')
  ) i(definition_id,decision,boundary_key,rationale,neighbor_contract)
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
    ('identity','https://pmc.ncbi.nlm.nih.gov/articles/PMC7309406/','Acute Effects of Increased Joint Mobilization Treatment Duration on Ankle Function and Dynamic Postural Control in Female Athletes With Chronic Ankle Instability','Orthopaedic Journal of Sports Medicine','peer_reviewed_research','The published knee-to-wall protocol uses standing foot alignment, planted heel, knee flexion to wall contact, and controlled foot positioning.','direct standing contact endpoint and identity context','The study uses the task as a measure around another intervention and does not define every Vortex return count fault population or publication rule.',88),
    ('taxonomy','https://pubmed.ncbi.nlm.nih.gov/23997389/','Reliability and validity of a weight-bearing measure of ankle dorsiflexion range of motion','Physiotherapy Canada','peer_reviewed_research','The lunge test is a weight-bearing measure with the target foot maintained against the ground while the knee advances toward the wall.','direct movement and support context','The study does not create Vortex taxonomy keys or prove one isolated joint contribution.',90),
    ('anatomy','https://pubmed.ncbi.nlm.nih.gov/31337266/','How Much Does the Talocrural Joint Contribute to Ankle Dorsiflexion Range of Motion During the Weight-Bearing Lunge Test? A Cross-sectional Radiographic Validity Study','Journal of Orthopaedic & Sports Physical Therapy','peer_reviewed_research','The study examined talocrural contribution to horizontal knee travel and tibial inclination during the weight-bearing lunge.','whole-chain anatomy and joint-contribution boundary','The lunge measure must not be presented as isolated talocrural motion or a single-tissue test.',92),
    ('biomechanics','https://pmc.ncbi.nlm.nih.gov/articles/PMC7309406/','Acute Effects of Increased Joint Mobilization Treatment Duration on Ankle Function and Dynamic Postural Control in Female Athletes With Chronic Ankle Instability','Orthopaedic Journal of Sports Medicine','peer_reviewed_research','The protocol monitors heel contact plus foot pronation and supination while the knee advances in a sagittal lunge.','direct support contact and path context','The study does not validate one universal foot angle knee target or maximal range for exercise delivery.',88),
    ('difficulty','https://pubmed.ncbi.nlm.nih.gov/23997389/','Reliability and validity of a weight-bearing measure of ankle dorsiflexion range of motion','Physiotherapy Canada','peer_reviewed_research','Repeatable execution requires planted-foot lunge control and observable knee-to-wall relation with low external load and no impact.','exercise-task complexity and physical-demand context','The study does not score the Vortex exercise or classify a participant.',90),
    ('load_fatigue_recovery','https://pubmed.ncbi.nlm.nih.gov/35133995/','Comparison of Alternative Methods to Improve Weight-Bearing Sagittal Plane Anterior Leg Rotation','Journal of Strength and Conditioning Research','peer_reviewed_research','The randomized trial measured weight-bearing anterior leg rotation after combined self-massage stretching and optional gastrocnemius exercise.','adjacent load and response context','The combined intervention cannot establish rocker-only effects fatigue ceilings cumulative limits or recovery hours.',88),
    ('constraints','https://pubmed.ncbi.nlm.nih.gov/42486468/','Sensory-Mapping During the Weight-Bearing Lunge Test Across Chronic Ankle Instability, Copers, and Healthy Controls','Journal of Sport Rehabilitation','peer_reviewed_research','Pain frequency and sensation location differed across chronic ankle-instability coper and control groups while stretching was common.','symptom and population boundary','Sensation alone does not establish eligibility pathology clearance or a universal normal response.',88),
    ('dosage','https://pubmed.ncbi.nlm.nih.gov/23997389/','Reliability and validity of a weight-bearing measure of ankle dorsiflexion range of motion','Physiotherapy Canada','peer_reviewed_research','A single measurement series was reliable in the studied sample.','measurement repeatability only','The study does not validate exercise repetitions sets frequency fatigue recovery or outcomes; Vortex dose remains a review-only proposal.',90),
    ('instructions','https://pmc.ncbi.nlm.nih.gov/articles/PMC7309406/','Acute Effects of Increased Joint Mobilization Treatment Duration on Ankle Function and Dynamic Postural Control in Female Athletes With Chronic Ankle Instability','Orthopaedic Journal of Sports Medicine','peer_reviewed_research','The protocol supplies observable toe-heel alignment planted heel knee-to-wall travel and foot-pronation or supination monitoring.','direct task instruction context','Vortex adds comfortable rather than maximal range return-to-start count stop persistence side-change and actual-duration rules.',88),
    ('safety_stop_rules','https://pubmed.ncbi.nlm.nih.gov/42486468/','Sensory-Mapping During the Weight-Bearing Lunge Test Across Chronic Ankle Instability, Copers, and Healthy Controls','Journal of Sport Rehabilitation','peer_reviewed_research','Pain and sensation location varied by group during the weight-bearing lunge.','symptom observation and escalation context','Facility trauma neurologic systemic balance incident scope and emergency rules remain separately required.',88),
    ('programming','https://pubmed.ncbi.nlm.nih.gov/35133995/','Comparison of Alternative Methods to Improve Weight-Bearing Sagittal Plane Anterior Leg Rotation','Journal of Strength and Conditioning Research','peer_reviewed_research','Measured lunge change after a combined intervention did not automatically transfer to the partial-squat measure.','programming transfer boundary','The study does not validate warm-up readiness landing sprint cutting kicking or injury-prevention claims for this rocker.',88),
    ('athlete_support','https://pmc.ncbi.nlm.nih.gov/articles/PMC7309406/','Acute Effects of Increased Joint Mobilization Treatment Duration on Ankle Function and Dynamic Postural Control in Female Athletes With Chronic Ankle Instability','Orthopaedic Journal of Sports Medicine','peer_reviewed_research','The knee-to-wall setup provides visible foot alignment heel contact knee travel and wall target checkpoints.','plain-language participant support','The source does not establish universal sensations symptom interpretation or accessibility.',88),
    ('coach_support','https://pubmed.ncbi.nlm.nih.gov/23997389/','Reliability and validity of a weight-bearing measure of ankle dorsiflexion range of motion','Physiotherapy Canada','peer_reviewed_research','Repeatable lunge observation depends on standardized execution and contact monitoring.','coach observation and measurement boundary','The study does not prescribe Vortex layout escalation rendering or approval.',90),
    ('accessibility','https://pubmed.ncbi.nlm.nih.gov/23997389/','Reliability and validity of a weight-bearing measure of ankle dorsiflexion range of motion','Physiotherapy Canada','peer_reviewed_research','The wall target and distance relationship make execution visually observable without complex equipment.','communication and task-scaling context','Changing to kneeling elevated or externally assisted support requires another reviewed task.',90),
    ('alternates','https://pubmed.ncbi.nlm.nih.gov/31337266/','How Much Does the Talocrural Joint Contribute to Ankle Dorsiflexion Range of Motion During the Weight-Bearing Lunge Test? A Cross-sectional Radiographic Validity Study','Journal of Orthopaedic & Sports Physical Therapy','peer_reviewed_research','Horizontal knee travel and tibial inclination are multisegment weight-bearing lunge measures.','alternate identity-boundary context','The study does not equate half-kneeling isometric banded calf-raise circular foot-control impact or clinical alternatives.',92),
    ('media','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en','Embed videos and playlists','YouTube Help','manufacturer_instruction','Five candidates returned current oEmbed title channel thumbnail and iframe metadata on 2026-08-09.','candidate metadata only','oEmbed does not prove playback standing support exact contacts action return count captions accessibility quality safety card match or approval.',82)
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
    '2026-11-09'::TIMESTAMPTZ,
    'Current YouTube oEmbed metadata only. Playback standing rather than kneeling support exact contacts forward endpoint return count captions accessibility cue quality safety reviewer identity card-version match and approval remain unverified.'
  FROM (VALUES
    ('33-GE3x-xQM','Ankle Mobility Series: Kneeling Ankle Rockers','DSTperformance','Source 40 existing candidate checked by YouTube oEmbed; title suggests possible support-position mismatch requiring full human review'),
    ('ElrpduJn92Y','Knee To Wall Exercise for Ankle Mobility','Dr. Jess Harvey, Osteopath & Health Coach','Source 40 existing candidate checked by YouTube oEmbed'),
    ('Y1IZXkdPPdw','Knee to Wall Ankle Mobility Drill','Nick Brattain','Source 40 existing candidate checked by YouTube oEmbed'),
    ('qjrNGnubve4','How To Do Ankle Rockers - Tangelo Health','Tangelo - Seattle Chiropractor + Rehab','Source 40 existing candidate checked by YouTube oEmbed'),
    ('YH7xjrkq7ic','Improve your Ankle Mobility: Knee to Wall','The Basketball Doctors','Knee-to-wall candidate checked by YouTube oEmbed')
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
    ('Standing Knee-to-Wall Ankle Rocker','same_identity','The descriptive name preserves staggered standing support planted target-foot contacts forward knee travel and return.','canonical_alias',jsonb_build_array('standing_support','planted_target_foot','forward_return_cycle'),'merge_alias'),
    ('Knee-to-Wall Ankle Rockers','same_identity','Source 40 pluralizes repetitions of the same exact cycle.','source40_alias',jsonb_build_array('legacy_exercise_40','same_cycle'),'merge_alias'),
    ('Ankle Knee-to-Wall Rocker','same_identity','Source 875 changes only word order.','source875_alias',jsonb_build_array('legacy_exercise_875','same_cycle'),'merge_alias'),
    ('Ankle Knee-to-Wall Mobilization','same_identity','Source 1359 adds kicking context but no physical pivot kick load or action.','source1359_context_alias',jsonb_build_array('legacy_exercise_1359','same_cycle','delivery_context'),'merge_alias'),
    ('Comfortable Forward Range','modifier_annotation','A smaller symptom-free knee excursion changes amplitude without changing contacts action or count.','range_annotation',jsonb_build_array('comfortable_range','same_contacts'),'delivery_annotation'),
    ('Foot-to-Wall Distance','modifier_annotation','Distance is a setup and range parameter when the rep is not a maximal clinical test.','distance_annotation',jsonb_build_array('target_distance'),'delivery_annotation'),
    ('Middle-Toe Visual Knee Target','modifier_annotation','A visual target clarifies direction without adding an action.','knee_target_annotation',jsonb_build_array('visual_target'),'delivery_annotation'),
    ('Light Fingertip Balance Support','modifier_annotation','Non-weight-bearing fingertip contact can preserve foot loading while supporting orientation.','balance_annotation',jsonb_build_array('light_fingertip_support'),'delivery_annotation'),
    ('Controlled Tempo or Brief Forward Pause','modifier_annotation','Pace and a short pause alter exposure time while preserving the cycle.','tempo_pause_annotation',jsonb_build_array('tempo','pause'),'delivery_annotation'),
    ('Repetitions Sets Rest or Side Order','modifier_annotation','Volume recovery and side sequence change delivery rather than identity.','dose_annotation',jsonb_build_array('repetitions','sets','rest','side_order'),'delivery_annotation'),
    ('Squat Landing Sprint Cutting or Kicking Context','modifier_annotation','Session intent is a delivery profile unless another sport action is physically added.','context_annotation',jsonb_build_array('delivery_context','no_added_action'),'delivery_annotation'),
    ('Half-Kneeling Ankle Dorsiflexion Pulse','new_variant','Source 41 adds rear-knee floor contact and a different base and pulse contract.','half_kneeling_variant',jsonb_build_array('support_position','rear_knee_contact'),'existing_distinct_card'),
    ('Straight-Knee Knee-to-Wall Calf Bias','new_variant','Required knee extension changes posture range tissue emphasis and endpoint.','straight_knee_variant',jsonb_build_array('knee_position'),'needs_human_review'),
    ('Band-Assisted Talocrural Mobilization','new_variant','External band force changes equipment force direction anchor safety setup and scope.','band_assisted_variant',jsonb_build_array('external_force','anchor'),'needs_human_review'),
    ('Loaded Knee-to-Wall Rocker','new_variant','External weight changes physical demand balance failure consequences dose and supervision.','loaded_variant',jsonb_build_array('external_load'),'needs_human_review'),
    ('Elevated-Heel or Elevated-Forefoot Rocker','new_variant','A wedge or plate changes support geometry joint position equipment and range interpretation.','elevated_support_variant',jsonb_build_array('support_surface','equipment'),'needs_human_review'),
    ('Wall Ankle Dorsiflexion Iso Press','new_definition','Source 844 sustains an isometric press instead of forward-and-return repetitions.','iso_press_distinct',jsonb_build_array('isometric_action'),'existing_distinct_definition'),
    ('Ankle CARs','new_definition','Source 42 uses controlled circumduction rather than a weight-bearing sagittal lunge.','ankle_car_distinct',jsonb_build_array('circular_action'),'existing_distinct_definition'),
    ('Calf Raise to Controlled Heel Drop','new_definition','Source 44 raises and lowers the heel instead of keeping it planted.','calf_raise_distinct',jsonb_build_array('plantarflexion_raise','heel_lift'),'existing_distinct_definition'),
    ('Foot Tripod Weight Shifts','new_definition','Source 47 shifts foot pressure without the wall endpoint and exact dorsiflexion cycle.','foot_shift_distinct',jsonb_build_array('foot_pressure_shift'),'existing_distinct_definition'),
    ('Static Wall Calf Stretch','new_definition','A sustained calf stretch uses a hold endpoint and tissue-bias contract rather than repeated cycles.','calf_stretch_distinct',jsonb_build_array('static_hold'),'research_queue'),
    ('Ankle Pogo in Place','new_definition','Pogos add repeated impact rebound flight landing and contact counting.','pogo_distinct',jsonb_build_array('impact','flight','rebound'),'existing_distinct_definition'),
    ('Clinical Weight-Bearing Lunge Test','new_definition','A clinical test adds standardized maximal measurement interpretation comparison documentation consent and referral scope.','clinical_test_distinct',jsonb_build_array('clinical_scope','maximal_measurement'),'research_queue'),
    ('Ankle Pain Impingement or Instability Assessment','new_definition','Assessment of symptoms or pathology requires clinical authority and cannot be inferred from exercise response.','clinical_assessment_distinct',jsonb_build_array('clinical_scope','diagnosis'),'research_queue')
  ) a(name,classification,rationale,boundary_key,facts,proposed_status)
  ON CONFLICT(definition_id,reviewed_card_version,alternate_name) DO UPDATE SET
    classification=EXCLUDED.classification,rationale=EXCLUDED.rationale,
    distinguishing_dimensions=EXCLUDED.distinguishing_dimensions,
    proposed_card_json=EXCLUDED.proposed_card_json,review_status='candidate',
    reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_relationship_v1(
    from_variant_id,to_variant_id,relationship,similarity_score,dimensions,reason,
    conditions_json,review_status,created_by,reviewed_by,reviewed_at)
  SELECT r.from_id,r.to_id,r.relationship,r.score,r.dimensions,r.reason,
    jsonb_build_object('migration',migration_key,'reviewOnly',TRUE,'automaticSubstitution',FALSE,
      'revalidate',jsonb_build_array('identity and purpose','support contacts endpoint action and count','wall floor footwear equipment space and side change','symptoms and restrictions','dose duration and logistics','foot ankle Achilles calf knee lower-body balance and sport budgets','persistence','coach rendering','athlete rendering'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'review',NULL,NULL,NULL
  FROM (VALUES
    (exact_variant,half_kneeling_variant,'regression',64,ARRAY['stability','complexity','range']::TEXT[],'Moves to half-kneeling support and a pulse contract; use only after full support and duration reselection.'),
    (exact_variant,iso_press_variant,'lateral_substitution',54,ARRAY['complexity','fatigue','range']::TEXT[],'Changes the dynamic cycle to an isometric press with a different endpoint count and exposure measure.'),
    (exact_variant,ankle_car_variant,'lateral_substitution',44,ARRAY['complexity','range','stability']::TEXT[],'Changes weight-bearing sagittal knee travel to controlled ankle circumduction and a different support contract.'),
    (exact_variant,foot_tripod_variant,'regression',58,ARRAY['stability','complexity','range']::TEXT[],'Emphasizes foot pressure and balance without the knee-to-wall endpoint; it is a different task and not automatic.')
  ) r(from_id,to_id,relationship,score,dimensions,reason)
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
    CASE d.dimension WHEN 'technicalComplexity' THEN 18 ELSE 12 END,
    CASE d.dimension WHEN 'technicalComplexity' THEN 20 ELSE 20 END,
    CASE d.dimension WHEN 'technicalComplexity' THEN
      'Review-only exercise-complexity anchor based on standing staggered support, target heel and tripod contact, knee-path control, comfortable endpoint, same-start return, balance, breathing, quality gates, and valid cycle count.'
    ELSE
      'Review-only physical-difficulty anchor based on bodyweight through bilateral feet, unilateral target-ankle dorsiflexion, calf and foot support, knee progression, low external load, and no impact.'
    END||' This scores the exercise task, not the participant.',
    'review',1,NULL,NULL,
    'Research-informed proposal only; independent comparison and qualified human approval remain required.',NULL
  FROM (VALUES('technicalComplexity'),('absoluteLoadDemand')) d(dimension)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
    proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,reviewed_by=NULL,
    review_notes=EXCLUDED.review_notes,reviewed_at=NULL,updated_at=now();

  UPDATE coaching.exercise SET
    name='Standing Knee-to-Wall Ankle Rocker',slug='knee-to-wall-ankle-rockers',
    description='Stand facing a stable wall or upright in a staggered stance. Keep the target-side foot flat with the heel, first metatarsal head, and fifth metatarsal head supported while the rear foot provides balance. Move the target knee forward toward the wall over the middle toes through a comfortable range without lifting the heel, then return to the declared start while both feet remain planted. Count one complete forward-and-return cycle as one repetition.',
    instructions='Use the exact canonical standing variant at a stable wall on a clean nonslip floor. Plant both feet in a staggered stance and keep the target heel and tripod down. Glide the target knee toward the wall over the middle toes through a comfortable range, then return to the same start to count one repetition. Change sides under control and keep breathing. Stop for pain, pinching, instability, numbness, tingling, weakness, altered circulation, dizziness, faintness, nausea, visual change, chest pain, unusual breathlessness, loss of balance, unsafe wall or floor, or participant request.',
    skill_level=NULL,age_min=NULL,age_max=NULL,
    default_sets=1,default_reps=6,default_work_seconds=40,default_rest_seconds=20,
    tempo='controlled three to eight seconds per complete forward-and-return cycle',
    load_note='Track wall, floor, footwear, target side, side order, planned and actual complete cycles, foot distance, comfortable range, knee path, tempo, pauses, heel and tripod continuity, foot rotation, balance, pelvis and trunk faults, first fault, symptoms, invalid or partial attempts, weight-bearing dorsiflexion time, rest, duration, substitution, side change, exit, and overlapping foot ankle Achilles calf knee lunge squat landing sprint cutting kicking and balance exposure.',
    est_seconds_per_set=120,is_published=FALSE,archived=FALSE,
    card_summary='Standing staggered-stance target-foot-planted knee-to-wall forward-and-return ankle dorsiflexion cycle.',
    coach_language='Verify exact standing support, stable wall, nonslip floor, footwear, target side, heel and tripod contact, comfortable knee path and return, restrictions, symptoms, planned cycles, actual range and time, first fault, duration, downstream ankle and lower-body budget, persistence, controlled side change and exit, and escalation.',
    athlete_language='Keep your target heel and whole foot planted. Glide that knee toward the wall over the middle toes through a comfortable range, then return to the same start. Stop for pain, pinching, tingling, weakness, dizziness, instability, or loss of balance.',
    programming_logic=jsonb_build_object(
      'selectionStatus','canonical_variant_required','selectable',TRUE,
      'canonicalDefinitionId',canonical_definition,'exactVariantIds',to_jsonb(active_variant_ids),
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'exerciseDifficultyDescribesTaskOnly',TRUE,
      'selectionInputs',jsonb_build_array('workout purpose and delivery context','stable wall floor footwear station and exit','standing balance and foot ankle Achilles calf knee tolerance','exact heel tripod knee path endpoint and return count comprehension','cycle dose pace range rest side order and duration','cumulative ankle lower-leg lower-body landing sprint cutting kicking and balance exposure','coach scope and sightline'),
      'substitutionRevalidation',jsonb_build_array('identity','support contacts endpoint action and count','wall floor footwear equipment space and side change','restrictions and symptoms','purpose','dose','fatigue and impact budgets','duration','logistics','persistence','coach rendering','athlete rendering'),
      'consolidatedLegacySourceIds',jsonb_build_array(40,875,1359),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    scalable_variables=ARRAY['comfortable_range','foot_to_wall_distance','visual_knee_target','light_fingertip_balance_support','tempo','forward_pause','breathing_prompt','complete_cycles','rest_seconds','sets','side_order','delivery_context']::TEXT[],
    movement_family='Standing knee-to-wall ankle dorsiflexion cycle',
    primary_phase_key='prepare_and_access',phase_subrole='mobilize',
    primary_order_slot='ankle_mobility',
    movement_requirements=jsonb_build_object(
      'impact_level',0,'balance_demand','stable_to_low','postural_shape','standing_staggered_stance',
      'primary_tissues',jsonb_build_array('soleus','gastrocnemius','Achilles_tendon','ankle_and_foot_structures'),
      'breathing_demand','continuous_relaxed_breathing','coordination_demand','low',
      'primary_joint_actions',jsonb_build_array('target_ankle_weight_bearing_dorsiflexion','target_knee_flexion_and_extension','foot_tripod_control'),
      'supportContacts',jsonb_build_array('target_heel','target_first_metatarsal_head','target_fifth_metatarsal_head','rear_foot'),
      'exactSequence',jsonb_build_array('declared_start','knee_forward','comfortable_endpoint','same_start_return'),
      'exerciseDifficulty',jsonb_build_object('complexity',18,'physicalDifficulty',12,'overall',18,'formula','max')),
    coaching_execution=jsonb_build_object(
      'setup',jsonb_build_array('stable wall or upright and clean nonslip floor','standing staggered stance facing wall','target foot flat with heel and tripod supported','rear foot planted for balance','target knee aligned toward middle toes','comfortable starting distance and clear side-change exit'),
      'execution_steps',jsonb_build_array('glide target knee toward wall over middle toes','keep target heel and tripod planted','stop at a comfortable forward endpoint without forcing wall contact','return to the declared start under control','count only the complete forward-and-return cycle','change sides under control'),
      'coach_cues',jsonb_build_array('whole foot down','knee toward wall','middle toes','comfortable range','return to start','keep breathing'),
      'athlete_cues',jsonb_build_array('heel and whole foot stay down','knee toward the wall','smooth forward and back','no pinching'),
      'common_faults',jsonb_build_array('heel lifting','foot spinning outward','arch or tripod collapsing','knee leaving the declared corridor','rear foot stepping','forcing wall contact','bouncing','partial return','adding a calf raise rotation or hold'),
      'quality_gate',jsonb_build_array('both feet planted','target heel and tripod supported','clean knee path','comfortable endpoint','same-start return','stable balance','continuous breathing','no stop symptom'),
      'stop_signs',jsonb_build_array('sharp increasing night post-trauma or unfamiliar pain','front-ankle pinch Achilles or knee pain that increases','instability giving way or uncontrolled collapse','numbness tingling weakness or circulation change','dizziness faintness nausea visual change chest pain unusual breathlessness or disorientation','unsafe wall floor footwear space or exit','participant stop request'),
      'breathing_cues',jsonb_build_array('breathe continuously','exhale gently during forward travel if helpful','do not hold breath to force range'),
      'clinical_scope','This is a workout exercise, not a diagnostic weight-bearing lunge test, treatment, clearance, or proof of readiness.'),
    pairing_logic=jsonb_build_object(
      'sameSessionBudget',jsonb_build_array('complete_cycles_per_side','weight_bearing_dorsiflexion_seconds','ankle_mobility_load','foot_tripod_support','calf_Achilles_exposure','balance_seconds','technical_fatigue','downstream_lunge_squat_landing_sprint_cutting_kicking_and_lower_body_work','impact'),
      'avoidAutomaticPairingWith',jsonb_build_array('fatiguing_ankle_or_calf_work_before_priority_landing_sprint_cutting_or_kicking','symptom_provoking_weight_bearing_dorsiflexion','same_session_ankle_or_lower_body_work_exceeding_budget'),
      'revalidateAfterSubstitution',TRUE),
    media_library=jsonb_build_object(
      'candidate_video_ids',jsonb_build_array('33-GE3x-xQM','ElrpduJn92Y','Y1IZXkdPPdw','qjrNGnubve4','YH7xjrkq7ic'),
      'reviewState','oembed_metadata_only_candidate_quarantine',
      'playbackStandingSupportExactnessContactsActionReturnCountCaptionsAccessibilityQualitySafetyAndApprovalVerified',FALSE,
      'humanReviewRequired',TRUE),
    participant_structure='individual',programming_kind='exercise',linked_skill_id=NULL,
    why_publish_ready=FALSE,updated_at=now()
  WHERE id=40;

  UPDATE coaching.exercise SET
    skill_level=NULL,age_min=NULL,age_max=NULL,is_published=FALSE,archived=TRUE,
    programming_logic=coalesce(programming_logic,'{}'::JSONB)||jsonb_build_object(
      'selectionStatus','duplicate_consolidated','selectable',FALSE,
      'canonicalDefinitionId',canonical_definition,'exactVariantIds',to_jsonb(active_variant_ids),
      'survivorLegacyExerciseId',40,'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    linked_skill_id=NULL,why_publish_ready=FALSE,updated_at=now()
  WHERE id IN(875,1359);

  UPDATE coaching.exercise_safety_profile SET
    risk_level=1,impact_level=0,minimum_age_recommended=NULL,
    minimum_skill_level=NULL,requires_spotting=FALSE,
    requires_coach_supervision='recommended',
    minimum_prerequisite_notes='Readiness uses safe standing entry side change and exit, stable wall and nonslip floor, comfortable bilateral foot support, target heel and tripod contact, exact forward-and-return cycle comprehension, current symptoms, communication, workout dose, and downstream ankle and lower-body loading; never participant classification or age.',
    readiness_checks=ARRAY[
      'Confirm exact standing variant, stable wall or upright, clean nonslip floor, footwear, staggered-stance and side-change clearance, sightline, communication, and emergency route.',
      'Confirm foot ankle Achilles calf knee hip back and standing-balance tolerance and no current symptom or restriction conflict.',
      'Confirm the participant understands target heel and tripod contact, knee path, comfortable endpoint, complete return count, stop signal, side change, and controlled exit.',
      'Review cumulative cycles, weight-bearing dorsiflexion time, foot and ankle load, calf-Achilles exposure, balance, technical fatigue, and later lunge squat landing sprint cutting kicking or lower-body demand.'
    ]::TEXT[],
    stop_signs=ARRAY[
      'Sharp, increasing, night, post-trauma, or unfamiliar pain, guarding, or participant stop request.',
      'Foot, ankle, Achilles, calf, knee, hip, or back symptoms prevent exact standing support.',
      'Pinching, catching, painful clicking, instability, giving way, uncontrolled collapse, or inability to exit safely.',
      'Numbness, tingling, weakness, altered circulation, loss of control, or another neurologic sign.',
      'Dizziness, faintness, nausea, visual change, chest pain, unusual breathlessness, disorientation, or inability to communicate.',
      'The target heel lifts, tripod is lost, foot spins, rear foot steps, or balance cannot be restored safely.',
      'Knee path, comfortable range, pelvis, trunk, or complete return cannot be restored despite reduced range, cycles, or pace.',
      'Wall, floor, footwear, space, traffic, hygiene, sightline, communication, duration, budget, or emergency route becomes inadequate.'
    ]::TEXT[],
    contraindications=ARRAY[
      'Current symptoms, trauma, procedure, instability, or clinical restrictions conflict with weight-bearing dorsiflexion, planted-foot support, or standing balance.',
      'No stable wall or upright, clean nonslip floor, appropriate footwear, controlled entry side change and exit, sightline, communication, or emergency route.',
      'The intended service is diagnosis, treatment, injury management, readiness clearance, maximal clinical measurement, manual assistance, band mobilization, isometric press, half-kneeling pulse, calf raise, sport action, or another exercise identity.'
    ]::TEXT[],
    common_substitutions=ARRAY[
      'Use Half-Kneeling Ankle Dorsiflexion Pulse only when the changed support and pulse contract fit and all checks are rerun.',
      'Use Wall Ankle Dorsiflexion Iso Press, Ankle CARs, or Foot Tripod Weight Shifts only when the changed action and count fit and all checks are rerun.',
      'Do not infer that banded, loaded, elevated, straight-knee, clinical-test, calf-raise, or sport-action versions are equivalent.',
      'Author and review any changed-support, external-force, loaded, or added-action alternative before selection.'
    ]::TEXT[]
  WHERE exercise_id=40;

  UPDATE coaching.exercise_score_v1 SET
    technical_complexity=18,absolute_load_demand=12,coordination_demand=16,
    impact=1,supervision_demand=12,base_overall_difficulty=greatest(18,12),
    legacy_scores=coalesce(legacy_scores,'{}'::JSONB)||jsonb_build_object(
      'candidateReassessment',migration_key,
      'projectionScope','standing_knee_to_wall_forward_and_return_exact_variant',
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'variantScores',jsonb_build_object('standingKneeToWallRocker',
        jsonb_build_object('complexity',18,'physicalDifficulty',12,'overall',18)),
      'exerciseScoresDescribeTaskOnly',TRUE,'independentCalibrationRequired',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    migration_confidence=60,human_review_status='queued',reviewed_by=NULL,reviewed_at=NULL,
    review_notes='Research-informed candidate reassessment only. Scores describe exercise complexity and physical difficulty, not participant classification, age, readiness, or proficiency. Exact standing support contacts endpoints return count and independent calibration remain required.',
    updated_at=now()
  WHERE exercise_id=40;

  UPDATE coaching.exercise_difficulty_profile SET
    technical=1.8,complexity=1.8,load=1.2,overall=1.8,
    recommended_age_min=NULL,recommended_age_max=NULL,attention_demand='low',
    notes='Candidate projection from the exact standing staggered-stance knee-to-wall forward-and-return variant. Complexity is 18/100, physical difficulty 12/100, and overall 18/100 by maximum. This is not participant classification, readiness, age, or proficiency.',
    source='canonical_research_candidate',updated_at=now()
  WHERE exercise_id=40;

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  VALUES(canonical_definition,1,2,'2.0.0',migration_key,'quarantined',
    jsonb_build_object(
      'identity',jsonb_build_object('passed',TRUE,'identityKey','standing_staggered_bilateral_foot_support_target_foot_tripod_fixed_knee_forward_and_return_cycle','legacySources',3,'activeVariants',1,'archivedSourceSkeletons',3,'exactDuplicateConsolidations',2,'neighborBoundaries',3),
      'taxonomy',jsonb_build_object('passed',TRUE,'controlledTerms',TRUE,'movementPatterns',jsonb_build_array('squat','brace'),'bodyRegions',jsonb_build_array('foot','ankle','calf','knee','hip','core'),'equipment',jsonb_build_array('wall')),
      'anatomy',jsonb_build_object('passed',TRUE,'musclesJointsActionsPlanesLateralityContactsSequenceAndWholeChainBoundary',TRUE),
      'difficulty',jsonb_build_object('passed',TRUE,'model','max_exercise_complexity_physical_difficulty','variantVectors',jsonb_build_array('18/12/18'),'participantClassificationAbsent',TRUE,'independentCalibrationRequired',TRUE),
      'loadFatigueRecovery',jsonb_build_object('passed',TRUE,'actualCyclesRangeContactsFaultSymptomsAndOverlappingAnkleLowerBodyExposureTracked',TRUE,'impactNone',TRUE,'recoveryIsPlanningEstimate',TRUE),
      'constraints',jsonb_build_object('passed',TRUE,'standingBalanceWallFloorFootwearContactsSymptomsRestrictionsSpaceTrafficScopeAndEmergencyRoute',TRUE),
      'delivery',jsonb_build_object('passed',TRUE,'profiles',2,'generalAndKickingContextPrepare',TRUE,'durationDoseRestStationSideChangeExitAndSubstitutionRevalidation',TRUE),
      'instructions',jsonb_build_object('passed',TRUE,'athleteCoachAccessibilityAndSupportOperations',TRUE,'contactsEndpointReturnSymptomsStandingBalanceAndClinicalScope',TRUE),
      'research',jsonb_build_object('passed',TRUE,'sections',16,'registryVersion',research_version,'directAndAdjacentEvidenceSeparated',TRUE,'exampleDoseNotUniversal',TRUE),
      'media',jsonb_build_object('passed',FALSE,'candidateCount',5,'currentOEmbedMetadataHealthy',TRUE,'playbackReviewed',FALSE,'standingExactVariantReviewed',FALSE,'captionsAccessibilityQualitySafetyAndApprovalReviewed',FALSE),
      'relationships',jsonb_build_object('passed',FALSE,'reviewOnly',4,'approved',0,'automaticSubstitution',FALSE),
      'calibration',jsonb_build_object('passed',FALSE,'reviewOnly',2,'approved',0),
      'alternates',jsonb_build_object('passed',TRUE,'assessments',24,'sameIdentity',4,'modifierAnnotations',7,'newVariants',5,'newDefinitions',8,'singleExactVariant',TRUE),
      'generationSupport',jsonb_build_object('passed',TRUE,'selectionConstraints',TRUE,'cumulativeFatigueAndImpactBudgets',TRUE,'duration',TRUE,'wallStationStandingBalanceAndSideChange',TRUE,'substitutionRevalidation',TRUE,'renderingAndPersistence',TRUE),
      'publication',jsonb_build_object('passed',FALSE,'reviewer',NULL,'approver',NULL)),
    jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01','message','A qualified human must watch all five candidates in full and verify playback, standing rather than kneeling support, exact contacts, forward endpoint, return count, range, captions, accessibility, cue quality, safety, conflicts, reviewer identity, timestamp, card version, and approval rationale.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','A qualified coach must approve or reject all four relationships; no automatic substitution to half-kneeling, isometric, circular, foot-control, banded, loaded, elevated, calf-raise, clinical, or sport-action tasks is authorized.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','An independent qualified reviewer must calibrate exercise complexity 18 and physical difficulty 12. Scores do not classify a participant or create an age, readiness, or proficiency level.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','A qualified reviewer and separate approver must complete content review before publication. Identity consolidation, anatomy, whole-chain loading, standing and wall safety, clinical scope, dose, stop, accessibility, persistence, sport-context, and support rules remain quarantined.')),
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
        AND anatomy_json<>'{}'::JSONB AND environment_json<>'{}'::JSONB
        AND population_json<>'{}'::JSONB AND athlete_support_json<>'{}'::JSONB
        AND coach_support_json<>'{}'::JSONB AND support_operations_json<>'{}'::JSONB
        AND provenance_json->>'approvalsCreated'='false')
    OR (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id IN(source875_definition,source1359_definition) AND status='archived'
        AND provenance_json->>'identityStatus'='exact_duplicate_consolidated')<>2
    OR (SELECT count(*) FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id IN(40,875,1359) AND definition_id=canonical_definition
        AND source_kind IN('legacy_migration','duplicate_consolidation')
        AND provenance_json->>'approvalsCreated'='false')<>3
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id IN(source40_variant,source875_variant,source1359_variant)
        AND status='archived'
        AND requirements_json->>'representation'='superseded_source_skeleton')<>3
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=exact_variant AND definition_id=canonical_definition AND status='review'
        AND requirements_json->>'selectable'='true'
        AND (difficulty_json->>'technicalComplexity')::INTEGER=18
        AND (difficulty_json->>'physicalDifficulty')::INTEGER=12
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=greatest(18,12)
        AND (load_profile_json->>'landingContactsPerRep')::INTEGER=0
        AND (fatigue_profile_json->>'impactAccumulation')::INTEGER=0
        AND programming_profile_json->>'publicationQuarantined'='true') THEN
    RAISE EXCEPTION '% definition variant source consolidation or quarantine assertion failed',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=exact_variant AND status='review'
        AND cardinality(equipment_required)>0
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
      WHERE (from_variant_id=exact_variant OR to_variant_id=exact_variant)
        AND review_status='review' AND reviewed_by IS NULL)<>4
    OR (SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=exact_variant AND status='review' AND reviewed_by IS NULL)<>2
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=canonical_definition AND reviewed_by IS NULL)<>5
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=canonical_definition AND decision='duplicate_consolidated'
        AND resolved_definition_id IN(source875_definition,source1359_definition)
        AND reviewed_by IS NULL)<>2
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=canonical_definition AND decision='distinct_exercises'
        AND reviewed_by IS NULL)<>3 THEN
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
      WHERE (r.from_variant_id=exact_variant OR r.to_variant_id=exact_variant)
        AND dimension<>ALL(ARRAY['load','leverage','range','speed','stability','complexity','impact','decision_demand','fatigue']))
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=exact_variant OR to_variant_id=exact_variant)
        AND review_status='approved') THEN
    RAISE EXCEPTION '% relationship dimension or approval assertion failed',migration_key;
  END IF;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=40
      AND skill_level IS NULL AND age_min IS NULL AND age_max IS NULL
      AND linked_skill_id IS NULL AND is_published=FALSE AND archived=FALSE
      AND programming_kind='exercise' AND why_publish_ready=FALSE)
    OR (SELECT count(*) FROM coaching.exercise WHERE id IN(875,1359)
      AND skill_level IS NULL AND age_min IS NULL AND age_max IS NULL
      AND linked_skill_id IS NULL AND is_published=FALSE AND archived=TRUE
      AND why_publish_ready=FALSE)<>2
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1
      WHERE exercise_id=40 AND technical_complexity=18
        AND absolute_load_demand=12 AND base_overall_difficulty=18
        AND human_review_status='queued' AND reviewed_by IS NULL AND reviewed_at IS NULL)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=canonical_definition AND card_version=2
        AND status='quarantined' AND human_review_required=TRUE
        AND jsonb_array_length(blocking_issues_json)=4) THEN
    RAISE EXCEPTION '% legacy projection or packet assertion failed',migration_key;
  END IF;
END
$migration$;
