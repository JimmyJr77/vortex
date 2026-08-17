-- Source 30: replace the skeletal baseline with one exact bilateral palms-down,
-- fingers-forward quadruped forward/back wrist rocker. All research, media,
-- graph, calibration, content, and publication authority remains review-only.
DO $migration$
DECLARE
  migration_key CONSTANT TEXT := '501_coaching_wrist_rockers_palms_down_family_audit_hardening';
  research_version CONSTANT TEXT := '2026-08-09.97';
  canonical_definition UUID;
  source_variant UUID;
  rock_variant UUID;
  active_variant_ids UUID[];
  all_owned_variant_ids UUID[];
  palms_up_definition UUID;
  palms_up_variant UUID;
  finger_pulse_definition UUID;
  finger_pulse_variant UUID;
  lean_hold_definition UUID;
  lean_hold_variant UUID;
  orientation_definition UUID;
  orientation_variant UUID;
  protected_count INTEGER;
BEGIN
  SELECT definition_id INTO canonical_definition FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=30;
  SELECT id INTO source_variant FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='baseline';
  SELECT id INTO rock_variant FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='quadruped-palms-down-fingers-forward-forward-back';
  rock_variant := coalesce(rock_variant,gen_random_uuid());
  SELECT definition_id INTO palms_up_definition FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=31;
  SELECT id INTO palms_up_variant FROM coaching.exercise_variant_v1 WHERE definition_id=palms_up_definition AND variant_key='baseline';
  SELECT definition_id INTO finger_pulse_definition FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=32;
  SELECT id INTO finger_pulse_variant FROM coaching.exercise_variant_v1 WHERE definition_id=finger_pulse_definition AND variant_key='baseline';
  SELECT definition_id INTO lean_hold_definition FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=256;
  SELECT id INTO lean_hold_variant FROM coaching.exercise_variant_v1 WHERE definition_id=lean_hold_definition AND variant_key='baseline';
  SELECT definition_id INTO orientation_definition FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=796;
  SELECT id INTO orientation_variant FROM coaching.exercise_variant_v1 WHERE definition_id=orientation_definition AND variant_key='baseline';
  active_variant_ids := ARRAY[rock_variant];
  all_owned_variant_ids := ARRAY[source_variant,rock_variant];

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=30 AND facility_id=1)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition AND facility_id=1 AND legacy_exercise_id=30)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=30 AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source_variant AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=palms_up_variant AND definition_id=palms_up_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=finger_pulse_variant AND definition_id=finger_pulse_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=lean_hold_variant AND definition_id=lean_hold_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=orientation_variant AND definition_id=orientation_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1 WHERE exercise_id=30)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_difficulty_profile WHERE exercise_id=30)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_safety_profile WHERE exercise_id=30) THEN
    RAISE EXCEPTION '% prerequisite source or neighbor rows are missing',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=rock_variant AND definition_id<>canonical_definition)
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE slug='wrist-rockers-palms-down' AND id<>canonical_definition) THEN
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
        AND (reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL
          OR review_status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(all_owned_variant_ids)
        AND (reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL OR status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE (survivor_definition_id=canonical_definition
          OR resolved_definition_id=canonical_definition)
        AND (reviewed_by IS NOT NULL OR resolution_source='human_review')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_v1
      WHERE exercise_id=30
        AND (human_review_status<>'queued' OR reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL)
  ) protected;
  IF protected_count<>0 THEN
    RAISE EXCEPTION '% refuses to overwrite % human-reviewed records',migration_key,protected_count;
  END IF;

  UPDATE coaching.exercise_section_evidence_v1 SET
    review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now()
  WHERE definition_id=canonical_definition
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_media_candidate_v1 SET
    review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
    exact_variant_match=NULL,demonstration_quality_score=NULL,updated_at=now()
  WHERE definition_id=canonical_definition
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_alternate_assessment_v1 SET
    review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now()
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
        'sourceDisposition','canonical_forward_facing_palms_down_dynamic_rock_reauthored',
        'representedBySelectableSourceVariant',FALSE,
        'sourceInterpretation','source 30 supplies the quadruped palms-down forward/back action but omits exact count anatomy load fatigue constraints budgets logistics support calibration and review contracts',
        'exactWorkingSpecification','bilateral_quadruped_palms_down_fingers_forward_forward_and_back_wrist_rock',
        'researchSources',jsonb_build_array(
          'https://static.usagym.org/PDFs/about/wellness/exercise/wrist.pdf',
          'https://library.theprehabguys.com/vimeo-video/quadruped-wrist-flexion-extension-prom/',
          'https://pubmed.ncbi.nlm.nih.gov/37794701/',
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC12804664/'),
        'exerciseDifficultyDescribesTaskOnly',TRUE,
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=30 AND definition_id=canonical_definition;

  UPDATE coaching.exercise_delivery_profile_v1 SET status='archived',updated_at=now()
  WHERE variant_id=source_variant;
  UPDATE coaching.exercise_variant_v1 SET
    variant_key='identity-quarantine-source-30',
    display_name='Wrist Rockers Palms Down Legacy Skeleton — Source 30',
    modifier_keys='{}'::TEXT[],difficulty_json='{}'::JSONB,status='archived',
    requirements_json=jsonb_build_object(
      'selectable',FALSE,'representation','superseded_source_skeleton',
      'sourceLegacyExerciseId',30,
      'archiveReason','exact hand orientation count anatomy loading dose budgets logistics support and human-review contracts were missing',
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
    canonical_definition,1,30,'wrist-rockers-palms-down',
    'Wrist Rockers — Palms Down','Wrist Rockers — Palms Down',
    ARRAY['Wrist Rockers Palms Down','Wrist Rocks','Quadruped Wrist Extension Rocks','Forward-Facing Wrist Rockers'],
    'From a stable bilateral hands-and-knees base, place both palms flat with fingers spread and facing forward. Keep the elbows extended without forcing them and organize the shoulders and trunk. Shift the shoulders forward under control to a comfortable wrist-extension and hand-loading endpoint while both palms, fingers, and knees remain supported, then rock back to the starting load. One complete forward-and-back cycle is one repetition. Range, pace, a brief comfortable pause, repetitions, sets, rest, and stable knee cushioning are delivery annotations. Palms up, backs of hands down, fingers turned toward the knees or sides, unilateral loading, circles, palm lifts, sustained holds, tall-plank loading, raised hands, external force, or assessment changes the task.',
    'quadruped_forward_facing_palms_down_wrist_rock','2.0.0',2,'review',
    86,60,50,ARRAY['brace','push']::TEXT[],
    ARRAY['wrist','hand','elbow','shoulder','scapula','core','spine','hip','knee']::TEXT[],
    ARRAY['none']::TEXT[],ARRAY['mat']::TEXT[],
    jsonb_build_object(
      'surface','firm flat dry stable nonslip floor for both palms; optional stable cushioning may be placed under knees without changing the hand surface',
      'space','one stationary quadruped station with head shoulder elbow hip knee foot and safe floor-entry clearance and no cross traffic',
      'stationCapacity',1,'laneRequired',FALSE,'optionalEquipment','mat_for_knees_only',
      'coachSightline','side view for wrist angle and forward endpoint plus front oblique view for palm finger elbow shoulder and trunk support',
      'inspection',jsonb_build_array('firm hand-contact surface','traction dryness cleanliness and debris','optional knee mat flatness and movement','palm finger and knee clearance','cross traffic','communication sightline and emergency route','safe floor entry and exit'),
      'changeRule','Changing hand surface finger direction support height base laterality path hold external force purpose dose symptoms surface or downstream hand-support demand requires full identity selection duration logistics substitution persistence and rendering revalidation.'),
    jsonb_build_object(
      'exerciseCardDoesNotClassifyParticipants',TRUE,'readinessIsWorkoutInput',TRUE,
      'selectionPrerequisites',jsonb_build_array('safe floor entry bilateral palm and knee support and exit','comfortable controllable wrist extension under partial bodyweight','can keep palms and fingers supported while elbows shoulders scapula and trunk remain organized','understands forward and back completion count and stop signal','no conflicting trauma symptom restriction or service-scope concern'),
      'excludeOrEscalate',jsonb_build_array('current pain or recent significant trauma procedure or surgery without applicable guidance','sharp increasing radiating or unfamiliar wrist hand forearm elbow shoulder spine hip or knee symptoms','new numbness tingling weakness color or temperature change or loss of hand control','chest or breathing concern dizziness faintness nausea visual change or inability to communicate','floor transfer or palm loading cannot be performed without compensation','surface sightline communication or safe exit is inadequate','participant requests stop'),
      'notEstablishedByEvidence',jsonb_build_array('universal eligibility or age rule','one correct hand width finger spread wrist angle pressure distribution or range','universal dose frequency recovery or progression','treatment injury prevention readiness or structural outcome','numeric difficulty calibration or media exactness')),
    jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'canonicalAuthoredFromResearch',TRUE,
      'primaryIdentitySource','https://static.usagym.org/PDFs/about/wellness/exercise/wrist.pdf',
      'legacySources',jsonb_build_array(30),
      'identityContract','bilateral_quadruped_palms_flat_fingers_forward_controlled_forward_wrist_extension_load_then_backward_return_one_cycle_per_rep',
      'researchSources',jsonb_build_array(
        'https://static.usagym.org/PDFs/about/wellness/exercise/wrist.pdf',
        'https://library.theprehabguys.com/vimeo-video/quadruped-wrist-flexion-extension-prom/',
        'https://pubmed.ncbi.nlm.nih.gov/37794701/',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC12804664/'),
      'confidenceBySection',jsonb_build_object('identity',86,'taxonomy',82,'anatomy',74,'difficulty',60,'load',68,'fatigueRecovery',56,'constraints',84,'dosage',58,'instructions',86,'alternates',88,'media',50),
      'unresolvedClaims',jsonb_build_array('universal hand width finger spread wrist angle pressure range pace or breath phase','universal dose recovery benefit readiness or progression','numeric difficulty calibration','media playback exact setup count captions accessibility quality safety and approval'),
      'externalPlaybackVerificationPerformed',FALSE,'sourceLimitationsExplicit',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,'publicationQuarantined',TRUE),
    NULL,NULL,NULL,NULL,
    jsonb_build_object(
      'primaryMuscles',jsonb_build_array('wrist_flexor_group','wrist_extensor_group','finger_flexors','hand_intrinsics'),
      'secondaryMuscles',jsonb_build_array('triceps_brachii','anterior_deltoid','serratus_anterior','pectoralis_major','rectus_abdominis','obliques'),
      'stabilizers',jsonb_build_array('forearm_pronators_and_supinators','rotator_cuff','scapular_stabilizers','deep_trunk_stabilizers','hip_stabilizers','quadriceps'),
      'joints',jsonb_build_array('finger_interphalangeal_and_metacarpophalangeal','carpometacarpal','radiocarpal_and_midcarpal_wrist','radioulnar','elbow','glenohumeral','scapulothoracic','spinal_segments','hip','knee'),
      'jointActions',jsonb_build_array('increasing_and_decreasing_weight_bearing_wrist_extension','palm_and_finger_pressure_modulation','forearm_pronation_isometric','elbow_extension_isometric_support','shoulder_flexion_relative_to_trunk_and_closed_chain_stabilization','scapular_protraction_and_upward_rotation_control','trunk_anti_collapse','hip_and_knee_flexion_support','sagittal_center_of_mass_shift'),
      'planes',jsonb_build_array('sagittal_primary','multiplanar_stabilization'),
      'laterality','bilateral synchronous forward and backward weight shift',
      'supportContacts',jsonb_build_array('left_palm_and_fingers','right_palm_and_fingers','left_knee_and_shin','right_knee_and_shin'),
      'contactRule','Both palms and fingers and both knees remain supported through every counted cycle.',
      'countingBoundary','one controlled forward shift to a comfortable endpoint followed by a return to the declared starting load',
      'rangeRule','Use only the forward range that preserves palm finger elbow shoulder scapular trunk and symptom control; no target wrist angle is required.',
      'notClaimed',jsonb_build_array('quantified_joint_force','isolated_tissue_stretch','uniform_pressure_distribution','normal_range','treatment_prevention_or_readiness_effect')),
    jsonb_build_object(
      'whyItMatters','Provides one reproducible low-load wrist-extension and hand-support exposure when the workout calls for a dynamic forward-and-back quadruped rocker.',
      'primaryCue','Palms flat, fingers forward: move your shoulders forward only as far as control stays comfortable, then rock back to finish one rep.',
      'expectedSensations',jsonb_build_array('light hand forearm shoulder and trunk support effort','comfortable wrist and forearm loading or stretch','pressure shifting gradually toward the fingers'),
      'unexpectedSensations',jsonb_build_array('sharp increasing radiating or unfamiliar pain','numbness tingling weakness or hand-control change','dizziness faintness nausea visual or breathing concern','pinching forcing slipping or contact loss'),
      'painGuidance','Stop, unload the hands, signal the coach, and follow facility escalation policy; do not repeat to test pain or force range.',
      'selfChecks',jsonb_build_array('palms stay flat','fingers face forward and remain supported','elbows stay extended without forced lockout','shoulders and trunk stay organized','range stays comfortable','one forward-and-back cycle counts one repetition'),
      'accessibility',jsonb_build_array('front and side demonstration','two-frame forward and back count card','visual endpoint marker without requiring contact','smaller range fewer repetitions slower pace and more rest','stable cushioning under knees only','separately authored raised-support task when floor palm loading does not fit'),
      'mediaAlternatives',jsonb_build_array('written setup and count','still images at start and comfortable forward endpoint','coach demonstration from side and front oblique','auditory forward and back prompts'),
      'notReadinessOrClinicalClassification',TRUE),
    jsonb_build_object(
      'observationChecklist',jsonb_build_array('exact palms-down fingers-forward variant','firm surface and floor transfer','palm finger knee contacts','wrist range and pressure shift','elbow shoulder scapular and trunk support','forward endpoint and complete return','pace breathing symptoms first fault actual repetitions and support time'),
      'faultCorrections',jsonb_build_object('palmOrFingersLift','reduce forward range and re-establish the whole hand; do not count the partial attempt','elbowsBendOrShouldersCollapse','shorten range or reduce dose; stop if exact support cannot be restored','forcedOrBouncedEndpoint','slow down and use a smaller comfortable endpoint','painOrNeurologicSymptom','stop unload and escalate under facility policy','surfaceMoves','stop and close or correct the station'),
      'demonstrationPlan','Show safe floor entry, exact hand direction, whole-hand contact, one side-view forward-and-back repetition, a contact-loss fault, stop signal, and safe exit.',
      'groupManagement',jsonb_build_array('one athlete per stationary floor station','maintain side and front-oblique sightlines','stagger floor entry and exit','keep cross traffic outside hand-contact areas','record invalid partial symptom-limited and substituted work'),
      'modificationDecisionTree',jsonb_build_array('stop for pain neurologic dizziness or unsafe support','reduce forward range','reduce repetitions','slow pace','increase rest','add only stable knee cushioning','select a separately reviewed raised-support or different-action card'),
      'doNotUseWhen',jsonb_build_array('exact floor transfer or bilateral palm support is unavailable','wrist hand elbow shoulder or neurologic symptoms conflict','firm surface sightline communication or safe exit is inadequate','the intended task uses another hand surface orientation path hold base external force or clinical purpose'),
      'comprehensionQuestions',jsonb_build_array('Which way do your fingers face?','What completes one repetition?','What contacts stay down?','When do you stop?')),
    jsonb_build_object(
      'issueCategories',jsonb_build_array('identity_or_hand_orientation','content_or_cue','difficulty_or_dose','surface_or_floor_access','accessibility','media','symptom_or_incident','data_or_persistence'),
      'supportEscalation',jsonb_build_object('coach','correct setup range count dose and station within scope','facilityLead','quarantine repeated content surface media or data failures','clinicalOrEmergency','follow facility policy for pain neurologic trauma cardiopulmonary or urgent symptoms'),
      'retentionPolicy','Store definition and card version, exact variant, planned and actual complete cycles, forward range marker, wrist and hand-support seconds, palm finger elbow shoulder and trunk faults, pace, rests, invalid or partial attempts, first fault, symptoms, stop reason, substitution, duration, station incident, coach edits, and rendering version under facility policy.',
      'changeImpactPolicy','Any change to hand surface finger direction support height base path hold load dose stop media identity or symptom state invalidates cached selection and requires full revalidation.',
      'knownLimitations',jsonb_build_array('candidate research is not content approval','oEmbed is not playback or exactness review','difficulty load fatigue and recovery values are unapproved planning estimates','the card is not clinical clearance or treatment'),
      'feedbackQuestions',jsonb_build_array('Was hand orientation unmistakable?','Could coach and athlete count one repetition the same way?','Was the floor and wrist range requirement accurate?','Were stop and substitution choices actionable?')))
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
    rock_variant,canonical_definition,'quadruped-palms-down-fingers-forward-forward-back',
    'Wrist Rockers — Quadruped Palms Down, Fingers Forward',
    ARRAY['quadruped','palms_down','fingers_forward','dynamic_forward_back'],
    jsonb_build_object(
      'technicalComplexity',22,'absoluteLoadDemand',16,'physicalDifficulty',16,
      'coordinationDemand',22,'supervisionDemand',18,'failureConsequence',20,
      'impact',1,'workCapacityDemand',16,'baseOverallDifficulty',22,
      'overallFormula','max(exercise_complexity,physical_difficulty)',
      'scoresDescribeExerciseTaskOnly',TRUE,'independentCalibrationRequired',TRUE),
    jsonb_build_object(
      'selectable',TRUE,'base','bilateral_hands_and_knees','handSurface','palms_flat',
      'fingerDirection','forward','path','sagittal_forward_then_backward',
      'countRule','one_complete_forward_and_back_cycle','holdIsIdentity',FALSE,
      'mustMaintain',jsonb_build_array('firm_surface','both_palms_and_fingers_supported','both_knees_supported','elbows_extended_without_forcing','organized_shoulders_scapula_and_trunk','comfortable_range','controlled_return'),
      'mustNotAdd',jsonb_build_array('palms_up_or_back_of_hand_support','rear_or_side_facing_fingers','unilateral_emphasis','circles','palm_lifts','sustained_hold','tall_plank','raised_support','band_or_manual_force','clinical_assessment'),
      'invalidWhen',jsonb_build_array('hand_surface_or_direction_changes','contact_or_support_lost','range_forced_or_bounced','return_missing','stop_rule_occurs')),
    'review',
    jsonb_build_object(
      'gripDemand',8,'spinalLoading',6,'eccentricStress',8,
      'landingContactsPerRep',0,'externalLoadMethod','partial_bodyweight',
      'impactClass','none','handSupport',TRUE,
      'wristExtensionSecondsPerRepPlanning',4,'handSupportSecondsPerRepPlanning',5,
      'primaryExposure',jsonb_build_array('wrist_extension_under_partial_bodyweight','palm_and_finger_pressure','elbow_and_shoulder_closed_chain_support','scapular_and_trunk_stabilization','knee_and_shin_contact'),
      'loadBasis','body mass distribution and forward center-of-mass shift; numeric values are conservative planning estimates only'),
    jsonb_build_object(
      'localMuscleFatigue',12,'gripFatigue',8,'technicalFatigueSensitivity',22,
      'impactAccumulation',1,'recoveryHours',12,
      'primaryFatigueSites',jsonb_build_array('wrist_and_forearm','hand_support','triceps','shoulder_girdle','trunk'),
      'cumulativeBudgetKeys',jsonb_build_array('complete_cycles','wrist_extension_seconds','hand_support_seconds','forward_range_exposure','palm_or_finger_contact_faults','elbow_or_shoulder_support_faults','floor_transfers','technical_faults','impact_contacts'),
      'downstreamInterference',jsonb_build_array('same_session_tumbling_or_hand_support','pressing_or_overhead_volume','wrist_grip_or_forearm_loading','handstand_cartwheel_or_crawling_volume'),
      'recoveryBasis','planning estimate only; symptoms and overlapping same-session and recent wrist exposure govern selection'),
    jsonb_build_object(
      'trainingStimuli',jsonb_build_array('low_load_forward_facing_palms_down_wrist_extension_control','whole_hand_quadruped_support_control','forward_and_backward_pressure_shift_awareness'),
      'stimulusDose',jsonb_build_object('sets',jsonb_build_array(1,2),'completeCycles',jsonb_build_array(3,8),'secondsPerCycle',jsonb_build_array(3,6),'restSeconds',jsonb_build_array(0,60)),
      'weeklyExposure',jsonb_build_object('minimum',0,'maximumWithoutReview',7,'unit','sessions','contextDependent',TRUE),
      'prerequisites',jsonb_build_array('safe_floor_entry_bilateral_palm_and_knee_support_and_exit','comfortable_controllable_wrist_extension_under_partial_bodyweight','whole_hand_contact_with_organized_elbow_shoulder_scapular_and_trunk_support','understands_forward_and_back_completion_count_and_stop','same_session_wrist_and_hand_support_budgets_fit'),
      'completionCriteria',jsonb_build_array('exact_quadruped_palms_down_fingers_forward_setup','palms_fingers_and_knees_remain_supported','comfortable_controlled_forward_endpoint','complete_backward_return','organized_elbow_shoulder_scapular_and_trunk_support','no_stop_symptoms'),
      'sequenceRules',jsonb_build_array('prepare_or_movement_intelligence_context_only','count_only_complete_forward_and_backward_cycles','do_not_hide_hand_surface_direction_base_path_hold_load_or_assessment_changes_as_modifiers','revalidate_downstream_wrist_and_hand_support_loading'),
      'pairingCompatibility',jsonb_build_object('compatible',jsonb_build_array('low_load_floor_preparation_when_wrist_budgets_fit','light_locomotion_after_safe_floor_exit'),'avoid',jsonb_build_array('symptom_provoking_wrist_or_hand_loading','fatiguing_tumbling_handstand_cartwheel_crawling_pressing_or_grip_work','time_critical_output_when_the_drill_displaces_priority_work')),
      'interferenceRules',jsonb_build_array('count_all_overlapping_wrist_extension_seconds','count_all_overlapping_hand_support_seconds_and_floor_transfers','count_later_tumbling_handstand_cartwheel_crawling_pressing_grip_and_forearm_loading','stop_before_contact_range_or_support_quality_changes'),
      'uncertaintyPolicy','When exact hand surface finger direction base support wrist range symptoms downstream loading or available time is uncertain do not select; request clarification or choose a separately validated card.',
      'selectionStatus','candidate_review_only','selectable',TRUE,
      'phaseRoles',jsonb_build_array('prepare_and_access','movement_intelligence'),
      'selectionInputs',jsonb_build_array('workout objective','exact hand surface and finger direction','floor transfer and palm support','comfortable wrist range','elbow shoulder scapular and trunk support','firm surface','dose duration and cumulative wrist budgets','downstream hand support','coach sightline and scope'),
      'doseVariables',jsonb_build_array('complete_cycles','forward_range','tempo','brief_pause_seconds','sets','rest_seconds'),
      'durationFormula','setup_and_briefing_seconds + sum(actual_forward_endpoint_and_return_seconds) + rests + invalid_partial_symptom_or_substitution_seconds + station_reset_seconds',
      'substitutionRevalidation',jsonb_build_array('identity_hand_surface_and_direction','base_contacts_and_support_height','path_hold_or_external_force','restrictions_and_symptoms','surface_floor_access_and_sightline','dose_actual_duration_and_cumulative_wrist_budget','downstream_interference','persistence','coach_rendering','athlete_rendering'),
      'publicationQuarantined',TRUE,'humanReviewRequired',TRUE,'approvalsCreated',FALSE))
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
  SELECT p.id,rock_variant,p.profile_key,p.phase_key,'primary',p.purpose,
    p.suitability,p.alignment,p.objectives,
    jsonb_build_object('sets',p.sets,'completeCycles',p.reps,
      'tempo','controlled three to six seconds per complete forward-and-back cycle',
      'briefEndpointPauseSeconds','zero to two only while comfortable support remains exact',
      'restSeconds',p.rest,'rpeCeiling',p.rpe,
      'countRule','Count only a complete controlled forward shift and return with exact palms-down fingers-forward quadruped contacts. Contact loss, forced range, bounce, missing return, another task, or a stop event does not count.',
      'invalidOrPartialAttempts','record but do not count'),
    'Palms and fingers remain supported on a firm surface; fingers face forward; knees stay supported; elbows remain extended without forced lockout; shoulders scapula and trunk stay organized; forward range remains comfortable; the return reaches the declared start without a symptom or stop event.',
    ARRAY['Stop for sharp, increasing, radiating, or unfamiliar pain or participant request.',
      'Stop for numbness, tingling, weakness, color or temperature change, or loss of hand control.',
      'Stop for chest or breathing concern, dizziness, faintness, nausea, visual change, or inability to communicate.',
      'Stop when palm, finger, knee, elbow, shoulder, scapular, trunk, surface, or floor-transfer control is lost.',
      'Stop at the planned wrist-extension, hand-support, technical-fatigue, duration, or downstream-interference budget.']::TEXT[],
    p.coach,p.athlete,
    'Improved familiarity and repeatable control for this exact forward-facing palms-down quadruped rocker in the selected workout context; no treatment, prevention, clearance, structural change, or transfer outcome is promised.',
    ARRAY['none']::TEXT[],
    jsonb_build_object('participantsPerStation',1,'stationType','fixed_floor_station',
      'laneRequired',FALSE,'minimumSpace','one stationary quadruped station plus safe entry and exit',
      'setupSeconds',20,'transitionSeconds',10,'resetSeconds',8,
      'throughputRule','One athlete moves while the coach preserves side and front-oblique sightlines; stagger floor entry and exit.',
      'surfaceRule','Firm flat dry stable nonslip hand surface; optional stable cushioning is under knees only.',
      'coachSightline','Side and front-oblique view of hands wrists elbows shoulders scapula trunk knees and forward endpoint.',
      'equipmentInspection',jsonb_build_array('none sentinel declared','firm palm surface','optional knee mat only','station clearance and cross traffic','communication and safe exit'),
      'accessibility','Use a two-frame card, visual endpoint marker, smaller range, slower pace, fewer cycles, more rest, or a separately authored raised-support alternative.'),
    '{}'::UUID[],'review',
    jsonb_build_object('formula','setup + briefing + sum(actual forward endpoint and return seconds) + rest + invalid partial symptom substitution and reset seconds','estimatedSecondsPerCycle',p.seconds_per_rep,'estimatedSetupSeconds',20,'estimatedTransitionSeconds',10,'estimatedResetSeconds',8,'mustPersistActualDuration',TRUE,'recomputeAfterSubstitution',TRUE),
    jsonb_build_object('scaleDown',jsonb_build_array('reduce complete cycles','reduce forward range','slow the pace','increase rest','add stable knee cushioning only'),'scaleUp',jsonb_build_array('add cycles within budget','add a brief comfortable endpoint pause'),'neverSilentScale',jsonb_build_array('change hand surface or finger direction','change to unilateral circle hold tall plank or raised support','add band manual force or load'),'revalidateAfterAnyChange',TRUE),
    jsonb_build_object('primaryUnit','complete_forward_back_cycle','record',jsonb_build_array('variant','planned_and_actual_complete_cycles','forward_range_marker','wrist_extension_seconds','hand_support_seconds','brief_pause_seconds','palm_finger_elbow_shoulder_scapular_and_trunk_faults','tempo','rests','invalid_or_partial_attempts','floor_transfers','first_fault','symptoms','stop_reason','substitution','actual_duration'),'budgetAggregation',jsonb_build_array('complete_cycles','wrist_extension_seconds','hand_support_seconds','forward_range_exposure','support_faults','floor_transfers','technical_fatigue','impact_contacts','downstream_hand_support'),'invalidAttemptPolicy','Store invalid and partial attempts separately and exclude them from completed-cycle count.'),
    jsonb_build_object('preSession',jsonb_build_array('Confirm exact palms-down fingers-forward variant and firm hand surface.','Check floor transfer wrist symptoms support and downstream budgets.'),'during',jsonb_build_array('Watch whole-hand contact and the first support or range fault.','Count forward and back as one cycle and track actual support time.','Stop rather than forcing range or testing symptoms.'),'after',jsonb_build_array('Record actual cycles range support seconds first fault symptoms stops and substitutions.','Escalate content media safety or persistence issues under facility policy.'),'helpSignal','Athlete rocks back to unload when safe, stops, and asks for coach help; coach assists only within scope.')
  FROM (VALUES
    ('63e35a73-04c2-4d59-a3ab-9ec6e90dfe99'::UUID,'prepare-palms-down-wrist-rockers','prepare_and_access','Quality-first dynamic wrist-extension and hand-support exposure before compatible hand-contact work.',86,84,jsonb_build_object('wrist_access',92,'hand_support_preparation',86,'controlled_mobility',82),1,8,30,3,'Verify palms down, fingers forward, firm surface, comfortable range, and downstream wrist budget. Cue whole-hand contact, a slow forward shift, complete return, and stop at the first symptom or support fault.','Hands and knees. Palms flat, fingers forward. Rock forward only as far as comfortable, then rock back. That is one rep. Stop for pain, tingling, dizziness, or loss of control.',4),
    ('aed3a500-35fd-4bec-a411-5107396e0f76'::UUID,'movement-intelligence-palms-down-wrist-rockers','movement_intelligence','Deliberate whole-hand pressure, forward-range, support, and repetition-boundary practice.',78,84,jsonb_build_object('body_awareness',86,'hand_pressure_control',88,'movement_sequence',78),2,6,45,4,'Ask the athlete to name the hand direction and count. Preserve whole-hand pressure, elbows, shoulders, scapula, trunk, comfortable endpoint, breathing, and exact return.','Name it: palms down, fingers forward, forward and back is one. Move slowly enough to keep every contact and comfortable range. Stop for pain, tingling, dizziness, or loss of control.',5)
  ) p(id,profile_key,phase_key,purpose,suitability,alignment,objectives,sets,reps,rest,rpe,coach,athlete,seconds_per_rep)
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
    logistics_json=EXCLUDED.logistics_json,substitution_ids='{}'::UUID[],
    status='review',time_model_json=EXCLUDED.time_model_json,
    dose_scaling_json=EXCLUDED.dose_scaling_json,
    measurement_json=EXCLUDED.measurement_json,
    support_prompts_json=EXCLUDED.support_prompts_json,updated_at=now();

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,rationale,
    evidence_json,resolution_source,reviewed_by,resolved_at)
  VALUES
    (1,canonical_definition,palms_up_definition,'distinct_exercises',
      'Source 30 uses palms flat and forward-facing fingers to increase and decrease weight-bearing wrist extension. Source 31 places the backs of the hands down with fingers toward the knees for a wrist-flexion-biased action, changing contact surface, joint action, loading, and stops.',
      jsonb_build_object('migration',migration_key,'identityBoundary','palms_down_forward_facing_wrist_extension_rock_vs_backs_of_hands_wrist_flexion_bias','humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_identity_equivalence',NULL,now()),
    (1,canonical_definition,finger_pulse_definition,'distinct_exercises',
      'Finger Pulses and Palm Lifts use active finger or knuckle pressure and palm-heel lifting. Source 30 keeps the whole palm supported and moves the body forward and back.',
      jsonb_build_object('migration',migration_key,'identityBoundary','whole_hand_bodyweight_rock_vs_active_finger_pulse_or_palm_lift','humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_identity_equivalence',NULL,now()),
    (1,canonical_definition,lean_hold_definition,'distinct_exercises',
      'Wrist Lean Isometric or Wrist Support Rock Hold declares a sustained endpoint and may use a tall-plank base for capacity. Source 30 is one exact kneeling dynamic forward-and-back cycle with no sustained hold.',
      jsonb_build_object('migration',migration_key,'identityBoundary','kneeling_dynamic_complete_cycle_vs_sustained_hold_or_tall_plank_capacity','humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_identity_equivalence',NULL,now()),
    (1,canonical_definition,orientation_definition,'distinct_exercises',
      'Quadruped Wrist Pronation-Supination Shifts change hand orientation during loading. Source 30 keeps palms down and fingers forward through a sagittal forward-and-back path.',
      jsonb_build_object('migration',migration_key,'identityBoundary','fixed_forward_hand_orientation_vs_loaded_pronation_supination_orientation_changes','humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_identity_equivalence',NULL,now())
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
        'noUniversalTechniqueSafetyEligibilityDoseRecoveryOutcomeOrDifficultyClaim',TRUE)),
    e.quality,'candidate',NULL,NULL
  FROM (VALUES
    ('identity','https://static.usagym.org/PDFs/about/wellness/exercise/wrist.pdf','Suggested Gymnastics Wrist Exercises','USA Gymnastics','governing_body','USA Gymnastics separates palms-on-floor forward rocking for wrist extension from backs-of-hands backward rocking for wrist flexion.','direct identity and hand-surface context','The document does not adjudicate every Vortex wrist-card boundary hand position count or score.',88),
    ('taxonomy','https://library.theprehabguys.com/vimeo-video/quadruped-wrist-flexion-extension-prom/','Quadruped Wrist Flexion & Extension – PROM','The Prehab Guys','expert_instruction','The task uses a hands-and-knees braced base and controlled upper-extremity support during a sagittal body shift.','direct movement-pattern context','The source does not create Vortex taxonomy keys or prove one programming purpose.',78),
    ('anatomy','https://library.theprehabguys.com/vimeo-video/quadruped-wrist-flexion-extension-prom/','Quadruped Wrist Flexion & Extension – PROM','The Prehab Guys','expert_instruction','The described setup and weight shift visibly involve palms fingers wrists arms shoulder blades and trunk support.','direct position action and contact context','The source does not quantify muscle contribution joint force or tissue-specific stretch.',78),
    ('biomechanics','https://pubmed.ncbi.nlm.nih.gov/37794701/','Wrist Guards/Supports in Gymnastics: Are They Helping or Hurting You?','The American Journal of Sports Medicine','peer_reviewed_research','Gymnastics wrist extension angles and flexion moments vary with hand-support conditions.','adjacent wrist-loading context','Back-handspring findings cannot be converted into force angle or dose values for a low-load quadruped rocker.',88),
    ('difficulty','https://static.usagym.org/PDFs/about/wellness/exercise/wrist.pdf','Suggested Gymnastics Wrist Exercises','USA Gymnastics','governing_body','The kneeling palms-on-floor forward rock has a concise multi-contact setup and controlled range.','direct task-complexity context','The source assigns no Vortex score or participant capability level.',88),
    ('load_fatigue_recovery','https://pubmed.ncbi.nlm.nih.gov/37794701/','Wrist Guards/Supports in Gymnastics: Are They Helping or Hurting You?','The American Journal of Sports Medicine','peer_reviewed_research','Wrist loading depends on task and support conditions, so hand interface and accumulated exposure must be retained.','adjacent loading context','The study does not quantify this exercise load fatigue threshold or recovery interval.',88),
    ('constraints','https://pmc.ncbi.nlm.nih.gov/articles/PMC12804664/','Epidemiology and Risk Factors of Wrist Pain and Injury in Adolescent Artistic Gymnasts: A Systematic Review and Meta-analysis','Orthopaedic Journal of Sports Medicine','peer_reviewed_research','The review reports substantial wrist pain and injury burden in adolescent gymnastics and low-to-very-low certainty for available risk-factor evidence.','symptom exposure and evidence-certainty context','The review does not create an age eligibility rule training threshold or exercise clearance.',92),
    ('dosage','https://static.usagym.org/PDFs/about/wellness/exercise/wrist.pdf','Suggested Gymnastics Wrist Exercises','USA Gymnastics','governing_body','USA Gymnastics supplies a hold-based example and advises fewer repetitions or lighter work when form fails.','dose and quality context','It does not validate the dynamic Vortex cycle range frequency or recovery.',88),
    ('instructions','https://library.theprehabguys.com/vimeo-video/quadruped-wrist-flexion-extension-prom/','Quadruped Wrist Flexion & Extension – PROM','The Prehab Guys','expert_instruction','Prehab describes hands and knees fingers forward strong upper-body support slow forward shoulder travel over wrists and backward return.','direct instruction context','The source does not define every contact quality gate count persistence field or stop rule.',78),
    ('safety_stop_rules','https://static.usagym.org/PDFs/about/wellness/exercise/wrist.pdf','Suggested Gymnastics Wrist Exercises','USA Gymnastics','governing_body','USA Gymnastics says to seek guidance when pain is present discontinue painful exercise and reduce work when form breaks down.','direct safety and quality context','The document does not replace facility emergency neurologic trauma or clinical escalation policy.',88),
    ('programming','https://static.usagym.org/PDFs/about/wellness/exercise/wrist.pdf','Suggested Gymnastics Wrist Exercises','USA Gymnastics','governing_body','The task appears among wrist flexibility and strength exercises relevant to gymnastics.','Prepare and Access context only','The source does not establish phase exclusivity readiness prevention benefit or downstream budget.',88),
    ('athlete_support','https://library.theprehabguys.com/vimeo-video/quadruped-wrist-flexion-extension-prom/','Quadruped Wrist Flexion & Extension – PROM','The Prehab Guys','expert_instruction','Prehab uses a simple forward-over-wrists then back description and advises limiting range rather than forcing pain or significant discomfort.','participant communication context','It does not establish universal sensation meaning eligibility or all accessibility needs.',78),
    ('coach_support','https://pmc.ncbi.nlm.nih.gov/articles/PMC12804664/','Epidemiology and Risk Factors of Wrist Pain and Injury in Adolescent Artistic Gymnasts: A Systematic Review and Meta-analysis','Orthopaedic Journal of Sports Medicine','peer_reviewed_research','The review supports taking symptoms and cumulative gymnastics exposure seriously while noting uncertain thresholds.','coach monitoring and scope context','It does not prescribe this rocker cues dose corrections diagnosis or clearance.',92),
    ('accessibility','https://static.usagym.org/PDFs/about/wellness/exercise/wrist.pdf','Suggested Gymnastics Wrist Exercises','USA Gymnastics','governing_body','A concise one-page table supports a short written sequence paired with images or demonstration.','instruction-access context','The source does not validate every accommodation or a silent raised-support substitution.',88),
    ('alternates','https://static.usagym.org/PDFs/about/wellness/exercise/wrist.pdf','Suggested Gymnastics Wrist Exercises','USA Gymnastics','governing_body','USA Gymnastics separates palms-on-floor forward rocking and backs-of-hands backward rocking as different actions.','alternate identity boundary context','It does not adjudicate all twenty Vortex alternates or approve graph edges.',88),
    ('media','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en','Embed videos and playlists','YouTube Help','manufacturer_instruction','Five candidates returned current YouTube oEmbed title channel thumbnail and iframe metadata on 2026-08-09.','candidate metadata and privacy-enhanced embed format only','oEmbed does not prove playback exact hand setup forward-back count captions accessibility cue quality safety conflicts reviewer card-version match or approval.',82)
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
    'Current YouTube oEmbed metadata only. Playback palms-down fingers-forward quadruped setup exact forward-and-back cycle contacts range count captions accessibility cue quality safety conflicts reviewer identity card-version match and approval remain unverified.'
  FROM (VALUES
    ('9KYKYqoVBSA','How To Do The Wrist Rockers Mobility Exercise - Tangelo Health','Tangelo - Seattle Chiropractor + Rehab','legacy wrist-rockers candidate checked by YouTube oEmbed'),
    ('5mil82fqj30','Wrist Rocks | Wrist Exercise','Matthew Stevens','legacy exact-title candidate checked by YouTube oEmbed'),
    ('54khDyn0qn8','Quadruped Wrist Extension Rocks','Dr. Jordan Weber','exact quadruped wrist-extension candidate checked by YouTube oEmbed'),
    ('O_S9TKHwnsE','Wrist rocks','W10 Personal Training Gym','exact-title wrist-rock candidate checked by YouTube oEmbed'),
    ('4dRox1rxhfU','Wrist Rockers','Caroline Juster','exact-title wrist-rocker candidate checked by YouTube oEmbed')
  ) m(video_id,title,channel,query)
  ON CONFLICT(definition_id,reviewed_card_version,url) DO UPDATE SET
    variant_id=NULL,embed_url=EXCLUDED.embed_url,video_id=EXCLUDED.video_id,
    title=EXCLUDED.title,channel_name=EXCLUDED.channel_name,
    duration_seconds=NULL,language_code='en',captions_available=NULL,
    embedding_allowed=TRUE,exact_variant_match=NULL,
    demonstration_quality_score=NULL,link_status='healthy',
    review_status='candidate',discovery_method='manual_research',
    source_query=EXCLUDED.source_query,reviewer_user_id=NULL,reviewed_at=NULL,
    next_review_at=EXCLUDED.next_review_at,notes=EXCLUDED.notes,updated_at=now();

  INSERT INTO coaching.exercise_alternate_assessment_v1(
    definition_id,reviewed_card_version,alternate_name,classification,rationale,
    distinguishing_dimensions,proposed_card_json,review_status,
    reviewer_user_id,reviewed_at)
  SELECT canonical_definition,2,a.name,a.classification,a.rationale,
    jsonb_build_object('boundaryKey',a.boundary_key,'factsRequired',a.facts,
      'neverInferFromNameParticipantRankingOrContext',TRUE),
    jsonb_build_object('status',a.proposed_status,
      'classificationCandidate',a.classification,
      'humanIdentityContentAndSafetyReviewRequired',TRUE,'approvalsCreated',FALSE),
    'candidate',NULL,NULL
  FROM (VALUES
    ('Wrist Rockers Wrist Rocks or Quadruped Wrist Extension Rocks','same_identity','These aliases fit only when the exact bilateral palms-down fingers-forward quadruped forward-and-back cycle is stated.','family_aliases',jsonb_build_array('palms_down','fingers_forward','quadruped','forward_and_back'),'exact_contract_required'),
    ('Smaller Forward Range','modifier_annotation','Comfortable range changes dose while contacts hand orientation action and return remain exact.','range_annotation',jsonb_build_array('forward_range'),'delivery_annotation'),
    ('Tempo or Brief Comfortable Endpoint Pause','modifier_annotation','Controlled pace and a brief non-forced pause change exposure rather than identity.','tempo_annotation',jsonb_build_array('tempo','brief_pause'),'delivery_annotation'),
    ('Repetitions Sets or Rest','modifier_annotation','Volume and recovery change dose rather than the task.','dose_annotation',jsonb_build_array('repetitions','sets','rest'),'delivery_annotation'),
    ('Stable Knee Cushioning','modifier_annotation','A stable pad under the knees changes contact comfort without changing the firm palm-support surface or action.','knee_cushioning_annotation',jsonb_build_array('stable_knee_pad'),'delivery_annotation'),
    ('Wrist Rockers Palms Up or Flexor Bias','new_definition','Backs-of-hands support and wrist-flexion bias change contact surface action comfort load and stops.','palms_up_distinct',jsonb_build_array('dorsal_hand_contact','wrist_flexion_bias'),'existing_distinct_definition'),
    ('Rear-Facing Palms-Down Wrist Rock','new_variant','Fingers toward the knees change forearm rotation wrist line load direction and endpoint.','rear_facing_variant',jsonb_build_array('fingers_toward_knees','changed_force_line'),'needs_human_review'),
    ('Side-Facing Wrist Rock','new_variant','Lateral finger direction and side-to-side travel change plane and radial or ulnar loading.','side_facing_variant',jsonb_build_array('lateral_fingers','side_to_side'),'needs_human_review'),
    ('Quadruped Wrist Circles','new_definition','Circular center-of-pressure travel adds lateral checkpoints and direction counting.','circle_distinct',jsonb_build_array('circular_path','direction_count'),'research_queue'),
    ('Unilateral Wrist Rock','new_variant','One-hand emphasis changes laterality load distribution trunk demand and failure consequence.','unilateral_variant',jsonb_build_array('unilateral_emphasis','asymmetrical_load'),'needs_human_review'),
    ('Finger Pulses or Palm Lifts','new_definition','Active finger knuckle pressure and palm-heel lifting are distinct hand actions rather than bodyweight rocking.','finger_pulse_distinct',jsonb_build_array('finger_pulse','active_palm_lift'),'existing_distinct_definition'),
    ('Wrist Lean Isometric or Wrist Support Rock Hold','new_definition','A sustained endpoint or tall-plank base changes count duration leverage load purpose and fatigue.','lean_hold_distinct',jsonb_build_array('sustained_hold','tall_plank_capacity'),'existing_distinct_definition'),
    ('Quadruped Wrist Pronation-Supination Shifts','new_definition','Changing hand orientation during loading adds forearm rotation and multiple directional exposures.','orientation_shift_distinct',jsonb_build_array('pronation_supination','orientation_change'),'existing_distinct_definition'),
    ('Raised-Hand Wrist Rock','new_variant','Wall counter bench or box support changes equipment support height load joint angles station and fall consequence.','raised_support_variant',jsonb_build_array('raised_support','equipment','changed_load'),'needs_human_review'),
    ('Tall-Plank Wrist Rock or Planche Lean','new_definition','Toe support and longer leverage materially increase wrist shoulder trunk and fatigue demand.','tall_plank_distinct',jsonb_build_array('toe_support','long_leverage'),'research_queue'),
    ('Banded Wrist Mobilization Rock','new_definition','An anchored band changes joint force direction equipment setup contraindications and scope.','banded_distinct',jsonb_build_array('band','external_joint_force'),'research_queue'),
    ('Towel-under-Palm Wrist Rock','new_variant','Elevating the palm heel changes wrist angle and support interface rather than only knee comfort.','palm_elevation_variant',jsonb_build_array('palm_heel_elevation','changed_wrist_angle'),'needs_human_review'),
    ('Fist or Parallette Rock','new_definition','Neutral-wrist gripping support removes the exact flat-palm wrist-extension interface.','neutral_handle_distinct',jsonb_build_array('fist_or_handle','neutral_wrist'),'research_queue'),
    ('Loaded or Partner-Resisted Wrist Rock','new_definition','External load or manual force changes magnitude consent equipment failure risk and scope.','loaded_manual_distinct',jsonb_build_array('external_load_or_manual_force','consent'),'research_queue'),
    ('Clinical Wrist Range or Pain Assessment','new_definition','Measurement adds examiner protocol clinical purpose outcomes consent and different escalation.','assessment_distinct',jsonb_build_array('measurement','clinical_scope'),'research_queue')
  ) a(name,classification,rationale,boundary_key,facts,proposed_status)
  ON CONFLICT(definition_id,reviewed_card_version,alternate_name) DO UPDATE SET
    classification=EXCLUDED.classification,rationale=EXCLUDED.rationale,
    distinguishing_dimensions=EXCLUDED.distinguishing_dimensions,
    proposed_card_json=EXCLUDED.proposed_card_json,review_status='candidate',
    reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_relationship_v1(
    from_variant_id,to_variant_id,relationship,similarity_score,dimensions,reason,
    conditions_json,review_status,created_by,reviewed_by,reviewed_at)
  SELECT rock_variant,r.to_id,r.relationship,r.score,r.dimensions,r.reason,
    jsonb_build_object('migration',migration_key,'reviewOnly',TRUE,
      'automaticSubstitution',FALSE,
      'revalidate',jsonb_build_array('identity hand surface and finger direction','base contacts and support height','path hold external force or added actions','restrictions and symptoms','purpose dose and actual duration','wrist hand shoulder trunk fatigue and downstream budgets','surface floor access sightline and exit','persistence','coach rendering','athlete rendering'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'review',NULL,NULL,NULL
  FROM (VALUES
    (palms_up_variant,'lateral_substitution',38,ARRAY['range','joint_action','support']::TEXT[],'Palms-up flexor-biased rocking changes the hand surface and wrist action and is only a contextual alternative after exact identity symptoms range and support are revalidated.'),
    (finger_pulse_variant,'progression',52,ARRAY['complexity','load']::TEXT[],'Finger Pulses or Palm Lifts add active hand-pressure actions and are only a contextual progression when that changed purpose and dose fit.'),
    (lean_hold_variant,'progression',56,ARRAY['load','fatigue','leverage']::TEXT[],'The isometric or tall-plank wrist-support task adds sustained duration or leverage and is only a progression after the exact base hold count and cumulative exposure are selected.'),
    (orientation_variant,'lateral_substitution',44,ARRAY['range','coordination','joint_action']::TEXT[],'Pronation-supination shifts change hand orientation and wrist/forearm exposure and are only an alternative after those different actions and risks are revalidated.')
  ) r(to_id,relationship,score,dimensions,reason)
  ON CONFLICT(from_variant_id,to_variant_id,relationship) DO UPDATE SET
    similarity_score=EXCLUDED.similarity_score,dimensions=EXCLUDED.dimensions,
    reason=EXCLUDED.reason,conditions_json=EXCLUDED.conditions_json,
    review_status='review',created_by=NULL,reviewed_by=NULL,reviewed_at=NULL,
    updated_at=now()
  WHERE coaching.exercise_relationship_v1.reviewed_by IS NULL
    AND coaching.exercise_relationship_v1.review_status<>'approved';

  INSERT INTO coaching.exercise_score_calibration_v1(
    facility_id,variant_id,dimension,proposed_score,anchor_tier,rationale,status,
    version,created_by,reviewed_by,review_notes,reviewed_at)
  SELECT 1,rock_variant,d.dimension,d.score,20,d.rationale
      ||' This scores the exercise task, not a participant.',
    'review',1,NULL,NULL,
    'Research-informed proposal only; independent comparison and qualified human approval remain required.',NULL
  FROM (VALUES
    ('technicalComplexity',22,'Review-only exercise-complexity anchor based on exact quadruped setup whole-hand contact forward-facing fingers controlled forward endpoint complete return contact monitoring and count boundary.'),
    ('absoluteLoadDemand',16,'Review-only physical-difficulty anchor based on partial-bodyweight wrist extension palm and finger pressure elbow and shoulder support trunk stabilization floor transfer and controlled return without impact or external load.')
  ) d(dimension,score,rationale)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
    proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,
    reviewed_by=NULL,review_notes=EXCLUDED.review_notes,reviewed_at=NULL,
    updated_at=now();

  UPDATE coaching.exercise SET
    name='Wrist Rockers — Palms Down',slug='wrist-rockers-palms-down',
    description='Start on hands and knees on a firm nonslip surface. Place both palms flat with fingers spread and facing forward. Keep the elbows extended without forcing them. Shift the shoulders forward only to a comfortable wrist-extension and hand-loading endpoint, then rock back to the starting load. One complete forward-and-back cycle is one repetition.',
    instructions='Use the exact bilateral quadruped palms-down fingers-forward variant. Verify floor entry, firm hand surface, current wrist and upper-limb symptoms, comfortable range, cumulative wrist exposure, and downstream hand-support work. Keep palms and fingers supported, move forward without bouncing or forcing range, return fully, and stop for pain, neurologic symptoms, dizziness, worsening discomfort, contact or support loss, unsafe surface, or participant request.',
    skill_level=NULL,age_min=NULL,age_max=NULL,
    default_sets=1,default_reps=8,default_work_seconds=40,
    default_rest_seconds=30,tempo='controlled three to six seconds per complete cycle',
    load_note='Partial-bodyweight bilateral palm support only; record exact variant, range, complete cycles, wrist-extension and hand-support seconds, invalid or partial attempts, symptoms, stops, substitutions, actual duration, and overlapping wrist load.',
    est_seconds_per_set=75,is_published=FALSE,archived=FALSE,
    card_summary='Bilateral quadruped palms-down, fingers-forward dynamic wrist-extension rock with one forward-and-back cycle per repetition.',
    coach_language='Verify exact hand orientation, firm surface, floor access, symptom status, comfortable range, whole-hand and upper-body support, actual exposure, and downstream wrist budget. Count only complete controlled forward-and-back cycles and stop at the first symptom, contact, support, surface, or budget fault.',
    athlete_language='Hands and knees. Palms flat, fingers forward. Rock forward only as far as comfortable, then rock back. That is one rep. Stop for pain, tingling, dizziness, or loss of control.',
    programming_logic=jsonb_build_object(
      'selectionStatus','canonical_variant_required','selectable',TRUE,
      'canonicalDefinitionId',canonical_definition,
      'exactVariantIds',to_jsonb(active_variant_ids),
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'exerciseDifficultyDescribesTaskOnly',TRUE,
      'selectionInputs',jsonb_build_array('workout purpose','exact hand surface and finger direction','floor entry and palm support','comfortable wrist range','elbow shoulder scapular and trunk support','firm surface','dose actual duration cumulative wrist and downstream hand-support load','coach scope and emergency route'),
      'substitutionRevalidation',jsonb_build_array('identity hand surface and direction','base contacts support height path and hold','restrictions and symptoms','purpose and dose','fatigue impact and downstream budgets','duration','surface floor access and sightline','persistence','coach rendering','athlete rendering'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    scalable_variables=ARRAY['complete_cycles','forward_range','tempo','brief_endpoint_pause_seconds','rest_seconds','sets','knee_cushioning']::TEXT[],
    movement_family='Wrist Prep',
    primary_phase_key=NULL,phase_subrole=NULL,primary_order_slot=NULL,
    movement_requirements=jsonb_build_object(
      'selectable',TRUE,'canonicalVariantRequired',TRUE,'impactLevel',0,
      'balanceDemand','stable_quadruped_with_sagittal_weight_shift',
      'breathingDemand','comfortable_no_breath_hold',
      'actions',jsonb_build_array('bilateral_palm_and_knee_support','controlled_forward_center_of_mass_shift','increasing_weight_bearing_wrist_extension','controlled_backward_return'),
      'planes',jsonb_build_array('sagittal_primary','multiplanar_stabilization'),
      'mustMaintain',jsonb_build_array('palms_flat','fingers_forward','firm_surface','both_knees_supported','elbows_extended_without_forcing','organized_shoulders_scapula_and_trunk','comfortable_range','complete_return','communication'),
      'mustNotAdd',jsonb_build_array('palms_up_or_back_of_hand','rear_or_side_facing_fingers','unilateral_emphasis','circles','palm_lifts','sustained_hold','tall_plank','raised_support','band_or_manual_force','clinical_assessment'),
      'validCompletion','one controlled forward shift and complete backward return with exact contacts orientation comfortable range and no stop rule'),
    coaching_execution=jsonb_build_object(
      'qualityGates',jsonb_build_array('exact_palms_down_fingers_forward_identity','firm_surface_and_floor_transfer_safe','whole_hand_and_knee_contacts','elbows_shoulders_scapula_and_trunk_supported','comfortable_controlled_forward_endpoint','complete_return','no_stop_symptoms'),
      'stopRules',jsonb_build_array('sharp_increasing_radiating_or_unfamiliar_pain','numbness_tingling_weakness_color_temperature_or_hand_control_change','chest_or_breathing_concern','dizziness_faintness_nausea_visual_change_or_inability_to_communicate','palm_finger_knee_elbow_shoulder_scapular_or_trunk_support_loss','forced_or_bounced_range','unsafe_surface_floor_entry_or_exit','budget_or_duration_reached'),
      'persistence',jsonb_build_array('definition_card_and_variant_version','planned_and_actual_cycles_range_support_seconds_pause_tempo_rest_and_sets','valid_invalid_partial_and_symptom_limited_attempts','first_fault_symptoms_and_stop_reason','duration_surface_floor_entry_and_exit','substitution and revalidation','coach and athlete rendering version')),
    pairing_logic=jsonb_build_object(
      'sameSessionBudget',jsonb_build_array('complete_cycles','wrist_extension_seconds','hand_support_seconds','forward_range_exposure','support_faults','floor_transfers','technical_fatigue','downstream_hand_support','impact_contacts'),
      'avoidAutomaticPairingWith',jsonb_build_array('fatiguing_tumbling_handstands_cartwheels_or_crawling','high_wrist_grip_pressing_or_overhead_volume','same_session_wrist_or_forearm_capacity_that_exceeds_budget'),
      'revalidateAfterSubstitution',TRUE),
    media_library=jsonb_build_object(
      'candidate_video_ids',jsonb_build_array('9KYKYqoVBSA','5mil82fqj30','54khDyn0qn8','O_S9TKHwnsE','4dRox1rxhfU'),
      'reviewState','oembed_metadata_only_candidate_quarantine',
      'playbackExactHandSetupCountCaptionsAccessibilityQualitySafetyAndApprovalVerified',FALSE,
      'humanReviewRequired',TRUE),
    programming_kind='exercise',linked_skill_id=NULL,why_publish_ready=FALSE,
    updated_at=now()
  WHERE id=30;

  UPDATE coaching.exercise_safety_profile SET
    risk_level=2,impact_level=0,minimum_age_recommended=NULL,
    minimum_skill_level=NULL,requires_spotting=FALSE,
    requires_coach_supervision='recommended',
    minimum_prerequisite_notes='Readiness is evaluated from safe floor entry and exit, bilateral palm and knee support, comfortable weight-bearing wrist extension, elbow shoulder scapular and trunk control, exact hand orientation and count comprehension, current symptoms and restrictions, firm surface, workout dose, and downstream loading; never from participant classification.',
    readiness_checks=ARRAY[
      'Confirm the exact palms-down fingers-forward dynamic quadruped variant, firm dry nonslip hand surface, optional knee cushioning only, station clearance, sightline, communication, and safe floor entry and exit.',
      'Confirm comfortable bilateral palm and finger loading, wrist-extension range, elbow shoulder scapular and trunk support, and no conflicting current symptoms or restrictions.',
      'Confirm the participant can name the hand direction, count one complete forward-and-back cycle, avoid bouncing or forcing range, and use the stop signal.',
      'Review cumulative cycles, wrist-extension and hand-support seconds, floor transfers, support faults, later tumbling handstand cartwheel crawling pressing grip and forearm loading.'
    ]::TEXT[],
    stop_signs=ARRAY[
      'Sharp increasing radiating or unfamiliar wrist hand forearm elbow shoulder spine hip knee or other pain or participant stop request.',
      'Numbness tingling weakness color or temperature change or loss of hand control.',
      'Chest or breathing concern dizziness faintness nausea visual change or inability to communicate.',
      'Palm finger knee elbow shoulder scapular or trunk support is lost or range becomes forced bounced or progressively uncomfortable.',
      'Hand orientation path hold base or support height changes from the selected task.',
      'Firm surface station clearance sightline communication duration downstream budget or safe floor entry and exit becomes inadequate.'
    ]::TEXT[],
    contraindications=ARRAY[
      'Current symptom trauma procedure or clinical restriction conflicts with floor transfer bilateral palm support or wrist extension.',
      'No firm stable nonslip hand surface station clearance coach sightline communication or safe exit.',
      'The intended service is diagnosis treatment injury management readiness clearance manual assistance assessment or another exercise identity.'
    ]::TEXT[],
    common_substitutions=ARRAY[
      'Use a separately authored raised-support task only when its changed equipment load angle station and fall checks fit.',
      'Use Finger Pulses or Palm Lifts only when active hand pressure rather than bodyweight rocking matches the purpose and all checks are rerun.',
      'Use palms-up orientation-shift isometric or tall-plank wrist cards only when their distinct hand surface action load and dose fit and all checks are rerun.',
      'Do not silently turn the fingers change the hand surface add circles holds bands manual force or load.'
    ]::TEXT[]
  WHERE exercise_id=30;

  UPDATE coaching.exercise_score_v1 SET
    technical_complexity=22,absolute_load_demand=16,
    coordination_demand=22,impact=1,supervision_demand=18,
    base_overall_difficulty=greatest(22,16),
    legacy_scores=coalesce(legacy_scores,'{}'::JSONB)||jsonb_build_object(
      'candidateReassessment',migration_key,
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'variantScores',jsonb_build_object('quadrupedPalmsDownForwardBack',jsonb_build_object('complexity',22,'physicalDifficulty',16,'overall',22)),
      'exerciseScoresDescribeTaskOnly',TRUE,'independentCalibrationRequired',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    migration_confidence=60,human_review_status='queued',reviewed_by=NULL,
    reviewed_at=NULL,
    review_notes='Research-informed candidate reassessment only. Scores describe exercise complexity and physical difficulty, not a participant. Identity anatomy loading and independent calibration remain required.',
    updated_at=now()
  WHERE exercise_id=30;

  UPDATE coaching.exercise_difficulty_profile SET
    technical=2.2,complexity=2.2,load=1.6,overall=2.2,
    recommended_age_min=NULL,recommended_age_max=NULL,attention_demand='low',
    notes='Candidate exact variant is 22/16/22 for exercise complexity physical difficulty and their derived maximum. These are task scores, not participant classification.',
    source='canonical_research_candidate',updated_at=now()
  WHERE exercise_id=30;

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  VALUES(canonical_definition,1,2,'2.0.0',migration_key,'quarantined',
    jsonb_build_object(
      'identity',jsonb_build_object('passed',TRUE,'identityKey','quadruped_forward_facing_palms_down_wrist_rock','activeVariants',1,'archivedSourceSkeletons',1,'neighborBoundariesExplicit',4,'directDuplicateDefinitions',0),
      'taxonomy',jsonb_build_object('passed',TRUE,'controlledTerms',TRUE,'movementPatterns',jsonb_build_array('brace','push'),'bodyRegions',9,'equipment',jsonb_build_array('none'),'optionalKneeMatOnly',TRUE),
      'anatomy',jsonb_build_object('passed',TRUE,'musclesJointsActionsPlanesLateralityContactsAndCountBoundary',TRUE),
      'difficulty',jsonb_build_object('passed',TRUE,'model','max_exercise_complexity_physical_difficulty','variantVector','22/16/22','participantClassificationAbsent',TRUE,'independentCalibrationRequired',TRUE),
      'loadFatigueRecovery',jsonb_build_object('passed',TRUE,'cyclesRangeWristExtensionHandSupportContactsFaultsFloorTransfersAndDownstreamExposureTracked',TRUE,'impactNone',TRUE,'recoveryIsPlanningEstimate',TRUE),
      'constraints',jsonb_build_object('passed',TRUE,'floorTransferPalmSupportWristRangeElbowShoulderTrunkSurfaceSymptomsRestrictionsScopeAndExit',TRUE),
      'delivery',jsonb_build_object('passed',TRUE,'profiles',2,'prepareAndMovementIntelligence',TRUE,'durationDoseRestStationAndSubstitutionRevalidation',TRUE),
      'instructions',jsonb_build_object('passed',TRUE,'athleteCoachAccessibilityAndSupportOperations',TRUE,'handOrientationContactsRangeCountStopsAndScope',TRUE),
      'research',jsonb_build_object('passed',TRUE,'sections',16,'registryVersion',research_version,'directSourcesDoNotCreateUniversalClaims',TRUE),
      'media',jsonb_build_object('passed',FALSE,'candidateCount',5,'currentOEmbedMetadataHealthy',TRUE,'playbackReviewed',FALSE,'exactVariantReviewed',FALSE,'captionsAccessibilityQualitySafetyAndApprovalReviewed',FALSE),
      'relationships',jsonb_build_object('passed',FALSE,'reviewOnly',4,'approved',0,'automaticSubstitution',FALSE),
      'calibration',jsonb_build_object('passed',FALSE,'reviewOnly',2,'approved',0),
      'alternates',jsonb_build_object('passed',TRUE,'assessments',20,'supportOrientationPathHoldAndLoadChangesQuarantined',TRUE),
      'generationSupport',jsonb_build_object('passed',TRUE,'selectionConstraints',TRUE,'cumulativeFatigueAndImpactBudgets',TRUE,'duration',TRUE,'equipmentSurfaceAndStation',TRUE,'substitutionRevalidation',TRUE,'renderingAndPersistence',TRUE),
      'publication',jsonb_build_object('passed',FALSE,'reviewer',NULL,'approver',NULL)),
    jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01','message','A qualified human must watch all five candidates in full and verify playback palms-down fingers-forward quadruped setup exact forward-and-back cycle contacts range count captions accessibility cue quality safety conflicts reviewer timestamp card version and approval rationale.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','A qualified coach must approve or reject all palms-up finger-pulse lean-hold and orientation-shift relationships; no automatic substitution between changed hand surfaces actions holds bases loads or purposes is authorized.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','An independent qualified reviewer must calibrate 22/16 exercise complexity and physical difficulty. Scores do not classify a participant or create an age or capability level.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','A qualified reviewer and separate approver must complete content review before publication. Identity anatomy loading wrist-risk scope dose stop accessibility persistence and support rules remain quarantined.')),
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
        AND movement_patterns=ARRAY['brace','push']::TEXT[]
        AND body_regions=ARRAY['wrist','hand','elbow','shoulder','scapula','core','spine','hip','knee']::TEXT[]
        AND anatomy_json<>'{}'::JSONB AND environment_json<>'{}'::JSONB
        AND population_json<>'{}'::JSONB AND athlete_support_json<>'{}'::JSONB
        AND coach_support_json<>'{}'::JSONB AND support_operations_json<>'{}'::JSONB
        AND provenance_json->>'approvalsCreated'='false')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source_variant AND status='archived'
        AND requirements_json->>'representation'='superseded_source_skeleton')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=rock_variant AND definition_id=canonical_definition
        AND status='review' AND difficulty_json->>'scoresDescribeExerciseTaskOnly'='true'
        AND (difficulty_json->>'baseOverallDifficulty')::INT=greatest(
          (difficulty_json->>'technicalComplexity')::INT,
          (difficulty_json->>'absoluteLoadDemand')::INT))
    OR (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=rock_variant AND status='review'
        AND equipment_required=ARRAY['none']::TEXT[]
        AND time_model_json<>'{}'::JSONB AND dose_scaling_json<>'{}'::JSONB
        AND measurement_json<>'{}'::JSONB AND support_prompts_json<>'{}'::JSONB)<>2 THEN
    RAISE EXCEPTION '% canonical definition variant or profile assertion failed',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_section_evidence_v1
      WHERE definition_id=canonical_definition AND reviewed_card_version=2
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>16
    OR (SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=canonical_definition AND reviewed_card_version=2
        AND review_status='candidate' AND link_status='healthy'
        AND embedding_allowed IS TRUE AND exact_variant_match IS NULL
        AND demonstration_quality_score IS NULL
        AND reviewer_user_id IS NULL AND reviewed_at IS NULL)<>5
    OR (SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id=canonical_definition AND reviewed_card_version=2
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>20
    OR (SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE from_variant_id=rock_variant
        AND review_status='review' AND reviewed_by IS NULL)<>4
    OR (SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=rock_variant
        AND status='review' AND reviewed_by IS NULL AND reviewed_at IS NULL)<>2
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=canonical_definition
        AND decision='distinct_exercises' AND reviewed_by IS NULL)<>4
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=canonical_definition AND card_version=2
        AND status='quarantined' AND human_review_required IS TRUE
        AND jsonb_array_length(blocking_issues_json)=4) THEN
    RAISE EXCEPTION '% candidate research graph calibration identity or packet assertion failed',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition AND (status='published' OR approved_video_url IS NOT NULL
        OR reviewed_by IS NOT NULL OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_section_evidence_v1
      WHERE definition_id=canonical_definition AND review_status='reviewed')
    OR EXISTS(SELECT 1 FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=canonical_definition
        AND (review_status='approved' OR exact_variant_match IS NOT NULL
          OR reviewer_user_id IS NOT NULL OR reviewed_at IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1
      WHERE from_variant_id=rock_variant AND review_status='approved')
    OR EXISTS(SELECT 1 FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=rock_variant AND status='approved')
    OR EXISTS(SELECT 1 FROM coaching.exercise
      WHERE id=30 AND (is_published IS TRUE OR skill_level IS NOT NULL
        OR age_min IS NOT NULL OR age_max IS NOT NULL OR linked_skill_id IS NOT NULL)) THEN
    RAISE EXCEPTION '% fabricated approval publication or participant classification detected',migration_key;
  END IF;
END
$migration$;
