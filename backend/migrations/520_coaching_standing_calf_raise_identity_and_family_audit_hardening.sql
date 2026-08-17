-- Source 44: consolidate the direct standing-calf-raise collisions and replace
-- the skeletal cards with one exact supported bilateral flat-floor cycle.
-- Existing unilateral, loaded, top-hold, and eccentric-only source variants
-- remain archived and traceable until their exact contracts are reauthored.
-- Evidence, media, graph, calibration, content, and publication authority stay
-- human-only. Difficulty describes the exercise task, never participant level.
DO $migration$
DECLARE
  migration_key CONSTANT TEXT := '520_coaching_standing_calf_raise_identity_and_family_audit_hardening';
  research_version CONSTANT TEXT := '2026-08-09.111';
  canonical_definition UUID; source44_definition UUID; eccentric_definition UUID; iso_definition UUID;
  source44_variant UUID; source1150_variant UUID; source431_variant UUID; source263_variant UUID; source525_variant UUID; source577_variant UUID; source762_variant UUID; source841_variant UUID; source1104_variant UUID; exact_variant UUID;
  active_variant_ids UUID[]; all_owned_variant_ids UUID[]; bent_knee_definition UUID; bent_knee_variant UUID; wall_hold_definition UUID; wall_hold_variant UUID; ankle_pogo_definition UUID; ankle_pogo_variant UUID; walking_combo_definition UUID; walking_combo_variant UUID; short_foot_combo_definition UUID; tibialis_definition UUID;
  protected_count INTEGER;
BEGIN
  SELECT id INTO canonical_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=1150; SELECT id INTO source44_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=44; SELECT id INTO eccentric_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=762; SELECT id INTO iso_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=841;
  SELECT id INTO source44_variant FROM coaching.exercise_variant_v1 WHERE definition_id=source44_definition AND variant_key='baseline'; SELECT id INTO source1150_variant FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='baseline'; SELECT id INTO source263_variant FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='legacy-source-263-baseline'; SELECT id INTO source431_variant FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='legacy-source-431-baseline'; SELECT id INTO source525_variant FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='legacy-source-525-baseline'; SELECT id INTO source577_variant FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='legacy-source-577-baseline'; SELECT id INTO source762_variant FROM coaching.exercise_variant_v1 WHERE definition_id=eccentric_definition AND variant_key='baseline'; SELECT id INTO source841_variant FROM coaching.exercise_variant_v1 WHERE definition_id=iso_definition AND variant_key='baseline'; SELECT id INTO source1104_variant FROM coaching.exercise_variant_v1 WHERE definition_id=iso_definition AND variant_key='legacy-source-1104-baseline';
  SELECT coalesce((SELECT id FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_definition AND variant_key='wall-supported-bilateral-flat-floor-full-cycle'),gen_random_uuid()) INTO exact_variant;
  SELECT id INTO bent_knee_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=578; SELECT id INTO bent_knee_variant FROM coaching.exercise_variant_v1 WHERE definition_id=bent_knee_definition AND variant_key='bilateral-seated-bodyweight-floor'; SELECT id INTO wall_hold_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=1686; SELECT id INTO wall_hold_variant FROM coaching.exercise_variant_v1 WHERE definition_id=wall_hold_definition AND variant_key='baseline'; SELECT id INTO ankle_pogo_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=974; SELECT id INTO ankle_pogo_variant FROM coaching.exercise_variant_v1 WHERE definition_id=ankle_pogo_definition AND variant_key='baseline'; SELECT id INTO walking_combo_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=870; SELECT id INTO walking_combo_variant FROM coaching.exercise_variant_v1 WHERE definition_id=walking_combo_definition AND variant_key='baseline'; SELECT id INTO short_foot_combo_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=877; SELECT id INTO tibialis_definition FROM coaching.exercise_definition_v1 WHERE facility_id=1 AND legacy_exercise_id=43;
  active_variant_ids:=ARRAY[exact_variant]; all_owned_variant_ids:=ARRAY[source44_variant,source1150_variant,source431_variant,source263_variant,source525_variant,source577_variant,source762_variant,source841_variant,source1104_variant,exact_variant];
  IF NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=44 AND facility_id=1)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id IN(263,431,525,577,762,841,1104,1150) AND facility_id=1 GROUP BY facility_id HAVING count(*)=8)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 WHERE id=canonical_definition AND facility_id=1 AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 WHERE id=source44_definition AND facility_id=1 AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 WHERE id=eccentric_definition AND facility_id=1 AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 WHERE id=iso_definition AND facility_id=1 AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id=source44_variant AND definition_id=source44_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id=source1150_variant AND definition_id=canonical_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id=source762_variant AND definition_id=eccentric_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id IN(source841_variant,source1104_variant) AND definition_id=iso_definition)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id=bent_knee_variant AND definition_id=bent_knee_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id=wall_hold_variant AND definition_id=wall_hold_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id=ankle_pogo_variant AND definition_id=ankle_pogo_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id=walking_combo_variant AND definition_id=walking_combo_definition AND status='review')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1 WHERE exercise_id=44)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_difficulty_profile WHERE exercise_id=44)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_safety_profile WHERE exercise_id=44) THEN
    RAISE EXCEPTION '% prerequisite source or neighbor rows are missing',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 WHERE id=exact_variant AND definition_id<>canonical_definition)
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 WHERE slug='standing-calf-raise' AND id<>canonical_definition) THEN
    RAISE EXCEPTION '% working UUID or slug already belongs to another card',migration_key;
  END IF;

  SELECT coalesce(sum(n),0) INTO protected_count FROM (
    SELECT count(*) n FROM coaching.exercise_definition_v1
      WHERE id IN(canonical_definition,source44_definition,eccentric_definition,iso_definition)
        AND (status IN('published','deprecated') OR reviewed_by IS NOT NULL OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)
    UNION ALL SELECT count(*) FROM coaching.exercise_section_evidence_v1
      WHERE definition_id IN(canonical_definition,source44_definition,eccentric_definition,iso_definition)
        AND (reviewer_user_id IS NOT NULL OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id IN(canonical_definition,source44_definition,eccentric_definition,iso_definition)
        AND (reviewer_user_id IS NOT NULL OR reviewed_at IS NOT NULL OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id IN(canonical_definition,source44_definition,eccentric_definition,iso_definition)
        AND (reviewer_user_id IS NOT NULL OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_card_review_v1
      WHERE definition_id IN(canonical_definition,source44_definition,eccentric_definition,iso_definition)
    UNION ALL SELECT count(*) FROM coaching.exercise_card_revision_v1
      WHERE definition_id IN(canonical_definition,source44_definition,eccentric_definition,iso_definition)
    UNION ALL SELECT count(*) FROM coaching.exercise_media_review_v1
      WHERE definition_id IN(canonical_definition,source44_definition,eccentric_definition,iso_definition)
    UNION ALL SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=ANY(all_owned_variant_ids) OR to_variant_id=ANY(all_owned_variant_ids))
        AND (reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL OR review_status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(all_owned_variant_ids) AND (reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL OR status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE (survivor_definition_id IN(canonical_definition,source44_definition,eccentric_definition,iso_definition)
          OR resolved_definition_id IN(canonical_definition,source44_definition,eccentric_definition,iso_definition))
        AND (reviewed_by IS NOT NULL OR resolution_source='human_review')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_v1
      WHERE exercise_id=44 AND (human_review_status<>'queued' OR reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL)
  ) protected;
  IF protected_count<>0 THEN
    RAISE EXCEPTION '% refuses to overwrite % human-reviewed records',migration_key,protected_count;
  END IF;

  UPDATE coaching.exercise_section_evidence_v1
  SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now()
  WHERE definition_id=canonical_definition AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_media_candidate_v1
  SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
    exact_variant_match=NULL,demonstration_quality_score=NULL,updated_at=now()
  WHERE definition_id=canonical_definition AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_alternate_assessment_v1
  SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now()
  WHERE definition_id=canonical_definition AND review_status='candidate' AND reviewer_user_id IS NULL;
  DELETE FROM coaching.exercise_relationship_v1
  WHERE (from_variant_id=ANY(all_owned_variant_ids) OR to_variant_id=ANY(all_owned_variant_ids))
    AND reviewed_by IS NULL AND review_status<>'approved';
  DELETE FROM coaching.exercise_score_calibration_v1
  WHERE variant_id=ANY(all_owned_variant_ids) AND reviewed_by IS NULL AND status<>'approved';

  UPDATE coaching.exercise_definition_source_v1
  SET definition_id=canonical_definition,source_kind='duplicate_consolidation',
    provenance_json=jsonb_build_object(
      'source_table','coaching.exercise','migration',migration_key,'researchVersion',research_version,
      'resolution','same_standing_calf_raise_family_with_explicit_variant_dimensions',
      'survivorDefinitionId',canonical_definition,
      'variantDimensions',jsonb_build_array('support','laterality','surface_height','knee_angle','contraction_mode','return_strategy','implement','external_load','range','tempo','pause','rest','dose'),
      'representedBySelectableSourceVariant',legacy_exercise_id=44,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE definition_id IN(source44_definition,eccentric_definition,iso_definition);

  UPDATE coaching.exercise_definition_source_v1
  SET source_kind=CASE WHEN legacy_exercise_id=44 THEN 'duplicate_consolidation' ELSE source_kind END,
    provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'survivorDefinitionId',canonical_definition,'familyAuditStatus','reaudited',
      'representedBySelectableSourceVariant',legacy_exercise_id=44,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE definition_id=canonical_definition;

  UPDATE coaching.exercise_delivery_profile_v1
  SET status='archived',updated_at=now()
  WHERE variant_id=ANY(all_owned_variant_ids) AND variant_id<>exact_variant;

  UPDATE coaching.exercise_variant_v1
  SET definition_id=canonical_definition,
    variant_key=CASE id
      WHEN source44_variant THEN 'superseded-source-44-skeleton'
      WHEN source1150_variant THEN 'identity-quarantine-source-1150'
      WHEN source762_variant THEN 'identity-quarantine-source-762-eccentric'
      WHEN source841_variant THEN 'identity-quarantine-source-841-isometric'
      WHEN source1104_variant THEN 'identity-quarantine-source-1104-isometric'
      ELSE variant_key END,
    display_name=CASE id
      WHEN source44_variant THEN 'Standing Calf Raise Legacy Skeleton — Source 44'
      WHEN source1150_variant THEN 'Standing Calf Raise Ambiguous Contract — Source 1150'
      WHEN source762_variant THEN 'Standing Calf Raise Eccentric Contract — Source 762'
      WHEN source841_variant THEN 'Standing Calf Raise Isometric Contract — Source 841'
      WHEN source1104_variant THEN 'Standing Calf Raise Isometric Ambiguous Contract — Source 1104'
      ELSE display_name END,
    modifier_keys='{}'::TEXT[],difficulty_json='{}'::JSONB,status='archived',
    requirements_json=coalesce(requirements_json,'{}'::JSONB)||jsonb_build_object(
      'selectable',FALSE,'representation','archived_family_source_contract',
      'replacementVariantIds',to_jsonb(active_variant_ids),
      'archiveReason','The prior row is skeletal, ambiguous, or belongs to a later exact variant reauthoring queue; it is not selectable as the Source 44 supported bilateral flat-floor cycle.',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    load_profile_json=jsonb_build_object('selectable',FALSE),
    fatigue_profile_json=jsonb_build_object('selectable',FALSE),
    programming_profile_json=jsonb_build_object(
      'selectionStatus','archived_family_source_contract','selectable',FALSE,
      'publicationQuarantined',TRUE,'humanReviewRequired',TRUE),
    updated_at=now()
  WHERE id IN(source44_variant,source1150_variant,source762_variant,source841_variant,source1104_variant);

  UPDATE coaching.exercise_definition_v1
  SET status='archived',legacy_exercise_id=NULL,approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,last_reviewed_at=NULL,
    slug=CASE id
      WHEN source44_definition THEN 'calf-raise-to-controlled-heel-drop-duplicate-source-44'
      WHEN eccentric_definition THEN 'standing-calf-raise-eccentric-lower-variant-source-762'
      ELSE 'standing-calf-raise-iso-hold-variant-sources-841-1104' END,
    provenance_json=coalesce(provenance_json,'{}'::JSONB)||jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'identityStatus','duplicate_consolidated_into_standing_calf_raise',
      'survivorDefinitionId',canonical_definition,'selectable',FALSE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    updated_at=now()
  WHERE id IN(source44_definition,eccentric_definition,iso_definition);

  INSERT INTO coaching.exercise_definition_v1(
    id,facility_id,legacy_exercise_id,slug,canonical_name,display_name,aliases,description,family_key,
    schema_version,card_version,status,content_confidence,scoring_confidence,media_confidence,
    movement_patterns,body_regions,required_equipment,optional_equipment,environment_json,population_json,
    provenance_json,approved_video_url,reviewed_by,approved_by,last_reviewed_at,anatomy_json,
    athlete_support_json,coach_support_json,support_operations_json)
  VALUES(
    canonical_definition,1,44,'standing-calf-raise','Standing Calf Raise','Standing Calf Raise',
    ARRAY[
      'Calf Raise to Controlled Heel Drop','Calf Raise to Controlled Heel Drops',
      'Double-Leg Calf Raise','Double Leg Calf Raise','Bilateral Calf Raise',
      'Supported Standing Calf Raise','Wall-Supported Calf Raise','Standing Calf Raises',
      'Calf Isometric Hold — Straight-Knee','Calf Raise ISO with Single-Leg Hold',
      'Single-Leg Calf Raise','Standing Dumbbell Calf Raise','Standing Calf Raise Eccentric Lower',
      'Standing Calf Raise Iso Hold','Standing Calf Raise Isometric Hold'
    ]::TEXT[],
    'Stand facing a stable wall with both hands in light continuous contact, feet about hip-width on a dry level nonslip floor, the full feet planted, and both knees mostly straight without forced locking. Keeping the wall contact, knee position, foot angle, and body line controlled, press through both forefeet to lift both heels together through comfortable ankle plantarflexion. Reach a brief untimed top checkpoint, then lower both heels under control to the same full-foot floor contact. One complete bilateral lift-and-controlled-return cycle is one repetition. Stance width, small foot-angle changes, comfortable range, tempo, a brief untimed top checkpoint, breathing, repetitions, sets, rest, effort, footwear, and delivery context are annotations. Step range, unilateral or alternating action, unsupported balance, bent-knee delivery, external load, sustained isometric hold, assisted-return eccentric-only work, elastic bouncing, locomotion, compound actions, clinical testing, or sport actions require a separately reviewed variant or definition.',
    'standing_ankle_plantarflexion_raise','2.0.0',2,'review',90,62,50,
    ARRAY['brace']::TEXT[],ARRAY['foot','ankle','calf','knee','hip','core']::TEXT[],
    ARRAY['wall']::TEXT[],ARRAY['none']::TEXT[],
    jsonb_build_object(
      'surface','dry clean level stable nonslip floor beside a structurally sound unobstructed wall',
      'space','one wall station with clear foot placement entry exit and no cross traffic',
      'stationCapacity',1,'equipmentKey','wall','optionalEquipment',jsonb_build_array('none'),
      'coachSightline','side and front-quarter views of hands knees ankles heels forefeet body line breathing and symptoms',
      'inspection',jsonb_build_array('wall stability cleanliness protrusions and usable hand area','floor traction level cleanliness and debris','footwear traction heel geometry and forefoot flexibility','station separation and cross traffic','entry exit communication and emergency route'),
      'changeRule','Any support laterality surface height knee angle contraction mode return strategy implement load range dose symptom or downstream-demand change requires full revalidation.'),
    jsonb_build_object(
      'exerciseCardDoesNotClassifyParticipants',TRUE,'readinessIsWorkoutInput',TRUE,
      'selectionPrerequisites',jsonb_build_array('safe wall approach setup and exit','stable inspected wall and nonslip level floor','comfortable bilateral forefoot pressure and mostly-straight-knee stance','comfortable active plantarflexion and controlled return','can keep wall hand contact and bilateral timing without bouncing','understands complete lift-and-return count and stop signal','same-session calf Achilles foot ankle running landing jumping cutting and lower-body budgets fit'),
      'excludeOrEscalate',jsonb_build_array('recent significant trauma surgery or procedure without applicable clearance','worsening night post-trauma sharp increasing or unfamiliar pain','new numbness tingling weakness altered circulation or loss of control','foot ankle Achilles calf shin knee hip or back symptoms preventing the exact task','dizziness faintness nausea visual change chest pain unusual breathlessness disorientation or inability to communicate','clinical restriction conflicting with supported plantarflexion loading','unsafe wall floor footwear space traffic sightline or emergency route','participant requests stop'),
      'notEstablishedByEvidence',jsonb_build_array('universal eligibility stance foot angle range tempo dose frequency fatigue ceiling recovery progression or outcome','diagnosis treatment prevention correction readiness clearance or clinical threshold','isolated gastrocnemius or soleus loading','guaranteed walking running jumping landing or injury-prevention transfer','age floor or participant classification')),
    jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,'canonicalAuthoredFromResearch',TRUE,
      'identityAuthority','Source 44 current supported bilateral contract bounded by direct heel-raise research and the consolidated standing-calf-raise family',
      'legacySources',jsonb_build_array(44,263,431,525,577,762,841,1104,1150),
      'selectableLegacySource',44,
      'identityContract','wall_supported_bilateral_flat_floor_heel_raise_brief_top_checkpoint_and_controlled_return_cycle',
      'researchSources',jsonb_build_array(
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC4483433/',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC8070905/',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC4738962/',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC5343533/',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC10753835/',
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/',
        'https://www.nsca.com/contentassets/811e78926c9747f48402ed95d28f26cf/ptq-8.4.3-how-to-improve-ankle-dorsiflexion-and-calf-strength-for-better-performance.pdf',
        'https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf',
        'https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en'),
      'confidenceBySection',jsonb_build_object('identity',90,'taxonomy',88,'anatomy',88,'difficulty',62,'load',84,'fatigueRecovery',56,'constraints',84,'dosage',60,'instructions',90,'alternates',94,'media',50),
      'unresolvedClaims',jsonb_build_array('one universal stance foot angle range tempo dose frequency fatigue ceiling recovery progression or outcome','numeric difficulty calibration','exact laterality support surface load and contraction facts for non-Source-44 family rows','media playback exact mechanics captions accessibility quality safety and approval','individual symptom interpretation or clinical eligibility'),
      'externalPlaybackVerificationPerformed',FALSE,'oEmbedMetadataChecked',TRUE,'sourceLimitationsExplicit',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,'publicationQuarantined',TRUE),
    NULL,NULL,NULL,NULL,
    jsonb_build_object(
      'primaryMuscles',jsonb_build_array('gastrocnemius_medial_head','gastrocnemius_lateral_head','soleus'),
      'secondaryMuscles',jsonb_build_array('plantaris_when_present','fibularis_longus','fibularis_brevis','tibialis_posterior','flexor_hallucis_longus','flexor_digitorum_longus','intrinsic_foot_muscles'),
      'stabilizers',jsonb_build_array('tibialis_anterior','quadriceps','hamstrings','gluteal_and_hip_stabilizers','trunk_stabilizers','forearm_and_shoulder_stabilizers_for_light_wall_contact'),
      'joints',jsonb_build_array('metatarsophalangeal','midfoot','subtalar','talocrural_ankle','distal_tibiofibular_complex','knee','hip','lumbopelvic_complex','shoulder_elbow_and_wrist_for_wall_support'),
      'jointActions',jsonb_build_array('bilateral_ankle_plantarflexion_during_rise','controlled_ankle_dorsiflexion_relative_return_via_eccentric_plantarflexor_action','metatarsophalangeal_extension_under_forefoot_support','foot_frontal_and_transverse_plane_stabilization','mostly_straight_knee_position_hold','hip_trunk_and_upper_limb_isometric_stabilization'),
      'planes',jsonb_build_array('sagittal','frontal_stabilization','transverse_stabilization'),
      'laterality','bilateral simultaneous ankle action',
      'supportContacts',jsonb_build_array('left_and_right_hands_on_wall','left_and_right_full_feet_on_floor_at_start_and_finish','left_and_right_forefeet_on_floor_throughout','heels_clear_floor_during_rise'),
      'sequence',jsonb_build_array('supported_full_foot_start','simultaneous_bilateral_heel_rise','comfortable_plantarflexion_endpoint','brief_untimed_top_checkpoint','controlled_bilateral_lower','same_full_foot_floor_contact_one_repetition'),
      'claimsBoundary','The task loads the triceps surae and other plantarflexors and foot stabilizers while moving body mass. It does not isolate one muscle, diagnose calf or Achilles function, or prove treatment, prevention, readiness, walking, running, jumping, or injury outcomes.'),
    jsonb_build_object(
      'whyItMatters','Builds controlled bilateral ankle-plantarflexion capacity with stable wall support and no impact.',
      'primaryCue','Press through both forefeet, rise together, then lower both heels quietly to the same start.',
      'secondaryCues',jsonb_build_array('hands stay light on the wall','knees stay mostly straight','keep even pressure across each forefoot','reach a brief tall checkpoint','lower without bouncing','stop before height or control changes'),
      'expectedSensations',jsonb_build_array('local effort in both calves','pressure through both forefeet','steady wall contact and normal breathing'),
      'unexpectedSensations',jsonb_build_array('sharp increasing or unfamiliar pain','painful Achilles ankle heel or forefoot pinching','cramping that changes gait or does not ease','numbness tingling weakness altered circulation or loss of control','dizziness faintness nausea visual change chest pain or unusual breathlessness'),
      'painGuidance','Stop immediately for sharp, increasing, radiating, neurologic, circulatory, joint, Achilles, or heel pain and tell the coach. Local calf effort is acceptable only while height, alignment, controlled return, breathing, and normal recovery remain.',
      'selfChecks',jsonb_build_array('wall_hand_contact_stays_light_and_fixed','knees_do_not_pump','both_heels_rise_together','forefoot_pressure_stays_even','height_stays_comfortable','top_checkpoint_is_brief','return_is_quiet_and_controlled','one_full_cycle_counted','breathing_continues'),
      'accessibility',jsonb_build_object('reducedRange','use a smaller comfortable heel rise','reducedCapacity','use fewer repetitions and more rest','hearingSupport','use a visible start stop and repetition count','visionSupport','use clear verbal wall forefoot rise and quiet-return cues','cognitiveSupport','use one cue and a three-repetition rehearsal','changedSupport','select a separately validated seated or more-supported task'),
      'readingLevel','plain_language','localizationKey','exercise.wall_supported_bilateral_standing_calf_raise',
      'mediaAlternatives',jsonb_build_object('captionsRequired',TRUE,'transcriptRequired',TRUE,'stillSequenceRequired',TRUE,'audioDescriptionRequired',TRUE,'requiredAngles',jsonb_build_array('side','front_oblique'))),
    jsonb_build_object(
      'observationChecklist',jsonb_build_array('wall floor footwear and station are safe','hands retain light wall contact','knees remain mostly straight without forced locking','both heels rise together through comfortable height','forefoot pressure and ankle alignment remain controlled','top checkpoint is brief and return is controlled to full-foot contact','breathing symptoms first fault actual repetitions and duration are recorded'),
      'faultCorrections',jsonb_build_array(
        jsonb_build_object('fault','ankles_roll_out_or_big_toe_pressure_lost','action','reduce height restore even forefoot pressure and retry'),
        jsonb_build_object('fault','knees_or_hips_pump','action','reduce repetitions and restore quiet body line'),
        jsonb_build_object('fault','heels_rise_asynchronously','action','reduce range and cue even bilateral pressure'),
        jsonb_build_object('fault','bounce_or_uncontrolled_drop','action','slow the return reduce range or end the set'),
        jsonb_build_object('fault','symptom_or_loss_of_control','action','stop and follow facility escalation policy')),
      'demonstrationPlan',jsonb_build_object('angles',jsonb_build_array('side','front_oblique'),'showCorrectReps',3,'showCommonFaults',jsonb_build_array('ankle_roll','knee_pump','bounce'),'comprehensionCheck','Ask the athlete to show the full-foot start, explain when one repetition ends, and state the stop signal.'),
      'groupManagement',jsonb_build_object('format','individual_wall_stations_or_observed_pairs','athletesPerStation',1,'coachSightLine','side and front-quarter view of hands knees ankles heels and forefeet','queueRule','next athlete waits outside the wall station','equipmentSharing','inspect and reset wall and floor area between users'),
      'modificationDecisionTree',jsonb_build_array(jsonb_build_object('when','pain_neurologic_circulatory_or_systemic_symptom','action','stop_and_escalate'),jsonb_build_object('when','height_alignment_timing_or_return_control_fails','action','reduce_range_or_repetitions_then_reassess'),jsonb_build_object('when','clean_below_target_effort','action','progress_repetitions_or_sets_within_profile_next_set'),jsonb_build_object('when','support_surface_height_laterality_knee_angle_load_or_contraction_mode_must_change','action','select_separately_validated_variant_and_recompute_workout')),
      'doNotUseWhen',jsonb_build_array('wall floor footwear or station is unsafe','exact supported bilateral flat-floor task is not tolerated or understood','current foot ankle Achilles calf shin knee hip or back symptoms conflict','local fatigue would compromise later priority running landing jumping cutting or lower-body work','the intended service is diagnosis treatment or maximal testing'),
      'scopeBoundary','Coach observable setup action count exposure and stop rules; do not diagnose calf, Achilles, foot, ankle, circulation, or neurologic problems, prescribe rehabilitation, promise prevention, infer clearance, or force range.'),
    jsonb_build_object(
      'issueCategories',jsonb_build_array('unsafe','unclear_instruction','inaccurate','duplicate','inaccessible','broken_media','symptom_report','equipment_or_environment'),
      'supportEscalation',jsonb_build_object('safety','stop remove from selection follow facility emergency and incident policy','brokenMedia','quarantine candidate and schedule qualified re-review','identity','route non-Source-44 family contracts to qualified variant review','contentQuestion','route to coaching content queue','clinicalQuestion','refer through facility clinical escalation policy'),
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
    exact_variant,canonical_definition,'wall-supported-bilateral-flat-floor-full-cycle',
    'Wall-Supported Bilateral Flat-Floor Standing Calf Raise',
    ARRAY['stance_width','foot_angle','active_range','tempo','brief_top_checkpoint','breathing','repetitions','sets','rest','effort','footwear','delivery_context']::TEXT[],
    jsonb_build_object('technicalComplexity',22,'absoluteLoadDemand',32,'physicalDifficulty',32,'coordinationDemand',20,
      'supervisionDemand',12,'failureConsequence',10,'impact',1,'workCapacityDemand',30,
      'baseOverallDifficulty',greatest(22,32),'overallFormula','max(exercise_complexity,physical_difficulty)',
      'exerciseDifficultyDescribesTaskOnly',TRUE,'candidateCalibrationOnly',TRUE,'humanReviewRequired',TRUE),
    jsonb_build_object('selectable',TRUE,'equipment',jsonb_build_array('wall'),
      'base','standing_facing_wall_bilateral_hands_supported_both_full_feet_on_flat_floor',
      'supportContacts',jsonb_build_array('left_and_right_hands_on_wall','left_and_right_forefeet_on_floor_throughout','left_and_right_full_feet_at_start_and_finish'),
      'start','feet about hip-width full feet planted knees mostly straight without forced locking tall body line and both hands lightly contacting stable wall',
      'action','press through both forefeet and actively plantarflex both ankles to lift both heels together through comfortable repeatable height',
      'top','brief untimed tall checkpoint without converting the repetition to a prescribed isometric hold',
      'return','lower both heels together under control to the same full-foot floor contact without bounce or drop',
      'countingRule','one simultaneous bilateral heel lift brief untimed checkpoint and controlled return to the same full-foot floor contact is one repetition',
      'validCompletion','hand support foot angle knee position and body line remain controlled both heels rise together through comfortable height and return quietly breathing continues and no stop rule occurs',
      'invalidCompletion',jsonb_build_array('wall_hand_contact_lost_or_used_to_pull','forefoot_slides_or_pressure_rolls_out','knee_or_hip_pumping','heel_timing_asymmetry','bounce_uncontrolled_drop_or_incomplete_return','step_unilateral_alternating_unsupported_bent_knee_loaded_hold_eccentric_only_elastic_locomotor_compound_clinical_or_sport_task','breath_hold','symptom_stop'),
      'variantBoundaries',jsonb_build_array('support','laterality','surface_height','knee_angle','contraction_mode','return_strategy','implement','external_load','elastic_intent','compound_action','clinical_measurement','sport_action','count'),
      'clinicalAssessmentOrTreatment',FALSE,'humanReviewRequired',TRUE),
    'review',
    jsonb_build_object('loadingType','bodyweight_bilateral_supported_ankle_plantarflexion_cycle',
      'externalLoadMethod','bodyweight shared bilaterally with light wall balance support and no added resistance',
      'gripDemand',1,'jointStress',26,'spinalLoading',4,'eccentricStress',30,
      'landingContactsPerRep',0,'handImpactContactsPerRep',0,'impactClass','none',
      'primaryExposure',jsonb_build_array('bilateral_ankle_plantarflexion','controlled_eccentric_plantarflexor_lowering','forefoot_pressure','calf_and_Achilles_loading','foot_ankle_alignment','wall_supported_body_line'),
      'tracking',jsonb_build_array('variant_and_profile','wall_floor_footwear_and_station','stance_foot_angle_knee_position_and_support','planned_and_actual_valid_repetitions','height_tempo_checkpoint_effort_and_rest','valid_invalid_partial_and_symptom_limited_attempts','forefoot_ankle_knee_hip_timing_and_return_faults','first_fault','symptoms','duration','same_session_calf_Achilles_foot_ankle_running_landing_jumping_cutting_and_lower_body_exposure')),
    jsonb_build_object('localMuscleFatigue',40,'gripFatigue',1,'technicalFatigueSensitivity',22,'impactAccumulation',1,
      'recoveryHours',24,'recoveryRangeHours',jsonb_build_array(12,36),
      'primaryFatigueSites',jsonb_build_array('gastrocnemius','soleus','Achilles_tendon_loading_system','foot_and_ankle_stabilizers'),
      'cumulativeBudget',jsonb_build_object('validRepetitions',80,'activeWorkSeconds',480,'calfAchillesLoad',44,'lowerLegExposure',40,'technicalSensitivity',22,'impact',0),
      'interference',jsonb_build_array('later_priority_running_landing_jumping_cutting_or_lower_body_work','same_session_calf_Achilles_foot_ankle_or_lower_leg_loading','fatigue_that_changes_height_forefoot_pressure_bilateral_timing_or_controlled_return'),
      'recoveryIsPlanningEstimate',TRUE,'tissueThresholdNotEstablished',TRUE),
    jsonb_build_object('trainingStimuli',jsonb_build_array('supported_bilateral_plantarflexor_loading','full_foot_to_forefoot_support_transition','controlled_heel_return'),
      'stimulusDose',jsonb_build_object('sets',jsonb_build_array(1,4),'repetitions',jsonb_build_array(6,15),'secondsPerRep',jsonb_build_array(3,7),'restSeconds',jsonb_build_array(20,120)),
      'weeklyExposure',jsonb_build_object('minimum',0,'maximumWithoutReview',4,'unit','sessions','contextDependent',TRUE),
      'prerequisites',jsonb_build_array('safe_wall_approach_setup_and_exit','stable_inspected_wall_nonslip_floor_and_traction','comfortable_bilateral_forefoot_pressure_and_mostly_straight_knees','comfortable_active_plantarflexion_and_controlled_return','understands_complete_cycle_count_and_stop','same_session_lower_leg_and_priority_work_budgets_fit'),
      'completionCriteria',jsonb_build_array('hands_light_on_wall','forefeet_stable','knees_mostly_straight_without_forced_lock','heels_rise_together','comfortable_repeatable_height','brief_untimed_top_checkpoint','controlled_quiet_full_foot_return','correct_count','continuous_breathing','no_stop_symptom'),
      'sequenceRules',jsonb_build_array('prepare_or_capacity_context_only','count_each_complete_bilateral_lift_and_return','do_not_turn_stance_angle_range_tempo_brief_checkpoint_breathing_dose_footwear_or_context_into_hidden_variants','do_not_add_step_range_unilateral_alternating_unsupported_bent_knee_load_hold_eccentric_only_elastic_locomotor_compound_assessment_or_sport_action_silently','revalidate_downstream_running_landing_jumping_cutting_and_lower_body_load'),
      'pairingCompatibility',jsonb_build_object('compatible',jsonb_build_array('low_dose_lower_leg_preparation','separate_capacity_accessory_when_recovery_fits'),'avoid',jsonb_build_array('fatiguing_dose_before_priority_running_landing_jumping_or_cutting','symptom_provoking_plantarflexion','same_session_lower_leg_budget_exceeded')),
      'interferenceRules',jsonb_build_array('count_all_overlapping_calf_Achilles_foot_ankle_running_landing_jumping_cutting_and_lower_body_work','stop_before_height_alignment_timing_or_return_control_changes'),
      'uncertaintyPolicy','When exact support laterality surface knee angle contraction mode count symptoms wall safety or available time is uncertain do not select; request clarification or choose a separately validated card.',
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
    jsonb_build_object('plantarflexor_capacity',CASE WHEN p.phase_key='capacity' THEN 94 ELSE 76 END,
      'lower_leg_preparation',CASE WHEN p.phase_key='prepare_and_access' THEN 94 ELSE 74 END,
      'bilateral_control',90,'low_impact',98),
    CASE WHEN p.phase_key='capacity' THEN
      jsonb_build_object('sets',jsonb_build_array(2,4),'repetitions',jsonb_build_array(8,15),'secondsPerRep',jsonb_build_array(3,7),'restSeconds',jsonb_build_array(60,120),'targetEffortRpe',jsonb_build_array(5,8),'exampleDoseIsNotUniversal',TRUE)
    ELSE
      jsonb_build_object('sets',jsonb_build_array(1,2),'repetitions',jsonb_build_array(6,10),'secondsPerRep',jsonb_build_array(3,6),'restSeconds',jsonb_build_array(20,45),'targetEffortRpe',jsonb_build_array(2,4),'exampleDoseIsNotUniversal',TRUE)
    END,
    'Both hands stay in light wall contact; forefeet remain stable; knees stay mostly straight without forced locking; both heels rise together through comfortable repeatable height, reach a brief untimed checkpoint, and return quietly to the same full-foot start; breathing continues; and no stop rule occurs.',
    ARRAY[
      'Sharp, increasing, night, post-trauma, or unfamiliar pain or participant stop request.',
      'Foot, ankle, Achilles, calf, shin, knee, hip, or back symptoms prevent the exact task.',
      'Painful pinching, catching, instability, giving way, uncontrolled cramping, or loss of foot control.',
      'Numbness, tingling, weakness, altered circulation, or another neurologic sign.',
      'Dizziness, faintness, nausea, visual change, chest pain, unusual breathlessness, disorientation, or inability to communicate.',
      'Wall contact is lost or used to pull, forefeet slide, ankles roll, or knees or hips pump to create height.',
      'Heels do not rise together, height materially falls, or the return becomes bouncing, incomplete, or uncontrolled.',
      'A step, unilateral, alternating, unsupported, bent-knee, loaded, isometric-only, eccentric-only, elastic, locomotor, compound, clinical, or sport task cannot be corrected safely.',
      'Wall integrity, floor traction, footwear, space, traffic, sightline, communication, or emergency route becomes unsafe.',
      'The planned repetition, work-time, local-fatigue, duration, or downstream lower-leg exposure budget is reached.'
    ]::TEXT[],
    'Verify the exact wall-supported bilateral flat-floor task, stable wall, nonslip floor, footwear, forefoot pressure, mostly straight knees, current symptoms and restrictions, planned dose, time, and downstream work. Demonstrate the full-foot start, simultaneous heel rise, comfortable endpoint, brief untimed checkpoint, controlled quiet return, one-cycle count, scaling, stop, and exit. Observe wall contact, forefeet, ankles, knees, hips, bilateral timing, height, breathing, symptoms, first fault, actual duration, and safe exit. Do not diagnose calf or Achilles problems, provide treatment, force range, or imply readiness.',
    'Face the wall with both feet flat and hands lightly supported. Press through both forefeet; lift both heels together, pause briefly, then lower quietly for one rep. Stop for pain, cramping, tingling, weakness, dizziness, or lost control.',
    CASE WHEN p.phase_key='capacity'
      THEN 'More repeatable supported bilateral plantarflexor work capacity under the reviewed dose; no treatment, prevention, structural, readiness, gait, running, or jumping outcome is guaranteed.'
      ELSE 'More consistent low-dose control of the exact supported bilateral calf-raise cycle during preparation; no treatment, prevention, readiness, or performance outcome is guaranteed.' END,
    ARRAY['wall']::TEXT[],
    jsonb_build_object('stationCapacity',1,'base','standing_facing_wall_bilateral_hands_supported_flat_floor',
      'requiredEquipment','wall','space','one_clear_wall_station_with_foot_placement_entry_and_exit_space',
      'setupSeconds',20,'coachSightline','side_and_front_quarter','crossTrafficProhibited',TRUE,
      'wallFloorAndFootwearInspectionRequired',TRUE,'revalidateAfterAnyChange',TRUE),
    ARRAY[bent_knee_variant,wall_hold_variant,ankle_pogo_variant,walking_combo_variant]::UUID[],
    'review',
    jsonb_build_object('durationFormula','wall_floor_footwear_and_body_setup_seconds + sum(actual_valid_repetitions * actual_seconds_per_repetition) + rest_seconds + invalid_or_partial_attempt_seconds + symptom_response_seconds + substitution_seconds + station_reset_and_exit_seconds',
      'secondsPerRep',CASE WHEN p.phase_key='capacity' THEN jsonb_build_array(3,7) ELSE jsonb_build_array(3,6) END,
      'minimumSeconds',CASE WHEN p.phase_key='capacity' THEN 120 ELSE 50 END,
      'typicalSeconds',CASE WHEN p.phase_key='capacity' THEN 320 ELSE 100 END,
      'maximumSecondsWithoutReview',CASE WHEN p.phase_key='capacity' THEN 780 ELSE 240 END,
      'includeActualNotPlanned',TRUE,'recomputeAfterSubstitution',TRUE),
    jsonb_build_object('regressionOrder',jsonb_build_array('reduce_repetitions','reduce_to_comfortable_height','slow_and_control_return','increase_rest','end_set','select_separately_validated_task'),
      'progressionOrder',jsonb_build_array('complete_clean_repetitions','increase_repetitions_within_profile','increase_sets_within_profile','select_reviewed_step_unilateral_loaded_isometric_or_eccentric_variant_after_full_revalidation'),
      'neverScaleByIgnoringSymptomsLosingForefootPressureBouncingAddingLoadOrChangingTaskSilently',TRUE),
    jsonb_build_object('record',jsonb_build_array('definition_variant_profile_and_card_version','wall_floor_footwear_station_and_stance','foot_angle_knee_position_and_support_contacts','planned_and_actual_valid_repetitions','height_tempo_checkpoint_effort_and_rest','valid_invalid_partial_and_symptom_limited_attempts','forefoot_ankle_knee_hip_timing_and_return_faults','first_fault','symptoms_and_stop_reason','active_work_seconds','duration','substitution','station_reset_and_exit'),
      'validUnit','one_simultaneous_bilateral_heel_lift_brief_untimed_checkpoint_and_controlled_return_to_same_full_foot_floor_contact_valid',
      'invalidUnitsTrackedSeparately',TRUE,'doNotConvertToHoldSecondsEccentricOnlyRepetitionsStepRangeLocomotionClinicalForceOrSportActions',TRUE),
    jsonb_build_object('athlete',jsonb_build_array('hands_light','forefeet_even','knees_quiet','rise_together','comfortable_height','brief_checkpoint','quiet_return','one_cycle_one_rep','stop_for_unexpected_symptoms'),
      'coach',jsonb_build_array('verify_exact_identity','inspect_wall_floor_footwear_and_station','observe_support_alignment_timing_height_return_and_count','record_actual_exposure_and_first_fault','revalidate_every_substitution'),
      'accessibility',jsonb_build_array('side_and_front_quarter_visual','written_start_rise_checkpoint_return_sequence','smaller_range_fewer_repetitions_and_more_rest','visible_start_stop_and_count','captions_transcript_still_images_or_live_instruction'),
      'escalation',jsonb_build_array('stop','stabilize_and_exit_wall_station','follow_facility_policy','record_observed_facts','do_not_resume_without_reassessment'))
  FROM (VALUES
    ('55b25a29-8c57-4127-a8b2-a6289ed16e6f'::UUID,'prepare-wall-supported-bilateral-standing-calf-raise','prepare_and_access',92,90,
      'Use a low-dose exact supported bilateral flat-floor calf raise only when it improves preparation without creating local fatigue before priority running, landing, jumping, cutting, or lower-body work.'),
    ('d3ebddc2-d9e3-4891-8026-776657efa1b8'::UUID,'capacity-wall-supported-bilateral-standing-calf-raise','capacity',92,92,
      'Use the exact supported bilateral cycle as plantarflexor capacity work only when recovery, local fatigue, technique, symptoms, duration, and the full session budget fit.')
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
  SELECT 1,canonical_definition,i.definition_id,'duplicate_consolidated',i.rationale,
    jsonb_build_object('migration',migration_key,'identityBoundary',i.boundary_key,
      'canonicalFamily','standing_ankle_plantarflexion_raise',
      'canonicalExactVariant','wall_supported_bilateral_flat_floor_full_cycle',
      'sourceContract',i.source_contract,
      'variantDimensions',jsonb_build_array('support','laterality','surface_height','knee_angle','contraction_mode','return_strategy','implement','external_load','range','tempo','pause','rest','dose'),
      'sourceVariantSelectable',i.definition_id=source44_definition,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'deterministic_identity_equivalence',NULL,now()
  FROM (VALUES
    (source44_definition,'same_supported_bilateral_full_cycle','Source 44 specifies the same standing plantarflexion raise family and supplies the exact supported bilateral flat-floor full-cycle contract selected here.','wall_supported_bilateral_flat_floor_full_cycle'),
    (eccentric_definition,'eccentric_contract_is_family_variant','Source 762 changes the contraction and return strategy to an eccentric-emphasis task; that is a standing-calf-raise variant dimension, not a separate movement definition. Its old skeletal variant remains archived pending exact reauthoring.','standing_calf_raise_eccentric_emphasis_or_eccentric_only'),
    (iso_definition,'isometric_contract_is_family_variant','Sources 841 and 1104 change the action and dose unit to a sustained top hold; that is a standing-calf-raise variant dimension, not a separate movement definition. Their source variants remain archived pending exact reauthoring.','standing_calf_raise_sustained_isometric_top_hold')
  ) i(definition_id,boundary_key,rationale,source_contract)
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,resolved_at=now();

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,rationale,evidence_json,
    resolution_source,reviewed_by,resolved_at)
  SELECT 1,canonical_definition,i.definition_id,'distinct_exercises',i.rationale,
    jsonb_build_object('migration',migration_key,'identityBoundary',i.boundary_key,
      'canonicalContract','standing_wall_supported_bilateral_flat_floor_heel_raise_and_controlled_full_foot_return_cycle',
      'neighborContract',i.neighbor_contract,'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'deterministic_identity_equivalence',NULL,now()
  FROM (VALUES
    (bent_knee_definition,'mostly_straight_knee_vs_bent_knee_soleus_task','Bent-Knee Soleus Raise fixes a materially flexed knee and different support geometry, muscle-length context, loading, and fault contract.','bent_knee_plantarflexion_raise'),
    (wall_hold_definition,'dynamic_raise_return_vs_static_stretch_hold','Wall Calf Stretch holds a split-stance lengthened position rather than raising and returning both heels.','static_wall_supported_calf_stretch_hold'),
    (ankle_pogo_definition,'controlled_nonimpact_cycle_vs_elastic_contacts','Ankle Pogo in Place adds fast stretch-shortening action, repeated impacts, possible flight, landing contacts, and contact counting.','repeated_elastic_ankle_pogo_contacts'),
    (walking_combo_definition,'single_action_vs_locomotor_compound_sequence','Walking Knee Hug to Calf Raise combines locomotion, unilateral balance, a knee-hug action, and a calf raise.','walking_knee_hug_and_calf_raise_compound'),
    (short_foot_combo_definition,'single_action_vs_foot_intrinsic_compound_sequence','Short Foot to Calf Raise adds a separately cued foot-intrinsic action and compound sequence.','short_foot_activation_to_calf_raise_compound'),
    (tibialis_definition,'plantarflexor_heel_raise_vs_dorsiflexor_forefoot_raise','Wall-Supported Tibialis Raise keeps heels planted and lifts the forefeet through dorsiflexion; this card lifts the heels through plantarflexion.','wall_supported_bilateral_forefoot_raise')
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
    ('identity','https://pmc.ncbi.nlm.nih.gov/articles/PMC4483433/','Comparison of ankle plantar flexor activity between double-leg heel raise and walking','Journal of Physical Therapy Science','peer_reviewed_research','A double-leg heel raise is a distinct bilateral plantarflexor task, and achieved heel height relates to plantarflexor activity.','direct bilateral heel-raise identity context','The study does not define Vortex wall contact, full-foot return, valid repetition, stop, or publication rules.',86),
    ('taxonomy','https://pmc.ncbi.nlm.nih.gov/articles/PMC8070905/','Electromyographic Assessment of the Lower Leg Muscles during Concentric and Eccentric Phases of Standing Heel Raise','Journal of Functional Morphology and Kinesiology','peer_reviewed_research','Standing heel raise includes distinguishable concentric rising and eccentric lowering phases across the ankle-foot complex.','direct action and phase taxonomy context','The study does not create Vortex controlled taxonomy keys.',86),
    ('anatomy','https://pmc.ncbi.nlm.nih.gov/articles/PMC4738962/','Analysis of Heel Raise Exercise with Three Foot Positions','International Journal of Sports Physical Therapy','peer_reviewed_research','Straight-knee heel raising recruits the triceps surae while foot position can change measured mechanics and activation.','direct muscle action and foot-position context','Surface EMG and center-of-pressure findings do not prove isolated-muscle loading or one ideal foot angle.',84),
    ('biomechanics','https://pmc.ncbi.nlm.nih.gov/articles/PMC8070905/','Electromyographic Assessment of the Lower Leg Muscles during Concentric and Eccentric Phases of Standing Heel Raise','Journal of Functional Morphology and Kinesiology','peer_reviewed_research','Rising and lowering phases produce different lower-leg muscle activation patterns during standing heel raise.','direct concentric and controlled-return context','The protocol does not validate the exact wall support, comfortable height, or Vortex fault thresholds.',86),
    ('difficulty','https://pmc.ncbi.nlm.nih.gov/articles/PMC4483433/','Comparison of ankle plantar flexor activity between double-leg heel raise and walking','Journal of Physical Therapy Science','peer_reviewed_research','The bilateral heel raise imposes greater deliberate plantarflexor demand than ordinary walking in the studied protocol while remaining a low-coordination nonimpact task.','direct task-demand context','The study does not score Vortex complexity or physical difficulty and does not classify participants.',86),
    ('load_fatigue_recovery','https://pmc.ncbi.nlm.nih.gov/articles/PMC5343533/','Achilles Tendon Loading During Heel-Raising and -Lowering Exercises','Journal of Athletic Training','peer_reviewed_research','Heel-raising and lowering variations produce meaningfully different Achilles tendon loading and should not be treated as interchangeable.','direct load hierarchy and variant-boundary context','The study does not establish Vortex cumulative budgets, fatigue ceilings, or universal recovery hours.',90),
    ('constraints','https://pmc.ncbi.nlm.nih.gov/articles/PMC4738962/','Analysis of Heel Raise Exercise with Three Foot Positions','International Journal of Sports Physical Therapy','peer_reviewed_research','Foot orientation affects center-of-pressure and muscle-activity observations, so stance and foot angle should be recorded rather than silently changed.','direct setup-standardization context','The study does not establish universal eligibility, footwear, wall, floor, or symptom rules.',84),
    ('dosage','https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/','American College of Sports Medicine Position Stand. Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews','Medicine & Science in Sports & Exercise','professional_standard','Resistance-training sets, repetitions, effort, rest, frequency, and progression should be individualized to the intended adaptation.','adjacent prescription context','The source does not establish one universal calf-raise dose, fatigue budget, or recovery interval.',94),
    ('instructions','https://pmc.ncbi.nlm.nih.gov/articles/PMC8070905/','Electromyographic Assessment of the Lower Leg Muscles during Concentric and Eccentric Phases of Standing Heel Raise','Journal of Functional Morphology and Kinesiology','peer_reviewed_research','A standing heel raise can be operationalized as a concentric rise followed by an eccentric lowering phase.','direct phase-sequence context','Vortex adds exact support, simultaneous laterality, comfortable endpoint, full-foot return, counting, and fault rules.',86),
    ('safety_stop_rules','https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf','Youth Resistance Training: Updated Position Statement Paper From the NSCA','National Strength and Conditioning Association','professional_standard','Qualified instruction, safe equipment and environment, technique supervision, and appropriate progression are general resistance-training safeguards.','general safety and supervision context','The position statement does not create an age floor or exact symptom threshold for this card.',90),
    ('programming','https://pmc.ncbi.nlm.nih.gov/articles/PMC10753835/','Triceps surae muscle hypertrophy is greater after standing versus seated calf-raise training','Frontiers in Physiology','peer_reviewed_research','Standing and seated calf-raise training are not interchangeable because knee position changes muscle-length and adaptation context.','direct programming boundary context','The trial does not establish universal superiority, individual response, or transfer to running, jumping, injury prevention, or rehabilitation.',90),
    ('athlete_support','https://pmc.ncbi.nlm.nih.gov/articles/PMC4483433/','Comparison of ankle plantar flexor activity between double-leg heel raise and walking','Journal of Physical Therapy Science','peer_reviewed_research','Heel height is an observable output of a double-leg heel raise and relates to plantarflexor demand.','plain-language self-check context','Athletes should use comfortable repeatable height rather than treating maximal height as a universal target.',86),
    ('coach_support','https://pmc.ncbi.nlm.nih.gov/articles/PMC4738962/','Analysis of Heel Raise Exercise with Three Foot Positions','International Journal of Sports Physical Therapy','peer_reviewed_research','Foot position materially affects observations during heel raising and should be standardized when comparing repetitions.','direct observation context','The study does not authorize diagnosis, treatment, or inference of isolated muscle activation from visual form.',84),
    ('accessibility','https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf','Youth Resistance Training: Updated Position Statement Paper From the NSCA','National Strength and Conditioning Association','professional_standard','Instruction, supervision, progression, and training environment should fit the participant and exercise.','general communication and supervision context','Specific accessibility adaptations still require exact task-preservation review.',90),
    ('alternates','https://pmc.ncbi.nlm.nih.gov/articles/PMC5343533/','Achilles Tendon Loading During Heel-Raising and -Lowering Exercises','Journal of Athletic Training','peer_reviewed_research','Support, laterality, rise assistance, lowering strategy, and exercise configuration change Achilles loading across heel-raise variants.','direct alternate and variant-boundary context','Loading differences do not by themselves validate any progression or substitution relationship.',90),
    ('media','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en','Embed videos and playlists','YouTube Help','manufacturer_instruction','Five candidate URLs returned current oEmbed title, channel, thumbnail, and iframe metadata on 2026-08-09.','link and embed metadata only','Playback, exact mechanics, captions, accessibility, cue quality, safety, reviewer identity, and approval remain unverified.',82)
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
  SELECT canonical_definition,exact_variant,2,'https://www.youtube.com/watch?v='||m.video_id,
    'https://www.youtube-nocookie.com/embed/'||m.video_id,m.video_id,m.title,m.channel,NULL,'en',NULL,TRUE,NULL,NULL,
    'healthy','candidate','manual_research',m.query,NULL,NULL,'2026-11-09'::TIMESTAMPTZ,
    'Current YouTube oEmbed metadata only. Playback, exact wall support, bilateral stance, simultaneous heel rise, comfortable height, brief untimed checkpoint, controlled full-foot return, count, captions, accessibility, cue quality, safety, reviewer identity, card-version match, and approval remain unverified.'
  FROM (VALUES
    ('_B6o13eoAuU','Double Leg Calf Raise','Elite Performance Institute','Double-leg calf-raise candidate checked by YouTube oEmbed; full exact review pending'),
    ('88D6QOBlCWA','Standing Calf Raise Exercise Video','This Is Living With Cancer™','Standing calf-raise candidate checked by YouTube oEmbed; full exact review pending'),
    ('Dgf9hougTdc','Standing BW Calf Raise','Conditioned by Kelly Tekin','Standing bodyweight calf-raise candidate checked by YouTube oEmbed; full exact review pending'),
    ('CtpPV2FBkG4','Standing Calf Raises Bodyweight Tutorial | Calf Exercise | Proper Form Guide | Step by Step','Lean Physique Lab','Standing bodyweight tutorial candidate checked by YouTube oEmbed; full exact review pending'),
    ('584joZQZvRg','Calf Raise with Heel Drop | Osteoporosis Leg Exercises to Improve Bone Density | 4 Minutes','Kaari','Calf raise with heel-drop candidate checked by YouTube oEmbed; title and population framing require full human scope review')
  ) m(video_id,title,channel,query)
  ON CONFLICT(definition_id,reviewed_card_version,url) DO UPDATE SET
    variant_id=exact_variant,embed_url=EXCLUDED.embed_url,video_id=EXCLUDED.video_id,
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
      'neverInferFromNameParticipantRankingOrSportContext',TRUE),
    jsonb_build_object('status',a.proposed_status,'classificationCandidate',a.classification,
      'humanIdentityContentAndSafetyReviewRequired',TRUE,'approvalsCreated',FALSE),
    'candidate',NULL,NULL
  FROM (VALUES
    ('Calf Raise to Controlled Heel Drop','same_identity','Source 44 names the same exact supported bilateral flat-floor rise-and-return cycle.','source44_identity',jsonb_build_array('legacy_exercise_44','same_support_action_and_count'),'canonical_alias'),
    ('Double-Leg Calf Raise','same_identity','Double-leg is an alias when bilateral simultaneous action, wall support, flat floor, complete rise, and controlled full-foot return are all explicit.','bilateral_alias',jsonb_build_array('bilateral','simultaneous','same_contacts_and_count'),'canonical_alias'),
    ('Wall-Supported Bilateral Standing Calf Raise','same_identity','This descriptive name makes the Source 44 support and laterality explicit without changing the task.','explicit_alias',jsonb_build_array('wall_support','bilateral_full_cycle'),'canonical_alias'),
    ('Comfortable Stance Width','modifier_annotation','A small stance-width adjustment is an annotation while contacts, laterality, action, and count remain unchanged.','stance_width_modifier',jsonb_build_array('stance_width'),'annotation'),
    ('Small Foot-Angle Adjustment','modifier_annotation','Foot angle should be recorded but is an annotation within a comfortable controlled range unless it creates a targeted or different task.','foot_angle_modifier',jsonb_build_array('foot_angle'),'annotation'),
    ('Comfortable Heel-Raise Height','modifier_annotation','A smaller active range changes amplitude without changing support, action, return, or count.','range_modifier',jsonb_build_array('active_range'),'annotation'),
    ('Controlled Rise and Return Tempo','modifier_annotation','Tempo changes time under tension while preserving the full rise-and-return cycle.','tempo_modifier',jsonb_build_array('rise_tempo','return_tempo'),'annotation'),
    ('Brief Untimed Top Checkpoint','modifier_annotation','A momentary checkpoint confirms control but does not become an isometric task without prescribed hold time or effort.','checkpoint_modifier',jsonb_build_array('brief_checkpoint','no_hold_dose'),'annotation'),
    ('Breathing Prompt','modifier_annotation','A breathing cue changes delivery, not identity, while the same cycle remains.','breathing_modifier',jsonb_build_array('breathing'),'annotation'),
    ('Repetitions Sets Rest or Effort Target','modifier_annotation','Volume, recovery, and effort change dosage rather than exercise identity.','dose_modifier',jsonb_build_array('repetitions','sets','rest','effort'),'annotation'),
    ('Footwear or Approved Barefoot Context','modifier_annotation','Footwear is an annotation only when traction, heel geometry, forefoot flexibility, range, and mechanics stay valid.','footwear_modifier',jsonb_build_array('footwear','traction'),'annotation'),
    ('Preparation Capacity or General Context','modifier_annotation','Workout purpose is a delivery profile unless a physical sport or compound action is added.','context_modifier',jsonb_build_array('delivery_context','no_added_action'),'annotation'),
    ('Step Calf Raise Through Below-Neutral Range','new_variant','A step adds edge geometry, below-neutral range, equipment, fall consequence, and a different start and finish.','step_range_variant',jsonb_build_array('surface_height','below_neutral_range','edge_safety'),'research_queue'),
    ('Single-Leg Standing Calf Raise','new_variant','Unilateral loading changes force, balance, asymmetry, fatigue, failure response, and repetition accounting.','unilateral_variant',jsonb_build_array('unilateral'),'research_queue'),
    ('Alternating Standing Calf Raise','new_variant','Alternation changes timing, unilateral exposure, balance, and count.','alternating_variant',jsonb_build_array('alternating','side_order'),'research_queue'),
    ('Unsupported Standing Calf Raise','new_variant','Removing wall contact changes balance demand, failure consequence, supervision, and valid faults.','unsupported_variant',jsonb_build_array('unsupported_standing'),'research_queue'),
    ('Externally Loaded Standing Calf Raise','new_variant','Dumbbells, bar, machine, vest, or other external load changes implement handling, load path, setup, failure, and fatigue.','loaded_variant',jsonb_build_array('implement','external_load'),'research_queue'),
    ('Standing Calf Raise Sustained Top Hold','new_variant','A prescribed top hold changes contraction mode, dose unit, fatigue behavior, endpoint, and count.','isometric_variant',jsonb_build_array('sustained_isometric','hold_seconds_or_effort'),'research_queue'),
    ('Assisted-Rise Eccentric-Only Standing Calf Lower','new_variant','Assistance into the top plus a prescribed negative changes return strategy, laterality, tempo, load, and count.','eccentric_only_variant',jsonb_build_array('assisted_rise','eccentric_only','tempo'),'research_queue'),
    ('Fast Elastic Calf Raise or Rebound','new_variant','Fast elastic intent or bouncing changes speed, stretch-shortening demand, contact behavior, impact, and stop rules.','elastic_variant',jsonb_build_array('speed','elastic_intent','impact'),'research_queue'),
    ('Bent-Knee Soleus Raise','new_definition','A materially bent knee changes posture, support, muscle-length context, loading, and task contract.','bent_knee_distinct',jsonb_build_array('knee_flexion','support_position'),'existing_distinct_definition'),
    ('Seated Soleus or Dumbbell Calf Raise','new_definition','Seated knee-flexed support and thigh-loaded resistance change the base, force path, balance, and logistics.','seated_distinct',jsonb_build_array('seated_support','knee_flexion','load_interface'),'existing_distinct_definition'),
    ('Wall-Supported Tibialis Raise','new_definition','The heels remain planted while the forefeet lift through dorsiflexion, reversing the primary ankle action.','tibialis_distinct',jsonb_build_array('dorsiflexion','forefoot_lift'),'existing_distinct_definition'),
    ('Knee-to-Wall Ankle Rocker','new_definition','The target heel stays planted while the knee travels forward and returns through dorsiflexion.','ankle_rocker_distinct',jsonb_build_array('heel_planted','knee_forward_return'),'existing_distinct_definition'),
    ('Wall Calf Stretch Hold','new_definition','A split-stance lengthened-position hold uses time rather than bilateral heel-raise repetitions.','stretch_hold_distinct',jsonb_build_array('split_stance','static_hold'),'existing_distinct_definition'),
    ('Ankle Pogo in Place','new_definition','Pogos add repeated elastic impact contacts, rebound, possible flight, landing, and contact counting.','pogo_distinct',jsonb_build_array('impact','rebound','contacts'),'existing_distinct_definition'),
    ('Walking Knee Hug to Calf Raise','new_definition','Walking, unilateral balance, knee-hug action, and calf raise form a compound locomotor sequence.','walking_combo_distinct',jsonb_build_array('locomotion','compound_action'),'existing_distinct_definition'),
    ('Short Foot to Calf Raise','new_definition','A separately cued foot-intrinsic action precedes the calf raise, creating a compound sequence.','short_foot_combo_distinct',jsonb_build_array('foot_intrinsic_action','compound_sequence'),'existing_distinct_definition')
  ) a(name,classification,rationale,boundary_key,facts,proposed_status)
  ON CONFLICT(definition_id,reviewed_card_version,alternate_name) DO UPDATE SET
    classification=EXCLUDED.classification,rationale=EXCLUDED.rationale,
    distinguishing_dimensions=EXCLUDED.distinguishing_dimensions,
    proposed_card_json=EXCLUDED.proposed_card_json,review_status='candidate',
    reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_relationship_v1(
    from_variant_id,to_variant_id,relationship,similarity_score,dimensions,reason,
    conditions_json,review_status,created_by,reviewed_by,reviewed_at)
  SELECT exact_variant,r.to_id,r.relationship,r.score,r.dimensions,r.reason,
    jsonb_build_object('migration',migration_key,'reviewOnly',TRUE,'automaticSubstitution',FALSE,
      'revalidate',jsonb_build_array('identity and purpose','support laterality surface knee angle action return and count','wall floor footwear equipment space traffic and exit','symptoms restrictions and scope','dose effort rest duration and logistics','calf Achilles foot ankle knee lower-body and sport budgets','persistence','coach rendering','athlete rendering'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'review',NULL,NULL,NULL
  FROM (VALUES
    (bent_knee_variant,'lateral_substitution',58,ARRAY['complexity','load','fatigue']::TEXT[],'Changes knee angle and tissue-loading context; it is not an automatic regression or equivalent task.'),
    (wall_hold_variant,'lateral_substitution',42,ARRAY['range','complexity','fatigue']::TEXT[],'Changes dynamic repetitions to a split-stance static lengthened-position hold.'),
    (ankle_pogo_variant,'progression',36,ARRAY['speed','impact','complexity','fatigue']::TEXT[],'Adds rapid elastic contacts and impact; use only after a new purpose, budget, surface, footwear, and readiness validation.'),
    (walking_combo_variant,'progression',38,ARRAY['stability','complexity','fatigue']::TEXT[],'Adds locomotion, unilateral balance, knee-hug action, traffic, and a different count and duration model.')
  ) r(to_id,relationship,score,dimensions,reason)
  ON CONFLICT(from_variant_id,to_variant_id,relationship) DO UPDATE SET
    similarity_score=EXCLUDED.similarity_score,dimensions=EXCLUDED.dimensions,
    reason=EXCLUDED.reason,conditions_json=EXCLUDED.conditions_json,review_status='review',
    created_by=NULL,reviewed_by=NULL,reviewed_at=NULL,updated_at=now()
  WHERE coaching.exercise_relationship_v1.reviewed_by IS NULL
    AND coaching.exercise_relationship_v1.review_status<>'approved';

  INSERT INTO coaching.exercise_score_calibration_v1(
    facility_id,variant_id,dimension,proposed_score,anchor_tier,rationale,status,version,
    created_by,reviewed_by,review_notes,reviewed_at)
  SELECT 1,exact_variant,d.dimension,CASE d.dimension WHEN 'technicalComplexity' THEN 22 ELSE 32 END,20,
    CASE d.dimension WHEN 'technicalComplexity' THEN
      'Review-only task-complexity anchor based on stable wall contact, bilateral forefoot pressure, mostly straight knees, synchronized rise, comfortable endpoint, controlled full-foot return, breathing, faults, and exact cycle count.'
    ELSE
      'Review-only task physical-demand anchor based on raising body mass bilaterally through ankle plantarflexion, calf and Achilles loading, forefoot support, controlled eccentric return, local fatigue, no external load, and no impact.' END
      ||' This scores the exercise task, not the participant.',
    'review',1,NULL,NULL,'Research-informed proposal only; independent comparison and qualified human approval remain required.',NULL
  FROM (VALUES('technicalComplexity'),('absoluteLoadDemand')) d(dimension)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
    proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,reviewed_by=NULL,
    review_notes=EXCLUDED.review_notes,reviewed_at=NULL,updated_at=now();

  UPDATE coaching.exercise SET
    name='Wall-Supported Bilateral Standing Calf Raise',slug='calf-raise-to-controlled-heel-drop',
    description='Stand facing a stable wall with both hands in light continuous contact, feet about hip-width on a dry level nonslip floor, full feet planted, and knees mostly straight without forced locking. Press through both forefeet and lift both heels together through comfortable ankle plantarflexion. Reach a brief untimed top checkpoint, then lower both heels under control to the same full-foot floor contact. Count one complete bilateral lift-and-return cycle as one repetition.',
    instructions='Use the exact wall-supported bilateral flat-floor variant. Keep both hands lightly on the wall, forefeet stable, knees mostly straight, and body line controlled. Lift both heels together through comfortable height, pause briefly, then lower quietly to full-foot contact for one repetition. Stop for pain, pinching, cramping, instability, numbness, tingling, weakness, altered circulation, dizziness, faintness, nausea, visual change, chest pain, unusual breathlessness, unsafe wall or floor, or participant request.',
    skill_level=NULL,age_min=NULL,age_max=NULL,default_sets=1,default_reps=10,
    default_work_seconds=50,default_rest_seconds=45,
    tempo='one to two seconds rise, brief untimed checkpoint, and two to four seconds controlled return',
    load_note='Track wall, floor, footwear, stance, foot angle, knee position, support contacts, planned and actual valid repetitions, height, rise and return tempo, checkpoint, effort, bilateral timing, forefoot pressure, ankle knee hip and trunk faults, breathing, first fault, symptoms, invalid or partial attempts, active work, rest, duration, substitution, station reset, exit, and overlapping calf, Achilles, foot, ankle, running, landing, jumping, cutting, and lower-body exposure.',
    est_seconds_per_set=110,is_published=FALSE,archived=FALSE,
    card_summary='Wall-supported bilateral flat-floor standing calf raise with synchronized heel lift, brief untimed checkpoint, controlled full-foot return, and exact repetition count.',
    coach_language='Verify the exact wall-supported bilateral flat-floor cycle, wall floor footwear and station safety, mostly straight knees, forefoot pressure, synchronized rise, comfortable height, controlled return, symptoms and restrictions, planned dose, actual exposure, first fault, duration, downstream lower-leg budget, persistence, exit, and escalation.',
    athlete_language='Hands light on the wall and both feet flat. Press through your forefeet, lift both heels together, pause briefly, then lower quietly to flat feet for one rep. Stop for pain, pinching, cramping, tingling, weakness, dizziness, or lost control.',
    programming_logic=jsonb_build_object('selectionStatus','canonical_variant_required','selectable',TRUE,
      'canonicalDefinitionId',canonical_definition,'exactVariantIds',to_jsonb(active_variant_ids),
      'difficultyModel','max_exercise_complexity_physical_difficulty','exerciseDifficultyDescribesTaskOnly',TRUE,
      'selectionInputs',jsonb_build_array('workout purpose and delivery context','stable wall nonslip floor footwear station and exit','bilateral wall support and flat-floor full-foot start','comfortable forefoot pressure plantarflexion and controlled return','exact simultaneous rise checkpoint return and count comprehension','dose range tempo effort rest and duration','cumulative calf Achilles foot ankle lower-body and sport exposure','coach scope and sightline'),
      'substitutionRevalidation',jsonb_build_array('identity','support laterality surface knee angle action return and count','wall floor footwear equipment space traffic and exit','restrictions and symptoms','purpose','dose','fatigue and impact budgets','duration','logistics','persistence','coach rendering','athlete rendering'),
      'legacySourceIds',jsonb_build_array(44,263,431,525,577,762,841,1104,1150),
      'selectableLegacySourceIds',jsonb_build_array(44),'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    scalable_variables=ARRAY['stance_width','foot_angle','active_range','tempo','brief_top_checkpoint','breathing_prompt','repetitions','sets','rest_seconds','effort_target','footwear','delivery_context']::TEXT[],
    movement_family='Standing ankle plantarflexion raise',primary_phase_key='capacity',
    phase_subrole='lower_leg_capacity',primary_order_slot='calf_capacity_accessory',
    movement_requirements=jsonb_build_object('impact_level',0,'balance_demand','low_with_wall_support',
      'postural_shape','standing_facing_wall_bilateral_hands_supported_full_feet_flat_at_start_and_finish',
      'primary_tissues',jsonb_build_array('gastrocnemius','soleus','Achilles_tendon_loading_system','foot_and_ankle_stabilizers'),
      'breathing_demand','continuous_controlled_breathing','coordination_demand','low',
      'primary_joint_actions',jsonb_build_array('bilateral_ankle_plantarflexion','controlled_return_toward_dorsiflexion','forefoot_stabilization','mostly_straight_knee_position_hold','wall_supported_trunk_stabilization'),
      'supportContacts',jsonb_build_array('left_and_right_hands_on_wall','left_and_right_forefeet_on_floor_throughout','left_and_right_full_feet_at_start_and_finish'),
      'exactSequence',jsonb_build_array('full_foot_supported_start','simultaneous_bilateral_heel_rise','comfortable_plantarflexion_endpoint','brief_untimed_checkpoint','controlled_return','same_full_foot_contact_one_repetition'),
      'exerciseDifficulty',jsonb_build_object('complexity',22,'physicalDifficulty',32,'overall',32,'formula','max')),
    coaching_execution=jsonb_build_object(
      'setup',jsonb_build_array('stable inspected unobstructed wall','dry clean level nonslip floor','secure traction and suitable footwear or approved barefoot surface','feet about hip-width full feet planted','knees mostly straight without forced locking','both hands in light wall contact','clear station and exit'),
      'execution_steps',jsonb_build_array('keep light wall contact and both forefeet stable','press through both forefeet and lift both heels together','reach comfortable repeatable height without knee hip or trunk pumping','use a brief untimed top checkpoint','lower both heels together under control','finish at the same full-foot contact and count one repetition'),
      'coach_cues',jsonb_build_array('hands light','forefeet even','knees quiet','rise together','comfortable height','brief checkpoint','lower quietly','one full cycle one rep','keep breathing'),
      'athlete_cues',jsonb_build_array('light hands','press through forefeet','heels up together','pause briefly','lower quietly','stop before form changes'),
      'common_faults',jsonb_build_array('pulling on wall','forefoot slide or outer-edge roll','knee or hip pumping','asynchronous heel rise','forced height','bounce at bottom','uncontrolled or incomplete return','breath holding','silent change to another variant'),
      'quality_gate',jsonb_build_array('safe wall floor footwear and station','light continuous wall support','stable forefeet','mostly straight quiet knees','simultaneous bilateral rise','comfortable repeatable height','brief untimed checkpoint','controlled quiet full-foot return','correct count','continuous breathing','no stop symptom'),
      'stop_signs',jsonb_build_array('sharp increasing night post-trauma or unfamiliar pain','painful pinching catching instability cramping or loss of foot control','numbness tingling weakness altered circulation or another neurologic sign','dizziness faintness nausea visual change chest pain unusual breathlessness or disorientation','wall forefoot knee hip bilateral timing height or return control cannot be restored','unsafe wall floor footwear station traffic or exit','participant stop request'),
      'breathing_cues',jsonb_build_array('breathe continuously','do not hold breath to gain height'),
      'clinical_scope','This is a workout exercise, not a diagnostic calf or Achilles test, rehabilitation prescription, injury-prevention guarantee, clearance, or proof of readiness.'),
    pairing_logic=jsonb_build_object('sameSessionBudget',jsonb_build_array('valid_repetitions','active_work_seconds','calf_Achilles_load','foot_ankle_and_lower_leg_exposure','technical_fatigue','downstream_running_landing_jumping_cutting_and_lower_body_work','impact'),
      'avoidAutomaticPairingWith',jsonb_build_array('fatiguing_calf_work_before_priority_running_landing_jumping_or_cutting','symptom_provoking_plantarflexion','same_session_lower_leg_budget_exceeded'),
      'revalidateAfterSubstitution',TRUE),
    media_library=jsonb_build_object('candidate_video_ids',jsonb_build_array('_B6o13eoAuU','88D6QOBlCWA','Dgf9hougTdc','CtpPV2FBkG4','584joZQZvRg'),
      'adjacent_eccentric_only_video_ids',jsonb_build_array('XQACBWaIino','3tc0lN_bW5o'),
      'reviewState','oembed_metadata_only_candidate_quarantine',
      'playbackExactWallSupportBilateralRiseReturnCountCompensationCaptionsAccessibilityQualitySafetyAndApprovalVerified',FALSE,
      'humanReviewRequired',TRUE),
    participant_structure='individual',programming_kind='exercise',linked_skill_id=NULL,
    why_publish_ready=FALSE,updated_at=now()
  WHERE id=44;

  UPDATE coaching.exercise SET skill_level=NULL,age_min=NULL,age_max=NULL,is_published=FALSE,
    archived=TRUE,why_publish_ready=FALSE,linked_skill_id=NULL,
    programming_logic=jsonb_build_object('selectionStatus','duplicate_consolidated','selectable',FALSE,
      'canonicalDefinitionId',canonical_definition,'replacementVariantIds',to_jsonb(active_variant_ids),
      'familyVariantRequiresExactReauthoring',id IN(762,841,1104,1150),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),updated_at=now()
  WHERE id IN(263,431,525,577,762,841,1104,1150);

  UPDATE coaching.exercise_safety_profile SET risk_level=1,impact_level=0,
    minimum_age_recommended=NULL,minimum_skill_level=NULL,requires_spotting=FALSE,
    requires_coach_supervision='recommended',
    minimum_prerequisite_notes='Readiness uses safe wall approach and exit, an inspected stable wall and nonslip level floor, suitable footwear and forefoot pressure, comfortable bilateral plantarflexion and controlled return with mostly straight knees, exact cycle comprehension, current symptoms and restrictions, workout dose, and downstream lower-leg loading; never participant classification or age.',
    readiness_checks=ARRAY[
      'Confirm the exact wall-supported bilateral flat-floor variant, stable unobstructed wall, dry nonslip level floor, suitable footwear, station, sightline, communication, exit, and emergency route.',
      'Confirm foot, ankle, Achilles, calf, shin, knee, hip, back, wall-contact tolerance, and no current symptom or restriction conflict.',
      'Confirm the participant understands light wall support, stable forefeet, mostly straight knees, simultaneous heel rise, comfortable height, brief untimed checkpoint, controlled full-foot return, one-cycle count, stop signal, and exit.',
      'Review cumulative repetitions, active work, calf and Achilles load, foot ankle and lower-leg exposure, local and technical fatigue, and later running, landing, jumping, cutting, or lower-body demand.'
    ]::TEXT[],
    stop_signs=ARRAY[
      'Sharp, increasing, night, post-trauma, or unfamiliar pain, guarding, or participant stop request.',
      'Foot, ankle, Achilles, calf, shin, knee, hip, or back symptoms prevent the exact task.',
      'Painful pinching, catching, instability, giving way, uncontrolled cramping, or loss of foot control.',
      'Numbness, tingling, weakness, altered circulation, or another neurologic sign.',
      'Dizziness, faintness, nausea, visual change, chest pain, unusual breathlessness, disorientation, or inability to communicate.',
      'Wall contact is lost or used to pull, a forefoot slides or rolls, or the knees or hips pump to create height.',
      'Bilateral timing, comfortable height, alignment, controlled return, breathing, or exact count cannot be restored despite reduced range, repetitions, or pace.',
      'Wall, floor, footwear, space, traffic, sightline, communication, duration, budget, exit, or emergency route becomes inadequate.'
    ]::TEXT[],
    contraindications=ARRAY[
      'Current symptoms, trauma, procedure, instability, altered circulation, or clinical restrictions conflict with bilateral plantarflexion or wall support.',
      'No stable inspected wall, dry nonslip level floor, suitable footwear, controlled setup and exit, sightline, communication, or emergency route.',
      'The intended service is diagnosis, treatment, injury management, readiness clearance, maximal clinical testing, step-range, unilateral, unsupported, bent-knee, loaded, isometric-only, eccentric-only, elastic, locomotor, compound, or sport work.'
    ]::TEXT[],
    common_substitutions=ARRAY[
      'Use Bent-Knee Soleus Raise only when the changed knee position, support, load, fatigue, symptoms, and purpose fit and all checks are rerun.',
      'Use Wall Calf Stretch Hold only when a static lengthened-position task fits and hold duration and symptoms are revalidated.',
      'Use Ankle Pogo or Walking Knee Hug to Calf Raise only when impact, locomotion, balance, space, traffic, count, and workout budgets are fully revalidated.',
      'Do not infer that step, unilateral, alternating, unsupported, loaded, top-hold, eccentric-only, fast elastic, clinical, or sport versions are equivalent.'
    ]::TEXT[]
  WHERE exercise_id=44;

  UPDATE coaching.exercise_score_v1 SET technical_complexity=22,absolute_load_demand=32,
    coordination_demand=20,impact=1,supervision_demand=12,base_overall_difficulty=greatest(22,32),
    legacy_scores=coalesce(legacy_scores,'{}'::JSONB)||jsonb_build_object(
      'candidateReassessment',migration_key,'projectionScope','wall_supported_bilateral_flat_floor_full_cycle',
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'variantScores',jsonb_build_object('wallSupportedBilateralStandingCalfRaise',jsonb_build_object('complexity',22,'physicalDifficulty',32,'overall',32)),
      'exerciseScoresDescribeTaskOnly',TRUE,'independentCalibrationRequired',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    migration_confidence=62,human_review_status='queued',reviewed_by=NULL,reviewed_at=NULL,
    review_notes='Research-informed candidate reassessment only. Scores describe exercise complexity and physical difficulty, not participant classification, age, readiness, or proficiency. Exact load, fatigue, recovery, and independent calibration remain under review.',updated_at=now()
  WHERE exercise_id=44;

  UPDATE coaching.exercise_difficulty_profile SET technical=2.2,complexity=2.0,load=3.2,overall=3.2,
    recommended_age_min=NULL,recommended_age_max=NULL,attention_demand='low',
    notes='Candidate projection from the exact wall-supported bilateral flat-floor rise-and-controlled-return task. Exercise complexity is 22/100, physical difficulty is 32/100, and overall is 32/100 by maximum. This is not participant classification, readiness, age, skill, or proficiency.',
    source='canonical_research_candidate',updated_at=now()
  WHERE exercise_id=44;

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  VALUES(canonical_definition,1,2,'2.0.0',migration_key,'quarantined',
    jsonb_build_object(
      'identity',jsonb_build_object('passed',TRUE,'identityKey','standing_calf_raise_family_with_exact_wall_supported_bilateral_flat_floor_full_cycle','legacySources',9,'selectableLegacySources',jsonb_build_array(44),'activeVariants',1,'archivedFamilySourceVariants',9,'duplicateDefinitionsConsolidated',3,'neighborBoundaries',6),
      'taxonomy',jsonb_build_object('passed',TRUE,'controlledTerms',TRUE,'movementPatterns',jsonb_build_array('brace'),'bodyRegions',jsonb_build_array('foot','ankle','calf','knee','hip','core'),'equipment',jsonb_build_array('wall')),
      'anatomy',jsonb_build_object('passed',TRUE,'musclesJointsActionsPlanesLateralityContactsSequenceAndIsolationBoundary',TRUE),
      'difficulty',jsonb_build_object('passed',TRUE,'model','max_exercise_complexity_physical_difficulty','variantVectors',jsonb_build_array('22/32/32'),'participantClassificationAbsent',TRUE,'independentCalibrationRequired',TRUE),
      'loadFatigueRecovery',jsonb_build_object('passed',TRUE,'actualRepetitionsWorkRangeTempoReturnFaultSymptomsAndOverlappingLowerLegExposureTracked',TRUE,'impactNone',TRUE,'recoveryIsPlanningEstimate',TRUE),
      'constraints',jsonb_build_object('passed',TRUE,'wallFloorFootwearForefootKneeSymptomsRestrictionsSpaceTrafficScopeAndEmergencyRoute',TRUE),
      'delivery',jsonb_build_object('passed',TRUE,'profiles',2,'prepareAndCapacity',TRUE,'durationDoseRestSetupExitAndSubstitutionRevalidation',TRUE),
      'instructions',jsonb_build_object('passed',TRUE,'athleteCoachAccessibilityAndSupportOperations',TRUE,'supportRiseCheckpointReturnCountSymptomsExitAndClinicalScope',TRUE),
      'research',jsonb_build_object('passed',TRUE,'sections',16,'registryVersion',research_version,'directAndAdjacentEvidenceSeparated',TRUE,'exampleDoseNotUniversal',TRUE),
      'media',jsonb_build_object('passed',FALSE,'candidateCount',5,'currentOEmbedMetadataHealthy',TRUE,'playbackReviewed',FALSE,'exactSupportedBilateralCycleReviewed',FALSE,'captionsAccessibilityQualitySafetyAndApprovalReviewed',FALSE),
      'relationships',jsonb_build_object('passed',FALSE,'reviewOnly',4,'approved',0,'automaticSubstitution',FALSE),
      'calibration',jsonb_build_object('passed',FALSE,'reviewOnly',2,'approved',0),
      'alternates',jsonb_build_object('passed',TRUE,'assessments',28,'sameIdentity',3,'modifierAnnotations',9,'newVariants',8,'newDefinitions',8,'singleExactVariant',TRUE),
      'generationSupport',jsonb_build_object('passed',TRUE,'selectionConstraints',TRUE,'cumulativeFatigueAndImpactBudgets',TRUE,'duration',TRUE,'wallFloorFootwearSetupAndExit',TRUE,'substitutionRevalidation',TRUE,'renderingAndPersistence',TRUE),
      'publication',jsonb_build_object('passed',FALSE,'reviewer',NULL,'approver',NULL)),
    jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01','message','A qualified human must watch all five candidates in full and verify playback, exact wall support, bilateral flat-floor stance, simultaneous rise, comfortable height, brief checkpoint, controlled full-foot return, count, captions, accessibility, cue quality, safety, conflicts, reviewer identity, timestamp, card version, and approval rationale.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','A qualified coach must approve or reject all four relationships; no automatic substitution to bent-knee, static-hold, impact, locomotor, step, unilateral, unsupported, loaded, isometric, eccentric, clinical, or sport tasks is authorized.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','An independent qualified reviewer must calibrate exercise complexity 22 and physical difficulty 32. Scores do not classify a participant or create an age, readiness, skill, or proficiency level.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','A qualified reviewer and separate approver must complete content review before publication. Identity, anatomy, wall floor and footwear safety, load and recovery, action and count, clinical scope, dose, stop, accessibility, persistence, delivery context, and support rules remain quarantined.')),
    TRUE,now())
  ON CONFLICT(definition_id) DO UPDATE SET facility_id=EXCLUDED.facility_id,
    card_version=EXCLUDED.card_version,schema_version=EXCLUDED.schema_version,
    audit_version=EXCLUDED.audit_version,status='quarantined',checks_json=EXCLUDED.checks_json,
    blocking_issues_json=EXCLUDED.blocking_issues_json,human_review_required=TRUE,checked_at=now();

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_definition AND status='review' AND card_version=2 AND schema_version='2.0.0'
        AND legacy_exercise_id=44 AND slug='standing-calf-raise'
        AND approved_video_url IS NULL AND reviewed_by IS NULL AND approved_by IS NULL AND last_reviewed_at IS NULL
        AND movement_patterns=ARRAY['brace']::TEXT[] AND required_equipment=ARRAY['wall']::TEXT[]
        AND anatomy_json<> '{}'::JSONB AND environment_json<> '{}'::JSONB AND population_json<> '{}'::JSONB
        AND athlete_support_json ?& ARRAY['whyItMatters','primaryCue','expectedSensations','unexpectedSensations','painGuidance','selfChecks','accessibility','mediaAlternatives']::TEXT[]
        AND coach_support_json ?& ARRAY['observationChecklist','faultCorrections','demonstrationPlan','groupManagement','modificationDecisionTree','doNotUseWhen']::TEXT[]
        AND support_operations_json ?& ARRAY['issueCategories','supportEscalation','retentionPolicy','changeImpactPolicy']::TEXT[]
        AND provenance_json->>'approvalsCreated'='false')
    OR (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id IN(source44_definition,eccentric_definition,iso_definition) AND status='archived'
        AND approved_video_url IS NULL AND reviewed_by IS NULL AND approved_by IS NULL AND last_reviewed_at IS NULL)<>3
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(all_owned_variant_ids) AND id<>exact_variant AND status='archived')<>9
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=exact_variant AND definition_id=canonical_definition AND status='review'
        AND requirements_json->>'selectable'='true'
        AND (difficulty_json->>'technicalComplexity')::INTEGER=22
        AND (difficulty_json->>'physicalDifficulty')::INTEGER=32
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=greatest(22,32)
        AND (difficulty_json->>'coordinationDemand')::INTEGER=20
        AND (difficulty_json->>'supervisionDemand')::INTEGER=12
        AND (difficulty_json->>'failureConsequence')::INTEGER=10
        AND (difficulty_json->>'impact')::INTEGER=1
        AND (difficulty_json->>'workCapacityDemand')::INTEGER=30
        AND (load_profile_json->>'gripDemand')::INTEGER=1
        AND (load_profile_json->>'landingContactsPerRep')::INTEGER=0
        AND (fatigue_profile_json->>'gripFatigue')::INTEGER=1
        AND (fatigue_profile_json->>'impactAccumulation')::INTEGER=1
        AND (fatigue_profile_json->'cumulativeBudget'->>'impact')::INTEGER=0
        AND programming_profile_json->>'publicationQuarantined'='true') THEN
    RAISE EXCEPTION '% definition variant identity or quarantine assertion failed',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=exact_variant AND status='review' AND equipment_required=ARRAY['wall']::TEXT[]
        AND coalesce(time_model_json->>'durationFormula','')<>'' AND dose_scaling_json<> '{}'::JSONB
        AND measurement_json<> '{}'::JSONB AND support_prompts_json<> '{}'::JSONB
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
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>28
    OR (SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE from_variant_id=exact_variant AND review_status='review' AND reviewed_by IS NULL)<>4
    OR (SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=exact_variant AND status='review' AND reviewed_by IS NULL)<>2
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=canonical_definition AND decision='duplicate_consolidated'
        AND resolved_definition_id IN(source44_definition,eccentric_definition,iso_definition)
        AND reviewed_by IS NULL)<>3
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=canonical_definition AND decision='distinct_exercises'
        AND resolved_definition_id IN(bent_knee_definition,wall_hold_definition,ankle_pogo_definition,
          walking_combo_definition,short_foot_combo_definition,tibialis_definition)
        AND reviewed_by IS NULL)<>6 THEN
    RAISE EXCEPTION '% authored row-count or review-state assertion failed',migration_key;
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
      WHERE v.id=exact_variant AND NOT EXISTS(SELECT 1 FROM coaching.equipment allowed WHERE allowed.key=key)) THEN
    RAISE EXCEPTION '% uncontrolled taxonomy was authored',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1 r
      CROSS JOIN LATERAL unnest(r.dimensions) dimension
      WHERE r.from_variant_id=exact_variant
        AND dimension<>ALL(ARRAY['load','leverage','range','speed','stability','complexity','impact','decision_demand','fatigue']))
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1
      WHERE from_variant_id=exact_variant AND review_status='approved') THEN
    RAISE EXCEPTION '% relationship dimension or approval assertion failed',migration_key;
  END IF;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise WHERE id=44
      AND skill_level IS NULL AND age_min IS NULL AND age_max IS NULL AND linked_skill_id IS NULL
      AND NOT is_published AND NOT archived AND programming_kind='exercise' AND NOT why_publish_ready
      AND programming_logic->>'exerciseDifficultyDescribesTaskOnly'='true'
      AND movement_requirements->'exerciseDifficulty'->>'overall'='32'
      AND media_library->>'reviewState'='oembed_metadata_only_candidate_quarantine')
    OR (SELECT count(*) FROM coaching.exercise WHERE id IN(263,431,525,577,762,841,1104,1150)
      AND skill_level IS NULL AND age_min IS NULL AND age_max IS NULL AND linked_skill_id IS NULL
      AND NOT is_published AND archived AND NOT why_publish_ready)<>8
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_safety_profile WHERE exercise_id=44
      AND minimum_skill_level IS NULL AND minimum_age_recommended IS NULL)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1 WHERE exercise_id=44
      AND technical_complexity=22 AND absolute_load_demand=32
      AND base_overall_difficulty=greatest(22,32) AND human_review_status='queued'
      AND reviewed_by IS NULL AND reviewed_at IS NULL) THEN
    RAISE EXCEPTION '% legacy projection or task-only difficulty assertion failed',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 WHERE id=canonical_definition
      AND (approved_video_url IS NOT NULL OR reviewed_by IS NOT NULL OR approved_by IS NOT NULL
        OR last_reviewed_at IS NOT NULL OR status='published'))
    OR EXISTS(SELECT 1 FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=canonical_definition AND review_status='candidate'
        AND (exact_variant_match IS NOT NULL OR demonstration_quality_score IS NOT NULL
          OR captions_available IS NOT NULL OR reviewer_user_id IS NOT NULL OR reviewed_at IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=exact_variant AND status='approved') THEN
    RAISE EXCEPTION '% fabricated participant classification approval or publication state detected',migration_key;
  END IF;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=canonical_definition AND status='quarantined' AND human_review_required
        AND jsonb_array_length(blocking_issues_json)=4
        AND (SELECT array_agg(item->>'code' ORDER BY item->>'code')
          FROM jsonb_array_elements(blocking_issues_json) item)
          =ARRAY['CARD-CALIBRATION-01','CARD-GRAPH-03','CARD-MEDIA-01','CARD-PUBLISH-01']::TEXT[]) THEN
    RAISE EXCEPTION '% test-packet blocker assertion failed',migration_key;
  END IF;
END
$migration$;
