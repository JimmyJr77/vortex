-- Source 28: consolidate the duplicate Open Book definitions into one exact
-- side-lying, stacked-knee, long-arm open-and-return variant. Evidence, media,
-- relationships, calibration, and publication remain candidate/review-only.
-- This migration creates no human approval and no exercise-card participant level.
DO $migration$
DECLARE
  migration_key CONSTANT TEXT := '498_coaching_side_lying_open_book_identity_and_family_audit_hardening';
  research_version CONSTANT TEXT := '2026-08-09.95';
  canonical_definition UUID;
  duplicate_definition UUID;
  prior_duplicate_definition UUID;
  source_variant UUID;
  duplicate_variant UUID;
  prior_duplicate_variant UUID;
  open_book_variant UUID;
  active_variant_ids UUID[];
  all_owned_variant_ids UUID[];
  thread_definition UUID;
  thread_variant UUID;
  cat_cow_definition UUID;
  cat_cow_variant UUID;
  circle_definition UUID;
  circle_variant UUID;
  protected_count INTEGER;
BEGIN
  SELECT definition_id INTO canonical_definition FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=28;
  SELECT id INTO duplicate_definition FROM coaching.exercise_definition_v1 WHERE legacy_exercise_id=891;
  SELECT id INTO prior_duplicate_definition FROM coaching.exercise_definition_v1 WHERE legacy_exercise_id=1306;
  SELECT id INTO source_variant FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='baseline';
  SELECT id INTO duplicate_variant FROM coaching.exercise_variant_v1 WHERE definition_id=duplicate_definition AND variant_key='baseline';
  SELECT id INTO prior_duplicate_variant FROM coaching.exercise_variant_v1 WHERE definition_id=duplicate_definition AND variant_key='legacy-source-1306-baseline';
  SELECT id INTO open_book_variant FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='stacked-knee-long-arm-open-and-return';
  open_book_variant := coalesce(open_book_variant,gen_random_uuid());
  SELECT definition_id INTO thread_definition FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=27;
  SELECT id INTO thread_variant FROM coaching.exercise_variant_v1 WHERE definition_id=thread_definition AND variant_key='quadruped-thread-and-open';
  SELECT definition_id INTO cat_cow_definition FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=25;
  SELECT id INTO cat_cow_variant FROM coaching.exercise_variant_v1 WHERE definition_id=cat_cow_definition AND variant_key='standard-coordinated-quadruped-cycle';
  SELECT definition_id INTO circle_definition FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=26;
  SELECT id INTO circle_variant FROM coaching.exercise_variant_v1 WHERE definition_id=circle_definition AND variant_key='fixed-contact-global-spinal-circle';
  active_variant_ids := ARRAY[open_book_variant];
  all_owned_variant_ids := ARRAY[source_variant,duplicate_variant,prior_duplicate_variant,open_book_variant];

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=28 AND facility_id=1)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=891 AND facility_id=1)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=1306 AND facility_id=1)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition AND legacy_exercise_id=28)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=duplicate_definition AND legacy_exercise_id=891)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=prior_duplicate_definition AND legacy_exercise_id=1306)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source_variant AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=duplicate_variant AND definition_id=duplicate_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=prior_duplicate_variant AND definition_id=duplicate_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=thread_variant AND definition_id=thread_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=cat_cow_variant AND definition_id=cat_cow_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=circle_variant AND definition_id=circle_definition AND status='review')
    OR (SELECT count(*) FROM coaching.exercise_score_v1 WHERE exercise_id IN(28,891,1306))<>3
    OR (SELECT count(*) FROM coaching.exercise_difficulty_profile WHERE exercise_id IN(28,891,1306))<>3
    OR (SELECT count(*) FROM coaching.exercise_safety_profile WHERE exercise_id IN(28,891,1306))<>3 THEN
    RAISE EXCEPTION '% prerequisite source or neighbor rows are missing',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=open_book_variant AND definition_id<>canonical_definition)
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE slug='side-lying-open-book' AND id<>canonical_definition) THEN
    RAISE EXCEPTION '% working UUID or slug already belongs to another card',migration_key;
  END IF;

  SELECT coalesce(sum(n),0) INTO protected_count FROM (
    SELECT count(*) n FROM coaching.exercise_definition_v1
      WHERE id IN(canonical_definition,duplicate_definition,prior_duplicate_definition)
        AND (status IN('published','deprecated') OR reviewed_by IS NOT NULL
          OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)
    UNION ALL SELECT count(*) FROM coaching.exercise_section_evidence_v1
      WHERE definition_id IN(canonical_definition,duplicate_definition,prior_duplicate_definition)
        AND (reviewer_user_id IS NOT NULL OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id IN(canonical_definition,duplicate_definition,prior_duplicate_definition)
        AND (reviewer_user_id IS NOT NULL OR reviewed_at IS NOT NULL
          OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id IN(canonical_definition,duplicate_definition,prior_duplicate_definition)
        AND (reviewer_user_id IS NOT NULL OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_card_review_v1
      WHERE definition_id IN(canonical_definition,duplicate_definition,prior_duplicate_definition)
    UNION ALL SELECT count(*) FROM coaching.exercise_card_revision_v1
      WHERE definition_id IN(canonical_definition,duplicate_definition,prior_duplicate_definition)
    UNION ALL SELECT count(*) FROM coaching.exercise_media_review_v1
      WHERE definition_id IN(canonical_definition,duplicate_definition,prior_duplicate_definition)
    UNION ALL SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=ANY(all_owned_variant_ids) OR to_variant_id=ANY(all_owned_variant_ids))
        AND (reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL OR review_status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(all_owned_variant_ids)
        AND (reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL OR status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE (survivor_definition_id IN(canonical_definition,duplicate_definition,prior_duplicate_definition)
          OR resolved_definition_id IN(canonical_definition,duplicate_definition,prior_duplicate_definition))
        AND (reviewed_by IS NOT NULL OR resolution_source='human_review')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_v1
      WHERE exercise_id IN(28,891,1306)
        AND (human_review_status<>'queued' OR reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL)
  ) protected;
  IF protected_count<>0 THEN
    RAISE EXCEPTION '% refuses to overwrite % human-reviewed records',migration_key,protected_count;
  END IF;

  UPDATE coaching.exercise_section_evidence_v1 SET
    review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now()
  WHERE definition_id IN(canonical_definition,duplicate_definition,prior_duplicate_definition)
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_media_candidate_v1 SET
    review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
    exact_variant_match=NULL,demonstration_quality_score=NULL,updated_at=now()
  WHERE definition_id IN(canonical_definition,duplicate_definition,prior_duplicate_definition)
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_alternate_assessment_v1 SET
    review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now()
  WHERE definition_id IN(canonical_definition,duplicate_definition,prior_duplicate_definition)
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  DELETE FROM coaching.exercise_relationship_v1
  WHERE (from_variant_id=ANY(all_owned_variant_ids) OR to_variant_id=ANY(all_owned_variant_ids))
    AND reviewed_by IS NULL AND review_status<>'approved';
  DELETE FROM coaching.exercise_score_calibration_v1
  WHERE variant_id=ANY(all_owned_variant_ids) AND reviewed_by IS NULL AND status<>'approved';

  DELETE FROM coaching.exercise_identity_resolution_v1
  WHERE survivor_definition_id=duplicate_definition
    AND resolved_definition_id=prior_duplicate_definition
    AND reviewed_by IS NULL AND resolution_source<>'human_review';

  UPDATE coaching.exercise_definition_source_v1 SET
    source_kind='legacy_migration',
    provenance_json=jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'sourceDisposition','canonical_survivor_reauthored',
      'sourceInterpretation','source 28 supplies the side-lying knees-stacked top-arm opening identity but omits exact repetition counting taxonomy anatomy cumulative budgets logistics persistence and review contracts',
      'exactWorkingSpecification','stacked_knee_long_arm_open_and_return',
      'researchSources',jsonb_build_array(
        'https://www.leedsth.nhs.uk/patients/resources/physiotherapy-exercises-for-breast-pain-with-chest-wall-musculoskeletal-symptoms/',
        'https://www.dynamichealth.nhs.uk/help-and-advice/mid-back-pain/',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC3096141/',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC7173996/',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC10508241/'),
      'exerciseDifficultyDescribesTaskOnly',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=28 AND definition_id=canonical_definition;

  DELETE FROM coaching.exercise_definition_source_v1
  WHERE legacy_exercise_id IN(891,1306)
    AND definition_id IN(duplicate_definition,prior_duplicate_definition);
  INSERT INTO coaching.exercise_definition_source_v1(
    definition_id,legacy_exercise_id,source_kind,provenance_json)
  SELECT canonical_definition,s.legacy_id,'duplicate_consolidation',
    jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'sourceDisposition','exact_duplicate_definition_consolidated',
      'retiredDefinitionId',s.retired_definition,
      'retiredVariantIds',s.retired_variants,
      'survivorDefinitionId',canonical_definition,
      'preservedVariantId',open_book_variant,
      'identityReason','the source preserves the same side-lying bent-stacked-knee forward-arm-stack top-arm opening trunk-rotation and controlled-return contract; title side range breath and dose do not create a second definition',
      'legacyClassificationAndPublicationClaimsUnsupported',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  FROM (VALUES
    (891,duplicate_definition,jsonb_build_array(duplicate_variant,prior_duplicate_variant)),
    (1306,prior_duplicate_definition,jsonb_build_array(prior_duplicate_variant))
  ) s(legacy_id,retired_definition,retired_variants)
  ON CONFLICT(legacy_exercise_id) DO UPDATE SET
    definition_id=EXCLUDED.definition_id,source_kind='duplicate_consolidation',
    provenance_json=EXCLUDED.provenance_json;

  UPDATE coaching.exercise_delivery_profile_v1 SET status='archived',updated_at=now()
  WHERE variant_id IN(source_variant,duplicate_variant,prior_duplicate_variant);
  UPDATE coaching.exercise_variant_v1 SET
    variant_key=CASE id
      WHEN source_variant THEN 'identity-quarantine-source-28'
      WHEN duplicate_variant THEN 'identity-quarantine-source-891'
      ELSE 'identity-quarantine-source-1306' END,
    display_name=CASE id
      WHEN source_variant THEN 'Side-Lying Open Book Legacy Skeleton — Source 28'
      WHEN duplicate_variant THEN 'Open Book Rotation Duplicate Skeleton — Source 891'
      ELSE 'Open Book T-Spine Rotation Duplicate Skeleton — Source 1306' END,
    modifier_keys='{}'::TEXT[],difficulty_json='{}'::JSONB,status='archived',
    requirements_json=jsonb_build_object(
      'selectable',FALSE,'representation','superseded_source_skeleton',
      'sourceLegacyExerciseId',CASE id WHEN source_variant THEN 28 WHEN duplicate_variant THEN 891 ELSE 1306 END,
      'archiveReason','duplicate or incomplete skeleton replaced by the exact stacked-knee long-arm open-and-return variant',
      'replacementVariantIds',to_jsonb(active_variant_ids),
      'survivorDefinitionId',canonical_definition,'humanReviewRequired',TRUE),
    load_profile_json=jsonb_build_object('selectable',FALSE),
    fatigue_profile_json=jsonb_build_object('selectable',FALSE),
    programming_profile_json=jsonb_build_object(
      'selectionStatus','superseded_source_skeleton','selectable',FALSE,
      'publicationQuarantined',TRUE),updated_at=now()
  WHERE id IN(source_variant,duplicate_variant,prior_duplicate_variant);

  UPDATE coaching.exercise_definition_v1 SET
    status='archived',approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,
    last_reviewed_at=NULL,
    provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'sourceDisposition','duplicate_definition_archived',
      'survivorDefinitionId',canonical_definition,
      'preservedVariantId',open_book_variant,
      'selectable',FALSE,'publicationQuarantined',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),updated_at=now()
  WHERE id IN(duplicate_definition,prior_duplicate_definition);

  INSERT INTO coaching.exercise_definition_v1(
    id,facility_id,legacy_exercise_id,slug,canonical_name,display_name,aliases,
    description,family_key,schema_version,card_version,status,
    content_confidence,scoring_confidence,media_confidence,movement_patterns,
    body_regions,required_equipment,optional_equipment,environment_json,
    population_json,provenance_json,approved_video_url,reviewed_by,approved_by,
    last_reviewed_at,anatomy_json,athlete_support_json,coach_support_json,
    support_operations_json)
  VALUES(
    canonical_definition,1,28,'side-lying-open-book',
    'Side-Lying Open Book','Side-Lying Open Book',
    ARRAY['Side Lying Open Book','Side-Lying Open Books','Open Book Rotation','Open Book Rotations','Open Book T-Spine Rotation','Open Book T Spine Rotation','Side-Lying Thoracic Rotation'],
    'Lie on one side with hips and knees comfortably bent and stacked, both straight arms stacked at shoulder height in front, and the pelvis comparatively stable. Move the top arm in a controlled arc while the rib cage and trunk rotate open. Stop at comfortable controllable range without requiring the hand to touch the floor, then return along the declared path until the hands stack. That return is one repetition. Perform and record each side separately. Range, pace, dose, brief end hold, gaze strategy, and stable comfort props are delivery annotations. A different leg base, mandatory windmill path, bent-arm rib pull, manual force, external resistance, wall base, or assessment protocol is another task.',
    'side_lying_open_and_return_rotation','2.0.0',2,'review',
    84,62,50,ARRAY['rotate','reach']::TEXT[],
    ARRAY['spine','thoracic_spine','rib_cage','core','shoulder','scapula','neck','pelvis','hip','knee']::TEXT[],
    '{}'::TEXT[],ARRAY['mat_optional']::TEXT[],
    jsonb_build_object(
      'surface','flat dry stable nonslip floor with optional stable mat and enough comfort for side-lying contact and safe entry and exit',
      'space','one side-lying station with full top-arm arc and head trunk pelvis knee and foot clearance and no cross traffic',
      'stationCapacity',1,'optionalEquipmentKey','mat_optional',
      'comfortProps','a stable thin head towel or small knee comfort support may be annotated only when exact leg geometry and movement remain unchanged',
      'coachSightline','overhead or front-oblique view for knee and pelvis stability plus side view for arm path trunk rotation range breathing symptoms and return',
      'inspection',jsonb_build_array('floor traction cleanliness and clutter','mat or comfort support stability','full arm-arc clearance','head shoulder rib pelvis hip knee and foot comfort','cross traffic','communication and emergency route','safe floor entry side change and exit'),
      'changeRule','Changing leg base arm path support equipment beyond comfort force purpose symptoms dose or downstream loading requires full selection duration logistics substitution persistence and rendering revalidation.'),
    jsonb_build_object(
      'exerciseCardDoesNotClassifyParticipants',TRUE,'readinessIsWorkoutInput',TRUE,
      'selectionPrerequisites',jsonb_build_array('safe floor entry side change and exit','comfortable side-lying contact','comfortable controllable trunk rib and top-shoulder range','can keep bent knees together and pelvis comparatively stable','understands one full open-and-return repetition side and stop signal','no conflicting trauma symptom restriction or service-scope concern'),
      'excludeOrEscalate',jsonb_build_array('recent significant trauma procedure or surgery without applicable clearance','severe progressive radiating or unfamiliar spinal chest rib shoulder or joint pain','new numbness tingling weakness saddle sensory change or bowel or bladder change','dizziness faintness nausea visual change or loss of orientation with head movement','side-lying floor-transfer shoulder or knee symptoms that prevent exact setup','known clinical restriction conflicting with trunk rotation shoulder opening or side lying','participant requests stop or cannot communicate reliably'),
      'notEstablishedByEvidence',jsonb_build_array('universal eligibility','isolated thoracic rotation','normal or required rotation angle','hand-to-floor endpoint','universal cervical or breathing strategy','symptom treatment','injury prevention','structural correction','one dose frequency recovery interval or progression','readiness for later training')),
    jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'canonicalAuthoredFromResearch',TRUE,
      'primaryIdentitySource','https://www.leedsth.nhs.uk/patients/resources/physiotherapy-exercises-for-breast-pain-with-chest-wall-musculoskeletal-symptoms/',
      'legacySources',jsonb_build_array(28,891,1306),
      'identityContract','side_lying_bent_stacked_knees_forward_stacked_straight_arms_top_arm_opens_with_trunk_rotation_and_returns_to_restack_hands_each_side_recorded',
      'researchSources',jsonb_build_array('https://www.leedsth.nhs.uk/patients/resources/physiotherapy-exercises-for-breast-pain-with-chest-wall-musculoskeletal-symptoms/','https://www.dynamichealth.nhs.uk/help-and-advice/mid-back-pain/','https://pmc.ncbi.nlm.nih.gov/articles/PMC3096141/','https://pmc.ncbi.nlm.nih.gov/articles/PMC7173996/','https://pmc.ncbi.nlm.nih.gov/articles/PMC10508241/'),
      'confidenceBySection',jsonb_build_object('identity',84,'taxonomy',82,'anatomy',70,'difficulty',62,'load',64,'fatigueRecovery',54,'constraints',80,'dosage',66,'instructions',84,'alternates',86,'media',50),
      'unresolvedClaims',jsonb_build_array('one universal leg angle isolated thoracic motion hand-to-floor endpoint cervical strategy breathing phase dose frequency recovery or progression','injury prevention structural correction diagnosis treatment or readiness outcome','numeric difficulty calibration','media playback exact setup path range captions accessibility quality safety and approval'),
      'externalPlaybackVerificationPerformed',FALSE,'sourceLimitationsExplicit',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,'publicationQuarantined',TRUE),
    NULL,NULL,NULL,NULL,
    jsonb_build_object(
      'primaryMuscles',jsonb_build_array('external_oblique','internal_oblique','multifidus','rotatores','erector_spinae'),
      'secondaryMuscles',jsonb_build_array('posterior_deltoid','infraspinatus','teres_minor','middle_trapezius','rhomboids'),
      'stabilizers',jsonb_build_array('deep_trunk_stabilizers','gluteus_medius','hip_adductors','rotator_cuff','scapular_stabilizers'),
      'rangeExposedTissues',jsonb_build_array('pectoralis_major','pectoralis_minor','anterior_shoulder','thoracic_paraspinals','intercostal_region'),
      'joints',jsonb_build_array('thoracic_intervertebral_joints','lumbar_intervertebral_joints','costovertebral_and_costotransverse_joints','glenohumeral_joint','scapulothoracic_articulation','cervical_intervertebral_joints_when_gaze_follows','hip_joint','knee_joint'),
      'jointActions',jsonb_build_array('thoracolumbar_axial_rotation','rib_cage_rotation','top_shoulder_horizontal_abduction_or_transverse_extension','top_scapular_retraction','controlled_reverse_actions_to_return','optional_cervical_rotation_with_gaze'),
      'planes',jsonb_build_array('transverse_primary','coupled_sagittal_or_frontal_accommodation_not_separately_prescribed'),
      'laterality','one side-lying base and contralateral top arm rotate at a time; left-side and right-side repetitions are recorded separately',
      'supportContacts',jsonb_build_array('dependent_side_of_head_or_support','dependent_shoulder_and_lateral_trunk','dependent_pelvis_and_thigh','stacked_bent_knees_and_lower_legs','bottom_arm'),
      'contactRule','Bent knees remain together and supported while the pelvis stays comparatively stable; the moving top arm opens and returns without forcing an end-range floor contact.',
      'phaseSequence',jsonb_build_array('side_lying_setup','hands_stacked_start','top_arm_opens_with_trunk_and_rib_rotation','comfortable_controlled_endpoint','same_path_return','hands_restack_counted_repetition','side_change','safe_exit'),
      'isolationBoundary','The task is modeled as global thoracolumbar and rib-cage rotation because thoracic rotation cannot be assumed clinically isolated.',
      'evidenceBoundary','Sources define observable position and motion but do not quantify muscle force tissue loading vertebral contribution normal range or treatment effect.'),
    jsonb_build_object(
      'whyItMatters','Provides one reproducible low-load side-lying open-and-return rotation task when the workout calls for trunk and rib-cage rotation without quadruped support.',
      'primaryCue','Keep the bent knees together, open the top arm and chest only through comfortable controlled range, then restack the hands to count one repetition.',
      'expectedSensations',jsonb_build_array('light trunk and shoulder effort','comfortable rotation through the rib cage and trunk','gentle chest or anterior shoulder range exposure','stable side-lying leg support'),
      'unexpectedSensations',jsonb_build_array('sharp increasing radiating or unfamiliar pain','numbness tingling weakness saddle sensory or bowel or bladder change','dizziness faintness nausea visual change or disorientation','painful shoulder rib chest hip knee or floor transfer','forced range breath holding knee separation or pelvic rolling'),
      'painGuidance','Stop in the safest supported position, signal the coach, and follow facility escalation policy; never repeat to test symptoms or force the hand toward the floor.',
      'selfChecks',jsonb_build_array('knees remain together and supported','pelvis stays comparatively stable','top arm and chest move together','range stays comfortable and controlled','hands restack to count one repetition','each side is recorded separately','no floor contact is required at end range'),
      'accessibility',jsonb_build_array('overhead and side demonstration','written start-open-return strip','named working side','supported neutral head instead of mandatory gaze follow','optional stable mat or thin comfort support','smaller range fewer repetitions slower pace and rest','select a separately validated non-floor or support-changing task when needed'),
      'mediaAlternatives',jsonb_build_array('written phase sequence','coach demonstration from overhead and side','still images for stacked start controlled open endpoint and return','auditory open return and restack prompts'),
      'notReadinessOrClinicalClassification',TRUE),
    jsonb_build_object(
      'observationChecklist',jsonb_build_array('exact variant and side-lying station','floor entry side change and exit','bent stacked knees and comparatively stable pelvis','forward hand stack and long top-arm path','trunk rib shoulder scapular and optional head motion','comfortable range pace breathing symptoms and first fault','actual repetitions rest duration substitution and exit'),
      'faultCorrections',jsonb_build_object(
        'knees_separate_or_pelvis_rolls','reduce range or use a small stable comfort cue only if exact support remains unchanged; otherwise stop and select another card',
        'arm_moves_without_trunk','reduce speed and cue chest and rib cage to follow the top arm without forcing',
        'forced_floor_reach','end at the last comfortable controlled range and never require hand contact',
        'shoulder_or_head_discomfort','reduce range use supported neutral head or stop and reselect if exact task is not tolerated',
        'momentum_or_breath_hold','reduce range and pace add rest and do not count the repetition',
        'wrong_task','stop and select the separately authored windmill rib-pull split-leg wall quadruped resisted assisted or assessment card after full revalidation'),
      'demonstrationViews',jsonb_build_array('overhead_or_front_oblique_for_knees_pelvis_and_arm_arc','side_for_trunk_range_head_strategy_and_return'),
      'groupManagement',jsonb_build_object('stationCapacity',1,'fullArmArcClearanceRequired',TRUE,'crossTrafficProhibited',TRUE,'coachMustSeeBothSides',TRUE,'sideChangeAndExitObserved',TRUE),
      'scopeBoundary','Coach observes and stops the task but does not diagnose manipulate prescribe treatment force range or clear symptoms.'),
    jsonb_build_object(
      'issueEscalation',jsonb_build_object('urgent','follow facility emergency policy for severe or progressive neurologic chest breathing fainting trauma or other emergency signs','clinical','refer symptoms restrictions post-procedure questions or suspected pathology to qualified clinical care','content','quarantine identity anatomy dose or instruction ambiguity for qualified review','media','keep every candidate unapproved until full current-version review'),
      'retention',jsonb_build_array('definition and exact variant','legacy source lineage','side','planned and actual complete repetitions per side','range tempo hold rest and props','valid invalid partial and symptom-limited attempts','knee pelvis arm trunk and head observations','first fault','symptoms and stop reason','active-range shoulder-arc and floor-work seconds','duration','substitution','floor entry side change and exit','coach and athlete feedback'),
      'changeImpact','Any identity support leg geometry arm path force purpose symptom dose surface or downstream-load change invalidates cached selection duration logistics substitution persistence and coach or athlete rendering and requires full revalidation.',
      'feedbackChannels',jsonb_build_array('athlete comfort symptom positioning and clarity report','coach setup path first-fault dose and station report','support incident content and media-review queue'),
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
    anatomy_json=EXCLUDED.anatomy_json,athlete_support_json=EXCLUDED.athlete_support_json,
    coach_support_json=EXCLUDED.coach_support_json,
    support_operations_json=EXCLUDED.support_operations_json,updated_at=now();

  INSERT INTO coaching.exercise_variant_v1(
    id,definition_id,variant_key,display_name,modifier_keys,difficulty_json,
    requirements_json,status,load_profile_json,fatigue_profile_json,
    programming_profile_json)
  VALUES(
    open_book_variant,canonical_definition,'stacked-knee-long-arm-open-and-return',
    'Side-Lying Open Book — Stacked-Knee Long-Arm Open and Return',
    ARRAY['stacked_knees','long_arm','open_and_return']::TEXT[],
    jsonb_build_object(
      'technicalComplexity',22,'exerciseComplexity',22,
      'absoluteLoadDemand',10,'physicalDifficulty',10,
      'coordinationDemand',22,'supervisionDemand',16,
      'failureConsequence',12,'impact',1,'workCapacityDemand',12,
      'baseOverallDifficulty',greatest(22,10),
      'overallFormula','max(exercise_complexity,physical_difficulty)',
      'technicalMeaning','exercise_complexity','loadMeaning','physical_difficulty',
      'independentCalibrationRequired',TRUE,'approvalsCreated',FALSE),
    jsonb_build_object(
      'selectable',TRUE,'posture','side_lying',
      'support','bent_stacked_knees_with_lateral_body_and_bottom_arm_support',
      'equipment',jsonb_build_array('none'),
      'optionalEquipment',jsonb_build_array('mat_optional'),
      'exactSequence',jsonb_build_array('hands_stacked_start','top_arm_and_trunk_open','comfortable_controlled_endpoint','same_path_return','hands_restack_counted_repetition'),
      'sideRule','perform_and_record_left_side_and_right_side_separately',
      'countingRule','one hands_stacked_to_open_endpoint_to_hands_restack cycle',
      'rangeRule','comfortable controlled endpoint; hand-to-floor contact is never required',
      'headRule','eyes may follow the hand only when comfortable; supported neutral head is an allowed annotation',
      'validCompletion','bent knees stay together pelvis stays comparatively stable top arm and trunk rotate without momentum comfortable range is reversed and hands fully restack with no stop rule',
      'invalidCompletion',jsonb_build_array('knees_separate','pelvis_rolls_to_create_range','arm_only_without_trunk_rotation','forced_floor_contact','momentum','breath_hold','hands_do_not_restack','symptom_stop'),
      'clinicalAssessmentOrTreatment',FALSE,'humanReviewRequired',TRUE),
    'review',
    jsonb_build_object(
      'loadingType','unloaded_side_lying_active_trunk_rotation_with_top_arm_arc',
      'externalLoadMethod','bodyweight_segment_mass_and_unloaded_top_arm_only',
      'gripDemand',1,'jointStress',10,'spinalLoading',6,'eccentricStress',4,
      'landingContactsPerRep',0,'handImpactContactsPerRep',0,'impactClass','none',
      'primaryExposure',jsonb_build_array('active_thoracolumbar_and_rib_cage_rotation','top_shoulder_horizontal_abduction_or_transverse_extension','side_lying_body_contact','stacked_hip_and_knee_position','optional_cervical_rotation_with_gaze'),
      'tracking',jsonb_build_array('variant','side','complete_repetitions','range_marker','tempo','brief_hold','head_strategy','comfort_props','knee_and_pelvis_stability','symptoms','duration','same_session_shoulder_and_spinal_range')),
    jsonb_build_object(
      'localMuscleFatigue',8,'gripFatigue',1,
      'technicalFatigueSensitivity',22,'impactAccumulation',1,'recoveryHours',2,
      'primaryFatigueSites',jsonb_build_array('trunk_rotators','top_shoulder_and_scapular_muscles','side_lying_contact','attention_to_knee_pelvis_and_path_control'),
      'cumulativeBudget',jsonb_build_object('totalRepetitions',48,'repetitionsPerSide',24,'activeSpinalRangeSeconds',240,'topShoulderArcSeconds',240,'sideLyingFloorSeconds',480,'technicalSensitivity',22,'impact',1),
      'interference',jsonb_build_array('same_session_spinal_end_range_or_loading','later_high_priority_shoulder_range_or_loading','floor_work_or_side_lying_contact_intolerance','fatigue_that_changes_knee_pelvis_or_arm_path'),
      'recoveryIsPlanningEstimate',TRUE),
    jsonb_build_object(
      'trainingStimuli',jsonb_build_array('low_load_side_lying_trunk_and_rib_rotation_control','top_arm_and_trunk_coordination','side_to_side_movement_access'),
      'stimulusDose',jsonb_build_object('sets',jsonb_build_array(1,2),'completeRepetitionsPerSide',jsonb_build_array(3,6),'secondsPerRepetition',jsonb_build_array(4,12),'restSeconds',jsonb_build_array(0,60)),
      'weeklyExposure',jsonb_build_object('minimum',0,'maximumWithoutReview',7,'unit','sessions','contextDependent',TRUE),
      'prerequisites',jsonb_build_array('safe_floor_entry_side_change_and_exit','comfortable_side_lying_contact','comfortable_controllable_trunk_and_top_shoulder_range','can_keep_bent_knees_together_and_pelvis_comparatively_stable','understands_full_open_and_return_count_and_stop','same_session_budgets_fit'),
      'completionCriteria',jsonb_build_array('exact_side_lying_setup','knees_together','pelvis_comparatively_stable','top_arm_and_trunk_move_together','comfortable_controlled_range','hands_restack','both_sides_recorded','no_stop_symptoms'),
      'sequenceRules',jsonb_build_array('prepare_or_restore_context_only','count_only_full_open_and_return_repetitions','do_not_require_hand_to_floor','do_not_hide_leg_base_arm_path_force_or_assessment_changes_as_modifiers','revalidate_downstream_spinal_and_shoulder_loading'),
      'pairingCompatibility',jsonb_build_object('compatible',jsonb_build_array('low_load_breathing_when_position_remains_exact','light locomotion_after_safe_floor_exit'),'avoid',jsonb_build_array('symptom_provoking_spinal_or_shoulder_end_range','fatiguing_overhead_or_rotational_loading','time_critical_output_when_the_drill_displaces_priority_work')),
      'interferenceRules',jsonb_build_array('count_all_overlapping_active_spinal_rotation','count_all_overlapping_top_shoulder_arc','count_floor_contact_and_side_lying_time','stop_before_knee_pelvis_arm_or_return_quality_changes'),
      'uncertaintyPolicy','When exact leg base arm path support range symptoms or available time is uncertain do not select; request clarification or choose a separately validated card.',
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
  SELECT p.id,open_book_variant,p.profile_key,p.phase_key,p.role,
    CASE p.phase_key WHEN 'prepare_and_access' THEN
      'Use the exact side-lying open-and-return rotation for low-load trunk and rib-cage movement access before later work only when floor, shoulder, spinal-range, duration, and downstream budgets fit.'
    ELSE
      'Use the exact side-lying open-and-return rotation at a low controlled dose to restore movement options without displacing symptom management, recovery, or higher-priority work.' END,
    CASE p.phase_key WHEN 'prepare_and_access' THEN 90 ELSE 84 END,
    CASE p.phase_key WHEN 'prepare_and_access' THEN 86 ELSE 80 END,
    jsonb_build_object('mobility',94,'movement_control',86,'thoracic_and_rib_rotation',92,'recovery',CASE WHEN p.phase_key='restore' THEN 86 ELSE 62 END),
    jsonb_build_object('sets',jsonb_build_array(1,2),'completeRepetitionsPerSide',jsonb_build_array(3,6),'secondsPerRepetition',jsonb_build_array(4,12),'restSeconds',jsonb_build_array(0,60),'bothSidesRequiredUnlessDocumented',TRUE,'briefEndHoldSeconds',jsonb_build_array(0,3),'exampleDoseIsNotUniversal',TRUE),
    'Bent knees remain together and supported; the pelvis stays comparatively stable; the top arm and trunk open together through comfortable controlled range and return until the hands restack; both sides are recorded; no forced floor reach momentum breath hold symptom or wrong task occurs.',
    ARRAY[
      'Sharp, increasing, radiating, or unfamiliar spinal, rib, chest, shoulder, hip, knee, or other pain, guarding, or participant stop request.',
      'Numbness, tingling, weakness, saddle sensory change, bowel or bladder change, or another new neurologic sign.',
      'Dizziness, faintness, nausea, visual change, disorientation, or inability to communicate clearly.',
      'Side-lying, floor-transfer, shoulder, rib, chest, hip, or knee symptoms prevent the exact setup or safe exit.',
      'The knees separate, pelvis rolls to manufacture range, arm moves without trunk, momentum appears, or the hands cannot restack after reducing range or pace.',
      'Forced hand-to-floor reach, breath holding, unsupported head position, or wrong side or repetition count cannot be corrected safely.',
      'The task becomes a windmill, bent-arm rib pull, split-leg or roller-supported variant, wall drill, quadruped rotation, twist, resisted, assisted, or assessment task.',
      'Floor, mat, props, space, traffic, hygiene, sightline, communication, side change, entry, or exit becomes unsafe.',
      'The planned repetition, side, active-range, shoulder-arc, floor-work, technical-fatigue, duration, or downstream exposure budget is reached.'
    ]::TEXT[],
    'Verify the exact variant, safe floor entry side change and exit, surface and optional comfort support, side-lying shoulder hip and knee tolerance, current symptoms and restrictions, planned side dose, actual range time, and downstream spinal and shoulder loading. Demonstrate overhead and side views. Count only hands-stacked to controlled open range to hands-restacked repetitions. Observe knees, pelvis, arm and trunk coupling, head strategy, range, pace, breathing, symptoms, first fault, rest, and duration. Do not force floor contact, diagnose, manipulate, or treat.',
    'Lie on your side with knees bent and stacked and hands together in front. Open the top arm and chest only as far as controlled, then restack the hands; that is one rep. Stop for pain, tingling, weakness, dizziness, or loss of position.',
    'More consistent low-load side-lying trunk, rib-cage, and top-arm open-and-return control in the exact task; no treatment, structural, readiness, injury-prevention, or performance outcome is guaranteed.',
    ARRAY['none']::TEXT[],
    jsonb_build_object('stationCapacity',1,'base','side_lying_bent_stacked_knees','optionalEquipment','mat_optional','floorEntrySideChangeAndExitRequired',TRUE,'space','one_person_full_top_arm_arc_clearance','setupSeconds',25,'sideChangeSeconds',20,'coachSightline','overhead_or_front_oblique_and_side','crossTrafficProhibited',TRUE,'surfaceMatAndPropInspectionRequired',TRUE,'hygieneResetRequired',TRUE,'revalidateAfterAnyChange',TRUE),
    ARRAY[thread_variant,cat_cow_variant,circle_variant]::UUID[],
    'review',
    jsonb_build_object('durationFormula','setup_seconds + sum(actual_complete_repetitions * actual_seconds_per_repetition) + side_change_seconds + rest_seconds + invalid_or_partial_attempt_seconds + symptom_response_seconds + substitution_seconds + floor_exit_seconds','secondsPerRepetition',jsonb_build_array(4,12),'minimumSeconds',65,'typicalSeconds',130,'maximumSecondsWithoutReview',360,'includeActualNotPlanned',TRUE,'recomputeAfterSubstitution',TRUE),
    jsonb_build_object('regressionOrder',jsonb_build_array('reduce_opening_range','use_supported_neutral_head','reduce_to_three_complete_repetitions_per_side','slow_pace','increase_rest','add_optional_stable_mat_or_thin_comfort_support_without_changing_geometry','stop_and_select_a_separately_validated_task_after_full_revalidation'),'progressionOrder',jsonb_build_array('complete_clean_repetitions_on_both_sides','increase_to_four_through_six_per_side_within_profile','increase_range_only_if_comfortable_and_knees_and_pelvis_remain_stable','add_a_brief_non_forced_end_hold_within_profile','select_a_distinct_or_support_changing_task_only_after_full_revalidation'),'neverScaleByForcingFloorContactAddingMomentumOrIgnoringSymptoms',TRUE),
    jsonb_build_object('record',jsonb_build_array('definition_and_variant','side','planned_and_actual_complete_repetitions_per_side','range_tempo_hold_rest_head_strategy_and_props','valid_invalid_partial_and_symptom_limited_attempts','knee_pelvis_arm_and_trunk_control','first_fault','symptoms_and_stop_reason','active_spinal_range_top_shoulder_arc_and_floor_work_seconds','duration','substitution','floor_entry_side_change_and_exit'),'validUnit','one_hands_stacked_to_controlled_open_endpoint_to_hands_restack_repetition_with_bent_knees_together_and_no_stop_rule','partial_opening_or_unreturned_repetitions_do_not_count',TRUE),
    jsonb_build_object('athlete',jsonb_build_array('side_lying_setup','knees_together','hands_stacked_open_and_return','comfortable_range','both_sides','warning_symptom_stop'),'coach',jsonb_build_array('floor_entry_side_change_and_exit','side_lying_and_shoulder_tolerance','knee_pelvis_arm_and_trunk_observation','head_strategy','repetition_count_and_first_fault','clinical_scope','logging_and_escalation'),'accessibility',jsonb_build_array('overhead_and_side_demonstration','written_and_visual_start_open_return_sequence','named_working_side','supported_neutral_head','optional_mat_or_thin_comfort_support','smaller_range_fewer_repetitions_slower_pace_and_rest','separately_validated_support_changing_or_non_floor_alternative'))
  FROM (VALUES
    ('539e6f5b-9819-4c52-b65c-e1e10f0a1f20'::UUID,'prepare-stacked-knee-open-book','prepare_and_access','primary'),
    ('88385f96-a453-44b7-a729-66f5fe861152'::UUID,'restore-stacked-knee-open-book','restore','primary')
  ) p(id,profile_key,phase_key,role)
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
    time_model_json=EXCLUDED.time_model_json,dose_scaling_json=EXCLUDED.dose_scaling_json,
    measurement_json=EXCLUDED.measurement_json,
    support_prompts_json=EXCLUDED.support_prompts_json,updated_at=now();

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,rationale,
    evidence_json,resolution_source,reviewed_by,resolved_at)
  VALUES
    (1,canonical_definition,duplicate_definition,'duplicate_consolidated',
      'Open Book Rotation preserves the same side-lying bent-stacked-knee forward-arm-stack top-arm opening trunk-rotation and controlled-return contract as Side-Lying Open Book. Title, range, breath, side, pace, and dose do not justify a second definition.',
      jsonb_build_object('migration',migration_key,'identityBoundary','same_side_lying_stacked_knee_long_arm_open_and_return_identity','legacySources',jsonb_build_array(28,891),'preservedVariantId',open_book_variant,'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_exact_identity',NULL,now()),
    (1,canonical_definition,prior_duplicate_definition,'duplicate_consolidated',
      'Open Book T-Spine Rotation is an orthographic and purpose-framed duplicate of the same side-lying open-and-return movement; throwing context and breathing are programming annotations rather than exercise identity.',
      jsonb_build_object('migration',migration_key,'identityBoundary','same_side_lying_open_book_identity_context_is_annotation','legacySources',jsonb_build_array(28,1306),'preservedVariantId',open_book_variant,'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_exact_identity',NULL,now()),
    (1,canonical_definition,thread_definition,'distinct_exercises',
      'Side-Lying Open Book uses a lateral floor base with bent stacked knees and a top-arm open-and-return path. Thread-the-Needle uses quadruped support, changes one hand contact, and threads or opens the arm relative to the trunk.',
      jsonb_build_object('migration',migration_key,'identityBoundary','side_lying_open_and_return_vs_quadruped_thread_and_open','humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_identity_equivalence',NULL,now()),
    (1,canonical_definition,cat_cow_definition,'distinct_exercises',
      'Side-Lying Open Book is an axial rotation and top-arm opening task; Cat-Cow is a bilateral quadruped sagittal flexion-extension cycle with fixed hand-and-knee contacts.',
      jsonb_build_object('migration',migration_key,'identityBoundary','side_lying_rotation_vs_quadruped_sagittal_cycle','humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_identity_equivalence',NULL,now()),
    (1,canonical_definition,circle_definition,'distinct_exercises',
      'Side-Lying Open Book uses one arm to open and return in side lying. Quadruped Spinal Circles retains four contacts and moves the global spine and pelvis through a multi-planar circular checkpoint sequence.',
      jsonb_build_object('migration',migration_key,'identityBoundary','side_lying_open_and_return_vs_fixed_contact_global_spinal_circle','humanReviewRequired',TRUE,'approvalsCreated',FALSE),
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
        'noUniversalIsolationRangeTechniqueSafetyEligibilityDoseRecoveryOutcomeOrDifficultyClaim',TRUE)),
    e.quality,'candidate',NULL,NULL
  FROM (VALUES
    ('identity','https://www.leedsth.nhs.uk/patients/resources/physiotherapy-exercises-for-breast-pain-with-chest-wall-musculoskeletal-symptoms/','Physiotherapy exercises for breast pain with chest wall musculoskeletal symptoms','Leeds Teaching Hospitals NHS Trust','professional_standard','Leeds directly names Open Book and specifies side lying, stacked forward arms, an upper-arm arc behind the body, knees together on the floor, and a slow return.','direct exact-task identity and instruction','The source does not adjudicate Vortex duplicates or define every identity invalidation rule.',88),
    ('taxonomy','https://www.dynamichealth.nhs.uk/help-and-advice/mid-back-pain/','Mid-back pain','Dynamic Health NHS','professional_standard','The task is an unloaded side-lying trunk-rotation and top-arm-reaching action with bent knees and completion on both sides.','direct movement context','The source does not create Vortex controlled taxonomy keys or approve mobility as a movement pattern.',84),
    ('anatomy','https://www.leedsth.nhs.uk/patients/resources/physiotherapy-exercises-for-breast-pain-with-chest-wall-musculoskeletal-symptoms/','Physiotherapy exercises for breast pain with chest wall musculoskeletal symptoms','Leeds Teaching Hospitals NHS Trust','professional_standard','The observable motion combines trunk and rib-cage rotation with a top-shoulder opening arc while the bent knees remain together.','direct position and action context','The source does not quantify muscle force isolate vertebral levels or prove one universal shoulder scapular pelvic or head path.',88),
    ('biomechanics','https://pmc.ncbi.nlm.nih.gov/articles/PMC3096141/','Reliability and exploration of the side-lying thoraco-lumbar rotation measurement','North American Journal of Sports Physical Therapy','peer_reviewed_research','The study reports that isolated thoracic rotation is difficult to measure clinically and operationalizes global thoracolumbar rotation in side lying.','side-lying rotation measurement context','Measurement reliability does not validate this exercise technique normal range dose safety or treatment effect.',82),
    ('difficulty','https://www.leedsth.nhs.uk/patients/resources/physiotherapy-exercises-for-breast-pain-with-chest-wall-musculoskeletal-symptoms/','Physiotherapy exercises for breast pain with chest wall musculoskeletal symptoms','Leeds Teaching Hospitals NHS Trust','professional_standard','The exact task requires stacked side-lying support, a top-arm arc, trunk rotation, lower-body stability, controlled return, repetition counting, and both sides despite low external load.','direct task coordination context','Leeds assigns no Vortex score and does not classify participants or compare difficulty with adjacent tasks.',88),
    ('load_fatigue_recovery','https://www.dynamichealth.nhs.uk/help-and-advice/mid-back-pain/','Mid-back pain','Dynamic Health NHS','professional_standard','The exercise uses side-lying body support and an unloaded top-arm and trunk motion without required external equipment.','direct support and external-load context','The source does not quantify shoulder spinal rib hip or knee tissue load fatigue cumulative limits or recovery.',84),
    ('constraints','https://pmc.ncbi.nlm.nih.gov/articles/PMC10508241/','Interventions for the Management of Acute and Chronic Low Back Pain: Revision 2021','Journal of Orthopaedic & Sports Physical Therapy / Academy of Orthopaedic Physical Therapy','professional_standard','The guideline supports individualized exercise for applicable presentations while emphasizing patient-centered assessment and red-flag screening.','clinical exercise scope and selection context','The guideline is not an Open Book prescription and does not authorize exercise staff to diagnose treat or clear participants.',96),
    ('dosage','https://www.leedsth.nhs.uk/patients/resources/physiotherapy-exercises-for-breast-pain-with-chest-wall-musculoskeletal-symptoms/','Physiotherapy exercises for breast pain with chest wall musculoskeletal symptoms','Leeds Teaching Hospitals NHS Trust','professional_standard','Leeds gives five repetitions on each side and directs a slow return as one contextual example.','one professional programming example','The example is not a universal dose frequency recovery eligibility or outcome rule.',88),
    ('instructions','https://www.dynamichealth.nhs.uk/help-and-advice/mid-back-pain/','Mid-back pain','Dynamic Health NHS','professional_standard','Dynamic Health specifies side lying with knees bent, hands together forward, the top arm reaching upward then opening the chest, the head following, slow return, and both sides.','direct exact-task instruction','The source does not define the Vortex hand-restack count supported-neutral-head option or every stop rule.',84),
    ('safety_stop_rules','https://pmc.ncbi.nlm.nih.gov/articles/PMC10508241/','Interventions for the Management of Acute and Chronic Low Back Pain: Revision 2021','Journal of Orthopaedic & Sports Physical Therapy / Academy of Orthopaedic Physical Therapy','professional_standard','Best-practice guidance includes screening for serious pathology and neurologic deficit during exercise management.','clinical warning and referral context','It does not prove this drill safe for a specific participant or replace facility emergency and clinical policy.',96),
    ('programming','https://www.dynamichealth.nhs.uk/help-and-advice/mid-back-pain/','Mid-back pain','Dynamic Health NHS','professional_standard','Dynamic Health places Open Book among controlled mid-back mobility exercises and directs completion on both sides.','direct contextual programming','The page does not establish phase exclusivity sport transfer prevention universal dose or cumulative budgets.',84),
    ('athlete_support','https://www.leedsth.nhs.uk/patients/resources/physiotherapy-exercises-for-breast-pain-with-chest-wall-musculoskeletal-symptoms/','Physiotherapy exercises for breast pain with chest wall musculoskeletal symptoms','Leeds Teaching Hospitals NHS Trust','professional_standard','The simple setup upper-arm arc eye-follow instruction knees-together constraint slow return and both-side dose can be translated into concise participant cues.','plain-language participant support','The source does not establish universal sensation meaning accessibility symptom treatment or readiness.',88),
    ('coach_support','https://pmc.ncbi.nlm.nih.gov/articles/PMC10508241/','Interventions for the Management of Acute and Chronic Low Back Pain: Revision 2021','Journal of Orthopaedic & Sports Physical Therapy / Academy of Orthopaedic Physical Therapy','professional_standard','Clinical guidance supports individualized exercise and monitoring while preserving red-flag and neurologic escalation responsibilities.','coach observation and scope boundary','The guideline does not prescribe group layout cues repetition counting props progression or floor-transfer management.',96),
    ('accessibility','https://www.dynamichealth.nhs.uk/help-and-advice/mid-back-pain/','Mid-back pain','Dynamic Health NHS','professional_standard','The start-open-return sequence provides a concise visual and verbal teaching structure and the task can use a controlled self-selected range.','instruction-access context','The source does not validate every prop head strategy non-floor alternative or universal access claim.',84),
    ('alternates','https://pmc.ncbi.nlm.nih.gov/articles/PMC7173996/','Exercise prescription for the thoracic spine in sport: a systematic review and narrative synthesis','British Journal of Sports Medicine / BMJ Open Sport & Exercise Medicine','peer_reviewed_research','Thoracic exercises differ by plane base and task intent, supporting separation of side-lying rotation from quadruped kneeling loaded and multi-planar tasks.','alternate identity boundary context','The review does not adjudicate all twenty Vortex alternates or approve a graph edge.',86),
    ('media','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en','Embed videos and playlists','YouTube Help','manufacturer_instruction','Five exact-title candidates returned current YouTube oEmbed title channel thumbnail and iframe metadata on 2026-08-09.','candidate metadata and privacy-enhanced embed format only','oEmbed does not prove playback exact setup path range captions accessibility cue quality safety conflicts reviewer identity card-version match or approval.',82)
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
    'healthy','candidate','manual_research',
    'exact-title candidate checked by YouTube oEmbed',NULL,NULL,
    '2026-11-09'::TIMESTAMPTZ,
    'Current YouTube oEmbed metadata only. Playback and exact side-lying setup leg geometry arm path trunk action range return captions accessibility cue quality safety conflicts reviewer identity card-version match and approval remain unverified.'
  FROM (VALUES
    ('gooXfQYTV-0','TonyGentilcore.com Side Lying Open Book','Tony Gentilcore'),
    ('Bik7s2SZo_U','Side Lying Open Book','Brill Physical Therapy'),
    ('xznlno1QVuU','Thoracic Rotation Exercise 3: Side-lying Open Book','Proactive Pelvic Health Centre'),
    ('3Cyd4iYLuKo','Side Lying Open Book','Champion Physical Therapy and Performance'),
    ('DO94-QTeyrM','Side Lying Open Book / Thoracic Rotation','Forté Sports Medicine and Orthopedics')
  ) m(video_id,title,channel)
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
    ('Open Book Rotation Open Book T-Spine Rotation or Side-Lying Thoracic Rotation','same_identity','These names retain the bent-stacked-knee side-lying start stacked forward arms top-arm opening with trunk rotation and controlled return.','direct_alias_and_duplicate',jsonb_build_array('side_lying','bent_stacked_knees','long_arm_open','controlled_return'),'consolidated_exact_identity'),
    ('Stacked-Knee Long-Arm Open-and-Return','same_identity','This is the one authored exact variant when the side-lying base stacked knees long top-arm path trunk rotation and hand-restack count remain exact.','authored_exact_variant',jsonb_build_array('stacked_knees','long_arm','open_and_return','hands_restack_count'),'authored_variant'),
    ('Left or Right Side','modifier_annotation','Working side changes laterality and must be recorded but does not change exact movement identity.','side_annotation',jsonb_build_array('working_side','side_specific_repetitions'),'delivery_annotation'),
    ('Smaller or Larger Comfortable Opening Range','modifier_annotation','Range remains delivery when setup path lower-body stability and return remain exact.','range_annotation',jsonb_build_array('comfortable_range','same_path','same_return'),'delivery_annotation'),
    ('Open Book Tempo Repetitions Sets Rest or Brief End Hold','modifier_annotation','Pace volume rest and a non-forced pause change dose rather than identity.','dose_annotation',jsonb_build_array('tempo','repetitions','sets','rest','brief_hold'),'delivery_annotation'),
    ('Eyes Follow Hand or Supported Neutral Head','modifier_annotation','Head and gaze strategy may change for comfort when trunk and arm actions remain exact and cervical motion is recorded.','head_strategy_annotation',jsonb_build_array('gaze_follow','supported_neutral_head'),'delivery_annotation'),
    ('Optional Mat Head Towel or Small Knee Comfort Support','modifier_annotation','Stable comfort support is an annotation only when it does not change leg geometry arm path trunk action or endpoint.','comfort_support_annotation',jsonb_build_array('stable_mat','thin_head_support','small_knee_comfort_support'),'delivery_annotation'),
    ('Side-Lying Windmill','new_definition','A mandatory overhead circular arm path adds shoulder flexion abduction circumduction space and a different completion rule.','windmill_distinct',jsonb_build_array('overhead_arm_circumduction','large_arc','different_count'),'research_queue'),
    ('Bent-Elbow Rib Pull','new_definition','A rib grasp or hand-behind-head position removes the long-arm book path and changes leverage or adds self-assistance.','rib_pull_distinct',jsonb_build_array('bent_elbow','rib_grasp_or_head_contact','changed_leverage'),'research_queue'),
    ('Split-Leg Top-Knee-Anchored Open Book','new_variant','A straight bottom leg with top hip and knee flexed onto floor or bolster materially changes pelvic support hip position equipment and compensation.','split_leg_variant',jsonb_build_array('straight_bottom_leg','top_knee_anchor','changed_pelvic_support'),'needs_human_review'),
    ('Foam-Roller-Supported Top-Knee Open Book','new_variant','Supporting the top knee forward on a roller changes leg geometry equipment pelvic constraint station and exit beyond a small comfort prop.','roller_supported_variant',jsonb_build_array('top_knee_on_roller','changed_leg_geometry','equipment'),'needs_human_review'),
    ('Wall Open Book','new_definition','Standing or half-kneeling against a wall changes base balance gravity support transfer and arm path.','wall_distinct',jsonb_build_array('wall_support','standing_or_half_kneeling','balance'),'research_queue'),
    ('Quadruped Thread-the-Needle','new_definition','Quadruped support and an arm threading under or opening from the body change contacts load path and repetition boundaries.','thread_distinct',jsonb_build_array('quadruped','changed_hand_contact','thread_path'),'existing_distinct_definition'),
    ('Quadruped Spinal Circles','new_definition','A fixed-contact global multi-planar spinal circle uses a different support base sequence directions and counted checkpoint.','circle_distinct',jsonb_build_array('quadruped','four_fixed_contacts','global_circle'),'existing_distinct_definition'),
    ('Cat-Cow','new_definition','Cat-Cow is a quadruped sagittal flexion-extension cycle rather than side-lying axial rotation with a moving top arm.','cat_cow_distinct',jsonb_build_array('quadruped','sagittal_cycle'),'existing_distinct_definition'),
    ('Supine Lower-Trunk Rotation or Lumbar Twist','new_definition','Supine bilateral leg rotation changes moving segments limb driver pelvis action support and endpoint.','supine_twist_distinct',jsonb_build_array('supine','legs_drive_rotation','pelvis_moves'),'research_queue'),
    ('Bretzel or Combined Side-Lying Hip-and-Shoulder Stretch','new_definition','A combined stretch adds leg grasp hip extension or knee flexion shoulder position passive force consent and different stops.','combined_stretch_distinct',jsonb_build_array('leg_grasp','hip_extension_or_knee_flexion','passive_force'),'research_queue'),
    ('Side-Lying Thoracolumbar Rotation Measurement','new_definition','A standardized measured assessment uses landmarks or an inclinometer and reports an angle rather than exercise repetitions.','assessment_distinct',jsonb_build_array('measurement_protocol','angle_outcome','examiner_setup'),'research_queue'),
    ('Banded or Cable-Resisted Open Book','new_definition','An anchor and external resistance add force direction load equipment fatigue failure and setup requirements.','resisted_distinct',jsonb_build_array('anchor','external_load','force_direction'),'research_queue'),
    ('Partner- or Clinician-Assisted Open Book','new_definition','Manual force introduces consent contact force dosing clinical scope monitoring and different stop rules.','manual_assistance_distinct',jsonb_build_array('manual_force','consent','clinical_scope'),'research_queue')
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
      'revalidate',jsonb_build_array('identity','movement purpose','base and support','leg geometry','arm and trunk actions','range and symptoms','side and dose','fatigue and same-session spinal or shoulder loading','duration','logistics','persistence','coach rendering','athlete rendering'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'review',NULL,NULL,NULL
  FROM (VALUES
    (open_book_variant,thread_variant,'progression',60,ARRAY['stability','complexity','load']::TEXT[],'Quadruped Thread-the-Needle adds closed-chain hand-and-knee support and a changing hand contact; it is only a contextual progression when that changed base and purpose fit.'),
    (thread_variant,open_book_variant,'regression',60,ARRAY['stability','complexity','load']::TEXT[],'Side-Lying Open Book removes quadruped wrist knee and support-shoulder loading while retaining a low-load rotation purpose; it does not preserve the thread-under path.'),
    (open_book_variant,cat_cow_variant,'lateral_substitution',42,ARRAY['range','stability','complexity']::TEXT[],'Cat-Cow changes to a quadruped sagittal cycle and is only an alternative when rotation is no longer the required task.'),
    (open_book_variant,circle_variant,'lateral_substitution',48,ARRAY['range','stability','complexity','decision_demand']::TEXT[],'Quadruped Spinal Circles changes to four fixed contacts and a multi-planar circular path; substitute only after purpose support and dose are fully revalidated.')
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
  SELECT 1,open_book_variant,d.dimension,
    CASE d.dimension WHEN 'technicalComplexity' THEN 22 ELSE 10 END,
    20,
    CASE d.dimension WHEN 'technicalComplexity' THEN
      'Review-only exercise-complexity anchor based on side-lying setup bent-knee and pelvis control coordinated top-arm and trunk opening comfortable endpoint same-path return hand-restack counting and both-side recording.'
    ELSE
      'Review-only physical-difficulty anchor based on no external load low-impact side-lying support unloaded top-arm motion active thoracolumbar range and modest shoulder and trunk effort.'
    END||' This scores the exercise task, not participant proficiency.',
    'review',1,NULL,NULL,
    'Research-informed proposal only; independent comparison and qualified human approval remain required.',NULL
  FROM (VALUES('technicalComplexity'),('absoluteLoadDemand')) d(dimension)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
    proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,
    reviewed_by=NULL,review_notes=EXCLUDED.review_notes,reviewed_at=NULL,
    updated_at=now();

  UPDATE coaching.exercise SET
    name=CASE id WHEN 28 THEN 'Side-Lying Open Book' ELSE name END,
    slug=CASE id WHEN 28 THEN 'side-lying-open-book' ELSE slug END,
    description='Lie on one side with hips and knees comfortably bent and stacked and both straight arms together in front. Open the top arm and trunk through comfortable controlled range, then return until the hands restack to count one repetition. Keep the knees together and pelvis comparatively stable, complete and record both sides, and never force the hand to the floor.',
    instructions='Use the exact stacked-knee long-arm canonical variant. Verify a safe floor transfer and side-lying position. Stack bent knees and straight arms in front. Open the top arm with the rib cage and trunk only through comfortable controlled range; eyes may follow only if comfortable. Return along the same path until the hands restack to count one repetition. Record each side separately. Stop for pain, radiating symptoms, numbness, tingling, weakness, saddle sensory or bowel or bladder change, chest or breathing concern, dizziness, faintness, nausea, visual change, loss of position, or participant request.',
    skill_level=NULL,age_min=NULL,age_max=NULL,
    default_sets=1,default_reps=5,default_work_seconds=50,
    default_rest_seconds=30,tempo='controlled four to twelve seconds per complete open-and-return repetition',
    load_note='Track actual complete repetitions per side, range, pace, brief hold, head strategy, optional comfort support, knee and pelvis stability, active spinal-range time, top-shoulder arc time, symptoms, invalid or partial attempts, rest, duration, and same-session spinal or shoulder loading.',
    est_seconds_per_set=130,is_published=FALSE,
    archived=CASE WHEN id=28 THEN FALSE ELSE TRUE END,
    card_summary='Unloaded side-lying trunk and rib-cage rotation with bent stacked knees, a long top-arm opening arc, and a controlled return to stacked hands.',
    coach_language='Verify the exact variant, floor entry side change and exit, side-lying and shoulder tolerance, restrictions and symptoms, planned side dose, downstream budgets, bent stacked knees, pelvis stability, top-arm and trunk coupling, comfortable range, head strategy, first fault, actual duration, stop response, persistence, and clinical scope.',
    athlete_language='Keep bent knees together, open the top arm and chest only as far as controlled, then restack the hands. Complete both sides and stop for pain, tingling, weakness, dizziness, or loss of position.',
    programming_logic=jsonb_build_object(
      'selectionStatus',CASE WHEN id=28 THEN 'canonical_variant_required' ELSE 'duplicate_source_archived' END,
      'selectable',id=28,'canonicalDefinitionId',canonical_definition,
      'exactVariantIds',to_jsonb(active_variant_ids),
      'duplicateLegacySources',jsonb_build_array(891,1306),
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'exerciseDifficultyDescribesTaskOnly',TRUE,
      'selectionInputs',jsonb_build_array('workout purpose','floor transfer side-lying and side-change tolerance','trunk shoulder hip and knee restrictions and symptoms','exact leg base arm path and repetition comprehension','side dose and duration','cumulative active spinal range shoulder arc and floor work','same-session spinal and shoulder loading','coach scope and sightline'),
      'substitutionRevalidation',jsonb_build_array('identity','base and support','leg geometry','arm and trunk actions','restrictions and symptoms','purpose','side and dose','fatigue and impact budgets','duration','logistics','persistence','coach rendering','athlete rendering'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    scalable_variables=ARRAY['side','complete_repetitions_per_side','range','tempo','brief_end_hold_seconds','rest_seconds','sets','head_strategy','optional_comfort_support']::TEXT[],
    movement_family='Side-Lying Open-and-Return Rotation',
    primary_phase_key=NULL,phase_subrole=NULL,primary_order_slot=NULL,
    movement_requirements=jsonb_build_object(
      'selectable',id=28,'canonicalVariantRequired',TRUE,
      'impactLevel',0,'balanceDemand','stable_side_lying_base',
      'breathingDemand','comfortable_no_breath_hold',
      'actions',jsonb_build_array('thoracolumbar_and_rib_cage_rotation','top_shoulder_horizontal_abduction_or_transverse_extension','controlled_return'),
      'planes',jsonb_build_array('transverse_primary','coupled_accommodation'),
      'mustMaintain',jsonb_build_array('side_lying_base','bent_knees_together','comparatively_stable_pelvis','top_arm_and_trunk_coupling','comfortable_range','hands_restack_count','communication'),
      'mustNotAdd',jsonb_build_array('forced_floor_contact','mandatory_overhead_windmill','bent_arm_rib_pull','split_leg_anchor','external_force','manual_assistance','assessment_protocol','momentum'),
      'validCompletion','hands_restack_after_one_controlled_open_and_return_with_knees_together_comparatively_stable_pelvis_and_no_stop_rule'),
    coaching_execution=jsonb_build_object(
      'qualityGates',jsonb_build_array('variant_station_and_floor_transfer_exact','side_lying_and_shoulder_tolerated','knees_together_and_pelvis_stable','top_arm_and_trunk_move_together','comfortable_range','hands_restack','both_sides_recorded','no_stop_symptoms'),
      'stopRules',jsonb_build_array('sharp_increasing_radiating_or_unfamiliar_pain','neurologic_or_bowel_or_bladder_change','chest_or_breathing_concern','dizziness_faintness_nausea_visual_change_or_disorientation','side_lying_shoulder_hip_knee_or_transfer_pain','knee_pelvis_arm_or_return_breakdown','wrong_task_forced_range_momentum_or_breath_hold','unsafe_station_side_change_or_exit','budget_or_duration_reached'),
      'persistence',jsonb_build_array('definition_and_variant','legacy_source_lineage','side','planned_and_actual_complete_repetitions','range_tempo_hold_rest_head_strategy_and_props','valid_invalid_partial_and_symptom_limited_attempts','knee_pelvis_arm_and_trunk_observation','first_fault','symptoms_and_stop_reason','active_range_shoulder_arc_and_floor_seconds','duration','substitution','floor_entry_side_change_and_exit')),
    pairing_logic=jsonb_build_object(
      'sameSessionBudget',jsonb_build_array('complete_repetitions','repetitions_per_side','active_spinal_range_seconds','top_shoulder_arc_seconds','side_lying_floor_seconds','technical_fatigue','downstream_spinal_and_shoulder_loading','impact'),
      'avoidAutomaticPairingWith',jsonb_build_array('symptom_provoking_spinal_or_shoulder_end_range','fatiguing_rotational_or_overhead_loading','same_session_spinal_loading_that_exceeds_budget'),
      'revalidateAfterSubstitution',TRUE),
    media_library=jsonb_build_object(
      'candidate_video_ids',jsonb_build_array('gooXfQYTV-0','Bik7s2SZo_U','xznlno1QVuU','3Cyd4iYLuKo','DO94-QTeyrM'),
      'reviewState','oembed_metadata_only_candidate_quarantine',
      'playbackExactnessSetupLegGeometryArmPathRangeReturnCaptionsAccessibilityQualitySafetyAndApprovalVerified',FALSE,
      'humanReviewRequired',TRUE),
    programming_kind='exercise',linked_skill_id=NULL,why_publish_ready=FALSE,
    updated_at=now()
  WHERE id IN(28,891,1306);

  UPDATE coaching.exercise_safety_profile SET
    risk_level=1,impact_level=0,minimum_age_recommended=NULL,
    minimum_skill_level=NULL,requires_spotting=FALSE,
    requires_coach_supervision='recommended',
    minimum_prerequisite_notes='Readiness is evaluated from floor transfer, side-lying contact, exact bent-stacked-knee support, comfortable controllable trunk and top-shoulder range, current restrictions and symptoms, repetition understanding, communication, workout dose, and downstream loading; never from participant proficiency or age.',
    readiness_checks=ARRAY[
      'Confirm the exact variant, safe floor entry side change and exit, stable floor or optional mat, full arm clearance, sightline, hygiene, communication, and emergency route.',
      'Confirm side-lying, shoulder, rib, trunk, hip, and knee tolerance and no current symptom or restriction conflicts with rotation or the exact base.',
      'Confirm the participant understands bent knees together, comparatively stable pelvis, top arm and trunk opening, comfortable endpoint, hand-restack count, both sides, and stop signal.',
      'Review cumulative repetitions per side, active spinal range, top-shoulder arc, side-lying floor time, technical fatigue, and later spinal shoulder and rotational loading.'
    ]::TEXT[],
    stop_signs=ARRAY[
      'Sharp, increasing, radiating, or unfamiliar spinal rib chest shoulder hip knee or other pain, guarding, or participant stop request.',
      'Numbness, tingling, weakness, saddle sensory change, bowel or bladder change, or another neurologic sign.',
      'Chest or breathing concern, dizziness, faintness, nausea, visual change, disorientation, or inability to communicate.',
      'Side-lying shoulder hip knee or floor-transfer symptoms prevent the exact setup or safe exit.',
      'Knee separation pelvic rolling arm-only motion momentum forced range breath hold or incomplete return cannot be corrected safely.',
      'Floor mat props space traffic sightline hygiene communication side change duration budget or safe exit becomes inadequate.'
    ]::TEXT[],
    contraindications=ARRAY[
      'Current symptoms trauma procedure or clinical restrictions conflict with side lying trunk rotation or shoulder opening.',
      'No safe floor transfer side-lying support floor or mat space arm clearance sightline communication side change or exit.',
      'The intended service is diagnosis treatment injury management readiness clearance passive manipulation manual assistance assessment or another exercise identity.'
    ]::TEXT[],
    common_substitutions=ARRAY[
      'Use Quadruped Thread-the-Needle only when changed wrist knee and support-shoulder loading and a thread-under path fit the changed purpose and all checks are rerun.',
      'Use Cat-Cow only when a distinct sagittal flexion-extension cycle fits the changed purpose and all checks are rerun.',
      'Author and review windmill rib-pull split-leg roller-supported wall resisted assisted assessment or non-floor alternatives before selection.',
      'Do not silently change the leg base arm path force support endpoint or purpose or force the hand to the floor.'
    ]::TEXT[]
  WHERE exercise_id IN(28,891,1306);

  UPDATE coaching.exercise_score_v1 SET
    technical_complexity=22,absolute_load_demand=10,
    coordination_demand=22,impact=1,supervision_demand=16,
    base_overall_difficulty=greatest(22,10),
    legacy_scores=coalesce(legacy_scores,'{}'::JSONB)||jsonb_build_object(
      'candidateReassessment',migration_key,
      'projectionScope','stacked_knee_long_arm_open_and_return_exact_variant',
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'variantScores',jsonb_build_object('stackedKneeLongArmOpenAndReturn',jsonb_build_object('complexity',22,'physicalDifficulty',10,'overall',22)),
      'duplicateLegacySources',jsonb_build_array(891,1306),
      'exerciseScoresDescribeTaskOnly',TRUE,'independentCalibrationRequired',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    migration_confidence=62,human_review_status='queued',reviewed_by=NULL,
    reviewed_at=NULL,
    review_notes='Research-informed candidate reassessment only. Scores describe exercise complexity and physical difficulty, not participant proficiency. Exact identity consolidation, position, action, and independent calibration remain required.',
    updated_at=now()
  WHERE exercise_id IN(28,891,1306);

  UPDATE coaching.exercise_difficulty_profile SET
    technical=2.2,complexity=2.2,load=1.0,overall=2.2,
    recommended_age_min=NULL,recommended_age_max=NULL,attention_demand='low',
    notes='Candidate projection from the exact stacked-knee long-arm Side-Lying Open Book variant. Canonical complexity is 22/100, physical difficulty 10/100, and overall 22/100 by maximum. This is not participant proficiency or age classification.',
    source='canonical_research_candidate',updated_at=now()
  WHERE exercise_id IN(28,891,1306);

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  VALUES(canonical_definition,1,2,'2.0.0',migration_key,'quarantined',
    jsonb_build_object(
      'identity',jsonb_build_object('passed',TRUE,'identityKey','side_lying_open_and_return_rotation','legacySources',3,'activeVariants',1,'archivedSourceSkeletons',3,'duplicateDefinitionsArchived',2,'exactDuplicateCollisionsResolved',2),
      'taxonomy',jsonb_build_object('passed',TRUE,'controlledTerms',TRUE,'movementPatterns',jsonb_build_array('rotate','reach'),'bodyRegions',10,'equipment',jsonb_build_array('none','mat_optional')),
      'anatomy',jsonb_build_object('passed',TRUE,'musclesJointsActionsPlanesLateralityContactsPhaseSequenceAndIsolationBoundary',TRUE),
      'difficulty',jsonb_build_object('passed',TRUE,'model','max_exercise_complexity_physical_difficulty','variantVectors',jsonb_build_array('22/10/22'),'participantClassificationAbsent',TRUE,'independentCalibrationRequired',TRUE),
      'loadFatigueRecovery',jsonb_build_object('passed',TRUE,'actualSideRepetitionsActiveRangeShoulderArcFloorWorkAndJointExposureTracked',TRUE,'impactNone',TRUE,'recoveryIsPlanningEstimate',TRUE),
      'constraints',jsonb_build_object('passed',TRUE,'floorTransferSideLyingShoulderSpinalHipKneeSymptomsRestrictionsSpaceTrafficScopeSideChangeAndExit',TRUE),
      'delivery',jsonb_build_object('passed',TRUE,'profiles',2,'prepareAndRestoreOnly',TRUE,'durationDoseRestStationAndSubstitutionRevalidation',TRUE),
      'instructions',jsonb_build_object('passed',TRUE,'athleteCoachAccessibilityAndSupportOperations',TRUE,'kneesPelvisArmTrunkRangeReturnSymptomsAndClinicalScope',TRUE),
      'research',jsonb_build_object('passed',TRUE,'sections',16,'registryVersion',research_version,'nhsFivePerSideIsExampleNotUniversal',TRUE),
      'media',jsonb_build_object('passed',FALSE,'candidateCount',5,'currentOEmbedMetadataHealthy',TRUE,'playbackReviewed',FALSE,'exactVariantReviewed',FALSE,'captionsAccessibilityQualitySafetyAndApprovalReviewed',FALSE),
      'relationships',jsonb_build_object('passed',FALSE,'reviewOnly',4,'approved',0,'automaticSubstitution',FALSE),
      'calibration',jsonb_build_object('passed',FALSE,'reviewOnly',2,'approved',0),
      'alternates',jsonb_build_object('passed',TRUE,'assessments',20,'singleExactVariant',TRUE,'supportChangingVariantsQuarantined',TRUE),
      'generationSupport',jsonb_build_object('passed',TRUE,'selectionConstraints',TRUE,'cumulativeFatigueAndImpactBudgets',TRUE,'duration',TRUE,'equipmentAndStation',TRUE,'substitutionRevalidation',TRUE,'renderingAndPersistence',TRUE),
      'publication',jsonb_build_object('passed',FALSE,'reviewer',NULL,'approver',NULL)),
    jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01','message','A qualified human must watch all five candidates in full and verify playback, exact side-lying setup, bent stacked knees, long-arm path, trunk action, range, return count, captions, accessibility, cue quality, safety, conflicts, reviewer identity, timestamp, card version, and approval rationale.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','A qualified coach must approve or reject every Thread-the-Needle, Cat-Cow, and Quadruped Spinal Circles relationship; no automatic substitution between distinct side-lying, quadruped, sagittal, circular, and thread-under tasks is authorized.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','An independent qualified reviewer must calibrate exercise complexity 22 and physical difficulty 10 for the exact variant. Scores do not classify a participant or create an age or proficiency level.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','A qualified reviewer and separate approver must complete content review before publication. Identity consolidation, anatomy, support, range, dose, stop, scope, accessibility, and support rules remain quarantined.')),
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
        AND movement_patterns=ARRAY['rotate','reach']::TEXT[]
        AND body_regions=ARRAY['spine','thoracic_spine','rib_cage','core','shoulder','scapula','neck','pelvis','hip','knee']::TEXT[]
        AND anatomy_json<>'{}'::JSONB AND environment_json<>'{}'::JSONB
        AND population_json<>'{}'::JSONB AND athlete_support_json<>'{}'::JSONB
        AND coach_support_json<>'{}'::JSONB AND support_operations_json<>'{}'::JSONB
        AND provenance_json->>'approvalsCreated'='false')
    OR (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id IN(duplicate_definition,prior_duplicate_definition)
        AND status='archived'
        AND provenance_json->>'survivorDefinitionId'=canonical_definition::TEXT
        AND reviewed_by IS NULL AND approved_by IS NULL)<>2
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id IN(source_variant,duplicate_variant,prior_duplicate_variant)
        AND status='archived'
        AND requirements_json->>'representation'='superseded_source_skeleton')<>3 THEN
    RAISE EXCEPTION '% definition or source quarantine assertion failed',migration_key;
  END IF;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=28 AND definition_id=canonical_definition
        AND source_kind='legacy_migration')
    OR (SELECT count(*) FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id IN(891,1306) AND definition_id=canonical_definition
        AND source_kind='duplicate_consolidation')<>2
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id IN(891,1306)
        AND definition_id IN(duplicate_definition,prior_duplicate_definition)) THEN
    RAISE EXCEPTION '% source mapping or duplicate lineage assertion failed',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(active_variant_ids) AND definition_id=canonical_definition
        AND status='review' AND requirements_json->>'selectable'='true'
        AND (difficulty_json->>'technicalComplexity')::INTEGER=22
        AND (difficulty_json->>'physicalDifficulty')::INTEGER=10
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=greatest(
          (difficulty_json->>'technicalComplexity')::INTEGER,
          (difficulty_json->>'physicalDifficulty')::INTEGER)
        AND (difficulty_json->>'impact')::INTEGER=1
        AND (load_profile_json->>'landingContactsPerRep')::INTEGER=0
        AND (load_profile_json->>'handImpactContactsPerRep')::INTEGER=0
        AND load_profile_json->>'impactClass'='none'
        AND (fatigue_profile_json->>'impactAccumulation')::INTEGER=1
        AND programming_profile_json->>'publicationQuarantined'='true')<>1 THEN
    RAISE EXCEPTION '% active variant assertion failed',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=open_book_variant AND status='review'
        AND cardinality(equipment_required)>0
        AND coalesce(time_model_json->>'durationFormula','')<>''
        AND dose_scaling_json<>'{}'::JSONB AND measurement_json<>'{}'::JSONB
        AND support_prompts_json<>'{}'::JSONB AND length(coach_instructions)>=100
        AND length(athlete_instructions) BETWEEN 10 AND 240
        AND cardinality(stop_rules)>=8)<>2
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
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>20
    OR (SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE conditions_json->>'migration'=migration_key
        AND review_status='review' AND reviewed_by IS NULL)<>4
    OR (SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=open_book_variant AND status='review'
        AND reviewed_by IS NULL)<>2
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=canonical_definition
        AND resolved_definition_id IN(duplicate_definition,prior_duplicate_definition,
          thread_definition,cat_cow_definition,circle_definition)
        AND reviewed_by IS NULL)<>5 THEN
    RAISE EXCEPTION '% authored row-count or quarantine assertion failed',migration_key;
  END IF;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=canonical_definition
        AND resolved_definition_id=duplicate_definition
        AND decision='duplicate_consolidated'
        AND resolution_source='deterministic_exact_identity' AND reviewed_by IS NULL)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=canonical_definition
        AND resolved_definition_id=prior_duplicate_definition
        AND decision='duplicate_consolidated'
        AND resolution_source='deterministic_exact_identity' AND reviewed_by IS NULL)
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=canonical_definition
        AND resolved_definition_id IN(thread_definition,cat_cow_definition,circle_definition)
        AND decision='distinct_exercises'
        AND resolution_source='deterministic_identity_equivalence'
        AND reviewed_by IS NULL)<>3 THEN
    RAISE EXCEPTION '% identity disposition assertion failed',migration_key;
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
      WHERE v.id=open_book_variant
        AND NOT EXISTS(SELECT 1 FROM coaching.equipment allowed WHERE allowed.key=key)) THEN
    RAISE EXCEPTION '% uncontrolled taxonomy was authored',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1 r
      CROSS JOIN LATERAL unnest(r.dimensions) dimension
      WHERE (r.from_variant_id=open_book_variant OR r.to_variant_id=open_book_variant)
        AND dimension<>ALL(ARRAY['load','leverage','range','speed','stability',
          'complexity','impact','decision_demand','fatigue']))
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=open_book_variant OR to_variant_id=open_book_variant)
        AND review_status='approved') THEN
    RAISE EXCEPTION '% relationship dimension or approval assertion failed',migration_key;
  END IF;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=28
      AND skill_level IS NULL AND age_min IS NULL AND age_max IS NULL
      AND linked_skill_id IS NULL AND is_published=FALSE AND archived=FALSE
      AND programming_kind='exercise' AND why_publish_ready=FALSE)
    OR (SELECT count(*) FROM coaching.exercise WHERE id IN(891,1306)
      AND skill_level IS NULL AND age_min IS NULL AND age_max IS NULL
      AND linked_skill_id IS NULL AND is_published=FALSE AND archived=TRUE
      AND programming_kind='exercise' AND why_publish_ready=FALSE)<>2
    OR (SELECT count(*) FROM coaching.exercise_score_v1
      WHERE exercise_id IN(28,891,1306) AND technical_complexity=22
        AND absolute_load_demand=10 AND base_overall_difficulty=22
        AND human_review_status='queued'
        AND reviewed_by IS NULL AND reviewed_at IS NULL)<>3
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=canonical_definition AND card_version=2
        AND status='quarantined' AND human_review_required=TRUE
        AND jsonb_array_length(blocking_issues_json)=4) THEN
    RAISE EXCEPTION '% legacy projection or packet assertion failed',migration_key;
  END IF;
END
$migration$;
