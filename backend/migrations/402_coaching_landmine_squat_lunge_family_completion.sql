-- Complete the Landmine Front Squat, Landmine Hack Squat, re-authored
-- stationary Landmine Split Squat, and Landmine Reverse Lunge to Press
-- candidate cards.
--
-- Migration 369 consolidated the handle-grip split-squat source but left the
-- broader landmine identity in needs_human_review because the legacy copy
-- mixed stationary and stepping actions. This migration re-authors a
-- stationary candidate without approving or deleting that unresolved review.
--
-- Public-search YouTube URLs are stored as unverified, non-embeddable candidates.
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
      WHEN 'control-pattern'
        THEN 'Rehearse the exact orientation, rack, stance or step, alignment, range, return, and set-down at low fatigue.'
      WHEN 'output-power'
        THEN 'Express a crisp front-leg return into the anchored press before step accuracy, timing, speed, or balance degrades.'
      ELSE 'Build repeatable lower-body and exact-variant load tolerance without changing the stance, action order, or return.'
    END,
    CASE profile.profile_key
      WHEN 'control-pattern' THEN 92
      ELSE 90
    END,
    90,
    jsonb_build_object(
      'lowerBodyStrength',seed.physical,
      'technicalQuality',seed.technical_fatigue,
      'sideControl',seed.coordination,
      'impact',seed.impact,
      'pressingPower',CASE
        WHEN seed.action_identity = 'reverse_lunge_return_to_press'
          THEN seed.coordination
        ELSE 0
      END
    ),
    CASE profile.profile_key
      WHEN 'control-pattern' THEN jsonb_build_object(
        'sets',jsonb_build_array(2,4),
        'repsPerSideOrTotal',jsonb_build_array(3,8),
        'rpe',jsonb_build_array(3,6),
        'restSeconds',jsonb_build_array(75,210),
        'tempo','slow_controlled_full_reset',
        'stopBeforeFailure',TRUE
      )
      WHEN 'output-power' THEN jsonb_build_object(
        'sets',jsonb_build_array(3,6),
        'repsPerSideOrTotal',jsonb_build_array(2,5),
        'rpe',jsonb_build_array(4,7),
        'restSeconds',jsonb_build_array(150,300),
        'tempo','controlled_step_explosive_return_and_press_full_reset',
        'stopBeforeFailure',TRUE
      )
      ELSE jsonb_build_object(
        'sets',jsonb_build_array(3,5),
        'repsPerSideOrTotal',CASE
          WHEN seed.action_identity = 'reverse_lunge_return_to_press'
            THEN jsonb_build_array(3,8)
          ELSE jsonb_build_array(4,10)
        END,
        'rpe',jsonb_build_array(5,8),
        'restSeconds',jsonb_build_array(120,360),
        'tempo','controlled_descent_owned_ascent_and_return',
        'stopBeforeFailure',TRUE
      )
    END,
    'Every counted repetition preserves secure equipment, the declared orientation, rack or attachment, stance or step, side relationship, range, action order, alignment, return, and set-down.',
    ARRAY[
      'Stop for pain, neurologic symptoms, or dizziness.',
      'Stop for anchor, collar, plate, handle, padding, floor, or lane failure.',
      'Stop when stance, step, foot pressure, knee tracking, pelvis, trunk, rack, press timing, balance, range, or return differs from the exact variant.',
      'Do not continue to grinding or uncontrolled failure.'
    ]::TEXT[],
    ARRAY[
      'Verify equipment, orientation, rack or attachment, stance or step, side sequence, target range, load, and exit before the set.',
      'Observe feet, knees, pelvis, trunk, rack, path, action order, finish, return, and set-down.',
      'End the set at the first material alignment, timing, speed, balance, equipment, or symptom fault.'
    ]::TEXT[],
    ARRAY[
      'Use the called rack or attachment, stance or step, side, and range.',
      'Follow the exact squat, stationary split squat, hack squat, or reverse-lunge-to-press action without improvising.',
      'Own the finish and return under control; stop when shape, timing, speed, or balance changes.'
    ]::TEXT[],
    CASE profile.profile_key
      WHEN 'control-pattern'
        THEN 'More repeatable setup, lower-body alignment, path, range, return, and set-down at low fatigue.'
      WHEN 'output-power'
        THEN 'Improved high-quality front-leg force transfer into the anchored press.'
      ELSE 'Improved exact-variant lower-body strength, side balance, trunk control, and load tolerance.'
    END,
    ARRAY['landmine','barbell']::TEXT[],
    jsonb_build_object(
      'athletesPerStation',1,
      'coachSightline','anchor_bar_and_plate_zone_feet_knees_pelvis_trunk_rack_path_and_return',
      'requiredClearance','complete_bar_plate_stance_step_transfer_and_set_down_zone',
      'setupSeconds',90,
      'transitionSeconds',30,
      'sharedEquipmentPolicy','Only one athlete enters the moving bar and plate zone.'
    ),
    '{}'::UUID[],
    'review',
    jsonb_build_object(
      'repSeconds',CASE
        WHEN seed.action_identity = 'reverse_lunge_return_to_press'
          THEN 8
        ELSE 6
      END,
      'setupSeconds',90,
      'transitionSeconds',30,
      'restIsExplicit',TRUE
    ),
    jsonb_build_object(
      'scaleDown',jsonb_build_array('reduce_load','reduce_owned_range','reduce_repetitions','increase_rest','add_stable_support_when_identity_allows'),
      'scaleUp',jsonb_build_array('increase_load_small_increment','increase_owned_range','increase_side_control','increase_velocity_only_for_output_profile'),
      'neverScaleBy',jsonb_build_array('undeclared_stance_or_step_change','undeclared_rack_or_attachment_change','adding_foot_elevation','changing_press_timing','continuing_through_pain_or_loss_of_control')
    ),
    jsonb_build_object(
      'track',jsonb_build_array('variant_key','orientation','rack_or_attachment','stance_or_step','side_relationship','range','load','sets','repetitions','rpe','rest_seconds','quality_stops'),
      'qualityThreshold','All counted repetitions meet the exact variant gate.'
    ),
    jsonb_build_object(
      'beforeSet',jsonb_build_array('confirm_exact_variant','confirm_equipment_and_lane','confirm_side_order_range_and_exit'),
      'duringSet',jsonb_build_array('watch_alignment_path_action_order_and_symptoms','announce_first_material_quality_stop'),
      'afterSet',jsonb_build_array('record_side_load_repetitions_rpe_and_faults','adjust_next_set_without_changing_identity')
    )
  FROM squat_lunge_variant_seed seed
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
        WHEN raw.profile_key = 'control-pattern'
          AND seed.action_identity = 'reverse_lunge_return_to_press'
          THEN 'output-power'
        ELSE raw.profile_key
      END AS profile_key,
      CASE
        WHEN raw.profile_key = 'control-pattern'
          AND seed.action_identity = 'reverse_lunge_return_to_press'
          THEN 'output'
        WHEN raw.profile_key = 'control-pattern'
          THEN 'control_resilience'
        ELSE 'capacity'
      END AS phase_key
    FROM (
      VALUES
        ('control-pattern'),
        ('capacity-strength')
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

  CREATE TEMP TABLE squat_lunge_evidence_seed (
    section_key TEXT PRIMARY KEY,
    source_url TEXT NOT NULL,
    source_title TEXT NOT NULL,
    source_publisher TEXT NOT NULL,
    source_kind TEXT NOT NULL,
    evidence_quality SMALLINT NOT NULL,
    claims_json JSONB NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO squat_lunge_evidence_seed VALUES
    (
      'identity',
      'https://doi.org/10.1249/FIT.0000000000000982',
      'The Landmine Squat Exercise',
      'ACSM''s Health & Fitness Journal',
      'peer_reviewed_research',
      86,
      '["A landmine squat uses a barbell constrained around a fixed pivot; rack, stance, support, foot movement, action order, path, and repetition boundary remain identity-critical.","Every candidate must declare orientation, sleeve support, foot policy, range, return, and whether a press is part of the repetition."]'::JSONB
    ),
    (
      'taxonomy',
      'https://www.frontiersin.org/journals/bioengineering-and-biotechnology/articles/10.3389/fbioe.2023.1277493/full',
      'The effects of step length on the biomechanics of split squat movement',
      'Frontiers in Bioengineering and Biotechnology',
      'peer_reviewed_research',
      88,
      '["Squat, stationary split squat, and stepping lunge tasks differ in base of support, laterality, joint contribution, and repetition boundary.","Stance geometry, rack, hand count, arm-leg relationship, foot elevation, step direction, depth, tempo, load, and press timing are controlled dimensions."]'::JSONB
    ),
    (
      'anatomy',
      'https://pubmed.ncbi.nlm.nih.gov/34341315/',
      'Differences in Muscle Activity and Kinetics Between the Goblet Squat and Landmine Squat in Men and Women',
      'Journal of Strength and Conditioning Research',
      'peer_reviewed_research',
      90,
      '["Landmine squat loading involves quadriceps, hamstring, and hip-extensor contributions with forces influenced by the anchored loading direction.","Record lower-extremity, pelvis, trunk, rack, and grip contributions; press variants also include shoulder, scapular, elbow, and wrist actions."]'::JSONB
    ),
    (
      'biomechanics',
      'https://pubmed.ncbi.nlm.nih.gov/34341315/',
      'Differences in Muscle Activity and Kinetics Between the Goblet Squat and Landmine Squat in Men and Women',
      'Journal of Strength and Conditioning Research',
      'peer_reviewed_research',
      90,
      '["Landmine and goblet squat conditions produce different muscle activity and ground-reaction-force components, so implement geometry and body position are not interchangeable.","Observe secure pivot, stance and distance, owned range, foot-knee-pelvis control, rack, ascent path, return, and set-down."]'::JSONB
    ),
    (
      'difficulty',
      'https://pubmed.ncbi.nlm.nih.gov/26418958/',
      'Joint Kinetics and Kinematics During Common Lower Limb Rehabilitation Exercises',
      'Journal of Athletic Training',
      'peer_reviewed_research',
      88,
      '["Lower-limb joint angles, moments, and ground-reaction forces differ across squat and lunge tasks, supporting exact-variant assessment.","Exercise complexity and physical difficulty are scored independently; overall equals their maximum. Exercise cards contain no athlete proficiency level."]'::JSONB
    ),
    (
      'load_fatigue_recovery',
      'https://pubmed.ncbi.nlm.nih.gov/34341315/',
      'Differences in Muscle Activity and Kinetics Between the Goblet Squat and Landmine Squat in Men and Women',
      'Journal of Strength and Conditioning Research',
      'peer_reviewed_research',
      90,
      '["Landmine loading changes muscle activity and force components, so bar mass, plate mass, pivot distance, range, repetitions, tempo, side dose, and rest must be tracked.","Budget lower-body, trunk, rack, grip, pressing, technical fatigue, and recovery according to the exact variant."]'::JSONB
    ),
    (
      'constraints',
      'https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/',
      'The Landmine Press—Implementation and Variation',
      'National Strength and Conditioning Association',
      'professional_standard',
      84,
      '["Landmine work requires a stable anchor, compatible barbell and loading hardware, and clear space for the complete bar and plate arc.","Declare floor traction, collars, plates, rack or attachment, stance or step lane, pickup, return, set-down, coach position, and exclusion zone."]'::JSONB
    ),
    (
      'dosage',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC10579494/',
      'Resistance training prescription for muscle strength and hypertrophy in healthy adults: a systematic review and Bayesian network meta-analysis',
      'British Journal of Sports Medicine',
      'peer_reviewed_research',
      94,
      '["Resistance dose and recovery account for sets, repetitions, load, effort, frequency, and exercise selection.","Use dose and rest that preserve exact stance or step, depth, rack, path, side balance, action order, and return."]'::JSONB
    ),
    (
      'instructions',
      'https://doi.org/10.1249/FIT.0000000000000982',
      'The Landmine Squat Exercise',
      'ACSM''s Health & Fitness Journal',
      'peer_reviewed_research',
      86,
      '["Instruction separates equipment setup, rack transfer, stance or step, descent, bottom position, ascent, optional press, return, and set-down.","Declare lead side, counted range, pressure, press timing, and the response to a failed repetition."]'::JSONB
    ),
    (
      'safety_stop_rules',
      'https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf',
      'Youth Resistance Training: Updated Position Statement Paper From the NSCA',
      'National Strength and Conditioning Association',
      'professional_standard',
      88,
      '["Qualified supervision, manageable resistance, correct technique, suitable equipment, and gradual progression are core safeguards.","Stop for symptoms, equipment movement, lost foot pressure, uncontrolled knee or pelvic motion, balance loss, trunk collapse, grinding, collision risk, or loss of the planned return."]'::JSONB
    ),
    (
      'programming',
      'https://pubmed.ncbi.nlm.nih.gov/34341315/',
      'Differences in Muscle Activity and Kinetics Between the Goblet Squat and Landmine Squat in Men and Women',
      'Journal of Strength and Conditioning Research',
      'peer_reviewed_research',
      90,
      '["Anchored loading direction and exact execution affect the task and must be selected for the intended adaptation.","Place heavy or high-coordination variants before material lower-body, pressing, grip, or conditioning fatigue when force or action quality is the priority."]'::JSONB
    ),
    (
      'athlete_support',
      'https://doi.org/10.1249/FIT.0000000000000982',
      'The Landmine Squat Exercise',
      'ACSM''s Health & Fitness Journal',
      'peer_reviewed_research',
      86,
      '["The athlete needs the exact rack, stance, pivot distance, hand count, side or step sequence, depth, load, repetitions, rest, and stop signal.","Reduce load, range, velocity, or support demand rather than silently changing stationary and stepping actions or adding a press."]'::JSONB
    ),
    (
      'coach_support',
      'https://pubmed.ncbi.nlm.nih.gov/34341315/',
      'Differences in Muscle Activity and Kinetics Between the Goblet Squat and Landmine Squat in Men and Women',
      'Journal of Strength and Conditioning Research',
      'peer_reviewed_research',
      90,
      '["Anchored resistance gives coaches observable setup, loading-direction, stance, path, range, and finish checkpoints.","Expose anchor, collars, clearance, rack, stance, distance, side, step, depth, alignment, press timing, symptoms, dose, fatigue, and shutdown actions."]'::JSONB
    ),
    (
      'accessibility',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC10579494/',
      'Resistance training prescription for muscle strength and hypertrophy in healthy adults: a systematic review and Bayesian network meta-analysis',
      'British Journal of Sports Medicine',
      'peer_reviewed_research',
      94,
      '["Resistance exercise can be individualized through load, volume, range, effort, equipment, and recovery while preserving the intended task.","Options include a lighter bar, reduced owned range, fewer repetitions, longer rest, stable support, floor markers, written or audio cues, still images, and live instruction."]'::JSONB
    ),
    (
      'alternates',
      'https://pubmed.ncbi.nlm.nih.gov/26418958/',
      'Joint Kinetics and Kinematics During Common Lower Limb Rehabilitation Exercises',
      'Journal of Athletic Training',
      'peer_reviewed_research',
      88,
      '["Stationary split squats and stepping lunges have different support and repetition boundaries; a press adds upper-body action and force transfer.","Rack, hand count, attachment, and arm-leg relationship can be variants; foot elevation, stepping, added press, rotation, jump, or clean can change identity."]'::JSONB
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
  CROSS JOIN squat_lunge_evidence_seed evidence
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

  CREATE TEMP TABLE squat_lunge_relationship_seed (
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

  INSERT INTO squat_lunge_relationship_seed VALUES
    ('landmine-front-squat','bilateral-central-chest-sleeve-front-squat','landmine-front-squat','unilateral-shoulder-rack-front-squat','lateral_substitution',84,'Rack and hand count change symmetry, trunk demand, grip, load tolerance, and side dose while the bilateral fixed-pivot squat remains.','{"changedAttributes":["rack","hand_count","load_symmetry","trunk_demand","side_dose"],"reassessLoadAndDose":true,"humanReviewRequired":true}'::JSONB),
    ('landmine-front-squat','unilateral-shoulder-rack-front-squat','landmine-front-squat','bilateral-central-chest-sleeve-front-squat','lateral_substitution',84,'Rack and hand count change symmetry, trunk demand, grip, load tolerance, and side dose while the bilateral fixed-pivot squat remains.','{"changedAttributes":["rack","hand_count","load_symmetry","trunk_demand","side_dose"],"reassessLoadAndDose":true,"humanReviewRequired":true}'::JSONB),
    ('landmine-front-squat','bilateral-central-chest-sleeve-front-squat','landmine-split-squat','ipsilateral-shoulder-rack-stationary-split-squat','progression',68,'The stationary split squat adds a unilateral base, declared lead leg, side relationship, and balance demand.','{"changedAttributes":["stance","laterality","rack","side_relationship","balance"],"condition":"objective_accepts_unilateral_stationary_strength_and_identity_review_is_approved","humanReviewRequired":true}'::JSONB),
    ('landmine-split-squat','ipsilateral-shoulder-rack-stationary-split-squat','landmine-front-squat','bilateral-central-chest-sleeve-front-squat','regression',68,'The bilateral central-rack front squat removes the unilateral stationary split and side relationship.','{"changedAttributes":["stance","laterality","rack","side_relationship","balance"],"condition":"objective_accepts_bilateral_squat_and_redosed_load","humanReviewRequired":true}'::JSONB),
    ('landmine-hack-squat','shoulder-supported-away-facing-hack-squat','landmine-front-squat','bilateral-central-chest-sleeve-front-squat','lateral_substitution',62,'Both are anchored squat patterns, but body orientation, sleeve support, force direction, transfer, and failure response differ.','{"changedAttributes":["orientation","load_position","support","transfer","failure_response"],"reassessLoadRangeAndExit":true,"humanReviewRequired":true}'::JSONB),
    ('landmine-front-squat','bilateral-central-chest-sleeve-front-squat','landmine-hack-squat','shoulder-supported-away-facing-hack-squat','lateral_substitution',62,'Both are anchored squat patterns, but body orientation, sleeve support, force direction, transfer, and failure response differ.','{"changedAttributes":["orientation","load_position","support","transfer","failure_response"],"reassessLoadRangeAndExit":true,"humanReviewRequired":true}'::JSONB),
    ('landmine-split-squat','ipsilateral-shoulder-rack-stationary-split-squat','landmine-split-squat','contralateral-shoulder-rack-stationary-split-squat','lateral_substitution',86,'The fixed-foot split-squat action remains while the rack-to-lead-leg relationship changes cross-body stabilization and side dose.','{"changedAttributes":["rack_to_lead_leg","trunk_stabilization","side_dose"],"requiresExactSideRedose":true,"humanReviewRequired":true}'::JSONB),
    ('landmine-split-squat','contralateral-shoulder-rack-stationary-split-squat','landmine-split-squat','ipsilateral-shoulder-rack-stationary-split-squat','lateral_substitution',86,'The fixed-foot split-squat action remains while the rack-to-lead-leg relationship changes cross-body stabilization and side dose.','{"changedAttributes":["rack_to_lead_leg","trunk_stabilization","side_dose"],"requiresExactSideRedose":true,"humanReviewRequired":true}'::JSONB),
    ('landmine-split-squat','ipsilateral-shoulder-rack-stationary-split-squat','landmine-split-squat','two-hand-neutral-handle-stationary-split-squat','lateral_substitution',78,'A two-hand compatible handle changes attachment, rack, symmetry, grip, and load tolerance while both feet remain fixed.','{"changedAttributes":["attachment","rack","hand_count","symmetry","grip","load_tolerance"],"reassessEquipmentLoadAndDose":true,"humanReviewRequired":true}'::JSONB),
    ('landmine-split-squat','two-hand-neutral-handle-stationary-split-squat','landmine-split-squat','ipsilateral-shoulder-rack-stationary-split-squat','lateral_substitution',78,'A unilateral shoulder rack changes attachment, symmetry, trunk demand, grip, and side dose while both feet remain fixed.','{"changedAttributes":["attachment","rack","hand_count","symmetry","trunk_demand","side_dose"],"reassessEquipmentLoadAndDose":true,"humanReviewRequired":true}'::JSONB),
    ('landmine-split-squat','ipsilateral-shoulder-rack-stationary-split-squat','landmine-reverse-lunge-to-press','working-arm-ipsilateral-to-step-back-leg-drive-to-press','progression',60,'The reverse-lunge-to-press adds a required step away from and return to a bilateral start plus an ordered press.','{"changedAttributes":["foot_motion","start_finish","press_action","timing","upper_body_load"],"condition":"objective_accepts_step_and_press_and_both_identities_are_reviewed","humanReviewRequired":true}'::JSONB),
    ('landmine-reverse-lunge-to-press','working-arm-ipsilateral-to-step-back-leg-drive-to-press','landmine-split-squat','ipsilateral-shoulder-rack-stationary-split-squat','regression',60,'The stationary split squat removes the repeated step and press while preserving a declared unilateral rack and lead-leg relationship.','{"changedAttributes":["foot_motion","start_finish","press_action","timing","upper_body_load"],"condition":"objective_accepts_stationary_lower_body_strength_and_identity_review_is_approved","humanReviewRequired":true}'::JSONB),
    ('landmine-reverse-lunge-to-press','working-arm-ipsilateral-to-step-back-leg-drive-to-press','landmine-reverse-lunge-to-press','working-arm-contralateral-to-step-back-leg-drive-to-press','lateral_substitution',84,'The same step-back and drive-to-press sequence uses the opposite arm-to-step-back-leg relationship.','{"changedAttributes":["arm_to_step_back_leg","cross_body_stabilization","side_dose"],"requiresExactSideRedose":true,"humanReviewRequired":true}'::JSONB),
    ('landmine-reverse-lunge-to-press','working-arm-contralateral-to-step-back-leg-drive-to-press','landmine-reverse-lunge-to-press','working-arm-ipsilateral-to-step-back-leg-drive-to-press','lateral_substitution',84,'The same step-back and drive-to-press sequence uses the opposite arm-to-step-back-leg relationship.','{"changedAttributes":["arm_to_step_back_leg","cross_body_stabilization","side_dose"],"requiresExactSideRedose":true,"humanReviewRequired":true}'::JSONB);

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
    ARRAY['complexity','load','stability','action_sequence','support']::TEXT[],
    seed.reason,
    seed.conditions,
    'review',
    NULL,
    NULL,
    NULL
  FROM squat_lunge_relationship_seed seed
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
        THEN 'Candidate exercise-complexity score reflects exact orientation, rack, support, stance or step, side relationship, action order, path, range, return, and control; human anchor review is pending.'
      WHEN 'absoluteLoadDemand'
        THEN 'Candidate physical-difficulty score reflects external load tolerance, lower-body force, unilateral or pressing demand, trunk transfer, grip, and repeatable quality; human anchor review is pending.'
      ELSE 'Overall is deterministically derived as the maximum of exercise complexity and physical difficulty; human calibration approval is pending.'
    END,
    'review',
    1,
    NULL,
    NULL,
    'Research proposal only; compare against approved facility anchors before approval.',
    NULL
  FROM squat_lunge_variant_seed seed
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

  CREATE TEMP TABLE squat_lunge_media_seed (
    slug TEXT NOT NULL,
    video_id TEXT NOT NULL,
    title TEXT NOT NULL,
    channel_name TEXT,
    source_query TEXT NOT NULL,
    notes TEXT NOT NULL,
    PRIMARY KEY (slug, video_id)
  ) ON COMMIT DROP;

  INSERT INTO squat_lunge_media_seed VALUES
    ('landmine-front-squat','docorX86lEg','How To Do The Landmine Front Squat (The Right Way)','Fitness 4 Back Pain','landmine front squat tutorial','Public search result candidate. Playback, oEmbed, exact rack, stance, depth, embedding, captions, quality, reviewer and approval remain pending.'),
    ('landmine-front-squat','rxwiKvk4H2s','Landmine Goblet Squat Beginner Friendly Strength','Chris Liddle: Fitness, Growth, and Skills','landmine goblet squat','Public search result candidate. Naming equivalence, exact setup and every media gate remain pending.'),
    ('landmine-front-squat','oTRl7p13XtY','Landmine Goblet Squat - OPEX Exercise Library','OPEX Fitness','landmine goblet squat exercise','Public search result candidate. Naming equivalence, exact setup and every media gate remain pending.'),
    ('landmine-front-squat','hLVh6VDjpDg','Landmine Squat','Breaking Muscle','landmine squat exercise','Public article embed candidate. Exact rack, stance, range and all media gates remain pending.'),
    ('landmine-front-squat','NfoJhEvRcFA','Landmine goblet squat',NULL,'landmine front squat','Public article-linked candidate. Channel, playback, exact match and all approval gates remain pending.'),
    ('landmine-hack-squat','0X3mydcwZGU','Landmine Hack Squat','The Official Beast Lab presented by Greg Gurenlian','landmine hack squat','Public search result candidate. Playback, oEmbed, exact setup, embedding, captions, quality, reviewer and approval remain pending.'),
    ('landmine-hack-squat','KnT02UvXUJE','HAVE YOU TRIED A LANDMINE HACK SQUAT?','Tom Peto Training','landmine hack squat demo','Public search result candidate. Exact shoulder support, foot position and every media gate remain pending.'),
    ('landmine-hack-squat','BS9jpHWIwH8','Landmine Hack Squat','Breaking Muscle','landmine hack squat exercise','Public article embed candidate. Playback, exact variant and every approval gate remain pending.'),
    ('landmine-split-squat','Vse04Q-SFz4','The Landmine Split Squat','Testosterone Nation','landmine split squat','Public search result candidate. Playback, oEmbed, exact stationary action, rack relationship, embedding, captions, quality, reviewer and approval remain pending.'),
    ('landmine-split-squat','c-MKGioqmbQ','Exercise Demo: Landmine Split Squat','Justin Ochoa','landmine split squat exercise demo','Public search result candidate. Exact stance, rack and every media gate remain pending.'),
    ('landmine-split-squat','yx-ta5JphKo','Landmine Split Squat | Exercise Demo | Coaching Software | QuickCoach','QuickCoach','landmine split squat tutorial','Public search result candidate. Exact arm-leg relationship and all approval gates remain pending.'),
    ('landmine-reverse-lunge-to-press','PSvv3LvzIkQ','Landmine Reverse Lunge + Press','Jenny LaBaw','landmine reverse lunge to press','Public search result candidate. Playback, oEmbed, exact arm-leg relationship and press timing, embedding, captions, quality, reviewer and approval remain pending.'),
    ('landmine-reverse-lunge-to-press','DqwMGTl4gvk','Landmine Single Arm Reverse Lunge to Press','Garrett McLaughlin','single arm landmine reverse lunge to press','Public search result candidate. Exact step and press sequence and every media gate remain pending.'),
    ('landmine-reverse-lunge-to-press','1GzW5PGkmt8','Reverse Lunge & Press','Higher Level Performance','landmine reverse lunge and press','Public article-linked candidate. Playback, exact variant and every approval gate remain pending.');

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
  FROM squat_lunge_media_seed media
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

  CREATE TEMP TABLE squat_lunge_alternate_seed (
    slug TEXT NOT NULL,
    alternate_name TEXT NOT NULL,
    classification TEXT NOT NULL,
    rationale TEXT NOT NULL,
    dimensions JSONB NOT NULL,
    proposed_card JSONB,
    PRIMARY KEY (slug, alternate_name)
  ) ON COMMIT DROP;

  INSERT INTO squat_lunge_alternate_seed VALUES
    ('landmine-front-squat','Bilateral Central-Rack Landmine Front Squat','new_variant','Two-hand central support is the base exact landmine front-squat variant.','{"variantKey":"bilateral-central-chest-sleeve-front-squat","handCount":2,"rack":"central_chest"}'::JSONB,NULL),
    ('landmine-front-squat','Unilateral Shoulder-Rack Landmine Front Squat','new_variant','A one-shoulder rack adds anti-rotation and side-dose demands without changing the bilateral squat action.','{"variantKey":"unilateral-shoulder-rack-front-squat","handCount":1,"rack":"declared_shoulder"}'::JSONB,NULL),
    ('landmine-front-squat','Landmine Hack Squat','new_definition','Facing away with the sleeve beside or behind a shoulder changes load position, body orientation, path and failure response.','{"existingSlug":"landmine-hack-squat","orientation":"away_from_pivot"}'::JSONB,NULL),
    ('landmine-front-squat','Landmine Squat-to-Press','new_definition','Adding a press after the squat changes the ordered action, upper-body load and repetition boundary.','{"existingSlug":"landmine-squat-to-press","addedAction":"press"}'::JSONB,NULL),
    ('landmine-front-squat','Free-Weight Front Squat','new_definition','A free barbell or other anterior implement lacks the fixed pivot and diagonal landmine force path.','{"existingSlug":"front-squat","anchor":"none"}'::JSONB,NULL),
    ('landmine-front-squat','Depth, Heel Elevation, Pause or Tempo','modifier_annotation','These change range and dose while the front-supported fixed-pivot squat identity remains intact.','{"modifiers":["depth","heel_elevation","bottom_pause","eccentric_tempo","load"]}'::JSONB,NULL),
    ('landmine-hack-squat','Shoulder-Supported Landmine Hack Squat','new_variant','This is the base exact away-facing landmine hack-squat contract.','{"variantKey":"shoulder-supported-away-facing-hack-squat","orientation":"away_from_pivot"}'::JSONB,NULL),
    ('landmine-hack-squat','Padded Sleeve or Viking-Handle Support','modifier_annotation','Padding or a compatible attachment changes contact and grip without changing the squat action when the same path is preserved.','{"modifiers":["contact_padding","compatible_handle_attachment"]}'::JSONB,NULL),
    ('landmine-hack-squat','Landmine Front Squat','new_definition','Facing the pivot with a central chest rack changes orientation, load position and failure response.','{"existingSlug":"landmine-front-squat","orientation":"toward_pivot"}'::JSONB,NULL),
    ('landmine-hack-squat','Machine Hack Squat','new_definition','A machine carriage, back pad and sled path are a different equipment and support contract.','{"equipment":"hack_squat_machine"}'::JSONB,NULL),
    ('landmine-hack-squat','Landmine Split Squat','new_definition','A stationary asymmetrical stance creates unilateral side dose and balance demands.','{"existingSlug":"landmine-split-squat","stance":"split"}'::JSONB,NULL),
    ('landmine-hack-squat','Depth, Heel Elevation or Tempo','modifier_annotation','These scale range and dose while preserving the away-facing shoulder-supported identity.','{"modifiers":["depth","heel_elevation","eccentric_tempo","bottom_pause","load"]}'::JSONB,NULL),
    ('landmine-split-squat','Ipsilateral Shoulder-Rack Landmine Split Squat','new_variant','Shoulder rack and lead leg share a side within the fixed-stance identity.','{"variantKey":"ipsilateral-shoulder-rack-stationary-split-squat","rackToLeadLeg":"ipsilateral"}'::JSONB,NULL),
    ('landmine-split-squat','Contralateral Shoulder-Rack Landmine Split Squat','new_variant','The cross-body rack changes trunk stabilization and side-dose demands.','{"variantKey":"contralateral-shoulder-rack-stationary-split-squat","rackToLeadLeg":"contralateral"}'::JSONB,NULL),
    ('landmine-split-squat','Two-Hand Neutral-Handle Landmine Split Squat','new_variant','The consolidated legacy handle changes attachment, wrist and load handling while the stance remains stationary.','{"variantKey":"two-hand-neutral-handle-stationary-split-squat","legacySourceSlug":"landmine-handle-grip-split-squat"}'::JSONB,NULL),
    ('landmine-split-squat','Landmine Reverse Lunge','new_definition','A reverse lunge steps away from and returns to a bilateral start each repetition.','{"requiredFootMotion":"step_back_and_return"}'::JSONB,NULL),
    ('landmine-split-squat','Rear-Foot-Elevated Landmine Split Squat','new_definition','Rear-foot elevation changes support, range, balance, loading and failure response.','{"support":"rear_foot_elevated"}'::JSONB,NULL),
    ('landmine-split-squat','Stance, Depth, Pause or Tempo','modifier_annotation','These scale mechanics and dose while the fixed-foot split-squat action remains intact.','{"modifiers":["stance_length","stance_width","depth","bottom_pause","eccentric_tempo","load"]}'::JSONB,NULL),
    ('landmine-reverse-lunge-to-press','Ipsilateral Arm-to-Step-Back-Leg Reverse Lunge to Press','new_variant','The working arm and step-back leg share a side within the defined drive-to-press sequence.','{"variantKey":"working-arm-ipsilateral-to-step-back-leg-drive-to-press","armToStepBackLeg":"ipsilateral"}'::JSONB,NULL),
    ('landmine-reverse-lunge-to-press','Contralateral Arm-to-Step-Back-Leg Reverse Lunge to Press','new_variant','The cross-body relationship changes trunk stabilization and side-dose demands.','{"variantKey":"working-arm-contralateral-to-step-back-leg-drive-to-press","armToStepBackLeg":"contralateral"}'::JSONB,NULL),
    ('landmine-reverse-lunge-to-press','Bilateral Rear Lunge While Pressing','new_definition','Pressing during the step-back descent has a different action order and overhead support phase from pressing during the return toward standing.','{"status":"proposal_only_human_review_required","pressTiming":"during_step_back_descent"}'::JSONB,NULL),
    ('landmine-reverse-lunge-to-press','Landmine Reverse Lunge','new_definition','Removing the press changes the upper-body action, force transfer, dose and repetition boundary.','{"addedAction":"none"}'::JSONB,NULL),
    ('landmine-reverse-lunge-to-press','Landmine Split Squat to Press','new_definition','A fixed split stance has no required step away from and return to a bilateral start.','{"startAndFinish":"stationary_split"}'::JSONB,NULL),
    ('landmine-reverse-lunge-to-press','Step Length, Lunge Depth, Press Range or Tempo','modifier_annotation','These scale the exact step-back and drive-to-press sequence without changing its ordered identity.','{"modifiers":["step_length","lunge_depth","press_range","eccentric_tempo","load"]}'::JSONB,NULL);

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
  FROM squat_lunge_alternate_seed alternate
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
      'identityResolved',definition.slug <> 'landmine-split-squat',
      'controlledTaxonomyPresent',TRUE,
      'anatomyJointsActionsPlanesLateralityPresent',TRUE,
      'difficultyFormulaValid',NOT EXISTS (
        SELECT 1
        FROM coaching.exercise_variant_v1 variant
        WHERE variant.definition_id = definition.id
          AND variant.status = 'review'
          AND (variant.difficulty_json->>'baseOverallDifficulty')::INTEGER
            <> greatest(
              (variant.difficulty_json->>'technicalComplexity')::INTEGER,
              (variant.difficulty_json->>'absoluteLoadDemand')::INTEGER
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
      ) = 6,
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
      )
    ),
    jsonb_build_array(
      jsonb_build_object(
        'code','CARD-MEDIA-01',
        'message','Three to five public-search YouTube candidates require playback, oEmbed, exact-variant, safety, cue, caption, accessibility, quality, reviewer, and approval review.'
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
      WHEN definition.slug = 'landmine-split-squat' THEN jsonb_build_array(
        jsonb_build_object(
          'code','CARD-IDENTITY-02',
          'message','Migration 369 preserved an unresolved identity boundary between the re-authored stationary landmine split squat and a broader legacy split-squat source; human review is required.'
        )
      )
      ELSE '[]'::JSONB
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
    FROM squat_lunge_variant_seed seed
    JOIN coaching.exercise_definition_v1 definition
      ON definition.facility_id = 1
     AND definition.slug = seed.slug
    JOIN coaching.exercise_variant_v1 variant
      ON variant.definition_id = definition.id
     AND variant.variant_key = seed.variant_key
     AND variant.status = 'review'
  ) <> 8 THEN
    RAISE EXCEPTION '% did not create all 8 exact review variants', migration_key;
  END IF;

  IF (
    SELECT count(*)
    FROM squat_lunge_variant_seed seed
    JOIN coaching.exercise_definition_v1 definition
      ON definition.facility_id = 1
     AND definition.slug = seed.slug
    JOIN coaching.exercise_variant_v1 variant
      ON variant.definition_id = definition.id
     AND variant.variant_key = seed.variant_key
    JOIN coaching.exercise_delivery_profile_v1 profile
      ON profile.variant_id = variant.id
     AND profile.status = 'review'
  ) <> 16 THEN
    RAISE EXCEPTION '% did not create all 16 contextual delivery profiles', migration_key;
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
  ) <> 64 THEN
    RAISE EXCEPTION '% did not create all 64 candidate evidence rows', migration_key;
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
  ) <> 14 THEN
    RAISE EXCEPTION '% did not create all 14 unverified, non-embeddable media candidates', migration_key;
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
  ) <> 24 THEN
    RAISE EXCEPTION '% did not create all 24 candidate alternate assessments', migration_key;
  END IF;

  IF (
    SELECT count(*)
    FROM squat_lunge_relationship_seed seed
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
  ) <> 14 THEN
    RAISE EXCEPTION '% did not create all 14 review-only relationships', migration_key;
  END IF;

  IF (
    SELECT count(*)
    FROM squat_lunge_variant_seed seed
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
  ) <> 24 THEN
    RAISE EXCEPTION '% did not create all 24 review-only calibration rows', migration_key;
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
  ) <> 4 THEN
    RAISE EXCEPTION '% did not create all 4 quarantined card test packets', migration_key;
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
    FROM squat_lunge_relationship_seed seed
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
    FROM squat_lunge_variant_seed seed
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

  IF NOT EXISTS (
    SELECT 1
    FROM coaching.exercise_definition_v1 survivor
    JOIN coaching.exercise_definition_source_v1 source
      ON source.definition_id = survivor.id
     AND source.legacy_exercise_id = 1453
    JOIN coaching.exercise_definition_v1 duplicate
      ON duplicate.facility_id = survivor.facility_id
     AND duplicate.slug = 'landmine-handle-grip-split-squat'
     AND duplicate.status = 'archived'
    WHERE survivor.facility_id = 1
      AND survivor.slug = 'landmine-split-squat'
      AND survivor.status = 'review'
  ) THEN
    RAISE EXCEPTION '% lost the archived handle-grip split-squat source mapping', migration_key;
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
      AND landmine.status = 'review'
  ) THEN
    RAISE EXCEPTION '% lost the unresolved split-squat identity-review boundary', migration_key;
  END IF;
END
$$;
