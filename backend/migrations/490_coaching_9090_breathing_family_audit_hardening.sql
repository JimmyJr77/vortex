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

  INSERT INTO coaching.exercise_variant_v1(
    id,definition_id,variant_key,display_name,modifier_keys,difficulty_json,
    requirements_json,status,load_profile_json,fatigue_profile_json,
    programming_profile_json)
  SELECT v.id,v.definition_id,v.variant_key,v.display_name,v.modifier_keys,
    jsonb_build_object(
      'technicalComplexity',v.complexity,
      'absoluteLoadDemand',v.physical,
      'physicalDifficulty',v.physical,
      'relativeStrengthDemand',v.relative_strength,
      'mobilityDemand',v.mobility,'balanceDemand',1,
      'stabilityDemand',v.stability,'coordinationDemand',v.coordination,
      'speedDemand',1,'decisionDemand',v.decision,
      'workCapacityDemand',v.work_capacity,'impact',1,
      'eccentricTissueStress',v.eccentric,'jointStress',v.joint_stress,
      'spinalLoading',v.spinal_loading,'gripDemand',v.grip,
      'inversionDemand',1,'fearConfidenceBarrier',v.fear,
      'supervisionDemand',v.supervision,'spottingDemand',1,
      'failureConsequence',v.failure,
      'baseOverallDifficulty',greatest(v.complexity,v.physical),
      'technicalMeaning','exercise_complexity',
      'loadMeaning','physical_difficulty',
      'overallFormula','max(exercise_complexity,physical_difficulty)',
      'scoreState','review_only_requires_independent_calibration'),
    v.requirements,'review',
    jsonb_build_object(
      'gripDemand',v.grip,'externalLoadMethod',v.external_load_method,
      'externalLoadDescription',v.external_load_description,
      'spinalLoading',v.spinal_loading,'eccentricStress',v.eccentric,
      'landingContactsPerRep',0,'impactClass','none',
      'supportLoading',v.support_loading,
      'effectiveLoadDrivers',v.load_drivers,
      'loadTracking',v.load_tracking),
    jsonb_build_object(
      'localMuscleFatigue',v.local_fatigue,'gripFatigue',v.grip_fatigue,
      'technicalFatigueSensitivity',v.technical_fatigue,
      'impactAccumulation',1,'recoveryHours',v.recovery_hours,
      'recoveryWindow',v.recovery_window,
      'recoveryEvidence','Planning estimate only. Exact recovery depends on dose, breath effort, novelty, symptoms, same-session trunk and respiratory work, and—where present—hip-lift, adductor, shoulder, jaw, and balloon demands.',
      'primaryFatigueSites',v.fatigue_sites,
      'earlyFatigueSignals',v.fatigue_signals,
      'downstreamConflicts',v.downstream_conflicts),
    jsonb_build_object(
      'trainingStimuli',v.training_stimuli,
      'stimulusDose',jsonb_build_object(
        'primary','valid_comfortable_breath_cycles',
        'countInvalidPartialAssistedAndSymptomCyclesAsExposure',TRUE,
        'fatigueCeiling',v.fatigue_ceiling),
      'weeklyExposure','Combine valid, invalid, partial, assisted, and symptom-limited breath cycles with all other breath training, trunk-control work, supine time, and—when applicable—hamstring, adductor, hip-lift, shoulder, jaw, balloon, and pelvic-floor pressure exposure.',
      'prerequisites',v.prerequisites,
      'completionCriteria',v.completion_criteria,
      'sequenceRules',v.sequence_rules,
      'pairingCompatibility',v.pairing,
      'interferenceRules',v.interference,
      'uncertaintyPolicy',jsonb_build_object(
        'unknownSupportReachHipLiftBallBalloonCadenceSymptomsOrClinicalRestriction',
          'fail_closed_and_request_coach_or_content_review',
        'neverInferMissingMechanicsFromNameVideoTitleOrLegacyOutcomeClaim',TRUE,
        'neverAutoApproveMediaGraphCalibrationContentOrPublication',TRUE),
      'cumulativeBudget',v.cumulative_budget)
  FROM (VALUES
    (reach_wall_variant,reach_definition,
      'wall-supported-bilateral-reach',
      '90/90 Breathing with Reach — Feet on Wall',
      ARRAY['wall_supported','feet_on_wall','bilateral_reach','unloaded']::TEXT[],
      26,8,6,15,18,28,8,6,4,4,4,1,2,12,6,
      jsonb_build_object(
        'start','supine_feet_flat_on_stable_wall_hips_and_knees_near_ninety_arms_vertical',
        'supportInterface','both_feet_flat_on_wall',
        'legAction','light_contact_only_without_prescribed_heel_pull_or_pelvic_lift',
        'armAction','bilateral_vertical_reach_with_gentle_scapular_protraction',
        'breathCycle','comfortable_nasal_inhale_then_longer_unforced_exhale',
        'trunkContract','comfortable_rib_pelvis_and_lumbar_position_without_forced_flattening_or_crunching',
        'completion','same_supported_reach_start_and_normal_comfortable_breathing_restored',
        'invalidatingEvents',jsonb_build_array(
          'support_moves','prescribed_contact_lost','hip_lift_or_heel_pull_added',
          'shoulder_shrug_or_reach_lost','forced_breath_or_breath_hold',
          'crunch_or_forced_back_flattening','symptom_or_distress'),
        'selectable',TRUE,'identityQuarantine',FALSE,
        'workingSpecificationRequiresHumanReview',TRUE),
      'bodyweight_with_wall_contact',
      'No external load. Both feet contact a stable wall; no prescribed heel pull, hip lift, ball, balloon, or partner force is part of this variant.',
      'bilateral_feet_wall_contact_with_low_leg_effort',
      jsonb_build_array(
        'arm_segment_position','reach_effort','breath_depth_and_exhale_length',
        'wall_distance_and_hip_knee_angles','unintended_foot_pressure',
        'prior_respiratory_trunk_or_shoulder_fatigue'),
      jsonb_build_array(
        'exact_support_variant','hip_and_knee_angles','breath_cycles',
        'cadence_if_prescribed','reach_quality','invalid_partial_and_symptom_cycles',
        'same_session_breath_trunk_and_shoulder_work'),
      6,1,18,4,
      'typically_0_to_8_hours_for_low_effort_symptom_free_practice',
      jsonb_build_array('respiratory_muscles','abdominal_wall','serratus_anterior','shoulder_flexors'),
      jsonb_build_array(
        'neck_jaw_or_shoulder_tension','reach_shortening_or_shrug',
        'forced_exhale_or_air_hunger','rib_pelvis_or_back_discomfort',
        'wall_pressure_or_hamstring_cramp','breath_hold_or_dizziness'),
      jsonb_build_array(
        'priority_breath_control_or_trunk_coordination_if_fatigue_or_symptoms_occur',
        'high_volume_overhead_or_serratus_work_when_reach_quality_is_priority',
        'any_session_with_unusual_respiratory_cardiovascular_or_neurologic_symptoms'),
      jsonb_build_array(
        'supported_breath_cycle_coordination','bilateral_reach_control',
        'low_effort_trunk_position_awareness'),
      'low',
      jsonb_build_array(
        'stable_wall_and_safe_floor_lane','comfortable_supported_supine_position',
        'pain_free_bilateral_vertical_reach','comfortable_resting_breathing',
        'exact_variant_and_stop_signal_understood'),
      jsonb_build_array(
        'exact_feet_on_wall_contact','bilateral_reach_without_shrug',
        'comfortable_inhale_and_longer_unforced_exhale',
        'no_hip_lift_heel_pull_ball_balloon_or_forced_hold',
        'symptom_free_reset_and_dose_recorded'),
      jsonb_build_array(
        'use_early_in_prepare_and_access_or_late_in_restore_when_low_effort_quality_is_the_goal',
        'place_before_fatiguing_trunk_shoulder_or_breath_work_when_coordination_is_priority',
        'do_not_use_as_a_maximal_breath_or_posture_test','stop_on_first_strain_or_symptom'),
      jsonb_build_array('low_demand_mobility','noncompeting_technique_preparation'),
      jsonb_build_array(
        'do_not_prefatigue_respiratory_or_reach_muscles_before_quality_cycles',
        'do_not_silently_change_to_no_reach_hip_lift_balloon_dead_bug_or_breath_hold',
        'recompute_identity_dose_fatigue_duration_logistics_and_rendering_after_substitution'),
      jsonb_build_object(
        'breathCycles',12,'prescribedExhaleSeconds',72,
        'bilateralReachSecondsEstimate',120,'invalidCyclesCount',TRUE,
        'sameSessionBreathTrunkAndShoulderExposureRequired',TRUE)),
    (reach_support_variant,reach_definition,
      'lower-leg-supported-bilateral-reach',
      '90/90 Breathing with Reach — Lower Legs Supported',
      ARRAY['bench_or_box_supported','lower_legs_supported','bilateral_reach','unloaded']::TEXT[],
      22,5,3,12,12,22,6,4,3,3,3,1,2,10,5,
      jsonb_build_object(
        'start','supine_lower_legs_fully_supported_on_stable_bench_or_box_hips_and_knees_near_ninety_arms_vertical',
        'supportInterface','calves_and_or_heels_fully_supported_on_nonrolling_bench_or_box',
        'legAction','passive_support_without_heel_drive_or_pelvic_lift',
        'armAction','bilateral_vertical_reach_with_gentle_scapular_protraction',
        'breathCycle','comfortable_nasal_inhale_then_longer_unforced_exhale',
        'trunkContract','comfortable_rib_pelvis_and_lumbar_position_without_forced_flattening_or_crunching',
        'completion','same_fully_supported_reach_start_and_normal_comfortable_breathing_restored',
        'invalidatingEvents',jsonb_build_array(
          'bench_or_box_moves','lower_leg_support_lost','heel_drive_or_hip_lift_added',
          'shoulder_shrug_or_reach_lost','forced_breath_or_breath_hold',
          'crunch_or_forced_back_flattening','symptom_or_distress'),
        'selectable',TRUE,'identityQuarantine',FALSE,
        'workingSpecificationRequiresHumanReview',TRUE),
      'bodyweight_with_full_lower_leg_support',
      'No external load. Calves and/or heels rest fully on a stable nonrolling bench or box; no heel drive, hip lift, ball, balloon, or partner force is part of this variant.',
      'lower_legs_fully_supported_minimal_leg_effort',
      jsonb_build_array(
        'arm_segment_position','reach_effort','breath_depth_and_exhale_length',
        'support_height_and_hip_knee_angles','prior_respiratory_trunk_or_shoulder_fatigue'),
      jsonb_build_array(
        'exact_support_variant','support_height','breath_cycles','cadence_if_prescribed',
        'reach_quality','invalid_partial_and_symptom_cycles',
        'same_session_breath_trunk_and_shoulder_work'),
      4,1,16,3,
      'typically_0_to_8_hours_for_low_effort_symptom_free_practice',
      jsonb_build_array('respiratory_muscles','abdominal_wall','serratus_anterior','shoulder_flexors'),
      jsonb_build_array(
        'neck_jaw_or_shoulder_tension','reach_shortening_or_shrug',
        'forced_exhale_or_air_hunger','rib_pelvis_or_back_discomfort',
        'support_instability','breath_hold_or_dizziness'),
      jsonb_build_array(
        'priority_breath_control_or_trunk_coordination_if_fatigue_or_symptoms_occur',
        'high_volume_overhead_or_serratus_work_when_reach_quality_is_priority',
        'any_session_with_unusual_respiratory_cardiovascular_or_neurologic_symptoms'),
      jsonb_build_array(
        'fully_supported_breath_cycle_coordination','bilateral_reach_control',
        'low_effort_trunk_position_awareness'),
      'low',
      jsonb_build_array(
        'stable_nonrolling_bench_or_box_and_safe_floor_lane',
        'comfortable_supported_supine_position','pain_free_bilateral_vertical_reach',
        'comfortable_resting_breathing','exact_variant_and_stop_signal_understood'),
      jsonb_build_array(
        'exact_lower_leg_support','bilateral_reach_without_shrug',
        'comfortable_inhale_and_longer_unforced_exhale',
        'no_heel_drive_hip_lift_ball_balloon_or_forced_hold',
        'symptom_free_reset_and_dose_recorded'),
      jsonb_build_array(
        'use_when_full_leg_support_best_preserves_low_effort_breath_and_reach_quality',
        'place_before_fatiguing_trunk_shoulder_or_breath_work_when_coordination_is_priority',
        'do_not_use_as_a_maximal_breath_or_posture_test','stop_on_first_strain_or_symptom'),
      jsonb_build_array('low_demand_mobility','noncompeting_technique_preparation'),
      jsonb_build_array(
        'do_not_prefatigue_respiratory_or_reach_muscles_before_quality_cycles',
        'do_not_silently_change_to_wall_foot_pressure_no_reach_hip_lift_balloon_dead_bug_or_breath_hold',
        'recompute_identity_dose_fatigue_duration_logistics_and_rendering_after_substitution'),
      jsonb_build_object(
        'breathCycles',15,'prescribedExhaleSeconds',90,
        'bilateralReachSecondsEstimate',150,'invalidCyclesCount',TRUE,
        'sameSessionBreathTrunkAndShoulderExposureRequired',TRUE)),
    (lateral_wall_variant,lateral_definition,
      'wall-supported-hands-on-lateral-ribs',
      '90/90 Wall Breathing — Hands on Lateral Ribs',
      ARRAY['wall_supported','hands_on_lateral_ribs','no_reach','unloaded']::TEXT[],
      16,4,2,10,8,16,5,3,2,2,2,1,2,8,4,
      jsonb_build_object(
        'start','supine_feet_on_stable_wall_hips_and_knees_near_ninety_hands_on_lower_lateral_ribs',
        'supportInterface','both_feet_on_wall',
        'legAction','light_contact_without_prescribed_heel_pull_or_pelvic_lift',
        'armAction','hands_remain_on_lower_lateral_abdomen_and_rib_margin_as_feedback',
        'breathCycle','approximately_three_second_comfortable_nasal_inhale_then_four_to_six_second_unforced_nasal_exhale_with_optional_comfortable_pause',
        'trunkContract','comfortable_neutral_neck_and_spine_without_forced_flattening_or_crunching',
        'completion','hands_feet_and_supported_position_retained_and_normal_comfortable_breathing_restored',
        'invalidatingEvents',jsonb_build_array(
          'wall_contact_lost','hands_press_or_leave_feedback_position',
          'reach_hip_lift_ball_or_balloon_added','forced_breath_or_hold',
          'neck_shoulder_or_trunk_strain','symptom_or_distress'),
        'selectable',TRUE,'identityQuarantine',FALSE,
        'workingSpecificationRequiresHumanReview',TRUE),
      'bodyweight_with_wall_contact',
      'No external load. Hands provide sensory feedback only and must not press against or resist the breath.',
      'feet_wall_contact_and_hands_lightly_resting_on_lateral_ribs',
      jsonb_build_array(
        'breath_depth_and_cadence','wall_distance_and_hip_knee_angles',
        'unintended_foot_or_hand_pressure','prior_respiratory_or_trunk_fatigue'),
      jsonb_build_array(
        'wall_support','hand_feedback_location','breath_cycles','cadence_if_prescribed',
        'invalid_partial_and_symptom_cycles','same_session_breath_and_trunk_work'),
      3,1,12,2,
      'typically_0_to_6_hours_for_low_effort_symptom_free_practice',
      jsonb_build_array('respiratory_muscles','abdominal_wall'),
      jsonb_build_array(
        'upper_chest_neck_or_jaw_tension','hands_press_or_grip',
        'forced_breath_or_air_hunger','wall_pressure_or_hamstring_cramp',
        'breath_hold_or_dizziness'),
      jsonb_build_array(
        'priority_breath_awareness_if_strain_or_symptoms_occur',
        'any_session_with_unusual_respiratory_cardiovascular_or_neurologic_symptoms'),
      jsonb_build_array('wall_supported_breath_awareness','lateral_rib_feedback'),
      'very_low',
      jsonb_build_array(
        'stable_wall_and_safe_floor_lane','comfortable_supported_supine_position',
        'comfortable_resting_breathing','hand_feedback_position_and_stop_signal_understood'),
      jsonb_build_array(
        'feet_supported_and_hands_on_lateral_ribs','comfortable_unforced_breath_cycle',
        'neck_and_shoulders_quiet','no_reach_hip_lift_ball_balloon_or_forced_hold',
        'symptom_free_reset_and_dose_recorded'),
      jsonb_build_array(
        'use_for_low_effort_breath_awareness_not_as_a_maximal_test',
        'place before fatiguing breath or trunk work when awareness is priority',
        'stop_on_first_strain_or_symptom'),
      jsonb_build_array('low_demand_mobility','quiet_transition_between_blocks'),
      jsonb_build_array(
        'do_not_force_cadence_depth_or_pause',
        'do_not_silently_add_reach_hip_lift_balloon_or_limb_motion',
        'recompute_identity_dose_duration_logistics_and_rendering_after_substitution'),
      jsonb_build_object(
        'breathCycles',18,'prescribedExhaleSeconds',108,
        'invalidCyclesCount',TRUE,'sameSessionBreathAndTrunkExposureRequired',TRUE)),
    (balloon_variant,balloon_definition,
      'right-arm-overhead-left-hand-balloon',
      '90/90 Hip Lift — Right Arm Overhead / Left Hand Balloon',
      ARRAY['wall_supported','hip_lift','ball_squeeze','balloon','right_arm_overhead','left_hand_balloon']::TEXT[],
      48,20,22,24,42,54,18,30,18,12,12,12,14,40,24,
      jsonb_build_object(
        'start','supine_feet_flat_on_wall_hips_and_knees_near_ninety_ball_between_knees_right_arm_overhead_left_hand_holds_balloon',
        'supportInterface','both_feet_flat_on_wall',
        'legAction','heels_pull_down_to_create_small_posterior_pelvic_lift_while_ball_pressure_is_maintained',
        'armAction','right_arm_fixed_overhead_left_hand_stabilizes_balloon',
        'breathCycle','comfortable_nasal_inhale_then_slow_exhale_into_balloon_with_position_maintained',
        'trunkContract','low_back_supported_without_high_bridge_push_away_or_forced_spinal_motion',
        'completion','declared_balloon_cycle_completed_then_balloon_secured_and_position_retained_or_pelvis_lowered_under_control',
        'invalidatingEvents',jsonb_build_array(
          'wrong_arm_or_balloon_laterality','feet_or_ball_contact_lost',
          'push_away_or_high_glute_bridge','pelvic_lift_or_ball_pressure_lost',
          'balloon_seal_or_control_lost','jaw_cheek_neck_or_breath_strain',
          'breath_hold_outside_declared_comfortable_pause','symptom_or_distress'),
        'selectable',TRUE,'identityQuarantine',FALSE,
        'workingSpecificationRequiresHumanReview',TRUE),
      'bodyweight_isometric_ball_pressure_and_balloon_expiratory_resistance',
      'Bodyweight hip-lift and heel-pull demand plus a compressible 4–6 inch ball and balloon expiratory resistance. No added weight is part of the exact variant.',
      'feet_on_wall_heel_pull_small_pelvic_lift_ball_adduction_right_arm_overhead_left_hand_balloon',
      jsonb_build_array(
        'body_segment_mass','pelvic_lift_height','heel_pull','ball_compression',
        'balloon_resistance','breath_depth_and_cycle_count','right_overhead_arm_position',
        'prior_hamstring_adductor_trunk_respiratory_shoulder_jaw_or_pelvic_floor_fatigue'),
      jsonb_build_array(
        'exact_laterality','pelvic_lift_height','heel_pull','ball_size_and_pressure',
        'balloon_material_and_resistance','breath_cycles','invalid_partial_assisted_and_symptom_cycles',
        'same_session_breath_trunk_hamstring_adductor_shoulder_and_pressure_work'),
      24,12,52,8,
      'typically_6_to_18_hours_as_a_conservative_planning_estimate_after_low_volume_symptom_free_practice',
      jsonb_build_array(
        'hamstrings','adductors','abdominal_wall','respiratory_muscles',
        'right_shoulder_flexors','left_hand_and_oral_muscles'),
      jsonb_build_array(
        'pelvic_lift_or_ball_pressure_loss','feet_push_body_away',
        'hamstring_or_adductor_cramp','right_arm_position_loss',
        'balloon_seal_loss_or_cheek_jaw_neck_strain','forced_breath_or_air_hunger',
        'pelvic_pressure_coning_doming_dizziness_or_other_symptom'),
      jsonb_build_array(
        'priority_hamstring_adductor_trunk_or_breath_work',
        'high_volume_overhead_or_jaw_or_respiratory_training',
        'pressure_sensitive_or_symptomatic_training',
        'any_session_with_unusual_respiratory_cardiovascular_or_neurologic_symptoms'),
      jsonb_build_array(
        'wall_supported_small_hip_lift_control','isometric_adductor_ball_pressure',
        'balloon_exhalation_coordination','asymmetric_upper_limb_position_control'),
      'low_to_moderate',
      jsonb_build_array(
        'direct_supervision_and_exact_sequence_understood',
        'stable_wall_safe_floor_intact_ball_and_single_user_balloon',
        'material_allergy_hygiene_and_choking_risk_checked',
        'pain_free_wall_hip_lift_ball_squeeze_and_right_overhead_position',
        'comfortable_resting_breathing_and_stop_signal_understood'),
      jsonb_build_array(
        'exact_right_arm_overhead_left_hand_balloon_laterality',
        'feet_wall_heel_pull_small_pelvic_lift_and_ball_pressure',
        'comfortable_nasal_inhale_and_slow_balloon_exhale',
        'no_push_away_high_bridge_jaw_strain_or_unplanned_hold',
        'safe_balloon_control_symptom_free_reset_and_dose_recorded'),
      jsonb_build_array(
        'use_only_when_the_exact_hip_lift_ball_and_balloon_goal_is_selected',
        'place before fatiguing hamstring adductor trunk shoulder or respiratory work when technique is priority',
        'do_not_use_as_group_conditioning_or_unsupervised_breath_challenge',
        'stop_on_first_equipment_position_breath_or_symptom_failure'),
      jsonb_build_array('individualized_trunk_control_or_breath_coordination_block'),
      jsonb_build_array(
        'do_not_prefatigue_hamstrings_adductors_trunk_shoulder_jaw_or_respiratory_system_before_quality_cycles',
        'do_not_silently_mirror_laterality_remove_equipment_add_hip_shift_or_substitute_passive_breathing',
        'recompute_identity_dose_fatigue_duration_logistics_and_rendering_after_substitution'),
      jsonb_build_object(
        'balloonBreathCycles',10,'activeHipLiftSecondsEstimate',120,
        'ballSqueezeSecondsEstimate',120,'balloonExhalationSeconds',80,
        'invalidPartialAssistedAndSymptomCyclesCount',TRUE,
        'sameSessionBreathTrunkHamstringAdductorShoulderAndPressureExposureRequired',TRUE))
  ) v(
    id,definition_id,variant_key,display_name,modifier_keys,
    complexity,physical,relative_strength,mobility,stability,coordination,
    work_capacity,decision,eccentric,joint_stress,spinal_loading,grip,fear,
    supervision,failure,requirements,external_load_method,
    external_load_description,support_loading,load_drivers,load_tracking,
    local_fatigue,grip_fatigue,technical_fatigue,recovery_hours,
    recovery_window,fatigue_sites,fatigue_signals,downstream_conflicts,
    training_stimuli,fatigue_ceiling,prerequisites,completion_criteria,
    sequence_rules,pairing,interference,cumulative_budget)
  ON CONFLICT(id) DO UPDATE SET
    definition_id=EXCLUDED.definition_id,variant_key=EXCLUDED.variant_key,
    display_name=EXCLUDED.display_name,modifier_keys=EXCLUDED.modifier_keys,
    difficulty_json=EXCLUDED.difficulty_json,
    requirements_json=EXCLUDED.requirements_json,status='review',
    load_profile_json=EXCLUDED.load_profile_json,
    fatigue_profile_json=EXCLUDED.fatigue_profile_json,
    programming_profile_json=EXCLUDED.programming_profile_json,
    updated_at=now();

  -- DELIVERY_PROFILES

  INSERT INTO coaching.exercise_delivery_profile_v1(
    id,variant_id,profile_key,phase_key,role,purpose,phase_suitability,
    methodology_alignment,objective_relevance_json,dosage_json,quality_gate,
    stop_rules,coach_instructions,athlete_instructions,expected_adaptation,
    equipment_required,logistics_json,substitution_ids,status,time_model_json,
    dose_scaling_json,measurement_json,support_prompts_json)
  SELECT p.id,p.variant_id,p.profile_key,p.phase_key,p.role,p.purpose,
    p.phase_suitability,p.methodology_alignment,
    jsonb_build_object(
      'primaryObjective',p.primary_objective,
      'appropriateWhen',jsonb_build_array(
        'the_exact_variant_matches_the_workout_purpose',
        'current_support_equipment_population_and_symptom_constraints_pass',
        'the_declared_dose_duration_and_same_session_budgets_fit'),
      'notEvidenceOf',jsonb_build_array(
        'structural_repositioning','injury_prevention','treatment_success',
        'accelerated_recovery','sport_transfer','athlete_readiness'),
      'phaseDecision',p.phase_decision,
      'humanReviewRequired',TRUE),
    jsonb_build_object(
      'unit','breath_cycles','sets',p.default_sets,
      'breathsPerSet',p.default_breaths,'restSeconds',p.default_rest,
      'inhaleRule',p.inhale_rule,'exhaleRule',p.exhale_rule,
      'pauseRule','only_a_comfortable_nonforced_pause_explicitly_allowed_by_the_exact_profile',
      'intensity',p.intensity,'rpeRange',p.rpe_range,
      'countInvalidPartialAssistedAndSymptomCyclesAsExposure',TRUE),
    p.quality_gate,p.stop_rules,p.coach_instructions,p.athlete_instructions,
    p.expected_adaptation,p.equipment_required,
    jsonb_build_object(
      'footprint',p.footprint,'surface','level_dry_stable_floor',
      'supportOrEquipment',jsonb_build_object(
        'equipmentRequired',to_jsonb(p.equipment_required),
        'stationFootprint',p.footprint),
      'setupSeconds',p.setup_seconds,'resetSeconds',p.reset_seconds,
      'transitionSeconds',p.transition_seconds,
      'stationThroughput',p.station_throughput,
      'sightline',p.sightline,'supervision',p.supervision,
      'noiseAndCueing','quiet_optional_cues_no_urgent_breath_commands',
      'sharedEquipmentRule',p.shared_equipment_rule,
      'changeRule','Any substitution or support/equipment change requires identity, constraints, dose, fatigue, duration, logistics, persistence, and coach/athlete rendering revalidation.'),
    ARRAY[]::UUID[],'review',
    jsonb_build_object(
      'unit','seconds',
      'durationFormula','setupSeconds + sets * (breathCycles * secondsPerBreathCycle + resetSecondsPerSet) + (sets - 1) * restSeconds + transitionSeconds',
      'setupSeconds',p.setup_seconds,
      'secondsPerBreathCycleMin',p.cycle_seconds_min,
      'secondsPerBreathCycleMax',p.cycle_seconds_max,
      'resetSecondsPerSet',p.reset_seconds,
      'transitionSeconds',p.transition_seconds,
      'minimumDurationSeconds',p.minimum_duration,
      'maximumDurationSeconds',p.maximum_duration,
      'durationBudgetRule','Recompute from actual breath cycles, cadence, pauses, invalid attempts, rest, setup, equipment handling, symptoms, and substitution—not a static exercise estimate.'),
    jsonb_build_object(
      'scaleOrder',p.scale_order,
      'setsRange',jsonb_build_array(p.sets_min,p.sets_max),
      'breathsPerSetRange',jsonb_build_array(p.breaths_min,p.breaths_max),
      'restSecondsRange',jsonb_build_array(p.rest_min,p.rest_max),
      'cadenceRule',p.cadence_rule,
      'positionRule',p.position_rule,
      'progressOnlyWhen',p.progress_only_when,
      'neverScaleByAthleteClassification',TRUE,
      'stopBeforeStrainOrQualityLoss',TRUE),
    jsonb_build_object(
      'primaryUnit','valid_breath_cycles',
      'record',p.measurement_record,
      'validCycle',p.valid_cycle,
      'invalidCycle',p.invalid_cycle,
      'firstQualityBreakRequired',TRUE,'symptomsRequired',TRUE,
      'actualRestAndDurationRequired',TRUE,'substitutionRequired',TRUE,
      'plannedAndActualVariantRequired',TRUE),
    jsonb_build_object(
      'coachBefore',p.coach_before,
      'coachDuring',p.coach_during,
      'athleteBefore',p.athlete_before,
      'athleteDuring',p.athlete_during,
      'athleteAfter',p.athlete_after,
      'incidentPrompt','Record exact cycle, equipment/support state, first fault, symptom, stop, response, substitution, and whether facility health or incident protocol was activated.',
      'accessibilityPrompt','Offer written, still-image, live-demonstration, visual-timer, quieter-cue, supported-position, fewer-cycle, longer-rest, or separately reviewed non-supine options as appropriate.' )
  FROM (VALUES
    ('02032b70-e72e-48ef-bb01-9f8c4dc81cb3'::UUID,reach_wall_variant,
      'prepare-and-access-wall','prepare_and_access','primary',
      'Rehearse low-effort supported breathing and bilateral reach before training without claiming a structural or neurologic reset.',82,78,
      1,4,15,
      'comfortable_nasal_inhale_without_maximal_volume',
      'longer_unforced_exhale_approximately_four_to_six_seconds_if_comfortable',
      'very_low','1_to_2',
      'Repeatable low-effort breath-and-reach coordination in the exact feet-on-wall support variant.',
      ARRAY['wall']::TEXT[],15,5,10,8,12,45,120,
      'Feet on wall, both arms reach, quiet inhale, longer easy exhale; no heel pull, hip lift, ball, balloon, crunch, or forced hold.',
      'Feet on the wall, reach both hands, breathe in comfortably, and exhale longer without straining.',
      'Every counted cycle preserves stable wall contact, bilateral reach without shrug, comfortable breathing, no added action, no symptom, and a full comfortable reset.',
      ARRAY[
        'Stop for chest pain, faintness, dizziness, unusual shortness of breath, panic, air hunger, or new neurologic symptoms.',
        'Stop for neck, back, hip, knee, or shoulder pain; repeated hamstring cramp; forced breathing; breath hold; shrug; crunch; support movement; or added hip lift.',
        'Stop when floor access, wall support, sightline, or participant communication is unsafe.']::TEXT[],
      'supported_breath_and_reach_coordination','prepare_before_priority_training',
      jsonb_build_array('confirm_variant_support_and_stop_signal','inspect_wall_floor_and_reach_clearance'),
      jsonb_build_array('watch_wall_contact_reach_neck_shoulders_face_ribs_pelvis_and_breath_strain'),
      'Confirm this is the feet-on-wall reach version and report any breathing or position concern.',
      'Reach without shrugging and keep every breath comfortable.',
      'Report strain, dizziness, air hunger, pain, or any changed support.',
      jsonb_build_array('reduce_breath_cycles','remove_prescribed_cadence','shorten_reach_effort','increase_rest','select_lower_leg_supported_exact_variant'),
      'stable_feet_on_wall_arms_reach_and_one_comfortable_inhale_exhale_reset',
      'any_support_reach_breath_quality_or_symptom_failure',
      jsonb_build_array('variant','wall_distance','breath_cycles','cadence','valid_invalid_partial_cycles','first_fault','symptoms','rest','duration'),
      'feet_on_wall_with_clear_bilateral_reach','one_participant_per_wall_lane',
      'coach_can_observe_full_side_view','optional_for_low_risk_participant_but_coach_available',
      'wall_is_fixed_no_shared_mouth_contact_equipment',
      jsonb_build_array('breath_cycles','cadence','reach_effort','rest'),
      'do_not_force_inhale_exhale_or_pause_duration',
      'keep_exact_wall_support_and_bilateral_reach',
      jsonb_build_array('stable_support','comfortable_unforced_breath','no_symptom_or_quality_loss'),
      1,2,3,5,0,60),
    ('eb20f202-e35f-4680-9a6f-74d9f7b5a3af'::UUID,reach_wall_variant,
      'restore-wall','restore','primary',
      'Use a small number of comfortable supported breath-and-reach cycles while transitioning toward normal post-session breathing; do not promise recovery acceleration.',88,80,
      1,5,20,
      'comfortable_nasal_inhale_without_maximal_volume',
      'longer_unforced_exhale_without_chasing_empty_lungs',
      'very_low','1_to_2',
      'Comfortable repeatable breathing with a low-effort bilateral reach after training.',
      ARRAY['wall']::TEXT[],15,5,10,8,12,55,180,
      'Keep the exact wall support and reach, reduce effort as breathing normalizes, and end before strain.',
      'Feet supported, reach gently, breathe comfortably, and stop if the breath or position feels worse.',
      'Every counted cycle remains comfortable, unforced, symptom-free, and mechanically exact; post-session fatigue is not allowed to create heel pull, hip lift, shrug, crunch, or breath strain.',
      ARRAY[
        'Stop for chest pain, faintness, dizziness, unusual shortness of breath, panic, air hunger, or new neurologic symptoms.',
        'Stop if post-session fatigue causes pain, cramp, shrug, forced breath, breath hold, support loss, or inability to leave the floor safely.',
        'Escalate rather than using the drill to mask or treat an acute symptom.']::TEXT[],
      'comfortable_post_session_breath_transition','restore_after_training_without_outcome_promise',
      jsonb_build_array('check_post_session_symptoms_and_floor_access','confirm_exact_wall_variant_and_low_effort_goal'),
      jsonb_build_array('watch_for_delayed_dizziness_air_hunger_cramp_reach_loss_or_difficulty_rising'),
      'Report any symptom before lying down; this is not treatment for feeling unwell.',
      'Use easy breaths and a gentle reach; more is not better.',
      'Report whether breathing and position stayed comfortable and whether you need help leaving the floor.',
      jsonb_build_array('reduce_cycles','remove_cadence','reduce_reach_effort','increase_rest','select_reviewed_non_supine_substitution'),
      'exact_wall_reach_cycle_that_remains_comfortable_after_training',
      'any_symptom_strain_support_loss_or_unsafe_floor_exit',
      jsonb_build_array('variant','post_session_context','breath_cycles','valid_invalid_partial_cycles','symptoms','rest','duration','exit_assistance'),
      'feet_on_wall_with_clear_bilateral_reach','one_participant_per_wall_lane',
      'coach_can_observe_full_side_view_and_floor_exit','coach_available_and_direct_if_post_session_symptoms_or_high_fatigue',
      'wall_is_fixed_no_shared_mouth_contact_equipment',
      jsonb_build_array('breath_cycles','cadence','reach_effort','rest'),
      'allow_normal_breathing_to_set_cadence',
      'keep_exact_wall_support_and_bilateral_reach',
      jsonb_build_array('comfortable_breathing','stable_support','safe_floor_exit'),
      1,3,3,6,0,90),
    ('a6752d37-c6f3-4c48-9a2e-f12f8c0c2310'::UUID,reach_support_variant,
      'prepare-and-access-lower-leg-support','prepare_and_access','primary',
      'Rehearse low-effort breathing and bilateral reach with the lower legs fully supported when wall contact would add unwanted leg effort.',86,82,
      1,4,15,
      'comfortable_nasal_inhale_without_maximal_volume',
      'longer_unforced_exhale_approximately_four_to_six_seconds_if_comfortable',
      'very_low','1_to_2',
      'Repeatable low-effort breath-and-reach coordination with minimal leg demand.',
      ARRAY['bench_or_box']::TEXT[],20,5,10,8,12,50,130,
      'Calves or heels fully supported, both arms reach, easy breath; no heel drive, hip lift, ball, balloon, crunch, or forced hold.',
      'Let the support carry your legs, reach both hands, breathe in comfortably, and exhale longer without straining.',
      'Every counted cycle preserves full stable lower-leg support, bilateral reach without shrug, comfortable breathing, no added action, no symptom, and a full reset.',
      ARRAY[
        'Stop for chest pain, faintness, dizziness, unusual shortness of breath, panic, air hunger, or new neurologic symptoms.',
        'Stop for pain, forced breathing, breath hold, shrug, crunch, support movement, heel drive, hip lift, or support loss.',
        'Stop when floor access, bench or box stability, sightline, or participant communication is unsafe.']::TEXT[],
      'fully_supported_breath_and_reach_coordination','prepare_before_priority_training',
      jsonb_build_array('confirm_variant_support_height_and_stop_signal','lock_or_brace_bench_or_box_and_clear_reach'),
      jsonb_build_array('watch_support_contact_reach_neck_shoulders_face_ribs_pelvis_and_breath_strain'),
      'Confirm this is the lower-leg-supported reach version and report any breathing or position concern.',
      'Let the support carry the legs; reach without shrugging and keep every breath comfortable.',
      'Report strain, dizziness, air hunger, pain, or any changed support.',
      jsonb_build_array('reduce_cycles','remove_cadence','shorten_reach_effort','increase_rest','adjust_support_height_with_revalidation'),
      'full_lower_leg_support_arms_reach_and_one_comfortable_inhale_exhale_reset',
      'any_support_reach_breath_quality_or_symptom_failure',
      jsonb_build_array('variant','support_height','breath_cycles','cadence','valid_invalid_partial_cycles','first_fault','symptoms','rest','duration'),
      'stable_bench_or_box_with_full_lower_leg_support_and_clear_reach','one_participant_per_braced_support_station',
      'coach_can_observe_full_side_view','optional_for_low_risk_participant_but_coach_available',
      'bench_or_box_must_be_locked_or_braced_and_cleaned_between_users',
      jsonb_build_array('breath_cycles','cadence','reach_effort','rest','support_height'),
      'do_not_force_inhale_exhale_or_pause_duration',
      'keep_exact_full_lower_leg_support_and_bilateral_reach',
      jsonb_build_array('stable_support','comfortable_unforced_breath','no_symptom_or_quality_loss'),
      1,2,3,5,0,60),
    ('a38d4472-531b-4004-aa84-8b4747b91aec'::UUID,reach_support_variant,
      'restore-lower-leg-support','restore','primary',
      'Use fully supported low-effort breath-and-reach cycles while transitioning toward normal post-session breathing without promising recovery acceleration.',90,84,
      1,5,20,
      'comfortable_nasal_inhale_without_maximal_volume',
      'longer_unforced_exhale_without_chasing_empty_lungs',
      'very_low','1_to_2',
      'Comfortable repeatable breathing with minimal leg demand and a low-effort bilateral reach after training.',
      ARRAY['bench_or_box']::TEXT[],20,5,10,8,12,60,190,
      'Keep full lower-leg support and a gentle reach; end before strain and assist floor exit when needed.',
      'Let the support carry the legs, reach gently, breathe comfortably, and stop if anything feels worse.',
      'Every counted cycle remains comfortable, unforced, symptom-free, and exact; fatigue does not create support loss, heel drive, hip lift, shrug, crunch, or unsafe floor exit.',
      ARRAY[
        'Stop for chest pain, faintness, dizziness, unusual shortness of breath, panic, air hunger, or new neurologic symptoms.',
        'Stop if post-session fatigue causes pain, support loss, forced breath, breath hold, or inability to leave the floor safely.',
        'Escalate rather than using the drill to mask or treat an acute symptom.']::TEXT[],
      'comfortable_post_session_breath_transition_with_full_leg_support','restore_after_training_without_outcome_promise',
      jsonb_build_array('check_post_session_symptoms_and_floor_access','confirm_exact_support_variant_and_low_effort_goal'),
      jsonb_build_array('watch_for_delayed_dizziness_air_hunger_support_loss_reach_loss_or_difficulty_rising'),
      'Report any symptom before lying down; this is not treatment for feeling unwell.',
      'Use easy breaths and a gentle reach; more is not better.',
      'Report whether breathing and support stayed comfortable and whether you need help leaving the floor.',
      jsonb_build_array('reduce_cycles','remove_cadence','reduce_reach_effort','increase_rest','select_reviewed_non_supine_substitution'),
      'exact_fully_supported_reach_cycle_that_remains_comfortable_after_training',
      'any_symptom_strain_support_loss_or_unsafe_floor_exit',
      jsonb_build_array('variant','post_session_context','support_height','breath_cycles','valid_invalid_partial_cycles','symptoms','rest','duration','exit_assistance'),
      'stable_bench_or_box_with_full_lower_leg_support_and_clear_reach','one_participant_per_braced_support_station',
      'coach_can_observe_full_side_view_and_floor_exit','coach_available_and_direct_if_post_session_symptoms_or_high_fatigue',
      'bench_or_box_must_be_locked_or_braced_and_cleaned_between_users',
      jsonb_build_array('breath_cycles','cadence','reach_effort','rest','support_height'),
      'allow_normal_breathing_to_set_cadence',
      'keep_exact_full_lower_leg_support_and_bilateral_reach',
      jsonb_build_array('comfortable_breathing','stable_support','safe_floor_exit'),
      1,3,3,6,0,90),
    ('f83241ae-8e26-483a-814e-55db8fd30a51'::UUID,lateral_wall_variant,
      'prepare-and-access-lateral-expansion','prepare_and_access','primary',
      'Practice low and lateral breath awareness in the exact hands-on-ribs wall-supported position before training.',84,80,
      1,5,15,
      'comfortable_nasal_inhale_approximately_three_seconds_if_unforced',
      'unforced_nasal_exhale_approximately_four_to_six_seconds_if_comfortable',
      'very_low','1',
      'Repeatable awareness of lower lateral breath motion with quiet neck and shoulders.',
      ARRAY['wall']::TEXT[],15,5,8,7,11,40,140,
      'Feet on wall, hands provide light lower-lateral feedback, neck and shoulders quiet, no reach, hip lift, ball, balloon, or forced hold.',
      'Hands low on the sides, breathe in comfortably into them, exhale longer, and keep the rest of the body quiet.',
      'Every counted cycle preserves feet-on-wall support, hands-on-lateral-ribs feedback without pressure, unforced breath, quiet neck and shoulders, no added action, no symptom, and a comfortable reset.',
      ARRAY[
        'Stop for chest pain, faintness, dizziness, unusual shortness of breath, panic, air hunger, or new neurologic symptoms.',
        'Stop for pain, forced breathing, breath hold, hand pressure, neck or shoulder tension, wall pressure, cramp, or added reach or hip lift.',
        'Stop when floor or wall access, sightline, or participant communication is unsafe.']::TEXT[],
      'wall_supported_lateral_breath_awareness','prepare_before_training_without_treatment_claim',
      jsonb_build_array('confirm_hand_feedback_position_cycles_and_stop_signal','inspect_wall_and_floor_lane'),
      jsonb_build_array('watch_hands_lower_ribs_neck_shoulders_face_wall_contact_and_breath_strain'),
      'Confirm hands-on-ribs no-reach version and report any breathing or position concern.',
      'Let the hands feel the breath; do not press, reach, or force.',
      'Report strain, dizziness, air hunger, pain, or difficulty with the wall or floor.',
      jsonb_build_array('reduce_cycles','remove_cadence','shorten_exhale','increase_rest','select_reviewed_non_supine_substitution'),
      'feet_on_wall_hands_on_lateral_ribs_and_one_comfortable_inhale_exhale_reset',
      'any_support_hand_breath_quality_or_symptom_failure',
      jsonb_build_array('variant','hand_position','breath_cycles','cadence','valid_invalid_partial_cycles','first_fault','symptoms','rest','duration'),
      'feet_on_wall_with_clear_supine_lane','one_participant_per_wall_lane',
      'coach_can_observe_hands_ribs_face_and_full_side_view','optional_for_low_risk_participant_but_coach_available',
      'wall_is_fixed_no_shared_mouth_contact_equipment',
      jsonb_build_array('breath_cycles','cadence','rest'),
      'cadence_is_optional_and_never_forced',
      'keep_exact_wall_support_hands_on_ribs_and_no_reach',
      jsonb_build_array('unforced_breath','quiet_neck_shoulders','no_symptom_or_quality_loss'),
      1,2,3,6,0,60),
    ('2c3640e1-1177-47b7-bca3-9f3548737e70'::UUID,lateral_wall_variant,
      'restore-lateral-expansion','restore','primary',
      'Use comfortable wall-supported hands-on-ribs cycles as a post-session breathing transition without claiming autonomic reset or accelerated recovery.',88,82,
      1,6,20,
      'comfortable_nasal_inhale_without_maximal_volume',
      'longer_unforced_exhale_without_chasing_empty_lungs',
      'very_low','1',
      'Comfortable repeatable breath awareness after training.',
      ARRAY['wall']::TEXT[],15,5,8,7,11,45,170,
      'Keep exact hand feedback and wall support, observe for delayed breath or position symptoms, end before strain, and confirm a safe assisted floor exit when needed.',
      'Hands low on the sides, use easy breaths, and stop if anything feels worse.',
      'Every counted cycle remains comfortable, unforced, symptom-free, and exact; fatigue does not create hand pressure, reach, hip lift, wall pressure, or unsafe floor exit.',
      ARRAY[
        'Stop for chest pain, faintness, dizziness, unusual shortness of breath, panic, air hunger, or new neurologic symptoms.',
        'Stop if post-session fatigue causes pain, forced breath, breath hold, support loss, or inability to leave the floor safely.',
        'Escalate rather than using the drill to mask or treat an acute symptom.']::TEXT[],
      'comfortable_post_session_breath_awareness','restore_after_training_without_outcome_promise',
      jsonb_build_array('check_post_session_symptoms_and_floor_access','confirm_exact_no_reach_variant'),
      jsonb_build_array('watch_for_delayed_dizziness_air_hunger_hand_pressure_wall_pressure_or_difficulty_rising'),
      'Report any symptom before lying down; this is not treatment for feeling unwell.',
      'Use easy breaths; more is not better.',
      'Report whether breathing and position stayed comfortable and whether you need help leaving the floor.',
      jsonb_build_array('reduce_cycles','remove_cadence','shorten_exhale','increase_rest','select_reviewed_non_supine_substitution'),
      'exact_hands_on_ribs_cycle_that_remains_comfortable_after_training',
      'any_symptom_strain_support_loss_or_unsafe_floor_exit',
      jsonb_build_array('variant','post_session_context','breath_cycles','valid_invalid_partial_cycles','symptoms','rest','duration','exit_assistance'),
      'feet_on_wall_with_clear_supine_lane','one_participant_per_wall_lane',
      'coach_can_observe_hands_ribs_face_side_view_and_floor_exit','coach_available_and_direct_if_post_session_symptoms_or_high_fatigue',
      'wall_is_fixed_no_shared_mouth_contact_equipment',
      jsonb_build_array('breath_cycles','cadence','rest'),
      'allow_normal_breathing_to_set_cadence',
      'keep_exact_wall_support_hands_on_ribs_and_no_reach',
      jsonb_build_array('comfortable_breathing','stable_support','safe_floor_exit'),
      1,3,3,6,0,90),
    ('c68a393a-47f4-4ee8-b513-4449543fc4f7'::UUID,balloon_variant,
      'prepare-and-access-hip-lift-balloon','prepare_and_access','conditional',
      'Rehearse the exact low-amplitude hip-lift, ball-pressure, asymmetric arm, and balloon-exhale sequence only when that coordinated exercise is explicitly selected and directly supervised.',68,72,
      1,3,60,
      'comfortable_nasal_inhale_without_maximal_volume',
      'slow_controlled_exhale_into_balloon_without_jaw_face_neck_or_pressure_strain',
      'low','2_to_4',
      'Repeatable coordination of heel pull, small pelvic lift, ball pressure, exact arm laterality, and balloon exhalation.',
      ARRAY['wall','ball','balloon']::TEXT[],45,12,20,15,20,95,230,
      'Exact right-arm-overhead/left-hand-balloon sequence, small lift, light ball pressure, safe balloon control, unforced breathing, and direct sightline all pass.',
      'Heels pull, small lift, gentle ball pressure, right arm overhead, and slow balloon exhale; stop before strain.',
      'Every counted cycle preserves exact laterality, feet and heel pull, small pelvic lift, ball pressure, balloon seal, unforced breath, no symptom, and controlled reset.',
      ARRAY[
        'Stop immediately for chest pain, faintness, dizziness, unusual shortness of breath, panic, air hunger, choking risk, balloon failure, or new neurologic symptoms.',
        'Stop for pain, severe cramp, pelvic pressure symptom, coning or doming, leakage, jaw/face/neck strain, high bridge, push-away, ball loss, arm loss, or wrong laterality.',
        'Stop when material allergy, hygiene, supervision, wall, floor, equipment, clearance, or participant communication is unsafe.']::TEXT[],
      'exact_hip_lift_ball_balloon_coordination','conditional_prepare_only_when_specific_identity_selected',
      jsonb_build_array('confirm_individual_clearance_allergy_hygiene_exact_laterality_cycles_and_stop_signal','inspect_wall_floor_ball_balloon_and_clearance'),
      jsonb_build_array('maintain_direct_sightline_to_feet_heels_pelvis_ball_right_arm_left_hand_balloon_face_and_breath'),
      'Confirm exact equipment and arm sides; report allergy, breathing, pressure, pain, dizziness, or floor concerns before starting.',
      'Keep the lift small and the breath controlled; secure the balloon and stop at the first problem.',
      'Report equipment problems, strain, symptoms, cramps, or any cycle that changed the exact sequence.',
      jsonb_build_array('reduce_cycles','reduce_lift_height','reduce_ball_pressure','increase_rest','select_distinct_passive_breathing_card_only_if_objective_can_change'),
      'exact_laterality_wall_heel_pull_small_lift_ball_pressure_and_one_safe_balloon_cycle',
      'any_equipment_laterality_position_breath_pressure_quality_or_symptom_failure',
      jsonb_build_array('variant','balloon_material_and_user','ball_size','laterality','lift_height','cycles','valid_invalid_partial_assisted_cycles','first_fault','symptoms','rest','duration'),
      'wall_lane_with_overhead_and_balloon_clearance','one_directly_observed_participant_per_station',
      'coach_has_unobstructed_full_side_and_face_view','direct_required',
      'single_user_balloon_never_shared_ball_cleaned_and_equipment_removed_if_damaged',
      jsonb_build_array('cycles','lift_height','ball_pressure','rest'),
      'never_force_breath_depth_exhale_or_pause',
      'keep_exact_laterality_wall_ball_balloon_and_small_lift',
      jsonb_build_array('equipment_safe','exact_sequence_repeatable','unforced_breath','no_pressure_symptom_or_quality_loss'),
      1,2,2,4,45,120),
    ('9ca464ff-76c9-4007-a41d-a81096db0777'::UUID,balloon_variant,
      'restore-hip-lift-balloon','restore','conditional',
      'Use the exact hip-lift/ball/balloon sequence after training only when specifically prescribed and directly supervised; do not use it to treat acute symptoms or promise recovery.',62,68,
      1,3,75,
      'comfortable_nasal_inhale_without_maximal_volume',
      'slow_controlled_exhale_into_balloon_without_chasing_empty_lungs_or_straining',
      'low','2_to_4',
      'Low-volume repeatable execution of the exact coordinated sequence after training.',
      ARRAY['wall','ball','balloon']::TEXT[],45,12,20,15,20,110,260,
      'All equipment, exact laterality, small lift, light ball pressure, safe balloon control, comfortable breath, symptom screen, and safe floor exit pass after training.',
      'Use the exact small lift and balloon cycle only while it remains easy and controlled; stop rather than pushing through fatigue.',
      'Every counted cycle remains exact, comfortable, unforced, symptom-free, directly observed, and followed by secure equipment handling and controlled pelvic lowering.',
      ARRAY[
        'Stop immediately for chest pain, faintness, dizziness, unusual shortness of breath, panic, air hunger, choking risk, balloon failure, or new neurologic symptoms.',
        'Stop if post-session fatigue causes pain, pressure symptom, severe cramp, jaw/neck strain, high bridge, ball or balloon loss, wrong laterality, or unsafe floor exit.',
        'Escalate rather than using the drill to mask or treat an acute symptom.']::TEXT[],
      'exact_post_session_hip_lift_ball_balloon_coordination','conditional_restore_without_outcome_promise',
      jsonb_build_array('screen_post_session_symptoms_fatigue_floor_access_allergy_hygiene_and_exact_goal','inspect_all_equipment_and_clearance'),
      jsonb_build_array('maintain_direct_sightline_and_watch_for_delayed_breath_pressure_cramp_or_exit_problems'),
      'Report any symptom before lying down; this is not treatment for feeling unwell.',
      'Keep every part easy and exact; secure the balloon and stop if fatigue changes the exercise.',
      'Report whether breathing, equipment, lift, ball pressure, and floor exit stayed comfortable.',
      jsonb_build_array('reduce_cycles','reduce_lift_height','reduce_ball_pressure','increase_rest','select_reviewed_non_supine_or_passive_substitution_if_objective_can_change'),
      'exact_safe_cycle_that_remains_comfortable_after_training',
      'any_symptom_equipment_position_breath_quality_or_unsafe_exit',
      jsonb_build_array('variant','post_session_context','balloon_material_and_user','laterality','cycles','valid_invalid_partial_assisted_cycles','symptoms','rest','duration','exit_assistance'),
      'wall_lane_with_overhead_and_balloon_clearance','one_directly_observed_participant_per_station',
      'coach_has_unobstructed_full_side_face_and_floor_exit_view','direct_required',
      'single_user_balloon_never_shared_ball_cleaned_and_equipment_removed_if_damaged',
      jsonb_build_array('cycles','lift_height','ball_pressure','rest'),
      'allow_comfortable_breathing_to_limit_cadence',
      'keep_exact_laterality_wall_ball_balloon_and_small_lift',
      jsonb_build_array('equipment_safe','exact_sequence_repeatable','comfortable_breath','safe_floor_exit'),
      1,2,2,4,60,150)
  ) p(
    id,variant_id,profile_key,phase_key,role,purpose,phase_suitability,
    methodology_alignment,default_sets,default_breaths,default_rest,
    inhale_rule,exhale_rule,intensity,rpe_range,expected_adaptation,
    equipment_required,setup_seconds,reset_seconds,transition_seconds,
    cycle_seconds_min,cycle_seconds_max,minimum_duration,maximum_duration,
    coach_instructions,athlete_instructions,quality_gate,stop_rules,
    primary_objective,phase_decision,coach_before,coach_during,athlete_before,
    athlete_during,athlete_after,scale_order,valid_cycle,invalid_cycle,
    measurement_record,footprint,station_throughput,sightline,supervision,
    shared_equipment_rule,cadence_rule,position_rule,progress_only_when,
    sets_min,sets_max,breaths_min,breaths_max,rest_min,rest_max)
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
    logistics_json=EXCLUDED.logistics_json,
    substitution_ids=EXCLUDED.substitution_ids,status='review',
    time_model_json=EXCLUDED.time_model_json,
    dose_scaling_json=EXCLUDED.dose_scaling_json,
    measurement_json=EXCLUDED.measurement_json,
    support_prompts_json=EXCLUDED.support_prompts_json,updated_at=now();

  -- EVIDENCE_MEDIA_ALTERNATES

  WITH sources(source_key,url,title,publisher,kind,quality) AS (VALUES
    ('fms_9090_lateral',
      'https://www.functionalmovement.com/Exercises/803/90_90_breathing_with_lateral_expansion',
      '90/90 Breathing with Lateral Expansion','Functional Movement Systems',
      'expert_instruction',84),
    ('va_diaphragmatic',
      'https://veteranshealthlibrary.va.gov/encyclopedia/142%2C82451_VA',
      'Breathing Retraining: Diaphragmatic Breathing',
      'U.S. Department of Veterans Affairs','professional_standard',82),
    ('slow_breathing_2018','https://pubmed.ncbi.nlm.nih.gov/30245619/',
      'How Breath-Control Can Change Your Life: A Systematic Review on Psycho-Physiological Correlates of Slow Breathing',
      'Frontiers in Human Neuroscience','peer_reviewed_research',88),
    ('diaphragmatic_review_2026','https://pubmed.ncbi.nlm.nih.gov/41482169/',
      'The health effects of diaphragmatic breathing: A systematic review',
      'Complementary Therapies in Medicine','peer_reviewed_research',92),
    ('diaphragm_postural_mri','https://pubmed.ncbi.nlm.nih.gov/20705944/',
      'Stabilizing function of the diaphragm: dynamic MRI and synchronized spirometric assessment',
      'Journal of Applied Physiology','peer_reviewed_research',86),
    ('boyle_balloon','https://pmc.ncbi.nlm.nih.gov/articles/PMC2971640/',
      'The Value of Blowing Up a Balloon',
      'North American Journal of Sports Physical Therapy',
      'peer_reviewed_research',74),
    ('acog_pregnancy',
      'https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2020/04/physical-activity-and-exercise-during-pregnancy-and-the-postpartum-period',
      'Physical Activity and Exercise During Pregnancy and the Postpartum Period',
      'American College of Obstetricians and Gynecologists',
      'professional_standard',95),
    ('youtube_embed','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en',
      'Embed videos and playlists','YouTube Help','manufacturer_instruction',82)
  ), cards(definition_id,card_version,card_key,card_scope) AS (VALUES
    (reach_definition,2,'reach','supported 90/90 breathing with bilateral reach'),
    (lateral_definition,1,'lateral','wall-supported 90/90 breathing with hands-on-ribs lateral feedback and no reach'),
    (balloon_definition,1,'balloon','wall-supported 90/90 hip lift with ball, right arm overhead, and left-hand balloon exhalation')
  ), sections(
    section_key,reach_source,lateral_source,balloon_source,
    reach_claim,lateral_claim,balloon_claim,scope_note,limitations) AS (VALUES
    ('identity','fms_9090_lateral','fms_9090_lateral','boyle_balloon',
      'FMS establishes a wall-supported supine 90/90 breath cycle; the legacy source adds a bilateral reach, which must remain explicit and distinct from hands-on-ribs and active hip-lift/balloon exercises.',
      'FMS directly specifies the feet-on-wall, hips-and-knees-near-90, hands-on-lower-sides, nasal inhale, longer exhale, and comfortable reset contract.',
      'The clinical suggestion directly specifies feet on wall, ball between knees, right arm overhead, left hand holding balloon, heel pull, small pelvic lift, and repeated balloon exhalation.',
      'exercise_identity_and_repetition_boundary',
      'The reach card partly relies on audited legacy identity; the FMS page has no reach. The balloon article is a clinical suggestion. Neither source is human approval for Vortex.'),
    ('taxonomy','fms_9090_lateral','fms_9090_lateral','boyle_balloon',
      'Supine support, breath control, bilateral reach, and static trunk organization are the observable taxonomy dimensions; breathing is not spinal rotation.',
      'The no-reach card is a supine wall-supported breath-control and brace task with hands as feedback rather than an arm-reach exercise.',
      'The balloon card combines breath control, static trunk organization, heel pull, small pelvic lift, isometric adduction, and asymmetric arm/hand positions.',
      'observable_movement_pattern_and_equipment_taxonomy',
      'Taxonomy describes the exercise contract; it does not establish a treatment mechanism or outcome.'),
    ('anatomy','diaphragm_postural_mri','diaphragm_postural_mri','boyle_balloon',
      'Dynamic MRI in healthy adults supports a ventilatory and postural role for the diaphragm during limb activity; reach-related serratus, shoulder, and abdominal roles remain anatomy-informed working specifications.',
      'Breathing uses diaphragm and rib-cage motion while hips and knees remain supported; hands supply sensory feedback rather than resistance.',
      'The exact source identifies diaphragm, abdominals, pelvic floor, hamstrings, adductors, heel pull, small pelvic lift, and asymmetric arm/balloon roles.',
      'muscles_joints_actions_planes_and_laterality',
      'The MRI study involved 30 healthy adults and is not a direct trial of these cards; anatomy does not quantify individual muscle force or clinical effect.'),
    ('biomechanics','diaphragm_postural_mri','fms_9090_lateral','boyle_balloon',
      'Breathing and limb-position demands can coexist, so the card must preserve comfortable ventilation while the bilateral reach and support interface remain fixed.',
      'FMS specifies lateral abdominal expansion into the hands, quiet comfortable positioning, and a longer exhale without an arm reach.',
      'The exact technique requires a heel pull rather than pushing away, a small posterior pelvic lift, ball pressure, fixed asymmetric arm positions, and controlled balloon exhalation.',
      'task_specific_support_contact_and_action_sequence',
      'No cited source proves a universal rib or pelvic position, optimal breathing strategy, or biomechanical outcome for every participant.'),
    ('difficulty','diaphragmatic_review_2026','fms_9090_lateral','boyle_balloon',
      'The reach adds modest exercise complexity while full leg support keeps physical demand low; the numeric proposal is an internal review-only calibration anchor.',
      'The direct sequence has low physical demand and fewer coordination elements than reach or balloon forms; the numeric score remains an internal proposal.',
      'Equipment handling, heel pull, pelvic lift, ball pressure, exact laterality, and balloon control materially increase complexity and physical demand over passive breathing.',
      'exercise_complexity_and_physical_difficulty_only',
      'No source assigns a Vortex score, athlete readiness, proficiency, or universal progression order.'),
    ('load_fatigue_recovery','diaphragmatic_review_2026','diaphragmatic_review_2026','boyle_balloon',
      'Supported breathing has low external load, but breath effort, reach duration, support pressure, prior trunk/shoulder work, symptoms, and invalid cycles still require cumulative tracking.',
      'Hands-on-ribs breathing is low load; cadence, breath depth, wall pressure, prior respiratory/trunk work, and symptom-limited attempts still count as exposure.',
      'The balloon card adds hamstring/adductor isometrics, pelvic-lift duration, overhead arm position, hand/oral balloon control, and expiratory resistance that require separate fatigue budgeting.',
      'load_drivers_cumulative_exposure_and_planning_recovery',
      'The 2026 review reports highly heterogeneous protocols and underreported safety; recovery-hour values are conservative planning estimates, not biological guarantees.'),
    ('constraints','acog_pregnancy','acog_pregnancy','boyle_balloon',
      'A stable support, safe floor access, comfortable supine position, pain-free reach, and unforced breathing are selection constraints; pregnancy may require supine modification.',
      'The exact wall and floor position must be tolerable and stable; later pregnancy can require a non-supine alternative or individualized guidance.',
      'Wall, ball, balloon, hygiene, material allergy, mouth-contact equipment, overhead clearance, direct supervision, and comfortable supine breathing are identity-critical constraints.',
      'equipment_environment_population_and_access_constraints',
      'ACOG guidance addresses pregnancy generally, not this exercise. The card cannot diagnose, clear, or treat respiratory, cardiovascular, obstetric, or musculoskeletal conditions.'),
    ('dosage','va_diaphragmatic','fms_9090_lateral','boyle_balloon',
      'Use a small workout dose of comfortable breath cycles with rest as needed; this is deliberately shorter than clinical practice guidance and must stop before strain.',
      'FMS provides approximate inhale and exhale timing but does not establish one universal set count or workout dose.',
      'The clinical suggestion describes repeated balloon cycles; Vortex uses a conservative low-volume working dose until qualified review and population-specific evidence exist.',
      'contextual_breath_cycles_cadence_rest_and_duration',
      'Dosage is a programming inference. Do not convert source protocols into universal prescriptions, treatment plans, or performance claims.'),
    ('instructions','fms_9090_lateral','fms_9090_lateral','boyle_balloon',
      'Instructions must declare wall versus lower-leg support, bilateral reach, comfortable inhale, longer unforced exhale, no hip lift, and the valid reset.',
      'Instructions must preserve feet-on-wall support, hands-on-lateral-ribs feedback, comfortable inhale, longer exhale, no reach, and comfortable reset.',
      'Instructions must preserve exact right-arm/left-hand laterality, heel pull, small pelvic lift, ball pressure, balloon handling, breath cycle, and safe exit.',
      'coach_and_athlete_action_sequence',
      'Direct technique sources do not replace qualified review for cue comprehension, accessibility, conflicts, or safe delivery in a Vortex setting.'),
    ('safety_stop_rules','diaphragmatic_review_2026','diaphragmatic_review_2026','boyle_balloon',
      'Breathing protocols vary and safety reporting is incomplete, so do not force depth, exhale, or retention and stop for distress, dizziness, faintness, chest pain, unusual shortness of breath, neurologic signs, or musculoskeletal symptoms.',
      'Use comfortable unforced breathing and stop rather than trying to meet cadence through strain, air hunger, dizziness, pain, or loss of support.',
      'Balloon resistance and equipment add material, hygiene, choking, pressure, jaw/face/neck strain, and supervision considerations beyond passive breathing.',
      'quality_gates_stop_rules_and_escalation',
      'The literature does not establish that these stop rules guarantee safety; urgent or concerning symptoms require the appropriate facility or health protocol.'),
    ('programming','slow_breathing_2018','slow_breathing_2018','boyle_balloon',
      'Use as low-intensity breath-and-reach practice or a comfortable transition, not as proof of parasympathetic reset, structural repositioning, recovery acceleration, or sport transfer.',
      'Use as low-intensity breath-awareness practice, not a maximal breath challenge or universal nervous-system intervention.',
      'Use only when the exact hip-lift/ball/balloon coordination task is selected; do not substitute it silently for passive breathing or use it as unsupervised conditioning.',
      'phase_purpose_sequence_pairing_and_interference',
      'Slow-breathing research uses varied protocols and proposed mechanisms. No cited source validates exact Vortex phase placement or outcome promises.'),
    ('athlete_support','va_diaphragmatic','fms_9090_lateral','boyle_balloon',
      'Plain-language support should identify exact leg support, bilateral reach, comfortable breathing, expected low effort, unexpected symptoms, and the safe stop/exit.',
      'Athlete support should show wall and hand placement, one comfortable cycle, no reach or hip lift, expected gentle motion, and the stop signal.',
      'Athlete support must show equipment, laterality, small lift, ball pressure, balloon control, expected muscular effort, unexpected pressure/breath symptoms, and safe equipment removal.',
      'plain_language_self_checks_expected_and_unexpected_sensations',
      'Source instructions do not prove that every participant can understand or perform the card; comprehension and accessibility require user testing.'),
    ('coach_support','va_diaphragmatic','fms_9090_lateral','boyle_balloon',
      'Coach support must distinguish wall from lower-leg support and observe reach, neck/shoulder tension, breath strain, support stability, symptoms, reset, and floor exit.',
      'Coach support must observe exact hand feedback, wall pressure, neck/shoulder quiet, breath strain, symptoms, and no added reach or lift.',
      'Direct observation must cover equipment, hygiene, exact laterality, heel pull, small lift, ball pressure, balloon seal, jaw/face/neck strain, symptoms, and safe exit.',
      'observation_fault_correction_demonstration_and_group_management',
      'These coaching rules are working specifications pending qualified content, safety, and operational review.'),
    ('accessibility','acog_pregnancy','acog_pregnancy','diaphragmatic_review_2026',
      'Offer exact lower-leg support, comfortable nonforced angles/cadence, head support, fewer cycles, longer rest, nonvideo instruction, or a separately reviewed non-supine substitution.',
      'Offer comfortable angles, head support, fewer cycles, longer rest, nonvideo instruction, or a separately reviewed non-supine substitution when wall-supported supine practice is unsuitable.',
      'If balloon, mouth contact, material, overhead position, hip lift, pressure, or supine access is unsuitable, select a different reviewed exercise rather than silently deleting an identity-bearing element.',
      'position_communication_sensory_and_equipment_access',
      'Accessibility changes that remove identity-bearing actions or equipment require a different definition and full workout revalidation.'),
    ('alternates','fms_9090_lateral','boyle_balloon','boyle_balloon',
      'Hands-on-ribs no-reach breathing and hip-lift/ball/balloon breathing have different arm, pelvic, equipment, and repetition contracts and therefore require distinct definitions.',
      'Adding bilateral reach or an active hip lift/ball/balloon sequence changes the action and repetition contract; cadence and breath count remain delivery annotations when the exact action is unchanged.',
      'Mirrored arms, no balloon, hip shift, hemibridge, passive breathing, bilateral reach, and high glute bridge are not silently equivalent to the exact published sequence.',
      'same_identity_variant_annotation_distinct_definition_or_reject',
      'Alternate classifications are machine-authored proposals pending identity review; graph proximity never establishes identity.'),
    ('media','youtube_embed','youtube_embed','youtube_embed',
      'Five exact-title reach candidates returned current YouTube oEmbed metadata and privacy-enhanced embed responses on 2026-08-02.',
      'Five wall/supine 90/90 breathing candidates returned current YouTube oEmbed metadata and privacy-enhanced embed responses on 2026-08-02.',
      'Five hip-lift/balloon candidates returned current YouTube oEmbed metadata and privacy-enhanced embed responses on 2026-08-02.',
      'candidate_media_discovery_and_embed_metadata',
      'oEmbed does not prove playback, exact variant, complete technique, captions, accessibility, cue quality, safety, conflicts, reviewer identity, or approval. Full human review remains null and quarantined.')
  ), selected AS (
    SELECT c.definition_id,c.card_version,s.section_key,
      CASE c.card_key WHEN 'reach' THEN s.reach_source
        WHEN 'lateral' THEN s.lateral_source ELSE s.balloon_source END source_key,
      CASE c.card_key WHEN 'reach' THEN s.reach_claim
        WHEN 'lateral' THEN s.lateral_claim ELSE s.balloon_claim END supported_claim,
      c.card_scope,s.scope_note,s.limitations
    FROM cards c CROSS JOIN sections s
  )
  INSERT INTO coaching.exercise_section_evidence_v1(
    definition_id,reviewed_card_version,section_key,source_url,source_title,
    source_publisher,source_kind,claims_json,evidence_quality,review_status,
    reviewer_user_id,reviewed_at)
  SELECT selected.definition_id,selected.card_version,selected.section_key,
    sources.url,sources.title,sources.publisher,sources.kind,
    jsonb_build_object(
      'supportedClaim',selected.supported_claim,
      'application',selected.card_scope,
      'scope',selected.scope_note,
      'limitations',selected.limitations,
      'researchVersion',research_version,
      'confidence','candidate_pending_qualified_review',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    sources.quality,'candidate',NULL,NULL
  FROM selected JOIN sources USING(source_key)
  ON CONFLICT(definition_id,reviewed_card_version,section_key,source_url)
  DO UPDATE SET source_title=EXCLUDED.source_title,
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
  SELECT media.definition_id,NULL,media.card_version,
    'https://www.youtube.com/watch?v='||media.video_id,
    'https://www.youtube-nocookie.com/embed/'||media.video_id,
    media.video_id,media.title,media.channel,NULL,'en',NULL,TRUE,NULL,NULL,
    'healthy','candidate','manual_research',media.query,NULL,NULL,
    now()+INTERVAL '90 days',
    'YouTube oEmbed returned current title/channel/embed metadata on 2026-08-02. Playback, exact definition and variant, support, reach, hip lift, ball, balloon, laterality, full sequence, captions, accessibility, demonstration quality, cue quality, conflicts, safety, reviewer identity, and approval remain unresolved and quarantined.'
  FROM (VALUES
    (reach_definition,2,'GZ6X2M6gRvQ','90/90 Breathing with Reach','Premier Rehab Patient Exercise Library','exact title search and legacy candidate rechecked by YouTube oEmbed'),
    (reach_definition,2,'O-cf22YQzAg','90/90 Breathing with Reach','Erica Friedman Wellness','exact title search and legacy candidate rechecked by YouTube oEmbed'),
    (reach_definition,2,'QN77knnBw8o','Supine 90/90 reach with breathing','Stark Performance','exact title search and legacy candidate rechecked by YouTube oEmbed'),
    (reach_definition,2,'yFGJI00OZ8k','90/90 Breathing With Reach','Stronger Strides','exact title search and legacy candidate rechecked by YouTube oEmbed'),
    (reach_definition,2,'kA6AtZkDxmg','90/90 Breathing with Reach','MASS','exact title search rechecked by YouTube oEmbed'),
    (lateral_definition,1,'AnvRX080sR4','90/90 Wall Breathing','Athletic Edge Physical Therapy','wall-supported 90/90 breathing search rechecked by YouTube oEmbed'),
    (lateral_definition,1,'V6Zrlo5w7oY','Supine 90-90 Breathing','Hayley Kava, Pelvic Floor Physical Therapist','wall-supported 90/90 breathing search rechecked by YouTube oEmbed'),
    (lateral_definition,1,'xzzJgFbgexc','Rib Expansion Rest (90/90 Breathing)','The Posture Project','90/90 lateral-expansion search rechecked by YouTube oEmbed'),
    (lateral_definition,1,'K2wKibekVbA','9090 Wall Ribcage Expansion Breathing','phyzix','90/90 wall rib-cage expansion search rechecked by YouTube oEmbed'),
    (lateral_definition,1,'8UAOFVQIqYQ','90/90 wall breathing drill','BodySmart','90/90 wall breathing search rechecked by YouTube oEmbed'),
    (balloon_definition,1,'4GoqjoEXaAw','90-90 Hip Lift with Balloon','PRI Postural Restoration Institute','exact hip-lift-with-balloon search rechecked by YouTube oEmbed'),
    (balloon_definition,1,'zL1Hmkt7aJA','90 90 Hip Lift with Right Arm Reach and Ballon','Inspire Physical Therapy','exact hip-lift-with-balloon search rechecked by YouTube oEmbed'),
    (balloon_definition,1,'lcZp3gEz5_s','90-90 hip lift with balloon','Dr. Ethan Colliver','exact hip-lift-with-balloon search rechecked by YouTube oEmbed'),
    (balloon_definition,1,'U1AG5y81VcQ','90-90 Hip Lift with Balloon (explained)','Greco PT & Armcare','exact hip-lift-with-balloon search rechecked by YouTube oEmbed'),
    (balloon_definition,1,'-zxaq9lANYg','90/90 Hip Lift with Right Arm Reach and Balloon','Zac Cupples','exact hip-lift-with-balloon search rechecked by YouTube oEmbed')
  ) media(definition_id,card_version,video_id,title,channel,query)
  ON CONFLICT(definition_id,reviewed_card_version,video_id) DO UPDATE SET
    variant_id=NULL,url=EXCLUDED.url,embed_url=EXCLUDED.embed_url,
    title=EXCLUDED.title,channel_name=EXCLUDED.channel_name,
    duration_seconds=NULL,language_code='en',captions_available=NULL,
    embedding_allowed=TRUE,exact_variant_match=NULL,
    demonstration_quality_score=NULL,link_status='healthy',
    review_status='candidate',discovery_method='manual_research',
    source_query=EXCLUDED.source_query,reviewer_user_id=NULL,reviewed_at=NULL,
    next_review_at=EXCLUDED.next_review_at,notes=EXCLUDED.notes,updated_at=now();

  INSERT INTO coaching.exercise_alternate_assessment_v1(
    definition_id,reviewed_card_version,alternate_name,classification,
    rationale,distinguishing_dimensions,proposed_card_json,review_status,
    reviewer_user_id,reviewed_at)
  SELECT alternate.definition_id,alternate.card_version,alternate.name,
    alternate.classification,alternate.rationale,alternate.dimensions,NULL,
    'candidate',NULL,NULL
  FROM (VALUES
    (reach_definition,2,'90-90 Breathing with Reach','same_identity','Punctuation-only synonym for the same exact supported bilateral-reach family.',jsonb_build_object('alias','90-90 Breathing with Reach')),
    (reach_definition,2,'Feet-on-Wall Bilateral Reach','same_identity','Matches the exact wall-supported working variant when no heel pull or hip lift is added.',jsonb_build_object('variantKey','wall-supported-bilateral-reach')),
    (reach_definition,2,'Lower-Leg-Supported Bilateral Reach','same_identity','Matches the exact fully supported bench-or-box working variant.',jsonb_build_object('variantKey','lower-leg-supported-bilateral-reach')),
    (reach_definition,2,'Support Height','modifier_annotation','A recorded support height changes hip and knee angles without changing identity when support contact, reach, breath, and completion remain exact.',jsonb_build_object('modifier','support_height')),
    (reach_definition,2,'Comfortable Breath Cadence','modifier_annotation','A nonforced cadence is delivery metadata when the same breath cycle and no breath hold are retained.',jsonb_build_object('modifier','inhale_exhale_cadence')),
    (reach_definition,2,'Breath Count Sets and Rest','modifier_annotation','Dose changes exposure and duration but not identity after exact support and reach are fixed.',jsonb_build_object('modifiers',jsonb_build_array('breath_cycles','sets','rest_seconds'))),
    (reach_definition,2,'Nonobstructive Head Support','modifier_annotation','A towel or pad supporting a comfortable neck is an accessibility annotation when it does not change breathing or reach.',jsonb_build_object('modifier','head_support')),
    (reach_definition,2,'Small Bilateral Reach-Angle Adjustment','modifier_annotation','A small pain-free angle change can be recorded inside the bilateral reach variant; removing or unilateralizing reach changes identity.',jsonb_build_object('modifier','bilateral_reach_angle')),
    (reach_definition,2,'90/90 Breathing with Hands on Lateral Ribs','new_definition','Removing the reach and using the hands as feedback removes the scapular and shoulder action and changes valid completion.',jsonb_build_object('targetDefinitionId',lateral_definition)),
    (reach_definition,2,'90/90 Breathing with Unilateral Reach','new_definition','One-arm reach creates an asymmetric scapular, rib, trunk, and laterality contract.',jsonb_build_object('laterality','unilateral_reach')),
    (reach_definition,2,'90/90 Hip Lift with Ball and Balloon','new_definition','Heel pull, pelvic lift, ball pressure, balloon resistance, and exact arm laterality change action, equipment, and repetition boundary.',jsonb_build_object('targetDefinitionId',balloon_definition)),
    (reach_definition,2,'90/90 Hip Lift without Balloon','new_definition','An active heel-pull pelvic lift remains a distinct action even when balloon resistance is removed.',jsonb_build_object('primaryAction','active_hip_lift')),
    (reach_definition,2,'Dead Bug Breathing','new_definition','Unsupported alternating limb motion changes the primary task to dynamic contralateral trunk control.',jsonb_build_object('targetDefinitionId',dead_bug_definition)),
    (reach_definition,2,'Crocodile Breathing','new_definition','Prone orientation and floor-directed abdominal contact differ from supported supine reach breathing.',jsonb_build_object('targetDefinitionId',crocodile_definition)),
    (reach_definition,2,'Box Breathing Hold','new_definition','Equal timed phases and prescribed holds change the breath-cycle contract and risk profile.',jsonb_build_object('targetDefinitionId',box_breath_definition)),
    (reach_definition,2,'Med Ball Belly Breathing','new_definition','External medicine-ball pressure and no bilateral reach change load, action, and stop rules.',jsonb_build_object('targetDefinitionId',med_ball_breath_definition)),
    (reach_definition,2,'Side-Lying Supported Breathing','new_definition','Side-lying orientation, asymmetric support, and rib contact require a separate definition.',jsonb_build_object('orientation','side_lying')),
    (reach_definition,2,'Seated Diaphragmatic Breathing','new_definition','Seated weight bearing, balance, and support differ from the supine 90/90 exercise.',jsonb_build_object('orientation','seated')),
    (reach_definition,2,'90/90 Breathing with Hip Reset — Undefined Source 1404','reject','The source omits support, heel pressure, hip lift, pelvic shift, reach, ball or balloon, breath cycle, and valid completion and therefore remains an identity quarantine.',jsonb_build_object('legacyExerciseId',1404,'identityQuarantine',TRUE)),
    (reach_definition,2,'Maximal Exhale or Prescribed Breath-Hold Challenge','reject','Forcing volume or retention changes the task and violates this card''s comfort and stop contract.',jsonb_build_object('breathStrategy','prohibited')),
    (reach_definition,2,'Unstable or Rolling Leg Support','reject','An unstable support creates a fall, collision, and leg-control task not represented by this card.',jsonb_build_object('support','unsafe')),
    (reach_definition,2,'Pain-Through or Dizziness-Through Breathing','reject','Continuing through pain, dizziness, faintness, unusual shortness of breath, panic, air hunger, or neurologic signs violates stop and escalation rules.',jsonb_build_object('symptomPolicy','prohibited')),

    (lateral_definition,1,'90/90 Breathing with Lateral Expansion','same_identity','Direct FMS name for the exact wall-supported hands-on-ribs no-reach contract.',jsonb_build_object('alias','90/90 Breathing with Lateral Expansion')),
    (lateral_definition,1,'90/90 Wall Breathing','same_identity','Common short name only when hands remain on the lateral ribs and no reach or hip lift is added.',jsonb_build_object('alias','90/90 Wall Breathing')),
    (lateral_definition,1,'Comfortable Hip and Knee Angle Adjustment','modifier_annotation','Approximate angles may be adjusted for comfort while wall support, hands, no-reach action, and breath cycle remain exact.',jsonb_build_object('modifier','comfortable_support_angles')),
    (lateral_definition,1,'Comfortable Breath Cadence','modifier_annotation','A nonforced cadence is delivery metadata when the same cycle and no added hold remain.',jsonb_build_object('modifier','inhale_exhale_cadence')),
    (lateral_definition,1,'Breath Count Sets and Rest','modifier_annotation','Dose changes exposure and duration but not exact identity.',jsonb_build_object('modifiers',jsonb_build_array('breath_cycles','sets','rest_seconds'))),
    (lateral_definition,1,'Nonobstructive Head Support','modifier_annotation','Head support is an accessibility annotation when the wall, hand feedback, breathing, and no-reach contract remain unchanged.',jsonb_build_object('modifier','head_support')),
    (lateral_definition,1,'90/90 Breathing with Bilateral Reach','new_definition','Adding bilateral scapular reach and shoulder action changes the repetition and quality contract.',jsonb_build_object('targetDefinitionId',reach_definition)),
    (lateral_definition,1,'Lower-Leg-Supported 90/90 Breathing without Reach','new_variant','Changing wall-foot contact to full lower-leg support preserves no-reach breathing but materially changes support and leg demand.',jsonb_build_object('proposedVariant','lower_leg_supported_no_reach')),
    (lateral_definition,1,'90/90 Hip Lift with Ball and Balloon','new_definition','Hip lift, ball pressure, balloon resistance, and asymmetric arms are different actions and equipment.',jsonb_build_object('targetDefinitionId',balloon_definition)),
    (lateral_definition,1,'Dead Bug Breathing','new_definition','Unsupported alternating limb motion changes the primary task.',jsonb_build_object('targetDefinitionId',dead_bug_definition)),
    (lateral_definition,1,'Crocodile Breathing','new_definition','Prone orientation and floor-directed contact differ from supine wall support.',jsonb_build_object('targetDefinitionId',crocodile_definition)),
    (lateral_definition,1,'Med Ball Belly Breathing','new_definition','External medicine-ball pressure differs from hands used only as feedback.',jsonb_build_object('targetDefinitionId',med_ball_breath_definition)),
    (lateral_definition,1,'Side-Lying Supported Breathing','new_definition','Side-lying orientation and asymmetric rib support require a separate definition.',jsonb_build_object('orientation','side_lying')),
    (lateral_definition,1,'Seated Diaphragmatic Breathing','new_definition','Seated loading and postural demand differ from wall-supported supine breathing.',jsonb_build_object('orientation','seated')),
    (lateral_definition,1,'Forced Breath Hold or Maximal Volume Test','reject','Forcing depth or retention changes the task and violates comfort-based delivery.',jsonb_build_object('breathStrategy','prohibited')),
    (lateral_definition,1,'Pain-Through Unstable-Support Breathing','reject','Symptoms or unsafe wall/floor support invalidate the exercise and require stop or substitution.',jsonb_build_object('symptomAndSupportPolicy','prohibited')),

    (balloon_definition,1,'90/90 Bridge with Ball and Balloon','same_identity','Published synonym for the exact small pelvic-lift, ball-pressure, asymmetric arm, and balloon-breath sequence.',jsonb_build_object('alias','90/90 Bridge with Ball and Balloon')),
    (balloon_definition,1,'90-90 Hip Lift with Balloon','same_identity','Common short name only when exact ball, arm laterality, heel-pull, lift, and balloon actions remain declared.',jsonb_build_object('alias','90-90 Hip Lift with Balloon')),
    (balloon_definition,1,'Mirrored Arm and Balloon Arrangement','new_variant','Mirroring right and left changes laterality and must be separately specified and evidenced.',jsonb_build_object('proposedLaterality','left_arm_overhead_right_hand_balloon')),
    (balloon_definition,1,'No Overhead Arm Hip Lift with Balloon','new_variant','Removing the overhead arm changes shoulder and rib constraints while preserving the hip-lift/balloon family.',jsonb_build_object('armAction','no_overhead_arm')),
    (balloon_definition,1,'Reviewed Balloon Material','modifier_annotation','Latex-free or other material changes equipment metadata only after resistance, integrity, allergy, and safety are reviewed.',jsonb_build_object('modifier','balloon_material')),
    (balloon_definition,1,'Ball Size within 4–6 Inches','modifier_annotation','The published size range is equipment metadata when ball pressure and all other actions remain exact.',jsonb_build_object('modifier','ball_size_inches')),
    (balloon_definition,1,'Breath Cycles Sets and Rest','modifier_annotation','Dose changes exposure and duration but not the exact action after equipment and laterality are fixed.',jsonb_build_object('modifiers',jsonb_build_array('breath_cycles','sets','rest_seconds'))),
    (balloon_definition,1,'Passive 90/90 Breathing with Bilateral Reach','new_definition','Removing hip lift, ball, and balloon while adding bilateral reach selects the passive reach definition.',jsonb_build_object('targetDefinitionId',reach_definition)),
    (balloon_definition,1,'90/90 Wall Breathing with Lateral Expansion','new_definition','Removing lift, ball, balloon, and asymmetric arms selects the hands-on-ribs breathing definition.',jsonb_build_object('targetDefinitionId',lateral_definition)),
    (balloon_definition,1,'90/90 Hip Lift without Balloon','new_definition','Removing balloon resistance changes the breath/equipment contract even if the hip lift remains.',jsonb_build_object('primaryAction','active_hip_lift_without_balloon')),
    (balloon_definition,1,'90/90 Supported Hip Shift with Hemibridge and Balloon','new_definition','Hip shift and hemibridge add frontal/transverse asymmetry and different support actions.',jsonb_build_object('primaryAction','hip_shift_and_hemibridge')),
    (balloon_definition,1,'90/90 Hip Lift with Right Arm Reach and Balloon','new_variant','A forward right-arm reach differs from the exact right-arm-overhead source and needs its own laterality and shoulder-path specification.',jsonb_build_object('armAction','right_arm_reach')),
    (balloon_definition,1,'Dead Bug with Balloon','new_definition','Alternating unsupported limb motion and balloon handling create a different dynamic coordination task.',jsonb_build_object('primaryAction','dynamic_limb_motion_with_balloon')),
    (balloon_definition,1,'Med Ball Belly Breathing','new_definition','External abdominal pressure and no heel-pull hip lift differ from ball-and-balloon breathing.',jsonb_build_object('targetDefinitionId',med_ball_breath_definition)),
    (balloon_definition,1,'Glute Bridge','new_definition','A conventional hip-extension bridge without ball-and-balloon breath sequencing has a different primary action and load intent.',jsonb_build_object('primaryAction','glute_bridge')),
    (balloon_definition,1,'Balloon Breath-Hold Challenge','reject','Maximal inflation or forced retention changes purpose and risk and is not this low-volume controlled exercise.',jsonb_build_object('breathStrategy','prohibited')),
    (balloon_definition,1,'Shared Mouth-Contact Balloon','reject','Sharing mouth-contact equipment violates hygiene and infection-control requirements.',jsonb_build_object('equipmentPolicy','prohibited')),
    (balloon_definition,1,'Unreviewed Balloon Material with Allergy Risk','reject','Unknown material or unresolved allergy risk fails equipment readiness.',jsonb_build_object('materialPolicy','prohibited')),
    (balloon_definition,1,'High Glute-Dominant Bridge with Push-Away','reject','A high bridge or pushing the body away changes the exact heel-pull and small-lift contract.',jsonb_build_object('quality','invalid_repetition')),
    (balloon_definition,1,'Pain-Through Pressure-Through or Dizziness-Through Balloon Work','reject','Continuing through pain, pressure symptoms, dizziness, faintness, unusual shortness of breath, panic, or neurologic signs violates stop rules.',jsonb_build_object('symptomPolicy','prohibited'))
  ) alternate(definition_id,card_version,name,classification,rationale,dimensions)
  ON CONFLICT(definition_id,reviewed_card_version,alternate_name) DO UPDATE SET
    classification=EXCLUDED.classification,rationale=EXCLUDED.rationale,
    distinguishing_dimensions=EXCLUDED.distinguishing_dimensions,
    proposed_card_json=NULL,review_status='candidate',reviewer_user_id=NULL,
    reviewed_at=NULL,updated_at=now();

  -- IDENTITY_GRAPH_CALIBRATION

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by,resolved_at)
  VALUES
    (1,reach_definition,lateral_definition,'distinct_exercises',
      'The reach card holds both arms in a bilateral ceiling reach; the lateral-expansion card keeps both hands on the lower lateral ribs as sensory feedback. Those arm and hand contacts change the scored action and valid repetition.',
      jsonb_build_object('migration',migration_key,'identityBoundary','bilateral_arm_reach_vs_hands_on_lateral_ribs_no_reach','humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_identity_equivalence',NULL,now()),
    (1,reach_definition,balloon_definition,'distinct_exercises',
      'Passive supported bilateral reach does not include heel pull, pelvic lift, ball squeeze, asymmetric arms, mouth-contact equipment, or resisted balloon exhalation; the balloon sequence has a different action and repetition boundary.',
      jsonb_build_object('migration',migration_key,'identityBoundary','passive_supported_reach_vs_active_heel_pull_hip_lift_ball_and_balloon_sequence','humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_identity_equivalence',NULL,now()),
    (1,lateral_definition,balloon_definition,'distinct_exercises',
      'Hands-on-ribs lateral-expansion breathing has no lift, heel pull, ball, balloon, overhead arm, or unilateral equipment handling; the balloon card adds all of those identity-bearing actions.',
      jsonb_build_object('migration',migration_key,'identityBoundary','hands_on_ribs_passive_breathing_vs_active_hip_lift_ball_and_balloon','humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_identity_equivalence',NULL,now()),
    (1,reach_definition,hip_switch_definition,'distinct_exercises',
      'Supported supine breathing with a static bilateral reach does not include seated hip rotation or alternating 90/90 leg positions. Hip Switch has a different orientation, joint action, laterality sequence, and endpoint.',
      jsonb_build_object('migration',migration_key,'identityBoundary','supine_static_breath_and_reach_vs_seated_dynamic_hip_rotation','humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_identity_equivalence',NULL,now()),
    (1,lateral_definition,hip_switch_definition,'distinct_exercises',
      'Wall-supported supine breathing with static feet and hands on the ribs differs from seated alternating hip rotation in orientation, support, limb motion, primary action, and repetition completion.',
      jsonb_build_object('migration',migration_key,'identityBoundary','supine_static_wall_breathing_vs_seated_dynamic_hip_rotation','humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_identity_equivalence',NULL,now()),
    (1,balloon_definition,hip_switch_definition,'distinct_exercises',
      'The hip-lift and balloon sequence is a supine heel-pull, small-lift, adduction, and resisted-exhalation task; Hip Switch is a seated alternating-rotation task without that equipment or breath cycle.',
      jsonb_build_object('migration',migration_key,'identityBoundary','supine_hip_lift_balloon_sequence_vs_seated_hip_switch','humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_identity_equivalence',NULL,now()),
    (1,reach_definition,crocodile_definition,'distinct_exercises',
      'Crocodile breathing is prone and uses the floor or hands as anterior feedback; the reach card is supine with legs supported near 90/90 and both arms reaching vertically.',
      jsonb_build_object('migration',migration_key,'identityBoundary','supine_supported_bilateral_reach_vs_prone_breathing_feedback','humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_identity_equivalence',NULL,now()),
    (1,lateral_definition,crocodile_definition,'distinct_exercises',
      'Both may cue low rib expansion, but the 90/90 card is supine with feet on a wall and hands on the lateral ribs, while Crocodile Breathing is prone with different contacts and pressure feedback.',
      jsonb_build_object('migration',migration_key,'identityBoundary','supine_wall_supported_lateral_feedback_vs_prone_anterior_feedback','humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_identity_equivalence',NULL,now()),
    (1,balloon_definition,crocodile_definition,'distinct_exercises',
      'Prone breathing omits the wall-supported heel pull, small hip lift, ball squeeze, asymmetric arms, and balloon exhalation that define the ball-and-balloon repetition.',
      jsonb_build_object('migration',migration_key,'identityBoundary','active_supine_hip_lift_balloon_vs_prone_passive_breathing','humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_identity_equivalence',NULL,now()),
    (1,reach_definition,dead_bug_definition,'distinct_exercises',
      'The supported reach card keeps both legs fixed and both arms reaching; Dead Bug adds unsupported or moving contralateral limbs and a dynamic limb-return repetition boundary.',
      jsonb_build_object('migration',migration_key,'identityBoundary','static_supported_reach_breathing_vs_dynamic_contralateral_limb_motion','humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_identity_equivalence',NULL,now()),
    (1,lateral_definition,dead_bug_definition,'distinct_exercises',
      'Hands-on-ribs wall breathing holds all limbs in fixed support, whereas Dead Bug scores dynamic contralateral limb motion, unsupported leverage, and limb return.',
      jsonb_build_object('migration',migration_key,'identityBoundary','static_supported_breathing_vs_dynamic_dead_bug_limb_cycle','humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_identity_equivalence',NULL,now()),
    (1,balloon_definition,dead_bug_definition,'distinct_exercises',
      'The exact hip-lift/ball/balloon card keeps the leg support and asymmetric arm positions fixed; Dead Bug adds dynamic limb excursions and omits the same heel-pull, lift, and equipment contract.',
      jsonb_build_object('migration',migration_key,'identityBoundary','fixed_hip_lift_balloon_sequence_vs_dynamic_dead_bug_limb_cycle','humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_identity_equivalence',NULL,now()),
    (1,reach_definition,box_breath_definition,'distinct_exercises',
      'Box breathing is defined by a timed inhale-hold-exhale-hold cadence and is not tied to supported 90/90 legs or a bilateral reach. The reach card explicitly avoids forced breath holds.',
      jsonb_build_object('migration',migration_key,'identityBoundary','supported_reach_unforced_cycle_vs_timed_four_phase_breath_holds','humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_identity_equivalence',NULL,now()),
    (1,lateral_definition,box_breath_definition,'distinct_exercises',
      'Lateral-expansion wall breathing uses a comfortable inhale, longer exhale, and reset without prescribed retention; Box Breath scores four timed phases including holds and need not use the 90/90 support.',
      jsonb_build_object('migration',migration_key,'identityBoundary','wall_supported_lateral_expansion_vs_timed_box_breath_holds','humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_identity_equivalence',NULL,now()),
    (1,balloon_definition,box_breath_definition,'distinct_exercises',
      'Box breathing omits heel pull, hip lift, ball squeeze, balloon resistance, and asymmetric arm positions; the balloon card does not score a four-phase timed hold protocol.',
      jsonb_build_object('migration',migration_key,'identityBoundary','hip_lift_balloon_action_vs_timed_box_breath_protocol','humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_identity_equivalence',NULL,now()),
    (1,reach_definition,med_ball_breath_definition,'distinct_exercises',
      'Med Ball Belly Breathing uses an external implement on the abdomen for pressure or feedback and has no required bilateral ceiling reach or 90/90 leg-support contract.',
      jsonb_build_object('migration',migration_key,'identityBoundary','supported_bilateral_reach_vs_external_abdominal_med_ball_feedback','humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_identity_equivalence',NULL,now()),
    (1,lateral_definition,med_ball_breath_definition,'distinct_exercises',
      'Hands-on-ribs feedback with feet on a wall differs from external medicine-ball abdominal contact in equipment, pressure interface, support, and valid repetition.',
      jsonb_build_object('migration',migration_key,'identityBoundary','manual_lateral_rib_feedback_vs_external_med_ball_abdominal_feedback','humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_identity_equivalence',NULL,now()),
    (1,balloon_definition,med_ball_breath_definition,'distinct_exercises',
      'Medicine-ball belly breathing applies external abdominal feedback without the heel pull, small hip lift, knee ball squeeze, asymmetric arms, and resisted balloon exhalation of the exact balloon card.',
      jsonb_build_object('migration',migration_key,'identityBoundary','hip_lift_ball_and_balloon_vs_med_ball_abdominal_feedback','humanReviewRequired',TRUE,'approvalsCreated',FALSE),
      'deterministic_identity_equivalence',NULL,now())
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,
    resolution_source=EXCLUDED.resolution_source,reviewed_by=NULL,
    resolved_at=now()
  WHERE coaching.exercise_identity_resolution_v1.reviewed_by IS NULL
    AND coaching.exercise_identity_resolution_v1.resolution_source<>'human_review';

  INSERT INTO coaching.exercise_relationship_v1(
    from_variant_id,to_variant_id,relationship,similarity_score,dimensions,
    reason,conditions_json,review_status,created_by,reviewed_by,reviewed_at)
  VALUES
    (reach_wall_variant,reach_support_variant,'equipment_equivalent',92,
      ARRAY['load','stability','fatigue'],
      'Both variants retain supported supine 90/90 breathing and bilateral reach; lower-leg support usually reduces active wall pressure and cramp risk, so equipment and load still require revalidation.',
      jsonb_build_object('migration',migration_key,'automaticSubstitution',FALSE,'revalidate',jsonb_build_array('support interface','support height and stability','leg effort','hamstring symptoms','dose','duration','station logistics','persistence','coach rendering','athlete rendering'),'reviewOnly',TRUE,'approvalsCreated',FALSE),
      'review',NULL,NULL,NULL),
    (reach_support_variant,reach_wall_variant,'equipment_equivalent',88,
      ARRAY['load','stability','fatigue'],
      'Changing from fully supported lower legs to feet on a wall preserves the bilateral-reach breath cycle but can add contact pressure and leg effort and therefore is not an automatic swap.',
      jsonb_build_object('migration',migration_key,'automaticSubstitution',FALSE,'revalidate',jsonb_build_array('support interface','wall traction','hip and knee angle','leg effort','hamstring symptoms','dose','duration','station logistics','persistence','rendering'),'reviewOnly',TRUE,'approvalsCreated',FALSE),
      'review',NULL,NULL,NULL),
    (lateral_wall_variant,reach_wall_variant,'progression',76,
      ARRAY['complexity','stability','fatigue'],
      'Moves the hands from lateral-rib feedback to a sustained bilateral ceiling reach while retaining wall-supported supine 90/90 breathing and an unforced breath cycle.',
      jsonb_build_object('migration',migration_key,'onlyWhen',jsonb_build_array('bilateral reach matches workout intent','shoulder reach is comfortable'),'automaticSubstitution',FALSE,'revalidate',jsonb_build_array('identity','arm and hand contacts','shoulder symptoms','dose','fatigue','duration','logistics','persistence','rendering'),'reviewOnly',TRUE,'approvalsCreated',FALSE),
      'review',NULL,NULL,NULL),
    (reach_wall_variant,lateral_wall_variant,'regression',84,
      ARRAY['complexity','stability','fatigue'],
      'Removes the sustained arm reach and restores hands-on-ribs feedback, but this selects a distinct no-reach card and must still match the workout purpose.',
      jsonb_build_object('migration',migration_key,'onlyWhen',jsonb_build_array('no-reach lateral feedback matches objective'),'automaticSubstitution',FALSE,'revalidate',jsonb_build_array('identity','hand contact','purpose','dose','fatigue','duration','logistics','persistence','rendering'),'reviewOnly',TRUE,'approvalsCreated',FALSE),
      'review',NULL,NULL,NULL),
    (reach_wall_variant,balloon_variant,'progression',58,
      ARRAY['load','complexity','stability','fatigue','decision_demand'],
      'Adds heel pull, small pelvic lift, ball squeeze, exact asymmetric arms, mouth-contact equipment, and balloon resistance; this is a distinct exercise rather than an automatic harder form.',
      jsonb_build_object('migration',migration_key,'onlyWhen',jsonb_build_array('exact balloon identity matches purpose','equipment hygiene material and supervision pass'),'automaticSubstitution',FALSE,'revalidate',jsonb_build_array('identity','laterality','equipment','hygiene','allergy','breath pressure','symptoms','dose','fatigue','duration','logistics','persistence','rendering'),'reviewOnly',TRUE,'approvalsCreated',FALSE),
      'review',NULL,NULL,NULL),
    (balloon_variant,reach_wall_variant,'regression',64,
      ARRAY['load','complexity','stability','fatigue','decision_demand'],
      'Removes the heel pull, hip lift, ball, balloon, resistance, and asymmetric arms and selects supported bilateral reach; the changed purpose and repetition boundary require full revalidation.',
      jsonb_build_object('migration',migration_key,'automaticSubstitution',FALSE,'revalidate',jsonb_build_array('identity','purpose','support','equipment removal','dose','fatigue','duration','logistics','persistence','rendering'),'reviewOnly',TRUE,'approvalsCreated',FALSE),
      'review',NULL,NULL,NULL),
    (reach_wall_variant,dead_bug_variant,'progression',52,
      ARRAY['load','leverage','complexity','stability','fatigue'],
      'Adds unsupported dynamic limb motion and longer lever control to a separately defined Dead Bug action; only use when that dynamic trunk-and-limb purpose is intended.',
      jsonb_build_object('migration',migration_key,'automaticSubstitution',FALSE,'revalidate',jsonb_build_array('identity','limb sequence','leverage','lumbar and hip symptoms','dose','fatigue','duration','space','persistence','rendering'),'reviewOnly',TRUE,'approvalsCreated',FALSE),
      'review',NULL,NULL,NULL),
    (dead_bug_variant,reach_wall_variant,'regression',62,
      ARRAY['load','leverage','complexity','stability','fatigue'],
      'Restores fixed supported legs and bilateral reach and removes dynamic limb excursions, selecting a distinct low-load supported breathing action.',
      jsonb_build_object('migration',migration_key,'automaticSubstitution',FALSE,'revalidate',jsonb_build_array('identity','support','arm position','purpose','dose','fatigue','duration','station','persistence','rendering'),'reviewOnly',TRUE,'approvalsCreated',FALSE),
      'review',NULL,NULL,NULL),
    (lateral_wall_variant,crocodile_variant,'lateral_substitution',68,
      ARRAY['stability','complexity','fatigue'],
      'Both can serve low-load breath-awareness intent, but wall-supported supine lateral feedback and prone floor feedback have different positions, contacts, access constraints, and symptom profiles.',
      jsonb_build_object('migration',migration_key,'onlyWhen',jsonb_build_array('general comfortable breath-awareness purpose permits either position'),'automaticSubstitution',FALSE,'revalidate',jsonb_build_array('identity','position','support contacts','floor access','population constraints','symptoms','dose','duration','space','persistence','rendering'),'reviewOnly',TRUE,'approvalsCreated',FALSE),
      'review',NULL,NULL,NULL),
    (crocodile_variant,lateral_wall_variant,'lateral_substitution',68,
      ARRAY['stability','complexity','fatigue'],
      'Changes prone floor feedback to a wall-supported supine 90/90 position with hands on the lateral ribs; this is a distinct card and must be reselected and rerendered.',
      jsonb_build_object('migration',migration_key,'onlyWhen',jsonb_build_array('wall-supported supine position matches the workout purpose'),'automaticSubstitution',FALSE,'revalidate',jsonb_build_array('identity','position','wall and floor station','hip and knee tolerance','population constraints','symptoms','dose','duration','persistence','rendering'),'reviewOnly',TRUE,'approvalsCreated',FALSE),
      'review',NULL,NULL,NULL)
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
  VALUES
    (1,reach_wall_variant,'technicalComplexity',26,20,'Supported supine positioning, wall contact, bilateral reach, an unforced inhale and longer exhale, and quality reset create low but nontrivial exercise complexity.','review',1,NULL,NULL,'Independent calibration required; this score does not classify an athlete.',NULL),
    (1,reach_wall_variant,'absoluteLoadDemand',8,20,'Body mass is floor supported and external load is absent; only light wall contact, arm reach, and breathing effort contribute to physical difficulty.','review',1,NULL,NULL,'Independent calibration required.',NULL),
    (1,reach_support_variant,'technicalComplexity',22,20,'Fully supported lower legs reduce support management while the participant still coordinates a bilateral reach, comfortable inhale, longer exhale, and reset.','review',1,NULL,NULL,'Independent calibration required; this score does not classify an athlete.',NULL),
    (1,reach_support_variant,'absoluteLoadDemand',5,20,'Stable lower-leg support removes most active leg effort and leaves only low reach and breathing demand without external resistance.','review',1,NULL,NULL,'Independent calibration required.',NULL),
    (1,lateral_wall_variant,'technicalComplexity',16,20,'The direct task uses fixed wall-supported legs, hands-on-ribs feedback, one comfortable inhale, one longer exhale, and a relaxed reset without an arm reach.','review',1,NULL,NULL,'Independent calibration required; this score does not classify an athlete.',NULL),
    (1,lateral_wall_variant,'absoluteLoadDemand',4,20,'The floor and wall support body mass and no external load or active lift is used; physical demand is limited to comfortable breathing and light positional effort.','review',1,NULL,NULL,'Independent calibration required.',NULL),
    (1,balloon_variant,'technicalComplexity',48,40,'Exact laterality, heel pull, small pelvic lift, ball pressure, overhead arm position, balloon seal, resisted exhale, reinhalation, and safe equipment handling create moderate coordination complexity.','review',1,NULL,NULL,'Independent calibration required; this score does not classify an athlete.',NULL),
    (1,balloon_variant,'absoluteLoadDemand',20,20,'A low hip lift, hamstring and adductor isometrics, overhead arm position, and balloon resistance add physical demand while the floor and wall still support most body mass.','review',1,NULL,NULL,'Independent calibration required.',NULL)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
    proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,
    reviewed_by=NULL,review_notes=EXCLUDED.review_notes,reviewed_at=NULL,
    updated_at=now();

  -- LEGACY_AND_PACKETS

  UPDATE coaching.exercise SET
    name='90/90 Breathing with Reach',slug='9090-breathing-with-reach',
    description='Supported supine 90/90 breathing with both arms reaching toward the ceiling. Select the exact feet-on-wall or fully-supported lower-leg canonical variant; one repetition is a comfortable inhale and longer unforced exhale with stable support, bilateral reach, no hip lift, and a comfortable reset.',
    instructions='Select and record the exact support variant. Lie supine with the declared wall or lower-leg support and hips and knees near 90 degrees. Reach both arms toward the ceiling without shrugging. Inhale comfortably through the nose, then exhale longer and unforced without crunching or forcing the back flat. Keep the support stable and do not add heel pull, hip lift, ball, balloon, limb motion, or breath hold. Reset to comfortable breathing and stop for symptoms or loss of position.',
    skill_level=NULL,age_min=NULL,age_max=NULL,default_sets=1,
    default_reps=4,default_work_seconds=NULL,default_rest_seconds=30,
    tempo='comfortable inhale; longer unforced exhale; no forced hold',
    load_note='Low external load. Track wall pressure, reach effort, breath strain, symptoms, completed and invalid cycles, and same-session trunk, shoulder, respiratory, and supine exposure.',
    est_seconds_per_set=60,is_published=FALSE,archived=FALSE,
    card_summary='Supported 90/90 breathing with bilateral reach; exact wall-foot and fully-supported lower-leg variants are selected and persisted separately.',
    coach_language='Declare the exact support variant and observe support stability, leg effort, bilateral reach, neck and shoulder tension, breath strain, rib and pelvic comfort, symptoms, valid cycles, reset, and safe floor exit.',
    athlete_language='Let the declared support carry your legs, reach both hands without shrugging, breathe in comfortably, and exhale longer without crunching. Stop and tell the coach if breathing or the position feels wrong.',
    programming_logic=jsonb_build_object(
      'selectionStatus','canonical_variant_required','selectable',TRUE,
      'canonicalDefinitionId',reach_definition,
      'exactVariantIds',jsonb_build_array(reach_wall_variant,reach_support_variant),
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'exerciseDifficultyDescribesTaskOnly',TRUE,
      'selectionInputs',jsonb_build_array('workout purpose','support availability and stability','current symptoms','supine tolerance','shoulder reach tolerance','prior trunk shoulder and breathing exposure'),
      'substitutionRevalidation',jsonb_build_array('identity','support and equipment','population constraints','dose','fatigue','duration','logistics','persistence','coach rendering','athlete rendering'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    scalable_variables=ARRAY[
      'breath_cycles','comfortable_inhale_seconds','unforced_exhale_seconds',
      'rest_seconds','support_height','reach_effort']::TEXT[],
    movement_family='Supported 90/90 Breathing with Bilateral Reach',
    primary_phase_key=NULL,phase_subrole=NULL,primary_order_slot=NULL,
    movement_requirements=jsonb_build_object(
      'selectable',TRUE,'canonicalVariantRequired',TRUE,
      'supportInterface','feet_on_stable_wall_or_lower_legs_fully_supported',
      'start','supine_hips_and_knees_near_ninety_bilateral_vertical_reach',
      'actionSequence',jsonb_build_array('comfortable_nasal_inhale','lower_rib_and_abdominal_expansion','longer_unforced_exhale','comfortable_reset'),
      'mustMaintain',jsonb_build_array('declared_leg_support','bilateral_reach_without_shrug','comfortable_neck_rib_pelvis_and_back','unforced_breathing'),
      'mustNotAdd',jsonb_build_array('spinal_rotation','crunch','forced_lumbar_flattening','heel_pull','hip_lift','ball','balloon','unsupported_limb_motion','forced_breath_hold'),
      'validCompletion','one_comfortable_inhale_and_longer_unforced_exhale_with_exact_support_reach_and_reset'),
    coaching_execution=jsonb_build_object(
      'qualityGates',jsonb_build_array('support_stable','exact_variant_visible','both_arms_reach_without_shrug','breathing_unforced','no_added_hip_lift_or_implement','comfortable_reset'),
      'stopRules',jsonb_build_array('pain','dizziness','faintness','chest_pain','unusual_shortness_of_breath','panic_or_air_hunger','neurologic_symptom','repeated_cramp','support_moves','cannot_reset_comfortably'),
      'persistence',jsonb_build_array('definition_and_variant','support_interface','planned_and_actual_cycles','cadence_if_prescribed','valid_invalid_partial_assisted_and_symptom_cycles','first_fault','stop_reason','duration','substitution')),
    pairing_logic=jsonb_build_object(
      'sameSessionBudget',jsonb_build_array('trunk_static_work','shoulder_reach_time','active_wall_pressure','breathing_practice_and_symptoms','supine_time'),
      'avoidAutomaticPairingWith',jsonb_build_array('forced_breath_holds','maximal_respiratory_work','symptom_provoking_supine_work'),
      'revalidateAfterSubstitution',TRUE),
    media_library=jsonb_build_object(
      'candidate_video_ids',jsonb_build_array('GZ6X2M6gRvQ','O-cf22YQzAg','QN77knnBw8o','yFGJI00OZ8k','kA6AtZkDxmg'),
      'reviewState','oembed_metadata_only_candidate_quarantine',
      'playbackExactnessCaptionsAccessibilityQualityAndApprovalVerified',FALSE,
      'humanReviewRequired',TRUE),
    programming_kind='exercise',linked_skill_id=NULL,why_publish_ready=FALSE,
    updated_at=now()
  WHERE id=21;

  UPDATE coaching.exercise SET
    description=CASE id
      WHEN 656 THEN 'Archived duplicate source for supported 90/90 breathing with bilateral reach. Select the canonical definition and its exact wall-foot or fully-supported lower-leg variant.'
      ELSE 'Archived ambiguous Hip Reset source. The source does not identify support contact, heel pressure, hip lift, pelvic shift, reach, ball or balloon, breath cycle, valid completion, or reset and cannot be selected safely.' END,
    instructions=CASE id
      WHEN 656 THEN 'Do not prescribe this duplicate legacy source. Route to the canonical 90/90 Breathing with Reach definition and select an exact support variant.'
      ELSE 'Do not prescribe or infer an exercise from this contextual label. Route to human identity review or select a separately exact supported reach, lateral-expansion, hip-lift/balloon, hip-shift, or other reviewed definition.' END,
    skill_level=NULL,age_min=NULL,age_max=NULL,default_sets=NULL,
    default_reps=NULL,default_work_seconds=NULL,default_rest_seconds=NULL,
    tempo=NULL,load_note=NULL,est_seconds_per_set=60,is_published=FALSE,
    archived=TRUE,
    card_summary=CASE id
      WHEN 656 THEN 'Archived duplicate; represented by exact canonical supported-reach variants.'
      ELSE 'Archived identity quarantine; exact Hip Reset action remains unresolved.' END,
    coach_language='Do not render or prescribe this legacy source. Select an exact canonical identity and rerun constraints, dose, budgets, duration, logistics, persistence, and coach and athlete rendering.',
    athlete_language='This old card is unavailable because its exact exercise was duplicated or not specified. Ask for the exact reviewed version.',
    programming_logic=jsonb_build_object(
      'selectionStatus','identity_quarantine','selectable',FALSE,
      'canonicalReachDefinitionId',reach_definition,
      'duplicateConsolidation',id=656,
      'identityFactsMissing',id=1404,
      'mustNotInferHipLiftBalloonIdentity',id=1404,
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'exerciseDifficultyDescribesTaskOnly',TRUE,
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    scalable_variables='{}'::TEXT[],
    movement_family=CASE id WHEN 656 THEN
      'Supported 90/90 Breathing with Bilateral Reach' ELSE
      'Unresolved 90/90 Breathing Context' END,
    primary_phase_key=NULL,phase_subrole=NULL,primary_order_slot=NULL,
    movement_requirements=jsonb_build_object(
      'selectable',FALSE,'sourceIdentityQuarantine',TRUE,
      'missingIdentityFacts',CASE id WHEN 1404 THEN jsonb_build_array(
        'support_interface','heel_pressure','hip_lift','pelvic_shift',
        'arm_reach','ball_or_balloon','breath_cycle','valid_completion')
        ELSE jsonb_build_array('exact_wall_or_lower_leg_support_variant') END,
      'routeToDefinition',reach_definition),
    coaching_execution=jsonb_build_object(
      'doNotRenderExecutionFromLegacySource',TRUE,
      'routeToCanonicalOrIdentityReview',TRUE),
    pairing_logic=jsonb_build_object('doNotPairUnresolvedSource',TRUE),
    media_library=jsonb_build_object(
      'reviewState','historical_candidates_superseded',
      'humanReviewRequired',TRUE),
    programming_kind='exercise',linked_skill_id=NULL,why_publish_ready=FALSE,
    updated_at=now()
  WHERE id IN(656,1404);

  UPDATE coaching.exercise_safety_profile SET
    risk_level=CASE WHEN exercise_id=21 THEN 1 ELSE 2 END,
    impact_level=0,requires_spotting=FALSE,
    requires_coach_supervision=CASE WHEN exercise_id=21
      THEN 'recommended' ELSE 'required' END,
    minimum_age_recommended=NULL,minimum_skill_level=NULL,
    minimum_prerequisite_notes=CASE WHEN exercise_id=21 THEN
      'Readiness is evaluated from the exact canonical variant, current comfortable supine and breathing tolerance, symptoms, support stability, and workout context. Exercise difficulty does not classify the participant.'
      ELSE 'This source is nonselectable. Select an exact canonical definition before evaluating current readiness; no age or exercise-level cutoff is inferred.' END,
    readiness_checks=CASE WHEN exercise_id=21 THEN ARRAY[
      'Confirm exact wall-foot or fully-supported lower-leg variant and stable support.',
      'Confirm comfortable floor entry exit supported supine position and bilateral reach.',
      'Confirm comfortable resting breathing and ability to report pain dizziness faintness panic air hunger or unusual shortness of breath.',
      'Review pregnancy postpartum respiratory cardiovascular neurologic and musculoskeletal context without diagnosing or clearing clinically.',
      'Review same-session trunk shoulder breathing and supine exposure before dose.']::TEXT[]
      ELSE ARRAY[
        'Do not start from this archived source card.',
        'Select an exact canonical definition and variant before exposure.',
        'Run current symptom support equipment dose duration logistics and rendering checks on the selected identity.']::TEXT[] END,
    stop_signs=ARRAY[
      'Pain guarding numbness tingling weakness or a new neurologic symptom.',
      'Dizziness faintness chest pain unusual shortness of breath panic or air hunger.',
      'Forced breathing repeated cramp neck jaw or shoulder strain or inability to reset comfortably.',
      'Support movement loss of declared contact or any unplanned hip lift implement limb motion or breath hold.',
      'Participant requests stop or coach cannot confirm the exact identity and quality gate.']::TEXT[],
    contraindications=CASE WHEN exercise_id=21 THEN ARRAY[
      'Unstable wall bench box floor lane or unsafe floor access.',
      'Supported supine position bilateral reach or comfortable resting breathing is not tolerated.',
      'Current symptoms or clinical instructions conflict with the planned exercise.',
      'Exact support variant dose stop signal or supervision is not declared.']::TEXT[]
      ELSE ARRAY[
        'Archived duplicate or unresolved source identity.',
        'Undefined support action breath cycle equipment laterality or valid completion.']::TEXT[] END,
    common_substitutions=CASE WHEN exercise_id=21 THEN ARRAY[
      'Select the fully-supported lower-leg reach variant after full revalidation.',
      'Select the wall-foot reach variant after full revalidation.',
      'Select the distinct hands-on-ribs no-reach card when bilateral reach is not intended.',
      'Select a separately reviewed non-supine breathing exercise when supine positioning is unsuitable.']::TEXT[]
      ELSE ARRAY[
        'Select Supported 90/90 Breathing with Bilateral Reach and an exact support variant.',
        'Select 90/90 Wall-Supported Breathing with Lateral Expansion.',
        'Select 90/90 Hip Lift with Ball and Balloon only when every exact action and equipment requirement is intended and validated.',
        'Route the ambiguous Hip Reset label to identity review.']::TEXT[] END
  WHERE exercise_id=ANY(source_ids);

  UPDATE coaching.exercise_score_v1 SET
    technical_complexity=CASE WHEN exercise_id IN(21,656) THEN 26 ELSE NULL END,
    absolute_load_demand=CASE WHEN exercise_id IN(21,656) THEN 8 ELSE NULL END,
    coordination_demand=CASE WHEN exercise_id IN(21,656) THEN 22 ELSE NULL END,
    impact=CASE WHEN exercise_id IN(21,656) THEN 1 ELSE NULL END,
    supervision_demand=CASE WHEN exercise_id=21 THEN 20
      WHEN exercise_id=656 THEN 30 ELSE NULL END,
    base_overall_difficulty=CASE WHEN exercise_id IN(21,656)
      THEN greatest(26,8) ELSE NULL END,
    legacy_scores=(coalesce(legacy_scores,'{}'::JSONB)
      -'athleteSkillOrProficiencyClassification')||jsonb_build_object(
      'candidateReassessment',migration_key,
      'projectionScope',CASE exercise_id
        WHEN 21 THEN 'canonical_wall_supported_bilateral_reach_working_variant'
        WHEN 656 THEN 'duplicate_source_projection_only_not_selectable'
        ELSE 'identity_unresolved_no_numeric_difficulty_assigned' END,
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'exerciseScoresDescribeTaskOnly',TRUE,
      'sourceSelectable',exercise_id=21,
      'humanReviewRequired',TRUE),
    migration_confidence=CASE exercise_id WHEN 21 THEN 66
      WHEN 656 THEN 60 ELSE 20 END,
    human_review_status='queued',reviewed_by=NULL,reviewed_at=NULL,
    review_notes=NULL,updated_at=now()
  WHERE exercise_id=ANY(source_ids);

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  SELECT p.definition_id,1,p.card_version,'2.0.0',migration_key,'quarantined',
    jsonb_build_object(
      'identity',jsonb_build_object(
        'passed',TRUE,'identityKey',p.identity_key,
        'activeWorkingSpecifications',p.variant_count,
        'archivedSourceRepresentations',3,
        'exerciseSkillClassificationAbsent',TRUE),
      'taxonomy',jsonb_build_object(
        'passed',TRUE,'controlledTerms',TRUE,
        'breathPatternControlled',TRUE),
      'anatomy',jsonb_build_object(
        'passed',TRUE,'musclesJointsActionsPlanesLateralityAndSupportContacts',TRUE,
        'clinicalOutcomeInferred',FALSE),
      'difficulty',jsonb_build_object(
        'passed',TRUE,'model','max_exercise_complexity_physical_difficulty',
        'overallDerived',TRUE,'scoreScope','exercise_task_only',
        'independentCalibrationRequired',TRUE),
      'loadFatigueRecovery',jsonb_build_object(
        'passed',TRUE,'lowExternalLoadDoesNotMeanZeroExposure',TRUE,
        'validInvalidPartialAssistedSymptomAndIncidentCyclesCounted',TRUE,
        'breathReachLiftEquipmentAndSameSessionBudgetsDeclared',TRUE),
      'constraints',jsonb_build_object(
        'passed',TRUE,'supportFloorSpaceEquipmentPopulationSymptomAccessibilityAndSupervision',TRUE),
      'delivery',jsonb_build_object(
        'passed',TRUE,'profiles',p.profile_count,
        'breathCycleDoseCadenceRestDurationStationMeasurementScalingAndSubstitution',TRUE),
      'instructions',jsonb_build_object(
        'passed',TRUE,'athleteCoachAndSupportOperations',TRUE,
        'validInvalidStopExitAndEscalationRules',TRUE),
      'research',jsonb_build_object(
        'passed',TRUE,'sections',16,'registryVersion',research_version,
        'directTechniqueAndGeneralEvidenceSeparated',TRUE,
        'heterogeneityBiasSafetyAndNoUniversalOutcomeLimitsExplicit',TRUE),
      'media',jsonb_build_object(
        'passed',FALSE,'candidateCount',5,
        'currentOEmbedMetadataHealthy',TRUE,'playbackReviewed',FALSE,
        'exactMatchReviewed',FALSE,'captionsReviewed',FALSE,
        'accessibilityReviewed',FALSE,'qualityReviewed',FALSE,
        'approvalCreated',FALSE),
      'relationships',jsonb_build_object(
        'passed',FALSE,'reviewOnlyOutgoing',p.outgoing_graph,'approved',0,
        'automaticSubstitutionAuthorized',FALSE),
      'calibration',jsonb_build_object(
        'passed',FALSE,'reviewOnly',p.calibration_count,'approved',0),
      'alternates',jsonb_build_object(
        'passed',TRUE,'assessments',p.alternate_count,
        'identityBoundariesExplicit',TRUE),
      'generationSupport',jsonb_build_object(
        'passed',TRUE,'selectionConstraints',TRUE,'cumulativeBudgets',TRUE,
        'duration',TRUE,'equipmentAndStation',TRUE,
        'substitutionRevalidation',TRUE,'renderingAndPersistence',TRUE,
        'coachAndAthleteRenderingRequired',TRUE),
      'publication',jsonb_build_object(
        'passed',FALSE,'reviewer',NULL,'approver',NULL)),
    jsonb_build_array(
      jsonb_build_object(
        'code','CARD-MEDIA-01',
        'message','A qualified human must watch all five candidates in full and verify exact card and variant, support, contacts, reach or no-reach, lift, ball, balloon and laterality where applicable, complete breath cycle, captions, accessibility, cue quality, safety, conflicts, current playback, reviewer identity, timestamp, and card version.'),
      jsonb_build_object(
        'code','CARD-GRAPH-03',
        'message','A qualified coach must approve or reject every progression, regression, equipment-equivalent, and lateral-substitution proposal. No automatic transfer among distinct breathing, reach, hip-lift, balloon, Dead Bug, or Crocodile identities is authorized.'),
      jsonb_build_object(
        'code','CARD-CALIBRATION-01',
        'message','An independent qualified reviewer must calibrate exercise complexity and physical difficulty. These task scores do not classify an athlete and do not alter skill-library levels.'),
      jsonb_build_object(
        'code','CARD-PUBLISH-01',
        'message','A qualified content reviewer and separate approver must verify identity, instructions, safety, evidence application, dosage, support operations, and every working specification before publication.')),
    TRUE,now()
  FROM (VALUES
    (reach_definition,2,'supported_9090_breathing_with_bilateral_reach',2,4,22,5,4),
    (lateral_definition,1,'wall_supported_9090_lateral_expansion_breathing',1,2,16,2,2),
    (balloon_definition,1,'wall_supported_9090_hip_lift_ball_and_balloon',1,2,20,1,2)
  ) p(definition_id,card_version,identity_key,variant_count,profile_count,
      alternate_count,outgoing_graph,calibration_count)
  ON CONFLICT(definition_id) DO UPDATE SET
    facility_id=EXCLUDED.facility_id,card_version=EXCLUDED.card_version,
    schema_version=EXCLUDED.schema_version,audit_version=EXCLUDED.audit_version,
    status='quarantined',checks_json=EXCLUDED.checks_json,
    blocking_issues_json=EXCLUDED.blocking_issues_json,
    human_review_required=TRUE,checked_at=now();

  -- FINAL_ASSERTIONS

  IF (SELECT count(*) FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=ANY(source_ids) AND definition_id=reach_definition
        AND provenance_json->>'migration'=migration_key
        AND provenance_json->>'representedBySelectableSourceVariant'='false')<>3
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=21 AND source_kind='legacy_migration')
    OR (SELECT count(*) FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id IN(656,1404)
        AND source_kind='duplicate_consolidation')<>2
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=1404
        AND provenance_json->>'mustNotMapToHipLiftBalloonCard'='true')
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(source_variant_ids) AND definition_id=reach_definition
        AND status='archived'
        AND requirements_json->>'representation'='identity_quarantine'
        AND requirements_json->>'selectable'='false')<>3
    OR (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id IN(source_656_definition,source_1404_definition)
        AND status='archived'
        AND provenance_json->>'breathingFamilyAuditMigration'=migration_key
        AND provenance_json->>'selectable'='false')<>2 THEN
    RAISE EXCEPTION '% found invalid source lineage archive or identity quarantine',
      migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id IN(reach_definition,lateral_definition,balloon_definition)
        AND status='review' AND schema_version='2.0.0'
        AND approved_video_url IS NULL AND reviewed_by IS NULL
        AND approved_by IS NULL AND last_reviewed_at IS NULL
        AND movement_patterns<>'{}'::TEXT[] AND body_regions<>'{}'::TEXT[]
        AND required_equipment<>'{}'::TEXT[]
        AND anatomy_json<>'{}'::JSONB AND environment_json<>'{}'::JSONB
        AND population_json<>'{}'::JSONB
        AND athlete_support_json<>'{}'::JSONB
        AND coach_support_json<>'{}'::JSONB
        AND support_operations_json<>'{}'::JSONB
        AND provenance_json->>'breathingFamilyAuditMigration'=migration_key
        AND provenance_json->>'canonicalAuthoredFromResearch'='true'
        AND provenance_json->>'approvalsCreated'='false')<>3
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=reach_definition AND legacy_exercise_id=21
        AND card_version=2 AND slug='9090-breathing-with-reach')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=lateral_definition AND legacy_exercise_id IS NULL
        AND card_version=1
        AND slug='9090-wall-supported-breathing-with-lateral-expansion')
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=balloon_definition AND legacy_exercise_id IS NULL
        AND card_version=1
        AND slug='9090-hip-lift-with-ball-and-balloon') THEN
    RAISE EXCEPTION '% found incomplete active canonical definitions',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_variant_v1
      WHERE id=ANY(active_variant_ids) AND status='review'
        AND requirements_json->>'selectable'='true'
        AND requirements_json->>'workingSpecificationRequiresHumanReview'='true'
        AND difficulty_json->>'technicalMeaning'='exercise_complexity'
        AND difficulty_json->>'loadMeaning'='physical_difficulty'
        AND (difficulty_json->>'technicalComplexity')::INTEGER BETWEEN 1 AND 100
        AND (difficulty_json->>'absoluteLoadDemand')::INTEGER BETWEEN 1 AND 100
        AND (difficulty_json->>'physicalDifficulty')::INTEGER=
          (difficulty_json->>'absoluteLoadDemand')::INTEGER
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=greatest(
          (difficulty_json->>'technicalComplexity')::INTEGER,
          (difficulty_json->>'physicalDifficulty')::INTEGER)
        AND load_profile_json<>'{}'::JSONB
        AND fatigue_profile_json<>'{}'::JSONB
        AND programming_profile_json<>'{}'::JSONB)<>4
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=reach_wall_variant AND definition_id=reach_definition
        AND (difficulty_json->>'technicalComplexity')::INTEGER=26
        AND (difficulty_json->>'physicalDifficulty')::INTEGER=8
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=26)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=reach_support_variant AND definition_id=reach_definition
        AND (difficulty_json->>'technicalComplexity')::INTEGER=22
        AND (difficulty_json->>'physicalDifficulty')::INTEGER=5
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=22)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=lateral_wall_variant AND definition_id=lateral_definition
        AND (difficulty_json->>'technicalComplexity')::INTEGER=16
        AND (difficulty_json->>'physicalDifficulty')::INTEGER=4
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=16)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=balloon_variant AND definition_id=balloon_definition
        AND (difficulty_json->>'technicalComplexity')::INTEGER=48
        AND (difficulty_json->>'physicalDifficulty')::INTEGER=20
        AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=48) THEN
    RAISE EXCEPTION '% found incomplete variants or invalid difficulty model',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=ANY(active_variant_ids) AND status='review'
        AND cardinality(equipment_required)>0
        AND length(coach_instructions)>=100
        AND length(athlete_instructions) BETWEEN 10 AND 240
        AND cardinality(stop_rules)>=3
        AND coalesce(time_model_json->>'durationFormula','')<>''
        AND dose_scaling_json<>'{}'::JSONB
        AND measurement_json<>'{}'::JSONB
        AND support_prompts_json<>'{}'::JSONB)<>8
    OR EXISTS(SELECT 1 FROM unnest(active_variant_ids) listed(variant_id)
      WHERE (SELECT count(*) FROM coaching.exercise_delivery_profile_v1 profile
        WHERE profile.variant_id=listed.variant_id AND profile.status='review')<>2) THEN
    RAISE EXCEPTION '% found incomplete contextual delivery profiles',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_section_evidence_v1
      WHERE (definition_id=reach_definition AND reviewed_card_version=2
          OR definition_id IN(lateral_definition,balloon_definition)
            AND reviewed_card_version=1)
        AND review_status='candidate' AND reviewer_user_id IS NULL
        AND reviewed_at IS NULL
        AND claims_json->>'researchVersion'=research_version
        AND claims_json->>'humanReviewRequired'='true'
        AND claims_json->>'approvalsCreated'='false')<>48
    OR EXISTS(SELECT 1 FROM (VALUES
        (reach_definition,2),(lateral_definition,1),(balloon_definition,1)
      ) listed(definition_id,card_version)
      WHERE (SELECT count(DISTINCT evidence.section_key)
        FROM coaching.exercise_section_evidence_v1 evidence
        WHERE evidence.definition_id=listed.definition_id
          AND evidence.reviewed_card_version=listed.card_version
          AND evidence.review_status='candidate'
          AND evidence.reviewer_user_id IS NULL)<>16)
    OR (SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE (definition_id=reach_definition AND reviewed_card_version=2
          OR definition_id IN(lateral_definition,balloon_definition)
            AND reviewed_card_version=1)
        AND link_status='healthy' AND review_status='candidate'
        AND embedding_allowed AND captions_available IS NULL
        AND exact_variant_match IS NULL
        AND demonstration_quality_score IS NULL
        AND reviewer_user_id IS NULL AND reviewed_at IS NULL)<>15
    OR EXISTS(SELECT 1 FROM (VALUES
        (reach_definition,2),(lateral_definition,1),(balloon_definition,1)
      ) listed(definition_id,card_version)
      WHERE (SELECT count(*) FROM coaching.exercise_media_candidate_v1 media
        WHERE media.definition_id=listed.definition_id
          AND media.reviewed_card_version=listed.card_version
          AND media.link_status='healthy' AND media.review_status='candidate')<>5)
    OR (SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id=reach_definition AND reviewed_card_version=2
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>22
    OR (SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id=lateral_definition AND reviewed_card_version=1
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>16
    OR (SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id=balloon_definition AND reviewed_card_version=1
        AND review_status='candidate' AND reviewer_user_id IS NULL)<>20 THEN
    RAISE EXCEPTION '% found incomplete evidence media or alternate packets',migration_key;
  END IF;

  IF (SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE conditions_json->>'migration'=migration_key
        AND review_status='review' AND reviewed_by IS NULL)<>10
    OR (SELECT count(*) FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(active_variant_ids) AND status='review'
        AND version=1 AND reviewed_by IS NULL)<>8
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE evidence_json->>'migration'=migration_key
        AND decision='duplicate_consolidated' AND reviewed_by IS NULL)<>1
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE evidence_json->>'migration'=migration_key
        AND decision='needs_human_review' AND reviewed_by IS NULL)<>1
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
      WHERE evidence_json->>'migration'=migration_key
        AND decision='distinct_exercises' AND reviewed_by IS NULL)<>18
    OR (SELECT count(*) FROM coaching.exercise_card_test_packet_v1
      WHERE definition_id IN(reach_definition,lateral_definition,balloon_definition)
        AND audit_version=migration_key AND status='quarantined'
        AND human_review_required
        AND jsonb_array_length(blocking_issues_json)=4)<>3
    OR EXISTS(SELECT 1 FROM coaching.exercise_card_test_packet_v1 packet
      CROSS JOIN LATERAL jsonb_array_elements(packet.blocking_issues_json) blocker
      WHERE packet.definition_id IN(reach_definition,lateral_definition,balloon_definition)
        AND packet.audit_version=migration_key
        AND blocker->>'code' NOT IN(
          'CARD-MEDIA-01','CARD-GRAPH-03','CARD-CALIBRATION-01','CARD-PUBLISH-01')) THEN
    RAISE EXCEPTION '% found incomplete graph calibration identity or packet state',
      migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(definition.movement_patterns) key
      WHERE definition.id IN(reach_definition,lateral_definition,balloon_definition)
        AND NOT EXISTS(SELECT 1 FROM coaching.movement_pattern allowed
          WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(definition.body_regions) key
      WHERE definition.id IN(reach_definition,lateral_definition,balloon_definition)
        AND NOT EXISTS(SELECT 1 FROM coaching.body_region allowed
          WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(
        definition.required_equipment||definition.optional_equipment) key
      WHERE definition.id IN(reach_definition,lateral_definition,balloon_definition)
        AND NOT EXISTS(SELECT 1 FROM coaching.equipment allowed
          WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_delivery_profile_v1 profile
      CROSS JOIN LATERAL unnest(profile.equipment_required) key
      WHERE profile.variant_id=ANY(active_variant_ids)
        AND NOT EXISTS(SELECT 1 FROM coaching.equipment allowed
          WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1 relationship
      WHERE conditions_json->>'migration'=migration_key
        AND relationship.relationship IN('progression','regression')
        AND EXISTS(SELECT 1 FROM unnest(relationship.dimensions) dimension
          WHERE dimension<>ALL(ARRAY[
            'load','leverage','range','speed','stability','complexity',
            'impact','decision_demand','fatigue']))) THEN
    RAISE EXCEPTION '% created uncontrolled taxonomy or graph dimensions',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise
      WHERE id=ANY(source_ids)
        AND (skill_level IS NOT NULL OR age_min IS NOT NULL
          OR age_max IS NOT NULL OR linked_skill_id IS NOT NULL
          OR is_published OR why_publish_ready))
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise
      WHERE id=21 AND NOT archived
        AND movement_requirements->>'selectable'='true'
        AND (movement_requirements->'mustNotAdd' ? 'spinal_rotation'))
    OR (SELECT count(*) FROM coaching.exercise
      WHERE id IN(656,1404) AND archived
        AND movement_requirements->>'selectable'='false')<>2
    OR EXISTS(SELECT 1 FROM coaching.exercise_safety_profile
      WHERE exercise_id=ANY(source_ids)
        AND (minimum_skill_level IS NOT NULL
          OR minimum_age_recommended IS NOT NULL))
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1
      WHERE exercise_id=21 AND technical_complexity=26
        AND absolute_load_demand=8 AND base_overall_difficulty=26
        AND human_review_status='queued'
        AND reviewed_by IS NULL AND reviewed_at IS NULL)
    OR NOT EXISTS(SELECT 1 FROM coaching.exercise_score_v1
      WHERE exercise_id=1404 AND technical_complexity IS NULL
        AND absolute_load_demand IS NULL
        AND base_overall_difficulty IS NULL
        AND legacy_scores->>'projectionScope'=
          'identity_unresolved_no_numeric_difficulty_assigned')
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      WHERE definition.id IN(reach_definition,lateral_definition,balloon_definition)
        AND coaching.exercise_json_has_level_classification(jsonb_build_array(
          definition.provenance_json,definition.environment_json,
          definition.population_json,definition.anatomy_json,
          definition.athlete_support_json,definition.coach_support_json,
          definition.support_operations_json)))
    OR EXISTS(SELECT 1 FROM coaching.exercise_variant_v1 variant
      WHERE variant.id=ANY(active_variant_ids)
        AND coaching.exercise_json_has_level_classification(jsonb_build_array(
          variant.difficulty_json,variant.requirements_json,
          variant.load_profile_json,variant.fatigue_profile_json,
          variant.programming_profile_json)))
    OR EXISTS(SELECT 1 FROM coaching.exercise_media_candidate_v1
      WHERE (definition_id=reach_definition AND reviewed_card_version=2
          OR definition_id IN(lateral_definition,balloon_definition)
            AND reviewed_card_version=1)
        AND (review_status<>'candidate' OR reviewer_user_id IS NOT NULL
          OR reviewed_at IS NOT NULL OR captions_available IS NOT NULL
          OR exact_variant_match IS NOT NULL
          OR demonstration_quality_score IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1
      WHERE conditions_json->>'migration'=migration_key
        AND (review_status='approved' OR reviewed_by IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(active_variant_ids)
        AND (status='approved' OR reviewed_by IS NOT NULL)) THEN
    RAISE EXCEPTION '% retained or fabricated age proficiency approval media or publication state',
      migration_key;
  END IF;
END $$;
