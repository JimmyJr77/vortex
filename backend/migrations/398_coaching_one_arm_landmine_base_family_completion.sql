-- Complete four exact one-arm landmine press base cards and quarantine the
-- mechanically unresolved Arc Press source label.
--
-- Half-kneeling, tall-kneeling, floor, and Z-press cards receive exact variants,
-- contextual delivery profiles, coach/athlete support, candidate evidence,
-- five oEmbed-healthy YouTube candidates apiece, alternate assessments,
-- review-only graph edges, calibration proposals, and automated test packets.
-- Arc Press receives the same review packet coverage but remains non-selectable
-- until a human establishes its base, hand count, rack, path, endpoint, rotation
-- policy, return, and identity boundary.
--
-- No media, evidence, relationship, calibration, card, or publication approval
-- is created. Exercise difficulty is exercise complexity plus physical
-- difficulty, with overall derived as their maximum. Athlete proficiency levels
-- remain exclusive to coaching.skill and are intentionally absent here.
-- IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '398_coaching_one_arm_landmine_base_family_completion';
  research_batch CONSTANT TEXT :=
    'one-arm-landmine-base-family-v1';
  research_version CONSTANT TEXT := '2026-07-27.56';
  target_slugs CONSTANT TEXT[] := ARRAY[
    'half-kneeling-one-arm-landmine-press',
    'tall-kneeling-one-arm-landmine-press',
    'one-arm-landmine-floor-press',
    'one-arm-landmine-z-press',
    'one-arm-landmine-arc-press'
  ]::TEXT[];
  target_legacy_ids CONSTANT BIGINT[] :=
    ARRAY[1405,1406,1411,1412,1413,1414]::BIGINT[];
  active_count INTEGER;
  already_applied_count INTEGER;
  protected_count INTEGER;
BEGIN
  SELECT count(*)
  INTO active_count
  FROM coaching.exercise_definition_v1
  WHERE facility_id = 1
    AND slug = ANY(target_slugs)
    AND status <> 'archived';

  IF active_count <> 5 THEN
    RAISE EXCEPTION
      '% expected exactly 5 active target definitions; found %',
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

  IF already_applied_count NOT IN (0, 5) THEN
    RAISE EXCEPTION
      '% found a partial prior application on % of 5 cards',
      migration_key,
      already_applied_count;
  END IF;

  SELECT count(*)
    INTO protected_count
    FROM coaching.exercise_definition_v1 definition
    WHERE definition.facility_id = 1
      AND definition.slug = ANY(target_slugs)
      AND (
        (already_applied_count = 0 AND definition.card_version <> 1)
        OR (already_applied_count = 5 AND definition.card_version <> 2)
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

    SELECT count(*)
    INTO protected_count
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
      );

    IF protected_count > 0 THEN
      RAISE EXCEPTION
        '% refused to replace % published variant/profile row(s)',
        migration_key,
        protected_count;
    END IF;

    SELECT
      (
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
        FROM coaching.exercise_relationship_v1 relationship
        WHERE (
          relationship.from_variant_id IN (
            SELECT variant.id
            FROM coaching.exercise_definition_v1 definition
            JOIN coaching.exercise_variant_v1 variant
              ON variant.definition_id = definition.id
            WHERE definition.facility_id = 1
              AND definition.slug = ANY(target_slugs)
          )
          OR relationship.to_variant_id IN (
            SELECT variant.id
            FROM coaching.exercise_definition_v1 definition
            JOIN coaching.exercise_variant_v1 variant
              ON variant.definition_id = definition.id
            WHERE definition.facility_id = 1
              AND definition.slug = ANY(target_slugs)
          )
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
        '% refused to overwrite % human-reviewed current-version record(s)',
        migration_key,
        protected_count;
    END IF;

  CREATE TEMP TABLE one_arm_landmine_card_seed (
    slug TEXT PRIMARY KEY,
    canonical_name TEXT NOT NULL,
    family_key TEXT NOT NULL,
    description TEXT NOT NULL,
    aliases TEXT[] NOT NULL,
    body_regions TEXT[] NOT NULL,
    anatomy_json JSONB NOT NULL,
    environment_json JSONB NOT NULL,
    population_json JSONB NOT NULL,
    athlete_support_json JSONB NOT NULL,
    coach_support_json JSONB NOT NULL,
    content_confidence SMALLINT NOT NULL,
    scoring_confidence SMALLINT NOT NULL,
    identity_status TEXT NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO one_arm_landmine_card_seed VALUES
    (
      'half-kneeling-one-arm-landmine-press',
      'Half-Kneeling One-Arm Landmine Press',
      'half_kneeling_unilateral_strict_fixed_arc_landmine_press',
      'Face a barbell secured in a rated landmine pivot from a padded half-kneeling base with one knee and the opposite foot on the floor. Declare the working arm, down-knee relationship, rack, load, range, tempo, repetitions, rest, side order, pickup, and set-down. Brace the pelvis and ribcage, press the sleeve up and forward through the fixed arc without leg drive or torso rotation, own the finish, and return to the same shoulder rack under control.',
      ARRAY[
        'Half Kneeling One Arm Landmine Press',
        'Half-Kneeling Single-Arm Landmine Press',
        'Half Kneeling Landmine Press'
      ]::TEXT[],
      ARRAY[
        'hand','wrist','elbow','shoulder','scapula','rib_cage',
        'core','spine','pelvis','hip','knee','ankle','foot'
      ]::TEXT[],
      '{
        "primaryMuscles":["anterior_deltoid","clavicular_pectoralis_major","triceps_brachii"],
        "secondaryMuscles":["serratus_anterior","upper_and_lower_trapezius","rotator_cuff"],
        "stabilizers":["abdominal_wall","internal_and_external_obliques","spinal_stabilizers","gluteals","hip_stabilizers","forearm_and_hand_flexors"],
        "joints":["glenohumeral","scapulothoracic","acromioclavicular","elbow","radioulnar","wrist","hand","spine","pelvis","hip","knee","ankle","foot"],
        "jointActions":["shoulder_flexion_in_fixed_landmine_arc","scapular_upward_rotation_protraction_and_posterior_tilt","elbow_extension_and_flexion","wrist_and_grip_stabilization","trunk_anti_extension_anti_lateral_flexion_and_anti_rotation","half_kneeling_hip_and_knee_isometric_control"],
        "planes":["oblique_sagittal_and_scapular_press_motion","frontal_and_transverse_stabilization"],
        "laterality":"unilateral_with_declared_working_arm_to_down_knee_relationship",
        "evidenceLimit":"Sources support a fixed-pivot press and half-kneeling implementations but do not validate one universal side relationship, load, range, dose, score, superiority claim, or clinical prescription."
      }'::JSONB,
      '{
        "surface":{"required":"level_dry_high_traction","paddedDownKnee":true},
        "equipment":{"ratedLandmineAnchor":true,"compatibleBarbell":true,"collarsWhenLoaded":true},
        "space":{"fullBarArcClear":true,"kneelingAndSetDownZoneClear":true,"plateAndSleeveExclusionZoneMeters":1.5},
        "setup":{"workingArmDownKneeRackRangeTempoAndDoseDeclared":true,"lightRehearsalRequired":true},
        "traffic":{"oneActiveAthletePerLandmine":true,"coachOutsideMovingBarPath":true}
      }'::JSONB,
      '{
        "prerequisites":["pain_free_half_kneeling_contacts","can_hold_declared_knee_foot_and_side_relationship","can_control_unloaded_or_light_bar","can_execute_safe_pickup_transfer_and_set_down"],
        "useCaution":["current_upper_extremity_spine_hip_knee_ankle_or_foot_symptoms","limited_kneeling_tolerance","meaningful_side_difference","fatigue_from_pressing_throwing_hitting_contact_or_grip_work"],
        "doNotUseWhen":["sharp_or_increasing_pain","neurologic_dizziness_or_unusual_breathlessness","unsafe_anchor_bar_collar_plate_floor_or_clearance","cannot_hold_declared_half_kneeling_base","cannot_control_return_and_set_down"],
        "regressionOrder":["remove_external_plates","shorten_to_owned_range","reduce_repetitions","increase_rest","choose_reviewed_alternate_base_or_press"],
        "individualizationRequired":true,
        "medicalScope":"This card is not diagnosis, treatment, rehabilitation, injury-prevention assurance, or medical clearance."
      }'::JSONB,
      '{
        "whyItMatters":"Builds unilateral angled pressing strength while the shoulder blade, trunk, pelvis, and asymmetric kneeling base coordinate around a fixed path.",
        "primaryCue":"Set the exact knee, foot, and working side; press up and forward without pushing from the legs or turning; return to the same rack.",
        "beforeYouStart":["confirm_anchor_bar_collars_plates_pad_and_clearance","confirm_working_arm_down_knee_relationship_rack_load_range_tempo_repetitions_rest_and_finish","rehearse_one_light_repetition","identify_stop_signal_and_set_down"],
        "selfChecks":["knee_and_foot_pressure_stay_fixed","pelvis_and_ribs_stay_organized","wrist_and_forearm_stay_stacked","bar_follows_same_arc","no_leg_drive_or_turn","return_is_controlled"],
        "painGuidance":"Stop and report pain, neurologic symptoms, dizziness, unusual breathlessness, equipment movement, loss of base, wrist collapse, path change, or a return you cannot control.",
        "accessibility":["lighter_load","shorter_owned_range","fewer_repetitions","longer_rest","reviewed_alternate_base_or_press","written_audio_still_image_tactile_or_live_walkthrough"],
        "recordAfterSet":["variant_key","working_side","down_knee","lead_foot","load","range","tempo","quality_repetitions","rest","symptoms","stop_reason"]
      }'::JSONB,
      '{
        "observationChecklist":["anchor_collar_plate_pad_and_clearance","working_arm_down_knee_and_lead_foot","knee_foot_pressure_pelvis_and_ribs","wrist_elbow_scapula_and_bar_arc","range_finish_return_and_set_down","symptoms_side_difference_and_fatigue"],
        "faultCorrections":{"base_shifts":["reduce_load","reset_knee_and_foot","end_set_if_not_repeatable"],"ribs_flare_or_trunk_rotates":["reduce_load_or_range","cue_stack_and_brace"],"wrist_or_path_changes":["end_set","reduce_load","reset_rack"],"leg_drive_appears":["end_set","do_not_relabel_as_strict_press"]},
        "groupManagement":["one_active_athlete_per_landmine","bar_arc_is_an_exclusion_zone","standardize_side_counting","load_changes_only_when_bar_is_still"],
        "recordingFields":["variant_key","working_side","down_knee","lead_foot","rack","load","range","tempo","quality_repetitions","rest","symptoms","stop_reason"]
      }'::JSONB,
      88,
      70,
      'exact_variants_candidate_review'
    ),
    (
      'tall-kneeling-one-arm-landmine-press',
      'Tall-Kneeling One-Arm Landmine Press',
      'tall_kneeling_unilateral_strict_fixed_arc_landmine_press',
      'Face a barbell secured in a rated landmine pivot from a padded tall-kneeling base with both knees under the hips. Declare working side, foot position, shoulder rack, load, range, tempo, repetitions, rest, side order, transfer, and set-down. Maintain even knee pressure and extended hips without back extension, press up and forward through the fixed arc without hip drive or rotation, own the finish, and return to the same rack.',
      ARRAY[
        'Tall Kneeling One Arm Landmine Press',
        'Tall-Kneeling Single-Arm Landmine Press',
        'Full-Kneeling One-Arm Landmine Press'
      ]::TEXT[],
      ARRAY[
        'hand','wrist','elbow','shoulder','scapula','rib_cage',
        'core','spine','pelvis','hip','knee'
      ]::TEXT[],
      '{
        "primaryMuscles":["anterior_deltoid","clavicular_pectoralis_major","triceps_brachii"],
        "secondaryMuscles":["serratus_anterior","upper_and_lower_trapezius","rotator_cuff"],
        "stabilizers":["abdominal_wall","internal_and_external_obliques","spinal_stabilizers","gluteals","forearm_and_hand_flexors"],
        "joints":["glenohumeral","scapulothoracic","acromioclavicular","elbow","radioulnar","wrist","hand","spine","pelvis","hip","knee"],
        "jointActions":["shoulder_flexion_in_fixed_landmine_arc","scapular_upward_rotation_protraction_and_posterior_tilt","elbow_extension_and_flexion","wrist_and_grip_stabilization","trunk_anti_extension_anti_lateral_flexion_and_anti_rotation","tall_kneeling_hip_extension_isometric_control"],
        "planes":["oblique_sagittal_and_scapular_press_motion","frontal_and_transverse_stabilization"],
        "laterality":"unilateral_press_from_symmetric_bilateral_knee_base",
        "evidenceLimit":"Sources support fixed-pivot pressing and tall-kneeling examples but not one universal foot position, load, range, dose, score, superiority claim, or clinical prescription."
      }'::JSONB,
      '{
        "surface":{"required":"level_dry_high_traction","paddedBothKnees":true},
        "equipment":{"ratedLandmineAnchor":true,"compatibleBarbell":true,"collarsWhenLoaded":true},
        "space":{"fullBarArcClear":true,"kneelingTransferAndSetDownZoneClear":true,"plateAndSleeveExclusionZoneMeters":1.5},
        "setup":{"sideFootPositionRackRangeTempoAndDoseDeclared":true,"lightRehearsalRequired":true},
        "traffic":{"oneActiveAthletePerLandmine":true,"coachOutsideMovingBarPath":true}
      }'::JSONB,
      '{
        "prerequisites":["pain_free_bilateral_kneeling","can_hold_tall_kneeling_hip_extension_and_brace","can_control_unloaded_or_light_bar","can_execute_safe_transfer_and_set_down"],
        "useCaution":["current_upper_extremity_spine_hip_or_knee_symptoms","limited_kneeling_tolerance","meaningful_side_difference","fatigue_from_pressing_throwing_hitting_contact_or_grip_work"],
        "doNotUseWhen":["sharp_or_increasing_pain","neurologic_dizziness_or_unusual_breathlessness","unsafe_anchor_bar_collar_plate_floor_or_clearance","cannot_hold_tall_kneeling_without_hip_impulse","cannot_control_transfer_or_set_down"],
        "regressionOrder":["remove_external_plates","shorten_to_owned_range","reduce_repetitions","increase_rest","choose_reviewed_half_kneeling_or_other_press"],
        "individualizationRequired":true,
        "medicalScope":"This card is not diagnosis, treatment, rehabilitation, injury-prevention assurance, or medical clearance."
      }'::JSONB,
      '{
        "whyItMatters":"Builds strict unilateral angled pressing while the glutes and trunk hold a bilateral knee base without foot support.",
        "primaryCue":"Knees even, hips tall, ribs stacked; press up and forward without sitting back, driving the hips, or turning.",
        "beforeYouStart":["confirm_anchor_bar_collars_plates_pad_and_clearance","confirm_side_foot_position_rack_load_range_tempo_repetitions_rest_and_finish","rehearse_transfer_and_light_repetition","identify_stop_signal_and_set_down"],
        "selfChecks":["even_knee_pressure","hips_stay_extended_without_back_arch","wrist_and_forearm_stay_stacked","bar_follows_same_arc","no_hip_impulse_or_turn","transfer_is_controlled"],
        "painGuidance":"Stop and report pain, neurologic symptoms, dizziness, unusual breathlessness, equipment movement, loss of base, wrist collapse, path change, or an unsafe transfer.",
        "accessibility":["lighter_load","shorter_owned_range","fewer_repetitions","longer_rest","reviewed_half_kneeling_or_other_press","written_audio_still_image_tactile_or_live_walkthrough"],
        "recordAfterSet":["variant_key","working_side","foot_position","load","range","tempo","quality_repetitions","rest","symptoms","stop_reason"]
      }'::JSONB,
      '{
        "observationChecklist":["anchor_collar_plate_pad_and_clearance","bilateral_knee_pressure_hip_extension_and_foot_position","working_side_rack_wrist_elbow_scapula_and_arc","range_finish_return_transfer_and_set_down","symptoms_side_difference_and_fatigue"],
        "faultCorrections":{"hips_drift_or_back_extends":["reduce_load_or_range","reset_glutes_and_ribs"],"trunk_rotates_or_side_bends":["reduce_load","end_set_if_not_repeatable"],"wrist_or_path_changes":["end_set","reset_rack"],"hip_impulse_appears":["end_set","do_not_count_as_strict"]},
        "groupManagement":["one_active_athlete_per_landmine","bar_arc_is_an_exclusion_zone","standardize_side_counting","load_changes_only_when_bar_is_still"],
        "recordingFields":["variant_key","working_side","foot_position","rack","load","range","tempo","quality_repetitions","rest","symptoms","stop_reason"]
      }'::JSONB,
      86,
      68,
      'exact_variants_candidate_review'
    ),
    (
      'one-arm-landmine-floor-press',
      'One-Arm Landmine Floor Press',
      'supine_unilateral_floor_limited_landmine_press',
      'Lie supine in the declared relationship to a barbell secured in a rated landmine pivot. Establish a clear head and torso zone, receive the sleeve at the working-side rack, and declare load, range, tempo, repetitions, rest, side order, handoff, and exit. Press through the pivoted path without bridging or rotating, own the finish, and lower until the working upper arm reaches the declared floor boundary without bouncing.',
      ARRAY[
        'One Arm Landmine Floor Press',
        'Single-Arm Landmine Floor Press',
        'Unilateral Landmine Floor Press'
      ]::TEXT[],
      ARRAY[
        'hand','wrist','elbow','shoulder','scapula','rib_cage',
        'core','spine','pelvis'
      ]::TEXT[],
      '{
        "primaryMuscles":["pectoralis_major","anterior_deltoid","triceps_brachii"],
        "secondaryMuscles":["serratus_anterior","rotator_cuff","scapular_stabilizers"],
        "stabilizers":["abdominal_wall","internal_and_external_obliques","forearm_and_hand_flexors"],
        "joints":["glenohumeral","scapulothoracic","acromioclavicular","elbow","radioulnar","wrist","hand","spine","pelvis"],
        "jointActions":["shoulder_horizontal_flexion_and_flexion_in_landmine_arc","elbow_extension_and_flexion","scapular_control_against_floor_support","wrist_and_grip_stabilization","trunk_anti_rotation_and_pelvic_control"],
        "planes":["oblique_transverse_and_sagittal_press_motion","transverse_and_frontal_stabilization"],
        "laterality":"unilateral",
        "rangeBoundary":"working_upper_arm_reaches_declared_floor_contact_without_bounce",
        "evidenceLimit":"Range-of-motion research establishes that range changes press loading and kinematics; it does not validate this exact landmine variant, one universal load, dose, score, superiority claim, or clinical prescription."
      }'::JSONB,
      '{
        "surface":{"required":"level_dry_non_slip_floor_or_thin_mat","headAndTorsoSupported":true},
        "equipment":{"ratedLandmineAnchor":true,"compatibleBarbell":true,"collarsWhenLoaded":true},
        "space":{"headTorsoAndLegZoneClear":true,"fullBarArcClear":true,"plateAndSleeveExclusionZoneMeters":1.5},
        "setup":{"bodyToPivotRelationshipRackRangeHandoffAndExitDeclared":true,"lightRehearsalRequired":true},
        "traffic":{"oneActiveAthletePerLandmine":true,"coachOutsideFaceAndBarPath":true}
      }'::JSONB,
      '{
        "prerequisites":["pain_free_supine_and_floor_contact","can_control_declared_press_range","can_receive_and_return_unloaded_or_light_sleeve","can_exit_without_crossing_loaded_bar_path"],
        "useCaution":["current_hand_wrist_elbow_shoulder_neck_or_back_symptoms","meaningful_side_difference","limited_floor_transfer_tolerance","fatigue_from_pressing_throwing_hitting_contact_or_grip_work"],
        "doNotUseWhen":["sharp_or_increasing_pain","neurologic_dizziness_or_unusual_breathlessness","unsafe_anchor_bar_collar_plate_floor_or_clearance","bar_path_enters_face_or_collision_zone","cannot_control_handoff_or_exit"],
        "regressionOrder":["remove_external_plates","shorten_to_owned_range","reduce_repetitions","increase_rest","choose_reviewed_floor_or_press_substitution"],
        "individualizationRequired":true,
        "medicalScope":"This card is not diagnosis, treatment, rehabilitation, injury-prevention assurance, or medical clearance."
      }'::JSONB,
      '{
        "whyItMatters":"Builds floor-limited unilateral pressing strength with a stable torso, explicit range boundary, and offset landmine path.",
        "primaryCue":"Clear the face and body, receive the rack, press without bridging or turning, touch the upper arm quietly to the declared floor boundary, and return safely.",
        "beforeYouStart":["confirm_anchor_bar_collars_plates_floor_and_clearance","confirm_body_relationship_side_rack_load_range_tempo_repetitions_rest_handoff_and_exit","rehearse_unloaded_or_light_handoff","identify_stop_signal"],
        "selfChecks":["head_and_body_stay_out_of_bar_path","wrist_and_forearm_stay_stacked","hips_stay_down","torso_does_not_turn","floor_contact_is_quiet_and_repeatable","handoff_and_exit_match_plan"],
        "painGuidance":"Stop for pain, neurologic symptoms, dizziness, equipment movement, bar drift toward the face, bridge or rotation, wrist collapse, uncontrolled floor contact, or failed handoff.",
        "accessibility":["lighter_load","shorter_owned_range","fewer_repetitions","longer_rest","reviewed_alternate_press","written_audio_still_image_tactile_or_live_walkthrough"],
        "recordAfterSet":["variant_key","working_side","body_to_pivot_position","load","range","tempo","quality_repetitions","rest","symptoms","stop_reason"]
      }'::JSONB,
      '{
        "observationChecklist":["anchor_collar_plate_floor_and_clearance","head_torso_and_bar_relationship","working_side_rack_wrist_elbow_and_floor_boundary","no_bridge_or_rotation","finish_return_handoff_and_exit","symptoms_side_difference_and_fatigue"],
        "faultCorrections":{"bar_drifts_toward_face":["stop_immediately","unload_and_reset_position"],"hips_bridge_or_torso_rotates":["reduce_load","reset_base","end_set_if_repeated"],"floor_contact_bounces":["reduce_load_or_range","slow_lowering"],"handoff_is_uncertain":["stop","rehearse_with_unloaded_bar"]},
        "groupManagement":["one_active_athlete_per_landmine","head_and_bar_zone_is_an_exclusion_zone","standardize_side_counting","load_changes_only_when_bar_is_still"],
        "recordingFields":["variant_key","working_side","body_to_pivot_position","rack","load","range","tempo","quality_repetitions","rest","symptoms","stop_reason"]
      }'::JSONB,
      88,
      72,
      'exact_variants_candidate_review'
    ),
    (
      'one-arm-landmine-z-press',
      'One-Arm Landmine Z-Press',
      'long_sit_unilateral_strict_fixed_arc_landmine_press',
      'Sit upright on a level floor facing a barbell secured in a rated landmine pivot with both legs extended in the declared together or straddle position. Declare working side, shoulder rack, load, range, tempo, repetitions, rest, side order, transfer, and exit. Keep the pelvis and trunk upright without reclining, bending the knees, or using leg drive; press up and forward through the fixed arc, own the finish, and return to the same rack.',
      ARRAY[
        'One Arm Landmine Z Press',
        'Single-Arm Landmine Z-Press',
        'Landmine Single-Arm Z Press'
      ]::TEXT[],
      ARRAY[
        'hand','wrist','elbow','shoulder','scapula','rib_cage',
        'core','spine','pelvis','hip','knee','ankle'
      ]::TEXT[],
      '{
        "primaryMuscles":["anterior_deltoid","clavicular_pectoralis_major","triceps_brachii"],
        "secondaryMuscles":["serratus_anterior","upper_and_lower_trapezius","rotator_cuff"],
        "stabilizers":["abdominal_wall","internal_and_external_obliques","spinal_stabilizers","hip_flexors_and_long_sit_stabilizers","forearm_and_hand_flexors"],
        "joints":["glenohumeral","scapulothoracic","acromioclavicular","elbow","radioulnar","wrist","hand","spine","pelvis","hip","knee","ankle"],
        "jointActions":["shoulder_flexion_in_fixed_landmine_arc","scapular_upward_rotation_protraction_and_posterior_tilt","elbow_extension_and_flexion","wrist_and_grip_stabilization","trunk_anti_extension_anti_lateral_flexion_and_anti_rotation","long_sit_hip_knee_and_pelvic_position_control"],
        "planes":["oblique_sagittal_and_scapular_press_motion","frontal_and_transverse_stabilization"],
        "laterality":"unilateral_press_from_bilateral_long_sit_base",
        "evidenceLimit":"Sources support fixed-pivot pressing and public examples of a landmine Z-press, but do not validate one universal leg position, load, range, dose, score, superiority claim, or clinical prescription."
      }'::JSONB,
      '{
        "surface":{"required":"level_dry_non_slip_floor_or_thin_mat","longSitZoneClear":true},
        "equipment":{"ratedLandmineAnchor":true,"compatibleBarbell":true,"collarsWhenLoaded":true},
        "space":{"legsBarAndPlatePathClear":true,"transferAndExitZoneClear":true,"plateAndSleeveExclusionZoneMeters":1.5},
        "setup":{"legPositionSideRackRangeTempoDoseTransferAndExitDeclared":true,"lightRehearsalRequired":true},
        "traffic":{"oneActiveAthletePerLandmine":true,"coachOutsideMovingBarPath":true}
      }'::JSONB,
      '{
        "prerequisites":["pain_free_upright_long_sit_or_reviewed_straddle","can_hold_declared_leg_and_pelvis_position","can_control_unloaded_or_light_bar","can_execute_safe_transfer_and_exit"],
        "useCaution":["current_upper_extremity_spine_hip_knee_or_hamstring_symptoms","limited_long_sit_tolerance","meaningful_side_difference","fatigue_from_pressing_throwing_hitting_contact_or_grip_work"],
        "doNotUseWhen":["sharp_or_increasing_pain","neurologic_dizziness_or_unusual_breathlessness","unsafe_anchor_bar_collar_plate_floor_or_clearance","cannot_stay_upright_without_leg_change","cannot_control_transfer_or_exit"],
        "regressionOrder":["remove_external_plates","use_reviewed_straddle_when_appropriate","shorten_to_owned_range","reduce_repetitions","increase_rest","choose_reviewed_tall_or_half_kneeling_press"],
        "individualizationRequired":true,
        "medicalScope":"This card is not diagnosis, treatment, rehabilitation, injury-prevention assurance, or medical clearance."
      }'::JSONB,
      '{
        "whyItMatters":"Builds strict unilateral angled pressing without lower-body drive while the trunk and pelvis maintain an upright long-sit base.",
        "primaryCue":"Set the exact leg position, sit tall, press up and forward without reclining or bending the knees, and return to the same rack.",
        "beforeYouStart":["confirm_anchor_bar_collars_plates_floor_and_clearance","confirm_leg_position_side_rack_load_range_tempo_repetitions_rest_transfer_and_exit","rehearse_one_light_repetition","identify_stop_signal"],
        "selfChecks":["legs_stay_in_declared_position","pelvis_and_trunk_stay_upright","wrist_and_forearm_stay_stacked","bar_follows_same_arc","no_recline_turn_or_knee_bend","transfer_is_controlled"],
        "painGuidance":"Stop and report pain, neurologic symptoms, dizziness, equipment movement, posterior pelvic collapse, leg position change, wrist collapse, path change, or an unsafe transfer.",
        "accessibility":["lighter_load","reviewed_straddle_position","shorter_owned_range","fewer_repetitions","longer_rest","reviewed_alternate_base_or_press","written_audio_still_image_tactile_or_live_walkthrough"],
        "recordAfterSet":["variant_key","working_side","leg_position","load","range","tempo","quality_repetitions","rest","symptoms","stop_reason"]
      }'::JSONB,
      '{
        "observationChecklist":["anchor_collar_plate_floor_and_clearance","leg_position_pelvis_and_trunk","working_side_rack_wrist_elbow_scapula_and_arc","range_finish_return_transfer_and_exit","symptoms_side_difference_and_fatigue"],
        "faultCorrections":{"pelvis_collapses_or_trunk_reclines":["reduce_load_or_range","use_reviewed_straddle_or_other_base"],"knees_bend_or_legs_shift":["end_set","reset_exact_variant"],"wrist_or_path_changes":["end_set","reset_rack"],"transfer_is_uncertain":["stop","rehearse_with_unloaded_bar"]},
        "groupManagement":["one_active_athlete_per_landmine","legs_and_bar_arc_are_exclusion_zones","standardize_side_counting","load_changes_only_when_bar_is_still"],
        "recordingFields":["variant_key","working_side","leg_position","rack","load","range","tempo","quality_repetitions","rest","symptoms","stop_reason"]
      }'::JSONB,
      86,
      68,
      'exact_variants_candidate_review'
    ),
    (
      'one-arm-landmine-arc-press',
      'One-Arm Landmine Arc Press',
      'quarantined_unresolved_landmine_arc_press_source',
      'This source label is retained for identity review only. Do not prescribe it until a qualified reviewer establishes the exact base, hand count, working side, start rack, path landmarks, endpoint, rotation policy, return, equipment, failure strategy, and distinction from the strict landmine press, bilateral side-to-side landmine arc, rotational press, and eccentric-tempo landmine press.',
      ARRAY[
        'One Arm Landmine Arc Press',
        'Landmine Arc Press',
        'One Arm Eccentric Landmine Press',
        'One-Arm Eccentric Landmine Press'
      ]::TEXT[],
      ARRAY[
        'hand','wrist','elbow','shoulder','scapula','rib_cage',
        'core','spine','pelvis'
      ]::TEXT[],
      '{
        "status":"candidate_pending_exact_movement_contract",
        "candidatePrimaryMuscles":["anterior_deltoid","clavicular_pectoralis_major","triceps_brachii"],
        "candidateSecondaryMuscles":["serratus_anterior","trapezius","rotator_cuff","abdominal_wall","forearm_and_hand_flexors"],
        "candidateJoints":["glenohumeral","scapulothoracic","elbow","wrist","spine","pelvis"],
        "jointActions":["pending_exact_start_path_endpoint_rotation_and_return_review"],
        "planes":["pending_exact_path_review"],
        "laterality":"source_label_claims_one_arm_but_requires_confirmation",
        "evidenceLimit":"Professional sources acknowledge an Arc Press label but do not publicly establish the movement contract required for safe identity, taxonomy, anatomy, difficulty, dosage, substitution, or media approval."
      }'::JSONB,
      '{
        "surface":{"required":"pending_exact_base_review"},
        "equipment":{"ratedLandmineAnchor":true,"compatibleBarbell":true,"collarsWhenLoaded":true},
        "space":{"fullPotentialBarArcClear":true,"plateAndSleeveExclusionZoneMeters":1.5},
        "setup":{"humanMovementContractReviewRequired":true},
        "traffic":{"athletePrescriptionProhibited":true}
      }'::JSONB,
      '{
        "prerequisites":["qualified_identity_reviewer_assigned","exact_movement_contract_recorded","identity_collision_reviewed","difficulty_and_stop_rules_recalibrated"],
        "doNotUseWhen":["identity_review_incomplete","exact_media_review_incomplete","publication_quarantine_active"],
        "individualizationRequired":true,
        "medicalScope":"This quarantined source label is not an athlete prescription, diagnosis, treatment, rehabilitation, injury-prevention assurance, or medical clearance."
      }'::JSONB,
      '{
        "whyItMatters":"Retains source traceability without exposing an underspecified movement to workout selection.",
        "primaryCue":"Do not select or perform from this card while identity review is incomplete.",
        "beforeYouStart":["no_athlete_start_is_authorized"],
        "selfChecks":["card_selection_is_blocked"],
        "painGuidance":"No athlete delivery is allowed from this card.",
        "accessibility":["use_a_reviewed_exact_landmine_press_or_other_substitution"],
        "recordAfterSet":["no_set_may_be_generated"]
      }'::JSONB,
      '{
        "observationChecklist":["base","hand_count","working_side","rack","path_landmarks","endpoint","rotation_policy","return","equipment","failure_strategy","existing_identity_boundaries"],
        "reviewDecisionTree":{"same_as_strict_press":"consolidate_only_after_documented_review","distinct_unilateral_arc":"create_exact_variants_and_new_card_version","bilateral_side_to_side_arc":"use_or_create_separate_definition","eccentric_only_difference":"model_as_tempo_or_contraction_modifier","still_ambiguous":"retain_quarantine"},
        "groupManagement":["do_not_place_in_station_plan","do_not_generate_dose","do_not_display_as_athlete_option"],
        "recordingFields":["reviewer","reviewed_sources","observed_contract","identity_decision","affected_cards","required_follow_up"]
      }'::JSONB,
      62,
      45,
      'identity_quarantine'
    );

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
    SET variant_key =
          CASE
            WHEN variant.variant_key = 'baseline'
              THEN 'legacy-underspecified-source-' || left(variant.id::TEXT, 8)
            ELSE variant.variant_key
          END,
        status = 'archived',
        requirements_json = coalesce(variant.requirements_json, '{}'::JSONB)
          || jsonb_build_object(
            'selectable', FALSE,
            'completionQuarantine', TRUE,
            'quarantineReason',
              'Superseded source variant lacks the exact base, laterality, rack, path, range, load, tempo, dose, fatigue, stop, and set-down contract.'
          ),
        updated_at = now()
    FROM coaching.exercise_definition_v1 definition
    WHERE variant.definition_id = definition.id
      AND definition.facility_id = 1
      AND definition.slug = ANY(target_slugs);
  END IF;

  UPDATE coaching.exercise_definition_v1 definition
  SET canonical_name = seed.canonical_name,
      display_name = seed.canonical_name,
      aliases = ARRAY(
        SELECT min(alias)
        FROM unnest(
          coalesce(definition.aliases, '{}')
          || seed.aliases
        ) alias
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
      content_confidence = seed.content_confidence,
      scoring_confidence = seed.scoring_confidence,
      media_confidence = 55,
      movement_patterns = CASE
        WHEN seed.identity_status = 'identity_quarantine'
          THEN ARRAY['push']::TEXT[]
        ELSE ARRAY['push','brace']::TEXT[]
      END,
      body_regions = seed.body_regions,
      required_equipment = ARRAY['landmine','barbell']::TEXT[],
      optional_equipment = ARRAY['plates']::TEXT[],
      anatomy_json = seed.anatomy_json,
      environment_json = seed.environment_json,
      population_json = seed.population_json,
      athlete_support_json = seed.athlete_support_json,
      coach_support_json = seed.coach_support_json,
      support_operations_json = jsonb_build_object(
        'supportSummary',
          CASE
            WHEN seed.identity_status = 'identity_quarantine'
              THEN 'Do not expose this card to workout selection. Route identity, media, graph, calibration, and publication questions to human review.'
            ELSE 'Count only repetitions that preserve the exact equipment, base, side, rack, path, range, tempo, quality, controlled return, and planned set-down.'
          END,
        'issueCategories', jsonb_build_array(
          'identity_or_variant',
          'difficulty_or_dose',
          'equipment_or_environment',
          'symptom_or_population_constraint',
          'instruction_or_accessibility',
          'media_exact_match',
          'relationship',
          'calibration'
        ),
        'supportEscalation', jsonb_build_object(
          'urgent', jsonb_build_array(
            'dropped_bar_or_plate',
            'acute_injury',
            'neurologic_or_cardiovascular_symptom'
          ),
          'coachReview', jsonb_build_array(
            'repeated_base_brace_wrist_path_or_return_fault',
            'meaningful_side_difference',
            'unclear_load_range_tempo_or_set_down'
          ),
          'equipmentReview', jsonb_build_array(
            'anchor_bar_collar_or_plate_movement_or_damage'
          ),
          'contentReview', jsonb_build_array(
            'identity_boundary_conflict',
            'media_mismatch',
            'missing_accessibility_or_stop_rule'
          )
        ),
        'knownLimitations', jsonb_build_array(
          'candidate_media_not_human_viewed',
          'no_universal_load_range_dose_or_recovery',
          'scores_edges_calibrations_and_cards_are_unapproved_proposals'
        ),
        'changeImpactPolicy',
          'Changes to base, orientation, laterality, hand count, rack, path, rotation, terminal action, difficulty, dose, stop rule, relationship, or media require a new card version and renewed affected reviews.'
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
          'five_oembed_healthy_candidates_require_full_human_review',
        'difficultyModel',
          'max_exercise_complexity_physical_difficulty',
        'identityState', seed.identity_status,
        'humanReviewRequired', TRUE,
        'publicationQuarantined', TRUE,
        'operationalSupportReviewRequired', TRUE,
        'mediaApprovalCreated', FALSE,
        'graphApprovalCreated', FALSE,
        'calibrationApprovalCreated', FALSE
      ),
      updated_at = now()
  FROM one_arm_landmine_card_seed seed
  WHERE definition.facility_id = 1
    AND definition.slug = seed.slug
    AND definition.status <> 'archived';

  CREATE TEMP TABLE one_arm_landmine_variant_seed (
    slug TEXT NOT NULL,
    variant_key TEXT NOT NULL,
    display_name TEXT NOT NULL,
    base TEXT NOT NULL,
    orientation TEXT NOT NULL,
    side_relationship TEXT NOT NULL,
    complexity SMALLINT NOT NULL,
    physical SMALLINT NOT NULL,
    coordination SMALLINT NOT NULL,
    supervision SMALLINT NOT NULL,
    consequence SMALLINT NOT NULL,
    local_fatigue SMALLINT NOT NULL,
    grip_fatigue SMALLINT NOT NULL,
    technical_fatigue SMALLINT NOT NULL,
    recovery_hours SMALLINT NOT NULL,
    selectable BOOLEAN NOT NULL,
    PRIMARY KEY (slug, variant_key)
  ) ON COMMIT DROP;

  INSERT INTO one_arm_landmine_variant_seed VALUES
    (
      'half-kneeling-one-arm-landmine-press',
      'working-arm-ipsilateral-to-down-knee-strict',
      'Half-Kneeling Landmine Press — Working Arm Ipsilateral to Down Knee',
      'half_kneeling',
      'upright',
      'working_arm_ipsilateral_to_down_knee',
      48,46,50,42,44,48,44,54,36,TRUE
    ),
    (
      'half-kneeling-one-arm-landmine-press',
      'working-arm-contralateral-to-down-knee-strict',
      'Half-Kneeling Landmine Press — Working Arm Contralateral to Down Knee',
      'half_kneeling',
      'upright',
      'working_arm_contralateral_to_down_knee',
      50,46,52,44,44,48,44,56,36,TRUE
    ),
    (
      'tall-kneeling-one-arm-landmine-press',
      'single-arm-tall-kneeling-sleeve-grip-strict',
      'Single-Arm Tall-Kneeling Landmine Press',
      'tall_kneeling',
      'upright',
      'symmetric_bilateral_knee_base',
      50,46,52,44,46,48,44,56,36,TRUE
    ),
    (
      'one-arm-landmine-floor-press',
      'single-arm-supine-floor-supported-strict',
      'Single-Arm Supine Landmine Floor Press',
      'supine_floor_supported',
      'supine',
      'unilateral_working_side',
      44,52,44,48,48,52,48,50,48,TRUE
    ),
    (
      'one-arm-landmine-z-press',
      'single-arm-long-sit-legs-together-strict',
      'Single-Arm Long-Sit Landmine Z-Press — Legs Together',
      'long_sit_legs_together',
      'upright_floor_seated',
      'unilateral_working_side',
      52,46,52,46,46,48,44,56,36,TRUE
    ),
    (
      'one-arm-landmine-z-press',
      'single-arm-long-sit-straddle-strict',
      'Single-Arm Long-Sit Landmine Z-Press — Straddle',
      'long_sit_straddle',
      'upright_floor_seated',
      'unilateral_working_side',
      50,46,50,46,46,48,44,54,36,TRUE
    ),
    (
      'one-arm-landmine-arc-press',
      'identity-review-only',
      'Landmine Arc Press — Identity Review Only',
      'pending_human_review',
      'pending_human_review',
      'pending_human_review',
      54,42,54,60,48,42,42,60,48,FALSE
    );

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
      seed.base,
      seed.orientation,
      seed.side_relationship,
      'one_hand',
      'barbell_sleeve',
      'same_side_shoulder_rack',
      CASE
        WHEN seed.selectable THEN 'strict_no_leg_drive_or_rotation'
        ELSE 'identity_review_required'
      END
    ]::TEXT[],
    jsonb_build_object(
      'technicalComplexity', seed.complexity,
      'absoluteLoadDemand', seed.physical,
      'baseOverallDifficulty',
        greatest(seed.complexity, seed.physical),
      'coordinationDemand', seed.coordination,
      'supervisionDemand', seed.supervision,
      'failureConsequence', seed.consequence,
      'impact', 1,
      'workCapacityDemand', seed.local_fatigue,
      'difficultyModel',
        'max_exercise_complexity_physical_difficulty',
      'dimensionMeaning', jsonb_build_object(
        'technicalComplexity', 'exercise_complexity',
        'absoluteLoadDemand', 'physical_difficulty'
      ),
      'provisional', NOT seed.selectable
    ),
    jsonb_build_object(
      'selectable', seed.selectable,
      'base', seed.base,
      'bodyOrientation', seed.orientation,
      'laterality', 'unilateral',
      'handCount', 1,
      'sideRelationship', seed.side_relationship,
      'attachment', 'barbell_sleeve',
      'grip', 'cupped_sleeve_neutral_wrist',
      'rack', 'same_side_shoulder',
      'anchor', 'rated_fixed_landmine_pivot',
      'path', CASE
        WHEN seed.selectable
          THEN 'declared_fixed_pivot_press_arc'
        ELSE 'pending_human_identity_review'
      END,
      'intent', CASE
        WHEN seed.selectable
          THEN 'strict_no_deliberate_leg_drive_or_rotation'
        ELSE 'review_only_no_athlete_prescription'
      END,
      'range', CASE
        WHEN seed.selectable
          THEN 'declared_owned_range_to_controlled_finish'
        ELSE 'pending_human_identity_review'
      END,
      'tempo', CASE
        WHEN seed.selectable
          THEN 'controlled_concentric_and_lowering'
        ELSE 'not_assignable'
      END,
      'terminalAction', CASE
        WHEN seed.selectable
          THEN 'controlled_return_to_same_rack'
        ELSE 'not_assignable'
      END,
      'sideBalanceRequired', seed.selectable,
      'pickupTransferSetDownMustBeDeclared', TRUE,
      'identityQuarantine', NOT seed.selectable
    ),
    'review',
    jsonb_build_object(
      'externalLoadMethod', 'landmine_barbell',
      'externalLoadDescription',
        'barbell and declared plate mass rotating around a rated fixed pivot',
      'effectiveLoadDrivers', jsonb_build_array(
        'bar_mass',
        'plate_mass',
        'plate_position',
        'bar_angle',
        'athlete_distance_from_pivot',
        'base',
        'orientation',
        'range',
        'tempo',
        'repetitions'
      ),
      'gripDemand', seed.grip_fatigue,
      'spinalLoading', CASE
        WHEN seed.orientation = 'supine' THEN 20
        ELSE 34
      END,
      'eccentricStress', 38,
      'landingContactsPerRep', 0,
      'impactClass', 'none',
      'loadTracking', jsonb_build_array(
        'bar_type',
        'plate_mass',
        'base',
        'orientation',
        'working_side',
        'rack',
        'range',
        'tempo',
        'repetitions'
      )
    ),
    jsonb_build_object(
      'localMuscleFatigue', seed.local_fatigue,
      'gripFatigue', seed.grip_fatigue,
      'technicalFatigueSensitivity', seed.technical_fatigue,
      'impactAccumulation', 1,
      'recoveryHours', seed.recovery_hours,
      'primaryFatigueSites', CASE
        WHEN seed.selectable THEN jsonb_build_array(
          'anterior_shoulder_or_chest',
          'triceps',
          'scapular_stabilizers',
          'grip_and_forearm',
          'trunk_and_base_stabilizers'
        )
        ELSE jsonb_build_array('pending_exact_identity_review')
      END,
      'earlyFatigueSignals', CASE
        WHEN seed.selectable THEN jsonb_build_array(
          'base_or_orientation_change',
          'rib_pelvis_or_trunk_change',
          'wrist_or_grip_change',
          'path_or_range_change',
          'uncontrolled_return_or_set_down'
        )
        ELSE jsonb_build_array('any_delivery_is_prohibited')
      END,
      'downstreamConflicts', CASE
        WHEN seed.selectable THEN jsonb_build_array(
          'heavy_overhead_or_horizontal_pressing',
          'high_velocity_throwing_or_hitting',
          'contact_training',
          'grip_intensive_training'
        )
        ELSE jsonb_build_array('all_budgets_pending_identity_review')
      END
    ),
    jsonb_build_object(
      'selectionStatus', CASE
        WHEN seed.selectable THEN 'candidate_requires_human_review'
        ELSE 'blocked_pending_identity_review'
      END,
      'primaryIntent', CASE
        WHEN seed.selectable
          THEN 'strict_controlled_landmine_press_strength'
        ELSE 'identity_review_only'
      END,
      'appropriatePhases', CASE
        WHEN seed.selectable
          THEN jsonb_build_array('movement_intelligence','capacity')
        ELSE '[]'::JSONB
      END,
      'avoidUse', CASE
        WHEN seed.selectable THEN jsonb_build_array(
          'untracked_leg_drive_or_rotation',
          'conditioning_race',
          'uncontrolled_to_failure',
          'fatigue_degraded_path_or_return',
          'symptom_provocation'
        )
        ELSE jsonb_build_array('all_athlete_workout_generation')
      END,
      'cumulativeBudget', CASE
        WHEN seed.selectable THEN jsonb_build_object(
          'landminePressStrengthSets', 1,
          'shoulderChestTricepsLoad', seed.local_fatigue,
          'gripStress', seed.grip_fatigue,
          'technicalSensitivity', seed.technical_fatigue,
          'impact', 1
        )
        ELSE jsonb_build_object(
          'countInWorkout', FALSE
        )
      END
    )
  FROM one_arm_landmine_variant_seed seed
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
      WHEN 'capacity-strict-strength'
        THEN 'Build repeatable strict landmine pressing strength while preserving the exact base, orientation, side, rack, path, range, return, and set-down.'
      ELSE 'Practice secure setup, exact base, an owned fixed-pivot press path, controlled finish, return, transfer, and set-down at low fatigue.'
    END,
    CASE profile.profile_key
      WHEN 'capacity-strict-strength' THEN 88
      ELSE 90
    END,
    90,
    jsonb_build_object(
      'strictLandminePressStrength', 90,
      'baseAndPathControl', seed.coordination,
      'lowImpact', 100,
      'fatigueCost', seed.local_fatigue
    ),
    CASE profile.profile_key
      WHEN 'capacity-strict-strength' THEN jsonb_build_object(
        'sets', jsonb_build_array(2, 5),
        'repsPerSide', jsonb_build_array(4, 10),
        'rpe', jsonb_build_array(5, 8),
        'restSeconds', jsonb_build_array(90, 240),
        'tempo', 'controlled_lowering_with_deliberate_reset',
        'stopBeforeFailure', TRUE
      )
      ELSE jsonb_build_object(
        'sets', jsonb_build_array(2, 4),
        'repsPerSide', jsonb_build_array(3, 6),
        'rpe', jsonb_build_array(3, 6),
        'restSeconds', jsonb_build_array(60, 180),
        'tempo', 'deliberate_press_pause_and_return',
        'stopBeforeFailure', TRUE
      )
    END,
    'Every counted repetition preserves secure equipment, the exact base and orientation, declared side and rack, stacked wrist, organized trunk, owned path and range, controlled finish and return, and safe transfer or set-down.',
    ARRAY[
      'Stop for pain, neurologic symptoms, dizziness, or unusual breathlessness.',
      'Stop if the anchor, collar, plate, bar, floor, or clearance becomes unsafe.',
      'Stop if base, orientation, side relationship, pelvis, ribs, wrist, path, range, or return changes.',
      'Stop if deliberate leg drive, rotation, bridging, reclining, grinding, or an unsafe transfer appears.',
      'Stop if a person or object enters the moving bar and plate zone.'
    ]::TEXT[],
    'Inspect equipment and clearance; name the exact variant and dose; observe the base, side, rack, wrist, elbow, scapula, trunk, fixed-pivot path, range, return, symptoms, fatigue, transfer, and set-down; end the set before the contract changes.',
    'Set the exact base and working side, rack securely, brace, press through the declared fixed-pivot path without changing the base or adding momentum, own the finish, return under control, and stop for symptoms, equipment movement, or loss of control.',
    CASE profile.profile_key
      WHEN 'capacity-strict-strength'
        THEN 'Greater repeatable landmine pressing force and volume tolerance with preserved equipment, base, path, trunk, grip, and return control.'
      ELSE 'More repeatable setup, base, rack, fixed-pivot path, finish, return, transfer, and set-down at low fatigue.'
    END,
    ARRAY['landmine','barbell','collars']::TEXT[],
    jsonb_build_object(
      'stationFootprintMeters', jsonb_build_object(
        'length', 4,
        'width', 3
      ),
      'athletesPerStation', 1,
      'setupSeconds', CASE
        WHEN seed.orientation IN ('supine','upright_floor_seated')
          THEN 90
        ELSE 75
      END,
      'transitionSeconds', 30,
      'sideChangeSeconds', 20,
      'loadChangeRequiresStillBar', TRUE,
      'barArcExclusionZone', TRUE,
      'coachPosition', 'oblique_outside_bar_and_plate_path'
    ),
    ARRAY[]::UUID[],
    'review',
    jsonb_build_object(
      'secondsPerRep', CASE
        WHEN profile.profile_key = 'movement-intelligence-base-and-path'
          THEN 6
        ELSE 4
      END,
      'setupSeconds', CASE
        WHEN seed.orientation IN ('supine','upright_floor_seated')
          THEN 90
        ELSE 75
      END,
      'sideChangeSeconds', 20,
      'restSeconds', CASE
        WHEN profile.profile_key = 'capacity-strict-strength'
          THEN jsonb_build_array(90, 240)
        ELSE jsonb_build_array(60, 180)
      END
    ),
    jsonb_build_object(
      'regressions', jsonb_build_array(
        'remove_external_plates',
        'shorten_to_owned_range',
        'reduce_repetitions',
        'increase_rest',
        'choose_reviewed_alternate_base_or_press'
      ),
      'progressions', jsonb_build_array(
        'add_load_with_same_contract',
        'increase_owned_range',
        'increase_repetitions_with_same_quality'
      ),
      'neverScaleBy', jsonb_build_array(
        'equipment_movement',
        'base_or_orientation_change',
        'undeclared_momentum_or_rotation',
        'wrist_collapse',
        'changed_path',
        'uncontrolled_return',
        'symptoms'
      )
    ),
    jsonb_build_object(
      'record', jsonb_build_array(
        'variant_key',
        'working_side',
        'base',
        'orientation',
        'side_relationship',
        'rack',
        'load',
        'range',
        'tempo',
        'quality_repetitions',
        'rest',
        'symptoms',
        'stop_reason'
      ),
      'compareSides', TRUE,
      'qualityBeforeQuantity', TRUE
    ),
    jsonb_build_object(
      'athletePrompt',
        'Confirm exact base, side, rack, load, range, tempo, repetitions, rest, finish, return, transfer, and stop signal before starting.',
      'coachPrompt',
        'Verify equipment and the exclusion zone first; count only repetitions that preserve the exact card and variant contract.',
      'supportPrompt',
        'Retain card version and exact variant; never silently substitute standing, kneeling, seated, supine, strict, driven, rotational, or release mechanics.',
      'accessibilityPrompt',
        'Offer lighter load, shorter owned range, fewer repetitions, longer rest, a reviewed substitution, and written, still-image, audio, tactile, or live instruction.'
    )
  FROM one_arm_landmine_variant_seed seed
  JOIN coaching.exercise_definition_v1 definition
    ON definition.facility_id = 1
   AND definition.slug = seed.slug
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id = definition.id
   AND variant.variant_key = seed.variant_key
  CROSS JOIN (
    VALUES
      ('capacity-strict-strength','capacity'),
      ('movement-intelligence-base-and-path','movement_intelligence')
  ) AS profile(profile_key, phase_key)
  WHERE seed.selectable IS TRUE
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
    'review-only-no-prescription',
    'prepare_and_access',
    'avoid',
    'Retain the unresolved source label for qualified identity review without producing an athlete workout prescription.',
    1,
    100,
    jsonb_build_object(
      'identityReview', 100,
      'athleteDelivery', 0
    ),
    jsonb_build_object(
      'selectionStatus', 'blocked_pending_identity_review',
      'sets', jsonb_build_array(0, 0),
      'reps', jsonb_build_array(0, 0),
      'athletePrescription', FALSE
    ),
    'No athlete delivery occurs. A qualified reviewer documents base, hand count, rack, path landmarks, endpoint, rotation, return, equipment, failure strategy, and identity boundary.',
    ARRAY[
      'Do not generate, schedule, coach, demonstrate as approved, or deliver this card.',
      'Retain quarantine if any identity-defining fact remains unresolved.'
    ]::TEXT[],
    'Compare complete source demonstrations against strict landmine press, bilateral side-to-side arc, rotational press, and eccentric-tempo press before changing identity.',
    'This card is unavailable for athlete selection or self-guided execution.',
    'A documented human identity decision and a new reviewed card version.',
    ARRAY['landmine','barbell']::TEXT[],
    jsonb_build_object(
      'athletesPerStation', 0,
      'humanReviewerRequired', TRUE,
      'workoutSelectionBlocked', TRUE
    ),
    ARRAY[]::UUID[],
    'review',
    jsonb_build_object(
      'athleteWorkSeconds', 0,
      'reviewDurationMinutes', jsonb_build_array(15, 60)
    ),
    jsonb_build_object(
      'regressions', jsonb_build_array(),
      'progressions', jsonb_build_array(),
      'neverScaleBy', jsonb_build_array('bypassing_identity_review')
    ),
    jsonb_build_object(
      'record', jsonb_build_array(
        'reviewer',
        'reviewed_sources',
        'observed_contract',
        'identity_decision',
        'affected_cards'
      ),
      'athleteMetricsProhibited', TRUE
    ),
    jsonb_build_object(
      'athletePrompt', 'This card is quarantined and cannot be selected.',
      'coachPrompt', 'Complete the identity review before any prescription.',
      'supportPrompt', 'Route to exercise-library identity review.',
      'accessibilityPrompt', 'Offer a reviewed exact alternative.'
    )
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id = definition.id
   AND variant.variant_key = 'identity-review-only'
  WHERE definition.facility_id = 1
    AND definition.slug = 'one-arm-landmine-arc-press'
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

  CREATE TEMP TABLE one_arm_landmine_evidence_seed (
    section_key TEXT PRIMARY KEY,
    source_url TEXT NOT NULL,
    source_title TEXT NOT NULL,
    source_publisher TEXT NOT NULL,
    source_kind TEXT NOT NULL,
    evidence_quality SMALLINT NOT NULL,
    claims_json JSONB NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO one_arm_landmine_evidence_seed VALUES
    (
      'identity',
      'https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/',
      'The Landmine Press—Implementation and Variation',
      'National Strength and Conditioning Association',
      'professional_standard',
      84,
      '["NSCA describes a barbell press from a stable pivoting landmine base and distinct implementation variations.","The card must declare body orientation, support base, hand count, side, rack, strict intent, path, finish, and return."]'::JSONB
    ),
    (
      'taxonomy',
      'https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/',
      'The Landmine Press—Implementation and Variation',
      'National Strength and Conditioning Association',
      'professional_standard',
      84,
      '["The family is an anchored angled push with elbow extension, controlled shoulder and scapular motion, grip stabilization, and trunk control.","Base, orientation, deliberate drive, rotation, release, contact surface, attachment, range, tempo, load, rest, and side dose remain explicit dimensions."]'::JSONB
    ),
    (
      'anatomy',
      'https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/',
      'The Landmine Press—Implementation and Variation',
      'National Strength and Conditioning Association',
      'professional_standard',
      84,
      '["Landmine pressing loads shoulder press musculature and elbow extensors while the scapular complex, rotator cuff, trunk, grip, and declared base stabilize the path.","Anatomy claims are task descriptions, not isolation, treatment, or universal activation claims."]'::JSONB
    ),
    (
      'biomechanics',
      'https://pubmed.ncbi.nlm.nih.gov/41755100/',
      'Landmine Press Kinematics Measured with an Enhanced YOLOv8 Model and Mathematical Modeling',
      'Sensors',
      'peer_reviewed_research',
      86,
      '["The free bar end moves about a fixed pivot, so start position, pivot distance, body position, range, and external load affect observed kinematics.","Observable gates include a secure anchor, stable exact base, repeatable rack, wrist stack, organized trunk, controlled path, owned finish, and return."]'::JSONB
    ),
    (
      'difficulty',
      'https://pubmed.ncbi.nlm.nih.gov/41755100/',
      'Landmine Press Kinematics Measured with an Enhanced YOLOv8 Model and Mathematical Modeling',
      'Sensors',
      'peer_reviewed_research',
      86,
      '["Landmine-press kinematics change across external loads and task configurations.","Exercise complexity and physical difficulty are assessed independently for each exact variant; overall equals their maximum."]'::JSONB
    ),
    (
      'load_fatigue_recovery',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/',
      'American College of Sports Medicine Position Stand. Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews',
      'Medicine and Science in Sports and Exercise',
      'professional_standard',
      96,
      '["Resistance-training stimulus and fatigue depend on load, volume, effort, exercise selection, frequency, and progression.","The exact card contributes press, shoulder, chest, triceps, scapular, grip, trunk, base, eccentric, and technical budgets with no planned impact."]'::JSONB
    ),
    (
      'constraints',
      'https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/',
      'The Landmine Press—Implementation and Variation',
      'National Strength and Conditioning Association',
      'professional_standard',
      84,
      '["Landmine pressing requires a stable anchor, compatible barbell and loading hardware, and clear space for the complete bar path and set-down.","Floor, padding, body orientation, base, side, rack, range, pickup, transfer, set-down, sightline, and the moving-sleeve exclusion zone must be declared."]'::JSONB
    ),
    (
      'dosage',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC10579494/',
      'Resistance training prescription for muscle strength and hypertrophy in healthy adults: a systematic review and Bayesian network meta-analysis',
      'British Journal of Sports Medicine',
      'peer_reviewed_research',
      94,
      '["Resistance-training outcomes depend on the interaction of sets, repetitions, load, effort, frequency, and recovery rather than an exercise name alone.","Use exact-variant quality sets with enough rest to preserve equipment, base, rack, path, range, tempo, side balance, and safe return."]'::JSONB
    ),
    (
      'instructions',
      'https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/',
      'The Landmine Press—Implementation and Variation',
      'National Strength and Conditioning Association',
      'professional_standard',
      84,
      '["Instruction must establish anchor, clearance, body position, base, side, rack, brace, press path, finish, controlled return, and safe set-down.","The athlete and coach must know which exact repetition counts and how a failed repetition is returned safely."]'::JSONB
    ),
    (
      'safety_stop_rules',
      'https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf',
      'Youth Resistance Training: Updated Position Statement Paper From the NSCA',
      'National Strength and Conditioning Association',
      'professional_standard',
      88,
      '["Qualified supervision, manageable resistance, correct technique, appropriate equipment, and gradual progression are core safeguards.","Stop for symptoms, unsafe equipment, lost base, wrist collapse, uncontrolled path or return, grinding, dropped load, collision risk, or inability to execute the planned set-down."]'::JSONB
    ),
    (
      'programming',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/',
      'American College of Sports Medicine Position Stand. Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews',
      'Medicine and Science in Sports and Exercise',
      'professional_standard',
      96,
      '["Exercise selection and resistance-training dose should be individualized to intended adaptation, capacity, and recovery.","Place exact landmine press variants before material pressing, throwing, contact, grip, or high-velocity fatigue when path quality is the priority."]'::JSONB
    ),
    (
      'athlete_support',
      'https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/',
      'The Landmine Press—Implementation and Variation',
      'National Strength and Conditioning Association',
      'professional_standard',
      84,
      '["The athlete needs the exact body position, base, side, rack, load, range, tempo, repetitions, rest, side sequence, and stop signal.","A lighter load, shorter owned range, or reviewed substitution is preferable to changing the base, adding momentum, rotating, losing the rack, or controlling an unsafe return."]'::JSONB
    ),
    (
      'coach_support',
      'https://pubmed.ncbi.nlm.nih.gov/41755100/',
      'Landmine Press Kinematics Measured with an Enhanced YOLOv8 Model and Mathematical Modeling',
      'Sensors',
      'peer_reviewed_research',
      86,
      '["The fixed pivot and moving bar end give coaches observable setup, path, range, intent, and finish checkpoints.","Coach support should expose equipment, base, side, rack, wrist, elbow, scapula, trunk, path, range, tempo, dose, symptoms, fatigue, side balance, and set-down."]'::JSONB
    ),
    (
      'accessibility',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/',
      'American College of Sports Medicine Position Stand. Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews',
      'Medicine and Science in Sports and Exercise',
      'professional_standard',
      96,
      '["Resistance exercise can be individualized through load, volume, range, effort, equipment, and progression while preserving the movement contract.","Options include lighter load, fewer repetitions, longer rest, a reviewed alternate base or press, written or audio cues, still images, tactile markers, and live instruction."]'::JSONB
    ),
    (
      'alternates',
      'https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/',
      'The Landmine Press—Implementation and Variation',
      'National Strength and Conditioning Association',
      'professional_standard',
      84,
      '["Side relationship, leg position, range, tempo, and load may be variants or modifiers when the exact base and strict press remain unchanged.","Standing, kneeling, long-sitting, supine, driven, rotational, and release tasks cannot be silently substituted."]'::JSONB
    ),
    (
      'media',
      'https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en',
      'Embed videos and playlists',
      'YouTube Help',
      'manufacturer_instruction',
      82,
      '["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","Five candidates returned public oEmbed metadata on 2026-07-27; playback, exact variant, safety, captions, accessibility, quality, reviewer, and approval remain unresolved."]'::JSONB
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
  CROSS JOIN one_arm_landmine_evidence_seed evidence
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
    review_status
  )
  SELECT
    definition.id,
    definition.card_version,
    override.section_key,
    override.source_url,
    override.source_title,
    override.source_publisher,
    override.source_kind,
    override.claims_json,
    override.evidence_quality,
    'candidate'
  FROM coaching.exercise_definition_v1 definition
  JOIN (
    VALUES
      (
        'one-arm-landmine-floor-press',
        'biomechanics',
        'https://pubmed.ncbi.nlm.nih.gov/31827348/',
        'Range of Motion and Sticking Region Effects on the Bench Press Load-Velocity Relationship',
        'Journal of Sports Science & Medicine',
        'peer_reviewed_research',
        88,
        '["Bench-press range of motion changes load-velocity behavior, attainable load, braking, and sticking-region behavior.","The landmine floor press must declare supine orientation, floor contact, upper-arm boundary, rack, pivot relationship, range, and handoff."]'::JSONB
      ),
      (
        'one-arm-landmine-floor-press',
        'difficulty',
        'https://pubmed.ncbi.nlm.nih.gov/31827348/',
        'Range of Motion and Sticking Region Effects on the Bench Press Load-Velocity Relationship',
        'Journal of Sports Science & Medicine',
        'peer_reviewed_research',
        88,
        '["A shorter press range can support different external loads and kinematics, while an offset pivot and unilateral setup add transfer and anti-rotation demands.","Exercise complexity and physical difficulty remain separate; overall equals their maximum."]'::JSONB
      ),
      (
        'one-arm-landmine-arc-press',
        'identity',
        'https://platform.instituteofmotion.com/library/activity/r59tleo2/share/',
        'Arc Press – Landmine',
        'Institute of Motion',
        'expert_instruction',
        68,
        '["Institute of Motion publishes an Arc Press – Landmine push entry and embeds a video titled for half-kneeling and tall-kneeling arc presses.","The public entry does not declare hand count, rack, endpoint, path landmarks, stance-side relationship, rotation policy, or distinction from a standard press; identity remains quarantined."]'::JSONB
      ),
      (
        'one-arm-landmine-arc-press',
        'taxonomy',
        'https://www.nifs.org/blog/shouldering-the-load-safe-alternatives-to-the-overhead-press-pattern',
        'Shouldering the Load: Safe Alternatives to the Overhead Press Pattern',
        'National Institute for Fitness and Sport',
        'expert_instruction',
        66,
        '["NIFS lists Landmine Press and Landmine Arc Press separately and lists half-kneeling and standing bases for both.","The listing supports a possible distinct label but does not supply the missing movement contract required for safe taxonomy."]'::JSONB
      ),
      (
        'one-arm-landmine-arc-press',
        'alternates',
        'https://platform.instituteofmotion.com/library/activity/r59tleo2/share/',
        'Arc Press – Landmine',
        'Institute of Motion',
        'expert_instruction',
        68,
        '["The public activity title mentions half-kneeling and tall-kneeling versions, while public candidates also use standing and bilateral side-to-side terminology.","Each base and path remains provisional until a reviewer confirms hand count, start, path, endpoint, rotation, and return."]'::JSONB
      )
  ) AS override(
    slug,
    section_key,
    source_url,
    source_title,
    source_publisher,
    source_kind,
    evidence_quality,
    claims_json
  )
    ON override.slug = definition.slug
  WHERE definition.facility_id = 1
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

  CREATE TEMP TABLE one_arm_landmine_media_seed (
    slug TEXT NOT NULL,
    video_id TEXT NOT NULL,
    title TEXT NOT NULL,
    channel_name TEXT NOT NULL,
    source_query TEXT NOT NULL,
    notes TEXT NOT NULL,
    PRIMARY KEY (slug, video_id)
  ) ON COMMIT DROP;

  INSERT INTO one_arm_landmine_media_seed VALUES
    ('half-kneeling-one-arm-landmine-press','_ArzG9qz-yM','HighPerformanceHandbook.com: Half-Kneeling 1-arm Landmine Press','Eric Cressey','half kneeling one arm landmine press','oEmbed metadata responded. Playback, exact down-knee relationship, cues, safety, captions, accessibility, quality, reviewer, and approval remain pending.'),
    ('half-kneeling-one-arm-landmine-press','ff570MqDskM','Half-Kneeling Single-Arm Landmine Press','Synchronicity Health','half kneeling single arm landmine press','oEmbed metadata responded; all content and exact-variant review gates remain pending.'),
    ('half-kneeling-one-arm-landmine-press','fx6lSVNvu-4','Half Kneeling Landmine Press','The Active Life','half kneeling landmine press','oEmbed metadata responded; all content and exact-variant review gates remain pending.'),
    ('half-kneeling-one-arm-landmine-press','PY9HorHANhc','How To PROPERLY Half Kneeling Landmine Press For Muscle Gain','Colossus Fitness','half kneeling landmine press technique','oEmbed metadata responded; all content and exact-variant review gates remain pending.'),
    ('half-kneeling-one-arm-landmine-press','JH_L7Itnv9s','Half Kneeling Landmine Contralateral Single Arm Press','Marcus Filly','half kneeling contralateral landmine press','oEmbed metadata responded. The title suggests a side relationship, but playback and exact-contract review remain pending.'),
    ('tall-kneeling-one-arm-landmine-press','BKDzLILFURM','Tall Kneeling Single Arm Landmine Press','E3 Rehab Exercise Library','tall kneeling single arm landmine press','oEmbed metadata responded; playback and all content review gates remain pending.'),
    ('tall-kneeling-one-arm-landmine-press','wWoh6U4GM9E','Tall-Kneeling 1-Arm Landmine Press','Testosterone Nation','tall kneeling one arm landmine press','oEmbed metadata responded; playback and all content review gates remain pending.'),
    ('tall-kneeling-one-arm-landmine-press','XII-q5TDV1Y','Tall Kneeling Landmine Single Arm Press','Joe''s Basecamp','tall kneeling landmine single arm press','oEmbed metadata responded; playback and all content review gates remain pending.'),
    ('tall-kneeling-one-arm-landmine-press','HxYvSFwiywA','Tall kneeling Single Arm Landmine Press','The Fitness Life - Strength & Lifestyle Coaching','tall kneeling single arm landmine press','oEmbed metadata responded; playback and all content review gates remain pending.'),
    ('tall-kneeling-one-arm-landmine-press','ZQBaGzoe3P0','Landmine Tall Kneeling One-Arm Press','Testosterone Nation','landmine tall kneeling one arm press','oEmbed metadata responded; playback and all content review gates remain pending.'),
    ('one-arm-landmine-floor-press','hiMe9Fu8Ha8','One arm landmine floor press','IFBB PRO AMIT SAPIR','one arm landmine floor press','oEmbed metadata responded; playback, exact setup, content, and approval review remain pending.'),
    ('one-arm-landmine-floor-press','fWNMECX7FE4','Landmine Single Arm Floor Press','Functional Effect Fitness & Rehabilitation','landmine single arm floor press','oEmbed metadata responded; playback, exact setup, content, and approval review remain pending.'),
    ('one-arm-landmine-floor-press','fw_4FpH96Nw','Landmine 1 Arm Floor Press','Ben Bruno','landmine one arm floor press','oEmbed metadata responded; playback, exact setup, content, and approval review remain pending.'),
    ('one-arm-landmine-floor-press','Nuz0uLSRhJQ','Single-arm Landmine Floor Press','Cliff''s Edge Performance','single arm landmine floor press','oEmbed metadata responded; playback, exact setup, content, and approval review remain pending.'),
    ('one-arm-landmine-floor-press','5L40EX6CpYI','Landmine Floor Press','Chris Butler Sports PT','landmine floor press','oEmbed metadata responded. Hand count is not explicit in the title; exact-variant review remains pending.'),
    ('one-arm-landmine-z-press','AXWAI6yTB-I','Landmine Single Arm Z-Press','Trident Physical Therapy','landmine single arm z press','oEmbed metadata responded; playback, exact leg position, content, and approval review remain pending.'),
    ('one-arm-landmine-z-press','gvZNdghXHTM','Landmine | Single Arm Z-Press','DRIVEN to MOVE with the Marvins','landmine single arm z press','oEmbed metadata responded; playback, exact leg position, content, and approval review remain pending.'),
    ('one-arm-landmine-z-press','j-l7fyv-LBk','Landmine Z Press','Functional Bodybuilding','landmine z press','oEmbed metadata responded. Hand count is not explicit in the title; exact-variant review remains pending.'),
    ('one-arm-landmine-z-press','ALlONsBGqT8','Single Arm Landmine Z Press','Branko Oktavec','single arm landmine z press','oEmbed metadata responded; playback, exact leg position, content, and approval review remain pending.'),
    ('one-arm-landmine-z-press','2XGv3QrU-n4','Landmine Single Arm Z Press','Mezzo Strength','landmine single arm z press','oEmbed metadata responded; playback, exact leg position, content, and approval review remain pending.'),
    ('one-arm-landmine-arc-press','JFwX9gJh8Fc','Landmine - Arc Press for shoulders (half-kneeling and tall-kneeling)','Brad Sims, CPT','landmine arc press shoulders','oEmbed metadata responded and Institute of Motion embeds this video. Playback, exact path, hand count, safety, quality, reviewer, and approval remain pending.'),
    ('one-arm-landmine-arc-press','o77Fevbmr2g','Standing Landmine OH Arc Press','Functional Effect Fitness & Rehabilitation','standing landmine arc press','oEmbed metadata responded. Title suggests standing but does not resolve the path contract; all review gates remain pending.'),
    ('one-arm-landmine-arc-press','SEFb24cdAZs','Unity Fitness - Landmine Arc Press','Jordan Rudolph','landmine arc press','oEmbed metadata responded; hand count, base, path, content, and approval review remain pending.'),
    ('one-arm-landmine-arc-press','KwQVonn3jeE','Landmine Arc Press (prenatal)','Karla Bosnar','landmine arc press','oEmbed metadata responded. This is population-specific and cannot support general selection without full population and safety review.'),
    ('one-arm-landmine-arc-press','Sgikteuhkkw','Landmine Arcs','Josh Kauten','landmine arcs','oEmbed metadata responded. The plural title may represent a bilateral side-to-side action; exact-match remains intentionally null.');

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
  FROM one_arm_landmine_media_seed media
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
    embedding_allowed = TRUE,
    exact_variant_match = NULL,
    demonstration_quality_score = NULL,
    link_status = 'healthy',
    review_status = 'candidate',
    discovery_method = 'manual_research',
    source_query = EXCLUDED.source_query,
    reviewer_user_id = NULL,
    reviewed_at = NULL,
    notes = EXCLUDED.notes,
    updated_at = now();

  CREATE TEMP TABLE one_arm_landmine_alternate_seed (
    slug TEXT NOT NULL,
    alternate_name TEXT NOT NULL,
    classification TEXT NOT NULL,
    rationale TEXT NOT NULL,
    dimensions JSONB NOT NULL,
    proposed_card JSONB,
    PRIMARY KEY (slug, alternate_name)
  ) ON COMMIT DROP;

  INSERT INTO one_arm_landmine_alternate_seed VALUES
    ('half-kneeling-one-arm-landmine-press','Working Arm Ipsilateral to Down Knee','new_variant','The working arm and down knee share a side; this fixes the lead-foot relationship and side dose while preserving the half-kneeling strict press.','{"variantKey":"working-arm-ipsilateral-to-down-knee-strict","workingArmToDownKnee":"ipsilateral"}'::JSONB,NULL),
    ('half-kneeling-one-arm-landmine-press','Working Arm Contralateral to Down Knee','new_variant','The working arm opposes the down knee; this changes cross-body stabilization and must be declared.','{"variantKey":"working-arm-contralateral-to-down-knee-strict","workingArmToDownKnee":"contralateral"}'::JSONB,NULL),
    ('half-kneeling-one-arm-landmine-press','Tall-Kneeling One-Arm Landmine Press','new_definition','Both knees down remove foot support and the lead-leg relationship, changing base, hip strategy, setup, and failure response.','{"existingSlug":"tall-kneeling-one-arm-landmine-press","base":"tall_kneeling"}'::JSONB,'{"status":"existing_definition_completed_separately"}'::JSONB),
    ('half-kneeling-one-arm-landmine-press','Standing One-Arm Landmine Press','new_definition','A two-foot standing base changes balance, lower-body contribution, pickup, load tolerance, and set-down.','{"existingSlug":"landmine-press","base":"standing"}'::JSONB,'{"status":"existing_definition_completed_separately"}'::JSONB),
    ('half-kneeling-one-arm-landmine-press','Half-Kneeling Landmine Push Press','new_definition','Deliberate hip or leg impulse changes action order and power intent; it is not a strict-press modifier.','{"primaryAction":"lower_body_impulse_to_press","intent":"ballistic"}'::JSONB,'{"status":"proposal_only_human_review_required"}'::JSONB),
    ('half-kneeling-one-arm-landmine-press','Tempo or Partial-Range Half-Kneeling Press','modifier_annotation','Tempo and range change dose and difficulty but not identity when the exact side relationship and strict press remain fixed.','{"modifiers":["tempo","range"]}'::JSONB,NULL),
    ('tall-kneeling-one-arm-landmine-press','Single-Arm Tall-Kneeling Landmine Press','new_variant','A declared working hand and side dose define the unilateral baseline.','{"variantKey":"single-arm-tall-kneeling-sleeve-grip-strict","handCount":1}'::JSONB,NULL),
    ('tall-kneeling-one-arm-landmine-press','Two-Hand Tall-Kneeling Landmine Press','new_variant','Two-hand central support changes symmetry, rack, and load handling while preserving the tall-kneeling strict press.','{"variantKey":"proposed-two-hand-tall-kneeling-strict","handCount":2,"reviewGate":"identity_and_setup_review"}'::JSONB,NULL),
    ('tall-kneeling-one-arm-landmine-press','Toes Tucked or Plantar-Flexed Tall Kneeling','modifier_annotation','Foot position changes contact and comfort but not identity when knees, hips, trunk, rack, and path remain fixed.','{"modifier":"foot_position"}'::JSONB,NULL),
    ('tall-kneeling-one-arm-landmine-press','Half-Kneeling One-Arm Landmine Press','new_definition','One foot forward creates an asymmetric base and working-arm-to-knee relationship.','{"existingSlug":"half-kneeling-one-arm-landmine-press","base":"half_kneeling"}'::JSONB,'{"status":"existing_definition_completed_separately"}'::JSONB),
    ('tall-kneeling-one-arm-landmine-press','Tall-Kneeling Landmine Push Press','new_definition','A deliberate hip impulse changes action order, velocity intent, fatigue, and failure response.','{"primaryAction":"hip_impulse_to_press","intent":"ballistic"}'::JSONB,'{"status":"proposal_only_human_review_required"}'::JSONB),
    ('tall-kneeling-one-arm-landmine-press','Tempo or Partial-Range Tall-Kneeling Press','modifier_annotation','Tempo and range change dose while preserving the declared base and strict press.','{"modifiers":["tempo","range"]}'::JSONB,NULL),
    ('one-arm-landmine-floor-press','Single-Arm Supine Landmine Floor Press','new_variant','The unilateral strict floor-supported contract is the exact baseline and requires side dosing.','{"variantKey":"single-arm-supine-floor-supported-strict","handCount":1}'::JSONB,NULL),
    ('one-arm-landmine-floor-press','Two-Hand Supine Landmine Floor Press','new_variant','Two-hand support changes symmetry, rack, face clearance, and loading while preserving the supine floor boundary.','{"variantKey":"proposed-two-hand-supine-floor-supported-strict","handCount":2,"reviewGate":"identity_and_clearance_review"}'::JSONB,NULL),
    ('one-arm-landmine-floor-press','Bridged Landmine Floor Press','new_variant','A maintained hip bridge changes support base, lower-body contribution, trunk demand, range relationship, and stop rules.','{"variantKey":"proposed-single-arm-supine-bridge-floor-press","bridge":true}'::JSONB,NULL),
    ('one-arm-landmine-floor-press','Landmine Bench Press','new_definition','A bench removes the upper-arm floor boundary and changes shoulder range, setup height, spotting, and failure strategy.','{"existingSlug":"landmine-bench-press","supportSurface":"bench"}'::JSONB,'{"status":"existing_definition_requires_separate_completion"}'::JSONB),
    ('one-arm-landmine-floor-press','One-Arm Landmine Z-Press','new_definition','An upright long-sit base and angled shoulder press differ in orientation, range, trunk demand, setup, and exit.','{"existingSlug":"one-arm-landmine-z-press","base":"long_sit"}'::JSONB,'{"status":"existing_definition_completed_separately"}'::JSONB),
    ('one-arm-landmine-floor-press','Tempo or Paused Landmine Floor Press','modifier_annotation','Tempo and pauses change dose but not identity when the supine base, range, and no-bridge contract remain fixed.','{"modifiers":["tempo","pause"]}'::JSONB,NULL),
    ('one-arm-landmine-z-press','Single-Arm Long-Sit Landmine Z-Press','new_variant','One hand, one shoulder rack, and per-side dose define the unilateral baseline.','{"variantKey":"single-arm-long-sit-legs-together-strict","handCount":1}'::JSONB,NULL),
    ('one-arm-landmine-z-press','Single-Arm Straddle Landmine Z-Press','new_variant','A declared straddle changes base width and pelvic and hamstring constraints while preserving the upright floor-seated strict press.','{"variantKey":"single-arm-long-sit-straddle-strict","legPosition":"straddle"}'::JSONB,NULL),
    ('one-arm-landmine-z-press','Two-Hand Landmine Z-Press','new_variant','Two-hand support changes symmetry, rack, and load handling while preserving the long-sit strict press.','{"variantKey":"proposed-two-hand-long-sit-strict","handCount":2,"reviewGate":"identity_and_setup_review"}'::JSONB,NULL),
    ('one-arm-landmine-z-press','Tall-Kneeling One-Arm Landmine Press','new_definition','Tall kneeling changes floor contacts, hip position, mobility constraints, setup, and failure response.','{"existingSlug":"tall-kneeling-one-arm-landmine-press","base":"tall_kneeling"}'::JSONB,'{"status":"existing_definition_completed_separately"}'::JSONB),
    ('one-arm-landmine-z-press','One-Arm Landmine Floor Press','new_definition','Supine orientation and an upper-arm floor boundary change press direction, support, range, and exit.','{"existingSlug":"one-arm-landmine-floor-press","bodyOrientation":"supine"}'::JSONB,'{"status":"existing_definition_completed_separately"}'::JSONB),
    ('one-arm-landmine-z-press','Tempo or Partial-Range Landmine Z-Press','modifier_annotation','Tempo and range change dose while preserving the exact long-sit base and strict press.','{"modifiers":["tempo","range"]}'::JSONB,NULL),
    ('one-arm-landmine-arc-press','Half-Kneeling One-Arm Landmine Arc Press','new_variant','Provisional only if review confirms a repeatable arc action distinct from the standard half-kneeling press.','{"variantKey":"provisional-half-kneeling-arc-press","reviewGate":"exact_path_and_identity_pending"}'::JSONB,NULL),
    ('one-arm-landmine-arc-press','Tall-Kneeling One-Arm Landmine Arc Press','new_variant','Provisional only if review confirms the same distinct arc action from a tall-kneeling base.','{"variantKey":"provisional-tall-kneeling-arc-press","reviewGate":"exact_path_and_identity_pending"}'::JSONB,NULL),
    ('one-arm-landmine-arc-press','Standing One-Arm Landmine Arc Press','new_variant','Provisional only if review confirms the same distinct arc action from a declared standing stance.','{"variantKey":"provisional-standing-arc-press","reviewGate":"exact_path_and_identity_pending"}'::JSONB,NULL),
    ('one-arm-landmine-arc-press','Bilateral Side-to-Side Landmine Arc','new_definition','A two-hand bar path sweeping between shoulders or hips with or without rotation is not a unilateral press and requires its own contract.','{"primaryAction":"bilateral_side_to_side_arc","handCount":2,"rotationPolicy":"must_be_declared"}'::JSONB,'{"status":"proposal_only_human_review_required"}'::JSONB),
    ('one-arm-landmine-arc-press','One-Arm Eccentric Landmine Press','modifier_annotation','A slower or assisted lowering phase changes contraction emphasis and dose; it does not prove a distinct arc identity.','{"modifiers":["eccentric_duration","concentric_assistance","tempo"],"legacyExerciseId":1414}'::JSONB,NULL),
    ('one-arm-landmine-arc-press','Standard Strict Landmine Press','reject','Do not alias the arc-press label to the standard strict press until a reviewer confirms that no distinct path or endpoint exists.','{"existingSlug":"landmine-press","reviewGate":"identity_equivalence_pending"}'::JSONB,NULL);

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
  FROM one_arm_landmine_alternate_seed alternate
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

  CREATE TEMP TABLE one_arm_landmine_relationship_seed (
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

  INSERT INTO one_arm_landmine_relationship_seed VALUES
    ('half-kneeling-one-arm-landmine-press','working-arm-ipsilateral-to-down-knee-strict','half-kneeling-one-arm-landmine-press','working-arm-contralateral-to-down-knee-strict','lateral_substitution',86,'Same strict half-kneeling press with a deliberately changed working-arm-to-down-knee relationship.','{"changedAttributes":["working_arm_to_down_knee","lead_foot","cross_body_stabilization"],"requiresExactSideRedose":true}'::JSONB),
    ('half-kneeling-one-arm-landmine-press','working-arm-contralateral-to-down-knee-strict','half-kneeling-one-arm-landmine-press','working-arm-ipsilateral-to-down-knee-strict','lateral_substitution',86,'Same strict half-kneeling press with a deliberately changed working-arm-to-down-knee relationship.','{"changedAttributes":["working_arm_to_down_knee","lead_foot","cross_body_stabilization"],"requiresExactSideRedose":true}'::JSONB),
    ('tall-kneeling-one-arm-landmine-press','single-arm-tall-kneeling-sleeve-grip-strict','half-kneeling-one-arm-landmine-press','working-arm-ipsilateral-to-down-knee-strict','regression',78,'Half kneeling adds foot support and may reduce the unsupported-base demand when the athlete can tolerate the asymmetric contacts.','{"changedAttributes":["base","foot_support","lead_leg","hip_strategy"],"condition":"only_when_half_kneeling_contacts_and_side_relationship_are_appropriate","humanReviewRequired":true}'::JSONB),
    ('half-kneeling-one-arm-landmine-press','working-arm-ipsilateral-to-down-knee-strict','tall-kneeling-one-arm-landmine-press','single-arm-tall-kneeling-sleeve-grip-strict','progression',78,'Tall kneeling removes foot support and lead-leg assistance while preserving a strict unilateral fixed-pivot press.','{"changedAttributes":["base","foot_support","lead_leg","hip_strategy"],"condition":"progress_only_with_same_path_load_range_and_control","humanReviewRequired":true}'::JSONB),
    ('one-arm-landmine-z-press','single-arm-long-sit-legs-together-strict','one-arm-landmine-z-press','single-arm-long-sit-straddle-strict','lateral_substitution',88,'Leg spacing changes pelvic and hamstring constraints while preserving the upright unilateral long-sit press.','{"changedAttributes":["leg_spacing","base_width","pelvic_and_hamstring_constraint"],"reassessLoadAndRange":true}'::JSONB),
    ('one-arm-landmine-z-press','single-arm-long-sit-straddle-strict','one-arm-landmine-z-press','single-arm-long-sit-legs-together-strict','lateral_substitution',88,'Leg spacing changes pelvic and hamstring constraints while preserving the upright unilateral long-sit press.','{"changedAttributes":["leg_spacing","base_width","pelvic_and_hamstring_constraint"],"reassessLoadAndRange":true}'::JSONB),
    ('one-arm-landmine-floor-press','single-arm-supine-floor-supported-strict','half-kneeling-one-arm-landmine-press','working-arm-ipsilateral-to-down-knee-strict','lateral_substitution',62,'Both are unilateral landmine presses, but floor-supported horizontal emphasis and half-kneeling angled emphasis are substitutable only when the workout objective permits the changed orientation and range.','{"changedAttributes":["body_orientation","base","range_boundary","press_direction","trunk_demand"],"condition":"objective_accepts_changed_press_emphasis","humanReviewRequired":true}'::JSONB),
    ('half-kneeling-one-arm-landmine-press','working-arm-ipsilateral-to-down-knee-strict','one-arm-landmine-floor-press','single-arm-supine-floor-supported-strict','lateral_substitution',62,'Both are unilateral landmine presses, but the changed orientation and range must satisfy the same workout objective and constraints.','{"changedAttributes":["body_orientation","base","range_boundary","press_direction","trunk_demand"],"condition":"objective_accepts_changed_press_emphasis","humanReviewRequired":true}'::JSONB);

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
    ARRAY['stability','complexity','load']::TEXT[],
    seed.reason,
    seed.conditions,
    'review',
    NULL,
    NULL,
    NULL
  FROM one_arm_landmine_relationship_seed seed
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
        THEN 'Candidate exercise-complexity score reflects exact base, orientation, laterality, equipment transfer, path, range, and control demands; human anchor review is pending.'
      WHEN 'absoluteLoadDemand'
        THEN 'Candidate physical-difficulty score reflects load tolerance, local pressing demand, base demand, and repeatable quality; human anchor review is pending.'
    END,
    'review',
    1,
    NULL,
    NULL,
    CASE
      WHEN seed.selectable
        THEN 'Research proposal only; compare against approved facility anchors before approval.'
      ELSE 'Provisional identity-quarantine score; exact movement contract must be established before approval.'
    END,
    NULL
  FROM one_arm_landmine_variant_seed seed
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
          AND media.link_status = 'healthy'
          AND media.embedding_allowed IS TRUE
      ),
      'mediaApprovalsCreated', FALSE,
      'alternateAssessmentsPresent', (
        SELECT count(*)
        FROM coaching.exercise_alternate_assessment_v1 alternate
        WHERE alternate.definition_id = definition.id
          AND alternate.reviewed_card_version = definition.card_version
          AND alternate.review_status = 'candidate'
      ) >= 1,
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
      ),
      'identityQuarantine',
        definition.slug = 'one-arm-landmine-arc-press'
    ),
    CASE
      WHEN definition.slug = 'one-arm-landmine-arc-press'
        THEN jsonb_build_array(
          jsonb_build_object(
            'code', 'CARD-IDENTITY-01',
            'message', 'Base, hand count, rack, path, endpoint, rotation, return, and identity boundary require qualified human review.'
          ),
          jsonb_build_object(
            'code', 'CARD-MEDIA-01',
            'message', 'Five oEmbed-healthy candidates require full exact-variant, safety, cue, caption, accessibility, quality, reviewer, and approval review.'
          ),
          jsonb_build_object(
            'code', 'CARD-PUBLISH-01',
            'message', 'No card or publication approval exists.'
          ),
          jsonb_build_object(
            'code', 'CARD-GRAPH-03',
            'message', 'No approved progression, regression, or substitution relationship exists.'
          ),
          jsonb_build_object(
            'code', 'CARD-CALIBRATION-01',
            'message', 'Difficulty proposals require human anchor review after identity resolution.'
          )
        )
      ELSE jsonb_build_array(
        jsonb_build_object(
          'code', 'CARD-MEDIA-01',
          'message', 'Five oEmbed-healthy candidates require full exact-variant, safety, cue, caption, accessibility, quality, reviewer, and approval review.'
        ),
        jsonb_build_object(
          'code', 'CARD-PUBLISH-01',
          'message', 'No card or publication approval exists.'
        ),
        jsonb_build_object(
          'code', 'CARD-GRAPH-03',
          'message', 'Review-only relationships require human approval.'
        ),
        jsonb_build_object(
          'code', 'CARD-CALIBRATION-01',
          'message', 'Difficulty proposals require human anchor review.'
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
      '% produced an unexpected card version, status, review, or approval state',
      migration_key;
  END IF;
END
$$;
