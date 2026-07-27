-- Adjudicate the mechanically distinct and source-ambiguous pairs in the
-- score-81 canonical identity queue.
--
-- These records resolve identity only. They do not approve or publish cards,
-- media, relationships, calibration, or dosage. Exercise cards use exercise
-- complexity and physical difficulty only; athlete skill/proficiency levels
-- remain exclusive to the skill library. IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '377_coaching_score_81_identity_boundaries';
  boundary RECORD;
  left_id UUID;
  right_id UUID;
  left_status TEXT;
  right_status TEXT;
  facility BIGINT;
BEGIN
  FOR boundary IN
    SELECT *
    FROM (VALUES
      (
        '5-cone-chase-drill',
        '5-cone-compass-drill',
        'distinct_exercises',
        'reactive_chase_to_late_target_vs_predeclared_compass_route',
        '5-Cone Chase Drill requires the athlete to pursue or react to a coach, partner, or late target among the cones. 5-Cone Compass Drill follows a declared compass-point route. Perception, decision timing, partner behavior, route certainty, error state, and group logistics differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/24290613/')
      ),
      (
        'archer-pull-up',
        'archer-push-up',
        'distinct_exercises',
        'asymmetric_vertical_pull_vs_asymmetric_horizontal_push',
        'Archer Pull-Up uses an overhead hanging base and asymmetrical vertical pull. Archer Push-Up uses a prone hand-supported base and asymmetrical horizontal press. Force direction, support, grip, shoulder path, primary tissues, setup, and safe exit differ.',
        jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC6033506/')
      ),
      (
        'lateral-hop-to-stick',
        'skater-hop-to-stick',
        'distinct_exercises',
        'bilateral_lateral_takeoff_and_landing_vs_unilateral_opposite_leg_landing',
        'Bilateral Lateral Jump to Stick takes off and lands on two feet. Skater Hop to Stick takes off from one leg and lands on the opposite leg. Support base, laterality, load distribution, balance, side-specific dose, and landing tolerance differ.',
        jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC10407309/')
      ),
      (
        'bottoms-up-kettlebell-press',
        'kettlebell-bottoms-up-carry',
        'distinct_exercises',
        'bottoms_up_press_repetitions_vs_bottoms_up_loaded_locomotion',
        'Bottoms-Up Kettlebell Press moves the bell through an overhead press. Bottoms-Up Carry holds the unstable bell while the athlete walks. Joint action, locomotion, distance, grip exposure, balance, environment, and stop rules differ.',
        jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC6033506/')
      ),
      (
        'box-squat',
        'goblet-squat',
        'distinct_exercises',
        'required_box_contact_vs_unsupported_front_loaded_squat',
        'Box Squat requires a declared box target and controlled contact before the ascent. Goblet Squat remains unsupported and uses a front-held kettlebell or dumbbell. Support, depth reference, reversal mechanics, load position, equipment, setup, and failure criteria differ.',
        jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/')
      ),
      (
        'goblet-squat',
        'goblet-squat-bottom-iso-hold',
        'distinct_exercises',
        'dynamic_goblet_squat_repetitions_vs_fixed_bottom_isometric',
        'Goblet Squat completes controlled eccentric and concentric repetitions through a declared range. Goblet Squat Bottom Iso Hold maintains one declared bottom position without visible joint motion. Contraction type, dose unit, range, local fatigue, measurement, and stop rules differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/30580468/')
      ),
      (
        'close-grip-bench-press',
        'close-grip-push-up',
        'distinct_exercises',
        'externally_loaded_supine_press_vs_prone_bodyweight_press',
        'Close-Grip Bench Press uses a supine bench, barbell or free-weight load, and a rack and spotting contract. Close-Grip Push-Up uses a prone plank with the hands on the floor or an elevation. Support, load source, path, setup, failure response, and scaling differ.',
        jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC6033506/')
      ),
      (
        'dead-bug-pullover-band-dead-bug',
        'medicine-ball-dead-bug-press',
        'distinct_exercises',
        'overhead_pullover_with_dead_bug_constraint_vs_press_isometric_dead_bug',
        'Dead Bug Pullover moves a band or free weight through an overhead shoulder-extension path while the legs perform the declared dead-bug action. Medicine-Ball Dead Bug Press uses a press or isometric hand-to-ball constraint. Upper-body action, load direction, range, hand position, and coordination differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/21877146/')
      ),
      (
        'drop-jump',
        'snap-down-to-low-vertical-rebound',
        'distinct_exercises',
        'elevated_step_off_to_rebound_vs_active_snapdown_to_rebound',
        'Drop Jump begins from an elevated step-off and removes the first takeoff. Snap-Down to Low Vertical Rebound begins from an active snap-down from tall or overhead reach. Entry, fall height, first contact, equipment, impact, timing, and failure response differ.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/22431209/',
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC10115703/'
        )
      ),
      (
        'dumbbell-kettlebell-floor-press',
        'dumbbell-z-press',
        'distinct_exercises',
        'supine_horizontal_floor_press_vs_floor_seated_vertical_press',
        'Dumbbell or Kettlebell Floor Press uses a supine floor-supported base and horizontal press path. Dumbbell Z-Press uses a floor-seated base with the legs extended and vertical overhead path. Support, joint angles, trunk and hip demand, head clearance, setup, and safe failure differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/23096062/')
      ),
      (
        'dumbbell-bench-press',
        'dumbbell-z-press',
        'distinct_exercises',
        'supine_bench_horizontal_press_vs_floor_seated_vertical_press',
        'Dumbbell Bench Press uses a supine bench-supported base and horizontal press path. Dumbbell Z-Press uses a floor-seated base with extended legs and a vertical overhead path. Support, joint angles, balance, trunk and hip demand, setup, spotting, and safe failure differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/23096062/')
      ),
      (
        'dumbbell-incline-press',
        'incline-push-up',
        'distinct_exercises',
        'supine_incline_bench_external_load_vs_elevated_hand_bodyweight_press',
        'Dumbbell Incline Press places the athlete supine on an inclined bench and moves external loads. Incline Push-Up keeps the athlete prone with the hands elevated and uses bodyweight. Body orientation, support, load source, path, setup, spotting, and scaling differ.',
        jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC6033506/')
      ),
      (
        'dumbbell-sumo-squat',
        'goblet-squat',
        'needs_human_review',
        'sumo_source_does_not_declare_dumbbell_load_position',
        'Dumbbell Sumo Squat declares a wide stance but does not declare whether the dumbbell is held at the chest, hangs between the legs, or uses two side-loaded implements. That fact determines whether it is a goblet-squat stance variant or a different dumbbell load-path contract and cannot be inferred safely.',
        jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/')
      ),
      (
        'dumbbell-waiter-carry',
        'farmer-carry',
        'distinct_exercises',
        'overhead_or_racked_unilateral_carry_vs_loads_held_at_sides',
        'Dumbbell Waiter Carry holds one load overhead or in a declared waiter position. Farmer Carry holds one or two loads at the sides. Load position, laterality, shoulder demand, grip, trunk constraint, clearance, and safe set-down differ.',
        jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC6033506/')
      ),
      (
        'falling-start-10m',
        'two-point-start-to-5-10-yard-sprint',
        'distinct_exercises',
        'forward_fall_triggered_start_vs_static_two_point_start',
        'Falling Start Sprint initiates acceleration by allowing a controlled forward fall until the first recovery step is required. Two-Point Start begins from a deliberate split or staggered static stance. Trigger, posture, first-step timing, balance, setup, and coaching faults differ.',
        jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/')
      ),
      (
        'half-kneeling-landmine-anti-rotation-press',
        'half-kneeling-one-arm-landmine-press',
        'distinct_exercises',
        'anti_rotation_press_out_constraint_vs_unilateral_angled_press',
        'Half-Kneeling Landmine Anti-Rotation Press is organized around resisting trunk rotation during a declared press-out or two-hand path. Half-Kneeling One-Arm Landmine Press is a unilateral angled shoulder press. Hand contract, path, rotation policy, target tissues, load tolerance, and stop rules differ.',
        jsonb_build_array(
          'https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/',
          'https://pubmed.ncbi.nlm.nih.gov/21877146/'
        )
      ),
      (
        'half-kneeling-medicine-ball-shot-put-throw',
        'half-kneeling-rotational-wall-throw',
        'distinct_exercises',
        'single_arm_shot_put_projection_vs_two_hand_rotational_projection',
        'Half-Kneeling Medicine-Ball Shot-Put Throw uses a single-arm shot-put-style projection from the shoulder. Half-Kneeling Rotational Wall Throw uses sequenced trunk rotation and a declared rotational ball path. Hand count, release path, joint actions, side relationship, target, and return differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/39589937/')
      ),
      (
        'half-kneeling-one-arm-landmine-press',
        'half-kneeling-single-arm-press',
        'distinct_exercises',
        'fixed_angled_landmine_path_vs_free_vertical_single_arm_press',
        'Half-Kneeling One-Arm Landmine Press follows the anchored bar-end arc. Half-Kneeling Single-Arm Press uses a dumbbell, kettlebell, cable, or band through a free or vertically organized path. Force direction, implement geometry, anchor, clearance, grip, setup, and substitution behavior differ.',
        jsonb_build_array(
          'https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/',
          'https://pubmed.ncbi.nlm.nih.gov/23096062/'
        )
      ),
      (
        'half-kneeling-single-arm-press',
        'tall-kneeling-sandbag-overhead-press-strength',
        'distinct_exercises',
        'asymmetric_half_kneeling_single_arm_press_vs_symmetric_tall_kneeling_sandbag_press',
        'Half-Kneeling Single-Arm Press uses one knee and the opposite foot for an asymmetrical base and one pressing arm. Tall-Kneeling Sandbag Overhead Press uses both knees and a two-hand sandbag press. Support base, laterality, hand count, implement, load path, balance, and dose differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/23096062/')
      ),
      (
        'hurdle-hop-series-low-hurdles',
        'low-hurdle-step-over',
        'distinct_exercises',
        'ballistic_reactive_hurdle_contacts_vs_controlled_step_over_contacts',
        'Hurdle Hop Series requires ballistic takeoffs and landings over the low obstacles. Low Hurdle Step-Over Series keeps at least one foot supported while stepping over each obstacle. Flight, impact, contact time, balance, spacing, fatigue, and safety criteria differ.',
        jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC10115703/')
      ),
      (
        'inchworm-to-worlds-greatest-stretch',
        'worlds-greatest-stretch-to-plank',
        'distinct_exercises',
        'hinge_and_hand_walk_entry_plus_lunge_flow_vs_lunge_to_plank_transition',
        'Inchworm to World''s Greatest Stretch begins with a hinge and hand walk before the lunge and rotation sequence. World''s Greatest Stretch to Plank begins from the lunge sequence and requires a return to plank between sides. Entry, hand contacts, ordered actions, space, wrist demand, and repetition unit differ.',
        jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC10980866/')
      ),
      (
        'landmine-drop-step-rotational-press',
        'landmine-split-stance-rotational-press',
        'distinct_exercises',
        'dynamic_drop_step_entry_then_press_vs_preestablished_split_stance_press',
        'Landmine Drop-Step Rotational Press requires a dynamic drop step before the rotational press. Landmine Split-Stance Rotational Press begins in a pre-established split stance. Entry contacts, momentum, timing, space, balance, load, and fatigue differ.',
        jsonb_build_array(
          'https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/'
        )
      ),
      (
        'lateral-line-pogo',
        'line-pogo-hops',
        'needs_human_review',
        'generic_line_pogo_source_does_not_declare_crossing_direction',
        'Lateral Line Pogo explicitly requires side-to-side contacts across or relative to a line. Line Pogo Hops names a line but its legacy text describes general two-foot stiffness without declaring lateral versus forward-back travel or whether the line must be crossed. Direction determines duplicate, variant, or distinct identity.',
        jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC10115703/')
      ),
      (
        'lateral-lunge-decel-stick',
        'lateral-shuffle-decel-stick',
        'distinct_exercises',
        'lateral_lunge_entry_to_braking_vs_lateral_shuffle_approach_to_braking',
        'Lateral Lunge Decel Stick enters the stop through a lunge or single lateral step. Lateral Shuffle Decel Stick requires multiple shuffle contacts before braking. Approach, contact count, crossover policy, speed, distance, fatigue, and stop timing differ.',
        jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC10407309/')
      ),
      (
        'medicine-ball-chest-pass-catch-and-stick',
        'medicine-ball-rotational-catch-and-stick',
        'distinct_exercises',
        'forward_chest_level_reception_vs_rotational_reception_and_absorption',
        'Chest Pass Catch-and-Stick receives a forward chest-level trajectory and absorbs it without required rotation. Rotational Catch-and-Stick receives a transverse trajectory and requires rotational absorption. Ball path, stance, joint actions, side, partner position, and failure criteria differ.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/39589937/',
          'https://pubmed.ncbi.nlm.nih.gov/22744301/'
        )
      ),
      (
        'medicine-ball-chest-pass',
        'medicine-ball-rotational-throw',
        'distinct_exercises',
        'forward_two_hand_chest_projection_vs_transverse_rotational_projection',
        'Medicine-Ball Chest Pass begins at the chest and projects forward with two hands through a press-like path. Medicine-Ball Rotational Throw uses sequenced whole-body rotation and a transverse ball path. Start position, force direction, joint actions, stance, side, target, and return contract differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/39589937/')
      ),
      (
        'medicine-ball-overhead-slam',
        'medicine-ball-overhead-throw',
        'distinct_exercises',
        'downward_floor_slam_vs_forward_overhead_release',
        'Medicine-Ball Overhead Slam accelerates the ball downward into a declared floor target. Forward Overhead Medicine-Ball Throw releases the ball forward to a wall, partner, or open target. Projection direction, target surface, trajectory, rebound, retrieval, space, and safety differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/39589937/')
      ),
      (
        'medicine-ball-rotational-scoop-toss',
        'medicine-ball-scoop-toss-catch-and-stick',
        'distinct_exercises',
        'rotational_scoop_projection_vs_scoop_trajectory_reception_and_terminal_catch',
        'Medicine-Ball Rotational Scoop Toss is organized around producing a rotational release. Medicine-Ball Scoop Toss Catch-and-Stick is organized around receiving a scoop trajectory and owning the terminal catch. Primary action, ball possession, partner behavior, load direction, finish, and intent differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/39589937/')
      ),
      (
        'medicine-ball-rotational-throw',
        'slam-ball-rotational-slam',
        'distinct_exercises',
        'transverse_projection_and_release_vs_rotational_downward_slam',
        'Medicine-Ball Rotational Throw projects and releases the ball transversely toward a wall or partner. Slam-Ball Rotational Slam drives the ball downward into the floor. Force direction, target surface, release angle, rebound expectation, retrieval, space, and safety differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/39589937/')
      ),
      (
        'medicine-ball-rotational-toss-to-lateral-bound',
        'rotational-bound-to-stick',
        'distinct_exercises',
        'ball_toss_then_lateral_bound_vs_rotational_bound_without_ball_projection',
        'Medicine-Ball Rotational Toss to Lateral Bound releases a ball before the bound and therefore requires ball possession, target clearance, and a declared collection policy. Rotational Bound to Stick performs the rotational bound without that projection. Ordered actions, equipment, timing, space, and safety differ.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/39589937/',
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC10407309/'
        )
      ),
      (
        'one-arm-landmine-arc-press',
        'square-stance-one-arm-landmine-press',
        'needs_human_review',
        'arc_press_source_does_not_declare_support_stance',
        'One-Arm Landmine Arc Press declares the anchored angled path but not square versus split stance. Square-Stance One-Arm Landmine Press requires a symmetrical standing base. The missing stance determines whether square stance is an exact variant, the same source, or one member of a broader arc-press identity.',
        jsonb_build_array(
          'https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/'
        )
      ),
      (
        'one-arm-landmine-floor-press',
        'one-arm-landmine-push-press',
        'distinct_exercises',
        'floor_supported_strict_angled_press_vs_standing_leg_driven_push_press',
        'One-Arm Landmine Floor Press uses a floor-supported base and no leg drive. One-Arm Landmine Push Press uses a standing base, dip, and leg drive before the press. Support, lower-body action, ordered sequence, load, setup, spotting, and fatigue differ.',
        jsonb_build_array(
          'https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/'
        )
      ),
      (
        'one-arm-landmine-z-press',
        'square-stance-one-arm-landmine-press',
        'distinct_exercises',
        'floor_seated_angled_press_vs_square_standing_angled_press',
        'One-Arm Landmine Z-Press uses a floor-seated base with the legs extended. Square-Stance One-Arm Landmine Press uses a symmetrical standing base. Support, hip and knee position, balance, setup, load tolerance, and safe failure response differ.',
        jsonb_build_array(
          'https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/'
        )
      ),
      (
        'single-leg-depth-drop-to-stick',
        'single-leg-hop-to-stick',
        'distinct_exercises',
        'elevated_step_off_without_takeoff_vs_active_single_leg_floor_takeoff',
        'Single-Leg Depth Drop to Stick begins from an elevated step-off and removes the takeoff. Single-Leg Hop to Stick requires an active floor takeoff. Start surface, force-production task, fall height, equipment, impact, and failure response differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/22431209/')
      ),
      (
        'single-leg-lateral-hop-to-stick',
        'single-leg-triple-hop-to-stick',
        'distinct_exercises',
        'single_lateral_hop_and_stick_vs_three_hop_sequence_and_terminal_stick',
        'Single-Leg Lateral Hop to Stick requires one declared lateral flight and terminal hold. Single-Leg Triple Hop to Stick requires three consecutive unilateral flights before the terminal hold. Direction, contact count, rhythm, accumulated impact, distance, fatigue, and dose differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/24290613/')
      ),
      (
        'single-leg-line-hop-and-stick',
        'triple-line-hop-and-stick',
        'needs_human_review',
        'line_hop_sources_do_not_jointly_declare_direction_or_contact_contract',
        'Triple-Line Hop and Stick declares three small single-leg contacts, but neither source declares whether contacts cross the line laterally, travel forward-back, or remain on one side. The generic Single-Leg Line Hop source also omits contact count. Those facts determine whether triple is an exact variant or a distinct sequence.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/24290613/')
      ),
      (
        'skater-hop-to-stick',
        'star-hop-to-stick',
        'distinct_exercises',
        'single_lateral_opposite_leg_hop_vs_multidirectional_star_sequence',
        'Skater Hop to Stick uses one lateral hop to the opposite leg and a terminal hold. Star Hop to Stick follows multiple declared clock-face or star targets. Direction sequence, target layout, contact count, spatial decision, laterality, and dose differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/24290613/')
      ),
      (
        'spanish-squat-isometric',
        'split-squat-isometric-hold',
        'distinct_exercises',
        'bilateral_band_supported_squat_isometric_vs_unilateral_split_stance_isometric',
        'Spanish Squat Isometric uses a bilateral stance with a strap or band supporting behind the knees. Split Squat Isometric Hold uses a stationary asymmetrical split stance without that bilateral knee-support contract. Support, stance, laterality, joint angles, equipment, and side-specific dose differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/30580468/')
      ),
      (
        'squat-jump-to-stick',
        'static-squat-jump-to-box',
        'distinct_exercises',
        'floor_takeoff_to_floor_landing_vs_floor_takeoff_to_elevated_box_landing',
        'Squat Jump to Stick lands on the floor after the vertical jump. Static Squat Jump to Box lands on an elevated box, stands, and steps down. Landing surface, height, target geometry, equipment, impact, clearance, and exit differ.',
        jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC10115703/')
      )
    ) AS boundaries(
      left_slug,
      right_slug,
      decision,
      identity_boundary,
      rationale,
      research_sources
    )
  LOOP
    left_id := NULL;
    right_id := NULL;
    left_status := NULL;
    right_status := NULL;
    facility := NULL;

    SELECT id, status, facility_id
    INTO left_id, left_status, facility
    FROM coaching.exercise_definition_v1
    WHERE slug = boundary.left_slug
      AND facility_id = 1;

    SELECT id, status
    INTO right_id, right_status
    FROM coaching.exercise_definition_v1
    WHERE slug = boundary.right_slug
      AND facility_id = facility;

    IF left_id IS NULL OR right_id IS NULL THEN
      RAISE EXCEPTION
        '% requires traceable definitions % and %',
        migration_key,
        boundary.left_slug,
        boundary.right_slug;
    END IF;

    IF left_status = 'archived' OR right_status = 'archived' THEN
      IF EXISTS (
        SELECT 1
        FROM coaching.exercise_identity_resolution_v1 resolution
        WHERE (
          (
            resolution.survivor_definition_id = left_id
            AND resolution.resolved_definition_id = right_id
          )
          OR (
            resolution.survivor_definition_id = right_id
            AND resolution.resolved_definition_id = left_id
          )
        )
          AND resolution.decision = boundary.decision
      ) THEN
        CONTINUE;
      END IF;

      RAISE EXCEPTION
        '% found archived endpoint without matching decision for % and %',
        migration_key,
        boundary.left_slug,
        boundary.right_slug;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM coaching.exercise_identity_resolution_v1 resolution
      WHERE (
        (
          resolution.survivor_definition_id = left_id
          AND resolution.resolved_definition_id = right_id
        )
        OR (
          resolution.survivor_definition_id = right_id
          AND resolution.resolved_definition_id = left_id
        )
      )
        AND resolution.decision <> boundary.decision
    ) THEN
      RAISE EXCEPTION
        '% conflicts with existing identity decision for % and %',
        migration_key,
        boundary.left_slug,
        boundary.right_slug;
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
      facility,
      left_id,
      right_id,
      boundary.decision,
      boundary.rationale,
      jsonb_build_object(
        'identityBoundary', boundary.identity_boundary,
        'legacySourceCardsAudited', TRUE,
        'researchSources', boundary.research_sources,
        'decisionScope',
          'identity_only_not_card_media_graph_calibration_or_publication_approval',
        'missingIdentityFacts',
          boundary.decision = 'needs_human_review',
        'humanReviewRequired', TRUE,
        'reviewerAssigned', FALSE,
        'publicationQuarantined', TRUE,
        'exerciseDifficultyModel',
          'exercise_complexity_and_physical_difficulty_only',
        'migration', migration_key
      ),
      'deterministic_identity_equivalence',
      NULL,
      now()
    WHERE NOT EXISTS (
      SELECT 1
      FROM coaching.exercise_identity_resolution_v1 existing
      WHERE (
        (
          existing.survivor_definition_id = left_id
          AND existing.resolved_definition_id = right_id
        )
        OR (
          existing.survivor_definition_id = right_id
          AND existing.resolved_definition_id = left_id
        )
      )
        AND existing.decision = boundary.decision
    )
    ON CONFLICT (survivor_definition_id, resolved_definition_id)
    DO UPDATE SET
      decision = EXCLUDED.decision,
      rationale = EXCLUDED.rationale,
      evidence_json = EXCLUDED.evidence_json,
      resolution_source = EXCLUDED.resolution_source,
      reviewed_by = NULL,
      resolved_at = now()
    WHERE coaching.exercise_identity_resolution_v1.resolution_source
      <> 'human_review';

    IF NOT EXISTS (
      SELECT 1
      FROM coaching.exercise_identity_resolution_v1 resolution
      WHERE (
        (
          resolution.survivor_definition_id = left_id
          AND resolution.resolved_definition_id = right_id
        )
        OR (
          resolution.survivor_definition_id = right_id
          AND resolution.resolved_definition_id = left_id
        )
      )
        AND resolution.decision = boundary.decision
    ) THEN
      RAISE EXCEPTION
        '% did not persist decision for % and %',
        migration_key,
        boundary.left_slug,
        boundary.right_slug;
    END IF;
  END LOOP;
END;
$$;
