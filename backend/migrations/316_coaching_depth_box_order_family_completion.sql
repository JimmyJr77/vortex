-- Complete the candidate-only ordered box/depth sequence family after
-- migration 315 consolidates its exact semantic duplicates.
--
-- The two surviving identities remain intentionally distinct:
--   * Depth Drop to Box Jump:
--       drop box -> floor contact -> immediate jump -> target-box landing
--   * Box Jump to Depth Drop:
--       floor jump -> box landing/stabilization -> step off -> floor stick
--
-- Each card receives controlled taxonomy, exact anatomy and sequence data,
-- baseline and hands-on-hips variants, independently derived exercise
-- complexity and physical difficulty, complete load/fatigue/programming
-- contracts, context-specific delivery, coach/member/support operations,
-- review-only graph edges, and quarantined test packets.
--
-- No exercise-card skill level, human review, calibration approval, media
-- approval, relationship approval, or publication is created. IDEMPOTENT and
-- fail-closed.

DO $$
DECLARE
  migration_key TEXT := '316_coaching_depth_box_order_family_completion';
  facility BIGINT;
  depth_id UUID;
  box_depth_id UUID;
  target_ids UUID[];
  protected_records INTEGER;
  unexpected_variants INTEGER;
BEGIN
  SELECT id, facility_id
  INTO depth_id, facility
  FROM coaching.exercise_definition_v1
  WHERE slug = 'depth-drop-to-box-jump'
    AND status <> 'archived';

  SELECT id
  INTO box_depth_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id = facility
    AND slug = 'box-jump-to-depth-drop'
    AND status <> 'archived';

  IF depth_id IS NULL OR box_depth_id IS NULL THEN
    RAISE EXCEPTION
      'Depth/box ordered-sequence completion requires both active survivor definitions';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_definition_v1
    WHERE slug IN ('depth-jump-to-box-jump', 'box-jump-with-altitude-landing')
      AND status <> 'archived'
  ) THEN
    RAISE EXCEPTION
      'Depth/box ordered-sequence completion requires migration 315 duplicate consolidation first';
  END IF;

  target_ids := ARRAY[depth_id, box_depth_id];

  SELECT
    (
      SELECT COUNT(*)
      FROM coaching.exercise_definition_v1
      WHERE id = ANY(target_ids)
        AND (
          status = 'published'
          OR reviewed_by IS NOT NULL
          OR approved_by IS NOT NULL
          OR last_reviewed_at IS NOT NULL
        )
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_section_evidence_v1
      WHERE definition_id = ANY(target_ids)
        AND review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_media_candidate_v1
      WHERE definition_id = ANY(target_ids)
        AND review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id = ANY(target_ids)
        AND review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_card_review_v1
      WHERE definition_id = ANY(target_ids)
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_card_revision_v1
      WHERE definition_id = ANY(target_ids)
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_media_review_v1
      WHERE definition_id = ANY(target_ids)
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_variant_v1
      WHERE definition_id = ANY(target_ids)
        AND status = 'published'
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_delivery_profile_v1 profile
      JOIN coaching.exercise_variant_v1 variant
        ON variant.id = profile.variant_id
      WHERE variant.definition_id = ANY(target_ids)
        AND profile.status = 'published'
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_relationship_v1 relationship
      WHERE (
        relationship.from_variant_id IN (
          SELECT id
          FROM coaching.exercise_variant_v1
          WHERE definition_id = ANY(target_ids)
        )
        OR relationship.to_variant_id IN (
          SELECT id
          FROM coaching.exercise_variant_v1
          WHERE definition_id = ANY(target_ids)
        )
      )
        AND (
          relationship.review_status <> 'review'
          OR relationship.reviewed_by IS NOT NULL
          OR relationship.reviewed_at IS NOT NULL
        )
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_score_calibration_v1 calibration
      JOIN coaching.exercise_variant_v1 variant
        ON variant.id = calibration.variant_id
      WHERE variant.definition_id = ANY(target_ids)
        AND (
          calibration.status <> 'review'
          OR calibration.reviewed_by IS NOT NULL
          OR calibration.reviewed_at IS NOT NULL
        )
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_score_v1 score
      WHERE score.exercise_id IN (
        SELECT source.legacy_exercise_id
        FROM coaching.exercise_definition_source_v1 source
        WHERE source.definition_id = ANY(target_ids)
      )
        AND (
          score.human_review_status <> 'queued'
          OR score.reviewed_by IS NOT NULL
          OR score.reviewed_at IS NOT NULL
        )
    )
  INTO protected_records;

  IF protected_records > 0 THEN
    RAISE EXCEPTION
      'Depth/box ordered-sequence completion refused to override % protected records',
      protected_records;
  END IF;

  SELECT COUNT(*)
  INTO unexpected_variants
  FROM coaching.exercise_variant_v1
  WHERE definition_id = ANY(target_ids)
    AND status <> 'archived'
    AND variant_key NOT IN ('baseline', 'hands-on-hips');

  IF unexpected_variants > 0 THEN
    RAISE EXCEPTION
      'Depth/box ordered-sequence completion found % unexpected active variants',
      unexpected_variants;
  END IF;

  UPDATE coaching.exercise_definition_v1
  SET card_version = CASE
        WHEN provenance_json->>'structuralCompletionMigration' IS DISTINCT FROM migration_key
          THEN card_version + 1
        ELSE card_version
      END,
      description = CASE slug
        WHEN 'depth-drop-to-box-jump' THEN
          'Step from a declared drop box, make a bilateral floor contact, immediately jump onto a target box, land fully, stabilize, stand, step down, and reset. The first ground contact is reactive; the target-box landing is controlled.'
        ELSE
          'Jump bilaterally from the floor onto a box, land fully, stabilize and stand, deliberately step off, absorb a bilateral floor landing, hold the stick, and reset. The top stabilization separates the power task from the final landing task.'
      END,
      family_key = 'box_depth_ordered_sequence',
      movement_patterns = ARRAY['jump', 'land', 'brace']::TEXT[],
      body_regions = ARRAY[
        'foot', 'ankle', 'knee', 'hip', 'core', 'spine', 'shoulder'
      ]::TEXT[],
      required_equipment = ARRAY['box']::TEXT[],
      optional_equipment = ARRAY['mat', 'timer']::TEXT[],
      environment_json = CASE slug
        WHEN 'depth-drop-to-box-jump' THEN jsonb_build_object(
          'boxQuantity', 2,
          'dropBox', 'stable_non_slip_declared_height_with_clear_step_off_edge',
          'targetBox', 'stable_non_slip_declared_height_with_clear_top_and_front_edge',
          'spacing', 'declared_for_vertical_projection_without_forward_dive',
          'floorContactZone', 'level_clear_and_non_slip',
          'stepDownRoute', 'clear_and_demonstrated',
          'ceilingClearance', 'sufficient_for_maximum_declared_projection',
          'stationBoundary', 'one_way_no_cross_traffic',
          'coachSightline', 'initial_floor_contact_and_target_box_landing_visible'
        )
        ELSE jsonb_build_object(
          'boxQuantity', 1,
          'box', 'stable_non_slip_declared_height_with_clear_top_and_edges',
          'takeoffZone', 'level_clear_and_non_slip',
          'topStabilization', 'full_foot_space_and_no_obstruction',
          'floorLandingZone', 'level_clear_and_marked_when_helpful',
          'stepOffRoute', 'deliberate_and_demonstrated',
          'ceilingClearance', 'sufficient_for_declared_box_jump',
          'stationBoundary', 'one_way_no_cross_traffic',
          'coachSightline', 'box_landing_top_stabilization_step_off_and_floor_landing_visible'
        )
      END,
      population_json = jsonb_build_object(
        'readiness', CASE slug
          WHEN 'depth-drop-to-box-jump' THEN jsonb_build_array(
            'pain_free_bilateral_drop_landing',
            'pain_free_bilateral_box_jump',
            'repeatable_knee_to_toe_alignment',
            'true_step_off_without_upward_jump',
            'full_foot_target_box_landing',
            'controlled_step_down'
          )
          ELSE jsonb_build_array(
            'pain_free_bilateral_box_jump',
            'full_foot_box_landing_and_top_stabilization',
            'controlled_step_off_without_upward_jump',
            'pain_free_bilateral_floor_drop_landing',
            'repeatable_two_second_floor_stick',
            'controlled_reset'
          )
        END,
        'contraindicationFlags', jsonb_build_array(
          'current_foot_ankle_knee_hip_back_or_tendon_pain',
          'giving_way_dizziness_or_neurologic_symptoms',
          'uncontrolled_landing_asymmetry_or_fear',
          'unsafe_or_unstable_boxes_surface_clearance_or_station',
          'unassessed_recent_injury_surgery_or_rehabilitation_restriction'
        ),
        'supervision', 'direct_coach_observation_for_every_moving_athlete',
        'selectionBoundary',
          'Select height, variant, dose, and sequence from current landing and jumping readiness; never assign an exercise-card skill level.',
        'clinicalBoundary',
          'Symptoms, instability, recent surgery, neurologic signs, or rehabilitation restrictions require individualized clinician guidance; this card is not rehabilitation instruction.'
      ),
      anatomy_json = CASE slug
        WHEN 'depth-drop-to-box-jump' THEN jsonb_build_object(
          'primaryMuscles', jsonb_build_array(
            'quadriceps',
            'gluteus_maximus',
            'soleus',
            'gastrocnemius'
          ),
          'secondaryMuscles', jsonb_build_array(
            'hamstrings',
            'gluteus_medius',
            'hip_external_rotators',
            'intrinsic_foot',
            'tibialis_anterior',
            'trunk_stabilizers',
            'shoulder_flexors_when_arm_swing_is_permitted'
          ),
          'stabilizers', jsonb_build_array(
            'foot_and_ankle_stabilizers',
            'hip_abductors_and_external_rotators',
            'abdominal_wall',
            'spinal_stabilizers'
          ),
          'joints', jsonb_build_array(
            'foot',
            'ankle',
            'knee',
            'hip',
            'lumbopelvic_complex',
            'shoulder'
          ),
          'jointActions', jsonb_build_array(
            'ankle_knee_and_hip_flexion_on_initial_contact',
            'rapid_ankle_plantarflexion',
            'knee_extension',
            'hip_extension',
            'shoulder_flexion_when_arm_swing_is_permitted',
            'ankle_knee_and_hip_flexion_on_final_landing',
            'trunk_stabilization'
          ),
          'planes', jsonb_build_array('sagittal'),
          'laterality', 'bilateral',
          'orderedSequence', jsonb_build_array(
            'drop_box_step_off',
            'bilateral_floor_landing',
            'immediate_reactive_takeoff',
            'target_box_landing',
            'stabilize_and_stand',
            'step_down_and_reset'
          ),
          'landingContactsPerRep', 2
        )
        ELSE jsonb_build_object(
          'primaryMuscles', jsonb_build_array(
            'quadriceps',
            'gluteus_maximus',
            'soleus',
            'gastrocnemius'
          ),
          'secondaryMuscles', jsonb_build_array(
            'hamstrings',
            'gluteus_medius',
            'hip_external_rotators',
            'intrinsic_foot',
            'tibialis_anterior',
            'trunk_stabilizers',
            'shoulder_flexors_when_arm_swing_is_permitted'
          ),
          'stabilizers', jsonb_build_array(
            'foot_and_ankle_stabilizers',
            'hip_abductors_and_external_rotators',
            'abdominal_wall',
            'spinal_stabilizers'
          ),
          'joints', jsonb_build_array(
            'foot',
            'ankle',
            'knee',
            'hip',
            'lumbopelvic_complex',
            'shoulder'
          ),
          'jointActions', jsonb_build_array(
            'countermovement_ankle_knee_and_hip_flexion',
            'ankle_plantarflexion',
            'knee_extension',
            'hip_extension',
            'shoulder_flexion_when_arm_swing_is_permitted',
            'elevated_landing_flexion_control',
            'floor_landing_flexion_control',
            'trunk_stabilization'
          ),
          'planes', jsonb_build_array('sagittal'),
          'laterality', 'bilateral',
          'orderedSequence', jsonb_build_array(
            'floor_to_box_jump',
            'box_landing',
            'stabilize_and_stand',
            'controlled_step_off',
            'bilateral_floor_landing_and_stick',
            'reset'
          ),
          'landingContactsPerRep', 2
        )
      END,
      athlete_support_json = CASE slug
        WHEN 'depth-drop-to-box-jump' THEN jsonb_build_object(
          'whyItMatters',
            'This sequence trains a rapid landing-to-jump transition while the target box reduces the final landing drop when both box heights fit the athlete.',
          'primaryCue',
            'Step off, meet the floor together, rebound up to the box, land fully, own the top, then step down.',
          'expectedSensations', jsonb_build_array(
            'brief_firm_lower_leg_and_thigh_effort',
            'quick_ground_contact',
            'strong_vertical_projection',
            'controlled_target_box_landing'
          ),
          'unexpectedSensations', jsonb_build_array(
            'sharp_or_increasing_pain',
            'giving_way_or_instability',
            'dizziness_or_numbness',
            'toe_catch_or_partial_foot_contact',
            'uncontrolled_or_asymmetrical_landing',
            'fear_or_hesitation_that_changes_the_sequence'
          ),
          'painGuidance',
            'Stop immediately for pain, giving way, numbness, dizziness, or a missed or uncontrolled contact; leave the station and tell the coach.',
          'selfChecks', jsonb_build_array(
            'I_stepped_off_instead_of_jumping_from_the_first_box',
            'both_feet_met_the_floor_together',
            'I_rebounded_without_a_deliberate_pause',
            'both_feet_landed_fully_on_the_target_box',
            'I_stabilized_and_stepped_down'
          ),
          'accessibility', jsonb_build_object(
            'physical', jsonb_build_array(
              'lower_drop_box',
              'lower_or_wider_target_box',
              'separate_drop_landing_and_box_jump_tasks',
              'fewer_contacts',
              'longer_reset'
            ),
            'communication', jsonb_build_array(
              'plain_language_sequence',
              'slow_walk_through_before_live_attempt',
              'high_contrast_box_edges',
              'visible_floor_contact_and_target_marks',
              'agreed_stop_signal'
            ),
            'individualization',
              'Choose heights and dose from current contact quality and confidence, not an exercise-card level.'
          ),
          'mediaAlternatives', jsonb_build_array(
            'ordered_step_diagram',
            'start_contact_and_finish_still_images',
            'slow_live_demonstration',
            'captions_or_transcript_when_available',
            'coach_walk_through_without_live_jump'
          )
        )
        ELSE jsonb_build_object(
          'whyItMatters',
            'This sequence combines a controlled floor-to-box jump with a separate deliberate floor landing after the athlete stabilizes on the box.',
          'primaryCue',
            'Jump to the box, land fully, stand and settle, step off, land soft, freeze, then reset.',
          'expectedSensations', jsonb_build_array(
            'strong_floor_to_box_push',
            'controlled_box_landing',
            'balanced_top_position',
            'firm_but_controlled_floor_landing'
          ),
          'unexpectedSensations', jsonb_build_array(
            'sharp_or_increasing_pain',
            'giving_way_or_instability',
            'dizziness_or_numbness',
            'toe_catch_or_partial_foot_box_contact',
            'loss_of_balance_on_top',
            'uncontrolled_floor_landing_or_unplanned_rebound'
          ),
          'painGuidance',
            'Stop immediately for pain, giving way, numbness, dizziness, a missed box contact, loss of top balance, or an uncontrolled floor landing; tell the coach.',
          'selfChecks', jsonb_build_array(
            'both_feet_landed_fully_on_the_box',
            'I_stabilized_before_the_step_off',
            'I_stepped_instead_of_jumping_down',
            'both_feet_met_the_floor_together',
            'I_held_the_final_landing'
          ),
          'accessibility', jsonb_build_object(
            'physical', jsonb_build_array(
              'lower_or_wider_box',
              'separate_box_jump_and_drop_landing_tasks',
              'visual_floor_landing_marks',
              'fewer_contacts',
              'longer_reset'
            ),
            'communication', jsonb_build_array(
              'plain_language_sequence',
              'slow_walk_through_before_live_attempt',
              'high_contrast_box_edges',
              'visible_floor_landing_marks',
              'agreed_stop_signal'
            ),
            'individualization',
              'Choose height and dose from current box and floor landing quality, not an exercise-card level.'
          ),
          'mediaAlternatives', jsonb_build_array(
            'ordered_step_diagram',
            'start_box_and_floor_still_images',
            'slow_live_demonstration',
            'captions_or_transcript_when_available',
            'coach_walk_through_without_live_jump'
          )
        )
      END,
      coach_support_json = CASE slug
        WHEN 'depth-drop-to-box-jump' THEN jsonb_build_object(
          'observationChecklist', jsonb_build_array(
            'both_boxes_surface_spacing_and_clearance',
            'true_step_off_without_upward_jump',
            'bilateral_initial_contact',
            'declared_reactive_transition',
            'vertical_projection_and_front_edge_clearance',
            'full_foot_target_box_landing',
            'top_stabilization_and_step_down',
            'two_contacts_counted'
          ),
          'faultCorrections', jsonb_build_object(
            'jumps_from_drop_box', 'Rehearse a quiet step-off from a lower box.',
            'long_or_unstable_floor_contact', 'Lower the drop and separate prerequisite tasks.',
            'dives_forward_or_catches_edge', 'Lower or move the target and restore vertical projection.',
            'partial_foot_target_landing', 'Stop; lower the target box before another attempt.',
            'landing_collapse', 'Stop the set and regress to a single controlled landing task.',
            'jumps_down_to_reset', 'Require a demonstrated step-down route.'
          ),
          'demonstrationPlan', jsonb_build_array(
            'name_and_point_to_drop_box_floor_contact_zone_and_target_box',
            'walk_through_the_order_without_live_jump',
            'show_one_front_and_one_side_repetition',
            'contrast_true_step_off_with_upward_jump_error',
            'have_athlete_teach_back_contacts_and_stop_signal'
          ),
          'groupManagement', jsonb_build_object(
            'stationCapacity', 1,
            'boxQuantityPerStation', 2,
            'coachPosition', 'initial_floor_contact_and_target_box_landing_visible',
            'queueRule', 'next_athlete_waits_outside_station_until_step_down',
            'resetRule', 'coach_rechecks_boxes_and_lane_after_any_contact_or_shift'
          ),
          'modificationDecisionTree', jsonb_build_array(
            'If_box_or_lane_is_unstable_then_close_station.',
            'If_drop_landing_is_not_repeatable_then_use_drop_landing_only.',
            'If_reactive_transition_is_not_repeatable_then_use_a_lower_drop_or_separate_tasks.',
            'If_target_box_contact_is_not_full_foot_then_lower_or_widen_the_target.',
            'If_any_symptom_or_fear_changes_the_sequence_then_stop_and_choose_a_nonreactive_substitute.'
          ),
          'doNotUseWhen', jsonb_build_array(
            'pain_giving_way_dizziness_numbness_or_unassessed_restriction',
            'drop_landing_or_box_jump_prerequisite_not_owned',
            'boxes_surface_spacing_clearance_or_step_down_are_unsafe',
            'direct_supervision_is_unavailable',
            'athlete_is_too_fatigued_to_repeat_contact_quality'
          )
        )
        ELSE jsonb_build_object(
          'observationChecklist', jsonb_build_array(
            'box_surface_height_clearance_and_floor_zone',
            'floor_to_box_takeoff',
            'full_foot_box_landing',
            'top_stabilization_before_step_off',
            'true_step_off_without_upward_jump',
            'bilateral_floor_contact_and_absorption',
            'two_second_final_stick',
            'two_contacts_counted'
          ),
          'faultCorrections', jsonb_build_object(
            'toe_catch_or_partial_foot_box_landing', 'Stop; lower the box before another attempt.',
            'does_not_stabilize_on_top', 'Split the sequence into separate box-jump and drop-landing tasks.',
            'jumps_down_from_box', 'Rehearse a controlled step-off from a lower box.',
            'floor_landing_collapse', 'Lower the box or use a drop landing only.',
            'unplanned_rebound', 'Reduce height and require a visible two-second stick.',
            'sequence_confusion', 'Walk through and teach back the ordered contacts.'
          ),
          'demonstrationPlan', jsonb_build_array(
            'name_and_point_to_takeoff_box_top_step_off_edge_and_floor_zone',
            'walk_through_the_order_without_live_jump',
            'show_one_front_and_one_side_repetition',
            'contrast_stabilized_step_off_with_jump_down_error',
            'have_athlete_teach_back_contacts_and_stop_signal'
          ),
          'groupManagement', jsonb_build_object(
            'stationCapacity', 1,
            'boxQuantityPerStation', 1,
            'coachPosition', 'box_landing_top_stabilization_step_off_and_floor_landing_visible',
            'queueRule', 'next_athlete_waits_outside_station_until_final_reset',
            'resetRule', 'coach_rechecks_box_and_floor_zone_after_any_contact_or_shift'
          ),
          'modificationDecisionTree', jsonb_build_array(
            'If_box_or_floor_zone_is_unstable_then_close_station.',
            'If_box_landing_is_not_full_foot_then_lower_the_box.',
            'If_top_stabilization_is_not_repeatable_then_prescribe_box_jump_only.',
            'If_floor_landing_is_not_repeatable_then_use_a_lower_drop_landing_only.',
            'If_any_symptom_or_fear_changes_the_sequence_then_stop_and_choose_a_single_task_substitute.'
          ),
          'doNotUseWhen', jsonb_build_array(
            'pain_giving_way_dizziness_numbness_or_unassessed_restriction',
            'box_jump_or_drop_landing_prerequisite_not_owned',
            'box_surface_clearance_or_floor_zone_is_unsafe',
            'direct_supervision_is_unavailable',
            'athlete_is_too_fatigued_to_repeat_both_landings'
          )
        )
      END,
      support_operations_json = jsonb_build_object(
        'issueCategories', jsonb_build_array(
          'identity_or_sequence_mismatch',
          'difficulty_or_dose_dispute',
          'equipment_or_station_hazard',
          'pain_or_adverse_response',
          'media_mismatch_or_accessibility',
          'relationship_or_substitution_error',
          'data_or_version_integrity'
        ),
        'supportEscalation', jsonb_build_object(
          'immediate', jsonb_build_array(
            'stop_and_close_unsafe_station',
            'record_symptom_or_missed_contact_without_diagnosing',
            'notify_responsible_coach_or_owner'
          ),
          'content', 'Route identity, sequence, score, alternate, and media disputes to canonical library review.',
          'clinical', 'Route symptoms or rehabilitation questions to the athlete''s qualified clinician.'
        ),
        'retentionPolicy', jsonb_build_object(
          'cardVersion', 'immutable_review_binding',
          'workoutOutput', 'retain_definition_variant_profile_and_rule_versions',
          'feedback', 'retain_minimum_necessary_structured_reason_without_diagnostic_inference',
          'media', 'retain_candidate_and_review_history_with_supersession'
        ),
        'changeImpactPolicy', jsonb_build_object(
          'identity', 're_audit_aliases_source_mappings_variants_graph_and_saved_workouts',
          'difficulty', 'recalibrate_and_revalidate_selection_fatigue_and_impact_budgets',
          'dosage', 'revalidate_duration_contacts_recovery_and_group_logistics',
          'media', 'invalidate_stale_exact_match_review_for_changed_card_version',
          'instructions', 'rerun_coach_and_athlete_comprehension_review'
        )
      ),
      content_confidence = 82,
      scoring_confidence = 68,
      media_confidence = 35,
      approved_video_url = NULL,
      status = 'review',
      reviewed_by = NULL,
      approved_by = NULL,
      last_reviewed_at = NULL,
      provenance_json = provenance_json || jsonb_build_object(
        'structuralCompletionMigration', migration_key,
        'researchBatch', 'depth-box-order-sequences-v1',
        'researchVersion', '2026-07-26.31',
        'identityMigration', '315_coaching_depth_box_order_identity_consolidation',
        'difficultyModel', 'max_exercise_complexity_physical_difficulty',
        'exerciseCardSkillLevel', 'not_applicable',
        'formalProficiencyClassification', 'skill_library_only',
        'candidateOnly', TRUE,
        'humanReviewRequired', TRUE,
        'publicationQuarantined', TRUE,
        'externalMediaApprovalClaimed', FALSE
      ),
      updated_at = now()
  WHERE id = ANY(target_ids);

  -- Candidate-only records can follow the revised card version. The guard
  -- above prohibits moving any human-reviewed state.
  UPDATE coaching.exercise_section_evidence_v1 evidence
  SET reviewed_card_version = definition.card_version,
      updated_at = now()
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.id = ANY(target_ids)
    AND evidence.definition_id = definition.id
    AND evidence.review_status = 'candidate'
    AND evidence.reviewed_card_version <> definition.card_version;

  UPDATE coaching.exercise_media_candidate_v1 media
  SET reviewed_card_version = definition.card_version,
      updated_at = now()
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.id = ANY(target_ids)
    AND media.definition_id = definition.id
    AND media.review_status = 'candidate'
    AND media.reviewed_card_version <> definition.card_version;

  UPDATE coaching.exercise_alternate_assessment_v1 alternate
  SET reviewed_card_version = definition.card_version,
      updated_at = now()
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.id = ANY(target_ids)
    AND alternate.definition_id = definition.id
    AND alternate.review_status = 'candidate'
    AND alternate.reviewed_card_version <> definition.card_version;

  CREATE TEMP TABLE depth_box_variant_seed (
    definition_slug TEXT NOT NULL,
    variant_key TEXT NOT NULL,
    display_name TEXT NOT NULL,
    modifier_keys TEXT[] NOT NULL,
    arm_use TEXT NOT NULL,
    technical_complexity INTEGER NOT NULL,
    physical_difficulty INTEGER NOT NULL,
    coordination_demand INTEGER NOT NULL,
    supervision_demand INTEGER NOT NULL,
    failure_consequence INTEGER NOT NULL,
    impact INTEGER NOT NULL,
    work_capacity_demand INTEGER NOT NULL,
    overall_difficulty INTEGER NOT NULL,
    eccentric_stress INTEGER NOT NULL,
    technical_fatigue_sensitivity INTEGER NOT NULL,
    impact_accumulation INTEGER NOT NULL,
    recovery_hours INTEGER NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO depth_box_variant_seed VALUES
    (
      'depth-drop-to-box-jump',
      'baseline',
      'Depth Drop to Box Jump',
      ARRAY['natural_arm_swing']::TEXT[],
      'natural_arm_swing',
      64, 58, 70, 72, 76, 64, 28, 64, 74, 86, 72, 48
    ),
    (
      'depth-drop-to-box-jump',
      'hands-on-hips',
      'Hands-on-Hips Depth Drop to Box Jump',
      ARRAY['hands_on_hips', 'arm_restricted']::TEXT[],
      'hands_on_hips',
      68, 58, 74, 72, 76, 64, 28, 68, 74, 88, 72, 48
    ),
    (
      'box-jump-to-depth-drop',
      'baseline',
      'Box Jump to Depth Drop',
      ARRAY['natural_arm_swing']::TEXT[],
      'natural_arm_swing',
      58, 54, 62, 68, 72, 60, 30, 58, 68, 80, 68, 36
    ),
    (
      'box-jump-to-depth-drop',
      'hands-on-hips',
      'Hands-on-Hips Box Jump to Depth Drop',
      ARRAY['hands_on_hips', 'arm_restricted']::TEXT[],
      'hands_on_hips',
      62, 54, 66, 68, 72, 60, 30, 62, 68, 82, 68, 36
    );

  INSERT INTO coaching.exercise_variant_v1 (
    definition_id,
    variant_key,
    display_name,
    modifier_keys,
    difficulty_json,
    requirements_json,
    load_profile_json,
    fatigue_profile_json,
    programming_profile_json,
    status
  )
  SELECT
    definition.id,
    seed.variant_key,
    seed.display_name,
    seed.modifier_keys,
    jsonb_build_object(
      'technicalComplexity', seed.technical_complexity,
      'absoluteLoadDemand', seed.physical_difficulty,
      'coordinationDemand', seed.coordination_demand,
      'supervisionDemand', seed.supervision_demand,
      'failureConsequence', seed.failure_consequence,
      'impact', seed.impact,
      'workCapacityDemand', seed.work_capacity_demand,
      'baseOverallDifficulty', seed.overall_difficulty,
      'overallFormula', 'max_exercise_complexity_physical_difficulty'
    ),
    jsonb_build_object(
      'orderedSequence', CASE definition.slug
        WHEN 'depth-drop-to-box-jump' THEN jsonb_build_array(
          'drop_box_step_off',
          'bilateral_floor_contact',
          'immediate_reactive_takeoff',
          'target_box_landing',
          'stabilize_and_stand',
          'step_down_and_reset'
        )
        ELSE jsonb_build_array(
          'floor_to_box_jump',
          'box_landing',
          'stabilize_and_stand',
          'controlled_step_off',
          'bilateral_floor_landing_and_stick',
          'reset'
        )
      END,
      'armUse', seed.arm_use,
      'laterality', 'bilateral',
      'externalLoad', 'bodyweight',
      'landingContactsPerRep', 2,
      'boxQuantity', CASE definition.slug
        WHEN 'depth-drop-to-box-jump' THEN 2
        ELSE 1
      END,
      'heightRule',
        'Use only heights that preserve every declared contact, full-foot box landing, alignment, confidence, and safe step-off.',
      'selectable', TRUE,
      'identityQuarantine', FALSE
    ),
    jsonb_build_object(
      'gripDemand', 1,
      'spinalLoading', 24,
      'eccentricStress', seed.eccentric_stress,
      'landingContactsPerRep', 2,
      'externalLoadMethod', 'bodyweight',
      'loadingType', CASE definition.slug
        WHEN 'depth-drop-to-box-jump'
          THEN 'bodyweight_bilateral_reactive_plyometric_with_two_landings'
        ELSE 'bodyweight_bilateral_box_jump_plus_deliberate_drop_landing'
      END,
      'impactClass', CASE definition.slug
        WHEN 'depth-drop-to-box-jump' THEN 'high_and_height_dependent'
        ELSE 'moderate_to_high_and_height_dependent'
      END,
      'primaryStress', CASE definition.slug
        WHEN 'depth-drop-to-box-jump' THEN jsonb_build_array(
          'initial_drop_landing_eccentric_load',
          'rapid_stretch_shortening_transition',
          'vertical_propulsive_impulse',
          'target_box_landing_control'
        )
        ELSE jsonb_build_array(
          'floor_to_box_propulsive_impulse',
          'elevated_landing_control',
          'post_stabilization_drop_landing_eccentric_load',
          'final_floor_stick'
        )
      END
    ),
    jsonb_build_object(
      'localMuscleFatigue', CASE definition.slug
        WHEN 'depth-drop-to-box-jump' THEN 62
        ELSE 56
      END,
      'gripFatigue', 1,
      'technicalFatigueSensitivity', seed.technical_fatigue_sensitivity,
      'impactAccumulation', seed.impact_accumulation,
      'recoveryHours', seed.recovery_hours,
      'fatigueSignals', CASE definition.slug
        WHEN 'depth-drop-to-box-jump' THEN jsonb_build_array(
          'longer_or_unstable_floor_contact',
          'lower_or_forward_projection',
          'toe_catch_or_partial_foot_contact',
          'loud_or_asymmetrical_landings',
          'hesitation_or_sequence_loss',
          'unsafe_step_down'
        )
        ELSE jsonb_build_array(
          'toe_catch_or_partial_foot_box_landing',
          'loss_of_top_stabilization',
          'jumping_instead_of_stepping_off',
          'loud_or_asymmetrical_floor_landing',
          'unplanned_rebound',
          'unsafe_reset'
        )
      END,
      'cumulativeBudgets', jsonb_build_array(
        'impact_contacts',
        'eccentric_stress',
        'lower_leg_and_tendon_load',
        'technical_sensitivity',
        'high_intent_jump_and_landing_exposures'
      )
    ),
    jsonb_build_object(
      'trainingStimuli', CASE definition.slug
        WHEN 'depth-drop-to-box-jump' THEN jsonb_build_array(
          'reactive_strength',
          'rapid_eccentric_to_concentric_transition',
          'vertical_projection',
          'target_box_landing_control'
        )
        ELSE jsonb_build_array(
          'floor_to_box_power',
          'elevated_landing_control',
          'deliberate_drop_landing',
          'terminal_stick_control'
        )
      END,
      'stimulusDose', jsonb_build_object(
        'sets', '2-4',
        'repetitions', '2-4',
        'contactsPerRep', 2,
        'contactsPerSet', '4-8',
        'interRepetitionResetSeconds', '10-20',
        'interSetRestSeconds', CASE definition.slug
          WHEN 'depth-drop-to-box-jump' THEN '120-240'
          ELSE '90-180'
        END
      ),
      'weeklyExposure',
        'Count both contacts with all weekly sprint, jump, landing, heavy lower-body, and tendon-loading exposures.',
      'prerequisites', CASE definition.slug
        WHEN 'depth-drop-to-box-jump' THEN jsonb_build_array(
          'repeatable_bilateral_drop_landing',
          'repeatable_bilateral_box_jump',
          'true_step_off',
          'reactive_ground_contact_at_selected_height',
          'full_foot_target_box_landing',
          'safe_step_down'
        )
        ELSE jsonb_build_array(
          'repeatable_bilateral_box_jump',
          'full_foot_box_landing_and_top_stabilization',
          'true_step_off',
          'repeatable_bilateral_floor_drop_landing',
          'two_second_final_stick'
        )
      END,
      'completionCriteria', CASE definition.slug
        WHEN 'depth-drop-to-box-jump' THEN jsonb_build_array(
          'declared_sequence_is_unchanged',
          'initial_contact_is_bilateral_and_organized',
          'reactive_transition_remains_prompt',
          'target_box_contact_is_full_foot',
          'top_is_stable_and_step_down_is_controlled'
        )
        ELSE jsonb_build_array(
          'declared_sequence_is_unchanged',
          'box_contact_is_bilateral_and_full_foot',
          'top_is_stable_before_step_off',
          'step_off_has_no_upward_jump',
          'floor_landing_is_bilateral_and_held'
        )
      END,
      'sequenceRules', CASE definition.slug
        WHEN 'depth-drop-to-box-jump' THEN jsonb_build_array(
          'after_readiness_and_before_fatigue',
          'drop_landing_and_box_jump_prerequisites_first',
          'never_after_high_fatigue_conditioning',
          'full_reset_between_repetitions'
        )
        ELSE jsonb_build_array(
          'after_readiness_and_before_material_landing_fatigue',
          'box_jump_and_drop_landing_prerequisites_first',
          'stabilize_on_box_before_step_off',
          'full_reset_between_repetitions'
        )
      END,
      'pairingCompatibility', jsonb_build_object(
        'compatible', jsonb_build_array(
          'low_fatigue_readiness_work',
          'noncompeting_upper_body_strength_afterward',
          'low_arousal_restore_later'
        ),
        'conditional', jsonb_build_array(
          'sprinting',
          'heavy_lower_body_strength',
          'other_plyometrics'
        )
      ),
      'interferenceRules', jsonb_build_array(
        'do_not_pair_with_high_density_lower_body_fatigue',
        'do_not_place_before_higher_consequence_technical_work_when_fatigue_carries_over',
        'do_not_ignore_both_landing_contacts_in_impact_budget',
        'do_not_progress_height_when_quality_or_confidence_worsens'
      ),
      'uncertaintyPolicy',
        'If sequence, height, surface, readiness, dose, or fatigue evidence is unclear, use the lower-height single-task regression and keep this variant quarantined from selection.'
    ),
    'review'
  FROM coaching.exercise_definition_v1 definition
  JOIN depth_box_variant_seed seed
    ON seed.definition_slug = definition.slug
  WHERE definition.id = ANY(target_ids)
  ON CONFLICT (definition_id, variant_key) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    modifier_keys = EXCLUDED.modifier_keys,
    difficulty_json = EXCLUDED.difficulty_json,
    requirements_json = EXCLUDED.requirements_json,
    load_profile_json = EXCLUDED.load_profile_json,
    fatigue_profile_json = EXCLUDED.fatigue_profile_json,
    programming_profile_json = EXCLUDED.programming_profile_json,
    status = 'review',
    updated_at = now();

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET status = 'archived',
      updated_at = now()
  FROM coaching.exercise_variant_v1 variant
  WHERE variant.id = profile.variant_id
    AND variant.definition_id = ANY(target_ids)
    AND variant.status <> 'archived'
    AND profile.profile_key NOT IN (
      'reactive-output',
      'power-landing-control',
      'low-height-sequence-acquisition'
    );

  CREATE TEMP TABLE depth_box_profile_seed (
    definition_slug TEXT NOT NULL,
    profile_key TEXT NOT NULL,
    phase_key TEXT NOT NULL,
    role TEXT NOT NULL,
    purpose TEXT NOT NULL,
    phase_suitability INTEGER NOT NULL,
    methodology_alignment INTEGER NOT NULL,
    effort TEXT NOT NULL,
    sets_text TEXT NOT NULL,
    reps_text TEXT NOT NULL,
    rest_text TEXT NOT NULL,
    drop_or_box_rule TEXT NOT NULL,
    quality_gate TEXT NOT NULL,
    coach_instructions TEXT NOT NULL,
    athlete_instructions TEXT NOT NULL,
    expected_adaptation TEXT NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO depth_box_profile_seed VALUES
    (
      'depth-drop-to-box-jump',
      'reactive-output',
      'output',
      'primary',
      'Train a fast, organized drop-landing-to-jump transition and vertical projection while the target box reduces the final landing drop.',
      92,
      90,
      'high_intent_with_repeatable_contact_and_landing_quality',
      '2-4',
      '2-4',
      '120-240',
      'Use the lowest drop and target heights that preserve a true step-off, prompt contact, vertical projection, and full-foot target landing.',
      'Every repetition keeps the exact two-box order, bilateral initial contact, prompt rebound, full-foot target landing, stable top, and safe step-down.',
      'See both contacts. Stop on hesitation, contact-time rise, forward dive, edge catch, partial-foot landing, collapse, pain, or box movement.',
      'Step off, meet the floor together, rebound up to the box, land fully, own the top, then step down.',
      'Improved repeatability of a reactive bilateral contact followed by controlled elevated landing under low-volume, high-quality conditions.'
    ),
    (
      'depth-drop-to-box-jump',
      'low-height-sequence-acquisition',
      'movement_intelligence',
      'conditional',
      'Teach the ordered step-off, contact, target, stabilization, and exit at deliberately low heights before high-intent use.',
      72,
      76,
      'submaximal_sequence_learning',
      '2-3',
      '2-3',
      '90-150',
      'Use very low stable boxes; regress to separate drop landing and box jump when the athlete cannot preserve order and contact quality.',
      'The athlete can name and execute both contacts, target-box landing, stabilization, and step-down without rush, fear, or external correction.',
      'Walk through first, use one cue, and keep heights low. Stop if the athlete confuses the order or any contact becomes unsafe.',
      'Step, land, jump to the box, freeze, stand, step down.',
      'Accurate sequence recognition and controlled execution at low height without claiming reactive-performance adaptation.'
    ),
    (
      'box-jump-to-depth-drop',
      'power-landing-control',
      'resilience',
      'primary',
      'Combine a controlled floor-to-box jump with a separate deliberate post-stabilization floor landing and held stick.',
      88,
      84,
      'submaximal_to_high_jump_with_deliberate_final_landing',
      '2-4',
      '2-4',
      '90-180',
      'Use one box height that permits a full-foot top landing, stable stand, controlled step-off, and repeatable floor stick.',
      'Every repetition has a full-foot box landing, visible top stabilization, true step-off, bilateral quiet floor contact, two-second stick, and complete reset.',
      'See box and floor contacts. Stop on edge catch, partial foot, top instability, jump-down, asymmetry, collapse, rebound, pain, or box movement.',
      'Jump to the box, land fully, stand and settle, step off, land soft, freeze, then reset.',
      'Improved integration of box-jump control and deliberate floor-landing absorption without converting the sequence into continuous rebound work.'
    ),
    (
      'box-jump-to-depth-drop',
      'low-height-sequence-acquisition',
      'movement_intelligence',
      'conditional',
      'Teach the floor-to-box-to-floor order, top stabilization, step-off, and final stick at a deliberately low height.',
      78,
      80,
      'submaximal_sequence_learning',
      '2-3',
      '2-3',
      '75-120',
      'Use a very low stable box; split the box jump and drop landing when either contact or the top transition is not repeatable.',
      'The athlete identifies and executes the box landing, top pause, step-off, floor landing, two-second stick, and reset without rushing.',
      'Walk through first, make the top pause visible, and use one cue. Stop on order confusion or any unsafe contact.',
      'Jump up, settle, step off, land soft, freeze.',
      'Accurate compound-sequence execution and landing-control awareness at low height.'
    );

  INSERT INTO coaching.exercise_delivery_profile_v1 (
    variant_id,
    profile_key,
    phase_key,
    role,
    purpose,
    phase_suitability,
    methodology_alignment,
    objective_relevance_json,
    dosage_json,
    quality_gate,
    stop_rules,
    coach_instructions,
    athlete_instructions,
    expected_adaptation,
    equipment_required,
    logistics_json,
    substitution_ids,
    time_model_json,
    dose_scaling_json,
    measurement_json,
    support_prompts_json,
    status
  )
  SELECT
    variant.id,
    profile.profile_key,
    profile.phase_key,
    profile.role,
    profile.purpose,
    profile.phase_suitability,
    profile.methodology_alignment,
    jsonb_build_object(
      'reactiveStrength', CASE definition.slug
        WHEN 'depth-drop-to-box-jump' THEN 94
        ELSE 52
      END,
      'verticalPower', CASE definition.slug
        WHEN 'depth-drop-to-box-jump' THEN 88
        ELSE 76
      END,
      'landingControl', CASE definition.slug
        WHEN 'depth-drop-to-box-jump' THEN 76
        ELSE 92
      END,
      'sequenceLearning', CASE profile.profile_key
        WHEN 'low-height-sequence-acquisition' THEN 94
        ELSE 66
      END,
      'conditioning', 8
    ),
    jsonb_build_object(
      'sets', profile.sets_text,
      'repetitions', profile.reps_text,
      'contactsPerRep', 2,
      'contactsPerSet', '4-8',
      'effort', profile.effort,
      'interRepetitionResetSeconds', '10-20',
      'interSetRestSeconds', profile.rest_text,
      'heightRule', profile.drop_or_box_rule,
      'armUse', variant.requirements_json->>'armUse',
      'termination',
        'Stop on the first symptom, equipment issue, missed or unsafe contact, sequence loss, or material quality decline.'
    ),
    profile.quality_gate,
    CASE definition.slug
      WHEN 'depth-drop-to-box-jump' THEN ARRAY[
        'pain_giving_way_dizziness_or_numbness',
        'unstable_or_shifted_box_or_unsafe_lane',
        'upward_jump_from_drop_box',
        'missed_asymmetrical_or_uncontrolled_initial_contact',
        'hesitation_or_material_contact_time_increase',
        'forward_dive_edge_catch_or_partial_foot_target_landing',
        'landing_collapse_or_unsafe_step_down'
      ]::TEXT[]
      ELSE ARRAY[
        'pain_giving_way_dizziness_or_numbness',
        'unstable_or_shifted_box_or_unsafe_floor_zone',
        'toe_catch_or_partial_foot_box_landing',
        'failure_to_stabilize_on_top',
        'jumping_instead_of_stepping_off',
        'asymmetrical_loud_or_collapsed_floor_landing',
        'unplanned_rebound_or_sequence_loss'
      ]::TEXT[]
    END,
    profile.coach_instructions,
    profile.athlete_instructions,
    profile.expected_adaptation,
    ARRAY['box']::TEXT[],
    jsonb_build_object(
      'stationCapacity', 1,
      'boxQuantity', CASE definition.slug
        WHEN 'depth-drop-to-box-jump' THEN 2
        ELSE 1
      END,
      'athletesPerCoach', 1,
      'queueRule', 'one_athlete_in_station_next_athlete_waits_outside',
      'setupSeconds', CASE definition.slug
        WHEN 'depth-drop-to-box-jump' THEN 120
        ELSE 90
      END,
      'resetSecondsPerRep', 15,
      'traffic', 'one_way_no_cross_traffic',
      'safetyCheck', 'boxes_surface_clearance_landing_zone_and_exit_checked_before_each_group'
    ),
    '{}'::UUID[],
    jsonb_build_object(
      'setupSeconds', CASE definition.slug
        WHEN 'depth-drop-to-box-jump' THEN 120
        ELSE 90
      END,
      'demonstrationSeconds', 45,
      'secondsPerRep', CASE definition.slug
        WHEN 'depth-drop-to-box-jump' THEN 8
        ELSE 12
      END,
      'resetSecondsPerRep', 15,
      'restSecondsBetweenSets', profile.rest_text,
      'estimatedBlockMinutes', '6-12'
    ),
    jsonb_build_object(
      'regressions', CASE definition.slug
        WHEN 'depth-drop-to-box-jump' THEN jsonb_build_array(
          'lower_drop_box',
          'lower_or_wider_target_box',
          'drop_landing_only',
          'box_jump_only',
          'separate_paused_tasks',
          'fewer_contacts_and_longer_rest'
        )
        ELSE jsonb_build_array(
          'lower_or_wider_box',
          'box_jump_only',
          'low_drop_landing_only',
          'visual_floor_target',
          'fewer_contacts_and_longer_rest'
        )
      END,
      'progressionRules', CASE definition.slug
        WHEN 'depth-drop-to-box-jump' THEN jsonb_build_array(
          'progress_only_after_repeatable_initial_contact_and_target_landing',
          'change_one_height_or_arm_constraint_at_a_time',
          'do_not_trade_contact_quality_for_box_height'
        )
        ELSE jsonb_build_array(
          'progress_only_after_repeatable_box_landing_top_stabilization_and_floor_stick',
          'change_one_height_or_arm_constraint_at_a_time',
          'do_not_trade_landing_quality_for_box_height'
        )
      END,
      'cohortRule',
        'Use current readiness, anatomy, symptoms, confidence, supervision, and quality; no exercise-card skill level applies.'
    ),
    jsonb_build_object(
      'primary', CASE definition.slug
        WHEN 'depth-drop-to-box-jump' THEN 'ordered_sequence_success'
        ELSE 'ordered_sequence_and_final_stick_success'
      END,
      'secondary', jsonb_build_array(
        'both_contacts_completed',
        'full_foot_box_landing',
        'alignment_and_trunk_control',
        'declared_transition_behavior',
        'safe_reset'
      ),
      'record', jsonb_build_array(
        'drop_and_or_box_height',
        'variant_key',
        'repetitions_completed',
        'landing_contacts',
        'quality_stop_reason',
        'pain_or_symptom_flag'
      ),
      'doNotInfer', jsonb_build_array(
        'higher_box_equals_higher_jump',
        'absence_of_reported_pain_equals_clinical_clearance',
        'oembed_success_equals_media_approval'
      )
    ),
    jsonb_build_object(
      'before',
        'Confirm the athlete can name the ordered contacts, point to the landing zones, and show the stop signal.',
      'during',
        'Use one primary cue and stop the station on any symptom, equipment movement, miss, or order loss.',
      'after',
        'Log both contacts, exact variant, heights, completion quality, and any stop reason.',
      'accessibility',
        'Offer a walk-through, still images, high-contrast edges or marks, lower height, separate tasks, and captions or transcript.'
    ),
    'review'
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id = definition.id
   AND variant.status <> 'archived'
  JOIN depth_box_profile_seed profile
    ON profile.definition_slug = definition.slug
  WHERE definition.id = ANY(target_ids)
  ON CONFLICT (variant_id, profile_key) DO UPDATE SET
    phase_key = EXCLUDED.phase_key,
    role = EXCLUDED.role,
    purpose = EXCLUDED.purpose,
    phase_suitability = EXCLUDED.phase_suitability,
    methodology_alignment = EXCLUDED.methodology_alignment,
    objective_relevance_json = EXCLUDED.objective_relevance_json,
    dosage_json = EXCLUDED.dosage_json,
    quality_gate = EXCLUDED.quality_gate,
    stop_rules = EXCLUDED.stop_rules,
    coach_instructions = EXCLUDED.coach_instructions,
    athlete_instructions = EXCLUDED.athlete_instructions,
    expected_adaptation = EXCLUDED.expected_adaptation,
    equipment_required = EXCLUDED.equipment_required,
    logistics_json = EXCLUDED.logistics_json,
    substitution_ids = EXCLUDED.substitution_ids,
    time_model_json = EXCLUDED.time_model_json,
    dose_scaling_json = EXCLUDED.dose_scaling_json,
    measurement_json = EXCLUDED.measurement_json,
    support_prompts_json = EXCLUDED.support_prompts_json,
    status = 'review',
    updated_at = now();

  INSERT INTO coaching.exercise_relationship_v1 (
    from_variant_id,
    to_variant_id,
    relationship,
    similarity_score,
    dimensions,
    reason,
    conditions_json,
    review_status
  )
  SELECT
    source_variant.id,
    target_variant.id,
    edge.relationship,
    edge.similarity_score,
    edge.dimensions,
    edge.reason,
    edge.conditions_json,
    'review'
  FROM (
    VALUES
      (
        'depth-drop-to-box-jump',
        'baseline',
        'hands-on-hips',
        'progression',
        90,
        ARRAY['complexity']::TEXT[],
        'Removing arm swing preserves the two-box order but increases lower-body and trunk coordination demand.',
        '{"armUse":"hands_on_hips","humanReviewRequired":true}'::JSONB
      ),
      (
        'depth-drop-to-box-jump',
        'hands-on-hips',
        'baseline',
        'regression',
        90,
        ARRAY['complexity']::TEXT[],
        'Restoring natural arm swing reduces the arm-restriction coordination demand without changing contacts or box order.',
        '{"armUse":"natural_arm_swing","humanReviewRequired":true}'::JSONB
      ),
      (
        'box-jump-to-depth-drop',
        'baseline',
        'hands-on-hips',
        'progression',
        90,
        ARRAY['complexity']::TEXT[],
        'Removing arm swing preserves the floor-to-box-to-floor order but increases propulsion, balance, and landing coordination demand.',
        '{"armUse":"hands_on_hips","humanReviewRequired":true}'::JSONB
      ),
      (
        'box-jump-to-depth-drop',
        'hands-on-hips',
        'baseline',
        'regression',
        90,
        ARRAY['complexity']::TEXT[],
        'Restoring natural arm swing reduces the arm-restriction coordination demand without changing the two contacts or stabilization rule.',
        '{"armUse":"natural_arm_swing","humanReviewRequired":true}'::JSONB
      )
  ) AS edge(
    definition_slug,
    from_variant_key,
    to_variant_key,
    relationship,
    similarity_score,
    dimensions,
    reason,
    conditions_json
  )
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id = facility
   AND definition.slug = edge.definition_slug
   AND definition.status <> 'archived'
  JOIN coaching.exercise_variant_v1 source_variant
    ON source_variant.definition_id = definition.id
   AND source_variant.variant_key = edge.from_variant_key
   AND source_variant.status <> 'archived'
  JOIN coaching.exercise_variant_v1 target_variant
    ON target_variant.definition_id = definition.id
   AND target_variant.variant_key = edge.to_variant_key
   AND target_variant.status <> 'archived'
  ON CONFLICT (from_variant_id, to_variant_id, relationship) DO UPDATE SET
    similarity_score = EXCLUDED.similarity_score,
    dimensions = EXCLUDED.dimensions,
    reason = EXCLUDED.reason,
    conditions_json = EXCLUDED.conditions_json,
    review_status = 'review';

  -- Keep all legacy source rows score-aligned with the canonical baseline,
  -- including the duplicate source rows retained through migration 315.
  UPDATE coaching.exercise_difficulty_profile difficulty
  SET technical = CASE definition.slug
        WHEN 'depth-drop-to-box-jump' THEN 6.4
        ELSE 5.8
      END,
      load = CASE definition.slug
        WHEN 'depth-drop-to-box-jump' THEN 5.8
        ELSE 5.4
      END,
      overall = CASE definition.slug
        WHEN 'depth-drop-to-box-jump' THEN 6.4
        ELSE 5.8
      END,
      updated_at = now()
  FROM coaching.exercise_definition_source_v1 source
  JOIN coaching.exercise_definition_v1 definition
    ON definition.id = source.definition_id
  WHERE definition.id = ANY(target_ids)
    AND difficulty.exercise_id = source.legacy_exercise_id;

  UPDATE coaching.exercise_score_v1 score
  SET technical_complexity = CASE definition.slug
        WHEN 'depth-drop-to-box-jump' THEN 64
        ELSE 58
      END,
      absolute_load_demand = CASE definition.slug
        WHEN 'depth-drop-to-box-jump' THEN 58
        ELSE 54
      END,
      coordination_demand = CASE definition.slug
        WHEN 'depth-drop-to-box-jump' THEN 70
        ELSE 62
      END,
      impact = CASE definition.slug
        WHEN 'depth-drop-to-box-jump' THEN 64
        ELSE 60
      END,
      supervision_demand = CASE definition.slug
        WHEN 'depth-drop-to-box-jump' THEN 72
        ELSE 68
      END,
      base_overall_difficulty = CASE definition.slug
        WHEN 'depth-drop-to-box-jump' THEN 64
        ELSE 58
      END,
      legacy_scores = score.legacy_scores || jsonb_build_object(
        'candidateReassessment', migration_key,
        'exerciseComplexity', CASE definition.slug
          WHEN 'depth-drop-to-box-jump' THEN 64
          ELSE 58
        END,
        'physicalDifficulty', CASE definition.slug
          WHEN 'depth-drop-to-box-jump' THEN 58
          ELSE 54
        END,
        'overallFormula', 'max_exercise_complexity_physical_difficulty',
        'landingContactsPerRep', 2,
        'orderedSequence', CASE definition.slug
          WHEN 'depth-drop-to-box-jump' THEN 'drop_box_to_floor_to_target_box'
          ELSE 'floor_to_box_to_floor'
        END
      ),
      migration_confidence = 68,
      human_review_status = 'queued',
      reviewed_by = NULL,
      reviewed_at = NULL,
      review_notes =
        'Candidate evidence-backed reassessment only; independent human calibration remains required.',
      updated_at = now()
  FROM coaching.exercise_definition_source_v1 source
  JOIN coaching.exercise_definition_v1 definition
    ON definition.id = source.definition_id
  WHERE definition.id = ANY(target_ids)
    AND score.exercise_id = source.legacy_exercise_id;

  UPDATE coaching.exercise legacy
  SET skill_level = NULL,
      why_publish_ready = FALSE,
      description = CASE definition.slug
        WHEN 'depth-drop-to-box-jump' THEN
          'Step from a declared drop box, land bilaterally on the floor, immediately jump onto a target box, land fully, stabilize, stand, step down, and reset.'
        ELSE
          'Jump bilaterally from the floor onto a box, land fully, stabilize and stand, deliberately step off, land bilaterally on the floor, hold the stick, and reset.'
      END,
      card_summary = CASE definition.slug
        WHEN 'depth-drop-to-box-jump' THEN
          'Two-box reactive sequence: drop box to floor contact to immediate target-box jump and controlled elevated landing.'
        ELSE
          'One-box ordered sequence: floor-to-box jump and stabilization followed by a deliberate step-off and held floor landing.'
      END,
      movement_requirements = movement_requirements || jsonb_build_object(
        'ordered_sequence', CASE definition.slug
          WHEN 'depth-drop-to-box-jump' THEN jsonb_build_array(
            'drop_box_step_off',
            'bilateral_floor_contact',
            'immediate_reactive_takeoff',
            'target_box_landing',
            'stabilize_and_stand',
            'step_down_and_reset'
          )
          ELSE jsonb_build_array(
            'floor_to_box_jump',
            'box_landing',
            'stabilize_and_stand',
            'controlled_step_off',
            'bilateral_floor_landing_and_stick',
            'reset'
          )
        END,
        'landing_contacts_per_rep', 2,
        'box_quantity', CASE definition.slug
          WHEN 'depth-drop-to-box-jump' THEN 2
          ELSE 1
        END,
        'arm_use', 'natural_arm_swing_baseline',
        'skill_level_applicable', FALSE
      ),
      coaching_execution = coaching_execution || jsonb_build_object(
        'movement_description', CASE definition.slug
          WHEN 'depth-drop-to-box-jump' THEN
            'Step from a first box, make an organized bilateral floor contact, rebound immediately onto a target box, land fully, stabilize, and step down.'
          ELSE
            'Jump from the floor onto a box, land fully, stabilize and stand, deliberately step off, absorb and hold the floor landing, then reset.'
        END,
        'setup', CASE definition.slug
          WHEN 'depth-drop-to-box-jump' THEN jsonb_build_array(
            'Set and check two stable non-slip boxes at declared heights and spacing.',
            'Clear the floor contact zone, target top, ceiling, step-down route, and station boundary.',
            'Confirm the athlete owns the drop landing, reactive contact, target-box landing, and exit.'
          )
          ELSE jsonb_build_array(
            'Set and check one stable non-slip box and the takeoff, top, step-off, and floor landing zones.',
            'Clear the ceiling, reset route, and station boundary.',
            'Confirm the athlete owns the box jump, top stabilization, step-off, and held floor landing.'
          )
        END,
        'execution_steps', CASE definition.slug
          WHEN 'depth-drop-to-box-jump' THEN jsonb_build_array(
            'Step off the first box without jumping upward and meet the floor with both feet.',
            'Reverse immediately into a vertical jump and land with both feet fully on the target box.',
            'Stabilize, stand, step down, and fully reset before the next repetition.'
          )
          ELSE jsonb_build_array(
            'Jump from the floor and land with both feet fully on the box.',
            'Stabilize and stand before deliberately stepping off without jumping upward.',
            'Land on the floor with both feet, absorb, hold for two seconds, and reset.'
          )
        END,
        'quality_gate', CASE definition.slug
          WHEN 'depth-drop-to-box-jump' THEN jsonb_build_array(
            'True step-off and bilateral initial contact',
            'Prompt reactive transition without forward dive',
            'Full-foot target-box landing and stable top',
            'Controlled step-down and two contacts counted'
          )
          ELSE jsonb_build_array(
            'Full-foot box landing and visible top stabilization',
            'True controlled step-off without jump-down',
            'Quiet bilateral floor landing held for two seconds',
            'Two contacts counted and complete reset'
          )
        END,
        'stop_signs', jsonb_build_array(
          'Pain, giving way, dizziness, or numbness',
          'Any box, surface, clearance, or traffic hazard',
          'Missed, partial-foot, asymmetrical, or uncontrolled contact',
          'Sequence loss, fear, hesitation, or unplanned rebound',
          'Landing quality or output materially worsens'
        )
      ),
      updated_at = now()
  FROM coaching.exercise_definition_source_v1 source
  JOIN coaching.exercise_definition_v1 definition
    ON definition.id = source.definition_id
  WHERE definition.id = ANY(target_ids)
    AND legacy.id = source.legacy_exercise_id;

  INSERT INTO coaching.exercise_card_test_packet_v1 (
    definition_id,
    facility_id,
    card_version,
    audit_version,
    status,
    checks_json,
    blocking_issues_json,
    human_review_required
  )
  SELECT
    definition.id,
    definition.facility_id,
    definition.card_version,
    'canonical-card-audit-v1',
    'quarantined',
    jsonb_build_object(
      'identityMigration', '315_coaching_depth_box_order_identity_consolidation',
      'completenessMigration', migration_key,
      'researchBatch', 'depth-box-order-sequences-v1',
      'difficultyFormula', 'max_exercise_complexity_physical_difficulty',
      'formalProficiencyClassification', 'skill_library_only',
      'exerciseCardProficiencyLevel', 'not_applicable',
      'auditRerunRequired', TRUE
    ),
    jsonb_build_array(
      jsonb_build_object(
        'code', 'CARD-CALIBRATION-01',
        'category', 'calibration',
        'message', 'Independent score-anchor review remains required.'
      ),
      jsonb_build_object(
        'code', 'CARD-GRAPH-03',
        'category', 'relationship_graph',
        'message', 'Progression and regression edges remain review-only.'
      ),
      jsonb_build_object(
        'code', 'CARD-MEDIA-01',
        'category', 'media',
        'message', 'Exact-match full-video review and approval remain required.'
      ),
      jsonb_build_object(
        'code', 'CARD-PUBLISH-01',
        'category', 'publication',
        'message', 'Independent publication review remains required.'
      )
    ),
    TRUE
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.id = ANY(target_ids)
  ON CONFLICT (definition_id) DO UPDATE SET
    facility_id = EXCLUDED.facility_id,
    card_version = EXCLUDED.card_version,
    audit_version = EXCLUDED.audit_version,
    status = EXCLUDED.status,
    checks_json = EXCLUDED.checks_json,
    blocking_issues_json = EXCLUDED.blocking_issues_json,
    human_review_required = TRUE,
    checked_at = now();
END;
$$;
