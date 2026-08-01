-- Complete the Landmine Front Squat, Landmine Hack Squat, re-authored
-- stationary Landmine Split Squat, and Landmine Reverse Lunge to Press
-- candidate cards.
--
-- Migration 369 consolidated the handle-grip split-squat source but left the
-- broader landmine identity in needs_human_review because the legacy copy
-- mixed stationary and stepping actions. This migration re-authors a
-- stationary candidate without approving or deleting that unresolved review.
--
-- Public-search YouTube URLs are stored as pending, non-embeddable candidates.
-- No playback, oEmbed, exact-match, caption, accessibility, quality, reviewer,
-- media, graph, calibration, card, or publication approval is claimed.
--
-- Exercise difficulty is exercise complexity plus physical difficulty, with
-- overall derived as their maximum. Athlete proficiency levels remain
-- exclusive to coaching.skill and are intentionally absent.
-- IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '402_coaching_landmine_squat_lunge_family_completion';
  research_batch CONSTANT TEXT := 'landmine-squat-lunge-family-v1';
  research_version CONSTANT TEXT := '2026-07-31.58';
  target_slugs CONSTANT TEXT[] := ARRAY[
    'landmine-front-squat',
    'landmine-hack-squat',
    'landmine-split-squat',
    'landmine-reverse-lunge-to-press'
  ]::TEXT[];
  target_legacy_ids CONSTANT BIGINT[] :=
    ARRAY[1418,1419,1420,1421,1453]::BIGINT[];
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

  IF active_count <> 4 THEN
    RAISE EXCEPTION
      '% expected exactly 4 active target definitions; found %',
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

  IF already_applied_count NOT IN (0, 4) THEN
    RAISE EXCEPTION
      '% found a partial prior application on % of 4 cards',
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

  IF source_count <> 5 THEN
    RAISE EXCEPTION
      '% expected all 5 legacy mappings on the active survivor set; found %',
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
      AND survivor.slug = 'landmine-split-squat'
      AND survivor.status <> 'archived'
      AND duplicate.slug = 'landmine-handle-grip-split-squat'
      AND duplicate.status = 'archived'
  ) THEN
    RAISE EXCEPTION
      '% requires the migration-369 handle-grip consolidation',
      migration_key;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM coaching.exercise_definition_v1 landmine
    JOIN coaching.exercise_definition_v1 general
      ON general.facility_id = landmine.facility_id
     AND general.slug = 'split-squat'
     AND general.status <> 'archived'
    JOIN coaching.exercise_identity_resolution_v1 resolution
      ON resolution.survivor_definition_id IN (landmine.id, general.id)
     AND resolution.resolved_definition_id IN (landmine.id, general.id)
     AND resolution.decision = 'needs_human_review'
    WHERE landmine.facility_id = 1
      AND landmine.slug = 'landmine-split-squat'
      AND landmine.status <> 'archived'
  ) THEN
    RAISE EXCEPTION
      '% requires the unresolved migration-369 split-squat review boundary',
      migration_key;
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
              'Superseded source variant lacks the exact orientation, rack, stance or step, support, action order, load, dose, fatigue, and stop-rule contract.'
          ),
        updated_at = now()
    FROM coaching.exercise_definition_v1 definition
    WHERE variant.definition_id = definition.id
      AND definition.facility_id = 1
      AND definition.slug = ANY(target_slugs);
  END IF;

  CREATE TEMP TABLE squat_lunge_card_seed (
    slug TEXT PRIMARY KEY,
    canonical_name TEXT NOT NULL,
    aliases TEXT[] NOT NULL,
    description TEXT NOT NULL,
    movement_patterns TEXT[] NOT NULL,
    body_regions TEXT[] NOT NULL,
    anatomy_json JSONB NOT NULL,
    athlete_support_json JSONB NOT NULL,
    coach_support_json JSONB NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO squat_lunge_card_seed VALUES
    (
      'landmine-front-squat',
      'Landmine Front Squat',
      ARRAY['Landmine Squat','Landmine Goblet Squat','Two-Hand Landmine Front Squat']::TEXT[],
      'Face the rated landmine pivot with the sleeve at a declared central chest rack. Keep a fixed bilateral stance and distance, descend to an owned depth, stand through the fixed diagonal arc, and return to the same rack under control.',
      ARRAY['squat','brace']::TEXT[],
      ARRAY['foot','ankle','knee','hip','pelvis','spine','core','shoulder','elbow','wrist','hand']::TEXT[],
      jsonb_build_object(
        'primaryMusclesAndTissues',
          jsonb_build_array('quadriceps','gluteus_maximus','adductor_magnus'),
        'secondaryMusclesAndTissues',
          jsonb_build_array('hamstrings','calf_complex','abdominal_wall_and_obliques','spinal_stabilizers','upper_back','forearm_and_hand_flexors'),
        'joints',
          jsonb_build_array('foot','ankle','knee','hip','pelvis','spine','shoulder','elbow','wrist','hand'),
        'actions',
          jsonb_build_array('establish_central_front_rack_and_distance','brace_and_descend','maintain_foot_and_knee_tracking','stand_through_fixed_arc','return_to_rack_and_set_down'),
        'planes',
          jsonb_build_array('sagittal_squat_with_oblique_external_force','frontal_and_transverse_stabilization'),
        'laterality','bilateral_lower_body_with_central_or_offset_front_rack'
      ),
      jsonb_build_object(
        'plainLanguageSummary','Hold the sleeve at your chest, squat between your feet, and stand through the bar path without losing the rack.',
        'setupChecklist',jsonb_build_array('confirm_anchor_collars_load_and_lane','set_rack_stance_distance_and_depth','brace_before_descending'),
        'cues',jsonb_build_array('whole_foot','knees_track','stay_connected_to_the_rack','drive_the_floor_away'),
        'accessibilityOptions',jsonb_build_array('unloaded_or_lighter_bar','reduced_owned_depth','stable_external_support','fewer_repetitions_and_longer_rest','written_audio_still_image_or_live_instruction')
      ),
      jsonb_build_object(
        'observationPriorities',jsonb_build_array('anchor_and_clearance','rack_stance_and_distance','foot_pressure_and_knee_tracking','pelvis_trunk_and_depth','ascent_path_and_return'),
        'qualityGate','Count only repetitions with secure equipment, the declared rack and stance, owned depth, whole-foot pressure, tracked knees, stable trunk, and controlled return.',
        'stopRules',jsonb_build_array('pain_neurologic_symptoms_or_dizziness','anchor_collar_or_plate_movement','foot_pressure_or_knee_tracking_loss','pelvic_shift_or_trunk_collapse','rack_or_grip_loss','grinding_or_uncontrolled_return')
      )
    ),
    (
      'landmine-hack-squat',
      'Landmine Hack Squat',
      ARRAY['Shoulder-Supported Landmine Hack Squat','Angled Landmine Hack Squat']::TEXT[],
      'Face away from the rated landmine pivot with the sleeve supported beside the declared upper trapezius or shoulder and the feet set forward. Descend to an owned depth, drive up and back through the fixed arc, and follow the planned rerack.',
      ARRAY['squat','brace']::TEXT[],
      ARRAY['foot','ankle','knee','hip','pelvis','spine','core','shoulder','elbow','wrist','hand']::TEXT[],
      jsonb_build_object(
        'primaryMusclesAndTissues',
          jsonb_build_array('quadriceps','gluteus_maximus','adductor_magnus'),
        'secondaryMusclesAndTissues',
          jsonb_build_array('hamstrings','calf_complex','abdominal_wall_and_obliques','spinal_stabilizers','upper_trapezius_and_shoulder_contact_tissues','forearm_and_hand_flexors'),
        'joints',
          jsonb_build_array('foot','ankle','knee','hip','pelvis','spine','shoulder','elbow','wrist','hand'),
        'actions',
          jsonb_build_array('transfer_sleeve_to_declared_shoulder','establish_forward_foot_position','brace_and_descend','maintain_foot_and_knee_tracking','drive_up_and_back','rerack_and_set_down'),
        'planes',
          jsonb_build_array('sagittal_squat_with_oblique_external_force','frontal_and_transverse_stabilization'),
        'laterality','bilateral_lower_body_with_declared_unilateral_shoulder_contact'
      ),
      jsonb_build_object(
        'plainLanguageSummary','Set the sleeve on the called shoulder, place your feet forward, squat while staying connected, and drive up and back.',
        'setupChecklist',jsonb_build_array('confirm_anchor_collars_load_and_lane','declare_shoulder_contact_foot_position_depth_and_rerack','confirm_assistance_if_needed'),
        'cues',jsonb_build_array('stay_connected','whole_foot','knees_track','drive_up_and_back'),
        'accessibilityOptions',jsonb_build_array('unloaded_or_lighter_bar','reviewed_contact_padding','reduced_owned_depth','assisted_transfer_and_rerack','fewer_repetitions_and_longer_rest','written_audio_still_image_or_live_instruction')
      ),
      jsonb_build_object(
        'observationPriorities',jsonb_build_array('anchor_and_clearance','sleeve_transfer_and_shoulder_contact','foot_position_and_depth','foot_knee_pelvis_and_trunk_control','ascent_and_rerack'),
        'qualityGate','Count only repetitions with stable sleeve contact, the declared foot position, owned depth, tracked knees, a controlled up-and-back ascent, and safe rerack.',
        'stopRules',jsonb_build_array('pain_neurologic_symptoms_or_dizziness','anchor_collar_or_plate_movement','sleeve_roll_or_contact_loss','foot_pressure_or_knee_tracking_loss','pelvic_shift_or_trunk_collapse','balance_loss_grinding_or_unsafe_rerack')
      )
    ),
    (
      'landmine-split-squat',
      'Landmine Split Squat',
      ARRAY['Landmine Handle-Grip Split Squat','Landmine Neutral-Handle Split Squat','Stationary Landmine Lunge']::TEXT[],
      'Use a declared fore-aft stance that stays fixed for the set and a declared sleeve or compatible-handle rack. Lower the rear knee under control and return to the same split stance without stepping, pushing off, or changing the lead leg.',
      ARRAY['lunge','squat','brace']::TEXT[],
      ARRAY['foot','ankle','knee','hip','pelvis','spine','core','shoulder','elbow','wrist','hand']::TEXT[],
      jsonb_build_object(
        'primaryMusclesAndTissues',
          jsonb_build_array('front_leg_quadriceps','front_leg_gluteus_maximus','adductor_magnus'),
        'secondaryMusclesAndTissues',
          jsonb_build_array('hamstrings','calf_complex','rear_leg_hip_flexors_and_stabilizers','gluteus_medius','abdominal_wall_and_obliques','spinal_stabilizers','forearm_and_hand_flexors'),
        'joints',
          jsonb_build_array('front_and_rear_foot','ankle','knee','hip','pelvis','spine','shoulder','elbow','wrist','hand'),
        'actions',
          jsonb_build_array('establish_declared_stationary_split_and_rack','brace_and_descend_rear_knee','maintain_front_foot_and_knee_tracking','stand_without_stepping','return_and_set_down'),
        'planes',
          jsonb_build_array('sagittal_split_squat','frontal_and_transverse_stabilization'),
        'laterality','unilateral_front_leg_emphasis_with_declared_rack_relationship',
        'identityReviewState','migration_369_needs_human_review_preserved'
      ),
      jsonb_build_object(
        'plainLanguageSummary','Set the called split stance and rack, keep both feet fixed, lower the rear knee, and stand back to the same stance.',
        'setupChecklist',jsonb_build_array('confirm_anchor_collars_load_handle_and_lane','declare_rack_lead_leg_arm_leg_relationship_and_stance','place_stance_markers'),
        'cues',jsonb_build_array('feet_stay_put','whole_front_foot','front_knee_tracks','level_pelvis'),
        'accessibilityOptions',jsonb_build_array('unloaded_or_lighter_bar','stable_external_support','reduced_owned_depth','shorter_owned_stance','fewer_repetitions_and_longer_rest','written_audio_still_image_or_live_instruction')
      ),
      jsonb_build_object(
        'observationPriorities',jsonb_build_array('anchor_handle_and_clearance','rack_lead_leg_and_stance','front_foot_and_knee_tracking','pelvis_trunk_and_depth','no_step_or_push_off','return_and_set_down'),
        'qualityGate','Count only repetitions with the declared fixed stance and rack, whole front-foot pressure, tracked knee, stable pelvis and trunk, and no step or push-off.',
        'stopRules',jsonb_build_array('pain_neurologic_symptoms_or_dizziness','anchor_collar_plate_or_handle_movement','stance_or_balance_loss','front_heel_or_knee_tracking_loss','pelvic_rotation_drop_or_trunk_collapse','push_off_step_or_uncontrolled_return')
      )
    ),
    (
      'landmine-reverse-lunge-to-press',
      'Landmine Reverse Lunge to Press',
      ARRAY['Landmine Reverse Lunge and Press','Single-Arm Landmine Reverse Lunge to Press']::TEXT[],
      'Begin from a bilateral stance and declared shoulder rack. Step the declared leg backward into a controlled reverse lunge, drive through the front leg to return toward standing while pressing through the fixed diagonal arc, then lower to the same rack and reset.',
      ARRAY['lunge','push','brace']::TEXT[],
      ARRAY['foot','ankle','knee','hip','pelvis','spine','core','rib_cage','shoulder','scapula','elbow','wrist','hand']::TEXT[],
      jsonb_build_object(
        'primaryMusclesAndTissues',
          jsonb_build_array('front_leg_quadriceps','front_leg_gluteus_maximus','anterior_deltoid','clavicular_pectoralis_major','triceps_brachii'),
        'secondaryMusclesAndTissues',
          jsonb_build_array('hamstrings','adductors','calf_complex','hip_stabilizers','serratus_anterior','trapezius','rotator_cuff','abdominal_wall_and_obliques','spinal_stabilizers','forearm_and_hand_flexors'),
        'joints',
          jsonb_build_array('foot','ankle','knee','hip','pelvis','spine','glenohumeral','scapulothoracic','acromioclavicular','elbow','wrist','hand'),
        'actions',
          jsonb_build_array('establish_bilateral_start_and_shoulder_rack','step_declared_leg_back','descend_under_control','drive_through_front_leg_and_return','press_through_landmine_arc','lower_to_same_rack_and_reset'),
        'planes',
          jsonb_build_array('sagittal_reverse_lunge_and_oblique_press','frontal_and_transverse_stabilization'),
        'laterality','unilateral_press_with_declared_step_back_and_front_leg_relationship'
      ),
      jsonb_build_object(
        'plainLanguageSummary','Step the called leg back under control, drive through the front foot, and carry that return into the angled press.',
        'setupChecklist',jsonb_build_array('confirm_anchor_collars_load_and_lane','declare_working_arm_step_back_leg_markers_and_side_sequence','brace_at_the_shoulder_rack'),
        'cues',jsonb_build_array('step_and_own_the_lunge','drive_the_front_foot','return_then_press_continuously','reset_square'),
        'accessibilityOptions',jsonb_build_array('unloaded_or_lighter_bar','shorter_owned_step_and_depth','separate_lunge_and_press_prerequisites','fewer_repetitions_and_longer_rest','written_audio_still_image_or_live_instruction')
      ),
      jsonb_build_object(
        'observationPriorities',jsonb_build_array('anchor_and_clearance','arm_leg_relationship_and_markers','step_and_front_leg_alignment','pelvis_and_trunk','return_to_press_timing','finish_lowering_and_reset'),
        'qualityGate','Count only repetitions with the declared step, controlled lunge, whole front-foot pressure, tracked knee, continuous drive-to-press timing, balanced finish, and controlled reset.',
        'stopRules',jsonb_build_array('pain_neurologic_symptoms_or_dizziness','anchor_collar_or_plate_movement','step_marker_or_balance_loss','front_heel_or_knee_tracking_loss','pelvic_rotation_or_trunk_collapse','disconnected_early_or_grinding_press','incomplete_return_or_uncontrolled_lowering')
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
      family_key = 'landmine_squat_lunge',
      schema_version = '1.0.0',
      card_version = CASE
        WHEN definition.provenance_json->>'structuralCompletionMigration'
          IS DISTINCT FROM migration_key
          THEN definition.card_version + 1
        ELSE definition.card_version
      END,
      status = 'review',
      content_confidence = CASE
        WHEN definition.slug = 'landmine-split-squat' THEN 74
        ELSE 82
      END,
      scoring_confidence = 72,
      media_confidence = 25,
      movement_patterns = seed.movement_patterns,
      body_regions = seed.body_regions,
      required_equipment = ARRAY['landmine','barbell']::TEXT[],
      optional_equipment = ARRAY['plates','floor_markers','compatible_handle','contact_padding']::TEXT[],
      anatomy_json = seed.anatomy_json,
      environment_json = jsonb_build_object(
        'surface','level_high_traction',
        'anchor','rated_fixed_landmine_pivot',
        'clearance',jsonb_build_array('full_bar_and_plate_arc','stance_or_step_zone','pickup_return_and_set_down_zone'),
        'athletesPerStation',1,
        'coachPosition','outside_moving_bar_and_plate_path'
      ),
      population_json = jsonb_build_object(
        'selectionStatus',CASE
          WHEN definition.slug = 'landmine-split-squat'
            THEN 'candidate_identity_reauthor_requires_human_review'
          ELSE 'candidate_requires_human_review'
        END,
        'readinessChecks',jsonb_build_array('pain_free_owned_lower_body_action','stable_declared_rack','foot_knee_pelvis_and_trunk_control','controlled_return_and_set_down'),
        'constraints',jsonb_build_array('depth_and_range_match_current_control','load_preserves_exact_action','unilateral_work_requires_side_balance'),
        'contraindications',jsonb_build_array('acute_pain_or_neurologic_symptoms','uncontrolled_balance_or_alignment','unsafe_anchor_or_clearance','cannot_execute_declared_action_order')
      ),
      athlete_support_json = seed.athlete_support_json,
      coach_support_json = seed.coach_support_json,
      support_operations_json = jsonb_build_object(
        'supportSummary','Count only repetitions that preserve the exact anchor, orientation, rack, attachment, stance or step, side relationship, depth, action order, path, return, and set-down.',
        'issueCategories',jsonb_build_array('identity_or_variant','difficulty_or_dose','equipment_or_environment','symptom_or_population_constraint','instruction_or_accessibility','media_exact_match','relationship','calibration'),
        'supportEscalation',jsonb_build_object(
          'urgent',jsonb_build_array('dropped_bar_or_plate','acute_injury','neurologic_or_cardiovascular_symptom'),
          'coachReview',jsonb_build_array('repeated_stance_step_alignment_or_action_fault','meaningful_side_difference','unclear_load_range_or_recovery'),
          'equipmentReview',jsonb_build_array('anchor_bar_collar_plate_handle_padding_or_floor_problem'),
          'contentReview',jsonb_build_array('identity_boundary_conflict','media_mismatch','missing_accessibility_or_stop_rule')
        ),
        'knownLimitations',jsonb_build_array('candidate_media_not_oembed_or_playback_verified','no_universal_load_range_dose_or_recovery','scores_edges_calibrations_and_cards_are_unapproved_proposals','landmine_split_squat_reauthor_requires_identity_review'),
        'changeImpactPolicy','Changes to orientation, rack, attachment, stance, step, foot elevation, side relationship, depth, action order, press timing, path, difficulty, dose, stop rule, relationship, or media require renewed affected reviews.'
      ),
      approved_video_url = NULL,
      reviewed_by = NULL,
      approved_by = NULL,
      last_reviewed_at = NULL,
      provenance_json = definition.provenance_json || jsonb_build_object(
        'structuralCompletionMigration',migration_key,
        'researchBatch',research_batch,
        'researchVersion',research_version,
        'evidenceState','candidate_requires_human_review',
        'mediaState','public_search_candidates_unverified_and_non_embeddable',
        'difficultyModel','max_exercise_complexity_physical_difficulty',
        'humanReviewRequired',TRUE,
        'publicationQuarantined',TRUE,
        'splitSquatIdentityReviewPreserved',
          definition.slug = 'landmine-split-squat',
        'mediaApprovalCreated',FALSE,
        'graphApprovalCreated',FALSE,
        'calibrationApprovalCreated',FALSE
      ),
      updated_at = now()
  FROM squat_lunge_card_seed seed
  WHERE definition.facility_id = 1
    AND definition.slug = seed.slug
    AND definition.status <> 'archived';

  CREATE TEMP TABLE squat_lunge_variant_seed (
    slug TEXT NOT NULL,
    variant_key TEXT NOT NULL,
    display_name TEXT NOT NULL,
    action_identity TEXT NOT NULL,
    rack TEXT NOT NULL,
    stance_or_step TEXT NOT NULL,
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

  INSERT INTO squat_lunge_variant_seed VALUES
    ('landmine-front-squat','bilateral-central-chest-sleeve-front-squat','Landmine Front Squat — Bilateral Central Rack','front_supported_fixed_pivot_squat','central_chest_two_hand_sleeve','bilateral_fixed_squat','bilateral_symmetric',48,58,50,48,52,0,58,44,52,48),
    ('landmine-front-squat','unilateral-shoulder-rack-front-squat','Landmine Front Squat — Unilateral Shoulder Rack','front_supported_fixed_pivot_squat','declared_unilateral_shoulder','bilateral_fixed_squat','working_side_unilateral',56,56,60,52,54,0,58,46,60,48),
    ('landmine-hack-squat','shoulder-supported-away-facing-hack-squat','Landmine Hack Squat — Shoulder Supported','away_facing_shoulder_supported_hack_squat','declared_upper_trapezius_or_shoulder','bilateral_feet_forward','loaded_shoulder_side_balanced_across_sets',54,64,56,60,62,0,66,48,58,72),
    ('landmine-split-squat','ipsilateral-shoulder-rack-stationary-split-squat','Landmine Split Squat — Ipsilateral Shoulder Rack','stationary_split_squat_no_step','declared_unilateral_shoulder','stationary_fore_aft','rack_ipsilateral_to_lead_leg',58,58,62,56,56,0,60,46,62,48),
    ('landmine-split-squat','contralateral-shoulder-rack-stationary-split-squat','Landmine Split Squat — Contralateral Shoulder Rack','stationary_split_squat_no_step','declared_unilateral_shoulder','stationary_fore_aft','rack_contralateral_to_lead_leg',62,58,66,58,58,0,60,46,66,48),
    ('landmine-split-squat','two-hand-neutral-handle-stationary-split-squat','Landmine Split Squat — Two-Hand Neutral Handle','stationary_split_squat_no_step','compatible_neutral_handle_two_hand','stationary_fore_aft','central_handle_with_declared_lead_leg',54,62,56,56,58,0,64,52,58,72),
    ('landmine-reverse-lunge-to-press','working-arm-ipsilateral-to-step-back-leg-drive-to-press','Landmine Reverse Lunge to Press — Ipsilateral Step-Back Leg','reverse_lunge_return_to_press','declared_unilateral_shoulder','step_back_and_return_to_bilateral','working_arm_ipsilateral_to_step_back_leg',66,58,70,62,60,1,62,46,70,48),
    ('landmine-reverse-lunge-to-press','working-arm-contralateral-to-step-back-leg-drive-to-press','Landmine Reverse Lunge to Press — Contralateral Step-Back Leg','reverse_lunge_return_to_press','declared_unilateral_shoulder','step_back_and_return_to_bilateral','working_arm_contralateral_to_step_back_leg',70,58,74,64,62,1,62,46,74,48);

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
      seed.rack,
      seed.stance_or_step,
      seed.side_relationship,
      'barbell_sleeve_or_declared_compatible_handle',
      'rated_fixed_landmine_pivot'
    ]::TEXT[],
    jsonb_build_object(
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
    ),
    jsonb_build_object(
      'selectable',TRUE,
      'actionIdentity',seed.action_identity,
      'orientation',CASE
        WHEN seed.action_identity = 'away_facing_shoulder_supported_hack_squat'
          THEN 'away_from_pivot'
        ELSE 'toward_pivot'
      END,
      'rack',seed.rack,
      'stanceOrStep',seed.stance_or_step,
      'sideRelationship',seed.side_relationship,
      'anchor','rated_fixed_landmine_pivot',
      'path','fixed_pivot_diagonal_arc',
      'footMotionPolicy',CASE
        WHEN seed.action_identity = 'stationary_split_squat_no_step'
          THEN 'feet_remain_fixed_for_set'
        WHEN seed.action_identity = 'reverse_lunge_return_to_press'
          THEN 'declared_step_back_then_return_to_bilateral_start'
        ELSE 'bilateral_stance_remains_fixed'
      END,
      'pressTiming',CASE
        WHEN seed.action_identity = 'reverse_lunge_return_to_press'
          THEN 'during_drive_back_toward_standing'
        ELSE 'no_press'
      END,
      'range','declared_owned_range',
      'terminalAction','controlled_return_rerack_and_set_down',
      'sideBalanceRequired',
        seed.side_relationship <> 'bilateral_symmetric',
      'pickupTransferSetDownMustBeDeclared',TRUE
    ),
    'review',
    jsonb_build_object(
      'externalLoadMethod','landmine_barbell',
      'externalLoadDescription','barbell and declared plate mass rotating around a rated fixed pivot with the declared sleeve or compatible-handle support',
      'effectiveLoadDrivers',jsonb_build_array('bar_mass','plate_mass','plate_position','bar_angle','athlete_distance_from_pivot','orientation','rack','stance_or_step','side_relationship','range','tempo','repetitions'),
      'gripDemand',seed.grip_fatigue,
      'spinalLoading',CASE
        WHEN seed.action_identity = 'away_facing_shoulder_supported_hack_squat'
          THEN 52
        ELSE 44
      END,
      'eccentricStress',52,
      'landingContactsPerRep',0,
      'impactClass',CASE
        WHEN seed.action_identity = 'reverse_lunge_return_to_press'
          THEN 'low_stepping_contact_no_planned_jump'
        ELSE 'no_planned_impact'
      END,
      'loadTracking',jsonb_build_array('bar_type','plate_mass','orientation','rack_or_attachment','stance_or_step','side_relationship','depth_and_range','tempo','repetitions')
    ),
    jsonb_build_object(
      'localMuscleFatigue',seed.local_fatigue,
      'gripFatigue',seed.grip_fatigue,
      'technicalFatigueSensitivity',seed.technical_fatigue,
      'impactAccumulation',seed.impact,
      'recoveryHours',seed.recovery_hours,
      'primaryFatigueSites',CASE
        WHEN seed.action_identity = 'reverse_lunge_return_to_press'
          THEN jsonb_build_array('front_leg_quadriceps_and_gluteals','adductors_and_hip_stabilizers','anterior_shoulder_and_triceps','scapular_stabilizers','trunk','grip')
        ELSE jsonb_build_array('quadriceps_and_gluteals','adductors_and_calves','pelvic_and_trunk_stabilizers','rack_support','grip')
      END,
      'earlyFatigueSignals',jsonb_build_array('stance_step_or_depth_drift','foot_pressure_or_knee_tracking_loss','pelvic_or_trunk_control_loss','rack_or_timing_change','range_speed_or_return_loss'),
      'downstreamConflicts',jsonb_build_array('heavy_squatting_lunging_or_sprinting','jumping_or_change_of_direction','trunk_bracing_or_single_leg_work','grip_intensive_work','fatigue_degraded_conditioning')
    ),
    jsonb_build_object(
      'selectionStatus',CASE
        WHEN seed.slug = 'landmine-split-squat'
          THEN 'candidate_identity_reauthor_requires_human_review'
        ELSE 'candidate_requires_human_review'
      END,
      'primaryIntent',seed.action_identity,
      'appropriatePhases',CASE
        WHEN seed.action_identity = 'reverse_lunge_return_to_press'
          THEN jsonb_build_array('capacity','output')
        ELSE jsonb_build_array('control_resilience','capacity')
      END,
      'avoidUse',jsonb_build_array('uncontrolled_to_failure','undeclared_stance_step_rack_or_timing_change','fatigue_degraded_alignment_or_return','symptom_provocation'),
      'cumulativeBudget',jsonb_build_object(
        'lowerBodyRepetitions',1,
        'kneeHipLoad',seed.local_fatigue,
        'shoulderPressLoad',CASE
          WHEN seed.action_identity = 'reverse_lunge_return_to_press'
            THEN seed.local_fatigue
          ELSE 0
        END,
        'gripStress',seed.grip_fatigue,
        'technicalSensitivity',seed.technical_fatigue,
        'steppingContacts',CASE
          WHEN seed.action_identity = 'reverse_lunge_return_to_press'
            THEN 2
          ELSE 0
        END
      )
    )
  FROM squat_lunge_variant_seed seed
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
