-- Consolidate Cross-Crawl Dead Bug into the stable Dead Bug family and replace
-- generic source representations with exact review-only working specifications.
-- Research, media, graph, calibration, and publication records remain
-- candidate-only. No human approval or athlete proficiency is inferred.

DO $$
DECLARE
  migration_key CONSTANT TEXT := '470_coaching_dead_bug_family_audit_hardening';
  research_version CONSTANT TEXT := '2026-08-02.77';
  canonical_id UUID;
  cross_crawl_id UUID;
  affected_definition_ids UUID[];
  source_ids CONSTANT BIGINT[] := ARRAY[9,917];
  source_variant_ids UUID[];
  short_variant UUID := gen_random_uuid();
  long_variant UUID := gen_random_uuid();
  active_variant_ids UUID[];
  heel_tap_definition UUID;
  iso_press_definition UUID;
  wall_press_definition UUID;
  pullover_definition UUID;
  rotation_resist_definition UUID;
  eccentric_leg_lower_definition UUID;
  partner_press_definition UUID;
  neighbor_definition_ids UUID[];
  heel_tap_variant UUID;
  iso_press_variant UUID;
  current_video_ids CONSTANT TEXT[] := ARRAY[
    '0XVbn86Btj0','BZYaCzbP09M','UBa7wBucN-4','zechBkcIMf0'];
  protected_count INTEGER;
BEGIN
  SELECT definition_id INTO canonical_id FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=9;
  SELECT definition_id INTO cross_crawl_id FROM coaching.exercise_definition_source_v1 WHERE legacy_exercise_id=917;
  affected_definition_ids := ARRAY[canonical_id,cross_crawl_id];
  source_variant_ids := ARRAY[
    (SELECT id FROM coaching.exercise_variant_v1 WHERE definition_id=canonical_id AND variant_key='baseline'),
    (SELECT id FROM coaching.exercise_variant_v1 WHERE definition_id=cross_crawl_id AND variant_key='baseline')];
  active_variant_ids := ARRAY[short_variant,long_variant];
  SELECT id INTO heel_tap_definition FROM coaching.exercise_definition_v1 WHERE slug='dead-bug-heel-tap';
  SELECT id INTO iso_press_definition FROM coaching.exercise_definition_v1 WHERE slug='dead-bug-iso-press';
  SELECT id INTO wall_press_definition FROM coaching.exercise_definition_v1 WHERE slug='dead-bug-wall-press';
  SELECT id INTO pullover_definition FROM coaching.exercise_definition_v1 WHERE slug='dead-bug-pullover-band-dead-bug';
  SELECT id INTO rotation_resist_definition FROM coaching.exercise_definition_v1 WHERE slug='dead-bug-band-pulldown-with-rotation-resist';
  SELECT id INTO eccentric_leg_lower_definition FROM coaching.exercise_definition_v1 WHERE slug='eccentric-dead-bug-leg-lower';
  SELECT id INTO partner_press_definition FROM coaching.exercise_definition_v1 WHERE slug='partner-dead-bug-hand-press';
  neighbor_definition_ids := ARRAY[heel_tap_definition,iso_press_definition,wall_press_definition,pullover_definition,rotation_resist_definition,eccentric_leg_lower_definition,partner_press_definition];
  SELECT id INTO heel_tap_variant FROM coaching.exercise_variant_v1 WHERE definition_id=heel_tap_definition AND variant_key='baseline';
  SELECT id INTO iso_press_variant FROM coaching.exercise_variant_v1 WHERE definition_id=iso_press_definition AND variant_key='baseline';
  IF NOT EXISTS(
      SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_id AND slug='dead-bug' AND status<>'archived')
    OR NOT EXISTS(
      SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=cross_crawl_id)
    OR (SELECT count(*) FROM coaching.exercise_definition_source_v1
        WHERE legacy_exercise_id=ANY(source_ids))<>2
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
        WHERE id=ANY(source_variant_ids))<>2
    OR (SELECT count(*) FROM coaching.exercise_definition_v1
        WHERE id=ANY(neighbor_definition_ids) AND status<>'archived')<>7
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
        WHERE id=heel_tap_variant AND status<>'archived')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
        WHERE id=iso_press_variant AND status<>'archived') THEN
    RAISE EXCEPTION '% prerequisite Dead Bug identity state is missing or drifted',
      migration_key;
  END IF;

  IF EXISTS(
    SELECT 1 FROM coaching.exercise_variant_v1
    WHERE id=ANY(active_variant_ids) AND definition_id<>canonical_id
  ) THEN
    RAISE EXCEPTION '% working variant UUID is owned by another definition',
      migration_key;
  END IF;

  SELECT coalesce(sum(n),0) INTO protected_count FROM (
    SELECT count(*) n FROM coaching.exercise_definition_v1
      WHERE id=ANY(affected_definition_ids)
        AND (status IN('published','deprecated') OR reviewed_by IS NOT NULL
          OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)
    UNION ALL SELECT count(*) FROM coaching.exercise_section_evidence_v1
      WHERE definition_id=ANY(affected_definition_ids)
        AND (reviewer_user_id IS NOT NULL
          OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=ANY(affected_definition_ids)
        AND (reviewer_user_id IS NOT NULL OR reviewed_at IS NOT NULL
          OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id=ANY(affected_definition_ids)
        AND (reviewer_user_id IS NOT NULL
          OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_card_review_v1
      WHERE definition_id=ANY(affected_definition_ids)
    UNION ALL SELECT count(*) FROM coaching.exercise_card_revision_v1
      WHERE definition_id=ANY(affected_definition_ids)
    UNION ALL SELECT count(*) FROM coaching.exercise_media_review_v1
      WHERE definition_id=ANY(affected_definition_ids)
    UNION ALL SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=ANY(source_variant_ids||active_variant_ids)
        AND status IN('published','deprecated')
    UNION ALL SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE (from_variant_id=ANY(source_variant_ids||active_variant_ids)
          OR to_variant_id=ANY(source_variant_ids||active_variant_ids))
        AND (reviewed_by IS NOT NULL OR review_status IN('approved'))
    UNION ALL SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(source_variant_ids||active_variant_ids)
        AND (reviewed_by IS NOT NULL OR status='approved')
    UNION ALL SELECT count(*) FROM coaching.exercise_score_v1
      WHERE exercise_id=ANY(source_ids)
        AND (human_review_status<>'queued' OR reviewed_by IS NOT NULL
          OR reviewed_at IS NOT NULL)
  ) protected;
  IF protected_count<>0 THEN
    RAISE EXCEPTION '% refuses to replace % human-reviewed records',
      migration_key,protected_count;
  END IF;

  UPDATE coaching.exercise_section_evidence_v1
  SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
      updated_at=now()
  WHERE definition_id=ANY(affected_definition_ids)
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_media_candidate_v1
  SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
      exact_variant_match=NULL,demonstration_quality_score=NULL,
      updated_at=now()
  WHERE definition_id=ANY(affected_definition_ids)
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_alternate_assessment_v1
  SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
      updated_at=now()
  WHERE definition_id=ANY(affected_definition_ids)
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  DELETE FROM coaching.exercise_relationship_v1
  WHERE (from_variant_id=ANY(source_variant_ids||active_variant_ids)
      OR to_variant_id=ANY(source_variant_ids||active_variant_ids))
    AND reviewed_by IS NULL AND review_status<>'approved';
  DELETE FROM coaching.exercise_score_calibration_v1
  WHERE variant_id=ANY(source_variant_ids||active_variant_ids)
    AND reviewed_by IS NULL AND status<>'approved';

  UPDATE coaching.exercise_definition_source_v1
  SET definition_id=canonical_id,
      source_kind=CASE WHEN legacy_exercise_id=9
        THEN 'legacy_migration' ELSE 'duplicate_consolidation' END,
      provenance_json=coalesce(provenance_json,'{}'::JSONB)
        ||jsonb_build_object(
          'migration',migration_key,
          'sourceDisposition',CASE WHEN legacy_exercise_id=9
            THEN 'mapped_to_research_authored_working_specifications'
            ELSE 'duplicate_delivery_label_consolidated' END,
          'representedBySelectableSourceVariant',FALSE,
          'sourceMovementEvidence',CASE WHEN legacy_exercise_id=9
            THEN 'legacy_execution_states_opposite_arm_and_leg_reach'
            ELSE 'cross_crawl_name_and_summary_identify_contralateral_pattern_but_exact_limb_path_is_incomplete' END,
          'authoritativeSourceRecoveryRequired',legacy_exercise_id=917,
          'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=ANY(source_ids);

  UPDATE coaching.exercise_delivery_profile_v1
  SET status='archived',updated_at=now()
  WHERE variant_id=ANY(source_variant_ids);
  UPDATE coaching.exercise_variant_v1
  SET definition_id=canonical_id,
      variant_key='identity-quarantine-source-'
        ||(source_ids[array_position(source_variant_ids,id)])::TEXT,
      display_name='Dead Bug Identity Quarantine — Source '
        ||(source_ids[array_position(source_variant_ids,id)])::TEXT,
      modifier_keys='{}'::TEXT[],difficulty_json='{}'::JSONB,status='archived',
      requirements_json=jsonb_build_object(
        'selectable',FALSE,'representation','identity_quarantine',
        'sourceLegacyExerciseId',source_ids[array_position(source_variant_ids,id)],
        'archiveReason',CASE id
          WHEN source_variant_ids[1]
            THEN 'generic_source_variant_does_not_fix_lever_range_terminal_contact_tempo_dose_and_quality_termination'
          ELSE 'cross_crawl_source_variant_does_not_fix_single_or_opposite_limb_path_lever_range_terminal_contact_tempo_and_dose' END,
        'researchAuthoredReplacementRequired',TRUE,
        'humanReviewRequired',TRUE),
      load_profile_json=jsonb_build_object('selectable',FALSE),
      fatigue_profile_json=jsonb_build_object('selectable',FALSE),
      programming_profile_json=jsonb_build_object(
        'selectionStatus','identity_quarantine','selectable',FALSE,
        'publicationQuarantined',TRUE),updated_at=now()
  WHERE id=ANY(source_variant_ids);

  UPDATE coaching.exercise_definition_v1
  SET status='archived',approved_video_url=NULL,reviewed_by=NULL,
      approved_by=NULL,last_reviewed_at=NULL,
      provenance_json=coalesce(provenance_json,'{}'::JSONB)
        ||jsonb_build_object(
          'deadBugAuditHardeningMigration',migration_key,
          'identityResolution','duplicate_consolidated',
          'canonicalSurvivorDefinitionId',canonical_id,'selectable',FALSE,
          'humanReviewRequired',TRUE,'approvalsCreated',FALSE),updated_at=now()
  WHERE id=cross_crawl_id;

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by,resolved_at)
  VALUES(1,canonical_id,cross_crawl_id,'duplicate_consolidated',
    'Cross-Crawl Dead Bug and Dead Bug both use supine contralateral arm-and-leg motion under a quiet rib-pelvis anti-extension contract. Cross-crawl and neural activation describe delivery emphasis; lever, range, terminal contact, tempo, breathing, dose, and reset belong to exact variants or delivery profiles.',
    jsonb_build_object(
      'migration',migration_key,
      'identityBoundary','supine_contralateral_dead_bug_same_identity',
      'deliveryDimensions',jsonb_build_array(
        'session_phase','neural_emphasis','tempo','cueing','dose','rest'),
      'variantDimensions',jsonb_build_array(
        'limb_action','lever','range','terminal_contact','breathing'),
      'source917ExactPathIncomplete',TRUE,'humanReviewRequired',TRUE,
      'approvalsCreated',FALSE,
      'decisionScope','identity_and_traceability_only'),
    'deterministic_exact_identity',NULL,now())
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,
    resolved_at=now();

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by,resolved_at)
  SELECT 1,canonical_id,boundary.definition_id,'distinct_exercises',
    boundary.rationale,
    jsonb_build_object(
      'migration',migration_key,'identityBoundary',boundary.boundary_key,
      'baseContract','alternating_contralateral_arm_and_leg_reach',
      'neighborContract',boundary.neighbor_contract,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,
      'decisionScope','identity_only_neighbor_canonical_audit_still_required'),
    'deterministic_identity_equivalence',NULL,now()
  FROM (VALUES
    (heel_tap_definition,
      'contralateral_arm_leg_reach_vs_legs_only_heel_tap',
      'Dead Bug Heel Tap keeps the arms fixed and alternates a legs-only terminal heel contact; the base Dead Bug moves the opposite arm and leg together.',
      'arms_fixed_alternating_leg_heel_tap'),
    (iso_press_definition,
      'dynamic_contralateral_reach_vs_hand_knee_or_ball_isometric_press',
      'Dead Bug Iso Press creates hand-to-knee or ball compression without the base card''s alternating arm-and-leg reach.',
      'supine_hand_knee_or_ball_isometric_compression'),
    (wall_press_definition,
      'free_arm_reach_vs_fixed_bilateral_wall_press',
      'Dead Bug Wall Press fixes both hands against a wall while a declared leg moves; the base card alternates a free arm with the opposite leg.',
      'fixed_bilateral_wall_press_with_declared_leg_action'),
    (pullover_definition,
      'unloaded_alternating_contralateral_reach_vs_loaded_bilateral_pullover',
      'Dead Bug Pullover moves a declared external resistance bilaterally through an overhead path; implement handling and bilateral arm action change identity.',
      'loaded_bilateral_pullover_with_declared_leg_action'),
    (rotation_resist_definition,
      'sagittal_anti_extension_vs_band_pulldown_anti_rotation',
      'The band-pulldown card adds external asymmetric force and explicit rotation resistance that the unloaded base card does not contain.',
      'band_pulldown_with_external_anti_rotation_force'),
    (eccentric_leg_lower_definition,
      'alternating_opposite_limbs_vs_legs_only_slow_eccentric_lower',
      'The eccentric leg-lower card removes alternating arm motion and makes a prescribed slow negative leg-lowering action the primary task.',
      'legs_only_prescribed_slow_eccentric_lower'),
    (partner_press_definition,
      'free_contralateral_reach_vs_external_partner_hand_press',
      'Partner Dead Bug Hand Press adds external partner contact and isometric hand force rather than the base free-arm reach.',
      'external_partner_hand_press_isometric')
  ) boundary(definition_id,boundary_key,rationale,neighbor_contract)
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,
    resolved_at=now();

  UPDATE coaching.exercise_definition_v1 SET
    canonical_name='Alternating Contralateral Dead Bug',display_name='Dead Bug',
    aliases=ARRAY[
      'Alternating Dead Bug','Contralateral Dead Bug','Cross Crawl Dead Bug',
      'Cross-Crawl Dead Bug','Dead Bugs','Dying Bug','Opposite Arm and Leg Dead Bug']::TEXT[],
    description='From a supine tabletop start, one straight arm and the opposite leg move away from the trunk together through a declared lever and range while the pelvis, lumbar region, and rib cage remain quiet and breathing continues. The limbs return to the same start before alternating sides. Every selectable variant fixes knee lever, terminal contact or hover, tempo, range, breathing, repetition boundary, and quality stop.',
    family_key='supine_alternating_contralateral_anti_extension',
    schema_version='2.0.0',card_version=2,status='review',
    content_confidence=90,scoring_confidence=70,media_confidence=52,
    movement_patterns=ARRAY['brace','reach']::TEXT[],
    body_regions=ARRAY[
      'core','spine','rib_cage','pelvis','hip','knee','shoulder']::TEXT[],
    required_equipment=ARRAY['none']::TEXT[],
    optional_equipment=ARRAY['mat','mirror']::TEXT[],
    anatomy_json=jsonb_build_object(
      'primaryMuscles',jsonb_build_array(
        'rectus_abdominis','external_oblique','internal_oblique'),
      'secondaryMuscles',jsonb_build_array(
        'transversus_abdominis','iliopsoas','rectus_femoris',
        'anterior_deltoid','serratus_anterior','latissimus_dorsi'),
      'stabilizers',jsonb_build_array(
        'diaphragm','pelvic_floor','multifidus','gluteus_maximus',
        'deep_spinal_stabilizers'),
      'joints',jsonb_build_array(
        'glenohumeral_joint','scapulothoracic_articulation','spine',
        'lumbosacral_complex','pelvis','hip','knee'),
      'jointActions',jsonb_build_array(
        'spinal_anti_extension','pelvic_anti_anterior_tilt',
        'rib_pelvis_isometric_control','alternating_shoulder_flexion_overhead',
        'alternating_hip_extension','variant_declared_knee_extension',
        'controlled_shoulder_hip_and_knee_return'),
      'jointActionPhases',jsonb_build_object(
        'setup',jsonb_build_array(
          'supine_tabletop','arms_vertical','declared_rib_pelvis_position'),
        'reach',jsonb_build_array(
          'one_arm_overhead','opposite_hip_extension',
          'variant_declared_knee_action','trunk_resists_extension_and_rotation'),
        'return',jsonb_build_array(
          'same_arm_and_leg_return_to_tabletop','breath_and_position_reset'),
        'alternate','opposite_pair_only_after_same_start_is_restored'),
      'planes',jsonb_build_array('sagittal'),
      'laterality','contralateral',
      'evidenceLimit','Surface EMG in small healthy samples describes activation during tested methods and speeds; it does not establish muscle force, adaptation, treatment efficacy, one universal posture, dose, safety threshold, or readiness rule.'),
    environment_json=jsonb_build_object(
      'surface','level_dry_stable_floor_with_optional_mat',
      'clearance',jsonb_build_array(
        'full_body_length','both_arm_and_leg_reach_paths',
        'no_cross_traffic','coach_side_view'),
      'station','one_supine_lane_per_athlete',
      'visualReference','optional_side_view_mirror_or_coach',
      'changeRule','Wall support, external load, partner contact, unstable support, or asymmetric resistance requires a separately reviewed variant or definition.'),
    population_json=jsonb_build_object(
      'defaultPopulation','participants_who_can_tolerate_supine_tabletop_and_move_opposite_limbs_without_symptoms_or_trunk_motion',
      'individualizationRequired',TRUE,
      'prerequisites',jsonb_build_array(
        'pain_free_supine_position','comfortable_tabletop_start',
        'can_breathe_without_bearing_down_or_rib_flare',
        'can_return_one_limb_pair_to_the_same_start',
        'can_report_symptoms_and_uncertainty'),
      'cautions',jsonb_build_array(
        'current_or_recent_neck_spine_hip_knee_or_shoulder_symptoms',
        'neurologic_symptoms_or_uncontrolled_dizziness',
        'pressure_symptoms_coning_doming_or_pelvic_floor_concern',
        'pregnancy_or_postpartum_status_requiring_supine_or_pressure_individualization',
        'recent_high_volume_trunk_hip_flexor_or_overhead_training',
        'unsafe_floor_space_or_inability_to_get_to_and_from_the_floor'),
      'notClinicalClearance',TRUE,
      'neverInferReadinessFromExerciseDifficulty',TRUE),
    athlete_support_json=jsonb_build_object(
      'whyItMatters','This drill teaches the trunk to stay quiet while opposite limbs create leverage. The goal is repeatable coordination and position, not exhaustion or forcing the back into the floor.',
      'primaryCue','Reach one arm and the opposite leg away, keep ribs and pelvis quiet, breathe, return to the same start, then switch.',
      'before',jsonb_build_array(
        'Confirm bent-knee heel tap or long-lever hover, range, tempo, repetitions per side, rest, and stop signal.',
        'Check floor space and optional mat; report pain, dizziness, pressure symptoms, or difficulty with supine positioning.',
        'Practice one return to the same tabletop start before counting repetitions.'),
      'during',jsonb_build_array(
        'Move only the assigned opposite arm and leg.',
        'Use the assigned heel contact or hover; do not silently shorten or lengthen the lever.',
        'Keep the trunk quiet and breathe through the reach and return.',
        'Finish the return before alternating.'),
      'expectedSensations',jsonb_build_array(
        'abdominal_wall_tension','controlled_hip_flexor_effort',
        'shoulder_reach_without_pinch','cross_body_coordination_demand'),
      'unexpectedSensations',jsonb_build_array(
        'sharp_or_increasing_pain','numbness_or_tingling',
        'dizziness_or_nausea','neck_or_low_back_pressure',
        'pelvic_floor_pressure_leakage_coning_or_doming',
        'breath_lock_or_panic_bracing'),
      'painGuidance','Return both limbs to tabletop, place the feet down, stop the set, and tell the coach. Do not push farther or retry automatically.',
      'selfChecks',jsonb_build_array(
        'same_tabletop_start_before_each_side','opposite_arm_and_leg_only',
        'assigned_terminal_contact_or_hover','quiet_ribs_pelvis_and_low_back',
        'continuous_breathing','controlled_return_without_momentum'),
      'accessibility',jsonb_build_array(
        'smaller_owned_range','bent_knee_heel_tap_variant','one_limb_rehearsal',
        'feet_supported_between_repetitions','fewer_repetitions','longer_rest',
        'written_or_live_nonvideo_instruction'),
      'mediaAlternatives',jsonb_build_array(
        'written_setup_reach_return_sequence','side_view_still_sequence',
        'coach_live_demonstration','visual_or_tactile_reach_targets_with_consent'),
      'stopSignal','Say stop, return to tabletop, place both feet down, and report what changed.'),
    coach_support_json=jsonb_build_object(
      'observationChecklist',jsonb_build_array(
        'exact_variant_start_range_tempo_and_side_order',
        'opposite_arm_and_leg_move_together',
        'rib_pelvis_lumbar_and_head_position','shoulder_hip_knee_path',
        'terminal_heel_contact_or_hover','breathing_symptoms_return_and_reset'),
      'faultCorrections',jsonb_build_object(
        'lumbar_extension_or_rib_flare','shorten_range_or_use_bent_knee_variant',
        'pelvis_rotates_or_shifts','slow_the_pair_and_reduce_lever',
        'same_side_or_wrong_limbs_move','stop_rehearse_one_opposite_pair_then_restart',
        'heel_or_leg_drops','raise_target_and_reduce_range',
        'shoulder_pinch_or_shrug','reduce_arm_range_or_use_one_limb_rehearsal',
        'breath_lock_or_pressure_symptom','end_set_and_reassess'),
      'demonstrationPlan',jsonb_build_array(
        'show_tabletop_and_vertical_arm_start','show_one_exact_opposite_pair',
        'show_variant_terminal heel contact or hover',
        'show_full_return_before_alternating',
        'show_first_trunk_or_breathing_break_and safe stop'),
      'groupManagement',jsonb_build_array(
        'one_athlete_per_clear_supine_lane','stagger_starts_for_side_view',
        'declare starting pair and cadence before the set',
        'record each side separately and count failed attempts as exposure'),
      'modificationDecisionTree',jsonb_build_array(
        'symptom_pressure_dizziness_or_neurologic_sign_stop_and_escalate',
        'wrong_or_unknown_limb_contract_quarantine_selection',
        'trunk_motion_reduce_range_lever_or_use_one_limb_rehearsal',
        'floor_access_issue_select_a_reviewed_nonfloor_substitution',
        'recompute_duration_fatigue_and_rendering_after_every_change'),
      'doNotUseWhen',jsonb_build_array(
        'supine_or_tabletop_position_is_not_tolerated',
        'pain_pressure_dizziness_or_neurologic_symptoms_are_present',
        'opposite_limb_contract_cannot_be_understood_or_observed',
        'safe_floor_access_space_or_exit_is_unavailable',
        'fatigue_prevents_a_repeatable_start_and_return'),
      'validRepetition','The assigned opposite pair, lever, range, terminal condition, tempo, breathing, quiet trunk, controlled return, and full reset all pass.'),
    support_operations_json=jsonb_build_object(
      'issueCategories',jsonb_build_array(
        'identity_or_variant_mismatch','unsafe_floor_or_space',
        'pain_pressure_dizziness_or_neurologic_symptom',
        'coordination_position_breathing_or_return_failure',
        'dose_duration_fatigue_or_recovery_mismatch',
        'broken_inaccessible_or_mismatched_media'),
      'supportEscalation',jsonb_build_object(
        'safety','remove_from_selection_and_alert_coach_or_library_owner',
        'identity','quarantine_and_route_to_canonical_identity_review',
        'symptoms','stop_session_exposure_and_follow_facility_health_protocol',
        'doseOrFatigue','route_to_programming_review_before_reuse',
        'media','quarantine_candidate_and_schedule_re_review'),
      'retentionPolicy',jsonb_build_object(
        'attemptAndDoseRecord','retain_with_saved_workout_version',
        'symptomAndIncidentRecord','facility_health_and_incident_policy',
        'athleteFeedbackDays',365,
        'mediaReview','retain_reviewer_timestamp_card_version_and_decision'),
      'changeImpactPolicy',jsonb_build_object(
        'identityOrSafetyChange','invalidate_release_and_revalidate_saved_workouts',
        'variantScoreOrDoseChange','recompute_selection_fatigue_duration_and_substitutions',
        'instructionChange','increment_card_version_and_recheck_media',
        'mediaChange','invalidate_media_review_only',
        'relationshipChange','revalidate_substitution_and_progression_paths'),
      'generationRecords',jsonb_build_array(
        'definition_id','variant_id','profile_key','starting_pair',
        'lever_range_terminal_condition_tempo_breathing',
        'planned_completed_failed_repetitions_each_side','rest_duration',
        'first_quality_break_symptoms_stop_reason_substitution'),
      'publicationQuarantined',TRUE,'mediaReviewRequired',TRUE,
      'relationshipReviewRequired',TRUE,'calibrationReviewRequired',TRUE),
    provenance_json=coalesce(provenance_json,'{}'::JSONB)
      ||jsonb_build_object(
        'deadBugAuditHardeningMigration',migration_key,
        'researchVersion',research_version,'canonicalAuthoredFromResearch',TRUE,
        'legacySources',source_ids,
        'consolidatedDefinitionIds',jsonb_build_array(cross_crawl_id),
        'activeWorkingSpecifications',jsonb_build_array(
          'bent-knee-contralateral-arm-heel-tap',
          'long-lever-contralateral-arm-leg-hover'),
        'researchSources',jsonb_build_array(
          'https://www.nasm.org/resource-center/exercise-library/dead-bug',
          'https://pubmed.ncbi.nlm.nih.gov/11689975/',
          'https://doi.org/10.14474/ptrs.2017.6.1.1'),
        'mediaState','four_current_oembed_healthy_candidates_unreviewed',
        'oembedCheckedAt','2026-08-02',
        'difficultyModel','exercise_complexity_and_physical_difficulty_only',
        'researchLimits','acute_emg_small_healthy_samples_no_universal_dose_or_outcome_claim',
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE,
        'publicationQuarantined',TRUE),
    approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,
    last_reviewed_at=NULL,updated_at=now()
  WHERE id=canonical_id;

  INSERT INTO coaching.exercise_variant_v1(
    id,definition_id,variant_key,display_name,modifier_keys,difficulty_json,
    requirements_json,status,load_profile_json,fatigue_profile_json,
    programming_profile_json)
  SELECT v.id,canonical_id,v.variant_key,v.display_name,v.modifiers,
    jsonb_build_object(
      'technicalComplexity',v.complexity,
      'absoluteLoadDemand',v.physical,
      'relativeStrengthDemand',v.relative_strength,
      'mobilityDemand',v.mobility,'balanceDemand',1,
      'stabilityDemand',v.stability,'coordinationDemand',v.coordination,
      'speedDemand',8,'decisionDemand',6,
      'workCapacityDemand',v.work_capacity,'impact',1,
      'eccentricTissueStress',v.eccentric,'jointStress',v.joint_stress,
      'spinalLoading',v.spinal_loading,'gripDemand',1,
      'inversionDemand',1,'fearConfidenceBarrier',v.fear,
      'supervisionDemand',v.supervision,'spottingDemand',1,
      'failureConsequence',v.failure,
      'baseOverallDifficulty',greatest(v.complexity,v.physical),
      'technicalMeaning','exercise_complexity',
      'loadMeaning','physical_difficulty',
      'overallFormula','max(exercise_complexity,physical_difficulty)',
      'scoreState','review_only_requires_independent_calibration'),
    jsonb_build_object(
      'start','supine_tabletop_hips_and_knees_at_ninety_degrees_arms_vertical',
      'movingPair','one_straight_arm_and_opposite_leg',
      'kneeAction',v.knee_action,'terminalCondition',v.terminal_condition,
      'range',v.range_contract,'tempo','profile_declared_controlled',
      'trunkContract','quiet_ribs_pelvis_and_lumbar_region',
      'breathing','continuous_without_bearing_down',
      'return','same_tabletop_start_before_alternating',
      'selectable',TRUE,'identityQuarantine',FALSE,
      'workingSpecificationRequiresHumanReview',TRUE),
    'review',
    jsonb_build_object(
      'gripDemand',1,'externalLoadMethod','bodyweight',
      'externalLoadDescription','Bodyweight limb leverage only; no implement, wall force, partner force, or band resistance is part of this variant.',
      'spinalLoading',v.spinal_loading,'eccentricStress',v.eccentric,
      'landingContactsPerRep',0,'impactClass','none',
      'effectiveLoadDrivers',jsonb_build_array(
        'arm_and_leg_segment_mass','hip_and_knee_lever','reach_range',
        'terminal_height_or_contact','tempo','breathing','prior_trunk_fatigue'),
      'loadTracking',jsonb_build_array(
        'exact_variant','lever','range','terminal_condition','tempo',
        'repetitions_each_side','failed_attempts','same_session_trunk_and_hip_flexor_work')),
    jsonb_build_object(
      'localMuscleFatigue',v.local_fatigue,'gripFatigue',1,
      'technicalFatigueSensitivity',v.technical_fatigue,
      'impactAccumulation',1,'recoveryHours',12,
      'recoveryWindow','typically_6_to_24_hours_context_novelty_volume_and_symptom_dependent',
      'primaryFatigueSites',jsonb_build_array(
        'abdominal_wall','hip_flexors','shoulder_flexors'),
      'earlyFatigueSignals',jsonb_build_array(
        'rib_flare_or_lumbar_extension','pelvic_rotation_or_shift',
        'wrong_limb_pair_or_timing','range_shortening_or_leg_drop',
        'momentum_or_incomplete_return','breath_lock'),
      'downstreamConflicts',jsonb_build_array(
        'priority_trunk_control_or_gymnastics_shape_work',
        'high_volume_hip_flexor_or_abdominal_training',
        'symptomatic_spine_hip_shoulder_or_pressure_loading')),
    jsonb_build_object(
      'trainingStimuli',v.stimuli,
      'stimulusDose',jsonb_build_object(
        'primary','quality_repetitions_each_side',
        'countFailedAttemptsAsExposure',TRUE,
        'fatigueCeiling','low_to_moderate'),
      'weeklyExposure','Combine valid and failed repetitions with hollow holds, leg lowers, loaded pullovers, wall presses, trunk anti-extension, hip-flexor work, and sport shape training.',
      'prerequisites',jsonb_build_array(
        'pain_free_supine_tabletop','exact_variant_understood',
        'opposite_pair_can_return_to_same_start','continuous_breathing'),
      'completionCriteria',jsonb_build_array(
        'exact_opposite_pair_lever_range_terminal_condition_and_tempo',
        'quiet_trunk_and_continuous_breathing',
        'controlled_return_before_alternating',
        'dose_fault_symptom_duration_and_recovery_recorded'),
      'sequenceRules',jsonb_build_array(
        'use_after_specific_floor_access_and_breathing_preparation',
        'place_before_fatiguing_trunk_hip_flexor_or_shape_work_when_quality_is_priority',
        'do_not_use_as_unplanned_speed_conditioning',
        'stop_before_position_or_coordination_failure'),
      'pairingCompatibility',jsonb_build_array(
        'noncompeting_lower_body_mobility','low_demand_upper_body_access'),
      'interferenceRules',jsonb_build_array(
        'do_not_prefatigue_abdominals_or_hip_flexors_before_quality_repetitions',
        'do_not_silently_change_to_heel_tap_only_wall_press_pullover_or_iso_press',
        'recompute_identity_fatigue_duration_and_rendering_after_substitution'),
      'uncertaintyPolicy',jsonb_build_object(
        'unknownLimbActionLeverRangeTerminalConditionOrSymptoms',
          'fail_closed_and_request_coach_review',
        'neverInferMissingMechanicsFromNameOrVideoTitle',TRUE,
        'neverAutoApproveMediaGraphCalibrationOrPublication',TRUE),
      'cumulativeBudget',jsonb_build_object(
        'contralateralRepetitionsEachSide',v.rep_budget,
        'antiExtensionSecondsEstimate',v.seconds_budget,
        'failedAttemptsCount',TRUE,
        'sameSessionTrunkHipFlexorAndShapeWorkRequired',TRUE))
  FROM (VALUES
    (short_variant,'bent-knee-contralateral-arm-heel-tap',
      'Dead Bug — Bent-Knee Contralateral Arm and Heel Tap',
      ARRAY['bent_knee','heel_tap','contralateral','bodyweight']::TEXT[],
      34,24,22,24,38,42,28,12,18,22,18,16,20,36,28,
      'bent_knee_maintained','opposite_heel_touches_assigned_floor_target_lightly',
      'arm_to_owned_overhead_target_and_opposite_heel_to_floor_without_resting',
      jsonb_build_array('short_lever_contralateral_coordination','anti_extension_position_control','breathing_with_limb_motion'),
      24,180),
    (long_variant,'long-lever-contralateral-arm-leg-hover',
      'Dead Bug — Long-Lever Contralateral Arm and Leg Hover',
      ARRAY['long_lever','hover','contralateral','bodyweight']::TEXT[],
      42,38,34,34,52,54,38,22,28,36,26,24,28,48,42,
      'knee_extends_to_declared_long_lever','opposite_straight_leg_hovers_above_floor_without_contact',
      'arm_and_opposite_long_leg_reach_to_individually_owned_targets_without_trunk_motion',
      jsonb_build_array('long_lever_contralateral_coordination','higher_anti_extension_lever_demand','breathing_with_full_limb_reach'),
      20,200)
  ) v(id,variant_key,display_name,modifiers,complexity,physical,
      relative_strength,mobility,stability,coordination,work_capacity,
      eccentric,joint_stress,spinal_loading,fear,supervision,failure,
      local_fatigue,technical_fatigue,knee_action,terminal_condition,
      range_contract,stimuli,rep_budget,seconds_budget)
  ON CONFLICT(id) DO UPDATE SET definition_id=EXCLUDED.definition_id,
    variant_key=EXCLUDED.variant_key,display_name=EXCLUDED.display_name,
    modifier_keys=EXCLUDED.modifier_keys,difficulty_json=EXCLUDED.difficulty_json,
    requirements_json=EXCLUDED.requirements_json,status='review',
    load_profile_json=EXCLUDED.load_profile_json,
    fatigue_profile_json=EXCLUDED.fatigue_profile_json,
    programming_profile_json=EXCLUDED.programming_profile_json,updated_at=now();

  INSERT INTO coaching.exercise_delivery_profile_v1(
    variant_id,profile_key,phase_key,role,purpose,phase_suitability,
    methodology_alignment,objective_relevance_json,dosage_json,quality_gate,
    stop_rules,coach_instructions,athlete_instructions,expected_adaptation,
    equipment_required,logistics_json,substitution_ids,status,time_model_json,
    dose_scaling_json,measurement_json,support_prompts_json)
  SELECT profile.variant_id,profile.profile_key,profile.phase_key,profile.role,
    profile.purpose,profile.suitability,92,
    jsonb_build_object(
      'contralateralCoordination',5,'trunkAntiExtensionControl',5,
      'breathingAndPosition',5,'strengthHypertrophyClaim',0,
      'fatigueConditioning',CASE profile.phase_key
        WHEN 'resilience' THEN 2 ELSE 1 END),
    jsonb_build_object(
      'doseType','repetitions_each_side','sets',profile.sets,
      'repetitionsEachSide',profile.reps_each_side,
      'restSeconds',profile.rest_seconds,
      'tempo',profile.tempo,'range','exact_variant_owned_range',
      'qualityTerminated',TRUE,'countFailedAttemptsAsExposure',TRUE,
      'evidenceStatus','provisional_coaching_dose_not_a_research_prescription'),
    'Every counted repetition uses the assigned opposite arm and leg, lever, range, heel contact or hover, tempo, and breathing; the trunk stays quiet, the limbs return to the same tabletop start, and no stop rule occurs.',
    ARRAY[
      'sharp_or_increasing_pain_pressure_numbness_tingling_dizziness_nausea_or_fear',
      'wrong_or_unknown_variant_limb_pair_lever_range_terminal_condition_tempo_or_side_order',
      'floor_mat_space_or_exit_becomes_unsafe_or_obstructed',
      'ribs_flare_lumbar_region_extends_or_pelvis_rotates_shifts_or_lifts',
      'wrong_same_side_or_extra_limb_moves',
      'assigned_heel_contact_or_hover_cannot_be_controlled',
      'shoulder_shrugs_pinches_or_arm_path_changes',
      'breath_lock_bearing_down_coning_doming_or_pressure_symptom_appears',
      'momentum_leg_drop_incomplete_return_or_missing_tabletop_reset_appears',
      'planned_repetitions_duration_or_cumulative_trunk_budget_is_reached'],
    profile.coach_instructions,profile.athlete_instructions,
    profile.expected_adaptation,ARRAY['none']::TEXT[],
    jsonb_build_object(
      'athletesPerStation',1,'setupSeconds',25,'transitionSeconds',15,
      'station','one_clear_stable_supine_lane_per_athlete',
      'equipmentCheck','dry_floor_optional_mat_and_clear_limb_paths',
      'coachPosition','side_view_outside_arm_and_leg_paths',
      'changeRule','coach_rechecks_identity_and_recomputes_dose_fatigue_duration_and_rendering',
      'substitutionRevalidation',jsonb_build_array(
        'identity','limb_action','lever','range','terminal_condition',
        'tempo','breathing','population','dose','fatigue','duration','rendering')),
    CASE profile.variant_id
      WHEN short_variant THEN ARRAY[long_variant,heel_tap_variant,iso_press_variant]::UUID[]
      ELSE ARRAY[short_variant,heel_tap_variant,iso_press_variant]::UUID[] END,
    'review',
    jsonb_build_object(
      'setupSeconds',25,
      'repetitionSeconds',CASE profile.variant_id
        WHEN short_variant THEN 6 ELSE 8 END,
      'resetSeconds',2,'transitionSeconds',15,'durationIncludesRest',TRUE,
      'durationFormula','setup + sets * (repetitions_each_side * 2 * (repetition + reset)) + inter_set_rest + transition',
      'durationCeilingSeconds',profile.duration_ceiling,
      'recomputeAfterSubstitution',TRUE),
    jsonb_build_object(
      'reduce',jsonb_build_array(
        'reduce_range','use_bent_knee_heel_tap','rehearse_one_limb',
        'reduce_repetitions','increase_rest'),
      'increase',jsonb_build_array(
        'increase_owned_range_within_same_variant','slow_tempo',
        'add_one_repetition_each_side_within_budget',
        'use_long_lever_only_after_review'),
      'changeOneVariableAtATime',TRUE,'revalidateAfterChange',TRUE,
      'symptomRule','stop_and_select_reviewed_pain_free_alternative'),
    jsonb_build_object(
      'record',jsonb_build_array(
        'definition_id','variant_id','profile_key','starting_pair',
        'lever_range_terminal_condition_tempo_breathing',
        'planned_completed_and_failed_repetitions_each_side',
        'first_position_coordination_or_breathing_break',
        'rest_duration_symptoms_stop_reason_and_substitution'),
      'comparisonRule','Compare only when variant, lever, range, terminal condition, tempo, breathing, side order, and measurement method match.',
      'validity','all exact identity position breathing dose symptom duration and return gates pass'),
    jsonb_build_object(
      'before','Which exact variant, starting pair, range, tempo, repetitions per side, rest, and stop signal are assigned?',
      'during','Are the correct opposite limbs moving while ribs, pelvis, breathing, terminal target, return, and side order still match?',
      'after','Store completed and failed repetitions each side, first break, symptoms, duration, rest, and substitution.',
      'supportEscalation','Escalate symptoms, identity mismatch, inaccessible instruction, or media mismatch through the documented support path.',
      'mediaFallback','Use the written contract and qualified live demonstration until an exact video is independently approved.')
  FROM (VALUES
    (short_variant,'prepare-contralateral-rehearsal','prepare_and_access','secondary',
      'Rehearse the exact opposite-limb sequence and breathing with minimal fatigue before higher-priority work.',92,1,3,20,'three_second_reach_three_second_return',420,
      'Confirm bent knees, vertical arms, assigned starting pair, light heel target, quiet trunk, breathing, full return, and low fatigue. Stop rather than adding speed.',
      'Reach one arm and the opposite heel for three slow repetitions each side. Keep the trunk quiet, breathe, and return fully before switching.',
      'Cleaner contralateral timing and trunk organization without meaningful fatigue.'),
    (short_variant,'movement-intelligence-short-lever','movement_intelligence','primary',
      'Develop repeatable contralateral coordination, heel-target accuracy, breathing, and trunk control.',96,2,5,35,'three_second_reach_three_second_return',620,
      'Observe exact opposite-pair timing and heel contact. End on the first lumbar, pelvic, breathing, range, or return error.',
      'Tap the opposite heel lightly, return to the same tabletop, then switch. Every repetition should match.',
      'More repeatable short-lever opposite-limb coordination and position control.'),
    (short_variant,'resilience-short-lever-control','resilience','primary',
      'Accumulate quality short-lever anti-extension repetitions with complete side and fatigue accounting.',90,3,6,50,'controlled_three_second_reach_and_return',820,
      'Keep volume submaximal. Count failed attempts, compare both sides, and stop before the athlete changes limb path, trunk position, or breathing.',
      'Complete up to six controlled repetitions each side. Stop before the trunk moves or the heel drops.',
      'Improved repeatability of short-lever anti-extension control under modest volume.'),
    (long_variant,'prepare-long-lever-rehearsal','prepare_and_access','conditional',
      'Rehearse the long-lever opposite-limb path only when it can remain low fatigue and fully controlled.',82,1,2,30,'four_second_reach_four_second_return',440,
      'Verify the athlete already owns the short-lever sequence. Use a high hover target and stop immediately if the trunk or breathing changes.',
      'Reach one arm and the opposite long leg only to the height you can own. Return fully, breathe, and switch.',
      'Familiarity with the long-lever path without pre-fatiguing priority work.'),
    (long_variant,'movement-intelligence-long-lever','movement_intelligence','primary',
      'Develop accurate long-lever contralateral coordination, range control, and return timing.',94,2,4,45,'four_second_reach_four_second_return',680,
      'Record the hover height and range. Stop for any leg drop, pelvic shift, rib flare, breath lock, momentum, or incomplete return.',
      'Reach the opposite arm and long leg to the recorded targets, hover, return to tabletop, then switch.',
      'More repeatable long-lever opposite-limb coordination and anti-extension control.'),
    (long_variant,'resilience-long-lever-control','resilience','primary',
      'Accumulate fully controlled long-lever anti-extension repetitions without treating failure or speed as progress.',88,3,5,60,'controlled_four_second_reach_and_return',900,
      'Use full rest, cap repetitions, count every failed attempt, and combine exposure with other trunk, hip-flexor, hollow, pullover, and leg-lower work.',
      'Complete up to five long-lever repetitions each side. Keep the same hover, trunk position, breathing, and return every time.',
      'Improved long-lever trunk-control repeatability under a quality-terminated dose.')
  ) profile(variant_id,profile_key,phase_key,role,purpose,suitability,
      sets,reps_each_side,rest_seconds,tempo,duration_ceiling,
      coach_instructions,athlete_instructions,expected_adaptation)
  ON CONFLICT(variant_id,profile_key) DO UPDATE SET
    phase_key=EXCLUDED.phase_key,role=EXCLUDED.role,purpose=EXCLUDED.purpose,
    phase_suitability=EXCLUDED.phase_suitability,
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

  INSERT INTO coaching.exercise_section_evidence_v1(
    definition_id,reviewed_card_version,section_key,source_url,source_title,
    source_publisher,source_kind,claims_json,evidence_quality,review_status,
    reviewer_user_id,reviewed_at)
  SELECT canonical_id,2,e.section_key,e.source_url,e.source_title,
    e.source_publisher,e.source_kind,
    e.claims||jsonb_build_array(jsonb_build_object(
      'migration',migration_key,'researchVersion',research_version,
      'limitations','Evidence does not establish one universal posture, identity, dose, safety threshold, readiness rule, treatment effect, athletic transfer, or publication approval for an individual card.',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE)),
    e.quality,'candidate',NULL,NULL
  FROM (VALUES
    ('identity','https://www.nasm.org/resource-center/exercise-library/dead-bug',
      'Dead Bug','National Academy of Sports Medicine','professional_standard',80,
      jsonb_build_array(jsonb_build_object(
        'claim','The professional instruction describes a supine tabletop start and lowering the opposite arm and leg without allowing the back to arch.','limits','Professional instruction, not comparative outcome evidence.'))),
    ('taxonomy','https://doi.org/10.14474/ptrs.2017.6.1.1',
      'Changes in muscle activity of the abdominal muscles according to exercise method and speed during dead bug exercise','Physical Therapy Rehabilitation Science','peer_reviewed_research',82,
      jsonb_build_array(jsonb_build_object(
        'claim','The study tested upper-extremity-only, lower-extremity-only, and combined upper-and-lower-extremity dead-bug methods at separately prescribed speeds.','sample','30 healthy adults','limits','Method categories require exact limb and speed labels.'))),
    ('anatomy','https://pubmed.ncbi.nlm.nih.gov/11689975/',
      'Electromyographic activity of selected trunk muscles during dynamic spine stabilization exercises','Archives of Physical Medicine and Rehabilitation','peer_reviewed_research',86,
      jsonb_build_array(jsonb_build_object(
        'claim','Rectus abdominis and abdominal-oblique activity was recorded during progressively harder Dying Bug levels.','sample','12 healthy participants','limits','Surface EMG did not measure every listed stabilizer or prove adaptation.'))),
    ('biomechanics','https://doi.org/10.14474/ptrs.2017.6.1.1',
      'Changes in muscle activity of the abdominal muscles according to exercise method and speed during dead bug exercise','Physical Therapy Rehabilitation Science','peer_reviewed_research',82,
      jsonb_build_array(jsonb_build_object(
        'claim','Combined upper-and-lower-limb motion produced greater measured abdominal activation than upper-only or lower-only methods in the tested protocol.','limits','Activation is not force, load, safety, or long-term adaptation.'))),
    ('difficulty','https://pubmed.ncbi.nlm.nih.gov/11689975/',
      'Electromyographic activity of selected trunk muscles during dynamic spine stabilization exercises','Archives of Physical Medicine and Rehabilitation','peer_reviewed_research',86,
      jsonb_build_array(jsonb_build_object(
        'claim','Measured trunk-flexor activity increased with tested Dying Bug difficulty levels.','limits','No validated universal exercise-difficulty scale was studied; proposed scores remain review-only.'))),
    ('load_fatigue_recovery','https://pubmed.ncbi.nlm.nih.gov/11689975/',
      'Electromyographic activity of selected trunk muscles during dynamic spine stabilization exercises','Archives of Physical Medicine and Rehabilitation','peer_reviewed_research',86,
      jsonb_build_array(jsonb_build_object(
        'claim','No measured muscle exceeded 41 percent of maximal voluntary isometric contraction in the tested Dying Bug conditions.','limits','A small acute study does not prescribe fatigue limits, recovery, or prove insufficient demand for every person or variant.'))),
    ('constraints','https://doi.org/10.14474/ptrs.2017.6.1.1',
      'Changes in muscle activity of the abdominal muscles according to exercise method and speed during dead bug exercise','Physical Therapy Rehabilitation Science','peer_reviewed_research',82,
      jsonb_build_array(jsonb_build_object(
        'claim','The protocol used supine positioning, specified joint starts, abdominal drawing-in instruction, pressure biofeedback, metronome speeds, and rest.','limits','The participants were healthy young adults; individual population safety was not established.'))),
    ('dosage','https://doi.org/10.14474/ptrs.2017.6.1.1',
      'Changes in muscle activity of the abdominal muscles according to exercise method and speed during dead bug exercise','Physical Therapy Rehabilitation Science','peer_reviewed_research',82,
      jsonb_build_array(jsonb_build_object(
        'claim','Research bouts lasted 10 seconds with two-minute rest between conditions for EMG collection.','limits','That measurement protocol is not a universal training prescription; working doses remain provisional and quality-terminated.'))),
    ('instructions','https://www.nasm.org/resource-center/exercise-library/dead-bug',
      'Dead Bug','National Academy of Sports Medicine','professional_standard',80,
      jsonb_build_array(jsonb_build_object(
        'claim','The instruction fixes a supine legs-up arms-up start, opposite-limb lowering, avoidance of back arching, controlled return, and side alternation.'))),
    ('safety_stop_rules','https://doi.org/10.14474/ptrs.2017.6.1.1',
      'Changes in muscle activity of the abdominal muscles according to exercise method and speed during dead bug exercise','Physical Therapy Rehabilitation Science','peer_reviewed_research',82,
      jsonb_build_array(jsonb_build_object(
        'claim','Participants with recent orthopedic or neurologic problems or pain with exercise were excluded and rest was given when continuous performance was unavailable.','limits','Study exclusions are not medical clearance or universal stop rules.'))),
    ('programming','https://doi.org/10.14474/ptrs.2017.6.1.1',
      'Changes in muscle activity of the abdominal muscles according to exercise method and speed during dead bug exercise','Physical Therapy Rehabilitation Science','peer_reviewed_research',82,
      jsonb_build_array(jsonb_build_object(
        'claim','Limb method and metronome speed materially changed measured abdominal activity.','limits','Faster is not automatically safer, technically better, or more appropriate for a planning objective.'))),
    ('athlete_support','https://www.nasm.org/resource-center/exercise-library/dead-bug',
      'Dead Bug','National Academy of Sports Medicine','professional_standard',80,
      jsonb_build_array(jsonb_build_object(
        'claim','A legs-only starting option is described when opposite arm-and-leg lowering cannot be performed without back arching.','limits','Regression selection still requires individual symptom and quality review.'))),
    ('coach_support','https://doi.org/10.14474/ptrs.2017.6.1.1',
      'Changes in muscle activity of the abdominal muscles according to exercise method and speed during dead bug exercise','Physical Therapy Rehabilitation Science','peer_reviewed_research',82,
      jsonb_build_array(jsonb_build_object(
        'claim','Exact limb method, joint start, speed, and trunk-stabilization condition were controlled in the protocol, supporting explicit coach observation and recording.'))),
    ('accessibility','https://www.nasm.org/resource-center/exercise-library/dead-bug',
      'Dead Bug','National Academy of Sports Medicine','professional_standard',80,
      jsonb_build_array(jsonb_build_object(
        'claim','The instruction offers a simpler legs-only path before combined opposite limbs.','limits','Wall, partner, loaded, seated, or nonfloor substitutions are different contracts.'))),
    ('alternates','https://doi.org/10.14474/ptrs.2017.6.1.1',
      'Changes in muscle activity of the abdominal muscles according to exercise method and speed during dead bug exercise','Physical Therapy Rehabilitation Science','peer_reviewed_research',82,
      jsonb_build_array(jsonb_build_object(
        'claim','Upper-only, lower-only, combined-limb, and speed conditions were experimentally distinguished.','limits','External load, wall press, partner press, pullover, heel-touch-only, and rotation-resist tasks require separate identity review.'))),
    ('media','https://www.nasm.org/resource-center/exercise-library/dead-bug',
      'Dead Bug','National Academy of Sports Medicine','professional_standard',80,
      jsonb_build_array(jsonb_build_object(
        'claim','An exact demonstration must visibly establish the tabletop start, opposite limb pair, lever, range, terminal condition, quiet trunk, return, alternation, breathing, and stop.','limits','A title, thumbnail, or oEmbed response cannot establish exact match.')))
  ) e(section_key,source_url,source_title,source_publisher,source_kind,quality,claims)
  ON CONFLICT(definition_id,reviewed_card_version,section_key,source_url)
  DO UPDATE SET source_title=EXCLUDED.source_title,
    source_publisher=EXCLUDED.source_publisher,
    source_kind=EXCLUDED.source_kind,claims_json=EXCLUDED.claims_json,
    evidence_quality=EXCLUDED.evidence_quality,review_status='candidate',
    reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_media_candidate_v1(
    definition_id,variant_id,reviewed_card_version,url,embed_url,video_id,
    title,channel_name,language_code,captions_available,embedding_allowed,
    exact_variant_match,demonstration_quality_score,link_status,review_status,
    discovery_method,source_query,reviewer_user_id,reviewed_at,next_review_at,
    notes)
  SELECT canonical_id,NULL,2,
    'https://www.youtube.com/watch?v='||media.video_id,
    'https://www.youtube-nocookie.com/embed/'||media.video_id,
    media.video_id,media.title,media.channel,'en',NULL,TRUE,NULL,NULL,
    'healthy','candidate','legacy_import',
    'legacy Dead Bug references rechecked through YouTube oEmbed on 2026-08-02',
    NULL,NULL,'2026-11-02T00:00:00.000Z'::TIMESTAMPTZ,
    'YouTube oEmbed returned current title, channel, thumbnail, and iframe metadata on 2026-08-02. This proves metadata and embedding response only. Full playback, exact limb pair, start, lever, range, terminal contact or hover, trunk position, return, alternation, breathing, dose, captions, accessibility, safety, cue quality, reviewer identity, and approval remain unresolved.'
  FROM (VALUES
    ('0XVbn86Btj0','You''re Doing Dead Bugs WRONG! Fix This for Stronger Abs & a Bulletproof Core','Squat University'),
    ('BZYaCzbP09M','Dead Bug','E3 Rehab Exercise Library'),
    ('UBa7wBucN-4','How to Do a Dead Bug','Health e-University'),
    ('zechBkcIMf0','The Dead Bug Exercise - The Key to Core Strength and Back Relief','Southern California University of Health Sciences')
  ) media(video_id,title,channel)
  ON CONFLICT(definition_id,reviewed_card_version,video_id) DO UPDATE SET
    variant_id=NULL,url=EXCLUDED.url,embed_url=EXCLUDED.embed_url,
    title=EXCLUDED.title,channel_name=EXCLUDED.channel_name,
    language_code='en',captions_available=NULL,embedding_allowed=TRUE,
    exact_variant_match=NULL,demonstration_quality_score=NULL,
    link_status='healthy',review_status='candidate',
    discovery_method=EXCLUDED.discovery_method,source_query=EXCLUDED.source_query,
    reviewer_user_id=NULL,reviewed_at=NULL,
    next_review_at=EXCLUDED.next_review_at,notes=EXCLUDED.notes,updated_at=now();

  INSERT INTO coaching.exercise_alternate_assessment_v1(
    definition_id,reviewed_card_version,alternate_name,classification,
    rationale,distinguishing_dimensions,proposed_card_json,review_status,
    reviewer_user_id,reviewed_at)
  SELECT canonical_id,2,alternate.name,alternate.classification,
    alternate.rationale,alternate.dimensions,NULL,'candidate',NULL,NULL
  FROM (VALUES
    ('Dead Bug','same_identity','Common display name for the exact alternating contralateral family.',jsonb_build_object('displayName','Dead Bug')),
    ('Dying Bug','same_identity','Historical label used for the same supine stabilization family when the exact contralateral limb contract is retained.',jsonb_build_object('alias','Dying Bug')),
    ('Cross-Crawl Dead Bug','same_identity','Cross-crawl describes the opposite-limb coordination emphasis, not another exercise identity.',jsonb_build_object('consolidatedDefinitionId',cross_crawl_id)),
    ('Opposite Arm and Leg Dead Bug','same_identity','Explicit synonym for the alternating contralateral arm-and-leg contract.',jsonb_build_object('laterality','contralateral')),
    ('Bent-Knee Contralateral Arm and Heel Tap','same_identity','Matches the short-lever review-only working specification.',jsonb_build_object('variantKey','bent-knee-contralateral-arm-heel-tap')),
    ('Long-Lever Contralateral Arm and Leg Hover','same_identity','Matches the long-lever review-only working specification.',jsonb_build_object('variantKey','long-lever-contralateral-arm-leg-hover')),
    ('Reach Range','modifier_annotation','Range scales lever demand only when limb pair, knee action, terminal condition, tempo, breathing, return, and reset remain fixed.',jsonb_build_object('modifier','reach_range')),
    ('Movement Tempo','modifier_annotation','A recorded cadence changes exposure and measured activation but not identity when mechanics are unchanged.',jsonb_build_object('modifier','tempo')),
    ('Metronome Speed','modifier_annotation','Metronome cadence is delivery metadata; it must not silently override control or quality stops.',jsonb_build_object('modifier','metronome_bpm')),
    ('Exhale on Reach','modifier_annotation','A coached exhale is a breathing strategy inside an unchanged movement contract.',jsonb_build_object('modifier','breathing_emphasis')),
    ('Starting Side','modifier_annotation','The first opposite pair changes ordering, not identity.',jsonb_build_object('modifier','starting_pair')),
    ('Sets Repetitions and Rest','modifier_annotation','Dose variables scale exposure only after exact identity and variant are fixed.',jsonb_build_object('modifiers',jsonb_build_array('sets','repetitions_each_side','rest_seconds'))),
    ('Arm-Only Dead Bug with Legs Fixed','new_variant','Removing leg motion changes coordination and anti-extension demand while retaining the supine trunk-control family.',jsonb_build_object('limbAction','upper_extremity_only')),
    ('Leg-Only Dead Bug with Arms Vertical','new_variant','Removing arm motion changes coordination and demand; terminal heel tap or hover must be explicit.',jsonb_build_object('limbAction','lower_extremity_only')),
    ('Contralateral Heel Slide Dead Bug','new_variant','Sliding the heel keeps floor contact and shortens the moving-leg lever compared with a tap or hover.',jsonb_build_object('legPath','heel_slide_continuous_floor_contact')),
    ('Ipsilateral Same-Side Dead Bug','new_variant','Moving the arm and leg on the same side changes coordination and rotational stabilization.',jsonb_build_object('laterality','ipsilateral')),
    ('Externally Loaded Contralateral Dead Bug','new_variant','Added hand or ankle load changes force, grip, failure consequence, dose, and recovery.',jsonb_build_object('externalLoad',TRUE)),
    ('Dead Bug Heel Tap','new_definition','The existing card fixes the arms and alternates a legs-only heel contact.',jsonb_build_object('targetDefinitionId',heel_tap_definition)),
    ('Dead Bug Iso Press','new_definition','Hand-to-knee or ball compression is an isometric force task without the base free-limb reach.',jsonb_build_object('targetDefinitionId',iso_press_definition)),
    ('Dead Bug Wall Press','new_definition','Both hands press a fixed wall while a declared leg moves.',jsonb_build_object('targetDefinitionId',wall_press_definition)),
    ('Dead Bug Pullover','new_definition','A loaded bilateral overhead pullover changes arm action, implement, and load.',jsonb_build_object('targetDefinitionId',pullover_definition)),
    ('Dead Bug Band Pulldown with Rotation Resist','new_definition','External asymmetric band force adds a pulldown and explicit anti-rotation task.',jsonb_build_object('targetDefinitionId',rotation_resist_definition)),
    ('Eccentric Dead Bug Leg Lower','new_definition','A legs-only prescribed slow negative is the primary action.',jsonb_build_object('targetDefinitionId',eccentric_leg_lower_definition)),
    ('Partner Dead Bug Hand Press','new_definition','Partner contact and external isometric hand force create a separate task.',jsonb_build_object('targetDefinitionId',partner_press_definition)),
    ('Bird Dog','new_definition','Quadruped hand-and-knee support changes orientation, base of support, loading, and limb mechanics.',jsonb_build_object('orientation','quadruped')),
    ('Hollow Body Hold','new_definition','A continuous supine isometric hold removes alternating return-and-reset repetitions.',jsonb_build_object('action','continuous_isometric_hold')),
    ('Pilates Criss-Cross','new_definition','Trunk flexion and rotation with elbow-to-knee action differ from a quiet-trunk Dead Bug.',jsonb_build_object('action','trunk_flexion_rotation')),
    ('Dead Bug Time-to-Exhaustion Test','new_definition','A maximal assessment changes purpose, termination, attempts, validity, and persistence.',jsonb_build_object('purpose','assessment')),
    ('Undefined Dead Bug Variation','reject','A generic label without exact limb pair, lever, range, terminal condition, tempo, return, dose, and stop rule is not selectable.',jsonb_build_object('identityQuarantine',TRUE)),
    ('Pain-Through Dead Bug','reject','Continuing through pain, pressure symptoms, numbness, dizziness, or neurologic signs violates stop and escalation rules.',jsonb_build_object('symptomPolicy','prohibited')),
    ('Uncontrolled Fast Conditioning Dead Bug','reject','Speed without an exact cadence and preserved quality converts the drill into unbudgeted fatigue and coordination failure.',jsonb_build_object('purpose','unplanned_conditioning')),
    ('Back-Arch or Leg-Drop Repetitions','reject','Repetitions performed by changing trunk position or dropping the leg do not satisfy the exercise contract.',jsonb_build_object('quality','invalid_repetition'))
  ) alternate(name,classification,rationale,dimensions)
  ON CONFLICT(definition_id,reviewed_card_version,alternate_name) DO UPDATE SET
    classification=EXCLUDED.classification,rationale=EXCLUDED.rationale,
    distinguishing_dimensions=EXCLUDED.distinguishing_dimensions,
    proposed_card_json=NULL,review_status='candidate',reviewer_user_id=NULL,
    reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_relationship_v1(
    from_variant_id,to_variant_id,relationship,similarity_score,dimensions,
    reason,conditions_json,review_status,created_by,reviewed_by,reviewed_at)
  VALUES
    (short_variant,long_variant,'progression',92,
      ARRAY['leverage','range','load','complexity'],
      'Extending the moving knee and using a noncontact long-leg hover preserves the opposite-limb reach while increasing lever, range, anti-extension demand, and observation complexity.',
      '{"requires":["short_lever_control","quiet_trunk","continuous_breathing"],"revalidate":["lever","range","hover_height","dose","fatigue","duration","rendering"]}'::JSONB,
      'review',NULL,NULL,NULL),
    (long_variant,short_variant,'regression',92,
      ARRAY['leverage','range','load','complexity'],
      'Returning to a bent knee and light heel target shortens the moving-leg lever and lowers range and anti-extension demand.',
      '{"revalidate":["knee_action","heel_target","dose","fatigue","duration","rendering"]}'::JSONB,
      'review',NULL,NULL,NULL),
    (long_variant,heel_tap_variant,'regression',78,
      ARRAY['leverage','range','complexity'],
      'The legs-only heel-tap card can reduce simultaneous opposite-limb coordination and lever demand, but it changes arm action and must be selected explicitly.',
      '{"identityChanges":["arm_action","terminal_contact"],"coachConfirmationRequired":true,"recomputeDoseDurationAndRendering":true}'::JSONB,
      'review',NULL,NULL,NULL),
    (short_variant,iso_press_variant,'lateral_substitution',70,
      ARRAY['load','complexity','stability'],
      'The isometric press can retain a supine trunk-control purpose when dynamic opposite-limb motion is unsuitable, but external compression and no-motion mechanics require new scoring and dosage.',
      '{"onlyWhen":"dynamic_limb_motion_goal_can_change","coachConfirmationRequired":true,"recomputeDoseFatigueDurationAndRendering":true}'::JSONB,
      'review',NULL,NULL,NULL)
  ON CONFLICT(from_variant_id,to_variant_id,relationship) DO UPDATE SET
    similarity_score=EXCLUDED.similarity_score,dimensions=EXCLUDED.dimensions,
    reason=EXCLUDED.reason,conditions_json=EXCLUDED.conditions_json,
    review_status='review',created_by=NULL,reviewed_by=NULL,reviewed_at=NULL,
    updated_at=now()
  WHERE coaching.exercise_relationship_v1.reviewed_by IS NULL
    AND coaching.exercise_relationship_v1.review_status<>'approved';

  INSERT INTO coaching.exercise_score_calibration_v1(
    facility_id,variant_id,dimension,proposed_score,anchor_tier,rationale,
    status,version,created_by,reviewed_by,review_notes,reviewed_at)
  SELECT 1,variant.id,dimension.dimension,
    CASE dimension.dimension WHEN 'technicalComplexity'
      THEN variant.complexity ELSE variant.physical END,
    variant.anchor_tier,
    CASE dimension.dimension WHEN 'technicalComplexity'
      THEN 'Review-only exercise-complexity anchor based on opposite-limb coordination, exact lever and range, terminal contact or hover, trunk control, breathing, return, alternation, and quality termination.'
      ELSE 'Review-only physical-difficulty anchor based on limb segment mass, hip and knee lever, range, terminal height, tempo, repetitions each side, prior trunk and hip-flexor fatigue, symptoms, and recovery.' END
      ||' No athlete proficiency classification is represented. Variant: '
      ||variant.variant_key||'.',
    'review',1,NULL,NULL,
    'Research-informed proposal only; independent anchor comparison and qualified human approval remain required.',NULL
  FROM (VALUES
    (short_variant,'bent-knee-contralateral-arm-heel-tap',34,24,40),
    (long_variant,'long-lever-contralateral-arm-leg-hover',42,38,40)
  ) variant(id,variant_key,complexity,physical,anchor_tier)
  CROSS JOIN (VALUES('technicalComplexity'),('absoluteLoadDemand'))
    dimension(dimension)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
    proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,
    reviewed_by=NULL,review_notes=EXCLUDED.review_notes,reviewed_at=NULL,
    updated_at=now();

  UPDATE coaching.exercise_score_v1 SET
    technical_complexity=34,absolute_load_demand=24,
    coordination_demand=42,impact=1,supervision_demand=20,
    base_overall_difficulty=greatest(34,24),
    legacy_scores=coalesce(legacy_scores,'{}'::JSONB)||jsonb_build_object(
      'candidateReassessment',migration_key,
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'sourceIdentity','supine_alternating_contralateral_anti_extension',
      'exactVariantRequired',TRUE,'independentCalibrationRequired',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    migration_confidence=70,human_review_status='queued',reviewed_by=NULL,
    reviewed_at=NULL,
    review_notes='Research-informed candidate reassessment only; exact variant assignment and independent human calibration remain required.',
    updated_at=now()
  WHERE exercise_id=ANY(source_ids);

  UPDATE coaching.exercise SET skill_level=NULL,
    name=CASE id WHEN 9 THEN 'Dead Bug' ELSE name END,
    description=CASE id WHEN 9 THEN
      'From supine tabletop, move one arm and the opposite leg through a declared range while ribs, pelvis, and lumbar position stay quiet; return to the same start before alternating.'
      ELSE description END,
    instructions=CASE id WHEN 9 THEN
      'Declare the exact lever, range, terminal contact or hover, tempo, starting pair, repetitions each side, rest, and stop signal. Reach opposite limbs, keep the trunk quiet, breathe, return fully, then switch.'
      ELSE instructions END,
    default_sets=CASE id WHEN 9 THEN 2 ELSE default_sets END,
    default_reps=CASE id WHEN 9 THEN 5 ELSE default_reps END,
    default_rest_seconds=CASE id WHEN 9 THEN 45 ELSE default_rest_seconds END,
    est_seconds_per_set=CASE id WHEN 9 THEN 80 ELSE est_seconds_per_set END,
    card_summary=CASE id WHEN 9 THEN
      'Supine alternating contralateral arm-and-leg reach for anti-extension position, breathing, and cross-body coordination.'
      ELSE card_summary END,
    coach_language=CASE id WHEN 9 THEN
      'Verify exact variant, opposite pair, lever, range, terminal condition, quiet trunk, breathing, controlled return, and full reset. Stop for symptoms, wrong limbs, trunk motion, leg drop, momentum, or incomplete return.'
      ELSE coach_language END,
    athlete_language=CASE id WHEN 9 THEN
      'Opposite arm and leg reach; keep the trunk quiet, breathe, return fully, then switch.'
      ELSE athlete_language END,
    programming_logic=CASE id WHEN 9 THEN jsonb_build_object(
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'identityRule','alternating_contralateral_arm_and_leg_reach_exact_variant_required',
      'fatigueRule','count_valid_and_failed_repetitions_with_all_trunk_hip_flexor_hollow_leg_lower_wall_press_and_pullover_work',
      'substitutionRule','never_silently_change_limb_action_lever_terminal_condition_external_force_or_primary_action',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
      ELSE programming_logic END,
    scalable_variables=CASE id WHEN 9 THEN ARRAY[
      'reach_range','tempo','starting_pair','repetitions_each_side',
      'sets','rest_seconds']::TEXT[] ELSE scalable_variables END,
    movement_family=CASE id WHEN 9 THEN
      'Supine alternating contralateral anti-extension' ELSE movement_family END,
    primary_phase_key=CASE id WHEN 9 THEN 'movement_intelligence'
      ELSE primary_phase_key END,
    phase_subrole=CASE id WHEN 9 THEN
      'contralateral_coordination_and_anti_extension_control'
      ELSE phase_subrole END,
    primary_order_slot=CASE id WHEN 9 THEN
      'dead_bug_contralateral_control' ELSE primary_order_slot END,
    movement_requirements=CASE id WHEN 9 THEN jsonb_build_object(
      'start','supine_tabletop','limbAction','one_arm_and_opposite_leg',
      'trunkContract','quiet_rib_pelvis_lumbar_position',
      'variantRequired',TRUE,'completion','controlled_return_before_alternating',
      'impactLevel',0) ELSE movement_requirements END,
    coaching_execution=CASE id WHEN 9 THEN jsonb_build_object(
      'setup',jsonb_build_array(
        'Declare variant, starting pair, range, tempo, dose, rest, and stop signal.',
        'Inspect floor, optional mat, limb paths, floor access, and side-view sightline.'),
      'executionSteps',jsonb_build_array(
        'Set the same supine tabletop start and breathe.',
        'Reach one straight arm and the opposite leg to the variant target.',
        'Keep ribs, pelvis, and lumbar position quiet.',
        'Return the same pair fully before alternating.'),
      'qualityGate',jsonb_build_array(
        'Correct opposite pair and exact lever, range, and terminal condition.',
        'Quiet trunk with continuous breathing.',
        'Controlled return to the same start before every switch.'),
      'stopSigns',jsonb_build_array(
        'Pain, pressure symptoms, numbness, dizziness, nausea, or apprehension.',
        'Wrong limbs, trunk motion, leg drop, momentum, breath lock, or incomplete return.',
        'Unsafe floor, mat, space, access, or exit.'))
      ELSE coaching_execution END,
    pairing_logic=CASE id WHEN 9 THEN jsonb_build_object(
      'goodForSessions',jsonb_build_array(
        'movement_intelligence','trunk_control','resilience'),
      'pairsWellAfter',jsonb_build_array(
        'floor_access_preparation','low_demand_breathing'),
      'pairsWellBefore',jsonb_build_array(
        'nonfatiguing_strength_or_skill_work_when_used_as_rehearsal'),
      'avoidBefore',jsonb_build_array(
        'priority_hollow_shape_trunk_or_hip_flexor_work_if_this_would_fatigue_it'),
      'doNotUseWhen',jsonb_build_array(
        'supine_or_tabletop_not_tolerated','symptoms_present',
        'exact_opposite_limb_contract_unavailable','safe_floor_access_unavailable'))
      ELSE pairing_logic END,
    media_library=CASE id WHEN 9 THEN jsonb_build_object(
      'demoVideoSources',jsonb_build_array(
        'https://www.youtube.com/watch?v=0XVbn86Btj0',
        'https://www.youtube.com/watch?v=BZYaCzbP09M',
        'https://www.youtube.com/watch?v=UBa7wBucN-4',
        'https://www.youtube.com/watch?v=zechBkcIMf0'),
      'mediaState','oembed_metadata_healthy_exact_match_and_approval_unresolved',
      'internalNotes',jsonb_build_array(
        'Do not treat titles, thumbnails, or oEmbed as movement review.',
        'Film exact start, opposite pair, lever, range, terminal condition, trunk, breathing, return, alternation, and stop.'))
      ELSE media_library END,
    archived=CASE id WHEN 917 THEN TRUE ELSE archived END,
    is_published=CASE id WHEN 917 THEN FALSE ELSE is_published END,
    why_publish_ready=CASE id WHEN 917 THEN FALSE ELSE why_publish_ready END,
    updated_at=now()
  WHERE id=ANY(source_ids);
  UPDATE coaching.exercise_safety_profile
  SET minimum_skill_level=NULL
  WHERE exercise_id=ANY(source_ids);

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  VALUES(canonical_id,1,2,'2.0.0',migration_key,'quarantined',
    jsonb_build_object(
      'identity',jsonb_build_object(
        'passed',TRUE,'legacySources',2,'duplicateDefinitionsConsolidated',1,
        'activeWorkingSpecifications',2,'sourceDerivedSelectableVariants',0,
        'neighborBoundariesRecorded',7),
      'taxonomy',jsonb_build_object(
        'passed',TRUE,'controlledTerms',TRUE,
        'movementPatterns',jsonb_build_array('brace','reach')),
      'anatomy',jsonb_build_object(
        'passed',TRUE,'musclesJointsActionsSagittalPlaneAndContralateralLaterality',TRUE),
      'difficulty',jsonb_build_object(
        'passed',TRUE,'model','max_exercise_complexity_physical_difficulty',
        'independentCalibrationRequired',TRUE),
      'loadFatigueRecovery',jsonb_build_object(
        'passed',TRUE,'landingContactsPerRep',0,
        'validFailedAndEachSideExposure',TRUE,
        'sameSessionTrunkHipFlexorHollowLegLowerWallPressAndPulloverWorkRequired',TRUE),
      'constraints',jsonb_build_object(
        'passed',TRUE,'supineFloorSpacePopulationSymptomsEntryAndExit',TRUE),
      'delivery',jsonb_build_object(
        'passed',TRUE,'profiles',6,
        'doseDurationScalingLogisticsSubstitutionAndPersistence',TRUE),
      'instructions',jsonb_build_object(
        'passed',TRUE,'athleteCoachAndSupportOperations',TRUE),
      'research',jsonb_build_object(
        'passed',TRUE,'sections',16,'registryVersion',research_version,
        'healthySampleAndAcuteEmgLimitsExplicit',TRUE,
        'researchProtocolNotTrainingPrescription',TRUE),
      'media',jsonb_build_object(
        'passed',FALSE,'candidateCount',4,'currentOEmbedMetadataHealthy',TRUE,
        'playbackReviewed',FALSE,'exactMatchReviewed',FALSE,
        'captionsReviewed',FALSE,'accessibilityReviewed',FALSE,
        'qualityReviewed',FALSE,'approvalCreated',FALSE),
      'relationships',jsonb_build_object(
        'passed',FALSE,'reviewOnly',4,'approved',0),
      'calibration',jsonb_build_object(
        'passed',FALSE,'reviewOnly',4,'approved',0),
      'alternates',jsonb_build_object(
        'passed',TRUE,'assessments',32),
      'generationSupport',jsonb_build_object(
        'passed',TRUE,'selectionConstraints',TRUE,'cumulativeFatigue',TRUE,
        'duration',TRUE,'equipmentAndStation',TRUE,
        'substitutionRevalidation',TRUE,'renderingAndPersistence',TRUE),
      'publication',jsonb_build_object(
        'passed',FALSE,'reviewer',NULL,'approver',NULL)),
    jsonb_build_array(
      jsonb_build_object(
        'code','CARD-MEDIA-01','category','media',
        'message','A qualified human must watch each candidate in full and verify exact start, opposite limb pair, lever, range, terminal contact or hover, trunk position, return, alternation, breathing, dose, captions, accessibility, safety, cue quality, conflicts, current playback, reviewer identity, and card-version match.'),
      jsonb_build_object(
        'code','CARD-GRAPH-03','category','relationship_graph',
        'message','A qualified coach must approve or reject every progression, regression, and substitution proposal.'),
      jsonb_build_object(
        'code','CARD-CALIBRATION-01','category','calibration',
        'message','An independent qualified reviewer must calibrate exercise complexity and physical difficulty. These scores do not represent athlete proficiency.'),
      jsonb_build_object(
        'code','CARD-PUBLISH-01','category','publication',
        'message','A qualified reviewer and separate approver must complete content review before publication.')),
    TRUE,now())
  ON CONFLICT(definition_id) DO UPDATE SET
    facility_id=EXCLUDED.facility_id,card_version=EXCLUDED.card_version,
    schema_version=EXCLUDED.schema_version,audit_version=EXCLUDED.audit_version,
    status='quarantined',checks_json=EXCLUDED.checks_json,
    blocking_issues_json=EXCLUDED.blocking_issues_json,
    human_review_required=TRUE,checked_at=now();

  IF (SELECT count(*) FROM coaching.exercise_definition_source_v1
      WHERE definition_id=canonical_id AND legacy_exercise_id=ANY(source_ids))<>2
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=cross_crawl_id AND status='archived')
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(source_variant_ids) AND definition_id=canonical_id
        AND status='archived'
        AND requirements_json->>'representation'='identity_quarantine')<>2
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(active_variant_ids) AND definition_id=canonical_id
        AND status='review' AND requirements_json->>'selectable'='true'
        AND difficulty_json->>'technicalMeaning'='exercise_complexity'
        AND difficulty_json->>'loadMeaning'='physical_difficulty'
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=greatest(
          (difficulty_json->>'technicalComplexity')::INTEGER,
          (difficulty_json->>'absoluteLoadDemand')::INTEGER)
        AND (load_profile_json->>'landingContactsPerRep')::INTEGER=0)<>2 THEN
    RAISE EXCEPTION '% left invalid identity consolidation or working variants',
      migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=ANY(active_variant_ids) AND status='review'
        AND cardinality(equipment_required)>0
        AND coalesce(time_model_json->>'durationFormula','')<>''
        AND length(coach_instructions)>=100
        AND length(athlete_instructions) BETWEEN 10 AND 240
        AND cardinality(stop_rules)>=10)<>6
    OR (SELECT count(DISTINCT section_key)
      FROM coaching.exercise_section_evidence_v1
      WHERE definition_id=canonical_id AND reviewed_card_version=2
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>16
    OR (SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=canonical_id AND reviewed_card_version=2
        AND video_id=ANY(current_video_ids) AND link_status='healthy'
        AND review_status='candidate' AND embedding_allowed
        AND captions_available IS NULL AND exact_variant_match IS NULL
        AND demonstration_quality_score IS NULL
        AND reviewer_user_id IS NULL AND reviewed_at IS NULL)<>4
    OR (SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id=canonical_id AND reviewed_card_version=2
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>32 THEN
    RAISE EXCEPTION '% left incomplete profiles, evidence, media, or alternates',
      migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE from_variant_id=ANY(active_variant_ids)
        AND review_status='review' AND reviewed_by IS NULL)<>4
    OR (SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(active_variant_ids) AND status='review'
        AND version=1 AND reviewed_by IS NULL)<>4
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=canonical_id
        AND resolved_definition_id=cross_crawl_id
        AND decision='duplicate_consolidated' AND reviewed_by IS NULL)
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE survivor_definition_id=canonical_id
        AND resolved_definition_id=ANY(neighbor_definition_ids)
        AND decision='distinct_exercises' AND reviewed_by IS NULL)<>7 THEN
    RAISE EXCEPTION '% left incomplete graph, calibration, or identity decisions',
      migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(definition.movement_patterns) key
      WHERE definition.id=canonical_id
        AND NOT EXISTS(SELECT 1 FROM coaching.movement_pattern allowed
          WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(definition.body_regions) key
      WHERE definition.id=canonical_id
        AND NOT EXISTS(SELECT 1 FROM coaching.body_region allowed
          WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(
        definition.required_equipment||definition.optional_equipment) key
      WHERE definition.id=canonical_id
        AND NOT EXISTS(SELECT 1 FROM coaching.equipment allowed
          WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1 relationship
      WHERE relationship.from_variant_id=ANY(active_variant_ids)
        AND relationship.relationship IN('progression','regression')
        AND EXISTS(SELECT 1 FROM unnest(relationship.dimensions) dimension
          WHERE dimension<>ALL(ARRAY[
            'load','leverage','range','speed','stability','complexity','impact',
            'decision_demand','fatigue']::TEXT[]))) THEN
    RAISE EXCEPTION '% created uncontrolled taxonomy or graph dimensions',
      migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise
      WHERE id=ANY(source_ids) AND skill_level IS NOT NULL)
    OR EXISTS(SELECT 1 FROM coaching.exercise_safety_profile
      WHERE exercise_id=ANY(source_ids) AND minimum_skill_level IS NOT NULL)
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=ANY(affected_definition_ids)
        AND (reviewed_by IS NOT NULL OR approved_by IS NOT NULL
          OR last_reviewed_at IS NOT NULL OR approved_video_url IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=canonical_id AND reviewed_card_version=2
        AND (review_status IN('approved') OR reviewer_user_id IS NOT NULL
          OR reviewed_at IS NOT NULL OR captions_available IS NOT NULL
          OR exact_variant_match IS NOT NULL
          OR demonstration_quality_score IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id=canonical_id
        AND (status<>'quarantined' OR human_review_required<>TRUE
          OR jsonb_array_length(blocking_issues_json)<>4)) THEN
    RAISE EXCEPTION '% fabricated proficiency, approval, or publication state',
      migration_key;
  END IF;
END;
$$;
