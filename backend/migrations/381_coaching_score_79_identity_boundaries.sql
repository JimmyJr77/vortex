-- Adjudicate the mechanically distinct and source-ambiguous pairs in the
-- score-79 canonical identity queue after the score-80 consolidations.
--
-- These records resolve identity only. They do not approve or publish cards,
-- media, relationships, calibration, or dosage. Exercise cards use exercise
-- complexity and physical difficulty only; athlete skill/proficiency levels
-- remain exclusive to the skill library. IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '381_coaching_score_79_identity_boundaries';
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
        '90-degree-hop-to-stick',
        '90-degree-jump-turn-to-stick',
        'needs_human_review',
        'quarter_turn_cards_do_not_declare_takeoff_or_landing_laterality',
        'Both cards describe a quarter-turn projection and terminal stick, but neither source declares whether hop means unilateral takeoff and landing or merely uses hop as a synonym for a bilateral jump. Takeoff foot count, landing foot count, turn direction, and reset contract determine identity and cannot be inferred safely.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/17620779/',
          'https://pubmed.ncbi.nlm.nih.gov/39228781/'
        )
      ),
      (
        'a-skip-through-ladder',
        'skier-hops-through-ladder',
        'distinct_exercises',
        'alternating_skip_contacts_vs_bilateral_lateral_hops',
        'A-Skip Through Ladder alternates marching or skipping contacts with a cyclical knee drive. Skier Hops Through Ladder uses repeated lateral projections with simultaneous or paired-foot contacts. Contact order, flight, direction, force vector, rhythm, and failure state differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/24290613/')
      ),
      (
        'box-squat',
        'barbell-hack-squat',
        'distinct_exercises',
        'supported_squat_to_box_vs_barbell_held_behind_legs',
        'Box Squat requires a declared box or bench contact and a controlled reversal from that support target. Barbell Hack Squat holds the bar behind the legs without a required box. Implement path, support contact, center of mass, setup, range target, and safe failure differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/22505136/')
      ),
      (
        'barbell-seal-row',
        'bent-over-barbell-row',
        'distinct_exercises',
        'bench_supported_prone_row_vs_unsupported_standing_hinge_row',
        'Seal Row supports the torso prone on an elevated bench while the load moves below it. Bent-Over Row requires the athlete to maintain a standing hip hinge while rowing. Support, spinal loading, hip-extensor demand, equipment clearance, setup, and stop rules differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/19620925/')
      ),
      (
        'barbell-bench-press',
        'dumbbell-overhead-press-eccentric',
        'distinct_exercises',
        'supine_horizontal_press_vs_vertical_press_with_eccentric_emphasis',
        'Bench Press uses a supine bench-supported base and horizontal press path. Dumbbell Overhead Press Eccentric uses a seated or standing base, vertical path, head clearance, and deliberately prolonged lowering. Orientation, force direction, range, support, tempo, spotting, and fatigue differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/23096062/')
      ),
      (
        'lateral-hop-to-stick',
        'single-leg-hop-to-stick',
        'distinct_exercises',
        'bilateral_lateral_jump_vs_unilateral_hop_family',
        'Bilateral Lateral Jump to Stick uses two-foot projection and landing. Single-Leg Hop to Stick requires a declared support leg and unilateral landing control. Foot count, laterality, force distribution, impact budget, side-specific dose, and progression criteria differ.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/17620779/',
          'https://pubmed.ncbi.nlm.nih.gov/39228781/'
        )
      ),
      (
        'box-jump-to-depth-drop',
        'standing-box-jump-to-single-leg-landing',
        'distinct_exercises',
        'box_jump_then_step_or_drop_to_floor_vs_terminal_single_leg_box_landing',
        'Box Jump to Depth Drop adds a second descent and floor landing after the box jump. Standing Box Jump to Single-Leg Landing ends on one foot on the box. Action count, landing surface, foot count, drop exposure, clearance, exit, and impact budget differ.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/17620779/',
          'https://pubmed.ncbi.nlm.nih.gov/39228781/'
        )
      ),
      (
        'color-call-cone-cut',
        'color-cone-touch-on-call',
        'distinct_exercises',
        'reactive_cut_and_exit_vs_reactive_reach_or_touch',
        'Color-Call Cone Cut requires a plant, redirection, and declared exit after the cue. Color Cone Touch on Call requires reaching or traveling to touch a target and may finish there. Terminal action, braking, center-of-mass height, hand use, route, measurement, and spacing differ.',
        jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/')
      ),
      (
        'countermovement-medicine-ball-scoop-toss',
        'medicine-ball-scoop-toss',
        'needs_human_review',
        'countermovement_source_declares_rotation_but_not_projection_or_arm_contract',
        'The countermovement card calls itself a scoop toss but its family text declares rotational pre-load; the generic scoop-toss card declares hip extension and horizontal projection without stance, arm count, or direction. Those facts determine whether countermovement is only a variant or whether the cards represent rotational and linear throws.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/39589937/')
      ),
      (
        'drop-jump',
        'reactive-broad-jump-d7',
        'distinct_exercises',
        'elevated_step_off_to_immediate_rebound_vs_approach_horizontal_jump_to_stick',
        'Drop Jump begins by stepping from an elevated surface and rebounds after the imposed landing. Reactive Broad Jump uses an approach into a horizontal takeoff and terminal stick without the same step-off contract. Entry, equipment, contact sequence, projection, landing, and measurement differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/20072070/')
      ),
      (
        'dumbbell-reverse-curl',
        'reverse-lunge',
        'distinct_exercises',
        'elbow_flexion_with_pronated_grip_vs_lower_body_step_and_return',
        'Dumbbell Reverse Curl is an upper-body elbow-flexion exercise using a pronated grip. Reverse Lunge is a lower-body stepping task with hip, knee, and ankle flexion and extension. Anatomy, joint actions, implement, support, balance, load path, and dosage are unrelated.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/22889652/')
      ),
      (
        'dumbbell-z-press',
        'kettlebell-strict-press',
        'distinct_exercises',
        'floor_seated_press_with_extended_legs_vs_standing_or_declared_base_strict_press',
        'Dumbbell Z-Press fixes the athlete on the floor with legs extended and removes lower-body support. Kettlebell Strict Press uses a standing or otherwise declared base without leg drive. Support, hip position, trunk demand, implement path, setup, and safe failure differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/23096062/')
      ),
      (
        'farmer-carry',
        'front-rack-carry',
        'distinct_exercises',
        'loads_at_sides_vs_loads_supported_at_front_rack',
        'Farmer Carry holds loads beside the thighs with long arms. Front-Rack Carry supports loads at the shoulders in front of the trunk. Load position, grip and wrist demand, breathing constraint, trunk moment, equipment, load ceiling, and stop rules differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/38665162/')
      ),
      (
        'forward-hop-to-stick-low-amplitude',
        'lateral-hop-to-stick',
        'distinct_exercises',
        'forward_low_amplitude_projection_vs_lateral_bilateral_projection',
        'Forward Hop to Stick projects along the sagittal plane at deliberately low amplitude. Bilateral Lateral Jump to Stick projects in the frontal plane. Direction, visual target, force vector, braking strategy, spacing, and measurement differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/39228781/')
      ),
      (
        'front-support-shape-hold',
        'rear-support-shape-hold',
        'distinct_exercises',
        'prone_facing_support_vs_supine_facing_support',
        'Front Support faces the floor with the shoulders loaded over the hands in a prone plank shape. Rear Support faces away from the floor with shoulder extension behind the trunk. Orientation, shoulder angle, primary joint actions, visual field, entry, exit, and stop rules differ.',
        jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC6033506/')
      ),
      (
        'front-foot-elevated-split-squat',
        'heels-elevated-front-squat',
        'distinct_exercises',
        'asymmetrical_split_stance_front_foot_elevation_vs_bilateral_front_rack_heel_elevation',
        'Front-Foot-Elevated Split Squat uses a stationary asymmetrical stance and elevates the entire front foot. Heels-Elevated Front Squat uses a bilateral stance, front-racked barbell, and heel wedge. Stance, laterality, load position, support surface, side dose, setup, and spotting differ.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/22889652/',
          'https://pubmed.ncbi.nlm.nih.gov/33161870/'
        )
      ),
      (
        'hamstring-slider-curl',
        'slow-eccentric-hamstring-curl-machine',
        'distinct_exercises',
        'supine_bridge_slider_curl_vs_machine_supported_knee_flexion',
        'Hamstring Slider Curl uses heel sliders while the athlete maintains a supine bridge. Slow Eccentric Hamstring Curl Machine fixes the athlete in a machine and emphasizes loaded lowering about the knee. Support, hip action, resistance curve, equipment, load ceiling, setup, and fatigue differ.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/41318473/',
          'https://pubmed.ncbi.nlm.nih.gov/24978835/'
        )
      ),
      (
        'kettlebell-swing',
        'single-leg-romanian-deadlift',
        'distinct_exercises',
        'ballistic_bilateral_hip_hinge_vs_controlled_unilateral_hinge',
        'Kettlebell Swing is a ballistic bilateral hinge with repeated projection of the implement. Single-Leg Romanian Deadlift is a controlled unilateral hinge with a free-leg counterbalance. Velocity intent, stance, laterality, balance, implement path, repetition boundary, and fatigue differ.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/41318473/',
          'https://pubmed.ncbi.nlm.nih.gov/24978835/'
        )
      ),
      (
        'landmine-ball-grip-anti-rotation-hold',
        'landmine-rotational-press',
        'distinct_exercises',
        'isometric_resistance_to_rotation_vs_intentional_rotation_and_press',
        'Landmine Ball-Grip Anti-Rotation Hold prevents visible trunk rotation while maintaining an isometric position. Landmine Rotational Press deliberately rotates through the base and finishes with a press. Rotation policy, contraction type, range, dose unit, path, fatigue, and stop rules differ.',
        jsonb_build_array(
          'https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/'
        )
      ),
      (
        'landmine-ball-grip-rotational-press',
        'landmine-drop-step-rotational-press',
        'distinct_exercises',
        'declared_ball_grip_interface_vs_declared_drop_step_approach_sequence',
        'Ball-Grip Rotational Press is defined by its specialty end-of-bar hand interface and does not declare a drop-step entry. Drop-Step Rotational Press is defined by a preparatory step that changes momentum, stance, and sequencing and does not declare the ball grip. Attachment, entry action, contact sequence, setup, load tolerance, and repetition boundary differ.',
        jsonb_build_array(
          'https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/'
        )
      ),
      (
        'landmine-rotational-press',
        'landmine-handle-grip-rotational-row',
        'distinct_exercises',
        'rotational_push_vs_rotational_pull',
        'Landmine Rotational Press moves the loaded end away through an angled pressing path. Landmine Handle-Grip Rotational Row pulls the load toward the trunk. Terminal joint actions, force direction, grip attachment, primary tissues, stance timing, and safe failure differ.',
        jsonb_build_array(
          'https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/'
        )
      ),
      (
        'landmine-clean-to-press',
        'landmine-press',
        'distinct_exercises',
        'floor_or_low_start_clean_then_press_vs_press_only',
        'Landmine Clean to Press begins with a pull, turnover, or transfer from a low start before pressing. Landmine Press begins from the established rack or shoulder position. Action count, start height, grip transition, lower-body contribution, repetition duration, and safe failure differ.',
        jsonb_build_array(
          'https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/'
        )
      ),
      (
        'landmine-front-squat',
        'landmine-split-squat',
        'distinct_exercises',
        'bilateral_squat_vs_asymmetrical_split_stance_squat',
        'Landmine Front Squat uses a bilateral stance and center-supported landmine load. Landmine Split Squat uses a stationary asymmetrical stance and primarily loads the front leg. Stance, laterality, balance, side-specific dose, load tolerance, and setup differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/22889652/')
      ),
      (
        'landmine-press',
        'one-arm-landmine-arc-press',
        'needs_human_review',
        'arc_press_source_does_not_declare_whether_arc_is_path_or_eccentric_only_variant',
        'The generic landmine press declares an angled press. The arc-press source also aliases an eccentric landmine press but does not define the arc, stance, handoff, lowering path, or whether the concentric action is the same press. Those facts are required before consolidation.',
        jsonb_build_array(
          'https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/'
        )
      ),
      (
        'landmine-press',
        'one-arm-landmine-z-press',
        'distinct_exercises',
        'standing_or_kneeling_angled_press_vs_floor_seated_extended_leg_press',
        'Landmine Press uses a standing, split, or kneeling base as declared by its variant. One-Arm Landmine Z-Press fixes the athlete seated on the floor with legs extended. Support, hip position, trunk demand, setup, range, and safe failure differ.',
        jsonb_build_array(
          'https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/'
        )
      ),
      (
        'landmine-split-stance-rotational-press',
        'split-stance-one-arm-landmine-press',
        'distinct_exercises',
        'split_stance_press_with_declared_rotation_vs_fixed_split_stance_press',
        'Landmine Split-Stance Rotational Press intentionally rotates through its split base. Split-Stance One-Arm Landmine Press fixes the base and preserves torso organization unless an exact variant says otherwise. Rotation policy, foot action, hip contribution, force transfer, path, and stop rules differ.',
        jsonb_build_array(
          'https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/'
        )
      ),
      (
        'landmine-rotational-press',
        'split-stance-one-arm-landmine-press',
        'distinct_exercises',
        'intentional_whole_body_rotation_vs_anti_rotation_split_stance_press',
        'Landmine Rotational Press intentionally turns through the feet, hips, and trunk during the press. Split-Stance One-Arm Landmine Press uses a fixed split base and preserves torso organization unless an exact variant declares rotation. Rotation policy, foot action, force transfer, path, and stop rules differ.',
        jsonb_build_array(
          'https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/'
        )
      ),
      (
        'lateral-icky-shuffle',
        'lateral-one-in-shuffle',
        'distinct_exercises',
        'inside_outside_multi_contact_pattern_vs_one_contact_per_box',
        'Lateral Icky Shuffle uses a declared inside-inside-outside or equivalent multi-contact rhythm. Lateral One-In Shuffle places one declared contact in each box while traveling laterally. Contact count, sequence, crossover policy, cadence, error state, and measurement differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/24290613/')
      ),
      (
        'low-box-jump-to-stick',
        'low-box-step-off-to-stick',
        'distinct_exercises',
        'concentric_jump_to_box_vs_passive_step_off_to_floor_landing',
        'Low Box Jump to Stick includes a concentric takeoff and ends on the box. Low Box Step-Off to Stick removes the first takeoff and ends on the floor after an imposed drop. Projection, flight origin, landing surface, impact, box use, and exit differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/17620779/')
      ),
      (
        'low-hurdle-hops',
        'low-hurdle-hop-to-stick',
        'distinct_exercises',
        'repeated_reactive_hurdle_contacts_vs_single_clearance_to_terminal_stick',
        'Low Hurdle Hops use repeated reactive clearances and short ground contacts. Low Hurdle Hop to Stick uses one declared clearance followed by braking and a frozen landing. Contact count, rebound policy, terminal state, impact accumulation, dose unit, and quality gate differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/20072070/')
      ),
      (
        'low-hurdle-lateral-hop-to-stick',
        'single-leg-lateral-hop-to-stick',
        'needs_human_review',
        'hurdle_source_does_not_declare_takeoff_or_landing_foot_count',
        'Both cards describe lateral projection to a terminal stick, but the low-hurdle source does not declare unilateral versus bilateral takeoff or landing. Foot count determines whether the hurdle is an exact variant of the single-leg family or a distinct bilateral jump.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/17620779/',
          'https://pubmed.ncbi.nlm.nih.gov/39228781/'
        )
      ),
      (
        'medicine-ball-chest-pass',
        'medicine-ball-v-up-pass',
        'distinct_exercises',
        'standing_or_athletic_base_horizontal_pass_vs_supine_trunk_flexion_pass',
        'Medicine Ball Chest Pass projects the ball from an athletic standing or declared base. Medicine Ball V-Up Pass combines supine trunk and hip flexion with the pass. Orientation, support, action sequence, trunk demand, release timing, catch, and safe failure differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/39589937/')
      ),
      (
        'medicine-ball-lateral-shuffle-pass',
        'partner-band-resisted-lateral-shuffle',
        'distinct_exercises',
        'lateral_locomotion_with_ball_release_vs_lateral_locomotion_against_band',
        'Medicine Ball Lateral Shuffle Pass adds a timed catch or release while shuffling. Partner Band-Resisted Lateral Shuffle adds continuous external resistance without a ball flight. Implement, partner role, force direction, hand task, spacing, stop rule, and measurement differ.',
        jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/')
      ),
      (
        'medicine-ball-rotational-catch-and-stick',
        'medicine-ball-scoop-toss-catch-and-stick',
        'distinct_exercises',
        'transverse_rotation_absorption_vs_low_to_high_scoop_absorption',
        'Rotational Catch-and-Stick organizes a transverse-plane catch and resists continued rotation. Scoop Toss Catch-and-Stick receives a low-to-high projection and controls a hip-hinge pattern. Ball trajectory, stance, joint actions, braking direction, partner position, and error state differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/39589937/')
      ),
      (
        'medicine-ball-rotational-throw',
        'medicine-ball-shot-put-throw',
        'distinct_exercises',
        'two_hand_rotational_projection_vs_single_arm_shot_put_projection',
        'The canonical rotational throw requires a declared two-hand projection. Medicine Ball Shot-Put Throw uses one arm with asymmetrical pressing and front-side bracing. Arm count, grip, release path, trunk strategy, laterality, load ceiling, and catch policy differ.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/39589937/',
          'https://pubmed.ncbi.nlm.nih.gov/31368410/'
        )
      ),
      (
        'medicine-ball-scoop-toss',
        'medicine-ball-scoop-toss-catch-and-stick',
        'distinct_exercises',
        'ballistic_release_only_vs_received_ball_absorption_and_stick',
        'Medicine Ball Scoop Toss is defined by projecting the ball. Scoop Toss Catch-and-Stick is defined by receiving a projected ball, absorbing it through a hinge, and freezing the finish. Release versus catch, partner role, incoming load, braking, spacing, and safety differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/39589937/')
      ),
      (
        'medicine-ball-scoop-toss',
        'medicine-ball-scoop-toss-to-broad-rebound',
        'distinct_exercises',
        'medicine_ball_projection_only_vs_throw_combined_with_horizontal_rebound',
        'Medicine Ball Scoop Toss ends after ball release. Scoop Toss to Broad Rebound couples the throw with a horizontal jump or rebound sequence. Action count, flight, landing, impact budget, ball retrieval, spacing, fatigue, and stop rules differ.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/39589937/',
          'https://pubmed.ncbi.nlm.nih.gov/20072070/'
        )
      ),
      (
        'pause-bodyweight-squat',
        'split-squat',
        'distinct_exercises',
        'bilateral_squat_with_pause_vs_stationary_asymmetrical_squat',
        'Pause Bodyweight Squat uses a bilateral stance and declared pause. Split Squat uses a stationary asymmetrical stance and side-specific loading. Stance, laterality, balance, joint strategy, dose assignment, and progression differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/22889652/')
      ),
      (
        'pogo-jumps',
        'pogo-to-box-jump',
        'distinct_exercises',
        'repeated_ankle_dominant_contacts_vs_pogos_feeding_terminal_box_jump',
        'Pogo Jumps are repeated ankle-dominant contacts with no terminal obstacle. Pogo to Box Jump uses the contacts as an entry sequence to a separate box projection and landing. Action sequence, equipment, clearance, terminal landing, impact, and dose differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/20072070/')
      ),
      (
        'rotational-bound-to-stick',
        'rotational-broad-jump-to-stick',
        'needs_human_review',
        'bound_source_does_not_declare_unilateral_or_bilateral_takeoff_and_landing',
        'Both cards describe rotational horizontal projection to a terminal stick. The bound source also aliases a lateral bound, but neither source declares takeoff and landing foot count consistently. Laterality determines whether these are one identity or distinct unilateral and bilateral exercises.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/17620779/',
          'https://pubmed.ncbi.nlm.nih.gov/39228781/'
        )
      ),
      (
        'incline-push-up',
        'plyo-push-up',
        'distinct_exercises',
        'continuous_incline_press_vs_ballistic_hand_release_press',
        'Incline Push-Up keeps the hands in continuous contact with an elevated support through controlled repetitions. Plyo Push-Up accelerates until the hands unload or leave the support and then receives a landing. Contact policy, velocity intent, flight, impact, support use, fatigue cap, and stop rules differ.',
        jsonb_build_array('https://pmc.ncbi.nlm.nih.gov/articles/PMC6033506/')
      ),
      (
        'medicine-ball-rotational-throw',
        'medicine-ball-scoop-toss',
        'distinct_exercises',
        'transverse_two_hand_rotation_vs_sagittal_low_to_high_scoop_projection',
        'Medicine Ball Rotational Throw loads the outside hip and projects from a standing transverse-plane rotation. Medicine Ball Scoop Toss uses a low-to-high hip-extension path for horizontal projection without the declared transverse rotation contract. Stance, plane, arm path, release angle, target, and measurement differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/39589937/')
      ),
      (
        'drop-jump',
        'snap-down-to-rebound',
        'distinct_exercises',
        'elevated_step_off_ground_contact_vs_self_initiated_rapid_descent',
        'Drop Jump begins by stepping from an elevated surface and receiving the resulting ground contact before rebounding. Snap-Down to Rebound begins on the floor and creates the landing shape through a rapid active descent. Entry, equipment, fall height, impact source, contact sequence, and progression differ.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/17620779/',
          'https://pubmed.ncbi.nlm.nih.gov/20072070/'
        )
      ),
      (
        'medicine-ball-rotational-throw',
        'medicine-ball-scoop-toss-catch-and-stick',
        'distinct_exercises',
        'outgoing_rotational_projection_vs_incoming_scoop_catch_absorption',
        'Medicine Ball Rotational Throw is defined by releasing a two-hand transverse-plane projection. Scoop Toss Catch-and-Stick is defined by receiving an incoming low-to-high ball, absorbing through a hinge, and holding the finish. Release versus catch, trajectory, partner role, braking, spacing, and safety differ.',
        jsonb_build_array('https://pubmed.ncbi.nlm.nih.gov/39589937/')
      ),
      (
        'landmine-ball-grip-anti-rotation-hold',
        'landmine-ball-grip-rotational-press',
        'distinct_exercises',
        'ball_grip_isometric_anti_rotation_vs_ball_grip_dynamic_rotation_and_press',
        'Both sources use the specialty ball-grip interface, but the anti-rotation hold prevents visible motion for time while the rotational press deliberately rotates and presses through range. Rotation policy, contraction type, joint actions, dose unit, load tolerance, fatigue, and stop rules differ.',
        jsonb_build_array(
          'https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/'
        )
      ),
      (
        'landmine-ball-grip-rotational-press',
        'landmine-handle-grip-rotational-row',
        'distinct_exercises',
        'ball_grip_rotational_push_vs_handle_grip_rotational_pull',
        'Ball-Grip Rotational Press moves the loaded end away through an angled pushing path. Handle-Grip Rotational Row pulls the load toward the trunk. Attachment, terminal joint actions, force direction, primary tissues, stance timing, load ceiling, and safe failure differ.',
        jsonb_build_array(
          'https://www.nsca.com/education/articles/nsca-coach/the-landmine-pressimplementation-and-variation/'
        )
      ),
      (
        'split-squat',
        'tempo-bodyweight-squat',
        'distinct_exercises',
        'stationary_asymmetrical_squat_vs_bilateral_squat_with_declared_tempo',
        'Split Squat uses a stationary asymmetrical stance and side-specific loading. Tempo Bodyweight Squat uses a bilateral stance and manipulates repetition cadence. Stance, laterality, balance, joint strategy, dose assignment, and progression differ.',
        jsonb_build_array(
          'https://pubmed.ncbi.nlm.nih.gov/22889652/',
          'https://pubmed.ncbi.nlm.nih.gov/42401924/'
        )
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
