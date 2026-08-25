-- Source 32: replace the ambiguous combined baseline with two exact bilateral
-- quadruped hand-action variants. Research, media, graph, calibration,
-- content, and publication authority remain human-review only.
DO $migration$
DECLARE
  migration_key CONSTANT TEXT := '503_coaching_finger_pulses_palm_lifts_family_audit_hardening';
  research_version CONSTANT TEXT := '2026-08-09.99';
  canonical_definition UUID;
  source_variant UUID;
  finger_variant UUID;
  palm_variant UUID;
  active_variant_ids UUID[];
  all_owned_variant_ids UUID[];
  palms_down_definition UUID;
  palms_down_variant UUID;
  palms_up_definition UUID;
  palms_up_variant UUID;
  capacity_definition UUID;
  capacity_variant UUID;
  lean_definition UUID;
  lean_variant UUID;
  orientation_definition UUID;
  orientation_variant UUID;
  protected_count INTEGER;
BEGIN
  SELECT definition_id INTO canonical_definition FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=32;
  SELECT id INTO source_variant FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='baseline';
  SELECT id INTO finger_variant FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='quadruped-whole-hand-contact-finger-pressure-pulse';
  finger_variant := coalesce(finger_variant,gen_random_uuid());
  SELECT id INTO palm_variant FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='quadruped-fingers-distal-palm-contact-palm-heel-lift-lower';
  palm_variant := coalesce(palm_variant,gen_random_uuid());
  SELECT definition_id INTO palms_down_definition FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=30;
  SELECT id INTO palms_down_variant FROM coaching.exercise_variant_v1 WHERE definition_id=palms_down_definition AND variant_key='quadruped-palms-down-fingers-forward-forward-back';
  SELECT definition_id INTO palms_up_definition FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=31;
  SELECT id INTO palms_up_variant FROM coaching.exercise_variant_v1 WHERE definition_id=palms_up_definition AND variant_key='quadruped-backs-hands-down-palms-up-fingers-knees-back-forward';
  SELECT definition_id INTO capacity_definition FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=216;
  SELECT id INTO capacity_variant FROM coaching.exercise_variant_v1 WHERE definition_id=capacity_definition AND variant_key='baseline';
  SELECT definition_id INTO lean_definition FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=256;
  SELECT id INTO lean_variant FROM coaching.exercise_variant_v1 WHERE definition_id=lean_definition AND variant_key='baseline';
  SELECT definition_id INTO orientation_definition FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=796;
  SELECT id INTO orientation_variant FROM coaching.exercise_variant_v1 WHERE definition_id=orientation_definition AND variant_key='baseline';
  active_variant_ids := ARRAY[finger_variant,palm_variant];
  all_owned_variant_ids := ARRAY[source_variant,finger_variant,palm_variant];

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=32 AND facility_id=1)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition AND facility_id=1 AND legacy_exercise_id=32)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=32 AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source_variant AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=palms_down_variant AND definition_id=palms_down_definition
        AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=palms_up_variant AND definition_id=palms_up_definition
        AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=capacity_variant AND definition_id=capacity_definition
        AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=lean_variant AND definition_id=lean_definition
        AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=orientation_variant AND definition_id=orientation_definition
        AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1 WHERE exercise_id=32)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_difficulty_profile
      WHERE exercise_id=32)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_safety_profile
      WHERE exercise_id=32) THEN
    RAISE EXCEPTION '% prerequisite source or neighbor rows are missing',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=ANY(active_variant_ids) AND definition_id<>canonical_definition)
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE slug='finger-pulses' AND id<>canonical_definition) THEN
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
      WHERE exercise_id=32
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
        'sourceDisposition','canonical_two_variant_hand_pressure_family_reauthored',
        'representedBySelectableSourceVariant',FALSE,
        'sourceInterpretation','source 32 combines finger-pressure pulses and palm-heel lifts without exact variant selection count anatomy loading dose budgets logistics support calibration or review contracts',
        'exactWorkingSpecifications',jsonb_build_array(
          'bilateral_quadruped_whole_hand_contact_finger_pressure_increase_and_decrease',
          'bilateral_quadruped_fingers_and_distal_palm_contact_palm_heel_lift_and_lower'),
        'researchSources',jsonb_build_array(
          'https://gmb.io/wp-content/uploads/2025/02/GMB-Wrist-Strengthening-Cheatsheet.pdf',
          'https://static.usagym.org/PDFs/about/wellness/exercise/wrist.pdf',
          'https://pubmed.ncbi.nlm.nih.gov/37794701/',
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC12804664/'),
        'exerciseDifficultyDescribesTaskOnly',TRUE,
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=32 AND definition_id=canonical_definition;

  UPDATE coaching.exercise_delivery_profile_v1 SET
    status='archived',updated_at=now()
  WHERE variant_id=source_variant;
  UPDATE coaching.exercise_variant_v1 SET
    variant_key='identity-quarantine-source-32',
    display_name='Finger Pulses / Palm Lifts Legacy Combined Skeleton — Source 32',
    modifier_keys='{}'::TEXT[],difficulty_json='{}'::JSONB,status='archived',
    requirements_json=jsonb_build_object(
      'selectable',FALSE,'representation','superseded_source_skeleton',
      'sourceLegacyExerciseId',32,
      'archiveReason','combined two actions without exact support action contact count dose or review contract',
      'replacementVariantIds',to_jsonb(active_variant_ids),
      'humanReviewRequired',TRUE),
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
    canonical_definition,1,32,'finger-pulses',
    'Finger Pulses / Palm Lifts','Finger Pulses / Palm Lifts',
    ARRAY['Finger Pulses','Finger Pressure Pulses','Palm Pulses','Palm Lifts',
      'Palm Heel Lifts','Quadruped Finger Pulses','Quadruped Palm Pulses'],
    'A two-variant bilateral quadruped hand-pressure family that requires explicit variant selection. Finger Pulses keep both palms and fingers supported while pressure through the fingers and flexed first knuckles increases and decreases without bouncing. Palm Lifts keep the fingers and distal or top palm supported while both palm heels lift and lower under control. One pressure increase and release is one finger pulse; one palm-heel lift and controlled lower is one palm-lift repetition. Base, action, contacts, and count may not be mixed. Pace, comfortable range, repetitions, sets, rest, and stable knee cushioning are delivery annotations. Seated or standing support, tall plank, unilateral work, finger lifts, knuckle rolling, wrist rocking, holds, resistance, manual force, or assessment changes the task.',
    'bilateral_quadruped_hand_pressure_control','2.0.0',2,'review',
    82,58,50,ARRAY['brace','push']::TEXT[],
    ARRAY['hand','wrist','elbow','shoulder','scapula','core','spine','hip','knee']::TEXT[],
    ARRAY['none']::TEXT[],'{}'::TEXT[],
    jsonb_build_object(
      'surface','clean firm flat dry stable nonslip nonabrasive floor for palmar and finger contact',
      'space','one stationary quadruped station plus safe entry and exit',
      'stationCapacity',1,'laneRequired',FALSE,
      'coachSightline','side and front-oblique views of finger first-knuckle palm wrist elbow shoulder scapula trunk and knee support',
      'inspection',jsonb_build_array('floor traction dryness cleanliness temperature and debris','finger and palm contact area','optional knee cushioning stability','station clearance and cross traffic','communication sightline and safe exit'),
      'changeRule','Changing variant base laterality hand contact finger direction path hold support height padding load purpose dose surface or downstream hand-support demand requires full identity duration logistics substitution persistence and rendering revalidation.'),
    jsonb_build_object(
      'exerciseCardDoesNotClassifyParticipants',TRUE,'readinessIsWorkoutInput',TRUE,
      'selectionPrerequisites',jsonb_build_array('safe floor entry bilateral hand and knee support and exit','comfortable finger first-knuckle palm and wrist contact for the selected action','organized elbow shoulder scapular and trunk support','can distinguish pressure pulse from palm-heel lift and count the selected repetition','understands stop and help signal','same-session wrist hand finger and downstream support budgets fit'),
      'excludeOrEscalate',jsonb_build_array('recent significant hand wrist upper-limb trauma procedure or surgery without applicable clearance','sharp increasing radiating or unfamiliar pain','finger sprain acute knuckle pain skin wound or pain with required contact','new numbness tingling weakness color temperature circulation or hand-control change','chest or breathing concern dizziness faintness nausea visual change or disorientation','surface floor access support communication sightline or safe exit is inadequate','participant requests stop or cannot communicate reliably'),
      'notEstablishedByEvidence',jsonb_build_array('universal eligibility hand width finger spread first-knuckle angle pressure range or support position','universal dose frequency recovery or progression','isolated muscle activation strength flexibility readiness injury-prevention or treatment outcome','numeric difficulty calibration or media exactness')),
    jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'canonicalAuthoredFromResearch',TRUE,
      'primaryIdentitySource','https://gmb.io/wp-content/uploads/2025/02/GMB-Wrist-Strengthening-Cheatsheet.pdf',
      'legacySources',jsonb_build_array(32),
      'identityContract','explicit_bilateral_quadruped_finger_pressure_pulse_or_palm_heel_lift_lower_variant',
      'researchSources',jsonb_build_array('https://gmb.io/wp-content/uploads/2025/02/GMB-Wrist-Strengthening-Cheatsheet.pdf','https://static.usagym.org/PDFs/about/wellness/exercise/wrist.pdf','https://pubmed.ncbi.nlm.nih.gov/37794701/','https://pmc.ncbi.nlm.nih.gov/articles/PMC12804664/'),
      'confidenceBySection',jsonb_build_object('identity',82,'taxonomy',78,'anatomy',68,'difficulty',58,'load',60,'fatigueRecovery',52,'constraints',76,'dosage',56,'instructions',82,'alternates',84,'media',50),
      'unresolvedClaims',jsonb_build_array('one universal quadruped load hand width finger spread joint angle pressure range dose frequency recovery benefit or progression','numeric difficulty calibration','media playback exact variant contacts captions accessibility quality safety and approval'),
      'externalPlaybackVerificationPerformed',FALSE,'sourceLimitationsExplicit',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,'publicationQuarantined',TRUE),
    NULL,NULL,NULL,NULL,
    jsonb_build_object(
      'primaryMuscles',jsonb_build_array('intrinsic_hand_muscles','digital_flexor_group'),
      'secondaryMuscles',jsonb_build_array('wrist_flexors','wrist_extensors','triceps_brachii','serratus_anterior','anterior_deltoid'),
      'stabilizers',jsonb_build_array('thenar_and_hypothenar_groups','rotator_cuff','scapular_stabilizers','deep_spinal_stabilizers'),
      'joints',jsonb_build_array('metacarpophalangeal_joints','interphalangeal_joints','carpometacarpal_joints','wrist','elbow','shoulder','scapulothoracic_articulation','spinal_segments','hip','knee'),
      'jointActions',jsonb_build_array('finger_pressure_increase_and_decrease','first_knuckle_flexion_support','variant_specific_palm_heel_lift_and_lower','wrist_extension_support','elbow_extension_support','shoulder_closed_chain_support','scapular_stabilization','trunk_anti_extension'),
      'planes',jsonb_build_array('sagittal','multiplanar'),
      'laterality','bilateral',
      'contactsAndSequence',jsonb_build_object('base','bilateral_hands_and_knees','fingerPulse','palms fingers and knees stay supported while finger pressure increases then releases','palmLift','fingers distal palms and knees stay supported while palm heels lift then lower'),
      'countingBoundary','one pressure increase and release for finger pulses or one palm-heel lift and controlled lower for palm lifts',
      'rangeRule','Use only the finger pressure first-knuckle bend and palm-heel height that preserve required contact control and comfort; no maximum is required.',
      'notClaimed',jsonb_build_array('measured_muscle_activation','quantified_joint_force_or_pressure','isolated_intrinsic_activation','universal_wrist_or_finger_angle','treatment_prevention_or_readiness_effect')),
    jsonb_build_object(
      'whyItMatters','Practices the exact finger-pressure or palm-heel-control action selected for this workout without silently changing contacts or load.',
      'primaryCue','Name the variant first: pressure and release through supported fingers, or lift and lower both palm heels while fingers stay down.',
      'expectedSensations',jsonb_build_array('light to moderate finger and palm effort','comfortable wrist and upper-limb support','small controlled pressure or lift change'),
      'unexpectedSensations',jsonb_build_array('sharp increasing radiating or unfamiliar pain','knuckle or finger joint pain','numbness tingling weakness color temperature or circulation change','dizziness faintness nausea visual change or chest or breathing concern','skin abrasion or loss of hand contact'),
      'painGuidance','Stop rather than testing symptoms or forcing pressure. Report the symptom and use facility escalation; this card does not diagnose or treat it.',
      'selfChecks',jsonb_build_array('selected variant is known','required fingers palm regions and knees stay supported','pressure or lift is small and controlled without bouncing','elbows shoulders scapula and trunk stay organized','one complete selected action is counted','no stop symptom appears'),
      'accessibility',jsonb_build_array('front-oblique close hand demonstration','side-view quadruped demonstration','two-frame pressure-release or lift-lower card','slower pace fewer repetitions and more rest','optional stable knee cushioning','separately authored raised-support or non-floor task when floor contact does not fit'),
      'mediaAlternatives',jsonb_build_array('captioned transcript after review','close-up still sequence for each exact variant','coach demonstration from hand close-up side and front-oblique views'),
      'incidentPrompt','Stop, unload the hands, make the station safe, record variant contact symptom fault and actual exposure, and escalate under facility policy.'),
    jsonb_build_object(
      'observationChecklist',jsonb_build_array('exact variant and count','clean stable hand surface','bilateral hand and knee contacts','finger and first-knuckle pressure','variant-specific palm contact','wrist elbow shoulder scapular and trunk support','small controlled pressure or lift','breathing symptoms first fault actual dose and duration'),
      'faultCorrections',jsonb_build_object('variantMixed','stop reset and select only finger pressure pulse or palm-heel lift','bounceOrMomentum','reduce pressure or height and slow the action','fingerContactLoss','reduce load or stop and use a reviewed alternative','wholeHandLifts','for palm lifts keep fingers and distal palm down; otherwise stop and reselect','wristOrKnucklePain','stop hand loading and follow symptom escalation','shoulderOrTrunkLoss','shift weight back reduce dose or stop','surfaceProblem','close the station until corrected'),
      'demonstrationPlan',jsonb_build_array('show both variants as separate cards','show hand contacts close up','show one complete count from the side','show bounce contact-loss and wrong-action boundaries','show the stop and unload sequence'),
      'groupManagement',jsonb_build_array('one participant per marked floor station','stagger floor entry and exit','coach where hands and upper-body support remain visible','separate current variant cards and records','sanitize shared hand-contact areas under facility policy'),
      'modificationDecisionTree',jsonb_build_array('If only pace pressure height repetitions or rest changes keep the exact variant and record dose.','If base support height laterality contact action or load changes select a separately authored task.','If exact contact cannot be maintained reduce load or stop rather than changing action silently.','If symptoms or scope concerns appear stop and escalate without diagnosis.'),
      'doNotUseWhen',jsonb_build_array('floor transfer or required finger palm wrist elbow shoulder or knee support is unsafe','skin hand finger knuckle wrist upper-limb neurologic circulation or cardiopulmonary symptoms conflict','surface clearance sightline communication hygiene or safe exit is inadequate','fatigue prevents exact pressure contact support count or breathing','the intended task is finger lifting knuckle rolling wrist rocking a hold tall plank resistance manual work or assessment'),
      'comprehensionQuestions',jsonb_build_array('Which variant are you doing?','Which hand contacts stay down?','What completes one repetition?','When do you stop?')),
    jsonb_build_object(
      'issueCategories',jsonb_build_array('identity_or_variant','content_or_cue','difficulty_or_dose','surface_or_station','accessibility','media','symptom_or_incident','data_or_persistence'),
      'supportEscalation',jsonb_build_object('coach','correct exact variant setup dose and station within scope','facilityLead','quarantine repeated content surface media or data failures','clinicalOrEmergency','follow facility policy for red flags neurologic circulation cardiopulmonary severe pain trauma or urgent symptoms'),
      'retentionPolicy','Store definition and card version, exact variant, planned and actual repetitions, pressure or lift range, support seconds, contacts, tempo, rests, invalid or partial attempts, first fault, symptoms, stop reason, substitution, duration, station incident, coach edits, and rendering version under facility policy.',
      'changeImpactPolicy','Any change to action base laterality contact support height path hold padding load dose stop rules media or graph invalidates prior rendering and requires revalidation and review.',
      'knownLimitations',jsonb_build_array('candidate research is not content approval','oEmbed is not playback or exactness review','difficulty and recovery values are unapproved planning estimates','two variants require explicit UI and persistence labels'),
      'feedbackQuestions',jsonb_build_array('Was the variant unmistakable?','Could coach and athlete identify the required contacts and count alike?','Were surface and dose controls accurate?','Were stop and substitution choices actionable?')))
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
      'selectable',TRUE,'base','bilateral_hands_and_knees',
      'action',v.action,'supportContacts',v.contacts,
      'countRule',v.count_rule,'validCompletion',v.valid_completion,
      'mustMaintain',jsonb_build_array('clean_firm_nonslip_nonabrasive_surface',
        'both_knees_supported','elbows_extended_without_forcing',
        'organized_shoulders_scapula_and_trunk','comfortable_wrist_position',
        'variant_specific_hand_contacts','small_controlled_action',
        'normal_breathing_and_communication'),
      'mustNotAdd',jsonb_build_array('other_source_32_variant_action',
        'seated_or_standing_fold_base','tall_plank','unilateral_emphasis',
        'finger_lifts','side_to_side_knuckle_roll','wrist_rock_or_hold',
        'raised_or_padded_hand_support','band_or_external_load',
        'manual_force_or_clinical_assessment'),
      'invalidWhen',jsonb_build_array('variant_actions_mix',
        'required_contact_or_support_lost','action_bounces_or_is_forced',
        'release_or_lower_missing','stop_rule_occurs')),
    'review',
    jsonb_build_object(
      'gripDemand',v.grip,'spinalLoading',6,'eccentricStress',v.eccentric,
      'landingContactsPerRep',0,'externalLoadMethod','partial_bodyweight',
      'impactClass','none','handSupport',TRUE,
      'handSupportSecondsPerRepPlanning',v.support_seconds,
      'primaryExposure',v.exposure,
      'loadBasis','body mass distribution through a bilateral quadruped base and variant-specific finger or distal-palm contact; numeric values are conservative planning estimates only'),
    jsonb_build_object(
      'localMuscleFatigue',v.local_fatigue,'gripFatigue',v.grip,
      'technicalFatigueSensitivity',v.complexity,'impactAccumulation',1,
      'recoveryHours',12,'primaryFatigueSites',v.fatigue_sites,
      'cumulativeBudgetKeys',jsonb_build_array('complete_repetitions',
        'finger_pressure_seconds','palm_heel_lift_seconds',
        'hand_support_seconds','wrist_extension_support_seconds',
        'finger_or_palm_contact_faults','elbow_or_shoulder_support_faults',
        'floor_transfers','technical_faults','impact_contacts'),
      'downstreamInterference',jsonb_build_array(
        'same_session_tumbling_handstand_cartwheel_or_crawling',
        'grip_hanging_climbing_or_ninja_volume','pressing_or_overhead_volume',
        'wrist_finger_or_forearm_loading'),
      'recoveryBasis','planning estimate only; symptoms contact pressure and overlapping same-session and recent finger wrist grip and hand-support exposure govern selection'),
    jsonb_build_object(
      'trainingStimuli',v.training_stimuli,
      'stimulusDose',jsonb_build_object('sets',jsonb_build_array(1,2),
        'completeRepetitions',jsonb_build_array(5,12),
        'secondsPerRepetition',jsonb_build_array(1,3),
        'restSeconds',jsonb_build_array(30,75)),
      'weeklyExposure',jsonb_build_object('minimum',0,
        'maximumWithoutReview',7,'unit','sessions','contextDependent',TRUE),
      'prerequisites',jsonb_build_array(
        'safe_floor_entry_bilateral_hand_and_knee_support_and_exit',
        'comfortable_selected_finger_first_knuckle_palm_and_wrist_contacts',
        'organized_elbow_shoulder_scapular_and_trunk_support',
        'understands_selected_action_contact_count_and_stop_signal',
        'same_session_finger_wrist_grip_and_hand_support_budgets_fit'),
      'completionCriteria',v.completion_criteria,
      'sequenceRules',jsonb_build_array(
        'prepare_or_movement_intelligence_context_only',
        'select_one_exact_variant_and_count_only_its_complete_action',
        'do_not_hide_base_contact_action_laterality_support_load_or_assessment_changes_as_modifiers',
        'revalidate_downstream_finger_wrist_grip_and_hand_support_loading'),
      'pairingCompatibility',jsonb_build_object(
        'compatible',jsonb_build_array(
          'low_load_hand_support_preparation_when_budgets_fit',
          'light_non_hand_support_movement_after_safe_floor_exit'),
        'avoid',jsonb_build_array(
          'symptom_provoking_finger_knuckle_palm_or_wrist_loading',
          'fatiguing_tumbling_handstand_cartwheel_crawling_pressing_grip_hanging_or_climbing',
          'time_critical_output_when_the_drill_displaces_priority_work')),
      'interferenceRules',jsonb_build_array(
        'count_all_overlapping_finger_pressure_and_palm_lift_repetitions',
        'count_all_overlapping_hand_and_wrist_support_seconds_and_floor_transfers',
        'count_later_tumbling_handstand_cartwheel_crawling_pressing_grip_hanging_and_climbing',
        'stop_before_contact_pressure_range_support_or breathing_quality_changes'),
      'uncertaintyPolicy','When exact variant action contacts base finger or wrist tolerance symptoms downstream loading or available time is uncertain do not select; request clarification or choose a separately validated card.',
      'selectionStatus','candidate_review_only','selectable',TRUE,
      'phaseRoles',jsonb_build_array('prepare_and_access','movement_intelligence'),
      'selectionInputs',jsonb_build_array('workout objective','exact variant action and required contacts','floor transfer and bilateral hand support','finger first-knuckle palm and wrist tolerance','elbow shoulder scapular and trunk support','clean firm nonabrasive surface','dose duration and cumulative budgets','downstream hand support and grip work','coach sightline and scope'),
      'doseVariables',jsonb_build_array('complete_repetitions','pressure_or_lift_range','tempo','sets','rest_seconds'),
      'durationFormula','setup_and_briefing_seconds + sum(actual_variant_action_and_return_seconds) + rests + invalid_partial_symptom_or_substitution_seconds + station_reset_seconds',
      'substitutionRevalidation',jsonb_build_array('identity_variant_action_and_contacts','base_laterality_and_support_height','path_hold_padding_or_external_force','restrictions_symptoms_and_pressure','surface_floor_access_and_sightline','dose_actual_duration_and_cumulative_budgets','downstream_interference','persistence','coach_rendering','athlete_rendering'),
      'publicationQuarantined',TRUE,'humanReviewRequired',TRUE,
      'approvalsCreated',FALSE)
  FROM (VALUES
    (finger_variant,
      'quadruped-whole-hand-contact-finger-pressure-pulse',
      'Finger Pulses — Quadruped Pressure and Release',
      ARRAY['quadruped','bilateral','whole_hand_contact','finger_pressure_pulse']::TEXT[],
      24,18,22,22,12,10,6,14,2,
      'finger_pressure_increase_and_decrease_without_bounce',
      jsonb_build_array('bilateral_palms','all_fingers','bilateral_knees'),
      'one deliberate finger and first-knuckle pressure increase followed by release to the declared start',
      'palms fingers and knees remain supported while pressure increases through the fingers and flexed first knuckles then releases under control',
      jsonb_build_array('finger_and_first_knuckle_pressure','palmar_and_wrist_extension_support','elbow_shoulder_scapular_and_trunk_support'),
      jsonb_build_array('intrinsic_hand_and_digital_flexor_effort','wrist_and_hand_support','triceps','shoulder_girdle','trunk'),
      jsonb_build_array('low_load_finger_pressure_control','whole_hand_contact_awareness','quadruped_hand_support_control'),
      jsonb_build_array('exact_bilateral_quadruped_whole_hand_contact','finger_and_first_knuckle_pressure_increases_without_bounce','palms_and_fingers_remain_supported','controlled_pressure_release','organized_upper_limb_and_trunk_support','no_stop_symptoms')),
    (palm_variant,
      'quadruped-fingers-distal-palm-contact-palm-heel-lift-lower',
      'Palm Lifts — Quadruped Palm-Heel Lift and Lower',
      ARRAY['quadruped','bilateral','fingers_and_distal_palm_contact','palm_heel_lift_lower']::TEXT[],
      28,22,24,26,16,14,12,18,3,
      'palm_heel_lift_and_lower_with_fingers_and_distal_palm_supported',
      jsonb_build_array('all_fingers','distal_or_top_palms','bilateral_knees'),
      'one controlled bilateral palm-heel lift followed by a complete lower to the declared start',
      'fingers distal palms and knees remain supported while both palm heels lift under control and lower quietly without the whole hand leaving the floor',
      jsonb_build_array('concentrated_finger_and_distal_palm_pressure','palm_heel_lift_and_lower','wrist_extension_support','elbow_shoulder_scapular_and_trunk_support'),
      jsonb_build_array('intrinsic_hand_and_digital_flexor_effort','finger_and_distal_palm_contact','wrist_support','triceps','shoulder_girdle','trunk'),
      jsonb_build_array('controlled_palm_heel_lift_and_lower','finger_and_distal_palm_pressure_control','quadruped_hand_support_control'),
      jsonb_build_array('exact_bilateral_quadruped_fingers_and_distal_palm_contact','both_palm_heels_lift_without_bounce','fingers_and_distal_palms_remain_supported','complete_quiet_lower','organized_upper_limb_and_trunk_support','no_stop_symptoms'))
  ) v(id,variant_key,display_name,modifiers,complexity,physical,supervision,
      consequence,work_capacity,grip,eccentric,local_fatigue,support_seconds,
      action,contacts,
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
    jsonb_build_object('sets',p.sets,'completeRepetitions',p.reps,
      'tempo','controlled one to three seconds per complete selected action',
      'restSeconds',p.rest,'rpeCeiling',p.rpe,
      'countRule',p.count_rule,
      'invalidOrPartialAttempts','record but do not count'),
    p.quality_gate,
    ARRAY[
      'Stop for sharp, increasing, radiating, unfamiliar, finger-joint, knuckle, palm, or wrist pain or participant request.',
      'Stop for numbness, tingling, weakness, color, temperature, circulation, or hand-control change.',
      'Stop for chest or breathing concern, dizziness, faintness, nausea, visual change, or inability to communicate.',
      'Stop when required finger, palm, knee, wrist, elbow, shoulder, scapular, trunk, surface, or floor-transfer control is lost.',
      'Stop at the planned finger-pressure, palm-lift, hand-support, technical-fatigue, duration, or downstream-interference budget.'
    ]::TEXT[],
    p.coach,p.athlete,
    'Improved familiarity and repeatable control for the exact selected finger-pressure or palm-heel action in this workout context; no isolated tissue effect treatment prevention clearance structural change or transfer outcome is promised.',
    ARRAY['none']::TEXT[],
    jsonb_build_object('participantsPerStation',1,
      'stationType','fixed_floor_station','laneRequired',FALSE,
      'minimumSpace','one stationary quadruped station plus safe entry and exit',
      'setupSeconds',22,'transitionSeconds',10,'resetSeconds',8,
      'throughputRule','One athlete moves while the coach preserves hand close-up side and front-oblique sightlines; stagger floor entry and exit.',
      'surfaceRule','Clean firm flat dry stable nonslip nonabrasive hand-contact surface; optional stable cushioning is under knees only.',
      'coachSightline','Close hand view plus side and front-oblique views of wrist elbow shoulder scapular trunk and knee support.',
      'equipmentInspection',jsonb_build_array('none sentinel declared','clean firm nonabrasive hand surface','optional knee mat only','station clearance and cross traffic','communication and safe exit'),
      'accessibility','Use separate variant cards, close-up stills, a slower pace, fewer repetitions, more rest, or a separately authored alternative.'),
    '{}'::UUID[],'review',
    jsonb_build_object('formula','setup + briefing + sum(actual selected action and return seconds) + rest + invalid partial symptom substitution and reset seconds','estimatedSecondsPerRepetition',p.seconds_per_rep,'estimatedSetupSeconds',22,'estimatedTransitionSeconds',10,'estimatedResetSeconds',8,'mustPersistActualDuration',TRUE,'recomputeAfterSubstitution',TRUE),
    jsonb_build_object('scaleDown',jsonb_build_array('reduce complete repetitions','reduce pressure or lift height while preserving exact contacts','shift body mass back without changing quadruped base','slow the pace','increase rest','add stable knee cushioning only'),'scaleUp',jsonb_build_array('add repetitions within budget','increase only the selected pressure or lift range within control'),'neverSilentScale',jsonb_build_array('switch between finger pulse and palm lift','change base laterality support height or hand contacts','add finger lifts knuckle rolls wrist rocks holds padding load or manual force'),'revalidateAfterAnyChange',TRUE),
    jsonb_build_object('primaryUnit','complete_selected_repetition','record',jsonb_build_array('variant','planned_and_actual_complete_repetitions','pressure_or_lift_range','finger_pressure_seconds','palm_heel_lift_seconds','hand_and_wrist_support_seconds','required_contact_faults','elbow_shoulder_scapular_and_trunk_faults','tempo','rests','invalid_or_partial_attempts','floor_transfers','first_fault','symptoms','stop_reason','substitution','actual_duration'),'budgetAggregation',jsonb_build_array('complete_repetitions','finger_pressure_seconds','palm_heel_lift_seconds','hand_support_seconds','wrist_support_seconds','support_faults','floor_transfers','technical_fatigue','impact_contacts','downstream_hand_and_grip_work'),'invalidAttemptPolicy','Store invalid and partial attempts separately and exclude them from completed-repetition count.'),
    jsonb_build_object('preSession',jsonb_build_array('Confirm exact variant action required contacts and clean surface.','Check floor transfer finger knuckle palm wrist hand-support symptoms and downstream budgets.'),'during',jsonb_build_array('Watch required contact and the first pressure support or range fault.','Count only the selected complete pressure-release or lift-lower action and track actual support time.','Stop rather than forcing range pressure or testing symptoms.'),'after',jsonb_build_array('Record actual repetitions range support seconds first fault symptoms stops and substitutions.','Escalate content media safety or persistence issues under facility policy.'),'helpSignal','Athlete shifts weight back to unload when safe, removes the hands, stops, and asks for coach help; coach assists only within scope.')
  FROM (VALUES
    ('177efc75-addd-4360-84ad-e3de6eac37a8'::UUID,finger_variant,
      'prepare-quadruped-finger-pressure-pulses','prepare_and_access',
      'Quality-first low-load finger-pressure and whole-hand contact practice before compatible hand-support work.',82,84,
      jsonb_build_object('finger_pressure_access',88,'hand_support_preparation',82,'controlled_activation',84),
      1,8,40,3,
      'Count only a deliberate pressure increase through supported fingers and first knuckles followed by release while palms remain down; bounce contact loss palm lift or stop event does not count.',
      'Both palms, fingers, and knees stay down; pressure increases through the fingers without bouncing; wrist, elbow, shoulder, scapula, and trunk stay organized; release returns to the declared start without symptoms.',
      'Verify finger-pressure pulse, whole-hand contact, clean surface, comfortable wrist and knuckles, and downstream budget. Cue pressure then release without bounce; stop at first symptom or support fault.',
      'Hands and knees. Keep palms and fingers down. Press through your fingers, then ease the pressure. That is one. Stop for pain, tingling, dizziness, or lost contact.',2),
    ('21ece010-0521-463e-aba0-e12dd34714a4'::UUID,finger_variant,
      'movement-intelligence-quadruped-finger-pressure-pulses','movement_intelligence',
      'Deliberate finger-pressure grading, whole-hand contact, support, and count-boundary practice.',76,84,
      jsonb_build_object('pressure_awareness',90,'hand_contact_control',88,'movement_sequence',80),
      2,6,55,4,
      'Count only a controlled finger-pressure increase and release with palms and fingers supported; contact change bounce mixed palm-lift action incomplete release or stop event does not count.',
      'The athlete can name pressure-release, preserve whole-hand contact, grade pressure smoothly, maintain upper-body support, breathe, and return to the start without a symptom or stop event.',
      'Ask the athlete to name pressure-release and the contacts. Watch first-knuckle pressure, palm contact, wrist, elbow, shoulder, scapula, trunk, breath, release, and first fault.',
      'Name it: fingers press, then release; palms stay down. Move smoothly and count only the return. Stop for pain, tingling, dizziness, or lost contact.',2),
    ('a9642ebc-e1a0-46cb-a70b-71e29b25b0ae'::UUID,palm_variant,
      'prepare-quadruped-palm-heel-lifts','prepare_and_access',
      'Quality-first low-load palm-heel lift and finger/distal-palm contact practice before compatible hand-support work.',80,82,
      jsonb_build_object('palm_control_access',88,'finger_pressure_preparation',84,'controlled_activation',84),
      1,6,45,3,
      'Count only both palm heels lifting and lowering under control while fingers and distal palms remain down; whole-hand lift contact loss bounce missing lower or stop event does not count.',
      'Fingers, distal palms, and knees stay down; both palm heels lift a small controlled amount and lower quietly; wrist, elbow, shoulder, scapula, and trunk stay organized without symptoms.',
      'Verify palm-heel lift, fingers and distal palms down, clean surface, comfortable wrists and knuckles, and downstream budget. Cue a small lift and quiet lower; stop at first symptom or contact fault.',
      'Hands and knees. Keep fingers and the top of each palm down. Lift both palm heels a little, then lower quietly. Stop for pain, tingling, dizziness, or lost contact.',3),
    ('2d74940b-2017-45f9-a031-17d5bd0bf2bf'::UUID,palm_variant,
      'movement-intelligence-quadruped-palm-heel-lifts','movement_intelligence',
      'Deliberate palm-heel lift height, distal-hand pressure, support, and count-boundary practice.',74,84,
      jsonb_build_object('pressure_awareness',90,'palm_control',88,'movement_sequence',82),
      2,5,60,4,
      'Count only a controlled bilateral palm-heel lift and complete quiet lower with fingers and distal palms supported; mixed action contact loss bounce incomplete lower or stop event does not count.',
      'The athlete can name lift-lower, preserve finger and distal-palm contact, grade lift height smoothly, maintain support, breathe, and lower to the start without a symptom or stop event.',
      'Ask the athlete to name lift-lower and required contacts. Watch fingers, distal palms, palm heels, wrists, elbows, shoulders, scapula, trunk, breath, lower, and first fault.',
      'Name it: palm heels lift, then lower; fingers and top of palms stay down. Move quietly. Stop for pain, tingling, dizziness, or lost contact.',3)
  ) p(id,variant_id,profile_key,phase_key,purpose,suitability,alignment,
      objectives,sets,reps,rest,rpe,count_rule,quality_gate,coach,athlete,
      seconds_per_rep)
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
    (1,canonical_definition,capacity_definition,'distinct_exercises',
      'Wrist / Forearm Capacity Series is a coach-selected composite that may include implements resistance directions or other tasks. Source 32 requires one exact unresisted quadruped finger-pressure or palm-heel action.',
      jsonb_build_object('migration',migration_key,
        'identityBoundary','exact_bodyweight_hand_action_vs_multi_exercise_capacity_series',
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_identity_equivalence',NULL,now()),
    (1,canonical_definition,lean_definition,'distinct_exercises',
      'Wrist Lean Isometric / Wrist Support Rock Hold uses a sustained endpoint or longer-lever support. Source 32 counts repeated finger-pressure release or palm-heel lift and lower actions.',
      jsonb_build_object('migration',migration_key,
        'identityBoundary','repeated_hand_action_vs_sustained_or_long_lever_wrist_support',
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_identity_equivalence',NULL,now()),
    (1,canonical_definition,orientation_definition,'distinct_exercises',
      'Quadruped Wrist Pronation-Supination Shifts changes hand orientation during loading. Source 32 retains forward hand orientation and changes only finger pressure or palm-heel height.',
      jsonb_build_object('migration',migration_key,
        'identityBoundary','fixed_forward_hand_action_vs_loaded_orientation_change',
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
    ('identity','https://gmb.io/wp-content/uploads/2025/02/GMB-Wrist-Strengthening-Cheatsheet.pdf','Wrist Strengthening Cheatsheet','GMB Fitness','expert_instruction','GMB numbers Finger Pulses and Palm Pulses as separate exercises and describes different pressure and contact actions.','direct family and action-boundary context','The source does not establish the Vortex quadruped base every contact count boundary or identity decision.',78),
    ('taxonomy','https://gmb.io/wp-content/uploads/2025/02/GMB-Wrist-Strengthening-Cheatsheet.pdf','Wrist Strengthening Cheatsheet','GMB Fitness','expert_instruction','Both tasks use a supported hand base with active pressure control rather than wrist rocking.','direct support and action context','The source does not create Vortex movement-pattern or body-region taxonomy keys.',78),
    ('anatomy','https://gmb.io/wp-content/uploads/2025/02/GMB-Wrist-Strengthening-Cheatsheet.pdf','Wrist Strengthening Cheatsheet','GMB Fitness','expert_instruction','Finger pressure first-knuckle position palm contact palm-heel motion and upper-limb support are directly observable.','direct contact and joint-action context','The source does not measure muscle activation joint force tissue isolation or one required angle.',78),
    ('biomechanics','https://pubmed.ncbi.nlm.nih.gov/37794701/','Wrist Guards/Supports in Gymnastics: Are They Helping or Hurting You?','The American Journal of Sports Medicine','peer_reviewed_research','Gymnastics wrist angle and moment vary with hand-support conditions.','adjacent wrist-loading context','Back-handspring findings cannot be converted into force pressure or dose values for these light quadruped hand actions.',88),
    ('difficulty','https://gmb.io/wp-content/uploads/2025/02/GMB-Wrist-Strengthening-Cheatsheet.pdf','Wrist Strengthening Cheatsheet','GMB Fitness','expert_instruction','The two tasks have distinct observable contact and action demands.','direct exercise-complexity context','The source assigns no Vortex score and does not classify participant capability.',78),
    ('load_fatigue_recovery','https://pubmed.ncbi.nlm.nih.gov/37794701/','Wrist Guards/Supports in Gymnastics: Are They Helping or Hurting You?','The American Journal of Sports Medicine','peer_reviewed_research','Hand-support loading changes with task and support conditions so contacts and accumulated exposure must remain explicit.','adjacent loading context','The study does not quantify these variants fatigue threshold pressure or recovery interval.',88),
    ('constraints','https://pmc.ncbi.nlm.nih.gov/articles/PMC12804664/','Epidemiology and Risk Factors of Wrist Pain and Injury in Adolescent Artistic Gymnasts: A Systematic Review and Meta-analysis','Orthopaedic Journal of Sports Medicine','peer_reviewed_research','The review reports substantial wrist pain and injury burden in adolescent gymnastics with low-to-very-low certainty for risk-factor evidence.','symptom exposure and evidence-certainty context','The review does not create an age eligibility rule training threshold or exercise clearance.',92),
    ('dosage','https://gmb.io/wp-content/uploads/2025/02/GMB-Wrist-Strengthening-Cheatsheet.pdf','Wrist Strengthening Cheatsheet','GMB Fitness','expert_instruction','GMB gives 10 to 30 repetitions for Finger Pulses based on current feeling and upcoming work but no Palm Pulse dose.','limited example-dose context','The source does not validate the Vortex variant doses frequency recovery or cumulative budgets.',78),
    ('instructions','https://gmb.io/wp-content/uploads/2025/02/GMB-Wrist-Strengthening-Cheatsheet.pdf','Wrist Strengthening Cheatsheet','GMB Fitness','expert_instruction','GMB says to pressure through fingers with first knuckles bent without bouncing and separately to lift palms while fingers and the top hand remain pressed down.','direct action-instruction context','The source does not define every Vortex base contact count quality gate stop rule or persistence field.',78),
    ('safety_stop_rules','https://static.usagym.org/PDFs/about/wellness/exercise/wrist.pdf','Suggested Gymnastics Wrist Exercises','USA Gymnastics','governing_body','USA Gymnastics says to seek medical guidance when pain is present discontinue painful exercise and reduce work when form fails.','direct safety and quality context','The document does not replace facility emergency neurologic circulation trauma or clinical escalation policy.',88),
    ('programming','https://gmb.io/wp-content/uploads/2025/02/GMB-Wrist-Strengthening-Cheatsheet.pdf','Wrist Strengthening Cheatsheet','GMB Fitness','expert_instruction','GMB presents both tasks early in an optional wrist routine and says Finger Pulse volume depends on current feeling and work ahead.','Prepare and Access context only','The source does not establish phase exclusivity readiness prevention benefit progression order or downstream budget.',78),
    ('athlete_support','https://gmb.io/wp-content/uploads/2025/02/GMB-Wrist-Strengthening-Cheatsheet.pdf','Wrist Strengthening Cheatsheet','GMB Fitness','expert_instruction','The source provides short distinct pressure and lift instructions and explicitly prohibits bouncing in Finger Pulses.','participant communication context','It does not establish universal sensation meaning eligibility or every accessibility need.',78),
    ('coach_support','https://pmc.ncbi.nlm.nih.gov/articles/PMC12804664/','Epidemiology and Risk Factors of Wrist Pain and Injury in Adolescent Artistic Gymnasts: A Systematic Review and Meta-analysis','Orthopaedic Journal of Sports Medicine','peer_reviewed_research','The review supports taking wrist symptoms and cumulative gymnastics exposure seriously while noting uncertain thresholds.','coach monitoring and scope context','It does not prescribe these actions cues dose corrections diagnosis or clearance.',92),
    ('accessibility','https://gmb.io/wp-content/uploads/2025/02/GMB-Wrist-Strengthening-Cheatsheet.pdf','Wrist Strengthening Cheatsheet','GMB Fitness','expert_instruction','The two numbered tasks pair concise text with separate close hand images.','instruction-access context','The source does not validate every accommodation or silent support change.',78),
    ('alternates','https://gmb.io/wp-content/uploads/2025/02/GMB-Wrist-Strengthening-Cheatsheet.pdf','Wrist Strengthening Cheatsheet','GMB Fitness','expert_instruction','GMB separates Finger Pulses Palm Pulses Side-to-Side Palm Rotations wrist stretches and elbow rotations.','alternate action-boundary context','It does not adjudicate all twenty Vortex alternates or approve graph edges.',78),
    ('media','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en','Embed videos and playlists','YouTube Help','manufacturer_instruction','Four inherited candidates returned current YouTube oEmbed title channel thumbnail and iframe metadata on 2026-08-09.','candidate metadata and privacy-enhanced embed format only','oEmbed does not prove playback exact variant base contacts action count captions accessibility cue quality safety conflicts reviewer card-version match or approval.',82)
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
    'Current YouTube oEmbed metadata only. Playback exact finger-pressure pulse or palm-heel lift quadruped base contacts count pressure range captions accessibility cue quality safety conflicts reviewer identity card-version match and approval remain unverified.'
  FROM (VALUES
    ('TBvEMTrLLp8','How To Do Palm Lifts','Swift Movement Academy','inherited palm-lift title checked by YouTube oEmbed'),
    ('V9Lw__srIbM','Palm Pulses','Dani Winks Flexibility','inherited palm-pulse title checked by YouTube oEmbed'),
    ('WTcreH1yVjU','Upper Body Mobility: Palm Press Finger Lifts','Portland State Campus Rec','inherited adjacent finger-lift title checked by YouTube oEmbed'),
    ('nM7wB89NlwE','How To Do Finger Pulses | Exercise Demo','OriGym','inherited finger-pulse title checked by YouTube oEmbed')
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
    ('Finger Pulses Finger Pressure Pulses or Quadruped Finger Pulses','same_identity','Aliases fit only when bilateral quadruped whole-hand contact and one finger-pressure increase and release are exact.','finger_alias_exact',jsonb_build_array('alias','exact_finger_variant'),'merge_alias'),
    ('Palm Pulses Palm Lifts or Palm-Heel Lifts','same_identity','Aliases fit only when bilateral quadruped fingers and distal palms stay down during one palm-heel lift and lower.','palm_alias_exact',jsonb_build_array('alias','exact_palm_variant'),'merge_alias'),
    ('Smaller Pressure or Palm-Heel Height','modifier_annotation','Comfortable pressure or lift range changes dose while selected action contacts and return remain exact.','range_annotation',jsonb_build_array('pressure_or_lift_range'),'delivery_annotation'),
    ('Tempo Repetitions Sets or Rest','modifier_annotation','Pace volume and recovery change dose rather than identity.','dose_annotation',jsonb_build_array('tempo','repetitions','sets','rest'),'delivery_annotation'),
    ('Stable Knee Cushioning','modifier_annotation','A stable pad under the knees changes comfort without changing hand contact base or action.','knee_cushioning',jsonb_build_array('knee_comfort'),'delivery_annotation'),
    ('Comfortable Hand Spacing or Finger Spread','modifier_annotation','Spacing changes setup within comfort while forward orientation action contacts and count remain exact.','spacing_annotation',jsonb_build_array('hand_spacing','finger_spread'),'delivery_annotation'),
    ('Body-Mass Shift Back Within Quadruped','modifier_annotation','Shifting mass back reduces pressure only when knees and exact hand contacts action and count remain unchanged.','load_annotation',jsonb_build_array('body_mass_distribution'),'delivery_annotation'),
    ('Seated Finger Pulses or Palm Lifts','new_variant','Removing quadruped knee and trunk support changes bodyweight transfer floor access loading and setup.','seated_variant',jsonb_build_array('seated_base','changed_load'),'needs_human_review'),
    ('Standing Forward-Fold Finger Pulses','new_variant','Standing support changes balance posterior-chain range floor entry load and failure consequence.','standing_variant',jsonb_build_array('standing_fold','balance','changed_load'),'needs_human_review'),
    ('Tall-Plank Finger Pulses or Palm Lifts','new_variant','Toe support and long leverage materially increase hand wrist shoulder trunk and fatigue demand.','tall_plank_variant',jsonb_build_array('toe_support','long_leverage'),'needs_human_review'),
    ('Raised-Support Finger Pulses or Palm Lifts','new_variant','Wall bench box or other raised support changes equipment height load angle station and failure consequence.','raised_support_variant',jsonb_build_array('raised_support','equipment'),'needs_human_review'),
    ('Unilateral Finger Pulse or Palm Lift','new_variant','One-hand emphasis changes laterality load distribution trunk demand and failure consequence.','unilateral_variant',jsonb_build_array('unilateral','asymmetrical_load'),'needs_human_review'),
    ('Side-to-Side Palm Rotations or Knuckle Rolls','new_definition','Rolling pressure along the knuckles adds a lateral path direction checkpoints and asymmetrical contact.','knuckle_roll_distinct',jsonb_build_array('lateral_roll','sequential_knuckle_pressure'),'research_queue'),
    ('Palm Press Finger Lifts','new_definition','Lifting fingers while the palm remains supported reverses the moving contact and changes action and loading.','finger_lift_distinct',jsonb_build_array('finger_lift','palm_supported'),'research_queue'),
    ('Wrist Rockers — Palms Down','new_definition','Whole-palmar support with bodyweight rocking changes action range count and loading direction.','palms_down_distinct',jsonb_build_array('wrist_rock','whole_palm_support'),'existing_distinct_definition'),
    ('Wrist Rockers — Backs of Hands Down','new_definition','Dorsal-hand support and wrist-flexion rocking change hand surface action range and count.','palms_up_distinct',jsonb_build_array('dorsal_hand_support','wrist_flexion_rock'),'existing_distinct_definition'),
    ('Wrist Lean Isometric or Wrist Support Rock Hold','new_definition','A sustained endpoint or longer-lever support changes count duration load purpose and fatigue.','lean_hold_distinct',jsonb_build_array('sustained_hold','longer_leverage'),'existing_distinct_definition'),
    ('Quadruped Wrist Pronation-Supination Shifts','new_definition','Changing hand orientation during loading adds forearm rotation and multiple directional exposures.','orientation_shift_distinct',jsonb_build_array('orientation_change','pronation_supination'),'existing_distinct_definition'),
    ('Loaded Banded or Partner-Resisted Hand Pulses','new_definition','External or manual force changes magnitude direction equipment consent failure risk and scope.','loaded_manual_distinct',jsonb_build_array('external_or_manual_force','equipment','consent'),'research_queue'),
    ('Clinical Finger Wrist or Hand-Pressure Assessment','new_definition','Measurement adds examiner protocol clinical purpose outcomes consent and different escalation.','assessment_distinct',jsonb_build_array('measurement','clinical_scope'),'research_queue')
  ) a(name,classification,rationale,boundary_key,facts,proposed_status)
  ON CONFLICT(definition_id,reviewed_card_version,alternate_name) DO UPDATE SET
    classification=EXCLUDED.classification,rationale=EXCLUDED.rationale,
    distinguishing_dimensions=EXCLUDED.distinguishing_dimensions,
    proposed_card_json=EXCLUDED.proposed_card_json,
    review_status='candidate',reviewer_user_id=NULL,reviewed_at=NULL,
    updated_at=now();

  -- Preserve the two incoming wrist-rocker review proposals after replacing
  -- Source 32's ambiguous skeleton. These remain proposals, not approvals.
  INSERT INTO coaching.exercise_relationship_v1(
    from_variant_id,to_variant_id,relationship,similarity_score,dimensions,
    reason,conditions_json,review_status,created_by,reviewed_by,reviewed_at)
  SELECT r.from_id,finger_variant,'progression',r.score,
    ARRAY['complexity','load']::TEXT[],r.reason,
    jsonb_build_object('migration',migration_key,
      'preservedFromMigration',r.preserved_from,'reviewOnly',TRUE,
      'automaticSubstitution',FALSE,'humanReviewRequired',TRUE,
      'approvalsCreated',FALSE),
    'review',NULL,NULL,NULL
  FROM (VALUES
    (palms_down_variant,52,
      'Finger-pressure pulses add active finger and first-knuckle pressure while preserving palmar support and are only a contextual progression after exact identity symptoms dose and downstream work are revalidated.',
      '501_coaching_wrist_rockers_palms_down_family_audit_hardening'),
    (palms_up_variant,50,
      'Finger-pressure pulses change from dorsal-hand wrist-flexion rocking to palmar contact and active finger pressure and are only a contextual progression after exact identity symptoms dose and downstream work are revalidated.',
      '502_coaching_wrist_rockers_palms_up_family_audit_hardening')
  ) r(from_id,score,reason,preserved_from)
  ON CONFLICT(from_variant_id,to_variant_id,relationship) DO UPDATE SET
    similarity_score=EXCLUDED.similarity_score,dimensions=EXCLUDED.dimensions,
    reason=EXCLUDED.reason,conditions_json=EXCLUDED.conditions_json,
    review_status='review',created_by=NULL,reviewed_by=NULL,reviewed_at=NULL,
    updated_at=now()
  WHERE coaching.exercise_relationship_v1.reviewed_by IS NULL
    AND coaching.exercise_relationship_v1.review_status<>'approved';

  INSERT INTO coaching.exercise_relationship_v1(
    from_variant_id,to_variant_id,relationship,similarity_score,dimensions,
    reason,conditions_json,review_status,created_by,reviewed_by,reviewed_at)
  SELECT r.from_id,r.to_id,r.relationship,r.score,r.dimensions,r.reason,
    jsonb_build_object('migration',migration_key,'reviewOnly',TRUE,
      'automaticSubstitution',FALSE,
      'revalidate',jsonb_build_array('exact variant action and contacts',
        'base laterality support height path hold padding or force',
        'finger knuckle palm wrist and upper-limb symptoms',
        'surface floor access sightline and exit','purpose dose and duration',
        'finger wrist grip hand-support fatigue impact and downstream budgets',
        'persistence','coach rendering','athlete rendering'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'review',NULL,NULL,NULL
  FROM (VALUES
    (finger_variant,palm_variant,'progression',76,
      ARRAY['complexity','load','stability']::TEXT[],
      'Palm Lifts concentrate support through fingers and distal palms while adding a controlled palm-heel lift and lower; use only after the changed contacts pressure and count are revalidated.'),
    (palm_variant,finger_variant,'regression',76,
      ARRAY['complexity','load','stability']::TEXT[],
      'Finger Pulses retain whole-hand contact and use pressure grading rather than palm-heel lifting; use only when that changed action fits the purpose and all checks are rerun.'),
    (finger_variant,palms_down_variant,'lateral_substitution',44,
      ARRAY['range','complexity','stability']::TEXT[],
      'Palms-down wrist rocking changes from local finger-pressure pulses to whole-body forward-and-back wrist-extension loading and is only a contextual alternative after full revalidation.'),
    (palm_variant,lean_variant,'progression',58,
      ARRAY['load','fatigue','leverage']::TEXT[],
      'The wrist lean or support hold adds sustained duration or longer leverage and is only a progression after exact base hold count contact and cumulative exposure are selected.'),
    (palm_variant,orientation_variant,'lateral_substitution',42,
      ARRAY['range','complexity','decision_demand']::TEXT[],
      'Pronation-supination shifts change hand orientation and wrist forearm exposure and are only an alternative after the different action contacts and risks are revalidated.')
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
    (finger_variant,24,18,
      'Review-only exercise-complexity anchor based on exact bilateral quadruped base whole-hand contact finger and first-knuckle pressure increase controlled release support monitoring and count boundary.',
      'Review-only physical-difficulty anchor based on light partial-bodyweight finger palm wrist elbow shoulder and trunk support without impact external load or palm lifting.'),
    (palm_variant,28,22,
      'Review-only exercise-complexity anchor based on exact bilateral quadruped base fingers and distal palms supported simultaneous palm-heel lift quiet lower support monitoring and count boundary.',
      'Review-only physical-difficulty anchor based on concentrated partial-bodyweight finger and distal-palm pressure wrist support upper-limb and trunk stabilization and controlled lowering without impact or external load.')
  ) v(variant_id,complexity,physical,complexity_reason,physical_reason)
  CROSS JOIN (VALUES('technicalComplexity'),('absoluteLoadDemand')) d(dimension)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
    proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,
    reviewed_by=NULL,review_notes=EXCLUDED.review_notes,reviewed_at=NULL,
    updated_at=now();

  UPDATE coaching.exercise SET
    name='Finger Pulses / Palm Lifts',slug='finger-pulses',
    description='Select one bilateral quadruped variant. Finger Pulses keep both palms and fingers down while pressure through the fingers and flexed first knuckles increases then releases without bouncing. Palm Lifts keep the fingers and distal or top palms down while both palm heels lift slightly and lower under control. One complete pressure-release or lift-lower action is one repetition; never mix the actions silently.',
    instructions='Use one exact variant for the prescription. Verify clean firm nonslip hand contact, safe floor entry, finger knuckle palm wrist and upper-limb tolerance, and cumulative hand-support and grip work. For Finger Pulses, keep palms and fingers down, increase pressure through the fingers and first knuckles, then release. For Palm Lifts, keep fingers and distal palms down, lift both palm heels, then lower quietly. Stop for pain, skin irritation, neurologic or circulation symptoms, dizziness, worsening discomfort, contact or support loss, unsafe surface, or participant request.',
    skill_level=NULL,age_min=NULL,age_max=NULL,
    default_sets=1,default_reps=8,default_work_seconds=NULL,
    default_rest_seconds=45,
    tempo='controlled one to three seconds per complete selected repetition',
    load_note='Track exact variant, complete repetitions, finger-pressure or palm-lift seconds and range, hand and wrist support seconds, required contacts, support faults, floor transfers, rests, symptoms, invalid attempts, actual duration, and overlapping grip and hand-support work.',
    est_seconds_per_set=58,is_published=FALSE,archived=FALSE,
    card_summary='Two explicitly selected quadruped variants for finger-pressure pulses or controlled palm-heel lifts with exact contact and counting rules.',
    coach_language='Declare finger pressure or palm lift, inspect the hand surface, verify exact contacts and current symptoms, cue a small controlled action, count only the complete selected return, track actual hand-support exposure, and stop at the first contact, symptom, support, surface, or budget fault.',
    athlete_language='Choose one: press and release through your fingers with palms down, or lift and lower your palm heels with fingers down. Move without bouncing and stop for pain, tingling, dizziness, or lost contact.',
    programming_logic=jsonb_build_object(
      'selectionStatus','canonical_variant_required','selectable',TRUE,
      'canonicalDefinitionId',canonical_definition,
      'exactVariantIds',to_jsonb(active_variant_ids),
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'exerciseDifficultyDescribesTaskOnly',TRUE,
      'selectionInputs',jsonb_build_array('workout purpose','exact finger-pressure or palm-heel-lift variant','floor transfer and bilateral hand and knee support','finger first-knuckle palm wrist elbow shoulder and trunk tolerance','clean firm nonabrasive surface','dose actual duration cumulative finger wrist grip and hand-support budgets','downstream hand-support and grip work','coach scope and emergency route'),
      'substitutionRevalidation',jsonb_build_array('identity variant action contacts and count','base laterality support height path hold padding and force','restrictions symptoms pressure and skin','purpose dose fatigue impact and downstream budgets','duration surface floor logistics and sightline','persistence','coach rendering','athlete rendering'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    scalable_variables=ARRAY['exact_variant','complete_repetitions',
      'finger_pressure_or_palm_lift_range','body_mass_distribution','tempo',
      'rest_seconds','sets','stable_knee_cushioning']::TEXT[],
    movement_family='Bilateral Quadruped Hand Pressure Control',
    primary_phase_key=NULL,phase_subrole=NULL,primary_order_slot=NULL,
    movement_requirements=jsonb_build_object(
      'selectable',TRUE,'canonicalVariantRequired',TRUE,
      'impactLevel',0,'balanceDemand','stable_quadruped_hand_support',
      'breathingDemand','comfortable_no_breath_hold',
      'actions',jsonb_build_array('variant_specific_finger_pressure_increase_and_release_or_palm_heel_lift_and_lower','wrist_extension_support','elbow_and_shoulder_closed_chain_support','scapular_and_trunk_stabilization'),
      'planes',jsonb_build_array('sagittal_primary','multiplanar_stabilization'),
      'mustMaintain',jsonb_build_array('exact_variant_action','variant_specific_hand_contacts','bilateral_knee_support','controlled_non_bouncing_action','organized_upper_limb_and_trunk_support','comfortable_pressure_and_range','communication'),
      'mustNotAdd',jsonb_build_array('other_variant_action','seated_or_standing_base','tall_plank','unilateral_emphasis','finger_lifts_or_knuckle_rolls','wrist_rock_or_hold','raised_or_padded_hand_support','external_or_manual_force','clinical_assessment'),
      'validCompletion','one exact controlled finger-pressure increase and release or palm-heel lift and complete lower without mixed action contact loss support loss bounce or stop rule'),
    coaching_execution=jsonb_build_object(
      'qualityGates',jsonb_build_array('variant_and_count_exact','surface_and_station_safe','required_hand_and_knee_contacts_exact','pressure_or_lift_small_and_controlled','wrist_elbow_shoulder_scapular_and_trunk_supported','complete_release_or_lower','normal_breathing','no_stop_symptoms'),
      'stopRules',jsonb_build_array('sharp_increasing_radiating_unfamiliar_finger_joint_knuckle_palm_or_wrist_pain','skin_wound_or_abrasion','neurologic_circulation_color_temperature_or_hand_control_change','chest_or_breathing_concern','dizziness_faintness_nausea_visual_change_or_disorientation','required_contact_or_upper_limb_support_loss','wrong_or_mixed_action_bounce_or_forced_range','unsafe_surface_station_communication_or_exit','budget_or_duration_reached'),
      'persistence',jsonb_build_array('definition_card_and_variant_version','planned_and_actual_repetitions_pressure_or_lift_range_and_support_seconds','contacts_body_mass_tempo_rest_and_sets','valid_invalid_partial_and_symptom_limited_attempts','first_fault_symptoms_skin_and_stop_reason','duration_station_surface_and floor_transfer','substitution and revalidation','coach and athlete rendering version')),
    pairing_logic=jsonb_build_object(
      'sameSessionBudget',jsonb_build_array('complete_repetitions','finger_pressure_seconds','palm_heel_lift_seconds','hand_and_wrist_support_seconds','floor_transfers','technical_fatigue','finger_wrist_grip_and_forearm_exposure','downstream_hand_support','impact_contacts'),
      'avoidAutomaticPairingWith',jsonb_build_array('symptom_provoking_hand_or_wrist_loading','fatiguing_tumbling_handstand_cartwheel_crawling_pressing_or_grip_volume','hanging_climbing_ninja_or bar work when finger quality would fall','time_critical_output when this drill displaces priority work'),
      'revalidateAfterSubstitution',TRUE),
    media_library=jsonb_build_object(
      'candidate_video_ids',jsonb_build_array('TBvEMTrLLp8','V9Lw__srIbM','WTcreH1yVjU','nM7wB89NlwE'),
      'reviewState','oembed_metadata_only_candidate_quarantine',
      'playbackVariantBaseContactsActionCountCaptionsAccessibilityQualitySafetyAndApprovalVerified',FALSE,
      'humanReviewRequired',TRUE),
    programming_kind='exercise',linked_skill_id=NULL,why_publish_ready=FALSE,
    updated_at=now()
  WHERE id=32;

  UPDATE coaching.exercise_safety_profile SET
    risk_level=2,impact_level=0,minimum_age_recommended=NULL,
    minimum_skill_level=NULL,requires_spotting=FALSE,
    requires_coach_supervision='recommended',
    minimum_prerequisite_notes='Readiness is evaluated from safe floor entry, exact finger palm wrist and knee contacts, comfortable selected pressure or lift action, supported wrist elbow shoulder scapula and trunk, clean surface, current symptoms, communication, workout dose, and downstream finger grip and hand-support loading; never from participant classification.',
    readiness_checks=ARRAY[
      'Confirm exact Finger Pulse or Palm Lift variant, required contacts, clean firm nonslip nonabrasive surface, station clearance, sightline, communication, and safe exit.',
      'Confirm floor entry and exit, bilateral hand and knee support, comfortable finger first-knuckle palm and wrist contact, and organized elbow shoulder scapular and trunk support.',
      'Confirm the participant can name the selected action, identify which contacts stay down, count the complete release or lower, and use the stop signal.',
      'Review cumulative finger-pressure, palm-lift, wrist and hand-support seconds, grip or climbing work, technical fatigue, later tumbling handstand cartwheel crawling pressing and downstream loading.'
    ]::TEXT[],
    stop_signs=ARRAY[
      'Sharp increasing radiating unfamiliar finger-joint knuckle palm wrist elbow shoulder or other pain or participant stop request.',
      'Skin wound abrasion numbness tingling weakness color temperature circulation or hand-control change.',
      'Chest or breathing concern dizziness faintness nausea visual change disorientation or inability to communicate.',
      'Required finger palm or knee contact loss wrist elbow shoulder scapular or trunk support loss bounce mixed action or forced pressure cannot be corrected safely.',
      'Floor traction cleanliness temperature station sightline communication duration downstream budget or safe exit becomes inadequate.'
    ]::TEXT[],
    contraindications=ARRAY[
      'Current hand finger knuckle palm skin wrist upper-limb neurologic circulation trauma procedure or clinical restriction conflicts with the selected exact action.',
      'No clean firm nonslip nonabrasive surface safe floor entry bilateral support coach sightline communication or exit.',
      'The intended service is diagnosis treatment injury management readiness clearance manual assistance assessment or another exercise identity.'
    ]::TEXT[],
    common_substitutions=ARRAY[
      'Use the other Source 32 variant only after explicit reselection and full contact dose fatigue duration and rendering revalidation.',
      'Use Wrist Rockers only when whole-hand bodyweight rocking rather than local finger or palm-heel action matches the purpose and all checks are rerun.',
      'Use a separately authored raised-support non-floor neutral-wrist or non-hand-support task when exact floor contact does not fit.',
      'Do not silently change base laterality hand contact action support height path hold padding resistance manual force or clinical scope.'
    ]::TEXT[]
  WHERE exercise_id=32;

  UPDATE coaching.exercise_score_v1 SET
    technical_complexity=28,absolute_load_demand=22,
    coordination_demand=28,impact=1,supervision_demand=24,
    base_overall_difficulty=greatest(28,22),
    legacy_scores=coalesce(legacy_scores,'{}'::JSONB)||jsonb_build_object(
      'candidateReassessment',migration_key,
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'variantScores',jsonb_build_object(
        'quadrupedFingerPressurePulse',jsonb_build_object(
          'complexity',24,'physicalDifficulty',18,'overall',24),
        'quadrupedPalmHeelLiftLower',jsonb_build_object(
          'complexity',28,'physicalDifficulty',22,'overall',28)),
      'exerciseScoresDescribeTaskOnly',TRUE,
      'independentCalibrationRequired',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    migration_confidence=58,human_review_status='queued',
    reviewed_by=NULL,reviewed_at=NULL,
    review_notes='Research-informed candidates only. Scores describe exercise complexity and physical difficulty, not a participant. Identity anatomy loading and independent calibration remain required.',
    updated_at=now()
  WHERE exercise_id=32;

  UPDATE coaching.exercise_difficulty_profile SET
    technical=2.8,complexity=2.8,load=2.2,overall=2.8,
    recommended_age_min=NULL,recommended_age_max=NULL,
    attention_demand='low',
    notes='Candidate exact variants are 24/18/24 for Finger Pulses and 28/22/28 for Palm Lifts: exercise complexity physical difficulty and their derived maximum. These are task scores, not participant classifications.',
    source='canonical_research_candidate',updated_at=now()
  WHERE exercise_id=32;

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  VALUES(canonical_definition,1,2,'2.0.0',migration_key,'quarantined',
    jsonb_build_object(
      'identity',jsonb_build_object('passed',TRUE,
        'identityKey','explicit_quadruped_finger_pressure_or_palm_heel_action',
        'activeVariants',2,'archivedSourceSkeletons',1,
        'neighborBoundariesExplicit',5,'directDuplicateDefinitions',0,
        'combinedLegacyActionSplit',TRUE),
      'taxonomy',jsonb_build_object('passed',TRUE,'controlledTerms',TRUE,
        'movementPatterns',jsonb_build_array('brace','push'),
        'bodyRegions',9,'equipment',jsonb_build_array('none')),
      'anatomy',jsonb_build_object('passed',TRUE,
        'musclesJointsActionsPlanesLateralityContactsAndCountBoundary',TRUE,
        'measuredActivationOrForceClaimAbsent',TRUE),
      'difficulty',jsonb_build_object('passed',TRUE,
        'model','max_exercise_complexity_physical_difficulty',
        'fingerVector','24/18/24','palmVector','28/22/28',
        'participantClassificationAbsent',TRUE,
        'independentCalibrationRequired',TRUE),
      'loadFatigueRecovery',jsonb_build_object('passed',TRUE,
        'repetitionsPressureLiftAndSupportSecondsContactsFaultsFloorTransfersAndDownstreamExposureTracked',TRUE,
        'impactNone',TRUE,'recoveryIsPlanningEstimate',TRUE),
      'constraints',jsonb_build_object('passed',TRUE,
        'floorTransferHandContactsFingerKnucklePalmWristUpperLimbSurfaceSymptomsRestrictionsScopeAndExit',TRUE),
      'delivery',jsonb_build_object('passed',TRUE,'profiles',4,
        'prepareAndMovementIntelligenceForBothVariants',TRUE,
        'durationDoseRestStationAndSubstitutionRevalidation',TRUE),
      'instructions',jsonb_build_object('passed',TRUE,
        'athleteCoachAccessibilityAndSupportOperations',TRUE,
        'variantActionContactsCountStopsAndScope',TRUE),
      'research',jsonb_build_object('passed',TRUE,'sections',16,
        'registryVersion',research_version,
        'directSourcesDoNotCreateUniversalClaims',TRUE),
      'media',jsonb_build_object('passed',FALSE,'candidateCount',4,
        'currentOEmbedMetadataHealthy',TRUE,'playbackReviewed',FALSE,
        'exactVariantReviewed',FALSE,
        'captionsAccessibilityQualitySafetyAndApprovalReviewed',FALSE),
      'relationships',jsonb_build_object('passed',FALSE,'reviewOnly',5,
        'incomingPreserved',2,'approved',0,'automaticSubstitution',FALSE),
      'calibration',jsonb_build_object('passed',FALSE,'reviewOnly',4,
        'approved',0),
      'alternates',jsonb_build_object('passed',TRUE,'assessments',20,
        'baseActionContactLateralitySupportHeightPathHoldPaddingLoadAndScopeChangesQuarantined',TRUE),
      'generationSupport',jsonb_build_object('passed',TRUE,
        'selectionConstraints',TRUE,'cumulativeFatigueAndImpactBudgets',TRUE,
        'duration',TRUE,'surfaceAndStation',TRUE,
        'substitutionRevalidation',TRUE,
        'renderingAndPersistence',TRUE),
      'publication',jsonb_build_object('passed',FALSE,'reviewer',NULL,
        'approver',NULL)),
    jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01',
        'message','A qualified human must watch all four candidates in full and verify playback exact variant quadruped base hand and knee contacts pressure or lift action count range captions accessibility cue quality safety conflicts reviewer timestamp card version and approval rationale.'),
      jsonb_build_object('code','CARD-GRAPH-03',
        'message','A qualified coach must approve or reject all internal and wrist-neighbor relationships; no automatic substitution between changed action contacts base leverage hold load or purpose is authorized.'),
      jsonb_build_object('code','CARD-CALIBRATION-01',
        'message','An independent qualified reviewer must calibrate 24/18 and 28/22 exercise complexity and physical difficulty. Scores do not classify a participant or create an age or capability level.'),
      jsonb_build_object('code','CARD-PUBLISH-01',
        'message','A qualified reviewer and separate approver must complete content review before publication. Identity anatomy loading contact pressure wrist-risk scope dose stop accessibility persistence and support rules remain quarantined.')),
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
        AND body_regions=ARRAY['hand','wrist','elbow','shoulder','scapula','core','spine','hip','knee']::TEXT[]
        AND required_equipment=ARRAY['none']::TEXT[]
        AND jsonb_array_length(anatomy_json->'joints')>=9
        AND provenance_json->>'researchVersion'=research_version
        AND provenance_json->>'externalPlaybackVerificationPerformed'='false')
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
          WHERE definition_id=canonical_definition AND status='review'
            AND id=ANY(active_variant_ids))<>2
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
          WHERE definition_id=canonical_definition AND status='archived')<>1
    OR (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
          WHERE variant_id=ANY(active_variant_ids) AND status='review')<>4
    OR (SELECT count(*) FROM coaching.exercise_section_evidence_v1
          WHERE definition_id=canonical_definition
            AND reviewed_card_version=2 AND review_status='candidate')<>16
    OR (SELECT count(*) FROM coaching.exercise_media_candidate_v1
          WHERE definition_id=canonical_definition
            AND reviewed_card_version=2 AND review_status='candidate')<>4
    OR EXISTS(SELECT 1 FROM coaching.exercise_media_candidate_v1
          WHERE definition_id=canonical_definition AND reviewed_card_version=2
            AND (reviewer_user_id IS NOT NULL OR reviewed_at IS NOT NULL
              OR exact_variant_match IS NOT NULL
              OR demonstration_quality_score IS NOT NULL
              OR review_status<>'candidate'))
    OR (SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
          WHERE definition_id=canonical_definition
            AND reviewed_card_version=2 AND review_status='candidate')<>20
    OR (SELECT count(*) FROM coaching.exercise_relationship_v1
          WHERE from_variant_id=ANY(active_variant_ids)
            AND review_status='review' AND reviewed_by IS NULL)<>5
    OR (SELECT count(*) FROM coaching.exercise_relationship_v1
          WHERE from_variant_id=palms_down_variant
            AND review_status='review' AND reviewed_by IS NULL)<>4
    OR (SELECT count(*) FROM coaching.exercise_relationship_v1
          WHERE from_variant_id=palms_up_variant
            AND review_status='review' AND reviewed_by IS NULL)<>4
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1
          WHERE (from_variant_id=ANY(active_variant_ids)
              OR to_variant_id=ANY(active_variant_ids))
            AND (review_status='approved' OR reviewed_by IS NOT NULL
              OR reviewed_at IS NOT NULL))
    OR (SELECT count(*) FROM coaching.exercise_score_calibration_v1
          WHERE variant_id=ANY(active_variant_ids) AND status='review'
            AND reviewed_by IS NULL AND reviewed_at IS NULL)<>4
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
          WHERE survivor_definition_id=canonical_definition
            OR resolved_definition_id=canonical_definition)<>5
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=32
          AND name='Finger Pulses / Palm Lifts' AND is_published=FALSE
          AND archived=FALSE AND skill_level IS NULL
          AND age_min IS NULL AND age_max IS NULL
          AND linked_skill_id IS NULL AND programming_kind='exercise'
          AND programming_logic->>'difficultyModel'=
            'max_exercise_complexity_physical_difficulty')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1
          WHERE exercise_id=32 AND technical_complexity=28
            AND absolute_load_demand=22 AND base_overall_difficulty=28
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
