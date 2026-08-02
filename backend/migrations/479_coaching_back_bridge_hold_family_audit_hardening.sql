-- Replace the ambiguous Back Bridge baseline with exact static hands-and-feet
-- supported hold specifications. Standing backbends, handstand entries,
-- kickovers, walkovers, rocks to stand, push-ups, head/forearm support, crab
-- reaches, and glute bridges remain separate actions. All evidence, media,
-- graph, calibration, content, and publication decisions stay review-only.
-- Exercise difficulty never classifies athlete proficiency or skill level.

DO $$
DECLARE
  migration_key CONSTANT TEXT := '479_coaching_back_bridge_hold_family_audit_hardening';
  research_version CONSTANT TEXT := '2026-08-02.84';
  canonical_definition CONSTANT UUID := '154614aa-67be-4b1c-8e9f-cb9a30620239';
  source_ids CONSTANT BIGINT[] := ARRAY[16];
  source_variant CONSTANT UUID := 'e84078d2-0fda-41a0-be73-355d84f2c985';
  floor_variant CONSTANT UUID := 'e5ce6d88-46e0-458c-bf77-58e75c3e8208';
  feet_elevated_variant CONSTANT UUID := '9a05f917-cdaf-4243-ab3c-5eb4d7af15be';
  one_leg_variant CONSTANT UUID := '3df0bd43-31db-4961-a8b7-f1944322f650';
  active_variant_ids CONSTANT UUID[] := ARRAY[
    floor_variant,feet_elevated_variant,one_leg_variant];
  neighbor_definition_ids CONSTANT UUID[] := ARRAY[
    '047048f8-4eb2-43aa-8daf-0bbb542e145a'::UUID,
    'f40bde37-6465-42a3-a817-830eada23aa7'::UUID,
    '3f21cb64-9f61-4c11-bbc0-aebd395dc76e'::UUID,
    'eae3a6ea-3550-4a0e-bd48-dcde852f2fbe'::UUID,
    'df3fdc9e-4e14-4be8-bf73-090b0e6227fd'::UUID,
    'bd089b50-604a-40e5-9222-5cb1002dd241'::UUID,
    '41b60c7f-ccc7-4c8d-97fd-c032b22b4761'::UUID,
    'b9b5fe20-d556-4ade-8bad-4f4b4f219f18'::UUID,
    '86f314f9-d8bd-4c53-a46d-af6806134e1c'::UUID];
  video_ids CONSTANT TEXT[] := ARRAY[
    'TrxZLshL0Ec','aozR72_L16g','tSvmWU-0Zo0','usyrUMFhLUc'];
  protected_count INTEGER;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition AND status<>'archived')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=16 AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source_variant AND definition_id=canonical_definition)
    OR (SELECT count(*) FROM coaching.exercise_definition_v1
        WHERE id=ANY(neighbor_definition_ids) AND status<>'archived')<>9 THEN
    RAISE EXCEPTION '% prerequisite Back Bridge state is missing or drifted',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=ANY(active_variant_ids) AND definition_id<>canonical_definition) THEN
    RAISE EXCEPTION '% working variant UUID is owned by another definition',migration_key;
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
      WHERE exercise_id=16
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
        'sourceInterpretation','legacy text says only spinal extension flexibility skill and does not fix entry support hand and foot geometry hold boundary head contact exit or whether the task is static dynamic or skill performance',
        'exactWorkingSpecificationRequired',TRUE,
        'skillLibraryBoundary','bridge kickover handstand to bridge and back walkover performance remain skill-library content without copying their levels',
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=16;

  UPDATE coaching.exercise_delivery_profile_v1 SET status='archived',updated_at=now()
  WHERE variant_id=source_variant;
  UPDATE coaching.exercise_variant_v1 SET
    variant_key='identity-quarantine-source-16',
    display_name='Back Bridge Identity Quarantine — Source 16',
    modifier_keys='{}'::TEXT[],difficulty_json='{}'::JSONB,status='archived',
    requirements_json=jsonb_build_object(
      'selectable',FALSE,'representation','identity_quarantine',
      'sourceLegacyExerciseId',16,
      'archiveReason','source_does_not_fix_entry_support_geometry_hold_head_contact_exit_or_static_dynamic_skill_boundary',
      'humanReviewRequired',TRUE),
    load_profile_json=jsonb_build_object('selectable',FALSE),
    fatigue_profile_json=jsonb_build_object('selectable',FALSE),
    programming_profile_json=jsonb_build_object(
      'selectionStatus','identity_quarantine','selectable',FALSE,
      'publicationQuarantined',TRUE),updated_at=now()
  WHERE id=source_variant;

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by,resolved_at)
  SELECT 1,canonical_definition,b.definition_id,'distinct_exercises',b.rationale,
    jsonb_build_object(
      'migration',migration_key,'identityBoundary',b.boundary_key,
      'baseContract','supine_entry_static_hands_and_feet_supported_spine_hip_extension_hold_with_head_clear_and_controlled_supine_exit',
      'neighborContract',b.neighbor_contract,
      'researchSources',jsonb_build_array(
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC4769315/',
        'https://mybg.british-gymnastics.org/store/downloadPublic?f=e810bf6f-df1b-4828-957d-6ddafe28f4c6.pdf&t=email'),
      'identityOnlyNeighborStillRequiresItsOwnAudit',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'deterministic_identity_equivalence',NULL,now()
  FROM (VALUES
    ('047048f8-4eb2-43aa-8daf-0bbb542e145a'::UUID,'hands_and_feet_arch_hold_vs_shoulders_and_feet_hip_extension_repetition','Glute Bridge scores dynamic hip extension with shoulders retained on support and no hand weight-bearing; Back Bridge is a static four-point arched support hold.','supine_shoulders_and_feet_supported_dynamic_hip_extension'),
    ('f40bde37-6465-42a3-a817-830eada23aa7'::UUID,'hands_and_feet_arch_hold_vs_shoulders_and_feet_neutral_iso','Glute Bridge Iso retains shoulders on the floor and a comparatively neutral trunk line rather than hand-supported spine and shoulder extension.','supine_shoulders_and_feet_supported_hip_extension_isometric'),
    ('3f21cb64-9f61-4c11-bbc0-aebd395dc76e'::UUID,'four_point_back_bridge_vs_unilateral_glute_bridge_repetition','Single-Leg Glute Bridge changes orientation, support, spinal shape, and dynamic hip-extension repetition.','unilateral_shoulders_and_foot_supported_dynamic_hip_extension'),
    ('eae3a6ea-3550-4a0e-bd48-dcde852f2fbe'::UUID,'four_point_back_bridge_vs_unilateral_glute_bridge_iso','Single-Leg Glute Bridge Iso retains shoulder-floor support and hip-extension alignment rather than palm support and an arched spine.','unilateral_shoulders_and_foot_supported_hip_extension_isometric'),
    ('df3fdc9e-4e14-4be8-bf73-090b0e6227fd'::UUID,'bilateral_static_hold_vs_unilateral_rotational_reach','Crab Reach uses one supporting arm and a prescribed reach or rotation action rather than a bilateral static bridge hold.','one_arm_crab_support_with_reach_and_rotation'),
    ('bd089b50-604a-40e5-9222-5cb1002dd241'::UUID,'bilateral_static_hold_vs_dynamic_thoracic_bridge_reach','Crab Reach Thoracic Bridge is an anterior-chain flow with unilateral reach and rotation, not the same static support contract.','dynamic_crab_reach_thoracic_rotation_flow'),
    ('41b60c7f-ccc7-4c8d-97fd-c032b22b4761'::UUID,'four_point_supported_arch_vs_prone_unsupported_arch','Arch Body Hold or Superman is prone unsupported limb elevation with no palm-and-foot support.','prone_unsupported_static_arch_shape'),
    ('b9b5fe20-d556-4ade-8bad-4f4b4f219f18'::UUID,'four_point_supported_arch_vs_prone_arch_hold','Arch Hold is a prone ground shape and cannot substitute without changing support, loading, spinal demand, and objective.','prone_static_arch_shape_hold'),
    ('86f314f9-d8bd-4c53-a46d-af6806134e1c'::UUID,'static_full_body_arch_vs_supported_hinge_extension_cycle','Back Extension or Hip Extension is a supported hinge repetition around the hip or trunk, not a static hands-and-feet bridge.','supported_dynamic_hip_or_trunk_extension_cycle')
  ) b(definition_id,boundary_key,rationale,neighbor_contract)
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,resolution_source=EXCLUDED.resolution_source,
    reviewed_by=NULL,resolved_at=now();

  UPDATE coaching.exercise_definition_v1 SET
    slug='gymnastics-back-bridge-hold',
    canonical_name='Gymnastics Back Bridge Hold',
    display_name='Gymnastics Back Bridge Hold',
    aliases=ARRAY['Back Bridge','Back Bridge Hold','Backbend Bridge','Gymnastics Bridge','Gymnastics Bridge Hold'],
    description='Static gymnastics bridge hold entered from supine with weight supported through declared palms and feet, head clear of support, an exact bilateral or unilateral support contract, valid timed shape, first-break stop, and controlled supine exit.',
    family_key='hands_and_feet_supported_static_spine_hip_extension_hold',
    schema_version='2.0.0',card_version=2,status='review',
    content_confidence=76,scoring_confidence=62,media_confidence=38,
    movement_patterns=ARRAY['push','invert','reach']::TEXT[],
    body_regions=ARRAY['full_body','shoulder','wrist','spine','thoracic_spine','hip','core']::TEXT[],
    required_equipment=ARRAY['mat']::TEXT[],
    optional_equipment=ARRAY['low_step']::TEXT[],
    environment_json=jsonb_build_object(
      'surface','level locked nonslip gymnastics mat or sprung floor with no seam under hands or feet',
      'space','one athlete station with clear head hand foot and controlled-lowering zones',
      'overheadClearance','full body arch and coach observation clearance required',
      'stationRules',jsonb_build_array('inspect mat and any low step before every set','one athlete moves only after the prior athlete and coach clear','no wall head partner or apparatus contact during valid time unless a later exact variant declares it'),
      'supervision','direct qualified observation for every entry hold and exit',
      'notAllowed',jsonb_build_array('unlocked step','sliding mat','crowded lane','unplanned standing entry','race or fatigue circuit','unobserved maximum hold')),
    population_json=jsonb_build_object(
      'exerciseCardDoesNotClassifyAthletes',TRUE,
      'readinessIsWorkoutInput',TRUE,
      'readinessFacts',jsonb_build_array('exact support and stop signal understood','symptom-free palm wrist elbow shoulder neck spine hip knee ankle and foot loading for the selected variant','controlled supine press and lowering path available','breathing and communication retained','coach can see every support point'),
      'excludeOrReferPerFacilityPolicy',jsonb_build_array('current pain numbness tingling weakness dizziness vision change nausea faintness pressure symptoms or unusual exertional symptoms','current condition or restriction for which loaded spine extension or upper-extremity support has not been cleared when clearance is appropriate','no stable surface exact equipment direct observation or controlled exit'),
      'noUniversalEligibilityOrAgeThresholdClaimed',TRUE),
    provenance_json=jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'legacySourceIds',source_ids,
      'researchSources',jsonb_build_array(
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC4769315/',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC7225801/',
        'https://www.tandfonline.com/doi/full/10.1080/10255842.2020.1812841',
        'https://www.apunts.org/en-control-flexibilitat-joves-gimnastes-competicio-articulo-resumen-S1886658110000617',
        'https://www.gymbc.org/media/o4opcs3u/gbc-canjump-manual-1.pdf',
        'https://www.gymnasticsontario.ca/wp-content/uploads/2014/12/2016-17-Section-I-Technical-Rules-and-Regulations.pdf',
        'https://www.gymnasticsontario.ca/wp-content/uploads/2014/12/2015-16-MAG-ON-Prov-L12and3-Rules-Nov20152.pdf',
        'https://mybg.british-gymnastics.org/store/downloadPublic?f=e810bf6f-df1b-4828-957d-6ddafe28f4c6.pdf&t=email',
        'https://ssep.com.au/how-to-correctly-perform-a-gymnastics-bridge/'),
      'confidenceBySection',jsonb_build_object('identity',86,'taxonomy',82,'anatomy',76,'difficulty',62,'load',66,'fatigueRecovery',54,'constraints',72,'dosage',54,'instructions',76,'alternates',82,'media',38),
      'unresolvedClaims',jsonb_build_array('one universal optimal bridge shape or hand and foot spacing','individual tissue load distribution','universal readiness or safety threshold','training dose and recovery interval','injury prevention or transfer outcome','numeric difficulty calibration','media exactness captions accessibility safety and cue quality'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,
      'sourceLimitationsExplicit',TRUE,'externalPlaybackVerificationPerformed',FALSE),
    anatomy_json=jsonb_build_object(
      'primeMovers',jsonb_build_array('triceps brachii','anterior and middle deltoid','spinal extensors','gluteus maximus','quadriceps'),
      'secondaryMuscles',jsonb_build_array('serratus anterior','trapezius','rotator cuff','latissimus dorsi','hamstrings','calf and intrinsic foot muscles','forearm and hand musculature'),
      'stabilizers',jsonb_build_array('abdominal wall','multifidus','pelvic stabilizers','scapular stabilizers','elbow and wrist stabilizers'),
      'joints',jsonb_build_array('fingers and hands','wrists','elbows','shoulders','scapulothoracic articulation','thoracic spine','lumbar spine','hips','knees','ankles','feet'),
      'actions',jsonb_build_array('wrist extension under load','elbow extension','shoulder flexion or hyperflexion relative to trunk','scapular upward rotation and stabilization','multisegment spinal extension','hip extension','knee flexion in setup and isometric lower-limb support','ankle and foot stabilization'),
      'planes',jsonb_build_array('sagittal primary','frontal stabilization','transverse stabilization'),
      'laterality','bilateral except exact side-specific one-leg variant',
      'tissues',jsonb_build_array('palms and fingers','wrists','elbows','shoulders','thoracic and lumbar spine','hips','knees','ankles and feet'),
      'evidenceBoundary','Muscle roles and load shares vary with geometry, mobility, anthropometry, surface, support height, fatigue, assistance, and individual strategy; no precise distribution is inferred.'),
    athlete_support_json=jsonb_build_object(
      'whyItMatters','Practice a repeatable static hands-and-feet bridge shape with exact support, breathing, and a controlled exit while the coach observes every contact.',
      'primaryCue','Press the floor through your assigned hands and feet, keep your head clear, breathe, and lower on the first shape break.',
      'selfChecks',jsonb_build_array('correct variant and support points','palms and feet remain fixed','head stays clear','elbows and assigned knee stay within the exact contract','breathing and stop response remain available','controlled supine exit'),
      'expectedSensations',jsonb_build_array('distributed effort through hands arms shoulders trunk hips and legs','position-specific stretch that does not become sharp increasing focal or neurological symptoms'),
      'unexpectedSensations',jsonb_build_array('pain','numbness','tingling','weakness','dizziness','vision change','nausea','faintness','pressure symptoms','unusual exertional symptoms'),
      'painEscalation','Stop immediately, lower with coach direction, report the exact location and event, and follow facility support or referral policy without in-product diagnosis.',
      'accessibility',jsonb_build_object('verbalAndVisualPreview',TRUE,'highContrastSupportMarksOptional',TRUE,'noUnreviewedEquipmentOrAssistanceSubstitution',TRUE)),
    coach_support_json=jsonb_build_object(
      'setup',jsonb_build_array('confirm exact card variant and dose','inspect mat and low step if used','mark or record hand and foot geometry','clear lowering zone','declare timer start first-break stop and assistance policy'),
      'observe',jsonb_build_array('supine entry path','each hand and foot contact','head clearance','elbow shoulder spinal hip knee and foot behavior','breathing and response','first fault','controlled lowering'),
      'faults',jsonb_build_array('head or unplanned body contact','palm foot or step shift','elbow collapse','unplanned wall or partner contact','wrong free-leg side or shape','focal uncontrolled lumbar hinge','breath hold','uncontrolled exit'),
      'corrections',jsonb_build_array('stop and lower before changing geometry','reduce time or choose a reviewed exact support variant','increase rest','change exercise only through reviewed graph and full revalidation'),
      'groupManagement',jsonb_build_array('one athlete per station','direct sightline for all support points','coach and adjacent athletes outside lowering zone','count assisted failed partial and incident exposures'),
      'assistanceRule','Any physical guidance is declared, logged by contact point and phase, and cannot count as an independent valid hold.',
      'incidentResponse',jsonb_build_array('call stop and direct controlled lowering when possible','secure station and assess immediate help needs without diagnosis','record variant geometry first fault symptoms assistance and outcome','follow facility emergency safeguarding and referral policy')),
    support_operations_json=jsonb_build_object(
      'selectionInputs',jsonb_build_array('definition variant profile card and research version','objective and session phase','support geometry surface step height and assistance policy','sets hold seconds per side rest duration and station time','same-session bridge backbend walkover hand-support overhead and spine-extension exposure','symptoms fear recovery population environment and supervision'),
      'persistence',jsonb_build_array('workout and item id','definition variant profile card and research version','support geometry exact height and side','planned and completed valid invalid partial assisted and incident holds','valid seconds first fault symptoms rest exit and substitution','related skill targets without copying levels','athlete and coach rendering versions'),
      'skillLibraryBoundary',jsonb_build_object('exerciseCardDoesNotClassifyAthletes',TRUE,'bridgeKickoverHandstandToBridgeAndWalkoverRemainSkillLibraryContent',TRUE,'relatedSkillSlugs',jsonb_build_array('wag-comp-bridge-back-kickover','wag-comp-handstand-bridge-kickover','wag-comp-back-walkover','usag-at-l2-tumbling-1-back-walkover')),
      'incidentPath',jsonb_build_array('call stop and direct safe lowering','clear and secure station','assess immediate help needs without in-product diagnosis','record exact support geometry event symptoms and assistance','follow facility policy','quarantine uncertain identity instruction or media'),
      'changeImpact','Any entry, hand or foot support, height, side, free-leg shape, head contact, wall or partner contact, range, timer, hold, exit, dose, fatigue, population, station, or media change invalidates cached selection, duration, logistics, rendering, and approval assumptions.',
      'publication',jsonb_build_object('humanMediaGraphCalibrationContentAndSeparateApprovalRequired',TRUE)),
    approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,last_reviewed_at=NULL,
    updated_at=now()
  WHERE id=canonical_definition;

  INSERT INTO coaching.exercise_variant_v1(
    id,definition_id,variant_key,display_name,modifier_keys,difficulty_json,
    requirements_json,status,load_profile_json,fatigue_profile_json,
    programming_profile_json)
  SELECT v.id,canonical_definition,v.variant_key,v.display_name,v.modifiers,
    jsonb_build_object(
      'technicalComplexity',v.complexity,'technicalMeaning','exercise_complexity',
      'physicalDifficulty',v.physical,'loadMeaning','physical_difficulty',
      'baseOverallDifficulty',greatest(v.complexity,v.physical),
      'overallFormula','max(exercise_complexity,physical_difficulty)',
      'dimensions',jsonb_build_object('relativeStrength',v.relative_strength,'mobility',v.mobility,'balance',v.balance,'stability',v.stability,'coordination',v.coordination,'speed',v.speed,'decisionDemand',v.decision,'workCapacity',v.work_capacity,'impact',v.impact,'eccentricStress',v.eccentric,'jointStress',v.joint_stress,'spinalLoading',v.spinal_loading,'gripDemand',v.grip,'inversionDemand',v.inversion,'fearDemand',v.fear,'supervisionDemand',v.supervision,'spottingComplexity',v.spotting,'failureConsequence',v.failure),
      'candidateOnly',TRUE,'independentCalibrationRequired',TRUE,
      'athleteClassification',NULL),
    jsonb_build_object(
      'selectable',TRUE,'representation','exact_working_specification',
      'entry','supine_on_declared_mat_with_palms_set_beside_head_and_assigned_feet_set_before_press',
      'handSupport','both palms fixed on declared marks with fingers oriented per reviewed setup and no slide pivot or regrasp',
      'footSupport',v.foot_support,'surface',v.surface_contract,
      'headContract','head and neck remain clear of support and do not bear load during valid time',
      'armContract','both elbows remain extended after valid time starts',
      'trunkContract','static multisegment bridge shape without prescribed rocking pulsing or translation',
      'legContract',v.leg_contract,'laterality',v.laterality,
      'timerStart','all assigned support points fixed head clear elbows extended breathing visible and coach says start',
      'repetitionBoundary','press from supine to exact static bridge hold maintain valid seconds stop at first invalidating event and lower under control to supine',
      'invalidatingEvents',jsonb_build_array('head neck forearm knee or unplanned body contact','palm foot or step shifts','elbow collapses','assigned free leg changes side bend or position','unplanned wall partner or apparatus contact','rock pulse walk kickover or other added action','breath stops or stop response is lost','pain neurological vestibular pressure or unusual exertional symptom','coach rescue or uncontrolled exit'),
      'equipmentRequired',v.equipment_required,'identityQuarantine',FALSE,
      'workingSpecificationRequiresHumanReview',TRUE),
    'review',
    jsonb_build_object(
      'externalLoadMethod','bodyweight_static_four_point_or_exact_three_point_hands_and_feet_support',
      'supportLoad','bodyweight is shared across declared palms and feet; exact distribution is not assumed',
      'gripDemand',v.grip,'spinalLoading',v.spinal_loading,
      'eccentricStress',v.eccentric,'landingContactsPerRep',0,
      'handContactsPerEntry',2,'footContactsPerEntry',v.foot_contacts,
      'plannedImpactContacts',0,'impactClass','no_planned_flight_or_landing',
      'dominantContraction','isometric_bridge_hold_with_concentric_press_entry_and_eccentric_controlled_lower',
      'effectiveLoadDrivers',jsonb_build_array('body mass and segment distribution','hand and foot distance','shoulder and spine mobility strategy','support height','free leg position','surface stiffness and friction','entry and exit control','hold duration','prior hand support overhead and spine extension fatigue'),
      'loadTracking',jsonb_build_array('exact variant support height geometry and side','valid invalid partial assisted and incident entries','valid seconds and first fault','head wall partner and coach contacts','same-session bridge backbend walkover hand-support overhead and spine-extension exposure')),
    jsonb_build_object(
      'localMuscleFatigue',v.local_fatigue,'gripFatigue',v.grip_fatigue,
      'technicalFatigueSensitivity',v.technical_fatigue,
      'impactAccumulation',v.impact,'recoveryHours',v.recovery_hours,
      'recoveryWindow','candidate planning estimate only; typically 12 to 36 hours depending on novelty geometry duration symptoms and adjacent hand-support overhead or spine-extension work',
      'primaryFatigueSites',jsonb_build_array('hands and forearms','wrists','triceps and shoulders','scapular and spinal stabilizers','hips thighs and calves'),
      'earlyFatigueSignals',jsonb_build_array('hand or foot shift','elbow softening','head approaches support','shape localizes or drifts','free-leg position changes','breath holding delayed response or symptom'),
      'downstreamConflicts',jsonb_build_array('priority backbend bridge kickover walkover or tumbling work','high-volume wrist hand support or overhead pressing','symptomatic loaded spine extension','fatigued landing or uncontrolled exit work')),
    jsonb_build_object(
      'trainingStimuli',v.stimuli,
      'stimulusDose',jsonb_build_object('primary','quality_terminated_valid_hold_seconds','countInvalidPartialAssistedAndIncidentEntriesAsExposure',TRUE,'fatigueCeiling','low_for_position_quality'),
      'weeklyExposure','Combine valid invalid partial and assisted bridge entries and seconds with Backbend Walkover Kickover Handstand tumbling overhead and other loaded spine-extension exposure.',
      'prerequisites',jsonb_build_array('symptom-free exact hand and foot support and controlled lowering','support geometry and stop signal understood','stable exact mat and step if assigned','current fatigue permits repeatable entry hold breathing and exit','qualified direct observation'),
      'completionCriteria',jsonb_build_array('exact variant support height and side','fixed palms and assigned feet','head clear and elbows extended','continuous breathing and no symptoms','first-break stop and controlled supine exit','complete record'),
      'sequenceRules',jsonb_build_array('prepare wrists shoulders trunk hips knees and ankles before exact rehearsal','place before fatiguing hand-support overhead or spine-extension work when position quality is the objective','do not use as a race blind circuit or unplanned maximum','stop before support shape breathing or exit deteriorates'),
      'pairingCompatibility',jsonb_build_array('low-demand mobility after full recovery','noncompeting instruction or visualization','technical work without shared wrist shoulder spine-extension or exit fatigue'),
      'interferenceRules',jsonb_build_array('do not pre-fatigue wrists triceps shoulders spinal stabilizers hips or exit control','do not pair with cross traffic or unstable equipment','revalidate after any entry support height side leg shape assistance surface timer or dose change'),
      'selection',jsonb_build_object('phaseDefault','movement_intelligence','prepareAndAccessOnlyAtLowDose',TRUE,'readinessIsWorkoutInput',TRUE,'exerciseDifficultyDoesNotClassifyAthletes',TRUE),
      'publicationQuarantined',TRUE)
  FROM (VALUES
    (floor_variant,'supine-entry-floor-bilateral-static-hold','Back Bridge Hold — Floor Bilateral',ARRAY['supine_entry','floor','bilateral_hands','bilateral_feet','static_hold']::TEXT[],68,72,60,92,54,72,58,12,48,54,0,30,86,88,62,62,48,76,64,80,70,66,78,24,'both feet flat and fixed on declared floor marks','level locked nonslip mat or sprung floor','both knees remain flexed within reviewed geometry with both feet fixed','bilateral',ARRAY['mat']::TEXT[],2,jsonb_build_array('static hands-and-feet support','shoulder and multisegment spine extension access','controlled press entry and lowering','breathing under exact position')),
    (feet_elevated_variant,'supine-entry-feet-elevated-bilateral-static-hold','Back Bridge Hold — Feet Elevated',ARRAY['supine_entry','feet_elevated','bilateral_hands','bilateral_feet','static_hold']::TEXT[],64,70,58,88,50,68,54,12,48,48,0,28,84,78,62,60,44,74,62,76,68,64,74,24,'both feet fixed on one locked low step at a recorded equal height between 10 and 30 cm','level mat plus locked nonslip low step with no edge under the ankles','both knees remain flexed within reviewed geometry and feet share the same exact height','bilateral',ARRAY['mat','low_step']::TEXT[],2,jsonb_build_array('static elevated-foot bridge support','declared shoulder and upper-trunk access emphasis','controlled exact-height setup','breathing under exact position')),
    (one_leg_variant,'supine-entry-floor-one-leg-straight-up-static-hold','Back Bridge Hold — Floor One-Leg Straight-Up',ARRAY['supine_entry','floor','bilateral_hands','one_support_foot','straight_free_leg_up','side_specific','static_hold']::TEXT[],76,78,68,92,76,82,72,14,56,60,0,32,88,88,66,66,58,82,70,84,76,72,86,30,'one declared support foot remains flat and fixed; the other leg stays straight in the reviewed upward position without contacting support','level locked nonslip mat or sprung floor','support knee remains flexed within reviewed geometry and free knee remains extended; left and right are planned and logged separately','side_specific',ARRAY['mat']::TEXT[],1,jsonb_build_array('unilateral static bridge support','pelvis and free-leg control','side-specific load and balance','controlled one-foot hold and lowering'))
  ) v(id,variant_key,display_name,modifiers,complexity,physical,relative_strength,mobility,balance,stability,coordination,speed,decision,work_capacity,impact,eccentric,joint_stress,spinal_loading,grip,inversion,fear,supervision,spotting,failure,local_fatigue,grip_fatigue,technical_fatigue,recovery_hours,foot_support,surface_contract,leg_contract,laterality,equipment_required,foot_contacts,stimuli)
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
      'Rehearse the exact support geometry, press, breathing, first-break stop, and controlled lowering at minimal exposure before the primary task.'
    ELSE
      'Practice a repeatable static gymnastics Back Bridge support position with exact geometry, low fatigue, continuous breathing, and controlled exit.' END,
    CASE p.phase_key WHEN 'prepare_and_access' THEN v.mi_suitability-6 ELSE v.mi_suitability END,
    CASE p.phase_key WHEN 'prepare_and_access' THEN 84 ELSE 90 END,
    jsonb_build_object(
      'primaryObjective',CASE p.phase_key WHEN 'prepare_and_access' THEN 'bridge_support_rehearsal_and_readiness_observation' ELSE 'static_bridge_position_learning_quality' END,
      'variant',v.variant_key,'validOnlyWhenExactVariantPasses',TRUE,
      'sideMustBePlannedAndLoggedWhenApplicable',TRUE,'fatigueCeiling','low',
      'notConditioningOrMaximumTesting',TRUE,'doesNotRankAthletes',TRUE),
    jsonb_build_object(
      'sets',CASE p.phase_key WHEN 'prepare_and_access' THEN 1 ELSE 2 END,
      'holdSecondsMin',CASE p.phase_key WHEN 'prepare_and_access' THEN v.prepare_min ELSE v.mi_min END,
      'holdSecondsMax',CASE p.phase_key WHEN 'prepare_and_access' THEN v.prepare_max ELSE v.mi_max END,
      'holdsPerDeclaredSide',CASE WHEN v.side_specific THEN 1 ELSE NULL END,
      'restSecondsMin',CASE p.phase_key WHEN 'prepare_and_access' THEN 60 ELSE 75 END,
      'restSecondsMax',CASE p.phase_key WHEN 'prepare_and_access' THEN 120 ELSE 150 END,
      'countInvalidPartialAssistedAndIncidentEntriesAsExposure',TRUE,
      'effortCap','stop_at_first_support_shape_breathing_symptom_or_exit_fault',
      'doseAuthority','candidate_profile_pending_human_review'),
    'Exact supine entry, declared support geometry, fixed palms and assigned feet, head clear, elbows extended, continuous breathing, first-break stop, and controlled supine lowering pass; the final valid hold resembles the first.',
    ARRAY[
      'Sharp or increasing hand, wrist, elbow, shoulder, neck, spine, hip, knee, ankle, or foot pain.',
      'Numbness, tingling, weakness, vision change, dizziness, nausea, faintness, pressure symptoms, panic, or unusual exertional symptoms.',
      'The mat, floor, low step, mark, timer, or surrounding station shifts or becomes unsafe.',
      'The athlete enters from standing, handstand, rocking, or another unassigned action.',
      'A palm, foot, low step, or assigned free-leg position shifts from the exact setup.',
      'An elbow collapses or head, neck, forearm, knee, or another unplanned body part contacts support.',
      'Wall, partner, or coach contact occurs after valid time begins.',
      'The athlete rocks, pulses, walks, kicks over, performs a push-up, or adds another action.',
      'Breathing stops or the athlete cannot answer the stop cue.',
      'The coach cannot observe every support point or another person enters the lowering zone.',
      'The planned hold, entry, hand-support, loaded-extension, or same-session exposure budget is reached.',
      'The athlete cannot lower under control or the coach must rescue the exit.'
    ]::TEXT[],
    'Verify exact card, variant, support height and side, hand and foot geometry, mat and step stability, head-clear contract, direct sightline, prior hand-support overhead and spine-extension fatigue, dose, and stop signal. Record every entry, valid second, first fault, assistance, symptom, and exit. Revalidate after any change.',
    'Use your assigned hands, feet, height, and side. Press to your bridge, keep your head clear, breathe, and lower on the first shape break or symptom.',
    CASE p.phase_key WHEN 'prepare_and_access' THEN
      'Clearer support, breathing, stop, and controlled-exit readiness with minimal fatigue.'
    ELSE
      'More repeatable static support geometry, distributed position control, breathing, and controlled lowering under low fatigue.' END,
    v.equipment_required,
    jsonb_build_object(
      'stationType',v.station_type,'athletesPerStation',1,
      'setupSeconds',v.setup_seconds,'entrySeconds',8,'exitSeconds',8,
      'resetSeconds',20,'transitionSeconds',20,
      'requiresDirectObservation',TRUE,'requiresControlledLoweringZone',TRUE,
      'equipmentInspectionBeforeEverySet',TRUE,
      'sharedStationPolicy','one athlete moves only after the previous athlete and coach clear every support and lowering zone',
      'equipmentChangeInvalidatesCachedLogistics',TRUE),
    v.substitution_ids,'review',
    jsonb_build_object(
      'durationFormula','setup + each observed entry + valid and invalid hold seconds + controlled exit + rest + reset + transitions',
      'estimateSeconds',CASE p.phase_key WHEN 'prepare_and_access' THEN v.prepare_duration ELSE v.mi_duration END,
      'lowerBoundSeconds',CASE p.phase_key WHEN 'prepare_and_access' THEN v.prepare_duration-45 ELSE v.mi_duration-90 END,
      'upperBoundSeconds',CASE p.phase_key WHEN 'prepare_and_access' THEN v.prepare_duration+90 ELSE v.mi_duration+180 END,
      'includeInvalidPartialAssistedAndIncidentEntries',TRUE,
      'includeEveryEquipmentReset',TRUE,'recomputeAfterSubstitution',TRUE),
    jsonb_build_object(
      'regressionOrder',jsonb_build_array('reduce hold seconds','increase rest','use the reviewed bilateral variant','use the exact feet-elevated variant only after objective and load review','change exercise only through reviewed graph'),
      'progressionOrder',jsonb_build_array('improve entry hold breathing and exit repeatability','increase seconds within reviewed profile','add the exact one-leg variant only when intentionally planned','transfer to a skill card only through qualified coach review'),
      'neverScaleBy',jsonb_build_array('athlete proficiency label','unplanned standing entry','head support','unplanned assistance','deeper focal lumbar extension','maximum duration after shape failure'),
      'revalidateAllGenerationInputs',TRUE),
    jsonb_build_object(
      'planned',jsonb_build_array('variant','support height and side','sets','hold seconds','rest','surface and equipment','assistance policy','supervision'),
      'actual',jsonb_build_array('valid invalid partial assisted and incident entries','valid seconds','first support or shape fault','head wall partner or coach contacts','symptoms','exit quality','duration'),
      'cumulativeBudgets',jsonb_build_array('bridge entries','valid bridge seconds','hand-support exposures','loaded spine-extension seconds','same-session Backbend Walkover Kickover Handstand overhead and tumbling exposure'),
      'persistenceRequired',TRUE,'coachAndAthleteRenderingRequired',TRUE),
    jsonb_build_object(
      'athletePrompt','Report symptoms fear uncertainty the first support or shape fault and whether you could lower under control.',
      'coachPrompt','Record exact variant geometry height side entry valid seconds first fault assistance symptoms exit cumulative exposure and recovery note.',
      'supportPrompt','Quarantine identity environment skill-link media instruction dose rendering or persistence mismatches; never convert them into approval.',
      'incidentPrompt','Stop, direct or assist a controlled lowering when possible, secure the station, assess immediate help needs, document the exact event, and follow facility policy.')
  FROM (VALUES
    (floor_variant,'floor_bilateral',ARRAY['mat']::TEXT[],'clear_back_bridge_mat_station',35,92,3,5,5,10,FALSE,240,540,ARRAY[feet_elevated_variant]::UUID[]),
    (feet_elevated_variant,'feet_elevated_bilateral',ARRAY['mat','low_step']::TEXT[],'clear_back_bridge_mat_and_step_station',50,90,3,5,5,10,FALSE,270,570,ARRAY[floor_variant]::UUID[]),
    (one_leg_variant,'floor_one_leg',ARRAY['mat']::TEXT[],'clear_side_specific_back_bridge_mat_station',40,86,2,3,3,5,TRUE,300,660,ARRAY[floor_variant]::UUID[])
  ) v(id,variant_key,equipment_required,station_type,setup_seconds,mi_suitability,prepare_min,prepare_max,mi_min,mi_max,side_specific,prepare_duration,mi_duration,substitution_ids)
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

  INSERT INTO coaching.exercise_section_evidence_v1(
    definition_id,reviewed_card_version,section_key,source_url,source_title,
    source_publisher,source_kind,claims_json,evidence_quality,review_status,
    reviewer_user_id,reviewed_at)
  SELECT canonical_definition,2,s.section_key,s.source_url,s.source_title,
    s.publisher,s.source_kind,jsonb_build_array(
      jsonb_build_object('supported',s.supported_claim,'scope',s.scope),
      jsonb_build_object('limitation',s.limitation,
        'noUniversalIdentityTechniqueSafetyDoseRecoveryOutcomeTransferOrDifficultyClaim',TRUE)),
    s.evidence_quality,'candidate',NULL,NULL
  FROM (VALUES
    ('identity','https://pmc.ncbi.nlm.nih.gov/articles/PMC4769315/','Stretching the Spines of Gymnasts: A Review','Sports Medicine - Open','peer_reviewed_research','Gymnastics terminology commonly uses bridge for a static spine-and-hip hyperextension position supported on hands and feet, while back-bend can also name a standing lowering action.','gymnastics_spine_hyperextension_review','A narrative review does not validate one universal bridge geometry, dose, readiness rule, or injury threshold.',92),
    ('taxonomy','https://mybg.british-gymnastics.org/store/downloadPublic?f=e810bf6f-df1b-4828-957d-6ddafe28f4c6.pdf&t=email','East Midlands Gymnastics for All Rules 2026','British Gymnastics','governing_body','The rules distinguish lying down and pushing to bridge from rocking to stand, kickover, handstand-to-bridge, and walkover actions.','current_regional_governing_body_rules','Competition routine wording is not a universal technique, population, dose, or safety authority.',84),
    ('anatomy','https://pmc.ncbi.nlm.nih.gov/articles/PMC4769315/','Stretching the Spines of Gymnasts: A Review','Sports Medicine - Open','peer_reviewed_research','Bridge and back-bend positions distribute extension across shoulders, thoracic and lumbar spine, hips, and three-dimensional spinal curves.','gymnastics_spine_hyperextension_review','The review does not quantify individual tissue loads or prove that one extension distribution prevents injury.',92),
    ('biomechanics','https://www.tandfonline.com/doi/full/10.1080/10255842.2020.1812841','Contribution of hip extension and lumbar lordosis during back walkover performed by rhythmic and woman artistic gymnasts: a preliminary study','Computer Methods in Biomechanics and Biomedical Engineering','peer_reviewed_research','Back-walkover bridge phases showed different timing and contributions of lumbar lordosis and hip extension among the observed gymnasts.','three_gymnast_preliminary_kinematic_study','Three performers and a dynamic walkover cannot establish ideal static Bridge mechanics or numeric loading.',72),
    ('difficulty','https://www.apunts.org/en-control-flexibilitat-joves-gimnastes-competicio-articulo-resumen-S1886658110000617','Flexibility testing in young competing gymnasts using a trigonometric method: one-year follow-up','Apunts Sports Medicine','peer_reviewed_research','Back Bridge was treated as a multijoint flexibility test affected by back and shoulder behavior in 15 young male gymnasts.','small_longitudinal_gymnast_flexibility_study','The test did not calibrate Vortex complexity or physical-difficulty scores and did not classify readiness.',78),
    ('load_fatigue_recovery','https://pmc.ncbi.nlm.nih.gov/articles/PMC4769315/','Stretching the Spines of Gymnasts: A Review','Sports Medicine - Open','peer_reviewed_research','Gymnastics spine hyperextension exposure varies by position, dynamic entry and exit, training history, growth, alignment, and mobility.','gymnastics_spine_hyperextension_review','The review does not establish safe weekly seconds, fatigue ceilings, recovery hours, or individual injury thresholds.',92),
    ('constraints','https://pmc.ncbi.nlm.nih.gov/articles/PMC7225801/','Spinal range of motion and back pain in female artistic gymnasts during back walkovers and back handsprings','Journal of Athletic Training','peer_reviewed_research','Seventeen female gymnasts showed task- and pain-history-related sagittal spine motion differences during dynamic back walkovers and handsprings.','small_instrumented_dynamic_skill_study','Dynamic skills and a pain-history association do not establish a clinical screen or contraindication for this static card.',88),
    ('dosage','https://www.gymbc.org/media/o4opcs3u/gbc-canjump-manual-1.pdf','CanJump Gymnastics Foundations Trampoline Manual','Gymnastics Canada / Gymnastics BC','governing_body','The foundations manual includes a ten-second Back Bridge hold with straight arms at shoulder width and permits elevated feet if needed.','governing_body_foundations_manual','A single curriculum dose does not establish an optimal workout prescription, recovery interval, or universal readiness rule.',82),
    ('instructions','https://www.gymnasticsontario.ca/wp-content/uploads/2014/12/2015-16-MAG-ON-Prov-L12and3-Rules-Nov20152.pdf','Ontario MAG Provincial Level 1–3 Rules','Gymnastics Ontario','governing_body','The rules score a two-second Back Bridge and identify shoulders over wrists and straight-arm execution as position criteria.','provincial_competition_rules','Judging criteria do not by themselves validate coaching cues, tissue safety, dose, or applicability to every population.',82),
    ('safety_stop_rules','https://pmc.ncbi.nlm.nih.gov/articles/PMC4769315/','Stretching the Spines of Gymnasts: A Review','Sports Medicine - Open','peer_reviewed_research','The review discusses gymnastics hyperextension exposure, back pain, growth, hypermobility, injury context, and risk-management considerations.','gymnastics_spine_hyperextension_review','It does not provide diagnosis, universal stopping thresholds, or proof that a specific cue prevents injury.',92),
    ('programming','https://www.apunts.org/en-control-flexibilitat-joves-gimnastes-competicio-articulo-resumen-S1886658110000617','Flexibility testing in young competing gymnasts using a trigonometric method: one-year follow-up','Apunts Sports Medicine','peer_reviewed_research','Shoulder and multijoint flexibility measures changed at different rates across a season, while Back Bridge test performance did not significantly change.','small_longitudinal_gymnast_flexibility_study','The study does not establish this profile order, frequency, progression, or expected adaptation.',78),
    ('athlete_support','https://ssep.com.au/how-to-correctly-perform-a-gymnastics-bridge/','How to correctly perform a Gymnastics Bridge','Sydney Sports and Exercise Physiology','expert_instruction','The professional article describes static hand-and-foot support, shoulder thoracic hip demands, supported progressions, and the need to avoid assuming all extension comes from one region.','exercise_physiology_instruction','The article is not a governing-body standard or controlled intervention and cannot approve this card wording.',74),
    ('coach_support','https://www.gymnasticsontario.ca/wp-content/uploads/2014/12/2016-17-Section-I-Technical-Rules-and-Regulations.pdf','Canadian Elite Pathways Program Technical Rules','Gymnastics Ontario','governing_body','The pathway separately scores Back Bridge hand width, foot placement, shoulder angle, and a subsequent kickover, supporting exact observation and action boundaries.','governing_body_pathway_rules','Scoring criteria do not authorize one spotting method or universal bridge style.',82),
    ('accessibility','https://www.gymbc.org/media/o4opcs3u/gbc-canjump-manual-1.pdf','CanJump Gymnastics Foundations Trampoline Manual','Gymnastics Canada / Gymnastics BC','governing_body','The manual allows an elevated-feet Back Bridge while retaining a static bridge objective.','governing_body_foundations_manual','Support height changes mechanics and must be selected, recorded, reviewed, and revalidated rather than assumed equivalent.',82),
    ('alternates','https://mybg.british-gymnastics.org/store/downloadPublic?f=e810bf6f-df1b-4828-957d-6ddafe28f4c6.pdf&t=email','East Midlands Gymnastics for All Rules 2026','British Gymnastics','governing_body','Bridge, rock to stand, kickover, handstand-to-bridge, and walkover appear as separately named actions or bonuses.','current_regional_governing_body_rules','The rules do not define every exercise-card boundary or automatic progression order.',84),
    ('media','https://www.youtube.com/watch?v=TrxZLshL0Ec','Do you need to bridge? Here''s my suggestions and progressions for recreational athletes','GMB Fitness (Praxis)','expert_instruction','Current oEmbed metadata supplied a candidate title, channel, thumbnail, and iframe response.','candidate_media_metadata_only','Playback, exact card or variant, entry, support, geometry, hold, exit, captions, accessibility, safety, cue quality, conflicts, reviewer identity, and approval remain unverified.',60)
  ) s(section_key,source_url,source_title,publisher,source_kind,supported_claim,scope,limitation,evidence_quality)
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
    'manual_research',m.source_query,NULL,NULL,'2026-11-02'::TIMESTAMPTZ,
    'YouTube oEmbed returned current metadata on 2026-08-02. This does not establish full playback, exact card or variant, entry, hand and foot support, geometry, height, free-leg side, head contact, hold, exit, captions, accessibility, safety, conflicts, cue quality, reviewer identity, or approval.'
  FROM (VALUES
    ('TrxZLshL0Ec','Do you need to bridge? Here''s my suggestions and progressions for recreational athletes','GMB Fitness (Praxis)','gymnastics back bridge static hold progression'),
    ('aozR72_L16g','Back Bridge Flexibility Transformation (Here''s How)','Strength Side','back bridge flexibility static hold'),
    ('tSvmWU-0Zo0','How To BACK BRIDGE For Beginners (FLEXIBLE & STRONG)','FitnessFAQs','back bridge from floor static support'),
    ('usyrUMFhLUc','How to do a BACKBEND BRIDGE from the ground','Erica Lin','backbend bridge from ground')
  ) m(video_id,title,channel,source_query)
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
  SELECT canonical_definition,2,a.alternate_name,a.classification,a.rationale,
    jsonb_build_object(
      'boundaryKey',a.boundary_key,'factsRequired',a.facts_required,
      'exactEntrySupportGeometryActionHoldAndExitRequired',TRUE,
      'neverInferFromNameOrAthleteRanking',TRUE),
    jsonb_build_object(
      'status','research_queue','classificationCandidate',a.classification,
      'requiredFacts',a.facts_required,
      'humanIdentityAndContentReviewRequired',TRUE,'approvalsCreated',FALSE),
    'candidate',NULL,NULL
  FROM (VALUES
    ('Floor Bilateral Static Back Bridge Hold','same_identity','Exact floor bilateral working specification inside the static Back Bridge identity.','floor_bilateral_variant',jsonb_build_array('supine_entry','palms','feet','head_clear','hold','supine_exit')),
    ('Feet-Elevated Bilateral Static Back Bridge Hold','same_identity','Exact low-step feet-elevated working specification with recorded height and unchanged static hold boundary.','feet_elevated_variant',jsonb_build_array('step','height','palms','feet','hold','exit')),
    ('Floor One-Leg Straight-Up Static Back Bridge Hold','same_identity','Exact side-specific unilateral support variant retaining the static bridge contract.','one_leg_straight_variant',jsonb_build_array('support_foot','free_leg','side','pelvis','hold','exit')),
    ('Hands-Elevated Static Back Bridge Hold','new_variant','Raising the hands changes wrist angle, leverage, range, support interface, and load and requires its own exact reviewed specification.','hands_elevated_variant',jsonb_build_array('support','height','hand_angle','foot_position','hold','exit')),
    ('Bridge Over Cylinder or Exercise Ball','new_variant','Passive torso support changes load distribution, balance, range, failure behavior, and exit and cannot inherit the unsupported hold.','passively_supported_bridge_variant',jsonb_build_array('apparatus','diameter','contact_area','hand_support','foot_support','exit')),
    ('Standing Backbend to Floor','new_definition','Standing rearward lowering adds balance, progressive dynamic spine extension, hand-arrival, fall, spotting, and entry scoring.','static_hold_vs_standing_entry',jsonb_build_array('stance','rearward_lowering','hand_arrival','spotter','bridge','exit')),
    ('Handstand to Bridge','new_definition','A handstand entry adds inversion balance, descent, hand fixation, foot arrival, and dynamic loading before the bridge.','supine_entry_vs_handstand_entry',jsonb_build_array('handstand','descent','feet_arrival','bridge','spotter','finish')),
    ('Bridge Back Kickover','new_definition','Kickover adds unilateral leg drive, split passage, inversion, hand support transition, and standing finish; it remains skill-library performance.','static_hold_vs_kickover',jsonb_build_array('lead_leg','kick','split','hand_support','foot_arrival','stand')),
    ('Back Walkover','new_definition','A Back Walkover includes standing entry, bridge passage, kickover, complete rotation, and lunge finish.','static_hold_vs_back_walkover',jsonb_build_array('standing_entry','bridge_passage','split','kickover','landing','lunge')),
    ('Forward Walkover','new_definition','Forward entry, hand support, split passage, bridge phase, and standing exit form a different complete element.','static_hold_vs_forward_walkover',jsonb_build_array('forward_entry','handstand','split','bridge','stand','direction')),
    ('Bridge Rock to Stand','new_definition','Rocking and returning to stand add momentum, repeated translation, dynamic exit, and a different repetition endpoint.','static_hold_vs_rock_to_stand',jsonb_build_array('rock','momentum','hand_release','foot_support','stand','repetition')),
    ('Bridge Push-Up','new_definition','Prescribed elbow flexion and extension create a dynamic pressing repetition rather than a static hold.','static_hold_vs_bridge_pushup',jsonb_build_array('elbow_flexion','depth','head_clearance','press','repetitions','stop')),
    ('Bridge Walk','new_definition','Moving hands or feet creates locomotion and repeated support transfer rather than fixed contacts.','fixed_support_vs_bridge_walk',jsonb_build_array('direction','hand_steps','foot_steps','distance','turn','finish')),
    ('Head Bridge or Wrestler Bridge','new_definition','Head or neck support fundamentally changes contact, spinal loading, risk, and stop rules.','head_clear_vs_head_supported_bridge',jsonb_build_array('head_contact','neck_load','hand_support','foot_support','hold','exit')),
    ('Forearm Bridge','new_definition','Forearm support changes contact area, elbow position, shoulder angle, range, and exit.','palm_support_vs_forearm_support',jsonb_build_array('forearms','elbows','hands','shoulders','range','exit')),
    ('Crab Reach','new_definition','One-arm crab support with a reach or rotation is a dynamic unilateral action.','static_bridge_vs_crab_reach',jsonb_build_array('supporting_arm','reach_arm','rotation','hip_action','return','repetition')),
    ('Crab Reach Thoracic Bridge','new_definition','The thoracic bridge flow prescribes unilateral reach and rotation rather than a bilateral static hold.','static_bridge_vs_thoracic_reach_flow',jsonb_build_array('reach','rotation','support','hip_extension','return','dose')),
    ('Glute Bridge','new_definition','Glute Bridge retains shoulders on the floor and scores dynamic hip extension without palm support.','gymnastics_bridge_vs_glute_bridge',jsonb_build_array('shoulder_support','hand_support','spine_shape','hip_cycle','repetitions','load')),
    ('Glute Bridge Iso Hold','new_definition','Glute Bridge Iso uses shoulders and feet with a neutral trunk line instead of palms and feet with an arched spine.','gymnastics_bridge_vs_glute_bridge_iso',jsonb_build_array('shoulder_support','palms','trunk_line','hips','hold','exit')),
    ('Single-Leg Glute Bridge','new_definition','The unilateral hip-extension repetition remains shoulder-supported and dynamically cycles the pelvis.','one_leg_back_bridge_vs_single_leg_glute_bridge',jsonb_build_array('orientation','shoulder_support','support_foot','free_leg','hip_cycle','dose')),
    ('Single-Leg Glute Bridge Iso Hold','new_definition','The unilateral shoulder-supported hip-extension hold is not a palm-supported spinal bridge.','one_leg_back_bridge_vs_single_leg_glute_iso',jsonb_build_array('orientation','shoulder_support','support_foot','spine_shape','hold','exit')),
    ('Arch Body Hold or Superman','new_definition','Prone unsupported limb elevation changes orientation, contacts, loading, range, and objective.','four_point_bridge_vs_prone_arch',jsonb_build_array('prone','hand_contact','foot_contact','limb_elevation','hold','exit')),
    ('Arch Hold','new_definition','A prone arch-shape hold is distinct from a hands-and-feet supported back bridge.','four_point_bridge_vs_arch_hold',jsonb_build_array('prone','support','limbs','spine_shape','hold','exit')),
    ('Back Extension or Hip Extension','new_definition','Supported dynamic hinge extension uses a different axis, action, support, range, and repetition boundary.','static_bridge_vs_extension_cycle',jsonb_build_array('apparatus','support','axis','range','extension_cycle','dose')),
    ('Exact Hand and Foot Spacing','modifier_annotation','Spacing is an exact persisted setup fact within a reviewed variant; changing support type or height requires another variant.','support_spacing_annotation',jsonb_build_array('hand_width','hand_to_foot_distance','foot_width','anthropometry','surface','record')),
    ('Hold Duration Within Reviewed Range','modifier_annotation','Seconds are dosage when entry support shape and exit remain unchanged; first-break termination always overrides the target.','hold_seconds_annotation',jsonb_build_array('planned_seconds','valid_seconds','first_fault','rest','sets','fatigue')),
    ('Sets and Rest Adjustment','modifier_annotation','Sets and rest are delivery variables within the reviewed profile and require duration and fatigue-budget recalculation.','sets_rest_annotation',jsonb_build_array('sets','rest','duration','fatigue','quality','recovery')),
    ('Sprung Floor Versus Locked Mat','modifier_annotation','A level stable surface is recorded as an environment/load fact; height slope softness or instability requires a new exact variant.','level_surface_annotation',jsonb_build_array('surface','stiffness','friction','seams','marks','load')),
    ('Qualified Manual Guidance','modifier_annotation','Guidance is a declared delivery support; every contact and assisted second is logged and never proves independent execution.','guidance_annotation',jsonb_build_array('qualification','contact_point','phase','force','reason','result')),
    ('Left Versus Right Support in One-Leg Variant','modifier_annotation','Side is planned rendered and logged within the exact unilateral variant without classifying the athlete.','one_leg_side_annotation',jsonb_build_array('support_foot','free_leg','side_order','seconds','faults','symptoms')),
    ('Bent Free-Leg Back Bridge Hold','new_variant','Changing the free-leg lever from straight-up to bent changes load, balance, geometry, and scoring and requires an exact reviewed variant.','bent_free_leg_variant',jsonb_build_array('support_foot','free_knee_angle','hip_position','side','hold','exit')),
    ('Back Bridge on Beam or Elevated Narrow Surface','new_definition','Narrow elevated support adds beam width, height, fall consequence, spotting, and exact landing or exit requirements.','floor_bridge_vs_beam_bridge',jsonb_build_array('surface_width','height','hand_support','foot_support','fall_zone','exit'))
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
      'revalidate',jsonb_build_array('identity','entry','support','height','side','geometry','head_contact','action','hold','exit','equipment','environment','symptoms','dose','fatigue_budgets','duration','logistics','persistence','skill_link','coach_rendering','athlete_rendering'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'review',NULL,NULL,NULL
  FROM (VALUES
    (floor_variant,feet_elevated_variant,'lateral_substitution',72,ARRAY['range','leverage','stability','complexity']::TEXT[],'Elevating both feet retains the static bridge boundary but changes support height, range, shoulder and spinal distribution, and equipment; it is not universally easier.'),
    (feet_elevated_variant,floor_variant,'lateral_substitution',72,ARRAY['range','leverage','stability','complexity']::TEXT[],'Returning feet to the floor changes range, geometry, load distribution, and station and requires full revalidation.'),
    (floor_variant,one_leg_variant,'progression',70,ARRAY['load','stability','complexity']::TEXT[],'Removing one foot and holding a straight free leg increases unilateral support and position-control demand; readiness is not inferred from difficulty.'),
    (one_leg_variant,floor_variant,'regression',70,ARRAY['load','stability','complexity']::TEXT[],'Restoring bilateral foot support can reduce one balance and load demand while side, geometry, hold, and exit still require review.'),
    (floor_variant,'94204980-597a-4ab9-b759-bc2cfc83d2bb'::UUID,'regression',50,ARRAY['load','range','complexity']::TEXT[],'Prone Arch Hold removes palm-and-foot weight-bearing and can be a different low-load extension objective, not an automatic substitute.'),
    (floor_variant,'01e13d68-1384-46f2-bb81-e2044ce8f353'::UUID,'regression',48,ARRAY['load','range','complexity']::TEXT[],'Glute Bridge Iso removes palm support and large spinal and shoulder extension but changes the exercise objective and identity.'),
    (floor_variant,'59ce1a43-cace-47d2-af14-6abbc7941df7'::UUID,'lateral_substitution',42,ARRAY['stability','range','complexity','decision_demand']::TEXT[],'Crab Reach Thoracic Bridge adds unilateral reach and rotation; use only when the session objective is explicitly changed and revalidated.'),
    (floor_variant,'089c11ea-2f9f-4743-8ff4-e24f4a44f276'::UUID,'lateral_substitution',40,ARRAY['load','range','complexity']::TEXT[],'Back Extension changes support axis and dynamic action; it is only a candidate when the objective changes from static bridge support to extension repetition.')
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
      'Review-only exercise-complexity anchor based on supine entry, exact palm and foot support, height, side, free-leg position, multijoint geometry, breathing, first-break stop, controlled lowering, attention, and supervision.'
    ELSE
      'Review-only physical-difficulty anchor based on bodyweight hand and foot support, wrist shoulder spine hip and leg demands, support height, unilateral load, hold duration, entry and exit control, fatigue, symptoms, and recovery.' END
      ||' This scores the exercise, not athlete proficiency. Variant: '||v.variant_key||'.',
    'review',1,NULL,NULL,
    'Research-informed proposal only; independent anchor comparison and qualified human approval remain required.',NULL
  FROM (VALUES
    (floor_variant,'supine-entry-floor-bilateral-static-hold',68,72,80),
    (feet_elevated_variant,'supine-entry-feet-elevated-bilateral-static-hold',64,70,80),
    (one_leg_variant,'supine-entry-floor-one-leg-straight-up-static-hold',76,78,80)
  ) v(id,variant_key,complexity,physical,anchor_tier)
  CROSS JOIN (VALUES('technicalComplexity'),('absoluteLoadDemand')) d(dimension)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
    proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,reviewed_by=NULL,
    review_notes=EXCLUDED.review_notes,reviewed_at=NULL,updated_at=now();

  UPDATE coaching.exercise_score_v1 SET
    technical_complexity=68,absolute_load_demand=72,
    coordination_demand=58,impact=0,supervision_demand=76,
    base_overall_difficulty=72,
    legacy_scores=coalesce(legacy_scores,'{}'::JSONB)||jsonb_build_object(
      'candidateReassessment',migration_key,
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'exactEntrySupportGeometryHoldAndExitRequired',TRUE,
      'dynamicBackbendKickoverAndWalkoverRemainSeparate',TRUE,
      'skillLibraryLevelsNotCopied',TRUE,
      'independentCalibrationRequired',TRUE,'humanReviewRequired',TRUE,
      'approvalsCreated',FALSE),
    migration_confidence=62,human_review_status='queued',reviewed_by=NULL,
    reviewed_at=NULL,
    review_notes='Research-informed candidate reassessment only. Scores describe exercise complexity and physical difficulty, not athlete proficiency. Exact entry, support, geometry, side, hold, exit, and independent calibration remain required.',
    updated_at=now()
  WHERE exercise_id=16;

  UPDATE coaching.exercise_difficulty_profile SET
    technical=6.8,complexity=6.8,load=7.2,overall=7.2,
    recommended_age_min=NULL,recommended_age_max=NULL,attention_demand='high',
    notes='Candidate exercise complexity and physical difficulty only; exact entry, support, height, side, geometry, hold, and controlled exit required. This is not an athlete proficiency classification.',
    source='canonical_research_candidate',updated_at=now()
  WHERE exercise_id=16;

  UPDATE coaching.exercise SET
    name='Gymnastics Back Bridge Hold',slug='gymnastics-back-bridge-hold',
    skill_level=NULL,age_min=NULL,age_max=NULL,is_published=FALSE,
    why_publish_ready=FALSE,archived=FALSE,
    description='Static gymnastics bridge exercise. Select an exact floor bilateral, feet-elevated bilateral, or floor one-leg straight-up variant with supine entry, declared palms and feet, head clear, timed hold, first-break stop, and controlled supine exit. Kickovers and walkovers remain skill-library performance.',
    instructions='Declare variant, support height, side, hand and foot geometry, surface, assistance policy, sets, hold seconds, rest, cumulative exposure, and stop. Count every valid, invalid, partial, assisted, and incident entry plus valid seconds and first fault.',
    default_sets=2,default_reps=NULL,default_work_seconds=8,
    default_rest_seconds=90,est_seconds_per_set=90,
    card_summary='Static hands-and-feet gymnastics bridge hold; exact entry, support geometry, head-clear contract, timer, first-break stop, and controlled exit are mandatory.',
    coach_language='Verify exact variant, support height and side, palm and foot geometry, mat and step stability, head clearance, elbow and leg contract, breathing, direct sightline, cumulative hand-support and spine-extension exposure, first fault, symptoms, and controlled lowering. Stop before any support, shape, breathing, symptom, or exit fault.',
    athlete_language='Use your assigned hands, feet, height, and side. Press to your bridge, keep your head clear, breathe, and lower on the first shape break or symptom.',
    programming_logic=jsonb_build_object(
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'identityRule','exact_supine_entry_static_hands_and_feet_support_geometry_hold_and_controlled_exit_required',
      'skillLibraryRule','bridge_kickover_handstand_to_bridge_and_walkover_skill_levels_remain_in_skill_cards',
      'loadRule','record every entry valid second support fault assistance and exit plus same-session hand-support overhead and loaded-spine-extension exposure',
      'fatigueRule','combine all Back Bridge Backbend Walkover Kickover Handstand overhead tumbling and spine-extension exposure',
      'substitutionRule','revalidate identity entry support height side geometry objective skill link dose fatigue duration logistics persistence and both renderings',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    scalable_variables=ARRAY[
      'hand_spacing','foot_spacing','exact_low_step_height','hold_seconds','sets',
      'rest','qualified_guidance_role','floor_bilateral_exact_variant',
      'feet_elevated_bilateral_exact_variant','floor_one_leg_exact_variant'
    ]::TEXT[],
    movement_family='Gymnastics static bridge support',
    primary_phase_key='movement_intelligence',
    phase_subrole='gymnastics_shape_form',primary_order_slot='bridge_support',
    programming_kind='exercise',linked_skill_id=NULL,updated_at=now()
  WHERE id=16;

  UPDATE coaching.exercise_safety_profile SET
    risk_level=4,impact_level=1,
    minimum_age_recommended=NULL,minimum_skill_level=NULL,
    requires_spotting=TRUE,requires_coach_supervision='required',
    minimum_prerequisite_notes='Readiness is assessed from current symptoms, exact support tolerance, controlled supine entry and lowering, breathing, communication, equipment, environment, and coach observation; never from an exercise proficiency label.',
    readiness_checks=ARRAY[
      'Exact variant, support height, side, geometry, timer, first-break stop, exit, and assistance policy are understood.',
      'Hands, wrists, elbows, shoulders, neck, spine, hips, knees, ankles, and feet are symptom-free for the exact selected support and range.',
      'The mat, floor, low step if assigned, marks, head-clear zone, and lowering zone are stable and clear.',
      'The athlete can press from supine, keep the head clear, breathe, communicate, stop, and lower under control while the coach sees every support point.'
    ]::TEXT[],
    stop_signs=ARRAY[
      'Pain, numbness, tingling, weakness, pressure symptoms, vision change, dizziness, nausea, faintness, panic, or unusual exertional symptoms.',
      'Palm foot step or free-leg shift, elbow collapse, head neck forearm knee or unplanned body contact, wall partner or coach contact, added rocking pulsing walking kickover or push-up action, breath hold, or shape loss.',
      'The athlete cannot answer the stop command or lower under control, the coach must rescue the exit, or the coach cannot observe every support point.'
    ]::TEXT[],
    contraindications=ARRAY[
      'Current symptoms or conditions for which loaded spine extension or upper-extremity weight-bearing has not been cleared when clearance is appropriate.',
      'No stable exact mat and step if assigned, direct qualified observation, head-clear space, controlled lowering zone, or enforceable one-athlete station.'
    ]::TEXT[],
    common_substitutions=ARRAY[
      'Select the exact floor bilateral or feet-elevated bilateral variant only after full objective and load revalidation.',
      'Use a separately reviewed Arch Hold or Glute Bridge Iso when the objective changes and palm-supported loaded spine extension is not appropriate.',
      'Do not substitute a standing Backbend, Kickover, Walkover, Bridge Push-Up, head-supported bridge, or unreviewed assistance.'
    ]::TEXT[]
  WHERE exercise_id=16;

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  VALUES(
    canonical_definition,1,2,'2.0.0',migration_key,'quarantined',
    jsonb_build_object(
      'identity',jsonb_build_object('passed',TRUE,'identityKey','hands_and_feet_supported_static_spine_hip_extension_hold','legacySources',1,'activeWorkingSpecifications',3,'identityQuarantinedSources',source_ids,'neighborBoundaries',9,'skillLibraryBoundaryExplicit',TRUE),
      'taxonomy',jsonb_build_object('passed',TRUE,'controlledTerms',TRUE,'movementPatterns',jsonb_build_array('push','invert','reach')),
      'anatomy',jsonb_build_object('passed',TRUE,'musclesTissuesJointsActionsPlanesAndLaterality',TRUE,'oneLegSidesLoggedSeparately',TRUE),
      'difficulty',jsonb_build_object('passed',TRUE,'model','max_exercise_complexity_physical_difficulty','athleteProficiency',NULL,'independentCalibrationRequired',TRUE),
      'loadFatigueRecovery',jsonb_build_object('passed',TRUE,'landingContactsPerRep',0,'plannedImpactContacts',0,'entriesValidSecondsFirstFaultsAssistanceAndExitsCounted',TRUE,'cumulativeBridgeHandSupportOverheadAndSpineExtensionExposure',TRUE),
      'constraints',jsonb_build_object('passed',TRUE,'entrySupportHeightSideGeometrySurfacePopulationExitAndSupervision',TRUE),
      'delivery',jsonb_build_object('passed',TRUE,'profiles',6,'prepareAndAccessAndMovementIntelligenceOnly',TRUE,'durationDoseRestStationAndSubstitution',TRUE),
      'instructions',jsonb_build_object('passed',TRUE,'athleteCoachSupport',TRUE,'entrySupportHoldStopExitIncidentAndSkillBoundary',TRUE),
      'research',jsonb_build_object('passed',TRUE,'sections',16,'registryVersion',research_version,'governingBodyProfessionalAndResearchLimitsExplicit',TRUE),
      'media',jsonb_build_object('passed',FALSE,'candidateCount',4,'currentOEmbedMetadataHealthy',TRUE,'playbackReviewed',FALSE,'exactMatchReviewed',FALSE,'captionsReviewed',FALSE,'accessibilityReviewed',FALSE,'qualityReviewed',FALSE,'approvalCreated',FALSE),
      'relationships',jsonb_build_object('passed',FALSE,'reviewOnly',8,'approved',0),
      'calibration',jsonb_build_object('passed',FALSE,'reviewOnly',6,'approved',0),
      'alternates',jsonb_build_object('passed',TRUE,'assessments',32,'dynamicSkillAndSupportBoundariesExplicit',TRUE),
      'generationSupport',jsonb_build_object('passed',TRUE,'selectionConstraints',TRUE,'cumulativeBridgeHandSupportAndSpineExtensionBudgets',TRUE,'duration',TRUE,'equipmentAndStation',TRUE,'substitutionRevalidation',TRUE,'skillLinkWithoutLevelCopy',TRUE,'renderingAndPersistence',TRUE),
      'publication',jsonb_build_object('passed',FALSE,'reviewer',NULL,'approver',NULL)),
    jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01','message','A qualified human must watch every candidate in full and verify exact card and variant, supine entry, palms, feet, support height, side, free-leg position, head clearance, hold boundary, exit, captions, accessibility, safety, cue quality, conflicts, reviewer identity, timestamp, card version, and current playback.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','A qualified coach must approve or reject every progression, regression, and substitution proposal; no automatic transfer from the exercise hold to Backbend, Kickover, Walkover, Handstand, or other skill performance is authorized.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','An independent qualified reviewer must calibrate exercise complexity and physical difficulty. These scores are not athlete proficiency and do not modify skill-library levels.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','A qualified reviewer and separate approver must complete content review before publication. The legacy baseline remains an identity quarantine and every entry, support, height, side, geometry, hold, exit, and skill boundary requires exact review.')),
    TRUE,now())
  ON CONFLICT(definition_id) DO UPDATE SET
    facility_id=EXCLUDED.facility_id,card_version=EXCLUDED.card_version,
    schema_version=EXCLUDED.schema_version,audit_version=EXCLUDED.audit_version,
    status='quarantined',checks_json=EXCLUDED.checks_json,
    blocking_issues_json=EXCLUDED.blocking_issues_json,
    human_review_required=TRUE,checked_at=now();

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=16 AND definition_id=canonical_definition
        AND provenance_json->>'sourceDisposition'='identity_quarantine'
        AND provenance_json->>'representedBySelectableSourceVariant'='false')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source_variant AND status='archived'
        AND requirements_json->>'representation'='identity_quarantine')
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
        WHERE id=ANY(active_variant_ids) AND definition_id=canonical_definition
          AND status='review' AND requirements_json->>'selectable'='true'
          AND difficulty_json->>'technicalMeaning'='exercise_complexity'
          AND difficulty_json->>'loadMeaning'='physical_difficulty'
          AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=greatest(
            (difficulty_json->>'technicalComplexity')::INTEGER,
            (difficulty_json->>'physicalDifficulty')::INTEGER)
          AND (load_profile_json->>'landingContactsPerRep')::INTEGER=0
          AND (load_profile_json->>'plannedImpactContacts')::INTEGER=0)<>3 THEN
    RAISE EXCEPTION '% found invalid source quarantine or working specifications',migration_key;
  END IF;
  IF (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=ANY(active_variant_ids) AND status='review'
        AND cardinality(equipment_required)>0
        AND coalesce(time_model_json->>'durationFormula','')<>''
        AND length(coach_instructions)>=100
        AND length(athlete_instructions) BETWEEN 10 AND 240
        AND cardinality(stop_rules)>=10)<>6
    OR (SELECT count(DISTINCT section_key)
        FROM coaching.exercise_section_evidence_v1
        WHERE definition_id=canonical_definition AND reviewed_card_version=2
          AND review_status='candidate' AND reviewer_user_id IS NULL)<>16
    OR (SELECT count(*) FROM coaching.exercise_media_candidate_v1
        WHERE definition_id=canonical_definition AND reviewed_card_version=2
          AND video_id=ANY(video_ids) AND link_status='healthy'
          AND review_status='candidate' AND embedding_allowed
          AND captions_available IS NULL AND exact_variant_match IS NULL
          AND demonstration_quality_score IS NULL
          AND reviewer_user_id IS NULL AND reviewed_at IS NULL)<>4
    OR (SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
        WHERE definition_id=canonical_definition AND reviewed_card_version=2
          AND review_status='candidate' AND reviewer_user_id IS NULL)<>32 THEN
    RAISE EXCEPTION '% found incomplete profiles, evidence, media, or alternates',migration_key;
  END IF;
  IF (SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE from_variant_id=ANY(active_variant_ids)
        AND review_status='review' AND reviewed_by IS NULL)<>8
    OR (SELECT count(*) FROM coaching.exercise_score_calibration_v1
        WHERE variant_id=ANY(active_variant_ids) AND status='review'
          AND version=1 AND reviewed_by IS NULL)<>6
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
        WHERE survivor_definition_id=canonical_definition
          AND resolved_definition_id=ANY(neighbor_definition_ids)
          AND decision='distinct_exercises' AND reviewed_by IS NULL)<>9 THEN
    RAISE EXCEPTION '% found incomplete graph, calibration, or identity boundaries',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 d
      CROSS JOIN LATERAL unnest(d.movement_patterns) key
      WHERE d.id=canonical_definition AND NOT EXISTS(
        SELECT 1 FROM coaching.movement_pattern a WHERE a.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 d
      CROSS JOIN LATERAL unnest(d.body_regions) key
      WHERE d.id=canonical_definition AND NOT EXISTS(
        SELECT 1 FROM coaching.body_region a WHERE a.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 d
      CROSS JOIN LATERAL unnest(d.required_equipment||d.optional_equipment) key
      WHERE d.id=canonical_definition AND NOT EXISTS(
        SELECT 1 FROM coaching.equipment a WHERE a.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1 r
      WHERE r.from_variant_id=ANY(active_variant_ids)
        AND r.relationship IN('progression','regression')
        AND EXISTS(SELECT 1 FROM unnest(r.dimensions) dimension
          WHERE dimension<>ALL(ARRAY['load','leverage','range','speed','stability','complexity','impact','decision_demand','fatigue']))) THEN
    RAISE EXCEPTION '% created uncontrolled taxonomy or graph dimensions',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise
      WHERE id=16 AND (skill_level IS NOT NULL OR age_min IS NOT NULL OR age_max IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_safety_profile
      WHERE exercise_id=16
        AND (minimum_skill_level IS NOT NULL OR minimum_age_recommended IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition
        AND (reviewed_by IS NOT NULL OR approved_by IS NOT NULL
          OR last_reviewed_at IS NOT NULL OR approved_video_url IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=canonical_definition AND reviewed_card_version=2
        AND (review_status='approved' OR reviewer_user_id IS NOT NULL
          OR reviewed_at IS NOT NULL OR captions_available IS NOT NULL
          OR exact_variant_match IS NOT NULL
          OR demonstration_quality_score IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1
      WHERE from_variant_id=ANY(active_variant_ids)
        AND (review_status='approved' OR reviewed_by IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(active_variant_ids)
        AND (status='approved' OR reviewed_by IS NOT NULL))
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=canonical_definition AND card_version=2
        AND status='quarantined' AND human_review_required
        AND jsonb_array_length(blocking_issues_json)=4) THEN
    RAISE EXCEPTION '% retained or fabricated proficiency, approval, or publication state',migration_key;
  END IF;
END;
$$;
