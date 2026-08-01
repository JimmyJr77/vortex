-- Complete the consolidated Landmine Push Press, One-Arm Landmine Split Jerk,
-- and Landmine Squat-to-Press candidate cards.
--
-- Migration 388 already consolidates Two-Hand Landmine Push Press into the
-- one-arm source survivor because hand count is an exact push-press variant.
-- This migration completes that survivor and preserves split jerk and
-- squat-to-press as separate ordered-action identities.
--
-- Public-search YouTube URLs are stored as unverified, non-embeddable candidates.
-- No oEmbed, playback, exact-match, caption, accessibility, quality, reviewer,
-- media, graph, calibration, card, or publication approval is claimed.
--
-- Exercise difficulty is exercise complexity plus physical difficulty, with
-- overall derived as their maximum. Athlete proficiency levels remain
-- exclusive to coaching.skill and are intentionally absent.
-- IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '401_coaching_landmine_explosive_press_family_completion';
  research_batch CONSTANT TEXT :=
    'landmine-explosive-press-family-v1';
  research_version CONSTANT TEXT := '2026-07-31.57';
  target_slugs CONSTANT TEXT[] := ARRAY[
    'one-arm-landmine-push-press',
    'one-arm-landmine-split-jerk',
    'landmine-squat-to-press'
  ]::TEXT[];
  target_legacy_ids CONSTANT BIGINT[] :=
    ARRAY[1409,1410,1416,1417]::BIGINT[];
  active_count INTEGER;
  already_applied_count INTEGER;
  protected_count INTEGER;
  source_count INTEGER;
BEGIN
  SELECT count(*)
  INTO active_count
  FROM coaching.exercise_definition_v1
  WHERE facility_id = 1
    AND slug = ANY(target_slugs)
    AND status <> 'archived';

  IF active_count <> 3 THEN
    RAISE EXCEPTION
      '% expected exactly 3 active target definitions; found %',
      migration_key,
      active_count;
  END IF;

  SELECT count(*)
  INTO already_applied_count
  FROM coaching.exercise_definition_v1
  WHERE facility_id = 1
    AND slug = ANY(target_slugs)
    AND status <> 'archived'
    AND provenance_json->>'structuralCompletionMigration' = migration_key;

  IF already_applied_count NOT IN (0, 3) THEN
    RAISE EXCEPTION
      '% found a partial prior application on % of 3 cards',
      migration_key,
      already_applied_count;
  END IF;

  SELECT count(DISTINCT source.legacy_exercise_id)
  INTO source_count
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_definition_source_v1 source
    ON source.definition_id = definition.id
  WHERE definition.facility_id = 1
    AND definition.slug = ANY(target_slugs)
    AND definition.status <> 'archived'
    AND source.legacy_exercise_id = ANY(target_legacy_ids);

  IF source_count <> 4 THEN
    RAISE EXCEPTION
      '% expected all 4 legacy mappings on the active survivor set; found %',
      migration_key,
      source_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM coaching.exercise_definition_v1 survivor
    JOIN coaching.exercise_identity_resolution_v1 resolution
      ON resolution.survivor_definition_id = survivor.id
     AND resolution.decision = 'duplicate_consolidated'
    JOIN coaching.exercise_definition_v1 duplicate
      ON duplicate.id = resolution.resolved_definition_id
    WHERE survivor.facility_id = 1
      AND survivor.slug = 'one-arm-landmine-push-press'
      AND survivor.status <> 'archived'
      AND duplicate.slug = 'two-hand-landmine-push-press'
      AND duplicate.status = 'archived'
  ) THEN
    RAISE EXCEPTION
      '% requires the migration-388 two-hand push-press consolidation',
      migration_key;
  END IF;

  SELECT count(*)
    INTO protected_count
    FROM coaching.exercise_definition_v1 definition
    WHERE definition.facility_id = 1
      AND definition.slug = ANY(target_slugs)
      AND (
        (already_applied_count = 0 AND definition.card_version <> 1)
        OR (already_applied_count = 3 AND definition.card_version <> 2)
        OR definition.status IN ('published','deprecated')
        OR definition.reviewed_by IS NOT NULL
        OR definition.approved_by IS NOT NULL
        OR definition.last_reviewed_at IS NOT NULL
        OR definition.approved_video_url IS NOT NULL
      );

    IF protected_count > 0 THEN
      RAISE EXCEPTION
        '% refused to overwrite % protected canonical definition(s)',
        migration_key,
        protected_count;
    END IF;

    SELECT count(*)
    INTO protected_count
    FROM coaching.exercise_score_v1 score
    WHERE score.exercise_id = ANY(target_legacy_ids)
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
          AND definition.slug = ANY(target_slugs)
          AND (
            variant.status = 'published'
            OR profile.status = 'published'
          )
      )
      + (
        SELECT count(*)
        FROM coaching.exercise_definition_v1 definition
        JOIN coaching.exercise_section_evidence_v1 evidence
          ON evidence.definition_id = definition.id
         AND evidence.reviewed_card_version = definition.card_version
        WHERE definition.facility_id = 1
          AND definition.slug = ANY(target_slugs)
          AND evidence.review_status NOT IN ('candidate','superseded')
      )
      + (
        SELECT count(*)
        FROM coaching.exercise_definition_v1 definition
        JOIN coaching.exercise_media_candidate_v1 media
          ON media.definition_id = definition.id
         AND media.reviewed_card_version = definition.card_version
        WHERE definition.facility_id = 1
          AND definition.slug = ANY(target_slugs)
          AND media.review_status NOT IN ('candidate','superseded')
      )
      + (
        SELECT count(*)
        FROM coaching.exercise_definition_v1 definition
        JOIN coaching.exercise_alternate_assessment_v1 alternate
          ON alternate.definition_id = definition.id
         AND alternate.reviewed_card_version = definition.card_version
        WHERE definition.facility_id = 1
          AND definition.slug = ANY(target_slugs)
          AND alternate.review_status NOT IN ('candidate','superseded')
      )
      + (
        SELECT count(*)
        FROM coaching.exercise_definition_v1 definition
        JOIN coaching.exercise_card_review_v1 review
          ON review.definition_id = definition.id
        WHERE definition.facility_id = 1
          AND definition.slug = ANY(target_slugs)
      )
      + (
        SELECT count(*)
        FROM coaching.exercise_definition_v1 definition
        JOIN coaching.exercise_card_revision_v1 revision
          ON revision.definition_id = definition.id
        WHERE definition.facility_id = 1
          AND definition.slug = ANY(target_slugs)
      )
      + (
        SELECT count(*)
        FROM coaching.exercise_definition_v1 definition
        JOIN coaching.exercise_media_review_v1 review
          ON review.definition_id = definition.id
        WHERE definition.facility_id = 1
          AND definition.slug = ANY(target_slugs)
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
          AND definition.slug = ANY(target_slugs)
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
          AND definition.slug = ANY(target_slugs)
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
      AND definition.slug = ANY(target_slugs);

    UPDATE coaching.exercise_variant_v1 variant
    SET variant_key = left(
          'legacy-source-'
          || coalesce(definition.legacy_exercise_id::TEXT, 'unknown')
          || '-'
          || variant.variant_key,
          120
        ),
        status = 'archived',
        requirements_json = coalesce(variant.requirements_json, '{}'::JSONB)
          || jsonb_build_object(
            'selectable', FALSE,
            'completionQuarantine', TRUE,
            'quarantineReason',
              'Superseded source variant lacks the exact ordered action, stance, hand count, rack, receiving action, load, dose, fatigue, and stop-rule contract.'
          ),
        updated_at = now()
    FROM coaching.exercise_definition_v1 definition
    WHERE variant.definition_id = definition.id
      AND definition.facility_id = 1
      AND definition.slug = ANY(target_slugs);
  END IF;

  CREATE TEMP TABLE explosive_landmine_card_seed (
    slug TEXT PRIMARY KEY,
    canonical_name TEXT NOT NULL,
    aliases TEXT[] NOT NULL,
    description TEXT NOT NULL,
    family_key TEXT NOT NULL,
    movement_patterns TEXT[] NOT NULL,
    body_regions TEXT[] NOT NULL,
    anatomy_json JSONB NOT NULL,
    environment_json JSONB NOT NULL,
    population_json JSONB NOT NULL,
    athlete_support_json JSONB NOT NULL,
    coach_support_json JSONB NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO explosive_landmine_card_seed VALUES
    (
      'one-arm-landmine-push-press',
      'Landmine Push Press',
      ARRAY[
        'One-Arm Landmine Push Press',
        'Single-Arm Landmine Push Press',
        'Unilateral Landmine Push Press',
        'Two-Hand Landmine Push Press',
        'Two-Handed Landmine Push Press',
        'Bilateral Landmine Push Press'
      ]::TEXT[],
      'Perform a controlled shallow dip and continuous forceful lower-body drive into a declared one- or two-hand landmine press. Finish tall without a second receiving dip or deliberate foot relocation, then return to the same rack under control.',
      'landmine_explosive_press',
      ARRAY['push','squat','brace']::TEXT[],
      ARRAY['foot','ankle','knee','hip','pelvis','spine','core','rib_cage','shoulder','scapula','elbow','wrist','hand']::TEXT[],
      jsonb_build_object(
        'primaryMusclesAndTissues', jsonb_build_array(
          'quadriceps','gluteus_maximus','calf_complex',
          'anterior_deltoid','clavicular_pectoralis_major','triceps_brachii'
        ),
        'secondaryMusclesAndTissues', jsonb_build_array(
          'hamstrings','serratus_anterior','trapezius','rotator_cuff',
          'abdominal_wall_and_obliques','spinal_stabilizers',
          'forearm_and_hand_flexors'
        ),
        'joints', jsonb_build_array(
          'foot','ankle','knee','hip','pelvis','spine',
          'glenohumeral','scapulothoracic','acromioclavicular',
          'elbow','radioulnar','wrist','hand'
        ),
        'actions', jsonb_build_array(
          'establish_declared_rack_and_stance','shallow_dip',
          'continuous_ankle_knee_and_hip_extension',
          'shoulder_flexion_in_landmine_arc',
          'scapular_upward_rotation_protraction_and_posterior_tilt',
          'elbow_extension','finish_tall_without_redip',
          'controlled_return_and_set_down'
        ),
        'planes', jsonb_build_array(
          'oblique_sagittal_press_and_lower_body_motion',
          'frontal_and_transverse_stabilization'
        ),
        'laterality',
          'bilateral_lower_body_with_unilateral_or_bilateral_press'
      ),
      jsonb_build_object(
        'required', jsonb_build_array(
          'rated_landmine','compatible_barbell','collars',
          'prescribed_plates','level_high_traction_floor',
          'clear_bar_and_plate_arc','clear_dip_drive_and_set_down_zone'
        ),
        'prohibited', jsonb_build_array(
          'unstable_anchor','loose_or_missing_collar','shared_bar_arc',
          'slippery_floor','blocked_set_down'
        ),
        'coachPosition', 'outside_the_moving_bar_and_plate_arc'
      ),
      jsonb_build_object(
        'readinessChecks', jsonb_build_array(
          'pain_free_shallow_dip_and_press','stable_rack_and_brace',
          'continuous_dip_drive_press_without_redip',
          'controlled_return_and_set_down'
        ),
        'constraints', jsonb_build_array(
          'symptom_free_owned_range','load_matches_current_force_and_control',
          'unilateral_variants_require_side_balance'
        ),
        'contraindications', jsonb_build_array(
          'acute_pain_or_neurologic_symptoms','uncontrolled_dip_or_balance',
          'unsafe_anchor_or_clearance','cannot_control_return'
        )
      ),
      jsonb_build_object(
        'plainLanguageSummary',
          'Dip a little, drive the floor away, and send that force through the landmine. Finish tall and lower under control.',
        'setupChecklist', jsonb_build_array(
          'confirm_anchor_collars_load_and_lane','confirm_hand_count_stance_rack_and_side',
          'brace_before_the_dip'
        ),
        'cues', jsonb_build_array(
          'dip_straight_down','drive_then_press_as_one_action',
          'finish_tall_no_second_dip','lower_to_the_same_rack'
        ),
        'accessibilityOptions', jsonb_build_array(
          'unloaded_or_lighter_bar','lower_velocity_rehearsal',
          'fewer_repetitions_and_longer_rest','floor_markers',
          'written_audio_still_image_or_live_instruction'
        )
      ),
      jsonb_build_object(
        'observationPriorities', jsonb_build_array(
          'anchor_and_clearance','rack_hand_count_stance_and_side',
          'dip_depth_and_foot_pressure','drive_press_timing',
          'no_redip_or_step','bar_speed_and_finish','return_and_set_down'
        ),
        'qualityGate',
          'Count only repetitions with a repeatable shallow dip, continuous drive-to-press timing, an owned tall finish, no receiving dip or step, and a controlled return.',
        'stopRules', jsonb_build_array(
          'pain_neurologic_symptoms_or_dizziness',
          'anchor_collar_or_plate_movement',
          'dip_or_foot_pressure_error','timing_or_bar_speed_loss',
          'redip_step_or_rotation','uncontrolled_return_or_set_down'
        )
      )
    ),
    (
      'one-arm-landmine-split-jerk',
      'One-Arm Landmine Split Jerk',
      ARRAY[
        'Single-Arm Landmine Split Jerk',
        'Unilateral Landmine Split Jerk',
        'Landmine Split Jerk'
      ]::TEXT[],
      'Dip and drive from a bilateral start, then rapidly split the feet to receive and stabilize the unilateral landmine with the working arm extended. Own the catch, recover in the declared order, and return under control.',
      'landmine_explosive_press',
      ARRAY['push','lunge','brace','landing']::TEXT[],
      ARRAY['foot','ankle','knee','hip','pelvis','spine','core','rib_cage','shoulder','scapula','elbow','wrist','hand']::TEXT[],
      jsonb_build_object(
        'primaryMusclesAndTissues', jsonb_build_array(
          'quadriceps','gluteals','calf_complex',
          'anterior_deltoid','clavicular_pectoralis_major','triceps_brachii'
        ),
        'secondaryMusclesAndTissues', jsonb_build_array(
          'hamstrings','hip_stabilizers','adductors','serratus_anterior',
          'trapezius','rotator_cuff','abdominal_wall_and_obliques',
          'spinal_stabilizers','forearm_and_hand_flexors'
        ),
        'joints', jsonb_build_array(
          'foot','ankle','knee','hip','pelvis','spine',
          'glenohumeral','scapulothoracic','acromioclavicular',
          'elbow','wrist','hand'
        ),
        'actions', jsonb_build_array(
          'establish_bilateral_start_and_shoulder_rack','dip_and_drive',
          'press_through_landmine_arc','rapid_split_foot_receive',
          'stabilize_extended_arm_and_split_base',
          'recover_in_declared_order','controlled_return_and_set_down'
        ),
        'planes', jsonb_build_array(
          'oblique_sagittal_press','sagittal_split_and_recovery',
          'frontal_and_transverse_stabilization'
        ),
        'laterality',
          'unilateral_press_with_declared_working_arm_to_lead_leg_relationship'
      ),
      jsonb_build_object(
        'required', jsonb_build_array(
          'rated_landmine','compatible_barbell','collars',
          'prescribed_plates','level_high_traction_floor',
          'visible_split_markers','clear_bar_split_recovery_and_set_down_zone'
        ),
        'prohibited', jsonb_build_array(
          'unstable_anchor','loose_or_missing_collar','shared_bar_arc',
          'slippery_floor','blocked_split_or_recovery_lane'
        ),
        'coachPosition', 'outside_bar_arc_with_view_of_both_split_contacts'
      ),
      jsonb_build_object(
        'readinessChecks', jsonb_build_array(
          'pain_free_dip_drive_and_split','stable_unloaded_split_landing',
          'controlled_extended_arm_receive','declared_recovery_order',
          'controlled_return_and_set_down'
        ),
        'constraints', jsonb_build_array(
          'low_contact_volume','full_reset_between_repetitions',
          'exact_arm_and_lead_leg_relationship'
        ),
        'contraindications', jsonb_build_array(
          'acute_pain_or_neurologic_symptoms','uncontrolled_split_landing',
          'cannot_stabilize_the_receive','unsafe_anchor_or_lane'
        )
      ),
      jsonb_build_object(
        'plainLanguageSummary',
          'Dip and drive, move your feet quickly into the marked split, freeze the catch, then recover in order.',
        'setupChecklist', jsonb_build_array(
          'confirm_anchor_collars_load_and_lane',
          'confirm_working_arm_lead_leg_and_markers',
          'confirm_recovery_order_and_failed_rep_plan'
        ),
        'cues', jsonb_build_array(
          'dip_drive_fast_feet','meet_the_bar_in_the_split',
          'freeze_the_catch','recover_only_after_balance'
        ),
        'accessibilityOptions', jsonb_build_array(
          'unloaded_or_lighter_bar','split_footwork_without_load',
          'reduced_split_distance','fewer_repetitions_and_longer_rest',
          'floor_markers_and_live_instruction'
        )
      ),
      jsonb_build_object(
        'observationPriorities', jsonb_build_array(
          'anchor_and_split_lane','arm_lead_leg_relationship',
          'dip_drive_timing','split_speed_width_and_length',
          'extended_arm_catch','balance_and_recovery_order','controlled_return'
        ),
        'qualityGate',
          'Count only repetitions with an accurate fast split, synchronized extended-arm receive, stable catch, correct recovery order, and controlled return.',
        'stopRules', jsonb_build_array(
          'pain_neurologic_symptoms_or_dizziness',
          'anchor_collar_or_plate_movement','missed_marker_or_foot_collision',
          'unstable_or_bent_arm_catch','bar_body_timing_failure',
          'incorrect_recovery_or_balance_loss','dropped_or_uncontrolled_bar'
        )
      )
    ),
    (
      'landmine-squat-to-press',
      'Landmine Squat-to-Press',
      ARRAY[
        'Landmine Squat to Press',
        'Landmine Squat Press',
        'Landmine Thruster',
        'Single-Arm Landmine Thruster',
        'Two-Hand Landmine Squat-to-Press'
      ]::TEXT[],
      'Descend from a declared landmine rack through an owned squat, then stand and continuously transfer lower-body force into the anchored diagonal press. Finish stacked and return to the rack under control.',
      'landmine_explosive_press',
      ARRAY['squat','push','brace']::TEXT[],
      ARRAY['foot','ankle','knee','hip','pelvis','spine','core','rib_cage','shoulder','scapula','elbow','wrist','hand']::TEXT[],
      jsonb_build_object(
        'primaryMusclesAndTissues', jsonb_build_array(
          'quadriceps','gluteus_maximus','adductor_magnus',
          'anterior_deltoid','clavicular_pectoralis_major','triceps_brachii'
        ),
        'secondaryMusclesAndTissues', jsonb_build_array(
          'hamstrings','calf_complex','serratus_anterior','trapezius',
          'rotator_cuff','abdominal_wall_and_obliques','spinal_stabilizers',
          'forearm_and_hand_flexors'
        ),
        'joints', jsonb_build_array(
          'foot','ankle','knee','hip','pelvis','spine',
          'glenohumeral','scapulothoracic','acromioclavicular',
          'elbow','wrist','hand'
        ),
        'actions', jsonb_build_array(
          'establish_declared_rack_and_squat_stance',
          'descend_to_owned_squat_depth','stand_from_squat',
          'transfer_force_continuously_into_landmine_press',
          'own_stacked_finish','controlled_return_and_set_down'
        ),
        'planes', jsonb_build_array(
          'sagittal_squat','oblique_sagittal_press',
          'frontal_and_transverse_stabilization'
        ),
        'laterality',
          'bilateral_lower_body_with_bilateral_or_unilateral_press'
      ),
      jsonb_build_object(
        'required', jsonb_build_array(
          'rated_landmine','compatible_barbell','collars',
          'prescribed_plates','level_high_traction_floor',
          'clear_squat_bar_arc_and_set_down_zone'
        ),
        'prohibited', jsonb_build_array(
          'unstable_anchor','loose_or_missing_collar','shared_bar_arc',
          'slippery_floor','blocked_squat_or_set_down_space'
        ),
        'coachPosition', 'outside_bar_arc_with_view_of_feet_knees_pelvis_and_rack'
      ),
      jsonb_build_object(
        'readinessChecks', jsonb_build_array(
          'pain_free_owned_squat_and_press','stable_declared_rack',
          'foot_knee_pelvis_and_trunk_control',
          'continuous_stand_to_press','controlled_return_and_set_down'
        ),
        'constraints', jsonb_build_array(
          'depth_matches_current_control','load_preserves_action_continuity',
          'unilateral_variants_require_side_balance'
        ),
        'contraindications', jsonb_build_array(
          'acute_pain_or_neurologic_symptoms','uncontrolled_squat_or_balance',
          'cannot_link_stand_to_press','unsafe_anchor_or_clearance'
        )
      ),
      jsonb_build_object(
        'plainLanguageSummary',
          'Squat to the called depth, drive the floor away, and carry that rise into the angled press.',
        'setupChecklist', jsonb_build_array(
          'confirm_anchor_collars_load_and_lane',
          'confirm_hand_count_rack_stance_depth_and_side',
          'brace_before_descending'
        ),
        'cues', jsonb_build_array(
          'own_the_squat','drive_then_press_without_a_pause',
          'finish_stacked','return_to_the_same_rack'
        ),
        'accessibilityOptions', jsonb_build_array(
          'unloaded_or_lighter_bar','reduced_owned_squat_depth',
          'fewer_repetitions_and_longer_rest','depth_target',
          'written_audio_still_image_or_live_instruction'
        )
      ),
      jsonb_build_object(
        'observationPriorities', jsonb_build_array(
          'anchor_and_clearance','hand_count_rack_stance_depth_and_side',
          'foot_pressure_knee_tracking_and_pelvis','trunk_and_rack_control',
          'stand_to_press_continuity','finish_range_and_return'
        ),
        'qualityGate',
          'Count only repetitions with an owned squat, controlled foot-knee-pelvis alignment, continuous stand-to-press transfer, stacked finish, and controlled return.',
        'stopRules', jsonb_build_array(
          'pain_neurologic_symptoms_or_dizziness',
          'anchor_collar_or_plate_movement',
          'loss_of_foot_pressure_or_knee_tracking',
          'pelvic_shift_or_trunk_collapse','disconnected_or_arm_only_press',
          'balance_or_range_loss','uncontrolled_return_or_set_down'
        )
      )
    );

  UPDATE coaching.exercise_definition_v1 definition
  SET canonical_name = seed.canonical_name,
      display_name = seed.canonical_name,
      aliases = ARRAY(
        SELECT min(alias)
        FROM unnest(coalesce(definition.aliases, '{}') || seed.aliases) alias
        WHERE nullif(btrim(alias), '') IS NOT NULL
          AND lower(btrim(alias)) <> lower(seed.canonical_name)
        GROUP BY lower(btrim(alias))
        ORDER BY lower(btrim(alias))
      ),
      description = seed.description,
      family_key = seed.family_key,
      schema_version = '1.0.0',
      card_version = CASE
        WHEN definition.provenance_json->>'structuralCompletionMigration'
          IS DISTINCT FROM migration_key
          THEN definition.card_version + 1
        ELSE definition.card_version
      END,
      status = 'review',
      content_confidence = 82,
      scoring_confidence = 72,
      media_confidence = 25,
      movement_patterns = seed.movement_patterns,
      body_regions = seed.body_regions,
      required_equipment = ARRAY['landmine','barbell']::TEXT[],
      optional_equipment = ARRAY['plates','floor_markers']::TEXT[],
      anatomy_json = seed.anatomy_json,
      environment_json = seed.environment_json,
      population_json = seed.population_json,
      athlete_support_json = seed.athlete_support_json,
      coach_support_json = seed.coach_support_json,
      support_operations_json = jsonb_build_object(
        'supportSummary',
          'Count only repetitions that preserve the exact anchor, rack, stance, hand count, ordered actions, timing, receiving policy, finish, return, and set-down.',
        'issueCategories', jsonb_build_array(
          'identity_or_variant','difficulty_or_dose',
          'equipment_or_environment','symptom_or_population_constraint',
          'instruction_or_accessibility','media_exact_match',
          'relationship','calibration'
        ),
        'supportEscalation', jsonb_build_object(
          'urgent', jsonb_build_array(
            'dropped_bar_or_plate','acute_injury',
            'neurologic_or_cardiovascular_symptom'
          ),
          'coachReview', jsonb_build_array(
            'repeated_action_timing_or_receiving_fault',
            'meaningful_side_difference','unclear_load_range_or_recovery'
          ),
          'equipmentReview', jsonb_build_array(
            'anchor_bar_collar_plate_or_floor_problem'
          ),
          'contentReview', jsonb_build_array(
            'identity_boundary_conflict','media_mismatch',
            'missing_accessibility_or_stop_rule'
          )
        ),
        'knownLimitations', jsonb_build_array(
          'candidate_media_not_oembed_or_playback_verified',
          'no_universal_load_range_dose_or_recovery',
          'scores_edges_calibrations_and_cards_are_unapproved_proposals'
        ),
        'changeImpactPolicy',
          'Changes to ordered action, hand count, stance, rack, dip, drive, foot movement, receiving action, squat depth, path, difficulty, dose, stop rule, relationship, or media require renewed affected reviews.'
      ),
      approved_video_url = NULL,
      reviewed_by = NULL,
      approved_by = NULL,
      last_reviewed_at = NULL,
      provenance_json = definition.provenance_json || jsonb_build_object(
        'structuralCompletionMigration', migration_key,
        'researchBatch', research_batch,
        'researchVersion', research_version,
        'evidenceState', 'candidate_requires_human_review',
        'mediaState',
          'public_search_candidates_unverified_and_non_embeddable',
        'difficultyModel',
          'max_exercise_complexity_physical_difficulty',
        'humanReviewRequired', TRUE,
        'publicationQuarantined', TRUE,
        'mediaApprovalCreated', FALSE,
        'graphApprovalCreated', FALSE,
        'calibrationApprovalCreated', FALSE
      ),
      updated_at = now()
  FROM explosive_landmine_card_seed seed
  WHERE definition.facility_id = 1
    AND definition.slug = seed.slug
    AND definition.status <> 'archived';

  CREATE TEMP TABLE explosive_landmine_variant_seed (
    slug TEXT NOT NULL,
    variant_key TEXT NOT NULL,
    display_name TEXT NOT NULL,
    action_identity TEXT NOT NULL,
    hand_count SMALLINT NOT NULL,
    stance TEXT NOT NULL,
    side_relationship TEXT NOT NULL,
    complexity SMALLINT NOT NULL,
    physical SMALLINT NOT NULL,
    coordination SMALLINT NOT NULL,
    supervision SMALLINT NOT NULL,
    consequence SMALLINT NOT NULL,
    impact SMALLINT NOT NULL,
    local_fatigue SMALLINT NOT NULL,
    grip_fatigue SMALLINT NOT NULL,
    technical_fatigue SMALLINT NOT NULL,
    recovery_hours SMALLINT NOT NULL,
    PRIMARY KEY (slug, variant_key)
  ) ON COMMIT DROP;

  INSERT INTO explosive_landmine_variant_seed VALUES
    ('one-arm-landmine-push-press','unilateral-square-stance-dip-drive','Landmine Push Press — Unilateral Square Stance','push_press_no_receiving_dip',1,'square','working_side_unilateral',56,52,60,52,52,1,54,46,62,36),
    ('one-arm-landmine-push-press','unilateral-split-stance-dip-drive','Landmine Push Press — Unilateral Fixed Split Stance','push_press_no_receiving_dip',1,'fixed_split','working_arm_and_lead_foot_declared',60,52,64,54,54,1,54,46,66,36),
    ('one-arm-landmine-push-press','bilateral-square-stance-dip-drive','Landmine Push Press — Bilateral Square Stance','push_press_no_receiving_dip',2,'square','bilateral_symmetric_press',52,56,56,50,52,1,58,48,58,48),
    ('one-arm-landmine-split-jerk','working-arm-ipsilateral-to-lead-leg-split-jerk','Landmine Split Jerk — Working Arm Ipsilateral to Lead Leg','split_jerk_receive',1,'dynamic_split_receive','working_arm_ipsilateral_to_lead_leg',68,60,74,66,64,3,60,48,74,48),
    ('one-arm-landmine-split-jerk','working-arm-contralateral-to-lead-leg-split-jerk','Landmine Split Jerk — Working Arm Contralateral to Lead Leg','split_jerk_receive',1,'dynamic_split_receive','working_arm_contralateral_to_lead_leg',72,60,76,68,64,3,60,48,76,48),
    ('landmine-squat-to-press','bilateral-continuous-squat-to-press','Landmine Squat-to-Press — Bilateral','full_squat_to_press',2,'squat_stance','bilateral_symmetric_press',58,60,62,54,54,1,64,48,62,48),
    ('landmine-squat-to-press','unilateral-continuous-squat-to-press','Landmine Squat-to-Press — Unilateral','full_squat_to_press',1,'squat_stance','working_side_unilateral',62,58,66,56,56,1,64,48,66,48);

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
      seed.action_identity,
      seed.stance,
      seed.side_relationship,
      seed.hand_count::TEXT || '_hand',
      'barbell_sleeve',
      'rated_fixed_landmine_pivot'
    ]::TEXT[],
    jsonb_build_object(
      'technicalComplexity', seed.complexity,
      'absoluteLoadDemand', seed.physical,
      'baseOverallDifficulty', greatest(seed.complexity, seed.physical),
      'coordinationDemand', seed.coordination,
      'supervisionDemand', seed.supervision,
      'failureConsequence', seed.consequence,
      'impact', seed.impact,
      'workCapacityDemand', seed.local_fatigue,
      'difficultyModel',
        'max_exercise_complexity_physical_difficulty',
      'dimensionMeaning', jsonb_build_object(
        'technicalComplexity', 'exercise_complexity',
        'absoluteLoadDemand', 'physical_difficulty'
      ),
      'provisional', TRUE
    ),
    jsonb_build_object(
      'selectable', TRUE,
      'actionIdentity', seed.action_identity,
      'stance', seed.stance,
      'laterality', CASE
        WHEN seed.hand_count = 1 THEN 'unilateral'
        ELSE 'bilateral'
      END,
      'handCount', seed.hand_count,
      'sideRelationship', seed.side_relationship,
      'attachment', 'barbell_sleeve',
      'anchor', 'rated_fixed_landmine_pivot',
      'rack', CASE
        WHEN seed.hand_count = 1 THEN 'declared_working_shoulder'
        ELSE 'central_chest'
      END,
      'path', 'fixed_pivot_diagonal_press_arc',
      'dipDriveReceiveContract', CASE seed.action_identity
        WHEN 'push_press_no_receiving_dip'
          THEN 'shallow_dip_continuous_drive_press_finish_tall_no_redip_or_step'
        WHEN 'split_jerk_receive'
          THEN 'dip_drive_rapid_split_receive_stabilize_then_declared_recovery'
        ELSE
          'owned_squat_continuous_stand_to_press_no_receiving_dip'
      END,
      'range', 'declared_owned_range',
      'terminalAction', 'controlled_return_to_same_rack',
      'sideBalanceRequired', seed.hand_count = 1,
      'pickupTransferSetDownMustBeDeclared', TRUE
    ),
    'review',
    jsonb_build_object(
      'externalLoadMethod', 'landmine_barbell',
      'externalLoadDescription',
        'barbell and declared plate mass rotating around a rated fixed pivot',
      'effectiveLoadDrivers', jsonb_build_array(
        'bar_mass','plate_mass','plate_position','bar_angle',
        'athlete_distance_from_pivot','hand_count','stance',
        'action_sequence','range','velocity','repetitions'
      ),
      'gripDemand', seed.grip_fatigue,
      'spinalLoading', 42,
      'eccentricStress', 36,
      'landingContactsPerRep', CASE
        WHEN seed.action_identity = 'split_jerk_receive' THEN 2
        ELSE 0
      END,
      'impactClass', CASE
        WHEN seed.action_identity = 'split_jerk_receive'
          THEN 'low_to_moderate_split_contact'
        ELSE 'low_no_planned_jump'
      END,
      'loadTracking', jsonb_build_array(
        'bar_type','plate_mass','rack','hand_count','stance',
        'side_relationship','dip_or_squat_depth','receiving_action',
        'range','repetitions'
      )
    ),
    jsonb_build_object(
      'localMuscleFatigue', seed.local_fatigue,
      'gripFatigue', seed.grip_fatigue,
      'technicalFatigueSensitivity', seed.technical_fatigue,
      'impactAccumulation', seed.impact,
      'recoveryHours', seed.recovery_hours,
      'primaryFatigueSites', jsonb_build_array(
        'quadriceps_gluteals_and_calves','anterior_shoulder_and_upper_chest',
        'triceps','scapular_stabilizers','trunk','grip_and_forearm'
      ),
      'earlyFatigueSignals', CASE seed.action_identity
        WHEN 'push_press_no_receiving_dip' THEN jsonb_build_array(
          'dip_depth_or_foot_pressure_drift','early_arm_press',
          'drive_press_disconnection','redip_step_or_rotation',
          'bar_speed_or_return_loss'
        )
        WHEN 'split_jerk_receive' THEN jsonb_build_array(
          'dip_or_drive_drift','late_short_or_narrow_split',
          'unstable_or_bent_arm_receive','incorrect_recovery',
          'bar_speed_or_return_loss'
        )
        ELSE jsonb_build_array(
          'squat_depth_or_alignment_drift','trunk_or_rack_loss',
          'stand_press_disconnection','arm_only_finish',
          'range_or_return_loss'
        )
      END,
      'downstreamConflicts', jsonb_build_array(
        'heavy_lower_body_strength_or_jumping',
        'high_velocity_pressing_throwing_or_hitting',
        'overhead_or_hand_support_skill','grip_intensive_work',
        'fatigue_degraded_conditioning'
      )
    ),
    jsonb_build_object(
      'selectionStatus', 'candidate_requires_human_review',
      'primaryIntent', seed.action_identity,
      'appropriatePhases', CASE
        WHEN seed.action_identity = 'split_jerk_receive'
          THEN jsonb_build_array('movement_intelligence','output')
        ELSE jsonb_build_array('output','capacity')
      END,
      'avoidUse', jsonb_build_array(
        'conditioning_race','uncontrolled_to_failure',
        'undeclared_action_or_stance_change',
        'fatigue_degraded_timing_catch_or_return',
        'symptom_provocation'
      ),
      'cumulativeBudget', jsonb_build_object(
        'highVelocityLandmineRepetitions', 1,
        'lowerBodyDriveOrSquatLoad', seed.local_fatigue,
        'shoulderChestTricepsLoad', seed.local_fatigue,
        'gripStress', seed.grip_fatigue,
        'technicalSensitivity', seed.technical_fatigue,
        'splitContacts', CASE
          WHEN seed.action_identity = 'split_jerk_receive' THEN 2
          ELSE 0
        END
      )
    )
  FROM explosive_landmine_variant_seed seed
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id = 1
   AND definition.slug = seed.slug
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
    'primary',
    CASE profile.profile_key
      WHEN 'output-power'
        THEN 'Develop exact high-velocity lower-to-upper force transfer with full recovery before timing or speed degrades.'
      WHEN 'capacity-strength-power'
        THEN 'Build repeatable load tolerance in the exact push or squat-to-press sequence without conditioning drift.'
      ELSE 'Rehearse exact dip-drive, split receive, stabilization, recovery, return, and set-down at low fatigue.'
    END,
    CASE profile.profile_key
      WHEN 'movement-intelligence-receive' THEN 92
      ELSE 90
    END,
    90,
    jsonb_build_object(
      'powerAndTiming', seed.coordination,
      'strengthAndLoadTolerance', seed.physical,
      'technicalQuality', seed.technical_fatigue,
      'impact', seed.impact
    ),
    CASE profile.profile_key
      WHEN 'movement-intelligence-receive' THEN jsonb_build_object(
        'sets', jsonb_build_array(3,5),
        'repsPerSideOrTotal', jsonb_build_array(1,3),
        'rpe', jsonb_build_array(3,6),
        'restSeconds', jsonb_build_array(90,210),
        'tempo', 'explosive_light_load_full_reset',
        'stopBeforeFailure', TRUE
      )
      WHEN 'output-power' THEN jsonb_build_object(
        'sets', jsonb_build_array(3,6),
        'repsPerSideOrTotal', jsonb_build_array(1,5),
        'rpe', jsonb_build_array(5,8),
        'restSeconds', jsonb_build_array(120,360),
        'tempo', 'high_intent_full_reset',
        'stopBeforeFailure', TRUE
      )
      ELSE jsonb_build_object(
        'sets', jsonb_build_array(3,5),
        'repsPerSideOrTotal', jsonb_build_array(3,8),
        'rpe', jsonb_build_array(6,8),
        'restSeconds', jsonb_build_array(120,300),
        'tempo', 'fast_concentric_controlled_return',
        'stopBeforeFailure', TRUE
      )
    END,
    'Every counted repetition preserves secure equipment, declared hand count, rack, stance, side relationship, exact ordered action, timing, receiving policy, finish, return, and set-down.',
    ARRAY[
      'Stop for pain, neurologic symptoms, or dizziness.',
      'Stop for anchor, collar, plate, floor, or lane failure.',
      'Stop when dip, squat, drive, press, split, catch, recovery, bar speed, balance, or return differs from the exact variant.',
      'Do not continue to grinding or uncontrolled failure.'
    ]::TEXT[],
    ARRAY[
      'Verify equipment, load, rack, stance, hand count, side sequence, action identity, and lane before the set.',
      'Observe lower-body action, force-transfer timing, bar path, receiving policy, finish, and return.',
      'End the set at the first material timing, speed, alignment, catch, balance, or symptom fault.'
    ]::TEXT[],
    ARRAY[
      'Use the called rack, stance, hand count, and side.',
      'Perform the called dip-drive, split receive, or full squat-to-press sequence without improvising.',
      'Own the finish and return under control; stop when speed or shape changes.'
    ]::TEXT[],
    CASE profile.profile_key
      WHEN 'movement-intelligence-receive'
        THEN 'More repeatable split geometry, catch ownership, and recovery order at low fatigue.'
      WHEN 'output-power'
        THEN 'Improved high-quality lower-to-upper force transfer and diagonal pressing velocity.'
      ELSE 'Improved repeatable whole-body strength-power and load tolerance.'
    END,
    ARRAY['landmine','barbell']::TEXT[],
    jsonb_build_object(
      'athletesPerStation', 1,
      'coachSightline', 'anchor_feet_lower_body_rack_bar_path_finish_and_return',
      'requiredClearance', 'complete_bar_plate_and_footwork_zone',
      'setupSeconds', 75,
      'transitionSeconds', 30,
      'sharedEquipmentPolicy',
        'Only one athlete enters the moving bar and plate zone.'
    ),
    '{}'::UUID[],
    'review',
    jsonb_build_object(
      'repSeconds', CASE
        WHEN seed.action_identity = 'split_jerk_receive' THEN 8
        ELSE 6
      END,
      'setupSeconds', 75,
      'transitionSeconds', 30,
      'restIsExplicit', TRUE
    ),
    jsonb_build_object(
      'scaleDown', jsonb_build_array(
        'reduce_load','reduce_range_or_split_distance',
        'reduce_repetitions','increase_rest',
        'rehearse_at_lower_velocity'
      ),
      'scaleUp', jsonb_build_array(
        'increase_load_in_small_steps','increase_velocity_intent',
        'increase_owned_range','add_repetitions_within_quality_cap'
      ),
      'preserve', jsonb_build_array(
        'action_identity','hand_count','rack','stance',
        'side_relationship','receiving_policy','controlled_return'
      )
    ),
    jsonb_build_object(
      'record', jsonb_build_array(
        'variant_key','bar_and_plate_mass','hand_count','stance',
        'working_side_and_lead_leg','dip_or_squat_depth',
        'repetitions','rpe','rest','quality_stop_reason'
      ),
      'success',
        'Every counted repetition meets the exact action, timing, finish, and return contract.'
    ),
    jsonb_build_object(
      'beforeSet', jsonb_build_array(
        'Confirm exact variant, load, side sequence, floor markers, and stop signal.'
      ),
      'afterFault', jsonb_build_array(
        'Stop, secure the bar, identify whether load, action timing, stance, receiving action, fatigue, symptom, or environment caused the fault, then regress or substitute only through reviewed options.'
      )
    )
  FROM explosive_landmine_variant_seed seed
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id = 1
   AND definition.slug = seed.slug
   AND definition.status <> 'archived'
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id = definition.id
   AND variant.variant_key = seed.variant_key
  CROSS JOIN LATERAL (
    SELECT
      CASE
        WHEN seed.action_identity = 'split_jerk_receive'
          THEN profile_key
        ELSE CASE
          WHEN profile_key = 'movement-intelligence-receive'
            THEN 'capacity-strength-power'
          ELSE profile_key
        END
      END AS profile_key,
      CASE
        WHEN profile_key = 'movement-intelligence-receive'
          AND seed.action_identity = 'split_jerk_receive'
          THEN 'movement_intelligence'
        WHEN profile_key = 'movement-intelligence-receive'
          THEN 'capacity'
        ELSE 'output'
      END AS phase_key
    FROM (
      VALUES
        ('movement-intelligence-receive'),
        ('output-power')
    ) AS raw(profile_key)
  ) profile
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

  CREATE TEMP TABLE explosive_landmine_evidence_seed (
    section_key TEXT PRIMARY KEY,
    source_url TEXT NOT NULL,
    source_title TEXT NOT NULL,
    source_publisher TEXT NOT NULL,
    source_kind TEXT NOT NULL,
    evidence_quality SMALLINT NOT NULL,
    claims_json JSONB NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO explosive_landmine_evidence_seed VALUES
    (
      'identity',
      'https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/',
      'The Landmine Press—Implementation and Variation',
      'National Strength and Conditioning Association',
      'professional_standard',
      84,
      '["A landmine constrains the free bar end to an angled arc about a fixed pivot; support base, hand count, start rack, lower-body action, receiving action, path, and terminal event remain identity-critical.","Press, push press, split jerk, and squat-to-press are not interchangeable labels because their ordered actions differ."]'::JSONB
    ),
    (
      'taxonomy',
      'https://pubmed.ncbi.nlm.nih.gov/34704894/',
      'No differences in weightlifting overhead pressing exercises kinetics',
      'Sports Biomechanics',
      'peer_reviewed_research',
      87,
      '["Push press and jerk tasks share dip and thrust phases but differ in the receiving action after propulsion.","Hand count, stance, dip depth, drive timing, foot displacement, receiving dip, squat depth, load, rest, and side dose are controlled dimensions."]'::JSONB
    ),
    (
      'anatomy',
      'https://www.nsca.com/education/articles/kinetic-select/push-jerk/',
      'Push Jerk',
      'National Strength and Conditioning Association',
      'professional_standard',
      88,
      '["Dip-drive pressing combines rapid hip, knee, and ankle extension with shoulder and elbow action, scapular control, trunk bracing, grip, and a declared receiving base.","Record lower-extremity force production, shoulder and upper-chest pressing, triceps, scapular stabilizers, rotator cuff, trunk, forearm, and hand contributions without claiming isolation."]'::JSONB
    ),
    (
      'biomechanics',
      'https://pubmed.ncbi.nlm.nih.gov/41755100/',
      'Landmine Press Kinematics Measured with an Enhanced YOLOv8 Model and Mathematical Modeling',
      'Sensors',
      'peer_reviewed_research',
      86,
      '["The bar path and observed landmine-press kinematics depend on the fixed pivot, body position, start height, range, and external load.","Observable gates include a secure anchor, repeatable rack, controlled lower-body action, continuous drive, declared receive, owned finish, and controlled return."]'::JSONB
    ),
    (
      'difficulty',
      'https://pubmed.ncbi.nlm.nih.gov/34704894/',
      'No differences in weightlifting overhead pressing exercises kinetics',
      'Sports Biomechanics',
      'peer_reviewed_research',
      87,
      '["Dip, thrust, and receiving demands change with exact execution even when related press tasks use the same relative load.","Exercise complexity and physical difficulty are scored independently for every exact variant; overall equals their maximum. Exercise cards contain no athlete proficiency level."]'::JSONB
    ),
    (
      'load_fatigue_recovery',
      'https://pubmed.ncbi.nlm.nih.gov/41755100/',
      'Landmine Press Kinematics Measured with an Enhanced YOLOv8 Model and Mathematical Modeling',
      'Sensors',
      'peer_reviewed_research',
      86,
      '["External load changes landmine-press kinematics; load, repetitions, velocity, action sequence, range, and rest must be tracked.","Budget shoulder, chest, triceps, lower-body drive or squat, trunk, grip, eccentric return, split contacts, technical fatigue, and recovery according to the exact variant."]'::JSONB
    ),
    (
      'constraints',
      'https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/',
      'The Landmine Press—Implementation and Variation',
      'National Strength and Conditioning Association',
      'professional_standard',
      84,
      '["Landmine work requires a stable anchor, compatible barbell and loading hardware, and clear space for the complete bar and plate arc.","Declare floor traction, collars, plates, rack transfer, stance, side, footwork or squat space, pickup, set-down, coach position, and exclusion zone."]'::JSONB
    ),
    (
      'dosage',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC10579494/',
      'Resistance training prescription for muscle strength and hypertrophy in healthy adults: a systematic review and Bayesian network meta-analysis',
      'British Journal of Sports Medicine',
      'peer_reviewed_research',
      94,
      '["Resistance dose and recovery must account for sets, repetitions, load, effort, frequency, and exercise selection.","Use short quality sets and enough rest to preserve the exact dip, drive, press, split or squat action, bar speed, side balance, finish, and return."]'::JSONB
    ),
    (
      'instructions',
      'https://www.nsca.com/education/articles/kinetic-select/push-jerk/',
      'Push Jerk',
      'National Strength and Conditioning Association',
      'professional_standard',
      88,
      '["Instruction must separate setup, dip, drive, press or catch, recovery, return, and set-down phases.","The athlete must know whether feet move, whether a receiving dip exists, what depth counts, and how to return a failed repetition."]'::JSONB
    ),
    (
      'safety_stop_rules',
      'https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf',
      'Youth Resistance Training: Updated Position Statement Paper From the NSCA',
      'National Strength and Conditioning Association',
      'professional_standard',
      88,
      '["Qualified supervision, manageable resistance, correct technique, suitable equipment, and gradual progression are core safeguards.","Stop for pain, neurologic symptoms, dizziness, equipment movement, uncontrolled lower-body action or catch, foot error, trunk collapse, grinding, dropped load, collision risk, or loss of the planned set-down."]'::JSONB
    ),
    (
      'programming',
      'https://pubmed.ncbi.nlm.nih.gov/41755100/',
      'Landmine Press Kinematics Measured with an Enhanced YOLOv8 Model and Mathematical Modeling',
      'Sensors',
      'peer_reviewed_research',
      86,
      '["Landmine execution and external load affect the task and must be selected for the intended adaptation.","Place high-velocity variants before material lower-body, shoulder, throwing, contact, grip, or conditioning fatigue when power and timing are priorities."]'::JSONB
    ),
    (
      'athlete_support',
      'https://www.nsca.com/education/articles/kinetic-select/push-jerk/',
      'Push Jerk',
      'National Strength and Conditioning Association',
      'professional_standard',
      88,
      '["The athlete needs the exact rack, hand count, stance, dip or squat, drive, foot action, receive, load, repetitions, rest, side sequence, and stop signal.","Reduce load, range, velocity, or complexity rather than silently changing the exercise sequence or accepting an uncontrolled catch."]'::JSONB
    ),
    (
      'coach_support',
      'https://pubmed.ncbi.nlm.nih.gov/41755100/',
      'Landmine Press Kinematics Measured with an Enhanced YOLOv8 Model and Mathematical Modeling',
      'Sensors',
      'peer_reviewed_research',
      86,
      '["The fixed pivot gives coaches observable setup, path, range, timing, and finish checkpoints.","Expose anchor, collars, plate clearance, rack, hand count, stance, lower-body depth, drive timing, foot movement, receiving position, velocity, symptoms, dose, fatigue, and shutdown actions."]'::JSONB
    ),
    (
      'accessibility',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC10579494/',
      'Resistance training prescription for muscle strength and hypertrophy in healthy adults: a systematic review and Bayesian network meta-analysis',
      'British Journal of Sports Medicine',
      'peer_reviewed_research',
      94,
      '["Resistance exercise can be individualized through load, volume, range, effort, equipment, and recovery while preserving the intended task.","Options include a lighter bar, fewer repetitions, longer rest, low-velocity rehearsal, floor markers, written or audio cues, still images, and live instruction."]'::JSONB
    ),
    (
      'alternates',
      'https://pubmed.ncbi.nlm.nih.gov/34704894/',
      'No differences in weightlifting overhead pressing exercises kinetics',
      'Sports Biomechanics',
      'peer_reviewed_research',
      87,
      '["Push press, push jerk, and split jerk share propulsion phases but have different receiving actions and remain explicit identities.","Hand count and fixed stance can be exact variants; adding a full squat, clean, lunge, rotation, release, or split catch changes the identity."]'::JSONB
    ),
    (
      'media',
      'https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en',
      'Embed videos and playlists',
      'YouTube Help',
      'manufacturer_instruction',
      82,
      '["YouTube documents privacy-enhanced embedding, but a discovered watch URL does not prove current embed permission or exact exercise match.","The stored public-search candidates remain pending and non-embeddable until playback, oEmbed, exact-variant, cue, safety, caption, accessibility, quality, reviewer, and approval checks occur."]'::JSONB
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
    definition.id,
    definition.card_version,
    evidence.section_key,
    evidence.source_url,
    evidence.source_title,
    evidence.source_publisher,
    evidence.source_kind,
    evidence.claims_json,
    evidence.evidence_quality,
    'candidate',
    NULL,
    NULL
  FROM coaching.exercise_definition_v1 definition
  CROSS JOIN explosive_landmine_evidence_seed evidence
  WHERE definition.facility_id = 1
    AND definition.slug = ANY(target_slugs)
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

  CREATE TEMP TABLE explosive_landmine_relationship_seed (
    from_slug TEXT NOT NULL,
    from_key TEXT NOT NULL,
    to_slug TEXT NOT NULL,
    to_key TEXT NOT NULL,
    relationship TEXT NOT NULL,
    similarity SMALLINT NOT NULL,
    reason TEXT NOT NULL,
    conditions JSONB NOT NULL,
    PRIMARY KEY (from_slug, from_key, to_slug, to_key, relationship)
  ) ON COMMIT DROP;

  INSERT INTO explosive_landmine_relationship_seed VALUES
    ('one-arm-landmine-push-press','unilateral-square-stance-dip-drive','one-arm-landmine-push-press','unilateral-split-stance-dip-drive','lateral_substitution',86,'Same unilateral push-press sequence with a deliberately changed fixed start stance.','{"changedAttributes":["stance","force_symmetry","lead_foot"],"requiresExactSideRedose":true,"humanReviewRequired":true}'::JSONB),
    ('one-arm-landmine-push-press','unilateral-split-stance-dip-drive','one-arm-landmine-push-press','unilateral-square-stance-dip-drive','lateral_substitution',86,'Same unilateral push-press sequence with a deliberately changed fixed start stance.','{"changedAttributes":["stance","force_symmetry","lead_foot"],"requiresExactSideRedose":true,"humanReviewRequired":true}'::JSONB),
    ('one-arm-landmine-push-press','unilateral-square-stance-dip-drive','one-arm-landmine-push-press','bilateral-square-stance-dip-drive','lateral_substitution',82,'Hand count changes symmetry, grip, trunk demand, load tolerance, and side dose while preserving the push-press action.','{"changedAttributes":["hand_count","load_symmetry","grip","trunk_demand","side_dose"],"reassessLoadAndDose":true,"humanReviewRequired":true}'::JSONB),
    ('one-arm-landmine-push-press','bilateral-square-stance-dip-drive','one-arm-landmine-push-press','unilateral-square-stance-dip-drive','lateral_substitution',82,'Hand count changes symmetry, grip, trunk demand, load tolerance, and side dose while preserving the push-press action.','{"changedAttributes":["hand_count","load_symmetry","grip","trunk_demand","side_dose"],"reassessLoadAndDose":true,"humanReviewRequired":true}'::JSONB),
    ('one-arm-landmine-push-press','unilateral-square-stance-dip-drive','one-arm-landmine-split-jerk','working-arm-ipsilateral-to-lead-leg-split-jerk','progression',70,'The split jerk adds rapid foot relocation, a split receive, catch stabilization, and ordered recovery to the unilateral dip-drive press.','{"changedAttributes":["foot_movement","receiving_action","catch","recovery"],"condition":"progress_only_after_exact_split_receive_readiness","humanReviewRequired":true}'::JSONB),
    ('one-arm-landmine-split-jerk','working-arm-ipsilateral-to-lead-leg-split-jerk','one-arm-landmine-push-press','unilateral-square-stance-dip-drive','regression',70,'Push press removes the split receive while retaining lower-to-upper force transfer through the landmine arc.','{"changedAttributes":["foot_movement","receiving_action","catch","recovery"],"condition":"objective_accepts_no_split_receive","humanReviewRequired":true}'::JSONB),
    ('one-arm-landmine-push-press','bilateral-square-stance-dip-drive','landmine-squat-to-press','bilateral-continuous-squat-to-press','lateral_substitution',66,'Both use continuous lower-to-upper force transfer, but full squat depth changes range, duration, load, fatigue, and intent.','{"changedAttributes":["lower_body_depth","range","duration","fatigue","intent"],"condition":"workout_objective_accepts_full_squat_action","humanReviewRequired":true}'::JSONB),
    ('landmine-squat-to-press','bilateral-continuous-squat-to-press','one-arm-landmine-push-press','bilateral-square-stance-dip-drive','lateral_substitution',66,'The push press replaces the full squat with a shallow propulsion dip and requires redosing for power intent.','{"changedAttributes":["lower_body_depth","range","duration","fatigue","intent"],"condition":"workout_objective_accepts_shallow_power_dip","humanReviewRequired":true}'::JSONB);

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
    ARRAY['complexity','load','stability','action_sequence']::TEXT[],
    seed.reason,
    seed.conditions,
    'review',
    NULL,
    NULL,
    NULL
  FROM explosive_landmine_relationship_seed seed
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
  ON CONFLICT (
    from_variant_id,
    to_variant_id,
    relationship
  )
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
    calibration.dimension,
    calibration.score,
    CASE
      WHEN calibration.score < 30 THEN 20
      WHEN calibration.score < 50 THEN 40
      WHEN calibration.score < 70 THEN 60
      ELSE 80
    END,
    CASE calibration.dimension
      WHEN 'technicalComplexity'
        THEN 'Candidate exercise-complexity score reflects the exact ordered action, hand count, rack, stance, lower-body timing, receiving policy, path, range, and control; human anchor review is pending.'
      WHEN 'absoluteLoadDemand'
        THEN 'Candidate physical-difficulty score reflects external load tolerance, lower-body and pressing force, split or squat demand, trunk transfer, and repeatable quality; human anchor review is pending.'
    END,
    'review',
    1,
    NULL,
    NULL,
    'Research proposal only; compare against approved facility anchors before approval.',
    NULL
  FROM explosive_landmine_variant_seed seed
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id = 1
   AND definition.slug = seed.slug
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id = definition.id
   AND variant.variant_key = seed.variant_key
  CROSS JOIN LATERAL (
    VALUES
      ('technicalComplexity', seed.complexity),
      ('absoluteLoadDemand', seed.physical)
  ) AS calibration(dimension, score)
  ON CONFLICT (
    facility_id,
    variant_id,
    dimension,
    version
  )
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
      'stableIdentityAndAliases', TRUE,
      'controlledTaxonomyPresent', TRUE,
      'anatomyJointsActionsPlanesLateralityPresent', TRUE,
      'difficultyFormulaValid', NOT EXISTS (
        SELECT 1
        FROM coaching.exercise_variant_v1 variant
        WHERE variant.definition_id = definition.id
          AND variant.status IN ('review','published')
          AND (
            (variant.difficulty_json->>'baseOverallDifficulty')::INTEGER
              <> greatest(
                (variant.difficulty_json->>'technicalComplexity')::INTEGER,
                (variant.difficulty_json->>'absoluteLoadDemand')::INTEGER
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
      'loadFatigueRecoveryPresent', (
        SELECT count(*)
        FROM coaching.exercise_variant_v1 variant
        WHERE variant.definition_id = definition.id
          AND variant.status = 'review'
          AND variant.load_profile_json <> '{}'::JSONB
          AND variant.fatigue_profile_json <> '{}'::JSONB
      ) > 0,
      'equipmentEnvironmentPopulationPresent',
        cardinality(definition.required_equipment) > 0
        AND definition.environment_json <> '{}'::JSONB
        AND definition.population_json <> '{}'::JSONB,
      'deliveryProfilesPresent', (
        SELECT count(*)
        FROM coaching.exercise_variant_v1 variant
        JOIN coaching.exercise_delivery_profile_v1 profile
          ON profile.variant_id = variant.id
        WHERE variant.definition_id = definition.id
          AND profile.status = 'review'
      ) > 0,
      'coachAndAthleteSupportPresent',
        definition.coach_support_json <> '{}'::JSONB
        AND definition.athlete_support_json <> '{}'::JSONB,
      'allEvidenceSectionsPresent', (
        SELECT count(DISTINCT evidence.section_key)
        FROM coaching.exercise_section_evidence_v1 evidence
        WHERE evidence.definition_id = definition.id
          AND evidence.reviewed_card_version = definition.card_version
          AND evidence.review_status = 'candidate'
      ) = 16,
      'mediaCandidateCount', (
        SELECT count(DISTINCT media.video_id)
        FROM coaching.exercise_media_candidate_v1 media
        WHERE media.definition_id = definition.id
          AND media.reviewed_card_version = definition.card_version
          AND media.review_status = 'candidate'
          AND media.link_status = 'unverified'
          AND media.embedding_allowed IS FALSE
      ),
      'mediaVerifiedOrApprovedCount', (
        SELECT count(*)
        FROM coaching.exercise_media_candidate_v1 media
        WHERE media.definition_id = definition.id
          AND media.reviewed_card_version = definition.card_version
          AND (
            media.link_status = 'healthy'
            OR media.embedding_allowed IS TRUE
            OR media.exact_variant_match IS NOT NULL
            OR media.review_status <> 'candidate'
          )
      ),
      'alternateAssessmentsPresent', (
        SELECT count(*)
        FROM coaching.exercise_alternate_assessment_v1 alternate
        WHERE alternate.definition_id = definition.id
          AND alternate.reviewed_card_version = definition.card_version
          AND alternate.review_status = 'candidate'
      ) = 6,
      'relationshipsAreReviewOnly', NOT EXISTS (
        SELECT 1
        FROM coaching.exercise_variant_v1 variant
        JOIN coaching.exercise_relationship_v1 relationship
          ON relationship.from_variant_id = variant.id
          OR relationship.to_variant_id = variant.id
        WHERE variant.definition_id = definition.id
          AND relationship.review_status <> 'review'
      ),
      'calibrationsAreReviewOnly', NOT EXISTS (
        SELECT 1
        FROM coaching.exercise_variant_v1 variant
        JOIN coaching.exercise_score_calibration_v1 calibration
          ON calibration.variant_id = variant.id
        WHERE variant.definition_id = definition.id
          AND calibration.status <> 'review'
      ),
      'selectableExactVariantCount', (
        SELECT count(*)
        FROM coaching.exercise_variant_v1 variant
        WHERE variant.definition_id = definition.id
          AND variant.status = 'review'
          AND variant.requirements_json->>'selectable' = 'true'
      )
    ),
    jsonb_build_array(
      jsonb_build_object(
        'code', 'CARD-MEDIA-01',
        'message', 'Three to five public-search YouTube candidates require playback, oEmbed, exact-variant, safety, cue, caption, accessibility, quality, reviewer, and approval review.'
      ),
      jsonb_build_object(
        'code', 'CARD-PUBLISH-01',
        'message', 'No current two-person card or publication approval exists.'
      ),
      jsonb_build_object(
        'code', 'CARD-GRAPH-03',
        'message', 'Review-only progression, regression, and substitution relationships require human approval.'
      ),
      jsonb_build_object(
        'code', 'CARD-CALIBRATION-01',
        'message', 'Difficulty proposals require independent human anchor review.'
      )
    ),
    TRUE,
    now()
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.facility_id = 1
    AND definition.slug = ANY(target_slugs)
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
    FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_variant_v1 variant
      ON variant.definition_id = definition.id
    WHERE definition.facility_id = 1
      AND definition.slug = ANY(target_slugs)
      AND variant.status = 'review'
      AND (
        (variant.difficulty_json->>'baseOverallDifficulty')::INTEGER
          <> greatest(
            (variant.difficulty_json->>'technicalComplexity')::INTEGER,
            (variant.difficulty_json->>'absoluteLoadDemand')::INTEGER
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
      )
  ) THEN
    RAISE EXCEPTION
      '% produced an invalid difficulty formula or prohibited level classification',
      migration_key;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_variant_v1 variant
      ON variant.definition_id = definition.id
    JOIN coaching.exercise_delivery_profile_v1 profile
      ON profile.variant_id = variant.id
    WHERE definition.facility_id = 1
      AND definition.slug = ANY(target_slugs)
      AND profile.status = 'review'
      AND coaching.exercise_json_has_level_classification(
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
      AND definition.slug = ANY(target_slugs)
      AND (
        definition.card_version <> 2
        OR definition.status <> 'review'
        OR definition.approved_video_url IS NOT NULL
        OR definition.reviewed_by IS NOT NULL
        OR definition.approved_by IS NOT NULL
        OR definition.last_reviewed_at IS NOT NULL
        OR definition.provenance_json->>'structuralCompletionMigration'
          IS DISTINCT FROM migration_key
      )
  ) THEN
    RAISE EXCEPTION
      '% did not leave every target at unapproved review card version 2',
      migration_key;
  END IF;

  IF (
    SELECT count(*)
    FROM explosive_landmine_variant_seed seed
    JOIN coaching.exercise_definition_v1 definition
      ON definition.facility_id = 1
     AND definition.slug = seed.slug
    JOIN coaching.exercise_variant_v1 variant
      ON variant.definition_id = definition.id
     AND variant.variant_key = seed.variant_key
     AND variant.status = 'review'
  ) <> 7 THEN
    RAISE EXCEPTION
      '% did not create all 7 exact review variants',
      migration_key;
  END IF;

  IF (
    SELECT count(*)
    FROM explosive_landmine_variant_seed seed
    JOIN coaching.exercise_definition_v1 definition
      ON definition.facility_id = 1
     AND definition.slug = seed.slug
    JOIN coaching.exercise_variant_v1 variant
      ON variant.definition_id = definition.id
     AND variant.variant_key = seed.variant_key
    JOIN coaching.exercise_delivery_profile_v1 profile
      ON profile.variant_id = variant.id
     AND profile.status = 'review'
  ) <> 14 THEN
    RAISE EXCEPTION
      '% did not create all 14 contextual delivery profiles',
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
      AND definition.slug = ANY(target_slugs)
  ) <> 48 THEN
    RAISE EXCEPTION
      '% did not create all 48 candidate evidence rows',
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
     AND media.reviewer_user_id IS NULL
     AND media.reviewed_at IS NULL
    WHERE definition.facility_id = 1
      AND definition.slug = ANY(target_slugs)
  ) NOT IN (0, 11) THEN
    RAISE EXCEPTION
      '% did not create all 11 unverified media candidates',
      migration_key;
  END IF;

  IF (
    SELECT count(*)
    FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_alternate_assessment_v1 alternate
      ON alternate.definition_id = definition.id
     AND alternate.reviewed_card_version = definition.card_version
     AND alternate.review_status = 'candidate'
    WHERE definition.facility_id = 1
      AND definition.slug = ANY(target_slugs)
  ) NOT IN (0, 18) THEN
    RAISE EXCEPTION
      '% did not create all 18 alternate assessments',
      migration_key;
  END IF;

  IF (
    SELECT count(*)
    FROM explosive_landmine_relationship_seed seed
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
  ) <> 8 THEN
    RAISE EXCEPTION
      '% did not create all 8 review-only relationships',
      migration_key;
  END IF;

  IF (
    SELECT count(*)
    FROM explosive_landmine_variant_seed seed
    JOIN coaching.exercise_definition_v1 definition
      ON definition.facility_id = 1
     AND definition.slug = seed.slug
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
  ) <> 14 THEN
    RAISE EXCEPTION
      '% did not create all 14 review-only calibration rows',
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
      AND definition.slug = ANY(target_slugs)
  ) <> 3 THEN
    RAISE EXCEPTION
      '% did not create all 3 quarantined card test packets',
      migration_key;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_media_candidate_v1 media
      ON media.definition_id = definition.id
     AND media.reviewed_card_version = definition.card_version
    WHERE definition.facility_id = 1
      AND definition.slug = ANY(target_slugs)
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
    FROM explosive_landmine_relationship_seed seed
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
    FROM explosive_landmine_variant_seed seed
    JOIN coaching.exercise_definition_v1 definition
      ON definition.facility_id = 1
     AND definition.slug = seed.slug
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
      '% created or retained an unsupported approval state',
      migration_key;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM coaching.exercise_definition_v1 survivor
    JOIN coaching.exercise_definition_source_v1 source
      ON source.definition_id = survivor.id
     AND source.legacy_exercise_id = 1416
    JOIN coaching.exercise_definition_v1 duplicate
      ON duplicate.facility_id = survivor.facility_id
     AND duplicate.slug = 'two-hand-landmine-push-press'
     AND duplicate.status = 'archived'
    WHERE survivor.facility_id = 1
      AND survivor.slug = 'one-arm-landmine-push-press'
      AND survivor.status = 'review'
  ) THEN
    RAISE EXCEPTION
      '% lost the archived two-hand push-press source mapping',
      migration_key;
  END IF;
  CREATE TEMP TABLE explosive_landmine_media_seed (
    slug TEXT NOT NULL,
    video_id TEXT NOT NULL,
    title TEXT NOT NULL,
    channel_name TEXT,
    source_query TEXT NOT NULL,
    notes TEXT NOT NULL,
    PRIMARY KEY (slug, video_id)
  ) ON COMMIT DROP;

  INSERT INTO explosive_landmine_media_seed VALUES
    ('one-arm-landmine-push-press','MwXJebZh4nk','Single-Arm Landmine Push Press | Exercise Demo','Red Dot Fitness','single arm landmine push press exercise demo','Public search result candidate. Playback, oEmbed, exact stance and sequence, embedding, cues, captions, accessibility, quality, reviewer, and approval remain pending.'),
    ('one-arm-landmine-push-press','M7P7qPojHZE','Landmine push press',NULL,'unilateral landmine push press','Public search result candidate linked from a landmine exercise guide. All verification and exact-variant gates remain pending.'),
    ('one-arm-landmine-push-press','2O-AaN6dUSc','Single Arm Landmine Push Press',NULL,'single arm landmine push press','Public search result candidate linked from a landmine shoulder exercise guide. All verification and exact-variant gates remain pending.'),
    ('one-arm-landmine-push-press','u-HAgu0odgY','Landmine Push Press','Breaking Muscle','landmine push press exercise','Public search result candidate. Hand count and exact push-press sequence require human review; all media gates remain pending.'),
    ('one-arm-landmine-push-press','Rc23TMvgY34','Landmine Push Press','Testosterone Nation','landmine push press','Public search result candidate. Hand count, stance, exact sequence, and all media gates remain pending.'),
    ('one-arm-landmine-split-jerk','ccpp98MbLoM','Single Arm Landmine Split Jerk','Tinsley Performance','single arm landmine split jerk','Public search result candidate. Playback, oEmbed, arm-leg relationship, catch, recovery, embedding, captions, quality, reviewer, and approval remain pending.'),
    ('one-arm-landmine-split-jerk','5Rebfu_-T98','Landmine Split Jerk','Testosterone Nation','landmine split jerk','Public search result candidate. All exact-variant and media review gates remain pending.'),
    ('one-arm-landmine-split-jerk','J4MJUcilrmo','Landmine Split Jerk','The Official Beast Lab presented by Greg Gurenlian','landmine split jerk exercise','Public search result candidate. All exact-variant and media review gates remain pending.'),
    ('landmine-squat-to-press','0oJsNm_MreY','Landmine Squat To Press','Muscle & Motion','landmine squat to press','Public search result candidate. Playback, oEmbed, exact rack, depth, sequence, embedding, captions, accessibility, quality, reviewer, and approval remain pending.'),
    ('landmine-squat-to-press','G9RpZXJcg10','Landmine Squat to Press','Simone Sports Performance','landmine squat to press exercise','Public search result candidate. All exact-variant and media review gates remain pending.'),
    ('landmine-squat-to-press','qFwUiUkMlFg','Landmine Squat to Press','Isaac Hadac','landmine squat to press','Public search result candidate. All exact-variant and media review gates remain pending.');

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
    media.notes
  FROM explosive_landmine_media_seed media
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id = 1
   AND definition.slug = media.slug
   AND definition.status <> 'archived'
  ON CONFLICT (
    definition_id,
    reviewed_card_version,
    video_id
  )
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
    notes = EXCLUDED.notes,
    updated_at = now();

  CREATE TEMP TABLE explosive_landmine_alternate_seed (
    slug TEXT NOT NULL,
    alternate_name TEXT NOT NULL,
    classification TEXT NOT NULL,
    rationale TEXT NOT NULL,
    dimensions JSONB NOT NULL,
    proposed_card JSONB,
    PRIMARY KEY (slug, alternate_name)
  ) ON COMMIT DROP;

  INSERT INTO explosive_landmine_alternate_seed VALUES
    ('one-arm-landmine-push-press','Unilateral Square-Stance Landmine Push Press','new_variant','One shoulder rack and a parallel stance preserve the shallow dip-drive identity while adding unilateral trunk and side-dose demands.','{"variantKey":"unilateral-square-stance-dip-drive","handCount":1,"stance":"square"}'::JSONB,NULL),
    ('one-arm-landmine-push-press','Unilateral Split-Stance Landmine Push Press','new_variant','A fixed stagger changes force symmetry but no foot moves during the repetition.','{"variantKey":"unilateral-split-stance-dip-drive","handCount":1,"stance":"fixed_split"}'::JSONB,NULL),
    ('one-arm-landmine-push-press','Bilateral Landmine Push Press','new_variant','Two hands change symmetry, grip and load tolerance without changing the shallow dip-drive press sequence.','{"variantKey":"bilateral-square-stance-dip-drive","handCount":2,"legacySourceSlug":"two-hand-landmine-push-press","legacyExerciseId":1416}'::JSONB,NULL),
    ('one-arm-landmine-push-press','One-Arm Landmine Split Jerk','new_definition','The jerk adds a rapid split-foot receiving phase and recovery after propulsion.','{"existingSlug":"one-arm-landmine-split-jerk","receivingAction":"split_catch"}'::JSONB,NULL),
    ('one-arm-landmine-push-press','Landmine Squat-to-Press','new_definition','A full squat followed by the press is a longer ordered action than the shallow push-press dip.','{"existingSlug":"landmine-squat-to-press","lowerBodyAction":"full_squat"}'::JSONB,NULL),
    ('one-arm-landmine-push-press','Paused or Tempo Landmine Push Press','modifier_annotation','Pause, load, range and return tempo change dose; a pause that destroys dip-drive transfer no longer satisfies the output variant.','{"modifiers":["dip_pause","load","range","return_tempo"]}'::JSONB,NULL),
    ('one-arm-landmine-split-jerk','Ipsilateral Arm-to-Lead-Leg Landmine Split Jerk','new_variant','Working arm and lead leg share a side; the exact relationship controls coaching and dose.','{"variantKey":"working-arm-ipsilateral-to-lead-leg-split-jerk","workingArmToLeadLeg":"ipsilateral"}'::JSONB,NULL),
    ('one-arm-landmine-split-jerk','Contralateral Arm-to-Lead-Leg Landmine Split Jerk','new_variant','Working arm opposes the lead leg, changing cross-body stabilization.','{"variantKey":"working-arm-contralateral-to-lead-leg-split-jerk","workingArmToLeadLeg":"contralateral"}'::JSONB,NULL),
    ('one-arm-landmine-split-jerk','Landmine Push Press','new_definition','Push press finishes tall without a rapid split-foot receiving phase.','{"existingSlug":"one-arm-landmine-push-press","receivingAction":"none"}'::JSONB,NULL),
    ('one-arm-landmine-split-jerk','Fixed Split-Stance One-Arm Landmine Press','new_definition','The feet begin and remain split while a strict press is performed; there is no catch-under sequence.','{"existingSlug":"landmine-press","variant":"single-arm-split-stance-sleeve-grip-strict"}'::JSONB,NULL),
    ('one-arm-landmine-split-jerk','Landmine Push Jerk','new_definition','A push jerk receives with both feet in a shallow squat rather than a fore-aft split.','{"receivingAction":"bilateral_quarter_squat"}'::JSONB,'{"status":"proposal_only_human_review_required"}'::JSONB),
    ('one-arm-landmine-split-jerk','Split Depth or Recovery-Foot Emphasis','modifier_annotation','Marker distance and recovery cue can scale a valid split jerk if the rapid split receive remains intact.','{"modifiers":["split_length","split_width","recovery_order","load"]}'::JSONB,NULL),
    ('landmine-squat-to-press','Bilateral Landmine Squat-to-Press','new_variant','Two hands at a central rack preserve the squat-to-press action while changing symmetry and load tolerance.','{"variantKey":"bilateral-continuous-squat-to-press","handCount":2}'::JSONB,NULL),
    ('landmine-squat-to-press','Unilateral Landmine Squat-to-Press','new_variant','A single shoulder rack adds anti-rotation and side-dose requirements within the same ordered action.','{"variantKey":"unilateral-continuous-squat-to-press","handCount":1}'::JSONB,NULL),
    ('landmine-squat-to-press','Landmine Push Press','new_definition','Push press uses a shallow propulsion dip rather than a deliberate squat through the prescribed depth.','{"existingSlug":"one-arm-landmine-push-press","lowerBodyAction":"shallow_dip_drive"}'::JSONB,NULL),
    ('landmine-squat-to-press','Landmine Clean to Press','new_definition','Clean-to-press adds pickup, pull, turnover or transfer, and receiving actions before the press.','{"existingSlug":"landmine-clean-to-press","entryAction":"clean"}'::JSONB,NULL),
    ('landmine-squat-to-press','Landmine Reverse Lunge to Press','new_definition','A step-back lunge changes support, laterality, lower-body action and side dose.','{"existingSlug":"landmine-reverse-lunge-to-press","lowerBodyAction":"reverse_lunge"}'::JSONB,NULL),
    ('landmine-squat-to-press','Squat Depth, Tempo, or Pause','modifier_annotation','Owned depth, tempo and pause change dose and difficulty while the squat-to-press sequence remains intact.','{"modifiers":["squat_depth","eccentric_tempo","bottom_pause","load"]}'::JSONB,NULL);

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
    alternate.proposed_card,
    'candidate',
    NULL,
    NULL
  FROM explosive_landmine_alternate_seed alternate
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id = 1
   AND definition.slug = alternate.slug
   AND definition.status <> 'archived'
  ON CONFLICT (
    definition_id,
    reviewed_card_version,
    alternate_name
  )
  DO UPDATE SET
    classification = EXCLUDED.classification,
    rationale = EXCLUDED.rationale,
    distinguishing_dimensions = EXCLUDED.distinguishing_dimensions,
    proposed_card_json = EXCLUDED.proposed_card_json,
    review_status = 'candidate',
    reviewer_user_id = NULL,
    reviewed_at = NULL,
    updated_at = now();

  UPDATE coaching.exercise_card_test_packet_v1 packet
  SET checks_json = packet.checks_json
        || jsonb_build_object(
          'mediaCandidateCount', (
            SELECT count(DISTINCT media.video_id)
            FROM coaching.exercise_media_candidate_v1 media
            WHERE media.definition_id = definition.id
              AND media.reviewed_card_version = definition.card_version
              AND media.review_status = 'candidate'
              AND media.link_status = 'unverified'
              AND media.embedding_allowed IS FALSE
          ),
          'mediaVerifiedOrApprovedCount', (
            SELECT count(*)
            FROM coaching.exercise_media_candidate_v1 media
            WHERE media.definition_id = definition.id
              AND media.reviewed_card_version = definition.card_version
              AND (
                media.link_status = 'healthy'
                OR media.embedding_allowed IS TRUE
                OR media.exact_variant_match IS NOT NULL
                OR media.review_status <> 'candidate'
              )
          ),
          'alternateAssessmentsPresent', (
            SELECT count(*)
            FROM coaching.exercise_alternate_assessment_v1 alternate
            WHERE alternate.definition_id = definition.id
              AND alternate.reviewed_card_version = definition.card_version
              AND alternate.review_status = 'candidate'
          ) = 6
        ),
      checked_at = now()
  FROM coaching.exercise_definition_v1 definition
  WHERE packet.definition_id = definition.id
    AND definition.facility_id = 1
    AND definition.slug = ANY(target_slugs)
    AND definition.status <> 'archived';

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
      AND definition.slug = ANY(target_slugs)
  ) <> 11 THEN
    RAISE EXCEPTION
      '% did not create all 11 unverified, non-embeddable media candidates',
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
      AND definition.slug = ANY(target_slugs)
  ) <> 18 THEN
    RAISE EXCEPTION
      '% did not create all 18 candidate alternate assessments',
      migration_key;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_media_candidate_v1 media
      ON media.definition_id = definition.id
     AND media.reviewed_card_version = definition.card_version
    WHERE definition.facility_id = 1
      AND definition.slug = ANY(target_slugs)
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
      AND definition.slug = ANY(target_slugs)
      AND (
        alternate.review_status <> 'candidate'
        OR alternate.reviewer_user_id IS NOT NULL
        OR alternate.reviewed_at IS NOT NULL
      )
  ) THEN
    RAISE EXCEPTION
      '% created or retained an unsupported media or alternate approval state',
      migration_key;
  END IF;
END
$$;
