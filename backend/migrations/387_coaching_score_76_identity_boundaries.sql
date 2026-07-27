-- Adjudicate mechanically distinct and source-ambiguous pairs in the score-76
-- canonical identity queue after the score-77 pass.
--
-- Identity decisions do not approve cards, media, relationships, calibration,
-- or publication. Exercise cards use exercise complexity and physical
-- difficulty only; skill/proficiency levels belong only to coaching.skill.
-- IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '387_coaching_score_76_identity_boundaries';
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
        '180-jump-to-stick',
        '90-degree-hop-to-stick',
        'distinct_exercises',
        'half_turn_bilateral_jump_reorientation_vs_quarter_turn_hop_contract',
        '180 Jump to Stick requires a half-turn reorientation before the terminal landing. 90-Degree Hop to Stick uses a quarter-turn hop contract. Rotation magnitude, takeoff contract, visual reorientation, landing orientation, complexity, space, and failure state differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/33359798/"]'::JSONB
      ),
      (
        '5-0-5-change-of-direction',
        'box-drill-change-of-direction',
        'distinct_exercises',
        'single_180_degree_timed_change_of_direction_vs_multi_segment_box_route',
        'The 5-0-5 is a single approach, 180-degree plant, and timed exit. The Box Drill follows a multi-segment route with several turns. Route geometry, number and angle of cuts, timing gates, distance, error states, and dose differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/33217086/"]'::JSONB
      ),
      (
        'backpedal-to-sprint-to-stick',
        'serpentine-sprint-to-backpedal-drill',
        'distinct_exercises',
        'backpedal_to_forward_transition_and_terminal_stick_vs_curved_forward_route_then_backpedal',
        'Backpedal to Sprint to Stick transitions from backward locomotion into forward acceleration and ends in a held stop. Serpentine Sprint to Backpedal follows a curved forward route before changing to backward locomotion. Action order, route, transitions, terminal action, space, and measurement differ.',
        '["https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/","https://pubmed.ncbi.nlm.nih.gov/33217086/"]'::JSONB
      ),
      (
        'backward-roll-progression',
        'forward-roll-progression',
        'distinct_exercises',
        'posterior_rolling_direction_and_hand_support_vs_anterior_rolling_direction',
        'Backward Roll Progression travels over the posterior shoulder line and requires a backward hand-support and head-clearance strategy. Forward Roll Progression travels anteriorly over the shoulder line. Direction, visual field, hand placement, neck-risk management, spotting, and prerequisites differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/22889652/"]'::JSONB
      ),
      (
        'banded-hamstring-curl',
        'dumbbell-hamstring-curl',
        'needs_human_review',
        'sources_do_not_declare_body_orientation_support_or_implement_retention_contract',
        'Both sources declare loaded knee flexion, but neither source declares prone, standing, seated, or supine orientation; the support surface; exact hip position; or how the band or dumbbell is retained. Those facts determine whether implement is only a variant or the cards represent different tasks.',
        '["https://pubmed.ncbi.nlm.nih.gov/38156065/"]'::JSONB
      ),
      (
        'banded-hamstring-curl',
        'hamstring-slider-curl',
        'distinct_exercises',
        'generic_banded_knee_flexion_vs_supine_bridge_with_heel_slide_cycle',
        'Banded Hamstring Curl declares resisted knee flexion without a sliding bridge task. Hamstring Slider Curl requires a supine bridge while the heels slide away and return. Orientation, support, hip action, foot interface, kinetic-chain behavior, range, and failure response differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/40827942/"]'::JSONB
      ),
      (
        'barbell-hack-squat',
        'split-squat',
        'distinct_exercises',
        'bilateral_barbell_hack_squat_vs_stationary_asymmetrical_split_stance',
        'Barbell Hack Squat uses a bilateral squat pattern with the bar held behind the legs. Split Squat uses a stationary staggered base with a lead-leg bias and rear-leg support. Stance, load path, symmetry, laterality, balance, pickup, and failure response differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/30676181/"]'::JSONB
      ),
      (
        'bear-hug-sandbag-carry',
        'sandbag-front-loaded-squat-strength',
        'distinct_exercises',
        'loaded_gait_with_bear_hug_support_vs_stationary_repeated_squat',
        'Bear-Hug Sandbag Carry walks with the load held against the trunk. Sandbag Squat repeatedly descends and stands from a stationary base. Locomotion, joint excursion, distance, repetition boundary, space, fatigue exposure, and stop rules differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/38665162/","https://pubmed.ncbi.nlm.nih.gov/30676181/"]'::JSONB
      ),
      (
        'barbell-bench-press',
        'dumbbell-incline-press',
        'distinct_exercises',
        'horizontal_barbell_press_from_flat_bench_vs_incline_independent_arm_press',
        'Barbell Bench Press uses one bar from a flat or declared horizontal bench path. Dumbbell Incline Press uses independent implements and an inclined torso. Bench angle, implement coupling, force direction, stabilization, pickup, range boundary, and spotting differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/23096062/"]'::JSONB
      ),
      (
        'bottoms-up-kettlebell-press',
        'dumbbell-z-press',
        'distinct_exercises',
        'unstable_inverted_kettlebell_press_vs_floor_seated_dumbbell_vertical_press',
        'Bottoms-Up Kettlebell Press keeps the bell inverted above the handle, making grip and implement balance defining. Dumbbell Z-Press fixes a floor-seated legs-extended base with conventional dumbbells. Interface, implement stability, base, hip position, trunk demand, setup, and failure consequence differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/19620925/"]'::JSONB
      ),
      (
        'bound-to-stick',
        'rotational-bound-to-stick',
        'needs_human_review',
        'generic_bound_source_does_not_declare_projection_direction_or_rotation_contract',
        'Bound to Stick declares a one-leg-to-opposite-leg bound and terminal hold but does not declare projection direction or whether axial rotation is allowed. Rotational Bound to Stick declares rotation. Direction and rotation must be recovered from an authoritative source before deciding whether rotation is a variant or a distinct task.',
        '["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB
      ),
      (
        'broad-jump-to-box-jump',
        'broad-jump-to-stick',
        'distinct_exercises',
        'horizontal_jump_then_second_box_jump_vs_single_horizontal_jump_and_terminal_landing',
        'Broad Jump to Box Jump contains two ordered projections with an intermediate landing and second takeoff to a box. Broad Jump to Stick contains one horizontal projection and terminal landing. Contact order, equipment, elastic transition, total impact, space, repetition boundary, and stop rules differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/17544325/","https://pubmed.ncbi.nlm.nih.gov/17620779/"]'::JSONB
      ),
      (
        'carioca-bound-to-stick',
        'curved-bound-to-stick',
        'distinct_exercises',
        'crossover_carioca_entry_then_bound_vs_bound_along_declared_curved_path',
        'Carioca Bound to Stick requires crossover locomotion before the bound. Curved Bound to Stick follows a curved projection path without that required carioca sequence. Entry contacts, route geometry, hip action, footwork, space, timing, and error states differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB
      ),
      (
        'crossover-run-to-stick',
        'crossover-step-to-bound-and-stick',
        'distinct_exercises',
        'multi_contact_crossover_run_then_brake_vs_crossover_entry_to_single_bound_landing',
        'Crossover Run to Stick uses running contacts before braking to a hold. Crossover Step to Bound and Stick uses a crossover entry to create a declared airborne bound and terminal landing. Contact sequence, flight, speed, braking, space, and dose differ.',
        '["https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/","https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB
      ),
      (
        'curve-sprint-build-up',
        'sprint-float-sprint-build-up',
        'distinct_exercises',
        'progressive_acceleration_on_curved_lane_vs_speed_relaxation_and_reacceleration',
        'Curve Sprint Build-Up progressively accelerates while following a curved lane. Sprint-Float-Sprint Build-Up alternates speed or relaxation and re-acceleration along its declared route. Route geometry, velocity sequence, force orientation, lane setup, measurement, and error states differ.',
        '["https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/"]'::JSONB
      ),
      (
        'decline-push-up',
        'plyo-push-up',
        'distinct_exercises',
        'feet_elevated_continuous_closed_chain_press_vs_ballistic_hand_release_press',
        'Decline Push-Up elevates the feet and maintains hand contact through controlled repetitions. Plyometric Push-Up deliberately projects the hands or upper body away from support. Flight, contact timing, intent, impact, surface, readiness, and stop rules differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/29541105/"]'::JSONB
      ),
      (
        'depth-drop-to-box-jump',
        'depth-jump',
        'distinct_exercises',
        'drop_contact_then_jump_to_second_box_vs_drop_contact_to_vertical_rebound',
        'Depth Drop to Box Jump steps from one box, receives the floor contact, and jumps to a second box. Depth Jump rebounds vertically from the floor without a required box landing. Target, contact sequence, landing height, box layout, clearance, measurement, and safe failure zone differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/17620779/","https://pubmed.ncbi.nlm.nih.gov/27428530/"]'::JSONB
      ),
      (
        'drop-catch-medicine-ball-chest-pass',
        'kneeling-medicine-ball-chest-pass',
        'distinct_exercises',
        'incoming_drop_catch_then_chest_projection_vs_kneeling_chest_projection_without_drop_catch',
        'Drop-Catch Medicine Ball Chest Pass begins by receiving a dropped ball and then re-projecting it. Kneeling Chest Pass begins from a kneeling base without the required incoming drop. Action order, base, external timing, catch impulse, leg contribution, partner contract, and repetition boundary differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'drop-catch-medicine-ball-chest-pass',
        'medicine-ball-pivot-catch-and-pass',
        'distinct_exercises',
        'vertical_drop_catch_then_chest_pass_vs_directional_catch_pivot_and_pass',
        'Drop-Catch Chest Pass receives a vertically dropped ball before the pass. Pivot Catch-and-Pass receives a directional pass, establishes a pivot, reorients, and passes. Incoming trajectory, footwork, rotation, action order, partner positioning, and error states differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'dumbbell-hamstring-curl',
        'nordic-hamstring-curl',
        'distinct_exercises',
        'externally_loaded_knee_flexion_vs_ankle_anchored_kneeling_body_lowering',
        'Dumbbell Hamstring Curl moves an external implement through knee flexion. Nordic Hamstring Curl anchors the ankles and lowers the largely straight trunk and thighs from kneeling. Orientation, kinetic chain, load path, assistance, range, setup, and failure response differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/38156065/"]'::JSONB
      ),
      (
        'dumbbell-hollow-body-pullover-hold',
        'dumbbell-pullover',
        'distinct_exercises',
        'hollow_body_isometric_with_pullover_position_vs_dynamic_supported_shoulder_excursion',
        'Dumbbell Hollow-Body Pullover Hold makes the hollow-body trunk position and isometric hold defining. Dumbbell Pullover dynamically moves the implement through shoulder range from a supported base. Trunk action, visible motion, support, range, dose unit, load tolerance, and stop rules differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/32707142/"]'::JSONB
      ),
      (
        'dumbbell-overhead-press-eccentric',
        'seated-barbell-overhead-press',
        'needs_human_review',
        'eccentric_press_source_does_not_declare_base_assisted_return_or_repetition_cycle',
        'The eccentric dumbbell source declares slow overhead lowering but not whether the athlete stands or sits, how the implements reach the top, or whether each repetition includes an active press. The completed seated press family requires a seated base and full setup/return contract. Those facts are required before consolidation.',
        '["https://pubmed.ncbi.nlm.nih.gov/38156065/"]'::JSONB
      ),
      (
        'dumbbell-rear-delt-row',
        'one-arm-dumbbell-row',
        'distinct_exercises',
        'elbows_flared_rear_deltoid_row_path_vs_single_arm_trunkward_row',
        'Rear-Delt Row uses an elbow-flared path selected for posterior-shoulder emphasis. One-Arm Dumbbell Row uses a unilateral trunkward pull with a different elbow and scapular path. Laterality, elbow path, shoulder action, support, load tolerance, muscles, and coaching faults differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/19620925/"]'::JSONB
      ),
      (
        'falling-start-10m',
        'half-kneeling-start-sprint',
        'distinct_exercises',
        'upright_forward_fall_to_acceleration_vs_grounded_half_kneeling_start',
        'Falling Start begins upright and uses a controlled forward fall to trigger the first step. Half-Kneeling Start begins with one knee on the ground. Base, center-of-mass height, first contact, rise mechanics, setup, timing, and prerequisites differ.',
        '["https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/"]'::JSONB
      ),
      (
        'half-kneeling-medicine-ball-lift',
        'half-kneeling-medicine-ball-shot-put-throw',
        'distinct_exercises',
        'controlled_low_to_high_lift_without_release_vs_ballistic_unilateral_projection',
        'Half-Kneeling Medicine Ball Lift moves the ball low to high under control without a required release. Half-Kneeling Shot-Put Throw ballistically projects and releases the ball from one side. Release, velocity, target, laterality, return contract, space, and dose differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'hanging-leg-raise',
        'standing-calf-raise-eccentric-lower',
        'distinct_exercises',
        'hanging_hip_flexion_and_trunk_control_vs_standing_plantar_flexion_eccentric',
        'Hanging Leg Raise suspends the body from the hands and raises the legs through hip flexion and trunk control. Standing Calf Raise Eccentric Lower controls ankle dorsiflexion from a plantar-flexed standing position. Body region, support, joints, actions, load path, range, and failure consequence differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/27632850/"]'::JSONB
      ),
      (
        'landmine-ball-grip-rotational-press',
        'one-arm-landmine-row',
        'distinct_exercises',
        'rotational_angled_press_with_elbow_extension_vs_hinged_pull_with_elbow_flexion',
        'Rotational Landmine Press drives the bar away while rotating through the hips and trunk. One-Arm Landmine Row pulls the bar toward the trunk while holding a hinge. Force direction, elbow action, shoulder action, base, trunk strategy, load path, and failure response differ.',
        '["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB
      ),
      (
        'landmine-ball-grip-rotational-press',
        'landmine-squat-to-press',
        'distinct_exercises',
        'transverse_rotational_press_vs_sagittal_squat_then_press_sequence',
        'Rotational Landmine Press uses a hip and trunk turn with foot pivot to transfer force into the press. Landmine Squat-to-Press descends through a squat and drives upward into an angled press. Plane, foot action, lower-body pattern, action order, load tolerance, and repetition boundary differ.',
        '["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB
      ),
      (
        'landmine-clean-to-press',
        'two-hand-landmine-press',
        'distinct_exercises',
        'floor_or_low_pickup_clean_and_receive_then_press_vs_press_from_established_rack',
        'Landmine Clean to Press requires a hinge or pickup, clean, and receiving phase before the press. Two-Hand Landmine Press begins with the bar established at the chest and performs the press. Ordered actions, pickup, receiving phase, lower-body contribution, duration, and failure state differ.',
        '["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB
      ),
      (
        'one-arm-landmine-row',
        'one-arm-landmine-z-press',
        'distinct_exercises',
        'hinged_unilateral_pull_vs_floor_seated_unilateral_press',
        'One-Arm Landmine Row holds a hip hinge and pulls the bar toward the trunk. One-Arm Landmine Z-Press sits on the floor with legs extended and presses the bar away. Force direction, elbow action, base, hip position, trunk demand, load path, and failure response differ.',
        '["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB
      ),
      (
        'lateral-bound',
        'lateral-bound-rebound-series',
        'distinct_exercises',
        'single_lateral_projection_and_landing_vs_repeated_rebound_contact_series',
        'Lateral Bound performs one lateral projection and controlled landing per repetition. Lateral Bound Rebound Series requires repeated contacts with immediate redirection. Contact count, ground-contact time, terminal action, elastic demand, impact budget, dose, and failure state differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/17544325/","https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB
      ),
      (
        'lateral-bound-to-stick',
        'lateral-quick-step-to-stick',
        'distinct_exercises',
        'single_airborne_lateral_bound_to_unilateral_landing_vs_grounded_quick_steps_then_braking_hold',
        'Lateral Bound to Stick uses one airborne projection and a controlled landing. Lateral Quick-Step to Stick uses rapid grounded steps before braking to a hold. Flight, contact count, locomotion, force strategy, impact, distance, and dose differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/17544325/","https://pubmed.ncbi.nlm.nih.gov/33217086/"]'::JSONB
      ),
      (
        'lateral-cone-hop-to-sprint',
        'lateral-open-step-to-sprint',
        'distinct_exercises',
        'airborne_cone_clearance_then_acceleration_vs_grounded_open_step_acceleration_entry',
        'Lateral Cone Hop to Sprint clears a cone with an airborne lateral contact before accelerating. Lateral Open Step to Sprint uses a grounded opening step as the acceleration entry. Flight, obstacle, first contacts, impact, spacing, readiness, and error states differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/17544325/","https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/"]'::JSONB
      ),
      (
        'one-arm-landmine-split-jerk',
        'split-stance-one-arm-landmine-press',
        'distinct_exercises',
        'ballistic_dip_drive_and_split_under_load_vs_static_split_stance_strict_press',
        'One-Arm Landmine Split Jerk uses a dip-drive and rapidly receives the bar in a split. Split-Stance One-Arm Landmine Press establishes the split stance before a controlled press. Action order, foot movement, velocity, receiving phase, load, complexity, and failure response differ.',
        '["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB
      ),
      (
        'reactive-45-degree-cut',
        'reactive-y-cut',
        'needs_human_review',
        'reactive_45_source_does_not_declare_stimulus_branch_count_or_cue_timing',
        'Reactive Y-Cut declares a live left, right, or middle cue and a three-branch response. Reactive 45-Degree Cut is labeled reactive but its source does not declare the cue, branch count, cue timing, or false-start rule. Those stimulus facts are identity-defining and must be recovered before consolidation.',
        '["https://pubmed.ncbi.nlm.nih.gov/33217086/"]'::JSONB
      ),
      (
        'reactive-hop-to-cut',
        'reactive-y-cut',
        'distinct_exercises',
        'required_pre_cue_hop_and_landing_then_cut_vs_cue_selected_y_branch_without_required_hop',
        'Reactive Hop to Cut requires an initial hop and landing before the cut response. Reactive Y-Cut begins from its declared ready state and responds directly to the branch cue. Ordered actions, flight, contact state at cue, impact, timing, space, and error states differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/33217086/","https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB
      ),
      (
        'reactive-rebound-broad-jump-to-box-jump',
        'single-broad-jump-to-rebound',
        'distinct_exercises',
        'rebound_broad_jump_then_box_jump_sequence_vs_single_broad_jump_to_declared_rebound',
        'Reactive Rebound Broad Jump to Box Jump contains a rebound broad jump followed by a jump to a box. Single Broad Jump to Rebound contains one broad-jump landing and its declared rebound without the required box target. Contact sequence, equipment, target, impact, space, and repetition boundary differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/17544325/","https://pubmed.ncbi.nlm.nih.gov/17620779/"]'::JSONB
      ),
      (
        'repeated-broad-jump',
        'repeated-broad-jump-to-sprint-out',
        'distinct_exercises',
        'repeated_horizontal_jumps_to_terminal_landing_vs_jumps_then_running_acceleration_exit',
        'Repeated Broad Jump ends after the declared jump series and landing. Repeated Broad Jump to Sprint-Out adds a running acceleration exit. Ordered actions, terminal state, space, timing, fatigue, measurement, and stop rules differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/17544325/","https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/"]'::JSONB
      ),
      (
        'romanian-deadlift',
        'sumo-deadlift',
        'distinct_exercises',
        'top_down_hip_hinge_with_soft_knees_vs_floor_pull_from_wide_turned_out_stance',
        'Romanian Deadlift begins standing and hinges with softly flexed knees while keeping the load close. Sumo Deadlift begins from the floor with a wide, turned-out stance and greater knee contribution. Start, stance, range, joint contribution, pickup, load tolerance, and failure response differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/24978835/"]'::JSONB
      ),
      (
        'sandbag-get-up-strength',
        'sandbag-step-up-strength',
        'distinct_exercises',
        'floor_to_standing_transition_under_load_vs_repeated_elevated_step_ascent',
        'Sandbag Get-Up moves from the floor to standing through a multi-stage transition. Sandbag Step-Up repeatedly ascends and descends an elevated platform. Start, support contacts, ordered actions, equipment, range, space, asymmetry, and failure response differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/38665162/"]'::JSONB
      ),
      (
        'skipping-rhythm-change',
        'skipping-rhythm-change-with-ball-toss',
        'distinct_exercises',
        'locomotor_skip_rhythm_change_only_vs_skip_rhythm_plus_timed_object_toss_and_catch',
        'Skipping Rhythm Change is a locomotor timing task. The ball-toss version adds a timed toss and catch while the skipping rhythm changes. Object interaction, visual tracking, hand action, coordination, partner or self-toss contract, repetition duration, and failure states differ.',
        '["https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/"]'::JSONB
      ),
      (
        'slam-ball-bear-hug-carry',
        'wall-ball-plus-bear-hug-carry-shuttle',
        'distinct_exercises',
        'continuous_loaded_carry_vs_wall_ball_task_then_loaded_shuttle_sequence',
        'Slam-Ball Bear-Hug Carry is a loaded gait task. Wall Ball plus Bear-Hug Carry Shuttle adds a wall-ball action and shuttle transitions. Ordered actions, target, throw or squat work, route, equipment handling, duration, conditioning demand, and failure states differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/38665162/","https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'sprint-float-sprint',
        'sprint-float-sprint-build-up',
        'needs_human_review',
        'build_up_source_does_not_declare_three_zone_velocity_sequence_or_intensity_targets',
        'Sprint-Float-Sprint declares max, 85-90 percent float, and max zones over a marked three-part rep. The build-up source mentions relaxation and re-acceleration but does not declare the number, order, distance, or intensity of zones. Those facts are required to establish exact identity.',
        '["https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/"]'::JSONB
      ),
      (
        'three-bound-distance-series',
        'three-hop-bound-series',
        'needs_human_review',
        'sources_do_not_jointly_declare_same_leg_or_alternating_contact_sequence',
        'Both sources describe exactly three distance-oriented bounds and a controlled final contact, but neither source declares whether contacts alternate legs, remain on one leg, or permit both patterns. Every takeoff and landing foot is required before treating the names as one identity.',
        '["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB
      ),
      (
        'one-arm-landmine-push-press',
        'two-hand-landmine-press',
        'distinct_exercises',
        'dip_drive_landmine_push_press_vs_strict_two_hand_landmine_press',
        'Landmine Push Press requires a dip and forceful leg drive before the angled press. Two-Hand Landmine Press does not require that ballistic lower-body action. Ordered actions, lower-body contribution, velocity, load tolerance, fatigue, readiness, and repetition boundary differ.',
        '["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB
      ),
      (
        'landmine-press',
        'one-arm-landmine-push-press',
        'distinct_exercises',
        'strict_landmine_press_vs_dip_drive_landmine_push_press',
        'Landmine Press performs the angled press from a stable braced base without a required dip-drive. Landmine Push Press deliberately uses a dip and leg drive. Lower-body action, momentum, velocity, load tolerance, fatigue, technical failure, and dose differ.',
        '["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB
      ),
      (
        'lateral-bound',
        'rotational-bound-to-stick',
        'distinct_exercises',
        'frontal_plane_lateral_projection_vs_declared_axial_rotation_and_reorientation',
        'Lateral Bound projects from one leg to the other in the frontal direction without a required change of facing. Rotational Bound to Stick deliberately rotates and reorients the athlete before the landing. Plane, visual reference, foot orientation, landing preparation, complexity, and error state differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/17544325/","https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB
      ),
      (
        'bound-to-stick',
        'lateral-bound',
        'needs_human_review',
        'generic_bound_source_does_not_declare_whether_projection_is_lateral',
        'Both sources declare a one-leg-to-opposite-leg bound and controlled landing, but Bound to Stick does not declare sagittal, diagonal, or lateral projection. Projection direction is required before deciding whether Lateral Bound is only a direction variant of the generic source.',
        '["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB
      ),
      (
        'half-kneeling-cable-lift',
        'cable-band-chop',
        'distinct_exercises',
        'low_to_high_diagonal_lift_vs_high_to_low_diagonal_chop',
        'Half-Kneeling Cable Lift moves resistance on a low-to-high diagonal path. Cable/Band Chop moves resistance on a high-to-low chop path while allowing standing or kneeling bases. Force direction, shoulder path, trunk action, anchor position, range, coaching faults, and outcome differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/22889652/"]'::JSONB
      ),
      (
        'lateral-bound',
        'lateral-hop-to-stick',
        'distinct_exercises',
        'opposite_leg_lateral_bound_vs_bilateral_lateral_jump_and_bilateral_landing',
        'Lateral Bound takes off from one leg and lands on the opposite leg. Bilateral Lateral Jump to Stick takes off from two feet and lands on two feet simultaneously. Every contact state, balance, force production, landing strategy, impact distribution, and dose differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/17544325/","https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB
      ),
      (
        'lateral-bound',
        'star-hop-to-stick',
        'distinct_exercises',
        'single_lateral_projection_vs_multi_direction_target_sequence',
        'Lateral Bound performs one declared lateral projection and landing. Star Hop to Stick follows multiple targets arranged around the athlete and changes direction between contacts. Route, target count, projection directions, repetition boundary, visual demand, space, and dose differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/17544325/","https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB
      ),
      (
        'atlas-stone-d-ball-bear-hug-carry-strength',
        'slam-ball-bear-hug-squat',
        'distinct_exercises',
        'bear_hug_loaded_gait_vs_stationary_bear_hug_squat',
        'Atlas Stone/D-Ball Bear-Hug Carry walks with the load secured to the trunk. Slam-Ball Bear-Hug Squat repeatedly descends and stands from a stationary base. Locomotion, joint excursion, distance, repetition boundary, space, fatigue profile, and stop rules differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/38665162/","https://pubmed.ncbi.nlm.nih.gov/30676181/"]'::JSONB
      ),
      (
        'lateral-bound',
        'lateral-lunge-decel-stick',
        'distinct_exercises',
        'airborne_opposite_leg_lateral_projection_vs_grounded_lateral_step_and_braking_lunge',
        'Lateral Bound contains an airborne projection from one leg to the other. Lateral Lunge Decel Stick uses a grounded lateral step and absorbs into a lunge before holding. Flight, contact state, stance, braking strategy, impact, range, and dose differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/17544325/","https://pubmed.ncbi.nlm.nih.gov/33217086/"]'::JSONB
      ),
      (
        'lateral-bound',
        'lateral-bound-stick-plus-toss-catch',
        'distinct_exercises',
        'lateral_bound_and_landing_only_vs_bound_then_external_toss_and_catch',
        'Lateral Bound ends after the controlled landing or declared reset. Lateral Bound Stick plus Toss Catch adds a timed external toss and catch after landing. Object interaction, visual tracking, hand action, partner timing, ordered actions, repetition duration, and failure states differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/39228781/","https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'atlas-stone-d-ball-bear-hug-carry-strength',
        'wall-ball-plus-bear-hug-carry-shuttle',
        'distinct_exercises',
        'continuous_bear_hug_loaded_gait_vs_wall_ball_then_carry_shuttle_sequence',
        'Atlas Stone/D-Ball Bear-Hug Carry is a continuous loaded gait task. Wall Ball plus Bear-Hug Carry Shuttle requires wall-ball repetitions and shuttle transitions in addition to the carry. Ordered actions, target, squat and throw work, route, duration, conditioning demand, and failure states differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/38665162/","https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'lateral-bound',
        'lateral-quick-step-to-stick',
        'distinct_exercises',
        'airborne_opposite_leg_lateral_bound_vs_grounded_quick_steps_then_braking_hold',
        'Lateral Bound uses one airborne projection from one leg to the other. Lateral Quick Step to Stick uses rapid grounded contacts before braking to a hold. Flight, contact count, locomotion, force strategy, impact, distance, and dose differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/17544325/","https://pubmed.ncbi.nlm.nih.gov/33217086/"]'::JSONB
      ),
      (
        'cable-band-chop',
        'kneeling-medicine-ball-chest-pass',
        'distinct_exercises',
        'controlled_diagonal_anchored_chop_vs_ballistic_horizontal_ball_release',
        'Cable/Band Chop moves anchored resistance through a controlled diagonal path without releasing the implement. Kneeling Medicine Ball Chest Pass ballistically projects and releases a ball horizontally from a fixed kneeling base. Force direction, release, target, return contract, velocity, equipment, and dose differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/22889652/","https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
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
        AND (
          resolution.decision <> boundary.decision
          OR resolution.resolution_source = 'human_review'
        )
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
