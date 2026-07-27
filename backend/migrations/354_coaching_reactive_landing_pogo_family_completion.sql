-- Complete four consolidated exercise families:
--   * Snap-Down to Stick
--   * Mirror Shuffle
--   * Sprint-to-Stick Deceleration
--   * Single-Leg Pogo
--
-- The migration supplies exact variants, contextual delivery profiles,
-- anatomy, loading, fatigue/recovery, environment/population constraints,
-- athlete and coach support, support operations, evidence, media candidates,
-- alternate decisions, review-only graph edges, review-only calibration
-- proposals, and quarantined test packets.
--
-- Exercise cards never contain skill/proficiency levels. Overall exercise
-- difficulty is max(exercise complexity, physical difficulty). Current
-- YouTube oEmbed metadata is candidate evidence only: playback, full-video
-- exact matching, captions, cue quality, accessibility, reviewer identity,
-- and approval remain unresolved. IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '354_coaching_reactive_landing_pogo_family_completion';
  protected_records INTEGER;
  unexpected_variants INTEGER;
BEGIN
  IF (
    SELECT COUNT(*)
    FROM coaching.exercise_definition_v1
    WHERE facility_id = 1
      AND slug IN (
        'snap-down-to-stick',
        'mirror-shuffle',
        'sprint-to-stick-deceleration',
        'single-leg-pogo'
      )
      AND status <> 'archived'
  ) <> 4 THEN
    RAISE EXCEPTION
      '% requires all four active survivor definitions',
      migration_key;
  END IF;

  IF (
    SELECT COUNT(*)
    FROM coaching.exercise_identity_resolution_v1 resolution
    JOIN coaching.exercise_definition_v1 survivor
      ON survivor.id = resolution.survivor_definition_id
    JOIN coaching.exercise_definition_v1 duplicate
      ON duplicate.id = resolution.resolved_definition_id
    WHERE survivor.slug || ':' || duplicate.slug IN (
      'snap-down-to-stick:snap-down-to-athletic-stick',
      'snap-down-to-stick:snapdown-landing-stick',
      'snap-down-to-stick:snap-down-to-stick-control-version',
      'mirror-shuffle:mirror-shuffle-drill',
      'mirror-shuffle:partner-mirror-shuffle',
      'sprint-to-stick-deceleration:5-yard-acceleration-decel-stick',
      'sprint-to-stick-deceleration:5-yard-accel-to-decel-stick',
      'single-leg-pogo:single-leg-pogo-in-place',
      'single-leg-pogo:single-leg-pogo-jumps'
    )
      AND resolution.decision = 'duplicate_consolidated'
  ) <> 9 THEN
    RAISE EXCEPTION
      '% requires all nine identity consolidations',
      migration_key;
  END IF;

  SELECT
    (
      SELECT COUNT(*)
      FROM coaching.exercise_definition_v1
      WHERE facility_id = 1
        AND slug IN (
          'snap-down-to-stick',
          'mirror-shuffle',
          'sprint-to-stick-deceleration',
          'single-leg-pogo'
        )
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
      FROM coaching.exercise_section_evidence_v1 evidence
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id = evidence.definition_id
      WHERE definition.facility_id = 1
        AND definition.slug IN (
          'snap-down-to-stick',
          'mirror-shuffle',
          'sprint-to-stick-deceleration',
          'single-leg-pogo'
        )
        AND evidence.review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_media_candidate_v1 media
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id = media.definition_id
      WHERE definition.facility_id = 1
        AND definition.slug IN (
          'snap-down-to-stick',
          'mirror-shuffle',
          'sprint-to-stick-deceleration',
          'single-leg-pogo'
        )
        AND media.review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_alternate_assessment_v1 alternate
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id = alternate.definition_id
      WHERE definition.facility_id = 1
        AND definition.slug IN (
          'snap-down-to-stick',
          'mirror-shuffle',
          'sprint-to-stick-deceleration',
          'single-leg-pogo'
        )
        AND alternate.review_status NOT IN ('candidate', 'superseded')
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_card_review_v1 review
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id = review.definition_id
      WHERE definition.facility_id = 1
        AND definition.slug IN (
          'snap-down-to-stick',
          'mirror-shuffle',
          'sprint-to-stick-deceleration',
          'single-leg-pogo'
        )
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_card_revision_v1 revision
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id = revision.definition_id
      WHERE definition.facility_id = 1
        AND definition.slug IN (
          'snap-down-to-stick',
          'mirror-shuffle',
          'sprint-to-stick-deceleration',
          'single-leg-pogo'
        )
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_media_review_v1 review
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id = review.definition_id
      WHERE definition.facility_id = 1
        AND definition.slug IN (
          'snap-down-to-stick',
          'mirror-shuffle',
          'sprint-to-stick-deceleration',
          'single-leg-pogo'
        )
    )
    + (
      SELECT COUNT(*)
      FROM coaching.exercise_variant_v1 variant
      JOIN coaching.exercise_definition_v1 definition
        ON definition.id = variant.definition_id
      WHERE definition.facility_id = 1
        AND definition.slug IN (
          'snap-down-to-stick',
          'mirror-shuffle',
          'sprint-to-stick-deceleration',
          'single-leg-pogo'
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
          WHERE definition.facility_id = 1
            AND definition.slug IN (
              'snap-down-to-stick',
              'mirror-shuffle',
              'sprint-to-stick-deceleration',
              'single-leg-pogo'
            )
        )
        OR relationship.to_variant_id IN (
          SELECT variant.id
          FROM coaching.exercise_variant_v1 variant
          JOIN coaching.exercise_definition_v1 definition
            ON definition.id = variant.definition_id
          WHERE definition.facility_id = 1
            AND definition.slug IN (
              'snap-down-to-stick',
              'mirror-shuffle',
              'sprint-to-stick-deceleration',
              'single-leg-pogo'
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
        WHERE definition.facility_id = 1
          AND definition.slug IN (
            'snap-down-to-stick',
            'mirror-shuffle',
            'sprint-to-stick-deceleration',
            'single-leg-pogo'
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
  WHERE definition.facility_id = 1
    AND definition.slug IN (
      'snap-down-to-stick',
      'mirror-shuffle',
      'sprint-to-stick-deceleration',
      'single-leg-pogo'
    )
    AND variant.status <> 'archived'
    AND (
      (
        definition.slug = 'snap-down-to-stick'
        AND variant.variant_key NOT IN (
          'baseline',
          'baseline-source-541',
          'baseline-source-1105',
          'bilateral-tall-reach-stick'
        )
      )
      OR (
        definition.slug = 'mirror-shuffle'
        AND variant.variant_key NOT IN (
          'baseline',
          'partner-lateral-leader-follower'
        )
      )
      OR (
        definition.slug = 'sprint-to-stick-deceleration'
        AND variant.variant_key NOT IN (
          'baseline',
          'five-yard-planned-stick',
          'seven-to-ten-yard-planned-stick'
        )
      )
      OR (
        definition.slug = 'single-leg-pogo'
        AND variant.variant_key NOT IN (
          'baseline',
          'supported-stationary-low-amplitude',
          'stationary-low-amplitude',
          'linear-forward-traveling',
          'lateral-line'
        )
      )
    );

  IF unexpected_variants > 0 THEN
    RAISE EXCEPTION
      '% found % unexpected active variant(s)',
      migration_key,
      unexpected_variants;
  END IF;
END;
$$;

CREATE TEMP TABLE reactive_card_seed (
  slug TEXT PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  description TEXT NOT NULL,
  family_key TEXT NOT NULL,
  content_confidence SMALLINT NOT NULL,
  scoring_confidence SMALLINT NOT NULL,
  media_confidence SMALLINT NOT NULL,
  movement_patterns TEXT[] NOT NULL,
  body_regions TEXT[] NOT NULL,
  required_equipment TEXT[] NOT NULL,
  optional_equipment TEXT[] NOT NULL,
  environment_json JSONB NOT NULL,
  population_json JSONB NOT NULL,
  anatomy_json JSONB NOT NULL,
  athlete_support_json JSONB NOT NULL,
  coach_support_json JSONB NOT NULL,
  support_operations_json JSONB NOT NULL,
  evidence_claims JSONB NOT NULL,
  primary_source JSONB NOT NULL,
  secondary_source JSONB NOT NULL
);

INSERT INTO reactive_card_seed VALUES
  (
    'snap-down-to-stick',
    'Snap-Down to Stick',
    'Stand tall with feet at the declared width and arms in the declared start position. Rapidly drive the arms down while lowering the center of mass into a bilateral athletic stance; contact or settle through the whole foot, align each knee with the foot, organize the trunk over the pelvis, and hold the finish for the declared time without a rebound or extra step. Reset fully and stop before speed, contact sound, alignment, breathing, or control changes.',
    'bilateral_snap_down_landing_stick',
    90, 80, 34,
    ARRAY['squat','land']::TEXT[],
    ARRAY['foot','ankle','knee','hip','core']::TEXT[],
    '{}'::TEXT[],
    ARRAY['line_tape','mat']::TEXT[],
    '{
      "surface":{"required":"flat_dry_stable_nonslip","avoid":["wet","loose","uneven","crowded"]},
      "space":{"clearRadiusMeters":1.5,"overheadClearanceRequired":true,"runOutRequired":false},
      "setup":{"feetAndArmStartDeclared":true,"landingWidthDeclared":true,"stickTimeDeclared":true,"externalHeight":false},
      "traffic":{"oneAthletePerStation":true,"separateFromJumpAndSprintLanes":true},
      "record":["footwear","surface","stance_width","arm_start","target_depth","stick_seconds"]
    }'::JSONB,
    '{
      "prerequisites":["pain_free_bodyweight_squat_to_declared_depth","safe_rapid_descent","can_hold_bilateral_athletic_stance","understands_stop_signal"],
      "useCaution":["current_foot_ankle_knee_hip_or_back_symptoms","recent_lower_extremity_procedure","dizziness_or_balance_concern","fear_of_rapid_descent"],
      "doNotUseWhen":["pain_or_giving_way","unsafe_surface_or_clearance","cannot_control_drop_squat","cannot_hold_finish_without_step","coach_cannot_observe"],
      "regressionOrder":["slower_drop_squat_to_stick","shallower_depth","hands_at_chest","fewer_repetitions","longer_reset"],
      "medicalScope":"This card does not diagnose, rehabilitate, or clear an athlete; follow the care plan and local scope."
    }'::JSONB,
    '{
      "primaryMuscles":["quadriceps","gluteus_maximus","soleus","gastrocnemius"],
      "secondaryMuscles":["hamstrings","adductors","gluteus_medius","tibialis_anterior"],
      "stabilizers":["foot_intrinsics","abdominal_wall","spinal_erectors"],
      "joints":["ankle","knee","hip","lumbar_spine"],
      "jointActions":["rapid_ankle_dorsiflexion_control","rapid_knee_flexion_control","rapid_hip_flexion_control","bilateral_lower_limb_stabilization","trunk_flexion_and_rotation_control"],
      "planes":["sagittal","frontal_control","transverse_control"],
      "laterality":"bilateral",
      "kineticChain":"closed_chain_bilateral",
      "biomechanics":{"definingAction":"rapid_tall_to_athletic_descent_then_static_stick","noFlightRequired":true,"noRebound":true,"qualityTargets":["whole_foot_pressure","knee_foot_alignment","trunk_control","quiet_finish"]},
      "evidenceLimit":"Landing-instruction evidence informs the quality contract, but this exact no-flight snap-down variant and its exact dose have not been independently validated."
    }'::JSONB,
    '{
      "whyItMatters":"Practices organizing quickly into a stable bilateral landing shape before more demanding jumping and deceleration tasks.",
      "primaryCue":"Tall to strong; snap down, land quiet, and freeze.",
      "expectedSensations":["brief_quadriceps_and_glute_effort","whole_foot_pressure","trunk_brace","controlled_breathing"],
      "unexpectedSensations":["sharp_or_increasing_pain","giving_way","dizziness","headache","numbness_or_tingling","loss_of_confidence"],
      "selfChecks":["both_feet_finish_together","knees_track_with_feet","whole_foot_pressure","no_rebound_or_extra_step","stick_time_owned","last_rep_matches_first"],
      "painGuidance":"Stop, remain in a safe position, and tell the coach when an unexpected symptom appears.",
      "accessibility":["slower_drop","shallower_depth","hands_at_chest","visual_floor_marker","fewer_repetitions","longer_reset"],
      "mediaAlternatives":["step_by_step_text","front_and_side_stills","coach_demonstration","auditory_three_part_cue"],
      "beforeYouStart":["clear_floor_and_overhead_space","declare_stance_arm_start_depth_and_hold","rehearse_slowly"],
      "afterSetCheck":["record_quality_result","record_contact_sound_alignment_symptoms_and_stop_reason"]
    }'::JSONB,
    '{
      "observationChecklist":["surface_and_clearance","starting_posture","descent_speed","foot_contact","stance_width","knee_tracking","hip_depth","trunk_position","stick_time","breathing"],
      "faultCorrections":{"loud_or_uncontrolled_finish":["slow_the_descent","reduce_depth","use_drop_squat_to_stick"],"knee_collapse":["reduce_speed","change_stance_width","stop_if_uncorrected"],"torso_collapse":["reduce_depth","arms_at_chest","cue_ribs_over_pelvis"],"rebound_or_step":["reduce_speed","extend_hold","end_set_if_repeated"]},
      "demonstrationPlan":["show_tall_start","show_arm_and_hip_snap","show_whole_foot_finish","show_two_second_stick","contrast_rebound_step_and_knee_collapse"],
      "groupManagement":["one_athlete_per_marked_station","coach_views_front_and_side","alternate_only_after_full_reset","no_shared_landing_zone"],
      "modificationDecisionTree":{"cannot_control_speed":"drop_squat_to_stick","depth_changes_alignment":"shallower_depth","clean_repeated_stick":"increase_speed_before_depth_or_volume","symptom":"stop_and_escalate"},
      "recordingFields":["variant_key","stance_width","arm_start","target_depth","repetitions","stick_seconds","quality_pass","faults","symptoms","stop_reason","cue_response"]
    }'::JSONB,
    '{
      "issueCategories":["identity_or_variant","dose_or_depth","surface_or_space","media_exact_match","accessibility","pain_or_safety","relationship","calibration"],
      "supportEscalation":{"urgent":["fall_or_injury_event","neurologic_or_cardiovascular_symptom"],"coachReview":["repeat_alignment_failure","fear_or_giving_way","unclear_variant"],"contentReview":["conflicting_box_or_jump_instruction","media_mismatch","missing_accessibility"]},
      "retentionPolicy":"Retain card version, exact variant, dose, quality result, faults, symptoms, stop reason, media metadata, and reviewer decisions according to facility policy.",
      "changeImpactPolicy":"A change to flight, rebound, laterality, external height, direction, load, stop rules, difficulty, media, or graph requires a new version and renewed affected reviews.",
      "knownLimitations":["candidate_media_not_human_viewed","exact_snap_down_outcomes_not_established","scores_and_graph_are_review_proposals"],
      "supportSummary":"This is a no-flight, no-rebound rapid descent and stick; it is not a box jump or fatigue drill."
    }'::JSONB,
    '{
      "identity":["Tall-to-athletic bilateral descent plus a static no-rebound finish defines the card.","Athletic, landing, and control labels name the same action; stance, arms, depth, speed, and hold time are variant or dose dimensions."],
      "taxonomy":["The card is a bilateral land-and-squat preparation pattern without flight.","Jump, rebound, unilateral, box, depth-drop, and moving-entry tasks remain distinct."],
      "anatomy":["Ankle, knee, and hip flexion control accepts the rapid descent while trunk and frontal-plane control organize the finish.","Muscle roles are not isolation claims."],
      "biomechanics":["The center of mass lowers rapidly without a required aerial phase, then the athlete stabilizes with no extra contact.","Soft-landing instruction and feedback can alter measured landing mechanics, but exact transfer from this drill remains uncertain."],
      "difficulty":["Complexity depends on descent speed, arm start, depth, stance precision, and stick criteria; physical demand is modest because there is no required flight or external load.","Overall difficulty is the greater of complexity and physical demand."],
      "load_fatigue_recovery":["Load is bodyweight through a bilateral closed chain; track rapid eccentric control, contact quality, local leg fatigue, and technical decline.","Dose remains low and quality-limited."],
      "constraints":["Use a flat nonslip floor, overhead clearance, a marked personal station, and direct observation.","Do not add a box, drop height, rebound, or conditioning density to this identity."],
      "dosage":["Use short sets of fully reset repetitions with a declared stick time and ample rest.","End the set at the first repeated control loss."],
      "instructions":["Declare stance, arm start, depth, repetition count, hold time, quality gate, and stop signal before starting.","Reach or stand tall, snap down, organize the whole foot and knee, freeze, then reset."],
      "safety_stop_rules":["Stop for symptoms, giving way, uncontrolled contact, repeated knee or trunk collapse, extra steps, breath holding, fear, or unsafe floor conditions.","Do not count a rebound as a stick."],
      "programming":["Use as movement-intelligence or low-impact landing preparation before more demanding jump, sprint, or deceleration work when it improves the required shape.","Do not use it as proof of readiness for high-impact tasks."],
      "athlete_support":["Athlete guidance names expected effort, unexpected symptoms, self-checks, access options, and nonvideo instruction.","The athlete reports rather than hides a failed stick."],
      "coach_support":["Coach support covers front and side observation, correction order, demonstration, group spacing, and exact recording.","The coach separates this no-flight action from source text that incorrectly described a box jump."],
      "accessibility":["Slower drop, shallower depth, hands at chest, floor marks, fewer repetitions, and longer reset reduce demand.","A stable support changes the exercise and requires variant review."],
      "alternates":["Drop Squat to Stick is a slower preplanned substitution; jump-and-stick, rebound, single-leg, box, and depth-drop actions require separate cards.","Arm position and stick duration are annotations unless they materially change the action."],
      "media":["Four candidate links returned current YouTube oEmbed metadata.","Playback, full viewing, exact variant, cue quality, captions, accessibility, reviewer identity, and approval remain unresolved."]
    }'::JSONB,
    '{"url":"https://pmc.ncbi.nlm.nih.gov/articles/PMC10254820/","title":"Training interventions to reduce the risk of injury to the lower extremity joints during landing movements in adult athletes: a systematic review and meta-analysis","publisher":"BMJ Open Sport & Exercise Medicine","kind":"peer_reviewed_research","quality":89}'::JSONB,
    '{"url":"https://pmc.ncbi.nlm.nih.gov/articles/PMC6208302/","title":"The Use of Augmented Information for Reducing Anterior Cruciate Ligament Injury Risk During Jump Landings: A Systematic Review","publisher":"Journal of Athletic Training","kind":"peer_reviewed_research","quality":87}'::JSONB
  ),
  (
    'mirror-shuffle',
    'Mirror Shuffle',
    'Two athletes face each other inside a declared lateral lane. One leads with unpredictable lateral shuffle direction and controlled stops while the follower reads the leader body movement and mirrors without guessing, crossing the feet, colliding, or leaving the boundary. Roles, lane width, leader speed, cue rules, round time, accuracy target, spacing, and rest are declared before the set; stop before reaction accuracy, posture, braking, or spacing deteriorates.',
    'partner_lateral_mirror_shuffle',
    88, 76, 34,
    ARRAY['locomote']::TEXT[],
    ARRAY['foot','ankle','knee','hip','core','full_body']::TEXT[],
    ARRAY['cones','partner']::TEXT[],
    ARRAY['timer','line_tape']::TEXT[],
    '{
      "surface":{"required":"flat_dry_high_traction","avoid":["wet","uneven","hard_obstacles"]},
      "space":{"laneWidthYards":{"minimum":3,"target":4,"maximum":5},"partnerSpacingMeters":{"minimum":1.5,"target":2.0,"maximum":3.0},"runOutMeters":2,"crossTrafficProhibited":true},
      "setup":{"leaderAndFollowerDeclared":true,"validMovement":"lateral_shuffle_only","boundariesVisible":true,"roleSwitchDeclared":true},
      "traffic":{"athletesPerStation":2,"stationSeparationMeters":3,"coachSightlineRequired":true},
      "record":["lane_width","partner_spacing","leader_speed","round_seconds","role","correct_reads","false_starts","boundary_errors"]
    }'::JSONB,
    '{
      "prerequisites":["pain_free_lateral_shuffle","controlled_lateral_stop_both_directions","understands_leader_follower_rule","can_maintain_safe_spacing"],
      "useCaution":["current_groin_ankle_knee_hip_or_back_symptoms","history_of_collision_fear","attention_or_processing_support_needed","large_size_or_speed_mismatch"],
      "doNotUseWhen":["unsafe_surface_or_lane","no_appropriate_partner","cannot_shuffle_without_crossing_or_collision","pain_or_limp","cannot_understand_or_follow_stop_signal"],
      "regressionOrder":["preplanned_lateral_shuffle_walkthrough","slower_leader","narrower_lane","shorter_round","fewer_direction_changes"],
      "medicalScope":"This card is training, not diagnosis or return-to-play clearance."
    }'::JSONB,
    '{
      "primaryMuscles":["gluteus_medius","adductors","quadriceps","soleus","gastrocnemius"],
      "secondaryMuscles":["gluteus_maximus","hamstrings","hip_flexors","peroneals"],
      "stabilizers":["foot_intrinsics","abdominal_wall","spinal_erectors"],
      "joints":["ankle","knee","hip","lumbar_spine"],
      "jointActions":["lateral_hip_abduction_and_adduction","ankle_and_knee_braking_control","hip_flexion_extension_control","lateral_push_off","trunk_rotation_and_lean_control"],
      "planes":["frontal","sagittal_control","transverse_control"],
      "laterality":"bilateral_alternating",
      "kineticChain":"closed_chain_alternating_lateral_locomotion",
      "biomechanics":{"definingAction":"live_partner_cued_lateral_mirroring","perceptionActionCoupled":true,"preplanned":false,"crossoverExcluded":true,"sprintExitExcluded":true},
      "evidenceLimit":"Agility research supports perception-action coupling, but the exact lane, dose, and coaching effects of this specific partner drill remain unverified."
    }'::JSONB,
    '{
      "whyItMatters":"Links visual information from a live opponent to controlled lateral movement and braking.",
      "primaryCue":"Read the hips, push the floor, keep space, and reset before guessing.",
      "expectedSensations":["lateral_hip_and_thigh_effort","calf_effort","focused_attention","controlled_breathing"],
      "unexpectedSensations":["pain","dizziness","panic","giving_way","collision_or_near_collision","loss_of_orientation"],
      "selfChecks":["wait_for_real_movement","feet_do_not_cross","base_does_not_click_together","spacing_stays_safe","stop_is_controlled","accuracy_stays_high"],
      "painGuidance":"Stop the round and tell the coach when symptoms, uncertainty, or unsafe spacing appear.",
      "accessibility":["slower_leader","shorter_round","narrower_lane","larger_spacing","visual_boundary_contrast","preplanned_walkthrough"],
      "mediaAlternatives":["written_role_rules","lane_diagram","slow_coach_demonstration","leader_follower_still_sequence"],
      "beforeYouStart":["inspect_lane","match_partners","declare_roles_valid_actions_time_and_stop_signal","rehearse_at_walkthrough_speed"],
      "afterSetCheck":["record_accuracy_false_starts_boundary_errors_quality_and_stop_reason"]
    }'::JSONB,
    '{
      "observationChecklist":["surface_and_lane","partner_match","starting_base","visual_attention","first_step_direction","foot_crossing","knee_and_trunk_control","spacing","braking","accuracy","fatigue"],
      "faultCorrections":{"guessing":["slow_leader","add_longer_random_delay","reduce_choices"],"feet_cross":["reduce_speed","rehearse_lateral_shuffle"],"collision_risk":["increase_spacing","reduce_lane_speed","stop_round"],"posture_or_braking_fails":["shorter_round","longer_rest","preplanned_walkthrough"]},
      "demonstrationPlan":["show_roles_and_boundaries","show_valid_lateral_shuffle","show_wait_then_move","show_safe_stop_and_reset","contrast_guessing_crossing_and_collision"],
      "groupManagement":["two_athletes_per_station","match_size_and_speed","separate_lanes","role_switch_only_when_both_reset","coach_controls_start_and_stop"],
      "modificationDecisionTree":{"mechanics_not_repeatable":"lateral_shuffle_walkthrough","accuracy_below_target":"slower_leader_or_fewer_changes","safe_accurate_rounds":"increase_leader_speed_before_duration","symptom_or_collision_risk":"stop"},
      "recordingFields":["variant_key","lane_width","partner_spacing","leader_speed","role","round_seconds","correct_reads","false_starts","boundary_errors","quality_pass","symptoms","stop_reason"]
    }'::JSONB,
    '{
      "issueCategories":["identity_or_variant","cue_or_dose","partner_or_environment","media_exact_match","accessibility","pain_or_collision","relationship","calibration"],
      "supportEscalation":{"urgent":["collision_injury","neurologic_or_cardiovascular_symptom"],"coachReview":["repeated_guessing","unsafe_spacing","partner_mismatch","unclear_cue_rule"],"contentReview":["media_mismatch","conflicting_crossover_or_sprint_exit","missing_accessibility"]},
      "retentionPolicy":"Retain card version, exact variant, lane, roles, dose, accuracy, false starts, errors, symptoms, stop reason, media metadata, and reviewer decisions according to facility policy.",
      "changeImpactPolicy":"Adding crossover, forward-back motion, sprint exit, tag contact, ball handling, resistance, or another cue source changes the action or constraints and requires identity review.",
      "knownLimitations":["candidate_media_not_human_viewed","exact_partner_drill_outcomes_not_established","scores_and_graph_are_review_proposals"],
      "supportSummary":"A live partner cue is required; a preplanned shuffle is a regression or substitution, not the same delivery."
    }'::JSONB,
    '{
      "identity":["A live leader-follower lateral mirror task defines the card; drill and partner labels do not create separate identities.","Lane size, role, leader speed, round duration, and cue complexity are delivery dimensions."],
      "taxonomy":["The required action is lateral shuffle response to live partner motion with safe spacing and controlled stops.","Preplanned routes, crossover steps, sprint exits, tag contact, ball tasks, and resisted shuffles remain distinct."],
      "anatomy":["Alternating lateral push-off and braking use hip, knee, ankle, trunk, and foot control.","The card does not claim isolated muscle activation."],
      "biomechanics":["The follower must couple visual information to a lateral movement response; a preplanned route omits the defining decision demand.","Partner spacing and achievable speed govern braking exposure."],
      "difficulty":["Complexity is driven by cue unpredictability, leader speed, direction-change frequency, lane size, and spacing; physical demand rises with speed and round duration.","Overall difficulty is the greater of complexity and physical demand."],
      "load_fatigue_recovery":["Load is bodyweight alternating lateral acceleration and braking; track adductor, abductor, calf, and technical fatigue plus total hard direction changes.","Do not let density convert the drill into conditioning."],
      "constraints":["Use matched partners, visible boundaries, high traction, separated lanes, and a clear stop signal.","No contact or crossover is permitted in this variant."],
      "dosage":["Use short rounds, rotate roles, preserve high response accuracy, and rest before posture or braking changes.","Count correct reads and false starts, not only time."],
      "instructions":["Declare roles, legal movement, boundary, spacing, duration, accuracy target, role switch, and stop signal.","Follower reads the leader body movement, mirrors laterally, controls each stop, and resets."],
      "safety_stop_rules":["Stop for symptoms, collision risk, repeated guessing, wrong-direction responses, boundary loss, crossed feet, posture collapse, or fatigue-driven braking errors.","A competitive score never overrides safety."],
      "programming":["Use for movement intelligence or low-volume reactive output after lateral shuffle mechanics are repeatable.","Keep it fresh and separate from conditioning unless a different card is authored."],
      "athlete_support":["Athlete support explains valid information, self-checks, partner safety, accessibility, and nonvideo instruction.","The follower waits for information rather than anticipating a pattern."],
      "coach_support":["Coach support covers partner matching, lane design, cue rules, accuracy, corrections, progression order, and group traffic.","Progress leader speed before adding choices or duration."],
      "accessibility":["Slower leader, smaller lane, shorter round, more spacing, high-contrast boundaries, and a preplanned walkthrough reduce demand.","A solo light cue does not preserve live opponent information."],
      "alternates":["Mirror Shuffle Drill and Partner Mirror Shuffle are aliases; partner lateral-only lane or box setups are the exact variant.","Crossover, sprint-exit, tag, ball, hop, crawl, or resisted mirror tasks need separate cards."],
      "media":["Four candidate links returned current YouTube oEmbed metadata.","Playback, full viewing, exact variant, cue quality, captions, accessibility, reviewer identity, and approval remain unresolved."]
    }'::JSONB,
    '{"url":"https://pmc.ncbi.nlm.nih.gov/articles/PMC12912675/","title":"Optimizing Agility Training in Team Sport Players—The Role of Perception-Action Coupling: A Systematic Review with Multi-Level Meta-Analysis","publisher":"Sports Medicine - Open","kind":"peer_reviewed_research","quality":90}'::JSONB,
    '{"url":"https://pmc.ncbi.nlm.nih.gov/articles/PMC9347107/","title":"Alternatives to common approaches for training change of direction performance: a scoping review","publisher":"Sports Medicine - Open","kind":"peer_reviewed_research","quality":87}'::JSONB
  ),
  (
    'sprint-to-stick-deceleration',
    'Sprint-to-Stick Deceleration',
    'From the declared start, accelerate linearly through the exact approach distance, begin braking early enough to remain inside the marked zone, reduce velocity with organized steps, and finish in a stable bilateral athletic stance for the declared hold without turning, crossing, or running through. Approach distance, intent, braking-zone length, start stance, stop location, hold time, and recovery are recorded; stop before braking posture, foot placement, alignment, or confidence changes.',
    'linear_sprint_to_bilateral_deceleration_stick',
    91, 82, 34,
    ARRAY['locomote','land']::TEXT[],
    ARRAY['foot','ankle','knee','hip','core','full_body']::TEXT[],
    ARRAY['cones']::TEXT[],
    ARRAY['timer','line_tape']::TEXT[],
    '{
      "surface":{"required":"flat_dry_high_traction","avoid":["wet","loose","uneven","excessively_hard_for_volume"]},
      "space":{"approachDistanceYards":[5,10],"brakingZoneYards":{"minimum":3,"target":4,"maximum":5},"runOutYards":5,"crossTrafficProhibited":true},
      "setup":{"startApproachBrakeAndFinishMarkersRequired":true,"distanceAndIntentDeclared":true,"bilateralStickRequired":true},
      "traffic":{"oneAthletePerLane":true,"laneSeparationMeters":3,"coachSightlineRequired":true},
      "record":["approach_yards","entry_intent","braking_zone_yards","start_stance","stick_seconds","extra_steps","stop_location"]
    }'::JSONB,
    '{
      "prerequisites":["pain_free_linear_acceleration","controlled_lower_speed_sprint_to_stick","understands_braking_zone","can_hold_bilateral_athletic_finish"],
      "useCaution":["current_foot_ankle_knee_hip_hamstring_groin_or_back_symptoms","recent_lower_extremity_procedure","limited_braking_exposure","fear_of_high_speed_stopping"],
      "doNotUseWhen":["pain_or_limp","unsafe_surface_or_runout","cannot_stop_at_lower_entry_speed","cannot_hold_finish","fatigue_already_changes_sprint_or_braking"],
      "regressionOrder":["reduce_entry_intent","shorter_approach","longer_braking_zone","walkthrough_deceleration","fewer_repetitions"],
      "medicalScope":"This card is not rehabilitation prescription or return-to-play clearance."
    }'::JSONB,
    '{
      "primaryMuscles":["quadriceps","gluteus_maximus","hamstrings","soleus","gastrocnemius"],
      "secondaryMuscles":["adductors","gluteus_medius","hip_flexors","tibialis_anterior"],
      "stabilizers":["foot_intrinsics","abdominal_wall","spinal_erectors"],
      "joints":["ankle","knee","hip","lumbar_spine"],
      "jointActions":["sprint_hip_extension_and_flexion","ankle_plantarflexion_during_acceleration","ankle_dorsiflexion_and_stiffness_during_braking","knee_and_hip_flexion_control_during_braking","trunk_deceleration_control"],
      "planes":["sagittal","frontal_control","transverse_control"],
      "laterality":"bilateral_alternating_to_bilateral_stick",
      "kineticChain":"closed_chain_alternating_locomotion_to_bilateral_stabilization",
      "biomechanics":{"definingAction":"linear_accelerate_then_planned_brake_to_bilateral_stick","turnExcluded":true,"cutExcluded":true,"reaccelerationExcluded":true,"distanceVariants":[5,"7_to_10"]},
      "evidenceLimit":"Horizontal-deceleration research establishes substantial braking demands, but exact force exposure and outcomes for these precise distances and coaching doses are not directly established."
    }'::JSONB,
    '{
      "whyItMatters":"Practices producing short acceleration and then attenuating horizontal velocity into a controlled stop.",
      "primaryCue":"Build speed, brake early, lower through the hips, and own the stop.",
      "expectedSensations":["high_leg_drive","quadriceps_and_glute_braking_effort","calf_and_foot_stiffness","elevated_breathing_with_full_recovery"],
      "unexpectedSensations":["sharp_or_increasing_pain","hamstring_or_groin_grab","giving_way","dizziness","fear_or_inability_to_stop"],
      "selfChecks":["approach_distance_exact","braking_begins_before_panic_steps","feet_stay_in_lane","knees_track","stop_inside_zone","hold_has_no_extra_step"],
      "painGuidance":"Stop, use the run-out safely, and tell the coach when symptoms or loss of stopping control appear.",
      "accessibility":["lower_entry_intent","shorter_approach","longer_braking_zone","walkthrough_speed","fewer_repetitions","more_recovery"],
      "mediaAlternatives":["lane_diagram","step_sequence","coach_walkthrough","side_view_stills"],
      "beforeYouStart":["inspect_lane_and_footwear","mark_all_distances","declare_intent_dose_and_stop_signal","rehearse_at_lower_speed"],
      "afterSetCheck":["record_stop_location_extra_steps_quality_symptoms_and_stop_reason"]
    }'::JSONB,
    '{
      "observationChecklist":["surface_markers_and_runout","start","acceleration_posture","entry_speed","braking_onset","step_strategy","foot_and_knee_alignment","trunk_and_hip_lowering","stop_location","stick","recovery"],
      "faultCorrections":{"runs_through_zone":["lower_intent","lengthen_braking_zone","shorten_approach"],"panic_stutter_steps":["begin_braking_earlier","reduce_speed","rehearse_zone"],"knee_or_trunk_collapse":["reduce_entry_speed","increase_recovery","end_if_repeated"],"twists_to_stop":["widen_lane_if_needed","cue_linear_finish","reduce_speed"]},
      "demonstrationPlan":["walk_markers","show_exact_acceleration_distance","show_early_braking","show_bilateral_stick","contrast_run_through_twist_and_uncontrolled_stutter"],
      "groupManagement":["one_athlete_per_lane","coach_releases_next_rep_only_after_clear_runout","separate_return_path","full_walk_back_or_timed_rest"],
      "modificationDecisionTree":{"cannot_stop_at_current_intent":"reduce_speed_or_approach","stops_clean_but_early":"adjust_braking_target_gradually","repeatable_five_yard":"consider_seven_to_ten_yard_variant","symptom_or_fear":"stop"},
      "recordingFields":["variant_key","approach_yards","entry_intent","braking_zone_yards","start_stance","repetitions","stick_seconds","stop_location","extra_steps","quality_pass","symptoms","stop_reason"]
    }'::JSONB,
    '{
      "issueCategories":["identity_or_variant","distance_or_dose","surface_or_lane","media_exact_match","accessibility","pain_or_braking_safety","relationship","calibration"],
      "supportEscalation":{"urgent":["fall_or_collision_injury","acute_muscle_or_joint_event","neurologic_or_cardiovascular_symptom"],"coachReview":["repeated_run_through","fear_or_giving_way","unclear_distance_or_variant"],"contentReview":["media_mismatch","conflicting_turn_or_reacceleration_instruction","missing_accessibility"]},
      "retentionPolicy":"Retain card version, exact distance variant, intent, braking zone, dose, stop location, errors, symptoms, stop reason, media metadata, and reviewer decisions according to facility policy.",
      "changeImpactPolicy":"Adding a turn, cut, reactive cue, backpedal, reacceleration, load, partner, or different finish changes action or constraints and requires identity review.",
      "knownLimitations":["candidate_media_not_human_viewed","exact_distance_dose_outcomes_not_established","scores_and_graph_are_review_proposals"],
      "supportSummary":"Approach distance is an exact variant; entry speed and braking-zone setup must be scaled before volume."
    }'::JSONB,
    '{
      "identity":["Linear acceleration followed by planned braking to a bilateral static finish defines the card.","Five-yard and seven-to-ten-yard approaches are exact distance variants, not separate identities."],
      "taxonomy":["The card declares linear approach, exact distance, braking zone, entry intent, bilateral stick, hold, and recovery.","Turns, cuts, reactive cues, reacceleration, backpedal, and run-through finishes remain distinct."],
      "anatomy":["Alternating acceleration steps transition to multi-step ankle, knee, hip, and trunk braking control.","Muscle demand varies with achieved velocity and braking strategy."],
      "biomechanics":["Horizontal deceleration can expose athletes to large braking forces and loading rates; achieved velocity and braking distance materially affect demand.","The card scales entry intent and distance before density."],
      "difficulty":["Longer approach and higher intent raise physical difficulty and stopping consequence; narrow zones, strict stop location, and start demands raise complexity.","Overall difficulty is the greater of complexity and physical demand."],
      "load_fatigue_recovery":["Track hard braking events, approach distance, entry intent, stop quality, quadriceps and calf fatigue, hamstring or groin symptoms, and recovery.","Do not count only sprint distance."],
      "constraints":["Use high traction, exact markers, a clear braking zone and run-out, separated lanes, and direct coach control.","Return traffic must not cross active lanes."],
      "dosage":["Use low repetitions, full reset, and enough rest to preserve entry speed and braking technique.","The next repetition starts only when the lane is clear and the athlete is ready."],
      "instructions":["Declare distance, start, intent, braking zone, finish, stick time, repetitions, rest, and stop signal.","Accelerate linearly, brake before the final marker, finish bilaterally, freeze, and walk out."],
      "safety_stop_rules":["Stop for pain, limp, fear, inability to stop, repeated run-through, twisting, knee or trunk collapse, unsafe surface, blocked run-out, or fatigue-related decline.","Reduce speed before asking for a tighter stop."],
      "programming":["Use lower-intent variants for movement learning and higher-intent variants for fresh output after prerequisite braking control.","Count toward sprint, braking, impact, hamstring, quadriceps, and calf budgets."],
      "athlete_support":["Athlete support includes lane self-checks, expected and unexpected sensations, scalable speed and distance, and nonvideo guidance.","The athlete may use the run-out rather than force an unsafe stop."],
      "coach_support":["Coach support covers exact setup, approach and stop observation, fault correction, lane control, scaling, and data capture.","Stop location and extra steps are recorded."],
      "accessibility":["Shorter approach, lower intent, longer braking zone, walkthrough speed, fewer reps, and more rest reduce demand.","A walking step-down stop is a separate regression card."],
      "alternates":["Five-yard acceleration/deceleration labels are exact variants; distance and start stance are variant or dose fields.","Cut, turn, backpedal, reactive, reacceleration, shuttle, and loaded tasks require separate cards."],
      "media":["Four candidate links returned current YouTube oEmbed metadata.","Playback, full viewing, exact variant, cue quality, captions, accessibility, reviewer identity, and approval remain unresolved."]
    }'::JSONB,
    '{"url":"https://pmc.ncbi.nlm.nih.gov/articles/PMC9474351/","title":"Biomechanical and Neuromuscular Performance Requirements of Horizontal Deceleration: A Review with Implications for Random Intermittent Multi-Directional Sports","publisher":"Sports Medicine - Open","kind":"peer_reviewed_research","quality":90}'::JSONB,
    '{"url":"https://pmc.ncbi.nlm.nih.gov/articles/PMC8998119/","title":"Biomechanical Performance Factors in the Track and Field Sprint Start: A Systematic Review","publisher":"International Journal of Environmental Research and Public Health","kind":"peer_reviewed_research","quality":91}'::JSONB
  ),
  (
    'single-leg-pogo',
    'Single-Leg Pogo',
    'Balance on the declared leg with support, direction, amplitude, cadence, arm action, contact count, and finish rule specified by the exact variant. Perform repeated low-amplitude ankle-dominant hops with a tall organized trunk, the foot returning under the hip or to the declared line, the knee tracking with the foot, and the pelvis controlled. Use quick quiet contacts without an intentional stick between repetitions; stop before contact time, sound, alignment, height, direction, or symptoms change.',
    'repeated_unilateral_ankle_dominant_pogo',
    90, 78, 33,
    ARRAY['jump','locomote']::TEXT[],
    ARRAY['foot','ankle','knee','hip','core']::TEXT[],
    '{}'::TEXT[],
    ARRAY['line_tape','wall','mat']::TEXT[],
    '{
      "surface":{"required":"flat_dry_stable_high_traction_with_appropriate_compliance","avoid":["wet","uneven","very_hard_for_high_volume","soft_unstable"]},
      "space":{"stationaryRadiusMeters":1.5,"travelLaneMeters":{"minimum":5,"target":8,"maximum":12},"runOutMeters":3,"crossTrafficProhibited":true},
      "setup":{"side_support_direction_amplitude_cadence_contacts_and_finish_declared":true,"footwearAndSurfaceRecorded":true},
      "traffic":{"oneAthletePerLaneOrStation":true,"stationSeparationMeters":2.5,"coachSightlineRequired":true},
      "record":["side","support","direction","amplitude","cadence","contacts","distance","contact_quality","finish_rule"]
    }'::JSONB,
    '{
      "prerequisites":["pain_free_bilateral_pogo_or_repeated_calf_raise","controlled_single_leg_stance","can_land_single_leg_quietly","understands_contact_and_stop_rule"],
      "useCaution":["current_foot_ankle_achilles_calf_knee_hip_or_back_symptoms","recent_lower_extremity_procedure","limited_unilateral_impact_exposure","large_side_difference"],
      "doNotUseWhen":["pain_or_limp","unsafe_surface_or_lane","cannot_control_supported_low_amplitude_variant","contacts_are_loud_slow_or_unstable","fatigue_already_changes_landing"],
      "regressionOrder":["supported_stationary","fewer_contacts","lower_amplitude","slower_declared_cadence","bilateral_pogo_substitution"],
      "medicalScope":"This card is not rehabilitation prescription, tendon treatment, or clearance."
    }'::JSONB,
    '{
      "primaryMuscles":["soleus","gastrocnemius","foot_intrinsics","gluteus_medius"],
      "secondaryMuscles":["quadriceps","hamstrings","gluteus_maximus","peroneals","tibialis_anterior"],
      "stabilizers":["abdominal_wall","spinal_erectors","hip_external_rotators"],
      "joints":["ankle","knee","hip","lumbar_spine"],
      "jointActions":["repeated_ankle_plantarflexion_and_dorsiflexion","short_range_knee_flexion_extension","hip_and_pelvis_stabilization","frontal_and_transverse_foot_knee_control","trunk_stabilization"],
      "planes":["sagittal","frontal_control","transverse_control","multiplanar_by_variant"],
      "laterality":"unilateral",
      "kineticChain":"repeated_unilateral_closed_chain_contacts",
      "biomechanics":{"definingAction":"repeated_low_amplitude_unilateral_ankle_dominant_hops","terminalStickBetweenContacts":false,"directionVariants":["stationary","linear_forward","lateral_line"],"supportVariant":true},
      "evidenceLimit":"Unilateral hopping can estimate leg stiffness and plyometric training can change stiffness measures, but these sources do not validate exact card scores, doses, or outcomes for each variant."
    }'::JSONB,
    '{
      "whyItMatters":"Develops and assesses repeated unilateral foot-ankle spring behavior while the knee, pelvis, and trunk remain organized.",
      "primaryCue":"Tall hips, quick quiet spring, land under you, and stop before contacts get heavy.",
      "expectedSensations":["calf_and_foot_effort","lateral_hip_stabilization","rhythmic_breathing","light_repeatable_contacts"],
      "unexpectedSensations":["sharp_or_increasing_pain","achilles_or_calf_grab","giving_way","numbness_or_tingling","dizziness","fear"],
      "selfChecks":["same_leg_and_direction_as_declared","contact_sound_stays_quiet","heel_does_not_slam","knee_tracks","pelvis_and_trunk_stay_controlled","height_and_rhythm_stay_repeatable"],
      "painGuidance":"Stop immediately, settle safely, and report foot, ankle, Achilles, calf, knee, hip, or back symptoms.",
      "accessibility":["stable_hand_support","fewer_contacts","lower_amplitude","stationary_before_traveling","slower_cadence","bilateral_pogo_substitution"],
      "mediaAlternatives":["side_view_contact_sequence","lane_diagram","cadence_audio","coach_demonstration","written_contact_checklist"],
      "beforeYouStart":["inspect_surface_and_footwear","declare_side_variant_dose_finish_and_stop_signal","rehearse_supported_if_needed"],
      "afterSetCheck":["record_actual_contacts_distance_quality_side_difference_symptoms_and_stop_reason"]
    }'::JSONB,
    '{
      "observationChecklist":["surface_and_lane","side_and_support","posture","foot_contact_location","heel_behavior","contact_sound_and_time","knee_tracking","pelvic_control","direction","amplitude","rhythm","fatigue"],
      "faultCorrections":{"loud_or_slow_contacts":["reduce_contacts","lower_amplitude","supported_stationary"],"heel_slams":["reduce_cadence_or_amplitude","end_if_persistent"],"knee_or_pelvis_drifts":["add_support","return_stationary","reduce_contacts"],"travel_direction_uncontrolled":["shorter_lane","stationary_variant","visible_line"]},
      "demonstrationPlan":["show_exact_support_and_side","show_low_ankle_dominant_contact","show_direction_and_finish","show_quiet_repeatable_rhythm","contrast_deep_jump_loud_contact_and_terminal_stick"],
      "groupManagement":["one_athlete_per_station_or_lane","alternate_sides_after_full_reset","separate_from_sprints_and_jumps","count_contacts_or_time_not_both_without_reason"],
      "modificationDecisionTree":{"unsupported_not_controlled":"supported_stationary","stationary_clean":"linear_or_lateral_only_for_matching_goal","direction_or_rhythm_fails":"return_stationary","symptom":"stop"},
      "recordingFields":["variant_key","side","support","direction","amplitude","cadence","target_contacts","actual_contacts","distance","quality_pass","faults","symptoms","stop_reason"]
    }'::JSONB,
    '{
      "issueCategories":["identity_or_variant","contact_dose","surface_or_lane","media_exact_match","accessibility","pain_or_impact","relationship","calibration"],
      "supportEscalation":{"urgent":["fall_or_acute_injury","suspected_achilles_or_calf_event","neurologic_or_cardiovascular_symptom"],"coachReview":["repeat_side_difference","contact_quality_failure","unclear_variant_or_finish"],"contentReview":["media_mismatch","conflicting_stick_or_bound_instruction","missing_accessibility"]},
      "retentionPolicy":"Retain card version, exact variant, side, support, direction, dose, actual contacts, distance, quality, symptoms, stop reason, media metadata, and reviewer decisions according to facility policy.",
      "changeImpactPolicy":"Adding a terminal stick, hurdle, box, bound, high knee, rotation, external load, reactive cue, or linked sprint changes action or constraints and requires identity review.",
      "knownLimitations":["candidate_media_not_human_viewed","exact_variant_dose_outcomes_not_established","scores_and_graph_are_review_proposals"],
      "supportSummary":"Direction and support are exact variants; repeated quick contacts end before rhythm, alignment, or symptoms change."
    }'::JSONB,
    '{
      "identity":["Repeated low-amplitude unilateral ankle-dominant contacts without a stick between repetitions define the card.","In-place and jumps labels are aliases; support, direction, amplitude, cadence, arm action, and contact count define the variant or dose."],
      "taxonomy":["The card declares side, support, direction, amplitude, cadence, contacts, surface, footwear, and finish.","Pogo-to-stick, hop-and-stick, bounds, hurdles, boxes, high-knee cycles, and linked sprints remain distinct."],
      "anatomy":["Repeated ankle-dominant hopping loads plantarflexors and foot structures while knee, hip, pelvis, and trunk control the unilateral chain.","Contribution changes with cadence, amplitude, direction, support, and individual strategy."],
      "biomechanics":["Unilateral and bilateral hopping produce different stiffness estimates; single-leg data should not be inferred from double-leg labels.","Travel direction increases center-of-mass control and landing-location demand."],
      "difficulty":["Removing support and adding travel direction raise complexity; amplitude, cadence, contacts, and travel raise physical and impact demand.","Overall difficulty is the greater of complexity and physical demand."],
      "load_fatigue_recovery":["Track contacts per leg, direction, amplitude, surface, contact quality, calf and foot fatigue, side difference, and recovery.","Impact budgets count every ground contact."],
      "constraints":["Use an appropriate dry surface, safe footwear, separated stations or lanes, clear run-out, and exact side and dose.","Do not prescribe through Achilles, calf, foot, ankle, knee, hip, or back symptoms."],
      "dosage":["Use small contact sets and full recovery; cap volume by current exposure and quality rather than conditioning goals.","Stop before contact sound, time, height, direction, or alignment changes."],
      "instructions":["Declare support, side, direction, amplitude, cadence, contacts, finish, rest, and stop signal.","Bounce from the ankle with small knee motion, tall posture, quiet contacts, and exact landing location."],
      "safety_stop_rules":["Stop for symptoms, limp, fear, giving way, loud or slow contacts, heel slam, knee or pelvic drift, direction loss, or fatigue.","Never add contacts solely to finish a clock."],
      "programming":["Use supported stationary contacts for entry, unsupported stationary for foundational elastic work, and traveling variants only for matching directional goals.","Count unilateral contacts toward impact and lower-leg budgets."],
      "athlete_support":["Athlete support identifies sensations, side checks, support choices, surface rules, pain escalation, and nonvideo guidance.","The athlete reports actual contacts and asymmetry."],
      "coach_support":["Coach support covers contact observation, side comparison, direction, correction order, group spacing, scaling, and data capture.","Progress contact quality before direction or volume."],
      "accessibility":["Stable hand support, stationary direction, fewer contacts, lower amplitude, slower cadence, and bilateral pogo substitution reduce demand.","Support is declared and must not become a hidden push."],
      "alternates":["Supported stationary, unsupported stationary, linear-forward, and lateral-line pogos are exact variants.","Terminal stick, high-knee, bound, hurdle, box, reactive, loaded, and linked sprint actions need separate cards."],
      "media":["Four candidate links returned current YouTube oEmbed metadata.","Playback, full viewing, exact variant, cue quality, captions, accessibility, reviewer identity, and approval remain unresolved."]
    }'::JSONB,
    '{"url":"https://pubmed.ncbi.nlm.nih.gov/24290613/","title":"Leg stiffness: comparison between unilateral and bilateral hopping tasks","publisher":"Human Movement Science","kind":"peer_reviewed_research","quality":86}'::JSONB,
    '{"url":"https://pmc.ncbi.nlm.nih.gov/articles/PMC10105022/","title":"The effects of plyometric jump training on lower-limb stiffness in healthy individuals: A meta-analytical comparison","publisher":"Journal of Sport and Health Science","kind":"peer_reviewed_research","quality":90}'::JSONB
  );

UPDATE coaching.exercise_variant_v1 variant
SET variant_key = CASE
      WHEN definition.slug = 'snap-down-to-stick'
        AND variant.variant_key = 'baseline'
        THEN 'legacy-source-139-baseline'
      WHEN definition.slug = 'snap-down-to-stick'
        AND variant.variant_key = 'baseline-source-541'
        THEN 'legacy-source-541-baseline'
      WHEN definition.slug = 'snap-down-to-stick'
        AND variant.variant_key = 'baseline-source-1105'
        THEN 'legacy-source-1105-baseline'
      WHEN definition.slug = 'mirror-shuffle'
        AND variant.variant_key = 'baseline'
        THEN 'legacy-source-941-baseline'
      WHEN definition.slug = 'sprint-to-stick-deceleration'
        AND variant.variant_key = 'baseline'
        THEN 'legacy-source-155-baseline'
      WHEN definition.slug = 'single-leg-pogo'
        AND variant.variant_key = 'baseline'
        THEN 'legacy-source-344-baseline'
      ELSE variant.variant_key
    END,
    display_name = 'Legacy ' || variant.display_name || ' Source',
    status = 'archived',
    requirements_json = coalesce(variant.requirements_json, '{}'::JSONB)
      || jsonb_build_object(
        'selectable', FALSE,
        'identityQuarantine', TRUE,
        'quarantineReason',
          'Legacy source omits the exact selectable variant, dosage, quality, and stop contract.'
      ),
    updated_at = now()
FROM coaching.exercise_definition_v1 definition
WHERE definition.id = variant.definition_id
  AND definition.facility_id = 1
  AND (
    (
      definition.slug = 'snap-down-to-stick'
      AND variant.variant_key IN (
        'baseline',
        'baseline-source-541',
        'baseline-source-1105'
      )
    )
    OR (
      definition.slug = 'mirror-shuffle'
      AND variant.variant_key = 'baseline'
    )
    OR (
      definition.slug = 'sprint-to-stick-deceleration'
      AND variant.variant_key = 'baseline'
    )
    OR (
      definition.slug = 'single-leg-pogo'
      AND variant.variant_key = 'baseline'
    )
  );

UPDATE coaching.exercise_delivery_profile_v1 profile
SET status = 'archived',
    updated_at = now()
FROM coaching.exercise_variant_v1 variant
JOIN coaching.exercise_definition_v1 definition
  ON definition.id = variant.definition_id
WHERE variant.id = profile.variant_id
  AND definition.facility_id = 1
  AND definition.slug IN (
    'snap-down-to-stick',
    'mirror-shuffle',
    'sprint-to-stick-deceleration',
    'single-leg-pogo'
  )
  AND variant.status = 'archived';

UPDATE coaching.exercise_definition_v1 definition
SET canonical_name = seed.canonical_name,
    display_name = seed.canonical_name,
    description = seed.description,
    family_key = seed.family_key,
    schema_version = '1.0.0',
    card_version = greatest(definition.card_version, 2),
    status = 'review',
    content_confidence = seed.content_confidence,
    scoring_confidence = seed.scoring_confidence,
    media_confidence = seed.media_confidence,
    movement_patterns = seed.movement_patterns,
    body_regions = seed.body_regions,
    required_equipment = seed.required_equipment,
    optional_equipment = seed.optional_equipment,
    environment_json = seed.environment_json,
    population_json = seed.population_json,
    anatomy_json = seed.anatomy_json,
    athlete_support_json = seed.athlete_support_json,
    coach_support_json = seed.coach_support_json,
    support_operations_json = seed.support_operations_json,
    approved_video_url = NULL,
    reviewed_by = NULL,
    approved_by = NULL,
    last_reviewed_at = NULL,
    provenance_json = definition.provenance_json || jsonb_build_object(
      'structuralCompletionMigration',
        '354_coaching_reactive_landing_pogo_family_completion',
      'researchBatch', 'reactive-landing-pogo-identity-v1',
      'researchVersion', '2026-07-27.46',
      'difficultyModel',
        'max_exercise_complexity_physical_difficulty',
      'evidenceState', 'candidate_requires_human_review',
      'mediaState', 'candidate_oembed_metadata_only',
      'humanReviewRequired', TRUE,
      'publicationQuarantined', TRUE,
      'mediaApprovalCreated', FALSE,
      'graphApprovalCreated', FALSE,
      'calibrationApprovalCreated', FALSE
    ),
    updated_at = now()
FROM reactive_card_seed seed
WHERE definition.facility_id = 1
  AND definition.slug = seed.slug;

CREATE TEMP TABLE reactive_variant_seed (
  slug TEXT NOT NULL,
  variant_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  modifier_keys TEXT[] NOT NULL,
  exercise_complexity SMALLINT NOT NULL,
  physical_difficulty SMALLINT NOT NULL,
  supervision_demand SMALLINT NOT NULL,
  failure_consequence SMALLINT NOT NULL,
  impact SMALLINT NOT NULL,
  work_capacity_demand SMALLINT NOT NULL,
  requirements_json JSONB NOT NULL,
  load_profile_json JSONB NOT NULL,
  fatigue_profile_json JSONB NOT NULL,
  programming_profile_json JSONB NOT NULL,
  PRIMARY KEY (slug, variant_key)
);

INSERT INTO reactive_variant_seed VALUES
  (
    'snap-down-to-stick',
    'bilateral-tall-reach-stick',
    'Bilateral Tall-Reach Snap-Down to Stick',
    ARRAY['bilateral','tall_reach_start','rapid_descent','no_flight','static_stick']::TEXT[],
    32, 22, 30, 20, 1, 18,
    '{
      "selectable":true,
      "start":"tall_bilateral_with_arms_overhead_or_declared_reach",
      "action":"rapid_arm_and_center_of_mass_descent",
      "finish":"bilateral_athletic_stance_static_stick",
      "flight":"not_required",
      "rebound":"prohibited",
      "stickSeconds":{"minimum":2,"target":2,"maximum":3},
      "stanceWidth":"declared_and_repeatable",
      "depth":"pain_free_repeatable_athletic_depth",
      "reset":"stand_tall_and_breathe_before_next_rep"
    }'::JSONB,
    '{
      "gripDemand":1,
      "spinalLoading":8,
      "eccentricStress":18,
      "landingContactsPerRep":0,
      "externalLoadMethod":"bodyweight",
      "externalLoadDescription":"bodyweight rapid descent without required flight or external load",
      "loadTracking":["repetitions","descent_speed","depth","stance_width","stick_seconds"]
    }'::JSONB,
    '{
      "localMuscleFatigue":20,
      "gripFatigue":1,
      "technicalFatigueSensitivity":42,
      "impactAccumulation":1,
      "recoveryHours":8,
      "primaryFatigueSites":["quadriceps","gluteals","calves","postural_system"],
      "stopBefore":["descent_slows","contact_or_finish_gets_noisy","knee_or_trunk_drift","extra_step_or_rebound","breath_holding"]
    }'::JSONB,
    '{
      "trainingStimuli":["rapid_bilateral_position_organization","low_impact_landing_shape_control"],
      "stimulusDose":{"primary":"fully_reset_quality_repetitions","fatigueCeiling":"low"},
      "weeklyExposure":{"typical":2,"maximumWithoutReview":4},
      "prerequisites":["controlled_drop_squat_to_stick","pain_free_athletic_stance"],
      "completionCriteria":["rapid_controlled_descent","quiet_stable_finish","two_second_stick","no_extra_step"],
      "sequenceRules":["before_higher_impact_jump_or_deceleration_when_used","not_conditioning"],
      "pairingCompatibility":{"preferred":["landing_preparation","acceleration_preparation"],"avoid":["fatigue_circuits","after_high_impact_volume"]},
      "uncertaintyPolicy":{"uncontrolled_speed":"use_drop_squat_to_stick","symptom":"stop"},
      "cumulativeBudget":{"technicalSensitivity":42,"impact":1,"landingPreparation":18}
    }'::JSONB
  ),
  (
    'mirror-shuffle',
    'partner-lateral-leader-follower',
    'Partner Lateral Leader-Follower Mirror Shuffle',
    ARRAY['partner','live_visual_cue','lateral_shuffle','leader_follower','bounded_lane']::TEXT[],
    58, 40, 48, 35, 2, 45,
    '{
      "selectable":true,
      "participants":2,
      "roles":["leader","follower"],
      "cueSource":"live_partner_body_movement",
      "allowedMovement":"lateral_shuffle_only",
      "laneWidthYards":{"minimum":3,"target":4,"maximum":5},
      "partnerSpacingMeters":{"minimum":1.5,"target":2.0,"maximum":3.0},
      "roleSwitch":"after_each_round_or_declared_pair",
      "accuracyTargetPercent":{"minimum":80,"target":90},
      "contact":"none"
    }'::JSONB,
    '{
      "gripDemand":1,
      "spinalLoading":14,
      "eccentricStress":38,
      "landingContactsPerRep":2,
      "externalLoadMethod":"bodyweight",
      "externalLoadDescription":"bodyweight lateral accelerations and braking in response to a live partner",
      "loadTracking":["round_seconds","hard_direction_changes","leader_speed","correct_reads","false_starts","boundary_errors"]
    }'::JSONB,
    '{
      "localMuscleFatigue":44,
      "gripFatigue":1,
      "technicalFatigueSensitivity":66,
      "impactAccumulation":24,
      "recoveryHours":18,
      "primaryFatigueSites":["adductors","lateral_hip","quadriceps","calves","perceptual_attention"],
      "stopBefore":["accuracy_drops_below_target","guessing_increases","feet_cross","spacing_or_braking_fails","posture_changes"]
    }'::JSONB,
    '{
      "trainingStimuli":["perception_action_coupling","reactive_lateral_first_step","controlled_lateral_braking"],
      "stimulusDose":{"primary":"short_accurate_partner_rounds","fatigueCeiling":"low_to_moderate"},
      "weeklyExposure":{"typical":1,"maximumWithoutReview":3},
      "prerequisites":["repeatable_lateral_shuffle","controlled_bilateral_lateral_stop","safe_partner_spacing"],
      "completionCriteria":["accuracy_at_or_above_target","no_false_start_pattern","safe_spacing","repeatable_posture_and_braking"],
      "sequenceRules":["fresh_after_lateral_mechanics","not_conditioning_by_default"],
      "pairingCompatibility":{"preferred":["lateral_shuffle_walkthrough","reactive_agility_block"],"avoid":["crowded_circuit","post_fatigue_collision_risk"]},
      "uncertaintyPolicy":{"mechanics_or_accuracy_uncertain":"use_preplanned_walkthrough","partner_mismatch":"do_not_run"},
      "cumulativeBudget":{"technicalSensitivity":66,"impact":24,"decisionDemand":62,"adductor":44}
    }'::JSONB
  ),
  (
    'sprint-to-stick-deceleration',
    'five-yard-planned-stick',
    'Five-Yard Planned Sprint-to-Stick',
    ARRAY['linear','five_yard_approach','planned_braking','bilateral_stick']::TEXT[],
    48, 54, 48, 48, 3, 42,
    '{
      "selectable":true,
      "approachDistanceYards":5,
      "entryIntentPercent":{"minimum":50,"target":75,"maximumWithoutReview":85},
      "brakingZoneYards":{"minimum":3,"target":4,"maximum":5},
      "startStance":"declared_two_point_or_standing",
      "path":"linear",
      "finish":"bilateral_athletic_stick",
      "stickSeconds":2,
      "turnCutOrReacceleration":"prohibited"
    }'::JSONB,
    '{
      "gripDemand":1,
      "spinalLoading":22,
      "eccentricStress":52,
      "landingContactsPerRep":4,
      "externalLoadMethod":"bodyweight",
      "externalLoadDescription":"short linear bodyweight acceleration followed by multi-step braking to a bilateral stop",
      "loadTracking":["approach_yards","entry_intent_percent","braking_zone_yards","hard_braking_steps","stop_location","extra_steps"]
    }'::JSONB,
    '{
      "localMuscleFatigue":48,
      "gripFatigue":1,
      "technicalFatigueSensitivity":62,
      "impactAccumulation":46,
      "recoveryHours":24,
      "primaryFatigueSites":["quadriceps","calves","gluteals","hamstrings","adductors"],
      "stopBefore":["run_through","panic_stutter_steps","twisting_stop","knee_or_trunk_collapse","entry_speed_or_confidence_drops"]
    }'::JSONB,
    '{
      "trainingStimuli":["short_acceleration","planned_horizontal_braking","bilateral_stop_control"],
      "stimulusDose":{"primary":"quality_acceleration_braking_events","fatigueCeiling":"low_to_moderate"},
      "weeklyExposure":{"typical":1,"maximumWithoutReview":3},
      "prerequisites":["lower_speed_sprint_to_stick","controlled_snap_down_or_drop_squat","safe_lane"],
      "completionCriteria":["exact_distance","stop_inside_zone","no_twist_or_extra_step","stable_two_second_stick"],
      "sequenceRules":["movement_learning_or_early_output","before_fatiguing_lower_body_work"],
      "pairingCompatibility":{"preferred":["sprint_mechanics","landing_preparation"],"avoid":["after_high_speed_or_braking_volume","conditioning_density"]},
      "uncertaintyPolicy":{"cannot_stop":"reduce_intent_or_extend_zone","symptom_or_fear":"stop"},
      "cumulativeBudget":{"technicalSensitivity":62,"impact":46,"braking":52,"sprint":36}
    }'::JSONB
  ),
  (
    'sprint-to-stick-deceleration',
    'seven-to-ten-yard-planned-stick',
    'Seven-to-Ten-Yard Planned Sprint-to-Stick',
    ARRAY['linear','seven_to_ten_yard_approach','planned_braking','bilateral_stick']::TEXT[],
    56, 68, 58, 62, 4, 54,
    '{
      "selectable":true,
      "approachDistanceYards":{"minimum":7,"target":8,"maximum":10},
      "entryIntentPercent":{"minimum":60,"target":80,"maximumWithoutReview":90},
      "brakingZoneYards":{"minimum":3,"target":5,"maximum":6},
      "startStance":"declared_two_point_or_standing",
      "path":"linear",
      "finish":"bilateral_athletic_stick",
      "stickSeconds":2,
      "turnCutOrReacceleration":"prohibited"
    }'::JSONB,
    '{
      "gripDemand":1,
      "spinalLoading":28,
      "eccentricStress":68,
      "landingContactsPerRep":6,
      "externalLoadMethod":"bodyweight",
      "externalLoadDescription":"longer short-sprint acceleration followed by high-demand multi-step braking to a bilateral stop",
      "loadTracking":["approach_yards","entry_intent_percent","braking_zone_yards","hard_braking_steps","stop_location","extra_steps"]
    }'::JSONB,
    '{
      "localMuscleFatigue":62,
      "gripFatigue":1,
      "technicalFatigueSensitivity":72,
      "impactAccumulation":62,
      "recoveryHours":36,
      "primaryFatigueSites":["quadriceps","calves","gluteals","hamstrings","adductors"],
      "stopBefore":["run_through","panic_stutter_steps","twisting_stop","knee_or_trunk_collapse","entry_speed_or_confidence_drops"]
    }'::JSONB,
    '{
      "trainingStimuli":["higher_entry_velocity_acceleration","planned_horizontal_braking","bilateral_stop_control"],
      "stimulusDose":{"primary":"high_quality_acceleration_braking_events","fatigueCeiling":"low"},
      "weeklyExposure":{"typical":1,"maximumWithoutReview":2},
      "prerequisites":["repeatable_five_yard_variant","adequate_braking_zone","full_recovery","no_current_symptoms"],
      "completionCriteria":["exact_distance","controlled_braking_onset","stop_inside_zone","stable_two_second_stick"],
      "sequenceRules":["fresh_output_only","before_strength_capacity_or_conditioning"],
      "pairingCompatibility":{"preferred":["acceleration_output","deceleration_technical_block"],"avoid":["same_session_high_braking_density","post_fatigue"]},
      "uncertaintyPolicy":{"braking_not_repeatable":"return_five_yard_variant","symptom_or_fear":"stop"},
      "cumulativeBudget":{"technicalSensitivity":72,"impact":62,"braking":68,"sprint":54}
    }'::JSONB
  ),
  (
    'single-leg-pogo',
    'supported-stationary-low-amplitude',
    'Supported Stationary Low-Amplitude Single-Leg Pogo',
    ARRAY['unilateral','stable_hand_support','stationary','low_amplitude','repeated_contacts']::TEXT[],
    34, 40, 30, 28, 3, 42,
    '{
      "selectable":true,
      "support":"light_stable_hand_support",
      "direction":"stationary",
      "amplitude":"low",
      "action":"ankle_dominant_repeated_hops",
      "footReturn":"under_hip",
      "terminalStickBetweenContacts":false,
      "supportRule":"balance_assist_not_upward_push",
      "side":"declared_and_recorded"
    }'::JSONB,
    '{
      "gripDemand":4,
      "spinalLoading":12,
      "eccentricStress":40,
      "landingContactsPerRep":1,
      "externalLoadMethod":"bodyweight",
      "externalLoadDescription":"unilateral bodyweight repeated contacts with light hand support for balance",
      "loadTracking":["side","support_contact","contacts","cadence","contact_quality","surface"]
    }'::JSONB,
    '{
      "localMuscleFatigue":46,
      "gripFatigue":2,
      "technicalFatigueSensitivity":48,
      "impactAccumulation":44,
      "recoveryHours":24,
      "primaryFatigueSites":["foot","calf","Achilles_tendon","lateral_hip"],
      "stopBefore":["support_becomes_push","contact_loud_or_slow","heel_slam","knee_or_pelvis_drift","symptom"]
    }'::JSONB,
    '{
      "trainingStimuli":["supported_unilateral_ankle_spring","contact_rhythm","foot_ankle_tolerance"],
      "stimulusDose":{"primary":"quality_contacts_per_side","fatigueCeiling":"low_to_moderate"},
      "weeklyExposure":{"typical":1,"maximumWithoutReview":3},
      "prerequisites":["pain_free_bilateral_pogo_or_calf_raise","safe_single_leg_support"],
      "completionCriteria":["light_support_only","quiet_repeatable_contacts","controlled_knee_pelvis_and_trunk"],
      "sequenceRules":["entry_variant_before_unsupported","count_all_contacts"],
      "pairingCompatibility":{"preferred":["lower_leg_preparation","landing_preparation"],"avoid":["post_fatigue_impact"]},
      "uncertaintyPolicy":{"support_push_or_control_loss":"reduce_contacts_or_use_bilateral_pogo","symptom":"stop"},
      "cumulativeBudget":{"technicalSensitivity":48,"impact":44,"calfAchilles":46}
    }'::JSONB
  ),
  (
    'single-leg-pogo',
    'stationary-low-amplitude',
    'Stationary Low-Amplitude Single-Leg Pogo',
    ARRAY['unilateral','unsupported','stationary','low_amplitude','repeated_contacts']::TEXT[],
    46, 54, 42, 45, 4, 56,
    '{
      "selectable":true,
      "support":"available_nearby_not_used",
      "direction":"stationary",
      "amplitude":"low",
      "action":"ankle_dominant_repeated_hops",
      "footReturn":"under_hip",
      "terminalStickBetweenContacts":false,
      "side":"declared_and_recorded"
    }'::JSONB,
    '{
      "gripDemand":1,
      "spinalLoading":16,
      "eccentricStress":54,
      "landingContactsPerRep":1,
      "externalLoadMethod":"bodyweight",
      "externalLoadDescription":"unsupported unilateral bodyweight repeated ankle-dominant contacts in place",
      "loadTracking":["side","contacts","cadence","amplitude","contact_quality","surface"]
    }'::JSONB,
    '{
      "localMuscleFatigue":58,
      "gripFatigue":1,
      "technicalFatigueSensitivity":60,
      "impactAccumulation":58,
      "recoveryHours":36,
      "primaryFatigueSites":["foot","calf","Achilles_tendon","lateral_hip"],
      "stopBefore":["contact_loud_or_slow","heel_slam","landing_location_drifts","knee_or_pelvis_drift","symptom"]
    }'::JSONB,
    '{
      "trainingStimuli":["unilateral_ankle_spring","stationary_contact_rhythm","foot_ankle_tolerance"],
      "stimulusDose":{"primary":"quality_contacts_per_side","fatigueCeiling":"low_to_moderate"},
      "weeklyExposure":{"typical":1,"maximumWithoutReview":3},
      "prerequisites":["repeatable_supported_variant","safe_unsupported_single_leg_stance"],
      "completionCriteria":["quiet_repeatable_contacts","foot_returns_under_hip","controlled_knee_pelvis_and_trunk"],
      "sequenceRules":["before_traveling_variants","count_all_contacts"],
      "pairingCompatibility":{"preferred":["sprint_or_jump_preparation"],"avoid":["post_fatigue_impact","high_density_circuit"]},
      "uncertaintyPolicy":{"landing_location_or_alignment_fails":"use_supported_variant","symptom":"stop"},
      "cumulativeBudget":{"technicalSensitivity":60,"impact":58,"calfAchilles":58}
    }'::JSONB
  ),
  (
    'single-leg-pogo',
    'linear-forward-traveling',
    'Linear Forward-Traveling Single-Leg Pogo',
    ARRAY['unilateral','unsupported','linear_forward','low_amplitude','repeated_contacts']::TEXT[],
    58, 64, 50, 58, 5, 62,
    '{
      "selectable":true,
      "support":"none",
      "direction":"linear_forward",
      "amplitude":"low_to_moderate",
      "action":"ankle_dominant_repeated_hops",
      "laneMeters":{"minimum":5,"target":8,"maximum":12},
      "terminalStickBetweenContacts":false,
      "finish":"controlled_runout_or_declared_final_stick_after_last_contact",
      "side":"declared_and_recorded"
    }'::JSONB,
    '{
      "gripDemand":1,
      "spinalLoading":20,
      "eccentricStress":64,
      "landingContactsPerRep":1,
      "externalLoadMethod":"bodyweight",
      "externalLoadDescription":"unsupported unilateral repeated ankle-dominant contacts traveling forward",
      "loadTracking":["side","contacts","distance_meters","cadence","amplitude","contact_quality","surface"]
    }'::JSONB,
    '{
      "localMuscleFatigue":66,
      "gripFatigue":1,
      "technicalFatigueSensitivity":70,
      "impactAccumulation":68,
      "recoveryHours":42,
      "primaryFatigueSites":["foot","calf","Achilles_tendon","lateral_hip","hamstrings"],
      "stopBefore":["overstriding","contact_loud_or_slow","heel_slam","lane_or_posture_drift","symptom"]
    }'::JSONB,
    '{
      "trainingStimuli":["unilateral_linear_ankle_spring","forward_contact_rhythm","directional_elastic_control"],
      "stimulusDose":{"primary":"quality_contacts_and_distance_per_side","fatigueCeiling":"low"},
      "weeklyExposure":{"typical":1,"maximumWithoutReview":2},
      "prerequisites":["repeatable_stationary_unsupported_variant","safe_lane_and_runout"],
      "completionCriteria":["quiet_contacts","controlled_forward_projection","lane_and_posture_preserved","safe_finish"],
      "sequenceRules":["fresh_elastic_output","before_sprint_or_strength_fatigue","count_all_contacts"],
      "pairingCompatibility":{"preferred":["acceleration_mechanics","low_volume_sprint_preparation"],"avoid":["post_fatigue_impact","crowded_lane"]},
      "uncertaintyPolicy":{"travel_control_fails":"return_stationary","symptom":"stop"},
      "cumulativeBudget":{"technicalSensitivity":70,"impact":68,"calfAchilles":66,"hamstring":26}
    }'::JSONB
  ),
  (
    'single-leg-pogo',
    'lateral-line',
    'Lateral Line Single-Leg Pogo',
    ARRAY['unilateral','unsupported','lateral_line','low_amplitude','repeated_contacts']::TEXT[],
    62, 66, 55, 62, 5, 64,
    '{
      "selectable":true,
      "support":"none",
      "direction":"lateral_across_visible_line",
      "amplitude":"low",
      "action":"ankle_dominant_repeated_hops",
      "lineClearance":"small_repeatable",
      "terminalStickBetweenContacts":false,
      "finish":"controlled_final_contact_after_declared_last_repetition",
      "side":"declared_and_recorded"
    }'::JSONB,
    '{
      "gripDemand":1,
      "spinalLoading":20,
      "eccentricStress":66,
      "landingContactsPerRep":1,
      "externalLoadMethod":"bodyweight",
      "externalLoadDescription":"unsupported unilateral repeated low-amplitude contacts laterally across a line",
      "loadTracking":["side","contacts","line_clearance","cadence","contact_quality","surface"]
    }'::JSONB,
    '{
      "localMuscleFatigue":68,
      "gripFatigue":1,
      "technicalFatigueSensitivity":74,
      "impactAccumulation":70,
      "recoveryHours":42,
      "primaryFatigueSites":["foot","calf","Achilles_tendon","lateral_hip","adductors"],
      "stopBefore":["line_clearance_or_rhythm_changes","contact_loud_or_slow","knee_or_pelvis_drift","uncontrolled_final_contact","symptom"]
    }'::JSONB,
    '{
      "trainingStimuli":["unilateral_lateral_ankle_spring","frontal_plane_contact_control","foot_ankle_tolerance"],
      "stimulusDose":{"primary":"quality_lateral_contacts_per_side","fatigueCeiling":"low"},
      "weeklyExposure":{"typical":1,"maximumWithoutReview":2},
      "prerequisites":["repeatable_stationary_unsupported_variant","visible_line","controlled_lateral_single_leg_contact"],
      "completionCriteria":["small_repeatable_line_clearance","quiet_contacts","knee_pelvis_and_trunk_control","safe_finish"],
      "sequenceRules":["fresh_elastic_or_landing_preparation","count_all_contacts"],
      "pairingCompatibility":{"preferred":["lateral_landing_preparation","change_of_direction_preparation"],"avoid":["post_fatigue_lateral_volume","crowded_station"]},
      "uncertaintyPolicy":{"lateral_control_fails":"return_stationary_or_supported","symptom":"stop"},
      "cumulativeBudget":{"technicalSensitivity":74,"impact":70,"calfAchilles":68,"adductor":32}
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
    'difficultyModel',
      'max_exercise_complexity_physical_difficulty'
  ),
  seed.requirements_json,
  'review',
  seed.load_profile_json,
  seed.fatigue_profile_json,
  seed.programming_profile_json
FROM reactive_variant_seed seed
JOIN coaching.exercise_definition_v1 definition
  ON definition.facility_id = 1
 AND definition.slug = seed.slug
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

CREATE TEMP TABLE reactive_profile_seed (
  slug TEXT NOT NULL,
  variant_key TEXT NOT NULL,
  profile_key TEXT NOT NULL,
  phase_key TEXT NOT NULL,
  role TEXT NOT NULL,
  purpose TEXT NOT NULL,
  suitability SMALLINT NOT NULL,
  alignment SMALLINT NOT NULL,
  dosage_json JSONB NOT NULL,
  quality_gate TEXT NOT NULL,
  stop_rules TEXT[] NOT NULL,
  expected_adaptation TEXT NOT NULL,
  equipment_required TEXT[] NOT NULL,
  PRIMARY KEY (slug, variant_key, profile_key)
);

INSERT INTO reactive_profile_seed VALUES
  (
    'snap-down-to-stick',
    'bilateral-tall-reach-stick',
    'movement-control',
    'movement_intelligence',
    'primary',
    'Learn a rapid tall-to-athletic bilateral descent and stable no-rebound finish with exact stance, depth, and hold criteria.',
    96, 95,
    '{"sets":{"minimum":1,"target":2,"maximum":3},"repetitions":{"minimum":3,"target":4,"maximum":5},"stickSeconds":2,"restSeconds":{"minimum":30,"target":45,"maximum":75},"fullResetBetweenReps":true,"stopAtTechnicalRir":3}'::JSONB,
    'Every counted repetition has a rapid but controlled descent, whole-foot pressure, aligned knees, organized trunk, no rebound or extra step, and a two-second stick.',
    ARRAY['pain_or_giving_way','dizziness_or_neurologic_symptom','uncontrolled_descent','loud_or_unstable_finish','knee_or_trunk_collapse','rebound_or_extra_step','breath_holding']::TEXT[],
    'Repeatable rapid bilateral organization into an athletic landing shape without flight.',
    ARRAY['none']::TEXT[]
  ),
  (
    'snap-down-to-stick',
    'bilateral-tall-reach-stick',
    'landing-preparation',
    'prepare_and_access',
    'secondary',
    'Use a very small number of crisp snap-downs to rehearse the landing shape required by later jump or deceleration work.',
    90, 92,
    '{"sets":1,"repetitions":{"minimum":2,"target":3,"maximum":4},"stickSeconds":2,"restSeconds":{"minimum":20,"target":30,"maximum":60},"fullResetBetweenReps":true,"stopAtTechnicalRir":4}'::JSONB,
    'The final repetition is as fast, quiet, aligned, and stable as the first and does not create fatigue before the priority task.',
    ARRAY['any_symptom','finish_quality_worsens','descent_slows','extra_step_or_rebound','breathing_not_recovered']::TEXT[],
    'Low-fatigue rehearsal of a bilateral athletic landing position.',
    ARRAY['none']::TEXT[]
  ),
  (
    'mirror-shuffle',
    'partner-lateral-leader-follower',
    'reactive-learning',
    'movement_intelligence',
    'primary',
    'Develop live partner cue recognition and accurate lateral shuffle responses at a speed that preserves spacing, posture, and braking.',
    96, 94,
    '{"roundsPerRole":{"minimum":2,"target":3,"maximum":4},"workSeconds":{"minimum":6,"target":10,"maximum":12},"restSeconds":{"minimum":45,"target":60,"maximum":90},"accuracyTargetPercent":90,"roleSwitchEveryRound":true,"stopAtTechnicalRir":4}'::JSONB,
    'At least ninety percent of responses follow real leader motion with no repeated guessing, crossed feet, boundary loss, unsafe spacing, collision risk, or uncontrolled stop.',
    ARRAY['pain_or_limp','dizziness_or_panic','collision_or_near_collision','accuracy_below_target','repeated_false_start','feet_cross','boundary_or_posture_loss','braking_degrades']::TEXT[],
    'Perception-action coupling and controlled lateral response to live body movement.',
    ARRAY['cones','partner']::TEXT[]
  ),
  (
    'mirror-shuffle',
    'partner-lateral-leader-follower',
    'reactive-output',
    'output',
    'secondary',
    'Use short faster leader-follower rounds only after accurate lower-speed rounds remain safe and mechanically repeatable.',
    84, 88,
    '{"roundsPerRole":{"minimum":2,"target":3,"maximum":4},"workSeconds":{"minimum":5,"target":8,"maximum":10},"restSeconds":{"minimum":75,"target":90,"maximum":150},"accuracyTargetPercent":85,"leaderSpeed":"high_but_controllable","stopAtTechnicalRir":4}'::JSONB,
    'Faster rounds retain at least eighty-five percent correct reads, safe partner spacing, uncrossed feet, controlled brakes, and full recovery before the next round.',
    ARRAY['any_symptom','collision_risk','accuracy_below_target','guessing','spacing_or_boundary_loss','braking_or_posture_change','fatigue']::TEXT[],
    'Faster live-cue lateral response without sacrificing accuracy or braking.',
    ARRAY['cones','partner']::TEXT[]
  ),
  (
    'sprint-to-stick-deceleration',
    'five-yard-planned-stick',
    'braking-learning',
    'movement_intelligence',
    'primary',
    'Learn the exact five-yard approach, braking-zone timing, linear foot placement, and bilateral stick at submaximal entry intent.',
    94, 94,
    '{"sets":{"minimum":2,"target":3,"maximum":4},"repetitionsPerSet":1,"entryIntentPercent":{"minimum":50,"target":65,"maximum":75},"restSeconds":{"minimum":60,"target":90,"maximum":150},"stickSeconds":2,"stopAtTechnicalRir":4}'::JSONB,
    'The athlete accelerates through five yards, begins braking under control, stops inside the declared zone without twisting or panic steps, and owns a two-second bilateral stick.',
    ARRAY['pain_or_limp','fear_or_giving_way','unsafe_lane','run_through','panic_stutter_steps','twisting_stop','knee_or_trunk_collapse','stick_failure']::TEXT[],
    'Controlled short acceleration-to-braking timing and a stable linear stop.',
    ARRAY['cones']::TEXT[]
  ),
  (
    'sprint-to-stick-deceleration',
    'five-yard-planned-stick',
    'short-output',
    'output',
    'secondary',
    'Express a faster five-yard acceleration and controlled stop after the teaching variant is repeatable and the lane and braking budget are appropriate.',
    88, 90,
    '{"sets":{"minimum":2,"target":3,"maximum":5},"repetitionsPerSet":1,"entryIntentPercent":{"minimum":70,"target":80,"maximum":85},"restSeconds":{"minimum":90,"target":120,"maximum":180},"stickSeconds":2,"stopAtTechnicalRir":4}'::JSONB,
    'Higher intent does not change braking onset, stop-zone accuracy, lower-limb alignment, trunk control, two-second stick, or confidence.',
    ARRAY['any_symptom','entry_speed_or_confidence_drops','run_through','panic_steps','twisting_stop','alignment_or_stick_failure','technical_rir_below_four']::TEXT[],
    'Short acceleration output paired with repeatable planned braking.',
    ARRAY['cones']::TEXT[]
  ),
  (
    'sprint-to-stick-deceleration',
    'seven-to-ten-yard-planned-stick',
    'braking-transition',
    'movement_intelligence',
    'conditional',
    'Introduce a seven-to-ten-yard approach at controlled intent only after five-yard stopping is repeatable and the longer lane and recovery are available.',
    80, 88,
    '{"sets":{"minimum":2,"target":3,"maximum":4},"repetitionsPerSet":1,"entryIntentPercent":{"minimum":60,"target":70,"maximum":80},"restSeconds":{"minimum":90,"target":120,"maximum":180},"stickSeconds":2,"stopAtTechnicalRir":4}'::JSONB,
    'The longer approach retains planned braking onset, stop-zone control, linear finish, stable alignment, and a two-second stick without extra steps.',
    ARRAY['any_symptom','five_yard_prerequisite_not_met','unsafe_lane_or_runout','run_through','panic_steps','twisting_stop','alignment_or_stick_failure']::TEXT[],
    'Controlled transition to a higher-entry-velocity braking task.',
    ARRAY['cones']::TEXT[]
  ),
  (
    'sprint-to-stick-deceleration',
    'seven-to-ten-yard-planned-stick',
    'high-entry-output',
    'output',
    'primary',
    'Train fresh higher-entry-velocity linear braking with strict stop-zone, posture, and recovery controls.',
    86, 92,
    '{"sets":{"minimum":2,"target":3,"maximum":4},"repetitionsPerSet":1,"entryIntentPercent":{"minimum":75,"target":85,"maximum":90},"restSeconds":{"minimum":120,"target":180,"maximum":240},"stickSeconds":2,"stopAtTechnicalRir":4}'::JSONB,
    'Every rep preserves approach intent and organized multi-step braking, finishes inside the zone without twisting, and holds a stable bilateral stick.',
    ARRAY['pain_or_limp','fear_or_giving_way','unsafe_lane','entry_speed_drops','run_through','panic_steps','twisting_stop','alignment_or_stick_failure','fatigue']::TEXT[],
    'Higher-entry-velocity acceleration and horizontal braking quality.',
    ARRAY['cones']::TEXT[]
  ),
  (
    'single-leg-pogo',
    'supported-stationary-low-amplitude',
    'contact-entry',
    'prepare_and_access',
    'primary',
    'Establish low-amplitude unilateral pogo rhythm with light balance support and exact contact-quality limits.',
    94, 94,
    '{"setsPerSide":{"minimum":1,"target":2,"maximum":3},"contactsPerSet":{"minimum":6,"target":8,"maximum":12},"restSeconds":{"minimum":45,"target":60,"maximum":90},"support":"light_balance_only","stopAtTechnicalRir":4}'::JSONB,
    'Support remains light; contacts are quick, quiet, under the hip, and repeatable while knee, pelvis, trunk, and breathing stay controlled.',
    ARRAY['pain_or_limp','support_becomes_upward_push','contact_loud_or_slow','heel_slam','knee_pelvis_or_trunk_drift','rhythm_loss','technical_rir_below_four']::TEXT[],
    'Supported unilateral foot-ankle spring rhythm and contact tolerance.',
    ARRAY['wall']::TEXT[]
  ),
  (
    'single-leg-pogo',
    'supported-stationary-low-amplitude',
    'resilience-entry',
    'resilience',
    'secondary',
    'Accumulate a modest number of supported unilateral contacts without allowing support or fatigue to hide contact-quality loss.',
    82, 88,
    '{"setsPerSide":{"minimum":2,"target":3,"maximum":3},"contactsPerSet":{"minimum":8,"target":10,"maximum":15},"restSeconds":{"minimum":60,"target":75,"maximum":120},"maximumContactsPerSide":45,"stopAtTechnicalRir":3}'::JSONB,
    'All counted contacts retain light support, quiet rhythm, controlled alignment, and the declared low amplitude on both sides.',
    ARRAY['any_symptom','support_push','contact_quality_change','side_difference_increases','alignment_or_rhythm_loss','technical_rir_below_three']::TEXT[],
    'Low-volume supported unilateral lower-leg contact capacity.',
    ARRAY['wall']::TEXT[]
  ),
  (
    'single-leg-pogo',
    'stationary-low-amplitude',
    'elastic-preparation',
    'prepare_and_access',
    'primary',
    'Use low-volume unsupported stationary contacts to prepare unilateral ankle spring and expose side-to-side contact-quality differences.',
    92, 92,
    '{"setsPerSide":{"minimum":1,"target":2,"maximum":3},"contactsPerSet":{"minimum":6,"target":10,"maximum":15},"restSeconds":{"minimum":60,"target":75,"maximum":120},"stopAtTechnicalRir":4}'::JSONB,
    'The foot returns under the hip with quick quiet contacts while the knee, pelvis, trunk, amplitude, rhythm, and breathing remain repeatable.',
    ARRAY['pain_or_limp','contact_loud_or_slow','heel_slam','landing_location_drift','knee_pelvis_or_trunk_change','rhythm_loss','technical_rir_below_four']::TEXT[],
    'Unsupported stationary unilateral elastic contact preparation.',
    ARRAY['none']::TEXT[]
  ),
  (
    'single-leg-pogo',
    'stationary-low-amplitude',
    'elastic-output',
    'output',
    'secondary',
    'Use crisp unsupported stationary contacts as low-volume elastic output only when both sides retain the declared rhythm and alignment.',
    84, 88,
    '{"setsPerSide":{"minimum":2,"target":3,"maximum":4},"contactsPerSet":{"minimum":6,"target":10,"maximum":12},"restSeconds":{"minimum":75,"target":90,"maximum":150},"maximumContactsPerSide":48,"stopAtTechnicalRir":4}'::JSONB,
    'Contact time, sound, amplitude, landing location, posture, and side control remain stable through every set.',
    ARRAY['any_symptom','contact_quality_or_height_changes','side_difference_increases','alignment_or_rhythm_loss','technical_rir_below_four']::TEXT[],
    'Fresh unilateral ankle-dominant elastic output in place.',
    ARRAY['none']::TEXT[]
  ),
  (
    'single-leg-pogo',
    'linear-forward-traveling',
    'linear-elastic-output',
    'output',
    'primary',
    'Train low-volume forward-traveling unilateral elastic contacts after stationary control is repeatable.',
    88, 92,
    '{"setsPerSide":{"minimum":2,"target":3,"maximum":4},"contactsPerSet":{"minimum":5,"target":8,"maximum":10},"distanceMeters":{"minimum":5,"target":8,"maximum":12},"restSeconds":{"minimum":90,"target":120,"maximum":180},"stopAtTechnicalRir":4}'::JSONB,
    'Forward projection stays small and repeatable; contacts remain quick and quiet, the lane and posture stay controlled, and the finish is safe.',
    ARRAY['pain_or_limp','overstriding','contact_loud_or_slow','heel_slam','lane_or_posture_drift','uncontrolled_finish','technical_rir_below_four']::TEXT[],
    'Forward-traveling unilateral elastic rhythm and landing-location control.',
    ARRAY['none']::TEXT[]
  ),
  (
    'single-leg-pogo',
    'linear-forward-traveling',
    'sprint-preparation',
    'prepare_and_access',
    'secondary',
    'Use a shorter forward pogo exposure before acceleration work only when it sharpens rather than fatigues contact quality.',
    82, 86,
    '{"setsPerSide":{"minimum":1,"target":2,"maximum":2},"contactsPerSet":{"minimum":4,"target":6,"maximum":8},"distanceMeters":{"minimum":4,"target":6,"maximum":8},"restSeconds":{"minimum":60,"target":90,"maximum":150},"stopAtTechnicalRir":5}'::JSONB,
    'The final contact is as quick, quiet, aligned, and directionally controlled as the first, with breathing recovered before the priority sprint.',
    ARRAY['any_symptom','contact_or_direction_quality_worsens','fatigue_or_breathing_not_recovered','uncontrolled_finish']::TEXT[],
    'Low-fatigue forward elastic preparation without reducing sprint quality.',
    ARRAY['none']::TEXT[]
  ),
  (
    'single-leg-pogo',
    'lateral-line',
    'lateral-contact-learning',
    'movement_intelligence',
    'primary',
    'Learn small repeatable lateral line crossings on one leg with strict landing-location, knee, pelvis, and contact-quality limits.',
    92, 92,
    '{"setsPerSide":{"minimum":2,"target":3,"maximum":3},"contactsPerSet":{"minimum":6,"target":8,"maximum":12},"restSeconds":{"minimum":75,"target":90,"maximum":150},"lineClearance":"small_repeatable","stopAtTechnicalRir":4}'::JSONB,
    'Every contact clears the same small line distance and remains quick, quiet, aligned, and controlled without accumulating lateral drift.',
    ARRAY['pain_or_limp','contact_loud_or_slow','line_clearance_changes','knee_pelvis_or_trunk_drift','rhythm_loss','uncontrolled_finish']::TEXT[],
    'Single-leg frontal-plane contact placement and elastic control.',
    ARRAY['line_tape']::TEXT[]
  ),
  (
    'single-leg-pogo',
    'lateral-line',
    'lateral-elastic-output',
    'output',
    'conditional',
    'Use faster lateral-line contacts only after the learning profile is repeatable and the lateral-impact budget is appropriate.',
    80, 86,
    '{"setsPerSide":{"minimum":2,"target":3,"maximum":4},"contactsPerSet":{"minimum":6,"target":10,"maximum":12},"restSeconds":{"minimum":90,"target":120,"maximum":180},"maximumContactsPerSide":48,"stopAtTechnicalRir":4}'::JSONB,
    'Higher cadence preserves line clearance, contact sound and time, knee and pelvic control, rhythm, and a safe final contact.',
    ARRAY['any_symptom','contact_or_line_quality_changes','alignment_or_rhythm_loss','side_difference_increases','technical_rir_below_four']::TEXT[],
    'Faster unilateral lateral elastic contacts with controlled frontal-plane placement.',
    ARRAY['line_tape']::TEXT[]
  );

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
  CASE profile.slug
    WHEN 'snap-down-to-stick' THEN
      '{"landingShape":94,"rapidOrganization":90,"power":18,"impactCost":4,"fatigueCost":12}'::JSONB
    WHEN 'mirror-shuffle' THEN
      '{"perceptionAction":96,"lateralResponse":90,"braking":76,"power":46,"fatigueCost":44}'::JSONB
    WHEN 'sprint-to-stick-deceleration' THEN
      jsonb_build_object(
        'acceleration', 82,
        'horizontalBraking', 96,
        'linearStopControl', 94,
        'power', CASE
          WHEN profile.variant_key = 'seven-to-ten-yard-planned-stick'
            THEN 82 ELSE 68 END,
        'fatigueCost', CASE
          WHEN profile.variant_key = 'seven-to-ten-yard-planned-stick'
            THEN 62 ELSE 48 END
      )
    ELSE
      jsonb_build_object(
        'unilateralElasticity', 94,
        'footAnkleControl', 90,
        'directionalControl',
          CASE
            WHEN profile.variant_key IN (
              'linear-forward-traveling',
              'lateral-line'
            ) THEN 88 ELSE 54 END,
        'power', 62,
        'fatigueCost',
          CASE
            WHEN profile.variant_key =
              'supported-stationary-low-amplitude' THEN 46
            WHEN profile.variant_key = 'stationary-low-amplitude' THEN 58
            ELSE 68
          END
      )
  END,
  profile.dosage_json,
  profile.quality_gate,
  profile.stop_rules,
  CASE profile.slug
    WHEN 'snap-down-to-stick' THEN
      'Inspect floor and overhead space; declare stance, arm start, depth, repetitions, and stick time. Observe descent speed, feet, knees, hips, trunk, finish, breath, and full reset.'
    WHEN 'mirror-shuffle' THEN
      'Inspect and mark the lane; match partners and declare roles, legal lateral movement, speed, spacing, round time, accuracy target, role switch, and stop signal. Observe guessing, feet, braking, and collision risk.'
    WHEN 'sprint-to-stick-deceleration' THEN
      'Inspect and mark start, exact approach, braking zone, finish, and run-out. Declare intent, repetitions, rest, and stick time. Observe acceleration, braking onset and steps, alignment, stop location, and confidence.'
    ELSE
      'Inspect surface and lane; declare side, support, direction, amplitude, cadence, contacts, finish, and rest. Observe contact sound and time, heel, foot location, knee, pelvis, trunk, rhythm, side difference, and symptoms.'
  END,
  CASE profile.slug
    WHEN 'snap-down-to-stick' THEN
      'Stand tall, snap down into the declared stance, land or settle through the whole foot, align the knees, freeze for two seconds, then reset. Stop before the finish changes.'
    WHEN 'mirror-shuffle' THEN
      'Face your partner, wait for real movement, mirror laterally without crossing your feet, keep safe space, control each stop, and reset before the next round.'
    WHEN 'sprint-to-stick-deceleration' THEN
      'Accelerate through the exact distance, brake early inside the marked zone, stay linear, finish on two feet, and hold for two seconds. Use the run-out if the stop is not safe.'
    ELSE
      'Use the declared leg and direction. Stay tall, make quick quiet low hops, return the foot to the target, keep the knee and pelvis controlled, and stop before rhythm or contact changes.'
  END,
  profile.expected_adaptation,
  profile.equipment_required,
  CASE profile.slug
    WHEN 'snap-down-to-stick' THEN
      '{"stationFootprintMeters":{"length":2.0,"width":2.0},"athletesPerStation":1,"setupSeconds":20,"transitionSeconds":15,"overheadClearanceRequired":true,"safeExit":"stand_or_step_out_after_owned_stick"}'::JSONB
    WHEN 'mirror-shuffle' THEN
      '{"stationFootprintMeters":{"length":7.0,"width":5.0},"athletesPerStation":2,"setupSeconds":45,"transitionSeconds":20,"matchedPartnerRequired":true,"separateLaneRequired":true,"safeExit":"stop_signal_then_both_partners_hold_position"}'::JSONB
    WHEN 'sprint-to-stick-deceleration' THEN
      jsonb_build_object(
        'stationFootprintMeters',
          jsonb_build_object(
            'length',
              CASE
                WHEN profile.variant_key =
                  'seven-to-ten-yard-planned-stick' THEN 24 ELSE 18 END,
            'width', 3.0
          ),
        'athletesPerLane', 1,
        'setupSeconds', 60,
        'transitionSeconds', 20,
        'clearRunOutRequired', TRUE,
        'separateReturnPathRequired', TRUE
      )
    ELSE
      jsonb_build_object(
        'stationFootprintMeters',
          jsonb_build_object(
            'length',
              CASE
                WHEN profile.variant_key =
                  'linear-forward-traveling' THEN 15 ELSE 3 END,
            'width', 3.0
          ),
        'athletesPerStation', 1,
        'setupSeconds', 30,
        'transitionSeconds', 20,
        'clearRunOutRequired',
          profile.variant_key = 'linear-forward-traveling',
        'stableSupportRequired',
          profile.variant_key = 'supported-stationary-low-amplitude'
      )
  END,
  '{}'::UUID[],
  'review',
  jsonb_build_object(
    'setupSeconds',
      CASE
        WHEN profile.slug = 'sprint-to-stick-deceleration' THEN 60
        WHEN profile.slug = 'mirror-shuffle' THEN 45
        ELSE 30
      END,
    'workDose', profile.dosage_json,
    'transitionSeconds', 20,
    'durationFormula',
      CASE
        WHEN profile.slug = 'mirror-shuffle'
          THEN 'setup + rounds_per_role * two_roles * work + rests + transitions'
        WHEN profile.slug = 'sprint-to-stick-deceleration'
          THEN 'setup + repetitions * attempt_time + inter_rep_rest + walk_back'
        WHEN profile.slug = 'single-leg-pogo'
          THEN 'setup + sets_per_side * contacts_or_time + side_transitions + interset_rest'
        ELSE 'setup + sets * repetitions * rep_and_stick_time + interset_rest'
      END
  ),
  CASE profile.slug
    WHEN 'snap-down-to-stick' THEN
      '{"progressionOrder":["cleaner_quieter_finish","faster_owned_descent","repeatable_depth","additional_repetition_within_cap"],"regressionOrder":["slower_drop_squat","shallower_depth","hands_at_chest","fewer_repetitions"],"neverAutoScale":["pain","flight","rebound","unilateral_finish","box_or_drop_height","fatigue_density"]}'::JSONB
    WHEN 'mirror-shuffle' THEN
      '{"progressionOrder":["accuracy_and_spacing","leader_speed","direction_change_frequency","slightly_longer_round_within_cap"],"regressionOrder":["preplanned_walkthrough","slower_leader","narrower_lane","shorter_round"],"neverAutoScale":["pain","collision_risk","crossover","sprint_exit","contact","ball_or_load"]}'::JSONB
    WHEN 'sprint-to-stick-deceleration' THEN
      '{"progressionOrder":["stop_quality","entry_intent","exact_five_yard_variant","seven_to_ten_yard_variant","tighter_zone_only_after_review"],"regressionOrder":["lower_intent","shorter_approach","longer_braking_zone","walkthrough","fewer_repetitions"],"neverAutoScale":["pain_or_fear","reactive_cue","turn_or_cut","reacceleration","loaded_or_resisted_entry"]}'::JSONB
    ELSE
      '{"progressionOrder":["contact_quality","supported_stationary","unsupported_stationary","direction_matching_goal","contacts_within_cap"],"regressionOrder":["fewer_contacts","lower_amplitude","stationary","stable_hand_support","bilateral_pogo"],"neverAutoScale":["pain","terminal_stick","hurdle_or_box","bound_or_high_knee","external_load","reactive_cue"]}'::JSONB
  END,
  CASE profile.slug
    WHEN 'snap-down-to-stick' THEN
      '{"record":["variant_key","stance_width","arm_start","depth","repetitions","stick_seconds","quality_pass","contact_sound","faults","symptoms","stop_reason"],"repStandard":"One rapid tall-to-athletic descent followed by an owned no-rebound stick.","failureRule":"A rebound, extra step, alignment change, symptom, or failed hold ends the count."}'::JSONB
    WHEN 'mirror-shuffle' THEN
      '{"record":["variant_key","lane_width","spacing","leader_speed","role","round_seconds","correct_reads","false_starts","boundary_errors","quality_pass","symptoms","stop_reason"],"roundStandard":"Follower waits for live partner motion and mirrors laterally with safe spacing and controlled stops.","failureRule":"Guessing, crossed feet, collision risk, boundary loss, symptom, or braking failure ends the round."}'::JSONB
    WHEN 'sprint-to-stick-deceleration' THEN
      '{"record":["variant_key","approach_yards","entry_intent","braking_zone_yards","start_stance","stop_location","hard_braking_steps","extra_steps","stick_seconds","quality_pass","symptoms","stop_reason"],"repStandard":"Exact linear approach followed by planned braking and an owned bilateral stick inside the zone.","failureRule":"Run-through, twisting, panic steps, symptom, unsafe lane, or failed stick ends the attempt."}'::JSONB
    ELSE
      '{"record":["variant_key","side","support","direction","amplitude","cadence","target_contacts","actual_contacts","distance","contact_quality","quality_pass","symptoms","stop_reason"],"contactStandard":"Each hop is unilateral, low-amplitude, quick, quiet, and lands at the declared target without a stick between contacts.","failureRule":"Symptom, loud or slow contact, heel slam, alignment drift, rhythm loss, or direction loss ends the set."}'::JSONB
  END,
  CASE profile.slug
    WHEN 'snap-down-to-stick' THEN
      '{"athletePrompt":"Report pain, giving way, dizziness, fear, a rebound, or an extra step; do not hide a failed stick.","coachPrompt":"Record actual quality reps and the first fault; never add a box, flight, rebound, or fatigue density to this variant.","accessibilityPrompt":"Offer slower descent, shallower depth, hands at chest, visual marks, fewer reps, or longer reset."}'::JSONB
    WHEN 'mirror-shuffle' THEN
      '{"athletePrompt":"Report pain, dizziness, panic, uncertainty, or unsafe spacing; wait for real movement instead of guessing.","coachPrompt":"Record accuracy, false starts, boundary errors, spacing, and stop reason; speed never overrides collision control.","accessibilityPrompt":"Offer a slower leader, shorter round, smaller lane, more spacing, high-contrast marks, or a preplanned walkthrough."}'::JSONB
    WHEN 'sprint-to-stick-deceleration' THEN
      '{"athletePrompt":"Report pain, pulling, giving way, fear, or inability to stop; use the run-out instead of forcing an unsafe stick.","coachPrompt":"Record distance, intent, stop location, hard braking steps, extra steps, and why the rep ended.","accessibilityPrompt":"Offer lower intent, shorter approach, longer braking zone, walkthrough speed, fewer reps, or more recovery."}'::JSONB
    ELSE
      '{"athletePrompt":"Report foot, ankle, Achilles, calf, knee, hip, or back symptoms and any side that becomes loud, slow, unstable, or fearful.","coachPrompt":"Record actual contacts and the first quality failure; never add contacts solely to finish the prescription.","accessibilityPrompt":"Offer stable hand support, stationary direction, lower amplitude, fewer contacts, slower cadence, or a bilateral pogo substitution."}'::JSONB
  END
FROM reactive_profile_seed profile
JOIN coaching.exercise_definition_v1 definition
  ON definition.facility_id = 1
 AND definition.slug = profile.slug
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

UPDATE coaching.exercise_section_evidence_v1 evidence
SET review_status = 'superseded',
    reviewer_user_id = NULL,
    reviewed_at = NULL,
    updated_at = now()
FROM coaching.exercise_definition_v1 definition
WHERE definition.id = evidence.definition_id
  AND definition.facility_id = 1
  AND definition.slug IN (
    'snap-down-to-stick',
    'mirror-shuffle',
    'sprint-to-stick-deceleration',
    'single-leg-pogo'
  )
  AND evidence.reviewed_card_version <> 2
  AND evidence.review_status = 'candidate';

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
  claim.key,
  CASE
    WHEN claim.key = 'media' THEN
      'https://support.google.com/youtube/answer/171780?expand=PrivacyEnhancedMode&hl=en'
    WHEN claim.key IN (
      'anatomy',
      'biomechanics',
      'difficulty',
      'load_fatigue_recovery',
      'programming'
    ) THEN seed.secondary_source ->> 'url'
    ELSE seed.primary_source ->> 'url'
  END,
  CASE
    WHEN claim.key = 'media' THEN 'Embed videos and playlists'
    WHEN claim.key IN (
      'anatomy',
      'biomechanics',
      'difficulty',
      'load_fatigue_recovery',
      'programming'
    ) THEN seed.secondary_source ->> 'title'
    ELSE seed.primary_source ->> 'title'
  END,
  CASE
    WHEN claim.key = 'media' THEN 'YouTube Help'
    WHEN claim.key IN (
      'anatomy',
      'biomechanics',
      'difficulty',
      'load_fatigue_recovery',
      'programming'
    ) THEN seed.secondary_source ->> 'publisher'
    ELSE seed.primary_source ->> 'publisher'
  END,
  CASE
    WHEN claim.key = 'media' THEN 'manufacturer_instruction'
    WHEN claim.key IN (
      'anatomy',
      'biomechanics',
      'difficulty',
      'load_fatigue_recovery',
      'programming'
    ) THEN seed.secondary_source ->> 'kind'
    ELSE seed.primary_source ->> 'kind'
  END,
  claim.value,
  CASE
    WHEN claim.key = 'media' THEN 82
    WHEN claim.key IN (
      'anatomy',
      'biomechanics',
      'difficulty',
      'load_fatigue_recovery',
      'programming'
    ) THEN (seed.secondary_source ->> 'quality')::SMALLINT
    ELSE (seed.primary_source ->> 'quality')::SMALLINT
  END,
  'candidate',
  NULL,
  NULL
FROM reactive_card_seed seed
JOIN coaching.exercise_definition_v1 definition
  ON definition.facility_id = 1
 AND definition.slug = seed.slug
CROSS JOIN LATERAL jsonb_each(seed.evidence_claims) claim
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
    updated_at = now()
FROM coaching.exercise_definition_v1 definition
WHERE definition.id = media.definition_id
  AND definition.facility_id = 1
  AND definition.slug IN (
    'snap-down-to-stick',
    'mirror-shuffle',
    'sprint-to-stick-deceleration',
    'single-leg-pogo'
  )
  AND media.reviewed_card_version <> 2
  AND media.review_status = 'candidate';

CREATE TEMP TABLE reactive_media_seed (
  slug TEXT NOT NULL,
  video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  channel_name TEXT NOT NULL,
  source_query TEXT NOT NULL,
  PRIMARY KEY (slug, video_id)
);

INSERT INTO reactive_media_seed VALUES
  ('snap-down-to-stick','UiMZXWq_ad4','Snap Down + Stick','Athletic Growth Lab','snap down to stick exercise'),
  ('snap-down-to-stick','a11nfa1O4tY','Snap Down & Stick','Alex Bunt','snap down to stick exercise'),
  ('snap-down-to-stick','LTsBb91VWzg','Snap Down Stick','WheelerHealthyU','snap down to stick exercise'),
  ('snap-down-to-stick','NaL3MlQLlz0','Snap Down and Stick','Nick Westcott','snap down to stick exercise'),
  ('mirror-shuffle','oXPagj--ejE','Partner Mirror (Shuffle)','Tinsley Performance','partner mirror shuffle drill'),
  ('mirror-shuffle','XPWv2pEnrpY','Partner Mirror Drill: Shuffle','N1 Motion','partner mirror shuffle drill'),
  ('mirror-shuffle','KlFU0pAGdgo','Shuffle Mirror Drill','Patrick Nolan','partner mirror shuffle drill'),
  ('mirror-shuffle','znHwPessi3Q','Side Shuffle Mirror Drill','Bullett Performance Training','partner mirror shuffle drill'),
  ('sprint-to-stick-deceleration','me6P9C_OKLQ','5 yd acceleration / deceleration','Jason Raynor','5 yard acceleration deceleration stick drill'),
  ('sprint-to-stick-deceleration','_fyxBMgo7ZM','Sprint to Stick Deceleration Football Speed','TheSOApodcast !','sprint to stick deceleration drill'),
  ('sprint-to-stick-deceleration','WVmGIlxUMLU','Basic Acceleration to Deceleration drill','EARTHSTRONG TRAINING','acceleration deceleration stick drill'),
  ('sprint-to-stick-deceleration','iYnDMplt6qI','Acceleration/ Deceleration Drill with Speed','PhysioRun','acceleration deceleration stick drill'),
  ('single-leg-pogo','Yq75-6SUn7A','How To Do Single Leg Pogo Hops','Swift Movement Academy','single leg pogo hops exercise'),
  ('single-leg-pogo','346nxpp5ZtU','Single Leg Stationary Pogo Hop','N2AthleteX Performance Training','single leg pogo hops exercise'),
  ('single-leg-pogo','U12iOibPX98','Single Leg Pogo Jumps','RADCENTRE','single leg pogo hops exercise'),
  ('single-leg-pogo','MYnVANm8H9E','Single Leg Linear Pogo Hops','N2AthleteX Performance Training','single leg pogo hops exercise');

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
  'https://www.youtube.com/watch?v=' || media.video_id,
  'https://www.youtube-nocookie.com/embed/' || media.video_id,
  media.video_id,
  media.title,
  media.channel_name,
  'en',
  NULL,
  NULL,
  NULL,
  NULL,
  'healthy',
  'candidate',
  'manual_research',
  media.source_query,
  NULL,
  NULL,
  NULL,
  'YouTube oEmbed metadata returned successfully on 2026-07-26. Search-result appearance and oEmbed metadata do not establish embed playback, full-video viewing, exact variant matching, cue or safety quality, captions, accessibility, reviewer identity, or approval.'
FROM reactive_media_seed media
JOIN coaching.exercise_definition_v1 definition
  ON definition.facility_id = 1
 AND definition.slug = media.slug
ON CONFLICT (
  definition_id,
  reviewed_card_version,
  video_id
)
DO UPDATE SET
  url = EXCLUDED.url,
  embed_url = EXCLUDED.embed_url,
  title = EXCLUDED.title,
  channel_name = EXCLUDED.channel_name,
  language_code = EXCLUDED.language_code,
  captions_available = NULL,
  embedding_allowed = NULL,
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

UPDATE coaching.exercise_alternate_assessment_v1 alternate
SET review_status = 'superseded',
    reviewer_user_id = NULL,
    reviewed_at = NULL,
    updated_at = now()
FROM coaching.exercise_definition_v1 definition
WHERE definition.id = alternate.definition_id
  AND definition.facility_id = 1
  AND definition.slug IN (
    'snap-down-to-stick',
    'mirror-shuffle',
    'sprint-to-stick-deceleration',
    'single-leg-pogo'
  )
  AND alternate.reviewed_card_version <> 2
  AND alternate.review_status = 'candidate';

CREATE TEMP TABLE reactive_alternate_seed (
  slug TEXT NOT NULL,
  alternate_name TEXT NOT NULL,
  classification TEXT NOT NULL,
  rationale TEXT NOT NULL,
  dimensions JSONB NOT NULL,
  PRIMARY KEY (slug, alternate_name)
);

INSERT INTO reactive_alternate_seed VALUES
  ('snap-down-to-stick','Snap-Down to Athletic Stick','same_identity','Athletic names the canonical bilateral finish and adds no action.','{"nameOnly":true}'::JSONB),
  ('snap-down-to-stick','Snapdown Landing Stick','same_identity','Landing stick names the defining terminal hold and does not create a second exercise.','{"nameOnly":true}'::JSONB),
  ('snap-down-to-stick','Snap-Down to Stick Control Version','same_identity','Control is the canonical no-rebound delivery intent.','{"deliveryIntent":"control"}'::JSONB),
  ('snap-down-to-stick','Arms-at-Chest Snap-Down','modifier_annotation','Arm start changes cueing and momentum but preserves the rapid bilateral descent and stick.','{"armStart":"chest"}'::JSONB),
  ('snap-down-to-stick','Shallow Snap-Down to Stick','modifier_annotation','A shallower pain-free finish changes range and dose without adding an action.','{"depth":"shallower_owned"}'::JSONB),
  ('snap-down-to-stick','Drop Squat to Stick','new_definition','A deliberately slower preplanned descent removes the defining rapid snap and serves as a regression or substitution.','{"descentSpeed":"controlled_slow","reactiveSnap":false}'::JSONB),
  ('snap-down-to-stick','Snap-Down to Jump and Stick','new_definition','A takeoff and aerial phase add a jump after the snap-down.','{"flight":true,"sequence":["snap_down","jump","stick"]}'::JSONB),
  ('snap-down-to-stick','Snap-Down to Pogo Rebound','new_definition','A rebound replaces the static no-rebound finish.','{"terminalAction":"rebound"}'::JSONB),
  ('snap-down-to-stick','Single-Leg Snap-Down Stick','new_definition','A unilateral finish materially changes laterality, balance, loading, and consequence.','{"laterality":"unilateral"}'::JSONB),
  ('snap-down-to-stick','Box or Depth Snap-Down Stick','new_definition','External height or stepping from a box adds a flight or drop-height exposure absent from the canonical card.','{"externalHeight":true}'::JSONB),
  ('mirror-shuffle','Mirror Shuffle Drill','same_identity','Drill adds no action to the live partner lateral mirror task.','{"nameOnly":true}'::JSONB),
  ('mirror-shuffle','Partner Mirror Shuffle','same_identity','Partner names the live cue source already required by the identity.','{"nameOnly":true}'::JSONB),
  ('mirror-shuffle','Partner Mirror Shuffle Box','same_identity','A bounded box or lane is an exact setup for the same lateral leader-follower action.','{"boundaryShape":"box_or_lane"}'::JSONB),
  ('mirror-shuffle','Mirror Shuffle Lane Width or Round-Time Change','modifier_annotation','Lane width, partner spacing, speed, and round time scale the same task.','{"modifiers":["lane_width","spacing","leader_speed","round_time"]}'::JSONB),
  ('mirror-shuffle','Role-Switched Mirror Shuffle','modifier_annotation','Switching leader and follower is required delivery rotation, not a new exercise.','{"role":"leader_or_follower"}'::JSONB),
  ('mirror-shuffle','Lateral Shuffle Mechanics Walkthrough','new_definition','A preplanned solo or coach-led route removes live opponent perception-action coupling.','{"cue":"preplanned","partner":false}'::JSONB),
  ('mirror-shuffle','Partner Mirror Shuffle with Crossover','new_definition','A crossover changes footwork and rotational demands beyond the lateral-only contract.','{"footwork":"crossover"}'::JSONB),
  ('mirror-shuffle','Mirror Shuffle to Sprint Exit','new_definition','The added linear sprint exit changes sequence, space, speed, and finish.','{"terminalAction":"sprint_exit"}'::JSONB),
  ('mirror-shuffle','Partner Mirror Tag','new_definition','Tag contact and pursuit rules add collision and interaction constraints.','{"contact":"tag","task":"pursuit"}'::JSONB),
  ('mirror-shuffle','Ball, Resistance, Hop, Crawl, or Ladder Mirror','new_definition','Added implements, locomotor actions, or obstacles materially change the task and constraints.','{"addedConstraint":["ball","resistance","hop","crawl","ladder"]}'::JSONB),
  ('sprint-to-stick-deceleration','5-Yard Acceleration Decel Stick','same_identity','The five-yard source is an exact distance variant of the linear accelerate-brake-stick identity.','{"approachYards":5}'::JSONB),
  ('sprint-to-stick-deceleration','5-Yard Accel to Decel Stick','same_identity','Accel and decel abbreviate the same five-yard acceleration-to-braking action.','{"approachYards":5,"nameAbbreviation":true}'::JSONB),
  ('sprint-to-stick-deceleration','Five-Yard Planned Sprint-to-Stick','new_variant','The five-yard approach constrains achieved speed and braking demand while preserving the action.','{"approachYards":5}'::JSONB),
  ('sprint-to-stick-deceleration','Seven-to-Ten-Yard Planned Sprint-to-Stick','new_variant','A longer approach can raise entry velocity and braking demand while preserving a planned linear bilateral stick.','{"approachYards":[7,10]}'::JSONB),
  ('sprint-to-stick-deceleration','Entry Intent or Braking-Zone Change','modifier_annotation','Intent, braking-zone length, start stance, and stick duration scale a declared distance variant.','{"modifiers":["entry_intent","braking_zone","start_stance","stick_duration"]}'::JSONB),
  ('sprint-to-stick-deceleration','Sprint to Cut or Turn','new_definition','A directional turn or cut changes plane, foot strategy, and exit.','{"terminalAction":"cut_or_turn"}'::JSONB),
  ('sprint-to-stick-deceleration','Reactive Sprint-to-Stick','new_definition','An unpredictable cue adds decision demand and response timing.','{"cue":"reactive"}'::JSONB),
  ('sprint-to-stick-deceleration','Sprint-to-Stick-to-Reacceleration','new_definition','Reacceleration adds a second output phase after the stop.','{"terminalAction":"reacceleration"}'::JSONB),
  ('sprint-to-stick-deceleration','Backpedal-to-Sprint-to-Stick','new_definition','Backpedal entry adds a transition and different locomotor sequence.','{"entry":"backpedal_to_forward"}'::JSONB),
  ('sprint-to-stick-deceleration','Resisted or Partner-Pulled Sprint-to-Stick','new_definition','External resistance changes acceleration mechanics, loading, equipment, and safety.','{"externalResistance":true}'::JSONB),
  ('sprint-to-stick-deceleration','Run-Through Deceleration','new_definition','A run-through finish omits the defining bilateral static stick.','{"finish":"run_through"}'::JSONB),
  ('single-leg-pogo','Single-Leg Pogo in Place','same_identity','In place is the stationary exact variant of the canonical unilateral pogo action.','{"direction":"stationary"}'::JSONB),
  ('single-leg-pogo','Single-Leg Pogo Jumps','same_identity','Jumps pluralizes the repeated unilateral pogo action without adding a constraint.','{"nameOnly":true}'::JSONB),
  ('single-leg-pogo','Supported Stationary Single-Leg Pogo','new_variant','Light hand support reduces balance demand while preserving low-amplitude repeated unilateral contacts.','{"support":"stable_hand","direction":"stationary"}'::JSONB),
  ('single-leg-pogo','Unsupported Stationary Single-Leg Pogo','new_variant','Removing hand support raises unilateral control demand without adding travel.','{"support":"none_used","direction":"stationary"}'::JSONB),
  ('single-leg-pogo','Linear Forward-Traveling Single-Leg Pogo','new_variant','Forward travel changes landing location and projection while preserving repeated ankle-dominant contacts.','{"direction":"linear_forward"}'::JSONB),
  ('single-leg-pogo','Lateral Line Single-Leg Pogo','new_variant','Small lateral line crossings add frontal-plane landing-location demand while preserving repeated ankle-dominant contacts.','{"direction":"lateral_line"}'::JSONB),
  ('single-leg-pogo','Single-Leg Pogo Cadence, Amplitude, or Contact Change','modifier_annotation','Cadence, low amplitude, arm action, footwear, surface, and contact count scale a declared variant.','{"modifiers":["cadence","low_amplitude","arm_action","footwear","surface","contacts"]}'::JSONB),
  ('single-leg-pogo','Bilateral Pogo Jump','new_definition','Two-leg contacts change laterality, loading distribution, and balance demand.','{"laterality":"bilateral"}'::JSONB),
  ('single-leg-pogo','Single-Leg Pogo Hold-Stick','new_definition','A terminal hold or stick between sequences changes the continuous repeated-contact action.','{"terminalAction":"stick"}'::JSONB),
  ('single-leg-pogo','Single-Leg Hop-and-Stick','new_definition','Each higher-amplitude hop ends in a stabilization rather than an immediate pogo contact.','{"action":"hop_then_stick"}'::JSONB),
  ('single-leg-pogo','Single-Leg Bound or High-Knee Pogo','new_definition','Greater projection or a high-knee cycle changes amplitude, joint action, and sprint-drill intent.','{"action":"bound_or_high_knee_cycle"}'::JSONB),
  ('single-leg-pogo','Single-Leg Hurdle, Box, or Cone Pogo','new_definition','An obstacle changes clearance, consequence, space, and contact strategy.','{"obstacle":true}'::JSONB),
  ('single-leg-pogo','Loaded, Resisted, or Reactive Single-Leg Pogo','new_definition','External load, resistance, or an unpredictable cue changes force, decision, and safety constraints.','{"addedConstraint":["load","resistance","reactive_cue"]}'::JSONB),
  ('single-leg-pogo','Pogo-to-Sprint or Pogo-to-Jump Combination','new_definition','A linked sprint or jump adds a second action and sequence.','{"sequence":["pogo","sprint_or_jump"]}'::JSONB);

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
    WHEN alternate.classification = 'new_definition' THEN
      jsonb_build_object(
        'status', 'proposal_only',
        'humanReviewRequired', TRUE,
        'sourceCard', alternate.slug
      )
    ELSE NULL
  END,
  'candidate',
  NULL,
  NULL
FROM reactive_alternate_seed alternate
JOIN coaching.exercise_definition_v1 definition
  ON definition.facility_id = 1
 AND definition.slug = alternate.slug
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

CREATE TEMP TABLE reactive_edge_seed (
  slug TEXT NOT NULL,
  from_key TEXT NOT NULL,
  to_key TEXT NOT NULL,
  relationship TEXT NOT NULL,
  similarity_score SMALLINT NOT NULL,
  dimensions TEXT[] NOT NULL,
  reason TEXT NOT NULL,
  conditions_json JSONB NOT NULL,
  PRIMARY KEY (slug, from_key, to_key, relationship)
);

INSERT INTO reactive_edge_seed VALUES
  ('sprint-to-stick-deceleration','five-yard-planned-stick','seven-to-ten-yard-planned-stick','progression',90,ARRAY['speed','impact','complexity']::TEXT[],'A longer approach can raise achieved entry speed, braking force demand, consequence, and setup complexity while preserving the planned linear acceleration-to-bilateral-stick action.','{"requires":["repeatable_five_yard_stop","adequate_longer_lane_and_runout","full_recovery","no_current_symptoms"],"notAutomatic":true}'::JSONB),
  ('sprint-to-stick-deceleration','seven-to-ten-yard-planned-stick','five-yard-planned-stick','regression',97,ARRAY['speed','impact','complexity']::TEXT[],'A five-yard approach reduces achievable entry speed and braking demand while retaining the same planned linear accelerate-brake-stick sequence.','{"useWhen":["braking_onset_or_stop_quality_changes","lane_is_shorter","entry_speed_or_confidence_requires_reduction"]}'::JSONB),
  ('single-leg-pogo','supported-stationary-low-amplitude','stationary-low-amplitude','progression',92,ARRAY['stability','complexity']::TEXT[],'Removing light hand support raises unilateral balance and postural-control demand while preserving stationary low-amplitude repeated pogo contacts.','{"requires":["support_remains_light","repeatable_quiet_contacts","safe_support_nearby"],"notAutomatic":true}'::JSONB),
  ('single-leg-pogo','stationary-low-amplitude','supported-stationary-low-amplitude','regression',98,ARRAY['stability','complexity']::TEXT[],'Adding light stable hand support reduces balance demand while preserving the stationary unilateral ankle-dominant pogo action.','{"useWhen":["landing_location_or_alignment_drifts","balance_limits_contact_quality","confidence_requires_support"]}'::JSONB),
  ('single-leg-pogo','stationary-low-amplitude','linear-forward-traveling','progression',84,ARRAY['speed','impact','complexity','stability']::TEXT[],'Forward travel adds projection, landing-location, lane, and finish demands while preserving repeated unilateral ankle-dominant contacts.','{"requires":["repeatable_stationary_contacts","safe_lane_and_runout","matching_linear_goal"],"notAutomatic":true}'::JSONB),
  ('single-leg-pogo','linear-forward-traveling','stationary-low-amplitude','regression',95,ARRAY['speed','impact','complexity','stability']::TEXT[],'Returning to stationary contacts removes forward projection and lane control while retaining the core unilateral pogo action.','{"useWhen":["overstriding","lane_or_finish_control_changes","impact_or_space_requires_reduction"]}'::JSONB),
  ('single-leg-pogo','stationary-low-amplitude','lateral-line','progression',80,ARRAY['impact','complexity','stability']::TEXT[],'Small lateral line crossings add frontal-plane landing-location and side-to-side control demands while retaining low-amplitude unilateral pogo contacts.','{"requires":["repeatable_stationary_contacts","controlled_lateral_single_leg_contact","visible_line","matching_lateral_goal"],"notAutomatic":true}'::JSONB),
  ('single-leg-pogo','lateral-line','stationary-low-amplitude','regression',94,ARRAY['impact','complexity','stability']::TEXT[],'Removing the lateral line crossing reduces frontal-plane placement and control demand while retaining unilateral ankle-dominant contacts.','{"useWhen":["line_clearance_or_alignment_changes","lateral_control_or_space_requires_reduction"]}'::JSONB);

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
  edge.conditions_json,
  'review',
  NULL,
  NULL,
  NULL
FROM reactive_edge_seed edge
JOIN coaching.exercise_definition_v1 definition
  ON definition.facility_id = 1
 AND definition.slug = edge.slug
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

CREATE TEMP TABLE reactive_substitution_seed (
  source_slug TEXT NOT NULL,
  source_variant_key TEXT NOT NULL,
  target_slug TEXT NOT NULL,
  similarity_score SMALLINT NOT NULL,
  dimensions TEXT[] NOT NULL,
  reason TEXT NOT NULL,
  conditions_json JSONB NOT NULL,
  PRIMARY KEY (source_slug, source_variant_key, target_slug)
);

INSERT INTO reactive_substitution_seed VALUES
  ('snap-down-to-stick','bilateral-tall-reach-stick','drop-squat-to-stick',84,ARRAY['speed','impact','complexity']::TEXT[],'Drop Squat to Stick can preserve bilateral athletic-position and static-finish learning when a rapid snap-down is not controlled, but it removes the defining rapid descent.','{"useWhen":["rapid_descent_not_controlled","fear_or_coordination_requires_slower_entry"],"notEquivalentFor":["rapid_position_organization"]}'::JSONB),
  ('mirror-shuffle','partner-lateral-leader-follower','lateral-shuffle-walkthrough',70,ARRAY['speed','complexity','decision_demand']::TEXT[],'A preplanned Lateral Shuffle Walkthrough can preserve lateral footwork and braking practice when live partner cueing is not yet appropriate, but it removes perception-action coupling.','{"useWhen":["lateral_mechanics_or_cue_understanding_not_ready","no_matched_partner"],"notEquivalentFor":["live_opponent_read","reactive_decision"]}'::JSONB),
  ('sprint-to-stick-deceleration','five-yard-planned-stick','linear-deceleration-stop-eccentric-stick',76,ARRAY['speed','impact','complexity']::TEXT[],'A lower-speed linear deceleration stop can preserve braking-position practice when short acceleration entry is not appropriate, but it does not reproduce the exact five-yard acceleration exposure.','{"useWhen":["acceleration_entry_not_appropriate","braking_position_needs_lower_speed"],"notEquivalentFor":["five_yard_acceleration_to_braking_transition"]}'::JSONB),
  ('single-leg-pogo','supported-stationary-low-amplitude','pogo-jumps',66,ARRAY['stability','impact','complexity']::TEXT[],'A bilateral pogo can preserve low-amplitude ankle-spring practice when unilateral contact is not controlled, but it changes laterality and load distribution.','{"useWhen":["unilateral_contact_not_controlled","side_specific_loading_not_appropriate"],"notEquivalentFor":["unilateral_stiffness_or_side_comparison"]}'::JSONB);

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
  source_variant.id,
  target_variant.id,
  'lateral_substitution',
  substitution.similarity_score,
  substitution.dimensions,
  substitution.reason,
  substitution.conditions_json,
  'review',
  NULL,
  NULL,
  NULL
FROM reactive_substitution_seed substitution
JOIN coaching.exercise_definition_v1 source_definition
  ON source_definition.facility_id = 1
 AND source_definition.slug = substitution.source_slug
JOIN coaching.exercise_variant_v1 source_variant
  ON source_variant.definition_id = source_definition.id
 AND source_variant.variant_key = substitution.source_variant_key
JOIN LATERAL (
  SELECT variant.id
  FROM coaching.exercise_definition_v1 definition
  JOIN coaching.exercise_variant_v1 variant
    ON variant.definition_id = definition.id
  WHERE definition.facility_id = 1
    AND definition.slug = substitution.target_slug
    AND definition.status <> 'archived'
    AND variant.status <> 'archived'
  ORDER BY
    CASE variant.variant_key WHEN 'baseline' THEN 1 ELSE 2 END,
    variant.variant_key
  LIMIT 1
) target_variant ON TRUE
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
  'Independent calibration review is required; this migration does not approve the proposed exercise score.',
  NULL
FROM coaching.exercise_definition_v1 definition
JOIN coaching.exercise_variant_v1 variant
  ON variant.definition_id = definition.id
CROSS JOIN LATERAL (
  VALUES
    (
      'technicalComplexity',
      (variant.difficulty_json ->> 'technicalComplexity')::SMALLINT,
      CASE definition.slug
        WHEN 'snap-down-to-stick' THEN
          'Proposed from descent timing, arm and center-of-mass coordination, stance, depth, knee and trunk control, and no-rebound stick criteria.'
        WHEN 'mirror-shuffle' THEN
          'Proposed from live visual cue recognition, response inhibition, lateral footwork, partner spacing, braking, boundaries, and accuracy.'
        WHEN 'sprint-to-stick-deceleration' THEN
          'Proposed from start and distance setup, acceleration-to-braking transition, stop-zone targeting, linear alignment, and static finish.'
        ELSE
          'Proposed from unilateral support, direction, landing location, ankle-dominant rhythm, knee and pelvic control, cadence, and finish.'
      END
    ),
    (
      'absoluteLoadDemand',
      (variant.difficulty_json ->> 'absoluteLoadDemand')::SMALLINT,
      CASE definition.slug
        WHEN 'snap-down-to-stick' THEN
          'Proposed from bodyweight rapid eccentric lowering without required flight, external load, or repeated impact.'
        WHEN 'mirror-shuffle' THEN
          'Proposed from bodyweight lateral acceleration and braking, round duration, leader speed, hard direction changes, and recovery.'
        WHEN 'sprint-to-stick-deceleration' THEN
          'Proposed from approach distance, entry intent, braking steps, horizontal force attenuation, impact, and lower-body fatigue.'
        ELSE
          'Proposed from unilateral bodyweight contacts, support, cadence, amplitude, direction, contacts per side, surface, and lower-leg impact.'
      END
    ),
    (
      'technicalFatigueSensitivity',
      (variant.fatigue_profile_json ->>
        'technicalFatigueSensitivity')::SMALLINT,
      CASE definition.slug
        WHEN 'snap-down-to-stick' THEN
          'Proposed from slowing descent, noisy finish, knee or trunk drift, rebound, extra step, and loss of breathing control.'
        WHEN 'mirror-shuffle' THEN
          'Proposed from guessing, response errors, crossed feet, boundary loss, unsafe spacing, braking decline, and collision risk.'
        WHEN 'sprint-to-stick-deceleration' THEN
          'Proposed from run-through, panic steps, twisting, stop-zone error, alignment change, failed stick, reduced entry speed, and fear.'
        ELSE
          'Proposed from loud or slow contact, heel slam, landing-location drift, knee or pelvic change, rhythm loss, side difference, and symptoms.'
      END
    )
) calibration(dimension, score, rationale)
WHERE definition.facility_id = 1
  AND definition.slug IN (
    'snap-down-to-stick',
    'mirror-shuffle',
    'sprint-to-stick-deceleration',
    'single-leg-pogo'
  )
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
SET status = 'quarantined',
    blocking_issues_json = jsonb_build_array(
      jsonb_build_object(
        'code', 'media_human_review_required',
        'message',
          'Four candidate links have current YouTube oEmbed metadata but require embed-playback, full-video exact-match, cue, safety, caption, and accessibility review.'
      ),
      jsonb_build_object(
        'code', 'evidence_human_review_required',
        'message',
          'Candidate section evidence and the limits of applying related research to the exact exercise variants require human review.'
      ),
      jsonb_build_object(
        'code', 'graph_human_review_required',
        'message',
          'Progression, regression, and conditional substitution proposals require coach approval.'
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
    ),
    human_review_required = TRUE,
    checked_at = now()
FROM coaching.exercise_definition_v1 definition
WHERE definition.id = packet.definition_id
  AND definition.facility_id = 1
  AND definition.slug IN (
    'snap-down-to-stick',
    'mirror-shuffle',
    'sprint-to-stick-deceleration',
    'single-leg-pogo'
  );
