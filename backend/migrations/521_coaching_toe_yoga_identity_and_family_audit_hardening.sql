-- Source 45: consolidate the direct Toe Yoga / Toe-Yoga Tripod Balance
-- collision and replace both skeletal cards with exact target-foot selective
-- toe-extension cycles. Standing hands-free, standing wall-touch, and seated
-- support positions remain explicit variants. Evidence, media, graph,
-- calibration, content, and publication authority stay human-only.
-- Difficulty describes the exercise task, never participant level.
DO $migration$
DECLARE
  migration_key CONSTANT TEXT := '521_coaching_toe_yoga_identity_and_family_audit_hardening';
  research_version CONSTANT TEXT := '2026-08-09.112';
  canonical_definition UUID; duplicate_definition UUID; source45_variant UUID; source524_variant UUID; standing_variant UUID; wall_variant UUID; seated_variant UUID; active_variant_ids UUID[]; all_owned_variant_ids UUID[]; short_foot_definition UUID; short_foot_variant UUID; tripod_shift_definition UUID; tripod_shift_variant UUID; big_toe_press_definition UUID; big_toe_press_variant UUID; short_foot_calf_definition UUID; short_foot_calf_variant UUID;
  protected_count INTEGER;
BEGIN
  SELECT id INTO canonical_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=45; SELECT id INTO duplicate_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=524; SELECT id INTO source45_variant FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='baseline'; SELECT id INTO source524_variant FROM coaching.exercise_variant_v1 WHERE definition_id=duplicate_definition AND variant_key='baseline';
  SELECT coalesce((SELECT id FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='standing-hands-free-single-target-foot-cycle'),gen_random_uuid()) INTO standing_variant; SELECT coalesce((SELECT id FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='standing-wall-touch-single-target-foot-cycle'),gen_random_uuid()) INTO wall_variant; SELECT coalesce((SELECT id FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='seated-bench-single-target-foot-cycle'),gen_random_uuid()) INTO seated_variant;
  SELECT id INTO short_foot_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=46; SELECT id INTO short_foot_variant FROM coaching.exercise_variant_v1 WHERE definition_id=short_foot_definition AND variant_key='baseline'; SELECT id INTO tripod_shift_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=47; SELECT id INTO tripod_shift_variant FROM coaching.exercise_variant_v1 WHERE definition_id=tripod_shift_definition AND variant_key='baseline'; SELECT id INTO big_toe_press_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=848; SELECT id INTO big_toe_press_variant FROM coaching.exercise_variant_v1 WHERE definition_id=big_toe_press_definition AND variant_key='baseline'; SELECT id INTO short_foot_calf_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=877; SELECT id INTO short_foot_calf_variant FROM coaching.exercise_variant_v1 WHERE definition_id=short_foot_calf_definition AND variant_key='baseline'; active_variant_ids:=ARRAY[standing_variant,wall_variant,seated_variant]; all_owned_variant_ids:=ARRAY[source45_variant,source524_variant,standing_variant,wall_variant,seated_variant];
  IF NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=45 AND facility_id=1)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=524 AND facility_id=1)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 WHERE id=canonical_definition AND facility_id=1 AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 WHERE id=duplicate_definition AND facility_id=1 AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=45 AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=524 AND definition_id=duplicate_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id=source45_variant AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id=source524_variant AND definition_id=duplicate_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id=short_foot_variant AND definition_id=short_foot_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id=tripod_shift_variant AND definition_id=tripod_shift_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id=big_toe_press_variant AND definition_id=big_toe_press_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id=short_foot_calf_variant AND definition_id=short_foot_calf_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1 WHERE exercise_id=45)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_difficulty_profile WHERE exercise_id=45)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_safety_profile WHERE exercise_id=45) THEN
    RAISE EXCEPTION '% prerequisite source or neighbor rows are missing',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id=ANY(active_variant_ids) AND definition_id<>canonical_definition)
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 WHERE slug='toe-yoga' AND id<>canonical_definition) THEN
    RAISE EXCEPTION '% working UUID or slug already belongs to another card',migration_key;
  END IF;

  SELECT coalesce(sum(n),0) INTO protected_count FROM (
    SELECT count(*) n FROM coaching.exercise_definition_v1
      WHERE id IN(canonical_definition,duplicate_definition)
        AND (status IN('published','deprecated') OR reviewed_by IS NOT NULL OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)
    UNION ALL SELECT count(*) FROM coaching.exercise_section_evidence_v1
      WHERE definition_id IN(canonical_definition,duplicate_definition)
        AND (reviewer_user_id IS NOT NULL OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id IN(canonical_definition,duplicate_definition)
        AND (reviewer_user_id IS NOT NULL OR reviewed_at IS NOT NULL OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id IN(canonical_definition,duplicate_definition)
        AND (reviewer_user_id IS NOT NULL OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_card_review_v1
      WHERE definition_id IN(canonical_definition,duplicate_definition)
    UNION ALL SELECT count(*) FROM coaching.exercise_card_revision_v1
      WHERE definition_id IN(canonical_definition,duplicate_definition)
    UNION ALL SELECT count(*) FROM coaching.exercise_media_review_v1
      WHERE definition_id IN(canonical_definition,duplicate_definition)
    UNION ALL SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=ANY(all_owned_variant_ids) OR to_variant_id=ANY(all_owned_variant_ids))
        AND (reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL OR review_status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(all_owned_variant_ids) AND (reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL OR status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE (survivor_definition_id IN(canonical_definition,duplicate_definition)
          OR resolved_definition_id IN(canonical_definition,duplicate_definition))
        AND (reviewed_by IS NOT NULL OR resolution_source='human_review')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_v1
      WHERE exercise_id=45 AND (human_review_status<>'queued' OR reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL)
  ) protected;
  IF protected_count<>0 THEN
    RAISE EXCEPTION '% refuses to overwrite % human-reviewed records',migration_key,protected_count;
  END IF;

  UPDATE coaching.exercise_section_evidence_v1
  SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now()
  WHERE definition_id IN(canonical_definition,duplicate_definition)
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_media_candidate_v1
  SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
    exact_variant_match=NULL,demonstration_quality_score=NULL,updated_at=now()
  WHERE definition_id IN(canonical_definition,duplicate_definition)
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_alternate_assessment_v1
  SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now()
  WHERE definition_id IN(canonical_definition,duplicate_definition)
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  DELETE FROM coaching.exercise_relationship_v1
  WHERE (from_variant_id=ANY(all_owned_variant_ids) OR to_variant_id=ANY(all_owned_variant_ids))
    AND reviewed_by IS NULL AND review_status<>'approved';
  DELETE FROM coaching.exercise_score_calibration_v1
  WHERE variant_id=ANY(all_owned_variant_ids) AND reviewed_by IS NULL AND status<>'approved';

  UPDATE coaching.exercise_definition_source_v1
  SET definition_id=canonical_definition,
    source_kind=CASE WHEN legacy_exercise_id=524 THEN 'duplicate_consolidation' ELSE 'legacy_migration' END,
    provenance_json=jsonb_build_object(
      'source_table','coaching.exercise','migration',migration_key,'researchVersion',research_version,
      'sourceDisposition',CASE WHEN legacy_exercise_id=524
        THEN 'duplicate_consolidated_into_toe_yoga'
        ELSE 'canonical_toe_yoga_source_reauthored' END,
      'identityContract','one_target_foot_hallux_extension_and_return_then_lesser_toe_extension_and_return_cycle',
      'representedBySelectableSourceVariants',to_jsonb(active_variant_ids),
      'exerciseDifficultyDescribesTaskOnly',TRUE,'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE definition_id IN(canonical_definition,duplicate_definition);

  UPDATE coaching.exercise_delivery_profile_v1
  SET status='archived',updated_at=now()
  WHERE variant_id IN(source45_variant,source524_variant);

  UPDATE coaching.exercise_variant_v1
  SET definition_id=canonical_definition,
    variant_key=CASE id WHEN source45_variant THEN 'superseded-source-45-skeleton' ELSE 'superseded-duplicate-source-524-skeleton' END,
    display_name=CASE id WHEN source45_variant THEN 'Toe Yoga Legacy Skeleton — Source 45' ELSE 'Toe-Yoga Tripod Balance Duplicate Skeleton — Source 524' END,
    modifier_keys='{}'::TEXT[],difficulty_json='{}'::JSONB,status='archived',
    requirements_json=jsonb_build_object(
      'selectable',FALSE,'representation',CASE id WHEN source45_variant THEN 'superseded_source_skeleton' ELSE 'duplicate_source_skeleton' END,
      'sourceLegacyExerciseId',CASE id WHEN source45_variant THEN 45 ELSE 524 END,
      'archiveReason','The prior row lacks an exact target-foot start, two-phase sequence, return endpoints, side-specific count, anatomy, loading, fatigue, constraints, duration, substitution, persistence, and review contract.',
      'replacementVariantIds',to_jsonb(active_variant_ids),'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    load_profile_json=jsonb_build_object('selectable',FALSE),
    fatigue_profile_json=jsonb_build_object('selectable',FALSE),
    programming_profile_json=jsonb_build_object('selectionStatus','superseded_or_duplicate_source_skeleton','selectable',FALSE,'publicationQuarantined',TRUE),
    updated_at=now()
  WHERE id IN(source45_variant,source524_variant);

  UPDATE coaching.exercise_definition_v1
  SET status='archived',legacy_exercise_id=NULL,
    slug='toe-yoga-tripod-balance-duplicate-source-524',
    approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,last_reviewed_at=NULL,
    provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'identityStatus','duplicate_consolidated_into_toe_yoga',
      'survivorDefinitionId',canonical_definition,'selectable',FALSE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),updated_at=now()
  WHERE id=duplicate_definition;

  INSERT INTO coaching.exercise_definition_v1(
    id,facility_id,legacy_exercise_id,slug,canonical_name,display_name,aliases,description,family_key,
    schema_version,card_version,status,content_confidence,scoring_confidence,media_confidence,
    movement_patterns,body_regions,required_equipment,optional_equipment,environment_json,population_json,
    provenance_json,approved_video_url,reviewed_by,approved_by,last_reviewed_at,anatomy_json,
    athlete_support_json,coach_support_json,support_operations_json)
  VALUES(
    canonical_definition,1,45,'toe-yoga','Toe Yoga','Toe Yoga',
    ARRAY['Toe Yogas','Toe-Yoga','Selective Toe Extension Cycle','Great-Toe and Lesser-Toe Dissociation','Toe-Yoga Tripod Balance','Toe Yoga Tripod Balance']::TEXT[],
    'Place one target foot flat on a clean dry nonslip foot-safe surface with its heel, first metatarsal head, fifth metatarsal head, and relaxed toes in contact. Keep the heel and metatarsal heads down. Lift only the target-foot great toe while toes two through five remain long and in contact; lower the great toe to the same start. Then keep the great toe and first metatarsal head down while lifting toes two through five; lower them to the same all-toes-down start. One complete great-toe phase plus lesser-toe phase and both controlled returns on one target foot is one repetition. Record left- and right-foot repetitions separately. Comfortable active range, tempo, a brief untimed observation checkpoint, breathing, repetitions, sets, rest, foot order, and delivery context are annotations. Simultaneous two-foot action, toe spreading, toe curling or gripping, short-foot doming, sustained pressing or holding, manual assistance during a counted repetition, resistance, unstable or single-leg stance, locomotion, compound actions, maximal assessment, or clinical treatment require a separately reviewed variant or definition.',
    'selective_toe_extension_cycle','2.0.0',2,'review',91,64,50,
    ARRAY['brace']::TEXT[],ARRAY['foot','ankle','calf','knee','hip','core']::TEXT[],
    ARRAY['none']::TEXT[],ARRAY['wall','bench']::TEXT[],
    jsonb_build_object(
      'surface','clean dry level stable nonslip foot-safe floor suitable for the facility barefoot or approved sock policy',
      'space','one seated or standing foot-control station with visible toes clear entry exit and no cross traffic',
      'stationCapacity',1,'requiredEquipmentByVariant',jsonb_build_object('standingHandsFree','none','standingWallTouch','wall','seated','bench'),
      'hygiene','follow facility barefoot surface cleaning skin-integrity and shared-station policy',
      'coachSightline','front-quarter and top-oblique views of target toe groups metatarsal heads heel arch ankle knee support breathing and symptoms',
      'inspection',jsonb_build_array('surface traction cleanliness temperature debris and skin-contact suitability','wall stability and contact area when used','bench stability height and clear foot placement when used','toe visibility and footwear or sock restrictions','station separation cross traffic entry exit communication and emergency route'),
      'changeRule','Any support position target side weight bearing hand assistance footwear resistance action count dose symptom or downstream-demand change requires full revalidation.'),
    jsonb_build_object(
      'exerciseCardDoesNotClassifyParticipants',TRUE,'readinessIsWorkoutInput',TRUE,
      'selectionPrerequisites',jsonb_build_array('clean dry stable nonslip foot-safe surface and compliant hygiene setup','comfortable target-foot flat contact and visible toes','comfortable active great-toe and lesser-toe extension without forced range','can maintain heel and metatarsal-head contacts for the selected support variant','understands the two-phase target-foot cycle side-specific count and stop signal','standing variants require safe standing and optional wall approach while seated requires a stable bench','same-session foot toe calf balance running landing jumping and lower-body budgets fit'),
      'excludeOrEscalate',jsonb_build_array('recent significant trauma surgery or procedure without applicable clearance','worsening night post-trauma sharp increasing or unfamiliar pain','new numbness tingling weakness altered circulation skin breakdown or loss of control','toe forefoot arch foot ankle calf knee hip or back symptoms preventing the exact task','painful current bunion toe deformity or joint irritation conflicting with contact or motion','dizziness faintness nausea visual change chest pain unusual breathlessness disorientation or inability to communicate','clinical restriction conflicting with active selective toe extension','unsafe surface hygiene wall bench space traffic sightline or emergency route','participant requests stop'),
      'notEstablishedByEvidence',jsonb_build_array('universal eligibility support position range tempo dose frequency fatigue ceiling recovery progression or outcome','diagnosis treatment prevention correction readiness clearance or clinical threshold','isolated intrinsic foot muscle activation or strength','guaranteed arch balance gait running jumping landing or injury-prevention transfer','age floor or participant classification')),
    jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,'canonicalAuthoredFromResearch',TRUE,
      'identityAuthority','Sources 45 and 524 consolidated around the same target-foot great-toe then lesser-toe selective-extension sequence, bounded by direct activation and kinematic research',
      'legacySources',jsonb_build_array(45,524),'selectableLegacySources',jsonb_build_array(45,524),
      'identityContract','one_target_foot_hallux_extension_return_lesser_toe_extension_return_all_toes_down_cycle',
      'researchSources',jsonb_build_array(
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC5094843/',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC13028051/',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC11911532/',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC7739583/',
        'https://pubmed.ncbi.nlm.nih.gov/35724360/',
        'https://pubmed.ncbi.nlm.nih.gov/35442981/',
        'https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf',
        'https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en'),
      'confidenceBySection',jsonb_build_object('identity',91,'taxonomy',88,'anatomy',90,'difficulty',64,'load',72,'fatigueRecovery',52,'constraints',82,'dosage',56,'instructions',91,'alternates',92,'media',50),
      'unresolvedClaims',jsonb_build_array('one universal support range tempo dose frequency fatigue ceiling recovery progression or outcome','numeric difficulty calibration','standing load and transfer relative to seated research','media playback exact mechanics captions accessibility quality safety and approval','individual symptom interpretation or clinical eligibility'),
      'externalPlaybackVerificationPerformed',FALSE,'oEmbedMetadataChecked',TRUE,'sourceLimitationsExplicit',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,'publicationQuarantined',TRUE),
    NULL,NULL,NULL,NULL,
    jsonb_build_object(
      'primaryMuscles',jsonb_build_array('extensor_hallucis_longus','extensor_hallucis_brevis','extensor_digitorum_longus','extensor_digitorum_brevis'),
      'secondaryMuscles',jsonb_build_array('flexor_hallucis_longus','flexor_hallucis_brevis','flexor_digitorum_longus','flexor_digitorum_brevis','abductor_hallucis','adductor_hallucis','abductor_digiti_minimi','quadratus_plantae','interossei','lumbricals'),
      'stabilizers',jsonb_build_array('intrinsic_foot_muscle_system','tibialis_anterior','tibialis_posterior','fibularis_longus_and_brevis','calf_complex','standing_lower_limb_and_trunk_stabilizers'),
      'joints',jsonb_build_array('first_metatarsophalangeal','second_through_fifth_metatarsophalangeal','toe_interphalangeal','first_ray_and_lesser_rays','midfoot','subtalar','talocrural_ankle','knee_and_hip_for_standing_support'),
      'jointActions',jsonb_build_array('target_hallux_extension_with_lesser_toe_ground_contact','controlled_hallux_return','target_lesser_toe_extension_with_hallux_ground_contact','controlled_lesser_toe_return','metatarsal_head_heel_arch_ankle_and_limb_stabilization'),
      'planes',jsonb_build_array('sagittal_digit_motion','frontal_stabilization','transverse_stabilization'),
      'laterality','one target foot per repetition with left and right exposures recorded separately',
      'supportContacts',jsonb_build_array('target_heel_on_surface','target_first_metatarsal_head_on_surface','target_fifth_metatarsal_head_on_surface','non_target_toe_group_on_surface_during_each_selective_phase','support contacts specified by variant'),
      'sequence',jsonb_build_array('target_foot_all_toes_down_start','hallux_lift_lesser_toes_long_and_down','hallux_controlled_return','lesser_toes_lift_hallux_and_first_metatarsal_head_down','lesser_toes_controlled_return','same_all_toes_down_start_one_target_foot_repetition'),
      'claimsBoundary','Selective toe extension uses extrinsic toe extensors plus plantar intrinsic and extrinsic stabilizers; it does not isolate one muscle, diagnose toe control, or prove treatment, prevention, readiness, balance, gait, running, jumping, or injury outcomes.'),
    jsonb_build_object(
      'whyItMatters','Practises selective great-toe and lesser-toe control while the rest of the target foot stays organized.',
      'primaryCue','Big toe up and down; four toes up and down; keep the target heel and toe mounds quiet.',
      'secondaryCues',jsonb_build_array('one target foot at a time','toes stay long instead of curling','use a small comfortable range','keep ankle and knee quiet','return every toe to the same start','count the full two-part cycle','keep breathing'),
      'expectedSensations',jsonb_build_array('light effort across the top and sole of the target foot','concentration and imperfect toe separation','steady heel and metatarsal-head pressure'),
      'unexpectedSensations',jsonb_build_array('sharp increasing or unfamiliar toe or foot pain','painful pinching catching or joint irritation','cramping that persists after reset','numbness tingling weakness altered circulation or skin pain','dizziness faintness nausea visual change chest pain or unusual breathlessness'),
      'painGuidance','Stop for sharp, increasing, radiating, neurologic, circulatory, skin, or joint pain and tell the coach. Small unintended toe movement can occur; never force range or pin a toe down during a counted unassisted repetition.',
      'selfChecks',jsonb_build_array('target_heel_and_metatarsal_heads_stay_down','great_toe_moves_without_lesser_toes_leaving_surface','great_toe_returns_before_lesser_toes_move','lesser_toes_move_without_great_toe_leaving_surface','toes_do_not_curl_or_claw','arch_ankle_knee_and_body_stay_quiet','one_full_two_phase_cycle_counted_per_side','breathing_continues'),
      'accessibility',jsonb_build_object('reducedRange','use a smaller comfortable toe lift','reducedCapacity','use fewer cycles and more rest','balanceSupport','select the wall-touch or seated variant and recompute difficulty and logistics','hearingSupport','use visible toe-group cards and side-specific counting','visionSupport','use consented tactile orientation before the set and clear verbal phase cues','cognitiveSupport','use big toe up-down then four toes up-down with one rehearsal','manualAssistance','assisted repetitions are a separate candidate variant and do not count as unassisted reps'),
      'readingLevel','plain_language','localizationKey','exercise.toe_yoga',
      'mediaAlternatives',jsonb_build_object('captionsRequired',TRUE,'transcriptRequired',TRUE,'stillSequenceRequired',TRUE,'audioDescriptionRequired',TRUE,'requiredAngles',jsonb_build_array('top_oblique','front_oblique'))),
    jsonb_build_object(
      'observationChecklist',jsonb_build_array('surface hygiene support equipment and station are safe','target foot and toes are visible','heel and first and fifth metatarsal heads remain supported','only the intended toe group lifts in each phase within comfortable active range','toes stay long without clawing','arch ankle knee and body remain controlled','each toe group returns before the next phase','side actual cycles first fault symptoms duration and support variant are recorded'),
      'faultCorrections',jsonb_build_array(
        jsonb_build_object('fault','non_target_toes_lift','action','reduce range slow the phase reset all toes and retry without forcing'),
        jsonb_build_object('fault','toe_curl_or_claw','action','return all toes long reduce effort and end the set if it persists'),
        jsonb_build_object('fault','heel_metatarsal_head_arch_or_ankle_moves','action','restore foot contact reduce range or select a more supported exact variant'),
        jsonb_build_object('fault','manual_assistance_needed','action','do not count the attempt as an unassisted repetition; route to separately reviewed assisted variant'),
        jsonb_build_object('fault','symptom_or_loss_of_control','action','stop and follow facility escalation policy')),
      'demonstrationPlan',jsonb_build_object('angles',jsonb_build_array('top_oblique','front_oblique'),'showCorrectReps',2,'showCommonFaults',jsonb_build_array('non_target_toe_lift','toe_claw','ankle_roll'),'comprehensionCheck','Ask the athlete to name the two phases, show where each repetition ends, identify the target foot, and state the stop signal.'),
      'groupManagement',jsonb_build_object('format','individual_visible_foot_stations_or_observed_pairs','athletesPerStation',1,'coachSightLine','top and front-quarter view of toes metatarsal heads heel ankle and knee','queueRule','next athlete waits outside the foot station','equipmentSharing','clean and reset wall bench and floor contact surfaces between users per facility policy'),
      'modificationDecisionTree',jsonb_build_array(jsonb_build_object('when','pain_neurologic_circulatory_skin_or_systemic_symptom','action','stop_and_escalate'),jsonb_build_object('when','toe_group_contact_or_body_control_fails','action','reduce_range_or_cycles_then_reassess'),jsonb_build_object('when','standing_balance_limits_toe_control','action','select_wall_touch_or_seated_variant_and_recompute_workout'),jsonb_build_object('when','manual_assistance_resistance_single_leg_or_other_action_is_needed','action','select_separately_reviewed_variant_and_recompute_workout')),
      'doNotUseWhen',jsonb_build_array('surface hygiene wall bench or station is unsafe','toes cannot be observed for the selected delivery','exact selective cycle is painful not tolerated or not understood','current toe forefoot arch foot ankle or skin symptoms conflict','foot fatigue would compromise later priority running landing jumping balance or lower-body work','the intended service is diagnosis treatment maximal testing or rehabilitation'),
      'scopeBoundary','Coach observable setup action count exposure and stop rules; do not diagnose toe, foot, nerve, circulation, skin, arch, balance, or gait problems, prescribe rehabilitation, promise prevention, infer clearance, or force range.'),
    jsonb_build_object(
      'issueCategories',jsonb_build_array('unsafe','unclear_instruction','inaccurate','duplicate','inaccessible','broken_media','symptom_report','equipment_environment_or_hygiene'),
      'supportEscalation',jsonb_build_object('safety','stop remove from selection follow facility emergency and incident policy','brokenMedia','quarantine candidate and schedule qualified re-review','identity','route changed support action laterality assistance resistance or count to qualified variant review','contentQuestion','route to coaching content queue','clinicalQuestion','refer through facility clinical escalation policy'),
      'retentionPolicy',jsonb_build_object('athleteFeedbackDays',365,'incidentEvidence','facility_policy','rawFreeTextContainsHealthData',TRUE,'persistVersionedWorkoutFacts',TRUE),
      'changeImpactPolicy',jsonb_build_object('identityChange','invalidate selection release saved substitutions and media exactness','safetyChange','invalidate current release and notify workout owners','instructionChange','new card version and comprehension review','mediaChange','invalidate media review','scoreOrDoseChange','revalidate saved workouts templates duration fatigue and recovery'),
      'feedbackPrompts',jsonb_build_array('pain_or_unexpected_sensation','toe_independence_and_local_fatigue','clarity_and_confidence','surface_support_or_hygiene_problem','media_accessibility','substitution_reason','actual_cycles_by_side_and_first_fault')))
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
  SELECT p.id,canonical_definition,p.variant_key,p.display_name,
    ARRAY['target_side_order','comfortable_active_range','tempo','brief_observation_checkpoint','breathing','cycles_per_side','sets','rest','effort','approved_foot_covering','delivery_context']::TEXT[],
    jsonb_build_object('technicalComplexity',p.technical,'absoluteLoadDemand',p.physical,'physicalDifficulty',p.physical,
      'coordinationDemand',p.coordination,'supervisionDemand',p.supervision,'failureConsequence',p.failure,
      'impact',1,'workCapacityDemand',p.work_capacity,'baseOverallDifficulty',greatest(p.technical,p.physical),
      'overallFormula','max(exercise_complexity,physical_difficulty)','exerciseDifficultyDescribesTaskOnly',TRUE,
      'candidateCalibrationOnly',TRUE,'humanReviewRequired',TRUE),
    jsonb_build_object('selectable',TRUE,'equipment',jsonb_build_array(p.equipment),
      'base',p.base,'supportContacts',jsonb_build_array(p.support_contacts),'start',p.start_position,
      'action','On one target foot, lift only the great toe while lesser toes remain long and down; lower the great toe; then lift toes two through five while the great toe and first metatarsal head remain down; lower all toes to the same start.',
      'countingRule','one target-foot great-toe lift and return plus lesser-toe lift and return to all toes down is one repetition; left and right repetitions are recorded separately',
      'validCompletion','target heel first and fifth metatarsal heads remain supported, only the intended toe group lifts in each phase within comfortable active range, all toes return between phases and at completion, toes remain long, support and body position stay controlled, breathing continues, and no stop rule occurs',
      'invalidCompletion',jsonb_build_array('non_target_toe_group_leaves_surface','toe_curl_claw_or_grip','heel_or_metatarsal_head_lifts','arch_collapse_or_ankle_knee_body_compensation','phase_order_or_return_missing','manual_assistance_during_counted_attempt','simultaneous_two_foot_spread_short_foot_hold_press_resisted_unstable_single_leg_locomotor_compound_assessment_or_clinical_task','breath_hold','symptom_stop'),
      'variantBoundaries',jsonb_build_array('support_position','weight_bearing','external_hand_support','target_side','simultaneous_or_single_foot_action','toe_action_sequence','manual_assistance','resistance','contraction_mode','range','count','clinical_measurement'),
      'clinicalAssessmentOrTreatment',FALSE,'humanReviewRequired',TRUE),
    'review',
    jsonb_build_object('loadingType',p.loading_type,'externalLoadMethod',p.external_load,
      'gripDemand',1,'jointStress',p.joint_stress,'spinalLoading',p.spinal_loading,'eccentricStress',4,
      'landingContactsPerRep',0,'handImpactContactsPerRep',0,'impactClass','none',
      'primaryExposure',jsonb_build_array('selective_hallux_extension','selective_lesser_toe_extension','non_target_toe_ground_contact','intrinsic_and_extrinsic_foot_stabilization','metatarsal_head_and_heel_contact','toe_motor_coordination'),
      'tracking',jsonb_build_array('definition_variant_profile_and_card_version','target_side_and_support_position','surface_hygiene_wall_bench_foot_covering_and_station','planned_and_actual_valid_cycles_per_side','comfortable_range_tempo_effort_and_rest','valid_invalid_partial_assisted_and_symptom_limited_attempts','toe_contact_curl_arch_ankle_knee_and_body_faults','first_fault','symptoms','duration','same_session_foot_toe_calf_balance_running_landing_jumping_and_lower_body_exposure')),
    jsonb_build_object('localMuscleFatigue',p.local_fatigue,'gripFatigue',1,'technicalFatigueSensitivity',p.technical_fatigue,'impactAccumulation',1,
      'recoveryHours',6,'recoveryRangeHours',jsonb_build_array(2,12),
      'primaryFatigueSites',jsonb_build_array('toe_extensors','plantar_intrinsic_foot_muscles','toe_flexor_stabilizers','foot_motor_control'),
      'cumulativeBudget',jsonb_build_object('validCyclesPerFoot',48,'activeWorkSeconds',480,'footToeLoad',18,'technicalSensitivity',p.technical_fatigue,'impact',0),
      'interference',jsonb_build_array('later_priority_balance_running_landing_jumping_or_agility_work','same_session_foot_toe_calf_or_lower_leg_loading','fatigue_or_cramping_that_changes_selective_contact_arch_ankle_or_knee_control'),
      'recoveryIsPlanningEstimate',TRUE,'tissueThresholdNotEstablished',TRUE),
    jsonb_build_object('trainingStimuli',jsonb_build_array('selective_toe_extension_control','non_target_toe_ground_contact','target_foot_stabilization'),
      'stimulusDose',jsonb_build_object('sets',jsonb_build_array(1,3),'cyclesPerSide',jsonb_build_array(4,10),'secondsPerCycle',jsonb_build_array(6,12),'restSeconds',jsonb_build_array(15,60)),
      'weeklyExposure',jsonb_build_object('minimum',0,'maximumWithoutReview',5,'unit','sessions','contextDependent',TRUE),
      'prerequisites',jsonb_build_array('safe_clean_foot_contact_station','comfortable_target_foot_contact_and_active_toe_extension','selected_support_position_is_safe','understands_two_phase_cycle_side_specific_count_and_stop','same_session_foot_and_priority_work_budgets_fit'),
      'completionCriteria',jsonb_build_array('one_target_foot_per_repetition','heel_and_metatarsal_heads_supported','correct_toe_group_moves_each_phase','non_target_toes_remain_down','toes_long_without_clawing','all_toes_return_between_phases','arch_ankle_knee_and_body_controlled','correct_side_specific_count','continuous_breathing','no_stop_symptom'),
      'sequenceRules',jsonb_build_array('prepare_or_resilience_context_only','count_each_complete_target_foot_two_phase_cycle','record_left_and_right_separately','do_not_turn_range_tempo_checkpoint_breathing_dose_side_order_or_context_into_hidden_variants','do_not_add_simultaneous_two_foot_action_manual_assistance_resistance_single_leg_instability_spread_short_foot_hold_press_locomotion_compound_assessment_or_clinical_action_silently'),
      'pairingCompatibility',jsonb_build_object('compatible',jsonb_build_array('low_dose_foot_control_preparation','separate_balance_control_accessory_when_fatigue_fits'),'avoid',jsonb_build_array('cramping_or_fatiguing_dose_before_priority_balance_running_landing_jumping_or_agility','symptom_provoking_toe_extension','same_session_foot_toe_budget_exceeded')),
      'interferenceRules',jsonb_build_array('count_all_overlapping_foot_toe_calf_balance_running_landing_jumping_and_lower_body_work','stop_before_selective_contact_arch_ankle_knee_or_breathing_control_changes'),
      'uncertaintyPolicy','When exact target side support position toe sequence count symptoms surface hygiene equipment or available time is uncertain do not select; request clarification or choose a separately validated card.',
      'selectionStatus','review_only_machine_complete','publicationQuarantined',TRUE,'exerciseDifficultyDescribesTaskOnly',TRUE,'approvalsCreated',FALSE)
  FROM (VALUES
    (standing_variant,'standing-hands-free-single-target-foot-cycle','Standing Hands-Free Single-Target-Foot Toe Yoga',42,8,44,10,6,7,'none',
      'standing_both_feet_supported_hands_free_one_target_foot_moves','both feet flat on floor target foot heel and metatarsal heads fixed hands free',
      'stand tall with both feet about hip-width and flat, knees soft, weight comfortably shared, hands free, and one target foot identified',
      'low_external_load_standing_selective_toe_cycle','bodyweight standing with both feet supported and no added resistance',9,3,11,30),
    (wall_variant,'standing-wall-touch-single-target-foot-cycle','Standing Wall-Touch Single-Target-Foot Toe Yoga',38,7,40,9,5,6,'wall',
      'standing_both_feet_supported_light_wall_touch_one_target_foot_moves','both feet flat target heel and metatarsal heads fixed one or both hands in light wall contact',
      'stand facing a stable wall with both feet about hip-width and flat, knees soft, light hand contact that does not unload the feet, and one target foot identified',
      'low_external_load_wall_supported_standing_selective_toe_cycle','bodyweight standing with light wall balance contact and no added resistance',8,3,10,27),
    (seated_variant,'seated-bench-single-target-foot-cycle','Seated Bench Single-Target-Foot Toe Yoga',34,5,36,8,4,5,'bench',
      'seated_bench_both_feet_supported_one_target_foot_moves','pelvis supported on stable bench both feet flat target heel and metatarsal heads fixed',
      'sit upright on a stable bench with both feet flat, hips and knees comfortable near right angles, thighs quiet, and one target foot identified',
      'minimal_external_load_seated_selective_toe_cycle','seated bodyweight with the target foot grounded and no added resistance',6,2,8,24)
  ) p(id,variant_key,display_name,technical,physical,coordination,supervision,failure,work_capacity,equipment,
      base,support_contacts,start_position,loading_type,external_load,joint_stress,spinal_loading,local_fatigue,technical_fatigue)
  ON CONFLICT(id) DO UPDATE SET definition_id=EXCLUDED.definition_id,variant_key=EXCLUDED.variant_key,
    display_name=EXCLUDED.display_name,modifier_keys=EXCLUDED.modifier_keys,difficulty_json=EXCLUDED.difficulty_json,
    requirements_json=EXCLUDED.requirements_json,status='review',load_profile_json=EXCLUDED.load_profile_json,
    fatigue_profile_json=EXCLUDED.fatigue_profile_json,programming_profile_json=EXCLUDED.programming_profile_json,updated_at=now();

  INSERT INTO coaching.exercise_delivery_profile_v1(
    id,variant_id,profile_key,phase_key,role,purpose,phase_suitability,methodology_alignment,
    objective_relevance_json,dosage_json,quality_gate,stop_rules,coach_instructions,
    athlete_instructions,expected_adaptation,equipment_required,logistics_json,
    substitution_ids,status,time_model_json,dose_scaling_json,measurement_json,support_prompts_json)
  SELECT p.id,p.variant_id,p.profile_key,p.phase_key,'primary',p.purpose,p.phase_suitability,p.methodology_alignment,
    jsonb_build_object('selective_toe_control',94,'foot_preparation',CASE WHEN p.phase_key='prepare_and_access' THEN 92 ELSE 82 END,
      'standing_balance_context',CASE WHEN p.phase_key='resilience' THEN 88 WHEN p.variant_id=standing_variant THEN 76 ELSE 58 END,
      'low_impact',99,'clinical_treatment',0),
    jsonb_build_object('sets',jsonb_build_array(p.set_min,p.set_max),'cyclesPerSide',jsonb_build_array(p.rep_min,p.rep_max),
      'secondsPerCycle',jsonb_build_array(6,12),'restSeconds',jsonb_build_array(p.rest_min,p.rest_max),
      'targetEffortRpe',jsonb_build_array(p.rpe_min,p.rpe_max),'exampleDoseIsNotUniversal',TRUE,
      'countLeftAndRightSeparately',TRUE,'stopBeforeMotorControlDegrades',TRUE),
    'One target foot completes great-toe lift and return, then lesser-toe lift and return to all toes down. The target heel and first and fifth metatarsal heads stay supported, non-target toes stay down in each phase, toes stay long, the selected standing or seated support remains exact, breathing continues, and no stop rule occurs.',
    ARRAY[
      'Sharp, increasing, night, post-trauma, or unfamiliar pain or participant stop request.',
      'Toe, forefoot, arch, foot, ankle, calf, knee, hip, or back symptoms prevent the exact task.',
      'Painful pinching, catching, joint irritation, instability, or cramping that does not resolve after reset.',
      'Numbness, tingling, weakness, altered circulation, skin breakdown, or another neurologic or skin sign.',
      'Dizziness, faintness, nausea, visual change, chest pain, unusual breathlessness, disorientation, or inability to communicate.',
      'The target heel, first metatarsal head, or fifth metatarsal head cannot remain supported.',
      'A non-target toe group lifts, toes curl or claw, or arch, ankle, knee, hip, or trunk compensation cannot be restored after reducing range or cycles.',
      'The support position changes, manual assistance is required during counted attempts, or the action becomes simultaneous, resisted, unstable, single-leg, a hold, a press, short-foot, toe-spread, locomotor, compound, assessment, or clinical work.',
      'Surface traction, temperature, hygiene, toe visibility, wall, bench, space, traffic, sightline, communication, or emergency route becomes unsafe.',
      'The planned side-specific cycle, active-time, technical-fatigue, local-fatigue, duration, or downstream foot and lower-body budget is reached.'
    ]::TEXT[],
    'Verify the exact card, target side, support variant, visible toes, clean dry nonslip foot-safe surface, wall or bench when required, symptoms, restrictions, planned side-specific cycles, time, and downstream work. Demonstrate all-toes-down start, great-toe phase and return, lesser-toe phase and return, one-cycle count, side switch, scaling, stop, and exit. Observe toe contacts, toe curl, metatarsal heads, heel, arch, ankle, knee, support, breathing, symptoms, first fault, actual duration, and safe exit. Do not force a toe down, count an assisted attempt as unassisted, diagnose, treat, or imply readiness.',
    'Set one target foot flat. Big toe up and down; four toes up and down. Keep your heel and toe mounds quiet, keep toes long, and count the full two-part cycle. Stop for pain, persistent cramp, tingling, weakness, skin discomfort, dizziness, or lost control.',
    CASE WHEN p.phase_key='resilience'
      THEN 'More repeatable selective toe control in the exact standing hands-free context under the reviewed dose; no balance, gait, performance, treatment, prevention, structural, or readiness outcome is guaranteed.'
      ELSE 'More consistent low-dose control of the exact target-foot selective toe cycle during preparation; no treatment, prevention, readiness, balance, gait, or performance outcome is guaranteed.' END,
    ARRAY[p.equipment]::TEXT[],
    jsonb_build_object('stationCapacity',1,'base',p.base,'requiredEquipment',p.equipment,
      'space','one_clear_visible_foot_station_with_safe_entry_exit','setupSeconds',p.setup_seconds,
      'coachSightline','top_and_front_quarter','crossTrafficProhibited',TRUE,
      'surfaceHygieneToeVisibilityAndEquipmentInspectionRequired',TRUE,'revalidateAfterAnyChange',TRUE),
    CASE p.variant_id
      WHEN standing_variant THEN ARRAY[wall_variant,seated_variant,short_foot_variant,tripod_shift_variant,big_toe_press_variant]::UUID[]
      WHEN wall_variant THEN ARRAY[standing_variant,seated_variant,short_foot_variant,tripod_shift_variant,big_toe_press_variant]::UUID[]
      ELSE ARRAY[wall_variant,standing_variant,short_foot_variant,tripod_shift_variant,big_toe_press_variant]::UUID[] END,
    'review',
    jsonb_build_object('durationFormula','surface_hygiene_equipment_and_body_setup_seconds + sum(actual_valid_cycles_by_side * actual_seconds_per_cycle) + side_switch_seconds + rest_seconds + invalid_partial_assisted_or_symptom_limited_attempt_seconds + substitution_seconds + station_reset_cleaning_and_exit_seconds',
      'secondsPerCycle',jsonb_build_array(6,12),'minimumSeconds',p.minimum_seconds,'typicalSeconds',p.typical_seconds,
      'maximumSecondsWithoutReview',p.maximum_seconds,'includeActualNotPlanned',TRUE,'recomputeAfterSubstitution',TRUE),
    jsonb_build_object('regressionOrder',CASE p.variant_id
        WHEN standing_variant THEN jsonb_build_array('reduce_cycles','reduce_to_comfortable_range','slow_and_reset_between_phases','increase_rest','select_wall_touch_variant','select_seated_variant','end_set')
        WHEN wall_variant THEN jsonb_build_array('reduce_cycles','reduce_to_comfortable_range','slow_and_reset_between_phases','increase_rest','select_seated_variant','end_set')
        ELSE jsonb_build_array('reduce_cycles','reduce_to_comfortable_range','slow_and_reset_between_phases','increase_rest','end_set','route_manual_assistance_to_separate_variant_review') END,
      'progressionOrder',CASE p.variant_id
        WHEN seated_variant THEN jsonb_build_array('complete_clean_cycles','increase_cycles_within_profile','select_wall_touch_variant','select_standing_hands_free_variant_after_full_revalidation')
        WHEN wall_variant THEN jsonb_build_array('complete_clean_cycles','increase_cycles_within_profile','select_standing_hands_free_variant_after_full_revalidation')
        ELSE jsonb_build_array('complete_clean_cycles','increase_cycles_within_profile','increase_sets_within_profile','select_separately_reviewed_resisted_unstable_or_single_leg_variant_after_full_revalidation') END,
      'neverScaleByForcingRangeHoldingToesDownCountingAssistedAttemptsIgnoringSymptomsOrChangingTaskSilently',TRUE),
    jsonb_build_object('record',jsonb_build_array('definition_variant_profile_and_card_version','target_side_order_and_support_position','surface_hygiene_wall_bench_foot_covering_and_station','planned_and_actual_valid_cycles_per_side','range_tempo_effort_and_rest','valid_invalid_partial_assisted_and_symptom_limited_attempts','toe_contact_curl_arch_ankle_knee_and_body_faults','first_fault','symptoms_and_stop_reason','active_work_seconds','duration','substitution','cleaning_station_reset_and_exit'),
      'validUnit','one_target_foot_hallux_lift_and_return_plus_lesser_toe_lift_and_return_to_all_toes_down_valid',
      'invalidUnitsTrackedSeparately',TRUE,'leftAndRightNeverMerged',TRUE,
      'doNotConvertToSimultaneousFeetHoldSecondsPressForceShortFootRangeBalanceTimeClinicalScoreOrSportAction',TRUE),
    jsonb_build_object('athlete',jsonb_build_array('one_target_foot','heel_and_toe_mounds_down','big_toe_up_down','four_toes_up_down','toes_long','body_quiet','one_full_cycle_one_rep','count_each_side','stop_for_unexpected_symptoms'),
      'coach',jsonb_build_array('verify_exact_identity_and_target_side','inspect_surface_hygiene_visibility_wall_bench_and_station','observe_toe_groups_contacts_support_and_count','record_actual_exposure_by_side_and_first_fault','do_not_count_assisted_attempts_as_unassisted','revalidate_every_substitution'),
      'accessibility',jsonb_build_array('top_and_front_quarter_visual','written_big_toe_up_down_then_four_toes_up_down_sequence','smaller_range_fewer_cycles_and_more_rest','visible_phase_side_and_count cards','captions_transcript_still_images_or_live_instruction'),
      'escalation',jsonb_build_array('stop','stabilize_and_exit_station','follow_facility_policy','record_observed_facts','do_not_resume_without_reassessment'))
  FROM (VALUES
    ('85ed9e6f-5cbd-43fe-a25a-0f7e198106ad'::UUID,standing_variant,'prepare-standing-hands-free-toe-yoga','prepare_and_access',94,92,
      'Use the exact standing hands-free target-foot cycle as low-dose preparation only when standing control and later foot or sport budgets fit.',1,2,4,8,15,40,1,3,'none','standing_hands_free_visible_foot_station',20,70,150,300),
    ('a759e1da-1297-46c2-b666-6295f220d9a0'::UUID,standing_variant,'resilience-standing-hands-free-toe-yoga','resilience',88,88,
      'Use the exact standing hands-free cycle as a foot-control resilience exposure only when selective toe control remains the task and fatigue is not the goal.',1,3,4,10,20,60,2,4,'none','standing_hands_free_visible_foot_station',20,90,240,480),
    ('cecf5708-8bb8-48df-8d46-49102ce2d9ba'::UUID,wall_variant,'prepare-standing-wall-touch-toe-yoga','prepare_and_access',94,92,
      'Use the exact light wall-touch standing cycle when balance support is needed to preserve the selective toe task.',1,2,4,8,15,45,1,3,'wall','standing_wall_touch_visible_foot_station',25,80,170,330),
    ('76b5afdb-ad48-4d4b-b07d-09575a293f75'::UUID,seated_variant,'prepare-seated-bench-toe-yoga','prepare_and_access',96,94,
      'Use the exact seated target-foot cycle when minimizing whole-body balance demand best preserves selective toe control.',1,2,4,8,15,45,1,3,'bench','seated_bench_visible_foot_station',25,80,170,330)
  ) p(id,variant_id,profile_key,phase_key,phase_suitability,methodology_alignment,purpose,
      set_min,set_max,rep_min,rep_max,rest_min,rest_max,rpe_min,rpe_max,equipment,base,setup_seconds,
      minimum_seconds,typical_seconds,maximum_seconds)
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
  VALUES(1,canonical_definition,duplicate_definition,'duplicate_consolidated',
    'Source 524 uses the same one-foot great-toe then lesser-toe selective-extension sequence as Source 45. Tripod, balance, and resilience language describes standing delivery context; it does not add a different executable exercise action.',
    jsonb_build_object('migration',migration_key,'identityBoundary','same_target_foot_two_phase_selective_toe_extension_cycle',
      'source45Contract','stand_or_sit_then_great_toe_lift_return_then_lesser_toe_lift_return',
      'source524Contract','standing_tripod_then_great_toe_lift_return_then_lesser_toe_lift_return_on_both_feet',
      'supportPositionsAuthoredAsExplicitVariants',to_jsonb(active_variant_ids),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'deterministic_identity_equivalence',NULL,now())
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,resolved_at=now();

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,rationale,evidence_json,
    resolution_source,reviewed_by,resolved_at)
  SELECT 1,canonical_definition,i.definition_id,'distinct_exercises',i.rationale,
    jsonb_build_object('migration',migration_key,'identityBoundary',i.boundary_key,
      'toeYogaContract','one_target_foot_hallux_then_lesser_toe_selective_extension_cycle',
      'neighborContract',i.neighbor_contract,'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'deterministic_identity_equivalence',NULL,now()
  FROM (VALUES
    (short_foot_definition,'selective_digit_extension_vs_arch_shortening','Short-Foot Drill shortens and raises the arch without toe flexion; it does not alternate great-toe and lesser-toe extension.','arch_shortening_without_toe_motion'),
    (tripod_shift_definition,'selective_digit_extension_vs_whole_foot_pressure_shift','Foot Tripod Weight Shifts moves pressure across the foot while the toes remain organized; it does not require the two selective toe-extension phases.','standing_whole_foot_pressure_shift'),
    (big_toe_press_definition,'dynamic_two_phase_cycle_vs_sustained_hallux_press','Big Toe Press Iso Hold prescribes a sustained great-toe pressing action and time-based dose rather than a great-toe and lesser-toe extension cycle.','sustained_hallux_press_isometric'),
    (short_foot_calf_definition,'single_digit_control_cycle_vs_compound_arch_and_calf_raise','Short Foot to Calf Raise combines a separately cued arch action with a plantarflexion raise and controlled return.','short_foot_to_calf_raise_compound')
  ) i(definition_id,boundary_key,rationale,neighbor_contract)
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,resolved_at=now();

  INSERT INTO coaching.exercise_section_evidence_v1(
    definition_id,reviewed_card_version,section_key,source_url,source_title,source_publisher,
    source_kind,claims_json,evidence_quality,review_status,reviewer_user_id,reviewed_at)
  SELECT canonical_definition,2,e.section_key,e.source_url,e.source_title,e.publisher,e.source_kind,
    jsonb_build_array(jsonb_build_object('supported',e.supported_claim,'scope',e.scope),
      jsonb_build_object('limitation',e.limitation,
        'noUniversalTechniqueEligibilityRangeDoseFatigueRecoveryOutcomeOrDifficultyClaim',TRUE)),
    e.quality,'candidate',NULL,NULL
  FROM (VALUES
    ('identity','https://pmc.ncbi.nlm.nih.gov/articles/PMC5094843/','Intrinsic Foot Muscle Activation During Specific Exercises: A T2 Time Magnetic Resonance Imaging Study','Journal of Athletic Training','peer_reviewed_research','First-toe extension with toes two through five down and lesser-toe extension with the great toe down are distinguishable target-foot actions performed one foot at a time.','direct selective-toe-action identity context','The study tests the actions separately while seated and does not define the Vortex combined cycle, standing variants, side order, valid count, or publication rules.',88),
    ('taxonomy','https://pmc.ncbi.nlm.nih.gov/articles/PMC13028051/','Kinematic Characteristics and Reliability of Selective Toe Extension Tasks in Young and Older Adults','Journal of Functional Morphology and Kinesiology','peer_reviewed_research','Selective hallux extension and selective four-toe extension are active digit-motion tasks under explicit non-target ground-contact constraints.','direct action and ground-contact taxonomy context','The study is an assessment protocol and does not create Vortex controlled taxonomy keys or a workout prescription.',89),
    ('anatomy','https://pmc.ncbi.nlm.nih.gov/articles/PMC5094843/','Intrinsic Foot Muscle Activation During Specific Exercises: A T2 Time Magnetic Resonance Imaging Study','Journal of Athletic Training','peer_reviewed_research','Both selective toe-extension tasks increased activation across all measured plantar intrinsic foot muscles rather than isolating a single intrinsic muscle.','direct intrinsic muscle-activation context','T2 change cannot establish exact muscle force, individual difficulty, standing mechanics, or isolated contribution.',88),
    ('biomechanics','https://pmc.ncbi.nlm.nih.gov/articles/PMC13028051/','Kinematic Characteristics and Reliability of Selective Toe Extension Tasks in Young and Older Adults','Journal of Functional Morphology and Kinesiology','peer_reviewed_research','Non-target toe contact and unintended inter-toe movement are observable features of selective hallux and four-toe extension tasks.','direct kinematic and motor-coupling context','Seated dominant-foot assessment findings do not validate standing transfer, maximal range targets, or forced suppression of all associated motion.',89),
    ('difficulty','https://pmc.ncbi.nlm.nih.gov/articles/PMC5094843/','Intrinsic Foot Muscle Activation During Specific Exercises: A T2 Time Magnetic Resonance Imaging Study','Journal of Athletic Training','peer_reviewed_research','The authors explicitly could not infer how task activation represented individual difficulty or muscle force, while the actions require selective motor control.','direct difficulty-uncertainty context','The study does not score Vortex exercise complexity or physical difficulty and does not classify participants.',88),
    ('load_fatigue_recovery','https://pmc.ncbi.nlm.nih.gov/articles/PMC5094843/','Intrinsic Foot Muscle Activation During Specific Exercises: A T2 Time Magnetic Resonance Imaging Study','Journal of Athletic Training','peer_reviewed_research','Forty metronome-paced repetitions per foot produced measurable intrinsic-foot activation in a small healthy-athlete sample.','direct acute exposure context','The protocol does not establish a workout dose, fatigue ceiling, recovery interval, clinical threshold, or standing load budget.',88),
    ('constraints','https://pmc.ncbi.nlm.nih.gov/articles/PMC13028051/','Kinematic Characteristics and Reliability of Selective Toe Extension Tasks in Young and Older Adults','Journal of Functional Morphology and Kinesiology','peer_reviewed_research','The studied selective tasks used one flat target foot, seated support, visible ground-contact constraints, and explicit non-target toe contact.','direct setup and observation context','The study does not establish universal eligibility, surface hygiene, footwear, wall support, bench geometry, or symptom rules.',89),
    ('dosage','https://pubmed.ncbi.nlm.nih.gov/35724360/','Evidence for Intrinsic Foot Muscle Training in Improving Foot Function: A Systematic Review and Meta-Analysis','Journal of Athletic Training','peer_reviewed_research','Intrinsic-foot training studies use varied multiweek interventions and outcome measures rather than one universal exercise dose.','adjacent programming context','Pooled intervention findings do not validate the Vortex cycle dose, frequency, fatigue ceiling, or individual outcome.',92),
    ('instructions','https://pmc.ncbi.nlm.nih.gov/articles/PMC11911532/','Non-Operative Management of Symptomatic Hallux Limitus: A Novel Approach of Foot Core Stabilization and Extracorporeal Shockwave Therapy','International Journal of Sports Physical Therapy','peer_reviewed_research','Toe yoga is described as great-toe extension with lesser toes grounded, followed by the reverse action with the great toe grounded.','direct sequence wording in a clinical program','This clinical article does not validate Vortex workout eligibility, dose, support variants, count, treatment claims, or publication.',74),
    ('safety_stop_rules','https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf','Youth Resistance Training: Updated Position Statement Paper From the NSCA','National Strength and Conditioning Association','professional_standard','Qualified instruction, safe equipment and environment, appropriate progression, and technique supervision are general exercise safeguards.','general safety and supervision context','The position statement does not create an age floor, toe-specific symptom threshold, barefoot policy, or clinical rule for this card.',90),
    ('programming','https://pubmed.ncbi.nlm.nih.gov/35442981/','Effect of intrinsic foot muscles training on foot function and dynamic postural balance: A systematic review and meta-analysis','PLOS ONE','peer_reviewed_research','Intrinsic-foot training may influence some foot and dynamic-balance outcomes across heterogeneous programs.','adjacent programming and outcome context','The review does not isolate this exact Toe Yoga cycle or guarantee balance, gait, sport, treatment, or prevention outcomes.',91),
    ('athlete_support','https://pmc.ncbi.nlm.nih.gov/articles/PMC13028051/','Kinematic Characteristics and Reliability of Selective Toe Extension Tasks in Young and Older Adults','Journal of Functional Morphology and Kinesiology','peer_reviewed_research','Selective tasks can show incomplete range and unintended non-target movement, so small controlled motion is more defensible than forcing maximal separation.','plain-language self-check context','The study is not an athlete self-management or treatment guide.',89),
    ('coach_support','https://pmc.ncbi.nlm.nih.gov/articles/PMC13028051/','Kinematic Characteristics and Reliability of Selective Toe Extension Tasks in Young and Older Adults','Journal of Functional Morphology and Kinesiology','peer_reviewed_research','Ground contact and unintended movement of non-target toes can be observed during selective toe-extension tasks.','direct observation context','Visual observation cannot diagnose neurologic, structural, age-related, or clinical impairment.',89),
    ('accessibility','https://pmc.ncbi.nlm.nih.gov/articles/PMC13028051/','Kinematic Characteristics and Reliability of Selective Toe Extension Tasks in Young and Older Adults','Journal of Functional Morphology and Kinesiology','peer_reviewed_research','Seated support reduces whole-body balance demand and can focus observation on toe motor control.','direct seated-support context','This does not prove seated work is universally safer or equivalent for every participant or goal.',89),
    ('alternates','https://pmc.ncbi.nlm.nih.gov/articles/PMC7739583/','How to Evaluate and Improve Foot Strength in Athletes: An Update','Frontiers in Sports and Active Living','peer_reviewed_research','First-toe extension, lesser-toe extension, toe-spread-out, short-foot, toe-flexion, and other foot exercises have different action contracts.','direct exercise-family boundary context','The review does not validate Vortex progression, regression, equivalence, or substitution relationships.',86),
    ('media','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en','Embed videos and playlists','YouTube Help','manufacturer_instruction','Five candidate URLs returned current YouTube oEmbed title, channel, thumbnail, and iframe metadata on 2026-08-09.','link and embed metadata only','Playback, exact target-foot sequence, support, count, captions, accessibility, cue quality, safety, reviewer identity, and approval remain unverified.',82)
  ) e(section_key,source_url,source_title,publisher,source_kind,supported_claim,scope,limitation,quality)
  ON CONFLICT(definition_id,reviewed_card_version,section_key,source_url) DO UPDATE SET
    source_title=EXCLUDED.source_title,source_publisher=EXCLUDED.source_publisher,
    source_kind=EXCLUDED.source_kind,claims_json=EXCLUDED.claims_json,
    evidence_quality=EXCLUDED.evidence_quality,review_status='candidate',
    reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_media_candidate_v1(
    definition_id,variant_id,reviewed_card_version,url,embed_url,video_id,title,channel_name,
    duration_seconds,language_code,captions_available,embedding_allowed,exact_variant_match,
    demonstration_quality_score,link_status,review_status,discovery_method,source_query,
    reviewer_user_id,reviewed_at,next_review_at,notes)
  SELECT canonical_definition,NULL,2,'https://www.youtube.com/watch?v='||m.video_id,
    'https://www.youtube-nocookie.com/embed/'||m.video_id,m.video_id,m.title,m.channel,NULL,'en',NULL,TRUE,NULL,NULL,
    'healthy','candidate','manual_research',m.query,NULL,NULL,'2026-11-09'::TIMESTAMPTZ,
    'Current YouTube oEmbed metadata only. Candidate is not assigned to a variant because full playback has not established seated versus standing support, one-target-foot sequence, heel and metatarsal-head contacts, great-toe phase, lesser-toe phase, controlled returns, side-specific count, compensations, captions, accessibility, cue quality, safety, reviewer identity, card-version match, or approval.'
  FROM (VALUES
    ('SbQ2RYxbppE','Toe Yoga Exercise for Plantar Fasciitis','Sharp HealthCare','Toe Yoga candidate checked by YouTube oEmbed; clinical framing and exact variant require full review'),
    ('QVZpBSVV9js','How to Do a Toe Yoga Exercise: A Guide from Physical Therapists','Hinge Health','Toe Yoga guide candidate checked by YouTube oEmbed; exact support and sequence require full review'),
    ('bUoTjK0tQEw','Toe Yoga?  A Physical Therapist Explains and Demonstrates','Congruency Therapy & Wellness','Toe Yoga demonstration candidate checked by YouTube oEmbed; full exact review pending'),
    ('SkFZ5zVXGEo','Toe Yoga aka Intrinsic Foot Strengthening','Reclaim Restore Health by Nicole Paine','Toe Yoga candidate checked by YouTube oEmbed; strength framing and exact mechanics require full review'),
    ('kp8QI1Uj59Q','Toe Yoga','MOBO','Toe Yoga coordination candidate checked by YouTube oEmbed; full exact review pending')
  ) m(video_id,title,channel,query)
  ON CONFLICT(definition_id,reviewed_card_version,url) DO UPDATE SET
    variant_id=NULL,embed_url=EXCLUDED.embed_url,video_id=EXCLUDED.video_id,
    title=EXCLUDED.title,channel_name=EXCLUDED.channel_name,duration_seconds=NULL,
    language_code='en',captions_available=NULL,embedding_allowed=TRUE,exact_variant_match=NULL,
    demonstration_quality_score=NULL,link_status='healthy',review_status='candidate',
    discovery_method='manual_research',source_query=EXCLUDED.source_query,reviewer_user_id=NULL,
    reviewed_at=NULL,next_review_at=EXCLUDED.next_review_at,notes=EXCLUDED.notes,updated_at=now();

  INSERT INTO coaching.exercise_alternate_assessment_v1(
    definition_id,reviewed_card_version,alternate_name,classification,rationale,
    distinguishing_dimensions,proposed_card_json,review_status,reviewer_user_id,reviewed_at)
  SELECT canonical_definition,2,a.name,a.classification,a.rationale,
    jsonb_build_object('boundaryKey',a.boundary_key,'factsRequired',a.facts,
      'neverInferFromNameParticipantRankingAgeOrSportContext',TRUE),
    jsonb_build_object('status',a.proposed_status,'classificationCandidate',a.classification,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'candidate',NULL,NULL
  FROM (VALUES
    ('Standing Hands-Free Single-Target-Foot Toe Yoga','same_identity','This is the authored standing hands-free exact variant of the same two-phase target-foot cycle.','authored_exact_variant',jsonb_build_array('standing','hands_free','single_target_foot'),'authored_review_variant'),
    ('Standing Wall-Touch Single-Target-Foot Toe Yoga','same_identity','This is the authored light wall-touch exact variant of the same two-phase target-foot cycle.','authored_exact_variant',jsonb_build_array('standing','wall_touch','single_target_foot'),'authored_review_variant'),
    ('Seated Single-Target-Foot Toe Yoga','same_identity','This is the authored stable-bench seated exact variant of the same two-phase target-foot cycle.','authored_exact_variant',jsonb_build_array('seated','bench','single_target_foot'),'authored_review_variant'),
    ('Toe-Yoga Tripod Balance','same_identity','Source 524 retains the same selective great-toe then lesser-toe sequence; tripod and balance language is standing delivery context.','duplicate_name_same_action',jsonb_build_array('source_524','standing_context'),'duplicate_consolidated'),
    ('Left Foot First or Right Foot First','modifier_annotation','Foot order does not change the target-foot cycle when each side is recorded separately.','side_order_annotation',jsonb_build_array('target_side_order'),'annotation_only'),
    ('Comfortable Smaller Toe-Lift Range','modifier_annotation','Comfortable active range can decrease while contacts, action order, returns, and valid count remain unchanged.','range_annotation',jsonb_build_array('comfortable_active_range'),'annotation_only'),
    ('Slower Toe Yoga Tempo','modifier_annotation','Tempo can vary while neither phase becomes a prescribed hold and the complete cycle remains intact.','tempo_annotation',jsonb_build_array('tempo'),'annotation_only'),
    ('Brief Toe-Group Observation Checkpoint','modifier_annotation','A brief untimed checkpoint used to observe contact is not a sustained isometric dose.','checkpoint_annotation',jsonb_build_array('brief_untimed_checkpoint'),'annotation_only'),
    ('Toe Yoga Repetition Set and Rest Changes','modifier_annotation','Cycles per side, sets, and rest are dosage fields within a reviewed delivery profile.','dose_annotation',jsonb_build_array('cycles_per_side','sets','rest'),'annotation_only'),
    ('Prepare versus Resilience Toe Yoga Context','modifier_annotation','Delivery phase changes purpose and dose, not the exercise identity or executable two-phase action.','delivery_context_annotation',jsonb_build_array('phase','purpose','dose'),'annotation_only'),
    ('Barefoot versus Approved Thin Sock','modifier_annotation','Foot covering is an operational annotation only when traction, hygiene, comfort, and full toe observation remain adequate.','foot_covering_annotation',jsonb_build_array('foot_covering','visibility','traction','hygiene'),'annotation_only'),
    ('Standing Stance Width Adjustment','modifier_annotation','A small comfortable stance-width change is an annotation when both feet remain supported and target-foot mechanics do not change.','stance_annotation',jsonb_build_array('stance_width'),'annotation_only'),
    ('Simultaneous Bilateral Toe Yoga','new_variant','Moving both feet simultaneously changes laterality, observation, valid count, balance demand, and compensation rules.','simultaneous_bilateral_variant',jsonb_build_array('bilateral_simultaneous','count'),'research_queue'),
    ('Manually Assisted Toe Yoga','new_variant','Holding down or guiding toes changes external assistance, motor-control demand, validity, and coach contact requirements.','manual_assistance_variant',jsonb_build_array('manual_assistance','consent','count'),'research_queue'),
    ('Banded Resisted Toe Yoga','new_variant','External resistance changes equipment, load, force direction, setup, fatigue, and failure behavior.','resisted_variant',jsonb_build_array('band','external_resistance'),'research_queue'),
    ('Toe Yoga Sustained Top Hold','new_variant','Prescribing a sustained great-toe or lesser-toe hold changes contraction mode, dose unit, fatigue, endpoint, and count.','isometric_variant',jsonb_build_array('sustained_isometric','hold_seconds'),'research_queue'),
    ('Single-Leg Stance Toe Yoga','new_variant','Removing the other foot from support changes balance, foot loading, failure consequence, support, and stop rules.','single_leg_variant',jsonb_build_array('single_leg','balance','load'),'research_queue'),
    ('Unstable-Surface Toe Yoga','new_variant','A foam pad or unstable surface changes support, balance, foot pressure, logistics, and failure behavior.','unstable_surface_variant',jsonb_build_array('unstable_surface','balance'),'research_queue'),
    ('Eyes-Closed Toe Yoga','new_variant','Removing vision changes sensory demand, balance risk, supervision, and stop rules.','reduced_vision_variant',jsonb_build_array('eyes_closed','sensory_demand'),'research_queue'),
    ('Alternating Feet Every Repetition','new_variant','Switching target feet each repetition changes sequencing, duration, count, logistics, and observation.','alternating_feet_variant',jsonb_build_array('alternating_laterality','count','transition'),'research_queue'),
    ('Split-Stance Toe Yoga','new_variant','A split stance changes support geometry, weight distribution, standing balance, and target-foot loading.','split_stance_variant',jsonb_build_array('split_stance','weight_distribution'),'research_queue'),
    ('Toe Spread-Out Exercise','new_definition','Extending and abducting or spreading the toes uses a different multi-direction digit action rather than selective great-toe and lesser-toe phases.','toe_spread_distinct',jsonb_build_array('toe_abduction','multi_digit_sequence'),'research_queue'),
    ('Short-Foot Drill','new_definition','Short-foot intentionally shortens and raises the arch without the selective toe-extension cycle.','short_foot_distinct',jsonb_build_array('arch_shortening','no_toe_extension_cycle'),'existing_distinct_definition'),
    ('Foot Tripod Weight Shifts','new_definition','Pressure shifts move the body or center of pressure across the whole foot instead of alternating toe groups.','tripod_shift_distinct',jsonb_build_array('pressure_shift','whole_foot_control'),'existing_distinct_definition'),
    ('Big Toe Press Iso Hold','new_definition','A sustained hallux press is a time-based isometric task, not the two-phase extension-and-return cycle.','hallux_press_distinct',jsonb_build_array('hallux_press','isometric_hold'),'existing_distinct_definition'),
    ('Towel Curl or Toe-Grip Exercise','new_definition','Toe flexion and gripping against a towel or object reverse the digit action and add equipment and load.','toe_flexion_distinct',jsonb_build_array('toe_flexion','grip','implement'),'research_queue'),
    ('Maximal Selective Toe-Extension Assessment','new_definition','A maximal measurement protocol has a different purpose, instrumentation, effort, validity, and clinical interpretation.','assessment_distinct',jsonb_build_array('maximal_assessment','measurement','clinical_scope'),'research_queue'),
    ('Short Foot to Calf Raise','new_definition','A separately cued arch action and plantarflexion raise form a compound sequence rather than a selective toe cycle.','compound_distinct',jsonb_build_array('short_foot','calf_raise','compound_sequence'),'existing_distinct_definition')
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
      'revalidate',jsonb_build_array('identity purpose and target side','support position weight bearing wall bench surface hygiene and toe visibility','toe sequence contacts returns and count','symptoms restrictions and clinical scope','dose effort rest duration and logistics','foot toe calf balance running landing jumping and lower-body budgets','persistence','coach rendering','athlete rendering'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'review',NULL,NULL,NULL
  FROM (VALUES
    (standing_variant,wall_variant,'regression',92,ARRAY['stability','complexity']::TEXT[],'Adds light wall balance support while preserving standing weight bearing and the exact target-foot cycle.'),
    (standing_variant,seated_variant,'regression',84,ARRAY['stability','load','complexity']::TEXT[],'Changes standing to seated support to reduce whole-body balance and target-foot loading; recompute logistics and scores.'),
    (wall_variant,standing_variant,'progression',92,ARRAY['stability','complexity']::TEXT[],'Removes wall contact while preserving standing foot support and the exact target-foot cycle.'),
    (wall_variant,seated_variant,'regression',88,ARRAY['stability','load','complexity']::TEXT[],'Changes wall-supported standing to stable seated support to focus the toe task.'),
    (seated_variant,wall_variant,'progression',88,ARRAY['stability','load','complexity']::TEXT[],'Adds standing weight bearing with wall contact; select only after full standing and logistics revalidation.'),
    (standing_variant,short_foot_variant,'lateral_substitution',48,ARRAY['range','complexity']::TEXT[],'Changes selective digit extension to arch shortening and is not an automatic equivalent.'),
    (standing_variant,tripod_shift_variant,'lateral_substitution',44,ARRAY['stability','range','complexity']::TEXT[],'Changes toe individuation to whole-foot pressure shifting and standing center-of-pressure control.'),
    (standing_variant,big_toe_press_variant,'lateral_substitution',50,ARRAY['load','fatigue','range']::TEXT[],'Changes a dynamic two-phase cycle to a sustained hallux press with time-based dose.')
  ) r(from_id,to_id,relationship,score,dimensions,reason)
  ON CONFLICT(from_variant_id,to_variant_id,relationship) DO UPDATE SET
    similarity_score=EXCLUDED.similarity_score,dimensions=EXCLUDED.dimensions,
    reason=EXCLUDED.reason,conditions_json=EXCLUDED.conditions_json,review_status='review',
    created_by=NULL,reviewed_by=NULL,reviewed_at=NULL,updated_at=now()
  WHERE coaching.exercise_relationship_v1.reviewed_by IS NULL
    AND coaching.exercise_relationship_v1.review_status<>'approved';

  INSERT INTO coaching.exercise_score_calibration_v1(
    facility_id,variant_id,dimension,proposed_score,anchor_tier,rationale,status,version,
    created_by,reviewed_by,review_notes,reviewed_at)
  SELECT 1,v.variant_id,d.dimension,
    CASE d.dimension WHEN 'technicalComplexity' THEN v.technical ELSE v.physical END,20,
    CASE d.dimension WHEN 'technicalComplexity' THEN
      'Review-only task-complexity anchor based on support position, one-target-foot selection, two selective toe groups, non-target ground contact, complete returns, side-specific counting, toe-curl and foot-compensation faults, and exact observation.'
    ELSE
      'Review-only task physical-demand anchor based on low-force active digit motion, target-foot contact, support-position loading, no external resistance, no impact, and low local fatigue.' END
      ||' This scores the exercise task, not the participant. Variant: '||v.variant_name||'.',
    'review',1,NULL,NULL,'Research-informed proposal only; independent comparison and qualified human approval remain required.',NULL
  FROM (VALUES
    (standing_variant,'standing hands-free',42,8),
    (wall_variant,'standing wall-touch',38,7),
    (seated_variant,'seated bench',34,5)
  ) v(variant_id,variant_name,technical,physical)
  CROSS JOIN (VALUES('technicalComplexity'),('absoluteLoadDemand')) d(dimension)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
    proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,reviewed_by=NULL,
    review_notes=EXCLUDED.review_notes,reviewed_at=NULL,updated_at=now();

  UPDATE coaching.exercise SET
    name='Toe Yoga',slug='toe-yoga',
    description='Place one target foot flat with its heel, first and fifth metatarsal heads, and relaxed toes down. Lift only the great toe while toes two through five stay long and down; lower it. Then keep the great toe and first metatarsal head down while lifting toes two through five; lower all toes. Count the complete two-part target-foot cycle as one repetition and record each side separately.',
    instructions='Select the exact standing hands-free, standing wall-touch, or seated bench variant. Keep the target heel and toe mounds supported. Move the great toe up and down, then the four lesser toes up and down, with toes long and the rest of the foot and body quiet. Stop for pain, persistent cramp, pinching, numbness, tingling, weakness, altered circulation, skin discomfort, dizziness, unsafe support or surface, or participant request. Do not count a manually assisted attempt as an unassisted repetition.',
    skill_level=NULL,age_min=NULL,age_max=NULL,default_sets=1,default_reps=6,
    default_work_seconds=120,default_rest_seconds=30,
    tempo='about one to three seconds for each lift and each controlled return with a full reset between toe groups',
    load_note='Track definition, exact support variant, target side order, clean foot-safe surface, hygiene, toe visibility, wall or bench when required, planned and actual valid cycles for each foot, range, tempo, effort, rest, toe-group ground contacts, heel and metatarsal-head contacts, toe curl, arch, ankle, knee and body faults, assisted invalid or partial attempts, first fault, symptoms, active work, duration, substitution, cleaning, station reset, exit, and overlapping foot, toe, calf, balance, running, landing, jumping and lower-body exposure.',
    est_seconds_per_set=200,is_published=FALSE,archived=FALSE,
    card_summary='One-target-foot selective toe-control cycle: great toe up and down, then four lesser toes up and down, with exact standing hands-free, wall-touch, or seated support and side-specific counting.',
    coach_language='Verify the exact target-foot two-phase cycle, target side, support variant, surface hygiene and toe visibility, wall or bench, symptoms and restrictions, side-specific dose, actual exposure, first fault, duration, downstream foot budget, persistence, exit, and escalation. Do not force range or count assisted attempts as unassisted.',
    athlete_language='One foot at a time: big toe up and down, then four toes up and down. Keep the heel and toe mounds quiet and toes long. One full two-part cycle is one rep; count each foot separately.',
    programming_logic=jsonb_build_object('selectionStatus','canonical_variant_required','selectable',TRUE,
      'canonicalDefinitionId',canonical_definition,'exactVariantIds',to_jsonb(active_variant_ids),
      'difficultyModel','max_exercise_complexity_physical_difficulty','exerciseDifficultyDescribesTaskOnly',TRUE,
      'selectionInputs',jsonb_build_array('workout purpose and delivery context','target side order','standing hands-free standing wall-touch or seated bench support','clean dry nonslip foot-safe surface hygiene toe visibility and approved foot covering','comfortable active toe extension and target-foot contacts','exact great-toe return lesser-toe return and side-specific count comprehension','dose range tempo effort rest and duration','cumulative foot toe calf balance and priority-work exposure','coach scope and sightline'),
      'substitutionRevalidation',jsonb_build_array('identity','target side support position weight bearing and wall or bench','toe sequence contacts returns and count','surface hygiene toe visibility equipment space traffic and exit','restrictions and symptoms','purpose','dose','fatigue and impact budgets','duration','logistics','persistence','coach rendering','athlete rendering'),
      'legacySourceIds',jsonb_build_array(45,524),'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    scalable_variables=ARRAY['target_side_order','comfortable_active_range','tempo','brief_observation_checkpoint','breathing_prompt','cycles_per_side','sets','rest_seconds','effort_target','approved_foot_covering','delivery_context']::TEXT[],
    movement_family='Selective toe extension cycle',primary_phase_key='prepare_and_access',
    phase_subrole='foot_activation',primary_order_slot='foot_activation',
    movement_requirements=jsonb_build_object('impact_level',0,'balance_demand','variant_dependent_from_minimal_seated_to_low_standing',
      'postural_shape','one_target_foot_flat_with_selected_standing_or_seated_support',
      'primary_tissues',jsonb_build_array('toe_extensors','plantar_intrinsic_foot_muscles','toe_flexor_stabilizers','foot_and_ankle_stabilizers'),
      'breathing_demand','continuous_relaxed_breathing','coordination_demand','moderate_selective_digit_control',
      'primary_joint_actions',jsonb_build_array('target_hallux_extension_and_return','target_lesser_toe_extension_and_return','non_target_toe_ground_contact','heel_metatarsal_head_arch_ankle_and_limb_stabilization'),
      'supportContactsByVariant',jsonb_build_object('standingHandsFree','both_feet_on_floor_hands_free','standingWallTouch','both_feet_on_floor_light_wall_hand_contact','seated','pelvis_on_bench_both_feet_on_floor'),
      'exactSequence',jsonb_build_array('target_foot_all_toes_down','hallux_up_lesser_toes_down','hallux_return','lesser_toes_up_hallux_down','lesser_toes_return','all_toes_down_one_target_foot_repetition'),
      'exerciseDifficulty',jsonb_build_object('complexity',42,'physicalDifficulty',8,'overall',42,'formula','max','projectionVariant','standing_hands_free')),
    coaching_execution=jsonb_build_object(
      'setup',jsonb_build_array('clean dry nonslip foot-safe surface and facility hygiene setup','toes visible with approved barefoot or thin-sock policy','select standing hands-free standing wall-touch or seated bench variant','place both feet flat and identify one target foot','target heel first metatarsal head and fifth metatarsal head supported','knees and body quiet','clear station and exit'),
      'execution_steps',jsonb_build_array('lift only the target great toe while lesser toes stay long and down','lower the great toe to the same start','keep great toe and first metatarsal head down while lifting toes two through five','lower the lesser toes to the same all-toes-down start','count one target-foot repetition and record side','complete planned cycles then switch sides or stop'),
      'coach_cues',jsonb_build_array('one foot at a time','heel and toe mounds quiet','big toe up down','four toes up down','toes long','small clean range','body quiet','one full cycle one rep','count each side'),
      'athlete_cues',jsonb_build_array('big toe up and down','four toes up and down','no clawing','keep the foot quiet','go slow','stop before cramp or pain'),
      'common_faults',jsonb_build_array('non_target_toes_lift','toe_curl_or_claw','heel_or_metatarsal_head_lift','arch_collapse_or_ankle_roll','knee_hip_or_trunk_movement','missing_return_between_phases','wrong_side_or_count','manual_assistance_counted_as_unassisted','breath_holding','silent_change_to_another_variant'),
      'quality_gate',jsonb_build_array('safe surface hygiene support equipment and station','visible target toes','heel and metatarsal heads remain supported','only intended toe group lifts each phase','toes stay long','all toes return between phases','arch ankle knee and body controlled','correct side-specific count','continuous breathing','no stop symptom'),
      'stop_signs',jsonb_build_array('sharp increasing night post-trauma or unfamiliar pain','painful pinching catching toe joint irritation or persistent cramp','numbness tingling weakness altered circulation skin breakdown or loss of control','dizziness faintness nausea visual change chest pain unusual breathlessness or disorientation','target contacts toe-group separation returns or body control cannot be restored','unsafe surface hygiene wall bench visibility station or exit','participant stop request'),
      'breathing_cues',jsonb_build_array('breathe continuously','relax jaw shoulders and unnecessary leg tension'),
      'clinical_scope','This is a workout exercise, not a diagnostic toe-control test, bunion or plantar-pain treatment, fall-prevention intervention, clearance, or proof of readiness.'),
    pairing_logic=jsonb_build_object('sameSessionBudget',jsonb_build_array('valid_cycles_per_side','active_work_seconds','foot_toe_load','local_and_technical_fatigue','cramp_and_symptom_response','downstream_balance_running_landing_jumping_agility_and_lower_body_work','impact'),
      'avoidAutomaticPairingWith',jsonb_build_array('fatiguing_foot_or_calf_work_before_priority_balance_running_landing_jumping_or_agility','symptom_provoking_toe_extension','same_session_foot_toe_budget_exceeded'),
      'revalidateAfterSubstitution',TRUE),
    media_library=jsonb_build_object('candidate_video_ids',jsonb_build_array('SbQ2RYxbppE','QVZpBSVV9js','bUoTjK0tQEw','SkFZ5zVXGEo','kp8QI1Uj59Q'),
      'reviewState','oembed_metadata_only_candidate_quarantine',
      'playbackExactTargetFootSupportSequenceContactsReturnsCountCompensationCaptionsAccessibilityQualitySafetyAndApprovalVerified',FALSE,
      'humanReviewRequired',TRUE),
    participant_structure='individual',programming_kind='exercise',linked_skill_id=NULL,
    why_publish_ready=FALSE,updated_at=now()
  WHERE id=45;

  UPDATE coaching.exercise SET skill_level=NULL,age_min=NULL,age_max=NULL,is_published=FALSE,archived=TRUE,
    why_publish_ready=FALSE,linked_skill_id=NULL,
    programming_logic=jsonb_build_object('selectionStatus','duplicate_consolidated','selectable',FALSE,
      'canonicalDefinitionId',canonical_definition,'replacementVariantIds',to_jsonb(active_variant_ids),
      'duplicateResolution','same_target_foot_great_toe_then_lesser_toe_selective_extension_cycle',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),updated_at=now()
  WHERE id=524;

  UPDATE coaching.exercise_safety_profile SET risk_level=1,impact_level=0,
    minimum_age_recommended=NULL,minimum_skill_level=NULL,requires_spotting=FALSE,
    requires_coach_supervision='recommended',
    minimum_prerequisite_notes='Readiness uses a clean dry nonslip foot-safe surface, hygiene, visible toes, comfortable target-foot contact and active toe extension, exact selected standing or seated support, two-phase action and side-specific count comprehension, symptoms, communication, planned dose, and downstream foot demand; never participant classification or age.',
    readiness_checks=ARRAY[
      'Confirm exact standing hands-free, standing wall-touch, or seated bench variant, target side order, clean dry nonslip foot-safe surface, hygiene, toe visibility, equipment, space, sightline, communication, exit, and emergency route.',
      'Confirm toe, forefoot, arch, foot, ankle, calf, knee, hip, back, skin, circulation, and neurologic status do not conflict with the exact task.',
      'Confirm the participant understands target heel and metatarsal-head contacts, great-toe lift and return, lesser-toe lift and return, long toes, side-specific cycle count, stop signal, and exit.',
      'Review cumulative valid cycles by side, active time, local foot and toe load, technical fatigue, cramp response, and later balance, running, landing, jumping, agility, or lower-body demand.'
    ]::TEXT[],
    stop_signs=ARRAY[
      'Sharp, increasing, night, post-trauma, or unfamiliar pain, guarding, or participant stop request.',
      'Toe, forefoot, arch, foot, ankle, calf, knee, hip, or back symptoms prevent exact motion or support.',
      'Painful pinching, catching, instability, toe-joint irritation, skin pain, or persistent cramping.',
      'Numbness, tingling, weakness, altered circulation, skin breakdown, or another neurologic or skin sign.',
      'Dizziness, faintness, nausea, visual change, chest pain, unusual breathlessness, disorientation, or inability to communicate.',
      'The target heel or metatarsal heads lift, non-target toes leave the surface, toes curl, or the arch, ankle, knee, hip, or body compensates.',
      'The two-phase order, full returns, comfortable range, support position, breathing, or side-specific count cannot be restored after reduced range, cycles, pace, or more support.',
      'Surface traction, temperature, hygiene, toe visibility, wall, bench, space, traffic, sightline, communication, duration, budget, exit, or emergency route becomes inadequate.'
    ]::TEXT[],
    contraindications=ARRAY[
      'Current symptoms, trauma, procedure, skin breakdown, circulation or neurologic concern, toe-joint irritation, or clinical restriction conflicts with selective toe extension or ground contact.',
      'No clean dry nonslip foot-safe surface, compliant hygiene setup, adequate toe visibility, exact safe support, controlled entry and exit, sightline, communication, or emergency route.',
      'The intended service is diagnosis, treatment, injury management, readiness clearance, maximal measurement, manually assisted training, resisted work, unstable or single-leg balance, locomotion, or another identity.'
    ]::TEXT[],
    common_substitutions=ARRAY[
      'Use the wall-touch or seated exact Toe Yoga variant only after support, difficulty, equipment, logistics, duration, and workout budgets are recomputed.',
      'Use Short-Foot Drill only when changing from selective digit motion to arch shortening fits and all checks are rerun.',
      'Use Foot Tripod Weight Shifts or Big Toe Press Iso Hold only when the changed action, support, count, dose, fatigue, and purpose fit and all checks are rerun.',
      'Do not infer that simultaneous bilateral, manually assisted, resisted, isometric-hold, unstable, eyes-closed, alternating-foot, split-stance, single-leg, toe-spread, toe-curl, clinical, or sport-context versions are equivalent.'
    ]::TEXT[]
  WHERE exercise_id=45;

  UPDATE coaching.exercise_score_v1 SET technical_complexity=42,absolute_load_demand=8,
    coordination_demand=44,impact=1,supervision_demand=10,base_overall_difficulty=greatest(42,8),
    legacy_scores=coalesce(legacy_scores,'{}'::JSONB)||jsonb_build_object(
      'candidateReassessment',migration_key,'projectionScope','standing_hands_free_one_target_foot_two_phase_selective_toe_extension_cycle',
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'variantScores',jsonb_build_object(
        'standingHandsFree',jsonb_build_object('complexity',42,'physicalDifficulty',8,'overall',42),
        'standingWallTouch',jsonb_build_object('complexity',38,'physicalDifficulty',7,'overall',38),
        'seatedBench',jsonb_build_object('complexity',34,'physicalDifficulty',5,'overall',34)),
      'exerciseScoresDescribeTaskOnly',TRUE,'independentCalibrationRequired',TRUE,'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    migration_confidence=64,human_review_status='queued',reviewed_by=NULL,reviewed_at=NULL,
    review_notes='Research-informed candidate reassessment only. Scores describe exercise complexity and physical difficulty, not participant classification, age, readiness, or proficiency. Each support variant requires independent calibration and all publication authority remains quarantined.',updated_at=now()
  WHERE exercise_id=45;

  UPDATE coaching.exercise_difficulty_profile SET technical=4.2,complexity=4.0,load=1.0,overall=4.2,
    recommended_age_min=NULL,recommended_age_max=NULL,attention_demand='moderate',
    notes='Candidate projection from the exact standing hands-free target-foot two-phase cycle. Complexity is 42/100, physical difficulty 8/100, and overall 42/100 by maximum. This is not participant classification, readiness, age, or proficiency. Wall-touch and seated variants score separately.',
    source='canonical_research_candidate',updated_at=now()
  WHERE exercise_id=45;

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  VALUES(canonical_definition,1,2,'2.0.0',migration_key,'quarantined',
    jsonb_build_object(
      'identity',jsonb_build_object('passed',TRUE,'identityKey','one_target_foot_hallux_extension_return_lesser_toe_extension_return_cycle','legacySources',2,'directDuplicatesConsolidated',1,'activeVariants',3,'archivedSourceSkeletons',2,'neighborBoundaries',4),
      'taxonomy',jsonb_build_object('passed',TRUE,'controlledTerms',TRUE,'movementPatterns',jsonb_build_array('brace'),'bodyRegions',jsonb_build_array('foot','ankle','calf','knee','hip','core'),'equipment',jsonb_build_array('none','wall','bench')),
      'anatomy',jsonb_build_object('passed',TRUE,'musclesJointsActionsPlanesLateralityContactsSequenceAndIsolationBoundary',TRUE,'oneTargetFootPerRepetition',TRUE),
      'difficulty',jsonb_build_object('passed',TRUE,'model','max_exercise_complexity_physical_difficulty','variantVectors',jsonb_build_array('42/8/42','38/7/38','34/5/34'),'participantClassificationAbsent',TRUE,'independentCalibrationRequired',TRUE),
      'loadFatigueRecovery',jsonb_build_object('passed',TRUE,'actualCyclesBySideActiveWorkRangeSupportFaultSymptomsAndOverlappingFootExposureTracked',TRUE,'impactNone',TRUE,'recoveryIsPlanningEstimate',TRUE),
      'constraints',jsonb_build_object('passed',TRUE,'surfaceHygieneVisibilityWallBenchSupportSymptomsRestrictionsSpaceTrafficScopeAndEmergencyRoute',TRUE),
      'delivery',jsonb_build_object('passed',TRUE,'profiles',4,'prepareAndResilience',TRUE,'durationDoseRestSetupSideSwitchCleaningExitAndSubstitutionRevalidation',TRUE),
      'instructions',jsonb_build_object('passed',TRUE,'athleteCoachAccessibilityAndSupportOperations',TRUE,'targetSideContactsActionReturnsCountSymptomsExitAndClinicalScope',TRUE),
      'research',jsonb_build_object('passed',TRUE,'sections',16,'registryVersion',research_version,'directAndAdjacentEvidenceSeparated',TRUE,'studyDoseNotUniversal',TRUE),
      'media',jsonb_build_object('passed',FALSE,'candidateCount',5,'currentOEmbedMetadataHealthy',TRUE,'variantAssignmentPending',TRUE,'playbackReviewed',FALSE,'exactTargetFootCycleReviewed',FALSE,'captionsAccessibilityQualitySafetyAndApprovalReviewed',FALSE),
      'relationships',jsonb_build_object('passed',FALSE,'reviewOnly',8,'approved',0,'automaticSubstitution',FALSE),
      'calibration',jsonb_build_object('passed',FALSE,'reviewOnly',6,'approved',0),
      'alternates',jsonb_build_object('passed',TRUE,'assessments',28,'sameIdentity',4,'modifierAnnotations',8,'newVariants',9,'newDefinitions',7,'threeExactVariants',TRUE),
      'generationSupport',jsonb_build_object('passed',TRUE,'selectionConstraints',TRUE,'cumulativeFatigueAndImpactBudgets',TRUE,'duration',TRUE,'surfaceHygieneVisibilityWallBenchSetupSideSwitchCleaningAndExit',TRUE,'substitutionRevalidation',TRUE,'renderingAndPersistence',TRUE),
      'publication',jsonb_build_object('passed',FALSE,'reviewer',NULL,'approver',NULL)),
    jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01','message','A qualified human must watch all five candidates in full and verify playback, exact target-foot sequence, support variant, heel and metatarsal-head contacts, great-toe and lesser-toe phases, controlled returns, side-specific count, compensations, captions, accessibility, cue quality, safety, conflicts, reviewer identity, timestamp, card version, and approval rationale.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','A qualified coach must approve or reject all eight relationships; no automatic substitution among support variants, short-foot, tripod shift, hallux press, assisted, resisted, unstable, single-leg, clinical, or sport tasks is authorized.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','An independent qualified reviewer must calibrate complexity and physical-difficulty scores for all three exact support variants. Scores do not classify a participant or create an age, readiness, or proficiency level.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','A qualified reviewer and separate approver must complete content review before publication. Identity, anatomy, surface and hygiene safety, support variants, load and recovery, action and side-specific count, clinical scope, dose, stop, accessibility, persistence, and support rules remain quarantined.')),
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
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id IN(source45_variant,source524_variant) AND definition_id=canonical_definition AND status='archived'
        AND requirements_json->>'selectable'='false')<>2
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(active_variant_ids) AND definition_id=canonical_definition AND status='review'
        AND requirements_json->>'selectable'='true'
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=greatest(
          (difficulty_json->>'technicalComplexity')::INTEGER,
          (difficulty_json->>'physicalDifficulty')::INTEGER)
        AND (difficulty_json->>'impact')::INTEGER=1
        AND (load_profile_json->>'landingContactsPerRep')::INTEGER=0
        AND (fatigue_profile_json->>'impactAccumulation')::INTEGER=1
        AND (fatigue_profile_json->'cumulativeBudget'->>'impact')::INTEGER=0
        AND programming_profile_json->>'publicationQuarantined'='true')<>3 THEN
    RAISE EXCEPTION '% definition variant source or quarantine assertion failed',migration_key;
  END IF;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=standing_variant
        AND (difficulty_json->>'technicalComplexity')::INTEGER=42
        AND (difficulty_json->>'physicalDifficulty')::INTEGER=8
        AND (difficulty_json->>'coordinationDemand')::INTEGER=44
        AND (difficulty_json->>'supervisionDemand')::INTEGER=10
        AND (difficulty_json->>'failureConsequence')::INTEGER=6
        AND (difficulty_json->>'workCapacityDemand')::INTEGER=7
        AND requirements_json->'equipment'=jsonb_build_array('none'))
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=wall_variant
        AND (difficulty_json->>'technicalComplexity')::INTEGER=38
        AND (difficulty_json->>'physicalDifficulty')::INTEGER=7
        AND (difficulty_json->>'coordinationDemand')::INTEGER=40
        AND requirements_json->'equipment'=jsonb_build_array('wall'))
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=seated_variant
        AND (difficulty_json->>'technicalComplexity')::INTEGER=34
        AND (difficulty_json->>'physicalDifficulty')::INTEGER=5
        AND (difficulty_json->>'coordinationDemand')::INTEGER=36
        AND requirements_json->'equipment'=jsonb_build_array('bench')) THEN
    RAISE EXCEPTION '% task-only variant score or equipment assertion failed',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=ANY(active_variant_ids) AND status='review'
        AND coalesce(time_model_json->>'durationFormula','')<>'' AND dose_scaling_json<>'{}'::JSONB
        AND measurement_json<>'{}'::JSONB AND support_prompts_json<>'{}'::JSONB
        AND length(coach_instructions)>=100 AND length(athlete_instructions) BETWEEN 10 AND 360
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
      WHERE survivor_definition_id=canonical_definition AND decision='distinct_exercises' AND reviewed_by IS NULL)<>4
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=canonical_definition AND resolved_definition_id=duplicate_definition
        AND decision='duplicate_consolidated' AND reviewed_by IS NULL)<>1 THEN
    RAISE EXCEPTION '% authored row-count or quarantine assertion failed',migration_key;
  END IF;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=duplicate_definition AND status='archived'
        AND provenance_json->>'identityStatus'='duplicate_consolidated_into_toe_yoga')
    OR (SELECT count(*) FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id IN(45,524) AND definition_id=canonical_definition)<>2
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=524 AND definition_id=canonical_definition AND source_kind='duplicate_consolidation')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise
      WHERE id=524 AND archived AND NOT is_published AND skill_level IS NULL
        AND age_min IS NULL AND age_max IS NULL AND linked_skill_id IS NULL) THEN
    RAISE EXCEPTION '% duplicate consolidation or legacy quarantine assertion failed',migration_key;
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

  IF EXISTS(SELECT 1 FROM coaching.exercise WHERE id=45
      AND (skill_level IS NOT NULL OR age_min IS NOT NULL OR age_max IS NOT NULL OR linked_skill_id IS NOT NULL OR is_published OR why_publish_ready))
    OR EXISTS(SELECT 1 FROM coaching.exercise_safety_profile WHERE exercise_id=45
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
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=45
      AND programming_logic->>'exerciseDifficultyDescribesTaskOnly'='true'
      AND movement_requirements->'exerciseDifficulty'->>'overall'='42'
      AND media_library->>'reviewState'='oembed_metadata_only_candidate_quarantine'
      AND participant_structure='individual' AND programming_kind='exercise'
      AND linked_skill_id IS NULL AND NOT is_published AND NOT archived) THEN
    RAISE EXCEPTION '% test packet legacy projection or task-only difficulty assertion failed',migration_key;
  END IF;
END
$migration$;
