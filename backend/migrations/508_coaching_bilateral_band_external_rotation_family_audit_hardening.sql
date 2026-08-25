-- Source 36: replace the skeletal mixed-label band external-rotation baseline
-- with one exact bilateral standing elbows-at-sides variant. All evidence, media,
-- graph, calibration, content, and publication authority remains human-only.
DO $migration$
DECLARE
  migration_key CONSTANT TEXT := '508_coaching_bilateral_band_external_rotation_family_audit_hardening';
  research_version CONSTANT TEXT := '2026-08-09.103';
  canonical_definition UUID;
  source_variant UUID;
  external_rotation_variant UUID;
  active_variant_ids UUID[];
  all_owned_variant_ids UUID[];
  ninety_ninety_definition UUID;
  ninety_ninety_variant UUID;
  face_pull_definition UUID;
  face_pull_variant UUID;
  eccentric_definition UUID;
  eccentric_variant UUID;
  wall_slide_definition UUID;
  wall_slide_variant UUID;
  protected_count INTEGER;
BEGIN
  SELECT id INTO canonical_definition FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND legacy_exercise_id=36;
  SELECT id INTO source_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=canonical_definition AND variant_key='baseline';
  SELECT coalesce((SELECT id FROM coaching.exercise_variant_v1
    WHERE definition_id=canonical_definition
      AND variant_key='bilateral-standing-elbows-at-sides-unanchored-band'),gen_random_uuid())
  INTO external_rotation_variant;
  SELECT id INTO ninety_ninety_definition FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND legacy_exercise_id=1347;
  SELECT id INTO ninety_ninety_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=ninety_ninety_definition AND variant_key='baseline';
  SELECT id INTO face_pull_definition FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND legacy_exercise_id=1346;
  SELECT id INTO face_pull_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=face_pull_definition AND variant_key='baseline';
  SELECT id INTO eccentric_definition FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND legacy_exercise_id=1348;
  SELECT id INTO eccentric_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=eccentric_definition AND variant_key='baseline';
  SELECT id INTO wall_slide_definition FROM coaching.exercise_definition_v1
  WHERE facility_id=1 AND legacy_exercise_id=35;
  SELECT id INTO wall_slide_variant FROM coaching.exercise_variant_v1
  WHERE definition_id=wall_slide_definition
    AND variant_key='bilateral-forearm-slide-terminal-full-arm-lift-off';
  active_variant_ids:=ARRAY[external_rotation_variant];
  all_owned_variant_ids:=ARRAY[source_variant,external_rotation_variant];

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=36 AND facility_id=1)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition AND facility_id=1 AND legacy_exercise_id=36)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=36 AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source_variant AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=ninety_ninety_variant AND definition_id=ninety_ninety_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=face_pull_variant AND definition_id=face_pull_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=eccentric_variant AND definition_id=eccentric_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=wall_slide_variant AND definition_id=wall_slide_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1 WHERE exercise_id=36)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_difficulty_profile WHERE exercise_id=36)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_safety_profile WHERE exercise_id=36) THEN
    RAISE EXCEPTION '% prerequisite source or neighbor rows are missing',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=external_rotation_variant AND definition_id<>canonical_definition)
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE slug='band-external-rotation' AND id<>canonical_definition) THEN
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
        AND (reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL OR review_status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(all_owned_variant_ids)
        AND (reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL OR status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE (survivor_definition_id=canonical_definition OR resolved_definition_id=canonical_definition)
        AND (reviewed_by IS NOT NULL OR resolution_source='human_review')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_v1
      WHERE exercise_id=36
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

  UPDATE coaching.exercise_definition_source_v1 SET
    source_kind='legacy_migration',
    provenance_json=(coalesce(provenance_json,'{}'::JSONB)-'researchSources')
      ||jsonb_build_object(
        'migration',migration_key,'researchVersion',research_version,
        'sourceDisposition','canonical_bilateral_standing_elbows_at_sides_external_rotation_reauthored',
        'representedBySelectableSourceVariant',FALSE,
        'sourceInterpretation','source 36 supplies standing bilateral elbows-at-sides band external rotation but its slash label and skeletal card omit exact band attachment grip range count anatomy load fatigue constraints duration substitution persistence support and review contracts',
        'exactWorkingSpecification','bilateral_standing_fixed_foot_elbows_at_sides_unanchored_band_external_rotation',
        'researchSources',jsonb_build_array(
          'https://www.nwhealth.edu/wp-content/uploads/2019/04/NWHSU-rehab-shoulder-ext-rot.pdf',
          'https://admin.performancehealth.com/media/wysiwyg/pdfs/RTC_PDF.pdf',
          'https://www.orthopedicone.com/news-events/shoulder-exercises-for-improved-rotator-cuff-strength-and-stability/',
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC5847412/',
          'https://pubmed.ncbi.nlm.nih.gov/41559205/',
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC6262970/',
          'https://pubmed.ncbi.nlm.nih.gov/40165544/',
          'https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en'),
        'exerciseDifficultyDescribesTaskOnly',TRUE,
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=36 AND definition_id=canonical_definition;

  UPDATE coaching.exercise_delivery_profile_v1 SET status='archived',updated_at=now()
  WHERE variant_id=source_variant;
  UPDATE coaching.exercise_variant_v1 SET
    variant_key='identity-quarantine-source-36',
    display_name='Band External Rotation / No-Money Drill Legacy Skeleton — Source 36',
    modifier_keys='{}'::TEXT[],difficulty_json='{}'::JSONB,status='archived',
    requirements_json=jsonb_build_object(
      'selectable',FALSE,'representation','superseded_source_skeleton',
      'sourceLegacyExerciseId',36,
      'archiveReason','exact band attachment grip elbow contact range count anatomy loading budgets duration constraints substitutions persistence and support were missing',
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
    canonical_definition,1,36,'band-external-rotation',
    'Bilateral Band External Rotation — Elbows at Sides',
    'Bilateral Band External Rotation — Elbows at Sides',
    ARRAY['Band External Rotation / No-Money Drill','No-Money Drill','Standing Bilateral Band External Rotation','Band External Rotation with Elbows Tucked'],
    'Stand with fixed feet and an intact unanchored resistance band held between both hands in front of the torso. Flex both elbows near 90 degrees and keep the upper arms beside the ribs. With organized wrists and trunk, rotate both forearms and hands outward through a comfortable range without elbow drift, shrugging, wrist substitution, trunk extension, or rotation. Return slowly to the same start and count one complete outward-and-return cycle. Palms-up or thumbs-up grip, range, initial hand spacing, light band tension, tempo, brief pauses, breathing prompts, repetitions, sets, rest, and a fixed towel spacer are annotations. Changing base, laterality, band attachment, shoulder angle, contraction mode, required scapular action, sequence, clinical scope, or count changes the task.',
    'bilateral_elbows_at_sides_band_external_rotation','2.0.0',2,'review',86,60,50,
    ARRAY['brace','pull','rotate']::TEXT[],
    ARRAY['shoulder']::TEXT[],
    ARRAY['bands']::TEXT[],ARRAY[]::TEXT[],
    jsonb_build_object(
      'surface','flat dry stable nonslip standing surface',
      'space','one standing station with bilateral hand and elbow clearance and no cross traffic or nearby eyes in the band recoil path',
      'stationCapacity',1,'equipmentKey','bands',
      'bandPolicy','Use an intact light band of known condition and sufficient length. The exact base is unanchored and held between both hands; inspect for tears, brittleness, damaged handles, contamination, and uncontrolled recoil risk before use.',
      'coachSightline','front and side views for feet, elbows, wrists, band path, shoulder position, trunk compensation, range, breathing, symptoms, and release control',
      'inspection',jsonb_build_array('floor traction and clutter','band material handles and seams','hand grip and initial tension','hand elbow and recoil clearance','cross traffic and eye exposure','communication and emergency route'),
      'changeRule','Any base, laterality, band attachment, shoulder angle, action, contraction, scope, dose, symptom, equipment, or downstream-demand change requires full revalidation.'),
    jsonb_build_object(
      'exerciseCardDoesNotClassifyParticipants',TRUE,'readinessIsWorkoutInput',TRUE,
      'selectionPrerequisites',jsonb_build_array('safe unsupported standing and band handling','comfortable bilateral elbows-at-sides shoulder external rotation','understands exact outward-and-return count and stop signal','can control wrists elbows trunk and band release','same-session shoulder rotator-cuff scapular grip and overhead budgets fit'),
      'excludeOrEscalate',jsonb_build_array('recent significant trauma surgery or procedure without applicable clearance','worsening night or post-trauma pain','new numbness tingling weakness pins and needles or altered circulation','shoulder pinching painful clicking recurrent instability or uncontrolled return','hand wrist elbow neck back or standing symptoms preventing exact task','dizziness faintness nausea visual change chest pain unusual breathlessness or inability to communicate','clinical restriction conflicting with resisted shoulder rotation','damaged band or unsafe recoil path','participant requests stop'),
      'notEstablishedByEvidence',jsonb_build_array('universal eligibility normal range or ideal scapular position','injury prevention diagnosis treatment structural or posture correction or readiness','isolated muscle activation','one universal grip hand spacing band color force range dose frequency or recovery','throwing lifting climbing handstand or performance transfer')),
    jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'canonicalAuthoredFromResearch',TRUE,
      'primaryIdentitySource','https://www.nwhealth.edu/wp-content/uploads/2019/04/NWHSU-rehab-shoulder-ext-rot.pdf',
      'legacySources',jsonb_build_array(36),
      'identityContract','bilateral_standing_fixed_feet_elbows_at_sides_unanchored_band_external_rotation_and_controlled_return',
      'researchSources',jsonb_build_array(
        'https://www.nwhealth.edu/wp-content/uploads/2019/04/NWHSU-rehab-shoulder-ext-rot.pdf',
        'https://admin.performancehealth.com/media/wysiwyg/pdfs/RTC_PDF.pdf',
        'https://www.orthopedicone.com/news-events/shoulder-exercises-for-improved-rotator-cuff-strength-and-stability/',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC5847412/',
        'https://pubmed.ncbi.nlm.nih.gov/41559205/',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC6262970/',
        'https://pubmed.ncbi.nlm.nih.gov/40165544/',
        'https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en'),
      'confidenceBySection',jsonb_build_object('identity',86,'taxonomy',84,'anatomy',78,'difficulty',60,'load',70,'fatigueRecovery',56,'constraints',84,'dosage',64,'instructions',86,'alternates',86,'media',50),
      'unresolvedClaims',jsonb_build_array('one universal grip hand spacing band force range scapular position dose frequency recovery or progression','injury prevention diagnosis treatment correction readiness or performance outcome','numeric difficulty calibration','media playback exactness captions accessibility quality safety and approval','Source 1348 exact eccentric mechanics'),
      'externalPlaybackVerificationPerformed',FALSE,'sourceLimitationsExplicit',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,'publicationQuarantined',TRUE),
    NULL,NULL,NULL,NULL,
    jsonb_build_object(
      'primaryMuscles',jsonb_build_array('infraspinatus','teres_minor'),
      'secondaryMuscles',jsonb_build_array('posterior_deltoid','middle_trapezius','lower_trapezius','rhomboid_major_and_minor'),
      'stabilizers',jsonb_build_array('subscapularis_and_remaining_rotator_cuff','scapular_stabilizers','biceps_brachii_and_brachialis_isometric','forearm_and_wrist_stabilizers','abdominal_wall','spinal_and_lower_limb_postural_muscles'),
      'joints',jsonb_build_array('glenohumeral_joint','scapulothoracic_articulation','sternoclavicular_joint','acromioclavicular_joint','elbow_joint','proximal_and_distal_radioulnar_joints','radiocarpal_wrist','thoracic_and_lumbar_intervertebral_joints'),
      'jointActions',jsonb_build_array('bilateral_glenohumeral_external_rotation','controlled_internal_rotation_return','scapular_stabilization','elbow_flexion_isometric','forearm_orientation_maintained','wrist_neutral_stabilization','trunk_anti_extension_and_anti_rotation'),
      'planes',jsonb_build_array('transverse_rotation_about_humeral_longitudinal_axis'),
      'laterality','bilateral synchronous shoulder external rotation with both upper arms retained beside the ribs',
      'supportContacts',jsonb_build_array('left_foot','right_foot','left_hand_on_band','right_hand_on_band'),
      'contactRule','Both hands retain the unanchored band, both upper arms remain beside the ribs, and feet remain fixed throughout every counted cycle.',
      'phaseSequence',jsonb_build_array('elbows_at_sides_band_in_front_start','bilateral_external_rotation_outward','comfortable_end_range','controlled_return_to_same_start'),
      'trunkBoundary','The trunk remains organized without extension rotation sway or shoulder shrug used to create hand separation.',
      'evidenceBoundary','Sources support bilateral elbows-at-sides elastic-band external rotation and position-dependent shoulder loading; they do not establish isolated activation universal kinematics treatment effects or Vortex scoring.'),
    jsonb_build_object(
      'whyItMatters','Provides a reproducible low-load bilateral shoulder external-rotation task when the workout calls for elbows-at-sides elastic resistance rather than a 90/90, face-pull, straight-arm, or eccentric-only task.',
      'primaryCue','Keep both elbows beside your ribs, rotate your hands apart, and return slowly while your wrists, feet, and ribs stay quiet.',
      'expectedSensations',jsonb_build_array('light-to-moderate effort at the back and side of both shoulders','steady band tension between the hands','light forearm grip and upper-back support effort','comfortable range without forced stretch'),
      'unexpectedSensations',jsonb_build_array('sharp increasing night or post-trauma pain','pinching painful clicking recurrent instability or uncontrolled return','numbness tingling weakness pins and needles or altered circulation','dizziness faintness nausea visual change chest pain unusual breathlessness or disorientation','painful hand wrist elbow neck back or standing position','band damage slipping snapping or uncontrolled recoil','forced range breath holding or trunk compensation'),
      'painGuidance','Control the band back to low tension if safe, stop, signal the coach, and follow facility escalation policy; do not repeat to test symptoms.',
      'selfChecks',jsonb_build_array('feet stay planted','both elbows remain near 90 degrees and beside the ribs','hands move apart symmetrically','wrists stay organized','range remains comfortable','return reaches the same start and counts one rep','trunk and breathing remain controlled','band remains intact and controlled'),
      'accessibility',jsonb_build_array('front and side demonstration','written four-step outward-and-return sequence','visual elbow and hand markers','palms-up or thumbs-up recorded grip','lighter tension wider initial hand spacing and smaller range','fewer repetitions slower tempo and more rest','fixed towel spacer at elbows','separately validated seated supine or unilateral task when needed'),
      'mediaAlternatives',jsonb_build_array('written contact and action sequence','front and side coach demonstration','still images for start end range and return','auditory elbows stay hands apart return prompts'),
      'notReadinessOrClinicalClassification',TRUE),
    jsonb_build_object(
      'observationChecklist',jsonb_build_array('exact variant band and standing station','band condition grip and unanchored path','fixed feet and starting elbow geometry','bilateral elbow retention and hand symmetry','wrist shoulder scapular and trunk control','comfortable range and controlled return','pace breathing symptoms first fault actual duration and release control'),
      'faultCorrections',jsonb_build_object(
        'elbow_drift','reduce tension or range and use a fixed towel checkpoint; do not count until the upper arms stay beside the ribs',
        'wrist_substitution','reduce tension and restore organized wrists; wrist motion does not replace shoulder rotation',
        'asymmetry','reduce range or tension and restore synchronous hand travel',
        'shrug_or_neck_tension','reduce tension or range and restore comfortable shoulder position without forced depression',
        'trunk_extension_rotation_or_sway','reduce range tension or stance demand and restore fixed feet and trunk control',
        'uncontrolled_return_or_release','reduce tension or dose and return slowly; stop if band control is uncertain',
        'damaged_band','stop immediately remove the band from service and follow equipment incident policy',
        'forced_range_or_breath_hold','reduce range pace or dose; stop if it cannot be corrected comfortably',
        'symptom','stop and follow escalation policy without diagnosis'),
      'demonstrationPlan',jsonb_build_array('name exact unanchored band elbows-at-sides base and count','show front and side views','show outward phase end range and controlled return','show elbow drift wrist substitution shrug trunk motion and uncontrolled release nonexamples','state expected effort band inspection symptoms and stop signal'),
      'groupManagement',jsonb_build_array('one participant per clear standing station','inspect and assign bands before use','preserve front and side sightlines','separate stations from faces and cross traffic','track actual cycles tension range time faults symptoms rest and release control','remove damaged bands and do not advance stations while symptoms remain unresolved'),
      'modificationDecisionTree',jsonb_build_array('increase initial hand spacing','use lighter tension','reduce comfortable range','reduce repetitions','slow tempo','increase rest','add a fixed towel elbow checkpoint','stop and choose a separately reviewed changed-base attachment laterality angle or contraction card after full revalidation'),
      'doNotUseWhen',jsonb_build_array('safe standing band grip or controlled release is unavailable','band is damaged or recoil clearance is inadequate','current symptoms restrictions or recent trauma conflict','exact action or stop signal cannot be understood','floor space sightline communication or exit is inadequate','clinical assessment treatment or clearance is intended'),
      'clinicalScope','Observe report record stop and escalate; do not diagnose shoulder pathology prescribe rehabilitation clear injury or promise prevention correction or performance transfer.'),
    jsonb_build_object(
      'issueCategories',jsonb_build_array('identity_or_variant','media','content_or_cue','symptom_or_incident','accessibility','equipment_or_station','dose_or_duration','substitution','persistence_or_rendering','privacy_or_data'),
      'supportEscalation',jsonb_build_object('urgent','follow facility emergency policy for trauma neurologic circulation cardiopulmonary altered-consciousness or other emergency signs','clinical','refer diagnosis treatment clearance persistent night or post-trauma symptoms and recurrent instability to qualified care','content','route identity anatomy media dose difficulty and graph disputes to qualified reviewers','technical','preserve request workout variant and logs while escalating deterministic generation or persistence failures'),
      'retentionPolicy','Persist selected definition variant profile band identifier or tension class grip planned and actual cycles range time under tension rest faults symptoms stops substitutions duration station equipment issue and renderer version under facility privacy policy.',
      'changeImpactPolicy','A change to base laterality band attachment grip shoulder angle action contraction count loading constraints dose duration media graph difficulty or instructions invalidates dependent generation review and rendering assumptions until revalidated.',
      'feedbackFields',jsonb_build_array('request_id','workout_id','definition_id','variant_id','profile_key','band_tension_and_condition','grip','planned_and_actual_dose','range','time_under_tension','first_fault','symptoms','stop_reason','substitution','duration','equipment_issue','coach_edit','athlete_comprehension','media_issue','incident_id'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  )
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
    external_rotation_variant,canonical_definition,
    'bilateral-standing-elbows-at-sides-unanchored-band',
    'Bilateral Band External Rotation — Standing, Elbows at Sides',
    ARRAY['grip_orientation','comfortable_range','band_tension','initial_hand_spacing','tempo','end_range_pause','breathing_prompt','repetitions','sets','rest','fixed_towel_spacer']::TEXT[],
    jsonb_build_object(
      'technicalComplexity',26,'absoluteLoadDemand',18,'physicalDifficulty',18,
      'coordinationDemand',26,'supervisionDemand',14,'failureConsequence',14,
      'impact',1,'workCapacityDemand',12,'baseOverallDifficulty',greatest(26,18),
      'overallFormula','max(exercise_complexity,physical_difficulty)',
      'exerciseDifficultyDescribesTaskOnly',TRUE,'independentCalibrationRequired',TRUE),
    jsonb_build_object(
      'selectable',TRUE,'equipment',jsonb_build_array('bands'),
      'optionalEquipment',jsonb_build_array(),
      'supportBase','bilateral_standing_fixed_feet',
      'bandAttachment','unanchored_band_held_between_both_hands_in_front_of_torso',
      'elbowRule','both_elbows_flexed_near_90_degrees_and_upper_arms_retained_beside_ribs',
      'exactSequence',jsonb_build_array('standing_elbows_at_sides_band_in_front_start','bilateral_forearms_and_hands_rotate_outward','comfortable_end_range','controlled_return_to_same_start'),
      'countingRule','one_complete_bilateral_outward_and_return_cycle_is_one_repetition',
      'validCompletion','feet remain fixed both hands retain the band both upper arms stay beside the ribs wrists and trunk stay organized motion remains bilateral and comfortable the return reaches the same start breathing continues and no stop rule occurs',
      'invalidCompletion',jsonb_build_array('elbow_or_upper_arm_drift','shrug','wrist_substitution','trunk_extension_rotation_or_sway','asymmetric_or_incomplete_cycle','forced_range','uncontrolled_band_release','breath_hold','symptom_stop'),
      'variantBoundaries',jsonb_build_array('base','laterality','band_attachment','shoulder_abduction_angle','contraction_mode','required_scapular_action','action_sequence','clinical_scope','count'),
      'clinicalAssessmentOrTreatment',FALSE,'humanReviewRequired',TRUE),
    'review',
    jsonb_build_object(
      'loadingType','unanchored_elastic_resistance_bilateral_shoulder_external_rotation',
      'externalLoadMethod','elastic_band_tension_between_both_hands',
      'gripDemand',12,'jointStress',16,'spinalLoading',1,'eccentricStress',10,
      'landingContactsPerRep',0,'handImpactContactsPerRep',0,'impactClass','none',
      'primaryExposure',jsonb_build_array('glenohumeral_external_rotation','infraspinatus_and_teres_minor_demand','posterior_shoulder_support','scapular_and_trunk_stabilization','band_grip_and_release_control'),
      'tracking',jsonb_build_array('variant','band_identifier_and_condition','grip_orientation','initial_hand_spacing','tension_or_color','complete_cycles','comfortable_range','tempo','end_range_hold','elbow_and_wrist_faults','symptoms','time_under_tension','duration','same_session_shoulder_and_grip_exposure')),
    jsonb_build_object(
      'localMuscleFatigue',18,'gripFatigue',12,'technicalFatigueSensitivity',26,
      'impactAccumulation',1,'recoveryHours',12,'recoveryRangeHours',jsonb_build_array(8,24),
      'primaryFatigueSites',jsonb_build_array('posterior_rotator_cuff','posterior_shoulder','scapular_stabilizers','forearm_and_grip','trunk_postural_stabilizers','attention_and_bilateral_control'),
      'cumulativeBudget',jsonb_build_object('completeCycles',45,'timeUnderTensionSeconds',480,'externalRotationWorkSeconds',360,'elbowsAtSidesShoulderLoad',45,'gripSeconds',480,'technicalSensitivity',26,'impact',1),
      'interference',jsonb_build_array('later_high_priority_throwing_climbing_hanging_handstand_pressing_or_overhead_work','same_session_external_rotation_pulling_or_grip_loading','fatigue_that_changes_elbow_position_symmetry_wrist_or_trunk_control'),
      'recoveryIsPlanningEstimate',TRUE,'tissueThresholdNotEstablished',TRUE),
    jsonb_build_object(
      'trainingStimuli',jsonb_build_array('low_load_bilateral_shoulder_external_rotation','elbows_at_sides_position_control','band_release_control','bilateral_shoulder_trunk_dissociation'),
      'stimulusDose',jsonb_build_object('sets',jsonb_build_array(1,3),'completeCycles',jsonb_build_array(6,15),'secondsPerCycle',jsonb_build_array(3,8),'endRangeHoldSeconds',jsonb_build_array(0,3),'restSeconds',jsonb_build_array(20,60)),
      'weeklyExposure',jsonb_build_object('minimum',0,'maximumWithoutReview',7,'unit','sessions','contextDependent',TRUE),
      'prerequisites',jsonb_build_array('safe_unsupported_standing_and_band_handling','comfortable_bilateral_elbows_at_sides_external_rotation','understands_outward_and_return_count_and_stop','can_control_wrists_elbows_trunk_and_band_release','same_session_shoulder_rotator_cuff_scapular_grip_and_overhead_budgets_fit'),
      'completionCriteria',jsonb_build_array('feet_fixed','upper_arms_beside_ribs','bilateral_symmetric_outward_rotation','organized_wrists_and_trunk','comfortable_range','controlled_return_to_same_start','continuous_breathing','no_stop_symptoms'),
      'sequenceRules',jsonb_build_array('prepare_access_or_resilience_context','do_not_turn_grip_range_tension_spacing_tempo_pause_breathing_or_dose_annotations_into_hidden_variants','do_not_anchor_the_band_raise_the_elbows_add_a_face_pull_or_convert_to_eccentric_or_isometric_silently','revalidate_downstream_shoulder_grip_throwing_climbing_hanging_handstand_pressing_and_overhead_load'),
      'pairingCompatibility',jsonb_build_object('compatible',jsonb_build_array('low_load_trunk_or_lower_body_preparation_when_budgets_fit'),'avoid',jsonb_build_array('fatiguing_external_rotation_or_grip_before_priority_throwing_climbing_hanging_handstand_or_overhead_skill','symptom_provoking_shoulder_work','time_critical_work_when_the_drill_displaces_priority_training')),
      'interferenceRules',jsonb_build_array('count_all_overlapping_external_rotation_and_posterior_shoulder_work','count_all_overlapping_grip_pulling_throwing_climbing_hanging_handstand_pressing_and_overhead_work','stop_before_elbow_wrist_symmetry_trunk_or_band_release_quality_changes'),
      'uncertaintyPolicy','When exact base band attachment elbow position action count symptoms equipment condition or available time is uncertain do not select; request clarification or choose a separately validated card.',
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
  SELECT p.id,external_rotation_variant,p.profile_key,p.phase_key,'primary',
    CASE p.phase_key WHEN 'prepare_and_access' THEN
      'Use the exact bilateral elbows-at-sides cycle as low-load shoulder preparation only when band condition, symptoms, duration, and cumulative posterior-shoulder, grip, and downstream upper-limb budgets fit.'
    ELSE
      'Use the exact cycle for controlled low-load bilateral external-rotation capacity without turning it into a maximal effort, speed test, clinical treatment, or readiness assessment.' END,
    CASE p.phase_key WHEN 'prepare_and_access' THEN 90 ELSE 82 END,
    CASE p.phase_key WHEN 'prepare_and_access' THEN 86 ELSE 80 END,
    jsonb_build_object('shoulder_external_rotation',94,'bilateral_control',90,'band_release_control',86,'low_load_resilience',CASE WHEN p.phase_key='prepare_and_access' THEN 74 ELSE 90 END),
    jsonb_build_object('sets',jsonb_build_array(1,CASE WHEN p.phase_key='prepare_and_access' THEN 2 ELSE 3 END),'completeCycles',jsonb_build_array(6,15),'secondsPerCycle',jsonb_build_array(3,8),'endRangeHoldSeconds',jsonb_build_array(0,3),'restSeconds',jsonb_build_array(20,60),'exampleDoseIsNotUniversal',TRUE),
    'Feet remain fixed, both upper arms stay beside the ribs with elbows near 90 degrees, hands rotate apart symmetrically through comfortable range, wrists and trunk remain organized, the band stays intact and controlled, the slow return reaches the same start, breathing continues, and no stop symptom occurs.',
    ARRAY[
      'Sharp, increasing, night, post-trauma, or unfamiliar pain or participant stop request.',
      'Shoulder pinching, painful clicking, instability, guarding, or uncontrolled return.',
      'Numbness, tingling, weakness, pins and needles, altered circulation, or another neurologic sign.',
      'Dizziness, faintness, nausea, visual change, chest pain, unusual breathlessness, disorientation, or inability to communicate.',
      'Hand, wrist, elbow, shoulder, neck, back, balance, or standing symptoms prevent the exact task.',
      'An elbow drifts, a shoulder shrugs, wrists substitute, trunk extends or rotates, or bilateral symmetry cannot be restored by reducing tension, range, or pace.',
      'The band tears, slips, snaps, shows damage, cannot be controlled, or creates an unsafe recoil or eye-exposure path.',
      'Forced range, breath holding, added face pull, raised elbow, anchor, changed base, changed laterality, or another wrong task cannot be corrected safely.',
      'Floor, equipment, space, traffic, hygiene, sightline, communication, or emergency route becomes unsafe.',
      'The planned cycle, time-under-tension, shoulder, grip, technical-fatigue, duration, or downstream exposure budget is reached.'
    ]::TEXT[],
    'Verify the exact standing unanchored-band variant, band condition, grip, initial tension, elbow position, comfortable bilateral range, restrictions, symptoms, planned cycles and actual time under tension, and downstream shoulder and grip demand. Demonstrate front and side; count only a complete outward-and-controlled-return cycle. Observe feet, upper arms, wrists, symmetry, trunk, shrugging, band path, breathing, symptoms, first fault, actual duration, and controlled release. Do not diagnose, treat, or imply readiness.',
    'Stand tall with both elbows beside your ribs. Keep your wrists quiet, rotate both hands apart through a comfortable range, then return slowly to the same start. Stop for pain, pinching, tingling, weakness, dizziness, or band damage.',
    'More consistent low-load bilateral external-rotation control in the exact elbows-at-sides band task; no treatment, structural, readiness, prevention, or performance outcome is guaranteed.',
    ARRAY['bands']::TEXT[],
    jsonb_build_object('stationCapacity',1,'base','bilateral_standing_fixed_feet','requiredEquipment','one_intact_unanchored_resistance_band','space','one_person_standing_clearance_outside_band_recoil_and_eye_path','setupSeconds',20,'bandChangeSeconds',15,'coachSightline','front_and_side','crossTrafficProhibited',TRUE,'bandAndFloorInspectionRequired',TRUE,'controlledReleaseRequired',TRUE,'revalidateAfterAnyChange',TRUE),
    ARRAY[ninety_ninety_variant,face_pull_variant,eccentric_variant,wall_slide_variant]::UUID[],
    'review',
    jsonb_build_object('durationFormula','setup_seconds + band_inspection_seconds + sum(actual_valid_cycles * actual_seconds_per_cycle) + end_range_hold_seconds + rest_seconds + invalid_or_partial_attempt_seconds + symptom_response_seconds + substitution_seconds + band_change_seconds + station_reset_seconds','secondsPerCycle',jsonb_build_array(3,8),'minimumSeconds',45,'typicalSeconds',100,'maximumSecondsWithoutReview',360,'includeActualNotPlanned',TRUE,'recomputeAfterSubstitution',TRUE),
    jsonb_build_object('regressionOrder',jsonb_build_array('reduce_band_tension','widen_initial_hand_spacing','reduce_comfortable_range','reduce_to_six_clean_cycles','slow_the_return','increase_rest','stop_and_select_a_separately_validated_base_or_action'),'progressionOrder',jsonb_build_array('complete_clean_cycles','increase_within_six_to_fifteen_cycle_profile','add_brief_end_range_pause','increase_tension_only_if_position_and_symptoms_remain_valid','select_a_distinct_shoulder_angle_action_or_base_only_after_full_revalidation'),'neverScaleByForcingRangeMaximalTensionSpeedOrIgnoringSymptoms',TRUE),
    jsonb_build_object('record',jsonb_build_array('definition_and_variant','band_identifier_condition_and_tension','grip_orientation_initial_hand_spacing_and_towel_spacer','planned_and_actual_complete_cycles','range_tempo_end_range_hold_and_rest','valid_invalid_partial_and_symptom_limited_attempts','feet_elbow_wrist_symmetry_and_trunk_rule','first_fault','symptoms_and_stop_reason','time_under_tension','duration','substitution','band_change_and_release'),'validUnit','one_complete_bilateral_outward_and_controlled_return_to_same_start_with_fixed_feet_upper_arms_beside_ribs_organized_wrists_and_trunk_and_no_stop','partial_cycles_do_not_count',TRUE),
    jsonb_build_object('athlete',jsonb_build_array('fixed_stance','elbows_beside_ribs','hands_apart','comfortable_range','slow_return','warning_symptom_and_band_damage_stop'),'coach',jsonb_build_array('band_condition_and_recoil_path','elbow_position_and_bilateral_symmetry','wrist_and_trunk_control','valid_cycle_and_first_fault','actual_exposure_and_downstream_budget','clinical_scope','logging_and_escalation'),'accessibility',jsonb_build_array('front_and_side_demonstration','written_four_step_sequence','visual_elbow_and_hand_markers','palms_up_or_thumbs_up_recorded_grip','lighter_tension_wider_spacing_smaller_range_fewer_cycles_slower_tempo_and_rest','fixed_towel_spacer','separately_validated_seated_supine_unilateral_or_anchored_alternative'))
  FROM (VALUES
    ('04b3eccd-88a3-4049-9d5f-17b768e8f01e'::UUID,'prepare-bilateral-band-external-rotation-elbows-at-sides','prepare_and_access'),
    ('5474340f-a3ff-4a8c-a5c2-d0ca36cbbc01'::UUID,'resilience-bilateral-band-external-rotation-elbows-at-sides','resilience')
  ) p(id,profile_key,phase_key)
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
    equipment_required=EXCLUDED.equipment_required,logistics_json=EXCLUDED.logistics_json,
    substitution_ids=EXCLUDED.substitution_ids,status='review',
    time_model_json=EXCLUDED.time_model_json,dose_scaling_json=EXCLUDED.dose_scaling_json,
    measurement_json=EXCLUDED.measurement_json,
    support_prompts_json=EXCLUDED.support_prompts_json,updated_at=now();

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,rationale,
    evidence_json,resolution_source,reviewed_by,resolved_at)
  SELECT 1,canonical_definition,i.definition_id,i.decision,i.rationale,
    jsonb_build_object('migration',migration_key,'identityBoundary',i.boundary_key,
      'source36Contract','bilateral_standing_fixed_feet_elbows_at_sides_unanchored_band_external_rotation_and_controlled_return',
      'neighborContract',i.neighbor_contract,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    i.resolution_source,NULL,now()
  FROM (VALUES
    (ninety_ninety_definition,'distinct_exercises','elbows_at_sides_vs_ninety_ninety','Sources 1313 and 1347 hold the upper arm near shoulder height rather than beside the ribs, changing joint position, resistance setup, loading, purpose, and fault rules.','shoulder_abduction_near_90_degrees','deterministic_identity_equivalence'),
    (face_pull_definition,'distinct_exercises','external_rotation_cycle_vs_face_pull_sequence','Source 1346 adds a pull toward the face before external rotation, changing action sequence, elbow path, loading, and count.','face_pull_then_external_rotation','deterministic_identity_equivalence'),
    (eccentric_definition,'needs_human_review','exact_cycle_vs_incomplete_eccentric_contract','Source 1348 omits elbow position, shoulder angle, start position, return assistance, rotation phase, and exact count, so name similarity cannot establish sameness or difference.','identity_contract_incomplete_and_quarantined','deterministic_identity_equivalence'),
    (wall_slide_definition,'distinct_exercises','unanchored_band_rotation_vs_wall_slide_lift_off','Wall Slides with Lift-Off use a wall interface, forearm sliding, shoulder elevation, terminal arm lift-off, and replacement rather than band-resisted elbows-at-sides rotation.','forearm_wall_slide_terminal_full_arm_lift_off','deterministic_identity_equivalence')
  ) i(definition_id,decision,boundary_key,rationale,neighbor_contract,resolution_source)
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
        'noUniversalShapeRangeTechniqueSafetyEligibilityDoseRecoveryOutcomeOrDifficultyClaim',TRUE)),
    e.quality,'candidate',NULL,NULL
  FROM (VALUES
    ('identity','https://www.nwhealth.edu/wp-content/uploads/2019/04/NWHSU-rehab-shoulder-ext-rot.pdf','Shoulder External Rotation with Resistance','Northwestern Health Sciences University','expert_instruction','The direct instruction places the band in front of the torso, keeps both elbows at the sides, pulls both hands apart, and returns slowly to start.','direct exact-task identity and instruction','The source does not define every Vortex base grip count fault population or neighbor boundary.',82),
    ('taxonomy','https://admin.performancehealth.com/media/wysiwyg/pdfs/RTC_PDF.pdf','Rotator Cuff Strengthening Exercises','Performance Health','manufacturer_instruction','The bilateral external-rotation instruction uses elastic resistance, elbows at 90 degrees, outward rotation, a hold, and slow return.','direct movement and equipment context','The source does not create Vortex controlled taxonomy keys or outcome guarantees.',80),
    ('anatomy','https://pubmed.ncbi.nlm.nih.gov/41559205/','Effects of shoulder abduction angle and elastic-band resistance on shoulder muscle activity during external rotation','Peer-reviewed indexed research','peer_reviewed_research','The study measured shoulder and rotator-cuff activity during elastic-band external rotation at different humeral-abduction angles and resistance levels.','position-dependent anatomy and load context','The study does not establish isolated activation force normal range treatment or eligibility.',88),
    ('biomechanics','https://pmc.ncbi.nlm.nih.gov/articles/PMC6262970/','Comparison of shoulder rotation kinematics under constant and elastic resistance','Peer-reviewed open-access research','peer_reviewed_research','Three-dimensional analysis reports that resistance method changes joint-moment and range-of-motion characteristics across shoulder-rotation exercise.','resistance geometry and identity-boundary context','The study does not validate every exact Source-36 operating rule.',86),
    ('difficulty','https://www.nwhealth.edu/wp-content/uploads/2019/04/NWHSU-rehab-shoulder-ext-rot.pdf','Shoulder External Rotation with Resistance','Northwestern Health Sciences University','expert_instruction','The direct task coordinates bilateral hand separation while both elbows remain at the sides and the return stays controlled.','task complexity context','The source does not score the task or classify participants.',82),
    ('load_fatigue_recovery','https://pubmed.ncbi.nlm.nih.gov/41559205/','Effects of shoulder abduction angle and elastic-band resistance on shoulder muscle activity during external rotation','Peer-reviewed indexed research','peer_reviewed_research','Shoulder angle and elastic-band resistance change measured activity during external-rotation exercise.','load and exposure context','The study does not quantify universal fatigue thresholds cumulative limits or recovery hours.',88),
    ('constraints','https://pubmed.ncbi.nlm.nih.gov/40165544/','Rotator Cuff Tendinopathy Diagnosis, Nonsurgical Medical Care, and Rehabilitation: A Clinical Practice Guideline','Journal of Orthopaedic & Sports Physical Therapy','professional_standard','Diagnosis treatment prognosis and return-to-function decisions require appropriate professional context.','clinical scope boundary','The guideline does not make this workout card a diagnosis treatment or clearance tool.',94),
    ('dosage','https://www.orthopedicone.com/news-events/shoulder-exercises-for-improved-rotator-cuff-strength-and-stability/','Shoulder Exercises for Improved Rotator Cuff Strength and Stability','Orthopedic One','expert_instruction','Orthopedic One presents a no-money example with a two-second outward phase, four-second return, and three sets of fifteen twice weekly.','context-specific programming example','The example is not a universal prescription and does not validate Vortex budgets recovery or population rules.',78),
    ('instructions','https://www.nwhealth.edu/wp-content/uploads/2019/04/NWHSU-rehab-shoulder-ext-rot.pdf','Shoulder External Rotation with Resistance','Northwestern Health Sciences University','expert_instruction','The direct sequence uses a band in front, elbows retained at the sides, hands pulled apart, an optional hold, and slow return.','direct exact-task instruction','Vortex adds explicit standing base wrist trunk band-condition count stop persistence and duration rules.',82),
    ('safety_stop_rules','https://admin.performancehealth.com/media/wysiwyg/pdfs/RTC_PDF.pdf','Rotator Cuff Strengthening Exercises','Performance Health','manufacturer_instruction','Performance Health warns resistance products can break or slip and calls for proper stance grip secure use and eye-protection consideration.','band condition release and recoil safety context','Facility symptom trauma neurologic circulation cardiopulmonary incident and emergency rules remain separately required.',80),
    ('programming','https://pmc.ncbi.nlm.nih.gov/articles/PMC5847412/','Elastic-resistance exercise effects on shoulder strength','Peer-reviewed open-access research','peer_reviewed_research','A supervised elastic-resistance program included shoulder external rotation at the side and reported strength changes in the studied sample.','programming and outcome-claim boundary','The multi-exercise protocol and sample do not justify universal prevention rehabilitation readiness dose or transfer claims.',86),
    ('athlete_support','https://www.nwhealth.edu/wp-content/uploads/2019/04/NWHSU-rehab-shoulder-ext-rot.pdf','Shoulder External Rotation with Resistance','Northwestern Health Sciences University','expert_instruction','The page provides a short contact-and-direction sequence with fields for individualized dose.','plain-language participant support','The source does not establish universal sensations access or symptom interpretation.',82),
    ('coach_support','https://pubmed.ncbi.nlm.nih.gov/41559205/','Effects of shoulder abduction angle and elastic-band resistance on shoulder muscle activity during external rotation','Peer-reviewed indexed research','peer_reviewed_research','Shoulder-abduction angle and band resistance materially change the measured loading context.','coach observation and identity-boundary context','The study does not prescribe Vortex layout count escalation or approval.',88),
    ('accessibility','https://admin.performancehealth.com/media/wysiwyg/pdfs/RTC_PDF.pdf','Rotator Cuff Strengthening Exercises','Performance Health','manufacturer_instruction','The bilateral task can be explained with elbow hand direction hold and return checkpoints and adjustable elastic resistance.','communication and load-scaling context','Changing base attachment angle action or scope requires another reviewed card.',80),
    ('alternates','https://pmc.ncbi.nlm.nih.gov/articles/PMC6262970/','Comparison of shoulder rotation kinematics under constant and elastic resistance','Peer-reviewed open-access research','peer_reviewed_research','Resistance source and exercise geometry alter shoulder-rotation kinetics and kinematics.','alternate identity-boundary context','The study does not adjudicate all Vortex alternates or approve graph edges.',86),
    ('media','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en','Embed videos and playlists','YouTube Help','manufacturer_instruction','Five candidates returned current oEmbed title channel thumbnail and iframe metadata on 2026-08-09.','candidate metadata only','oEmbed does not prove playback exact setup elbow position grip action return count captions accessibility quality safety card match or approval.',82)
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
  SELECT canonical_definition,external_rotation_variant,2,
    'https://www.youtube.com/watch?v='||m.video_id,
    'https://www.youtube-nocookie.com/embed/'||m.video_id,
    m.video_id,m.title,m.channel,NULL,'en',NULL,TRUE,NULL,NULL,
    'healthy','candidate','manual_research',m.query,NULL,NULL,
    '2026-11-09'::TIMESTAMPTZ,
    'Current YouTube oEmbed metadata only. Playback exact bilateral standing unanchored-band setup elbow position grip action return count captions accessibility cue quality safety reviewer identity card-version match and approval remain unverified.'
  FROM (VALUES
    ('_UvmPNGtlPM','Shoulder External Rotation with Resistive Band - Ask Doctor Jo','AskDoctorJo','Source 36 candidate checked by YouTube oEmbed'),
    ('4tpl-huz060','Shoulder exercise - External Rotation Retraction','www.sportsinjuryclinic.net','Source 36 candidate checked by YouTube oEmbed'),
    ('_thyHbdB7nI','Banded External Rotation','Camille Leblanc-bazinet','Source 36 candidate checked by YouTube oEmbed'),
    ('_G0feLqXA0E','Shoulder W Exercise for Bilateral External Rotation - Mike Reinold','Mike Reinold','Source 36 candidate checked by YouTube oEmbed'),
    ('DZP1RF7uyIs','Shoulder Exercises for Tennis Players','Orthopedic One','Source 36 composite candidate containing a no-money segment checked by YouTube oEmbed')
  ) m(video_id,title,channel,query)
  ON CONFLICT(definition_id,reviewed_card_version,url) DO UPDATE SET
    variant_id=external_rotation_variant,embed_url=EXCLUDED.embed_url,video_id=EXCLUDED.video_id,
    title=EXCLUDED.title,channel_name=EXCLUDED.channel_name,duration_seconds=NULL,
    language_code='en',captions_available=NULL,embedding_allowed=TRUE,
    exact_variant_match=NULL,demonstration_quality_score=NULL,link_status='healthy',
    review_status='candidate',discovery_method='manual_research',
    source_query=EXCLUDED.source_query,reviewer_user_id=NULL,reviewed_at=NULL,
    next_review_at=EXCLUDED.next_review_at,notes=EXCLUDED.notes,updated_at=now();

  INSERT INTO coaching.exercise_alternate_assessment_v1(
    definition_id,reviewed_card_version,alternate_name,classification,rationale,
    distinguishing_dimensions,proposed_card_json,review_status,reviewer_user_id,reviewed_at)
  SELECT canonical_definition,2,a.name,a.classification,a.rationale,
    jsonb_build_object('boundaryKey',a.boundary_key,'factsRequired',a.facts,
      'neverInferFromNameOrParticipantRanking',TRUE),
    jsonb_build_object('status',a.proposed_status,'classificationCandidate',a.classification,
      'humanIdentityContentAndSafetyReviewRequired',TRUE,'approvalsCreated',FALSE),
    'candidate',NULL,NULL
  FROM (VALUES
    ('Bilateral Band External Rotation — Elbows at Sides','same_identity','The descriptive label preserves the exact standing bilateral unanchored-band outward-and-return cycle with upper arms beside the ribs.','source_alias',jsonb_build_array('standing','bilateral','unanchored_band','elbows_at_sides'),'authored_variant'),
    ('No-Money Drill','same_identity','The nickname is an alias only when it means the same elbows-at-sides cycle rather than a W raise, robbery, pull-apart, or added scapular sequence.','nickname_boundary',jsonb_build_array('same_base_attachment_action_and_count'),'merge_alias'),
    ('Standing Band External Rotation with Elbows Tucked','same_identity','Tucked elbows describe the retained upper-arm boundary without changing attachment, action, or count.','elbows_tucked_alias',jsonb_build_array('upper_arms_beside_ribs','same_cycle'),'merge_alias'),
    ('Palms-Up or Thumbs-Up Grip','modifier_annotation','Forearm orientation is recorded for delivery and media matching when wrists remain organized.','grip_annotation',jsonb_build_array('grip_orientation','same_shoulder_action'),'delivery_annotation'),
    ('Comfortable External-Rotation Range','modifier_annotation','Comfortable range changes amplitude without changing base contacts action or count.','range_annotation',jsonb_build_array('comfortable_range','same_cycle'),'delivery_annotation'),
    ('Light Band Tension','modifier_annotation','Band color and low resistance change load within the reviewed task when form range and safety remain valid.','tension_annotation',jsonb_build_array('band_tension','same_attachment'),'delivery_annotation'),
    ('Initial Hand Spacing','modifier_annotation','Hand spacing adjusts starting tension while the unanchored band and bilateral cycle remain unchanged.','spacing_annotation',jsonb_build_array('initial_hand_spacing','same_attachment'),'delivery_annotation'),
    ('Controlled Tempo','modifier_annotation','Outward and return pace change dose without changing the full cycle.','tempo_annotation',jsonb_build_array('tempo','same_count'),'delivery_annotation'),
    ('Brief End-Range Pause','modifier_annotation','A short pause changes time under tension while action and count remain exact.','pause_annotation',jsonb_build_array('end_range_pause','same_cycle'),'delivery_annotation'),
    ('Repetitions Sets or Rest','modifier_annotation','Volume and recovery alter dosage rather than identity.','dose_annotation',jsonb_build_array('repetitions','sets','rest'),'delivery_annotation'),
    ('Breathing Prompt','modifier_annotation','Continuous breathing or exhale cues change delivery rather than mechanics.','breathing_annotation',jsonb_build_array('breathing_prompt'),'delivery_annotation'),
    ('Fixed Towel Spacer at Elbows','modifier_annotation','A thin fixed towel can provide an elbow-position checkpoint without changing band path action or base.','elbow_feedback_annotation',jsonb_build_array('fixed_towel_spacer','same_cycle'),'delivery_annotation'),
    ('Seated Bilateral Band External Rotation','new_variant','Seated execution changes base equipment trunk constraint accessibility and logistics.','seated_variant',jsonb_build_array('seated_base'),'needs_human_review'),
    ('Supine Bilateral Band External Rotation','new_variant','Supine execution changes gravity support surface trunk demand transfer and range constraints.','supine_variant',jsonb_build_array('supine_base','surface'),'needs_human_review'),
    ('Band Loop Around Wrists External Rotation','new_variant','A wrist loop changes grip contact resistance application release risk and hand demand.','wrist_loop_variant',jsonb_build_array('wrist_loop_attachment'),'needs_human_review'),
    ('Bilateral External-Rotation Isometric Hold','new_variant','Maintaining a fixed angle changes contraction count time model fatigue and stop rules.','isometric_variant',jsonb_build_array('isometric_contraction'),'needs_human_review'),
    ('No-Money with Required Scapular Retraction','new_variant','Adding a deliberate scapular-retraction action and endpoint changes joint actions fault rules and count.','scapular_retraction_variant',jsonb_build_array('required_scapular_retraction'),'needs_human_review'),
    ('Half-Kneeling Bilateral Band External Rotation','new_variant','Half-kneeling changes base floor transfer balance laterality hip and trunk demand and logistics.','half_kneeling_variant',jsonb_build_array('half_kneeling_base'),'needs_human_review'),
    ('Unilateral Anchored Band External Rotation at Side','new_variant','Single-arm execution with a fixed anchor changes laterality vector setup band-failure risk and comparison rules.','unilateral_anchored_variant',jsonb_build_array('unilateral','fixed_anchor'),'needs_human_review'),
    ('Band External Rotation at 45 Degrees Abduction','new_variant','Raising the upper arm changes joint position muscle activity loading setup and compensation rules.','forty_five_degree_variant',jsonb_build_array('shoulder_abduction_45_degrees'),'needs_human_review'),
    ('Cable or Band 90/90 External Rotation','new_definition','Sources 1313 and 1347 hold the upper arm near shoulder height, changing position setup loading purpose and fault rules.','ninety_ninety_distinct',jsonb_build_array('shoulder_abduction_90_degrees'),'existing_distinct_definition'),
    ('Face Pull to External Rotation','new_definition','Source 1346 adds a pull toward the face before external rotation, changing action sequence elbow path loading and count.','face_pull_distinct',jsonb_build_array('face_pull_then_external_rotation'),'existing_distinct_definition'),
    ('Eccentric Band External Rotation','new_definition','Source 1348 remains quarantined because elbow position shoulder angle start return assistance and count are incomplete.','eccentric_contract_incomplete',jsonb_build_array('identity_contract_incomplete'),'existing_quarantined_definition'),
    ('Straight-Arm Band Pull-Apart','new_definition','Extended elbows and shoulder horizontal abduction change actions leverage range loading and count.','pull_apart_distinct',jsonb_build_array('straight_arm_horizontal_abduction'),'research_queue'),
    ('Band Shoulder Internal Rotation','new_definition','Internal rotation reverses the primary joint action and resistance direction.','internal_rotation_distinct',jsonb_build_array('shoulder_internal_rotation'),'research_queue'),
    ('Clinical Shoulder External-Rotation Test or Assessment','new_definition','Assessment adds standardized position examiner or device measurement consent interpretation and clinical escalation.','clinical_assessment_distinct',jsonb_build_array('clinical_scope','measurement','consent'),'research_queue')
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
      'revalidate',jsonb_build_array('identity and purpose','base laterality band attachment shoulder angle action contraction and count','equipment condition force range and release path','symptoms and restrictions','dose duration and logistics','shoulder rotator-cuff scapular grip pulling throwing climbing hanging handstand pressing and overhead budgets','persistence','coach rendering','athlete rendering'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'review',NULL,NULL,NULL
  FROM (VALUES
    (external_rotation_variant,ninety_ninety_variant,'progression',58,ARRAY['load','range','complexity']::TEXT[],'Raises the upper arms toward 90/90 and changes joint position setup loading and fault rules; use only when that distinct task fits after full reselection.'),
    (external_rotation_variant,face_pull_variant,'progression',52,ARRAY['load','complexity','range']::TEXT[],'Adds a face-pull phase before external rotation and changes sequence elbow path loading and count; it is not an automatic progression.'),
    (external_rotation_variant,eccentric_variant,'lateral_substitution',35,ARRAY['load','complexity','fatigue']::TEXT[],'Source 1348 may change contraction and return assistance, but its exact mechanics are incomplete; the edge remains review-only until identity is resolved.'),
    (external_rotation_variant,wall_slide_variant,'lateral_substitution',28,ARRAY['load','range','stability']::TEXT[],'Changes to a wall-supported shoulder-elevation slide with terminal arm lift-off and requires complete reselection of purpose constraints and budgets.')
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
  SELECT 1,external_rotation_variant,d.dimension,
    CASE d.dimension WHEN 'technicalComplexity' THEN 26 ELSE 18 END,20,
    CASE d.dimension WHEN 'technicalComplexity' THEN
      'Review-only exercise-complexity anchor based on bilateral standing setup elbows-at-sides retention coordinated outward rotation organized wrists quiet trunk controlled return band handling quality gates and count validity.'
    ELSE
      'Review-only physical-difficulty anchor based on light unanchored elastic resistance applied between both hands with local posterior-shoulder scapular grip and postural demand and no impact.'
    END||' This scores the exercise task, not participant proficiency.',
    'review',1,NULL,NULL,
    'Research-informed proposal only; independent comparison and qualified human approval remain required.',NULL
  FROM (VALUES('technicalComplexity'),('absoluteLoadDemand')) d(dimension)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
    proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,reviewed_by=NULL,
    review_notes=EXCLUDED.review_notes,reviewed_at=NULL,updated_at=now();

  UPDATE coaching.exercise SET
    name='Bilateral Band External Rotation — Elbows at Sides',slug='band-external-rotation',
    description='Stand with fixed feet and hold an intact unanchored resistance band between both hands in front of the torso. Keep elbows near 90 degrees and upper arms beside the ribs. Rotate both hands outward through comfortable range, then return slowly to the same start for one repetition without elbow drift, shrugging, wrist substitution, trunk extension, or rotation.',
    instructions='Use the exact canonical variant. Inspect a light band and the recoil path. Stand with fixed feet, hold the unanchored band between both hands in front of the torso, flex elbows near 90 degrees, and keep upper arms beside the ribs. With organized wrists and trunk, rotate both forearms and hands outward symmetrically through comfortable range, then return slowly to the same start to count one repetition. Keep breathing and control the band release. Stop for pain, pinching, painful clicking, instability, numbness, tingling, weakness, altered circulation, dizziness, faintness, nausea, visual change, chest pain, unusual breathlessness, band damage, uncontrolled return, or participant request.',
    skill_level=NULL,age_min=NULL,age_max=NULL,
    default_sets=1,default_reps=8,default_work_seconds=45,default_rest_seconds=30,
    tempo='controlled three to eight seconds per complete outward-and-return cycle',
    load_note='Track band identifier and condition, grip, initial hand spacing, tension, complete cycles, comfortable range, tempo, hold, elbow wrist symmetry and trunk faults, time under tension, symptoms, invalid or partial attempts, rest, duration, and overlapping shoulder rotator-cuff grip pulling throwing climbing hanging handstand pressing and overhead work.',
    est_seconds_per_set=100,is_published=FALSE,archived=FALSE,
    card_summary='Bilateral standing external rotation against an unanchored band with both upper arms retained beside the ribs and a controlled return.',
    coach_language='Verify exact standing base, intact unanchored band, safe recoil path, grip, elbow position, comfortable range, restrictions, symptoms, planned cycles, actual time under tension, first fault, duration, downstream shoulder and grip budget, controlled release, persistence, and escalation.',
    athlete_language='Stand tall with both elbows beside your ribs. Rotate both hands apart through a comfortable range, return slowly to the same start, and stop for pain, pinching, tingling, weakness, dizziness, or band damage.',
    programming_logic=jsonb_build_object(
      'selectionStatus','canonical_variant_required','selectable',TRUE,
      'canonicalDefinitionId',canonical_definition,'exactVariantIds',to_jsonb(active_variant_ids),
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'exerciseDifficultyDescribesTaskOnly',TRUE,
      'selectionInputs',jsonb_build_array('workout purpose','safe unsupported standing and intact band','bilateral elbows-at-sides external-rotation tolerance','grip release and exact count comprehension','band tension cycle dose and duration','cumulative shoulder rotator-cuff scapular and grip load','same-session pulling throwing climbing hanging handstand pressing and overhead demand','coach scope and sightline'),
      'substitutionRevalidation',jsonb_build_array('identity','base laterality attachment shoulder angle action contraction and count','equipment condition force range and release risk','restrictions and symptoms','purpose','dose','fatigue and impact budgets','duration','logistics','persistence','coach rendering','athlete rendering'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    scalable_variables=ARRAY['grip_orientation','comfortable_range','band_tension','initial_hand_spacing','tempo','end_range_pause','breathing_prompt','complete_cycles','rest_seconds','sets','fixed_towel_spacer']::TEXT[],
    movement_family='Bilateral Elbows-at-Sides Band External Rotation',primary_phase_key=NULL,
    phase_subrole=NULL,primary_order_slot=NULL,
    movement_requirements=jsonb_build_object(
      'selectable',TRUE,'canonicalVariantRequired',TRUE,'impactLevel',0,
      'balanceDemand','stable_base','breathingDemand','continuous_no_breath_hold',
      'actions',jsonb_build_array('bilateral_glenohumeral_external_rotation','controlled_internal_rotation_return','scapular_stabilization','elbow_flexion_isometric','wrist_and_trunk_stabilization'),
      'planes',jsonb_build_array('transverse'),
      'mustMaintain',jsonb_build_array('fixed_feet','both_hands_on_unanchored_band','upper_arms_beside_ribs','organized_wrists','bilateral_symmetry','quiet_trunk','comfortable_range','controlled_return','communication'),
      'mustNotAdd',jsonb_build_array('band_anchor','raised_elbows','face_pull','required_scapular_retraction','w_raise','isometric_only','eccentric_only','changed_base','changed_laterality','forced_range','uncontrolled_release'),
      'validCompletion','one_bilateral_outward_and_controlled_return_to_same_start_with_fixed_feet_upper_arms_beside_ribs_organized_wrists_and_trunk_and_no_stop_rule'),
    coaching_execution=jsonb_build_object(
      'qualityGates',jsonb_build_array('variant_and_station_exact','band_intact_and_recoil_path_safe','standing_and_bilateral_range_tolerated','count_understood','feet_fixed','upper_arms_beside_ribs','hands_move_symmetrically','wrists_and_trunk_organized','comfortable_range_and_controlled_return','no_stop_symptoms'),
      'stopRules',jsonb_build_array('sharp_increasing_night_post_trauma_or_unfamiliar_pain','pinching_painful_clicking_instability_or_uncontrolled_return','neurologic_or_circulation_change','dizziness_faintness_nausea_visual_change_chest_pain_unusual_breathlessness_or_disorientation','hand_wrist_elbow_shoulder_neck_back_balance_or_standing_pain','elbow_wrist_symmetry_or_trunk_breakdown','band_damage_slip_snap_or_uncontrolled_recoil','wrong_task_forced_range_or_breath_hold','unsafe_station_or_emergency_route','budget_or_duration_reached'),
      'persistence',jsonb_build_array('definition_and_variant','band_identifier_condition_and_tension','grip_initial_spacing_and_towel_spacer','planned_and_actual_complete_cycles','range_tempo_hold_and_rest','valid_invalid_partial_and_symptom_limited_attempts','feet_elbow_wrist_symmetry_trunk_and_first_fault','symptoms_and_stop_reason','time_under_tension','duration','substitution','band_change_and_release')),
    pairing_logic=jsonb_build_object(
      'sameSessionBudget',jsonb_build_array('complete_external_rotation_cycles','time_under_tension','elbows_at_sides_shoulder_load','posterior_rotator_cuff_load','scapular_stabilization','grip_seconds','technical_fatigue','downstream_pulling_throwing_climbing_hanging_handstand_pressing_and_overhead_work','impact'),
      'avoidAutomaticPairingWith',jsonb_build_array('fatiguing_external_rotation_or_grip_before_priority_throwing_climbing_hanging_handstand_or_overhead_skill','symptom_provoking_shoulder_work','same_session_posterior_shoulder_or_grip_loading_exceeding_budget'),
      'revalidateAfterSubstitution',TRUE),
    media_library=jsonb_build_object(
      'candidate_video_ids',jsonb_build_array('_UvmPNGtlPM','4tpl-huz060','_thyHbdB7nI','_G0feLqXA0E','DZP1RF7uyIs'),
      'reviewState','oembed_metadata_only_candidate_quarantine',
      'playbackExactnessSetupElbowPositionGripActionReturnCountCaptionsAccessibilityQualitySafetyAndApprovalVerified',FALSE,
      'humanReviewRequired',TRUE),
    participant_structure='individual',programming_kind='exercise',linked_skill_id=NULL,
    why_publish_ready=FALSE,updated_at=now()
  WHERE id=36;

  UPDATE coaching.exercise_safety_profile SET
    risk_level=1,impact_level=0,minimum_age_recommended=NULL,
    minimum_skill_level=NULL,requires_spotting=FALSE,
    requires_coach_supervision='recommended',
    minimum_prerequisite_notes='Readiness uses safe unsupported standing, intact band handling, comfortable bilateral elbows-at-sides external rotation, grip and release control, exact cycle comprehension, current symptoms, communication, workout dose, and downstream shoulder and grip loading; never participant proficiency or age.',
    readiness_checks=ARRAY[
      'Confirm exact variant, stable nonslip floor, intact unanchored band, safe recoil and eye path, clearance, sightline, communication, and emergency route.',
      'Confirm hand wrist elbow shoulder neck back balance and standing tolerance and no current symptom or restriction conflict.',
      'Confirm the participant understands fixed feet, upper arms beside ribs, bilateral outward-and-return count, controlled release, range reduction, and stop signal.',
      'Review cumulative external-rotation cycles, time under tension, posterior-shoulder scapular and grip load, technical fatigue, and later pulling throwing climbing hanging handstand pressing or overhead demand.'
    ]::TEXT[],
    stop_signs=ARRAY[
      'Sharp, increasing, night, post-trauma, or unfamiliar pain, guarding, or participant stop request.',
      'Shoulder pinching, painful clicking, instability, or uncontrolled return.',
      'Numbness, tingling, weakness, pins and needles, altered circulation, or another neurologic sign.',
      'Dizziness, faintness, nausea, visual change, chest pain, unusual breathlessness, disorientation, or inability to communicate.',
      'Hand, wrist, elbow, shoulder, neck, back, balance, or standing symptoms prevent the exact task.',
      'Elbow drift, shrugging, wrist substitution, trunk extension or rotation, asymmetry, forced range, breath hold, or wrong-task drift cannot be corrected safely.',
      'Band damage, slipping, snapping, uncontrolled recoil, unsafe eye exposure, or loss of secure grip.',
      'Floor, equipment, space, traffic, sightline, communication, duration, budget, or emergency route becomes inadequate.'
    ]::TEXT[],
    contraindications=ARRAY[
      'Current symptoms, trauma, procedure, instability, or clinical restrictions conflict with resisted bilateral shoulder external rotation or standing.',
      'No safe standing station, intact band, controlled grip and release, recoil clearance, sightline, communication, or emergency route.',
      'The intended service is diagnosis, treatment, injury management, readiness clearance, manual assistance, or another exercise identity.'
    ]::TEXT[],
    common_substitutions=ARRAY[
      'Use 90/90 external rotation only when the raised-arm position and changed loading fit and all checks are rerun.',
      'Use Face Pull to External Rotation only when the added pull sequence fits and all checks are rerun.',
      'Do not use Source 1348 eccentric external rotation automatically while its exact identity remains unresolved.',
      'Author and review seated, supine, half-kneeling, wrist-loop, anchored, unilateral, isometric, or 45-degree alternatives before selection.'
    ]::TEXT[]
  WHERE exercise_id=36;

  UPDATE coaching.exercise_score_v1 SET
    technical_complexity=26,absolute_load_demand=18,coordination_demand=26,
    impact=1,supervision_demand=14,base_overall_difficulty=greatest(26,18),
    legacy_scores=coalesce(legacy_scores,'{}'::JSONB)||jsonb_build_object(
      'candidateReassessment',migration_key,
      'projectionScope','bilateral_standing_elbows_at_sides_unanchored_band_external_rotation_exact_variant',
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'variantScores',jsonb_build_object('bilateralStandingElbowsAtSides',
        jsonb_build_object('complexity',26,'physicalDifficulty',18,'overall',26)),
      'exerciseScoresDescribeTaskOnly',TRUE,'independentCalibrationRequired',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    migration_confidence=60,human_review_status='queued',reviewed_by=NULL,reviewed_at=NULL,
    review_notes='Research-informed candidate reassessment only. Scores describe exercise complexity and physical difficulty, not participant proficiency. Exact mechanics band safety and independent calibration remain required.',
    updated_at=now()
  WHERE exercise_id=36;

  UPDATE coaching.exercise_difficulty_profile SET
    technical=2.6,complexity=2.6,load=1.8,overall=2.6,
    recommended_age_min=NULL,recommended_age_max=NULL,attention_demand='moderate',
    notes='Candidate projection from the exact bilateral standing elbows-at-sides unanchored-band external-rotation variant. Complexity is 26/100, physical difficulty 18/100, and overall 26/100 by maximum. This is not participant proficiency or age classification.',
    source='canonical_research_candidate',updated_at=now()
  WHERE exercise_id=36;

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  VALUES(canonical_definition,1,2,'2.0.0',migration_key,'quarantined',
    jsonb_build_object(
      'identity',jsonb_build_object('passed',TRUE,'identityKey','bilateral_standing_elbows_at_sides_unanchored_band_external_rotation','legacySources',1,'activeVariants',1,'archivedSourceSkeleton',TRUE,'neighborBoundaries',4,'eccentricSourceContractIncomplete',TRUE),
      'taxonomy',jsonb_build_object('passed',TRUE,'controlledTerms',TRUE,'movementPatterns',jsonb_build_array('brace','pull','rotate'),'bodyRegions',jsonb_build_array('shoulder'),'equipment',jsonb_build_array('bands')),
      'anatomy',jsonb_build_object('passed',TRUE,'musclesJointsActionsPlanesLateralityContactsSequenceAndTrunkBoundary',TRUE),
      'difficulty',jsonb_build_object('passed',TRUE,'model','max_exercise_complexity_physical_difficulty','variantVectors',jsonb_build_array('26/18/26'),'participantClassificationAbsent',TRUE,'independentCalibrationRequired',TRUE),
      'loadFatigueRecovery',jsonb_build_object('passed',TRUE,'actualCyclesTensionRangeTimeUnderTensionFaultSymptomsAndOverlappingShoulderGripExposureTracked',TRUE,'impactNone',TRUE,'recoveryIsPlanningEstimate',TRUE),
      'constraints',jsonb_build_object('passed',TRUE,'standingBandConditionRecoilPathSymptomsRestrictionsSpaceTrafficScopeAndEmergencyRoute',TRUE),
      'delivery',jsonb_build_object('passed',TRUE,'profiles',2,'prepareAndResilience',TRUE,'durationDoseRestBandStationAndSubstitutionRevalidation',TRUE),
      'instructions',jsonb_build_object('passed',TRUE,'athleteCoachAccessibilityAndSupportOperations',TRUE,'baseBandElbowsWristsSymmetryTrunkReturnSymptomsAndClinicalScope',TRUE),
      'research',jsonb_build_object('passed',TRUE,'sections',16,'registryVersion',research_version,'exampleDoseNotUniversal',TRUE),
      'media',jsonb_build_object('passed',FALSE,'candidateCount',5,'currentOEmbedMetadataHealthy',TRUE,'playbackReviewed',FALSE,'exactVariantReviewed',FALSE,'captionsAccessibilityQualitySafetyAndApprovalReviewed',FALSE),
      'relationships',jsonb_build_object('passed',FALSE,'reviewOnly',4,'approved',0,'automaticSubstitution',FALSE),
      'calibration',jsonb_build_object('passed',FALSE,'reviewOnly',2,'approved',0),
      'alternates',jsonb_build_object('passed',TRUE,'assessments',26,'sameIdentity',3,'modifierAnnotations',9,'newVariants',8,'newDefinitions',6,'singleExactVariant',TRUE),
      'generationSupport',jsonb_build_object('passed',TRUE,'selectionConstraints',TRUE,'cumulativeFatigueAndImpactBudgets',TRUE,'duration',TRUE,'equipmentAndStation',TRUE,'substitutionRevalidation',TRUE,'renderingAndPersistence',TRUE),
      'publication',jsonb_build_object('passed',FALSE,'reviewer',NULL,'approver',NULL)),
    jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01','message','A qualified human must watch all five candidates in full and verify playback, exact standing unanchored-band setup, elbow position, grip, action, return count, range, captions, accessibility, cue quality, safety, conflicts, reviewer identity, timestamp, card version, and approval rationale.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','A qualified coach must approve or reject all four relationships; no automatic substitution to 90/90, face-pull, incomplete eccentric, or wall-slide tasks is authorized.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','An independent qualified reviewer must calibrate exercise complexity 26 and physical difficulty 18. Scores do not classify a participant or create an age or proficiency level.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','A qualified reviewer and separate approver must complete content review before publication. Identity, anatomy, loading, band condition and recoil risk, clinical scope, dose, stop, accessibility, persistence, and support rules remain quarantined.')),
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
        AND movement_patterns=ARRAY['brace','pull','rotate']::TEXT[]
        AND anatomy_json<>'{}'::JSONB AND environment_json<>'{}'::JSONB
        AND population_json<>'{}'::JSONB AND athlete_support_json<>'{}'::JSONB
        AND coach_support_json<>'{}'::JSONB AND support_operations_json<>'{}'::JSONB
        AND provenance_json->>'approvalsCreated'='false')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source_variant AND status='archived'
        AND requirements_json->>'representation'='superseded_source_skeleton')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=external_rotation_variant AND definition_id=canonical_definition AND status='review'
        AND requirements_json->>'selectable'='true'
        AND (difficulty_json->>'technicalComplexity')::INTEGER=26
        AND (difficulty_json->>'physicalDifficulty')::INTEGER=18
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=greatest(26,18)
        AND (load_profile_json->>'landingContactsPerRep')::INTEGER=0
        AND (fatigue_profile_json->>'impactAccumulation')::INTEGER=1
        AND programming_profile_json->>'publicationQuarantined'='true') THEN
    RAISE EXCEPTION '% definition variant or source quarantine assertion failed',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=external_rotation_variant AND status='review'
        AND cardinality(equipment_required)>0
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
        AND link_status='healthy' AND review_status='candidate' AND embedding_allowed
        AND captions_available IS NULL AND exact_variant_match IS NULL
        AND demonstration_quality_score IS NULL AND reviewer_user_id IS NULL
        AND reviewed_at IS NULL)<>5
    OR (SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id=canonical_definition AND reviewed_card_version=2
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>26
    OR (SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=external_rotation_variant OR to_variant_id=external_rotation_variant)
        AND review_status='review' AND reviewed_by IS NULL)<>4
    OR (SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=external_rotation_variant AND status='review' AND reviewed_by IS NULL)<>2
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=canonical_definition AND reviewed_by IS NULL)<>4
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=canonical_definition AND decision='distinct_exercises'
        AND reviewed_by IS NULL)<>3
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=canonical_definition AND decision='needs_human_review'
        AND resolved_definition_id=eccentric_definition AND reviewed_by IS NULL)<>1 THEN
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
      WHERE v.id=external_rotation_variant
        AND NOT EXISTS(SELECT 1 FROM coaching.equipment allowed WHERE allowed.key=key)) THEN
    RAISE EXCEPTION '% uncontrolled taxonomy was authored',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1 r
      CROSS JOIN LATERAL unnest(r.dimensions) dimension
      WHERE (r.from_variant_id=external_rotation_variant OR r.to_variant_id=external_rotation_variant)
        AND dimension<>ALL(ARRAY['load','leverage','range','speed','stability','complexity','impact','decision_demand','fatigue']))
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=external_rotation_variant OR to_variant_id=external_rotation_variant)
        AND review_status='approved') THEN
    RAISE EXCEPTION '% relationship dimension or approval assertion failed',migration_key;
  END IF;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=36
      AND skill_level IS NULL AND age_min IS NULL AND age_max IS NULL
      AND linked_skill_id IS NULL AND is_published=FALSE AND archived=FALSE
      AND programming_kind='exercise' AND why_publish_ready=FALSE)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1
      WHERE exercise_id=36 AND technical_complexity=26
        AND absolute_load_demand=18 AND base_overall_difficulty=26
        AND human_review_status='queued' AND reviewed_by IS NULL AND reviewed_at IS NULL)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=canonical_definition AND card_version=2
        AND status='quarantined' AND human_review_required=TRUE
        AND jsonb_array_length(blocking_issues_json)=4) THEN
    RAISE EXCEPTION '% legacy projection or packet assertion failed',migration_key;
  END IF;
END
$migration$;
