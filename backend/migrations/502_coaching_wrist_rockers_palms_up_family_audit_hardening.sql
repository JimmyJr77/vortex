-- Source 31: replace the skeletal baseline with one exact bilateral
-- backs-of-hands-down, palms-up, fingers-toward-knees quadruped wrist-flexion
-- rocker. Research, media, graph, calibration, content, and publication
-- authority remain human-review only.
DO $migration$
DECLARE
  migration_key CONSTANT TEXT := '502_coaching_wrist_rockers_palms_up_family_audit_hardening';
  research_version CONSTANT TEXT := '2026-08-09.98';
  canonical_definition UUID;
  source_variant UUID;
  rock_variant UUID;
  active_variant_ids UUID[];
  all_owned_variant_ids UUID[];
  palms_down_definition UUID;
  palms_down_variant UUID;
  finger_pulse_definition UUID;
  finger_pulse_variant UUID;
  lean_hold_definition UUID;
  lean_hold_variant UUID;
  orientation_definition UUID;
  orientation_variant UUID;
  protected_count INTEGER;
BEGIN
  SELECT definition_id INTO canonical_definition FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=31;
  SELECT id INTO source_variant FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='baseline';
  SELECT id INTO rock_variant FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='quadruped-backs-hands-down-palms-up-fingers-knees-back-forward';
  rock_variant := coalesce(rock_variant,gen_random_uuid());
  SELECT definition_id INTO palms_down_definition FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=30;
  SELECT id INTO palms_down_variant FROM coaching.exercise_variant_v1 WHERE definition_id=palms_down_definition AND variant_key='quadruped-palms-down-fingers-forward-forward-back';
  SELECT definition_id INTO finger_pulse_definition FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=32;
  SELECT id INTO finger_pulse_variant FROM coaching.exercise_variant_v1 WHERE definition_id=finger_pulse_definition AND variant_key='baseline';
  SELECT definition_id INTO lean_hold_definition FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=256;
  SELECT id INTO lean_hold_variant FROM coaching.exercise_variant_v1 WHERE definition_id=lean_hold_definition AND variant_key='baseline';
  SELECT definition_id INTO orientation_definition FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=796;
  SELECT id INTO orientation_variant FROM coaching.exercise_variant_v1 WHERE definition_id=orientation_definition AND variant_key='baseline';
  active_variant_ids := ARRAY[rock_variant];
  all_owned_variant_ids := ARRAY[source_variant,rock_variant];

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=31 AND facility_id=1)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition AND facility_id=1 AND legacy_exercise_id=31)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=31 AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source_variant AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=palms_down_variant AND definition_id=palms_down_definition
        AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=finger_pulse_variant AND definition_id=finger_pulse_definition
        AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=lean_hold_variant AND definition_id=lean_hold_definition
        AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=orientation_variant AND definition_id=orientation_definition
        AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1 WHERE exercise_id=31)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_difficulty_profile
      WHERE exercise_id=31)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_safety_profile
      WHERE exercise_id=31) THEN
    RAISE EXCEPTION '% prerequisite source or neighbor rows are missing',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=rock_variant AND definition_id<>canonical_definition)
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE slug='wrist-rockers-palms-up' AND id<>canonical_definition) THEN
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
      WHERE exercise_id=31
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
        'sourceDisposition','canonical_dorsal_hand_wrist_flexion_rock_reauthored',
        'representedBySelectableSourceVariant',FALSE,
        'sourceInterpretation','source 31 supplies the backs-of-hands palms-up backward-and-forward action but omits exact count anatomy load fatigue constraints budgets logistics support calibration and review contracts',
        'exactWorkingSpecification','bilateral_quadruped_backs_of_hands_down_palms_up_fingers_toward_knees_backward_and_forward_wrist_flexion_rock',
        'researchSources',jsonb_build_array(
          'https://gmb.io/wp-content/uploads/2025/02/GMB-Wrist-Strengthening-Cheatsheet.pdf',
          'https://static.usagym.org/PDFs/about/wellness/exercise/wrist.pdf',
          'https://pubmed.ncbi.nlm.nih.gov/37794701/',
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC12804664/'),
        'exerciseDifficultyDescribesTaskOnly',TRUE,
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=31 AND definition_id=canonical_definition;

  UPDATE coaching.exercise_delivery_profile_v1 SET
    status='archived',updated_at=now()
  WHERE variant_id=source_variant;
  UPDATE coaching.exercise_variant_v1 SET
    variant_key='identity-quarantine-source-31',
    display_name='Wrist Rockers Palms Up Legacy Skeleton — Source 31',
    modifier_keys='{}'::TEXT[],difficulty_json='{}'::JSONB,status='archived',
    requirements_json=jsonb_build_object(
      'selectable',FALSE,'representation','superseded_source_skeleton',
      'sourceLegacyExerciseId',31,
      'archiveReason','exact dorsal-hand surface finger direction count anatomy loading dose budgets logistics support and human-review contracts were missing',
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
    canonical_definition,1,31,'wrist-rockers-palms-up',
    'Wrist Rockers — Backs of Hands Down / Wrist-Flexion Bias',
    'Wrist Rockers — Backs of Hands Down / Wrist-Flexion Bias',
    ARRAY['Wrist Rockers — Palms Up / Flexor Bias','Wrist Rockers Palms Up',
      'Rear-Facing Palms-Up Wrist Stretch','Back-of-Hand Wrist Rocks',
      'Quadruped Wrist-Flexion Rocks'],
    'From a stable bilateral hands-and-knees base, place the backs of both hands on a clean firm nonabrasive surface with palms facing up and fingers pointing toward the knees. Keep the elbows extended without forced lockout and begin with very light pressure. Shift the hips and center of mass backward toward the heels under control only to a comfortable wrist-flexion and dorsal-hand-loading endpoint, then return forward to the declared starting load. One complete backward-and-forward cycle is one repetition. Range, pace, a brief comfortable pause, repetitions, sets, rest, and stable knee cushioning are delivery annotations. Palms down, changed finger direction, unilateral loading, circles, palm lifts, sustained holds, tall-plank loading, raised support, external force, or assessment changes the task.',
    'quadruped_rear_facing_palms_up_wrist_flexion_rock','2.0.0',2,'review',
    88,60,50,ARRAY['brace','push']::TEXT[],
    ARRAY['wrist','hand','elbow','shoulder','scapula','core','spine','hip','knee']::TEXT[],
    ARRAY['none']::TEXT[],ARRAY['mat']::TEXT[],
    jsonb_build_object(
      'surface','clean firm flat dry stable nonslip nonabrasive floor for the backs of both hands; optional stable cushioning may be placed under knees only',
      'space','one stationary quadruped station with head shoulder elbow hip knee foot and safe floor-entry clearance and no cross traffic',
      'stationCapacity',1,'laneRequired',FALSE,
      'optionalEquipment','mat_for_knees_only',
      'coachSightline','side view for wrist-flexion and backward endpoint plus front-oblique view for dorsal-hand finger elbow shoulder and trunk support',
      'inspection',jsonb_build_array('clean firm nonabrasive dorsal-hand surface',
        'traction dryness and debris','optional knee mat flatness and movement',
        'hand finger and knee clearance','cross traffic',
        'communication sightline and emergency route','safe floor entry and exit'),
      'changeRule','Changing hand surface finger direction support height base laterality path hold external force purpose dose symptoms surface or downstream wrist demand requires full identity selection duration logistics substitution persistence and rendering revalidation.'),
    jsonb_build_object(
      'exerciseCardDoesNotClassifyParticipants',TRUE,
      'readinessIsWorkoutInput',TRUE,
      'selectionPrerequisites',jsonb_build_array(
        'safe floor entry bilateral dorsal-hand and knee support and exit',
        'comfortable controllable wrist flexion under very light partial bodyweight',
        'can keep backs of hands and fingers supported while elbows shoulders scapula and trunk remain organized',
        'understands backward and forward completion count and stop signal',
        'no conflicting trauma symptom restriction or service-scope concern'),
      'excludeOrEscalate',jsonb_build_array(
        'current pain or recent significant trauma procedure or surgery without applicable guidance',
        'sharp increasing radiating or unfamiliar wrist hand forearm elbow shoulder spine hip or knee symptoms',
        'new numbness tingling weakness color temperature circulation or hand-control change',
        'chest or breathing concern dizziness faintness nausea visual change or inability to communicate',
        'floor transfer dorsal-hand support or wrist flexion cannot be performed without compensation',
        'surface sightline communication or safe exit is inadequate',
        'participant requests stop'),
      'notEstablishedByEvidence',jsonb_build_array(
        'universal eligibility or age rule',
        'one correct hand width finger spread wrist angle pressure distribution or range',
        'isolated wrist-flexor or wrist-extensor tissue effect',
        'universal dose frequency recovery progression treatment or prevention',
        'numeric difficulty calibration or media exactness')),
    jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'canonicalAuthoredFromResearch',TRUE,
      'primaryIdentitySource','https://gmb.io/wp-content/uploads/2025/02/GMB-Wrist-Strengthening-Cheatsheet.pdf',
      'researchSources',jsonb_build_array(
        'https://gmb.io/wp-content/uploads/2025/02/GMB-Wrist-Strengthening-Cheatsheet.pdf',
        'https://static.usagym.org/PDFs/about/wellness/exercise/wrist.pdf',
        'https://pubmed.ncbi.nlm.nih.gov/37794701/',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC12804664/'),
      'identityContract','bilateral_quadruped_dorsal_hands_down_palms_up_fingers_toward_knees_controlled_backward_wrist_flexion_load_then_forward_return_one_cycle_per_rep',
      'legacySources',jsonb_build_array(31),
      'confidenceBySection',jsonb_build_object(
        'identity',88,'taxonomy',84,'anatomy',76,'difficulty',60,'load',66,
        'fatigueRecovery',54,'constraints',86,'instructions',88,
        'alternates',88,'media',50,'dosage',56),
      'unresolvedClaims',jsonb_build_array(
        'universal hand width finger spread wrist angle pressure range pace or breath phase',
        'isolated muscle effect universal dose recovery benefit readiness or progression',
        'numeric difficulty calibration',
        'media playback exact setup count captions accessibility quality safety and approval'),
      'sourceLimitationsExplicit',TRUE,'publicationQuarantined',TRUE,
      'externalPlaybackVerificationPerformed',FALSE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    NULL,NULL,NULL,NULL,
    jsonb_build_object(
      'primaryMuscles',jsonb_build_array('wrist_extensor_group','finger_extensor_group','hand_intrinsics'),
      'stabilizers',jsonb_build_array('forearm_pronators_and_supinators',
        'triceps','rotator_cuff','scapular_stabilizers',
        'deep_trunk_stabilizers','hip_stabilizers','quadriceps'),
      'joints',jsonb_build_array('finger_interphalangeal_and_metacarpophalangeal',
        'carpometacarpal','radiocarpal_and_midcarpal_wrist','radioulnar',
        'elbow','glenohumeral','scapulothoracic','spinal_segments','hip','knee'),
      'jointActions',jsonb_build_array(
        'increasing_and_decreasing_weight_bearing_wrist_flexion',
        'dorsal_hand_and_finger_pressure_modulation',
        'forearm_supination_or_near_supination_isometric',
        'elbow_extension_isometric_support',
        'shoulder_position_and_closed_chain_stabilization',
        'scapular_protraction_control','trunk_anti_collapse',
        'hip_and_knee_flexion_support','sagittal_center_of_mass_shift'),
      'planes',jsonb_build_array('sagittal_primary','multiplanar_stabilization'),
      'laterality','bilateral synchronous backward and forward weight shift',
      'contacts',jsonb_build_array('backs_of_both_hands','fingers','both_knees',
        'optional_shins_or_feet'),
      'countBoundary','one controlled backward shift to the selected comfortable endpoint and complete forward return',
      'tissueClaimBoundary','Wrist-flexion bias describes the observable joint action. Muscle contribution and which tissue feels stretched vary and are not isolated or quantified.'),
    jsonb_build_object(
      'primaryCue','Backs of hands down, palms up, fingers toward your knees: move back only as far as comfortable, then return forward to finish one rep.',
      'selfChecks',jsonb_build_array('backs of both hands stay supported',
        'palms face up and fingers point toward knees',
        'elbows stay extended without forced lockout',
        'shoulders and trunk stay organized','pressure stays very light',
        'range stays comfortable',
        'one backward-and-forward cycle counts one repetition'),
      'expectedSensations',jsonb_build_array(
        'light dorsal-hand forearm shoulder and trunk support effort',
        'comfortable wrist and forearm stretch or loading',
        'pressure changing gradually across the backs of the hands'),
      'unexpectedSensations',jsonb_build_array(
        'sharp increasing radiating or unfamiliar pain',
        'numbness tingling weakness color temperature circulation or hand-control change',
        'dizziness faintness nausea visual or breathing concern',
        'pinching forcing abrasion slipping or contact loss'),
      'painGuidance','Stop, return forward to unload when safe, remove the hands, signal the coach, and follow facility escalation policy; do not repeat to test pain or force range.',
      'whyItMatters','Provides one reproducible low-load wrist-flexion and dorsal-hand support exposure when the workout explicitly calls for this exact dynamic task.',
      'accessibility',jsonb_build_array('front and side demonstration',
        'two-frame backward and forward count card',
        'visual endpoint marker without required contact',
        'smaller range fewer repetitions slower pace and more rest',
        'stable cushioning under knees only',
        'separately authored task when dorsal-hand floor support does not fit'),
      'mediaAlternatives',jsonb_build_array('written setup and count',
        'still images at start and comfortable backward endpoint',
        'coach demonstration from side and front oblique',
        'auditory back and forward prompts'),
      'notReadinessOrClinicalClassification',TRUE),
    jsonb_build_object(
      'observationChecklist',jsonb_build_array(
        'exact backs-of-hands-down palms-up fingers-toward-knees variant',
        'clean firm surface and floor transfer','dorsal-hand finger and knee contacts',
        'wrist-flexion range and pressure shift',
        'elbow shoulder scapular and trunk support',
        'backward endpoint and complete forward return',
        'pace breathing symptoms first fault actual repetitions and support time'),
      'faultCorrections',jsonb_build_object(
        'surfaceMovesOrAbrades','stop and close or correct the station',
        'handOrFingersLift','reduce backward range and re-establish contact; do not count the partial attempt',
        'forcedOrBouncedEndpoint','slow down reduce pressure and use a smaller comfortable endpoint',
        'painNeurologicOrCirculationSymptom','stop unload and escalate under facility policy',
        'elbowsBendOrShouldersCollapse','shorten range or reduce dose; stop if exact support cannot be restored'),
      'demonstrationPlan','Show safe floor entry, exact dorsal-hand and finger direction, very light pressure, one side-view backward-and-forward repetition, a contact-loss fault, stop signal, and safe exit.',
      'comprehensionQuestions',jsonb_build_array('Which surface of your hands is down?',
        'Which way do your fingers point?','What completes one repetition?',
        'When do you stop?'),
      'modificationDecisionTree',jsonb_build_array(
        'stop for pain neurologic circulation dizziness or unsafe support',
        'reduce backward range','reduce repetitions','slow pace','increase rest',
        'add only stable knee cushioning',
        'select a separately reviewed task when dorsal-hand contact does not fit'),
      'groupManagement',jsonb_build_array('one athlete per stationary floor station',
        'maintain side and front-oblique sightlines','stagger floor entry and exit',
        'keep cross traffic outside hand-contact areas',
        'record invalid partial symptom-limited and substituted work'),
      'doNotUseWhen',jsonb_build_array(
        'exact floor transfer or bilateral dorsal-hand support is unavailable',
        'wrist hand elbow shoulder neurologic or circulation symptoms conflict',
        'clean firm nonabrasive surface sightline communication or safe exit is inadequate',
        'the intended task uses another hand surface direction path hold base force or clinical purpose')),
    jsonb_build_object(
      'issueCategories',jsonb_build_array('identity_or_hand_surface',
        'content_or_cue','difficulty_or_dose','surface_or_floor_access',
        'accessibility','media','symptom_or_incident','data_or_persistence'),
      'supportEscalation',jsonb_build_object(
        'coach','correct setup range pressure count dose and station within scope',
        'facilityLead','quarantine repeated content surface media or data failures',
        'clinicalOrEmergency','follow facility policy for pain neurologic circulation trauma cardiopulmonary or urgent symptoms'),
      'retentionPolicy','Store definition and card version, exact variant, planned and actual complete cycles, backward range marker, wrist-flexion and dorsal-hand-support seconds, contact and support faults, pace, rests, invalid or partial attempts, first fault, symptoms, stop reason, substitution, duration, station incident, coach edits, and rendering version under facility policy.',
      'feedbackQuestions',jsonb_build_array('Was the hand surface and direction unmistakable?',
        'Could coach and athlete count one repetition the same way?',
        'Was the surface pressure and wrist-range requirement accurate?',
        'Were stop and substitution choices actionable?'),
      'knownLimitations',jsonb_build_array('candidate research is not content approval',
        'oEmbed is not playback or exactness review',
        'difficulty load fatigue and recovery values are unapproved planning estimates',
        'wrist-flexion bias is not an isolated muscle claim',
        'the card is not clinical clearance or treatment'),
      'changeImpactPolicy','Any change to hand surface finger direction support height base path hold load dose stop media identity or symptom state invalidates cached selection and requires full revalidation.')
  )
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
    environment_json=EXCLUDED.environment_json,
    population_json=EXCLUDED.population_json,
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
    rock_variant,canonical_definition,
    'quadruped-backs-hands-down-palms-up-fingers-knees-back-forward',
    'Wrist Rockers — Quadruped Backs of Hands Down, Fingers Toward Knees',
    ARRAY['quadruped','backs_of_hands_down','palms_up',
      'fingers_toward_knees','dynamic_backward_forward'],
    jsonb_build_object(
      'technicalComplexity',26,'absoluteLoadDemand',18,'physicalDifficulty',18,
      'coordinationDemand',26,'supervisionDemand',24,'failureConsequence',24,
      'impact',1,'workCapacityDemand',14,'baseOverallDifficulty',26,
      'overallFormula','max(exercise_complexity,physical_difficulty)',
      'scoresDescribeExerciseTaskOnly',TRUE,
      'independentCalibrationRequired',TRUE),
    jsonb_build_object(
      'selectable',TRUE,'base','bilateral_hands_and_knees',
      'handSurface','backs_of_hands_down','palms','up',
      'fingerDirection','toward_knees',
      'path','sagittal_backward_then_forward',
      'countRule','one_complete_backward_and_forward_cycle',
      'holdIsIdentity',FALSE,
      'mustMaintain',jsonb_build_array('clean_firm_nonabrasive_surface',
        'backs_of_both_hands_and_fingers_supported','both_knees_supported',
        'elbows_extended_without_forcing',
        'organized_shoulders_scapula_and_trunk','very_light_pressure',
        'comfortable_range','controlled_forward_return'),
      'mustNotAdd',jsonb_build_array('palms_down','forward_or_side_facing_fingers',
        'unilateral_emphasis','circles','palm_or_finger_lifts','sustained_hold',
        'tall_plank','raised_support','band_or_manual_force',
        'clinical_assessment'),
      'invalidWhen',jsonb_build_array('hand_surface_or_direction_changes',
        'contact_or_support_lost','range_forced_or_bounced',
        'forward_return_missing','stop_rule_occurs')),
    'review',
    jsonb_build_object(
      'gripDemand',4,'spinalLoading',6,'eccentricStress',10,
      'landingContactsPerRep',0,'externalLoadMethod','partial_bodyweight',
      'impactClass','none','dorsalHandSupport',TRUE,
      'wristFlexionSecondsPerRepPlanning',5,
      'dorsalHandSupportSecondsPerRepPlanning',6,
      'primaryExposure',jsonb_build_array(
        'wrist_flexion_under_light_partial_bodyweight',
        'dorsal_hand_and_finger_pressure',
        'elbow_and_shoulder_closed_chain_support',
        'scapular_and_trunk_stabilization','knee_and_shin_contact'),
      'loadBasis','body mass distribution and backward center-of-mass shift with deliberately light pressure; numeric values are conservative planning estimates only'),
    jsonb_build_object(
      'localMuscleFatigue',12,'gripFatigue',4,
      'technicalFatigueSensitivity',26,'impactAccumulation',1,
      'recoveryHours',12,
      'primaryFatigueSites',jsonb_build_array('wrist_and_forearm',
        'dorsal_hand_contact','triceps','shoulder_girdle','trunk'),
      'cumulativeBudgetKeys',jsonb_build_array('complete_cycles',
        'wrist_flexion_seconds','dorsal_hand_support_seconds',
        'backward_range_exposure','dorsal_hand_or_finger_contact_faults',
        'elbow_or_shoulder_support_faults','floor_transfers',
        'technical_faults','impact_contacts'),
      'downstreamInterference',jsonb_build_array(
        'same_session_tumbling_or_hand_support','pressing_or_overhead_volume',
        'wrist_grip_or_forearm_loading','handstand_cartwheel_or_crawling_volume'),
      'recoveryBasis','planning estimate only; symptoms dorsal-hand pressure and overlapping same-session and recent wrist exposure govern selection'),
    jsonb_build_object(
      'trainingStimuli',jsonb_build_array(
        'low_load_rear_facing_palms_up_wrist_flexion_control',
        'dorsal_hand_quadruped_support_control',
        'backward_and_forward_pressure_shift_awareness'),
      'stimulusDose',jsonb_build_object('sets',jsonb_build_array(1,2),
        'completeCycles',jsonb_build_array(3,6),
        'secondsPerCycle',jsonb_build_array(4,8),
        'restSeconds',jsonb_build_array(30,75)),
      'weeklyExposure',jsonb_build_object('minimum',0,
        'maximumWithoutReview',7,'unit','sessions','contextDependent',TRUE),
      'prerequisites',jsonb_build_array(
        'safe_floor_entry_bilateral_dorsal_hand_and_knee_support_and_exit',
        'comfortable_controllable_wrist_flexion_under_very_light_partial_bodyweight',
        'dorsal_hand_contact_with_organized_elbow_shoulder_scapular_and_trunk_support',
        'understands_backward_and_forward_completion_count_and_stop',
        'same_session_wrist_and_hand_support_budgets_fit'),
      'completionCriteria',jsonb_build_array(
        'exact_quadruped_backs_of_hands_down_palms_up_fingers_toward_knees_setup',
        'dorsal_hands_fingers_and_knees_remain_supported',
        'comfortable_controlled_backward_endpoint','complete_forward_return',
        'organized_elbow_shoulder_scapular_and_trunk_support',
        'no_stop_symptoms'),
      'sequenceRules',jsonb_build_array(
        'prepare_or_movement_intelligence_context_only',
        'count_only_complete_backward_and_forward_cycles',
        'do_not_hide_hand_surface_direction_base_path_hold_load_or_assessment_changes_as_modifiers',
        'revalidate_downstream_wrist_and_hand_support_loading'),
      'pairingCompatibility',jsonb_build_object(
        'compatible',jsonb_build_array(
          'low_load_floor_preparation_when_wrist_budgets_fit',
          'light_locomotion_after_safe_floor_exit'),
        'avoid',jsonb_build_array(
          'symptom_provoking_wrist_hand_or_dorsal_hand_loading',
          'fatiguing_tumbling_handstand_cartwheel_crawling_pressing_or_grip_work',
          'time_critical_output_when_the_drill_displaces_priority_work')),
      'interferenceRules',jsonb_build_array(
        'count_all_overlapping_wrist_flexion_and_extension_seconds',
        'count_all_overlapping_hand_support_seconds_and_floor_transfers',
        'count_later_tumbling_handstand_cartwheel_crawling_pressing_grip_and_forearm_loading',
        'stop_before_contact_pressure_range_or_support_quality_changes'),
      'uncertaintyPolicy','When exact hand surface finger direction base support wrist range pressure symptoms downstream loading or available time is uncertain do not select; request clarification or choose a separately validated card.',
      'selectionStatus','candidate_review_only','selectable',TRUE,
      'phaseRoles',jsonb_build_array('prepare_and_access',
        'movement_intelligence'),
      'selectionInputs',jsonb_build_array('workout objective',
        'exact dorsal-hand surface palm and finger direction',
        'floor transfer and dorsal-hand support','comfortable wrist range',
        'elbow shoulder scapular and trunk support',
        'clean firm nonabrasive surface',
        'dose duration and cumulative wrist budgets',
        'downstream hand support','coach sightline and scope'),
      'doseVariables',jsonb_build_array('complete_cycles','backward_range',
        'tempo','brief_pause_seconds','sets','rest_seconds'),
      'durationFormula','setup_and_briefing_seconds + sum(actual_backward_endpoint_and_forward_return_seconds) + rests + invalid_partial_symptom_or_substitution_seconds + station_reset_seconds',
      'substitutionRevalidation',jsonb_build_array(
        'identity_hand_surface_palm_and_direction','base_contacts_and_support_height',
        'path_hold_or_external_force','restrictions_symptoms_and_pressure',
        'surface_floor_access_and_sightline',
        'dose_actual_duration_and_cumulative_wrist_budget',
        'downstream_interference','persistence','coach_rendering',
        'athlete_rendering'),
      'publicationQuarantined',TRUE,'humanReviewRequired',TRUE,
      'approvalsCreated',FALSE))
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
  SELECT p.id,rock_variant,p.profile_key,p.phase_key,'primary',p.purpose,
    p.suitability,p.alignment,p.objectives,
    jsonb_build_object('sets',p.sets,'completeCycles',p.reps,
      'tempo','controlled four to eight seconds per complete backward-and-forward cycle',
      'briefEndpointPauseSeconds','zero to two only while comfortable very light support remains exact',
      'restSeconds',p.rest,'rpeCeiling',p.rpe,
      'countRule','Count only a complete controlled backward shift and forward return with exact backs-of-hands-down palms-up fingers-toward-knees quadruped contacts. Contact loss forced pressure bounce missing return another task or a stop event does not count.',
      'invalidOrPartialAttempts','record but do not count'),
    'Backs of both hands and fingers remain supported on a clean firm nonabrasive surface; palms face up; fingers point toward knees; knees stay supported; elbows remain extended without forced lockout; pressure and range remain comfortable; the forward return reaches the declared start without a symptom or stop event.',
    ARRAY[
      'Stop for sharp, increasing, radiating, or unfamiliar pain or participant request.',
      'Stop for numbness, tingling, weakness, color, temperature, circulation, or hand-control change.',
      'Stop for chest or breathing concern, dizziness, faintness, nausea, visual change, or inability to communicate.',
      'Stop when dorsal-hand, finger, knee, elbow, shoulder, scapular, trunk, surface, or floor-transfer control is lost.',
      'Stop at the planned wrist-flexion, dorsal-hand-support, technical-fatigue, duration, or downstream-interference budget.'
    ]::TEXT[],
    p.coach,p.athlete,
    'Improved familiarity and repeatable control for this exact rear-facing palms-up quadruped wrist-flexion rocker in the selected workout context; no isolated tissue effect treatment prevention clearance structural change or transfer outcome is promised.',
    ARRAY['none']::TEXT[],
    jsonb_build_object('participantsPerStation',1,
      'stationType','fixed_floor_station','laneRequired',FALSE,
      'minimumSpace','one stationary quadruped station plus safe entry and exit',
      'setupSeconds',24,'transitionSeconds',12,'resetSeconds',10,
      'throughputRule','One athlete moves while the coach preserves side and front-oblique sightlines; stagger floor entry and exit.',
      'surfaceRule','Clean firm flat dry stable nonslip nonabrasive dorsal-hand surface; optional stable cushioning is under knees only.',
      'coachSightline','Side and front-oblique view of dorsal hands wrists elbows shoulders scapula trunk knees and backward endpoint.',
      'equipmentInspection',jsonb_build_array('none sentinel declared',
        'clean firm nonabrasive dorsal-hand surface','optional knee mat only',
        'station clearance and cross traffic','communication and safe exit'),
      'accessibility','Use a two-frame card, visual endpoint marker, smaller range, lighter pressure, slower pace, fewer cycles, more rest, or a separately authored alternative.'),
    '{}'::UUID[],'review',
    jsonb_build_object(
      'formula','setup + briefing + sum(actual backward endpoint and forward return seconds) + rest + invalid partial symptom substitution and reset seconds',
      'estimatedSecondsPerCycle',p.seconds_per_rep,
      'estimatedSetupSeconds',24,'estimatedTransitionSeconds',12,
      'estimatedResetSeconds',10,'mustPersistActualDuration',TRUE,
      'recomputeAfterSubstitution',TRUE),
    jsonb_build_object(
      'scaleDown',jsonb_build_array('reduce complete cycles',
        'reduce backward range and pressure','slow the pace','increase rest',
        'add stable knee cushioning only'),
      'scaleUp',jsonb_build_array('add cycles within budget',
        'add a brief comfortable endpoint pause'),
      'neverSilentScale',jsonb_build_array(
        'change hand surface palm or finger direction',
        'change to unilateral circle hold tall plank raised or padded hand support',
        'add band manual force or load'),
      'revalidateAfterAnyChange',TRUE),
    jsonb_build_object('primaryUnit','complete_backward_forward_cycle',
      'record',jsonb_build_array('variant',
        'planned_and_actual_complete_cycles','backward_range_marker',
        'wrist_flexion_seconds','dorsal_hand_support_seconds',
        'brief_pause_seconds','dorsal_hand_finger_elbow_shoulder_scapular_and_trunk_faults',
        'pressure_tolerance','tempo','rests','invalid_or_partial_attempts',
        'floor_transfers','first_fault','symptoms','stop_reason',
        'substitution','actual_duration'),
      'budgetAggregation',jsonb_build_array('complete_cycles',
        'wrist_flexion_seconds','dorsal_hand_support_seconds',
        'backward_range_exposure','support_faults','floor_transfers',
        'technical_fatigue','impact_contacts','downstream_wrist_support'),
      'invalidAttemptPolicy','Store invalid and partial attempts separately and exclude them from completed-cycle count.'),
    jsonb_build_object(
      'preSession',jsonb_build_array(
        'Confirm exact backs-of-hands-down palms-up fingers-toward-knees variant and clean nonabrasive surface.',
        'Check floor transfer wrist hand symptoms dorsal-hand tolerance and downstream budgets.'),
      'during',jsonb_build_array(
        'Watch dorsal-hand and finger contact and the first pressure support or range fault.',
        'Count backward and forward as one cycle and track actual support time.',
        'Stop rather than forcing range pressure or testing symptoms.'),
      'after',jsonb_build_array(
        'Record actual cycles range support seconds pressure first fault symptoms stops and substitutions.',
        'Escalate content media safety or persistence issues under facility policy.'),
      'helpSignal','Athlete returns forward to unload when safe, removes the hands, stops, and asks for coach help; coach assists only within scope.')
  FROM (VALUES
    ('0f12a622-a65f-4c6b-8c0e-1d9bd9c69069'::UUID,
      'prepare-palms-up-wrist-flexion-rockers','prepare_and_access',
      'Quality-first low-pressure wrist-flexion and dorsal-hand support exposure before compatible work.',
      82,84,jsonb_build_object('wrist_access',88,
        'dorsal_hand_support_preparation',82,'controlled_mobility',84),
      1,5,45,2,
      'Verify backs of hands down, palms up, fingers toward knees, clean surface, very light pressure, comfortable range, and downstream wrist budget. Cue a slow backward shift, full return, and stop at the first symptom or support fault.',
      'Hands and knees. Backs of hands down, palms up, fingers toward knees. Move back only as far as comfortable, then return forward. Stop for pain, tingling, dizziness, or control loss.',
      6),
    ('a8251b38-3b63-4965-8a58-05229f23f5c5'::UUID,
      'movement-intelligence-palms-up-wrist-flexion-rockers',
      'movement_intelligence',
      'Deliberate dorsal-hand pressure, backward-range, support, and repetition-boundary practice.',
      74,82,jsonb_build_object('body_awareness',88,
        'dorsal_hand_pressure_control',86,'movement_sequence',80),
      2,4,60,3,
      'Ask the athlete to name the hand surface, palm direction, finger direction, and count. Preserve very light pressure, elbows, shoulders, scapula, trunk, comfortable endpoint, breathing, and exact return.',
      'Name it: backs of hands down, palms up, fingers toward knees; back and forward is one. Keep pressure light and range comfortable. Stop for pain, tingling, dizziness, or control loss.',
      7)
  ) p(id,profile_key,phase_key,purpose,suitability,alignment,objectives,
      sets,reps,rest,rpe,coach,athlete,seconds_per_rep)
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
    (1,canonical_definition,finger_pulse_definition,'distinct_exercises',
      'Finger Pulses and Palm Lifts use active finger or knuckle pressure and palm-heel lifting. Source 31 keeps the backs of the hands supported and shifts the body backward and forward.',
      jsonb_build_object('migration',migration_key,
        'identityBoundary','dorsal_hand_bodyweight_rock_vs_active_finger_pulse_or_palm_lift',
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_identity_equivalence',NULL,now()),
    (1,canonical_definition,lean_hold_definition,'distinct_exercises',
      'Wrist Lean Isometric or Wrist Support Rock Hold declares a sustained endpoint and may use a tall-plank base. Source 31 is one kneeling dynamic backward-and-forward cycle on the backs of the hands.',
      jsonb_build_object('migration',migration_key,
        'identityBoundary','kneeling_dorsal_hand_dynamic_cycle_vs_sustained_hold_or_tall_plank_capacity',
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_identity_equivalence',NULL,now()),
    (1,canonical_definition,orientation_definition,'distinct_exercises',
      'Quadruped Wrist Pronation-Supination Shifts change hand orientation during loading. Source 31 keeps palms up and fingers toward the knees through a sagittal backward-and-forward path.',
      jsonb_build_object('migration',migration_key,
        'identityBoundary','fixed_palms_up_rear_facing_orientation_vs_loaded_pronation_supination_changes',
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
    ('identity','https://gmb.io/wp-content/uploads/2025/02/GMB-Wrist-Strengthening-Cheatsheet.pdf','Wrist Strengthening Cheatsheet','GMB Fitness','expert_instruction','GMB separates rear-facing palms-down and rear-facing palms-up wrist stretches and gives the palms-up task its own setup and comfort warning.','direct identity and hand-surface context','The source does not adjudicate every Vortex wrist-card boundary count or score.',78),
    ('taxonomy','https://gmb.io/wp-content/uploads/2025/02/GMB-Wrist-Strengthening-Cheatsheet.pdf','Wrist Strengthening Cheatsheet','GMB Fitness','expert_instruction','The task uses a quadruped braced base and controlled upper-extremity support during a sagittal backward and forward shift.','direct movement-pattern context','The source does not create Vortex taxonomy keys or prove one programming purpose.',78),
    ('anatomy','https://gmb.io/wp-content/uploads/2025/02/GMB-Wrist-Strengthening-Cheatsheet.pdf','Wrist Strengthening Cheatsheet','GMB Fitness','expert_instruction','The described palms-up rear-facing setup and shift visibly involve dorsal hands fingers wrists arms shoulder support and trunk positioning.','direct position action and contact context','The source does not quantify muscle contribution joint force or isolated tissue stretch.',78),
    ('biomechanics','https://pubmed.ncbi.nlm.nih.gov/37794701/','Wrist Guards/Supports in Gymnastics: Are They Helping or Hurting You?','The American Journal of Sports Medicine','peer_reviewed_research','Gymnastics wrist angles and flexion moments vary with hand-support conditions.','adjacent wrist-loading context','Back-handspring findings cannot be converted into force angle or dose values for a light dorsal-hand quadruped rocker.',88),
    ('difficulty','https://static.usagym.org/PDFs/about/wellness/exercise/wrist.pdf','Suggested Gymnastics Wrist Exercises','USA Gymnastics','governing_body','The kneeling back-of-hand backward rock has a distinct contact surface controlled range and quality requirement.','direct task-complexity context','The source assigns no Vortex score or participant capability level.',88),
    ('load_fatigue_recovery','https://pubmed.ncbi.nlm.nih.gov/37794701/','Wrist Guards/Supports in Gymnastics: Are They Helping or Hurting You?','The American Journal of Sports Medicine','peer_reviewed_research','Wrist loading depends on task and support conditions so dorsal-hand interface and accumulated exposure must be retained.','adjacent loading context','The study does not quantify this exercise load fatigue threshold or recovery interval.',88),
    ('constraints','https://pmc.ncbi.nlm.nih.gov/articles/PMC12804664/','Epidemiology and Risk Factors of Wrist Pain and Injury in Adolescent Artistic Gymnasts: A Systematic Review and Meta-analysis','Orthopaedic Journal of Sports Medicine','peer_reviewed_research','The review reports substantial wrist pain and injury burden in adolescent gymnastics and low-to-very-low certainty for available risk-factor evidence.','symptom exposure and evidence-certainty context','The review does not create an age eligibility rule training threshold or exercise clearance.',92),
    ('dosage','https://static.usagym.org/PDFs/about/wellness/exercise/wrist.pdf','Suggested Gymnastics Wrist Exercises','USA Gymnastics','governing_body','USA Gymnastics supplies a hold-based wrist-flexion example and advises fewer repetitions or lighter work when form fails.','dose and quality context','It does not validate the dynamic Vortex cycle range frequency or recovery.',88),
    ('instructions','https://gmb.io/wp-content/uploads/2025/02/GMB-Wrist-Strengthening-Cheatsheet.pdf','Wrist Strengthening Cheatsheet','GMB Fitness','expert_instruction','GMB describes fingers toward knees palms up a backward shift toward heels a forward return slow progression comfortable range and no pain.','direct instruction context','The source does not define every contact quality gate count persistence field or stop rule.',78),
    ('safety_stop_rules','https://static.usagym.org/PDFs/about/wellness/exercise/wrist.pdf','Suggested Gymnastics Wrist Exercises','USA Gymnastics','governing_body','USA Gymnastics says to seek guidance when pain is present discontinue painful exercise and reduce work when form breaks down.','direct safety and quality context','The document does not replace facility emergency neurologic circulation trauma or clinical escalation policy.',88),
    ('programming','https://gmb.io/wp-content/uploads/2025/02/GMB-Wrist-Strengthening-Cheatsheet.pdf','Wrist Strengthening Cheatsheet','GMB Fitness','expert_instruction','The task appears as one optional wrist-strengthening and mobility routine element with a comfort warning.','Prepare and Access context only','The source does not establish phase exclusivity readiness prevention benefit or downstream budget.',78),
    ('athlete_support','https://gmb.io/wp-content/uploads/2025/02/GMB-Wrist-Strengthening-Cheatsheet.pdf','Wrist Strengthening Cheatsheet','GMB Fitness','expert_instruction','GMB uses a simple palms-up fingers-toward-knees back then forward description and explicitly prohibits moving into pain.','participant communication context','It does not establish universal sensation meaning eligibility or all accessibility needs.',78),
    ('coach_support','https://pmc.ncbi.nlm.nih.gov/articles/PMC12804664/','Epidemiology and Risk Factors of Wrist Pain and Injury in Adolescent Artistic Gymnasts: A Systematic Review and Meta-analysis','Orthopaedic Journal of Sports Medicine','peer_reviewed_research','The review supports taking symptoms and cumulative gymnastics exposure seriously while noting uncertain thresholds.','coach monitoring and scope context','It does not prescribe this rocker cues dose corrections diagnosis or clearance.',92),
    ('accessibility','https://static.usagym.org/PDFs/about/wellness/exercise/wrist.pdf','Suggested Gymnastics Wrist Exercises','USA Gymnastics','governing_body','A concise one-page table supports a short written sequence paired with images or demonstration.','instruction-access context','The source does not validate every accommodation or silent changed-support substitution.',88),
    ('alternates','https://static.usagym.org/PDFs/about/wellness/exercise/wrist.pdf','Suggested Gymnastics Wrist Exercises','USA Gymnastics','governing_body','USA Gymnastics separates palms-on-floor forward rocking and backs-of-hands backward rocking as different actions.','alternate identity boundary context','It does not adjudicate all twenty Vortex alternates or approve graph edges.',88),
    ('media','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en','Embed videos and playlists','YouTube Help','manufacturer_instruction','Five candidates returned current YouTube oEmbed title channel thumbnail and iframe metadata on 2026-08-09.','candidate metadata and privacy-enhanced embed format only','oEmbed does not prove playback exact dorsal-hand setup backward-forward count captions accessibility cue quality safety conflicts reviewer card-version match or approval.',82)
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
    'Current YouTube oEmbed metadata only. Playback backs-of-hands-down palms-up fingers-toward-knees quadruped setup exact backward-and-forward cycle contacts pressure range count captions accessibility cue quality safety conflicts reviewer identity card-version match and approval remain unverified.'
  FROM (VALUES
    ('GYlgQSLqNRI','Wrist Prep, Palms up, Fingers facing backwards','Chris Gaines','exact-title palms-up rear-facing candidate checked by YouTube oEmbed'),
    ('MGmCC35rSB8','Palms up Fingers Facing you Wrist Stretch - Reduce Wrist and Forearm Pain!','its.maddymartinez','palms-up fingers-facing candidate checked by YouTube oEmbed'),
    ('CjPVImbUXfA','Rear Facing Wrist.mp4','Flux','rear-facing wrist candidate checked by YouTube oEmbed'),
    ('M9UC3QezhCo','Wrist Rocks - forward, backward, inside, palms up','McG','multi-orientation candidate containing palms-up label checked by YouTube oEmbed'),
    ('PNRoKMw96Ew','Wrist Prep Routine + Wrist Rockers - Kinetic Sports Rehab','Tangelo - Seattle Chiropractor + Rehab','wrist-prep routine candidate checked by YouTube oEmbed')
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
  SELECT canonical_definition,2,a.name,a.classification,a.rationale,a.facts,
    jsonb_build_object('boundaryKey',a.boundary_key,
      'proposedStatus',a.proposed_status,'migration',migration_key,
      'researchVersion',research_version,'humanReviewRequired',TRUE,
      'approvalsCreated',FALSE),
    'candidate',NULL,NULL
  FROM (VALUES
    ('Rear-Facing Palms-Up Wrist Rock Back-of-Hand Wrist Rock or Wrist-Flexion Rock','same_identity','Aliases fit only when bilateral dorsal-hand contact palms up fingers toward knees and the backward-and-forward cycle are exact.','alias_exact',jsonb_build_array('alias','exact_contract'),'merge_alias'),
    ('Smaller Backward Range','modifier_annotation','Comfortable backward range changes dose while contact orientation action and return remain exact.','range_annotation',jsonb_build_array('backward_range'),'delivery_annotation'),
    ('Tempo or Brief Comfortable Endpoint Pause','modifier_annotation','Controlled pace and a short non-forced pause change exposure rather than identity.','tempo_pause_annotation',jsonb_build_array('tempo','brief_pause'),'delivery_annotation'),
    ('Repetitions Sets or Rest','modifier_annotation','Volume and recovery change dose rather than the task.','dose_annotation',jsonb_build_array('repetitions','sets','rest'),'delivery_annotation'),
    ('Stable Knee Cushioning','modifier_annotation','A stable pad under the knees changes comfort without changing the dorsal-hand surface or action.','knee_cushioning',jsonb_build_array('knee_comfort'),'delivery_annotation'),
    ('Thin Firm Dorsal-Hand Comfort Pad','new_variant','Padding under the hands changes pressure friction cleanliness and support interface.','padded_hand_variant',jsonb_build_array('dorsal_hand_padding','support_interface'),'needs_human_review'),
    ('Side-Facing Palms-Up Wrist Rock','new_variant','Changed finger direction changes forearm rotation wrist line pressure and range.','side_facing_variant',jsonb_build_array('lateral_fingers','changed_force_line'),'needs_human_review'),
    ('Unilateral Back-of-Hand Wrist Rock','new_variant','One-hand emphasis changes laterality load distribution trunk demand and failure consequence.','unilateral_variant',jsonb_build_array('unilateral','asymmetrical_load'),'needs_human_review'),
    ('Raised-Support Back-of-Hand Wrist Rock','new_variant','Wall bench box or other raised support changes equipment height load angles station and failure consequence.','raised_support_variant',jsonb_build_array('raised_support','equipment'),'needs_human_review'),
    ('Seated or Non-Quadruped Back-of-Hand Wrist Rock','new_variant','Removing the hands-and-knees base changes support bodyweight transfer floor access and count.','non_quadruped_variant',jsonb_build_array('changed_base','changed_support'),'needs_human_review'),
    ('Wrist Rockers Palms Down','new_definition','Palmar support with fingers forward and wrist-extension loading changes surface action loading direction and endpoint.','palms_down_distinct',jsonb_build_array('palmar_surface','wrist_extension'),'existing_distinct_definition'),
    ('Finger Pulses or Palm Lifts','new_definition','Active finger pressure and palm lifting are distinct actions rather than dorsal-hand rocking.','finger_pulse_distinct',jsonb_build_array('active_palm_lift','finger_pressure'),'existing_distinct_definition'),
    ('Wrist Lean Isometric or Wrist Support Rock Hold','new_definition','A sustained endpoint or tall-plank base changes count duration leverage load purpose and fatigue.','lean_hold_distinct',jsonb_build_array('sustained_hold','tall_plank_capacity'),'existing_distinct_definition'),
    ('Quadruped Wrist Pronation-Supination Shifts','new_definition','Changing hand orientation during loading adds forearm rotation and multiple directional exposures.','orientation_shift_distinct',jsonb_build_array('pronation_supination','orientation_change'),'existing_distinct_definition'),
    ('Back-of-Hand Wrist Circles','new_definition','Circular pressure travel adds lateral checkpoints direction counting and different dorsal-hand exposure.','circle_distinct',jsonb_build_array('circular_path','direction_count'),'research_queue'),
    ('Tall-Plank Back-of-Hand Rock or Planche Lean','new_definition','Toe support and longer leverage materially increase wrist shoulder trunk and fatigue demand.','tall_plank_distinct',jsonb_build_array('toe_support','long_leverage'),'research_queue'),
    ('Banded Wrist-Flexion Mobilization','new_definition','An anchored band changes joint force direction equipment setup contraindications and scope.','banded_distinct',jsonb_build_array('band','external_joint_force'),'research_queue'),
    ('Fist or Parallette Rock','new_definition','Neutral-wrist gripping support removes the exact dorsal-hand wrist-flexion interface.','neutral_handle_distinct',jsonb_build_array('fist_or_handle','neutral_wrist'),'research_queue'),
    ('Loaded or Partner-Resisted Back-of-Hand Rock','new_definition','External load or manual force changes magnitude consent equipment failure risk and scope.','loaded_manual_distinct',jsonb_build_array('external_load_or_manual_force','consent'),'research_queue'),
    ('Clinical Wrist-Flexion Range or Pain Assessment','new_definition','Measurement adds examiner protocol clinical purpose outcomes consent and different escalation.','assessment_distinct',jsonb_build_array('measurement','clinical_scope'),'research_queue')
  ) a(name,classification,rationale,boundary_key,facts,proposed_status)
  ON CONFLICT(definition_id,reviewed_card_version,alternate_name) DO UPDATE SET
    classification=EXCLUDED.classification,rationale=EXCLUDED.rationale,
    distinguishing_dimensions=EXCLUDED.distinguishing_dimensions,
    proposed_card_json=EXCLUDED.proposed_card_json,
    review_status='candidate',reviewer_user_id=NULL,reviewed_at=NULL,
    updated_at=now();

  -- Preserve Source 30's candidate-only adjacency after replacing Source 31's
  -- inherited skeleton. This is a graph migration, not an approval.
  INSERT INTO coaching.exercise_relationship_v1(
    from_variant_id,to_variant_id,relationship,similarity_score,dimensions,
    reason,conditions_json,review_status,created_by,reviewed_by,reviewed_at)
  VALUES(
    palms_down_variant,rock_variant,'lateral_substitution',38,
    ARRAY['range','joint_action','support']::TEXT[],
    'Palms-up dorsal-hand wrist-flexion rocking changes the hand surface and wrist action and is only a contextual alternative after identity symptoms range support and pressure are revalidated.',
    jsonb_build_object('migration',migration_key,'preservedFromMigration',
      '501_coaching_wrist_rockers_palms_down_family_audit_hardening',
      'reviewOnly',TRUE,'automaticSubstitution',FALSE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'review',NULL,NULL,NULL)
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
  SELECT rock_variant,r.to_id,r.relationship,r.score,r.dimensions,r.reason,
    jsonb_build_object('migration',migration_key,'reviewOnly',TRUE,
      'automaticSubstitution',FALSE,
      'revalidate',jsonb_build_array(
        'identity hand surface palm and finger direction',
        'base contacts support height and pressure','path hold force or added actions',
        'restrictions and symptoms','purpose dose and actual duration',
        'wrist hand shoulder trunk fatigue and downstream budgets',
        'surface floor access sightline and exit','persistence',
        'coach rendering','athlete rendering'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'review',NULL,NULL,NULL
  FROM (VALUES
    (palms_down_variant,'lateral_substitution',38,
      ARRAY['range','joint_action','support']::TEXT[],
      'Palms-down forward-facing wrist-extension rocking changes hand surface action and loading direction and is only a contextual alternative after exact identity symptoms range support and downstream work are revalidated.'),
    (finger_pulse_variant,'progression',50,
      ARRAY['complexity','load']::TEXT[],
      'Finger Pulses or Palm Lifts add active hand-pressure actions and are only a contextual progression when the changed purpose contact and dose fit.'),
    (lean_hold_variant,'progression',54,
      ARRAY['load','fatigue','leverage']::TEXT[],
      'The isometric or tall-plank wrist-support task adds sustained duration or leverage and is only a progression after exact base hold count contact and cumulative exposure are selected.'),
    (orientation_variant,'lateral_substitution',42,
      ARRAY['range','coordination','joint_action']::TEXT[],
      'Pronation-supination shifts change hand orientation and wrist/forearm exposure and are only an alternative after the different actions contact and risks are revalidated.')
  ) r(to_id,relationship,score,dimensions,reason)
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
  SELECT 1,rock_variant,d.dimension,d.score,20,
    d.rationale||' This scores the exercise task, not a participant.',
    'review',1,NULL,NULL,
    'Research-informed proposal only; independent comparison and qualified human approval remain required.',
    NULL
  FROM (VALUES
    ('technicalComplexity',26,
      'Review-only exercise-complexity anchor based on exact quadruped base dorsal-hand contact palms-up rear-facing fingers very light pressure comfortable backward endpoint complete return support monitoring and count boundary.'),
    ('absoluteLoadDemand',18,
      'Review-only physical-difficulty anchor based on partial-bodyweight wrist flexion dorsal-hand and finger pressure elbow and shoulder support trunk stabilization floor transfer and controlled return without impact or external load.')
  ) d(dimension,score,rationale)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
    proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,
    reviewed_by=NULL,review_notes=EXCLUDED.review_notes,reviewed_at=NULL,
    updated_at=now();

  UPDATE coaching.exercise SET
    name='Wrist Rockers — Backs of Hands Down / Wrist-Flexion Bias',
    slug='wrist-rockers-palms-up',
    description='Start on hands and knees on a clean firm nonabrasive surface. Place the backs of both hands down with palms up and fingers pointing toward the knees. Begin with very light pressure. Shift backward toward the heels only to a comfortable wrist-flexion endpoint, then return forward to the declared start. One complete backward-and-forward cycle is one repetition.',
    instructions='Use the exact bilateral quadruped backs-of-hands-down palms-up fingers-toward-knees variant. Verify floor entry, clean nonabrasive surface, current wrist and upper-limb symptoms, dorsal-hand tolerance, comfortable range, cumulative wrist exposure, and downstream hand-support work. Keep dorsal hands and fingers supported, move backward without bouncing or forcing pressure, return fully, and stop for pain, neurologic or circulation symptoms, dizziness, worsening discomfort, abrasion, contact or support loss, unsafe surface, or participant request.',
    card_summary='Low-pressure bilateral quadruped wrist-flexion rocker using dorsal-hand support and a controlled backward-and-forward cycle.',
    coach_language='Keep pressure very light. Verify backs of hands down, palms up, fingers toward knees, comfortable wrist flexion, organized support, clean surface, and a full return.',
    athlete_language='Backs of hands down, palms up, fingers toward your knees. Move back only as far as comfortable, then return forward. Stop for pain, tingling, dizziness, or control loss.',
    skill_level=NULL,age_min=NULL,age_max=NULL,
    default_sets=1,default_reps=5,default_work_seconds=NULL,
    default_rest_seconds=45,tempo='controlled 4-8 seconds per complete cycle',
    load_note='Very light partial-bodyweight dorsal-hand support; pressure, wrist-flexion seconds, floor transfers, symptoms, and overlapping wrist work must be budgeted.',
    est_seconds_per_set=54,
    programming_logic=jsonb_build_object(
      'selectionStatus','canonical_variant_required','selectable',TRUE,
      'canonicalDefinitionId',canonical_definition,
      'exactVariantIds',to_jsonb(active_variant_ids),
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'exerciseDifficultyDescribesTaskOnly',TRUE,
      'selectionInputs',jsonb_build_array(
        'workout purpose','exact hand surface palm and finger direction',
        'floor entry and dorsal-hand support','comfortable wrist range and pressure',
        'elbow shoulder scapular and trunk support',
        'clean firm nonabrasive surface',
        'dose actual duration cumulative wrist and downstream hand-support load',
        'coach scope and emergency route'),
      'substitutionRevalidation',jsonb_build_array(
        'identity hand surface palm and direction',
        'base contacts support height path padding and hold',
        'restrictions symptoms pressure and surface',
        'purpose and dose','fatigue impact and downstream budgets','duration',
        'floor access and sightline','persistence','coach rendering',
        'athlete rendering'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    scalable_variables=ARRAY['complete_cycles','backward_range','tempo',
      'brief_endpoint_pause_seconds','rest_seconds','sets',
      'knee_cushioning']::TEXT[],
    movement_family='Wrist Prep',
    primary_phase_key=NULL,phase_subrole=NULL,primary_order_slot=NULL,
    movement_requirements=jsonb_build_object(
      'selectable',TRUE,'canonicalVariantRequired',TRUE,'impactLevel',0,
      'balanceDemand','stable_quadruped_with_sagittal_weight_shift',
      'breathingDemand','comfortable_no_breath_hold',
      'actions',jsonb_build_array('bilateral_dorsal_hand_and_knee_support',
        'controlled_backward_center_of_mass_shift',
        'increasing_weight_bearing_wrist_flexion',
        'controlled_forward_return'),
      'planes',jsonb_build_array('sagittal_primary',
        'multiplanar_stabilization'),
      'mustMaintain',jsonb_build_array('backs_of_hands_down','palms_up',
        'fingers_toward_knees','clean_firm_nonabrasive_surface',
        'both_knees_supported','elbows_extended_without_forcing',
        'organized_shoulders_scapula_and_trunk','very_light_pressure',
        'comfortable_range','complete_return','communication'),
      'mustNotAdd',jsonb_build_array('palms_down','forward_or_side_facing_fingers',
        'unilateral_emphasis','circles','palm_or_finger_lifts',
        'sustained_hold','tall_plank','raised_or_padded_hand_support',
        'band_or_manual_force','clinical_assessment'),
      'validCompletion','one controlled backward shift and complete forward return with exact contacts orientation comfortable pressure and no stop rule'),
    coaching_execution=jsonb_build_object(
      'qualityGates',jsonb_build_array(
        'exact_backs_of_hands_down_palms_up_fingers_toward_knees_identity',
        'clean_firm_nonabrasive_surface_and_floor_transfer_safe',
        'dorsal_hand_finger_and_knee_contacts',
        'elbows_shoulders_scapula_and_trunk_supported',
        'very_light_pressure_and_comfortable_controlled_backward_endpoint',
        'complete_forward_return','no_stop_symptoms'),
      'stopRules',jsonb_build_array(
        'sharp_increasing_radiating_or_unfamiliar_pain',
        'numbness_tingling_weakness_color_temperature_circulation_or_hand_control_change',
        'chest_or_breathing_concern',
        'dizziness_faintness_nausea_visual_change_or_inability_to_communicate',
        'dorsal_hand_finger_knee_elbow_shoulder_scapular_or_trunk_support_loss',
        'forced_bounced_or_abrading_range_or_pressure',
        'unsafe_surface_floor_entry_or_exit','budget_or_duration_reached'),
      'persistence',jsonb_build_array('definition_card_and_variant_version',
        'planned_and_actual_cycles_range_pressure_support_seconds_pause_tempo_rest_and_sets',
        'valid_invalid_partial_and_symptom_limited_attempts',
        'first_fault_symptoms_and_stop_reason',
        'duration surface floor entry and exit','substitution and revalidation',
        'coach and athlete rendering version')),
    pairing_logic=jsonb_build_object(
      'sameSessionBudget',jsonb_build_array('complete_cycles',
        'wrist_flexion_seconds','dorsal_hand_support_seconds',
        'backward_range_exposure','support_faults','floor_transfers',
        'technical_fatigue','downstream_hand_support','impact_contacts'),
      'avoidAutomaticPairingWith',jsonb_build_array(
        'fatiguing_tumbling_handstands_cartwheels_or_crawling',
        'high_wrist_grip_pressing_or_overhead_volume',
        'same_session_wrist_or_forearm_capacity_that_exceeds_budget'),
      'revalidateAfterSubstitution',TRUE),
    media_library=jsonb_build_object(
      'candidate_video_ids',jsonb_build_array('GYlgQSLqNRI','MGmCC35rSB8',
        'CjPVImbUXfA','M9UC3QezhCo','PNRoKMw96Ew'),
      'reviewState','oembed_metadata_only_candidate_quarantine',
      'playbackExactHandSetupCountCaptionsAccessibilityQualitySafetyAndApprovalVerified',FALSE,
      'humanReviewRequired',TRUE),
    programming_kind='exercise',why_publish_ready=FALSE,is_published=FALSE,
    archived=FALSE,linked_skill_id=NULL,
    updated_at=now()
  WHERE id=31;

  UPDATE coaching.exercise_safety_profile SET
    risk_level=2,impact_level=0,minimum_age_recommended=NULL,
    minimum_skill_level=NULL,requires_spotting=FALSE,
    requires_coach_supervision='recommended',
    minimum_prerequisite_notes='Readiness is evaluated from safe floor entry and exit, bilateral dorsal-hand and knee support, comfortable weight-bearing wrist flexion with very light pressure, elbow shoulder scapular and trunk control, exact hand orientation and count comprehension, current symptoms and restrictions, clean firm nonabrasive surface, workout dose, and downstream loading; never from participant classification.',
    readiness_checks=ARRAY[
      'Confirm the exact backs-of-hands-down palms-up fingers-toward-knees dynamic quadruped variant, clean firm dry nonslip nonabrasive surface, optional knee cushioning only, station clearance, sightline, communication, and safe floor entry and exit.',
      'Confirm comfortable bilateral dorsal-hand and finger contact, wrist-flexion range, very light pressure, elbow shoulder scapular and trunk support, and no conflicting current symptoms or restrictions.',
      'Confirm the participant can name the hand surface and direction, count one complete backward-and-forward cycle, avoid bouncing or forcing pressure and range, and use the stop signal.',
      'Review cumulative cycles, wrist-flexion and dorsal-hand-support seconds, floor transfers, pressure and support faults, and later tumbling handstand cartwheel crawling pressing grip and forearm loading.'
    ]::TEXT[],
    stop_signs=ARRAY[
      'Sharp increasing radiating or unfamiliar wrist hand forearm elbow shoulder spine hip knee or other pain or participant stop request.',
      'Numbness tingling weakness color temperature circulation or hand-control change.',
      'Chest or breathing concern dizziness faintness nausea visual change or inability to communicate.',
      'Dorsal-hand finger knee elbow shoulder scapular or trunk support is lost or pressure or range becomes forced bounced abrading or progressively uncomfortable.',
      'Hand surface orientation path hold base padding or support height changes from the selected task.',
      'Clean firm nonabrasive surface station clearance sightline communication duration downstream budget or safe floor entry and exit becomes inadequate.'
    ]::TEXT[],
    contraindications=ARRAY[
      'Current symptom trauma procedure or clinical restriction conflicts with floor transfer bilateral dorsal-hand support or wrist flexion.',
      'No clean firm stable nonslip nonabrasive hand surface station clearance coach sightline communication or safe exit.',
      'The intended service is diagnosis treatment injury management readiness clearance manual assistance assessment or another exercise identity.'
    ]::TEXT[],
    common_substitutions=ARRAY[
      'Use a separately authored raised-support or padded-hand task only when its changed interface equipment load angle station and fall checks fit.',
      'Use Finger Pulses or Palm Lifts only when active hand pressure rather than dorsal-hand bodyweight rocking matches the purpose and all checks are rerun.',
      'Use palms-down orientation-shift isometric or tall-plank wrist cards only when their distinct hand surface action load and dose fit and all checks are rerun.',
      'Do not silently rotate the fingers change the hand surface add circles holds padding bands manual force or load.'
    ]::TEXT[]
  WHERE exercise_id=31;

  UPDATE coaching.exercise_score_v1 SET
    technical_complexity=26,absolute_load_demand=18,coordination_demand=26,
    impact=1,supervision_demand=24,
    base_overall_difficulty=greatest(26,18),
    legacy_scores=coalesce(legacy_scores,'{}'::JSONB)||jsonb_build_object(
      'candidateReassessment',migration_key,
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'variantScores',jsonb_build_object(
        'quadrupedPalmsUpBackwardForward',jsonb_build_object(
          'complexity',26,'physicalDifficulty',18,'overall',26)),
      'exerciseScoresDescribeTaskOnly',TRUE,
      'independentCalibrationRequired',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    migration_confidence=60,human_review_status='queued',
    reviewed_by=NULL,reviewed_at=NULL,
    review_notes='Research-informed candidate only. Scores describe exercise complexity and physical difficulty, not a participant. Identity anatomy loading and independent calibration remain required.',
    updated_at=now()
  WHERE exercise_id=31;

  UPDATE coaching.exercise_difficulty_profile SET
    technical=2.6,complexity=2.6,load=1.8,overall=2.6,
    recommended_age_min=NULL,recommended_age_max=NULL,attention_demand='low',
    notes='Candidate exact variant is 26/18/26 for exercise complexity physical difficulty and their derived maximum. These are task scores, not participant classification.',
    source='canonical_research_candidate',updated_at=now()
  WHERE exercise_id=31;

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  VALUES(canonical_definition,1,2,'2.0.0',migration_key,'quarantined',
    jsonb_build_object(
      'identity',jsonb_build_object('passed',TRUE,
        'identityKey','quadruped_rear_facing_palms_up_wrist_flexion_rock',
        'activeVariants',1,'archivedSourceSkeletons',1,
        'neighborBoundariesExplicit',4,'directDuplicateDefinitions',0,
        'legacyFlexorBiasClarifiedAsJointAction',TRUE),
      'taxonomy',jsonb_build_object('passed',TRUE,'controlledTerms',TRUE,
        'movementPatterns',jsonb_build_array('brace','push'),
        'bodyRegions',9,'equipment',jsonb_build_array('none'),
        'optionalKneeMatOnly',TRUE),
      'anatomy',jsonb_build_object('passed',TRUE,
        'musclesJointsActionsPlanesLateralityContactsAndCountBoundary',TRUE,
        'isolatedTissueClaimAbsent',TRUE),
      'difficulty',jsonb_build_object('passed',TRUE,
        'model','max_exercise_complexity_physical_difficulty',
        'variantVector','26/18/26','participantClassificationAbsent',TRUE,
        'independentCalibrationRequired',TRUE),
      'loadFatigueRecovery',jsonb_build_object('passed',TRUE,
        'cyclesRangeWristFlexionDorsalHandSupportPressureContactsFaultsFloorTransfersAndDownstreamExposureTracked',TRUE,
        'impactNone',TRUE,'recoveryIsPlanningEstimate',TRUE),
      'constraints',jsonb_build_object('passed',TRUE,
        'floorTransferDorsalHandSupportWristRangePressureElbowShoulderTrunkSurfaceSymptomsRestrictionsScopeAndExit',TRUE),
      'delivery',jsonb_build_object('passed',TRUE,'profiles',2,
        'prepareAndMovementIntelligence',TRUE,
        'durationDoseRestStationAndSubstitutionRevalidation',TRUE),
      'instructions',jsonb_build_object('passed',TRUE,
        'athleteCoachAccessibilityAndSupportOperations',TRUE,
        'handSurfaceOrientationContactsRangePressureCountStopsAndScope',TRUE),
      'research',jsonb_build_object('passed',TRUE,'sections',16,
        'registryVersion',research_version,
        'directSourcesDoNotCreateUniversalClaims',TRUE),
      'media',jsonb_build_object('passed',FALSE,'candidateCount',5,
        'currentOEmbedMetadataHealthy',TRUE,'playbackReviewed',FALSE,
        'exactVariantReviewed',FALSE,
        'captionsAccessibilityQualitySafetyAndApprovalReviewed',FALSE),
      'relationships',jsonb_build_object('passed',FALSE,'reviewOnly',4,
        'approved',0,'automaticSubstitution',FALSE),
      'calibration',jsonb_build_object('passed',FALSE,'reviewOnly',2,
        'approved',0),
      'alternates',jsonb_build_object('passed',TRUE,'assessments',20,
        'supportOrientationPathHoldPaddingAndLoadChangesQuarantined',TRUE),
      'generationSupport',jsonb_build_object('passed',TRUE,
        'selectionConstraints',TRUE,'cumulativeFatigueAndImpactBudgets',TRUE,
        'duration',TRUE,'equipmentSurfaceAndStation',TRUE,
        'substitutionRevalidation',TRUE,'renderingAndPersistence',TRUE),
      'publication',jsonb_build_object('passed',FALSE,'reviewer',NULL,
        'approver',NULL)),
    jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01',
        'message','A qualified human must watch all five candidates in full and verify playback backs-of-hands-down palms-up fingers-toward-knees quadruped setup exact backward-and-forward cycle contacts pressure range count captions accessibility cue quality safety conflicts reviewer timestamp card version and approval rationale.'),
      jsonb_build_object('code','CARD-GRAPH-03',
        'message','A qualified coach must approve or reject all palms-down finger-pulse lean-hold and orientation-shift relationships; no automatic substitution between changed hand surfaces actions holds bases loads pressures or purposes is authorized.'),
      jsonb_build_object('code','CARD-CALIBRATION-01',
        'message','An independent qualified reviewer must calibrate 26/18 exercise complexity and physical difficulty. Scores do not classify a participant or create an age or capability level.'),
      jsonb_build_object('code','CARD-PUBLISH-01',
        'message','A qualified reviewer and separate approver must complete content review before publication. Identity anatomy loading dorsal-hand pressure wrist-risk scope dose stop accessibility persistence and support rules remain quarantined.')),
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
        AND body_regions=ARRAY['wrist','hand','elbow','shoulder','scapula','core','spine','hip','knee']::TEXT[]
        AND anatomy_json<>'{}'::JSONB AND environment_json<>'{}'::JSONB
        AND population_json<>'{}'::JSONB
        AND athlete_support_json<>'{}'::JSONB
        AND coach_support_json<>'{}'::JSONB
        AND support_operations_json<>'{}'::JSONB
        AND provenance_json->>'approvalsCreated'='false')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source_variant AND status='archived'
        AND requirements_json->>'representation'='superseded_source_skeleton')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=rock_variant AND definition_id=canonical_definition
        AND status='review'
        AND difficulty_json->>'scoresDescribeExerciseTaskOnly'='true'
        AND (difficulty_json->>'baseOverallDifficulty')::INT=greatest(
          (difficulty_json->>'technicalComplexity')::INT,
          (difficulty_json->>'absoluteLoadDemand')::INT))
    OR (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=rock_variant AND status='review'
        AND equipment_required=ARRAY['none']::TEXT[]
        AND time_model_json<>'{}'::JSONB
        AND dose_scaling_json<>'{}'::JSONB
        AND measurement_json<>'{}'::JSONB
        AND support_prompts_json<>'{}'::JSONB)<>2 THEN
    RAISE EXCEPTION '% canonical definition variant or profile assertion failed',
      migration_key;
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
    OR (SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE from_variant_id=palms_down_variant AND to_variant_id=rock_variant
        AND relationship='lateral_substitution' AND review_status='review'
        AND reviewed_by IS NULL)<>1
    OR (SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=rock_variant AND status='review'
        AND reviewed_by IS NULL AND reviewed_at IS NULL)<>2
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE (survivor_definition_id=canonical_definition
          OR resolved_definition_id=canonical_definition)
        AND decision='distinct_exercises' AND reviewed_by IS NULL)<>4
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=canonical_definition AND card_version=2
        AND status='quarantined' AND human_review_required IS TRUE
        AND jsonb_array_length(blocking_issues_json)=4) THEN
    RAISE EXCEPTION '% candidate research graph calibration identity or packet assertion failed',
      migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition AND (status='published'
        OR approved_video_url IS NOT NULL OR reviewed_by IS NOT NULL
        OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL))
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
      WHERE id=31 AND (is_published IS TRUE OR skill_level IS NOT NULL
        OR age_min IS NOT NULL OR age_max IS NOT NULL
        OR linked_skill_id IS NOT NULL)) THEN
    RAISE EXCEPTION '% fabricated approval publication or participant classification detected',
      migration_key;
  END IF;
END
$migration$;
