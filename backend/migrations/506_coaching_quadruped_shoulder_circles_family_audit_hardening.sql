-- Source 34: replace the skeletal Quadruped Shoulder Circles baseline with one
-- exact fixed-contact bilateral scapular-circle variant. All evidence, media,
-- graph, calibration, content, and publication authority remains human-only.
DO $migration$
DECLARE
  migration_key CONSTANT TEXT := '506_coaching_quadruped_shoulder_circles_family_audit_hardening';
  research_version CONSTANT TEXT := '2026-08-09.101';
  canonical_definition UUID;
  source_variant UUID;
  circle_variant UUID;
  active_variant_ids UUID[];
  all_owned_variant_ids UUID[];
  scapular_push_up_definition UUID;
  scapular_push_up_variant UUID;
  spinal_circle_definition UUID;
  spinal_circle_variant UUID;
  arm_circle_definition UUID;
  arm_circle_variant UUID;
  scapular_clock_definition UUID;
  scapular_clock_variant UUID;
  protected_count INTEGER;
BEGIN
  SELECT definition_id INTO canonical_definition FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=34;
  SELECT id INTO source_variant FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='baseline';
  SELECT id INTO circle_variant FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='fixed-contact-bilateral-scapular-circle';
  circle_variant := coalesce(circle_variant,gen_random_uuid());
  SELECT definition_id INTO scapular_push_up_definition FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=33;
  SELECT id INTO scapular_push_up_variant FROM coaching.exercise_variant_v1 WHERE definition_id=scapular_push_up_definition AND variant_key='quadruped-straight-arm-retraction-protraction-cycle';
  SELECT definition_id INTO spinal_circle_definition FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=26;
  SELECT id INTO spinal_circle_variant FROM coaching.exercise_variant_v1 WHERE definition_id=spinal_circle_definition AND variant_key='fixed-contact-global-spinal-circle';
  SELECT definition_id INTO arm_circle_definition FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=37;
  SELECT id INTO arm_circle_variant FROM coaching.exercise_variant_v1 WHERE definition_id=arm_circle_definition AND variant_key='baseline';
  SELECT definition_id INTO scapular_clock_definition FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=1311;
  SELECT id INTO scapular_clock_variant FROM coaching.exercise_variant_v1 WHERE definition_id=scapular_clock_definition AND variant_key='baseline';
  active_variant_ids := ARRAY[circle_variant];
  all_owned_variant_ids := ARRAY[source_variant,circle_variant];

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=34 AND facility_id=1)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition AND facility_id=1 AND legacy_exercise_id=34)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=34 AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source_variant AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=scapular_push_up_variant AND definition_id=scapular_push_up_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=spinal_circle_variant AND definition_id=spinal_circle_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=arm_circle_variant AND definition_id=arm_circle_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=scapular_clock_variant AND definition_id=scapular_clock_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1 WHERE exercise_id=34)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_difficulty_profile WHERE exercise_id=34)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_safety_profile WHERE exercise_id=34) THEN
    RAISE EXCEPTION '% prerequisite source or neighbor rows are missing',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=circle_variant AND definition_id<>canonical_definition)
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE slug='quadruped-shoulder-circles' AND id<>canonical_definition) THEN
    RAISE EXCEPTION '% working UUID or slug already belongs to another card',migration_key;
  END IF;

  SELECT coalesce(sum(n),0) INTO protected_count FROM (
    SELECT count(*) n FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition AND (status IN('published','deprecated')
        OR reviewed_by IS NOT NULL OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)
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
      WHERE (from_variant_id=ANY(all_owned_variant_ids)
          OR to_variant_id=ANY(all_owned_variant_ids))
        AND (reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL OR review_status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(all_owned_variant_ids)
        AND (reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL OR status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE (survivor_definition_id=canonical_definition OR resolved_definition_id=canonical_definition)
        AND (reviewed_by IS NOT NULL OR resolution_source='human_review')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_v1
      WHERE exercise_id=34
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
        'sourceDisposition','canonical_fixed_contact_bilateral_scapular_circle_reauthored',
        'representedBySelectableSourceVariant',FALSE,
        'sourceInterpretation','source 34 supplies the bilateral quadruped circle concept but omits an exact checkpoint count anatomy load fatigue constraint duration substitution persistence support and review contract',
        'exactWorkingSpecification','bilateral_fixed_hand_and_knee_continuous_scapular_circle',
        'researchSources',jsonb_build_array(
          'https://gmb.io/shoulder-mobility/',
          'https://www.rehabhero.ca/exercise/quadruped-scapular-circles',
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC9937811/',
          'https://www.sciencedirect.com/science/article/pii/S0021929016306832',
          'https://pubmed.ncbi.nlm.nih.gov/36000960/',
          'https://pubmed.ncbi.nlm.nih.gov/25881172/',
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC12734928/',
          'https://static.usagym.org/PDFs/about/wellness/exercise/wrist.pdf',
          'https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en'),
        'exerciseDifficultyDescribesTaskOnly',TRUE,
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=34 AND definition_id=canonical_definition;

  UPDATE coaching.exercise_delivery_profile_v1 SET status='archived',updated_at=now()
  WHERE variant_id=source_variant;
  UPDATE coaching.exercise_variant_v1 SET
    variant_key='identity-quarantine-source-34',
    display_name='Quadruped Shoulder Circles Legacy Skeleton — Source 34',
    modifier_keys='{}'::TEXT[],difficulty_json='{}'::JSONB,status='archived',
    requirements_json=jsonb_build_object(
      'selectable',FALSE,'representation','superseded_source_skeleton',
      'sourceLegacyExerciseId',34,
      'archiveReason','exact checkpoints count anatomy loading budgets duration constraints substitutions persistence and support were missing',
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
    canonical_definition,1,34,'quadruped-shoulder-circles',
    'Quadruped Shoulder Circles','Quadruped Shoulder Circles',
    ARRAY['Quadruped Scapular Circles','Quadruped Scapula Circles','Quadruped Scapular CARs'],
    'From a bilateral hands-and-knees base, keep both contacts fixed and elbows extended without forced lockout. Begin at a comfortably pushed-away scapular checkpoint. Move the shoulders through the declared first vertical direction, controlled retraction, the opposite vertical direction, and back to the same protracted checkpoint. That complete four-checkpoint loop is one repetition; reverse by changing the first vertical direction. Keep the trunk comparatively quiet and allow only the small body shift needed for the scapulae to glide. Direction, comfortable range, tempo, brief checkpoint pauses, repetitions, sets, rest, and stable knee cushioning are annotations. Changing support height, base, laterality, path, moving region, external force, stability, clinical scope, or count changes the task.',
    'quadruped_scapular_circle','2.0.0',2,'review',82,60,50,
    ARRAY['brace','push','rotate']::TEXT[],
    ARRAY['hand','wrist','elbow','shoulder','scapula','core','spine','hip','knee']::TEXT[],
    ARRAY['none']::TEXT[],ARRAY['mat_optional']::TEXT[],
    jsonb_build_object(
      'surface','flat dry stable nonslip floor supporting bilateral hands and knees',
      'space','one stationary quadruped station with head trunk elbow hip and foot clearance and no cross traffic',
      'stationCapacity',1,'optionalEquipmentKey','mat_optional',
      'matPolicy','stable knee cushioning may improve comfort but cannot hide unstable or painful support',
      'coachSightline','front and side views sufficient for contacts elbows scapular checkpoints trunk shift breathing symptoms and direction',
      'inspection',jsonb_build_array('floor traction cleanliness and clutter','mat flatness and movement when used','hand and knee contact area','head trunk elbow hip and foot clearance','cross traffic','communication and emergency route','safe floor entry and exit'),
      'changeRule','Any support path laterality force stability scope dose symptom surface or downstream-demand change requires full revalidation.'),
    jsonb_build_object(
      'exerciseCardDoesNotClassifyParticipants',TRUE,'readinessIsWorkoutInput',TRUE,
      'selectionPrerequisites',jsonb_build_array('safe floor entry four-point support and exit','comfortable wrist elbow shoulder scapular trunk hip and knee support','understands exact checkpoints direction reversal count and stop signal','can keep elbows extended and trunk comparatively quiet','same-session support and shoulder budgets fit'),
      'excludeOrEscalate',jsonb_build_array('recent significant trauma or surgery without applicable clearance','worsening night or post-trauma pain','new numbness tingling weakness or pins and needles','shoulder pinching painful clicking instability or support collapse','wrist hand elbow knee or floor-transfer symptoms preventing exact support','dizziness faintness nausea visual change or inability to communicate','clinical restriction conflicting with quadruped or multidirectional scapular motion','participant requests stop'),
      'notEstablishedByEvidence',jsonb_build_array('universal eligibility or normal range','injury prevention treatment structural correction or readiness','isolated muscle activation','one universal hand width trunk position circle shape dose frequency or recovery','performance transfer')),
    jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'canonicalAuthoredFromResearch',TRUE,
      'primaryIdentitySource','https://gmb.io/shoulder-mobility/',
      'legacySources',jsonb_build_array(34),
      'identityContract','bilateral_fixed_hands_and_knees_extended_elbows_four_checkpoint_continuous_scapular_circle_both_directions',
      'researchSources',jsonb_build_array(
        'https://gmb.io/shoulder-mobility/',
        'https://www.rehabhero.ca/exercise/quadruped-scapular-circles',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC9937811/',
        'https://www.sciencedirect.com/science/article/pii/S0021929016306832',
        'https://pubmed.ncbi.nlm.nih.gov/36000960/',
        'https://pubmed.ncbi.nlm.nih.gov/25881172/',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC12734928/',
        'https://static.usagym.org/PDFs/about/wellness/exercise/wrist.pdf',
        'https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en'),
      'confidenceBySection',jsonb_build_object('identity',82,'taxonomy',80,'anatomy',72,'difficulty',60,'load',62,'fatigueRecovery',54,'constraints',80,'dosage',64,'instructions',82,'alternates',84,'media',50),
      'unresolvedClaims',jsonb_build_array('one universal circle shape range trunk allowance dose frequency recovery or progression','injury prevention diagnosis treatment correction readiness or performance outcome','numeric difficulty calibration','media playback exactness captions accessibility quality safety and approval','Source 1311 exact Scapular Clock mechanics'),
      'externalPlaybackVerificationPerformed',FALSE,'sourceLimitationsExplicit',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,'publicationQuarantined',TRUE),
    NULL,NULL,NULL,NULL,
    jsonb_build_object(
      'primaryMuscles',jsonb_build_array('serratus_anterior','upper_trapezius','middle_trapezius','lower_trapezius','rhomboid_major_and_minor'),
      'secondaryMuscles',jsonb_build_array('levator_scapulae','pectoralis_minor','triceps_brachii','rotator_cuff','rectus_abdominis','internal_and_external_obliques'),
      'stabilizers',jsonb_build_array('forearm_wrist_flexors_and_extensors','elbow_extensors','glenohumeral_stabilizers','deep_trunk_stabilizers','hip_stabilizers','quadriceps'),
      'joints',jsonb_build_array('scapulothoracic_articulation','sternoclavicular_joint','acromioclavicular_joint','glenohumeral_joint','elbow_joint','radiocarpal_wrist','thoracic_intervertebral_joints','lumbar_intervertebral_joints','hip_joint','knee_joint'),
      'jointActions',jsonb_build_array('scapular_protraction','scapular_elevation','scapular_retraction','scapular_depression','coupled_scapular_upward_and_downward_rotation','elbow_extension_isometric','wrist_extension_support','glenohumeral_stabilization','trunk_and_pelvic_stabilization'),
      'planes',jsonb_build_array('transverse','frontal','coupled_multiplanar_transition'),
      'laterality','bilateral fixed support; complete circles are recorded separately by declared first vertical direction',
      'supportContacts',jsonb_build_array('left_hand','right_hand','left_knee_and_shin','right_knee_and_shin'),
      'contactRule','Both hands and both knees remain planted throughout every counted circle.',
      'phaseSequence',jsonb_build_array('protracted_start_checkpoint','declared_first_vertical_checkpoint','retracted_checkpoint','opposite_vertical_checkpoint','return_to_protracted_counted_checkpoint','reverse_first_vertical_direction'),
      'trunkBoundary','Small controlled support shifts may accompany scapular glide; a global spinal circle is a distinct exercise.',
      'evidenceBoundary','Sources support bilateral quadruped multidirectional scapular circles in both directions, not exact force isolated activation normal range treatment effect or one universal shape.'),
    jsonb_build_object(
      'whyItMatters','Provides a reproducible low-load multidirectional scapular-control task under fixed hand support when the workout calls for a continuous circle rather than a two-direction push-up or global spinal circle.',
      'primaryCue','Hands and knees stay down, arms stay long, and your shoulder blades trace all four checkpoints before returning to the start.',
      'expectedSensations',jsonb_build_array('light hand wrist shoulder and trunk support effort','smooth shoulder-blade glide around the rib cage','small controlled weight shifts','comfortable effort without forced range'),
      'unexpectedSensations',jsonb_build_array('sharp increasing night or post-trauma pain','pinching painful clicking instability or support collapse','numbness tingling weakness pins and needles or altered circulation','dizziness faintness nausea visual change or disorientation','painful wrist hand elbow knee or floor transfer','forced range breath holding or loss of control'),
      'painGuidance','Stop in the safest stable position, signal the coach, and follow facility escalation policy; do not repeat the circle to test symptoms.',
      'selfChecks',jsonb_build_array('both hands and knees stay down','elbows remain extended without forced lockout','all four scapular checkpoints are observable','trunk remains comparatively quiet','one full return counts one circle','both directions are recorded separately','breathing remains continuous'),
      'accessibility',jsonb_build_array('front and side demonstration','written four-checkpoint sequence','declared elevation-first or depression-first language','optional stable knee cushioning','smaller range fewer circles slower pace and more rest','separately validated wall raised or non-floor task when needed'),
      'mediaAlternatives',jsonb_build_array('written checkpoint strip','front and side coach demonstration','still images for protracted elevated retracted and depressed checkpoints','auditory direction and count prompts'),
      'notReadinessOrClinicalClassification',TRUE),
    jsonb_build_object(
      'observationChecklist',jsonb_build_array('exact variant station and floor transfer','four fixed contacts','extended elbows','declared first vertical direction and reverse','protracted vertical retracted opposite-vertical and counted protracted checkpoints','scapular glide versus global spinal circle','range pace breathing symptoms first fault and actual duration'),
      'faultCorrections',jsonb_build_object(
        'elbows_bend','reduce circle range and support pressure; do not count until straight-arm control returns',
        'contact_lost','stop the repetition and re-establish the exact base; changed support is another task',
        'global_spinal_circle','reduce range and cue shoulder-blade glide with a comparatively quiet trunk',
        'incomplete_or_linear_path','slow down and restore every checkpoint; partial paths do not count',
        'shrug_or_neck_substitution','reduce range and distinguish elevation from uncontrolled neck tension',
        'forced_range_or_breath_hold','reduce range pace or dose; stop if it cannot be corrected comfortably',
        'symptom','stop and follow escalation policy without diagnosis'),
      'demonstrationPlan',jsonb_build_array('name exact base and count','show front and side views','show one elevation-first and one depression-first circle','show incomplete path elbow bend and spinal-circle nonexamples','state symptoms and stop signal'),
      'groupManagement',jsonb_build_array('one participant per clear station','separate direction cues by athlete perspective','preserve front and side sightlines','prevent cross traffic','track actual circles support time faults symptoms and rest','do not advance multiple stations while a symptom is unresolved'),
      'modificationDecisionTree',jsonb_build_array('reduce comfortable range','reduce repetitions','slow tempo','increase rest','add stable knee cushioning','stop and choose a separately reviewed support-changing card after full revalidation'),
      'doNotUseWhen',jsonb_build_array('exact four-point support or floor transfer is unsafe','current symptoms or restrictions conflict','support path or count cannot be understood','surface space sightline communication or exit is inadequate','clinical assessment or treatment is intended'),
      'clinicalScope','Observe report record stop and escalate; do not diagnose scapular dyskinesis prescribe treatment clear injury or promise correction.'),
    jsonb_build_object(
      'issueCategories',jsonb_build_array('identity_or_variant','media','content_or_cue','symptom_or_incident','accessibility','equipment_or_floor','dose_or_duration','substitution','persistence_or_rendering','privacy_or_data'),
      'supportEscalation',jsonb_build_object('urgent','follow facility emergency policy for trauma neurologic circulation cardiopulmonary altered-consciousness or other emergency signs','clinical','refer diagnosis treatment clearance persistent night or post-trauma symptoms and recurrent instability to qualified care','content','route identity anatomy media dose difficulty and graph disputes to qualified reviewers','technical','preserve request workout variant and logs while escalating deterministic generation or persistence failures'),
      'retentionPolicy','Persist selected definition variant profile direction planned and actual circles support seconds range tempo rest faults symptoms stops substitutions duration station and renderer version under facility privacy policy.',
      'changeImpactPolicy','A change to contacts path count support height laterality loading stability constraints dose duration media graph difficulty or instructions invalidates dependent generation review and rendering assumptions until revalidated.',
      'feedbackFields',jsonb_build_array('request_id','workout_id','definition_id','variant_id','profile_key','direction','planned_and_actual_dose','first_fault','symptoms','stop_reason','substitution','duration','coach_edit','athlete_comprehension','media_issue','incident_id'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
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
    circle_variant,canonical_definition,'fixed-contact-bilateral-scapular-circle',
    'Quadruped Shoulder Circles — Fixed-Contact Bilateral Scapular Circle',
    ARRAY['direction','comfortable_range','tempo','checkpoint_pause','repetitions','sets','rest','stable_knee_cushioning']::TEXT[],
    jsonb_build_object(
      'technicalComplexity',30,'absoluteLoadDemand',18,'physicalDifficulty',18,
      'coordinationDemand',30,'supervisionDemand',18,'failureConsequence',16,
      'impact',1,'workCapacityDemand',12,'baseOverallDifficulty',greatest(30,18),
      'overallFormula','max(exercise_complexity,physical_difficulty)',
      'exerciseDifficultyDescribesTaskOnly',TRUE,'independentCalibrationRequired',TRUE),
    jsonb_build_object(
      'selectable',TRUE,'equipment',jsonb_build_array('none'),
      'optionalEquipment',jsonb_build_array('mat_optional'),
      'supportBase','bilateral_hands_and_knees_fixed',
      'elbowRule','extended_without_forced_lockout',
      'exactSequence',jsonb_build_array('protracted_start','declared_first_vertical','retracted','opposite_vertical','return_to_protracted'),
      'directionRule','record_elevation_first_and_depression_first_separately',
      'countingRule','one_complete_return_to_protracted_after_every_checkpoint',
      'validCompletion','four contacts remain fixed elbows remain extended every checkpoint is observable trunk is comparatively quiet range and pace are controlled breathing continues and no stop rule occurs',
      'invalidCompletion',jsonb_build_array('hand_or_knee_contact_lost','elbow_flexion','checkpoint_missing','linear_or_incomplete_path','global_spinal_circle','forced_range','breath_hold','symptom_stop'),
      'clinicalAssessmentOrTreatment',FALSE,'humanReviewRequired',TRUE),
    'review',
    jsonb_build_object(
      'loadingType','bodyweight_closed_chain_quadruped_multidirectional_scapular_motion',
      'externalLoadMethod','partial_bodyweight_bilateral_hand_and_knee_support',
      'gripDemand',5,'jointStress',18,'spinalLoading',8,'eccentricStress',8,
      'landingContactsPerRep',0,'handImpactContactsPerRep',0,'impactClass','none',
      'primaryExposure',jsonb_build_array('multidirectional_scapular_motion','wrist_extension_support','straight_elbow_support','shoulder_girdle_support','trunk_and_hip_stabilization'),
      'tracking',jsonb_build_array('variant','first_vertical_direction','complete_circles','range','tempo','pauses','contacts','support_seconds','symptoms','duration','same_session_upper_limb_and_hand_support')),
    jsonb_build_object(
      'localMuscleFatigue',16,'gripFatigue',5,'technicalFatigueSensitivity',30,
      'impactAccumulation',1,'recoveryHours',4,
      'primaryFatigueSites',jsonb_build_array('scapular_musculature','shoulder_and_elbow_support','wrist_and_hand_support','trunk_stabilizers','attention_and_direction_control'),
      'cumulativeBudget',jsonb_build_object('totalCircles',24,'circlesPerDirection',12,'quadrupedSupportSeconds',360,'scapularMotionSeconds',240,'wristExtensionSupportSeconds',360,'technicalSensitivity',30,'impact',1),
      'interference',jsonb_build_array('later_high_priority_handstand_tumbling_crawling_or_pressing','same_session_wrist_shoulder_or_scapular_loading','fatigue_that_changes_contacts_elbows_or_circle_path'),
      'recoveryIsPlanningEstimate',TRUE),
    jsonb_build_object(
      'trainingStimuli',jsonb_build_array('low_load_multidirectional_scapular_control','closed_chain_upper_limb_support','scapular_trunk_dissociation','directional_body_awareness'),
      'stimulusDose',jsonb_build_object('sets',jsonb_build_array(1,3),'completeCirclesPerDirection',jsonb_build_array(2,6),'secondsPerCircle',jsonb_build_array(4,10),'restSeconds',jsonb_build_array(20,60)),
      'weeklyExposure',jsonb_build_object('minimum',0,'maximumWithoutReview',7,'unit','sessions','contextDependent',TRUE),
      'prerequisites',jsonb_build_array('safe_floor_entry_four_point_support_and_exit','comfortable_wrist_elbow_shoulder_and_knee_support','understands_checkpoints_count_reverse_and_stop','can_report_symptoms','same_session_budgets_fit'),
      'completionCriteria',jsonb_build_array('four_contacts_fixed','elbows_extended','all_checkpoints_observed','both_directions_recorded','comparatively_quiet_trunk','comfortable_range','controlled_pace','continuous_breathing','no_stop_symptoms'),
      'sequenceRules',jsonb_build_array('prepare_or_movement_intelligence_context','do_not_convert_direction_range_or_pause_annotations_into_hidden_variants','do_not_replace_with_scapular_push_up_spinal_circle_or_arm_circle_silently','revalidate_downstream_hand_support_and_shoulder_loading'),
      'pairingCompatibility',jsonb_build_object('compatible',jsonb_build_array('low_load_wrist_preparation','breathing_or_trunk_control_when_budgets_fit'),'avoid',jsonb_build_array('fatiguing_hand_support_before_priority_skill','symptom_provoking_shoulder_or_wrist_work','time_critical_output_when_the_drill_displaces_priority_work')),
      'interferenceRules',jsonb_build_array('count_all_overlapping_quadruped_and_hand_support','count_all_overlapping_scapular_and_pressing_work','stop_before_path_contact_or elbow quality changes'),
      'uncertaintyPolicy','When exact base path count symptoms or available time is uncertain do not select; request clarification or choose a separately validated card.',
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
  SELECT p.id,circle_variant,p.profile_key,p.phase_key,'primary',
    CASE p.phase_key WHEN 'prepare_and_access' THEN
      'Use the exact circle for low-load scapular access and hand-support control before later work only when cumulative wrist shoulder and downstream hand-support budgets fit.'
    ELSE
      'Use the exact circle to practice scapular-path awareness and trunk dissociation at low fatigue without converting it into a speed test or clinical assessment.' END,
    CASE p.phase_key WHEN 'prepare_and_access' THEN 90 ELSE 84 END,
    CASE p.phase_key WHEN 'prepare_and_access' THEN 86 ELSE 82 END,
    jsonb_build_object('scapular_access',94,'movement_control',92,'quadruped_support',78,'directional_awareness',88),
    jsonb_build_object('sets',jsonb_build_array(1,CASE WHEN p.phase_key='prepare_and_access' THEN 2 ELSE 3 END),'completeCirclesPerDirection',jsonb_build_array(2,6),'secondsPerCircle',jsonb_build_array(4,10),'restSeconds',jsonb_build_array(20,60),'bothDirectionsRequired',TRUE,'exampleDoseIsNotUniversal',TRUE),
    'Both hands and knees remain fixed, elbows remain extended, every scapular checkpoint is observable, the trunk stays comparatively quiet, both directions use comfortable range and controlled pace, breathing continues, and no stop symptom occurs.',
    ARRAY[
      'Sharp, increasing, night, post-trauma, or unfamiliar pain or participant stop request.',
      'Shoulder pinching, painful clicking, instability, guarding, or support collapse.',
      'Numbness, tingling, weakness, pins and needles, altered circulation, or another neurologic sign.',
      'Dizziness, faintness, nausea, visual change, disorientation, or inability to communicate.',
      'Hand, wrist, elbow, shoulder, knee, shin, or floor-transfer symptoms prevent exact support.',
      'A contact lifts, elbow bends, support collapses, or the four-checkpoint path cannot be restored by reducing range or pace.',
      'Forced range, breath holding, direction confusion, global spinal circling, added limb motion, resistance, instability, or wrong task cannot be corrected safely.',
      'Floor, mat, space, traffic, hygiene, sightline, communication, entry, or exit becomes unsafe.',
      'The planned circle, direction, support-time, technical-fatigue, duration, or downstream exposure budget is reached.'
    ]::TEXT[],
    'Verify the exact fixed-contact circle, floor entry and exit, optional mat, wrist elbow shoulder and knee tolerance, current restrictions and symptoms, first vertical direction, planned circles per direction, actual support time, and downstream hand-support loading. Demonstrate front and side; count only a complete protracted-vertical-retracted-opposite-vertical-protracted loop. Observe contacts, elbows, scapular glide, trunk shift, range, pace, breathing, symptoms, first fault, and duration. Do not diagnose or treat.',
    'Hands and knees stay down, arms stay long, and your shoulder blades trace all four checkpoints back to the start. Reverse direction. Stop for pain, pinching, tingling, weakness, dizziness, or lost support.',
    'More consistent low-load multidirectional scapular control in the exact fixed-contact quadruped task; no treatment, structural, readiness, prevention, or performance outcome is guaranteed.',
    ARRAY['none']::TEXT[],
    jsonb_build_object('stationCapacity',1,'base','bilateral_hands_and_knees_fixed','optionalEquipment','mat_optional','floorEntryAndExitRequired',TRUE,'space','stationary_one_person_quadruped_clearance','setupSeconds',20,'directionChangeSeconds',5,'coachSightline','front_and_side','crossTrafficProhibited',TRUE,'surfaceAndMatInspectionRequired',TRUE,'hygieneResetRequired',TRUE,'revalidateAfterAnyChange',TRUE),
    ARRAY[scapular_push_up_variant,spinal_circle_variant,arm_circle_variant]::UUID[],
    'review',
    jsonb_build_object('durationFormula','setup_seconds + sum(actual_valid_circles * actual_seconds_per_circle) + direction_change_seconds + rest_seconds + invalid_or_partial_attempt_seconds + symptom_response_seconds + substitution_seconds + floor_exit_seconds','secondsPerCircle',jsonb_build_array(4,10),'minimumSeconds',45,'typicalSeconds',100,'maximumSecondsWithoutReview',300,'includeActualNotPlanned',TRUE,'recomputeAfterSubstitution',TRUE),
    jsonb_build_object('regressionOrder',jsonb_build_array('reduce_range','reduce_to_two_circles_per_direction','slow_tempo','increase_rest','add_optional_stable_knee_cushioning','stop_and_select_a_separately_validated_support_changing_task'),'progressionOrder',jsonb_build_array('complete_clean_circles_both_directions','increase_to_three_through_six_per_direction_within_profile','add_brief_checkpoint_pauses','enlarge_range_only_if_comfortable','select_a_distinct_support_changing_task_only_after_full_revalidation'),'neverScaleByForcingRangeAddingSpeedOrIgnoringSymptoms',TRUE),
    jsonb_build_object('record',jsonb_build_array('definition_and_variant','first_vertical_direction','planned_and_actual_complete_circles_per_direction','range_tempo_pauses_rest_and_optional_mat','valid_invalid_partial_and_symptom_limited_attempts','four_contacts_and_elbow_rule','first_fault','symptoms_and_stop_reason','quadruped_support_time','scapular_motion_time','duration','substitution','floor_entry_and_exit'),'validUnit','one_complete_four_checkpoint_return_to_protracted_with_fixed_contacts_extended_elbows_quiet_trunk_and_no_stop','partial_paths_do_not_count',TRUE),
    jsonb_build_object('athlete',jsonb_build_array('four_point_support','arms_long','four_checkpoints','first_vertical_direction','comfortable_range','both_directions','warning_symptom_stop'),'coach',jsonb_build_array('floor_entry_and_exit','support_tolerance','direction_and_count','scapular_versus_spinal_motion','first_fault','clinical_scope','logging_and_escalation'),'accessibility',jsonb_build_array('front_and_side_demonstration','written_checkpoint_strip','elevation_first_and_depression_first_cues','optional_knee_cushioning','smaller_range_fewer_circles_slower_tempo_and_rest','separately_validated_support_changing_or_non_floor_alternative'))
  FROM (VALUES
    ('b9806f42-8388-4823-af53-622ce5ade3c1'::UUID,'prepare-fixed-contact-scapular-circles','prepare_and_access'),
    ('373dc667-abc7-40a3-bc7f-68fabc121e7d'::UUID,'movement-intelligence-fixed-contact-scapular-circles','movement_intelligence')
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
  SELECT 1,canonical_definition,i.definition_id,'distinct_exercises',i.rationale,
    jsonb_build_object('migration',migration_key,'identityBoundary',i.boundary_key,
      'source34Contract','fixed_bilateral_hand_and_knee_continuous_four_checkpoint_scapular_circle',
      'neighborContract',i.neighbor_contract,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'deterministic_identity_equivalence',NULL,now()
  FROM (VALUES
    (scapular_push_up_definition,'scapular_circle_vs_two_direction_scapular_push_up','A Scapular Push-Up uses retraction-to-protraction cycles or a protraction hold and does not require elevation and depression checkpoints.','straight_arm_retraction_protraction_cycle_or_hold'),
    (spinal_circle_definition,'scapular_circle_vs_global_spinal_circle','Quadruped Spinal Circles move the global spine and pelvis through rounded lateral arched and opposite-lateral checkpoints rather than isolating a scapular loop.','global_spinal_and_pelvic_circle'),
    (arm_circle_definition,'closed_chain_scapular_circle_vs_open_chain_arm_circle','Arm Circles or Shoulder CARs move the humerus and hand in open chain and change laterality support actions and count.','open_chain_humeral_circle'),
    (scapular_clock_definition,'exact_continuous_circle_vs_incomplete_scapular_clock_contract','Source 1311 does not define planted versus moving hand discrete versus continuous path required checkpoints or count and cannot be merged into the exact Source 34 circle.','identity_contract_incomplete_and_quarantined')
  ) i(definition_id,boundary_key,rationale,neighbor_contract)
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
    ('identity','https://gmb.io/shoulder-mobility/','Shoulder Mobility Exercises: Find Your Restriction, Then Fix It','GMB Fitness','expert_instruction','GMB describes hands and knees aligned under shoulders and hips straight arms wide shoulder circles and both directions.','direct exact-task identity and instruction','The source does not define the Vortex checkpoint count invalidation or every adjacent identity.',78),
    ('taxonomy','https://www.rehabhero.ca/exercise/quadruped-scapular-circles','Quadruped Scapular Circles','Rehab Hero','expert_instruction','The direct task is multidirectional scapular motion from quadruped with a neutral-spine intent.','direct movement context','The source does not create Vortex controlled taxonomy keys.',78),
    ('anatomy','https://pmc.ncbi.nlm.nih.gov/articles/PMC9937811/','Kinematic analysis of scapulothoracic movements in the shoulder girdle: a whole cadaver study','JSES International','peer_reviewed_research','The study quantifies scapulothoracic sternoclavicular and acromioclavicular motion during protraction retraction and shrug.','adjacent kinematic anatomy context','Cadaver data do not establish live exercise muscle force exact circles normal range or eligibility.',86),
    ('biomechanics','https://www.sciencedirect.com/science/article/pii/S0021929016306832','Three-dimensional scapular kinematics during open and closed kinetic chain movements in asymptomatic and symptomatic subjects','Journal of Biomechanics','peer_reviewed_research','Closed-chain upper-extremity movement fixes or restrains the terminal segment and differs kinematically from open chain.','closed-chain boundary context','The study used sling elevation rather than this exact circle.',86),
    ('difficulty','https://pubmed.ncbi.nlm.nih.gov/25881172/','The effects of exercise type and elbow angle on vertical ground reaction force and muscle activity during a push-up plus exercise','Journal of Sports Science & Medicine','peer_reviewed_research','Related hands-and-knees and hands-and-feet support tasks differ materially in vertical force and muscle activity.','adjacent loading and base context','The study does not score this circle or classify participants.',86),
    ('load_fatigue_recovery','https://pmc.ncbi.nlm.nih.gov/articles/PMC12734928/','Electromyographic Patterns of Scapular Muscles During Four Variations of Protraction–Retraction Exercises','Healthcare','peer_reviewed_research','Quadruped scapular protraction-retraction conditions produce measurable muscle activity and change with support.','adjacent quadruped scapular load context','The study does not quantify circle load cumulative limits or recovery.',86),
    ('constraints','https://static.usagym.org/PDFs/about/wellness/exercise/wrist.pdf','Suggested Gymnastics Wrist Exercises','USA Gymnastics','governing_body','USA Gymnastics advises medical guidance for pain stopping painful exercise and reducing work when form fails.','symptom and support constraint context','The guidance does not establish universal eligibility for this task.',88),
    ('dosage','https://gmb.io/shoulder-mobility/','Shoulder Mobility Exercises: Find Your Restriction, Then Fix It','GMB Fitness','expert_instruction','GMB provides examples of five repetitions each direction for two to three sets and 30 to 60 seconds each direction.','expert programming examples','Examples are not universal prescriptions and do not validate Vortex budgets or recovery.',78),
    ('instructions','https://gmb.io/shoulder-mobility/','Shoulder Mobility Exercises: Find Your Restriction, Then Fix It','GMB Fitness','expert_instruction','The direct instruction uses fixed quadruped support straight arms wide controlled shoulder circles and both directions.','direct exact-task instruction','Vortex checkpoint count fault and persistence rules are added operational boundaries.',78),
    ('safety_stop_rules','https://gmb.io/shoulder-mobility/','Shoulder Mobility Exercises: Find Your Restriction, Then Fix It','GMB Fitness','expert_instruction','GMB recommends professional help for worsening pain night pain weakness numbness pins and needles or pain after trauma.','warning and referral context','Facility trauma neurologic circulation cardiopulmonary incident and emergency policy remains required.',78),
    ('programming','https://pubmed.ncbi.nlm.nih.gov/36000960/','Scapular movement training is not superior to standardized exercises in the treatment of individuals with chronic shoulder pain and scapular dyskinesis: randomized controlled trial','Disability and Rehabilitation','peer_reviewed_research','A randomized trial found scapular movement training was not superior for the measured chronic shoulder pain outcomes.','outcome claim boundary','The trial does not test this exact circle as a standalone workout exercise.',90),
    ('athlete_support','https://www.rehabhero.ca/exercise/quadruped-scapular-circles','Quadruped Scapular Circles','Rehab Hero','expert_instruction','The direct page emphasizes quadruped setup core brace neutral-spine intent circular scapular motion and both directions.','plain-language participant support','The source does not define universal sensation meaning or access.',78),
    ('coach_support','https://www.sciencedirect.com/science/article/pii/S0021929016306832','Three-dimensional scapular kinematics during open and closed kinetic chain movements in asymptomatic and symptomatic subjects','Journal of Biomechanics','peer_reviewed_research','Closed-chain setup changes scapular kinematics and loading context.','coach observation and boundary context','The study does not prescribe Vortex cues group layout counts or escalation.',86),
    ('accessibility','https://gmb.io/shoulder-mobility/','Shoulder Mobility Exercises: Find Your Restriction, Then Fix It','GMB Fitness','expert_instruction','The source supports controlled self-selected usable range and pacing.','range and tempo annotation context','Changed support requires a separately reviewed card.',78),
    ('alternates','https://www.rehabhero.ca/exercise/quadruped-scapular-circles','Quadruped Scapular Circles','Rehab Hero','expert_instruction','The direct task retains quadruped support and completes circles in both directions.','alternate identity boundary context','The source does not adjudicate all Vortex alternates or approve graph edges.',78),
    ('media','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en','Embed videos and playlists','YouTube Help','manufacturer_instruction','Five candidates returned current oEmbed title channel thumbnail and iframe metadata on 2026-08-09.','candidate metadata only','oEmbed does not prove playback exact contacts path count captions accessibility quality safety card match or approval.',82)
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
  SELECT canonical_definition,NULL,2,
    'https://www.youtube.com/watch?v='||m.video_id,
    'https://www.youtube-nocookie.com/embed/'||m.video_id,
    m.video_id,m.title,m.channel,NULL,'en',NULL,TRUE,NULL,NULL,
    'healthy','candidate','manual_research',m.query,NULL,NULL,
    '2026-11-09'::TIMESTAMPTZ,
    'Current YouTube oEmbed metadata only. Playback exact contacts path direction count captions accessibility cue quality safety reviewer identity card-version match and approval remain unverified.'
  FROM (VALUES
    ('XtGilhjp8OQ','Quadruped Shoulder Circles for Shoulder Health','AnamBliss','legacy Source 34 candidate checked by YouTube oEmbed'),
    ('R1D5vuq9nJM','Quadruped shoulder circles','MobilityTraining','legacy Source 34 candidate checked by YouTube oEmbed'),
    ('d8SmV7z6CyQ','Quadruped shoulder circles','Unique Fitness','legacy Source 34 candidate checked by YouTube oEmbed'),
    ('7p5ujyokvtY','Quadruped Shoulder circles','santo chiappetta','legacy Source 34 candidate checked by YouTube oEmbed'),
    ('B-U015U3wGk','Quadruped Scapular Circles','In Focus Coaching & Sports Nutrition','quadruped scapular circles candidate checked by YouTube oEmbed')
  ) m(video_id,title,channel,query)
  ON CONFLICT(definition_id,reviewed_card_version,url) DO UPDATE SET
    variant_id=NULL,embed_url=EXCLUDED.embed_url,video_id=EXCLUDED.video_id,
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
    ('Quadruped Shoulder Circles','same_identity','The source name fits the exact bilateral fixed-contact continuous circle.','source_alias',jsonb_build_array('fixed_contacts','continuous_circle'),'authored_variant'),
    ('Quadruped Scapular Circles or Scapula Circles','same_identity','Aliases fit only with fixed hands and knees straight elbows and a complete four-checkpoint loop.','scapular_circle_alias',jsonb_build_array('fixed_contacts','straight_elbows','four_checkpoints'),'merge_alias'),
    ('Quadruped Scapular CARs','same_identity','CAR is an alias only when it means the same bilateral continuous scapular loop rather than an arm circle or assessment.','cars_alias_boundary',jsonb_build_array('scapular_not_humeral','continuous_loop'),'merge_alias'),
    ('Elevation-First or Depression-First Direction','modifier_annotation','Reversing the first vertical checkpoint changes direction while preserving the loop and count.','direction_annotation',jsonb_build_array('first_vertical_direction','same_path'),'delivery_annotation'),
    ('Clockwise or Counter-Clockwise Cue','modifier_annotation','Clock-face language is rendering only after athlete perspective and exact path are declared.','direction_language',jsonb_build_array('athlete_perspective','declared_path'),'delivery_annotation'),
    ('Comfortable Circle Range','modifier_annotation','Range changes dose while fixed contacts path and count remain exact.','range_annotation',jsonb_build_array('comfortable_range','same_path'),'delivery_annotation'),
    ('Controlled Tempo','modifier_annotation','Tempo changes dose while the same checkpoints and count remain.','tempo_annotation',jsonb_build_array('tempo','same_count'),'delivery_annotation'),
    ('Brief Cardinal Checkpoint Pauses','modifier_annotation','Brief pauses change tempo when the complete path and count remain intact.','pause_annotation',jsonb_build_array('checkpoint_pause','same_path'),'delivery_annotation'),
    ('Repetitions Sets or Rest','modifier_annotation','Volume and recovery alter dosage rather than identity.','dose_annotation',jsonb_build_array('repetitions','sets','rest'),'delivery_annotation'),
    ('Stable Knee Cushioning','modifier_annotation','A stable mat changes knee comfort without changing support.','mat_annotation',jsonb_build_array('stable_mat','same_support'),'delivery_annotation'),
    ('Wall Scapular Circles','new_variant','Wall support changes angle equipment load station and failure consequence.','wall_support_variant',jsonb_build_array('wall','equipment','changed_load'),'needs_human_review'),
    ('Raised-Support Scapular Circles','new_variant','Bench or box support changes height equipment load logistics and failure consequence.','raised_support_variant',jsonb_build_array('raised_support','equipment'),'needs_human_review'),
    ('High-Plank Scapular Circles','new_variant','Toe support changes leverage whole-body demand fatigue and failure consequence.','high_plank_variant',jsonb_build_array('toe_support','changed_load'),'needs_human_review'),
    ('Bear-Hover Scapular Circles','new_variant','Knee hover changes contacts load trunk demand fatigue and failure consequence.','bear_hover_variant',jsonb_build_array('knee_hover','changed_base'),'needs_human_review'),
    ('Unilateral Quadruped Scapular Circle','new_variant','One-hand emphasis or lift changes laterality stability rotation demand and loading.','unilateral_variant',jsonb_build_array('unilateral','reduced_support'),'needs_human_review'),
    ('Band-Resisted Scapular Circles','new_variant','Resistance changes force direction equipment loading fatigue setup and release risk.','band_resisted_variant',jsonb_build_array('external_resistance','release_risk'),'needs_human_review'),
    ('Unstable-Surface Scapular Circles','new_variant','Instability changes equipment load variability control demand and failure consequence.','unstable_variant',jsonb_build_array('unstable_surface','equipment'),'needs_human_review'),
    ('Quadruped Scapular Clock','new_definition','Source 1311 lacks a reproducible exact path and cannot be merged into this continuous circle.','scapular_clock_incomplete_distinct',jsonb_build_array('identity_contract_incomplete','different_name_and_count'),'existing_quarantined_definition'),
    ('Quadruped Spinal Circles','new_definition','Global spinal and pelvic checkpoints change the moving region and count.','spinal_circle_distinct',jsonb_build_array('global_spine','pelvis'),'existing_distinct_definition'),
    ('Arm Circles or Shoulder CARs','new_definition','Open-chain humeral motion with a moving hand changes support joints laterality and count.','arm_circle_distinct',jsonb_build_array('open_chain','humeral_motion'),'existing_distinct_definition'),
    ('Scapular Push-Up','new_definition','Retraction-to-protraction cycles or protraction holds omit the full elevation-depression circle.','scapular_push_up_distinct',jsonb_build_array('two_direction_cycle_or_hold'),'existing_distinct_definition'),
    ('Clinical Scapular Dyskinesis or Shoulder Assessment','new_definition','Assessment adds examiner protocol measurement consent interpretation and escalation.','clinical_assessment_distinct',jsonb_build_array('clinical_scope','measurement','consent'),'research_queue')
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
      'revalidate',jsonb_build_array('identity and purpose','contacts elbows path and moving region','laterality support height stability and force','symptoms and restrictions','dose duration and logistics','wrist shoulder scapular trunk and hand-support fatigue budgets','persistence','coach rendering','athlete rendering'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'review',NULL,NULL,NULL
  FROM (VALUES
    (scapular_push_up_variant,circle_variant,'progression',62,ARRAY['range','complexity','decision_demand']::TEXT[],'Adds elevation depression direction reversal and a continuous four-checkpoint circle to the exact quadruped straight-arm scapular task.'),
    (circle_variant,scapular_push_up_variant,'regression',62,ARRAY['range','complexity','decision_demand']::TEXT[],'Removes the multidirectional circle for a distinct retraction-to-protraction cycle only when that changed purpose is acceptable.'),
    (circle_variant,spinal_circle_variant,'lateral_substitution',52,ARRAY['range','complexity','stability']::TEXT[],'Changes the moving region from scapulae with a quiet trunk to global spinal and pelvic checkpoints and requires full reselection.'),
    (circle_variant,arm_circle_variant,'lateral_substitution',44,ARRAY['range','stability','load']::TEXT[],'Changes from closed-chain bilateral scapular motion to open-chain humeral motion and requires full reselection.')
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
  SELECT 1,circle_variant,d.dimension,
    CASE d.dimension WHEN 'technicalComplexity' THEN 30 ELSE 18 END,20,
    CASE d.dimension WHEN 'technicalComplexity' THEN
      'Review-only exercise-complexity anchor based on fixed contacts straight elbows four directional checkpoints continuous-path control direction reversal trunk dissociation quality gates and count validity.'
    ELSE
      'Review-only physical-difficulty anchor based on partial-bodyweight bilateral hand wrist elbow shoulder scapular trunk hip and knee support without impact or external load.'
    END||' This scores the exercise task, not participant proficiency.',
    'review',1,NULL,NULL,
    'Research-informed proposal only; independent comparison and qualified human approval remain required.',NULL
  FROM (VALUES('technicalComplexity'),('absoluteLoadDemand')) d(dimension)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
    proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,reviewed_by=NULL,
    review_notes=EXCLUDED.review_notes,reviewed_at=NULL,updated_at=now();

  UPDATE coaching.exercise SET
    name='Quadruped Shoulder Circles',slug='quadruped-shoulder-circles',
    description='From hands and knees with arms long, trace a complete circle with the shoulder blades through a declared first vertical direction, retraction, the opposite vertical direction, and return to the pushed-away start. Reverse direction. Keep all four contacts fixed and the trunk comparatively quiet.',
    instructions='Use the exact canonical variant. Place hands under shoulders and knees under hips on a stable surface. Keep elbows extended without forced lockout and begin comfortably pushed away. Move through the declared first vertical checkpoint, controlled retraction, the opposite vertical checkpoint, and back to protraction to count one circle. Reverse by changing the first vertical direction. Keep the trunk comparatively quiet, breathe continuously, and reduce range rather than forcing. Stop for pain, pinching, painful clicking, instability, numbness, tingling, weakness, altered circulation, dizziness, faintness, nausea, visual change, support loss, or participant request.',
    skill_level=NULL,age_min=NULL,age_max=NULL,
    default_sets=1,default_reps=4,default_work_seconds=40,default_rest_seconds=30,
    tempo='controlled four to ten seconds per complete circle',
    load_note='Track complete circles per first vertical direction, range, tempo, pauses, four-point support seconds, scapular-motion seconds, symptoms, invalid or partial attempts, rest, duration, and overlapping wrist shoulder pressing and hand-support work.',
    est_seconds_per_set=100,is_published=FALSE,archived=FALSE,
    card_summary='Fixed-contact bilateral quadruped scapular circle through protraction elevation retraction depression and return.',
    coach_language='Verify exact base, floor entry and exit, support tolerance, restrictions, direction, dose, all four contacts, extended elbows, full scapular path, comparatively quiet trunk, first fault, actual duration, downstream hand-support budget, persistence, and escalation.',
    athlete_language='Hands and knees stay down, arms stay long, and your shoulder blades trace all four checkpoints back to the start. Reverse direction and stop for pain, pinching, tingling, weakness, dizziness, or lost support.',
    programming_logic=jsonb_build_object(
      'selectionStatus','canonical_variant_required','selectable',TRUE,
      'canonicalDefinitionId',canonical_definition,'exactVariantIds',to_jsonb(active_variant_ids),
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'exerciseDifficultyDescribesTaskOnly',TRUE,
      'selectionInputs',jsonb_build_array('workout purpose','floor transfer and four-point support','wrist elbow shoulder scapular trunk hip and knee tolerance','exact path and count comprehension','circle dose and duration','cumulative upper-limb scapular and hand support','same-session skill and pressing demand','coach scope and sightline'),
      'substitutionRevalidation',jsonb_build_array('identity','contacts and path','laterality support height force and stability','restrictions and symptoms','purpose','dose','fatigue and impact budgets','duration','logistics','persistence','coach rendering','athlete rendering'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    scalable_variables=ARRAY['first_vertical_direction','complete_circles_per_direction','comfortable_range','tempo','checkpoint_pause','rest_seconds','sets','optional_stable_knee_cushioning']::TEXT[],
    movement_family='Quadruped Scapular Circle',primary_phase_key=NULL,
    phase_subrole=NULL,primary_order_slot=NULL,
    movement_requirements=jsonb_build_object(
      'selectable',TRUE,'canonicalVariantRequired',TRUE,'impactLevel',0,
      'balanceDemand','stable_base','breathingDemand','continuous_no_breath_hold',
      'actions',jsonb_build_array('scapular_protraction','scapular_elevation','scapular_retraction','scapular_depression','coupled_scapular_rotation','upper_limb_and_trunk_stabilization'),
      'planes',jsonb_build_array('transverse','frontal','coupled_multiplanar_transition'),
      'mustMaintain',jsonb_build_array('four_fixed_contacts','extended_elbows','all_four_checkpoints','comparatively_quiet_trunk','comfortable_range','controlled_pace','communication'),
      'mustNotAdd',jsonb_build_array('global_spinal_circle','elbow_flexion_cycle','limb_lift','hover','locomotion','support_height_change','external_force','instability','forced_range'),
      'validCompletion','return_to_protracted_start_after_every_checkpoint_with_fixed_contacts_extended_elbows_and_no_stop_rule'),
    coaching_execution=jsonb_build_object(
      'qualityGates',jsonb_build_array('variant_and_station_exact','floor_transfer_and_support_tolerated','direction_understood','four_contacts_fixed','elbows_extended','all_checkpoints_observable','trunk_comparatively_quiet','range_and_pace_controlled','both_directions_recorded','no_stop_symptoms'),
      'stopRules',jsonb_build_array('sharp_increasing_night_post_trauma_or_unfamiliar_pain','pinching_painful_clicking_instability_or_collapse','neurologic_or_circulation_change','dizziness_faintness_nausea_visual_change_or_disorientation','support_contact_or_floor_transfer_pain','contact_elbow_or_path_breakdown','wrong_task_forced_range_or_breath_hold','unsafe_station_or_exit','budget_or_duration_reached'),
      'persistence',jsonb_build_array('definition_and_variant','first_vertical_direction','planned_and_actual_complete_circles','range_tempo_pauses_rest_and_optional_mat','valid_invalid_partial_and_symptom_limited_attempts','contacts_elbow_rule_and_first_fault','symptoms_and_stop_reason','support_and_scapular_motion_seconds','duration','substitution','floor_entry_and_exit')),
    pairing_logic=jsonb_build_object(
      'sameSessionBudget',jsonb_build_array('complete_scapular_circles','circles_per_direction','quadruped_support_seconds','scapular_motion_seconds','wrist_extension_support','shoulder_and_scapular_load','technical_fatigue','downstream_hand_support','impact'),
      'avoidAutomaticPairingWith',jsonb_build_array('fatiguing_handstand_tumbling_crawling_or_pressing_before_priority_skill','symptom_provoking_wrist_or_shoulder_work','same_session_scapular_loading_exceeding_budget'),
      'revalidateAfterSubstitution',TRUE),
    media_library=jsonb_build_object(
      'candidate_video_ids',jsonb_build_array('XtGilhjp8OQ','R1D5vuq9nJM','d8SmV7z6CyQ','7p5ujyokvtY','B-U015U3wGk'),
      'reviewState','oembed_metadata_only_candidate_quarantine',
      'playbackExactnessContactsPathCaptionsAccessibilityQualitySafetyAndApprovalVerified',FALSE,
      'humanReviewRequired',TRUE),
    participant_structure='individual',programming_kind='exercise',linked_skill_id=NULL,
    why_publish_ready=FALSE,updated_at=now()
  WHERE id=34;

  UPDATE coaching.exercise_safety_profile SET
    risk_level=1,impact_level=0,minimum_age_recommended=NULL,
    minimum_skill_level=NULL,requires_spotting=FALSE,
    requires_coach_supervision='recommended',
    minimum_prerequisite_notes='Readiness uses floor transfer, exact four-point support, comfortable wrist elbow shoulder scapular and knee tolerance, path comprehension, current symptoms, communication, workout dose, and downstream loading; never participant proficiency or age.',
    readiness_checks=ARRAY[
      'Confirm exact variant, stable floor or optional mat, safe entry and exit, clearance, sightline, hygiene, communication, and emergency route.',
      'Confirm hand wrist elbow shoulder scapular trunk hip knee and shin support tolerance and no current symptom or restriction conflict.',
      'Confirm the participant understands fixed contacts, extended elbows, all four checkpoints, first vertical direction, reverse, count, range reduction, and stop signal.',
      'Review cumulative scapular circles, quadruped and wrist-extension support, shoulder load, technical fatigue, and later hand-support or pressing demand.'
    ]::TEXT[],
    stop_signs=ARRAY[
      'Sharp, increasing, night, post-trauma, or unfamiliar pain, guarding, or participant stop request.',
      'Shoulder pinching, painful clicking, instability, or support collapse.',
      'Numbness, tingling, weakness, pins and needles, altered circulation, or another neurologic sign.',
      'Dizziness, faintness, nausea, visual change, disorientation, or inability to communicate.',
      'Hand, wrist, elbow, shoulder, knee, shin, or floor-transfer symptoms prevent exact support.',
      'Contact loss, elbow bend, missing checkpoint, global spinal circle, forced range, breath hold, or path breakdown cannot be corrected safely.',
      'Floor, mat, space, traffic, sightline, hygiene, communication, duration, budget, or safe exit becomes inadequate.'
    ]::TEXT[],
    contraindications=ARRAY[
      'Current symptoms, trauma, procedure, instability, or clinical restrictions conflict with quadruped loading or multidirectional scapular motion.',
      'No safe floor transfer, four-point support, stable floor or mat, space, sightline, communication, or exit.',
      'The intended service is diagnosis, treatment, injury management, readiness clearance, manual assistance, or another exercise identity.'
    ]::TEXT[],
    common_substitutions=ARRAY[
      'Use the exact quadruped Scapular Push-Up only when a two-direction cycle or hold fits the changed purpose and all checks are rerun.',
      'Use Quadruped Spinal Circles only when global spinal and pelvic motion fits the changed purpose and all checks are rerun.',
      'Use Arm Circles or Shoulder CARs only when open-chain humeral motion fits the changed purpose and all checks are rerun.',
      'Author and review wall, raised, plank, hover, unilateral, resisted, or unstable alternatives before selection.'
    ]::TEXT[]
  WHERE exercise_id=34;

  UPDATE coaching.exercise_score_v1 SET
    technical_complexity=30,absolute_load_demand=18,coordination_demand=30,
    impact=1,supervision_demand=18,base_overall_difficulty=greatest(30,18),
    legacy_scores=coalesce(legacy_scores,'{}'::JSONB)||jsonb_build_object(
      'candidateReassessment',migration_key,
      'projectionScope','fixed_contact_bilateral_scapular_circle_exact_variant',
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'variantScores',jsonb_build_object('fixedContactContinuousCircle',
        jsonb_build_object('complexity',30,'physicalDifficulty',18,'overall',30)),
      'exerciseScoresDescribeTaskOnly',TRUE,'independentCalibrationRequired',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    migration_confidence=60,human_review_status='queued',reviewed_by=NULL,reviewed_at=NULL,
    review_notes='Research-informed candidate reassessment only. Scores describe exercise complexity and physical difficulty, not participant proficiency. Exact path support and independent calibration remain required.',
    updated_at=now()
  WHERE exercise_id=34;

  UPDATE coaching.exercise_difficulty_profile SET
    technical=3.0,complexity=3.0,load=1.8,overall=3.0,
    recommended_age_min=NULL,recommended_age_max=NULL,attention_demand='moderate',
    notes='Candidate projection from the exact fixed-contact bilateral scapular-circle variant. Complexity is 30/100, physical difficulty 18/100, and overall 30/100 by maximum. This is not participant proficiency or age classification.',
    source='canonical_research_candidate',updated_at=now()
  WHERE exercise_id=34;

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  VALUES(canonical_definition,1,2,'2.0.0',migration_key,'quarantined',
    jsonb_build_object(
      'identity',jsonb_build_object('passed',TRUE,'identityKey','fixed_contact_bilateral_scapular_circle','legacySources',1,'activeVariants',1,'archivedSourceSkeleton',TRUE,'neighborBoundaries',4,'scapularClockContractIncomplete',TRUE),
      'taxonomy',jsonb_build_object('passed',TRUE,'controlledTerms',TRUE,'movementPatterns',jsonb_build_array('brace','push','rotate'),'bodyRegions',9,'equipment',jsonb_build_array('none','mat_optional')),
      'anatomy',jsonb_build_object('passed',TRUE,'musclesJointsActionsPlanesLateralityContactsSequenceAndTrunkBoundary',TRUE),
      'difficulty',jsonb_build_object('passed',TRUE,'model','max_exercise_complexity_physical_difficulty','variantVectors',jsonb_build_array('30/18/30'),'participantClassificationAbsent',TRUE,'independentCalibrationRequired',TRUE),
      'loadFatigueRecovery',jsonb_build_object('passed',TRUE,'actualCirclesDirectionSupportTimeScapularMotionAndJointExposureTracked',TRUE,'impactNone',TRUE,'recoveryIsPlanningEstimate',TRUE),
      'constraints',jsonb_build_object('passed',TRUE,'floorTransferFourPointSupportSymptomsRestrictionsSpaceTrafficScopeAndExit',TRUE),
      'delivery',jsonb_build_object('passed',TRUE,'profiles',2,'prepareAndMovementIntelligence',TRUE,'durationDoseRestStationAndSubstitutionRevalidation',TRUE),
      'instructions',jsonb_build_object('passed',TRUE,'athleteCoachAccessibilityAndSupportOperations',TRUE,'directionCheckpointsContactsElbowsSymptomsAndClinicalScope',TRUE),
      'research',jsonb_build_object('passed',TRUE,'sections',16,'registryVersion',research_version,'exampleDoseNotUniversal',TRUE),
      'media',jsonb_build_object('passed',FALSE,'candidateCount',5,'currentOEmbedMetadataHealthy',TRUE,'playbackReviewed',FALSE,'exactVariantReviewed',FALSE,'captionsAccessibilityQualitySafetyAndApprovalReviewed',FALSE),
      'relationships',jsonb_build_object('passed',FALSE,'reviewOnly',4,'approved',0,'automaticSubstitution',FALSE),
      'calibration',jsonb_build_object('passed',FALSE,'reviewOnly',2,'approved',0),
      'alternates',jsonb_build_object('passed',TRUE,'assessments',22,'singleExactVariant',TRUE,'supportChangingVariantsQuarantined',TRUE),
      'generationSupport',jsonb_build_object('passed',TRUE,'selectionConstraints',TRUE,'cumulativeFatigueAndImpactBudgets',TRUE,'duration',TRUE,'equipmentAndStation',TRUE,'substitutionRevalidation',TRUE,'renderingAndPersistence',TRUE),
      'publication',jsonb_build_object('passed',FALSE,'reviewer',NULL,'approver',NULL)),
    jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01','message','A qualified human must watch all five candidates in full and verify playback, exact fixed contacts, extended elbows, complete path, direction, count, range, captions, accessibility, cue quality, safety, conflicts, reviewer identity, timestamp, card version, and approval rationale.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','A qualified coach must approve or reject all four relationships; no automatic substitution between scapular circles, Scapular Push-Ups, spinal circles, or arm circles is authorized.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','An independent qualified reviewer must calibrate exercise complexity 30 and physical difficulty 18. Scores do not classify a participant or create an age or proficiency level.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','A qualified reviewer and separate approver must complete content review before publication. Identity, anatomy, loading, path, contacts, wrist and shoulder risk, scope, dose, stop, accessibility, persistence, and support rules remain quarantined.')),
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
        AND movement_patterns=ARRAY['brace','push','rotate']::TEXT[]
        AND anatomy_json<>'{}'::JSONB AND environment_json<>'{}'::JSONB
        AND population_json<>'{}'::JSONB AND athlete_support_json<>'{}'::JSONB
        AND coach_support_json<>'{}'::JSONB AND support_operations_json<>'{}'::JSONB
        AND provenance_json->>'approvalsCreated'='false')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source_variant AND status='archived'
        AND requirements_json->>'representation'='superseded_source_skeleton')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=circle_variant AND definition_id=canonical_definition AND status='review'
        AND requirements_json->>'selectable'='true'
        AND (difficulty_json->>'technicalComplexity')::INTEGER=30
        AND (difficulty_json->>'physicalDifficulty')::INTEGER=18
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=greatest(30,18)
        AND (load_profile_json->>'landingContactsPerRep')::INTEGER=0
        AND (fatigue_profile_json->>'impactAccumulation')::INTEGER=1
        AND programming_profile_json->>'publicationQuarantined'='true') THEN
    RAISE EXCEPTION '% definition variant or source quarantine assertion failed',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=circle_variant AND status='review'
        AND cardinality(equipment_required)>0
        AND coalesce(time_model_json->>'durationFormula','')<>''
        AND dose_scaling_json<>'{}'::JSONB AND measurement_json<>'{}'::JSONB
        AND support_prompts_json<>'{}'::JSONB AND length(coach_instructions)>=100
        AND length(athlete_instructions) BETWEEN 10 AND 240
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
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>22
    OR (SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=circle_variant OR to_variant_id=circle_variant)
        AND review_status='review' AND reviewed_by IS NULL)<>4
    OR (SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=circle_variant AND status='review' AND reviewed_by IS NULL)<>2
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=canonical_definition AND decision='distinct_exercises'
        AND reviewed_by IS NULL)<>4 THEN
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
      WHERE v.id=circle_variant
        AND NOT EXISTS(SELECT 1 FROM coaching.equipment allowed WHERE allowed.key=key)) THEN
    RAISE EXCEPTION '% uncontrolled taxonomy was authored',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1 r
      CROSS JOIN LATERAL unnest(r.dimensions) dimension
      WHERE (r.from_variant_id=circle_variant OR r.to_variant_id=circle_variant)
        AND dimension<>ALL(ARRAY['load','leverage','range','speed','stability','complexity','impact','decision_demand','fatigue']))
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=circle_variant OR to_variant_id=circle_variant)
        AND review_status='approved') THEN
    RAISE EXCEPTION '% relationship dimension or approval assertion failed',migration_key;
  END IF;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=34
      AND skill_level IS NULL AND age_min IS NULL AND age_max IS NULL
      AND linked_skill_id IS NULL AND is_published=FALSE AND archived=FALSE
      AND programming_kind='exercise' AND why_publish_ready=FALSE)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1
      WHERE exercise_id=34 AND technical_complexity=30
        AND absolute_load_demand=18 AND base_overall_difficulty=30
        AND human_review_status='queued' AND reviewed_by IS NULL AND reviewed_at IS NULL)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=canonical_definition AND card_version=2
        AND status='quarantined' AND human_review_required=TRUE
        AND jsonb_array_length(blocking_issues_json)=4) THEN
    RAISE EXCEPTION '% legacy projection or packet assertion failed',migration_key;
  END IF;
END
$migration$;
