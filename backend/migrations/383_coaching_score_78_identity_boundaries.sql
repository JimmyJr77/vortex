-- Adjudicate the mechanically distinct and source-ambiguous pairs in the
-- score-78 canonical identity queue after the score-79 consolidations.
--
-- These records resolve identity only. They do not approve or publish cards,
-- media, relationships, calibration, or dosage. Exercise cards use exercise
-- complexity and physical difficulty only; athlete skill/proficiency levels
-- remain exclusive to the skill library. IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '383_coaching_score_78_identity_boundaries';
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
        '180-turn-wall-ball-catch-and-throw',
        'lateral-catch-and-throw-wall-ball',
        'distinct_exercises',
        'turn_on_cue_then_receive_and_throw_vs_lateral_step_catch_and_throw',
        'The 180-turn card begins facing away and requires a turn on cue before receiving or locating the ball, squaring, and throwing. The lateral card begins with a side step into a catch and throw. Entry orientation, ordered actions, visual acquisition, footwork, ball timing, and failure state differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/39589937/')
      ),
      (
        '20-20-20-build-up-sprint',
        'curve-sprint-build-up',
        'distinct_exercises',
        'linear_three_zone_velocity_progression_vs_continuous_curved_acceleration',
        '20-20-20 Build-Up Sprint uses three declared linear zones with progressive velocity targets. Curve Sprint Build-Up follows an arc with inside and outside limb roles and curve-specific lean. Route geometry, force orientation, laterality, zone contract, spacing, and measurement differ.',
        jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/')
      ),
      (
        'dumbbell-kettlebell-floor-press',
        'barbell-z-press',
        'distinct_exercises',
        'supine_floor_horizontal_press_vs_floor_seated_vertical_press',
        'The canonical Floor Press uses a supine floor-supported base and horizontal pressing path. Barbell Z Press uses a floor-seated base with legs extended and a vertical overhead path. Orientation, force direction, shoulder range, hip position, trunk demand, setup, and safe failure differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/23096062/')
      ),
      (
        'beam-hop-to-stick',
        'star-hop-to-stick',
        'distinct_exercises',
        'narrow_beam_projection_and_landing_vs_multidirectional_star_pattern',
        'Beam Hop to Stick uses a narrow elevated or marked beam target and prioritizes alignment over that support. Star Hop to Stick uses successive or cued multidirectional projections around a center. Surface, route, contact sequence, direction changes, visual targets, balance demand, and measurement differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/17544325/')
      ),
      (
        'bear-crawl-contralateral-tap',
        'lateral-bear-crawl',
        'distinct_exercises',
        'quadruped_support_with_contralateral_tap_vs_lateral_quadruped_locomotion',
        'Bear Crawl Contralateral Tap removes one hand to touch a declared opposite target while resisting trunk motion. Lateral Bear Crawl travels sideways through repeated hand-foot contacts. Travel, support changes, contact order, rotation policy, spacing, and dose unit differ.',
        jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC6033506/')
      ),
      (
        'bound-to-stick',
        'diagonal-bound-to-stick',
        'needs_human_review',
        'diagonal_bound_source_does_not_declare_same_leg_or_opposite_leg_landing',
        'Bound to Stick explicitly moves from one leg to the other. Diagonal Bound to Stick declares a 45-degree single-leg projection and landing but does not state whether landing is ipsilateral or contralateral. That laterality fact determines whether direction is only a variant or the contact contract is distinct.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/17544325/',
          'https://pubmed.ncbi.nlm.nih.gov/39228781/'
        )
      ),
      (
        'broad-jump-to-stick',
        'tuck-jump-to-stick',
        'distinct_exercises',
        'horizontal_projection_to_stick_vs_vertical_projection_with_airborne_knee_tuck',
        'Broad Jump to Stick maximizes or controls horizontal displacement before landing. Tuck Jump to Stick projects vertically, deliberately flexes the hips and knees in flight, re-extends, and lands. Force vector, flight action, distance versus height, landing preparation, spacing, and complexity differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/33359798/')
      ),
      (
        'deceleration-re-acceleration-sprint',
        'hill-sprint-acceleration',
        'distinct_exercises',
        'high_speed_brake_then_reaccelerate_vs_continuous_uphill_acceleration',
        'Deceleration Re-Acceleration Sprint requires an approach, braking phase, speed minimum, and second acceleration. Hill Sprint Acceleration continuously accelerates against an incline without a declared braking phase. Ordered actions, surface grade, force orientation, impact, distance, and recovery differ.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/40267408/',
          'https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/'
        )
      ),
      (
        'depth-drop-to-athletic-stick',
        'single-leg-depth-drop-to-stick',
        'distinct_exercises',
        'bilateral_depth_landing_vs_unilateral_depth_landing',
        'Depth Drop to Athletic Stick uses a two-foot landing contract. Single-Leg Depth Drop to Stick requires a declared one-foot landing. Landing foot count, force distribution, balance, impact budget, side-specific dose, box-height tolerance, and progression criteria differ.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/17620779/',
          'https://pubmed.ncbi.nlm.nih.gov/32992140/'
        )
      ),
      (
        'depth-drop-to-broad-rebound',
        'depth-drop-to-lateral-rebound',
        'distinct_exercises',
        'sagittal_horizontal_rebound_vs_frontal_plane_rebound',
        'Both cards begin with a depth drop, but Broad Rebound projects forward in the sagittal plane while Lateral Rebound projects sideways in the frontal plane. Direction, visual target, force vector, foot placement, landing or run-out, spacing, and measurement differ. Existing protected decisions also keep each distinct from generic Drop Jump.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/27428530/',
          'https://pubmed.ncbi.nlm.nih.gov/17544325/'
        )
      ),
      (
        'diagonal-bound-to-stick',
        'rotational-bound-to-stick',
        'distinct_exercises',
        'fixed_diagonal_projection_vs_declared_body_rotation_during_projection',
        'Diagonal Bound to Stick targets a 45-degree travel line. Rotational Bound to Stick deliberately changes body orientation during horizontal projection and landing. Orientation change, force vector, visual target, trunk action, landing alignment, and measurement differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/17544325/')
      ),
      (
        'drop-jump',
        'low-consecutive-rebound-box-jump',
        'distinct_exercises',
        'step_off_to_single_ground_rebound_vs_repeated_ground_contacts_to_box',
        'Drop Jump begins on a box, steps down, and rebounds after one imposed ground contact. Low Consecutive Rebound Box Jump begins on the floor and uses repeated rebounds that terminate on a box. Start surface, contact count, equipment sequence, clearance, terminal landing, fatigue, and dose differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/20072070/')
      ),
      (
        'drop-landing-to-lateral-stick',
        'lateral-hop-to-stick',
        'distinct_exercises',
        'imposed_drop_contact_then_lateral_absorption_vs_self_generated_bilateral_lateral_jump',
        'Drop Landing to Lateral Stick begins with an imposed descent or drop contact before the lateral landing task. Bilateral Lateral Jump to Stick begins with a self-generated two-foot lateral takeoff. Entry, first contact, equipment, impulse, landing sequence, and impact budget differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/17620779/')
      ),
      (
        'drop-landing-to-lateral-stick',
        'single-leg-lateral-hop-to-stick',
        'distinct_exercises',
        'imposed_drop_landing_sequence_vs_single_leg_lateral_takeoff_and_landing',
        'Drop Landing to Lateral Stick begins with an imposed descent and lateral absorption sequence. Single-Leg Lateral Hop to Stick begins and lands on one declared leg through a self-generated lateral projection. Entry, takeoff, foot count, impact source, side contract, and progression differ.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/17620779/',
          'https://pubmed.ncbi.nlm.nih.gov/39228781/'
        )
      ),
      (
        'dumbbell-kettlebell-floor-press',
        'kettlebell-strict-press',
        'distinct_exercises',
        'supine_floor_horizontal_press_vs_upright_vertical_strict_press',
        'The canonical Floor Press uses a supine floor-supported base and horizontal path. Kettlebell Strict Press uses an upright standing or declared base and vertical overhead path without leg drive. Orientation, force direction, support, head clearance, shoulder range, setup, and safe failure differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/23096062/')
      ),
      (
        'forward-hop-to-stick-low-amplitude',
        'single-leg-hop-to-stick',
        'distinct_exercises',
        'bilateral_forward_jump_to_stick_vs_unilateral_hop_to_stick',
        'Forward Hop to Stick explicitly takes off and lands on both feet. Single-Leg Hop to Stick uses one declared support leg and unilateral landing. Foot count, laterality, force distribution, balance, impact budget, side-specific dose, and progression differ.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/17620779/',
          'https://pubmed.ncbi.nlm.nih.gov/39228781/'
        )
      ),
      (
        'forward-back-line-hops',
        'line-pogo-forward-back',
        'needs_human_review',
        'line_hop_source_does_not_declare_foot_count_or_stiff_pogo_contact_contract',
        'Both cards travel forward and backward over a line, but Forward-Back Line Hops does not declare unilateral versus bilateral contacts and describes a low-hip brake-and-pop strategy, while Line Pogo specifies ankle stiffness. Foot count, posture, knee strategy, crossing rule, and contact-time target are required before consolidation.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/20072070/')
      ),
      (
        'landmine-rotation',
        'landmine-row-with-hip-rotation',
        'distinct_exercises',
        'loaded_side_to_side_rotation_vs_rotational_pull_to_trunk',
        'Landmine Rotation moves the loaded end through a side-to-side rotational arc without a terminal row. Landmine Row with Hip Rotation pulls the load toward the trunk while rotating. Terminal action, force direction, elbow motion, grip, path, primary tissues, and safe failure differ.',
        jsonb_build_array(
          'https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/'
        )
      ),
      (
        'lateral-bound-to-stick',
        'lateral-hop-to-stick',
        'needs_human_review',
        'lateral_bound_source_does_not_declare_takeoff_or_landing_foot_count',
        'Bilateral Lateral Jump to Stick explicitly uses two-foot takeoff and landing. Lateral Bound to Stick does not declare whether its bound travels from one leg to the other, same leg to same leg, or uses bound as a bilateral synonym. Foot count and laterality determine identity.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/17620779/',
          'https://pubmed.ncbi.nlm.nih.gov/39228781/'
        )
      ),
      (
        'lateral-bound-to-stick',
        'lateral-lunge-decel-stick',
        'distinct_exercises',
        'airborne_lateral_projection_vs_grounded_lateral_step_and_brake',
        'Lateral Bound to Stick includes an airborne projection before landing. Lateral Lunge Decel Stick uses a grounded lateral step or shift into a lunge-shaped braking position. Flight, contact sequence, center-of-mass path, joint strategy, spacing, and impact differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/17544325/')
      ),
      (
        'icky-shuffle',
        'lateral-two-in-shuffle',
        'distinct_exercises',
        'inside_inside_outside_icky_sequence_vs_two_contacts_in_every_box',
        'Icky Shuffle uses a declared inside-inside-outside pattern and weight shift across the ladder edge. Lateral Two-In Shuffle places two contacts inside each box while traveling laterally. Contact order, outside contact, crossover policy, cadence, error state, and measurement differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/24290613/')
      ),
      (
        'med-ball-slam-to-rotational-throw',
        'slam-ball-rotational-slam',
        'distinct_exercises',
        'vertical_slam_then_separate_rotational_throw_vs_single_rotational_slam',
        'Med Ball Slam to Rotational Throw combines a slam with a second rotational projection. Slam Ball Rotational Slam performs one rotationally directed slam. Action count, ball recovery, transition, release direction, contact sequence, spacing, and repetition duration differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/39589937/')
      ),
      (
        'medicine-ball-rotational-catch-and-stick',
        'medicine-ball-rotational-throw',
        'distinct_exercises',
        'incoming_rotational_catch_absorption_vs_outgoing_rotational_projection',
        'Rotational Catch-and-Stick receives an incoming ball, absorbs transverse momentum, and freezes. Rotational Throw loads and releases an outgoing two-hand projection. Catch versus release, partner role, force direction, braking, ball path, spacing, and safety differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/39589937/')
      ),
      (
        'one-arm-landmine-arc-press',
        'split-stance-one-arm-landmine-press',
        'needs_human_review',
        'arc_press_source_does_not_declare_stance_or_arc_contract',
        'Split-Stance One-Arm Landmine Press declares a fixed asymmetrical base and angled press. The arc-press source does not define its stance, arc, handoff, lowering path, or whether it is only an eccentric variant. Those facts are required before deciding whether stance is a variant or the movement contract differs.',
        jsonb_build_array(
          'https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/'
        )
      ),
      (
        'one-arm-landmine-push-press',
        'square-stance-one-arm-landmine-press',
        'distinct_exercises',
        'leg_driven_push_press_vs_strict_upper_body_press',
        'One-Arm Landmine Push Press deliberately dips and drives through the legs before pressing. Square-Stance One-Arm Landmine Press uses a fixed bilateral base without declared leg drive. Lower-body impulse, action sequence, load ceiling, timing, fatigue, and stop rules differ.',
        jsonb_build_array(
          'https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/'
        )
      ),
      (
        'one-arm-landmine-z-press',
        'split-stance-one-arm-landmine-press',
        'distinct_exercises',
        'floor_seated_extended_leg_press_vs_upright_split_stance_press',
        'One-Arm Landmine Z Press fixes the athlete seated on the floor with legs extended. Split-Stance One-Arm Landmine Press uses an upright asymmetrical base. Support, hip position, lower-body contribution, trunk demand, setup, range, and safe failure differ.',
        jsonb_build_array(
          'https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/'
        )
      ),
      (
        'single-leg-hop-to-stick',
        'single-leg-pogo-hold-stick',
        'needs_human_review',
        'pogo_hold_source_does_not_declare_contact_count_or_projection_amplitude',
        'Single-Leg Hop to Stick declares one projection and terminal landing. Single-Leg Pogo Hold-Stick does not state whether it performs one low-amplitude hop or repeated pogo contacts before the stick. Contact count, amplitude, direction, and finish rule determine identity.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/20072070/')
      ),
      (
        'single-leg-landing-stick',
        'single-leg-line-hop-and-stick',
        'needs_human_review',
        'landing_stick_source_does_not_declare_entry_or_takeoff',
        'Single-Leg Line Hop and Stick declares a line-crossing hop before the terminal landing. Single-Leg Landing Stick describes unilateral landing ownership but does not declare whether entry is a step, fall, jump, hop, or drop. Entry and takeoff determine whether the cards overlap.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/32992140/')
      ),
      (
        'single-leg-pogo',
        'single-leg-pogo-hold-stick',
        'needs_human_review',
        'pogo_hold_source_does_not_declare_repeated_contact_and_terminal_hold_sequence',
        'Single-Leg Pogo explicitly requires repeated ankle-dominant contacts without an intentional stick between repetitions. Pogo Hold-Stick does not state the number of pogo contacts or whether a distinct terminal hold follows them. Contact count and finish sequence are required before consolidation.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/20072070/')
      ),
      (
        'single-leg-rdl-airplane',
        'single-leg-romanian-deadlift',
        'distinct_exercises',
        'rotational_pelvic_open_close_control_vs_square_pelvis_loaded_hinge',
        'Single-Leg RDL Airplane deliberately opens and closes the pelvis or trunk while holding a single-leg hinge. Single-Leg Romanian Deadlift maintains a square pelvis while lowering and raising through the hinge. Rotation policy, repetition boundary, range, balance, loading, and stop rules differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/24978835/')
      ),
      (
        'slam-ball-bear-hug-carry',
        'slam-ball-bear-hug-squat',
        'distinct_exercises',
        'loaded_locomotion_vs_loaded_squat_repetitions',
        'Slam Ball Bear-Hug Carry walks with the ball secured against the trunk. Slam Ball Bear-Hug Squat remains in place and cycles through hip, knee, and ankle flexion and extension. Locomotion, joint actions, distance versus repetitions, space, fatigue, and stop rules differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/38665162/')
      ),
      (
        'tibialis-raise-iso-hold',
        'tibialis-raises',
        'distinct_exercises',
        'ankle_dorsiflexion_isometric_hold_vs_dynamic_repetitions',
        'Tibialis Raise Iso Hold maintains a declared dorsiflexed ankle position without visible motion for time. Tibialis Raises repeatedly lower and lift the forefoot through range. Contraction type, range, dose unit, fatigue profile, measurement, and stop rules differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/27632850/')
      ),
      (
        'wall-handstand-hold',
        'wall-walk-handstand-line',
        'distinct_exercises',
        'static_wall_supported_hold_vs_dynamic_wall_walk_entry_and_exit',
        'Wall Handstand Hold begins in a supported inverted position and maintains it for time. Wall Walk-Up to Handstand Line includes a dynamic floor-to-wall entry, hand and foot travel, terminal line, and controlled exit. Ordered actions, contact changes, distance, dose, fatigue, and failure response differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/41473027/')
      ),
      (
        'x-drill-cone-cut',
        'zig-zag-cone-cut-drill',
        'distinct_exercises',
        'crossing_x_route_with_center_transitions_vs_sequential_zig_zag_route',
        'X-Drill Cone Cut repeatedly crosses a central space between diagonal corners. Zig-Zag Cone Cut follows sequential offset cones without the same center crossing. Route graph, approach angle, cut order, traffic pattern, spacing, repetition boundary, and measurement differ.',
        jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/')
      ),
      (
        'front-squat',
        'split-squat',
        'distinct_exercises',
        'bilateral_front_loaded_squat_vs_stationary_split_stance_squat',
        'Front Squat uses a symmetrical stance and anterior external load while both legs share the squat cycle. Split Squat uses a stationary staggered stance, emphasizes the front leg, and keeps the rear leg as balance assistance. Base of support, load symmetry, joint contribution, laterality, balance, setup, and repetition boundary differ.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/30676181/',
          'https://pubmed.ncbi.nlm.nih.gov/33161870/'
        )
      ),
      (
        'negative-pull-up',
        'push-up',
        'distinct_exercises',
        'vertical_eccentric_pull_vs_horizontal_bodyweight_push',
        'Negative Pull-Up begins above or near the bar and controls a vertical pulling descent through grip, elbow extension, and scapular motion. Push-Up lowers and presses the body relative to hand support in a horizontal pushing pattern. Force direction, joint actions, support, grip, contraction sequence, setup, and failure response differ.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/28011412/',
          'https://pubmed.ncbi.nlm.nih.gov/29541105/'
        )
      ),
      (
        'low-hurdle-hops',
        'low-hurdle-step-over',
        'distinct_exercises',
        'repeated_airborne_elastic_hops_vs_grounded_alternating_step_overs',
        'Low Hurdle Hops use repeated airborne bilateral contacts with quick rebound intent. Low Hurdle Step-Over Series keeps a grounded stepping strategy and clears one leg at a time for hip control and balance. Flight, contact order, stance, intent, impact, joint actions, measurement, and stop rules differ.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/17620779/',
          'https://pubmed.ncbi.nlm.nih.gov/39228781/'
        )
      ),
      (
        'icky-shuffle',
        'lateral-shuffle-decel-stick',
        'distinct_exercises',
        'ladder_inside_outside_contact_sequence_vs_open_space_lateral_braking',
        'Icky Shuffle follows a declared inside-inside-outside ladder contact sequence and continues through the boxes. Lateral Shuffle Decel Stick travels laterally in open space and ends with an intentional braking hold. Route, contact sequence, terminal action, equipment, direction policy, dose, and success criteria differ.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/24290613/',
          'https://pubmed.ncbi.nlm.nih.gov/33217086/'
        )
      ),
      (
        'icky-shuffle',
        'lateral-one-in-shuffle',
        'distinct_exercises',
        'inside_inside_outside_icky_sequence_vs_single_contact_per_ladder_box',
        'Icky Shuffle uses an inside-inside-outside contact sequence with repeated entry and exit around each ladder box. Lateral One-In Shuffle places one declared contact in each successive box while traveling sideways. Contact graph, foot order, box occupancy, facing, rhythm, error state, and measurement differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/24290613/')
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
