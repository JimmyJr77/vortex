-- Replace ambiguous Handstand Hold and wall-hold baselines with exact static
-- freestanding and wall-supported working specifications. Entry drills,
-- walking, toe pulls, shrugs, presses, negatives, apparatus skills, and shape
-- changes remain separate definitions or explicit review queues. All evidence,
-- media, graph, calibration, and content decisions remain review-only. No
-- athlete proficiency, external verification, or approval is created.

DO $$
DECLARE
  migration_key CONSTANT TEXT := '477_coaching_handstand_hold_family_audit_hardening';
  research_version CONSTANT TEXT := '2026-08-02.82';
  free_definition UUID;
  wall_definition UUID;
  affected_definition_ids UUID[];
  free_source_ids CONSTANT BIGINT[] := ARRAY[14];
  wall_source_ids CONSTANT BIGINT[] := ARRAY[252,589,806,858];
  source_ids CONSTANT BIGINT[] := free_source_ids||wall_source_ids;
  free_source_variants UUID[];
  wall_source_variants UUID[];
  source_variant_ids UUID[];
  free_floor_variant UUID := gen_random_uuid();
  free_parallette_variant UUID := gen_random_uuid();
  wall_chest_variant UUID := gen_random_uuid();
  wall_back_variant UUID := gen_random_uuid();
  free_variant_ids UUID[];
  wall_variant_ids UUID[];
  active_variant_ids UUID[];
  kickup_definition UUID;
  wall_walk_definition UUID;
  wall_line_walk_definition UUID;
  toe_pull_definition UUID;
  shrug_definition UUID;
  pushup_definition UUID;
  negative_definition UUID;
  neighbor_definition_ids UUID[];
  free_video_ids CONSTANT TEXT[] := ARRAY[
    'nDY1jlI8k6U','XtQC5F2dY1s','d6_lcWtQDxw','jmF7prkqDho','GamQNn1Avs0'];
  wall_video_ids CONSTANT TEXT[] := ARRAY[
    '2v1YDTzMcO8','H3JRaep2lUE','hLYXOP-rFk8','yvr4Nbba6Zk','vNhVZcGZK7I'];
  protected_count INTEGER;
BEGIN
  SELECT definition_id INTO free_definition FROM coaching.exercise_definition_source_v1
  WHERE legacy_exercise_id=14;
  SELECT definition_id INTO wall_definition FROM coaching.exercise_definition_source_v1
  WHERE legacy_exercise_id=252;
  SELECT id INTO kickup_definition FROM coaching.exercise_definition_v1
  WHERE slug='handstand-kick-up-wall' AND status<>'archived';
  SELECT id INTO wall_walk_definition FROM coaching.exercise_definition_v1
  WHERE slug='wall-walk' AND status<>'archived';
  SELECT id INTO wall_line_walk_definition FROM coaching.exercise_definition_v1
  WHERE slug='wall-walk-handstand-line' AND status<>'archived';
  SELECT id INTO toe_pull_definition FROM coaching.exercise_definition_v1
  WHERE slug='wall-facing-handstand-toe-pull' AND status<>'archived';
  SELECT id INTO shrug_definition FROM coaching.exercise_definition_v1
  WHERE slug='wall-handstand-shoulder-shrug' AND status<>'archived';
  SELECT id INTO pushup_definition FROM coaching.exercise_definition_v1
  WHERE slug='wall-handstand-push-up' AND status<>'archived';
  SELECT id INTO negative_definition FROM coaching.exercise_definition_v1
  WHERE slug='wall-handstand-negative-to-box' AND status<>'archived';

  free_source_variants := ARRAY[(SELECT id FROM coaching.exercise_variant_v1
    WHERE definition_id=free_definition AND variant_key='baseline')];
  wall_source_variants := ARRAY[
    (SELECT id FROM coaching.exercise_variant_v1
      WHERE definition_id=wall_definition AND variant_key='baseline'),
    (SELECT id FROM coaching.exercise_variant_v1
      WHERE definition_id=wall_definition AND variant_key='legacy-source-252-baseline'),
    (SELECT id FROM coaching.exercise_variant_v1
      WHERE definition_id=wall_definition AND variant_key='legacy-source-589-baseline'),
    (SELECT id FROM coaching.exercise_variant_v1
      WHERE definition_id=wall_definition AND variant_key='legacy-source-806-baseline')];
  affected_definition_ids := ARRAY[free_definition,wall_definition];
  source_variant_ids := free_source_variants||wall_source_variants;
  free_variant_ids := ARRAY[free_floor_variant,free_parallette_variant];
  wall_variant_ids := ARRAY[wall_chest_variant,wall_back_variant];
  active_variant_ids := free_variant_ids||wall_variant_ids;
  neighbor_definition_ids := ARRAY[
    kickup_definition,wall_walk_definition,wall_line_walk_definition,
    toe_pull_definition,shrug_definition,pushup_definition,negative_definition];

  IF (SELECT count(*) FROM coaching.exercise_definition_v1
      WHERE id=ANY(affected_definition_ids) AND status<>'archived')<>2
    OR (SELECT count(*) FROM coaching.exercise_definition_source_v1
        WHERE legacy_exercise_id=ANY(source_ids))<>5
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
        WHERE id=ANY(source_variant_ids))<>5
    OR (SELECT count(*) FROM coaching.exercise_definition_v1
        WHERE id=ANY(neighbor_definition_ids) AND status<>'archived')<>7 THEN
    RAISE EXCEPTION '% prerequisite Handstand identity state is missing or drifted',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=ANY(active_variant_ids)
        AND definition_id<>ALL(affected_definition_ids)) THEN
    RAISE EXCEPTION '% working variant UUID is owned by another definition',migration_key;
  END IF;

  SELECT coalesce(sum(n),0) INTO protected_count FROM (
    SELECT count(*) n FROM coaching.exercise_definition_v1
      WHERE id=ANY(affected_definition_ids)
        AND (status IN('published','deprecated') OR reviewed_by IS NOT NULL
          OR approved_by IS NOT NULL OR last_reviewed_at IS NOT NULL)
    UNION ALL SELECT count(*) FROM coaching.exercise_section_evidence_v1
      WHERE definition_id=ANY(affected_definition_ids)
        AND (reviewer_user_id IS NOT NULL OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=ANY(affected_definition_ids)
        AND (reviewer_user_id IS NOT NULL OR reviewed_at IS NOT NULL
          OR review_status NOT IN('candidate','superseded'))
    UNION ALL SELECT count(*) FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id=ANY(affected_definition_ids)
        AND (reviewer_user_id IS NOT NULL OR review_status NOT IN('candidate','superseded'))
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
        AND (human_review_status<>'queued' OR reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL)
  ) protected;
  IF protected_count<>0 THEN
    RAISE EXCEPTION '% refuses to replace % human-reviewed records',migration_key,protected_count;
  END IF;

  UPDATE coaching.exercise_section_evidence_v1
  SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now()
  WHERE definition_id=ANY(affected_definition_ids)
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_media_candidate_v1
  SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,
      exact_variant_match=NULL,demonstration_quality_score=NULL,updated_at=now()
  WHERE definition_id=ANY(affected_definition_ids)
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  UPDATE coaching.exercise_alternate_assessment_v1
  SET review_status='superseded',reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now()
  WHERE definition_id=ANY(affected_definition_ids)
    AND review_status='candidate' AND reviewer_user_id IS NULL;
  DELETE FROM coaching.exercise_relationship_v1
  WHERE (from_variant_id=ANY(source_variant_ids||active_variant_ids)
      OR to_variant_id=ANY(source_variant_ids||active_variant_ids))
    AND reviewed_by IS NULL AND review_status<>'approved';
  DELETE FROM coaching.exercise_score_calibration_v1
  WHERE variant_id=ANY(source_variant_ids||active_variant_ids)
    AND reviewed_by IS NULL AND status<>'approved';

  UPDATE coaching.exercise_definition_source_v1 source SET
    provenance_json=(coalesce(source.provenance_json,'{}'::JSONB)-'researchSources')
      ||jsonb_build_object(
        'migration',migration_key,'researchVersion',research_version,
        'sourceDisposition','identity_quarantine',
        'representedBySelectableSourceVariant',FALSE,
        'sourceInterpretation',CASE source.legacy_exercise_id
          WHEN 14 THEN 'generic_handstand_source_does_not_fix_external_contact_support_surface_entry_exit_hold_or_failure_boundary'
          WHEN 252 THEN 'generic_wall_line_source_does_not_fix_body_orientation_wall_contact_entry_exit_or_dose'
          WHEN 589 THEN 'chest_to_wall_label_omits_exact_contact_entry_exit_hold_and_quality_termination'
          WHEN 806 THEN 'wall_facing_label_omits_exact_contact_entry_exit_hold_and_quality_termination'
          ELSE 'generic_wall_hold_source_does_not_fix_orientation_contact_entry_exit_or_dose' END,
        'exactWorkingSpecificationRequired',TRUE,
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE)
  WHERE legacy_exercise_id=ANY(source_ids);

  UPDATE coaching.exercise_delivery_profile_v1 SET status='archived',updated_at=now()
  WHERE variant_id=ANY(source_variant_ids);
  UPDATE coaching.exercise_variant_v1 variant SET
    variant_key='identity-quarantine-source-'
      ||CASE variant.id
        WHEN free_source_variants[1] THEN '14'
        WHEN wall_source_variants[1] THEN '252'
        WHEN wall_source_variants[2] THEN '589'
        WHEN wall_source_variants[3] THEN '806'
        ELSE '858' END,
    display_name='Handstand Hold Identity Quarantine — Source '
      ||CASE variant.id
        WHEN free_source_variants[1] THEN '14'
        WHEN wall_source_variants[1] THEN '252'
        WHEN wall_source_variants[2] THEN '589'
        WHEN wall_source_variants[3] THEN '806'
        ELSE '858' END,
    modifier_keys='{}'::TEXT[],difficulty_json='{}'::JSONB,status='archived',
    requirements_json=jsonb_build_object(
      'selectable',FALSE,'representation','identity_quarantine',
      'sourceLegacyExerciseId',CASE variant.id
        WHEN free_source_variants[1] THEN 14
        WHEN wall_source_variants[1] THEN 252
        WHEN wall_source_variants[2] THEN 589
        WHEN wall_source_variants[3] THEN 806 ELSE 858 END,
      'archiveReason','source_does_not_fix_support_contact_surface_entry_exit_hold_rest_failure_and_quality_termination',
      'humanReviewRequired',TRUE),
    load_profile_json=jsonb_build_object('selectable',FALSE),
    fatigue_profile_json=jsonb_build_object('selectable',FALSE),
    programming_profile_json=jsonb_build_object(
      'selectionStatus','identity_quarantine','selectable',FALSE,
      'publicationQuarantined',TRUE),updated_at=now()
  WHERE id=ANY(source_variant_ids);

  UPDATE coaching.exercise_identity_resolution_v1 resolution SET
    evidence_json=(coalesce(resolution.evidence_json,'{}'::JSONB)-'researchSources')
      ||jsonb_build_object(
        'correctionMigration',migration_key,
        'researchSources',jsonb_build_array(
          'https://www.crossfit.com/wp-content/uploads/2025/10/11104218/How-to-Coach-CrossFit-Gymnastics.pdf',
          'https://static.usagym.org/PDFs/T%26T/JumpStart/testing23/process.pdf',
          'https://pubmed.ncbi.nlm.nih.gov/41473027/',
          'https://pubmed.ncbi.nlm.nih.gov/29471194/'),
        'invalidProneCprCitationRemoved',TRUE,
        'priorGenericClosedChainCitationNotExactIdentityEvidence',TRUE,
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    reviewed_by=NULL,resolved_at=now()
  WHERE survivor_definition_id=ANY(affected_definition_ids)
     OR resolved_definition_id=ANY(affected_definition_ids);

  INSERT INTO coaching.exercise_identity_resolution_v1(
    facility_id,survivor_definition_id,resolved_definition_id,decision,
    rationale,evidence_json,resolution_source,reviewed_by,resolved_at)
  SELECT 1,free_definition,boundary.definition_id,'distinct_exercises',
    boundary.rationale,jsonb_build_object(
      'migration',migration_key,'identityBoundary',boundary.boundary_key,
      'baseContract','static_freestanding_inverted_hand_support_with_no_external_body_contact_after_timer_start',
      'neighborContract',boundary.neighbor_contract,
      'researchSources',jsonb_build_array(
        'https://www.crossfit.com/wp-content/uploads/2025/10/11104218/How-to-Coach-CrossFit-Gymnastics.pdf',
        'https://pubmed.ncbi.nlm.nih.gov/41473027/'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,
      'decisionScope','identity_only_neighbor_card_still_requires_its_own_audit'),
    'deterministic_identity_equivalence',NULL,now()
  FROM (VALUES
    (kickup_definition,'static_no_contact_hold_vs_kickup_entry_task',
      'Handstand Kick-Up to Wall or Spot scores the lunge, hand placement, leg swing, arrival, contact, and return. Handstand Hold times the already-established unsupported position; entry may be logged but is not the repetition.','kickup_entry_and_arrival'),
    (wall_walk_definition,'static_freestanding_hold_vs_dynamic_wall_walk_cycle',
      'Wall Walk changes hand and foot contacts from prone/plank through wall ascent and descent. Freestanding Handstand Hold fixes both hands and prohibits wall contact during valid time.','wall_walk_ascent_descent_cycle'),
    (wall_line_walk_definition,'static_freestanding_hold_vs_wall_walk_to_terminal_line',
      'Wall Walk-Up to Handstand Line includes a prescribed wall-supported entry, terminal pause, and descent rather than independent static balance.','wall_walk_entry_terminal_hold_exit_sequence'),
    (toe_pull_definition,'no_external_contact_hold_vs_wall_release_repetition',
      'Wall-Facing Toe Pull begins with wall contact and deliberately removes and restores it; freestanding valid time begins only after all external body contact ends.','wall_contact_release_and_restore_cycle'),
    (shrug_definition,'static_scapular_support_vs_repeated_scapular_motion',
      'A Handstand Shoulder Shrug repeatedly depresses and elevates the scapulae. Handstand Hold preserves the declared shoulder-support position until a stop.','dynamic_scapular_elevation_depression_cycle'),
    (pushup_definition,'static_hold_vs_dynamic_elbow_flexion_extension_press',
      'Handstand Push-Up lowers and presses through declared elbow and shoulder range. Handstand Hold has no intended elbow motion and is dosed in valid seconds.','dynamic_inverted_vertical_press'),
    (negative_definition,'static_hold_vs_eccentric_inverted_press_lower',
      'Wall Handstand Negative to Box is defined by a slow eccentric lower to a target. Handstand Hold maintains the top support without that lowering repetition.','eccentric_inverted_press_lower')
  ) boundary(definition_id,boundary_key,rationale,neighbor_contract)
  ON CONFLICT(survivor_definition_id,resolved_definition_id) DO UPDATE SET
    decision=EXCLUDED.decision,rationale=EXCLUDED.rationale,
    evidence_json=EXCLUDED.evidence_json,resolution_source=EXCLUDED.resolution_source,
    reviewed_by=NULL,resolved_at=now();

  UPDATE coaching.exercise_definition_v1 SET
    canonical_name='Freestanding Handstand Hold',
    display_name='Freestanding Handstand Hold',
    aliases=ARRAY['Handstand Hold','Handstand Holds','Freestanding Handstand','Freestanding Handstand Holds']::TEXT[],
    description='A static inverted hand-support balance in which both hands remain fixed on a declared floor or parallette interface and no wall, spotter, apparatus, foot, head, forearm, or partner contacts the body after valid hold time begins. The exact line, hand support, gaze, entry, bailout, hold, and quality stop must be declared.',
    family_key='freestanding_static_inverted_hand_support_balance',
    schema_version='2.0.0',card_version=2,status='review',
    content_confidence=90,scoring_confidence=62,media_confidence=52,
    movement_patterns=ARRAY['invert','push','brace']::TEXT[],
    body_regions=ARRAY['full_body','hand','wrist','elbow','shoulder','scapula','neck','spine','rib_cage','core','pelvis','hip','knee','ankle','foot']::TEXT[],
    required_equipment=ARRAY['none']::TEXT[],
    optional_equipment=ARRAY['mat','timer','line_tape','wall_optional','partner','parallettes']::TEXT[],
    anatomy_json=jsonb_build_object(
      'primaryMuscles',jsonb_build_array('wrist_flexors','finger_flexors','serratus_anterior','upper_trapezius','anterior_deltoid','triceps_brachii'),
      'secondaryMuscles',jsonb_build_array('wrist_extensors','rotator_cuff','pectoralis_major','latissimus_dorsi','rectus_abdominis','obliques','spinal_stabilizers','gluteus_maximus','quadriceps','calf_complex'),
      'stabilizers',jsonb_build_array('intrinsic_hand_muscles','forearm_pronators_supinators','scapular_stabilizers','deep_cervical_and_trunk_stabilizers','hip_knee_and_ankle_line_stabilizers'),
      'connectiveTissues',jsonb_build_array('palmar_and_wrist_weight_bearing_tissues','elbow_and_shoulder_supporting_tissues','scapular_and_spinal_connective_tissues'),
      'joints',jsonb_build_array('hand_and_fingers','radiocarpal_and_midcarpal_joints','elbow','glenohumeral_joint','scapulothoracic_articulation','cervical_thoracic_and_lumbar_spine','hip','knee','ankle'),
      'jointActions',jsonb_build_array('wrist_extension_weight_bearing_with_sagittal_pressure_modulation','finger_flexion_pressure_modulation','elbow_extension_isometric','shoulder_flexion_isometric','scapular_upward_rotation_and_elevation_isometric','trunk_and_pelvis_anti_extension','hip_and_knee_extension_isometric','ankle_plantar_flexion_isometric'),
      'jointActionPhases',jsonb_build_object(
        'entry',jsonb_build_array('separately_recorded_kickup_press_or_assisted_placement','timer_starts_only_after_declared_shape_and_no_external_body_contact'),
        'hold',jsonb_build_array('fixed_hand_base','no_steps_or_external_contact','continuous_balance_corrections_without_declared_shape_change','quality_terminated_isometric'),
        'exit',jsonb_build_array('declared_step_down_or_cartwheel_bail','no_unplanned_head_neck_or_trunk_contact','clear_station_before_next_attempt')),
      'planes',jsonb_build_array('sagittal_balance_primary','frontal_weight_distribution','transverse_anti_rotation_and_hand_pressure_control'),
      'laterality',jsonb_build_object('baseline','bilateral_hand_support','handLoadingMayBeAsymmetric',TRUE,'sideAndDominantHandObservationRequired',TRUE,'oneArmVersionRequiresSeparateDefinition',TRUE),
      'evidenceLimit','Research describes skilled or novice samples, acute biomechanics, muscle activity, pressure, and balance control. It does not establish a universal line, readiness rule, dose, recovery interval, injury threshold, transfer outcome, or numeric difficulty.'),
    environment_json=jsonb_build_object(
      'surface','level_dry_nonslip_floor_or_locked_mat_or_parallettes_exactly_declared',
      'clearance',jsonb_build_array('full_body_vertical_and_cartwheel_bail_zone','no_ceiling_fixture_or_cross_traffic','no_hard_objects_in_fall_zone','coach_view_without_blocking_exit'),
      'station','one_inverted_attempt_lane_per_athlete_with_marked_hands_and_bail_arc',
      'equipmentSafety',jsonb_build_array('mat_flat_and_nonshifting','parallettes_matched_locked_dry_and_nonslip','timer_visible_or_audible','wall_if_present_is_backup_only_and_contact_ends_valid_time'),
      'changeRule','Support interface, hand spacing and orientation, body shape, gaze, entry, wall-backup policy, spotter role, bailout, hold, rest, and stop signal must be declared and revalidated.'),
    population_json=jsonb_build_object(
      'defaultPopulation','participants_who_can_tolerate_inversion_and_full_body_hand_support_and_can_execute_the_declared_entry_bailout_and_static_no_contact_hold_without_symptoms',
      'individualizationRequired',TRUE,
      'prerequisites',jsonb_build_array('pain_free_hand_wrist_elbow_shoulder_neck_and_spine_weight_bearing','declared_overhead_and_inverted_position_tolerated','safe_entry_and_bailout_demonstrated_in_current_environment','continuous_breathing_and_stop_signal','coach_can_observe_and_station_is_clear'),
      'cautions',jsonb_build_array('current_or_recent_upper_extremity_neck_spine_neurologic_cardiovascular_eye_or_pressure_symptoms','history_of_dizziness_fainting_or_inversion_intolerance','recent_high_volume_hand_support_overhead_pressing_or_tumbling','unfamiliar_surface_parallettes_entry_or_bailout'),
      'doNotAutoSelect',jsonb_build_array('exact_support_entry_bailout_or_supervision_is_unknown','pain_numbness_pressure_visual_neurologic_dizziness_or_unusual_exertional_symptoms','safe_fall_zone_or_exit_is_unavailable','athlete_cannot_support_bodyweight_or_stop_before_collapse','fatigue_prevents_repeatable_entry_line_or_bailout'),
      'ageMinimumEvidence','none_established','notClinicalClearance',TRUE,'neverInferReadinessFromExerciseDifficulty',TRUE),
    athlete_support_json=jsonb_build_object(
      'whyItMatters','This drill practices independent inverted balance and full-body hand support. Quality is a controlled no-contact hold and safe exit, not repeated uncontrolled kick-ups or longest-possible survival time.',
      'primaryCue','Push through the declared hand support, keep the assigned line, make small pressure corrections, breathe, and use the rehearsed exit at the first loss of control.',
      'before',jsonb_build_array('Confirm floor or parallettes, hand marks, shape, gaze, entry, backup-wall rule, bailout, hold, rest, and stop signal.','Clear the complete fall and cartwheel-bail zone.','Report pain, numbness, pressure, vision change, dizziness, unusual fatigue, or uncertainty.'),
      'during',jsonb_build_array('Valid time starts only after all external body contact ends.','Keep hands fixed; a step, wall touch, spotter touch, head contact, shape break, or symptom ends the attempt.','Breathe and exit before the position becomes a rescue.'),
      'expectedSensations',jsonb_build_array('hand_and_forearm_pressure','shoulder_and_scapular_support_effort','triceps_and_full_body_line_tension','continuous_small_balance_corrections'),
      'unexpectedSensations',jsonb_build_array('sharp_or_increasing_pain','numbness_or_tingling','head_or_neck_pressure','vision_change_dizziness_nausea_or_faintness','breath_lock_panic_or_loss_of_orientation','uncontrolled_fall_or_equipment_shift'),
      'painGuidance','Use the rehearsed exit, stop the station, tell the coach, and do not retry automatically.',
      'selfChecks',jsonb_build_array('exact_support_and_hand_marks','no_external_body_contact','hands_do_not_step','assigned_line_and_gaze','continuous_breathing','safe_quality_terminated_exit'),
      'accessibility',jsonb_build_array('wall_supported_card','shorter_valid_holds','more_rest','qualified_spotter_for_entry_and_rescue_not_valid_hold_assistance','floor_instead_of_parallettes','pike_or_incline_support_requires_separate_reviewed_card'),
      'mediaAlternatives',jsonb_build_array('plain_language_entry_hold_bailout','front_and_side_still_sequence','qualified_live_demonstration','visual_floor_marks_and_consent_based_tactile_cueing'),
      'stopSignal','Say stop and use the rehearsed step-down or cartwheel bailout before control is lost.'),
    coach_support_json=jsonb_build_object(
      'observationChecklist',jsonb_build_array('support_surface_hand_spacing_and_orientation','entry_and_timer_start_after_contact_ends','wrist_elbow_shoulder_scapula_head_rib_pelvis_hip_knee_ankle_line','left_right_pressure_and_hand_steps','breathing_symptoms_and_attention','first_quality_break_exit_and_station_clear'),
      'faultCorrections',jsonb_build_object('wall_or_spotter_contact','end_valid_time_and_reclassify_support','hand_steps','end_attempt_and_reduce_duration_or_select_wall_card','elbow_or_shoulder_collapse','bail_then_reduce exposure and recheck support tolerance','large_hip_or_leg_corrections','end attempt and use wall-specific balance drill','breath_lock_or_symptom','exit and reassess','unsafe_bail','remove freestanding selection until exit is taught'),
      'demonstrationPlan',jsonb_build_array('show exact hand support and entry','show valid no-contact timer start','show small hand-pressure correction without stepping','show every stop event','show step-down and cartwheel bailout in clear lane'),
      'groupManagement',jsonb_build_array('one athlete per marked fall zone','stagger attempts for direct observation','separate floor and parallette stations','assign spotter rescue role without counting assisted time','record valid failed and early-terminated seconds plus entries and exits'),
      'modificationDecisionTree',jsonb_build_array('symptom_or_unsafe_fall_stop_and_escalate','unknown_support_or_exit_quarantine_selection','external_contact_select_wall_supported_card','line_or_hand_step_reduce_duration_or regress support','parallette instability return to floor only after revalidation','recompute fatigue duration logistics substitution and rendering after change'),
      'doNotUseWhen',jsonb_build_array('inversion_or_upper_extremity_support_is_not_tolerated','safe_entry_bailout_space_or_supervision_is_missing','symptoms_or_pressure_signs_are_present','athlete_cannot_end_before_collapse','same_session_fatigue_prevents_repeatable control'),
      'validHold','Declared support, no external body contact, fixed hands, assigned shape, breathing, symptoms, elapsed time, quality stop, and safe exit all pass.',
      'difficultyBoundary','Scores describe exercise complexity and physical difficulty only. They do not classify athlete, class, or skill-library proficiency.'),
    support_operations_json=jsonb_build_object(
      'selectionInputs',jsonb_build_array('definition_variant_profile_card_and_research_version','objective_phase_and_attempt_quality','support_surface_hand_marks_shape_gaze_entry_bailout_and_backup_wall_policy','sets_attempts_valid_hold_rest_and_total_station_time','same_session_inverted_support_wrist_overhead_press_tumbling_and_fall_exposure','symptoms_recovery_population_environment_and_supervision'),
      'persistence',jsonb_build_array('workout_and_item_id','definition_variant_profile_card_and_research_version','exact_support_shape_entry_exit_and_supervision','planned_valid_failed_and_early_terminated_seconds','wall_or_spotter_contacts_hand_steps_bails_symptoms_rest_duration_and_substitution','athlete_and_coach_rendering_versions'),
      'issueCategories',jsonb_build_array('identity_support_or_variant_mismatch','unsafe_surface_space_entry_bailout_or_supervision','pain_pressure_visual_neurologic_or_dizziness_symptom','contact_hand_step_shape_breathing_or_exit_failure','dose_duration_fatigue_recovery_or substitution mismatch','media_or_rendering_mismatch'),
      'incidentPath',jsonb_build_array('call_stop_and_make_fall_zone_safe','assess_immediate_help_need_without forcing another inversion','record support entry elapsed time contact fall symptom and context','follow facility emergency or clinical referral policy','quarantine uncertain card variant media or result'),
      'supportEscalation',jsonb_build_array('stop_and_make_station_safe','record exact support entry contact elapsed failed seconds and exit','follow facility emergency or clinical referral policy','quarantine uncertain identity media instruction or result'),
      'feedbackLoop',jsonb_build_array('athlete reports symptoms fear and perceived balance loss','coach records observed first break and exit','support triages identity environment content or product issue','future review uses deidentified aggregate failures without auto approval'),
      'changeImpactPolicy','Any support, contact, shape, gaze, entry, bailout, wall, spotter, surface, hold, rest, fatigue, symptom, population, substitution, media, or instruction change invalidates cached selection, duration, logistics, rendering, and approval assumptions.',
      'publication',jsonb_build_object('humanMediaGraphCalibrationContentAndSeparateApprovalRequired',TRUE),
      'publicationQuarantined',TRUE),
    provenance_json=(coalesce(provenance_json,'{}'::JSONB)-'researchSources')
      ||jsonb_build_object(
        'handstandHoldAuditHardeningMigration',migration_key,'researchVersion',research_version,
        'canonicalAuthoredFromResearch',TRUE,'legacySources',free_source_ids,
        'activeWorkingSpecifications',jsonb_build_array('freestanding-floor-straight-line','freestanding-parallettes-straight-line'),
        'researchSources',jsonb_build_array(
          'https://www.crossfit.com/wp-content/uploads/2025/10/11104218/How-to-Coach-CrossFit-Gymnastics.pdf',
          'https://static.usagym.org/PDFs/T%26T/JumpStart/testing23/process.pdf',
          'https://pubmed.ncbi.nlm.nih.gov/41473027/','https://pubmed.ncbi.nlm.nih.gov/29471194/',
          'https://pubmed.ncbi.nlm.nih.gov/39508479/','https://pubmed.ncbi.nlm.nih.gov/38739595/',
          'https://pubmed.ncbi.nlm.nih.gov/31197281/','https://pmc.ncbi.nlm.nih.gov/articles/PMC7801474/',
          'https://pubmed.ncbi.nlm.nih.gov/40980972/'),
        'invalidPriorCitationsRemoved',jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/32707142/'),
        'priorGenericClosedChainCitationNotExactIdentityEvidence','https://pmc.ncbi.nlm.nih.gov/articles/PMC9250763/',
        'mediaState','five_current_oembed_healthy_candidates_unreviewed','oembedCheckedAt','2026-08-02',
        'difficultyModel','exercise_complexity_and_physical_difficulty_only',
        'researchLimits','Professional and governing-body specifications plus acute and observational biomechanics; no universal safety dose recovery outcome transfer or numeric difficulty claim.',
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE,'publicationQuarantined',TRUE),
    approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,last_reviewed_at=NULL,updated_at=now()
  WHERE id=free_definition;

  UPDATE coaching.exercise_definition_v1 SET
    canonical_name='Wall-Supported Handstand Hold',display_name='Wall Handstand Hold',
    aliases=ARRAY['Wall Handstand Holds','Wall Handstand Line Hold','Wall Handstand Line Holds','Chest-to-Wall Handstand Hold','Wall-Facing Handstand Hold','Back-to-Wall Handstand Hold','Nose-to-Wall Handstand Hold']::TEXT[],
    description='A static inverted hand-support hold with a declared chest-to-wall or back-to-wall orientation and declared foot contact retained for the full valid interval. Support orientation, contact points, hand distance, line, entry, exit, hold, and stop must be exact. Removing and restoring wall contact is a separate balance drill.',
    family_key='wall_supported_static_inverted_hand_support_hold',
    schema_version='2.0.0',card_version=2,status='review',
    content_confidence=92,scoring_confidence=66,media_confidence=56,
    movement_patterns=ARRAY['invert','push','brace']::TEXT[],
    body_regions=ARRAY['full_body','hand','wrist','elbow','shoulder','scapula','neck','spine','rib_cage','core','pelvis','hip','knee','ankle','foot']::TEXT[],
    required_equipment=ARRAY['wall']::TEXT[],
    optional_equipment=ARRAY['mat','timer','line_tape','partner','parallettes']::TEXT[],
    anatomy_json=jsonb_build_object(
      'primaryMuscles',jsonb_build_array('wrist_flexors','serratus_anterior','upper_trapezius','anterior_deltoid','triceps_brachii'),
      'secondaryMuscles',jsonb_build_array('finger_flexors','wrist_extensors','rotator_cuff','pectoralis_major','latissimus_dorsi','rectus_abdominis','obliques','spinal_stabilizers','gluteus_maximus','quadriceps','calf_complex'),
      'stabilizers',jsonb_build_array('intrinsic_hand_muscles','forearm_pronators_supinators','scapular_stabilizers','deep_cervical_and_trunk_stabilizers','hip_knee_and_ankle_line_stabilizers'),
      'connectiveTissues',jsonb_build_array('palmar_and_wrist_weight_bearing_tissues','elbow_and_shoulder_supporting_tissues','scapular_and_spinal_connective_tissues'),
      'joints',jsonb_build_array('hand_and_fingers','radiocarpal_and_midcarpal_joints','elbow','glenohumeral_joint','scapulothoracic_articulation','cervical_thoracic_and_lumbar_spine','hip','knee','ankle'),
      'jointActions',jsonb_build_array('wrist_extension_weight_bearing','finger_pressure_modulation','elbow_extension_isometric','shoulder_flexion_isometric','scapular_upward_rotation_and_elevation_isometric','trunk_and_pelvis_anti_extension','hip_and_knee_extension_isometric','declared_foot_wall_contact'),
      'jointActionPhases',jsonb_build_object(
        'entry',jsonb_build_array('declared_wall_walk_kickup_or_assisted_placement','establish_exact_orientation_hand_distance_and_foot_contact_before_timer'),
        'hold',jsonb_build_array('fixed_hand_and_wall_contact','no_toe_pull_step_shrug_press_or_shape_change','continuous_breathing','quality_terminated_isometric'),
        'exit',jsonb_build_array('declared_wall_walk_down_or_controlled_step_down','spotter_rescue_if_planned','no_head_neck_or_trunk_impact')),
      'planes',jsonb_build_array('sagittal_alignment_primary','frontal_weight_distribution','transverse_anti_rotation'),
      'laterality',jsonb_build_object('baseline','bilateral_hand_and_foot_support','handLoadingMayBeAsymmetric',TRUE,'sideAndDominantHandObservationRequired',TRUE,'oneArmOrSideShiftRequiresSeparateDefinition',TRUE),
      'evidenceLimit','Wall protocols provide exact examples, while handstand research largely studies freestanding skilled or novice samples. No source establishes universal wall distance, line, dose, recovery, safety threshold, progression, transfer, or numeric difficulty.'),
    environment_json=jsonb_build_object(
      'surface','level_dry_nonslip_floor_with_flat_optional_mat_and_structurally_stable_clear_wall',
      'clearance',jsonb_build_array('full_body_wall_lane','clear_entry_and_exit_path','no_ceiling_fixture_or_cross_traffic','no_objects_between_athlete_and_exit','coach_view_without_blocking descent'),
      'station','one_wall_lane_per_athlete_with_marked_hands_and no shared crossing path',
      'equipmentSafety',jsonb_build_array('wall_clean_dry_stable_and_unobstructed','mat_flat_and_nonshifting','parallettes_if_used_matched_locked_dry_and_nonslip','timer_visible_or_audible'),
      'changeRule','Orientation, wall contact, hand distance and support, line, gaze, entry, exit, spotter role, hold, rest, and stop signal must be declared and revalidated.'),
    population_json=jsonb_build_object(
      'defaultPopulation','participants_who_can_tolerate_inversion_and_full_body_hand_support_and can enter hold and exit the exact wall orientation without symptoms or rescue',
      'individualizationRequired',TRUE,
      'prerequisites',jsonb_build_array('pain_free_hand_wrist_elbow_shoulder_neck_and_spine_weight_bearing','declared_inverted_wall position tolerated','exact entry and exit demonstrated in current station','continuous breathing and stop signal','wall lane and supervision available'),
      'cautions',jsonb_build_array('current_or_recent upper extremity neck spine neurologic cardiovascular eye or pressure symptoms','history of dizziness fainting or inversion intolerance','recent high volume hand support overhead pressing or tumbling','unfamiliar wall orientation entry or exit'),
      'doNotAutoSelect',jsonb_build_array('orientation contact entry exit or supervision is unknown','pain numbness pressure visual neurologic dizziness or unusual exertional symptoms','safe wall fall zone or descent unavailable','athlete cannot support bodyweight or stop before collapse','fatigue prevents repeatable entry line or exit'),
      'ageMinimumEvidence','none_established','notClinicalClearance',TRUE,'neverInferReadinessFromExerciseDifficulty',TRUE),
    athlete_support_json=jsonb_build_object(
      'whyItMatters','This drill practices inverted shoulder, wrist, and trunk support with the wall reducing independent balance demand. The goal is an exact supported line, breathing, and controlled exit—not removing the feet or surviving to exhaustion.',
      'primaryCue','Enter the assigned wall orientation, push tall, keep the declared contacts and line, breathe, and come down at the first quality change.',
      'before',jsonb_build_array('Confirm chest-to-wall or back-to-wall, hand marks, foot contact, line, entry, exit, hold, rest, and stop signal.','Check wall, floor, mat, ceiling, and descent lane.','Report pain, numbness, pressure, vision change, dizziness, unusual fatigue, or uncertainty.'),
      'during',jsonb_build_array('Valid time starts only after exact wall contact and line are set.','Keep hands and declared foot contact fixed; toe pulls, shoulder shrugs, presses, steps, slides, or shape breaks end the hold.','Breathe and descend before the position becomes a rescue.'),
      'expectedSensations',jsonb_build_array('hand_and_forearm_pressure','shoulder_scapular_and_triceps_support effort','trunk_glute_and_leg_line_tension','light_declared_foot_wall_pressure'),
      'unexpectedSensations',jsonb_build_array('sharp_or_increasing_pain','numbness_or_tingling','head_or_neck_pressure','vision_change_dizziness_nausea_or_faintness','breath_lock_panic_or_loss_of_orientation','wall_slip_uncontrolled_descent_or_equipment_shift'),
      'painGuidance','Use the declared descent, stop the station, tell the coach, and do not retry automatically.',
      'selfChecks',jsonb_build_array('exact_orientation_and_hand marks','declared_foot_wall_contact','hands_and_feet_do_not_step_or_slide','assigned_line_and_gaze','continuous_breathing','controlled_quality_terminated_exit'),
      'accessibility',jsonb_build_array('back_to_wall_or_chest_to_wall_only after exact revalidation','shorter_hold','more_rest','greater wall distance only as a separately declared partial angle','qualified spotter','pike or incline support requires separate reviewed card'),
      'mediaAlternatives',jsonb_build_array('plain_language_entry_hold_exit','front_and_side_still_sequence','qualified_live_demonstration','visual_wall_and_floor_marks with consent based tactile cueing'),
      'stopSignal','Say stop and use the rehearsed wall walk-down or step-down before control is lost.'),
    coach_support_json=jsonb_build_object(
      'observationChecklist',jsonb_build_array('wall stability orientation hand distance and support','entry and timer start after exact contact','wrist elbow shoulder scapula head rib pelvis hip knee ankle line','wall contact hand steps and foot slides','breathing symptoms and attention','first quality break exit and lane clear'),
      'faultCorrections',jsonb_build_object('foot_contact_lost_or_repeated','end hold; toe pull is a different drill','hand_or_foot_slide','end attempt and reset exact marks','elbow_or_shoulder_collapse','descend then shorten exposure or change reviewed card','rib_pelvis_or_line_change','end hold and reassess wall distance','breath_lock_or_symptom','descend and reassess','unsafe_exit','remove selection until exit is taught'),
      'demonstrationPlan',jsonb_build_array('show chest and back orientation separately','show exact hand distance and wall contact','show valid timer start and every stop event','show controlled wall walk-down and step-down','show how toe pulls shrugs and presses change the identity'),
      'groupManagement',jsonb_build_array('one athlete per marked wall lane','stagger entries and exits for direct observation','separate chest and back orientation stations','assign spotter rescue role without blocking descent','record valid failed and early terminated seconds plus entries and exits'),
      'modificationDecisionTree',jsonb_build_array('symptom or unsafe descent stop and escalate','unknown orientation contact or exit quarantine selection','entry failure select separately reviewed wall walk or kickup card','line or slide reduce hold or change exact orientation','loss of foot contact stop rather than count freestanding time','recompute fatigue duration logistics substitution and rendering after change'),
      'doNotUseWhen',jsonb_build_array('inversion or upper extremity support is not tolerated','safe wall entry exit space or supervision is missing','symptoms or pressure signs are present','athlete cannot descend before collapse','same session fatigue prevents repeatable support'),
      'validHold','Declared wall orientation and contact, fixed hands and feet, assigned line, breathing, symptoms, elapsed time, quality stop, and controlled exit all pass.',
      'difficultyBoundary','Scores describe exercise complexity and physical difficulty only. They do not classify athlete, class, or skill-library proficiency.'),
    support_operations_json=jsonb_build_object(
      'selectionInputs',jsonb_build_array('definition variant profile card and research version','objective phase and support capacity','orientation wall contact hand distance line gaze entry exit and spotter role','sets hold rest total supported seconds and station time','same session inverted support wrist overhead press tumbling and wall entry exposure','symptoms recovery population environment and supervision'),
      'persistence',jsonb_build_array('workout and item id','definition variant profile card and research version','exact orientation contact support entry exit and supervision','planned valid failed and early terminated seconds','slides contact losses descents symptoms rest duration and substitution','athlete and coach rendering versions'),
      'issueCategories',jsonb_build_array('identity orientation contact or variant mismatch','unsafe wall surface space entry exit or supervision','pain pressure visual neurologic or dizziness symptom','contact slide shape breathing or exit failure','dose duration fatigue recovery or substitution mismatch','media or rendering mismatch'),
      'incidentPath',jsonb_build_array('call stop and control descent','make wall lane safe and assess immediate help need','record orientation entry elapsed time fault descent symptom and context','follow facility emergency or clinical referral policy','quarantine uncertain card variant media or result'),
      'supportEscalation',jsonb_build_array('stop and make station safe','record exact orientation contact elapsed failed seconds and exit','follow facility emergency or clinical referral policy','quarantine uncertain identity media instruction or result'),
      'feedbackLoop',jsonb_build_array('athlete reports symptoms fear and perceived line loss','coach records observed first break and descent','support triages identity environment content or product issue','future review uses deidentified aggregate failures without auto approval'),
      'changeImpactPolicy','Any wall, orientation, contact, support, shape, gaze, entry, exit, spotter, hold, rest, fatigue, symptom, population, substitution, media, or instruction change invalidates cached selection, duration, logistics, rendering, and approval assumptions.',
      'publication',jsonb_build_object('humanMediaGraphCalibrationContentAndSeparateApprovalRequired',TRUE),
      'publicationQuarantined',TRUE),
    provenance_json=(coalesce(provenance_json,'{}'::JSONB)-'researchSources')
      ||jsonb_build_object(
        'handstandHoldAuditHardeningMigration',migration_key,'researchVersion',research_version,
        'canonicalAuthoredFromResearch',TRUE,'legacySources',wall_source_ids,
        'activeWorkingSpecifications',jsonb_build_array('chest-to-wall-straight-line','back-to-wall-straight-line'),
        'researchSources',jsonb_build_array(
          'https://www.crossfit.com/wp-content/uploads/2025/10/11104218/How-to-Coach-CrossFit-Gymnastics.pdf',
          'https://static.usagym.org/PDFs/T%26T/JumpStart/testing23/process.pdf',
          'https://pubmed.ncbi.nlm.nih.gov/41473027/','https://pubmed.ncbi.nlm.nih.gov/29471194/',
          'https://pubmed.ncbi.nlm.nih.gov/39508479/','https://pubmed.ncbi.nlm.nih.gov/38739595/',
          'https://pubmed.ncbi.nlm.nih.gov/31197281/','https://pmc.ncbi.nlm.nih.gov/articles/PMC7801474/',
          'https://pubmed.ncbi.nlm.nih.gov/40980972/'),
        'invalidPriorCitationsRemoved',jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/32707142/'),
        'mediaState','five_current_oembed_healthy_candidates_unreviewed','oembedCheckedAt','2026-08-02',
        'difficultyModel','exercise_complexity_and_physical_difficulty_only',
        'researchLimits','Exact governing-body and professional wall protocols plus adjacent handstand biomechanics; no universal safety dose recovery outcome transfer or numeric difficulty claim.',
        'humanReviewRequired',TRUE,'approvalsCreated',FALSE,'publicationQuarantined',TRUE),
    approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,last_reviewed_at=NULL,updated_at=now()
  WHERE id=wall_definition;

  INSERT INTO coaching.exercise_variant_v1(
    id,definition_id,variant_key,display_name,modifier_keys,difficulty_json,
    requirements_json,status,load_profile_json,fatigue_profile_json,programming_profile_json)
  SELECT v.id,v.definition_id,v.variant_key,v.display_name,v.modifiers,
    jsonb_build_object(
      'technicalComplexity',v.complexity,'absoluteLoadDemand',v.physical,
      'physicalDifficulty',v.physical,'relativeStrengthDemand',v.relative_strength,
      'mobilityDemand',v.mobility,'balanceDemand',v.balance,'stabilityDemand',v.stability,
      'coordinationDemand',v.coordination,'speedDemand',1,'decisionDemand',v.decision,
      'workCapacityDemand',v.work_capacity,'impact',1,'eccentricTissueStress',v.eccentric,
      'jointStress',v.joint_stress,'spinalLoading',v.spinal_loading,'gripDemand',v.grip,
      'inversionDemand',96,'fearConfidenceBarrier',v.fear,'supervisionDemand',v.supervision,
      'spottingDemand',v.spotting,'failureConsequence',v.failure,
      'baseOverallDifficulty',greatest(v.complexity,v.physical),
      'technicalMeaning','exercise_complexity','loadMeaning','physical_difficulty',
      'overallFormula','max(exercise_complexity,physical_difficulty)',
      'scoreState','review_only_requires_independent_calibration'),
    jsonb_build_object(
      'orientation','inverted_hand_support','supportInterface',v.support_interface,
      'externalBodyContact',v.external_contact,'wallOrientation',v.wall_orientation,
      'handContract',v.hand_contract,'bodyShape','straight_line_feet_together',
      'gaze','declared_visible_floor_reference_without_forced_neck_position',
      'entry',v.entry_contract,'timerStart',v.timer_start,
      'holdBoundary',v.hold_boundary,'breathing','continuous_without_bearing_down_or pressure symptoms',
      'qualityStop',v.quality_stop,'exit',v.exit_contract,
      'equipmentRequired',v.equipment_required,'selectable',TRUE,
      'identityQuarantine',FALSE,'workingSpecificationRequiresHumanReview',TRUE),
    'review',
    jsonb_build_object(
      'externalLoadMethod','bodyweight_inverted_hand_support','supportLoad',v.support_load,
      'wallLoadShare','not_assumed_or_quantified','gripDemand',v.grip,
      'spinalLoading',v.spinal_loading,'eccentricStress',v.eccentric,
      'landingContactsPerRep',0,'plannedImpactContacts',0,'impactClass','none_planned',
      'dominantContraction','isometric_with_continuous_balance_or_pressure_adjustment',
      'effectiveLoadDrivers',jsonb_build_array('body_mass_and_segment_distribution','hand_support_interface','wrist_and shoulder angles','wall_contact_if_supported','hold_duration','entry and exit count','prior wrist shoulder triceps trunk and inversion fatigue'),
      'loadTracking',jsonb_build_array('exact variant and support','planned and completed entries','valid failed and early terminated seconds','wall or spotter contacts and hand steps','same session inverted support wrist overhead press tumbling and carry work')),
    jsonb_build_object(
      'localMuscleFatigue',v.local_fatigue,'gripFatigue',v.grip_fatigue,
      'technicalFatigueSensitivity',v.technical_fatigue,'impactAccumulation',1,
      'recoveryHours',v.recovery_hours,
      'recoveryWindow','candidate planning estimate only; typically 12 to 48 hours depending on novelty volume support symptoms and adjacent upper body or gymnastics work',
      'primaryFatigueSites',jsonb_build_array('hands and forearms','wrists','triceps','shoulders and scapular elevators','trunk and full body line'),
      'earlyFatigueSignals',jsonb_build_array('hand pressure becomes erratic','elbow or shoulder softens','rib pelvis hip or leg line changes','hand or foot steps or slides','large balance correction wall or spotter contact','breath lock symptom panic or delayed exit'),
      'downstreamConflicts',jsonb_build_array('priority tumbling handstand walking or inversion work','high volume wrist hand support or overhead pressing','heavy carries or upper body pushing','symptomatic hand wrist elbow shoulder neck or spine loading')),
    jsonb_build_object(
      'trainingStimuli',v.stimuli,
      'stimulusDose',jsonb_build_object('primary','quality_terminated_valid_hold_seconds','countFailedAndEarlyTerminatedSecondsAndEntriesAsExposure',TRUE,'fatigueCeiling','low_to_moderate_for_quality'),
      'weeklyExposure','Combine valid failed and early terminated seconds and all entries with wall walks kickups handstand walking pushups shrugs tumbling hand support overhead pressing and wrist loading.',
      'prerequisites',jsonb_build_array('pain free support and inversion','exact support contact entry and exit understood','safe clear station and supervision','continuous breathing and stop signal','current fatigue permits repeatable exit'),
      'completionCriteria',jsonb_build_array('exact support contact line and fixed hands','no identity changing action','continuous breathing and no symptoms','quality terminated time and controlled exit','dose fault symptom duration and recovery recorded'),
      'sequenceRules',jsonb_build_array('use after wrist shoulder trunk and exit preparation','place before fatiguing upper body or tumbling work when balance quality is priority','do not use as unplanned max duration or blind fatigue station','stop before collapse contact loss uncontrolled bail or descent'),
      'pairingCompatibility',jsonb_build_array('noncompeting lower body mobility','low demand locomotion after full recovery','technical work without shared wrist shoulder or inversion fatigue'),
      'interferenceRules',jsonb_build_array('do not pre fatigue grip wrists triceps shoulders or trunk','do not pair with uncontrolled impact or traffic near fall zone','revalidate after any support orientation entry exit or dose change'),
      'selection',jsonb_build_object('phaseDefault','movement_intelligence','capacityOnlyWithExactProfileAndRecovery',TRUE,'readinessIsWorkoutInput',TRUE,'exerciseDifficultyDoesNotClassifyAthletes',TRUE),
      'publicationQuarantined',TRUE)
  FROM (VALUES
    (free_floor_variant,free_definition,'freestanding-floor-straight-line','Freestanding Floor Straight-Line Handstand Hold',ARRAY['freestanding','floor','straight_line','feet_together']::TEXT[],88,74,82,86,94,92,90,78,24,34,28,70,90,84,88,92,86,82,78,96,24,
      'flat_floor_hands','none','none','both_hands_fixed_at_declared_marks_with_fingers_available_for pressure control','separately assessed kickup press or assisted placement; entry does not count as hold','after both hands are fixed exact line is established and every wall spotter foot head forearm apparatus or partner contact has ended','no external body contact no hand step and no intended limb scapular press or walking action','first hand step external contact elbow or shoulder collapse declared line break breath failure symptom or loss of safe exit','declared step down or cartwheel bailout into clear zone',ARRAY['none']::TEXT[],'substantially all bodyweight passes through both hands with dynamic left right and palmar pressure distribution',jsonb_build_array('freestanding balance control','inverted hand support','whole body line and safe bailout')),
    (free_parallette_variant,free_definition,'freestanding-parallettes-straight-line','Freestanding Parallettes Straight-Line Handstand Hold',ARRAY['freestanding','parallettes','straight_line','feet_together']::TEXT[],90,72,84,90,96,94,92,80,26,36,30,72,92,86,90,94,88,84,80,98,24,
      'matched_locked_low_parallettes','none','none','both_hands maintain declared neutral grip on fixed matched parallettes without bar movement','separately assessed kickup press or assisted placement onto stable parallettes','after bars and hands are fixed exact line is established and all external body contact has ended','no external body contact no hand release or bar shift and no intended limb scapular press or walking action','first hand release bar shift external contact elbow or shoulder collapse line break breath failure symptom or unsafe exit','declared step down or cartwheel bailout accounting for raised supports',ARRAY['parallettes']::TEXT[],'substantially all bodyweight passes through both hands and parallettes; height and grip change wrist angle balance and fall consequence',jsonb_build_array('freestanding parallette balance','neutral grip inverted support','whole body line and raised support exit control')),
    (wall_chest_variant,wall_definition,'chest-to-wall-straight-line','Chest-to-Wall Straight-Line Handstand Hold',ARRAY['wall_supported','chest_to_wall','straight_line','feet_together']::TEXT[],64,68,74,72,72,68,60,58,18,32,22,64,72,62,66,70,64,78,68,86,18,
      'flat_floor_hands_and_stable_wall','declared toes or forefeet retain light wall contact','chest_to_wall','both hands fixed at declared equal wall distance','declared wall walk or qualified assisted placement to exact wall facing position','after hands feet wall contact line gaze breathing and exit readiness all pass','retain declared foot contact and fixed hands without toe pull slide shrug press or limb action','first contact loss hand or foot slide elbow or shoulder collapse line break breath failure symptom or unsafe descent','controlled wall walk down or qualified assisted descent',ARRAY['wall']::TEXT[],'most bodyweight passes through both hands while declared wall contact supplies external support; exact share is not assumed',jsonb_build_array('wall supported handstand line','inverted support capacity','controlled wall entry and descent')),
    (wall_back_variant,wall_definition,'back-to-wall-straight-line','Back-to-Wall Straight-Line Handstand Hold',ARRAY['wall_supported','back_to_wall','straight_line','feet_together']::TEXT[],58,64,70,66,68,62,54,54,16,30,20,60,68,58,62,66,60,74,64,82,18,
      'flat_floor_hands_and_stable_wall','declared heels retain light wall contact','back_to_wall','both hands fixed at declared equal wall distance','declared kickup or qualified assisted placement with wall receiving heels without impact','after hands heel contact line gaze breathing and exit readiness all pass','retain declared heel contact and fixed hands without heel pull slide shrug press or limb action','first contact loss hand or foot slide elbow or shoulder collapse line break breath failure symptom or unsafe descent','controlled split leg step down or qualified assisted descent',ARRAY['wall']::TEXT[],'most bodyweight passes through both hands while declared wall contact supplies external support; exact share is not assumed',jsonb_build_array('back to wall handstand support','inverted shoulder and wrist capacity','controlled kickup reception and step down'))
  ) v(id,definition_id,variant_key,display_name,modifiers,complexity,physical,relative_strength,mobility,balance,stability,coordination,decision,work_capacity,eccentric,joint_stress,spinal_loading,grip,fear,supervision,spotting,failure,local_fatigue,grip_fatigue,technical_fatigue,recovery_hours,support_interface,external_contact,wall_orientation,hand_contract,entry_contract,timer_start,hold_boundary,quality_stop,exit_contract,equipment_required,support_load,stimuli)
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
  SELECT gen_random_uuid(),v.id,p.profile_key,p.phase_key,p.role,
    CASE p.phase_key
      WHEN 'movement_intelligence' THEN 'Practice exact support, inverted line, balance or wall pressure, breathing, and the declared exit while attention and upper-body support are fresh.'
      ELSE 'Build quality-limited inverted hand-support capacity without changing the support, contact, line, entry, exit, or static identity.' END,
    CASE p.phase_key WHEN 'movement_intelligence' THEN v.mi_suitability ELSE v.capacity_suitability END,
    CASE p.phase_key WHEN 'movement_intelligence' THEN 90 ELSE 82 END,
    jsonb_build_object(
      'primaryObjective',CASE p.phase_key WHEN 'movement_intelligence' THEN 'inverted_support_position_and_balance_quality' ELSE 'quality_limited_inverted_support_capacity' END,
      'support',v.support_key,'wallSupported',v.wall_supported,
      'validOnlyWhenExactVariantPasses',TRUE,'fatigueCeiling','low_to_moderate',
      'notMaxDurationTesting',TRUE,'doesNotRankAthletes',TRUE),
    jsonb_build_object(
      'sets',CASE p.phase_key WHEN 'movement_intelligence' THEN v.mi_sets ELSE v.capacity_sets END,
      'attemptsPerSet',CASE p.phase_key WHEN 'movement_intelligence' THEN v.mi_attempts ELSE v.capacity_attempts END,
      'validHoldSecondsMin',CASE p.phase_key WHEN 'movement_intelligence' THEN v.mi_hold_min ELSE v.capacity_hold_min END,
      'validHoldSecondsMax',CASE p.phase_key WHEN 'movement_intelligence' THEN v.mi_hold_max ELSE v.capacity_hold_max END,
      'restSecondsMin',CASE p.phase_key WHEN 'movement_intelligence' THEN v.mi_rest ELSE v.capacity_rest END,
      'restSecondsMax',CASE p.phase_key WHEN 'movement_intelligence' THEN v.mi_rest+60 ELSE v.capacity_rest+60 END,
      'effortCap','stop_with_two_or_more_clean_seconds_in_reserve',
      'countFailedAndEarlyTerminatedSecondsAsExposure',TRUE,
      'countEveryEntryExitWallOrSpotterContactAndUnplannedBail',TRUE,
      'doseAuthority','candidate_profile_pending_human_review'),
    'Exact support, contact, line, gaze, breathing, elapsed time, quality stop, and controlled exit pass; the final valid second resembles the first and no attempt becomes a rescue.',
    ARRAY[
      'Sharp or increasing hand, wrist, elbow, shoulder, neck, spine, hip, knee, ankle, or foot pain.',
      'Numbness, tingling, weakness, vision change, dizziness, nausea, faintness, pressure symptoms, panic, or unusual exertional symptoms.',
      'The floor, mat, wall, parallettes, timer, hand mark, or surrounding station shifts or becomes unsafe.',
      'A hand steps, releases, or slides; a parallette moves; or an elbow or shoulder support position collapses.',
      'The assigned rib, pelvis, hip, knee, ankle, leg, or foot line changes beyond the declared correction boundary.',
      'Breathing stops, bearing down replaces breathing, or the athlete cannot answer the stop cue.',
      'Freestanding time gains wall, spotter, foot, head, forearm, apparatus, or partner contact.',
      'Wall-supported time loses or changes the declared foot contact, orientation, or hand distance.',
      'A toe pull, heel pull, shrug, press, handstand step, limb shape change, or other identity-changing action begins.',
      'The athlete cannot use the rehearsed bailout or descent before control is lost.',
      'The coach cannot directly observe the station or cross-traffic enters the fall or descent zone.',
      'The planned valid, failed, or early-terminated exposure or cumulative wrist, overhead, inversion, or tumbling budget is reached.'
    ]::TEXT[],
    'Verify the exact definition and variant, station, surface, wall or parallette stability, hand marks, support contact, shape, gaze, entry, timer start, bailout or descent, supervision, prior fatigue, dose, and stop signal. Observe every attempt and count valid, failed, and early-terminated seconds plus all entries and exits. Revalidate duration, logistics, fatigue budgets, substitutions, persistence, and both renderings after any change.',
    CASE WHEN v.wall_supported
      THEN 'Use the assigned wall direction and contacts. Push tall, keep hands and feet fixed, breathe, and come down at the first change.'
      ELSE 'Use the assigned hand support. Valid time has no outside body contact. Keep hands fixed, breathe, and take the rehearsed exit at the first change.' END,
    CASE p.phase_key
      WHEN 'movement_intelligence' THEN 'More repeatable exact inverted support, position awareness, pressure control, and timely safe exit under low fatigue.'
      ELSE 'Greater repeatable quality-limited hand, wrist, elbow, shoulder, scapular, and trunk support time without identity drift.' END,
    v.equipment_required,
    jsonb_build_object(
      'stationType',v.station_type,'athletesPerStation',1,
      'setupSeconds',v.setup_seconds,'entrySecondsPerAttempt',v.entry_seconds,
      'exitSecondsPerAttempt',v.exit_seconds,'transitionSeconds',15,
      'requiresDirectObservation',TRUE,'requiresClearFallOrDescentZone',TRUE,
      'sharedWallOrLanePolicy','no_simultaneous_crossing_entries_exits_or_bails',
      'equipmentChangeInvalidatesCachedLogistics',TRUE),
    v.substitution_ids,'review',
    jsonb_build_object(
      'durationFormula','setup + sum(each entry + observed valid failed or early terminated hold + exit + inter attempt rest) + transitions',
      'estimateSeconds',CASE p.phase_key WHEN 'movement_intelligence' THEN v.mi_duration ELSE v.capacity_duration END,
      'lowerBoundSeconds',CASE p.phase_key WHEN 'movement_intelligence' THEN v.mi_duration-90 ELSE v.capacity_duration-120 END,
      'upperBoundSeconds',CASE p.phase_key WHEN 'movement_intelligence' THEN v.mi_duration+180 ELSE v.capacity_duration+240 END,
      'includeFailedAttempts',TRUE,'includeEarlyTermination',TRUE,
      'includeEntryExitAndStationReset',TRUE,'recomputeAfterSubstitution',TRUE),
    jsonb_build_object(
      'regressionOrder',jsonb_build_array('reduce hold seconds','increase rest','reduce attempts','select exact wall supported variant','change support only through reviewed graph'),
      'progressionOrder',jsonb_build_array('improve repeatability','add valid seconds within profile','add attempts only if exits remain clean','change support or contact only through reviewed graph'),
      'neverScaleBy',jsonb_build_array('athlete proficiency label','unplanned wall or spotter contact','unsafe wall distance','survival time after quality break'),
      'revalidateAllGenerationInputs',TRUE),
    jsonb_build_object(
      'planned',jsonb_build_array('sets','attempts','valid hold seconds','rest','support and contact','entry and exit','supervision'),
      'actual',jsonb_build_array('valid failed and early terminated seconds','entries and exits','hand steps or slides','wall or spotter contacts','unplanned bails or descents','first quality break','symptoms','duration'),
      'cumulativeBudgets',jsonb_build_array('inverted support seconds','wrist extension weight bearing seconds','overhead support seconds','handstand entries','wall walks or kickups','unplanned bail or descent events','same session tumbling and overhead push exposure'),
      'persistenceRequired',TRUE,'coachAndAthleteRenderingRequired',TRUE),
    jsonb_build_object(
      'athletePrompt','Report symptoms, fear, uncertainty, first position change, outside contact, hand step, and whether the exit stayed controlled.',
      'coachPrompt','Record exact support, contact, entry, valid and failed time, stop reason, exit, cumulative exposure, substitution, and recovery note.',
      'supportPrompt','Quarantine identity, environment, media, instruction, dose, rendering, or persistence mismatches; do not convert them into approvals.',
      'incidentPrompt','Stop, make the lane safe, assess immediate help needs, document the exact event, and follow facility policy.')
  FROM (VALUES
    (free_floor_variant,'freestanding_floor',FALSE,ARRAY['none']::TEXT[],
      'clear_floor_handstand_fall_zone',30,4,4,96,78,3,4,3,10,90,3,3,6,16,120,570,720,
      ARRAY[wall_chest_variant,wall_back_variant]::UUID[]),
    (free_parallette_variant,'freestanding_parallettes',FALSE,ARRAY['parallettes']::TEXT[],
      'locked_parallette_handstand_fall_zone',45,5,5,94,76,3,4,3,8,105,3,3,5,14,135,630,780,
      ARRAY[free_floor_variant,wall_chest_variant]::UUID[]),
    (wall_chest_variant,'chest_to_wall',TRUE,ARRAY['wall']::TEXT[],
      'clear_chest_to_wall_lane',30,8,8,92,86,3,3,8,20,60,3,2,12,30,90,660,780,
      ARRAY[wall_back_variant,free_floor_variant]::UUID[]),
    (wall_back_variant,'back_to_wall',TRUE,ARRAY['wall']::TEXT[],
      'clear_back_to_wall_lane',30,5,5,90,84,3,3,8,20,60,3,2,12,30,90,600,720,
      ARRAY[wall_chest_variant,free_floor_variant]::UUID[])
  ) v(id,support_key,wall_supported,equipment_required,station_type,setup_seconds,entry_seconds,exit_seconds,mi_suitability,capacity_suitability,mi_sets,mi_attempts,mi_hold_min,mi_hold_max,mi_rest,capacity_sets,capacity_attempts,capacity_hold_min,capacity_hold_max,capacity_rest,mi_duration,capacity_duration,substitution_ids)
  CROSS JOIN (VALUES
    ('movement-intelligence-quality','movement_intelligence','primary'),
    ('capacity-quality','capacity','conditional')
  ) p(profile_key,phase_key,role)
  ON CONFLICT(variant_id,profile_key) DO UPDATE SET
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

  INSERT INTO coaching.exercise_section_evidence_v1(
    definition_id,reviewed_card_version,section_key,source_url,source_title,
    source_publisher,source_kind,claims_json,evidence_quality,review_status,
    reviewer_user_id,reviewed_at)
  SELECT d.id,2,s.section_key,s.source_url,s.source_title,s.publisher,
    s.source_kind,jsonb_build_array(
      jsonb_build_object('supported',s.supported_claim,'scope',s.scope),
      jsonb_build_object('limitation',s.limitation,
        'noUniversalSafetyDoseRecoveryOutcomeTransferOrDifficultyClaim',TRUE)),
    s.evidence_quality,'candidate',NULL,NULL
  FROM (VALUES(free_definition),(wall_definition)) d(id)
  CROSS JOIN (VALUES
    ('identity','https://www.crossfit.com/wp-content/uploads/2025/10/11104218/How-to-Coach-CrossFit-Gymnastics.pdf','Gymnastics for CrossFit Coaches: A Comprehensive Training Guide','CrossFit','professional_standard','The handstand position is separable from dynamic pressing and wall-supported options require exact entry and orientation.','professional_coaching_specification','The guide is not a comparative trial and does not define every freestanding or apparatus variant.',84),
    ('taxonomy','https://static.usagym.org/PDFs/T%26T/JumpStart/testing23/process.pdf','2023–2024 JumpStart Fitness Testing Process','USA Gymnastics','governing_body','A tested wall-facing handstand fixes wall orientation, hand placement, shoulder position, timer, and termination context.','governing_body_test_protocol','The youth testing protocol is not a universal workout dose or readiness standard.',86),
    ('anatomy','https://pubmed.ncbi.nlm.nih.gov/29471194/','Relationship between postural control and muscle activity during a handstand in young and adult gymnasts','Human Movement Science','peer_reviewed_research','Wrist flexors, trapezius, anterior deltoid, and triceps contributed materially in the tested handstands.','acute_emg_in_trained_gymnasts','Sample ages, expertise, muscles, and ten-second trials limit generalization.',88),
    ('biomechanics','https://pubmed.ncbi.nlm.nih.gov/41473027/','Biomechanical analyses of the handstand: a systematic review','Frontiers in Sports and Active Living','peer_reviewed_research','The reviewed literature describes wrist-dominant and mixed joint balance strategies plus effects of vision and head position.','systematic_review_of_handstand_biomechanics','Included studies are heterogeneous and do not establish one universal technique.',92),
    ('difficulty','https://pubmed.ncbi.nlm.nih.gov/31197281/','Stabilometric profile of handstand technique in male gymnasts','Acta of Bioengineering and Biomechanics','peer_reviewed_research','The small tested sample showed experience-related differences in hand pressure and sway control.','small_experienced_group_comparison','The study does not validate this library numeric score or athlete proficiency threshold.',84),
    ('load_fatigue_recovery','https://pubmed.ncbi.nlm.nih.gov/39508479/','The effect of full-body weight-bearing on palmar pressure distribution in collegiate-level gymnasts','Sports Biomechanics','peer_reviewed_research','A forty-five-second handstand task produced measurable regional palmar pressure and dominant-hand loading differences.','acute_palmar_pressure_study','Fifteen former collegiate athletes do not establish safe load, volume, recovery, or injury thresholds.',88),
    ('constraints','https://pubmed.ncbi.nlm.nih.gov/38739595/','Are the shoulder joint function, stability, and mobility tests predictive of handstand execution?','PLOS ONE','peer_reviewed_research','Common shoulder field tests did not predict novice handstand execution score in the tested sample.','novice_cross_sectional_assessment','The result cannot establish clearance, prerequisites, or safety for an individual.',86),
    ('dosage','https://static.usagym.org/PDFs/T%26T/JumpStart/testing23/process.pdf','2023–2024 JumpStart Fitness Testing Process','USA Gymnastics','governing_body','The document supplies one exact maximum-duration wall handstand testing protocol with equipment and timer rules.','specific_governing_body_test','A sixty-second ceiling is a test protocol, not an evidence-based universal training prescription.',86),
    ('instructions','https://www.crossfit.com/wp-content/uploads/2025/10/11104218/How-to-Coach-CrossFit-Gymnastics.pdf','Gymnastics for CrossFit Coaches: A Comprehensive Training Guide','CrossFit','professional_standard','The guide separates wall-walk and back-to-wall entries and emphasizes handstand position before pressing.','professional_coaching_instruction','Exact wording and progressions require qualified content review.',84),
    ('safety_stop_rules','https://static.usagym.org/PDFs/T%26T/JumpStart/testing23/process.pdf','2023–2024 JumpStart Fitness Testing Process','USA Gymnastics','governing_body','The protocol requires a free wall, timer, hand distance, testers, and a bounded hold.','specific_supervised_test_environment','It does not supply clinical contraindications or universal fall-risk thresholds.',86),
    ('programming','https://www.crossfit.com/wp-content/uploads/2025/10/11104218/How-to-Coach-CrossFit-Gymnastics.pdf','Gymnastics for CrossFit Coaches: A Comprehensive Training Guide','CrossFit','professional_standard','The guide programs handstand position separately from pressing strength and offers support-based options.','professional_programming_example','Examples do not prove optimal sequence, dose, intensity, or population fit.',84),
    ('athlete_support','https://pubmed.ncbi.nlm.nih.gov/41473027/','Biomechanical analyses of the handstand: a systematic review','Frontiers in Sports and Active Living','peer_reviewed_research','Small pressure and joint corrections are intrinsic to handstand balance; vision and head position affect performance.','biomechanical_explanation','The review does not validate individual cues or symptom guidance.',92),
    ('coach_support','https://pmc.ncbi.nlm.nih.gov/articles/PMC7801474/','Bidirectional causal control in the dynamics of handstand balance','Scientific Reports','peer_reviewed_research','Center-of-pressure and center-of-mass interactions differed with balance ability in the tested handstands.','motor_control_observation','Laboratory findings do not prove a single coaching correction or progression.',88),
    ('accessibility','https://www.crossfit.com/wp-content/uploads/2025/10/11104218/How-to-Coach-CrossFit-Gymnastics.pdf','Gymnastics for CrossFit Coaches: A Comprehensive Training Guide','CrossFit','professional_standard','The guide offers partial wall-walk and back-to-wall options while preserving an inverted-position objective.','professional_support_scaling','Those options still require individual support, environment, entry, exit, and symptom review.',84),
    ('alternates','https://pubmed.ncbi.nlm.nih.gov/40980972/','Neck Angle in the Handstand Changes the Pattern of Multi-Joint Variability','Journal of Motor Behavior','peer_reviewed_research','Neck position changed center-of-mass and joint variability in seven experienced female gymnasts.','small_kinematic_crossover','A small expert sample does not make one gaze or neck position universally correct.',84),
    ('media','https://www.youtube.com/watch?v=nDY1jlI8k6U','Freestanding Handstand Hold','OPEX Fitness','expert_instruction','Current oEmbed metadata supplied a candidate title, channel, thumbnail, and iframe response.','candidate_media_metadata_only','Playback, exact variant, captions, accessibility, safety, cue quality, conflicts, reviewer identity, and approval remain unverified.',60)
  ) s(section_key,source_url,source_title,publisher,source_kind,supported_claim,scope,limitation,evidence_quality)
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
  SELECT m.definition_id,NULL,2,'https://www.youtube.com/watch?v='||m.video_id,
    'https://www.youtube-nocookie.com/embed/'||m.video_id,m.video_id,m.title,
    m.channel,NULL,'en',NULL,TRUE,NULL,NULL,'healthy','candidate',
    'manual_research',m.source_query,NULL,NULL,'2026-11-02'::TIMESTAMPTZ,
    'YouTube oEmbed returned current metadata on 2026-08-02. This does not establish full playback, exact definition or variant, support, line, entry, exit, captions, accessibility, safety, conflicts, cue quality, reviewer identity, or approval.'
  FROM (VALUES
    (free_definition,'nDY1jlI8k6U','Freestanding Handstand Hold','OPEX Fitness','freestanding handstand hold exact static support'),
    (free_definition,'XtQC5F2dY1s','How To Handstand For A Long Time','FitnessFAQs','freestanding handstand hold duration technique'),
    (free_definition,'d6_lcWtQDxw','Handstand Progression for Perfect Freestanding Handstands','GMB Fitness (Praxis)','freestanding handstand progression exact hold boundary'),
    (free_definition,'jmF7prkqDho','Why Your Handstand Is Not Straight (And How To Fix It!)','Tom Merrick','freestanding straight line handstand technique'),
    (free_definition,'GamQNn1Avs0','Learn How to Hold A Handstand After Watching This Video','pigmie','freestanding handstand balance hold technique'),
    (wall_definition,'2v1YDTzMcO8','How To Do Wall Handstand Hold','Calixpert','wall handstand hold exact static support'),
    (wall_definition,'H3JRaep2lUE','Demo: Handstand Wall Hold','moveSKILL','wall handstand hold demonstration'),
    (wall_definition,'hLYXOP-rFk8','Back-To-Wall Handstand Hold | CrossFit Invictus Gymnastics','CrossFit Invictus','back to wall handstand hold exact orientation'),
    (wall_definition,'yvr4Nbba6Zk','How To Do a Handstand Hold Facing Wall','Swift Movement Academy','wall facing handstand hold exact orientation'),
    (wall_definition,'vNhVZcGZK7I','Nose-To-Wall Handstand Hold | CrossFit Invictus Gymnastics','CrossFit Invictus','nose to wall handstand hold exact orientation')
  ) m(definition_id,video_id,title,channel,source_query)
  ON CONFLICT(definition_id,reviewed_card_version,video_id) DO UPDATE SET
    variant_id=NULL,url=EXCLUDED.url,embed_url=EXCLUDED.embed_url,
    title=EXCLUDED.title,channel_name=EXCLUDED.channel_name,duration_seconds=NULL,
    language_code='en',captions_available=NULL,embedding_allowed=TRUE,
    exact_variant_match=NULL,demonstration_quality_score=NULL,
    link_status='healthy',review_status='candidate',
    discovery_method='manual_research',source_query=EXCLUDED.source_query,
    reviewer_user_id=NULL,reviewed_at=NULL,next_review_at=EXCLUDED.next_review_at,
    notes=EXCLUDED.notes,updated_at=now();

  INSERT INTO coaching.exercise_alternate_assessment_v1(
    definition_id,reviewed_card_version,alternate_name,classification,rationale,
    distinguishing_dimensions,proposed_card_json,review_status,
    reviewer_user_id,reviewed_at)
  SELECT d.id,2,a.alternate_name,
    CASE WHEN d.id=free_definition THEN a.free_classification
      ELSE a.wall_classification END,
    CASE WHEN d.id=free_definition THEN a.free_rationale
      ELSE a.wall_rationale END,
    jsonb_build_object(
      'boundaryKey',a.boundary_key,
      'factsRequired',a.facts_required,
      'exactSupportContactActionDoseAndExitRequired',TRUE,
      'neverInferFromNameAlone',TRUE),
    jsonb_build_object(
      'status','research_queue','classificationCandidate',
        CASE WHEN d.id=free_definition THEN a.free_classification ELSE a.wall_classification END,
      'requiredFacts',a.facts_required,
      'humanIdentityAndContentReviewRequired',TRUE,'approvalsCreated',FALSE),
    'candidate',NULL,NULL
  FROM (VALUES(free_definition),(wall_definition)) d(id)
  CROSS JOIN (VALUES
    ('Wall-Supported Handstand Hold','new_definition','same_identity','external_wall_contact_vs_no_external_contact','Wall support changes balance, contact, entry, exit, failure, logistics, and dose; it is not a freestanding hold.','Chest- and back-to-wall are exact variants within the wall-supported identity.',jsonb_build_array('wall_orientation','contact_points','hand_distance','entry','exit','hold')),
    ('Freestanding Floor Straight-Line Handstand Hold','same_identity','new_definition','independent_floor_balance','This is the exact floor working specification within the freestanding identity.','No external body contact changes support and balance enough to require the freestanding card.',jsonb_build_array('support_surface','external_contact','hand_marks','line','entry','bailout')),
    ('Freestanding Parallettes Straight-Line Handstand Hold','same_identity','new_definition','parallette_support_interface','Parallettes retain the static no-contact handstand while changing grip, height, stability, equipment, and bailout.','Removing wall contact changes identity; parallettes then become an exact freestanding support variant.',jsonb_build_array('bar_height','grip','base_stability','fall_clearance','entry','bailout')),
    ('Chest-to-Wall Straight-Line Handstand Hold','new_definition','same_identity','chest_to_wall_orientation','Wall contact makes this wall-supported, not freestanding.','This is an exact wall-orientation working specification.',jsonb_build_array('orientation','foot_contact','hand_distance','entry','descent','line')),
    ('Back-to-Wall Straight-Line Handstand Hold','new_definition','same_identity','back_to_wall_orientation','Wall contact makes this wall-supported, not freestanding.','This is an exact wall-orientation working specification.',jsonb_build_array('orientation','heel_contact','hand_distance','kickup','step_down','line')),
    ('Handstand Kick-Up','new_definition','new_definition','entry_action_vs_static_hold','The lunge, hand placement, leg swing, arrival, and return form a scored repetition separate from hold time.','A kick-up or wall reception is an entry task, not the static wall-supported interval.',jsonb_build_array('start','lead_leg','hand_contact','arrival','wall_or_spotter_contact','return')),
    ('Press to Handstand','new_definition','new_definition','strength_entry_vs_static_hold','A press requires a controlled strength transition from floor support to inversion before any hold.','The press action and range are separate from a wall-supported hold.',jsonb_build_array('start_support','arm_shape','hip_path','toe_off','press_range','finish')),
    ('Wall Walk','new_definition','new_definition','dynamic_contact_walk_cycle','Hand and foot travel, wall ascent, terminal position, and descent define a dynamic wall-walk repetition.','Hand and foot travel, wall ascent, terminal position, and descent define a dynamic wall-walk repetition.',jsonb_build_array('start','hand_steps','foot_steps','terminal_distance','descent','dose_unit')),
    ('Wall-Facing Toe or Heel Pull','new_definition','new_definition','wall_contact_release_cycle','The drill deliberately adds and removes wall contact rather than prohibiting it for valid freestanding time.','The drill deliberately removes and restores declared wall contact instead of retaining it.',jsonb_build_array('orientation','contact_release','one_or_two_feet','balance_interval','contact_restore','repetitions')),
    ('Handstand Shoulder Shrug','new_definition','new_definition','scapular_motion_cycle','Repeated scapular depression and elevation changes the static support contract.','Repeated scapular depression and elevation changes the static support contract.',jsonb_build_array('scapular_range','elbow_lock','repetitions','tempo','wall_or_free_support','stop')),
    ('Handstand Push-Up','new_definition','new_definition','dynamic_vertical_press','Elbow and shoulder lowering and pressing create a dynamic strength repetition.','Elbow and shoulder lowering and pressing create a dynamic strength repetition.',jsonb_build_array('support','range','bottom_target','elbow_action','tempo','return')),
    ('Handstand Negative','new_definition','new_definition','eccentric_vertical_press','A prescribed eccentric lower and terminal target are not a static top hold.','A prescribed eccentric lower and terminal target are not a static wall hold.',jsonb_build_array('start','lowering_range','tempo','target','return_strategy','dose')),
    ('Handstand Walk','new_definition','new_definition','hand_locmotion','Alternating hand steps and travel change the base of support and dose from seconds to distance or steps.','Alternating hand steps and travel remove the retained wall-support contract.',jsonb_build_array('hand_steps','distance','direction','line','turns','finish')),
    ('Handstand Shoulder Tap or March','new_definition','new_definition','unilateral_hand_release','A deliberate hand release and unilateral support interval materially change loading, balance, laterality, and failure.','A deliberate hand release from the wall-supported base materially changes loading and balance.',jsonb_build_array('supporting_hand','released_hand','wall_contact','tap_target','side_sequence','repetitions')),
    ('Handstand Pirouette','new_definition','new_definition','turning_hand_support','Hand repositioning and body rotation are required actions rather than static balance corrections.','A turn changes hand placement and orientation rather than retaining a static wall-supported hold.',jsonb_build_array('turn_degrees','hand_sequence','direction','support','finish','repetitions')),
    ('Handstand Hop or Flight Regrasp','new_definition','new_definition','flight_and_regrasp','Both hands leave and recontact the support, adding flight, impact, timing, and failure consequences.','Wall support does not make a flight/regrasp task a static hold.',jsonb_build_array('takeoff','flight','regrasp','surface','impact','landing_control')),
    ('One-Arm Handstand','new_definition','new_definition','unilateral_hand_support','Removing one hand changes laterality, base area, load, balance, and failure enough for a separate identity.','A one-arm support with or without wall contact is not the bilateral wall hold.',jsonb_build_array('supporting_hand','free_arm','body_shape','surface','entry','exit')),
    ('Headstand','new_definition','new_definition','head_and_hand_support','Head contact changes support points, neck load, joint actions, and failure strategy.','Head contact changes support points, neck load, joint actions, and failure strategy.',jsonb_build_array('head_contact','hand_contact','load_distribution','neck_position','entry','exit')),
    ('Forearm Stand','new_definition','new_definition','forearm_support','Forearm and elbow support changes the base, wrist demand, shoulder angle, balance, and exit.','Forearm support is not a hand-supported wall handstand.',jsonb_build_array('forearm_contact','elbow_spacing','hand_position','shoulder_angle','wall_contact','exit')),
    ('Rings Handstand','new_definition','new_definition','unstable_apparatus_support','Moving rings, grip, apparatus height, stabilization, mount, and dismount require an apparatus-specific definition.','Wall support does not make a rings handstand equivalent to floor hand support.',jsonb_build_array('apparatus','ring_turnout','strap_motion','mount','hold','dismount')),
    ('Parallel-Bars Handstand','new_definition','new_definition','parallel_bar_apparatus_support','Rigid elevated rails change grip, support height, shoulder mechanics, fall zone, mount, and dismount.','Rigid elevated rails require an apparatus-specific definition.',jsonb_build_array('apparatus','rail_width','grip','height','mount','dismount')),
    ('Beam Handstand','new_definition','new_definition','narrow_beam_support','A narrow elevated support changes hand placement, base width, fall consequence, entry, and exit.','A beam plus wall is still an apparatus-specific support contract.',jsonb_build_array('beam_width','beam_height','hand_orientation','entry','fall_zone','exit')),
    ('Partner Hand-to-Hand Handstand','new_definition','new_definition','human_dynamic_support','A partner supplies a moving support base with role, communication, grip, mount, dismount, and shared failure consequences.','Human support is not a stable wall and requires a partner-specific identity.',jsonb_build_array('base_role','flyer_role','grip','communication','mount','dismount')),
    ('Tuck Handstand Hold','new_variant','new_variant','tuck_body_shape','A tuck can remain within freestanding static balance only when support, no-contact rule, shape, entry, and bailout are exact.','A tuck changes body shape and contact geometry and requires an exact wall variant review.',jsonb_build_array('hip_flexion','knee_flexion','foot_position','support','contact','hold')),
    ('Straddle Handstand Hold','new_variant','new_variant','straddle_body_shape','A straddle can remain a static handstand variant but changes inertia, frontal control, clearance, and exit.','A straddle changes line and wall contacts and requires an exact wall variant review.',jsonb_build_array('hip_abduction','leg_angle','foot_contact','clearance','entry','exit')),
    ('Split or Stag Handstand Hold','new_variant','new_variant','asymmetric_leg_shape','An asymmetric leg shape changes laterality, inertia, line, observation, and side accounting.','An asymmetric leg shape changes wall contact and side accounting.',jsonb_build_array('shape','lead_leg','trail_leg','side','contact','hold')),
    ('Hand Placement and Turnout','modifier_annotation','modifier_annotation','hand_setup_annotation','Width and turnout are setup annotations while both hands remain fixed; material support-interface changes require a variant.','Width and turnout remain exact setup facts inside a fixed wall variant.',jsonb_build_array('width','turnout','finger_direction','marks','symmetry','surface')),
    ('Gaze and Neck Position','modifier_annotation','modifier_annotation','gaze_neck_annotation','Gaze and neck position affect observed balance but do not alone create another exercise identity.','Gaze and neck position remain exact annotations unless another support or action changes.',jsonb_build_array('gaze_target','neck_angle','vision_condition','line','symptoms','coach_view')),
    ('Entry Method Before Hold','modifier_annotation','modifier_annotation','entry_delivery_annotation','Kick-up, press, or assisted placement is recorded separately when the static hold is the intended dose; scoring the entry requires a new definition.','Wall walk, kick-up, or assisted placement is recorded separately when the hold is the intended dose.',jsonb_build_array('entry_type','attempts','assistance','arrival','timer_start','entry_failures')),
    ('Hold Duration and Rest','modifier_annotation','modifier_annotation','dose_annotation','Time and rest change delivery and fatigue, not static freestanding identity.','Time and rest change delivery and fatigue, not wall-supported identity.',jsonb_build_array('sets','attempts','valid_seconds','failed_seconds','rest','total_exposure')),
    ('Backup Wall With No Contact','modifier_annotation','new_definition','environment_backup_without_contact','A wall can be a fall boundary only; any body contact ends freestanding valid time and changes the recorded result.','If the wall is never contacted during valid time, the task belongs to the freestanding identity.',jsonb_build_array('wall_distance','contact_policy','timer_stop','bailout','fall_zone','result_classification')),
    ('Maximum-Time Test Protocol','modifier_annotation','modifier_annotation','testing_protocol','A maximum test changes intent, cap, measurement, termination, recovery, and supervision without changing the static no-contact action.','A maximum wall test changes intent, cap, measurement, termination, recovery, and supervision.',jsonb_build_array('test_cap','timer','testers','termination','attempt_policy','retest_interval'))
  ) a(alternate_name,free_classification,wall_classification,boundary_key,free_rationale,wall_rationale,facts_required)
  ON CONFLICT(definition_id,reviewed_card_version,alternate_name) DO UPDATE SET
    classification=EXCLUDED.classification,rationale=EXCLUDED.rationale,
    distinguishing_dimensions=EXCLUDED.distinguishing_dimensions,
    proposed_card_json=EXCLUDED.proposed_card_json,review_status='candidate',
    reviewer_user_id=NULL,reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_relationship_v1(
    from_variant_id,to_variant_id,relationship,similarity_score,dimensions,
    reason,conditions_json,review_status,created_by,reviewed_by,reviewed_at)
  SELECT r.from_id,r.to_id,r.relationship,r.similarity,r.dimensions,
    r.reason,jsonb_build_object(
      'migration',migration_key,'reviewOnly',TRUE,'automaticSubstitution',FALSE,
      'revalidate',jsonb_build_array('identity','support','contact','entry','exit','equipment','environment','symptoms','dose','fatigue','duration','logistics','persistence','coach_rendering','athlete_rendering'),
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    'review',NULL,NULL,NULL
  FROM (VALUES
    (wall_back_variant,wall_chest_variant,'progression',76,ARRAY['stability','complexity']::TEXT[],'Chest-to-wall usually increases line, proximity, entry, and descent demands, but this is a review-only candidate and not a universal progression.'),
    (wall_chest_variant,wall_back_variant,'regression',76,ARRAY['stability','complexity']::TEXT[],'Back-to-wall may reduce entry or proximity demand for a given athlete, but exact exit and line must be revalidated.'),
    (wall_chest_variant,free_floor_variant,'progression',68,ARRAY['stability','complexity','decision_demand']::TEXT[],'Removing wall contact adds independent balance and bailout demands; readiness cannot be inferred from exercise difficulty.'),
    (free_floor_variant,wall_chest_variant,'regression',68,ARRAY['stability','complexity','decision_demand']::TEXT[],'Adding exact wall contact can reduce independent balance demand but changes identity and requires full revalidation.'),
    (free_floor_variant,free_parallette_variant,'equipment_equivalent',62,ARRAY['stability','complexity','load']::TEXT[],'Parallettes retain the static no-contact hold but change grip, wrist angle, height, stability, and bailout.'),
    (free_parallette_variant,free_floor_variant,'equipment_equivalent',62,ARRAY['stability','complexity','load']::TEXT[],'Floor support retains the static no-contact hold but changes wrist extension, pressure strategy, support height, and bailout.'),
    (wall_back_variant,free_floor_variant,'progression',64,ARRAY['stability','complexity','decision_demand']::TEXT[],'Removing heel contact adds independent balance and bailout demands; no automatic transition is authorized.'),
    (free_floor_variant,wall_back_variant,'regression',64,ARRAY['stability','complexity','decision_demand']::TEXT[],'Adding heel contact may reduce balance demand while changing kick-up reception, line, and descent.')
  ) r(from_id,to_id,relationship,similarity,dimensions,reason)
  ON CONFLICT(from_variant_id,to_variant_id,relationship) DO UPDATE SET
    similarity_score=EXCLUDED.similarity_score,dimensions=EXCLUDED.dimensions,
    reason=EXCLUDED.reason,conditions_json=EXCLUDED.conditions_json,
    review_status='review',created_by=NULL,reviewed_by=NULL,reviewed_at=NULL,updated_at=now();

  INSERT INTO coaching.exercise_score_calibration_v1(
    facility_id,variant_id,dimension,proposed_score,anchor_tier,rationale,
    status,version,created_by,reviewed_by,review_notes,reviewed_at)
  SELECT 1,v.id,d.dimension,
    CASE d.dimension WHEN 'technicalComplexity' THEN v.complexity ELSE v.physical END,
    v.anchor_tier,
    CASE d.dimension WHEN 'technicalComplexity' THEN
      'Review-only exercise-complexity anchor based on support interface, external contact, hand pressure control, line, gaze, entry, timer boundary, balance or wall contact, attention, quality stop, bailout or descent, and supervision.'
    ELSE
      'Review-only physical-difficulty anchor based on full-body inverted hand support, wrist and shoulder angles, grip, wall contact, hold duration, entry and exit count, total exposure, prior upper-body work, symptoms, and recovery.' END
      ||' This is exercise scoring, not athlete proficiency. Variant: '||v.variant_key||'.',
    'review',1,NULL,NULL,
    'Research-informed proposal only; independent anchor comparison and qualified human approval remain required.',NULL
  FROM (VALUES
    (free_floor_variant,'freestanding-floor-straight-line',88,74,80),
    (free_parallette_variant,'freestanding-parallettes-straight-line',90,72,80),
    (wall_chest_variant,'chest-to-wall-straight-line',64,68,60),
    (wall_back_variant,'back-to-wall-straight-line',58,64,60)
  ) v(id,variant_key,complexity,physical,anchor_tier)
  CROSS JOIN (VALUES('technicalComplexity'),('absoluteLoadDemand')) d(dimension)
  ON CONFLICT(facility_id,variant_id,dimension,version) DO UPDATE SET
    proposed_score=EXCLUDED.proposed_score,anchor_tier=EXCLUDED.anchor_tier,
    rationale=EXCLUDED.rationale,status='review',created_by=NULL,reviewed_by=NULL,
    review_notes=EXCLUDED.review_notes,reviewed_at=NULL,updated_at=now();

  UPDATE coaching.exercise_score_v1 score SET
    technical_complexity=CASE score.exercise_id
      WHEN 14 THEN 88 WHEN 589 THEN 64 WHEN 806 THEN 64 ELSE 58 END,
    absolute_load_demand=CASE score.exercise_id
      WHEN 14 THEN 74 WHEN 589 THEN 68 WHEN 806 THEN 68 ELSE 64 END,
    coordination_demand=CASE score.exercise_id
      WHEN 14 THEN 92 WHEN 589 THEN 68 WHEN 806 THEN 68 ELSE 62 END,
    impact=1,
    supervision_demand=CASE score.exercise_id WHEN 14 THEN 86 ELSE 70 END,
    base_overall_difficulty=greatest(
      CASE score.exercise_id WHEN 14 THEN 88 WHEN 589 THEN 64 WHEN 806 THEN 64 ELSE 58 END,
      CASE score.exercise_id WHEN 14 THEN 74 WHEN 589 THEN 68 WHEN 806 THEN 68 ELSE 64 END),
    legacy_scores=coalesce(score.legacy_scores,'{}'::JSONB)||jsonb_build_object(
      'candidateReassessment',migration_key,
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'exactVariantRequired',TRUE,'supportContactEntryExitAndFailureBoundaryRequired',TRUE,
      'independentCalibrationRequired',TRUE,'humanReviewRequired',TRUE,
      'approvalsCreated',FALSE),
    migration_confidence=66,human_review_status='queued',reviewed_by=NULL,
    reviewed_at=NULL,
    review_notes='Research-informed candidate reassessment only. Scores describe exercise complexity and physical difficulty, not athlete proficiency. Exact variant and independent calibration remain required.',
    updated_at=now()
  WHERE exercise_id=ANY(source_ids);

  UPDATE coaching.exercise_difficulty_profile profile SET
    technical=CASE profile.exercise_id WHEN 14 THEN 8.8 WHEN 589 THEN 6.4 WHEN 806 THEN 6.4 ELSE 5.8 END,
    complexity=CASE profile.exercise_id WHEN 14 THEN 8.8 WHEN 589 THEN 6.4 WHEN 806 THEN 6.4 ELSE 5.8 END,
    load=CASE profile.exercise_id WHEN 14 THEN 7.4 WHEN 589 THEN 6.8 WHEN 806 THEN 6.8 ELSE 6.4 END,
    overall=greatest(
      CASE profile.exercise_id WHEN 14 THEN 8.8 WHEN 589 THEN 6.4 WHEN 806 THEN 6.4 ELSE 5.8 END,
      CASE profile.exercise_id WHEN 14 THEN 7.4 WHEN 589 THEN 6.8 WHEN 806 THEN 6.8 ELSE 6.4 END),
    recommended_age_min=NULL,recommended_age_max=NULL,attention_demand='high',
    notes='Candidate exercise complexity and physical difficulty only; exact support variant and independent calibration required. This is not an athlete proficiency classification.',
    source='canonical_research_candidate',updated_at=now()
  WHERE exercise_id=ANY(source_ids);

  UPDATE coaching.exercise SET
    skill_level=NULL,age_min=NULL,is_published=FALSE,why_publish_ready=FALSE,
    archived=id NOT IN(14,858),
    description=CASE WHEN id=14 THEN
      'Freestanding static inverted hand-support balance. Select an exact floor or parallette straight-line variant; valid time has fixed hands and no external body contact.'
      WHEN id=858 THEN
      'Wall-supported static inverted hand-support hold. Select an exact chest-to-wall or back-to-wall variant with declared contact, entry, exit, and quality stop.'
      ELSE 'Archived source representation mapped to an exact canonical Handstand Hold family. It is not independently selectable.' END,
    instructions=CASE WHEN id=14 THEN
      'Declare support surface, hand marks, line, gaze, entry, timer start after external contact ends, bailout, hold, rest, attempts, supervision, and stop. Count all entries plus valid, failed, and early-terminated seconds.'
      WHEN id=858 THEN
      'Declare wall orientation, foot contact, hand distance, line, entry, timer start, descent, hold, rest, sets, supervision, and stop. Toe pulls, steps, shrugs, presses, or contact loss end the hold.'
      ELSE 'Use the canonical Handstand Hold cards and select an exact reviewed variant; do not prescribe this archived source representation.' END,
    default_sets=CASE WHEN id IN(14,858) THEN 3 ELSE default_sets END,
    default_reps=NULL,
    default_work_seconds=CASE WHEN id=14 THEN 8 WHEN id=858 THEN 15 ELSE default_work_seconds END,
    default_rest_seconds=CASE WHEN id=14 THEN 90 WHEN id=858 THEN 60 ELSE default_rest_seconds END,
    est_seconds_per_set=CASE WHEN id=14 THEN 45 WHEN id=858 THEN 45 ELSE est_seconds_per_set END,
    card_summary=CASE WHEN id=14 THEN
      'Freestanding no-contact static handstand; exact support, line, entry, bailout, quality time, and safe exit are mandatory.'
      WHEN id=858 THEN
      'Wall-supported static handstand; exact orientation, contact, line, entry, descent, and quality time are mandatory.'
      ELSE 'Archived identity lineage; select an exact canonical Handstand Hold variant.' END,
    coach_language=CASE WHEN id=14 THEN
      'Verify exact support, no-contact timer boundary, fixed hands, line, gaze, entry, bailout, symptoms, valid and failed time, prior wrist and overhead fatigue, and controlled exit. Stop before a hand step, outside contact, collapse, breath lock, symptom, or rescue.'
      WHEN id=858 THEN
      'Verify wall orientation, contact, hand distance, line, entry, descent, symptoms, valid and failed time, prior wrist and overhead fatigue, and controlled exit. Stop before a slide, contact loss, shrug, press, breath lock, symptom, or rescue.'
      ELSE 'Do not prescribe this archived source representation; select and validate an exact canonical hold variant.' END,
    athlete_language=CASE WHEN id=14 THEN
      'Valid time has no outside body contact. Keep your hands fixed, breathe, and use your rehearsed exit at the first change.'
      WHEN id=858 THEN
      'Use the assigned wall direction and contacts. Push tall, breathe, and come down at the first change.'
      ELSE 'Ask the coach for the exact Handstand Hold variant.' END,
    programming_logic=jsonb_build_object(
      'difficultyModel','max_exercise_complexity_physical_difficulty',
      'identityRule','exact_freestanding_or_wall_supported_static_variant_required_never_silently_change_support_contact_entry_action_or_exit',
      'loadRule','record support interface wall contact valid failed and early terminated seconds all entries exits hand steps and unplanned bails',
      'fatigueRule','combine all inverted support wrist extension overhead push carry wall walk kickup handstand walk tumbling and fall exposure',
      'substitutionRule','revalidate identity support contact line entry exit dose fatigue duration logistics persistence and both renderings',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE),
    updated_at=now()
  WHERE id=ANY(source_ids);

  UPDATE coaching.exercise_safety_profile SET
    minimum_age_recommended=NULL,minimum_skill_level=NULL,
    requires_spotting=TRUE,requires_coach_supervision='required',
    readiness_checks=ARRAY[
      'Exact support, contact, entry, exit, and stop signal are understood.',
      'Hand, wrist, elbow, shoulder, neck, spine, and inversion positions are symptom-free.',
      'The wall, floor, mat, parallettes, fall zone, and descent lane are stable and clear.',
      'The athlete can breathe, communicate, and use the rehearsed bailout or descent before fatigue.'
    ]::TEXT[],
    stop_signs=ARRAY[
      'Pain, numbness, tingling, pressure, vision change, dizziness, nausea, faintness, panic, or unusual exertional symptoms.',
      'Hand step, equipment shift, elbow or shoulder collapse, line break, outside contact, wall-contact loss, or unsafe exit.',
      'Breathing stops or the athlete cannot respond to the stop command.'
    ]::TEXT[],
    contraindications=ARRAY[
      'Current symptoms or conditions for which inversion or full-body upper-extremity support has not been cleared when clearance is appropriate.',
      'No safe entry, bailout or descent, direct observation, stable support, or clear fall zone.'
    ]::TEXT[],
    common_substitutions=ARRAY[
      'Select the exact wall-supported Handstand Hold only after full revalidation.',
      'Use a separately reviewed pike or incline hand-support card when full inversion is inappropriate.',
      'Use non-inverted wrist, shoulder, scapular, or trunk preparation matching the session objective.'
    ]::TEXT[]
  WHERE exercise_id=ANY(source_ids);

  INSERT INTO coaching.exercise_card_test_packet_v1(
    definition_id,facility_id,card_version,schema_version,audit_version,status,
    checks_json,blocking_issues_json,human_review_required,checked_at)
  SELECT p.definition_id,1,2,'2.0.0',migration_key,'quarantined',
    jsonb_build_object(
      'identity',jsonb_build_object('passed',TRUE,'identityKey',p.identity_key,'legacySources',p.source_count,'activeWorkingSpecifications',2,'identityQuarantinedSources',p.source_ids,'neighborBoundaries',7,'invalidProneCprCitationRemoved',TRUE),
      'taxonomy',jsonb_build_object('passed',TRUE,'controlledTerms',TRUE,'movementPatterns',jsonb_build_array('invert','push','brace')),
      'anatomy',jsonb_build_object('passed',TRUE,'musclesTissuesJointsActionsPlanesAndLaterality',TRUE,'leftRightHandLoadingObserved',TRUE),
      'difficulty',jsonb_build_object('passed',TRUE,'model','max_exercise_complexity_physical_difficulty','athleteProficiency',NULL,'independentCalibrationRequired',TRUE),
      'loadFatigueRecovery',jsonb_build_object('passed',TRUE,'landingContactsPerRep',0,'plannedImpactContacts',0,'cumulativeInvertedWristOverheadEntryExitAndTumblingExposure',TRUE,'validFailedAndEarlyTerminatedExposure',TRUE),
      'constraints',jsonb_build_object('passed',TRUE,'supportSurfaceWallSpacePopulationInversionEntryExitBailoutAndSupervision',TRUE),
      'delivery',jsonb_build_object('passed',TRUE,'profiles',4,'durationScalingDoseRestStationAndSubstitution',TRUE),
      'instructions',jsonb_build_object('passed',TRUE,'athleteCoachSupport',TRUE,'supportContactLineGazeEntryTimerStopExitAndIncidentPath',TRUE),
      'research',jsonb_build_object('passed',TRUE,'sections',16,'registryVersion',research_version,'invalidPriorCitationsRemoved',TRUE,'governingBodyProfessionalAndResearchLimitsExplicit',TRUE),
      'media',jsonb_build_object('passed',FALSE,'candidateCount',5,'currentOEmbedMetadataHealthy',TRUE,'playbackReviewed',FALSE,'exactMatchReviewed',FALSE,'captionsReviewed',FALSE,'accessibilityReviewed',FALSE,'qualityReviewed',FALSE,'approvalCreated',FALSE),
      'relationships',jsonb_build_object('passed',FALSE,'familyReviewOnly',8,'approved',0),
      'calibration',jsonb_build_object('passed',FALSE,'reviewOnly',4,'approved',0),
      'alternates',jsonb_build_object('passed',TRUE,'assessments',32,'sourceIdentityQuarantines',p.source_count),
      'generationSupport',jsonb_build_object('passed',TRUE,'selectionConstraints',TRUE,'cumulativeFatigueBudgets',TRUE,'duration',TRUE,'equipmentAndStation',TRUE,'substitutionRevalidation',TRUE,'renderingAndPersistence',TRUE),
      'publication',jsonb_build_object('passed',FALSE,'reviewer',NULL,'approver',NULL)),
    jsonb_build_array(
      jsonb_build_object('code','CARD-MEDIA-01','message','A qualified human must watch every candidate in full and verify exact static definition and variant, support, contact, line, gaze, entry, timer boundary, bailout or descent, captions, accessibility, safety, cue quality, conflicts, reviewer identity, timestamp, card version, and current playback.'),
      jsonb_build_object('code','CARD-GRAPH-03','message','A qualified coach must approve or reject every progression, regression, equipment-equivalent, and substitution proposal; no automatic transition between wall and freestanding support is authorized.'),
      jsonb_build_object('code','CARD-CALIBRATION-01','message','An independent qualified reviewer must calibrate exercise complexity and physical difficulty. These scores are not athlete proficiency.'),
      jsonb_build_object('code','CARD-PUBLISH-01','message','A qualified reviewer and separate approver must complete content review before publication. Legacy baselines remain identity quarantines and every support, entry, exit, and failure boundary requires exact review.')),
    TRUE,now()
  FROM (VALUES
    (free_definition,'freestanding_static_inverted_hand_support_balance',1,free_source_ids),
    (wall_definition,'wall_supported_static_inverted_hand_support_hold',4,wall_source_ids)
  ) p(definition_id,identity_key,source_count,source_ids)
  ON CONFLICT(definition_id) DO UPDATE SET
    facility_id=EXCLUDED.facility_id,card_version=EXCLUDED.card_version,
    schema_version=EXCLUDED.schema_version,audit_version=EXCLUDED.audit_version,
    status='quarantined',checks_json=EXCLUDED.checks_json,
    blocking_issues_json=EXCLUDED.blocking_issues_json,
    human_review_required=TRUE,checked_at=now();

  IF (SELECT count(*) FROM coaching.exercise_definition_source_v1
      WHERE legacy_exercise_id=ANY(source_ids)
        AND provenance_json->>'sourceDisposition'='identity_quarantine'
        AND provenance_json->>'representedBySelectableSourceVariant'='false')<>5
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
        WHERE id=ANY(source_variant_ids) AND status='archived'
          AND requirements_json->>'representation'='identity_quarantine')<>5
    OR (SELECT count(*) FROM coaching.exercise_variant_v1
        WHERE id=ANY(active_variant_ids) AND status='review'
          AND requirements_json->>'selectable'='true'
          AND difficulty_json->>'technicalMeaning'='exercise_complexity'
          AND difficulty_json->>'loadMeaning'='physical_difficulty'
          AND (difficulty_json->>'baseOverallDifficulty')::INTEGER=greatest(
            (difficulty_json->>'technicalComplexity')::INTEGER,
            (difficulty_json->>'physicalDifficulty')::INTEGER)
          AND (load_profile_json->>'landingContactsPerRep')::INTEGER=0)<>4 THEN
    RAISE EXCEPTION '% found invalid source quarantine or working specifications',migration_key;
  END IF;
  IF (SELECT count(*) FROM coaching.exercise_delivery_profile_v1
      WHERE variant_id=ANY(active_variant_ids) AND status='review'
        AND cardinality(equipment_required)>0
        AND coalesce(time_model_json->>'durationFormula','')<>''
        AND length(coach_instructions)>=100
        AND length(athlete_instructions) BETWEEN 10 AND 240
        AND cardinality(stop_rules)>=10)<>8
    OR EXISTS(SELECT 1 FROM (VALUES(free_definition),(wall_definition)) d(id)
      WHERE (SELECT count(DISTINCT section_key)
        FROM coaching.exercise_section_evidence_v1 e
        WHERE e.definition_id=d.id AND reviewed_card_version=2
          AND review_status='candidate' AND reviewer_user_id IS NULL)<>16)
    OR (SELECT count(*) FROM coaching.exercise_media_candidate_v1
        WHERE definition_id=free_definition AND reviewed_card_version=2
          AND video_id=ANY(free_video_ids) AND link_status='healthy'
          AND review_status='candidate' AND embedding_allowed
          AND captions_available IS NULL AND exact_variant_match IS NULL
          AND demonstration_quality_score IS NULL
          AND reviewer_user_id IS NULL AND reviewed_at IS NULL)<>5
    OR (SELECT count(*) FROM coaching.exercise_media_candidate_v1
        WHERE definition_id=wall_definition AND reviewed_card_version=2
          AND video_id=ANY(wall_video_ids) AND link_status='healthy'
          AND review_status='candidate' AND embedding_allowed
          AND captions_available IS NULL AND exact_variant_match IS NULL
          AND demonstration_quality_score IS NULL
          AND reviewer_user_id IS NULL AND reviewed_at IS NULL)<>5
    OR EXISTS(SELECT 1 FROM (VALUES(free_definition),(wall_definition)) d(id)
      WHERE (SELECT count(*) FROM coaching.exercise_alternate_assessment_v1 a
        WHERE a.definition_id=d.id AND reviewed_card_version=2
          AND review_status='candidate' AND reviewer_user_id IS NULL)<>32) THEN
    RAISE EXCEPTION '% found incomplete profiles, evidence, media, or alternates',migration_key;
  END IF;
  IF (SELECT count(*) FROM coaching.exercise_relationship_v1
      WHERE from_variant_id=ANY(active_variant_ids)
        AND review_status='review' AND reviewed_by IS NULL)<>8
    OR (SELECT count(*) FROM coaching.exercise_score_calibration_v1
        WHERE variant_id=ANY(active_variant_ids) AND status='review'
          AND version=1 AND reviewed_by IS NULL)<>8
    OR (SELECT count(*) FROM coaching.exercise_identity_resolution_v1
        WHERE survivor_definition_id=free_definition
          AND resolved_definition_id=ANY(neighbor_definition_ids)
          AND decision='distinct_exercises' AND reviewed_by IS NULL)<>7 THEN
    RAISE EXCEPTION '% found incomplete graph, calibration, or identity boundaries',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 d
      CROSS JOIN LATERAL unnest(d.movement_patterns) key
      WHERE d.id=ANY(affected_definition_ids) AND NOT EXISTS(
        SELECT 1 FROM coaching.movement_pattern a WHERE a.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 d
      CROSS JOIN LATERAL unnest(d.body_regions) key
      WHERE d.id=ANY(affected_definition_ids) AND NOT EXISTS(
        SELECT 1 FROM coaching.body_region a WHERE a.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 d
      CROSS JOIN LATERAL unnest(d.required_equipment||d.optional_equipment) key
      WHERE d.id=ANY(affected_definition_ids) AND NOT EXISTS(
        SELECT 1 FROM coaching.equipment a WHERE a.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1 r
      WHERE r.from_variant_id=ANY(active_variant_ids)
        AND r.relationship IN('progression','regression')
        AND EXISTS(SELECT 1 FROM unnest(r.dimensions) dimension
          WHERE dimension<>ALL(ARRAY['load','leverage','range','speed','stability','complexity','impact','decision_demand','fatigue']))) THEN
    RAISE EXCEPTION '% created uncontrolled taxonomy or graph dimensions',migration_key;
  END IF;
  IF EXISTS(SELECT 1 FROM coaching.exercise
      WHERE id=ANY(source_ids) AND (skill_level IS NOT NULL OR age_min IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_safety_profile
      WHERE exercise_id=ANY(source_ids)
        AND (minimum_skill_level IS NOT NULL OR minimum_age_recommended IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=ANY(affected_definition_ids)
        AND coalesce(provenance_json->'researchSources','[]'::JSONB)::TEXT LIKE '%32707142%')
    OR EXISTS(SELECT 1 FROM coaching.exercise_identity_resolution_v1
      WHERE (survivor_definition_id=ANY(affected_definition_ids)
          OR resolved_definition_id=ANY(affected_definition_ids))
        AND coalesce(evidence_json->'researchSources','[]'::JSONB)::TEXT LIKE '%32707142%')
    OR EXISTS(SELECT 1 FROM coaching.exercise_section_evidence_v1
      WHERE definition_id=ANY(affected_definition_ids)
        AND reviewed_card_version=2 AND source_url LIKE '%32707142%')
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=ANY(affected_definition_ids)
        AND (reviewed_by IS NOT NULL OR approved_by IS NOT NULL
          OR last_reviewed_at IS NOT NULL OR approved_video_url IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_media_candidate_v1
      WHERE definition_id=ANY(affected_definition_ids) AND reviewed_card_version=2
        AND (review_status='approved' OR reviewer_user_id IS NOT NULL
          OR reviewed_at IS NOT NULL OR captions_available IS NOT NULL
          OR exact_variant_match IS NOT NULL
          OR demonstration_quality_score IS NOT NULL))
    OR (SELECT count(*) FROM coaching.exercise_card_test_packet_v1
        WHERE definition_id=ANY(affected_definition_ids) AND status='quarantined'
          AND human_review_required AND jsonb_array_length(blocking_issues_json)=4)<>2 THEN
    RAISE EXCEPTION '% retained invalid evidence or fabricated proficiency, approval, or publication state',migration_key;
  END IF;
END;
$$;
