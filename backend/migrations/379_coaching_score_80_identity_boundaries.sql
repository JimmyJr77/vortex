-- Adjudicate the mechanically distinct and source-ambiguous pairs in the
-- score-80 canonical identity queue.
--
-- These records resolve identity only. They do not approve or publish cards,
-- media, relationships, calibration, or dosage. Exercise cards use exercise
-- complexity and physical difficulty only; athlete skill/proficiency levels
-- remain exclusive to the skill library. IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '379_coaching_score_80_identity_boundaries';
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
        '20-20-20-build-up-sprint',
        'sprint-float-sprint-build-up',
        'distinct_exercises',
        'progressively_faster_three_zone_run_vs_fast_float_fast_reacceleration',
        '20-20-20 Build-Up Sprint progresses from build to faster to fast-but-relaxed across three declared zones. Sprint-Float-Sprint begins fast, deliberately reduces effort while preserving rhythm, then reaccelerates. Zone intent, velocity sequence, transition demand, distance contract, and measurement differ.',
        jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/')
      ),
      (
        'alternate-leg-bound-for-distance',
        'curved-sprint-bound',
        'distinct_exercises',
        'linear_alternating_bounds_vs_arc_running_bounds',
        'Alternate-Leg Bound for Distance uses repeated left-right projections along a linear path. Curved Sprint Bound requires an arc, inside-outside limb roles, curve-specific lean, and continuous orientation control. Route geometry, force direction, laterality, spacing, balance, and measurement differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/20072070/')
      ),
      (
        'backpedal-to-sprint-turn',
        'sprint-to-backpedal-transition',
        'distinct_exercises',
        'backward_entry_to_forward_sprint_vs_forward_entry_to_backward_run',
        'Backpedal-to-Sprint Turn begins moving backward and uses a hip turn to accelerate forward. Sprint-to-Backpedal Transition begins sprinting forward and brakes or reorients into backward travel. Ordered actions, entry velocity, braking, hip-turn timing, visual field, and failure state differ.',
        jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/')
      ),
      (
        'backpedal-to-sprint-to-stick',
        'sprint-to-backpedal-transition',
        'distinct_exercises',
        'backward_to_forward_sprint_then_terminal_stick_vs_forward_to_backward_transition',
        'Backpedal-to-Sprint-to-Stick requires backward travel, a turn into forward acceleration, then a declared braking zone and terminal stick. Sprint-to-Backpedal Transition reverses that movement order and does not declare the same terminal stick. Sequence, contact count, speed, finish, dose, and stop rule differ.',
        jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/')
      ),
      (
        'barbell-box-squat',
        'split-squat',
        'distinct_exercises',
        'bilateral_barbell_squat_to_box_vs_stationary_unilateral_split_stance_squat',
        'Barbell Box Squat uses a bilateral stance, posterior barbell load, declared box contact, and controlled reversal. Split Squat uses a stationary asymmetrical stance and primarily loads the front leg without a required box. Stance, laterality, support, load path, range target, setup, and side-specific dose differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/32551198/')
      ),
      (
        'barbell-bench-press',
        'bench-press-pin-iso',
        'distinct_exercises',
        'dynamic_barbell_bench_press_repetitions_vs_overcoming_pin_isometric',
        'Barbell Bench Press lowers and presses the bar through a declared dynamic range. Bench Press Pin Iso drives maximally into immovable pins at one declared joint angle without visible bar travel. Contraction type, range, dose unit, pin setup, measurement, fatigue, and stop rules differ.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/24575723/',
          'https://pubmed.ncbi.nlm.nih.gov/37229417/'
        )
      ),
      (
        'barbell-bench-press',
        'dumbbell-z-press',
        'distinct_exercises',
        'supine_bench_horizontal_press_vs_floor_seated_vertical_press',
        'The unified Bench Press identity uses a supine bench-supported base and horizontal press path, whether loaded by barbell or dumbbells. Dumbbell Z-Press uses a floor-seated base with extended legs and a vertical overhead path. Support, joint angles, force direction, trunk and hip demand, head clearance, setup, and safe failure differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/23096062/')
      ),
      (
        'drop-squat-to-stick',
        'squat-jump-to-stick',
        'distinct_exercises',
        'rapid_descent_to_bilateral_landing_shape_without_takeoff_vs_vertical_jump_and_landing',
        'Drop Squat to Stick rapidly lowers from standing into an athletic landing shape and freezes without a takeoff or flight phase. Squat Jump to Stick requires concentric projection, flight, and a subsequent landing. Flight, impulse, impact exposure, ordered actions, output measure, and fatigue differ.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/17685678/',
          'https://pubmed.ncbi.nlm.nih.gov/20072070/'
        )
      ),
      (
        'dumbbell-hamstring-curl',
        'hamstring-slider-curl',
        'distinct_exercises',
        'prone_external_load_knee_flexion_vs_supine_bridge_slider_knee_flexion',
        'Dumbbell Hamstring Curl is performed prone with a dumbbell secured between the feet. Hamstring Slider Curl is performed supine with the heels sliding while hip extension is maintained. Body orientation, implement, hip action, load direction, setup, safe exit, and scaling differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/21877146/')
      ),
      (
        'goblet-squat',
        'heels-elevated-front-squat',
        'distinct_exercises',
        'chest_held_free_weight_squat_vs_barbell_front_rack_heels_elevated_squat',
        'Goblet Squat holds one kettlebell or dumbbell at the chest and does not require heel elevation. Heels-Elevated Front Squat uses a barbell front rack and a declared heel wedge or plates. Load position, implement, wrist and rack demand, support surface, setup, spotting, and load ceiling differ.',
        jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/')
      ),
      (
        'half-kneeling-rotational-wall-throw',
        'medicine-ball-rotational-throw',
        'distinct_exercises',
        'half_kneeling_constrained_rotational_throw_vs_standing_rotational_projection',
        'Half-Kneeling Rotational Wall Throw fixes one knee on the floor to constrain lower-body contribution and expose pelvis-trunk control. Medicine-Ball Rotational Throw uses a standing stance and may include pivot, step, or countermovement variants. Support base, lower-body contribution, release mechanics, side contract, and dose differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/39589937/')
      ),
      (
        'landmine-anti-rotation-press',
        'landmine-rotation',
        'distinct_exercises',
        'press_out_while_resisting_trunk_rotation_vs_loaded_rotational_arc',
        'Landmine Anti-Rotation Press presses or holds the bar away while the trunk resists rotation and extension. Landmine Rotation intentionally moves the bar through a side-to-side rotational arc with foot pivot and hip contribution. Rotation policy, joint actions, force intent, range, stance, and stop rules differ.',
        jsonb_build_array('https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/')
      ),
      (
        'landmine-rotation',
        'landmine-rotational-press',
        'distinct_exercises',
        'side_to_side_loaded_rotation_vs_rotating_base_with_terminal_press',
        'Landmine Rotation moves the loaded bar end across the body through a rotational arc. Landmine Rotational Press adds a declared pressing action through the angled bar path from a rotating base. Terminal action, arm contribution, path, range, loading tolerance, and repetition boundary differ.',
        jsonb_build_array('https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/')
      ),
      (
        'lateral-box-jump',
        'single-leg-lateral-box-jump',
        'distinct_exercises',
        'bilateral_lateral_box_projection_vs_single_leg_lateral_box_projection',
        'Lateral Box Jump uses a two-foot takeoff contract. Single-Leg Lateral Box Jump requires one declared takeoff leg and materially greater unilateral balance and landing control. Support, laterality, force distribution, impact budget, side-specific dose, prerequisites, and substitutions differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/39228781/')
      ),
      (
        'lateral-crossover-step-ladder',
        'lateral-scissor-step-ladder',
        'distinct_exercises',
        'traveling_crossover_contacts_vs_lead_trail_scissor_exchange',
        'Lateral Crossover Step Ladder crosses one foot over or behind the other while traveling through the ladder. Lateral Scissor Step Ladder rapidly exchanges the lead and trail feet without the same crossover route. Contact order, crossover policy, hip rotation, direction, error state, and measurement differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/24290613/')
      ),
      (
        'lateral-icky-shuffle',
        'lateral-shuffle-decel-stick',
        'distinct_exercises',
        'ladder_inside_outside_footwork_pattern_vs_cone_shuffle_then_braking_stick',
        'Lateral Icky Shuffle uses ladder boxes and a declared inside-outside multi-contact rhythm. Lateral Shuffle Decel Stick uses lateral shuffle travel to a cone followed by braking and a frozen finish. Equipment, route, foot sequence, speed, braking, terminal state, and scoring differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/24290613/')
      ),
      (
        'lateral-quick-step-to-stick',
        'tuck-jump-to-lateral-stick',
        'distinct_exercises',
        'ladder_lateral_quick_contacts_then_stick_vs_vertical_tuck_jump_to_lateral_landing',
        'Lateral Quick Step to Stick performs a declared ladder foot pattern before the stick. Tuck Jump to Lateral Stick requires a vertical jump, airborne knee tuck, leg re-extension, and lateral landing. Equipment, contact sequence, flight action, height, impact, and landing demand differ.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/17685678/',
          'https://pubmed.ncbi.nlm.nih.gov/20072070/'
        )
      ),
      (
        'line-hops',
        'line-pogo-hops',
        'needs_human_review',
        'line_hop_sources_do_not_declare_matching_direction_or_crossing_contract',
        'Line Hops declares rapid contacts over a line but does not identify lateral versus forward-back travel, foot count, or whether each contact must cross the line. Line Pogo Hops describes two-foot vertical stiffness before cuts but does not declare a crossing direction. Those facts determine whether the cards are duplicates, variants, or distinct exercises and cannot be inferred safely.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/20072070/')
      ),
      (
        'one-arm-push-up-progression',
        'v-up-progression',
        'distinct_exercises',
        'unilateral_horizontal_press_progression_vs_trunk_and_hip_flexion_progression',
        'One-Arm Push-Up Progression develops an asymmetrical prone horizontal press with anti-rotation. V-Up Progression develops supine trunk and hip flexion through tuck, single-leg, or full compression variants. Body orientation, joint actions, support, primary tissues, balance, and scaling differ.',
        jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC6033506/')
      ),
      (
        'pogo-to-10-yard-sprint',
        'two-point-start-to-5-10-yard-sprint',
        'distinct_exercises',
        'repeated_elastic_contacts_then_acceleration_vs_static_two_point_acceleration_start',
        'Pogo to 10-Yard Sprint begins with repeated elastic ankle contacts and transfers their rhythm into acceleration. Two-Point Start begins from a still staggered stance. Entry contacts, stretch-shortening exposure, start trigger, first-step mechanics, impact budget, and repetition duration differ.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/20072070/',
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/'
        )
      ),
      (
        '10-yard-sprint',
        'falling-start-10m',
        'distinct_exercises',
        'static_or_declared_short_sprint_start_vs_forward_fall_triggered_start',
        'The unified short sprint card permits declared static start variants such as a two-point stance. Falling Start Sprint specifically initiates acceleration by allowing a controlled forward fall until a recovery step is required. Trigger, balance, posture, first-step timing, error state, and setup differ.',
        jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/')
      ),
      (
        'reactive-broad-jump-d7',
        'reactive-rebound-broad-jump-to-box-jump',
        'distinct_exercises',
        'approach_broad_jump_to_floor_stick_vs_broad_rebound_into_box_jump',
        'Reactive Broad Jump uses an approach into one horizontal jump and a terminal floor stick. Reactive Rebound Broad Jump to Box Jump requires a broad-jump landing that immediately becomes a second takeoff to an elevated box. Action count, rebound, landing surface, equipment, impact, clearance, and exit differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/17685678/')
      ),
      (
        'single-leg-hurdle-hop-to-box-jump',
        'standing-box-jump-to-single-leg-landing',
        'distinct_exercises',
        'single_leg_hurdle_contact_then_box_jump_vs_standing_jump_to_single_leg_box_landing',
        'Single-Leg Hurdle Hop to Box Jump begins with a unilateral hurdle clearance and reactive ground contact before projecting to the box. Standing Box Jump to Single-Leg Landing begins from the floor without a hurdle and is defined by its one-foot box landing. Entry, contact count, obstacle, takeoff, landing contract, and impact differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/39228781/')
      ),
      (
        'squat-jump-to-stick',
        'tuck-jump-to-stick',
        'distinct_exercises',
        'vertical_squat_jump_to_landing_vs_airborne_knee_tuck_then_landing',
        'Squat Jump to Stick uses a standard vertical projection and returns the legs for a controlled landing. Tuck Jump to Stick adds a deliberate airborne knee-tuck and subsequent leg re-extension before landing. Flight action, coordination, landing preparation, physical demand, error state, and progression differ.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/17685678/',
          'https://pubmed.ncbi.nlm.nih.gov/20072070/'
        )
      ),
      (
        'wall-facing-handstand-toe-pull',
        'wall-handstand-hold',
        'distinct_exercises',
        'dynamic_wall_pressure_release_balance_drill_vs_static_wall_supported_hold',
        'Wall-Facing Handstand Toe Pull starts in a wall-facing hold and deliberately removes one or both toes from the wall to challenge balance. Wall Handstand Hold retains wall support for a static duration. Support changes, joint actions, balance strategy, dose unit, failure response, and prerequisite differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/41473027/')
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
