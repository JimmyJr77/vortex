-- Complete the consolidated Cossack Squat and the distinct but unresolved
-- Cossack Shift to Wall Ball Toss candidate cards.
--
-- Migration 307 is the identity authority: it consolidated twelve range,
-- tempo, hold, reach, and exact-implement sources into Cossack Squat while
-- retaining the release/target/rebound/reception composite as a separate
-- definition. The generic reach direction, generic loaded implement, and the
-- complete wall-toss protocol remain identity-quarantined.
--
-- Public-search YouTube URLs are unverified, non-embeddable candidates. No
-- playback, oEmbed, exact-match, caption, accessibility, quality, reviewer,
-- media, graph, calibration, card, or publication approval is claimed.
-- Exercise difficulty is exercise complexity plus physical difficulty, with
-- overall derived as their maximum. Athlete proficiency levels remain
-- exclusive to coaching.skill and are intentionally absent.
-- IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '403_coaching_cossack_squat_family_completion';
  research_batch CONSTANT TEXT := 'cossack-squat-family-v1';
  research_version CONSTANT TEXT := '2026-07-26.24';
  target_slugs CONSTANT TEXT[] := ARRAY[
    'cossack-squat',
    'cossack-shift-to-wall-ball-toss'
  ]::TEXT[];
  active_count INTEGER;
  already_applied_count INTEGER;
  protected_count INTEGER;
  source_count INTEGER;
  consolidated_count INTEGER;
BEGIN
  SELECT count(*)
  INTO active_count
  FROM coaching.exercise_definition_v1
  WHERE facility_id = 1
    AND slug = ANY(target_slugs)
    AND status <> 'archived';

  IF active_count <> 2 THEN
    RAISE EXCEPTION
      '% expected exactly 2 active target definitions; found %',
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

  IF already_applied_count NOT IN (0, 2) THEN
    RAISE EXCEPTION
      '% found a partial prior application on % of 2 cards',
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
    AND definition.status <> 'archived';

  IF source_count <> 14 THEN
    RAISE EXCEPTION
      '% expected all 14 legacy mappings on the active survivor set; found %',
      migration_key,
      source_count;
  END IF;

  SELECT count(*)
  INTO consolidated_count
  FROM coaching.exercise_definition_v1 survivor
  JOIN coaching.exercise_identity_resolution_v1 resolution
    ON resolution.survivor_definition_id = survivor.id
   AND resolution.decision = 'duplicate_consolidated'
  JOIN coaching.exercise_definition_v1 duplicate
    ON duplicate.id = resolution.resolved_definition_id
   AND duplicate.status = 'archived'
  WHERE survivor.facility_id = 1
    AND survivor.slug = 'cossack-squat'
    AND survivor.status <> 'archived'
    AND duplicate.slug = ANY(ARRAY[
      'cossack-bottom-hold',
      'cossack-bottom-hold-cossack-shift-hold',
      'cossack-shift-with-reach',
      'cossack-shift-with-t-spine-reach',
      'cossack-shift',
      'cossack-squat-pry',
      'cossack-squat-shift-to-stick',
      'kettlebell-cossack-squat',
      'landmine-cossack-squat',
      'loaded-cossack-squat',
      'sandbag-cossack-squat-strength',
      'slow-cossack-squat-shift'
    ]::TEXT[]);

  IF consolidated_count <> 12 THEN
    RAISE EXCEPTION
      '% requires all 12 migration-307 Cossack consolidations; found %',
      migration_key,
      consolidated_count;
  END IF;

  IF already_applied_count = 0 THEN
    SELECT count(*)
    INTO protected_count
    FROM coaching.exercise_definition_v1 definition
    WHERE definition.facility_id = 1
      AND definition.slug = ANY(target_slugs)
      AND (
        definition.card_version <> 1
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
    FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_definition_source_v1 source
      ON source.definition_id = definition.id
    JOIN coaching.exercise_score_v1 score
      ON score.exercise_id = source.legacy_exercise_id
    WHERE definition.facility_id = 1
      AND definition.slug = ANY(target_slugs)
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
          AND (variant.status = 'published' OR profile.status = 'published')
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
            'selectable',FALSE,
            'completionQuarantine',TRUE,
            'quarantineReason',
              'Superseded source variant lacks the complete exact range, support, reach, implement, throw, load, dose, fatigue, and stop-rule contract.'
          ),
        updated_at = now()
    FROM coaching.exercise_definition_v1 definition
    WHERE variant.definition_id = definition.id
      AND definition.facility_id = 1
      AND definition.slug = ANY(target_slugs);
  END IF;

  CREATE TEMP TABLE cossack_card_seed (
    slug TEXT PRIMARY KEY,
    canonical_name TEXT NOT NULL,
    aliases TEXT[] NOT NULL,
    description TEXT NOT NULL,
    movement_patterns TEXT[] NOT NULL,
    body_regions TEXT[] NOT NULL,
    required_equipment TEXT[] NOT NULL,
    optional_equipment TEXT[] NOT NULL,
    content_confidence SMALLINT NOT NULL,
    anatomy_json JSONB NOT NULL,
    athlete_support_json JSONB NOT NULL,
    coach_support_json JSONB NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO cossack_card_seed VALUES
    (
      'cossack-squat',
      'Cossack Squat',
      ARRAY['Cossack Shift','Side-to-Side Cossack Squat','Wide-Stance Cossack Squat']::TEXT[],
      'Begin in a declared wide stance. Shift the center of mass toward one side while that hip, knee, and ankle flex and the opposite leg remains comparatively long; own the assigned pain-free range, then return through center or transfer under control. Range, support, tempo, hold, specified reach, and exact implement are variant dimensions.',
      ARRAY['squat','lunge','brace']::TEXT[],
      ARRAY['foot','ankle','knee','hip','pelvis','spine','core']::TEXT[],
      ARRAY['none']::TEXT[],
      ARRAY['stable_support','heel_wedge','kettlebell','landmine','barbell','sandbag','floor_markers']::TEXT[],
      84,
      jsonb_build_object(
        'primaryMusclesAndTissues',jsonb_build_array('quadriceps','gluteus_maximus','adductors','gluteus_medius_and_minimus','soleus'),
        'secondaryMusclesAndTissues',jsonb_build_array('hamstrings','gastrocnemius','tibialis_anterior','deep_hip_rotators','foot_intrinsics','obliques','spinal_stabilizers'),
        'joints',jsonb_build_array('foot','ankle','knee','hip','pelvis','lumbar_spine','thoracic_spine'),
        'actions',jsonb_build_array('establish_declared_wide_stance','working_side_hip_knee_and_ankle_flexion','working_side_force_acceptance','contralateral_long_leg_control','working_side_squat_ascent','side_to_side_center_of_mass_transfer'),
        'planes',jsonb_build_array('frontal','sagittal','transverse_stabilization'),
        'laterality','alternating_unilateral_with_both_sides_programmed'
      ),
      jsonb_build_object(
        'plainLanguageSummary','Use a comfortable wide stance, sit into one side without forcing range, keep that foot connected, then return through center under control.',
        'setupChecklist',jsonb_build_array('clear_lateral_space','declare_variant_range_support_reach_implement_and_side_order','set_stance_and_markers','verify_support_or_load_if_used'),
        'cues',jsonb_build_array('sit_into_one_hip','keep_the_working_foot_connected','let_the_other_leg_stay_long_without_forcing_it','own_the_range','match_both_sides'),
        'accessibilityOptions',jsonb_build_array('shallower_range','stable_hand_support','controlled_stance_adjustment','reduced_or_no_external_load','slower_rehearsal','visible_side_cues','longer_rest','written_audio_still_image_or_live_instruction')
      ),
      jsonb_build_object(
        'observationPriorities',jsonb_build_array('stance_and_surface','working_foot_and_knee','hip_pelvis_and_trunk','contralateral_leg','range_and_symmetry','exact_support_reach_or_implement'),
        'qualityGate','Count only repetitions with stable foot contact, tracked working knee and hip, controlled pelvis and trunk, unforced contralateral leg position, the declared variant, and repeatable pain-free range.',
        'stopRules',jsonb_build_array('sharp_or_increasing_hip_groin_knee_ankle_or_back_pain','joint_catching_giving_way_or_neurologic_symptoms','foot_slip_or_repeated_contact_loss','repeated_knee_pelvis_or_trunk_collapse','forced_end_range_or_bouncing','balance_loss','unsafe_support_implement_or_anchor','visible_side_to_side_quality_decline')
      )
    ),
    (
      'cossack-shift-to-wall-ball-toss',
      'Cossack Shift to Wall Ball Toss',
      ARRAY['Cossack Shift Wall Toss','Cossack-to-Wall-Ball Toss']::TEXT[],
      'Candidate composite beginning with a declared shallow Cossack-like lateral shift, returning through center, and releasing a medicine ball toward a wall target. The legacy source does not define throw direction, target height, ball path, rebound behavior, reception, side order, or reset, so this identity remains nonselectable until a human authors and reviews the complete protocol.',
      ARRAY['squat','lunge','throw','brace']::TEXT[],
      ARRAY['foot','ankle','knee','hip','pelvis','spine','core','shoulder','scapula','elbow','wrist','hand']::TEXT[],
      ARRAY['medicine_ball','wall']::TEXT[],
      ARRAY['floor_markers','wall_target','lane_markers','video_capture']::TEXT[],
      52,
      jsonb_build_object(
        'primaryMusclesAndTissues',jsonb_build_array('quadriceps','gluteus_maximus','adductors','deltoids','triceps','abdominal_wall'),
        'secondaryMusclesAndTissues',jsonb_build_array('gluteus_medius_and_minimus','hamstrings','calf_complex','foot_intrinsics','pectorals','latissimus_dorsi','serratus_anterior','rotator_cuff','obliques','spinal_stabilizers'),
        'joints',jsonb_build_array('foot','ankle','knee','hip','pelvis','lumbar_spine','thoracic_spine','scapulothoracic_articulation','shoulder','elbow','wrist','hand'),
        'actions',jsonb_build_array('shallow_lateral_force_acceptance','return_to_center','whole_body_force_transfer_to_ball','aimed_release_unresolved','rebound_reception_or_retrieval_unresolved'),
        'planes',jsonb_build_array('frontal','sagittal','throw_plane_unresolved'),
        'laterality','side_and_throw_laterality_unresolved',
        'identityReviewState','throw_direction_target_ball_path_rebound_reception_side_order_and_reset_unresolved'
      ),
      jsonb_build_object(
        'plainLanguageSummary','This card is not ready for training use because the throw path, target, rebound, catch or retrieval rule, side order, and reset are not yet defined.',
        'setupChecklist',jsonb_build_array('do_not_prescribe','assign_human_identity_review','verify_wall_ball_and_lane_before_any_component_rehearsal'),
        'cues',jsonb_build_array('rehearse_components_only_under_coach_direction','do_not_invent_a_throw_or_catch_protocol'),
        'accessibilityOptions',jsonb_build_array('bodyweight_cossack_shift_component','stationary_exact_wall_toss_component','lighter_known_ball','no_catch_retrieval_only_after_ball_settles','written_audio_diagram_and_live_instruction_after_protocol_review')
      ),
      jsonb_build_object(
        'observationPriorities',jsonb_build_array('identity_protocol_completion','wall_ball_and_target_compatibility','lane_and_rebound_zone','shift_and_return_to_center','declared_release_and_reception','side_order_and_reset'),
        'qualityGate','No production repetition can be counted until a human defines and independently reviews the exact shift, throw direction, target, ball path, rebound behavior, reception or retrieval, side order, and reset.',
        'stopRules',jsonb_build_array('any_unresolved_protocol_question','pain_or_guarding','foot_slip_or_balance_loss','off_target_or_unexpected_ball_path','unsafe_wall_ball_or_rebound_response','fumbled_or_uncontrolled_reception','person_or_object_in_lane','repeated_trunk_or_shoulder_compensation','visible_power_or_accuracy_decline')
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
      family_key = 'cossack_squat_family',
      schema_version = '1.0.0',
      card_version = CASE
        WHEN definition.provenance_json->>'structuralCompletionMigration'
          IS DISTINCT FROM migration_key
          THEN definition.card_version + 1
        ELSE definition.card_version
      END,
      status = 'review',
      content_confidence = seed.content_confidence,
      scoring_confidence = CASE
        WHEN definition.slug = 'cossack-squat' THEN 76
        ELSE 58
      END,
      media_confidence = 20,
      movement_patterns = seed.movement_patterns,
      body_regions = seed.body_regions,
      required_equipment = seed.required_equipment,
      optional_equipment = seed.optional_equipment,
      anatomy_json = seed.anatomy_json,
      environment_json = CASE
        WHEN definition.slug = 'cossack-squat' THEN jsonb_build_object(
          'surface','level_non_slip',
          'clearance',jsonb_build_array('full_lateral_stance_and_transfer_zone','support_or_implement_zone_when_used','no_cross_traffic'),
          'supportPolicy','stable_and_outside_the_working_side_path',
          'loadedVariantPolicy','exact_implement_and_safe_pickup_return_required'
        )
        ELSE jsonb_build_object(
          'surface','level_non_slip',
          'wall','structurally_approved_for_declared_ball_impact',
          'clearance',jsonb_build_array('lateral_shift_zone','throw_lane','rebound_and_retrieval_zone','no_cross_traffic'),
          'target','visible_and_protocol_specific',
          'athletesPerLane',1
        )
      END,
      population_json = CASE
        WHEN definition.slug = 'cossack-squat' THEN jsonb_build_object(
          'selectionStatus','candidate_requires_human_review',
          'readinessChecks',jsonb_build_array('pain_free_wide_stance_and_lateral_shift','stable_working_foot_contact','controlled_return_from_each_side','range_selected_without_forcing_hip_groin_knee_or_ankle','exact_implement_handling_for_loaded_variants'),
          'constraints',jsonb_build_array('range_matches_current_control','both_sides_are_programmed_and_recorded','load_preserves_exact_variant','unresolved_reach_or_implement_variants_are_not_selectable'),
          'contraindications',jsonb_build_array('acute_pain_neurologic_symptoms_or_joint_instability','forced_end_range','unsafe_surface_support_implement_or_anchor','cannot_control_working_foot_knee_pelvis_or_return')
        )
        ELSE jsonb_build_object(
          'selectionStatus','blocked_pending_identity_protocol_review',
          'readinessChecks',jsonb_build_array('bodyweight_cossack_shift_component','exact_ball_handling_component','exact_throw_component','exact_reception_or_retrieval_component','target_lane_and_stop_signal_understood'),
          'constraints',jsonb_build_array('production_selection_false','protocol_must_be_defined_before_dose','wall_ball_and_lane_require_facility_review'),
          'contraindications',jsonb_build_array('any_unresolved_protocol_question','unsafe_wall_ball_target_or_lane','pain_balance_loss_or_uncontrolled_rebound','cannot_execute_each_component_separately')
        )
      END,
      athlete_support_json = seed.athlete_support_json,
      coach_support_json = seed.coach_support_json,
      support_operations_json = jsonb_build_object(
        'supportSummary','Expose the exact range, support, tempo, hold, reach, implement, side dose, symptoms, and stop reason; the wall-toss card additionally requires a reviewed throw, target, rebound, reception, side-order, and reset protocol.',
        'issueCategories',jsonb_build_array('identity_or_variant','range_or_side_symmetry','difficulty_or_dose','equipment_or_environment','symptom_or_population_constraint','instruction_or_accessibility','media_exact_match','relationship','calibration'),
        'supportEscalation',jsonb_build_object(
          'urgent',jsonb_build_array('acute_injury','neurologic_or_cardiovascular_symptom','unsafe_ball_rebound_or_collision'),
          'coachReview',jsonb_build_array('repeated_foot_knee_pelvis_trunk_or_symmetry_fault','unclear_range_support_reach_implement_or_side_dose'),
          'equipmentReview',jsonb_build_array('unstable_support','unsafe_landmine_anchor','unknown_ball_rebound','unapproved_wall_or_target'),
          'contentReview',jsonb_build_array('generic_reach_direction','generic_loaded_implement','wall_toss_protocol','media_mismatch','missing_accessibility_or_stop_rule')
        ),
        'knownLimitations',jsonb_build_array('candidate_media_not_playback_or_oembed_verified','generic_reach_and_loaded_variants_nonselectable','wall_toss_identity_and_dose_nonselectable','scores_relationships_calibrations_and_cards_are_unapproved_proposals'),
        'changeImpactPolicy','Changes to stance, range, support, tempo, hold, reach, implement, load, throw direction, target, ball behavior, reception, side order, reset, difficulty, dose, stop rule, relationship, or media require renewed affected reviews.'
      ),
      approved_video_url = NULL,
      reviewed_by = NULL,
      approved_by = NULL,
      last_reviewed_at = NULL,
      provenance_json = definition.provenance_json || jsonb_build_object(
        'structuralCompletionMigration',migration_key,
        'researchBatch',research_batch,
        'researchVersion',research_version,
        'identityAuthorityMigration','307_coaching_cossack_variant_consolidation',
        'evidenceState','candidate_requires_human_review',
        'mediaState','public_search_candidates_unverified_and_non_embeddable',
        'difficultyModel','max_exercise_complexity_physical_difficulty',
        'humanReviewRequired',TRUE,
        'publicationQuarantined',TRUE,
        'mediaApprovalCreated',FALSE,
        'graphApprovalCreated',FALSE,
        'calibrationApprovalCreated',FALSE
      ),
      updated_at = now()
  FROM cossack_card_seed seed
  WHERE definition.facility_id = 1
    AND definition.slug = seed.slug
    AND definition.status <> 'archived';

  CREATE TEMP TABLE cossack_variant_seed (
    slug TEXT NOT NULL,
    variant_key TEXT NOT NULL,
    display_name TEXT NOT NULL,
    action_identity TEXT NOT NULL,
    range_contract TEXT NOT NULL,
    support_or_implement TEXT NOT NULL,
    overlay_or_protocol TEXT NOT NULL,
    complexity SMALLINT,
    physical SMALLINT,
    coordination SMALLINT NOT NULL,
    supervision SMALLINT NOT NULL,
    consequence SMALLINT NOT NULL,
    impact SMALLINT NOT NULL,
    local_fatigue SMALLINT NOT NULL,
    grip_fatigue SMALLINT NOT NULL,
    technical_fatigue SMALLINT NOT NULL,
    recovery_hours SMALLINT NOT NULL,
    equipment TEXT[] NOT NULL,
    selectable BOOLEAN NOT NULL,
    identity_quarantine BOOLEAN NOT NULL,
    PRIMARY KEY (slug, variant_key)
  ) ON COMMIT DROP;

  INSERT INTO cossack_variant_seed VALUES
    ('cossack-squat','baseline','Cossack Squat — Bodyweight Baseline','fixed_wide_stance_cossack_squat','self_selected_pain_free_full_range','bodyweight_no_external_support','none',48,38,48,32,36,8,42,10,52,24,ARRAY['none']::TEXT[],TRUE,FALSE),
    ('cossack-squat','low-amplitude-shift','Cossack Squat — Low-Amplitude Shift','fixed_wide_stance_cossack_squat','low_amplitude_self_selected','bodyweight_no_external_support','none',30,18,32,24,24,4,24,8,34,12,ARRAY['none']::TEXT[],TRUE,FALSE),
    ('cossack-squat','bottom-hold','Cossack Squat — Bottom Hold','fixed_wide_stance_cossack_squat','self_selected_deep_range','bodyweight_no_external_support','declared_isometric_hold',44,42,42,32,36,4,52,8,46,24,ARRAY['none']::TEXT[],TRUE,FALSE),
    ('cossack-squat','bottom-pry','Cossack Squat — Bottom Pry','fixed_wide_stance_cossack_squat','self_selected_deep_range','bodyweight_no_external_support','small_controlled_bottom_pry',48,40,48,36,38,6,46,8,50,24,ARRAY['none']::TEXT[],TRUE,FALSE),
    ('cossack-squat','shift-to-stick','Cossack Squat — Shift to Stick','fixed_wide_stance_cossack_squat','self_selected_controlled_range','bodyweight_no_external_support','declared_terminal_stick',50,36,54,36,40,8,42,8,54,24,ARRAY['none']::TEXT[],TRUE,FALSE),
    ('cossack-squat','slow-eccentric-shift','Cossack Squat — Slow Eccentric Shift','fixed_wide_stance_cossack_squat','self_selected_controlled_range','bodyweight_no_external_support','declared_slow_eccentric_and_transfer',48,44,48,34,38,6,56,8,50,36,ARRAY['none']::TEXT[],TRUE,FALSE),
    ('cossack-squat','reach-overlay','Cossack Squat — Reach Direction Unresolved','fixed_wide_stance_cossack_squat','self_selected_controlled_range','bodyweight_no_external_support','reach_direction_unresolved',46,30,54,38,40,6,34,8,56,24,ARRAY['none']::TEXT[],FALSE,TRUE),
    ('cossack-squat','thoracic-rotation-reach','Cossack Squat — Thoracic Rotation Reach','fixed_wide_stance_cossack_squat','self_selected_controlled_range','bodyweight_no_external_support','declared_thoracic_rotation_reach',54,34,62,42,42,6,36,8,62,24,ARRAY['none']::TEXT[],TRUE,FALSE),
    ('cossack-squat','kettlebell-loaded','Cossack Squat — Kettlebell Loaded','fixed_wide_stance_cossack_squat','self_selected_controlled_range','declared_kettlebell_load_position','none',52,56,52,46,50,6,62,48,56,48,ARRAY['kettlebell']::TEXT[],TRUE,FALSE),
    ('cossack-squat','landmine-loaded','Cossack Squat — Landmine Loaded','fixed_wide_stance_cossack_squat','self_selected_controlled_range','rated_fixed_landmine_anchor_and_declared_rack','none',52,60,54,54,56,6,66,44,58,48,ARRAY['landmine','barbell']::TEXT[],TRUE,FALSE),
    ('cossack-squat','loaded-unspecified-implement','Cossack Squat — Loaded Implement Unresolved','fixed_wide_stance_cossack_squat','range_unresolved_with_load','implement_and_load_position_unresolved','none',NULL,NULL,52,48,52,6,58,40,58,48,ARRAY[]::TEXT[],FALSE,TRUE),
    ('cossack-squat','sandbag-loaded','Cossack Squat — Sandbag Loaded','fixed_wide_stance_cossack_squat','self_selected_controlled_range','declared_sandbag_load_position','none',54,62,56,48,52,6,68,54,60,48,ARRAY['sandbag']::TEXT[],TRUE,FALSE),
    ('cossack-shift-to-wall-ball-toss','unresolved-throw-protocol','Cossack Shift to Wall Ball Toss — Protocol Unresolved','cossack_shift_return_to_center_wall_ball_release','shallow_shift_depth_unresolved','medicine_ball_and_wall_target','throw_target_rebound_reception_side_order_and_reset_unresolved',64,58,68,66,62,30,58,42,72,48,ARRAY['medicine_ball','wall']::TEXT[],FALSE,TRUE);

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
      seed.range_contract,
      seed.support_or_implement,
      seed.overlay_or_protocol
    ]::TEXT[],
    CASE
      WHEN seed.complexity IS NULL OR seed.physical IS NULL
        THEN jsonb_build_object(
          'scoreDeferred',TRUE,
          'deferredReason','Exact implement, load position, usable range, and exit are unresolved.',
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
        'workCapacityDemand',seed.local_fatigue,
        'difficultyModel','max_exercise_complexity_physical_difficulty',
        'dimensionMeaning',jsonb_build_object('technicalComplexity','exercise_complexity','absoluteLoadDemand','physical_difficulty'),
        'provisional',TRUE
      )
    END,
    jsonb_build_object(
      'selectable',seed.selectable,
      'identityQuarantine',seed.identity_quarantine,
      'actionIdentity',seed.action_identity,
      'rangeContract',seed.range_contract,
      'supportOrImplement',seed.support_or_implement,
      'overlayOrProtocol',seed.overlay_or_protocol,
      'stance','declared_fixed_wide_stance',
      'sideDose','both_sides_declared_and_recorded',
      'surface','level_non_slip',
      'terminalAction',CASE
        WHEN seed.slug = 'cossack-shift-to-wall-ball-toss'
          THEN 'unresolved_rebound_reception_or_retrieval_and_reset'
        ELSE 'controlled_return_through_center_or_declared_transfer'
      END
    ),
    'review',
    jsonb_build_object(
      'externalLoadMethod',CASE
        WHEN cardinality(seed.equipment) = 0 THEN 'unresolved'
        WHEN seed.equipment = ARRAY['none']::TEXT[] THEN 'bodyweight'
        ELSE array_to_string(seed.equipment,'_and_')
      END,
      'externalLoadDescription',CASE
        WHEN seed.slug = 'cossack-shift-to-wall-ball-toss'
          THEN 'medicine ball with declared mass and rebound behavior after a reviewed lateral-shift protocol'
        WHEN cardinality(seed.equipment) = 0
          THEN 'external implement and load position unresolved'
        WHEN seed.equipment = ARRAY['none']::TEXT[]
          THEN 'bodyweight with no external implement'
        ELSE 'declared external implement, load position, pickup, working range, and return'
      END,
      'effectiveLoadDrivers',jsonb_build_array('body_mass','stance','working_range','support','tempo_or_hold','reach_overlay','implement','load_position','external_mass','side_dose','repetitions'),
      'gripDemand',seed.grip_fatigue,
      'eccentricStress',CASE
        WHEN seed.variant_key = 'slow-eccentric-shift' THEN 68
        ELSE 44
      END,
      'impactClass',CASE
        WHEN seed.slug = 'cossack-shift-to-wall-ball-toss'
          THEN 'low_lower_body_impact_with_external_object_rebound_risk'
        ELSE 'very_low_no_planned_jump'
      END,
      'loadTracking',jsonb_build_array('variant_key','stance','range','support','tempo_or_hold','reach','implement','load_position','external_mass','side','repetitions_or_hold_seconds')
    ),
    jsonb_build_object(
      'localMuscleFatigue',seed.local_fatigue,
      'gripFatigue',seed.grip_fatigue,
      'technicalFatigueSensitivity',seed.technical_fatigue,
      'impactAccumulation',seed.impact,
      'recoveryHours',seed.recovery_hours,
      'primaryFatigueSites',CASE
        WHEN seed.slug = 'cossack-shift-to-wall-ball-toss'
          THEN jsonb_build_array('working_leg_quadriceps_and_gluteals','adductors','trunk','shoulder_and_triceps','grip','aiming_and_reception_control')
        ELSE jsonb_build_array('working_leg_quadriceps_and_gluteals','adductors','ankle_and_foot_stabilizers','pelvic_and_trunk_stabilizers','grip_when_loaded')
      END,
      'earlyFatigueSignals',jsonb_build_array('shortened_or_forced_range','foot_contact_or_knee_tracking_loss','contralateral_leg_change','pelvis_or_trunk_collapse','rushed_transfer','side_asymmetry','implement_or_ball_path_change'),
      'downstreamConflicts',jsonb_build_array('heavy_squatting_lunging_or_adductor_work','sprinting_cutting_or_lateral_jumping','loaded_trunk_or_grip_work','throwing_or_upper_body_power_when_ballistic','fatigue_degraded_conditioning')
    ),
    jsonb_build_object(
      'selectionStatus',CASE
        WHEN seed.selectable THEN 'candidate_requires_human_review'
        ELSE 'blocked_pending_identity_review'
      END,
      'primaryIntent',seed.action_identity,
      'appropriatePhases',CASE
        WHEN seed.selectable THEN jsonb_build_array('prepare','control_resilience','capacity')
        ELSE jsonb_build_array('identity_review_only')
      END,
      'avoidUse',jsonb_build_array('forced_range','unrecorded_support_reach_implement_or_load','unequal_side_dose','fatigue_degraded_alignment_or_transfer','symptom_provocation','unresolved_throw_or_reception_protocol'),
      'cumulativeBudget',jsonb_build_object(
        'lateralSquatRepetitionsPerSide',1,
        'adductorAndHipLoad',seed.local_fatigue,
        'kneeAnkleAndFootLoad',seed.local_fatigue,
        'gripStress',seed.grip_fatigue,
        'technicalSensitivity',seed.technical_fatigue,
        'ballisticThrows',CASE
          WHEN seed.slug = 'cossack-shift-to-wall-ball-toss' THEN 1
          ELSE 0
        END
      )
    )
  FROM cossack_variant_seed seed
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
    CASE
      WHEN seed.selectable THEN 'primary'
      ELSE 'avoid'
    END,
    CASE profile.profile_key
      WHEN 'prepare-control'
        THEN 'Rehearse the exact stance, side shift, range, foot contact, alignment, return, and declared overlay at low fatigue.'
      WHEN 'capacity-strength'
        THEN 'Build repeatable frontal-plane strength and end-range control with the exact support, tempo, hold, reach, or implement.'
      ELSE 'Preserve unresolved identity evidence without authorizing a production dose or workout selection.'
    END,
    CASE
      WHEN seed.selectable THEN 90
      ELSE 1
    END,
    CASE
      WHEN seed.selectable THEN 88
      ELSE 100
    END,
    jsonb_build_object(
      'frontalPlaneAccessAndControl',seed.coordination,
      'strengthAndLoadTolerance',coalesce(seed.physical,0),
      'technicalQuality',seed.technical_fatigue,
      'impact',seed.impact,
      'productionAuthorized',seed.selectable
    ),
    CASE profile.profile_key
      WHEN 'prepare-control' THEN jsonb_build_object(
        'sets',jsonb_build_array(1,3),
        'repsPerSide',jsonb_build_array(3,6),
        'holdSeconds',CASE
          WHEN seed.variant_key = 'bottom-hold' THEN jsonb_build_array(10,30)
          ELSE NULL
        END,
        'rpe',jsonb_build_array(2,5),
        'restSeconds',jsonb_build_array(30,90),
        'tempo','controlled_full_reset',
        'stopBeforeFailure',TRUE
      )
      WHEN 'capacity-strength' THEN jsonb_build_object(
        'sets',jsonb_build_array(2,4),
        'repsPerSide',jsonb_build_array(3,8),
        'holdSeconds',CASE
          WHEN seed.variant_key = 'bottom-hold' THEN jsonb_build_array(10,30)
          ELSE NULL
        END,
        'rpe',jsonb_build_array(5,8),
        'restSeconds',jsonb_build_array(75,180),
        'tempo',CASE
          WHEN seed.variant_key = 'slow-eccentric-shift'
            THEN 'declared_slow_eccentric_and_transition'
          ELSE 'controlled_descent_owned_range_smooth_return'
        END,
        'stopBeforeFailure',TRUE
      )
      ELSE jsonb_build_object(
        'productionDoseAuthorized',FALSE,
        'reviewRequirements',CASE
          WHEN seed.slug = 'cossack-shift-to-wall-ball-toss'
            THEN jsonb_build_array('throw_direction','target_height','ball_path','ball_mass_and_rebound','reception_or_retrieval','side_order','reset','lane')
          ELSE jsonb_build_array('reach_direction_or_implement','load_position','usable_range','pickup_and_exit')
        END
      )
    END,
    CASE
      WHEN seed.selectable
        THEN 'Every counted repetition preserves the declared stance, working-foot contact, knee and hip tracking, pelvis and trunk control, unforced opposite leg, exact range, support, tempo, hold, reach or implement, side dose, and controlled return.'
      ELSE 'No production repetition is authorized until every missing identity dimension is defined and independently reviewed.'
    END,
    ARRAY[
      'Stop for sharp or increasing pain, guarding, neurologic symptoms, joint catching or giving way, or dizziness.',
      'Stop for foot slip, repeated contact loss, knee collapse, pelvic rotation, trunk collapse, forced range, bouncing, balance loss, or worsening side asymmetry.',
      'Stop for unsafe support, implement, anchor, wall, ball, target, lane, rebound, reception, retrieval, or reset.',
      'Do not continue through an unresolved identity question or to uncontrolled failure.'
    ]::TEXT[],
    ARRAY[
      'Confirm exact variant, stance, range, support or implement, side order, load, dose, and stop signal before the set.',
      'Observe working foot, knee, hip, pelvis, trunk, opposite leg, range, transfer, and exact overlay or implement.',
      'For unresolved variants, collect missing identity facts only; do not prescribe or imply approval.'
    ]::TEXT[],
    ARRAY[
      'Use the called stance, side, range, support, tempo, hold, reach, and implement.',
      'Keep the working foot connected, let the other leg stay long without forcing it, and return through center under control.',
      'Stop when pain, alignment, balance, range, equipment, ball path, or the called sequence changes.'
    ]::TEXT[],
    CASE profile.profile_key
      WHEN 'prepare-control'
        THEN 'More repeatable pain-free frontal-plane access, foot-knee-hip alignment, side symmetry, and controlled transfer.'
      WHEN 'capacity-strength'
        THEN 'Improved exact-variant frontal-plane strength, end-range force control, tissue tolerance, and load handling.'
      ELSE 'A complete review record for identity resolution; no training adaptation or dose is promised.'
    END,
    seed.equipment,
    jsonb_build_object(
      'athletesPerStation',1,
      'coachSightline','working_foot_knee_hip_pelvis_trunk_opposite_leg_range_and_declared_equipment_or_ball_lane',
      'requiredClearance',CASE
        WHEN seed.slug = 'cossack-shift-to-wall-ball-toss'
          THEN 'full_lateral_shift_throw_rebound_and_retrieval_lane'
        ELSE 'full_wide_stance_and_lateral_transfer_zone'
      END,
      'setupSeconds',CASE
        WHEN seed.equipment = ARRAY['none']::TEXT[] THEN 30
        ELSE 75
      END,
      'transitionSeconds',30,
      'sharedEquipmentPolicy','One athlete uses the declared lateral or ball lane at a time.'
    ),
    '{}'::UUID[],
    'review',
    jsonb_build_object(
      'repSeconds',CASE
        WHEN seed.variant_key = 'bottom-hold' THEN 20
        WHEN seed.slug = 'cossack-shift-to-wall-ball-toss' THEN 10
        ELSE 6
      END,
      'setupSeconds',CASE
        WHEN seed.equipment = ARRAY['none']::TEXT[] THEN 30
        ELSE 75
      END,
      'transitionSeconds',30,
      'restIsExplicit',TRUE
    ),
    jsonb_build_object(
      'scaleDown',jsonb_build_array('reduce_owned_range','add_stable_support_when_identity_allows','reduce_or_remove_external_load','reduce_repetitions_or_hold_time','increase_rest'),
      'scaleUp',jsonb_build_array('increase_owned_range','increase_hold_or_tempo_within_variant','reduce_support','add_small_exact_load_increment','improve_side_symmetry'),
      'neverScaleBy',jsonb_build_array('forcing_range','changing_reach_or_implement_without_review','inventing_throw_or_catch_protocol','unequal_unrecorded_side_dose','continuing_through_pain_or_control_loss')
    ),
    jsonb_build_object(
      'track',jsonb_build_array('variant_key','stance','range','support','tempo_or_hold','reach','implement_and_load','side_order','repetitions_or_hold_seconds','rpe','rest_seconds','symptoms','quality_stop'),
      'qualityThreshold','All counted repetitions meet the exact variant and side-symmetry gate.',
      'productionSelectable',seed.selectable
    ),
    jsonb_build_object(
      'beforeSet',jsonb_build_array('confirm_exact_variant_and_identity_state','confirm_surface_lane_support_or_equipment','confirm_side_order_range_dose_and_stop_signal'),
      'duringSet',jsonb_build_array('watch_foot_knee_hip_pelvis_trunk_range_transfer_and_symptoms','announce_first_material_quality_stop'),
      'afterSet',jsonb_build_array('record_both_sides_load_dose_rpe_symptoms_and_faults','adjust_without_changing_identity')
    )
  FROM cossack_variant_seed seed
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id = 1
   AND definition.slug = seed.slug
   AND definition.status <> 'archived'
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id = definition.id
   AND variant.variant_key = seed.variant_key
  CROSS JOIN LATERAL (
    SELECT raw.profile_key, raw.phase_key
    FROM (VALUES
      ('prepare-control','prepare_and_access'),
      ('capacity-strength','capacity')
    ) AS raw(profile_key, phase_key)
    WHERE seed.selectable
    UNION ALL
    SELECT 'identity-review-only','prepare_and_access'
    WHERE NOT seed.selectable
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

  CREATE TEMP TABLE cossack_evidence_seed (
    slug TEXT NOT NULL,
    section_key TEXT NOT NULL,
    source_url TEXT NOT NULL,
    source_title TEXT NOT NULL,
    source_publisher TEXT NOT NULL,
    source_kind TEXT NOT NULL,
    evidence_quality SMALLINT NOT NULL,
    claims_json JSONB NOT NULL,
    PRIMARY KEY (slug, section_key)
  ) ON COMMIT DROP;

  INSERT INTO cossack_evidence_seed VALUES
    ('cossack-squat','identity','https://pmc.ncbi.nlm.nih.gov/articles/PMC4725067/','The Back Squat Part 2: Targeted Training Techniques to Correct Functional Deficits and Technical Factors that Limit Performance','Strength and Conditioning Journal','peer_reviewed_research',84,'["The strength-and-conditioning review uses the side lunge as a frontal-plane exercise and mobility option while keeping the non-lunging leg straight.","The Cossack squat is treated here as a wide-stance lateral squat identity. Depth, hold, tempo, reach, support, and implement remain variants only while the same working-side squat and contralateral long-leg action remain primary."]'::JSONB),
    ('cossack-squat','taxonomy','https://pubmed.ncbi.nlm.nih.gov/41886869/','Biomechanical comparison of lower limb kinetics and kinematics between lateral lunge and walking and implications for rehabilitation in the healthy','Rehabilitacion','peer_reviewed_research',80,'["A lateral lunge produces frontal-plane knee and hip demands and larger hip and knee angles than normal walking in the studied healthy sample.","Classify {{canonicalName}} by working side, range, support, cadence, terminal hold, reach direction, exact implement, load position, and side order rather than by an athlete or class level."]'::JSONB),
    ('cossack-squat','anatomy','https://pmc.ncbi.nlm.nih.gov/articles/PMC3463242/','Biomechanical Attributes of Lunging Activities for Older Adults','Journal of Strength and Conditioning Research','peer_reviewed_research',82,'["In the studied older adults, lateral lunging produced substantial ankle plantar-flexor demand and greater ankle dorsiflexion measures than forward lunging, while hip and knee demand distributions differed by direction.","Represent the ankle plantar flexors, quadriceps, gluteals, adductors, hip stabilizers, foot, knee, hip, pelvis, and trunk without claiming one universal prime mover for every range and loaded variant."]'::JSONB),
    ('cossack-squat','biomechanics','https://pubmed.ncbi.nlm.nih.gov/41886869/','Biomechanical comparison of lower limb kinetics and kinematics between lateral lunge and walking and implications for rehabilitation in the healthy','Rehabilitacion','peer_reviewed_research',80,'["The studied lateral lunge produced higher lateral knee force, knee abduction moment, hip external-rotation moment, and larger hip and knee angles than walking.","These findings support explicit frontal-plane force-control and range constraints, but the study does not establish an ideal Cossack depth, stance width, foot angle, or cue."]'::JSONB),
    ('cossack-squat','difficulty','https://pubmed.ncbi.nlm.nih.gov/41886869/','Biomechanical comparison of lower limb kinetics and kinematics between lateral lunge and walking and implications for rehabilitation in the healthy','Rehabilitacion','peer_reviewed_research',80,'["Lateral lunging materially changes lower-limb joint moments, forces, and angles relative to walking, so a low-complexity mobility label alone understates the task.","Assess exercise complexity and physical difficulty independently for every exact Cossack variant. Derive overall difficulty as their maximum; coordination, supervision, impact, fatigue, and failure consequence remain separate planning dimensions and no athlete skill level is assigned."]'::JSONB),
    ('cossack-squat','load_fatigue_recovery','https://pmc.ncbi.nlm.nih.gov/articles/PMC3463242/','Biomechanical Attributes of Lunging Activities for Older Adults','Journal of Strength and Conditioning Research','peer_reviewed_research',82,'["The lateral lunge in the studied sample loaded lower-extremity joints asymmetrically and showed direction-specific ankle, knee, and hip mechanical demands.","Track range, external load and position, repetitions or hold time per side, foot contact, symptoms, technique loss, and overlap with other adductor, squat, lunge, and ankle work. Recovery guidance is a conservative programming inference, not a finding for this exact Cossack variant."]'::JSONB),
    ('cossack-squat','constraints','https://pmc.ncbi.nlm.nih.gov/articles/PMC4725067/','The Back Squat Part 2: Targeted Training Techniques to Correct Functional Deficits and Technical Factors that Limit Performance','Strength and Conditioning Journal','peer_reviewed_research',84,'["The reviewed side-lunge technique keeps the non-lunging leg straight and is selected to address hip adductor and internal-rotator mobility limitations.","Use only a pain-free range with stable foot contact and controlled knee, hip, pelvis, and trunk motion. Stable support may be added; a loaded variant requires an exact implement and secure setup."]'::JSONB),
    ('cossack-squat','dosage','https://pubmed.ncbi.nlm.nih.gov/26642915/','Acute effects of muscle stretching on physical performance, range of motion, and injury incidence in healthy active individuals: a systematic review','Applied Physiology, Nutrition, and Metabolism','peer_reviewed_research',90,'["Dynamic stretching in a warm-up can produce small performance and range-of-motion benefits, while protocols and immediate effects vary and long static durations can impair subsequent performance.","For access work, use a small number of controlled dynamic repetitions without fatigue. Holds and loaded strength variants require their own explicit dose and rest; no source validates one universal Cossack prescription."]'::JSONB),
    ('cossack-squat','instructions','https://pmc.ncbi.nlm.nih.gov/articles/PMC4725067/','The Back Squat Part 2: Targeted Training Techniques to Correct Functional Deficits and Technical Factors that Limit Performance','Strength and Conditioning Journal','peer_reviewed_research',84,'["The side-lunge review distinguishes the bending working leg from the straight non-lunging leg.","Instructions for {{canonicalName}} must name stance, working side, comfortable range, foot-contact rule, contralateral-leg expectation, return or transfer, side order, tempo or hold, support, and exact implement when loaded."]'::JSONB),
    ('cossack-squat','programming','https://pubmed.ncbi.nlm.nih.gov/26642915/','Acute effects of muscle stretching on physical performance, range of motion, and injury incidence in healthy active individuals: a systematic review','Applied Physiology, Nutrition, and Metabolism','peer_reviewed_research',90,'["Dynamic stretching is compatible with warm-up use when integrated with subsequent dynamic activity, but evidence does not establish automatic sport transfer or injury prevention from one exercise.","Use the low-amplitude or bodyweight Cossack only for an observed frontal-plane access or control need, and use loaded variants for strength only after repeatable bodyweight control. Do not promise structural correction, injury prevention, or universal performance transfer."]'::JSONB),
    ('cossack-squat','athlete_support','https://www.nsca.com/about-us/position-statements/youth-training-and-long-term-athletic-development/','Youth Training and Long-Term Athletic Development','National Strength and Conditioning Association','professional_standard',82,'["Long-term development should account for individual readiness, movement competence, psychosocial needs, and progressive exposure.","Athlete support should show both sides, the working leg, acceptable range, foot contact, exact variant and implement, a successful repetition, a supported option, and the pain or balance stop signal in plain language."]'::JSONB),
    ('cossack-squat','coach_support','https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf','Youth Resistance Training: Updated Position Statement Paper From the NSCA','National Strength and Conditioning Association','professional_standard',88,'["Qualified instruction, supervision, appropriate progression, and safe equipment are central to resistance training.","Coach support should include stance and range setup, front and side observation points, left-right comparison, exact implement and anchor checks, dose logging, quality gates, and explicit quarantine alerts for unresolved reach and load variants."]'::JSONB),
    ('cossack-squat','alternates','https://pmc.ncbi.nlm.nih.gov/articles/PMC4725067/','The Back Squat Part 2: Targeted Training Techniques to Correct Functional Deficits and Technical Factors that Limit Performance','Strength and Conditioning Journal','peer_reviewed_research',84,'["The reviewed side lunge preserves a bending working leg and straight non-lunging leg but does not establish every named Cossack variation as a separate exercise.","Classify support, range, hold, tempo, reach, pry, terminal pause, and exact implement as variants when the wide-stance lateral squat action remains primary. A stepping lateral lunge and a release/reception wall-ball task remain separate definitions."]'::JSONB),
    ('cossack-shift-to-wall-ball-toss','identity','https://www.acefitness.org/resources/everyone/exercise-library/178/overhead-medicine-ball-throws/','Overhead Medicine Ball Throws','American Council on Exercise','expert_instruction',74,'["ACE distinguishes a medicine-ball throw by start position, target, ball path, release, and optional wall rebound and catch.","{{canonicalName}} therefore remains distinct from a bodyweight Cossack squat, but its exact throw and reception protocol must be defined before the identity is production-usable."]'::JSONB),
    ('cossack-shift-to-wall-ball-toss','taxonomy','https://www.acefitness.org/continuing-education/certified/june-2019/7306/medicine-balls-an-ace-integrated-fitness-training-reg-model-workout/','Medicine Balls: An ACE Integrated Fitness Training Model Workout','American Council on Exercise','expert_instruction',78,'["Medicine-ball tasks differ by ball type, body position, throw direction, partner or wall target, catch behavior, and intended rhythm or power.","Classify {{canonicalName}} by shift side and depth, return-to-center rule, ball mass and rebound behavior, throw direction, target, release, reception or retrieval, side order, and reset."]'::JSONB),
    ('cossack-shift-to-wall-ball-toss','anatomy','https://www.acefitness.org/resources/everyone/exercise-library/178/overhead-medicine-ball-throws/','Overhead Medicine Ball Throws','American Council on Exercise','expert_instruction',74,'["The described overhead medicine-ball throw integrates lower-body extension, trunk bracing and force transfer, shoulder motion, elbow extension, and hand release.","The exact upper-body emphasis for this card cannot be finalized until throw direction is resolved; record lower-body lateral shift demands separately from the provisional throw and catch demands."]'::JSONB),
    ('cossack-shift-to-wall-ball-toss','biomechanics','https://pubmed.ncbi.nlm.nih.gov/41886869/','Biomechanical comparison of lower limb kinetics and kinematics between lateral lunge and walking and implications for rehabilitation in the healthy','Rehabilitacion','peer_reviewed_research',80,'["A lateral lunge creates meaningful frontal-plane knee and hip demands, while a ballistic throw adds a separate whole-body force-transfer and external-object task.","Require controlled lateral force acceptance and return to center before release; the exact trunk, shoulder, and ball path cannot be specified from the historical card."]'::JSONB),
    ('cossack-shift-to-wall-ball-toss','difficulty','https://www.acefitness.org/resources/everyone/exercise-library/178/overhead-medicine-ball-throws/','Overhead Medicine Ball Throws','American Council on Exercise','expert_instruction',74,'["A medicine-ball wall throw requires target awareness, ball-mass familiarity, ballistic force transfer, and potentially rapid rebound reception.","Assess exercise complexity and physical difficulty from the exact combined task and derive overall as their maximum. Do not copy an audience or experience label from an external exercise library onto the exercise card."]'::JSONB),
    ('cossack-shift-to-wall-ball-toss','load_fatigue_recovery','https://www.acefitness.org/continuing-education/certified/june-2019/7306/medicine-balls-an-ace-integrated-fitness-training-reg-model-workout/','Medicine Balls: An ACE Integrated Fitness Training Model Workout','American Council on Exercise','expert_instruction',78,'["ACE medicine-ball guidance emphasizes rhythmic movement quality, appropriate ball choice, and fatigue control for wall-ball tasks.","Track ball mass and rebound type, throw direction, target, throws per side, velocity or intent, target accuracy, catches or retrievals, fumbles, technique loss, and overlap with other power, shoulder, trunk, squat, and adductor work."]'::JSONB),
    ('cossack-shift-to-wall-ball-toss','constraints','https://www.acefitness.org/resources/everyone/exercise-library/178/overhead-medicine-ball-throws/','Overhead Medicine Ball Throws','American Council on Exercise','expert_instruction',74,'["ACE instructs familiarizing a receiver with the ball, aiming at a known target, and using a rebounding medicine ball when repeated wall throws and catches are intended.","Require a structurally suitable wall, known ball mass and rebound behavior, visible target, clear rebound lane, stable surface, and an explicit catch-versus-retrieve rule."]'::JSONB),
    ('cossack-shift-to-wall-ball-toss','dosage','https://www.acefitness.org/resources/everyone/exercise-library/178/overhead-medicine-ball-throws/','Overhead Medicine Ball Throws','American Council on Exercise','expert_instruction',74,'["ACE recommends a ball light enough to preserve throw velocity and describes repeated wall throws only with a ball capable of predictable rebound and catch.","Use low repetitions and full quality-preserving recovery for power intent. The exact dose remains provisional until the composite protocol and ball are defined."]'::JSONB),
    ('cossack-shift-to-wall-ball-toss','instructions','https://www.acefitness.org/resources/everyone/exercise-library/178/overhead-medicine-ball-throws/','Overhead Medicine Ball Throws','American Council on Exercise','expert_instruction',74,'["The ACE throw specifies stance, brace, target focus, lower-to-upper force transfer, release, and a separate repeated-wall-throw variation with rebound catch.","Instructions for {{canonicalName}} must name the lateral shift, center recovery, exact throw path, target, release, rebound or no-rebound expectation, catch or retrieval, side order, and reset."]'::JSONB),
    ('cossack-shift-to-wall-ball-toss','programming','https://www.acefitness.org/continuing-education/certified/june-2019/7306/medicine-balls-an-ace-integrated-fitness-training-reg-model-workout/','Medicine Balls: An ACE Integrated Fitness Training Model Workout','American Council on Exercise','expert_instruction',78,'["Medicine-ball programming can develop integrated movement and power, but task quality and fatigue control remain central.","Use this composite only when its exact lateral-to-center force-transfer and throw task serves the session objective. Separate the Cossack shift and stationary throw when combined quality or logistics are not established."]'::JSONB),
    ('cossack-shift-to-wall-ball-toss','athlete_support','https://www.acefitness.org/resources/everyone/exercise-library/178/overhead-medicine-ball-throws/','Overhead Medicine Ball Throws','American Council on Exercise','expert_instruction',74,'["A safe throw requires a visible target and prior familiarity with ball mass and reception expectations.","Athlete support should show side, depth, throw direction, target height, ball mass and rebound badge, catch versus retrieve rule, lane status, a successful repetition, and the stop signal."]'::JSONB),
    ('cossack-shift-to-wall-ball-toss','coach_support','https://www.acefitness.org/continuing-education/certified/june-2019/7306/medicine-balls-an-ace-integrated-fitness-training-reg-model-workout/','Medicine Balls: An ACE Integrated Fitness Training Model Workout','American Council on Exercise','expert_instruction',78,'["Wall-ball coaching requires appropriate equipment, space, rhythmic quality, and fatigue management.","Coach support should require protocol completion, wall and ball compatibility, lane control, target and catch setup, front and side observation, accuracy and reception logging, and a hard publication block while identity remains unresolved."]'::JSONB),
    ('cossack-shift-to-wall-ball-toss','alternates','https://www.acefitness.org/resources/everyone/exercise-library/178/overhead-medicine-ball-throws/','Overhead Medicine Ball Throws','American Council on Exercise','expert_instruction',74,'["Throw direction, stance, target, wall versus partner, rebound, and reception materially change medicine-ball delivery and safety.","Retain throw-direction and catch rules as controlled variants only after the same lateral-shift-to-center composite is defined. A stationary wall toss, partner toss, or stepping lateral lunge to toss is a separate definition."]'::JSONB),
    ('*','safety_stop_rules','https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf','Youth Resistance Training: Updated Position Statement Paper From the NSCA','National Strength and Conditioning Association','professional_standard',88,'["Exercise selection and progression require qualified supervision, technically appropriate loading, safe equipment and space, and individual readiness.","Stop {{canonicalName}} for sharp or increasing pain, guarding, loss of balance, a slipping foot or implement, forced range, repeated loss of alignment, unsafe ball rebound or lane traffic, or a material decline in the assigned movement quality."]'::JSONB),
    ('*','accessibility','https://www.nsca.com/about-us/position-statements/youth-training-and-long-term-athletic-development/','Youth Training and Long-Term Athletic Development','National Strength and Conditioning Association','professional_standard',82,'["Training should be individualized and progressed from the participant''s current physical, psychosocial, and training readiness rather than from a level attached to an exercise card.","Make {{canonicalName}} accessible with a shallower range, wider or narrower stance selected for control, stable hand support, reduced external load, slower rehearsal, visible side and target cues, longer reset, and a simpler prerequisite task. Record exercise complexity and physical difficulty; do not label the exercise itself beginner, intermediate, or advanced."]'::JSONB),
    ('*','media','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en','Embed videos and playlists','YouTube Help','manufacturer_instruction',82,'["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","The supplied links are discovery candidates only. Link and oEmbed availability may be checked automatically, but exact sequence, variant match, safety, cue quality, captions, accessibility, full content, reviewer identity, and approval require human review."]'::JSONB);

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
  JOIN cossack_evidence_seed evidence
    ON evidence.slug IN ('*', definition.slug)
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

  CREATE TEMP TABLE cossack_relationship_seed (
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

  INSERT INTO cossack_relationship_seed VALUES
    ('cossack-squat','low-amplitude-shift','cossack-squat','baseline','progression',90,'The baseline adds owned range while preserving the fixed wide stance, lateral squat action, side dose, and controlled transfer.','{"changedAttributes":["range"],"condition":"increase_only_with_pain_free_foot_knee_hip_and_trunk_control","humanReviewRequired":true}'::JSONB),
    ('cossack-squat','baseline','cossack-squat','low-amplitude-shift','regression',90,'The low-amplitude shift reduces range and relative loading while preserving the same lateral squat identity.','{"changedAttributes":["range"],"condition":"use_shallower_owned_range_without_forcing_stance","humanReviewRequired":true}'::JSONB),
    ('cossack-squat','baseline','cossack-squat','bottom-hold','progression',82,'The bottom hold adds declared isometric duration and end-range force tolerance.','{"changedAttributes":["range","isometric_duration","local_fatigue"],"condition":"progress_after_repeatable_baseline_range","humanReviewRequired":true}'::JSONB),
    ('cossack-squat','bottom-hold','cossack-squat','baseline','regression',82,'The baseline removes the required isometric duration while retaining the lateral squat action.','{"changedAttributes":["isometric_duration","local_fatigue"],"condition":"objective_accepts_dynamic_repetitions","humanReviewRequired":true}'::JSONB),
    ('cossack-squat','baseline','cossack-squat','slow-eccentric-shift','progression',84,'The slow-eccentric variant adds controlled time under tension and transition duration.','{"changedAttributes":["tempo","eccentric_exposure","fatigue"],"condition":"progress_after_repeatable_baseline_control","humanReviewRequired":true}'::JSONB),
    ('cossack-squat','slow-eccentric-shift','cossack-squat','baseline','regression',84,'The baseline removes the slow-tempo requirement while retaining range and side-transfer identity.','{"changedAttributes":["tempo","eccentric_exposure","fatigue"],"condition":"objective_accepts_standard_controlled_tempo","humanReviewRequired":true}'::JSONB),
    ('cossack-squat','baseline','cossack-squat','thoracic-rotation-reach','lateral_substitution',76,'A declared thoracic reach adds an upper-body mobility and coordination overlay without changing the primary lateral squat.','{"changedAttributes":["reach","thoracic_rotation","coordination"],"condition":"objective_accepts_declared_reach_and_pain_free_rotation","humanReviewRequired":true}'::JSONB),
    ('cossack-squat','thoracic-rotation-reach','cossack-squat','baseline','lateral_substitution',76,'Removing the reach returns to the base lateral squat while changing the mobility and coordination objective.','{"changedAttributes":["reach","thoracic_rotation","coordination"],"condition":"objective_accepts_no_reach_overlay","humanReviewRequired":true}'::JSONB),
    ('cossack-squat','baseline','cossack-squat','kettlebell-loaded','progression',78,'A declared kettlebell and load position add external resistance, grip, bracing, pickup, and set-down demands.','{"changedAttributes":["implement","load_position","external_load","grip","logistics"],"condition":"progress_after_bodyweight_control_and_exact_load_review","humanReviewRequired":true}'::JSONB),
    ('cossack-squat','kettlebell-loaded','cossack-squat','baseline','regression',78,'The bodyweight baseline removes external load, grip, pickup, and set-down demands.','{"changedAttributes":["implement","load_position","external_load","grip","logistics"],"condition":"objective_accepts_bodyweight_control","humanReviewRequired":true}'::JSONB),
    ('cossack-squat','baseline','cossack-squat','landmine-loaded','progression',72,'The landmine adds anchored diagonal resistance, rack, bar-path, anchor, clearance, and load-handling demands.','{"changedAttributes":["implement","force_path","rack","external_load","anchor","clearance"],"condition":"progress_after_bodyweight_control_and_landmine_setup_review","humanReviewRequired":true}'::JSONB),
    ('cossack-squat','landmine-loaded','cossack-squat','baseline','regression',72,'The bodyweight baseline removes the fixed pivot, rack, bar path, and anchor logistics.','{"changedAttributes":["implement","force_path","rack","external_load","anchor","clearance"],"condition":"objective_accepts_bodyweight_control","humanReviewRequired":true}'::JSONB),
    ('cossack-squat','baseline','cossack-squat','sandbag-loaded','progression',74,'The sandbag adds a declared deformable load position, grip, bracing, pickup, and set-down demand.','{"changedAttributes":["implement","load_position","external_load","grip","logistics"],"condition":"progress_after_bodyweight_control_and_exact_sandbag_setup_review","humanReviewRequired":true}'::JSONB),
    ('cossack-squat','sandbag-loaded','cossack-squat','baseline','regression',74,'The bodyweight baseline removes the deformable load, grip, pickup, and set-down demands.','{"changedAttributes":["implement","load_position","external_load","grip","logistics"],"condition":"objective_accepts_bodyweight_control","humanReviewRequired":true}'::JSONB),
    ('cossack-squat','baseline','cossack-shift-to-wall-ball-toss','unresolved-throw-protocol','progression',40,'The composite would add return-to-center timing, ball mass, aimed release, target, rebound, reception or retrieval, lane, and reset, but no progression is usable until the identity protocol is approved.','{"changedAttributes":["external_object","release","target","rebound","reception","lane","reset"],"condition":"blocked_until_wall_toss_identity_protocol_is_approved","humanReviewRequired":true}'::JSONB),
    ('cossack-shift-to-wall-ball-toss','unresolved-throw-protocol','cossack-squat','baseline','regression',40,'The bodyweight Cossack removes every unresolved ball-release and reception component and preserves only the lateral squat action.','{"changedAttributes":["external_object","release","target","rebound","reception","lane","reset"],"condition":"use_only_when_session_objective_accepts_no_throw","humanReviewRequired":true}'::JSONB);

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
    ARRAY['complexity','load','range','support','action_sequence']::TEXT[],
    seed.reason,
    seed.conditions,
    'review',
    NULL,
    NULL,
    NULL
  FROM cossack_relationship_seed seed
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
        THEN 'Candidate exercise-complexity score reflects stance, range, side transfer, support, tempo, hold, reach, implement or ball action, and control; human anchor review is pending.'
      WHEN 'absoluteLoadDemand'
        THEN 'Candidate physical-difficulty score reflects bodyweight range, external load, isometric or eccentric exposure, adductor and lower-body force, grip, and repeatable quality; human anchor review is pending.'
      ELSE 'Overall is deterministically derived as the maximum of exercise complexity and physical difficulty; human calibration approval is pending.'
    END,
    'review',
    1,
    NULL,
    NULL,
    'Research proposal only; compare against approved facility anchors after every identity requirement is resolved.',
    NULL
  FROM cossack_variant_seed seed
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id = 1
   AND definition.slug = seed.slug
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id = definition.id
   AND variant.variant_key = seed.variant_key
  CROSS JOIN LATERAL (
    VALUES
      ('technicalComplexity', seed.complexity),
      ('absoluteLoadDemand', seed.physical),
      ('baseOverallDifficulty', greatest(seed.complexity, seed.physical))
  ) AS calibration(dimension, score)
  WHERE calibration.score IS NOT NULL
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

  CREATE TEMP TABLE cossack_media_seed (
    slug TEXT NOT NULL,
    video_id TEXT NOT NULL,
    title TEXT NOT NULL,
    channel_name TEXT,
    source_query TEXT NOT NULL,
    notes TEXT NOT NULL,
    PRIMARY KEY (slug, video_id)
  ) ON COMMIT DROP;

  INSERT INTO cossack_media_seed VALUES
    ('cossack-squat','tpczTeSkHz0','How to Cossack Squat Mobility Exercise: Tutorial & Progressions','FitnessFAQs','YouTube visible search result: Cossack squat exercise tutorial','Candidate by visible title and channel only. Exact baseline sequence, safety, cue quality, captions, and full content require human review.'),
    ('cossack-squat','iPZNB5GsOnM','Cossack Squat Movement Demo','The Active Life','YouTube visible search result: Cossack squat movement demo','Candidate by visible title and channel only. Exact range, side order, and demonstration quality require human review.'),
    ('cossack-squat','nLNqEQ4B6XI','Cossack Squat | Hip Mobilization Exercise','Dr. Carl Baird','YouTube visible search result: Cossack squat hip mobilization','Candidate by visible title and channel only. Clinical claims, exact variant, and full demonstration require human review.'),
    ('cossack-squat','Zi_x6s6YXHo','Cossack Squat Tutorial for Beginners and Athletes','Mike | J2FIT Strength & Conditioning','YouTube visible search result: Cossack squat tutorial','Candidate title contains an audience label; that label is not exercise-card metadata. Exact content, variant match, and quality require human review.'),
    ('cossack-squat','usfu415_0AI','Assisted Cossack Squat','OPEX Fitness','YouTube visible search result: assisted Cossack squat','Regression candidate by visible title and channel only. Support setup, safety, exact sequence, and full content require human review.'),
    ('cossack-shift-to-wall-ball-toss','ZHp6dQyNTnA','Medicine Ball Lateral Wall Ball Toss','STRONG ATHLETE','YouTube visible search result: lateral lunge medicine ball wall toss','Adjacent lateral wall-toss component only; not asserted to include a Cossack shift or the exact unresolved sequence.'),
    ('cossack-shift-to-wall-ball-toss','WpsIRIJGW5o','Activ8 | Med Ball Lateral Lunge to Side Toss','Activ8','YouTube visible search result: lateral lunge medicine ball wall toss','Adjacent lateral-lunge-to-side-toss sequence; not asserted to match the fixed-stance Cossack shift, target, or reception protocol.'),
    ('cossack-shift-to-wall-ball-toss','G5C_rmEPVJU','Side lunge/step with Med Ball underhand toss','happilyforeverfit','YouTube visible search result: lateral lunge medicine ball wall toss','Adjacent underhand-toss component only; not asserted to match the Cossack shift, wall target, or reception protocol.'),
    ('cossack-shift-to-wall-ball-toss','OagZ48JldgQ','Lateral lunge w/ med ball throw','Villanova Sports Performance Training','YouTube visible search result: lateral lunge medicine ball wall toss','Adjacent lateral-lunge throw component only; exact target, ball path, rebound, and Cossack sequence require human review.'),
    ('cossack-shift-to-wall-ball-toss','vQ45G3IXYKs','GoFit Wall Ball #3—Squat w/ Overhead Wall Toss','GoFit Fitness','YouTube visible search result: Cossack shift wall ball toss','Adjacent squat-to-overhead-wall-toss component only; not asserted to show the lateral Cossack shift or exact unresolved protocol.');

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
  FROM cossack_media_seed media
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id = 1
   AND definition.slug = media.slug
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
    notes = EXCLUDED.notes,
    updated_at = now();

  CREATE TEMP TABLE cossack_alternate_seed (
    slug TEXT NOT NULL,
    alternate_name TEXT NOT NULL,
    classification TEXT NOT NULL,
    rationale TEXT NOT NULL,
    dimensions JSONB NOT NULL,
    proposed_card JSONB,
    PRIMARY KEY (slug, alternate_name)
  ) ON COMMIT DROP;

  INSERT INTO cossack_alternate_seed VALUES
    ('cossack-squat','Cossack Bottom Hold','new_variant','Depth and isometric duration change the dose and physical demand while preserving the same Cossack squat bottom position.','{"rangeOfMotion":"deep_self_selected","tempo":"isometric_hold"}'::JSONB,NULL),
    ('cossack-squat','Cossack Bottom Hold / Cossack Shift Hold','same_identity','This is duplicate source wording for the selectable bottom-hold variant; the shift describes entry into the same terminal position.','{"sourceContext":"entry_wording_only","selectableVariant":false}'::JSONB,NULL),
    ('cossack-squat','Cossack Shift with Reach','new_variant','An upper-body reach is a controlled overlay on the same lateral squat action, but this source remains quarantined until reach direction is defined.','{"armTask":"reach_direction_unresolved","identityQuarantine":true}'::JSONB,NULL),
    ('cossack-squat','Cossack Shift with T-Spine Reach','new_variant','Specified thoracic rotation adds a multiplanar reach overlay while preserving the primary Cossack squat.','{"armTask":"thoracic_rotation_reach"}'::JSONB,NULL),
    ('cossack-squat','Cossack Shift — Low Amplitude','new_variant','Shallower range changes accessibility and physical demand without changing the movement identity.','{"rangeOfMotion":"low_amplitude"}'::JSONB,NULL),
    ('cossack-squat','Cossack Squat Pry','new_variant','Small controlled bottom-position motion is a mobility overlay on the same Cossack squat position.','{"bottomPositionMovement":"controlled_pry"}'::JSONB,NULL),
    ('cossack-squat','Cossack Squat Shift to Stick','new_variant','A declared terminal hold adds a quality gate and balance demand but preserves the same lateral squat transfer.','{"terminalOutcome":"stick_without_extra_contact"}'::JSONB,NULL),
    ('cossack-squat','Kettlebell Cossack Squat','new_variant','A kettlebell changes implement, load position, and physical demand while preserving the same squat identity.','{"implement":"kettlebell"}'::JSONB,NULL),
    ('cossack-squat','Landmine Cossack Squat','new_variant','Angled landmine resistance and anchor logistics are exact implement requirements within the same squat identity.','{"implement":"landmine"}'::JSONB,NULL),
    ('cossack-squat','Loaded Cossack Squat','new_variant','External load is a variant dimension, but this historical source cannot be selected or scored reliably until implement and load position are specified.','{"implement":"unresolved","identityQuarantine":true}'::JSONB,NULL),
    ('cossack-squat','Sandbag Cossack Squat','new_variant','A sandbag changes implement, load position, and physical demand while preserving the same squat identity.','{"implement":"sandbag"}'::JSONB,NULL),
    ('cossack-squat','Slow Cossack Squat Shift','new_variant','Slow cadence and eccentric emphasis change dose and fatigue without changing the primary movement.','{"tempo":"slow_eccentric_and_transition"}'::JSONB,NULL),
    ('cossack-squat','Assisted Cossack Squat','new_variant','Stable hand support reduces balance and active-range demand while preserving the same working-side squat action.','{"supportLevel":"stable_hand_support"}'::JSONB,NULL),
    ('cossack-squat','Lateral Lunge','new_definition','A conventional lateral lunge steps out and returns, changing the start position, gait transition, and force-acceptance task from the fixed wide-stance Cossack squat.','{"movementPattern":"step_out_lateral_lunge"}'::JSONB,NULL),
    ('cossack-squat','Cossack Shift to Wall Ball Toss','new_definition','Ball release, target interaction, rebound, and reception create a distinct composite task even though it begins with a Cossack-like shift.','{"movementPattern":"lateral_squat_shift_to_external_object_release_and_reception"}'::JSONB,NULL),
    ('cossack-shift-to-wall-ball-toss','Bodyweight Cossack Shift','new_definition','Removing ball release, target interaction, rebound, and reception leaves the separate Cossack squat identity.','{"primaryTrainingStimulus":"frontal_plane_squat_access_and_control_without_external_object_release"}'::JSONB,NULL),
    ('cossack-shift-to-wall-ball-toss','Lateral Lunge to Side Wall Toss','new_definition','A step-out lateral lunge changes the start position and force-acceptance sequence from the fixed wide-stance Cossack shift.','{"movementPattern":"step_out_lateral_lunge_to_throw"}'::JSONB,NULL),
    ('cossack-shift-to-wall-ball-toss','Cossack Shift to Underhand Wall Toss','new_variant','Once the base composite is resolved, an underhand path is an exact throw-trajectory variant with its own target and reception rules.','{"throwTrajectory":"underhand"}'::JSONB,NULL),
    ('cossack-shift-to-wall-ball-toss','Cossack Shift to Overhead Wall Toss','new_variant','Once the base composite is resolved, an overhead path is an exact throw-trajectory variant with different shoulder, trunk, target, and rebound demands.','{"throwTrajectory":"overhead"}'::JSONB,NULL),
    ('cossack-shift-to-wall-ball-toss','Cossack Shift to No-Catch Dead-Ball Toss','new_variant','A low-rebound ball and no-catch rule preserve the lateral-shift-to-wall-release composite while changing ball behavior, retrieval, and safety constraints.','{"ballBehavior":"low_rebound","reception":"no_catch_retrieve_after_settle"}'::JSONB,NULL),
    ('cossack-shift-to-wall-ball-toss','Cossack Shift to Partner Toss','new_definition','Replacing the wall target with a partner changes the receiver, aiming task, return path, timing, and interpersonal safety requirements.','{"movementPattern":"lateral_shift_to_partner_throw_and_return"}'::JSONB,NULL),
    ('cossack-shift-to-wall-ball-toss','Standing Lateral Wall Toss','new_definition','Removing the Cossack shift changes the primary lower-body sequence and produces a stationary lateral throw identity.','{"movementPattern":"stationary_lateral_wall_throw"}'::JSONB,NULL);

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
  FROM cossack_alternate_seed alternate
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id = 1
   AND definition.slug = alternate.slug
   AND definition.status <> 'archived'
  ON CONFLICT (definition_id, reviewed_card_version, alternate_name)
  DO UPDATE SET
    classification = EXCLUDED.classification,
    rationale = EXCLUDED.rationale,
    distinguishing_dimensions = EXCLUDED.distinguishing_dimensions,
    proposed_card_json = EXCLUDED.proposed_card_json,
    review_status = 'candidate',
    reviewer_user_id = NULL,
    reviewed_at = NULL,
    updated_at = now();

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
      'selectableIdentityResolved',
        definition.slug = 'cossack-squat',
      'controlledTaxonomyPresent',TRUE,
      'anatomyJointsActionsPlanesLateralityPresent',TRUE,
      'difficultyFormulaValid',NOT EXISTS (
        SELECT 1
        FROM coaching.exercise_variant_v1 variant
        WHERE variant.definition_id = definition.id
          AND variant.status = 'review'
          AND (
            (
              variant.difficulty_json ? 'technicalComplexity'
              AND variant.difficulty_json ? 'absoluteLoadDemand'
              AND (
                NOT (variant.difficulty_json ? 'baseOverallDifficulty')
                OR (variant.difficulty_json->>'baseOverallDifficulty')::INTEGER
                  <> greatest(
                    (variant.difficulty_json->>'technicalComplexity')::INTEGER,
                    (variant.difficulty_json->>'absoluteLoadDemand')::INTEGER
                  )
              )
            )
            OR (
              (variant.difficulty_json ? 'technicalComplexity')
                <> (variant.difficulty_json ? 'absoluteLoadDemand')
            )
            OR (
              NOT (variant.difficulty_json ? 'technicalComplexity')
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
      'loadFatigueRecoveryPresent',(
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
      'deliveryProfilesPresent',(
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
            OR media.review_status <> 'candidate'
          )
      ),
      'alternateAssessmentsPresent',(
        SELECT count(*)
        FROM coaching.exercise_alternate_assessment_v1 alternate
        WHERE alternate.definition_id = definition.id
          AND alternate.reviewed_card_version = definition.card_version
          AND alternate.review_status = 'candidate'
      ) = CASE
        WHEN definition.slug = 'cossack-squat' THEN 15
        ELSE 7
      END,
      'relationshipsAreReviewOnly',NOT EXISTS (
        SELECT 1
        FROM coaching.exercise_variant_v1 variant
        JOIN coaching.exercise_relationship_v1 relationship
          ON relationship.from_variant_id = variant.id
          OR relationship.to_variant_id = variant.id
        WHERE variant.definition_id = definition.id
          AND relationship.review_status <> 'review'
      ),
      'calibrationsAreReviewOnly',NOT EXISTS (
        SELECT 1
        FROM coaching.exercise_variant_v1 variant
        JOIN coaching.exercise_score_calibration_v1 calibration
          ON calibration.variant_id = variant.id
        WHERE variant.definition_id = definition.id
          AND calibration.status <> 'review'
      ),
      'selectableExactVariantCount',(
        SELECT count(*)
        FROM coaching.exercise_variant_v1 variant
        WHERE variant.definition_id = definition.id
          AND variant.status = 'review'
          AND variant.requirements_json->>'selectable' = 'true'
      ),
      'deferredDifficultyCount',(
        SELECT count(*)
        FROM coaching.exercise_variant_v1 variant
        WHERE variant.definition_id = definition.id
          AND variant.status = 'review'
          AND variant.difficulty_json->>'scoreDeferred' = 'true'
      )
    ),
    jsonb_build_array(
      jsonb_build_object(
        'code','CARD-MEDIA-01',
        'message','Five public-search YouTube candidates require playback, oEmbed, exact-variant, safety, cue, caption, accessibility, quality, reviewer, and approval review.'
      ),
      jsonb_build_object(
        'code','CARD-PUBLISH-01',
        'message','No current two-person card or publication approval exists.'
      ),
      jsonb_build_object(
        'code','CARD-GRAPH-03',
        'message','Review-only progression, regression, and substitution relationships require human approval.'
      ),
      jsonb_build_object(
        'code','CARD-CALIBRATION-01',
        'message','Difficulty proposals require independent human anchor review.'
      )
    ) || CASE
      WHEN definition.slug = 'cossack-squat' THEN jsonb_build_array(
        jsonb_build_object(
          'code','CARD-IDENTITY-03',
          'message','The generic reach direction and generic loaded implement/load position remain nonselectable pending human identity review; the unspecified loaded variant has no fabricated difficulty score.'
        )
      )
      ELSE jsonb_build_array(
        jsonb_build_object(
          'code','CARD-IDENTITY-04',
          'message','Throw direction, target, ball path, rebound behavior, reception or retrieval, side order, reset, and lane remain unresolved; production selection and dose are blocked.'
        )
      )
    END,
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
        (
          variant.difficulty_json ? 'technicalComplexity'
          AND variant.difficulty_json ? 'absoluteLoadDemand'
          AND (
            NOT (variant.difficulty_json ? 'baseOverallDifficulty')
            OR (variant.difficulty_json->>'baseOverallDifficulty')::INTEGER
              <> greatest(
                (variant.difficulty_json->>'technicalComplexity')::INTEGER,
                (variant.difficulty_json->>'absoluteLoadDemand')::INTEGER
              )
          )
        )
        OR (
          (variant.difficulty_json ? 'technicalComplexity')
            <> (variant.difficulty_json ? 'absoluteLoadDemand')
        )
        OR (
          NOT (variant.difficulty_json ? 'technicalComplexity')
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
      )
  ) THEN
    RAISE EXCEPTION
      '% produced an invalid/deferred difficulty state or prohibited level classification',
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
      '% did not leave every target at unapproved review card version 2 without proficiency metadata',
      migration_key;
  END IF;

  IF (
    SELECT count(*)
    FROM cossack_variant_seed seed
    JOIN coaching.exercise_definition_v1 definition
      ON definition.facility_id = 1
     AND definition.slug = seed.slug
    JOIN coaching.exercise_variant_v1 variant
      ON variant.definition_id = definition.id
     AND variant.variant_key = seed.variant_key
     AND variant.status = 'review'
  ) <> 13 THEN
    RAISE EXCEPTION '% did not create all 13 exact review variants', migration_key;
  END IF;

  IF (
    SELECT count(*)
    FROM cossack_variant_seed seed
    JOIN coaching.exercise_definition_v1 definition
      ON definition.facility_id = 1
     AND definition.slug = seed.slug
    JOIN coaching.exercise_variant_v1 variant
      ON variant.definition_id = definition.id
     AND variant.variant_key = seed.variant_key
    JOIN coaching.exercise_delivery_profile_v1 profile
      ON profile.variant_id = variant.id
     AND profile.status = 'review'
  ) <> 23 THEN
    RAISE EXCEPTION '% did not create all 23 contextual or review-only profiles', migration_key;
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
  ) <> 32 THEN
    RAISE EXCEPTION '% did not create all 32 candidate evidence rows', migration_key;
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
      AND definition.slug = ANY(target_slugs)
  ) <> 10 THEN
    RAISE EXCEPTION '% did not create all 10 unverified, non-embeddable media candidates', migration_key;
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
  ) <> 22 THEN
    RAISE EXCEPTION '% did not create all 22 candidate alternate assessments', migration_key;
  END IF;

  IF (
    SELECT count(*)
    FROM cossack_relationship_seed seed
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
    RAISE EXCEPTION '% did not create all 16 review-only relationships', migration_key;
  END IF;

  IF (
    SELECT count(*)
    FROM cossack_variant_seed seed
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
       'absoluteLoadDemand',
       'baseOverallDifficulty'
     )
    WHERE seed.complexity IS NOT NULL
      AND seed.physical IS NOT NULL
  ) <> 36 THEN
    RAISE EXCEPTION '% did not create all 36 review-only calibration rows', migration_key;
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
  ) <> 2 THEN
    RAISE EXCEPTION '% did not create both quarantined card test packets', migration_key;
  END IF;

  IF (
    SELECT count(*)
    FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_variant_v1 variant
      ON variant.definition_id = definition.id
     AND variant.status = 'review'
     AND variant.requirements_json->>'selectable' = 'true'
    WHERE definition.facility_id = 1
      AND definition.slug = 'cossack-squat'
  ) <> 10 OR EXISTS (
    SELECT 1
    FROM coaching.exercise_definition_v1 definition
    JOIN coaching.exercise_variant_v1 variant
      ON variant.definition_id = definition.id
    WHERE definition.facility_id = 1
      AND definition.slug = 'cossack-shift-to-wall-ball-toss'
      AND variant.requirements_json->>'selectable' <> 'false'
  ) THEN
    RAISE EXCEPTION '% produced an invalid selectable-identity boundary', migration_key;
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
  ) OR EXISTS (
    SELECT 1
    FROM cossack_relationship_seed seed
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
    FROM cossack_variant_seed seed
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
    RAISE EXCEPTION '% created or retained an unsupported approval state', migration_key;
  END IF;

  SELECT count(DISTINCT source.legacy_exercise_id)
  INTO source_count
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_definition_source_v1 source
    ON source.definition_id = definition.id
  WHERE definition.facility_id = 1
    AND definition.slug = ANY(target_slugs)
    AND definition.status = 'review';

  IF source_count <> 14 THEN
    RAISE EXCEPTION '% lost one or more of the 14 legacy source mappings', migration_key;
  END IF;

  SELECT count(*)
  INTO consolidated_count
  FROM coaching.exercise_definition_v1 survivor
  JOIN coaching.exercise_identity_resolution_v1 resolution
    ON resolution.survivor_definition_id = survivor.id
   AND resolution.decision = 'duplicate_consolidated'
  JOIN coaching.exercise_definition_v1 duplicate
    ON duplicate.id = resolution.resolved_definition_id
   AND duplicate.status = 'archived'
  WHERE survivor.facility_id = 1
    AND survivor.slug = 'cossack-squat'
    AND survivor.status = 'review'
    AND duplicate.slug = ANY(ARRAY[
      'cossack-bottom-hold',
      'cossack-bottom-hold-cossack-shift-hold',
      'cossack-shift-with-reach',
      'cossack-shift-with-t-spine-reach',
      'cossack-shift',
      'cossack-squat-pry',
      'cossack-squat-shift-to-stick',
      'kettlebell-cossack-squat',
      'landmine-cossack-squat',
      'loaded-cossack-squat',
      'sandbag-cossack-squat-strength',
      'slow-cossack-squat-shift'
    ]::TEXT[]);

  IF consolidated_count <> 12 THEN
    RAISE EXCEPTION '% lost one or more migration-307 consolidations', migration_key;
  END IF;
END
$$;
