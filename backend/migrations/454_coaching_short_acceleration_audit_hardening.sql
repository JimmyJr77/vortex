-- Align the completed Short Acceleration Sprint card with the independent
-- canonical-card auditor. This changes no identity, score, media decision,
-- graph review, calibration review, variant selectability, or approval.

DO $$
DECLARE
  migration_key CONSTANT TEXT := '454_coaching_short_acceleration_audit_hardening';
  completion_key CONSTANT TEXT := '420_coaching_short_acceleration_research_completion';
  canonical_id CONSTANT UUID := 'ac23941d-24df-4b6f-847d-5863e22afbc1';
  active_variant_ids UUID[];
BEGIN
  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_id
        AND provenance_json->>'shortAccelerationAuditHardeningMigration'=migration_key) THEN
    RETURN;
  END IF;

  IF NOT EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_id AND card_version=2 AND status='review'
        AND provenance_json->>'researchCompletionMigration'=completion_key)
    OR (SELECT count(*) FROM coaching.exercise_definition_source_v1
      WHERE definition_id=canonical_id)<>20 THEN
    RAISE EXCEPTION '% requires the completed 20-source version-2 card',migration_key;
  END IF;

  SELECT array_agg(id ORDER BY variant_key) INTO active_variant_ids
  FROM coaching.exercise_variant_v1
  WHERE definition_id=canonical_id AND status='review';
  IF cardinality(active_variant_ids)<>8 THEN
    RAISE EXCEPTION '% requires eight review variants',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_id AND (reviewed_by IS NOT NULL OR approved_by IS NOT NULL
        OR last_reviewed_at IS NOT NULL OR approved_video_url IS NOT NULL
        OR status='published'))
    OR EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1
      WHERE from_variant_id=ANY(active_variant_ids)
        AND (review_status<>'review' OR reviewed_by IS NOT NULL OR reviewed_at IS NOT NULL))
    OR EXISTS(SELECT 1 FROM coaching.exercise_score_calibration_v1
      WHERE variant_id=ANY(active_variant_ids) AND reviewed_by IS NOT NULL) THEN
    RAISE EXCEPTION '% refuses to overwrite human-reviewed or approved state',migration_key;
  END IF;

  UPDATE coaching.exercise_definition_v1 SET
    movement_patterns=ARRAY['locomote','project','brace'],
    body_regions=ARRAY['full_body','foot','ankle','calf','knee','hamstrings','glutes','hip','pelvis','core','spine','shoulder','elbow'],
    required_equipment=ARRAY['none'],
    optional_equipment=ARRAY['cones','timing_gates','mat_optional','coach_signal','whistle'],
    anatomy_json=anatomy_json||$json${
      "planes":["sagittal","frontal","transverse"],
      "laterality":"alternating",
      "lateralityDetail":{"startLead":"declared_and_balanced_when_start_is_asymmetrical","sprintCycle":"contralateral_alternation","sideDose":"recorded_per_declared_start_side"}
    }$json$::JSONB,
    athlete_support_json=athlete_support_json||$json${
      "whyItMatters":"Builds the ability to project the body forward and organize the first acceleration steps while keeping start, distance, effort, finish, and recovery measurable.",
      "primaryCue":"Own the exact start, project forward on the signal, accelerate through the marked distance, then decelerate in the assigned run-out lane.",
      "expectedSensations":["strong_whole_foot_and_lower_body_push","forward_projection","rapid_progressive_steps","coordinated_opposite_arm_and_leg_action"],
      "unexpectedSensations":["sharp_pain","giving_way","dizziness","neurologic_or_breathing_symptom","slip_or_collision_risk","uncontrolled_deceleration"],
      "painGuidance":"Stop and tell the coach immediately for pain, giving way, dizziness, neurologic or breathing symptoms, a slip, collision risk, or loss of deceleration control; do not sprint through symptoms.",
      "mediaAlternatives":["written_start_to_run_out_sequence","start_and_first_step_still_frames","lane_diagram","coach_demonstration_from_side_and_front_oblique"]
    }$json$::JSONB,
    coach_support_json=coach_support_json||$json${
      "observationChecklist":["exact_start_and_lead_side","stillness_or_cue_contract","first_projection_angle","first_three_step_direction_and_rhythm","arm_leg_coordination","marked_distance_and_effort","finish_and_run_out","full_recovery_and_lane_clearance"],
      "faultCorrections":{"wrong_start_or_early_motion":"Reset and restate the start and cue contract.","upright_or_reaching_first_step":"Reduce intent or distance and restore forward projection.","crossing_or_unstable_steps":"Reduce intent, widen the lane, and restore directional control.","finish_or_deceleration_loss":"Reduce exposure and lengthen the run-out before repeating."},
      "demonstrationPlan":["show_exact_start_and_lead_side","show_signal_projection_and_first_three_steps_from_side","show_lane_finish_and_controlled_run_out","contrast_early_motion_reaching_and_abrupt_stop_faults"],
      "modificationDecisionTree":["symptom_surface_or_lane_risk_stop","start_contract_failure_reset_or_use_simpler_standing_start","projection_or_step_control_loss_reduce_intent_or_distance","deceleration_loss_extend_run_out_or_substitute","identity_uncertainty_keep_provisional_variant_nonselectable"],
      "doNotUseWhen":["pain_or_neurologic_cardiopulmonary_symptom","unsafe_surface_weather_clearance_or_traffic","cannot_control_start_or_run_out","fatigue_changes_projection_or_step_quality","medical_restriction_not_cleared"]
    }$json$::JSONB,
    support_operations_json=support_operations_json||$json${
      "issueCategories":["identity_start_or_distance_mismatch","surface_lane_weather_or_equipment_problem","cue_timing_or_false_start","dose_duration_fatigue_or_recovery_mismatch","symptom_collision_or_deceleration_event","media_accessibility_rendering_or_persistence_issue"],
      "supportEscalation":{"immediate":["pain","neurologic_or_cardiopulmonary_symptom","fall_or_collision","unsafe_surface_or_lane","uncontrolled_deceleration"],"coachReview":["repeated_start_projection_or_step_fault","dose_or_recovery_conflict","substitution_request"],"contentReview":["identity_or_distance_confusion","provisional_variant_evidence","media_or_accessibility_gap"]},
      "retentionPolicy":{"store":["definition_id","variant_id","profile_key","start","lead_side","cue","distance","effort","valid_and_failed_attempts","time_or_split","all_contacts_if_counted","rest","faults","symptoms","duration","substitution","rendered_instructions"],"preserveHumanReviewHistory":true,"neverOverwriteApprovedReview":true},
      "changeImpactPolicy":{"onStartCueDistanceEffortDoseRestSurfaceLaneOrVariantChange":["revalidate_selection","recompute_fatigue_impact_and_recovery","recompute_duration","recheck_lane_traffic_and_equipment","rerender_coach_and_athlete_instructions","persist_new_validation"],"neverSilent":true}
    }$json$::JSONB,
    provenance_json=provenance_json||jsonb_build_object(
      'shortAccelerationAuditHardeningMigration',migration_key,
      'canonicalAuditContract','canonical-card-audit-v1',
      'humanReviewRequired',TRUE,'approvalsCreated',FALSE,
      'publicationQuarantined',TRUE),
    approved_video_url=NULL,reviewed_by=NULL,approved_by=NULL,
    last_reviewed_at=NULL,updated_at=now()
  WHERE id=canonical_id;

  UPDATE coaching.exercise_variant_v1 SET
    programming_profile_json=programming_profile_json||jsonb_build_object(
      'trainingStimuli',jsonb_build_array('short_acceleration','horizontal_projection','first_step_and_early_stride_output','start_specific_coordination'),
      'stimulusDose',jsonb_build_object('unit','quality_attempt','distance','profile_declared','effort','profile_declared','recovery','full_or_profile_declared','failedAttemptsCountTowardFatigue',TRUE),
      'weeklyExposure',jsonb_build_object('frequency','individualized_from_goal_training_load_speed_exposure_surface_symptoms_and_recovery','minimumRecoveryHours',24),
      'prerequisites',jsonb_build_array('exact_start_distance_cue_finish_and_run_out_declared','safe_surface_lane_weather_and_clearance','pain_free_build_up_and_deceleration','understands_stop_signal','readiness_and_prior_speed_load_reviewed'),
      'completionCriteria',jsonb_build_array('assigned_quality_attempts_completed','start_distance_effort_and_finish_contract_met','no_stop_rule_triggered','full_run_out_and_recovery_completed','actual_duration_faults_and_symptoms_recorded'),
      'sequenceRules',jsonb_build_array('after_specific_preparation','before_fatiguing_capacity_work','full_lane_and_recovery_between_attempts','stop_before_projection_step_or_finish_quality_changes'),
      'pairingCompatibility',jsonb_build_array('low_fatigue_upper_body_power','non_competing_mobility_or_breathing_during_full_rest'),
      'interferenceRules',jsonb_build_array('include_same_session_sprint_jump_and_deceleration_exposure','do_not_pre_fatigue_lower_body_before_priority_acceleration','do_not_turn_output_attempts_into_unbounded_conditioning','recompute_all_budgets_after_substitution'),
      'uncertaintyPolicy',jsonb_build_object('unknownStartDistanceCueSurfaceSymptomOrRecovery','fail_closed_and_request_coach_review','provisionalVariantsRemainNonselectable',TRUE,'neverAutoApproveMediaGraphCalibrationOrPublication',TRUE)),
    updated_at=now()
  WHERE id=ANY(active_variant_ids);

  UPDATE coaching.exercise_relationship_v1 SET
    dimensions=CASE
      WHEN dimensions@>ARRAY['cue_mode']::TEXT[] THEN ARRAY['decision_demand','complexity']
      ELSE ARRAY['stability','complexity'] END,
    conditions_json=conditions_json||jsonb_build_object(
      'authoredDetailDimensions',to_jsonb(dimensions),
      'canonicalDimensionHardeningMigration',migration_key),
    updated_at=now()
  WHERE from_variant_id=ANY(active_variant_ids)
    AND relationship IN('progression','regression');

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(definition.movement_patterns) key
      WHERE definition.id=canonical_id AND NOT EXISTS(
        SELECT 1 FROM coaching.movement_pattern allowed WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(definition.body_regions) key
      WHERE definition.id=canonical_id AND NOT EXISTS(
        SELECT 1 FROM coaching.body_region allowed WHERE allowed.key=key))
    OR EXISTS(SELECT 1 FROM coaching.exercise_definition_v1 definition
      CROSS JOIN LATERAL unnest(definition.required_equipment||definition.optional_equipment) key
      WHERE definition.id=canonical_id AND NOT EXISTS(
        SELECT 1 FROM coaching.equipment allowed WHERE allowed.key=key)) THEN
    RAISE EXCEPTION '% created uncontrolled taxonomy',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_id AND (
        anatomy_json->>'laterality'<>'alternating'
        OR athlete_support_json->>'whyItMatters' IS NULL
        OR athlete_support_json->'mediaAlternatives' IS NULL
        OR coach_support_json->'observationChecklist' IS NULL
        OR coach_support_json->'doNotUseWhen' IS NULL
        OR support_operations_json->'issueCategories' IS NULL
        OR support_operations_json->'changeImpactPolicy' IS NULL)) THEN
    RAISE EXCEPTION '% did not complete normalized anatomy and support',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_variant_v1
      WHERE id=ANY(active_variant_ids) AND (
        programming_profile_json->'trainingStimuli' IS NULL
        OR programming_profile_json->'stimulusDose' IS NULL
        OR programming_profile_json->'weeklyExposure' IS NULL
        OR programming_profile_json->'prerequisites' IS NULL
        OR programming_profile_json->'completionCriteria' IS NULL
        OR programming_profile_json->'sequenceRules' IS NULL
        OR programming_profile_json->'pairingCompatibility' IS NULL
        OR programming_profile_json->'interferenceRules' IS NULL
        OR programming_profile_json->'uncertaintyPolicy' IS NULL)) THEN
    RAISE EXCEPTION '% did not complete normalized programming',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_relationship_v1 relationship
      WHERE relationship.from_variant_id=ANY(active_variant_ids)
        AND relationship.relationship IN('progression','regression')
        AND EXISTS(SELECT 1 FROM unnest(relationship.dimensions) dimension
          WHERE dimension<>ALL(ARRAY['load','leverage','range','speed','stability','complexity','impact','decision_demand','fatigue']))) THEN
    RAISE EXCEPTION '% retained uncontrolled graph dimensions',migration_key;
  END IF;

  IF EXISTS(SELECT 1 FROM coaching.exercise_definition_v1
      WHERE id=canonical_id AND (approved_video_url IS NOT NULL
        OR reviewed_by IS NOT NULL OR approved_by IS NOT NULL
        OR last_reviewed_at IS NOT NULL
        OR provenance_json->>'approvalsCreated'<>'false'))
    OR EXISTS(SELECT 1 FROM coaching.exercise WHERE id IN(
        SELECT legacy_exercise_id FROM coaching.exercise_definition_source_v1
        WHERE definition_id=canonical_id) AND skill_level IS NOT NULL)
    OR EXISTS(SELECT 1 FROM coaching.exercise_safety_profile WHERE exercise_id IN(
        SELECT legacy_exercise_id FROM coaching.exercise_definition_source_v1
        WHERE definition_id=canonical_id) AND minimum_skill_level IS NOT NULL) THEN
    RAISE EXCEPTION '% created approval or exercise proficiency metadata',migration_key;
  END IF;
END $$;
