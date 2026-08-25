-- Source 35: replace chained name-only consolidation with one exact bilateral
-- forearm wall-slide plus terminal full-arm lift-off. Source 899 remains an
-- exact legacy source; underspecified Source 1309 returns to identity quarantine.
-- Evidence, media, graph, calibration, content, and publication authority are
-- always human-only.
DO $migration$
DECLARE
  migration_key CONSTANT TEXT := '507_coaching_wall_slides_lift_off_family_audit_hardening';
  research_version CONSTANT TEXT := '2026-08-09.102';
  canonical_definition UUID;
  duplicate_definition_899 UUID;
  quarantine_definition_1309 UUID;
  source_variant_35 UUID;
  source_variant_899 UUID;
  source_variant_1309 UUID;
  lift_off_variant UUID;
  prepare_profile CONSTANT UUID := '69fc6aad-dd6f-434a-a4c6-6c12470b8177';
  movement_profile CONSTANT UUID := '55882faa-309d-4e53-a1fa-2ccff05bcd38';
  reach_definition UUID;
  reach_variant UUID;
  roller_definition UUID;
  roller_variant UUID;
  prone_y_definition UUID;
  prone_y_variant UUID;
  scapular_push_up_definition UUID;
  scapular_push_up_variant UUID;
  source_variant_ids UUID[];
  all_owned_variant_ids UUID[];
  all_owned_definition_ids UUID[];
  protected_count INTEGER;
BEGIN
  SELECT id INTO canonical_definition FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND legacy_exercise_id=35;
  SELECT id INTO duplicate_definition_899 FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND legacy_exercise_id=899;
  SELECT id INTO quarantine_definition_1309 FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND legacy_exercise_id=1309;
  SELECT id INTO source_variant_35 FROM coaching.exercise_variant_v1
  WHERE definition_id=canonical_definition AND variant_key='baseline';
  SELECT id INTO source_variant_899 FROM coaching.exercise_variant_v1
  WHERE definition_id=canonical_definition AND variant_key='baseline-source-899';
  SELECT id INTO source_variant_1309 FROM coaching.exercise_variant_v1
  WHERE definition_id=duplicate_definition_899 AND variant_key='baseline-source-1309';
  SELECT coalesce((SELECT id FROM coaching.exercise_variant_v1
    WHERE definition_id=canonical_definition
      AND variant_key='bilateral-forearm-slide-terminal-full-arm-lift-off'),gen_random_uuid())
  INTO lift_off_variant;
  SELECT id INTO reach_definition FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND legacy_exercise_id=21;
  SELECT id INTO reach_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=reach_definition AND variant_key='wall-supported-bilateral-reach';
  SELECT id INTO roller_definition FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND legacy_exercise_id=1310;
  SELECT id INTO roller_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=roller_definition AND variant_key='baseline';
  SELECT id INTO prone_y_definition FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND legacy_exercise_id=248;
  SELECT id INTO prone_y_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=prone_y_definition AND variant_key='baseline';
  SELECT id INTO scapular_push_up_definition FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND legacy_exercise_id=33;
  SELECT id INTO scapular_push_up_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=scapular_push_up_definition
    AND variant_key='quadruped-straight-arm-retraction-protraction-cycle';
  source_variant_ids:=ARRAY[source_variant_35,source_variant_899,source_variant_1309];
  all_owned_variant_ids:=ARRAY[source_variant_35,source_variant_899,source_variant_1309,lift_off_variant];
  all_owned_definition_ids:=ARRAY[canonical_definition,duplicate_definition_899,quarantine_definition_1309];

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=35 AND facility_id=1)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=899 AND facility_id=1)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=1309 AND facility_id=1)
    OR canonical_definition IS NULL
    OR duplicate_definition_899 IS NULL
    OR quarantine_definition_1309 IS NULL
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id=source_variant_35)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id=source_variant_899)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id=source_variant_1309)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id=reach_variant AND definition_id=reach_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id=roller_variant AND definition_id=roller_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id=prone_y_variant AND definition_id=prone_y_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id=scapular_push_up_variant AND definition_id=scapular_push_up_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1 WHERE exercise_id=35)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_difficulty_profile WHERE exercise_id=35)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_safety_profile WHERE exercise_id=35) THEN
    RAISE EXCEPTION '% prerequisite source or neighbor rows are missing',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id=lift_off_variant AND definition_id<>canonical_definition)
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 WHERE slug='wall-slides-with-lift-off' AND id<>canonical_definition) THEN
    RAISE EXCEPTION '% working UUID or slug already belongs to another card',migration_key;
  END IF;

  SELECT coalesce(sum(n),0) INTO protected_count FROM (
    SELECT count(*) n FROM coaching.exercise_definition_v1
      WHERE id=ANY(all_owned_definition_ids)
        AND (status IN('published','deprecated') OR reviewed_by IS NOT NULL
          OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)
    UNION ALL SELECT count(*) FROM coaching.exercise_section_evidence_v1
      WHERE definition_id=ANY(all_owned_definition_ids)
        AND (reviewer_user_id IS NOT NULL OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=ANY(all_owned_definition_ids)
        AND (reviewer_user_id IS NOT NULL OR reviewed_at IS NOT NULL
          OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id=ANY(all_owned_definition_ids)
        AND (reviewer_user_id IS NOT NULL OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_card_review_v1
      WHERE definition_id=ANY(all_owned_definition_ids)
    UNION ALL SELECT count(*) FROM coaching.exercise_card_revision_v1
      WHERE definition_id=ANY(all_owned_definition_ids)
    UNION ALL SELECT count(*) FROM coaching.exercise_media_review_v1
      WHERE definition_id=ANY(all_owned_definition_ids)
    UNION ALL SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=ANY(all_owned_variant_ids) OR to_variant_id=ANY(all_owned_variant_ids))
        AND (reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL OR review_status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(all_owned_variant_ids)
        AND (reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL OR status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE (survivor_definition_id=ANY(all_owned_definition_ids)
          OR resolved_definition_id=ANY(all_owned_definition_ids))
        AND (reviewed_by IS NOT NULL OR resolution_source='human_review')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_v1
      WHERE exercise_id=35
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
  WHERE (from_variant_id=ANY(all_owned_variant_ids) OR to_variant_id=ANY(all_owned_variant_ids))
    AND reviewed_by IS NULL AND review_status<>'approved';
  DELETE FROM coaching.exercise_score_calibration_v1
  WHERE variant_id=ANY(all_owned_variant_ids) AND reviewed_by IS NULL AND status<>'approved';
  DELETE FROM coaching.exercise_identity_resolution_v1
  WHERE (survivor_definition_id=ANY(all_owned_definition_ids)
      OR resolved_definition_id=ANY(all_owned_definition_ids))
    AND reviewed_by IS NULL AND resolution_source<>'human_review';

  UPDATE coaching.exercise_definition_source_v1 SET
    definition_id=canonical_definition,source_kind=CASE WHEN legacy_exercise_id=899 THEN 'duplicate_consolidation' ELSE 'legacy_migration' END,
    provenance_json=jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'source_table','coaching.exercise',
      'sourceDisposition',CASE WHEN legacy_exercise_id=899 THEN 'exact_duplicate_source_archived' ELSE 'canonical_exact_variant_reauthored' END,
      'representedBySelectableSourceVariant',FALSE,
      'canonicalVariantId',lift_off_variant,
      'exerciseDifficultyDescribesTaskOnly',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id IN(35,899);

  UPDATE coaching.exercise_definition_source_v1 SET
    definition_id=quarantine_definition_1309,source_kind='legacy_migration',
    provenance_json=jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'source_table','coaching.exercise',
      'sourceDisposition','identity_contract_incomplete_and_archived',
      'representedBySelectableSourceVariant',FALSE,
      'missingContract',jsonb_build_array('wall_contacts','slide_path','terminal_lift_off','return_count'),
      'notExactDuplicateEvidence',TRUE,'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=1309;

  UPDATE coaching.exercise_definition_v1 SET
    canonical_name='Wall Slide with Lift-Off Legacy Duplicate — Source 899',
    display_name='Wall Slide with Lift-Off Legacy Duplicate — Source 899',
    status='archived',approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,last_reviewed_at=NULL,
    provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object(
      'migration',migration_key,'canonicalSurvivorDefinitionId',canonical_definition,
      'sourceDisposition','exact_duplicate_source_archived',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),updated_at=now()
  WHERE id=duplicate_definition_899;

  UPDATE coaching.exercise_definition_v1 SET
    canonical_name='Wall Slide with Lift-Off — Throwing Identity Quarantine — Source 1309',
    display_name='Wall Slide with Lift-Off — Throwing Identity Quarantine — Source 1309',
    status='archived',approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,last_reviewed_at=NULL,
    anatomy_json='{}'::JSONB,environment_json='{}'::JSONB,population_json='{}'::JSONB,
    athlete_support_json='{}'::JSONB,coach_support_json='{}'::JSONB,support_operations_json='{}'::JSONB,
    provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object(
      'migration',migration_key,'sourceDisposition','identity_contract_incomplete_and_archived',
      'missingContract',jsonb_build_array('wall_contacts','slide_path','terminal_lift_off','return_count'),
      'notConsolidatedByName',TRUE,'humanReviewRequired',TRUE,'approvalsCreated',FALSE),updated_at=now()
  WHERE id=quarantine_definition_1309;

  UPDATE coaching.exercise_delivery_profile_v1 SET status='archived',updated_at=now()
  WHERE variant_id=ANY(source_variant_ids);
  UPDATE coaching.exercise_variant_v1 SET
    definition_id=CASE WHEN id=source_variant_1309 THEN quarantine_definition_1309 ELSE canonical_definition END,
    variant_key=CASE id
      WHEN source_variant_35 THEN 'identity-quarantine-source-35'
      WHEN source_variant_899 THEN 'identity-quarantine-source-899'
      ELSE 'identity-quarantine-source-1309' END,
    display_name=CASE id
      WHEN source_variant_35 THEN 'Wall Slides with Lift-Off Legacy Skeleton — Source 35'
      WHEN source_variant_899 THEN 'Wall Slide with Lift-Off Legacy Skeleton — Source 899'
      ELSE 'Wall Slide with Lift-Off — Throwing Incomplete Identity — Source 1309' END,
    modifier_keys=ARRAY[]::TEXT[],difficulty_json='{}'::JSONB,
    requirements_json=jsonb_build_object(
      'selectable',FALSE,'representation','superseded_or_incomplete_source_skeleton',
      'migration',migration_key,'humanReviewRequired',TRUE),
    status='archived',load_profile_json=jsonb_build_object('selectable',FALSE),
    fatigue_profile_json=jsonb_build_object('selectable',FALSE),
    programming_profile_json=jsonb_build_object(
      'selectionStatus','source_skeleton_quarantine','selectable',FALSE,
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
    canonical_definition,1,35,'wall-slides-with-lift-off',
    'Wall Slides with Lift-Off','Wall Slides with Lift-Off',
    ARRAY['Wall Slide with Lift-Off','Forearm Wall Slide with Lift-Off','Y Wall Slide with Lift-Off'],
    'Stand facing a smooth wall with fixed feet and vertical forearms shoulder-width apart on the wall. Keep the trunk organized and lightly press the forearms into the wall. Slide both forearms upward through a comfortable overhead range, allowing controlled elbow extension. At the terminal position lift both full arms and forearms clear of the wall without moving the feet or borrowing lumbar extension. Replace both forearms, slide to the same start, and count one complete return. Comfortable range, stable stance and wall distance, lift-off amplitude, tempo, brief pauses, breathing prompts, repetitions, sets, rest, and a thin stable forearm comfort layer are annotations. Omitting lift-off or changing interface, resistance, base, laterality, equipment, action sequence, clinical scope, or count changes the task.',
    'standing_forearm_wall_slide_terminal_lift_off','2.0.0',2,'review',84,60,50,
    ARRAY['brace','push','reach']::TEXT[],
    ARRAY['wrist','elbow','shoulder','scapula','thoracic_spine','core']::TEXT[],
    ARRAY['wall']::TEXT[],ARRAY[]::TEXT[],
    jsonb_build_object(
      'surface','dry stable level standing surface beside a smooth clean wall',
      'space','one standing wall station with fixed-foot and full-arm clearance and no cross traffic',
      'stationCapacity',1,'equipmentKey','wall',
      'wallPolicy','Wall must be stable smooth clean and free of projections; a thin fixed comfort layer cannot roll or change the path.',
      'coachSightline','side and rear-oblique views for feet forearm contacts elbow path scapular motion trunk compensation lift-off and symptoms',
      'inspection',jsonb_build_array('wall stability texture cleanliness and projections','floor traction and level','foot and arm clearance','cross traffic','forearm skin comfort','communication and emergency route'),
      'changeRule','Any wall interface base laterality resistance action sequence scope dose symptom or downstream-demand change requires full revalidation.'),
    jsonb_build_object(
      'exerciseCardDoesNotClassifyParticipants',TRUE,'readinessIsWorkoutInput',TRUE,
      'selectionPrerequisites',jsonb_build_array('safe unsupported standing at a wall station','comfortable bilateral forearm wall contact and overhead shoulder elbow motion','understands slide lift replace return count and stop signal','can keep feet fixed and trunk controlled','same-session overhead and shoulder budgets fit'),
      'excludeOrEscalate',jsonb_build_array('recent significant trauma surgery or procedure without applicable clearance','worsening night or post-trauma pain','new numbness tingling weakness pins and needles or altered circulation','shoulder pinching painful clicking recurrent instability or inability to control descent','forearm elbow wrist neck back or standing symptoms preventing exact task','dizziness faintness nausea visual change cardiopulmonary symptoms or inability to communicate','clinical restriction conflicting with wall contact or overhead motion','participant requests stop'),
      'notEstablishedByEvidence',jsonb_build_array('universal eligibility normal range or ideal scapular position','injury prevention diagnosis treatment structural or posture correction or readiness','isolated muscle activation','one universal wall distance pressure angle lift-off height dose frequency or recovery','throwing handstand lifting or performance transfer')),
    jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'canonicalAuthoredFromResearch',TRUE,
      'primaryIdentitySource','https://us.physitrack.com/home-exercise-video/ghjt-flexion-wall-slides---lift-off',
      'legacySources',jsonb_build_array(35,899),'quarantinedAmbiguousSources',jsonb_build_array(1309),
      'identityContract','bilateral_fixed_feet_forearms_slide_on_wall_terminal_full_arms_clear_replace_and_return',
      'researchSources',jsonb_build_array(
        'https://us.physitrack.com/home-exercise-video/ghjt-flexion-wall-slides---lift-off',
        'https://www.catalystathletics.com/exercise/796/Wall-Slide-With-Lift-Off/',
        'https://pubmed.ncbi.nlm.nih.gov/17193867/',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC9661929/',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC5080198/',
        'https://pubmed.ncbi.nlm.nih.gov/40165544/',
        'https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en'),
      'confidenceBySection',jsonb_build_object('identity',84,'taxonomy',82,'anatomy',74,'difficulty',60,'load',62,'fatigueRecovery',52,'constraints',82,'dosage',64,'instructions',84,'alternates',86,'media',50),
      'unresolvedClaims',jsonb_build_array('one universal wall distance pressure angle range lift-off height tempo dose frequency recovery or progression','treatment prevention correction readiness or performance outcome','numeric difficulty calibration','media playback exactness captions accessibility quality safety and approval','Source 1309 exact mechanics'),
      'externalPlaybackVerificationPerformed',FALSE,'sourceLimitationsExplicit',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,'publicationQuarantined',TRUE),
    NULL,NULL,NULL,NULL,
    jsonb_build_object(
      'primaryMuscles',jsonb_build_array('serratus_anterior','lower_trapezius','upper_trapezius','anterior_and_middle_deltoid'),
      'secondaryMuscles',jsonb_build_array('middle_trapezius','rotator_cuff','triceps_brachii','pectoralis_minor','latissimus_dorsi'),
      'stabilizers',jsonb_build_array('abdominal_wall','spinal_stabilizers','gluteal_and_lower_limb_postural_muscles','forearm_and_wrist_muscles'),
      'joints',jsonb_build_array('scapulothoracic_articulation','sternoclavicular_joint','acromioclavicular_joint','glenohumeral_joint','elbow_joint','radioulnar_joints','radiocarpal_wrist','thoracic_and_lumbar_intervertebral_joints'),
      'jointActions',jsonb_build_array('shoulder_flexion_or_scaption','scapular_upward_rotation','scapular_protraction','scapular_posterior_tilt','elbow_extension_on_ascent','terminal_open_chain_shoulder_flexion_control','controlled_elbow_flexion_on_return','trunk_anti_extension'),
      'planes',jsonb_build_array('scapular_plane','sagittal_component','coupled_multiplanar_scapulothoracic_motion'),
      'laterality','bilateral synchronous wall slide and terminal full-arm lift-off',
      'supportContacts',jsonb_build_array('left_foot','right_foot','left_forearm_during_slide','right_forearm_during_slide'),
      'contactRule','Both forearms retain wall contact during ascent, both full arms clear at the terminal lift-off, both forearms replace, and feet remain fixed throughout.',
      'phaseSequence',jsonb_build_array('vertical_forearm_start','bilateral_supported_upward_slide','comfortable_terminal_position','bilateral_full_arm_lift_off','controlled_forearm_replacement','supported_return_to_same_start'),
      'trunkBoundary','The trunk remains organized without visible lumbar extension or foot movement used to create lift-off.',
      'evidenceBoundary','Sources support the exact contact sequence and wall-slide muscle involvement; they do not establish isolated activation universal kinematics treatment effects or Vortex scoring.'),
    jsonb_build_object(
      'whyItMatters','Provides a reproducible low-load supported overhead-control task with a required unsupported terminal lift-off when the workout calls for that exact transition.',
      'primaryCue','Forearms slide together, both arms float clear at the top, forearms return, and your feet and ribs stay quiet.',
      'expectedSensations',jsonb_build_array('light forearm pressure during the slide','light-to-moderate shoulder-blade and shoulder effort','greater active effort during terminal lift-off','comfortable trunk and standing control'),
      'unexpectedSensations',jsonb_build_array('sharp increasing night or post-trauma pain','pinching painful clicking instability or uncontrolled drop','numbness tingling weakness pins and needles or altered circulation','dizziness faintness nausea visual change chest pain or unusual breathlessness','forearm elbow wrist neck or back pain','forced range breath holding or visible back arch'),
      'painGuidance','Return arms safely to the wall or lower them, stop, signal the coach, and follow facility escalation policy; do not repeat to test symptoms.',
      'selfChecks',jsonb_build_array('feet stay planted','both forearms slide on the wall','elbows extend only within comfortable range','both full arms clearly lift off','forearms replace before descent','return to the same start counts one rep','ribs pelvis and breathing remain controlled'),
      'accessibility',jsonb_build_array('side and rear-oblique demonstration','written six-step contact sequence','wall markers for start and comfortable top','smaller range and lift-off amplitude','fewer repetitions slower tempo and more rest','thin fixed forearm comfort layer','separately validated no-lift-off seated or other base when needed'),
      'mediaAlternatives',jsonb_build_array('written contact sequence','coach demonstration from two views','still images for start terminal slide lift-off and replacement','auditory slide lift replace return prompts'),
      'notReadinessOrClinicalClassification',TRUE),
    jsonb_build_object(
      'observationChecklist',jsonb_build_array('exact variant wall and standing station','fixed feet and starting forearm geometry','bilateral forearm contact during ascent','shoulder and elbow path','terminal full-arm clearance','trunk and head compensation','replacement before descent','range pace breathing symptoms first fault and duration'),
      'faultCorrections',jsonb_build_object(
        'forearm_contact_lost_early','reduce range or wall distance; do not count until contact is retained through ascent',
        'lift_off_omitted','mark incomplete and reduce range or dose; a no-lift-off reach is another exercise',
        'hands_only_lift','confirm whether full forearms clear; retained proximal contact is another variant',
        'lumbar_extension_or_foot_shift','reduce range lift-off amplitude or wall distance and restore fixed feet and trunk control',
        'shrug_or_neck_tension','reduce range and cue smooth upward rotation without forced shoulder depression',
        'uncontrolled_return','reduce range or dose and restore controlled replacement and descent',
        'symptom','stop and follow escalation policy without diagnosis'),
      'demonstrationPlan',jsonb_build_array('name exact contacts and count','show side and rear-oblique views','show slide full-arm lift-off replacement and return','show early peel hands-only lift back arch and omitted lift-off nonexamples','state expected effort symptoms and stop signal'),
      'groupManagement',jsonb_build_array('one participant per marked wall station','confirm wall and floor before use','preserve side and rear-oblique sightlines','prevent cross traffic','track actual cycles wall-contact and lift-off time faults symptoms and rest','do not advance a station while symptoms remain unresolved'),
      'modificationDecisionTree',jsonb_build_array('reduce comfortable range','reduce lift-off amplitude while keeping clear full-arm separation','reduce repetitions','slow tempo','increase rest','add a thin fixed comfort layer','stop and select a separately reviewed no-lift-off or changed-base card after full revalidation'),
      'doNotUseWhen',jsonb_build_array('safe standing or wall contact is unavailable','current symptoms restrictions or recent trauma conflict','exact sequence or stop signal cannot be understood','wall floor space sightline communication or exit is inadequate','clinical assessment treatment or return-to-sport clearance is intended'),
      'clinicalScope','Observe report record stop and escalate; do not diagnose scapular dyskinesis prescribe rehabilitation clear injury or promise correction.'),
    jsonb_build_object(
      'issueCategories',jsonb_build_array('identity_or_variant','media','content_or_cue','symptom_or_incident','accessibility','equipment_or_station','dose_or_duration','substitution','persistence_or_rendering','privacy_or_data'),
      'supportEscalation',jsonb_build_object('urgent','follow facility emergency policy for trauma neurologic circulation cardiopulmonary altered-consciousness or other emergency signs','clinical','refer diagnosis treatment clearance persistent night or post-trauma symptoms and recurrent instability to qualified care','content','route identity anatomy media dose difficulty and graph disputes to qualified reviewers','technical','preserve request workout variant and logs while escalating deterministic generation or persistence failures'),
      'retentionPolicy','Persist selected definition variant profile wall station planned and actual cycles contact and lift-off seconds range tempo rest faults symptoms stops substitutions duration and renderer version under facility privacy policy.',
      'changeImpactPolicy','A change to wall interface base laterality contacts path lift-off resistance constraints dose duration media graph difficulty or instructions invalidates dependent generation review and rendering assumptions until revalidated.',
      'feedbackFields',jsonb_build_array('request_id','workout_id','definition_id','variant_id','profile_key','planned_and_actual_dose','wall_contact_seconds','lift_off_seconds','first_fault','symptoms','stop_reason','substitution','duration','station','coach_edit','athlete_comprehension','media_issue','incident_id'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
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
    requirements_json,status,load_profile_json,fatigue_profile_json,programming_profile_json)
  VALUES(
    lift_off_variant,canonical_definition,'bilateral-forearm-slide-terminal-full-arm-lift-off',
    'Wall Slides with Lift-Off — Bilateral Forearm Slide and Full-Arm Lift-Off',
    ARRAY['comfortable_range','stance','wall_distance','lift_off_amplitude','terminal_pause','tempo','breathing_prompt','repetitions','sets','rest','stable_forearm_comfort_layer']::TEXT[],
    jsonb_build_object(
      'technicalComplexity',30,'absoluteLoadDemand',16,'physicalDifficulty',16,
      'coordinationDemand',30,'supervisionDemand',16,'failureConsequence',14,
      'impact',1,'workCapacityDemand',12,'baseOverallDifficulty',greatest(30,16),
      'overallFormula','max(exercise_complexity,physical_difficulty)',
      'exerciseDifficultyDescribesTaskOnly',TRUE,'independentCalibrationRequired',TRUE),
    jsonb_build_object(
      'selectable',TRUE,'equipment',jsonb_build_array('wall'),'optionalEquipment',jsonb_build_array(),
      'supportBase','standing_fixed_feet_bilateral_forearms_then_terminal_open_chain',
      'startRule','vertical forearms shoulder-width on wall with elbows near ninety degrees and fixed stable feet',
      'exactSequence',jsonb_build_array('supported_forearm_start','supported_upward_slide','comfortable_terminal_position','bilateral_full_arm_lift_off','forearm_replacement','supported_return_to_same_start'),
      'countingRule','one_complete_return_to_same_start_after_full_arm_lift_off_and_forearm_replacement',
      'validCompletion','feet remain fixed both forearms retain ascent contact both full arms clear at terminal position forearms replace before descent trunk is controlled range and pace are comfortable breathing continues and no stop rule occurs',
      'invalidCompletion',jsonb_build_array('early_forearm_peel','lift_off_omitted','hands_only_lift_with_proximal_forearm_retained','foot_shift','lumbar_extension','uncontrolled_return','forced_range','breath_hold','symptom_stop'),
      'clinicalAssessmentOrTreatment',FALSE,'humanReviewRequired',TRUE),
    'review',
    jsonb_build_object(
      'loadingType','low_external_load_supported_to_open_chain_overhead_control',
      'externalLoadMethod','arm_segment_weight_plus_light_forearm_wall_pressure_then_terminal_open_chain_lift_off',
      'gripDemand',1,'jointStress',14,'spinalLoading',6,'eccentricStress',10,
      'landingContactsPerRep',0,'handImpactContactsPerRep',0,'impactClass','none',
      'primaryExposure',jsonb_build_array('scapular_upward_rotation_and_posterior_tilt_control','shoulder_flexion_or_scaption','elbow_extension','forearm_wall_pressure','terminal_lift_off','trunk_anti_extension'),
      'tracking',jsonb_build_array('variant','complete_cycles','comfortable_top_range','lift_off_amplitude_and_seconds','forearm_contact_seconds','tempo','feet_and_trunk_faults','symptoms','duration','same_session_overhead_and_shoulder_work')),
    jsonb_build_object(
      'localMuscleFatigue',16,'gripFatigue',1,'technicalFatigueSensitivity',30,
      'impactAccumulation',1,'recoveryHours',4,
      'primaryFatigueSites',jsonb_build_array('serratus_and_trapezius','shoulder_flexors_and_rotator_cuff','elbow_extensors','trunk_stabilizers','postural_attention'),
      'cumulativeBudget',jsonb_build_object('completeCycles',30,'terminalLiftOffSeconds',60,'forearmWallContactSeconds',360,'overheadControlSeconds',240,'technicalSensitivity',30,'impact',1),
      'interference',jsonb_build_array('later_high_priority_throwing_handstand_overhead_lifting_or_pressing','same_session_shoulder_or_scapular_loading','fatigue_that_changes_contacts_lift_off_or_trunk_control'),
      'recoveryIsPlanningEstimate',TRUE),
    jsonb_build_object(
      'trainingStimuli',jsonb_build_array('low_load_supported_overhead_control','scapular_upward_rotation_and_posterior_tilt_coordination','supported_to_open_chain_transition','trunk_anti_extension'),
      'stimulusDose',jsonb_build_object('sets',jsonb_build_array(1,3),'completeCycles',jsonb_build_array(5,10),'terminalHoldSeconds',jsonb_build_array(0,3),'secondsPerCycle',jsonb_build_array(4,10),'restSeconds',jsonb_build_array(20,60)),
      'weeklyExposure',jsonb_build_object('minimum',0,'maximumWithoutReview',7,'unit','sessions','contextDependent',TRUE),
      'prerequisites',jsonb_build_array('safe_standing_wall_station','bilateral_forearm_contact','comfortable_overhead_motion','exact_sequence_and_stop_signal_understood','same_session_budget_fits'),
      'selectionConstraints',jsonb_build_array('wall_and_floor_safe','space_and_sightline_adequate','symptoms_and_restrictions_compatible','terminal_full_arm_lift_off_required','duration_and_overlap_budgets_fit'),
      'progressionRules',jsonb_build_array('first_own_clean_contact_sequence','then_increase_to_target_repetitions','then_add_brief_pause','then_enlarge_range_or_lift_off_only_if_comfortable','resisted_or_changed_base_requires_separate_variant'),
      'regressionRules',jsonb_build_array('reduce_range','reduce_lift_off_amplitude_but_keep_full_arm_clearance','reduce_repetitions','slow_tempo','increase_rest','stop_and_select_separately_reviewed_no_lift_off_or_changed_base_task'),
      'substitutionRevalidationRequired',TRUE,'publicationQuarantined',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
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
  SELECT p.id,lift_off_variant,p.profile_key,p.phase_key,'primary',
    CASE p.phase_key WHEN 'prepare_and_access' THEN
      'Use the exact supported-slide to terminal-lift-off cycle before later overhead work only when the wall station symptoms duration and cumulative shoulder budget fit.'
    ELSE
      'Use the exact cycle to practice contact sequencing terminal active control and trunk organization at low fatigue without turning it into a posture test or clinical assessment.' END,
    CASE p.phase_key WHEN 'prepare_and_access' THEN 92 ELSE 86 END,
    CASE p.phase_key WHEN 'prepare_and_access' THEN 88 ELSE 84 END,
    jsonb_build_object('overhead_access',92,'scapular_control',94,'contact_sequence',92,'trunk_control',86),
    jsonb_build_object('sets',jsonb_build_array(1,CASE WHEN p.phase_key='prepare_and_access' THEN 2 ELSE 3 END),'completeCycles',jsonb_build_array(5,10),'terminalHoldSeconds',jsonb_build_array(0,3),'secondsPerCycle',jsonb_build_array(4,10),'restSeconds',jsonb_build_array(20,60),'exampleDoseIsNotUniversal',TRUE),
    'Feet remain fixed, both forearms retain wall contact through ascent, both full arms clearly lift off at the terminal range, forearms replace before descent, the trunk remains controlled, the same start is regained, breathing continues, and no stop symptom occurs.',
    ARRAY[
      'Sharp, increasing, night, post-trauma, or unfamiliar pain or participant stop request.',
      'Shoulder pinching, painful clicking, instability, guarding, or uncontrolled arm descent.',
      'Numbness, tingling, weakness, pins and needles, altered circulation, or another neurologic sign.',
      'Dizziness, faintness, nausea, visual change, chest pain, unusual breathlessness, disorientation, or inability to communicate.',
      'Forearm, elbow, wrist, shoulder, neck, back, or standing symptoms prevent the exact task.',
      'Forearms peel early, lift-off is omitted, only hands lift, feet move, the back arches, or controlled return cannot be restored by reducing range or dose.',
      'Forced range, breath holding, added resistance, changed interface, wrong base, wrong action, or wrong task cannot be corrected safely.',
      'Wall, floor, space, traffic, hygiene, sightline, communication, or exit becomes unsafe.',
      'The planned repetition, wall-contact, lift-off, overhead, technical-fatigue, duration, or downstream exposure budget is reached.'
    ]::TEXT[],
    'Verify the exact wall, floor, fixed-foot stance, forearm contact tolerance, current restrictions and symptoms, planned cycle and overlap budget. Demonstrate side and rear-oblique. Count only supported ascent, clear bilateral full-arm lift-off, forearm replacement, controlled descent, and return to the same start. Observe first fault, breathing, symptoms, duration, and later overhead work. Do not diagnose or treat.',
    'Keep your feet still. Slide both forearms up, float both full arms clear, put your forearms back, and slide to the same start. Stop for pain, pinching, tingling, weakness, dizziness, unusual breathing, or loss of control.',
    'More consistent low-load supported-to-open-chain overhead control in this exact wall-slide sequence; no treatment, posture, prevention, readiness, or performance outcome is guaranteed.',
    ARRAY['wall']::TEXT[],
    jsonb_build_object('stationCapacity',1,'equipment','wall','base','standing_fixed_feet','space','one_person_wall_station_with_full_arm_clearance','setupSeconds',20,'coachSightline','side_and_rear_oblique','crossTrafficProhibited',TRUE,'wallAndFloorInspectionRequired',TRUE,'hygieneResetRequired',TRUE,'revalidateAfterAnyChange',TRUE),
    ARRAY[reach_variant,roller_variant,prone_y_variant,scapular_push_up_variant]::UUID[],
    'review',
    jsonb_build_object('durationFormula','setup_seconds + sum(actual_valid_cycles * actual_seconds_per_cycle) + terminal_hold_seconds + rest_seconds + invalid_or_partial_attempt_seconds + symptom_response_seconds + substitution_seconds + station_reset_seconds','secondsPerCycle',jsonb_build_array(4,10),'minimumSeconds',45,'typicalSeconds',100,'maximumSecondsWithoutReview',300,'includeActualNotPlanned',TRUE,'recomputeAfterSubstitution',TRUE),
    jsonb_build_object('regressionOrder',jsonb_build_array('reduce_range','reduce_lift_off_amplitude_with_full_arm_clearance','reduce_to_five_cycles','slow_tempo','increase_rest','stop_and_select_separately_validated_no_lift_off_or_changed_base_task'),'progressionOrder',jsonb_build_array('complete_clean_cycles','increase_repetitions_within_profile','add_brief_terminal_pause','enlarge_range_or_lift_off_only_if_comfortable','select_resisted_or_changed_base_variant_only_after_full_revalidation'),'neverScaleByForcingRangeAddingSpeedOmittingLiftOffOrIgnoringSymptoms',TRUE),
    jsonb_build_object('record',jsonb_build_array('definition_and_variant','planned_and_actual_complete_cycles','range_wall_distance_stance_lift_off_amplitude_tempo_pause_and_rest','valid_invalid_partial_and_symptom_limited_attempts','forearm_contacts_full_arm_clearance_fixed_feet_and_first_fault','symptoms_and_stop_reason','wall_contact_and_lift_off_seconds','duration','substitution','station'),'validUnit','supported_ascent_full_arm_lift_off_forearm_replacement_and_return_to_same_start_with_fixed_feet_controlled_trunk_and_no_stop','incomplete_cycles_do_not_count',TRUE),
    jsonb_build_object('athlete',jsonb_build_array('fixed_feet','forearms_slide','full_arms_float','forearms_replace','same_start_counts','comfortable_range','warning_symptom_stop'),'coach',jsonb_build_array('wall_and_floor','contact_sequence','full_arm_versus_hands_only_lift','trunk_and_foot_control','first_fault','clinical_scope','logging_and_escalation'),'accessibility',jsonb_build_array('two_view_demonstration','written_six_step_sequence','wall_markers','smaller_range_and_lift_off','fewer_reps_slower_tempo_and_rest','thin_fixed_forearm_comfort_layer','separately_validated_no_lift_off_seated_or_other_base'))
  FROM (VALUES
    (prepare_profile,'prepare-forearm-wall-slide-terminal-lift-off','prepare_and_access'),
    (movement_profile,'movement-intelligence-forearm-wall-slide-terminal-lift-off','movement_intelligence')
  ) p(id,profile_key,phase_key)
  ON CONFLICT(id) DO UPDATE SET
    variant_id=EXCLUDED.variant_id,profile_key=EXCLUDED.profile_key,phase_key=EXCLUDED.phase_key,
    role=EXCLUDED.role,purpose=EXCLUDED.purpose,phase_suitability=EXCLUDED.phase_suitability,
    methodology_alignment=EXCLUDED.methodology_alignment,
    objective_relevance_json=EXCLUDED.objective_relevance_json,dosage_json=EXCLUDED.dosage_json,
    quality_gate=EXCLUDED.quality_gate,stop_rules=EXCLUDED.stop_rules,
    coach_instructions=EXCLUDED.coach_instructions,athlete_instructions=EXCLUDED.athlete_instructions,
    expected_adaptation=EXCLUDED.expected_adaptation,equipment_required=EXCLUDED.equipment_required,
    logistics_json=EXCLUDED.logistics_json,substitution_ids=EXCLUDED.substitution_ids,status='review',
    time_model_json=EXCLUDED.time_model_json,dose_scaling_json=EXCLUDED.dose_scaling_json,
    measurement_json=EXCLUDED.measurement_json,support_prompts_json=EXCLUDED.support_prompts_json,
    updated_at=now();

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,rationale,
    evidence_json,resolution_source,reviewed_by,resolved_at)
  VALUES(
    1,canonical_definition,duplicate_definition_899,'duplicate_consolidated',
    'Sources 35 and 899 specify the same bilateral forearm wall slide, terminal lift-off, and controlled return despite singular and plural naming.',
    jsonb_build_object('migration',migration_key,'source35Contract','bilateral_forearm_slide_terminal_full_arm_lift_off','source899ExactDescription',TRUE,'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'deterministic_identity_equivalence',NULL,now())
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,resolved_at=now();

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,rationale,
    evidence_json,resolution_source,reviewed_by,resolved_at)
  SELECT 1,canonical_definition,i.definition_id,'distinct_exercises',i.rationale,
    jsonb_build_object('migration',migration_key,'identityBoundary',i.boundary_key,
      'source35Contract','bilateral_forearm_slide_terminal_full_arm_lift_off',
      'neighborContract',i.neighbor_contract,'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'deterministic_identity_equivalence',NULL,now()
  FROM (VALUES
    (reach_definition,'required_lift_off_vs_supported_reach','Source 905 returns after the supported reach and omits the required terminal full-arm lift-off.','bilateral_forearm_wall_slide_with_reach_no_lift_off'),
    (roller_definition,'fixed_wall_interface_vs_rolling_interface','Source 1310 adds a foam-roller interface and does not define the same terminal lift-off.','foam_roller_wall_slide_without_exact_terminal_lift_off'),
    (prone_y_definition,'standing_supported_slide_vs_prone_raise','Prone Y raises change base gravity vector support loading action sequence and count.','prone_open_chain_y_raise')
  ) i(definition_id,boundary_key,rationale,neighbor_contract)
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,resolved_at=now();

  INSERT INTO coaching.exercise_section_evidence_v1(
    definition_id,reviewed_card_version,section_key,source_url,source_title,
    source_publisher,source_kind,claims_json,evidence_quality,review_status,
    reviewer_user_id,reviewed_at)
  SELECT canonical_definition,2,e.section_key,e.source_url,e.source_title,e.publisher,e.source_kind,
    jsonb_build_array(
      jsonb_build_object('supported',e.supported_claim,'scope',e.scope),
      jsonb_build_object('limitation',e.limitation,'noUniversalTechniqueSafetyEligibilityDoseRecoveryOutcomeOrDifficultyClaim',TRUE)),
    e.quality,'candidate',NULL,NULL
  FROM (VALUES
    ('identity','https://us.physitrack.com/home-exercise-video/ghjt-flexion-wall-slides---lift-off','GHjt flexion wall slides - lift-off','Physitrack','expert_instruction','The direct sequence uses vertical bilateral forearms on the wall, upward slide, top arm lift-off, forearm replacement, and return.','direct exact-task identity and instruction','The source does not define every Vortex invalidation, count, population, or neighbor.',80),
    ('taxonomy','https://www.catalystathletics.com/exercise/796/Wall-Slide-With-Lift-Off/','Wall Slide With Lift-Off','Catalyst Athletics','expert_instruction','The direct task uses parallel forearms, upward wall slide, full extension, straight-arm lift-off, and controlled return.','direct movement and equipment context','The source does not create Vortex taxonomy keys or universal outcomes.',78),
    ('anatomy','https://pubmed.ncbi.nlm.nih.gov/17193867/','A comparison of serratus anterior muscle activation during a wall slide exercise and other traditional exercises','Journal of Orthopaedic & Sports Physical Therapy','peer_reviewed_research','Wall slides produced measurable serratus anterior activity at 90 120 and 140 degrees with activity increasing as elevation increased.','adjacent wall-slide muscle-activity context','The study did not test terminal lift-off or establish isolated activation force ideal range or eligibility.',88),
    ('biomechanics','https://pmc.ncbi.nlm.nih.gov/articles/PMC9661929/','Theraband Applications for Improved Upper Extremity Wall-Slide Exercises','Journal of Athletic Training','peer_reviewed_research','The protocol standardized scapular-plane shoulder flexion elbow flexion ulnar-forearm wall contact ascent hold and descent.','wall-slide contact plane and phase context','The protocol omitted terminal lift-off and cannot validate the complete Source 35 cycle.',88),
    ('difficulty','https://www.catalystathletics.com/exercise/796/Wall-Slide-With-Lift-Off/','Wall Slide With Lift-Off','Catalyst Athletics','expert_instruction','The direct task adds straight-arm terminal lift-off while the trunk stays braced after a supported slide.','task complexity context','The source does not score the task or classify participants.',78),
    ('load_fatigue_recovery','https://pubmed.ncbi.nlm.nih.gov/17193867/','A comparison of serratus anterior muscle activation during a wall slide exercise and other traditional exercises','Journal of Orthopaedic & Sports Physical Therapy','peer_reviewed_research','Wall slides produce angle-dependent serratus anterior activity under low external loading.','adjacent local-demand context','The study does not quantify lift-off loading cumulative limits fatigue or recovery.',88),
    ('constraints','https://pubmed.ncbi.nlm.nih.gov/40165544/','Rotator Cuff Tendinopathy Diagnosis, Nonsurgical Medical Care, and Rehabilitation: A Clinical Practice Guideline','Journal of Orthopaedic & Sports Physical Therapy','professional_standard','Diagnosis treatment prognosis and return-to-function decisions require an appropriate professional context.','clinical scope boundary','The guideline does not make this workout card a diagnosis treatment or clearance tool.',94),
    ('dosage','https://www.catalystathletics.com/exercise/796/Wall-Slide-With-Lift-Off/','Wall Slide With Lift-Off','Catalyst Athletics','expert_instruction','Catalyst provides a preparatory example of one to three sets of eight to ten repetitions.','expert programming example','The example is not universal and does not validate Vortex duration budgets frequency or recovery.',78),
    ('instructions','https://us.physitrack.com/home-exercise-video/ghjt-flexion-wall-slides---lift-off','GHjt flexion wall slides - lift-off','Physitrack','expert_instruction','The direct sequence is forearms on wall upward slide top lift-off forearms back to wall then slide down.','direct exact-task instruction','Vortex fixed-foot count fault persistence and support rules are added operational boundaries.',80),
    ('safety_stop_rules','https://pubmed.ncbi.nlm.nih.gov/40165544/','Rotator Cuff Tendinopathy Diagnosis, Nonsurgical Medical Care, and Rehabilitation: A Clinical Practice Guideline','Journal of Orthopaedic & Sports Physical Therapy','professional_standard','Clinical diagnosis treatment prognosis and return-to-sport decisions require qualified care.','scope escalation context','Facility trauma neurologic circulation cardiopulmonary incident and emergency rules remain separately required.',94),
    ('programming','https://pmc.ncbi.nlm.nih.gov/articles/PMC5080198/','The effects of wall slide and sling slide exercises on scapular alignment and pain in subjects with scapular downward rotation','Journal of Physical Therapy Science','peer_reviewed_research','A small condition-specific study compared four weeks of wall and sling slide exercise in 22 participants.','outcome claim boundary','The population protocol and no-lift-off task do not justify universal treatment correction readiness or performance claims.',78),
    ('athlete_support','https://us.physitrack.com/home-exercise-video/ghjt-flexion-wall-slides---lift-off','GHjt flexion wall slides - lift-off','Physitrack','expert_instruction','The source names the wall setup forearm contact controlled ascent top lift-off and controlled return.','plain-language participant support','The source does not establish universal sensation meaning access or symptom interpretation.',80),
    ('coach_support','https://pmc.ncbi.nlm.nih.gov/articles/PMC9661929/','Theraband Applications for Improved Upper Extremity Wall-Slide Exercises','Journal of Athletic Training','peer_reviewed_research','Shoulder angle forearm orientation contact phase tempo and resistance position materially define wall-slide loading context.','coach observation and identity-boundary context','The study does not prescribe Vortex group layout counts escalation or lift-off approval.',88),
    ('accessibility','https://us.physitrack.com/home-exercise-video/ghjt-flexion-wall-slides---lift-off','GHjt flexion wall slides - lift-off','Physitrack','expert_instruction','The exact sequence can be taught with explicit contact and direction checkpoints.','communication and range-scaling context','Omitting lift-off or changing base is another card rather than an annotation.',80),
    ('alternates','https://pmc.ncbi.nlm.nih.gov/articles/PMC9661929/','Theraband Applications for Improved Upper Extremity Wall-Slide Exercises','Journal of Athletic Training','peer_reviewed_research','Band placement at wrists or elbows changes muscle-activity patterns compared with regular wall slides.','resistance-variant boundary context','The study does not adjudicate all Vortex alternates or approve graph edges.',88),
    ('media','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en','Embed videos and playlists','YouTube Help','manufacturer_instruction','Five candidates returned current oEmbed title channel thumbnail and iframe metadata on 2026-08-09.','candidate metadata only','oEmbed does not prove playback exact contacts lift-off count captions accessibility quality safety card match or approval.',82)
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
  SELECT canonical_definition,lift_off_variant,2,
    'https://www.youtube.com/watch?v='||m.video_id,
    'https://www.youtube-nocookie.com/embed/'||m.video_id,m.video_id,m.title,m.channel,
    NULL,'en',NULL,TRUE,NULL,NULL,'healthy','candidate','manual_research',m.query,
    NULL,NULL,'2026-11-09'::TIMESTAMPTZ,
    'Current YouTube oEmbed metadata only. Playback exact forearm contacts terminal full-arm lift-off fixed feet return count captions accessibility cue quality safety reviewer identity card-version match and approval remain unverified.'
  FROM (VALUES
    ('3blA9Ba2TFI','How to Do Wall Slides With Lift-Off (Shoulder Mobility + Control)','Nottingham Physio','legacy Source 35 candidate checked by YouTube oEmbed'),
    ('6fCDq1SMhsk','Wall Slides with Lift Off','Champion Physical Therapy and Performance','legacy Source 35 candidate checked by YouTube oEmbed'),
    ('DwqcX8VVpkU','Wall Slide with Lift -Off | Olympic Weightlifting Exercise Library','Catalyst Athletics','legacy Source 899 candidate checked by YouTube oEmbed'),
    ('OKfgrx-Qeqk','Wall Slides with Lift-off','Synchronicity Health','legacy Source 35 candidate checked by YouTube oEmbed'),
    ('ykw9BWnZtlY','DPT Wall Slide with Lift Off','DeWitt Physical Therapy','legacy Source 899 candidate checked by YouTube oEmbed')
  ) m(video_id,title,channel,query)
  ON CONFLICT(definition_id,reviewed_card_version,url) DO UPDATE SET
    variant_id=lift_off_variant,embed_url=EXCLUDED.embed_url,video_id=EXCLUDED.video_id,
    title=EXCLUDED.title,channel_name=EXCLUDED.channel_name,duration_seconds=NULL,
    language_code='en',captions_available=NULL,embedding_allowed=TRUE,
    exact_variant_match=NULL,demonstration_quality_score=NULL,link_status='healthy',
    review_status='candidate',discovery_method='manual_research',source_query=EXCLUDED.source_query,
    reviewer_user_id=NULL,reviewed_at=NULL,next_review_at=EXCLUDED.next_review_at,
    notes=EXCLUDED.notes,updated_at=now();

  INSERT INTO coaching.exercise_alternate_assessment_v1(
    definition_id,reviewed_card_version,alternate_name,classification,rationale,
    distinguishing_dimensions,proposed_card_json,review_status,reviewer_user_id,reviewed_at)
  SELECT canonical_definition,2,a.name,a.classification,a.rationale,
    jsonb_build_object('boundaryKey',a.boundary_key,'factsRequired',a.facts,'neverInferFromNameOrParticipantRanking',TRUE),
    jsonb_build_object('status',a.proposed_status,'classificationCandidate',a.classification,'humanIdentityContentAndSafetyReviewRequired',TRUE,'approvalsCreated',FALSE),
    'candidate',NULL,NULL
  FROM (VALUES
    ('Wall Slide with Lift-Off or Wall Slides with Lift-Off','same_identity','Singular plural and hyphenation preserve the exact bilateral cycle.','source_alias',jsonb_build_array('bilateral_forearm_slide','terminal_full_arm_lift_off'),'authored_variant'),
    ('Forearm Wall Slide with Lift-Off','same_identity','Alias only when both forearms slide and both full arms clear before return.','forearm_alias',jsonb_build_array('forearm_contact','full_arm_clearance'),'merge_alias'),
    ('Y Wall Slide with Lift-Off','same_identity','Y describes terminal shape only when contacts sequence and count remain exact.','terminal_shape_alias',jsonb_build_array('same_contacts','same_sequence'),'merge_alias'),
    ('Comfortable Top Range','modifier_annotation','Range changes dose without changing contacts sequence or count.','range_annotation',jsonb_build_array('comfortable_range'),'delivery_annotation'),
    ('Parallel or Staggered Stable Foot Stance','modifier_annotation','Stable stance changes balance assistance while feet stay fixed.','stance_annotation',jsonb_build_array('fixed_feet','stable_stance'),'delivery_annotation'),
    ('Wall Distance','modifier_annotation','Individual wall distance changes geometry within the same task.','wall_distance_annotation',jsonb_build_array('wall_distance','same_sequence'),'delivery_annotation'),
    ('Comfortable Lift-Off Amplitude','modifier_annotation','Amplitude changes range only when both full arms clearly separate.','lift_off_amplitude_annotation',jsonb_build_array('full_arm_clearance'),'delivery_annotation'),
    ('Brief Terminal Lift-Off Pause','modifier_annotation','A brief pause changes tempo while sequence remains.','pause_annotation',jsonb_build_array('terminal_pause'),'delivery_annotation'),
    ('Controlled Tempo','modifier_annotation','Tempo changes dose not identity.','tempo_annotation',jsonb_build_array('tempo'),'delivery_annotation'),
    ('Repetitions Sets or Rest','modifier_annotation','Volume and recovery alter dosage.','dose_annotation',jsonb_build_array('repetitions','sets','rest'),'delivery_annotation'),
    ('Breathing Prompt','modifier_annotation','Breathing prompts change delivery not mechanics.','breathing_annotation',jsonb_build_array('breathing_prompt'),'delivery_annotation'),
    ('Stable Forearm Comfort Layer','modifier_annotation','A fixed thin comfort layer does not create a rolling interface.','comfort_annotation',jsonb_build_array('fixed_layer','same_path'),'delivery_annotation'),
    ('Mini-Band-at-Wrists Wall Slide with Lift-Off','new_variant','Wrist resistance changes equipment force loading fatigue and release risk.','wrist_band_variant',jsonb_build_array('mini_band','wrist_resistance'),'needs_human_review'),
    ('Band-at-Elbows Wall Slide with Lift-Off','new_variant','Elbow resistance changes force contact strategy and loading.','elbow_band_variant',jsonb_build_array('band','elbow_resistance'),'needs_human_review'),
    ('Band-Behind-Back Wall Slide with Lift-Off','new_variant','Band routing changes resistance vector setup and release risk.','behind_back_band_variant',jsonb_build_array('band','different_force_vector'),'needs_human_review'),
    ('Unilateral Wall Slide with Lift-Off','new_variant','One arm changes laterality trunk rotation interface and comparison.','unilateral_variant',jsonb_build_array('unilateral'),'needs_human_review'),
    ('Half-Kneeling Wall Slide with Lift-Off','new_variant','Half-kneeling changes base laterality transfer and trunk demand.','half_kneeling_variant',jsonb_build_array('half_kneeling','floor_transfer'),'needs_human_review'),
    ('Seated Wall Slide with Lift-Off','new_variant','Seated execution changes base access trunk constraints and logistics.','seated_variant',jsonb_build_array('seated','changed_base'),'needs_human_review'),
    ('Hands-Only Lift-Off with Elbows or Forearms Retained','new_variant','Retaining proximal contact changes elbow shoulder scapular and count mechanics.','hands_only_variant',jsonb_build_array('proximal_forearm_retained'),'needs_human_review'),
    ('Forearm Wall Slide with Reach','new_definition','Source 905 omits required terminal full-arm lift-off.','no_lift_off_distinct',jsonb_build_array('supported_reach','no_lift_off'),'existing_distinct_definition'),
    ('Serratus Foam-Roller Wall Slide','new_definition','Source 1310 adds a rolling interface and lacks the same terminal lift-off.','roller_distinct',jsonb_build_array('foam_roller','changed_interface'),'existing_distinct_definition'),
    ('Wall Slide with Lift-Off — Throwing','new_definition','Source 1309 lacks reproducible contacts path lift-off and count.','throwing_source_incomplete',jsonb_build_array('identity_contract_incomplete'),'existing_quarantined_definition'),
    ('Back-to-Wall Wall Angel','new_definition','Back-to-wall contact and arm path differ from facing-wall forearm sliding.','wall_angel_distinct',jsonb_build_array('back_to_wall','different_interface'),'research_queue'),
    ('Wall Push-Up Plus','new_definition','Elbow flexion extension and terminal protraction change action and loading.','wall_push_up_plus_distinct',jsonb_build_array('push_up_cycle','protraction'),'research_queue'),
    ('Prone Y or Trap-3 Raise','new_definition','Prone open-chain lifting changes base gravity vector and sequence.','prone_y_distinct',jsonb_build_array('prone','open_chain_raise'),'existing_distinct_definition'),
    ('Clinical Shoulder or Scapular Assessment','new_definition','Assessment adds protocol measurement consent interpretation and escalation.','clinical_assessment_distinct',jsonb_build_array('clinical_scope','measurement','consent'),'research_queue')
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
      'revalidate',jsonb_build_array('identity and purpose','wall interface contacts path and terminal action','base laterality resistance and force','symptoms and restrictions','dose duration and logistics','overhead shoulder scapular trunk fatigue and impact budgets','persistence','coach rendering','athlete rendering'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'review',NULL,NULL,NULL
  FROM (VALUES
    (lift_off_variant,reach_variant,'regression',78,ARRAY['range','complexity','fatigue']::TEXT[],'Removes the required terminal full-arm lift-off and therefore changes the task and count.'),
    (lift_off_variant,roller_variant,'lateral_substitution',60,ARRAY['load','stability','complexity']::TEXT[],'Changes from fixed wall forearm contact to a rolling interface and requires full reselection.'),
    (lift_off_variant,prone_y_variant,'lateral_substitution',48,ARRAY['load','leverage','stability','complexity']::TEXT[],'Changes to prone open-chain arm lifting with another gravity vector support and purpose.'),
    (lift_off_variant,scapular_push_up_variant,'lateral_substitution',42,ARRAY['load','leverage','range','stability']::TEXT[],'Changes to quadruped hand support and scapular retraction-protraction without an overhead wall slide.')
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
  SELECT 1,lift_off_variant,d.dimension,
    CASE d.dimension WHEN 'technicalComplexity' THEN 30 ELSE 16 END,20,
    CASE d.dimension WHEN 'technicalComplexity' THEN
      'Review-only exercise-complexity anchor based on fixed feet bilateral forearm ascent contact shoulder and elbow path required full-arm lift-off forearm replacement return count trunk control and quality gates.'
    ELSE
      'Review-only physical-difficulty anchor based on arm-segment loading light wall pressure terminal open-chain overhead control and low global demand without impact or external resistance.'
    END||' This scores the exercise task, not participant proficiency.',
    'review',1,NULL,NULL,'Research-informed proposal only; independent comparison and qualified human approval remain required.',NULL
  FROM (VALUES('technicalComplexity'),('absoluteLoadDemand')) d(dimension)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
    proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,reviewed_by=NULL,
    review_notes=EXCLUDED.review_notes,reviewed_at=NULL,updated_at=now();

  UPDATE coaching.exercise SET
    name='Wall Slides with Lift-Off',slug='wall-slides-with-lift-off',
    description='Facing a smooth wall with fixed feet, slide both forearms upward through comfortable range, lift both full arms clear at the top without arching, replace the forearms, and return to the same start to count one cycle.',
    instructions='Use the exact canonical variant. Start with vertical forearms shoulder-width on a stable smooth wall and feet fixed on a nonslip floor. Lightly press into the wall and slide both forearms upward through comfortable range. At the top, lift both full arms and forearms clear without moving the feet or arching the back. Replace both forearms before sliding to the same start. Breathe continuously and reduce range rather than forcing. Stop for pain, pinching, painful clicking, instability, numbness, tingling, weakness, altered circulation, dizziness, faintness, nausea, visual change, chest pain, unusual breathlessness, uncontrolled descent, or participant request.',
    skill_level=NULL,age_min=NULL,age_max=NULL,
    default_sets=1,default_reps=6,default_work_seconds=45,default_rest_seconds=30,
    tempo='controlled four to ten seconds per complete cycle',
    load_note='Track complete cycles, comfortable top range, lift-off amplitude and seconds, forearm-wall contact seconds, tempo, pauses, fixed feet, trunk faults, symptoms, invalid or partial attempts, rest, duration, and overlapping overhead shoulder scapular and trunk work.',
    est_seconds_per_set=100,is_published=FALSE,archived=FALSE,
    card_summary='Bilateral forearm wall slide followed by required terminal full-arm lift-off and controlled return.',
    coach_language='Verify exact wall and floor, fixed feet, bilateral forearm contact, shoulder and elbow path, clear full-arm lift-off, forearm replacement, trunk control, symptoms, first fault, actual duration, downstream overhead budget, persistence, and escalation.',
    athlete_language='Keep your feet still. Slide both forearms up, float both full arms clear, put your forearms back, and return to the start. Stop for pain, pinching, tingling, weakness, dizziness, unusual breathing, or lost control.',
    programming_logic=jsonb_build_object(
      'selectionStatus','canonical_variant_required','selectable',TRUE,
      'canonicalDefinitionId',canonical_definition,'exactVariantIds',jsonb_build_array(lift_off_variant),
      'difficultyModel','max_exercise_complexity_physical_difficulty','exerciseDifficultyDescribesTaskOnly',TRUE,
      'selectionInputs',jsonb_build_array('workout purpose','wall and floor','standing forearm and overhead tolerance','exact sequence comprehension','cycle dose and duration','cumulative overhead shoulder scapular and trunk work','same-session skill lifting throwing or handstand demand','coach scope and sightline'),
      'substitutionRevalidation',jsonb_build_array('identity','interface contacts path terminal action','base laterality resistance and force','restrictions and symptoms','purpose','dose','fatigue and impact budgets','duration','logistics','persistence','coach rendering','athlete rendering'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    scalable_variables=ARRAY['comfortable_top_range','stable_foot_stance','wall_distance','lift_off_amplitude','terminal_pause','tempo','breathing_prompt','repetitions','rest_seconds','sets','stable_forearm_comfort_layer']::TEXT[],
    movement_family='Standing Forearm Wall Slide and Lift-Off',primary_phase_key=NULL,
    phase_subrole=NULL,primary_order_slot=NULL,
    movement_requirements=jsonb_build_object(
      'selectable',TRUE,'canonicalVariantRequired',TRUE,'impactLevel',0,
      'balanceDemand','stable_standing','breathingDemand','continuous_no_breath_hold',
      'actions',jsonb_build_array('shoulder_flexion_or_scaption','scapular_upward_rotation','scapular_protraction','scapular_posterior_tilt','elbow_extension','terminal_open_chain_lift_off','controlled_return','trunk_anti_extension'),
      'planes',jsonb_build_array('scapular_plane','sagittal_component','coupled_multiplanar_scapulothoracic_motion'),
      'mustMaintain',jsonb_build_array('fixed_feet','bilateral_forearm_ascent_contact','full_arm_terminal_clearance','forearm_replacement_before_descent','same_start_return','comfortable_range','controlled_trunk','communication'),
      'mustNotAdd',jsonb_build_array('omitted_lift_off','hands_only_lift','rolling_interface','external_resistance','changed_base','unilateral_action','foot_shift','forced_range','clinical_assessment'),
      'validCompletion','supported_ascent_full_arm_lift_off_forearm_replacement_and_return_to_same_start_with_fixed_feet_controlled_trunk_and_no_stop'),
    coaching_execution=jsonb_build_object(
      'qualityGates',jsonb_build_array('variant_wall_floor_and_station_exact','standing_and_forearm_contact_tolerated','sequence_understood','feet_fixed','bilateral_forearms_retain_ascent_contact','full_arms_clear_terminally','forearms_replace_before_descent','trunk_controlled','same_start_regained','no_stop_symptoms'),
      'stopRules',jsonb_build_array('sharp_increasing_night_post_trauma_or_unfamiliar_pain','pinching_painful_clicking_instability_or_uncontrolled_descent','neurologic_or_circulation_change','dizziness_faintness_nausea_visual_change_chest_pain_unusual_breathlessness_or_disorientation','forearm_elbow_wrist_shoulder_neck_back_or_standing_pain','contact_lift_off_foot_or_trunk_breakdown','wrong_task_forced_range_or_breath_hold','unsafe_wall_floor_station_or_exit','budget_or_duration_reached'),
      'persistence',jsonb_build_array('definition_and_variant','planned_and_actual_complete_cycles','range_wall_distance_stance_lift_off_amplitude_tempo_pause_and_rest','valid_invalid_partial_and_symptom_limited_attempts','forearm_contacts_full_arm_clearance_fixed_feet_trunk_and_first_fault','symptoms_and_stop_reason','wall_contact_and_lift_off_seconds','duration','substitution','station')),
    pairing_logic=jsonb_build_object(
      'sameSessionBudget',jsonb_build_array('complete_wall_slide_lift_off_cycles','terminal_lift_off_seconds','forearm_wall_contact_seconds','overhead_control_seconds','shoulder_and_scapular_load','technical_fatigue','downstream_throwing_handstand_pressing_or_lifting','impact'),
      'avoidAutomaticPairingWith',jsonb_build_array('fatiguing_overhead_throwing_handstand_or_pressing_before_priority_skill','symptom_provoking_shoulder_or_neck_work','same_session_scapular_loading_exceeding_budget'),
      'revalidateAfterSubstitution',TRUE),
    media_library=jsonb_build_object(
      'candidate_video_ids',jsonb_build_array('3blA9Ba2TFI','6fCDq1SMhsk','DwqcX8VVpkU','OKfgrx-Qeqk','ykw9BWnZtlY'),
      'reviewState','oembed_metadata_only_candidate_quarantine',
      'playbackExactnessContactsLiftOffCountCaptionsAccessibilityQualitySafetyAndApprovalVerified',FALSE,
      'humanReviewRequired',TRUE),
    participant_structure='individual',programming_kind='exercise',linked_skill_id=NULL,
    why_publish_ready=FALSE,updated_at=now()
  WHERE id=35;

  UPDATE coaching.exercise SET
    skill_level=NULL,age_min=NULL,age_max=NULL,is_published=FALSE,archived=FALSE,
    why_publish_ready=FALSE,linked_skill_id=NULL,programming_kind='exercise',
    programming_logic=jsonb_build_object(
      'selectionStatus',CASE WHEN id=899 THEN 'exact_duplicate_source_archived' ELSE 'identity_contract_incomplete_source_archived' END,
      'selectable',FALSE,'canonicalDefinitionId',CASE WHEN id=899 THEN canonical_definition ELSE quarantine_definition_1309 END,
      'canonicalVariantId',CASE WHEN id=899 THEN lift_off_variant ELSE NULL END,
      'migration',migration_key,'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    media_library=coalesce(media_library,'{}'::JSONB)||jsonb_build_object(
      'reviewState','legacy_source_media_superseded','selectable',FALSE,'humanReviewRequired',TRUE),
    updated_at=now()
  WHERE id IN(899,1309);

  UPDATE coaching.exercise_safety_profile SET
    risk_level=1,impact_level=0,minimum_age_recommended=NULL,minimum_skill_level=NULL,
    requires_spotting=FALSE,requires_coach_supervision='recommended',
    minimum_prerequisite_notes='Readiness uses safe standing, wall and floor, bilateral forearm contact, comfortable overhead motion, exact sequence comprehension, symptoms, communication, workout dose, and downstream overhead loading; never participant proficiency or age.',
    readiness_checks=ARRAY[
      'Confirm exact variant, smooth stable clean wall, nonslip floor, clearance, sightline, communication, and emergency route.',
      'Confirm standing, forearm, elbow, wrist, shoulder, neck, back, and overhead-motion tolerance with no current symptom or restriction conflict.',
      'Confirm the participant understands slide, full-arm lift-off, replace, return, count, range reduction, and stop signal.',
      'Review cumulative overhead cycles, lift-off and wall-contact seconds, shoulder and scapular load, technical fatigue, and later throwing handstand pressing or lifting demand.'
    ]::TEXT[],
    stop_signs=ARRAY[
      'Sharp, increasing, night, post-trauma, or unfamiliar pain, guarding, or participant stop request.',
      'Shoulder pinching, painful clicking, instability, or uncontrolled arm descent.',
      'Numbness, tingling, weakness, pins and needles, altered circulation, or another neurologic sign.',
      'Dizziness, faintness, nausea, visual change, chest pain, unusual breathlessness, disorientation, or inability to communicate.',
      'Forearm, elbow, wrist, shoulder, neck, back, or standing symptoms prevent exact execution.',
      'Early forearm peel, omitted lift-off, hands-only lift, foot shift, lumbar extension, forced range, breath hold, or uncontrolled return cannot be corrected safely.',
      'Wall, floor, space, traffic, sightline, hygiene, communication, duration, budget, or safe exit becomes inadequate.'
    ]::TEXT[],
    contraindications=ARRAY[
      'Current symptoms, trauma, procedure, instability, or clinical restrictions conflict with standing wall contact or overhead motion.',
      'No safe stable wall, nonslip floor, standing station, space, sightline, communication, or exit.',
      'The intended service is diagnosis, treatment, injury management, readiness clearance, manual assistance, or another exercise identity.'
    ]::TEXT[],
    common_substitutions=ARRAY[
      'Use Forearm Wall Slide with Reach only when omitting terminal lift-off fits the changed purpose and every check is rerun.',
      'Use Serratus Foam-Roller Wall Slide only when the rolling interface fits and every check is rerun.',
      'Use Prone Y or Scapular Push-Up only when the changed base, load, action, and purpose fit and every check is rerun.',
      'Author and review resisted, unilateral, half-kneeling, seated, or hands-only-lift variants before selection.'
    ]::TEXT[]
  WHERE exercise_id=35;
  UPDATE coaching.exercise_safety_profile SET
    minimum_age_recommended=NULL,minimum_skill_level=NULL
  WHERE exercise_id IN(899,1309);

  UPDATE coaching.exercise_score_v1 SET
    technical_complexity=30,absolute_load_demand=16,coordination_demand=30,
    impact=1,supervision_demand=16,base_overall_difficulty=greatest(30,16),
    legacy_scores=coalesce(legacy_scores,'{}'::JSONB)||jsonb_build_object(
      'candidateReassessment',migration_key,
      'projectionScope','bilateral_forearm_wall_slide_terminal_full_arm_lift_off',
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'variantScores',jsonb_build_object('bilateralForearmSlideTerminalLiftOff',jsonb_build_object('complexity',30,'physicalDifficulty',16,'overall',30)),
      'exerciseScoresDescribeTaskOnly',TRUE,'independentCalibrationRequired',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    migration_confidence=60,human_review_status='queued',reviewed_by=NULL,reviewed_at=NULL,
    review_notes='Research-informed candidate reassessment only. Scores describe exercise complexity and physical difficulty, not participant proficiency. Exact contact, terminal lift-off, and independent calibration remain required.',updated_at=now()
  WHERE exercise_id=35;

  UPDATE coaching.exercise_difficulty_profile SET
    technical=3.0,complexity=3.0,load=1.6,overall=3.0,
    recommended_age_min=NULL,recommended_age_max=NULL,attention_demand='moderate',
    notes='Candidate projection from the exact bilateral forearm wall-slide and terminal full-arm lift-off. Complexity is 30/100, physical difficulty 16/100, and overall 30/100 by maximum. This is not participant proficiency or age classification.',
    source='canonical_research_candidate',updated_at=now()
  WHERE exercise_id=35;

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  VALUES(canonical_definition,1,2,'2.0.0',migration_key,'quarantined',
    jsonb_build_object(
      'identity',jsonb_build_object('passed',TRUE,'identityKey','bilateral_forearm_wall_slide_terminal_full_arm_lift_off','exactLegacySources',2,'activeVariants',1,'archivedSourceSkeletons',3,'neighborBoundaries',3,'source1309ContractIncomplete',TRUE),
      'taxonomy',jsonb_build_object('passed',TRUE,'controlledTerms',TRUE,'movementPatterns',jsonb_build_array('brace','push','reach'),'bodyRegions',6,'equipment',jsonb_build_array('wall')),
      'anatomy',jsonb_build_object('passed',TRUE,'musclesJointsActionsPlanesLateralityContactsSequenceAndTrunkBoundary',TRUE),
      'difficulty',jsonb_build_object('passed',TRUE,'model','max_exercise_complexity_physical_difficulty','variantVectors',jsonb_build_array('30/16/30'),'participantClassificationAbsent',TRUE,'independentCalibrationRequired',TRUE),
      'loadFatigueRecovery',jsonb_build_object('passed',TRUE,'actualCyclesWallContactLiftOffOverheadAndJointExposureTracked',TRUE,'impactNone',TRUE,'recoveryIsPlanningEstimate',TRUE),
      'constraints',jsonb_build_object('passed',TRUE,'wallFloorStandingSymptomsRestrictionsSpaceTrafficScopeAndExit',TRUE),
      'delivery',jsonb_build_object('passed',TRUE,'profiles',2,'prepareAndMovementIntelligence',TRUE,'durationDoseRestStationAndSubstitutionRevalidation',TRUE),
      'instructions',jsonb_build_object('passed',TRUE,'athleteCoachAccessibilityAndSupportOperations',TRUE,'contactsLiftOffReturnFeetTrunkSymptomsAndClinicalScope',TRUE),
      'research',jsonb_build_object('passed',TRUE,'sections',16,'registryVersion',research_version,'exampleDoseNotUniversal',TRUE),
      'media',jsonb_build_object('passed',FALSE,'candidateCount',5,'currentOEmbedMetadataHealthy',TRUE,'playbackReviewed',FALSE,'exactVariantReviewed',FALSE,'captionsAccessibilityQualitySafetyAndApprovalReviewed',FALSE),
      'relationships',jsonb_build_object('passed',FALSE,'reviewOnly',4,'approved',0,'automaticSubstitution',FALSE),
      'calibration',jsonb_build_object('passed',FALSE,'reviewOnly',2,'approved',0),
      'alternates',jsonb_build_object('passed',TRUE,'assessments',26,'singleExactVariant',TRUE,'interfaceBaseResistanceAndActionChangesQuarantined',TRUE),
      'generationSupport',jsonb_build_object('passed',TRUE,'selectionConstraints',TRUE,'cumulativeFatigueAndImpactBudgets',TRUE,'duration',TRUE,'equipmentAndStation',TRUE,'substitutionRevalidation',TRUE,'renderingAndPersistence',TRUE),
      'publication',jsonb_build_object('passed',FALSE,'reviewer',NULL,'approver',NULL)),
    jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01','message','A qualified human must watch all five candidates in full and verify playback, bilateral forearm ascent contacts, terminal full-arm clearance, fixed feet, trunk control, replacement, return count, range, captions, accessibility, cue quality, safety, conflicts, reviewer identity, timestamp, card version, and approval rationale.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','A qualified coach must approve or reject all four relationships; no automatic substitution among lift-off, no-lift-off reach, foam-roller slide, prone Y, or Scapular Push-Up is authorized.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','An independent qualified reviewer must calibrate exercise complexity 30 and physical difficulty 16. Scores do not classify a participant or create an age or proficiency level.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','A qualified reviewer and separate approver must complete content review before publication. Identity, anatomy, loading, interface, contacts, lift-off, shoulder and trunk risk, scope, dose, stop, accessibility, persistence, and support rules remain quarantined.')),
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
        AND movement_patterns=ARRAY['brace','push','reach']::TEXT[]
        AND anatomy_json<>'{}'::JSONB AND environment_json<>'{}'::JSONB
        AND population_json<>'{}'::JSONB AND athlete_support_json<>'{}'::JSONB
        AND coach_support_json<>'{}'::JSONB AND support_operations_json<>'{}'::JSONB
        AND provenance_json->>'approvalsCreated'='false')
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
        WHERE id=ANY(source_variant_ids) AND status='archived'
          AND requirements_json->>'selectable'='false')<>3
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=lift_off_variant AND definition_id=canonical_definition AND status='review'
        AND requirements_json->>'selectable'='true'
        AND (difficulty_json->>'technicalComplexity')::INTEGER=30
        AND (difficulty_json->>'physicalDifficulty')::INTEGER=16
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=greatest(30,16)
        AND (load_profile_json->>'landingContactsPerRep')::INTEGER=0
        AND (fatigue_profile_json->>'impactAccumulation')::INTEGER=1
        AND programming_profile_json->>'publicationQuarantined'='true') THEN
    RAISE EXCEPTION '% definition variant or source quarantine assertion failed',migration_key;
  END IF;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=35 AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=899 AND definition_id=canonical_definition AND source_kind='duplicate_consolidation')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=1309 AND definition_id=quarantine_definition_1309)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 WHERE id=duplicate_definition_899 AND status='archived')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 WHERE id=quarantine_definition_1309 AND status='archived' AND provenance_json->>'notConsolidatedByName'='true') THEN
    RAISE EXCEPTION '% source lineage correction assertion failed',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=lift_off_variant AND status='review'
        AND equipment_required=ARRAY['wall']::TEXT[]
        AND coalesce(time_model_json->>'durationFormula','')<>''
        AND dose_scaling_json<>'{}'::JSONB AND measurement_json<>'{}'::JSONB
        AND support_prompts_json<>'{}'::JSONB AND length(coach_instructions)>=100
        AND length(athlete_instructions) BETWEEN 10 AND 240
        AND cardinality(stop_rules)>=8)<>2
    OR (SELECT count(DISTINCT section_key) FROM coaching.exercise_section_evidence_v1
      WHERE definition_id=canonical_definition AND reviewed_card_version=2
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>16
    OR (SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=canonical_definition AND reviewed_card_version=2
        AND variant_id=lift_off_variant AND link_status='healthy' AND review_status='candidate'
        AND embedding_allowed AND captions_available IS NULL AND exact_variant_match IS NULL
        AND demonstration_quality_score IS NULL AND reviewer_user_id IS NULL AND reviewed_at IS NULL)<>5
    OR (SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id=canonical_definition AND reviewed_card_version=2
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>26
    OR (SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=lift_off_variant OR to_variant_id=lift_off_variant)
        AND review_status='review' AND reviewed_by IS NULL)<>4
    OR (SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=lift_off_variant AND status='review' AND reviewed_by IS NULL)<>2
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=canonical_definition AND reviewed_by IS NULL)<>4 THEN
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
      WHERE v.id=lift_off_variant
        AND NOT EXISTS(SELECT 1 FROM coaching.equipment allowed WHERE allowed.key=key)) THEN
    RAISE EXCEPTION '% uncontrolled taxonomy was authored',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1 r
      CROSS JOIN LATERAL unnest(r.dimensions) dimension
      WHERE (r.from_variant_id=lift_off_variant OR r.to_variant_id=lift_off_variant)
        AND dimension<>ALL(ARRAY['load','leverage','range','speed','stability','complexity','impact','decision_demand','fatigue']))
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=lift_off_variant OR to_variant_id=lift_off_variant)
        AND review_status='approved') THEN
    RAISE EXCEPTION '% relationship dimension or approval assertion failed',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise
      WHERE id IN(35,899,1309) AND skill_level IS NULL AND age_min IS NULL AND age_max IS NULL
        AND linked_skill_id IS NULL AND is_published=FALSE AND archived=FALSE
        AND programming_kind='exercise' AND why_publish_ready=FALSE)<>3
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1
      WHERE exercise_id=35 AND technical_complexity=30
        AND absolute_load_demand=16 AND base_overall_difficulty=30
        AND human_review_status='queued' AND reviewed_by IS NULL AND reviewed_at IS NULL)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=canonical_definition AND card_version=2
        AND status='quarantined' AND human_review_required=TRUE
        AND jsonb_array_length(blocking_issues_json)=4) THEN
    RAISE EXCEPTION '% legacy projection or packet assertion failed',migration_key;
  END IF;
END
$migration$;
