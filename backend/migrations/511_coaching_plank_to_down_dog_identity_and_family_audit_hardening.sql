-- Sources 39, 675, and 795: consolidate the same fixed-support high-plank to
-- inverted-V and back cycle, replace skeletal variants with one exact task,
-- and preserve pike/down-dog/wave/rock wording as traceable aliases or cues.
-- Evidence, media, graph, calibration, content, and publication authority are
-- human-only. Exercise difficulty describes the task, never the participant.
DO $migration$
DECLARE
  migration_key CONSTANT TEXT := '511_coaching_plank_to_down_dog_identity_and_family_audit_hardening';
  research_version CONSTANT TEXT := '2026-08-09.106';
  canonical_definition UUID;
  source675_definition UUID;
  source795_definition UUID;
  source39_variant UUID;
  source675_variant UUID;
  source795_variant UUID;
  exact_variant UUID;
  active_variant_ids UUID[];
  all_owned_variant_ids UUID[];
  plank_hold_definition UUID;
  plank_hold_variant UUID;
  calf_pedal_definition UUID;
  calf_pedal_variant UUID;
  pike_push_definition UUID;
  pike_push_variant UUID;
  inchworm_definition UUID;
  inchworm_variant UUID;
  protected_count INTEGER;
BEGIN
  SELECT id INTO canonical_definition FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND legacy_exercise_id=39;
  SELECT id INTO source675_definition FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND legacy_exercise_id=675;
  SELECT id INTO source795_definition FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND legacy_exercise_id=795;
  SELECT id INTO source39_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=canonical_definition AND variant_key='baseline';
  SELECT id INTO source675_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=source675_definition AND variant_key='baseline';
  SELECT id INTO source795_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=canonical_definition AND variant_key='legacy-source-795-baseline';
  SELECT coalesce((SELECT id FROM coaching.exercise_variant_v1
    WHERE definition_id=canonical_definition AND variant_key='fixed-support-plank-to-down-dog-cycle'),gen_random_uuid())
  INTO exact_variant;
  SELECT id INTO plank_hold_definition FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND legacy_exercise_id=827;
  SELECT id INTO plank_hold_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=plank_hold_definition AND variant_key='stable-floor-forearm-toes-standard';
  SELECT id INTO calf_pedal_definition FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND legacy_exercise_id=876;
  SELECT id INTO calf_pedal_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=calf_pedal_definition AND variant_key='baseline';
  SELECT id INTO pike_push_definition FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND legacy_exercise_id=586;
  SELECT id INTO pike_push_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=pike_push_definition AND variant_key='baseline';
  SELECT id INTO inchworm_definition FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND legacy_exercise_id=29;
  SELECT id INTO inchworm_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=inchworm_definition AND variant_key='stationary-hand-return';
  active_variant_ids:=ARRAY[exact_variant];
  all_owned_variant_ids:=ARRAY[source39_variant,source675_variant,source795_variant,exact_variant];

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=39 AND facility_id=1)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=675 AND facility_id=1)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=795 AND facility_id=1)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition AND facility_id=1 AND legacy_exercise_id=39)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=source675_definition AND facility_id=1 AND legacy_exercise_id=675)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=source795_definition AND facility_id=1 AND legacy_exercise_id=795 AND status='archived')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=39 AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=675 AND definition_id=source675_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=795 AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source39_variant AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source675_variant AND definition_id=source675_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source795_variant AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=plank_hold_variant AND definition_id=plank_hold_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=calf_pedal_variant AND definition_id=calf_pedal_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=pike_push_variant AND definition_id=pike_push_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=inchworm_variant AND definition_id=inchworm_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1 WHERE exercise_id=39)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_difficulty_profile WHERE exercise_id=39)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_safety_profile WHERE exercise_id=39) THEN
    RAISE EXCEPTION '% prerequisite source or neighbor rows are missing',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=exact_variant AND definition_id<>canonical_definition)
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE slug='down-dog-to-plank-wave' AND id<>canonical_definition) THEN
    RAISE EXCEPTION '% working UUID or slug already belongs to another card',migration_key;
  END IF;

  SELECT coalesce(sum(n),0) INTO protected_count FROM (
    SELECT count(*) n FROM coaching.exercise_definition_v1
      WHERE id IN(canonical_definition,source675_definition,source795_definition)
        AND (status IN('published','deprecated') OR reviewed_by IS NOT NULL
          OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)
    UNION ALL SELECT count(*) FROM coaching.exercise_section_evidence_v1
      WHERE definition_id IN(canonical_definition,source675_definition,source795_definition)
        AND (reviewer_user_id IS NOT NULL OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id IN(canonical_definition,source675_definition,source795_definition)
        AND (reviewer_user_id IS NOT NULL OR reviewed_at IS NOT NULL
          OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id IN(canonical_definition,source675_definition,source795_definition)
        AND (reviewer_user_id IS NOT NULL OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_card_review_v1
      WHERE definition_id IN(canonical_definition,source675_definition,source795_definition)
    UNION ALL SELECT count(*) FROM coaching.exercise_card_revision_v1
      WHERE definition_id IN(canonical_definition,source675_definition,source795_definition)
    UNION ALL SELECT count(*) FROM coaching.exercise_media_review_v1
      WHERE definition_id IN(canonical_definition,source675_definition,source795_definition)
    UNION ALL SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=ANY(all_owned_variant_ids) OR to_variant_id=ANY(all_owned_variant_ids))
        AND (reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL OR review_status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(all_owned_variant_ids)
        AND (reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL OR status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE (survivor_definition_id IN(canonical_definition,source675_definition,source795_definition)
          OR resolved_definition_id IN(canonical_definition,source675_definition,source795_definition))
        AND (reviewed_by IS NOT NULL OR resolution_source='human_review')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_v1
      WHERE exercise_id=39
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
    source_kind=CASE WHEN legacy_exercise_id=39 THEN 'legacy_migration' ELSE 'duplicate_consolidation' END,
    provenance_json=jsonb_build_object(
      'source_table','coaching.exercise','migration',migration_key,
      'researchVersion',research_version,
      'sourceDisposition',CASE legacy_exercise_id
        WHEN 39 THEN 'canonical_source_reauthored'
        WHEN 675 THEN 'exact_duplicate_consolidated_plank_to_pike_alias'
        ELSE 'exact_duplicate_consolidated_rocking_plank_alias' END,
      'exactWorkingSpecification','fixed_bilateral_palms_and_forefeet_high_plank_to_comfortable_inverted_v_and_return_to_same_high_plank_cycle',
      'waveAndRockAreCuesUnlessTheyAddRequiredArticulation',TRUE,
      'exerciseDifficultyDescribesTaskOnly',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id IN(39,795) AND definition_id=canonical_definition;

  UPDATE coaching.exercise_definition_source_v1 SET
    definition_id=canonical_definition,source_kind='duplicate_consolidation',
    provenance_json=jsonb_build_object(
      'source_table','coaching.exercise','migration',migration_key,
      'researchVersion',research_version,
      'sourceDisposition','exact_duplicate_consolidated_plank_to_pike_alias',
      'resolvedFromDefinitionId',source675_definition,
      'identityMatch','same_fixed_palms_and_forefeet_tall_plank_to_pike_and_return_cycle',
      'exerciseDifficultyDescribesTaskOnly',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=675 AND definition_id=source675_definition;

  UPDATE coaching.exercise_definition_v1 SET
    status='archived',approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,
    last_reviewed_at=NULL,
    provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'identityStatus','exact_duplicate_consolidated','survivorDefinitionId',canonical_definition,
      'selectable',FALSE,'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    updated_at=now()
  WHERE id IN(source675_definition,source795_definition);

  UPDATE coaching.exercise_delivery_profile_v1 SET status='archived',updated_at=now()
  WHERE variant_id IN(source39_variant,source675_variant,source795_variant);
  UPDATE coaching.exercise_variant_v1 SET
    variant_key=CASE id
      WHEN source39_variant THEN 'superseded-source-39-skeleton'
      WHEN source675_variant THEN 'superseded-source-675-skeleton'
      ELSE 'superseded-source-795-skeleton' END,
    display_name=CASE id
      WHEN source39_variant THEN 'Down Dog to Plank Wave Legacy Skeleton — Source 39'
      WHEN source675_variant THEN 'Plank to Pike Legacy Skeleton — Source 675'
      ELSE 'Rocking Plank to Down Dog Legacy Skeleton — Source 795' END,
    modifier_keys='{}'::TEXT[],difficulty_json='{}'::JSONB,status='archived',
    requirements_json=jsonb_build_object(
      'selectable',FALSE,'representation','superseded_source_skeleton',
      'sourceLegacyExerciseId',CASE id WHEN source39_variant THEN 39 WHEN source675_variant THEN 675 ELSE 795 END,
      'archiveReason','exact contacts endpoints return count anatomy loading budgets duration constraints substitutions persistence support and review contracts were missing',
      'replacementVariantIds',to_jsonb(active_variant_ids),'humanReviewRequired',TRUE),
    load_profile_json=jsonb_build_object('selectable',FALSE),
    fatigue_profile_json=jsonb_build_object('selectable',FALSE),
    programming_profile_json=jsonb_build_object(
      'selectionStatus','superseded_source_skeleton','selectable',FALSE,
      'publicationQuarantined',TRUE),updated_at=now()
  WHERE id IN(source39_variant,source675_variant,source795_variant);

  INSERT INTO coaching.exercise_definition_v1(
    id,facility_id,legacy_exercise_id,slug,canonical_name,display_name,aliases,
    description,family_key,schema_version,card_version,status,
    content_confidence,scoring_confidence,media_confidence,movement_patterns,
    body_regions,required_equipment,optional_equipment,environment_json,
    population_json,provenance_json,approved_video_url,reviewed_by,approved_by,
    last_reviewed_at,anatomy_json,athlete_support_json,coach_support_json,
    support_operations_json)
  VALUES(
    canonical_definition,1,39,'down-dog-to-plank-wave','Plank to Down Dog',
    'Plank to Down Dog',
    ARRAY['Down Dog to Plank Wave','Rocking Plank to Down Dog','Plank to Pike','Plank-to-Downward-Facing-Dog'],
    'Start in a high plank on both palms and forefeet with long arms, shoulders over wrists, and an organized trunk and pelvis. Keep both hands and feet fixed, press through the palms, and move the hips upward and backward into a comfortable inverted-V pike or Down-Dog shape. Return forward under control until the shoulders are over the wrists and the same high-plank line is restored. Count one complete plank-to-inverted-V-to-plank return as one repetition. Comfortable pike range, knee bend, heel height, stance, tempo, pauses, breathing prompts, repetitions, sets, rest, and wave or rock wording are annotations when they add no required action. Deliberate spinal articulation, a push-up, calf pedal, knee drive, step, limb lift, changed support, equipment, or hold-only execution changes the task.',
    'fixed_support_plank_to_inverted_v_cycle','2.0.0',2,'review',88,60,50,
    ARRAY['brace','push','hinge']::TEXT[],
    ARRAY['hand','wrist','elbow','shoulder','scapula','core','spine','hip','knee','ankle','foot']::TEXT[],
    ARRAY['none']::TEXT[],ARRAY['mat_optional']::TEXT[],
    jsonb_build_object(
      'surface','clean flat dry stable nonslip floor suitable for palms and forefeet',
      'space','one floor station with full plank and backward pike clearance no cross traffic and a clear controlled exit route',
      'stationCapacity',1,'equipmentKey','none','optionalEquipment',jsonb_build_array('mat_optional'),
      'coachSightline','side and front-quarter views of contacts wrists shoulders arms trunk pelvis hip path knees heels breathing symptoms and head position',
      'inspection',jsonb_build_array('floor traction cleanliness temperature and debris','hand and forefoot clearance','backward hip and heel clearance','neighbor and cross-traffic separation','entry exit sightline communication and emergency route'),
      'changeRule','Any support surface contact base limb action equipment path dose symptom space or downstream-demand change requires full revalidation.'),
    jsonb_build_object(
      'exerciseCardDoesNotClassifyParticipants',TRUE,'readinessIsWorkoutInput',TRUE,
      'selectionPrerequisites',jsonb_build_array('safe controlled floor transfer and exit','comfortable bilateral palm and forefoot support','tolerates the declared head-below-heart position','comfortable long-arm closed-chain shoulder support','can organize high-plank and comfortable inverted-V endpoints','understands fixed contacts return count and stop signal','same-session upper-limb trunk hip knee ankle plank push handstand crawling and floor-work budgets fit'),
      'excludeOrEscalate',jsonb_build_array('recent significant trauma surgery or procedure without applicable clearance','worsening night post-trauma sharp increasing or unfamiliar pain','new numbness tingling weakness altered circulation or loss of control','wrist hand elbow shoulder neck back hip knee ankle or foot symptoms preventing exact task','instability uncontrolled collapse or inability to exit safely','dizziness faintness nausea visual change chest pain unusual breathlessness disorientation or inability to communicate','clinical restriction conflicting with loaded floor support or head-below-heart position','unsafe floor space traffic sightline or emergency route','participant requests stop'),
      'notEstablishedByEvidence',jsonb_build_array('universal eligibility ideal spine shape heel contact straight knees or pike range','diagnosis treatment prevention correction readiness or clearance','isolated muscle activation','one universal dose frequency fatigue ceiling recovery progression or warm-up outcome','performance transfer age floor or participant skill level')),
    jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'canonicalAuthoredFromResearch',TRUE,
      'primaryIdentitySource','https://www.acefitness.org/resources/everyone/exercise-library/18/downward-facing-dog/',
      'legacySources',jsonb_build_array(39,675,795),
      'identityContract','fixed_bilateral_palms_and_forefeet_high_plank_to_comfortable_inverted_v_and_return_to_same_high_plank_cycle',
      'researchSources',jsonb_build_array(
        'https://www.acefitness.org/resources/everyone/exercise-library/18/downward-facing-dog/',
        'https://www.acefitness.org/blog/6106/a-yoga-routine-to-energize-your-morning-no-coffee',
        'https://pubmed.ncbi.nlm.nih.gov/37949547/',
        'https://pubmed.ncbi.nlm.nih.gov/39593551/',
        'https://pubmed.ncbi.nlm.nih.gov/37815235/',
        'https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en'),
      'confidenceBySection',jsonb_build_object('identity',88,'taxonomy',86,'anatomy',76,'difficulty',60,'load',72,'fatigueRecovery',56,'constraints',84,'dosage',58,'instructions',88,'alternates',90,'media',50),
      'unresolvedClaims',jsonb_build_array('one universal spacing knee position heel position pike range spinal shape dose frequency fatigue ceiling recovery progression or outcome','numeric difficulty calibration','media playback exactness captions accessibility quality safety and approval','individual symptom interpretation or clinical eligibility'),
      'externalPlaybackVerificationPerformed',FALSE,'sourceLimitationsExplicit',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,'publicationQuarantined',TRUE),
    NULL,NULL,NULL,NULL,
    jsonb_build_object(
      'primaryMuscles',jsonb_build_array('rectus_abdominis','transversus_abdominis_and_obliques','serratus_anterior','deltoid','triceps_brachii','hip_flexors','quadriceps'),
      'secondaryMuscles',jsonb_build_array('rotator_cuff','trapezius','latissimus_dorsi','spinal_extensors','gluteals','hamstrings','gastrocnemius_and_soleus','forearm_and_intrinsic_hand_support'),
      'joints',jsonb_build_array('finger_and_thumb_joints','wrist','elbow','glenohumeral','scapulothoracic','spine','hip','knee','ankle','metatarsophalangeal'),
      'jointActions',jsonb_build_array('wrist_extension_isometric','elbow_extension_isometric','shoulder_flexion_and_extension_relative_to_trunk','scapular_protraction_upward_rotation_and_controlled_return','trunk_anti_extension_and_position_control','hip_flexion_to_pike_and_extension_to_plank','variable_knee_flexion_extension','variable_ankle_dorsiflexion_and_plantarflexion','forefoot_support'),
      'planes',jsonb_build_array('sagittal','multiplanar_stabilization'),'laterality','bilateral',
      'supportContacts',jsonb_build_array('left_palm','right_palm','left_forefoot_and_toes','right_forefoot_and_toes'),
      'sequence',jsonb_build_array('organized_high_plank_start','hips_up_and_back_to_comfortable_inverted_v','controlled_forward_return','same_high_plank_end'),
      'claimsBoundary','Muscle and joint labels describe plausible task demands and adjacent evidence; they do not prove isolation, ideal technique, diagnosis, treatment, or outcome.'),
    jsonb_build_object(
      'plainLanguageSummary','Keep your hands and feet planted, move from a strong high plank into a comfortable upside-down V, and return to the same plank.',
      'expectedSensations',jsonb_build_array('distributed hand and shoulder support','trunk effort in plank','comfortable back-of-leg or calf tension may occur without forcing','controlled hip shift'),
      'unexpectedSensations',jsonb_build_array('sharp increasing or unfamiliar pain','pinching catching instability or collapse','numbness tingling weakness or circulation change','dizziness faintness nausea visual change chest pain or unusual breathlessness'),
      'selfCheck',jsonb_build_array('hands_and_feet_stay_fixed','arms_stay_long','high_plank_returns_with_shoulders_over_wrists','hips_move_up_and_back_to_comfortable_range','breathing_continues','stop_signal_available'),
      'permissionToScaleOrStop','Use a smaller comfortable pike, soft knees, fewer cycles, slower pace, or more rest. Stop and tell the coach whenever support, symptoms, breathing, vision, balance, or confidence changes.'),
    jsonb_build_object(
      'prebrief',jsonb_build_array('confirm exact variant and no added push-up pedal step drive or articulation','inspect floor transfer space and exit','screen current symptoms restrictions hand support and head-below-heart tolerance','set cycle support-time duration and downstream budgets'),
      'observation',jsonb_build_array('contacts and traction','long arms and shoulder organization','high-plank line and shoulder-over-wrist return','comfortable inverted-V endpoint','knee and heel annotations','trunk pelvis and head control','breathing symptoms first fault actual seconds and controlled exit'),
      'cueHierarchy',jsonb_build_array('hands_and_feet_stay','push_floor_away','hips_up_and_back','comfortable_upside_down_v','return_shoulders_over_wrists','keep_breathing'),
      'scopeBoundary','Coach observable setup action count exposure and stop rules; do not diagnose, treat, promise prevention, infer clearance, or force range.'),
    jsonb_build_object(
      'accessibility',jsonb_build_array('side and front-quarter demonstration','written four-step sequence','visual hand shoulder hip and return targets','soft knees smaller range fewer cycles slower tempo and more rest','still images captions transcript or live instruction','separately validated elevated forearm or equipment-supported alternative'),
      'incidentResponse',jsonb_build_array('stop_and_stabilize','assist_controlled_exit_within_scope','follow_facility_emergency_and_clinical_escalation_policy','record_variant_exposure_first_fault_symptom_stop_and_action','do_not_resume_without_required_reassessment'),
      'persistence',jsonb_build_array('definition_variant_and_card_version','floor_surface_and_station','planned_and_actual_complete_cycles','plank_and_inverted_v_seconds','range_knee_position_heel_height_tempo_pause_and_breathing','valid_invalid_partial_and_symptom_limited_attempts','contacts_arms_shoulders_trunk_pelvis_and_first_fault','symptoms_stop_reason_rest_duration_substitution_and_exit','overlapping_closed_chain_and_downstream_budget')))
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
    exact_variant,canonical_definition,'fixed-support-plank-to-down-dog-cycle',
    'Fixed-Support Plank to Down Dog Cycle',
    ARRAY['comfortable_pike_range','knee_position','heel_height','foot_stance','tempo','pause','breathing_prompt','complete_cycles','sets','rest_seconds','wave_or_rock_cue']::TEXT[],
    jsonb_build_object(
      'technicalComplexity',30,'absoluteLoadDemand',28,'physicalDifficulty',28,
      'baseOverallDifficulty',greatest(30,28),
      'overallFormula','max_exercise_complexity_physical_difficulty',
      'scoringScope','exact_fixed_support_plank_to_inverted_v_and_return_cycle',
      'exerciseScoresDescribeTaskOnly',TRUE,
      'participantSkillAgeReadinessClassification',FALSE,
      'independentCalibrationRequired',TRUE,'humanReviewRequired',TRUE),
    jsonb_build_object(
      'selectable',TRUE,'equipment',jsonb_build_array('none','mat_optional'),
      'surface','clean_flat_dry_stable_nonslip_floor',
      'base','bilateral_palms_and_forefeet_fixed',
      'supportContacts',jsonb_build_array('left_palm','right_palm','left_forefoot_and_toes','right_forefoot_and_toes'),
      'armRule','both_arms_remain_long_with_active_palm_pressure',
      'exactSequence',jsonb_build_array('organized_high_plank_shoulders_over_wrists','hips_up_and_back','comfortable_inverted_v','controlled_forward_return','same_high_plank'),
      'countingRule','one_complete_high_plank_to_inverted_v_and_return_to_same_high_plank_is_one_repetition',
      'validCompletion','all four contacts remain fixed arms stay long the inverted_v range remains comfortable the return restores shoulders over wrists and the organized high_plank line breathing continues and no stop rule occurs',
      'invalidCompletion',jsonb_build_array('hand_or_foot_step','elbow_flexion_or_push_up','shoulder_collapse','uncontrolled_spinal_or_pelvic_change','forced_range_or_heel_contact','incomplete_inverted_v_or_plank_return','added_pedal_knee_drive_limb_lift_or_articulation','breath_hold','symptom_stop'),
      'variantBoundaries',jsonb_build_array('support_surface','support_height','upper_support','limb_contact','locomotion','added_action','required_spinal_articulation','external_equipment','isometric_hold','clinical_scope','count'),
      'clinicalAssessmentOrTreatment',FALSE,'humanReviewRequired',TRUE),
    'review',
    jsonb_build_object(
      'loadingType','bodyweight_closed_chain_dynamic_weight_shift',
      'externalLoadMethod','none_body_mass_shared_across_bilateral_palms_and_forefeet',
      'gripDemand',10,'jointStress',26,'spinalLoading',14,'eccentricStress',12,
      'landingContactsPerRep',0,'handImpactContactsPerRep',0,'impactClass','none',
      'primaryExposure',jsonb_build_array('closed_chain_upper_extremity_support','dynamic_anteroposterior_weight_shift','high_plank_anti_extension','pike_hip_flexion','shoulder_and_scapular_stabilization','wrist_extension_and_forefoot_support'),
      'tracking',jsonb_build_array('variant','floor_surface','planned_and_actual_complete_cycles','high_plank_and_inverted_v_seconds','comfortable_range_knee_position_heel_height','tempo_and_pauses','valid_invalid_partial_and_symptom_limited_attempts','contact_arm_shoulder_trunk_and_pelvis_faults','first_fault','symptoms','support_seconds','rest','duration','same_session_closed_chain_and_floor_work_exposure')),
    jsonb_build_object(
      'localMuscleFatigue',28,'gripFatigue',10,'technicalFatigueSensitivity',30,
      'impactAccumulation',1,'recoveryHours',12,'recoveryRangeHours',jsonb_build_array(8,24),
      'primaryFatigueSites',jsonb_build_array('wrist_and_hand_support','shoulder_and_scapular_stabilizers','abdominal_and_spinal_stabilizers','hip_flexors_and_quadriceps','hamstring_and_calf_range_tolerance','forefoot_and_ankle_support','attention_and_endpoint_control'),
      'cumulativeBudget',jsonb_build_object('completeCycles',30,'palmAndForefootSupportSeconds',300,'highPlankSeconds',180,'headBelowHeartSeconds',180,'closedChainUpperLimbLoad',36,'trunkStabilizationSeconds',300,'technicalSensitivity',30,'impact',1),
      'interference',jsonb_build_array('later_high_priority_handstand_plank_push_crawl_or_upper_limb_skill','same_session_wrist_shoulder_trunk_hip_hamstring_calf_ankle_or_floor_work_loading','fatigue_that_changes_contacts_arms_shoulders_plank_line_pike_range_or_return_control'),
      'recoveryIsPlanningEstimate',TRUE,'tissueThresholdNotEstablished',TRUE),
    jsonb_build_object(
      'trainingStimuli',jsonb_build_array('fixed_support_plank_to_inverted_v_control','closed_chain_upper_limb_support','controlled_sagittal_weight_shift','trunk_pelvic_and_hip_control'),
      'stimulusDose',jsonb_build_object('sets',jsonb_build_array(1,3),'completeCycles',jsonb_build_array(3,8),'secondsPerCycle',jsonb_build_array(4,10),'restSeconds',jsonb_build_array(20,60)),
      'weeklyExposure',jsonb_build_object('minimum',0,'maximumWithoutReview',7,'unit','sessions','contextDependent',TRUE),
      'prerequisites',jsonb_build_array('safe_controlled_floor_transfer_and_exit','comfortable_bilateral_palm_and_forefoot_support','tolerated_head_below_heart_position','comfortable_long_arm_closed_chain_support','organized_high_plank_and_inverted_v_endpoints','understands_fixed_contacts_return_count_and_stop','same_session_closed_chain_trunk_hip_lower_limb_and_floor_work_budgets_fit'),
      'completionCriteria',jsonb_build_array('four_contacts_fixed','arms_long','shoulders_organized','comfortable_inverted_v','controlled_return_shoulders_over_wrists','organized_high_plank_line','continuous_breathing','no_stop_symptoms'),
      'sequenceRules',jsonb_build_array('prepare_access_or_resilience_context','do_not_turn_range_knee_position_heel_height_stance_tempo_pause_breathing_dose_or_wave_rock_cues_into_hidden_variants','do_not_add_push_up_pedal_drive_step_limb_lift_articulation_support_or_equipment_silently','revalidate_downstream_wrist_shoulder_trunk_hip_hamstring_calf_ankle_plank_push_handstand_crawl_and_floor_work_load'),
      'pairingCompatibility',jsonb_build_object('compatible',jsonb_build_array('low_impact_preparation_or_resilience_when_all_support_inversion_and_fatigue_budgets_fit'),'avoid',jsonb_build_array('fatiguing_wrist_or_closed_chain_work_before_priority_handstand_push_or_crawl_skill','symptom_provoking_floor_support_or_head_below_heart_position','time_critical_work_when_floor_transfer_displaces_priority_training')),
      'interferenceRules',jsonb_build_array('count_all_overlapping_plank_push_crawl_handstand_and_floor_support','count_all_overlapping_wrist_shoulder_trunk_hip_hamstring_calf_ankle_and_forefoot_work','stop_before_contacts_arms_shoulders_plank_line_pike_range_return_or_exit_control_changes'),
      'uncertaintyPolicy','When exact contacts endpoints return count symptoms floor safety head_below_heart tolerance or available time is uncertain do not select; request clarification or choose a separately validated card.',
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
  SELECT p.id,exact_variant,p.profile_key,p.phase_key,'primary',
    CASE p.phase_key WHEN 'prepare_and_access' THEN
      'Use the exact fixed-support plank-to-inverted-V cycle as low-impact full-body preparation only when floor transfer, hand support, head-below-heart tolerance, symptoms, duration, and cumulative closed-chain budgets fit.'
    ELSE
      'Use the exact cycle as controlled resilience work for repeatable palm support, plank organization, pike access, and return without turning it into conditioning, a push-up, a test, treatment, or readiness assessment.' END,
    CASE p.phase_key WHEN 'prepare_and_access' THEN 92 ELSE 84 END,
    CASE p.phase_key WHEN 'prepare_and_access' THEN 88 ELSE 82 END,
    jsonb_build_object('closed_chain_support',90,'plank_to_inverted_v_control',94,'sagittal_weight_shift',92,'resilience',CASE WHEN p.phase_key='resilience' THEN 92 ELSE 78 END),
    jsonb_build_object('sets',jsonb_build_array(1,CASE WHEN p.phase_key='prepare_and_access' THEN 2 ELSE 3 END),'completeCycles',jsonb_build_array(3,8),'secondsPerCycle',jsonb_build_array(4,10),'restSeconds',jsonb_build_array(20,60),'exampleDoseIsNotUniversal',TRUE),
    'Both palms and forefeet remain fixed, arms remain long, shoulders stay organized, the hips move up and back into a comfortable inverted-V, the controlled return restores shoulders over wrists and the organized high-plank line, breathing continues, and no stop symptom occurs.',
    ARRAY[
      'Sharp, increasing, night, post-trauma, or unfamiliar pain or participant stop request.',
      'Wrist, hand, elbow, shoulder, neck, back, hip, knee, ankle, or foot symptoms prevent exact support.',
      'Pinching, catching, painful clicking, instability, uncontrolled collapse, or inability to exit safely.',
      'Numbness, tingling, weakness, altered circulation, loss of control, or another neurologic sign.',
      'Dizziness, faintness, nausea, visual change, chest pain, unusual breathlessness, disorientation, or inability to communicate.',
      'A hand or foot steps, an elbow bends, a shoulder collapses, or exact contacts cannot be restored safely.',
      'The high-plank line, comfortable inverted-V, pelvis, or trunk cannot be restored by reducing range, cycles, or pace.',
      'Forced range or heel contact, breath holding, added push-up, pedal, drive, step, lift, articulation, equipment, or another wrong task cannot be corrected safely.',
      'Floor cleanliness, traction, space, traffic, hygiene, sightline, communication, or emergency route becomes unsafe.',
      'The planned cycle, support, high-plank, head-below-heart, technical-fatigue, duration, or downstream exposure budget is reached.'
    ]::TEXT[],
    'Verify the exact fixed-support variant, floor and transfer safety, palm and forefoot tolerance, head-below-heart tolerance, current symptoms and restrictions, planned cycles, actual support and endpoint time, and downstream closed-chain work. Demonstrate plank, up-and-back shift, comfortable inverted-V, return, count, stop, and exit. Observe contacts, long arms, shoulders, trunk, pelvis, knee and heel annotations, breathing, symptoms, first fault, actual duration, and controlled exit. Do not diagnose, treat, or imply readiness.',
    'Keep your hands and feet planted. From a strong high plank, push the floor away, move your hips up and back into a comfortable upside-down V, then return until your shoulders are over your wrists. Stop for pain, tingling, weakness, dizziness, instability, or loss of support.',
    'More consistent control of the exact fixed-support plank-to-inverted-V cycle; no treatment, structural, readiness, prevention, or performance outcome is guaranteed.',
    ARRAY['none']::TEXT[],
    jsonb_build_object('stationCapacity',1,'base','bilateral_palms_and_forefeet_fixed','requiredEquipment','none','optionalEquipment','mat_optional','space','one_clean_floor_station_with_plank_pike_and_controlled_exit_clearance','setupSeconds',25,'floorTransferSeconds',15,'coachSightline','side_and_front_quarter','crossTrafficProhibited',TRUE,'floorInspectionRequired',TRUE,'revalidateAfterAnyChange',TRUE),
    ARRAY[plank_hold_variant,calf_pedal_variant,pike_push_variant,inchworm_variant]::UUID[],
    'review',
    jsonb_build_object('durationFormula','floor_transfer_and_setup_seconds + sum(actual_valid_cycles * actual_seconds_per_cycle) + rest_seconds + invalid_or_partial_attempt_seconds + symptom_response_seconds + substitution_seconds + station_reset_and_exit_seconds','secondsPerCycle',jsonb_build_array(4,10),'minimumSeconds',55,'typicalSeconds',120,'maximumSecondsWithoutReview',360,'includeActualNotPlanned',TRUE,'recomputeAfterSubstitution',TRUE),
    jsonb_build_object('regressionOrder',jsonb_build_array('reduce_pike_range','permit_comfortable_knee_bend','reduce_to_three_clean_cycles','slow_the_cycle','increase_rest','end_set','select_a_separately_validated_support_variant'),'progressionOrder',jsonb_build_array('complete_clean_cycles','increase_within_three_to_eight_cycle_profile','increase_comfortable_pike_range_without_forcing','add_brief_endpoint_pause','select_a_distinct_push_up_pedal_walkout_or_equipment_task_only_after_full_revalidation'),'neverScaleByForcingHeelsOrKneesAddingSpeedPushUpsPedalsStepsOrIgnoringSymptoms',TRUE),
    jsonb_build_object('record',jsonb_build_array('definition_and_variant','floor_surface_and_station','planned_and_actual_complete_cycles','plank_and_inverted_v_seconds','range_knee_position_heel_height_tempo_pause_and_rest','valid_invalid_partial_and_symptom_limited_attempts','contacts_arms_shoulders_trunk_pelvis_and_breathing','first_fault','symptoms_and_stop_reason','support_and_head_below_heart_seconds','duration','substitution','station_reset_and_exit'),'validUnit','one_controlled_high_plank_to_comfortable_inverted_v_and_return_to_same_high_plank_with_fixed_palms_and_forefeet_long_arms_organized_shoulders_trunk_and_pelvis_and_no_stop','partial_cycles_do_not_count',TRUE),
    jsonb_build_object('athlete',jsonb_build_array('four_fixed_contacts','strong_high_plank','push_floor','comfortable_upside_down_v','shoulders_over_wrists_return','warning_symptom_dizziness_and_support_stop'),'coach',jsonb_build_array('floor_transfer_and_station','contact_endpoint_and_count_identity','arms_shoulders_trunk_and_pelvis_control','valid_cycle_and_first_fault','actual_exposure_and_downstream_budget','clinical_scope','logging_and_escalation'),'accessibility',jsonb_build_array('side_and_front_quarter_demonstration','written_four_step_sequence','visual_hand_shoulder_hip_and_return_targets','soft_knees_smaller_range_fewer_cycles_slower_tempo_and_more_rest','still_images_captions_transcript_or_live_instruction','separately_validated_elevated_forearm_or_equipment_supported_alternative'))
  FROM (VALUES
    ('c2eff2c8-3a5e-4769-b9b9-c4b3a4f9018e'::UUID,'prepare-fixed-support-plank-to-down-dog','prepare_and_access'),
    ('d29c3c9a-463c-46ea-98c1-ceb37e35dbb8'::UUID,'resilience-fixed-support-plank-to-down-dog','resilience')
  ) p(id,profile_key,phase_key)
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
      'canonicalContract','fixed_bilateral_palms_and_forefeet_high_plank_to_comfortable_inverted_v_and_return_to_same_high_plank_cycle',
      'neighborContract',i.neighbor_contract,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'deterministic_identity_equivalence',NULL,now()
  FROM (VALUES
    (source675_definition,'duplicate_consolidated','pike_and_down_dog_same_fixed_support_cycle','Source 675 moves from tall plank to pike and back with active shoulders and controlled spine. That is the same contacts, inverted-V endpoint, return, and count as the canonical Plank-to-Down-Dog cycle; purpose and pike wording belong in delivery context and aliases.','fixed_support_tall_plank_to_pike_and_return'),
    (source795_definition,'duplicate_consolidated','rock_and_wave_wording_same_fixed_support_cycle','Source 795 moves from tall plank to Down Dog and returns. Rock versus wave wording does not change the required contacts, endpoints, action, or count unless separate articulation is explicitly required.','fixed_support_tall_plank_to_down_dog_and_return'),
    (plank_hold_definition,'distinct_exercises','dynamic_two_endpoint_cycle_vs_isometric_hold','Plank Hold keeps one high-plank position instead of completing an inverted-V and same-plank return cycle.','isometric_high_plank_hold'),
    (calf_pedal_definition,'distinct_exercises','two_endpoint_cycle_vs_alternating_calf_pedal','Down Dog Calf Pedal alternates knee flexion and heel pressing from the inverted-V position, changing laterality action and count.','alternating_unilateral_knee_and_heel_action'),
    (pike_push_definition,'distinct_exercises','long_arm_cycle_vs_elbow_flexion_press','Pike Push-Up holds a pike base while the elbows flex and extend, changing primary action loading endpoint and count.','pike_based_vertical_press')
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
        'noUniversalShapeRangeTechniqueSafetyEligibilityDoseRecoveryOutcomeOrDifficultyClaim',TRUE)),
    e.quality,'candidate',NULL,NULL
  FROM (VALUES
    ('identity','https://www.acefitness.org/resources/everyone/exercise-library/18/downward-facing-dog/','Downward-Facing Dog','American Council on Exercise','expert_instruction','ACE describes a push-up-position start, backward and upward hip shift to an inverted-V, and return to the starting push-up position.','direct exact-task identity and instruction','The source does not define every Vortex fault, count, population, neighbor, persistence, or publication rule.',88),
    ('taxonomy','https://www.acefitness.org/blog/6106/a-yoga-routine-to-energize-your-morning-no-coffee','Plank-to-Downward Facing Dog','American Council on Exercise','expert_instruction','The direct sequence alternates high plank and Downward-Facing Dog under controlled breathing.','direct movement and support context','The source does not create Vortex taxonomy keys or outcome guarantees.',84),
    ('anatomy','https://pubmed.ncbi.nlm.nih.gov/37949547/','Electromyographic analysis of trunk and hip muscles during Yoga poses prescribed for treating chronic low back pain','Journal of Bodywork and Movement Therapies','peer_reviewed_research','Twenty-two healthy yoga-trained adults showed position-dependent trunk and hip muscle activity, with greater trunk-flexor activation in plank than Down Dog.','adjacent anatomy and posture-demand context','The study tested held postures rather than this transition and does not establish exact activation isolation or treatment effects.',86),
    ('biomechanics','https://www.acefitness.org/resources/everyone/exercise-library/18/downward-facing-dog/','Downward-Facing Dog','American Council on Exercise','expert_instruction','ACE describes long arms and legs, backward and upward hip shift, inverted-V, optional slight knee bend, and controlled return.','direct contact endpoint and path contract','The source does not validate one universal hand spacing foot stance heel position pike range or spinal shape.',88),
    ('difficulty','https://pubmed.ncbi.nlm.nih.gov/37815235/','Shoulder and Scapular Muscle Activity During Low and High Plank Variations With Different Body-Weight-Bearing Statuses','Journal of Strength and Conditioning Research','peer_reviewed_research','High-plank elbow position and body-weight-bearing configuration altered shoulder and scapular activation in twenty-one healthy men.','exercise-task loading and complexity context','The study does not score this cycle or classify participant proficiency age readiness or skill.',88),
    ('load_fatigue_recovery','https://pubmed.ncbi.nlm.nih.gov/39593551/','Characteristics of electromyographic activity during yoga-applied stabilization exercises','Journal of Bodywork and Movement Therapies','peer_reviewed_research','Fourteen healthy men showed posture-dependent trunk shoulder and lower-limb activity across high-plank and Down-Dog conditions.','adjacent load and fatigue-site context','The study did not test repeated transitions and does not quantify universal fatigue ceilings cumulative limits or recovery hours.',86),
    ('constraints','https://pubmed.ncbi.nlm.nih.gov/37815235/','Shoulder and Scapular Muscle Activity During Low and High Plank Variations With Different Body-Weight-Bearing Statuses','Journal of Strength and Conditioning Research','peer_reviewed_research','Plank loading changes with support configuration and the sample was limited to healthy young men.','selection and evidence-population boundary','The study does not establish individual eligibility or replace symptom transfer support inversion and scope checks.',88),
    ('dosage','https://www.acefitness.org/blog/6106/a-yoga-routine-to-energize-your-morning-no-coffee','Plank-to-Downward Facing Dog','American Council on Exercise','expert_instruction','ACE gives one context-specific example of four slow breathing cycles.','context-specific programming example','The example is not a universal prescription and does not validate Vortex frequency fatigue budgets recovery or population rules.',84),
    ('instructions','https://www.acefitness.org/resources/everyone/exercise-library/18/downward-facing-dog/','Downward-Facing Dog','American Council on Exercise','expert_instruction','ACE supplies observable high-plank alignment backward and upward hip shift inverted-V long-arm neutral-head knee-bend and return checkpoints.','direct exact-task instruction','Vortex adds fixed-contact same-start count stop persistence actual-duration and substitution rules.',88),
    ('safety_stop_rules','https://pubmed.ncbi.nlm.nih.gov/39593551/','Characteristics of electromyographic activity during yoga-applied stabilization exercises','Journal of Bodywork and Movement Therapies','peer_reviewed_research','High plank and Down Dog impose posture-specific muscular demands in the studied healthy sample.','support-demand and stop-rule context','Facility transfer symptom trauma neurologic systemic inversion incident and emergency rules remain separately required.',86),
    ('programming','https://www.acefitness.org/blog/6106/a-yoga-routine-to-energize-your-morning-no-coffee','Plank-to-Downward Facing Dog','American Council on Exercise','expert_instruction','ACE presents the cycle inside a short routine with slow breathing.','preparation-context evidence','The routine does not validate readiness resilience outcomes universal dose or interference rules.',84),
    ('athlete_support','https://www.acefitness.org/resources/everyone/exercise-library/18/downward-facing-dog/','Downward-Facing Dog','American Council on Exercise','expert_instruction','The direct instruction provides visible plank hip-up-and-back inverted-V knee-bend heel-direction and return checkpoints.','plain-language participant support','The source does not establish universal sensations accessibility or symptom interpretation.',88),
    ('coach_support','https://pubmed.ncbi.nlm.nih.gov/37815235/','Shoulder and Scapular Muscle Activity During Low and High Plank Variations With Different Body-Weight-Bearing Statuses','Journal of Strength and Conditioning Research','peer_reviewed_research','Shoulder and scapular recruitment changes across plank support configurations.','coach observation and loading-context boundary','The study does not prescribe Vortex layout count escalation rendering or approval.',88),
    ('accessibility','https://www.acefitness.org/resources/everyone/exercise-library/18/downward-facing-dog/','Downward-Facing Dog','American Council on Exercise','expert_instruction','ACE permits slight knee bend to reach the inverted-V rather than forcing full knee extension or heel contact.','communication and task-scaling context','Changing support surface height upper support or equipment requires another reviewed task.',88),
    ('alternates','https://www.acefitness.org/resources/everyone/exercise-library/18/downward-facing-dog/','Downward-Facing Dog','American Council on Exercise','expert_instruction','The direct task returns from inverted-V to the starting push-up position without a push-up step calf pedal knee drive or equipment.','alternate identity-boundary context','The source does not adjudicate all Vortex alternates or approve graph edges.',88),
    ('media','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en','Embed videos and playlists','YouTube Help','manufacturer_instruction','Five candidates returned current oEmbed title channel thumbnail and iframe metadata on 2026-08-09.','candidate metadata only','oEmbed does not prove playback exact contacts endpoints action count captions accessibility quality safety card match or approval.',82)
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
    'Current YouTube oEmbed metadata only. Playback exact fixed contacts high-plank and inverted-V endpoints action return count captions accessibility cue quality safety reviewer identity card-version match and approval remain unverified.'
  FROM (VALUES
    ('DP2fmagkrdg','How to: down dog to plank in a wave','YAY!YOGA','Source 39 existing candidate checked by YouTube oEmbed'),
    ('WPmvODuVv14','Spinal Wave Tutorial | Downdog To Plank','Move With Katharine','Source 39 existing candidate checked by YouTube oEmbed'),
    ('u8eUdDxyAMg','Downward Dog to Plank','React Physical Therapy','Source 39 existing candidate checked by YouTube oEmbed'),
    ('vXqPc4Uu8X0','Plank to Down Dog','Mobility Doc','Plank to Down Dog candidate checked by YouTube oEmbed'),
    ('0bzf7NKacXk','How to go from Plank to Down Dog','Charlie Follows','Plank to Down Dog candidate checked by YouTube oEmbed')
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
    ('Plank to Down Dog','same_identity','The concise name preserves fixed palm and forefoot support high-plank start inverted-V endpoint and same-plank return.','canonical_alias',jsonb_build_array('fixed_contacts','two_endpoints','return_cycle'),'merge_alias'),
    ('Down Dog to Plank Wave','same_identity','Source 39 preserves the cycle when wave is a non-binding cue and no required spinal articulation is added.','source39_alias',jsonb_build_array('legacy_exercise_39','same_cycle'),'merge_alias'),
    ('Rocking Plank to Down Dog','same_identity','Source 795 describes the same tall-plank to Down-Dog and return cycle.','source795_alias',jsonb_build_array('legacy_exercise_795','same_cycle'),'merge_alias'),
    ('Plank to Pike','same_identity','Source 675 uses pike for the same fixed-support inverted-V endpoint and return.','source675_alias',jsonb_build_array('legacy_exercise_675','same_cycle'),'merge_alias'),
    ('Comfortable Pike Range','modifier_annotation','A smaller symptom-free hip shift changes amplitude without changing support endpoints action or count.','range_annotation',jsonb_build_array('comfortable_range','same_contacts'),'delivery_annotation'),
    ('Soft-Knee or Straighter-Knee Down Dog','modifier_annotation','Declared comfortable knee position changes range and sensation while preserving the cycle.','knee_annotation',jsonb_build_array('knee_position','same_cycle'),'delivery_annotation'),
    ('Heel Height or Foot Stance','modifier_annotation','Heel height and comfortable stance alter endpoint presentation without adding contacts or action.','stance_annotation',jsonb_build_array('heel_height','foot_stance'),'delivery_annotation'),
    ('Controlled Tempo or Endpoint Pause','modifier_annotation','Pace and a short pause alter time under tension but preserve the cycle.','tempo_pause_annotation',jsonb_build_array('tempo','pause'),'delivery_annotation'),
    ('Repetitions Sets or Rest','modifier_annotation','Volume and rest change dosage rather than identity.','dose_annotation',jsonb_build_array('repetitions','sets','rest'),'delivery_annotation'),
    ('Wave or Rock Cue','modifier_annotation','The cue remains an annotation only when it does not require a different spinal sequence or extra action.','cue_annotation',jsonb_build_array('movement_cue','no_added_action'),'delivery_annotation'),
    ('Breathing Prompt','modifier_annotation','Continuous-breathing or phase-specific prompts change delivery without changing mechanics.','breathing_annotation',jsonb_build_array('breathing_prompt'),'delivery_annotation'),
    ('Hands-Elevated Plank to Down Dog','new_variant','A bench box or wall changes support height loading clearance equipment and failure consequences.','elevated_hand_variant',jsonb_build_array('support_height','equipment'),'needs_human_review'),
    ('Forearm Plank to Dolphin','new_variant','Forearm support removes palm loading and changes shoulder angle leverage base and endpoint.','forearm_variant',jsonb_build_array('upper_support','leverage'),'needs_human_review'),
    ('TRX or Slider Plank to Pike','new_variant','Suspension or sliding equipment changes foot support instability load setup and failure risk.','suspension_slider_variant',jsonb_build_array('equipment','instability'),'needs_human_review'),
    ('Stability-Ball Plank to Pike','new_variant','An unstable ball support changes contact balance load equipment and exit risk.','ball_variant',jsonb_build_array('equipment','stability'),'needs_human_review'),
    ('Deliberate Segmental Spinal Wave','new_variant','Required segment-by-segment spinal articulation changes action path faults purpose and count contract.','segmental_wave_variant',jsonb_build_array('spinal_articulation'),'needs_human_review'),
    ('Push-Up to Down Dog','new_definition','Required elbow flexion and pressing adds a push-up action loading phase validity rule and count.','push_up_distinct',jsonb_build_array('elbow_flexion_press'),'research_queue'),
    ('Down Dog Calf Pedal','new_definition','Alternating knee flexion and heel pressing adds unilateral lower-limb actions and a different count.','calf_pedal_distinct',jsonb_build_array('alternating_leg_action'),'existing_distinct_definition'),
    ('Plank Hold or Down Dog Hold','new_definition','A static hold does not complete the declared two-endpoint return cycle.','hold_distinct',jsonb_build_array('isometric_hold'),'existing_distinct_definition'),
    ('Pike Push-Up','new_definition','Elbow flexion and extension with hips high changes the primary action load endpoint and count.','pike_push_distinct',jsonb_build_array('vertical_press'),'existing_distinct_definition'),
    ('Inchworm Walkout','new_definition','A standing-to-floor walkout uses hand or foot steps and high plank as a checkpoint rather than cycling to inverted-V.','walkout_distinct',jsonb_build_array('standing_transfer','locomotor_steps'),'existing_distinct_definition'),
    ('Down Dog Knee Drive or Mountain Climber','new_definition','A unilateral knee drive removes or redistributes support and adds a distinct action and count.','knee_drive_distinct',jsonb_build_array('unilateral_knee_drive'),'research_queue'),
    ('Three-Legged Down Dog to Plank','new_definition','Lifting one leg changes laterality support balance loading and transition mechanics.','three_leg_distinct',jsonb_build_array('three_point_support'),'research_queue'),
    ('Clinical Shoulder Wrist Spine or Hamstring Assessment','new_definition','Assessment adds standardized measurement interpretation consent and clinical escalation.','clinical_assessment_distinct',jsonb_build_array('clinical_scope','measurement','consent'),'research_queue')
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
      'revalidate',jsonb_build_array('identity and purpose','support contacts endpoints action and count','floor transfer equipment space and head position','symptoms and restrictions','dose duration and logistics','closed-chain upper-limb trunk hip lower-limb plank push handstand crawling and floor-work budgets','persistence','coach rendering','athlete rendering'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'review',NULL,NULL,NULL
  FROM (VALUES
    (exact_variant,plank_hold_variant,'regression',62,ARRAY['range','complexity','fatigue']::TEXT[],'Removes the inverted-V transition and becomes an isometric high-plank hold; purpose duration and exposure must be fully reselected.'),
    (exact_variant,calf_pedal_variant,'lateral_substitution',56,ARRAY['complexity','range','fatigue']::TEXT[],'Keeps an inverted-V context but adds alternating knee and heel actions and a different count; it is not automatic.'),
    (exact_variant,pike_push_variant,'progression',46,ARRAY['load','complexity','fatigue']::TEXT[],'Adds elbow flexion and a pike press, materially increasing upper-limb load and changing identity.'),
    (exact_variant,inchworm_variant,'progression',52,ARRAY['complexity','range','fatigue']::TEXT[],'Adds a standing transfer and hand walkout while high plank becomes a checkpoint; use only after complete reselection and logistics review.')
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
    CASE d.dimension WHEN 'technicalComplexity' THEN 30 ELSE 28 END,
    CASE d.dimension WHEN 'technicalComplexity' THEN 40 ELSE 20 END,
    CASE d.dimension WHEN 'technicalComplexity' THEN
      'Review-only exercise-complexity anchor based on floor transfer, four fixed contacts, long-arm support, high-plank organization, controlled up-and-back shift, comfortable inverted-V, same-plank return, breathing, quality gates, and valid cycle count.'
    ELSE
      'Review-only physical-difficulty anchor based on bodyweight shared through both palms and forefeet, long-arm closed-chain support, high-plank anti-extension, pike transition, shoulder and scapular stabilization, and no impact.'
    END||' This scores the exercise task, not participant proficiency.',
    'review',1,NULL,NULL,
    'Research-informed proposal only; independent comparison and qualified human approval remain required.',NULL
  FROM (VALUES('technicalComplexity'),('absoluteLoadDemand')) d(dimension)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
    proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,reviewed_by=NULL,
    review_notes=EXCLUDED.review_notes,reviewed_at=NULL,updated_at=now();

  UPDATE coaching.exercise SET
    name='Plank to Down Dog',slug='down-dog-to-plank-wave',
    description='Start in a high plank on both palms and forefeet with long arms, shoulders over wrists, and an organized trunk and pelvis. Keep both hands and feet fixed, press through the palms, and move the hips upward and backward into a comfortable inverted-V pike or Down-Dog shape. Return forward under control until the shoulders are over the wrists and the same high-plank line is restored. Count one complete plank-to-inverted-V-to-plank return as one repetition.',
    instructions='Use the exact canonical variant on a clean stable floor. Enter and exit under control. Plant both palms and forefeet, organize a long-arm high plank with shoulders over wrists, and keep all four contacts fixed. Press the floor away and move your hips up and back into a comfortable upside-down V; soft knees and raised heels are allowed. Return forward until shoulders are over wrists and the same high-plank line is restored to count one repetition. Keep breathing. Stop for pain, pinching, instability, numbness, tingling, weakness, altered circulation, dizziness, faintness, nausea, visual change, chest pain, unusual breathlessness, loss of support, unsafe floor, or participant request.',
    skill_level=NULL,age_min=NULL,age_max=NULL,
    default_sets=1,default_reps=5,default_work_seconds=45,default_rest_seconds=30,
    tempo='controlled four to ten seconds per complete plank-to-inverted-v-and-return cycle',
    load_note='Track floor surface, planned and actual complete cycles, high-plank and inverted-V seconds, comfortable range, knee position, heel height, stance, tempo, pauses, contact continuity, arm shoulder trunk and pelvis faults, first fault, symptoms, invalid or partial attempts, support and head-below-heart time, rest, duration, substitution, exit, and overlapping wrist shoulder trunk hip hamstring calf ankle plank push handstand crawling and floor-work exposure.',
    est_seconds_per_set=120,is_published=FALSE,archived=FALSE,
    card_summary='Fixed-palm and forefoot high-plank to comfortable inverted-V and same-plank return cycle.',
    coach_language='Verify exact floor station, controlled transfer, fixed palms and forefeet, long-arm high plank, head-below-heart tolerance, comfortable inverted-V, exact return, restrictions, symptoms, planned cycles, actual support time, first fault, duration, downstream closed-chain budget, persistence, controlled exit, and escalation.',
    athlete_language='Keep your hands and feet planted. From a strong high plank, push the floor away, move your hips up and back into a comfortable upside-down V, then return until your shoulders are over your wrists. Stop for pain, tingling, weakness, dizziness, instability, or loss of support.',
    programming_logic=jsonb_build_object(
      'selectionStatus','canonical_variant_required','selectable',TRUE,
      'canonicalDefinitionId',canonical_definition,'exactVariantIds',to_jsonb(active_variant_ids),
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'exerciseDifficultyDescribesTaskOnly',TRUE,
      'selectionInputs',jsonb_build_array('workout purpose','safe floor transfer station and exit','palm forefoot wrist shoulder trunk hip knee ankle and head_below_heart tolerance','exact high_plank inverted_v and return count comprehension','cycle dose pace range rest and duration','cumulative closed_chain upper_limb trunk lower_limb plank push handstand crawl and floor_work exposure','coach scope and sightline'),
      'substitutionRevalidation',jsonb_build_array('identity','support contacts endpoints action and count','floor surface transfer equipment space and head position','restrictions and symptoms','purpose','dose','fatigue and impact budgets','duration','logistics','persistence','coach rendering','athlete rendering'),
      'consolidatedLegacySourceIds',jsonb_build_array(39,675,795),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    scalable_variables=ARRAY['comfortable_pike_range','knee_position','heel_height','foot_stance','tempo','endpoint_pause','breathing_prompt','complete_cycles','rest_seconds','sets','wave_or_rock_cue']::TEXT[],
    movement_family='Fixed-Support Plank to Inverted-V Cycle',primary_phase_key=NULL,
    phase_subrole=NULL,primary_order_slot=NULL,
    movement_requirements=jsonb_build_object(
      'selectable',TRUE,'canonicalVariantRequired',TRUE,'impactLevel',0,
      'balanceDemand','four_point_floor_support','breathingDemand','continuous_no_breath_hold',
      'actions',jsonb_build_array('closed_chain_upper_limb_support','controlled_upward_and_backward_hip_shift','controlled_forward_return','high_plank_anti_extension_and_pike_control'),
      'planes',jsonb_build_array('sagittal','multiplanar_stabilization'),
      'mustMaintain',jsonb_build_array('both_palms_fixed','both_forefeet_fixed','long_arms','active_palm_pressure','organized_shoulders','comfortable_inverted_v','same_high_plank_return','controlled_trunk_and_pelvis','continuous_breathing','communication'),
      'mustNotAdd',jsonb_build_array('hand_or_foot_step','push_up','calf_pedal','knee_drive','limb_lift','required_segmental_articulation','external_equipment','hold_only_execution','changed_support_height','forced_heel_or_knee_position','uncontrolled_exit'),
      'validCompletion','one_controlled_high_plank_to_comfortable_inverted_v_and_return_to_same_high_plank_with_fixed_palms_and_forefeet_long_arms_organized_shoulders_trunk_and_pelvis_and_no_stop_rule'),
    coaching_execution=jsonb_build_object(
      'qualityGates',jsonb_build_array('variant_and_floor_station_exact','controlled_entry_and_exit','palm_and_forefoot_support_tolerated','head_below_heart_tolerated','count_understood','four_contacts_fixed','arms_long_shoulders_organized','comfortable_inverted_v','same_high_plank_return','no_stop_symptoms'),
      'stopRules',jsonb_build_array('sharp_increasing_night_post_trauma_or_unfamiliar_pain','support_joint_pain_pinching_catching_instability_or_collapse','neurologic_or_circulation_change','dizziness_faintness_nausea_visual_change_chest_pain_unusual_breathlessness_or_disorientation','unsafe_floor_transfer_or_exit','step_elbow_bend_push_up_or_shoulder_collapse','uncontrolled_trunk_pelvis_or_endpoint_change','wrong_task_forced_range_or_breath_hold','unsafe_floor_space_sightline_or_emergency_route','budget_or_duration_reached'),
      'persistence',jsonb_build_array('definition_and_variant','floor_surface_and_station','planned_and_actual_complete_cycles','high_plank_and_inverted_v_seconds','range_knee_position_heel_height_stance_tempo_pause_and_rest','valid_invalid_partial_and_symptom_limited_attempts','contacts_arms_shoulders_trunk_pelvis_breathing_and_first_fault','symptoms_and_stop_reason','support_and_head_below_heart_seconds','duration','substitution','station_reset_and_exit')),
    pairing_logic=jsonb_build_object(
      'sameSessionBudget',jsonb_build_array('complete_cycles','palm_and_forefoot_support_seconds','high_plank_seconds','head_below_heart_seconds','closed_chain_upper_limb_load','wrist_extension_support','trunk_and_pelvic_stabilization','hip_hamstring_calf_and_ankle_range_exposure','technical_fatigue','downstream_plank_push_handstand_crawl_climb_hang_and_floor_work','impact'),
      'avoidAutomaticPairingWith',jsonb_build_array('fatiguing_wrist_or_closed_chain_work_before_priority_handstand_push_or_crawl_skill','symptom_provoking_floor_support_or_head_below_heart_work','same_session_support_or_floor_work_exceeding_budget'),
      'revalidateAfterSubstitution',TRUE),
    media_library=jsonb_build_object(
      'candidate_video_ids',jsonb_build_array('DP2fmagkrdg','WPmvODuVv14','u8eUdDxyAMg','vXqPc4Uu8X0','0bzf7NKacXk'),
      'reviewState','oembed_metadata_only_candidate_quarantine',
      'playbackExactnessContactsEndpointsActionReturnCountCaptionsAccessibilityQualitySafetyAndApprovalVerified',FALSE,
      'humanReviewRequired',TRUE),
    participant_structure='individual',programming_kind='exercise',linked_skill_id=NULL,
    why_publish_ready=FALSE,updated_at=now()
  WHERE id=39;

  UPDATE coaching.exercise SET
    skill_level=NULL,age_min=NULL,age_max=NULL,is_published=FALSE,archived=TRUE,
    programming_logic=coalesce(programming_logic,'{}'::JSONB)||jsonb_build_object(
      'selectionStatus','duplicate_consolidated','selectable',FALSE,
      'canonicalDefinitionId',canonical_definition,'exactVariantIds',to_jsonb(active_variant_ids),
      'survivorLegacyExerciseId',39,'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    linked_skill_id=NULL,why_publish_ready=FALSE,updated_at=now()
  WHERE id IN(675,795);

  UPDATE coaching.exercise_safety_profile SET
    risk_level=2,impact_level=0,minimum_age_recommended=NULL,
    minimum_skill_level=NULL,requires_spotting=FALSE,
    requires_coach_supervision='recommended',
    minimum_prerequisite_notes='Readiness uses safe floor transfer and exit, comfortable palm and forefoot support, tolerated head-below-heart position, long-arm shoulder support, exact high-plank and inverted-V cycle comprehension, current symptoms, communication, workout dose, and downstream closed-chain loading; never participant proficiency or age.',
    readiness_checks=ARRAY[
      'Confirm exact variant, clean stable nonslip floor, plank and pike clearance, controlled entry and exit, sightline, communication, and emergency route.',
      'Confirm palm wrist elbow shoulder neck back hip knee ankle forefoot and head-below-heart tolerance and no current symptom or restriction conflict.',
      'Confirm the participant understands four fixed contacts, long arms, comfortable inverted-V, shoulders-over-wrists return count, soft-knee permission, stop signal, and controlled exit.',
      'Review cumulative cycles, support, high-plank and head-below-heart time, wrist shoulder trunk lower-limb technical fatigue, and later plank push handstand crawling climbing hanging or floor-work demand.'
    ]::TEXT[],
    stop_signs=ARRAY[
      'Sharp, increasing, night, post-trauma, or unfamiliar pain, guarding, or participant stop request.',
      'Wrist, hand, elbow, shoulder, neck, back, hip, knee, ankle, or foot symptoms prevent exact support.',
      'Pinching, catching, painful clicking, instability, uncontrolled collapse, or inability to exit safely.',
      'Numbness, tingling, weakness, altered circulation, loss of control, or another neurologic sign.',
      'Dizziness, faintness, nausea, visual change, chest pain, unusual breathlessness, disorientation, or inability to communicate.',
      'A hand or foot steps, elbows bend, shoulders collapse, or exact contacts cannot be restored safely.',
      'The high-plank line, comfortable inverted-V, pelvis, or trunk cannot be restored despite reduced range, cycles, or pace.',
      'Floor, equipment, space, traffic, hygiene, sightline, communication, duration, budget, or emergency route becomes inadequate.'
    ]::TEXT[],
    contraindications=ARRAY[
      'Current symptoms, trauma, procedure, instability, or clinical restrictions conflict with loaded floor support, head-below-heart position, or floor transfer.',
      'No clean stable floor station, controlled entry and exit, full clearance, sightline, communication, or emergency route.',
      'The intended service is diagnosis, treatment, injury management, readiness clearance, manual assistance, a push-up, calf pedal, walkout, hold, or another exercise identity.'
    ]::TEXT[],
    common_substitutions=ARRAY[
      'Use Plank Hold only when a static task fits and all duration and exposure checks are rerun.',
      'Use Down Dog Calf Pedal, Pike Push-Up, or Inchworm only when the changed action and count fit and all checks are rerun.',
      'Do not infer that an elevated, forearm, suspension, slider, ball, unilateral, or segmental-wave version is equivalent.',
      'Author and review any changed-support or added-action alternative before selection.'
    ]::TEXT[]
  WHERE exercise_id=39;

  UPDATE coaching.exercise_score_v1 SET
    technical_complexity=30,absolute_load_demand=28,coordination_demand=30,
    impact=1,supervision_demand=20,base_overall_difficulty=greatest(30,28),
    legacy_scores=coalesce(legacy_scores,'{}'::JSONB)||jsonb_build_object(
      'candidateReassessment',migration_key,
      'projectionScope','fixed_support_high_plank_to_inverted_v_and_return_exact_variant',
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'variantScores',jsonb_build_object('fixedSupportPlankToDownDogCycle',
        jsonb_build_object('complexity',30,'physicalDifficulty',28,'overall',30)),
      'exerciseScoresDescribeTaskOnly',TRUE,'independentCalibrationRequired',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    migration_confidence=60,human_review_status='queued',reviewed_by=NULL,reviewed_at=NULL,
    review_notes='Research-informed candidate reassessment only. Scores describe exercise complexity and physical difficulty, not participant proficiency, age, readiness, or skill. Exact contacts endpoints support loading and independent calibration remain required.',
    updated_at=now()
  WHERE exercise_id=39;

  UPDATE coaching.exercise_difficulty_profile SET
    technical=3.0,complexity=3.0,load=2.8,overall=3.0,
    recommended_age_min=NULL,recommended_age_max=NULL,attention_demand='moderate',
    notes='Candidate projection from the exact fixed-support high-plank to inverted-V and return variant. Complexity is 30/100, physical difficulty 28/100, and overall 30/100 by maximum. This is not participant proficiency, readiness, age, or skill classification.',
    source='canonical_research_candidate',updated_at=now()
  WHERE exercise_id=39;

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  VALUES(canonical_definition,1,2,'2.0.0',migration_key,'quarantined',
    jsonb_build_object(
      'identity',jsonb_build_object('passed',TRUE,'identityKey','fixed_bilateral_palms_and_forefeet_high_plank_to_comfortable_inverted_v_and_return_cycle','legacySources',3,'activeVariants',1,'archivedSourceSkeletons',3,'exactDuplicateConsolidations',2,'neighborBoundaries',3),
      'taxonomy',jsonb_build_object('passed',TRUE,'controlledTerms',TRUE,'movementPatterns',jsonb_build_array('brace','push','hinge'),'bodyRegions',jsonb_build_array('hand','wrist','elbow','shoulder','scapula','core','spine','hip','knee','ankle','foot'),'equipment',jsonb_build_array('none','mat_optional')),
      'anatomy',jsonb_build_object('passed',TRUE,'musclesJointsActionsPlanesLateralityContactsSequenceAndEndpointBoundary',TRUE),
      'difficulty',jsonb_build_object('passed',TRUE,'model','max_exercise_complexity_physical_difficulty','variantVectors',jsonb_build_array('30/28/30'),'participantClassificationAbsent',TRUE,'independentCalibrationRequired',TRUE),
      'loadFatigueRecovery',jsonb_build_object('passed',TRUE,'actualCyclesSupportEndpointRangeFaultSymptomsAndOverlappingClosedChainExposureTracked',TRUE,'impactNone',TRUE,'recoveryIsPlanningEstimate',TRUE),
      'constraints',jsonb_build_object('passed',TRUE,'floorTransferContactsSupportHeadBelowHeartSymptomsRestrictionsSpaceTrafficScopeAndEmergencyRoute',TRUE),
      'delivery',jsonb_build_object('passed',TRUE,'profiles',2,'prepareAndResilience',TRUE,'durationDoseRestStationExitAndSubstitutionRevalidation',TRUE),
      'instructions',jsonb_build_object('passed',TRUE,'athleteCoachAccessibilityAndSupportOperations',TRUE,'contactsEndpointsReturnSymptomsFloorTransferAndClinicalScope',TRUE),
      'research',jsonb_build_object('passed',TRUE,'sections',16,'registryVersion',research_version,'directAndAdjacentEvidenceSeparated',TRUE,'exampleDoseNotUniversal',TRUE),
      'media',jsonb_build_object('passed',FALSE,'candidateCount',5,'currentOEmbedMetadataHealthy',TRUE,'playbackReviewed',FALSE,'exactVariantReviewed',FALSE,'captionsAccessibilityQualitySafetyAndApprovalReviewed',FALSE),
      'relationships',jsonb_build_object('passed',FALSE,'reviewOnly',4,'approved',0,'automaticSubstitution',FALSE),
      'calibration',jsonb_build_object('passed',FALSE,'reviewOnly',2,'approved',0),
      'alternates',jsonb_build_object('passed',TRUE,'assessments',24,'sameIdentity',4,'modifierAnnotations',7,'newVariants',5,'newDefinitions',8,'singleExactVariant',TRUE),
      'generationSupport',jsonb_build_object('passed',TRUE,'selectionConstraints',TRUE,'cumulativeFatigueAndImpactBudgets',TRUE,'duration',TRUE,'floorStationTransferAndHeadPosition',TRUE,'substitutionRevalidation',TRUE,'renderingAndPersistence',TRUE),
      'publication',jsonb_build_object('passed',FALSE,'reviewer',NULL,'approver',NULL)),
    jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01','message','A qualified human must watch all five candidates in full and verify playback, fixed contacts, high-plank and inverted-V endpoints, action, return count, range, captions, accessibility, cue quality, safety, conflicts, reviewer identity, timestamp, card version, and approval rationale.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','A qualified coach must approve or reject all four relationships; no automatic substitution to hold, calf-pedal, pike-push-up, walkout, elevated, forearm, equipment, unilateral, or added-action tasks is authorized.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','An independent qualified reviewer must calibrate exercise complexity 30 and physical difficulty 28. Scores do not classify a participant or create an age, proficiency, readiness, or skill level.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','A qualified reviewer and separate approver must complete content review before publication. Identity consolidation, anatomy, loading, head-below-heart and floor-transfer safety, clinical scope, dose, stop, accessibility, persistence, and support rules remain quarantined.')),
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
        AND movement_patterns=ARRAY['brace','push','hinge']::TEXT[]
        AND anatomy_json<>'{}'::JSONB AND environment_json<>'{}'::JSONB
        AND population_json<>'{}'::JSONB AND athlete_support_json<>'{}'::JSONB
        AND coach_support_json<>'{}'::JSONB AND support_operations_json<>'{}'::JSONB
        AND provenance_json->>'approvalsCreated'='false')
    OR (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id IN(source675_definition,source795_definition) AND status='archived'
        AND provenance_json->>'identityStatus'='exact_duplicate_consolidated')<>2
    OR (SELECT count(*) FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id IN(39,675,795) AND definition_id=canonical_definition
        AND source_kind IN('legacy_migration','duplicate_consolidation')
        AND provenance_json->>'approvalsCreated'='false')<>3
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id IN(source39_variant,source675_variant,source795_variant)
        AND status='archived'
        AND requirements_json->>'representation'='superseded_source_skeleton')<>3
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=exact_variant AND definition_id=canonical_definition AND status='review'
        AND requirements_json->>'selectable'='true'
        AND (difficulty_json->>'technicalComplexity')::INTEGER=30
        AND (difficulty_json->>'physicalDifficulty')::INTEGER=28
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=greatest(30,28)
        AND (load_profile_json->>'landingContactsPerRep')::INTEGER=0
        AND (fatigue_profile_json->>'impactAccumulation')::INTEGER=1
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
        AND resolved_definition_id IN(source675_definition,source795_definition)
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

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=39
      AND skill_level IS NULL AND age_min IS NULL AND age_max IS NULL
      AND linked_skill_id IS NULL AND is_published=FALSE AND archived=FALSE
      AND programming_kind='exercise' AND why_publish_ready=FALSE)
    OR (SELECT count(*) FROM coaching.exercise WHERE id IN(675,795)
      AND skill_level IS NULL AND age_min IS NULL AND age_max IS NULL
      AND linked_skill_id IS NULL AND is_published=FALSE AND archived=TRUE
      AND why_publish_ready=FALSE)<>2
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1
      WHERE exercise_id=39 AND technical_complexity=30
        AND absolute_load_demand=28 AND base_overall_difficulty=30
        AND human_review_status='queued' AND reviewed_by IS NULL AND reviewed_at IS NULL)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=canonical_definition AND card_version=2
        AND status='quarantined' AND human_review_required=TRUE
        AND jsonb_array_length(blocking_issues_json)=4) THEN
    RAISE EXCEPTION '% legacy projection or packet assertion failed',migration_key;
  END IF;
END
$migration$;
