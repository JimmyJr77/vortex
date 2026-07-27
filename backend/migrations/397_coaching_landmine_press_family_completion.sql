-- Complete the consolidated Landmine Press candidate card after migrations
-- 386, 390, and 394.
--
-- Five exact strict-standing variants declare stance, hand count, attachment,
-- grip, rack, laterality, path, range, tempo, load, side dose, and finish.
-- Five YouTube candidates have current oEmbed metadata only. No playback,
-- exact-match, demonstration-quality, caption, accessibility, reviewer, media,
-- graph, calibration, card, or publication approval is claimed.
--
-- Exercise difficulty is exercise complexity plus physical difficulty, with
-- overall derived as their maximum. Skill/proficiency levels remain exclusive
-- to coaching.skill and are intentionally absent here.
-- IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '397_coaching_landmine_press_family_completion';
  target_definition_id UUID;
  target_card_version INTEGER;
  facility BIGINT;
  protected_records INTEGER;
  unexpected_variants INTEGER;
BEGIN
  SELECT id, card_version, facility_id
  INTO target_definition_id, target_card_version, facility
  FROM coaching.exercise_definition_v1
  WHERE facility_id = 1
    AND slug = 'landmine-press'
    AND status <> 'archived';

  IF target_definition_id IS NULL THEN
    RAISE EXCEPTION
      '% requires active landmine-press definition',
      migration_key;
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
          OR approved_video_url IS NOT NULL
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
      '% refused to overwrite % protected record(s)',
      migration_key,
      protected_records;
  END IF;

  SELECT COUNT(*)
  INTO unexpected_variants
  FROM coaching.exercise_variant_v1
  WHERE definition_id = target_definition_id
    AND status <> 'archived'
    AND variant_key NOT IN (
      'baseline',
      'single-arm-square-stance-sleeve-grip-strict',
      'single-arm-split-stance-sleeve-grip-strict',
      'two-hand-square-stance-sleeve-grip-strict',
      'two-hand-square-stance-neutral-handle-strict',
      'two-hand-square-stance-ball-grip-strict'
    );

  IF unexpected_variants > 0 THEN
    RAISE EXCEPTION
      '% found % unexpected active variant(s)',
      migration_key,
      unexpected_variants;
  END IF;

  UPDATE coaching.exercise_variant_v1
  SET variant_key =
        'legacy-underspecified-source-' || left(id::TEXT, 8),
      status = 'archived',
      requirements_json = coalesce(requirements_json, '{}'::JSONB)
        || jsonb_build_object(
          'selectable', FALSE,
          'completionQuarantine', TRUE,
          'identityQuarantine', TRUE,
          'quarantineReason',
            'Legacy baseline does not declare stance, side, hand count, attachment, grip, rack, bar side, strict intent, range, tempo, load, side dose, pickup, set-down, fatigue, finish, and stop rules.'
        ),
      updated_at = now()
  WHERE definition_id = target_definition_id
    AND variant_key = 'baseline';

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET status = 'archived',
      updated_at = now()
  FROM coaching.exercise_variant_v1 variant
  WHERE variant.id = profile.variant_id
    AND variant.definition_id = target_definition_id
    AND variant.status = 'archived';

  UPDATE coaching.exercise_definition_v1
  SET canonical_name = 'Landmine Press',
      display_name = 'Landmine Press',
      aliases = ARRAY(
        SELECT min(alias)
        FROM unnest(
          coalesce(aliases, '{}')
          || ARRAY[
            'Standing Landmine Press',
            'Landmine Shoulder Press',
            'Angled Barbell Press',
            'Single-Arm Landmine Press',
            'Two-Hand Landmine Press',
            'Landmine Anti-Rotation Press',
            'Landmine Anti-Rotation Press-Out',
            'Landmine Neutral-Handle Press',
            'Landmine Ball-Grip Press'
          ]::TEXT[]
        ) alias
        WHERE nullif(btrim(alias), '') IS NOT NULL
          AND lower(btrim(alias)) <> 'landmine press'
        GROUP BY lower(btrim(alias))
        ORDER BY lower(btrim(alias))
      ),
      description =
        'Stand on a level high-traction surface facing a barbell secured in a rated landmine pivot. Declare square or split stance, lead leg, one or two hands, side, sleeve or compatible attachment, grip, shoulder or central rack, load, owned range, tempo, repetitions, rest, side sequence, pickup, finish, and set-down. Establish stable foot pressure and an organized pelvis and ribcage, press the free end up and forward along the fixed diagonal arc without deliberate knee-and-hip drive or torso rotation, reach the declared controlled finish with appropriate scapular motion, then lower to the same rack and reset.',
      family_key = 'standing_strict_fixed_arc_landmine_press',
      schema_version = '1.0.0',
      card_version = CASE
        WHEN provenance_json->>'structuralCompletionMigration'
          IS DISTINCT FROM migration_key
          THEN card_version + 1
        ELSE card_version
      END,
      status = 'review',
      content_confidence = 90,
      scoring_confidence = 68,
      media_confidence = 55,
      movement_patterns = ARRAY[
        'push',
        'brace'
      ]::TEXT[],
      body_regions = ARRAY[
        'hand',
        'wrist',
        'forearm',
        'elbow',
        'upper_arm',
        'shoulder',
        'scapula',
        'chest',
        'core',
        'spine',
        'pelvis',
        'hip',
        'knee',
        'ankle',
        'foot'
      ]::TEXT[],
      required_equipment = ARRAY[
        'landmine',
        'barbell',
        'collars'
      ]::TEXT[],
      optional_equipment = ARRAY[
        'weight_plates',
        'neutral_landmine_handle',
        'ball_grip_landmine_attachment',
        'barbell_jack_or_staging_block'
      ]::TEXT[],
      anatomy_json = '{
        "primaryMuscles":["anterior_deltoid","clavicular_pectoralis_major","triceps_brachii"],
        "secondaryMuscles":["serratus_anterior","upper_and_lower_trapezius","rotator_cuff"],
        "stabilizers":["abdominal_wall","internal_and_external_obliques","spinal_stabilizers","gluteals","hip_knee_ankle_and_foot_stabilizers","forearm_and_hand_flexors"],
        "joints":["glenohumeral","scapulothoracic","acromioclavicular","elbow","radioulnar","wrist","hand","spine","pelvis","hip","knee","ankle","foot"],
        "jointActions":["shoulder_flexion_in_fixed_landmine_arc","scapular_upward_rotation_protraction_and_posterior_tilt","elbow_extension_and_flexion","wrist_and_grip_stabilization","trunk_anti_extension_anti_lateral_flexion_and_anti_rotation","standing_lower_body_stabilization"],
        "planes":["oblique_sagittal_and_scapular_press_motion","frontal_and_transverse_stabilization"],
        "laterality":"variant_declared_unilateral_or_bilateral",
        "lateralityNote":"Record pressing side, stance and lead-leg relationship, repetitions, load, path, symptoms, fatigue, and quality without assuming symmetry.",
        "kineticChain":"standing_closed_chain_base_with_open_chain_or_bilateral_guided_upper_extremity_press_against_fixed_pivot",
        "evidenceLimit":"Available sources establish the landmine setup, fixed arc, press identity, and load-sensitive kinematics; they do not validate one universal stance, attachment, range, dose, score, superiority claim, pain treatment, or rehabilitation prescription."
      }'::JSONB,
      environment_json = '{
        "surface":{"required":"level_dry_high_traction","avoid":["wet","uneven","cluttered","unstable"]},
        "equipment":{"ratedLandmineAnchor":true,"compatibleBarbell":true,"collarsRequiredWhenPlatesUsed":true,"attachmentFitInspected":true,"barSleeveAndPlatesUndamaged":true},
        "space":{"fullBarArcClear":true,"plateAndSleeveExclusionZoneMeters":1.5,"pickupAndSetDownZoneClear":true,"crossTrafficProhibited":true},
        "setup":{"anchorCannotLiftSlideOrRotateUnexpectedly":true,"loadStanceGripRackRangeTempoAndFinishDeclared":true,"unloadedOrLightRehearsalBeforeWorkingLoad":true},
        "observation":{"coachCanSeeAnchorFeetPelvisRibsWristElbowScapulaAndBarPath":true,"videoOnlyWithConsentAndPolicy":true},
        "traffic":{"oneActiveAthletePerLandmine":true,"coachAndOthersOutsideBarAndPlatePath":true}
      }'::JSONB,
      population_json = '{
        "prerequisites":["pain_free_standing_base","pain_free_declared_press_range","can_control_unloaded_or_light_bar_through_fixed_arc","can_pickup_rack_return_and_set_down_selected_load","can_follow_stance_side_grip_range_tempo_dose_finish_and_stop_rules"],
        "useCaution":["current_hand_wrist_elbow_shoulder_neck_back_hip_knee_ankle_or_foot_symptoms","recent_upper_extremity_or_spine_procedure","meaningful_side_difference","history_of_dizziness_or_pressure_symptoms_with_resistance_training","fatigue_from_pressing_throwing_hitting_contact_or_grip_work"],
        "doNotUseWhen":["sharp_or_increasing_pain","numbness_tingling_weakness_dizziness_unusual_breathlessness_or_apprehension","unsafe_anchor_bar_collar_plate_attachment_floor_or_clearance","cannot_control_unloaded_bar_and_safe_return","cannot_avoid_leg_drive_or_trunk_rotation_in_strict_variant"],
        "regressionOrder":["remove_external_plates","use_two_hands","use_split_stance","shorten_to_owned_range","reduce_repetitions","increase_rest","choose_reviewed_non_overhead_substitution"],
        "individualizationRequired":true,
        "medicalScope":"This card is not diagnosis, treatment, rehabilitation, injury-prevention assurance, or medical clearance; follow the athlete care plan and local scope."
      }'::JSONB,
      athlete_support_json = '{
        "whyItMatters":"Builds strict angled pressing strength while the shoulder blade, trunk, pelvis, and standing base coordinate around a fixed bar path.",
        "primaryCue":"Secure base, exact rack, press up and forward along the arc without dipping or turning, reach with control, and return to the same rack.",
        "beforeYouStart":["confirm_anchor_bar_collars_plates_attachment_floor_and_clearance","confirm_variant_stance_lead_leg_side_hand_count_grip_rack_load_range_tempo_repetitions_rest_and_finish","rehearse_one_unloaded_or_light_controlled_repetition","identify_stop_signal_and_safe_set_down"],
        "expectedSensations":["shoulder_upper_chest_and_triceps_effort","scapular_motion_and_control","grip_and_forearm_effort","trunk_and_lower_body_stability","increasing_effort_with_load_and_repetitions"],
        "unexpectedSensations":["sharp_or_increasing_pain","numbness_tingling_or_weakness","dizziness_or_unusual_breathlessness","wrist_elbow_neck_or_back_pain","anchor_or_attachment_movement","loss_of_balance_or_bar_control"],
        "selfChecks":["feet_and_stance_remain_as_declared","pelvis_and_ribs_stay_organized","wrist_and_forearm_remain_stacked","bar_follows_the_same_arc","no_deliberate_leg_drive_or_trunk_turn","finish_and_lowering_match_the_assignment","last_repetition_matches_the_first"],
        "painGuidance":"Stop and report pain, neurologic symptoms, dizziness, unusual breathlessness, anchor or attachment movement, balance loss, grip or wrist collapse, a changed path, or a return you cannot control.",
        "accessibility":["unloaded_bar","lighter_plates","two_hand_support","split_stance","shorter_owned_range","fewer_repetitions","longer_rest","reviewed_non_overhead_substitution","written_audio_still_image_tactile_or_live_walkthrough"],
        "mediaAlternatives":["written_exact_variant_contract","front_side_and_oblique_stills","slow_walkthrough","qualified_live_demonstration"],
        "afterSetCheck":["record_variant_side_stance_lead_leg_attachment_grip_rack_load_range_tempo_quality_repetitions_rest_symptoms_and_stop_reason"]
      }'::JSONB,
      coach_support_json = '{
        "observationChecklist":["anchor_bar_collar_plate_attachment_and_clearance","variant_stance_lead_leg_side_hand_count_grip_and_rack","foot_pressure_balance_pelvis_and_ribs","wrist_forearm_elbow_scapula_and_bar_arc","range_tempo_finish_and_return","leg_drive_rotation_or_side_bend","side_difference_breathing_symptoms_and_fatigue","safe_set_down"],
        "faultCorrections":{"anchor_or_attachment_moves":["stop_immediately","unload_and_reinspect","do_not_resume_until_secure"],"ribs_flare_or_back_extends":["reduce_load_or_range","use_split_stance","cue_exhale_and_stack"],"trunk_rotates_or_side_bends":["reduce_load","use_two_hands_or_split_stance","end_set_if_not_repeatable"],"wrist_collapses_or_grip_shifts":["reduce_load","change_to_compatible_reviewed_attachment","reset_rack"],"leg_drive_appears":["end_set_or_reduce_load","use_push_press_definition_when_that_is_the_intended_action"],"path_or_return_changes":["end_set","reduce_load_range_or_repetitions"]},
        "demonstrationPlan":["show_anchor_collar_plate_and_attachment_inspection","show_single_arm_square_and_split_stance_sleeve_variants","show_two_hand_sleeve_neutral_handle_and_ball_grip_variants","contrast_half_kneeling_push_press_rotational_press_throw_squat_to_press_and_floor_press"],
        "groupManagement":["one_active_athlete_per_landmine","bar_and_plate_arc_is_an_exclusion_zone","load_changes_only_when_station_is_still","coach_outside_bar_path","variant_and_side_counting_standardized"],
        "modificationDecisionTree":{"unloaded_strict_press_not_controlled":"stop_or_choose_reviewed_regression","single_arm_square_stance_loses_control":"use_split_stance_or_two_hands","wrist_or_grip_limits_sleeve_variant":"consider_compatible_reviewed_handle_variant","leg_drive_is_intended":"use_push_press_definition","rotation_is_intended":"use_rotational_press_definition","symptom_or_hazard":"stop"},
        "doNotUseWhen":["symptom_or_apprehension","unsafe_anchor_bar_collar_plate_attachment_floor_or_clearance","unloaded_path_and_return_are_not_repeatable","fatigue_already_changes_stance_brace_grip_or_path","safe_pickup_or_set_down_is_not_available"],
        "recordingFields":["variant_key","pressing_side","stance","lead_leg","hand_count","attachment","grip","rack","load","range","tempo","quality_repetitions","rest","symptoms","stop_reason"]
      }'::JSONB,
      support_operations_json = '{
        "supportSummary":"Do not improve load, range, or repetitions by accepting anchor movement, loose plates, lost stance, rib flare, back extension, torso rotation, side bend, wrist collapse, leg drive, shortened range, an altered arc, uncontrolled lowering, symptoms, or an unsafe set-down.",
        "issueCategories":["identity_or_variant","difficulty_or_dose","equipment_or_environment","symptom_or_population_constraint","instruction_or_accessibility","media_exact_match","relationship","calibration"],
        "supportEscalation":{"urgent":["dropped_bar_or_plate","acute_injury","neurologic_or_cardiovascular_symptom"],"coachReview":["repeated_stance_brace_wrist_path_or_return_fault","meaningful_side_difference","unclear_load_range_tempo_or_attachment"],"equipmentReview":["anchor_bar_collar_plate_or_attachment_movement_or_damage"],"contentReview":["identity_boundary_conflict","media_mismatch","missing_accessibility_or_stop_rule"]},
        "retentionPolicy":"Retain card version, exact variant, side, stance, lead leg, hand count, attachment, grip, rack, load, range, tempo, repetitions, rest, quality, symptoms, stop reason, substitution, media metadata, and reviewer decisions according to facility policy.",
        "knownLimitations":["candidate_media_not_human_viewed","no_universal_stance_attachment_range_load_dose_or_recovery","scores_doses_edges_and_calibrations_are_unapproved_proposals"],
        "changeImpactPolicy":"Changes to base, stance, laterality, hand count, attachment, grip, rack, strict versus leg-drive or rotational intent, path, range, terminal action, difficulty, dose, stop rule, relationship, or media require a new card version and renewed affected reviews."
      }'::JSONB,
      approved_video_url = NULL,
      reviewed_by = NULL,
      approved_by = NULL,
      last_reviewed_at = NULL,
      provenance_json = provenance_json || jsonb_build_object(
        'structuralCompletionMigration', migration_key,
        'researchBatch', 'landmine-press-family-v1',
        'researchVersion', '2026-07-27.55',
        'evidenceState', 'candidate_requires_human_review',
        'mediaState',
          'five_oembed_healthy_candidates_require_full_human_review',
        'difficultyModel',
          'max_exercise_complexity_physical_difficulty',
        'humanReviewRequired', TRUE,
        'publicationQuarantined', TRUE,
        'operationalSupportReviewRequired', TRUE,
        'mediaApprovalCreated', FALSE,
        'graphApprovalCreated', FALSE,
        'calibrationApprovalCreated', FALSE
      ),
      updated_at = now()
  WHERE id = target_definition_id;

  SELECT card_version
  INTO target_card_version
  FROM coaching.exercise_definition_v1
  WHERE id = target_definition_id;

  CREATE TEMP TABLE landmine_press_variant_seed (
    variant_key TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    stance TEXT NOT NULL,
    lead_leg TEXT NOT NULL,
    laterality TEXT NOT NULL,
    hand_count SMALLINT NOT NULL,
    attachment TEXT NOT NULL,
    grip TEXT NOT NULL,
    rack TEXT NOT NULL,
    complexity SMALLINT NOT NULL,
    physical SMALLINT NOT NULL,
    coordination SMALLINT NOT NULL,
    supervision SMALLINT NOT NULL,
    consequence SMALLINT NOT NULL,
    local_fatigue SMALLINT NOT NULL,
    grip_fatigue SMALLINT NOT NULL,
    technical_fatigue SMALLINT NOT NULL,
    recovery_hours SMALLINT NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO landmine_press_variant_seed VALUES
    ('single-arm-square-stance-sleeve-grip-strict','Single-Arm Square-Stance Landmine Press','square','none','unilateral',1,'barbell_sleeve','cupped_sleeve_neutral_wrist','same_side_shoulder',46,44,48,38,44,48,48,54,36),
    ('single-arm-split-stance-sleeve-grip-strict','Single-Arm Split-Stance Landmine Press','split','declared','unilateral',1,'barbell_sleeve','cupped_sleeve_neutral_wrist','same_side_shoulder',44,46,46,36,42,50,48,50,36),
    ('two-hand-square-stance-sleeve-grip-strict','Two-Hand Square-Stance Landmine Press','square','none','bilateral',2,'barbell_sleeve','overlapping_or_interlaced_sleeve_grip','central_upper_chest',38,44,40,32,40,48,44,44,36),
    ('two-hand-square-stance-neutral-handle-strict','Two-Hand Neutral-Handle Landmine Press','square','none','bilateral',2,'compatible_neutral_landmine_handle','parallel_neutral_grip','central_upper_chest',40,48,42,34,44,52,42,46,48),
    ('two-hand-square-stance-ball-grip-strict','Two-Hand Ball-Grip Landmine Press','square','none','bilateral',2,'compatible_ball_grip_attachment','two_hand_ball_grip','central_upper_chest',44,48,46,38,46,54,54,50,48);

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
    target_definition_id,
    seed.variant_key,
    seed.display_name,
    ARRAY[
      seed.stance || '_stance',
      seed.laterality,
      seed.hand_count::TEXT || '_hand',
      seed.attachment,
      seed.grip,
      seed.rack,
      'strict_no_leg_drive',
      'fixed_diagonal_arc',
      'controlled_return'
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
      )
    ),
    jsonb_build_object(
      'selectable', TRUE,
      'base', 'standing',
      'stance', seed.stance,
      'leadLeg', seed.lead_leg,
      'laterality', seed.laterality,
      'handCount', seed.hand_count,
      'attachment', seed.attachment,
      'grip', seed.grip,
      'rack', seed.rack,
      'anchor', 'rated_fixed_landmine_pivot',
      'path', 'fixed_diagonal_up_and_forward_arc',
      'intent', 'strict_no_deliberate_leg_drive_or_rotation',
      'range', 'declared_owned_range_to_controlled_finish',
      'tempo', 'controlled_concentric_and_lowering',
      'terminalAction', 'controlled_return_to_same_rack',
      'sideBalanceRequired', seed.laterality = 'unilateral',
      'pickupAndSetDownMustBeDeclared', TRUE
    ),
    'review',
    jsonb_build_object(
      'externalLoadMethod', 'landmine_barbell',
      'externalLoadDescription',
        'barbell and declared plate mass rotating around a rated fixed pivot through the exact sleeve or attachment interface',
      'effectiveLoadDrivers', jsonb_build_array(
        'bar_mass',
        'plate_mass',
        'plate_position',
        'bar_angle',
        'athlete_distance_from_pivot',
        'stance',
        'hand_count',
        'attachment',
        'range',
        'tempo',
        'repetitions'
      ),
      'gripDemand', seed.grip_fatigue,
      'spinalLoading', 34,
      'eccentricStress', 38,
      'landingContactsPerRep', 0,
      'impactClass', 'none',
      'loadTracking', jsonb_build_array(
        'bar_type',
        'plate_mass',
        'attachment',
        'stance',
        'lead_leg',
        'hand_count',
        'pressing_side',
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
      'primaryFatigueSites', jsonb_build_array(
        'anterior_shoulder',
        'upper_chest',
        'triceps',
        'scapular_stabilizers',
        'grip_and_forearm',
        'trunk_stabilizers'
      ),
      'earlyFatigueSignals', jsonb_build_array(
        'rib_flare_or_back_extension',
        'trunk_rotation_or_side_bend',
        'wrist_or_grip_change',
        'elbow_or_scapular_path_change',
        'leg_drive',
        'shortened_range',
        'uncontrolled_lowering'
      ),
      'downstreamConflicts', jsonb_build_array(
        'heavy_overhead_or_horizontal_pressing',
        'high_velocity_throwing_or_hitting',
        'contact_training',
        'grip_intensive_training',
        'upper_body_power_testing'
      )
    ),
    jsonb_build_object(
      'primaryIntent',
        'strict_controlled_angled_press_strength',
      'appropriatePhases', jsonb_build_array(
        'movement_intelligence',
        'capacity'
      ),
      'bestUse',
        'quality_angled_press_pattern_or_strength_with_exact_equipment_and_base',
      'avoidUse', jsonb_build_array(
        'untracked_push_press_or_rotation',
        'conditioning_race',
        'uncontrolled_to_failure',
        'fatigue_degraded_path_or_return',
        'symptom_provocation'
      ),
      'cumulativeBudget', jsonb_build_object(
        'angledPressStrengthSets', 1,
        'shoulderChestTricepsLoad', seed.local_fatigue,
        'gripStress', seed.grip_fatigue,
        'technicalSensitivity', seed.technical_fatigue,
        'impact', 1
      )
    )
  FROM landmine_press_variant_seed seed
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
        THEN 'Build repeatable strict angled pressing strength while preserving the exact anchor, stance, grip, rack, path, finish, lowering, side balance, and set-down.'
      ELSE 'Practice secure setup, an owned fixed diagonal path, scapular motion, trunk control, and safe return at low fatigue without leg drive or rotation.'
    END,
    CASE profile.profile_key
      WHEN 'capacity-strict-strength' THEN 90
      ELSE 88
    END,
    92,
    jsonb_build_object(
      'angledPressStrength', CASE
        WHEN seed.hand_count = 1 THEN 92
        ELSE 86
      END,
      'unilateralControl', CASE
        WHEN seed.hand_count = 1 THEN 92
        ELSE 52
      END,
      'pathAndScapularControl', seed.coordination,
      'lowImpact', 100,
      'fatigueCost', seed.local_fatigue
    ),
    CASE profile.profile_key
      WHEN 'capacity-strict-strength' THEN jsonb_build_object(
        'sets', jsonb_build_array(2, 5),
        'repsPerSide', CASE
          WHEN seed.hand_count = 1
            THEN jsonb_build_array(4, 10)
          ELSE NULL
        END,
        'reps', CASE
          WHEN seed.hand_count = 2
            THEN jsonb_build_array(4, 10)
          ELSE NULL
        END,
        'rpe', jsonb_build_array(5, 8),
        'restSeconds', jsonb_build_array(90, 240),
        'tempo', 'controlled_lowering_with_deliberate_reset',
        'stopBeforeFailure', TRUE
      )
      ELSE jsonb_build_object(
        'sets', jsonb_build_array(2, 4),
        'repsPerSide', CASE
          WHEN seed.hand_count = 1
            THEN jsonb_build_array(3, 6)
          ELSE NULL
        END,
        'reps', CASE
          WHEN seed.hand_count = 2
            THEN jsonb_build_array(3, 6)
          ELSE NULL
        END,
        'rpe', jsonb_build_array(3, 6),
        'restSeconds', jsonb_build_array(60, 180),
        'tempo', 'slow_controlled_rehearsal',
        'stopBeforeFailure', TRUE
      )
    END,
    'Every counted repetition preserves a secure anchor, declared stance and grip, stable foot pressure, organized pelvis and ribs, stacked wrist and forearm, strict diagonal arc, controlled scapular motion, owned finish, same-path lowering, and safe reset.',
    ARRAY[
      'Stop for pain, neurologic symptoms, dizziness, or unusual breathlessness.',
      'Stop if the anchor, collar, plate, bar, or attachment moves or becomes unsafe.',
      'Stop if stance, balance, foot pressure, pelvis, ribs, wrist, grip, elbow, scapula, path, range, finish, or lowering changes.',
      'Stop if deliberate leg drive, torso rotation, side bend, grinding, or an unsafe set-down appears.',
      'Stop if a person or object enters the bar and plate arc.'
    ]::TEXT[],
    'Inspect equipment and clearance; name the exact variant and dose; observe anchor, feet, pelvis, ribs, wrist, elbow, scapula, fixed arc, finish, return, breathing, symptoms, fatigue, and set-down; end the set before the strict contract changes.',
    'Set the exact stance and grip, rack securely, brace tall, press up and forward along the arc without dipping or turning, reach with control, lower to the same rack, and stop if equipment, balance, symptoms, path, or return becomes unsafe.',
    CASE profile.profile_key
      WHEN 'capacity-strict-strength'
        THEN 'Greater repeatable strict angled pressing force and volume tolerance with preserved scapular, trunk, grip, and equipment control.'
      ELSE 'More repeatable landmine setup, rack, fixed-arc press path, controlled scapular motion, trunk organization, finish, and return at low fatigue.'
    END,
    CASE seed.attachment
      WHEN 'barbell_sleeve'
        THEN ARRAY['landmine','barbell','collars']::TEXT[]
      WHEN 'compatible_neutral_landmine_handle'
        THEN ARRAY['landmine','barbell','collars','neutral_landmine_handle']::TEXT[]
      ELSE ARRAY['landmine','barbell','collars','ball_grip_landmine_attachment']::TEXT[]
    END,
    jsonb_build_object(
      'stationFootprintMeters', jsonb_build_object(
        'length', 4,
        'width', 3
      ),
      'athletesPerStation', 1,
      'setupSeconds', 75,
      'transitionSeconds', 30,
      'loadChangeRequiresStillBar', TRUE,
      'barArcExclusionZone', TRUE,
      'coachPosition', 'oblique_outside_bar_and_plate_arc',
      'sideChangeSeconds', CASE
        WHEN seed.hand_count = 1 THEN 20
        ELSE 0
      END
    ),
    ARRAY[]::UUID[],
    'review',
    jsonb_build_object(
      'secondsPerRep', CASE
        WHEN profile.profile_key =
          'movement-intelligence-path-control'
          THEN 6
        ELSE 4
      END,
      'setupSeconds', 75,
      'sideChangeSeconds', CASE
        WHEN seed.hand_count = 1 THEN 20
        ELSE 0
      END,
      'restSeconds', CASE
        WHEN profile.profile_key =
          'capacity-strict-strength'
          THEN jsonb_build_array(90, 240)
        ELSE jsonb_build_array(60, 180)
      END
    ),
    jsonb_build_object(
      'regressions', jsonb_build_array(
        'remove_external_plates',
        'use_two_hands',
        'use_split_stance',
        'shorten_to_owned_range',
        'reduce_repetitions',
        'increase_rest'
      ),
      'progressions', jsonb_build_array(
        'add_load_with_same_contract',
        'increase_owned_range',
        'move_from_two_hands_to_one',
        'move_from_split_to_square_stance_when_unilateral',
        'increase_repetitions_with_same_quality'
      ),
      'neverScaleBy', jsonb_build_array(
        'anchor_movement',
        'loose_plates',
        'leg_drive',
        'trunk_rotation_or_back_extension',
        'wrist_collapse',
        'changed_path',
        'uncontrolled_lowering',
        'symptoms'
      )
    ),
    jsonb_build_object(
      'record', jsonb_build_array(
        'variant_key',
        'pressing_side',
        'stance',
        'lead_leg',
        'hand_count',
        'attachment',
        'grip',
        'rack',
        'load',
        'range',
        'tempo',
        'quality_repetitions',
        'rest',
        'symptoms',
        'stop_reason'
      ),
      'compareSides', seed.hand_count = 1,
      'qualityBeforeQuantity', TRUE
    ),
    jsonb_build_object(
      'athletePrompt',
        'Confirm stance, side, hand count, attachment, grip, rack, load, range, tempo, repetitions, rest, and finish; report symptoms or equipment movement immediately.',
      'coachPrompt',
        'Verify anchor and exclusion zone first; count only strict fixed-arc repetitions with the exact base, grip, rack, range, finish, and return.',
      'supportPrompt',
        'Retain the card version and exact variant; do not silently substitute half-kneeling, push-press, rotational, throw, squat-to-press, or floor-press mechanics.',
      'accessibilityPrompt',
        'Offer unloaded bar, two hands, split stance, shorter owned range, fewer repetitions, longer rest, a reviewed substitution, and written, still-image, audio, tactile, or live instruction.'
    )
  FROM landmine_press_variant_seed seed
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id = target_definition_id
   AND variant.variant_key = seed.variant_key
  CROSS JOIN (
    VALUES
      ('capacity-strict-strength','capacity'),
      ('movement-intelligence-path-control','movement_intelligence')
  ) AS profile(profile_key, phase_key)
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
    evidence.source_url,
    evidence.source_title,
    evidence.source_publisher,
    evidence.source_kind,
    evidence.claims,
    evidence.evidence_quality,
    'candidate',
    NULL,
    NULL
  FROM (
    VALUES
      ('identity','https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/','The Landmine Press—Implementation and Variation','National Strength and Conditioning Association','professional_standard',84,'["NSCA identifies the landmine press as a barbell press performed from a stable pivoting base and discusses distinct implementation variations.","The stable identity is a strict standing diagonal press from a declared rack through the fixed arc with a controlled return and no deliberate leg drive or torso rotation."]'::JSONB),
      ('taxonomy','https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/','The Landmine Press—Implementation and Variation','National Strength and Conditioning Association','professional_standard',84,'["Classify the family as a strict standing angled press with a brace requirement.","Declare stance, side, hand count, attachment, grip, rack, intent, range, tempo, load, rest, side dose, pickup, and set-down; half-kneeling, push-press, rotational, throw, squat-to-press, and floor-press tasks remain distinct."]'::JSONB),
      ('anatomy','https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/','The Landmine Press—Implementation and Variation','National Strength and Conditioning Association','professional_standard',84,'["The press loads shoulder pressing and stabilization with elbow extension while the trunk and lower body maintain the declared base.","Record deltoid, clavicular pectoralis, triceps, serratus, trapezius, rotator cuff, trunk, grip, hip, knee, ankle, and foot contributions without claiming isolation."]'::JSONB),
      ('biomechanics','https://pubmed.ncbi.nlm.nih.gov/41755100/','Landmine Press Kinematics Measured with an Enhanced YOLOv8 Model and Mathematical Modeling','Sensors','peer_reviewed_research',86,'["Landmine-press velocity and power can be measured from bar motion around its fixed end, supporting an explicit pivoted planar-arc contract.","Observe anchor security, repeatable rack, foot pressure, stance, pelvis, ribs, wrist, forearm, path, finish, and same-path lowering."]'::JSONB),
      ('difficulty','https://pubmed.ncbi.nlm.nih.gov/41755100/','Landmine Press Kinematics Measured with an Enhanced YOLOv8 Model and Mathematical Modeling','Sensors','peer_reviewed_research',86,'["Landmine-press kinematics and power change across external loads, so load and exact configuration must be recorded.","Assess exercise complexity and physical difficulty independently and derive overall as their maximum; assign no exercise skill level."]'::JSONB),
      ('load_fatigue_recovery','https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/','American College of Sports Medicine Position Stand. Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews','Medicine and Science in Sports and Exercise','professional_standard',96,'["Resistance-training stimulus and fatigue depend on load, volume, effort, exercise selection, frequency, and progression.","Track angled press volume, shoulder, chest, triceps, scapular, rotator-cuff, grip, trunk, eccentric, and technical fatigue with no planned impact."]'::JSONB),
      ('constraints','https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/','The Landmine Press—Implementation and Variation','National Strength and Conditioning Association','professional_standard',84,'["A landmine press requires an anchored barbell and clear space for the bar arc and safe loading and unloading.","Declare anchor, bar, collars, plates, attachment, stance, rack, load, clearance, pickup, set-down, sightline, and exclusion zone."]'::JSONB),
      ('dosage','https://pmc.ncbi.nlm.nih.gov/articles/PMC10579494/','Resistance training prescription for muscle strength and hypertrophy in healthy adults: a systematic review and Bayesian network meta-analysis','British Journal of Sports Medicine','peer_reviewed_research',94,'["Outcomes depend on sets, repetitions, load, effort, frequency, and recovery rather than exercise name alone.","Use quality sets and enough rest to preserve equipment, stance, rack, wrist, path, scapula, trunk, range, tempo, side balance, and return."]'::JSONB),
      ('instructions','https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/','The Landmine Press—Implementation and Variation','National Strength and Conditioning Association','professional_standard',84,'["Instruction establishes the landmine, rack, stance, brace, press path, finish, controlled return, and safe set-down.","Cue secure, set, rack, brace, press along the arc without leg drive, reach with control, lower to the same rack, and reset."]'::JSONB),
      ('safety_stop_rules','https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf','Youth Resistance Training: Updated Position Statement Paper From the NSCA','National Strength and Conditioning Association','professional_standard',88,'["Qualified supervision, correct technique, manageable resistance, appropriate equipment, and gradual progression are core safeguards.","Stop symptoms, equipment movement, balance loss, rib or trunk compensation, wrist collapse, uncontrolled path or lowering, grinding, dropped load, collision risk, or unsafe set-down."]'::JSONB),
      ('programming','https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/','American College of Sports Medicine Position Stand. Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews','Medicine and Science in Sports and Exercise','professional_standard',96,'["Exercise selection and dose should be individualized to adaptation, current capacity, and recovery context.","Use for controlled angled pressing strength or pattern ownership before material pressing, throwing, contact, or grip fatigue; do not silently turn it into a push press."]'::JSONB),
      ('athlete_support','https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/','The Landmine Press—Implementation and Variation','National Strength and Conditioning Association','professional_standard',84,'["Provide the exact stance, side, hand count, attachment, grip, rack, load, range, tempo, repetitions, rest, side sequence, and stop signal.","A lighter load or shorter owned range is preferable to equipment movement, wrist collapse, back extension, rotation, leg drive, changed path, or uncontrolled return."]'::JSONB),
      ('coach_support','https://pubmed.ncbi.nlm.nih.gov/41755100/','Landmine Press Kinematics Measured with an Enhanced YOLOv8 Model and Mathematical Modeling','Sensors','peer_reviewed_research',86,'["The fixed and moving bar ends define a measurable path, supporting observation of setup, arc, range, velocity intent, and finish.","Observe equipment, stance, hand count, side, rack, wrist, elbow, scapula, pelvis, ribs, path, range, tempo, dose, symptoms, fatigue, set-down, and shutdown actions."]'::JSONB),
      ('accessibility','https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/','American College of Sports Medicine Position Stand. Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews','Medicine and Science in Sports and Exercise','professional_standard',96,'["Individualize load, volume, range, effort, equipment, and progression while preserving the intended contract.","Options include unloaded bar, lighter plates, two hands, split stance, shorter range, fewer repetitions, longer rest, reviewed substitution, and multimodal instruction."]'::JSONB),
      ('alternates','https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/','The Landmine Press—Implementation and Variation','National Strength and Conditioning Association','professional_standard',84,'["Stance, hand count, grip attachment, load, range, and tempo can vary within the strict standing press when fully declared.","Half-kneeling, push press, rotational press, throw, squat-to-press, and floor press change the base, primary action, intent, or terminal event and remain separate definitions."]'::JSONB),
      ('media','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en','Embed videos and playlists','YouTube Help','manufacturer_instruction',82,'["YouTube supports privacy-enhanced embedding through youtube-nocookie.com.","Five candidates returned current oEmbed metadata on 2026-07-27; full playback, exact variant, cues, safety, captions, accessibility, quality, reviewer, and approval remain unresolved."]'::JSONB)
  ) AS evidence(
    section_key,
    source_url,
    source_title,
    source_publisher,
    source_kind,
    evidence_quality,
    claims
  )
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
    target_definition_id,
    NULL,
    target_card_version,
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
    NULL,
    'YouTube oEmbed title/channel metadata and embed-player HTML checked 2026-07-27. Full playback, complete viewing, exact strict-standing variant, cue, safety, caption, accessibility, demonstration-quality, reviewer, and approval review remain unresolved.'
  FROM (
    VALUES
      ('3gYz0bLG-wY','Proper Technique for The Landmine Press','Simone Sports Performance','Landmine Press exercise technique'),
      ('Xf5tyNy5M6k','Learn to Landmine Overhead Press','Testosterone Nation','Standing Landmine Press exercise technique'),
      ('N9_1DnqUAQw','5 Best Landmine Press Exercises','Buff Dudes Workouts','Landmine Press exact variants'),
      ('5Cs27w8WVz4','Single Arm Landmine Press','Functional Bodybuilding','Single Arm Landmine Press exercise'),
      ('6cSTRPhpubs','Standing Landmine Shoulder Press - Developing Overhead Control','[P]rehab','Standing Landmine Shoulder Press exercise')
  ) AS media(
    video_id,
    title,
    channel_name,
    source_query
  )
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
    discovery_method = EXCLUDED.discovery_method,
    source_query = EXCLUDED.source_query,
    reviewer_user_id = NULL,
    reviewed_at = NULL,
    next_review_at = NULL,
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
    alternate.proposed_card,
    'candidate',
    NULL,
    NULL
  FROM (
    VALUES
      ('Standing Single-Arm Landmine Press','new_variant','One hand and a declared side change laterality, rack, anti-motion demand, and side dosing while preserving the strict standing diagonal press.','{"variantKey":"single-arm-square-stance-sleeve-grip-strict","laterality":"unilateral"}'::JSONB,NULL::JSONB),
      ('Split-Stance Single-Arm Landmine Press','new_variant','A split stance changes base and lead-leg relationship within the same strict press action.','{"variantKey":"single-arm-split-stance-sleeve-grip-strict","stance":"split"}'::JSONB,NULL::JSONB),
      ('Two-Hand Landmine Press','new_variant','Two-hand central support changes laterality, rack, load symmetry, and loading potential while preserving the strict press action.','{"variantKey":"two-hand-square-stance-sleeve-grip-strict","handCount":2}'::JSONB,NULL::JSONB),
      ('Landmine Neutral-Handle Press','new_variant','A compatible neutral handle changes attachment, grip, wrist position, setup, and loading potential but not the primary action.','{"variantKey":"two-hand-square-stance-neutral-handle-strict","attachment":"neutral_handle"}'::JSONB,NULL::JSONB),
      ('Landmine Ball-Grip Press','new_variant','A compatible ball-grip attachment changes hand interface, wrist and forearm demand, setup, and load handling while preserving the primary action.','{"variantKey":"two-hand-square-stance-ball-grip-strict","attachment":"ball_grip"}'::JSONB,NULL::JSONB),
      ('Half-Kneeling One-Arm Landmine Press','new_definition','One knee down and the opposite foot forward change base, contacts, side relationship, trunk and hip stabilization, pickup, and set-down.','{"base":"half_kneeling","existingSlug":"half-kneeling-one-arm-landmine-press"}'::JSONB,'{"status":"existing_definition_requires_separate_completion","slug":"half-kneeling-one-arm-landmine-press"}'::JSONB),
      ('One-Arm Landmine Push Press','new_definition','A deliberate dip and explosive knee-and-hip drive change the primary action, intent, load tolerance, fatigue, and stop rules.','{"primaryAction":"lower_body_drive_to_diagonal_press","existingSlug":"one-arm-landmine-push-press"}'::JSONB,'{"status":"existing_definition_requires_separate_completion","slug":"one-arm-landmine-push-press"}'::JSONB),
      ('Landmine Rotational Press','new_definition','Deliberate foot, hip, pelvis, and trunk rotation changes the plane, kinetic sequence, laterality, intent, and fatigue profile.','{"primaryAction":"rotational_force_transfer_to_press","existingSlug":"landmine-rotational-press"}'::JSONB,'{"status":"existing_definition_requires_separate_completion","slug":"landmine-rotational-press"}'::JSONB),
      ('Landmine Punch Throw','new_definition','Maximal ballistic intent and release change the terminal event, failure consequence, space, equipment, and supervision requirements.','{"terminalEvent":"bar_release_or_catch_system","intent":"maximal_velocity"}'::JSONB,'{"status":"proposal_only_human_review_required"}'::JSONB),
      ('Landmine Squat-to-Press','new_definition','A full squat followed by a press adds lower-body range, a combined primary action, different dose, fatigue, and stop rules.','{"primaryAction":"squat_then_diagonal_press","existingSlug":"landmine-squat-to-press"}'::JSONB,'{"status":"existing_definition_requires_separate_completion","slug":"landmine-squat-to-press"}'::JSONB),
      ('Banded Landmine Press','modifier_annotation','A band adds anchor, resistance-curve, recoil, setup, and load-tracking requirements without necessarily changing the strict press identity.','{"modifier":"band_accommodating_resistance","requires":["rated_band","rated_anchor","recoil_exclusion_zone"]}'::JSONB,NULL::JSONB),
      ('Landmine Press Tempo or Partial Range','modifier_annotation','Tempo and range change dose and difficulty but not identity when the strict standing diagonal press and exact setup remain declared.','{"modifiers":["tempo","range"]}'::JSONB,NULL::JSONB)
  ) AS alternate(
    alternate_name,
    classification,
    rationale,
    dimensions,
    proposed_card
  )
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
    relationship.relationship,
    relationship.similarity,
    relationship.dimensions,
    relationship.reason,
    relationship.conditions,
    'review',
    NULL,
    NULL,
    NULL
  FROM (
    VALUES
      ('two-hand-square-stance-sleeve-grip-strict','single-arm-split-stance-sleeve-grip-strict','progression',82,ARRAY['hand_count','laterality','trunk_control']::TEXT[],'One-hand execution adds side-specific rack, anti-motion, grip, and dose requirements after two-hand path control is repeatable.','{"requires":["two_hand_path_and_return_repeatable","unloaded_single_arm_rehearsal_controlled"]}'::JSONB),
      ('single-arm-split-stance-sleeve-grip-strict','single-arm-square-stance-sleeve-grip-strict','progression',88,ARRAY['stance','base_stability','anti_motion']::TEXT[],'A square stance removes the front-back base and increases anti-motion demand while preserving unilateral strict pressing.','{"requires":["split_stance_quality_repeatable","square_stance_balance_and_brace_ready"]}'::JSONB),
      ('single-arm-square-stance-sleeve-grip-strict','single-arm-split-stance-sleeve-grip-strict','regression',92,ARRAY['stance','base_stability']::TEXT[],'A split stance can increase base control without changing hand count, rack, side, or strict press action.','{"when":["square_stance_balance_or_trunk_control_limits_quality"]}'::JSONB),
      ('single-arm-split-stance-sleeve-grip-strict','two-hand-square-stance-sleeve-grip-strict','regression',80,ARRAY['hand_count','laterality','grip','trunk_control']::TEXT[],'Two-hand support reduces unilateral grip, rack, and anti-motion demand while preserving the fixed arc.','{"when":["unilateral_grip_rack_or_trunk_control_limits_quality"]}'::JSONB),
      ('two-hand-square-stance-sleeve-grip-strict','two-hand-square-stance-neutral-handle-strict','equipment_equivalent',88,ARRAY['attachment','grip','wrist_position','loading']::TEXT[],'The neutral handle changes the interface and loading potential while preserving two-hand square-stance strict pressing.','{"requires":["compatible_rated_handle","new_load_selected_for_exact_attachment"]}'::JSONB),
      ('two-hand-square-stance-neutral-handle-strict','two-hand-square-stance-ball-grip-strict','equipment_equivalent',78,ARRAY['attachment','grip','forearm_demand','loading']::TEXT[],'Both attachments preserve the strict two-hand press but differ in grip geometry, forearm demand, and load handling.','{"requires":["compatible_rated_attachment","grip_and_wrist_control_reassessed"]}'::JSONB)
  ) AS relationship(
    from_key,
    to_key,
    relationship,
    similarity,
    dimensions,
    reason,
    conditions
  )
  JOIN coaching.exercise_variant_v1 from_variant
    ON from_variant.definition_id = target_definition_id
   AND from_variant.variant_key = relationship.from_key
  JOIN coaching.exercise_variant_v1 to_variant
    ON to_variant.definition_id = target_definition_id
   AND to_variant.variant_key = relationship.to_key
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
    created_by,
    reviewed_by,
    review_notes,
    reviewed_at
  )
  SELECT
    facility,
    variant.id,
    calibration.dimension,
    calibration.score,
    CASE
      WHEN calibration.score < 30 THEN 20
      WHEN calibration.score < 50 THEN 40
      WHEN calibration.score < 70 THEN 60
      ELSE 80
    END,
    calibration.rationale,
    'review',
    1,
    NULL,
    NULL,
    'Independent calibration review required; this migration does not approve the proposed score.',
    NULL
  FROM coaching.exercise_variant_v1 variant
  CROSS JOIN LATERAL (
    VALUES
      (
        'technicalComplexity',
        (variant.difficulty_json ->> 'technicalComplexity')::SMALLINT,
        'Proposed exercise complexity from anchor and equipment setup, stance, hand count, side, attachment, grip, rack, fixed arc, scapular motion, trunk control, range, tempo, return, and finish.'
      ),
      (
        'absoluteLoadDemand',
        (variant.difficulty_json ->> 'absoluteLoadDemand')::SMALLINT,
        'Proposed physical difficulty from bar and plate mass, bar angle, hand count, attachment, grip, range, repetitions, local pressing fatigue, and controlled lowering.'
      ),
      (
        'technicalFatigueSensitivity',
        (variant.fatigue_profile_json ->>
          'technicalFatigueSensitivity')::SMALLINT,
        'Proposed from anchor awareness, stance and foot-pressure loss, rib flare, back extension, rotation, wrist or grip change, leg drive, path drift, shortened range, and uncontrolled lowering under fatigue.'
      )
  ) AS calibration(dimension, score, rationale)
  WHERE variant.definition_id = target_definition_id
    AND variant.status <> 'archived'
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
  VALUES (
    target_definition_id,
    facility,
    target_card_version,
    '1.0.0',
    'canonical-card-audit-v1',
    'quarantined',
    '[]'::JSONB,
    jsonb_build_array(
      jsonb_build_object(
        'code', 'media_human_review_required',
        'message',
          'Five oEmbed-healthy candidates require playback, complete viewing, exact-variant, cue, safety, caption, accessibility, demonstration-quality, reviewer, and approval review.'
      ),
      jsonb_build_object(
        'code', 'alternate_boundary_human_review_required',
        'message',
          'Five exact variants, four existing separate definitions, one proposed throw definition, and two modifier classifications require accountable human review.'
      ),
      jsonb_build_object(
        'code', 'graph_human_review_required',
        'message',
          'Six progression, regression, and equipment-equivalent proposals require coach approval.'
      ),
      jsonb_build_object(
        'code', 'calibration_human_review_required',
        'message',
          'Exercise-complexity, physical-difficulty, and technical-fatigue proposals require independent calibration.'
      ),
      jsonb_build_object(
        'code', 'athlete_coach_pilot_required',
        'message',
          'Athlete comprehension, coach scoring, equipment checks, dose tolerance, side recording, and station logistics require representative pilot evidence.'
      ),
      jsonb_build_object(
        'code', 'publication_approval_required',
        'message',
          'The completed candidate card remains in review and requires current two-person publication approval.'
      )
    ),
    TRUE,
    now()
  )
  ON CONFLICT (definition_id)
  DO UPDATE SET
    facility_id = EXCLUDED.facility_id,
    card_version = EXCLUDED.card_version,
    schema_version = EXCLUDED.schema_version,
    audit_version = EXCLUDED.audit_version,
    status = 'quarantined',
    checks_json = EXCLUDED.checks_json,
    blocking_issues_json = EXCLUDED.blocking_issues_json,
    human_review_required = TRUE,
    checked_at = now();
END;
$$;
