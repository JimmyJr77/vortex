-- Source 43: replace the skeletal and over-merged Tibialis Raises card with one
-- exact wall-supported bilateral dorsiflexion lift-and-controlled-return cycle.
-- Sources 214, 1113, and 1399 return to their archived definition because wall
-- contact, stance, laterality, start, endpoint, and count are not recoverable.
-- Evidence, media, graph, calibration, content, and publication authority stay
-- human-only. Difficulty describes the exercise task, never participant level.
DO $migration$
DECLARE
  migration_key CONSTANT TEXT := '519_coaching_wall_supported_tibialis_raise_identity_and_family_audit_hardening';
  research_version CONSTANT TEXT := '2026-08-09.110';
  canonical_definition UUID; source43_variant UUID; ambiguous_definition UUID;
  source214_variant UUID; source1113_variant UUID; source1399_variant UUID; exact_variant UUID;
  active_variant_ids UUID[]; all_owned_variant_ids UUID[]; iso_definition UUID; iso_variant UUID;
  eccentric_definition UUID; eccentric_variant UUID; ankle_cars_definition UUID; ankle_cars_variant UUID;
  calf_definition UUID; calf_variant UUID; toe_yoga_definition UUID; toe_yoga_variant UUID; foot_tripod_definition UUID; foot_tripod_variant UUID;
  protected_count INTEGER;
BEGIN
  SELECT id INTO canonical_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=43;
  SELECT id INTO ambiguous_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=214;
  SELECT id INTO source43_variant FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='baseline';
  SELECT id INTO source214_variant FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='baseline-source-214';
  SELECT id INTO source1113_variant FROM coaching.exercise_variant_v1 WHERE definition_id=ambiguous_definition AND variant_key='baseline-source-1113';
  SELECT id INTO source1399_variant FROM coaching.exercise_variant_v1 WHERE definition_id=ambiguous_definition AND variant_key='baseline-source-1399';
  SELECT coalesce((SELECT id FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='wall-supported-bilateral-lift-and-controlled-return'),gen_random_uuid()) INTO exact_variant;
  SELECT id INTO iso_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=843; SELECT id INTO iso_variant FROM coaching.exercise_variant_v1 WHERE definition_id=iso_definition AND variant_key='baseline';
  SELECT id INTO eccentric_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=764; SELECT id INTO eccentric_variant FROM coaching.exercise_variant_v1 WHERE definition_id=eccentric_definition AND variant_key='baseline';
  SELECT id INTO ankle_cars_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=42; SELECT id INTO ankle_cars_variant FROM coaching.exercise_variant_v1 WHERE definition_id=ankle_cars_definition AND variant_key='seated-thigh-supported-active-ankle-circuit';
  SELECT id INTO calf_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=44; SELECT id INTO calf_variant FROM coaching.exercise_variant_v1 WHERE definition_id=calf_definition AND variant_key='baseline';
  SELECT id INTO toe_yoga_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=45; SELECT id INTO toe_yoga_variant FROM coaching.exercise_variant_v1 WHERE definition_id=toe_yoga_definition AND variant_key='baseline';
  SELECT id INTO foot_tripod_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=47; SELECT id INTO foot_tripod_variant FROM coaching.exercise_variant_v1 WHERE definition_id=foot_tripod_definition AND variant_key='baseline';
  active_variant_ids:=ARRAY[exact_variant]; all_owned_variant_ids:=ARRAY[source43_variant,source214_variant,source1113_variant,source1399_variant,exact_variant];

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=43 AND facility_id=1)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=214 AND facility_id=1)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=1113 AND facility_id=1)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=1399 AND facility_id=1)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition AND facility_id=1 AND legacy_exercise_id=43)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=ambiguous_definition AND facility_id=1 AND status='archived')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=43 AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=214 AND definition_id IN(canonical_definition,ambiguous_definition))
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id IN(1113,1399) AND definition_id=ambiguous_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source43_variant AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source214_variant AND definition_id IN(canonical_definition,ambiguous_definition))
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id IN(source1113_variant,source1399_variant) AND definition_id=ambiguous_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id=iso_variant AND definition_id=iso_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id=eccentric_variant AND definition_id=eccentric_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id=ankle_cars_variant AND definition_id=ankle_cars_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id=calf_variant AND definition_id=calf_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id=toe_yoga_variant AND definition_id=toe_yoga_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id=foot_tripod_variant AND definition_id=foot_tripod_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1 WHERE exercise_id=43)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_difficulty_profile WHERE exercise_id=43)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_safety_profile WHERE exercise_id=43) THEN
    RAISE EXCEPTION '% prerequisite source or neighbor rows are missing',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id=exact_variant AND definition_id<>canonical_definition)
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE slug='wall-supported-bilateral-tibialis-raise' AND id<>canonical_definition) THEN
    RAISE EXCEPTION '% working UUID or slug already belongs to another card',migration_key;
  END IF;

  SELECT coalesce(sum(n),0) INTO protected_count FROM (
    SELECT count(*) n FROM coaching.exercise_definition_v1
      WHERE id IN(canonical_definition,ambiguous_definition)
        AND (status IN('published','deprecated') OR reviewed_by IS NOT NULL OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)
    UNION ALL SELECT count(*) FROM coaching.exercise_section_evidence_v1
      WHERE definition_id=canonical_definition AND (reviewer_user_id IS NOT NULL OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=canonical_definition AND (reviewer_user_id IS NOT NULL OR reviewed_at IS NOT NULL OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id=canonical_definition AND (reviewer_user_id IS NOT NULL OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_card_review_v1 WHERE definition_id=canonical_definition
    UNION ALL SELECT count(*) FROM coaching.exercise_card_revision_v1 WHERE definition_id=canonical_definition
    UNION ALL SELECT count(*) FROM coaching.exercise_media_review_v1 WHERE definition_id=canonical_definition
    UNION ALL SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=ANY(all_owned_variant_ids) OR to_variant_id=ANY(all_owned_variant_ids))
        AND (reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL OR review_status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(all_owned_variant_ids) AND (reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL OR status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE (survivor_definition_id IN(canonical_definition,ambiguous_definition)
          OR resolved_definition_id IN(canonical_definition,ambiguous_definition))
        AND (reviewed_by IS NOT NULL OR resolution_source='human_review')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_v1
      WHERE exercise_id=43 AND (human_review_status<>'queued' OR reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL)
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
  DELETE FROM coaching.exercise_relationship_v1
  WHERE (from_variant_id=ANY(all_owned_variant_ids) OR to_variant_id=ANY(all_owned_variant_ids))
    AND reviewed_by IS NULL AND review_status<>'approved';
  DELETE FROM coaching.exercise_score_calibration_v1
  WHERE variant_id=ANY(all_owned_variant_ids) AND reviewed_by IS NULL AND status<>'approved';

  UPDATE coaching.exercise_definition_source_v1 SET source_kind='legacy_migration',
    provenance_json=jsonb_build_object(
      'source_table','coaching.exercise','migration',migration_key,'researchVersion',research_version,
      'sourceDisposition','canonical_wall_supported_bilateral_tibialis_raise_reauthored',
      'exactWorkingSpecification','wall_supported_bilateral_heel_planted_active_dorsiflexion_lift_and_controlled_return_cycle',
      'representedBySelectableSourceVariant',FALSE,'exerciseDifficultyDescribesTaskOnly',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=43 AND definition_id=canonical_definition;

  UPDATE coaching.exercise_definition_source_v1 SET definition_id=ambiguous_definition,source_kind='legacy_migration',
    provenance_json=jsonb_build_object(
      'source_table','coaching.exercise','migration',migration_key,'researchVersion',research_version,
      'sourceDisposition','restored_to_archived_definition_needs_human_review',
      'sourceInterpretation','The source names a tibialis raise but does not establish wall contact stance laterality start endpoint or count.',
      'identityBoundary','exact_source43_wall_supported_bilateral_cycle_vs_incomplete_generic_contract',
      'selectable',FALSE,'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=214;

  UPDATE coaching.exercise_definition_source_v1 SET source_kind='legacy_migration',
    provenance_json=jsonb_build_object(
      'source_table','coaching.exercise','migration',migration_key,'researchVersion',research_version,
      'sourceDisposition','archived_contextual_source_needs_exact_identity_review',
      'sourceInterpretation','Sport context is stated but exact wall contact stance laterality start endpoint and count remain missing.',
      'identityBoundary','context_does_not_supply_missing_exercise_mechanics',
      'selectable',FALSE,'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id IN(1113,1399) AND definition_id=ambiguous_definition;

  UPDATE coaching.exercise_delivery_profile_v1 SET status='archived',updated_at=now()
  WHERE variant_id IN(source43_variant,source214_variant,source1113_variant,source1399_variant);

  UPDATE coaching.exercise_variant_v1 SET
    variant_key='superseded-source-43-skeleton',display_name='Tibialis Raises Legacy Skeleton — Source 43',
    modifier_keys='{}'::TEXT[],difficulty_json='{}'::JSONB,status='archived',
    requirements_json=jsonb_build_object('selectable',FALSE,'representation','superseded_source_skeleton',
      'sourceLegacyExerciseId',43,'archiveReason','exact wall and heel contacts bilateral action forefoot start return endpoint repetition count anatomy loading fatigue recovery constraints duration substitutions persistence support and review contracts were missing',
      'replacementVariantIds',to_jsonb(active_variant_ids),'humanReviewRequired',TRUE),
    load_profile_json=jsonb_build_object('selectable',FALSE),fatigue_profile_json=jsonb_build_object('selectable',FALSE),
    programming_profile_json=jsonb_build_object('selectionStatus','superseded_source_skeleton','selectable',FALSE,'publicationQuarantined',TRUE),updated_at=now()
  WHERE id=source43_variant;

  UPDATE coaching.exercise_variant_v1 SET
    definition_id=ambiguous_definition,
    variant_key=CASE id WHEN source214_variant THEN 'identity-quarantine-source-214'
      WHEN source1113_variant THEN 'identity-quarantine-source-1113-distance-jump-context'
      ELSE 'identity-quarantine-source-1399-kicking-context' END,
    display_name=CASE id WHEN source214_variant THEN 'Tibialis Raise Ambiguous Contract — Source 214'
      WHEN source1113_variant THEN 'Tibialis Raise Ambiguous Distance-Jump Context — Source 1113'
      ELSE 'Tibialis Raise Ambiguous Kicking Context — Source 1399' END,
    modifier_keys='{}'::TEXT[],difficulty_json='{}'::JSONB,status='archived',
    requirements_json=jsonb_build_object('selectable',FALSE,'representation','ambiguous_source_identity',
      'sourceLegacyExerciseId',CASE id WHEN source214_variant THEN 214 WHEN source1113_variant THEN 1113 ELSE 1399 END,
      'archiveReason','wall contact stance laterality start endpoint and repetition count are missing and cannot be inferred from the name or sport context',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    load_profile_json=jsonb_build_object('selectable',FALSE),fatigue_profile_json=jsonb_build_object('selectable',FALSE),
    programming_profile_json=jsonb_build_object('selectionStatus','identity_quarantine','selectable',FALSE,'publicationQuarantined',TRUE),updated_at=now()
  WHERE id IN(source214_variant,source1113_variant,source1399_variant);

  UPDATE coaching.exercise_definition_v1 SET
    slug='tibialis-raise-ambiguous-legacy-214-1113-1399',
    canonical_name='Tibialis Raise — Ambiguous Legacy Sources',display_name='Tibialis Raise — Ambiguous Legacy Sources 214, 1113, and 1399',
    aliases=ARRAY['Tibialis Raise Source 214','Tibialis Raise Distance Jump Context Source 1113','Tibialis Raise Kicking Context Source 1399']::TEXT[],
    status='archived',approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,last_reviewed_at=NULL,
    provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,'identityStatus','needs_human_review',
      'missingIdentityFacts',jsonb_build_array('wall_contact','stance','laterality','start','endpoint','count'),
      'selectable',FALSE,'humanReviewRequired',TRUE,'approvalsCreated',FALSE),updated_at=now()
  WHERE id=ambiguous_definition;

  INSERT INTO coaching.exercise_definition_v1(
    id,facility_id,legacy_exercise_id,slug,canonical_name,display_name,aliases,description,family_key,
    schema_version,card_version,status,content_confidence,scoring_confidence,media_confidence,
    movement_patterns,body_regions,required_equipment,optional_equipment,environment_json,population_json,
    provenance_json,approved_video_url,reviewed_by,approved_by,last_reviewed_at,anatomy_json,
    athlete_support_json,coach_support_json,support_operations_json)
  VALUES(
    canonical_definition,1,43,'wall-supported-bilateral-tibialis-raise',
    'Wall-Supported Bilateral Tibialis Raise','Wall-Supported Bilateral Tibialis Raise',
    ARRAY['Tibialis Raises','Tibialis Raise','Wall Tibialis Raise','Tibialis Wall Raises','Anterior Tibialis Raise'],
    'Stand with the back and pelvis supported by a stable wall, both heels planted on a dry nonslip floor, feet slightly forward, forefeet resting lightly, and knees mostly straight without forced locking. Keep wall and heel contact fixed. Lift both forefeet together toward the shins through comfortable active ankle dorsiflexion, then lower both forefeet under control to light floor contact. Count one complete lift-and-return cycle as one repetition. Foot distance, stance width, comfortable range, tempo, brief non-dose top pause, breathing, repetitions, sets, rest, footwear, and delivery context are annotations. Unilateral, alternating, bent-knee, heel-elevated, unsupported, seated, resisted, externally loaded, isometric-only, eccentric-only, heel-walking, toe-dissociation, ankle-pump, calf-raise, clinical-assessment, or added sport-action tasks change the variant or definition.',
    'wall_supported_ankle_dorsiflexion_raise','2.0.0',2,'review',88,60,50,
    ARRAY['brace']::TEXT[],ARRAY['foot','ankle','calf','knee','hip','core']::TEXT[],
    ARRAY['wall']::TEXT[],ARRAY['none']::TEXT[],
    jsonb_build_object(
      'surface','dry clean level stable nonslip floor beside a structurally sound unobstructed wall',
      'space','one wall station with clear foot placement entry exit and no cross traffic',
      'stationCapacity',1,'equipmentKey','wall','optionalEquipment',jsonb_build_array('none'),
      'coachSightline','side and front-quarter views of wall contact knees heels forefeet bilateral timing range breathing and symptoms',
      'inspection',jsonb_build_array('wall stability cleanliness protrusions and usable contact area','floor traction level cleanliness and debris','footwear traction and heel geometry','station separation and cross traffic','entry exit communication and emergency route'),
      'changeRule','Any support laterality knee position heel height footwear resistance load action count dose symptom space or downstream-demand change requires full revalidation.'),
    jsonb_build_object(
      'exerciseCardDoesNotClassifyParticipants',TRUE,'readinessIsWorkoutInput',TRUE,
      'selectionPrerequisites',jsonb_build_array('safe wall approach setup and exit','stable inspected wall and nonslip floor','comfortable bilateral heel contact and mostly-straight-knee wall support','comfortable active dorsiflexion lift and controlled return','can keep heel and wall contact with synchronized forefeet','understands one complete lift-and-return count and stop signal','same-session anterior-shin ankle calf running landing jumping cutting kicking and lower-body budgets fit'),
      'excludeOrEscalate',jsonb_build_array('recent significant trauma surgery or procedure without applicable clearance','worsening night post-trauma sharp increasing or unfamiliar pain','new numbness tingling weakness altered circulation foot drop or loss of control','foot ankle Achilles calf shin knee hip or back symptoms preventing the exact task','dizziness faintness nausea visual change chest pain unusual breathlessness disorientation or inability to communicate','clinical restriction conflicting with active dorsiflexion or wall support','unsafe wall floor footwear space traffic sightline or emergency route','participant requests stop'),
      'notEstablishedByEvidence',jsonb_build_array('universal eligibility wall distance stance range tempo dose frequency fatigue ceiling recovery progression or outcome','diagnosis treatment prevention correction readiness clearance or clinical threshold','isolated tibialis anterior loading','guaranteed foot-clearance running landing jumping cutting kicking or injury-prevention transfer','age floor or participant classification')),
    jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,'canonicalAuthoredFromResearch',TRUE,
      'identityAuthority','legacy_source_43_exact_wall_supported_contract_bounded_by_external_research',
      'legacySources',jsonb_build_array(43),'excludedAmbiguousLegacySources',jsonb_build_array(214,1113,1399),
      'identityContract','wall_supported_bilateral_heels_planted_forefeet_active_dorsiflexion_lift_and_controlled_return_to_light_floor_contact',
      'researchSources',jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC9277928/','https://pmc.ncbi.nlm.nih.gov/articles/PMC11191291/','https://pmc.ncbi.nlm.nih.gov/articles/PMC4487336/','https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/','https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en'),
      'confidenceBySection',jsonb_build_object('identity',88,'taxonomy',86,'anatomy',82,'difficulty',60,'load',70,'fatigueRecovery',52,'constraints',82,'dosage',58,'instructions',88,'alternates',92,'media',50),
      'unresolvedClaims',jsonb_build_array('one universal wall distance stance range tempo dose frequency fatigue ceiling recovery progression or outcome','numeric difficulty calibration','Sources 214 1113 and 1399 exact identity','media playback exact mechanics captions accessibility quality safety and approval','individual symptom interpretation or clinical eligibility'),
      'externalPlaybackVerificationPerformed',FALSE,'oEmbedMetadataChecked',TRUE,'sourceLimitationsExplicit',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,'publicationQuarantined',TRUE),
    NULL,NULL,NULL,NULL,
    jsonb_build_object(
      'primaryMuscles',jsonb_build_array('tibialis_anterior'),
      'secondaryMuscles',jsonb_build_array('extensor_hallucis_longus','extensor_digitorum_longus','fibularis_tertius','intrinsic_foot_muscles'),
      'stabilizers',jsonb_build_array('gastrocnemius_and_soleus','tibialis_posterior_and_fibularis_group','quadriceps','hip_and_trunk_stabilizers'),
      'joints',jsonb_build_array('interphalangeal_and_metatarsophalangeal','midfoot','subtalar','talocrural_ankle','distal_tibiofibular_complex','knee','hip','lumbopelvic_complex'),
      'jointActions',jsonb_build_array('active_ankle_dorsiflexion','controlled_return_toward_plantarflexion','foot_frontal_and_transverse_plane_stabilization','knee_extension_position_hold','wall_supported_trunk_and_pelvis_stabilization'),
      'planes',jsonb_build_array('sagittal','frontal_stabilization','transverse_stabilization'),
      'laterality','bilateral simultaneous ankle action',
      'supportContacts',jsonb_build_array('back_and_pelvis_on_wall','left_heel_on_floor','right_heel_on_floor','forefeet_lightly_on_floor_at_start_and_finish'),
      'sequence',jsonb_build_array('wall_supported_start','heels_fixed','both_forefeet_active_lift','comfortable_dorsiflexion_endpoint','controlled_bilateral_return','light_forefoot_floor_contact_one_repetition'),
      'claimsBoundary','The task loads ankle dorsiflexors with contributions from several anterior lower-leg and foot muscles; it does not isolate tibialis anterior or prove gait performance treatment prevention readiness or a normal range.'),
    jsonb_build_object(
      'whyItMatters','Builds controlled ankle-dorsiflexion capacity with a wall-supported body position and no impact.',
      'primaryCue','Keep both heels heavy while both forefeet lift and return quietly.',
      'secondaryCues',jsonb_build_array('keep your back and pelvis on the wall','knees mostly straight','lift together','lower without a slap','stop before range or control changes'),
      'expectedSensations',jsonb_build_array('local effort at the front of both lower legs','steady heel and wall pressure','normal breathing'),
      'unexpectedSensations',jsonb_build_array('sharp increasing or unfamiliar pain','painful ankle pinching heel pain or cramping that does not ease','numbness tingling weakness altered circulation or loss of foot control','dizziness faintness nausea visual change chest pain or unusual breathlessness'),
      'painGuidance','Stop immediately for sharp, increasing, radiating, neurologic, circulatory, or joint pain and tell the coach. Local muscle effort is acceptable only while range, quiet return, breathing, and normal recovery remain.',
      'selfChecks',jsonb_build_array('wall_contact_stays_fixed','both_heels_stay_planted','knees_do_not_pump','forefeet_lift_together','range_stays_comfortable','return_is_quiet_and_controlled','one_full_cycle_counted','breathing_continues'),
      'accessibility',jsonb_build_object('reducedRange','move the feet closer to the wall or use a smaller comfortable lift','reducedCapacity','use fewer repetitions and more rest','hearingSupport','use a visible start stop and repetition count','visionSupport','use clear verbal wall heel lift and quiet-return cues','cognitiveSupport','use one cue and a three-repetition rehearsal','changedSupport','select a separately validated seated or assisted task'),
      'readingLevel','plain_language','localizationKey','exercise.wall_supported_bilateral_tibialis_raise',
      'mediaAlternatives',jsonb_build_object('captionsRequired',TRUE,'transcriptRequired',TRUE,'stillSequenceRequired',TRUE,'audioDescriptionRequired',TRUE,'requiredAngles',jsonb_build_array('side','front_oblique'))),
    jsonb_build_object(
      'observationChecklist',jsonb_build_array('wall floor footwear and station are safe','back and pelvis retain wall support','both heels remain planted','knees remain mostly straight without forced locking','forefeet lift together through comfortable range','return is controlled to light contact without slap','breathing symptoms first fault actual repetitions and duration are recorded'),
      'faultCorrections',jsonb_build_array(
        jsonb_build_object('fault','heel_lifts','action','reduce range or wall distance and re-establish heel pressure'),
        jsonb_build_object('fault','knee_pumps_or_hips_rock','action','reduce repetitions and restore quiet wall-supported body line'),
        jsonb_build_object('fault','forefeet_asynchronous_or_rotate','action','reduce range and cue both forefeet straight up together'),
        jsonb_build_object('fault','forefoot_slaps','action','slow the return reduce range or end the set'),
        jsonb_build_object('fault','symptom_or_loss_of_control','action','stop and follow facility escalation policy')),
      'demonstrationPlan',jsonb_build_object('angles',jsonb_build_array('side','front_oblique'),'showCorrectReps',3,'showCommonFaults',jsonb_build_array('heel_lift','knee_pump','forefoot_slap'),'comprehensionCheck','Ask the athlete to show heel contact and explain when one repetition ends and when to stop.'),
      'groupManagement',jsonb_build_object('format','individual_wall_stations_or_observed_pairs','athletesPerStation',1,'coachSightLine','side and front-quarter view of wall knees heels and forefeet','queueRule','next athlete waits outside the wall station','equipmentSharing','inspect and reset wall and floor area between users'),
      'modificationDecisionTree',jsonb_build_array(jsonb_build_object('when','pain_neurologic_circulatory_or_systemic_symptom','action','stop_and_escalate'),jsonb_build_object('when','heel_wall_knee_timing_or_return_control_fails','action','reduce_range_wall_distance_or_repetitions_then_reassess'),jsonb_build_object('when','clean_below_target_effort','action','progress_repetitions_or_wall_distance_within_profile_next_set'),jsonb_build_object('when','support_or_action_must_change','action','select_separately_validated_variant_and_recompute_workout')),
      'doNotUseWhen',jsonb_build_array('wall floor footwear or station is unsafe','exact wall-supported heel-planted bilateral task is not tolerated or understood','current lower-leg ankle foot knee hip or back symptoms conflict','local fatigue would compromise later priority running landing jumping cutting kicking or lower-body work','the intended service is diagnosis treatment or maximal testing'),
      'scopeBoundary','Coach observable setup action count exposure and stop rules; do not diagnose shin pain weakness foot drop restriction or pathology, prescribe rehabilitation, promise prevention, infer clearance, or force range.'),
    jsonb_build_object(
      'issueCategories',jsonb_build_array('unsafe','unclear_instruction','inaccurate','duplicate','inaccessible','broken_media','symptom_report','equipment_or_environment'),
      'supportEscalation',jsonb_build_object('safety','stop remove from selection follow facility emergency and incident policy','brokenMedia','quarantine candidate and schedule qualified re-review','identity','route Sources 214 1113 and 1399 to qualified identity review','contentQuestion','route to coaching content queue','clinicalQuestion','refer through facility clinical escalation policy'),
      'retentionPolicy',jsonb_build_object('athleteFeedbackDays',365,'incidentEvidence','facility_policy','rawFreeTextContainsHealthData',TRUE,'persistVersionedWorkoutFacts',TRUE),
      'changeImpactPolicy',jsonb_build_object('identityChange','invalidate selection release saved substitutions and media exactness','safetyChange','invalidate current release and notify workout owners','instructionChange','new card version and comprehension review','mediaChange','invalidate media review','scoreOrDoseChange','revalidate saved workouts templates duration fatigue and recovery'),
      'feedbackPrompts',jsonb_build_array('pain_or_unexpected_sensation','difficulty_and_local_fatigue','clarity_and_confidence','wall_floor_or_footwear_problem','media_accessibility','substitution_reason','actual_repetitions_and_first_fault')))
  ON CONFLICT(id) DO UPDATE SET
    facility_id=EXCLUDED.facility_id,legacy_exercise_id=EXCLUDED.legacy_exercise_id,slug=EXCLUDED.slug,
    canonical_name=EXCLUDED.canonical_name,display_name=EXCLUDED.display_name,aliases=EXCLUDED.aliases,
    description=EXCLUDED.description,family_key=EXCLUDED.family_key,schema_version=EXCLUDED.schema_version,
    card_version=EXCLUDED.card_version,status='review',content_confidence=EXCLUDED.content_confidence,
    scoring_confidence=EXCLUDED.scoring_confidence,media_confidence=EXCLUDED.media_confidence,
    movement_patterns=EXCLUDED.movement_patterns,body_regions=EXCLUDED.body_regions,
    required_equipment=EXCLUDED.required_equipment,optional_equipment=EXCLUDED.optional_equipment,
    environment_json=EXCLUDED.environment_json,population_json=EXCLUDED.population_json,
    provenance_json=EXCLUDED.provenance_json,approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,last_reviewed_at=NULL,
    anatomy_json=EXCLUDED.anatomy_json,athlete_support_json=EXCLUDED.athlete_support_json,
    coach_support_json=EXCLUDED.coach_support_json,support_operations_json=EXCLUDED.support_operations_json,updated_at=now();

  INSERT INTO coaching.exercise_variant_v1(
    id,definition_id,variant_key,display_name,modifier_keys,difficulty_json,requirements_json,status,
    load_profile_json,fatigue_profile_json,programming_profile_json)
  VALUES(
    exact_variant,canonical_definition,'wall-supported-bilateral-lift-and-controlled-return',
    'Wall-Supported Bilateral Tibialis Raise',
    ARRAY['wall_distance','stance_width','foot_angle','active_range','tempo','brief_pause','breathing','repetitions','sets','rest','effort','footwear','delivery_context']::TEXT[],
    jsonb_build_object('technicalComplexity',18,'absoluteLoadDemand',24,'physicalDifficulty',24,'coordinationDemand',16,
      'supervisionDemand',10,'failureConsequence',8,'impact',1,'workCapacityDemand',22,
      'baseOverallDifficulty',greatest(18,24),'overallFormula','max(exercise_complexity,physical_difficulty)',
      'exerciseDifficultyDescribesTaskOnly',TRUE,'candidateCalibrationOnly',TRUE,'humanReviewRequired',TRUE),
    jsonb_build_object('selectable',TRUE,'equipment',jsonb_build_array('wall'),
      'base','standing_back_and_pelvis_supported_by_wall_bilateral_heels_planted',
      'supportContacts',jsonb_build_array('back_and_pelvis_on_wall','left_heel_on_floor','right_heel_on_floor','forefeet_lightly_on_floor_at_start_and_finish'),
      'start','feet slightly forward forefeet lightly contacting floor knees mostly straight without forced locking and wall contact fixed',
      'action','lift both forefeet together by active comfortable ankle dorsiflexion while heels wall pelvis and knees stay controlled',
      'return','lower both forefeet together under control to light floor contact without slap',
      'countingRule','one simultaneous bilateral lift and controlled return to light forefoot contact is one repetition',
      'validCompletion','wall and heel contacts remain fixed knees and hips do not pump forefeet lift together through comfortable range and return quietly breathing continues and no stop rule occurs',
      'invalidCompletion',jsonb_build_array('heel_lift_or_slide','wall_or_pelvis_contact_lost','knee_pumping_or_forced_lock','hip_or_trunk_momentum','asynchronous_forefeet','dominant_foot_rotation_or_toe_only_substitution','forefoot_slap_or_uncontrolled_drop','unilateral_alternating_bent_knee_heel_elevated_unsupported_seated_resisted_loaded_hold_eccentric_only_locomotion_or_other_action','breath_hold','symptom_stop'),
      'variantBoundaries',jsonb_build_array('support','laterality','knee_position','heel_height','external_force','external_load','contraction_only_emphasis','locomotion','clinical_measurement','sport_action','count'),
      'clinicalAssessmentOrTreatment',FALSE,'humanReviewRequired',TRUE),
    'review',
    jsonb_build_object('loadingType','bodyweight_leverage_wall_supported_bilateral_ankle_dorsiflexion_cycle',
      'externalLoadMethod','bodyweight leverage set by wall distance with no added resistance or external load',
      'gripDemand',1,'jointStress',18,'spinalLoading',4,'eccentricStress',20,
      'landingContactsPerRep',0,'handImpactContactsPerRep',0,'impactClass','none',
      'primaryExposure',jsonb_build_array('active_ankle_dorsiflexion','controlled_return_toward_plantarflexion','anterior_lower_leg_local_loading','heel_pressure','wall_supported_body_line','bilateral_timing'),
      'tracking',jsonb_build_array('variant_and_profile','wall_floor_footwear_and_station','wall_distance_stance_and_knee_position','planned_and_actual_valid_repetitions','range_tempo_pause_effort_and_rest','valid_invalid_partial_and_symptom_limited_attempts','heel_wall_knee_hip_timing_rotation_and_return_faults','first_fault','symptoms','duration','same_session_anterior_shin_ankle_calf_running_landing_jumping_cutting_kicking_and_lower_body_exposure')),
    jsonb_build_object('localMuscleFatigue',32,'gripFatigue',1,'technicalFatigueSensitivity',18,'impactAccumulation',1,
      'recoveryHours',24,'recoveryRangeHours',jsonb_build_array(12,36),
      'primaryFatigueSites',jsonb_build_array('ankle_dorsiflexors','anterior_lower_leg','foot_stabilizers','quadriceps_and_postural_stabilizers'),
      'cumulativeBudget',jsonb_build_object('validRepetitions',80,'activeWorkSeconds',360,'anteriorShinLoad',40,'lowerLegExposure',36,'technicalSensitivity',18,'impact',0),
      'interference',jsonb_build_array('later_priority_running_landing_jumping_cutting_kicking_or_ankle_work','same_session_foot_ankle_Achilles_calf_shin_or_lower_leg_loading','fatigue_that_changes_range_heel_contact_bilateral_timing_or_controlled_return'),
      'recoveryIsPlanningEstimate',TRUE,'tissueThresholdNotEstablished',TRUE),
    jsonb_build_object('trainingStimuli',jsonb_build_array('wall_supported_ankle_dorsiflexor_loading','bilateral_heel_supported_forefoot_lift','controlled_sagittal_return'),
      'stimulusDose',jsonb_build_object('sets',jsonb_build_array(1,4),'repetitions',jsonb_build_array(6,20),'secondsPerRep',jsonb_build_array(3,6),'restSeconds',jsonb_build_array(20,90)),
      'weeklyExposure',jsonb_build_object('minimum',0,'maximumWithoutReview',4,'unit','sessions','contextDependent',TRUE),
      'prerequisites',jsonb_build_array('safe_wall_approach_setup_and_exit','stable_inspected_wall_nonslip_floor_and_traction','comfortable_wall_and_bilateral_heel_support','comfortable_active_dorsiflexion_and_controlled_return','mostly_straight_knee_tolerance','understands_complete_cycle_count_and_stop','same_session_lower_leg_and_priority_work_budgets_fit'),
      'completionCriteria',jsonb_build_array('wall_and_pelvis_contact_fixed','heels_planted','knees_mostly_straight_without_forced_lock','forefeet_lift_together','comfortable_repeatable_range','controlled_quiet_return','correct_count','continuous_breathing','no_stop_symptom'),
      'sequenceRules',jsonb_build_array('prepare_or_capacity_context_only','count_each_complete_bilateral_lift_and_return','do_not_turn_wall_distance_stance_range_tempo_brief_pause_breathing_dose_footwear_or_context_into_hidden_variants','do_not_add_unilateral_alternating_bent_knee_heel_elevation_unsupported_seated_resistance_load_hold_eccentric_only_locomotion_assessment_or_sport_action_silently','revalidate_downstream_running_landing_jumping_cutting_kicking_and_lower_body_load'),
      'pairingCompatibility',jsonb_build_object('compatible',jsonb_build_array('low_dose_lower_leg_preparation','separate_resilience_or_capacity_accessory_when_recovery_fits'),'avoid',jsonb_build_array('fatiguing_dose_before_priority_running_landing_jumping_cutting_or_kicking','symptom_provoking_dorsiflexion','same_session_lower_leg_budget_exceeded')),
      'interferenceRules',jsonb_build_array('count_all_overlapping_anterior_shin_ankle_calf_running_landing_jumping_cutting_kicking_and_lower_body_work','stop_before_range_heel_contact_wall_contact_bilateral_timing_or_return_control_changes'),
      'uncertaintyPolicy','When exact support laterality knee position heel contact action count symptoms wall safety or available time is uncertain do not select; request clarification or choose a separately validated card.',
      'selectionStatus','review_only_machine_complete','publicationQuarantined',TRUE,'exerciseDifficultyDescribesTaskOnly',TRUE,'approvalsCreated',FALSE))
  ON CONFLICT(id) DO UPDATE SET definition_id=EXCLUDED.definition_id,variant_key=EXCLUDED.variant_key,
    display_name=EXCLUDED.display_name,modifier_keys=EXCLUDED.modifier_keys,difficulty_json=EXCLUDED.difficulty_json,
    requirements_json=EXCLUDED.requirements_json,status='review',load_profile_json=EXCLUDED.load_profile_json,
    fatigue_profile_json=EXCLUDED.fatigue_profile_json,programming_profile_json=EXCLUDED.programming_profile_json,updated_at=now();

  INSERT INTO coaching.exercise_delivery_profile_v1(
    id,variant_id,profile_key,phase_key,role,purpose,phase_suitability,methodology_alignment,
    objective_relevance_json,dosage_json,quality_gate,stop_rules,coach_instructions,
    athlete_instructions,expected_adaptation,equipment_required,logistics_json,
    substitution_ids,status,time_model_json,dose_scaling_json,measurement_json,support_prompts_json)
  SELECT p.id,exact_variant,p.profile_key,p.phase_key,'primary',p.purpose,p.phase_suitability,p.methodology_alignment,
    jsonb_build_object('ankle_dorsiflexor_capacity',CASE WHEN p.phase_key='capacity' THEN 94 ELSE 76 END,
      'lower_leg_preparation',CASE WHEN p.phase_key='prepare_and_access' THEN 94 ELSE 74 END,
      'bilateral_control',88,'low_impact',98),
    CASE WHEN p.phase_key='capacity' THEN
      jsonb_build_object('sets',jsonb_build_array(2,4),'repetitions',jsonb_build_array(8,20),'secondsPerRep',jsonb_build_array(3,6),'restSeconds',jsonb_build_array(45,90),'targetEffortRpe',jsonb_build_array(5,8),'exampleDoseIsNotUniversal',TRUE)
    ELSE
      jsonb_build_object('sets',jsonb_build_array(1,2),'repetitions',jsonb_build_array(6,12),'secondsPerRep',jsonb_build_array(3,5),'restSeconds',jsonb_build_array(20,45),'targetEffortRpe',jsonb_build_array(3,5),'exampleDoseIsNotUniversal',TRUE)
    END,
    'The wall and pelvis contact stay fixed; both heels stay planted; knees remain mostly straight without forced locking; both forefeet lift together through comfortable repeatable range and return quietly under control; breathing continues; and no stop rule occurs.',
    ARRAY[
      'Sharp, increasing, night, post-trauma, or unfamiliar pain or participant stop request.',
      'Foot, ankle, Achilles, calf, shin, knee, hip, or back symptoms prevent the exact task.',
      'Painful pinching, catching, instability, giving way, uncontrolled cramping, or loss of foot control.',
      'Numbness, tingling, weakness, altered circulation, foot drop, or another neurologic sign.',
      'Dizziness, faintness, nausea, visual change, chest pain, unusual breathlessness, disorientation, or inability to communicate.',
      'Wall or pelvis contact is lost, either heel lifts or slides, or the knees or hips pump to create range.',
      'Forefeet do not lift together, rotate materially, lose repeatable range, or slap the floor on return.',
      'A unilateral, alternating, bent-knee, heel-elevated, unsupported, seated, resisted, loaded, isometric-only, eccentric-only, heel-walk, clinical, or sport task cannot be corrected safely.',
      'Wall integrity, floor traction, footwear, space, traffic, sightline, communication, or emergency route becomes unsafe.',
      'The planned repetition, work-time, local-fatigue, duration, or downstream lower-leg exposure budget is reached.'
    ]::TEXT[],
    'Verify the exact wall-supported bilateral task, stable wall, nonslip floor, footwear, heel contact, mostly straight knees, current symptoms and restrictions, wall distance, planned dose, time, and downstream work. Demonstrate the start, simultaneous forefoot lift, comfortable endpoint, controlled quiet return, one-cycle count, scaling, stop, and exit. Observe wall and heel contact, knees, hips, bilateral timing, range, breathing, symptoms, first fault, actual duration, and safe exit. Do not diagnose shin or ankle problems, provide treatment, force range, or imply readiness.',
    'Keep your back and hips on the wall and both heels heavy. Lift both forefeet toward your shins together, then lower quietly to the floor for one rep. Stop for pain, pinching, cramping, tingling, weakness, dizziness, or loss of control.',
    CASE WHEN p.phase_key='capacity'
      THEN 'More repeatable wall-supported bilateral ankle-dorsiflexion work capacity under the reviewed dose; no treatment, prevention, structural, readiness, gait, or sport outcome is guaranteed.'
      ELSE 'More consistent low-dose control of the exact wall-supported bilateral ankle-dorsiflexion cycle during preparation; no treatment, prevention, readiness, or performance outcome is guaranteed.' END,
    ARRAY['wall']::TEXT[],
    jsonb_build_object('stationCapacity',1,'base','standing_back_and_pelvis_supported_by_wall',
      'requiredEquipment','wall','space','one_clear_wall_station_with_foot_placement_entry_and_exit_space',
      'setupSeconds',20,'coachSightline','side_and_front_quarter','crossTrafficProhibited',TRUE,
      'wallFloorAndFootwearInspectionRequired',TRUE,'revalidateAfterAnyChange',TRUE),
    ARRAY[iso_variant,eccentric_variant,ankle_cars_variant,calf_variant,foot_tripod_variant]::UUID[],
    'review',
    jsonb_build_object('durationFormula','wall_floor_footwear_and_body_setup_seconds + sum(actual_valid_repetitions * actual_seconds_per_repetition) + rest_seconds + invalid_or_partial_attempt_seconds + symptom_response_seconds + substitution_seconds + station_reset_and_exit_seconds',
      'secondsPerRep',CASE WHEN p.phase_key='capacity' THEN jsonb_build_array(3,6) ELSE jsonb_build_array(3,5) END,
      'minimumSeconds',CASE WHEN p.phase_key='capacity' THEN 120 ELSE 50 END,
      'typicalSeconds',CASE WHEN p.phase_key='capacity' THEN 300 ELSE 100 END,
      'maximumSecondsWithoutReview',CASE WHEN p.phase_key='capacity' THEN 720 ELSE 240 END,
      'includeActualNotPlanned',TRUE,'recomputeAfterSubstitution',TRUE),
    jsonb_build_object('regressionOrder',jsonb_build_array('reduce_repetitions','move_feet_closer_to_wall','reduce_to_comfortable_active_range','slow_and_control_return','increase_rest','end_set','select_separately_validated_task'),
      'progressionOrder',jsonb_build_array('complete_clean_repetitions','increase_repetitions_within_profile','increase_wall_distance_slightly','increase_sets_within_profile','select_reviewed_unilateral_resisted_or_loaded_variant_after_full_revalidation'),
      'neverScaleByIgnoringSymptomsLosingHeelOrWallContactForcingKneeLockAddingLoadOrChangingTaskSilently',TRUE),
    jsonb_build_object('record',jsonb_build_array('definition_variant_profile_and_card_version','wall_floor_footwear_station_and_wall_distance','stance_knee_position_and_support_contacts','planned_and_actual_valid_repetitions','range_tempo_pause_effort_and_rest','valid_invalid_partial_and_symptom_limited_attempts','heel_wall_knee_hip_timing_rotation_and_return_faults','first_fault','symptoms_and_stop_reason','active_work_seconds','duration','substitution','station_reset_and_exit'),
      'validUnit','one_simultaneous_bilateral_forefoot_lift_and_controlled_return_to_light_floor_contact_with_wall_and_heel_support_valid',
      'invalidUnitsTrackedSeparately',TRUE,'doNotConvertToHoldSecondsHeelWalkDistanceClinicalForceOrSportActions',TRUE),
    jsonb_build_object('athlete',jsonb_build_array('wall_contact','heels_heavy','knees_quiet','lift_together','comfortable_range','quiet_return','one_cycle_one_rep','stop_for_unexpected_symptoms'),
      'coach',jsonb_build_array('verify_exact_identity','inspect_wall_floor_footwear_and_station','observe_support_timing_range_return_and_count','record_actual_exposure_and_first_fault','revalidate_every_substitution'),
      'accessibility',jsonb_build_array('side_and_front_quarter_visual','written_start_lift_return_sequence','smaller_range_fewer_repetitions_closer_wall_and_more_rest','visible_start_stop_and_count','captions_transcript_still_images_or_live_instruction'),
      'escalation',jsonb_build_array('stop','stabilize_and_exit_wall_station','follow_facility_policy','record_observed_facts','do_not_resume_without_reassessment'))
  FROM (VALUES
    ('e2bb4114-0f23-40b1-bbf6-370c5f2c5be9'::UUID,'prepare-wall-supported-bilateral-tibialis-raise','prepare_and_access',92,90,
      'Use a low-dose exact wall-supported bilateral tibialis raise only when it improves preparation without creating local fatigue before priority running, landing, jumping, cutting, kicking, or lower-body work.'),
    ('e81cdd7d-a7f8-4e02-9507-88cfe4d1d789'::UUID,'capacity-wall-supported-bilateral-tibialis-raise','capacity',90,90,
      'Use the exact wall-supported bilateral cycle as lower-leg capacity work only when recovery, local fatigue, technique, symptoms, duration, and the full session budget fit.')
  ) p(id,profile_key,phase_key,phase_suitability,methodology_alignment,purpose)
  ON CONFLICT(id) DO UPDATE SET variant_id=EXCLUDED.variant_id,profile_key=EXCLUDED.profile_key,
    phase_key=EXCLUDED.phase_key,role=EXCLUDED.role,purpose=EXCLUDED.purpose,
    phase_suitability=EXCLUDED.phase_suitability,methodology_alignment=EXCLUDED.methodology_alignment,
    objective_relevance_json=EXCLUDED.objective_relevance_json,dosage_json=EXCLUDED.dosage_json,
    quality_gate=EXCLUDED.quality_gate,stop_rules=EXCLUDED.stop_rules,
    coach_instructions=EXCLUDED.coach_instructions,athlete_instructions=EXCLUDED.athlete_instructions,
    expected_adaptation=EXCLUDED.expected_adaptation,equipment_required=EXCLUDED.equipment_required,
    logistics_json=EXCLUDED.logistics_json,substitution_ids=EXCLUDED.substitution_ids,status='review',
    time_model_json=EXCLUDED.time_model_json,dose_scaling_json=EXCLUDED.dose_scaling_json,
    measurement_json=EXCLUDED.measurement_json,support_prompts_json=EXCLUDED.support_prompts_json,updated_at=now();

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,rationale,evidence_json,
    resolution_source,reviewed_by,resolved_at)
  VALUES(1,canonical_definition,ambiguous_definition,'needs_human_review',
    'Sources 214, 1113, and 1399 do not state wall contact, stance, laterality, start, endpoint, or count, so exact equivalence with Source 43 cannot be proven or rejected.',
    jsonb_build_object('migration',migration_key,'identityBoundary','exact_source43_wall_supported_bilateral_cycle_vs_incomplete_generic_contract',
      'canonicalContract','wall_supported_bilateral_heels_planted_forefoot_lift_and_controlled_return_cycle',
      'requiredEvidence',jsonb_build_array('wall_contact','stance','laterality','start','endpoint','count'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'deterministic_identity_equivalence',NULL,now())
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET decision=EXCLUDED.decision,
    rationale=EXCLUDED.rationale,evidence_json=EXCLUDED.evidence_json,resolution_source=EXCLUDED.resolution_source,
    reviewed_by=NULL,resolved_at=now();

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,rationale,evidence_json,
    resolution_source,reviewed_by,resolved_at)
  SELECT 1,canonical_definition,i.definition_id,'distinct_exercises',i.rationale,
    jsonb_build_object('migration',migration_key,'identityBoundary',i.boundary_key,
      'canonicalContract','wall_supported_bilateral_heels_planted_forefoot_lift_and_controlled_return_cycle',
      'neighborContract',i.neighbor_contract,'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'deterministic_identity_equivalence',NULL,now()
  FROM (VALUES
    (iso_definition,'cyclic_raise_vs_isometric_hold','Tibialis Raise Iso Hold sustains the toe-up position and counts time or effort rather than a lift-and-return cycle.','wall_supported_dorsiflexion_isometric_hold'),
    (eccentric_definition,'complete_active_cycle_vs_eccentric_emphasis','Tibialis Raise Eccentric Lower prescribes a slow negative and leaves assistance, support, and concentric action insufficiently specified.','eccentric_emphasis_or_eccentric_only_task'),
    (ankle_cars_definition,'sagittal_loaded_cycle_vs_multiplanar_non_weight_bearing_circuit','Ankle CARs use a seated free-foot multiplanar circuit rather than a wall-supported sagittal raise.','seated_active_multiplanar_ankle_circuit'),
    (calf_definition,'dorsiflexor_raise_vs_plantarflexor_calf_raise','Calf Raise to Controlled Heel Drop lifts the heels and body mass through plantarflexion; Source 43 keeps heels planted and lifts forefeet.','standing_heel_raise_and_controlled_drop'),
    (toe_yoga_definition,'ankle_dorsiflexion_vs_toe_dissociation','Toe Yoga separates big-toe and lesser-toe actions with the foot supported.','supported_digit_dissociation'),
    (foot_tripod_definition,'forefoot_raise_vs_pressure_shift','Foot Tripod Weight Shifts retain foot contact and shift plantar pressure instead of lifting both forefeet.','supported_plantar_pressure_shift')
  ) i(definition_id,boundary_key,rationale,neighbor_contract)
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET decision=EXCLUDED.decision,
    rationale=EXCLUDED.rationale,evidence_json=EXCLUDED.evidence_json,resolution_source=EXCLUDED.resolution_source,
    reviewed_by=NULL,resolved_at=now();

  INSERT INTO coaching.exercise_section_evidence_v1(
    definition_id,reviewed_card_version,section_key,source_url,source_title,source_publisher,
    source_kind,claims_json,evidence_quality,review_status,reviewer_user_id,reviewed_at)
  SELECT canonical_definition,2,e.section_key,e.source_url,e.source_title,e.publisher,e.source_kind,
    jsonb_build_array(jsonb_build_object('supported',e.supported_claim,'scope',e.scope),
      jsonb_build_object('limitation',e.limitation,'noUniversalWallDistanceRangeDoseRecoveryOutcomeOrDifficultyClaim',TRUE)),
    e.quality,'candidate',NULL,NULL
  FROM (VALUES
    ('identity','https://pmc.ncbi.nlm.nih.gov/articles/PMC9277928/','Relationship between attachment site of tibialis anterior muscle and shape of tibia: anatomical study of cadavers','Journal of Foot and Ankle Research','peer_reviewed_research','Tibialis anterior is a major ankle dorsiflexor and also contributes to inversion.','direct action and anatomy context','The anatomy study does not define the Source 43 wall support laterality endpoint or count.',88),
    ('taxonomy','https://pmc.ncbi.nlm.nih.gov/articles/PMC4994968/','Biomechanics of the ankle','Orthopaedics and Trauma','peer_reviewed_research','Ankle motion and loading occur across the ankle-foot complex.','direct regional taxonomy context','The review does not define this exact exercise.',90),
    ('anatomy','https://pmc.ncbi.nlm.nih.gov/articles/PMC9277928/','Relationship between attachment site of tibialis anterior muscle and shape of tibia: anatomical study of cadavers','Journal of Foot and Ankle Research','peer_reviewed_research','Tibialis anterior is the largest ankle dorsiflexor and contributes to inversion and medial-arch function.','direct anatomy context','Cadaver anatomy does not establish isolated live-exercise loading or outcomes.',88),
    ('biomechanics','https://pmc.ncbi.nlm.nih.gov/articles/PMC11191291/','The ankle dorsiflexion kinetics demand to increase swing phase foot-ground clearance: implications for assistive device design and energy demands','Journal of NeuroEngineering and Rehabilitation','peer_reviewed_research','Experimentally increased swing clearance used greater dorsiflexion and estimated increased tibialis-anterior force with soleus coactivation.','adjacent functional biomechanics context','This was not a wall-raise training trial and cannot prove transfer.',90),
    ('difficulty','https://pmc.ncbi.nlm.nih.gov/articles/PMC4487336/','Improvement of isometric dorsiflexion protocol for assessment of tibialis anterior muscle strength','Journal of Foot and Ankle Research','peer_reviewed_research','Dorsiflexion force and tibialis-anterior EMG depend on standardized position and fixation.','adjacent task-demand context','The isometric protocol does not validate Vortex task scores.',86),
    ('load_fatigue_recovery','https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/','American College of Sports Medicine Position Stand. Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews','Medicine & Science in Sports & Exercise','professional_standard','Resistance-training adaptation depends on effort volume frequency and progression.','adjacent prescription context','It does not establish exact wall-raise fatigue thresholds or recovery.',94),
    ('constraints','https://pmc.ncbi.nlm.nih.gov/articles/PMC4487336/','Improvement of isometric dorsiflexion protocol for assessment of tibialis anterior muscle strength','Journal of Foot and Ankle Research','peer_reviewed_research','Stabilization and toe fixation alter dorsiflexion force and EMG interpretation.','direct protocol-specificity context','The study does not establish universal eligibility or a safe wall geometry.',86),
    ('dosage','https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/','American College of Sports Medicine Position Stand. Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews','Medicine & Science in Sports & Exercise','professional_standard','Sets repetitions effort rest frequency and progression should match the desired adaptation.','adjacent dosage context','The source does not establish one universal tibialis-raise dose.',94),
    ('instructions','https://pmc.ncbi.nlm.nih.gov/articles/PMC4487336/','Improvement of isometric dorsiflexion protocol for assessment of tibialis anterior muscle strength','Journal of Foot and Ankle Research','peer_reviewed_research','Standardized ankle and toe conditions matter when dorsiflexion is measured.','adjacent setup and observation context','Vortex adds exact dynamic support action return and count rules.',86),
    ('safety_stop_rules','https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf','Youth Resistance Training: Updated Position Statement Paper From the NSCA','National Strength and Conditioning Association','professional_standard','Qualified instruction safe equipment environment appropriate progression and technique supervision are emphasized.','general resistance-training safety context','It does not create an age floor or exact symptom threshold for this card.',90),
    ('programming','https://pmc.ncbi.nlm.nih.gov/articles/PMC11191291/','The ankle dorsiflexion kinetics demand to increase swing phase foot-ground clearance: implications for assistive device design and energy demands','Journal of NeuroEngineering and Rehabilitation','peer_reviewed_research','Ankle dorsiflexion contributes to foot-ground clearance during gait.','adjacent programming rationale','The study did not test wall-raise training or sport outcomes.',90),
    ('athlete_support','https://pmc.ncbi.nlm.nih.gov/articles/PMC9277928/','Relationship between attachment site of tibialis anterior muscle and shape of tibia: anatomical study of cadavers','Journal of Foot and Ankle Research','peer_reviewed_research','Tibialis anterior is a major dorsiflexor rather than the only tissue involved.','direct plain-language anatomy boundary','The study does not validate particular athlete cues.',88),
    ('coach_support','https://pmc.ncbi.nlm.nih.gov/articles/PMC4487336/','Improvement of isometric dorsiflexion protocol for assessment of tibialis anterior muscle strength','Journal of Foot and Ankle Research','peer_reviewed_research','Dorsiflexion observations depend on standardized positioning.','direct observation context','The measurement protocol does not authorize diagnosis or treatment.',86),
    ('accessibility','https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf','Youth Resistance Training: Updated Position Statement Paper From the NSCA','National Strength and Conditioning Association','professional_standard','Instruction supervision environment and progression should fit the participant and task.','general communication and supervision context','Specific accessibility adaptations still require task-preservation review.',90),
    ('alternates','https://pmc.ncbi.nlm.nih.gov/articles/PMC4994968/','Biomechanics of the ankle','Orthopaedics and Trauma','peer_reviewed_research','Dorsiflexion plantarflexion inversion eversion and coupled ankle-foot mechanics are distinguishable.','direct action-boundary context','Exact identity still requires support force laterality endpoint and count facts.',90),
    ('media','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en','Embed videos and playlists','YouTube Help','manufacturer_instruction','Five URLs returned current oEmbed title channel thumbnail and iframe metadata on 2026-08-10.','link and embed metadata only','Playback exact mechanics captions accessibility cue quality safety reviewer and approval remain unverified.',82)
  ) e(section_key,source_url,source_title,publisher,source_kind,supported_claim,scope,limitation,quality)
  ON CONFLICT(definition_id,reviewed_card_version,section_key,source_url) DO UPDATE SET
    source_title=EXCLUDED.source_title,source_publisher=EXCLUDED.source_publisher,source_kind=EXCLUDED.source_kind,
    claims_json=EXCLUDED.claims_json,evidence_quality=EXCLUDED.evidence_quality,review_status='candidate',
    reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_media_candidate_v1(
    definition_id,variant_id,reviewed_card_version,url,embed_url,video_id,title,channel_name,
    duration_seconds,language_code,captions_available,embedding_allowed,exact_variant_match,
    demonstration_quality_score,link_status,review_status,discovery_method,source_query,
    reviewer_user_id,reviewed_at,next_review_at,notes)
  SELECT canonical_definition,exact_variant,2,'https://www.youtube.com/watch?v='||m.video_id,
    'https://www.youtube-nocookie.com/embed/'||m.video_id,m.video_id,m.title,m.channel,NULL,'en',NULL,TRUE,NULL,NULL,
    'healthy','candidate','manual_research',m.query,NULL,NULL,'2026-11-10'::TIMESTAMPTZ,
    'Current YouTube oEmbed metadata only. Playback exact wall and heel support bilateral simultaneous lift comfortable range controlled quiet return count captions accessibility cue quality safety reviewer identity card-version match and approval remain unverified.'
  FROM (VALUES
    ('RHWRxiBe1iU','Anterior Tibialis Raise','Elite Performance Institute','Source 43 legacy candidate checked by YouTube oEmbed; full exact wall-supported bilateral review pending'),
    ('VzIcGAgBiaM','Tibialis Wall Raises (Exercise Demo)','The Barefoot Sprinter','Source 43 legacy candidate checked by YouTube oEmbed; full exact wall-supported bilateral review pending'),
    ('psaTKDL1zUw','Tibialis Raise | Kneesovertoesguy Favorite Exercise #AskKenneth','Lo Kenneth','Source 43 legacy candidate checked by YouTube oEmbed; full exact wall-supported bilateral review pending'),
    ('k9NvBCZfSWg','Wall Tibialis Raise','Loretta Hogg','Wall tibialis raise candidate checked by YouTube oEmbed; full exact wall-supported bilateral review pending'),
    ('0o2GAg2yX5M','Wall Tibialis Raise','Cardinal Strength and Conditioning','Wall tibialis raise candidate checked by YouTube oEmbed; full exact wall-supported bilateral review pending')
  ) m(video_id,title,channel,query)
  ON CONFLICT(definition_id,reviewed_card_version,url) DO UPDATE SET variant_id=exact_variant,
    embed_url=EXCLUDED.embed_url,video_id=EXCLUDED.video_id,title=EXCLUDED.title,channel_name=EXCLUDED.channel_name,
    duration_seconds=NULL,language_code='en',captions_available=NULL,embedding_allowed=TRUE,
    exact_variant_match=NULL,demonstration_quality_score=NULL,link_status='healthy',review_status='candidate',
    discovery_method='manual_research',source_query=EXCLUDED.source_query,reviewer_user_id=NULL,reviewed_at=NULL,
    next_review_at=EXCLUDED.next_review_at,notes=EXCLUDED.notes,updated_at=now();

  INSERT INTO coaching.exercise_alternate_assessment_v1(
    definition_id,reviewed_card_version,alternate_name,classification,rationale,
    distinguishing_dimensions,proposed_card_json,review_status,reviewer_user_id,reviewed_at)
  SELECT canonical_definition,2,a.name,a.classification,a.rationale,
    jsonb_build_object('boundaryKey',a.boundary_key,'factsRequired',a.facts,'neverInferFromNameParticipantRankingOrSportContext',TRUE),
    jsonb_build_object('status',a.proposed_status,'classificationCandidate',a.classification,
      'humanIdentityContentAndSafetyReviewRequired',TRUE,'approvalsCreated',FALSE),
    'candidate',NULL,NULL
  FROM (VALUES
    ('Tibialis Raises','same_identity','Source 43 pluralizes repetitions of the exact wall-supported bilateral cycle.','source43_identity',jsonb_build_array('legacy_exercise_43','same_support_action_and_count'),'canonical_name'),
    ('Wall-Supported Bilateral Tibialis Raise','same_identity','This name makes support and simultaneous laterality explicit without changing the task.','explicit_alias',jsonb_build_array('wall_support','bilateral_cycle'),'canonical_alias'),
    ('Wall Distance or Body-Lean Lever','modifier_annotation','Foot distance changes leverage and physical demand while support heel contact action and count remain unchanged.','wall_distance_modifier',jsonb_build_array('wall_distance'),'annotation'),
    ('Comfortable Dorsiflexion Range','modifier_annotation','A smaller active lift changes amplitude without changing support action return or count.','range_modifier',jsonb_build_array('active_range'),'annotation'),
    ('Controlled Concentric and Return Tempo','modifier_annotation','Tempo changes time under tension while preserving the complete cycle.','tempo_modifier',jsonb_build_array('concentric_tempo','return_tempo'),'annotation'),
    ('Brief Non-Dose Top Pause','modifier_annotation','A brief checkpoint is not an isometric task unless the hold receives prescribed duration or effort.','pause_modifier',jsonb_build_array('brief_pause','no_hold_dose'),'annotation'),
    ('Repetitions Sets Rest or Effort Target','modifier_annotation','Volume recovery and effort change delivery rather than identity.','dose_modifier',jsonb_build_array('repetitions','sets','rest','effort'),'annotation'),
    ('Stance Width and Foot Angle Within Control','modifier_annotation','Comfortable stance details remain annotations while the same bilateral heel-supported sagittal cycle remains.','stance_modifier',jsonb_build_array('stance_width','foot_angle'),'annotation'),
    ('Footwear or Thin Heel Cushion','modifier_annotation','Footwear is an annotation only when traction heel height range and mechanics remain valid.','footwear_modifier',jsonb_build_array('footwear','traction'),'annotation'),
    ('Breathing Prompt or Workout Context','modifier_annotation','Breathing and prepare-versus-capacity delivery do not change the cycle.','context_modifier',jsonb_build_array('breathing','delivery_context'),'annotation'),
    ('Wall-Supported Single-Leg Tibialis Raise','new_variant','Unilateral loading changes force asymmetry fatigue balance and count.','unilateral_variant',jsonb_build_array('unilateral'),'research_queue'),
    ('Alternating Wall-Supported Tibialis Raise','new_variant','Alternation changes timing unilateral exposure balance and repetition accounting.','alternating_variant',jsonb_build_array('alternating'),'research_queue'),
    ('Bent-Knee Wall Tibialis Raise','new_variant','Sustained knee flexion changes support muscle length lower-body demand and faults.','bent_knee_variant',jsonb_build_array('knee_flexion'),'research_queue'),
    ('Heel-Elevated Deficit Wall Tibialis Raise','new_variant','Heel elevation changes range leverage equipment edge safety and load.','heel_elevated_variant',jsonb_build_array('heel_elevation','deficit'),'research_queue'),
    ('Freestanding Bilateral Tibialis Raise','new_variant','Removing wall support changes balance body position failure consequences and supervision.','unsupported_variant',jsonb_build_array('unsupported_standing'),'research_queue'),
    ('Seated Heel-Planted Tibialis Raise','new_variant','Seated support changes bodyweight leverage trunk and knee geometry load and logistics.','seated_variant',jsonb_build_array('seated_support'),'research_queue'),
    ('Band-Resisted Wall Tibialis Raise','new_variant','External elastic force adds anchor safety resistance direction load and fatigue requirements.','band_variant',jsonb_build_array('band_resistance','anchor'),'research_queue'),
    ('Tib-Bar Loaded Dorsiflexion Raise','new_variant','A tib bar adds distal external load apparatus fit torque and different failure consequences.','tib_bar_variant',jsonb_build_array('tib_bar','external_load'),'research_queue'),
    ('Generic Tibialis Raise Sources 214 1113 and 1399','new_definition','These sources omit exact wall contact stance laterality start endpoint and count and stay archived pending review.','ambiguous_legacy_definition',jsonb_build_array('legacy_exercise_214','legacy_exercise_1113','legacy_exercise_1399','identity_contract_incomplete'),'existing_quarantined_definition'),
    ('Tibialis Raise Iso Hold','new_definition','A sustained toe-up position is counted by time or effort rather than cycles.','isometric_definition',jsonb_build_array('isometric_hold'),'existing_distinct_definition'),
    ('Assisted-Up Tibialis Eccentric-Only Lower','new_definition','Assistance creates the top and only the lower is trained changing action and count.','eccentric_only_definition',jsonb_build_array('assisted_up','eccentric_only'),'research_queue'),
    ('Heel Walk','new_definition','Locomotion on the heels adds gait cycles travel balance contacts and distance or time counting.','heel_walk_definition',jsonb_build_array('locomotion','heel_support'),'research_queue'),
    ('Ankle Pumps','new_definition','Non-weight-bearing dorsiflexion and plantarflexion oscillation uses a different base load and count.','ankle_pump_definition',jsonb_build_array('non_weight_bearing','sagittal_oscillation'),'research_queue'),
    ('Toe Yoga','new_definition','Big-toe and lesser-toe dissociation targets digit control rather than the whole-forefoot ankle cycle.','toe_yoga_definition',jsonb_build_array('digit_dissociation'),'existing_distinct_definition'),
    ('Calf Raise to Controlled Heel Drop','new_definition','The heels lift and body mass moves through plantarflexion instead of the forefeet lifting with heels planted.','calf_raise_definition',jsonb_build_array('heel_raise','plantarflexion'),'existing_distinct_definition'),
    ('Clinical Dorsiflexor Strength Assessment','new_definition','Maximal testing adds restraint force measurement interpretation consent documentation and clinical scope.','clinical_assessment_definition',jsonb_build_array('maximal_force_measurement','clinical_scope'),'research_queue')
  ) a(name,classification,rationale,boundary_key,facts,proposed_status)
  ON CONFLICT(definition_id,reviewed_card_version,alternate_name) DO UPDATE SET classification=EXCLUDED.classification,
    rationale=EXCLUDED.rationale,distinguishing_dimensions=EXCLUDED.distinguishing_dimensions,
    proposed_card_json=EXCLUDED.proposed_card_json,review_status='candidate',reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_relationship_v1(
    from_variant_id,to_variant_id,relationship,similarity_score,dimensions,reason,conditions_json,
    review_status,created_by,reviewed_by,reviewed_at)
  SELECT exact_variant,r.to_id,r.relationship,r.score,r.dimensions,r.reason,
    jsonb_build_object('migration',migration_key,'reviewOnly',TRUE,'automaticSubstitution',FALSE,
      'revalidate',jsonb_build_array('identity and purpose','support laterality knee position action and count','wall floor footwear equipment space and exit','symptoms and restrictions','dose duration and logistics','anterior shin ankle calf lower-body and sport budgets','persistence','coach rendering','athlete rendering'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'review',NULL,NULL,NULL
  FROM (VALUES
    (iso_variant,'lateral_substitution',68,ARRAY['complexity','load','range']::TEXT[],'Changes cyclic lift-and-return repetitions to a sustained wall-supported dorsiflexion hold.'),
    (eccentric_variant,'progression',62,ARRAY['complexity','load','range']::TEXT[],'Adds a prescribed slow negative emphasis and requires exact assistance and support revalidation.'),
    (ankle_cars_variant,'lateral_substitution',42,ARRAY['complexity','range','stability']::TEXT[],'Changes wall-supported sagittal loading to a seated non-weight-bearing multiplanar circuit.'),
    (calf_variant,'lateral_substitution',38,ARRAY['load','range','stability']::TEXT[],'Changes heel-planted dorsiflexion loading to heel-raise plantarflexion loading.')
  ) r(to_id,relationship,score,dimensions,reason)
  ON CONFLICT(from_variant_id,to_variant_id,relationship) DO UPDATE SET similarity_score=EXCLUDED.similarity_score,
    dimensions=EXCLUDED.dimensions,reason=EXCLUDED.reason,conditions_json=EXCLUDED.conditions_json,
    review_status='review',created_by=NULL,reviewed_by=NULL,reviewed_at=NULL,updated_at=now()
  WHERE coaching.exercise_relationship_v1.reviewed_by IS NULL AND coaching.exercise_relationship_v1.review_status<>'approved';

  INSERT INTO coaching.exercise_score_calibration_v1(
    facility_id,variant_id,dimension,proposed_score,anchor_tier,rationale,status,version,
    created_by,reviewed_by,review_notes,reviewed_at)
  SELECT 1,exact_variant,d.dimension,CASE d.dimension WHEN 'technicalComplexity' THEN 18 ELSE 24 END,20,
    CASE d.dimension WHEN 'technicalComplexity' THEN
      'Review-only task-complexity anchor based on stable wall and heel contacts, mostly straight knees, simultaneous bilateral forefoot lift, comfortable repeatable range, controlled return, breathing, faults, and exact repetition count.'
    ELSE
      'Review-only task physical-demand anchor based on bodyweight leverage set by wall distance, bilateral ankle-dorsiflexor loading, controlled return, local fatigue, no external load, and no impact.' END
      ||' This scores the exercise task, not the participant.',
    'review',1,NULL,NULL,'Research-informed proposal only; independent comparison and qualified human approval remain required.',NULL
  FROM (VALUES('technicalComplexity'),('absoluteLoadDemand')) d(dimension)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET proposed_score=EXCLUDED.proposed_score,
    anchor_tier=EXCLUDED.anchor_tier,rationale=EXCLUDED.rationale,status='review',created_by=NULL,
    reviewed_by=NULL,review_notes=EXCLUDED.review_notes,reviewed_at=NULL,updated_at=now();

  UPDATE coaching.exercise SET
    name='Wall-Supported Bilateral Tibialis Raise',slug='wall-supported-bilateral-tibialis-raise',
    description='Stand with the back and pelvis supported by a stable wall, both heels planted on a dry nonslip floor, feet slightly forward, forefeet resting lightly, and knees mostly straight without forced locking. Keep wall and heel contact fixed. Lift both forefeet together toward the shins through comfortable active ankle dorsiflexion, then lower both forefeet under control to light floor contact. Count one complete lift-and-return cycle as one repetition.',
    instructions='Use the exact wall-supported bilateral variant on an inspected stable wall and nonslip floor. Keep the back and pelvis supported, heels planted, and knees mostly straight without forced locking. Lift both forefeet together through comfortable range, then lower quietly to light contact for one repetition. Stop for pain, pinching, cramping, instability, numbness, tingling, weakness, altered circulation, loss of foot control, dizziness, faintness, nausea, visual change, chest pain, unusual breathlessness, unsafe wall or floor, or participant request.',
    skill_level=NULL,age_min=NULL,age_max=NULL,default_sets=1,default_reps=10,
    default_work_seconds=40,default_rest_seconds=30,tempo='one to two seconds lift and two to three seconds controlled return',
    load_note='Track wall, floor, footwear, wall distance, stance, knee position, wall and heel contacts, planned and actual valid repetitions, range, tempo, pause, effort, bilateral timing, foot rotation, forefoot return, breathing, first fault, symptoms, invalid or partial attempts, active work, rest, duration, substitution, station reset, exit, and overlapping anterior-shin, ankle, calf, running, landing, jumping, cutting, kicking, and lower-body exposure.',
    est_seconds_per_set=90,is_published=FALSE,archived=FALSE,
    card_summary='Wall-supported bilateral ankle-dorsiflexion raise with planted heels, synchronized forefoot lift, controlled quiet return, and exact repetition count.',
    coach_language='Verify the exact wall-supported bilateral cycle, wall floor and footwear safety, wall and heel contacts, mostly straight knees, comfortable range, synchronized lift, controlled return, symptoms and restrictions, planned dose, actual exposure, first fault, duration, downstream budget, persistence, exit, and escalation.',
    athlete_language='Keep your back and hips on the wall and both heels heavy. Lift both forefeet toward your shins together, then lower quietly for one rep. Stop for pain, pinching, cramping, tingling, weakness, dizziness, or loss of control.',
    programming_logic=jsonb_build_object('selectionStatus','canonical_variant_required','selectable',TRUE,
      'canonicalDefinitionId',canonical_definition,'exactVariantIds',to_jsonb(active_variant_ids),
      'difficultyModel','max_exercise_complexity_physical_difficulty','exerciseDifficultyDescribesTaskOnly',TRUE,
      'selectionInputs',jsonb_build_array('workout purpose and delivery context','stable wall nonslip floor footwear station and exit','wall and bilateral heel support','comfortable active dorsiflexion and mostly straight knees','exact simultaneous lift controlled return and count comprehension','dose wall distance range tempo effort rest and duration','cumulative anterior shin ankle calf lower-body and sport exposure','coach scope and sightline'),
      'substitutionRevalidation',jsonb_build_array('identity','support laterality knee position action and count','wall floor footwear equipment space and exit','restrictions and symptoms','purpose','dose','fatigue and impact budgets','duration','logistics','persistence','coach rendering','athlete rendering'),
      'legacySourceIds',jsonb_build_array(43),'identityQuarantineSourceIds',jsonb_build_array(214,1113,1399),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    scalable_variables=ARRAY['wall_distance','stance_width','foot_angle','active_range','tempo','brief_pause','breathing_prompt','repetitions','sets','rest_seconds','effort_target','footwear','delivery_context']::TEXT[],
    movement_family='Wall-supported ankle dorsiflexion raise',primary_phase_key='prepare_and_access',
    phase_subrole='activate',primary_order_slot='anterior_shin_activation',
    movement_requirements=jsonb_build_object('impact_level',0,'balance_demand','low_with_wall_support',
      'postural_shape','standing_back_and_pelvis_supported_by_wall_bilateral_heels_planted',
      'primary_tissues',jsonb_build_array('ankle_dorsiflexors','anterior_lower_leg','foot_stabilizers'),
      'breathing_demand','continuous_controlled_breathing','coordination_demand','low',
      'primary_joint_actions',jsonb_build_array('ankle_dorsiflexion','controlled_return_toward_plantarflexion','foot_stabilization','knee_position_hold','wall_supported_trunk_and_pelvis_stabilization'),
      'supportContacts',jsonb_build_array('back_and_pelvis_on_wall','left_heel_on_floor','right_heel_on_floor','forefeet_on_floor_at_start_and_finish'),
      'exactSequence',jsonb_build_array('wall_supported_start','heels_fixed','simultaneous_forefoot_lift','comfortable_dorsiflexion_endpoint','controlled_return','light_floor_contact_one_repetition'),
      'exerciseDifficulty',jsonb_build_object('complexity',18,'physicalDifficulty',24,'overall',24,'formula','max')),
    coaching_execution=jsonb_build_object(
      'setup',jsonb_build_array('stable inspected unobstructed wall','dry clean level nonslip floor','secure footwear or approved barefoot surface','back and pelvis supported','feet slightly forward with heels planted and forefeet lightly down','knees mostly straight without forced locking','clear station and exit'),
      'execution_steps',jsonb_build_array('keep wall and both heel contacts fixed','lift both forefeet together toward the shins through comfortable active range','reach a controlled endpoint without knee hip or trunk momentum','lower both forefeet together under control','touch down lightly without slap and count one repetition'),
      'coach_cues',jsonb_build_array('wall contact','heels heavy','knees quiet','lift together','comfortable range','lower quietly','one full cycle one rep','keep breathing'),
      'athlete_cues',jsonb_build_array('heels stay down','toes and forefeet up together','quiet knees','slow return','no slap','stop before form changes'),
      'common_faults',jsonb_build_array('heel lift or slide','loss of wall or pelvis support','knee pumping or forced locking','hip or trunk momentum','asynchronous forefeet','foot rotation or toe-only substitution','rushed range','forefoot slap','breath holding','silent change to another variant'),
      'quality_gate',jsonb_build_array('safe wall floor footwear and station','fixed wall and heel contacts','mostly straight quiet knees','simultaneous bilateral lift','comfortable repeatable active range','controlled quiet return','correct repetition count','continuous breathing','no stop symptom'),
      'stop_signs',jsonb_build_array('sharp increasing night post-trauma or unfamiliar pain','painful pinching catching instability or cramping','numbness tingling weakness altered circulation foot drop or loss of control','dizziness faintness nausea visual change chest pain unusual breathlessness or disorientation','wall heel knee bilateral timing range or return control cannot be restored','unsafe wall floor footwear station or exit','participant stop request'),
      'breathing_cues',jsonb_build_array('breathe continuously','do not brace the jaw or hold breath to gain range'),
      'clinical_scope','This is a workout exercise, not a diagnostic dorsiflexor-strength test, shin-pain treatment, injury-prevention guarantee, clearance, or proof of readiness.'),
    pairing_logic=jsonb_build_object('sameSessionBudget',jsonb_build_array('valid_repetitions','active_work_seconds','anterior_shin_load','ankle_and_lower_leg_exposure','technical_fatigue','downstream_running_landing_jumping_cutting_kicking_and_lower_body_work','impact'),
      'avoidAutomaticPairingWith',jsonb_build_array('fatiguing_lower_leg_work_before_priority_running_landing_jumping_cutting_or_kicking','symptom_provoking_dorsiflexion','same_session_ankle_or_lower_leg_work_exceeding_budget'),
      'revalidateAfterSubstitution',TRUE),
    media_library=jsonb_build_object('candidate_video_ids',jsonb_build_array('RHWRxiBe1iU','VzIcGAgBiaM','psaTKDL1zUw','k9NvBCZfSWg','0o2GAg2yX5M'),
      'reviewState','oembed_metadata_only_candidate_quarantine',
      'playbackExactWallHeelBilateralLiftReturnCountCompensationCaptionsAccessibilityQualitySafetyAndApprovalVerified',FALSE,
      'humanReviewRequired',TRUE),
    participant_structure='individual',programming_kind='exercise',linked_skill_id=NULL,
    why_publish_ready=FALSE,updated_at=now()
  WHERE id=43;

  UPDATE coaching.exercise SET skill_level=NULL,age_min=NULL,age_max=NULL,is_published=FALSE,archived=TRUE,
    why_publish_ready=FALSE,linked_skill_id=NULL,
    programming_logic=jsonb_build_object('selectionStatus','identity_quarantine','selectable',FALSE,
      'canonicalDefinitionId',ambiguous_definition,
      'missingIdentityFacts',jsonb_build_array('wall_contact','stance','laterality','start','endpoint','count'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),updated_at=now()
  WHERE id IN(214,1113,1399);

  UPDATE coaching.exercise_safety_profile SET risk_level=1,impact_level=0,
    minimum_age_recommended=NULL,minimum_skill_level=NULL,requires_spotting=FALSE,
    requires_coach_supervision='recommended',
    minimum_prerequisite_notes='Readiness uses safe wall approach and exit, an inspected wall and nonslip floor, secure footwear, comfortable wall and bilateral heel support, comfortable active dorsiflexion with mostly straight knees, exact simultaneous lift and return comprehension, symptoms, communication, workout dose, and downstream lower-leg loading; never participant classification or age.',
    readiness_checks=ARRAY[
      'Confirm exact wall-supported bilateral variant, stable unobstructed wall, dry nonslip floor, secure footwear, station, sightline, communication, exit, and emergency route.',
      'Confirm foot, ankle, Achilles, calf, shin, knee, hip, back, wall-contact tolerance, and no current symptom or restriction conflict.',
      'Confirm the participant understands wall and heel support, mostly straight knees, simultaneous forefoot lift, comfortable range, controlled return, one-cycle count, stop signal, and exit.',
      'Review cumulative repetitions, active work, anterior-shin and lower-leg load, local and technical fatigue, and later running, landing, jumping, cutting, kicking, or lower-body demand.'
    ]::TEXT[],
    stop_signs=ARRAY[
      'Sharp, increasing, night, post-trauma, or unfamiliar pain, guarding, or participant stop request.',
      'Foot, ankle, Achilles, calf, shin, knee, hip, or back symptoms prevent exact motion or support.',
      'Painful pinching, catching, instability, giving way, uncontrolled cramping, or loss of foot control.',
      'Numbness, tingling, weakness, altered circulation, foot drop, or another neurologic sign.',
      'Dizziness, faintness, nausea, visual change, chest pain, unusual breathlessness, disorientation, or inability to communicate.',
      'Wall or pelvis contact is lost, either heel lifts or slides, or the knees or hips pump to create range.',
      'Bilateral timing, foot alignment, repeatable range, controlled return, breathing, or exact count cannot be restored despite reduced range, wall distance, repetitions, or pace.',
      'Wall, floor, footwear, space, traffic, hygiene, sightline, communication, duration, budget, exit, or emergency route becomes inadequate.'
    ]::TEXT[],
    contraindications=ARRAY[
      'Current symptoms, trauma, procedure, instability, foot drop, or clinical restrictions conflict with active dorsiflexion or wall support.',
      'No stable inspected wall, dry nonslip floor, secure footwear, controlled setup and exit, sightline, communication, or emergency route.',
      'The intended service is diagnosis, treatment, injury management, readiness clearance, maximal clinical measurement, unsupported balance work, resisted or loaded strengthening, isometric-only or eccentric-only work, locomotion, or another identity.'
    ]::TEXT[],
    common_substitutions=ARRAY[
      'Use Tibialis Raise Iso Hold only when the change from cyclic repetitions to a timed hold fits and all checks are rerun.',
      'Use Tibialis Raise Eccentric Lower only when its support, assistance, negative action, tempo, load, symptoms, and count are fully specified and validated.',
      'Use Ankle CARs, Foot Tripod Weight Shifts, Toe Yoga, or Calf Raise to Controlled Heel Drop only when the changed action and support fit and all checks are rerun.',
      'Do not infer that unilateral, alternating, bent-knee, heel-elevated, unsupported, seated, banded, tib-bar, heel-walk, clinical, or sport-context versions are equivalent.'
    ]::TEXT[]
  WHERE exercise_id=43;

  UPDATE coaching.exercise_score_v1 SET technical_complexity=18,absolute_load_demand=24,
    coordination_demand=16,impact=1,supervision_demand=10,base_overall_difficulty=greatest(18,24),
    legacy_scores=coalesce(legacy_scores,'{}'::JSONB)||jsonb_build_object(
      'candidateReassessment',migration_key,'projectionScope','wall_supported_bilateral_heel_planted_dorsiflexion_lift_and_controlled_return_exact_variant',
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'variantScores',jsonb_build_object('wallSupportedBilateralTibialisRaise',jsonb_build_object('complexity',18,'physicalDifficulty',24,'overall',24)),
      'exerciseScoresDescribeTaskOnly',TRUE,'independentCalibrationRequired',TRUE,'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    migration_confidence=60,human_review_status='queued',reviewed_by=NULL,reviewed_at=NULL,
    review_notes='Research-informed candidate reassessment only. Scores describe exercise complexity and physical difficulty, not participant classification, age, readiness, or proficiency. Exact support, laterality, load, fatigue, and independent calibration remain under review.',updated_at=now()
  WHERE exercise_id=43;

  UPDATE coaching.exercise_difficulty_profile SET technical=1.8,complexity=1.6,load=2.4,overall=2.4,
    recommended_age_min=NULL,recommended_age_max=NULL,attention_demand='low',
    notes='Candidate projection from the exact wall-supported bilateral heel-planted lift-and-controlled-return task. Complexity is 18/100, physical difficulty 24/100, and overall 24/100 by maximum. This is not participant classification, readiness, age, or proficiency.',
    source='canonical_research_candidate',updated_at=now()
  WHERE exercise_id=43;

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  VALUES(canonical_definition,1,2,'2.0.0',migration_key,'quarantined',
    jsonb_build_object(
      'identity',jsonb_build_object('passed',TRUE,'identityKey','wall_supported_bilateral_heels_planted_active_dorsiflexion_lift_and_controlled_return_cycle','legacySources',1,'activeVariants',1,'archivedSourceSkeletons',1,'ambiguousLegacySourcesQuarantined',jsonb_build_array(214,1113,1399),'neighborBoundaries',6),
      'taxonomy',jsonb_build_object('passed',TRUE,'controlledTerms',TRUE,'movementPatterns',jsonb_build_array('brace'),'bodyRegions',jsonb_build_array('foot','ankle','calf','knee','hip','core'),'equipment',jsonb_build_array('wall')),
      'anatomy',jsonb_build_object('passed',TRUE,'musclesJointsActionsPlanesLateralityContactsSequenceAndIsolationBoundary',TRUE),
      'difficulty',jsonb_build_object('passed',TRUE,'model','max_exercise_complexity_physical_difficulty','variantVectors',jsonb_build_array('18/24/24'),'participantClassificationAbsent',TRUE,'independentCalibrationRequired',TRUE),
      'loadFatigueRecovery',jsonb_build_object('passed',TRUE,'actualRepetitionsWorkRangeLeverageReturnFaultSymptomsAndOverlappingLowerLegExposureTracked',TRUE,'impactNone',TRUE,'recoveryIsPlanningEstimate',TRUE),
      'constraints',jsonb_build_object('passed',TRUE,'wallFloorFootwearHeelKneeSymptomsRestrictionsSpaceTrafficScopeAndEmergencyRoute',TRUE),
      'delivery',jsonb_build_object('passed',TRUE,'profiles',2,'prepareAndCapacity',TRUE,'durationDoseRestSetupExitAndSubstitutionRevalidation',TRUE),
      'instructions',jsonb_build_object('passed',TRUE,'athleteCoachAccessibilityAndSupportOperations',TRUE,'supportActionReturnCountSymptomsExitAndClinicalScope',TRUE),
      'research',jsonb_build_object('passed',TRUE,'sections',16,'registryVersion',research_version,'directAndAdjacentEvidenceSeparated',TRUE,'exampleDoseNotUniversal',TRUE),
      'media',jsonb_build_object('passed',FALSE,'candidateCount',5,'currentOEmbedMetadataHealthy',TRUE,'playbackReviewed',FALSE,'exactWallSupportedCycleReviewed',FALSE,'captionsAccessibilityQualitySafetyAndApprovalReviewed',FALSE),
      'relationships',jsonb_build_object('passed',FALSE,'reviewOnly',4,'approved',0,'automaticSubstitution',FALSE),
      'calibration',jsonb_build_object('passed',FALSE,'reviewOnly',2,'approved',0),
      'alternates',jsonb_build_object('passed',TRUE,'assessments',26,'sameIdentity',2,'modifierAnnotations',8,'newVariants',8,'newDefinitions',8,'singleExactVariant',TRUE),
      'generationSupport',jsonb_build_object('passed',TRUE,'selectionConstraints',TRUE,'cumulativeFatigueAndImpactBudgets',TRUE,'duration',TRUE,'wallFloorFootwearSetupAndExit',TRUE,'substitutionRevalidation',TRUE,'renderingAndPersistence',TRUE),
      'publication',jsonb_build_object('passed',FALSE,'reviewer',NULL,'approver',NULL)),
    jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01','message','A qualified human must watch all five candidates in full and verify playback, exact wall and heel support, simultaneous bilateral lift, comfortable range, controlled return, count, captions, accessibility, cue quality, safety, conflicts, reviewer identity, timestamp, card version, and approval rationale.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','A qualified coach must approve or reject all four relationships; no automatic substitution to isometric, eccentric, ankle-CAR, calf, unilateral, unsupported, resisted, loaded, locomotor, clinical, or sport tasks is authorized.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','An independent qualified reviewer must calibrate exercise complexity 18 and physical difficulty 24. Scores do not classify a participant or create an age, readiness, or proficiency level.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','A qualified reviewer and separate approver must complete content review before publication. Identity, anatomy, wall and floor safety, load and recovery, action and count, clinical scope, dose, stop, accessibility, persistence, capacity context, and support rules remain quarantined.')),
    TRUE,now())
  ON CONFLICT(definition_id) DO UPDATE SET facility_id=EXCLUDED.facility_id,card_version=EXCLUDED.card_version,
    schema_version=EXCLUDED.schema_version,audit_version=EXCLUDED.audit_version,status='quarantined',
    checks_json=EXCLUDED.checks_json,blocking_issues_json=EXCLUDED.blocking_issues_json,
    human_review_required=TRUE,checked_at=now();

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition AND status='review' AND card_version=2 AND schema_version='2.0.0'
        AND approved_video_url IS NULL AND reviewed_by IS NULL AND approved_by IS NULL AND last_reviewed_at IS NULL
        AND movement_patterns=ARRAY['brace']::TEXT[] AND required_equipment=ARRAY['wall']::TEXT[]
        AND anatomy_json<>'{}'::JSONB AND environment_json<>'{}'::JSONB AND population_json<>'{}'::JSONB
        AND athlete_support_json ?& ARRAY['whyItMatters','primaryCue','expectedSensations','unexpectedSensations','painGuidance','selfChecks','accessibility','mediaAlternatives']::TEXT[]
        AND coach_support_json ?& ARRAY['observationChecklist','faultCorrections','demonstrationPlan','groupManagement','modificationDecisionTree','doNotUseWhen']::TEXT[]
        AND support_operations_json ?& ARRAY['issueCategories','supportEscalation','retentionPolicy','changeImpactPolicy']::TEXT[]
        AND provenance_json->>'approvalsCreated'='false')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=source43_variant AND status='archived' AND requirements_json->>'representation'='superseded_source_skeleton')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=exact_variant AND definition_id=canonical_definition AND status='review'
        AND requirements_json->>'selectable'='true'
        AND (difficulty_json->>'technicalComplexity')::INTEGER=18
        AND (difficulty_json->>'physicalDifficulty')::INTEGER=24
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=greatest(18,24)
        AND (difficulty_json->>'coordinationDemand')::INTEGER=16
        AND (difficulty_json->>'supervisionDemand')::INTEGER=10
        AND (difficulty_json->>'failureConsequence')::INTEGER=8
        AND (difficulty_json->>'impact')::INTEGER=1
        AND (difficulty_json->>'workCapacityDemand')::INTEGER=22
        AND (load_profile_json->>'gripDemand')::INTEGER=1
        AND (load_profile_json->>'landingContactsPerRep')::INTEGER=0
        AND (fatigue_profile_json->>'gripFatigue')::INTEGER=1
        AND (fatigue_profile_json->>'impactAccumulation')::INTEGER=1
        AND (fatigue_profile_json->'cumulativeBudget'->>'impact')::INTEGER=0
        AND programming_profile_json->>'publicationQuarantined'='true') THEN
    RAISE EXCEPTION '% definition variant source or quarantine assertion failed',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=exact_variant AND status='review' AND equipment_required=ARRAY['wall']::TEXT[]
        AND coalesce(time_model_json->>'durationFormula','')<>'' AND dose_scaling_json<>'{}'::JSONB
        AND measurement_json<>'{}'::JSONB AND support_prompts_json<>'{}'::JSONB
        AND length(coach_instructions)>=100 AND length(athlete_instructions) BETWEEN 10 AND 240
        AND cardinality(stop_rules)>=8)<>2
    OR (SELECT count(DISTINCT section_key) FROM coaching.exercise_section_evidence_v1
      WHERE definition_id=canonical_definition AND reviewed_card_version=2
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>16
    OR (SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=canonical_definition AND reviewed_card_version=2 AND link_status='healthy'
        AND review_status='candidate' AND embedding_allowed AND captions_available IS NULL
        AND exact_variant_match IS NULL AND demonstration_quality_score IS NULL
        AND reviewer_user_id IS NULL AND reviewed_at IS NULL)<>5
    OR (SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id=canonical_definition AND reviewed_card_version=2
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>26
    OR (SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE from_variant_id=exact_variant AND review_status='review' AND reviewed_by IS NULL)<>4
    OR (SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=exact_variant AND status='review' AND reviewed_by IS NULL)<>2
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=canonical_definition AND decision='distinct_exercises' AND reviewed_by IS NULL)<>6
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=canonical_definition AND resolved_definition_id=ambiguous_definition
        AND decision='needs_human_review' AND reviewed_by IS NULL)<>1 THEN
    RAISE EXCEPTION '% authored row-count or quarantine assertion failed',migration_key;
  END IF;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=ambiguous_definition AND status='archived' AND provenance_json->>'identityStatus'='needs_human_review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=214 AND definition_id=ambiguous_definition)
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id IN(source214_variant,source1113_variant,source1399_variant)
        AND definition_id=ambiguous_definition AND status='archived'
        AND requirements_json->>'representation'='ambiguous_source_identity')<>3
    OR (SELECT count(*) FROM coaching.exercise
      WHERE id IN(214,1113,1399) AND archived AND NOT is_published AND skill_level IS NULL
        AND age_min IS NULL AND age_max IS NULL AND linked_skill_id IS NULL)<>3 THEN
    RAISE EXCEPTION '% ambiguous-source restoration or legacy quarantine assertion failed',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 d CROSS JOIN LATERAL unnest(d.movement_patterns) key
      WHERE d.id=canonical_definition AND NOT EXISTS(SELECT 1 FROM coaching.movement_pattern allowed WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 d CROSS JOIN LATERAL unnest(d.body_regions) key
      WHERE d.id=canonical_definition AND NOT EXISTS(SELECT 1 FROM coaching.body_region allowed WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 v
      CROSS JOIN LATERAL jsonb_array_elements_text(v.requirements_json->'equipment') key
      WHERE v.id=exact_variant AND NOT EXISTS(SELECT 1 FROM coaching.equipment allowed WHERE allowed.key=key)) THEN
    RAISE EXCEPTION '% uncontrolled taxonomy was authored',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise WHERE id=43
      AND (skill_level IS NOT NULL OR age_min IS NOT NULL OR age_max IS NOT NULL OR linked_skill_id IS NOT NULL OR is_published OR why_publish_ready))
    OR EXISTS(SELECT 1 FROM coaching.exercise_safety_profile WHERE exercise_id=43
      AND (minimum_skill_level IS NOT NULL OR minimum_age_recommended IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 WHERE id=canonical_definition
      AND (approved_video_url IS NOT NULL OR reviewed_by IS NOT NULL OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL OR status='published'))
    OR EXISTS(SELECT 1 FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=canonical_definition AND review_status='candidate'
        AND (exact_variant_match IS NOT NULL OR demonstration_quality_score IS NOT NULL OR captions_available IS NOT NULL OR reviewer_user_id IS NOT NULL OR reviewed_at IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1 WHERE from_variant_id=exact_variant AND review_status='approved')
    OR EXISTS(SELECT 1 FROM coaching.exercise_score_calibration_v1 WHERE variant_id=exact_variant AND status='approved') THEN
    RAISE EXCEPTION '% fabricated participant classification approval or publication state detected',migration_key;
  END IF;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=canonical_definition AND status='quarantined' AND human_review_required
        AND jsonb_array_length(blocking_issues_json)=4
        AND (SELECT array_agg(item->>'code' ORDER BY item->>'code') FROM jsonb_array_elements(blocking_issues_json) item)
          =ARRAY['CARD-CALIBRATION-01','CARD-GRAPH-03','CARD-MEDIA-01','CARD-PUBLISH-01']::TEXT[])
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=43
      AND programming_logic->>'exerciseDifficultyDescribesTaskOnly'='true'
      AND movement_requirements->'exerciseDifficulty'->>'overall'='24'
      AND media_library->>'reviewState'='oembed_metadata_only_candidate_quarantine'
      AND participant_structure='individual' AND programming_kind='exercise'
      AND linked_skill_id IS NULL AND NOT is_published AND NOT archived) THEN
    RAISE EXCEPTION '% test packet legacy projection or task-only difficulty assertion failed',migration_key;
  END IF;
END
$migration$;
