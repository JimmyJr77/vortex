-- Source 24: consolidate the duplicate tall-posture source and replace both
-- skeletal Neck CARs baselines with exact standing-independent and
-- seated-supported variants. Evidence, media, identity, graph, calibration,
-- and publication state remain candidate/review-only. This migration creates
-- no human approval and no athlete skill, proficiency, or age classification.
DO $migration$
DECLARE
  migration_key CONSTANT TEXT := '495_coaching_neck_cars_identity_and_family_audit_hardening';
  research_version CONSTANT TEXT := '2026-08-02.92';
  canonical_definition UUID;
  duplicate_definition UUID;
  wall_rotation_definition UUID;
  full_body_definition UUID;
  source_variant UUID;
  duplicate_variant UUID;
  wall_rotation_variant UUID;
  full_body_variant UUID;
  standing_variant UUID;
  seated_variant UUID;
  active_variant_ids UUID[];
  all_owned_variant_ids UUID[];
  protected_count INTEGER;
BEGIN
  SELECT definition_id INTO canonical_definition FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=24;
  SELECT id INTO duplicate_definition FROM coaching.exercise_definition_v1 WHERE legacy_exercise_id=897;
  SELECT id INTO wall_rotation_definition FROM coaching.exercise_definition_v1 WHERE legacy_exercise_id=898;
  SELECT definition_id INTO full_body_definition FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=23;
  SELECT id INTO source_variant FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='baseline';
  SELECT id INTO duplicate_variant FROM coaching.exercise_variant_v1 WHERE definition_id=duplicate_definition AND variant_key='baseline';
  SELECT id INTO wall_rotation_variant FROM coaching.exercise_variant_v1 WHERE definition_id=wall_rotation_definition AND variant_key='baseline';
  SELECT id INTO full_body_variant FROM coaching.exercise_variant_v1 WHERE definition_id=full_body_definition AND variant_key='standing-independent-eight-region-sequence';
  SELECT id INTO standing_variant FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='standing-independent-complete-cervical-car';
  standing_variant := coalesce(standing_variant,gen_random_uuid());
  SELECT id INTO seated_variant FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='seated-supported-complete-cervical-car';
  seated_variant := coalesce(seated_variant,gen_random_uuid());
  active_variant_ids := ARRAY[standing_variant,seated_variant];
  all_owned_variant_ids := ARRAY[source_variant,duplicate_variant,standing_variant,seated_variant];

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=24 AND facility_id=1)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=897 AND facility_id=1)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=898 AND facility_id=1)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition AND facility_id=1 AND legacy_exercise_id=24)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=duplicate_definition AND facility_id=1 AND legacy_exercise_id=897)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=wall_rotation_definition AND facility_id=1 AND legacy_exercise_id=898)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=full_body_definition AND facility_id=1 AND card_version=2)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=24 AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=897
        AND definition_id IN(canonical_definition,duplicate_definition))
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source_variant AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=duplicate_variant AND definition_id=duplicate_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=wall_rotation_variant AND definition_id=wall_rotation_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=full_body_variant AND definition_id=full_body_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1 WHERE exercise_id=24)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1 WHERE exercise_id=897)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_difficulty_profile WHERE exercise_id=24)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_difficulty_profile WHERE exercise_id=897)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_safety_profile WHERE exercise_id=24)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_safety_profile WHERE exercise_id=897) THEN
    RAISE EXCEPTION '% prerequisite source or neighbor rows are missing',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=ANY(active_variant_ids) AND definition_id<>canonical_definition)
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE slug='neck-cars' AND id<>canonical_definition) THEN
    RAISE EXCEPTION '% working UUID or slug already belongs to another card',migration_key;
  END IF;

  SELECT coalesce(sum(n),0) INTO protected_count FROM (
    SELECT count(*) n FROM coaching.exercise_definition_v1
      WHERE id IN(canonical_definition,duplicate_definition)
        AND (status IN('published','deprecated') OR reviewed_by IS NOT NULL
          OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)
    UNION ALL SELECT count(*) FROM coaching.exercise_section_evidence_v1
      WHERE definition_id IN(canonical_definition,duplicate_definition)
        AND (reviewer_user_id IS NOT NULL
          OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id IN(canonical_definition,duplicate_definition)
        AND (reviewer_user_id IS NOT NULL OR reviewed_at IS NOT NULL
          OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id IN(canonical_definition,duplicate_definition)
        AND (reviewer_user_id IS NOT NULL
          OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_card_review_v1
      WHERE definition_id IN(canonical_definition,duplicate_definition)
    UNION ALL SELECT count(*) FROM coaching.exercise_card_revision_v1
      WHERE definition_id IN(canonical_definition,duplicate_definition)
    UNION ALL SELECT count(*) FROM coaching.exercise_media_review_v1
      WHERE definition_id IN(canonical_definition,duplicate_definition)
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
      WHERE (survivor_definition_id IN(canonical_definition,duplicate_definition)
          OR resolved_definition_id IN(canonical_definition,duplicate_definition))
        AND (reviewed_by IS NOT NULL OR resolution_source='human_review')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_v1
      WHERE exercise_id IN(24,897)
        AND (human_review_status<>'queued' OR reviewed_by IS NOT NULL
          OR reviewed_at IS NOT NULL)
  ) protected;
  IF protected_count<>0 THEN
    RAISE EXCEPTION '% refuses to overwrite % human-reviewed records',migration_key,protected_count;
  END IF;

  UPDATE coaching.exercise_section_evidence_v1 SET
    review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now()
  WHERE definition_id IN(canonical_definition,duplicate_definition)
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_media_candidate_v1 SET
    review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
    exact_variant_match=NULL,demonstration_quality_score=NULL,updated_at=now()
  WHERE definition_id IN(canonical_definition,duplicate_definition)
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_alternate_assessment_v1 SET
    review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now()
  WHERE definition_id IN(canonical_definition,duplicate_definition)
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
        'sourceDisposition','canonical_survivor_reauthored',
        'sourceInterpretation','source 24 names cervical circles and nods but omits exact base composite path direction compensation symptom duration and persistence contracts',
        'exactWorkingSpecifications',jsonb_build_array(
          'standing_independent_complete_cervical_car',
          'seated_supported_complete_cervical_car'),
        'researchSources',jsonb_build_array(
          'https://www.acefitness.org/continuing-education/certified/october-2024/8725/controlled-articular-rotations-shifting-mobility-into-high-gear/',
          'https://markowtrainingsystems.com/wp-content/uploads/2020/02/2020KinstretchStarterPack.pdf',
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC12620902/',
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC6341704/'),
        'exerciseDifficultyDescribesTaskOnly',TRUE,
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=24 AND definition_id=canonical_definition;

  DELETE FROM coaching.exercise_definition_source_v1
  WHERE legacy_exercise_id=897 AND definition_id=duplicate_definition;
  INSERT INTO coaching.exercise_definition_source_v1(
    definition_id,legacy_exercise_id,source_kind,provenance_json)
  VALUES(canonical_definition,897,'duplicate_consolidation',
    jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'sourceDisposition','duplicate_consolidated_into_source_24_survivor',
      'retiredDefinitionId',duplicate_definition,
      'retiredVariantId',duplicate_variant,
      'identityReason','tall stacked posture is required setup and quality for the same complete cervical CAR path rather than a different scored action',
      'legacyAgeAndPublicationClaimsUnsupported',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE))
  ON CONFLICT(legacy_exercise_id) DO UPDATE SET
    definition_id=EXCLUDED.definition_id,source_kind='duplicate_consolidation',
    provenance_json=EXCLUDED.provenance_json;

  UPDATE coaching.exercise_delivery_profile_v1 SET status='archived',updated_at=now()
  WHERE variant_id IN(source_variant,duplicate_variant);

  UPDATE coaching.exercise_variant_v1 SET
    variant_key=CASE id WHEN source_variant THEN 'identity-quarantine-source-24'
      ELSE 'identity-quarantine-duplicate-source-897' END,
    display_name=CASE id WHEN source_variant THEN 'Neck CARs Legacy Skeleton — Source 24'
      ELSE 'Neck CARs with Tall Posture Duplicate Skeleton — Source 897' END,
    modifier_keys='{}'::TEXT[],difficulty_json='{}'::JSONB,status='archived',
    requirements_json=jsonb_build_object(
      'selectable',FALSE,'representation','superseded_source_skeleton',
      'sourceLegacyExerciseId',CASE id WHEN source_variant THEN 24 ELSE 897 END,
      'archiveReason',CASE id WHEN source_variant THEN
        'exact base composite cervical path direction compensation symptom duration and persistence contracts were missing'
        ELSE 'duplicate tall-posture label supplies setup quality for the source-24 survivor and no distinct repetition contract' END,
      'replacementVariantIds',to_jsonb(active_variant_ids),
      'survivorDefinitionId',canonical_definition,
      'humanReviewRequired',TRUE),
    load_profile_json=jsonb_build_object('selectable',FALSE),
    fatigue_profile_json=jsonb_build_object('selectable',FALSE),
    programming_profile_json=jsonb_build_object(
      'selectionStatus','superseded_source_skeleton','selectable',FALSE,
      'publicationQuarantined',TRUE),updated_at=now()
  WHERE id IN(source_variant,duplicate_variant);

  UPDATE coaching.exercise_definition_v1 SET
    status='archived',approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,
    last_reviewed_at=NULL,
    provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'sourceDisposition','duplicate_definition_archived',
      'survivorDefinitionId',canonical_definition,
      'identityReason','tall posture is setup quality within the same complete cervical CAR repetition',
      'selectable',FALSE,'publicationQuarantined',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),updated_at=now()
  WHERE id=duplicate_definition;

  INSERT INTO coaching.exercise_definition_v1(
    id,facility_id,legacy_exercise_id,slug,canonical_name,display_name,aliases,
    description,family_key,schema_version,card_version,status,
    content_confidence,scoring_confidence,media_confidence,movement_patterns,
    body_regions,required_equipment,optional_equipment,environment_json,
    population_json,provenance_json,approved_video_url,reviewed_by,approved_by,
    last_reviewed_at,anatomy_json,athlete_support_json,coach_support_json,
    support_operations_json)
  VALUES(
    canonical_definition,1,24,'neck-cars','Neck CARs','Neck CARs',
    ARRAY['Cervical CARs','Cervical Controlled Articular Rotations','Neck Controlled Articular Rotations','Neck CARs with Tall Posture'],
    'From the exact standing-independent or seated-supported base, organize the thorax and shoulders without rigidly forcing posture. Slowly trace one continuous active cervical loop through comfortable flexion, lateral flexion, extension within the available symptom-free range, opposite lateral flexion, and rotation, then return to neutral. Complete the opposite direction without momentum, forced range, or material movement of the thorax, shoulders, jaw, or base. Record each direction separately; a nod-only or rotation-only repetition is a different exercise.',
    'cervical_joint_cars','2.0.0',2,'review',
    80,60,50,ARRAY['rotate']::TEXT[],ARRAY['neck','spine']::TEXT[],
    '{}'::TEXT[],ARRAY['box_or_chair_optional']::TEXT[],
    jsonb_build_object(
      'surface','flat dry stable nonslip floor with clear standing and seated exit',
      'space','one stationary head and arm-clearance station without overhead or side obstruction',
      'stationCapacity',1,
      'standingBase','feet placed at the declared width with balance maintained independently',
      'seatedBase','stable inspected box or chair that does not roll tip slide or obstruct a safe exit',
      'controlledEquipmentKey','box_or_chair_optional',
      'coachSightline','front and side views sufficient to observe head-on-thorax path shoulders jaw balance symptoms and return to neutral',
      'inspection',jsonb_build_array('floor traction and clutter','seat stability height and exit when selected','head clearance','cross traffic','communication and emergency route'),
      'changeRule','Changing base support path direction range dose symptoms equipment space or downstream cervical loading requires complete selection dose duration logistics substitution persistence and rendering revalidation.'),
    jsonb_build_object(
      'exerciseCardDoesNotClassifyAthletes',TRUE,'readinessIsWorkoutInput',TRUE,
      'readinessFacts',jsonb_build_array('can maintain the exact standing or seated base','can understand the demonstrated path and both directions','can move through a comfortable controllable active cervical range','can report pain radiating symptoms headache dizziness visual change numbness tingling weakness nausea and balance disturbance','can stop and return to neutral on command'),
      'excludeOrReferPerFacilityPolicy',jsonb_build_array('recent trauma or current severe progressive or radiating neck symptoms','new neurologic findings numbness tingling weakness unsteady gait dizziness visual disturbance unusual headache faintness or nausea','marked protective restriction or a clinical restriction conflicts with active cervical motion','safe base space communication supervision or exit is unavailable'),
      'clinicalScope','This exercise is not diagnosis cervical clearance normal-range testing vestibular treatment or individualized injury care.',
      'noUniversalEligibilityAgeReadinessDiagnosisTreatmentOrOutcomeClaimed',TRUE),
    jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'canonicalAuthoredFromResearch',TRUE,'legacySources',jsonb_build_array(24,897),
      'duplicateDefinitionArchived',duplicate_definition,
      'primaryIdentitySource','https://www.acefitness.org/continuing-education/certified/october-2024/8725/controlled-articular-rotations-shifting-mobility-into-high-gear/',
      'identityContract','complete_slow_active_cervical_multiplanar_loop_both_directions_from_exact_declared_base_with_head_relative_to_stable_thorax_and_neutral_finish',
      'controlledTaxonomyDecision',jsonb_build_object('movementPatterns',jsonb_build_array('rotate'),'bodyRegions',jsonb_build_array('neck','spine'),'seatedEquipment','box_or_chair_optional','mobilityRemainsPurposeNotControlledMovementPattern',TRUE),
      'researchSources',jsonb_build_array(
        'https://www.acefitness.org/continuing-education/certified/october-2024/8725/controlled-articular-rotations-shifting-mobility-into-high-gear/',
        'https://markowtrainingsystems.com/wp-content/uploads/2020/02/2020KinstretchStarterPack.pdf',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC12620902/',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC6341704/'),
      'confidenceBySection',jsonb_build_object('identity',80,'taxonomy',82,'anatomy',76,'difficulty',60,'load',64,'fatigueRecovery',58,'constraints',82,'dosage',58,'instructions',78,'alternates',84,'media',50),
      'unresolvedClaims',jsonb_build_array('one universal geometrically perfect path or normal range','universal extension policy dose frequency eligibility recovery or outcome','injury prevention cervical health or readiness clearance','numeric difficulty calibration','media playback exact path base directions captions accessibility cue quality safety conflicts reviewer and approval'),
      'externalPlaybackVerificationPerformed',FALSE,'sourceLimitationsExplicit',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,'publicationQuarantined',TRUE),
    NULL,NULL,NULL,NULL,
    jsonb_build_object(
      'primaryMuscles',jsonb_build_array('deep cervical flexors including longus colli and longus capitis','cervical extensors including splenius and semispinalis groups','sternocleidomastoid and scalenes across direction-specific roles'),
      'secondaryMuscles',jsonb_build_array('suboccipital muscles','upper trapezius and levator scapulae as direction-dependent contributors','thoracic extensors and abdominal wall for base control'),
      'stabilizers',jsonb_build_array('deep segmental cervical stabilizers','scapular stabilizers','thoracic and lumbopelvic postural musculature','standing foot ankle and hip stabilizers in the standing variant'),
      'joints',jsonb_build_array('occiput-atlas region','atlantoaxial region','subaxial cervical spine','cervicothoracic junction as a monitored compensation boundary'),
      'jointActions',jsonb_build_array('cervical flexion','left and right lateral flexion','comfortable cervical extension without forcing','left and right axial rotation','continuous multi-planar composite loop rather than a ball-and-socket circumduction claim'),
      'planes',jsonb_build_array('sagittal','frontal','transverse','multi-planar composite path'),
      'laterality','one complete loop in each direction with left and right lateral and rotation components; directions are persisted separately',
      'supportContacts',jsonb_build_array('both feet on the floor for standing independent','pelvis and feet supported by a stable box or chair for seated supported'),
      'compensationBoundary','Observe head motion relative to the thorax; reduce range or stop when the thorax shoulders jaw or base materially substitute for the cervical path. Coupled cervical motion and individual range variability are expected; no perfect geometric circle is required.',
      'evidenceBoundary','The cervical motion study describes asymptomatic-adult variability and coupled or compensatory strategies, not a universal normal range, safe endpoint, exercise outcome, or exact CAR prescription.'),
    jsonb_build_object(
      'whyItMatters','Provides a reproducible low-load cervical mobility and control task when the workout calls for a complete active multi-planar neck path rather than isolated rotation, nodding, stretching, or clinical assessment.',
      'primaryCue','Keep the base quiet, move slowly through your comfortable range, complete the whole path in each direction, and return to neutral.',
      'expectedSensations',jsonb_build_array('light muscular effort around the neck','a comfortable active range that may differ by direction','mild postural effort to keep the thorax and shoulders quiet'),
      'unexpectedSensations',jsonb_build_array('sharp increasing or radiating pain','unusual headache dizziness faintness nausea or visual change','numbness tingling weakness unsteady balance or loss of coordination','pinching guarding forced range or symptoms that persist after returning to neutral'),
      'painGuidance','Stop immediately, return to a supported neutral position, tell the coach, and follow facility escalation policy. Do not repeat the motion to test symptoms or force through a restricted direction.',
      'selfChecks',jsonb_build_array('base matches the selected variant','motion stays slow and momentum-free','the full path and direction are understood','range remains comfortable and controllable','thorax shoulders and jaw stay reasonably quiet','neutral is regained after every circle','all partial invalid or symptom-limited attempts are reported'),
      'accessibility',jsonb_build_array('seated-supported exact variant','smaller comfortable range','one demonstrated segment at a time before joining the full loop','visual path and direction cue','verbal or tactile-free orientation cue','fewer circles slower pace and more rest','select a distinct non-moving or clinician-directed task when active cervical motion is inappropriate'),
      'mediaAlternatives',jsonb_build_array('written path sequence','coach front and side demonstration','still images for neutral and path checkpoints','auditory direction prompts'),
      'notReadinessSkillAgeOrClinicalClassification',TRUE),
    jsonb_build_object(
      'observationChecklist',jsonb_build_array('exact standing or seated base','starting neutral and stacked but unforced posture','path order and both directions','head relative to thorax','shoulder jaw and trunk compensation','momentum breath holding and forced range','symptoms balance communication and neutral return','actual circles partial invalid attempts duration and exit'),
      'faultCorrections',jsonb_build_object(
        'momentum_or_rushing','reduce range and speed; restart only if the path is controllable',
        'thorax_or_shoulder_substitution','stabilize the base or use the exact seated-supported variant after full revalidation',
        'jaw_tension_or_breath_holding','pause at neutral relax the jaw and breathe normally; do not force another repetition',
        'path_omission_or_direction_confusion','re-demonstrate the segment and record the attempt as partial; do not count it as a complete circle',
        'pain_neurologic_dizziness_or_visual_symptom','stop and escalate without diagnosis or a test repetition'),
      'demonstrationPlan','Show the exact base, neutral, slow full composite path in each direction, comfortable extension policy, material compensation, partial invalid repetition, symptom stop, and safe exit. Do not demonstrate forced range or label range as normal.',
      'groupManagement',jsonb_build_array('one athlete per clear station','seat-supported stations placed where coaches retain front and side sightlines','announce direction before movement','do not run as a speed or range competition','record every symptom stop and support change'),
      'modificationDecisionTree',jsonb_build_array('stop and escalate for warning symptoms or trauma context','reduce range','reduce circles','slow pace and increase rest','select seated-supported only after equipment and base revalidation','select an isolated distinct card only when that is the intended task','route diagnosis treatment and clearance questions per facility policy'),
      'doNotUseWhen',jsonb_build_array('warning symptoms or trauma require clinical evaluation','the exact base cannot be maintained safely','the full composite path is not the intended task','the participant cannot understand or report the stop criteria','assessment treatment or clearance is the purpose'),
      'noDiagnosisTreatmentGuaranteedTransferOrNormalRangeClaim',TRUE),
    jsonb_build_object(
      'issueCategories',jsonb_build_array('identity path direction or base mismatch','symptom red-flag or incident response','equipment floor space traffic or sightline defect','dose duration fatigue or downstream cervical-load mismatch','instruction media accessibility or rendering conflict','clinical scope or escalation error'),
      'supportEscalation',jsonb_build_object('urgent','stop stabilize and follow emergency policy for acute neurologic severe pain faintness fall or other urgent concerns','clinical','route trauma symptom diagnosis eligibility treatment and return questions to qualified care per facility policy','content','quarantine conflicting identity anatomy range cue dose media or safety content until qualified review'),
      'retentionPolicy','Persist definition variant base planned and actual circles by direction range modifications valid invalid partial and symptom-limited attempts first fault symptoms stop reason rest duration substitution and library generator rendering versions under facility policy.',
      'changeImpactPolicy','Any base path action direction range dose symptom equipment support media identity or stop-rule change invalidates cached selection dose duration logistics substitution persistence and coach and athlete rendering and requires full revalidation.',
      'feedbackChannels',jsonb_build_array('athlete comfort symptom balance and clarity report','coach path compensation first-fault and station report','support incident content and media-review queue'),
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
  SELECT v.id,canonical_definition,v.variant_key,v.display_name,v.modifier_keys,
    jsonb_build_object(
      'technicalComplexity',v.complexity,'exerciseComplexity',v.complexity,
      'absoluteLoadDemand',v.physical,'physicalDifficulty',v.physical,
      'coordinationDemand',v.coordination,'supervisionDemand',v.supervision,
      'failureConsequence',v.failure,'impact',1,'workCapacityDemand',v.capacity,
      'baseOverallDifficulty',greatest(v.complexity,v.physical),
      'overallFormula','max(exercise_complexity,physical_difficulty)',
      'technicalMeaning','exercise_complexity','loadMeaning','physical_difficulty',
      'independentCalibrationRequired',TRUE,'approvalsCreated',FALSE),
    jsonb_build_object(
      'selectable',TRUE,'base',v.base,'support',v.support,
      'equipment',to_jsonb(v.equipment),
      'startPosition','neutral_head_over_quiet_thorax_with_jaw_and_shoulders_relaxed',
      'actionSequence',jsonb_build_array('comfortable_flexion','lateral_flexion','comfortable_extension_without_forcing','opposite_lateral_flexion','axial_rotation_components','neutral_return'),
      'directionRule','one_complete_loop_each_direction_recorded_separately',
      'validCompletion','one continuous slow controllable full composite path in the declared direction with exact base no material thorax shoulder jaw or base substitution no warning symptoms and neutral return',
      'invalidCompletion',jsonb_build_array('path_segment_or_direction_omitted','momentum_or_rushing','forced_or_symptom_provoking_range','material_thorax_shoulder_jaw_or_base_compensation','base_or_balance_loss','warning_symptom','neutral_return_missed'),
      'rangePolicy','available comfortable active range; no universal normal range or geometric circle required',
      'clinicalAssessmentOrTreatment',FALSE,'humanReviewRequired',TRUE),
    'review',
    jsonb_build_object(
      'loadingType','unloaded_active_cervical_multiplanar_control',
      'externalLoadMethod','bodyweight_head_mass_with_'||v.support,
      'gripDemand',1,'spinalLoading',4,'eccentricStress',3,
      'landingContactsPerRep',0,'handImpactContactsPerRep',0,'impactClass','none',
      'primaryExposure',jsonb_build_array('active_cervical_multiplanar_range','head_on_thorax_control','direction_reversal','base_postural_control'),
      'tracking',jsonb_build_array('variant','base','direction','planned_and_actual_circles','range_modification','tempo','voluntary_tension','compensation','symptoms','duration','same_session_cervical_loading')),
    jsonb_build_object(
      'localMuscleFatigue',v.local_fatigue,'gripFatigue',1,
      'technicalFatigueSensitivity',v.technical_fatigue,
      'impactAccumulation',1,'recoveryHours',2,
      'primaryFatigueSites',jsonb_build_array('cervical_movers_and_stabilizers','thoracic_and_scapular_postural_muscles',CASE WHEN v.id=standing_variant THEN 'standing_balance_system' ELSE 'seated_postural_system' END,'attention'),
      'cumulativeBudget',jsonb_build_object('cervicalCircles',12,'activeEndRangeSeconds',180,'technicalSensitivity',v.technical_fatigue,'impact',1),
      'interference',jsonb_build_array('fatiguing_or_loaded_neck_training','contact_sport_or_inversion_work_with_cervical_demand','symptom_provoking_mobility_or_clinical_care','fatigue_that_changes_balance_or_head_control'),
      'recoveryIsPlanningEstimate',TRUE),
    jsonb_build_object(
      'trainingStimuli',jsonb_build_array('active_cervical_range_control','multi_planar_path_awareness','head_on_thorax_coordination','low_load_postural_control'),
      'stimulusDose',jsonb_build_object('sets',jsonb_build_array(1,2),'circlesPerDirection',jsonb_build_array(1,3),'tempo','slow_deliberate_continuous_no_momentum','restSeconds',jsonb_build_array(0,60)),
      'weeklyExposure',jsonb_build_object('minimum',0,'maximumWithoutReview',7,'unit','sessions','contextDependent',TRUE),
      'prerequisites',jsonb_build_array('exact_base_safe','understands_path_directions_and_stop_prompts','comfortable_controllable_active_cervical_motion','can_return_to_neutral','no_conflicting_warning_symptom_or_restriction'),
      'completionCriteria',jsonb_build_array('full_path_each_direction','slow_no_momentum_control','comfortable_range','material_compensation_absent','neutral_return','no_warning_symptom'),
      'sequenceRules',jsonb_build_array('prepare_or_restore_context_only','complete_each_direction_separately','do_not_count_partial_or_rotation_only_attempts','revalidate_downstream_cervical_loading'),
      'pairingCompatibility',jsonb_build_object('compatible',jsonb_build_array('low_load_breathing','light_general_preparation_when_cervical_budget_allows'),'avoid',jsonb_build_array('loaded_neck_work','fatiguing_contact_or_inversion_work','symptom_provoking_cervical_tasks','time_critical_output_when_this_drill_displaces_priority_work')),
      'interferenceRules',jsonb_build_array('count_all_same_session_cervical_end_range_and_loaded_exposure','stop_before_path_or_base_control_changes','select_a_distinct_card_instead_of_omitting_actions'),
      'uncertaintyPolicy','When exact base path direction symptoms scope or dose is uncertain do not select; request clarification or choose a separately validated non-cervical task.',
      'selectionStatus','review_only_machine_complete','publicationQuarantined',TRUE,
      'exerciseDifficultyDescribesTaskOnly',TRUE,'approvalsCreated',FALSE)
  FROM (VALUES
    (standing_variant,'standing-independent-complete-cervical-car','Neck CARs — Standing Independent',ARRAY['standing','independent']::TEXT[],28,4,28,18,20,5,6,30,'standing_independent','independent_no_external_support',ARRAY['none']::TEXT[]),
    (seated_variant,'seated-supported-complete-cervical-car','Neck CARs — Seated Supported',ARRAY['seated','supported']::TEXT[],24,3,24,14,16,4,4,26,'seated_supported','stable_box_or_chair_with_feet_supported',ARRAY['box_or_chair_optional']::TEXT[])
  ) v(id,variant_key,display_name,modifier_keys,complexity,physical,coordination,supervision,failure,capacity,local_fatigue,technical_fatigue,base,support,equipment)
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
  SELECT p.id,p.variant_id,p.profile_key,p.phase_key,p.role,
    CASE p.phase_key WHEN 'prepare_and_access' THEN
      'Use the exact cervical CAR as a low-load mobility and control task before work that does not conflict with current symptoms or same-session neck loading.'
    ELSE 'Use a low controlled dose to restore comfortable active cervical movement options without treating symptoms or displacing needed clinical care.' END,
    CASE p.phase_key WHEN 'prepare_and_access' THEN
      CASE WHEN p.variant_id=standing_variant THEN 88 ELSE 84 END
    ELSE CASE WHEN p.variant_id=seated_variant THEN 82 ELSE 76 END END,
    CASE p.phase_key WHEN 'prepare_and_access' THEN 84 ELSE 72 END,
    jsonb_build_object('mobility',94,'movement_control',92,
      'balance',CASE WHEN p.variant_id=standing_variant THEN 42 ELSE 12 END,
      'recovery',CASE WHEN p.phase_key='restore' THEN 82 ELSE 58 END),
    jsonb_build_object('sets',jsonb_build_array(1,2),
      'circlesPerDirection',jsonb_build_array(1,3),
      'tempo','slow_deliberate_continuous_no_momentum',
      'restSeconds',jsonb_build_array(0,60),'bothDirectionsRequired',TRUE,
      'range','comfortable_controllable_active_range_without_forcing'),
    'The exact base is stable; one complete slow controllable path occurs in each direction; range remains comfortable; the head moves relative to a quiet thorax without material shoulder jaw or base substitution; neutral is regained; and no warning symptom occurs.',
    ARRAY['Sharp, increasing, severe, or radiating neck pain; pinching, guarding, or participant stop request.',
      'Unusual headache, dizziness, faintness, nausea, visual change, unsteady gait, or balance loss.',
      'Numbness, tingling, weakness, new neurologic symptom, or inability to communicate clearly.',
      'Recent trauma or a clinical restriction becomes known and conflicts with active cervical motion.',
      'Momentum, forced range, breath holding, or thorax, shoulder, jaw, or base compensation cannot be corrected by reducing range or pace.',
      'The selected standing or seated base, chair or box, floor, clearance, traffic, sightline, communication, or exit becomes unsafe.',
      'The planned circle, active-end-range, technical-fatigue, duration, or same-session cervical-loading budget is reached.',
      'The task would become rotation-only, nod-only, passive, resisted, vestibular, clinical assessment or treatment, or another exercise identity.']::TEXT[],
    'Verify the exact base, stable station, symptoms and trauma context, full path, directions, planned circles, downstream cervical loading, communication, and stop process. Demonstrate front and side, announce direction, observe head relative to thorax plus shoulder jaw and base compensation, and record partial or invalid attempts, symptoms, substitutions, and actual duration. Do not diagnose, force range, or label range as normal.',
    'Use the shown base. Move slowly through a full neck path in each direction while your torso stays quiet. Return to neutral. Stop for pain, headache, dizziness, visual change, numbness, tingling, weakness, nausea, or balance loss.',
    'More consistent low-load active cervical path control in the exact selected base; no treatment, normal-range, injury-prevention, readiness, structural, or performance outcome is guaranteed.',
    CASE WHEN p.variant_id=standing_variant THEN ARRAY['none']::TEXT[]
      ELSE ARRAY['box_or_chair_optional']::TEXT[] END,
    jsonb_build_object('stationCapacity',1,
      'base',CASE WHEN p.variant_id=standing_variant THEN 'standing_independent' ELSE 'seated_supported' END,
      'seatRequired',p.variant_id=seated_variant,'seatInspectionRequired',p.variant_id=seated_variant,
      'space','stationary_one_person_head_clearance','setupSeconds',CASE WHEN p.variant_id=standing_variant THEN 15 ELSE 25 END,
      'directionChangeSeconds',5,'coachSightline','front_and_side',
      'crossTrafficProhibited',TRUE,'safeExitRequired',TRUE,
      'revalidateAfterAnyChange',TRUE),
    CASE WHEN p.variant_id=standing_variant THEN ARRAY[seated_variant]::UUID[]
      ELSE ARRAY[standing_variant]::UUID[] END,
    'review',
    jsonb_build_object(
      'durationFormula','setup_seconds + sum(actual_circles * seconds_per_circle) + direction_change_seconds + rest_seconds + invalid_or_partial_attempt_seconds + symptom_response_seconds + substitution_seconds + safe_exit_seconds',
      'secondsPerCircle',jsonb_build_array(8,20),'directionCount',2,
      'minimumSeconds',45,'typicalSeconds',120,'maximumSecondsWithoutReview',300,
      'includeActualNotPlanned',TRUE,'recomputeAfterSubstitution',TRUE),
    jsonb_build_object(
      'regressionOrder',jsonb_build_array('reduce_range','reduce_to_one_circle_each_direction','slow_pace','increase_rest',CASE WHEN p.variant_id=standing_variant THEN 'select_seated_supported_exact_variant_after_revalidation' ELSE 'stop_and_select_a_distinct_nonmoving_or_clinician_directed_task' END),
      'progressionOrder',jsonb_build_array('complete_one_quality_circle_each_direction','increase_to_two_or_three_only_if_controlled','select_standing_independent_only_by_variant_change_after_balance_revalidation'),
      'neverScaleByForcingRangeOrAddingSpeedResistanceOrSymptoms',TRUE),
    jsonb_build_object('record',jsonb_build_array('definition_and_variant','base_and_equipment','planned_and_actual_circles_by_direction','range_tempo_and_tension_annotations','valid_invalid_partial_and_symptom_limited_attempts','first_fault','compensation','symptoms_and_stop_reason','rest','duration','substitution'),
      'validUnit','one_complete_composite_path_in_one_declared_direction_returning_to_neutral',
      'completeSetRequiresBothDirections',TRUE),
    jsonb_build_object('athlete',jsonb_build_array('exact_base','full_path_and_direction','comfortable_range','quiet_thorax_and_shoulders','neutral_return','symptom_stop'),
      'coach',jsonb_build_array('trauma_and_symptom_context','station_and_base','head_on_thorax_path','compensation_and_first_fault','clinical_scope','logging_and_escalation'),
      'accessibility',jsonb_build_array('front_and_side_demonstration','written_path','visual_direction_marker','seated_supported_exact_variant','smaller_range_fewer_circles_and_rest','nonmoving_alternative'))
  FROM (VALUES
    ('31183481-708b-484d-804e-276bc5834370'::UUID,standing_variant,'prepare-standing-complete-neck-car','prepare_and_access','primary'),
    ('455a20ee-f99c-4b37-b2df-220e20204b72'::UUID,standing_variant,'restore-standing-low-dose','restore','secondary'),
    ('8d7a4096-01a9-41f4-b620-4d13101e1bdf'::UUID,seated_variant,'prepare-seated-complete-neck-car','prepare_and_access','secondary'),
    ('980d1710-0550-4d09-aa32-aa83a817a62b'::UUID,seated_variant,'restore-seated-low-dose','restore','primary')
  ) p(id,variant_id,profile_key,phase_key,role)
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
  VALUES
    (1,canonical_definition,duplicate_definition,'duplicate_consolidated',
      'Neck CARs with Tall Posture performs the same complete slow active cervical CAR path. Tall stacked posture is required setup and quality for the survivor rather than a different scored action, support contract, or endpoint.',
      jsonb_build_object('migration',migration_key,
        'identityBoundary','source_24_neck_cars_vs_source_897_tall_posture_duplicate',
        'survivorContract','complete_cervical_multiplanar_loop_both_directions_exact_declared_base_neutral_finish',
        'duplicateContract','same_complete_cervical_loop_with_tall_posture_wording',
        'legacySources',jsonb_build_array(24,897),
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_exact_identity',NULL,now()),
    (1,canonical_definition,wall_rotation_definition,'distinct_exercises',
      'Wall Cervical Rotation + Chin Nod ends after a nod plus side-to-side axial rotation with wall feedback. It omits the complete flexion, lateral-flexion, comfortable-extension, opposite-side, and direction-reversal CAR path.',
      jsonb_build_object('migration',migration_key,
        'identityBoundary','complete_neck_car_vs_wall_chin_nod_then_rotation',
        'leftContract','complete_cervical_multiplanar_loop_both_directions_exact_declared_base_neutral_finish',
        'rightContract','wall_feedback_chin_nod_then_axial_rotation_only',
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_identity_equivalence',NULL,now())
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,resolved_at=now();

  INSERT INTO coaching.exercise_section_evidence_v1(
    definition_id,reviewed_card_version,section_key,source_url,source_title,
    source_publisher,source_kind,claims_json,evidence_quality,review_status,
    reviewer_user_id,reviewed_at)
  SELECT canonical_definition,2,e.section_key,e.source_url,e.source_title,e.publisher,
    e.source_kind,jsonb_build_array(
      jsonb_build_object('supported',e.supported_claim,'scope',e.scope),
      jsonb_build_object('limitation',e.limitation,
        'noUniversalPathRangeTechniqueSafetyEligibilityDoseRecoveryOutcomeOrDifficultyClaim',TRUE)),
    e.quality,'candidate',NULL,NULL
  FROM (VALUES
    ('identity','https://www.acefitness.org/continuing-education/certified/october-2024/8725/controlled-articular-rotations-shifting-mobility-into-high-gear/','Controlled Articular Rotations: Shifting Mobility into High Gear','American Council on Exercise','professional_standard','ACE describes CARs as slow deliberate joint-specific active rotation through available pain-free range without momentum. A complete Neck CAR includes the declared multi-planar path and both directions; tall posture is setup quality rather than a separate exercise.','professional CARs identity and scope','ACE does not validate the Vortex repetition boundary, one cervical path, or the duplicate consolidation.',88),
    ('taxonomy','https://www.acefitness.org/continuing-education/certified/october-2024/8725/controlled-articular-rotations-shifting-mobility-into-high-gear/','Controlled Articular Rotations: Shifting Mobility into High Gear','American Council on Exercise','professional_standard','The observable task is active multi-planar cervical rotation and control rather than passive stretching, axial rotation alone, or fast momentum circles.','professional exercise taxonomy context','The source does not create Vortex controlled terms or approve the rotate, neck, spine, or equipment keys.',88),
    ('anatomy','https://pmc.ncbi.nlm.nih.gov/articles/PMC6341704/','Experimental assessment of cervical ranges of motion and compensatory strategies','Chiropractic & Manual Therapies','peer_reviewed_research','A study of 97 asymptomatic adults measured head motion relative to the thorax in flexion-extension, axial rotation, and lateral inclination and observed inter-individual and coupled-motion variability.','asymptomatic-adult cervical kinematics','The study is not a Neck CAR exercise trial and does not define a normal path or safe endpoint.',86),
    ('biomechanics','https://pmc.ncbi.nlm.nih.gov/articles/PMC6341704/','Experimental assessment of cervical ranges of motion and compensatory strategies','Chiropractic & Manual Therapies','peer_reviewed_research','Head-on-thorax motion can include coupled and compensatory strategies; thorax and shoulder motion affect what is observed.','cervical motion and compensation context','It does not require a geometrically perfect circle or identical range by side and direction.',86),
    ('difficulty','https://www.acefitness.org/continuing-education/certified/october-2024/8725/controlled-articular-rotations-shifting-mobility-into-high-gear/','Controlled Articular Rotations: Shifting Mobility into High Gear','American Council on Exercise','professional_standard','Slow path memory, direction reversal, head-on-thorax control, compensation monitoring, and the exact base create exercise complexity despite negligible external load and impact.','professional task comparison','No source assigns a Vortex score or athlete classification.',88),
    ('load_fatigue_recovery','https://markowtrainingsystems.com/wp-content/uploads/2020/02/2020KinstretchStarterPack.pdf','Kinstretch Starter Pack','Markow Training Systems','expert_instruction','The starter material presents deliberate active joint circles and example repetitions rather than a loaded conditioning task or validated recovery prescription.','expert CARs routine and dose context','It does not quantify cervical tissue loading, fatigue, cumulative limits, or recovery.',74),
    ('constraints','https://pmc.ncbi.nlm.nih.gov/articles/PMC12620902/','Clinical Practice Guideline: Nonspecific Neck Pain','Deutsches Ärzteblatt International','professional_standard','Trauma, severe or progressive or radiating pain, neurologic findings, dizziness, unsteady gait, visual disturbance, and marked restriction are clinically relevant warning contexts.','clinical red-flag and scope context','The guideline is not a Neck CAR prescription and does not authorize exercise staff to diagnose or clear participants.',94),
    ('dosage','https://markowtrainingsystems.com/wp-content/uploads/2020/02/2020KinstretchStarterPack.pdf','Kinstretch Starter Pack','Markow Training Systems','expert_instruction','The starter material gives two to five repetitions per joint as one example for a routine.','expert example dose','The example is not a validated universal neck dose, frequency, duration, or recovery rule; Vortex uses a conservative review-only range.',74),
    ('instructions','https://www.acefitness.org/continuing-education/certified/october-2024/8725/controlled-articular-rotations-shifting-mobility-into-high-gear/','Controlled Articular Rotations: Shifting Mobility into High Gear','American Council on Exercise','professional_standard','Direct professional guidance supports slow intentional active movement through available pain-free range without momentum while observing pain, pinching, and compensation.','professional exercise instruction','It does not validate every Vortex cue, path checkpoint, base, or stop phrase.',88),
    ('safety_stop_rules','https://pmc.ncbi.nlm.nih.gov/articles/PMC12620902/','Clinical Practice Guideline: Nonspecific Neck Pain','Deutsches Ärzteblatt International','professional_standard','Neurologic deficit, numbness or paresthesia, dizziness, unsteady gait, visual disturbance, severe or progressive pain, and trauma are relevant escalation findings.','clinical warning and referral context','The guideline does not prove that Neck CARs is safe for a specific participant or replace facility emergency and clinical policies.',94),
    ('programming','https://www.acefitness.org/continuing-education/certified/october-2024/8725/controlled-articular-rotations-shifting-mobility-into-high-gear/','Controlled Articular Rotations: Shifting Mobility into High Gear','American Council on Exercise','professional_standard','ACE permits basic CARs concepts in warm-up, cool-down, and mobility routines while reserving individualized assessment, diagnosis, and injury treatment for appropriately qualified professionals.','professional programming scope','It does not establish Vortex phase placement, dose, frequency, transfer, or outcome.',88),
    ('athlete_support','https://www.acefitness.org/continuing-education/certified/october-2024/8725/controlled-articular-rotations-shifting-mobility-into-high-gear/','Controlled Articular Rotations: Shifting Mobility into High Gear','American Council on Exercise','professional_standard','Slow intentional active motion, no momentum, available pain-free range, and observation of pain, pinching, and compensation can be translated into concise self-checks and stop guidance.','plain-language participant support','The source does not establish universal sensation meaning, accessibility, or participant readiness.',88),
    ('coach_support','https://pmc.ncbi.nlm.nih.gov/articles/PMC12620902/','Clinical Practice Guideline: Nonspecific Neck Pain','Deutsches Ärzteblatt International','professional_standard','Trauma, progressive or radiating pain, neurologic findings, dizziness, gait disturbance, and visual symptoms require escalation rather than coaching diagnosis.','coach observation and scope boundary','The guideline does not prescribe group management, cue selection, or exercise progression.',94),
    ('accessibility','https://pmc.ncbi.nlm.nih.gov/articles/PMC6341704/','Experimental assessment of cervical ranges of motion and compensatory strategies','Chiropractic & Manual Therapies','peer_reviewed_research','The research measured cervical motion from a stabilized seated base and demonstrates that base and thorax control affect observed motion.','base and observation context','It was not an accessibility trial and does not prove that seated support is appropriate for every participant.',86),
    ('alternates','https://www.acefitness.org/continuing-education/certified/october-2024/8725/controlled-articular-rotations-shifting-mobility-into-high-gear/','Controlled Articular Rotations: Shifting Mobility into High Gear','American Council on Exercise','professional_standard','Joint-specific CARs remain distinct from full-body routines, and assessment or personalized injury management requires additional professional scope.','alternate identity and scope context','The source does not adjudicate every Vortex adjacent card or approve any graph edge.',88),
    ('media','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en','Embed videos and playlists','YouTube Help','manufacturer_instruction','Nine legacy candidates across sources 24 and 897 returned current YouTube oEmbed title, channel, thumbnail, and iframe metadata on 2026-08-02; five candidates were selected for review.','candidate metadata and privacy-enhanced embed format only','oEmbed does not prove playback, exact path or base, directions, captions, accessibility, cue quality, safety, conflicts, reviewer identity, card-version match, or approval.',82)
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
  SELECT canonical_definition,NULL,2,'https://www.youtube.com/watch?v='||m.video_id,
    'https://www.youtube-nocookie.com/embed/'||m.video_id,m.video_id,m.title,m.channel,
    NULL,'en',NULL,TRUE,NULL,NULL,'healthy','candidate','manual_research',
    m.query,NULL,NULL,'2026-11-02'::TIMESTAMPTZ,
    'Current YouTube oEmbed metadata only. Playback and exact complete cervical path, base, directions, range policy, dose, captions, accessibility, cue quality, safety, conflicts, reviewer identity, card-version match, and approval remain unverified.'
  FROM (VALUES
    ('J3tkQ4pk_Sc','Controlled Articular Rotations (CARs) - Neck','Tangelo - Seattle Chiropractor + Rehab','legacy candidate checked by YouTube oEmbed'),
    ('c-zu1t-NsSo','How to Do Neck CARs | Improve Neck Mobility & Joint Control','Peak Functional','legacy candidate checked by YouTube oEmbed'),
    ('iIt5_T8HM_Q','Neck CARs','Functional Bodybuilding','legacy candidate checked by YouTube oEmbed'),
    ('4wV_Jkk34ho','Cervical CARs','E3 Rehab Exercise Library','duplicate-source candidate checked by YouTube oEmbed'),
    ('xqBwoN7AglQ','Seated Cervical CARS for Neck Mobility','Therapy Exercises with Dr. Paula Sauer','duplicate-source candidate checked by YouTube oEmbed')
  ) m(video_id,title,channel,query)
  ON CONFLICT(definition_id,reviewed_card_version,url) DO UPDATE SET
    variant_id=NULL,embed_url=EXCLUDED.embed_url,video_id=EXCLUDED.video_id,
    title=EXCLUDED.title,channel_name=EXCLUDED.channel_name,duration_seconds=NULL,
    language_code='en',captions_available=NULL,embedding_allowed=TRUE,
    exact_variant_match=NULL,demonstration_quality_score=NULL,
    link_status='healthy',review_status='candidate',
    discovery_method='manual_research',source_query=EXCLUDED.source_query,
    reviewer_user_id=NULL,reviewed_at=NULL,next_review_at=EXCLUDED.next_review_at,
    notes=EXCLUDED.notes,updated_at=now();

  INSERT INTO coaching.exercise_alternate_assessment_v1(
    definition_id,reviewed_card_version,alternate_name,classification,rationale,
    distinguishing_dimensions,proposed_card_json,review_status,
    reviewer_user_id,reviewed_at)
  SELECT canonical_definition,2,a.name,a.classification,a.rationale,
    jsonb_build_object('boundaryKey',a.boundary_key,'factsRequired',a.facts,
      'neverInferFromNameAgeSkillOrAthleteRanking',TRUE),
    jsonb_build_object('status',a.proposed_status,
      'classificationCandidate',a.classification,
      'humanIdentityContentAndSafetyReviewRequired',TRUE,
      'approvalsCreated',FALSE),'candidate',NULL,NULL
  FROM (VALUES
    ('Neck CARs with Tall Posture','same_identity','Source 897 supplies the same complete slow cervical CAR path; tall stacked posture is setup and quality rather than a different scored action.','source_897_duplicate',jsonb_build_array('legacy_source','complete_path','posture'),'duplicate_consolidated'),
    ('Cervical CARs','same_identity','Direct terminology alias only when the complete composite path, both directions, exact base, compensation boundary, and neutral finish remain exact.','direct_alias',jsonb_build_array('complete_path','directions','base','neutral_finish'),'alias'),
    ('Standing Independent Neck CARs','new_variant','Standing changes balance, support, supervision, and logistics while preserving the exact cervical repetition contract.','standing_variant',jsonb_build_array('standing','independent','balance'),'authored_variant'),
    ('Seated Supported Neck CARs','new_variant','A stable seated base changes balance, equipment, thorax control, and exit while preserving the exact cervical repetition contract.','seated_variant',jsonb_build_array('seated','supported','box_or_chair_optional'),'authored_variant'),
    ('Supine Neck CARs','new_variant','Head support, gravity vector, surface contact, extension availability, and exit change materially and require a separately specified exact variant.','supine_variant_quarantine',jsonb_build_array('supine','head_support','gravity','range','exit'),'needs_human_review'),
    ('Range-Reduced Neck CARs','modifier_annotation','Smaller comfortable controllable range is a delivery annotation when the intended complete path and both directions remain; planned omission of an action requires separate review.','range_annotation',jsonb_build_array('range','complete_path'),'delivery_annotation'),
    ('Neck CARs Circle Count Tempo and Rest','modifier_annotation','Circle count, cadence, and rest change dose without changing the exact action or base.','dose_annotation',jsonb_build_array('circles','tempo','rest'),'delivery_annotation'),
    ('Low-Tension or Irradiated Neck CARs','modifier_annotation','Voluntary body tension changes effort and dose only while path, base, range contract, and terminal state remain exact.','tension_annotation',jsonb_build_array('voluntary_tension','effort'),'delivery_annotation'),
    ('Wall Cervical Rotation + Chin Nod','new_definition','Source 898 ends after a chin nod plus side-to-side axial rotation against wall feedback and omits the complete cervical CAR path.','wall_chin_nod_rotation_distinct',jsonb_build_array('wall','chin_nod','axial_rotation_only'),'existing_distinct_definition'),
    ('Chin Nod or Chin Tuck','new_definition','A flexion or retraction control repetition ends without lateral flexion, extension, composite path, or direction reversal.','chin_nod_distinct',jsonb_build_array('nod','retraction','static_or_short_path'),'research_queue'),
    ('Cervical Rotation Only','new_definition','Side-to-side axial rotation omits the complete composite CAR path and has its own repetition endpoints.','rotation_only_distinct',jsonb_build_array('axial_rotation','side_to_side'),'research_queue'),
    ('Cervical Isometric Hold','new_definition','A static force-duration task has no circular path and carries different loading, dose, and failure rules.','isometric_distinct',jsonb_build_array('isometric','force','duration'),'research_queue'),
    ('Resisted Harness or Band Neck Circle','new_definition','External resistance, anchor direction, load magnitude, failure consequence, and recovery create a loaded exercise rather than an unloaded CAR.','resisted_distinct',jsonb_build_array('resistance','anchor','load'),'research_queue'),
    ('Passive Cervical Stretch','new_definition','A held passive or assisted position replaces active controlled multi-planar motion.','passive_stretch_distinct',jsonb_build_array('passive','hold','assistance'),'research_queue'),
    ('Manual-Assisted Cervical Range','new_definition','External hands, applied force, consent, clinical authority, and symptom interpretation change the task and scope.','manual_assistance_distinct',jsonb_build_array('manual','assistance','consent','clinical_scope'),'clinical_scope'),
    ('Vestibular Gaze-Stabilization Head Turns','new_definition','A visual target, gaze-stability outcome, head speed, symptom rules, and vestibular intent define a different drill.','vestibular_distinct',jsonb_build_array('visual_target','gaze','head_speed','vestibular_intent'),'clinical_or_specialist_scope'),
    ('Full-Body Joint CARs Flow','new_definition','The eight-region composite includes seven additional regions, transitions, balance, and a different completion boundary.','full_body_flow_distinct',jsonb_build_array('eight_regions','ordered_flow','transitions'),'existing_distinct_definition'),
    ('Generic Head Circles or Neck Rolls','new_definition','The label does not establish speed, active control, sequence, extension policy, direction, compensation, or finish and remains identity-quarantined rather than assumed to be CARs.','generic_neck_roll_quarantine',jsonb_build_array('underspecified_identity','speed','path','finish'),'needs_human_review'),
    ('Clinician Neck CAR Assessment or Treatment','new_definition','Assessment, diagnosis, individualized treatment, clearance, and clinical measurement change purpose, authority, and escalation.','clinical_assessment_distinct',jsonb_build_array('assessment','diagnosis','treatment','clearance'),'clinical_scope'),
    ('Fast Forced or Symptom-Provoking Neck Circles','reject','Momentum, forced end range, pain, neurologic symptoms, dizziness, visual disturbance, or loss of control violates the valid exercise contract.','unsafe_reject',jsonb_build_array('momentum','forced_range','pain','neurologic','dizziness','control_loss'),'rejected_behavior')
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
    jsonb_build_object('migration',migration_key,'reviewOnly',TRUE,
      'automaticSubstitution',FALSE,
      'revalidate',jsonb_build_array('identity','base and support','cervical path and actions','symptoms and restrictions','purpose','dose','fatigue and same-session cervical loading','duration','equipment and space','logistics','persistence','coach rendering','athlete rendering'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'review',NULL,NULL,NULL
  FROM (VALUES
    (standing_variant,seated_variant,'equipment_equivalent',86,ARRAY['stability','complexity']::TEXT[],'Adds a stable seat and reduces standing balance demand while retaining the complete cervical path; support, equipment, setup, exit, duration, and score require revalidation.'),
    (seated_variant,standing_variant,'equipment_equivalent',86,ARRAY['stability','complexity']::TEXT[],'Removes the seat and adds independent standing balance while retaining the complete cervical path; balance, base, logistics, duration, and score require revalidation.'),
    (full_body_variant,standing_variant,'regression',62,ARRAY['range','complexity','fatigue']::TEXT[],'Changes from the exact eight-region flow to the cervical-only standing card. This is a distinct partial task and is never an automatic substitution.'),
    (standing_variant,full_body_variant,'progression',62,ARRAY['range','complexity','fatigue']::TEXT[],'Adds seven regions, ordered transitions, more standing time, and broader cumulative exposure. The full-body card is distinct and requires complete revalidation.'),
    (standing_variant,wall_rotation_variant,'regression',58,ARRAY['range','stability','complexity']::TEXT[],'Changes to a wall-feedback chin-nod plus axial-rotation-only task. The path, endpoint, equipment, support, and identity change, so this is never automatic.')
  ) r(from_id,to_id,relationship,score,dimensions,reason)
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
  SELECT 1,v.id,d.dimension,
    CASE d.dimension WHEN 'technicalComplexity' THEN v.complexity ELSE v.physical END,
    20,
    CASE d.dimension WHEN 'technicalComplexity' THEN
      'Review-only exercise-complexity anchor based on full multi-planar path memory, both directions, head-on-thorax control, compensation monitoring, exact base, neutral return, and symptom-aware execution.'
    ELSE 'Review-only physical-difficulty anchor based on unloaded active cervical range, low postural demand, base control, circle duration, and negligible impact without asserting tissue force.' END
      ||' This scores the exercise task, not athlete proficiency. Variant: '||v.variant_key||'.',
    'review',1,NULL,NULL,
    'Research-informed proposal only; independent comparison and qualified human approval remain required.',NULL
  FROM (VALUES
    (standing_variant,'standing-independent-complete-cervical-car',28,4),
    (seated_variant,'seated-supported-complete-cervical-car',24,3)
  ) v(id,variant_key,complexity,physical)
  CROSS JOIN (VALUES('technicalComplexity'),('absoluteLoadDemand')) d(dimension)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
    proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,
    reviewed_by=NULL,review_notes=EXCLUDED.review_notes,reviewed_at=NULL,
    updated_at=now();

  UPDATE coaching.exercise SET
    name='Neck CARs',slug='neck-cars',
    description='Complete the exact standing-independent or seated-supported cervical CAR. From neutral, slowly trace the full comfortable active multi-planar neck path in one direction, return to neutral, then repeat the opposite direction without momentum, forced range, warning symptoms, or material thorax, shoulder, jaw, or base compensation.',
    instructions='Select and record the exact base. Keep the thorax and shoulders reasonably quiet, move slowly through comfortable flexion, lateral flexion, extension only within the available symptom-free range, the opposite side, and rotation to form one continuous path. Return to neutral, then complete the other direction. Reduce range instead of forcing or using momentum. Stop for sharp, increasing, severe, or radiating pain; unusual headache; dizziness; faintness; nausea; visual change; numbness; tingling; weakness; unsteady gait; lost balance; or inability to regain neutral. This is exercise, not assessment, diagnosis, treatment, or clearance.',
    skill_level=NULL,age_min=NULL,age_max=NULL,default_sets=1,default_reps=2,
    default_work_seconds=NULL,default_rest_seconds=30,
    tempo='slow deliberate continuous no-momentum path with neutral return between directions',
    load_note='Track actual circles by direction, exact base and support, comfortable range modifications, tempo, voluntary tension, compensation, symptoms, invalid or partial attempts, duration, and same-session cervical loading.',
    est_seconds_per_set=120,is_published=FALSE,archived=FALSE,
    card_summary='Exact complete active cervical multi-planar path with standing-independent and seated-supported bases as separate variants.',
    coach_language='Verify the exact base, seat stability when selected, symptoms and trauma context, full path and directions, planned dose, head-on-thorax control, shoulder and jaw compensation, range policy, neutral return, actual duration, downstream cervical loading, stop response, and clinical scope.',
    athlete_language='Move slowly through a comfortable full neck path in each direction, keep your base quiet, return to neutral, and stop for pain, headache, dizziness, visual or neurologic symptoms, nausea, or lost balance.',
    programming_logic=jsonb_build_object(
      'selectionStatus','canonical_variant_required','selectable',TRUE,
      'canonicalDefinitionId',canonical_definition,
      'exactVariantIds',to_jsonb(active_variant_ids),
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'exerciseDifficultyDescribesTaskOnly',TRUE,
      'selectionInputs',jsonb_build_array('workout purpose','standing versus seated base','stable seat availability','trauma and symptom context','comfortable active cervical path','direction dose and duration','same-session cervical contact inversion and loaded work','coach scope sightline and escalation'),
      'substitutionRevalidation',jsonb_build_array('identity','base and support','cervical path and actions','symptoms and restrictions','purpose','dose','fatigue and cumulative cervical budget','duration','equipment space and logistics','persistence','coach rendering','athlete rendering'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    scalable_variables=ARRAY['circles_per_direction','range','tempo','rest_seconds','voluntary_tension','sets']::TEXT[],
    movement_family='Cervical Joint CARs',primary_phase_key=NULL,
    phase_subrole=NULL,primary_order_slot=NULL,
    movement_requirements=jsonb_build_object(
      'selectable',TRUE,'canonicalVariantRequired',TRUE,
      'exactPath',jsonb_build_array('comfortable_flexion','lateral_flexion','comfortable_extension_without_forcing','opposite_lateral_flexion','axial_rotation_components','neutral_return'),
      'directionRule','both_directions_recorded_separately',
      'mustMaintain',jsonb_build_array('exact_base','slow_no_momentum_control','comfortable_active_range','head_relative_to_quiet_thorax','material_compensation_absent','neutral_return','communication'),
      'mustNotAdd',jsonb_build_array('forced_end_range','external_resistance','passive_or_manual_assistance','speed_or_momentum','vestibular_target','clinical_assessment_treatment_or_clearance','silent_action_omission'),
      'validCompletion','full_composite_path_in_each_direction_with_exact_base_comfortable_control_no_warning_symptom_and_neutral_return'),
    coaching_execution=jsonb_build_object(
      'qualityGates',jsonb_build_array('variant_base_and_station_exact','full_path_and_direction_correct','slow_controllable_active_range','head_on_thorax_control','material_shoulder_jaw_and_base_compensation_absent','neutral_return','no_warning_symptom'),
      'stopRules',jsonb_build_array('sharp_increasing_severe_or_radiating_pain','unusual_headache_dizziness_faintness_nausea_or_visual_change','numbness_tingling_weakness_unsteady_gait_or_balance_loss','recent_trauma_or_conflicting_clinical_restriction','forced_range_momentum_or_uncorrectable_compensation','wrong_path_direction_or_base','unsafe_seat_floor_space_sightline_communication_or_exit','budget_or_duration_reached'),
      'persistence',jsonb_build_array('definition_and_variant','base_and_equipment','planned_and_actual_circles_by_direction','range_tempo_and_tension_annotations','valid_invalid_partial_and_symptom_limited_attempts','first_fault_and_compensation','symptoms_and_stop_reason','rest','duration','substitution')),
    pairing_logic=jsonb_build_object(
      'sameSessionBudget',jsonb_build_array('cervical_circles','active_end_range_time','loaded_neck_work','contact_and_inversion_cervical_exposure','technical_control_and_symptoms'),
      'avoidAutomaticPairingWith',jsonb_build_array('fatiguing_loaded_neck_work','contact_or_inversion_work_when_cervical_budget_or_symptoms_conflict','symptom_provoking_mobility','clinical_assessment_or_treatment','time_critical_output_when_this_drill_displaces_priority_work'),
      'revalidateAfterSubstitution',TRUE),
    media_library=jsonb_build_object(
      'candidate_video_ids',jsonb_build_array('J3tkQ4pk_Sc','c-zu1t-NsSo','iIt5_T8HM_Q','4wV_Jkk34ho','xqBwoN7AglQ'),
      'reviewState','oembed_metadata_only_candidate_quarantine',
      'playbackExactnessPathBaseDirectionsCaptionsAccessibilityQualitySafetyAndApprovalVerified',FALSE,
      'humanReviewRequired',TRUE),
    programming_kind='exercise',linked_skill_id=NULL,why_publish_ready=FALSE,
    updated_at=now()
  WHERE id=24;

  UPDATE coaching.exercise SET
    skill_level=NULL,age_min=NULL,age_max=NULL,is_published=FALSE,archived=TRUE,
    programming_logic=coalesce(programming_logic,'{}'::JSONB)||jsonb_build_object(
      'selectionStatus','duplicate_consolidated','selectable',FALSE,
      'survivorDefinitionId',canonical_definition,
      'survivorLegacyExerciseId',24,'migration',migration_key,
      'identityReason','tall posture is setup quality within the same complete cervical CAR repetition',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    linked_skill_id=NULL,why_publish_ready=FALSE,updated_at=now()
  WHERE id=897;

  UPDATE coaching.exercise_safety_profile SET
    risk_level=1,impact_level=0,minimum_age_recommended=NULL,
    minimum_skill_level=NULL,requires_spotting=FALSE,
    requires_coach_supervision='recommended',
    minimum_prerequisite_notes='Readiness is evaluated from trauma and symptom context, the exact standing or seated base, communication, comfortable controllable active cervical motion, downstream neck loading, and workout purpose; never from an exercise proficiency or age label.',
    readiness_checks=ARRAY[
      'Confirm the exact base, stable floor, clear head space, safe exit, and an inspected nonrolling box or chair when seated support is selected.',
      'Confirm no recent trauma, severe or progressive or radiating pain, unusual headache, dizziness, visual change, neurologic symptom, unsteady gait, or conflicting clinical restriction.',
      'Confirm the participant understands the demonstrated path, both directions, smaller-range option, neutral return, and stop signal.',
      'Review same-session cervical end-range, loaded neck, contact, inversion, fatigue, duration, and symptom exposure.'
    ]::TEXT[],
    stop_signs=ARRAY[
      'Sharp, increasing, severe, or radiating pain; pinching, guarding, or participant stop request.',
      'Unusual headache, dizziness, faintness, nausea, visual change, unsteady gait, or balance loss.',
      'Numbness, tingling, weakness, a new neurologic sign, or inability to communicate clearly.',
      'Recent trauma or a conflicting restriction becomes known.',
      'Momentum, forced range, path loss, compensation, base loss, or missed neutral return cannot be corrected safely.',
      'Seat, floor, space, traffic, sightline, communication, duration, or safe exit becomes inadequate.'
    ]::TEXT[],
    contraindications=ARRAY[
      'Recent trauma or current severe, progressive, or radiating neck symptoms require evaluation under facility policy.',
      'New neurologic finding, dizziness, visual disturbance, unusual headache, faintness, nausea, or unsteady gait.',
      'The exact base cannot be maintained or active cervical motion is restricted or symptom provoking.',
      'The intended service is diagnosis, normal-range assessment, treatment, clearance, passive stretching, vestibular care, or another exercise identity.'
    ]::TEXT[],
    common_substitutions=ARRAY[
      'Select the seated-supported exact variant only after equipment, base, dose, duration, and logistics revalidation.',
      'Select the standing-independent exact variant only after balance and base revalidation.',
      'Select Wall Cervical Rotation + Chin Nod, a rotation-only card, a chin-nod card, or another distinct definition only when that exact partial task is intended and fully revalidated.',
      'Do not silently switch to passive, manual-assisted, resisted, supine, vestibular, clinical, fast, forced, or symptom-provoking motion.'
    ]::TEXT[]
  WHERE exercise_id=24;

  UPDATE coaching.exercise_safety_profile SET
    minimum_age_recommended=NULL,minimum_skill_level=NULL,
    minimum_prerequisite_notes='Archived duplicate source. Use the source-24 canonical survivor and exact variant; readiness is a workout input, not an age or proficiency label.',
    common_substitutions=ARRAY['Use canonical Neck CARs definition ee59b220-042c-482a-b7b5-5923d644c800 with an exact standing-independent or seated-supported variant after complete revalidation.']::TEXT[]
  WHERE exercise_id=897;

  UPDATE coaching.exercise_score_v1 SET
    technical_complexity=28,absolute_load_demand=4,coordination_demand=28,
    impact=1,supervision_demand=18,
    base_overall_difficulty=greatest(28,4),
    legacy_scores=coalesce(legacy_scores,'{}'::JSONB)||jsonb_build_object(
      'candidateReassessment',migration_key,
      'projectionScope','standing_independent_variant_representative_highest_complexity_variant',
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'variantScores',jsonb_build_object(
        'standingIndependent',jsonb_build_object('complexity',28,'physicalDifficulty',4,'overall',28),
        'seatedSupported',jsonb_build_object('complexity',24,'physicalDifficulty',3,'overall',24)),
      'exerciseScoresDescribeTaskOnly',TRUE,'independentCalibrationRequired',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    migration_confidence=60,human_review_status='queued',reviewed_by=NULL,
    reviewed_at=NULL,
    review_notes='Research-informed candidate reassessment only. Scores describe exercise complexity and physical difficulty, not athlete proficiency. Exact path, base, symptoms, and independent calibration remain required.',updated_at=now()
  WHERE exercise_id=24;

  UPDATE coaching.exercise_score_v1 SET
    technical_complexity=24,absolute_load_demand=3,coordination_demand=24,
    impact=1,supervision_demand=14,
    base_overall_difficulty=greatest(24,3),
    legacy_scores=coalesce(legacy_scores,'{}'::JSONB)||jsonb_build_object(
      'candidateReassessment',migration_key,
      'projectionScope','archived_duplicate_source_lineage_only',
      'survivorDefinitionId',canonical_definition,
      'exerciseScoresDescribeTaskOnly',TRUE,'humanReviewRequired',TRUE,
      'approvalsCreated',FALSE),
    migration_confidence=60,human_review_status='queued',reviewed_by=NULL,
    reviewed_at=NULL,
    review_notes='Archived duplicate lineage only. Use the canonical survivor and exact variant; no athlete proficiency or publication status is implied.',updated_at=now()
  WHERE exercise_id=897;

  UPDATE coaching.exercise_difficulty_profile SET
    technical=2.8,complexity=3,load=1.0,overall=2.8,
    recommended_age_min=NULL,recommended_age_max=NULL,
    attention_demand='moderate',
    notes='Candidate projection from the standing-independent exact variant, the highest-complexity current variant. The legacy 1-10 load field is floor-bounded at 1.0; canonical physical difficulty is 4/100. This is not athlete proficiency or age classification.',
    source='canonical_research_candidate',updated_at=now()
  WHERE exercise_id=24;

  UPDATE coaching.exercise_difficulty_profile SET
    technical=2.4,complexity=2,load=1.0,overall=2.4,
    recommended_age_min=NULL,recommended_age_max=NULL,
    attention_demand='moderate',
    notes='Archived duplicate source projection only. Use the source-24 survivor and exact variant; this is not athlete proficiency or age classification.',
    source='canonical_duplicate_archived',updated_at=now()
  WHERE exercise_id=897;

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  VALUES(canonical_definition,1,2,'2.0.0',migration_key,'quarantined',
    jsonb_build_object(
      'identity',jsonb_build_object('passed',TRUE,'identityKey','complete_cervical_car_both_directions','legacySources',2,'duplicateConsolidated',TRUE,'activeVariants',2,'archivedSourceSkeletons',2,'wallChinNodRotationRemainsDistinct',TRUE),
      'taxonomy',jsonb_build_object('passed',TRUE,'controlledTerms',TRUE,'movementPatterns',jsonb_build_array('rotate'),'bodyRegions',jsonb_build_array('neck','spine'),'equipment',jsonb_build_array('none','box_or_chair_optional'),'mobilityIsPurposeNotControlledMovementPattern',TRUE),
      'anatomy',jsonb_build_object('passed',TRUE,'musclesJointsActionsPlanesLateralitySupportAndCompensation',TRUE,'noPerfectCircleOrUniversalRangeClaim',TRUE),
      'difficulty',jsonb_build_object('passed',TRUE,'model','max_exercise_complexity_physical_difficulty','variantVectors',jsonb_build_array('28/4/28','24/3/24'),'athleteClassificationAbsent',TRUE,'independentCalibrationRequired',TRUE),
      'loadFatigueRecovery',jsonb_build_object('passed',TRUE,'actualCirclesRangeBaseDurationAndCervicalExposureTracked',TRUE,'scoreFloorOneForNoImpact',TRUE,'recoveryIsPlanningEstimate',TRUE),
      'constraints',jsonb_build_object('passed',TRUE,'traumaSymptomsBaseSeatSpaceTrafficSightlineScopeAndExit',TRUE),
      'delivery',jsonb_build_object('passed',TRUE,'profiles',4,'prepareAndRestoreOnly',TRUE,'durationDoseRestStationAndSubstitutionRevalidation',TRUE),
      'instructions',jsonb_build_object('passed',TRUE,'athleteInstructionsAtMost240Characters',TRUE,'coachAthleteAccessibilityAndSupportOperations',TRUE,'pathDirectionCompensationSymptomsAndClinicalScope',TRUE),
      'research',jsonb_build_object('passed',TRUE,'sections',16,'registryVersion',research_version,'sourceLimitationsExplicit',TRUE),
      'media',jsonb_build_object('passed',FALSE,'candidateCount',5,'currentOEmbedMetadataHealthy',TRUE,'playbackReviewed',FALSE,'exactPathAndBaseReviewed',FALSE,'captionsAccessibilityQualitySafetyAndApprovalReviewed',FALSE),
      'relationships',jsonb_build_object('passed',FALSE,'reviewOnly',5,'approved',0,'controlledDimensionsOnly',TRUE),
      'calibration',jsonb_build_object('passed',FALSE,'reviewOnly',4,'approved',0,'derivedOverallNotCalibrated',TRUE),
      'alternates',jsonb_build_object('passed',TRUE,'assessments',20,'explicitIdentityDecisions',2,'clinicalScopeBoundaryExplicit',TRUE),
      'generationSupport',jsonb_build_object('passed',TRUE,'selectionConstraints',TRUE,'cumulativeBudgets',TRUE,'duration',TRUE,'equipmentAndStation',TRUE,'substitutionRevalidation',TRUE,'renderingAndPersistence',TRUE),
      'publication',jsonb_build_object('passed',FALSE,'reviewer',NULL,'approver',NULL)),
    jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01','message','A qualified human must watch all five candidates in full and verify playback, exact complete cervical path and variant, base, directions, range policy, dose, captions, accessibility, cue quality, safety, conflicts, reviewer identity, timestamp, card version, and approval rationale.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','A qualified coach must approve or reject every base-equivalent and distinct-task progression or regression proposal; no automatic support, partial-path, or full-body substitution is authorized.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','An independent qualified reviewer must calibrate exercise complexity and physical difficulty for both exact variants. Scores do not classify an athlete or create an age or skill level.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','A qualified reviewer and separate approver must complete content review before publication. The identity, path, anatomy, range, base, dose, stop, scope, accessibility, and support rules remain quarantined.')),
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
        AND movement_patterns=ARRAY['rotate']::TEXT[]
        AND body_regions=ARRAY['neck','spine']::TEXT[]
        AND anatomy_json<>'{}'::JSONB AND environment_json<>'{}'::JSONB
        AND population_json<>'{}'::JSONB
        AND athlete_support_json<>'{}'::JSONB
        AND coach_support_json<>'{}'::JSONB
        AND support_operations_json<>'{}'::JSONB
        AND provenance_json->>'approvalsCreated'='false')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=duplicate_definition AND status='archived'
        AND provenance_json->>'survivorDefinitionId'=canonical_definition::TEXT
        AND reviewed_by IS NULL AND approved_by IS NULL)
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id IN(source_variant,duplicate_variant) AND status='archived'
        AND requirements_json->>'representation'='superseded_source_skeleton')<>2 THEN
    RAISE EXCEPTION '% definition or source quarantine assertion failed',migration_key;
  END IF;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=24 AND definition_id=canonical_definition
        AND source_kind='legacy_migration')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=897 AND definition_id=canonical_definition
        AND source_kind='duplicate_consolidation')
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=897 AND definition_id=duplicate_definition) THEN
    RAISE EXCEPTION '% source mapping or duplicate lineage assertion failed',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(active_variant_ids) AND definition_id=canonical_definition
        AND status='review' AND requirements_json->>'selectable'='true'
        AND (difficulty_json->>'technicalComplexity')::INTEGER BETWEEN 1 AND 100
        AND (difficulty_json->>'physicalDifficulty')::INTEGER BETWEEN 1 AND 100
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=greatest(
          (difficulty_json->>'technicalComplexity')::INTEGER,
          (difficulty_json->>'physicalDifficulty')::INTEGER)
        AND (difficulty_json->>'impact')::INTEGER=1
        AND (load_profile_json->>'landingContactsPerRep')::INTEGER=0
        AND (load_profile_json->>'handImpactContactsPerRep')::INTEGER=0
        AND load_profile_json->>'impactClass'='none'
        AND (fatigue_profile_json->>'impactAccumulation')::INTEGER=1
        AND programming_profile_json->>'publicationQuarantined'='true')<>2
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=standing_variant
        AND (difficulty_json->>'technicalComplexity')::INTEGER=28
        AND (difficulty_json->>'physicalDifficulty')::INTEGER=4
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=28
        AND requirements_json->'equipment'=jsonb_build_array('none'))
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=seated_variant
        AND (difficulty_json->>'technicalComplexity')::INTEGER=24
        AND (difficulty_json->>'physicalDifficulty')::INTEGER=3
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=24
        AND requirements_json->'equipment'=jsonb_build_array('box_or_chair_optional')) THEN
    RAISE EXCEPTION '% active variant score or mechanics assertion failed',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=ANY(active_variant_ids) AND status='review'
        AND cardinality(equipment_required)>0
        AND coalesce(time_model_json->>'durationFormula','')<>''
        AND dose_scaling_json<>'{}'::JSONB
        AND measurement_json<>'{}'::JSONB
        AND support_prompts_json<>'{}'::JSONB
        AND length(coach_instructions)>=100
        AND length(athlete_instructions) BETWEEN 10 AND 240
        AND cardinality(stop_rules)>=8)<>4
    OR (SELECT count(DISTINCT section_key)
      FROM coaching.exercise_section_evidence_v1
      WHERE definition_id=canonical_definition AND reviewed_card_version=2
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>16
    OR (SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=canonical_definition AND reviewed_card_version=2
        AND link_status='healthy' AND review_status='candidate'
        AND embedding_allowed AND captions_available IS NULL
        AND exact_variant_match IS NULL
        AND demonstration_quality_score IS NULL
        AND reviewer_user_id IS NULL AND reviewed_at IS NULL)<>5
    OR (SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id=canonical_definition AND reviewed_card_version=2
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>20
    OR (SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE conditions_json->>'migration'=migration_key
        AND review_status='review' AND reviewed_by IS NULL)<>5
    OR (SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(active_variant_ids) AND status='review'
        AND reviewed_by IS NULL)<>4
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=canonical_definition
        AND resolved_definition_id IN(duplicate_definition,wall_rotation_definition)
        AND reviewed_by IS NULL)<>2 THEN
    RAISE EXCEPTION '% authored row-count or quarantine assertion failed',migration_key;
  END IF;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=canonical_definition
        AND resolved_definition_id=duplicate_definition
        AND decision='duplicate_consolidated'
        AND resolution_source='deterministic_exact_identity'
        AND reviewed_by IS NULL)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=canonical_definition
        AND resolved_definition_id=wall_rotation_definition
        AND decision='distinct_exercises'
        AND resolution_source='deterministic_identity_equivalence'
        AND reviewed_by IS NULL)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=full_body_definition
        AND resolved_definition_id=canonical_definition
        AND decision='distinct_exercises') THEN
    RAISE EXCEPTION '% identity disposition assertion failed',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 d
      CROSS JOIN LATERAL unnest(d.movement_patterns) key
      WHERE d.id=canonical_definition
        AND NOT EXISTS(SELECT 1 FROM coaching.movement_pattern allowed
          WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 d
      CROSS JOIN LATERAL unnest(d.body_regions) key
      WHERE d.id=canonical_definition
        AND NOT EXISTS(SELECT 1 FROM coaching.body_region allowed
          WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 d
      CROSS JOIN LATERAL unnest(d.required_equipment||d.optional_equipment) key
      WHERE d.id=canonical_definition
        AND NOT EXISTS(SELECT 1 FROM coaching.equipment allowed
          WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 v
      CROSS JOIN LATERAL jsonb_array_elements_text(v.requirements_json->'equipment') key
      WHERE v.id=ANY(active_variant_ids)
        AND NOT EXISTS(SELECT 1 FROM coaching.equipment allowed
          WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_delivery_profile_v1 p
      CROSS JOIN LATERAL unnest(p.equipment_required) key
      WHERE p.variant_id=ANY(active_variant_ids)
        AND NOT EXISTS(SELECT 1 FROM coaching.equipment allowed
          WHERE allowed.key=key)) THEN
    RAISE EXCEPTION '% uncontrolled taxonomy was authored',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1 relationship
      CROSS JOIN LATERAL unnest(relationship.dimensions) dimension
      WHERE relationship.conditions_json->>'migration'=migration_key
        AND dimension<>ALL(ARRAY['load','leverage','range','speed','stability','complexity','impact','decision_demand','fatigue']::TEXT[])) THEN
    RAISE EXCEPTION '% uncontrolled relationship dimension was authored',migration_key;
  END IF;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=24
      AND skill_level IS NULL AND age_min IS NULL AND age_max IS NULL
      AND linked_skill_id IS NULL AND is_published=FALSE AND archived=FALSE
      AND programming_kind='exercise' AND why_publish_ready=FALSE)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=897
      AND skill_level IS NULL AND age_min IS NULL AND age_max IS NULL
      AND linked_skill_id IS NULL AND is_published=FALSE AND archived=TRUE
      AND why_publish_ready=FALSE)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1 WHERE exercise_id=24
      AND technical_complexity=28 AND absolute_load_demand=4
      AND base_overall_difficulty=28 AND impact=1
      AND human_review_status='queued' AND reviewed_by IS NULL
      AND reviewed_at IS NULL)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_difficulty_profile
      WHERE exercise_id=24 AND technical=2.8 AND complexity=3
        AND load=1.0 AND overall=2.8 AND recommended_age_min IS NULL
        AND recommended_age_max IS NULL)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_safety_profile
      WHERE exercise_id=24 AND minimum_age_recommended IS NULL
        AND minimum_skill_level IS NULL)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=canonical_definition AND card_version=2
        AND status='quarantined' AND human_review_required=TRUE
        AND jsonb_array_length(blocking_issues_json)=4) THEN
    RAISE EXCEPTION '% legacy projection or packet assertion failed',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id IN(canonical_definition,duplicate_definition)
        AND (approved_video_url IS NOT NULL OR reviewed_by IS NOT NULL
          OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_section_evidence_v1
      WHERE definition_id=canonical_definition AND reviewed_card_version=2
        AND review_status<>'candidate')
    OR EXISTS(SELECT 1 FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=canonical_definition AND reviewed_card_version=2
        AND (review_status<>'candidate' OR reviewer_user_id IS NOT NULL
          OR reviewed_at IS NOT NULL OR exact_variant_match IS NOT NULL
          OR captions_available IS NOT NULL
          OR demonstration_quality_score IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1
      WHERE conditions_json->>'migration'=migration_key
        AND (review_status<>'review' OR reviewed_by IS NOT NULL
          OR reviewed_at IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(active_variant_ids)
        AND (status<>'review' OR reviewed_by IS NOT NULL
          OR reviewed_at IS NOT NULL)) THEN
    RAISE EXCEPTION '% approval quarantine assertion failed',migration_key;
  END IF;
END
$migration$;
