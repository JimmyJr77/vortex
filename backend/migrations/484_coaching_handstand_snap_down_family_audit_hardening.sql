-- Replace the mixed Round-Off Snap-Down Shape Drill baseline with an exact
-- inverted-start Handstand Snap-Down to Feet-Together Stick family. Full
-- Round-Offs, rebounds, connected tumbling, standing snap-downs, and static
-- handstands remain separate actions. Media, graph, calibration, content, and
-- publication decisions remain review-only. Exercise difficulty describes
-- complexity and physical difficulty only, never athlete proficiency.

DO $$
DECLARE
  migration_key CONSTANT TEXT := '484_coaching_handstand_snap_down_family_audit_hardening';
  research_version CONSTANT TEXT := '2026-08-02.86';
  canonical_definition CONSTANT UUID := '60f5b21a-991c-4ce8-9068-3c42b2043021';
  source_variant CONSTANT UUID := '064e650c-28e8-4820-b0da-7043bb509c2c';
  wall_variant CONSTANT UUID := '68c16da0-414f-4932-97f4-1d8b236af8dd';
  independent_variant CONSTANT UUID := '68a0499b-34b0-4621-b798-b49ffd8ed1a1';
  active_variant_ids CONSTANT UUID[] := ARRAY[wall_variant,independent_variant];
  roundoff_rebound_definition CONSTANT UUID := '607219c8-5da7-46e2-841a-5f5ab9a7a592';
  power_hurdle_definition CONSTANT UUID := '807c7a91-e022-4631-886d-b4d9a04ee091';
  cartwheel_definition CONSTANT UUID := '847bebc6-1eb0-4a61-835d-56ea156b4fca';
  freestanding_handstand_definition CONSTANT UUID := '74ff4c17-2a19-4ae4-8f0b-320eac87c3f3';
  wall_handstand_definition CONSTANT UUID := '8f4d89bd-8c34-45b0-bc79-12b7f0d29b9f';
  handstand_kickup_definition CONSTANT UUID := '2e89b7eb-19f8-42cb-9608-8227b070bccf';
  standing_snapdown_definition CONSTANT UUID := 'b080c83a-b2c2-42a8-a62c-fe4f0df42980';
  donkey_kick_definition CONSTANT UUID := '4f36930b-a3db-429d-9c65-21dab2760527';
  cartwheel_variant CONSTANT UUID := 'db4013cd-9047-498b-be80-48e89e1c285f';
  freestanding_handstand_variant CONSTANT UUID := '69f6f7a0-93eb-4cc8-b072-520aa991c720';
  back_to_wall_handstand_variant CONSTANT UUID := 'bf745356-095d-43a1-8a42-8157069edffb';
  protected_count INTEGER;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition AND status<>'archived')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=18 AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source_variant AND definition_id=canonical_definition)
    OR (SELECT count(*) FROM coaching.exercise_definition_v1
        WHERE id IN(roundoff_rebound_definition,power_hurdle_definition,
          cartwheel_definition,freestanding_handstand_definition,
          wall_handstand_definition,handstand_kickup_definition,
          standing_snapdown_definition,donkey_kick_definition)
          AND status<>'archived')<>8 THEN
    RAISE EXCEPTION '% prerequisite source lineage or identity neighbors drifted',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE slug='handstand-snap-down-feet-together-stick'
        AND id<>canonical_definition)
    OR EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=ANY(active_variant_ids) AND definition_id<>canonical_definition)
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
        WHERE id IN(cartwheel_variant,freestanding_handstand_variant,
          back_to_wall_handstand_variant) AND status<>'archived')<>3 THEN
    RAISE EXCEPTION '% working slug, variant UUIDs, or relationship anchors are already owned',migration_key;
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
      WHERE exercise_id=18
        AND (human_review_status<>'queued' OR reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL)
  ) protected;
  IF protected_count<>0 THEN
    RAISE EXCEPTION '% refuses to replace % human-reviewed records',migration_key,protected_count;
  END IF;

  UPDATE coaching.exercise_section_evidence_v1
  SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now()
  WHERE definition_id=canonical_definition
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_media_candidate_v1
  SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
      exact_variant_match=NULL,demonstration_quality_score=NULL,updated_at=now()
  WHERE definition_id=canonical_definition
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_alternate_assessment_v1
  SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now()
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
        'sourceDisposition','identity_quarantine',
        'representedBySelectableSourceVariant',FALSE,
        'sourceInterpretation','source mixes handstand wall-handstand and cartwheel-like entries and does not declare wall orientation support assistance hand order turn rebound landing depth or complete repetition boundary',
        'exactWorkingSpecificationRequired',TRUE,
        'skillLibraryBoundary','full Round-Off performance and levels remain in coaching.skill; this exercise stores only complexity and physical difficulty',
        'researchSources',jsonb_build_array(
          'https://static.usagym.org/PDFs/Women/development/compulsory/replacement_070125_mini.pdf',
          'https://is.muni.cz/do/fsps/e-learning/safe_gymnastics_4all/pages_en/floor_17_roundoff.html',
          'https://www.gymbc.org/media/o4opcs3u/gbc-canjump-manual-1.pdf'),
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=18;

  UPDATE coaching.exercise_delivery_profile_v1 SET status='archived',updated_at=now()
  WHERE variant_id=source_variant;
  UPDATE coaching.exercise_variant_v1 SET
    variant_key='identity-quarantine-source-18',
    display_name='Round-Off Snap-Down Shape Drill Identity Quarantine — Source 18',
    modifier_keys='{}'::TEXT[],difficulty_json='{}'::JSONB,status='archived',
    requirements_json=jsonb_build_object(
      'selectable',FALSE,'representation','identity_quarantine',
      'sourceLegacyExerciseId',18,
      'archiveReason','mixed_handstand_wall_handstand_and_cartwheel_entry_with_undefined_endpoint',
      'humanReviewRequired',TRUE),
    load_profile_json=jsonb_build_object('selectable',FALSE),
    fatigue_profile_json=jsonb_build_object('selectable',FALSE),
    programming_profile_json=jsonb_build_object(
      'selectionStatus','identity_quarantine','selectable',FALSE,
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
    canonical_definition,1,18,'handstand-snap-down-feet-together-stick',
    'Handstand Snap-Down to Feet-Together Stick',
    'Handstand Snap-Down to Feet-Together Stick',
    ARRAY['Handstand Snap Down','Handstand Snap-Down Drill','Handstand Snapdown Drill','Round-Off Snap-Down Shape Drill','Round Off Snap Down Shape Drill'],
    'Begin from the exact declared inverted hand-support start with both hands fixed, arms straight, and legs together. Push tall through the shoulders while the straight joined legs snap downward and the torso rises; release the hands, contact both feet simultaneously on the declared mat, and finish in an upright hollow feet-together stick with arms by the ears and no rebound, extra step, fall, turn, or connection.',
    'inverted_handstand_snap_down_to_bilateral_stick','2.0.0',2,'review',
    84,64,56,
    ARRAY['invert','push','brace','rotate','land']::TEXT[],
    ARRAY['full_body','hand','wrist','elbow','shoulder','scapula','neck','spine','rib_cage','core','pelvis','hip','knee','ankle','foot']::TEXT[],
    ARRAY['spring_floor','mat']::TEXT[],ARRAY['wall','panel_mat']::TEXT[],
    jsonb_build_object(
      'surface','inspected gymnastics spring floor with secured landing and bailout matting; surface stiffness and seams are declared',
      'wall','wall variant requires an inspected clear rigid wall with a declared heel-contact zone and no projections',
      'clearance','full inverted body hand-support fall and feet-together landing envelope plus a controlled forward or side bailout lane remains clear',
      'stationCapacity',1,'coachSightline','side or front-quarter view of hands elbows shoulders trunk hips joined legs wall contact hand release foot contact and finish',
      'inspection',jsonb_build_array('floor and mat seams friction and movement','wall integrity and heel zone when selected','overhead and lateral clearance','coach and emergency access'),
      'changeRule','Start support wall orientation assistance surface landing target rebound policy dose and exit must be selected recorded and revalidated.'),
    jsonb_build_object(
      'exerciseCardDoesNotClassifyAthletes',TRUE,'readinessIsWorkoutInput',TRUE,
      'readinessFacts',jsonb_build_array('exact inverted start can be established under the selected support contract','straight-arm hand support and feet-together landing are symptom free','athlete understands stop bailout stick and no-rebound rules','qualified coach can observe the full attempt and control station access'),
      'excludeOrReferPerFacilityPolicy',jsonb_build_array('pain numbness tingling weakness dizziness faintness vision change nausea panic or unusual exertional symptoms','unresolved restriction requiring clinical or organizational clearance','unsafe floor mat wall clearance supervision or bailout conditions'),
      'noUniversalEligibilityAgeOrReadinessThresholdClaimed',TRUE),
    jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'canonicalAuthoredFromResearch',TRUE,
      'primaryIdentitySource','https://static.usagym.org/PDFs/Women/development/compulsory/replacement_070125_mini.pdf',
      'legacySources',jsonb_build_array(18),
      'identityContract','declared_inverted_hand_support_start_then_bilateral_snap_down_to_upright_hollow_feet_together_stick_without_rebound',
      'skillLibraryBoundary','Round-Off performance levels and connected tumbling classifications belong only to skill-library cards',
      'researchSources',jsonb_build_array(
        'https://static.usagym.org/PDFs/Women/development/compulsory/replacement_070125_mini.pdf',
        'https://is.muni.cz/do/fsps/e-learning/safe_gymnastics_4all/pages_en/floor_17_roundoff.html',
        'https://www.gymbc.org/media/o4opcs3u/gbc-canjump-manual-1.pdf',
        'https://pubmed.ncbi.nlm.nih.gov/29343188/',
        'https://doi.org/10.1080/14763141.2021.1876755',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC11235812/',
        'https://pubmed.ncbi.nlm.nih.gov/41473027/',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC12088353/',
        'https://special-olympics.be/wp-content/uploads/2022/08/specialolympics_artisticgymnastics.pdf'),
      'confidenceBySection',jsonb_build_object('identity',90,'taxonomy',88,'anatomy',76,'difficulty',64,'load',64,'fatigueRecovery',54,'constraints',80,'dosage',48,'instructions',82,'alternates',90,'media',56),
      'unresolvedClaims',jsonb_build_array('one universal ideal handstand snap-down shape timing or assistance method','individual hand wrist elbow shoulder spine and landing loads','universal eligibility dose weekly exposure recovery or safety threshold','numeric difficulty calibration','media playback exactness captions accessibility quality and safety'),
      'externalPlaybackVerificationPerformed',FALSE,'sourceLimitationsExplicit',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,'publicationQuarantined',TRUE),
    NULL,NULL,NULL,NULL,
    jsonb_build_object(
      'primaryMuscles',jsonb_build_array('serratus anterior and trapezius','deltoids','triceps brachii','abdominal wall','hip flexors','quadriceps and plantar flexors during landing'),
      'secondaryMuscles',jsonb_build_array('rotator cuff','pectoralis major','latissimus dorsi','forearm and hand musculature','spinal extensors','gluteal muscles','hamstrings'),
      'stabilizers',jsonb_build_array('wrist and elbow stabilizers','scapular stabilizers','deep trunk stabilizers','hip abductors and adductors','knee ankle and foot stabilizers'),
      'joints',jsonb_build_array('fingers and hands','wrists','radioulnar joints','elbows','glenohumeral joints','scapulothoracic articulations','cervical thoracic and lumbar spine','pelvis','hips','knees','ankles','feet'),
      'jointActions',jsonb_build_array('loaded wrist extension with fixed hand support','isometric elbow extension until hand release','scapular elevation protraction and upward-rotation control','shoulder flexion support followed by rapid upper-limb push and release','trunk flexion or hollow-shape organization','bilateral hip flexion as joined legs snap downward','hip knee and ankle flexion to absorb simultaneous foot contact','controlled extension to upright hollow stick'),
      'planes',jsonb_build_array('sagittal primary','frontal stabilization','transverse stabilization'),
      'laterality','bilateral symmetrical hand support and simultaneous bilateral foot contact; no Round-Off lead side or longitudinal turn is scored',
      'evidenceBoundary','Exact muscle timing and joint loads vary with start support wall contact assistance surface anthropometry speed and landing; no source quantifies this card for every athlete.'),
    jsonb_build_object(
      'whyItMatters','Separates the inverted push and fast joined-leg snap-down from a full Round-Off or rebound so the generator can dose and observe one exact action.',
      'primaryCue','Push tall, keep your legs together, snap both feet to the mat, and freeze upright with arms by your ears.',
      'expectedSensations',jsonb_build_array('firm hand support','shoulder and trunk tension','fast joined-leg movement','simultaneous controlled foot contact'),
      'unexpectedSensations',jsonb_build_array('sharp pressure or pain','numbness tingling weakness dizziness nausea or vision change','head neck trunk or unplanned wall contact','uncontrolled heavy landing or inability to stop'),
      'painGuidance','Stop immediately, use the declared bailout if possible, tell the coach exactly what occurred, and follow facility escalation policy; never repeat to test pain.',
      'selfChecks',jsonb_build_array('assigned start support and wall policy','legs remain together','both feet contact together','no rebound or extra step','breathing and symptoms remain normal'),
      'accessibility',jsonb_build_array('plain-language cue and visual start/landing marks','coach demonstration or nonmovement walkthrough','wall-supported exact variant only when selected and reviewed'),
      'mediaAlternatives',jsonb_build_array('written action sequence','coach demonstration','still-frame start support hand-release foot-contact and finish checklist'),
      'notReadinessOrSkillClassification',TRUE),
    jsonb_build_object(
      'observationChecklist',jsonb_build_array('exact start support and assistance','hands elbows shoulders and head','joined legs and snap timing','wall release if selected','hand release','simultaneous feet','upright hollow stick','first fault symptoms and actual exposure'),
      'faultCorrections',jsonb_build_object(
        'elbow_or_shoulder_collapse','stop the attempt; reduce exposure or change only to a separately reviewed exact support variant',
        'legs_separate_or_land_asynchronously','end the repetition and record invalid; do not add speed or connection',
        'pike_or_chest_down_finish','return to the exact selected start and lower dose; never convert the finish into a rebound',
        'wall_contact_changes','invalidate and reselect the variant before another attempt'),
      'demonstrationPlan','Show the exact start, wall or no-wall contract, tall shoulder push, joined-leg path, hand release, simultaneous feet-together contact, upright hollow stick, invalid examples, stop cue, and bailout without implying approval.',
      'groupManagement',jsonb_build_array('one athlete per complete fall and landing lane','coach controls entry and release to the station','next athlete waits outside the clearance envelope','record every valid invalid assisted partial and incident attempt'),
      'modificationDecisionTree',jsonb_build_array('stop for symptoms or unsafe environment','reduce repetitions or increase rest first','change wall support or assistance only by selecting an exact reviewed variant','change rebound entry turn surface or finish only as a new identity or separately reviewed variant'),
      'doNotUseWhen',jsonb_build_array('the exact start cannot be established safely','wall floor mats clearance or supervision fail inspection','the athlete cannot respond to stop or use the planned bailout','shared hand-support inversion or landing budget is already reached'),
      'skillTransferNotAssumed',TRUE),
    jsonb_build_object(
      'issueCategories',jsonb_build_array('identity or variant mismatch','surface wall or clearance defect','symptom or incident','instruction or rendering conflict','dose duration or contact-count mismatch','media or accessibility issue','skill-link or transfer claim'),
      'supportEscalation',jsonb_build_object('urgent','stop secure the lane and follow emergency policy for acute symptoms fall head or neck contact or inability to exit','clinical','refer symptom and return decisions per facility policy','content','quarantine conflicting identity dose media or instruction until qualified review'),
      'retentionPolicy','Persist exact variant start support wall contact assistance planned and actual dose valid invalid partial and incident attempts hand and foot contacts first fault symptoms duration substitution and reviewer lineage under facility policy.',
      'changeImpactPolicy','Any change to identity start support wall assistance action rebound finish surface dose media skill link or stop rule invalidates cached selection duration rendering and substitution results and requires complete revalidation.',
      'feedbackChannels',jsonb_build_array('athlete symptom and clarity report','coach first-fault and station report','support issue and incident queue'),
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
      'technicalComplexity',v.complexity,'absoluteLoadDemand',v.physical,
      'physicalDifficulty',v.physical,'baseOverallDifficulty',greatest(v.complexity,v.physical),
      'coordinationDemand',v.coordination,'impact',v.impact,
      'supervisionDemand',v.supervision,'failureConsequence',v.failure,
      'workCapacityDemand',v.work_capacity,'relativeStrengthDemand',v.relative_strength,
      'mobilityDemand',v.mobility,'balanceDemand',v.balance,'stabilityDemand',v.stability,
      'speedDemand',v.speed,'decisionDemand',v.decision_demand,
      'inversionDemand',v.inversion,'fearExposure',v.fear,
      'complexityDimensions',jsonb_build_object('invertedStart',v.complexity-4,'handSupport',v.complexity-8,'wholeBodyTiming',v.complexity,'terminalPrecision',v.complexity-4,'errorDetection',v.complexity-6),
      'physicalDimensions',jsonb_build_object('relativeSupportStrength',v.relative_strength,'upperExtremityLoad',v.physical,'snapSpeed',v.speed,'landingControl',v.physical-6),
      'technicalMeaning','exercise_complexity','loadMeaning','physical_difficulty',
      'overallFormula','max_exercise_complexity_physical_difficulty',
      'candidateIndependentCalibrationRequired',TRUE),
    jsonb_build_object(
      'selectable',TRUE,'representation','exact_working_specification',
      'startPosition',v.start_position,'wallContact',v.wall_contact,
      'supportContract','both hands fixed on declared spring floor or secured mat hands inside marked zone arms straight and shoulders elevated before scored action begins',
      'actionContract','push tall as joined straight legs snap downward and torso rises; hands release before feet contact',
      'footContract','both feet contact the declared landing zone simultaneously and remain together',
      'terminalContract','upright hollow feet-together stick arms by ears for declared valid hold; no rebound extra step fall turn or connection',
      'assistanceContract','qualified coach controls entry and station; any physical assistance during the scored snap-down is recorded and invalidates independent execution',
      'repetitionBoundary','valid inverted start established; snap-down begins at first intentional shoulder or leg action; ends after simultaneous feet and declared stable stick',
      'invalidatingEvents',jsonb_build_array('wrong or unstable start support','unexpected wall or coach contact','hand slide regrasp elbow collapse or head neck trunk contact','legs separate bend or turn','hands remain when feet contact','asynchronous or missed foot contact','rebound extra step fall connection or uncontrolled exit','symptom stop or coach rescue'),
      'equipmentRequired',v.equipment_required,'identityQuarantine',FALSE,
      'workingSpecificationRequiresHumanReview',TRUE),
    'review',
    jsonb_build_object(
      'externalLoadMethod','dynamic_bodyweight_inverted_hand_support_to_bilateral_foot_landing',
      'supportLoad','bodyweight and segment inertia pass through two hands before transfer to two simultaneous feet; exact distribution is not assumed',
      'wallLoadShare','not quantified; wall contact is a binary exact constraint rather than a load estimate',
      'gripDemand',v.grip,'spinalLoading',v.spinal_loading,
      'eccentricStress',v.eccentric,'landingContactsPerRep',2,
      'handContactsPerRep',2,'plannedImpactContacts',4,
      'wallContactsPerRep',v.wall_contacts,
      'impactClass','moderate_inverted_support_and_bilateral_landing_candidate',
      'dominantContraction','dynamic_hand_support_push_rapid_hip_and_trunk_reorganization_then_landing_absorption',
      'effectiveLoadDrivers',jsonb_build_array('body mass and anthropometry','start support and wall contact','surface stiffness','snap speed','hand release timing','landing depth','assistance','repetition count','prior hand-support inversion and landing fatigue'),
      'loadTracking',jsonb_build_array('two hand and two foot contacts per completed repetition','wall contacts','valid invalid partial assisted and incident attempts','unplanned body contacts or bailout','same-session handstand cartwheel roundoff back-handspring tumbling jumping and landing exposure')),
    jsonb_build_object(
      'localMuscleFatigue',v.local_fatigue,'gripFatigue',v.grip_fatigue,
      'technicalFatigueSensitivity',v.technical_fatigue,
      'impactAccumulation',v.impact,'recoveryHours',v.recovery_hours,
      'recoveryWindow','candidate planning estimate only; adjust for novelty volume surface symptoms and adjacent hand-support inversion tumbling jumping or landing exposure',
      'primaryFatigueSites',jsonb_build_array('hands and forearms','wrists elbows and shoulders','trunk and hip flexors','knees ankles and feet'),
      'earlyFatigueSignals',jsonb_build_array('shoulder or elbow softening','late or asymmetric hand release','leg separation bend or slow snap','heavy asynchronous landing','chest-down finish extra step or delayed stop response'),
      'downstreamConflicts',jsonb_build_array('priority handstand roundoff back-handspring or tumbling work','high-volume wrist shoulder or inversion work','high-impact jumping landing or sprint work')),
    jsonb_build_object(
      'trainingStimuli',jsonb_build_array('inverted shoulder push timing','joined-leg snap speed','hand-to-foot support transition','simultaneous bilateral landing and upright hollow stick'),
      'stimulusDose',jsonb_build_object('primary','quality_terminated_valid_attempts','countInvalidPartialAssistedAndIncidentAttemptsAndEveryContactAsExposure',TRUE,'fatigueCeiling','low_for_technical_learning'),
      'weeklyExposure','Combine every valid invalid partial assisted and incident attempt plus hand foot wall and unplanned contacts with Handstand Cartwheel Round-Off Back Handspring tumbling jumping and landing work.',
      'prerequisites',jsonb_build_array('exact inverted start and bailout can be established under qualified supervision','symptom-free straight-arm hand support and bilateral landing','surface wall if selected and complete clearance pass inspection','athlete understands stick no-rebound and stop rules'),
      'completionCriteria',jsonb_build_array('exact selected start support','tall shoulder push with joined legs','hands release before simultaneous feet','upright hollow feet-together stick','no symptom unplanned contact rebound extra step or fall','complete exposure record'),
      'sequenceRules',jsonb_build_array('use after wrist shoulder trunk hip ankle and landing preparation','place before fatiguing hand support tumbling or impact work','do not use as a race conditioning circuit or unplanned connection','stop before hand support snap speed contact or finish changes'),
      'pairingCompatibility',jsonb_build_array('low-demand mobility after recovery','noncompeting visualization or instruction','technical work without shared wrist shoulder inversion trunk or landing fatigue'),
      'interferenceRules',jsonb_build_array('do not pre-fatigue upper extremity support trunk hip flexors or landing tissues','do not pair with cross-traffic or uncontrolled impact','revalidate after any start support wall assistance surface rebound finish or dose change'),
      'uncertaintyPolicy','If start support wall contact assistance hand release foot contact rebound or finish is uncertain, do not select; quarantine the attempt and resolve the exact contract.',
      'selection',jsonb_build_object('phaseDefault','movement_intelligence','prepareAndAccessOnlyAtLowDose',TRUE,'readinessIsWorkoutInput',TRUE,'exerciseDifficultyDoesNotClassifyAthletes',TRUE),
      'publicationQuarantined',TRUE)
  FROM (VALUES
    (wall_variant,'back-to-wall-heel-contact-handstand-snap-down-stick','Back-to-Wall Handstand Snap-Down to Feet-Together Stick',ARRAY['back_to_wall','heel_contact','bilateral','no_rebound']::TEXT[],70,62,68,72,70,72,78,48,42,46,36,50,54,24,82,78,76,38,68,24,84,24,
      'back_to_wall_inverted_start_with_both_heels_lightly_on_declared_wall_zone','both_heels_contact_wall_until_intentional_simultaneous_release',2,ARRAY['spring_floor','mat','wall']::TEXT[]),
    (independent_variant,'independent-freestanding-handstand-snap-down-stick','Independent Handstand Snap-Down to Feet-Together Stick',ARRAY['freestanding','no_external_support','bilateral','no_rebound']::TEXT[],82,70,76,80,84,84,88,58,50,52,42,58,62,30,88,86,80,58,78,30,92,30,
      'freestanding_inverted_start_with_no_wall_spotter_apparatus_foot_head_forearm_or_partner_contact_after_start_is_declared','no_wall_contact_valid',0,ARRAY['spring_floor','mat']::TEXT[])
  ) v(id,variant_key,display_name,modifiers,complexity,physical,relative_strength,mobility,balance,stability,coordination,speed,decision_demand,work_capacity,impact,eccentric,spinal_loading,grip,supervision,failure,inversion,fear,local_fatigue,grip_fatigue,technical_fatigue,recovery_hours,start_position,wall_contact,wall_contacts,equipment_required)
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
  SELECT gen_random_uuid(),v.id,p.profile_key,p.phase_key,p.role,
    CASE p.phase_key WHEN 'prepare_and_access' THEN
      'Rehearse the exact inverted start, support, wall policy, joined-leg snap, simultaneous feet, stick, stop, and bailout at minimal exposure.'
    ELSE
      'Practice repeatable inverted shoulder push, joined-leg snap-down, hand release, simultaneous bilateral contact, and upright hollow stick while fresh.' END,
    CASE p.phase_key WHEN 'prepare_and_access' THEN v.mi_suitability-6 ELSE v.mi_suitability END,
    CASE p.phase_key WHEN 'prepare_and_access' THEN 86 ELSE 92 END,
    jsonb_build_object(
      'primaryObjective',CASE p.phase_key WHEN 'prepare_and_access' THEN 'exact_start_action_and_stop_rehearsal' ELSE 'inverted_snap_down_transition_learning_quality' END,
      'variant',v.variant_key,'validOnlyWhenExactVariantPasses',TRUE,
      'fatigueCeiling','low','notConditioningMaximumPowerOrSkillRanking',TRUE),
    jsonb_build_object(
      'sets',CASE p.phase_key WHEN 'prepare_and_access' THEN 1 ELSE v.mi_sets END,
      'repetitions',CASE p.phase_key WHEN 'prepare_and_access' THEN v.prepare_reps ELSE v.mi_reps END,
      'restSecondsMin',CASE p.phase_key WHEN 'prepare_and_access' THEN v.prepare_rest ELSE v.mi_rest END,
      'restSecondsMax',CASE p.phase_key WHEN 'prepare_and_access' THEN v.prepare_rest+45 ELSE v.mi_rest+60 END,
      'validRepetition','declared inverted start push and joined-leg snap hands release both feet together upright hollow stick without rebound',
      'countInvalidPartialAssistedIncidentAttemptsAsExposure',TRUE,
      'countTwoHandAndTwoFootContactsPerCompletedRepetition',TRUE,
      'effortCap','stop_before_support_snap_contact_or_finish_deteriorates',
      'doseAuthority','candidate_profile_pending_human_review'),
    'Exact start support, wall policy, straight arms, tall shoulders, joined legs, hand release before simultaneous feet, upright hollow stick, breathing, and no symptoms pass; the final valid repetition resembles the first.',
    ARRAY[
      'Sharp or increasing hand, wrist, elbow, shoulder, neck, spine, hip, knee, ankle, or foot pain.',
      'Numbness, tingling, weakness, vision change, dizziness, nausea, faintness, panic, unusual breathlessness, or inability to answer the stop cue.',
      'The spring floor, mat, wall, marker, timer, clearance zone, or emergency access becomes unsafe.',
      'The exact inverted start cannot be established or wall, coach, or apparatus contact differs from the selected variant.',
      'A hand slides or regrasps, an elbow or shoulder collapses, or the head, neck, trunk, knee, or another unplanned body part contacts support.',
      'The legs separate, bend materially, turn, or snap at different times.',
      'The hands remain loaded when the feet contact or the feet miss or contact asynchronously.',
      'The landing is heavy or uncontrolled, the chest stays down, or a rebound, connection, extra step, fall, or unplanned bailout occurs.',
      'The coach cannot directly observe every contact or another person enters the complete fall and landing lane.',
      'The planned attempt, hand-contact, foot-contact, inversion, tumbling, jumping, or landing budget is reached.'
    ]::TEXT[],
    'Verify exact card and variant, inverted start, wall and assistance contract, floor and mat security, clearance and bailout, current symptoms, prior hand-support/inversion/landing exposure, dose, rest, and stop signal. Observe and record every attempt and contact; revalidate the complete workout after any change.',
    'Use your assigned start. Push tall, squeeze your legs together, snap both feet to the mat, stand hollow with arms by your ears, and freeze. Stop at the first miss or symptom.',
    CASE p.phase_key WHEN 'prepare_and_access' THEN
      'Clearer start, support, wall, action, stick, stop, and bailout readiness with minimal fatigue.'
    ELSE
      'More repeatable shoulder push, joined-leg snap speed, hand release, simultaneous landing, and upright hollow stick under low fatigue.' END,
    v.equipment_required,
    jsonb_build_object(
      'stationType',v.station_type,'athletesPerStation',1,
      'setupSeconds',v.setup_seconds,'attemptSeconds',v.attempt_seconds,
      'resetSeconds',25,'transitionSeconds',20,'requiresDirectQualifiedObservation',TRUE,
      'requiresFullInversionFallAndLandingLane',TRUE,
      'surfaceAndWallInspectionBeforeEverySet',TRUE,
      'sharedLanePolicy','one athlete moves only after the previous athlete coach and all equipment clear the full envelope',
      'equipmentChangeInvalidatesCachedLogistics',TRUE),
    v.substitution_ids,'review',
    jsonb_build_object(
      'durationFormula','setup + sum(each observed entry attempt stick bailout and reset + inter-repetition rest) + set rest + transitions',
      'estimateSeconds',CASE p.phase_key WHEN 'prepare_and_access' THEN v.prepare_duration ELSE v.mi_duration END,
      'lowerBoundSeconds',CASE p.phase_key WHEN 'prepare_and_access' THEN v.prepare_duration-60 ELSE v.mi_duration-120 END,
      'upperBoundSeconds',CASE p.phase_key WHEN 'prepare_and_access' THEN v.prepare_duration+150 ELSE v.mi_duration+300 END,
      'includeInvalidPartialAssistedAndIncidentAttempts',TRUE,
      'includeEveryEntryBailoutAndEquipmentReset',TRUE,'recomputeAfterSubstitution',TRUE),
    jsonb_build_object(
      'regressionOrder',jsonb_build_array('reduce repetitions','increase rest','select exact wall-supported variant only after full revalidation','change drill only through reviewed graph'),
      'progressionOrder',jsonb_build_array('improve exact start and stick repeatability','increase repetitions within reviewed profile','select independent start only after full revalidation','transfer to a skill card only through coach review'),
      'neverScaleBy',jsonb_build_array('athlete proficiency label','unplanned assistance','unreviewed higher surface','adding rebound or connection','repetitions after support or landing deterioration'),
      'revalidateAllGenerationInputs',TRUE),
    jsonb_build_object(
      'planned',jsonb_build_array('variant','start support','wall and assistance','sets','repetitions','rest','surface and landing zone','supervision'),
      'actual',jsonb_build_array('valid invalid partial assisted and incident attempts','hand foot wall and unplanned contacts','first fault','symptoms','stick result','duration'),
      'cumulativeBudgets',jsonb_build_array('hand contacts','foot contacts','wall contacts','inverted support','handstand cartwheel roundoff back-handspring and tumbling attempts','jumping and landing exposure'),
      'persistenceRequired',TRUE,'coachAndAthleteRenderingRequired',TRUE),
    jsonb_build_object(
      'athletePrompt','Report symptoms fear uncertainty the first changed contact and whether both feet and the stick were simultaneous and controlled.',
      'coachPrompt','Record exact variant start support wall and assistance every contact first fault symptoms exposure substitution duration and recovery note.',
      'supportPrompt','Quarantine identity environment skill-link media instruction dose rendering or persistence mismatches; never convert them into approval.',
      'incidentPrompt','Stop, clear and secure the lane, assess immediate help needs, document exact contacts and symptoms, and follow facility policy.')
  FROM (VALUES
    (wall_variant,'back_to_wall_snap_down',ARRAY['spring_floor','mat','wall']::TEXT[],
      'inspected_back_to_wall_snap_down_lane',55,7,94,2,3,90,2,60,660,300,
      ARRAY[independent_variant]::UUID[]),
    (independent_variant,'freestanding_snap_down',ARRAY['spring_floor','mat']::TEXT[],
      'inspected_freestanding_snap_down_lane',45,7,90,2,2,120,1,90,720,330,
      ARRAY[wall_variant]::UUID[])
  ) v(id,variant_key,equipment_required,station_type,setup_seconds,attempt_seconds,mi_suitability,mi_sets,mi_reps,mi_rest,prepare_reps,prepare_rest,mi_duration,prepare_duration,substitution_ids)
  CROSS JOIN (VALUES
    ('prepare-and-access-rehearsal','prepare_and_access','secondary'),
    ('movement-intelligence-quality','movement_intelligence','primary')
  ) p(profile_key,phase_key,role)
  ON CONFLICT(variant_id,profile_key) DO UPDATE SET
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
      'leftContract','inverted_hand_support_start_joined_leg_snap_down_simultaneous_feet_upright_hollow_stick_no_rebound',
      'rightContract',b.right_contract,
      'researchSources',jsonb_build_array(
        'https://static.usagym.org/PDFs/Women/development/compulsory/replacement_070125_mini.pdf',
        'https://is.muni.cz/do/fsps/e-learning/safe_gymnastics_4all/pages_en/floor_17_roundoff.html'),
      'identityOnlyNeighborStillRequiresItsOwnAudit',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'deterministic_identity_equivalence',NULL,now()
  FROM (VALUES
    (roundoff_rebound_definition,'inverted_snap_down_vs_full_roundoff_rebound_or_stick','A full Round-Off adds an upright approach, jump or hurdle, side-leading hand sequence, longitudinal turn, feet-together arrival and possibly rebound or later stick.','approach_hurdle_side_leading_hand_contacts_longitudinal_turn_feet_together_rebound_or_stick'),
    (power_hurdle_definition,'inverted_start_vs_power_hurdle_entry','Power Hurdle to Cartwheel or Round-Off Entry scores the dynamic upright approach and arrival into hand support rather than the snap-down from an already established handstand.','upright_power_hurdle_entry_to_declared_hand_support'),
    (cartwheel_definition,'simultaneous_feet_snapdown_vs_sequential_cartwheel_finish','Cartwheel uses side rotation and sequential first-foot then second-foot finish; this snap-down uses no lead-side turn and requires simultaneous joined feet.','side_specific_hand_hand_foot_foot_sequence_to_opposite_lunge'),
    (freestanding_handstand_definition,'dynamic_snap_down_vs_static_freestanding_handstand','Freestanding Handstand Hold scores uninterrupted static inverted balance; this exercise starts there and scores a dynamic exit to feet.','static_unsupported_inverted_hold_with_timer'),
    (wall_handstand_definition,'dynamic_wall_release_vs_static_wall_handstand','Wall Handstand Hold requires continuing declared foot-wall contact for valid time; this wall variant intentionally releases that contact and snaps to feet.','static_wall_supported_inverted_hold_with_timer'),
    (handstand_kickup_definition,'established_inverted_start_vs_kickup_entry','Handstand Kick-Up scores the lunge, hand placement, leg kick, arrival and wall or spot reception; this repetition begins only after the inverted start is established.','lunge_and_kick_to_inverted_arrival'),
    (standing_snapdown_definition,'inverted_hand_support_snapdown_vs_standing_athletic_snapdown','Standing Snap-Down to Stick moves from tall stance into an athletic stance with no inversion, hand support, hand release or joined-leg flight-to-landing transfer.','standing_arm_snap_and_center_of_mass_lowering_to_athletic_stick'),
    (donkey_kick_definition,'handstand_snap_down_vs_donkey_kick','Donkey Kick begins from crouch or pike, hops both feet upward while hands remain supported, then returns feet; it does not begin in handstand and snap to an upright hollow stick.','crouch_or_pike_hand_support_double_foot_hop_and_return')
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
        'noUniversalTechniqueSafetyReadinessDoseRecoveryOutcomeTransferOrDifficultyClaim',TRUE)),
    e.evidence_quality,'candidate',NULL,NULL
  FROM (VALUES
    ('identity','https://static.usagym.org/PDFs/Women/development/compulsory/replacement_070125_mini.pdf','Women’s Development Program Compulsory Replacement Pages, July 2025','USA Gymnastics','governing_body','The current compulsory text defines Round-Off as a run and hurdle through vertical with simultaneous feet, and separately describes an inverted straight-body snap-down to both feet and rebound in a connected back handspring.','current_governing_body_action_and_endpoint_boundary','Competition text does not define this standalone drill, wall start, workout dose, or universal technique.',92),
    ('taxonomy','https://is.muni.cz/do/fsps/e-learning/safe_gymnastics_4all/pages_en/floor_17_roundoff.html','Safe Gymnastics 4all — Floor 17: Roundoff','Masaryk University Faculty of Sports Studies','professional_standard','A full Roundoff includes a jump, asymmetrical leg actions, hand placement, 90-degree turn through handstand, upper-limb push, joined legs, and feet-together landing.','academic_roundoff_technique_resource','It describes a full Roundoff and selected drills, not this exact no-turn handstand-start snap-down card.',84),
    ('anatomy','https://pubmed.ncbi.nlm.nih.gov/41473027/','Biomechanical analyses of the handstand: a systematic review','Sports Biomechanics','peer_reviewed_research','The review characterizes handstand balance as whole-body inverted upper-extremity support with wrist, elbow, shoulder, trunk, hip, and lower-limb coordination.','systematic_handstand_biomechanics_review','Static handstand studies do not quantify the dynamic snap-down or bilateral landing in this card.',92),
    ('biomechanics','https://pubmed.ncbi.nlm.nih.gov/29343188/','Technique selection in young female gymnasts: Elbow and wrist joint loading during the cartwheel and round-off','European Journal of Sport Science','peer_reviewed_research','Hand position changed upper-limb ground reaction and joint loading in successful Cartwheel and Round-Off trials.','young_female_gymnast_repeated_measures_study','Full side-leading skills are adjacent loading evidence and do not establish this no-turn drill mechanics or one universally safe hand position.',91),
    ('difficulty','https://doi.org/10.1080/14763141.2021.1876755','The effect of changes in fundamental skill complexity on upper limb loading and biomechanical characteristics of performance in female gymnastics','Sports Biomechanics','peer_reviewed_research','Upper-limb loading and mechanics varied across Cartwheel, Round-Off and Round-Off–Back Handspring complexity and hand-position conditions.','small_repeated_measures_skill_complexity_study','Ten female gymnasts and full skills do not calibrate Vortex scores or classify athlete proficiency.',89),
    ('load_fatigue_recovery','https://pmc.ncbi.nlm.nih.gov/articles/PMC11235812/','Upper and lower limb impact loading during artistic gymnastics foundation floor tumbling skills','European Journal of Sport Science','peer_reviewed_research','Foundation tumbling produces distinct upper- and lower-limb impact exposures that vary with skill and sequence.','instrumented_foundation_tumbling_study','Measured full skills and sequences do not establish this drill load, safe contact ceiling, recovery hours, or injury threshold.',90),
    ('constraints','https://pmc.ncbi.nlm.nih.gov/articles/PMC12088353/','Common upper extremity gymnastics injuries and gymnastic specific return to play protocols','Journal of the Pediatric Orthopaedic Society of North America','peer_reviewed_research','Gymnastics places repetitive weight-bearing demands on hands, wrists, elbows, and shoulders and requires task-specific return decisions.','young_gymnast_upper_extremity_review','The review does not authorize this drill, diagnose symptoms, or establish universal eligibility, spotting, or clearance rules.',90),
    ('dosage','https://pmc.ncbi.nlm.nih.gov/articles/PMC11235812/','Upper and lower limb impact loading during artistic gymnastics foundation floor tumbling skills','European Journal of Sport Science','peer_reviewed_research','Separate hand and foot contacts support explicit contact and cumulative-tumbling exposure accounting.','instrumented_foundation_tumbling_study','The study does not establish sets, repetitions, rest, frequency, or recovery for a Handstand Snap-Down.',90),
    ('instructions','https://static.usagym.org/PDFs/Women/development/compulsory/replacement_070125_mini.pdf','Women’s Development Program Compulsory Replacement Pages, July 2025','USA Gymnastics','governing_body','The text emphasizes straight or hollow inverted shape, explosive arm and shoulder push, joined legs, simultaneous feet, upright hollow arrival, and immediate rebound when rebound is part of the scored sequence.','current_governing_body_observable_action_description','The no-rebound stick in this card is a deliberate different endpoint and the source does not approve every cue.',92),
    ('safety_stop_rules','https://pmc.ncbi.nlm.nih.gov/articles/PMC12088353/','Common upper extremity gymnastics injuries and gymnastic specific return to play protocols','Journal of the Pediatric Orthopaedic Society of North America','peer_reviewed_research','The review supports explicit hand, wrist, elbow, shoulder, symptom, progressive loading, and return-to-gymnastics considerations.','young_gymnast_upper_extremity_review','It does not supply a universal snap-down stop threshold, emergency protocol, or hands-on spot.',90),
    ('programming','https://www.gymbc.org/media/o4opcs3u/gbc-canjump-manual-1.pdf','CanJump Gymnastics Foundations Trampoline Manual','Gymnastics Canada / Gymnastics BC','governing_body','The manual lists Handstand Snap-Down from a block to a separate scoop rebound and later Handstand Snap-Down directly into rebound, supporting drills as exact ordered actions.','governing_body_foundations_progression_context','Program placement and named sequences do not establish Vortex dose, readiness, or automatic progression.',82),
    ('athlete_support','https://special-olympics.be/wp-content/uploads/2022/08/specialolympics_artisticgymnastics.pdf','Special Olympics Artistic Gymnastics Coaching Guide','Special Olympics','governing_body','The guide includes handstand snap-down and Cartwheel as lead-up work and supports concrete demonstration, simple cues, and individualized coaching.','population_specific_coaching_guide','A Special Olympics guide is not a universal identity, eligibility, assistance, dose, or accessibility authority.',80),
    ('coach_support','https://is.muni.cz/do/fsps/e-learning/safe_gymnastics_4all/pages_en/didactic_guidelines.html','Safe Gymnastics 4all — General Didactic Guidelines','Masaryk University Faculty of Sports Studies','professional_standard','The resource distinguishes preparatory exercises, pre-elements, whole elements, connections, error categories, spotting reasons, and lesson organization.','academic_gymnastics_didactic_resource','General teaching principles do not approve this card or one spotting method.',82),
    ('accessibility','https://special-olympics.be/wp-content/uploads/2022/08/specialolympics_artisticgymnastics.pdf','Special Olympics Artistic Gymnastics Coaching Guide','Special Olympics','governing_body','Population-specific guidance supports adapting communication, demonstration, assistance, and task presentation rather than relying on labels alone.','population_specific_coaching_guide','It does not establish that either exact variant is suitable for a particular athlete.',80),
    ('alternates','https://www.gymbc.org/media/o4opcs3u/gbc-canjump-manual-1.pdf','CanJump Gymnastics Foundations Trampoline Manual','Gymnastics Canada / Gymnastics BC','governing_body','The manual separately names Handstand Snap-Down, scoop rebound, rebound to back, Round-Off, and connected skills, supporting action-order and endpoint boundaries.','governing_body_foundations_action_taxonomy','The manual does not decide every Vortex definition versus variant boundary.',82),
    ('media','https://www.youtube.com/watch?v=7r-UOQi8YvE','Gymnastics Handstand Snap Down Drill Turorial With Coach Meggin!','Fit And Fun With Coach Meggin','expert_instruction','YouTube oEmbed returned current title, channel, thumbnail, and iframe metadata on 2026-08-02.','candidate_metadata_only','Playback, exact start support, wall contract, action, landing, captions, accessibility, safety, cue quality, conflicts, reviewer, and approval remain unverified.',60)
  ) e(section_key,source_url,source_title,publisher,source_kind,supported_claim,scope,limitation,evidence_quality)
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
    'YouTube oEmbed returned current metadata on 2026-08-02. This does not establish full playback, exact definition or variant, inverted start, wall contact, hand support, snap action, hand release, simultaneous feet, stick, captions, accessibility, safety, cue quality, conflicts, reviewer identity, or approval.'
  FROM (VALUES
    ('7r-UOQi8YvE','Gymnastics Handstand Snap Down Drill Turorial With Coach Meggin!','Fit And Fun With Coach Meggin','gymnastics handstand snap down drill'),
    ('BnnX00Hlqpk','Snap Down Round Off Drills','Jess Stairs','snap down round off drills'),
    ('D6bbi5bv0TY','Back Handspring/Roundoff Drill - Handstand Snap Down Using A Wall','Fit And Fun With Coach Meggin','handstand snap down wall drill'),
    ('dqEZV4DW8aU','Drills for Better Roundoffs - Tammy Biggs','thegymnasticminute','roundoff snap down shape drills')
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
      'startSupportActionContactOrderTerminalAndExitRequired',TRUE,
      'neverInferFromNameAgeOrAthleteRanking',TRUE),
    jsonb_build_object(
      'status','research_queue','classificationCandidate',a.classification,
      'requiredFacts',a.facts_required,
      'humanIdentityAndContentReviewRequired',TRUE,'approvalsCreated',FALSE),
    'candidate',NULL,NULL
  FROM (VALUES
    ('Back-to-Wall Handstand Snap-Down to Feet-Together Stick','same_identity','Exact wall-supported working specification authored in this migration.','wall_variant',jsonb_build_array('back_to_wall','heel_contact','wall_release','hand_release','simultaneous_feet','stick')),
    ('Independent Handstand Snap-Down to Feet-Together Stick','same_identity','Exact no-external-support working specification authored in this migration.','independent_variant',jsonb_build_array('freestanding_start','no_external_contact','hand_release','simultaneous_feet','stick','bailout')),
    ('Panel-Mat Elevated Handstand Snap-Down to Stick','new_variant','Changing hand height and the landing drop changes leverage flight duration apparatus fall envelope and contact load.','elevated_hand_support_variant',jsonb_build_array('hand_height','mat_dimensions','landing_height','clearance','assistance','stick')),
    ('Qualified-Assisted Handstand Snap-Down to Stick','new_variant','Hands-on assistance changes effective load attempt classification coach position failure response and exposure accounting.','assistance_variant',jsonb_build_array('qualification','contact_points','assistance_phase','assistance_amount','release','attempt_classification')),
    ('Handstand Snap-Down to Deep Athletic Stick','new_variant','A deep athletic landing replaces the upright hollow terminal constraint and changes absorption range and intended transfer.','landing_shape_variant',jsonb_build_array('foot_width','hip_knee_ankle_angles','trunk','arms','hold','exit')),
    ('Sets Repetitions Rest or Tempo Change','modifier_annotation','Dose and tempo are delivery facts only while exact start action contacts no-rebound stick and exit remain unchanged.','dose_annotation',jsonb_build_array('sets','repetitions','rest','tempo','duration','fatigue_budget')),
    ('Visual Hand or Landing Marks','modifier_annotation','Marks and plain-language cues can annotate the exact contract but cannot change support wall action contacts or finish.','cue_annotation',jsonb_build_array('mark_type','hand_zone','foot_zone','contrast','cue','accessibility')),
    ('Full Round-Off','new_definition','A Round-Off adds upright approach or jump side-leading hands longitudinal turn and feet-together landing.','inverted_start_vs_roundoff',jsonb_build_array('approach','hurdle_or_jump','lead_side','hand_order','turn','terminal_action')),
    ('Round-Off to Immediate Rebound','new_definition','An immediate jump after Round-Off arrival adds another flight and landing and changes the repetition endpoint.','stick_vs_rebound',jsonb_build_array('roundoff','first_landing','ground_contact','rebound','second_flight','second_landing')),
    ('Round-Off to Back Handspring','new_definition','The back handspring adds a backward jump second hand-support phase snap-down and terminal action.','standalone_drill_vs_connection',jsonb_build_array('roundoff','connection','backward_flight','hand_support','snap_down','finish')),
    ('Back Handspring Snap-Down','new_definition','A back handspring snap-down includes the backward entry and flight before the inverted support phase.','established_start_vs_backspring_entry',jsonb_build_array('backward_takeoff','flight','hand_contact','inverted_phase','snap_down','finish')),
    ('Handstand Snap-Down to Immediate Rebound','new_definition','Rebound adds another takeoff flight and landing instead of ending at the first upright hollow stick.','stick_vs_immediate_rebound',jsonb_build_array('snap_down','first_contact','rebound_latency','flight','second_contact','finish')),
    ('Handstand Snap-Down to Back on Resi Mat','new_definition','Intentional backward travel and supine mat landing replace the feet-together upright stick.','stick_vs_resi_back_landing',jsonb_build_array('travel_direction','takeoff','mat_height','body_shape','back_contact','exit')),
    ('Donkey Kick or Bunny Hop','new_definition','A crouched or pike start with a double-foot hop upward and return is not an inverted-start snap-down.','handstand_start_vs_donkey_kick',jsonb_build_array('start','hand_support','foot_takeoff','hip_height','foot_return','finish')),
    ('Standing Snap-Down to Athletic Stick','new_definition','Standing arm snap and center-of-mass lowering has no inversion hand support hand release or flight-to-feet transfer.','inverted_vs_standing_snapdown',jsonb_build_array('standing_start','arms','center_of_mass','foot_contact','athletic_stance','hold')),
    ('Handstand Pop or Hop','new_definition','Hands leave and recontact the floor while the body remains inverted; the feet do not terminate the repetition.','snap_to_feet_vs_hand_pop',jsonb_build_array('hand_takeoff','flight','hand_recontact','inverted_body','foot_contact','finish')),
    ('Freestanding Handstand Hold','new_definition','A timed static unsupported balance starts and ends under a hold contract rather than scoring a dynamic snap-down.','dynamic_exit_vs_static_hold',jsonb_build_array('start','timer','balance','corrections','stop','exit')),
    ('Wall-Supported Handstand Hold','new_definition','Continuing wall contact and valid hold time replace intentional wall release and snap-down.','wall_release_vs_wall_hold',jsonb_build_array('orientation','wall_contact','timer','line','stop','exit')),
    ('Handstand Forward Roll','new_definition','A forward roll adds head tuck upper-back contact rolling path and different terminal action.','snapdown_vs_forward_roll',jsonb_build_array('handstand','head_tuck','shoulder_contact','roll','stand','finish')),
    ('Handstand Kick-Up to Wall or Spot','new_definition','The kick-up scores lunge hand placement leg kick and arrival; this snap-down begins after arrival.','start_state_vs_kickup',jsonb_build_array('lunge','hand_placement','leg_kick','wall_or_spot','arrival','exit')),
    ('Cartwheel','new_definition','Cartwheel retains side-leading hand-hand-foot-foot sequencing and staggered feet rather than no-turn simultaneous feet.','snapdown_vs_cartwheel',jsonb_build_array('side','hand_order','split_legs','foot_order','turn','lunge')),
    ('Power Hurdle to Round-Off Entry','new_definition','A power hurdle scores the dynamic approach and entry before hand support and does not score this exact inverted exit.','inverted_start_vs_hurdle_entry',jsonb_build_array('approach','hurdle','lunge','hands','arrival','finish')),
    ('Single-Leg Handstand Snap-Down Landing','new_definition','A unilateral terminal contact changes laterality load balance failure response and repetition endpoint.','bilateral_vs_unilateral_landing',jsonb_build_array('free_leg','contact_leg','pelvis','balance','hold','exit')),
    ('Elevated-Surface Round-Off Drill','new_definition','Adding approach side-leading turn and elevated hand support creates a Round-Off drill rather than the no-turn Handstand Snap-Down.','handstand_snapdown_vs_elevated_roundoff',jsonb_build_array('approach','lead_side','surface_height','hand_order','turn','landing'))
  ) a(alternate_name,classification,rationale,boundary_key,facts_required)
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
      'revalidate',jsonb_build_array('identity','start_support','wall','assistance','hand_support','action','hand_release','foot_contacts','terminal_stick','surface','environment','symptoms','dose','contact_and_fatigue_budgets','duration','logistics','persistence','skill_link','coach_rendering','athlete_rendering'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'review',NULL,NULL,NULL
  FROM (VALUES
    (wall_variant,independent_variant,'progression',84,ARRAY['load','stability','complexity']::TEXT[],'Removing wall contact changes start balance effective support failure response and coach role; no athlete readiness is inferred.'),
    (independent_variant,wall_variant,'regression',84,ARRAY['load','stability','complexity']::TEXT[],'Adding exact back-to-wall heel contact changes the variant and still requires complete revalidation.'),
    (back_to_wall_handstand_variant,wall_variant,'progression',72,ARRAY['speed','impact','complexity']::TEXT[],'A static wall hold and a dynamic wall-release snap-down have different action and endpoint contracts; this proposal is review-only.'),
    (wall_variant,back_to_wall_handstand_variant,'regression',72,ARRAY['speed','impact','complexity']::TEXT[],'Replacing dynamic snap-down with a static wall hold changes the objective and cannot be an automatic substitution.'),
    (freestanding_handstand_variant,independent_variant,'progression',74,ARRAY['speed','impact','complexity']::TEXT[],'A freestanding static hold may precede the dynamic hand-to-feet transition only after full identity and exposure review.'),
    (independent_variant,freestanding_handstand_variant,'regression',74,ARRAY['speed','impact','complexity']::TEXT[],'A static unsupported hold removes snap-down and landing actions and is a different objective.'),
    (cartwheel_variant,wall_variant,'progression',58,ARRAY['speed','impact','complexity']::TEXT[],'Cartwheel and wall-supported snap-down share hand support but differ side rotation foot order start and finish; no automatic skill transfer is authorized.'),
    (wall_variant,cartwheel_variant,'regression',58,ARRAY['speed','impact','complexity']::TEXT[],'Selecting a marked Cartwheel changes contact order laterality rotation and terminal lunge and requires complete revalidation.')
  ) r(from_id,to_id,relationship,similarity,dimensions,reason)
  ON CONFLICT(from_variant_id,to_variant_id,relationship) DO UPDATE SET
    similarity_score=EXCLUDED.similarity_score,dimensions=EXCLUDED.dimensions,
    reason=EXCLUDED.reason,conditions_json=EXCLUDED.conditions_json,
    review_status='review',created_by=NULL,reviewed_by=NULL,reviewed_at=NULL,
    updated_at=now();

  INSERT INTO coaching.exercise_score_calibration_v1(
    facility_id,variant_id,dimension,proposed_score,anchor_tier,rationale,
    status,version,created_by,reviewed_by,review_notes,reviewed_at)
  SELECT 1,v.id,d.dimension,
    CASE d.dimension WHEN 'technicalComplexity' THEN v.complexity ELSE v.physical END,
    v.anchor_tier,
    CASE d.dimension WHEN 'technicalComplexity' THEN
      'Review-only exercise-complexity anchor based on exact inverted start support, wall policy, straight-arm support, shoulder push, joined-leg snap timing, hand release, simultaneous feet, upright hollow stick, error detection, bailout, attention, and supervision.'
    ELSE
      'Review-only physical-difficulty anchor based on dynamic bodyweight hand support, wrist elbow shoulder and trunk demand, snap speed, bilateral landing absorption, start support, wall contact, fatigue, and recovery.' END
      ||' This scores the exercise, not athlete proficiency. Variant: '||v.variant_key||'.',
    'review',1,NULL,NULL,
    'Research-informed proposal only; independent comparison and qualified human approval remain required.',NULL
  FROM (VALUES
    (wall_variant,'back-to-wall-heel-contact-handstand-snap-down-stick',70,62,80),
    (independent_variant,'independent-freestanding-handstand-snap-down-stick',82,70,80)
  ) v(id,variant_key,complexity,physical,anchor_tier)
  CROSS JOIN (VALUES('technicalComplexity'),('absoluteLoadDemand')) d(dimension)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
    proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,reviewed_by=NULL,
    review_notes=EXCLUDED.review_notes,reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_score_v1(
    exercise_id,technical_complexity,absolute_load_demand,coordination_demand,
    impact,supervision_demand,base_overall_difficulty,legacy_scores,
    migration_confidence,human_review_status,reviewed_by,reviewed_at,review_notes)
  VALUES(18,82,70,88,42,88,82,
    jsonb_build_object(
      'candidateReassessment',migration_key,
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'representativeVariant','independent-freestanding-handstand-snap-down-stick',
      'exactStartSupportWallActionHandReleaseFootContactStickAndExitRequired',TRUE,
      'fullRoundOffAndReboundAreSeparateActions',TRUE,
      'skillLibraryLevelsNotCopied',TRUE,
      'independentCalibrationRequired',TRUE,'humanReviewRequired',TRUE,
      'approvalsCreated',FALSE),64,'queued',NULL,NULL,
    'Research-informed candidate reassessment only. Scores describe exercise complexity and physical difficulty, not athlete proficiency. Exact start, support, wall contact, assistance, action, contacts, no-rebound stick, exit, and independent calibration remain required.')
  ON CONFLICT(exercise_id) DO UPDATE SET
    technical_complexity=EXCLUDED.technical_complexity,
    absolute_load_demand=EXCLUDED.absolute_load_demand,
    coordination_demand=EXCLUDED.coordination_demand,impact=EXCLUDED.impact,
    supervision_demand=EXCLUDED.supervision_demand,
    base_overall_difficulty=EXCLUDED.base_overall_difficulty,
    legacy_scores=EXCLUDED.legacy_scores,
    migration_confidence=EXCLUDED.migration_confidence,
    human_review_status='queued',reviewed_by=NULL,reviewed_at=NULL,
    review_notes=EXCLUDED.review_notes,updated_at=now();

  UPDATE coaching.exercise_difficulty_profile SET
    technical=8.2,complexity=8.2,load=7.0,overall=8.2,
    recommended_age_min=NULL,recommended_age_max=NULL,attention_demand='high',
    notes='Candidate exercise complexity and physical difficulty for the exact independent Handstand Snap-Down to Feet-Together Stick. Full Round-Off, rebound, and connected tumbling are separate actions. This is not an athlete proficiency classification.',
    source='canonical_research_candidate',updated_at=now()
  WHERE exercise_id=18;

  UPDATE coaching.exercise SET
    name='Handstand Snap-Down to Feet-Together Stick',
    slug='handstand-snap-down-feet-together-stick',
    skill_level=NULL,age_min=NULL,age_max=NULL,is_published=FALSE,
    why_publish_ready=FALSE,archived=FALSE,
    description='Exact inverted-start Handstand Snap-Down drill. Select back-to-wall heel-contact or independent freestanding start; push tall, snap joined legs, release hands, land both feet simultaneously, and hold an upright hollow feet-together stick without rebound or connection.',
    instructions='Declare start support, wall and assistance policy, surface, hand and landing zones, sets, repetitions, rest, stick hold, bailout, cumulative hand-support/inversion/tumbling/landing exposure, and stop. Count every valid, invalid, partial, assisted, and incident attempt plus every contact and actual duration.',
    default_sets=2,default_reps=3,default_work_seconds=NULL,
    default_rest_seconds=90,est_seconds_per_set=120,
    card_summary='Handstand-start shoulder push and joined-leg snap-down to simultaneous feet and an upright hollow stick; no approach, side turn, rebound, or connected tumbling.',
    coach_language='Verify exact inverted start, wall contact, assistance, surface and mat security, clearance, bailout, straight arms, tall shoulders, joined legs, hand release, simultaneous feet, no-rebound stick, cumulative exposure, first fault, symptoms, and actual rest. Stop before technical fatigue.',
    athlete_language='Push tall, squeeze your legs together, snap both feet to the mat, stand hollow with arms by your ears, and freeze. Stop at the first miss or symptom.',
    programming_logic=jsonb_build_object(
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'identityRule','declared_inverted_start_to_simultaneous_feet_upright_hollow_stick_without_rebound',
      'skillLibraryRule','Round-Off mastery and athlete levels remain only in coaching.skill',
      'loadRule','record every valid invalid partial assisted and incident attempt plus two hand two foot wall and unplanned contacts',
      'fatigueRule','combine handstand cartwheel roundoff back-handspring tumbling jumping and landing exposure',
      'substitutionRule','revalidate identity start support wall assistance action contacts finish surface dose fatigue duration logistics persistence skill link and both renderings',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    scalable_variables=ARRAY['start_support','wall_contact','qualified_assistance','surface','landing_zone','sets','repetitions','rest','tempo','stick_seconds']::TEXT[],
    movement_family='Inverted Handstand Snap-Down to Stick',
    primary_phase_key='movement_intelligence',
    phase_subrole='inverted_snap_down_transition_quality',
    primary_order_slot='low_fatigue_inverted_tumbling_drill',
    programming_kind='exercise',linked_skill_id=10,
    movement_requirements=jsonb_build_object(
      'impact_level',2,'required_equipment',jsonb_build_array('spring_floor','mat'),
      'required_environment',jsonb_build_array('secured_surface','clear_inversion_fall_and_landing_lane','qualified_supervision'),
      'identityConstraints',jsonb_build_array('declared_inverted_start','joined_leg_snap_down','hands_release_before_feet','simultaneous_feet','upright_hollow_stick','no_rebound')),
    coaching_execution=jsonb_build_object(
      'observe',jsonb_build_array('start support','wall and assistance','hands elbows shoulders','joined legs','snap timing','hand release','simultaneous feet','stick','exit'),
      'qualityStop','first unsafe or identity-changing event or two consecutive technical faults',
      'persistenceRequired',TRUE),
    pairing_logic=jsonb_build_object(
      'avoid',jsonb_build_array('dense wrist shoulder handstand or tumbling volume','fatigued impact or inversion circuit'),
      'revalidateAfterPairingChange',TRUE),
    media_library=jsonb_build_object(
      'candidate_video_urls',jsonb_build_array(
        'https://www.youtube.com/watch?v=7r-UOQi8YvE',
        'https://www.youtube.com/watch?v=BnnX00Hlqpk',
        'https://www.youtube.com/watch?v=D6bbi5bv0TY',
        'https://www.youtube.com/watch?v=dqEZV4DW8aU'),
      'media_review_state','candidate_oembed_metadata_only',
      'external_playback_verification_performed',FALSE,
      'human_review_required',TRUE),updated_at=now()
  WHERE id=18;

  UPDATE coaching.exercise_safety_profile SET
    risk_level=4,impact_level=2,minimum_age_recommended=NULL,
    minimum_skill_level=NULL,requires_spotting=FALSE,
    requires_coach_supervision='required',
    minimum_prerequisite_notes='Readiness is assessed from current symptoms, exact inverted start and bailout, straight-arm support, selected wall or independent contract, simultaneous bilateral landing, environment, and qualified coach observation; never from an exercise proficiency label or age cutoff.',
    readiness_checks=ARRAY[
      'Exact variant, start, wall contact, assistance, hand and foot zones, no-rebound stick, bailout, dose, and stop are understood.',
      'Hands, wrists, elbows, shoulders, neck, spine, hips, knees, ankles, feet, balance, and landing are symptom-free for the selected contract.',
      'Spring floor, mats, wall if selected, overhead and lateral clearance, complete fall and landing lane, and emergency access pass inspection.',
      'The athlete can establish the selected inverted start, keep legs joined, respond to stop, and use the planned bailout while the coach sees every contact.'
    ]::TEXT[],
    stop_signs=ARRAY[
      'Pain, pinch, numbness, tingling, weakness, dizziness, nausea, vision change, faintness, panic, unusual breathlessness, or inability to communicate.',
      'Hand slide or regrasp, elbow or shoulder collapse, head neck trunk or unplanned wall/coach contact, or uncontrolled bailout.',
      'Leg separation or turn, hands still loaded at foot contact, asynchronous feet, missed landing zone, rebound, connection, extra step, fall, or lost upright stick.',
      'Surface wall mat clearance supervision or bailout becomes unavailable, or two consecutive technical faults occur.'
    ]::TEXT[],
    contraindications=ARRAY[
      'Current symptoms or restrictions for which inverted hand support or impact participation has not been cleared when clearance is appropriate.',
      'No secure exact surface and mats, stable wall when selected, complete clearance and bailout lane, qualified supervision, or enforceable one-athlete station.'
    ]::TEXT[],
    common_substitutions=ARRAY[
      'Select the exact wall-supported variant only after full revalidation.',
      'Use a static Handstand Hold, Handstand Kick-Up, Cartwheel drill, standing Snap-Down, or Donkey Kick only as a separate exercise identity.',
      'Do not add a Round-Off entry, rebound, back handspring, resi back landing, turn, unilateral landing, or connection without changing identity.'
    ]::TEXT[]
  WHERE exercise_id=18;

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  VALUES(canonical_definition,1,2,'2.0.0',migration_key,'quarantined',
    jsonb_build_object(
      'identity',jsonb_build_object('passed',TRUE,'identityKey','inverted_handstand_snap_down_to_bilateral_stick','legacySources',1,'activeWorkingSpecifications',2,'identityQuarantinedLegacySource',TRUE,'skillLibraryBoundaryExplicit',TRUE),
      'taxonomy',jsonb_build_object('passed',TRUE,'controlledTerms',TRUE),
      'anatomy',jsonb_build_object('passed',TRUE,'musclesJointsActionsPlanesAndLaterality',TRUE),
      'difficulty',jsonb_build_object('passed',TRUE,'model','max_exercise_complexity_physical_difficulty','athleteProficiency',NULL,'independentCalibrationRequired',TRUE),
      'loadFatigueRecovery',jsonb_build_object('passed',TRUE,'handContactsPerCompletedRep',2,'landingContactsPerCompletedRep',2,'plannedImpactContactsPerCompletedRep',4,'validInvalidPartialAssistedAndIncidentAttemptsCounted',TRUE,'cumulativeHandSupportInversionTumblingAndLandingExposure',TRUE),
      'constraints',jsonb_build_object('passed',TRUE,'startSupportWallAssistanceSurfaceClearanceBailoutContactsStickAndSupervision',TRUE),
      'delivery',jsonb_build_object('passed',TRUE,'profiles',4,'prepareAndAccessAndMovementIntelligenceOnly',TRUE,'durationDoseRestStationAndSubstitutionRevalidation',TRUE),
      'instructions',jsonb_build_object('passed',TRUE,'athleteCoachSupport',TRUE,'startSupportActionContactsStopStickBailoutIncidentAndSkillBoundary',TRUE),
      'research',jsonb_build_object('passed',TRUE,'sections',16,'registryVersion',research_version,'governingBodyAndResearchLimitsExplicit',TRUE),
      'media',jsonb_build_object('passed',FALSE,'candidateCount',4,'currentOEmbedMetadataHealthy',TRUE,'playbackReviewed',FALSE,'exactMatchReviewed',FALSE,'captionsReviewed',FALSE,'accessibilityReviewed',FALSE,'qualityReviewed',FALSE,'approvalCreated',FALSE),
      'relationships',jsonb_build_object('passed',FALSE,'reviewOnly',8,'approved',0),
      'calibration',jsonb_build_object('passed',FALSE,'reviewOnly',4,'approved',0),
      'alternates',jsonb_build_object('passed',TRUE,'assessments',24,'identityBoundaries',8,'identityBoundariesExplicit',TRUE),
      'generationSupport',jsonb_build_object('passed',TRUE,'selectionConstraints',TRUE,'cumulativeBudgets',TRUE,'duration',TRUE,'equipmentAndStation',TRUE,'substitutionRevalidation',TRUE,'renderingAndPersistence',TRUE),
      'publication',jsonb_build_object('passed',FALSE,'reviewer',NULL,'approver',NULL)),
    jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01','message','A qualified human must watch every candidate in full and verify exact definition and variant, start support, wall and assistance, hand support, snap action, hand release, simultaneous feet, no-rebound stick, captions, accessibility, safety, cue quality, conflicts, reviewer identity, timestamp, card version, and current playback.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','A qualified coach must approve or reject every progression, regression, and substitution proposal; no automatic transfer among support, assistance, Handstand, Cartwheel, Round-Off, rebound, connected tumbling, landing, or skill performance is authorized.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','An independent qualified reviewer must calibrate exercise complexity and physical difficulty. These scores do not classify an athlete and do not modify Round-Off or other skill-library levels.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','A qualified reviewer and separate approver must complete content review before publication. Every identity, start support, wall, assistance, action, contact, finish, surface, dose, and support rule remains quarantined.')),
    TRUE,now())
  ON CONFLICT(definition_id) DO UPDATE SET
    facility_id=EXCLUDED.facility_id,card_version=EXCLUDED.card_version,
    schema_version=EXCLUDED.schema_version,audit_version=EXCLUDED.audit_version,
    status='quarantined',checks_json=EXCLUDED.checks_json,
    blocking_issues_json=EXCLUDED.blocking_issues_json,
    human_review_required=TRUE,checked_at=now();

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=18 AND definition_id=canonical_definition
        AND provenance_json->>'sourceDisposition'='identity_quarantine'
        AND provenance_json->>'representedBySelectableSourceVariant'='false')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source_variant AND status='archived'
        AND requirements_json->>'representation'='identity_quarantine')
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
    RAISE EXCEPTION '% found invalid source quarantine, definition, or research lineage',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(active_variant_ids) AND status='review'
        AND requirements_json->>'selectable'='true'
        AND (difficulty_json->>'technicalComplexity')::INTEGER BETWEEN 1 AND 100
        AND (difficulty_json->>'absoluteLoadDemand')::INTEGER BETWEEN 1 AND 100
        AND (difficulty_json->>'physicalDifficulty')::INTEGER=(difficulty_json->>'absoluteLoadDemand')::INTEGER
        AND (difficulty_json->>'workCapacityDemand')::INTEGER BETWEEN 1 AND 100
        AND (difficulty_json->>'impact')::INTEGER BETWEEN 1 AND 100
        AND (difficulty_json->>'supervisionDemand')::INTEGER BETWEEN 1 AND 100
        AND (difficulty_json->>'failureConsequence')::INTEGER BETWEEN 1 AND 100
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=greatest(
          (difficulty_json->>'technicalComplexity')::INTEGER,
          (difficulty_json->>'absoluteLoadDemand')::INTEGER)
        AND difficulty_json->>'technicalMeaning'='exercise_complexity'
        AND difficulty_json->>'loadMeaning'='physical_difficulty'
        AND (load_profile_json->>'landingContactsPerRep')::INTEGER=2
        AND (load_profile_json->>'handContactsPerRep')::INTEGER=2
        AND (load_profile_json->>'plannedImpactContacts')::INTEGER=4
        AND (fatigue_profile_json->>'impactAccumulation')::INTEGER>0
        AND (fatigue_profile_json->>'recoveryHours')::INTEGER>0
        AND programming_profile_json<>'{}'::JSONB)<>2 THEN
    RAISE EXCEPTION '% found invalid active variants, score model, contacts, or fatigue contract',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=ANY(active_variant_ids) AND status='review'
        AND cardinality(equipment_required)>0
        AND coalesce(time_model_json->>'durationFormula','')<>''
        AND dose_scaling_json<>'{}'::JSONB AND measurement_json<>'{}'::JSONB
        AND support_prompts_json<>'{}'::JSONB
        AND length(coach_instructions)>=100
        AND length(athlete_instructions) BETWEEN 10 AND 240
        AND cardinality(stop_rules)>=4)<>4
    OR (SELECT count(DISTINCT section_key)
        FROM coaching.exercise_section_evidence_v1
        WHERE definition_id=canonical_definition AND reviewed_card_version=2
          AND review_status='candidate' AND reviewer_user_id IS NULL)<>16
    OR (SELECT count(*) FROM coaching.exercise_media_candidate_v1
        WHERE definition_id=canonical_definition AND reviewed_card_version=2
          AND link_status='healthy' AND review_status='candidate'
          AND embedding_allowed AND captions_available IS NULL
          AND exact_variant_match IS NULL AND demonstration_quality_score IS NULL
          AND reviewer_user_id IS NULL AND reviewed_at IS NULL)<>4
    OR (SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
        WHERE definition_id=canonical_definition AND reviewed_card_version=2
          AND review_status='candidate' AND reviewer_user_id IS NULL)<>24 THEN
    RAISE EXCEPTION '% found incomplete profiles, evidence, media, or alternate assessments',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE from_variant_id=ANY(ARRAY[wall_variant,independent_variant,
          back_to_wall_handstand_variant,freestanding_handstand_variant,
          cartwheel_variant]::UUID[])
        AND (to_variant_id=ANY(active_variant_ids)
          OR from_variant_id=ANY(active_variant_ids))
        AND conditions_json->>'migration'=migration_key
        AND review_status='review' AND reviewed_by IS NULL)<>8
    OR (SELECT count(*) FROM coaching.exercise_score_calibration_v1
        WHERE variant_id=ANY(active_variant_ids) AND status='review'
          AND version=1 AND reviewed_by IS NULL)<>4
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
        WHERE survivor_definition_id=canonical_definition
          AND resolved_definition_id IN(roundoff_rebound_definition,
            power_hurdle_definition,cartwheel_definition,
            freestanding_handstand_definition,wall_handstand_definition,
            handstand_kickup_definition,standing_snapdown_definition,
            donkey_kick_definition)
          AND decision='distinct_exercises' AND reviewed_by IS NULL)<>8 THEN
    RAISE EXCEPTION '% found incomplete review-only graph, calibration, or identity boundaries',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(definition.movement_patterns) key
      WHERE definition.id=canonical_definition AND NOT EXISTS(
        SELECT 1 FROM coaching.movement_pattern allowed WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(definition.body_regions) key
      WHERE definition.id=canonical_definition AND NOT EXISTS(
        SELECT 1 FROM coaching.body_region allowed WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(definition.required_equipment||definition.optional_equipment) key
      WHERE definition.id=canonical_definition AND NOT EXISTS(
        SELECT 1 FROM coaching.equipment allowed WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1 relationship
      WHERE (relationship.from_variant_id=ANY(active_variant_ids)
          OR relationship.to_variant_id=ANY(active_variant_ids))
        AND relationship.relationship IN('progression','regression')
        AND EXISTS(SELECT 1 FROM unnest(relationship.dimensions) dimension
          WHERE dimension<>ALL(ARRAY['load','leverage','range','speed','stability','complexity','impact','decision_demand','fatigue']))) THEN
    RAISE EXCEPTION '% created uncontrolled taxonomy or graph dimensions',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise
      WHERE id=18 AND (skill_level IS NOT NULL OR age_min IS NOT NULL
        OR age_max IS NOT NULL OR is_published OR why_publish_ready))
    OR EXISTS(SELECT 1 FROM coaching.exercise_safety_profile
      WHERE exercise_id=18
        AND (minimum_skill_level IS NOT NULL OR minimum_age_recommended IS NOT NULL
          OR requires_coach_supervision<>'required'))
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1
      WHERE exercise_id=18 AND technical_complexity=82
        AND absolute_load_demand=70 AND base_overall_difficulty=82
        AND impact=42 AND human_review_status='queued'
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
    RAISE EXCEPTION '% retained or fabricated proficiency, approval, media, or publication state',migration_key;
  END IF;
END;
$$;
