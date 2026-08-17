-- Source 29: replace one ambiguous Inchworm skeleton with two explicit exact
-- return-mode variants. Evidence, media, graph, calibration, content, and
-- publication remain candidate/review-only. This migration creates no human
-- approval and no exercise-card participant level.
DO $migration$
DECLARE
  migration_key CONSTANT TEXT := '499_coaching_inchworm_walkout_family_audit_hardening';
  research_version CONSTANT TEXT := '2026-08-09.96';
  canonical_definition UUID;
  source_variant UUID;
  stationary_variant UUID;
  traveling_variant UUID;
  active_variant_ids UUID[];
  all_owned_variant_ids UUID[];
  plank_definition UUID;
  plank_variant UUID;
  down_dog_definition UUID;
  down_dog_variant UUID;
  bear_definition UUID;
  bear_variant UUID;
  wgs_definition UUID;
  wgs_variant UUID;
  protected_count INTEGER;
BEGIN
  SELECT definition_id INTO canonical_definition FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=29;
  SELECT id INTO source_variant FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='baseline';
  SELECT id INTO stationary_variant FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='stationary-hand-return';
  stationary_variant := coalesce(stationary_variant,gen_random_uuid());
  SELECT id INTO traveling_variant FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='traveling-feet-in-return';
  traveling_variant := coalesce(traveling_variant,gen_random_uuid());
  SELECT definition_id INTO plank_definition FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=5;
  SELECT id INTO plank_variant FROM coaching.exercise_variant_v1 WHERE definition_id=plank_definition AND variant_key='stable-floor-forearm-toes-standard';
  SELECT definition_id INTO down_dog_definition FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=39;
  SELECT id INTO down_dog_variant FROM coaching.exercise_variant_v1 WHERE definition_id=down_dog_definition AND variant_key='baseline';
  SELECT definition_id INTO bear_definition FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=38;
  SELECT id INTO bear_variant FROM coaching.exercise_variant_v1 WHERE definition_id=bear_definition AND variant_key='baseline';
  SELECT definition_id INTO wgs_definition FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=908;
  SELECT id INTO wgs_variant FROM coaching.exercise_variant_v1 WHERE definition_id=wgs_definition AND variant_key='baseline';
  active_variant_ids := ARRAY[stationary_variant,traveling_variant];
  all_owned_variant_ids := ARRAY[source_variant,stationary_variant,traveling_variant];

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=29 AND facility_id=1)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition AND legacy_exercise_id=29)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE definition_id=canonical_definition AND legacy_exercise_id=29)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source_variant AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=plank_variant AND definition_id=plank_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=down_dog_variant AND definition_id=down_dog_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=bear_variant AND definition_id=bear_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=wgs_variant AND definition_id=wgs_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1 WHERE exercise_id=29)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_difficulty_profile WHERE exercise_id=29)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_safety_profile WHERE exercise_id=29) THEN
    RAISE EXCEPTION '% prerequisite source or neighbor rows are missing',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id IN(stationary_variant,traveling_variant)
        AND definition_id<>canonical_definition)
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE slug='inchworm-walkout' AND id<>canonical_definition) THEN
    RAISE EXCEPTION '% working UUID or slug already belongs to another card',migration_key;
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
    UNION ALL SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=ANY(all_owned_variant_ids) OR to_variant_id=ANY(all_owned_variant_ids))
        AND (reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL OR review_status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(all_owned_variant_ids)
        AND (reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL OR status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE (survivor_definition_id=canonical_definition
          OR resolved_definition_id=canonical_definition)
        AND (reviewed_by IS NOT NULL OR resolution_source='human_review')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_v1
      WHERE exercise_id=29
        AND (human_review_status<>'queued' OR reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL)
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
  WHERE (from_variant_id=ANY(all_owned_variant_ids) OR to_variant_id=ANY(all_owned_variant_ids))
    AND reviewed_by IS NULL AND review_status<>'approved';
  DELETE FROM coaching.exercise_score_calibration_v1
  WHERE variant_id=ANY(all_owned_variant_ids)
    AND reviewed_by IS NULL AND status<>'approved';

  UPDATE coaching.exercise_definition_source_v1 SET
    source_kind='legacy_migration',
    provenance_json=jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'sourceDisposition','canonical_survivor_reauthored',
      'sourceInterpretation','source 29 contains one standing-to-high-plank hand-walk family but leaves the return mode ambiguous and omits exact counting taxonomy anatomy cumulative budgets logistics persistence and review contracts',
      'exactWorkingSpecifications',jsonb_build_array('stationary_hand_return','traveling_feet_in_return'),
      'researchSources',jsonb_build_array(
        'https://www.acefitness.org/resources/everyone/exercise-library/254/inchworms/',
        'https://www.oxfordhealth.nhs.uk/wp-content/uploads/sites/22/2023/10/Core-Strength-2.pdf',
        'https://media.specialolympics.org/resources/community-building/young-athletes/lesson-plans/YA-Lesson-Plans-5to7-Abridged-EN.pdf',
        'https://pubmed.ncbi.nlm.nih.gov/32560185/',
        'https://pubmed.ncbi.nlm.nih.gov/29063454/',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC10508241/'),
      'exerciseDifficultyDescribesTaskOnly',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=29 AND definition_id=canonical_definition;

  UPDATE coaching.exercise_delivery_profile_v1 SET status='archived',updated_at=now()
  WHERE variant_id=source_variant;
  UPDATE coaching.exercise_variant_v1 SET
    variant_key='identity-quarantine-source-29',
    display_name='Inchworm Walkout Legacy Ambiguous Skeleton — Source 29',
    modifier_keys='{}'::TEXT[],difficulty_json='{}'::JSONB,status='archived',
    requirements_json=jsonb_build_object(
      'selectable',FALSE,'representation','superseded_source_skeleton',
      'sourceLegacyExerciseId',29,
      'archiveReason','ambiguous either-or return mode replaced by two explicit exact variants',
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
    canonical_definition,1,29,'inchworm-walkout','Inchworm Walkout','Inchworm Walkout',
    ARRAY['Inchworm','Inch Worm','Inchworm Walkouts','Walkout','Walk Out','Hand Walkout','Plank Walkout'],
    'An unloaded standing-to-high-plank hand-walk sequence with one declared return mode and no push-up. Both variants start standing, use a safe hinge or knee bend to place the hands, walk the hands forward to a controlled high plank, and finish standing. The stationary variant keeps the feet at the start while the hands walk out and back. The traveling variant keeps the hands planted after plank while the feet take controlled steps toward the hands, ending forward of the start. One complete return to standing is one repetition. Step size, safe knee bend, tempo, brief plank pause, repetitions, sets, rest, and floor markers are delivery annotations. A push-up, jump, single-leg base, raised hands, unstable or loaded support, added lunge or rotation, Down Dog phase, or plank-only endpoint changes the task.',
    'standing_to_high_plank_hand_walk','2.0.0',2,'review',
    84,60,50,ARRAY['hinge','brace','locomote']::TEXT[],
    ARRAY['full_body','core','spine','shoulder','scapula','elbow','wrist','hand','hip','knee','hamstrings','ankle','foot','calf']::TEXT[],
    ARRAY['none']::TEXT[],'{}'::TEXT[],
    jsonb_build_object(
      'surface','flat dry stable nonslip floor that tolerates alternating hand and foot contact',
      'space','stationary variant requires full body length plus hand-step clearance; traveling variant requires a marked forward lane and safe deceleration and exit area',
      'stationCapacity',1,'laneRequiredByVariant',jsonb_build_object('stationary_hand_return',FALSE,'traveling_feet_in_return',TRUE),
      'coachSightline','side view for hinge plank and shoulder position plus front oblique view for hand foot tracking elbow support and lane control',
      'inspection',jsonb_build_array('floor traction dryness cleanliness and debris','hand and foot clearance','lane boundary and cross traffic','wrist-compatible contact surface','head and shoulder clearance','communication sightline and emergency route'),
      'changeRule','Changing return mode support height push action locomotion base equipment surface load purpose dose or downstream hand-support demand requires full identity selection duration logistics substitution persistence and rendering revalidation.'),
    jsonb_build_object(
      'exerciseCardDoesNotClassifyParticipants',TRUE,'readinessIsWorkoutInput',TRUE,
      'selectionPrerequisites',jsonb_build_array('safe standing-to-floor and floor-to-standing transition','comfortable controllable hinge or knee accommodation','tolerable bilateral wrist hand shoulder elbow and high-plank support','can take controlled hand steps without overreaching','can hold a brief high plank without uncontrolled sag hike rotation or elbow collapse','understands selected return mode one full repetition lane and stop signal'),
      'excludeOrEscalate',jsonb_build_array('recent significant trauma procedure or surgery without applicable clearance','sharp increasing radiating or unfamiliar spine shoulder elbow wrist hand hip knee ankle or hamstring pain','new numbness tingling weakness saddle sensory change or bowel or bladder change','chest or breathing concern dizziness faintness nausea visual change or disorientation','weight-bearing upper-limb symptoms or floor-transfer limits preventing exact execution','surface traction lane space sightline communication or safe exit is inadequate','participant requests stop or cannot communicate reliably'),
      'notEstablishedByEvidence',jsonb_build_array('universal eligibility or spinal shape','required knee angle hand-step count reach distance or plank pause','universal dose frequency recovery or progression','strength flexibility mobility injury-prevention treatment or readiness outcome','numeric difficulty calibration or media exactness')),
    jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'canonicalAuthoredFromResearch',TRUE,
      'primaryIdentitySource','https://www.acefitness.org/resources/everyone/exercise-library/254/inchworms/',
      'legacySources',jsonb_build_array(29),
      'identityContract','standing_to_floor_hand_steps_to_high_plank_selected_stationary_hand_return_or_traveling_feet_in_return_then_complete_stand_without_push_up',
      'researchSources',jsonb_build_array('https://www.acefitness.org/resources/everyone/exercise-library/254/inchworms/','https://www.oxfordhealth.nhs.uk/wp-content/uploads/sites/22/2023/10/Core-Strength-2.pdf','https://media.specialolympics.org/resources/community-building/young-athletes/lesson-plans/YA-Lesson-Plans-5to7-Abridged-EN.pdf','https://pubmed.ncbi.nlm.nih.gov/32560185/','https://pubmed.ncbi.nlm.nih.gov/29063454/','https://pmc.ncbi.nlm.nih.gov/articles/PMC10508241/'),
      'confidenceBySection',jsonb_build_object('identity',84,'taxonomy',82,'anatomy',72,'difficulty',60,'load',66,'fatigueRecovery',56,'constraints',80,'dosage',58,'instructions',84,'alternates',86,'media',50),
      'unresolvedClaims',jsonb_build_array('one universal hinge spinal knee hand-step or plank technique','universal dose recovery benefit readiness or progression','numeric difficulty calibration','media playback return mode push-up omission captions accessibility quality safety and approval'),
      'externalPlaybackVerificationPerformed',FALSE,'sourceLimitationsExplicit',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,'publicationQuarantined',TRUE),
    NULL,NULL,NULL,NULL,
    jsonb_build_object(
      'primaryMuscles',jsonb_build_array('rectus_abdominis','internal_oblique','external_oblique','transversus_abdominis','serratus_anterior','anterior_deltoid','triceps_brachii','hamstrings','quadriceps'),
      'secondaryMuscles',jsonb_build_array('erector_spinae','gluteus_maximus','hip_flexors','gastrocnemius','soleus','pectoralis_major'),
      'stabilizers',jsonb_build_array('rotator_cuff','scapular_stabilizers','wrist_flexors_and_extensors','deep_spinal_stabilizers','pelvic_stabilizers'),
      'joints',jsonb_build_array('hip','knee','ankle','shoulder','elbow','wrist','scapulothoracic_articulation','spinal_segments'),
      'jointActions',jsonb_build_array('hip_flexion_and_extension','knee_flexion_and_extension_as_needed','ankle_dorsiflexion_and_plantarflexion','shoulder_flexion_relative_to_trunk_and_closed_chain_stabilization','elbow_extension_support','wrist_extension_support','scapular_protraction_and_upward_rotation_control','trunk_anti_extension','alternating_hand_steps','variant_specific_foot_steps'),
      'planes',jsonb_build_array('sagittal','multiplanar'),
      'laterality','bilateral',
      'contactsAndSequence',jsonb_build_object('start','bilateral_feet','descent','feet_then_hands','outbound','feet_fixed_while_hands_step_forward','checkpoint','bilateral_hands_and_feet_high_plank','stationaryReturn','feet_fixed_while_hands_step_back_then_stand','travelingReturn','hands_fixed_while_feet_step_in_then_stand'),
      'countingBoundary','one_complete_standing_to_high_plank_to_selected_return_mode_to_standing_cycle_without_push_up',
      'rangeRule','Use only the hinge knee accommodation hand-step reach and plank length that preserve traction support and control; no maximum reach is required.',
      'notClaimed',jsonb_build_array('quantified_joint_force','universal_neutral_spine','isolated_muscle_activation','mandatory_straight_knees','treatment_or_prevention_effect')),
    jsonb_build_object(
      'whyItMatters','Practices an integrated standing-to-floor transition, controlled hand-supported high plank, and exact return sequence for a workout that calls for it.',
      'primaryCue','Name the return mode first: walk the hands to a strong high plank, then use only that return and stand to finish the repetition.',
      'expectedSensations',jsonb_build_array('comfortable posterior-chain lengthening','moderate abdominal shoulder arm and hand-support effort','controlled weight shift'),
      'unexpectedSensations',jsonb_build_array('sharp increasing radiating or unfamiliar pain','numbness tingling or weakness','dizziness faintness nausea visual change or chest or breathing concern','loss of hand or foot traction'),
      'painGuidance','Stop rather than forcing range or support. Report the symptom and use facility escalation; the card does not diagnose or treat it.',
      'selfChecks',jsonb_build_array('selected return mode is known','hands and feet have traction','hand steps stay controlled','high plank avoids uncontrolled sag hike rotation or elbow collapse','no push-up or jump is added','standing finish is controlled'),
      'accessibility',jsonb_build_array('side-view demonstration','written phase sequence','named return-mode card','floor or lane markers','slower pace fewer steps or repetitions and more rest','separately authored raised-hand alternative when floor access is unsuitable'),
      'mediaAlternatives',jsonb_build_array('captioned transcript after review','still sequence of stand hand placement hand steps plank selected return and stand','coach demonstration from side and front oblique views'),
      'incidentPrompt','Stop, make the station safe, record variant phase symptom or fault and actual exposure, and escalate under facility policy.'),
    jsonb_build_object(
      'observationChecklist',jsonb_build_array('exact variant and no-push-up contract','surface lane and clearance','standing-to-floor control','hinge and knee accommodation','hand step size and shoulder position','elbow and wrist support','high-plank trunk pelvis and head control','selected hand-back or feet-in return','standing finish','breathing symptoms first fault dose and duration'),
      'faultCorrections',jsonb_build_object('cannotReachFloor','bend knees within control or use a separately authored raised-hand card','overreachOrShoulderLoss','shorten hand steps and stop at the longest controlled plank','lumbarSagOrHipHike','shorten walkout reduce dose or use a reviewed plank regression','elbowCollapseOrWristPain','stop hand support and choose a separately reviewed alternative','wrongReturnOrAddedPushUp','stop reset and re-cue the selected exact variant','tractionLoss','stop and correct or close the station'),
      'demonstrationPlan',jsonb_build_array('show stationary and traveling as separate cards','show one full counted repetition from the side','show hand and foot contacts from front oblique','show no-push-up boundary and safe stop'),
      'groupManagement',jsonb_build_array('one participant per marked station or lane','separate traveling lanes from stationary stations','stagger starts to prevent crossing traffic','coach where hinge plank and return remain visible','sanitize shared floor-contact areas under facility policy'),
      'modificationDecisionTree',jsonb_build_array('If floor reach needs only safe knee accommodation keep the variant and annotate it.','If support height must change select a separately authored raised-hand variant.','If high plank cannot be controlled use a reviewed plank or non-hand-support alternative.','If return mode space or traffic changes reselect the exact variant and recompute time.','If symptoms or scope concerns appear stop and escalate; do not diagnose.'),
      'doNotUseWhen',jsonb_build_array('floor transfer or bilateral hand support is unsafe','wrist shoulder elbow spine hamstring hip knee ankle or cardiopulmonary symptoms conflict','traction clearance lane sightline communication or exit is inadequate','fatigue prevents controlled hand steps high plank return or stand','the intended task includes a push-up jump added lunge rotation or another identity'),
      'comprehensionQuestions',jsonb_build_array('Which return mode are you doing?','What completes one repetition?','What stays controlled in high plank?','When do you stop?')),
    jsonb_build_object(
      'issueCategories',jsonb_build_array('identity_or_return_mode','content_or_cue','difficulty_or_dose','surface_equipment_or_lane','accessibility','media','symptom_or_incident','data_or_persistence'),
      'supportEscalation',jsonb_build_object('coach','correct setup return mode dose and station within scope','facilityLead','quarantine repeated content surface media or data failures','clinicalOrEmergency','follow facility policy for red flags neurologic cardiopulmonary severe pain trauma or urgent symptoms'),
      'retentionPolicy','Store definition and card version, exact variant, planned and actual repetitions, steps, distances, plank and support seconds, hinge strategy, pace, rests, invalid or partial attempts, first fault, symptoms, stop reason, substitution, duration, station incident, coach edits, and rendering version under facility policy.',
      'changeImpactPolicy','Any change to return mode base contacts support height push action locomotion surface load difficulty dose stop rules media or graph invalidates prior rendering and requires revalidation and review.',
      'knownLimitations',jsonb_build_array('candidate research is not content approval','oEmbed is not playback or exactness review','difficulty and recovery values are unapproved planning estimates','two variants require explicit UI and persistence labels'),
      'feedbackQuestions',jsonb_build_array('Was the return mode unmistakable?','Could coach and athlete count one repetition the same way?','Were lane and floor needs accurate?','Were stop and substitution choices actionable?')))
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
  SELECT v.id,canonical_definition,v.variant_key,v.display_name,v.modifiers,
    jsonb_build_object(
      'technicalComplexity',v.complexity,'absoluteLoadDemand',v.physical,
      'physicalDifficulty',v.physical,'coordinationDemand',v.complexity,
      'supervisionDemand',22,'failureConsequence',30,'impact',1,
      'workCapacityDemand',v.work_capacity,
      'baseOverallDifficulty',greatest(v.complexity,v.physical),
      'overallFormula','max(exercise_complexity,physical_difficulty)',
      'scoresDescribeExerciseTaskOnly',TRUE,'independentCalibrationRequired',TRUE),
    jsonb_build_object(
      'selectable',TRUE,'returnMode',v.return_mode,'startAndFinish','standing',
      'highPlankRequired',TRUE,'pushUpIncluded',FALSE,
      'laneRequired',v.lane_required,'netTravel',v.net_travel,
      'validCompletion',v.valid_completion,
      'mustMaintain',jsonb_build_array('surface_traction','controlled_standing_to_floor','small_controlled_hand_steps','supported_elbows_wrists_and_shoulders','high_plank_without_uncontrolled_sag_hike_or_rotation','selected_return_mode','controlled_standing_finish','communication'),
      'mustNotAdd',jsonb_build_array('push_up','jump','single_leg_base','raised_or_unstable_support','external_load','lunge_or_rotation','down_dog_or_pike','plank_only_endpoint'),
      'invalidWhen',jsonb_build_array('return_mode_changes','push_up_or_jump_added','traction_lost','support_or_plank_control_lost','standing_finish_missing','stop_rule_occurs')),
    'review',
    jsonb_build_object(
      'gripDemand',18,'spinalLoading',18,'eccentricStress',18,
      'landingContactsPerRep',0,'externalLoadMethod','bodyweight',
      'impactClass','none','handSupport',TRUE,
      'wristShoulderSupportSecondsPerRepPlanning',v.support_seconds,
      'handStepsPerRepPlanning',v.hand_steps,
      'footStepsPerRepPlanning',v.foot_steps,
      'loadBasis','body segment mass and changing lever during hand walk and high plank; numeric values are planning estimates only'),
    jsonb_build_object(
      'localMuscleFatigue',v.local_fatigue,'gripFatigue',16,
      'technicalFatigueSensitivity',v.tech_fatigue,'impactAccumulation',1,
      'recoveryHours',12,
      'primaryFatigueSites',jsonb_build_array('trunk','shoulder_girdle','triceps','wrist_and_hand_support','posterior_chain'),
      'cumulativeBudgetKeys',jsonb_build_array('complete_repetitions','hand_steps','foot_steps','high_plank_seconds','wrist_support_seconds','shoulder_support_seconds','standing_floor_transitions','hinge_range_exposure','travel_distance','technical_faults','impact_contacts'),
      'downstreamInterference',jsonb_build_array('same_session_tumbling_or_hand_support','pressing_or_overhead_volume','wrist_or_grip_loading','posterior_chain_end_range','fatigued_trunk_control'),
      'recoveryBasis','conservative planning estimate only; no source validates a universal recovery interval'),
    jsonb_build_object(
      'selectionStatus','candidate_review_only','selectable',TRUE,
      'phaseRoles',jsonb_build_array('prepare_and_access','movement_intelligence'),
      'selectionInputs',jsonb_build_array('workout objective','exact return mode','floor transfer hinge and knee strategy','wrist shoulder elbow and high-plank support','surface traction','station or lane space and traffic','dose duration and cumulative hand-support budgets','downstream training','coach sightline and scope'),
      'doseVariables',jsonb_build_array('complete_repetitions','hand_steps','foot_steps','plank_pause_seconds','tempo','sets','rest_seconds','distance'),
      'durationFormula','setup_and_briefing_seconds + sum(actual_transition_hand_step_plank_return_stand_seconds) + rests + invalid_partial_symptom_or_substitution_seconds + station_reset_seconds',
      'substitutionRevalidation',jsonb_build_array('identity_and_return_mode','base_contacts_and_support_height','push_jump_or_added_action','restrictions_and_symptoms','equipment_surface_lane_and_traffic','dose_and_actual_duration','fatigue_and_impact_budgets','downstream_interference','persistence','coach_rendering','athlete_rendering'),
      'publicationQuarantined',TRUE,'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  FROM (VALUES
    (stationary_variant,'stationary-hand-return','Inchworm Walkout — Stationary Hands Out and Back',ARRAY['stationary','hands_out_and_back','no_push_up']::TEXT[],30,24,30,'hands_walk_back_to_feet',FALSE,'zero','feet stay at the start while hands walk out to controlled high plank and back then the athlete stands under control without a push-up or stop rule',18,6,0,24,30),
    (traveling_variant,'traveling-feet-in-return','Inchworm — Traveling Hands Out, Feet In',ARRAY['traveling','hands_out_feet_in','no_push_up']::TEXT[],34,26,34,'feet_step_to_planted_hands',TRUE,'forward','hands walk to controlled high plank then remain planted while feet take controlled steps toward the hands and the athlete stands forward under control without a push-up or stop rule',20,6,6,26,34)
  ) v(id,variant_key,display_name,modifiers,complexity,physical,work_capacity,return_mode,lane_required,net_travel,valid_completion,support_seconds,hand_steps,foot_steps,local_fatigue,tech_fatigue)
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
  SELECT p.id,p.variant_id,p.profile_key,p.phase_key,'primary',p.purpose,
    p.suitability,p.alignment,p.objectives,
    jsonb_build_object('sets',p.sets,'completeRepetitions',p.reps,
      'tempo','controlled eight to twenty seconds per complete repetition',
      'plankPauseSeconds','zero to three only while support remains controlled',
      'restSeconds',p.rest,'rpeCeiling',p.rpe,
      'countRule','Count only a complete stand to hand placement to hand-walk to controlled high plank to the selected return mode and controlled standing finish. No push-up, jump, wrong return, support loss, or stop event counts.',
      'invalidOrPartialAttempts','record but do not count'),
    'The selected return mode stays exact; hand and foot contacts keep traction; hand steps remain controlled; elbows, wrists, shoulders, trunk, pelvis, head, hinge, and standing finish remain supported without an added push-up, jump, wrong return, unsafe reach, symptom, or stop event.',
    ARRAY['Stop for sharp, increasing, radiating, or unfamiliar pain or participant request.',
      'Stop for numbness, tingling, weakness, saddle sensory or bowel or bladder change.',
      'Stop for chest or breathing concern, dizziness, faintness, nausea, visual change, disorientation, or inability to communicate.',
      'Stop when hand or foot traction, wrist elbow shoulder support, high-plank control, selected return mode, lane clearance, or safe standing finish is lost.',
      'Stop at the planned cumulative hand-support, technical-fatigue, duration, or downstream-interference budget.']::TEXT[],
    p.coach,
    p.athlete,
    'Improved familiarity and repeatable control for the exact standing-to-high-plank hand-walk sequence in this workout context; no treatment, prevention, structural correction, or transfer outcome is promised.',
    ARRAY['none']::TEXT[],
    jsonb_build_object('participantsPerStation',1,'stationType',p.station_type,
      'laneRequired',p.lane,'minimumSpace',p.minimum_space,
      'setupSeconds',25,'transitionSeconds',12,'resetSeconds',8,
      'throughputRule','One athlete moves while the coach preserves full sightline; stagger entries and never allow traveling lanes to cross.',
      'surfaceRule','Flat dry stable nonslip floor with clean hand-contact area.',
      'coachSightline','Side and front-oblique view of hinge hand steps high plank selected return and stand.',
      'equipmentInspection',jsonb_build_array('none sentinel declared','floor traction and cleanliness','station or lane boundary','clearance and cross traffic','communication and safe exit'),
      'accessibility','Use phase cards, floor markers, slower pace, fewer repetitions, more rest, or a separately authored support-height alternative.'),
    '{}'::UUID[],'review',
    jsonb_build_object('formula','setup + briefing + sum(actual transition hand-step plank return and stand seconds) + rest + invalid partial symptom substitution and reset seconds','estimatedSecondsPerRepetition',p.seconds_per_rep,'estimatedSetupSeconds',25,'estimatedTransitionSeconds',12,'estimatedResetSeconds',8,'mustPersistActualDuration',TRUE,'recomputeAfterSubstitution',TRUE),
    jsonb_build_object('scaleDown',jsonb_build_array('reduce complete repetitions','shorten hand steps or plank length while retaining a valid high-plank checkpoint','allow controlled knee bend','slow the pace','increase rest'),'scaleUp',jsonb_build_array('add repetitions within budget','add a brief controlled plank pause','use the traveling exact variant only after explicit reselection'),'neverSilentScale',jsonb_build_array('change return mode','add push-up or jump','change support height','add load instability lunge rotation or pike'),'revalidateAfterAnyChange',TRUE),
    jsonb_build_object('primaryUnit','complete_repetition','record',jsonb_build_array('variant','planned_and_actual_complete_repetitions','hand_steps','foot_steps','distance','plank_pause_seconds','high_plank_seconds','wrist_and_shoulder_support_seconds','standing_floor_transitions','hinge_and_knee_strategy','tempo','rests','invalid_or_partial_attempts','first_fault','symptoms','stop_reason','substitution','actual_duration'),'budgetAggregation',jsonb_build_array('complete_repetitions','hand_steps','foot_steps','travel_distance','high_plank_seconds','wrist_support_seconds','shoulder_support_seconds','technical_fatigue','impact_contacts','downstream_hand_support'),'invalidAttemptPolicy','Store invalid and partial attempts separately and exclude them from completed-repetition count.'),
    jsonb_build_object('preSession',jsonb_build_array('Confirm exact variant and no-push-up boundary.','Check floor transition hand support symptoms surface station or lane and downstream budgets.'),'during',jsonb_build_array('Name hand-back or feet-in return before the first repetition.','Watch first fault traction plank line breathing and actual time.','Stop rather than forcing reach support or standing return.'),'after',jsonb_build_array('Record actual dose steps distance support seconds first fault symptoms stops and substitutions.','Escalate content media safety or persistence issues under facility policy.'),'helpSignal','Athlete stops, holds a safe position if possible, and asks for coach help; coach clears traffic and assists only within scope.')
  FROM (VALUES
    ('85ed6227-36c4-42c2-98c9-bc72684a330d'::UUID,stationary_variant,'prepare-stationary-inchworm-walkout','prepare_and_access','Quality-first standing-to-high-plank access using a fixed station and hands-out-and-back return.',78,78,jsonb_build_object('integrated_mobility',86,'trunk_control',76,'hand_support_preparation',74),1,4,30,5,'Verify stationary hand return before the first rep. Cue safe knee accommodation, small hand steps, a controlled high plank, hands back to the feet, and a controlled stand. Stop at the first support, traction, sequence, symptom, or budget fault.','Stay in one spot. Put your hands down, walk them to a strong high plank, walk them back to your feet, and stand. That is one rep. No push-up. Stop for pain, tingling, dizziness, slipping, or loss of control.','fixed_station',FALSE,'full body length plus hand-step clearance',14),
    ('401a6d08-4a4f-4f59-a2ec-1a57506c4dbe'::UUID,stationary_variant,'movement-intelligence-stationary-inchworm-walkout','movement_intelligence','Deliberate stationary sequencing, support, trunk-control, and repetition-boundary practice.',74,80,jsonb_build_object('movement_sequence',88,'body_awareness',80,'trunk_control',80),2,4,45,6,'Ask the athlete to name the hand-back return and count only the controlled standing finish. Preserve small hand steps, supported elbows and shoulders, plank control, traction, breathing, and exact no-push-up sequence.','Name it: hands out, high plank, hands back, stand. Move slowly enough to keep the floor grip and body control. Count only the stand. No push-up. Stop for pain, tingling, dizziness, slipping, or loss of control.','fixed_station',FALSE,'full body length plus coach sightline',16),
    ('f742d2eb-fe16-4f90-b3bf-e4f78804193c'::UUID,traveling_variant,'prepare-traveling-inchworm','prepare_and_access','Quality-first traveling Inchworm with hands out, feet in, and a marked forward lane.',76,76,jsonb_build_object('integrated_mobility',84,'locomotor_preparation',78,'hand_support_preparation',74),1,4,35,5,'Verify the traveling feet-in return and lane before the first rep. Cue small hand steps to high plank, planted hands, controlled foot steps toward the hands, and a balanced stand forward. Stop at the first traffic, traction, support, sequence, symptom, or budget fault.','Use the marked lane. Walk your hands to a strong high plank, keep them down while your feet take small steps in, then stand. That is one rep. No push-up. Stop for pain, tingling, dizziness, slipping, or loss of control.','marked_forward_lane',TRUE,'one full body length per planned repetition plus exit buffer',15),
    ('4e7c6177-5fbc-4921-ab73-96ebacb3d152'::UUID,traveling_variant,'movement-intelligence-traveling-inchworm','movement_intelligence','Deliberate traveling hand-foot sequencing, lane control, support, and counted standing finishes.',72,80,jsonb_build_object('movement_sequence',90,'locomotor_control',84,'trunk_control',80),2,4,50,6,'Ask the athlete to name the feet-in return and lane direction. Preserve small hand steps, supported high plank, fixed hands during foot steps, controlled standing finish, spacing, traction, breathing, and exact no-push-up sequence.','Name it: hands out, high plank, feet in, stand forward. Keep each step controlled and stay in your lane. Count only the stand. No push-up. Stop for pain, tingling, dizziness, slipping, or loss of control.','marked_forward_lane',TRUE,'planned travel distance plus full body length and exit buffer',17)
  ) p(id,variant_id,profile_key,phase_key,purpose,suitability,alignment,objectives,sets,reps,rest,rpe,coach,athlete,station_type,lane,minimum_space,seconds_per_rep)
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
    logistics_json=EXCLUDED.logistics_json,substitution_ids='{}'::UUID[],
    status='review',time_model_json=EXCLUDED.time_model_json,
    dose_scaling_json=EXCLUDED.dose_scaling_json,
    measurement_json=EXCLUDED.measurement_json,
    support_prompts_json=EXCLUDED.support_prompts_json,updated_at=now();

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,rationale,
    evidence_json,resolution_source,reviewed_by,resolved_at)
  VALUES
    (1,canonical_definition,wgs_definition,'distinct_exercises',
      'Inchworm Walkout ends after the selected hand-back or feet-in return and standing finish without another action. Inchworm to World''s Greatest Stretch adds a lunge step and trunk rotation with different laterality sequence and completion.',
      jsonb_build_object('migration',migration_key,'identityBoundary','plain_inchworm_vs_added_lunge_and_rotation','humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_identity_equivalence',NULL,now()),
    (1,canonical_definition,plank_definition,'distinct_exercises',
      'Plank Hold is a timed static hand-supported position. Inchworm Walkout includes standing descent sequential hand steps a selected return mode and standing completion.',
      jsonb_build_object('migration',migration_key,'identityBoundary','dynamic_standing_transition_vs_static_plank_hold','humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_identity_equivalence',NULL,now()),
    (1,canonical_definition,down_dog_definition,'distinct_exercises',
      'Plank to Down Dog declares a repeated pike or Down Dog phase. The two Inchworm variants use high plank only as a checkpoint before their selected return and stand.',
      jsonb_build_object('migration',migration_key,'identityBoundary','standing_walkout_vs_plank_down_dog_wave','humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_identity_equivalence',NULL,now()),
    (1,canonical_definition,bear_definition,'distinct_exercises',
      'Slow Bear Crawl maintains a quadrupedal locomotor base. Inchworm Walkout begins and ends standing and uses a high-plank checkpoint with variant-specific hand or foot return steps.',
      jsonb_build_object('migration',migration_key,'identityBoundary','standing_to_plank_cycle_vs_continuous_bear_locomotion','humanReviewRequired',TRUE,'approvalsCreated',FALSE),
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
        'noUniversalTechniqueSafetyEligibilityDoseRecoveryOutcomeOrDifficultyClaim',TRUE)),
    e.quality,'candidate',NULL,NULL
  FROM (VALUES
    ('identity','https://media.specialolympics.org/resources/community-building/young-athletes/lesson-plans/YA-Lesson-Plans-5to7-Abridged-EN.pdf','Young Athletes Lesson Plans Ages 5–7','Special Olympics','governing_body','Special Olympics names an Inchworm that walks the hands out and then the feet to the hands.','direct traveling identity context','The lesson plan does not adjudicate the stationary variant every checkpoint dose or Vortex identity boundary.',82),
    ('taxonomy','https://www.acefitness.org/resources/everyone/exercise-library/254/inchworms/','Ab Exercises: Inchworms','American Council on Exercise','professional_standard','The recognizable sequence combines standing hip hinge high-plank bracing and sequential hand and foot locomotion.','direct movement-pattern context','ACE does not create Vortex taxonomy keys and its version includes a push-up that is excluded from these exact variants.',86),
    ('anatomy','https://www.acefitness.org/resources/everyone/exercise-library/254/inchworms/','Ab Exercises: Inchworms','American Council on Exercise','professional_standard','The observable sequence uses hip and knee accommodation hand steps high-plank shoulder elbow wrist and trunk support and foot steps in its traveling form.','direct position action and contact context','The source does not quantify joint force muscle contribution or require one spinal knee or shoulder shape for every person.',86),
    ('biomechanics','https://pubmed.ncbi.nlm.nih.gov/32560185/','Core Muscle Activity During Physical Fitness Exercises: A Systematic Review','International Journal of Environmental Research and Public Health','peer_reviewed_research','Plank-family exercise evidence supports measurable trunk-muscle activity during hand-supported positions.','adjacent trunk-support context','Static plank findings do not quantify moving Inchworm activation joint loading technique dose or outcome.',90),
    ('difficulty','https://www.oxfordhealth.nhs.uk/wp-content/uploads/sites/22/2023/10/Core-Strength-2.pdf','Core Strength Level 2','Oxford Health NHS Foundation Trust','professional_standard','Oxford Health describes a standing bend and hand walk into plank as a multi-phase task.','direct task-sequence context','The source assigns no Vortex task score and its document level is not stored as exercise-card participant classification.',82),
    ('load_fatigue_recovery','https://pubmed.ncbi.nlm.nih.gov/32560185/','Core Muscle Activity During Physical Fitness Exercises: A Systematic Review','International Journal of Environmental Research and Public Health','peer_reviewed_research','Hand-supported plank-family tasks load the trunk through bodyweight stabilization.','adjacent loading context','The review does not quantify moving hand steps wrist or shoulder load cumulative fatigue or recovery for these variants.',90),
    ('constraints','https://pmc.ncbi.nlm.nih.gov/articles/PMC10508241/','Interventions for the Management of Acute and Chronic Low Back Pain: Revision 2021','Journal of Orthopaedic & Sports Physical Therapy / Academy of Orthopaedic Physical Therapy','professional_standard','Guidance supports individualized exercise with patient-centered assessment and red-flag screening.','clinical selection and scope context','The guideline is not an Inchworm prescription and does not authorize exercise staff to diagnose treat or clear participants.',96),
    ('dosage','https://pubmed.ncbi.nlm.nih.gov/29063454/','Acute Effects of Dynamic Stretching on Muscle Flexibility and Performance: An Analysis of the Current Literature','Sports Medicine','peer_reviewed_research','Dynamic warm-up responses depend on protocol duration and subsequent task.','warm-up dose context','The review does not prescribe an Inchworm repetition range hand-step count distance frequency or recovery interval.',88),
    ('instructions','https://www.oxfordhealth.nhs.uk/wp-content/uploads/sites/22/2023/10/Core-Strength-2.pdf','Core Strength Level 2','Oxford Health NHS Foundation Trust','professional_standard','Oxford Health provides a concise standing bend hand walk and plank phase sequence.','direct instruction context','The source does not specify return mode standing count no-push-up boundary every quality gate or stop rule.',82),
    ('safety_stop_rules','https://www.acefitness.org/resources/everyone/exercise-library/254/inchworms/','Ab Exercises: Inchworms','American Council on Exercise','professional_standard','ACE advises small steps spinal monitoring and avoiding overlong hand reach that increases shoulder stress.','direct technique-caution context','The source does not replace facility symptom emergency surface or clinical escalation policy.',86),
    ('programming','https://pubmed.ncbi.nlm.nih.gov/29063454/','Acute Effects of Dynamic Stretching on Muscle Flexibility and Performance: An Analysis of the Current Literature','Sports Medicine','peer_reviewed_research','Dynamic movement can be used in warm-up contexts but outcomes vary by protocol.','Prepare and Access context only','The review does not establish phase exclusivity sport transfer prevention readiness or cumulative budgets for Inchworms.',88),
    ('athlete_support','https://media.specialolympics.org/resources/community-building/young-athletes/lesson-plans/YA-Lesson-Plans-5to7-Abridged-EN.pdf','Young Athletes Lesson Plans Ages 5–7','Special Olympics','governing_body','The simple hands-out then feet-to-hands wording supports a plain-language traveling sequence.','participant communication context','It does not establish universal age eligibility sensation meaning or all accessibility and stop guidance.',82),
    ('coach_support','https://pmc.ncbi.nlm.nih.gov/articles/PMC10508241/','Interventions for the Management of Acute and Chronic Low Back Pain: Revision 2021','Journal of Orthopaedic & Sports Physical Therapy / Academy of Orthopaedic Physical Therapy','professional_standard','Clinical guidance supports individualized monitoring and appropriate red-flag escalation.','coach observation and scope boundary','It does not prescribe Inchworm return-mode cues group lanes counts or corrections.',96),
    ('accessibility','https://www.oxfordhealth.nhs.uk/wp-content/uploads/sites/22/2023/10/Core-Strength-2.pdf','Core Strength Level 2','Oxford Health NHS Foundation Trust','professional_standard','A concise phase description can be paired with stills and demonstration for instruction access.','instruction-access context','The source does not validate raised-hand changes markers or universal accommodation.',82),
    ('alternates','https://www.acefitness.org/resources/everyone/exercise-library/254/inchworms/','Ab Exercises: Inchworms','American Council on Exercise','professional_standard','ACE includes a push-up and forward travel which makes added pressing and return mode observable task dimensions.','alternate identity boundary context','ACE does not adjudicate all twenty Vortex alternates or approve graph edges.',86),
    ('media','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en','Embed videos and playlists','YouTube Help','manufacturer_instruction','Five candidates returned current YouTube oEmbed title channel thumbnail and iframe metadata on 2026-08-09.','candidate metadata and privacy-enhanced embed format only','oEmbed does not prove playback selected variant no-push-up sequence captions accessibility cue quality safety conflicts reviewer card-version match or approval.',82)
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
    'healthy','candidate','manual_research',m.query,NULL,NULL,
    '2026-11-09'::TIMESTAMPTZ,
    'Current YouTube oEmbed metadata only. Playback selected return mode exact standing hand-walk high-plank return and standing sequence push-up omission captions accessibility cue quality safety conflicts reviewer identity card-version match and approval remain unverified.'
  FROM (VALUES
    ('BXRL_AC8om4','Inchworm Walkout','Performance Course','legacy exact-title candidate checked by YouTube oEmbed'),
    ('ttxQ_UPOwWc','Inchworm Walkout','Movement As Medicine','legacy exact-title candidate checked by YouTube oEmbed'),
    ('aFkv2m9FTGs','How To Do Inch Worm Exercise','PureGym','exact exercise candidate checked by YouTube oEmbed'),
    ('-FW8DNKsAh8','Walkout','LivestrongWoman','walkout alias candidate checked by YouTube oEmbed'),
    ('ZvhfaibmpwU','Inchworm Walkout','Performance Course','legacy exact-title candidate checked by YouTube oEmbed')
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
  SELECT canonical_definition,2,a.name,a.classification,a.rationale,
    jsonb_build_object('boundaryKey',a.boundary_key,'factsRequired',a.facts,
      'neverInferFromNameParticipantRankingOrContext',TRUE),
    jsonb_build_object('status',a.proposed_status,
      'classificationCandidate',a.classification,
      'humanIdentityContentAndSafetyReviewRequired',TRUE,'approvalsCreated',FALSE),
    'candidate',NULL,NULL
  FROM (VALUES
    ('Inchworm Inch Worm Walkout Hand Walkout or Plank Walkout','same_identity','These aliases may name the standing-to-hand-walk-to-high-plank family only when the exact return mode and no-push-up contract are stated.','family_aliases',jsonb_build_array('standing_start','hand_walk','high_plank','declared_return','standing_finish','no_push_up'),'alias_requires_variant'),
    ('Stationary Hands-Out-and-Back Walkout','same_identity','This exact variant keeps the feet at the start while the hands walk to high plank and back before standing.','stationary_exact',jsonb_build_array('feet_fixed','hands_out_and_back','standing_finish'),'authored_variant'),
    ('Traveling Hands-Out Feet-In Inchworm','same_identity','This exact variant keeps the hands planted after high plank while the feet step toward them and the athlete stands forward.','traveling_exact',jsonb_build_array('hands_out','hands_fixed','feet_in','forward_stand'),'authored_variant'),
    ('Knee Bend or Hinge Range','modifier_annotation','Safe knee accommodation and reachable hinge range are delivery settings when the selected sequence is unchanged.','hinge_annotation',jsonb_build_array('knee_accommodation','hinge_range'),'delivery_annotation'),
    ('Hand Step Size or Count','modifier_annotation','Small controlled hand-step size changes path detail and duration without changing the selected variant.','hand_step_annotation',jsonb_build_array('step_size','step_count'),'delivery_annotation'),
    ('Tempo Brief Plank Pause Repetitions Sets or Rest','modifier_annotation','Pace controlled pause volume and recovery change dose rather than identity.','dose_annotation',jsonb_build_array('tempo','plank_pause','repetitions','sets','rest'),'delivery_annotation'),
    ('Floor Markers or Lane Cones','modifier_annotation','Markers organize station boundaries and distance without changing contacts or actions.','marker_annotation',jsonb_build_array('floor_marker','lane_boundary'),'delivery_annotation'),
    ('Inchworm with Push-Up','new_variant','A push-up adds elbow flexion extension chest lowering pressing load failure modes dose and another checkpoint.','push_up_variant',jsonb_build_array('push_up','pressing_load','lowering_checkpoint'),'needs_human_review'),
    ('Multiple Push-Up Inchworm','new_variant','Multiple push-ups create a materially different pressing dose fatigue and count.','multiple_push_up_variant',jsonb_build_array('multiple_push_ups','pressing_volume'),'needs_human_review'),
    ('Inchworm to World''s Greatest Stretch','new_definition','A lunge step and trunk rotation add base laterality hip shoulder sequence and completion requirements.','wgs_distinct',jsonb_build_array('lunge','rotation','added_sequence'),'existing_distinct_definition'),
    ('Walkout to Down Dog or Plank-to-Pike','new_definition','A declared pike or Down Dog phase adds hip elevation shoulder angle posterior-chain position and another checkpoint.','down_dog_distinct',jsonb_build_array('pike','down_dog','repeated_wave'),'existing_distinct_definition'),
    ('Walkout to Plank Hold Only','new_definition','Ending in plank or using the walkout only as entry to a timed hold removes the complete return-to-standing repetition.','plank_hold_distinct',jsonb_build_array('plank_endpoint','timed_hold','no_standing_return'),'existing_distinct_definition'),
    ('Raised-Hand Bench or Box Walkout','new_variant','Elevated hand support changes equipment wrist shoulder angle load station and fall consequence.','raised_hand_variant',jsonb_build_array('raised_support','equipment','changed_load'),'needs_human_review'),
    ('Single-Leg Inchworm','new_variant','Single-leg support changes balance laterality pelvis control load and fall risk.','single_leg_variant',jsonb_build_array('single_leg','balance','asymmetrical_support'),'needs_human_review'),
    ('Jump-Back or Jump-In Inchworm','new_definition','A jump replaces sequential steps and adds flight landing contacts impact power and different stops.','jump_distinct',jsonb_build_array('jump','flight','landing','impact'),'research_queue'),
    ('Bear Crawl','new_definition','Bear Crawl maintains a hand-and-foot locomotor base rather than standing-to-plank-to-standing repetitions.','bear_crawl_distinct',jsonb_build_array('continuous_quadrupedal_locomotion','no_standing_cycle'),'existing_distinct_definition'),
    ('Hamstring or Glute-Bridge Walkout','new_definition','Supine heel walking under a bridge changes base moving contacts joint actions load and purpose.','bridge_walkout_distinct',jsonb_build_array('supine_bridge','heel_steps'),'research_queue'),
    ('Ab-Wheel or Slider Walkout','new_definition','Rolling or sliding implements change interface leverage friction range equipment and failure consequence.','implement_walkout_distinct',jsonb_build_array('rolling_or_sliding_interface','equipment','changed_leverage'),'research_queue'),
    ('Loaded or Resisted Inchworm','new_definition','A vest band cable or dragged load changes force direction magnitude equipment fatigue and station safety.','loaded_distinct',jsonb_build_array('external_load','force_direction','equipment'),'research_queue'),
    ('Partner- or Clinician-Assisted Walkout or Assessment','new_definition','Manual force or measurement adds consent contact examiner protocol clinical scope and different stops.','manual_or_assessment_distinct',jsonb_build_array('manual_force_or_measurement','consent','clinical_scope'),'research_queue')
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
      'revalidate',jsonb_build_array('identity and return mode','base contacts and support height','push jump or added actions','floor transition hinge and knee strategy','wrist shoulder elbow and trunk support','surface lane traffic and sightline','dose fatigue impact duration and downstream hand support','symptoms and scope','persistence','coach rendering','athlete rendering'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'review',NULL,NULL,NULL
  FROM (VALUES
    (stationary_variant,traveling_variant,'progression',84,ARRAY['complexity','decision_demand','fatigue']::TEXT[],'Traveling feet-in return adds forward locomotion foot-step sequencing lane management and traffic demand while retaining the standing hand-walk high-plank family.'),
    (traveling_variant,stationary_variant,'regression',84,ARRAY['complexity','decision_demand','fatigue']::TEXT[],'Stationary hand return removes forward travel foot-step sequencing and lane demand while retaining standing hand walk high plank and controlled standing completion.'),
    (stationary_variant,plank_variant,'regression',55,ARRAY['complexity','range','fatigue']::TEXT[],'Plank Hold removes standing transitions and hand steps and is only a contextual regression when a static hold fits the changed purpose.'),
    (traveling_variant,wgs_variant,'progression',58,ARRAY['complexity','range','decision_demand']::TEXT[],'Inchworm to World''s Greatest Stretch adds a lunge and rotation and is only a progression after its distinct purpose laterality support and dose are revalidated.'),
    (stationary_variant,down_dog_variant,'lateral_substitution',48,ARRAY['range','complexity','fatigue']::TEXT[],'Plank to Down Dog changes the sequence to repeated plank and pike positions and is only an alternative when standing return is no longer required.')
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
  SELECT 1,v.variant_id,d.dimension,
    CASE d.dimension WHEN 'technicalComplexity' THEN v.complexity ELSE v.physical END,
    CASE WHEN (CASE d.dimension WHEN 'technicalComplexity' THEN v.complexity ELSE v.physical END)<30 THEN 20 ELSE 40 END,
    CASE d.dimension WHEN 'technicalComplexity' THEN v.complexity_reason ELSE v.physical_reason END
      ||' This scores the exercise task, not a participant.',
    'review',1,NULL,NULL,
    'Research-informed proposal only; independent comparison and qualified human approval remain required.',NULL
  FROM (VALUES
    (stationary_variant,30,24,
      'Review-only exercise-complexity anchor based on standing descent hand placement alternating hand steps high-plank checkpoint exact hands-back return no-push-up boundary and controlled standing count.',
      'Review-only physical-difficulty anchor based on repeated bodyweight hand support trunk bracing standing-floor transitions posterior-chain range and controlled return without impact or external load.'),
    (traveling_variant,34,26,
      'Review-only exercise-complexity anchor based on standing descent hand steps high-plank checkpoint fixed hands while feet step in forward lane control no-push-up boundary and controlled standing count.',
      'Review-only physical-difficulty anchor based on bodyweight hand support trunk bracing alternating hand and foot steps standing-floor transitions posterior-chain range and forward travel without impact or external load.')
  ) v(variant_id,complexity,physical,complexity_reason,physical_reason)
  CROSS JOIN (VALUES('technicalComplexity'),('absoluteLoadDemand')) d(dimension)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
    proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,
    reviewed_by=NULL,review_notes=EXCLUDED.review_notes,reviewed_at=NULL,
    updated_at=now();

  UPDATE coaching.exercise SET
    name='Inchworm Walkout',slug='inchworm-walkout',
    description='From standing, hinge or bend the knees as needed and place the hands on a nonslip floor. Walk the hands forward to a controlled high plank. Use the selected exact return: walk the hands back while the feet stay at the start, or keep the hands planted while the feet step toward them. Stand under control to complete one repetition. Do not add a push-up or jump.',
    instructions='Use one exact variant for the whole prescription. Verify surface traction, clearance or traveling lane, standing-to-floor tolerance, hinge or knee strategy, wrist and shoulder support, and cumulative hand-support dose. Walk the hands in small controlled steps to a supported high plank. Complete only the declared hands-back or feet-in return and stand to count one repetition. Stop for pain, radiating symptoms, numbness, tingling, weakness, chest or breathing concern, dizziness, slipping, support loss, wrong sequence, unsafe traffic, or participant request.',
    skill_level=NULL,age_min=NULL,age_max=NULL,
    default_sets=1,default_reps=4,default_work_seconds=60,
    default_rest_seconds=30,tempo='controlled eight to twenty seconds per complete repetition',
    load_note='Track exact variant, complete repetitions, hand and foot steps, travel distance, high-plank and wrist/shoulder support seconds, standing-floor transitions, hinge and knee strategy, tempo, rests, invalid or partial attempts, first fault, symptoms, stops, substitutions, actual duration, and downstream hand-support loading.',
    est_seconds_per_set=120,is_published=FALSE,archived=FALSE,
    card_summary='Standing-to-high-plank hand walk with an explicit stationary hands-back or traveling feet-in return and no push-up.',
    coach_language='Declare the return mode, inspect traction and lane, verify standing-floor and upper-limb support tolerance, cue small hand steps and a controlled high plank, count only the exact return and standing finish, track actual support and duration, and stop at first symptom, support, traction, traffic, sequence, or budget fault.',
    athlete_language='Walk your hands to a strong high plank, use the named return, and stand to finish one rep. No push-up. Stop for pain, tingling, dizziness, slipping, or loss of control.',
    programming_logic=jsonb_build_object(
      'selectionStatus','canonical_variant_required','selectable',TRUE,
      'canonicalDefinitionId',canonical_definition,
      'exactVariantIds',to_jsonb(active_variant_ids),
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'exerciseDifficultyDescribesTaskOnly',TRUE,
      'selectionInputs',jsonb_build_array('workout purpose','exact return mode','floor transition hinge and knee strategy','wrist shoulder elbow and high-plank support','surface station or lane traffic and sightline','dose actual duration cumulative hand-support and downstream loading','coach scope and emergency route'),
      'substitutionRevalidation',jsonb_build_array('identity and return mode','base contacts support height and added actions','restrictions and symptoms','purpose and dose','fatigue impact and downstream budgets','duration','surface lane logistics','persistence','coach rendering','athlete rendering'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    scalable_variables=ARRAY['exact_variant','complete_repetitions','hand_step_size','hand_steps','foot_steps','travel_distance','hinge_range','knee_accommodation','tempo','brief_plank_pause_seconds','rest_seconds','sets']::TEXT[],
    movement_family='Standing-to-High-Plank Hand Walk',
    primary_phase_key=NULL,phase_subrole=NULL,primary_order_slot=NULL,
    movement_requirements=jsonb_build_object(
      'selectable',TRUE,'canonicalVariantRequired',TRUE,
      'impactLevel',0,'balanceDemand','dynamic_standing_floor_transition_and_hand_support',
      'breathingDemand','comfortable_no_breath_hold',
      'actions',jsonb_build_array('standing_hip_hinge_or_knee_accommodation','alternating_hand_steps_to_high_plank','trunk_anti_extension','variant_specific_hand_back_or_feet_in_return','controlled_standing_finish'),
      'planes',jsonb_build_array('sagittal_primary','multiplanar_stabilization'),
      'mustMaintain',jsonb_build_array('surface_traction','small_controlled_hand_steps','supported_high_plank','declared_return_mode','no_push_up_or_jump','controlled_standing_finish','communication'),
      'mustNotAdd',jsonb_build_array('push_up','jump','single_leg_base','raised_or_unstable_support','external_load','lunge_or_rotation','down_dog_or_pike','plank_only_endpoint'),
      'validCompletion','one controlled standing-to-high-plank-to-declared-return-to-standing cycle without added action support loss traction loss wrong sequence or stop rule'),
    coaching_execution=jsonb_build_object(
      'qualityGates',jsonb_build_array('variant_and_no_push_up_exact','surface_station_or_lane_safe','standing_floor_transition_controlled','hand_steps_small_and_supported','high_plank_controlled','return_mode_exact','standing_finish_controlled','no_stop_symptoms'),
      'stopRules',jsonb_build_array('sharp_increasing_radiating_or_unfamiliar_pain','neurologic_or_bowel_or_bladder_change','chest_or_breathing_concern','dizziness_faintness_nausea_visual_change_or_disorientation','traction_or_hand_support_loss','uncontrolled_plank_or_return','wrong_task_push_up_jump_or_return_mode','unsafe_lane_traffic_or_exit','budget_or_duration_reached'),
      'persistence',jsonb_build_array('definition_card_and_variant_version','planned_and_actual_repetitions_steps_distance_and_support_seconds','hinge_knee_tempo_pause_rest_and_sets','valid_invalid_partial_and_symptom_limited_attempts','first_fault_symptoms_and_stop_reason','duration_station_lane_and_surface','substitution and revalidation','coach and athlete rendering version')),
    pairing_logic=jsonb_build_object(
      'sameSessionBudget',jsonb_build_array('complete_repetitions','hand_steps','foot_steps','travel_distance','high_plank_seconds','wrist_and_shoulder_support_seconds','standing_floor_transitions','hinge_range_exposure','technical_fatigue','downstream_hand_support','impact_contacts'),
      'avoidAutomaticPairingWith',jsonb_build_array('fatiguing_tumbling_or_hand_support','high_wrist_grip_pressing_or_overhead_volume','posterior_chain_end_range_when_control_is_reduced','same_session_trunk_loading_that_exceeds_budget'),
      'revalidateAfterSubstitution',TRUE),
    media_library=jsonb_build_object(
      'candidate_video_ids',jsonb_build_array('BXRL_AC8om4','ttxQ_UPOwWc','aFkv2m9FTGs','-FW8DNKsAh8','ZvhfaibmpwU'),
      'reviewState','oembed_metadata_only_candidate_quarantine',
      'playbackVariantReturnPushUpOmissionSequenceCaptionsAccessibilityQualitySafetyAndApprovalVerified',FALSE,
      'humanReviewRequired',TRUE),
    programming_kind='exercise',linked_skill_id=NULL,why_publish_ready=FALSE,
    updated_at=now()
  WHERE id=29;

  UPDATE coaching.exercise_safety_profile SET
    risk_level=2,impact_level=0,minimum_age_recommended=NULL,
    minimum_skill_level=NULL,requires_spotting=FALSE,
    requires_coach_supervision='recommended',
    minimum_prerequisite_notes='Readiness is evaluated from standing-to-floor transition, hinge or knee accommodation, bilateral hand wrist elbow shoulder and high-plank support, surface traction, selected return comprehension, station or lane safety, current restrictions and symptoms, workout dose, and downstream loading; never from participant classification.',
    readiness_checks=ARRAY[
      'Confirm the exact stationary hands-back or traveling feet-in variant, no-push-up boundary, floor traction, clean hand-contact area, clearance or marked lane, sightline, communication, and safe exit.',
      'Confirm standing-to-floor and floor-to-standing control, hinge or knee accommodation, weight-bearing wrist elbow shoulder and hand tolerance, and controlled brief high plank.',
      'Confirm the participant can name the selected return, count the controlled standing finish, keep hand steps small, and use the stop signal.',
      'Review cumulative repetitions, hand and foot steps, distance, plank and support seconds, standing-floor transitions, technical fatigue, later tumbling pressing grip wrist shoulder trunk and posterior-chain loading.'
    ]::TEXT[],
    stop_signs=ARRAY[
      'Sharp increasing radiating or unfamiliar spine shoulder elbow wrist hand hip knee ankle hamstring or other pain or participant stop request.',
      'Numbness tingling weakness saddle sensory change bowel or bladder change or another neurologic sign.',
      'Chest or breathing concern dizziness faintness nausea visual change disorientation or inability to communicate.',
      'Hand or foot slipping elbow collapse shoulder support loss uncontrolled lumbar sag hip hike rotation head drop or unsafe standing return.',
      'Wrong return mode added push-up jump excessive reach traffic conflict or incomplete standing finish cannot be corrected safely.',
      'Floor station lane clearance sightline hygiene communication duration downstream budget or safe exit becomes inadequate.'
    ]::TEXT[],
    contraindications=ARRAY[
      'Current symptom trauma procedure or clinical restriction conflicts with floor transition hinge hand support high plank or standing return.',
      'No safe nonslip floor clean hand area clearance station or traveling lane coach sightline communication or exit.',
      'The intended service is diagnosis treatment injury management readiness clearance manual assistance assessment or another exercise identity.'
    ]::TEXT[],
    common_substitutions=ARRAY[
      'Use Plank Hold only when removing standing transitions and hand steps fits the changed purpose and all checks are rerun.',
      'Use a separately authored raised-hand or non-hand-support alternative when floor access or wrist shoulder support is unsuitable.',
      'Use Inchworm to World''s Greatest Stretch Plank to Down Dog or Bear Crawl only when their distinct added actions base sequence purpose and dose fit and all checks are rerun.',
      'Do not silently change return mode support height or add a push-up jump lunge rotation pike load or unstable surface.'
    ]::TEXT[]
  WHERE exercise_id=29;

  UPDATE coaching.exercise_score_v1 SET
    technical_complexity=34,absolute_load_demand=26,
    coordination_demand=34,impact=1,supervision_demand=22,
    base_overall_difficulty=greatest(34,26),
    legacy_scores=coalesce(legacy_scores,'{}'::JSONB)||jsonb_build_object(
      'candidateReassessment',migration_key,
      'projectionScope','maximum of two exact Inchworm return-mode variants',
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'variantScores',jsonb_build_object(
        'stationaryHandReturn',jsonb_build_object('complexity',30,'physicalDifficulty',24,'overall',30),
        'travelingFeetInReturn',jsonb_build_object('complexity',34,'physicalDifficulty',26,'overall',34)),
      'exerciseScoresDescribeTaskOnly',TRUE,'independentCalibrationRequired',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    migration_confidence=60,human_review_status='queued',reviewed_by=NULL,
    reviewed_at=NULL,
    review_notes='Research-informed candidate reassessment only. Scores describe exercise complexity and physical difficulty, not a participant. Two-variant identity, anatomy, loading, and independent calibration remain required.',
    updated_at=now()
  WHERE exercise_id=29;

  UPDATE coaching.exercise_difficulty_profile SET
    technical=3.4,complexity=3.4,load=2.6,overall=3.4,
    recommended_age_min=NULL,recommended_age_max=NULL,attention_demand='moderate',
    notes='Candidate projection uses the harder traveling feet-in exact variant. Stationary is 30/24/30 and traveling is 34/26/34 for exercise complexity physical difficulty and derived maximum. These are task scores, not participant classification.',
    source='canonical_research_candidate',updated_at=now()
  WHERE exercise_id=29;

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  VALUES(canonical_definition,1,2,'2.0.0',migration_key,'quarantined',
    jsonb_build_object(
      'identity',jsonb_build_object('passed',TRUE,'identityKey','standing_to_high_plank_hand_walk','activeVariants',2,'archivedSourceSkeletons',1,'returnModesExplicit',TRUE,'directDuplicateDefinitions',0),
      'taxonomy',jsonb_build_object('passed',TRUE,'controlledTerms',TRUE,'movementPatterns',jsonb_build_array('hinge','brace','locomote'),'bodyRegions',14,'equipment',jsonb_build_array('none')),
      'anatomy',jsonb_build_object('passed',TRUE,'musclesJointsActionsPlanesLateralityContactsAndPhaseSequence',TRUE),
      'difficulty',jsonb_build_object('passed',TRUE,'model','max_exercise_complexity_physical_difficulty','variantVectors',jsonb_build_array('30/24/30','34/26/34'),'participantClassificationAbsent',TRUE,'independentCalibrationRequired',TRUE),
      'loadFatigueRecovery',jsonb_build_object('passed',TRUE,'actualRepetitionsStepsDistancePlankSupportTransitionsRangeFaultsAndDownstreamExposureTracked',TRUE,'impactNone',TRUE,'recoveryIsPlanningEstimate',TRUE),
      'constraints',jsonb_build_object('passed',TRUE,'floorTransitionUpperLimbSupportHingeHighPlankTractionStationLaneTrafficSymptomsRestrictionsScopeAndExit',TRUE),
      'delivery',jsonb_build_object('passed',TRUE,'profiles',4,'prepareAndMovementIntelligence',TRUE,'durationDoseRestStationLaneAndSubstitutionRevalidation',TRUE),
      'instructions',jsonb_build_object('passed',TRUE,'athleteCoachAccessibilityAndSupportOperations',TRUE,'returnModeNoPushUpTractionSupportSequenceCountStopsAndScope',TRUE),
      'research',jsonb_build_object('passed',TRUE,'sections',16,'registryVersion',research_version,'directSourcesDoNotCreateUniversalClaims',TRUE),
      'media',jsonb_build_object('passed',FALSE,'candidateCount',5,'currentOEmbedMetadataHealthy',TRUE,'playbackReviewed',FALSE,'exactVariantsReviewed',FALSE,'captionsAccessibilityQualitySafetyAndApprovalReviewed',FALSE),
      'relationships',jsonb_build_object('passed',FALSE,'reviewOnly',5,'approved',0,'automaticSubstitution',FALSE),
      'calibration',jsonb_build_object('passed',FALSE,'reviewOnly',4,'approved',0),
      'alternates',jsonb_build_object('passed',TRUE,'assessments',20,'exactVariants',2,'supportAndActionChangingVariantsQuarantined',TRUE),
      'generationSupport',jsonb_build_object('passed',TRUE,'selectionConstraints',TRUE,'cumulativeFatigueAndImpactBudgets',TRUE,'duration',TRUE,'equipmentSurfaceStationLane',TRUE,'substitutionRevalidation',TRUE,'renderingAndPersistence',TRUE),
      'publication',jsonb_build_object('passed',FALSE,'reviewer',NULL,'approver',NULL)),
    jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01','message','A qualified human must watch all five candidates in full and verify playback exact stationary or traveling return mode standing hand-walk high-plank return and standing sequence no added push-up or jump captions accessibility cue quality safety conflicts reviewer timestamp card version and approval rationale.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','A qualified coach must approve or reject every stationary traveling Plank Hold World''s Greatest Stretch and Down Dog relationship; no automatic substitution between distinct return modes static holds added actions or wave sequences is authorized.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','An independent qualified reviewer must calibrate stationary 30/24 and traveling 34/26 exercise complexity and physical difficulty. Scores do not classify a participant or create an age or capability level.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','A qualified reviewer and separate approver must complete content review before publication. Two-variant identity anatomy support traction lane dose stop scope accessibility persistence and support rules remain quarantined.')),
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
        AND movement_patterns=ARRAY['hinge','brace','locomote']::TEXT[]
        AND body_regions=ARRAY['full_body','core','spine','shoulder','scapula','elbow','wrist','hand','hip','knee','hamstrings','ankle','foot','calf']::TEXT[]
        AND anatomy_json<>'{}'::JSONB AND environment_json<>'{}'::JSONB
        AND population_json<>'{}'::JSONB AND athlete_support_json<>'{}'::JSONB
        AND coach_support_json<>'{}'::JSONB AND support_operations_json<>'{}'::JSONB
        AND provenance_json->>'approvalsCreated'='false')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source_variant AND status='archived'
        AND requirements_json->>'representation'='superseded_source_skeleton')
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(active_variant_ids) AND definition_id=canonical_definition
        AND status='review' AND difficulty_json->>'scoresDescribeExerciseTaskOnly'='true'
        AND (difficulty_json->>'baseOverallDifficulty')::INT=greatest(
          (difficulty_json->>'technicalComplexity')::INT,
          (difficulty_json->>'absoluteLoadDemand')::INT))<>2
    OR (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=ANY(active_variant_ids) AND status='review'
        AND equipment_required=ARRAY['none']::TEXT[]
        AND time_model_json<>'{}'::JSONB AND dose_scaling_json<>'{}'::JSONB
        AND measurement_json<>'{}'::JSONB AND support_prompts_json<>'{}'::JSONB)<>4 THEN
    RAISE EXCEPTION '% canonical definition variant or profile assertion failed',migration_key;
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
      WHERE from_variant_id=ANY(active_variant_ids)
        AND review_status='review' AND reviewed_by IS NULL)<>5
    OR (SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(active_variant_ids)
        AND status='review' AND reviewed_by IS NULL AND reviewed_at IS NULL)<>4
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=canonical_definition
        AND decision='distinct_exercises' AND reviewed_by IS NULL)<>4
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=canonical_definition AND card_version=2
        AND status='quarantined' AND human_review_required IS TRUE
        AND jsonb_array_length(blocking_issues_json)=4) THEN
    RAISE EXCEPTION '% candidate research graph calibration identity or packet assertion failed',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition AND (status='published' OR approved_video_url IS NOT NULL
        OR reviewed_by IS NOT NULL OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_section_evidence_v1
      WHERE definition_id=canonical_definition AND review_status='reviewed')
    OR EXISTS(SELECT 1 FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=canonical_definition
        AND (review_status='approved' OR exact_variant_match IS NOT NULL
          OR reviewer_user_id IS NOT NULL OR reviewed_at IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1
      WHERE from_variant_id=ANY(active_variant_ids) AND review_status='approved')
    OR EXISTS(SELECT 1 FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(active_variant_ids) AND status='approved')
    OR EXISTS(SELECT 1 FROM coaching.exercise
      WHERE id=29 AND (is_published IS TRUE OR skill_level IS NOT NULL
        OR age_min IS NOT NULL OR age_max IS NOT NULL OR linked_skill_id IS NOT NULL)) THEN
    RAISE EXCEPTION '% fabricated approval publication or participant classification detected',migration_key;
  END IF;
END
$migration$;
