-- Source 46: replace the skeletal Short-Foot Drill card with exact target-foot
-- arch-shortening variants. Evidence, media, graph, calibration, content, and
-- publication authority stay human-only. Difficulty describes the exercise
-- task, never participant level, age, readiness, or proficiency.
DO $migration$
DECLARE
  migration_key CONSTANT TEXT := '522_coaching_short_foot_drill_identity_and_family_audit_hardening';
  research_version CONSTANT TEXT := '2026-08-09.113';
  canonical_definition UUID; source_variant UUID; seated_variant UUID; standing_variant UUID; wall_variant UUID; active_variant_ids UUID[]; all_owned_variant_ids UUID[]; toe_yoga_definition UUID; toe_yoga_variant UUID; tripod_shift_definition UUID; tripod_shift_variant UUID; big_toe_press_definition UUID; big_toe_press_variant UUID; short_foot_calf_definition UUID; short_foot_calf_variant UUID; single_leg_balance_definition UUID; single_leg_balance_variant UUID;
  protected_count INTEGER;
BEGIN
  SELECT id INTO canonical_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=46; SELECT id INTO source_variant FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='baseline'; SELECT coalesce((SELECT id FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='standing-hands-free-single-target-foot-dome-hold-return'),gen_random_uuid()) INTO standing_variant; SELECT coalesce((SELECT id FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='standing-wall-touch-single-target-foot-dome-hold-return'),gen_random_uuid()) INTO wall_variant; SELECT coalesce((SELECT id FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='seated-bench-single-target-foot-dome-hold-return'),gen_random_uuid()) INTO seated_variant;
  SELECT id INTO toe_yoga_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=45; SELECT id INTO toe_yoga_variant FROM coaching.exercise_variant_v1 WHERE definition_id=toe_yoga_definition AND variant_key='standing-hands-free-single-target-foot-cycle'; SELECT id INTO tripod_shift_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=47; SELECT id INTO tripod_shift_variant FROM coaching.exercise_variant_v1 WHERE definition_id=tripod_shift_definition AND variant_key='baseline'; SELECT id INTO big_toe_press_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=848; SELECT id INTO big_toe_press_variant FROM coaching.exercise_variant_v1 WHERE definition_id=big_toe_press_definition AND variant_key='baseline'; SELECT id INTO short_foot_calf_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=877; SELECT id INTO short_foot_calf_variant FROM coaching.exercise_variant_v1 WHERE definition_id=short_foot_calf_definition AND variant_key='baseline'; SELECT id INTO single_leg_balance_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=227; SELECT id INTO single_leg_balance_variant FROM coaching.exercise_variant_v1 WHERE definition_id=single_leg_balance_definition AND variant_key='unsupported-eyes-open'; active_variant_ids:=ARRAY[standing_variant,wall_variant,seated_variant]; all_owned_variant_ids:=ARRAY[source_variant,standing_variant,wall_variant,seated_variant];
  IF NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=46 AND facility_id=1)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 WHERE id=canonical_definition AND facility_id=1 AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=46 AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id=source_variant AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id=toe_yoga_variant AND definition_id=toe_yoga_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id=tripod_shift_variant AND definition_id=tripod_shift_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id=big_toe_press_variant AND definition_id=big_toe_press_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id=short_foot_calf_variant AND definition_id=short_foot_calf_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id=single_leg_balance_variant AND definition_id=single_leg_balance_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1 WHERE exercise_id=46)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_difficulty_profile WHERE exercise_id=46)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_safety_profile WHERE exercise_id=46) THEN
    RAISE EXCEPTION '% prerequisite source or neighbor rows are missing',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id=ANY(active_variant_ids) AND definition_id<>canonical_definition)
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 WHERE slug='short-foot-drill' AND id<>canonical_definition) THEN
    RAISE EXCEPTION '% working UUID or slug already belongs to another card',migration_key;
  END IF;

  SELECT coalesce(sum(n),0) INTO protected_count FROM (
    SELECT count(*) n FROM coaching.exercise_definition_v1 WHERE id=canonical_definition
      AND (status IN('published','deprecated') OR reviewed_by IS NOT NULL OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)
    UNION ALL SELECT count(*) FROM coaching.exercise_section_evidence_v1 WHERE definition_id=canonical_definition
      AND (reviewer_user_id IS NOT NULL OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_media_candidate_v1 WHERE definition_id=canonical_definition
      AND (reviewer_user_id IS NOT NULL OR reviewed_at IS NOT NULL OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_alternate_assessment_v1 WHERE definition_id=canonical_definition
      AND (reviewer_user_id IS NOT NULL OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_card_review_v1 WHERE definition_id=canonical_definition
    UNION ALL SELECT count(*) FROM coaching.exercise_card_revision_v1 WHERE definition_id=canonical_definition
    UNION ALL SELECT count(*) FROM coaching.exercise_media_review_v1 WHERE definition_id=canonical_definition
    UNION ALL SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=ANY(all_owned_variant_ids) OR to_variant_id=ANY(all_owned_variant_ids))
        AND (reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL OR review_status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(all_owned_variant_ids) AND (reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL OR status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=canonical_definition
        AND (reviewed_by IS NOT NULL OR resolution_source='human_review')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_v1 WHERE exercise_id=46
      AND (human_review_status<>'queued' OR reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL)
  ) protected;
  IF protected_count<>0 THEN
    RAISE EXCEPTION '% refuses to overwrite % human-reviewed records',migration_key,protected_count;
  END IF;

  UPDATE coaching.exercise_section_evidence_v1 SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now()
    WHERE definition_id=canonical_definition AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_media_candidate_v1 SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
    exact_variant_match=NULL,demonstration_quality_score=NULL,updated_at=now()
    WHERE definition_id=canonical_definition AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_alternate_assessment_v1 SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now()
    WHERE definition_id=canonical_definition AND review_status='candidate' AND reviewer_user_id IS NULL;
  DELETE FROM coaching.exercise_relationship_v1 WHERE
    (from_variant_id=ANY(all_owned_variant_ids) OR to_variant_id=ANY(all_owned_variant_ids))
    AND reviewed_by IS NULL AND review_status<>'approved';
  DELETE FROM coaching.exercise_score_calibration_v1 WHERE variant_id=ANY(all_owned_variant_ids)
    AND reviewed_by IS NULL AND status<>'approved';

  UPDATE coaching.exercise_definition_source_v1 SET source_kind='legacy_migration',
    provenance_json=jsonb_build_object(
      'source_table','coaching.exercise','migration',migration_key,'researchVersion',research_version,
      'sourceDisposition','canonical_short_foot_source_reauthored',
      'identityContract','one_target_foot_arch_shortening_submaximal_isometric_hold_controlled_return',
      'representedBySelectableSourceVariants',to_jsonb(active_variant_ids),
      'exerciseDifficultyDescribesTaskOnly',TRUE,'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
    WHERE legacy_exercise_id=46 AND definition_id=canonical_definition;

  UPDATE coaching.exercise_delivery_profile_v1 SET status='archived',updated_at=now() WHERE variant_id=source_variant;
  UPDATE coaching.exercise_variant_v1 SET variant_key='superseded-source-46-skeleton',
    display_name='Short-Foot Drill Legacy Skeleton — Source 46',modifier_keys='{}'::TEXT[],difficulty_json='{}'::JSONB,status='archived',
    requirements_json=jsonb_build_object('selectable',FALSE,'representation','superseded_source_skeleton','sourceLegacyExerciseId',46,
      'archiveReason','The prior row collapses standing and seated support and lacks an exact target-foot start, prescribed isometric hold, return endpoint, side-specific count, anatomy, loading, fatigue, constraints, duration, substitution, persistence, and review contract.',
      'replacementVariantIds',to_jsonb(active_variant_ids),'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    load_profile_json=jsonb_build_object('selectable',FALSE),fatigue_profile_json=jsonb_build_object('selectable',FALSE),
    programming_profile_json=jsonb_build_object('selectionStatus','superseded_source_skeleton','selectable',FALSE,'publicationQuarantined',TRUE),updated_at=now()
    WHERE id=source_variant;

  INSERT INTO coaching.exercise_definition_v1(
    id,facility_id,legacy_exercise_id,slug,canonical_name,display_name,aliases,description,family_key,
    schema_version,card_version,status,content_confidence,scoring_confidence,media_confidence,
    movement_patterns,body_regions,required_equipment,optional_equipment,environment_json,population_json,
    provenance_json,approved_video_url,reviewed_by,approved_by,last_reviewed_at,anatomy_json,
    athlete_support_json,coach_support_json,support_operations_json)
  VALUES(
    canonical_definition,1,46,'short-foot-drill','Short-Foot Drill','Short-Foot Drill',
    ARRAY['Short Foot Drill','Short-Foot Exercise','Short Foot Exercise','Foot Doming','Doming Exercise','Janda Short Foot']::TEXT[],
    'Place one target foot flat on a clean dry nonslip foot-safe surface with its heel, first metatarsal head, fifth metatarsal head, and relaxed long toes in contact. Without curling or lifting the toes or rotating the ankle, draw the metatarsal heads toward the heel enough to shorten the foot and raise the medial arch. Maintain the prescribed comfortable submaximal isometric hold, then relax with control to the same supported start. That dome, prescribed hold, and complete return on one target foot is one repetition. Record left- and right-foot repetitions and actual hold seconds separately. Standing hands-free, standing light wall-touch, and seated stable-bench support are explicit variants. Comfortable submaximal range and effort, hold duration, breathing, repetitions, sets, rest, side order, foot covering, and delivery context are annotations. Simultaneous feet, toe extension or flexion, hallux pressing, whole-foot weight shifts, dynamic-only or eccentric-only action, manual assistance, resistance, biofeedback, unstable or single-leg support, heel raise, maximal assessment, or clinical treatment require a separately reviewed variant or definition.',
    'short_foot_arch_doming','2.0.0',2,'review',92,63,50,
    ARRAY['brace']::TEXT[],ARRAY['foot','ankle','calf','knee','hip','core']::TEXT[],ARRAY['none']::TEXT[],ARRAY['wall','bench']::TEXT[],
    jsonb_build_object('surface','clean dry level stable nonslip foot-safe floor suitable for facility barefoot or approved sock policy','space','one seated or standing visible foot-control station with clear entry and exit','stationCapacity',1,
      'requiredEquipmentByVariant',jsonb_build_object('standingHandsFree','none','standingWallTouch','wall','seatedBench','bench'),
      'hygiene','follow facility barefoot surface cleaning skin-integrity and shared-station policy','coachSightline','top and front-quarter views of toes metatarsal heads heel arch ankle knee support breathing and symptoms',
      'inspection',jsonb_build_array('surface traction cleanliness temperature debris and skin-contact suitability','wall stability and contact area','bench stability height and foot placement','toe visibility and approved foot covering','space traffic communication exit and emergency route'),
      'changeRule','Any support target side weight bearing hand support assistance resistance feedback action contraction dose symptom or downstream-demand change requires revalidation.'),
    jsonb_build_object('exerciseCardDoesNotClassifyParticipants',TRUE,'readinessIsWorkoutInput',TRUE,
      'selectionPrerequisites',jsonb_build_array('safe clean visible foot-contact station','comfortable target-foot heel forefoot and long-toe contact','comfortable active arch shortening without toe curl lift or ankle rotation','safe selected standing or seated support','understands dome hold return side-specific count and stop signal','same-session foot toe calf balance running landing jumping and lower-body budgets fit'),
      'excludeOrEscalate',jsonb_build_array('recent significant trauma surgery or procedure without applicable clearance','sharp increasing night post-trauma or unfamiliar pain','new numbness tingling weakness circulation change skin breakdown or loss of control','foot toe ankle calf knee hip or back symptoms preventing exact task','dizziness faintness nausea visual change chest pain unusual breathlessness disorientation or inability to communicate','clinical restriction conflicting with the exact task','unsafe surface hygiene visibility wall bench space traffic communication or emergency route','participant requests stop'),
      'notEstablishedByEvidence',jsonb_build_array('universal eligibility support effort range hold dose frequency fatigue ceiling recovery progression or outcome','diagnosis treatment prevention correction clearance or clinical threshold','isolated intrinsic-muscle action','guaranteed arch balance gait running jumping landing or injury-prevention transfer','age floor or participant classification')),
    jsonb_build_object('migration',migration_key,'researchVersion',research_version,'canonicalAuthoredFromResearch',TRUE,
      'identityAuthority','Source 46 reauthored around one target-foot metatarsal-head-to-heel arch-shortening hold and controlled return, bounded by direct doming protocols and family comparisons',
      'legacySources',jsonb_build_array(46),'identityContract','one_target_foot_arch_shortening_submaximal_isometric_hold_controlled_return',
      'researchSources',jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC5723035/','https://pmc.ncbi.nlm.nih.gov/articles/PMC7369729/','https://pubmed.ncbi.nlm.nih.gov/38160335/','https://pmc.ncbi.nlm.nih.gov/articles/PMC12703198/','https://pmc.ncbi.nlm.nih.gov/articles/PMC5094843/','https://pubmed.ncbi.nlm.nih.gov/35724360/','https://pubmed.ncbi.nlm.nih.gov/35442981/','https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en'),
      'confidenceBySection',jsonb_build_object('identity',92,'taxonomy',90,'anatomy',88,'difficulty',63,'load',70,'fatigueRecovery',51,'constraints',85,'dosage',55,'instructions',92,'alternates',93,'media',50),
      'unresolvedClaims',jsonb_build_array('universal support effort range hold dose frequency fatigue ceiling recovery progression or outcome','numeric difficulty calibration','standing load and transfer','media playback exact mechanics captions accessibility quality safety and approval','individual symptom interpretation or clinical eligibility'),
      'externalPlaybackVerificationPerformed',FALSE,'oEmbedMetadataChecked',TRUE,'sourceLimitationsExplicit',TRUE,'humanReviewRequired',TRUE,'approvalsCreated',FALSE,'publicationQuarantined',TRUE),
    NULL,NULL,NULL,NULL,
    jsonb_build_object('primaryMuscles',jsonb_build_array('abductor_hallucis','flexor_digitorum_brevis','quadratus_plantae','interossei','lumbricals'),
      'secondaryMuscles',jsonb_build_array('flexor_hallucis_brevis','adductor_hallucis','abductor_digiti_minimi','flexor_hallucis_longus','flexor_digitorum_longus','tibialis_posterior','fibularis_longus'),
      'stabilizers',jsonb_build_array('intrinsic_foot_muscle_system','tibialis_anterior','calf_complex','standing_lower_limb_and_trunk_stabilizers'),
      'joints',jsonb_build_array('first_ray_and_lesser_rays','tarsometatarsal','midfoot','subtalar','metatarsophalangeal','interphalangeal','talocrural_ankle','knee_and_hip_for_standing_support'),
      'jointActions',jsonb_build_array('metatarsal_heads_draw_toward_calcaneus','medial_longitudinal_arch_elevation_and_foot_shortening','submaximal_isometric_arch_hold','controlled_relaxation_to_supported_start','toe_heel_forefoot_ankle_and_limb_stabilization'),
      'planes',jsonb_build_array('sagittal_arch_shortening','frontal_stabilization','transverse_stabilization'),'laterality','one target foot per repetition with left and right exposures recorded separately',
      'supportContacts',jsonb_build_array('target_heel','target_first_metatarsal_head','target_fifth_metatarsal_head','target_relaxed_long_toes','support contacts specified by variant'),
      'sequence',jsonb_build_array('same_supported_long_toe_start','metatarsal_heads_draw_toward_heel_arch_rises','prescribed_submaximal_isometric_hold','controlled_relaxation','same_supported_start_one_target_foot_repetition'),
      'claimsBoundary','Short-foot exercise recruits plantar intrinsic and extrinsic contributors; this card does not establish isolation, diagnosis, treatment, structural correction, readiness, balance, gait, sport, or injury-prevention outcomes.'),
    jsonb_build_object('whyItMatters','Practises shortening and supporting the target-foot arch while the heel, forefoot, and long toes stay quiet.','primaryCue','Keep toes long; draw the ball of the foot toward the heel; lift the arch; hold; relax fully.',
      'secondaryCues',jsonb_build_array('one target foot at a time','use a small comfortable dome','keep heel and toe mounds down','do not curl or lift the toes','keep ankle and knee quiet','breathe through the hold','return to the same start'),
      'expectedSensations',jsonb_build_array('light effort through the sole and inner arch of the target foot','concentration while keeping toes long','steady heel and forefoot pressure'),
      'unexpectedSensations',jsonb_build_array('sharp increasing or unfamiliar foot pain','painful pinching catching or joint irritation','persistent cramping','numbness tingling weakness circulation or skin change','dizziness chest pain or unusual breathlessness'),
      'painGuidance','Stop for sharp, increasing, radiating, neurologic, circulatory, skin, or joint pain. Never force the arch, claw the toes, or chase maximal effort.',
      'selfChecks',jsonb_build_array('heel_first_and_fifth_metatarsal_heads_stay_down','toes_stay_long_and_supported','arch_rises_without_ankle_rotation','prescribed_hold_and_breathing_complete','full_controlled_relaxation_to_same_start','side_specific_count_is_correct','no_stop_symptom'),
      'accessibility',jsonb_build_object('reducedRange','use a smaller comfortable dome','reducedCapacity','use shorter holds fewer repetitions and more rest','balanceSupport','select wall-touch or seated variant and recompute','hearingSupport','visible dome-hold-relax and side cards','visionSupport','clear verbal phases and consented orientation before the set','cognitiveSupport','one cue sequence with rehearsal','manualAssistance','separate candidate variant and not counted as unassisted'),
      'readingLevel','plain_language','localizationKey','exercise.short_foot_drill','mediaAlternatives',jsonb_build_object('captionsRequired',TRUE,'transcriptRequired',TRUE,'stillSequenceRequired',TRUE,'audioDescriptionRequired',TRUE,'requiredAngles',jsonb_build_array('top_oblique','front_oblique'))),
    jsonb_build_object('observationChecklist',jsonb_build_array('station support and target foot are exact and safe','heel forefoot and long toes stay supported','arch shortens without toe curl lift or ankle rotation','prescribed hold and breathing complete','full controlled return occurs','side repetitions hold seconds faults symptoms duration and exit recorded'),
      'faultCorrections',jsonb_build_object('toeCurl','reduce effort and range then cue long relaxed toes','toeLift','reset all contacts before a smaller dome','ankleRotation','reduce range and stabilize ankle and knee','heelOrForefootLift','restore all contacts or end the set','noVisibleDome','rehearse seated with smaller effort; do not force','lostReturn','reduce hold or repetitions and require full relaxation','symptom','stop and follow facility escalation policy'),
      'demonstrationPlan',jsonb_build_array('show exact support and one target side','show supported long-toe start','show dome and prescribed hold','show full controlled relaxation and one-rep count','show common toe-curl and ankle-rotation faults','show stop signal side switch and exit'),
      'groupManagement',jsonb_build_array('one participant per visible station','assign support variant and side order before start','separate wall and bench stations','record actual exposure and first fault','clean and reset shared stations'),
      'modificationDecisionTree',jsonb_build_array('symptom_or_unsafe_station_stop','lost_contacts_or_toe_curl_reduce_effort_range_or_hold','standing_balance_interferes_select_wall_then_seated_after_revalidation','manual_help_resistance_feedback_single_leg_or_dynamic_action_route_to_separate_variant','time_or_budget_shortfall_reduce_dose_or_omit'),
      'doNotUseWhen',jsonb_build_array('clinical assessment treatment clearance or diagnosis is intended','exact support target side mechanics count or stop rules cannot be observed','surface hygiene visibility equipment communication exit or emergency route is inadequate')),
    jsonb_build_object('issueCategories',jsonb_build_array('identity','taxonomy','anatomy','difficulty','load_fatigue_recovery','constraints','delivery','instructions','safety','media','relationships','calibration','persistence','rendering'),
      'supportEscalation',jsonb_build_array('stop task and stabilize participant','follow facility emergency or clinical-referral policy','record observed facts without diagnosis','quarantine conflicting content or media','require qualified review before resumption'),
      'retentionPolicy',jsonb_build_object('persist',jsonb_build_array('definition_variant_profile_card_version','target_side_and_support','planned_and_actual_repetitions_and_hold_seconds','faults_symptoms_duration_stop_substitution_and_exit'),'neverPersistAsExerciseProperty',jsonb_build_array('participant_skill_level','participant_proficiency','participant_age_band')),
      'changeImpactPolicy','Any identity support equipment dose score constraint media relationship or instruction change invalidates dependent selection duration logistics budget substitution persistence and rendering outputs until revalidated.'))
  ON CONFLICT(id) DO UPDATE SET facility_id=EXCLUDED.facility_id,legacy_exercise_id=46,slug=EXCLUDED.slug,
    canonical_name=EXCLUDED.canonical_name,display_name=EXCLUDED.display_name,aliases=EXCLUDED.aliases,description=EXCLUDED.description,
    family_key=EXCLUDED.family_key,schema_version=EXCLUDED.schema_version,card_version=EXCLUDED.card_version,status='review',
    content_confidence=EXCLUDED.content_confidence,scoring_confidence=EXCLUDED.scoring_confidence,media_confidence=EXCLUDED.media_confidence,
    movement_patterns=EXCLUDED.movement_patterns,body_regions=EXCLUDED.body_regions,required_equipment=EXCLUDED.required_equipment,
    optional_equipment=EXCLUDED.optional_equipment,environment_json=EXCLUDED.environment_json,population_json=EXCLUDED.population_json,
    provenance_json=EXCLUDED.provenance_json,approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,last_reviewed_at=NULL,
    anatomy_json=EXCLUDED.anatomy_json,athlete_support_json=EXCLUDED.athlete_support_json,coach_support_json=EXCLUDED.coach_support_json,
    support_operations_json=EXCLUDED.support_operations_json,updated_at=now();

  INSERT INTO coaching.exercise_variant_v1(id,definition_id,variant_key,display_name,modifier_keys,difficulty_json,requirements_json,status,load_profile_json,fatigue_profile_json,programming_profile_json)
  SELECT p.id,canonical_definition,p.variant_key,p.display_name,
    ARRAY['target_side_order','comfortable_submaximal_range','hold_seconds','breathing','repetitions_per_side','sets','rest','effort','approved_foot_covering','delivery_context']::TEXT[],
    jsonb_build_object('technicalComplexity',p.technical,'absoluteLoadDemand',p.physical,'physicalDifficulty',p.physical,'coordinationDemand',p.coordination,
      'supervisionDemand',p.supervision,'failureConsequence',p.failure,'impact',1,'workCapacityDemand',p.work_capacity,
      'baseOverallDifficulty',greatest(p.technical,p.physical),'overallFormula','max(exercise_complexity,physical_difficulty)',
      'exerciseDifficultyDescribesTaskOnly',TRUE,'candidateCalibrationOnly',TRUE,'humanReviewRequired',TRUE),
    jsonb_build_object('selectable',TRUE,'equipment',jsonb_build_array(p.equipment),'base',p.base,'supportContacts',jsonb_build_array(p.support_contacts),'start',p.start_position,
      'action','On one target foot, keep the heel, first and fifth metatarsal heads, and relaxed long toes supported; draw the metatarsal heads toward the heel enough to shorten the foot and raise the arch; maintain the prescribed comfortable submaximal isometric hold; relax with control to the same start.',
      'countingRule','one target-foot dome plus prescribed hold plus full controlled relaxation to the same supported start is one repetition; left and right repetitions and actual hold seconds are recorded separately',
      'validCompletion','target heel first and fifth metatarsal heads and long toes remain supported, arch visibly shortens without toe curl lift or ankle rotation, prescribed hold and breathing complete, full controlled relaxation returns to the same start, support stays exact, and no stop rule occurs',
      'invalidCompletion',jsonb_build_array('toe_curl_claw_grip_or_lift','heel_or_metatarsal_head_lifts','ankle_rotation_or_arch_collapse','hold_or_return_missing','manual_assistance_during_counted_attempt','simultaneous_resisted_biofeedback_unstable_single_leg_dynamic_only_eccentric_only_toe_yoga_press_shift_curl_heel_raise_assessment_or_clinical_task','breath_hold','symptom_stop'),
      'variantBoundaries',jsonb_build_array('support_position','weight_bearing','external_hand_support','target_side','simultaneous_or_single_foot_action','assistance','resistance','feedback','contraction_mode','range','hold','count','clinical_measurement'),
      'clinicalAssessmentOrTreatment',FALSE,'humanReviewRequired',TRUE),'review',
    jsonb_build_object('loadingType',p.loading_type,'externalLoadMethod',p.external_load,'gripDemand',1,'jointStress',p.joint_stress,'spinalLoading',p.spinal_loading,'eccentricStress',3,
      'landingContactsPerRep',0,'handImpactContactsPerRep',0,'impactClass','none','primaryExposure',jsonb_build_array('arch_shortening','submaximal_isometric_arch_hold','intrinsic_and_extrinsic_foot_stabilization','heel_forefoot_and_long_toe_contact','foot_motor_coordination'),
      'tracking',jsonb_build_array('definition_variant_profile_card_version','target_side_support_position','surface_hygiene_wall_bench_foot_covering_station','planned_actual_repetitions_and_hold_seconds_by_side','range_effort_rest','valid_invalid_partial_assisted_symptom_limited_attempts','contact_toe_curl_arch_ankle_knee_body_faults','first_fault','symptoms','duration','overlapping_foot_toe_calf_balance_running_landing_jumping_lower_body_exposure')),
    jsonb_build_object('localMuscleFatigue',p.local_fatigue,'gripFatigue',1,'technicalFatigueSensitivity',p.technical_fatigue,'impactAccumulation',1,'recoveryHours',6,'recoveryRangeHours',jsonb_build_array(2,12),
      'primaryFatigueSites',jsonb_build_array('plantar_intrinsic_foot_muscles','arch_stabilizers','toe_flexor_stabilizers','foot_motor_control'),
      'cumulativeBudget',jsonb_build_object('validRepetitionsPerFoot',36,'isometricHoldSecondsPerFoot',240,'activeWorkSeconds',480,'footToeLoad',18,'technicalSensitivity',p.technical_fatigue,'impact',0),
      'interference',jsonb_build_array('later_priority_balance_running_landing_jumping_or_agility','same_session_foot_toe_calf_or_lower_leg_loading','fatigue_or_cramping_that_changes_contacts_toe_length_arch_ankle_or_knee_control'),
      'recoveryIsPlanningEstimate',TRUE,'tissueThresholdNotEstablished',TRUE),
    jsonb_build_object('trainingStimuli',jsonb_build_array('arch_shortening_control','submaximal_isometric_foot_control','long_toe_and_forefoot_contact'),
      'stimulusDose',jsonb_build_object('sets',jsonb_build_array(1,3),'repetitionsPerSide',jsonb_build_array(4,8),'holdSeconds',jsonb_build_array(3,8),'restSeconds',jsonb_build_array(15,60)),
      'weeklyExposure',jsonb_build_object('minimum',0,'maximumWithoutReview',5,'unit','sessions','contextDependent',TRUE),
      'prerequisites',jsonb_build_array('safe_clean_visible_foot_contact_station','comfortable_target_foot_contacts_and_arch_shortening','selected_support_is_safe','understands_dome_hold_return_side_specific_count_and_stop','same_session_foot_and_priority_budgets_fit'),
      'completionCriteria',jsonb_build_array('one_target_foot_per_repetition','heel_forefoot_and_long_toes_supported','arch_shortens_without_toe_curl_lift_or_ankle_rotation','prescribed_hold_and_breathing','controlled_return_to_same_start','correct_side_specific_count','no_stop_symptom'),
      'sequenceRules',jsonb_build_array('prepare_or_resilience_context_only','record_repetitions_and_hold_seconds_each_side','hold_time_effort_range_breathing_dose_side_order_and_context_are_annotations','do_not_add_simultaneous_assisted_resisted_feedback_single_leg_unstable_dynamic_eccentric_toe_yoga_press_shift_curl_heel_raise_assessment_or_clinical_action_silently'),
      'pairingCompatibility',jsonb_build_object('compatible',jsonb_build_array('low_dose_foot_control_preparation','separate_balance_control_accessory_when_fatigue_fits'),'avoid',jsonb_build_array('fatiguing_dose_before_priority_balance_running_landing_jumping_or_agility','symptom_provoking_foot_work','same_session_foot_budget_exceeded')),
      'uncertaintyPolicy','If target side support action hold symptoms surface hygiene equipment or time is uncertain do not select; clarify or choose a separately validated card.',
      'selectionStatus','review_only_machine_complete','publicationQuarantined',TRUE,'exerciseDifficultyDescribesTaskOnly',TRUE,'approvalsCreated',FALSE)
  FROM (VALUES
    (standing_variant,'standing-hands-free-single-target-foot-dome-hold-return','Standing Hands-Free Single-Target-Foot Short-Foot Drill',44,8,46,11,6,8,'none','standing_both_feet_supported_hands_free_one_target_foot_domes','both feet flat target heel forefoot and toes supported hands free','stand tall with both feet comfortable and flat, knees soft, weight comfortably shared, hands free, and one target foot identified','low_external_load_standing_arch_shortening_isometric','bodyweight standing with both feet supported and no added resistance',9,3,12,32),
    (wall_variant,'standing-wall-touch-single-target-foot-dome-hold-return','Standing Wall-Touch Single-Target-Foot Short-Foot Drill',40,7,42,10,5,7,'wall','standing_both_feet_supported_light_wall_touch_one_target_foot_domes','both feet flat target heel forefoot and toes supported with light wall contact','stand facing a stable wall with both feet comfortable and flat, knees soft, light hand contact that does not unload the feet, and one target foot identified','low_external_load_wall_supported_standing_arch_shortening_isometric','bodyweight standing with light wall balance contact and no added resistance',8,3,11,29),
    (seated_variant,'seated-bench-single-target-foot-dome-hold-return','Seated Bench Single-Target-Foot Short-Foot Drill',36,5,38,9,4,6,'bench','seated_bench_both_feet_supported_one_target_foot_domes','pelvis supported on stable bench both feet flat target heel forefoot and toes supported','sit upright on a stable bench with both feet flat, hips and knees comfortable near right angles, thighs quiet, and one target foot identified','minimal_external_load_seated_arch_shortening_isometric','seated bodyweight with target foot grounded and no added resistance',6,2,9,26)
  ) p(id,variant_key,display_name,technical,physical,coordination,supervision,failure,work_capacity,equipment,base,support_contacts,start_position,loading_type,external_load,joint_stress,spinal_loading,local_fatigue,technical_fatigue)
  ON CONFLICT(id) DO UPDATE SET definition_id=EXCLUDED.definition_id,variant_key=EXCLUDED.variant_key,display_name=EXCLUDED.display_name,
    modifier_keys=EXCLUDED.modifier_keys,difficulty_json=EXCLUDED.difficulty_json,requirements_json=EXCLUDED.requirements_json,status='review',
    load_profile_json=EXCLUDED.load_profile_json,fatigue_profile_json=EXCLUDED.fatigue_profile_json,programming_profile_json=EXCLUDED.programming_profile_json,updated_at=now();

  INSERT INTO coaching.exercise_delivery_profile_v1(
    id,variant_id,profile_key,phase_key,role,purpose,phase_suitability,methodology_alignment,
    objective_relevance_json,dosage_json,quality_gate,stop_rules,coach_instructions,athlete_instructions,
    expected_adaptation,equipment_required,logistics_json,substitution_ids,status,time_model_json,
    dose_scaling_json,measurement_json,support_prompts_json)
  SELECT p.id,p.variant_id,p.profile_key,p.phase_key,'primary',p.purpose,p.phase_suitability,p.methodology_alignment,
    jsonb_build_object('arch_shortening_control',94,'foot_preparation',CASE WHEN p.phase_key='prepare_and_access' THEN 92 ELSE 82 END,
      'standing_control_context',CASE WHEN p.phase_key='resilience' THEN 88 WHEN p.variant_id=standing_variant THEN 76 ELSE 58 END,'low_impact',99,'clinical_treatment',0),
    jsonb_build_object('sets',jsonb_build_array(p.set_min,p.set_max),'repetitionsPerSide',jsonb_build_array(p.rep_min,p.rep_max),
      'holdSeconds',jsonb_build_array(p.hold_min,p.hold_max),'restSeconds',jsonb_build_array(p.rest_min,p.rest_max),
      'targetEffortRpe',jsonb_build_array(p.rpe_min,p.rpe_max),'exampleDoseIsNotUniversal',TRUE,
      'countLeftAndRightSeparately',TRUE,'recordActualHoldSeconds',TRUE,'stopBeforeMotorControlDegrades',TRUE),
    'One target foot keeps heel, first and fifth metatarsal heads, and relaxed long toes supported while the metatarsal heads draw toward the heel, the arch rises through the prescribed submaximal isometric hold, breathing continues, and a controlled relaxation returns to the same start without toe curl, toe lift, ankle rotation, support change, or a stop sign.',
    ARRAY[
      'Sharp, increasing, night, post-trauma, or unfamiliar pain or participant stop request.',
      'Toe, forefoot, arch, foot, ankle, calf, knee, hip, or back symptoms prevent the exact task.',
      'Painful pinching, catching, joint irritation, instability, or cramping that does not resolve after reset.',
      'Numbness, tingling, weakness, altered circulation, skin breakdown, or another neurologic or skin sign.',
      'Dizziness, faintness, nausea, visual change, chest pain, unusual breathlessness, disorientation, or inability to communicate.',
      'The target heel, first metatarsal head, fifth metatarsal head, or relaxed long toes cannot remain supported.',
      'The toes curl, claw, grip, or lift; the ankle rotates; or arch, knee, hip, or trunk control cannot be restored after reducing range, effort, hold, or repetitions.',
      'The support position changes, manual help is required during counted attempts, or the task becomes simultaneous, resisted, instrumented, unstable, single-leg, dynamic-only, eccentric-only, toe yoga, pressing, shifting, curling, heel raising, maximal assessment, or clinical work.',
      'Surface traction, temperature, hygiene, toe visibility, wall, bench, space, traffic, sightline, communication, or emergency route becomes unsafe.',
      'The side-specific repetition, hold-second, active-time, technical-fatigue, local-fatigue, duration, or downstream foot and lower-body budget is reached.'
    ]::TEXT[],
    'Verify the exact card, target side, support variant, visible foot, clean dry nonslip foot-safe surface, wall or bench when required, symptoms, restrictions, planned repetitions and hold seconds by side, available time, and downstream work. Demonstrate supported long-toe start, submaximal dome, prescribed hold with breathing, controlled full relaxation, one-repetition count, side switch, scaling, stop, and exit. Observe contacts, toe curl or lift, ankle rotation, arch action, support, breathing, symptoms, first fault, actual duration, and safe exit. Do not force motion, count assisted attempts as unassisted, diagnose, treat, or imply readiness.',
    'Set one target foot flat. Keep your heel, toe mounds, and long relaxed toes down. Draw the ball of the foot toward your heel, gently lift the arch, hold and breathe, then relax fully. Stop for pain, persistent cramp, tingling, weakness, skin discomfort, dizziness, or lost control.',
    CASE WHEN p.phase_key='resilience'
      THEN 'More repeatable submaximal arch-shortening control in the exact standing hands-free context; no structural, balance, gait, performance, treatment, prevention, or readiness outcome is guaranteed.'
      ELSE 'More consistent low-dose control of the exact target-foot dome, hold, and return during preparation; no structural, treatment, prevention, readiness, balance, gait, or performance outcome is guaranteed.' END,
    ARRAY[p.equipment]::TEXT[],
    jsonb_build_object('stationCapacity',1,'base',p.base,'requiredEquipment',p.equipment,'space','one_clear_visible_foot_station_with_safe_entry_exit',
      'setupSeconds',p.setup_seconds,'coachSightline','top_and_front_quarter','crossTrafficProhibited',TRUE,
      'surfaceHygieneToeVisibilityAndEquipmentInspectionRequired',TRUE,'revalidateAfterAnyChange',TRUE),
    CASE p.variant_id
      WHEN standing_variant THEN ARRAY[wall_variant,seated_variant,toe_yoga_variant,tripod_shift_variant,big_toe_press_variant,short_foot_calf_variant,single_leg_balance_variant]::UUID[]
      WHEN wall_variant THEN ARRAY[standing_variant,seated_variant,toe_yoga_variant,tripod_shift_variant,big_toe_press_variant,short_foot_calf_variant,single_leg_balance_variant]::UUID[]
      ELSE ARRAY[wall_variant,standing_variant,toe_yoga_variant,tripod_shift_variant,big_toe_press_variant,short_foot_calf_variant,single_leg_balance_variant]::UUID[] END,
    'review',
    jsonb_build_object('durationFormula','surface_hygiene_equipment_and_body_setup_seconds + sum(actual_valid_repetitions_by_side * (actual_dome_and_return_seconds + actual_hold_seconds)) + side_switch_seconds + rest_seconds + invalid_partial_assisted_or_symptom_limited_attempt_seconds + substitution_seconds + station_reset_cleaning_and_exit_seconds',
      'secondsPerRepetition',jsonb_build_array(p.hold_min+2,p.hold_max+5),'holdSeconds',jsonb_build_array(p.hold_min,p.hold_max),
      'minimumSeconds',p.minimum_seconds,'typicalSeconds',p.typical_seconds,'maximumSecondsWithoutReview',p.maximum_seconds,
      'includeActualNotPlanned',TRUE,'recomputeAfterSubstitution',TRUE),
    jsonb_build_object('regressionOrder',CASE p.variant_id
        WHEN standing_variant THEN jsonb_build_array('reduce_repetitions','reduce_effort_and_range','shorten_hold','increase_rest','select_wall_touch_variant','select_seated_variant','end_set')
        WHEN wall_variant THEN jsonb_build_array('reduce_repetitions','reduce_effort_and_range','shorten_hold','increase_rest','select_seated_variant','end_set')
        ELSE jsonb_build_array('reduce_repetitions','reduce_effort_and_range','shorten_hold','increase_rest','end_set','route_manual_help_to_separate_variant_review') END,
      'progressionOrder',CASE p.variant_id
        WHEN seated_variant THEN jsonb_build_array('complete_clean_repetitions','increase_hold_or_repetitions_within_profile','select_wall_touch_variant','select_standing_hands_free_after_full_revalidation')
        WHEN wall_variant THEN jsonb_build_array('complete_clean_repetitions','increase_hold_or_repetitions_within_profile','select_standing_hands_free_after_full_revalidation')
        ELSE jsonb_build_array('complete_clean_repetitions','increase_hold_or_repetitions_within_profile','increase_sets_within_profile','select_separately_reviewed_single_leg_resisted_or_feedback_variant_after_full_revalidation') END,
      'neverScaleByForcingArchClawingToesCountingAssistanceIgnoringSymptomsOrChangingTaskSilently',TRUE),
    jsonb_build_object('record',jsonb_build_array('definition_variant_profile_card_version','target_side_order_support_position','surface_hygiene_wall_bench_foot_covering_station','planned_actual_repetitions_and_hold_seconds_by_side','range_effort_rest','valid_invalid_partial_assisted_symptom_limited_attempts','contact_toe_curl_arch_ankle_knee_body_faults','first_fault','symptoms_stop_reason','active_work_seconds','duration','substitution','cleaning_station_reset_exit'),
      'validUnit','one_target_foot_dome_prescribed_hold_and_controlled_return_to_same_supported_start','invalidUnitsTrackedSeparately',TRUE,'leftAndRightNeverMerged',TRUE,
      'doNotConvertToSimultaneousFeetToeExtensionToeFlexionHalluxPressWeightShiftHeelRaiseBalanceTimeMaximalTestClinicalScoreOrSportAction',TRUE),
    jsonb_build_object('athlete',jsonb_build_array('one_target_foot','heel_toe_mounds_and_long_toes_down','draw_ball_toward_heel','arch_up','hold_and_breathe','relax_fully','count_each_side','stop_for_unexpected_symptoms'),
      'coach',jsonb_build_array('verify_identity_target_side_and_support','inspect_surface_hygiene_visibility_wall_bench_station','observe_contacts_toes_ankle_arch_hold_return_and_count','record_actual_exposure_and_first_fault','do_not_count_assisted_attempts_as_unassisted','revalidate_every_substitution'),
      'accessibility',jsonb_build_array('top_and_front_quarter_visual','written_dome_hold_relax_sequence','smaller_range_shorter_holds_fewer_repetitions_more_rest','visible_phase_side_count_cards','captions_transcript_still_images_or_live_instruction'),
      'escalation',jsonb_build_array('stop','stabilize_and_exit_station','follow_facility_policy','record_observed_facts','do_not_resume_without_reassessment'))
  FROM (VALUES
    ('be0aad0a-2e20-462d-997b-607948aa074e'::UUID,standing_variant,'prepare-standing-hands-free-short-foot','prepare_and_access',94,92,'Use the exact standing hands-free dome, hold, and return as low-dose preparation only when standing control and later foot or sport budgets fit.',1,2,4,6,3,5,15,40,1,3,'none','standing_hands_free_visible_foot_station',20,65,145,300),
    ('c52b13a4-a1f8-4e3c-aae4-25301d8dd3cd'::UUID,standing_variant,'resilience-standing-hands-free-short-foot','resilience',88,88,'Use the exact standing hands-free repetition as a foot-control resilience exposure only when arch control remains the task and fatigue is not the goal.',1,3,4,8,3,8,20,60,2,4,'none','standing_hands_free_visible_foot_station',20,85,230,480),
    ('c8e44c4a-4477-401b-b1a7-06ec6c650225'::UUID,wall_variant,'prepare-standing-wall-touch-short-foot','prepare_and_access',94,92,'Use the exact light wall-touch standing repetition when balance support best preserves the arch-shortening task.',1,2,4,6,3,5,15,45,1,3,'wall','standing_wall_touch_visible_foot_station',25,75,165,330),
    ('579d0859-345f-45f5-861e-e48faed851ec'::UUID,seated_variant,'prepare-seated-bench-short-foot','prepare_and_access',96,94,'Use the exact seated repetition when minimizing whole-body balance demand best preserves target-foot arch control.',1,2,4,6,3,5,15,45,1,3,'bench','seated_bench_visible_foot_station',25,75,165,330)
  ) p(id,variant_id,profile_key,phase_key,phase_suitability,methodology_alignment,purpose,set_min,set_max,rep_min,rep_max,hold_min,hold_max,rest_min,rest_max,rpe_min,rpe_max,equipment,base,setup_seconds,minimum_seconds,typical_seconds,maximum_seconds)
  ON CONFLICT(id) DO UPDATE SET variant_id=EXCLUDED.variant_id,profile_key=EXCLUDED.profile_key,phase_key=EXCLUDED.phase_key,role=EXCLUDED.role,
    purpose=EXCLUDED.purpose,phase_suitability=EXCLUDED.phase_suitability,methodology_alignment=EXCLUDED.methodology_alignment,
    objective_relevance_json=EXCLUDED.objective_relevance_json,dosage_json=EXCLUDED.dosage_json,quality_gate=EXCLUDED.quality_gate,
    stop_rules=EXCLUDED.stop_rules,coach_instructions=EXCLUDED.coach_instructions,athlete_instructions=EXCLUDED.athlete_instructions,
    expected_adaptation=EXCLUDED.expected_adaptation,equipment_required=EXCLUDED.equipment_required,logistics_json=EXCLUDED.logistics_json,
    substitution_ids=EXCLUDED.substitution_ids,status='review',time_model_json=EXCLUDED.time_model_json,dose_scaling_json=EXCLUDED.dose_scaling_json,
    measurement_json=EXCLUDED.measurement_json,support_prompts_json=EXCLUDED.support_prompts_json,updated_at=now();

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,rationale,evidence_json,resolution_source,reviewed_by)
  SELECT 1,canonical_definition,i.definition_id,'distinct_exercises',i.rationale,
    jsonb_build_object('migration',migration_key,'researchVersion',research_version,'identityBoundary',i.boundary,
      'deterministicFromExplicitActionAndSupportContracts',TRUE,'humanReviewRequiredForRelationships',TRUE,'approvalsCreated',FALSE),
    'deterministic_identity_equivalence',NULL
  FROM (VALUES
    (toe_yoga_definition,'short_foot_arch_shortening_vs_selective_toe_extension','Short-foot intentionally shortens and holds the arch; Toe Yoga performs a great-toe then lesser-toe extension cycle.'),
    (tripod_shift_definition,'short_foot_arch_shortening_vs_whole_foot_pressure_shift','Short-foot intentionally shortens the arch; tripod weight shifts move center of pressure across supported foot contacts.'),
    (big_toe_press_definition,'short_foot_arch_shortening_vs_hallux_press_hold','Short-foot is an arch-shortening hold; Big Toe Press is a sustained hallux press.'),
    (short_foot_calf_definition,'short_foot_isometric_vs_arch_action_plus_heel_raise','Short-Foot Drill ends after the controlled arch relaxation; Short Foot to Calf Raise adds plantarflexion and heel elevation.'),
    (single_leg_balance_definition,'short_foot_repetition_vs_single_leg_tripod_balance_hold','Short-Foot Drill repeats an arch dome, hold, and return with bilateral standing or seated support; Single-Leg Tripod Balance is a balance hold.')
  ) i(definition_id,boundary,rationale)
  WHERE EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 d WHERE d.id=i.definition_id)
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET decision='distinct_exercises',rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,resolution_source='deterministic_identity_equivalence',reviewed_by=NULL,resolved_at=now()
  WHERE coaching.exercise_identity_resolution_v1.reviewed_by IS NULL
    AND coaching.exercise_identity_resolution_v1.resolution_source<>'human_review';

  INSERT INTO coaching.exercise_section_evidence_v1(
    definition_id,reviewed_card_version,section_key,source_url,source_title,source_publisher,source_kind,
    claims_json,evidence_quality,review_status,reviewer_user_id,reviewed_at)
  SELECT canonical_definition,2,e.section_key,e.url,e.title,e.publisher,e.kind,
    jsonb_build_object('supportedClaim',e.claim,'scope',e.scope,'limitations',e.limitation,
      'doesNotAuthorizePublicationOrApproval',TRUE,'doesNotEstablishUniversalDoseRecoveryOutcomeOrDifficultyClaim',TRUE),
    e.quality,'candidate',NULL,NULL
  FROM (VALUES
    ('identity','https://pmc.ncbi.nlm.nih.gov/articles/PMC5723035/','Reliability of doming and toe flexion testing to quantify foot muscle strength','Journal of Foot and Ankle Research','peer_reviewed_research','Doming draws the metatarsal heads toward the heel, raises the arch, and retains heel and toe contact.','direct doming identity and invalid-trial context','A maximal three-second strength test does not establish a workout repetition, dose, recovery interval, or publication rule.',88),
    ('taxonomy','https://pmc.ncbi.nlm.nih.gov/articles/PMC7369729/','Randomized Clinical Trial: The Effect of Exercise of the Intrinsic Muscle on Foot Pronation','International Journal of Environmental Research and Public Health','peer_reviewed_research','Short-foot is an arch-shortening action used across seated and progressively loaded support contexts.','direct action and support-progression context','The clinical trial does not create Vortex taxonomy or prove equivalence among support positions.',86),
    ('anatomy','https://pmc.ncbi.nlm.nih.gov/articles/PMC5094843/','Intrinsic Foot Muscle Activation During Specific Exercises: A T2 Time Magnetic Resonance Imaging Study','Journal of Athletic Training','peer_reviewed_research','Short-foot exercise increased activation across all measured plantar intrinsic foot muscles.','direct intrinsic activation context','T2 change does not establish isolation, exact muscle force, standing transfer, individual difficulty, or workout outcome.',88),
    ('biomechanics','https://pmc.ncbi.nlm.nih.gov/articles/PMC5723035/','Reliability of doming and toe flexion testing to quantify foot muscle strength','Journal of Foot and Ankle Research','peer_reviewed_research','Valid doming retained toe and heel contact while the forefoot moved toward the heel; lifting toes, first-metatarsal base, or heel invalidated testing.','direct contact and arch-shortening mechanics','Maximal instrumented testing does not validate every workout cue, support condition, or submaximal range.',88),
    ('difficulty','https://pmc.ncbi.nlm.nih.gov/articles/PMC12703198/','Relationship of Physical Factors to the Acceptability and Unacceptability of Short Foot Exercise: A Preliminary Study','Progress in Rehabilitation Medicine','peer_reviewed_research','Only a minority performed an acceptable short-foot action immediately and many remained unable after practice, supporting high motor-learning complexity.','direct task-learning context','The study does not score Vortex complexity or physical difficulty and does not classify participants.',84),
    ('load_fatigue_recovery','https://pmc.ncbi.nlm.nih.gov/articles/PMC5094843/','Intrinsic Foot Muscle Activation During Specific Exercises: A T2 Time Magnetic Resonance Imaging Study','Journal of Athletic Training','peer_reviewed_research','An acute short-foot protocol produced measurable intrinsic-foot activation.','direct acute exposure context','The protocol does not establish the Vortex dose, fatigue ceiling, recovery interval, or tissue threshold.',88),
    ('constraints','https://pmc.ncbi.nlm.nih.gov/articles/PMC12703198/','Relationship of Physical Factors to the Acceptability and Unacceptability of Short Foot Exercise: A Preliminary Study','Progress in Rehabilitation Medicine','peer_reviewed_research','The studied seated task retained first-metatarsal-head and heel contact, elevated the arch, and rejected interphalangeal flexion and ankle rotation.','direct setup and validity context','The study does not establish universal eligibility, surface hygiene, footwear, standing support, or symptom rules.',84),
    ('dosage','https://pmc.ncbi.nlm.nih.gov/articles/PMC7369729/','Randomized Clinical Trial: The Effect of Exercise of the Intrinsic Muscle on Foot Pronation','International Journal of Environmental Research and Public Health','peer_reviewed_research','Published short-foot protocols vary and the authors note no specific universal protocol.','direct dosage-uncertainty context','The study protocol is not a universal workout dose, frequency, fatigue ceiling, or recovery rule.',86),
    ('instructions','https://pmc.ncbi.nlm.nih.gov/articles/PMC5723035/','Reliability of doming and toe flexion testing to quantify foot muscle strength','Journal of Foot and Ankle Research','peer_reviewed_research','Doming was instructed by sliding the ball of the foot toward the heel and raising the arch without curling or lifting the toes.','direct action wording','The maximal test does not validate Vortex submaximal hold, side count, support variants, or stop rules.',88),
    ('safety_stop_rules','https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf','Youth Resistance Training: Updated Position Statement Paper From the NSCA','National Strength and Conditioning Association','professional_standard','Qualified instruction, safe equipment and environment, appropriate progression, and technique supervision are general exercise safeguards.','general safety and supervision context','The standard does not create an age floor, foot-specific symptom threshold, barefoot policy, or clinical rule for this card.',90),
    ('programming','https://pubmed.ncbi.nlm.nih.gov/35724360/','Evidence for Intrinsic Foot Muscle Training in Improving Foot Function: A Systematic Review and Meta-Analysis','Journal of Athletic Training','peer_reviewed_research','Intrinsic-foot interventions and outcomes are heterogeneous.','adjacent programming and outcome context','Pooled findings do not validate this exact Vortex repetition, dose, transfer, treatment, or prevention outcome.',92),
    ('athlete_support','https://pmc.ncbi.nlm.nih.gov/articles/PMC12703198/','Relationship of Physical Factors to the Acceptability and Unacceptability of Short Foot Exercise: A Preliminary Study','Progress in Rehabilitation Medicine','peer_reviewed_research','Acceptable performance is observable and can require practice.','plain-language self-check context','The study is not an athlete self-management or treatment guide.',84),
    ('coach_support','https://pmc.ncbi.nlm.nih.gov/articles/PMC5723035/','Reliability of doming and toe flexion testing to quantify foot muscle strength','Journal of Foot and Ankle Research','peer_reviewed_research','Toe, first-metatarsal-base, and heel lifting were observable invalid-trial criteria.','direct observation context','Observation cannot diagnose structural, neurologic, or clinical impairment.',88),
    ('accessibility','https://pmc.ncbi.nlm.nih.gov/articles/PMC7369729/','Randomized Clinical Trial: The Effect of Exercise of the Intrinsic Muscle on Foot Pronation','International Journal of Environmental Research and Public Health','peer_reviewed_research','Seated support preceded progressively loaded seated and standing practice in one protocol.','direct support-progression context','This does not prove seated work is universally safer or equivalent for every participant or goal.',86),
    ('alternates','https://pmc.ncbi.nlm.nih.gov/articles/PMC7739583/','How to Evaluate and Improve Foot Strength in Athletes: An Update','Frontiers in Sports and Active Living','peer_reviewed_research','Short-foot, selective toe extension, toe-spread, toe-flexion, and other foot exercises have different action contracts.','direct family-boundary context','The review does not approve Vortex progression, regression, equivalence, or substitution relationships.',86),
    ('media','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en','Embed videos and playlists','YouTube Help','manufacturer_instruction','Five candidate URLs returned current YouTube oEmbed metadata on 2026-08-09.','link and embed metadata only','Playback, exact support, arch action, hold, return, count, captions, accessibility, cue quality, safety, reviewer identity, and approval remain unverified.',82)
  ) e(section_key,url,title,publisher,kind,claim,scope,limitation,quality)
  ON CONFLICT(definition_id,reviewed_card_version,section_key,source_url) DO UPDATE SET source_title=EXCLUDED.source_title,
    source_publisher=EXCLUDED.source_publisher,source_kind=EXCLUDED.source_kind,claims_json=EXCLUDED.claims_json,
    evidence_quality=EXCLUDED.evidence_quality,review_status='candidate',reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_media_candidate_v1(
    definition_id,variant_id,reviewed_card_version,url,embed_url,video_id,title,channel_name,duration_seconds,
    language_code,captions_available,embedding_allowed,exact_variant_match,demonstration_quality_score,
    link_status,review_status,discovery_method,source_query,reviewer_user_id,reviewed_at,next_review_at,notes)
  SELECT canonical_definition,NULL,2,'https://www.youtube.com/watch?v='||m.video_id,
    'https://www.youtube-nocookie.com/embed/'||m.video_id,m.video_id,m.title,m.channel,NULL,'en',NULL,TRUE,NULL,NULL,
    'healthy','candidate','manual_research',m.query,NULL,NULL,'2026-11-09'::TIMESTAMPTZ,
    'Current YouTube oEmbed metadata only. Candidate is not assigned to a variant because full playback has not established seated versus standing support, one-target-foot contacts, arch shortening, toe behavior, prescribed hold, controlled return, side-specific count, compensations, captions, accessibility, cue quality, safety, reviewer identity, card-version match, or approval.'
  FROM (VALUES
    ('acTjKwkti5s','Short Foot Drill - Yoga/Janda Foot','Dr. Beau Beard','Legacy Source 46 candidate; exact support and mechanics require full review'),
    ('m1lkcg8p-48','Short Foot Exercise','Singapore General Hospital','Legacy Source 46 candidate; clinical context and exact variant require full review'),
    ('z0-Vnmw2sxM','The Short Foot exercise | A great way to strengthen your feet','Elevate Chiropractic - Dr Craig Buscomb','Legacy Source 46 candidate; outcome framing and exact variant require full review'),
    ('cIn8bZAwnIQ','Foot Doming, or Short Foot Exercise','Beacon Physical Therapy','Foot doming candidate; exact support and repetition contract require full review'),
    ('rS5ucOyfgSg','Barefoot Running Exercise: Foot Doming','[P]rehab','Foot doming candidate; running framing and exact variant require full review')
  ) m(video_id,title,channel,query)
  ON CONFLICT(definition_id,reviewed_card_version,url) DO UPDATE SET variant_id=NULL,embed_url=EXCLUDED.embed_url,
    video_id=EXCLUDED.video_id,title=EXCLUDED.title,channel_name=EXCLUDED.channel_name,duration_seconds=NULL,
    language_code='en',captions_available=NULL,embedding_allowed=TRUE,exact_variant_match=NULL,
    demonstration_quality_score=NULL,link_status='healthy',review_status='candidate',discovery_method='manual_research',
    source_query=EXCLUDED.source_query,reviewer_user_id=NULL,reviewed_at=NULL,next_review_at=EXCLUDED.next_review_at,
    notes=EXCLUDED.notes,updated_at=now();

  INSERT INTO coaching.exercise_alternate_assessment_v1(
    definition_id,reviewed_card_version,alternate_name,classification,rationale,distinguishing_dimensions,
    proposed_card_json,review_status,reviewer_user_id,reviewed_at)
  SELECT canonical_definition,2,a.name,a.classification,a.rationale,
    jsonb_build_object('boundaryKey',a.boundary_key,'factsRequired',a.facts,
      'neverInferFromNameParticipantRankingAgeOrSportContext',TRUE),
    jsonb_build_object('status',a.proposed_status,'classificationCandidate',a.classification,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),'candidate',NULL,NULL
  FROM (VALUES
    ('Standing Hands-Free Single-Target-Foot Short-Foot Drill','same_identity','This is the authored standing hands-free exact variant.','authored_exact_variant',jsonb_build_array('standing','hands_free','single_target_foot'),'authored_review_variant'),
    ('Standing Wall-Touch Single-Target-Foot Short-Foot Drill','same_identity','This is the authored light wall-touch exact variant.','authored_exact_variant',jsonb_build_array('standing','wall_touch','single_target_foot'),'authored_review_variant'),
    ('Seated Single-Target-Foot Short-Foot Drill','same_identity','This is the authored stable-bench seated exact variant.','authored_exact_variant',jsonb_build_array('seated','bench','single_target_foot'),'authored_review_variant'),
    ('Left Foot First or Right Foot First','modifier_annotation','Side order does not change the one-target-foot repetition.','side_order_annotation',jsonb_build_array('target_side_order'),'annotation_only'),
    ('Comfortable Smaller Dome Range','modifier_annotation','Submaximal range can change while contacts, action, hold, return, and count remain intact.','range_annotation',jsonb_build_array('comfortable_submaximal_range'),'annotation_only'),
    ('Three- to Eight-Second Short-Foot Hold','modifier_annotation','Hold time is dosage while the same isometric dome-and-return repetition remains intact.','hold_annotation',jsonb_build_array('hold_seconds'),'annotation_only'),
    ('Short-Foot Repetition Set and Rest Changes','modifier_annotation','Repetitions, sets, and rest are reviewed delivery-profile fields.','dose_annotation',jsonb_build_array('repetitions_per_side','sets','rest'),'annotation_only'),
    ('Prepare versus Resilience Short-Foot Context','modifier_annotation','Phase changes purpose and dose, not executable identity.','delivery_context_annotation',jsonb_build_array('phase','purpose','dose'),'annotation_only'),
    ('Barefoot versus Approved Thin Sock','modifier_annotation','Foot covering is operational when traction, hygiene, comfort, and observation remain adequate.','foot_covering_annotation',jsonb_build_array('foot_covering','visibility','traction','hygiene'),'annotation_only'),
    ('Comfortable Standing Stance Width','modifier_annotation','A small stance-width change is an annotation while support and target-foot mechanics remain unchanged.','stance_annotation',jsonb_build_array('stance_width'),'annotation_only'),
    ('Submaximal Effort Change','modifier_annotation','Comfortable effort is dosage while the exact dome, hold, and return remain unchanged.','effort_annotation',jsonb_build_array('effort'),'annotation_only'),
    ('Breathing Cue Change','modifier_annotation','Breathing is a delivery annotation unless a breath-hold task is prescribed.','breathing_annotation',jsonb_build_array('breathing'),'annotation_only'),
    ('Simultaneous Bilateral Short-Foot Drill','new_variant','Both feet acting simultaneously changes laterality, observation, count, and compensation rules.','simultaneous_bilateral_variant',jsonb_build_array('bilateral_simultaneous','count'),'research_queue'),
    ('Single-Leg Stance Short-Foot Drill','new_variant','Removing the other foot changes balance, loading, failure consequence, and stop rules.','single_leg_variant',jsonb_build_array('single_leg','balance','load'),'research_queue'),
    ('Unstable-Surface Short-Foot Drill','new_variant','Unstable support changes balance, pressure, logistics, and failure behavior.','unstable_surface_variant',jsonb_build_array('unstable_surface','balance'),'research_queue'),
    ('Manually Assisted Short-Foot Drill','new_variant','Manual guidance changes assistance, validity, consent, and coach contact.','manual_assistance_variant',jsonb_build_array('manual_assistance','consent','count'),'research_queue'),
    ('Banded or Resisted Short-Foot Drill','new_variant','Resistance changes equipment, load, force direction, fatigue, and failure behavior.','resisted_variant',jsonb_build_array('external_resistance','equipment'),'research_queue'),
    ('Dynamic Short-Foot Repetitions without a Hold','new_variant','Removing the prescribed isometric interval changes contraction and dose.','dynamic_only_variant',jsonb_build_array('dynamic_only','contraction_mode'),'research_queue'),
    ('Eccentric-Only Arch-Lengthening Drill','new_variant','Eccentric-only work changes action direction, start, endpoint, and count.','eccentric_only_variant',jsonb_build_array('eccentric_only','action_direction'),'research_queue'),
    ('Short-Foot with Ultrasound or EMG Biofeedback','new_variant','Instrumented feedback changes equipment, delivery, supervision, and scope.','biofeedback_variant',jsonb_build_array('biofeedback','instrumentation'),'research_queue'),
    ('Split-Stance Short-Foot Drill','new_variant','Split stance changes support geometry and target-foot loading.','split_stance_variant',jsonb_build_array('split_stance','weight_distribution'),'research_queue'),
    ('Toe Yoga','new_definition','Selective great-toe and lesser-toe extension is not arch shortening.','toe_yoga_distinct',jsonb_build_array('selective_toe_extension'),'existing_distinct_definition'),
    ('Foot Tripod Weight Shifts','new_definition','Whole-foot pressure shifting moves center of pressure rather than intentionally shortening the arch.','tripod_shift_distinct',jsonb_build_array('pressure_shift','whole_foot_control'),'existing_distinct_definition'),
    ('Big Toe Press Iso Hold','new_definition','A sustained hallux press has a different target action and dose.','hallux_press_distinct',jsonb_build_array('hallux_press','isometric_hold'),'existing_distinct_definition'),
    ('Towel Curl or Toe-Grip Exercise','new_definition','Toe flexion and gripping add a different digit action and often an implement.','toe_flexion_distinct',jsonb_build_array('toe_flexion','grip','implement'),'research_queue'),
    ('Maximal Doming Strength Assessment','new_definition','A maximal instrumented test has a different purpose, effort, validity, and interpretation.','maximal_assessment_distinct',jsonb_build_array('maximal_assessment','instrumentation','clinical_scope'),'research_queue'),
    ('Short Foot to Calf Raise','new_definition','Adding plantarflexion and heel elevation creates a compound sequence.','compound_calf_raise_distinct',jsonb_build_array('arch_shortening','calf_raise','compound_sequence'),'existing_distinct_definition'),
    ('Single-Leg Tripod Balance','new_definition','A balance hold with tripod contacts is not a repeated arch-shortening hold-and-return task.','single_leg_balance_distinct',jsonb_build_array('single_leg','balance_hold','tripod_contacts'),'existing_distinct_definition')
  ) a(name,classification,rationale,boundary_key,facts,proposed_status)
  ON CONFLICT(definition_id,reviewed_card_version,alternate_name) DO UPDATE SET classification=EXCLUDED.classification,
    rationale=EXCLUDED.rationale,distinguishing_dimensions=EXCLUDED.distinguishing_dimensions,
    proposed_card_json=EXCLUDED.proposed_card_json,review_status='candidate',reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_relationship_v1(
    from_variant_id,to_variant_id,relationship,similarity_score,dimensions,reason,conditions_json,
    review_status,created_by,reviewed_by,reviewed_at)
  SELECT r.from_id,r.to_id,r.relationship,r.score,r.dimensions,r.reason,
    jsonb_build_object('migration',migration_key,'reviewOnly',TRUE,'automaticSubstitution',FALSE,
      'revalidate',jsonb_build_array('identity purpose and target side','support weight bearing wall bench surface hygiene and visibility','arch action toe contacts hold return and count','symptoms restrictions and clinical scope','dose effort rest duration and logistics','foot toe calf balance running landing jumping and lower-body budgets','persistence','coach rendering','athlete rendering'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),'review',NULL,NULL,NULL
  FROM (VALUES
    (standing_variant,wall_variant,'regression',92,ARRAY['stability','complexity']::TEXT[],'Adds light wall contact while preserving standing weight bearing and the exact target-foot repetition.'),
    (standing_variant,seated_variant,'regression',84,ARRAY['stability','load','complexity']::TEXT[],'Changes standing to seated support; recompute logistics, load, duration, and scores.'),
    (wall_variant,standing_variant,'progression',92,ARRAY['stability','complexity']::TEXT[],'Removes wall contact while preserving the exact standing target-foot repetition.'),
    (wall_variant,seated_variant,'regression',88,ARRAY['stability','load','complexity']::TEXT[],'Changes wall-supported standing to stable seated support.'),
    (seated_variant,wall_variant,'progression',88,ARRAY['stability','load','complexity']::TEXT[],'Adds standing weight bearing with wall contact after full revalidation.'),
    (standing_variant,toe_yoga_variant,'lateral_substitution',45,ARRAY['range','complexity']::TEXT[],'Changes arch shortening to selective digit extension and is not an automatic equivalent.'),
    (standing_variant,tripod_shift_variant,'lateral_substitution',48,ARRAY['stability','range','complexity']::TEXT[],'Changes arch shortening to whole-foot pressure shifting and center-of-pressure control.'),
    (standing_variant,short_foot_calf_variant,'progression',58,ARRAY['load','range','complexity']::TEXT[],'Adds plantarflexion and heel elevation as a compound sequence; not automatic progression authority.')
  ) r(from_id,to_id,relationship,score,dimensions,reason)
  ON CONFLICT(from_variant_id,to_variant_id,relationship) DO UPDATE SET similarity_score=EXCLUDED.similarity_score,
    dimensions=EXCLUDED.dimensions,reason=EXCLUDED.reason,conditions_json=EXCLUDED.conditions_json,review_status='review',
    created_by=NULL,reviewed_by=NULL,reviewed_at=NULL,updated_at=now()
  WHERE coaching.exercise_relationship_v1.reviewed_by IS NULL
    AND coaching.exercise_relationship_v1.review_status<>'approved';

  INSERT INTO coaching.exercise_score_calibration_v1(
    facility_id,variant_id,dimension,proposed_score,anchor_tier,rationale,status,version,
    created_by,reviewed_by,review_notes,reviewed_at)
  SELECT 1,v.variant_id,d.dimension,
    CASE d.dimension WHEN 'technicalComplexity' THEN v.technical ELSE v.physical END,20,
    CASE d.dimension WHEN 'technicalComplexity' THEN
      'Review-only task-complexity anchor based on support position, one-target-foot selection, arch-shortening motor learning, retained heel forefoot and long-toe contacts, prescribed hold, controlled return, side-specific counting, and compensation observation.'
    ELSE
      'Review-only task physical-demand anchor based on submaximal isometric foot action, support-position loading, no added resistance, no impact, and low local fatigue.' END
      ||' This scores the exercise task, not the participant. Variant: '||v.variant_name||'.',
    'review',1,NULL,NULL,'Research-informed proposal only; independent comparison and qualified human approval remain required.',NULL
  FROM (VALUES
    (standing_variant,'standing hands-free',44,8),
    (wall_variant,'standing wall-touch',40,7),
    (seated_variant,'seated bench',36,5)
  ) v(variant_id,variant_name,technical,physical)
  CROSS JOIN (VALUES('technicalComplexity'),('absoluteLoadDemand')) d(dimension)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET proposed_score=EXCLUDED.proposed_score,
    anchor_tier=EXCLUDED.anchor_tier,rationale=EXCLUDED.rationale,status='review',created_by=NULL,reviewed_by=NULL,
    review_notes=EXCLUDED.review_notes,reviewed_at=NULL,updated_at=now();

  UPDATE coaching.exercise SET
    name='Short-Foot Drill',slug='short-foot-drill',
    description='Place one target foot flat with its heel, first and fifth metatarsal heads, and relaxed long toes supported. Without curling or lifting the toes or rotating the ankle, gently draw the ball of the foot toward the heel to shorten the foot and raise the arch. Hold at comfortable submaximal effort, then relax fully to the same start. Count that dome, hold, and return as one repetition and record each side separately.',
    instructions='Select the exact standing hands-free, standing wall-touch, or seated bench variant. Keep the target heel, toe mounds, and long relaxed toes supported. Gently dome the arch, breathe through the prescribed hold, and relax fully. Stop for pain, persistent cramp, pinching, numbness, tingling, weakness, circulation or skin change, dizziness, unsafe support or surface, lost contacts, toe curl or lift, ankle rotation, or participant request. Do not count a manually assisted attempt as unassisted.',
    skill_level=NULL,age_min=NULL,age_max=NULL,default_sets=1,default_reps=5,
    default_work_seconds=45,default_rest_seconds=30,
    tempo='controlled dome, prescribed three- to five-second submaximal hold, and controlled full relaxation',
    load_note='Track definition, exact support variant, target side order, clean foot-safe surface, hygiene, toe visibility, wall or bench, planned and actual valid repetitions and hold seconds for each foot, range, effort, rest, heel forefoot and toe contacts, toe curl or lift, arch, ankle, knee and body faults, assisted invalid or partial attempts, first fault, symptoms, active work, duration, substitution, cleaning, station reset, exit, and overlapping foot, toe, calf, balance, running, landing, jumping and lower-body exposure.',
    est_seconds_per_set=180,is_published=FALSE,archived=FALSE,
    card_summary='One-target-foot arch-shortening repetition: supported long-toe start, comfortable submaximal dome, prescribed isometric hold, and controlled full relaxation, with exact standing hands-free, wall-touch, or seated support and side-specific tracking.',
    coach_language='Verify the exact target-foot arch-shortening task, side, support variant, surface hygiene and visibility, wall or bench, symptoms and restrictions, repetition and hold dose by side, actual exposure, first fault, duration, downstream foot budget, persistence, exit, and escalation. Do not force range, diagnose, or count assisted attempts as unassisted.',
    athlete_language='One foot at a time: keep your heel, toe mounds, and long relaxed toes down. Draw the ball of your foot toward your heel, gently lift the arch, hold and breathe, then relax fully. Count each foot separately.',
    programming_logic=jsonb_build_object('selectionStatus','canonical_variant_required','selectable',TRUE,
      'canonicalDefinitionId',canonical_definition,'exactVariantIds',to_jsonb(active_variant_ids),
      'difficultyModel','max_exercise_complexity_physical_difficulty','exerciseDifficultyDescribesTaskOnly',TRUE,
      'selectionInputs',jsonb_build_array('workout purpose and delivery context','target side order','standing hands-free standing wall-touch or seated bench support','clean dry nonslip foot-safe surface hygiene toe visibility and approved foot covering','comfortable submaximal arch shortening and target-foot contacts','exact dome hold return and side-specific count comprehension','hold repetition effort rest and duration','cumulative foot toe calf balance and priority-work exposure','coach scope and sightline'),
      'substitutionRevalidation',jsonb_build_array('identity','target side support weight bearing and wall or bench','arch action toe contacts hold return and count','surface hygiene visibility equipment space traffic and exit','restrictions and symptoms','purpose','dose','fatigue and impact budgets','duration','logistics','persistence','coach rendering','athlete rendering'),
      'legacySourceIds',jsonb_build_array(46),'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    scalable_variables=ARRAY['target_side_order','comfortable_submaximal_range','hold_seconds','breathing_prompt','repetitions_per_side','sets','rest_seconds','effort_target','approved_foot_covering','delivery_context']::TEXT[],
    movement_family='Short-foot arch doming',primary_phase_key='prepare_and_access',phase_subrole='foot_activation',primary_order_slot='foot_activation',
    movement_requirements=jsonb_build_object('impact_level',0,'balance_demand','variant_dependent_from_minimal_seated_to_low_standing',
      'postural_shape','one_target_foot_flat_with_selected_standing_or_seated_support',
      'primary_tissues',jsonb_build_array('plantar_intrinsic_foot_muscles','arch_stabilizers','toe_flexor_stabilizers','foot_and_ankle_stabilizers'),
      'breathing_demand','continuous_relaxed_breathing','coordination_demand','moderate_arch_shortening_motor_control',
      'primary_joint_actions',jsonb_build_array('metatarsal_heads_draw_toward_heel','medial_arch_elevation_and_foot_shortening','submaximal_isometric_hold','controlled_relaxation','heel_forefoot_toe_ankle_and_limb_stabilization'),
      'supportContactsByVariant',jsonb_build_object('standingHandsFree','both_feet_on_floor_hands_free','standingWallTouch','both_feet_on_floor_light_wall_hand_contact','seatedBench','pelvis_on_bench_both_feet_on_floor'),
      'exactSequence',jsonb_build_array('target_foot_supported_long_toe_start','arch_dome','prescribed_submaximal_hold','controlled_full_relaxation','same_start_one_target_foot_repetition'),
      'exerciseDifficulty',jsonb_build_object('complexity',44,'physicalDifficulty',8,'overall',44,'formula','max','projectionVariant','standing_hands_free')),
    coaching_execution=jsonb_build_object(
      'setup',jsonb_build_array('clean dry nonslip foot-safe surface and facility hygiene setup','foot visible with approved barefoot or thin-sock policy','select standing hands-free wall-touch or seated bench variant','place both feet flat and identify one target foot','target heel first and fifth metatarsal heads and long toes supported','knees and body quiet','clear station and exit'),
      'execution_steps',jsonb_build_array('keep target toes long and supported','draw metatarsal heads toward heel enough to raise arch','maintain prescribed comfortable submaximal hold while breathing','relax with control to same supported start','count one target-foot repetition and actual hold seconds','complete planned repetitions then switch sides or stop'),
      'coach_cues',jsonb_build_array('one foot at a time','heel toe mounds and long toes down','ball toward heel','arch up','hold and breathe','relax fully','ankle and knee quiet','one full cycle one rep','count each side'),
      'athlete_cues',jsonb_build_array('toes long','gently shorten the foot','hold and breathe','relax all the way','no clawing','small clean dome','stop before cramp or pain'),
      'common_faults',jsonb_build_array('toe_curl_claw_grip_or_lift','heel_or_metatarsal_head_lift','ankle_rotation','knee_hip_or_trunk_movement','missing_hold_or_full_return','wrong_side_or_count','manual_assistance_counted_as_unassisted','breath_holding','maximal_effort','silent_change_to_another_variant'),
      'quality_gate',jsonb_build_array('safe surface hygiene support equipment and station','visible target foot','heel forefoot and long toes supported','arch shortens without toe curl lift or ankle rotation','prescribed hold and breathing complete','full controlled return','support and body controlled','correct side-specific count and hold record','no stop symptom'),
      'stop_signs',jsonb_build_array('sharp increasing night post-trauma or unfamiliar pain','painful pinching catching joint irritation or persistent cramp','numbness tingling weakness circulation skin or control change','dizziness faintness nausea visual change chest pain unusual breathlessness or disorientation','contacts toe length arch action hold return or body control cannot be restored','unsafe surface hygiene wall bench visibility station or exit','participant stop request'),
      'breathing_cues',jsonb_build_array('breathe through the hold','relax jaw shoulders and unnecessary leg tension'),
      'clinical_scope','This is a workout exercise, not a diagnostic doming test, flatfoot or pain treatment, structural-correction protocol, balance or fall-prevention intervention, clearance, or proof of readiness.'),
    pairing_logic=jsonb_build_object('sameSessionBudget',jsonb_build_array('valid_repetitions_and_hold_seconds_per_side','active_work_seconds','foot_toe_load','local_and_technical_fatigue','cramp_and_symptom_response','downstream_balance_running_landing_jumping_agility_and_lower_body_work','impact'),
      'avoidAutomaticPairingWith',jsonb_build_array('fatiguing_foot_or_calf_work_before_priority_balance_running_landing_jumping_or_agility','symptom_provoking_arch_work','same_session_foot_budget_exceeded'),'revalidateAfterSubstitution',TRUE),
    media_library=jsonb_build_object('candidate_video_ids',jsonb_build_array('acTjKwkti5s','m1lkcg8p-48','z0-Vnmw2sxM','cIn8bZAwnIQ','rS5ucOyfgSg'),
      'reviewState','oembed_metadata_only_candidate_quarantine','playbackExactSupportContactsArchActionToeBehaviorHoldReturnCountCompensationCaptionsAccessibilityQualitySafetyAndApprovalVerified',FALSE,'humanReviewRequired',TRUE),
    participant_structure='individual',programming_kind='exercise',linked_skill_id=NULL,why_publish_ready=FALSE,updated_at=now()
  WHERE id=46;

  UPDATE coaching.exercise_safety_profile SET risk_level=1,impact_level=0,
    minimum_age_recommended=NULL,minimum_skill_level=NULL,requires_spotting=FALSE,requires_coach_supervision='recommended',
    minimum_prerequisite_notes='Readiness uses a safe clean visible foot-contact station, comfortable target-foot contacts and submaximal arch shortening, exact selected standing or seated support, dome-hold-return and side-specific count comprehension, symptoms, communication, planned dose, and downstream foot demand; never participant classification or age.',
    readiness_checks=ARRAY[
      'Confirm exact standing hands-free, standing wall-touch, or seated bench variant, target side order, clean dry nonslip foot-safe surface, hygiene, visibility, equipment, space, sightline, communication, exit, and emergency route.',
      'Confirm toe, forefoot, arch, foot, ankle, calf, knee, hip, back, skin, circulation, and neurologic status do not conflict with the exact task.',
      'Confirm the participant understands heel, first and fifth metatarsal-head, and long-toe contacts; dome, hold, full relaxation, side-specific count, stop signal, and exit.',
      'Review cumulative valid repetitions and hold seconds by side, active time, local foot load, technical fatigue, cramp response, and later balance, running, landing, jumping, agility, or lower-body demand.'
    ]::TEXT[],
    stop_signs=ARRAY[
      'Sharp, increasing, night, post-trauma, or unfamiliar pain, guarding, or participant stop request.',
      'Toe, forefoot, arch, foot, ankle, calf, knee, hip, or back symptoms prevent exact motion or support.',
      'Painful pinching, catching, instability, joint irritation, skin pain, or persistent cramping.',
      'Numbness, tingling, weakness, altered circulation, skin breakdown, or another neurologic or skin sign.',
      'Dizziness, faintness, nausea, visual change, chest pain, unusual breathlessness, disorientation, or inability to communicate.',
      'The target heel, metatarsal heads, or long toes lift; toes curl; ankle rotates; or arch, knee, hip, or body compensates.',
      'The dome, prescribed hold, full relaxation, comfortable effort, support, breathing, or side-specific count cannot be restored after reduced range, effort, hold, repetitions, or more support.',
      'Surface traction, temperature, hygiene, visibility, wall, bench, space, traffic, sightline, communication, duration, budget, exit, or emergency route becomes inadequate.'
    ]::TEXT[],
    contraindications=ARRAY[
      'Current symptoms, trauma, procedure, skin breakdown, circulation or neurologic concern, joint irritation, or clinical restriction conflicts with arch shortening or ground contact.',
      'No clean dry nonslip foot-safe surface, compliant hygiene setup, adequate visibility, exact safe support, controlled entry and exit, sightline, communication, or emergency route.',
      'The intended service is diagnosis, treatment, injury management, readiness clearance, maximal measurement, instrumented biofeedback, manual assistance, resisted work, unstable or single-leg balance, heel raising, or another identity.'
    ]::TEXT[],
    common_substitutions=ARRAY[
      'Use the wall-touch or seated exact Short-Foot variant only after support, difficulty, equipment, logistics, duration, and workout budgets are recomputed.',
      'Use Toe Yoga only when changing from arch shortening to selective digit extension fits and all checks are rerun.',
      'Use Foot Tripod Weight Shifts, Big Toe Press Iso Hold, Single-Leg Tripod Balance, or Short Foot to Calf Raise only when the changed action, support, count, dose, fatigue, and purpose fit and all checks are rerun.',
      'Do not infer that simultaneous, manually assisted, resisted, biofeedback, dynamic-only, eccentric-only, unstable, single-leg, split-stance, toe-curl, maximal-test, clinical, or sport-context versions are equivalent.'
    ]::TEXT[]
  WHERE exercise_id=46;

  UPDATE coaching.exercise_score_v1 SET technical_complexity=44,absolute_load_demand=8,
    coordination_demand=46,impact=1,supervision_demand=11,base_overall_difficulty=greatest(44,8),
    legacy_scores=coalesce(legacy_scores,'{}'::JSONB)||jsonb_build_object(
      'candidateReassessment',migration_key,'projectionScope','standing_hands_free_one_target_foot_arch_dome_hold_return',
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'variantScores',jsonb_build_object('standingHandsFree',jsonb_build_object('complexity',44,'physicalDifficulty',8,'overall',44),
        'standingWallTouch',jsonb_build_object('complexity',40,'physicalDifficulty',7,'overall',40),
        'seatedBench',jsonb_build_object('complexity',36,'physicalDifficulty',5,'overall',36)),
      'exerciseScoresDescribeTaskOnly',TRUE,'independentCalibrationRequired',TRUE,'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    migration_confidence=63,human_review_status='queued',reviewed_by=NULL,reviewed_at=NULL,
    review_notes='Research-informed candidate reassessment only. Scores describe exercise complexity and physical difficulty, not participant classification, age, readiness, or proficiency. Each support variant requires independent calibration and all publication authority remains quarantined.',updated_at=now()
  WHERE exercise_id=46;

  UPDATE coaching.exercise_difficulty_profile SET technical=4.4,complexity=4.2,load=1.0,overall=4.4,
    recommended_age_min=NULL,recommended_age_max=NULL,attention_demand='moderate',
    notes='Candidate projection from the exact standing hands-free target-foot dome, prescribed hold, and return. Complexity is 44/100, physical difficulty 8/100, and overall 44/100 by maximum. This is not participant classification, readiness, age, or proficiency. Wall-touch and seated variants score separately.',
    source='canonical_research_candidate',updated_at=now()
  WHERE exercise_id=46;

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,checks_json,
    blocking_issues_json,human_review_required,checked_at)
  VALUES(canonical_definition,1,2,'2.0.0',migration_key,'quarantined',
    jsonb_build_object(
      'identity',jsonb_build_object('passed',TRUE,'identityKey','one_target_foot_arch_shortening_submaximal_isometric_hold_controlled_return','legacySources',1,'directDuplicatesConsolidated',0,'activeVariants',3,'archivedSourceSkeletons',1,'neighborBoundaries',5),
      'taxonomy',jsonb_build_object('passed',TRUE,'controlledTerms',TRUE,'movementPatterns',jsonb_build_array('brace'),'bodyRegions',jsonb_build_array('foot','ankle','calf','knee','hip','core'),'equipment',jsonb_build_array('none','wall','bench')),
      'anatomy',jsonb_build_object('passed',TRUE,'musclesJointsActionsPlanesLateralityContactsSequenceAndIsolationBoundary',TRUE,'oneTargetFootPerRepetition',TRUE),
      'difficulty',jsonb_build_object('passed',TRUE,'model','max_exercise_complexity_physical_difficulty','variantVectors',jsonb_build_array('44/8/44','40/7/40','36/5/36'),'participantClassificationAbsent',TRUE,'independentCalibrationRequired',TRUE),
      'loadFatigueRecovery',jsonb_build_object('passed',TRUE,'actualRepetitionsHoldSecondsBySideActiveWorkRangeSupportFaultSymptomsAndOverlappingFootExposureTracked',TRUE,'impactNone',TRUE,'recoveryIsPlanningEstimate',TRUE),
      'constraints',jsonb_build_object('passed',TRUE,'surfaceHygieneVisibilityWallBenchSupportSymptomsRestrictionsSpaceTrafficScopeAndEmergencyRoute',TRUE),
      'delivery',jsonb_build_object('passed',TRUE,'profiles',4,'prepareAndResilience',TRUE,'durationDoseHoldRestSetupSideSwitchCleaningExitAndSubstitutionRevalidation',TRUE),
      'instructions',jsonb_build_object('passed',TRUE,'athleteCoachAccessibilityAndSupportOperations',TRUE,'targetSideContactsDomeHoldReturnCountSymptomsExitAndClinicalScope',TRUE),
      'research',jsonb_build_object('passed',TRUE,'sections',16,'registryVersion',research_version,'directAndAdjacentEvidenceSeparated',TRUE,'studyDoseNotUniversal',TRUE),
      'media',jsonb_build_object('passed',FALSE,'candidateCount',5,'currentOEmbedMetadataHealthy',TRUE,'variantAssignmentPending',TRUE,'playbackReviewed',FALSE,'exactArchActionReviewed',FALSE,'captionsAccessibilityQualitySafetyAndApprovalReviewed',FALSE),
      'relationships',jsonb_build_object('passed',FALSE,'reviewOnly',8,'approved',0,'automaticSubstitution',FALSE),
      'calibration',jsonb_build_object('passed',FALSE,'reviewOnly',6,'approved',0),
      'alternates',jsonb_build_object('passed',TRUE,'assessments',28,'sameIdentity',3,'modifierAnnotations',9,'newVariants',9,'newDefinitions',7,'threeExactVariants',TRUE),
      'generationSupport',jsonb_build_object('passed',TRUE,'selectionConstraints',TRUE,'cumulativeFatigueAndImpactBudgets',TRUE,'duration',TRUE,'surfaceHygieneVisibilityWallBenchSetupSideSwitchCleaningAndExit',TRUE,'substitutionRevalidation',TRUE,'renderingAndPersistence',TRUE),
      'publication',jsonb_build_object('passed',FALSE,'reviewer',NULL,'approver',NULL)),
    jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01','message','A qualified human must watch all five candidates in full and verify playback, exact support, one-target-foot contacts, arch shortening, toe behavior, prescribed hold, controlled return, side-specific count, compensations, captions, accessibility, cue quality, safety, conflicts, reviewer identity, timestamp, card version, and approval rationale.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','A qualified coach must approve or reject all eight relationships; no automatic substitution among support variants, Toe Yoga, pressure shifts, hallux pressing, compound heel raising, single-leg balance, assisted, resisted, instrumented, unstable, clinical, or sport tasks is authorized.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','An independent qualified reviewer must calibrate complexity and physical-difficulty scores for all three exact support variants. Scores do not classify a participant or create an age, readiness, or proficiency level.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','A qualified reviewer and separate approver must complete content review before publication. Identity, anatomy, surface and hygiene safety, support variants, load and recovery, arch action, hold and side-specific count, clinical scope, dose, stop, accessibility, persistence, and support rules remain quarantined.')),
    TRUE,now())
  ON CONFLICT(definition_id) DO UPDATE SET facility_id=EXCLUDED.facility_id,card_version=EXCLUDED.card_version,
    schema_version=EXCLUDED.schema_version,audit_version=EXCLUDED.audit_version,status='quarantined',
    checks_json=EXCLUDED.checks_json,blocking_issues_json=EXCLUDED.blocking_issues_json,
    human_review_required=TRUE,checked_at=now();

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition AND status='review' AND card_version=2 AND schema_version='2.0.0'
        AND approved_video_url IS NULL AND reviewed_by IS NULL AND approved_by IS NULL AND last_reviewed_at IS NULL
        AND movement_patterns=ARRAY['brace']::TEXT[] AND required_equipment=ARRAY['none']::TEXT[]
        AND anatomy_json<>'{}'::JSONB AND environment_json<>'{}'::JSONB AND population_json<>'{}'::JSONB
        AND athlete_support_json ?& ARRAY['whyItMatters','primaryCue','expectedSensations','unexpectedSensations','painGuidance','selfChecks','accessibility','mediaAlternatives']::TEXT[]
        AND coach_support_json ?& ARRAY['observationChecklist','faultCorrections','demonstrationPlan','groupManagement','modificationDecisionTree','doNotUseWhen']::TEXT[]
        AND support_operations_json ?& ARRAY['issueCategories','supportEscalation','retentionPolicy','changeImpactPolicy']::TEXT[]
        AND provenance_json->>'approvalsCreated'='false')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id=source_variant AND definition_id=canonical_definition
        AND status='archived' AND requirements_json->>'selectable'='false')
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(active_variant_ids) AND definition_id=canonical_definition AND status='review'
        AND requirements_json->>'selectable'='true'
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=greatest(
          (difficulty_json->>'technicalComplexity')::INTEGER,(difficulty_json->>'physicalDifficulty')::INTEGER)
        AND (difficulty_json->>'impact')::INTEGER=1
        AND (load_profile_json->>'landingContactsPerRep')::INTEGER=0
        AND (fatigue_profile_json->>'impactAccumulation')::INTEGER=1
        AND (fatigue_profile_json->'cumulativeBudget'->>'impact')::INTEGER=0
        AND programming_profile_json->>'publicationQuarantined'='true')<>3 THEN
    RAISE EXCEPTION '% definition variant source or quarantine assertion failed',migration_key;
  END IF;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id=standing_variant
      AND (difficulty_json->>'technicalComplexity')::INTEGER=44
      AND (difficulty_json->>'physicalDifficulty')::INTEGER=8
      AND (difficulty_json->>'coordinationDemand')::INTEGER=46
      AND (difficulty_json->>'supervisionDemand')::INTEGER=11
      AND (difficulty_json->>'failureConsequence')::INTEGER=6
      AND (difficulty_json->>'workCapacityDemand')::INTEGER=8
      AND requirements_json->'equipment'=jsonb_build_array('none'))
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id=wall_variant
      AND (difficulty_json->>'technicalComplexity')::INTEGER=40
      AND (difficulty_json->>'physicalDifficulty')::INTEGER=7
      AND (difficulty_json->>'coordinationDemand')::INTEGER=42
      AND requirements_json->'equipment'=jsonb_build_array('wall'))
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id=seated_variant
      AND (difficulty_json->>'technicalComplexity')::INTEGER=36
      AND (difficulty_json->>'physicalDifficulty')::INTEGER=5
      AND (difficulty_json->>'coordinationDemand')::INTEGER=38
      AND requirements_json->'equipment'=jsonb_build_array('bench')) THEN
    RAISE EXCEPTION '% task-only variant score or equipment assertion failed',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=ANY(active_variant_ids) AND status='review'
        AND coalesce(time_model_json->>'durationFormula','')<>'' AND dose_scaling_json<>'{}'::JSONB
        AND measurement_json<>'{}'::JSONB AND support_prompts_json<>'{}'::JSONB
        AND length(coach_instructions)>=100 AND length(athlete_instructions) BETWEEN 10 AND 500
        AND cardinality(stop_rules)>=8)<>4
    OR (SELECT count(DISTINCT section_key) FROM coaching.exercise_section_evidence_v1
      WHERE definition_id=canonical_definition AND reviewed_card_version=2
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>16
    OR (SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=canonical_definition AND reviewed_card_version=2 AND link_status='healthy'
        AND review_status='candidate' AND embedding_allowed AND variant_id IS NULL
        AND captions_available IS NULL AND exact_variant_match IS NULL AND demonstration_quality_score IS NULL
        AND reviewer_user_id IS NULL AND reviewed_at IS NULL)<>5
    OR (SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id=canonical_definition AND reviewed_card_version=2
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>28
    OR (SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE from_variant_id=ANY(active_variant_ids) AND review_status='review' AND reviewed_by IS NULL)<>8
    OR (SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(active_variant_ids) AND status='review' AND reviewed_by IS NULL)<>6
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=canonical_definition AND decision='distinct_exercises' AND reviewed_by IS NULL)<>5 THEN
    RAISE EXCEPTION '% authored row-count or quarantine assertion failed',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 d CROSS JOIN LATERAL unnest(d.movement_patterns) key
      WHERE d.id=canonical_definition AND NOT EXISTS(SELECT 1 FROM coaching.movement_pattern allowed WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 d CROSS JOIN LATERAL unnest(d.body_regions) key
      WHERE d.id=canonical_definition AND NOT EXISTS(SELECT 1 FROM coaching.body_region allowed WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 v
      CROSS JOIN LATERAL jsonb_array_elements_text(v.requirements_json->'equipment') key
      WHERE v.id=ANY(active_variant_ids) AND NOT EXISTS(SELECT 1 FROM coaching.equipment allowed WHERE allowed.key=key)) THEN
    RAISE EXCEPTION '% uncontrolled taxonomy was authored',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise WHERE id=46
      AND (skill_level IS NOT NULL OR age_min IS NOT NULL OR age_max IS NOT NULL OR linked_skill_id IS NOT NULL OR is_published OR why_publish_ready))
    OR EXISTS(SELECT 1 FROM coaching.exercise_safety_profile WHERE exercise_id=46
      AND (minimum_skill_level IS NOT NULL OR minimum_age_recommended IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 WHERE id=canonical_definition
      AND (approved_video_url IS NOT NULL OR reviewed_by IS NOT NULL OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL OR status='published'))
    OR EXISTS(SELECT 1 FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=canonical_definition AND review_status='candidate'
        AND (exact_variant_match IS NOT NULL OR demonstration_quality_score IS NOT NULL OR captions_available IS NOT NULL OR reviewer_user_id IS NOT NULL OR reviewed_at IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1 WHERE from_variant_id=ANY(active_variant_ids) AND review_status='approved')
    OR EXISTS(SELECT 1 FROM coaching.exercise_score_calibration_v1 WHERE variant_id=ANY(active_variant_ids) AND status='approved') THEN
    RAISE EXCEPTION '% fabricated participant classification approval or publication state detected',migration_key;
  END IF;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=canonical_definition AND status='quarantined' AND human_review_required
        AND jsonb_array_length(blocking_issues_json)=4
        AND (SELECT array_agg(item->>'code' ORDER BY item->>'code') FROM jsonb_array_elements(blocking_issues_json) item)
          =ARRAY['CARD-CALIBRATION-01','CARD-GRAPH-03','CARD-MEDIA-01','CARD-PUBLISH-01']::TEXT[])
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=46
      AND programming_logic->>'exerciseDifficultyDescribesTaskOnly'='true'
      AND movement_requirements->'exerciseDifficulty'->>'overall'='44'
      AND media_library->>'reviewState'='oembed_metadata_only_candidate_quarantine'
      AND participant_structure='individual' AND programming_kind='exercise'
      AND linked_skill_id IS NULL AND NOT is_published AND NOT archived) THEN
    RAISE EXCEPTION '% test packet legacy projection or task-only difficulty assertion failed',migration_key;
  END IF;
END
$migration$;
