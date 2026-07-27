-- Complete the consolidated Reactive Hop-to-Cut and Seated Overhead Press
-- survivor cards with exact variants, contextual delivery profiles, support
-- contracts, evidence, media candidates, alternate assessments, relationship
-- proposals, calibration proposals, and quarantined test-packet state.
--
-- All review artifacts remain candidate/review only. Current YouTube oEmbed
-- metadata is recorded, but no full-video review, exact-match approval,
-- accessibility approval, graph approval, score approval, or publication is
-- claimed. Exercise difficulty is complexity plus physical difficulty, with
-- overall derived as their maximum. Proficiency levels belong only to the skill
-- library and are intentionally absent here. IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '360_coaching_reactive_hop_cut_seated_press_completion';
  facility BIGINT;
  target_count INTEGER;
  protected_records INTEGER;
  unexpected_variants INTEGER;
BEGIN
  SELECT COUNT(*), MIN(facility_id)
  INTO target_count, facility
  FROM coaching.exercise_definition_v1
  WHERE slug IN (
    'reactive-hop-to-cut',
    'seated-barbell-overhead-press'
  )
    AND status <> 'archived';

  IF target_count <> 2 THEN
    RAISE EXCEPTION
      '% requires both consolidated survivor definitions; found %',
      migration_key,
      target_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM coaching.exercise_definition_v1
    WHERE slug IN (
      'reactive-hop-to-cut',
      'seated-barbell-overhead-press'
    )
      AND status <> 'archived'
      AND facility_id <> facility
  ) THEN
    RAISE EXCEPTION
      '% requires both survivors in one facility',
      migration_key;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM coaching.exercise_identity_resolution_v1 resolution
    JOIN coaching.exercise_definition_v1 survivor
      ON survivor.id = resolution.survivor_definition_id
    JOIN coaching.exercise_definition_v1 duplicate
      ON duplicate.id = resolution.resolved_definition_id
    WHERE survivor.slug = 'reactive-hop-to-cut'
      AND duplicate.slug = 'reactive-45-degree-hop-to-cut'
      AND resolution.decision = 'duplicate_consolidated'
  ) OR NOT EXISTS (
    SELECT 1
    FROM coaching.exercise_identity_resolution_v1 resolution
    JOIN coaching.exercise_definition_v1 survivor
      ON survivor.id = resolution.survivor_definition_id
    JOIN coaching.exercise_definition_v1 duplicate
      ON duplicate.id = resolution.resolved_definition_id
    WHERE survivor.slug = 'seated-barbell-overhead-press'
      AND duplicate.slug = 'seated-dumbbell-overhead-press'
      AND resolution.decision = 'duplicate_consolidated'
  ) THEN
    RAISE EXCEPTION
      '% requires both migration 358 identity consolidations',
      migration_key;
  END IF;

  SELECT
    (
      SELECT COUNT(*)
      FROM coaching.exercise_definition_v1 definition
      WHERE definition.slug IN (
        'reactive-hop-to-cut',
        'seated-barbell-overhead-press'
      )
        AND definition.status <> 'archived'
        AND (
          definition.status = 'published'
          OR definition.reviewed_by IS NOT NULL
          OR definition.approved_by IS NOT NULL
          OR definition.last_reviewed_at IS NOT NULL
          OR definition.approved_video_url IS NOT NULL
        )
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_section_evidence_v1 evidence
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id = evidence.definition_id
      WHERE definition.slug IN (
        'reactive-hop-to-cut',
        'seated-barbell-overhead-press'
      )
        AND evidence.review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_media_candidate_v1 media
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id = media.definition_id
      WHERE definition.slug IN (
        'reactive-hop-to-cut',
        'seated-barbell-overhead-press'
      )
        AND media.review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_alternate_assessment_v1 alternate
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id = alternate.definition_id
      WHERE definition.slug IN (
        'reactive-hop-to-cut',
        'seated-barbell-overhead-press'
      )
        AND alternate.review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_card_review_v1 review
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id = review.definition_id
      WHERE definition.slug IN (
        'reactive-hop-to-cut',
        'seated-barbell-overhead-press'
      )
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_card_revision_v1 revision
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id = revision.definition_id
      WHERE definition.slug IN (
        'reactive-hop-to-cut',
        'seated-barbell-overhead-press'
      )
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_media_review_v1 review
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id = review.definition_id
      WHERE definition.slug IN (
        'reactive-hop-to-cut',
        'seated-barbell-overhead-press'
      )
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_variant_v1 variant
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id = variant.definition_id
      WHERE definition.slug IN (
        'reactive-hop-to-cut',
        'seated-barbell-overhead-press'
      )
        AND variant.status = 'published'
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_relationship_v1 relationship
      WHERE (
        relationship.from_variant_id IN (
          SELECT variant.id
          FROM coaching.exercise_variant_v1 variant
          JOIN coaching.exercise_definition_v1 definition
            ON definition.id = variant.definition_id
          WHERE definition.slug IN (
            'reactive-hop-to-cut',
            'seated-barbell-overhead-press'
          )
        )
        OR relationship.to_variant_id IN (
          SELECT variant.id
          FROM coaching.exercise_variant_v1 variant
          JOIN coaching.exercise_definition_v1 definition
            ON definition.id = variant.definition_id
          WHERE definition.slug IN (
            'reactive-hop-to-cut',
            'seated-barbell-overhead-press'
          )
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
      WHERE calibration.variant_id IN (
        SELECT variant.id
        FROM coaching.exercise_variant_v1 variant
        JOIN coaching.exercise_definition_v1 definition
          ON definition.id = variant.definition_id
        WHERE definition.slug IN (
          'reactive-hop-to-cut',
          'seated-barbell-overhead-press'
        )
      )
        AND (
          calibration.status <> 'review'
          OR calibration.reviewed_by IS NOT NULL
          OR calibration.reviewed_at IS NOT NULL
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
  FROM coaching.exercise_variant_v1 variant
  JOIN coaching.exercise_definition_v1 definition
    ON definition.id = variant.definition_id
  WHERE definition.slug IN (
    'reactive-hop-to-cut',
    'seated-barbell-overhead-press'
  )
    AND variant.status <> 'archived'
    AND (
      (
        definition.slug = 'reactive-hop-to-cut'
        AND variant.variant_key NOT IN (
          'baseline',
          'bilateral-hop-reactive-45-cut',
          'bilateral-hop-reactive-90-cut'
        )
      )
      OR (
        definition.slug = 'seated-barbell-overhead-press'
        AND variant.variant_key NOT IN (
          'baseline',
          'barbell-unsupported-pronated',
          'barbell-back-supported-pronated',
          'dumbbell-back-supported-neutral',
          'dumbbell-back-supported-pronated'
        )
      )
    );

  IF unexpected_variants > 0 THEN
    RAISE EXCEPTION
      '% found % unexpected active variant(s)',
      migration_key,
      unexpected_variants;
  END IF;

  UPDATE coaching.exercise_variant_v1 variant
  SET variant_key = 'legacy-generic-baseline',
      display_name = CASE definition.slug
        WHEN 'reactive-hop-to-cut'
          THEN 'Legacy Generic Reactive Hop-to-Cut Source'
        ELSE 'Legacy Generic Seated Overhead Press Source'
      END,
      status = 'archived',
      requirements_json = coalesce(variant.requirements_json, '{}'::JSONB)
        || jsonb_build_object(
          'selectable', FALSE,
          'identityQuarantine', TRUE,
          'quarantineReason', CASE definition.slug
            WHEN 'reactive-hop-to-cut'
              THEN 'Legacy source does not declare hop, cue window, landing, cut angle, response lane, terminal action, dose, quality gate, or stop rules.'
            ELSE 'Legacy source does not declare implement, support, bench angle, grip, rack, range, tempo, spotting, pickup, set-down, dose, quality gate, or stop rules.'
          END
        ),
      updated_at = now()
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.id = variant.definition_id
    AND definition.slug IN (
      'reactive-hop-to-cut',
      'seated-barbell-overhead-press'
    )
    AND variant.variant_key = 'baseline'
    AND variant.status <> 'archived';

  UPDATE coaching.exercise_delivery_profile_v1 profile
  SET status = 'archived',
      updated_at = now()
  FROM coaching.exercise_variant_v1 variant
  JOIN coaching.exercise_definition_v1 definition
    ON definition.id = variant.definition_id
  WHERE variant.id = profile.variant_id
    AND definition.slug IN (
      'reactive-hop-to-cut',
      'seated-barbell-overhead-press'
    )
    AND variant.status = 'archived';

  UPDATE coaching.exercise_definition_v1
  SET canonical_name = 'Reactive Hop-to-Cut',
      display_name = 'Reactive Hop-to-Cut',
      description =
        'From the declared start, perform one discrete bilateral hop and wait for a valid left-or-right cue during flight or landing. Organize the landing, redirect through the declared 45- or 90-degree cut without extra recovery contacts, accelerate through the response lane, brake in the finish zone, and reset fully before the next repetition.',
      family_key = 'reactive_hop_landing_directional_cut',
      schema_version = '1.0.0',
      card_version = greatest(card_version, 2),
      status = 'review',
      content_confidence = 88,
      scoring_confidence = 76,
      media_confidence = 18,
      movement_patterns = ARRAY['jump', 'land', 'locomote']::TEXT[],
      body_regions = ARRAY[
        'full_body', 'foot', 'ankle', 'knee', 'hip',
        'glutes', 'hamstrings', 'calf', 'pelvis', 'spine'
      ]::TEXT[],
      required_equipment = ARRAY['cones']::TEXT[],
      optional_equipment = ARRAY['none']::TEXT[],
      environment_json = '{
        "surface":{"required":"level_high_traction_sport_appropriate","avoid":["wet","loose","uneven","unexpected_transition"]},
        "space":{"hopZoneMarked":true,"responseLanesMarked":true,"finishZoneMarked":true,"clearRunOutMeters":4,"noncrossingTraffic":true},
        "cue":{"validResponseOptions":["left","right"],"visibleOrAudibleToAthlete":true,"timing":"during_flight_or_landing","invalidCueProtocol":"abort_land_and_reset"},
        "footwear":{"compatibleWithSurface":true,"lacesSecured":true},
        "observation":{"coachSightline":"front_oblique_and_side_when_possible","laneGeometryRecorded":true},
        "sharedStation":{"oneActiveAthletePerLane":true,"coachControlsStartsAndCrossTraffic":true},
        "weather":{"outdoorUse":"only_when_surface_wind_visibility_and_temperature_are_safe"}
      }'::JSONB,
      population_json = '{
        "prerequisites":["pain_free_bilateral_hop_and_landing","repeatable_45_degree_preplanned_cut","controlled_short_acceleration_and_braking","can_follow_abort_cue"],
        "useCaution":["recent_lower_limb_or_back_symptoms","return_from_injury","poor_landing_control","limited_reactive_exposure","fatigue_from_prior_jump_sprint_or_cut_work"],
        "doNotUseWhen":["pain_or_neurologic_symptoms","unsafe_surface_or_lane","cannot_land_and_brake_under_control","cue_not_reliably_perceived","traffic_cannot_be_controlled"],
        "regressionOrder":["preplanned_45_degree_cut","bilateral_hop_to_stick","reactive_step_to_cut","smaller_angle","slower_exit","fewer_responses"],
        "sideBalanceRequired":true,
        "individualizationRequired":true,
        "medicalClearancePolicy":"Follow the athlete care plan and local scope; this card does not diagnose symptoms or clear return to sport."
      }'::JSONB,
      anatomy_json = '{
        "primaryMuscles":["gluteus_maximus","gluteus_medius","quadriceps","hamstrings","gastrocnemius","soleus","adductors"],
        "secondaryMuscles":["tibialis_anterior","peroneals","hip_flexors","spinal_erectors","obliques"],
        "stabilizers":["intrinsic_foot_muscles","deep_hip_rotators","trunk_stabilizers"],
        "joints":["foot","ankle","knee","hip","pelvis","lumbar_spine","thoracic_spine"],
        "jointActions":["ankle_plantarflexion_takeoff","hip_knee_ankle_landing_absorption","frontal_transverse_redirection","horizontal_repropulsion","trunk_orientation_and_bracing"],
        "planes":["sagittal","frontal","transverse"],
        "laterality":"bilateral_hop_then_unilateral_cut_with_both_response_directions_programmed",
        "kineticChain":"closed_chain_hop_landing_cut_and_acceleration",
        "biomechanics":{"orderedContacts":["bilateral_hop_takeoff","bilateral_landing","declared_cut_plant","exit_acceleration","finish_braking"],"difficultyLevers":["cue_uncertainty","cue_timing","cut_angle","approach_speed","exit_distance","response_options","surface","fatigue"],"qualityOutcome":"correct_response_with_owned_landing_single_declared_cut_and_controlled_finish"},
        "evidenceLimit":"Cutting evidence supports task determinants, but exact hop-to-cut dose, tissue loading, and transfer require direct study and individual monitoring."
      }'::JSONB,
      athlete_support_json = '{
        "whyItMatters":"Practices receiving late direction information, landing under control, redirecting, and accelerating without sacrificing finish control.",
        "primaryCue":"Hop, wait, land to the cue, make one clean cut, and own the finish.",
        "expectedSensations":["quick_whole_body_effort","foot_ankle_knee_and_hip_loading","brief_trunk_bracing","controlled_breathing_between_repetitions"],
        "unexpectedSensations":["sharp_or_increasing_pain","giving_way","numbness_or_tingling","dizziness","uncontrolled_slipping_or_collision_risk"],
        "painGuidance":"Abort the repetition, land and brake safely, then tell the coach about pain, instability, neurologic symptoms, dizziness, or an unsafe lane.",
        "selfChecks":["waited_for_valid_cue","landed_inside_zone","correct_direction","one_declared_cut_contact","knee_and_trunk_remained_controlled","accelerated_through_lane","braked_inside_finish_zone","fully_reset"],
        "accessibility":["verbal_or_visual_cue","high_contrast_lane_markers","reduced_angle","reduced_exit_distance","preplanned_response","longer_reset","live_demonstration","text_and_still_sequence"],
        "beforeYouStart":["inspect_surface_and_footwear","walk_lane_geometry","confirm_valid_cues_and_abort_rule","declare_cut_angle_exit_distance_and_finish"],
        "afterRepCheck":["response_accuracy","landing_quality","extra_contacts","exit_quality","finish_control","symptoms","stop_reason"]
      }'::JSONB,
      coach_support_json = '{
        "observationChecklist":["surface_and_lane","cue_validity_and_timing","hop_takeoff","landing_zone","response_accuracy","cut_plant_and_extra_contacts","knee_pelvis_and_trunk_control","exit_acceleration","finish_braking","full_reset"],
        "faultCorrections":{"early_guess":["vary_delay","hold_neutral_start","invalidate_early_reps"],"unstable_landing":["regress_to_hop_to_stick","reduce_angle","slow_exit"],"extra_contacts":["reduce_angle","reduce_exit_speed","preplan_response"],"knee_or_trunk_loss":["stop","reduce_intensity","return_to_owned_preplanned_cut"],"missed_cue":["change_modality_or_contrast","reduce_options","do_not_count_rep"],"finish_overrun":["shorten_exit","enlarge_finish_zone","reduce_speed"]},
        "demonstrationPlan":["show_exact_lane_and_abort_rule","show_hop_and_neutral_flight","show_cue_timing","show_landing_to_one_cut","show_acceleration_and_owned_finish","contrast_guessing_extra_contacts_and_overrun"],
        "groupManagement":["one_active_athlete_per_lane","coach_controls_cue_and_start","separate_left_and_right_exit_paths","no_crossing_behind_finish_zone","retrieve_markers_only_when_lane_closed"],
        "modificationDecisionTree":{"cannot_land_cleanly":"hop_to_stick","landing_clean_but_cut_breaks":"preplanned_smaller_angle","cue_missed":"change_modality_or_reduce_options","repeated_wrong_response":"stop_reactive_set_and_reteach","symptoms_or_unsafe_lane":"stop"},
        "recordingFields":["variant_key","cue_modality","cue_timing","cut_angle","response_side","response_accuracy","landing_quality","cut_contacts","exit_distance","finish_control","effort","symptoms","stop_reason"]
      }'::JSONB,
      support_operations_json = '{
        "issueCategories":["identity_or_variant","cue_delivery","difficulty_or_dose","equipment_or_environment","media_exact_match","accessibility","pain_or_safety","graph_relationship","calibration"],
        "supportEscalation":{"urgent":["injury_event","collision_or_near_miss","neurologic_symptom"],"coachReview":["repeated_wrong_response","repeated_extra_contacts","side_asymmetry","dose_or_lane_mismatch"],"contentReview":["unclear_cue_window","conflicting_instruction","missing_accessibility","media_mismatch"]},
        "retentionPolicy":"Retain card version, variant, lane geometry, cue modality and timing, response, contacts, dose, quality, symptoms, stop reason, and reviewer decisions according to facility policy.",
        "changeImpactPolicy":"Changes to ordered contacts, cue window, cut angle, lane, terminal action, difficulty, dose, media, or graph relationships require a new card version, regenerated test packet, and renewed affected reviews.",
        "knownLimitations":["no_title_level_exact_media_candidate","no_direct_exact_variant_dose_trial","scores_and_graph_edges_are_unapproved_proposals"],
        "supportSummary":"Never count an early guess, wrong response, extra recovery-contact sequence, uncontrolled landing, or uncontrolled finish as a successful repetition."
      }'::JSONB,
      approved_video_url = NULL,
      reviewed_by = NULL,
      approved_by = NULL,
      last_reviewed_at = NULL,
      provenance_json = provenance_json || jsonb_build_object(
        'structuralCompletionMigration', migration_key,
        'researchBatch', 'reactive-hop-to-cut-family-v1',
        'researchVersion', '2026-07-26.48',
        'difficultyModel', 'max_exercise_complexity_physical_difficulty',
        'evidenceState', 'candidate_requires_human_review',
        'mediaState', 'oembed_healthy_comparison_candidates_no_exact_match',
        'humanReviewRequired', TRUE,
        'publicationQuarantined', TRUE,
        'mediaApprovalCreated', FALSE,
        'graphApprovalCreated', FALSE,
        'calibrationApprovalCreated', FALSE
      ),
      updated_at = now()
  WHERE slug = 'reactive-hop-to-cut'
    AND status <> 'archived';

  UPDATE coaching.exercise_definition_v1
  SET canonical_name = 'Seated Overhead Press',
      display_name = 'Seated Overhead Press',
      description =
        'Sit on the declared stable bench with feet, seat, ribs, pelvis, back support, implement, grip, rack, load, range, tempo, and spotter plan established. Press one barbell or two dumbbells overhead without deliberate leg drive or backward lean, finish in the owned overhead position, lower symmetrically to the same start, and secure the implement before relaxing.',
      family_key = 'seated_strict_bilateral_overhead_press',
      schema_version = '1.0.0',
      card_version = greatest(card_version, 2),
      status = 'review',
      content_confidence = 90,
      scoring_confidence = 80,
      media_confidence = 32,
      movement_patterns = ARRAY['push', 'brace']::TEXT[],
      body_regions = ARRAY[
        'shoulder', 'scapula', 'elbow', 'wrist', 'hand',
        'core', 'spine', 'rib_cage', 'pelvis'
      ]::TEXT[],
      required_equipment = ARRAY['bench']::TEXT[],
      optional_equipment = ARRAY[
        'barbell', 'dumbbells', 'rack', 'squat_rack', 'plates'
      ]::TEXT[],
      environment_json = '{
        "surface":{"required":"level_nonslip","avoid":["wet","uneven","unstable_platform"]},
        "space":{"overheadClearanceRequired":true,"clearPickupAndSetDownZone":true,"noTrafficThroughLiftingZone":true},
        "bench":{"stable":true,"angle":"declared_per_variant","seatAndBackLocksInspected":true,"athleteFitRequired":true},
        "barbellStation":{"rackHeightDeclared":true,"hooksAligned":true,"barAndPlatesInspected":true,"collarsRequiredWhenPlatesUsed":true,"spotterAccessClear":true},
        "dumbbellStation":{"matchedPair":true,"handlesAndHeadsInspected":true,"safePickupAndSetDownPlan":true},
        "observation":{"coachCanSeeRibPelvisElbowWristAndPath":true},
        "sharedStation":{"oneActiveLifterPerBench":true,"loadingChangesVerballyConfirmed":true}
      }'::JSONB,
      population_json = '{
        "prerequisites":["pain_free_owned_overhead_range","stable_seated_base","can_control_selected_implement_to_start_and_finish","understands_spotter_and_abort_signals"],
        "useCaution":["current_shoulder_elbow_wrist_neck_or_back_symptoms","recent_upper_body_procedure","limited_overhead_range","history_of_pressure_or_dizziness_symptoms","fatigue_from_prior_press_throw_or_contact_work"],
        "doNotUseWhen":["pain_or_neurologic_symptoms","unsafe_or_unfitted_bench","damaged_or_unsecured_equipment","overhead_clearance_or_spotting_inadequate","cannot_control_pickup_start_or_set_down"],
        "regressionOrder":["reduce_load","increase_back_support","neutral_grip_dumbbells","shorter_owned_range","fewer_repetitions","non_overhead_substitution_after_review"],
        "individualizationRequired":true,
        "medicalClearancePolicy":"Follow the athlete care plan and local scope; this card does not diagnose symptoms or prescribe through pain."
      }'::JSONB,
      anatomy_json = '{
        "primaryMuscles":["anterior_deltoid","middle_deltoid","triceps_brachii"],
        "secondaryMuscles":["upper_trapezius","serratus_anterior","pectoralis_major","posterior_deltoid"],
        "stabilizers":["rotator_cuff","forearm_flexors","forearm_extensors","abdominal_wall","spinal_erectors","gluteus_maximus"],
        "joints":["glenohumeral","scapulothoracic","elbow","wrist","thoracic_spine","lumbar_spine","pelvis","hip","knee","foot"],
        "jointActions":["shoulder_flexion_and_abduction","scapular_upward_rotation","elbow_extension","elbow_flexion_control","wrist_stabilization","thoracolumbar_anti_extension"],
        "planes":["scapular","sagittal","frontal"],
        "laterality":"bilateral",
        "kineticChain":"seated_open_chain_upper_limb_press_with_grounded_lower_body_base",
        "biomechanics":{"definingAction":"strict_bilateral_vertical_press_without_deliberate_leg_drive","variantLevers":["implement","independent_arm_demand","back_support","bench_angle","grip","rack","owned_range","tempo","load"],"qualityOutcome":"symmetric_owned_overhead_path_and_controlled_same_path_return"},
        "evidenceLimit":"Configuration-specific EMG and strength evidence does not establish one universal best press or individual clinical suitability."
      }'::JSONB,
      athlete_support_json = '{
        "whyItMatters":"Builds strict overhead pressing strength and control from a repeatable seated base.",
        "primaryCue":"Feet and seat set, ribs over pelvis; press smoothly overhead, lower to the same start, then secure the implement.",
        "expectedSensations":["deltoid_and_triceps_effort","upper_back_and_scapular_control","firm_grip","trunk_bracing_without_breath_panic"],
        "unexpectedSensations":["sharp_or_increasing_pain","numbness_or_tingling","dizziness_or_pressure_symptoms","joint_instability","loss_of_implement_control"],
        "painGuidance":"Stop, control or safely hand off the implement, and tell the coach about pain, neurologic symptoms, dizziness, pressure, or loss of control.",
        "selfChecks":["feet_and_seat_remain_set","ribs_do_not_flare","no_deliberate_leg_drive","wrists_stack_over_elbows","both_sides_move_together","range_matches_owned_start_and_finish","return_is_controlled","implement_is_secure_before_relaxing"],
        "accessibility":["lighter_load","neutral_grip_dumbbells","greater_back_support","shorter_pain_free_range","fewer_repetitions","longer_rest","live_spotter","text_audio_and_still_instruction"],
        "beforeYouStart":["inspect_bench_and_implement","set_bench_and_rack","confirm_load_and_collars","declare_range_tempo_and_dose","agree_spotter_and_abort_signal"],
        "afterSetCheck":["repetitions_and_load","range_and_path","effort_or_repetitions_in_reserve","compensation","symptoms","equipment_control","stop_reason"]
      }'::JSONB,
      coach_support_json = '{
        "observationChecklist":["bench_rack_and_clearance","feet_seat_and_back_support","rib_pelvis_position","grip_and_wrist_stack","elbow_path","scapular_motion","implement_symmetry","owned_range","tempo_and_rep_speed","breathing","spotter_readiness","secure_finish"],
        "faultCorrections":{"rib_flare_or_backward_lean":["reduce_load","increase_back_support","shorten_range","cue_ribs_over_pelvis"],"asymmetric_path":["stop_set","reduce_load","check_grip_and_setup","use_owned_dumbbell_or_barbell_variant"],"wrist_collapse":["reduce_load","reset_grip_and_stack"],"range_loss_or_grind":["end_set","increase_rest","reduce_load_or_repetitions"],"unsafe_rerack_or_setdown":["coach_and_spotter_take_control","rehearse_equipment_operation_before_next_set"]},
        "demonstrationPlan":["show_equipment_inspection_and_bench_setup","show_exact_grip_rack_and_start","show_strict_press_and_owned_finish","show_controlled_return","show_spotter_abort_and_secure_finish","contrast_leg_drive_rib_flare_asymmetry_and_grinding"],
        "groupManagement":["one_active_lifter_per_bench","load_changes_confirmed_by_both_sides","spotter_position_kept_clear","dumbbells_not_left_in_walkways","rack_height_reset_only_when_station_is_closed"],
        "modificationDecisionTree":{"cannot_control_pickup_or_start":"lighter_or_different_implement","trunk_compensation":"increase_support_or_reduce_load","overhead_range_not_owned":"shorter_range_or_reviewed_substitution","path_asymmetry":"stop_and_reassess_setup","symptoms_or_equipment_fault":"stop"},
        "recordingFields":["variant_key","bench_angle","back_support","implement","grip","rack_height","load","range","tempo","repetitions","rir_or_rpe","path_symmetry","compensation","spotter","symptoms","stop_reason"]
      }'::JSONB,
      support_operations_json = '{
        "issueCategories":["identity_or_variant","difficulty_or_dose","equipment_or_environment","media_exact_match","accessibility","pain_or_safety","graph_relationship","calibration"],
        "supportEscalation":{"urgent":["injury_event","dropped_implement","failed_rerack_or_spotter_rescue","neurologic_symptom"],"coachReview":["repeated_asymmetry","repeated_trunk_compensation","load_or_range_mismatch","equipment_fit_problem"],"contentReview":["conflicting_instruction","missing_accessibility","media_variant_mismatch"]},
        "retentionPolicy":"Retain card version, exact variant, bench, implement, grip, rack, load, range, tempo, dose, effort, quality, symptoms, stop reason, and reviewer decisions according to facility policy.",
        "changeImpactPolicy":"Changes to seated base, implement, support, grip, path, range, difficulty, dose, equipment operations, media, or graph relationships require a new card version, regenerated test packet, and renewed affected reviews.",
        "knownLimitations":["candidate_media_not_human_viewed","no_universal_configuration_superiority","scores_and_graph_edges_are_unapproved_proposals"],
        "supportSummary":"Never convert a strict press into leg-driven or uncontrolled work merely to finish the planned repetition count."
      }'::JSONB,
      approved_video_url = NULL,
      reviewed_by = NULL,
      approved_by = NULL,
      last_reviewed_at = NULL,
      provenance_json = provenance_json || jsonb_build_object(
        'structuralCompletionMigration', migration_key,
        'researchBatch', 'seated-overhead-press-family-v1',
        'researchVersion', '2026-07-26.49',
        'difficultyModel', 'max_exercise_complexity_physical_difficulty',
        'evidenceState', 'candidate_requires_human_review',
        'mediaState', 'candidate_oembed_metadata_only',
        'humanReviewRequired', TRUE,
        'publicationQuarantined', TRUE,
        'mediaApprovalCreated', FALSE,
        'graphApprovalCreated', FALSE,
        'calibrationApprovalCreated', FALSE
      ),
      updated_at = now()
  WHERE slug = 'seated-barbell-overhead-press'
    AND status <> 'archived';

  CREATE TEMP TABLE completion_variant_seed (
    definition_slug TEXT NOT NULL,
    variant_key TEXT NOT NULL,
    display_name TEXT NOT NULL,
    modifier_keys TEXT[] NOT NULL,
    exercise_complexity SMALLINT NOT NULL,
    physical_difficulty SMALLINT NOT NULL,
    supervision_demand SMALLINT NOT NULL,
    failure_consequence SMALLINT NOT NULL,
    impact SMALLINT NOT NULL,
    work_capacity_demand SMALLINT NOT NULL,
    requirements JSONB NOT NULL,
    load_profile JSONB NOT NULL,
    fatigue_profile JSONB NOT NULL,
    programming_profile JSONB NOT NULL,
    PRIMARY KEY (definition_slug, variant_key)
  ) ON COMMIT DROP;

  INSERT INTO completion_variant_seed VALUES
    (
      'reactive-hop-to-cut',
      'bilateral-hop-reactive-45-cut',
      'Bilateral Hop to Reactive 45-Degree Cut',
      ARRAY['bilateral_hop','reactive_cue','45_degree_cut','bilateral_responses']::TEXT[],
      64, 54, 70, 65, 62, 48,
      '{
        "selectable":true,
        "hopTakeoff":"bilateral",
        "hopLanding":"bilateral_inside_marked_zone",
        "cueTiming":"during_flight_or_landing",
        "validResponses":["left_45_degrees","right_45_degrees"],
        "cueModality":"declared_visual_or_verbal",
        "responseRule":"wait_for_valid_cue",
        "cutContacts":"one_declared_primary_cut_without_extra_recovery_contacts",
        "exitDistanceMeters":{"minimum":3,"target":4,"maximum":5},
        "terminalAction":"controlled_braking_inside_finish_zone",
        "reset":"walk_back_only_after_lane_closed_and_full_readiness",
        "sideBalanceRequired":true
      }'::JSONB,
      '{
        "gripDemand":4,
        "spinalLoading":28,
        "eccentricStress":68,
        "landingContactsPerRep":2,
        "externalLoadMethod":"bodyweight",
        "externalLoadDescription":"bodyweight bilateral hop landing, directional plant, and short acceleration",
        "contactAccounting":{"hopTakeoffs":1,"hopLandings":1,"cutPlants":1,"exitContacts":"distance_dependent"},
        "loadTracking":["body_mass","surface","cut_angle","exit_distance","response_side","total_repetitions","total_high_intent_contacts"]
      }'::JSONB,
      '{
        "localMuscleFatigue":58,
        "gripFatigue":4,
        "technicalFatigueSensitivity":74,
        "impactAccumulation":70,
        "recoveryHours":36,
        "primaryFatigueSites":["foot_ankle_complex","quadriceps","hamstrings","gluteals","adductors","trunk"],
        "decisionFatigueSensitivity":72,
        "stopBefore":["wrong_response","unstable_landing","extra_recovery_contacts","knee_or_trunk_control_loss","exit_speed_drop","finish_overrun"]
      }'::JSONB,
      '{
        "trainingStimuli":["reactive_decision","landing_control","45_degree_redirection","short_acceleration","finish_braking"],
        "stimulusDose":{"primary":"high_quality_side_balanced_repetitions","fatigueCeiling":"low"},
        "weeklyExposure":{"typical":1,"maximumWithoutReview":2},
        "prerequisites":["owned_bilateral_hop_to_stick","owned_preplanned_45_degree_cut","controlled_short_sprint_and_brake"],
        "completionCriteria":["correct_response","owned_landing","one_clean_cut","accelerate_through_lane","controlled_finish"],
        "sequenceRules":["after_general_and_specific_prepare","before_high_fatigue_jump_sprint_cut_or_lower_body_work"],
        "pairingCompatibility":{"preferred":["low_fatigue_upper_body_skill","full_recovery"],"avoid":["dense_lower_body_conditioning","fatigued_change_of_direction"]},
        "interferenceRules":["counts_toward_jump_landing_cut_sprint_and_high_neural_budgets"],
        "uncertaintyPolicy":{"unclear_cue_or_lane":"do_not_start","unowned_landing":"regress_to_hop_to_stick"},
        "cumulativeBudget":{"jumpContactsPerRep":1,"landingContactsPerRep":1,"cutContactsPerRep":1,"technicalSensitivity":74,"impact":70}
      }'::JSONB
    ),
    (
      'reactive-hop-to-cut',
      'bilateral-hop-reactive-90-cut',
      'Bilateral Hop to Reactive 90-Degree Cut',
      ARRAY['bilateral_hop','reactive_cue','90_degree_cut','bilateral_responses']::TEXT[],
      72, 62, 78, 74, 72, 56,
      '{
        "selectable":true,
        "hopTakeoff":"bilateral",
        "hopLanding":"bilateral_inside_marked_zone",
        "cueTiming":"during_flight_or_landing",
        "validResponses":["left_90_degrees","right_90_degrees"],
        "cueModality":"declared_visual_or_verbal",
        "responseRule":"wait_for_valid_cue",
        "cutContacts":"one_declared_primary_cut_without_extra_recovery_contacts",
        "exitDistanceMeters":{"minimum":3,"target":4,"maximum":5},
        "terminalAction":"controlled_braking_inside_finish_zone",
        "reset":"walk_back_only_after_lane_closed_and_full_readiness",
        "sideBalanceRequired":true,
        "prerequisiteVariant":"bilateral-hop-reactive-45-cut"
      }'::JSONB,
      '{
        "gripDemand":4,
        "spinalLoading":34,
        "eccentricStress":78,
        "landingContactsPerRep":2,
        "externalLoadMethod":"bodyweight",
        "externalLoadDescription":"bodyweight bilateral hop landing, sharper directional plant, and short acceleration",
        "contactAccounting":{"hopTakeoffs":1,"hopLandings":1,"cutPlants":1,"exitContacts":"distance_dependent"},
        "loadTracking":["body_mass","surface","cut_angle","exit_distance","response_side","total_repetitions","total_high_intent_contacts"]
      }'::JSONB,
      '{
        "localMuscleFatigue":66,
        "gripFatigue":4,
        "technicalFatigueSensitivity":82,
        "impactAccumulation":80,
        "recoveryHours":48,
        "primaryFatigueSites":["foot_ankle_complex","quadriceps","hamstrings","gluteals","adductors","trunk"],
        "decisionFatigueSensitivity":78,
        "stopBefore":["wrong_response","unstable_landing","extra_recovery_contacts","knee_or_trunk_control_loss","exit_speed_drop","finish_overrun"]
      }'::JSONB,
      '{
        "trainingStimuli":["reactive_decision","landing_control","90_degree_redirection","short_acceleration","finish_braking"],
        "stimulusDose":{"primary":"high_quality_side_balanced_repetitions","fatigueCeiling":"low"},
        "weeklyExposure":{"typical":1,"maximumWithoutReview":2},
        "prerequisites":["repeatable_reactive_45_degree_variant","owned_preplanned_90_degree_cut","controlled_short_sprint_and_brake"],
        "completionCriteria":["correct_response","owned_landing","one_clean_90_degree_cut","accelerate_through_lane","controlled_finish"],
        "sequenceRules":["after_general_and_specific_prepare","before_high_fatigue_jump_sprint_cut_or_lower_body_work"],
        "pairingCompatibility":{"preferred":["low_fatigue_upper_body_skill","full_recovery"],"avoid":["dense_lower_body_conditioning","fatigued_change_of_direction"]},
        "interferenceRules":["counts_toward_jump_landing_cut_sprint_and_high_neural_budgets"],
        "uncertaintyPolicy":{"unclear_cue_or_lane":"do_not_start","unowned_45_degree_variant":"do_not_progress"},
        "cumulativeBudget":{"jumpContactsPerRep":1,"landingContactsPerRep":1,"cutContactsPerRep":1,"technicalSensitivity":82,"impact":80}
      }'::JSONB
    ),
    (
      'seated-barbell-overhead-press',
      'barbell-unsupported-pronated',
      'Unsupported Seated Barbell Overhead Press — Pronated Grip',
      ARRAY['barbell','unsupported','pronated_grip','bilateral','strict']::TEXT[],
      50, 58, 58, 56, 2, 54,
      '{
        "selectable":true,
        "base":"stable_bench_without_back_support",
        "benchAngleDegrees":90,
        "implement":"one_barbell",
        "grip":"pronated_declared_width",
        "rack":"front_shoulders_or_upper_chest_owned_start",
        "path":"in_front_of_head_then_owned_overhead_finish",
        "legDrive":"none_deliberate",
        "range":"pain_free_owned_start_to_overhead",
        "tempo":"declared_controlled_eccentric",
        "spotting":"required_by_load_risk_and_facility_policy",
        "pickupAndSetDown":"rack_only_unless_reviewed_plan_declares_otherwise"
      }'::JSONB,
      '{
        "gripDemand":45,
        "spinalLoading":42,
        "eccentricStress":55,
        "landingContactsPerRep":0,
        "externalLoadMethod":"barbell",
        "externalLoadDescription":"one barbell with declared plates and collars pressed from a stable unsupported seated base",
        "loadTracking":["bar_mass","plate_mass","total_external_load","repetitions","tempo","range","rir_or_rpe"]
      }'::JSONB,
      '{
        "localMuscleFatigue":60,
        "gripFatigue":42,
        "technicalFatigueSensitivity":62,
        "impactAccumulation":2,
        "recoveryHours":36,
        "primaryFatigueSites":["deltoids","triceps","upper_back","rotator_cuff","trunk"],
        "stopBefore":["rib_flare_or_backward_lean","asymmetric_path","wrist_collapse","range_loss","grinding_rep","unsafe_rerack"]
      }'::JSONB,
      '{
        "trainingStimuli":["bilateral_overhead_strength","triceps_strength","scapular_control","seated_trunk_bracing"],
        "stimulusDose":{"primary":"quality_external_load_repetitions","fatigueCeiling":"moderate"},
        "weeklyExposure":{"typical":1,"maximumWithoutReview":3},
        "prerequisites":["owned_overhead_range","stable_unsupported_seat","safe_barbell_rack_and_spotter_protocol"],
        "completionCriteria":["strict_no_leg_drive","symmetric_path","owned_finish_and_return","secure_rerack"],
        "sequenceRules":["after_specific_warmup","before_fatigue_sensitive_throwing_or_overhead_skill","before_dense_press_conditioning"],
        "pairingCompatibility":{"preferred":["lower_body_strength","low_fatigue_mobility"],"avoid":["high_density_overhead_or_triceps_work"]},
        "interferenceRules":["counts_toward_shoulder_triceps_grip_and_axial_fatigue_budgets"],
        "uncertaintyPolicy":{"unclear_rack_or_spot":"do_not_lift","range_or_load_uncertain":"use_lighter_supported_variant"},
        "cumulativeBudget":{"shoulderPressVolume":"load_times_repetitions","technicalSensitivity":62,"impact":2}
      }'::JSONB
    ),
    (
      'seated-barbell-overhead-press',
      'barbell-back-supported-pronated',
      'Back-Supported Seated Barbell Overhead Press — Pronated Grip',
      ARRAY['barbell','back_supported','pronated_grip','bilateral','strict']::TEXT[],
      44, 60, 56, 56, 2, 56,
      '{
        "selectable":true,
        "base":"stable_upright_back_supported_bench",
        "benchAngleDegrees":{"minimum":75,"target":80,"maximum":90},
        "implement":"one_barbell",
        "grip":"pronated_declared_width",
        "rack":"front_shoulders_or_upper_chest_owned_start",
        "path":"in_front_of_head_then_owned_overhead_finish",
        "legDrive":"none_deliberate",
        "range":"pain_free_owned_start_to_overhead",
        "tempo":"declared_controlled_eccentric",
        "spotting":"required_by_load_risk_and_facility_policy",
        "pickupAndSetDown":"rack_only_unless_reviewed_plan_declares_otherwise"
      }'::JSONB,
      '{
        "gripDemand":45,
        "spinalLoading":30,
        "eccentricStress":58,
        "landingContactsPerRep":0,
        "externalLoadMethod":"barbell",
        "externalLoadDescription":"one barbell with declared plates and collars pressed from an upright back-supported bench",
        "loadTracking":["bar_mass","plate_mass","total_external_load","repetitions","tempo","range","rir_or_rpe"]
      }'::JSONB,
      '{
        "localMuscleFatigue":64,
        "gripFatigue":42,
        "technicalFatigueSensitivity":56,
        "impactAccumulation":2,
        "recoveryHours":36,
        "primaryFatigueSites":["deltoids","triceps","upper_back","rotator_cuff"],
        "stopBefore":["bench_contact_loss","rib_flare","asymmetric_path","wrist_collapse","range_loss","grinding_rep","unsafe_rerack"]
      }'::JSONB,
      '{
        "trainingStimuli":["bilateral_overhead_strength","triceps_strength","scapular_control"],
        "stimulusDose":{"primary":"quality_external_load_repetitions","fatigueCeiling":"moderate"},
        "weeklyExposure":{"typical":1,"maximumWithoutReview":3},
        "prerequisites":["owned_overhead_range","bench_fit_and_contact","safe_barbell_rack_and_spotter_protocol"],
        "completionCriteria":["strict_no_leg_drive","back_contact_preserved","symmetric_path","owned_finish_and_return","secure_rerack"],
        "sequenceRules":["after_specific_warmup","before_fatigue_sensitive_throwing_or_overhead_skill","before_dense_press_conditioning"],
        "pairingCompatibility":{"preferred":["lower_body_strength","low_fatigue_mobility"],"avoid":["high_density_overhead_or_triceps_work"]},
        "interferenceRules":["counts_toward_shoulder_triceps_grip_and_press_volume_budgets"],
        "uncertaintyPolicy":{"unclear_rack_or_spot":"do_not_lift","range_or_load_uncertain":"reduce_load"},
        "cumulativeBudget":{"shoulderPressVolume":"load_times_repetitions","technicalSensitivity":56,"impact":2}
      }'::JSONB
    ),
    (
      'seated-barbell-overhead-press',
      'dumbbell-back-supported-neutral',
      'Back-Supported Seated Dumbbell Overhead Press — Neutral Grip',
      ARRAY['two_dumbbells','back_supported','neutral_grip','bilateral','strict']::TEXT[],
      46, 50, 50, 50, 2, 50,
      '{
        "selectable":true,
        "base":"stable_upright_back_supported_bench",
        "benchAngleDegrees":{"minimum":75,"target":80,"maximum":90},
        "implement":"two_matched_dumbbells",
        "grip":"neutral",
        "rack":"shoulder_level_owned_start",
        "path":"independent_owned_paths_to_overhead_finish",
        "legDrive":"none_deliberate",
        "range":"pain_free_owned_start_to_overhead",
        "tempo":"declared_controlled_eccentric",
        "spotting":"required_by_load_risk_and_facility_policy",
        "pickupAndSetDown":"declared_thigh_assist_and_controlled_setdown_or_spotter_handoff"
      }'::JSONB,
      '{
        "gripDemand":50,
        "spinalLoading":28,
        "eccentricStress":50,
        "landingContactsPerRep":0,
        "externalLoadMethod":"dumbbells",
        "externalLoadDescription":"two matched dumbbells pressed independently from an upright back-supported bench",
        "loadTracking":["mass_per_dumbbell","combined_external_load","repetitions","tempo","range","rir_or_rpe"]
      }'::JSONB,
      '{
        "localMuscleFatigue":54,
        "gripFatigue":48,
        "technicalFatigueSensitivity":58,
        "impactAccumulation":2,
        "recoveryHours":30,
        "primaryFatigueSites":["deltoids","triceps","upper_back","rotator_cuff","forearms"],
        "stopBefore":["bench_contact_loss","rib_flare","independent_path_divergence","wrist_collapse","range_loss","grinding_rep","unsafe_setdown"]
      }'::JSONB,
      '{
        "trainingStimuli":["bilateral_overhead_strength","independent_arm_control","triceps_strength","scapular_control"],
        "stimulusDose":{"primary":"quality_external_load_repetitions","fatigueCeiling":"moderate"},
        "weeklyExposure":{"typical":1,"maximumWithoutReview":3},
        "prerequisites":["owned_overhead_range","bench_fit_and_contact","safe_dumbbell_pickup_and_setdown"],
        "completionCriteria":["strict_no_leg_drive","back_contact_preserved","controlled_independent_paths","owned_finish_and_return","secure_setdown"],
        "sequenceRules":["after_specific_warmup","before_fatigue_sensitive_throwing_or_overhead_skill","before_dense_press_conditioning"],
        "pairingCompatibility":{"preferred":["lower_body_strength","low_fatigue_mobility"],"avoid":["high_density_overhead_or_grip_work"]},
        "interferenceRules":["counts_toward_shoulder_triceps_grip_and_press_volume_budgets"],
        "uncertaintyPolicy":{"pickup_or_setdown_unclear":"do_not_lift","range_or_load_uncertain":"reduce_load"},
        "cumulativeBudget":{"shoulderPressVolume":"combined_load_times_repetitions","technicalSensitivity":58,"impact":2}
      }'::JSONB
    ),
    (
      'seated-barbell-overhead-press',
      'dumbbell-back-supported-pronated',
      'Back-Supported Seated Dumbbell Overhead Press — Pronated Grip',
      ARRAY['two_dumbbells','back_supported','pronated_grip','bilateral','strict']::TEXT[],
      48, 52, 52, 52, 2, 52,
      '{
        "selectable":true,
        "base":"stable_upright_back_supported_bench",
        "benchAngleDegrees":{"minimum":75,"target":80,"maximum":90},
        "implement":"two_matched_dumbbells",
        "grip":"pronated",
        "rack":"shoulder_level_owned_start",
        "path":"independent_owned_paths_to_overhead_finish",
        "legDrive":"none_deliberate",
        "range":"pain_free_owned_start_to_overhead",
        "tempo":"declared_controlled_eccentric",
        "spotting":"required_by_load_risk_and_facility_policy",
        "pickupAndSetDown":"declared_thigh_assist_and_controlled_setdown_or_spotter_handoff"
      }'::JSONB,
      '{
        "gripDemand":50,
        "spinalLoading":28,
        "eccentricStress":52,
        "landingContactsPerRep":0,
        "externalLoadMethod":"dumbbells",
        "externalLoadDescription":"two matched dumbbells pressed independently with a pronated grip from an upright back-supported bench",
        "loadTracking":["mass_per_dumbbell","combined_external_load","repetitions","tempo","range","rir_or_rpe"]
      }'::JSONB,
      '{
        "localMuscleFatigue":56,
        "gripFatigue":48,
        "technicalFatigueSensitivity":60,
        "impactAccumulation":2,
        "recoveryHours":30,
        "primaryFatigueSites":["deltoids","triceps","upper_back","rotator_cuff","forearms"],
        "stopBefore":["bench_contact_loss","rib_flare","independent_path_divergence","wrist_collapse","range_loss","grinding_rep","unsafe_setdown"]
      }'::JSONB,
      '{
        "trainingStimuli":["bilateral_overhead_strength","independent_arm_control","triceps_strength","scapular_control"],
        "stimulusDose":{"primary":"quality_external_load_repetitions","fatigueCeiling":"moderate"},
        "weeklyExposure":{"typical":1,"maximumWithoutReview":3},
        "prerequisites":["owned_overhead_range","bench_fit_and_contact","safe_dumbbell_pickup_and_setdown"],
        "completionCriteria":["strict_no_leg_drive","back_contact_preserved","controlled_independent_paths","owned_finish_and_return","secure_setdown"],
        "sequenceRules":["after_specific_warmup","before_fatigue_sensitive_throwing_or_overhead_skill","before_dense_press_conditioning"],
        "pairingCompatibility":{"preferred":["lower_body_strength","low_fatigue_mobility"],"avoid":["high_density_overhead_or_grip_work"]},
        "interferenceRules":["counts_toward_shoulder_triceps_grip_and_press_volume_budgets"],
        "uncertaintyPolicy":{"pickup_or_setdown_unclear":"do_not_lift","range_or_load_uncertain":"reduce_load"},
        "cumulativeBudget":{"shoulderPressVolume":"combined_load_times_repetitions","technicalSensitivity":60,"impact":2}
      }'::JSONB
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
    seed.modifier_keys,
    jsonb_build_object(
      'technicalComplexity', seed.exercise_complexity,
      'absoluteLoadDemand', seed.physical_difficulty,
      'baseOverallDifficulty',
        greatest(seed.exercise_complexity, seed.physical_difficulty),
      'coordinationDemand', seed.exercise_complexity,
      'supervisionDemand', seed.supervision_demand,
      'failureConsequence', seed.failure_consequence,
      'impact', seed.impact,
      'workCapacityDemand', seed.work_capacity_demand,
      'difficultyModel', 'max_exercise_complexity_physical_difficulty',
      'dimensionMeaning', jsonb_build_object(
        'technicalComplexity', 'exercise_complexity',
        'absoluteLoadDemand', 'physical_difficulty'
      )
    ),
    seed.requirements,
    'review',
    seed.load_profile,
    seed.fatigue_profile,
    seed.programming_profile
  FROM completion_variant_seed seed
  JOIN coaching.exercise_definition_v1 definition
    ON definition.slug = seed.definition_slug
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

  CREATE TEMP TABLE completion_profile_seed (
    definition_slug TEXT NOT NULL,
    variant_key TEXT NOT NULL,
    profile_key TEXT NOT NULL,
    phase_key TEXT NOT NULL,
    role TEXT NOT NULL,
    purpose TEXT NOT NULL,
    suitability SMALLINT NOT NULL,
    alignment SMALLINT NOT NULL,
    objective_relevance JSONB NOT NULL,
    dosage JSONB NOT NULL,
    quality_gate TEXT NOT NULL,
    stop_rules TEXT[] NOT NULL,
    coach_instructions TEXT NOT NULL,
    athlete_instructions TEXT NOT NULL,
    expected_adaptation TEXT NOT NULL,
    equipment_required TEXT[] NOT NULL,
    logistics JSONB NOT NULL,
    time_model JSONB NOT NULL,
    dose_scaling JSONB NOT NULL,
    measurement JSONB NOT NULL,
    support_prompts JSONB NOT NULL,
    PRIMARY KEY (definition_slug, variant_key, profile_key)
  ) ON COMMIT DROP;

  INSERT INTO completion_profile_seed
  SELECT
    seed.definition_slug,
    seed.variant_key,
    profile.profile_key,
    profile.phase_key,
    profile.role,
    CASE
      WHEN profile.profile_key = 'movement-intelligence-quality'
        THEN 'Practice a small number of correct cue-to-landing-to-cut responses with complete recovery and no fatigue-driven contact changes.'
      WHEN profile.profile_key = 'output-quality'
        THEN 'Express fast reactive redirection only while response accuracy, landing, cut contacts, exit acceleration, and finish control remain repeatable.'
      WHEN profile.profile_key = 'capacity-strength'
        THEN 'Develop strict seated overhead strength through an owned range with load, repetitions, effort, rest, spotting, and equipment operations declared.'
      ELSE 'Build controlled submaximal overhead-press volume while preserving seated position, path symmetry, range, tempo, breathing, and a secure finish.'
    END,
    CASE
      WHEN profile.profile_key = 'movement-intelligence-quality' THEN 94
      WHEN profile.profile_key = 'output-quality' THEN 90
      WHEN profile.profile_key = 'capacity-strength' THEN 94
      ELSE 88
    END,
    CASE
      WHEN profile.profile_key = 'movement-intelligence-quality' THEN 94
      WHEN profile.profile_key = 'output-quality' THEN 90
      WHEN profile.profile_key = 'capacity-strength' THEN 92
      ELSE 88
    END,
    CASE
      WHEN seed.definition_slug = 'reactive-hop-to-cut' THEN
        jsonb_build_object(
          'reactiveDecision', 96,
          'landingControl', 92,
          'changeOfDirection', 94,
          'acceleration', 82,
          'fatigueCost', CASE
            WHEN profile.profile_key = 'output-quality' THEN 62
            ELSE 48
          END,
          'context', 'quality_first_reactive_redirection'
        )
      ELSE
        jsonb_build_object(
          'strength', CASE
            WHEN profile.profile_key = 'capacity-strength' THEN 94
            ELSE 82
          END,
          'shoulderControl', 86,
          'workCapacity', CASE
            WHEN profile.profile_key = 'resilience-controlled-volume' THEN 88
            ELSE 70
          END,
          'fatigueCost', CASE
            WHEN profile.profile_key = 'capacity-strength' THEN 64
            ELSE 56
          END,
          'context', 'strict_seated_overhead_press'
        )
    END,
    CASE
      WHEN profile.profile_key = 'movement-intelligence-quality' THEN
        jsonb_build_object(
          'sets', 2,
          'repetitionsPerSide', jsonb_build_object(
            'minimum', 2,
            'target', 3,
            'maximum', 4
          ),
          'repetitionRestSeconds', jsonb_build_object(
            'minimum', 30,
            'target', 45,
            'maximum', 60
          ),
          'setRestSeconds', jsonb_build_object(
            'minimum', 120,
            'target', 150,
            'maximum', 180
          ),
          'intent', 'submaximal_speed_full_decision_and_contact_quality',
          'stopAtTechnicalRir', 3
        )
      WHEN profile.profile_key = 'output-quality' THEN
        jsonb_build_object(
          'sets', jsonb_build_object(
            'minimum', 2,
            'target', 3,
            'maximum', 4
          ),
          'repetitionsPerSide', jsonb_build_object(
            'minimum', 1,
            'target', 2,
            'maximum', 3
          ),
          'repetitionRestSeconds', jsonb_build_object(
            'minimum', 45,
            'target', 60,
            'maximum', 90
          ),
          'setRestSeconds', jsonb_build_object(
            'minimum', 150,
            'target', 180,
            'maximum', 240
          ),
          'intent', 'high_but_owned_speed',
          'maximumQualityRepetitions', CASE
            WHEN seed.variant_key LIKE '%90-cut' THEN 12
            ELSE 16
          END,
          'stopAtTechnicalRir', 4
        )
      WHEN profile.profile_key = 'capacity-strength' THEN
        jsonb_build_object(
          'sets', jsonb_build_object(
            'minimum', 3,
            'target', 4,
            'maximum', 5
          ),
          'repetitions', jsonb_build_object(
            'minimum', 3,
            'target', 5,
            'maximum', 8
          ),
          'loadTarget', 'declared_load_at_two_to_three_repetitions_in_reserve',
          'tempo', 'controlled_eccentric_no_bounce',
          'restSeconds', jsonb_build_object(
            'minimum', 120,
            'target', 180,
            'maximum', 300
          ),
          'stopAtRir', 2
        )
      ELSE
        jsonb_build_object(
          'sets', jsonb_build_object(
            'minimum', 2,
            'target', 3,
            'maximum', 4
          ),
          'repetitions', jsonb_build_object(
            'minimum', 6,
            'target', 8,
            'maximum', 12
          ),
          'loadTarget', 'submaximal_load_at_three_repetitions_in_reserve',
          'tempo', 'two_to_three_second_eccentric',
          'restSeconds', jsonb_build_object(
            'minimum', 90,
            'target', 120,
            'maximum', 180
          ),
          'stopAtRir', 3
        )
    END,
    CASE
      WHEN seed.definition_slug = 'reactive-hop-to-cut'
        THEN 'The cue is valid and not anticipated; the athlete lands inside the zone, chooses the correct side, uses one declared primary cut without extra recovery contacts, accelerates through the lane, brakes inside the finish, and fully resets.'
      ELSE 'Every repetition preserves the declared feet, seat and back support, ribs over pelvis, no deliberate leg drive, stacked wrist and elbow, symmetric owned path and range, controlled lowering, and secure equipment finish.'
    END,
    CASE
      WHEN seed.definition_slug = 'reactive-hop-to-cut' THEN
        ARRAY[
          'pain_or_neurologic_dizziness_or_instability_symptoms',
          'unsafe_surface_lane_traffic_or_footwear',
          'invalid_or_missed_cue',
          'early_guess_or_wrong_response',
          'landing_outside_zone_or_uncontrolled',
          'extra_recovery_contacts',
          'knee_pelvis_or_trunk_control_loss',
          'exit_speed_or_finish_control_decline'
        ]::TEXT[]
      ELSE
        ARRAY[
          'pain_numbness_dizziness_or_pressure_symptoms',
          'bench_rack_implement_collar_or_clearance_fault',
          'feet_seat_or_back_support_loss',
          'rib_flare_backward_lean_or_leg_drive',
          'wrist_elbow_or_path_control_loss',
          'asymmetric_range_or_rep_speed',
          'grinding_failed_or_spotter_assisted_rep',
          'unsafe_rerack_handoff_or_setdown'
        ]::TEXT[]
    END,
    CASE
      WHEN seed.definition_slug = 'reactive-hop-to-cut'
        THEN 'Close the lane, verify surface and footwear, walk the geometry, declare angle and finish, and explain valid cues and aborts. Control each start and cue; observe contact order and finish. Count only correct, owned repetitions and stop before quality or speed declines.'
      ELSE 'Inspect and fit the bench, rack, implement, load, collars, clearance, pickup, set-down, and spotter plan. Declare grip, range, tempo, dose, and effort. Observe from a clear angle and end the set before compensation, grinding, failure, or unsafe equipment control.'
    END,
    CASE
      WHEN seed.definition_slug = 'reactive-hop-to-cut'
        THEN 'Start neutral, hop, and wait. Land to the valid cue, make one clean cut, run through your lane, brake in the finish, and reset only when the coach closes the lane.'
      ELSE 'Set your feet, seat, back support, grip, and ribs. Press without leg drive or leaning back, finish in your owned overhead position, lower to the same start, breathe, and secure the implement before relaxing.'
    END,
    CASE
      WHEN profile.profile_key = 'movement-intelligence-quality'
        THEN 'More reliable cue response, landing organization, directional plant selection, and controlled exit.'
      WHEN profile.profile_key = 'output-quality'
        THEN 'Faster high-quality reactive redirection without contact, accuracy, or finish deterioration.'
      WHEN profile.profile_key = 'capacity-strength'
        THEN 'Greater strict bilateral seated overhead strength with repeatable equipment control.'
      ELSE 'More submaximal seated overhead-press volume with stable posture, path, range, and tempo.'
    END,
    CASE
      WHEN seed.definition_slug = 'reactive-hop-to-cut'
        THEN ARRAY['cones']::TEXT[]
      WHEN seed.variant_key LIKE 'barbell-%'
        THEN ARRAY['bench','barbell','rack','plates']::TEXT[]
      ELSE ARRAY['bench','dumbbells']::TEXT[]
    END,
    CASE
      WHEN seed.definition_slug = 'reactive-hop-to-cut' THEN
        jsonb_build_object(
          'stationFootprintMeters', jsonb_build_object(
            'length', 10,
            'width', CASE
              WHEN seed.variant_key LIKE '%90-cut' THEN 10
              ELSE 7
            END
          ),
          'athletesPerLane', 1,
          'setupSeconds', 90,
          'transitionSeconds', 30,
          'trafficControlRequired', TRUE,
          'cueOperatorRequired', TRUE,
          'surfaceAndFootwearInspectionRequired', TRUE,
          'finishZoneRequired', TRUE
        )
      ELSE
        jsonb_build_object(
          'stationFootprintMeters', jsonb_build_object(
            'length', 2.5,
            'width', 2.5
          ),
          'athletesPerBench', 1,
          'setupSeconds', 90,
          'transitionSeconds', 45,
          'spotterRequiredByRiskAndPolicy', TRUE,
          'overheadClearanceRequired', TRUE,
          'equipmentInspectionRequired', TRUE,
          'loadingAndSetdownZoneControlled', TRUE
        )
    END,
    CASE
      WHEN seed.definition_slug = 'reactive-hop-to-cut' THEN
        jsonb_build_object(
          'setupSeconds', 90,
          'secondsPerRepetitionIncludingExitAndBrake', 8,
          'resetSeconds', CASE
            WHEN profile.profile_key = 'output-quality' THEN 60
            ELSE 45
          END,
          'restSeconds', CASE
            WHEN profile.profile_key = 'output-quality'
              THEN jsonb_build_object(
                'minimum', 150,
                'target', 180,
                'maximum', 240
              )
            ELSE jsonb_build_object(
              'minimum', 120,
              'target', 150,
              'maximum', 180
            )
          END,
          'durationFormula', 'setup + repetitions * (work + reset) + interset_rest'
        )
      ELSE
        jsonb_build_object(
          'setupSeconds', 90,
          'secondsPerRepetition', CASE
            WHEN profile.profile_key = 'capacity-strength' THEN 4
            ELSE 5
          END,
          'setTransitionSeconds', 30,
          'restSeconds', CASE
            WHEN profile.profile_key = 'capacity-strength'
              THEN jsonb_build_object(
                'minimum', 120,
                'target', 180,
                'maximum', 300
              )
            ELSE jsonb_build_object(
              'minimum', 90,
              'target', 120,
              'maximum', 180
            )
          END,
          'durationFormula', 'setup + sets * (repetitions * seconds_per_repetition + set_transition) + interset_rest'
        )
    END,
    CASE
      WHEN seed.definition_slug = 'reactive-hop-to-cut' THEN
        jsonb_build_object(
          'progressionOrder', jsonb_build_array(
            'correct_and_repeatable_response',
            'cleaner_landing_and_single_cut',
            'slightly_faster_owned_exit',
            'additional_response_options',
            'sharper_angle'
          ),
          'regressionOrder', jsonb_build_array(
            'longer_cue_window',
            'preplanned_response',
            'smaller_angle',
            'slower_exit',
            'hop_to_stick'
          ),
          'neverAutoScale', jsonb_build_array(
            'pain',
            'unsafe_surface_or_traffic',
            'invalid_cue',
            'wrong_response',
            'landing_or_finish_control'
          ),
          'sideBalanceRequired', TRUE
        )
      ELSE
        jsonb_build_object(
          'progressionOrder', jsonb_build_array(
            'repeatable_setup_and_path',
            'additional_repetitions_within_cap',
            'small_load_increase',
            'reduced_back_support_if_objective_requires'
          ),
          'regressionOrder', jsonb_build_array(
            'reduce_load',
            'increase_rest',
            'fewer_repetitions',
            'greater_back_support',
            'neutral_grip_dumbbells',
            'shorter_owned_range'
          ),
          'neverAutoScale', jsonb_build_array(
            'pain',
            'equipment_integrity',
            'spotter_or_clearance',
            'failed_repetition',
            'unsafe_pickup_or_setdown'
          )
        )
    END,
    CASE
      WHEN seed.definition_slug = 'reactive-hop-to-cut' THEN
        jsonb_build_object(
          'record', jsonb_build_array(
            'variant_key',
            'lane_geometry',
            'cue_modality',
            'cue_timing',
            'response_side',
            'response_accuracy',
            'landing_quality',
            'cut_contacts',
            'exit_quality',
            'finish_control',
            'symptoms',
            'stop_reason'
          ),
          'successfulRepStandard', 'Valid cue, correct response, owned landing, one declared cut, acceleration through lane, controlled finish, and full reset.',
          'speedLossThreshold', 'Stop when observable or measured exit quality declines beyond the declared session threshold.'
        )
      ELSE
        jsonb_build_object(
          'record', jsonb_build_array(
            'variant_key',
            'bench_angle',
            'back_support',
            'implement',
            'grip',
            'load',
            'range',
            'tempo',
            'repetitions',
            'rir_or_rpe',
            'path_symmetry',
            'compensation',
            'symptoms',
            'stop_reason'
          ),
          'successfulRepStandard', 'Strict press and controlled return through the declared owned range with stable seated base, symmetric path, and secure equipment control.',
          'loadProgressionThreshold', 'Increase load only after all planned repetitions pass the quality gate with declared reserve.'
        )
    END,
    CASE
      WHEN seed.definition_slug = 'reactive-hop-to-cut' THEN
        jsonb_build_object(
          'athletePrompt', 'Report pain, instability, missed cues, slips, lane conflicts, or a side that feels materially different.',
          'coachPrompt', 'Record valid and invalid repetitions separately; do not reward guessing or added recovery contacts.',
          'accessibilityPrompt', 'Offer cue modality or contrast changes, a preplanned response, smaller angle, slower exit, fewer repetitions, or longer recovery.'
        )
      ELSE
        jsonb_build_object(
          'athletePrompt', 'Report pain, tingling, dizziness, pressure, loss of range, or uncertainty about the spotter, rack, pickup, or set-down.',
          'coachPrompt', 'Record the exact variant and equipment setup; do not add load when posture, path, range, reserve, or equipment control fails.',
          'accessibilityPrompt', 'Offer lighter load, neutral grip, more back support, shorter owned range, fewer repetitions, longer rest, or nonvideo instruction.'
        )
    END
  FROM completion_variant_seed seed
  CROSS JOIN LATERAL (
    SELECT *
    FROM (
      VALUES
        ('movement-intelligence-quality','movement_intelligence','primary'),
        ('output-quality','output','conditional')
    ) AS reactive(profile_key, phase_key, role)
    WHERE seed.definition_slug = 'reactive-hop-to-cut'
    UNION ALL
    SELECT *
    FROM (
      VALUES
        ('capacity-strength','capacity','primary'),
        ('resilience-controlled-volume','resilience','secondary')
    ) AS press(profile_key, phase_key, role)
    WHERE seed.definition_slug = 'seated-barbell-overhead-press'
  ) profile;

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
    profile.purpose,
    profile.suitability,
    profile.alignment,
    profile.objective_relevance,
    profile.dosage,
    profile.quality_gate,
    profile.stop_rules,
    profile.coach_instructions,
    profile.athlete_instructions,
    profile.expected_adaptation,
    profile.equipment_required,
    profile.logistics,
    '{}'::UUID[],
    'review',
    profile.time_model,
    profile.dose_scaling,
    profile.measurement,
    profile.support_prompts
  FROM completion_profile_seed profile
  JOIN coaching.exercise_definition_v1 definition
    ON definition.slug = profile.definition_slug
   AND definition.status <> 'archived'
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id = definition.id
   AND variant.variant_key = profile.variant_key
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
    definition.id,
    2,
    section.section_key,
    source.source_url,
    source.source_title,
    source.source_publisher,
    source.source_kind,
    CASE
      WHEN definition.slug = 'reactive-hop-to-cut' THEN
        jsonb_build_array(
          'Evidence was reassessed for the exact hop, cue, landing, cut, exit, finish, and reset contract in section ' || section.section_key || '.',
          'The candidate card uses exercise complexity and physical difficulty only; exact dose, media, graph, calibration, and publication still require human review.'
        )
      ELSE
        jsonb_build_array(
          'Evidence was reassessed for exact seated base, implement, support, grip, path, range, tempo, spotting, and equipment operations in section ' || section.section_key || '.',
          'The candidate card uses exercise complexity and physical difficulty only; exact media, graph, calibration, and publication still require human review.'
        )
    END,
    source.evidence_quality,
    'candidate',
    NULL,
    NULL
  FROM coaching.exercise_definition_v1 definition
  CROSS JOIN (
    VALUES
      ('identity'),
      ('taxonomy'),
      ('anatomy'),
      ('biomechanics'),
      ('difficulty'),
      ('load_fatigue_recovery'),
      ('constraints'),
      ('dosage'),
      ('instructions'),
      ('safety_stop_rules'),
      ('programming'),
      ('athlete_support'),
      ('coach_support'),
      ('accessibility'),
      ('alternates'),
      ('media')
  ) AS section(section_key)
  CROSS JOIN LATERAL (
    SELECT
      CASE
        WHEN section.section_key = 'media'
          THEN 'https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en'
        WHEN definition.slug = 'reactive-hop-to-cut'
          AND section.section_key IN (
            'identity', 'anatomy', 'biomechanics',
            'load_fatigue_recovery', 'programming'
          )
          THEN 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8363537/'
        WHEN definition.slug = 'reactive-hop-to-cut'
          AND section.section_key IN ('constraints', 'coach_support')
          THEN 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8016420/'
        WHEN definition.slug = 'reactive-hop-to-cut'
          AND section.section_key IN ('taxonomy', 'instructions')
          THEN 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5465987/'
        WHEN definition.slug = 'reactive-hop-to-cut'
          THEN 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9347107/'
        WHEN definition.slug = 'seated-barbell-overhead-press'
          AND section.section_key IN (
            'identity', 'taxonomy', 'biomechanics', 'difficulty',
            'programming', 'coach_support', 'alternates'
          )
          THEN 'https://pubmed.ncbi.nlm.nih.gov/23096062/'
        WHEN definition.slug = 'seated-barbell-overhead-press'
          AND section.section_key IN ('anatomy', 'load_fatigue_recovery')
          THEN 'https://pubmed.ncbi.nlm.nih.gov/35936912/'
        WHEN definition.slug = 'seated-barbell-overhead-press'
          AND section.section_key IN ('safety_stop_rules', 'accessibility')
          THEN 'https://www.nsca.com/globalassets/about/position-statements/position_stand_youth_resistance_training---2009.pdf'
        ELSE 'https://www.nsca.com/contentassets/116c55d64e1343d2b264e05aaf158a91/basics_of_strength_and_conditioning_manual.pdf'
      END AS source_url,
      CASE
        WHEN section.section_key = 'media'
          THEN 'Embed videos and playlists'
        WHEN definition.slug = 'reactive-hop-to-cut'
          AND section.section_key IN (
            'identity', 'anatomy', 'biomechanics',
            'load_fatigue_recovery', 'programming'
          )
          THEN 'Biomechanical Determinants of Performance and Injury Risk During Cutting: A Performance-Injury Conflict?'
        WHEN definition.slug = 'reactive-hop-to-cut'
          AND section.section_key IN ('constraints', 'coach_support')
          THEN 'Reliability of the Cutting Alignment Scoring Tool (CAST) to Assess Trunk and Limb Alignment During a 45-Degree Side-Step Cut'
        WHEN definition.slug = 'reactive-hop-to-cut'
          AND section.section_key IN ('taxonomy', 'instructions')
          THEN 'Are Change of Direction Speed and Reactive Agility Useful for Determining the Optimal Field Position for Young Soccer Players?'
        WHEN definition.slug = 'reactive-hop-to-cut'
          THEN 'Alternatives to Common Approaches for Training Change of Direction Performance: A Scoping Review'
        WHEN definition.slug = 'seated-barbell-overhead-press'
          AND section.section_key IN (
            'identity', 'taxonomy', 'biomechanics', 'difficulty',
            'programming', 'coach_support', 'alternates'
          )
          THEN 'Effects of Body Position and Loading Modality on Muscle Activity and Strength in Shoulder Presses'
        WHEN definition.slug = 'seated-barbell-overhead-press'
          AND section.section_key IN ('anatomy', 'load_fatigue_recovery')
          THEN 'Front vs Back and Barbell vs Machine Overhead Press: An Electromyographic Analysis and Implications for Resistance Training'
        WHEN definition.slug = 'seated-barbell-overhead-press'
          AND section.section_key IN ('safety_stop_rules', 'accessibility')
          THEN 'Youth Resistance Training: Updated Position Statement Paper From the NSCA'
        ELSE 'Basics of Strength and Conditioning Manual'
      END AS source_title,
      CASE
        WHEN section.section_key = 'media' THEN 'YouTube Help'
        WHEN definition.slug = 'reactive-hop-to-cut'
          AND section.section_key IN ('constraints', 'coach_support')
          THEN 'International Journal of Sports Physical Therapy'
        WHEN definition.slug = 'reactive-hop-to-cut'
          AND section.section_key IN ('taxonomy', 'instructions')
          THEN 'Journal of Sports Science and Medicine'
        WHEN definition.slug = 'reactive-hop-to-cut'
          THEN 'Sports Medicine - Open'
        WHEN definition.slug = 'seated-barbell-overhead-press'
          AND section.section_key IN (
            'identity', 'taxonomy', 'biomechanics', 'difficulty',
            'programming', 'coach_support', 'alternates'
          )
          THEN 'Journal of Strength and Conditioning Research'
        WHEN definition.slug = 'seated-barbell-overhead-press'
          AND section.section_key IN ('anatomy', 'load_fatigue_recovery')
          THEN 'Frontiers in Physiology'
        ELSE 'National Strength and Conditioning Association'
      END AS source_publisher,
      CASE
        WHEN section.section_key = 'media'
          THEN 'manufacturer_instruction'
        WHEN definition.slug = 'seated-barbell-overhead-press'
          AND section.section_key IN (
            'constraints', 'dosage', 'instructions',
            'safety_stop_rules', 'athlete_support', 'accessibility'
          )
          THEN 'professional_standard'
        ELSE 'peer_reviewed_research'
      END AS source_kind,
      CASE
        WHEN section.section_key = 'media' THEN 82
        WHEN definition.slug = 'reactive-hop-to-cut'
          AND section.section_key IN (
            'identity', 'anatomy', 'biomechanics',
            'load_fatigue_recovery', 'programming'
          )
          THEN 92
        WHEN definition.slug = 'reactive-hop-to-cut'
          AND section.section_key IN ('constraints', 'coach_support')
          THEN 84
        WHEN definition.slug = 'reactive-hop-to-cut'
          AND section.section_key IN ('taxonomy', 'instructions')
          THEN 78
        WHEN definition.slug = 'reactive-hop-to-cut' THEN 87
        WHEN definition.slug = 'seated-barbell-overhead-press'
          AND section.section_key IN (
            'identity', 'taxonomy', 'biomechanics', 'difficulty',
            'programming', 'coach_support', 'alternates'
          )
          THEN 87
        WHEN definition.slug = 'seated-barbell-overhead-press'
          AND section.section_key IN ('anatomy', 'load_fatigue_recovery')
          THEN 86
        WHEN definition.slug = 'seated-barbell-overhead-press'
          AND section.section_key IN ('safety_stop_rules', 'accessibility')
          THEN 88
        ELSE 84
      END AS evidence_quality
  ) source
  WHERE definition.slug IN (
    'reactive-hop-to-cut',
    'seated-barbell-overhead-press'
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

  UPDATE coaching.exercise_media_candidate_v1 media
  SET review_status = 'superseded',
      reviewer_user_id = NULL,
      reviewed_at = NULL,
      notes = concat_ws(
        ' ',
        NULLIF(media.notes, ''),
        'Superseded by migration 360 card-version-2 candidate selection; no approval is implied.'
      ),
      updated_at = now()
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.id = media.definition_id
    AND definition.slug IN (
      'reactive-hop-to-cut',
      'seated-barbell-overhead-press'
    )
    AND media.review_status = 'candidate';

  INSERT INTO coaching.exercise_media_candidate_v1 (
    definition_id,
    variant_id,
    reviewed_card_version,
    url,
    embed_url,
    video_id,
    title,
    channel_name,
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
    2,
    media.url,
    'https://www.youtube-nocookie.com/embed/' || media.video_id,
    media.video_id,
    media.title,
    media.channel_name,
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
    media.notes
  FROM (
    VALUES
      (
        'reactive-hop-to-cut',
        'https://www.youtube.com/watch?v=atcDcplGsdI',
        'atcDcplGsdI',
        'Linear Acceleration to 45 Degree Cut (Coach Led)',
        'Performance Course',
        'inherited reactive hop-to-cut source candidate',
        'YouTube oEmbed metadata verified 2026-07-26T22:20:00Z. Comparison candidate for coach-led 45-degree redirection; title metadata does not establish the preceding hop or cue during flight or landing. Exact match, full viewing, cues, safety, captions, accessibility, reviewer identity, and approval remain unresolved.'
      ),
      (
        'reactive-hop-to-cut',
        'https://www.youtube.com/watch?v=GJsAcnLHqdE',
        'GJsAcnLHqdE',
        '45, 90 and 180 degree cuts - Drill (Deceleration)',
        'B7Tal',
        'inherited reactive hop-to-cut source candidate',
        'YouTube oEmbed metadata verified 2026-07-26T22:20:00Z. Angle and deceleration comparison candidate; title metadata does not establish the hop, reactive cue window, or terminal contract. All human review gates remain unresolved.'
      ),
      (
        'reactive-hop-to-cut',
        'https://www.youtube.com/watch?v=QEk95UCvmwg',
        'QEk95UCvmwg',
        'Partner Mirror Shuffle | Reactive Agility & Footwork Drill for Athletes',
        'uoasportsagility',
        'inherited reactive hop-to-cut source candidate',
        'YouTube oEmbed metadata verified 2026-07-26T22:20:00Z. Reactive-cue comparison candidate only; the title identifies a different leader-follower shuffle action. It cannot satisfy exact-match media approval for this card.'
      ),
      (
        'seated-barbell-overhead-press',
        'https://www.youtube.com/watch?v=ECWxumBMLVQ',
        'ECWxumBMLVQ',
        'How To: Seated Barbell Shoulder Press',
        'ScottHermanFitness',
        'inherited seated barbell overhead press candidate',
        'YouTube oEmbed metadata verified 2026-07-26T22:20:00Z. Title-level seated barbell match. Full viewing and exact bench, grip, rack, path, range, tempo, spotting, captions, safety, accessibility, and approval remain unresolved.'
      ),
      (
        'seated-barbell-overhead-press',
        'https://www.youtube.com/watch?v=PhCNJy_Td7U',
        'PhCNJy_Td7U',
        'How To: SEATED PRESS - The Press Accessory You NEED To Try!',
        'Barbell Logic',
        'inherited seated barbell overhead press candidate',
        'YouTube oEmbed metadata verified 2026-07-26T22:20:00Z. Seated press teaching candidate; title metadata does not state every exact variant dimension. Full human review remains required.'
      ),
      (
        'seated-barbell-overhead-press',
        'https://www.youtube.com/watch?v=b5JzUH8gsOg',
        'b5JzUH8gsOg',
        'How to Do Seated Overhead Dumbbell Press | Arm Workout',
        'Howcast',
        'inherited seated dumbbell overhead press candidate',
        'YouTube oEmbed metadata verified 2026-07-26T22:20:00Z. Title-level seated dumbbell match. Exact grip, support, path, range, setup, safety, captions, accessibility, and instructional quality require human review.'
      ),
      (
        'seated-barbell-overhead-press',
        'https://www.youtube.com/watch?v=C0We_bEyxlM',
        'C0We_bEyxlM',
        'How To Do: Seated Dumbbell Overhead Press',
        'MuscleWiki',
        'inherited seated dumbbell overhead press candidate',
        'YouTube oEmbed metadata verified 2026-07-26T22:20:00Z. Title-level seated dumbbell match. Full exact-variant and human demonstration review remain unresolved.'
      ),
      (
        'seated-barbell-overhead-press',
        'https://www.youtube.com/watch?v=xg-7dS8ZGKE',
        'xg-7dS8ZGKE',
        'Seated Dumbbell Overhead Press',
        'Women''s Strength Nation by Holly Perkins',
        'inherited seated dumbbell overhead press candidate',
        'YouTube oEmbed metadata verified 2026-07-26T22:20:00Z. Title-level seated dumbbell match. Full review of setup, exact mechanics, safety, captions, accessibility, and approval remains unresolved.'
      )
  ) AS media(
    definition_slug,
    url,
    video_id,
    title,
    channel_name,
    source_query,
    notes
  )
  JOIN coaching.exercise_definition_v1 definition
    ON definition.slug = media.definition_slug
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
    2,
    alternate.alternate_name,
    alternate.classification,
    alternate.rationale,
    alternate.dimensions,
    CASE
      WHEN alternate.classification = 'new_definition'
        THEN jsonb_build_object(
          'status', 'proposal_only',
          'humanReviewRequired', TRUE,
          'sourceCard', alternate.definition_slug
        )
      ELSE NULL
    END,
    'candidate',
    NULL,
    NULL
  FROM (
    VALUES
      ('reactive-hop-to-cut','Reactive 45-Degree Hop-to-Cut','same_identity','The qualifier names the baseline cut-angle variant while preserving hop, cue, landing, cut, exit, and reset.','{"cutAngleDegrees":45,"identityChange":"none"}'::JSONB),
      ('reactive-hop-to-cut','Reactive 90-Degree Hop-to-Cut','new_variant','A sharper cut angle changes braking and redirection demand while retaining the exact ordered-contact identity.','{"cutAngleDegrees":90,"mechanicalDemand":"greater_redirection"}'::JSONB),
      ('reactive-hop-to-cut','Verbal-Cue Reactive Hop-to-Cut','modifier_annotation','Cue modality changes delivery but not the movement sequence when timing and valid responses remain declared.','{"cueModality":"verbal"}'::JSONB),
      ('reactive-hop-to-cut','Visual-Cue Reactive Hop-to-Cut','modifier_annotation','A visual direction cue is a delivery dimension of the same reactive task.','{"cueModality":"visual"}'::JSONB),
      ('reactive-hop-to-cut','Reactive 45-Degree Cut','new_definition','Removing the discrete hop and landing-to-cut transition changes ordered contacts, impact, cue, fatigue, and coaching.','{"initialAction":"marked_approach_without_hop","orderedContacts":"approach_to_cut"}'::JSONB),
      ('reactive-hop-to-cut','Hop-to-Stick','new_definition','A terminal held landing omits the directional cut and exit acceleration.','{"terminalAction":"landing_stick","cut":"absent"}'::JSONB),
      ('reactive-hop-to-cut','Single-Leg Hop-to-Cut','new_variant','Single-leg takeoff and landing materially alter laterality, impact distribution, readiness, and difficulty but preserve the cue-to-cut sequence.','{"hopTakeoff":"single_leg","hopLanding":"single_leg"}'::JSONB),
      ('reactive-hop-to-cut','Reactive Hop-to-Cut with Contact Evasion','new_definition','Adding an opponent or possible collision changes the primary task, stimulus, space, and safety contract.','{"opponentContact":"possible","primaryStimulus":"evasion"}'::JSONB),
      ('seated-barbell-overhead-press','Seated Barbell Overhead Press','new_variant','A barbell links both hands while preserving the seated strict vertical press.','{"implement":"barbell","independentArmDemand":false}'::JSONB),
      ('seated-barbell-overhead-press','Seated Dumbbell Overhead Press','new_variant','Two dumbbells permit independent paths and alter stability, pickup, set-down, and loading.','{"implement":"two_dumbbells","independentArmDemand":true}'::JSONB),
      ('seated-barbell-overhead-press','Back-Supported Seated Overhead Press','new_variant','Declared upright back support changes trunk stabilization and bench setup while preserving the seated bilateral press.','{"backSupport":"upright_bench","benchAngle":"declared"}'::JSONB),
      ('seated-barbell-overhead-press','Unsupported Seated Overhead Press','new_variant','Removing back support increases trunk-position demand while preserving the seated no-leg-drive press.','{"backSupport":"none"}'::JSONB),
      ('seated-barbell-overhead-press','Neutral-Grip Seated Dumbbell Press','new_variant','Grip changes wrist, elbow, and shoulder orientation while retaining the two-dumbbell seated press.','{"implement":"two_dumbbells","grip":"neutral"}'::JSONB),
      ('seated-barbell-overhead-press','Standing Overhead Press','new_definition','Standing removes the seated base and changes lower-body, balance, trunk, setup, and fatigue demands.','{"base":"standing"}'::JSONB),
      ('seated-barbell-overhead-press','Z-Press','new_definition','A floor long-sit base changes hip and hamstring constraints, trunk demand, setup, and exit.','{"base":"floor_long_sit","bench":"absent"}'::JSONB),
      ('seated-barbell-overhead-press','Seated Single-Arm Overhead Press','new_definition','Unilateral loading changes laterality and anti-lateral-flexion and anti-rotation demand.','{"laterality":"unilateral"}'::JSONB),
      ('seated-barbell-overhead-press','Seated Push Press','new_definition','Deliberate lower-body or trunk drive changes strict strength into linked power.','{"legDrive":"deliberate","primaryStimulus":"linked_power"}'::JSONB),
      ('seated-barbell-overhead-press','Behind-the-Neck Seated Press','new_definition','A behind-neck path changes start position, shoulder range, bar path, spotting, and safety.','{"barPath":"behind_neck"}'::JSONB),
      ('seated-barbell-overhead-press','Machine Seated Shoulder Press','new_definition','A machine imposes a fixed path, seat geometry, handles, setup, and failure protocol.','{"resistanceConstraint":"machine_fixed_path"}'::JSONB),
      ('seated-barbell-overhead-press','Seated Landmine Press','new_definition','The landmine uses a fixed diagonal arc rather than a free vertical path.','{"pressPath":"fixed_diagonal_arc"}'::JSONB)
  ) AS alternate(
    definition_slug,
    alternate_name,
    classification,
    rationale,
    dimensions
  )
  JOIN coaching.exercise_definition_v1 definition
    ON definition.slug = alternate.definition_slug
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
      ('reactive-hop-to-cut','bilateral-hop-reactive-45-cut','bilateral-hop-reactive-90-cut','progression',84,ARRAY['complexity','decision_demand','impact']::TEXT[],'A 90-degree response increases braking, orientation, and reacceleration demand after the 45-degree variant is repeatable.','{"requires":["repeatable_45_degree_response","owned_preplanned_90_degree_cut","no_side_asymmetry"]}'::JSONB),
      ('reactive-hop-to-cut','bilateral-hop-reactive-90-cut','bilateral-hop-reactive-45-cut','regression',94,ARRAY['complexity','decision_demand','impact']::TEXT[],'Reducing the cut angle preserves the ordered-contact action while lowering redirection demand.','{"useWhen":["extra_contacts","landing_or_trunk_control_changes","side_asymmetry","fatigue"]}'::JSONB),
      ('seated-barbell-overhead-press','barbell-unsupported-pronated','barbell-back-supported-pronated','regression',86,ARRAY['stability','complexity']::TEXT[],'Back support reduces trunk-position demand while preserving the barbell press, grip, and vertical path.','{"useWhen":["trunk_compensation","unsupported_position_not_owned"]}'::JSONB),
      ('seated-barbell-overhead-press','barbell-back-supported-pronated','barbell-unsupported-pronated','progression',78,ARRAY['stability','complexity']::TEXT[],'Removing back support increases trunk-position demand and requires repeatable supported control.','{"requires":["owned_supported_path","stable_unsupported_seated_base"]}'::JSONB),
      ('seated-barbell-overhead-press','dumbbell-back-supported-neutral','dumbbell-back-supported-pronated','progression',76,ARRAY['range','complexity']::TEXT[],'A pronated grip changes wrist, elbow, and shoulder orientation after neutral-grip control is established.','{"requires":["pain_free_owned_pronated_range","symmetric_neutral_grip_path"]}'::JSONB),
      ('seated-barbell-overhead-press','dumbbell-back-supported-pronated','dumbbell-back-supported-neutral','regression',84,ARRAY['range','complexity']::TEXT[],'A neutral grip is an in-family option when the pronated path is not owned, subject to individual review.','{"useWhen":["pronated_path_not_owned","wrist_or_elbow_stack_changes"],"notFor":["pain_without_assessment"]}'::JSONB),
      ('seated-barbell-overhead-press','barbell-back-supported-pronated','dumbbell-back-supported-pronated','lateral_substitution',72,ARRAY['equipment','stability','load']::TEXT[],'Two dumbbells can preserve a back-supported bilateral press purpose when barbell equipment or path is unsuitable, but loading and independent-arm demand differ.','{"useWhen":["barbell_unavailable","individual_paths_preferred"],"notEquivalentFor":["barbell_specific_strength","maximum_load"]}'::JSONB),
      ('seated-barbell-overhead-press','dumbbell-back-supported-pronated','barbell-back-supported-pronated','lateral_substitution',72,ARRAY['equipment','stability','load']::TEXT[],'A barbell can preserve a back-supported bilateral press purpose when dumbbells are unavailable, but linked-hand stability and load potential differ.','{"useWhen":["matched_dumbbells_unavailable","barbell_path_owned"],"notEquivalentFor":["independent_arm_control"]}'::JSONB)
  ) AS edge(
    definition_slug,
    from_key,
    to_key,
    relationship,
    similarity_score,
    dimensions,
    reason,
    conditions
  )
  JOIN coaching.exercise_definition_v1 definition
    ON definition.slug = edge.definition_slug
   AND definition.status <> 'archived'
  JOIN coaching.exercise_variant_v1 from_variant
    ON from_variant.definition_id = definition.id
   AND from_variant.variant_key = edge.from_key
  JOIN coaching.exercise_variant_v1 to_variant
    ON to_variant.definition_id = definition.id
   AND to_variant.variant_key = edge.to_key
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
  JOIN coaching.exercise_definition_v1 definition
    ON definition.id = variant.definition_id
  CROSS JOIN LATERAL (
    VALUES
      (
        'technicalComplexity',
        (variant.difficulty_json ->> 'technicalComplexity')::SMALLINT,
        CASE definition.slug
          WHEN 'reactive-hop-to-cut'
            THEN 'Proposed from cue uncertainty, ordered hop-landing-cut contacts, angle, response choice, plant selection, exit, and finish control.'
          ELSE 'Proposed from seated-base setup, implement constraint, support, grip, path, range, symmetry, spotting, and equipment operations.'
        END
      ),
      (
        'absoluteLoadDemand',
        (variant.difficulty_json ->> 'absoluteLoadDemand')::SMALLINT,
        CASE definition.slug
          WHEN 'reactive-hop-to-cut'
            THEN 'Proposed physical difficulty from body mass, hop landing, redirection angle, braking impulse, acceleration, surface, and total contacts.'
          ELSE 'Proposed physical difficulty from external load, implement, press range, repetitions, tempo, effort, trunk demand, and equipment handling.'
        END
      ),
      (
        'technicalFatigueSensitivity',
        (variant.fatigue_profile_json ->>
          'technicalFatigueSensitivity')::SMALLINT,
        CASE definition.slug
          WHEN 'reactive-hop-to-cut'
            THEN 'Proposed from wrong responses, unstable landings, extra contacts, alignment change, speed loss, and finish overruns under fatigue.'
          ELSE 'Proposed from posture, path, symmetry, range, rep-speed, grip, spotting, and equipment-control deterioration under fatigue.'
        END
      )
  ) AS calibration(dimension, score, rationale)
  WHERE definition.slug IN (
    'reactive-hop-to-cut',
    'seated-barbell-overhead-press'
  )
    AND definition.status <> 'archived'
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

  UPDATE coaching.exercise_card_test_packet_v1 packet
  SET card_version = 2,
      status = 'quarantined',
      blocking_issues_json = CASE definition.slug
        WHEN 'reactive-hop-to-cut' THEN jsonb_build_array(
          jsonb_build_object(
            'code', 'media_exact_match_candidate_missing',
            'message',
              'Three oEmbed-healthy comparison candidates are retained, but none is title-level exact for the complete hop-to-cut sequence; exact media discovery and human review remain required.'
          ),
          jsonb_build_object(
            'code', 'graph_human_review_required',
            'message',
              'Progression and regression proposals require coach approval.'
          ),
          jsonb_build_object(
            'code', 'calibration_human_review_required',
            'message',
              'Complexity, physical-difficulty, and technical-fatigue proposals require independent calibration.'
          ),
          jsonb_build_object(
            'code', 'publication_approval_required',
            'message',
              'The completed candidate card remains in review and requires current two-person publication approval.'
          )
        )
        ELSE jsonb_build_array(
          jsonb_build_object(
            'code', 'media_human_review_required',
            'message',
              'Five oEmbed-healthy title-level candidates require full-video exact-variant, cue, safety, caption, accessibility, reviewer, and approval review.'
          ),
          jsonb_build_object(
            'code', 'graph_human_review_required',
            'message',
              'Progression, regression, and substitution proposals require coach approval.'
          ),
          jsonb_build_object(
            'code', 'calibration_human_review_required',
            'message',
              'Complexity, physical-difficulty, and technical-fatigue proposals require independent calibration.'
          ),
          jsonb_build_object(
            'code', 'publication_approval_required',
            'message',
              'The completed candidate card remains in review and requires current two-person publication approval.'
          )
        )
      END,
      human_review_required = TRUE,
      checked_at = now()
  FROM coaching.exercise_definition_v1 definition
  WHERE definition.id = packet.definition_id
    AND definition.slug IN (
      'reactive-hop-to-cut',
      'seated-barbell-overhead-press'
    );
END;
$$;
