-- Complete the candidate-only forward and backward overhead medicine-ball
-- projection cards after migration 336 records their identity boundary.
--
-- Forward projection and backward projection remain separate definitions.
-- Countermovement, foot contacts, target or landing sector, ball mass, and
-- measurement are exact variant or delivery dimensions. Exercise difficulty
-- is exercise complexity plus physical difficulty, with overall derived as
-- their maximum. Exercise cards receive no skill or proficiency level.
-- Evidence, media, graph, calibration, and publication remain review-only.
-- IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '337_coaching_overhead_medicine_ball_projection_family_completion';
  forward_definition_id UUID;
  backward_definition_id UUID;
  target_ids UUID[];
  facility BIGINT;
  protected_records INTEGER;
  unexpected_variants INTEGER;
BEGIN
  SELECT id, facility_id
  INTO forward_definition_id, facility
  FROM coaching.exercise_definition_v1
  WHERE slug = 'medicine-ball-overhead-throw'
    AND status <> 'archived';

  SELECT id
  INTO backward_definition_id
  FROM coaching.exercise_definition_v1
  WHERE slug = 'medicine-ball-overhead-back-throw'
    AND facility_id = facility
    AND status <> 'archived';

  IF forward_definition_id IS NULL OR backward_definition_id IS NULL THEN
    RAISE EXCEPTION
      'Overhead medicine-ball completion requires active forward and backward definitions in one facility';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM coaching.exercise_identity_resolution_v1 resolution
    WHERE (
      (
        resolution.survivor_definition_id = forward_definition_id
        AND resolution.resolved_definition_id = backward_definition_id
      )
      OR (
        resolution.survivor_definition_id = backward_definition_id
        AND resolution.resolved_definition_id = forward_definition_id
      )
    )
      AND resolution.decision = 'distinct_exercises'
  ) THEN
    RAISE EXCEPTION
      'Overhead medicine-ball completion requires migration 336 identity boundary first';
  END IF;

  target_ids := ARRAY[forward_definition_id, backward_definition_id];

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
      'Overhead medicine-ball completion refused to override % protected records',
      protected_records;
  END IF;

  SELECT COUNT(*)
  INTO unexpected_variants
  FROM coaching.exercise_variant_v1
  WHERE definition_id = ANY(target_ids)
    AND status <> 'archived'
    AND variant_key NOT IN (
      'baseline',
      'stationary-forward-distance',
      'step-through-forward-wall-throw-only',
      'countermovement-backward-distance',
      'no-countermovement-backward-distance'
    );

  IF unexpected_variants > 0 THEN
    RAISE EXCEPTION
      'Overhead medicine-ball completion found % unexpected active variants',
      unexpected_variants;
  END IF;

  UPDATE coaching.exercise_variant_v1
  SET variant_key = CASE definition_id
        WHEN forward_definition_id
          THEN 'legacy-generic-forward-overhead-source-1155'
        ELSE 'legacy-generic-backward-overhead-source-1154'
      END,
      status = 'archived',
      requirements_json = requirements_json || jsonb_build_object(
        'selectable', FALSE,
        'identityQuarantine', TRUE,
        'quarantineReason',
          'The generic source does not fully declare direction, ball start and mass, countermovement, foot contacts, target or landing sector, release, retrieval, measurement, dose, or stop contract.'
      ),
      updated_at = now()
  WHERE definition_id = ANY(target_ids)
    AND variant_key = 'baseline';

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET status = 'archived',
      updated_at = now()
  FROM coaching.exercise_variant_v1 variant
  WHERE variant.id = profile.variant_id
    AND variant.definition_id = ANY(target_ids)
    AND variant.status = 'archived';

  CREATE TEMP TABLE overhead_throw_definition_seed (
    slug TEXT PRIMARY KEY,
    canonical_name TEXT NOT NULL,
    family_key TEXT NOT NULL,
    aliases TEXT[] NOT NULL,
    direction TEXT NOT NULL,
    start_contract TEXT NOT NULL,
    target_contract TEXT NOT NULL,
    description TEXT NOT NULL,
    primary_phase TEXT NOT NULL,
    primary_order_slot TEXT NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO overhead_throw_definition_seed VALUES
    (
      'medicine-ball-overhead-throw',
      'Forward Overhead Medicine-Ball Throw',
      'forward_overhead_medicine_ball_projection',
      ARRAY[
        'Medicine Ball Overhead Throw',
        'Forward Overhead Medicine Ball Throw',
        'Standing Overhead Medicine Ball Throw',
        'Overhead Medicine-Ball Throw Forward'
      ]::TEXT[],
      'forward',
      'declared_stationary_or_step_through_start_with_ball_overhead_or_behind_head',
      'visible_forward_open_distance_lane_or_inspected_wall',
      'From a declared stable stance, hold one exact medicine ball with two hands, establish the exact stationary or step-through start, coordinate the declared lower-body preload with trunk and overhead arm action, and release the ball forward toward a visible open-distance lane or inspected wall. Finish with declared foot contacts, regain balance, wait for the lane to clear, retrieve safely, and fully reset.',
      'output',
      'forward_overhead_medicine_ball_projection'
    ),
    (
      'medicine-ball-overhead-back-throw',
      'Backward Overhead Medicine-Ball Throw',
      'backward_overhead_medicine_ball_projection',
      ARRAY[
        'Medicine Ball Overhead Back Throw',
        'Backward Overhead Medicine Ball Throw',
        'Medicine Ball Throw Overhead Backward',
        'Overhead Backward Medicine-Ball Throw'
      ]::TEXT[],
      'backward_overhead',
      'ball_in_front_with_declared_countermovement_or_static_preload',
      'closed_inspected_backward_landing_sector',
      'Face away from a closed, inspected landing sector and hold one exact medicine ball with two hands in front. Use the declared countermovement or static preload, extend through the hips, knees, and ankles, and release the ball backward over the head without turning into the throw. Finish with declared contacts, regain balance, wait for the sector-clear signal, then retrieve safely and fully reset.',
      'output',
      'backward_overhead_medicine_ball_projection'
    );

  UPDATE coaching.exercise_definition_v1 definition
  SET card_version = CASE
        WHEN definition.provenance_json->>'structuralCompletionMigration'
          IS DISTINCT FROM migration_key
          THEN definition.card_version + 1
        ELSE definition.card_version
      END,
      canonical_name = seed.canonical_name,
      display_name = seed.canonical_name,
      aliases = seed.aliases,
      description = seed.description,
      family_key = seed.family_key,
      movement_patterns = ARRAY['hinge', 'push', 'brace']::TEXT[],
      body_regions = ARRAY[
        'shoulder', 'scapula', 'elbow', 'wrist', 'hand',
        'core', 'spine', 'pelvis', 'hip', 'knee', 'ankle', 'foot'
      ]::TEXT[],
      required_equipment = ARRAY['medicine_ball']::TEXT[],
      optional_equipment = ARRAY[
        'wall', 'line_tape', 'cones', 'timer'
      ]::TEXT[],
      environment_json = jsonb_build_object(
        'surface',
          'level_high_traction_surface_suitable_for_declared_foot_contacts',
        'station',
          'exclusive_throw_finish_retrieval_and_reset_zone',
        'overheadClearance',
          'ball_arm_and_release_path_clear_of_ceiling_people_and_objects',
        'ball',
          'declared_exact_type_mass_diameter_rebound_behavior_condition_and_marking',
        'direction', seed.direction,
        'targetOrLandingSector', seed.target_contract,
        'traffic',
          'one_active_thrower_with_people_and_loose_equipment_outside_throw_rebound_landing_and_retrieval_paths',
        'lighting',
          'start_contacts_ball_path_finish_target_or_sector_and_retrieval_route_visible_to_coach',
        'coachSightline',
          'side_or_front_oblique_outside_throw_rebound_landing_and_retrieval_paths',
        'shutdownControl',
          'coach_can_stop_entry_throw_retrieval_and_adjacent_activity_immediately'
      ),
      population_json = jsonb_build_object(
        'readiness', jsonb_build_array(
          'pain_free_standing_balance_and_declared_countermovement',
          'pain_free_two_hand_overhead_range_and_ball_release',
          'can_control_declared_foot_contacts_finish_and_retrieval',
          'can_follow_direction_target_sector_load_attempt_rest_and_stop_instructions',
          'can_wait_for_explicit_lane_or_sector_clear_signal'
        ),
        'contraindicationFlags', jsonb_build_array(
          'current_head_neck_shoulder_back_elbow_wrist_hand_hip_knee_ankle_or_foot_pain',
          'numbness_dizziness_pressure_symptoms_or_uncontrolled_breath_holding',
          'unsafe_ball_surface_overhead_clearance_target_wall_sector_traffic_or_retrieval_route',
          'uncontrolled_spinal_extension_balance_release_or_foot_contacts',
          'unassessed_recent_injury_surgery_pregnancy_postpartum_or_rehabilitation_restriction'
        ),
        'supervision',
          'Direct observation and exclusive lane control until setup, direction, ball handling, preload, force transfer, release, contacts, balance, sector discipline, retrieval, and stop response are repeatable.',
        'selectionBoundary',
          'Select exact direction, ball, mass, stance, preload, countermovement, contacts, target or sector, release, repetitions, rest, retrieval, and measurement from current control; exercise cards do not carry skill levels.',
        'clinicalBoundary',
          'Pain, neurologic signs, pressure symptoms, recent injury or surgery, pregnancy/postpartum concerns, or rehabilitation restrictions require individualized qualified guidance.'
      ),
      anatomy_json = jsonb_build_object(
        'primaryMuscles', jsonb_build_array(
          'gluteus_maximus', 'quadriceps', 'hamstrings',
          'gastrocnemius_and_soleus', 'deltoid',
          'triceps_brachii', 'serratus_anterior'
        ),
        'secondaryMuscles', jsonb_build_array(
          'trapezius', 'rotator_cuff', 'latissimus_dorsi',
          'abdominal_wall_and_obliques', 'spinal_stabilizers',
          'forearm_and_hand_grip'
        ),
        'joints', jsonb_build_array(
          'hip', 'knee', 'ankle', 'spine',
          'glenohumeral', 'scapulothoracic', 'elbow', 'wrist', 'hand'
        ),
        'jointActions', jsonb_build_array(
          'hip_and_knee_flexion_to_extension',
          'ankle_plantarflexion',
          'shoulder_flexion',
          'scapular_upward_rotation_and_protraction',
          'elbow_extension',
          'wrist_and_hand_release',
          'trunk_force_transfer_with_anti_extension_control'
        ),
        'planes', jsonb_build_array(
          'sagittal', 'multiplanar_stabilization'
        ),
        'laterality', 'bilateral',
        'kineticChain',
          'ground_up_total_body_force_transfer_to_two_hand_ball_release',
        'identityBoundary',
          'projection_direction_start_orientation_target_or_landing_sector_and_ordered_contacts'
      ),
      athlete_support_json = jsonb_build_object(
        'plainLanguage',
          CASE seed.direction
            WHEN 'forward'
              THEN 'Know the ball, target, contacts, and stop signal. Load only as declared, drive and throw forward, finish balanced, wait, retrieve, and reset.'
            ELSE 'Know the ball, closed sector, contacts, and stop signal. Load only as declared, drive tall and throw backward overhead, finish balanced, wait for clear, retrieve, and reset.'
          END,
        'beforeAttempt', jsonb_build_array(
          'Confirm direction, ball type and mass, stance, preload, contacts, target or sector, repetitions, rest, retrieval, measurement, and stop signal.',
          'Report pain, numbness, dizziness, pressure symptoms, apprehension, poor footing, ball damage, or any occupied path.'
        ),
        'selfChecks', jsonb_build_array(
          'start_and_ball_match_the_displayed_variant',
          'target_or_sector_and_retrieval_route_are_clear',
          'overhead_motion_and_preload_are_pain_free',
          'finish_and_contacts_can_be_controlled',
          'next_attempt_begins_only_after_full_reset_and_clear_signal'
        ),
        'accessibilityOptions', jsonb_build_array(
          'lighter_or_softer_ball', 'smaller_countermovement',
          'stationary_no_jump_contacts', 'fewer_attempts', 'longer_rest',
          'high_contrast_target_or_sector_markers',
          'plain_language_text_images_or_qualified_live_demonstration',
          'reviewed_non_overhead_or_more_supported_substitute'
        ),
        'mediaAlternative',
          'Written sequence, contact diagram, target or sector diagram, and qualified live demonstration remain available until an exact video is independently approved.'
      ),
      coach_support_json = jsonb_build_object(
        'preBrief', jsonb_build_array(
          'Declare direction, exact variant, ball, mass, stance, preload, contacts, target or sector, attempt count, rest, retrieval, metric, invalid-attempt rule, and stop signal.',
          'Inspect ball, surface, overhead clearance, wall when used, sector, lane, lighting, markers, retrieval route, and adjacent traffic.'
        ),
        'observationPoints', jsonb_build_array(
          'start_position_and_ball_control', 'countermovement_or_static_preload',
          'hip_knee_ankle_extension_and_trunk_control',
          'overhead_path_release_direction_and_angle',
          'foot_contacts_finish_and_balance',
          'target_or_landing_sector_discipline',
          'output_loss_symptoms_retrieval_and_reset'
        ),
        'correctionHierarchy', jsonb_build_array(
          'stop_for_symptoms_or_environment_failure',
          'restore_direction_target_or_sector_and_contact_contract',
          'reduce_ball_mass_or_countermovement',
          'reduce_attempts_and_increase_rest',
          'use_reviewed_simpler_or_non_overhead_substitute'
        ),
        'groupManagement',
          'Use one active thrower per exclusive lane, physical boundaries, a single release command, one retrieval signal, separate waiting and equipment zones, and immediate lane shutdown authority.',
        'demonstrationStandard',
          'Show declared direction, start, preload, contacts, target or sector, release, finish, wait, retrieval, reset, invalid attempt, and stop response from visible angles.'
      ),
      support_operations_json = jsonb_build_object(
        'issueCategories', jsonb_build_array(
          'identity_or_variant_mismatch', 'ball_or_equipment',
          'target_wall_sector_or_traffic', 'dose_or_measurement',
          'symptom_or_safety', 'media_or_accessibility',
          'relationship_or_substitution', 'data_or_rendering'
        ),
        'requiredIssueContext', jsonb_build_array(
          'card_slug', 'card_version', 'variant_key', 'profile_key',
          'direction', 'ball_type_and_mass', 'stance', 'preload',
          'foot_contacts', 'target_or_sector', 'dose', 'rest',
          'surface', 'symptoms', 'stop_reason', 'device_and_rendering_mode'
        ),
        'escalation',
          'Stop the lane first, preserve the exact setup and event record, quarantine identity, safety, media, or scoring defects, and route clinical symptoms to qualified care.',
        'retention',
          'Retain source, version, proposed scores, media metadata, alternate decisions, test packet, substitution, stop reason, and review state without converting candidate evidence into approval.',
        'changeImpact',
          'Direction, start, contacts, ball, target or sector, release, dose, stop, score, media, or graph changes invalidate dependent review and require a new card version.'
      ),
      content_confidence = 86,
      scoring_confidence = 72,
      media_confidence = 35,
      approved_video_url = NULL,
      status = 'review',
      reviewed_by = NULL,
      approved_by = NULL,
      last_reviewed_at = NULL,
      provenance_json = definition.provenance_json || jsonb_build_object(
        'structuralCompletionMigration', migration_key,
        'researchVersion', '2026-07-26.41',
        'researchBatch',
          'scripts/data/canonical-research/batches/overhead-medicine-ball-projection-family.v1.json',
        'projectionDirection', seed.direction,
        'identityBoundaryMigration',
          '336_coaching_high_similarity_identity_boundaries',
        'difficultyModel',
          'max_exercise_complexity_physical_difficulty',
        'proficiencyClassificationScope',
          'coaching_skill_library_only',
        'candidateEvidenceOnly', TRUE,
        'humanReviewRequired', TRUE,
        'mediaReviewRequired', TRUE,
        'calibrationReviewRequired', TRUE,
        'relationshipReviewRequired', TRUE,
        'publicationQuarantined', TRUE
      ),
      updated_at = now()
  FROM overhead_throw_definition_seed seed
  WHERE definition.slug = seed.slug
    AND definition.id = ANY(target_ids);

  CREATE TEMP TABLE overhead_throw_variant_seed (
    slug TEXT NOT NULL,
    variant_key TEXT NOT NULL,
    display_name TEXT NOT NULL,
    direction TEXT NOT NULL,
    preload TEXT NOT NULL,
    contacts TEXT NOT NULL,
    target_contract TEXT NOT NULL,
    exercise_complexity INTEGER NOT NULL,
    physical_difficulty INTEGER NOT NULL,
    coordination_demand INTEGER NOT NULL,
    supervision_demand INTEGER NOT NULL,
    failure_consequence INTEGER NOT NULL,
    impact INTEGER NOT NULL,
    work_capacity_demand INTEGER NOT NULL,
    grip_demand INTEGER NOT NULL,
    spinal_loading INTEGER NOT NULL,
    eccentric_stress INTEGER NOT NULL,
    local_muscle_fatigue INTEGER NOT NULL,
    grip_fatigue INTEGER NOT NULL,
    technical_fatigue_sensitivity INTEGER NOT NULL,
    impact_accumulation INTEGER NOT NULL,
    recovery_hours INTEGER NOT NULL,
    equipment_required TEXT[] NOT NULL,
    PRIMARY KEY (slug, variant_key)
  ) ON COMMIT DROP;

  INSERT INTO overhead_throw_variant_seed VALUES
    (
      'medicine-ball-overhead-throw',
      'stationary-forward-distance',
      'Forward Overhead Medicine-Ball Throw — Stationary Distance',
      'forward',
      'declared_countermovement',
      'feet_start_behind_line_no_deliberate_step_before_release_declared_post_release_balance_contacts',
      'visible_open_forward_distance_lane',
      48, 42, 56, 56, 54, 12, 34,
      34, 36, 24, 46, 30, 72, 12, 36,
      ARRAY['medicine_ball', 'line_tape', 'cones']::TEXT[]
    ),
    (
      'medicine-ball-overhead-throw',
      'step-through-forward-wall-throw-only',
      'Forward Overhead Medicine-Ball Throw — Step-Through to Wall',
      'forward',
      'declared_countermovement_and_one_step_through',
      'one_declared_step_through_no_athlete_rebound_catch',
      'inspected_wall_with_clear_rebound_and_retrieval_zone',
      54, 44, 62, 64, 62, 10, 38,
      36, 36, 24, 48, 32, 76, 10, 36,
      ARRAY['medicine_ball', 'wall', 'line_tape']::TEXT[]
    ),
    (
      'medicine-ball-overhead-back-throw',
      'countermovement-backward-distance',
      'Backward Overhead Medicine-Ball Throw — Countermovement Distance',
      'backward_overhead',
      'declared_countermovement',
      'declared_takeoff_and_landing_rule_with_no_turn_into_release',
      'closed_inspected_backward_landing_sector',
      50, 54, 60, 72, 68, 18, 42,
      36, 42, 28, 54, 32, 80, 18, 48,
      ARRAY['medicine_ball', 'line_tape', 'cones']::TEXT[]
    ),
    (
      'medicine-ball-overhead-back-throw',
      'no-countermovement-backward-distance',
      'Backward Overhead Medicine-Ball Throw — No Countermovement Distance',
      'backward_overhead',
      'static_preload_no_countermovement',
      'feet_start_behind_line_declared_post_release_balance_contacts_no_turn_into_release',
      'closed_inspected_backward_landing_sector',
      48, 50, 56, 70, 66, 14, 38,
      36, 40, 24, 50, 30, 76, 14, 48,
      ARRAY['medicine_ball', 'line_tape', 'cones']::TEXT[]
    );

  INSERT INTO coaching.exercise_variant_v1 (
    definition_id, variant_key, display_name, modifier_keys,
    difficulty_json, requirements_json, load_profile_json,
    fatigue_profile_json, programming_profile_json, status
  )
  SELECT
    definition.id,
    seed.variant_key,
    seed.display_name,
    ARRAY[
      'medicine_ball', 'bilateral_two_hand',
      seed.direction, seed.preload, seed.contacts,
      seed.target_contract, 'overhead_release'
    ]::TEXT[],
    jsonb_build_object(
      'exerciseComplexity', seed.exercise_complexity,
      'technicalComplexity', seed.exercise_complexity,
      'physicalDifficulty', seed.physical_difficulty,
      'absoluteLoadDemand', seed.physical_difficulty,
      'coordinationDemand', seed.coordination_demand,
      'supervisionDemand', seed.supervision_demand,
      'failureConsequence', seed.failure_consequence,
      'impact', seed.impact,
      'workCapacityDemand', seed.work_capacity_demand,
      'baseOverallDifficulty',
        greatest(seed.exercise_complexity, seed.physical_difficulty),
      'overallFormula',
        'max_exercise_complexity_physical_difficulty'
    ),
    jsonb_build_object(
      'direction', seed.direction,
      'stance',
        'declared_stable_bilateral_start_on_level_high_traction_surface',
      'ball', 'one_exact_declared_medicine_ball',
      'ballMass', 'declared_and_held_constant_for_comparison',
      'preload', seed.preload,
      'footContacts', seed.contacts,
      'targetOrLandingSector', seed.target_contract,
      'release', 'complete_two_hand_overhead_release_in_declared_direction',
      'catchContract',
        CASE
          WHEN seed.variant_key = 'step-through-forward-wall-throw-only'
            THEN 'throw_only_no_athlete_rebound_catch'
          ELSE 'no_catch_retrieve_only_after_clear_signal'
        END,
      'retrieval',
        'wait_for_explicit_clear_signal_then_use_declared_route',
      'measurement',
        CASE
          WHEN seed.variant_key LIKE '%distance'
            THEN 'optional_standardized_first_contact_distance'
          ELSE 'optional_target_location_and_release_quality'
        END,
      'selectable', TRUE,
      'identityQuarantine', FALSE
    ),
    jsonb_build_object(
      'gripDemand', seed.grip_demand,
      'spinalLoading', seed.spinal_loading,
      'eccentricStress', seed.eccentric_stress,
      'landingContactsPerRep',
        CASE WHEN seed.impact >= 18 THEN 1 ELSE 0 END,
      'externalLoadMethod', 'declared_medicine_ball_mass',
      'loadingType',
        'ballistic_total_body_projection_with_complete_release',
      'impactClass',
        CASE WHEN seed.impact >= 18
          THEN 'declared_takeoff_and_landing'
          ELSE 'low_contact_throw'
        END,
      'primaryStress', jsonb_build_array(
        'rapid_hip_knee_and_ankle_extension',
        'overhead_shoulder_and_elbow_acceleration',
        'trunk_force_transfer_and_anti_extension_control',
        'two_hand_grip_and_release',
        'declared_finish_contacts_and_balance'
      )
    ),
    jsonb_build_object(
      'localMuscleFatigue', seed.local_muscle_fatigue,
      'gripFatigue', seed.grip_fatigue,
      'technicalFatigueSensitivity',
        seed.technical_fatigue_sensitivity,
      'impactAccumulation', seed.impact_accumulation,
      'recoveryHours', seed.recovery_hours,
      'cumulativeBudgets', jsonb_build_array(
        'high_intent_total_body_ballistic_throws',
        'overhead_shoulder_and_elbow_exposure',
        'posterior_chain_and_triple_extension_output',
        'trunk_force_transfer',
        'landing_contacts_when_permitted',
        'technical_and_release_direction_sensitivity'
      ),
      'fatigueSignals', jsonb_build_array(
        'release_speed_or_distance_loss',
        'direction_or_target_error',
        'countermovement_or_contact_change',
        'spinal_extension_or_balance_loss',
        'grip_or_release_timing_change',
        'unsafe_retrieval_or_delayed_stop_response'
      )
    ),
    jsonb_build_object(
      'trainingStimuli', jsonb_build_array(
        'total_body_ballistic_power',
        'ground_up_force_transfer',
        'overhead_projection_speed',
        'direction_specific_release_control'
      ),
      'stimulusDose', jsonb_build_object(
        'primaryUnit', 'quality_attempts',
        'variables', jsonb_build_array(
          'ball_mass', 'countermovement', 'contacts',
          'target_or_distance', 'attempts', 'rest'
        )
      ),
      'weeklyExposure', jsonb_build_object(
        'typical', 'one_to_three_quality_exposures',
        'minimumRecoveryHours', seed.recovery_hours
      ),
      'prerequisites', jsonb_build_array(
        'pain_free_overhead_range_and_declared_preload',
        'controlled_finish_and_contacts',
        'safe_ball_handling_and_release',
        'reliable_lane_sector_and_stop_signal_behavior'
      ),
      'completionCriteria', jsonb_build_array(
        'declared_quality_attempts_completed',
        'direction_contacts_and_safety_contract_held',
        'output_and_technique_above_declared_loss_threshold',
        'safe_wait_retrieval_and_reset_completed'
      ),
      'sequenceRules', jsonb_build_array(
        'after_general_access_and_submaximal_pattern_rehearsal',
        'before_material_throw_jump_sprint_strength_or_conditioning_fatigue',
        'early_in_output_or_assessment_block'
      ),
      'pairingCompatibility', jsonb_build_array(
        'low_fatigue_mobility', 'noncompeting_strength',
        'reviewed_jump_or_sprint_contrast_with_separate_budgets'
      ),
      'interferenceRules', jsonb_build_array(
        'avoid_after_high_volume_overhead_press_or_throw_work',
        'avoid_when_landing_or_posterior_chain_budget_is_exceeded',
        'do_not_pair_with_shared_uncontrolled_ball_or_lane_traffic'
      ),
      'uncertaintyPolicy',
        'When identity, direction, symptoms, ball, contacts, target, sector, traffic, or fatigue are uncertain, stop and select a reviewed lower-risk substitute.',
      'primaryPhase', 'output',
      'secondaryPhase', 'movement_intelligence',
      'difficultyModel',
        'max_exercise_complexity_physical_difficulty',
      'proficiencyClassification', NULL
    ),
    'review'
  FROM overhead_throw_variant_seed seed
  JOIN coaching.exercise_definition_v1 definition
    ON definition.slug = seed.slug
   AND definition.id = ANY(target_ids)
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

  INSERT INTO coaching.exercise_delivery_profile_v1 (
    variant_id, profile_key, phase_key, role, purpose,
    phase_suitability, methodology_alignment, objective_relevance_json,
    dosage_json, quality_gate, stop_rules, coach_instructions,
    athlete_instructions, expected_adaptation, equipment_required,
    logistics_json, substitution_ids, time_model_json, dose_scaling_json,
    measurement_json, support_prompts_json, status
  )
  SELECT
    variant.id,
    profile.profile_key,
    profile.phase_key,
    profile.role,
    CASE profile.profile_key
      WHEN 'output-power'
        THEN 'Express repeatable direction-specific total-body medicine-ball power with exact ball, preload, contacts, target or sector, release, rest, retrieval, and output-loss contracts.'
      ELSE
        'Rehearse the exact direction, preload, contacts, overhead release, finish, lane discipline, retrieval, and stop response with conservative ball mass and submaximal intent.'
    END,
    CASE profile.profile_key WHEN 'output-power' THEN 94 ELSE 84 END,
    CASE profile.profile_key WHEN 'output-power' THEN 94 ELSE 88 END,
    jsonb_build_object(
      'totalBodyBallisticPower',
        CASE profile.profile_key WHEN 'output-power' THEN 98 ELSE 70 END,
      'directionAndReleaseControl',
        CASE profile.profile_key WHEN 'movement-learning' THEN 96 ELSE 86 END,
      'safeLaneAndRetrievalBehavior', 94,
      'fatigueConditioning', 4
    ),
    jsonb_build_object(
      'sets', CASE profile.profile_key WHEN 'output-power' THEN '3-5' ELSE '2-4' END,
      'attemptsPerSet',
        CASE profile.profile_key WHEN 'output-power' THEN '2-4' ELSE '2-3' END,
      'restSeconds',
        CASE profile.profile_key WHEN 'output-power' THEN '120-300' ELSE '60-180' END,
      'intent',
        CASE profile.profile_key
          WHEN 'output-power'
            THEN 'maximal_only_while_output_direction_and_all_quality_gates_hold'
          ELSE 'submaximal_to_high_with_sequence_and_safety_priority'
        END,
      'direction', seed.direction,
      'ballMass', 'declared_and_constant',
      'preload', seed.preload,
      'footContacts', seed.contacts,
      'targetOrSector', seed.target_contract,
      'reset',
        'wait_for_clear_signal_retrieve_by_declared_route_return_ball_and_fully_reset'
    ),
    'The exact variant is used; ball, mass, stance, direction, preload, contacts, target or sector, release, finish, balance, output, wait, retrieval, and reset remain within the declared contract.',
    ARRAY[
      'Stop for pain, numbness, dizziness, pressure symptoms, apprehension, or uncontrolled breath holding.',
      'Stop for ball damage, poor footing, overhead obstruction, unsafe wall, occupied target or landing sector, traffic, marker, lighting, or retrieval failure.',
      'Stop for uncontrolled spinal extension, balance loss, direction error, early or late release, unexpected contacts, turn into the backward throw, or inability to obey the stop signal.',
      'Stop when release speed, distance, target accuracy, technique, contacts, finish, recovery, or readiness materially declines; never add fatigue attempts.'
    ]::TEXT[],
    'Declare exact direction, variant, ball, mass, stance, preload, contacts, target or sector, attempts, rest, retrieval, measurement, invalid-attempt rule, and stop signal. Observe force transfer, trunk, overhead path, release, contacts, finish, output, lane discipline, retrieval, and symptoms.',
    CASE seed.direction
      WHEN 'forward'
        THEN 'Set the ball and target, load as declared, drive and throw forward, finish balanced, wait, retrieve, reset.'
      ELSE 'Set the ball and closed sector, load as declared, drive tall and throw backward overhead, finish balanced, wait for clear, retrieve, reset.'
    END,
    CASE profile.profile_key
      WHEN 'output-power'
        THEN 'Greater repeatable total-body ballistic output and direction-specific overhead projection with standardized measurement.'
      ELSE
        'More reliable start, preload, release, contacts, balance, lane discipline, retrieval, and stop behavior.'
    END,
    seed.equipment_required,
    jsonb_build_object(
      'surface',
        'level_high_traction_surface_suitable_for_declared_contacts',
      'participants', 'one_active_thrower_per_exclusive_lane',
      'setupSeconds',
        CASE WHEN seed.target_contract LIKE '%wall%' THEN 90 ELSE 120 END,
      'transitionSeconds', 30,
      'ballInspection',
        'before_session_after_any_hard_impact_and_after_any_visible_change',
      'targetOrSector', seed.target_contract,
      'retrievalRoute', 'declared_clear_and_one_way',
      'waitingZone', 'outside_throw_rebound_landing_and_retrieval_paths',
      'coachPosition',
        'outside_ball_path_with_start_finish_target_or_sector_and_traffic_visible'
    ),
    ARRAY[]::UUID[],
    jsonb_build_object(
      'attemptSeconds', 5,
      'resetAndRetrievalSeconds',
        CASE WHEN seed.target_contract LIKE '%wall%' THEN 20 ELSE 45 END,
      'setDurationFormula',
        'attempts_x_attempt_plus_reset_and_retrieval_time',
      'setupSeconds',
        CASE WHEN seed.target_contract LIKE '%wall%' THEN 90 ELSE 120 END,
      'durationIncludesSetup', TRUE
    ),
    jsonb_build_object(
      'regressFirst', jsonb_build_array(
        'reduce_ball_mass', 'reduce_countermovement',
        'remove_step_or_takeoff', 'reduce_attempts',
        'increase_rest', 'use_reviewed_simpler_or_non_overhead_substitute'
      ),
      'progressOneVariableAtATime', jsonb_build_array(
        'intent', 'ball_mass', 'countermovement',
        'contacts', 'target_or_distance'
      ),
      'symptomRule',
        'stop_and_select_reviewed_pain_free_lower_risk_substitute'
    ),
    jsonb_build_object(
      'required', jsonb_build_array(
        'variant', 'direction', 'ball_type', 'ball_mass',
        'stance', 'preload', 'foot_contacts', 'target_or_sector',
        'attempts', 'rest', 'valid_attempts', 'invalid_reason',
        'output_or_accuracy', 'stop_reason'
      ),
      'optional', jsonb_build_array(
        'release_velocity', 'first_contact_distance',
        'target_error', 'release_angle', 'contact_error',
        'technique_error', 'rate_of_perceived_effort'
      ),
      'comparisonRule',
        'Compare only when direction, exact variant, ball, mass, stance, preload, contacts, target or sector, surface, retrieval, measurement, and invalid-attempt method match.'
    ),
    jsonb_build_object(
      'athleteBeforeSet', jsonb_build_array(
        'Confirm direction, ball, mass, stance, preload, contacts, target or sector, attempts, rest, retrieval, measurement, and stop signal.',
        'Report symptoms, ball damage, footing, path, target, sector, traffic, or visibility concerns.'
      ),
      'coachDuringSet', jsonb_build_array(
        'Watch start, preload, force transfer, trunk, overhead path, release, contacts, finish, output, lane discipline, symptoms, retrieval, and reset.',
        'Stop the lane immediately on any symptom, identity, ball, surface, overhead, wall, sector, traffic, contact, release, output, or behavior trigger.'
      ),
      'afterSet', jsonb_build_array(
        'Record exact setup, valid attempts, output or accuracy, technical errors, symptoms, stop reason, and substitutions.',
        'Do not add load, range, counter-movement, contacts, or attempts after a stop trigger.'
      ),
      'supportEscalation',
        'Escalate symptoms, ball or environment failure, identity mismatch, unsafe behavior, or inaccessible instruction through the documented support path.',
      'mediaFallback',
        'Use the written sequence, diagrams, and qualified live demonstration until an exact video is independently approved.'
    ),
    'review'
  FROM overhead_throw_variant_seed seed
  JOIN coaching.exercise_definition_v1 definition
    ON definition.slug = seed.slug
   AND definition.id = ANY(target_ids)
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id = definition.id
   AND variant.variant_key = seed.variant_key
   AND variant.status <> 'archived'
  CROSS JOIN (
    VALUES
      ('output-power', 'output', 'primary'),
      ('movement-learning', 'movement_intelligence', 'secondary')
  ) AS profile(profile_key, phase_key, role)
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
    from_variant_id, to_variant_id, relationship, similarity_score,
    dimensions, reason, conditions_json, review_status,
    created_by, reviewed_by, reviewed_at
  )
  SELECT
    from_variant.id,
    to_variant.id,
    edge.relationship,
    edge.similarity_score,
    edge.dimensions,
    edge.reason,
    edge.conditions,
    'review',
    NULL,
    NULL,
    NULL
  FROM (
    VALUES
      (
        'medicine-ball-overhead-throw',
        'stationary-forward-distance',
        'medicine-ball-overhead-throw',
        'step-through-forward-wall-throw-only',
        'progression', 78, ARRAY['complexity', 'speed']::TEXT[],
        'A declared step-through and wall target add sequencing, forward momentum, rebound-zone logistics, and contact control while retaining forward overhead projection.',
        '{"sameDirection":true,"noAthleteCatch":true,"humanReviewRequired":true}'::JSONB
      ),
      (
        'medicine-ball-overhead-throw',
        'step-through-forward-wall-throw-only',
        'medicine-ball-overhead-throw',
        'stationary-forward-distance',
        'regression', 78, ARRAY['complexity', 'speed']::TEXT[],
        'Removing the step and wall return simplifies contacts and rebound logistics while retaining a forward overhead release into an open distance lane.',
        '{"sameDirection":true,"openLaneRequired":true,"humanReviewRequired":true}'::JSONB
      ),
      (
        'medicine-ball-overhead-back-throw',
        'no-countermovement-backward-distance',
        'medicine-ball-overhead-back-throw',
        'countermovement-backward-distance',
        'progression', 84, ARRAY['complexity', 'speed', 'impact']::TEXT[],
        'Adding a countermovement and declared takeoff or landing rule increases elastic contribution, output, contact, timing, and fatigue demand while retaining backward overhead projection.',
        '{"sameDirection":true,"closedSectorRequired":true,"humanReviewRequired":true}'::JSONB
      ),
      (
        'medicine-ball-overhead-back-throw',
        'countermovement-backward-distance',
        'medicine-ball-overhead-back-throw',
        'no-countermovement-backward-distance',
        'regression', 84, ARRAY['complexity', 'speed', 'impact']::TEXT[],
        'A static no-countermovement start reduces movement amplitude and contact demand while preserving the closed-sector backward overhead release.',
        '{"sameDirection":true,"closedSectorRequired":true,"humanReviewRequired":true}'::JSONB
      ),
      (
        'medicine-ball-overhead-throw',
        'stationary-forward-distance',
        'medicine-ball-overhead-back-throw',
        'countermovement-backward-distance',
        'lateral_substitution', 62, ARRAY['complexity', 'impact']::TEXT[],
        'Both are bilateral overhead ballistic projections, but opposite direction, visual control, contacts, target or sector, retrieval, and safety require a new exact prescription.',
        '{"directionMustBeRewritten":true,"sectorControlRequired":true,"humanReviewRequired":true}'::JSONB
      ),
      (
        'medicine-ball-overhead-back-throw',
        'countermovement-backward-distance',
        'medicine-ball-overhead-throw',
        'stationary-forward-distance',
        'lateral_substitution', 62, ARRAY['complexity', 'impact']::TEXT[],
        'A forward distance throw can substitute for backward projection only after direction, target, contacts, visual control, retrieval, dose, and output metric are explicitly changed.',
        '{"directionMustBeRewritten":true,"forwardLaneRequired":true,"humanReviewRequired":true}'::JSONB
      )
  ) AS edge(
    from_slug, from_key, to_slug, to_key, relationship,
    similarity_score, dimensions, reason, conditions
  )
  JOIN coaching.exercise_definition_v1 from_definition
    ON from_definition.slug = edge.from_slug
   AND from_definition.id = ANY(target_ids)
  JOIN coaching.exercise_variant_v1 from_variant
    ON from_variant.definition_id = from_definition.id
   AND from_variant.variant_key = edge.from_key
   AND from_variant.status <> 'archived'
  JOIN coaching.exercise_definition_v1 to_definition
    ON to_definition.slug = edge.to_slug
   AND to_definition.id = ANY(target_ids)
  JOIN coaching.exercise_variant_v1 to_variant
    ON to_variant.definition_id = to_definition.id
   AND to_variant.variant_key = edge.to_key
   AND to_variant.status <> 'archived'
  ON CONFLICT (from_variant_id, to_variant_id, relationship) DO UPDATE SET
    similarity_score = EXCLUDED.similarity_score,
    dimensions = EXCLUDED.dimensions,
    reason = EXCLUDED.reason,
    conditions_json = EXCLUDED.conditions_json,
    review_status = 'review',
    created_by = NULL,
    reviewed_by = NULL,
    reviewed_at = NULL,
    updated_at = now();

  INSERT INTO coaching.exercise_score_calibration_v1 (
    facility_id, variant_id, dimension, proposed_score, anchor_tier,
    rationale, status, version, created_by, reviewed_by,
    review_notes, reviewed_at
  )
  SELECT
    facility,
    variant.id,
    score.dimension,
    score.proposed_score,
    CASE
      WHEN score.proposed_score < 30 THEN 20
      WHEN score.proposed_score < 50 THEN 40
      WHEN score.proposed_score < 70 THEN 60
      ELSE 80
    END,
    score.rationale,
    'review',
    1,
    NULL,
    NULL,
    'Candidate calibration proposal only; independent coach review and representative field evidence remain required.',
    NULL
  FROM overhead_throw_variant_seed seed
  JOIN coaching.exercise_definition_v1 definition
    ON definition.slug = seed.slug
   AND definition.id = ANY(target_ids)
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id = definition.id
   AND variant.variant_key = seed.variant_key
   AND variant.status <> 'archived'
  CROSS JOIN LATERAL (
    VALUES
      (
        'technicalComplexity',
        seed.exercise_complexity,
        'Proposed exercise-complexity score reflects declared preload, contacts, direction, release, target or sector, balance, retrieval, and stop-response sequencing.'
      ),
      (
        'baseOverallDifficulty',
        greatest(seed.exercise_complexity, seed.physical_difficulty),
        'Proposed overall difficulty is mechanically derived as the maximum of exercise complexity and physical difficulty, not from an athlete skill level.'
      ),
      (
        'failureConsequence',
        seed.failure_consequence,
        'Proposed failure-consequence score reflects uncontrolled ball release, overhead path, contact, wall or landing-sector, traffic, and retrieval hazards.'
      ),
      (
        'impact',
        greatest(seed.impact, 1),
        'Proposed impact score reflects the exact takeoff, landing, and foot-contact contract rather than medicine-ball mass alone.'
      )
  ) AS score(dimension, proposed_score, rationale)
  ON CONFLICT (facility_id, variant_id, dimension, version) DO UPDATE SET
    proposed_score = EXCLUDED.proposed_score,
    anchor_tier = EXCLUDED.anchor_tier,
    rationale = EXCLUDED.rationale,
    status = 'review',
    created_by = NULL,
    reviewed_by = NULL,
    review_notes = EXCLUDED.review_notes,
    reviewed_at = NULL,
    updated_at = now();

  CREATE TEMP TABLE overhead_throw_source_seed (
    source_key TEXT PRIMARY KEY,
    source_url TEXT NOT NULL,
    source_title TEXT NOT NULL,
    source_publisher TEXT NOT NULL,
    source_kind TEXT NOT NULL,
    evidence_quality INTEGER NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO overhead_throw_source_seed VALUES
    (
      'ace_forward',
      'https://www.acefitness.org/resources/everyone/exercise-library/178/overhead-medicine-ball-throws/',
      'Overhead Medicine Ball Throws',
      'American Council on Exercise',
      'professional_standard',
      80
    ),
    (
      'functional_backward',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC3658404/',
      'Functional Performance Testing for Power and Return to Sports',
      'Sports Health',
      'peer_reviewed_research',
      88
    ),
    (
      'forward_backward_protocols',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC8157825/',
      'Factorial Structure of Motor Abilities and Skills in Different Age Groups of Elite Female Soccer Players',
      'International Journal of Environmental Research and Public Health',
      'peer_reviewed_research',
      84
    ),
    (
      'load_velocity',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC3761701/',
      'Load-Velocity Relationship in the Overhead Medicine Ball Throw',
      'Journal of Sports Science & Medicine',
      'peer_reviewed_research',
      87
    ),
    (
      'backward_reliability',
      'https://pubmed.ncbi.nlm.nih.gov/16095399/',
      'Validity and Reliability of a Medicine Ball Explosive Power Test',
      'Journal of Strength and Conditioning Research',
      'peer_reviewed_research',
      87
    ),
    (
      'standing_reliability',
      'https://pubmed.ncbi.nlm.nih.gov/22744301/',
      'Reliability of Different Methods of Assessing Standing Overhead Medicine Ball Throw Performance',
      'Journal of Strength and Conditioning Research',
      'peer_reviewed_research',
      86
    ),
    (
      'nsca_toss',
      'https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-7.3.pdf',
      'Creating Power: Alternative Bilateral and Nilateral Triple Extension Exercises',
      'National Strength and Conditioning Association',
      'professional_standard',
      86
    ),
    (
      'youtube_embed',
      'https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en',
      'Embed videos and playlists',
      'YouTube Help',
      'manufacturer_instruction',
      82
    );

  CREATE TEMP TABLE overhead_throw_evidence_seed (
    section_key TEXT PRIMARY KEY,
    source_key TEXT NOT NULL,
    claims_json JSONB NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO overhead_throw_evidence_seed VALUES
    (
      'identity', 'forward_backward_protocols',
      '["Forward and backward medicine-ball throws are defined as separate protocols.","Projection direction, start orientation, target or landing sector, visual control, contacts, and retrieval create separate identities."]'::JSONB
    ),
    (
      'taxonomy', 'nsca_toss',
      '["The overhead toss uses rapid hip, knee, and ankle extension to initiate a high overhead release.","Declare bilateral two-hand projection, exact direction, preload, contacts, and target or sector."]'::JSONB
    ),
    (
      'anatomy', 'functional_backward',
      '["The backward protocol uses hip and knee flexion followed by forceful total-body extension and an overhead release.","Declare lower-limb, trunk, shoulder, scapular, elbow, wrist, and hand roles without isolated-muscle claims."]'::JSONB
    ),
    (
      'biomechanics', 'load_velocity',
      '["Medicine-ball mass changes release velocity in a two-hand overhead throw.","Standardize mass and observe preload, force transfer, release direction, angle, contacts, and balance."]'::JSONB
    ),
    (
      'difficulty', 'load_velocity',
      '["Ball mass changes physical demand and release velocity.","Assess exercise complexity and physical difficulty independently and derive overall as their maximum; no athlete skill level belongs on the exercise card."]'::JSONB
    ),
    (
      'load_fatigue_recovery', 'standing_reliability',
      '["Standing overhead throw comparison depends on a standardized protocol and measurement.","Track high-intent attempts, mass, output loss, tissue response, contacts, technical fatigue, and cumulative ballistic exposure."]'::JSONB
    ),
    (
      'constraints', 'ace_forward',
      '["A forward overhead throw may use a partner or wall target.","Declare ball, wall or open sector, overhead clearance, traction, spacing, traffic, retrieval, lighting, and coach sightline."]'::JSONB
    ),
    (
      'dosage', 'nsca_toss',
      '["Explosive triple-extension work is placed early with low repetitions and substantial rest.","Use short quality-first sets and stop before release speed, direction, posture, contacts, or retrieval behavior declines."]'::JSONB
    ),
    (
      'instructions', 'ace_forward',
      '["Forward overhead throw instruction sequences a controlled start, lower-body drive, overhead arm action, and forward release.","Name direction, target or sector, ball start, preload, contacts, release, finish, retrieval, reset, and stop signal."]'::JSONB
    ),
    (
      'safety_stop_rules', 'functional_backward',
      '["Backward release sends the ball into a sector the thrower cannot continuously see.","Stop for symptoms, environment failure, uncontrolled extension, mistimed release, unexpected contacts, occupied sector, or material output loss."]'::JSONB
    ),
    (
      'programming', 'backward_reliability',
      '["Backward overhead distance is used as an explosive-power field test.","Use freshness-sensitive power or standardized assessment delivery, not generic fatigue conditioning."]'::JSONB
    ),
    (
      'athlete_support', 'ace_forward',
      '["Display direction, target or sector, ball, contacts, primary cue, reset, and stop signal before the first throw.","Offer load, preload, contact, attempt, rest, target, instruction, and substitution accessibility options without exercise proficiency labels."]'::JSONB
    ),
    (
      'coach_support', 'standing_reliability',
      '["Reliable comparison requires consistent ball mass, start conditions, technique, and measurement.","Expose direction, variant, ball, target or sector, contacts, dose, output, observation, invalid-attempt, retrieval, and shutdown controls."]'::JSONB
    ),
    (
      'accessibility', 'ace_forward',
      '["A visible partner or wall may provide a forward target where suitable.","Options include a lighter or softer ball, smaller preload, stationary contacts, fewer attempts, longer rest, high-contrast markings, and nonvideo instruction."]'::JSONB
    ),
    (
      'alternates', 'forward_backward_protocols',
      '["Forward and backward projections remain separate definitions.","Mass, distance, and measurement are annotations; preload and contacts are variants; vertical tosses, slams, chest passes, scoop and rotational throws are separate identities."]'::JSONB
    ),
    (
      'media', 'youtube_embed',
      '["YouTube supports privacy-enhanced embedding.","Healthy oEmbed metadata does not establish full viewing, exact match, safety, cues, captions, accessibility, reviewer identity, or approval."]'::JSONB
    );

  UPDATE coaching.exercise_section_evidence_v1
  SET review_status = 'superseded',
      updated_at = now()
  WHERE definition_id = ANY(target_ids)
    AND reviewed_card_version <> (
      SELECT card_version
      FROM coaching.exercise_definition_v1 definition
      WHERE definition.id = exercise_section_evidence_v1.definition_id
    )
    AND review_status = 'candidate';

  INSERT INTO coaching.exercise_section_evidence_v1 (
    definition_id, reviewed_card_version, section_key, source_url,
    source_title, source_publisher, source_kind, claims_json,
    evidence_quality, review_status, reviewer_user_id, reviewed_at
  )
  SELECT
    definition.id,
    definition.card_version,
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
  FROM coaching.exercise_definition_v1 definition
  CROSS JOIN overhead_throw_evidence_seed evidence
  JOIN overhead_throw_source_seed source
    ON source.source_key = evidence.source_key
  WHERE definition.id = ANY(target_ids)
  ON CONFLICT (
    definition_id, reviewed_card_version, section_key, source_url
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
  WHERE definition_id = ANY(target_ids)
    AND reviewed_card_version <> (
      SELECT card_version
      FROM coaching.exercise_definition_v1 definition
      WHERE definition.id = exercise_media_candidate_v1.definition_id
    )
    AND review_status = 'candidate';

  INSERT INTO coaching.exercise_media_candidate_v1 (
    definition_id, variant_id, reviewed_card_version, url, embed_url,
    video_id, title, channel_name, embedding_allowed, exact_variant_match,
    demonstration_quality_score, link_status, review_status,
    discovery_method, source_query, reviewer_user_id, reviewed_at, notes
  )
  SELECT
    definition.id,
    variant.id,
    definition.card_version,
    'https://www.youtube.com/watch?v=' || media.video_id,
    'https://www.youtube-nocookie.com/embed/' || media.video_id,
    media.video_id,
    media.title,
    media.channel_name,
    TRUE,
    NULL,
    NULL,
    'healthy',
    'candidate',
    'manual_research',
    media.source_query,
    NULL,
    NULL,
    media.notes
  FROM (
    VALUES
      (
        'medicine-ball-overhead-throw', 'stationary-forward-distance',
        'NktkzTpq1Lo', 'Standing Med Ball Overhead Throw',
        'Bobby Smith', 'forward overhead medicine ball throw wall',
        'Healthy oEmbed metadata only; forward direction, exact contacts, full technique, safety, captions, accessibility, reviewer identity, and approval require human review.'
      ),
      (
        'medicine-ball-overhead-throw', 'stationary-forward-distance',
        'jh20darjLiU',
        'Medicine ball overhead throw: Full body power exercise',
        'Beyond Measure Fitness Training',
        'forward overhead medicine ball throw wall',
        'Healthy oEmbed metadata only; exact projection direction and demonstration quality remain unreviewed.'
      ),
      (
        'medicine-ball-overhead-throw',
        'step-through-forward-wall-throw-only',
        'WUtF_v30qm4', 'Step Into MB Overhead Throw',
        'Derek Ward', 'forward overhead medicine ball throw wall',
        'Healthy oEmbed metadata only for a step-in candidate; exact contacts, wall behavior, safety, captions, accessibility, reviewer identity, and approval remain pending.'
      ),
      (
        'medicine-ball-overhead-throw',
        'step-through-forward-wall-throw-only',
        'gHjnby8GA1U', 'Medicine Ball Overhead Throw Into Wall',
        'Bill Miller', 'forward overhead medicine ball throw wall',
        'Healthy oEmbed metadata only for wall delivery; rebound behavior, catch contract, safety, captions, accessibility, reviewer identity, and approval remain pending.'
      ),
      (
        'medicine-ball-overhead-throw', NULL,
        'cVxcXfqdR-s', 'Overhead Med Ball Throw',
        'Frye Performance Training',
        'forward overhead medicine ball throw wall',
        'Healthy oEmbed metadata only; direction, exact variant, content quality, safety, captions, accessibility, reviewer identity, and approval remain unreviewed.'
      ),
      (
        'medicine-ball-overhead-back-throw',
        'countermovement-backward-distance',
        'b05ny1i308Y', 'Medicine Ball Throw — Overhead Backward',
        'Brendan Thompson -- Speed & Physical Therapy',
        'backward overhead medicine ball throw',
        'Healthy oEmbed metadata only; exact protocol, mass, contacts, safety, captions, accessibility, reviewer identity, and approval require human viewing.'
      ),
      (
        'medicine-ball-overhead-back-throw', NULL,
        'LgxcP6k2bJc',
        'Medicine Ball heaves - 1 hop Overhead Backwards - Build Speed & Power',
        'ALTIS World', 'backward overhead medicine ball throw',
        'Healthy oEmbed metadata only for a hop variation; exact contacts, technique, safety, captions, accessibility, reviewer identity, and approval remain unreviewed.'
      ),
      (
        'medicine-ball-overhead-back-throw',
        'countermovement-backward-distance',
        'Cb9M6LrcyxQ', 'Med Ball Overhead Backward Throw',
        'Hunter Reeser', 'backward overhead medicine ball throw',
        'Healthy oEmbed metadata only; exact countermovement, contacts, demonstration quality, safety, captions, accessibility, reviewer identity, and approval remain unreviewed.'
      ),
      (
        'medicine-ball-overhead-back-throw',
        'countermovement-backward-distance',
        'JJoL9RDK7aM', 'Med Ball Overhead Backwards Throw',
        'Foran Strength', 'backward overhead medicine ball throw',
        'Healthy oEmbed metadata only; exact match, cue quality, safety, captions, accessibility, reviewer identity, and approval remain unreviewed.'
      ),
      (
        'medicine-ball-overhead-back-throw',
        'no-countermovement-backward-distance',
        'FFpOtu3cgiI',
        'F.S Library - No CM Med ball Overhead Backwards throw',
        'Fortitude Strength', 'backward overhead medicine ball throw',
        'Healthy oEmbed metadata only for a no-countermovement candidate; full demonstration, safety, captions, accessibility, exact-match decision, reviewer identity, and approval remain pending.'
      )
  ) AS media(
    slug, variant_key, video_id, title, channel_name, source_query, notes
  )
  JOIN coaching.exercise_definition_v1 definition
    ON definition.slug = media.slug
   AND definition.id = ANY(target_ids)
  LEFT JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id = definition.id
   AND variant.variant_key = media.variant_key
   AND variant.status <> 'archived'
  ON CONFLICT (definition_id, reviewed_card_version, video_id) DO UPDATE SET
    variant_id = EXCLUDED.variant_id,
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

  UPDATE coaching.exercise_alternate_assessment_v1
  SET review_status = 'superseded',
      updated_at = now()
  WHERE definition_id = ANY(target_ids)
    AND reviewed_card_version <> (
      SELECT card_version
      FROM coaching.exercise_definition_v1 definition
      WHERE definition.id = exercise_alternate_assessment_v1.definition_id
    )
    AND review_status = 'candidate';

  INSERT INTO coaching.exercise_alternate_assessment_v1 (
    definition_id, reviewed_card_version, alternate_name, classification,
    rationale, distinguishing_dimensions, proposed_card_json, review_status,
    reviewer_user_id, reviewed_at
  )
  SELECT
    definition.id,
    definition.card_version,
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
        'medicine-ball-overhead-throw',
        'Stationary Forward Overhead Distance Throw', 'new_variant',
        'A fixed stance and no-step release preserve forward overhead identity while changing contacts and measurement.',
        '{"direction":"forward","contacts":"stationary_no_step","target":"open_distance_lane"}'::JSONB
      ),
      (
        'medicine-ball-overhead-throw',
        'Step-Through Forward Overhead Wall Throw', 'new_variant',
        'A declared step through to an inspected wall changes coordination and logistics while preserving forward overhead projection.',
        '{"direction":"forward","contacts":"one_step_through","target":"inspected_wall","catch":false}'::JSONB
      ),
      (
        'medicine-ball-overhead-throw',
        'Forward Overhead Throw for Distance', 'modifier_annotation',
        'A standardized distance measure is an assessment annotation under the same stationary forward variant.',
        '{"measurement":"first_contact_distance","protocol":"standardized"}'::JSONB
      ),
      (
        'medicine-ball-overhead-throw',
        'Forward Overhead Throw to Trained Partner',
        'modifier_annotation',
        'A trained partner changes target behavior and retrieval logistics when the thrower does not receive or catch a return.',
        '{"target":"trained_partner","throwerCatch":false,"exactLogisticsRequired":true}'::JSONB
      ),
      (
        'medicine-ball-overhead-throw',
        'Backward Overhead Medicine-Ball Throw', 'new_definition',
        'Backward projection reverses orientation, release direction, visual control, landing sector, retrieval, and safety.',
        '{"direction":"backward_overhead","landingSector":"behind_thrower"}'::JSONB
      ),
      (
        'medicine-ball-overhead-throw',
        'Vertical Medicine-Ball Toss', 'new_definition',
        'Vertical projection changes release direction, target, tracking, catch or retrieval, and output metric.',
        '{"direction":"vertical","target":"open_air"}'::JSONB
      ),
      (
        'medicine-ball-overhead-back-throw',
        'Countermovement Backward Overhead Distance Throw',
        'new_variant',
        'A declared countermovement with forceful total-body extension is the standard backward-distance protocol.',
        '{"direction":"backward_overhead","preload":"countermovement","measurement":"first_contact_distance"}'::JSONB
      ),
      (
        'medicine-ball-overhead-back-throw',
        'No-Countermovement Backward Overhead Distance Throw',
        'new_variant',
        'Removing the countermovement changes start, elastic contribution, complexity, physical demand, and comparability while retaining backward projection.',
        '{"direction":"backward_overhead","preload":"static_no_countermovement","measurement":"first_contact_distance"}'::JSONB
      ),
      (
        'medicine-ball-overhead-back-throw',
        'Backward Overhead Throw for Distance',
        'modifier_annotation',
        'A standardized distance measure is an assessment annotation under the declared exact backward variant.',
        '{"measurement":"first_contact_distance","protocol":"standardized"}'::JSONB
      ),
      (
        'medicine-ball-overhead-back-throw',
        'Backward Overhead Throw with Jump',
        'modifier_annotation',
        'Leaving the ground is a declared contact rule and dose modifier when the backward projection and landing-sector contract remain unchanged.',
        '{"contacts":"takeoff_permitted","landing":"declared_and_controlled"}'::JSONB
      ),
      (
        'medicine-ball-overhead-back-throw',
        'Forward Overhead Medicine-Ball Throw', 'new_definition',
        'Forward projection reverses orientation and changes visible target, release direction, logistics, and safety.',
        '{"direction":"forward","target":"visible_forward_target_or_lane"}'::JSONB
      ),
      (
        'medicine-ball-overhead-back-throw',
        'Medicine-Ball Scoop Toss', 'new_definition',
        'A scoop toss uses a different release path and forward or rotational projection without the backward-overhead finish.',
        '{"releasePath":"underhand_scoop","primaryJointAction":"different"}'::JSONB
      )
  ) AS alternate(
    slug, alternate_name, classification, rationale, dimensions
  )
  JOIN coaching.exercise_definition_v1 definition
    ON definition.slug = alternate.slug
   AND definition.id = ANY(target_ids)
  ON CONFLICT (
    definition_id, reviewed_card_version, alternate_name
  ) DO UPDATE SET
    classification = EXCLUDED.classification,
    rationale = EXCLUDED.rationale,
    distinguishing_dimensions = EXCLUDED.distinguishing_dimensions,
    proposed_card_json = NULL,
    review_status = 'candidate',
    reviewer_user_id = NULL,
    reviewed_at = NULL,
    updated_at = now();

  UPDATE coaching.exercise_difficulty_profile profile
  SET technical = CASE profile.exercise_id
        WHEN 1155 THEN 4.8
        WHEN 1154 THEN 5.0
        ELSE profile.technical
      END,
      load = CASE profile.exercise_id
        WHEN 1155 THEN 4.2
        WHEN 1154 THEN 5.4
        ELSE profile.load
      END,
      overall = CASE profile.exercise_id
        WHEN 1155 THEN greatest(4.8, 4.2)
        WHEN 1154 THEN greatest(5.0, 5.4)
        ELSE profile.overall
      END,
      notes =
        'Candidate reassessment of exercise complexity and physical difficulty only; exact variant and independent calibration remain required.',
      updated_at = now()
  WHERE profile.exercise_id IN (1154, 1155);

  UPDATE coaching.exercise_score_v1 score
  SET technical_complexity = CASE score.exercise_id
        WHEN 1155 THEN 48
        WHEN 1154 THEN 50
        ELSE score.technical_complexity
      END,
      absolute_load_demand = CASE score.exercise_id
        WHEN 1155 THEN 42
        WHEN 1154 THEN 54
        ELSE score.absolute_load_demand
      END,
      coordination_demand = CASE score.exercise_id
        WHEN 1155 THEN 56
        WHEN 1154 THEN 60
        ELSE score.coordination_demand
      END,
      impact = CASE score.exercise_id
        WHEN 1155 THEN 12
        WHEN 1154 THEN 18
        ELSE score.impact
      END,
      supervision_demand = CASE score.exercise_id
        WHEN 1155 THEN 56
        WHEN 1154 THEN 72
        ELSE score.supervision_demand
      END,
      base_overall_difficulty = CASE score.exercise_id
        WHEN 1155 THEN greatest(48, 42)
        WHEN 1154 THEN greatest(50, 54)
        ELSE score.base_overall_difficulty
      END,
      legacy_scores = score.legacy_scores || jsonb_build_object(
        'candidateReassessment', migration_key,
        'difficultyModel',
          'max_exercise_complexity_physical_difficulty',
        'projectionDirection',
          CASE score.exercise_id
            WHEN 1155 THEN 'forward'
            ELSE 'backward_overhead'
          END,
        'exerciseSkillLevelAllowed', FALSE,
        'independentCalibrationRequired', TRUE
      ),
      migration_confidence = 72,
      human_review_status = 'queued',
      reviewed_by = NULL,
      reviewed_at = NULL,
      review_notes =
        'Research-backed candidate reassessment only; exact variant and independent calibration remain required.',
      updated_at = now()
  WHERE score.exercise_id IN (1154, 1155);

  UPDATE coaching.exercise legacy
  SET archived = TRUE,
      is_published = FALSE,
      why_publish_ready = FALSE,
      skill_level = NULL,
      movement_family = CASE legacy.slug
        WHEN 'medicine-ball-overhead-throw'
          THEN 'Forward overhead medicine-ball projection'
        ELSE 'Backward overhead medicine-ball projection'
      END,
      primary_phase_key = 'output',
      phase_subrole = 'jump_throw_explosive_power',
      primary_order_slot = CASE legacy.slug
        WHEN 'medicine-ball-overhead-throw'
          THEN 'forward_overhead_medicine_ball_projection'
        ELSE 'backward_overhead_medicine_ball_projection'
      END,
      card_summary = CASE legacy.slug
        WHEN 'medicine-ball-overhead-throw'
          THEN 'Two-hand forward overhead medicine-ball projection with exact ball, preload, contacts, visible target or lane, release, finish, retrieval, dose, and output contract.'
        ELSE 'Two-hand backward overhead medicine-ball projection with exact ball, preload, contacts, closed landing sector, release, finish, retrieval, dose, and output contract.'
      END,
      description = (
        SELECT definition.description
        FROM coaching.exercise_definition_v1 definition
        WHERE definition.slug = legacy.slug
          AND definition.id = ANY(target_ids)
      ),
      instructions = CASE legacy.slug
        WHEN 'medicine-ball-overhead-throw'
          THEN 'Declare ball, mass, stance, preload, contacts, visible target or lane, attempts, rest, retrieval, measurement, and stop signal. Throw forward overhead, finish balanced, wait, retrieve, and reset.'
        ELSE 'Declare ball, mass, stance, preload, contacts, closed backward sector, attempts, rest, retrieval, measurement, and stop signal. Throw backward overhead, finish balanced, wait for clear, retrieve, and reset.'
      END,
      coach_language =
        'Observe exact variant, ball, preload, force transfer, trunk, overhead path, release, direction, contacts, finish, output, target or sector, traffic, retrieval, symptoms, and stop response.',
      athlete_language = CASE legacy.slug
        WHEN 'medicine-ball-overhead-throw'
          THEN 'Set the ball and target, load as declared, drive and throw forward, finish balanced, wait, retrieve, reset.'
        ELSE 'Set the ball and closed sector, load as declared, drive tall and throw backward overhead, finish balanced, wait for clear, retrieve, reset.'
      END,
      scalable_variables = ARRAY[
        'ball_type', 'ball_mass', 'stance', 'preload',
        'countermovement', 'foot_contacts', 'target_or_distance',
        'attempts', 'rest', 'measurement'
      ]::TEXT[],
      movement_requirements = jsonb_build_object(
        'laterality', 'bilateral_two_hand',
        'primaryAction', 'total_body_overhead_ball_projection',
        'direction', CASE legacy.slug
          WHEN 'medicine-ball-overhead-throw' THEN 'forward'
          ELSE 'backward_overhead'
        END,
        'exactVariantRequired', TRUE,
        'selectableExactVariant', FALSE
      ),
      coaching_execution = jsonb_build_object(
        'qualityGate', jsonb_build_array(
          'Exact direction, ball, preload, contacts, target or sector, release, finish, output, wait, retrieval, and reset remain controlled.',
          'No pain, uncontrolled spinal extension, balance loss, direction error, occupied path, or material output decline.'
        ),
        'stopSigns', jsonb_build_array(
          'Symptoms or uncontrolled breathing',
          'Ball, surface, overhead, wall, lane, sector, traffic, marker, lighting, or retrieval failure',
          'Preload, release, direction, contact, balance, output, stop-response, or reset failure'
        )
      ),
      programming_logic = jsonb_build_object(
        'difficultyModel',
          'max_exercise_complexity_physical_difficulty',
        'exerciseSkillLevel', NULL,
        'identityRule',
          'select_exact_projection_direction_ball_preload_contact_target_or_sector_release_retrieval_and_measurement_contract',
        'fatigueRule',
          'stop_before_output_direction_contact_balance_or_lane_discipline_declines'
      ),
      media_library = jsonb_build_object(
        'candidateCount', 5,
        'approvalStatus', 'human_review_required',
        'approvedVideoUrl', NULL
      ),
      updated_at = now()
  WHERE legacy.id IN (1154, 1155)
    AND legacy.slug IN (
      'medicine-ball-overhead-throw',
      'medicine-ball-overhead-back-throw'
    );

  UPDATE coaching.exercise_scaling_profile scaling
  SET skill_level = NULL,
      load_guidance = CASE
        WHEN coalesce(scaling.load_guidance, '') LIKE
          '%this is exercise difficulty and readiness guidance, not an exercise skill level.%'
          THEN scaling.load_guidance
        ELSE trim(
          coalesce(scaling.load_guidance, '')
          || ' Select exact ball mass, preload, contacts, target or sector, attempts, rest, and measurement from current pain-free control; this is exercise difficulty and readiness guidance, not an exercise skill level.'
        )
      END
  WHERE scaling.exercise_id IN (1154, 1155);

  UPDATE coaching.exercise_safety_profile safety
  SET minimum_skill_level = NULL,
      minimum_prerequisite_notes =
        'Pain-free declared preload and overhead range; controlled ball release, contacts, finish, lane or sector behavior, retrieval, reset, and stop response.',
      readiness_checks = ARRAY[
        'Pain-free declared stance, preload, overhead range, and release',
        'Exact ball, mass, direction, contacts, target or sector, and retrieval are understood',
        'Lane, wall or landing sector, surface, overhead clearance, traffic, markers, and lighting are safe',
        'Athlete can finish balanced, wait for clear, retrieve, reset, and obey the stop signal'
      ]::TEXT[],
      stop_signs = ARRAY[
        'Pain, numbness, dizziness, pressure symptoms, apprehension, or uncontrolled breathing',
        'Ball, surface, overhead, wall, lane, landing sector, traffic, marker, lighting, or retrieval failure',
        'Uncontrolled spinal extension, balance, release, direction, contact, output, stop-response, or reset failure'
      ]::TEXT[],
      requires_coach_supervision = 'required'
  WHERE safety.exercise_id IN (1154, 1155);

  UPDATE coaching.exercise_card_test_packet_v1 packet
  SET card_version = definition.card_version,
      audit_version = 'canonical-card-audit-v1',
      status = 'quarantined',
      checks_json = '{}'::JSONB,
      blocking_issues_json = jsonb_build_array(
        jsonb_build_object(
          'code', 'audit_pending',
          'message',
            'Re-run the canonical audit after the overhead medicine-ball candidate completion.'
        )
      ),
      human_review_required = TRUE,
      checked_at = now()
  FROM coaching.exercise_definition_v1 definition
  WHERE packet.definition_id = definition.id
    AND definition.id = ANY(target_ids);
END $$;
