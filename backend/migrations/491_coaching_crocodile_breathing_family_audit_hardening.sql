-- Reauthor the skeletal Crocodile Breathing source as exact flat-prone,
-- lower-leg-bolster, and light elastic-band feedback working specifications.
-- Hooklying, 90/90, timed-hold, externally loaded, elbow-posted, rocking,
-- spinal-extension, and limb-motion exercises remain distinct. Evidence,
-- media, graph, calibration, content, and publication decisions stay
-- quarantined for qualified human review. Exercise difficulty describes only
-- exercise complexity and physical difficulty, never athlete proficiency.

DO $$
DECLARE
  migration_key CONSTANT TEXT := '491_coaching_crocodile_breathing_family_audit_hardening';
  research_version CONSTANT TEXT := '2026-08-02.90';
  canonical_definition UUID;
  source_variant UUID;
  flat_variant UUID;
  bolster_variant UUID;
  band_variant UUID;
  active_variant_ids UUID[];
  reach_definition UUID;
  reach_variant UUID;
  lateral_definition UUID;
  lateral_variant UUID;
  balloon_definition UUID;
  hooklying_definition UUID;
  hooklying_variant UUID;
  box_definition UUID;
  med_ball_definition UUID;
  swimmer_definition UUID;
  ytw_iso_definition UUID;
  ytw_raise_definition UUID;
  protected_count INTEGER;
BEGIN
  SELECT definition_id INTO canonical_definition FROM coaching.exercise_definition_source_v1
  WHERE legacy_exercise_id=22;
  SELECT id INTO source_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=canonical_definition AND variant_key='baseline';
  SELECT id INTO flat_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=canonical_definition AND variant_key='flat-prone-stacked-hands';
  flat_variant := coalesce(flat_variant,gen_random_uuid());
  SELECT id INTO bolster_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=canonical_definition AND variant_key='lower-leg-bolster-support';
  bolster_variant := coalesce(bolster_variant,gen_random_uuid());
  SELECT id INTO band_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=canonical_definition AND variant_key='light-elastic-band-lateral-feedback';
  band_variant := coalesce(band_variant,gen_random_uuid());
  SELECT definition_id INTO reach_definition FROM coaching.exercise_definition_source_v1
  WHERE legacy_exercise_id=21;
  SELECT id INTO reach_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=reach_definition AND variant_key='wall-supported-bilateral-reach';
  SELECT id INTO lateral_definition FROM coaching.exercise_definition_v1
  WHERE slug='9090-wall-supported-breathing-with-lateral-expansion';
  SELECT id INTO lateral_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=lateral_definition AND variant_key='wall-supported-hands-on-lateral-ribs';
  SELECT id INTO balloon_definition FROM coaching.exercise_definition_v1
  WHERE slug='9090-hip-lift-with-ball-and-balloon';
  SELECT id INTO hooklying_definition FROM coaching.exercise_definition_v1
  WHERE slug='supine-hook-lying-brace-with-exhale';
  SELECT id INTO hooklying_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=hooklying_definition AND variant_key='baseline';
  SELECT id INTO box_definition FROM coaching.exercise_definition_v1
  WHERE slug='box-breathing-hold-restore';
  SELECT id INTO med_ball_definition FROM coaching.exercise_definition_v1
  WHERE slug='med-ball-belly-breathing-restore';
  SELECT id INTO swimmer_definition FROM coaching.exercise_definition_v1
  WHERE slug='prone-swimmer-hover';
  SELECT id INTO ytw_iso_definition FROM coaching.exercise_definition_v1
  WHERE slug='prone-y-t-w-isometric-series';
  SELECT id INTO ytw_raise_definition FROM coaching.exercise_definition_v1
  WHERE slug='prone-y-t-w-raise';
  active_variant_ids := ARRAY[flat_variant,bolster_variant,band_variant];

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition AND legacy_exercise_id=22
        AND slug='crocodile-breathing' AND status<>'archived')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=22 AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source_variant AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1 WHERE exercise_id=22)
    OR (SELECT count(*) FROM coaching.exercise_definition_v1
        WHERE id IN(reach_definition,lateral_definition,balloon_definition,
          hooklying_definition,box_definition,med_ball_definition,
          swimmer_definition,ytw_iso_definition,ytw_raise_definition)
          AND status<>'archived')<>9
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
        WHERE id=reach_variant AND definition_id=reach_definition AND status<>'archived')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
        WHERE id=lateral_variant AND definition_id=lateral_definition AND status<>'archived')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
        WHERE id=hooklying_variant AND definition_id=hooklying_definition AND status<>'archived') THEN
    RAISE EXCEPTION '% prerequisite lineage, score row, or identity neighbor drifted',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=ANY(active_variant_ids) AND definition_id<>canonical_definition)
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE slug='crocodile-breathing' AND id<>canonical_definition) THEN
    RAISE EXCEPTION '% working UUIDs or slug are already owned',migration_key;
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
    UNION ALL SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=ANY(active_variant_ids||ARRAY[source_variant]::UUID[])
        AND status IN('published','deprecated')
    UNION ALL SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=ANY(active_variant_ids||ARRAY[source_variant]::UUID[])
          OR to_variant_id=ANY(active_variant_ids||ARRAY[source_variant]::UUID[]))
        AND (reviewed_by IS NOT NULL OR review_status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(active_variant_ids||ARRAY[source_variant]::UUID[])
        AND (reviewed_by IS NOT NULL OR status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_v1
      WHERE exercise_id=22
        AND (human_review_status<>'queued' OR reviewed_by IS NOT NULL
          OR reviewed_at IS NOT NULL)
  ) protected;
  IF protected_count<>0 THEN
    RAISE EXCEPTION '% refuses to replace % human-reviewed records',
      migration_key,protected_count;
  END IF;

  INSERT INTO coaching.equipment(key,name,sort_order)
  VALUES('bolster','Bolster',133)
  ON CONFLICT(key) DO UPDATE SET name=EXCLUDED.name,sort_order=EXCLUDED.sort_order;

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
    review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now()
  WHERE definition_id=canonical_definition
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  DELETE FROM coaching.exercise_relationship_v1
  WHERE (from_variant_id=ANY(active_variant_ids||ARRAY[source_variant]::UUID[])
      OR to_variant_id=ANY(active_variant_ids||ARRAY[source_variant]::UUID[]))
    AND reviewed_by IS NULL AND review_status<>'approved';
  DELETE FROM coaching.exercise_score_calibration_v1
  WHERE variant_id=ANY(active_variant_ids||ARRAY[source_variant]::UUID[])
    AND reviewed_by IS NULL AND status<>'approved';

  UPDATE coaching.exercise_definition_source_v1 source SET
    provenance_json=(coalesce(source.provenance_json,'{}'::JSONB)-'researchSources')
      ||jsonb_build_object(
        'migration',migration_key,'researchVersion',research_version,
        'sourceDisposition','canonical_exact_reauthored',
        'representedBySelectableSourceVariant',FALSE,
        'sourceInterpretation','legacy source describes the flat prone stacked-hand breath cycle but omits exact support feedback dose stop persistence and review contracts',
        'exactWorkingSpecifications',jsonb_build_array(
          'flat_prone_no_external_feedback','lower_leg_bolster_support',
          'light_elastic_band_lateral_feedback'),
        'researchSources',jsonb_build_array(
          'https://www.functionalmovement.com/exercises/776/single_leg_chop_2_step_motion',
          'https://www.functionalmovement.com/articles/780/take_a_deep_breath',
          'https://doi.org/10.1114/1.1332084',
          'https://pubmed.ncbi.nlm.nih.gov/41482169/'),
        'exerciseDifficultyDescribesTaskOnly',TRUE,
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=22 AND definition_id=canonical_definition;

  UPDATE coaching.exercise_delivery_profile_v1
  SET status='archived',updated_at=now() WHERE variant_id=source_variant;
  UPDATE coaching.exercise_variant_v1 SET
    variant_key='identity-quarantine-source-22',
    display_name='Crocodile Breathing Legacy Skeleton — Source 22',
    modifier_keys='{}'::TEXT[],difficulty_json='{}'::JSONB,status='archived',
    requirements_json=jsonb_build_object(
      'selectable',FALSE,'representation','superseded_source_skeleton',
      'sourceLegacyExerciseId',22,
      'archiveReason','exact_support_feedback_dose_stop_and_persistence_contract_missing',
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
    canonical_definition,1,22,'crocodile-breathing','Crocodile Breathing',
    'Crocodile Breathing',
    ARRAY['Prone Crocodile Breathing','Crocodile Breath','Prone Diaphragmatic Breathing'],
    'Lie flat prone with the forehead supported on stacked hands, the face and airway clear, the arms, chest, neck, pelvis, and legs relaxed, and the selected support or feedback contract in place. One repetition is one comfortable nasal inhale that creates observable abdominal and lower-rib contact or expansion feedback, one slow unforced nasal exhale, and a comfortable reset without elbow posting, trunk or limb movement, forced pressure, prescribed breath retention, or loss of support.',
    'prone_crocodile_breath_cycle','2.0.0',2,'review',
    86,68,58,ARRAY['breath','brace']::TEXT[],
    ARRAY['core','spine','thoracic_spine']::TEXT[],
    ARRAY['mat']::TEXT[],ARRAY['bolster','bands']::TEXT[],
    jsonb_build_object(
      'surface','clean stable nonslip floor or secured mat that supports the complete prone body and safe entry and exit',
      'clearance','face nose and mouth remain unobstructed; hands and head support do not restrict breathing; no traffic crosses the floor-transfer or prone envelope',
      'space','one full-body prone station plus floor-transfer and coach-observation access',
      'stationCapacity',1,
      'coachSightline','side or front-quarter view of face clearance head and neck support elbows shoulders upper chest abdomen lateral ribs pelvis legs feedback equipment and safe exit',
      'inspection',jsonb_build_array('surface cleanliness friction seams and movement','face and airway clearance','head hand and lower-leg support stability','band placement tension condition and quick removal when selected','privacy consent and coach access'),
      'changeRule','Support feedback equipment touch cadence dose floor access symptoms or station changes require complete selection duration logistics persistence and rendering revalidation.'),
    jsonb_build_object(
      'exerciseCardDoesNotClassifyAthletes',TRUE,'readinessIsWorkoutInput',TRUE,
      'readinessFacts',jsonb_build_array('comfortable safe floor transfer and prone position','unobstructed comfortable resting breathing','head neck shoulders trunk hips knees and feet tolerate the exact support contract','athlete can report symptoms request stop and exit safely','consent is explicit before any coach touch'),
      'excludeOrReferPerFacilityPolicy',jsonb_build_array('pain neurologic symptoms dizziness faintness chest pain unusual shortness of breath panic or air hunger','current respiratory cardiovascular neurologic pregnancy postpartum musculoskeletal or postoperative instructions conflict with prone breathing','unsafe floor access airway clearance support feedback equipment privacy consent or supervision'),
      'noUniversalEligibilityAgeReadinessDiagnosisOrTreatmentClaimed',TRUE),
    jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'canonicalAuthoredFromResearch',TRUE,
      'primaryIdentitySource','https://www.functionalmovement.com/exercises/776/single_leg_chop_2_step_motion',
      'legacySources',jsonb_build_array(22),
      'identityContract','flat_prone_forehead_on_stacked_hands_comfortable_nasal_inhale_abdominal_and_lower_rib_floor_feedback_slow_unforced_nasal_exhale_comfortable_reset',
      'researchSources',jsonb_build_array(
        'https://www.functionalmovement.com/exercises/776/single_leg_chop_2_step_motion',
        'https://www.functionalmovement.com/articles/780/take_a_deep_breath',
        'https://doi.org/10.1114/1.1332084',
        'https://pubmed.ncbi.nlm.nih.gov/41482169/',
        'https://www.va.gov/WHOLEHEALTHLIBRARY/tools/diaphragmatic-breathing.asp'),
      'confidenceBySection',jsonb_build_object('identity',92,'taxonomy',88,'anatomy',74,'difficulty',68,'load',70,'fatigueRecovery',58,'constraints',84,'dosage',60,'instructions',90,'alternates',86,'media',58),
      'unresolvedClaims',jsonb_build_array('one universal ideal expansion distribution cadence pause dose or phase','structural repositioning diaphragm isolation or treatment outcome','universal eligibility safety recovery or progression order','numeric difficulty calibration','media playback exactness captions accessibility quality and safety'),
      'externalPlaybackVerificationPerformed',FALSE,'sourceLimitationsExplicit',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,'publicationQuarantined',TRUE),
    NULL,NULL,NULL,NULL,
    jsonb_build_object(
      'primaryMuscles',jsonb_build_array('diaphragm','external intercostals during inhalation','abdominal wall during passive or gentle active exhalation'),
      'secondaryMuscles',jsonb_build_array('internal intercostals when exhalation is active','pelvic floor and deep trunk musculature as breathing-pressure coordinators'),
      'stabilizers',jsonb_build_array('cervical stabilizers maintaining comfortable head position','scapular and shoulder stabilizers maintaining relaxed arm support','trunk hip and lower-limb musculature maintaining a quiet prone position'),
      'joints',jsonb_build_array('temporomandibular and cervical regions for relaxed head position','shoulders elbows forearms wrists and hands for stacked-hand support','costovertebral and sternocostal articulations','thoracic and lumbar spine','pelvis hips knees ankles and feet'),
      'jointActions',jsonb_build_array('respiratory rib-cage expansion and recoil','abdominal wall displacement against the floor during inhalation','static comfortable cervical trunk pelvic and limb positioning','no scored spinal extension limb lift rocking or elbow-posted support'),
      'planes',jsonb_build_array('three-dimensional respiratory expansion observed in sagittal frontal and transverse components','static anti-motion control without a prescribed spinal movement plane'),
      'laterality','bilateral symmetrical support and breathing observation; side-to-side expansion is observed but not forced to be identical',
      'supportContacts',jsonb_build_array('anterior trunk and pelvis on floor or mat','forehead on stacked hands','lower limbs on surface or declared bolster support','optional nonrestrictive band around lower ribs only in exact band variant'),
      'evidenceBoundary','Sources support observable prone breathing contacts and position-dependent chest-wall behavior, not exact muscle-force distribution, structural correction, isolated diaphragm action, or universal posterior expansion.'),
    jsonb_build_object(
      'whyItMatters','Provides a low-load prone floor-feedback option for observing and practicing a comfortable breath cycle without turning breathing into a strength test, diagnosis, or forced pressure task.',
      'primaryCue','Rest flat with your forehead on stacked hands; breathe in comfortably into the floor, exhale slowly without forcing, and reset.',
      'expectedSensations',jsonb_build_array('gentle abdominal or lower-rib contact against the surface','quiet low effort breathing','comfortable head hand chest pelvic and leg support'),
      'unexpectedSensations',jsonb_build_array('pain pressure panic air hunger or forced breathing','dizziness faintness chest pain or unusual shortness of breath','numbness tingling weakness headache jaw or neck strain','face obstruction restrictive band pressure or inability to exit'),
      'painGuidance','Stop immediately, return to comfortable unrestricted breathing, signal the coach, exit safely with help if needed, and follow facility escalation policy; never repeat to test symptoms.',
      'selfChecks',jsonb_build_array('exact support or feedback variant is declared','face and airway stay clear','elbows and upper body remain relaxed rather than posted','inhale and exhale remain comfortable and unforced','body stays quiet and each cycle resets comfortably'),
      'accessibility',jsonb_build_array('plain-language verbal visual and tactile-with-consent options','safe floor-transfer assistance that does not alter the scored cycle','lower-leg bolster exact variant','fewer cycles and longer rest','select a distinct hooklying card when prone position is unsuitable'),
      'mediaAlternatives',jsonb_build_array('written sequence','coach demonstration','still-frame setup and feedback checklist','auditory cadence without forced timing'),
      'notReadinessSkillAgeOrClinicalClassification',TRUE),
    jsonb_build_object(
      'observationChecklist',jsonb_build_array('exact variant and equipment','surface floor transfer and face clearance','forehead stacked hands elbows shoulders chest and neck','abdominal and lateral-rib feedback without forcing','pelvis legs and lower-leg support','band restriction or migration','breath comfort symptoms valid reset and exit'),
      'faultCorrections',jsonb_build_object(
        'elbow_posting_or_shoulder_effort','stop and re-establish flat relaxed upper-body support; elbow-posted breathing is a different exercise',
        'forced_or_upper_chest_dominant_effort','reduce cueing and dose; return to comfortable breathing without claiming one ideal distribution',
        'head_neck_or_face_discomfort','stop and change support or select another card after full revalidation',
        'band_restriction_or_migration','remove the band immediately and record the invalid cycle and equipment issue',
        'movement_or_bracing_replaces_breath_cycle','end the cycle; do not add rocking extension limb motion or maximal bracing'),
      'demonstrationPlan','Show the exact flat prone setup, stacked hands, clear face, relaxed elbows shoulders chest neck pelvis and legs, selected bolster or band contract, one comfortable inhale, slow unforced exhale, reset, invalid examples, stop signal, and safe exit.',
      'groupManagement',jsonb_build_array('one athlete per clear prone and transfer station','maintain privacy and consent','keep coach traffic away from face hands and feedback equipment','record every valid invalid partial assisted and symptom-limited cycle'),
      'modificationDecisionTree',jsonb_build_array('stop for symptoms obstruction or unsafe floor access','reduce cycles or increase rest','select the exact bolster or band variant only after full revalidation','use consented touch only as a delivery annotation','select hooklying or another card when prone position is not appropriate'),
      'doNotUseWhen',jsonb_build_array('comfortable unobstructed prone breathing cannot be established','surface floor transfer head support equipment privacy consent or exit is unsafe','the workout objective requires forced respiratory loading timed holds spinal movement or limb action','same-session prone respiratory or trunk exposure budget is reached'),
      'noTreatmentOrSkillTransferAssumed',TRUE),
    jsonb_build_object(
      'issueCategories',jsonb_build_array('identity or variant mismatch','airway surface support or floor-transfer defect','symptom or incident','touch consent or privacy issue','band or bolster issue','dose duration or exposure mismatch','media instruction accessibility or rendering conflict'),
      'supportEscalation',jsonb_build_object('urgent','stop remove restrictive equipment restore unobstructed breathing and follow emergency policy for acute symptoms or inability to exit','clinical','refer symptom eligibility and return decisions per facility policy','content','quarantine conflicting identity technique dose media or instruction until qualified review'),
      'retentionPolicy','Persist definition variant support feedback equipment touch consent planned and actual cycles valid invalid partial assisted and symptom-limited attempts first fault symptoms stop reason floor-transfer assistance duration substitution and library generator rendering versions under facility policy.',
      'changeImpactPolicy','Any identity support feedback equipment touch cadence dose stop media or symptom change invalidates cached selection duration logistics persistence substitution and coach and athlete rendering and requires complete revalidation.',
      'feedbackChannels',jsonb_build_array('athlete comfort symptom and clarity report','coach first-fault equipment consent and station report','support issue incident and media-review queue'),
      'noApprovalInference',TRUE)
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
      'technicalComplexity',v.complexity,
      'absoluteLoadDemand',v.physical,
      'physicalDifficulty',v.physical,
      'baseOverallDifficulty',greatest(v.complexity,v.physical),
      'coordinationDemand',v.coordination,'impact',0,
      'supervisionDemand',v.supervision,'failureConsequence',v.failure,
      'workCapacityDemand',v.work_capacity,'relativeStrengthDemand',1,
      'mobilityDemand',v.mobility,'balanceDemand',1,'stabilityDemand',v.stability,
      'speedDemand',1,'decisionDemand',v.decision_demand,
      'fearExposure',v.fear,
      'complexityDimensions',jsonb_build_object(
        'setupAndSupportSelection',v.setup_complexity,
        'breathCycleCoordination',v.complexity,
        'feedbackInterpretation',v.feedback_complexity,
        'errorDetectionAndReset',v.complexity-2,
        'equipmentAndConsentManagement',v.equipment_complexity),
      'physicalDimensions',jsonb_build_object(
        'externalLoad',1,'respiratoryEffort',v.physical,
        'pronePositionTolerance',v.prone_demand,
        'headNeckAndFloorContactDemand',v.contact_demand,
        'feedbackPressureDemand',v.feedback_pressure),
      'technicalMeaning','exercise_complexity',
      'loadMeaning','physical_difficulty',
      'overallFormula','max_exercise_complexity_physical_difficulty',
      'candidateIndependentCalibrationRequired',TRUE),
    jsonb_build_object(
      'selectable',TRUE,'representation','exact_working_specification',
      'startPosition','flat prone on a clean stable floor or secured mat with forehead on stacked hands, face and airway clear, elbows resting rather than posted, and chest neck pelvis and legs relaxed',
      'supportContract',v.support_contract,
      'feedbackContract',v.feedback_contract,
      'actionContract','one comfortable nasal inhale producing observable abdominal and lower-rib contact or expansion feedback, followed by one slow unforced nasal exhale and a comfortable reset',
      'pauseContract','any comfortable short pause is delivery cadence metadata; no forced or universal hold is part of identity',
      'terminalContract','comfortable unrestricted breathing is restored in the exact selected support without movement or symptoms',
      'touchContract','coach touch is never required for identity; any light tactile cue requires current consent, declared contact location, no body support, and persistence as a delivery annotation',
      'repetitionBoundary','begins from quiet comfortable selected prone support at inhalation onset and ends only after the unforced exhale and comfortable reset',
      'invalidatingEvents',jsonb_build_array(
        'face or airway obstruction','forehead or support loss','elbow-posted upper-body support','forced inhale exhale pressure or retention','pain dizziness faintness chest pain unusual shortness of breath panic or air hunger','upper-body neck jaw or accessory-muscle strain','trunk limb rocking extension lift or other added movement','feedback equipment restriction migration or unexpected contact','inability to reset or exit safely'),
      'equipmentRequired',v.equipment_required,
      'identityQuarantine',FALSE,'workingSpecificationRequiresHumanReview',TRUE),
    'review',
    jsonb_build_object(
      'externalLoadMethod',v.external_load_method,
      'supportLoad','body mass is broadly supported by the prone surface; exact contact pressure distribution is not inferred',
      'feedbackLoad',v.feedback_load,
      'gripDemand',1,'spinalLoading',1,'eccentricStress',1,
      'impactClass','none','landingContactsPerRep',0,'handImpactContactsPerRep',0,
      'breathCyclesPerRep',1,'proneTimeTracked',TRUE,
      'dominantContraction','low-level respiratory muscle activity with static comfortable postural support',
      'effectiveLoadDrivers',jsonb_build_array('breath effort and cadence','prone duration','head neck hand anterior trunk pelvic and lower-limb contact','surface firmness','floor transfer','support equipment','band tension placement migration and removal','coach touch','prior respiratory trunk and prone work','symptoms'),
      'loadTracking',jsonb_build_array('valid invalid partial assisted and symptom-limited cycles','actual prone and floor-transfer time','breath strain','support and feedback equipment','touch consent and contact','same-session breathing trunk prone and floor-transfer exposure')),
    jsonb_build_object(
      'localMuscleFatigue',v.local_fatigue,'gripFatigue',1,
      'technicalFatigueSensitivity',v.technical_fatigue,
      'impactAccumulation',0,'recoveryHours',v.recovery_hours,
      'recoveryWindow','conservative planning estimate only; normal comfortable breathing and position should be restored before reuse and symptoms override any clock value',
      'primaryFatigueSites',jsonb_build_array('respiratory muscles','neck jaw and shoulders if excess effort appears','trunk and positional tissues','contact areas under head hands anterior trunk pelvis and lower limbs'),
      'earlyFatigueSignals',jsonb_build_array('increasing effort or rate','shoulder shrug neck or jaw tension','loss of abdominal or lower-rib feedback','forced exhale or breath retention','fidgeting rocking or inability to reset'),
      'downstreamConflicts',jsonb_build_array('priority respiratory assessment or loading','symptom-provoking prone work','fatigued trunk bracing or long prone blocks','sessions where floor transfer or low arousal conflicts with the primary objective')),
    jsonb_build_object(
      'trainingStimuli',jsonb_build_array('comfortable prone respiratory awareness','abdominal and lower-rib surface feedback','repeatable low-effort inhale exhale reset','variant-specific support or nonrestrictive feedback management'),
      'stimulusDose',jsonb_build_object('primary','quality_terminated_comfortable_breath_cycles','countInvalidPartialAssistedAndSymptomLimitedCyclesAsExposure',TRUE,'fatigueCeiling','very_low'),
      'weeklyExposure','Combine every valid invalid partial assisted and symptom-limited cycle plus actual prone time floor transfers feedback equipment and same-session respiratory and trunk work.',
      'prerequisites',jsonb_build_array('exact support and feedback contract selected','safe clean floor access and unobstructed face','comfortable resting breathing and prone position','equipment inspected and quickly removable','touch consent and stop signal understood when relevant'),
      'completionCriteria',jsonb_build_array('exact support and feedback retained','breathing comfortable and unforced','observable abdominal or lower-rib feedback without forcing','no elbow posting trunk or limb motion','comfortable reset and safe exit','complete exposure and symptom record'),
      'sequenceRules',jsonb_build_array('use only when prone breath awareness matches the workout purpose','place before tasks that could make breathing or floor position uncomfortable','do not use as a fatigue challenge treatment claim maximal brace or forced respiratory drill','stop before effort position equipment or feedback changes'),
      'pairingCompatibility',jsonb_build_array('low-demand mobility or instruction','noncompeting recovery work','other work only when respiratory trunk prone and floor-transfer budgets remain available'),
      'interferenceRules',jsonb_build_array('do not pre-fatigue respiratory or trunk tissues when subsequent output matters','do not combine with forced holds or respiratory resistance under this identity','revalidate after any support feedback touch cadence dose environment symptom or objective change'),
      'uncertaintyPolicy','If support face clearance feedback equipment touch consent effort symptom or reset is uncertain, do not select or continue; remove restriction and resolve the exact contract.',
      'selection',jsonb_build_object('phaseDefaults',jsonb_build_array('prepare_and_access','restore'),'readinessIsWorkoutInput',TRUE,'exerciseDifficultyDoesNotClassifyAthletes',TRUE),
      'publicationQuarantined',TRUE)
  FROM (VALUES
    (flat_variant,'flat-prone-stacked-hands','Flat Prone Crocodile Breathing',
      ARRAY['flat_prone','stacked_hands','no_external_feedback']::TEXT[],
      18,4,14,10,12,8,6,4,10,16,4,2,1,8,2,1,
      'anterior trunk pelvis and legs supported by the floor or mat; forehead supported on stacked hands; no bolster band cuff weight partner or apparatus feedback',
      'floor contact supplies anterior abdominal and lower-rib feedback; no external feedback device',
      ARRAY['mat']::TEXT[],'none','no external load or feedback device',
      4,10,2),
    (bolster_variant,'lower-leg-bolster-support','Lower-Leg Bolster Crocodile Breathing',
      ARRAY['flat_prone','stacked_hands','lower_leg_support','bolster']::TEXT[],
      20,3,14,10,12,8,8,3,12,16,6,4,3,10,1,1,
      'anterior trunk and pelvis supported by the floor or mat; forehead on stacked hands; both lower legs rest symmetrically on one stable declared bolster without forced knee or back position',
      'floor contact supplies anterior feedback while the bolster changes lower-leg support only',
      ARRAY['mat','bolster']::TEXT[],'supported_bodyweight_only','no external resistance; the bolster supports lower legs and its height firmness stability and contact are persisted',
      4,10,2),
    (band_variant,'light-elastic-band-lateral-feedback','Light Elastic-Band Feedback Crocodile Breathing',
      ARRAY['flat_prone','stacked_hands','light_band','lateral_feedback']::TEXT[],
      24,5,18,14,16,10,8,6,14,20,12,10,8,14,3,5,
      'anterior trunk pelvis and legs supported by the floor or mat; forehead on stacked hands; one inspected quickly removable light elastic band is placed at the declared lower-rib feedback location without constraining inhalation',
      'light band provides nonrestrictive lateral tactile feedback only; it is not respiratory resistance and must be removed immediately for restriction migration distress or uncertainty',
      ARRAY['mat','bands']::TEXT[],'nonrestrictive_feedback_band_only','light elastic contact is qualitative feedback; tension and tissue pressure are not inferred and restrictive loading is prohibited',
      6,14,3)
  ) v(id,variant_key,display_name,modifiers,complexity,physical,coordination,
      supervision,failure,work_capacity,mobility,decision_demand,fear,stability,
      setup_complexity,feedback_complexity,equipment_complexity,prone_demand,
      contact_demand,feedback_pressure,support_contract,feedback_contract,
      equipment_required,external_load_method,feedback_load,local_fatigue,
      technical_fatigue,recovery_hours)
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
  SELECT p.id,v.id,p.profile_key,p.phase_key,p.role,
    CASE p.phase_key WHEN 'prepare_and_access' THEN
      'Use a brief exact prone breath cycle to verify floor access, face clearance, comfortable support, feedback, stop, and reset before higher-intent work without creating fatigue.'
    ELSE
      'Use comfortable exact prone breath cycles as a low-load downshift option when the selected position, support, feedback, symptoms, cumulative exposure, and session objective all permit it.' END,
    CASE p.phase_key WHEN 'prepare_and_access' THEN v.prepare_suitability
      ELSE v.restore_suitability END,
    CASE p.phase_key WHEN 'prepare_and_access' THEN 82 ELSE 88 END,
    jsonb_build_object(
      'primaryObjective',CASE p.phase_key WHEN 'prepare_and_access' THEN
        'brief_prone_breath_support_and_feedback_access' ELSE
        'comfortable_low_load_prone_breath_downshift' END,
      'variant',v.variant_key,'validOnlyWhenExactVariantPasses',TRUE,
      'fatigueCeiling','very_low','notConditioningTreatmentOrAthleteRanking',TRUE),
    jsonb_build_object(
      'sets',CASE p.phase_key WHEN 'prepare_and_access' THEN 1 ELSE 2 END,
      'breathCyclesMin',CASE p.phase_key WHEN 'prepare_and_access' THEN 3 ELSE 4 END,
      'breathCyclesMax',CASE p.phase_key WHEN 'prepare_and_access' THEN v.prepare_cycles ELSE v.restore_cycles END,
      'restSecondsMin',CASE p.phase_key WHEN 'prepare_and_access' THEN 0 ELSE 20 END,
      'restSecondsMax',CASE p.phase_key WHEN 'prepare_and_access' THEN 30 ELSE 60 END,
      'cadence','comfortable nasal inhale and slow unforced nasal exhale; any short pause must be optional annotated and symptom free',
      'validCycle','exact support and feedback comfortable inhale observable abdominal or lower-rib feedback slow unforced exhale comfortable reset',
      'countInvalidPartialAssistedAndSymptomLimitedCyclesAsExposure',TRUE,
      'effortCap','stop_before_breath_position_feedback_or_reset_requires_force',
      'doseAuthority','candidate_profile_pending_human_review'),
    'Exact selected support, face clearance, relaxed elbows shoulders chest neck pelvis and legs, comfortable unforced breath, observable feedback, no added movement, symptom-free reset, and safe exit pass; the last cycle is no more effortful than the first.',
    ARRAY[
      'Pain, increasing pressure, headache, jaw or neck strain, numbness, tingling, weakness, or a new neurologic symptom.',
      'Dizziness, faintness, chest pain, unusual shortness of breath, panic, air hunger, nausea, vision change, or inability to answer the stop cue.',
      'Face, nose, or mouth clearance is compromised or the head, hands, surface, bolster, or band becomes unstable, restrictive, displaced, damaged, or contaminated.',
      'Breathing becomes forced, held, noisy, rapidly escalating, or cannot return to a comfortable baseline.',
      'Elbows post, shoulders shrug, neck or jaw braces, or the chest, trunk, pelvis, or limbs add rocking, extension, lifting, twisting, or another action.',
      'Consent for touch is absent, withdrawn, unclear, or the coach contact supports or restrains the body.',
      'The coach cannot see the exact support feedback and symptom response or another person enters the floor-transfer or prone station.',
      'The planned cycle, prone-time, respiratory, trunk, floor-transfer, or feedback-equipment budget is reached.',
      'The athlete requests stop or cannot exit the floor safely.'
    ]::TEXT[],
    'Verify exact definition and variant, floor transfer, clean stable surface, face clearance, head and hand support, lower-leg support or band condition and quick removal, current symptoms, prior respiratory trunk and prone exposure, dose, optional cadence, touch consent, stop signal, privacy, and exit. Observe and record every cycle and revalidate the complete workout after any change.',
    CASE v.variant_key
      WHEN 'flat-prone-stacked-hands' THEN 'Lie flat with your forehead on stacked hands and your face clear. Breathe in comfortably into the floor, exhale slowly without forcing, reset, and stop for any symptom.'
      WHEN 'lower-leg-bolster-support' THEN 'Rest both lower legs on the assigned bolster, keep your face clear, breathe in comfortably into the floor, exhale slowly without forcing, and reset.'
      ELSE 'Keep the light band comfortable and nonrestrictive. Breathe gently into the floor and band, exhale slowly, reset, and stop if the band shifts or feels restrictive.' END,
    CASE p.phase_key WHEN 'prepare_and_access' THEN
      'Clearer access to the exact prone support, comfortable breath cycle, feedback, stop, and reset without meaningful fatigue.'
    ELSE
      'More repeatable comfortable low-effort prone breath cycles and reliable recognition of support, feedback, symptoms, and reset.' END,
    v.equipment_required,
    jsonb_build_object(
      'stationType',v.station_type,'athletesPerStation',1,
      'setupSeconds',v.setup_seconds,'cycleSecondsEstimate',10,
      'resetSeconds',5,'transitionSeconds',v.transition_seconds,
      'requiresDirectObservation',v.requires_direct_observation,
      'requiresSafeFloorTransfer',TRUE,'requiresFaceClearance',TRUE,
      'privacyAndConsentRequired',TRUE,
      'bandQuickRemovalRequired',v.variant_key='light-elastic-band-lateral-feedback',
      'sharedStationPolicy','next athlete waits outside the complete floor-transfer and prone envelope until the athlete coach and equipment clear',
      'equipmentChangeInvalidatesCachedLogistics',TRUE),
    v.substitution_ids,'review',
    jsonb_build_object(
      'durationFormula','floor entry + support and feedback setup + sum(each actual valid invalid partial assisted or symptom-limited cycle and reset) + rest + equipment removal + floor exit + transition',
      'estimateSeconds',CASE p.phase_key WHEN 'prepare_and_access' THEN v.prepare_duration ELSE v.restore_duration END,
      'lowerBoundSeconds',CASE p.phase_key WHEN 'prepare_and_access' THEN 45 ELSE 70 END,
      'upperBoundSeconds',CASE p.phase_key WHEN 'prepare_and_access' THEN 180 ELSE 300 END,
      'includeEveryCycleSymptomPauseAndFloorTransfer',TRUE,
      'recomputeAfterSubstitution',TRUE),
    jsonb_build_object(
      'regressionOrder',jsonb_build_array('reduce cycles','increase rest','remove optional cadence','select lower-leg bolster or a distinct non-prone card only after full revalidation'),
      'progressionOrder',jsonb_build_array('improve comfortable repeatability','increase cycles within reviewed profile','add only an exact reviewed nonrestrictive feedback variant','never progress by forcing pressure retention or fatigue'),
      'neverScaleBy',jsonb_build_array('athlete proficiency label','age category','forced breath hold','restrictive band','pain tolerance','unconsented touch'),
      'revalidateAllGenerationInputs',TRUE),
    jsonb_build_object(
      'planned',jsonb_build_array('definition and variant','surface and support','feedback equipment','touch consent','sets and cycles','cadence','rest','supervision and exit'),
      'actual',jsonb_build_array('valid invalid partial assisted and symptom-limited cycles','first fault','symptoms and stop reason','prone and floor-transfer time','support feedback band and touch events','duration and substitution'),
      'cumulativeBudgets',jsonb_build_array('breath cycles and effort','prone time','respiratory and trunk exposure','head hand anterior-body and lower-leg contact','floor transfers','feedback equipment and touch'),
      'persistenceRequired',TRUE,'coachAndAthleteRenderingRequired',TRUE),
    jsonb_build_object(
      'athletePrompt','Report any symptom restriction fear uncertainty or change in support feedback breath comfort and ability to reset and exit.',
      'coachPrompt','Record exact variant support feedback equipment touch consent every cycle first fault symptoms stop reason exposure substitution actual duration and exit.',
      'supportPrompt','Quarantine identity environment consent equipment media instruction dose rendering or persistence mismatches; never convert them into approval.',
      'incidentPrompt','Stop, remove restrictive equipment, restore face and breathing clearance, help exit if needed, document exact symptoms contacts and events, and follow facility policy.')
  FROM (VALUES
    (flat_variant,'flat-prone-stacked-hands',ARRAY['mat']::TEXT[],
      'clean_prone_floor_station',20,15,70,92,5,8,90,180,FALSE,
      ARRAY[bolster_variant,band_variant,hooklying_variant,lateral_variant]::UUID[]),
    (bolster_variant,'lower-leg-bolster-support',ARRAY['mat','bolster']::TEXT[],
      'prone_floor_station_with_lower_leg_bolster',35,20,72,94,5,8,105,195,FALSE,
      ARRAY[flat_variant,band_variant,hooklying_variant,lateral_variant]::UUID[]),
    (band_variant,'light-elastic-band-lateral-feedback',ARRAY['mat','bands']::TEXT[],
      'prone_floor_station_with_quick_release_feedback_band',45,25,66,86,5,6,120,210,TRUE,
      ARRAY[flat_variant,bolster_variant,hooklying_variant,lateral_variant]::UUID[])
  ) v(id,variant_key,equipment_required,station_type,setup_seconds,
      transition_seconds,prepare_suitability,restore_suitability,
      prepare_cycles,restore_cycles,prepare_duration,restore_duration,
      requires_direct_observation,substitution_ids)
  JOIN (VALUES
    ('8e085665-13ec-4108-ab1c-ecfc3d76c742'::UUID,flat_variant,'prepare-and-access-brief','prepare_and_access','secondary'),
    ('b6dae563-5bff-4590-ad57-ee3d4f9925a3'::UUID,flat_variant,'restore-comfortable-cycles','restore','primary'),
    ('22703b43-83fe-4fe9-b705-1b448f19ca4e'::UUID,bolster_variant,'prepare-and-access-brief','prepare_and_access','secondary'),
    ('803d1791-6a16-4d7d-b973-a5374a1be194'::UUID,bolster_variant,'restore-comfortable-cycles','restore','primary'),
    ('a8b4e9db-b479-43de-a243-df601eb4ad18'::UUID,band_variant,'prepare-and-access-brief','prepare_and_access','conditional'),
    ('8d87bab9-b3c9-44e2-a6bd-d1969a5987e9'::UUID,band_variant,'restore-comfortable-cycles','restore','conditional')
  ) p(id,variant_id,profile_key,phase_key,role) ON p.variant_id=v.id
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
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by,resolved_at)
  SELECT 1,canonical_definition,b.right_id,'distinct_exercises',b.rationale,
    jsonb_build_object(
      'migration',migration_key,'identityBoundary',b.boundary_key,
      'leftContract','flat_prone_stacked_hand_support_comfortable_inhale_abdominal_and_lower_rib_floor_feedback_slow_unforced_exhale_comfortable_reset',
      'rightContract',b.right_contract,
      'primaryIdentitySource','https://www.functionalmovement.com/exercises/776/single_leg_chop_2_step_motion',
      'identityOnlyNeighborStillRequiresItsOwnAudit',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'deterministic_identity_equivalence',NULL,now()
  FROM (VALUES
    (hooklying_definition,'prone_floor_feedback_vs_supine_hooklying_brace','Hooklying breathing uses supine back support, flexed hips and knees, feet on the floor, and a brace/exhale contract rather than anterior prone floor feedback.','supine_hooklying_feet_supported_brace_and_exhale'),
    (box_definition,'comfortable_prone_cycle_vs_prescribed_four_phase_hold','Box Breathing uses four prescribed timed inhale hold exhale hold phases and does not require this prone support contract.','four_timed_breath_phases_with_two_holds'),
    (med_ball_definition,'floor_feedback_vs_medicine_ball_abdominal_contact','Medicine-ball abdominal feedback changes equipment, external contact, pressure, load, monitoring, and repetition validity.','declared_medicine_ball_abdominal_contact_and_breath_cycle'),
    (swimmer_definition,'static_breath_cycle_vs_prone_limb_hover','Prone Swimmer Hover adds shoulder hip and spinal limb elevation plus a hold timer, replacing the static comfortable breath-cycle endpoint.','prone_limb_elevation_hover_and_timer'),
    (ytw_iso_definition,'breath_cycle_vs_prone_ytw_isometric_series','Prone Y-T-W Isometric Series scores arm positions and isometric holds with shoulder and scapular action rather than one breath cycle.','prone_y_t_w_arm_positions_with_isometric_holds'),
    (ytw_raise_definition,'breath_cycle_vs_prone_ytw_raise','Prone Y-T-W Raise adds repeated arm elevation and lowering with shoulder and scapular motion rather than a static supported breath cycle.','prone_y_t_w_dynamic_arm_raise_sequence')
  ) b(right_id,boundary_key,rationale,right_contract)
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,resolution_source=EXCLUDED.resolution_source,
    reviewed_by=NULL,resolved_at=now();

  INSERT INTO coaching.exercise_section_evidence_v1(
    definition_id,reviewed_card_version,section_key,source_url,source_title,
    source_publisher,source_kind,claims_json,evidence_quality,review_status,
    reviewer_user_id,reviewed_at)
  SELECT canonical_definition,2,e.section_key,e.source_url,e.source_title,
    e.publisher,e.source_kind,jsonb_build_array(
      jsonb_build_object('supported',e.supported_claim,'scope',e.scope),
      jsonb_build_object('limitation',e.limitation,
        'noUniversalTechniqueSafetyEligibilityDoseRecoveryOutcomeOrDifficultyClaim',TRUE)),
    e.evidence_quality,'candidate',NULL,NULL
  FROM (VALUES
    ('identity','https://www.functionalmovement.com/exercises/776/single_leg_chop_2_step_motion','Crocodile Breathing','Functional Movement Systems','expert_instruction','The direct page specifies prone position, forehead on stacked hands, relaxed chest arms and neck, nasal inhale with abdominal floor contact, slow nasal exhale, and continuation while comfortable.','exact_named_exercise_setup_and_action','It does not establish one universal cadence dose outcome eligibility or Vortex score.',86),
    ('taxonomy','https://www.functionalmovement.com/articles/780/take_a_deep_breath','Take A Deep Breath','Functional Movement Systems','expert_instruction','The observable task is flat prone breath control with static floor and hand contacts rather than spinal extension rocking plank or limb motion.','professional_instruction_and_alternate_context','Professional instruction does not create controlled platform terms or publication approval.',82),
    ('anatomy','https://doi.org/10.1114/1.1332084','Compartmental analysis of breathing in the supine and prone positions by optoelectronic plethysmography','Annals of Biomedical Engineering','peer_reviewed_research','Optoelectronic plethysmography documents position-dependent chest-wall compartment behavior during prone and supine breathing.','adjacent_prone_supine_chest_wall_kinematics','This is not a trial of Crocodile Breathing and does not quantify exact muscle force or structural correction.',84),
    ('biomechanics','https://doi.org/10.1114/1.1332084','Compartmental analysis of breathing in the supine and prone positions by optoelectronic plethysmography','Annals of Biomedical Engineering','peer_reviewed_research','Prone versus supine positioning changed the distribution of chest-wall compartment volume during quiet breathing in the studied setting.','adjacent_position_dependent_chest_wall_behavior','It does not prove universal posterior expansion diaphragm isolation treatment or ideal technique.',84),
    ('difficulty','https://pubmed.ncbi.nlm.nih.gov/41482169/','The health effects of diaphragmatic breathing: A systematic review','Complementary Therapies in Medicine','peer_reviewed_research','Diaphragmatic-breathing protocols and outcomes are heterogeneous and no source assigns an exercise-complexity or physical-difficulty score.','systematic_review_of_heterogeneous_breathing_interventions','The review cannot calibrate Vortex scores or classify athlete proficiency.',92),
    ('load_fatigue_recovery','https://pubmed.ncbi.nlm.nih.gov/41482169/','The health effects of diaphragmatic breathing: A systematic review','Complementary Therapies in Medicine','peer_reviewed_research','Low external load does not erase respiratory positional contact feedback-equipment or symptom exposure and adverse-event reporting is incomplete.','heterogeneous_intervention_and_safety_reporting','No universal load dose fatigue ceiling recovery interval or adverse-event rate is established.',92),
    ('constraints','https://www.functionalmovement.com/articles/780/take_a_deep_breath','Take A Deep Breath','Functional Movement Systems','expert_instruction','The article keeps the athlete flat rather than posted on elbows and recommends another position when comfortable prone alignment is not achievable.','professional_setup_support_and_alternate_instruction','It does not establish universal contraindications clinical clearance or facility logistics.',82),
    ('dosage','https://www.functionalmovement.com/articles/780/take_a_deep_breath','Take A Deep Breath','Functional Movement Systems','expert_instruction','The article offers example breath counts and practice duration as instruction examples.','professional_practice_examples','Examples do not validate one universal set cycle cadence rest frequency or recovery prescription.',82),
    ('instructions','https://www.functionalmovement.com/exercises/776/single_leg_chop_2_step_motion','Crocodile Breathing','Functional Movement Systems','expert_instruction','The direct sequence supports flat prone placement, forehead on stacked hands, relaxed upper body, nasal inhale into floor contact, slow exhale, and comfortable continuation.','exact_named_exercise_instruction','The page does not approve every cue variant stop rule or accessibility method.',86),
    ('safety_stop_rules','https://pubmed.ncbi.nlm.nih.gov/41482169/','The health effects of diaphragmatic breathing: A systematic review','Complementary Therapies in Medicine','peer_reviewed_research','Protocol heterogeneity and incomplete safety reporting do not justify forcing inhalation exhalation pressure retention or prone tolerance.','systematic_review_safety_limit','The review does not provide a universal emergency threshold or authorize clinical decisions.',92),
    ('programming','https://www.functionalmovement.com/articles/780/take_a_deep_breath','Take A Deep Breath','Functional Movement Systems','expert_instruction','Crocodile Breathing is presented as an instructional entry point with examples rather than a universal workout phase or sport-transfer prescription.','professional_programming_context','The article does not establish Vortex phase placement dose outcome or automatic progression.',82),
    ('athlete_support','https://www.functionalmovement.com/exercises/776/single_leg_chop_2_step_motion','Crocodile Breathing','Functional Movement Systems','expert_instruction','Plain-language setup, relaxed upper-body instruction, nasal breathing, abdominal floor contact, slow exhale, and comfort checks support understandable athlete directions.','exact_named_exercise_plain_language','The source does not establish universal accessibility symptom interpretation or treatment.',86),
    ('coach_support','https://www.functionalmovement.com/articles/780/take_a_deep_breath','Take A Deep Breath','Functional Movement Systems','expert_instruction','Flat alignment, upper-versus-lower initiation, lateral expansion, forcing, support comfort, consented touch, and feedback equipment are observable coaching concerns.','professional_observation_and_feedback_instruction','The article does not authorize unconsented touch or one universal coaching correction.',82),
    ('accessibility','https://www.functionalmovement.com/articles/780/take_a_deep_breath','Take A Deep Breath','Functional Movement Systems','expert_instruction','A lower-leg bolster may improve comfort and another position should be used when a comfortable flat prone position is not achievable.','professional_support_and_position_alternate_instruction','A suggested support does not establish suitability for a particular person or replace accessibility review.',82),
    ('alternates','https://www.functionalmovement.com/articles/780/take_a_deep_breath','Take A Deep Breath','Functional Movement Systems','expert_instruction','The article distinguishes flat prone from hooklying and describes lower-leg bolster coach-touch cuff-weight and elastic-band feedback options.','professional_alternate_form_instruction','Device mass placement and safety are incomplete and every definition variant or annotation boundary still requires review.',82),
    ('media','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en','Embed videos and playlists','YouTube Help','manufacturer_instruction','Five candidate URLs returned current YouTube oEmbed title channel thumbnail and iframe metadata on 2026-08-02.','candidate_metadata_and_privacy_enhanced_embed_format_only','oEmbed does not prove playback exact action captions accessibility cue quality safety conflicts reviewer identity or approval.',82)
  ) e(section_key,source_url,source_title,publisher,source_kind,supported_claim,
      scope,limitation,evidence_quality)
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
    'https://www.youtube-nocookie.com/embed/'||m.video_id,m.video_id,m.title,
    m.channel,NULL,'en',NULL,TRUE,NULL,NULL,'healthy','candidate',
    'manual_research',m.source_query,NULL,NULL,
    '2026-11-02'::TIMESTAMPTZ,
    'YouTube oEmbed returned current title channel thumbnail and iframe metadata on 2026-08-02. This does not establish playback, exact Crocodile definition or variant, prone support, feedback equipment, breath action, captions, accessibility, safety, cue quality, conflicts, reviewer identity, or approval.'
  FROM (VALUES
    ('2mCwbWPtICI','Joe Sullivan Demonstrates Crocodile Breathing | elitefts.com','elitefts','legacy candidate checked by YouTube oEmbed'),
    ('76-Sw5nZ2YI','Crocodile Breathing: Improve Core Strength & Spinal Stability | MYo Lab Health & Wellness','MYo Lab Health & Wellness','legacy candidate checked by YouTube oEmbed'),
    ('_8f9RHUfE1Q','Crocodile Breathing','Garrett McLaughlin','legacy candidate checked by YouTube oEmbed'),
    ('aimIzymb81E','Crocodile Breathing | Breath Patterning','Dr. Carl Baird','legacy candidate checked by YouTube oEmbed'),
    ('XhYrGbEI2c8','Crocodile Breathing Exercise','New Dimensions Physical Therapy','exact-name search checked by YouTube oEmbed')
  ) m(video_id,title,channel,source_query)
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
  SELECT canonical_definition,2,a.alternate_name,a.classification,a.rationale,
    jsonb_build_object(
      'boundaryKey',a.boundary_key,'factsRequired',a.facts_required,
      'supportActionFeedbackBreathCycleTerminalAndExitRequired',TRUE,
      'neverInferFromNameAgeSkillOrAthleteRanking',TRUE),
    jsonb_build_object(
      'status',a.proposed_status,'classificationCandidate',a.classification,
      'requiredFacts',a.facts_required,
      'humanIdentityContentAndSafetyReviewRequired',TRUE,
      'approvalsCreated',FALSE),
    'candidate',NULL,NULL
  FROM (VALUES
    ('Prone Crocodile Breathing','same_identity','Direct synonym only when the flat prone stacked-hand support and exact comfortable breath cycle remain unchanged.','direct_synonym',jsonb_build_array('flat_prone','stacked_hands','comfortable_cycle','reset'),'research_queue'),
    ('Lower-Leg Bolster Crocodile Breathing','same_identity','Exact support-bearing working specification authored as a variant because the scored breath cycle remains unchanged while support equipment changes.','bolster_exact_variant',jsonb_build_array('bolster_type','height','firmness','bilateral_lower_leg_contact','stability','exit'),'authored_variant'),
    ('Light Elastic-Band Feedback Crocodile Breathing','same_identity','Exact feedback-equipment working specification authored as a variant because the scored cycle remains unchanged while nonrestrictive lateral feedback changes.','band_exact_variant',jsonb_build_array('band_type','condition','placement','tension','quick_removal','restriction'),'authored_variant'),
    ('Consented Coach Tactile Cueing','modifier_annotation','Permission-based light observation feedback does not support the body or change the breath cycle; consent and contact remain persisted delivery facts.','consented_touch_annotation',jsonb_build_array('consent','contact_location','pressure','timing','withdrawal','coach_role'),'delivery_annotation'),
    ('Optional Short Pause Between Breath Phases','modifier_annotation','A comfortable optional pause is cadence metadata while the same inhale exhale reset and support remain exact; forced or timed-hold protocols are different.','cadence_annotation',jsonb_build_array('phase','duration','optional','comfort','stop','no_forcing'),'delivery_annotation'),
    ('Breath Cycles, Sets, and Rest','modifier_annotation','Dose changes exposure and duration without changing identity while every support and action remains exact.','dose_annotation',jsonb_build_array('cycles','sets','rest','duration','fatigue','symptoms'),'delivery_annotation'),
    ('Light Cuff Weights on Back','new_variant','External devices and load location change feedback and load; device mass placement migration risk monitoring and safety are underspecified and remain quarantined.','cuff_weight_quarantine',jsonb_build_array('device','mass','count','placement','migration','pressure','removal','safety'),'needs_human_review'),
    ('Hooklying Diaphragmatic Breathing','new_definition','Supine orientation back support and self-directed hand feedback replace prone anterior floor contact.','hooklying_distinct',jsonb_build_array('orientation','back_support','feet','hands','brace','breath_cycle'),'existing_distinct_definition'),
    ('Supported 90/90 Breathing with Bilateral Reach','new_definition','Supine leg support and bilateral arm reach change orientation support shoulder action and valid completion.','supported_9090_reach_distinct',jsonb_build_array('leg_support','hip_knee_position','bilateral_reach','breath_cycle','reset'),'existing_distinct_definition'),
    ('90/90 Wall-Supported Breathing with Lateral Expansion','new_definition','Supine wall support and hands-on-ribs feedback differ from prone anterior floor feedback.','lateral_expansion_distinct',jsonb_build_array('supine','wall_support','hands_on_ribs','no_reach','breath_cycle'),'existing_distinct_definition'),
    ('90/90 Hip Lift with Ball and Balloon','new_definition','Heel pull hip lift ball pressure asymmetric arms and resisted balloon exhalation create a different action and equipment boundary.','ball_and_balloon_distinct',jsonb_build_array('heel_pull','hip_lift','ball','balloon','laterality','resisted_exhale'),'existing_distinct_definition'),
    ('Box Breathing Hold','new_definition','Four prescribed timed phases with breath holds define a different breath-cycle contract and need not use prone support.','box_breath_distinct',jsonb_build_array('inhale_time','hold_one','exhale_time','hold_two','position','stop'),'existing_distinct_definition'),
    ('Med Ball Belly Breathing','new_definition','External medicine-ball abdominal contact and pressure replace floor feedback and change equipment and load.','med_ball_distinct',jsonb_build_array('ball_mass','placement','pressure','support','breath_cycle','removal'),'existing_distinct_definition'),
    ('Makarasana Yoga Pose','new_definition','The named pose has variable arm head leg rest and breath contracts and cannot be assumed equal without a complete specification.','makarasana_variable_identity',jsonb_build_array('school','arm_position','head_position','leg_position','pose_hold','breath_contract'),'research_queue'),
    ('Elbow-Posted Prone Breathing','new_definition','Posting on the elbows changes upper-extremity support thoracic and cervical position load and valid contacts.','elbow_posted_distinct',jsonb_build_array('forearm_contact','elbow_load','shoulder_position','spinal_position','breath_cycle','exit'),'research_queue'),
    ('Crocodile Rocking','new_definition','Rocking adds repeated trunk or limb motion and a movement endpoint absent from the static breath cycle.','rocking_distinct',jsonb_build_array('start','rock_direction','range','repetitions','breathing','finish'),'research_queue'),
    ('Prone Press-Up or Cobra with Breathing','new_definition','Active spinal extension and arm support change joint actions load and repetition boundary.','press_up_cobra_distinct',jsonb_build_array('hand_or_forearm_support','spinal_extension','range','breathing','terminal','exit'),'research_queue'),
    ('Prone Swimmer Hover','new_definition','Limb elevation and hover time add shoulder hip and spinal actions and physical demand.','swimmer_distinct',jsonb_build_array('limb_lift','shape','hold','breathing','lowering','finish'),'existing_distinct_definition'),
    ('Pursed-Lip Exhale in Exact Prone Setup','modifier_annotation','Exhale route is delivery metadata only when support comfortable effort no forced retention and reset remain exact; clinical protocols require separate review.','exhale_route_annotation',jsonb_build_array('exhale_route','effort','duration','comfort','clinical_context','reset'),'delivery_annotation'),
    ('Pain-Through, Obstructed, or Forced Crocodile Breathing','reject','Continuing through symptoms blocked face clearance restrictive equipment forced pressure or loss of support violates the repetition and stop contract.','invalid_unsafe_state',jsonb_build_array('symptom','airway','restriction','forcing','support_loss','stop_response'),'rejected_behavior')
  ) a(alternate_name,classification,rationale,boundary_key,facts_required,proposed_status)
  ON CONFLICT(definition_id,reviewed_card_version,alternate_name) DO UPDATE SET
    classification=EXCLUDED.classification,rationale=EXCLUDED.rationale,
    distinguishing_dimensions=EXCLUDED.distinguishing_dimensions,
    proposed_card_json=EXCLUDED.proposed_card_json,review_status='candidate',
    reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_relationship_v1(
    from_variant_id,to_variant_id,relationship,similarity_score,dimensions,
    reason,conditions_json,review_status,created_by,reviewed_by,reviewed_at)
  SELECT r.from_id,r.to_id,r.relationship,r.similarity,r.dimensions,r.reason,
    jsonb_build_object(
      'migration',migration_key,'reviewOnly',TRUE,'automaticSubstitution',FALSE,
      'revalidate',jsonb_build_array(
        'identity','position','support and face clearance','feedback equipment',
        'touch consent','population constraints and symptoms','purpose','dose',
        'respiratory trunk prone and contact budgets','duration','floor transfer',
        'logistics','persistence','coach rendering','athlete rendering'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'review',NULL,NULL,NULL
  FROM (VALUES
    (flat_variant,bolster_variant,'equipment_equivalent',88,
      ARRAY['equipment','support','stability','complexity','fatigue']::TEXT[],
      'Adds stable lower-leg bolster support while retaining the same flat-prone stacked-hand comfortable breath-cycle identity; support comfort floor transfer logistics and duration still change.'),
    (bolster_variant,flat_variant,'equipment_equivalent',88,
      ARRAY['equipment','support','stability','complexity','fatigue']::TEXT[],
      'Removes lower-leg bolster support while retaining the same breath cycle, requiring renewed prone-position and lower-limb comfort validation.'),
    (flat_variant,band_variant,'equipment_equivalent',82,
      ARRAY['equipment','feedback','complexity','fatigue']::TEXT[],
      'Adds a declared light nonrestrictive lower-rib feedback band without changing the scored breath cycle, but changes equipment pressure monitoring consent logistics and stop rules.'),
    (band_variant,flat_variant,'equipment_equivalent',82,
      ARRAY['equipment','feedback','complexity','fatigue']::TEXT[],
      'Removes band feedback and its restriction and migration risks while retaining the exact flat-prone cycle; purpose and feedback needs must be revalidated.'),
    (flat_variant,lateral_variant,'lateral_substitution',66,
      ARRAY['support','stability','complexity','fatigue']::TEXT[],
      'Changes prone anterior floor feedback to supine wall-supported 90/90 hands-on-ribs feedback and therefore changes identity position contacts access constraints and rendering.'),
    (lateral_variant,flat_variant,'lateral_substitution',66,
      ARRAY['support','stability','complexity','fatigue']::TEXT[],
      'Changes wall-supported supine lateral-rib feedback to flat prone floor feedback and requires safe floor transfer face clearance prone tolerance and complete redosing.'),
    (flat_variant,hooklying_variant,'lateral_substitution',62,
      ARRAY['support','stability','complexity','fatigue']::TEXT[],
      'Changes prone floor feedback to supine hooklying support and a brace/exhale emphasis; this is a distinct identity and never an automatic equivalent.'),
    (hooklying_variant,flat_variant,'lateral_substitution',62,
      ARRAY['support','stability','complexity','fatigue']::TEXT[],
      'Changes supine hooklying support to a flat prone stacked-hand cycle with different contacts symptoms floor access and objective constraints.')
  ) r(from_id,to_id,relationship,similarity,dimensions,reason)
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
  SELECT 1,v.id,d.dimension,
    CASE d.dimension WHEN 'technicalComplexity' THEN v.complexity ELSE v.physical END,
    20,
    CASE d.dimension WHEN 'technicalComplexity' THEN
      'Review-only exercise-complexity anchor based on exact flat-prone setup, face and support checks, one comfortable inhale and exhale, feedback interpretation, error detection, reset, and variant-specific support or equipment management.'
    ELSE
      'Review-only physical-difficulty anchor based on low respiratory and positional effort, floor transfer, prone and contact tolerance, and variant-specific support or nonrestrictive feedback pressure.' END
      ||' This scores the exercise task, not athlete proficiency. Variant: '||v.variant_key||'.',
    'review',1,NULL,NULL,
    'Research-informed proposal only; independent comparison and qualified human approval remain required.',NULL
  FROM (VALUES
    (flat_variant,'flat-prone-stacked-hands',18,4),
    (bolster_variant,'lower-leg-bolster-support',20,3),
    (band_variant,'light-elastic-band-lateral-feedback',24,5)
  ) v(id,variant_key,complexity,physical)
  CROSS JOIN (VALUES('technicalComplexity'),('absoluteLoadDemand')) d(dimension)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
    proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,
    reviewed_by=NULL,review_notes=EXCLUDED.review_notes,reviewed_at=NULL,
    updated_at=now();

  UPDATE coaching.exercise SET
    name='Crocodile Breathing',slug='crocodile-breathing',
    description='Flat prone breathing with the forehead on stacked hands, face clear, upper body and legs relaxed, and the selected no-feedback, lower-leg-bolster, or light nonrestrictive band-feedback canonical variant. One repetition is a comfortable nasal inhale into abdominal and lower-rib floor feedback, a slow unforced nasal exhale, and a comfortable reset.',
    instructions='Select and record the exact canonical variant. Lie flat prone on a clean stable surface with your forehead on stacked hands, face clear, elbows resting, and chest, neck, pelvis, and legs relaxed. Set the declared lower-leg bolster or light band only when that exact variant is selected. Inhale comfortably through the nose into abdominal and lower-rib floor feedback, exhale slowly without forcing, and reset. Do not post on the elbows, force pressure or holds, restrict breathing, or add rocking, spinal extension, or limb motion. Stop for symptoms, obstruction, equipment movement, support loss, or inability to reset and exit safely.',
    skill_level=NULL,age_min=NULL,age_max=NULL,
    default_sets=1,default_reps=5,default_work_seconds=NULL,
    default_rest_seconds=30,
    tempo='comfortable nasal inhale; slow unforced nasal exhale; optional short pause only as declared delivery cadence',
    load_note='Low external load is not zero exposure. Track actual cycles, breath effort, prone time, floor transfers, support and feedback equipment, contact, consent, symptoms, invalid cycles, and same-session respiratory and trunk work.',
    est_seconds_per_set=90,is_published=FALSE,archived=FALSE,
    card_summary='Exact flat-prone stacked-hand breath cycle with no external feedback, lower-leg bolster support, or light nonrestrictive elastic-band feedback selected as separate variants.',
    coach_language='Verify exact variant, clean stable surface, safe floor transfer, face clearance, stacked-hand and head support, relaxed elbows shoulders chest neck pelvis and legs, bolster or band condition and placement, touch consent, comfortable unforced breath, observable feedback, symptoms, reset, actual cycles, prone time, and safe exit.',
    athlete_language='Rest flat with your forehead on stacked hands and your face clear. Breathe in comfortably into the floor, exhale slowly without forcing, reset, and stop for any symptom or restriction.',
    programming_logic=jsonb_build_object(
      'selectionStatus','canonical_variant_required','selectable',TRUE,
      'canonicalDefinitionId',canonical_definition,
      'exactVariantIds',to_jsonb(active_variant_ids),
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'exerciseDifficultyDescribesTaskOnly',TRUE,
      'selectionInputs',jsonb_build_array('workout purpose','floor access and transfer','prone and breathing comfort','face and airway clearance','support and feedback equipment','touch consent','current symptoms','prior respiratory trunk prone and contact exposure'),
      'substitutionRevalidation',jsonb_build_array('identity','position and support','feedback equipment','touch consent','population constraints','dose','fatigue and exposure budgets','duration','floor transfer and logistics','persistence','coach rendering','athlete rendering'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    scalable_variables=ARRAY['breath_cycles','sets','rest_seconds','comfortable_inhale_seconds','unforced_exhale_seconds','optional_pause_seconds','lower_leg_support','feedback_equipment']::TEXT[],
    movement_family='Prone Crocodile Breath Cycle',
    primary_phase_key=NULL,phase_subrole=NULL,primary_order_slot=NULL,
    movement_requirements=jsonb_build_object(
      'selectable',TRUE,'canonicalVariantRequired',TRUE,
      'supportInterface','flat_prone_forehead_on_stacked_hands_with_exact_declared_lower_leg_and_feedback_contract',
      'actionSequence',jsonb_build_array('comfortable_nasal_inhale','abdominal_and_lower_rib_floor_or_declared_feedback','slow_unforced_nasal_exhale','comfortable_reset'),
      'mustMaintain',jsonb_build_array('unobstructed_face_and_airway','relaxed_elbows_shoulders_chest_neck_pelvis_and_legs','exact_support_and_feedback','comfortable_unforced_breathing','quiet_body','safe_exit'),
      'mustNotAdd',jsonb_build_array('elbow_posting','forced_pressure','prescribed_forced_breath_hold','restrictive_equipment','rocking','spinal_extension','limb_lift','external_respiratory_resistance'),
      'validCompletion','one_comfortable_inhale_and_slow_unforced_exhale_with_exact_support_feedback_reset_and_no_symptoms'),
    coaching_execution=jsonb_build_object(
      'qualityGates',jsonb_build_array('exact_variant_visible','face_clear','support_stable','upper_body_and_limbs_relaxed','breathing_unforced','feedback_nonrestrictive','no_added_motion','comfortable_reset_and_exit'),
      'stopRules',jsonb_build_array('pain_or_neurologic_symptom','dizziness_or_faintness','chest_pain_or_unusual_shortness_of_breath','panic_or_air_hunger','face_obstruction','equipment_restriction_or_migration','forced_breathing_or_retention','loss_of_support','added_motion','cannot_reset_or_exit'),
      'persistence',jsonb_build_array('definition_and_variant','surface_support_and_feedback','touch_consent','planned_and_actual_cycles','cadence_if_prescribed','valid_invalid_partial_assisted_and_symptom_limited_cycles','first_fault','symptoms_and_stop_reason','prone_and_floor_transfer_time','duration','substitution')),
    pairing_logic=jsonb_build_object(
      'sameSessionBudget',jsonb_build_array('breath_cycles_and_effort','respiratory_and_trunk_work','prone_time','floor_transfers','head_hand_anterior_body_and_lower_leg_contact','feedback_equipment_and_touch'),
      'avoidAutomaticPairingWith',jsonb_build_array('forced_breath_holds','maximal_respiratory_loading','symptom_provoking_prone_work','high_priority_output_when_downshift_conflicts_with_objective'),
      'revalidateAfterSubstitution',TRUE),
    media_library=jsonb_build_object(
      'candidate_video_ids',jsonb_build_array('2mCwbWPtICI','76-Sw5nZ2YI','_8f9RHUfE1Q','aimIzymb81E','XhYrGbEI2c8'),
      'reviewState','oembed_metadata_only_candidate_quarantine',
      'playbackExactnessCaptionsAccessibilityQualitySafetyAndApprovalVerified',FALSE,
      'humanReviewRequired',TRUE),
    programming_kind='exercise',linked_skill_id=NULL,
    why_publish_ready=FALSE,updated_at=now()
  WHERE id=22;

  UPDATE coaching.exercise_safety_profile SET
    risk_level=1,impact_level=0,minimum_age_recommended=NULL,
    minimum_skill_level=NULL,requires_spotting=FALSE,
    requires_coach_supervision='recommended',
    minimum_prerequisite_notes='Readiness is evaluated from the exact canonical variant, safe floor transfer, unobstructed face, comfortable resting breathing and prone support, current symptoms, support and feedback equipment, consent, and workout context; never from an exercise proficiency or age label.',
    readiness_checks=ARRAY[
      'Confirm exact flat, lower-leg bolster, or light nonrestrictive band-feedback canonical variant and its support and equipment.',
      'Confirm safe clean floor entry and exit, stable surface, clear face and airway, comfortable head hand neck trunk pelvic and lower-limb support.',
      'Confirm comfortable resting breathing and ability to report pain dizziness faintness chest pain unusual shortness of breath panic air hunger or neurologic symptoms.',
      'Confirm band condition placement tension and immediate removal plan when selected and explicit current consent before any coach touch.',
      'Review same-session respiratory trunk prone floor-transfer and contact exposure before assigning cycles.'
    ]::TEXT[],
    stop_signs=ARRAY[
      'Pain, pressure, numbness, tingling, weakness, headache, jaw or neck strain, or a new neurologic symptom.',
      'Dizziness, faintness, chest pain, unusual shortness of breath, panic, air hunger, nausea, vision change, or inability to communicate.',
      'Face obstruction, forced breath or hold, restrictive or migrating band, unstable support, elbow posting, added trunk or limb motion, or inability to reset.',
      'Surface, floor transfer, privacy, consent, observation, equipment, or safe exit becomes unavailable.',
      'Participant requests stop or the planned cycle, prone-time, respiratory, trunk, transfer, or contact budget is reached.'
    ]::TEXT[],
    contraindications=ARRAY[
      'Current symptoms or restrictions for which prone positioning or breathing participation has not been cleared when clearance is appropriate.',
      'No safe floor transfer, clean stable surface, unobstructed face, comfortable exact support, quickly removable feedback equipment, privacy, consent, observation, or exit.',
      'Workout requires forced pressure, respiratory resistance, prescribed timed holds, spinal extension, rocking, limb motion, or another distinct action.'
    ]::TEXT[],
    common_substitutions=ARRAY[
      'Select the exact lower-leg bolster variant only after complete support equipment dose duration and logistics revalidation.',
      'Select the exact no-feedback or light-band variant only after complete purpose pressure equipment and stop-rule revalidation.',
      'Select Hooklying, supported 90/90 reach, 90/90 lateral expansion, Box Breathing, or another card only as a distinct exercise identity.',
      'Do not add cuff weights, medicine-ball pressure, elbow posting, rocking, Cobra or press-up, limb hover, forced retention, or respiratory resistance under this card.'
    ]::TEXT[]
  WHERE exercise_id=22;

  UPDATE coaching.exercise_score_v1 SET
    technical_complexity=24,absolute_load_demand=5,
    coordination_demand=18,impact=1,supervision_demand=14,
    base_overall_difficulty=greatest(24,5),
    legacy_scores=coalesce(legacy_scores,'{}'::JSONB)||jsonb_build_object(
      'candidateReassessment',migration_key,
      'projectionScope','light_elastic_band_feedback_representative_highest_complexity_variant',
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'variantScores',jsonb_build_object(
        'flatProne',jsonb_build_object('complexity',18,'physicalDifficulty',4,'overall',18),
        'lowerLegBolster',jsonb_build_object('complexity',20,'physicalDifficulty',3,'overall',20),
        'elasticBandFeedback',jsonb_build_object('complexity',24,'physicalDifficulty',5,'overall',24)),
      'exerciseScoresDescribeTaskOnly',TRUE,'sourceSelectable',TRUE,
      'independentCalibrationRequired',TRUE,'humanReviewRequired',TRUE,
      'approvalsCreated',FALSE),
    migration_confidence=68,human_review_status='queued',
    reviewed_by=NULL,reviewed_at=NULL,
    review_notes='Research-informed candidate reassessment only. Scores describe exercise complexity and physical difficulty, not athlete proficiency. Exact support feedback equipment breath cycle symptoms and independent calibration remain required.',
    updated_at=now()
  WHERE exercise_id=22;

  UPDATE coaching.exercise_difficulty_profile SET
    technical=2.4,complexity=2.4,load=1.0,overall=2.4,
    recommended_age_min=NULL,recommended_age_max=NULL,
    attention_demand='low',
    notes='Candidate exercise complexity and physical difficulty projected from the exact light elastic-band feedback Crocodile variant, the highest-complexity current variant. The legacy 1-10 load field is floor-bounded at 1.0; canonical physical difficulty remains 5/100. This is not an athlete proficiency or age classification.',
    source='canonical_research_candidate',updated_at=now()
  WHERE exercise_id=22;

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  VALUES(canonical_definition,1,2,'2.0.0',migration_key,'quarantined',
    jsonb_build_object(
      'identity',jsonb_build_object('passed',TRUE,'identityKey','prone_crocodile_breath_cycle','legacySources',1,'activeWorkingSpecifications',3,'archivedSourceSkeleton',TRUE,'skillLibraryBoundaryExplicit',TRUE),
      'taxonomy',jsonb_build_object('passed',TRUE,'controlledTerms',TRUE,'movementPatterns',jsonb_build_array('breath','brace'),'equipment',jsonb_build_array('mat','bolster','bands')),
      'anatomy',jsonb_build_object('passed',TRUE,'musclesJointsActionsPlanesLateralityAndContacts',TRUE),
      'difficulty',jsonb_build_object('passed',TRUE,'model','max_exercise_complexity_physical_difficulty','variantVectors',jsonb_build_array('18/4/18','20/3/20','24/5/24'),'athleteClassificationAbsent',TRUE,'independentCalibrationRequired',TRUE),
      'loadFatigueRecovery',jsonb_build_object('passed',TRUE,'breathCyclesAndProneTimeTracked',TRUE,'validInvalidPartialAssistedAndSymptomLimitedCyclesCounted',TRUE,'feedbackAndContactExposureTracked',TRUE,'recoveryIsPlanningEstimate',TRUE),
      'constraints',jsonb_build_object('passed',TRUE,'surfaceFloorTransferFaceSupportEquipmentConsentPrivacySymptomsAndExit',TRUE),
      'delivery',jsonb_build_object('passed',TRUE,'profiles',6,'prepareAndAccessAndRestoreOnly',TRUE,'durationDoseRestStationAndSubstitutionRevalidation',TRUE),
      'instructions',jsonb_build_object('passed',TRUE,'athleteCoachSupport',TRUE,'supportFeedbackCycleStopConsentIncidentAndExit',TRUE),
      'research',jsonb_build_object('passed',TRUE,'sections',16,'registryVersion',research_version,'exactInstructionAndAdjacentResearchLimitsExplicit',TRUE),
      'media',jsonb_build_object('passed',FALSE,'candidateCount',5,'currentOEmbedMetadataHealthy',TRUE,'playbackReviewed',FALSE,'exactMatchReviewed',FALSE,'captionsReviewed',FALSE,'accessibilityReviewed',FALSE,'qualityAndSafetyReviewed',FALSE,'approvalCreated',FALSE),
      'relationships',jsonb_build_object('passed',FALSE,'reviewOnly',8,'approved',0),
      'calibration',jsonb_build_object('passed',FALSE,'reviewOnly',6,'approved',0),
      'alternates',jsonb_build_object('passed',TRUE,'assessments',20,'newIdentityBoundaries',6,'preexistingBreathingFamilyBoundaries',3,'identityBoundariesExplicit',TRUE),
      'generationSupport',jsonb_build_object('passed',TRUE,'selectionConstraints',TRUE,'cumulativeBudgets',TRUE,'duration',TRUE,'equipmentAndStation',TRUE,'substitutionRevalidation',TRUE,'renderingAndPersistence',TRUE),
      'publication',jsonb_build_object('passed',FALSE,'reviewer',NULL,'approver',NULL)),
    jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01','message','A qualified human must watch every candidate in full and verify current playback, exact definition and variant, prone support, face clearance, feedback equipment, breath action, absence of conflicting forced or moving content, captions, accessibility, cue quality, safety, reviewer identity, timestamp, card version, and approval rationale.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','A qualified coach must approve or reject every equipment-equivalent and lateral-substitution proposal; no automatic transfer among prone, bolster, band, hooklying, 90/90, timed-hold, loaded, moving, or clinical breathing protocols is authorized.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','An independent qualified reviewer must calibrate exercise complexity and physical difficulty for all three exact variants. These scores do not classify an athlete or create an age or skill level.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','A qualified reviewer and separate approver must complete content review before publication. Every identity, support, feedback, touch, equipment, breath-cycle, dose, stop, accessibility, and support rule remains quarantined.')),
    TRUE,now())
  ON CONFLICT(definition_id) DO UPDATE SET
    facility_id=EXCLUDED.facility_id,card_version=EXCLUDED.card_version,
    schema_version=EXCLUDED.schema_version,audit_version=EXCLUDED.audit_version,
    status='quarantined',checks_json=EXCLUDED.checks_json,
    blocking_issues_json=EXCLUDED.blocking_issues_json,
    human_review_required=TRUE,checked_at=now();

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=22 AND definition_id=canonical_definition
        AND provenance_json->>'sourceDisposition'='canonical_exact_reauthored'
        AND provenance_json->>'representedBySelectableSourceVariant'='false')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source_variant AND status='archived'
        AND requirements_json->>'representation'='superseded_source_skeleton')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition AND status='review' AND card_version=2
        AND schema_version='2.0.0' AND approved_video_url IS NULL
        AND reviewed_by IS NULL AND approved_by IS NULL AND last_reviewed_at IS NULL
        AND movement_patterns<>'{}'::TEXT[] AND body_regions<>'{}'::TEXT[]
        AND anatomy_json<>'{}'::JSONB AND environment_json<>'{}'::JSONB
        AND population_json<>'{}'::JSONB AND athlete_support_json<>'{}'::JSONB
        AND coach_support_json<>'{}'::JSONB AND support_operations_json<>'{}'::JSONB
        AND provenance_json->>'canonicalAuthoredFromResearch'='true'
        AND provenance_json->>'approvalsCreated'='false') THEN
    RAISE EXCEPTION '% found invalid source replacement, definition, or research lineage',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(active_variant_ids) AND definition_id=canonical_definition
        AND status='review' AND requirements_json->>'selectable'='true'
        AND (difficulty_json->>'technicalComplexity')::INTEGER BETWEEN 1 AND 100
        AND (difficulty_json->>'absoluteLoadDemand')::INTEGER BETWEEN 1 AND 100
        AND (difficulty_json->>'physicalDifficulty')::INTEGER=
          (difficulty_json->>'absoluteLoadDemand')::INTEGER
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=greatest(
          (difficulty_json->>'technicalComplexity')::INTEGER,
          (difficulty_json->>'physicalDifficulty')::INTEGER)
        AND difficulty_json->>'technicalMeaning'='exercise_complexity'
        AND difficulty_json->>'loadMeaning'='physical_difficulty'
        AND load_profile_json->>'impactClass'='none'
        AND (load_profile_json->>'breathCyclesPerRep')::INTEGER=1
        AND programming_profile_json->>'publicationQuarantined'='true')<>3
    OR EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=ANY(active_variant_ids)
        AND (difficulty_json::TEXT ~* 'athlete.{0,20}(skill|level|proficien|age)'
          OR requirements_json::TEXT ~* 'minimum.{0,20}(skill|level|age)'
          OR programming_profile_json::TEXT ~* 'athlete.{0,20}(skill|level|proficien|age)')) THEN
    RAISE EXCEPTION '% found invalid active variants, score model, or athlete classification',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=ANY(active_variant_ids) AND status='review'
        AND cardinality(equipment_required)>0
        AND coalesce(time_model_json->>'durationFormula','')<>''
        AND dose_scaling_json<>'{}'::JSONB AND measurement_json<>'{}'::JSONB
        AND support_prompts_json<>'{}'::JSONB
        AND length(coach_instructions)>=100
        AND length(athlete_instructions) BETWEEN 10 AND 420
        AND cardinality(stop_rules)>=8)<>6
    OR (SELECT count(DISTINCT section_key)
        FROM coaching.exercise_section_evidence_v1
        WHERE definition_id=canonical_definition AND reviewed_card_version=2
          AND review_status='candidate' AND reviewer_user_id IS NULL)<>16
    OR (SELECT count(*) FROM coaching.exercise_media_candidate_v1
        WHERE definition_id=canonical_definition AND reviewed_card_version=2
          AND link_status='healthy' AND review_status='candidate'
          AND embedding_allowed AND captions_available IS NULL
          AND exact_variant_match IS NULL AND demonstration_quality_score IS NULL
          AND reviewer_user_id IS NULL AND reviewed_at IS NULL)<>5
    OR (SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
        WHERE definition_id=canonical_definition AND reviewed_card_version=2
          AND review_status='candidate' AND reviewer_user_id IS NULL)<>20 THEN
    RAISE EXCEPTION '% found incomplete profiles, evidence, media, or alternate assessments',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE conditions_json->>'migration'=migration_key
        AND (from_variant_id=ANY(active_variant_ids)
          OR to_variant_id=ANY(active_variant_ids))
        AND review_status='review' AND reviewed_by IS NULL)<>8
    OR (SELECT count(*) FROM coaching.exercise_score_calibration_v1
        WHERE variant_id=ANY(active_variant_ids) AND status='review'
          AND version=1 AND reviewed_by IS NULL)<>6
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
        WHERE survivor_definition_id=canonical_definition
          AND evidence_json->>'migration'=migration_key
          AND decision='distinct_exercises' AND reviewed_by IS NULL)<>6 THEN
    RAISE EXCEPTION '% found incomplete review-only graph, calibration, or identity boundaries',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(definition.movement_patterns) pattern_key
      WHERE definition.id=canonical_definition AND NOT EXISTS(
        SELECT 1 FROM coaching.movement_pattern allowed
        WHERE allowed.key=pattern_key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(definition.body_regions) region_key
      WHERE definition.id=canonical_definition AND NOT EXISTS(
        SELECT 1 FROM coaching.body_region allowed WHERE allowed.key=region_key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(definition.required_equipment||definition.optional_equipment) equipment_key
      WHERE definition.id=canonical_definition AND NOT EXISTS(
        SELECT 1 FROM coaching.equipment allowed WHERE allowed.key=equipment_key)) THEN
    RAISE EXCEPTION '% created uncontrolled definition taxonomy',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise
      WHERE id=22 AND (skill_level IS NOT NULL OR age_min IS NOT NULL
        OR age_max IS NOT NULL OR linked_skill_id IS NOT NULL
        OR is_published OR why_publish_ready OR archived))
    OR EXISTS(SELECT 1 FROM coaching.exercise_safety_profile
      WHERE exercise_id=22
        AND (minimum_skill_level IS NOT NULL
          OR minimum_age_recommended IS NOT NULL))
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1
      WHERE exercise_id=22 AND technical_complexity=24
        AND absolute_load_demand=5 AND base_overall_difficulty=24
        AND impact=1 AND human_review_status='queued'
        AND reviewed_by IS NULL AND reviewed_at IS NULL)
    OR EXISTS(SELECT 1 FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=canonical_definition AND reviewed_card_version=2
        AND (review_status<>'candidate' OR reviewer_user_id IS NOT NULL
          OR reviewed_at IS NOT NULL OR captions_available IS NOT NULL
          OR exact_variant_match IS NOT NULL
          OR demonstration_quality_score IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=ANY(active_variant_ids)
          OR to_variant_id=ANY(active_variant_ids))
        AND (review_status='approved' OR reviewed_by IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(active_variant_ids)
        AND (status='approved' OR reviewed_by IS NOT NULL))
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=canonical_definition AND card_version=2
        AND status='quarantined' AND human_review_required
        AND jsonb_array_length(blocking_issues_json)=4) THEN
    RAISE EXCEPTION '% retained or fabricated level, approval, media, or publication state',migration_key;
  END IF;
END;
$$;
