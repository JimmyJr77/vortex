-- Source 33: replace the generic consolidated baseline with exact dynamic and
-- protraction-hold variants in quadruped and high-plank bases. The inherited
-- PMID 32707142 is an unrelated prone-CPR review and is explicitly removed
-- from current provenance. All authority remains human-review only.
DO $migration$
DECLARE
  migration_key CONSTANT TEXT := '504_coaching_scapular_push_up_family_audit_hardening';
  research_version CONSTANT TEXT := '2026-08-09.100';
  canonical_definition UUID;
  source_variant UUID;
  legacy_quadruped_hold UUID;
  legacy_plank_hold UUID;
  quadruped_dynamic UUID;
  plank_dynamic UUID;
  quadruped_hold UUID;
  plank_hold UUID;
  active_variant_ids UUID[];
  source_variant_ids UUID[];
  all_owned_variant_ids UUID[];
  push_up_definition UUID;
  push_up_variant UUID;
  clock_definition UUID;
  clock_variant UUID;
  protected_count INTEGER;
BEGIN
  SELECT definition_id INTO canonical_definition FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=33;
  SELECT id INTO source_variant FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='baseline';
  SELECT id INTO legacy_quadruped_hold FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='legacy-source-247-baseline';
  SELECT id INTO legacy_plank_hold FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='legacy-source-853-baseline';
  SELECT id INTO quadruped_dynamic FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='quadruped-straight-arm-retraction-protraction-cycle';
  quadruped_dynamic := coalesce(quadruped_dynamic,gen_random_uuid());
  SELECT id INTO plank_dynamic FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='high-plank-straight-arm-retraction-protraction-cycle';
  plank_dynamic := coalesce(plank_dynamic,gen_random_uuid());
  SELECT id INTO quadruped_hold FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='quadruped-straight-arm-protraction-hold';
  quadruped_hold := coalesce(quadruped_hold,gen_random_uuid());
  SELECT id INTO plank_hold FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='high-plank-straight-arm-protraction-hold';
  plank_hold := coalesce(plank_hold,gen_random_uuid());
  SELECT definition_id INTO push_up_definition FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=186;
  SELECT id INTO push_up_variant FROM coaching.exercise_variant_v1 WHERE definition_id=push_up_definition AND variant_key='standard-floor';
  SELECT definition_id INTO clock_definition FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=1311;
  SELECT id INTO clock_variant FROM coaching.exercise_variant_v1 WHERE definition_id=clock_definition AND variant_key='baseline';
  active_variant_ids := ARRAY[quadruped_dynamic,plank_dynamic,quadruped_hold,plank_hold];
  source_variant_ids := ARRAY[source_variant,legacy_quadruped_hold,legacy_plank_hold];
  all_owned_variant_ids := ARRAY[source_variant,legacy_quadruped_hold,legacy_plank_hold,quadruped_dynamic,plank_dynamic,quadruped_hold,plank_hold];

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=33 AND facility_id=1)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition AND facility_id=1 AND legacy_exercise_id=33)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=33 AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source_variant AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=legacy_quadruped_hold AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=legacy_plank_hold AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=push_up_variant AND definition_id=push_up_definition
        AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=clock_variant AND definition_id=clock_definition
        AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1 WHERE exercise_id=33)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_difficulty_profile
      WHERE exercise_id=33)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_safety_profile
      WHERE exercise_id=33) THEN
    RAISE EXCEPTION '% prerequisite source or neighbor rows are missing',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=ANY(active_variant_ids) AND definition_id<>canonical_definition)
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE slug='scapular-push-up' AND id<>canonical_definition) THEN
    RAISE EXCEPTION '% working UUID or slug already belongs to another card',migration_key;
  END IF;

  SELECT coalesce(sum(n),0) INTO protected_count FROM (
    SELECT count(*) n FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition AND (status IN('published','deprecated')
        OR reviewed_by IS NOT NULL OR approved_by IS NOT NULL
        OR last_reviewed_at IS NOT NULL)
    UNION ALL SELECT count(*) FROM coaching.exercise_section_evidence_v1
      WHERE definition_id=canonical_definition
        AND (reviewer_user_id IS NOT NULL
          OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=canonical_definition
        AND (reviewer_user_id IS NOT NULL OR reviewed_at IS NOT NULL
          OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id=canonical_definition
        AND (reviewer_user_id IS NOT NULL
          OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_card_review_v1
      WHERE definition_id=canonical_definition
    UNION ALL SELECT count(*) FROM coaching.exercise_card_revision_v1
      WHERE definition_id=canonical_definition
    UNION ALL SELECT count(*) FROM coaching.exercise_media_review_v1
      WHERE definition_id=canonical_definition
    UNION ALL SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=ANY(all_owned_variant_ids)
          OR to_variant_id=ANY(all_owned_variant_ids))
        AND (reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL
          OR review_status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(all_owned_variant_ids)
        AND (reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL
          OR status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE (survivor_definition_id=canonical_definition
          OR resolved_definition_id=canonical_definition)
        AND (reviewed_by IS NOT NULL OR resolution_source='human_review')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_v1
      WHERE exercise_id=33
        AND (human_review_status<>'queued' OR reviewed_by IS NOT NULL
          OR reviewed_at IS NOT NULL)
  ) protected;
  IF protected_count<>0 THEN
    RAISE EXCEPTION '% refuses to overwrite % human-reviewed records',
      migration_key,protected_count;
  END IF;

  UPDATE coaching.exercise_section_evidence_v1 SET
    review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
    updated_at=now()
  WHERE definition_id=canonical_definition
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_media_candidate_v1 SET
    review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
    exact_variant_match=NULL,demonstration_quality_score=NULL,updated_at=now()
  WHERE definition_id=canonical_definition
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_alternate_assessment_v1 SET
    review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
    updated_at=now()
  WHERE definition_id=canonical_definition
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  DELETE FROM coaching.exercise_relationship_v1
  WHERE (from_variant_id=ANY(all_owned_variant_ids)
      OR to_variant_id=ANY(all_owned_variant_ids))
    AND reviewed_by IS NULL AND review_status<>'approved';
  DELETE FROM coaching.exercise_score_calibration_v1
  WHERE variant_id=ANY(all_owned_variant_ids)
    AND reviewed_by IS NULL AND status<>'approved';

  UPDATE coaching.exercise_definition_source_v1 SET
    source_kind='legacy_migration',
    provenance_json=(coalesce(provenance_json,'{}'::JSONB)-'researchSources')
      ||jsonb_build_object(
        'migration',migration_key,'researchVersion',research_version,
        'sourceDisposition','canonical_four_variant_scapular_support_family_reauthored',
        'representedBySelectableSourceVariant',FALSE,
        'sourceInterpretation','source 33 and consolidated sources 247 and 853 do not select base dynamic-versus-hold action count duration loading budgets or complete operational support contracts',
        'exactWorkingSpecifications',jsonb_build_array(
          'bilateral_quadruped_straight_arm_scapular_retraction_protraction_cycle',
          'bilateral_high_plank_straight_arm_scapular_retraction_protraction_cycle',
          'bilateral_quadruped_end_range_protraction_hold',
          'bilateral_high_plank_end_range_protraction_hold'),
        'removedUnrelatedResearchSource','https://pubmed.ncbi.nlm.nih.gov/32707142/',
        'removedSourceReason','PMID 32707142 is a prone cardiopulmonary-resuscitation review and does not support this exercise card',
        'researchSources',jsonb_build_array(
          'https://bmjopensem.bmj.com/content/bmjosem/8/1/e001270/DC1/embed/inline-supplementary-material-1.pdf',
          'https://bmjopensem.bmj.com/content/8/1/e001270',
          'https://www.acefitness.org/resources/everyone/blog/6350/exercises-to-counteract-too-much-sitting/',
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC6863690/',
          'https://pubmed.ncbi.nlm.nih.gov/25881172/',
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC12734928/',
          'https://ohiostate.elsevierpure.com/en/publications/scapula-kinematic-alterations-following-a-modified-push-up-plus-t/',
          'https://static.usagym.org/PDFs/about/wellness/exercise/wrist.pdf',
          'https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en'),
        'exerciseDifficultyDescribesTaskOnly',TRUE,
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=33 AND definition_id=canonical_definition;

  UPDATE coaching.exercise_delivery_profile_v1 SET
    status='archived',updated_at=now()
  WHERE variant_id=ANY(source_variant_ids);
  UPDATE coaching.exercise_variant_v1 SET
    variant_key=CASE id
      WHEN source_variant THEN 'identity-quarantine-source-33'
      WHEN legacy_quadruped_hold THEN 'identity-quarantine-source-247'
      ELSE 'identity-quarantine-source-853' END,
    display_name=CASE id
      WHEN source_variant THEN 'Scapular Push-Up Legacy Generic Skeleton — Source 33'
      WHEN legacy_quadruped_hold THEN 'Quadruped Scapular Push-Up Hold Legacy Skeleton — Source 247'
      ELSE 'Scapular Push-Up Plus Iso Hold Legacy Skeleton — Source 853' END,
    modifier_keys='{}'::TEXT[],difficulty_json='{}'::JSONB,status='archived',
    requirements_json=jsonb_build_object(
      'selectable',FALSE,'representation','superseded_source_skeleton',
      'sourceLegacyExerciseId',CASE id WHEN source_variant THEN 33
        WHEN legacy_quadruped_hold THEN 247 ELSE 853 END,
      'archiveReason','did not select exact base dynamic-or-hold action count duration load dose or review contract',
      'replacementVariantIds',to_jsonb(active_variant_ids),
      'humanReviewRequired',TRUE),
    load_profile_json=jsonb_build_object('selectable',FALSE),
    fatigue_profile_json=jsonb_build_object('selectable',FALSE),
    programming_profile_json=jsonb_build_object(
      'selectionStatus','superseded_source_skeleton','selectable',FALSE,
      'publicationQuarantined',TRUE),updated_at=now()
  WHERE id=ANY(source_variant_ids);

  INSERT INTO coaching.exercise_definition_v1(
    id,facility_id,legacy_exercise_id,slug,canonical_name,display_name,aliases,
    description,family_key,schema_version,card_version,status,
    content_confidence,scoring_confidence,media_confidence,movement_patterns,
    body_regions,required_equipment,optional_equipment,environment_json,
    population_json,provenance_json,approved_video_url,reviewed_by,approved_by,
    last_reviewed_at,anatomy_json,athlete_support_json,coach_support_json,
    support_operations_json)
  VALUES(
    canonical_definition,1,33,'scapular-push-up',
    'Scapular Push-Up','Scapular Push-Up',
    ARRAY['Scapula Push-Up','Scapular Press-Up','Serratus Push-Up',
      'Scapular Push-Up Plus','Quadruped Scapular Push-Up',
      'Quadruped Scapular Push-Up Hold','Scapular Push-Up Plus Iso Hold'],
    'A four-variant bilateral straight-arm hand-support family that requires exact base and contraction selection. Dynamic variants keep elbows extended while the chest lowers slightly as the scapulae retract, then push the floor away into controlled protraction; one complete retraction-to-protraction cycle is one repetition. Hold variants establish the declared quadruped or high-plank base, push into controlled protraction, and maintain it for measured seconds without elbow motion, body-line loss, shrugging, breath holding, or symptoms. Quadruped uses both hands and knees; high plank uses both hands and toes. A full push-up, push-up plus with elbow flexion, wall or raised support, bear hover, unilateral support, instability, resistance, perturbation, or clinical assessment changes the task.',
    'bilateral_straight_arm_scapular_support_control','2.0.0',2,'review',
    84,58,50,ARRAY['brace','push']::TEXT[],
    ARRAY['hand','wrist','elbow','shoulder','scapula','core','spine','hip','knee','ankle']::TEXT[],
    ARRAY['none']::TEXT[],'{}'::TEXT[],
    jsonb_build_object(
      'surface','clean firm flat dry stable nonslip nonabrasive floor for hand knee or toe contact',
      'space','one stationary floor station plus safe entry and exit',
      'stationCapacity',1,'laneRequired',FALSE,
      'coachSightline','side and rear-oblique views of hands wrists elbows scapulae trunk pelvis knees or toes plus face and breathing',
      'inspection',jsonb_build_array('floor traction dryness cleanliness temperature and debris','hand knee and toe contact area','optional knee cushioning stability','station clearance and cross traffic','communication sightline and safe exit'),
      'changeRule','Changing base dynamic-versus-hold action laterality support height contact surface elbow action scapular path duration load purpose dose or downstream hand-support demand requires full identity duration logistics substitution persistence and rendering revalidation.'),
    jsonb_build_object(
      'exerciseCardDoesNotClassifyParticipants',TRUE,'readinessIsWorkoutInput',TRUE,
      'selectionPrerequisites',jsonb_build_array('safe floor entry exact bilateral hand and knee or toe support and exit','comfortable palm wrist elbow and shoulder contact for the selected base','organized straight-arm scapular and trunk support','can distinguish dynamic cycle from protraction hold and count repetitions or seconds','understands stop and help signal','same-session wrist shoulder pushing trunk and downstream support budgets fit'),
      'excludeOrEscalate',jsonb_build_array('recent significant hand wrist elbow shoulder spine trauma procedure or surgery without applicable clearance','sharp increasing radiating or unfamiliar pain','skin wound or pain with required hand knee or toe contact','new numbness tingling weakness color temperature circulation or limb-control change','chest or breathing concern dizziness faintness nausea visual change or disorientation','surface floor access support communication sightline or safe exit is inadequate','participant requests stop or cannot communicate reliably'),
      'notEstablishedByEvidence',jsonb_build_array('universal eligibility hand width scapular range body line hold duration or support position','universal dose frequency recovery or progression','isolated activation strength readiness injury-prevention treatment or transfer outcome','numeric difficulty calibration or media exactness')),
    jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'canonicalAuthoredFromResearch',TRUE,
      'primaryIdentitySource','https://bmjopensem.bmj.com/content/bmjosem/8/1/e001270/DC1/embed/inline-supplementary-material-1.pdf',
      'legacySources',jsonb_build_array(33,247,853),
      'identityContract','explicit_bilateral_quadruped_or_high_plank_dynamic_scapular_cycle_or_protraction_hold',
      'removedUnrelatedResearchSource','https://pubmed.ncbi.nlm.nih.gov/32707142/',
      'researchSources',jsonb_build_array('https://bmjopensem.bmj.com/content/bmjosem/8/1/e001270/DC1/embed/inline-supplementary-material-1.pdf','https://bmjopensem.bmj.com/content/8/1/e001270','https://www.acefitness.org/resources/everyone/blog/6350/exercises-to-counteract-too-much-sitting/','https://pmc.ncbi.nlm.nih.gov/articles/PMC6863690/','https://pubmed.ncbi.nlm.nih.gov/25881172/','https://pmc.ncbi.nlm.nih.gov/articles/PMC12734928/','https://ohiostate.elsevierpure.com/en/publications/scapula-kinematic-alterations-following-a-modified-push-up-plus-t/','https://static.usagym.org/PDFs/about/wellness/exercise/wrist.pdf'),
      'confidenceBySection',jsonb_build_object('identity',84,'taxonomy',80,'anatomy',78,'difficulty',58,'load',72,'fatigueRecovery',66,'constraints',76,'dosage',58,'instructions',84,'alternates',84,'media',50),
      'unresolvedClaims',jsonb_build_array('one universal scapular range body line force activation hand spacing dose frequency recovery benefit or progression','numeric difficulty calibration','media playback exact variant base action contacts count captions accessibility quality safety and approval'),
      'externalPlaybackVerificationPerformed',FALSE,'sourceLimitationsExplicit',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,'publicationQuarantined',TRUE),
    NULL,NULL,NULL,NULL,
    jsonb_build_object(
      'primaryMuscles',jsonb_build_array('serratus_anterior'),
      'secondaryMuscles',jsonb_build_array('middle_trapezius','lower_trapezius','rhomboid_group','pectoralis_minor'),
      'stabilizers',jsonb_build_array('rotator_cuff','triceps_brachii','anterior_deltoid','wrist_flexor_extensor_groups','deep_spinal_stabilizers','abdominal_wall','gluteal_group','quadriceps'),
      'joints',jsonb_build_array('scapulothoracic_articulation','glenohumeral_joint','elbow','wrist','spinal_segments','hip','knee','ankle'),
      'jointActions',jsonb_build_array('scapular_retraction','scapular_protraction','variant_specific_protraction_isometric','elbow_extension_isometric','shoulder_closed_chain_support','wrist_extension_support','trunk_anti_extension','variant_specific_knee_extension_support'),
      'planes',jsonb_build_array('transverse','sagittal','multiplanar'),
      'laterality','bilateral',
      'contactsAndSequence',jsonb_build_object('quadruped','bilateral_hands_and_knees','highPlank','bilateral_hands_and_toes','dynamic','straight elbows while scapulae retract then protract','hold','straight elbows while declared protraction is maintained for actual seconds'),
      'countingBoundary','one controlled retraction-to-protraction cycle for dynamic variants or actual valid protraction-support seconds for hold variants',
      'rangeRule','Use only a comfortable controlled scapular glide that preserves straight-arm support body line breathing and required contacts; no maximum range is required.',
      'notClaimed',jsonb_build_array('one_measured_muscle_activation_pattern','quantified_joint_force_or_bodyweight_percentage','isolated_serratus_activation','universal_scapular_or_spinal_position','treatment_prevention_or_readiness_effect')),
    jsonb_build_object(
      'whyItMatters','Practices the exact straight-arm scapular cycle or protraction hold selected for this workout without silently adding a push-up or changing base load and count.',
      'primaryCue','Name the variant first: knees or toes, then cycle or hold. Keep elbows straight and move or maintain the shoulder blades while the trunk stays organized.',
      'expectedSensations',jsonb_build_array('light to moderate effort around the shoulder blades and trunk','comfortable wrist and upper-limb support','small controlled chest and scapular position change'),
      'unexpectedSensations',jsonb_build_array('sharp increasing radiating or unfamiliar pain','shoulder pinching or unstable feeling','numbness tingling weakness color temperature or circulation change','dizziness faintness nausea visual change or chest or breathing concern','skin irritation or loss of required contact'),
      'painGuidance','Stop rather than testing symptoms or forcing range. Report the symptom and use facility escalation; this card does not diagnose or treat it.',
      'selfChecks',jsonb_build_array('selected base and dynamic-or-hold action are known','required hands and knees or toes stay supported','elbows stay straight without forced lockout','shoulder blades move smoothly or protraction hold stays exact','trunk and pelvis do not sag pike or rotate','complete cycles or valid seconds are recorded','no stop symptom appears'),
      'accessibility',jsonb_build_array('rear-oblique scapular demonstration','side-view body-line demonstration','three-frame retract-protract or hold card','slower pace fewer repetitions shorter holds and more rest','optional stable knee cushioning for quadruped only','separately authored wall raised-support or non-hand-support task when floor contact does not fit'),
      'mediaAlternatives',jsonb_build_array('captioned transcript after review','still sequence for each exact base and action','coach demonstration from rear-oblique side and front views'),
      'incidentPrompt','Stop, unload the hands safely, make the station safe, record variant contacts symptom first fault actual exposure and downstream work, and escalate under facility policy.'),
    jsonb_build_object(
      'observationChecklist',jsonb_build_array('exact base action and count unit','clean stable hand and lower-body surface','bilateral hand and knee or toe contacts','straight elbows and comfortable wrists','scapular retraction protraction or held protraction','shoulder trunk pelvis knee and ankle support','breathing symptoms first fault actual dose and duration'),
      'faultCorrections',jsonb_build_object('variantMixed','stop reset and select knees or toes plus cycle or hold','elbowBend','reduce range leverage or duration; elbow flexion changes the task','trunkSagPikeOrRotation','use quadruped reduce dose or stop without hiding the base change','shrugOrScapularPathLoss','reduce range or duration and cue push the floor away without forcing','contactLoss','stop or select a separately reviewed support variant','breathHold','reduce effort and restore normal breathing or stop'),
      'demonstrationPlan',jsonb_build_array('show all four variants as separate cards','show hand and lower-body contacts','show side and rear-oblique body line','show one complete cycle or valid hold','show elbow-bend push-up shrug body-line-loss and incomplete-return boundaries','show stop and unload sequence'),
      'groupManagement',jsonb_build_array('one participant per marked floor station','stagger floor entry and exit','coach where scapulae elbows trunk and contacts remain visible','separate current variant cards and records','sanitize shared hand-contact areas under facility policy'),
      'modificationDecisionTree',jsonb_build_array('If only pace range repetitions seconds or rest changes keep the exact variant and record dose.','If base support height laterality contact elbow action contraction mode instability or load changes select a separately authored task.','If exact support cannot be maintained reduce leverage or stop rather than changing action silently.','If symptoms or scope concerns appear stop and escalate without diagnosis.'),
      'doNotUseWhen',jsonb_build_array('floor transfer or required hand wrist elbow shoulder knee toe or trunk support is unsafe','skin upper-limb neurologic circulation or cardiopulmonary symptoms conflict','surface clearance sightline communication hygiene or safe exit is inadequate','fatigue prevents exact scapular action support count or breathing','the intended task is a full push-up push-up-plus pressing task wall or raised support unilateral instability resistance perturbation or assessment'),
      'comprehensionQuestions',jsonb_build_array('Which base and action are you doing?','Which contacts stay down?','Are you counting repetitions or seconds?','When do you stop?')),
    jsonb_build_object(
      'issueCategories',jsonb_build_array('identity_or_variant','content_or_cue','difficulty_or_dose','surface_or_station','accessibility','media','symptom_or_incident','data_or_persistence'),
      'supportEscalation',jsonb_build_object('coach','correct exact variant setup dose and station within scope','facilityLead','quarantine repeated content surface media or data failures','clinicalOrEmergency','follow facility policy for red flags neurologic circulation cardiopulmonary severe pain trauma or urgent symptoms'),
      'retentionPolicy','Store definition and card version, exact base and action, planned and actual repetitions or valid hold seconds, scapular range, support seconds, contacts, tempo, rests, invalid or partial attempts, first fault, symptoms, stop reason, substitution, duration, station incident, coach edits, and rendering version under facility policy.',
      'changeImpactPolicy','Any change to base dynamic-or-hold action count unit laterality contact support height elbow action scapular path instability resistance dose stop rules media or graph invalidates prior rendering and requires revalidation and review.',
      'knownLimitations',jsonb_build_array('candidate research is not content approval','oEmbed is not playback or exactness review','difficulty and recovery values are unapproved planning estimates','four variants require explicit UI and persistence labels'),
      'feedbackQuestions',jsonb_build_array('Were base and action unmistakable?','Could coach and athlete identify contacts and count unit alike?','Were surface duration and load controls accurate?','Were stop and substitution choices actionable?')))
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
  SELECT v.id,canonical_definition,v.variant_key,v.display_name,v.modifiers,
    jsonb_build_object(
      'technicalComplexity',v.complexity,'absoluteLoadDemand',v.physical,
      'physicalDifficulty',v.physical,'coordinationDemand',v.complexity,
      'supervisionDemand',v.supervision,'failureConsequence',v.consequence,
      'impact',1,'workCapacityDemand',v.work_capacity,
      'baseOverallDifficulty',greatest(v.complexity,v.physical),
      'overallFormula','max(exercise_complexity,physical_difficulty)',
      'scoresDescribeExerciseTaskOnly',TRUE,
      'independentCalibrationRequired',TRUE),
    jsonb_build_object(
      'selectable',TRUE,'base',v.base,
      'action',v.action,'supportContacts',v.contacts,
      'countUnit',v.count_unit,'countRule',v.count_rule,
      'validCompletion',v.valid_completion,
      'mustMaintain',jsonb_build_array('clean_firm_nonslip_nonabrasive_surface',
        'variant_specific_bilateral_lower_body_contacts',
        'elbows_extended_without_forced_lockout',
        'organized_shoulders_scapula_trunk_and_pelvis',
        'comfortable_wrist_and_hand_position','bilateral_hand_contact',
        'variant_specific_scapular_action_and_body_line',
        'normal_breathing_and_communication'),
      'mustNotAdd',jsonb_build_array('other_source_33_base_or_action',
        'elbow_flexion_or_full_push_up','wall_incline_or_raised_support',
        'bear_hover_or_single_leg_support','unilateral_emphasis',
        'unstable_surface_or_perturbation','band_or_external_load',
        'manual_force_or_clinical_assessment'),
      'invalidWhen',jsonb_build_array('base_or_action_mixes',
        'required_contact_or_support_is_lost','elbows_bend',
        'trunk_sags_pikes_or_rotates','scapular_path_or_hold_is_lost',
        'dynamic_return_or_required_hold_seconds_are_missing',
        'stop_rule_occurs')),
    'review',
    jsonb_build_object(
      'gripDemand',v.grip,'spinalLoading',6,'eccentricStress',v.eccentric,
      'landingContactsPerRep',0,'externalLoadMethod','partial_bodyweight',
      'impactClass','none','handSupport',TRUE,
      'handSupportSecondsPerRepPlanning',v.support_seconds,
      'primaryExposure',v.exposure,
      'loadBasis','body mass distribution through the selected bilateral quadruped or high-plank base with straight-arm hand support; no universal bodyweight percentage or force is claimed'),
    jsonb_build_object(
      'localMuscleFatigue',v.local_fatigue,'gripFatigue',v.grip,
      'technicalFatigueSensitivity',v.complexity,'impactAccumulation',1,
      'recoveryHours',v.recovery,'primaryFatigueSites',v.fatigue_sites,
      'cumulativeBudgetKeys',jsonb_build_array('complete_scapular_cycles',
        'valid_protraction_hold_seconds','plank_support_seconds',
        'hand_support_seconds','wrist_extension_support_seconds',
        'straight_arm_shoulder_support_seconds','elbow_bend_or_scapular_path_faults',
        'body_line_faults','floor_transfers','technical_faults','impact_contacts'),
      'downstreamInterference',jsonb_build_array(
        'same_session_tumbling_handstand_cartwheel_or_crawling',
        'push_up_dip_press_or_overhead_volume',
        'grip_hanging_climbing_or_ninja_volume',
        'wrist_elbow_shoulder_or_trunk_support_loading'),
      'recoveryBasis','planning estimate only; symptoms technique and overlapping same-session and recent wrist shoulder pushing trunk and hand-support exposure govern selection'),
    jsonb_build_object(
      'trainingStimuli',v.training_stimuli,
      'stimulusDose',jsonb_build_object('sets',jsonb_build_array(1,2),
        'completeRepetitionsOrValidHoldSeconds',
          CASE WHEN v.count_unit='complete_repetitions'
            THEN jsonb_build_array(4,12) ELSE jsonb_build_array(5,20) END,
        'secondsPerDynamicRepetition',jsonb_build_array(2,4),
        'restSeconds',jsonb_build_array(30,75)),
      'weeklyExposure',jsonb_build_object('minimum',0,
        'maximumWithoutReview',7,'unit','sessions','contextDependent',TRUE),
      'prerequisites',jsonb_build_array(
        'safe_floor_entry_exact_bilateral_hand_and_lower_body_support_and_exit',
        'comfortable_selected_hand_wrist_elbow_and_shoulder_contacts',
        'organized_straight_arm_scapular_trunk_and_pelvic_support',
        'understands_selected_base_action_count_unit_and_stop_signal',
        'same_session_wrist_shoulder_pushing_trunk_and_hand_support_budgets_fit'),
      'completionCriteria',v.completion_criteria,
      'sequenceRules',jsonb_build_array(
        'prepare_or_resilience_context_only',
        'select_one_exact_base_and_action_and_use_its_count_unit',
        'do_not_hide_base_contact_elbow_action_contraction_laterality_support_load_or_assessment_changes_as_modifiers',
        'revalidate_downstream_wrist_shoulder_pushing_trunk_and_hand_support_loading'),
      'pairingCompatibility',jsonb_build_object(
        'compatible',jsonb_build_array(
          'quality_first_hand_support_preparation_when_budgets_fit',
          'light_non_hand_support_movement_after_safe_floor_exit'),
        'avoid',jsonb_build_array(
          'symptom_provoking_hand_wrist_elbow_or_shoulder_loading',
          'fatiguing_tumbling_handstand_cartwheel_crawling_push_up_press_dip_or_overhead_loading',
          'time_critical_output_when_the_drill_displaces_priority_work')),
      'interferenceRules',jsonb_build_array(
        'count_all_overlapping_scapular_cycles_and_protraction_hold_seconds',
        'count_all_overlapping_hand_wrist_straight_arm_and_plank_support_seconds_and_floor_transfers',
        'count_later_tumbling_handstand_cartwheel_crawling_push_up_press_dip_overhead_grip_hanging_and_climbing',
        'stop_before_contact_scapular_path_body_line_support_or_breathing_quality_changes'),
      'uncertaintyPolicy','When exact base dynamic-or-hold action contacts wrist or shoulder tolerance symptoms downstream loading or available time is uncertain do not select; request clarification or choose a separately validated card.',
      'selectionStatus','candidate_review_only','selectable',TRUE,
      'phaseRoles',jsonb_build_array('prepare_and_access','resilience'),
      'selectionInputs',jsonb_build_array('workout objective','exact base dynamic-or-hold action contacts and count unit','floor transfer and bilateral hand support','wrist elbow shoulder scapular and trunk tolerance','clean firm nonabrasive surface','dose duration and cumulative budgets','downstream hand support pushing and overhead work','coach sightline and scope'),
      'doseVariables',jsonb_build_array('complete_repetitions_or_valid_hold_seconds','scapular_range','tempo','sets','rest_seconds'),
      'durationFormula','setup_and_briefing_seconds + sum(actual_dynamic_cycle_or_valid_hold_seconds) + rests + invalid_partial_symptom_or_substitution_seconds + station_reset_seconds',
      'substitutionRevalidation',jsonb_build_array('identity_base_action_contacts_and_count_unit','laterality_support_height_elbow_action_and_contraction_mode','scapular_path_instability_resistance_or_external_force','restrictions_symptoms_and_body_line','surface_floor_access_and_sightline','dose_actual_duration_and_cumulative_budgets','downstream_interference','persistence','coach_rendering','athlete_rendering'),
      'publicationQuarantined',TRUE,'humanReviewRequired',TRUE,
      'approvalsCreated',FALSE)
  FROM (VALUES
    (quadruped_dynamic,
      'quadruped-straight-arm-retraction-protraction-cycle',
      'Scapular Push-Up — Quadruped Dynamic Cycle',
      ARRAY['quadruped','bilateral','dynamic','straight_arm_scapular_cycle']::TEXT[],
      24,18,22,20,14,8,6,18,3,12,
      'bilateral_hands_and_knees',
      'straight_arm_scapular_retraction_then_protraction',
      jsonb_build_array('bilateral_palms_and_fingers','bilateral_knees'),
      'complete_repetitions',
      'one controlled scapular retraction and chest-lower phase followed by complete protraction and return to the declared start',
      'hands and knees remain supported elbows stay straight trunk stays organized and the scapulae retract then protract without a push-up shrug or forced range',
      jsonb_build_array('scapular_retraction_and_protraction','wrist_and_straight_arm_support','trunk_anti_extension'),
      jsonb_build_array('serratus_and_scapular_control','wrist_and_hand_support','triceps','shoulder_girdle','trunk'),
      jsonb_build_array('quadruped_scapular_cycle_control','straight_arm_support_awareness','retraction_protraction_counting'),
      jsonb_build_array('exact_bilateral_quadruped_base','elbows_remain_straight','controlled_retraction_without_collapse','complete_protraction_without_shrug','organized_trunk_and_pelvis','no_stop_symptoms')),
    (plank_dynamic,
      'high-plank-straight-arm-retraction-protraction-cycle',
      'Scapular Push-Up — High-Plank Dynamic Cycle',
      ARRAY['high_plank','bilateral','dynamic','straight_arm_scapular_cycle']::TEXT[],
      32,30,28,28,22,12,10,28,4,18,
      'bilateral_hands_and_toes',
      'straight_arm_scapular_retraction_then_protraction',
      jsonb_build_array('bilateral_palms_and_fingers','bilateral_toes'),
      'complete_repetitions',
      'one controlled scapular retraction and chest-lower phase followed by complete protraction and return to the declared high-plank start',
      'hands and toes remain supported elbows stay straight whole-body plank stays organized and the scapulae retract then protract without a push-up shrug sag pike or forced range',
      jsonb_build_array('scapular_retraction_and_protraction','wrist_and_straight_arm_support','long_lever_plank_support'),
      jsonb_build_array('serratus_and_scapular_control','wrist_and_hand_support','triceps','shoulder_girdle','abdominal_wall','glutes','quadriceps'),
      jsonb_build_array('high_plank_scapular_cycle_control','straight_arm_long_lever_support','retraction_protraction_counting'),
      jsonb_build_array('exact_bilateral_high_plank_base','elbows_remain_straight','controlled_retraction_without_collapse','complete_protraction_without_shrug','organized_head_trunk_pelvis_and_legs','no_stop_symptoms')),
    (quadruped_hold,
      'quadruped-straight-arm-protraction-hold',
      'Scapular Push-Up — Quadruped Protraction Hold',
      ARRAY['quadruped','bilateral','isometric','protraction_hold']::TEXT[],
      22,18,20,20,16,8,6,18,1,12,
      'bilateral_hands_and_knees',
      'straight_arm_scapular_protraction_isometric_hold',
      jsonb_build_array('bilateral_palms_and_fingers','bilateral_knees'),
      'valid_hold_seconds',
      'count only actual seconds with controlled protraction straight elbows required contacts organized trunk and normal breathing',
      'hands and knees remain supported while controlled scapular protraction is held without elbow bend shrug trunk shift breath hold or symptom',
      jsonb_build_array('scapular_protraction_isometric','wrist_and_straight_arm_support','trunk_anti_extension'),
      jsonb_build_array('serratus_and_scapular_endurance','wrist_and_hand_support','triceps','shoulder_girdle','trunk'),
      jsonb_build_array('quadruped_protraction_position_ownership','straight_arm_support_endurance','valid_hold_time_awareness'),
      jsonb_build_array('exact_bilateral_quadruped_base','elbows_remain_straight','controlled_protraction_without_shrug','organized_trunk_and_pelvis','normal_breathing','no_stop_symptoms')),
    (plank_hold,
      'high-plank-straight-arm-protraction-hold',
      'Scapular Push-Up — High-Plank Protraction Hold',
      ARRAY['high_plank','bilateral','isometric','protraction_hold']::TEXT[],
      28,30,28,28,24,12,8,30,1,18,
      'bilateral_hands_and_toes',
      'straight_arm_scapular_protraction_isometric_hold',
      jsonb_build_array('bilateral_palms_and_fingers','bilateral_toes'),
      'valid_hold_seconds',
      'count only actual seconds with controlled protraction straight elbows required contacts whole-body plank and normal breathing',
      'hands and toes remain supported while controlled scapular protraction and high-plank body line are held without elbow bend shrug sag pike rotation breath hold or symptom',
      jsonb_build_array('scapular_protraction_isometric','wrist_and_straight_arm_support','long_lever_plank_support'),
      jsonb_build_array('serratus_and_scapular_endurance','wrist_and_hand_support','triceps','shoulder_girdle','abdominal_wall','glutes','quadriceps'),
      jsonb_build_array('high_plank_protraction_position_ownership','straight_arm_long_lever_support_endurance','valid_hold_time_awareness'),
      jsonb_build_array('exact_bilateral_high_plank_base','elbows_remain_straight','controlled_protraction_without_shrug','organized_head_trunk_pelvis_and_legs','normal_breathing','no_stop_symptoms'))
  ) v(id,variant_key,display_name,modifiers,complexity,physical,supervision,
      consequence,work_capacity,grip,eccentric,local_fatigue,support_seconds,
      recovery,base,action,contacts,count_unit,
      count_rule,valid_completion,exposure,fatigue_sites,training_stimuli,
      completion_criteria)
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
  SELECT p.id,p.variant_id,p.profile_key,p.phase_key,'primary',p.purpose,
    p.suitability,p.alignment,p.objectives,
    jsonb_build_object('sets',p.sets,
      CASE WHEN p.count_unit='complete_repetitions'
        THEN 'completeRepetitions' ELSE 'workSeconds' END,p.dose,
      'tempo',CASE WHEN p.count_unit='complete_repetitions'
        THEN 'controlled two to four seconds per complete cycle'
        ELSE 'controlled continuous support with normal breathing' END,
      'restSeconds',p.rest,'rpeCeiling',p.rpe,
      'countRule',p.count_rule,
      'invalidOrPartialAttempts','record but do not count'),
    p.quality_gate,
    ARRAY[
      'Stop for sharp, increasing, radiating, unfamiliar, hand, wrist, elbow, shoulder, neck, or back pain, shoulder pinching or instability, or participant request.',
      'Stop for numbness, tingling, weakness, color, temperature, circulation, or limb-control change.',
      'Stop for chest or breathing concern, dizziness, faintness, nausea, visual change, or inability to communicate.',
      'Stop when required hand, knee or toe, wrist, straight-elbow, scapular, trunk, pelvis, surface, or floor-transfer control is lost.',
      'Stop at the planned repetition, valid-hold, hand-support, straight-arm, plank, technical-fatigue, duration, or downstream-interference budget.'
    ]::TEXT[],
    p.coach,p.athlete,
    'Improved familiarity and repeatable control for the exact selected straight-arm scapular cycle or protraction hold in this workout context; no isolated tissue effect treatment prevention clearance structural change or transfer outcome is promised.',
    ARRAY['none']::TEXT[],
    jsonb_build_object('participantsPerStation',1,
      'stationType','fixed_floor_station','laneRequired',FALSE,
      'minimumSpace','one full-body floor station plus safe entry and exit',
      'setupSeconds',22,'transitionSeconds',10,'resetSeconds',8,
      'throughputRule','One athlete moves while the coach preserves rear-oblique and side sightlines of scapulae elbows body line and contacts; stagger floor entry and exit.',
      'surfaceRule','Clean firm flat dry stable nonslip nonabrasive hand and lower-body surface; optional stable cushioning is under knees only for quadruped variants.',
      'coachSightline','Rear-oblique and side views of wrists elbows shoulders scapulae trunk pelvis and knee or toe support plus breathing.',
      'equipmentInspection',jsonb_build_array('none sentinel declared','clean firm nonabrasive floor surface','optional quadruped knee mat only','station clearance and cross traffic','communication and safe exit'),
      'accessibility','Use separate base and action cards, still sequences, slower cycles, shorter holds, fewer sets, more rest, or a separately authored raised-support alternative.'),
    '{}'::UUID[],'review',
    jsonb_build_object('formula','setup + briefing + sum(actual selected action and return seconds) + rest + invalid partial symptom substitution and reset seconds','estimatedSecondsPerRepetition',p.seconds_per_rep,'estimatedSetupSeconds',22,'estimatedTransitionSeconds',10,'estimatedResetSeconds',8,'mustPersistActualDuration',TRUE,'recomputeAfterSubstitution',TRUE),
    jsonb_build_object('scaleDown',jsonb_build_array('reduce complete cycles or valid hold seconds','reduce scapular range while preserving exact action','select the authored quadruped variant after full revalidation','slow the cycle or shorten the hold','increase rest','add stable knee cushioning for quadruped only'),'scaleUp',jsonb_build_array('add cycles or valid seconds within budget','select the authored high-plank variant after full revalidation','increase only comfortable scapular range within control'),'neverSilentScale',jsonb_build_array('switch base or dynamic-versus-hold action','change laterality support height elbow action or count unit','add instability resistance perturbation full push-up or clinical assessment'),'revalidateAfterAnyChange',TRUE),
    jsonb_build_object('primaryUnit',p.count_unit,'record',jsonb_build_array('variant','planned_and_actual_complete_cycles_or_valid_hold_seconds','scapular_range','hand_wrist_straight_arm_and_plank_support_seconds','required_contact_faults','elbow_scapular_trunk_and_body_line_faults','tempo','rests','invalid_or_partial_attempts','floor_transfers','first_fault','symptoms','stop_reason','substitution','actual_duration'),'budgetAggregation',jsonb_build_array('complete_scapular_cycles','valid_protraction_hold_seconds','hand_support_seconds','wrist_support_seconds','straight_arm_shoulder_support_seconds','plank_support_seconds','support_faults','floor_transfers','technical_fatigue','impact_contacts','downstream_pushing_and_hand_support_work'),'invalidAttemptPolicy','Store invalid and partial cycles or hold seconds separately and exclude them from completed dose.'),
    jsonb_build_object('preSession',jsonb_build_array('Confirm exact base action count unit required contacts and clean surface.','Check floor transfer wrist elbow shoulder hand-support symptoms and downstream budgets.'),'during',jsonb_build_array('Watch straight elbows scapular path body line and the first support or breathing fault.','Count only complete dynamic cycles or actual valid hold seconds and track support time.','Stop rather than forcing range duration or testing symptoms.'),'after',jsonb_build_array('Record actual cycles or seconds range support exposure first fault symptoms stops and substitutions.','Escalate content media safety or persistence issues under facility policy.'),'helpSignal','Athlete lowers the knees when safe, unloads the hands, stops, and asks for coach help; coach assists only within scope.')
  FROM (VALUES
    ('63699b96-42fd-4813-9102-83caf5d44f2e'::UUID,quadruped_dynamic,
      'prepare-quadruped-dynamic-scapular-cycle','prepare_and_access',
      'Quality-first quadruped straight-arm scapular cycle practice before compatible hand-support work.',84,86,
      jsonb_build_object('scapular_access',90,'straight_arm_support_preparation',86,'controlled_activation',84),
      1,6,40,3,
      'Count one only after controlled retraction and complete protraction with straight elbows, exact contacts, organized trunk, and no stop event.',
      'Hands and knees stay down; elbows stay straight; the chest lowers only through scapular retraction and returns through protraction without shrugging, collapse, or symptoms.',
      'Verify quadruped dynamic selection, surface, wrists, elbows, shoulders, straight-arm support, and downstream budget. Cue shoulder blades together then push the floor away; stop at the first fault.',
      'Hands and knees. Keep elbows straight. Let your shoulder blades come together, then push the floor away. That is one. Stop for pain, pinching, tingling, dizziness, or lost shape.',3,'complete_repetitions'),
    ('cb7e65d3-53b2-4c0b-99c2-7446e2b4e7f3'::UUID,quadruped_dynamic,
      'resilience-quadruped-dynamic-scapular-cycle','resilience',
      'Repeatable quadruped scapular cycle control and straight-arm support within conservative cumulative budgets.',78,84,
      jsonb_build_object('scapular_control',90,'straight_arm_endurance',82,'hand_support_resilience',82),
      2,10,60,5,
      'Count only complete retraction-to-protraction cycles with straight elbows, exact support, repeatable range, and no trunk or symptom fault.',
      'Every counted cycle preserves hands and knees, straight elbows, controlled scapular glide, organized trunk and pelvis, normal breathing, and the declared return.',
      'Watch range, elbow angle, trunk, pelvis, breath, first fault, actual duration, and later hand-support work. End the set before quality or budget changes.',
      'Stay on hands and knees. Move only your shoulder blades, keep the rest quiet, and finish each push-away. Stop before your elbows bend or body shape changes.',3,'complete_repetitions'),
    ('9396f3ef-5597-47de-8773-1bace3c9963e'::UUID,plank_dynamic,
      'prepare-high-plank-dynamic-scapular-cycle','prepare_and_access',
      'Low-volume high-plank scapular cycle practice when long-lever hand-support exposure fits the workout.',76,82,
      jsonb_build_object('high_plank_access',84,'scapular_control',88,'controlled_activation',78),
      1,5,45,4,
      'Count one only after a controlled straight-arm retraction-to-protraction cycle with hands and toes down and the whole-body plank unchanged.',
      'Hands and toes stay down; elbows stay straight; head, trunk, pelvis, and legs remain organized while the scapulae glide and return without symptoms.',
      'Confirm high-plank dynamic selection and current pushing load. Watch elbows, scapulae, trunk, pelvis, legs, breath, and first fault; stop before fatigue changes the body line.',
      'Hands and toes. Keep a long body line and straight elbows. Let the shoulder blades come together, then push the floor away. Stop for pain, pinching, tingling, dizziness, or sagging.',4,'complete_repetitions'),
    ('46541057-e509-4caf-90d1-35ccf4e8f52e'::UUID,plank_dynamic,
      'resilience-high-plank-dynamic-scapular-cycle','resilience',
      'Repeatable high-plank scapular cycles with long-lever trunk and straight-arm support controlled before technical fatigue.',72,82,
      jsonb_build_object('scapular_control',88,'long_lever_support',86,'hand_support_resilience',84),
      2,8,75,6,
      'Count only complete straight-arm scapular cycles with unchanged high-plank contacts and body line; any push-up, sag, pike, shrug, or incomplete protraction does not count.',
      'Every counted cycle preserves hands and toes, straight elbows, repeatable scapular glide, full-body organization, normal breathing, and the declared return.',
      'Use only when cumulative wrist, shoulder, pressing, trunk, and hand-support budgets fit. Track actual support time and stop at the first repeated range, elbow, body-line, or breath fault.',
      'Keep the plank quiet while the shoulder blades move. Count only the full push-away and stop before your elbows bend, hips move, or breathing changes.',4,'complete_repetitions'),
    ('3b4460f8-6eb7-4e1f-8732-90895629ade7'::UUID,quadruped_hold,
      'prepare-quadruped-protraction-hold','prepare_and_access',
      'Brief quadruped protraction-position practice with measured valid seconds and normal breathing.',82,84,
      jsonb_build_object('protraction_access',90,'straight_arm_support_preparation',84,'controlled_activation',82),
      1,8,40,3,
      'Count only seconds with hands and knees down, elbows straight, controlled protraction, organized trunk and pelvis, and normal breathing.',
      'The declared protraction position stays repeatable without shrugging, elbow bend, trunk shift, contact loss, breath hold, or symptoms.',
      'Verify quadruped hold selection and count actual valid seconds only. Watch scapular position, elbows, trunk, pelvis, breath, symptoms, and downstream budget.',
      'Hands and knees. Push the floor away and hold that shoulder-blade position while breathing. Stop when your elbows or body shape change.',1,'valid_hold_seconds'),
    ('f3ef27c6-e6db-4f19-a45e-85a8df982751'::UUID,quadruped_hold,
      'resilience-quadruped-protraction-hold','resilience',
      'Quadruped straight-arm protraction endurance with actual valid time and technical-failure limits.',76,82,
      jsonb_build_object('protraction_endurance',88,'straight_arm_endurance',84,'hand_support_resilience',80),
      2,15,60,5,
      'Count only valid protraction-support seconds before the first elbow, scapular, trunk, contact, breath, symptom, or budget fault.',
      'Hands and knees remain exact and protraction, straight elbows, trunk, pelvis, and breathing stay repeatable for every recorded second.',
      'Track actual valid seconds, total hand-support time, first fault, symptoms, and later pressing or hand-support work. End before position quality declines.',
      'Push the floor away and breathe. The hold ends as soon as your shoulder blades, elbows, hips, or breathing change.',1,'valid_hold_seconds'),
    ('16dfe81e-c619-4d01-b80d-c7c8c72153d3'::UUID,plank_hold,
      'prepare-high-plank-protraction-hold','prepare_and_access',
      'Brief high-plank protraction-position practice when long-lever support and downstream exposure fit.',74,80,
      jsonb_build_object('high_plank_access',82,'protraction_control',88,'controlled_activation',76),
      1,6,45,4,
      'Count only seconds with hands and toes down, elbows straight, controlled protraction, unchanged body line, and normal breathing.',
      'The protracted high-plank position stays repeatable without shrugging, sagging, piking, rotation, elbow bend, contact loss, breath hold, or symptoms.',
      'Confirm high-plank hold selection and count actual valid seconds only. Watch elbows, scapulae, full body line, breath, symptoms, and cumulative support budget.',
      'Hands and toes. Push the floor away, keep a long body line, and breathe. Stop when your elbows, hips, shoulders, or breathing change.',1,'valid_hold_seconds'),
    ('81e8a612-1fd8-4203-b17d-363c94cabc9c'::UUID,plank_hold,
      'resilience-high-plank-protraction-hold','resilience',
      'High-plank protraction and whole-body support endurance with actual valid time and strict technical limits.',70,80,
      jsonb_build_object('protraction_endurance',88,'long_lever_support',88,'hand_support_resilience',84),
      2,12,75,6,
      'Count only valid high-plank protraction seconds before the first elbow, scapular, body-line, contact, breath, symptom, or budget fault.',
      'Hands and toes remain exact and protraction, straight elbows, head-to-heel line, and breathing stay repeatable for every recorded second.',
      'Track actual valid seconds, total straight-arm and plank support, first fault, symptoms, and downstream pushing work. End before fatigue changes the position.',
      'Push the floor away and keep the whole plank quiet while breathing. The hold ends as soon as your shoulder blades, elbows, hips, legs, or breathing change.',1,'valid_hold_seconds')
  ) p(id,variant_id,profile_key,phase_key,purpose,suitability,alignment,
      objectives,sets,dose,rest,rpe,count_rule,quality_gate,coach,athlete,
      seconds_per_rep,count_unit)
  ON CONFLICT(id) DO UPDATE SET
    variant_id=EXCLUDED.variant_id,profile_key=EXCLUDED.profile_key,
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
    support_prompts_json=EXCLUDED.support_prompts_json,updated_at=now();

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by,resolved_at)
  VALUES
    (1,canonical_definition,push_up_definition,'distinct_exercises',
      'A Scapular Push-Up keeps the elbows straight and counts a scapular retraction-protraction cycle or a protraction hold. A Push-Up requires elbow flexion and extension with whole-body lowering and pressing; a push-up plus adds protraction after the press.',
      jsonb_build_object('migration',migration_key,
        'identityBoundary','straight_arm_scapular_cycle_or_hold_vs_elbow_flexion_extension_push_up',
        'changedDimensions',jsonb_build_array('elbow_action','whole_body_vertical_displacement','count_boundary','loading','fatigue'),
        'decisionScope','identity_only_not_media_graph_calibration_content_or_publication_approval',
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_identity_equivalence',NULL,now())
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,
    resolved_at=now();

  INSERT INTO coaching.exercise_section_evidence_v1(
    definition_id,reviewed_card_version,section_key,source_url,source_title,
    source_publisher,source_kind,claims_json,evidence_quality,review_status,
    reviewer_user_id,reviewed_at)
  SELECT canonical_definition,2,e.section_key,e.source_url,e.source_title,
    e.publisher,e.source_kind,jsonb_build_array(
      jsonb_build_object('supported',e.supported_claim,'scope',e.scope),
      jsonb_build_object('limitation',e.limitation,
        'noUniversalTechniqueSafetyEligibilityDoseRecoveryOutcomeOrDifficultyClaim',TRUE)),
    e.quality,'candidate',NULL,NULL
  FROM (VALUES
    ('identity','https://bmjopensem.bmj.com/content/bmjosem/8/1/e001270/DC1/embed/inline-supplementary-material-1.pdf','Shoulder ABC Prevention Exercises','BMJ Open Sport & Exercise Medicine','peer_reviewed_research','The exercise sheet defines a scapular push-up as a push-up position with straight elbows while the shoulder blades are pinched together and pushed forward.','direct dynamic identity and action context','It does not define every Vortex base hold duration count boundary or identity decision.',88),
    ('taxonomy','https://www.acefitness.org/resources/everyone/blog/6350/exercises-to-counteract-too-much-sitting/','Exercises to Counteract Too Much Sitting','American Council on Exercise','professional_standard','ACE describes a supported straight-elbow scapular retraction and protraction exercise rather than a full elbow-bending push-up.','direct support and action context','The source does not create Vortex movement-pattern or body-region taxonomy keys.',86),
    ('anatomy','https://pmc.ncbi.nlm.nih.gov/articles/PMC6863690/','Serratus Anterior and Upper Trapezius Electromyographic Analysis of the Push-Up Plus Exercise','Journal of Athletic Training','peer_reviewed_research','The review supports serratus anterior and upper-trapezius involvement and reports that hand, elbow, shoulder, lower-body, and surface choices change EMG findings.','anatomy and variant context','EMG findings across push-up-plus studies do not prove isolated activation or one pattern for all four Vortex variants.',92),
    ('biomechanics','https://pmc.ncbi.nlm.nih.gov/articles/PMC12734928/','Electromyographic Patterns of Scapular Muscles During Four Variations of Protraction–Retraction Exercises','Healthcare','peer_reviewed_research','The study explicitly compares quadruped protraction-retraction tasks and distinguishes push-up-plus and sternum-drop execution conditions.','direct quadruped action and adjacent biomechanics context','A small EMG study cannot define universal technique force outcomes or dose for the Vortex card.',86),
    ('difficulty','https://pubmed.ncbi.nlm.nih.gov/25881172/','The effects of exercise type and elbow angle on vertical ground reaction force and muscle activity during a push-up plus exercise','Journal of Sports Science & Medicine','peer_reviewed_research','Traditional hands-and-feet support produced higher vertical ground reaction force and tested muscle activity than modified hands-and-knees support.','relative physical-demand context','The study assigns no Vortex score and does not classify participant capability or validate hold variants.',86),
    ('load_fatigue_recovery','https://ohiostate.elsevierpure.com/en/publications/scapula-kinematic-alterations-following-a-modified-push-up-plus-t/','Scapula kinematic alterations following a modified push-up plus task','Human Movement Science','peer_reviewed_research','A sustained protraction hold in a push-up position produced measurable shoulder-muscle fatigue and altered some scapular kinematics in asymptomatic adults.','fatigue and cumulative-duration context','The study does not validate Vortex thresholds recovery hours injury causation or universal hold duration.',86),
    ('constraints','https://static.usagym.org/PDFs/about/wellness/exercise/wrist.pdf','Suggested Gymnastics Wrist Exercises','USA Gymnastics','governing_body','USA Gymnastics advises medical guidance when pain is present, discontinuing painful exercise, and reducing work when form fails.','hand-support symptom and quality context','The document does not create an age eligibility rule shoulder diagnosis clearance or universal wrist-loading threshold.',88),
    ('dosage','https://bmjopensem.bmj.com/content/bmjosem/8/1/e001270/DC1/embed/inline-supplementary-material-1.pdf','Shoulder ABC Prevention Exercises','BMJ Open Sport & Exercise Medicine','peer_reviewed_research','The programme gives example blocks of two to three sets of eight to ten repetitions or twenty seconds and presents knee lift-off as a harder alternative.','limited example-dose and progression context','Programme doses are not universal prescriptions and do not validate Vortex fatigue budgets or recovery estimates.',88),
    ('instructions','https://bmjopensem.bmj.com/content/bmjosem/8/1/e001270/DC1/embed/inline-supplementary-material-1.pdf','Shoulder ABC Prevention Exercises','BMJ Open Sport & Exercise Medicine','peer_reviewed_research','The direct instruction is push-up position, straight elbows, shoulder blades together, then push them forward.','direct dynamic instruction context','The sheet does not define every Vortex body-line gate hold rule stop rule or persistence field.',88),
    ('safety_stop_rules','https://static.usagym.org/PDFs/about/wellness/exercise/wrist.pdf','Suggested Gymnastics Wrist Exercises','USA Gymnastics','governing_body','USA Gymnastics says to seek medical guidance when pain is present discontinue painful exercise and reduce work when form fails.','direct safety and quality context','The document does not replace facility emergency neurologic circulation trauma or clinical escalation policy.',88),
    ('programming','https://bmjopensem.bmj.com/content/8/1/e001270','Multicomponent stretching and rubber band strengthening exercises do not reduce overuse shoulder injuries','BMJ Open Sport & Exercise Medicine','peer_reviewed_research','The cluster randomized trial found that its multicomponent programme did not significantly reduce throwing-shoulder overuse prevalence or symptoms.','outcome uncertainty and programming-scope context','The trial does not isolate the scapular push-up or support prevention treatment readiness or guaranteed transfer claims.',92),
    ('athlete_support','https://www.acefitness.org/resources/everyone/blog/6350/exercises-to-counteract-too-much-sitting/','Exercises to Counteract Too Much Sitting','American Council on Exercise','professional_standard','ACE gives a concise straight-elbow shoulder-blade-together then apart instruction and identifies elbow bending as the key execution challenge.','participant communication context','It does not establish universal sensation meaning eligibility dose or every accessibility need.',86),
    ('coach_support','https://pmc.ncbi.nlm.nih.gov/articles/PMC6863690/','Serratus Anterior and Upper Trapezius Electromyographic Analysis of the Push-Up Plus Exercise','Journal of Athletic Training','peer_reviewed_research','The review reports that base, hand spacing, elbow angle, shoulder angle, lower-body position, and surface alter observed muscle activity.','coach observation and variant-boundary context','It does not prescribe Vortex corrections diagnose dysfunction or validate all graph relationships.',92),
    ('accessibility','https://www.acefitness.org/resources/everyone/blog/6350/exercises-to-counteract-too-much-sitting/','Exercises to Counteract Too Much Sitting','American Council on Exercise','professional_standard','ACE demonstrates that a stable raised support can host a related straight-elbow scapular action.','alternative-access context','Raised support changes load height equipment and identity and must not be silently substituted for a floor variant.',86),
    ('alternates','https://pubmed.ncbi.nlm.nih.gov/25881172/','The effects of exercise type and elbow angle on vertical ground reaction force and muscle activity during a push-up plus exercise','Journal of Sports Science & Medicine','peer_reviewed_research','Hands-and-knees and hands-and-feet bases create materially different loading while elbow position also changes the task.','base and elbow-action boundary context','The study does not adjudicate all Vortex alternates or approve graph edges.',86),
    ('media','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en','Embed videos and playlists','YouTube Help','manufacturer_instruction','Five candidates returned current YouTube oEmbed title channel thumbnail and iframe metadata on 2026-08-09.','candidate metadata and privacy-enhanced embed format only','oEmbed does not prove playback exact variant base contacts action count captions accessibility cue quality safety conflicts reviewer card-version match or approval.',82)
  ) e(section_key,source_url,source_title,publisher,source_kind,
      supported_claim,scope,limitation,quality)
  ON CONFLICT(definition_id,reviewed_card_version,section_key,source_url)
  DO UPDATE SET source_title=EXCLUDED.source_title,
    source_publisher=EXCLUDED.source_publisher,
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
    'Current YouTube oEmbed metadata only. Playback, exact quadruped or high-plank base, dynamic cycle or protraction-hold action, straight-elbow rule, contacts, count boundary, captions, accessibility, cue quality, safety conflicts, reviewer card-version match, and approval remain unverified.'
  FROM (VALUES
    ('WJraJbTJY_E','Quadruped Scapular Push-Up','Elite Performance Institute','quadruped scapular push-up candidate title checked by YouTube oEmbed'),
    ('S9NhochxIhY','Scapular Stabilization Serratus Push Ups','Physical Therapy First','serratus scapular push-up candidate title checked by YouTube oEmbed'),
    ('5YHZnEsE9hA','Scapula Pushup','Andrew Sacks','scapula push-up candidate title checked by YouTube oEmbed'),
    ('ccxY-ax5SC8','Shoulder Stabilization with The Push Up Plus | Sports Performance Physical Therapy | San Diego, CA','Sports Performance Physical Therapy','push-up-plus candidate title checked by YouTube oEmbed'),
    ('d0bfBjxEa4s','Band-Resisted Push-Up Plus / Scapular Push-Ups','Matthew Stevens','band-resisted adjacent candidate title checked by YouTube oEmbed')
  ) m(video_id,title,channel,query)
  ON CONFLICT(definition_id,reviewed_card_version,url) DO UPDATE SET
    variant_id=NULL,embed_url=EXCLUDED.embed_url,video_id=EXCLUDED.video_id,
    title=EXCLUDED.title,channel_name=EXCLUDED.channel_name,
    duration_seconds=NULL,language_code='en',captions_available=NULL,
    embedding_allowed=TRUE,exact_variant_match=NULL,
    demonstration_quality_score=NULL,link_status='healthy',
    review_status='candidate',discovery_method=EXCLUDED.discovery_method,
    source_query=EXCLUDED.source_query,reviewer_user_id=NULL,reviewed_at=NULL,
    next_review_at=EXCLUDED.next_review_at,notes=EXCLUDED.notes,updated_at=now();

  INSERT INTO coaching.exercise_alternate_assessment_v1(
    definition_id,reviewed_card_version,alternate_name,classification,rationale,
    distinguishing_dimensions,proposed_card_json,review_status,
    reviewer_user_id,reviewed_at)
  SELECT canonical_definition,2,a.name,a.classification,a.rationale,a.facts,
    jsonb_build_object('boundaryKey',a.boundary_key,
      'proposedStatus',a.proposed_status,'migration',migration_key,
      'researchVersion',research_version,'humanReviewRequired',TRUE,
      'approvalsCreated',FALSE),
    'candidate',NULL,NULL
  FROM (VALUES
    ('Quadruped Scapular Push-Up or Scapula Push-Up','same_identity','These are aliases only when both hands and knees remain supported, elbows stay straight, and one retraction-to-protraction cycle is counted.','quadruped_dynamic_alias',jsonb_build_array('alias','quadruped','dynamic_cycle'),'merge_alias'),
    ('High-Plank Scapular Push-Up or Serratus Push-Up','same_identity','These are aliases only when both hands and toes remain supported, elbows stay straight, and one retraction-to-protraction cycle is counted.','plank_dynamic_alias',jsonb_build_array('alias','high_plank','dynamic_cycle'),'merge_alias'),
    ('Quadruped Scapular Push-Up Hold','same_identity','This name fits only when hands and knees remain supported and actual valid seconds are counted in controlled protraction.','quadruped_hold_alias',jsonb_build_array('alias','quadruped','protraction_hold'),'merge_alias'),
    ('High-Plank Scapular Push-Up Plus Iso Hold','same_identity','This name fits only when hands and toes remain supported, elbows stay straight, and actual valid protraction-hold seconds are counted.','plank_hold_alias',jsonb_build_array('alias','high_plank','protraction_hold'),'merge_alias'),
    ('Comfortable Scapular Range','modifier_annotation','A smaller symptom-free scapular glide changes range while the declared base, action, contacts, and repetition or hold boundary remain exact.','range_annotation',jsonb_build_array('comfortable_scapular_range'),'delivery_annotation'),
    ('Controlled Tempo','modifier_annotation','Tempo changes dose only when the same dynamic cycle and complete protraction return remain exact.','tempo_annotation',jsonb_build_array('eccentric_seconds','transition_seconds','protraction_seconds'),'delivery_annotation'),
    ('Repetitions Sets Hold Seconds or Rest','modifier_annotation','Volume and recovery change dosage rather than identity when the exact dynamic or hold variant remains selected.','dose_annotation',jsonb_build_array('repetitions','sets','hold_seconds','rest_seconds'),'delivery_annotation'),
    ('Comfortable Hand Spacing','modifier_annotation','Hand spacing within a stable comfortable range is a setup annotation when base, contacts, elbow action, and scapular path do not change.','hand_spacing_annotation',jsonb_build_array('hand_spacing'),'delivery_annotation'),
    ('Stable Knee Cushioning','modifier_annotation','A stable pad under both knees changes contact comfort but not the quadruped support base or selected scapular action.','knee_cushioning',jsonb_build_array('knee_contact_comfort'),'delivery_annotation'),
    ('Brief Protraction Pause During Dynamic Cycles','modifier_annotation','A brief declared pause changes tempo only when the task still counts one complete retraction-to-protraction dynamic cycle rather than valid hold seconds.','pause_annotation',jsonb_build_array('brief_pause','dynamic_count_preserved'),'delivery_annotation'),
    ('Wall Scapular Push-Up','new_variant','Wall support changes angle, equipment, loading, station, and failure consequence.','wall_support_variant',jsonb_build_array('wall_support','changed_load_angle'),'needs_human_review'),
    ('Raised-Support Scapular Push-Up','new_variant','Bench or box support changes support height, equipment, load, logistics, and failure consequence.','raised_support_variant',jsonb_build_array('raised_support','equipment','changed_load'),'needs_human_review'),
    ('Bear-Hover Scapular Push-Up','new_variant','Lifting the knees changes base contacts, load, trunk demand, fatigue, and failure consequence.','bear_hover_variant',jsonb_build_array('knees_hover','changed_base','changed_load'),'needs_human_review'),
    ('Unilateral Scapular Push-Up','new_variant','One-hand emphasis changes laterality, asymmetrical loading, trunk demand, and control.','unilateral_variant',jsonb_build_array('unilateral','asymmetrical_load'),'needs_human_review'),
    ('Single-Leg High-Plank Scapular Push-Up','new_variant','Removing one foot contact changes laterality, stability, rotation demand, and loading.','single_leg_variant',jsonb_build_array('single_leg','reduced_support','rotation_demand'),'needs_human_review'),
    ('Unstable-Surface Scapular Push-Up','new_variant','An unstable hand or foot surface changes equipment, stability, load variability, and failure consequence.','unstable_surface_variant',jsonb_build_array('unstable_surface','equipment','stability'),'needs_human_review'),
    ('Band-Resisted Scapular Push-Up','new_variant','External resistance changes equipment, force direction, load, fatigue, setup, and release risk.','band_resisted_variant',jsonb_build_array('external_resistance','equipment','release_risk'),'needs_human_review'),
    ('Feet-Elevated Scapular Push-Up','new_variant','Elevating the feet changes equipment, angle, upper-limb load, logistics, and failure consequence.','feet_elevated_variant',jsonb_build_array('feet_elevated','equipment','changed_load'),'needs_human_review'),
    ('Push-Up Plus with Elbow Flexion','new_definition','A full push-up followed by additional protraction adds elbow flexion and extension, whole-body displacement, a different count boundary, and greater loading.','push_up_plus_distinct',jsonb_build_array('elbow_flexion_extension','press_then_protract'),'research_queue'),
    ('Push-Up','new_definition','A push-up counts whole-body lowering and pressing through elbow flexion and extension rather than an isolated straight-arm scapular cycle or hold.','push_up_distinct',jsonb_build_array('elbow_flexion_extension','whole_body_displacement'),'existing_distinct_definition'),
    ('Scapular Pull-Up','new_definition','Hanging scapular elevation and depression use overhead suspension, grip, different joint actions, loading, and logistics.','scapular_pull_up_distinct',jsonb_build_array('hanging','scapular_depression_elevation','grip'),'existing_distinct_definition'),
    ('Quadruped Scapular Clock','new_definition','Multi-directional scapular movement adds direction choices, sequencing, and a different repetition boundary.','scapular_clock_distinct',jsonb_build_array('multidirectional_path','sequence','decision_demand'),'existing_distinct_definition'),
    ('Serratus Punch','new_definition','Open-chain arm protraction with external load or cable resistance changes support, equipment, force direction, and action context.','serratus_punch_distinct',jsonb_build_array('open_chain','external_load','arm_path'),'research_queue'),
    ('Clinical Scapular Dyskinesis or Shoulder Assessment','new_definition','Assessment adds examiner protocol, measurement, clinical purpose, consent, interpretation, and escalation.','clinical_assessment_distinct',jsonb_build_array('measurement','clinical_scope','examiner_protocol'),'research_queue')
  ) a(name,classification,rationale,boundary_key,facts,proposed_status)
  ON CONFLICT(definition_id,reviewed_card_version,alternate_name) DO UPDATE SET
    classification=EXCLUDED.classification,rationale=EXCLUDED.rationale,
    distinguishing_dimensions=EXCLUDED.distinguishing_dimensions,
    proposed_card_json=EXCLUDED.proposed_card_json,
    review_status='candidate',reviewer_user_id=NULL,reviewed_at=NULL,
    updated_at=now();

  INSERT INTO coaching.exercise_relationship_v1(
    from_variant_id,to_variant_id,relationship,similarity_score,dimensions,
    reason,conditions_json,review_status,created_by,reviewed_by,reviewed_at)
  SELECT r.from_id,r.to_id,r.relationship,r.score,r.dimensions,r.reason,
    jsonb_build_object('migration',migration_key,'reviewOnly',TRUE,
      'automaticSubstitution',FALSE,
      'revalidate',jsonb_build_array('exact base dynamic-or-hold action contacts and count',
        'laterality support height elbow action scapular path stability resistance and force',
        'hand wrist elbow shoulder spine and upper-limb symptoms',
        'surface floor access sightline and exit','purpose dose and actual duration',
        'wrist shoulder pressing trunk hand-support fatigue impact and downstream budgets',
        'persistence','coach rendering','athlete rendering'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'review',NULL,NULL,NULL
  FROM (VALUES
    (quadruped_hold,quadruped_dynamic,'progression',72,
      ARRAY['complexity','range','decision_demand']::TEXT[],
      'The dynamic quadruped cycle adds controlled retraction, reversal, and a repetition boundary to the same hands-and-knees straight-arm support; use only after action and dose are explicitly reselected.'),
    (quadruped_dynamic,plank_dynamic,'progression',78,
      ARRAY['load','leverage','fatigue']::TEXT[],
      'High-plank dynamic cycles retain straight-arm scapular cycling but replace knee support with toe support and materially increase leverage, loading, trunk demand, and cumulative support exposure.'),
    (quadruped_hold,plank_hold,'progression',76,
      ARRAY['load','leverage','fatigue']::TEXT[],
      'High-plank protraction holds replace knee support with toe support and increase leverage, loading, whole-body support demand, and fatigue while retaining a valid-seconds boundary.'),
    (plank_hold,plank_dynamic,'progression',68,
      ARRAY['complexity','range','decision_demand']::TEXT[],
      'High-plank dynamic cycles add controlled retraction, reversal, and repetition counting to the same long-lever base; the changed action and dose require full reselection.'),
    (quadruped_dynamic,clock_variant,'progression',46,
      ARRAY['complexity','range','decision_demand']::TEXT[],
      'A Quadruped Scapular Clock adds multiple declared directions and sequencing to quadruped scapular control and is only a contextual progression after its separate identity and dose are selected.'),
    (plank_dynamic,push_up_variant,'progression',52,
      ARRAY['complexity','load','range','fatigue']::TEXT[],
      'A full Push-Up adds elbow flexion and extension, whole-body vertical displacement, a different repetition boundary, higher loading, and distinct fatigue; this is never an automatic substitution.')
  ) r(from_id,to_id,relationship,score,dimensions,reason)
  ON CONFLICT(from_variant_id,to_variant_id,relationship) DO UPDATE SET
    similarity_score=EXCLUDED.similarity_score,dimensions=EXCLUDED.dimensions,
    reason=EXCLUDED.reason,conditions_json=EXCLUDED.conditions_json,
    review_status='review',created_by=NULL,reviewed_by=NULL,reviewed_at=NULL,
    updated_at=now()
  WHERE coaching.exercise_relationship_v1.reviewed_by IS NULL
    AND coaching.exercise_relationship_v1.review_status<>'approved';

  INSERT INTO coaching.exercise_score_calibration_v1(
    facility_id,variant_id,dimension,proposed_score,anchor_tier,rationale,
    status,version,created_by,reviewed_by,review_notes,reviewed_at)
  SELECT 1,v.variant_id,d.dimension,
    CASE d.dimension WHEN 'technicalComplexity' THEN v.complexity
      ELSE v.physical END,
    20,
    CASE d.dimension WHEN 'technicalComplexity' THEN v.complexity_reason
      ELSE v.physical_reason END
      ||' This scores the exercise task, not a participant.',
    'review',1,NULL,NULL,
    'Research-informed proposal only; independent comparison and qualified human approval remain required.',NULL
  FROM (VALUES
    (quadruped_dynamic,24,18,
      'Review-only exercise-complexity anchor based on exact hands-and-knees base, straight elbows, controlled scapular retraction-to-protraction cycle, trunk support, quality gates, and one-cycle count boundary.',
      'Review-only physical-difficulty anchor based on partial-bodyweight bilateral hand, wrist, elbow, shoulder, scapular, and trunk support in quadruped without impact or external load.'),
    (plank_dynamic,32,30,
      'Review-only exercise-complexity anchor based on exact hands-and-toes base, straight elbows, controlled scapular cycle, long-body-line control, quality gates, and one-cycle count boundary.',
      'Review-only physical-difficulty anchor based on long-lever partial-bodyweight hand and toe support with sustained wrist, upper-limb, scapular, trunk, hip, knee, and ankle demand without impact or external load.'),
    (quadruped_hold,22,18,
      'Review-only exercise-complexity anchor based on exact hands-and-knees base, straight elbows, selected protraction endpoint, quality gates, and actual-valid-seconds count boundary.',
      'Review-only physical-difficulty anchor based on partial-bodyweight quadruped straight-arm support and sustained controlled protraction without impact or external load.'),
    (plank_hold,28,30,
      'Review-only exercise-complexity anchor based on exact hands-and-toes base, straight elbows, selected protraction endpoint, whole-body-line gates, and actual-valid-seconds count boundary.',
      'Review-only physical-difficulty anchor based on long-lever high-plank straight-arm and whole-body support with sustained controlled protraction without impact or external load.')
  ) v(variant_id,complexity,physical,complexity_reason,physical_reason)
  CROSS JOIN (VALUES('technicalComplexity'),('absoluteLoadDemand')) d(dimension)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
    proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,
    reviewed_by=NULL,review_notes=EXCLUDED.review_notes,reviewed_at=NULL,
    updated_at=now();

  UPDATE coaching.exercise SET
    name='Scapular Push-Up',slug='scapular-push-up',
    description='Select one exact bilateral straight-arm variant: a quadruped or high-plank retraction-to-protraction cycle counted in complete repetitions, or a quadruped or high-plank protraction hold counted in actual valid seconds. Quadruped keeps both hands and knees down; high plank keeps both hands and toes down. Elbow flexion, raised support, knee hover, unilateral support, instability, resistance, a full push-up, or clinical assessment is a different task.',
    instructions='Declare the base and dynamic-or-hold action before the set. Verify safe floor entry, firm nonslip contacts, current hand wrist elbow shoulder and spine tolerance, and same-session support budgets. Keep elbows straight. For dynamic cycles, allow controlled scapular retraction and then push the floor away into protraction; count only the complete cycle. For holds, establish controlled protraction and count only valid seconds. Stop for pain, pinching, neurologic or circulation symptoms, dizziness, breathing concern, contact loss, elbow bend, shrugging, body-line loss, unsafe surface, or participant request.',
    skill_level=NULL,age_min=NULL,age_max=NULL,
    default_sets=1,default_reps=6,default_work_seconds=NULL,
    default_rest_seconds=45,
    tempo='controlled selected dynamic cycle or measured valid hold seconds',
    load_note='Track exact variant, complete dynamic repetitions or actual valid hold seconds, total hand-support and plank-support seconds, scapular range, required contacts, elbow and body-line faults, rests, symptoms, invalid attempts, actual duration, floor transfers, and overlapping wrist shoulder pressing trunk and downstream support work.',
    est_seconds_per_set=60,is_published=FALSE,archived=FALSE,
    card_summary='Four explicitly selected straight-arm scapular-control variants: dynamic cycles or protraction holds in quadruped or high plank.',
    coach_language='Declare base and action, inspect the floor and contacts, verify current symptoms and cumulative support work, cue straight elbows and controlled scapular motion, count only complete cycles or valid seconds, and stop at the first symptom, contact, elbow, scapular, body-line, breathing, surface, or budget fault.',
    athlete_language='Choose hands and knees or hands and toes, then choose moving reps or a hold. Keep your elbows straight. Move your shoulder blades together and push away, or hold the push-away position while breathing. Stop for pain, pinching, tingling, dizziness, or lost shape.',
    programming_logic=jsonb_build_object(
      'selectionStatus','canonical_variant_required','selectable',TRUE,
      'canonicalDefinitionId',canonical_definition,
      'exactVariantIds',to_jsonb(active_variant_ids),
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'exerciseDifficultyDescribesTaskOnly',TRUE,
      'selectionInputs',jsonb_build_array('workout purpose','exact quadruped or high-plank base','dynamic cycle or protraction hold','floor transfer and bilateral hand knee or toe support','hand wrist elbow shoulder spine and trunk tolerance','clean firm nonabrasive surface','dose actual duration and cumulative wrist shoulder pressing trunk and hand-support budgets','downstream support work','coach scope and emergency route'),
      'substitutionRevalidation',jsonb_build_array('identity base action contacts elbow rule and count','laterality support height scapular path range stability resistance and force','restrictions symptoms pressure and skin','purpose dose fatigue impact and downstream budgets','duration surface floor logistics and sightline','persistence','coach rendering','athlete rendering'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    scalable_variables=ARRAY['exact_variant','complete_repetitions',
      'valid_hold_seconds','comfortable_scapular_range','tempo',
      'rest_seconds','sets','stable_knee_cushioning']::TEXT[],
    movement_family='Bilateral Straight-Arm Scapular Support Control',
    primary_phase_key=NULL,phase_subrole=NULL,primary_order_slot=NULL,
    movement_requirements=jsonb_build_object(
      'selectable',TRUE,'canonicalVariantRequired',TRUE,
      'impactLevel',0,'balanceDemand','stable_bilateral_quadruped_or_high_plank_support',
      'breathingDemand','comfortable_no_breath_hold',
      'actions',jsonb_build_array('variant_specific_scapular_retraction_protraction_cycle_or_protraction_hold','wrist_extension_support','straight_elbow_closed_chain_support','scapular_and_trunk_control'),
      'planes',jsonb_build_array('sagittal_primary','multiplanar_stabilization'),
      'mustMaintain',jsonb_build_array('exact_variant_base_and_action','variant_specific_hand_knee_or_toe_contacts','straight_elbows','controlled_scapular_path_or_hold','organized_trunk_and_pelvis','comfortable_range','normal_breathing','communication'),
      'mustNotAdd',jsonb_build_array('other_base_or_action','elbow_flexion_push_up','wall_or_raised_support','bear_hover','unilateral_or_single_leg_support','unstable_surface','external_or_manual_resistance','clinical_assessment'),
      'validCompletion','one exact controlled retraction-to-protraction cycle or one valid protraction-hold second without mixed action contact loss elbow bend shrug body-line loss breath hold or stop rule'),
    coaching_execution=jsonb_build_object(
      'qualityGates',jsonb_build_array('variant_base_action_and_count_exact','surface_and_station_safe','required_contacts_exact','elbows_straight','scapular_path_or_hold_controlled','trunk_pelvis_and_high_plank_line_supported','complete_protraction_or_valid_second','normal_breathing','no_stop_symptoms'),
      'stopRules',jsonb_build_array('sharp_increasing_radiating_unfamiliar_hand_wrist_elbow_shoulder_or_spine_pain','pinching_skin_wound_or_contact_pain','neurologic_circulation_color_temperature_or_limb_control_change','chest_or_breathing_concern','dizziness_faintness_nausea_visual_change_or_disorientation','required_contact_or_upper_limb_support_loss','elbow_bend_shrug_body_line_loss_wrong_action_or_forced_range','unsafe_surface_station_communication_or_exit','budget_or_duration_reached'),
      'persistence',jsonb_build_array('definition_card_and_variant_version','planned_and_actual_repetitions_or_valid_hold_seconds','total_hand_and_plank_support_seconds_scapular_range_contacts_tempo_rest_and_sets','valid_invalid_partial_and_symptom_limited_attempts','first_fault_symptoms_skin_and_stop_reason','duration_station_surface_and_floor_transfer','substitution_and_revalidation','coach_and_athlete_rendering_version')),
    pairing_logic=jsonb_build_object(
      'sameSessionBudget',jsonb_build_array('complete_dynamic_repetitions','valid_protraction_hold_seconds','hand_wrist_and_straight_arm_support_seconds','high_plank_support_seconds','floor_transfers','technical_fatigue','shoulder_pressing_and_trunk_exposure','downstream_hand_support','impact_contacts'),
      'avoidAutomaticPairingWith',jsonb_build_array('symptom_provoking_hand_wrist_or_shoulder_loading','fatiguing_tumbling_handstand_cartwheel_crawling_pressing_plank_or_grip_volume','high_volume_overhead_or_throwing_work_when_scapular_quality_would_fall','time_critical_output_when_this_drill_displaces_priority_work'),
      'revalidateAfterSubstitution',TRUE),
    media_library=jsonb_build_object(
      'candidate_video_ids',jsonb_build_array('WJraJbTJY_E','S9NhochxIhY','5YHZnEsE9hA','ccxY-ax5SC8','d0bfBjxEa4s'),
      'reviewState','oembed_metadata_only_candidate_quarantine',
      'playbackVariantBaseContactsActionCountCaptionsAccessibilityQualitySafetyAndApprovalVerified',FALSE,
      'humanReviewRequired',TRUE),
    programming_kind='exercise',linked_skill_id=NULL,why_publish_ready=FALSE,
    updated_at=now()
  WHERE id=33;

  UPDATE coaching.exercise_safety_profile SET
    risk_level=2,impact_level=0,minimum_age_recommended=NULL,
    minimum_skill_level=NULL,requires_spotting=FALSE,
    requires_coach_supervision='recommended',
    minimum_prerequisite_notes='Readiness is evaluated from safe floor entry, exact hand and knee or toe contacts, comfortable selected scapular cycle or hold, straight-elbow wrist shoulder scapular and trunk support, clean surface, current symptoms, communication, workout dose, and downstream pressing and hand-support loading; never from participant classification.',
    readiness_checks=ARRAY[
      'Confirm exact quadruped or high-plank and dynamic-cycle or protraction-hold variant, required contacts, clean firm nonslip nonabrasive surface, station clearance, sightline, communication, and safe exit.',
      'Confirm floor entry and exit, bilateral hand and knee or toe support, comfortable palm and wrist contact, straight elbows, and organized shoulder scapular trunk and pelvis support.',
      'Confirm the participant can name the selected action, identify which contacts stay down, count a complete cycle or actual valid seconds, and use the stop signal.',
      'Review cumulative wrist shoulder pressing straight-arm plank and hand-support seconds, technical fatigue, later tumbling handstand cartwheel crawling pressing overhead throwing and downstream loading.'
    ]::TEXT[],
    stop_signs=ARRAY[
      'Sharp increasing radiating unfamiliar hand wrist elbow shoulder spine or other pain, shoulder pinching, or participant stop request.',
      'Skin wound contact pain numbness tingling weakness color temperature circulation or limb-control change.',
      'Chest or breathing concern dizziness faintness nausea visual change disorientation or inability to communicate.',
      'Required hand knee or toe contact loss, elbow bend, shrugging, scapular or trunk support loss, sag, pike, rotation, mixed action, breath hold, or forced range cannot be corrected safely.',
      'Floor traction cleanliness temperature station sightline communication duration downstream budget or safe exit becomes inadequate.'
    ]::TEXT[],
    contraindications=ARRAY[
      'Current hand palm skin wrist elbow shoulder spine upper-limb neurologic circulation trauma procedure or clinical restriction conflicts with the selected exact action.',
      'No clean firm nonslip nonabrasive surface, safe floor entry, exact bilateral support, coach sightline, communication, or exit.',
      'The intended service is diagnosis treatment injury management readiness clearance manual assistance assessment or another exercise identity.'
    ]::TEXT[],
    common_substitutions=ARRAY[
      'Use another one of the four exact variants only after explicit reselection and full base action contact count dose fatigue duration and rendering revalidation.',
      'Use Quadruped Scapular Clock only when multi-directional scapular sequencing matches the purpose and all checks are rerun.',
      'Use a separately authored wall, raised-support, non-floor, neutral-wrist, or non-hand-support task when exact floor contact does not fit.',
      'Do not silently add elbow flexion, change base or laterality, raise support, hover knees, remove a contact, add instability or resistance, or enter clinical scope.'
    ]::TEXT[]
  WHERE exercise_id=33;

  UPDATE coaching.exercise_score_v1 SET
    technical_complexity=32,absolute_load_demand=30,
    coordination_demand=32,impact=1,supervision_demand=30,
    base_overall_difficulty=greatest(32,30),
    legacy_scores=coalesce(legacy_scores,'{}'::JSONB)||jsonb_build_object(
      'candidateReassessment',migration_key,
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'variantScores',jsonb_build_object(
        'quadrupedDynamicCycle',jsonb_build_object(
          'complexity',24,'physicalDifficulty',18,'overall',24),
        'highPlankDynamicCycle',jsonb_build_object(
          'complexity',32,'physicalDifficulty',30,'overall',32),
        'quadrupedProtractionHold',jsonb_build_object(
          'complexity',22,'physicalDifficulty',18,'overall',22),
        'highPlankProtractionHold',jsonb_build_object(
          'complexity',28,'physicalDifficulty',30,'overall',30)),
      'exerciseScoresDescribeTaskOnly',TRUE,
      'independentCalibrationRequired',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    migration_confidence=58,human_review_status='queued',
    reviewed_by=NULL,reviewed_at=NULL,
    review_notes='Research-informed candidates only. Scores describe exercise complexity and physical difficulty, not a participant. Identity anatomy loading and independent calibration remain required.',
    updated_at=now()
  WHERE exercise_id=33;

  UPDATE coaching.exercise_difficulty_profile SET
    technical=3.2,complexity=3.2,load=3.0,overall=3.2,
    recommended_age_min=NULL,recommended_age_max=NULL,
    attention_demand='low',
    notes='Candidate exact variants are 24/18/24 for quadruped dynamic, 32/30/32 for high-plank dynamic, 22/18/22 for quadruped protraction hold, and 28/30/30 for high-plank protraction hold: exercise complexity, physical difficulty, and their derived maximum. These are task scores, not participant classifications.',
    source='canonical_research_candidate',updated_at=now()
  WHERE exercise_id=33;

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  VALUES(canonical_definition,1,2,'2.0.0',migration_key,'quarantined',
    jsonb_build_object(
      'identity',jsonb_build_object('passed',TRUE,
        'identityKey','explicit_quadruped_or_high_plank_dynamic_scapular_cycle_or_protraction_hold',
        'activeVariants',4,'archivedSourceSkeletons',3,
        'neighborBoundariesExplicit',2,'directDuplicateDefinitions',0,
        'legacySourcesConsolidated',3),
      'taxonomy',jsonb_build_object('passed',TRUE,'controlledTerms',TRUE,
        'movementPatterns',jsonb_build_array('brace','push'),
        'bodyRegions',10,'equipment',jsonb_build_array('none')),
      'anatomy',jsonb_build_object('passed',TRUE,
        'musclesJointsActionsPlanesLateralityBaseContactsAndCycleOrHoldBoundary',TRUE,
        'measuredActivationOrForceClaimAbsent',TRUE),
      'difficulty',jsonb_build_object('passed',TRUE,
        'model','max_exercise_complexity_physical_difficulty',
        'quadrupedDynamicVector','24/18/24',
        'highPlankDynamicVector','32/30/32',
        'quadrupedHoldVector','22/18/22',
        'highPlankHoldVector','28/30/30',
        'participantClassificationAbsent',TRUE,
        'independentCalibrationRequired',TRUE),
      'loadFatigueRecovery',jsonb_build_object('passed',TRUE,
        'dynamicRepetitionsHoldAndSupportSecondsContactsFaultsFloorTransfersAndDownstreamExposureTracked',TRUE,
        'impactNone',TRUE,'recoveryIsPlanningEstimate',TRUE),
      'constraints',jsonb_build_object('passed',TRUE,
        'floorTransferHandKneeToeContactsWristElbowShoulderSpineSurfaceSymptomsRestrictionsScopeAndExit',TRUE),
      'delivery',jsonb_build_object('passed',TRUE,'profiles',8,
        'prepareAndResilienceForAllFourVariants',TRUE,
        'durationDoseRestStationAndSubstitutionRevalidation',TRUE),
      'instructions',jsonb_build_object('passed',TRUE,
        'athleteCoachAccessibilityAndSupportOperations',TRUE,
        'variantActionContactsCountStopsAndScope',TRUE),
      'research',jsonb_build_object('passed',TRUE,'sections',16,
        'registryVersion',research_version,
        'directSourcesDoNotCreateUniversalClaims',TRUE),
      'media',jsonb_build_object('passed',FALSE,'candidateCount',5,
        'currentOEmbedMetadataHealthy',TRUE,'playbackReviewed',FALSE,
        'exactVariantReviewed',FALSE,
        'captionsAccessibilityQualitySafetyAndApprovalReviewed',FALSE),
      'relationships',jsonb_build_object('passed',FALSE,'reviewOnly',6,
        'approved',0,'automaticSubstitution',FALSE),
      'calibration',jsonb_build_object('passed',FALSE,'reviewOnly',8,
        'approved',0),
      'alternates',jsonb_build_object('passed',TRUE,'assessments',24,
        'baseActionContactLateralitySupportHeightElbowPathHoldStabilityResistanceLoadAndScopeChangesQuarantined',TRUE),
      'generationSupport',jsonb_build_object('passed',TRUE,
        'selectionConstraints',TRUE,'cumulativeFatigueAndImpactBudgets',TRUE,
        'duration',TRUE,'surfaceAndStation',TRUE,
        'substitutionRevalidation',TRUE,
        'renderingAndPersistence',TRUE),
      'publication',jsonb_build_object('passed',FALSE,'reviewer',NULL,
        'approver',NULL)),
    jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01',
        'message','A qualified human must watch all five candidates in full and verify playback, exact quadruped or high-plank base, dynamic cycle or protraction hold, straight elbows, contacts, count boundary, captions, accessibility, cue quality, safety conflicts, reviewer timestamp, card version, and approval rationale.'),
      jsonb_build_object('code','CARD-GRAPH-03',
        'message','A qualified coach must approve or reject all six internal and neighboring relationships; no automatic substitution between changed base, action, contacts, leverage, elbow action, hold, load, or purpose is authorized.'),
      jsonb_build_object('code','CARD-CALIBRATION-01',
        'message','An independent qualified reviewer must calibrate 24/18, 32/30, 22/18, and 28/30 exercise complexity and physical difficulty. Scores do not classify a participant or create an age or capability level.'),
      jsonb_build_object('code','CARD-PUBLISH-01',
        'message','A qualified reviewer and separate approver must complete content review before publication. Identity, anatomy, loading, base and contact rules, wrist and shoulder risk, scope, dose, stop, accessibility, persistence, and support rules remain quarantined.')),
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
        AND reviewed_by IS NULL AND approved_by IS NULL
        AND last_reviewed_at IS NULL
        AND movement_patterns=ARRAY['brace','push']::TEXT[]
        AND body_regions=ARRAY['hand','wrist','elbow','shoulder','scapula','core','spine','hip','knee','ankle']::TEXT[]
        AND required_equipment=ARRAY['none']::TEXT[]
        AND jsonb_array_length(anatomy_json->'joints')>=8
        AND provenance_json->>'researchVersion'=research_version
        AND provenance_json->>'externalPlaybackVerificationPerformed'='false')
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
          WHERE definition_id=canonical_definition AND status='review'
            AND id=ANY(active_variant_ids))<>4
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
          WHERE definition_id=canonical_definition AND status='archived'
            AND id=ANY(source_variant_ids))<>3
    OR (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
          WHERE variant_id=ANY(active_variant_ids) AND status='review')<>8
    OR (SELECT count(*) FROM coaching.exercise_section_evidence_v1
          WHERE definition_id=canonical_definition
            AND reviewed_card_version=2 AND review_status='candidate')<>16
    OR (SELECT count(*) FROM coaching.exercise_media_candidate_v1
          WHERE definition_id=canonical_definition
            AND reviewed_card_version=2 AND review_status='candidate')<>5
    OR EXISTS(SELECT 1 FROM coaching.exercise_media_candidate_v1
          WHERE definition_id=canonical_definition AND reviewed_card_version=2
            AND (reviewer_user_id IS NOT NULL OR reviewed_at IS NOT NULL
              OR exact_variant_match IS NOT NULL
              OR demonstration_quality_score IS NOT NULL
              OR review_status<>'candidate'))
    OR (SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
          WHERE definition_id=canonical_definition
            AND reviewed_card_version=2 AND review_status='candidate')<>24
    OR (SELECT count(*) FROM coaching.exercise_relationship_v1
          WHERE from_variant_id=ANY(active_variant_ids)
            AND review_status='review' AND reviewed_by IS NULL)<>6
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1
          WHERE (from_variant_id=ANY(active_variant_ids)
              OR to_variant_id=ANY(active_variant_ids))
            AND (review_status='approved' OR reviewed_by IS NOT NULL
              OR reviewed_at IS NOT NULL))
    OR (SELECT count(*) FROM coaching.exercise_score_calibration_v1
          WHERE variant_id=ANY(active_variant_ids) AND status='review'
            AND reviewed_by IS NULL AND reviewed_at IS NULL)<>8
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
          WHERE survivor_definition_id=canonical_definition
            OR resolved_definition_id=canonical_definition)<>5
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=33
          AND name='Scapular Push-Up' AND is_published=FALSE
          AND archived=FALSE AND skill_level IS NULL
          AND age_min IS NULL AND age_max IS NULL
          AND linked_skill_id IS NULL AND programming_kind='exercise'
          AND programming_logic->>'difficultyModel'=
            'max_exercise_complexity_physical_difficulty')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1
          WHERE exercise_id=33 AND technical_complexity=32
            AND absolute_load_demand=30 AND base_overall_difficulty=32
            AND human_review_status='queued' AND reviewed_by IS NULL
            AND reviewed_at IS NULL)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_card_test_packet_v1
          WHERE definition_id=canonical_definition AND status='quarantined'
            AND card_version=2 AND human_review_required=TRUE
            AND jsonb_array_length(blocking_issues_json)=4) THEN
    RAISE EXCEPTION '% postcondition failed',migration_key;
  END IF;
END
$migration$;
