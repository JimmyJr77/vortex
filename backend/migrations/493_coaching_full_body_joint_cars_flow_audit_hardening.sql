-- Source 23: replace the skeletal Full-Body Joint CARs Flow baseline with
-- exact composite-flow variants. All evidence, media, identity, graph, and
-- calibration records remain candidate/review-only; this migration creates no
-- human approval and no exercise proficiency or age classification.
DO $migration$
DECLARE
  migration_key CONSTANT TEXT := '493_coaching_full_body_joint_cars_flow_audit_hardening';
  research_version CONSTANT TEXT := '2026-08-02.91';
  canonical_definition UUID;
  source_variant UUID;
  independent_variant UUID;
  wall_variant UUID;
  active_variant_ids UUID[];
  neck_definition UUID;
  neck_variant UUID;
  hip_definition UUID;
  hip_variant UUID;
  wall_hip_definition UUID;
  ankle_definition UUID;
  ankle_variant UUID;
  shoulder_definition UUID;
  shoulder_variant UUID;
  quadruped_shoulder_definition UUID;
  cat_cow_definition UUID;
  spinal_circle_definition UUID;
  protected_count INTEGER;
BEGIN
  SELECT definition_id INTO canonical_definition FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=23;
  SELECT id INTO source_variant FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='baseline';
  SELECT id INTO independent_variant FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='standing-independent-eight-region-sequence';
  independent_variant := coalesce(independent_variant,gen_random_uuid());
  SELECT id INTO wall_variant FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='standing-wall-supported-lower-body-sequence';
  wall_variant := coalesce(wall_variant,gen_random_uuid());
  SELECT definition_id INTO neck_definition FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=24;
  SELECT id INTO neck_variant FROM coaching.exercise_variant_v1 WHERE definition_id=neck_definition AND variant_key='baseline';
  SELECT definition_id INTO hip_definition FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=57;
  SELECT id INTO hip_variant FROM coaching.exercise_variant_v1 WHERE definition_id=hip_definition AND variant_key='baseline';
  SELECT definition_id INTO wall_hip_definition FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=1357;
  SELECT definition_id INTO ankle_definition FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=42;
  SELECT id INTO ankle_variant FROM coaching.exercise_variant_v1 WHERE definition_id=ankle_definition AND variant_key='baseline';
  SELECT definition_id INTO shoulder_definition FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=37;
  SELECT id INTO shoulder_variant FROM coaching.exercise_variant_v1 WHERE definition_id=shoulder_definition AND variant_key='baseline';
  SELECT id INTO quadruped_shoulder_definition FROM coaching.exercise_definition_v1 WHERE slug='quadruped-shoulder-circles';
  SELECT definition_id INTO cat_cow_definition FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=25;
  SELECT definition_id INTO spinal_circle_definition FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=26;
  active_variant_ids := ARRAY[independent_variant,wall_variant];

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=23 AND facility_id=1)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition AND facility_id=1 AND legacy_exercise_id=23)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=23 AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source_variant AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1 WHERE exercise_id=23)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_difficulty_profile WHERE exercise_id=23)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_safety_profile WHERE exercise_id=23) THEN
    RAISE EXCEPTION '% prerequisite source rows are missing',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=ANY(active_variant_ids) AND definition_id<>canonical_definition)
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE slug='full-body-joint-cars-flow' AND id<>canonical_definition) THEN
    RAISE EXCEPTION '% working UUID or slug already belongs to another card',migration_key;
  END IF;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id=neck_variant AND definition_id=neck_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id=hip_variant AND definition_id=hip_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id=ankle_variant AND definition_id=ankle_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id=shoulder_variant AND definition_id=shoulder_definition) THEN
    RAISE EXCEPTION '% graph neighbor lineage drifted',migration_key;
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
    UNION ALL SELECT count(*) FROM coaching.exercise_card_review_v1 WHERE definition_id=canonical_definition
    UNION ALL SELECT count(*) FROM coaching.exercise_card_revision_v1 WHERE definition_id=canonical_definition
    UNION ALL SELECT count(*) FROM coaching.exercise_media_review_v1 WHERE definition_id=canonical_definition
    UNION ALL SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=ANY(active_variant_ids||ARRAY[source_variant]::UUID[])
          OR to_variant_id=ANY(active_variant_ids||ARRAY[source_variant]::UUID[]))
        AND (reviewed_by IS NOT NULL OR review_status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(active_variant_ids||ARRAY[source_variant]::UUID[])
        AND (reviewed_by IS NOT NULL OR status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_v1 WHERE exercise_id=23
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
  WHERE (from_variant_id=ANY(active_variant_ids||ARRAY[source_variant]::UUID[])
      OR to_variant_id=ANY(active_variant_ids||ARRAY[source_variant]::UUID[]))
    AND reviewed_by IS NULL AND review_status<>'approved';
  DELETE FROM coaching.exercise_score_calibration_v1
  WHERE variant_id=ANY(active_variant_ids||ARRAY[source_variant]::UUID[])
    AND reviewed_by IS NULL AND status<>'approved';

  UPDATE coaching.exercise_definition_source_v1 SET
    provenance_json=(coalesce(provenance_json,'{}'::JSONB)-'researchSources')
      ||jsonb_build_object(
        'migration',migration_key,'researchVersion',research_version,
        'sourceDisposition','canonical_exact_composite_reauthored',
        'representedBySelectableSourceVariant',FALSE,
        'sourceInterpretation','legacy source supplies an eight-region order but omits exact posture direction side compensation duration support stop and persistence contracts',
        'exactWorkingSpecifications',jsonb_build_array(
          'standing_independent_eight_region_sequence',
          'standing_wall_supported_lower_body_eight_region_sequence'),
        'legacyOrderIsVortexReviewContractNotUniversalStandard',TRUE,
        'researchSources',jsonb_build_array(
          'https://www.acefitness.org/continuing-education/certified/october-2024/8725/controlled-articular-rotations-shifting-mobility-into-high-gear/',
          'https://markowtrainingsystems.com/wp-content/uploads/2020/02/2020KinstretchStarterPack.pdf',
          'https://kinstretchwithbeard.vhx.tv/class-focus-full-body/videos/beginnervideo-6-carsfollowalong-1080-high',
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC12620902/'),
        'exerciseDifficultyDescribesTaskOnly',TRUE,
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=23 AND definition_id=canonical_definition;

  UPDATE coaching.exercise_delivery_profile_v1 SET status='archived',updated_at=now()
  WHERE variant_id=source_variant;
  UPDATE coaching.exercise_variant_v1 SET
    variant_key='identity-quarantine-source-23',
    display_name='Full-Body Joint CARs Flow Legacy Skeleton — Source 23',
    modifier_keys='{}'::TEXT[],difficulty_json='{}'::JSONB,status='archived',
    requirements_json=jsonb_build_object(
      'selectable',FALSE,'representation','superseded_source_skeleton',
      'sourceLegacyExerciseId',23,
      'archiveReason','exact posture joint actions directions sides compensation duration support stop and persistence contracts missing',
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
    canonical_definition,1,23,'full-body-joint-cars-flow',
    'Full-Body Joint CARs Flow','Full-Body Joint CARs Flow',
    ARRAY['Full Body Joint CARs Flow','Full-Body CARs Flow','Full Body CARs Flow','Head-to-Toe CARs Routine'],
    'Complete one exact ordered active-range flow: neck, shoulders, elbows, wrists, spine, hips, knees, then ankles. At each region, establish the declared standing support, stabilize the rest of the body as appropriate, perform slow controlled pain-free circles in both applicable directions and on both sides where relevant, return to a neutral checkpoint, then transition. No region may be silently omitted, replaced, rushed, forced, or converted into a clinical assessment.',
    'ordered_full_body_joint_cars_flow','2.0.0',2,'review',
    82,62,52,ARRAY['rotate','brace']::TEXT[],
    ARRAY['full_body','neck','shoulder','elbow','wrist','spine','hip','knee','ankle']::TEXT[],
    '{}'::TEXT[],ARRAY['wall']::TEXT[],
    jsonb_build_object(
      'surface','flat dry stable nonslip floor with appropriate footwear or bare-foot policy',
      'space','one standing arm-span station with unobstructed transitions and no cross traffic',
      'stationCapacity',1,'optionalSupport','stable inspected wall only in the exact supported variant',
      'coachSightline','front and side views sufficient to observe the active joint nonmoving-region compensation balance symptoms and neutral checkpoints',
      'inspection',jsonb_build_array('floor traction and clutter','wall stability and hand contact when selected','arm span overhead and lateral clearance','route and emergency exit','communication and demonstration access'),
      'changeRule','Changing support posture included regions order directions side rule dose space symptoms or next-session loading requires complete selection duration logistics substitution persistence and rendering revalidation.'),
    jsonb_build_object(
      'exerciseCardDoesNotClassifyAthletes',TRUE,'readinessIsWorkoutInput',TRUE,
      'readinessFacts',jsonb_build_array('can stand or use the exact wall-supported variant safely','can follow eight announced regions and both directions','can move each included region through a comfortable controllable range','can report pain pinching dizziness neurologic symptoms fatigue and balance loss','can stop and return to a stable neutral checkpoint'),
      'excludeOrReferPerFacilityPolicy',jsonb_build_array('sharp or increasing pain pinching or current acute joint symptoms','dizziness faintness unusual headache vision change numbness tingling weakness or unsteady gait','recent procedure injury or clinician restrictions conflict with the exact regions or posture','safe floor space support communication supervision or exit is unavailable'),
      'clinicalScope','This exercise is not diagnosis joint-health clearance injury treatment or an individualized CARs assessment.',
      'noUniversalEligibilityAgeReadinessDiagnosisTreatmentOrOutcomeClaimed',TRUE),
    jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'canonicalAuthoredFromResearch',TRUE,
      'primaryIdentitySource','https://www.acefitness.org/continuing-education/certified/october-2024/8725/controlled-articular-rotations-shifting-mobility-into-high-gear/',
      'legacySources',jsonb_build_array(23),
      'identityContract','exact_neck_shoulders_elbows_wrists_spine_hips_knees_ankles_order_with_slow_pain_free_no_momentum_circles_both_directions_applicable_sides_and_neutral_checkpoints',
      'legacyOrderIsVortexReviewContractNotUniversalStandard',TRUE,
      'researchSources',jsonb_build_array(
        'https://www.acefitness.org/continuing-education/certified/october-2024/8725/controlled-articular-rotations-shifting-mobility-into-high-gear/',
        'https://markowtrainingsystems.com/wp-content/uploads/2020/02/2020KinstretchStarterPack.pdf',
        'https://kinstretchwithbeard.vhx.tv/class-focus-full-body/videos/beginnervideo-6-carsfollowalong-1080-high',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC12620902/'),
      'confidenceBySection',jsonb_build_object('identity',78,'taxonomy',82,'anatomy',72,'difficulty',62,'load',64,'fatigueRecovery',58,'constraints',78,'dosage',60,'instructions',76,'alternates',82,'media',52),
      'unresolvedClaims',jsonb_build_array('one universal CARs order posture dose intensity or frequency','injury prevention joint health diagnosis or treatment outcome','universal safe end range eligibility recovery or progression order','numeric difficulty calibration','media playback exact order actions sides captions accessibility quality safety and approval'),
      'externalPlaybackVerificationPerformed',FALSE,'sourceLimitationsExplicit',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,'publicationQuarantined',TRUE),
    NULL,NULL,NULL,NULL,
    jsonb_build_object(
      'primaryMuscles',jsonb_build_array('deep cervical flexors and extensors','rotator cuff and scapular stabilizers','elbow forearm wrist and hand musculature','spinal flexors extensors and rotators','hip rotators and abductors','quadriceps hamstrings and popliteus','ankle plantarflexors dorsiflexors invertors evertors and foot intrinsics'),
      'secondaryMuscles',jsonb_build_array('abdominal wall','gluteal musculature','standing-foot and lower-leg stabilizers'),
      'joints',jsonb_build_array('cervical spine','scapulothoracic articulation and shoulder complex','elbow and radioulnar joints','wrist and hand','thoracic and lumbar spine with pelvis','hips','knees including tibial rotation only within comfortable controllable range','ankles subtalar joints and feet'),
      'jointActions',jsonb_build_array('cervical flexion side-bending extension and rotation combined into a controlled circle','shoulder flexion abduction extension and internal-external rotation with scapular control','elbow flexion extension and forearm pronation-supination','wrist flexion extension and radial-ulnar deviation','controlled spinal flexion side-bending extension and rotation within the declared circle','hip flexion abduction extension adduction and internal-external rotation','knee flexion extension with only the comfortable tibial rotation available in the exact supported position','ankle dorsiflexion plantarflexion inversion and eversion'),
      'planes',jsonb_build_array('sagittal','frontal','transverse','multi-planar circumduction where anatomically applicable'),
      'laterality','bilateral sequence with left and right sides completed separately for unilateral limb joints; both directions are recorded per region and side',
      'supportContacts',jsonb_build_array('both feet on the floor during the standing sequence','optional light hand contact on an inspected wall only in the exact wall-supported variant'),
      'compensationBoundary','The nonmoving regions are stabilized only to the extent needed for a repeatable active joint circle; forced bracing end range or identical bilateral range is not required.',
      'evidenceBoundary','Sources support slow deliberate active pain-free no-momentum joint rotations and full-body routines, not this order as a universal standard or exact tissue adaptation diagnosis or outcome.'),
    jsonb_build_object(
      'whyItMatters','Provides one reproducible low-load whole-body mobility and control flow when the workout calls for all eight declared regions rather than one isolated joint.',
      'primaryCue','Move one announced joint slowly, stay in your comfortable controllable range, return to neutral, then change side or region.',
      'expectedSensations',jsonb_build_array('light muscular effort around the moving joint','a controllable range that may differ by side','balance and concentration demand during standing transitions'),
      'unexpectedSensations',jsonb_build_array('sharp or increasing pain or pinching','dizziness faintness unusual headache or vision change','numbness tingling weakness unsteady gait or loss of balance','forced range breath holding or compensation that cannot be reduced'),
      'painGuidance','Stop the current region and the flow, return to a stable neutral position, signal the coach, and follow facility escalation policy; never push through or repeat to test symptoms.',
      'selfChecks',jsonb_build_array('coach announces the exact region side and direction','movement stays slow and momentum-free','range remains comfortable and controllable','other regions do not take over the circle','neutral is regained before the next side or region','every omitted or modified region is reported'),
      'accessibility',jsonb_build_array('plain-language and demonstrated one-region-at-a-time cues','exact wall-supported standing variant','smaller range slower pace fewer circles and rest between regions','visual side and direction markers','select joint-specific or separately reviewed seated cards when the complete exact flow is unsuitable'),
      'mediaAlternatives',jsonb_build_array('written eight-region checklist','coach demonstration by region','still images for start and neutral checkpoints','auditory region-side-direction prompts'),
      'notReadinessSkillAgeOrClinicalClassification',TRUE),
    jsonb_build_object(
      'observationChecklist',jsonb_build_array('exact variant support and station','region order side and direction','active joint action and neutral checkpoint','momentum speed and breath holding','nonmoving-region compensation','balance symptoms and communication','actual circles omissions invalid attempts duration and exit'),
      'faultCorrections',jsonb_build_object(
        'momentum_or_rushing','reduce range and pace; restart only when the athlete can control the circle',
        'compensation','stabilize or reduce range; do not chase a larger circle by moving another region',
        'balance_loss','stop and use the exact wall-supported variant only after full revalidation',
        'pain_or_pinching','stop that region and the flow; do not diagnose or force another attempt',
        'order_side_or_direction_missed','return to neutral and record the omission; repeat only if dose and symptoms remain appropriate'),
      'demonstrationPlan','Show the exact neck-to-ankle order, side and direction convention, independent or wall-supported base, one slow circle, neutral checkpoint, common compensation, invalid pain-through example, stop signal, and safe exit.',
      'groupManagement',jsonb_build_array('one athlete per arm-span station','announce one region side and direction at a time','place supported athletes at inspected walls without cross traffic','maintain front and side sightlines','record omissions modifications symptoms and first fault'),
      'modificationDecisionTree',jsonb_build_array('stop for pain neurologic symptoms dizziness or unsafe balance','reduce range circles or pace','increase rest','select the exact wall-supported variant after complete revalidation','select a joint-specific card when only one region or a partial sequence is appropriate','refer assessment or treatment questions per facility policy'),
      'doNotUseWhen',jsonb_build_array('any included region is prohibited or cannot move comfortably and controllably','the athlete cannot maintain a safe standing or exact wall-supported base','the phase lacks enough time for all declared regions and sides','clinical assessment treatment or readiness clearance is the purpose'),
      'noDiagnosisTreatmentOrGuaranteedTransfer',TRUE),
    jsonb_build_object(
      'issueCategories',jsonb_build_array('identity sequence or variant mismatch','joint side direction or action omission','pain neurologic dizziness or balance incident','space wall support or traffic defect','dose duration fatigue or downstream-load mismatch','media instruction accessibility or rendering conflict','clinical scope or escalation error'),
      'supportEscalation',jsonb_build_object('urgent','stop stabilize and follow emergency policy for acute neurologic cardiopulmonary severe pain faintness or fall concerns','clinical','route symptom diagnosis eligibility and return questions to qualified care per facility policy','content','quarantine conflicting sequence anatomy cue dose media or identity until qualified review'),
      'retentionPolicy','Persist definition variant support region order planned and actual circles by side and direction range or support modifications valid invalid partial and symptom-limited regions first fault symptoms stop reason rest duration substitution and library generator rendering versions under facility policy.',
      'changeImpactPolicy','Any sequence support posture joint action side direction dose stop media identity or symptom change invalidates cached selection duration logistics substitution persistence and coach and athlete rendering and requires full revalidation.',
      'feedbackChannels',jsonb_build_array('athlete comfort balance symptom and clarity report','coach sequence compensation first-fault and station report','support incident content and media-review queue'),
      'noApprovalInference',TRUE)
  )
  ON CONFLICT(id) DO UPDATE SET
    facility_id=EXCLUDED.facility_id,legacy_exercise_id=EXCLUDED.legacy_exercise_id,
    slug=EXCLUDED.slug,canonical_name=EXCLUDED.canonical_name,display_name=EXCLUDED.display_name,
    aliases=EXCLUDED.aliases,description=EXCLUDED.description,family_key=EXCLUDED.family_key,
    schema_version=EXCLUDED.schema_version,card_version=EXCLUDED.card_version,status='review',
    content_confidence=EXCLUDED.content_confidence,scoring_confidence=EXCLUDED.scoring_confidence,
    media_confidence=EXCLUDED.media_confidence,movement_patterns=EXCLUDED.movement_patterns,
    body_regions=EXCLUDED.body_regions,required_equipment=EXCLUDED.required_equipment,
    optional_equipment=EXCLUDED.optional_equipment,environment_json=EXCLUDED.environment_json,
    population_json=EXCLUDED.population_json,provenance_json=EXCLUDED.provenance_json,
    approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,last_reviewed_at=NULL,
    anatomy_json=EXCLUDED.anatomy_json,athlete_support_json=EXCLUDED.athlete_support_json,
    coach_support_json=EXCLUDED.coach_support_json,support_operations_json=EXCLUDED.support_operations_json,
    updated_at=now();

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
      'selectable',TRUE,'exactSequence',jsonb_build_array('neck','shoulders','elbows','wrists','spine','hips','knees','ankles'),
      'support',v.support,'equipment',to_jsonb(v.equipment),'posture','standing',
      'directionRule','both_directions_for_every_region','sideRule','left_and_right_for_unilateral_limb_regions',
      'validCompletion','all_declared_regions_sides_and_directions_complete_with_slow_control_no_momentum_no_prohibited_compensation_no_symptoms_and_neutral_checkpoint_between_transitions',
      'invalidCompletion',jsonb_build_array('region_side_or_direction_omitted','wrong_order','momentum_or_rushing','forced_or_painful_range','uncontrolled_compensation','balance_loss','symptom_stop','neutral_checkpoint_missed'),
      'clinicalAssessmentOrTreatment',FALSE,'humanReviewRequired',TRUE),
    'review',
    jsonb_build_object(
      'loadingType','bodyweight_active_range_multi_region_flow','externalLoadMethod','bodyweight_with_'||v.support,
      'gripDemand',1,'spinalLoading',8,'eccentricStress',6,
      'landingContactsPerRep',0,'handImpactContactsPerRep',0,'impactClass','none',
      'jointCirclesPerCompleteFlow','actual_sum_by_region_side_and_direction',
      'primaryExposure',jsonb_build_array('active_joint_range','standing_balance','multi_region_transitions','total_flow_time'),
      'tracking',jsonb_build_array('variant','region','side','direction','circles','range_modification','support','compensation','symptoms','duration','same_session_joint_loading')),
    jsonb_build_object(
      'localMuscleFatigue',10,'gripFatigue',1,'technicalFatigueSensitivity',48,
      'impactAccumulation',1,'recoveryHours',4,
      'primaryFatigueSites',jsonb_build_array('joint_specific_stabilizers','standing_foot_and_lower_leg','trunk_and_balance_system','attention'),
      'cumulativeBudget',jsonb_build_object('totalJointCircles',64,'standingMinutes',20,'technicalSensitivity',48,'impact',1),
      'interference',jsonb_build_array('high_priority_joint_specific_loading','fatigue_that_changes_active_range_or_balance','same_session_end_range_or_rehabilitation_work'),
      'recoveryIsPlanningEstimate',TRUE),
    jsonb_build_object(
      'trainingStimuli',jsonb_build_array('active_multi_joint_range_control','joint_by_joint_body_awareness','low_load_standing_balance','controlled_transitions'),
      'stimulusDose',jsonb_build_object('sets',jsonb_build_array(1,2),'circlesPerRegionSideDirection',jsonb_build_array(1,3),'tempo','slow_no_momentum','restSeconds',jsonb_build_array(0,60)),
      'weeklyExposure',jsonb_build_object('minimum',0,'maximumWithoutReview',7,'unit','complete_flows','contextDependent',TRUE),
      'prerequisites',jsonb_build_array('all_included_regions_allowed','safe_'||v.support,'understands_region_side_direction_and_stop_prompts','pain_free_controllable_range','can_return_to_neutral'),
      'completionCriteria',jsonb_build_array('all_eight_regions_in_order','both_applicable_directions','both_sides_where_applicable','slow_no_momentum_control','no_prohibited_compensation','neutral_between_regions','no_stop_symptoms'),
      'sequenceRules',jsonb_build_array('prepare_or_restore_context_only','do_not_silently_omit_regions','complete_high_priority_output_before_restore_use','revalidate_downstream_joint_loading'),
      'pairingCompatibility',jsonb_build_object('compatible',jsonb_build_array('low_load_breathing','light locomotion when joint exposure allows'),'avoid',jsonb_build_array('fatiguing_end_range_loading','symptom_provoking_mobility','time_critical_output_when_flow_would_displace_priority_work')),
      'interferenceRules',jsonb_build_array('reduce_or_omit_only_by_selecting_another_card','stop_before_control_or_balance_changes','count_overlapping_joint_specific_loading'),
      'uncertaintyPolicy','When exact region action support symptom status sequence or time is uncertain do not select; request clarification or choose a separately validated joint-specific card.',
      'selectionStatus','review_only_machine_complete','publicationQuarantined',TRUE,
      'exerciseDifficultyDescribesTaskOnly',TRUE,'approvalsCreated',FALSE)
  FROM (VALUES
    (independent_variant,'standing-independent-eight-region-sequence','Full-Body Joint CARs Flow — Standing Independent',ARRAY['standing','independent']::TEXT[],38,8,42,20,18,14,'independent_no_external_support',ARRAY['none']::TEXT[]),
    (wall_variant,'standing-wall-supported-lower-body-sequence','Full-Body Joint CARs Flow — Wall-Supported Lower-Body Segments',ARRAY['standing','wall_supported']::TEXT[],42,6,44,18,14,12,'light_wall_support_during_hip_knee_and_ankle_segments',ARRAY['wall']::TEXT[])
  ) v(id,variant_key,display_name,modifier_keys,complexity,physical,coordination,supervision,failure,capacity,support,equipment)
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
  SELECT p.id,p.variant_id,p.profile_key,p.phase_key,p.role,
    CASE p.phase_key WHEN 'prepare_and_access' THEN
      'Complete the exact eight-region flow as a low-load access and control scan without diagnosing, treating, or clearing any joint.'
    ELSE 'Complete the exact eight-region flow at a low controlled dose to restore movement options without displacing symptom management or recovery.' END,
    CASE p.phase_key WHEN 'prepare_and_access' THEN 88 ELSE 78 END,
    CASE p.phase_key WHEN 'prepare_and_access' THEN 84 ELSE 72 END,
    jsonb_build_object('mobility',95,'movement_control',90,'balance',CASE WHEN p.variant_id=independent_variant THEN 70 ELSE 50 END,'recovery',CASE WHEN p.phase_key='restore' THEN 82 ELSE 60 END),
    jsonb_build_object('sets',jsonb_build_array(1,2),'circlesPerRegionSideDirection',jsonb_build_array(1,3),'tempo','slow_deliberate_no_momentum','restSeconds',jsonb_build_array(0,60),'completeSequenceRequired',TRUE),
    'All eight regions occur in order; applicable sides and both directions are completed slowly in comfortable controllable range; support matches the exact variant; no momentum prohibited compensation symptoms or missed neutral checkpoint occurs.',
    ARRAY['Sharp or increasing pain, pinching, guarding, or participant stop request.',
      'Dizziness, faintness, unusual headache, vision change, nausea, unsteady gait, or loss of balance.',
      'Numbness, tingling, weakness, radiating symptoms, new neurologic sign, or inability to communicate.',
      'Momentum, rushing, breath holding, or compensation cannot be corrected by reducing range or pace.',
      'Wrong region, side, direction, order, support, or a missed neutral checkpoint cannot be corrected safely.',
      'Wall, floor, footwear, space, traffic, sightline, communication, or emergency exit becomes unsafe.',
      'Planned joint-circle, standing-time, technical-fatigue, or same-session joint-loading budget is reached.',
      'The flow would become assessment, treatment, readiness clearance, passive stretching, or a different exercise identity.']::TEXT[],
    'Verify the exact variant, station, order, support, planned circle count, region permissions, symptoms, and downstream joint loading. Announce one region, side, and direction at a time; observe the active joint, compensation, balance, breathing, and neutral checkpoint; log every omission, modification, invalid attempt, stop, and substitution. Do not diagnose, force range, or treat the flow as clearance.',
    'Use the exact support shown by the coach. Move the announced joint slowly through a comfortable range without momentum, complete both directions and each required side, return to neutral, then wait for the next region. Stop and report pain, pinching, dizziness, numbness, tingling, weakness, headache, vision change, or lost balance.',
    'More consistent low-load active control and awareness across the exact eight-region sequence; no treatment, injury-prevention, readiness, structural, or performance outcome is guaranteed.',
    CASE WHEN p.variant_id=independent_variant THEN ARRAY['none']::TEXT[] ELSE ARRAY['wall']::TEXT[] END,
    jsonb_build_object('stationCapacity',1,'space','one_arm_span','wallRequired',p.variant_id=wall_variant,'setupSeconds',CASE WHEN p.variant_id=wall_variant THEN 30 ELSE 20 END,'transitionSecondsPerRegion',8,'coachSightline','front_and_side','crossTrafficProhibited',TRUE,'revalidateAfterAnyChange',TRUE),
    CASE WHEN p.variant_id=independent_variant THEN ARRAY[wall_variant]::UUID[] ELSE ARRAY[independent_variant]::UUID[] END,
    'review',
    jsonb_build_object('durationFormula','setup_seconds + sum(actual_circles * seconds_per_circle) + side_changes + region_transitions + rest_seconds + invalid_attempt_seconds + support_changes + safe_exit_seconds','secondsPerCircle',jsonb_build_array(6,15),'regionCount',8,'includeActualNotPlanned',TRUE,'recomputeAfterSubstitution',TRUE),
    jsonb_build_object('regressionOrder',jsonb_build_array('reduce_range','reduce_circles','slow_pace','increase_rest',CASE WHEN p.variant_id=independent_variant THEN 'select_wall_supported_exact_variant' ELSE 'select_joint_specific_card' END),'progressionOrder',jsonb_build_array('complete_one_quality_circle_each_direction','increase_to_two_or_three_only_if_controlled','reduce_unneeded_support_only_by_variant_change'),'neverScaleByForcingEndRange',TRUE),
    jsonb_build_object('record',jsonb_build_array('variant','region_order','side','direction','planned_and_actual_circles','range_or_support_modification','valid_invalid_partial_and_symptom_limited_regions','first_fault','symptoms','stop_reason','rest','duration','substitution'),'validUnit','one_region_side_direction_circle_returning_to_neutral','completeFlowRequiresAllDeclaredUnits',TRUE),
    jsonb_build_object('athlete',jsonb_build_array('region_side_direction','slow_comfortable_range','neutral_checkpoint','symptom_and_balance_stop'),'coach',jsonb_build_array('support_and_station','active_joint_and_compensation','order_and_omissions','clinical_scope','logging_and_escalation'),'accessibility',jsonb_build_array('demonstration','written_sequence','visual_direction_marker','wall_supported_exact_variant','rest_and_smaller_range'))
  FROM (VALUES
    ('33fbd465-158c-47b3-aaac-cbc76e81e0ef'::UUID,independent_variant,'prepare-independent-complete-flow','prepare_and_access','primary'),
    ('3c31fda2-b722-452f-85a9-d4d687e3930b'::UUID,independent_variant,'restore-independent-low-dose','restore','secondary'),
    ('112bf800-ce45-4099-a2e5-acb166f3e5aa'::UUID,wall_variant,'prepare-wall-supported-complete-flow','prepare_and_access','secondary'),
    ('e0785709-e2d8-451f-9120-12c7089289c5'::UUID,wall_variant,'restore-wall-supported-low-dose','restore','primary')
  ) p(id,variant_id,profile_key,phase_key,role)
  ON CONFLICT(id) DO UPDATE SET
    variant_id=EXCLUDED.variant_id,profile_key=EXCLUDED.profile_key,phase_key=EXCLUDED.phase_key,
    role=EXCLUDED.role,purpose=EXCLUDED.purpose,phase_suitability=EXCLUDED.phase_suitability,
    methodology_alignment=EXCLUDED.methodology_alignment,objective_relevance_json=EXCLUDED.objective_relevance_json,
    dosage_json=EXCLUDED.dosage_json,quality_gate=EXCLUDED.quality_gate,stop_rules=EXCLUDED.stop_rules,
    coach_instructions=EXCLUDED.coach_instructions,athlete_instructions=EXCLUDED.athlete_instructions,
    expected_adaptation=EXCLUDED.expected_adaptation,equipment_required=EXCLUDED.equipment_required,
    logistics_json=EXCLUDED.logistics_json,substitution_ids=EXCLUDED.substitution_ids,status='review',
    time_model_json=EXCLUDED.time_model_json,dose_scaling_json=EXCLUDED.dose_scaling_json,
    measurement_json=EXCLUDED.measurement_json,support_prompts_json=EXCLUDED.support_prompts_json,updated_at=now();

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,rationale,
    evidence_json,resolution_source,reviewed_by,resolved_at)
  SELECT 1,canonical_definition,b.right_id,'distinct_exercises',b.rationale,
    jsonb_build_object('migration',migration_key,'identityBoundary',b.boundary_key,
      'leftContract','complete_eight_region_ordered_flow',
      'rightContract',b.right_contract,'legacyOrderIsReviewContract',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'deterministic_identity_equivalence',NULL,now()
  FROM (VALUES
    (neck_definition,'full_flow_vs_neck_only','Neck CARs is one cervical task and omits the other seven declared regions.','cervical_only'),
    (hip_definition,'full_flow_vs_hip_only','Hip CARs is one hip task with its own standing or quadruped base and omits the full sequence.','hip_only'),
    (wall_hip_definition,'full_flow_vs_wall_hip_only','Wall-Supported Hip CARs uses wall support for a unilateral hip task, not the complete eight-region flow.','wall_supported_hip_only'),
    (ankle_definition,'full_flow_vs_ankle_only','Ankle CARs is one foot and ankle task and omits the other regions.','ankle_only'),
    (shoulder_definition,'full_flow_vs_shoulder_only','Arm Circles or Shoulder CARs is an upper-limb task and may permit different tempo or momentum.','shoulder_only'),
    (quadruped_shoulder_definition,'full_flow_vs_quadruped_shoulder','Quadruped Shoulder Circles changes support, load, action, and repetition boundary.','quadruped_closed_chain_shoulder'),
    (cat_cow_definition,'full_flow_vs_cat_cow','Cat-Cow is quadruped spinal flexion-extension rather than the ordered multi-region flow.','quadruped_spinal_flexion_extension'),
    (spinal_circle_definition,'full_flow_vs_quadruped_spinal_circle','Quadruped Spinal Circles is one closed-chain spine and pelvis task, not the complete flow.','quadruped_spine_pelvis_circle')
  ) b(right_id,boundary_key,rationale,right_contract)
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,resolved_at=now();

  INSERT INTO coaching.exercise_section_evidence_v1(
    definition_id,reviewed_card_version,section_key,source_url,source_title,
    source_publisher,source_kind,claims_json,evidence_quality,review_status,
    reviewer_user_id,reviewed_at)
  SELECT canonical_definition,2,e.section_key,e.source_url,e.source_title,e.publisher,
    e.source_kind,jsonb_build_array(
      jsonb_build_object('supported',e.supported_claim,'scope',e.scope),
      jsonb_build_object('limitation',e.limitation,'noUniversalOrderTechniqueSafetyEligibilityDoseRecoveryOutcomeOrDifficultyClaim',TRUE)),
    e.quality,'candidate',NULL,NULL
  FROM (VALUES
    ('identity','https://www.acefitness.org/continuing-education/certified/october-2024/8725/controlled-articular-rotations-shifting-mobility-into-high-gear/','Controlled Articular Rotations: Shifting Mobility into High Gear','American Council on Exercise','professional_standard','ACE describes slow deliberate active pain-free joint rotations without momentum and recognizes full-body programs.','professional CARs definition and scope','ACE does not validate the legacy eight-region order or this exact card.',88),
    ('taxonomy','https://www.acefitness.org/continuing-education/certified/october-2024/8725/controlled-articular-rotations-shifting-mobility-into-high-gear/','Controlled Articular Rotations: Shifting Mobility into High Gear','American Council on Exercise','professional_standard','The observable task is active multi-planar joint rotation and control rather than passive stretching or fast momentum circles.','professional exercise taxonomy context','The source does not create Vortex controlled terms or approval.',88),
    ('anatomy','https://www.acefitness.org/continuing-education/certified/october-2024/8725/controlled-articular-rotations-shifting-mobility-into-high-gear/','Controlled Articular Rotations: Shifting Mobility into High Gear','American Council on Exercise','professional_standard','Each articulation moves through the directions and planes applicable to that joint while the rest of the body limits compensation.','joint-specific active range instruction','It does not quantify tissue forces or define one perfect circle.',88),
    ('biomechanics','https://www.acefitness.org/continuing-education/certified/october-2024/8725/controlled-articular-rotations-shifting-mobility-into-high-gear/','Controlled Articular Rotations: Shifting Mobility into High Gear','American Council on Exercise','professional_standard','CARs use controlled active motion without momentum, with pain pinching and compensation treated as relevant observations.','active movement and compensation context','It does not diagnose joint health or prove structural adaptation.',88),
    ('difficulty','https://www.acefitness.org/continuing-education/certified/october-2024/8725/controlled-articular-rotations-shifting-mobility-into-high-gear/','Controlled Articular Rotations: Shifting Mobility into High Gear','American Council on Exercise','professional_standard','The full flow adds multi-region memory side direction balance compensation and transition demands despite low external load.','professional task comparison','No source assigns a Vortex score or athlete classification.',88),
    ('load_fatigue_recovery','https://markowtrainingsystems.com/wp-content/uploads/2020/02/2020KinstretchStarterPack.pdf','Kinstretch Starter Pack','Markow Training Systems','expert_instruction','The starter material presents controlled active circles and example repetitions rather than a high-repetition calorie task.','expert routine and dose context','It does not validate universal loading fatigue or recovery.',74),
    ('constraints','https://www.acefitness.org/continuing-education/certified/october-2024/8725/controlled-articular-rotations-shifting-mobility-into-high-gear/','Controlled Articular Rotations: Shifting Mobility into High Gear','American Council on Exercise','professional_standard','ACE distinguishes general exercise use from individualized assessment diagnosis and injury treatment requiring appropriate education and scope.','professional scope and delivery constraint','It does not establish universal eligibility or facility logistics.',88),
    ('dosage','https://markowtrainingsystems.com/wp-content/uploads/2020/02/2020KinstretchStarterPack.pdf','Kinstretch Starter Pack','Markow Training Systems','expert_instruction','The starter pack gives two to five repetitions per joint as one daily-practice example.','expert example dose','The example is not a validated universal workout prescription.',74),
    ('instructions','https://kinstretchwithbeard.vhx.tv/class-focus-full-body/videos/beginnervideo-6-carsfollowalong-1080-high','CARs Follow Along Routine — Full Body','Kinstretch with Beard','expert_instruction','The follow-along emphasizes focus minimizing compensation never pushing through pain and backing out of painful range.','full-body follow-along instruction','It does not approve the exact legacy order or every cue.',72),
    ('safety_stop_rules','https://pmc.ncbi.nlm.nih.gov/articles/PMC12620902/','Clinical Practice Guideline: Nonspecific Neck Pain','Deutsches Ärzteblatt International','professional_standard','Neurologic deficits numbness paresthesia dizziness unsteady gait and visual disturbance are clinically relevant warning findings.','clinical red-flag context for a flow containing neck motion','The guideline is not a CARs protocol and does not authorize diagnosis by a coach.',94),
    ('programming','https://www.acefitness.org/continuing-education/certified/october-2024/8725/controlled-articular-rotations-shifting-mobility-into-high-gear/','Controlled Articular Rotations: Shifting Mobility into High Gear','American Council on Exercise','professional_standard','ACE describes basic CARs concepts in warm-up cool-down or mobility routines while reserving clinical assessment and treatment.','professional programming scope','It does not establish Vortex phase placement dose frequency or outcome.',88),
    ('athlete_support','https://kinstretchwithbeard.vhx.tv/class-focus-full-body/videos/beginnervideo-6-carsfollowalong-1080-high','CARs Follow Along Routine — Full Body','Kinstretch with Beard','expert_instruction','Direct guidance emphasizes focus compensation awareness pain-free range and backing out rather than forcing.','plain-language participant guidance','It does not establish universal symptom meaning or accessibility.',72),
    ('coach_support','https://www.acefitness.org/continuing-education/certified/october-2024/8725/controlled-articular-rotations-shifting-mobility-into-high-gear/','Controlled Articular Rotations: Shifting Mobility into High Gear','American Council on Exercise','professional_standard','Pain pinching compensation active range and professional scope are observable coaching concerns.','professional observation and scope','It does not authorize diagnosis treatment or readiness clearance.',88),
    ('accessibility','https://kinstretchwithbeard.vhx.tv/class-focus-full-body/videos/beginnervideo-6-carsfollowalong-1080-high','CARs Follow Along Routine — Full Body','Kinstretch with Beard','expert_instruction','The source describes lower-intensity and different-base full-body routines, showing posture is not a universal hidden constant.','expert alternate-base context','A different base still requires an exact separately reviewed variant.',72),
    ('alternates','https://kinstretchwithbeard.vhx.tv/class-focus-full-body/videos/beginnervideo-6-carsfollowalong-1080-high','CARs Follow Along Routine — Full Body','Kinstretch with Beard','expert_instruction','Full-body routines may vary base intensity and included presentations while joint-specific CARs remain distinct tasks.','expert alternate context','No alternate becomes an approved variant or substitution without review.',72),
    ('media','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en','Embed videos and playlists','YouTube Help','manufacturer_instruction','Four legacy candidate URLs returned current YouTube oEmbed title channel thumbnail and iframe metadata on 2026-08-02.','candidate metadata and embed format only','oEmbed does not prove playback exact sequence actions sides captions accessibility cue quality safety conflicts reviewer identity or approval.',82)
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
    'legacy candidate checked by YouTube oEmbed',NULL,NULL,'2026-11-02'::TIMESTAMPTZ,
    'Current oEmbed metadata only. Playback and exact eight-region order, actions, sides, posture, dose, captions, accessibility, cue quality, safety, conflicts, reviewer identity, card version, and approval remain unverified.'
  FROM (VALUES
    ('6p1OHgpmVwU','Full Body CARs Routine','The Jiu-Jitsu Therapist'),
    ('AyJ3omVBIho','Morning Routine - Functional Range Conditioning - Full Body CARs','Melissa Ray Fitness'),
    ('m9Ar5qvCUbg','Follow-Along FULL BODY CARS Routine (30 min)','Vegan CornHub'),
    ('p_WqlqgfNrc','Mobility Routine for Every Day and Every Joint! (Full Body CARS)','Breathe and Flow')
  ) m(video_id,title,channel)
  ON CONFLICT(definition_id,reviewed_card_version,url) DO UPDATE SET
    variant_id=NULL,embed_url=EXCLUDED.embed_url,video_id=EXCLUDED.video_id,title=EXCLUDED.title,
    channel_name=EXCLUDED.channel_name,duration_seconds=NULL,language_code='en',
    captions_available=NULL,embedding_allowed=TRUE,exact_variant_match=NULL,
    demonstration_quality_score=NULL,link_status='healthy',review_status='candidate',
    discovery_method='manual_research',source_query=EXCLUDED.source_query,
    reviewer_user_id=NULL,reviewed_at=NULL,next_review_at=EXCLUDED.next_review_at,
    notes=EXCLUDED.notes,updated_at=now();

  INSERT INTO coaching.exercise_alternate_assessment_v1(
    definition_id,reviewed_card_version,alternate_name,classification,rationale,
    distinguishing_dimensions,proposed_card_json,review_status,reviewer_user_id,reviewed_at)
  SELECT canonical_definition,2,a.name,a.classification,a.rationale,
    jsonb_build_object('boundaryKey',a.boundary_key,'factsRequired',a.facts,
      'neverInferFromNameAgeSkillOrAthleteRanking',TRUE),
    jsonb_build_object('status',a.proposed_status,'classificationCandidate',a.classification,
      'humanIdentityContentAndSafetyReviewRequired',TRUE,'approvalsCreated',FALSE),
    'candidate',NULL,NULL
  FROM (VALUES
    ('Full-Body CARs Flow','same_identity','Direct alias only when the exact eight-region order sides directions support and checkpoints remain.','direct_alias',jsonb_build_array('order','sides','directions','support','checkpoints'),'research_queue'),
    ('Head-to-Toe CARs Routine','same_identity','Alias only when mapped to this exact Vortex sequence rather than an arbitrary routine.','conditional_alias',jsonb_build_array('all_eight_regions','exact_order','completion'),'research_queue'),
    ('Standing Independent Full-Body CARs','same_identity','Authored exact independent standing variant.','independent_variant',jsonb_build_array('standing','no_support','balance','sequence'),'authored_variant'),
    ('Wall-Supported Full-Body CARs','same_identity','Authored exact wall-supported lower-body segment variant.','wall_variant',jsonb_build_array('wall','contact','segments','sequence'),'authored_variant'),
    ('Low-Intensity Full-Body CARs','modifier_annotation','Intensity remains a dose annotation only within an exact support variant and complete sequence.','intensity_annotation',jsonb_build_array('range','tension','circles','tempo'),'delivery_annotation'),
    ('Circles Directions Tempo and Rest','modifier_annotation','Dose and cadence remain annotations only when identity and completion remain exact.','dose_annotation',jsonb_build_array('circles','directions','tempo','rest'),'delivery_annotation'),
    ('Seated Full-Body CARs Flow','new_variant','A seated base changes hip knee ankle spine and balance execution and is not yet fully specified.','seated_variant_quarantine',jsonb_build_array('seat','support','joint_actions','sequence','exit'),'needs_human_review'),
    ('Neck CARs','new_definition','Cervical-only task omits the remaining seven regions.','neck_distinct',jsonb_build_array('neck_only','stop_rules','dose'),'existing_distinct_definition'),
    ('Hip CARs — Standing or Quadruped','new_definition','Hip-only task has its own base side actions and endpoint.','hip_distinct',jsonb_build_array('hip_only','base','side','actions'),'existing_distinct_definition'),
    ('Wall-Supported Hip CARs','new_definition','Wall-supported unilateral hip task omits the complete flow.','wall_hip_distinct',jsonb_build_array('wall','hip_only','side'),'existing_distinct_definition'),
    ('Ankle CARs','new_definition','Ankle-only task omits the remaining regions.','ankle_distinct',jsonb_build_array('ankle_only','side','actions'),'existing_distinct_definition'),
    ('Arm Circles / Shoulder CARs','new_definition','Shoulder-only action may use a different tempo or momentum contract.','shoulder_distinct',jsonb_build_array('shoulder_only','tempo','momentum'),'existing_distinct_definition'),
    ('Quadruped Shoulder Circles','new_definition','Closed-chain quadruped support changes load and repetition boundary.','quadruped_shoulder_distinct',jsonb_build_array('quadruped','closed_chain','scapula','shoulder'),'existing_distinct_definition'),
    ('Cat-Cow','new_definition','Quadruped flexion-extension is not a multi-region CARs flow.','cat_cow_distinct',jsonb_build_array('quadruped','flexion','extension'),'existing_distinct_definition'),
    ('Quadruped Spinal Circles','new_definition','One closed-chain spine and pelvis circle task omits the other regions.','spinal_circle_distinct',jsonb_build_array('quadruped','spine','pelvis'),'existing_distinct_definition'),
    ('Fast Momentum-Driven Joint Circle Warm-Up','new_definition','Speed momentum and reduced control replace deliberate CARs execution.','fast_circle_distinct',jsonb_build_array('speed','momentum','range','purpose'),'research_queue'),
    ('Passive Full-Body Stretching Sequence','new_definition','Passive holds or external assistance replace active controlled joint circles.','passive_stretch_distinct',jsonb_build_array('passive','holds','assistance'),'research_queue'),
    ('Yoga Mobility Flow','new_definition','Pose transitions contacts breath rules and endpoints differ from the declared sequence.','yoga_flow_distinct',jsonb_build_array('poses','transitions','contacts','breath'),'research_queue'),
    ('Clinician CARs Assessment or Injury Treatment','new_definition','Assessment diagnosis treatment and clearance change authority measurements purpose and escalation.','clinical_scope_distinct',jsonb_build_array('assessment','diagnosis','treatment','clearance'),'clinical_scope'),
    ('Pain-Through or Neurologic-Symptom CARs','reject','Forcing painful dizzy neurologic unstable or uncontrolled motion violates the valid-range and stop contract.','unsafe_reject',jsonb_build_array('pain','dizziness','neurologic','balance','forcing'),'rejected_behavior')
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
      'revalidate',jsonb_build_array('identity','included regions','support','joint restrictions','purpose','dose','fatigue and same-session joint loading','duration','logistics','persistence','coach rendering','athlete rendering'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'review',NULL,NULL,NULL
  FROM (VALUES
    (independent_variant,wall_variant,'equipment_equivalent',82,ARRAY['equipment','support','balance','complexity','physical_difficulty']::TEXT[],'Adds light wall support during lower-body segments while retaining the complete sequence; support contact setup logistics and score change.'),
    (wall_variant,independent_variant,'equipment_equivalent',82,ARRAY['equipment','support','balance','complexity','physical_difficulty']::TEXT[],'Removes wall support and increases independent balance demand while retaining the complete sequence.'),
    (independent_variant,neck_variant,'regression',58,ARRAY['mobility','range','complexity','duration']::TEXT[],'Uses a neck-only card when the full sequence is not the workout purpose; this changes identity and is never automatic.'),
    (independent_variant,hip_variant,'regression',58,ARRAY['mobility','range','complexity','duration']::TEXT[],'Uses a hip-only card when one region is intended; base side and actions require revalidation.'),
    (independent_variant,ankle_variant,'regression',58,ARRAY['mobility','range','complexity','duration']::TEXT[],'Uses an ankle-only card when one region is intended; identity dose and rendering change.'),
    (independent_variant,shoulder_variant,'regression',58,ARRAY['mobility','range','complexity','duration']::TEXT[],'Uses a shoulder-only card when one region is intended; tempo momentum and action contract require revalidation.')
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
  SELECT 1,v.id,d.dimension,
    CASE d.dimension WHEN 'technicalComplexity' THEN v.complexity ELSE v.physical END,
    CASE d.dimension WHEN 'technicalComplexity' THEN 40 ELSE 20 END,
    CASE d.dimension WHEN 'technicalComplexity' THEN
      'Review-only exercise-complexity anchor based on eight-region order, region-side-direction memory, joint-specific control, compensation monitoring, balance, support management, and neutral transitions.'
    ELSE 'Review-only physical-difficulty anchor based on low-load active range, standing duration, balance, joint-specific muscular effort, and variant support.' END
      ||' This scores the exercise task, not athlete proficiency. Variant: '||v.variant_key||'.',
    'review',1,NULL,NULL,'Research-informed proposal only; independent comparison and qualified human approval remain required.',NULL
  FROM (VALUES
    (independent_variant,'standing-independent-eight-region-sequence',38,8),
    (wall_variant,'standing-wall-supported-lower-body-sequence',42,6)
  ) v(id,variant_key,complexity,physical)
  CROSS JOIN (VALUES('technicalComplexity'),('absoluteLoadDemand')) d(dimension)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
    proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,reviewed_by=NULL,
    review_notes=EXCLUDED.review_notes,reviewed_at=NULL,updated_at=now();

  UPDATE coaching.exercise SET
    name='Full-Body Joint CARs Flow',slug='full-body-joint-cars-flow',
    description='Complete the exact neck, shoulders, elbows, wrists, spine, hips, knees, and ankles sequence with the selected independent or wall-supported standing variant. Move each joint slowly through comfortable controllable circles in both directions and on each relevant side, minimize momentum and compensation, return to neutral, then transition.',
    instructions='Select the exact canonical support variant and record the planned circles. In the fixed order neck, shoulders, elbows, wrists, spine, hips, knees, and ankles, move only the announced joint slowly through a comfortable controllable circle, complete both directions and each required side, then return to a stable neutral checkpoint. Reduce range instead of using momentum or another region. Stop for pain, pinching, dizziness, faintness, unusual headache, vision change, numbness, tingling, weakness, unsteady gait, lost balance, or inability to regain neutral. This is exercise, not diagnosis or treatment.',
    skill_level=NULL,age_min=NULL,age_max=NULL,default_sets=1,default_reps=1,
    default_work_seconds=NULL,default_rest_seconds=30,
    tempo='slow deliberate no-momentum circles with a neutral checkpoint between sides and regions',
    load_note='Track actual circles by region side and direction, range or support modifications, standing time, balance, symptoms, invalid or omitted regions, and same-session joint-specific loading.',
    est_seconds_per_set=480,is_published=FALSE,archived=FALSE,
    card_summary='Exact eight-region active-range flow with independent standing or wall-supported lower-body segments as separate variants.',
    coach_language='Verify the exact variant, station, region permissions, symptoms, fixed order, side and direction convention, circle dose, balance, wall contact, active-joint motion, compensation, neutral checkpoints, omissions, actual duration, downstream loading, stop response, and clinical scope.',
    athlete_language='Move one announced joint slowly through a comfortable range, complete both directions and required sides, return to neutral, and stop for pain, dizziness, neurologic symptoms, or lost balance.',
    programming_logic=jsonb_build_object('selectionStatus','canonical_variant_required','selectable',TRUE,
      'canonicalDefinitionId',canonical_definition,'exactVariantIds',to_jsonb(active_variant_ids),
      'difficultyModel','max_exercise_complexity_physical_difficulty','exerciseDifficultyDescribesTaskOnly',TRUE,
      'selectionInputs',jsonb_build_array('workout purpose','all included region restrictions','standing and balance support','space and wall access','symptoms','circle dose and duration','same-session joint loading','coach scope and sightline'),
      'substitutionRevalidation',jsonb_build_array('identity','included regions and order','support','joint restrictions and symptoms','purpose','dose','fatigue and joint budgets','duration','logistics','persistence','coach rendering','athlete rendering'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    scalable_variables=ARRAY['circles_per_region_side_direction','range','tempo','rest_seconds','wall_support','sets']::TEXT[],
    movement_family='Ordered Full-Body Joint CARs Flow',primary_phase_key=NULL,
    phase_subrole=NULL,primary_order_slot=NULL,
    movement_requirements=jsonb_build_object('selectable',TRUE,'canonicalVariantRequired',TRUE,
      'exactOrder',jsonb_build_array('neck','shoulders','elbows','wrists','spine','hips','knees','ankles'),
      'directionRule','both_directions','sideRule','both_sides_for_unilateral_limb_regions',
      'mustMaintain',jsonb_build_array('exact_support','slow_no_momentum_control','comfortable_active_range','minimal_compensation','neutral_checkpoint','safe_balance','communication'),
      'mustNotAdd',jsonb_build_array('forced_end_range','passive_assistance','clinical_assessment_or_treatment','fast_momentum_circles','silent_omission','different_pose_flow'),
      'validCompletion','all_declared_regions_sides_and_directions_complete_in_order_with_neutral_checkpoints_no_symptoms_and_exact_support'),
    coaching_execution=jsonb_build_object('qualityGates',jsonb_build_array('variant_and_station_exact','all_regions_allowed','order_side_direction_correct','slow_controlled_active_range','compensation_managed','neutral_between_transitions','safe_balance_and_no_symptoms'),
      'stopRules',jsonb_build_array('pain_or_pinching','dizziness_faintness_headache_or_vision_change','numbness_tingling_weakness_or_unsteady_gait','loss_of_balance','uncontrolled_compensation_or_momentum','wrong_sequence_or_support','unsafe_station_or_wall','budget_or_duration_reached'),
      'persistence',jsonb_build_array('definition_and_variant','region_order','planned_and_actual_circles_by_side_and_direction','range_and_support_modifications','valid_invalid_partial_omitted_and_symptom_limited_regions','first_fault','symptoms_and_stop_reason','rest','duration','substitution')),
    pairing_logic=jsonb_build_object('sameSessionBudget',jsonb_build_array('joint_circles_by_region','standing_time','active_end_range','balance_and_attention','overlapping_joint_specific_loading'),
      'avoidAutomaticPairingWith',jsonb_build_array('fatiguing_end_range_work','symptom_provoking_mobility','time_critical_output_when_flow_displaces_priority_work'),'revalidateAfterSubstitution',TRUE),
    media_library=jsonb_build_object('candidate_video_ids',jsonb_build_array('6p1OHgpmVwU','AyJ3omVBIho','m9Ar5qvCUbg','p_WqlqgfNrc'),
      'reviewState','oembed_metadata_only_candidate_quarantine','playbackExactnessOrderActionsSidesCaptionsAccessibilityQualitySafetyAndApprovalVerified',FALSE,'humanReviewRequired',TRUE),
    programming_kind='exercise',linked_skill_id=NULL,why_publish_ready=FALSE,updated_at=now()
  WHERE id=23;

  UPDATE coaching.exercise_safety_profile SET
    risk_level=1,impact_level=0,minimum_age_recommended=NULL,minimum_skill_level=NULL,
    requires_spotting=FALSE,requires_coach_supervision='recommended',
    minimum_prerequisite_notes='Readiness is evaluated from all included joint restrictions, current symptoms, safe independent or exact wall-supported standing, ability to follow region side and direction prompts, controllable pain-free range, and workout context; never from an exercise proficiency or age label.',
    readiness_checks=ARRAY['Confirm the exact support variant, stable floor, arm-span clearance, wall inspection when selected, sightline, communication, and safe exit.','Confirm every included region is allowed and no current symptom or restriction conflicts with the flow.','Confirm the athlete can follow region side and direction prompts, reduce range, return to neutral, and stop on command.','Review same-session joint-specific loading, active-end-range work, standing time, balance demand, and available duration.']::TEXT[],
    stop_signs=ARRAY['Sharp or increasing pain, pinching, guarding, or participant stop request.','Dizziness, faintness, unusual headache, visual change, nausea, unsteady gait, or loss of balance.','Numbness, tingling, weakness, radiating symptoms, or another new neurologic sign.','Momentum, compensation, wrong sequence, support loss, or missed neutral checkpoint cannot be corrected safely.','Station, wall, floor, traffic, communication, supervision, duration, or safe exit becomes inadequate.']::TEXT[],
    contraindications=ARRAY['Any included region is prohibited or cannot move comfortably and controllably.','Current symptoms or clinical restrictions conflict with neck or multi-region active motion.','No safe standing or exact wall-supported base, floor, space, sightline, communication, or exit.','The intended service is diagnosis treatment injury management readiness clearance passive stretching or another exercise identity.']::TEXT[],
    common_substitutions=ARRAY['Select the exact wall-supported variant only after full support equipment dose duration and logistics revalidation.','Select the exact independent variant only after balance and all-region readiness revalidation.','Select Neck CARs, Hip CARs, Ankle CARs, Shoulder CARs, or another joint-specific card when one region is intended.','Do not silently omit regions, switch to seated or quadruped bases, add passive assistance, force range, or convert the flow into assessment or treatment.']::TEXT[]
  WHERE exercise_id=23;

  UPDATE coaching.exercise_score_v1 SET
    technical_complexity=42,absolute_load_demand=6,coordination_demand=44,
    impact=1,supervision_demand=18,base_overall_difficulty=greatest(42,6),
    legacy_scores=coalesce(legacy_scores,'{}'::JSONB)||jsonb_build_object(
      'candidateReassessment',migration_key,
      'projectionScope','wall_supported_variant_representative_highest_complexity_variant',
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'variantScores',jsonb_build_object(
        'standingIndependent',jsonb_build_object('complexity',38,'physicalDifficulty',8,'overall',38),
        'wallSupported',jsonb_build_object('complexity',42,'physicalDifficulty',6,'overall',42)),
      'exerciseScoresDescribeTaskOnly',TRUE,'independentCalibrationRequired',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    migration_confidence=62,human_review_status='queued',reviewed_by=NULL,reviewed_at=NULL,
    review_notes='Research-informed candidate reassessment only. Scores describe exercise complexity and physical difficulty, not athlete proficiency. Exact sequence actions support symptoms and independent calibration remain required.',updated_at=now()
  WHERE exercise_id=23;

  UPDATE coaching.exercise_difficulty_profile SET
    technical=4.2,complexity=4.2,load=1.0,overall=4.2,
    recommended_age_min=NULL,recommended_age_max=NULL,attention_demand='moderate',
    notes='Candidate projection from the wall-supported exact variant, the highest-complexity current variant. The legacy 1-10 load field is floor-bounded at 1.0; canonical physical difficulty is 6/100. This is not athlete proficiency or age classification.',
    source='canonical_research_candidate',updated_at=now()
  WHERE exercise_id=23;

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  VALUES(canonical_definition,1,2,'2.0.0',migration_key,'quarantined',
    jsonb_build_object(
      'identity',jsonb_build_object('passed',TRUE,'identityKey','ordered_full_body_joint_cars_flow','legacySources',1,'activeVariants',2,'archivedSourceSkeleton',TRUE,'jointSpecificCardsRemainDistinct',TRUE),
      'taxonomy',jsonb_build_object('passed',TRUE,'controlledTerms',TRUE,'movementPatterns',jsonb_build_array('rotate','brace'),'bodyRegions',9,'equipment',jsonb_build_array('none','wall')),
      'anatomy',jsonb_build_object('passed',TRUE,'musclesJointsActionsPlanesLateralitySupportAndCompensation',TRUE),
      'difficulty',jsonb_build_object('passed',TRUE,'model','max_exercise_complexity_physical_difficulty','variantVectors',jsonb_build_array('38/8/38','42/6/42'),'athleteClassificationAbsent',TRUE,'independentCalibrationRequired',TRUE),
      'loadFatigueRecovery',jsonb_build_object('passed',TRUE,'actualCirclesStandingTimeBalanceAndJointExposureTracked',TRUE,'scoreFloorOneForNoImpact',TRUE,'recoveryIsPlanningEstimate',TRUE),
      'constraints',jsonb_build_object('passed',TRUE,'regionRestrictionsSymptomsStandingSupportSpaceTrafficScopeAndExit',TRUE),
      'delivery',jsonb_build_object('passed',TRUE,'profiles',4,'prepareAndRestoreOnly',TRUE,'durationDoseRestStationAndSubstitutionRevalidation',TRUE),
      'instructions',jsonb_build_object('passed',TRUE,'athleteCoachAccessibilityAndSupportOperations',TRUE,'sequenceSideDirectionCompensationSymptomsAndClinicalScope',TRUE),
      'research',jsonb_build_object('passed',TRUE,'sections',16,'registryVersion',research_version,'legacyOrderIsReviewContractNotUniversalStandard',TRUE),
      'media',jsonb_build_object('passed',FALSE,'candidateCount',4,'currentOEmbedMetadataHealthy',TRUE,'playbackReviewed',FALSE,'exactSequenceReviewed',FALSE,'captionsAccessibilityQualitySafetyAndApprovalReviewed',FALSE),
      'relationships',jsonb_build_object('passed',FALSE,'reviewOnly',6,'approved',0),
      'calibration',jsonb_build_object('passed',FALSE,'reviewOnly',4,'approved',0),
      'alternates',jsonb_build_object('passed',TRUE,'assessments',20,'identityBoundaries',8,'clinicalScopeBoundaryExplicit',TRUE),
      'generationSupport',jsonb_build_object('passed',TRUE,'selectionConstraints',TRUE,'cumulativeBudgets',TRUE,'duration',TRUE,'equipmentAndStation',TRUE,'substitutionRevalidation',TRUE,'renderingAndPersistence',TRUE),
      'publication',jsonb_build_object('passed',FALSE,'reviewer',NULL,'approver',NULL)),
    jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01','message','A qualified human must watch all four candidates in full and verify playback, exact definition and variant, eight-region order, actions, sides, directions, support, compensation, dose, captions, accessibility, cue quality, safety, conflicts, reviewer identity, timestamp, card version, and approval rationale.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','A qualified coach must approve or reject every support-equivalent and joint-specific regression proposal; no automatic substitution from a complete flow to a partial joint task is authorized.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','An independent qualified reviewer must calibrate exercise complexity and physical difficulty for both exact variants. Scores do not classify an athlete or create an age or skill level.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','A qualified reviewer and separate approver must complete content review before publication. The exact sequence, anatomy, support, dose, stop, scope, accessibility, and support rules remain quarantined.')),
    TRUE,now())
  ON CONFLICT(definition_id) DO UPDATE SET
    facility_id=EXCLUDED.facility_id,card_version=EXCLUDED.card_version,
    schema_version=EXCLUDED.schema_version,audit_version=EXCLUDED.audit_version,
    status='quarantined',checks_json=EXCLUDED.checks_json,
    blocking_issues_json=EXCLUDED.blocking_issues_json,human_review_required=TRUE,
    checked_at=now();

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition AND status='review' AND card_version=2
        AND schema_version='2.0.0' AND approved_video_url IS NULL
        AND reviewed_by IS NULL AND approved_by IS NULL AND last_reviewed_at IS NULL
        AND movement_patterns=ARRAY['rotate','brace']::TEXT[]
        AND anatomy_json<>'{}'::JSONB AND environment_json<>'{}'::JSONB
        AND population_json<>'{}'::JSONB AND athlete_support_json<>'{}'::JSONB
        AND coach_support_json<>'{}'::JSONB AND support_operations_json<>'{}'::JSONB
        AND provenance_json->>'approvalsCreated'='false')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source_variant AND status='archived'
        AND requirements_json->>'representation'='superseded_source_skeleton') THEN
    RAISE EXCEPTION '% definition or source quarantine assertion failed',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(active_variant_ids) AND definition_id=canonical_definition AND status='review'
        AND requirements_json->>'selectable'='true'
        AND (difficulty_json->>'technicalComplexity')::INTEGER BETWEEN 1 AND 100
        AND (difficulty_json->>'physicalDifficulty')::INTEGER BETWEEN 1 AND 100
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=greatest(
          (difficulty_json->>'technicalComplexity')::INTEGER,
          (difficulty_json->>'physicalDifficulty')::INTEGER)
        AND (load_profile_json->>'landingContactsPerRep')::INTEGER=0
        AND (fatigue_profile_json->>'impactAccumulation')::INTEGER=1
        AND programming_profile_json->>'publicationQuarantined'='true')<>2 THEN
    RAISE EXCEPTION '% active variant assertion failed',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=ANY(active_variant_ids) AND status='review'
        AND cardinality(equipment_required)>0
        AND coalesce(time_model_json->>'durationFormula','')<>''
        AND dose_scaling_json<>'{}'::JSONB AND measurement_json<>'{}'::JSONB
        AND support_prompts_json<>'{}'::JSONB AND length(coach_instructions)>=100
        AND length(athlete_instructions) BETWEEN 10 AND 420
        AND cardinality(stop_rules)>=8)<>4
    OR (SELECT count(DISTINCT section_key) FROM coaching.exercise_section_evidence_v1
      WHERE definition_id=canonical_definition AND reviewed_card_version=2
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>16
    OR (SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=canonical_definition AND reviewed_card_version=2
        AND link_status='healthy' AND review_status='candidate' AND embedding_allowed
        AND captions_available IS NULL AND exact_variant_match IS NULL
        AND demonstration_quality_score IS NULL AND reviewer_user_id IS NULL
        AND reviewed_at IS NULL)<>4
    OR (SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id=canonical_definition AND reviewed_card_version=2
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>20
    OR (SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE from_variant_id=ANY(active_variant_ids) AND review_status='review'
        AND reviewed_by IS NULL)<>6
    OR (SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(active_variant_ids) AND status='review'
        AND reviewed_by IS NULL)<>4
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=canonical_definition AND decision='distinct_exercises'
        AND reviewed_by IS NULL)<>8 THEN
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
      WHERE v.id=ANY(active_variant_ids)
        AND NOT EXISTS(SELECT 1 FROM coaching.equipment allowed WHERE allowed.key=key)) THEN
    RAISE EXCEPTION '% uncontrolled taxonomy was authored',migration_key;
  END IF;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=23
      AND skill_level IS NULL AND age_min IS NULL AND age_max IS NULL
      AND linked_skill_id IS NULL AND is_published=FALSE
      AND programming_kind='exercise' AND why_publish_ready=FALSE)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1 WHERE exercise_id=23
      AND technical_complexity=42 AND absolute_load_demand=6
      AND base_overall_difficulty=42 AND human_review_status='queued'
      AND reviewed_by IS NULL AND reviewed_at IS NULL)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=canonical_definition AND card_version=2
        AND status='quarantined' AND human_review_required=TRUE
        AND jsonb_array_length(blocking_issues_json)=4) THEN
    RAISE EXCEPTION '% legacy projection or packet assertion failed',migration_key;
  END IF;
END
$migration$;
