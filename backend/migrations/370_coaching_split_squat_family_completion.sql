-- Complete the stationary Split Squat and Rear-Foot-Elevated Split Squat
-- (Bulgarian Split Squat) candidate cards after migration 369.
--
-- The two cards remain separate because rear-foot floor contact versus
-- rear-foot elevation changes support geometry, balance, rear-limb
-- contribution, setup, failure modes, and substitution behavior.
--
-- Exercise difficulty contains exercise complexity and physical difficulty;
-- overall is derived as their maximum. No exercise proficiency classification
-- or human-controlled approval is created. Media candidates have public
-- oEmbed title/channel health only. IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT := '370_coaching_split_squat_family_completion';
  definition RECORD;
  protected_records INTEGER;
  unexpected_variants INTEGER;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_definition_v1
    WHERE facility_id = 1
      AND slug IN (
        'barbell-split-squat',
        'bodyweight-split-squat',
        'front-rack-kettlebell-split-squat',
        'sandbag-split-squat-strength',
        'slow-eccentric-split-squat',
        'split-squat-eccentric-to-pause'
      )
      AND status <> 'archived'
  ) THEN
    RAISE EXCEPTION '% requires migration 369 first', migration_key;
  END IF;

  FOR definition IN
    SELECT id, slug, card_version
    FROM coaching.exercise_definition_v1
    WHERE facility_id = 1
      AND slug IN ('split-squat', 'bulgarian-split-squat')
      AND status <> 'archived'
    ORDER BY slug
  LOOP
    SELECT
      (
        SELECT COUNT(*)
        FROM coaching.exercise_definition_v1
        WHERE id = definition.id
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
        WHERE definition_id = definition.id
          AND review_status NOT IN ('candidate', 'superseded')
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_media_candidate_v1
        WHERE definition_id = definition.id
          AND review_status NOT IN ('candidate', 'superseded')
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_alternate_assessment_v1
        WHERE definition_id = definition.id
          AND review_status NOT IN ('candidate', 'superseded')
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_card_review_v1
        WHERE definition_id = definition.id
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_card_revision_v1
        WHERE definition_id = definition.id
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_media_review_v1
        WHERE definition_id = definition.id
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_variant_v1
        WHERE definition_id = definition.id
          AND status = 'published'
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_delivery_profile_v1 profile
        JOIN coaching.exercise_variant_v1 variant
          ON variant.id = profile.variant_id
        WHERE variant.definition_id = definition.id
          AND profile.status = 'published'
      )
      + (
        SELECT COUNT(*)
        FROM coaching.exercise_relationship_v1 relationship
        WHERE (
          relationship.from_variant_id IN (
            SELECT id
            FROM coaching.exercise_variant_v1
            WHERE definition_id = definition.id
          )
          OR relationship.to_variant_id IN (
            SELECT id
            FROM coaching.exercise_variant_v1
            WHERE definition_id = definition.id
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
        WHERE variant.definition_id = definition.id
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
          WHERE source.definition_id = definition.id
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
        '% refused to overwrite % protected record(s) for %',
        migration_key,
        protected_records,
        definition.slug;
    END IF;

    SELECT COUNT(*)
    INTO unexpected_variants
    FROM coaching.exercise_variant_v1
    WHERE definition_id = definition.id
      AND status <> 'archived'
      AND variant_key NOT IN (
        'baseline',
        'bodyweight-standard',
        'supported-bodyweight-standard',
        'two-dumbbell-suitcase',
        'barbell-back-rack',
        'single-kettlebell-front-rack',
        'double-kettlebell-front-rack',
        'sandbag-front-hold',
        'bodyweight-slow-eccentric-pause',
        'bodyweight-rear-foot-elevated',
        'supported-bodyweight-rear-foot-elevated',
        'two-dumbbell-suitcase-rear-foot-elevated',
        'barbell-back-rack-rear-foot-elevated',
        'single-kettlebell-goblet-rear-foot-elevated',
        'bodyweight-slow-eccentric-pause-rear-foot-elevated'
      );

    IF unexpected_variants > 0 THEN
      RAISE EXCEPTION
        '% found % unexpected active variant(s) for %',
        migration_key,
        unexpected_variants,
        definition.slug;
    END IF;
  END LOOP;

  IF (
    SELECT COUNT(*)
    FROM coaching.exercise_definition_v1
    WHERE facility_id = 1
      AND slug IN ('split-squat', 'bulgarian-split-squat')
      AND status <> 'archived'
  ) <> 2 THEN
    RAISE EXCEPTION
      '% requires both active Split Squat survivors',
      migration_key;
  END IF;

  UPDATE coaching.exercise_variant_v1
  SET variant_key =
        'legacy-underspecified-source-' || left(id::TEXT, 8),
      status = 'archived',
      requirements_json = requirements_json || jsonb_build_object(
        'selectable', FALSE,
        'identityQuarantine', TRUE,
        'quarantineReason',
          'The legacy baseline does not fully declare support geometry, stance, side, implement, load position, load, range, tempo, dose, finish, pickup, or set-down.'
      ),
      updated_at = now()
  WHERE definition_id IN (
      SELECT id
      FROM coaching.exercise_definition_v1
      WHERE facility_id = 1
        AND slug IN ('split-squat', 'bulgarian-split-squat')
        AND status <> 'archived'
    )
    AND variant_key = 'baseline';

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET status = 'archived',
      updated_at = now()
  FROM coaching.exercise_variant_v1 variant
  WHERE variant.id = profile.variant_id
    AND variant.status = 'archived'
    AND variant.definition_id IN (
      SELECT id
      FROM coaching.exercise_definition_v1
      WHERE facility_id = 1
        AND slug IN ('split-squat', 'bulgarian-split-squat')
        AND status <> 'archived'
    );

  UPDATE coaching.exercise_definition_v1
  SET card_version = CASE
        WHEN provenance_json->>'structuralCompletionMigration'
          IS DISTINCT FROM migration_key
          THEN card_version + 1
        ELSE card_version
      END,
      canonical_name = 'Split Squat',
      display_name = 'Split Squat',
      description =
        'From a stationary side-specific split stance with the rear forefoot on the floor, declare the lead side, stance, support, implement, load position, load, range, tempo, repetitions, rest, and finish. Brace, lower both knees through the owned pain-free range while the lead foot stays connected and the knee tracks with it, then drive through the lead leg to the same balanced split stance without stepping.',
      family_key = 'stationary_split_stance_squat',
      movement_patterns = ARRAY['squat', 'brace']::TEXT[],
      body_regions = ARRAY[
        'foot', 'ankle', 'knee', 'hip', 'glutes', 'hamstring',
        'core', 'spine', 'shoulder', 'elbow', 'wrist', 'hand'
      ]::TEXT[],
      required_equipment = ARRAY['none']::TEXT[],
      optional_equipment = ARRAY[
        'wall', 'rack', 'dumbbell', 'barbell', 'kettlebell', 'sandbag'
      ]::TEXT[],
      environment_json = '{
        "surface":{"required":"level_dry_stable_high_traction","avoid":["wet","uneven","soft_unstable","cluttered"]},
        "space":{"stationaryFootprintMeters":{"length":2.5,"width":1.5},"clearPickupAndSetDownZone":true,"crossTrafficProhibited":true},
        "setup":{"rearForefootRemainsOnFloor":true,"stanceSideRangeTempoLoadAndFinishDeclared":true,"supportAndLoadSecure":true},
        "observation":{"coachCanSeeBothFeetKneesPelvisTrunkAndLoad":true,"videoOnlyWithConsentAndPolicy":true},
        "traffic":{"oneActiveAthletePerStation":true,"unusedLoadsOutsideStation":true}
      }'::JSONB,
      population_json = '{
        "prerequisites":["pain_free_stationary_split_stance","can_lower_and_return_without_stepping","can_control_lead_foot_knee_pelvis_trunk_and_breathing","can_follow_side_range_tempo_load_finish_and_stop_rules"],
        "useCaution":["current_foot_ankle_knee_hip_groin_or_back_symptoms","meaningful_side_difference","limited_split_stance_range_or_balance","fatigue_from_prior_sprint_jump_squat_or_lunge_work","loaded_variant_with_limited_pickup_or_set_down_control"],
        "doNotUseWhen":["pain_numbness_dizziness_giving_way_or_apprehension","unsafe_surface_station_support_or_load","cannot_hold_stationary_split_stance","knee_pelvis_trunk_or_balance_control_is_not_repeatable","fatigue_already_changes_stance_or_repetition"],
        "regressionOrder":["add_stable_hand_support","remove_external_load","shorten_range","adjust_stance","reduce_repetitions","increase_rest"],
        "individualizationRequired":true,
        "medicalScope":"This card is not diagnosis, rehabilitation, or medical clearance; follow the athlete care plan and local scope."
      }'::JSONB,
      anatomy_json = '{
        "primaryMuscles":["lead_quadriceps","lead_gluteus_maximus","lead_adductor_magnus"],
        "secondaryMuscles":["hamstrings","gluteus_medius_and_minimus","adductors","gastrocnemius","soleus","hip_flexors"],
        "stabilizers":["foot_intrinsics","ankle_stabilizers","hip_abductors_and_external_rotators","abdominal_wall","spinal_stabilizers","optional_scapular_grip_and_forearm_stabilizers"],
        "joints":["foot","ankle","knee","hip","pelvis","lumbar_spine","thoracic_spine","optional_shoulder_elbow_wrist_and_hand"],
        "jointActions":["lead_ankle_dorsiflexion_and_plantarflexion","lead_knee_flexion_and_extension","bilateral_hip_flexion_and_extension","rear_ankle_plantarflexed_support","pelvic_and_spinal_stabilization","optional_scapular_and_grip_stabilization"],
        "planes":["sagittal","frontal_control","transverse_control"],
        "laterality":"asymmetrical_bilateral_support_with_lead_leg_bias",
        "lateralityNote":"Declare lead side and record meaningful differences without assuming perfect symmetry.",
        "kineticChain":"stationary_asymmetrical_closed_chain_lower_body",
        "evidenceLimit":"Step length, trunk angle, load, range, anthropometry, footwear, and instruction alter joint motion and demand; the card does not claim one universal stance or muscle-isolation outcome."
      }'::JSONB,
      athlete_support_json = '{
        "whyItMatters":"Builds side-specific lower-body strength and control while both feet remain supported in a stationary split stance.",
        "primaryCue":"Set the split, keep the front foot heavy, lower under control, track the knee, and stand back to the same stance.",
        "beforeYouStart":["confirm_lead_side_stance_support_load_range_tempo_repetitions_rest_and_finish","clear_the_station_and_secure_support_or_load","rehearse_one_pain_free_bodyweight_repetition_per_side","identify_stop_and_set_down_plan"],
        "expectedSensations":["lead_quadriceps_and_glute_effort","controlled_ankle_knee_and_hip_range","balance_and_trunk_bracing","optional_grip_or_load_position_effort"],
        "unexpectedSensations":["sharp_or_increasing_pain","joint_pinching","numbness_or_tingling","giving_way","dizziness","loss_of_load_or_balance_control"],
        "selfChecks":["feet_remain_in_the_declared_stationary_stance","front_foot_stays_connected","front_knee_tracks_with_the_foot","pelvis_and_trunk_remain_organized","rear_leg_assists_without_driving_the_rep","finish_and_set_down_are_controlled"],
        "painGuidance":"Stop and report pain, pinching, numbness, giving way, dizziness, balance loss, load loss, or a position you cannot restore.",
        "accessibility":["stable_hand_support","bodyweight_loading","shorter_pain_free_range","adjusted_stance","fewer_repetitions","longer_rest","written_audio_still_image_or_live_demonstration"],
        "mediaAlternatives":["written_exact_variant_contract","front_and_side_stills","slow_walkthrough","qualified_live_demonstration"],
        "afterSetCheck":["record_variant_side_stance_load_range_tempo_quality_repetitions_rest_symptoms_and_stop_reason"]
      }'::JSONB,
      coach_support_json = '{
        "observationChecklist":["surface_station_and_footwear","lead_side_and_stance_length_width","front_foot_pressure_and_rear_forefoot_contact","knee_path_and_owned_range","pelvis_trunk_balance_and_breathing","support_implement_load_position_and_path","tempo_finish_side_change_pickup_and_set_down","side_difference_and_fatigue"],
        "faultCorrections":{"stepping_or_balance_loss":["add_stable_support","remove_load","adjust_stance_or_range"],"front_knee_or_foot_control_loss":["reduce_range_or_load","restore_whole_foot_pressure_and_knee_path"],"rear_leg_drives_rep":["shift_center_of_mass_to_lead_leg","reduce_load_and_rehearse"],"pelvis_or_trunk_change":["shorten_range","reduce_load","restore_brace"],"unsafe_pickup_or_set_down":["end_set","clear_station","select_bodyweight_or_safer_load_position"]},
        "demonstrationPlan":["show_stationary_split_stance_and_rear_forefoot_floor_contact","show_lead_leg_biased_descent_and_ascent","show_exact_support_or_load_and_safe_set_down","contrast_rear_foot_elevation_stepping_lunge_isometric_hold_and_jump"],
        "groupManagement":["one_active_athlete_per_station","loads_and_return_paths_outside_active_station","coach_outside_fall_and_set_down_paths","side_and_repetition_counting_standardized"],
        "modificationDecisionTree":{"symptom_or_hazard":"stop","stance_or_balance_unstable":"add_support_remove_load_or_adjust_stance","knee_pelvis_or_trunk_control_lost":"reduce_range_load_or_repetitions","quality_repeatable":"change_only_one_load_range_tempo_or_dose_variable"},
        "doNotUseWhen":["pain_neurologic_symptom_giving_way_dizziness_or_apprehension","unsafe_surface_station_support_or_load","stationary_stance_cannot_be_maintained","lead_foot_knee_pelvis_trunk_or_balance_control_is_not_repeatable","fatigue_changes_repetition_or_safe_set_down"],
        "recordingFields":["variant_key","lead_side","stance_length_and_width","support","implement","load_position","load","range","tempo","quality_repetitions","rest","side_difference","symptoms","stop_reason"]
      }'::JSONB,
      support_operations_json = '{
        "supportSummary":"Do not improve load, depth, or repetition count by accepting stepping, rear-leg push-off, foot-pressure loss, knee collapse, pelvic or trunk compensation, symptoms, or unsafe load handling.",
        "issueCategories":["identity_or_variant","difficulty_or_dose","surface_station_or_load","symptom_or_population_constraint","instruction_or_accessibility","media_exact_match","relationship","calibration"],
        "supportEscalation":{"urgent":["fall_dropped_load_or_acute_event","neurologic_or_cardiovascular_symptom"],"coachReview":["repeated_stance_knee_pelvis_or_trunk_fault","meaningful_side_difference","unclear_load_range_or_dose"],"contentReview":["identity_boundary_conflict","media_mismatch","missing_accessibility_or_stop_rule"]},
        "retentionPolicy":"Retain card version, exact variant, lead side, stance, support, implement, load, range, tempo, dose, quality, side difference, symptoms, stop reason, substitution, media metadata, and reviewer decisions according to facility policy.",
        "knownLimitations":["candidate_media_not_human_viewed","no_universal_stance_depth_or_load","scores_doses_edges_and_calibrations_are_unapproved_proposals"],
        "changeImpactPolicy":"Changes to stance, rear-foot support, stepping, contraction type, flight, implement, load position, difficulty, dose, stop rule, relationship, or media require a new card version and renewed affected reviews."
      }'::JSONB,
      content_confidence = 88,
      scoring_confidence = 66,
      media_confidence = 55,
      status = 'review',
      approved_video_url = NULL,
      reviewed_by = NULL,
      approved_by = NULL,
      last_reviewed_at = NULL,
      provenance_json = provenance_json || jsonb_build_object(
        'structuralCompletionMigration', migration_key,
        'researchBatch', 'split-squat-family-v1',
        'researchVersion', '2026-07-27.53',
        'difficultyModel',
          'max_exercise_complexity_physical_difficulty',
        'evidenceState', 'candidate_requires_human_review',
        'mediaState',
          'five_oembed_healthy_candidates_require_full_human_review',
        'humanReviewRequired', TRUE,
        'publicationQuarantined', TRUE,
        'graphApprovalCreated', FALSE,
        'calibrationApprovalCreated', FALSE,
        'mediaApprovalCreated', FALSE
      ),
      updated_at = now()
  WHERE facility_id = 1
    AND slug = 'split-squat'
    AND status <> 'archived';

  UPDATE coaching.exercise_definition_v1
  SET card_version = CASE
        WHEN provenance_json->>'structuralCompletionMigration'
          IS DISTINCT FROM migration_key
          THEN card_version + 1
        ELSE card_version
      END,
      canonical_name = 'Rear-Foot-Elevated Split Squat',
      display_name = 'Rear-Foot-Elevated Split Squat (Bulgarian)',
      description =
        'From a stationary side-specific split stance, place the rear foot on a stable declared support and keep the whole lead foot on the floor. Declare support height/contact, lead side, stance, support, implement, load position, load, range, tempo, repetitions, rest, and finish. Brace, lower through the owned pain-free range, then drive through the lead leg to the same balanced rear-foot-elevated stance.',
      family_key = 'rear_foot_elevated_stationary_split_squat',
      movement_patterns = ARRAY['squat', 'brace']::TEXT[],
      body_regions = ARRAY[
        'foot', 'ankle', 'knee', 'hip', 'glutes', 'hamstring',
        'core', 'spine', 'shoulder', 'elbow', 'wrist', 'hand'
      ]::TEXT[],
      required_equipment = ARRAY['bench']::TEXT[],
      optional_equipment = ARRAY[
        'box', 'wall', 'rack', 'dumbbell', 'barbell', 'kettlebell'
      ]::TEXT[],
      environment_json = '{
        "surface":{"required":"level_dry_stable_high_traction","avoid":["wet","uneven","soft_unstable","cluttered"]},
        "space":{"stationaryFootprintMeters":{"length":3,"width":1.5},"clearPickupAndSetDownZone":true,"crossTrafficProhibited":true},
        "rearFootSupport":{"required":"stable_nonslip_declared_height_and_contact","mustNotMoveOrTip":true,"athleteCanExitSafely":true},
        "setup":{"leadSideStanceSupportHeightContactRangeTempoLoadAndFinishDeclared":true,"loadAndHandSupportSecure":true},
        "observation":{"coachCanSeeLeadFootBothKneesPelvisTrunkRearSupportAndLoad":true,"videoOnlyWithConsentAndPolicy":true},
        "traffic":{"oneActiveAthletePerStation":true,"unusedLoadsOutsideStation":true}
      }'::JSONB,
      population_json = '{
        "prerequisites":["pain_free_stationary_split_squat","can_place_and_remove_rear_foot_safely","whole_lead_foot_and_knee_control_are_repeatable","can_control_rear_foot_elevated_descent_and_return_without_stepping","can_follow_support_side_range_tempo_load_finish_and_stop_rules"],
        "useCaution":["current_foot_ankle_knee_hip_groin_or_back_symptoms","meaningful_side_difference","limited_rear_hip_or_lead_ankle_range","balance_or_support_height_uncertainty","fatigue_from_prior_sprint_jump_squat_or_lunge_work"],
        "doNotUseWhen":["pain_numbness_dizziness_giving_way_or_apprehension","unsafe_floor_rear_support_station_or_load","cannot_enter_or_exit_rear_foot_support_safely","lead_foot_knee_pelvis_trunk_or_balance_control_is_not_repeatable","fatigue_already_changes_support_contact_or_repetition"],
        "regressionOrder":["return_to_floor_based_split_squat","add_stable_hand_support","remove_external_load","lower_rear_support","shorten_range","reduce_repetitions","increase_rest"],
        "individualizationRequired":true,
        "medicalScope":"This card is not diagnosis, rehabilitation, or medical clearance; follow the athlete care plan and local scope."
      }'::JSONB,
      anatomy_json = '{
        "primaryMuscles":["lead_quadriceps","lead_gluteus_maximus","lead_adductor_magnus"],
        "secondaryMuscles":["hamstrings","gluteus_medius_and_minimus","adductors","gastrocnemius","soleus","rear_hip_flexors"],
        "stabilizers":["foot_intrinsics","ankle_stabilizers","hip_abductors_and_external_rotators","abdominal_wall","spinal_stabilizers","optional_scapular_grip_and_forearm_stabilizers"],
        "joints":["lead_foot_and_ankle","lead_and_rear_knee","lead_and_rear_hip","pelvis","lumbar_spine","thoracic_spine","optional_shoulder_elbow_wrist_and_hand"],
        "jointActions":["lead_ankle_dorsiflexion_and_plantarflexion","lead_knee_flexion_and_extension","bilateral_hip_flexion_and_extension","rear_knee_flexion_and_extension","pelvic_and_spinal_stabilization","optional_scapular_and_grip_stabilization"],
        "planes":["sagittal","frontal_control","transverse_control"],
        "laterality":"asymmetrical_bilateral_support_with_rear_foot_elevation_and_lead_leg_bias",
        "lateralityNote":"Declare lead side, rear-support contact, and side order; record meaningful differences without assuming perfect symmetry.",
        "kineticChain":"stationary_asymmetrical_closed_chain_with_rear_foot_external_support",
        "evidenceLimit":"Rear-foot support, stance width, trunk angle, load, range, anthropometry, and instruction alter joint demand; this card does not prescribe one universal support height, stance, or muscle-isolation outcome."
      }'::JSONB,
      athlete_support_json = '{
        "whyItMatters":"Builds side-specific leg strength while the rear foot is elevated, increasing support, balance, and setup demands relative to a floor-based split squat.",
        "primaryCue":"Set the rear foot, own the whole front foot, lower under control, drive through the front leg, and finish balanced.",
        "beforeYouStart":["confirm_rear_support_height_contact_lead_side_stance_support_load_range_tempo_repetitions_rest_and_finish","test_that_the_rear_support_cannot_move_or_tip","rehearse_entry_exit_and_one_pain_free_bodyweight_repetition_per_side","identify_stop_and_set_down_plan"],
        "expectedSensations":["lead_quadriceps_and_glute_effort","controlled_lead_ankle_knee_and_hip_range","rear_hip_and_balance_demand","trunk_bracing","optional_grip_or_load_position_effort"],
        "unexpectedSensations":["sharp_or_increasing_pain","lead_hip_or_knee_pinching","rear_foot_or_hip_discomfort","numbness_or_tingling","giving_way","dizziness","support_load_or_balance_loss"],
        "selfChecks":["rear_support_stays_stable","whole_front_foot_stays_connected","front_knee_tracks_with_the_foot","rear_leg_supports_without_driving_the_rep","pelvis_and_trunk_remain_organized","entry_finish_exit_and_set_down_are_controlled"],
        "painGuidance":"Stop and report pain, pinching, numbness, giving way, dizziness, support movement, balance loss, load loss, or a position you cannot restore.",
        "accessibility":["floor_based_split_squat","lower_rear_support","stable_hand_support","bodyweight_loading","shorter_pain_free_range","fewer_repetitions","longer_rest","written_audio_still_image_or_live_demonstration"],
        "mediaAlternatives":["written_exact_variant_contract","support_setup_diagram","front_and_side_stills","slow_walkthrough","qualified_live_demonstration"],
        "afterSetCheck":["record_variant_side_support_height_and_contact_stance_load_range_tempo_quality_repetitions_rest_symptoms_and_stop_reason"]
      }'::JSONB,
      coach_support_json = '{
        "observationChecklist":["surface_station_footwear_and_rear_support","lead_side_stance_length_width_and_support_contact","entry_and_exit","whole_lead_foot_pressure_and_knee_path","rear_leg_contribution","pelvis_trunk_balance_and_breathing","implement_load_position_and_path","range_tempo_finish_pickup_and_set_down","side_difference_and_fatigue"],
        "faultCorrections":{"support_or_entry_unstable":["stop","lower_or_replace_support","return_to_floor_based_split_squat"],"front_knee_or_foot_control_loss":["reduce_range_support_height_or_load","restore_whole_foot_pressure_and_knee_path"],"rear_leg_drives_rep":["adjust_stance_and_support_contact","reduce_load","cue_front_leg"],"pelvis_or_trunk_change":["shorten_range","reduce_load","restore_brace"],"unsafe_pickup_or_set_down":["end_set","clear_station","select_bodyweight_or_safer_load_position"]},
        "demonstrationPlan":["show_rear_support_inspection_height_contact_entry_and_exit","show_lead_leg_biased_descent_and_ascent","show_exact_hand_support_or_load_and_safe_set_down","contrast_floor_based_split_squat_isometric_hold_suspension_jump_and_stepping_lunge"],
        "groupManagement":["one_active_athlete_per_rear_support_station","supports_loads_and_return_paths_separated","inspect_support_before_each_athlete_or_adjustment","coach_outside_fall_entry_exit_and_set_down_paths"],
        "modificationDecisionTree":{"symptom_or_hazard":"stop","support_entry_or_balance_unstable":"return_to_floor_based_split_squat_or_add_support","knee_pelvis_or_trunk_control_lost":"reduce_support_height_range_load_or_repetitions","quality_repeatable":"change_only_one_support_load_range_tempo_or_dose_variable"},
        "doNotUseWhen":["pain_neurologic_symptom_giving_way_dizziness_or_apprehension","unsafe_floor_rear_support_station_or_load","rear_foot_entry_or_exit_is_not_controlled","lead_foot_knee_pelvis_trunk_or_balance_control_is_not_repeatable","fatigue_changes_support_contact_repetition_or_set_down"],
        "recordingFields":["variant_key","lead_side","rear_support_type_height_and_contact","stance_length_and_width","hand_support","implement","load_position","load","range","tempo","quality_repetitions","rest","side_difference","symptoms","stop_reason"]
      }'::JSONB,
      support_operations_json = '{
        "supportSummary":"Do not improve load, depth, or repetition count by accepting support movement, unsafe entry or exit, rear-leg push-off, lead-foot or knee control loss, pelvic or trunk compensation, symptoms, or unsafe load handling.",
        "issueCategories":["identity_or_variant","difficulty_or_dose","rear_support_station_or_load","symptom_or_population_constraint","instruction_or_accessibility","media_exact_match","relationship","calibration"],
        "supportEscalation":{"urgent":["fall_support_failure_dropped_load_or_acute_event","neurologic_or_cardiovascular_symptom"],"coachReview":["repeated_support_stance_knee_pelvis_or_trunk_fault","meaningful_side_difference","unclear_support_height_load_range_or_dose"],"contentReview":["identity_boundary_conflict","media_mismatch","missing_accessibility_or_stop_rule"]},
        "retentionPolicy":"Retain card version, exact variant, lead side, rear-support type/height/contact, stance, hand support, implement, load, range, tempo, dose, quality, side difference, symptoms, stop reason, substitution, media metadata, and reviewer decisions according to facility policy.",
        "knownLimitations":["candidate_media_not_human_viewed","no_universal_rear_support_height_stance_depth_or_load","scores_doses_edges_and_calibrations_are_unapproved_proposals"],
        "changeImpactPolicy":"Changes to rear-foot support, stance, stepping, contraction type, flight, implement, load position, difficulty, dose, stop rule, relationship, or media require a new card version and renewed affected reviews."
      }'::JSONB,
      content_confidence = 88,
      scoring_confidence = 66,
      media_confidence = 55,
      status = 'review',
      approved_video_url = NULL,
      reviewed_by = NULL,
      approved_by = NULL,
      last_reviewed_at = NULL,
      provenance_json = provenance_json || jsonb_build_object(
        'structuralCompletionMigration', migration_key,
        'identityBoundary',
          'rear_foot_floor_contact_vs_rear_foot_elevation',
        'researchBatch', 'split-squat-family-v1',
        'researchVersion', '2026-07-27.53',
        'difficultyModel',
          'max_exercise_complexity_physical_difficulty',
        'evidenceState', 'candidate_requires_human_review',
        'mediaState',
          'five_oembed_healthy_candidates_require_full_human_review',
        'humanReviewRequired', TRUE,
        'publicationQuarantined', TRUE,
        'graphApprovalCreated', FALSE,
        'calibrationApprovalCreated', FALSE,
        'mediaApprovalCreated', FALSE
      ),
      updated_at = now()
  WHERE facility_id = 1
    AND slug = 'bulgarian-split-squat'
    AND status <> 'archived';

  UPDATE coaching.exercise_definition_v1 target_definition
  SET aliases = ARRAY(
        SELECT min(alias)
        FROM unnest(COALESCE(target_definition.aliases, '{}')) alias
        WHERE nullif(btrim(alias), '') IS NOT NULL
          AND lower(alias) NOT IN (
            lower(target_definition.canonical_name),
            lower(target_definition.display_name)
          )
        GROUP BY lower(alias)
        ORDER BY lower(alias)
      ),
      updated_at = now()
  WHERE target_definition.facility_id = 1
    AND target_definition.slug IN ('split-squat', 'bulgarian-split-squat')
    AND target_definition.status <> 'archived';
END;
$$;

CREATE TEMP TABLE split_squat_variant_seed (
  definition_slug TEXT NOT NULL,
  variant_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  support_contract TEXT NOT NULL,
  implement_key TEXT NOT NULL,
  implement_quantity TEXT NOT NULL,
  load_position TEXT NOT NULL,
  tempo_contract TEXT NOT NULL,
  exercise_complexity SMALLINT NOT NULL,
  physical_difficulty SMALLINT NOT NULL,
  coordination_demand SMALLINT NOT NULL,
  supervision_demand SMALLINT NOT NULL,
  failure_consequence SMALLINT NOT NULL,
  work_capacity_demand SMALLINT NOT NULL,
  grip_demand SMALLINT NOT NULL,
  spinal_loading SMALLINT NOT NULL,
  eccentric_stress SMALLINT NOT NULL,
  local_muscle_fatigue SMALLINT NOT NULL,
  grip_fatigue SMALLINT NOT NULL,
  technical_fatigue_sensitivity SMALLINT NOT NULL,
  recovery_hours SMALLINT NOT NULL,
  equipment_required TEXT[] NOT NULL
);

INSERT INTO split_squat_variant_seed VALUES
  ('split-squat','supported-bodyweight-standard','Split Squat — Supported Bodyweight','stable_hand_support','bodyweight','none','none','controlled_standard',28,26,32,28,26,36,1,12,38,42,1,36,24,ARRAY['none','rack']::TEXT[]),
  ('split-squat','bodyweight-standard','Split Squat — Bodyweight','unsupported','bodyweight','none','none','controlled_standard',34,32,40,32,32,42,1,16,42,48,1,44,30,ARRAY['none']::TEXT[]),
  ('split-squat','two-dumbbell-suitcase','Split Squat — Two Dumbbells','unsupported','dumbbell','two','bilateral_suitcase','controlled_standard',42,48,46,40,44,50,50,38,48,56,48,50,42,ARRAY['dumbbell']::TEXT[]),
  ('split-squat','barbell-back-rack','Split Squat — Barbell Back Rack','unsupported','barbell','one','back_rack','controlled_standard',52,62,54,58,68,58,28,62,56,66,28,60,54,ARRAY['barbell','rack']::TEXT[]),
  ('split-squat','single-kettlebell-front-rack','Split Squat — Single Kettlebell Front Rack','unsupported','kettlebell','one','unilateral_front_rack','controlled_standard',46,46,54,44,46,48,46,40,48,54,44,54,42,ARRAY['kettlebell']::TEXT[]),
  ('split-squat','double-kettlebell-front-rack','Split Squat — Double Kettlebell Front Rack','unsupported','kettlebell','two','bilateral_front_rack','controlled_standard',50,56,56,50,56,54,58,52,52,62,56,58,48,ARRAY['kettlebell']::TEXT[]),
  ('split-squat','sandbag-front-hold','Split Squat — Sandbag Front Hold','unsupported','sandbag','one','front_hold','controlled_standard',44,50,48,46,50,52,48,48,50,58,46,54,42,ARRAY['sandbag']::TEXT[]),
  ('split-squat','bodyweight-slow-eccentric-pause','Split Squat — Slow Eccentric and Pause','unsupported','bodyweight','none','none','three_to_five_second_lower_two_second_pause',44,42,50,40,40,56,1,18,66,62,1,62,42,ARRAY['none']::TEXT[]),
  ('bulgarian-split-squat','supported-bodyweight-rear-foot-elevated','Rear-Foot-Elevated Split Squat — Supported Bodyweight','rear_foot_elevated_plus_stable_hand_support','bodyweight','none','none','controlled_standard',36,36,44,38,36,44,1,16,44,50,1,48,30,ARRAY['bench','rack']::TEXT[]),
  ('bulgarian-split-squat','bodyweight-rear-foot-elevated','Rear-Foot-Elevated Split Squat — Bodyweight','rear_foot_elevated','bodyweight','none','none','controlled_standard',44,42,52,44,44,48,1,20,48,54,1,54,36,ARRAY['bench']::TEXT[]),
  ('bulgarian-split-squat','two-dumbbell-suitcase-rear-foot-elevated','Rear-Foot-Elevated Split Squat — Two Dumbbells','rear_foot_elevated','dumbbell','two','bilateral_suitcase','controlled_standard',50,54,56,48,54,56,52,42,54,62,50,60,48,ARRAY['bench','dumbbell']::TEXT[]),
  ('bulgarian-split-squat','barbell-back-rack-rear-foot-elevated','Rear-Foot-Elevated Split Squat — Barbell Back Rack','rear_foot_elevated','barbell','one','back_rack','controlled_standard',60,68,64,66,76,64,30,68,60,72,30,68,60,ARRAY['bench','barbell','rack']::TEXT[]),
  ('bulgarian-split-squat','single-kettlebell-goblet-rear-foot-elevated','Rear-Foot-Elevated Split Squat — Kettlebell Goblet','rear_foot_elevated','kettlebell','one','goblet','controlled_standard',52,52,58,50,54,54,50,46,54,60,48,62,48,ARRAY['bench','kettlebell']::TEXT[]),
  ('bulgarian-split-squat','bodyweight-slow-eccentric-pause-rear-foot-elevated','Rear-Foot-Elevated Split Squat — Slow Eccentric and Pause','rear_foot_elevated','bodyweight','none','none','three_to_five_second_lower_two_second_pause',52,50,60,50,50,62,1,22,70,68,1,68,48,ARRAY['bench']::TEXT[]);

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
  ARRAY[
    seed.support_contract,
    seed.implement_key,
    seed.implement_quantity,
    seed.load_position,
    seed.tempo_contract,
    'stationary_split_stance'
  ]::TEXT[],
  jsonb_build_object(
    'exerciseComplexity', seed.exercise_complexity,
    'technicalComplexity', seed.exercise_complexity,
    'physicalDifficulty', seed.physical_difficulty,
    'absoluteLoadDemand', seed.physical_difficulty,
    'coordinationDemand', seed.coordination_demand,
    'supervisionDemand', seed.supervision_demand,
    'failureConsequence', seed.failure_consequence,
    'impact', 1,
    'workCapacityDemand', seed.work_capacity_demand,
    'baseOverallDifficulty',
      greatest(seed.exercise_complexity, seed.physical_difficulty),
    'overallFormula',
      'max_exercise_complexity_physical_difficulty'
  ),
  jsonb_build_object(
    'leadSide', 'declared_and_balanced_across_prescription',
    'stance', 'stationary_declared_length_and_width',
    'rearFootSupport',
      CASE seed.definition_slug
        WHEN 'split-squat' THEN 'rear_forefoot_on_floor'
        ELSE 'stable_declared_elevated_support'
      END,
    'supportContract', seed.support_contract,
    'implement', seed.implement_key,
    'implementQuantity', seed.implement_quantity,
    'loadPosition', seed.load_position,
    'tempoContract', seed.tempo_contract,
    'range', 'declared_owned_pain_free_range',
    'completion', 'return_to_same_balanced_stationary_stance',
    'selectable', TRUE,
    'identityQuarantine', FALSE
  ),
  jsonb_build_object(
    'gripDemand', seed.grip_demand,
    'spinalLoading', seed.spinal_loading,
    'eccentricStress', seed.eccentric_stress,
    'landingContactsPerRep', 0,
    'externalLoadMethod',
      CASE seed.implement_key
        WHEN 'bodyweight' THEN 'bodyweight'
        ELSE 'declared_implement_mass'
      END,
    'loadingType',
      CASE seed.definition_slug
        WHEN 'split-squat'
          THEN 'stationary_asymmetrical_bilateral_support_lead_leg_bias'
        ELSE
          'rear_foot_elevated_asymmetrical_support_lead_leg_bias'
      END,
    'impactClass', 'no_impact',
    'primaryStress', jsonb_build_array(
      'lead_quadriceps_and_gluteal_force',
      'lead_ankle_knee_and_hip_range_control',
      'hip_pelvis_balance_and_trunk_stabilization',
      CASE seed.definition_slug
        WHEN 'split-squat' THEN 'rear_forefoot_floor_support'
        ELSE 'rear_foot_elevated_support_and_entry_exit'
      END,
      CASE seed.implement_key
        WHEN 'bodyweight' THEN 'bodyweight_control'
        ELSE 'load_position_pickup_hold_and_set_down'
      END
    )
  ),
  jsonb_build_object(
    'localMuscleFatigue', seed.local_muscle_fatigue,
    'gripFatigue', seed.grip_fatigue,
    'technicalFatigueSensitivity',
      seed.technical_fatigue_sensitivity,
    'impactAccumulation', 1,
    'recoveryHours', seed.recovery_hours,
    'cumulativeBudgets', jsonb_build_array(
      'unilateral_leg_volume',
      'knee_extensor_loading',
      'gluteal_and_adductor_loading',
      'eccentric_tissue_stress',
      'balance_and_technical_sensitivity',
      'trunk_and_grip_load_when_applicable'
    ),
    'fatigueSignals', jsonb_build_array(
      'stance_or_support_change',
      'lead_foot_pressure_or_knee_path_loss',
      'rear_leg_push_off',
      'pelvis_trunk_or_balance_change',
      'range_or_tempo_loss',
      'load_or_set_down_failure',
      'side_difference_or_grinding'
    )
  ),
  jsonb_build_object(
    'trainingStimuli', jsonb_build_array(
      'side_specific_lower_body_strength',
      'lead_knee_extensor_and_gluteal_capacity',
      'controlled_ankle_knee_and_hip_range',
      'balance_and_trunk_control'
    ),
    'stimulusDose', jsonb_build_object(
      'primaryUnit', 'quality_repetitions_per_side',
      'variables',
        jsonb_build_array(
          'load', 'range', 'tempo', 'repetitions', 'rest'
        )
    ),
    'weeklyExposure', jsonb_build_object(
      'typical', 'one_to_three_exposures',
      'minimumRecoveryHours', seed.recovery_hours
    ),
    'prerequisites', jsonb_build_array(
      'pain_free_stationary_split_stance',
      CASE seed.definition_slug
        WHEN 'split-squat' THEN 'repeatable_rear_forefoot_floor_contact'
        ELSE 'safe_rear_support_entry_contact_and_exit'
      END,
      'owned_lead_foot_knee_pelvis_trunk_and_balance_control',
      'safe_support_or_load_handling'
    ),
    'completionCriteria', jsonb_build_array(
      'declared_repetitions_completed_per_side',
      'all_quality_gates_held',
      'balanced_finish_and_safe_exit_or_set_down'
    ),
    'sequenceRules', jsonb_build_array(
      'after_general_access_and_pattern_rehearsal',
      'after_freshness_sensitive_speed_power_or_skill_work',
      'before_material_unilateral_leg_balance_trunk_or_grip_fatigue'
    ),
    'pairingCompatibility', jsonb_build_array(
      'upper_body_strength',
      'low_fatigue_trunk_work',
      'noncompeting_mobility_or_restore'
    ),
    'interferenceRules', jsonb_build_array(
      'avoid_before_sprint_jump_cut_or_kick_output',
      'avoid_after_fatiguing_squat_lunge_running_or_knee_extensor_work',
      'do_not_pair_with_uncontrolled_balance_or_grip_fatigue'
    ),
    'uncertaintyPolicy',
      'When support, stance, load, range, symptoms, or fatigue is uncertain, stop and use the supported bodyweight or floor-based reviewed regression.',
    'primaryPhase', 'capacity',
    'secondaryPhase', 'resilience',
    'difficultyModel',
      'max_exercise_complexity_physical_difficulty'
  ),
  'review'
FROM split_squat_variant_seed seed
JOIN coaching.exercise_definition_v1 definition
  ON definition.facility_id = 1
 AND definition.slug = seed.definition_slug
 AND definition.status <> 'archived'
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
    WHEN 'capacity-strength'
      THEN 'Build side-specific lower-body strength through the exact stationary support, stance, load, range, tempo, finish, and side-balance contract.'
    ELSE
      'Develop controlled split-stance range, support ownership, balance, knee tracking, pelvis and trunk control with conservative load and full reset.'
  END,
  CASE profile.profile_key
    WHEN 'capacity-strength' THEN 94
    ELSE 88
  END,
  CASE profile.profile_key
    WHEN 'capacity-strength' THEN 94
    ELSE 90
  END,
  jsonb_build_object(
    'unilateralLegStrength',
      CASE profile.profile_key
        WHEN 'capacity-strength' THEN 96
        ELSE 74
      END,
    'rangeAndPositionControl',
      CASE profile.profile_key
        WHEN 'resilience-control' THEN 96
        ELSE 82
      END,
    'balanceAndTrunkControl', 88,
    'fatigueConditioning', 10
  ),
  jsonb_build_object(
    'sets',
      CASE profile.profile_key
        WHEN 'capacity-strength' THEN '2-4'
        ELSE '2-3'
      END,
    'repetitionsPerSide',
      CASE profile.profile_key
        WHEN 'capacity-strength' THEN '4-10'
        ELSE '4-8'
      END,
    'restSeconds',
      CASE
        WHEN profile.profile_key = 'capacity-strength'
          AND seed.implement_key <> 'bodyweight'
          THEN '120-240'
        WHEN profile.profile_key = 'capacity-strength'
          THEN '90-180'
        ELSE '60-150'
      END,
    'tempo', seed.tempo_contract,
    'effort',
      CASE profile.profile_key
        WHEN 'capacity-strength'
          THEN 'challenging_only_while_two_or_more_quality_repetitions_remain'
        ELSE 'light_to_moderate_with_position_priority'
      END,
    'leadSide', 'declare_order_and_balance',
    'rearFootSupport',
      CASE seed.definition_slug
        WHEN 'split-squat' THEN 'floor'
        ELSE 'declared_stable_elevated_support'
      END,
    'implement', seed.implement_key,
    'quantity', seed.implement_quantity,
    'loadPosition', seed.load_position,
    'range', 'declared_owned_pain_free_range',
    'reset', 'same_stationary_stance_or_safe_exit_before_next_side'
  ),
  CASE seed.definition_slug
    WHEN 'split-squat'
      THEN 'Feet stay in the declared stationary split stance; rear forefoot stays on the floor; the whole lead foot, knee path, pelvis, trunk, balance, breathing, range, tempo, load, finish, and side change remain controlled.'
    ELSE
      'Rear support stays stable; entry and exit are controlled; the whole lead foot, knee path, rear-leg contribution, pelvis, trunk, balance, breathing, range, tempo, load, finish, and side change remain controlled.'
  END,
  ARRAY[
    'Stop for pain, pinching, numbness, dizziness, giving way, apprehension, or loss of load or balance.',
    'Stop for floor, rear support, hand support, footwear, implement, rack, or station movement or uncertainty.',
    'Stop for stepping, lead-foot pressure loss, uncontrolled knee motion, rear-leg push-off, pelvic shift, trunk collapse, or range that cannot be controlled.',
    'Stop when tempo, breathing, finish, side symmetry, reset, entry, exit, or set-down quality materially declines or grinding begins.'
  ]::TEXT[],
  'Declare exact support, lead side, stance, hand support, implement, load position, load, range, tempo, repetitions, rest, side order, pickup, finish, exit, and set-down. Observe both feet, knees, pelvis, trunk, balance, support, load, and fatigue.',
  CASE seed.definition_slug
    WHEN 'split-squat'
      THEN 'Set the split, front foot heavy, lower under control, track the knee, and stand to the same stance.'
    ELSE
      'Set the rear foot, own the front foot, lower under control, drive through the front leg, and finish balanced.'
  END,
  CASE profile.profile_key
    WHEN 'capacity-strength'
      THEN 'Greater side-specific quadriceps and gluteal strength with repeatable split-stance mechanics and load control.'
    ELSE
      'Greater controlled range, balance, knee tracking, pelvic and trunk control, and positional confidence.'
  END,
  seed.equipment_required,
  jsonb_build_object(
    'surface', 'level_dry_high_traction',
    'participants', 'one_athlete_per_station',
    'setupSeconds',
      CASE
        WHEN seed.definition_slug = 'bulgarian-split-squat' THEN 75
        WHEN seed.implement_key = 'bodyweight' THEN 45
        ELSE 60
      END,
    'transitionSeconds', 20,
    'equipmentInspection',
      'before_session_after_support_or_load_change_and_after_any_shift',
    'entryExitZone', 'clear_and_exclusive',
    'setDownZone', 'clear_and_exclusive_when_loaded',
    'coachPosition',
      'outside_fall_entry_exit_pickup_and_set_down_paths'
  ),
  ARRAY[]::UUID[],
  jsonb_build_object(
    'repetitionSeconds',
      CASE
        WHEN seed.tempo_contract LIKE 'three_to_five%' THEN 9
        ELSE 6
      END,
    'resetSeconds', 4,
    'sideChangeSeconds', 20,
    'setDurationFormula',
      'per_side_repetitions_x_repetition_plus_reset_plus_side_change',
    'setupSeconds',
      CASE
        WHEN seed.definition_slug = 'bulgarian-split-squat' THEN 75
        WHEN seed.implement_key = 'bodyweight' THEN 45
        ELSE 60
      END,
    'durationIncludesSetup', TRUE
  ),
  jsonb_build_object(
    'regressFirst',
      CASE seed.definition_slug
        WHEN 'split-squat'
          THEN jsonb_build_array(
            'add_stable_hand_support',
            'remove_external_load',
            'shorten_range',
            'adjust_stance',
            'reduce_repetitions',
            'increase_rest'
          )
        ELSE jsonb_build_array(
            'return_to_floor_based_split_squat',
            'lower_rear_support',
            'add_stable_hand_support',
            'remove_external_load',
            'shorten_range',
            'reduce_repetitions',
            'increase_rest'
          )
      END,
    'progressOneVariableAtATime',
      jsonb_build_array(
        'remove_support',
        'load',
        'range',
        'tempo',
        'repetitions'
      ),
    'symptomRule',
      'stop_and_select_reviewed_pain_free_supported_or_floor_based_alternative'
  ),
  jsonb_build_object(
    'required', jsonb_build_array(
      'variant',
      'lead_side',
      'rear_foot_support',
      'stance',
      'hand_support',
      'implement',
      'load_position',
      'load',
      'range',
      'tempo',
      'quality_repetitions_per_side',
      'rest',
      'stop_reason'
    ),
    'optional', jsonb_build_array(
      'support_height_and_contact',
      'depth',
      'rate_of_perceived_effort',
      'repetitions_in_reserve',
      'balance_error',
      'knee_pelvis_or_trunk_error',
      'side_difference'
    ),
    'comparisonRule',
      'Compare only when support, side, stance, implement, load position, load, range, tempo, footwear, surface, and measurement method match.'
  ),
  jsonb_build_object(
    'athleteBeforeSet', jsonb_build_array(
      'Confirm support, side, stance, hand support, load, range, tempo, repetitions, rest, finish, exit, and set-down.',
      'Report pain, numbness, dizziness, giving way, apprehension, or equipment uncertainty.'
    ),
    'coachDuringSet', jsonb_build_array(
      'Watch support, feet, knee path, rear-leg contribution, pelvis, trunk, balance, range, tempo, load, finish, entry, exit, and side change.',
      'Stop immediately on any symptom, support, equipment, station, or quality trigger.'
    ),
    'afterSet', jsonb_build_array(
      'Record quality repetitions per side, exact setup, load, range, tempo, errors, symptoms, stop reason, and substitutions.',
      'Do not increase support height, load, range, or tempo after a stop trigger.'
    ),
    'supportEscalation',
      'Escalate symptoms, support movement, fall, dropped load, identity mismatch, or inaccessible instruction through the documented support path.',
    'mediaFallback',
      'Use the written contract and a qualified live demonstration until an exact video is independently approved.'
  ),
  'review'
FROM split_squat_variant_seed seed
JOIN coaching.exercise_definition_v1 definition
  ON definition.facility_id = 1
 AND definition.slug = seed.definition_slug
 AND definition.status <> 'archived'
JOIN coaching.exercise_variant_v1 variant
  ON variant.definition_id = definition.id
 AND variant.variant_key = seed.variant_key
 AND variant.status <> 'archived'
CROSS JOIN (
  VALUES
    ('capacity-strength', 'capacity', 'primary'),
    ('resilience-control', 'resilience', 'secondary')
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
  CASE
    WHEN evidence.section_key = 'identity'
      THEN CASE definition.slug
        WHEN 'split-squat'
          THEN '["Stationary Split Squat keeps the rear forefoot on the floor and returns to the same stance; implement, load position, tempo, and pause are exact variants.","Rear-foot elevation changes support geometry and remains a separate exercise identity."]'::JSONB
        ELSE '["Rear-Foot-Elevated Split Squat places the rear foot on a declared support while the lead leg performs the repeated squat action.","Bulgarian Split Squat and RFESS are synonymous; floor-based Split Squat remains a separate support identity."]'::JSONB
      END
    WHEN evidence.section_key = 'biomechanics'
      THEN CASE definition.slug
        WHEN 'split-squat'
          THEN '["Split-squat step length changes hip, knee, and ankle kinematics, hip and knee moments, and muscle activation; stance must be declared rather than universalized.","Lead-foot pressure, knee path, pelvis, trunk, rear-leg contribution, range, and side differences are observed."]'::JSONB
        ELSE '["Rear-foot elevation creates a distinct rear-leg-derived external moment and support contract; stance width and trunk angle alter demand.","Support height, contact, entry, exit, lead-foot pressure, knee path, pelvis, trunk, rear-leg contribution, and side differences are observed."]'::JSONB
      END
    WHEN evidence.section_key = 'difficulty'
      THEN '["Every exact variant is scored only for exercise complexity and physical difficulty; overall equals their maximum.","Support geometry, balance, load position, load handling, tempo, range, failure consequence, and safe setup change exercise difficulty, while athlete readiness remains a workout-selection input."]'::JSONB
    WHEN evidence.section_key = 'media'
      THEN '["Five title-matched candidates returned current public oEmbed title, channel, and embed metadata.","No playback, exact-variant, cue, safety, caption, accessibility, reviewer, rejection, or approval claim is made."]'::JSONB
    ELSE jsonb_build_array(
      CASE evidence.section_key
        WHEN 'taxonomy' THEN 'Stationary squat action, asymmetrical bilateral support, lead-leg bias, support geometry, implement, load, range, tempo, and finish are explicit.'
        WHEN 'anatomy' THEN 'The card records lead knee and hip extensors, ankle and foot control, rear-limb support, pelvis and trunk stabilization, and optional load-handling structures without claiming isolated-muscle outcomes.'
        WHEN 'load_fatigue_recovery' THEN 'Track unilateral leg volume, knee-extensor and gluteal load, eccentric stress, balance, trunk, grip, side differences, symptoms, and recovery.'
        WHEN 'constraints' THEN 'Use requires a stable floor and station, safe support and load handling, pain-free controlled range, direct observation, and a clear stop and exit plan.'
        WHEN 'dosage' THEN 'Sets, repetitions, load, range, tempo, rest, and weekly exposure are contextual variables; higher loads favor strength while multiple prescriptions can support adaptation.'
        WHEN 'instructions' THEN 'Instruction declares support, side, stance, load, range, tempo, dose, finish, exit, and set-down before the first repetition.'
        WHEN 'safety_stop_rules' THEN 'Stop for symptoms, support or load failure, stepping, lead-foot or knee control loss, rear-leg push-off, pelvic or trunk compensation, grinding, or unsafe exit.'
        WHEN 'programming' THEN 'Place loaded unilateral strength after freshness-sensitive speed, jump, cut, and skill work and count it against cumulative leg, eccentric, balance, trunk, and grip budgets.'
        WHEN 'athlete_support' THEN 'Athletes receive setup, self-check, expected and unexpected sensation, symptom, stop, exit, and recording guidance.'
        WHEN 'coach_support' THEN 'Coaches observe support, stance, lead-foot pressure, knee path, rear-leg contribution, pelvis, trunk, load, range, tempo, side differences, and fatigue.'
        WHEN 'accessibility' THEN 'Stable hand support, floor-based support, lower rear support, bodyweight, shorter range, fewer repetitions, longer rest, and nonvideo instruction formats can reduce barriers.'
        WHEN 'alternates' THEN 'External load and tempo can remain exact variants; rear-foot elevation, stepping lunges, isometric holds, perturbations, and jumps cross support or action boundaries.'
      END
    )
  END,
  evidence.evidence_quality,
  'candidate',
  NULL,
  NULL
FROM coaching.exercise_definition_v1 definition
CROSS JOIN (
  VALUES
    ('identity','https://pmc.ncbi.nlm.nih.gov/articles/PMC10667687/','Effects of step lengths on biomechanical characteristics of lower extremity during split squat movement','Frontiers in Bioengineering and Biotechnology','peer_reviewed_research',88),
    ('taxonomy','https://pubmed.ncbi.nlm.nih.gov/29870422/','Muscle Activation in Unilateral Barbell Exercises: Implications for Strength Training and Rehabilitation','Journal of Strength and Conditioning Research','peer_reviewed_research',86),
    ('anatomy','https://pubmed.ncbi.nlm.nih.gov/29870422/','Muscle Activation in Unilateral Barbell Exercises: Implications for Strength Training and Rehabilitation','Journal of Strength and Conditioning Research','peer_reviewed_research',86),
    ('biomechanics','https://pmc.ncbi.nlm.nih.gov/articles/PMC12408075/','Rear Leg-derived Moment Contributes to Resistance Against Hip Extension in Bulgarian Split Squats','International Journal of Exercise Science','peer_reviewed_research',86),
    ('difficulty','https://pmc.ncbi.nlm.nih.gov/articles/PMC10667687/','Effects of step lengths on biomechanical characteristics of lower extremity during split squat movement','Frontiers in Bioengineering and Biotechnology','peer_reviewed_research',88),
    ('load_fatigue_recovery','https://pmc.ncbi.nlm.nih.gov/articles/PMC10579494/','Resistance training prescription for muscle strength and hypertrophy in healthy adults: a systematic review and Bayesian network meta-analysis','British Journal of Sports Medicine','peer_reviewed_research',94),
    ('constraints','https://pubmed.ncbi.nlm.nih.gov/31524778/','Validity and Reliability of the Rear Foot Elevated Split Squat 5 Repetition Maximum to Determine Unilateral Leg Strength Symmetry','Journal of Strength and Conditioning Research','peer_reviewed_research',84),
    ('dosage','https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/','American College of Sports Medicine Position Stand. Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews','Medicine & Science in Sports & Exercise','professional_standard',96),
    ('instructions','https://pmc.ncbi.nlm.nih.gov/articles/PMC10667687/','Effects of step lengths on biomechanical characteristics of lower extremity during split squat movement','Frontiers in Bioengineering and Biotechnology','peer_reviewed_research',88),
    ('safety_stop_rules','https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/','American College of Sports Medicine Position Stand. Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews','Medicine & Science in Sports & Exercise','professional_standard',96),
    ('programming','https://pmc.ncbi.nlm.nih.gov/articles/PMC10579494/','Resistance training prescription for muscle strength and hypertrophy in healthy adults: a systematic review and Bayesian network meta-analysis','British Journal of Sports Medicine','peer_reviewed_research',94),
    ('athlete_support','https://pmc.ncbi.nlm.nih.gov/articles/PMC10667687/','Effects of step lengths on biomechanical characteristics of lower extremity during split squat movement','Frontiers in Bioengineering and Biotechnology','peer_reviewed_research',88),
    ('coach_support','https://pmc.ncbi.nlm.nih.gov/articles/PMC12408075/','Rear Leg-derived Moment Contributes to Resistance Against Hip Extension in Bulgarian Split Squats','International Journal of Exercise Science','peer_reviewed_research',86),
    ('accessibility','https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/','American College of Sports Medicine Position Stand. Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews','Medicine & Science in Sports & Exercise','professional_standard',96),
    ('alternates','https://pubmed.ncbi.nlm.nih.gov/29870422/','Muscle Activation in Unilateral Barbell Exercises: Implications for Strength Training and Rehabilitation','Journal of Strength and Conditioning Research','peer_reviewed_research',86),
    ('media','https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en','Embed videos and playlists','YouTube Help','manufacturer_instruction',82)
) AS evidence(
  section_key,
  source_url,
  source_title,
  source_publisher,
  source_kind,
  evidence_quality
)
WHERE definition.facility_id = 1
  AND definition.slug IN ('split-squat', 'bulgarian-split-squat')
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
  'YouTube public oEmbed title/channel/embed metadata checked 2026-07-26. Title-level candidate only; playback, exact support/load variant, instruction, safety, caption, accessibility, reviewer, and approval review remain unresolved.'
FROM (
  VALUES
    ('split-squat','G_1gjHaIG8s','Split Squats with Mike Boyle | Ep 96 | Movement Fix Monday | Dr. Ryan DeBell5','The Movement Fix','split squat tutorial'),
    ('split-squat','u705lnY8CBc','Exercise Tutorial: DB Split Squat','Travis Tarrant','dumbbell split squat tutorial'),
    ('split-squat','vSjYwubBgU8','Split Squat','Mike Boyle Strength & Conditioning','split squat exercise'),
    ('split-squat','3evOOHpMEI8','Dumbbell Split Squat','Jon-Erik Kawamoto','dumbbell split squat exercise'),
    ('split-squat','8Elq99nHIHU','Barbell Split Squat (Exercise Library)','Horton Barbell','barbell split squat exercise'),
    ('bulgarian-split-squat','2C-uNgKwPLE','How To: Bulgarian Split Squat','ScottHermanFitness','Bulgarian split squat tutorial'),
    ('bulgarian-split-squat','hiLF_pF3EJM','Stop F*cking Up Bulgarian Split Squats (PROPER FORM!)','ATHLEAN-X™','Bulgarian split squat form'),
    ('bulgarian-split-squat','pbNXlcpsPXQ','Eccentric Emphasis Rear Foot Elevated Split Squat','Michael Boyle','eccentric rear foot elevated split squat'),
    ('bulgarian-split-squat','IaXttrJcVTA','Inside the MBSC Staff Meeting: Rear Foot Elevated Split Squats','Mike Boyle Strength & Conditioning','rear foot elevated split squat'),
    ('bulgarian-split-squat','rah3eJCPXHA','Bulgarian Split Squat Form Tutorial | Beginner to Advanced','MuscleWiki','Bulgarian split squat tutorial')
) AS media(
  definition_slug,
  video_id,
  title,
  channel_name,
  source_query
)
JOIN coaching.exercise_definition_v1 definition
  ON definition.facility_id = 1
 AND definition.slug = media.definition_slug
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
  definition.id,
  definition.card_version,
  alternate.alternate_name,
  alternate.classification,
  alternate.rationale,
  alternate.dimensions,
  CASE
    WHEN alternate.classification = 'new_definition'
      THEN jsonb_build_object(
        'status', 'proposal_only',
        'humanReviewRequired', TRUE,
        'sourceCard', definition.slug
      )
    ELSE NULL
  END,
  'candidate',
  NULL,
  NULL
FROM coaching.exercise_definition_v1 definition
JOIN (
  VALUES
    ('split-squat','Bodyweight Split Squat','same_identity','Absence of external load preserves the stationary split-stance action.','{"variantKey":"bodyweight-standard"}'::JSONB),
    ('split-squat','Dumbbell Split Squat','new_variant','Handheld dumbbells change grip, load position, pickup, and set-down within the same action.','{"variantKey":"two-dumbbell-suitcase"}'::JSONB),
    ('split-squat','Barbell Split Squat','new_variant','Back-rack loading changes bracing, supervision, failure consequence, and rack requirements within the same action.','{"variantKey":"barbell-back-rack"}'::JSONB),
    ('split-squat','Front-Rack Kettlebell Split Squat','new_variant','Kettlebell quantity, side, and rack position are exact load dimensions.','{"variantKey":"single-kettlebell-front-rack"}'::JSONB),
    ('split-squat','Slow Eccentric Split Squat','new_variant','Slower lowering preserves the action while changing tempo, eccentric stress, duration, and fatigue.','{"variantKey":"bodyweight-slow-eccentric-pause"}'::JSONB),
    ('split-squat','Rear-Foot-Elevated Split Squat','new_definition','Elevating the rear foot changes support geometry, balance, setup, rear-limb contribution, and exit.','{"rearFootSupport":"elevated"}'::JSONB),
    ('split-squat','Front-Foot-Elevated Split Squat','new_definition','Elevating the whole lead foot changes support geometry and available range.','{"leadFootSupport":"elevated"}'::JSONB),
    ('split-squat','Reverse Lunge','new_definition','Stepping backward and returning adds foot motion and a different start/finish sequence.','{"orderedActions":["step_back","lower","return"]}'::JSONB),
    ('split-squat','Split Squat Isometric Hold','new_definition','Holding a fixed position changes contraction and dose from dynamic repetitions.','{"contraction":"isometric_hold"}'::JSONB),
    ('split-squat','Split-Squat Jump','new_definition','Takeoff, flight, impact, and landing change the action and risk contract.','{"flight":true}'::JSONB),
    ('split-squat','Split Squat ISO with Perturbation','new_definition','Partner perturbation adds external disturbance, group logistics, and recovery actions.','{"externalDisturbance":"partner_perturbation"}'::JSONB),
    ('split-squat','Landmine Split Squat','new_definition','The source permits stationary split stance or stepping reverse lunge and remains quarantined until its primary action is re-authored.','{"identityState":"needs_human_review"}'::JSONB),
    ('bulgarian-split-squat','Bulgarian Split Squat','same_identity','Bulgarian Split Squat is retained as the common alias for rear-foot-elevated split squat.','{"rearFootSupport":"elevated"}'::JSONB),
    ('bulgarian-split-squat','Dumbbell Bulgarian Split Squat','new_variant','Dumbbells change grip, load position, pickup, and set-down within the same rear-foot-elevated action.','{"variantKey":"two-dumbbell-suitcase-rear-foot-elevated"}'::JSONB),
    ('bulgarian-split-squat','Barbell Bulgarian Split Squat','new_variant','Back-rack loading changes bracing, supervision, failure consequence, and rack requirements within the same action.','{"variantKey":"barbell-back-rack-rear-foot-elevated"}'::JSONB),
    ('bulgarian-split-squat','Kettlebell Bulgarian Split Squat','new_variant','A declared kettlebell hold and load preserve the rear-foot-elevated action.','{"variantKey":"single-kettlebell-goblet-rear-foot-elevated"}'::JSONB),
    ('bulgarian-split-squat','Rear-Foot-Elevated Split Squat Negative','new_variant','Slow lowering preserves the action while changing tempo, eccentric stress, duration, and fatigue.','{"variantKey":"bodyweight-slow-eccentric-pause-rear-foot-elevated"}'::JSONB),
    ('bulgarian-split-squat','Floor-Based Split Squat','new_definition','Rear-forefoot floor contact changes support geometry and is retained as the Split Squat card.','{"rearFootSupport":"floor"}'::JSONB),
    ('bulgarian-split-squat','Front-Foot-Elevated Split Squat','new_definition','Elevating the lead foot instead of the rear foot changes support geometry and range.','{"leadFootSupport":"elevated"}'::JSONB),
    ('bulgarian-split-squat','Rear-Foot-Elevated Split Squat Isometric Hold','new_definition','A fixed hold changes contraction type and dose from dynamic repetitions.','{"contraction":"isometric_hold"}'::JSONB),
    ('bulgarian-split-squat','Rear-Foot-Elevated Split Squat Jump to Box','new_definition','Takeoff, flight, target box, impact, and terminal landing add ordered actions.','{"orderedActions":["rear_foot_elevated_takeoff","flight","box_landing"]}'::JSONB),
    ('bulgarian-split-squat','Suspension Rear-Foot-Elevated Split Squat','new_variant','Suspended rear-foot support can preserve the action but materially changes stability and requires exact review.','{"rearFootSupport":"suspension","proposalOnly":true}'::JSONB),
    ('bulgarian-split-squat','Forward-Lean Rear-Foot-Elevated Split Squat','modifier_annotation','Trunk angle changes joint demand and must be declared without creating an athlete level.','{"modifier":"declared_trunk_angle"}'::JSONB),
    ('bulgarian-split-squat','Supported Rear-Foot-Elevated Split Squat','new_variant','Stable hand support preserves the action while reducing balance and failure demand.','{"variantKey":"supported-bodyweight-rear-foot-elevated"}'::JSONB)
) AS alternate(
  definition_slug,
  alternate_name,
  classification,
  rationale,
  dimensions
)
  ON alternate.definition_slug = definition.slug
WHERE definition.facility_id = 1
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
  edge.relationship,
  edge.similarity,
  edge.dimensions,
  edge.reason,
  edge.conditions,
  'review',
  NULL,
  NULL,
  NULL
FROM (
  VALUES
    ('split-squat','supported-bodyweight-standard','split-squat','bodyweight-standard','progression',95,ARRAY['stability','complexity']::TEXT[],'Removing stable hand support preserves the floor-based action while increasing balance and failure-control demand.','{"requiresRepeatableSupportedVariant":true,"humanReviewRequired":true}'::JSONB),
    ('split-squat','bodyweight-standard','split-squat','supported-bodyweight-standard','regression',95,ARRAY['stability','complexity']::TEXT[],'Adding stable hand support preserves the floor-based action while reducing balance and failure-control demand.','{"supportMustBeStable":true,"humanReviewRequired":true}'::JSONB),
    ('split-squat','bodyweight-standard','split-squat','two-dumbbell-suitcase','progression',92,ARRAY['load','complexity']::TEXT[],'Adding two suitcase dumbbells preserves the action while increasing external load, grip, pickup, and set-down demand.','{"increaseOneVariableAtATime":true,"humanReviewRequired":true}'::JSONB),
    ('split-squat','two-dumbbell-suitcase','split-squat','bodyweight-standard','regression',92,ARRAY['load','complexity']::TEXT[],'Removing dumbbells preserves the action while reducing load and handling demands.','{"externalLoad":"none","humanReviewRequired":true}'::JSONB),
    ('split-squat','bodyweight-standard','split-squat','bodyweight-slow-eccentric-pause','progression',88,ARRAY['fatigue','complexity']::TEXT[],'A slow eccentric and pause preserve the action while increasing time, eccentric stress, positional-control demand, and fatigue exposure.','{"bodyweightRangeUnchanged":true,"tempoChange":"slower_eccentric_plus_pause","humanReviewRequired":true}'::JSONB),
    ('split-squat','bodyweight-slow-eccentric-pause','split-squat','bodyweight-standard','regression',92,ARRAY['fatigue','complexity']::TEXT[],'Standard controlled tempo reduces time-under-tension, pause demand, and fatigue exposure while preserving support and stance.','{"tempoChange":"controlled_standard","humanReviewRequired":true}'::JSONB),
    ('bulgarian-split-squat','supported-bodyweight-rear-foot-elevated','bulgarian-split-squat','bodyweight-rear-foot-elevated','progression',94,ARRAY['stability','complexity']::TEXT[],'Removing hand support preserves rear-foot elevation while increasing balance and failure-control demand.','{"rearSupportUnchanged":true,"humanReviewRequired":true}'::JSONB),
    ('bulgarian-split-squat','bodyweight-rear-foot-elevated','bulgarian-split-squat','supported-bodyweight-rear-foot-elevated','regression',94,ARRAY['stability','complexity']::TEXT[],'Adding stable hand support preserves rear-foot elevation while reducing balance and failure-control demand.','{"supportMustBeStable":true,"humanReviewRequired":true}'::JSONB),
    ('bulgarian-split-squat','bodyweight-rear-foot-elevated','bulgarian-split-squat','two-dumbbell-suitcase-rear-foot-elevated','progression',90,ARRAY['load','complexity']::TEXT[],'Adding two suitcase dumbbells preserves the action while increasing load, grip, pickup, set-down, and fatigue demand.','{"increaseOneVariableAtATime":true,"humanReviewRequired":true}'::JSONB),
    ('bulgarian-split-squat','two-dumbbell-suitcase-rear-foot-elevated','bulgarian-split-squat','bodyweight-rear-foot-elevated','regression',92,ARRAY['load','complexity']::TEXT[],'Removing dumbbells preserves rear-foot elevation while reducing load and handling demands.','{"externalLoad":"none","humanReviewRequired":true}'::JSONB),
    ('split-squat','bodyweight-standard','bulgarian-split-squat','bodyweight-rear-foot-elevated','progression',86,ARRAY['stability','range','complexity']::TEXT[],'Rear-foot elevation preserves a stationary split-stance squat but increases setup, support, balance, rear-limb, entry, and exit demand.','{"floorBasedVariantRepeatable":true,"humanReviewRequired":true}'::JSONB),
    ('bulgarian-split-squat','bodyweight-rear-foot-elevated','split-squat','bodyweight-standard','regression',96,ARRAY['stability','range','complexity']::TEXT[],'Returning the rear foot to the floor preserves the squat action while reducing support, balance, entry, and exit demand.','{"rearFootSupport":"floor","humanReviewRequired":true}'::JSONB)
) AS edge(
  from_slug,
  from_key,
  to_slug,
  to_key,
  relationship,
  similarity,
  dimensions,
  reason,
  conditions
)
JOIN coaching.exercise_definition_v1 from_definition
  ON from_definition.facility_id = 1
 AND from_definition.slug = edge.from_slug
 AND from_definition.status <> 'archived'
JOIN coaching.exercise_variant_v1 from_variant
  ON from_variant.definition_id = from_definition.id
 AND from_variant.variant_key = edge.from_key
 AND from_variant.status <> 'archived'
JOIN coaching.exercise_definition_v1 to_definition
  ON to_definition.facility_id = 1
 AND to_definition.slug = edge.to_slug
 AND to_definition.status <> 'archived'
JOIN coaching.exercise_variant_v1 to_variant
  ON to_variant.definition_id = to_definition.id
 AND to_variant.variant_key = edge.to_key
 AND to_variant.status <> 'archived'
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
  calibration.rationale,
  'review',
  1,
  NULL,
  NULL,
  'Independent calibration review required; this migration does not approve the proposed score.',
  NULL
FROM coaching.exercise_definition_v1 definition
JOIN coaching.exercise_variant_v1 variant
  ON variant.definition_id = definition.id
 AND variant.status <> 'archived'
CROSS JOIN LATERAL (
  VALUES
    (
      'technicalComplexity',
      (variant.difficulty_json ->> 'technicalComplexity')::SMALLINT,
      'Proposed exercise complexity from support geometry, stance, lead-foot and knee control, rear-leg contribution, balance, pelvis, trunk, tempo, side changes, and load handling.'
    ),
    (
      'absoluteLoadDemand',
      (variant.difficulty_json ->> 'absoluteLoadDemand')::SMALLINT,
      'Proposed physical difficulty from unilateral leg force, external load, range, eccentric stress, time under tension, trunk and grip load, and safe setup and set-down.'
    ),
    (
      'technicalFatigueSensitivity',
      (variant.fatigue_profile_json ->>
        'technicalFatigueSensitivity')::SMALLINT,
      'Proposed from stance or support change, foot-pressure or knee-path loss, rear-leg push-off, pelvic or trunk compensation, range or tempo loss, side difference, grinding, or unsafe exit and set-down.'
    )
) AS calibration(dimension, score, rationale)
WHERE definition.facility_id = 1
  AND definition.slug IN ('split-squat', 'bulgarian-split-squat')
  AND definition.status <> 'archived'
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
SELECT
  definition.id,
  definition.facility_id,
  definition.card_version,
  '1.0.0',
  'canonical-card-audit-v1',
  'quarantined',
  '[]'::JSONB,
  jsonb_build_array(
    jsonb_build_object(
      'code', 'media_human_review_required',
      'message',
        'Five title-matched oEmbed-healthy candidates require full-video exact-support/load, instruction, safety, caption, accessibility, reviewer, and approval review.'
    ),
    jsonb_build_object(
      'code', 'identity_human_review_required',
      'message',
        'Identity consolidations, support boundaries, and alternate classifications are deterministic proposals and require accountable review.'
    ),
    jsonb_build_object(
      'code', 'graph_human_review_required',
      'message',
        'Progression, regression, and cross-support relationship proposals require coach approval.'
    ),
    jsonb_build_object(
      'code', 'calibration_human_review_required',
      'message',
        'Exercise-complexity, physical-difficulty, and technical-fatigue proposals require independent calibration.'
    ),
    jsonb_build_object(
      'code', 'athlete_coach_pilot_required',
      'message',
        'Athlete comprehension, coach scoring, dose tolerance, side recording, support setup, and station logistics require representative pilot evidence.'
    ),
    jsonb_build_object(
      'code', 'publication_approval_required',
      'message',
        'The completed candidate remains in review and requires current two-person publication approval.'
    )
  ),
  TRUE,
  now()
FROM coaching.exercise_definition_v1 definition
WHERE definition.facility_id = 1
  AND definition.slug IN ('split-squat', 'bulgarian-split-squat')
  AND definition.status <> 'archived'
ON CONFLICT (definition_id)
DO UPDATE SET
  facility_id = EXCLUDED.facility_id,
  card_version = EXCLUDED.card_version,
  schema_version = EXCLUDED.schema_version,
  audit_version = EXCLUDED.audit_version,
  status = 'quarantined',
  checks_json = '[]'::JSONB,
  blocking_issues_json = EXCLUDED.blocking_issues_json,
  human_review_required = TRUE,
  checked_at = now();

DROP TABLE split_squat_variant_seed;
