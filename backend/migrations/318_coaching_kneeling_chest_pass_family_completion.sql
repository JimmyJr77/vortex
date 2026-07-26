-- Complete the candidate-only kneeling medicine-ball chest-pass family after
-- migration 317 consolidates its three duplicate definitions.
--
-- The broad stable identity receives four exact selectable variants:
--   * tall kneeling, throw only
--   * tall kneeling, rebound and catch
--   * half kneeling, throw only
--   * half kneeling, rebound and catch
--
-- The two generic legacy sources do not declare stance or return behavior.
-- Their source variants and delivery profiles remain archived, nonselectable
-- provenance. Exercise difficulty is assessed through exercise complexity and
-- physical difficulty, with overall difficulty equal to their maximum.
-- Exercise cards receive no proficiency level. All evidence, media, graph,
-- calibration, and publication decisions remain candidate/review-only.
-- IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT := '318_coaching_kneeling_chest_pass_family_completion';
  target_definition_id UUID;
  facility BIGINT;
  target_card_version INTEGER;
  protected_records INTEGER;
  unexpected_variants INTEGER;
BEGIN
  SELECT id, facility_id
  INTO target_definition_id, facility
  FROM coaching.exercise_definition_v1
  WHERE slug = 'kneeling-medicine-ball-chest-pass'
    AND status <> 'archived';

  IF target_definition_id IS NULL THEN
    RAISE EXCEPTION
      'Kneeling chest-pass family completion requires the active survivor definition';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_definition_v1
    WHERE slug IN (
      'tall-kneeling-medicine-ball-chest-pass',
      'tall-kneeling-chest-pass-to-wall',
      'half-kneeling-chest-pass-to-wall'
    )
      AND status <> 'archived'
  ) THEN
    RAISE EXCEPTION
      'Kneeling chest-pass family completion requires migration 317 duplicate consolidation first';
  END IF;

  SELECT
    (
      SELECT COUNT(*)
      FROM coaching.exercise_definition_v1
      WHERE id = target_definition_id
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
      WHERE definition_id = target_definition_id
        AND review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_media_candidate_v1
      WHERE definition_id = target_definition_id
        AND review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_alternate_assessment_v1
      WHERE definition_id = target_definition_id
        AND review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_card_review_v1
      WHERE definition_id = target_definition_id
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_card_revision_v1
      WHERE definition_id = target_definition_id
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_media_review_v1
      WHERE definition_id = target_definition_id
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_variant_v1
      WHERE definition_id = target_definition_id
        AND status = 'published'
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_delivery_profile_v1 profile
      JOIN coaching.exercise_variant_v1 variant
        ON variant.id = profile.variant_id
      WHERE variant.definition_id = target_definition_id
        AND profile.status = 'published'
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_relationship_v1 relationship
      WHERE (
        relationship.from_variant_id IN (
          SELECT id
          FROM coaching.exercise_variant_v1
          WHERE definition_id = target_definition_id
        )
        OR relationship.to_variant_id IN (
          SELECT id
          FROM coaching.exercise_variant_v1
          WHERE definition_id = target_definition_id
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
      WHERE variant.definition_id = target_definition_id
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
        WHERE source.definition_id = target_definition_id
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
      'Kneeling chest-pass family completion refused to override % protected records',
      protected_records;
  END IF;

  SELECT COUNT(*)
  INTO unexpected_variants
  FROM coaching.exercise_variant_v1
  WHERE definition_id = target_definition_id
    AND status <> 'archived'
    AND variant_key NOT IN (
      'baseline',
      'baseline-source-1319',
      'tall-kneeling-throw-only',
      'tall-kneeling-rebound-catch',
      'half-kneeling-throw-only',
      'half-kneeling-rebound-catch'
    );

  IF unexpected_variants > 0 THEN
    RAISE EXCEPTION
      'Kneeling chest-pass family completion found % unexpected active variants',
      unexpected_variants;
  END IF;

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET status = 'archived',
      updated_at = now()
  FROM coaching.exercise_variant_v1 variant
  WHERE variant.id = profile.variant_id
    AND variant.definition_id = target_definition_id
    AND variant.variant_key IN ('baseline', 'baseline-source-1319');

  UPDATE coaching.exercise_variant_v1
  SET variant_key = CASE variant_key
        WHEN 'baseline' THEN 'legacy-unspecified-kneeling-source-735'
        ELSE 'legacy-unspecified-kneeling-source-1319'
      END,
      status = 'archived',
      requirements_json = requirements_json || jsonb_build_object(
        'sourceStance', 'unspecified',
        'sourceReturnContract', 'unspecified',
        'selectable', FALSE,
        'identityQuarantine', TRUE,
        'quarantineReason',
          'The legacy source does not declare tall versus half kneeling or whether a returning catch is required.'
      ),
      updated_at = now()
  WHERE definition_id = target_definition_id
    AND variant_key IN ('baseline', 'baseline-source-1319');

  UPDATE coaching.exercise_definition_v1
  SET card_version = CASE
        WHEN provenance_json->>'structuralCompletionMigration' IS DISTINCT FROM migration_key
          THEN card_version + 1
        ELSE card_version
      END,
      canonical_name = 'Kneeling Medicine Ball Chest Pass',
      display_name = 'Kneeling Medicine Ball Chest Pass',
      description =
        'Project a declared medicine ball horizontally from the chest with two hands while maintaining a declared tall- or half-kneeling base. The exact variant states whether the ball is throw-only or must return safely for a controlled catch.',
      family_key = 'kneeling_medicine_ball_horizontal_chest_pass',
      movement_patterns = ARRAY['push', 'brace']::TEXT[],
      body_regions = ARRAY[
        'shoulder',
        'scapula',
        'elbow',
        'wrist',
        'hand',
        'eye_hand',
        'rib_cage',
        'core',
        'spine',
        'pelvis',
        'hip',
        'knee'
      ]::TEXT[],
      required_equipment = ARRAY['medicine_ball']::TEXT[],
      optional_equipment = ARRAY[
        'mat_optional',
        'wall_optional',
        'partner',
        'line_tape',
        'timer'
      ]::TEXT[],
      environment_json = jsonb_build_object(
        'surface', 'level_non_slip_kneeling_surface',
        'ballSpecification', 'declared_mass_material_diameter_and_rebound_behavior',
        'target', 'trained_partner_safe_open_target_or_inspected_wall',
        'distance', 'declared_and_repeatable',
        'targetHeight', 'declared_relative_to_thrower',
        'flightLane', 'clear_from_thrower_to_target',
        'returnPath', 'clear_and_predictable_when_rebound_or_partner_return_is_prescribed',
        'wallRule', 'structurally_suitable_inspected_surface_with_predictable_return',
        'traffic', 'one_active_thrower_per_lane_no_cross_traffic',
        'lighting', 'ball_and_target_clearly_visible',
        'coachSightline', 'kneeling_base_release_path_target_and_any_return_visible'
      ),
      population_json = jsonb_build_object(
        'readiness', jsonb_build_array(
          'pain_free_declared_kneeling_position',
          'pain_free_two_hand_chest_pass',
          'stable_trunk_and_pelvis_during_release',
          'can_hit_declared_target_with_light_ball',
          'can_track_and_absorb_return_when_catch_is_prescribed',
          'can_follow_stop_and_lane_clear_instructions'
        ),
        'contraindicationFlags', jsonb_build_array(
          'current_shoulder_elbow_wrist_hand_back_hip_knee_or_kneeling_pain',
          'numbness_dizziness_instability_or_neurologic_symptoms',
          'uncontrolled_trunk_extension_rotation_or_balance_loss',
          'unsafe_ball_wall_partner_lane_surface_or_return_path',
          'unassessed_recent_injury_surgery_or_rehabilitation_restriction'
        ),
        'supervision', 'direct_observation_until_stance_release_target_and_return_contract_are_repeatable',
        'selectionBoundary',
          'Select stance, return contract, ball mass, target, distance, and dose from current readiness and the intended stimulus; exercise cards do not carry proficiency levels.',
        'clinicalBoundary',
          'Symptoms, instability, recent surgery, neurologic signs, or rehabilitation restrictions require individualized clinician guidance; this card is not rehabilitation instruction.'
      ),
      anatomy_json = jsonb_build_object(
        'primaryMuscles', jsonb_build_array(
          'pectoralis_major',
          'triceps_brachii',
          'anterior_deltoid'
        ),
        'secondaryMuscles', jsonb_build_array(
          'serratus_anterior',
          'rotator_cuff',
          'abdominal_wall',
          'spinal_stabilizers',
          'gluteus_maximus',
          'hip_stabilizers'
        ),
        'stabilizers', jsonb_build_array(
          'scapular_stabilizers',
          'rotator_cuff',
          'abdominal_wall',
          'spinal_stabilizers',
          'pelvic_and_hip_stabilizers'
        ),
        'joints', jsonb_build_array(
          'shoulder',
          'scapulothoracic_articulation',
          'elbow',
          'wrist_and_hand',
          'spine',
          'pelvis',
          'hip',
          'knee'
        ),
        'jointActions', jsonb_build_array(
          'shoulder_horizontal_adduction_and_flexion',
          'elbow_extension',
          'scapular_protraction',
          'wrist_and_hand_release',
          'trunk_anti_extension',
          'pelvic_and_hip_stabilization',
          'shoulder_and_elbow_flexion_during_declared_catch_absorption'
        ),
        'planes', jsonb_build_array('transverse', 'sagittal'),
        'laterality', 'bilateral_throw_with_symmetric_tall_or_asymmetric_half_kneeling_base',
        'primaryActions', jsonb_build_array(
          'establish_declared_kneeling_base',
          'brace_trunk_and_pelvis',
          'project_ball_horizontally_from_chest_with_two_hands',
          'complete_release_to_declared_target',
          'reset_or_absorb_declared_return'
        )
      ),
      athlete_support_json = jsonb_build_object(
        'whyItMatters',
          'This task develops a repeatable fast two-hand chest pass while the trunk and pelvis organize force from an exact kneeling base.',
        'plainLanguagePurpose',
          'Throw the ball fast from your chest while keeping the exact kneeling base steady.',
        'beforeYouStart', jsonb_build_array(
          'Confirm your stance, lead leg when half kneeling, ball mass, target, distance, and whether the ball will return.',
          'Make sure the lane and return path are empty.',
          'Use a ball you can release quickly and control.'
        ),
        'primaryCue', 'Base steady, ball at chest, brace, punch both hands to the target.',
        'expectedSensations', jsonb_build_array(
          'brief_fast_effort_through_chest_shoulders_and_arms',
          'firm_abdominal_and_hip_stabilization',
          'controlled_ball_contact_in_hands_when_catching'
        ),
        'unexpectedSensations', jsonb_build_array(
          'sharp_burning_or_increasing_joint_pain',
          'numbness_tingling_dizziness_or_giving_way',
          'pinching_in_shoulder_elbow_wrist_back_hip_or_knee',
          'fear_or_inability_to_track_a_returning_ball'
        ),
        'painGuidance',
          'Stop immediately for pain, numbness, tingling, dizziness, instability, or a return you cannot control; do not throw through symptoms.',
        'selfChecks', jsonb_build_array(
          'I can hold the declared kneeling base without wobbling.',
          'The ball leaves both hands together and reaches the target.',
          'My ribs, pelvis, and head stay organized.',
          'If catching, I see the return early and absorb it away from my face.'
        ),
        'stopAndReport', jsonb_build_array(
          'pain_numbness_dizziness_or_instability',
          'unsafe_or_unexpected_ball_return',
          'missed_catch_or_ball_near_face',
          'loss_of_balance_target_or_lane_control'
        ),
        'accessibility', jsonb_build_array(
          'lighter_or_softer_ball',
          'larger_high_contrast_target',
          'throw_only_before_rebound_catch',
          'tall_kneeling_before_half_kneeling',
          'seated_separate_exercise_when_kneeling_is_not_accessible',
          'fewer_repetitions_and_longer_reset',
          'plain_text_steps_and_non_video_instruction'
        ),
        'mediaAlternatives', jsonb_build_object(
          'textSequence', 'Exact stance, ball start, target release, reset, and catch steps are always available as text.',
          'diagram', 'Provide a stance, target, flight-lane, and return-path diagram.',
          'accessibilityRule', 'Captions, transcript, contrast, audio-independence, and a non-video alternative require review before any media approval.'
        )
      ),
      coach_support_json = jsonb_build_object(
        'setupChecklist', jsonb_build_array(
          'Verify ball mass material diameter condition and rebound behavior.',
          'Inspect kneeling surface, wall or partner, target, distance, flight lane, return path, lighting, and traffic boundary.',
          'Declare stance, lead leg, throw-only or catch contract, target, dose, rest, and stop signal.'
        ),
        'observationAngles', jsonb_build_array(
          'front_oblique_for_hand_symmetry_target_and_half_kneeling_alignment',
          'side_for_trunk_extension_release_path_and_return_absorption'
        ),
        'observationChecklist', jsonb_build_array(
          'exact_stance_and_lead_leg_match_prescription',
          'ball_mass_type_target_distance_and_return_contract_match_prescription',
          'kneeling_base_trunk_and_pelvis_remain_stable',
          'ball_starts_at_chest_and_leaves_both_hands_together',
          'release_reaches_target_without_wild_path_or_material_compensation',
          'declared_reset_or_catch_is_safe_and_repeatable'
        ),
        'qualityHierarchy', jsonb_build_array(
          'safe_lane_ball_target_and_return',
          'stable_declared_kneeling_base',
          'organized_trunk_and_pelvis',
          'two_hand_horizontal_release_to_target',
          'safe_declared_reset_or_catch',
          'repeatable_output'
        ),
        'correctionDecisionTree', jsonb_build_array(
          'If the lane, wall, partner, ball, or return is unsafe, shut the station down.',
          'If pain or neurologic symptoms occur, stop and refer through the facility response process.',
          'If stance fails, reduce mass or use tall kneeling before changing cues.',
          'If release is slow or inaccurate, reduce mass, increase target size, or shorten the set.',
          'If a catch is late or unsafe, switch to throw-only or a trained partner with a controlled return.',
          'Use one cue, retest once, then regress rather than layering more cues.'
        ),
        'faultCorrections', jsonb_build_object(
          'base_or_balance_loss', 'Reduce mass, use tall kneeling, widen the half-kneeling base within the declared task, or shorten the set.',
          'trunk_extension_or_rotation', 'Reduce mass or distance and cue a quiet rib cage over the pelvis.',
          'slow_or_inaccurate_release', 'Reduce ball mass, enlarge or move the target closer, and restore full rest.',
          'late_or_unsafe_catch', 'Switch to throw-only or a trained partner with a controlled return; do not keep testing an unpredictable rebound.',
          'lane_or_equipment_issue', 'Stop the station and correct the environment before another throw.'
        ),
        'demonstrationPlan', jsonb_build_array(
          'Show the exact stance and lead leg from front and side.',
          'Name the ball, target, distance, and return contract.',
          'Demonstrate one complete quality repetition and the stop signal.',
          'Ask the athlete to teach back stance, target, catch rule, and lane-clear rule.'
        ),
        'modificationDecisionTree', jsonb_build_array(
          'Unsafe lane, ball, wall, partner, or surface means stop and close the station.',
          'Symptoms or instability mean stop and follow the facility response process.',
          'Catch failure means use throw-only before changing stance.',
          'Stance failure means reduce mass or use tall kneeling.',
          'Release or target failure means reduce mass or distance and increase target size.',
          'Persistent failure after one retest means choose a reviewed separate exercise.'
        ),
        'doNotUseWhen', jsonb_build_array(
          'pain_numbness_dizziness_giving_way_or_unresolved_injury_restriction',
          'unsafe_or_damaged_ball_wall_partner_surface_target_or_lane',
          'athlete_cannot_hold_the_declared_kneeling_base',
          'return_behavior_is_unpredictable_for_a_catch_variant',
          'fatigue_prevents_repeatable_release_target_or_catch_quality'
        ),
        'groupManagement',
          'One athlete throws per lane; partners and queued athletes remain outside the flight and rebound path, and the coach retains immediate lane shutdown control.',
        'recordingFields', jsonb_build_array(
          'variant_key',
          'lead_leg',
          'ball_mass_and_type',
          'target_and_distance',
          'sets_and_repetitions',
          'rest',
          'hit_rate_or_release_velocity',
          'catch_errors',
          'stop_reason'
        )
      ),
      support_operations_json = jsonb_build_object(
        'issueCategories', jsonb_build_array(
          'clinical_symptom_or_injury_concern',
          'ball_wall_partner_surface_target_or_lane_hazard',
          'identity_stance_or_return_contract_dispute',
          'difficulty_or_dosage_dispute',
          'media_link_match_safety_caption_or_accessibility_issue',
          'saved_workout_or_renderer_mismatch'
        ),
        'supportEscalation', jsonb_build_object(
          'clinical', 'Stop exposure and follow the facility clinical escalation pathway.',
          'equipmentOrEnvironment', 'Close the lane and remove damaged equipment until inspection is complete.',
          'contentOrIdentity', 'Quarantine the exact variant and route it to canonical-card review.',
          'media', 'Remove the candidate from delivery and route it to media review.',
          'workoutPersistence', 'Preserve the saved inputs and output, record the mismatch, and route it to generator support.'
        ),
        'issueEscalation', jsonb_build_object(
          'clinical', 'Stop exposure and follow facility clinical escalation for pain, neurologic symptoms, instability, or injury concern.',
          'equipment', 'Remove damaged balls and close any unsafe wall, target, lane, or surface until inspected.',
          'content', 'Quarantine the exact variant when stance, return behavior, source identity, score, or instruction is disputed.',
          'media', 'Mark broken, mismatched, unsafe, inaccessible, or embedding-disabled media and remove it from member delivery.'
        ),
        'retention', jsonb_build_object(
          'preserve', jsonb_build_array(
            'legacy_source_identity',
            'stance_and_return_contract',
            'ball_specification_and_target',
            'candidate_score_provenance',
            'human_review_decisions',
            'media_review_history',
            'stop_and_substitution_events'
          ),
          'ambiguousSourceRule',
            'Never convert a stance-unspecified legacy source into a selectable exact variant without recoverable evidence and human review.'
        ),
        'retentionPolicy', jsonb_build_object(
          'preserveSourceRows', TRUE,
          'preserveAmbiguity', TRUE,
          'preserveHumanDecisions', TRUE,
          'preserveWorkoutReproducibility', TRUE,
          'rule', 'Keep source identity, exact variant, ball and target specification, score provenance, review history, substitutions, stop events, and saved-workout inputs.'
        ),
        'changeImpact', jsonb_build_array(
          'variant_identity_and_alias_search',
          'difficulty_and_fatigue_budgets',
          'equipment_and_lane_feasibility',
          'duration_and_rest_models',
          'substitution_graph',
          'athlete_and_coach_renderers',
          'media_exact_match',
          'saved_workout_reproducibility'
        ),
        'changeImpactPolicy', jsonb_build_object(
          'reaudit', jsonb_build_array(
            'identity_and_aliases',
            'variant_scores_and_budgets',
            'equipment_and_logistics',
            'dosage_and_duration',
            'relationship_and_substitution_graph',
            'coach_and_athlete_rendering',
            'media_exact_match',
            'saved_workout_reproducibility'
          ),
          'publicationRule', 'Any material identity, score, instruction, equipment, return-contract, or media change returns the card to review and requires a new test packet.'
        ),
        'feedbackCapture', jsonb_build_array(
          'pain_or_symptoms',
          'target_hit_rate',
          'release_velocity_when_available',
          'stance_or_balance_error',
          'catch_or_return_error',
          'ball_wall_partner_or_lane_issue',
          'substitution_reason',
          'coach_override'
        )
      ),
      content_confidence = 84,
      scoring_confidence = 64,
      media_confidence = 48,
      approved_video_url = NULL,
      status = 'review',
      reviewed_by = NULL,
      approved_by = NULL,
      last_reviewed_at = NULL,
      provenance_json = provenance_json || jsonb_build_object(
        'identityMigration', '317_coaching_kneeling_chest_pass_identity_consolidation',
        'structuralCompletionMigration', migration_key,
        'researchBatch', 'kneeling-medicine-ball-chest-pass-family-v1',
        'researchVersion', '2026-07-26.32',
        'difficultyModel', 'max_exercise_complexity_physical_difficulty',
        'genericSourceStance', 'unresolved_and_archived',
        'humanReviewRequired', TRUE,
        'publicationQuarantined', TRUE,
        'mediaApprovalCreated', FALSE,
        'graphApprovalCreated', FALSE,
        'calibrationApprovalCreated', FALSE
      ),
      updated_at = now()
  WHERE id = target_definition_id;

  SELECT d.card_version
  INTO target_card_version
  FROM coaching.exercise_definition_v1 d
  WHERE d.id = target_definition_id;

  CREATE TEMP TABLE kneeling_chest_variant_seed (
    variant_key TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    stance TEXT NOT NULL,
    return_contract TEXT NOT NULL,
    modifier_keys TEXT[] NOT NULL,
    technical_complexity INTEGER NOT NULL,
    physical_difficulty INTEGER NOT NULL,
    coordination_demand INTEGER NOT NULL,
    supervision_demand INTEGER NOT NULL,
    failure_consequence INTEGER NOT NULL,
    impact INTEGER NOT NULL,
    work_capacity_demand INTEGER NOT NULL,
    spinal_loading INTEGER NOT NULL,
    eccentric_stress INTEGER NOT NULL,
    local_muscle_fatigue INTEGER NOT NULL,
    technical_fatigue_sensitivity INTEGER NOT NULL,
    recovery_hours INTEGER NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO kneeling_chest_variant_seed VALUES
    (
      'tall-kneeling-throw-only',
      'Tall-Kneeling Medicine Ball Chest Pass — Throw Only',
      'tall_kneeling',
      'throw_only_no_required_catch',
      ARRAY['tall_kneeling', 'throw_only']::TEXT[],
      34, 38, 38, 44, 38, 8, 24, 18, 18, 42, 52, 24
    ),
    (
      'tall-kneeling-rebound-catch',
      'Tall-Kneeling Medicine Ball Chest Pass — Rebound and Catch',
      'tall_kneeling',
      'rebound_and_controlled_catch',
      ARRAY['tall_kneeling', 'rebound_catch']::TEXT[],
      42, 42, 48, 56, 54, 8, 28, 20, 32, 48, 60, 30
    ),
    (
      'half-kneeling-throw-only',
      'Half-Kneeling Medicine Ball Chest Pass — Throw Only',
      'half_kneeling',
      'throw_only_no_required_catch',
      ARRAY['half_kneeling', 'alternating_lead_leg', 'throw_only']::TEXT[],
      42, 38, 48, 48, 42, 8, 24, 20, 18, 44, 58, 24
    ),
    (
      'half-kneeling-rebound-catch',
      'Half-Kneeling Medicine Ball Chest Pass — Rebound and Catch',
      'half_kneeling',
      'rebound_and_controlled_catch',
      ARRAY['half_kneeling', 'alternating_lead_leg', 'rebound_catch']::TEXT[],
      48, 42, 56, 60, 58, 8, 28, 22, 34, 50, 66, 30
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
    target_definition_id,
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
      'baseOverallDifficulty', greatest(
        seed.technical_complexity,
        seed.physical_difficulty
      ),
      'overallFormula', 'max_exercise_complexity_physical_difficulty'
    ),
    jsonb_build_object(
      'stance', seed.stance,
      'laterality', CASE seed.stance
        WHEN 'tall_kneeling' THEN 'bilateral_symmetric_base'
        ELSE 'bilateral_throw_asymmetric_base_alternate_lead_leg'
      END,
      'leadLegRule', CASE seed.stance
        WHEN 'tall_kneeling' THEN 'not_applicable'
        ELSE 'declare_each_set_and_balance_sides_unless_documented_otherwise'
      END,
      'returnContract', seed.return_contract,
      'ballStart', 'two_hands_at_chest',
      'projection', 'horizontal_to_declared_target',
      'release', 'complete_two_hand_release',
      'targetOptions', jsonb_build_array(
        'trained_partner',
        'safe_open_target',
        'inspected_wall'
      ),
      'ballRule',
        'Declare mass, diameter, material, and rebound behavior; use a ball light enough to preserve ballistic release, target accuracy, posture, and any prescribed catch.',
      'wallRule', CASE seed.return_contract
        WHEN 'rebound_and_controlled_catch'
          THEN 'use_only_a_ball_and_inspected_wall_that_produce_a_predictable_catchable_return'
        ELSE 'wall_or_target_may_stop_or_return_ball_but_the_thrower_is_not_required_to_catch'
      END,
      'selectable', TRUE,
      'identityQuarantine', FALSE
    ),
    jsonb_build_object(
      'gripDemand', 24,
      'spinalLoading', seed.spinal_loading,
      'eccentricStress', seed.eccentric_stress,
      'landingContactsPerRep', 0,
      'externalLoadMethod', 'declared_medicine_ball_mass_and_rebound_type',
      'loadingType', CASE seed.return_contract
        WHEN 'rebound_and_controlled_catch'
          THEN 'upper_body_ballistic_projection_plus_return_absorption'
        ELSE 'upper_body_ballistic_projection_throw_only'
      END,
      'impactClass', 'low_ground_impact_with_ball_flight_consequence',
      'primaryStress', CASE seed.return_contract
        WHEN 'rebound_and_controlled_catch' THEN jsonb_build_array(
          'rapid_horizontal_upper_body_projection',
          'anterior_shoulder_and_elbow_extension_load',
          'trunk_and_pelvic_stabilization',
          'visual_tracking_and_return_absorption'
        )
        ELSE jsonb_build_array(
          'rapid_horizontal_upper_body_projection',
          'anterior_shoulder_and_elbow_extension_load',
          'trunk_and_pelvic_stabilization'
        )
      END
    ),
    jsonb_build_object(
      'localMuscleFatigue', seed.local_muscle_fatigue,
      'gripFatigue', 20,
      'technicalFatigueSensitivity', seed.technical_fatigue_sensitivity,
      'impactAccumulation', 8,
      'recoveryHours', seed.recovery_hours,
      'fatigueSignals', jsonb_build_array(
        'release_velocity_decline',
        'target_accuracy_loss',
        'trunk_extension_rotation_or_balance_loss',
        'shoulder_elbow_wrist_or_hand_discomfort',
        'late_unsafe_or_missed_catch_when_prescribed'
      ),
      'cumulativeBudgets', jsonb_build_array(
        'upper_body_ballistic_repetitions',
        'pressing_and_throwing_load',
        'anterior_shoulder_and_elbow_stress',
        'trunk_and_pelvic_stabilization',
        'catch_absorption_exposures',
        'technical_sensitivity'
      ),
      'recoveryRule',
        'Do not repeat high-intent exposure while pain, soreness, output loss, target loss, balance error, or catch hesitation persists.'
    ),
    jsonb_build_object(
      'trainingStimuli', CASE seed.return_contract
        WHEN 'rebound_and_controlled_catch' THEN jsonb_build_array(
          'upper_body_ballistic_power',
          'horizontal_target_accuracy',
          'kneeling_trunk_and_pelvic_control',
          'return_tracking_and_absorption'
        )
        ELSE jsonb_build_array(
          'upper_body_ballistic_power',
          'horizontal_target_accuracy',
          'kneeling_trunk_and_pelvic_control'
        )
      END,
      'stimulusDose', jsonb_build_object(
        'sets', '2-4',
        'repetitions', '3-5',
        'interRepetitionResetSeconds', '5-12',
        'interSetRestSeconds', '90-180',
        'effort', 'high_intent_while_every_quality_gate_remains_repeatable'
      ),
      'weeklyExposure',
        'Count with all weekly medicine-ball throws, upper-body plyometrics, pressing, shoulder and elbow stress, trunk stabilization, and prescribed catch exposures.',
      'prerequisites', jsonb_build_array(
        'pain_free_declared_kneeling_base',
        'stable_trunk_and_pelvis',
        'repeatable_two_hand_light_ball_chest_pass_to_target',
        CASE seed.return_contract
          WHEN 'rebound_and_controlled_catch'
            THEN 'repeatable_tracking_and_safe_return_absorption'
          ELSE 'safe_ball_retrieval_or_partner_collection'
        END
      ),
      'completionCriteria', jsonb_build_array(
        'declared_stance_and_lead_leg_are_preserved',
        'ball_starts_at_chest_and_leaves_both_hands_together',
        'release_reaches_declared_target_without_material_trunk_compensation',
        CASE seed.return_contract
          WHEN 'rebound_and_controlled_catch'
            THEN 'return_is_seen_early_caught_away_from_face_and_absorbed_without_balance_loss'
          ELSE 'throw_is_completed_and_ball_is_retrieved_without_entering_an_active_lane'
        END
      ),
      'sequenceRules', jsonb_build_array(
        'place_after_readiness_and_before_material_upper_body_fatigue',
        'declare_ball_stance_target_distance_and_return_contract',
        'full_reset_between_repetitions',
        'do_not_use_output_profile_as_density_conditioning'
      ),
      'pairingCompatibility', jsonb_build_object(
        'compatible', jsonb_build_array(
          'low_fatigue_mobility_or_readiness_work',
          'lower_body_strength_afterward',
          'noncompeting_restore_work'
        ),
        'conditional', jsonb_build_array(
          'heavy_pressing',
          'other_upper_body_plyometrics',
          'overhead_or_rotational_throwing',
          'high_volume_shoulder_work'
        )
      ),
      'interferenceRules', jsonb_build_array(
        'do_not_pre_fatigue_shoulders_triceps_or_trunk_before_output_scoring',
        'do_not_combine_untracked_throwing_and_catch_volume',
        'do_not_increase_ball_mass_when_speed_target_or_posture_worsens',
        'do_not_select_catch_variant_without_predictable_return_and_clear_lane'
      ),
      'uncertaintyPolicy',
        'When stance, ball behavior, target, return contract, readiness, or fatigue evidence is unclear, use a light-ball throw-only regression and keep the uncertain exact variant out of automatic selection.'
    ),
    'review'
  FROM kneeling_chest_variant_seed seed
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
    AND variant.definition_id = target_definition_id
    AND variant.status <> 'archived'
    AND profile.profile_key NOT IN ('output-power', 'technique-control');

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
    CASE profile.profile_key
      WHEN 'output-power' THEN
        'Train repeatable high-intent horizontal upper-body projection from the exact kneeling and return contract while the athlete is fresh.'
      ELSE
        'Teach the exact kneeling base, release path, target, reset, and any prescribed rebound catch with a light ball and submaximal intent.'
    END,
    CASE profile.profile_key
      WHEN 'output-power' THEN 90
      ELSE 78
    END,
    CASE profile.profile_key
      WHEN 'output-power' THEN 88
      ELSE 82
    END,
    jsonb_build_object(
      'upperBodyPower', CASE profile.profile_key WHEN 'output-power' THEN 94 ELSE 66 END,
      'targetAccuracy', CASE profile.profile_key WHEN 'output-power' THEN 78 ELSE 92 END,
      'kneelingControl', CASE profile.profile_key WHEN 'output-power' THEN 72 ELSE 94 END,
      'returnControl', CASE
        WHEN variant.requirements_json->>'returnContract' = 'rebound_and_controlled_catch'
          THEN CASE profile.profile_key WHEN 'output-power' THEN 74 ELSE 94 END
        ELSE 20
      END,
      'conditioning', 10
    ),
    jsonb_build_object(
      'sets', CASE profile.profile_key WHEN 'output-power' THEN '2-4' ELSE '2-3' END,
      'repetitions', CASE profile.profile_key WHEN 'output-power' THEN '3-5' ELSE '3-6' END,
      'effort', CASE profile.profile_key
        WHEN 'output-power' THEN 'high_intent_with_repeatable_release_target_and_stance'
        ELSE 'submaximal_sequence_and_target_learning'
      END,
      'interRepetitionResetSeconds', CASE profile.profile_key
        WHEN 'output-power' THEN '5-12'
        ELSE '5-10'
      END,
      'interSetRestSeconds', CASE profile.profile_key
        WHEN 'output-power' THEN '90-180'
        ELSE '60-120'
      END,
      'ballRule',
        'Use a mass and ball type that preserve the intended release, target accuracy, posture, and declared return behavior.',
      'sideRule', CASE variant.requirements_json->>'stance'
        WHEN 'half_kneeling'
          THEN 'Declare lead leg and balance repetitions across sides unless a documented reason says otherwise.'
        ELSE 'Tall-kneeling base is symmetric.'
      END,
      'termination',
        'Stop on the first symptom, unsafe return, lane issue, missed catch, material output decline, target loss, or stance-quality failure.'
    ),
    CASE profile.profile_key
      WHEN 'output-power' THEN
        'Every repetition keeps the declared base and return contract, reaches the target with a visibly ballistic two-hand release, and shows no material posture, accuracy, or catch decline.'
      ELSE
        'The athlete can identify and execute the stance, lead leg when relevant, ball start, two-hand target release, reset, and any catch without rush, fear, or external rescue.'
    END,
    ARRAY[
      'pain_numbness_dizziness_or_instability',
      'damaged_ball_unsafe_wall_partner_surface_target_or_lane',
      'loss_of_kneeling_balance_or_declared_lead_leg',
      'trunk_extension_rotation_or_wild_release',
      'target_accuracy_or_release_speed_materially_declines',
      'unexpected_face_height_or_uncontrolled_return',
      'missed_late_or_unsafe_catch_when_prescribed'
    ]::TEXT[],
    CASE profile.profile_key
      WHEN 'output-power' THEN
        'Confirm exact variant, ball, target, distance, and lane. See the base and release, track target hits or velocity when available, and end the set at the first material decline.'
      ELSE
        'Demonstrate the complete sequence, use one cue, start with a light ball, and regress stance, return contract, distance, or mass when the sequence is not repeatable.'
    END,
    CASE profile.profile_key
      WHEN 'output-power' THEN
        'Set your base, brace, punch both hands fast to the target, then complete the declared reset or catch.'
      ELSE
        'Base first, ball at chest, brace, throw to the target, then reset or catch exactly as declared.'
    END,
    CASE profile.profile_key
      WHEN 'output-power' THEN
        'Improved repeatability of high-intent horizontal upper-body projection from the exact kneeling stance without claiming transfer beyond the tested task.'
      ELSE
        'More accurate stance, release, target, reset, and return-control execution with a light ball.'
    END,
    CASE variant.requirements_json->>'returnContract'
      WHEN 'rebound_and_controlled_catch'
        THEN ARRAY['medicine_ball']::TEXT[]
      ELSE ARRAY['medicine_ball']::TEXT[]
    END,
    jsonb_build_object(
      'stationCapacity', 1,
      'athletesPerLane', 1,
      'partnerCount', 'zero_or_one_trained_partner',
      'queueRule', 'waiting_athletes_remain_outside_flight_and_return_path',
      'setupSeconds', 75,
      'resetSecondsPerRep', CASE profile.profile_key WHEN 'output-power' THEN 8 ELSE 6 END,
      'retrievalRule',
        'Only retrieve after the ball is stopped and no athlete is active in the lane.',
      'traffic', 'one_direction_no_cross_traffic',
      'coachSightline', 'base_release_target_and_return_visible'
    ),
    ARRAY[]::UUID[],
    jsonb_build_object(
      'setupSeconds', 75,
      'instructionSeconds', CASE profile.profile_key WHEN 'output-power' THEN 35 ELSE 50 END,
      'secondsPerRep', CASE profile.profile_key WHEN 'output-power' THEN 10 ELSE 8 END,
      'interSetRestSeconds', CASE profile.profile_key
        WHEN 'output-power' THEN '90-180'
        ELSE '60-120'
      END,
      'cleanupSeconds', 45,
      'durationFormula',
        'setup + instruction + sets * repetitions * secondsPerRep + interSetRest + cleanup'
    ),
    jsonb_build_object(
      'regressOrder', jsonb_build_array(
        'reduce_ball_mass',
        'use_throw_only',
        'use_tall_kneeling',
        'increase_target_size_or_reduce_distance',
        'reduce_repetitions',
        'increase_rest',
        'use_seated_separate_exercise_if_kneeling_is_not_accessible'
      ),
      'progressOrder', jsonb_build_array(
        'improve_target_repeatability',
        'add_safe_rebound_catch',
        'use_half_kneeling',
        'increase_distance_or_output_metric_before_ball_mass',
        'increase_mass_only_when_ballistic_quality_is_preserved'
      ),
      'massCapRule',
        'Never increase ball mass when release speed, range, target accuracy, posture, balance, or catch control worsens.',
      'minimumDose', '2_sets_of_3_quality_repetitions'
    ),
    jsonb_build_object(
      'primaryMetric', CASE profile.profile_key
        WHEN 'output-power' THEN 'release_velocity_or_standardized_distance_when_available'
        ELSE 'quality_repetitions_and_target_hit_rate'
      END,
      'secondaryMetrics', jsonb_build_array(
        'target_hit_rate',
        'stance_errors',
        'trunk_compensations',
        'catch_errors',
        'perceived_effort',
        'stop_reason'
      ),
      'standardization', jsonb_build_array(
        'variant_key',
        'lead_leg',
        'ball_mass_diameter_material_and_rebound_type',
        'distance_and_target_height',
        'wall_or_partner',
        'return_contract',
        'warmup_and_rest'
      ),
      'comparisonRule',
        'Compare output only when technique, exact variant, ball specification, target, distance, and measurement method are unchanged.'
    ),
    jsonb_build_object(
      'athletePrompt',
        'Confirm stance, lead leg when relevant, ball, target, and whether you catch the return. Report pain, balance loss, or an unsafe return immediately.',
      'coachPrompt',
        'Verify lane, ball, wall or partner, exact variant, dose, rest, target metric, and stop rule before enabling the station.',
      'substitutionPrompt',
        'If the exact setup or return contract is unavailable, choose a reviewed throw-only, stance, target, or separate seated alternative; do not silently change the task.',
      'postSetPrompt',
        'Record target hits or velocity, stance and catch errors, symptoms, perceived effort, and why the set stopped.',
      'supportRoute',
        'Escalate clinical, equipment, media, or content issues through the definition-level support operations contract.'
    ),
    'review'
  FROM coaching.exercise_variant_v1 variant
  CROSS JOIN (
    VALUES
      ('output-power', 'output', 'primary'),
      ('technique-control', 'movement_intelligence', 'conditional')
  ) AS profile(profile_key, phase_key, role)
  WHERE variant.definition_id = target_definition_id
    AND variant.status <> 'archived'
    AND variant.variant_key IN (
      'tall-kneeling-throw-only',
      'tall-kneeling-rebound-catch',
      'half-kneeling-throw-only',
      'half-kneeling-rebound-catch'
    )
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
        'tall-kneeling-throw-only',
        'tall-kneeling-rebound-catch',
        'progression',
        91,
        ARRAY['complexity', 'decision_demand', 'load']::TEXT[],
        'Adding a predictable rebound and controlled catch preserves stance and projection while adding tracking and absorption demand.',
        '{"requiresPredictableReturn":true,"requiresSafeCatch":true,"humanReviewRequired":true}'::JSONB
      ),
      (
        'tall-kneeling-rebound-catch',
        'tall-kneeling-throw-only',
        'regression',
        91,
        ARRAY['complexity', 'decision_demand', 'load']::TEXT[],
        'Removing the required catch preserves tall-kneeling projection while reducing return tracking and absorption demand.',
        '{"returnContract":"throw_only","humanReviewRequired":true}'::JSONB
      ),
      (
        'tall-kneeling-throw-only',
        'half-kneeling-throw-only',
        'progression',
        89,
        ARRAY['stability', 'complexity']::TEXT[],
        'Moving to half kneeling preserves throw-only projection while adding an asymmetric base, lead-leg declaration, and anti-rotation demand.',
        '{"requiresStableHalfKneeling":true,"balanceSides":true,"humanReviewRequired":true}'::JSONB
      ),
      (
        'half-kneeling-throw-only',
        'tall-kneeling-throw-only',
        'regression',
        89,
        ARRAY['stability', 'complexity']::TEXT[],
        'Tall kneeling restores a symmetric base while preserving throw-only horizontal projection.',
        '{"stance":"tall_kneeling","humanReviewRequired":true}'::JSONB
      ),
      (
        'half-kneeling-throw-only',
        'half-kneeling-rebound-catch',
        'progression',
        91,
        ARRAY['complexity', 'decision_demand', 'load']::TEXT[],
        'Adding a predictable rebound and controlled catch preserves half-kneeling projection while adding tracking and absorption demand.',
        '{"requiresPredictableReturn":true,"requiresSafeCatch":true,"humanReviewRequired":true}'::JSONB
      ),
      (
        'half-kneeling-rebound-catch',
        'half-kneeling-throw-only',
        'regression',
        91,
        ARRAY['complexity', 'decision_demand', 'load']::TEXT[],
        'Removing the required catch preserves half-kneeling projection while reducing return tracking and absorption demand.',
        '{"returnContract":"throw_only","humanReviewRequired":true}'::JSONB
      )
  ) AS edge(
    from_variant_key,
    to_variant_key,
    relationship,
    similarity_score,
    dimensions,
    reason,
    conditions_json
  )
  JOIN coaching.exercise_variant_v1 source_variant
    ON source_variant.definition_id = target_definition_id
   AND source_variant.variant_key = edge.from_variant_key
   AND source_variant.status <> 'archived'
  JOIN coaching.exercise_variant_v1 target_variant
    ON target_variant.definition_id = target_definition_id
   AND target_variant.variant_key = edge.to_variant_key
   AND target_variant.status <> 'archived'
  ON CONFLICT (from_variant_id, to_variant_id, relationship) DO UPDATE SET
    similarity_score = EXCLUDED.similarity_score,
    dimensions = EXCLUDED.dimensions,
    reason = EXCLUDED.reason,
    conditions_json = EXCLUDED.conditions_json,
    review_status = 'review',
    reviewed_by = NULL,
    reviewed_at = NULL,
    updated_at = now();

  INSERT INTO coaching.exercise_score_calibration_v1 (
    facility_id,
    variant_id,
    dimension,
    proposed_score,
    anchor_tier,
    rationale,
    status,
    version,
    reviewed_by,
    review_notes,
    reviewed_at
  )
  SELECT
    facility,
    variant.id,
    calibration.dimension,
    CASE calibration.dimension
      WHEN 'technicalComplexity'
        THEN (variant.difficulty_json->>'technicalComplexity')::INTEGER
      WHEN 'absoluteLoadDemand'
        THEN (variant.difficulty_json->>'absoluteLoadDemand')::INTEGER
      ELSE (variant.difficulty_json->>'baseOverallDifficulty')::INTEGER
    END,
    40,
    CASE calibration.dimension
      WHEN 'technicalComplexity' THEN
        'Candidate complexity reflects stance symmetry, lead-leg control, target release, and the declared rebound-and-catch contract; independent anchor review is still required.'
      WHEN 'absoluteLoadDemand' THEN
        'Candidate physical difficulty reflects ballistic ball projection, posture demand, and return absorption when prescribed; ball mass and population calibration remain unresolved.'
      ELSE
        'Candidate overall difficulty is derived exactly as the maximum of exercise complexity and physical difficulty; independent calibration remains required.'
    END,
    'review',
    1,
    NULL,
    'Research-backed candidate only; no reviewer or approval has been assigned.',
    NULL
  FROM coaching.exercise_variant_v1 variant
  CROSS JOIN (
    VALUES
      ('technicalComplexity'),
      ('absoluteLoadDemand'),
      ('baseOverallDifficulty')
  ) AS calibration(dimension)
  WHERE variant.definition_id = target_definition_id
    AND variant.status <> 'archived'
  ON CONFLICT (facility_id, variant_id, dimension, version) DO UPDATE SET
    proposed_score = EXCLUDED.proposed_score,
    anchor_tier = EXCLUDED.anchor_tier,
    rationale = EXCLUDED.rationale,
    status = 'review',
    reviewed_by = NULL,
    review_notes = EXCLUDED.review_notes,
    reviewed_at = NULL,
    updated_at = now();

  CREATE TEMP TABLE kneeling_chest_source_seed (
    source_key TEXT PRIMARY KEY,
    source_url TEXT NOT NULL,
    source_title TEXT NOT NULL,
    source_publisher TEXT NOT NULL,
    source_kind TEXT NOT NULL,
    evidence_quality INTEGER NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO kneeling_chest_source_seed VALUES
    (
      'nsca_tall_kneeling_medicine_ball_chest_throw',
      'https://www.nsca.com/globalassets/education/ptq/ptq-7.3--updated.pdf',
      'NSCA Performance Training Quarterly 7.3',
      'National Strength and Conditioning Association',
      'professional_standard',
      82
    ),
    (
      'upper_body_plyometric_meta_analysis',
      'https://pubmed.ncbi.nlm.nih.gov/37833510/',
      'Effects of Upper-Body Plyometric Training on Physical Fitness in Healthy Youth and Young Adult Participants: A Systematic Review with Meta-Analysis',
      'Sports Medicine - Open',
      'peer_reviewed_research',
      91
    ),
    (
      'medicine_ball_velocity_reliability',
      'https://pubmed.ncbi.nlm.nih.gov/22744301/',
      'Reliability of seated and standing throwing velocity using differently weighted medicine balls',
      'Journal of Strength and Conditioning Research',
      'peer_reviewed_research',
      81
    ),
    (
      'medicine_ball_power_fatigue',
      'https://pubmed.ncbi.nlm.nih.gov/41460695/',
      'Validation of a Supine Upper-Body Power Test in Physically Active Male and Female Adults Using a Medicine Ball With Accelerometer',
      'Journal of Strength and Conditioning Research',
      'peer_reviewed_research',
      82
    ),
    (
      'ace_medicine_ball_ift_workout',
      'https://www.acefitness.org/continuing-education/certified/june-2019/7306/medicine-balls-an-ace-integrated-fitness-training-reg-model-workout/',
      'Medicine Balls: An ACE Integrated Fitness Training Model Workout',
      'American Council on Exercise',
      'expert_instruction',
      78
    ),
    (
      'ace_kneeling_power_ball_pass',
      'https://www.acefitness.org/resources/pros/expert-articles/7396/plyometric-training-for-active-agers/',
      'Plyometric Training for Active Agers',
      'American Council on Exercise',
      'expert_instruction',
      72
    ),
    (
      'youtube_embed_help',
      'https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en',
      'Embed videos and playlists',
      'YouTube Help',
      'manufacturer_instruction',
      82
    );

  CREATE TEMP TABLE kneeling_chest_evidence_seed (
    section_key TEXT PRIMARY KEY,
    source_key TEXT NOT NULL,
    claims_json JSONB NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO kneeling_chest_evidence_seed VALUES
    (
      'identity',
      'nsca_tall_kneeling_medicine_ball_chest_throw',
      '[
        "The NSCA source explicitly names a tall-kneeling medicine-ball chest throw, while two generic legacy sources do not resolve stance.",
        "The stable identity is a two-hand horizontal kneeling chest pass; stance and return behavior are exact variants, and stance-unspecified legacy provenance remains nonselectable."
      ]'::JSONB
    ),
    (
      'taxonomy',
      'upper_body_plyometric_meta_analysis',
      '[
        "Medicine-ball throws are upper-body plyometric tasks used for rapid propulsive force.",
        "Use controlled push and brace patterns; horizontal projection, stance, target, rebound, and catch behavior remain explicit qualifiers."
      ]'::JSONB
    ),
    (
      'anatomy',
      'upper_body_plyometric_meta_analysis',
      '[
        "The chest pass combines rapid shoulder horizontal adduction or flexion, elbow extension, and scapular protraction over a stable trunk and pelvis.",
        "Muscles, joints, stabilizers, actions, planes, and laterality are documented without claiming isolated-muscle training."
      ]'::JSONB
    ),
    (
      'biomechanics',
      'medicine_ball_velocity_reliability',
      '[
        "Throw technique and medicine-ball mass affect measured release velocity and must be standardized for comparison.",
        "Observable mechanics include the exact kneeling base, chest start, coordinated two-hand projection, complete release, target, and declared return absorption."
      ]'::JSONB
    ),
    (
      'difficulty',
      'medicine_ball_velocity_reliability',
      '[
        "Ball mass and technique change physical and coordination demands.",
        "Each exact variant receives independent exercise-complexity and physical-difficulty candidates, and overall difficulty equals their maximum; approval is not inferred."
      ]'::JSONB
    ),
    (
      'load_fatigue_recovery',
      'medicine_ball_power_fatigue',
      '[
        "Standardized release velocity can expose performance decline during medicine-ball work.",
        "Accumulate ballistic repetitions, pressing and throwing load, anterior shoulder and elbow stress, trunk stabilization, and prescribed catch absorption with related work."
      ]'::JSONB
    ),
    (
      'constraints',
      'ace_medicine_ball_ift_workout',
      '[
        "Medicine balls differ in construction and rebound behavior, changing whether a return can be caught safely.",
        "Declare ball, wall or partner, target, distance, return path, surface, traffic boundary, lighting, and coach sightline."
      ]'::JSONB
    ),
    (
      'dosage',
      'upper_body_plyometric_meta_analysis',
      '[
        "Published upper-body plyometric prescriptions vary widely and do not establish one exact individual dose.",
        "Use short output sets with generous rest or light-ball technique sets, and terminate on release, target, posture, or catch decline."
      ]'::JSONB
    ),
    (
      'instructions',
      'ace_kneeling_power_ball_pass',
      '[
        "ACE presents a kneeling power-ball pass as low-impact upper-body plyometric work and emphasizes a controllable ball.",
        "Establish the declared base, brace, start at the chest, drive through both hands, finish to the target, and complete the declared reset or catch."
      ]'::JSONB
    ),
    (
      'safety_stop_rules',
      'ace_medicine_ball_ift_workout',
      '[
        "A returning medicine ball transfers energy to the athlete and requires controlled absorption.",
        "Stop for symptoms, balance loss, trunk compensation, wild release, unsafe equipment or return, missed catch, face-height return, lane intrusion, or material output decline."
      ]'::JSONB
    ),
    (
      'programming',
      'nsca_tall_kneeling_medicine_ball_chest_throw',
      '[
        "The NSCA source places a tall-kneeling chest throw in a power-oriented contrast pairing.",
        "Use this family as freshness-sensitive output or movement-learning work rather than hidden fatigue conditioning."
      ]'::JSONB
    ),
    (
      'athlete_support',
      'ace_kneeling_power_ball_pass',
      '[
        "Athlete support displays stance, lead leg, ball, target, distance, return contract, primary cue, and stop signal.",
        "Accessible regressions avoid status language and never assign a proficiency level to the exercise card."
      ]'::JSONB
    ),
    (
      'coach_support',
      'medicine_ball_velocity_reliability',
      '[
        "Meaningful comparison requires standardized technique and ball mass.",
        "Coach support records exact variant, ball, target, distance, return behavior, dose, rest, output, errors, fatigue, and station controls."
      ]'::JSONB
    ),
    (
      'accessibility',
      'ace_kneeling_power_ball_pass',
      '[
        "The ball should be light enough to preserve control and intended range.",
        "Use lighter or softer balls, larger targets, throw-only delivery, tall kneeling, seated separate exercise, fewer repetitions, longer resets, plain text, and non-video instruction as needed."
      ]'::JSONB
    ),
    (
      'alternates',
      'nsca_tall_kneeling_medicine_ball_chest_throw',
      '[
        "Tall and half kneeling and throw-only versus rebound-and-catch are exact variants of the same two-hand horizontal chest-pass identity.",
        "Seated, supine, standing, rotational, unilateral shot-put, and overhead throws remain separate definitions."
      ]'::JSONB
    ),
    (
      'media',
      'youtube_embed_help',
      '[
        "YouTube supports privacy-enhanced embedding through youtube-nocookie.com.",
        "Current oEmbed health is a link check only; full viewing, exact variant match, safety, captions, accessibility, reviewer identity, and approval remain unresolved."
      ]'::JSONB
    );

  INSERT INTO coaching.exercise_section_evidence_v1 (
    definition_id,
    reviewed_card_version,
    section_key,
    source_url,
    source_title,
    source_publisher,
    source_kind,
    claims_json,
    evidence_quality,
    review_status,
    reviewer_user_id,
    reviewed_at
  )
  SELECT
    target_definition_id,
    target_card_version,
    evidence.section_key,
    source.source_url,
    source.source_title,
    source.source_publisher,
    source.source_kind,
    evidence.claims_json,
    source.evidence_quality,
    'candidate',
    NULL,
    NULL
  FROM kneeling_chest_evidence_seed evidence
  JOIN kneeling_chest_source_seed source
    ON source.source_key = evidence.source_key
  ON CONFLICT (
    definition_id,
    reviewed_card_version,
    section_key,
    source_url
  ) DO UPDATE SET
    source_title = EXCLUDED.source_title,
    source_publisher = EXCLUDED.source_publisher,
    source_kind = EXCLUDED.source_kind,
    claims_json = EXCLUDED.claims_json,
    evidence_quality = EXCLUDED.evidence_quality,
    review_status = 'candidate',
    reviewer_user_id = NULL,
    reviewed_at = NULL,
    updated_at = now();

  UPDATE coaching.exercise_media_candidate_v1
  SET review_status = 'superseded',
      updated_at = now()
  WHERE definition_id = target_definition_id
    AND reviewed_card_version <> target_card_version
    AND review_status = 'candidate';

  INSERT INTO coaching.exercise_media_candidate_v1 (
    definition_id,
    variant_id,
    reviewed_card_version,
    url,
    embed_url,
    video_id,
    title,
    channel_name,
    embedding_allowed,
    exact_variant_match,
    demonstration_quality_score,
    link_status,
    review_status,
    discovery_method,
    source_query,
    reviewer_user_id,
    reviewed_at,
    notes
  )
  SELECT
    target_definition_id,
    NULL,
    target_card_version,
    media.url,
    'https://www.youtube-nocookie.com/embed/' || media.video_id,
    media.video_id,
    media.title,
    media.channel_name,
    TRUE,
    NULL,
    NULL,
    'healthy',
    'candidate',
    'legacy_import',
    'Legacy candidate rechecked through current YouTube oEmbed',
    NULL,
    NULL,
    media.notes
  FROM (
    VALUES
      (
        'cQ3pZhIBPHI',
        'https://www.youtube.com/watch?v=cQ3pZhIBPHI',
        'Tall-Kneeling Medicine Ball Chest Pass',
        'Viking Strength Systems',
        'Current oEmbed response is healthy. Full viewing, exact return contract, ball behavior, instruction quality, safety, captions, accessibility, reviewer identity, and approval remain pending.'
      ),
      (
        'HNPRmN3vJUU',
        'https://www.youtube.com/watch?v=HNPRmN3vJUU',
        'Half-Kneeling Medicine Ball Chest Pass',
        'Performance Unlimited',
        'Current oEmbed response is healthy. Full viewing, exact lead-leg and return contract, ball behavior, instruction quality, safety, captions, accessibility, reviewer identity, and approval remain pending.'
      ),
      (
        'hq4twzUZgMY',
        'https://www.youtube.com/watch?v=hq4twzUZgMY',
        'Kneeling Medicine Ball Chest Pass',
        'Jordan Weber Fitness',
        'Current oEmbed response is healthy, but the title does not resolve stance. Full viewing, exact variant match, safety, captions, accessibility, reviewer identity, and approval remain pending.'
      ),
      (
        '-PPPJd2d65c',
        'https://www.youtube.com/watch?v=-PPPJd2d65c',
        'Tall-Kneeling Medicine Ball Chest Pass',
        'Nicole Delegas',
        'Current oEmbed response is healthy. Full viewing, exact return contract, ball behavior, instruction quality, safety, captions, accessibility, reviewer identity, and approval remain pending.'
      ),
      (
        'w84FxjgNlU0',
        'https://www.youtube.com/watch?v=w84FxjgNlU0',
        'Full-Kneeling Medicine Ball Chest Pass',
        'Performance Unlimited',
        'Current oEmbed response is healthy. Full kneeling may mean tall kneeling but must be confirmed by viewing; exact variant, safety, captions, accessibility, reviewer identity, and approval remain pending.'
      )
  ) AS media(video_id, url, title, channel_name, notes)
  ON CONFLICT (definition_id, reviewed_card_version, video_id) DO UPDATE SET
    url = EXCLUDED.url,
    embed_url = EXCLUDED.embed_url,
    title = EXCLUDED.title,
    channel_name = EXCLUDED.channel_name,
    embedding_allowed = TRUE,
    exact_variant_match = NULL,
    demonstration_quality_score = NULL,
    link_status = 'healthy',
    review_status = 'candidate',
    discovery_method = EXCLUDED.discovery_method,
    source_query = EXCLUDED.source_query,
    reviewer_user_id = NULL,
    reviewed_at = NULL,
    notes = EXCLUDED.notes,
    updated_at = now();

  INSERT INTO coaching.exercise_alternate_assessment_v1 (
    definition_id,
    reviewed_card_version,
    alternate_name,
    classification,
    rationale,
    distinguishing_dimensions,
    proposed_card_json,
    review_status,
    reviewer_user_id,
    reviewed_at
  )
  SELECT
    target_definition_id,
    target_card_version,
    alternate.alternate_name,
    alternate.classification,
    alternate.rationale,
    alternate.dimensions,
    NULL,
    'candidate',
    NULL,
    NULL
  FROM (
    VALUES
      (
        'Tall-Kneeling Medicine Ball Chest Pass',
        'same_identity',
        'The same two-hand horizontal chest-pass identity is performed from an explicitly tall-kneeling base.',
        '{"stance":"tall_kneeling","identityDisposition":"exact_variant"}'::JSONB
      ),
      (
        'Tall-Kneeling Chest Pass to Wall',
        'same_identity',
        'The same chest-pass identity uses tall kneeling and a declared wall-return contract.',
        '{"stance":"tall_kneeling","target":"wall","returnContract":"rebound_and_catch"}'::JSONB
      ),
      (
        'Half-Kneeling Chest Pass to Wall',
        'same_identity',
        'The same chest-pass identity uses half kneeling and a declared wall-return contract.',
        '{"stance":"half_kneeling","target":"wall","returnContract":"rebound_and_catch"}'::JSONB
      ),
      (
        'Half-Kneeling Medicine Ball Chest Pass',
        'new_variant',
        'Half kneeling preserves the throw identity but changes base symmetry, lead-leg declaration, pelvic stability, and anti-rotation demand.',
        '{"stance":"half_kneeling","leadLeg":"declared_and_balanced"}'::JSONB
      ),
      (
        'Full-Kneeling Medicine Ball Chest Pass',
        'same_identity',
        'Full kneeling is a tall-kneeling alias only when the hips are extended; source or media interpretation remains review-gated.',
        '{"aliasCandidate":"tall_kneeling","humanReviewRequired":true}'::JSONB
      ),
      (
        'Partner Kneeling Medicine Ball Chest Pass',
        'modifier_annotation',
        'A trained partner changes target and return logistics without changing exact stance or projection when the catch contract is unchanged.',
        '{"target":"trained_partner","operations":"partner_timing_and_lane_control"}'::JSONB
      ),
      (
        'Seated Medicine Ball Chest Pass',
        'new_definition',
        'Seated support changes the base, hip and knee posture, trunk contribution, setup, and population constraints.',
        '{"startPosition":"seated","base":"supported"}'::JSONB
      ),
      (
        'Supine Medicine Ball Chest Throw',
        'new_definition',
        'Supine projection changes gravity orientation, release direction, support surface, catch risk, and primary task mechanics.',
        '{"bodyPosition":"supine","projection":"vertical"}'::JSONB
      ),
      (
        'Standing Medicine Ball Chest Pass',
        'new_definition',
        'Standing permits lower-body force contribution and changes balance, force transfer, and setup constraints.',
        '{"startPosition":"standing","lowerBodyContribution":"permitted"}'::JSONB
      ),
      (
        'Rotational Medicine Ball Chest Pass',
        'new_definition',
        'Rotation changes the primary movement pattern, plane emphasis, laterality, target direction, and training stimulus.',
        '{"movementPattern":"rotation","projection":"transverse_rotational"}'::JSONB
      ),
      (
        'Single-Arm Medicine Ball Shot Put',
        'new_definition',
        'Unilateral shot-put mechanics change implement position, arm action, trunk contribution, laterality, and release path.',
        '{"armUse":"unilateral","releasePattern":"shot_put"}'::JSONB
      ),
      (
        'Kneeling Medicine Ball Overhead Throw',
        'new_definition',
        'Overhead projection changes shoulder action, release direction, trunk strategy, target, and primary training stimulus.',
        '{"projection":"overhead","primaryJointAction":"shoulder_flexion"}'::JSONB
      )
  ) AS alternate(
    alternate_name,
    classification,
    rationale,
    dimensions
  )
  ON CONFLICT (
    definition_id,
    reviewed_card_version,
    alternate_name
  ) DO UPDATE SET
    classification = EXCLUDED.classification,
    rationale = EXCLUDED.rationale,
    distinguishing_dimensions = EXCLUDED.distinguishing_dimensions,
    proposed_card_json = NULL,
    review_status = 'candidate',
    reviewer_user_id = NULL,
    reviewed_at = NULL,
    updated_at = now();

  UPDATE coaching.exercise_difficulty_profile difficulty
  SET technical = CASE difficulty.exercise_id
        WHEN 1157 THEN 3.4
        WHEN 1302 THEN 4.2
        WHEN 1303 THEN 4.8
        ELSE difficulty.technical
      END,
      load = CASE difficulty.exercise_id
        WHEN 1157 THEN 3.8
        WHEN 1302 THEN 4.2
        WHEN 1303 THEN 4.2
        ELSE difficulty.load
      END,
      overall = CASE difficulty.exercise_id
        WHEN 1157 THEN 3.8
        WHEN 1302 THEN 4.2
        WHEN 1303 THEN 4.8
        ELSE difficulty.overall
      END,
      notes = CASE difficulty.exercise_id
        WHEN 735 THEN
          'Legacy stance and return contract are unspecified; retain 4/10 candidate values as quarantined provenance only.'
        WHEN 1319 THEN
          'Legacy stance and return contract are unspecified; retain 4/10 candidate values as quarantined provenance only.'
        ELSE
          'Candidate reassessment separates exercise complexity and physical difficulty; independent calibration remains required.'
      END,
      updated_at = now()
  WHERE difficulty.exercise_id IN (735, 1157, 1302, 1303, 1319);

  UPDATE coaching.exercise_score_v1 score
  SET technical_complexity = CASE score.exercise_id
        WHEN 1157 THEN 34
        WHEN 1302 THEN 42
        WHEN 1303 THEN 48
        ELSE score.technical_complexity
      END,
      absolute_load_demand = CASE score.exercise_id
        WHEN 1157 THEN 38
        WHEN 1302 THEN 42
        WHEN 1303 THEN 42
        ELSE score.absolute_load_demand
      END,
      coordination_demand = CASE score.exercise_id
        WHEN 1157 THEN 38
        WHEN 1302 THEN 48
        WHEN 1303 THEN 56
        ELSE score.coordination_demand
      END,
      impact = 8,
      supervision_demand = CASE score.exercise_id
        WHEN 1157 THEN 44
        WHEN 1302 THEN 56
        WHEN 1303 THEN 60
        ELSE 52
      END,
      base_overall_difficulty = CASE score.exercise_id
        WHEN 1157 THEN 38
        WHEN 1302 THEN 42
        WHEN 1303 THEN 48
        ELSE score.base_overall_difficulty
      END,
      legacy_scores = score.legacy_scores || jsonb_build_object(
        'candidateReassessment', migration_key,
        'difficultyModel', 'max_exercise_complexity_physical_difficulty',
        'sourceIdentity', CASE score.exercise_id
          WHEN 1157 THEN 'tall_kneeling_throw_only'
          WHEN 1302 THEN 'tall_kneeling_rebound_catch'
          WHEN 1303 THEN 'half_kneeling_rebound_catch'
          ELSE 'stance_and_return_contract_unspecified'
        END,
        'identityQuarantined', score.exercise_id IN (735, 1319),
        'independentCalibrationRequired', TRUE
      ),
      migration_confidence = CASE score.exercise_id
        WHEN 735 THEN 46
        WHEN 1319 THEN 46
        ELSE 64
      END,
      human_review_status = 'queued',
      reviewed_by = NULL,
      reviewed_at = NULL,
      review_notes =
        'Research-backed candidate reassessment only; independent human calibration remains required.',
      updated_at = now()
  WHERE score.exercise_id IN (735, 1157, 1302, 1303, 1319);

  UPDATE coaching.exercise legacy
  SET skill_level = NULL,
      why_publish_ready = FALSE,
      description = CASE legacy.id
        WHEN 735 THEN
          'Legacy kneeling two-hand medicine-ball chest-pass source; stance and return behavior are unspecified and this source is not selectable as an exact variant.'
        WHEN 1319 THEN
          'Legacy kneeling two-hand medicine-ball chest-pass source; stance and return behavior are unspecified and this source is not selectable as an exact variant.'
        WHEN 1157 THEN
          'Throw a medicine ball horizontally from the chest with two hands while maintaining a tall-kneeling base; this legacy source does not declare a required catch.'
        WHEN 1302 THEN
          'Throw a predictable rebound medicine ball from the chest with two hands while tall kneeling, then track and absorb the controlled return from an inspected wall.'
        ELSE
          'Throw a predictable rebound medicine ball from the chest with two hands while half kneeling, then track and absorb the controlled return from an inspected wall.'
      END,
      instructions = CASE legacy.id
        WHEN 735 THEN
          'Archived provenance only: the stored source does not identify tall versus half kneeling or throw-only versus catch delivery. Use an exact canonical variant.'
        WHEN 1319 THEN
          'Archived provenance only: the stored source does not identify tall versus half kneeling or throw-only versus catch delivery. Use an exact canonical variant.'
        WHEN 1157 THEN
          'Tall kneel on a clear non-slip surface. Brace, hold the declared ball at the chest, project it horizontally with both hands to the target, then retrieve only after the lane is clear.'
        WHEN 1302 THEN
          'Tall kneel at a declared distance from an inspected wall. Brace, project the declared rebound ball from the chest with both hands, see the return early, catch away from the face, absorb, and reset.'
        ELSE
          'Half kneel with the lead leg declared. Brace, project the declared rebound ball from the chest with both hands, see the return early, catch away from the face without rotating or losing balance, and reset.'
      END,
      card_summary = CASE legacy.id
        WHEN 735 THEN 'Stance-unspecified legacy provenance; use an exact canonical kneeling chest-pass variant.'
        WHEN 1319 THEN 'Stance-unspecified legacy provenance; use an exact canonical kneeling chest-pass variant.'
        WHEN 1157 THEN 'Tall-kneeling, two-hand horizontal medicine-ball chest pass with no required catch.'
        WHEN 1302 THEN 'Tall-kneeling, two-hand wall chest pass with a predictable rebound and controlled catch.'
        ELSE 'Half-kneeling, two-hand wall chest pass with a predictable rebound and controlled catch.'
      END,
      movement_family = 'kneeling_medicine_ball_horizontal_chest_pass',
      primary_phase_key = 'output',
      phase_subrole = 'upper_body_ballistic_power',
      primary_order_slot = 'freshness_sensitive_output',
      scalable_variables = ARRAY[
        'stance',
        'lead_leg',
        'return_contract',
        'ball_mass',
        'ball_type',
        'distance',
        'target_height',
        'sets',
        'repetitions',
        'rest'
      ]::TEXT[],
      movement_requirements = jsonb_build_object(
        'stance', CASE legacy.id
          WHEN 1157 THEN 'tall_kneeling'
          WHEN 1302 THEN 'tall_kneeling'
          WHEN 1303 THEN 'half_kneeling'
          ELSE 'unspecified_legacy_provenance'
        END,
        'return_contract', CASE legacy.id
          WHEN 1302 THEN 'rebound_and_controlled_catch'
          WHEN 1303 THEN 'rebound_and_controlled_catch'
          WHEN 1157 THEN 'throw_only_no_required_catch'
          ELSE 'unspecified_legacy_provenance'
        END,
        'projection', 'two_hand_horizontal_from_chest',
        'selectable_exact_variant', legacy.id NOT IN (735, 1319),
        'ball_and_target_must_be_declared', TRUE
      ),
      coaching_execution = jsonb_build_object(
        'setup', jsonb_build_array(
          'Declare exact stance, lead leg when relevant, ball mass and rebound type, target, distance, and return contract.',
          'Inspect the kneeling surface, ball, wall or partner, flight lane, return path, lighting, and traffic boundary.',
          'Confirm pain-free base, light-ball target release, and safe catch readiness when prescribed.'
        ),
        'quality_gate', jsonb_build_array(
          'Declared kneeling base remains stable.',
          'Ball starts at chest and leaves both hands together.',
          'Release reaches target without material trunk extension or rotation.',
          'Declared reset or catch is safe and repeatable.'
        ),
        'stop_signs', jsonb_build_array(
          'Pain, numbness, dizziness, or instability',
          'Damaged ball or unsafe wall, partner, target, lane, or surface',
          'Balance loss, wild release, target loss, or material speed decline',
          'Unexpected return, face-height return, or missed or unsafe catch'
        )
      ),
      programming_logic = jsonb_build_object(
        'difficulty_model', 'max_exercise_complexity_physical_difficulty',
        'identity_rule', 'select_exact_stance_and_return_contract',
        'fatigue_rule', 'place_before_material_pressing_throwing_or_shoulder_fatigue',
        'substitution_rule', 'never_silently_change_stance_return_contract_or_projection',
        'generic_source_rule', 'stance_unspecified_sources_are_nonselectable'
      ),
      updated_at = now()
  WHERE legacy.id IN (735, 1157, 1302, 1303, 1319);

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
    target_definition_id,
    facility,
    target_card_version,
    'canonical-card-audit-v1',
    'quarantined',
    jsonb_build_object(
      'identityMigration', '317_coaching_kneeling_chest_pass_identity_consolidation',
      'completenessMigration', migration_key,
      'researchBatch', 'kneeling-medicine-ball-chest-pass-family-v1',
      'difficultyFormula', 'max_exercise_complexity_physical_difficulty',
      'exerciseDifficultyDimensions', jsonb_build_array(
        'exercise_complexity',
        'physical_difficulty'
      ),
      'proficiencyClassificationScope', 'coaching_skill_library_only',
      'genericLegacySourcesSelectable', FALSE,
      'auditRerunRequired', TRUE
    ),
    jsonb_build_array(
      jsonb_build_object(
        'code', 'CARD-CALIBRATION-01',
        'category', 'calibration',
        'message', 'Independent score-anchor review remains required for all four exact variants.'
      ),
      jsonb_build_object(
        'code', 'CARD-GRAPH-03',
        'category', 'relationship_graph',
        'message', 'Progression and regression edges remain review-only.'
      ),
      jsonb_build_object(
        'code', 'CARD-MEDIA-01',
        'category', 'media',
        'message', 'Exact-match full-video, safety, caption, accessibility, and approval review remains required.'
      ),
      jsonb_build_object(
        'code', 'CARD-PUBLISH-01',
        'category', 'publication',
        'message', 'Independent content and publication review remains required.'
      )
    ),
    TRUE
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
