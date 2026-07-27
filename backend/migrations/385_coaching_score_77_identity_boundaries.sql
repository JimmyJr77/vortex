-- Adjudicate mechanically distinct and source-ambiguous pairs in the score-77
-- canonical identity queue after the score-78 alias expansions.
--
-- Identity decisions do not approve cards, media, relationships, calibration,
-- or publication. Exercise cards use exercise complexity and physical
-- difficulty only; skill/proficiency levels belong only to coaching.skill.
-- IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '385_coaching_score_77_identity_boundaries';
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
        'squat-jump-to-stick',
        'distinct_exercises',
        'half_turn_projection_and_reorientation_vs_sagittal_vertical_projection',
        '180 Jump to Stick deliberately rotates the body through a half turn before the terminal landing. Squat Jump to Stick preserves a sagittal vertical projection without the same reorientation. Rotation, visual reference, flight action, landing orientation, space, complexity, and failure state differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/33359798/"]'::JSONB
      ),
      (
        'a-skip-pogo-rhythm',
        'a-skip-rhythm-punch',
        'needs_human_review',
        'a_skip_sources_do_not_jointly_declare_contact_sequence_and_pogo_contract',
        'Both cards describe front-side A-skip rhythm and elastic ground contact, but neither pair of sources fully declares whether every contact follows the same skip-step-hop sequence, whether a distinct pogo contact is inserted, or how the punch changes the repetition boundary. Contact order and support state are required before consolidation.',
        '["https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/"]'::JSONB
      ),
      (
        'medicine-ball-overhead-back-throw',
        'medicine-ball-overhead-slam',
        'distinct_exercises',
        'backward_overhead_release_to_open_sector_vs_downward_slam_to_floor',
        'Overhead Back Throw releases the ball backward over the head into a clear landing sector. Overhead Slam accelerates the ball downward into the floor and manages the rebound or retrieval. Projection direction, target, release angle, visual field, environment, return contract, and safety zone differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'banded-hip-flexor-march',
        'hip-flexor-march-iso-hold',
        'needs_human_review',
        'iso_hold_source_allows_standing_or_supine_base_and_does_not_declare_march_sequence',
        'Banded Hip Flexor March declares resisted repeated hip-flexion contacts. Hip Flexor March Iso Hold permits either a standing wall-supported or supine press base and does not declare whether sides exchange within the repetition. Base, support, visible motion, and side sequence determine whether it is a hold variant or a distinct task.',
        '["https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/"]'::JSONB
      ),
      (
        'lateral-hop-to-stick',
        'lateral-shuffle-decel-stick',
        'distinct_exercises',
        'airborne_bilateral_lateral_projection_vs_grounded_lateral_shuffle_braking',
        'Lateral Hop to Stick uses a two-foot airborne projection and simultaneous two-foot landing. Lateral Shuffle Decel Stick stays grounded through repeated shuffle contacts before braking to a hold. Flight, contact sequence, locomotion, stopping strategy, space, impact, and dose differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/17544325/","https://pubmed.ncbi.nlm.nih.gov/33217086/"]'::JSONB
      ),
      (
        'close-grip-push-up',
        'dumbbell-kettlebell-floor-press',
        'distinct_exercises',
        'moving_body_plank_push_from_hand_support_vs_supine_external_load_press',
        'Close-Grip Push-Up moves the braced body relative to fixed hand support. Floor Press keeps the trunk supine and moves external implements while the upper arms contact the floor. Support, kinetic-chain behavior, implement, force transfer, range boundary, setup, and failure response differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/29541105/","https://pubmed.ncbi.nlm.nih.gov/23096062/"]'::JSONB
      ),
      (
        'crossover-step-and-go',
        'crossover-step-to-bound-and-stick',
        'distinct_exercises',
        'crossover_entry_to_running_exit_vs_crossover_entry_to_bound_and_terminal_landing',
        'Crossover Step and Go uses the crossover as an entry into acceleration. Crossover Step to Bound and Stick uses it to create one declared bound and controlled terminal landing. Ordered actions, flight, finish, landing demand, distance, measurement, and stop rules differ.',
        '["https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/","https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB
      ),
      (
        'dead-bug-iso-press',
        'dead-bug-wall-press',
        'distinct_exercises',
        'hand_to_knee_isometric_without_limb_excursion_vs_wall_press_with_declared_leg_action',
        'Dead Bug Iso Press creates hand-to-knee opposition without visible joint motion. Dead Bug Wall Press holds both hands against a wall while a declared leg performs a heel tap or extension. Arm interface, moving segment, ordered action, range, anti-extension demand, dose unit, and success criteria differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/32707142/"]'::JSONB
      ),
      (
        'deceleration-re-acceleration-sprint',
        'jog-to-stick-linear-deceleration',
        'distinct_exercises',
        'brake_then_reaccelerate_through_exit_vs_brake_to_terminal_held_stop',
        'Deceleration Re-Acceleration Sprint brakes and then produces a second acceleration through an exit. Linear Deceleration to Stick ends at the stop and holds the terminal stance. Finish action, force reversal, exit distance, speed, measurement, fatigue, and failure state differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/40679942/","https://pubmed.ncbi.nlm.nih.gov/33217086/"]'::JSONB
      ),
      (
        'depth-drop-to-box-jump',
        'static-squat-jump-to-box',
        'distinct_exercises',
        'elevated_step_off_floor_contact_then_box_jump_vs_static_floor_squat_takeoff',
        'Depth Drop to Box Jump begins on an elevated box, receives a floor landing, and immediately jumps to a second box. Static Squat Jump to Box begins motionless in a floor squat and jumps directly to the box. Entry height, imposed landing, contact order, elastic reversal, equipment, impact, and repetition boundary differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/17620779/","https://pubmed.ncbi.nlm.nih.gov/27428530/"]'::JSONB
      ),
      (
        'depth-drop-to-broad-rebound',
        'depth-jump',
        'distinct_exercises',
        'drop_contact_to_horizontal_rebound_vs_drop_contact_to_vertical_rebound',
        'Depth Drop to Broad Rebound converts the imposed landing into horizontal projection. Depth Jump uses a vertical or declared upward target. Force vector, landing preparation, target, space, measurement, arm policy, and safe failure differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/17544325/","https://pubmed.ncbi.nlm.nih.gov/27428530/"]'::JSONB
      ),
      (
        'dumbbell-hammer-curl',
        'dumbbell-hamstring-curl',
        'distinct_exercises',
        'neutral_grip_elbow_flexion_vs_loaded_knee_flexion',
        'Dumbbell Hammer Curl flexes the elbow with a neutral hand position. Dumbbell Hamstring Curl secures a dumbbell at the feet and flexes the knee. Body region, joints, grip role, setup, implement control, range, failure consequence, and coaching position differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/19620925/"]'::JSONB
      ),
      (
        'dumbbell-incline-press',
        'dumbbell-z-press',
        'distinct_exercises',
        'incline_bench_press_with_back_support_vs_floor_seated_vertical_press',
        'Dumbbell Incline Press uses an inclined bench and supported trunk to press on an oblique path. Dumbbell Z-Press sits unsupported on the floor with legs extended and presses vertically. Support, orientation, force direction, hip position, trunk demand, equipment, and range differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/23096062/"]'::JSONB
      ),
      (
        'medicine-ball-overhead-throw',
        'tall-kneeling-overhead-medicine-ball-slam',
        'distinct_exercises',
        'forward_overhead_projection_from_declared_stance_vs_downward_slam_from_tall_kneeling',
        'Medicine Ball Overhead Throw releases forward toward a wall, partner, or open sector from a declared stance. Tall-Kneeling Overhead Slam fixes both knees down and projects the ball toward the floor. Base, leg contribution, projection direction, target, rebound, retrieval, and safety zone differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'glute-bridge',
        'glute-bridge-walkout',
        'distinct_exercises',
        'hip_extension_cycle_or_hold_vs_bridge_hold_with_ordered_heel_walkout_and_return',
        'Glute Bridge raises and lowers the pelvis or holds its top position. Glute Bridge Walkout maintains hip height while repeatedly stepping the heels away and back, changing knee angle and lever length. Ordered actions, moving joints, hamstring demand, range, repetition boundary, and stop rules differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/28900560/","https://pubmed.ncbi.nlm.nih.gov/27799708/"]'::JSONB
      ),
      (
        'half-kneeling-rotational-wall-throw',
        'half-kneeling-t-spine-rotation-reach',
        'distinct_exercises',
        'ballistic_ball_projection_vs_unloaded_thoracic_mobility_reach',
        'Half-Kneeling Rotational Wall Throw projects a medicine ball into a wall with ballistic intent. Half-Kneeling T-Spine Rotation Reach moves the arm and thorax through controlled mobility range without projection. External load, velocity, release, target, return contract, intent, and dose differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/39589937/","https://pubmed.ncbi.nlm.nih.gov/22889652/"]'::JSONB
      ),
      (
        'hamstring-slider-curl',
        'nordic-hamstring-curl',
        'distinct_exercises',
        'supine_heel_slider_knee_cycle_with_bridge_vs_kneeling_body_lowering_eccentric',
        'Hamstring Slider Curl uses a supine bridge while the heels slide away and return. Nordic Hamstring Curl begins kneeling with the ankles anchored and lowers the largely straight trunk and thighs toward the floor. Orientation, support, kinetic chain, hip action, range, assistance, and failure response differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/40827942/","https://pubmed.ncbi.nlm.nih.gov/38156065/"]'::JSONB
      ),
      (
        'landmine-clean-to-press',
        'landmine-squat-to-press',
        'distinct_exercises',
        'hinge_and_clean_to_rack_then_press_vs_squat_then_continuous_press',
        'Landmine Clean to Press hinges and cleans the bar into a receiving position before pressing. Landmine Squat-to-Press begins already holding the bar, descends through a squat, and drives into the press. Pickup, action order, receiving phase, lower-body pattern, momentum, duration, and failure state differ.',
        '["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB
      ),
      (
        'landmine-hack-squat',
        'landmine-split-squat',
        'distinct_exercises',
        'bilateral_hack_squat_base_vs_stationary_split_stance_lunge',
        'Landmine Hack Squat uses a bilateral stance with the bar supported behind or beside the shoulder line. Landmine Split Squat uses a staggered base and emphasizes the front leg while the rear leg assists balance. Stance, load symmetry, laterality, balance, joint contribution, setup, and dose differ.',
        '["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB
      ),
      (
        'landmine-press',
        'landmine-squat-to-press',
        'distinct_exercises',
        'press_only_vs_squat_then_press_compound_sequence',
        'Landmine Press performs the angled press without a required squat. Landmine Squat-to-Press requires a squat immediately followed by the press. Action sequence, lower-body range, momentum, duration, fatigue, load tolerance, and repetition boundary differ.',
        '["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB
      ),
      (
        'lateral-bound-stick-plus-toss-catch',
        'lateral-bound-to-stick',
        'distinct_exercises',
        'bound_and_terminal_landing_plus_external_toss_catch_vs_bound_and_landing_only',
        'Lateral Bound Stick plus Toss Catch adds a timed external toss and catch after the landing. Lateral Bound to Stick ends when the landing is owned. Object interaction, visual tracking, hand action, partner timing, ordered actions, repetition duration, and failure states differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/39228781/","https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'lateral-hurdle-hop-to-box-jump',
        'single-leg-hurdle-hop-to-box-jump',
        'needs_human_review',
        'hurdle_box_sources_do_not_jointly_declare_direction_and_foot_contact_contract',
        'One source declares lateral travel but not takeoff and landing foot count; the other declares single-leg work but does not fully declare hurdle direction or whether the box landing remains unilateral. Direction and every contact state are required to decide whether these are exact variants of one sequence.',
        '["https://pubmed.ncbi.nlm.nih.gov/39228781/","https://pubmed.ncbi.nlm.nih.gov/17620779/"]'::JSONB
      ),
      (
        'lateral-lunge',
        'reverse-lunge',
        'distinct_exercises',
        'frontal_plane_lateral_step_and_shift_vs_sagittal_backward_step_lunge',
        'Lateral Lunge steps or shifts sideways and loads the hip in the frontal plane. Reverse Lunge steps backward into a sagittal split stance. Direction, plane, stance, lead and trail leg roles, adductor demand, balance, space, and repetition path differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/22889652/"]'::JSONB
      ),
      (
        'lateral-shuffle-decel-stick',
        'lateral-two-in-shuffle',
        'distinct_exercises',
        'open_space_lateral_locomotion_to_braking_hold_vs_ladder_two_contacts_per_box',
        'Lateral Shuffle Decel Stick travels in open space and terminates in a braking hold. Lateral Two-In Shuffle follows a ladder route with both feet entering every box and continues through the ladder. Route, equipment, contact sequence, terminal action, intent, measurement, and error state differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/24290613/","https://pubmed.ncbi.nlm.nih.gov/33217086/"]'::JSONB
      ),
      (
        'medicine-ball-catch-to-low-hop-and-stick',
        'medicine-ball-chest-pass-catch-and-stick',
        'distinct_exercises',
        'incoming_catch_then_low_hop_reoutput_vs_chest_pass_return_catch_and_stationary_stick',
        'Catch to Low Hop and Stick turns an incoming catch into a lower-body hop before landing. Chest Pass Catch-and-Stick includes a chest projection and receives the return without the required hop. Ordered actions, outgoing throw, flight, landing, partner contract, impact, and repetition boundary differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'medicine-ball-catch-to-low-hop-and-stick',
        'medicine-ball-rotational-catch-and-stick',
        'distinct_exercises',
        'catch_then_sagittal_or_declared_low_hop_vs_rotational_catch_absorption_without_hop',
        'Catch to Low Hop and Stick adds an airborne lower-body re-output after the catch. Rotational Catch-and-Stick absorbs an incoming transverse load while resisting or controlling rotation and does not require the hop. Plane, flight, contact order, trunk action, landing, and impact differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'medicine-ball-catch-to-decel-stick',
        'medicine-ball-catch-to-low-hop-and-stick',
        'distinct_exercises',
        'catch_during_approach_then_brake_to_stop_vs_catch_then_hop_and_terminal_landing',
        'Catch-to-Decel Stick receives the ball during locomotion and uses braking contacts to stop. Catch to Low Hop and Stick uses the catch as input to a small airborne projection and landing. Approach, contact sequence, force strategy, flight, space, measurement, and failure state differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/39589937/","https://pubmed.ncbi.nlm.nih.gov/33217086/"]'::JSONB
      ),
      (
        'medicine-ball-catch-to-decel-stick',
        'medicine-ball-scoop-toss-catch-and-stick',
        'distinct_exercises',
        'incoming_catch_during_braking_task_vs_outgoing_scoop_projection_and_return_catch',
        'Catch-to-Decel Stick centers on absorbing an incoming ball while braking locomotion. Scoop Toss Catch-and-Stick first projects the ball low-to-high and then receives the return from a stationary or declared base. Throw direction, action order, approach, braking, return contract, and measurement differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/39589937/","https://pubmed.ncbi.nlm.nih.gov/33217086/"]'::JSONB
      ),
      (
        'medicine-ball-chest-pass',
        'medicine-ball-clean-to-squat',
        'distinct_exercises',
        'forward_chest_projection_vs_floor_pickup_clean_receive_and_squat',
        'Medicine Ball Chest Pass projects the ball forward from the chest. Medicine Ball Clean to Squat lifts it from a low position, receives it at the front rack, and performs a squat without a required forward release. Ordered actions, pickup, target, catch, lower-body range, equipment path, and dose differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'medicine-ball-rotational-throw',
        'medicine-ball-rotational-toss-to-lateral-bound',
        'distinct_exercises',
        'rotational_ball_projection_vs_projection_then_lateral_bound_and_landing',
        'Medicine Ball Rotational Throw ends after the projection and declared return or retrieval. Rotational Toss to Lateral Bound adds a lateral airborne projection and controlled landing after the toss. Ordered actions, foot contacts, flight, landing, space, impact, and success criteria differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/39589937/","https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB
      ),
      (
        'partner-chase-bound-start',
        'partner-chase-first-step-sprint',
        'distinct_exercises',
        'partner_cue_to_single_bound_then_chase_vs_partner_cue_to_running_first_step_acceleration',
        'Partner Chase Bound Start requires a declared bound before the chase. Partner Chase First-Step Sprint begins with running acceleration contacts. Initial action, flight, landing, transition, spacing, impact, timing, and failure state differ.',
        '["https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/","https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB
      ),
      (
        'reactive-med-ball-target-pass',
        'wall-ball-reactive-target-call',
        'distinct_exercises',
        'reactive_pass_to_partner_or_hand_target_vs_squat_cued_wall_ball_target_throw',
        'Reactive Med Ball Target Pass selects a partner or visual passing target after a cue. Wall Ball Reactive Target Call couples a squat and wall-ball throw to a high, low, left, or right wall target. Receiver, lower-body action, trajectory, return contract, target geometry, equipment, and repetition sequence differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'sandbag-shoulder-carry-strength',
        'zercher-carry',
        'distinct_exercises',
        'unilateral_shoulder_loaded_gait_vs_bilateral_elbow_crook_loaded_gait',
        'Sandbag Shoulder Carry supports an offset load on one shoulder. Zercher Carry supports the load across both elbow creases in front of the trunk. Load position, symmetry, grip assistance, trunk strategy, side dosage, pickup, set-down, and failure response differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/38665162/"]'::JSONB
      ),
      (
        'single-leg-lateral-box-jump',
        'standing-box-jump-to-single-leg-landing',
        'distinct_exercises',
        'lateral_unilateral_projection_to_box_vs_vertical_projection_to_single_leg_box_landing',
        'Single-Leg Lateral Box Jump projects sideways from one leg. The completed Box Jump to Single-Leg Landing family declares vertical projection with bilateral or same-leg unilateral takeoff. Direction, box orientation, clearance, takeoff vector, landing preparation, fall zone, and measurement differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/17544325/","https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB
      ),
      (
        'single-leg-romanian-deadlift',
        'single-leg-squat-to-box',
        'distinct_exercises',
        'single_leg_hip_hinge_with_trail_leg_reach_vs_single_leg_squat_to_rear_box_target',
        'Single-Leg Romanian Deadlift hinges at the hip while the trail leg extends behind and the stance knee stays softly flexed. Single-Leg Squat to Box increases stance-knee flexion and reaches the pelvis to a rear target. Dominant joint action, free-leg role, target, balance, range, loading, and failure response differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/24978835/"]'::JSONB
      ),
      (
        'slam-ball-rotational-slam',
        'slam-ball-sprawl-to-slam',
        'distinct_exercises',
        'transverse_rotational_slam_vs_sprawl_ground_transition_then_sagittal_slam',
        'Rotational Slam loads and projects through transverse hip and trunk rotation. Sprawl to Slam requires a floor-supported sprawl transition before standing and slamming. Plane, ordered actions, ground contacts, locomotion, duration, conditioning demand, and failure states differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'slow-eccentric-leg-extension',
        'slow-eccentric-leg-press',
        'distinct_exercises',
        'open_chain_knee_extension_eccentric_vs_supported_multi_joint_leg_press_eccentric',
        'Slow Eccentric Leg Extension isolates open-chain knee extension. Slow Eccentric Leg Press uses supported hip, knee, and ankle motion against a platform. Kinetic chain, joints, equipment, load path, range, spinal support, failure consequence, and setup differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/38156065/"]'::JSONB
      ),
      (
        'sandbag-front-loaded-squat-strength',
        'split-squat',
        'distinct_exercises',
        'bilateral_sandbag_squat_vs_stationary_asymmetrical_split_stance_squat',
        'Sandbag Squat uses a bilateral squat base while changing the sandbag load position through declared variants. Split Squat fixes an asymmetrical stationary stance with a lead-leg bias and rear-foot support. Stance, laterality, base of support, lead and trail leg roles, balance, loading tolerance, and side dosage differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/30676181/"]'::JSONB
      ),
      (
        'landmine-ball-grip-rotational-press',
        'landmine-press',
        'distinct_exercises',
        'rotational_landmine_press_with_hip_turn_and_foot_pivot_vs_nonrotational_angled_press',
        'Landmine Ball-Grip Rotational Press requires hip and thoracic rotation with a foot pivot while the press transfers force across the body. Landmine Press uses a nonrotational braced base and angled upper-body press. Plane, foot action, hip contribution, trunk strategy, force transfer, space, and repetition contract differ.',
        '["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB
      ),
      (
        '180-jump-to-stick',
        'tuck-jump',
        'distinct_exercises',
        'half_turn_reorientation_and_stick_vs_vertical_projection_with_airborne_hip_and_knee_flexion',
        '180 Jump to Stick rotates and reorients the whole body through a half turn before holding the landing. Tuck Jump projects vertically, rapidly flexes the hips and knees in flight, re-extends the legs, and lands without a required change of facing. Airborne action, plane, visual reference, landing orientation, complexity, and error state differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/33359798/"]'::JSONB
      ),
      (
        'tuck-jump',
        'tuck-jump-to-lateral-stick',
        'distinct_exercises',
        'vertical_tuck_jump_landing_under_base_vs_tuck_jump_to_declared_lateral_landing_displacement',
        'Tuck Jump uses vertical projection with an airborne knee tuck and returns to a controlled landing under the declared base. Tuck Jump to Lateral Stick adds lateral displacement and a direction-specific terminal landing. Projection vector, landing location, frontal-plane control, space, impact strategy, and success criteria differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/33359798/","https://pubmed.ncbi.nlm.nih.gov/17544325/"]'::JSONB
      ),
      (
        'cossack-squat',
        'sandbag-front-loaded-squat-strength',
        'distinct_exercises',
        'frontal_plane_lateral_weight_shift_with_extended_trail_leg_vs_bilateral_sandbag_squat',
        'Cossack Squat shifts laterally into one bent leg while the opposite leg lengthens, using frontal-plane hip and adductor range. Sandbag Squat keeps a bilateral squat base while holding a sandbag in a declared load position. Plane, stance, laterality, trail-leg role, range, balance, and loading strategy differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/22889652/","https://pubmed.ncbi.nlm.nih.gov/30676181/"]'::JSONB
      ),
      (
        'sandbag-front-loaded-squat-strength',
        'zercher-squat',
        'distinct_exercises',
        'sandbag_squat_with_declared_front_shoulder_or_bear_hug_variant_vs_elbow_crook_zercher_support',
        'Sandbag Squat sources declare a high chest-and-forearm support, one-shoulder support, or bear hug; none declares a load supported in both elbow creases. Zercher Squat is defined by that elbow-crook support and may use a barbell or sandbag. Load-support geometry, arm position, pressure interface, grip assistance, breathing constraint, pickup, and failure response differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/30676181/"]'::JSONB
      ),
      (
        'squat-jump-to-stick',
        'tuck-jump',
        'distinct_exercises',
        'squat_preload_to_vertical_projection_and_stick_vs_vertical_projection_with_airborne_tuck',
        'Squat Jump to Stick begins from a declared squat preload, extends vertically, and lands without a required airborne tuck. Tuck Jump requires rapid hip and knee flexion after takeoff followed by re-extension before landing. Flight action, coordination, impact exposure, readiness, fatigue cap, and technical failure state differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/33359798/"]'::JSONB
      ),
      (
        'broad-jump-to-stick',
        'tuck-jump',
        'distinct_exercises',
        'horizontal_projection_to_distance_landing_vs_vertical_projection_with_airborne_tuck',
        'Broad Jump to Stick projects the center of mass horizontally and controls a distance landing. Tuck Jump projects primarily vertically and adds rapid airborne hip and knee flexion. Force vector, flight action, landing preparation, space, measurement, impact strategy, and safe failure zone differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/17544325/","https://pubmed.ncbi.nlm.nih.gov/33359798/"]'::JSONB
      ),
      (
        'one-arm-landmine-row',
        'landmine-romanian-deadlift-to-row',
        'distinct_exercises',
        'held_hip_hinge_landmine_row_vs_active_romanian_deadlift_cycle_then_row',
        'Landmine Row establishes and holds the declared hip-hinge position while the upper body rows the bar. Landmine Romanian Deadlift to Row requires an active hip-hinge descent and extension cycle combined with the row. Ordered actions, moving joints, posterior-chain excursion, load tolerance, duration, fatigue, and repetition boundary differ.',
        '["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB
      ),
      (
        'landmine-press',
        'one-arm-landmine-row',
        'distinct_exercises',
        'angled_landmine_push_with_elbow_extension_vs_hinged_landmine_pull_with_elbow_flexion',
        'Landmine Press drives the bar away through shoulder flexion, scapular upward rotation, and elbow extension from a braced base. Landmine Row pulls the bar toward the trunk through scapular retraction, shoulder extension, and elbow flexion while holding a hip hinge. Force direction, joint actions, support posture, muscles, load path, and failure response differ.',
        '["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB
      ),
      (
        'one-arm-landmine-row',
        'romanian-deadlift',
        'distinct_exercises',
        'held_hip_hinge_with_upper_body_row_vs_active_hip_hinge_and_extension_without_required_row',
        'Landmine Row establishes and holds a hip hinge while the shoulder and elbow move the implement toward the trunk. Romanian Deadlift repeatedly moves through hip flexion and extension to a stacked finish without a required upper-body row. Primary action, moving joints, range, force emphasis, repetition boundary, load tolerance, and fatigue profile differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/24978835/","https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB
      ),
      (
        'distance-jump-standing-calf-raise',
        'seated-dumbbell-calf-raise',
        'distinct_exercises',
        'standing_extended_knee_plantar_flexion_vs_seated_bent_knee_plantar_flexion',
        'Standing Calf Raise loads plantar flexion with the knee extended and the body upright. Seated Dumbbell Calf Raise fixes a bent-knee seated base and loads near the thigh. Knee angle, support, muscle contribution, implement placement, balance, range, and failure response differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/27632850/","https://pubmed.ncbi.nlm.nih.gov/15450115/"]'::JSONB
      ),
      (
        'wall-drill-march',
        'wall-drill-switch',
        'distinct_exercises',
        'deliberate_alternating_march_contacts_vs_rapid_airborne_or_near_airborne_leg_exchange',
        'Wall Drill March uses deliberate alternating knee drives with individually owned positions. Wall Drill Switch rapidly exchanges the lead and support legs as one reactive action. Contact timing, flight or unloading, cadence, force demand, error tolerance, repetition boundary, and coaching gate differ.',
        '["https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/"]'::JSONB
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
