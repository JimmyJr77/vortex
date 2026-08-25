-- Source 38: replace the skeletal Bear Crawl Rock-Back with one exact stationary
-- fixed-contact knee-hover cycle. Restore Source 912 to its archived definition
-- because optional knee contact leaves exact identity unresolved. Evidence, media,
-- graph, calibration, content, and publication authority remain human-only.
DO $migration$
DECLARE
  migration_key CONSTANT TEXT := '510_coaching_bear_crawl_rock_back_identity_and_family_audit_hardening';
  research_version CONSTANT TEXT := '2026-08-09.105';
  canonical_definition UUID;
  source912_definition UUID;
  source38_variant UUID;
  source912_variant UUID;
  exact_variant UUID;
  active_variant_ids UUID[];
  all_owned_variant_ids UUID[];
  bear_hold_definition UUID;
  bear_hold_variant UUID;
  shoulder_tap_definition UUID;
  shoulder_tap_variant UUID;
  slow_crawl_definition UUID;
  slow_crawl_variant UUID;
  crawl_prep_definition UUID;
  crawl_prep_variant UUID;
  protected_count INTEGER;
BEGIN
  SELECT id INTO canonical_definition FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND legacy_exercise_id=38;
  SELECT id INTO source912_definition FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND legacy_exercise_id=912;
  SELECT id INTO source38_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=canonical_definition AND variant_key='baseline';
  SELECT id INTO source912_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=canonical_definition AND variant_key='baseline-source-912';
  SELECT coalesce((SELECT id FROM coaching.exercise_variant_v1
    WHERE definition_id=canonical_definition AND variant_key='stationary-bear-hover-rock-back'),gen_random_uuid())
  INTO exact_variant;
  SELECT id INTO bear_hold_definition FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND legacy_exercise_id=242;
  SELECT id INTO bear_hold_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=bear_hold_definition AND variant_key='baseline';
  SELECT id INTO shoulder_tap_definition FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND legacy_exercise_id=243;
  SELECT id INTO shoulder_tap_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=shoulder_tap_definition AND variant_key='baseline';
  SELECT id INTO slow_crawl_definition FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND legacy_exercise_id=250;
  SELECT id INTO slow_crawl_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=slow_crawl_definition AND variant_key='baseline';
  SELECT id INTO crawl_prep_definition FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND legacy_exercise_id=798;
  SELECT id INTO crawl_prep_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=crawl_prep_definition AND variant_key='baseline';
  active_variant_ids:=ARRAY[exact_variant];
  all_owned_variant_ids:=ARRAY[source38_variant,source912_variant,exact_variant];

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=38 AND facility_id=1)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=912 AND facility_id=1)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition AND facility_id=1 AND legacy_exercise_id=38)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=source912_definition AND facility_id=1 AND legacy_exercise_id=912 AND status='archived')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=38 AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=912 AND definition_id IN(canonical_definition,source912_definition))
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source38_variant AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source912_variant AND definition_id IN(canonical_definition,source912_definition))
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=bear_hold_variant AND definition_id=bear_hold_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=shoulder_tap_variant AND definition_id=shoulder_tap_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=slow_crawl_variant AND definition_id=slow_crawl_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=crawl_prep_variant AND definition_id=crawl_prep_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1 WHERE exercise_id=38)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_difficulty_profile WHERE exercise_id=38)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_safety_profile WHERE exercise_id=38) THEN
    RAISE EXCEPTION '% prerequisite source or neighbor rows are missing',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=exact_variant AND definition_id<>canonical_definition)
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE slug='bear-crawl-rock-back' AND id<>canonical_definition) THEN
    RAISE EXCEPTION '% working UUID or slug already belongs to another card',migration_key;
  END IF;

  SELECT coalesce(sum(n),0) INTO protected_count FROM (
    SELECT count(*) n FROM coaching.exercise_definition_v1
      WHERE id IN(canonical_definition,source912_definition)
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
      WHERE (survivor_definition_id IN(canonical_definition,source912_definition)
          OR resolved_definition_id IN(canonical_definition,source912_definition))
        AND (reviewed_by IS NOT NULL OR resolution_source='human_review')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_v1
      WHERE exercise_id=38
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
    provenance_json=(coalesce(provenance_json,'{}'::JSONB)-'researchSources')
      ||jsonb_build_object(
        'migration',migration_key,'researchVersion',research_version,
        'sourceDisposition','canonical_stationary_bear_hover_rock_back_reauthored',
        'representedBySelectableSourceVariant',FALSE,
        'sourceInterpretation','Source 38 supplies hands and toes knee hover palm pressure backward hip shift toward heels and return but omits exact contact endpoint count anatomy load fatigue constraints duration substitution persistence support and review contracts.',
        'exactWorkingSpecification','stationary_fixed_palms_and_forefeet_continuous_bilateral_knee_hover_backward_and_forward_return_cycle',
        'researchSources',jsonb_build_array(
          'https://www.spoonerpt.com/spooner-blog/dynamic-warm-up-for-mountain-bikers/',
          'https://www.jtsstrength.com/7-step-low-back-warmup/',
          'https://pubmed.ncbi.nlm.nih.gov/36117695/',
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC10824310/',
          'https://pubmed.ncbi.nlm.nih.gov/24235984/',
          'https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en'),
        'exerciseDifficultyDescribesTaskOnly',TRUE,
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=38 AND definition_id=canonical_definition;

  UPDATE coaching.exercise_definition_source_v1 SET
    definition_id=source912_definition,source_kind='legacy_migration',
    provenance_json=jsonb_build_object(
      'source_table','coaching.exercise','migration',migration_key,
      'researchVersion',research_version,
      'sourceDisposition','restored_to_own_archived_definition_needs_human_review',
      'sourceInterpretation','Source 912 permits knees hovering or lightly down and omits exact start endpoint contact continuity and count; name similarity cannot prove exact identity with Source 38.',
      'identityBoundary','continuous_knee_hover_vs_optional_knee_contact_and_incomplete_contract',
      'selectable',FALSE,'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=912;

  UPDATE coaching.exercise_delivery_profile_v1 SET status='archived',updated_at=now()
  WHERE variant_id IN(source38_variant,source912_variant);
  UPDATE coaching.exercise_variant_v1 SET
    variant_key='identity-quarantine-source-38',
    display_name='Bear Crawl Rock-Back Legacy Skeleton — Source 38',
    modifier_keys='{}'::TEXT[],difficulty_json='{}'::JSONB,status='archived',
    requirements_json=jsonb_build_object(
      'selectable',FALSE,'representation','superseded_source_skeleton',
      'sourceLegacyExerciseId',38,
      'archiveReason','exact contacts hover continuity endpoint return count anatomy loading budgets duration constraints substitutions persistence and support were missing',
      'replacementVariantIds',to_jsonb(active_variant_ids),'humanReviewRequired',TRUE),
    load_profile_json=jsonb_build_object('selectable',FALSE),
    fatigue_profile_json=jsonb_build_object('selectable',FALSE),
    programming_profile_json=jsonb_build_object(
      'selectionStatus','superseded_source_skeleton','selectable',FALSE,
      'publicationQuarantined',TRUE),updated_at=now()
  WHERE id=source38_variant;

  UPDATE coaching.exercise_variant_v1 SET
    definition_id=source912_definition,variant_key='identity-quarantine-source-912',
    display_name='Bear Crawl Rockback Ambiguous Support Contract — Source 912',
    modifier_keys='{}'::TEXT[],difficulty_json='{}'::JSONB,status='archived',
    requirements_json=jsonb_build_object(
      'selectable',FALSE,'representation','ambiguous_source_identity',
      'sourceLegacyExerciseId',912,
      'archiveReason','optional knee contact and missing exact start endpoint contact continuity and count prevent exact identity resolution',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    load_profile_json=jsonb_build_object('selectable',FALSE),
    fatigue_profile_json=jsonb_build_object('selectable',FALSE),
    programming_profile_json=jsonb_build_object(
      'selectionStatus','identity_quarantine','selectable',FALSE,
      'publicationQuarantined',TRUE),updated_at=now()
  WHERE id=source912_variant;

  UPDATE coaching.exercise_definition_v1 SET
    status='archived',approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,
    last_reviewed_at=NULL,
    provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'identityStatus','needs_human_review','selectable',FALSE,
      'source912Restored',TRUE,'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    updated_at=now()
  WHERE id=source912_definition;

  INSERT INTO coaching.exercise_definition_v1(
    id,facility_id,legacy_exercise_id,slug,canonical_name,display_name,aliases,
    description,family_key,schema_version,card_version,status,
    content_confidence,scoring_confidence,media_confidence,movement_patterns,
    body_regions,required_equipment,optional_equipment,environment_json,
    population_json,provenance_json,approved_video_url,reviewed_by,approved_by,
    last_reviewed_at,anatomy_json,athlete_support_json,coach_support_json,
    support_operations_json)
  VALUES(
    canonical_definition,1,38,'bear-crawl-rock-back','Bear Crawl Rock-Back',
    'Bear Crawl Rock-Back',
    ARRAY['Stationary Bear Crawl Rock-Back','Bear Hover Rock-Back','Bear Position Rocking'],
    'Start on both palms and forefeet with hands under shoulders, knees under hips, arms long, and both knees hovering about one to two inches above the floor. Keep every contact fixed and, without touching the knees down, press through the palms and shift the hips backward toward the heels through a comfortable range. Shift forward to the same organized bear-hover start and count one complete backward-and-forward return as one repetition. Range, exact hover height, foot stance, hip endpoint, tempo, pauses, breathing prompts, repetitions, sets, rest, and a visual hip target are annotations. Knee contact, hands-and-knees support, steps, rotation, circles, limb lifts, changed support equipment, or hold-only execution changes the task.',
    'stationary_bear_hover_rock_back','2.0.0',2,'review',86,60,50,
    ARRAY['brace','push','squat']::TEXT[],
    ARRAY['hand','wrist','elbow','shoulder','scapula','core','spine','hip','knee','ankle','foot']::TEXT[],
    ARRAY['none']::TEXT[],ARRAY['mat_optional']::TEXT[],
    jsonb_build_object(
      'surface','clean flat dry stable nonslip floor suitable for palms and forefeet',
      'space','one floor station with full backward hip-shift clearance no cross traffic and a clear controlled exit route',
      'stationCapacity',1,'equipmentKey','none','optionalEquipment',jsonb_build_array('mat_optional'),
      'coachSightline','side and front-quarter views of contacts knee clearance shoulders arms trunk pelvis hip path breathing and symptoms',
      'inspection',jsonb_build_array('floor traction cleanliness temperature and debris','hand and forefoot clearance','backward hip and heel clearance','neighbor and cross-traffic separation','entry exit sightline communication and emergency route'),
      'changeRule','Any support surface contact base limb action load path dose symptom space or downstream-demand change requires full revalidation.'),
    jsonb_build_object(
      'exerciseCardDoesNotClassifyParticipants',TRUE,'readinessIsWorkoutInput',TRUE,
      'selectionPrerequisites',jsonb_build_array('safe controlled floor transfer and exit','comfortable bilateral palm and forefoot support','can sustain the declared knee hover','comfortable long-arm closed-chain shoulder support','understands fixed contacts back-and-forward count and stop signal','same-session upper-limb trunk hip knee ankle crawling plank and floor-work budgets fit'),
      'excludeOrEscalate',jsonb_build_array('recent significant trauma surgery or procedure without applicable clearance','worsening night post-trauma sharp increasing or unfamiliar pain','new numbness tingling weakness altered circulation or loss of control','wrist hand elbow shoulder neck back hip knee ankle or foot symptoms preventing exact task','instability uncontrolled collapse or inability to exit safely','dizziness faintness nausea visual change chest pain unusual breathlessness disorientation or inability to communicate','clinical restriction conflicting with loaded floor support or knee hover','unsafe floor space traffic sightline or emergency route','participant requests stop'),
      'notEstablishedByEvidence',jsonb_build_array('universal eligibility normal range ideal spine shape or knee-hover height','diagnosis treatment prevention correction readiness or clearance','isolated muscle activation','one universal dose frequency fatigue ceiling recovery progression or warm-up outcome','performance transfer age floor or participant skill level')),
    jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'canonicalAuthoredFromResearch',TRUE,
      'primaryIdentitySource','https://www.spoonerpt.com/spooner-blog/dynamic-warm-up-for-mountain-bikers/',
      'legacySources',jsonb_build_array(38),
      'excludedAmbiguousLegacySources',jsonb_build_array(912),
      'identityContract','stationary_fixed_palms_and_forefeet_continuous_bilateral_knee_hover_backward_shift_and_forward_return_to_same_start',
      'researchSources',jsonb_build_array(
        'https://www.spoonerpt.com/spooner-blog/dynamic-warm-up-for-mountain-bikers/',
        'https://www.jtsstrength.com/7-step-low-back-warmup/',
        'https://pubmed.ncbi.nlm.nih.gov/36117695/',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC10824310/',
        'https://pubmed.ncbi.nlm.nih.gov/24235984/',
        'https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en'),
      'confidenceBySection',jsonb_build_object('identity',86,'taxonomy',84,'anatomy',76,'difficulty',60,'load',68,'fatigueRecovery',54,'constraints',82,'dosage',58,'instructions',86,'alternates',88,'media',50),
      'unresolvedClaims',jsonb_build_array('one universal spacing hover height endpoint spinal shape dose frequency fatigue ceiling recovery progression or outcome','numeric difficulty calibration','Source 912 exact identity','media playback exactness captions accessibility quality safety and approval','individual symptom interpretation or clinical eligibility'),
      'externalPlaybackVerificationPerformed',FALSE,'sourceLimitationsExplicit',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,'publicationQuarantined',TRUE),
    NULL,NULL,NULL,NULL,
    jsonb_build_object(
      'primaryMuscles',jsonb_build_array('rectus_abdominis','transversus_abdominis_and_obliques','deltoid','serratus_anterior','triceps_brachii','quadriceps'),
      'secondaryMuscles',jsonb_build_array('rotator_cuff','trapezius','latissimus_dorsi','spinal_extensors','gluteus_maximus_and_medius','hip_flexors','calf_and_intrinsic_foot_muscles'),
      'stabilizers',jsonb_build_array('wrist_and_hand_stabilizers','scapular_stabilizers','deep_spinal_stabilizers','pelvic_stabilizers','knee_and_ankle_stabilizers'),
      'joints',jsonb_build_array('metacarpophalangeal_and_interphalangeal_joints','radiocarpal_wrist','elbow','glenohumeral','scapulothoracic','spinal_intervertebral','sacroiliac_and_hip','knee','ankle','metatarsophalangeal'),
      'jointActions',jsonb_build_array('wrist_extension_isometric','elbow_extension_isometric','closed_chain_shoulder_flexion_and_scapular_stabilization','trunk_anti_extension_and_anti_rotation','hip_and_knee_flexion_during_backward_shift','hip_and_knee_extension_during_forward_return','ankle_and_forefoot_isometric_support'),
      'planes',jsonb_build_array('sagittal_weight_shift','multiplanar_stabilization'),
      'laterality','bilateral symmetric support with both palms and both forefeet retained throughout',
      'supportContacts',jsonb_build_array('left_palm','right_palm','left_forefoot_and_toes','right_forefoot_and_toes'),
      'contactRule','Both palms and both forefeet remain fixed and both knees remain clear of the floor throughout every counted cycle.',
      'phaseSequence',jsonb_build_array('organized_bear_hover_start','controlled_backward_hip_shift_toward_heels','comfortable_backward_endpoint','controlled_forward_return_to_same_bear_hover_start'),
      'trunkBoundary','The back and pelvis remain organized without uncontrolled sag arch rotation lateral shift or collapse used to create range.',
      'evidenceBoundary','Direct sources establish the hovering-knee rock-back form. Adjacent quadruped studies support distributed support and trunk demand but do not validate exact activation treatment effects eligibility or Vortex scoring.'),
    jsonb_build_object(
      'whyItMatters','Provides a reproducible stationary closed-chain bear-hover weight-shift task when the workout calls for fixed contacts rather than holding tapping crawling or knees-down rocking.',
      'primaryCue','Keep your hands and toes planted and knees hovering; press the floor away, shift your hips back only as far as you can control, then return to the same start.',
      'expectedSensations',jsonb_build_array('distributed palm forefoot shoulder trunk thigh and hip effort','steady abdominal and shoulder-blade support','comfortable hip and knee bend during the backward shift','increasing effort as hover time accumulates'),
      'unexpectedSensations',jsonb_build_array('sharp increasing night post-trauma or unfamiliar pain','wrist hand shoulder hip knee ankle or foot pain that changes support','pinching catching painful clicking instability or collapse','numbness tingling weakness altered circulation or loss of control','dizziness faintness nausea visual change chest pain unusual breathlessness or disorientation','forced range breath holding or inability to exit safely'),
      'painGuidance','Stop the shift, place the knees down only as a controlled exit rather than a counted repetition, signal the coach, and follow facility escalation policy; do not repeat to test symptoms.',
      'selfChecks',jsonb_build_array('hands_and_toes_stay_planted','knees_remain_hovering','arms_stay_long','palms_press_the_floor','pelvis_stays_level','back_remains_organized','range_is_comfortable','return_reaches_same_start','breathing_continues','no_stop_symptom'),
      'accessibility',jsonb_build_array('side and front-quarter demonstration','written four-step start-back-return-count sequence','visual knee-height and hip targets','smaller comfortable range','slower pace fewer cycles and more rest','written still-image or live instruction instead of video','separately reviewed knees-down elevated-hand or padded-support variant when contacts must change'),
      'mediaAlternatives',jsonb_build_array('written sequence','side-view still frames','floor-contact diagram','coach live demonstration','large-print quality and stop checklist'),
      'stopSignal','Stop, lower the knees in control if safe, exit the floor station, and tell the coach what changed.'),
    jsonb_build_object(
      'observationChecklist',jsonb_build_array('exact fixed-contact hover identity','safe entry and exit','palm and forefoot contacts','knee clearance','hand-under-shoulder and knee-under-hip start','long arms and active palm pressure','level pelvis and organized trunk','backward range and same-start return','breathing symptoms first fault and actual exposure'),
      'faultCorrections',jsonb_build_object('knees_touch','end_the_counted_cycle_reset_or_stop_do_not_relabel','hands_or_feet_step','stop_and_restore_exact_stationary_variant','pelvis_rotates_or_back_sags_arches','reduce_range_or_cycles_and_restore_control','elbows_bend_or_shoulders_collapse','reduce_range_or_end_set','pain_instability_or_neurologic_symptom','controlled_exit_and_facility_escalation'),
      'demonstrationPlan','Show floor entry, exact four contacts, knee clearance, long-arm start, backward shift, comfortable endpoint, same-start return, valid count, smaller-range option, invalid knee touch or step, stop signal, and controlled exit.',
      'groupManagement',jsonb_build_array('one participant per clean marked floor station','stagger entry and starts for side and front-quarter observation','declare cycles pace range rest and stop signal before floor transfer','count invalid partial and symptom-limited attempts as exposure but not repetitions'),
      'modificationDecisionTree',jsonb_build_array('urgent symptom or unsafe support stop and use facility protocol','reduce range cycle count or pace and increase rest first','change knee contact hand height surface limb action or load only through a reviewed variant','select a distinct hold tap crawl or knees-down definition only when purpose may change','recompute duration fatigue logistics substitution persistence and rendering after every change'),
      'doNotUseWhen',jsonb_build_array('safe floor transfer or exit is unavailable','comfortable palm forefoot long-arm or knee-hover support is unavailable','symptoms restrictions or clinical instructions conflict','floor cleanliness traction space sightline communication or emergency route is inadequate','the intended task is assessment treatment locomotion hold tapping or another identity'),
      'validRepetition','One controlled backward shift from the exact bear-hover start and forward return to the same start with fixed palms and forefeet continuous knee clearance long arms level pelvis organized trunk continuous breathing and no stop rule.'),
    jsonb_build_object(
      'selectionInputs',jsonb_build_array('workout purpose','floor transfer and station safety','palm forefoot wrist shoulder trunk hip knee and ankle tolerance','continuous knee hover and exact count comprehension','cycle dose pace range rest and duration','cumulative closed-chain upper-limb trunk lower-limb crawling plank handstand and floor-work exposure','coach sightline communication and scope'),
      'durationInputs',jsonb_build_array('floor transfer and setup','valid cycle seconds','rest','invalid partial or symptom-limited attempts','substitution','station reset and exit transfer'),
      'persistenceFields',jsonb_build_array('definition variant card and research version','planned and actual complete cycles','hover height range tempo endpoint and rest','valid invalid partial and symptom-limited attempts','contact knee pelvis arm trunk and breathing faults','first fault symptoms stop reason and escalation','duration substitution and downstream budget'),
      'renderingRequirements',jsonb_build_array('plain-language fixed-contact hover identity','cycle dose pace range and rest','start-back-return-count sequence','quality gate and stop rules','smaller-range option and controlled exit','no diagnosis treatment readiness or outcome claim'),
      'auditState','machine_complete_review_only','humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  )
  ON CONFLICT(id) DO UPDATE SET
    facility_id=EXCLUDED.facility_id,legacy_exercise_id=EXCLUDED.legacy_exercise_id,
    slug=EXCLUDED.slug,canonical_name=EXCLUDED.canonical_name,
    display_name=EXCLUDED.display_name,aliases=EXCLUDED.aliases,
    description=EXCLUDED.description,family_key=EXCLUDED.family_key,
    schema_version=EXCLUDED.schema_version,card_version=EXCLUDED.card_version,
    status='review',content_confidence=EXCLUDED.content_confidence,
    scoring_confidence=EXCLUDED.scoring_confidence,media_confidence=EXCLUDED.media_confidence,
    movement_patterns=EXCLUDED.movement_patterns,body_regions=EXCLUDED.body_regions,
    required_equipment=EXCLUDED.required_equipment,optional_equipment=EXCLUDED.optional_equipment,
    environment_json=EXCLUDED.environment_json,population_json=EXCLUDED.population_json,
    provenance_json=EXCLUDED.provenance_json,approved_video_url=NULL,
    reviewed_by=NULL,approved_by=NULL,last_reviewed_at=NULL,
    anatomy_json=EXCLUDED.anatomy_json,athlete_support_json=EXCLUDED.athlete_support_json,
    coach_support_json=EXCLUDED.coach_support_json,
    support_operations_json=EXCLUDED.support_operations_json,updated_at=now();

  INSERT INTO coaching.exercise_variant_v1(
    id,definition_id,variant_key,display_name,modifier_keys,difficulty_json,
    requirements_json,status,load_profile_json,fatigue_profile_json,
    programming_profile_json)
  VALUES(
    exact_variant,canonical_definition,'stationary-bear-hover-rock-back',
    'Stationary Bear Hover Rock-Back',
    ARRAY['range','knee_hover_height','foot_stance','hip_endpoint','tempo','pause','breathing_prompt','complete_cycles','sets','rest_seconds','visual_hip_target']::TEXT[],
    jsonb_build_object(
      'technicalComplexity',30,'absoluteLoadDemand',24,'physicalDifficulty',24,
      'baseOverallDifficulty',greatest(30,24),
      'overallFormula','max_exercise_complexity_physical_difficulty',
      'scoringScope','exact_stationary_fixed_contact_bear_hover_rock_back_variant',
      'exerciseScoresDescribeTaskOnly',TRUE,
      'participantSkillAgeReadinessClassification',FALSE,
      'independentCalibrationRequired',TRUE,'humanReviewRequired',TRUE),
    jsonb_build_object(
      'selectable',TRUE,'equipment',jsonb_build_array('none','mat_optional'),
      'surface','clean_flat_dry_stable_nonslip_floor',
      'base','bilateral_palms_and_forefeet_fixed',
      'supportContacts',jsonb_build_array('left_palm','right_palm','left_forefoot_and_toes','right_forefoot_and_toes'),
      'kneeRule','both_knees_hover_about_one_to_two_inches_without_floor_contact',
      'armRule','both_arms_remain_long_with_active_palm_pressure',
      'exactSequence',jsonb_build_array('organized_bear_hover_start','backward_hip_shift_toward_heels','comfortable_endpoint','forward_return_to_same_start'),
      'countingRule','one_complete_backward_and_forward_return_is_one_repetition',
      'validCompletion','all four contacts remain fixed both knees remain clear arms stay long pelvis stays level trunk stays organized range remains comfortable the return reaches the same start breathing continues and no stop rule occurs',
      'invalidCompletion',jsonb_build_array('knee_contact','hand_or_foot_step','elbow_bend_or_shoulder_collapse','uncontrolled_spinal_sag_arch_rotation_or_lateral_shift','pelvic_rotation_or_loss_of_level','forced_range','incomplete_return','breath_hold','symptom_stop'),
      'variantBoundaries',jsonb_build_array('support_surface','knee_contact','hand_height','limb_contact','locomotion','action_path','external_load','isometric_hold','clinical_scope','count'),
      'clinicalAssessmentOrTreatment',FALSE,'humanReviewRequired',TRUE),
    'review',
    jsonb_build_object(
      'loadingType','bodyweight_closed_chain_dynamic_weight_shift',
      'externalLoadMethod','none_body_mass_shared_across_bilateral_palms_and_forefeet',
      'gripDemand',10,'jointStress',22,'spinalLoading',12,'eccentricStress',12,
      'landingContactsPerRep',0,'handImpactContactsPerRep',0,'impactClass','none',
      'primaryExposure',jsonb_build_array('closed_chain_upper_extremity_support','dynamic_anteroposterior_weight_shift','shoulder_and_scapular_stabilization','trunk_and_pelvic_anti_extension_and_anti_rotation','hip_and_knee_flexion_under_hover','wrist_extension_and_forefoot_support'),
      'tracking',jsonb_build_array('variant','floor_surface','planned_and_actual_complete_cycles','hover_height','comfortable_range','tempo_and_pauses','valid_invalid_partial_and_symptom_limited_attempts','contact_knee_arm_pelvis_and_trunk_faults','first_fault','symptoms','hover_and_support_seconds','rest','duration','same_session_closed_chain_and_floor_work_exposure')),
    jsonb_build_object(
      'localMuscleFatigue',24,'gripFatigue',10,'technicalFatigueSensitivity',30,
      'impactAccumulation',1,'recoveryHours',12,'recoveryRangeHours',jsonb_build_array(8,24),
      'primaryFatigueSites',jsonb_build_array('wrist_and_hand_support','shoulder_and_scapular_stabilizers','abdominal_and_spinal_stabilizers','hip_flexors_and_quadriceps','forefoot_and_ankle_support','attention_and_contact_control'),
      'cumulativeBudget',jsonb_build_object('completeCycles',36,'hoverAndSupportSeconds',300,'closedChainUpperLimbLoad',36,'trunkStabilizationSeconds',300,'forefootSupportSeconds',300,'technicalSensitivity',30,'impact',1),
      'interference',jsonb_build_array('later_high_priority_handstand_plank_push_crawl_climb_hang_or_upper_limb_skill','same_session_wrist_shoulder_trunk_hip_knee_ankle_or_floor_work_loading','fatigue_that_changes_contacts_knee_clearance_arm_length_pelvis_or_trunk_control'),
      'recoveryIsPlanningEstimate',TRUE,'tissueThresholdNotEstablished',TRUE),
    jsonb_build_object(
      'trainingStimuli',jsonb_build_array('stationary_bear_hover_control','closed_chain_upper_limb_support','controlled_sagittal_weight_shift','trunk_pelvic_and_lower_limb_stabilization'),
      'stimulusDose',jsonb_build_object('sets',jsonb_build_array(1,3),'completeCycles',jsonb_build_array(4,12),'secondsPerCycle',jsonb_build_array(3,8),'restSeconds',jsonb_build_array(20,60)),
      'weeklyExposure',jsonb_build_object('minimum',0,'maximumWithoutReview',7,'unit','sessions','contextDependent',TRUE),
      'prerequisites',jsonb_build_array('safe_controlled_floor_transfer_and_exit','comfortable_bilateral_palm_and_forefoot_support','continuous_declared_knee_hover','comfortable_long_arm_closed_chain_support','understands_fixed_contacts_return_count_and_stop','same_session_closed_chain_trunk_lower_limb_and_floor_work_budgets_fit'),
      'completionCriteria',jsonb_build_array('four_contacts_fixed','knees_hover_continuously','arms_long','pelvis_level','trunk_organized','comfortable_backward_range','controlled_return_to_same_start','continuous_breathing','no_stop_symptoms'),
      'sequenceRules',jsonb_build_array('prepare_access_or_movement_intelligence_context','do_not_turn_range_hover_height_stance_tempo_pause_breathing_dose_or_visual_target_annotations_into_hidden_variants','do_not_add_knee_contact_steps_rotation_limb_lift_load_or_hold_only_execution_silently','revalidate_downstream_wrist_shoulder_trunk_hip_knee_ankle_crawling_plank_handstand_and_floor_work_load'),
      'pairingCompatibility',jsonb_build_object('compatible',jsonb_build_array('low_impact_preparation_when_all_support_and_fatigue_budgets_fit'),'avoid',jsonb_build_array('fatiguing_wrist_or_closed_chain_work_before_priority_handstand_push_or_crawl_skill','symptom_provoking_floor_support','time_critical_work_when_floor_transfer_displaces_priority_training')),
      'interferenceRules',jsonb_build_array('count_all_overlapping_hover_plank_crawl_push_handstand_and_floor_support','count_all_overlapping_wrist_shoulder_trunk_hip_knee_ankle_and_forefoot_work','stop_before_contacts_knee_clearance_arm_length_pelvis_trunk_or_exit_control_changes'),
      'uncertaintyPolicy','When exact contacts knee-hover rule start endpoint return count symptoms floor safety or available time is uncertain do not select; request clarification or choose a separately validated card.',
      'selectionStatus','review_only_machine_complete','publicationQuarantined',TRUE,
      'exerciseDifficultyDescribesTaskOnly',TRUE,'approvalsCreated',FALSE)
  )
  ON CONFLICT(id) DO UPDATE SET
    definition_id=EXCLUDED.definition_id,variant_key=EXCLUDED.variant_key,
    display_name=EXCLUDED.display_name,modifier_keys=EXCLUDED.modifier_keys,
    difficulty_json=EXCLUDED.difficulty_json,requirements_json=EXCLUDED.requirements_json,
    status='review',load_profile_json=EXCLUDED.load_profile_json,
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
      'Use the exact fixed-contact hovering-knee cycle as low-impact floor preparation only when transfer, support tolerance, symptoms, duration, and cumulative closed-chain and downstream budgets fit.'
    ELSE
      'Use the exact cycle to practice controlled stationary bear-hover weight shift without turning it into locomotion, a hold, a maximal-effort test, clinical treatment, or readiness assessment.' END,
    CASE p.phase_key WHEN 'prepare_and_access' THEN 90 ELSE 84 END,
    CASE p.phase_key WHEN 'prepare_and_access' THEN 86 ELSE 82 END,
    jsonb_build_object('closed_chain_support',90,'stationary_bear_hover_control',94,'sagittal_weight_shift',92,'movement_intelligence',CASE WHEN p.phase_key='prepare_and_access' THEN 80 ELSE 94 END),
    jsonb_build_object('sets',jsonb_build_array(1,CASE WHEN p.phase_key='prepare_and_access' THEN 2 ELSE 3 END),'completeCycles',jsonb_build_array(4,12),'secondsPerCycle',jsonb_build_array(3,8),'restSeconds',jsonb_build_array(20,60),'exampleDoseIsNotUniversal',TRUE),
    'Both palms and forefeet remain fixed, both knees hover without contact, arms remain long, the pelvis stays level, the trunk remains organized, the backward shift stays comfortable, the controlled forward shift returns to the same start, breathing continues, and no stop symptom occurs.',
    ARRAY[
      'Sharp, increasing, night, post-trauma, or unfamiliar pain or participant stop request.',
      'Wrist, hand, elbow, shoulder, neck, back, hip, knee, ankle, or foot symptoms prevent exact support.',
      'Pinching, catching, painful clicking, instability, uncontrolled collapse, or inability to exit safely.',
      'Numbness, tingling, weakness, altered circulation, loss of control, or another neurologic sign.',
      'Dizziness, faintness, nausea, visual change, chest pain, unusual breathlessness, disorientation, or inability to communicate.',
      'A knee touches, a hand or foot steps, elbows bend, shoulders collapse, or exact contacts cannot be restored safely.',
      'Pelvis rotates or the trunk sags, arches, twists, or shifts laterally and cannot be restored by reducing range, cycles, or pace.',
      'Forced range, breath holding, added step, limb lift, rotation, external load, changed support, or another wrong task cannot be corrected safely.',
      'Floor cleanliness, traction, space, traffic, hygiene, sightline, communication, or emergency route becomes unsafe.',
      'The planned cycle, hover, closed-chain, technical-fatigue, duration, or downstream exposure budget is reached.'
    ]::TEXT[],
    'Verify the exact fixed-contact knee-hover variant, floor and transfer safety, palm and forefoot tolerance, current symptoms and restrictions, planned cycles, actual hover and support time, and downstream closed-chain work. Demonstrate entry, start, back, return, count, stop, and exit. Observe contacts, knee clearance, long arms, pelvis, trunk, breathing, symptoms, first fault, actual duration, and controlled exit. Do not diagnose, treat, or imply readiness.',
    'Plant both hands and toes, hover your knees, press the floor away, shift your hips back only as far as you can control, and return to the same start. Stop for pain, tingling, weakness, dizziness, instability, or loss of support.',
    'More consistent control of the exact stationary bear-hover weight-shift task; no treatment, structural, readiness, prevention, or performance outcome is guaranteed.',
    ARRAY['none']::TEXT[],
    jsonb_build_object('stationCapacity',1,'base','bilateral_palms_and_forefeet_fixed_with_knees_hovering','requiredEquipment','none','optionalEquipment','mat_optional','space','one_clean_floor_station_with_backward_shift_and_controlled_exit_clearance','setupSeconds',25,'floorTransferSeconds',15,'coachSightline','side_and_front_quarter','crossTrafficProhibited',TRUE,'floorInspectionRequired',TRUE,'revalidateAfterAnyChange',TRUE),
    ARRAY[bear_hold_variant,shoulder_tap_variant,slow_crawl_variant,crawl_prep_variant]::UUID[],
    'review',
    jsonb_build_object('durationFormula','floor_transfer_and_setup_seconds + sum(actual_valid_cycles * actual_seconds_per_cycle) + rest_seconds + invalid_or_partial_attempt_seconds + symptom_response_seconds + substitution_seconds + station_reset_and_exit_seconds','secondsPerCycle',jsonb_build_array(3,8),'minimumSeconds',55,'typicalSeconds',120,'maximumSecondsWithoutReview',360,'includeActualNotPlanned',TRUE,'recomputeAfterSubstitution',TRUE),
    jsonb_build_object('regressionOrder',jsonb_build_array('reduce_backward_range','reduce_to_four_clean_cycles','slow_the_cycle','increase_rest','end_set','select_a_separately_validated_support_variant'),'progressionOrder',jsonb_build_array('complete_clean_cycles','increase_within_four_to_twelve_cycle_profile','increase_comfortable_range_without_forcing','add_brief_endpoint_pause','select_a_distinct_hold_tap_crawl_or_loaded_task_only_after_full_revalidation'),'neverScaleByAllowingUntrackedKneeContactForcingRangeAddingSpeedOrIgnoringSymptoms',TRUE),
    jsonb_build_object('record',jsonb_build_array('definition_and_variant','floor_surface_and_station','planned_and_actual_complete_cycles','hover_height_range_tempo_pause_and_rest','valid_invalid_partial_and_symptom_limited_attempts','contacts_knee_clearance_arm_pelvis_trunk_and_breathing','first_fault','symptoms_and_stop_reason','hover_and_support_seconds','duration','substitution','station_reset_and_exit'),'validUnit','one_controlled_backward_shift_and_forward_return_to_same_start_with_fixed_palms_and_forefeet_continuous_knee_clearance_long_arms_level_pelvis_organized_trunk_and_no_stop','partial_cycles_do_not_count',TRUE),
    jsonb_build_object('athlete',jsonb_build_array('four_fixed_contacts','knees_hover','press_floor','comfortable_back_shift','same_start_return','warning_symptom_and_support_stop'),'coach',jsonb_build_array('floor_transfer_and_station','contact_and_hover_identity','arms_pelvis_and_trunk_control','valid_cycle_and_first_fault','actual_exposure_and_downstream_budget','clinical_scope','logging_and_escalation'),'accessibility',jsonb_build_array('side_and_front_quarter_demonstration','written_four_step_sequence','visual_knee_height_and_hip_targets','smaller_range_fewer_cycles_slower_tempo_and_more_rest','still_images_or_live_instruction','separately_validated_knees_down_elevated_hand_or_padded_support_alternative'))
  FROM (VALUES
    ('e6e9ed69-2791-4084-a1a7-f7b031475386'::UUID,'prepare-stationary-bear-hover-rock-back','prepare_and_access'),
    ('c00d5227-adee-4f86-889b-1ede98fff1b8'::UUID,'movement-intelligence-stationary-bear-hover-rock-back','movement_intelligence')
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
    equipment_required=EXCLUDED.equipment_required,logistics_json=EXCLUDED.logistics_json,
    substitution_ids=EXCLUDED.substitution_ids,status='review',
    time_model_json=EXCLUDED.time_model_json,dose_scaling_json=EXCLUDED.dose_scaling_json,
    measurement_json=EXCLUDED.measurement_json,
    support_prompts_json=EXCLUDED.support_prompts_json,updated_at=now();

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,rationale,
    evidence_json,resolution_source,reviewed_by,resolved_at)
  SELECT 1,canonical_definition,i.definition_id,i.decision,i.rationale,
    jsonb_build_object('migration',migration_key,'identityBoundary',i.boundary_key,
      'source38Contract','stationary_fixed_palms_and_forefeet_continuous_bilateral_knee_hover_backward_shift_and_forward_return_to_same_start',
      'neighborContract',i.neighbor_contract,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'deterministic_identity_equivalence',NULL,now()
  FROM (VALUES
    (source912_definition,'needs_human_review','continuous_hover_vs_optional_knee_contact','Source 912 permits the knees to hover or rest lightly down and omits exact start endpoint contact continuity and count, so name similarity cannot establish exact identity.','optional_knee_contact_and_incomplete_identity_contract'),
    (bear_hold_definition,'distinct_exercises','dynamic_cycle_vs_isometric_bear_hold','Bear Plank Hold keeps a fixed position instead of completing a backward-and-forward return cycle.','isometric_bear_position_hold'),
    (shoulder_tap_definition,'distinct_exercises','four_point_cycle_vs_three_point_shoulder_tap','Bear Plank Shoulder Tap removes one hand at a time and taps the opposite shoulder, changing contacts laterality anti-rotation demand and count.','alternating_three_point_support_and_shoulder_tap'),
    (slow_crawl_definition,'distinct_exercises','stationary_rocking_vs_quadrupedal_locomotion','Slow Bear Crawl travels through space with coordinated hand and foot steps rather than keeping all four contacts fixed.','quadrupedal_locomotion_over_distance'),
    (crawl_prep_definition,'distinct_exercises','exact_hover_cycle_vs_separate_prep_contract','Bear Crawl Prep has its own preparation contract and cannot be inferred to include the exact fixed-contact backward-and-forward cycle.','separate_authored_preparation_contract')
  ) i(definition_id,decision,boundary_key,rationale,neighbor_contract)
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,resolution_source=EXCLUDED.resolution_source,
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
    ('identity','https://www.spoonerpt.com/spooner-blog/dynamic-warm-up-for-mountain-bikers/','Dynamic Warm-Up for Mountain Bikers: Bear Crawl Rock Backs','Spooner Physical Therapy','expert_instruction','The direct instruction starts on hands and toes with knees hovering and hips over knees, then pushes the hips back over the heels while the hands press into the floor.','direct exact-task identity and instruction','The source does not define every Vortex contact, endpoint, count, fault, population, or neighbor boundary.',82),
    ('taxonomy','https://www.jtsstrength.com/7-step-low-back-warmup/','7 Step Lower Back Warmup: Bear Crawl Rock Backs','Juggernaut Training Systems','expert_instruction','The task combines bear-hover bracing, active hand pressure, controlled backward weight shift, and return without locomotor steps.','direct movement and support context','The source does not create Vortex taxonomy keys or outcome guarantees.',76),
    ('anatomy','https://pubmed.ncbi.nlm.nih.gov/36117695/','Perceived exertion, postural control, and muscle recruitment in three different quadruped exercises performed by healthy women','Frontiers in Physiology','peer_reviewed_research','Thirty healthy women performing three quadruped postures showed task-dependent palmar center-of-pressure perceived-exertion and trunk-muscle activity profiles.','adjacent quadruped anatomy and support-demand context','The study did not test this hovering-knee rock-back and does not establish exact activation isolation or treatment effects.',86),
    ('biomechanics','https://www.spoonerpt.com/spooner-blog/dynamic-warm-up-for-mountain-bikers/','Dynamic Warm-Up for Mountain Bikers: Bear Crawl Rock Backs','Spooner Physical Therapy','expert_instruction','The documented setup keeps hands and toes as contacts, knees hovering, hips initially over knees, and the backward shift directed toward the heels.','direct contact and path contract','The source does not validate one universal hand spacing foot stance hover height endpoint or spinal shape.',82),
    ('difficulty','https://www.jtsstrength.com/7-step-low-back-warmup/','7 Step Lower Back Warmup: Bear Crawl Rock Backs','Juggernaut Training Systems','expert_instruction','The instruction requires hands under shoulders, knees one inch off the floor, active hand pressure, level hips, and controlled forward and backward weight shift.','exercise-task complexity context','The source does not score the exercise or classify participant proficiency age or readiness.',76),
    ('load_fatigue_recovery','https://pmc.ncbi.nlm.nih.gov/articles/PMC10824310/','Trunk Muscle Thickness During Supine and Crawling Exercises','International Journal of Exercise Science','peer_reviewed_research','Thirty-one healthy young men showed position-dependent trunk-muscle thickness changes across supine heel-off crawling-on-all-fours and bird-dog conditions.','adjacent trunk-loading context','The study did not test this task and does not quantify universal fatigue ceilings cumulative limits or recovery hours.',82),
    ('constraints','https://pubmed.ncbi.nlm.nih.gov/36117695/','Perceived exertion, postural control, and muscle recruitment in three different quadruped exercises performed by healthy women','Frontiers in Physiology','peer_reviewed_research','Quadruped postures differ in perceived effort and postural demand, and the study sample was limited to sedentary healthy women.','selection and evidence-population boundary','The study does not establish individual eligibility or replace symptom transfer support and scope checks.',86),
    ('dosage','https://www.spoonerpt.com/spooner-blog/dynamic-warm-up-for-mountain-bikers/','Dynamic Warm-Up for Mountain Bikers: Bear Crawl Rock Backs','Spooner Physical Therapy','expert_instruction','Spooner gives a context-specific warm-up example of ten to fifteen repetitions.','context-specific programming example','The example is not a universal prescription and does not validate Vortex frequency fatigue budgets recovery or population rules.',82),
    ('instructions','https://www.jtsstrength.com/7-step-low-back-warmup/','7 Step Lower Back Warmup: Bear Crawl Rock Backs','Juggernaut Training Systems','expert_instruction','The direct sequence specifies hands under shoulders, knees one inch off the ground, active palm pressure, level hips, controlled intent, forward loading, backward rocking, and ten repetitions.','direct exact-task instruction','Vortex adds fixed contacts same-start return long-arm no-knee-contact validity stop persistence and actual-duration rules.',76),
    ('safety_stop_rules','https://pubmed.ncbi.nlm.nih.gov/36117695/','Perceived exertion, postural control, and muscle recruitment in three different quadruped exercises performed by healthy women','Frontiers in Physiology','peer_reviewed_research','Quadruped tasks impose measurable palmar postural demand and trunk-muscle activity in the studied healthy sample.','support-demand and stop-rule context','Facility transfer symptom trauma neurologic cardiopulmonary incident and emergency rules remain separately required.',86),
    ('programming','https://pubmed.ncbi.nlm.nih.gov/24235984/','Are various forms of locomotion-speed diverse or unique performance quality?','Journal of Human Kinetics','peer_reviewed_research','A study of forty-two male physical-education students found quadrupedal locomotion tests were activity-specific and used travel over distance.','stationary-versus-locomotor identity boundary','The study did not test stationary rock-backs and does not validate Source-38 dosing transfer readiness or outcomes.',82),
    ('athlete_support','https://www.spoonerpt.com/spooner-blog/dynamic-warm-up-for-mountain-bikers/','Dynamic Warm-Up for Mountain Bikers: Bear Crawl Rock Backs','Spooner Physical Therapy','expert_instruction','The direct instruction provides observable hand toe knee-hover hip-start backward-shift heel-target and palm-pressure checkpoints.','plain-language participant support','The source does not establish universal sensations accessibility or symptom interpretation.',82),
    ('coach_support','https://pubmed.ncbi.nlm.nih.gov/36117695/','Perceived exertion, postural control, and muscle recruitment in three different quadruped exercises performed by healthy women','Frontiers in Physiology','peer_reviewed_research','Palmar postural demand perceived effort and trunk recruitment differ across quadruped postures.','coach observation and loading-context boundary','The study does not prescribe Vortex layout count escalation rendering or approval.',86),
    ('accessibility','https://www.jtsstrength.com/7-step-low-back-warmup/','7 Step Lower Back Warmup: Bear Crawl Rock Backs','Juggernaut Training Systems','expert_instruction','The task can be taught with concise hand knee-height palm-pressure level-hip forward backward and repetition checkpoints.','communication and task-scaling context','Changing support surface knee contact base or assistance requires another reviewed card.',76),
    ('alternates','https://pubmed.ncbi.nlm.nih.gov/24235984/','Are various forms of locomotion-speed diverse or unique performance quality?','Journal of Human Kinetics','peer_reviewed_research','Quadrupedal locomotion is activity-specific and includes movement over distance unlike a stationary return-to-start rock-back.','alternate identity-boundary context','The study does not adjudicate all Vortex alternates or approve graph edges.',82),
    ('media','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en','Embed videos and playlists','YouTube Help','manufacturer_instruction','Five candidates returned current oEmbed title channel thumbnail and iframe metadata on 2026-08-09.','candidate metadata only','oEmbed does not prove playback exact contacts hover continuity action count captions accessibility quality safety card match or approval.',82)
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
    'Current YouTube oEmbed metadata only. Playback exact fixed-contact knee-hover setup action return count captions accessibility cue quality safety reviewer identity card-version match and approval remain unverified.'
  FROM (VALUES
    ('LAZ9HYjUwvk','DNS Quadruped & Bear Rocking Exercises','REACH Rehab + Chiropractic Performance Center','Source 38 candidate checked by YouTube oEmbed'),
    ('X4eMdNmq0e8','Bear rocking exercise for more stable shoulders!','REACH Rehab + Chiropractic Performance Center','Source 38 candidate checked by YouTube oEmbed'),
    ('YJ05ptsucvY','Bear Crawl Rock Backs','Segovia Strength','Source 38 candidate checked by YouTube oEmbed'),
    ('s4MQVrvrXBU','Bear Position Rocking','E3 Rehab Exercise Library','Source 38 candidate checked by YouTube oEmbed'),
    ('b9fsav8zSm4','Bear Crawl Rock Backs','Competitive Female Training','Source 38 candidate checked by YouTube oEmbed')
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
    ('Stationary Bear Crawl Rock-Back','same_identity','The descriptive label preserves fixed palms and forefeet continuous knee hover backward shift and same-start return without steps.','source_alias',jsonb_build_array('stationary','four_fixed_contacts','continuous_knee_hover','return_cycle'),'authored_variant'),
    ('Bear Hover Rock-Back','same_identity','The short label is safe only when the exact fixed-contact hovering-knee cycle is declared.','short_alias',jsonb_build_array('same_base_contacts_action_and_count'),'merge_alias'),
    ('Bear Position Rocking','same_identity','This alias preserves the task only when knees remain hovering and one back-and-forward return is counted.','position_rocking_alias',jsonb_build_array('continuous_hover','same_return_cycle'),'merge_alias'),
    ('Comfortable Backward Range','modifier_annotation','A smaller symptom-free hip shift changes amplitude without changing support action or count.','range_annotation',jsonb_build_array('comfortable_range','same_contacts'),'delivery_annotation'),
    ('One- or Two-Inch Knee Hover','modifier_annotation','Small declared clearance differences stay within the same continuous-hover task.','hover_height_annotation',jsonb_build_array('continuous_knee_clearance'),'delivery_annotation'),
    ('Foot Stance Width','modifier_annotation','A declared comfortable toe stance adjusts the base without adding or removing contacts.','stance_annotation',jsonb_build_array('four_contacts_unchanged'),'delivery_annotation'),
    ('Controlled Tempo or Brief Endpoint Pause','modifier_annotation','Pace and a short pause alter time under tension but preserve the cycle.','tempo_pause_annotation',jsonb_build_array('tempo','pause','same_cycle'),'delivery_annotation'),
    ('Repetitions Sets or Rest','modifier_annotation','Volume and rest change dosage rather than identity.','dose_annotation',jsonb_build_array('repetitions','sets','rest'),'delivery_annotation'),
    ('Visual Hip Target','modifier_annotation','A non-contact visual marker can cue range while contacts and action remain unchanged.','visual_feedback_annotation',jsonb_build_array('visual_target','no_added_contact'),'delivery_annotation'),
    ('Breathing Prompt','modifier_annotation','Continuous-breathing or exhale cues change delivery without changing mechanics.','breathing_annotation',jsonb_build_array('breathing_prompt'),'delivery_annotation'),
    ('Padded Mat Under Hands or Feet','new_variant','A support surface changes wrist foot traction clearance hygiene and logistics and requires exact review.','padded_surface_variant',jsonb_build_array('support_surface'),'needs_human_review'),
    ('Bear Rock-Back with Knee Tap','new_variant','Deliberate or permitted knee contact changes support load fatigue count and floor-contact rules.','knee_contact_variant',jsonb_build_array('knee_contact'),'needs_human_review'),
    ('Bear Rock-Back with Elevated Hands','new_variant','A bench or box changes support height loading clearance equipment and failure consequences.','elevated_hand_variant',jsonb_build_array('elevated_hand_support'),'needs_human_review'),
    ('Bear Rock-Back with Resistance Band','new_variant','External resistance changes force direction setup load equipment-failure risk and dosage.','band_resisted_variant',jsonb_build_array('external_load'),'needs_human_review'),
    ('Bear Rock-Back with Alternating Limb Lift','new_variant','Removing a support contact changes laterality balance anti-rotation demand and count.','limb_lift_variant',jsonb_build_array('three_point_support'),'needs_human_review'),
    ('Bear Plank Hold or Bear Hover Hold','new_definition','These tasks hold a fixed bear position rather than perform a backward-and-forward cycle.','hold_distinct',jsonb_build_array('isometric_hold'),'existing_distinct_definition'),
    ('Bear Plank Shoulder Tap','new_definition','The task removes one hand at a time and taps the opposite shoulder, changing contacts laterality and count.','shoulder_tap_distinct',jsonb_build_array('alternating_three_point_support'),'existing_distinct_definition'),
    ('Slow Bear Crawl','new_definition','The task travels through space with coordinated hand and foot steps rather than fixed contacts.','locomotion_distinct',jsonb_build_array('quadrupedal_locomotion'),'existing_distinct_definition'),
    ('Bear Crawl Prep','new_definition','The preparation card has its own contract and cannot be inferred to include this exact cycle.','prep_distinct',jsonb_build_array('separate_authored_contract'),'existing_distinct_definition'),
    ('Hands-and-Knees Quadruped Rock-Back','new_definition','Knees remain supported throughout, changing contacts load fatigue accessibility and count.','knees_down_distinct',jsonb_build_array('bilateral_knee_support'),'research_queue'),
    ('Adductor Rockback','new_definition','An extended or abducted leg and knee support change laterality hip action contacts and purpose.','adductor_distinct',jsonb_build_array('unilateral_extended_leg','knee_support'),'existing_distinct_definition'),
    ('Frog Rockback','new_definition','Wide supported knees change base contacts hip position loading and purpose.','frog_distinct',jsonb_build_array('wide_knee_support'),'existing_distinct_definition'),
    ('Source 912 Bear Crawl Rock-Back','new_definition','Source 912 permits knees hovering or lightly down and omits exact start endpoint contact continuity and count, so it stays archived pending identity review.','source912_incomplete',jsonb_build_array('legacy_exercise_912','optional_knee_contact','identity_contract_incomplete'),'existing_quarantined_definition'),
    ('Clinical Wrist Shoulder or Spine Assessment in Quadruped','new_definition','Assessment adds standardized positioning measurement interpretation consent and clinical escalation.','clinical_assessment_distinct',jsonb_build_array('clinical_scope','measurement','consent'),'research_queue')
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
      'revalidate',jsonb_build_array('identity and purpose','support contacts knee rule action path and count','floor transfer equipment and space','symptoms and restrictions','dose duration and logistics','closed-chain upper-limb trunk hip knee ankle crawling plank handstand and floor-work budgets','persistence','coach rendering','athlete rendering'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'review',NULL,NULL,NULL
  FROM (VALUES
    (exact_variant,bear_hold_variant,'lateral_substitution',62,ARRAY['range','complexity','fatigue']::TEXT[],'Changes a dynamic return cycle to an isometric bear hold; use only when purpose dose and exposure are fully reselected.'),
    (exact_variant,shoulder_tap_variant,'progression',48,ARRAY['stability','complexity','fatigue']::TEXT[],'Removes one hand and adds a shoulder tap, materially increasing anti-rotation and support demands; it is not automatic.'),
    (exact_variant,slow_crawl_variant,'progression',54,ARRAY['complexity','fatigue','decision_demand']::TEXT[],'Adds coordinated locomotor hand and foot steps and travel; use only after complete reselection and logistics review.'),
    (exact_variant,crawl_prep_variant,'lateral_substitution',58,ARRAY['complexity','range','stability']::TEXT[],'Bear Crawl Prep has a separate authored contract; equivalence and direction require qualified human review before use.')
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
    CASE d.dimension WHEN 'technicalComplexity' THEN 30 ELSE 24 END,
    CASE d.dimension WHEN 'technicalComplexity' THEN 40 ELSE 20 END,
    CASE d.dimension WHEN 'technicalComplexity' THEN
      'Review-only exercise-complexity anchor based on floor transfer, four fixed contacts, continuous knee hover, long-arm support, controlled backward and forward shift, level pelvis, organized trunk, breathing, quality gates, and valid cycle count.'
    ELSE
      'Review-only physical-difficulty anchor based on bodyweight shared through both palms and forefeet with sustained knee hover, closed-chain shoulder support, trunk and pelvic stabilization, hip and knee motion, and no impact.'
    END||' This scores the exercise task, not participant proficiency.',
    'review',1,NULL,NULL,
    'Research-informed proposal only; independent comparison and qualified human approval remain required.',NULL
  FROM (VALUES('technicalComplexity'),('absoluteLoadDemand')) d(dimension)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
    proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,reviewed_by=NULL,
    review_notes=EXCLUDED.review_notes,reviewed_at=NULL,updated_at=now();

  UPDATE coaching.exercise SET
    name='Bear Crawl Rock-Back',slug='bear-crawl-rock-back',
    description='Start on both palms and forefeet with hands under shoulders, knees under hips, arms long, and both knees hovering about one to two inches. Keep all four contacts fixed, press through the palms, shift the hips backward toward the heels through comfortable range, then return forward to the same bear-hover start for one repetition without knee contact, stepping, pelvic rotation, or uncontrolled trunk motion.',
    instructions='Use the exact canonical variant on a clean stable floor. Enter the station in control, plant both palms and forefeet, place hands under shoulders and knees under hips, lengthen both arms, and hover both knees about one to two inches. Keep every contact fixed, press the floor away, shift the hips backward toward the heels only as far as control allows, then return to the same start to count one repetition. Keep breathing. Stop for pain, pinching, instability, numbness, tingling, weakness, altered circulation, dizziness, faintness, nausea, visual change, chest pain, unusual breathlessness, loss of support, unsafe floor or participant request.',
    skill_level=NULL,age_min=NULL,age_max=NULL,
    default_sets=1,default_reps=6,default_work_seconds=45,default_rest_seconds=30,
    tempo='controlled three to eight seconds per complete backward-and-forward cycle',
    load_note='Track floor surface, planned and actual complete cycles, hover height, comfortable range, tempo, pauses, contact continuity, knee clearance, arm pelvis and trunk faults, first fault, symptoms, invalid or partial attempts, hover and support time, rest, duration, substitution, exit, and overlapping wrist shoulder trunk hip knee ankle crawling plank handstand and floor-work exposure.',
    est_seconds_per_set=120,is_published=FALSE,archived=FALSE,
    card_summary='Stationary fixed-contact bear-hover cycle with both knees continuously clear, a controlled backward hip shift, and return to the same start.',
    coach_language='Verify exact floor station, controlled transfer, fixed palms and forefeet, continuous knee hover, long-arm support, comfortable range, restrictions, symptoms, planned cycles, actual hover time, first fault, duration, downstream closed-chain budget, persistence, controlled exit, and escalation.',
    athlete_language='Plant both hands and toes, hover your knees, press the floor away, shift your hips back only as far as you can control, and return to the same start. Stop for pain, tingling, weakness, dizziness, instability, or loss of support.',
    programming_logic=jsonb_build_object(
      'selectionStatus','canonical_variant_required','selectable',TRUE,
      'canonicalDefinitionId',canonical_definition,'exactVariantIds',to_jsonb(active_variant_ids),
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'exerciseDifficultyDescribesTaskOnly',TRUE,
      'selectionInputs',jsonb_build_array('workout purpose','safe floor transfer station and exit','palm forefoot wrist shoulder trunk hip knee and ankle tolerance','continuous knee hover and exact count comprehension','cycle dose pace range rest and duration','cumulative closed-chain upper-limb trunk lower-limb crawling plank handstand and floor-work exposure','coach scope and sightline'),
      'substitutionRevalidation',jsonb_build_array('identity','support contacts knee rule action path and count','floor surface transfer equipment and space','restrictions and symptoms','purpose','dose','fatigue and impact budgets','duration','logistics','persistence','coach rendering','athlete rendering'),
      'source912Status','archived_needs_human_identity_review',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    scalable_variables=ARRAY['comfortable_range','knee_hover_height','foot_stance','tempo','endpoint_pause','breathing_prompt','complete_cycles','rest_seconds','sets','visual_hip_target']::TEXT[],
    movement_family='Stationary Bear Hover Rock-Back',primary_phase_key=NULL,
    phase_subrole=NULL,primary_order_slot=NULL,
    movement_requirements=jsonb_build_object(
      'selectable',TRUE,'canonicalVariantRequired',TRUE,'impactLevel',0,
      'balanceDemand','four_point_floor_support','breathingDemand','continuous_no_breath_hold',
      'actions',jsonb_build_array('closed_chain_upper_limb_support','controlled_backward_hip_shift','controlled_forward_return','trunk_and_pelvic_stabilization'),
      'planes',jsonb_build_array('sagittal','multiplanar_stabilization'),
      'mustMaintain',jsonb_build_array('both_palms_fixed','both_forefeet_fixed','continuous_knee_hover','long_arms','active_palm_pressure','level_pelvis','organized_trunk','comfortable_range','same_start_return','communication'),
      'mustNotAdd',jsonb_build_array('knee_contact','hand_or_foot_step','limb_lift','rotation_or_circle','external_load','hold_only_execution','changed_support_height','forced_range','uncontrolled_exit'),
      'validCompletion','one_controlled_backward_shift_and_forward_return_to_same_start_with_fixed_palms_and_forefeet_continuous_knee_clearance_long_arms_level_pelvis_organized_trunk_and_no_stop_rule'),
    coaching_execution=jsonb_build_object(
      'qualityGates',jsonb_build_array('variant_and_floor_station_exact','controlled_entry_and_exit','palm_and_forefoot_support_tolerated','count_understood','four_contacts_fixed','knees_hover_continuously','arms_long_and_palms_active','pelvis_level_and_trunk_organized','comfortable_range_and_same_start_return','no_stop_symptoms'),
      'stopRules',jsonb_build_array('sharp_increasing_night_post_trauma_or_unfamiliar_pain','support_joint_pain_pinching_catching_instability_or_collapse','neurologic_or_circulation_change','dizziness_faintness_nausea_visual_change_chest_pain_unusual_breathlessness_or_disorientation','unsafe_floor_transfer_or_exit','knee_contact_step_elbow_bend_or_shoulder_collapse','pelvic_rotation_or_uncontrolled_trunk_change','wrong_task_forced_range_or_breath_hold','unsafe_floor_space_sightline_or_emergency_route','budget_or_duration_reached'),
      'persistence',jsonb_build_array('definition_and_variant','floor_surface_and_station','planned_and_actual_complete_cycles','hover_height_range_tempo_pause_and_rest','valid_invalid_partial_and_symptom_limited_attempts','contacts_knee_clearance_arm_pelvis_trunk_breathing_and_first_fault','symptoms_and_stop_reason','hover_and_support_seconds','duration','substitution','station_reset_and_exit')),
    pairing_logic=jsonb_build_object(
      'sameSessionBudget',jsonb_build_array('complete_rock_back_cycles','hover_and_support_seconds','closed_chain_upper_limb_load','wrist_extension_support','trunk_and_pelvic_stabilization','hip_knee_ankle_and_forefoot_support','technical_fatigue','downstream_crawling_plank_push_handstand_climb_hang_and_floor_work','impact'),
      'avoidAutomaticPairingWith',jsonb_build_array('fatiguing_wrist_or_closed_chain_work_before_priority_handstand_push_or_crawl_skill','symptom_provoking_floor_support','same_session_support_or_floor_work_exceeding_budget'),
      'revalidateAfterSubstitution',TRUE),
    media_library=jsonb_build_object(
      'candidate_video_ids',jsonb_build_array('LAZ9HYjUwvk','X4eMdNmq0e8','YJ05ptsucvY','s4MQVrvrXBU','b9fsav8zSm4'),
      'reviewState','oembed_metadata_only_candidate_quarantine',
      'playbackExactnessContactsHoverActionReturnCountCaptionsAccessibilityQualitySafetyAndApprovalVerified',FALSE,
      'humanReviewRequired',TRUE),
    participant_structure='individual',programming_kind='exercise',linked_skill_id=NULL,
    why_publish_ready=FALSE,updated_at=now()
  WHERE id=38;

  UPDATE coaching.exercise SET
    skill_level=NULL,age_min=NULL,age_max=NULL,is_published=FALSE,archived=TRUE,
    programming_logic=coalesce(programming_logic,'{}'::JSONB)||jsonb_build_object(
      'selectionStatus','identity_quarantine','selectable',FALSE,
      'canonicalDefinitionId',source912_definition,
      'identityBoundary','optional_knee_contact_and_incomplete_identity_contract',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    linked_skill_id=NULL,why_publish_ready=FALSE,updated_at=now()
  WHERE id=912;

  UPDATE coaching.exercise_safety_profile SET
    risk_level=2,impact_level=0,minimum_age_recommended=NULL,
    minimum_skill_level=NULL,requires_spotting=FALSE,
    requires_coach_supervision='recommended',
    minimum_prerequisite_notes='Readiness uses safe floor transfer and exit, comfortable palm and forefoot support, continuous knee hover, long-arm shoulder support, exact fixed-contact cycle comprehension, current symptoms, communication, workout dose, and downstream closed-chain loading; never participant proficiency or age.',
    readiness_checks=ARRAY[
      'Confirm exact variant, clean stable nonslip floor, backward-shift clearance, controlled entry and exit, sightline, communication, and emergency route.',
      'Confirm palm wrist elbow shoulder neck back hip knee ankle and forefoot tolerance and no current symptom or restriction conflict.',
      'Confirm the participant understands four fixed contacts, continuous knee hover, long arms, backward-and-forward return count, smaller range, stop signal, and controlled exit.',
      'Review cumulative cycles, hover and support time, wrist shoulder trunk lower-limb technical fatigue, and later crawling plank push handstand climbing hanging or floor-work demand.'
    ]::TEXT[],
    stop_signs=ARRAY[
      'Sharp, increasing, night, post-trauma, or unfamiliar pain, guarding, or participant stop request.',
      'Wrist, hand, elbow, shoulder, neck, back, hip, knee, ankle, or foot symptoms prevent exact support.',
      'Pinching, catching, painful clicking, instability, uncontrolled collapse, or inability to exit safely.',
      'Numbness, tingling, weakness, altered circulation, loss of control, or another neurologic sign.',
      'Dizziness, faintness, nausea, visual change, chest pain, unusual breathlessness, disorientation, or inability to communicate.',
      'A knee touches, a hand or foot steps, elbows bend, shoulders collapse, or exact contacts cannot be restored safely.',
      'Pelvis rotates or the trunk sags, arches, twists, or shifts laterally despite reduced range, cycles, or pace.',
      'Floor, equipment, space, traffic, hygiene, sightline, communication, duration, budget, or emergency route becomes inadequate.'
    ]::TEXT[],
    contraindications=ARRAY[
      'Current symptoms, trauma, procedure, instability, or clinical restrictions conflict with loaded floor support, knee hover, or floor transfer.',
      'No clean stable floor station, controlled entry and exit, full clearance, sightline, communication, or emergency route.',
      'The intended service is diagnosis, treatment, injury management, readiness clearance, manual assistance, locomotion, a hold, a shoulder tap, or another exercise identity.'
    ]::TEXT[],
    common_substitutions=ARRAY[
      'Use Bear Plank Hold only when a static task fits and all duration and exposure checks are rerun.',
      'Use Bear Plank Shoulder Tap or Slow Bear Crawl only when the changed contacts or locomotion fit and all checks are rerun.',
      'Do not use Source 912 automatically while optional knee contact and its incomplete contract remain under identity review.',
      'Author and review knees-down, elevated-hand, padded-support, loaded, or limb-lift alternatives before selection.'
    ]::TEXT[]
  WHERE exercise_id=38;

  UPDATE coaching.exercise_score_v1 SET
    technical_complexity=30,absolute_load_demand=24,coordination_demand=30,
    impact=1,supervision_demand=20,base_overall_difficulty=greatest(30,24),
    legacy_scores=coalesce(legacy_scores,'{}'::JSONB)||jsonb_build_object(
      'candidateReassessment',migration_key,
      'projectionScope','stationary_fixed_contact_continuous_knee_hover_bear_rock_back_exact_variant',
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'variantScores',jsonb_build_object('stationaryBearHoverRockBack',
        jsonb_build_object('complexity',30,'physicalDifficulty',24,'overall',30)),
      'exerciseScoresDescribeTaskOnly',TRUE,'independentCalibrationRequired',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    migration_confidence=60,human_review_status='queued',reviewed_by=NULL,reviewed_at=NULL,
    review_notes='Research-informed candidate reassessment only. Scores describe exercise complexity and physical difficulty, not participant proficiency, age, readiness, or skill. Exact mechanics floor support and independent calibration remain required.',
    updated_at=now()
  WHERE exercise_id=38;

  UPDATE coaching.exercise_difficulty_profile SET
    technical=3.0,complexity=3.0,load=2.4,overall=3.0,
    recommended_age_min=NULL,recommended_age_max=NULL,attention_demand='moderate',
    notes='Candidate projection from the exact stationary fixed-contact continuous-knee-hover Bear Crawl Rock-Back variant. Complexity is 30/100, physical difficulty 24/100, and overall 30/100 by maximum. This is not participant proficiency, readiness, age, or skill classification.',
    source='canonical_research_candidate',updated_at=now()
  WHERE exercise_id=38;

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  VALUES(canonical_definition,1,2,'2.0.0',migration_key,'quarantined',
    jsonb_build_object(
      'identity',jsonb_build_object('passed',TRUE,'identityKey','stationary_fixed_palms_and_forefeet_continuous_knee_hover_backward_and_forward_return_cycle','legacySources',1,'activeVariants',1,'archivedSourceSkeleton',TRUE,'source912RestoredToOwnArchivedDefinition',TRUE,'source912NeedsHumanReview',TRUE,'neighborBoundaries',4),
      'taxonomy',jsonb_build_object('passed',TRUE,'controlledTerms',TRUE,'movementPatterns',jsonb_build_array('brace','push','squat'),'bodyRegions',jsonb_build_array('hand','wrist','elbow','shoulder','scapula','core','spine','hip','knee','ankle','foot'),'equipment',jsonb_build_array('none','mat_optional')),
      'anatomy',jsonb_build_object('passed',TRUE,'musclesJointsActionsPlanesLateralityContactsSequenceAndTrunkBoundary',TRUE),
      'difficulty',jsonb_build_object('passed',TRUE,'model','max_exercise_complexity_physical_difficulty','variantVectors',jsonb_build_array('30/24/30'),'participantClassificationAbsent',TRUE,'independentCalibrationRequired',TRUE),
      'loadFatigueRecovery',jsonb_build_object('passed',TRUE,'actualCyclesHoverSupportRangeFaultSymptomsAndOverlappingClosedChainExposureTracked',TRUE,'impactNone',TRUE,'recoveryIsPlanningEstimate',TRUE),
      'constraints',jsonb_build_object('passed',TRUE,'floorTransferContactsSupportSymptomsRestrictionsSpaceTrafficScopeAndEmergencyRoute',TRUE),
      'delivery',jsonb_build_object('passed',TRUE,'profiles',2,'prepareAndMovementIntelligence',TRUE,'durationDoseRestStationExitAndSubstitutionRevalidation',TRUE),
      'instructions',jsonb_build_object('passed',TRUE,'athleteCoachAccessibilityAndSupportOperations',TRUE,'contactsHoverPathReturnSymptomsFloorTransferAndClinicalScope',TRUE),
      'research',jsonb_build_object('passed',TRUE,'sections',16,'registryVersion',research_version,'directAndAdjacentEvidenceSeparated',TRUE,'exampleDoseNotUniversal',TRUE),
      'media',jsonb_build_object('passed',FALSE,'candidateCount',5,'currentOEmbedMetadataHealthy',TRUE,'playbackReviewed',FALSE,'exactVariantReviewed',FALSE,'captionsAccessibilityQualitySafetyAndApprovalReviewed',FALSE),
      'relationships',jsonb_build_object('passed',FALSE,'reviewOnly',4,'approved',0,'automaticSubstitution',FALSE),
      'calibration',jsonb_build_object('passed',FALSE,'reviewOnly',2,'approved',0),
      'alternates',jsonb_build_object('passed',TRUE,'assessments',24,'sameIdentity',3,'modifierAnnotations',7,'newVariants',5,'newDefinitions',9,'singleExactVariant',TRUE),
      'generationSupport',jsonb_build_object('passed',TRUE,'selectionConstraints',TRUE,'cumulativeFatigueAndImpactBudgets',TRUE,'duration',TRUE,'floorStationAndTransfer',TRUE,'substitutionRevalidation',TRUE,'renderingAndPersistence',TRUE),
      'publication',jsonb_build_object('passed',FALSE,'reviewer',NULL,'approver',NULL)),
    jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01','message','A qualified human must watch all five candidates in full and verify playback, exact fixed contacts, continuous knee hover, start, path, return count, range, captions, accessibility, cue quality, safety, conflicts, reviewer identity, timestamp, card version, and approval rationale.'),
      jsonb_build_object('code','CARD-IDENTITY-02','message','A qualified human must adjudicate Source 912. Optional knee contact and missing start, endpoint, contact-continuity, and count rules prevent exact duplicate or distinct-exercise approval.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','A qualified coach must approve or reject all four relationships; no automatic substitution to hold, shoulder-tap, crawl, prep, knees-down, or other tasks is authorized.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','An independent qualified reviewer must calibrate exercise complexity 30 and physical difficulty 24. Scores do not classify a participant or create an age, proficiency, readiness, or skill level.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','A qualified reviewer and separate approver must complete content review before publication. Identity, anatomy, loading, floor transfer, support tolerance, clinical scope, dose, stop, accessibility, persistence, and support rules remain quarantined.')),
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
        AND movement_patterns=ARRAY['brace','push','squat']::TEXT[]
        AND anatomy_json<>'{}'::JSONB AND environment_json<>'{}'::JSONB
        AND population_json<>'{}'::JSONB AND athlete_support_json<>'{}'::JSONB
        AND coach_support_json<>'{}'::JSONB AND support_operations_json<>'{}'::JSONB
        AND provenance_json->>'approvalsCreated'='false')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=source912_definition AND status='archived'
        AND provenance_json->>'identityStatus'='needs_human_review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=912 AND definition_id=source912_definition
        AND source_kind='legacy_migration'
        AND provenance_json->>'approvalsCreated'='false')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source38_variant AND status='archived'
        AND requirements_json->>'representation'='superseded_source_skeleton')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source912_variant AND definition_id=source912_definition AND status='archived'
        AND requirements_json->>'representation'='ambiguous_source_identity')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=exact_variant AND definition_id=canonical_definition AND status='review'
        AND requirements_json->>'selectable'='true'
        AND (difficulty_json->>'technicalComplexity')::INTEGER=30
        AND (difficulty_json->>'physicalDifficulty')::INTEGER=24
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=greatest(30,24)
        AND (load_profile_json->>'landingContactsPerRep')::INTEGER=0
        AND (fatigue_profile_json->>'impactAccumulation')::INTEGER=1
        AND programming_profile_json->>'publicationQuarantined'='true') THEN
    RAISE EXCEPTION '% definition variant source restoration or quarantine assertion failed',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=exact_variant AND status='review'
        AND cardinality(equipment_required)>0
        AND coalesce(time_model_json->>'durationFormula','')<>''
        AND dose_scaling_json<>'{}'::JSONB AND measurement_json<>'{}'::JSONB
        AND support_prompts_json<>'{}'::JSONB AND length(coach_instructions)>=100
        AND length(athlete_instructions) BETWEEN 10 AND 300
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
      WHERE survivor_definition_id=canonical_definition AND decision='distinct_exercises'
        AND reviewed_by IS NULL)<>4
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=canonical_definition AND decision='needs_human_review'
        AND resolved_definition_id=source912_definition AND reviewed_by IS NULL)<>1 THEN
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

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=38
      AND skill_level IS NULL AND age_min IS NULL AND age_max IS NULL
      AND linked_skill_id IS NULL AND is_published=FALSE AND archived=FALSE
      AND programming_kind='exercise' AND why_publish_ready=FALSE)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=912
      AND skill_level IS NULL AND age_min IS NULL AND age_max IS NULL
      AND linked_skill_id IS NULL AND is_published=FALSE AND archived=TRUE
      AND why_publish_ready=FALSE)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1
      WHERE exercise_id=38 AND technical_complexity=30
        AND absolute_load_demand=24 AND base_overall_difficulty=30
        AND human_review_status='queued' AND reviewed_by IS NULL AND reviewed_at IS NULL)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=canonical_definition AND card_version=2
        AND status='quarantined' AND human_review_required=TRUE
        AND jsonb_array_length(blocking_issues_json)=5) THEN
    RAISE EXCEPTION '% legacy projection or packet assertion failed',migration_key;
  END IF;
END
$migration$;
