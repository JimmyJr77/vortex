-- Complete the researched Backpedal-to-Sprint family as two stable candidate
-- definitions:
--   * backpedal-to-sprint-turn: sprint-through open-turn identity, including
--     pre-planned and reactive 90- and 180-degree variants;
--   * backpedal-to-sprint-to-stick: distinct terminal braking-and-hold identity.
--
-- Migration 339 is the duplicate-consolidation authority for Open Turn and
-- Turn on Signal. Migrations 340 and 355 are the identity-boundary authorities
-- for the terminal-stick definition. Removing the terminal hold remains
-- identity-quarantined because it may cross into a free-deceleration identity.
--
-- Public YouTube URLs are unverified, non-embeddable discovery candidates. No
-- playback, oEmbed, exact-match, caption, accessibility, quality, reviewer,
-- media, graph, calibration, card, or publication approval is claimed.
-- Exercise difficulty is exercise complexity plus physical difficulty, with
-- overall derived as their maximum. Athlete proficiency levels remain
-- exclusive to coaching.skill and are intentionally absent.
-- IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '407_coaching_backpedal_to_sprint_family_completion';
  research_batch CONSTANT TEXT := 'backpedal-to-sprint-family-v1';
  research_version CONSTANT TEXT := '2026-07-25.18';
  active_count INTEGER;
  already_applied_count INTEGER;
  protected_count INTEGER;
  source_count INTEGER;
  consolidation_count INTEGER;
  distinct_boundary_count INTEGER;
  turn_definition_id UUID;
  hop_and_go_definition_id UUID;
  hop_and_go_boundary_count INTEGER;
BEGIN
  SELECT count(*)
  INTO active_count
  FROM coaching.exercise_definition_v1
  WHERE facility_id = 1
    AND slug IN (
      'backpedal-to-sprint-turn',
      'backpedal-to-sprint-to-stick'
    )
    AND status <> 'archived';

  IF active_count <> 2 THEN
    RAISE EXCEPTION
      '% expected exactly 2 active Backpedal-to-Sprint definitions; found %',
      migration_key,
      active_count;
  END IF;

  SELECT count(*)
  INTO already_applied_count
  FROM coaching.exercise_definition_v1
  WHERE facility_id = 1
    AND slug IN (
      'backpedal-to-sprint-turn',
      'backpedal-to-sprint-to-stick'
    )
    AND status <> 'archived'
    AND provenance_json->>'structuralCompletionMigration' = migration_key;

  IF already_applied_count NOT IN (0, 2) THEN
    RAISE EXCEPTION
      '% found a partial prior-application count %',
      migration_key,
      already_applied_count;
  END IF;

  SELECT count(DISTINCT source.legacy_exercise_id)
  INTO source_count
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_definition_source_v1 source
    ON source.definition_id = definition.id
  WHERE definition.facility_id = 1
    AND definition.slug IN (
      'backpedal-to-sprint-turn',
      'backpedal-to-sprint-to-stick'
    )
    AND definition.status <> 'archived';

  IF source_count <> 4 THEN
    RAISE EXCEPTION
      '% expected all 4 legacy mappings on the active family; found %',
      migration_key,
      source_count;
  END IF;

  IF (
    SELECT count(DISTINCT source.legacy_exercise_id)
    FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_definition_source_v1 source
      ON source.definition_id = definition.id
    WHERE definition.facility_id = 1
      AND definition.slug = 'backpedal-to-sprint-turn'
      AND definition.status <> 'archived'
  ) <> 3 OR (
    SELECT count(DISTINCT source.legacy_exercise_id)
    FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_definition_source_v1 source
      ON source.definition_id = definition.id
    WHERE definition.facility_id = 1
      AND definition.slug = 'backpedal-to-sprint-to-stick'
      AND definition.status <> 'archived'
  ) <> 1 THEN
    RAISE EXCEPTION
      '% lost the required 3-to-1 legacy source distribution',
      migration_key;
  END IF;

  SELECT count(*)
  INTO consolidation_count
  FROM coaching.exercise_definition_v1 survivor
  JOIN coaching.exercise_identity_resolution_v1 resolution
    ON resolution.survivor_definition_id = survivor.id
   AND resolution.decision = 'duplicate_consolidated'
  JOIN coaching.exercise_definition_v1 duplicate
    ON duplicate.id = resolution.resolved_definition_id
   AND duplicate.status = 'archived'
  WHERE survivor.facility_id = 1
    AND survivor.slug = 'backpedal-to-sprint-turn'
    AND survivor.status <> 'archived'
    AND duplicate.slug IN (
      'backpedal-to-sprint-open-turn',
      'backpedal-to-sprint-turn-on-signal'
    );

  IF consolidation_count <> 2 THEN
    RAISE EXCEPTION
      '% requires both migration-339 Backpedal-to-Sprint consolidations; found %',
      migration_key,
      consolidation_count;
  END IF;

  SELECT count(*)
  INTO distinct_boundary_count
  FROM coaching.exercise_identity_resolution_v1 resolution
  JOIN coaching.exercise_definition_v1 left_definition
    ON left_definition.id = resolution.survivor_definition_id
  JOIN coaching.exercise_definition_v1 right_definition
    ON right_definition.id = resolution.resolved_definition_id
  WHERE resolution.facility_id = 1
    AND resolution.decision = 'distinct_exercises'
    AND ARRAY[left_definition.slug,right_definition.slug] @>
      ARRAY['backpedal-to-sprint-turn','backpedal-to-sprint-to-stick']::TEXT[];

  IF distinct_boundary_count <> 1 THEN
    RAISE EXCEPTION
      '% requires the researched sprint-through versus terminal-stick identity boundary; found %',
      migration_key,
      distinct_boundary_count;
  END IF;

  SELECT id
  INTO turn_definition_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id = 1
    AND slug = 'backpedal-to-sprint-turn'
    AND status <> 'archived';

  SELECT id
  INTO hop_and_go_definition_id
  FROM coaching.exercise_definition_v1
  WHERE facility_id = 1
    AND slug = 'backpedal-turn-to-hop-and-go'
    AND status <> 'archived';

  IF turn_definition_id IS NULL OR hop_and_go_definition_id IS NULL THEN
    RAISE EXCEPTION
      '% requires active Open Turn and Hop-and-Go definitions for the surfaced similarity boundary',
      migration_key;
  END IF;

  SELECT count(*)
  INTO hop_and_go_boundary_count
  FROM coaching.exercise_identity_resolution_v1 resolution
  WHERE resolution.facility_id = 1
    AND resolution.survivor_definition_id IN (
      turn_definition_id,
      hop_and_go_definition_id
    )
    AND resolution.resolved_definition_id IN (
      turn_definition_id,
      hop_and_go_definition_id
    )
    AND NOT (
      resolution.decision = 'distinct_exercises'
      AND resolution.resolution_source = 'deterministic_identity_equivalence'
      AND resolution.reviewed_by IS NULL
      AND resolution.evidence_json->>'migration' = migration_key
      AND resolution.evidence_json->>'identityBoundary' =
        'open_turn_sprint_through_vs_required_hop_contact_then_go'
    );

  IF hop_and_go_boundary_count > 0 THEN
    RAISE EXCEPTION
      '% refused to overwrite an existing Open Turn versus Hop-and-Go identity decision',
      migration_key;
  END IF;

  INSERT INTO coaching.exercise_identity_resolution_v1 (
    facility_id,
    survivor_definition_id,
    resolved_definition_id,
    decision,
    rationale,
    evidence_json,
    resolution_source,
    reviewed_by,
    resolved_at
  )
  SELECT
    1,
    turn_definition_id,
    hop_and_go_definition_id,
    'distinct_exercises',
    'Backpedal-to-Sprint Open Turn requires backward travel, an open turn, and forward acceleration through a target with no required jump or landing. Backpedal Turn to Hop-and-Go explicitly inserts a hop contact and controlled landing before the go action. The added flight, landing, contact order, impact budget, quality gate, and failure state make it a distinct exercise.',
    jsonb_build_object(
      'identityBoundary',
        'open_turn_sprint_through_vs_required_hop_contact_then_go',
      'leftContract',jsonb_build_array(
        'backpedal','open_turn','forward_acceleration','sprint_through_run_out'
      ),
      'rightContract',jsonb_build_array(
        'backpedal','hip_flip','required_hop_contact','controlled_landing','go'
      ),
      'changedDimensions',jsonb_build_array(
        'ordered_actions','flight','landing','contact_count','impact_budget',
        'quality_gate','failure_state'
      ),
      'evidenceSource','current_authored_candidate_card_contracts',
      'decisionScope',
        'identity_only_not_card_media_graph_calibration_or_publication_approval',
      'cardsRemainReviewOnly',TRUE,
      'approvalsCreated',FALSE,
      'exerciseDifficultyModel',
        'exercise_complexity_and_physical_difficulty_only',
      'migration',migration_key
    ),
    'deterministic_identity_equivalence',
    NULL,
    now()
  WHERE NOT EXISTS (
    SELECT 1
    FROM coaching.exercise_identity_resolution_v1 resolution
    WHERE resolution.facility_id = 1
      AND resolution.survivor_definition_id IN (
        turn_definition_id,
        hop_and_go_definition_id
      )
      AND resolution.resolved_definition_id IN (
        turn_definition_id,
        hop_and_go_definition_id
      )
  );

  SELECT count(*)
  INTO hop_and_go_boundary_count
  FROM coaching.exercise_identity_resolution_v1 resolution
  WHERE resolution.facility_id = 1
    AND resolution.survivor_definition_id IN (
      turn_definition_id,
      hop_and_go_definition_id
    )
    AND resolution.resolved_definition_id IN (
      turn_definition_id,
      hop_and_go_definition_id
    )
    AND resolution.decision = 'distinct_exercises'
    AND resolution.resolution_source = 'deterministic_identity_equivalence'
    AND resolution.reviewed_by IS NULL
    AND resolution.evidence_json->>'migration' = migration_key
    AND resolution.evidence_json->>'approvalsCreated' = 'false';

  IF hop_and_go_boundary_count <> 1 THEN
    RAISE EXCEPTION
      '% did not persist the Open Turn versus Hop-and-Go distinct boundary',
      migration_key;
  END IF;

  SELECT count(*)
  INTO protected_count
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.facility_id = 1
    AND definition.slug IN (
      'backpedal-to-sprint-turn',
      'backpedal-to-sprint-to-stick'
    )
    AND (
      (already_applied_count = 0 AND definition.card_version <> 1)
      OR (already_applied_count = 2 AND definition.card_version <> 2)
      OR definition.status IN ('published','deprecated')
      OR definition.reviewed_by IS NOT NULL
      OR definition.approved_by IS NOT NULL
      OR definition.last_reviewed_at IS NOT NULL
      OR definition.approved_video_url IS NOT NULL
    );

  IF protected_count > 0 THEN
    RAISE EXCEPTION
      '% refused to overwrite % reviewed or published canonical definition(s)',
      migration_key,
      protected_count;
  END IF;

  SELECT count(*)
  INTO protected_count
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_definition_source_v1 source
    ON source.definition_id = definition.id
  JOIN coaching.exercise_score_v1 score
    ON score.exercise_id = source.legacy_exercise_id
  WHERE definition.facility_id = 1
    AND definition.slug IN (
      'backpedal-to-sprint-turn',
      'backpedal-to-sprint-to-stick'
    )
    AND (
      score.human_review_status <> 'queued'
      OR score.reviewed_by IS NOT NULL
      OR score.reviewed_at IS NOT NULL
    );

  IF protected_count > 0 THEN
    RAISE EXCEPTION
      '% refused to overwrite % human-reviewed legacy score record(s)',
      migration_key,
      protected_count;
  END IF;

  SELECT
    (
      SELECT count(*)
      FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_variant_v1 variant
        ON variant.definition_id = definition.id
      LEFT JOIN coaching.exercise_delivery_profile_v1 profile
        ON profile.variant_id = variant.id
      WHERE definition.facility_id = 1
        AND definition.slug IN (
          'backpedal-to-sprint-turn',
          'backpedal-to-sprint-to-stick'
        )
        AND (variant.status = 'published' OR profile.status = 'published')
    )
    + (
      SELECT count(*)
      FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_section_evidence_v1 evidence
        ON evidence.definition_id = definition.id
       AND evidence.reviewed_card_version = definition.card_version
      WHERE definition.facility_id = 1
        AND definition.slug IN (
          'backpedal-to-sprint-turn',
          'backpedal-to-sprint-to-stick'
        )
        AND evidence.review_status NOT IN ('candidate','superseded')
    )
    + (
      SELECT count(*)
      FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_media_candidate_v1 media
        ON media.definition_id = definition.id
       AND media.reviewed_card_version = definition.card_version
      WHERE definition.facility_id = 1
        AND definition.slug IN (
          'backpedal-to-sprint-turn',
          'backpedal-to-sprint-to-stick'
        )
        AND media.review_status NOT IN ('candidate','superseded')
    )
    + (
      SELECT count(*)
      FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_alternate_assessment_v1 alternate
        ON alternate.definition_id = definition.id
       AND alternate.reviewed_card_version = definition.card_version
      WHERE definition.facility_id = 1
        AND definition.slug IN (
          'backpedal-to-sprint-turn',
          'backpedal-to-sprint-to-stick'
        )
        AND alternate.review_status NOT IN ('candidate','superseded')
    )
    + (
      SELECT count(*)
      FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_card_review_v1 review
        ON review.definition_id = definition.id
      WHERE definition.facility_id = 1
        AND definition.slug IN (
          'backpedal-to-sprint-turn',
          'backpedal-to-sprint-to-stick'
        )
    )
    + (
      SELECT count(*)
      FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_card_revision_v1 revision
        ON revision.definition_id = definition.id
      WHERE definition.facility_id = 1
        AND definition.slug IN (
          'backpedal-to-sprint-turn',
          'backpedal-to-sprint-to-stick'
        )
    )
    + (
      SELECT count(*)
      FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_media_review_v1 review
        ON review.definition_id = definition.id
      WHERE definition.facility_id = 1
        AND definition.slug IN (
          'backpedal-to-sprint-turn',
          'backpedal-to-sprint-to-stick'
        )
    )
    + (
      SELECT count(*)
      FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_variant_v1 variant
        ON variant.definition_id = definition.id
      JOIN coaching.exercise_relationship_v1 relationship
        ON relationship.from_variant_id = variant.id
        OR relationship.to_variant_id = variant.id
      WHERE definition.facility_id = 1
        AND definition.slug IN (
          'backpedal-to-sprint-turn',
          'backpedal-to-sprint-to-stick'
        )
        AND (
          relationship.review_status <> 'review'
          OR relationship.reviewed_by IS NOT NULL
          OR relationship.reviewed_at IS NOT NULL
        )
    )
    + (
      SELECT count(*)
      FROM coaching.exercise_definition_v1 definition
      JOIN coaching.exercise_variant_v1 variant
        ON variant.definition_id = definition.id
      JOIN coaching.exercise_score_calibration_v1 calibration
        ON calibration.variant_id = variant.id
      WHERE definition.facility_id = 1
        AND definition.slug IN (
          'backpedal-to-sprint-turn',
          'backpedal-to-sprint-to-stick'
        )
        AND (
          calibration.status <> 'review'
          OR calibration.reviewed_by IS NOT NULL
          OR calibration.reviewed_at IS NOT NULL
        )
    )
  INTO protected_count;

  IF protected_count > 0 THEN
    RAISE EXCEPTION
      '% refused to overwrite % reviewed or published dependent record(s)',
      migration_key,
      protected_count;
  END IF;

  IF already_applied_count = 0 THEN
    UPDATE coaching.exercise_delivery_profile_v1 profile
    SET status = 'archived',
        updated_at = now()
    FROM coaching.exercise_variant_v1 variant
    JOIN coaching.exercise_definition_v1 definition
      ON definition.id = variant.definition_id
    WHERE profile.variant_id = variant.id
      AND definition.facility_id = 1
      AND definition.slug IN (
        'backpedal-to-sprint-turn',
        'backpedal-to-sprint-to-stick'
      );

    UPDATE coaching.exercise_variant_v1 variant
    SET variant_key = left(
          'legacy-before-407-'
          || left(variant.id::TEXT, 8)
          || '-'
          || variant.variant_key,
          120
        ),
        status = 'archived',
        requirements_json = coalesce(variant.requirements_json, '{}'::JSONB)
          || jsonb_build_object(
            'selectable',FALSE,
            'completionQuarantine',TRUE,
            'quarantineReason',
              'Superseded source variant lacks the exact angle, cue, side, distance, terminal action, dose, fatigue, and stop-rule contract.'
          ),
        updated_at = now()
    FROM coaching.exercise_definition_v1 definition
    WHERE variant.definition_id = definition.id
      AND definition.facility_id = 1
      AND definition.slug IN (
        'backpedal-to-sprint-turn',
        'backpedal-to-sprint-to-stick'
      );
  END IF;

  UPDATE coaching.exercise_definition_v1 definition
  SET canonical_name = CASE definition.slug
        WHEN 'backpedal-to-sprint-turn'
          THEN 'Backpedal-to-Sprint Open Turn'
        ELSE 'Backpedal-to-Sprint-to-Stick'
      END,
      display_name = CASE definition.slug
        WHEN 'backpedal-to-sprint-turn'
          THEN 'Backpedal-to-Sprint Open Turn'
        ELSE 'Backpedal-to-Sprint-to-Stick'
      END,
      aliases = ARRAY(
        SELECT min(alias)
        FROM unnest(
          coalesce(definition.aliases, '{}')
          || CASE definition.slug
            WHEN 'backpedal-to-sprint-turn' THEN ARRAY[
              'Backpedal to Sprint Turn',
              'Backpedal-to-Sprint Turn',
              'Backpedal to Sprint Open Turn',
              'Backpedal Turn and Sprint'
            ]::TEXT[]
            ELSE ARRAY[
              'Backpedal to Sprint to Stick',
              'Backpedal Sprint and Stick'
            ]::TEXT[]
          END
        ) alias
        WHERE nullif(btrim(alias), '') IS NOT NULL
          AND lower(btrim(alias)) <> lower(
            CASE definition.slug
              WHEN 'backpedal-to-sprint-turn'
                THEN 'Backpedal-to-Sprint Open Turn'
              ELSE 'Backpedal-to-Sprint-to-Stick'
            END
          )
        GROUP BY lower(btrim(alias))
        ORDER BY lower(btrim(alias))
      ),
      description = CASE definition.slug
        WHEN 'backpedal-to-sprint-turn' THEN
          'From a declared start, backpedal 2-5 metres under control, open through the assigned side at the declared 90- or 180-degree angle, and accelerate 5-15 metres through a visible target into a clear run-out. Turn side, angle, cue predictability, distances, intensity, and finish are required variant or delivery dimensions.'
        ELSE
          'From a declared start, backpedal 2-5 metres, open through the assigned side at the declared 90- or 180-degree angle, accelerate 5-10 metres, then use a 3-5 metre multi-step braking zone to finish in a balanced two-second stick. Turn side, angle, cue predictability, distances, braking steps, hold, and overrun contingency must be declared.'
      END,
      family_key = 'backpedal_to_sprint_transition_family',
      schema_version = '1.0.0',
      card_version = CASE
        WHEN definition.provenance_json->>'structuralCompletionMigration'
          IS DISTINCT FROM migration_key
          THEN definition.card_version + 1
        ELSE definition.card_version
      END,
      status = 'review',
      content_confidence = CASE definition.slug
        WHEN 'backpedal-to-sprint-turn' THEN 78
        ELSE 76
      END,
      scoring_confidence = CASE definition.slug
        WHEN 'backpedal-to-sprint-turn' THEN 66
        ELSE 64
      END,
      media_confidence = 20,
      movement_patterns = CASE definition.slug
        WHEN 'backpedal-to-sprint-turn' THEN
          ARRAY['locomote','rotate','sprint']::TEXT[]
        ELSE ARRAY['locomote','rotate','sprint','decelerate','balance']::TEXT[]
      END,
      body_regions = ARRAY[
        'full_body','foot','ankle','knee','hip','pelvis','spine','shoulder'
      ]::TEXT[],
      required_equipment = ARRAY['cones']::TEXT[],
      optional_equipment = ARRAY[
        'floor_markers','timing_gates','video_capture'
      ]::TEXT[],
      anatomy_json = jsonb_build_object(
        'primaryMusclesAndTissues',jsonb_build_array(
          'quadriceps','gluteus_maximus','hamstrings','soleus',
          'gastrocnemius','gluteus_medius'
        ),
        'secondaryMusclesAndTissues',jsonb_build_array(
          'tibialis_anterior','adductors','deep_hip_rotators',
          'intrinsic_foot_muscles','obliques_and_spinal_stabilizers',
          'shoulder_girdle_and_arm_swing_musculature'
        ),
        'joints',jsonb_build_array(
          'foot','ankle','knee','hip','pelvis','thoracic_and_lumbar_spine',
          'shoulder','elbow'
        ),
        'actions',CASE definition.slug
          WHEN 'backpedal-to-sprint-turn' THEN jsonb_build_array(
            'backward_running_contacts','hip_rotation_and_abduction_for_open_turn',
            'hip_knee_and_ankle_extension_for_acceleration',
            'plantar_flexion','reciprocal_arm_action','controlled_run_out'
          )
          ELSE jsonb_build_array(
            'backward_running_contacts','hip_rotation_and_abduction_for_open_turn',
            'hip_knee_and_ankle_extension_for_acceleration',
            'multi_step_eccentric_braking','frontal_plane_alignment',
            'isometric_terminal_balance_hold'
          )
        END,
        'planes',jsonb_build_array(
          'sagittal_locomotion','transverse_reorientation',
          'frontal_plane_alignment_and_control'
        ),
        'laterality','bilateral_locomotion_with_balanced_left_and_right_turn_doses'
      ),
      environment_json = jsonb_build_object(
        'surface','level_dry_non_slip_with_suitable_traction',
        'lane',jsonb_build_object(
          'backwardBoundaryVisible',TRUE,
          'turnAndSprintTargetsVisible',TRUE,
          'brakingZoneRequired',definition.slug = 'backpedal-to-sprint-to-stick',
          'runOutOrOverrunSpaceRequired',TRUE,
          'crossTrafficAllowed',FALSE
        ),
        'spacing','one_athlete_per_lane_with_staggered_starts',
        'sightline','coach_and_athlete_can_see_boundaries_cues_and_finish_zone',
        'weatherPolicy','reduce_or_replace_when_surface_traction_or_visibility_is_unreliable'
      ),
      population_json = jsonb_build_object(
        'selectionStatus','candidate_requires_human_review',
        'readinessChecks',CASE definition.slug
          WHEN 'backpedal-to-sprint-turn' THEN jsonb_build_array(
            'controlled_backward_walk_and_backpedal','pain_free_turn_to_each_side',
            'pain_free_short_acceleration','safe_run_out_at_assigned_speed'
          )
          ELSE jsonb_build_array(
            'controlled_backward_walk_and_backpedal','pain_free_turn_to_each_side',
            'submaximal_multi_step_braking','balanced_two_second_finish',
            'safe_overrun_when_the_stick_is_not_available'
          )
        END,
        'constraints',jsonb_build_array(
          'turn_side_angle_distances_and_cue_are_declared',
          'speed_is_scaled_from_current_movement_competence_and_readiness',
          'both_sides_are_programmed_unless_a_documented_reason_prevents_it',
          'current_lower_limb_injury_dizziness_or_return_to_running_restrictions_require_individual_clinical_guidance'
        ),
        'contraindications',jsonb_build_array(
          'sharp_or_increasing_pain','repeated_trip_or_heel_catch',
          'unstable_or_slipping_surface','unsafe_lane_or_run_out',
          'inability_to_turn_brake_or_exit_at_the_assigned_speed'
        )
      ),
      athlete_support_json = jsonb_build_object(
        'plainLanguageSummary',CASE definition.slug
          WHEN 'backpedal-to-sprint-turn' THEN
            'Backpedal to the mark, open through the assigned side, find the target, and sprint through it into the run-out.'
          ELSE
            'Backpedal, open and sprint, then brake across the marked zone and hold a balanced finish for two seconds.'
        END,
        'setupChecklist',jsonb_build_array(
          'confirm_turn_side_and_angle','show_backward_turn_sprint_and_finish_marks',
          'declare_preplanned_or_live_cue','confirm_clear_lane_and_exit',
          'rehearse_at_lower_speed_before_high_intent'
        ),
        'cues',CASE definition.slug
          WHEN 'backpedal-to-sprint-turn' THEN jsonb_build_array(
            'short_controlled_backward_steps','lower_before_the_line',
            'open_without_crossing','eyes_to_target','sprint_through','use_the_run_out'
          )
          ELSE jsonb_build_array(
            'control_the_backpedal','open_and_accelerate',
            'brake_across_the_zone','knees_track_with_feet','own_the_two_second_stick'
          )
        END,
        'feedbackPrompt','Were the turn side, angle, target, and finish clear, and did you stay in control without pain, slipping, or a trip?',
        'accessibilityOptions',jsonb_build_array(
          'walk_backward_then_turn','fewer_backward_steps','preplanned_side',
          'ninety_degree_turn','lower_sprint_speed','wider_lane',
          'larger_braking_or_run_out_zone','visual_and_audio_cue_rehearsal',
          'longer_recovery','no_timing','live_written_still_image_or_video_instruction'
        )
      ),
      coach_support_json = jsonb_build_object(
        'observationPriorities',CASE definition.slug
          WHEN 'backpedal-to-sprint-turn' THEN jsonb_build_array(
            'declared_side_angle_cue_and_distances','backward_posture_and_heel_clearance',
            'turn_plant_and_foot_crossing','target_pickup_and_first_three_forward_contacts',
            'run_out_and_lane_clearance','left_right_quality_and_speed_loss'
          )
          ELSE jsonb_build_array(
            'declared_side_angle_cue_and_distances','backward_posture_and_turn_plant',
            'entry_speed_to_braking_zone','braking_step_count_and_force_distribution',
            'knee_trunk_and_foot_alignment','two_second_hold_or_safe_overrun',
            'left_right_quality_and_speed_loss'
          )
        END,
        'qualityGate',CASE definition.slug
          WHEN 'backpedal-to-sprint-turn' THEN
            'Count only repetitions with a controlled backpedal, no trip or foot crossing, the declared open-turn side and angle, target pickup, clean acceleration, lane ownership, and a safe run-out.'
          ELSE
            'Count only repetitions with the declared backpedal and turn, controlled acceleration, braking distributed across the assigned zone, aligned contacts, and a balanced two-second finish or the declared safe overrun.'
        END,
        'stopRules',jsonb_build_array(
          'sharp_or_increasing_pain','backward_trip_or_repeated_heel_catch',
          'crossed_feet_or_uncontrolled_spin','slip_or_knee_collapse',
          'wrong_direction_or_repeated_anticipation','lane_conflict',
          'unsafe_run_out_or_crash_stop','marked_speed_or_technical_quality_loss'
        ),
        'reviewFlags',jsonb_build_array(
          'all_scores_relationships_media_and_card_states_are_candidate_only',
          'reactive_variants_require_declared_valid_cue_wrong_response_and_reset_rules',
          CASE definition.slug
            WHEN 'backpedal-to-sprint-to-stick'
              THEN 'free_deceleration_without_hold_remains_identity_quarantined'
            ELSE 'terminal_stick_is_a_distinct_definition_not_an_optional_finish'
          END
        )
      ),
      support_operations_json = jsonb_build_object(
        'supportSummary','Expose side, angle, cue, backward and forward distance, intensity, finish, run-out or braking zone, rest, symptoms, quality stop, and the lower-speed alternative.',
        'issueCategories',jsonb_build_array(
          'identity_or_variant','difficulty_or_dose','cue_or_measurement',
          'equipment_or_environment','symptom_or_population_constraint',
          'instruction_or_accessibility','media_exact_match','relationship','calibration'
        ),
        'supportEscalation',jsonb_build_object(
          'urgent',jsonb_build_array(
            'acute_injury','neurologic_or_dizziness_symptom','collision_or_fall_risk'
          ),
          'coachReview',jsonb_build_array(
            'repeated_trip_cross_step_wrong_direction_or_braking_fault',
            'persistent_side_asymmetry','unclear_speed_distance_or_recovery_dose'
          ),
          'contentReview',jsonb_build_array(
            'identity_or_terminal_action_mismatch','media_mismatch',
            'missing_cue_accessibility_measurement_or_stop_rule'
          )
        ),
        'knownLimitations',jsonb_build_array(
          'no_direct_intervention_trial_for_the_exact_composite_drill',
          'backward_running_and_deceleration_evidence_are_component_level',
          'candidate_media_not_reverified_in_this_migration',
          'scores_relationships_calibrations_and_card_are_unapproved_proposals'
        ),
        'changeImpactPolicy','Changes to turn angle, side, cue, distance, speed, surface, terminal action, braking zone, hold, rest, stop rule, relationship, or media require renewed affected reviews.'
      ),
      approved_video_url = NULL,
      reviewed_by = NULL,
      approved_by = NULL,
      last_reviewed_at = NULL,
      provenance_json = definition.provenance_json || jsonb_build_object(
        'structuralCompletionMigration',migration_key,
        'researchBatch',research_batch,
        'researchVersion',research_version,
        'identityAuthorityMigrations',jsonb_build_array(
          '339_coaching_high_confidence_implement_identity_consolidation',
          '340_coaching_remaining_high_similarity_identity_adjudication',
          '355_coaching_score_84_identity_boundaries'
        ),
        'evidenceState','candidate_requires_human_review',
        'mediaState','public_candidates_unverified_and_non_embeddable',
        'difficultyModel','max_exercise_complexity_physical_difficulty',
        'humanReviewRequired',TRUE,
        'publicationQuarantined',TRUE,
        'mediaApprovalCreated',FALSE,
        'graphApprovalCreated',FALSE,
        'calibrationApprovalCreated',FALSE
      ),
      updated_at = now()
  WHERE definition.facility_id = 1
    AND definition.slug IN (
      'backpedal-to-sprint-turn',
      'backpedal-to-sprint-to-stick'
    )
    AND definition.status <> 'archived';

  UPDATE coaching.exercise_section_evidence_v1 evidence
  SET review_status = 'superseded',
      updated_at = now()
  FROM coaching.exercise_definition_v1 definition
  WHERE evidence.definition_id = definition.id
    AND definition.facility_id = 1
    AND definition.slug IN (
      'backpedal-to-sprint-turn',
      'backpedal-to-sprint-to-stick'
    )
    AND evidence.reviewed_card_version < definition.card_version
    AND evidence.review_status = 'candidate';

  UPDATE coaching.exercise_media_candidate_v1 media
  SET review_status = 'superseded',
      updated_at = now()
  FROM coaching.exercise_definition_v1 definition
  WHERE media.definition_id = definition.id
    AND definition.facility_id = 1
    AND definition.slug IN (
      'backpedal-to-sprint-turn',
      'backpedal-to-sprint-to-stick'
    )
    AND media.reviewed_card_version < definition.card_version
    AND media.review_status = 'candidate';

  UPDATE coaching.exercise_alternate_assessment_v1 alternate
  SET review_status = 'superseded',
      updated_at = now()
  FROM coaching.exercise_definition_v1 definition
  WHERE alternate.definition_id = definition.id
    AND definition.facility_id = 1
    AND definition.slug IN (
      'backpedal-to-sprint-turn',
      'backpedal-to-sprint-to-stick'
    )
    AND alternate.reviewed_card_version < definition.card_version
    AND alternate.review_status = 'candidate';

  CREATE TEMP TABLE backpedal_variant_seed (
    definition_slug TEXT NOT NULL,
    variant_key TEXT NOT NULL,
    display_name TEXT NOT NULL,
    turn_angle SMALLINT,
    cue_predictability TEXT NOT NULL,
    terminal_action TEXT NOT NULL,
    complexity SMALLINT,
    physical SMALLINT,
    coordination SMALLINT NOT NULL,
    supervision SMALLINT NOT NULL,
    consequence SMALLINT NOT NULL,
    impact SMALLINT NOT NULL,
    work_capacity SMALLINT NOT NULL,
    local_fatigue SMALLINT NOT NULL,
    technical_fatigue SMALLINT NOT NULL,
    impact_accumulation SMALLINT NOT NULL,
    recovery_hours SMALLINT NOT NULL,
    selectable BOOLEAN NOT NULL,
    identity_quarantine BOOLEAN NOT NULL,
    PRIMARY KEY (definition_slug, variant_key)
  ) ON COMMIT DROP;

  INSERT INTO backpedal_variant_seed VALUES
    ('backpedal-to-sprint-turn','preplanned-90','Backpedal-to-Sprint Open Turn — Pre-Planned 90 Degrees',90,'preplanned','sprint_through_target',60,12,66,55,58,52,42,45,62,52,24,TRUE,FALSE),
    ('backpedal-to-sprint-turn','preplanned-180','Backpedal-to-Sprint Open Turn — Pre-Planned 180 Degrees',180,'preplanned','sprint_through_target',64,12,70,60,62,56,45,48,68,56,24,TRUE,FALSE),
    ('backpedal-to-sprint-turn','reactive-90','Backpedal-to-Sprint Open Turn — Live-Cue 90 Degrees',90,'unpredictable_valid_side_cue','sprint_through_target',70,12,80,72,70,58,48,52,78,58,30,TRUE,FALSE),
    ('backpedal-to-sprint-turn','reactive-180','Backpedal-to-Sprint Open Turn — Live-Cue 180 Degrees',180,'unpredictable_valid_side_cue','sprint_through_target',74,12,84,76,74,60,50,55,82,60,30,TRUE,FALSE),
    ('backpedal-to-sprint-to-stick','preplanned-90-stick','Backpedal-to-Sprint-to-Stick — Pre-Planned 90 Degrees',90,'preplanned','multi_step_braking_to_two_second_stick',68,14,72,68,68,62,52,58,72,62,36,TRUE,FALSE),
    ('backpedal-to-sprint-to-stick','preplanned-180-stick','Backpedal-to-Sprint-to-Stick — Pre-Planned 180 Degrees',180,'preplanned','multi_step_braking_to_two_second_stick',72,14,76,72,72,64,55,62,76,64,36,TRUE,FALSE),
    ('backpedal-to-sprint-to-stick','reactive-90-stick','Backpedal-to-Sprint-to-Stick — Live-Cue 90 Degrees',90,'unpredictable_valid_side_cue','multi_step_braking_to_two_second_stick',78,14,84,78,78,66,58,66,84,66,42,TRUE,FALSE),
    ('backpedal-to-sprint-to-stick','reactive-180-stick','Backpedal-to-Sprint-to-Stick — Live-Cue 180 Degrees',180,'unpredictable_valid_side_cue','multi_step_braking_to_two_second_stick',82,14,88,82,82,68,60,70,88,68,42,TRUE,FALSE),
    ('backpedal-to-sprint-to-stick','free-deceleration-no-hold-unresolved','Backpedal-to-Sprint — Free Deceleration Without Hold',NULL,'declared_before_review','free_deceleration_without_terminal_hold',NULL,NULL,76,74,72,64,58,64,78,64,36,FALSE,TRUE);

  INSERT INTO coaching.exercise_variant_v1 (
    definition_id,
    variant_key,
    display_name,
    modifier_keys,
    difficulty_json,
    requirements_json,
    status,
    load_profile_json,
    fatigue_profile_json,
    programming_profile_json
  )
  SELECT
    definition.id,
    seed.variant_key,
    seed.display_name,
    ARRAY[
      'turn_angle_' || coalesce(seed.turn_angle::TEXT, 'unresolved'),
      'cue_' || seed.cue_predictability,
      'terminal_' || seed.terminal_action
    ]::TEXT[],
    CASE
      WHEN seed.complexity IS NULL OR seed.physical IS NULL THEN
        jsonb_build_object(
          'scoreDeferred',TRUE,
          'deferredReason','Removing the terminal hold may cross the distinct terminal-stick identity boundary; identity review must precede scoring or selection.',
          'difficultyModel','max_exercise_complexity_physical_difficulty',
          'provisional',TRUE
        )
      ELSE jsonb_build_object(
        'technicalComplexity',seed.complexity,
        'absoluteLoadDemand',seed.physical,
        'baseOverallDifficulty',greatest(seed.complexity,seed.physical),
        'coordinationDemand',seed.coordination,
        'supervisionDemand',seed.supervision,
        'failureConsequence',seed.consequence,
        'impact',seed.impact,
        'workCapacityDemand',seed.work_capacity,
        'difficultyModel','max_exercise_complexity_physical_difficulty',
        'dimensionMeaning',jsonb_build_object(
          'technicalComplexity','exercise_complexity',
          'absoluteLoadDemand','physical_difficulty'
        ),
        'provisional',TRUE
      )
    END,
    jsonb_build_object(
      'selectable',seed.selectable,
      'identityQuarantine',seed.identity_quarantine,
      'startPosition','declared_athletic_stance',
      'backwardDistanceMetres',jsonb_build_object('min',2,'max',5),
      'turnSide','balanced_left_and_right',
      'turnAngleDegrees',seed.turn_angle,
      'turnType','open_hip_turn_without_foot_crossing',
      'cuePredictability',seed.cue_predictability,
      'validCueRule',CASE
        WHEN seed.cue_predictability = 'preplanned'
          THEN 'side_and_angle_known_before_repetition'
        WHEN seed.selectable
          THEN 'one_declared_live_visual_or_auditory_cue_selects_side_after_wait'
        ELSE 'unresolved'
      END,
      'forwardDistanceMetres',CASE seed.definition_slug
        WHEN 'backpedal-to-sprint-turn'
          THEN jsonb_build_object('min',5,'max',15)
        ELSE jsonb_build_object('min',5,'max',10)
      END,
      'brakingDistanceMetres',CASE seed.definition_slug
        WHEN 'backpedal-to-sprint-to-stick'
          THEN jsonb_build_object('min',3,'max',5)
        ELSE NULL
      END,
      'terminalAction',seed.terminal_action,
      'terminalHoldSeconds',CASE
        WHEN seed.terminal_action = 'multi_step_braking_to_two_second_stick'
          THEN 2
        ELSE 0
      END,
      'runOutOrOverrunRequired',TRUE,
      'surface','level_dry_non_slip',
      'lane','marked_and_clear'
    ),
    'review',
    jsonb_build_object(
      'externalLoadMethod','bodyweight_locomotion',
      'effectiveLoadDrivers',jsonb_build_array(
        'body_mass','backward_speed','turn_angle','turn_plant',
        'forward_acceleration_speed','surface_traction','distance',
        'braking_distance','terminal_action','total_contacts','repetition_density'
      ),
      'primaryStress',CASE seed.definition_slug
        WHEN 'backpedal-to-sprint-turn' THEN jsonb_build_array(
          'quadriceps_during_backward_contacts','hip_rotators_and_frontal_plane_control',
          'turn_plant','posterior_chain','plantar_flexors','forward_acceleration'
        )
        ELSE jsonb_build_array(
          'quadriceps_during_backward_and_braking_contacts',
          'hip_rotators_and_frontal_plane_control','turn_plant',
          'posterior_chain','plantar_flexors','eccentric_braking_and_terminal_balance'
        )
      END,
      'gripDemand',1,
      'spinalLoading',8,
      'eccentricStress',CASE seed.definition_slug
        WHEN 'backpedal-to-sprint-turn' THEN 38
        ELSE 64
      END,
      'impactClass','moderate_to_high_by_speed_angle_surface_and_finish',
      'loadTracking',jsonb_build_array(
        'variant_key','side','turn_angle','cue_type','backward_distance',
        'forward_distance','braking_distance','intensity','surface',
        'contacts','repetitions','rest','terminal_action'
      )
    ),
    jsonb_build_object(
      'localMuscleFatigue',seed.local_fatigue,
      'gripFatigue',1,
      'technicalFatigueSensitivity',seed.technical_fatigue,
      'impactAccumulation',seed.impact_accumulation,
      'recoveryHours',seed.recovery_hours,
      'primaryFatigueSites',jsonb_build_array(
        'quadriceps','plantar_flexors','hamstrings_and_gluteals',
        'hip_rotators_and_adductors','feet_and_ankles','trunk_stabilizers'
      ),
      'earlyFatigueSignals',CASE seed.definition_slug
        WHEN 'backpedal-to-sprint-turn' THEN jsonb_build_array(
          'heel_catch_or_trip','upright_or_uncontrolled_backpedal',
          'foot_crossing','late_target_pickup','slower_first_steps',
          'wrong_direction','unsafe_run_out'
        )
        ELSE jsonb_build_array(
          'heel_catch_or_trip','foot_crossing','late_or_crash_braking',
          'knee_or_trunk_collapse','braking_zone_overrun',
          'extra_balance_steps','failed_two_second_hold'
        )
      END,
      'downstreamConflicts',jsonb_build_array(
        'sprint_acceleration_and_max_velocity_volume','change_of_direction_volume',
        'jump_and_landing_volume','high_load_lower_body_strength',
        'sport_practice_with_repeated_braking','fatigue_degraded_conditioning'
      )
    ),
    jsonb_build_object(
      'selectionStatus',CASE
        WHEN seed.selectable THEN 'candidate_requires_human_review'
        ELSE 'blocked_pending_identity_review'
      END,
      'primaryIntent',CASE seed.definition_slug
        WHEN 'backpedal-to-sprint-turn'
          THEN 'backward_to_forward_reorientation_and_acceleration'
        ELSE 'backward_to_forward_reorientation_acceleration_and_braking_control'
      END,
      'appropriatePhases',CASE
        WHEN seed.selectable THEN jsonb_build_array(
          'movement_intelligence','output'
        )
        ELSE jsonb_build_array('identity_review_only')
      END,
      'avoidUse',jsonb_build_array(
        'conditioning_density_that_degrades_speed_or_control',
        'undeclared_turn_side_angle_cue_distance_or_finish',
        'unsafe_lane_surface_run_out_or_braking_zone',
        'pain_or_uncontrolled_lower_speed_rehearsal',
        'unresolved_variant_selection'
      ),
      'cumulativeBudget',jsonb_build_object(
        'backwardContacts',seed.local_fatigue,
        'turnsPerSide',1,
        'accelerationContacts',seed.work_capacity,
        'brakingContacts',CASE seed.definition_slug
          WHEN 'backpedal-to-sprint-to-stick' THEN seed.local_fatigue
          ELSE 0
        END,
        'impact',seed.impact_accumulation,
        'technicalFatigue',seed.technical_fatigue,
        'countInWorkout',seed.selectable
      )
    )
  FROM backpedal_variant_seed seed
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id = 1
   AND definition.slug = seed.definition_slug
   AND definition.status <> 'archived'
  ON CONFLICT (definition_id, variant_key)
  DO UPDATE SET
    display_name = EXCLUDED.display_name,
    modifier_keys = EXCLUDED.modifier_keys,
    difficulty_json = EXCLUDED.difficulty_json,
    requirements_json = EXCLUDED.requirements_json,
    status = 'review',
    load_profile_json = EXCLUDED.load_profile_json,
    fatigue_profile_json = EXCLUDED.fatigue_profile_json,
    programming_profile_json = EXCLUDED.programming_profile_json,
    updated_at = now();

  CREATE TEMP TABLE backpedal_profile_seed (
    definition_slug TEXT NOT NULL,
    variant_key TEXT NOT NULL,
    profile_key TEXT NOT NULL,
    phase_key TEXT NOT NULL,
    role TEXT NOT NULL,
    selectable BOOLEAN NOT NULL,
    PRIMARY KEY (definition_slug, variant_key, profile_key)
  ) ON COMMIT DROP;

  INSERT INTO backpedal_profile_seed
  SELECT
    seed.definition_slug,
    seed.variant_key,
    CASE mode.phase_key
      WHEN 'movement_intelligence' THEN 'movement-rehearsal'
      ELSE 'quality-output'
    END,
    mode.phase_key,
    'primary',
    TRUE
  FROM backpedal_variant_seed seed
  CROSS JOIN (VALUES
    ('movement_intelligence'),
    ('output')
  ) AS mode(phase_key)
  WHERE seed.selectable
  UNION ALL
  SELECT
    seed.definition_slug,
    seed.variant_key,
    'identity-review-only',
    'movement_intelligence',
    'avoid',
    FALSE
  FROM backpedal_variant_seed seed
  WHERE NOT seed.selectable;

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
    status,
    time_model_json,
    dose_scaling_json,
    measurement_json,
    support_prompts_json
  )
  SELECT
    variant.id,
    profile.profile_key,
    profile.phase_key,
    profile.role,
    CASE
      WHEN NOT profile.selectable THEN
        'Preserve the unresolved free-deceleration identity boundary without authorizing workout selection, dosage, or scoring.'
      WHEN profile.phase_key = 'movement_intelligence' THEN
        'Rehearse the exact backward distance, open-turn side and angle, cue rule, forward path, and assigned finish at controlled speed with complete resets.'
      WHEN seed.definition_slug = 'backpedal-to-sprint-turn' THEN
        'Train high-quality backward-to-forward reorientation and acceleration before fatigue, with balanced turn sides and a clear sprint-through run-out.'
      ELSE
        'Train high-quality backward-to-forward reorientation, acceleration, distributed braking, and a balanced terminal stick before fatigue.'
    END,
    CASE
      WHEN NOT profile.selectable THEN 1
      WHEN profile.phase_key = 'movement_intelligence' THEN 90
      ELSE 94
    END,
    CASE
      WHEN NOT profile.selectable THEN 100
      WHEN profile.phase_key = 'movement_intelligence' THEN 92
      ELSE 94
    END,
    jsonb_build_object(
      'reorientationAndAcceleration',CASE
        WHEN profile.selectable THEN 92
        ELSE 0
      END,
      'reactiveDecision',CASE
        WHEN profile.selectable
          AND seed.cue_predictability <> 'preplanned' THEN 92
        ELSE 0
      END,
      'brakingAndBalance',CASE
        WHEN profile.selectable
          AND seed.definition_slug = 'backpedal-to-sprint-to-stick' THEN 94
        ELSE 0
      END,
      'movementRehearsal',CASE
        WHEN profile.selectable
          AND profile.phase_key = 'movement_intelligence' THEN 96
        ELSE 0
      END,
      'highIntentOutput',CASE
        WHEN profile.selectable AND profile.phase_key = 'output' THEN 96
        ELSE 0
      END,
      'productionAuthorized',profile.selectable
    ),
    CASE
      WHEN NOT profile.selectable THEN jsonb_build_object(
        'doseAuthorized',FALSE,
        'reason','terminal_action_identity_review_required'
      )
      ELSE jsonb_build_object(
        'sets',CASE
          WHEN profile.phase_key = 'movement_intelligence'
            THEN jsonb_build_object('min',2,'max',3)
          WHEN seed.definition_slug = 'backpedal-to-sprint-turn'
            THEN jsonb_build_object('min',2,'max',5)
          ELSE jsonb_build_object('min',2,'max',4)
        END,
        'repetitionsPerTurnSide',CASE
          WHEN profile.phase_key = 'movement_intelligence'
            THEN jsonb_build_object('min',2,'max',4)
          WHEN seed.definition_slug = 'backpedal-to-sprint-turn'
            THEN jsonb_build_object('min',2,'max',5)
          ELSE jsonb_build_object('min',2,'max',4)
        END,
        'backwardDistanceMetres',jsonb_build_object('min',2,'max',5),
        'forwardDistanceMetres',CASE seed.definition_slug
          WHEN 'backpedal-to-sprint-turn'
            THEN jsonb_build_object('min',5,'max',15)
          ELSE jsonb_build_object('min',5,'max',10)
        END,
        'brakingDistanceMetres',CASE seed.definition_slug
          WHEN 'backpedal-to-sprint-to-stick'
            THEN jsonb_build_object('min',3,'max',5)
          ELSE NULL
        END,
        'terminalHoldSeconds',CASE seed.definition_slug
          WHEN 'backpedal-to-sprint-to-stick' THEN 2
          ELSE 0
        END,
        'intentPercent',CASE profile.phase_key
          WHEN 'movement_intelligence'
            THEN jsonb_build_object('min',50,'max',75)
          ELSE jsonb_build_object('min',85,'max',100)
        END,
        'restSeconds',CASE profile.phase_key
          WHEN 'movement_intelligence'
            THEN jsonb_build_object('min',60,'max',120)
          ELSE jsonb_build_object('min',90,'max',180)
        END,
        'sidePolicy','alternate_or_block_both_sides_with_equal_declared_dose',
        'repetitionReserve','stop_before_any_trip_turn_braking_target_or_speed_quality_loss',
        'speedLossStopPercent',CASE profile.phase_key
          WHEN 'output' THEN 5
          ELSE 10
        END
      )
    END,
    CASE
      WHEN NOT profile.selectable THEN
        'No repetition passes; the terminal action and identity must be resolved before delivery.'
      WHEN seed.definition_slug = 'backpedal-to-sprint-turn' THEN
        'Rep passes only with the declared side, angle, cue and distances; controlled backward contacts; no foot crossing; target pickup; clean first forward contacts; lane ownership; and a safe sprint-through run-out.'
      ELSE
        'Rep passes only with the declared side, angle, cue and distances; controlled turn and acceleration; braking distributed across the zone; aligned contacts; and a balanced two-second stick or declared safe overrun.'
    END,
    ARRAY[
      'sharp_or_increasing_pain',
      'trip_repeated_heel_catch_or_slip',
      'crossed_feet_uncontrolled_spin_or_knee_collapse',
      'wrong_direction_repeated_anticipation_or_unclear_cue',
      'lane_conflict_or_unsafe_run_out',
      'crash_stop_or_uncontrolled_zone_overrun',
      'technical_quality_or_speed_loss_above_the_declared_threshold'
    ]::TEXT[],
    CASE
      WHEN NOT profile.selectable THEN
        'Do not program this variant. Route the terminal-action identity boundary to content review.'
      WHEN seed.definition_slug = 'backpedal-to-sprint-turn' THEN
        'Mark the backward line, turn angle, sprint target, and run-out. Declare side and cue before each repetition, observe heel clearance and the turn plant, and end the set before speed or direction quality falls.'
      ELSE
        'Mark the backward line, turn angle, sprint target, braking zone, stick target, and overrun. Observe entry speed, braking step distribution, alignment, hold, and the safe exit.'
    END,
    CASE
      WHEN NOT profile.selectable THEN
        'This version is not available until its finish is reviewed.'
      WHEN seed.definition_slug = 'backpedal-to-sprint-turn' THEN
        'Backpedal to the mark, open through the assigned side, find the target, sprint through it, and use the full run-out.'
      ELSE
        'Backpedal to the mark, open and sprint, brake across the zone, and hold the finish for two seconds. Use the overrun if the stick is not safe.'
    END,
    CASE
      WHEN NOT profile.selectable THEN NULL
      WHEN seed.definition_slug = 'backpedal-to-sprint-turn' THEN
        'More repeatable backward-to-forward reorientation, target pickup, and acceleration without conditioning-driven technique loss.'
      ELSE
        'More repeatable backward-to-forward reorientation, acceleration, braking-force distribution, and balanced stopping control.'
    END,
    ARRAY['cones']::TEXT[],
    jsonb_build_object(
      'laneCount',1,
      'athletesPerLane',1,
      'staggerStarts',TRUE,
      'backwardBoundaryRequired',TRUE,
      'turnAndSprintMarkersRequired',TRUE,
      'brakingZoneRequired',seed.definition_slug = 'backpedal-to-sprint-to-stick',
      'runOutOrOverrunRequired',TRUE,
      'crossTrafficAllowed',FALSE,
      'minimumCoachPositions',jsonb_build_array('side_or_rear_for_backpedal_and_turn','finish_for_run_out_or_braking')
    ),
    '{}'::UUID[],
    'review',
    jsonb_build_object(
      'setupSeconds',CASE profile.phase_key
        WHEN 'movement_intelligence' THEN 75
        ELSE 60
      END,
      'secondsPerRepetition',CASE seed.definition_slug
        WHEN 'backpedal-to-sprint-turn' THEN 10
        ELSE 16
      END,
      'restSeconds',CASE profile.phase_key
        WHEN 'movement_intelligence' THEN jsonb_build_object('min',60,'max',120)
        ELSE jsonb_build_object('min',90,'max',180)
      END,
      'sideTransitionSeconds',20,
      'durationFormula','setup + repetitions_by_side * seconds_per_repetition + between_repetition_rest + side_transitions'
    ),
    jsonb_build_object(
      'regressOrder',jsonb_build_array(
        'preplan_side','reduce_to_ninety_degree_turn','walk_or_slow_backpedal',
        'shorten_backward_distance','reduce_forward_speed','increase_lane_width',
        'increase_braking_or_run_out_distance','reduce_repetitions','increase_rest'
      ),
      'progressOrder',jsonb_build_array(
        'repeat_both_sides_at_current_angle','increase_owned_speed',
        'increase_to_180_degree_turn','add_one_declared_live_cue',
        'add_terminal_stick_only_through_the_distinct_definition'
      ),
      'athleteExperienceAffectsSelectionOnly',TRUE,
      'exerciseDifficultyScoresRemainFixed',TRUE
    ),
    jsonb_build_object(
      'requiredFields',jsonb_build_array(
        'variant_key','side','turn_angle','cue_type','correct_response',
        'backward_distance','forward_distance','braking_distance',
        'intent','surface','quality_result','stop_reason','rest_seconds'
      ),
      'contactBudgets',jsonb_build_array(
        'backward_contacts','turn_contacts','acceleration_contacts',
        'braking_contacts','total_change_of_direction_contacts'
      ),
      'qualityMetrics',CASE seed.definition_slug
        WHEN 'backpedal-to-sprint-turn' THEN jsonb_build_array(
          'trip_or_heel_catch','foot_crossing','turn_angle_accuracy',
          'target_pickup','first_three_contact_quality','wrong_response',
          'run_out_safety','speed_loss'
        )
        ELSE jsonb_build_array(
          'trip_or_heel_catch','turn_angle_accuracy','braking_step_count',
          'braking_zone_entry_and_exit','knee_and_trunk_alignment',
          'hold_seconds','extra_balance_steps','speed_loss'
        )
      END,
      'bothSidesReported',TRUE
    ),
    jsonb_build_object(
      'beforeSet',jsonb_build_array(
        'Which side and angle?','Pre-planned or live cue?',
        'Where are the backward line, target, and safe finish?'
      ),
      'afterSet',jsonb_build_array(
        'Any pain, trip, slip, wrong direction, or loss of control?',
        'Did one side or angle change the result?',
        'Did speed, braking, or target pickup fall before the final repetition?'
      ),
      'supportEscalationCodes',jsonb_build_array(
        'BACKPEDAL-IDENTITY','BACKPEDAL-CUE','BACKPEDAL-LANE',
        'BACKPEDAL-PAIN','BACKPEDAL-TRIP','BACKPEDAL-BRAKING',
        'BACKPEDAL-DOSE','BACKPEDAL-MEDIA'
      )
    )
  FROM backpedal_profile_seed profile
  JOIN backpedal_variant_seed seed
    ON seed.definition_slug = profile.definition_slug
   AND seed.variant_key = profile.variant_key
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id = 1
   AND definition.slug = seed.definition_slug
   AND definition.status <> 'archived'
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id = definition.id
   AND variant.variant_key = seed.variant_key
  ON CONFLICT (variant_id, profile_key)
  DO UPDATE SET
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
    status = 'review',
    time_model_json = EXCLUDED.time_model_json,
    dose_scaling_json = EXCLUDED.dose_scaling_json,
    measurement_json = EXCLUDED.measurement_json,
    support_prompts_json = EXCLUDED.support_prompts_json,
    updated_at = now();

  CREATE TEMP TABLE backpedal_evidence_seed (
    section_key TEXT PRIMARY KEY,
    source_url TEXT NOT NULL,
    source_title TEXT NOT NULL,
    source_publisher TEXT NOT NULL,
    source_kind TEXT NOT NULL,
    evidence_quality SMALLINT NOT NULL,
    claims_json JSONB NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO backpedal_evidence_seed VALUES
    ('identity','https://pubmed.ncbi.nlm.nih.gov/2072839/','Lower extremity joint kinetics and energetics during backward running','Medicine and Science in Sports and Exercise','peer_reviewed_research',82,'["Backward running uses lower-extremity joint kinetics and muscular roles that differ from forward running.","{{canonicalName}} must declare backward distance and speed, open-turn angle and side, cue predictability, forward sprint path and distance, terminal action, and safe exit. Generic Turn and Open Turn are the same identity when those dimensions match."]'::JSONB),
    ('taxonomy','https://pmc.ncbi.nlm.nih.gov/articles/PMC9474351/','Biomechanical and Neuromuscular Performance Requirements of Horizontal Deceleration','Sports Medicine','peer_reviewed_research',92,'["Horizontal deceleration is the coordinated reduction of whole-body momentum under task constraints.","{{canonicalName}} belongs to backward locomotion, transverse reorientation, and forward re-acceleration. A live side cue is a reactive variant. A required terminal braking zone and balance hold create the separate terminal-stick identity."]'::JSONB),
    ('anatomy','https://pubmed.ncbi.nlm.nih.gov/2072839/','Lower extremity joint kinetics and energetics during backward running','Medicine and Science in Sports and Exercise','peer_reviewed_research',82,'["Backward running shifts propulsive and absorptive roles between the knee and ankle compared with forward running.","Represent quadriceps, gluteals, hamstrings, plantar flexors, tibialis anterior, hip rotators, abductors and adductors, feet, trunk, and arm action across the backward steps, open turn, acceleration, and any terminal braking."]'::JSONB),
    ('biomechanics','https://pmc.ncbi.nlm.nih.gov/articles/PMC9474351/','Biomechanical and Neuromuscular Performance Requirements of Horizontal Deceleration','Sports Medicine','peer_reviewed_research',92,'["Direction and velocity changes require whole-body momentum control and appropriately oriented braking forces.","Coach {{canonicalName}} with controlled backward contacts, a lower position before the turn, no crossed feet, an open hip and target pickup, clean re-acceleration, and distributed braking when the terminal-stick definition is selected."]'::JSONB),
    ('difficulty','https://pmc.ncbi.nlm.nih.gov/articles/PMC5465987/','Are Change of Direction Speed and Reactive Agility Useful for Determining the Optimal Field Position for Young Soccer Players?','Journal of Human Kinetics','peer_reviewed_research',76,'["The cited study operationalized planned and reactive versions of a similar directional task separately because the reactive task required target identification before direction selection.","Score {{canonicalName}} with exercise complexity and physical difficulty, with overall equal to their maximum. Coordination, supervision, failure consequence, impact, and work-capacity demand are separate programming inputs. Athlete experience affects selection only."]'::JSONB),
    ('load_fatigue_recovery','https://pmc.ncbi.nlm.nih.gov/articles/PMC9474351/','Biomechanical and Neuromuscular Performance Requirements of Horizontal Deceleration','Sports Medicine','peer_reviewed_research',92,'["Rapid braking can impose high impact peaks, loading rates, and eccentric demand; cumulative high-intensity decelerations require load management.","Track backward contacts, turns per side and angle, live decisions, acceleration and braking contacts, intensity, surface, quadriceps and plantar-flexor load, groin and hip-rotator stress, technical fatigue, recovery, and total change-of-direction volume for {{canonicalName}}."]'::JSONB),
    ('constraints','https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf','Developing Linear Speed','National Strength and Conditioning Association','expert_instruction',78,'["Quality speed work requires a suitable surface, marked targets, adequate spacing, a safe finish, and recovery.","Require a clear dry lane, visible backward boundary, turn and sprint targets, safe sightline or cue source, athlete separation, and enough run-out or braking space for {{canonicalName}}. Cones define the path; timing gates and video remain optional."]'::JSONB),
    ('dosage','https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf','Developing Linear Speed','National Strength and Conditioning Association','expert_instruction',78,'["Speed training should prescribe distance, intensity, repetitions, sets, and recovery while preserving quality.","Use two to five high-quality repetitions per turn side for the sprint-through definition or two to four for the terminal-stick definition, generally 2-5 metres backward plus 5-15 metres forward, with 60-180 seconds recovery and a longer braking zone where required."]'::JSONB),
    ('instructions','https://pmc.ncbi.nlm.nih.gov/articles/PMC9474351/','Biomechanical and Neuromuscular Performance Requirements of Horizontal Deceleration','Sports Medicine','peer_reviewed_research',92,'["Braking and direction-change performance depend on momentum control and body orientation for the next task.","For {{canonicalName}}, backpedal under control, lower before the line, open without crossing the feet, find the target, accelerate along the declared path, and use the assigned run-out or multi-step braking-and-stick zone."]'::JSONB),
    ('safety_stop_rules','https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf','Youth Resistance Training: Updated Position Statement Paper From the NSCA','National Strength and Conditioning Association','professional_standard',88,'["Exercise participation should use qualified supervision, correct technique, manageable demands, appropriate progression, and safe equipment and space.","Stop {{canonicalName}} for pain, trip, repeated heel catch, crossed feet, uncontrolled turn, knee collapse, slip, wrong direction, lane conflict, unsafe braking or run-out, repeated anticipation, marked speed loss, or inability to see and use the finish zone."]'::JSONB),
    ('programming','https://www.nsca.com/globalassets/education/nsca-coach/nsca-coach-5.4.pdf','Developing Linear Speed','National Strength and Conditioning Association','expert_instruction',78,'["High-quality acceleration work belongs before fatigue and should not be converted into conditioning by excessive density.","Place {{canonicalName}} in Movement Intelligence for controlled rehearsal or Output for high intent. Teach pre-planned turns before live side choice; use the distinct terminal-stick definition only after safe lower-speed braking is repeatable."]'::JSONB),
    ('athlete_support','https://worldathletics.org/download/downloadnsa?filename=a0cae133-1056-4b89-9f93-16d87fd3bbd4.pdf&urlslug=introduction-to-sprinting','Introduction to Sprinting','World Athletics','governing_body',82,'["Sprint acceleration develops across successive contacts rather than by immediately running upright.","Athlete support for {{canonicalName}} should show the backward stance and sightline, both turn sides and angles, the plant and open-turn sequence, first forward contacts, sprint target, and the exact run-out or braking-and-stick finish from useful views."]'::JSONB),
    ('coach_support','https://pmc.ncbi.nlm.nih.gov/articles/PMC9474351/','Biomechanical and Neuromuscular Performance Requirements of Horizontal Deceleration','Sports Medicine','peer_reviewed_research',92,'["Deceleration assessment should consider approach velocity, braking strategy, body position, and task constraints.","Coach support for {{canonicalName}} should expose distances, angle, side balance, cue schedule, observation positions, plant and trunk checks, contact budgets, error rules, speed-loss stops, and the exact terminal-action identity."]'::JSONB),
    ('accessibility','https://www.nsca.com/about-us/position-statements/youth-training-and-long-term-athletic-development/','Youth Training and Long-Term Athletic Development','National Strength and Conditioning Association','professional_standard',84,'["Long-term movement development should be individualized from current readiness and movement competence.","Make {{canonicalName}} accessible with backward walking, fewer steps, a pre-planned side, a 90-degree turn, lower sprint speed, a wider lane, a larger run-out or braking zone, no timing, more demonstration, and longer recovery. Exercise cards do not carry athlete proficiency levels."]'::JSONB),
    ('alternates','https://pmc.ncbi.nlm.nih.gov/articles/PMC5465987/','Are Change of Direction Speed and Reactive Agility Useful for Determining the Optimal Field Position for Young Soccer Players?','Journal of Human Kinetics','peer_reviewed_research',76,'["Planned and reactive versions can share a movement path while differing in whether the target direction is known before the repetition.","Turn and Open Turn are naming aliases when angle and side rules match. Live cue is a controlled variant. A terminal stick, free deceleration, repeated shuttle, lateral break, or reversed sprint-to-backpedal order requires an explicit variant or distinct-definition review."]'::JSONB),
    ('media','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en','Embed videos and playlists','YouTube Help','manufacturer_instruction',82,'["YouTube documents privacy-enhanced embedding through youtube-nocookie.com.","Visible URLs for {{canonicalName}} remain discovery candidates only. Playback, embedding, exact distance, angle, side, cue, terminal action, complete viewing, captions, safety, reviewer identity, and approval are separate human gates."]'::JSONB);

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
    definition.id,
    definition.card_version,
    evidence.section_key,
    evidence.source_url,
    evidence.source_title,
    evidence.source_publisher,
    evidence.source_kind,
    replace(
      evidence.claims_json::TEXT,
      '{{canonicalName}}',
      definition.canonical_name
    )::JSONB,
    evidence.evidence_quality,
    'candidate',
    NULL,
    NULL
  FROM coaching.exercise_definition_v1 definition
  CROSS JOIN backpedal_evidence_seed evidence
  WHERE definition.facility_id = 1
    AND definition.slug IN (
      'backpedal-to-sprint-turn',
      'backpedal-to-sprint-to-stick'
    )
    AND definition.status <> 'archived'
  ON CONFLICT (
    definition_id,
    reviewed_card_version,
    section_key,
    source_url
  )
  DO UPDATE SET
    source_title = EXCLUDED.source_title,
    source_publisher = EXCLUDED.source_publisher,
    source_kind = EXCLUDED.source_kind,
    claims_json = EXCLUDED.claims_json,
    evidence_quality = EXCLUDED.evidence_quality,
    review_status = 'candidate',
    reviewer_user_id = NULL,
    reviewed_at = NULL,
    updated_at = now();

  CREATE TEMP TABLE backpedal_relationship_seed (
    from_slug TEXT NOT NULL,
    from_key TEXT NOT NULL,
    to_slug TEXT NOT NULL,
    to_key TEXT NOT NULL,
    relationship TEXT NOT NULL,
    similarity SMALLINT NOT NULL,
    reason TEXT NOT NULL,
    conditions JSONB NOT NULL,
    PRIMARY KEY (
      from_slug,
      from_key,
      to_slug,
      to_key,
      relationship
    )
  ) ON COMMIT DROP;

  INSERT INTO backpedal_relationship_seed VALUES
    ('backpedal-to-sprint-turn','preplanned-90','backpedal-to-sprint-turn','preplanned-180','progression',88,'The 180-degree variant increases reorientation, blind-space, target reacquisition, turn-plant, and coordination demand while preserving the pre-planned sprint-through contract.','{"changedAttributes":["turn_angle","visual_reacquisition","coordination","failure_consequence"],"condition":"both_90_degree_turn_sides_are_repeatable_at_the_assigned_speed","humanReviewRequired":true}'::JSONB),
    ('backpedal-to-sprint-turn','preplanned-180','backpedal-to-sprint-turn','preplanned-90','regression',88,'The 90-degree variant reduces reorientation and blind-space demand while preserving backward travel, an open turn, forward acceleration, and sprint-through finish.','{"changedAttributes":["turn_angle","visual_reacquisition","coordination"],"condition":"use_when_180_degree_target_pickup_or_turn_control_is_not_repeatable","humanReviewRequired":true}'::JSONB),
    ('backpedal-to-sprint-turn','preplanned-90','backpedal-to-sprint-turn','reactive-90','progression',86,'The live-cue variant adds stimulus recognition, response inhibition, direction selection, wrong-response rules, and reset demand to the same 90-degree path.','{"changedAttributes":["cue_predictability","decision","wrong_response_rule","supervision"],"condition":"preplanned_90_degree_turns_are_repeatable_on_both_sides","humanReviewRequired":true}'::JSONB),
    ('backpedal-to-sprint-turn','reactive-90','backpedal-to-sprint-turn','preplanned-90','regression',86,'Pre-planning the side removes the live decision while preserving the same 90-degree movement path.','{"changedAttributes":["cue_predictability","decision","wrong_response_rule"],"condition":"use_when_accuracy_anticipation_or_cue_comprehension_limits_reactive_quality","humanReviewRequired":true}'::JSONB),
    ('backpedal-to-sprint-turn','preplanned-180','backpedal-to-sprint-turn','reactive-180','progression',84,'The live-cue 180-degree variant adds an unpredictable side decision to the larger reorientation task.','{"changedAttributes":["cue_predictability","decision","wrong_response_rule","supervision"],"condition":"preplanned_180_degree_turns_are_repeatable_on_both_sides","humanReviewRequired":true}'::JSONB),
    ('backpedal-to-sprint-turn','reactive-180','backpedal-to-sprint-turn','preplanned-180','regression',84,'Pre-planning the side removes the reactive decision while preserving the 180-degree path and sprint-through finish.','{"changedAttributes":["cue_predictability","decision","wrong_response_rule"],"condition":"use_when_live_cue_accuracy_or_safety_limits_the_reactive_variant","humanReviewRequired":true}'::JSONB),
    ('backpedal-to-sprint-to-stick','preplanned-90-stick','backpedal-to-sprint-to-stick','preplanned-180-stick','progression',88,'The 180-degree stick variant increases reorientation and target reacquisition before the same distributed braking-and-hold contract.','{"changedAttributes":["turn_angle","visual_reacquisition","coordination","braking_entry"],"condition":"both_90_degree_stick_sides_are_repeatable_inside_the_zone","humanReviewRequired":true}'::JSONB),
    ('backpedal-to-sprint-to-stick','preplanned-180-stick','backpedal-to-sprint-to-stick','preplanned-90-stick','regression',88,'The 90-degree stick variant reduces reorientation while preserving acceleration, multi-step braking, and the two-second hold.','{"changedAttributes":["turn_angle","visual_reacquisition","coordination"],"condition":"use_when_180_degree_reorientation_degrades_braking_or_hold_quality","humanReviewRequired":true}'::JSONB),
    ('backpedal-to-sprint-to-stick','preplanned-90-stick','backpedal-to-sprint-to-stick','reactive-90-stick','progression',84,'The reactive 90-degree stick variant adds cue recognition and direction selection before the same acceleration, braking zone, and terminal hold.','{"changedAttributes":["cue_predictability","decision","wrong_response_rule","supervision"],"condition":"preplanned_90_degree_sticks_are_repeatable_on_both_sides","humanReviewRequired":true}'::JSONB),
    ('backpedal-to-sprint-to-stick','reactive-90-stick','backpedal-to-sprint-to-stick','preplanned-90-stick','regression',84,'Pre-planning the side removes the live decision while preserving the 90-degree braking-and-hold task.','{"changedAttributes":["cue_predictability","decision","wrong_response_rule"],"condition":"use_when_reactive_accuracy_or_braking_safety_is_not_repeatable","humanReviewRequired":true}'::JSONB),
    ('backpedal-to-sprint-to-stick','preplanned-180-stick','backpedal-to-sprint-to-stick','reactive-180-stick','progression',82,'The reactive 180-degree stick variant compounds the larger reorientation with an unpredictable side choice before braking.','{"changedAttributes":["cue_predictability","decision","wrong_response_rule","supervision"],"condition":"preplanned_180_degree_sticks_are_repeatable_on_both_sides","humanReviewRequired":true}'::JSONB),
    ('backpedal-to-sprint-to-stick','reactive-180-stick','backpedal-to-sprint-to-stick','preplanned-180-stick','regression',82,'Pre-planning the side removes the live decision while preserving the 180-degree braking-and-hold path.','{"changedAttributes":["cue_predictability","decision","wrong_response_rule"],"condition":"use_when_live_cue_accuracy_or_braking_safety_limits_the_reactive_variant","humanReviewRequired":true}'::JSONB),
    ('backpedal-to-sprint-turn','preplanned-90','backpedal-to-sprint-to-stick','preplanned-90-stick','progression',80,'Adding a required multi-step braking zone and two-second stick changes the terminal outcome and adds eccentric braking, balance, space, impact, and recovery demand.','{"changedAttributes":["terminal_action","braking_zone","hold","eccentric_stress","impact_budget"],"condition":"sprint_through_turn_is_repeatable_and_lower_speed_linear_braking_is_safe","humanReviewRequired":true}'::JSONB),
    ('backpedal-to-sprint-to-stick','preplanned-90-stick','backpedal-to-sprint-turn','preplanned-90','regression',80,'Removing the required terminal stick and using a clear run-out reduces braking and balance demand while preserving the backward-to-forward turn path.','{"changedAttributes":["terminal_action","braking_zone","hold","eccentric_stress"],"condition":"objective_accepts_sprint_through_instead_of_terminal_braking","humanReviewRequired":true}'::JSONB),
    ('backpedal-to-sprint-turn','preplanned-180','backpedal-to-sprint-to-stick','preplanned-180-stick','progression',78,'Adding the terminal braking-and-hold contract after the 180-degree turn increases coordination, eccentric braking, balance, space, and impact-budget demand.','{"changedAttributes":["terminal_action","braking_zone","hold","eccentric_stress","impact_budget"],"condition":"180_degree_sprint_through_turn_is_repeatable_and_braking_prerequisites_are_met","humanReviewRequired":true}'::JSONB),
    ('backpedal-to-sprint-to-stick','preplanned-180-stick','backpedal-to-sprint-turn','preplanned-180','regression',78,'The sprint-through definition removes the terminal braking-and-hold requirement while retaining the 180-degree backward-to-forward reorientation.','{"changedAttributes":["terminal_action","braking_zone","hold","eccentric_stress"],"condition":"objective_accepts_sprint_through_and_a_clear_run_out_is_available","humanReviewRequired":true}'::JSONB);

  INSERT INTO coaching.exercise_relationship_v1 (
    from_variant_id,
    to_variant_id,
    relationship,
    similarity_score,
    dimensions,
    reason,
    conditions_json,
    review_status,
    created_by,
    reviewed_by,
    reviewed_at
  )
  SELECT
    from_variant.id,
    to_variant.id,
    seed.relationship,
    seed.similarity,
    ARRAY[
      'complexity','physical_difficulty','turn_angle','cue',
      'terminal_action','braking','impact','recovery'
    ]::TEXT[],
    seed.reason,
    seed.conditions,
    'review',
    NULL,
    NULL,
    NULL
  FROM backpedal_relationship_seed seed
  JOIN coaching.exercise_definition_v1 from_definition
    ON from_definition.facility_id = 1
   AND from_definition.slug = seed.from_slug
   AND from_definition.status <> 'archived'
  JOIN coaching.exercise_variant_v1 from_variant
    ON from_variant.definition_id = from_definition.id
   AND from_variant.variant_key = seed.from_key
  JOIN coaching.exercise_definition_v1 to_definition
    ON to_definition.facility_id = 1
   AND to_definition.slug = seed.to_slug
   AND to_definition.status <> 'archived'
  JOIN coaching.exercise_variant_v1 to_variant
    ON to_variant.definition_id = to_definition.id
   AND to_variant.variant_key = seed.to_key
  ON CONFLICT (from_variant_id, to_variant_id, relationship)
  DO UPDATE SET
    similarity_score = EXCLUDED.similarity_score,
    dimensions = EXCLUDED.dimensions,
    reason = EXCLUDED.reason,
    conditions_json = EXCLUDED.conditions_json,
    review_status = 'review',
    created_by = NULL,
    reviewed_by = NULL,
    reviewed_at = NULL,
    updated_at = now()
  WHERE coaching.exercise_relationship_v1.review_status = 'review';

  INSERT INTO coaching.exercise_score_calibration_v1 (
    facility_id,
    variant_id,
    dimension,
    proposed_score,
    anchor_tier,
    rationale,
    status,
    version,
    created_by,
    reviewed_by,
    review_notes,
    reviewed_at
  )
  SELECT
    1,
    variant.id,
    dimension.dimension,
    CASE dimension.dimension
      WHEN 'technicalComplexity' THEN seed.complexity
      ELSE seed.physical
    END,
    CASE
      WHEN CASE dimension.dimension
        WHEN 'technicalComplexity' THEN seed.complexity
        ELSE seed.physical
      END <= 30 THEN 20
      WHEN CASE dimension.dimension
        WHEN 'technicalComplexity' THEN seed.complexity
        ELSE seed.physical
      END <= 50 THEN 40
      WHEN CASE dimension.dimension
        WHEN 'technicalComplexity' THEN seed.complexity
        ELSE seed.physical
      END <= 70 THEN 60
      ELSE 80
    END,
    CASE dimension.dimension
      WHEN 'technicalComplexity' THEN
        'Candidate exercise-complexity score reflects backward locomotion, turn angle and side, open-turn mechanics, cue predictability, target pickup, acceleration, terminal action, lane control, and repeatability; human anchor review is pending.'
      ELSE
        'Candidate physical-difficulty score reflects bodyweight locomotion rather than external load. Speed, impact, eccentric braking, fatigue, and failure consequence are tracked separately; human anchor review is pending.'
    END,
    'review',
    1,
    NULL,
    NULL,
    'Candidate migration-407 anchor; independent human review required.',
    NULL
  FROM backpedal_variant_seed seed
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id = 1
   AND definition.slug = seed.definition_slug
   AND definition.status <> 'archived'
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id = definition.id
   AND variant.variant_key = seed.variant_key
  CROSS JOIN (VALUES
    ('technicalComplexity'),
    ('absoluteLoadDemand')
  ) AS dimension(dimension)
  WHERE seed.complexity IS NOT NULL
    AND seed.physical IS NOT NULL
  ON CONFLICT (facility_id, variant_id, dimension, version)
  DO UPDATE SET
    proposed_score = EXCLUDED.proposed_score,
    anchor_tier = EXCLUDED.anchor_tier,
    rationale = EXCLUDED.rationale,
    status = 'review',
    created_by = NULL,
    reviewed_by = NULL,
    review_notes = EXCLUDED.review_notes,
    reviewed_at = NULL,
    updated_at = now()
  WHERE coaching.exercise_score_calibration_v1.status = 'review';

  CREATE TEMP TABLE backpedal_media_seed (
    definition_slug TEXT NOT NULL,
    video_id TEXT NOT NULL,
    title TEXT NOT NULL,
    channel_name TEXT NOT NULL,
    source_query TEXT NOT NULL,
    notes TEXT NOT NULL,
    PRIMARY KEY (definition_slug, video_id)
  ) ON COMMIT DROP;

  INSERT INTO backpedal_media_seed VALUES
    ('backpedal-to-sprint-turn','efQLNVcbacY','Backpedal to Sprint | Change of Direction DB Drill','Simple Speed Coach','Research-batch candidate: backpedal to sprint','The research batch recorded this title in a public-search snapshot on 2026-07-26. This migration does not reverify playback or embedding. Exact angle, side, distance, cue, finish, complete sequence, safety, captions, accessibility, and demonstration quality require human review.'),
    ('backpedal-to-sprint-turn','uCsY1saY1og','Backpedal to Turn and Sprint','Annex Performance and Fitness','Research-batch candidate: backpedal open turn to sprint drill','The research batch recorded this title in a public-search snapshot on 2026-07-26. Playback, embedding, exact path, complete viewing, cues, captions, accessibility, reviewer identity, and approval remain unverified.'),
    ('backpedal-to-sprint-turn','pjMhiDcQrNE','Back Pedal to 180 Turn and Sprint','Performance Course','Research-batch candidate: backpedal 180 turn to sprint','Candidate for the 180-degree profile only. The historical title does not establish exact match. Playback, embedding, distances, cue, terminal action, safety, captions, accessibility, and full content require human review.'),
    ('backpedal-to-sprint-turn','pkegBuBghpg','Backpedal to 90 Degree Sprint','Performance Course','Research-batch candidate: backpedal 90 degree sprint','Candidate for the 90-degree profile only. The historical title does not establish exact match. Playback, embedding, distances, cue, terminal action, safety, captions, accessibility, and full content require human review.'),
    ('backpedal-to-sprint-turn','8DTlAOcua6s','Backpedal, Turn, Angled Sprint','Terp Strength','Research-batch candidate: backpedal angled sprint','The research batch recorded this title in a public-search snapshot on 2026-07-26. Exact turn angle, side, cue, distances, finish, playback, embedding, full content, captions, and demonstration quality require human review.'),
    ('backpedal-to-sprint-to-stick','H2d-tqSKxtg','Ricochet Drill - 2 Step Backpedal to Sprint and Stick','Performance Course','Research-batch candidate: backpedal sprint and stick','Historical title is a potentially exact terminal-stick candidate, not an approval. Playback, embedding, exact sequence, braking zone, two-second hold, safety, captions, accessibility, and complete viewing require human review.'),
    ('backpedal-to-sprint-to-stick','II72PAlImbM','Backpedal Break to Stick','YST Exercises','Research-batch candidate: backpedal break to stick','Historical title is a near-match candidate, not an approval. Playback, embedding, exact backward and forward distances, angle, side, braking steps, hold, safety, captions, and full content require human review.'),
    ('backpedal-to-sprint-to-stick','efQLNVcbacY','Backpedal to Sprint | Change of Direction DB Drill','Simple Speed Coach','Research-batch adjacent candidate: backpedal to sprint','This may show only the base transition component. It is not treated as an exact terminal-stick match. Playback, embedding, finish, braking, captions, accessibility, and complete viewing require human review.'),
    ('backpedal-to-sprint-to-stick','sz45B4GpEXw','The Backpedal, Slide, & Sprint Drill','Jr. NBA Jr. WNBA','Research-batch adjacent candidate: backpedal slide sprint drill','The title adds a slide and may omit the exact terminal stick. It remains an adjacent discovery candidate with playback, embedding, sequence, safety, captions, accessibility, and quality unverified.'),
    ('backpedal-to-sprint-to-stick','xmQ6aSsDaE4','Acceleration/Deceleration Training for Athletes: 5-10-5 Backpedal Sprint','UofL Health','Research-batch adjacent candidate: acceleration deceleration backpedal sprint','The title describes a broader shuttle and deceleration task. It is not treated as an exact match. Playback, embedding, exact sequence, turn, braking, hold, captions, accessibility, and complete viewing require human review.');

  INSERT INTO coaching.exercise_media_candidate_v1 (
    definition_id,
    variant_id,
    reviewed_card_version,
    url,
    embed_url,
    video_id,
    title,
    channel_name,
    duration_seconds,
    language_code,
    captions_available,
    embedding_allowed,
    exact_variant_match,
    demonstration_quality_score,
    link_status,
    review_status,
    discovery_method,
    source_query,
    reviewer_user_id,
    reviewed_at,
    next_review_at,
    notes
  )
  SELECT
    definition.id,
    NULL,
    definition.card_version,
    'https://www.youtube.com/watch?v=' || media.video_id,
    'https://www.youtube-nocookie.com/embed/' || media.video_id,
    media.video_id,
    media.title,
    media.channel_name,
    NULL,
    'en',
    NULL,
    FALSE,
    NULL,
    NULL,
    'unverified',
    'candidate',
    'manual_research',
    media.source_query,
    NULL,
    NULL,
    NULL,
    media.notes
  FROM backpedal_media_seed media
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id = 1
   AND definition.slug = media.definition_slug
   AND definition.status <> 'archived'
  ON CONFLICT (definition_id, reviewed_card_version, video_id)
  DO UPDATE SET
    variant_id = NULL,
    url = EXCLUDED.url,
    embed_url = EXCLUDED.embed_url,
    title = EXCLUDED.title,
    channel_name = EXCLUDED.channel_name,
    duration_seconds = NULL,
    language_code = 'en',
    captions_available = NULL,
    embedding_allowed = FALSE,
    exact_variant_match = NULL,
    demonstration_quality_score = NULL,
    link_status = 'unverified',
    review_status = 'candidate',
    discovery_method = 'manual_research',
    source_query = EXCLUDED.source_query,
    reviewer_user_id = NULL,
    reviewed_at = NULL,
    next_review_at = NULL,
    notes = EXCLUDED.notes,
    updated_at = now();

  CREATE TEMP TABLE backpedal_alternate_seed (
    definition_slug TEXT NOT NULL,
    alternate_name TEXT NOT NULL,
    classification TEXT NOT NULL,
    rationale TEXT NOT NULL,
    dimensions JSONB NOT NULL,
    PRIMARY KEY (definition_slug, alternate_name)
  ) ON COMMIT DROP;

  INSERT INTO backpedal_alternate_seed VALUES
    ('backpedal-to-sprint-turn','Backpedal-to-Sprint Open Turn','same_identity','Open Turn specifies the same hip-opening transition as the stable sprint-through identity.','{"nameSpecificity":"open_turn"}'::JSONB),
    ('backpedal-to-sprint-turn','Backpedal to 90-Degree Sprint','modifier_annotation','Turn angle is a required controlled variant dimension.','{"variantKey":"preplanned-90","turnAngleDegrees":90}'::JSONB),
    ('backpedal-to-sprint-turn','Backpedal to 180-Degree Sprint','modifier_annotation','Turn angle is a required controlled variant dimension.','{"variantKey":"preplanned-180","turnAngleDegrees":180}'::JSONB),
    ('backpedal-to-sprint-turn','Backpedal Turn on Signal','new_variant','An unpredictable valid cue adds stimulus recognition, response inhibition, direction selection, and wrong-response rules.','{"variantKeys":["reactive-90","reactive-180"],"cuePredictability":"unpredictable_valid_side_cue"}'::JSONB),
    ('backpedal-to-sprint-turn','Backpedal-to-Sprint-to-Stick','new_definition','A required terminal braking zone and two-second balance hold change the outcome, contact budget, space, fatigue, coaching, and stop rules.','{"terminalAction":"multi_step_braking_to_two_second_stick"}'::JSONB),
    ('backpedal-to-sprint-to-stick','Backpedal-to-Sprint Open Turn','new_definition','The sprint-through definition lacks the required terminal braking zone and two-second hold.','{"terminalAction":"sprint_through_target"}'::JSONB),
    ('backpedal-to-sprint-to-stick','Backpedal-to-Sprint-to-Two-Step Stick','same_identity','A reviewed maximum braking-step rule is a delivery constraint within the same terminal-stick identity.','{"maximumBrakingSteps":2,"terminalHoldSeconds":2}'::JSONB),
    ('backpedal-to-sprint-to-stick','Backpedal-to-Sprint-to-Free Deceleration','new_variant','Removing the hold changes the quality gate and may cross an identity boundary; the candidate remains nonselectable and unscored pending review.','{"variantKey":"free-deceleration-no-hold-unresolved","terminalAction":"free_deceleration_without_terminal_hold","identityQuarantine":true}'::JSONB),
    ('backpedal-to-sprint-to-stick','Backpedal Turn on Signal to Stick','new_variant','Adding an unpredictable turn-side cue compounds reaction, reorientation, braking, and supervision demands.','{"variantKeys":["reactive-90-stick","reactive-180-stick"],"cuePredictability":"unpredictable_valid_side_cue"}'::JSONB),
    ('backpedal-to-sprint-to-stick','Sprint-to-Stick Deceleration','new_definition','Removing the backward and turning phases creates a simpler forward linear braking task with a different sequence and contact budget.','{"entrySequence":"forward_sprint_only","terminalAction":"stick"}'::JSONB);

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
  FROM backpedal_alternate_seed alternate
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id = 1
   AND definition.slug = alternate.definition_slug
   AND definition.status <> 'archived'
  ON CONFLICT (definition_id, reviewed_card_version, alternate_name)
  DO UPDATE SET
    classification = EXCLUDED.classification,
    rationale = EXCLUDED.rationale,
    distinguishing_dimensions = EXCLUDED.distinguishing_dimensions,
    proposed_card_json = NULL,
    review_status = 'candidate',
    reviewer_user_id = NULL,
    reviewed_at = NULL,
    updated_at = now();

  UPDATE coaching.exercise_score_v1 score
  SET technical_complexity = seed.complexity,
      absolute_load_demand = seed.physical,
      coordination_demand = seed.coordination,
      impact = seed.impact,
      supervision_demand = seed.supervision,
      base_overall_difficulty = greatest(seed.complexity,seed.physical),
      legacy_scores = coalesce(score.legacy_scores, '{}'::JSONB)
        || jsonb_build_object(
          'migration',migration_key,
          'researchBatch',research_batch,
          'difficultyModel','max_exercise_complexity_physical_difficulty',
          'dimensionMeaning',jsonb_build_object(
            'technicalComplexity','exercise_complexity',
            'absoluteLoadDemand','physical_difficulty'
          ),
          'candidateOnly',TRUE,
          'humanReviewRequired',TRUE,
          'approvalsCreated',FALSE
        ),
      migration_confidence = seed.confidence,
      human_review_status = 'queued',
      reviewed_by = NULL,
      reviewed_at = NULL,
      review_notes = seed.notes,
      updated_at = now()
  FROM (VALUES
    (123::BIGINT,64::SMALLINT,12::SMALLINT,70::SMALLINT,56::SMALLINT,60::SMALLINT,66::SMALLINT,'Candidate pre-planned open-turn family score; human review required.'::TEXT),
    (297::BIGINT,64::SMALLINT,12::SMALLINT,70::SMALLINT,56::SMALLINT,60::SMALLINT,66::SMALLINT,'Candidate pre-planned open-turn alias score; human review required.'::TEXT),
    (1242::BIGINT,70::SMALLINT,12::SMALLINT,80::SMALLINT,58::SMALLINT,72::SMALLINT,64::SMALLINT,'Candidate live-cue open-turn variant score; human review required.'::TEXT),
    (549::BIGINT,72::SMALLINT,14::SMALLINT,74::SMALLINT,64::SMALLINT,70::SMALLINT,64::SMALLINT,'Candidate terminal-stick definition score; human review required.'::TEXT)
  ) AS seed(
    legacy_exercise_id,
    complexity,
    physical,
    coordination,
    impact,
    supervision,
    confidence,
    notes
  )
  WHERE score.exercise_id = seed.legacy_exercise_id
    AND score.human_review_status = 'queued'
    AND score.reviewed_by IS NULL
    AND score.reviewed_at IS NULL;

  INSERT INTO coaching.exercise_card_test_packet_v1 (
    definition_id,
    facility_id,
    card_version,
    schema_version,
    audit_version,
    status,
    checks_json,
    blocking_issues_json,
    human_review_required,
    checked_at
  )
  SELECT
    definition.id,
    definition.facility_id,
    definition.card_version,
    definition.schema_version,
    migration_key,
    'quarantined',
    jsonb_build_object(
      'stableIdentityAndAliases',TRUE,
      'identityConsolidationsPresent',(
        definition.slug = 'backpedal-to-sprint-to-stick'
        OR consolidation_count = 2
      ),
      'terminalStickBoundaryPresent',distinct_boundary_count = 1,
      'hopAndGoBoundaryPresent',hop_and_go_boundary_count = 1,
      'controlledTaxonomyPresent',
        cardinality(definition.movement_patterns) >= 3,
      'anatomyJointsActionsPlanesLateralityPresent',
        definition.anatomy_json ? 'primaryMusclesAndTissues'
        AND definition.anatomy_json ? 'secondaryMusclesAndTissues'
        AND definition.anatomy_json ? 'joints'
        AND definition.anatomy_json ? 'actions'
        AND definition.anatomy_json ? 'planes'
        AND definition.anatomy_json ? 'laterality',
      'exactReviewVariantCount',(
        SELECT count(*)
        FROM backpedal_variant_seed seed
        JOIN coaching.exercise_variant_v1 variant
          ON variant.definition_id = definition.id
         AND variant.variant_key = seed.variant_key
         AND variant.status = 'review'
        WHERE seed.definition_slug = definition.slug
      ),
      'selectableVariantCount',(
        SELECT count(*)
        FROM backpedal_variant_seed seed
        JOIN coaching.exercise_variant_v1 variant
          ON variant.definition_id = definition.id
         AND variant.variant_key = seed.variant_key
         AND variant.status = 'review'
        WHERE seed.definition_slug = definition.slug
          AND seed.selectable
          AND variant.requirements_json->>'selectable' = 'true'
          AND variant.requirements_json->>'identityQuarantine' = 'false'
      ),
      'unresolvedVariantCount',(
        SELECT count(*)
        FROM backpedal_variant_seed seed
        JOIN coaching.exercise_variant_v1 variant
          ON variant.definition_id = definition.id
         AND variant.variant_key = seed.variant_key
         AND variant.status = 'review'
        WHERE seed.definition_slug = definition.slug
          AND NOT seed.selectable
          AND variant.requirements_json->>'selectable' = 'false'
          AND variant.requirements_json->>'identityQuarantine' = 'true'
          AND variant.difficulty_json->>'scoreDeferred' = 'true'
      ),
      'difficultyFormulaValid',NOT EXISTS (
        SELECT 1
        FROM backpedal_variant_seed seed
        JOIN coaching.exercise_variant_v1 variant
          ON variant.definition_id = definition.id
         AND variant.variant_key = seed.variant_key
        WHERE seed.definition_slug = definition.slug
          AND (
            (
              seed.complexity IS NOT NULL
              AND (
                (variant.difficulty_json->>'technicalComplexity')::INTEGER
                  <> seed.complexity
                OR (variant.difficulty_json->>'absoluteLoadDemand')::INTEGER
                  <> seed.physical
                OR (variant.difficulty_json->>'baseOverallDifficulty')::INTEGER
                  <> greatest(seed.complexity,seed.physical)
              )
            )
            OR (
              seed.complexity IS NULL
              AND variant.difficulty_json->>'scoreDeferred' IS DISTINCT FROM 'true'
            )
          )
      ),
      'exerciseProficiencyClassificationAbsent',
        NOT coaching.exercise_json_has_level_classification(
          jsonb_build_array(
            definition.provenance_json,
            definition.environment_json,
            definition.population_json,
            definition.anatomy_json,
            definition.athlete_support_json,
            definition.coach_support_json,
            definition.support_operations_json
          )
        ),
      'loadFatigueRecoveryPresent',NOT EXISTS (
        SELECT 1
        FROM backpedal_variant_seed seed
        JOIN coaching.exercise_variant_v1 variant
          ON variant.definition_id = definition.id
         AND variant.variant_key = seed.variant_key
        WHERE seed.definition_slug = definition.slug
          AND (
            variant.load_profile_json = '{}'::JSONB
            OR variant.fatigue_profile_json = '{}'::JSONB
            OR NOT (variant.fatigue_profile_json ? 'recoveryHours')
          )
      ),
      'cumulativeBudgetsPresent',NOT EXISTS (
        SELECT 1
        FROM backpedal_variant_seed seed
        JOIN coaching.exercise_variant_v1 variant
          ON variant.definition_id = definition.id
         AND variant.variant_key = seed.variant_key
        WHERE seed.definition_slug = definition.slug
          AND NOT (variant.programming_profile_json ? 'cumulativeBudget')
      ),
      'equipmentEnvironmentPopulationPresent',
        cardinality(definition.required_equipment) > 0
        AND definition.environment_json <> '{}'::JSONB
        AND definition.population_json <> '{}'::JSONB,
      'deliveryProfileCount',(
        SELECT count(*)
        FROM backpedal_profile_seed profile
        JOIN coaching.exercise_variant_v1 variant
          ON variant.definition_id = definition.id
         AND variant.variant_key = profile.variant_key
        JOIN coaching.exercise_delivery_profile_v1 delivery
          ON delivery.variant_id = variant.id
         AND delivery.profile_key = profile.profile_key
         AND delivery.status = 'review'
        WHERE profile.definition_slug = definition.slug
      ),
      'coachAndAthleteSupportPresent',
        definition.coach_support_json <> '{}'::JSONB
        AND definition.athlete_support_json <> '{}'::JSONB,
      'allEvidenceSectionsPresent',(
        SELECT count(DISTINCT evidence.section_key)
        FROM coaching.exercise_section_evidence_v1 evidence
        WHERE evidence.definition_id = definition.id
          AND evidence.reviewed_card_version = definition.card_version
          AND evidence.review_status = 'candidate'
      ) = 16,
      'mediaCandidateCount',(
        SELECT count(DISTINCT media.video_id)
        FROM coaching.exercise_media_candidate_v1 media
        WHERE media.definition_id = definition.id
          AND media.reviewed_card_version = definition.card_version
          AND media.review_status = 'candidate'
          AND media.link_status = 'unverified'
          AND media.embedding_allowed IS FALSE
      ),
      'mediaVerifiedOrApprovedCount',(
        SELECT count(*)
        FROM coaching.exercise_media_candidate_v1 media
        WHERE media.definition_id = definition.id
          AND media.reviewed_card_version = definition.card_version
          AND (
            media.link_status = 'healthy'
            OR media.embedding_allowed IS TRUE
            OR media.exact_variant_match IS NOT NULL
            OR media.demonstration_quality_score IS NOT NULL
            OR media.review_status <> 'candidate'
            OR media.reviewer_user_id IS NOT NULL
            OR media.reviewed_at IS NOT NULL
          )
      ),
      'alternateAssessmentsPresent',(
        SELECT count(*)
        FROM coaching.exercise_alternate_assessment_v1 alternate
        WHERE alternate.definition_id = definition.id
          AND alternate.reviewed_card_version = definition.card_version
          AND alternate.review_status = 'candidate'
      ) = 5,
      'relationshipsAreReviewOnly',NOT EXISTS (
        SELECT 1
        FROM backpedal_relationship_seed seed
        JOIN coaching.exercise_definition_v1 from_definition
          ON from_definition.facility_id = 1
         AND from_definition.slug = seed.from_slug
        JOIN coaching.exercise_variant_v1 from_variant
          ON from_variant.definition_id = from_definition.id
         AND from_variant.variant_key = seed.from_key
        JOIN coaching.exercise_definition_v1 to_definition
          ON to_definition.facility_id = 1
         AND to_definition.slug = seed.to_slug
        JOIN coaching.exercise_variant_v1 to_variant
          ON to_variant.definition_id = to_definition.id
         AND to_variant.variant_key = seed.to_key
        JOIN coaching.exercise_relationship_v1 relationship
          ON relationship.from_variant_id = from_variant.id
         AND relationship.to_variant_id = to_variant.id
         AND relationship.relationship = seed.relationship
        WHERE relationship.review_status <> 'review'
           OR relationship.reviewed_by IS NOT NULL
           OR relationship.reviewed_at IS NOT NULL
      ),
      'calibrationsAreReviewOnly',NOT EXISTS (
        SELECT 1
        FROM backpedal_variant_seed seed
        JOIN coaching.exercise_variant_v1 variant
          ON variant.definition_id = definition.id
         AND variant.variant_key = seed.variant_key
        JOIN coaching.exercise_score_calibration_v1 calibration
          ON calibration.variant_id = variant.id
        WHERE seed.definition_slug = definition.slug
          AND (
            calibration.status <> 'review'
            OR calibration.reviewed_by IS NOT NULL
            OR calibration.reviewed_at IS NOT NULL
          )
      )
    ),
    jsonb_build_array(
      jsonb_build_object(
        'code','CARD-EVIDENCE-02',
        'message','All 16 evidence sections remain candidate component evidence and require independent card-level review.'
      ),
      jsonb_build_object(
        'code','CARD-MEDIA-01',
        'message','Five public YouTube candidates require current playback, oEmbed, exact-angle, exact-cue, exact-terminal-action, safety, caption, accessibility, quality, reviewer, and approval review.'
      ),
      jsonb_build_object(
        'code','CARD-PUBLISH-01',
        'message','No current two-person card or publication approval exists.'
      ),
      jsonb_build_object(
        'code','CARD-GRAPH-03',
        'message','Review-only progression and regression relationships require human approval.'
      ),
      jsonb_build_object(
        'code','CARD-CALIBRATION-01',
        'message','Exercise-complexity and physical-difficulty proposals require independent human anchor review.'
      )
    ) || CASE definition.slug
      WHEN 'backpedal-to-sprint-to-stick' THEN jsonb_build_array(
        jsonb_build_object(
          'code','CARD-IDENTITY-05',
          'message','Free deceleration without a terminal hold remains nonselectable and unscored until its identity boundary is reviewed.'
        )
      )
      ELSE '[]'::JSONB
    END,
    TRUE,
    now()
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.facility_id = 1
    AND definition.slug IN (
      'backpedal-to-sprint-turn',
      'backpedal-to-sprint-to-stick'
    )
    AND definition.status <> 'archived'
  ON CONFLICT (definition_id)
  DO UPDATE SET
    facility_id = EXCLUDED.facility_id,
    card_version = EXCLUDED.card_version,
    schema_version = EXCLUDED.schema_version,
    audit_version = EXCLUDED.audit_version,
    status = EXCLUDED.status,
    checks_json = EXCLUDED.checks_json,
    blocking_issues_json = EXCLUDED.blocking_issues_json,
    human_review_required = TRUE,
    checked_at = now();

  IF EXISTS (
    SELECT 1
    FROM backpedal_variant_seed seed
    JOIN coaching.exercise_definition_v1 definition
      ON definition.facility_id = 1
     AND definition.slug = seed.definition_slug
     AND definition.status <> 'archived'
    JOIN coaching.exercise_variant_v1 variant
      ON variant.definition_id = definition.id
     AND variant.variant_key = seed.variant_key
     AND variant.status = 'review'
    WHERE (
        seed.complexity IS NOT NULL
        AND (
          NOT (variant.difficulty_json ? 'technicalComplexity')
          OR NOT (variant.difficulty_json ? 'absoluteLoadDemand')
          OR NOT (variant.difficulty_json ? 'baseOverallDifficulty')
          OR (variant.difficulty_json->>'baseOverallDifficulty')::INTEGER
            <> greatest(
              (variant.difficulty_json->>'technicalComplexity')::INTEGER,
              (variant.difficulty_json->>'absoluteLoadDemand')::INTEGER
            )
        )
      )
      OR (
        seed.complexity IS NULL
        AND variant.difficulty_json->>'scoreDeferred' IS DISTINCT FROM 'true'
      )
      OR coaching.exercise_json_has_level_classification(
        jsonb_build_array(
          variant.difficulty_json,
          variant.requirements_json,
          variant.load_profile_json,
          variant.fatigue_profile_json,
          variant.programming_profile_json
        )
      )
  ) THEN
    RAISE EXCEPTION
      '% produced an invalid/deferred difficulty state or prohibited level classification',
      migration_key;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM backpedal_profile_seed profile_seed
    JOIN coaching.exercise_definition_v1 definition
      ON definition.facility_id = 1
     AND definition.slug = profile_seed.definition_slug
     AND definition.status <> 'archived'
    JOIN coaching.exercise_variant_v1 variant
      ON variant.definition_id = definition.id
     AND variant.variant_key = profile_seed.variant_key
    JOIN coaching.exercise_delivery_profile_v1 profile
      ON profile.variant_id = variant.id
     AND profile.profile_key = profile_seed.profile_key
     AND profile.status = 'review'
    WHERE coaching.exercise_json_has_level_classification(
      jsonb_build_array(
        profile.objective_relevance_json,
        profile.dosage_json,
        profile.logistics_json,
        profile.time_model_json,
        profile.dose_scaling_json,
        profile.measurement_json,
        profile.support_prompts_json
      )
    )
  ) THEN
    RAISE EXCEPTION
      '% produced a prohibited level classification in a delivery profile',
      migration_key;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_definition_v1 definition
    WHERE definition.facility_id = 1
      AND definition.slug IN (
        'backpedal-to-sprint-turn',
        'backpedal-to-sprint-to-stick'
      )
      AND (
        definition.card_version <> 2
        OR definition.status <> 'review'
        OR definition.approved_video_url IS NOT NULL
        OR definition.reviewed_by IS NOT NULL
        OR definition.approved_by IS NOT NULL
        OR definition.last_reviewed_at IS NOT NULL
        OR definition.provenance_json->>'structuralCompletionMigration'
          IS DISTINCT FROM migration_key
        OR coaching.exercise_json_has_level_classification(
          jsonb_build_array(
            definition.provenance_json,
            definition.environment_json,
            definition.population_json,
            definition.anatomy_json,
            definition.athlete_support_json,
            definition.coach_support_json,
            definition.support_operations_json
          )
        )
      )
  ) THEN
    RAISE EXCEPTION
      '% did not leave both targets at unapproved review card version 2 without proficiency metadata',
      migration_key;
  END IF;

  IF (
    SELECT count(*)
    FROM backpedal_variant_seed seed
    JOIN coaching.exercise_definition_v1 definition
      ON definition.facility_id = 1
     AND definition.slug = seed.definition_slug
    JOIN coaching.exercise_variant_v1 variant
      ON variant.definition_id = definition.id
     AND variant.variant_key = seed.variant_key
     AND variant.status = 'review'
  ) <> 9 THEN
    RAISE EXCEPTION '% did not create all 9 exact review variants', migration_key;
  END IF;

  IF (
    SELECT count(*)
    FROM backpedal_profile_seed seed
    JOIN coaching.exercise_definition_v1 definition
      ON definition.facility_id = 1
     AND definition.slug = seed.definition_slug
    JOIN coaching.exercise_variant_v1 variant
      ON variant.definition_id = definition.id
     AND variant.variant_key = seed.variant_key
    JOIN coaching.exercise_delivery_profile_v1 profile
      ON profile.variant_id = variant.id
     AND profile.profile_key = seed.profile_key
     AND profile.status = 'review'
  ) <> 17 THEN
    RAISE EXCEPTION
      '% did not create all 17 contextual or review-only profiles',
      migration_key;
  END IF;

  IF (
    SELECT count(*)
    FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_section_evidence_v1 evidence
      ON evidence.definition_id = definition.id
     AND evidence.reviewed_card_version = definition.card_version
     AND evidence.review_status = 'candidate'
    WHERE definition.facility_id = 1
      AND definition.slug IN (
        'backpedal-to-sprint-turn',
        'backpedal-to-sprint-to-stick'
      )
  ) <> 32 THEN
    RAISE EXCEPTION
      '% did not create all 32 candidate evidence rows',
      migration_key;
  END IF;

  IF (
    SELECT count(*)
    FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_media_candidate_v1 media
      ON media.definition_id = definition.id
     AND media.reviewed_card_version = definition.card_version
     AND media.review_status = 'candidate'
     AND media.link_status = 'unverified'
     AND media.embedding_allowed IS FALSE
     AND media.exact_variant_match IS NULL
     AND media.demonstration_quality_score IS NULL
     AND media.reviewer_user_id IS NULL
     AND media.reviewed_at IS NULL
    WHERE definition.facility_id = 1
      AND definition.slug IN (
        'backpedal-to-sprint-turn',
        'backpedal-to-sprint-to-stick'
      )
  ) <> 10 THEN
    RAISE EXCEPTION
      '% did not create all 10 unverified, non-embeddable media candidates',
      migration_key;
  END IF;

  IF (
    SELECT count(*)
    FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_alternate_assessment_v1 alternate
      ON alternate.definition_id = definition.id
     AND alternate.reviewed_card_version = definition.card_version
     AND alternate.review_status = 'candidate'
     AND alternate.reviewer_user_id IS NULL
     AND alternate.reviewed_at IS NULL
    WHERE definition.facility_id = 1
      AND definition.slug IN (
        'backpedal-to-sprint-turn',
        'backpedal-to-sprint-to-stick'
      )
  ) <> 10 THEN
    RAISE EXCEPTION
      '% did not create all 10 candidate alternate assessments',
      migration_key;
  END IF;

  IF (
    SELECT count(*)
    FROM backpedal_relationship_seed seed
    JOIN coaching.exercise_definition_v1 from_definition
      ON from_definition.facility_id = 1
     AND from_definition.slug = seed.from_slug
    JOIN coaching.exercise_variant_v1 from_variant
      ON from_variant.definition_id = from_definition.id
     AND from_variant.variant_key = seed.from_key
    JOIN coaching.exercise_definition_v1 to_definition
      ON to_definition.facility_id = 1
     AND to_definition.slug = seed.to_slug
    JOIN coaching.exercise_variant_v1 to_variant
      ON to_variant.definition_id = to_definition.id
     AND to_variant.variant_key = seed.to_key
    JOIN coaching.exercise_relationship_v1 relationship
      ON relationship.from_variant_id = from_variant.id
     AND relationship.to_variant_id = to_variant.id
     AND relationship.relationship = seed.relationship
     AND relationship.review_status = 'review'
     AND relationship.reviewed_by IS NULL
     AND relationship.reviewed_at IS NULL
  ) <> 16 THEN
    RAISE EXCEPTION
      '% did not create all 16 review-only relationships',
      migration_key;
  END IF;

  IF (
    SELECT count(*)
    FROM backpedal_variant_seed seed
    JOIN coaching.exercise_definition_v1 definition
      ON definition.facility_id = 1
     AND definition.slug = seed.definition_slug
    JOIN coaching.exercise_variant_v1 variant
      ON variant.definition_id = definition.id
     AND variant.variant_key = seed.variant_key
    JOIN coaching.exercise_score_calibration_v1 calibration
      ON calibration.variant_id = variant.id
     AND calibration.status = 'review'
     AND calibration.reviewed_by IS NULL
     AND calibration.reviewed_at IS NULL
     AND calibration.dimension IN (
       'technicalComplexity',
       'absoluteLoadDemand'
     )
    WHERE seed.complexity IS NOT NULL
      AND seed.physical IS NOT NULL
  ) <> 16 THEN
    RAISE EXCEPTION
      '% did not create all 16 review-only calibration rows',
      migration_key;
  END IF;

  IF (
    SELECT count(*)
    FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_card_test_packet_v1 packet
      ON packet.definition_id = definition.id
     AND packet.card_version = definition.card_version
     AND packet.status = 'quarantined'
     AND packet.human_review_required IS TRUE
    WHERE definition.facility_id = 1
      AND definition.slug IN (
        'backpedal-to-sprint-turn',
        'backpedal-to-sprint-to-stick'
      )
  ) <> 2 THEN
    RAISE EXCEPTION
      '% did not create both quarantined card test packets',
      migration_key;
  END IF;

  IF (
    SELECT count(*)
    FROM backpedal_variant_seed seed
    JOIN coaching.exercise_definition_v1 definition
      ON definition.facility_id = 1
     AND definition.slug = seed.definition_slug
    JOIN coaching.exercise_variant_v1 variant
      ON variant.definition_id = definition.id
     AND variant.variant_key = seed.variant_key
     AND variant.status = 'review'
     AND variant.requirements_json->>'selectable' = 'true'
     AND variant.requirements_json->>'identityQuarantine' = 'false'
    WHERE seed.selectable
  ) <> 8 OR (
    SELECT count(*)
    FROM backpedal_variant_seed seed
    JOIN coaching.exercise_definition_v1 definition
      ON definition.facility_id = 1
     AND definition.slug = seed.definition_slug
    JOIN coaching.exercise_variant_v1 variant
      ON variant.definition_id = definition.id
     AND variant.variant_key = seed.variant_key
     AND variant.status = 'review'
     AND variant.requirements_json->>'selectable' = 'false'
     AND variant.requirements_json->>'identityQuarantine' = 'true'
     AND variant.difficulty_json->>'scoreDeferred' = 'true'
    WHERE NOT seed.selectable
  ) <> 1 THEN
    RAISE EXCEPTION
      '% produced an invalid selectable or deferred identity boundary',
      migration_key;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_media_candidate_v1 media
      ON media.definition_id = definition.id
     AND media.reviewed_card_version = definition.card_version
    WHERE definition.facility_id = 1
      AND definition.slug IN (
        'backpedal-to-sprint-turn',
        'backpedal-to-sprint-to-stick'
      )
      AND (
        media.review_status <> 'candidate'
        OR media.link_status <> 'unverified'
        OR media.embedding_allowed IS DISTINCT FROM FALSE
        OR media.exact_variant_match IS NOT NULL
        OR media.demonstration_quality_score IS NOT NULL
        OR media.reviewer_user_id IS NOT NULL
        OR media.reviewed_at IS NOT NULL
      )
  ) OR EXISTS (
    SELECT 1
    FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_alternate_assessment_v1 alternate
      ON alternate.definition_id = definition.id
     AND alternate.reviewed_card_version = definition.card_version
    WHERE definition.facility_id = 1
      AND definition.slug IN (
        'backpedal-to-sprint-turn',
        'backpedal-to-sprint-to-stick'
      )
      AND (
        alternate.review_status <> 'candidate'
        OR alternate.reviewer_user_id IS NOT NULL
        OR alternate.reviewed_at IS NOT NULL
      )
  ) OR EXISTS (
    SELECT 1
    FROM backpedal_relationship_seed seed
    JOIN coaching.exercise_definition_v1 from_definition
      ON from_definition.facility_id = 1
     AND from_definition.slug = seed.from_slug
    JOIN coaching.exercise_variant_v1 from_variant
      ON from_variant.definition_id = from_definition.id
     AND from_variant.variant_key = seed.from_key
    JOIN coaching.exercise_definition_v1 to_definition
      ON to_definition.facility_id = 1
     AND to_definition.slug = seed.to_slug
    JOIN coaching.exercise_variant_v1 to_variant
      ON to_variant.definition_id = to_definition.id
     AND to_variant.variant_key = seed.to_key
    JOIN coaching.exercise_relationship_v1 relationship
      ON relationship.from_variant_id = from_variant.id
     AND relationship.to_variant_id = to_variant.id
     AND relationship.relationship = seed.relationship
    WHERE relationship.review_status <> 'review'
       OR relationship.reviewed_by IS NOT NULL
       OR relationship.reviewed_at IS NOT NULL
  ) OR EXISTS (
    SELECT 1
    FROM backpedal_variant_seed seed
    JOIN coaching.exercise_definition_v1 definition
      ON definition.facility_id = 1
     AND definition.slug = seed.definition_slug
    JOIN coaching.exercise_variant_v1 variant
      ON variant.definition_id = definition.id
     AND variant.variant_key = seed.variant_key
    JOIN coaching.exercise_score_calibration_v1 calibration
      ON calibration.variant_id = variant.id
    WHERE calibration.status <> 'review'
       OR calibration.reviewed_by IS NOT NULL
       OR calibration.reviewed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION
      '% created or retained a prohibited media, alternate, graph, or calibration approval',
      migration_key;
  END IF;

  IF (
    SELECT count(*)
    FROM coaching.exercise_score_v1 score
    WHERE score.exercise_id IN (123,297,1242,549)
      AND score.human_review_status = 'queued'
      AND score.reviewed_by IS NULL
      AND score.reviewed_at IS NULL
      AND score.base_overall_difficulty = greatest(
        score.technical_complexity,
        score.absolute_load_demand
      )
      AND score.legacy_scores->>'migration' = migration_key
      AND score.legacy_scores->>'approvalsCreated' = 'false'
  ) <> 4 THEN
    RAISE EXCEPTION
      '% did not update all 4 queued legacy score records without approval',
      migration_key;
  END IF;

  IF (
    SELECT count(DISTINCT source.legacy_exercise_id)
    FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_definition_source_v1 source
      ON source.definition_id = definition.id
    WHERE definition.facility_id = 1
      AND definition.slug IN (
        'backpedal-to-sprint-turn',
        'backpedal-to-sprint-to-stick'
      )
      AND definition.status <> 'archived'
  ) <> 4 THEN
    RAISE EXCEPTION
      '% changed the complete active source-mapping set',
      migration_key;
  END IF;
END
$$;
