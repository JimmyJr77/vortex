-- Source 26: replace the skeletal Quadruped Spinal Circles baseline with one
-- exact fixed-contact global spinal-circle variant. Evidence, media, graph,
-- calibration, and publication remain candidate/review-only. This migration
-- creates no human approval and no exercise-card participant level.
DO $migration$
DECLARE
  migration_key CONSTANT TEXT := '497_coaching_quadruped_spinal_circles_family_audit_hardening';
  research_version CONSTANT TEXT := '2026-08-09.94';
  canonical_definition UUID;
  source_variant UUID;
  circle_variant UUID;
  active_variant_ids UUID[];
  all_owned_variant_ids UUID[];
  cat_cow_definition UUID;
  cat_cow_variant UUID;
  thread_definition UUID;
  thread_variant UUID;
  protected_count INTEGER;
BEGIN
  SELECT definition_id INTO canonical_definition FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=26;
  SELECT id INTO source_variant FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='baseline';
  SELECT id INTO circle_variant FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='fixed-contact-global-spinal-circle';
  circle_variant := coalesce(circle_variant,gen_random_uuid());
  SELECT definition_id INTO cat_cow_definition FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=25;
  SELECT id INTO cat_cow_variant FROM coaching.exercise_variant_v1 WHERE definition_id=cat_cow_definition AND variant_key='standard-coordinated-quadruped-cycle';
  SELECT definition_id INTO thread_definition FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=27;
  SELECT id INTO thread_variant FROM coaching.exercise_variant_v1 WHERE definition_id=thread_definition AND variant_key='quadruped-thread-and-open';
  active_variant_ids := ARRAY[circle_variant];
  all_owned_variant_ids := ARRAY[source_variant,circle_variant];

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=26 AND facility_id=1)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition AND facility_id=1 AND legacy_exercise_id=26)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=26 AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source_variant AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=cat_cow_variant AND definition_id=cat_cow_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=thread_variant AND definition_id=thread_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1 WHERE exercise_id=26)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_difficulty_profile WHERE exercise_id=26)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_safety_profile WHERE exercise_id=26) THEN
    RAISE EXCEPTION '% prerequisite source or neighbor rows are missing',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=circle_variant AND definition_id<>canonical_definition)
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE slug='quadruped-spinal-circles' AND id<>canonical_definition) THEN
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
        AND (reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL
          OR status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE (survivor_definition_id=canonical_definition
          OR resolved_definition_id=canonical_definition)
        AND (reviewed_by IS NOT NULL OR resolution_source='human_review')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_v1
      WHERE exercise_id=26
        AND (human_review_status<>'queued' OR reviewed_by IS NOT NULL
          OR reviewed_at IS NOT NULL)
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
        'sourceDisposition','canonical_fixed_contact_global_circle_reauthored',
        'representedBySelectableSourceVariant',FALSE,
        'sourceInterpretation','source 26 supplies the global circular phase idea but omits a counted checkpoint named direction fixed-contact boundary anatomy budgets logistics persistence support and human review contracts',
        'exactWorkingSpecification','fixed_contact_global_quadruped_spinal_circle',
        'researchSources',jsonb_build_array(
          'https://gmb.io/wp-content/uploads/2023/02/Joint-Mobility.pdf',
          'https://gmb.io/joint-mobility/',
          'https://napacenter.org/quadruped-exercises/',
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC7173996/',
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC10508241/'),
        'exerciseDifficultyDescribesTaskOnly',TRUE,
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=26 AND definition_id=canonical_definition;

  UPDATE coaching.exercise_delivery_profile_v1 SET status='archived',updated_at=now()
  WHERE variant_id=source_variant;
  UPDATE coaching.exercise_variant_v1 SET
    variant_key='identity-quarantine-source-26',
    display_name='Quadruped Spinal Circles Legacy Skeleton — Source 26',
    modifier_keys='{}'::TEXT[],difficulty_json='{}'::JSONB,status='archived',
    requirements_json=jsonb_build_object(
      'selectable',FALSE,'representation','superseded_source_skeleton',
      'sourceLegacyExerciseId',26,
      'archiveReason','counted checkpoint named direction fixed contacts anatomy dose budgets logistics persistence and support contracts were missing',
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
    canonical_definition,1,26,'quadruped-spinal-circles',
    'Quadruped Spinal Circles','Quadruped Spinal Circles',
    ARRAY['Quadruped Spine Circles','All-Fours Spinal Circles','Quadruped Back Circles'],
    'From a stable bilateral hands-and-knees base, begin neutral and move into a comfortable rounded checkpoint. Continue toward the named first side through lateral flexion or support shift, a comfortable arched checkpoint, the opposite side, and back to the same rounded checkpoint. That rounded-to-rounded path is one counted circle. Reverse by naming the opposite first side, keep both hands and knees planted, and return to neutral after the final repetition. Direction, range, pace, dose, rest, and optional mat are delivery settings. Limb lift, hover, locomotion, hand walking, external force, unstable support, or an isolated regional circle is a different task.',
    'quadruped_global_spinal_circle','2.0.0',2,'review',
    80,60,50,ARRAY['brace']::TEXT[],
    ARRAY['spine','thoracic_spine','neck','rib_cage','pelvis','core','scapula','shoulder','wrist','hand','elbow','hip','knee']::TEXT[],
    '{}'::TEXT[],ARRAY['mat_optional']::TEXT[],
    jsonb_build_object(
      'surface','flat dry stable nonslip floor that supports bilateral hands and knees and permits safe entry and exit',
      'space','one stationary quadruped station with head trunk elbow hip and foot clearance and no cross traffic',
      'stationCapacity',1,'optionalEquipmentKey','mat_optional',
      'matPolicy','optional stable cushioning may improve contact comfort but cannot conceal unstable or painful support',
      'coachSightline','front and side views sufficient to observe contacts rounded lateral arched and opposite-lateral checkpoints pelvic and scapular coupling breathing symptoms and direction',
      'inspection',jsonb_build_array('floor traction cleanliness and clutter','mat flatness and movement when used','hand and knee contact area','head trunk elbow hip and foot clearance','cross traffic','communication and emergency route','safe floor entry and exit'),
      'changeRule','Changing support base moving region required actions sequence external force direction dose symptoms surface or downstream loading requires full selection duration logistics substitution persistence and rendering revalidation.'),
    jsonb_build_object(
      'exerciseCardDoesNotClassifyParticipants',TRUE,'readinessIsWorkoutInput',TRUE,
      'selectionPrerequisites',jsonb_build_array('safe floor entry support and exit','comfortable controllable rounded lateral arched and opposite-lateral checkpoints','bilateral hand knee shoulder wrist and elbow support tolerance','understands named first side full circle count reverse direction and stop signal','no conflicting trauma symptom restriction or service-scope concern'),
      'excludeOrEscalate',jsonb_build_array('recent significant trauma or surgery without applicable clearance','severe progressive radiating or unfamiliar spinal pain','new numbness tingling weakness saddle sensory change or bowel or bladder change','dizziness faintness nausea visual change or loss of orientation with head movement','wrist hand elbow shoulder knee or floor-transfer symptoms that prevent exact support','known clinical restriction conflicting with multi-planar spinal motion or quadruped loading','participant requests stop or cannot communicate reliably'),
      'notEstablishedByEvidence',jsonb_build_array('universal eligibility','universal symptom treatment','injury prevention','structural correction','normal spinal range','required axial rotation','one correct circle shape breath phase dose frequency or recovery interval','readiness for later training')),
    jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'canonicalAuthoredFromResearch',TRUE,
      'primaryIdentitySource','https://gmb.io/wp-content/uploads/2023/02/Joint-Mobility.pdf',
      'legacySources',jsonb_build_array(26),
      'identityContract','fixed_bilateral_hand_and_knee_contacts_rounded_named_first_side_arched_opposite_side_return_to_rounded_both_directions',
      'researchSources',jsonb_build_array(
        'https://gmb.io/wp-content/uploads/2023/02/Joint-Mobility.pdf',
        'https://gmb.io/joint-mobility/',
        'https://napacenter.org/quadruped-exercises/',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC7173996/',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC10508241/'),
      'confidenceBySection',jsonb_build_object('identity',80,'taxonomy',78,'anatomy',68,'difficulty',60,'load',62,'fatigueRecovery',54,'constraints',78,'dosage',62,'instructions',78,'alternates',82,'media',50),
      'unresolvedClaims',jsonb_build_array('one universal circle shape axial rotation amount range breath phase dose frequency recovery or progression','injury prevention structural correction diagnosis treatment or readiness outcome','numeric difficulty calibration','media playback exact contacts phases range captions accessibility quality safety and approval'),
      'externalPlaybackVerificationPerformed',FALSE,'sourceLimitationsExplicit',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,'publicationQuarantined',TRUE),
    NULL,NULL,NULL,NULL,
    jsonb_build_object(
      'primaryMuscles',jsonb_build_array('rectus_abdominis','internal_oblique','external_oblique','erector_spinae','multifidus','quadratus_lumborum'),
      'secondaryMuscles',jsonb_build_array('deep_cervical_flexors','cervical_extensors','serratus_anterior','middle_trapezius','rhomboids','gluteus_maximus'),
      'stabilizers',jsonb_build_array('rotator_cuff','triceps_brachii','forearm_wrist_flexors_and_extensors','scapular_stabilizers','deep_trunk_stabilizers','hip_stabilizers','quadriceps'),
      'joints',jsonb_build_array('cervical_intervertebral_joints','thoracic_intervertebral_joints','lumbar_intervertebral_joints','lumbosacral_junction','sacroiliac_region','scapulothoracic_articulation','glenohumeral_joint','elbow_joint','radiocarpal_wrist','hip_joint','knee_joint'),
      'jointActions',jsonb_build_array('global_spinal_flexion','right_and_left_spinal_lateral_flexion','global_spinal_extension','posterior_and_anterior_pelvic_tilt','right_and_left_pelvic_shift_or_obliquity','coupled_scapular_protraction_retraction_and_weight_shift'),
      'planes',jsonb_build_array('sagittal','frontal','coupled_multi_planar_transition_without_separately_required_axial_rotation'),
      'laterality','bilateral fixed support; complete circles are recorded separately by named first side and reverse direction',
      'supportContacts',jsonb_build_array('left_hand','right_hand','left_knee_and_shin','right_knee_and_shin'),
      'contactRule','All four support contacts remain planted throughout every counted circle.',
      'phaseSequence',jsonb_build_array('neutral_setup','uncounted_move_to_rounded_checkpoint','named_first_side_lateral_checkpoint','arched_checkpoint','opposite_side_lateral_checkpoint','return_to_rounded_counted_checkpoint','reverse_direction','neutral_exit_after_final_circle'),
      'axialRotationBoundary','Coupled axial motion may occur naturally during a comfortable global circle but is not a separately required phase or prescribed range.',
      'evidenceBoundary','Sources support a slow comfortable quadruped spinal circle in both directions, not exact muscle force tissue loading normal range treatment effect or one universally correct shape.'),
    jsonb_build_object(
      'whyItMatters','Provides one reproducible low-load multi-planar spinal and pelvic movement task when the workout calls for a fixed-contact global circle rather than a sagittal or arm-driven rotation drill.',
      'primaryCue','Round comfortably, circle toward the named first side through an arch and the other side, return to the same rounded checkpoint, then reverse.',
      'expectedSensations',jsonb_build_array('light trunk and shoulder support effort','comfortable changing spinal and pelvic range','small controlled weight shifts across planted hands and knees'),
      'unexpectedSensations',jsonb_build_array('sharp increasing radiating or unfamiliar pain','numbness tingling weakness saddle sensory or bowel or bladder change','dizziness faintness nausea visual change or disorientation','painful hand wrist elbow shoulder knee or floor transfer','forced range breath holding or support loss'),
      'painGuidance','Stop, return to the safest stable position available, signal the coach, and follow facility escalation policy; never repeat to test symptoms or force the next checkpoint.',
      'selfChecks',jsonb_build_array('both hands and knees stay down','coach names the first side','rounded lateral arched opposite-lateral and rounded checkpoints remain recognizable','range stays comfortable and pace controlled','one return to rounded counts one circle','reverse direction is recorded separately','neutral exit occurs after the final repetition'),
      'accessibility',jsonb_build_array('front and side demonstration','written phase strip','athlete-left and athlete-right direction language','optional stable mat cushioning','smaller range fewer circles slower pace and rest','select a separately validated support-changing or non-floor task when needed'),
      'mediaAlternatives',jsonb_build_array('written checkpoint sequence','coach demonstration from front and side','still images for neutral rounded lateral and arched checkpoints','auditory named-side prompts'),
      'notReadinessOrClinicalClassification',TRUE),
    jsonb_build_object(
      'observationChecklist',jsonb_build_array('exact variant station and floor transfer','all four contacts','named first side and reverse direction','rounded lateral arched opposite-lateral and counted rounded checkpoints','spinal pelvic scapular and head coupling','range pace breathing symptoms and first fault','actual circles rest duration substitution and exit'),
      'faultCorrections',jsonb_build_object(
        'lost_contact','stop the repetition; re-establish the exact base and reduce range only if symptoms and budgets permit',
        'wrong_or_unclear_direction','return to the rounded checkpoint and use athlete-left or athlete-right language',
        'missed_checkpoint_or_line_path','reduce range and pace; do not count an incomplete or linear repetition',
        'forced_range_or_breath_holding','reduce range and restore comfortable breathing; stop if not corrected',
        'pain_neurologic_or_dizziness','stop and escalate per facility policy without diagnosis'),
      'demonstrationPlan','Show safe floor entry, neutral setup, uncounted rounded start, athlete-left-first complete circle, counted rounded return, athlete-right-first reversal, common contact or path fault, stop signal, and neutral exit.',
      'groupManagement',jsonb_build_array('one athlete per stationary floor station','maintain front and side sightlines','use named-side prompts rather than viewpoint-dependent clockwise language','keep cross traffic outside stations','record invalid partial symptom-limited and substituted work'),
      'modificationDecisionTree',jsonb_build_array('stop for pain neurologic symptoms dizziness or unsafe support','reduce range','reduce circles','slow pace','increase rest','add only optional stable mat cushioning','select a separately reviewed support-changing non-floor or different-action card'),
      'doNotUseWhen',jsonb_build_array('exact floor transfer or four-point support is unavailable','multi-planar spinal movement conflicts with symptoms restrictions or service scope','the workout purpose is sagittal Cat-Cow arm-driven thoracic rotation shoulder circles regional circles hover limb lift locomotion load or manual treatment'),
      'noDiagnosisTreatmentOrGuaranteedTransfer',TRUE),
    jsonb_build_object(
      'issueCategories',jsonb_build_array('identity variant direction or checkpoint mismatch','contact support or floor-transfer defect','pain neurologic dizziness or support incident','space mat traffic hygiene sightline or exit defect','dose duration fatigue or downstream-load mismatch','media instruction accessibility or rendering conflict','clinical scope or escalation error'),
      'supportEscalation',jsonb_build_object('urgent','stop stabilize and follow emergency policy for acute neurologic severe pain faintness or bowel or bladder concerns','clinical','route symptom diagnosis eligibility and return questions to qualified care per facility policy','content','quarantine conflicting identity anatomy cue dose media or graph records until qualified review'),
      'retentionPolicy','Persist definition variant named first side direction planned and actual complete circles range tempo optional mat valid invalid partial and symptom-limited attempts first fault contacts symptoms stop reason rest duration substitution floor entry and exit and library generator rendering versions under facility policy.',
      'changeImpactPolicy','Any support base moving region phase sequence direction rule dose stop media identity or symptom change invalidates cached selection duration logistics substitution persistence and coach and athlete rendering and requires full revalidation.',
      'feedbackChannels',jsonb_build_array('athlete comfort symptom support and clarity report','coach checkpoint first-fault dose and station report','support incident content and media-review queue'),
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
    movement_patterns=EXCLUDED.movement_patterns,
    body_regions=EXCLUDED.body_regions,
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
    circle_variant,canonical_definition,'fixed-contact-global-spinal-circle',
    'Quadruped Spinal Circles — Fixed-Contact Global Circle',
    ARRAY['fixed_contact','global_spinal_circle']::TEXT[],
    jsonb_build_object(
      'technicalComplexity',32,'exerciseComplexity',32,
      'absoluteLoadDemand',12,'physicalDifficulty',12,
      'coordinationDemand',32,'supervisionDemand',18,
      'failureConsequence',14,'impact',1,'workCapacityDemand',14,
      'baseOverallDifficulty',greatest(32,12),
      'overallFormula','max(exercise_complexity,physical_difficulty)',
      'technicalMeaning','exercise_complexity',
      'loadMeaning','physical_difficulty',
      'independentCalibrationRequired',TRUE,'approvalsCreated',FALSE),
    jsonb_build_object(
      'selectable',TRUE,'posture','quadruped',
      'support','bilateral_hands_and_knees_fixed_contact',
      'equipment',jsonb_build_array('none'),
      'optionalEquipment',jsonb_build_array('mat_optional'),
      'exactSequence',jsonb_build_array('rounded_checkpoint','named_first_side_lateral_checkpoint','arched_checkpoint','opposite_side_lateral_checkpoint','return_to_rounded_checkpoint'),
      'directionRule','complete_and_record_both_named_first_side_directions',
      'countingRule','one rounded_checkpoint_to_same_rounded_checkpoint_circle',
      'neutralRule','neutral_setup_and_neutral_exit_after_final_circle_are_not_counted_repetitions',
      'axialRotationRule','coupled_motion_may_occur_but_is_not_a_separately_required_phase',
      'validCompletion','all_four_contacts_remain_planted_all_checkpoints_are_observable_range_is_comfortable_path_is_controlled_return_to_rounded_is_complete_and_no_stop_rule_occurs',
      'invalidCompletion',jsonb_build_array('hand_or_knee_contact_lost','linear_or_incomplete_path','named_direction_not_followed','rounded_or_arched_or_lateral_checkpoint_missing','forced_range','uncontrolled_support_shift','breath_hold','symptom_stop'),
      'clinicalAssessmentOrTreatment',FALSE,'humanReviewRequired',TRUE),
    'review',
    jsonb_build_object(
      'loadingType','bodyweight_closed_chain_quadruped_multi_planar_spinal_motion',
      'externalLoadMethod','bodyweight_only_with_fixed_hand_and_knee_support',
      'gripDemand',4,'jointStress',12,'spinalLoading',8,'eccentricStress',6,
      'landingContactsPerRep',0,'handImpactContactsPerRep',0,'impactClass','none',
      'primaryExposure',jsonb_build_array('hand_wrist_elbow_shoulder_and_scapular_support','knee_and_shin_contact','active_global_spinal_range','pelvic_tilt_and_lateral_shift','controlled_support_weight_shift'),
      'tracking',jsonb_build_array('variant','named_first_side','direction','complete_circles','range','tempo','optional_mat','contacts','symptoms','duration','same_session_quadruped_and_spinal_loading')),
    jsonb_build_object(
      'localMuscleFatigue',12,'gripFatigue',4,
      'technicalFatigueSensitivity',32,'impactAccumulation',1,
      'recoveryHours',2,
      'primaryFatigueSites',jsonb_build_array('trunk_musculature','shoulder_and_scapular_support','wrist_and_hand_support','knee_contact','attention_and_direction_control'),
      'cumulativeBudget',jsonb_build_object('totalCircles',20,'circlesPerDirection',10,'quadrupedSupportSeconds',420,'activeSpinalRangeSeconds',300,'technicalSensitivity',32,'impact',1),
      'interference',jsonb_build_array('later_high_priority_wrist_or_shoulders_support','same_session_spinal_end_range_or_loading','fatigue_that_changes_support_or_circle_path'),
      'recoveryIsPlanningEstimate',TRUE),
    jsonb_build_object(
      'trainingStimuli',jsonb_build_array('low_load_multi_planar_spinal_and_pelvic_control','quadruped_support_control','directional_body_awareness'),
      'stimulusDose',jsonb_build_object('sets',jsonb_build_array(1,2),'completeCirclesPerDirection',jsonb_build_array(2,5),'secondsPerCircle',jsonb_build_array(6,18),'restSeconds',jsonb_build_array(0,60)),
      'weeklyExposure',jsonb_build_object('minimum',0,'maximumWithoutReview',7,'unit','sessions','contextDependent',TRUE),
      'prerequisites',jsonb_build_array('safe_floor_entry_four_point_support_and_exit','comfortable_controllable_multi_planar_spinal_range','understands_named_first_side_count_and_reverse','can_report_symptoms_and_stop','same_session_budgets_fit'),
      'completionCriteria',jsonb_build_array('four_contacts_planted','all_checkpoints_observed','both_directions_recorded','comfortable_range','controlled_pace','rounded_checkpoint_return','no_stop_symptoms'),
      'sequenceRules',jsonb_build_array('prepare_or_restore_context_only','do_not_add_axial_rotation_as_a_separate_phase','do_not_convert_direction_or_range_annotations_into_hidden_variants','revalidate_downstream_support_and_spinal_loading'),
      'pairingCompatibility',jsonb_build_object('compatible',jsonb_build_array('low_load_breathing','light locomotion_when_support_budgets_fit'),'avoid',jsonb_build_array('fatiguing_wrist_or_shoulders_support','symptom_provoking_spinal_end_range','time_critical_output_when_the_drill_displaces_priority_work')),
      'interferenceRules',jsonb_build_array('count_all_overlapping_quadruped_support','count_all_overlapping_active_spinal_range','stop_before_path_or_contact_quality_changes'),
      'uncertaintyPolicy','When exact support phase path direction symptoms or available time is uncertain do not select; request clarification or choose a separately validated card.',
      'selectionStatus','review_only_machine_complete',
      'publicationQuarantined',TRUE,
      'exerciseDifficultyDescribesTaskOnly',TRUE,'approvalsCreated',FALSE)
  )
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
  SELECT p.id,circle_variant,p.profile_key,p.phase_key,p.role,
    CASE p.phase_key WHEN 'prepare_and_access' THEN
      'Use the exact fixed-contact global spinal circle for low-load multi-planar access and control before later work only when support and downstream budgets fit.'
    ELSE
      'Use the exact fixed-contact global spinal circle at a low controlled dose to restore movement options without displacing symptom management or recovery.' END,
    CASE p.phase_key WHEN 'prepare_and_access' THEN 88 ELSE 80 END,
    CASE p.phase_key WHEN 'prepare_and_access' THEN 84 ELSE 74 END,
    jsonb_build_object('mobility',94,'movement_control',88,'quadruped_support',70,'recovery',CASE WHEN p.phase_key='restore' THEN 84 ELSE 58 END),
    jsonb_build_object('sets',jsonb_build_array(1,2),'completeCirclesPerDirection',jsonb_build_array(2,5),'secondsPerCircle',jsonb_build_array(6,18),'restSeconds',jsonb_build_array(0,60),'bothDirectionsRequired',TRUE,'exampleDoseIsNotUniversal',TRUE),
    'Both hands and knees remain planted; rounded named-side arched opposite-side and counted rounded checkpoints remain observable; both directions use comfortable range and controlled pace; no forced range breath hold symptom or unsupported motion occurs.',
    ARRAY[
      'Sharp, increasing, radiating, or unfamiliar spinal or joint pain, guarding, or participant stop request.',
      'Numbness, tingling, weakness, saddle sensory change, bowel or bladder change, or another new neurologic sign.',
      'Dizziness, faintness, nausea, visual change, disorientation, or inability to communicate clearly.',
      'Hand, wrist, elbow, shoulder, knee, shin, or floor-transfer symptoms prevent stable exact support.',
      'A hand or knee lifts, support collapses, or the rounded lateral arched opposite-lateral path cannot be restored by reducing range or pace.',
      'Forced range, breath holding, viewpoint-dependent direction confusion, added axial-rotation phase, locomotion, hover, limb lift, external force, or wrong task cannot be corrected safely.',
      'Floor, mat, space, traffic, hygiene, sightline, communication, entry, or exit becomes unsafe.',
      'The planned circle, direction, support-time, active-range, technical-fatigue, duration, or downstream exposure budget is reached.',
      'The task would become Cat-Cow, Thread-the-Needle, shoulder or regional circles, a hand-walk flow, non-floor base, hover, loaded, unstable, manual, assisted, or clinical exercise identity.'
    ]::TEXT[],
    'Verify the exact variant, floor entry and exit, optional mat, hand wrist elbow shoulder and knee tolerance, current symptoms and restrictions, named first side, planned circles per direction, actual support time, and downstream support and spinal loading. Demonstrate front and side; count only a complete rounded-side-arched-opposite-side-rounded circle; observe all four contacts, phase path, pelvic and scapular coupling, range, pace, breathing, symptoms, first fault, and duration. Do not force range, prescribe a separate axial-rotation phase, diagnose, or treat.',
    'From hands and knees, circle from round toward the named side, through an arch and the other side, back to round, then reverse. Keep all four contacts down. Stop for pain, tingling, weakness, dizziness, or lost support.',
    'More consistent low-load multi-planar spinal and pelvic control in the exact fixed-contact quadruped task; no treatment, structural, readiness, injury-prevention, or performance outcome is guaranteed.',
    ARRAY['none']::TEXT[],
    jsonb_build_object('stationCapacity',1,'base','bilateral_hands_and_knees_fixed_contact','optionalEquipment','mat_optional','floorEntryAndExitRequired',TRUE,'space','stationary_one_person_quadruped_clearance','setupSeconds',25,'directionChangeSeconds',5,'coachSightline','front_and_side','crossTrafficProhibited',TRUE,'surfaceAndMatInspectionRequired',TRUE,'hygieneResetRequired',TRUE,'revalidateAfterAnyChange',TRUE),
    ARRAY[cat_cow_variant,thread_variant]::UUID[],
    'review',
    jsonb_build_object('durationFormula','setup_seconds + sum(actual_complete_circles * actual_seconds_per_circle) + direction_change_seconds + rest_seconds + invalid_or_partial_attempt_seconds + symptom_response_seconds + substitution_seconds + floor_exit_seconds','secondsPerCircle',jsonb_build_array(6,18),'minimumSeconds',55,'typicalSeconds',120,'maximumSecondsWithoutReview',360,'includeActualNotPlanned',TRUE,'recomputeAfterSubstitution',TRUE),
    jsonb_build_object('regressionOrder',jsonb_build_array('reduce_range','reduce_to_two_complete_circles_per_direction','slow_pace','increase_rest','add_optional_stable_mat_cushioning','stop_and_select_a_separately_validated_task_after_full_revalidation'),'progressionOrder',jsonb_build_array('complete_clean_circles_in_both_directions','increase_to_three_through_five_per_direction_within_profile','enlarge_range_only_if_comfortable_and_contacts_remain_fixed','select_a_distinct_or_support_changing_task_only_after_full_revalidation'),'neverScaleByForcingRangeAddingSpeedOrIgnoringSymptoms',TRUE),
    jsonb_build_object('record',jsonb_build_array('definition_and_variant','named_first_side_and_direction','planned_and_actual_complete_circles_per_direction','range_tempo_rest_and_optional_mat','valid_invalid_partial_and_symptom_limited_attempts','all_four_contacts','first_fault','symptoms_and_stop_reason','quadruped_support_time','active_spinal_range_time','duration','substitution','floor_entry_and_exit'),'validUnit','one_complete_rounded_named_side_arched_opposite_side_rounded_circle_with_all_four_contacts','individual_checkpoints_or_partial_paths_do_not_count',TRUE),
    jsonb_build_object('athlete',jsonb_build_array('four_point_support','named_first_side','rounded_side_arched_other_side_rounded_path','comfortable_range','both_directions','warning_symptom_stop'),'coach',jsonb_build_array('floor_entry_and_exit','support_tolerance','direction_and_count','spinal_pelvic_scapular_and_head_observation','first_fault','clinical_scope','logging_and_escalation'),'accessibility',jsonb_build_array('front_and_side_demonstration','written_and_visual_checkpoint_sequence','athlete_left_and_right_cues','optional_mat_cushioning','smaller_range_fewer_circles_slower_pace_and_rest','separately_validated_support_changing_or_non_floor_alternative'))
  FROM (VALUES
    ('f7a66dd2-33d2-4eb8-9653-5ac2a252c6ef'::UUID,'prepare-fixed-contact-spinal-circles','prepare_and_access','primary'),
    ('287f8220-c90e-4518-8baa-dbaef612ded7'::UUID,'restore-fixed-contact-spinal-circles','restore','primary')
  ) p(id,profile_key,phase_key,role)
  ON CONFLICT(id) DO UPDATE SET
    variant_id=EXCLUDED.variant_id,profile_key=EXCLUDED.profile_key,
    phase_key=EXCLUDED.phase_key,role=EXCLUDED.role,
    purpose=EXCLUDED.purpose,phase_suitability=EXCLUDED.phase_suitability,
    methodology_alignment=EXCLUDED.methodology_alignment,
    objective_relevance_json=EXCLUDED.objective_relevance_json,
    dosage_json=EXCLUDED.dosage_json,quality_gate=EXCLUDED.quality_gate,
    stop_rules=EXCLUDED.stop_rules,
    coach_instructions=EXCLUDED.coach_instructions,
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
  VALUES(
    1,canonical_definition,thread_definition,'distinct_exercises',
    'Quadruped Spinal Circles keeps both hands and knees planted and moves the global spine and pelvis through rounded lateral arched and opposite-lateral checkpoints. Thread-the-Needle changes one upper-limb contact and uses arm-driven thoracic rotation with a different endpoint and repetition count.',
    jsonb_build_object('migration',migration_key,
      'identityBoundary','fixed_contact_global_spinal_circle_vs_arm_driven_quadruped_thoracic_rotation',
      'leftContract','four_fixed_contacts_global_spine_and_pelvis_circle_both_directions',
      'rightContract','one_arm_threads_or_opens_with_thoracic_rotation_and_changed_hand_contact',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'deterministic_identity_equivalence',NULL,now())
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,
    reviewed_by=NULL,resolved_at=now();

  INSERT INTO coaching.exercise_section_evidence_v1(
    definition_id,reviewed_card_version,section_key,source_url,source_title,
    source_publisher,source_kind,claims_json,evidence_quality,review_status,
    reviewer_user_id,reviewed_at)
  SELECT canonical_definition,2,e.section_key,e.source_url,e.source_title,e.publisher,
    e.source_kind,jsonb_build_array(
      jsonb_build_object('supported',e.supported_claim,'scope',e.scope),
      jsonb_build_object('limitation',e.limitation,
        'noUniversalShapeAxialRotationRangeTechniqueSafetyEligibilityDoseRecoveryOutcomeOrDifficultyClaim',TRUE)),
    e.quality,'candidate',NULL,NULL
  FROM (VALUES
    ('identity','https://gmb.io/wp-content/uploads/2023/02/Joint-Mobility.pdf','Daily Diagnostic Joint Mobility Routine','GMB Fitness','expert_instruction','GMB directly names Quadruped Spinal Circles and describes a hands-and-knees circle through rounded lateral arched and opposite-lateral positions before reversing.','direct exact-task identity and instruction','GMB does not define the Vortex counted checkpoint fixed-contact invalidation or adjudicate every adjacent card.',78),
    ('taxonomy','https://gmb.io/wp-content/uploads/2023/02/Joint-Mobility.pdf','Daily Diagnostic Joint Mobility Routine','GMB Fitness','expert_instruction','The observable task is bilateral closed-chain quadruped global spinal and pelvic motion across sagittal and frontal planes with coupled multi-planar transitions.','direct movement context','GMB does not create Vortex controlled keys or require a separately scored axial-rotation phase.',78),
    ('anatomy','https://gmb.io/wp-content/uploads/2023/02/Joint-Mobility.pdf','Daily Diagnostic Joint Mobility Routine','GMB Fitness','expert_instruction','Hands and knees support the task while the spine and pelvis move through rounded lateral arched and opposite-lateral positions with coupled shoulder and scapular support.','direct support and observable action context','The source does not quantify muscle force isolate vertebral levels or prescribe one universal pelvic scapular or head path.',78),
    ('biomechanics','https://pmc.ncbi.nlm.nih.gov/articles/PMC7173996/','Exercise prescription for the thoracic spine in sport: a systematic review and narrative synthesis','British Journal of Sports Medicine / BMJ Open Sport & Exercise Medicine','peer_reviewed_research','Thoracic exercise can be classified by movement plane and task intent which supports explicit plane and action boundaries instead of treating all spinal mobility drills as interchangeable.','adjacent spinal exercise classification context','The review does not study this exact circle establish optimal dose require axial rotation or validate normal range safety or outcomes.',86),
    ('difficulty','https://gmb.io/wp-content/uploads/2023/02/Joint-Mobility.pdf','Daily Diagnostic Joint Mobility Routine','GMB Fitness','expert_instruction','Four declared checkpoints continuous multi-planar control fixed contacts direction reversal and counting support nonzero exercise complexity despite low external load.','direct task coordination context','GMB assigns no Vortex score and does not classify participants or compare difficulty with adjacent tasks.',78),
    ('load_fatigue_recovery','https://gmb.io/wp-content/uploads/2023/02/Joint-Mobility.pdf','Daily Diagnostic Joint Mobility Routine','GMB Fitness','expert_instruction','The drill requires no external implement and uses bilateral hand-and-knee support while the spine and pelvis move under body-segment mass.','direct support and external-load context','The source does not quantify wrist shoulder knee or spinal tissue load fatigue cumulative limits or recovery.',78),
    ('constraints','https://pmc.ncbi.nlm.nih.gov/articles/PMC10508241/','Interventions for the Management of Acute and Chronic Low Back Pain: Revision 2021','Journal of Orthopaedic & Sports Physical Therapy / Academy of Orthopaedic Physical Therapy','professional_standard','The guideline supports individualized exercise and movement-control or trunk-mobility interventions for appropriate presentations while emphasizing patient-centered assessment and red-flag screening.','clinical exercise scope and selection context','The guideline is not a spinal-circle prescription and does not authorize exercise staff to diagnose treat or clear participants.',96),
    ('dosage','https://gmb.io/wp-content/uploads/2023/02/Joint-Mobility.pdf','Daily Diagnostic Joint Mobility Routine','GMB Fitness','expert_instruction','GMB gives two sets of five circles in each direction as one routine example and advises small slow circles enlarged only comfortably.','one expert programming example','The example is not a universal dose frequency recovery eligibility or outcome rule.',78),
    ('instructions','https://gmb.io/wp-content/uploads/2023/02/Joint-Mobility.pdf','Daily Diagnostic Joint Mobility Routine','GMB Fitness','expert_instruction','GMB supports wrists under shoulders knees under hips neutral setup core organization slow comfortable circles and both directions.','direct exact-task instruction','The source does not define the Vortex rounded-to-rounded count named-side language fixed-contact invalidation or every stop rule.',78),
    ('safety_stop_rules','https://pmc.ncbi.nlm.nih.gov/articles/PMC10508241/','Interventions for the Management of Acute and Chronic Low Back Pain: Revision 2021','Journal of Orthopaedic & Sports Physical Therapy / Academy of Orthopaedic Physical Therapy','professional_standard','Best-practice guidance includes screening for red-flag conditions and neurologic deficits before or during exercise management.','clinical warning and referral context','It does not prove this drill safe for a specific participant or replace facility emergency and clinical policy.',96),
    ('programming','https://gmb.io/joint-mobility/','Joint Mobility Exercises for Health, Function, and Workout Preparation','GMB Fitness','expert_instruction','GMB presents Quadruped Spinal Circles separately from Cat-Cow and other quadruped drills in a low-intensity daily joint-mobility or workout-preparation context.','direct contextual programming and identity boundary','The article does not establish phase exclusivity sport transfer prevention universal dose or cumulative budgets.',80),
    ('athlete_support','https://gmb.io/wp-content/uploads/2023/02/Joint-Mobility.pdf','Daily Diagnostic Joint Mobility Routine','GMB Fitness','expert_instruction','The direct setup slow small-circle instruction comfortable enlargement and direction reversal can be translated into concise participant cues and self-checks.','plain-language participant support','The source does not establish universal sensation meaning accessibility symptom treatment or readiness.',78),
    ('coach_support','https://pmc.ncbi.nlm.nih.gov/articles/PMC10508241/','Interventions for the Management of Acute and Chronic Low Back Pain: Revision 2021','Journal of Orthopaedic & Sports Physical Therapy / Academy of Orthopaedic Physical Therapy','professional_standard','Clinical guidance supports individualized exercise and monitoring rather than universal assignment and preserves red-flag and neurologic escalation responsibilities.','coach observation and scope boundary','The guideline does not prescribe group layout cues circle counting direction language progression or floor-transfer management.',96),
    ('accessibility','https://napacenter.org/quadruped-exercises/','8 Quadruped Exercises by a Pediatric Physical Therapist','NAPA Center','expert_instruction','NAPA describes hand-and-knee weight bearing and examples where bolster assistance limb lifts and unstable surfaces materially change quadruped support and task demand.','quadruped support and modification boundary context','The article does not study exact spinal circles prove universal access or approve a specific support modification.',74),
    ('alternates','https://napacenter.org/quadruped-exercises/','8 Quadruped Exercises by a Pediatric Physical Therapist','NAPA Center','expert_instruction','Quadruped tasks with different support assistance limb actions surfaces or goals require explicit separation rather than silent substitution.','alternate identity and support boundary context','The source does not adjudicate all twenty Vortex alternates or approve any graph edge.',74),
    ('media','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en','Embed videos and playlists','YouTube Help','manufacturer_instruction','Five exact-title candidates returned current YouTube oEmbed title channel thumbnail and iframe metadata on 2026-08-09.','candidate metadata and privacy-enhanced embed format only','oEmbed does not prove playback exact contacts checkpoints path range captions accessibility cue quality safety conflicts reviewer identity card-version match or approval.',82)
  ) e(section_key,source_url,source_title,publisher,source_kind,supported_claim,scope,limitation,quality)
  ON CONFLICT(definition_id,reviewed_card_version,section_key,source_url) DO UPDATE SET
    source_title=EXCLUDED.source_title,
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
    'healthy','candidate','manual_research',
    'exact-title candidate checked by YouTube oEmbed',NULL,NULL,
    '2026-11-09'::TIMESTAMPTZ,
    'Current YouTube oEmbed metadata only. Playback and exact support contacts checkpoints path direction range breathing captions accessibility cue quality safety conflicts reviewer identity card-version match and approval remain unverified.'
  FROM (VALUES
    ('F8tiHAb_WQI','Quadruped Spine Circles','ZOAR Fitness'),
    ('LywxamPqa9k','Quadruped Spine Circles','Matt Gray'),
    ('b4fwyPYXFkY','Quadruped Spinal Circles','Functional Strength Training Centre'),
    ('u2HkVRxxioA','Quadruped Spine Circle','LL Calisthenics Coaching'),
    ('vdgvP8CqwRw','Quadruped Spine Circles','Nunn Performance')
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
      'neverInferFromNameOrParticipantRanking',TRUE),
    jsonb_build_object('status',a.proposed_status,
      'classificationCandidate',a.classification,
      'humanIdentityContentAndSafetyReviewRequired',TRUE,
      'approvalsCreated',FALSE),
    'candidate',NULL,NULL
  FROM (VALUES
    ('Quadruped Spine Circles or All-Fours Spinal Circles','same_identity','Common aliases retain the exact fixed-contact rounded-side-arched-opposite-side circle and counted checkpoint.','direct_alias',jsonb_build_array('fixed_contacts','global_circle','checkpoints','count'),'research_queue'),
    ('Fixed-Contact Global Quadruped Spinal Circle','same_identity','This is the single authored exact variant when global motion contacts checkpoints and both directions remain exact.','authored_exact_variant',jsonb_build_array('four_contacts','global_spine_and_pelvis','both_directions'),'authored_variant'),
    ('First Side Reverse Direction or Clockwise Label','modifier_annotation','Direction order changes delivery; viewpoint-dependent clockwise language must resolve to athlete left or right.','direction_annotation',jsonb_build_array('named_first_side','reverse_direction'),'delivery_annotation'),
    ('Small or Comfortably Larger Spinal Circles','modifier_annotation','Range remains a dose setting when all checkpoints contacts and the global path remain intended and observable.','range_annotation',jsonb_build_array('range','checkpoints','contacts'),'delivery_annotation'),
    ('Spinal Circle Tempo Repetitions Sets and Rest','modifier_annotation','Pace and volume change dose rather than movement identity.','dose_annotation',jsonb_build_array('tempo','circles','sets','rest'),'delivery_annotation'),
    ('Quadruped Spinal Circles on Optional Mat','modifier_annotation','Stable cushioning changes contact comfort without changing support base or counted task.','mat_annotation',jsonb_build_array('stable_mat','same_support'),'delivery_annotation'),
    ('Cat-Cow','new_definition','Cat-Cow is a sagittal flexion-extension cycle without required lateral checkpoints or a circular path.','cat_cow_distinct',jsonb_build_array('sagittal_cycle','neutral_return'),'existing_distinct_definition'),
    ('Quadruped Thread-the-Needle','new_definition','Thread-the-Needle changes one hand contact and uses arm-driven thoracic rotation.','thread_distinct',jsonb_build_array('arm_driven_rotation','changed_hand_contact'),'existing_distinct_definition'),
    ('Quadruped Shoulder Circles','new_definition','Shoulder and scapular circles use a different moving region and repetition boundary.','shoulder_distinct',jsonb_build_array('shoulder','scapula','spine_organized'),'existing_distinct_definition'),
    ('Full-Body Joint CARs Flow','new_definition','The standing multi-region flow changes support sequence sides duration and completion.','full_body_flow_distinct',jsonb_build_array('standing','multi_region','ordered_flow'),'existing_distinct_definition'),
    ('Quadruped Tail Wag or Side-Bending Only','new_definition','A lateral-only shift omits rounded and arched checkpoints and the circular path.','lateral_only_distinct',jsonb_build_array('lateral_only','missing_flexion_extension'),'research_queue'),
    ('Quadruped Pelvic or Hip Circles','new_definition','A pelvis- or hip-dominant task that organizes most of the spine changes the moving region and completion rule.','pelvis_hip_distinct',jsonb_build_array('pelvis_or_hip_dominant','spine_organized'),'research_queue'),
    ('Quadruped Lumbar CARs','new_definition','An intentionally lumbar-only circle changes moving region stabilization boundary risk interpretation and completion.','lumbar_only_distinct',jsonb_build_array('lumbar_only','regional_stabilization'),'research_queue'),
    ('Quadruped Spinal Wave Circles','new_variant','Mandatory segment-by-segment wave sequencing may preserve global checkpoints but changes the coordination contract and requires exact authorship.','segmental_wave_variant',jsonb_build_array('ordered_segmental_sequence','same_global_checkpoints'),'needs_human_review'),
    ('Hand-Walk Quadruped Global Spinal CARs','new_definition','Walking the hands to lateral positions adds locomotion changing contacts reach space and counting.','hand_walk_distinct',jsonb_build_array('hand_walk','changing_contacts','locomotion'),'research_queue'),
    ('Neutral-Wrist or Elevated-Hand Spinal Circles','new_variant','Fists handles wedges bench or box change interface trunk angle loading equipment and exit.','support_variant_quarantine',jsonb_build_array('hand_interface','support_height','equipment','exit'),'needs_human_review'),
    ('Hover or Bear-Position Spinal Circles','new_definition','Lifting the knees creates a higher-load hover with different fatigue balance support and failure.','hover_distinct',jsonb_build_array('knees_hovering','higher_load'),'research_queue'),
    ('Bird-Dog or Limb-Lift Spinal Circles','new_definition','Removing a hand or knee contact adds balance anti-rotation laterality and limb action.','limb_lift_distinct',jsonb_build_array('three_point_or_two_point','limb_lift'),'research_queue'),
    ('Seated Standing or Supine Spinal Circles','new_definition','A non-quadruped base changes support loading pelvic freedom balance transfer and checkpoints.','non_quadruped_distinct',jsonb_build_array('base','support','loading','transfer'),'research_queue'),
    ('Loaded Banded Partner-Resisted Manual-Assisted or Unstable-Surface Spinal Circles','new_definition','External force partner contact consent unstable support loading and clinical scope create a different task.','external_force_or_instability_distinct',jsonb_build_array('external_force','instability','consent','scope'),'research_queue')
  ) a(name,classification,rationale,boundary_key,facts,proposed_status)
  ON CONFLICT(definition_id,reviewed_card_version,alternate_name) DO UPDATE SET
    classification=EXCLUDED.classification,rationale=EXCLUDED.rationale,
    distinguishing_dimensions=EXCLUDED.distinguishing_dimensions,
    proposed_card_json=EXCLUDED.proposed_card_json,
    review_status='candidate',reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_relationship_v1(
    from_variant_id,to_variant_id,relationship,similarity_score,dimensions,reason,
    conditions_json,review_status,created_by,reviewed_by,reviewed_at)
  SELECT r.from_id,r.to_id,r.relationship,r.score,r.dimensions,r.reason,
    jsonb_build_object('migration',migration_key,'reviewOnly',TRUE,
      'automaticSubstitution',FALSE,
      'revalidate',jsonb_build_array('identity','movement purpose','support contacts','actions and planes','spinal range and symptoms','direction and dose','fatigue and same-session support or spinal loading','duration','logistics','persistence','coach rendering','athlete rendering'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'review',NULL,NULL,NULL
  FROM (VALUES
    (cat_cow_variant,circle_variant,'progression',66,ARRAY['range','complexity','decision_demand']::TEXT[],'Adds bilateral lateral checkpoints direction reversal and a continuous global circle to the sagittal Cat-Cow support task; it is not automatic.'),
    (circle_variant,cat_cow_variant,'regression',66,ARRAY['range','complexity','decision_demand']::TEXT[],'Removes lateral checkpoints and direction reversal to use the distinct sagittal Cat-Cow cycle only when that changed purpose is acceptable.'),
    (circle_variant,thread_variant,'lateral_substitution',54,ARRAY['range','stability','complexity']::TEXT[],'Thread-the-Needle changes to arm-driven thoracic rotation and one changing hand contact; substitute only when the workout purpose is explicitly changed and fully revalidated.'),
    (thread_variant,circle_variant,'lateral_substitution',54,ARRAY['range','stability','complexity']::TEXT[],'The spinal circle restores four fixed contacts and global flexion lateral flexion and extension checkpoints; substitute only after complete purpose support and dose revalidation.')
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
  SELECT 1,circle_variant,d.dimension,
    CASE d.dimension WHEN 'technicalComplexity' THEN 32 ELSE 12 END,
    20,
    CASE d.dimension WHEN 'technicalComplexity' THEN
      'Review-only exercise-complexity anchor based on four-checkpoint multi-planar coordination fixed-contact support named direction reversal and rounded-to-rounded counting.'
    ELSE
      'Review-only physical-difficulty anchor based on low external load with sustained hand wrist elbow shoulder knee and shin support controlled weight shift and active spinal range.'
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
    name='Quadruped Spinal Circles',slug='quadruped-spinal-circles',
    description='From hands and knees, begin neutral and move into a comfortable rounded checkpoint. Circle toward the named first side through a lateral checkpoint, a comfortable arch, the opposite side, and back to the same rounded checkpoint. Reverse direction, keep both hands and knees planted, and exit to neutral after the final circle.',
    instructions='Use the exact fixed-contact canonical variant. Set both hands under the shoulders and knees under the hips, establish a neutral start, then move into a comfortable round shape. Circle toward the coach-named first side, through a comfortable arch and the opposite side, and return to the same round shape to count one repetition. Complete the prescribed circles in both directions, then return to neutral. Keep all four contacts down, move slowly, and reduce range rather than forcing. Stop for pain, radiating symptoms, numbness, tingling, weakness, saddle sensory or bowel or bladder change, dizziness, faintness, nausea, visual change, support loss, or participant request.',
    skill_level=NULL,age_min=NULL,age_max=NULL,
    default_sets=1,default_reps=5,default_work_seconds=45,
    default_rest_seconds=30,
    tempo='slow continuous six to eighteen seconds per complete circle',
    load_note='Track actual complete circles per named direction, range, pace, optional mat, four-point support time, active spinal-range time, symptoms, invalid or partial attempts, rest, duration, and same-session quadruped or spinal loading.',
    est_seconds_per_set=120,is_published=FALSE,archived=FALSE,
    card_summary='Fixed-contact quadruped global spinal and pelvic circle through rounded lateral arched opposite-lateral and counted rounded checkpoints.',
    coach_language='Verify the exact fixed-contact variant, floor entry and exit, optional mat, support tolerance, restrictions and symptoms, named first side, planned circles per direction, downstream budgets, all four contacts, phase checkpoints, pelvic and scapular coupling, first fault, actual duration, stop response, persistence, and clinical scope.',
    athlete_language='Circle from round toward the named side, through an arch and the other side, back to round, then reverse. Keep hands and knees down and stop for pain, tingling, weakness, dizziness, or lost support.',
    programming_logic=jsonb_build_object(
      'selectionStatus','canonical_variant_required','selectable',TRUE,
      'canonicalDefinitionId',canonical_definition,
      'exactVariantIds',to_jsonb(active_variant_ids),
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'exerciseDifficultyDescribesTaskOnly',TRUE,
      'selectionInputs',jsonb_build_array('workout purpose','floor transfer and four-point support','spinal motion restrictions and symptoms','named direction comprehension','circle dose and duration','cumulative quadruped support and spinal range','same-session wrist shoulder knee and spinal loading','coach scope and sightline'),
      'substitutionRevalidation',jsonb_build_array('identity','support contacts','actions and planes','restrictions and symptoms','purpose','dose','fatigue and impact budgets','duration','logistics','persistence','coach rendering','athlete rendering'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    scalable_variables=ARRAY['complete_circles_per_direction','range','tempo','rest_seconds','sets','optional_mat']::TEXT[],
    movement_family='Quadruped Global Spinal Circle',
    primary_phase_key=NULL,phase_subrole=NULL,primary_order_slot=NULL,
    movement_requirements=jsonb_build_object(
      'selectable',TRUE,'canonicalVariantRequired',TRUE,
      'impactLevel',0,'balanceDemand','stable_base',
      'breathingDemand','comfortable_no_breath_hold',
      'actions',jsonb_build_array('global_spinal_flexion','bilateral_lateral_flexion','global_spinal_extension','pelvic_tilt_and_lateral_shift','coupled_scapular_support_motion'),
      'planes',jsonb_build_array('sagittal','frontal','coupled_multiplanar_transition'),
      'mustMaintain',jsonb_build_array('four_fixed_contacts','named_direction','rounded_side_arched_other_side_rounded_path','comfortable_range','controlled_pace','communication'),
      'mustNotAdd',jsonb_build_array('separately_required_axial_rotation','locomotion','hand_walk','hover','limb_lift','external_force','unstable_surface','forced_range'),
      'validCompletion','return_to_the_same_rounded_checkpoint_after_all_lateral_and_arched_checkpoints_with_four_contacts_and_no_stop_rule'),
    coaching_execution=jsonb_build_object(
      'qualityGates',jsonb_build_array('variant_and_station_exact','floor_transfer_and_support_tolerated','named_direction_understood','four_contacts_fixed','all_checkpoints_observable','range_and_pace_controlled','both_directions_recorded','no_stop_symptoms'),
      'stopRules',jsonb_build_array('sharp_increasing_radiating_or_unfamiliar_pain','neurologic_or_bowel_or_bladder_change','dizziness_faintness_nausea_visual_change_or_disorientation','support_contact_or_floor_transfer_pain','contact_loss_or_path_breakdown','wrong_task_forced_range_or_breath_hold','unsafe_station_or_exit','budget_or_duration_reached'),
      'persistence',jsonb_build_array('definition_and_variant','named_first_side_and_direction','planned_and_actual_complete_circles','range_tempo_rest_and_optional_mat','valid_invalid_partial_and_symptom_limited_attempts','contacts_and_first_fault','symptoms_and_stop_reason','support_and_active_range_seconds','duration','substitution','floor_entry_and_exit')),
    pairing_logic=jsonb_build_object(
      'sameSessionBudget',jsonb_build_array('complete_spinal_circles','circles_per_direction','quadruped_support_seconds','active_spinal_range_seconds','wrist_shoulder_knee_support','technical_fatigue','downstream_spinal_loading','impact'),
      'avoidAutomaticPairingWith',jsonb_build_array('fatiguing_wrist_or_shoulders_support','symptom_provoking_spinal_end_range','same_session_spinal_loading_that_exceeds_budget'),
      'revalidateAfterSubstitution',TRUE),
    media_library=jsonb_build_object(
      'candidate_video_ids',jsonb_build_array('F8tiHAb_WQI','LywxamPqa9k','b4fwyPYXFkY','u2HkVRxxioA','vdgvP8CqwRw'),
      'reviewState','oembed_metadata_only_candidate_quarantine',
      'playbackExactnessContactsCheckpointsCaptionsAccessibilityQualitySafetyAndApprovalVerified',FALSE,
      'humanReviewRequired',TRUE),
    programming_kind='exercise',linked_skill_id=NULL,
    why_publish_ready=FALSE,updated_at=now()
  WHERE id=26;

  UPDATE coaching.exercise_safety_profile SET
    risk_level=1,impact_level=0,minimum_age_recommended=NULL,
    minimum_skill_level=NULL,requires_spotting=FALSE,
    requires_coach_supervision='recommended',
    minimum_prerequisite_notes='Readiness is evaluated from floor transfer, exact four-point support, comfortable controllable multi-planar spinal range, current restrictions and symptoms, named-direction understanding, communication, workout dose, and downstream loading; never from participant proficiency or age.',
    readiness_checks=ARRAY[
      'Confirm the exact variant, safe floor entry and exit, stable floor or optional mat, clearance, sightline, hygiene, communication, and emergency route.',
      'Confirm hand wrist elbow shoulder knee and shin support tolerance and no current symptom or restriction conflicts with multi-planar spinal motion.',
      'Confirm the participant understands rounded named-side arched opposite-side rounded counting, reverse direction, range reduction, and stop signal.',
      'Review cumulative complete circles, circles per direction, quadruped support, active spinal range, technical fatigue, and later wrist shoulder knee and spinal loading.'
    ]::TEXT[],
    stop_signs=ARRAY[
      'Sharp, increasing, radiating, or unfamiliar pain, guarding, or participant stop request.',
      'Numbness, tingling, weakness, saddle sensory change, bowel or bladder change, or another neurologic sign.',
      'Dizziness, faintness, nausea, visual change, disorientation, or inability to communicate.',
      'Hand wrist elbow shoulder knee shin or floor-transfer symptoms prevent exact support.',
      'Contact loss, support collapse, wrong direction, missed checkpoint, forced range, breath hold, or path breakdown cannot be corrected safely.',
      'Floor mat space traffic sightline hygiene communication duration budget or safe exit becomes inadequate.'
    ]::TEXT[],
    contraindications=ARRAY[
      'Current symptoms trauma procedure or clinical restrictions conflict with multi-planar spinal motion or quadruped loading.',
      'No safe floor transfer, four-point support, floor or mat, space, sightline, communication, or exit.',
      'The intended service is diagnosis treatment injury management readiness clearance passive manipulation or another exercise identity.'
    ]::TEXT[],
    common_substitutions=ARRAY[
      'Use Cat-Cow only when a distinct sagittal flexion-extension cycle fits the changed purpose and all selection dose and budget checks are rerun.',
      'Use Quadruped Thread-the-Needle only when arm-driven thoracic rotation with changing hand contact fits the changed purpose and all checks are rerun.',
      'Author and review neutral-wrist elevated-hand regional segmental non-floor loaded assisted or unstable alternatives before selection.',
      'Do not silently lift a contact add axial rotation locomotion hover limb movement external force forced range or manual assistance.'
    ]::TEXT[]
  WHERE exercise_id=26;

  UPDATE coaching.exercise_score_v1 SET
    technical_complexity=32,absolute_load_demand=12,
    coordination_demand=32,impact=1,supervision_demand=18,
    base_overall_difficulty=greatest(32,12),
    legacy_scores=coalesce(legacy_scores,'{}'::JSONB)||jsonb_build_object(
      'candidateReassessment',migration_key,
      'projectionScope','fixed_contact_global_spinal_circle_exact_variant',
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'variantScores',jsonb_build_object(
        'fixedContactGlobalSpinalCircle',
        jsonb_build_object('complexity',32,'physicalDifficulty',12,'overall',32)),
      'exerciseScoresDescribeTaskOnly',TRUE,
      'independentCalibrationRequired',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    migration_confidence=60,human_review_status='queued',
    reviewed_by=NULL,reviewed_at=NULL,
    review_notes='Research-informed candidate reassessment only. Scores describe exercise complexity and physical difficulty, not participant proficiency. Exact phase path support actions and independent calibration remain required.',
    updated_at=now()
  WHERE exercise_id=26;

  UPDATE coaching.exercise_difficulty_profile SET
    technical=3.2,complexity=3.2,load=1.2,overall=3.2,
    recommended_age_min=NULL,recommended_age_max=NULL,
    attention_demand='moderate',
    notes='Candidate projection from the exact fixed-contact global spinal-circle variant. Canonical complexity is 32/100, physical difficulty 12/100, and overall 32/100 by maximum. This is not participant proficiency or age classification.',
    source='canonical_research_candidate',updated_at=now()
  WHERE exercise_id=26;

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  VALUES(canonical_definition,1,2,'2.0.0',migration_key,'quarantined',
    jsonb_build_object(
      'identity',jsonb_build_object('passed',TRUE,'identityKey','quadruped_global_spinal_circle','legacySources',1,'activeVariants',1,'archivedSourceSkeleton',TRUE,'catCowThreadShoulderAndFullBodyRemainDistinct',TRUE),
      'taxonomy',jsonb_build_object('passed',TRUE,'controlledTerms',TRUE,'movementPatterns',jsonb_build_array('brace'),'bodyRegions',13,'equipment',jsonb_build_array('none','mat_optional')),
      'anatomy',jsonb_build_object('passed',TRUE,'musclesJointsActionsPlanesLateralityContactsPhaseSequenceAndAxialRotationBoundary',TRUE),
      'difficulty',jsonb_build_object('passed',TRUE,'model','max_exercise_complexity_physical_difficulty','variantVectors',jsonb_build_array('32/12/32'),'participantClassificationAbsent',TRUE,'independentCalibrationRequired',TRUE),
      'loadFatigueRecovery',jsonb_build_object('passed',TRUE,'actualCirclesDirectionSupportTimeActiveRangeAndJointExposureTracked',TRUE,'impactNone',TRUE,'recoveryIsPlanningEstimate',TRUE),
      'constraints',jsonb_build_object('passed',TRUE,'floorTransferFourPointSupportSymptomsRestrictionsSpaceTrafficScopeAndExit',TRUE),
      'delivery',jsonb_build_object('passed',TRUE,'profiles',2,'prepareAndRestoreOnly',TRUE,'durationDoseRestStationAndSubstitutionRevalidation',TRUE),
      'instructions',jsonb_build_object('passed',TRUE,'athleteCoachAccessibilityAndSupportOperations',TRUE,'namedDirectionCheckpointsContactsSymptomsAndClinicalScope',TRUE),
      'research',jsonb_build_object('passed',TRUE,'sections',16,'registryVersion',research_version,'gmbDoseIsExampleNotUniversal',TRUE),
      'media',jsonb_build_object('passed',FALSE,'candidateCount',5,'currentOEmbedMetadataHealthy',TRUE,'playbackReviewed',FALSE,'exactVariantReviewed',FALSE,'captionsAccessibilityQualitySafetyAndApprovalReviewed',FALSE),
      'relationships',jsonb_build_object('passed',FALSE,'reviewOnly',4,'approved',0,'automaticSubstitution',FALSE),
      'calibration',jsonb_build_object('passed',FALSE,'reviewOnly',2,'approved',0),
      'alternates',jsonb_build_object('passed',TRUE,'assessments',20,'singleExactVariant',TRUE,'supportChangingVariantsQuarantined',TRUE),
      'generationSupport',jsonb_build_object('passed',TRUE,'selectionConstraints',TRUE,'cumulativeFatigueAndImpactBudgets',TRUE,'duration',TRUE,'equipmentAndStation',TRUE,'substitutionRevalidation',TRUE,'renderingAndPersistence',TRUE),
      'publication',jsonb_build_object('passed',FALSE,'reviewer',NULL,'approver',NULL)),
    jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01','message','A qualified human must watch all five candidates in full and verify playback, exact fixed contacts, checkpoints, path, named direction, range, dose, captions, accessibility, cue quality, safety, conflicts, reviewer identity, timestamp, card version, and approval rationale.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','A qualified coach must approve or reject every Cat-Cow and Thread-the-Needle relationship; no automatic substitution between distinct sagittal circular and arm-driven rotation tasks is authorized.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','An independent qualified reviewer must calibrate exercise complexity 32 and physical difficulty 12 for the exact variant. Scores do not classify a participant or create an age or proficiency level.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','A qualified reviewer and separate approver must complete content review before publication. The exact phase path anatomy support dose stop scope accessibility and support rules remain quarantined.')),
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
        AND movement_patterns=ARRAY['brace']::TEXT[]
        AND anatomy_json<>'{}'::JSONB
        AND environment_json<>'{}'::JSONB
        AND population_json<>'{}'::JSONB
        AND athlete_support_json<>'{}'::JSONB
        AND coach_support_json<>'{}'::JSONB
        AND support_operations_json<>'{}'::JSONB
        AND provenance_json->>'approvalsCreated'='false')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source_variant AND status='archived'
        AND requirements_json->>'representation'='superseded_source_skeleton') THEN
    RAISE EXCEPTION '% definition or source quarantine assertion failed',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(active_variant_ids) AND definition_id=canonical_definition
        AND status='review' AND requirements_json->>'selectable'='true'
        AND (difficulty_json->>'technicalComplexity')::INTEGER BETWEEN 1 AND 100
        AND (difficulty_json->>'physicalDifficulty')::INTEGER BETWEEN 1 AND 100
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=greatest(
          (difficulty_json->>'technicalComplexity')::INTEGER,
          (difficulty_json->>'physicalDifficulty')::INTEGER)
        AND (load_profile_json->>'landingContactsPerRep')::INTEGER=0
        AND (fatigue_profile_json->>'impactAccumulation')::INTEGER=1
        AND programming_profile_json->>'publicationQuarantined'='true')<>1 THEN
    RAISE EXCEPTION '% active variant assertion failed',migration_key;
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
        AND cardinality(stop_rules)>=8)<>2
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
      WHERE (from_variant_id=circle_variant OR to_variant_id=circle_variant)
        AND review_status='review' AND reviewed_by IS NULL)<>4
    OR (SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=circle_variant AND status='review'
        AND reviewed_by IS NULL)<>2
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE (survivor_definition_id=canonical_definition
          OR resolved_definition_id=canonical_definition)
        AND decision='distinct_exercises' AND reviewed_by IS NULL)<>4 THEN
    RAISE EXCEPTION '% authored row-count or quarantine assertion failed',migration_key;
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
    OR EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 v
      CROSS JOIN LATERAL jsonb_array_elements_text(v.requirements_json->'equipment') key
      WHERE v.id=ANY(active_variant_ids)
        AND NOT EXISTS(SELECT 1 FROM coaching.equipment allowed
          WHERE allowed.key=key)) THEN
    RAISE EXCEPTION '% uncontrolled taxonomy was authored',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1 r
      CROSS JOIN LATERAL unnest(r.dimensions) dimension
      WHERE (r.from_variant_id=circle_variant OR r.to_variant_id=circle_variant)
        AND dimension<>ALL(ARRAY['load','leverage','range','speed','stability',
          'complexity','impact','decision_demand','fatigue']))
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=circle_variant OR to_variant_id=circle_variant)
        AND review_status='approved') THEN
    RAISE EXCEPTION '% relationship dimension or approval assertion failed',migration_key;
  END IF;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=26
      AND skill_level IS NULL AND age_min IS NULL AND age_max IS NULL
      AND linked_skill_id IS NULL AND is_published=FALSE
      AND programming_kind='exercise' AND why_publish_ready=FALSE)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1
      WHERE exercise_id=26 AND technical_complexity=32
        AND absolute_load_demand=12 AND base_overall_difficulty=32
        AND human_review_status='queued'
        AND reviewed_by IS NULL AND reviewed_at IS NULL)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=canonical_definition AND card_version=2
        AND status='quarantined' AND human_review_required=TRUE
        AND jsonb_array_length(blocking_issues_json)=4) THEN
    RAISE EXCEPTION '% legacy projection or packet assertion failed',migration_key;
  END IF;
END
$migration$;
