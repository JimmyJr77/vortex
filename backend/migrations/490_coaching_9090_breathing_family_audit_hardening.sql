-- Replace generic 90/90 breathing source representations with exact supported
-- breathing specifications, separate the no-reach lateral-expansion exercise
-- and the active hip-lift/ball/balloon exercise into distinct definitions, and
-- quarantine the ambiguous Hip Reset source. Evidence, media, graph,
-- calibration, content, and publication decisions remain review-only. No
-- athlete proficiency, age classification, human approval, or playback review
-- is inferred.

DO $$
DECLARE
  migration_key CONSTANT TEXT := '490_coaching_9090_breathing_family_audit_hardening';
  research_version CONSTANT TEXT := '2026-08-02.89';
  reach_definition CONSTANT UUID := '0ac22398-2eed-482a-aae8-8d26ba888eaf';
  source_656_definition CONSTANT UUID := '3cc260a4-c61c-43bf-abbe-167db83f8814';
  source_1404_definition CONSTANT UUID := 'd65d13d0-135c-4593-8de1-fdcd9e057dc0';
  lateral_definition CONSTANT UUID := 'b366c4d4-d75e-4902-915c-4b363e6b6238';
  balloon_definition CONSTANT UUID := '96d4d5fe-1ad1-4930-9c74-2054764d0c6c';
  affected_definition_ids CONSTANT UUID[] := ARRAY[
    reach_definition,source_656_definition,source_1404_definition,
    lateral_definition,balloon_definition];
  source_ids CONSTANT BIGINT[] := ARRAY[21,656,1404];
  source_variant_ids CONSTANT UUID[] := ARRAY[
    'cb077d9c-261b-4944-8f3e-6109491c73cd'::UUID,
    '329f2581-c1b7-4c2b-8a71-8c5c34a59cb1'::UUID,
    '4276c5c7-19d9-4cfc-830f-fb6482b3430c'::UUID];
  reach_wall_variant CONSTANT UUID := '4193b7da-09de-4558-b7a1-1ac9440d19eb';
  reach_support_variant CONSTANT UUID := 'e9384c20-f26f-4a12-b9ba-913be80b2d82';
  lateral_wall_variant CONSTANT UUID := 'b5719ed0-5d31-4030-9c11-7ea81aabe254';
  balloon_variant CONSTANT UUID := 'd4393550-a0b4-485a-8b99-e6bb1b7e71f3';
  active_variant_ids CONSTANT UUID[] := ARRAY[
    reach_wall_variant,reach_support_variant,lateral_wall_variant,
    balloon_variant];
  hip_switch_definition CONSTANT UUID := 'ea0862ed-f2e8-4976-b1ca-8fbfb310b50f';
  hip_switch_variant CONSTANT UUID := 'e2371deb-d401-4eb0-be8e-3670e716f759';
  crocodile_definition CONSTANT UUID := '2e308a8e-6a1d-48d4-b095-fe3dd18803d8';
  crocodile_variant CONSTANT UUID := '42909b84-690a-45b5-908a-c085196d1141';
  dead_bug_definition CONSTANT UUID := '2a07d4d4-5012-420c-9549-8bdbc64ec675';
  dead_bug_variant CONSTANT UUID := '9e6cb14d-85d8-4d7e-8f24-81d4c6b72b40';
  box_breath_definition CONSTANT UUID := '4d4aba1c-c4b5-4915-a85d-fd943acd1e91';
  med_ball_breath_definition CONSTANT UUID := 'ae51bba4-1fd3-4492-b515-b3cf26327089';
  med_ball_breath_variant CONSTANT UUID := 'fdaf9145-c7ef-4aef-8645-09475e4d1e13';
  shared_population JSONB := jsonb_build_object(
    'individualizationRequired',TRUE,
    'notClinicalClearance',TRUE,
    'neverInferReadinessFromExerciseDifficulty',TRUE,
    'generalReadiness',jsonb_build_array(
      'comfortable_supported_supine_position',
      'comfortable_unforced_resting_breathing',
      'pain_free_declared_shoulder_hip_and_knee_position',
      'can_report_symptoms_air_hunger_and_uncertainty'),
    'cautions',jsonb_build_array(
      'current_or_recent_respiratory_cardiovascular_neurologic_neck_back_hip_knee_or_shoulder_symptoms',
      'dizziness_faintness_panic_air_hunger_or_unusual_shortness_of_breath',
      'pregnancy_or_postpartum_status_requiring_supine_position_individualization',
      'inability_to_get_to_or_from_the_floor_safely',
      'instructions_from_a_treating_clinician_that_conflict_with_this_workout_card'));
  shared_support_operations JSONB := jsonb_build_object(
    'issueCategories',jsonb_build_array(
      'identity_or_variant_mismatch','support_equipment_or_floor_hazard',
      'pain_dizziness_faintness_air_hunger_or_unusual_shortness_of_breath',
      'breath_reach_rib_pelvis_or_return_quality_failure',
      'dose_duration_fatigue_or_recovery_mismatch',
      'broken_inaccessible_or_mismatched_media'),
    'supportEscalation',jsonb_build_object(
      'safety','stop_exposure_remove_from_selection_and_follow_facility_health_or_incident_protocol',
      'identity','quarantine_selection_and_route_to_canonical_identity_review',
      'symptoms','stop_and_route_to_the_appropriate_coach_or_health_protocol_without_diagnosing',
      'doseOrFatigue','route_to_programming_review_before_reuse',
      'media','quarantine_candidate_and_schedule_qualified_full_video_review'),
    'retentionPolicy',jsonb_build_object(
      'plannedAndActualDose','retain_with_saved_workout_and_generator_version',
      'invalidPartialAssistedAndSymptomAttempts','retain_as_exposure',
      'incidentRecord','facility_health_and_incident_policy',
      'mediaReview','retain_reviewer_timestamp_card_version_and_decision'),
    'changeImpactPolicy',jsonb_build_object(
      'identityOrSafetyChange','invalidate_release_and_revalidate_saved_workouts',
      'variantScoreDoseOrEquipmentChange','recompute_selection_fatigue_duration_logistics_and_substitutions',
      'instructionChange','increment_card_version_and_recheck_media',
      'mediaChange','invalidate_media_review_only',
      'relationshipChange','revalidate_substitution_and_progression_paths'),
    'generationRecords',jsonb_build_array(
      'definition_id','variant_id','profile_key','support_interface',
      'planned_and_completed_breath_cycles','inhale_and_exhale_cadence_if_prescribed',
      'reach_hip_lift_balloon_and_ball_contract_where_applicable',
      'valid_invalid_partial_and_assisted_attempts','rest_and_duration',
      'first_quality_break_symptoms_stop_reason_and_substitution'),
    'publicationQuarantined',TRUE,'mediaReviewRequired',TRUE,
    'relationshipReviewRequired',TRUE,'calibrationReviewRequired',TRUE);
  protected_count INTEGER;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=reach_definition AND slug='9090-breathing-with-reach'
        AND status<>'archived')
    OR (SELECT count(*) FROM coaching.exercise_definition_v1
        WHERE id=ANY(ARRAY[source_656_definition,source_1404_definition]))<>2
    OR (SELECT count(*) FROM coaching.exercise_definition_source_v1
        WHERE legacy_exercise_id=ANY(source_ids))<>3
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
        WHERE id=ANY(source_variant_ids))<>3
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
        WHERE id=hip_switch_definition AND status<>'archived')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
        WHERE id=hip_switch_variant AND status<>'archived')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
        WHERE id=crocodile_definition AND status<>'archived')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
        WHERE id=crocodile_variant AND status<>'archived')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
        WHERE id=dead_bug_definition AND status<>'archived')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
        WHERE id=dead_bug_variant AND status<>'archived')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
        WHERE id=box_breath_definition AND status<>'archived')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
        WHERE id=med_ball_breath_definition AND status<>'archived')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
        WHERE id=med_ball_breath_variant AND status<>'archived') THEN
    RAISE EXCEPTION '% prerequisite 90/90 breathing identity state is missing or drifted',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=ANY(ARRAY[lateral_definition,balloon_definition])
        AND slug NOT IN(
          '9090-wall-supported-breathing-with-lateral-expansion',
          '9090-hip-lift-with-ball-and-balloon'))
    OR EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=ANY(active_variant_ids)
        AND definition_id NOT IN(reach_definition,lateral_definition,balloon_definition)) THEN
    RAISE EXCEPTION '% working UUID is already owned by another canonical identity',migration_key;
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
        AND (reviewed_by IS NOT NULL OR review_status='approved')
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

  INSERT INTO coaching.movement_pattern(key,name,sort_order)
  VALUES('breath','Breath Control',19)
  ON CONFLICT(key) DO UPDATE SET name=EXCLUDED.name,
    sort_order=EXCLUDED.sort_order;
  INSERT INTO coaching.equipment(key,name,sort_order)
  VALUES
    ('balloon','Balloon',131),
    ('wall_or_bench_or_box','Wall, Bench, or Box (Leg Support)',132)
  ON CONFLICT(key) DO UPDATE SET name=EXCLUDED.name,
    sort_order=EXCLUDED.sort_order;

  UPDATE coaching.exercise_section_evidence_v1 SET
    review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
    updated_at=now()
  WHERE definition_id=ANY(affected_definition_ids)
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_media_candidate_v1 SET
    review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
    exact_variant_match=NULL,demonstration_quality_score=NULL,updated_at=now()
  WHERE definition_id=ANY(affected_definition_ids)
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_alternate_assessment_v1 SET
    review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
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

  UPDATE coaching.exercise_definition_source_v1 SET
    definition_id=reach_definition,
    source_kind=CASE WHEN legacy_exercise_id=21
      THEN 'legacy_migration' ELSE 'duplicate_consolidation' END,
    provenance_json=(coalesce(provenance_json,'{}'::JSONB)-'researchSources')
      ||jsonb_build_object(
        'migration',migration_key,'researchVersion',research_version,
        'sourceDisposition',CASE legacy_exercise_id
          WHEN 21 THEN 'identity_quarantine_replaced_by_two_exact_support_variants'
          WHEN 656 THEN 'exact_duplicate_identity_quarantine_replaced_by_two_exact_support_variants'
          ELSE 'ambiguous_contextual_label_identity_quarantine' END,
        'representedBySelectableSourceVariant',FALSE,
        'missingIdentityFacts',CASE WHEN legacy_exercise_id=1404 THEN
          jsonb_build_array(
            'support_interface','heel_pressure','hip_lift','pelvic_shift',
            'arm_reach','ball_or_balloon','breath_cycle','valid_completion')
          ELSE '[]'::JSONB END,
        'mustNotMapToHipLiftBalloonCard',legacy_exercise_id=1404,
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=ANY(source_ids);

  UPDATE coaching.exercise_delivery_profile_v1 SET status='archived',
    updated_at=now()
  WHERE variant_id=ANY(source_variant_ids);
  UPDATE coaching.exercise_variant_v1 SET
    definition_id=reach_definition,
    variant_key='identity-quarantine-source-'
      ||(source_ids[array_position(source_variant_ids,id)])::TEXT,
    display_name='90/90 Breathing Identity Quarantine — Source '
      ||(source_ids[array_position(source_variant_ids,id)])::TEXT,
    modifier_keys='{}'::TEXT[],difficulty_json='{}'::JSONB,status='archived',
    requirements_json=jsonb_build_object(
      'selectable',FALSE,'representation','identity_quarantine',
      'sourceLegacyExerciseId',source_ids[array_position(source_variant_ids,id)],
      'archiveReason',CASE id
        WHEN source_variant_ids[1] THEN
          'source_combines_wall_bench_and_box_support_without_exact_contact_pressure_reach_cadence_or_completion_contract'
        WHEN source_variant_ids[2] THEN
          'duplicate_source_combines_wall_and_box_support_without_exact_contact_pressure_reach_cadence_or_completion_contract'
        ELSE
          'hip_reset_source_omits_support_contact_heel_pressure_hip_lift_pelvic_shift_reach_ball_balloon_breath_cycle_and_completion_contract' END,
      'researchAuthoredReplacementRequired',id<>source_variant_ids[3],
      'identityFactsMissing',id=source_variant_ids[3],
      'humanReviewRequired',TRUE),
    load_profile_json=jsonb_build_object('selectable',FALSE),
    fatigue_profile_json=jsonb_build_object('selectable',FALSE),
    programming_profile_json=jsonb_build_object(
      'selectionStatus','identity_quarantine','selectable',FALSE,
      'publicationQuarantined',TRUE),updated_at=now()
  WHERE id=ANY(source_variant_ids);

  UPDATE coaching.exercise_definition_v1 SET
    status='archived',approved_video_url=NULL,reviewed_by=NULL,
    approved_by=NULL,last_reviewed_at=NULL,
    provenance_json=(coalesce(provenance_json,'{}'::JSONB)-'researchSources')
      ||jsonb_build_object(
        'breathingFamilyAuditMigration',migration_key,
        'canonicalSurvivorDefinitionId',reach_definition,'selectable',FALSE,
        'sourceDisposition',CASE id
          WHEN source_656_definition THEN 'exact_duplicate_consolidated'
          ELSE 'ambiguous_contextual_label_quarantined' END,
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE),updated_at=now()
  WHERE id=ANY(ARRAY[source_656_definition,source_1404_definition]);

  UPDATE coaching.exercise_identity_resolution_v1 SET
    decision='duplicate_consolidated',
    rationale='Source 656 is an exact naming and action duplicate of supported 90/90 breathing with reach. Its support interface is not exact enough to remain selectable, so lineage is consolidated and exact wall versus lower-leg support variants replace it.',
    evidence_json=jsonb_build_object(
      'migration',migration_key,
      'identityBoundary','exact_supported_9090_breathing_with_bilateral_reach_duplicate',
      'sourceRepresentationSelectable',FALSE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    resolution_source='deterministic_exact_identity',reviewed_by=NULL,
    resolved_at=now()
  WHERE survivor_definition_id=reach_definition
    AND resolved_definition_id=source_656_definition;

  UPDATE coaching.exercise_identity_resolution_v1 SET
    decision='needs_human_review',
    rationale='The Hip Reset source names a context and claimed outcome but does not state the support contact, heel pressure, hip lift, pelvic shift, arm reach, ball or balloon, breath cycle, valid completion, or reset. It cannot be selected or deterministically mapped to the reach or hip-lift/balloon action.',
    evidence_json=jsonb_build_object(
      'migration',migration_key,
      'identityBoundary','ambiguous_hip_reset_context_without_action_contract',
      'missingIdentityFacts',jsonb_build_array(
        'support_interface','heel_pressure','hip_lift','pelvic_shift',
        'arm_reach','ball_or_balloon','breath_cycle','valid_completion'),
      'sourceRepresentationSelectable',FALSE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    resolution_source='deterministic_identity_equivalence',reviewed_by=NULL,
    resolved_at=now()
  WHERE survivor_definition_id=reach_definition
    AND resolved_definition_id=source_1404_definition;

  -- CANONICAL_DEFINITIONS

  UPDATE coaching.exercise_definition_v1 SET
    canonical_name='Supported 90/90 Breathing with Bilateral Reach',
    display_name='90/90 Breathing with Reach',
    aliases=ARRAY[
      '90/90 Breathing with Reaches','90-90 Breathing with Reach',
      '90/90 Wall Breathing with Reach','90/90 Bench-Supported Breathing with Reach']::TEXT[],
    description='A supported supine breath-cycle exercise with hips and knees near 90 degrees and both arms reaching toward the ceiling. One exact variant plants both feet on a stable wall; another fully supports the lower legs on a stable bench or box. A repetition is one comfortable inhale and longer unforced exhale while the bilateral reach, neck, support contact, rib cage, pelvis, and lumbar region remain within the declared quality contract.',
    family_key='supported_9090_breathing_with_bilateral_reach',
    schema_version='2.0.0',card_version=2,status='review',
    content_confidence=88,scoring_confidence=66,media_confidence=56,
    movement_patterns=ARRAY['breath','reach','brace']::TEXT[],
    body_regions=ARRAY[
      'core','rib_cage','spine','pelvis','hip','knee','shoulder','scapula','neck']::TEXT[],
    required_equipment=ARRAY['wall_or_bench_or_box']::TEXT[],
    optional_equipment=ARRAY['mat','towel','timer']::TEXT[],
    anatomy_json=jsonb_build_object(
      'primaryMuscles',jsonb_build_array('diaphragm','external_intercostals','internal_intercostals'),
      'secondaryMuscles',jsonb_build_array(
        'rectus_abdominis','external_oblique','internal_oblique',
        'transversus_abdominis','serratus_anterior','anterior_deltoid',
        'hamstrings_only_when_light_wall_contact_requires_active_support'),
      'stabilizers',jsonb_build_array(
        'pelvic_floor','deep_spinal_stabilizers','cervical_stabilizers',
        'scapular_stabilizers'),
      'joints',jsonb_build_array(
        'rib_cage','thoracic_spine','lumbar_spine','lumbosacral_complex',
        'pelvis','glenohumeral_joint','scapulothoracic_articulation','hip','knee'),
      'jointActions',jsonb_build_array(
        'inhalation_with_lateral_and_posterior_rib_expansion',
        'controlled_expiration_with_rib_recoil',
        'bilateral_scapular_protraction_reach',
        'bilateral_shoulder_flexion_isometric',
        'static_hip_and_knee_flexion_support',
        'lumbopelvic_position_control_without_forced_flattening_or_crunching'),
      'jointActionPhases',jsonb_build_object(
        'setup',jsonb_build_array(
          'supine_neck_comfortable','variant_declared_leg_support',
          'hips_and_knees_near_ninety_degrees','both_arms_vertical'),
        'inhale',jsonb_build_array(
          'comfortable_nasal_inhale','lower_rib_and_abdominal_expansion',
          'reach_and_support_contact_maintained'),
        'exhale',jsonb_build_array(
          'longer_unforced_exhale','gentle_bilateral_reach_continues',
          'no_crunch_shrug_or_forced_lumbar_flattening'),
        'reset','allow_the_next_comfortable_inhale_without_a_forced_breath_hold'),
      'planes',jsonb_build_array('multi_planar_respiration','sagittal_support_and_reach'),
      'laterality','bilateral',
      'evidenceLimit','Direct instruction supports the position and breathing sequence. Research on diaphragmatic or slow breathing is heterogeneous and does not establish one universal posture, structural reset, treatment effect, sport transfer, dose, recovery interval, or numeric difficulty for this exact reach exercise.'),
    environment_json=jsonb_build_object(
      'surface','level_dry_stable_floor_with_optional_mat',
      'support','variant_declared_stable_wall_or_nonrolling_bench_or_box',
      'clearance',jsonb_build_array(
        'full_supine_body_length','unobstructed_bilateral_vertical_reach',
        'no_cross_traffic','safe_floor_entry_and_exit','coach_side_view'),
      'station','one_supine_lane_and_one_declared_support_interface_per_participant',
      'sightline','coach_can_observe_neck_shoulders_rib_cage_pelvis_support_and_breath_strain',
      'changeRule','Wall versus lower-leg support requires an exact variant. Removing or unilateralizing the reach, adding a hip lift, ball, balloon, limb motion, resistance, or breath hold changes identity or requires separate review.'),
    population_json=shared_population||jsonb_build_object(
      'defaultPopulation','participants_who_can_tolerate_supported_supine_9090_and_bilateral_reach_with_comfortable_unforced_breathing',
      'positionSpecificCautions',jsonb_build_array(
        'shoulder_symptoms_with_vertical_reach','hamstring_cramp_with_wall_contact',
        'supine_hypotensive_or_pressure_symptoms',
        'after_twenty_weeks_pregnancy_consider_non_supine_substitution_and_follow_individual_clinical_guidance'),
      'exclusions',jsonb_build_array(
        'unstable_or_rolling_leg_support','cannot_breathe_comfortably_at_rest',
        'active_chest_pain_faintness_or_unusual_shortness_of_breath',
        'reach_or_supported_hip_knee_position_produces_pain_or_neurologic_symptoms')),
    athlete_support_json=jsonb_build_object(
      'whyItMatters','This low-load drill practices a quiet supported breath cycle while both arms reach. The goal is repeatable, comfortable coordination—not a maximal breath, forced posture change, stretch, or fatigue test.',
      'primaryCue','Let the declared support carry the legs, reach both hands without shrugging, breathe in comfortably, and exhale longer without crunching.',
      'before',jsonb_build_array(
        'Confirm wall-foot or lower-leg-supported variant, support height, breath count, cadence if any, rest, and stop signal.',
        'Check that the wall, bench, or box cannot move and that floor entry and exit are comfortable.',
        'Report pain, dizziness, faintness, panic, air hunger, unusual shortness of breath, pregnancy-related supine concerns, or conflicting clinical instructions.'),
      'during',jsonb_build_array(
        'Keep both arms reaching toward the ceiling without a shoulder shrug.',
        'Take a comfortable nasal inhale; do not chase a maximal breath.',
        'Exhale slowly and unforced while keeping the neck, support contact, ribs, pelvis, and back comfortable.',
        'Do not add a hip lift, heel pull, ball squeeze, balloon, limb motion, or breath hold.'),
      'expectedSensations',jsonb_build_array(
        'gentle_lower_rib_and_abdominal_motion','light_abdominal_wall_activity',
        'light_serratus_and_shoulder_reach_effort','minimal_leg_effort_when_fully_supported'),
      'unexpectedSensations',jsonb_build_array(
        'dizziness_faintness_chest_pain_or_unusual_shortness_of_breath',
        'panic_air_hunger_or_forced_breathing','neck_jaw_or_shoulder_tension',
        'sharp_or_increasing_neck_back_hip_knee_or_shoulder_pain',
        'numbness_tingling_or_new_neurologic_symptom','repeated_hamstring_cramp'),
      'painGuidance','Stop the breath cycle, lower the arms, return to normal comfortable breathing, leave the floor safely, and tell the coach. Do not force another repetition.',
      'selfChecks',jsonb_build_array(
        'correct_support_variant','both_arms_reach_without_shrugging',
        'breath_is_quiet_and_unforced','no_crunch_or_forced_back_flattening',
        'support_does_not_move','same_comfortable_start_before_each_cycle'),
      'accessibility',jsonb_build_array(
        'lower_leg_supported_variant','head_support_that_does_not_obstruct_breathing',
        'smaller_comfortable_hip_knee_angles','shorter_unforced_exhale',
        'fewer_breath_cycles','longer_rest','reviewed_side_lying_or_seated_substitution',
        'written_still_image_or_live_instruction_instead_of_video'),
      'mediaAlternatives',jsonb_build_array(
        'written_setup_inhale_exhale_reset_sequence','side_view_still_sequence',
        'coach_live_demonstration','plain_language_and_visual_breath_timer'),
      'stopSignal','Say stop, lower the arms, return to normal breathing, and report what changed.'),
    coach_support_json=jsonb_build_object(
      'observationChecklist',jsonb_build_array(
        'exact_wall_or_lower_leg_support_variant','support_stability_and_height',
        'bilateral_arm_reach_without_shrug','neck_jaw_and_face_tension',
        'visible_breath_strain_or_breath_hold','rib_pelvis_and_lumbar_comfort',
        'symptoms_breath_count_cadence_and_reset'),
      'faultCorrections',jsonb_build_object(
        'support_moves_or_legs_work_hard','stop_and_fix_support_or_select_lower_leg_supported_variant',
        'shoulders_shrug_or_neck_tenses','reduce_reach_effort_or_range_and_support_the_head_if_appropriate',
        'forced_exhale_or_air_hunger','end_cycle_return_to_normal_breathing_and_reduce_or_remove_cadence',
        'crunch_or_forced_lumbar_flattening','reduce_reach_and_exhale_effort_do_not_force_posture',
        'hamstring_cramp','stop_wall_pressure_and_select_fully_supported_variant_after_reassessment',
        'symptom_or_uncertainty','end_set_and_follow_escalation_protocol'),
      'demonstrationPlan',jsonb_build_array(
        'show_both_exact_support_variants','show_comfortable_bilateral_reach',
        'show_one_unforced_inhale_and_longer_exhale','show_no_crunch_shrug_or_hip_lift',
        'show_first_quality_break_and_safe_exit'),
      'groupManagement',jsonb_build_array(
        'one_participant_per_clear_supine_lane','lock_or brace benches and boxes',
        'declare_variant_and_breath_count_before_start','stagger_starts_for_side_view',
        'keep_voice_cues_optional_and_nonurgent','count_invalid_partial_and_symptom_cycles_as_exposure'),
      'modificationDecisionTree',jsonb_build_array(
        'chest_pain_faintness_unusual_shortness_of_breath_or_neurologic_sign_stop_and_follow_facility_protocol',
        'supine_not_appropriate_select_reviewed_non_supine_substitution',
        'wall_contact_cramp_or_leg_effort_select_lower_leg_support',
        'reach_symptom_remove_reach_only_by_selecting_distinct_no_reach_card',
        'unknown_support_or_breath_contract_quarantine_selection',
        'recompute_duration_fatigue_logistics_and_rendering_after_every_change'),
      'doNotUseWhen',jsonb_build_array(
        'safe_stable_support_or_floor_access_is_unavailable',
        'supported_supine_position_or_bilateral_reach_is_not_tolerated',
        'resting_breathing_is_uncomfortable_or_distressing',
        'symptoms_or_conflicting_clinical_instructions_are_present',
        'fatigue_prevents_repeatable_low_effort_breathing'),
      'validRepetition','One declared comfortable inhale and longer unforced exhale passes with the exact support contact, bilateral reach, no added hip lift or implement, stable support, no symptom, and a comfortable reset.'),
    support_operations_json=shared_support_operations,
    provenance_json=(coalesce(provenance_json,'{}'::JSONB)-'researchSources')
      ||jsonb_build_object(
        'breathingFamilyAuditMigration',migration_key,
        'researchVersion',research_version,'canonicalAuthoredFromResearch',TRUE,
        'legacySources',source_ids,
        'activeWorkingSpecifications',jsonb_build_array(
          'wall-supported-bilateral-reach','lower-leg-supported-bilateral-reach'),
        'researchSources',jsonb_build_array(
          'https://www.functionalmovement.com/Exercises/803/90_90_breathing_with_lateral_expansion',
          'https://veteranshealthlibrary.va.gov/encyclopedia/142%2C82451_VA',
          'https://pubmed.ncbi.nlm.nih.gov/41482169/',
          'https://pubmed.ncbi.nlm.nih.gov/20705944/'),
        'mediaState','five_current_oembed_healthy_candidates_unreviewed',
        'oembedCheckedAt','2026-08-02',
        'difficultyModel','exercise_complexity_and_physical_difficulty_only',
        'primaryIdentitySource','legacy_source_21_plus_direct_FMS_and_VA_instruction',
        'researchLimits','no_trial_of_exact_bilateral_reach_card_no_universal_structural_reset_treatment_sport_transfer_dose_recovery_or_score_claim',
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE,
        'publicationQuarantined',TRUE),
    approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,
    last_reviewed_at=NULL,updated_at=now()
  WHERE id=reach_definition;

  INSERT INTO coaching.exercise_definition_v1(
    id,facility_id,legacy_exercise_id,slug,canonical_name,display_name,aliases,
    description,family_key,schema_version,card_version,status,
    content_confidence,scoring_confidence,media_confidence,movement_patterns,
    body_regions,required_equipment,optional_equipment,environment_json,
    population_json,provenance_json,approved_video_url,created_by,reviewed_by,
    approved_by,last_reviewed_at,anatomy_json,athlete_support_json,
    coach_support_json,support_operations_json)
  VALUES(
    lateral_definition,1,NULL,
    '9090-wall-supported-breathing-with-lateral-expansion',
    '90/90 Wall-Supported Breathing with Lateral Expansion',
    '90/90 Breathing — Lateral Expansion',
    ARRAY[
      '90/90 Breathing without Reach','90/90 Wall Breathing',
      '90-90 Breathing Position','90/90 Diaphragmatic Breathing']::TEXT[],
    'A supine breathing exercise with both feet supported on a stable wall, hips and knees near 90 degrees, and both hands on the lower lateral abdomen/rib margin for feedback. One repetition is a comfortable nasal inhale that expands into the hands, followed by a longer unforced exhale and comfortable reset. There is no arm reach, hip lift, heel pull, ball squeeze, balloon, limb motion, or forced breath hold.',
    'wall_supported_9090_lateral_expansion_breathing','2.0.0',1,'review',
    92,70,56,ARRAY['breath','brace']::TEXT[],
    ARRAY['core','rib_cage','spine','pelvis','hip','knee','neck']::TEXT[],
    ARRAY['wall']::TEXT[],ARRAY['mat','towel','timer']::TEXT[],
    jsonb_build_object(
      'surface','level_dry_stable_floor_with_optional_mat',
      'support','stable_wall_with_both_feet_supported',
      'clearance',jsonb_build_array(
        'full_supine_body_length','safe_floor_entry_and_exit',
        'no_cross_traffic','coach_side_view'),
      'station','one_supine_wall_lane_per_participant',
      'sightline','coach_can_observe_hands_lower_ribs_neck_shoulders_pelvis_feet_and_breath_strain',
      'changeRule','Adding a reach, active heel pull, hip lift, ball, balloon, unsupported legs, limb motion, external pressure, or prescribed breath hold changes identity or requires separate review.'),
    shared_population||jsonb_build_object(
      'defaultPopulation','participants_who_can_tolerate_wall_supported_supine_9090_and_comfortable_unforced_breathing',
      'positionSpecificCautions',jsonb_build_array(
        'hamstring_cramp_or_excess_leg_effort_at_wall','supine_hypotensive_or_pressure_symptoms',
        'after_twenty_weeks_pregnancy_consider_non_supine_substitution_and_follow_individual_clinical_guidance'),
      'exclusions',jsonb_build_array(
        'unstable_or_unavailable_wall_support','cannot_breathe_comfortably_at_rest',
        'active_chest_pain_faintness_or_unusual_shortness_of_breath',
        'wall_supported_hip_or_knee_position_produces_pain_or_neurologic_symptoms')),
    jsonb_build_object(
      'breathingFamilyAuditMigration',migration_key,
      'researchVersion',research_version,'canonicalAuthoredFromResearch',TRUE,
      'primaryIdentitySource','https://www.functionalmovement.com/Exercises/803/90_90_breathing_with_lateral_expansion',
      'researchSources',jsonb_build_array(
        'https://www.functionalmovement.com/Exercises/803/90_90_breathing_with_lateral_expansion',
        'https://veteranshealthlibrary.va.gov/encyclopedia/142%2C82451_VA',
        'https://pubmed.ncbi.nlm.nih.gov/41482169/',
        'https://pubmed.ncbi.nlm.nih.gov/20705944/'),
      'mediaState','five_current_oembed_healthy_candidates_unreviewed',
      'oembedCheckedAt','2026-08-02',
      'difficultyModel','exercise_complexity_and_physical_difficulty_only',
      'researchLimits','direct_professional_instruction_not_a_trial_no_universal_treatment_structural_reset_dose_recovery_or_score_claim',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,
      'publicationQuarantined',TRUE),
    NULL,NULL,NULL,NULL,NULL,
    jsonb_build_object(
      'primaryMuscles',jsonb_build_array('diaphragm','external_intercostals','internal_intercostals'),
      'secondaryMuscles',jsonb_build_array(
        'rectus_abdominis','external_oblique','internal_oblique','transversus_abdominis'),
      'stabilizers',jsonb_build_array(
        'pelvic_floor','deep_spinal_stabilizers','cervical_stabilizers'),
      'joints',jsonb_build_array(
        'rib_cage','thoracic_spine','lumbar_spine','lumbosacral_complex',
        'pelvis','hip','knee'),
      'jointActions',jsonb_build_array(
        'inhalation_with_lateral_and_posterior_rib_expansion',
        'controlled_expiration_with_rib_recoil',
        'static_hip_and_knee_flexion_support',
        'lumbopelvic_position_control_without_forced_flattening_or_crunching'),
      'jointActionPhases',jsonb_build_object(
        'setup',jsonb_build_array(
          'supine_neck_comfortable','both_feet_on_wall',
          'hips_and_knees_near_ninety_degrees','hands_on_lower_lateral_abdomen_and_rib_margin'),
        'inhale',jsonb_build_array(
          'comfortable_nasal_inhale','lateral_expansion_moves_into_both_hands'),
        'exhale',jsonb_build_array(
          'longer_unforced_exhale','hands_monitor_without_pressing_or_resisting'),
        'reset','brief_comfortable_pause_only_if_it_occurs_without_strain'),
      'planes',jsonb_build_array('multi_planar_respiration','sagittal_support_position'),
      'laterality','bilateral',
      'evidenceLimit','FMS specifies the exact position and sequence. Broader breathing research does not prove one universal treatment effect, posture correction, dose, recovery interval, or numeric difficulty for this exercise.'),
    jsonb_build_object(
      'whyItMatters','This drill practices awareness of low and lateral breath motion in a stable position. It is not a maximal lung-volume test, posture correction, or guaranteed nervous-system reset.',
      'primaryCue','Feet supported, hands low on the sides, breathe in comfortably into the hands, and exhale longer without forcing.',
      'before',jsonb_build_array(
        'Confirm wall support, comfortable angles, breath count, cadence if any, rest, and stop signal.',
        'Check floor access and report symptoms or conflicting clinical instructions.'),
      'during',jsonb_build_array(
        'Keep hands as feedback rather than pressing into the body.',
        'Use a comfortable nasal inhale and unforced longer exhale.',
        'Keep neck and shoulders quiet; do not add a reach or hip lift.'),
      'expectedSensations',jsonb_build_array(
        'gentle_lower_rib_and_abdominal_motion','minimal_leg_and_neck_effort'),
      'unexpectedSensations',jsonb_build_array(
        'dizziness_faintness_chest_pain_or_unusual_shortness_of_breath',
        'panic_air_hunger_or_forced_breathing','neck_jaw_or_shoulder_tension',
        'sharp_or_increasing_back_hip_or_knee_pain','numbness_or_tingling'),
      'painGuidance','Stop, return to normal comfortable breathing, leave the floor safely, and tell the coach.',
      'selfChecks',jsonb_build_array(
        'both_feet_supported','hands_low_and_lateral','breath_unforced',
        'neck_and_shoulders_quiet','no_reach_hip_lift_balloon_or_forced_hold'),
      'accessibility',jsonb_build_array(
        'comfortable_nonexact_hip_knee_angles','head_support_that_does_not_obstruct_breathing',
        'shorter_unforced_exhale','fewer_cycles','longer_rest',
        'reviewed_side_lying_or_seated_substitution','written_or_live_instruction'),
      'mediaAlternatives',jsonb_build_array(
        'written_setup_breath_reset_sequence','side_view_still_sequence',
        'coach_live_demonstration','visual_breath_timer'),
      'stopSignal','Say stop, return to normal breathing, and report what changed.'),
    jsonb_build_object(
      'observationChecklist',jsonb_build_array(
        'feet_wall_contact_and_comfortable_angles','hands_on_lower_lateral_ribs',
        'neck_shoulders_jaw_and_face_tension','breath_strain_or_hold',
        'symptoms_breath_count_cadence_and_reset'),
      'faultCorrections',jsonb_build_object(
        'leg_effort_or_cramp','reduce_wall_pressure_or_select_distinct_fully_supported_reach_card_only_if_reach_goal_is_acceptable',
        'upper_chest_neck_or_shoulder_tension','reduce_breath_depth_and_support_head_if_appropriate',
        'forced_exhale_or_air_hunger','end_cycle_and_return_to_normal_breathing',
        'hands_press_or_resist','use_light_feedback_only',
        'symptom_or_uncertainty','end_set_and_follow_escalation_protocol'),
      'demonstrationPlan',jsonb_build_array(
        'show_exact_wall_9090_start','show_hand_feedback_location',
        'show_one_unforced_inhale_and_longer_exhale','show_no_reach_or_hip_lift',
        'show_safe_stop_and_exit'),
      'groupManagement',jsonb_build_array(
        'one_participant_per_clear_wall_lane','declare_breath_count_before_start',
        'stagger_starts_for_observation','count_invalid_partial_and_symptom_cycles_as_exposure'),
      'modificationDecisionTree',jsonb_build_array(
        'urgent_symptom_stop_and_follow_facility_protocol',
        'supine_not_appropriate_select_reviewed_non_supine_substitution',
        'wall_support_not_tolerated_end_or_select_a_separately_reviewed_definition',
        'unknown_breath_contract_quarantine_selection',
        'recompute_duration_fatigue_logistics_and_rendering_after_change'),
      'doNotUseWhen',jsonb_build_array(
        'safe_wall_or_floor_access_is_unavailable','supine_position_not_tolerated',
        'resting_breathing_is_uncomfortable_or_distressing',
        'symptoms_or_conflicting_clinical_instructions_are_present'),
      'validRepetition','One comfortable inhale and longer unforced exhale passes with both feet on the wall, hands at the lower lateral ribs, no added reach or hip lift, and a symptom-free reset.'),
    shared_support_operations)
  ON CONFLICT(id) DO UPDATE SET
    facility_id=EXCLUDED.facility_id,legacy_exercise_id=NULL,slug=EXCLUDED.slug,
    canonical_name=EXCLUDED.canonical_name,display_name=EXCLUDED.display_name,
    aliases=EXCLUDED.aliases,description=EXCLUDED.description,
    family_key=EXCLUDED.family_key,schema_version=EXCLUDED.schema_version,
    card_version=EXCLUDED.card_version,status='review',
    content_confidence=EXCLUDED.content_confidence,
    scoring_confidence=EXCLUDED.scoring_confidence,
    media_confidence=EXCLUDED.media_confidence,
    movement_patterns=EXCLUDED.movement_patterns,
    body_regions=EXCLUDED.body_regions,
    required_equipment=EXCLUDED.required_equipment,
    optional_equipment=EXCLUDED.optional_equipment,
    environment_json=EXCLUDED.environment_json,population_json=EXCLUDED.population_json,
    provenance_json=EXCLUDED.provenance_json,approved_video_url=NULL,
    reviewed_by=NULL,approved_by=NULL,last_reviewed_at=NULL,
    anatomy_json=EXCLUDED.anatomy_json,
    athlete_support_json=EXCLUDED.athlete_support_json,
    coach_support_json=EXCLUDED.coach_support_json,
    support_operations_json=EXCLUDED.support_operations_json,updated_at=now();

  INSERT INTO coaching.exercise_definition_v1(
    id,facility_id,legacy_exercise_id,slug,canonical_name,display_name,aliases,
    description,family_key,schema_version,card_version,status,
    content_confidence,scoring_confidence,media_confidence,movement_patterns,
    body_regions,required_equipment,optional_equipment,environment_json,
    population_json,provenance_json,approved_video_url,created_by,reviewed_by,
    approved_by,last_reviewed_at,anatomy_json,athlete_support_json,
    coach_support_json,support_operations_json)
  VALUES(
    balloon_definition,1,NULL,'9090-hip-lift-with-ball-and-balloon',
    '90/90 Hip Lift with Ball and Balloon',
    '90/90 Hip Lift — Ball and Balloon',
    ARRAY[
      '90/90 Bridge with Ball and Balloon','90-90 Hip Lift with Balloon',
      '90/90 Hip Lift with Right Arm Overhead and Balloon']::TEXT[],
    'From a supine feet-on-wall 90/90 start, place a 4–6 inch ball between the knees, keep the right arm overhead, and hold the balloon with the left hand. Use a heel pull to establish a small posterior pelvic lift while maintaining ball pressure, then perform the declared nasal-inhale and balloon-exhale cycles without losing the lift, ball, wall, arm, or balloon seal contract. This exact asymmetric clinical-suggestion sequence is distinct from passive supported breathing with reach.',
    'wall_supported_9090_hip_lift_balloon_breathing','2.0.0',1,'review',
    82,58,54,ARRAY['breath','brace']::TEXT[],
    ARRAY[
      'core','rib_cage','spine','pelvis','hip','knee','shoulder','hand','neck','hamstrings']::TEXT[],
    ARRAY['wall','ball','balloon']::TEXT[],
    ARRAY['mat','towel','timer']::TEXT[],
    jsonb_build_object(
      'surface','level_dry_stable_floor_with_optional_mat',
      'support','stable_wall_with_both_feet_flat',
      'equipment',jsonb_build_object(
        'ball','clean_intact_four_to_six_inch_compressible_ball',
        'balloon','clean_intact_single_user_balloon_with_material_and_infection_control_checked'),
      'clearance',jsonb_build_array(
        'full_supine_body_length','right_arm_overhead_clearance',
        'balloon_clear_of_face_and_neighbors','no_cross_traffic',
        'safe_floor_entry_and_exit','coach_side_view'),
      'station','one_wall_lane_ball_and_single_user_balloon_per_participant',
      'sightline','coach_can_observe_feet_heels_pelvic_lift_ball_pressure_right_arm_balloon_face_and_breath_strain',
      'changeRule','Changing arm laterality, removing the ball or balloon, adding a hip shift or hemibridge, changing pelvic-lift action, or using passive leg support changes the exact identity and requires separate review.'),
    shared_population||jsonb_build_object(
      'defaultPopulation','participants_individually_cleared_for_supine_wall_supported_hip_lift_ball_squeeze_and_balloon_exhalation',
      'positionSpecificCautions',jsonb_build_array(
        'latex_or_balloon_material_sensitivity','difficulty_sealing_or_inflating_balloon',
        'hamstring_or_adductor_cramp','jaw_face_neck_or_pelvic_floor_pressure_symptoms',
        'respiratory_or_cardiovascular_condition_requiring_individualized_breathing_instruction',
        'after_twenty_weeks_pregnancy_consider_non_supine_substitution_and_follow_individual_clinical_guidance'),
      'exclusions',jsonb_build_array(
        'unresolved_balloon_material_allergy_or_infection_control',
        'balloon_is_damaged_shared_or_a_choking_hazard',
        'cannot_breathe_comfortably_at_rest_or_cannot_manage_balloon_safely',
        'active_chest_pain_faintness_unusual_shortness_of_breath_or_panic',
        'wall_position_heel_pull_ball_squeeze_pelvic_lift_or_overhead_arm_produces_pain_or_neurologic_symptoms'),
      'supervision','direct_coach_or_clinician_observation_required_until_equipment_breath_and_pressure_control_are_demonstrated'),
    jsonb_build_object(
      'breathingFamilyAuditMigration',migration_key,
      'researchVersion',research_version,'canonicalAuthoredFromResearch',TRUE,
      'primaryIdentitySource','https://pmc.ncbi.nlm.nih.gov/articles/PMC2971640/',
      'researchSources',jsonb_build_array(
        'https://pmc.ncbi.nlm.nih.gov/articles/PMC2971640/',
        'https://pubmed.ncbi.nlm.nih.gov/41482169/',
        'https://pubmed.ncbi.nlm.nih.gov/20705944/'),
      'mediaState','five_current_oembed_healthy_candidates_unreviewed',
      'oembedCheckedAt','2026-08-02',
      'difficultyModel','exercise_complexity_and_physical_difficulty_only',
      'researchLimits','primary_exact_source_is_a_clinical_suggestion_not_outcome_validation_for_general_workout_populations',
      'mustNotInheritLegacySource1404',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,
      'publicationQuarantined',TRUE),
    NULL,NULL,NULL,NULL,NULL,
    jsonb_build_object(
      'primaryMuscles',jsonb_build_array(
        'diaphragm','external_intercostals','internal_intercostals',
        'hamstrings','adductors','abdominal_wall'),
      'secondaryMuscles',jsonb_build_array(
        'gluteus_maximus','transversus_abdominis','external_oblique',
        'internal_oblique','pelvic_floor','right_shoulder_flexors',
        'left_hand_and_oral_muscles_for_balloon_control'),
      'stabilizers',jsonb_build_array(
        'deep_spinal_stabilizers','cervical_stabilizers',
        'scapular_stabilizers','foot_and_ankle_stabilizers'),
      'joints',jsonb_build_array(
        'rib_cage','thoracic_spine','lumbar_spine','lumbosacral_complex',
        'pelvis','hip','knee','ankle','glenohumeral_joint',
        'scapulothoracic_articulation','temporomandibular_joint','hand'),
      'jointActions',jsonb_build_array(
        'bilateral_isometric_heel_pull_and_knee_flexion',
        'small_posterior_pelvic_lift','isometric_hip_adduction_ball_squeeze',
        'right_shoulder_flexion_overhead_isometric',
        'left_hand_balloon_stabilization',
        'nasal_inhalation','controlled_expiration_against_balloon_resistance',
        'rib_cage_expansion_and_recoil_under_maintained_position'),
      'jointActionPhases',jsonb_build_object(
        'setup',jsonb_build_array(
          'supine_feet_flat_on_wall_hips_and_knees_near_ninety',
          'ball_between_knees','right_arm_overhead','left_hand_holds_balloon'),
        'establish',jsonb_build_array(
          'light_ball_pressure','heels_pull_down_without_pushing_away',
          'tailbone_lifts_slightly_while_low_back_remains_supported'),
        'breathCycle',jsonb_build_array(
          'comfortable_nasal_inhale','slow_exhale_into_balloon',
          'maintain_lift_ball_pressure_wall_contact_arm_and_balloon_control'),
        'reset','end_on_first_quality_break_deflate_or_secure_balloon_and_lower_pelvis_under_control'),
      'planes',jsonb_build_array(
        'multi_planar_respiration','sagittal_pelvic_lift','frontal_isometric_adduction'),
      'laterality','bilateral_lower_body_with_right_arm_overhead_and_left_hand_balloon',
      'evidenceLimit','The exact source is a clinical suggestion that combines theory and technique. It does not establish universal structural correction, pain reduction, readiness, safety, dose, recovery, sport transfer, or numeric difficulty.'),
    jsonb_build_object(
      'whyItMatters','This is a coordinated breathing and low-amplitude hip-lift exercise using a ball and balloon. It is not interchangeable with passive 90/90 breathing and does not guarantee posture correction, pain relief, or recovery.',
      'primaryCue','Heels pull, small tailbone lift, gentle ball pressure, right arm overhead, breathe in through the nose, and exhale slowly into the balloon without straining.',
      'before',jsonb_build_array(
        'Confirm the exact right-arm-overhead and left-hand-balloon sequence, ball size, balloon material, hygiene, cycles, rest, and stop signal.',
        'Check wall, floor, ball, balloon, overhead clearance, and direct coach sightline.',
        'Report allergy, respiratory or cardiovascular concern, pelvic pressure symptom, pain, dizziness, faintness, panic, air hunger, or conflicting clinical instruction.'),
      'during',jsonb_build_array(
        'Maintain light ball pressure and a small controlled pelvic lift.',
        'Keep feet on the wall and pull with the heels rather than pushing the body away.',
        'Keep the right arm overhead and stabilize the balloon with the left hand.',
        'Use a comfortable nasal inhale and slow balloon exhale; do not force cheeks, jaw, breath depth, or retention.'),
      'expectedSensations',jsonb_build_array(
        'hamstring_and_inner_thigh_effort','abdominal_wall_activity',
        'controlled_balloon_resistance','right_overhead_arm_position_without_pain'),
      'unexpectedSensations',jsonb_build_array(
        'dizziness_faintness_chest_pain_or_unusual_shortness_of_breath',
        'panic_air_hunger_or_forced_breathing','jaw_face_neck_or_head_pressure',
        'pelvic_floor_pressure_leakage_coning_or_doming',
        'sharp_or_increasing_back_hip_knee_or_shoulder_pain',
        'numbness_tingling_or_new_neurologic_symptom','severe_hamstring_or_adductor_cramp'),
      'painGuidance','Stop blowing, secure or remove the balloon, release ball pressure, lower the pelvis, return to normal breathing, and tell the coach. Do not retry automatically.',
      'selfChecks',jsonb_build_array(
        'feet_wall_contact','small_controlled_tailbone_lift','light_ball_pressure',
        'right_arm_overhead_left_hand_balloon','unforced_balloon_exhale',
        'no_push_away_glute_bridge_jaw_strain_or_symptom'),
      'accessibility',jsonb_build_array(
        'separately_select_passive_9090_breathing_card_when_balloon_or_hip_lift_goal_can_change',
        'lower_ball_pressure','smaller_owned_pelvic_lift','fewer_breath_cycles',
        'longer_rest','latex_free_balloon_after_material_review',
        'written_still_image_or_live_instruction_instead_of_video'),
      'mediaAlternatives',jsonb_build_array(
        'written_setup_establish_breathe_reset_sequence','side_view_still_sequence',
        'coach_live_demonstration','equipment_and_hygiene_checklist'),
      'stopSignal','Stop blowing, secure the balloon, lower the pelvis, and report what changed.'),
    jsonb_build_object(
      'observationChecklist',jsonb_build_array(
        'exact_arm_and_balloon_laterality','wall_foot_and_heel_pull_contract',
        'ball_position_and_pressure','small_pelvic_lift_without_push_away',
        'right_overhead_arm','left_hand_balloon_seal_and_control',
        'jaw_cheek_neck_and_face_strain','breath_symptoms_cycles_and_reset'),
      'faultCorrections',jsonb_build_object(
        'feet_push_body_away_or_glutes_dominate','stop_reduce_lift_and_reteach_heel_pull',
        'ball_drops_or_is_crushed','reset_with_light_continuous_pressure',
        'pelvis_lifts_high_or_back_arches','lower_to_small_owned_tailbone_lift',
        'balloon_or_jaw_control_fails','stop_secure_balloon_and_select_passive_card_if_goal_allows',
        'breath_strain_dizziness_or_pressure_symptom','end_set_and_follow_escalation_protocol',
        'wrong_arm_laterality_or_added_hip_shift','quarantine_selection_as_identity_mismatch'),
      'demonstrationPlan',jsonb_build_array(
        'show_equipment_and_hygiene_check','show_exact_start_and_laterality',
        'show_heel_pull_small_lift_and_ball_pressure','show_one_balloon_cycle',
        'show_common_push_away_high_bridge_and_jaw_strain_faults',
        'show_safe_balloon_removal_pelvic_lowering_and_exit'),
      'groupManagement',jsonb_build_array(
        'direct_observation_and_one_single_user_balloon_per_participant',
        'do_not_share_mouth_contact_equipment','stagger_starts_for_full_sightline',
        'keep_neighbors_out_of_balloon_path','record_invalid_partial_and_symptom_cycles_as_exposure'),
      'modificationDecisionTree',jsonb_build_array(
        'urgent_symptom_stop_and_follow_facility_protocol',
        'material_hygiene_or_choking_risk_remove_balloon_and_end_exact_exercise',
        'hip_lift_ball_or_laterality_not_tolerated_select_distinct_passive_card_only_if_goal_can_change',
        'unknown_exact_contract_quarantine_selection',
        'recompute_identity_dose_fatigue_duration_logistics_and_rendering_after_change'),
      'doNotUseWhen',jsonb_build_array(
        'direct_supervision_wall_ball_balloon_hygiene_or_clearance_is_unavailable',
        'material_allergy_or_balloon_safety_is_unresolved',
        'supine_heel_pull_hip_lift_ball_squeeze_or_overhead_position_is_not_tolerated',
        'resting_breathing_is_uncomfortable_or_distressing',
        'symptoms_or_conflicting_clinical_instructions_are_present'),
      'validRepetition','One declared nasal-inhale and balloon-exhale cycle passes while feet, heel pull, small pelvic lift, ball pressure, right overhead arm, left-hand balloon control, and symptom-free breathing remain exact.'),
    shared_support_operations)
  ON CONFLICT(id) DO UPDATE SET
    facility_id=EXCLUDED.facility_id,legacy_exercise_id=NULL,slug=EXCLUDED.slug,
    canonical_name=EXCLUDED.canonical_name,display_name=EXCLUDED.display_name,
    aliases=EXCLUDED.aliases,description=EXCLUDED.description,
    family_key=EXCLUDED.family_key,schema_version=EXCLUDED.schema_version,
    card_version=EXCLUDED.card_version,status='review',
    content_confidence=EXCLUDED.content_confidence,
    scoring_confidence=EXCLUDED.scoring_confidence,
    media_confidence=EXCLUDED.media_confidence,
    movement_patterns=EXCLUDED.movement_patterns,
    body_regions=EXCLUDED.body_regions,
    required_equipment=EXCLUDED.required_equipment,
    optional_equipment=EXCLUDED.optional_equipment,
    environment_json=EXCLUDED.environment_json,population_json=EXCLUDED.population_json,
    provenance_json=EXCLUDED.provenance_json,approved_video_url=NULL,
    reviewed_by=NULL,approved_by=NULL,last_reviewed_at=NULL,
    anatomy_json=EXCLUDED.anatomy_json,
    athlete_support_json=EXCLUDED.athlete_support_json,
    coach_support_json=EXCLUDED.coach_support_json,
    support_operations_json=EXCLUDED.support_operations_json,updated_at=now();

  -- EXACT_VARIANTS

  -- DELIVERY_PROFILES

  -- EVIDENCE_MEDIA_ALTERNATES

  -- IDENTITY_GRAPH_CALIBRATION

  -- LEGACY_AND_PACKETS

  -- FINAL_ASSERTIONS
END $$;
