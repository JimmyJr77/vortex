-- Adjudicate the remaining high-similarity exercise-name queue after
-- high-confidence duplicate consolidation.
--
-- A `distinct_exercises` decision is used only where the declared movement
-- contract changes direction, base, support, action sequence, contact count,
-- contraction type, force strategy, landing, or another identity-defining
-- dimension. Three legacy pairs lack enough controlled detail for an honest
-- deterministic decision and are explicitly quarantined as
-- `needs_human_review`.
--
-- These are identity decisions only. They do not create card, media, graph,
-- calibration, publication, or human approval. Exercise cards use exercise
-- complexity and physical difficulty only; proficiency levels remain
-- exclusive to coaching skill-library cards. IDEMPOTENT and fail-closed.

DO $$
DECLARE
  boundary RECORD;
  left_definition RECORD;
  right_definition RECORD;
  conflicting_resolutions INTEGER;
BEGIN
  FOR boundary IN
    SELECT *
    FROM (VALUES
      (
        '2-point-acceleration-start',
        'three-point-start-acceleration',
        'two_point_vs_three_point_start_base',
        '{"leftStart":"two_point_no_ground_hand","rightStart":"three_point_one_ground_hand","changedDimensions":["start_position","support_contacts","accessibility","first_step_geometry"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        '45-degree-cut-and-stick',
        '45-degree-cut-bound-to-stick',
        'cut_plant_vs_bound_projection',
        '{"leftAction":"run_or_approach_then_cut_and_stick","rightAction":"bound_then_cut_or_reorient_and_stick","changedDimensions":["action_sequence","flight","contact_count","impact","braking_strategy"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        '45-degree-cut-and-stick',
        '90-degree-cut-and-stick',
        'forty_five_vs_ninety_degree_reorientation',
        '{"leftTurnDegrees":45,"rightTurnDegrees":90,"changedDimensions":["reorientation_angle","plant_geometry","braking_demand","exit_path"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'backpedal-to-sprint-to-stick',
        'backpedal-to-stick',
        'backpedal_sprint_and_terminal_stick_vs_backpedal_terminal_stick',
        '{"leftActions":["backpedal","turn_or_transition","sprint","stick"],"rightActions":["backpedal","stick"],"changedDimensions":["action_sequence","acceleration","distance","fatigue","time"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'balance-beam-lateral-walk',
        'balance-beam-walk',
        'lateral_side_step_vs_forward_walk',
        '{"leftDirection":"lateral","rightDirection":"forward","changedDimensions":["travel_direction","foot_sequence","visual_strategy","frontal_plane_demand"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'band-pull-apart',
        'band-pull-apart-to-w',
        'horizontal_pull_apart_vs_pull_apart_plus_w_rotation',
        '{"leftActions":["horizontal_pull_apart"],"rightActions":["horizontal_pull_apart","elbow_flexion","external_rotation_to_w"],"changedDimensions":["action_sequence","joint_actions","range","target_tissues"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'barbell-bench-press',
        'incline-barbell-bench-press',
        'flat_supine_vs_inclined_press_angle',
        '{"leftSupportAngle":"flat","rightSupportAngle":"inclined","changedDimensions":["torso_angle","press_vector","shoulder_flexion","load_tolerance"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'bench-pin-press',
        'bench-press-pin-iso',
        'concentric_press_from_pins_vs_isometric_pin_drive',
        '{"leftContraction":"concentric_press_from_dead_stop","rightContraction":"isometric_press_into_pins","changedDimensions":["contraction_type","joint_displacement","duration","load_expression"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'bodyweight-box-squat',
        'bodyweight-split-squat',
        'bilateral_box_squat_vs_split_stance_squat',
        '{"leftBase":"bilateral_with_box_target","rightBase":"split_stance","changedDimensions":["stance","laterality","support","box_contact","side_dosage"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'box-jump',
        'standing-box-jump-to-single-leg-landing',
        'bilateral_box_landing_vs_declared_single_leg_box_landing',
        '{"leftLanding":"bilateral_on_box","rightLanding":"single_leg_on_box","changedDimensions":["landing_laterality","stability","failure_consequence","side_dosage"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'box-squat',
        'single-leg-squat-to-box',
        'bilateral_box_squat_vs_unilateral_box_target_squat',
        '{"leftLaterality":"bilateral","rightLaterality":"unilateral","changedDimensions":["laterality","base","balance","side_dosage","load_distribution"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'cone-lateral-shuffle-hiit-fitness',
        'lateral-one-in-shuffle',
        'open_lane_conditioning_shuffle_vs_ladder_one_in_foot_pattern',
        '{"leftContract":"lateral_shuffle_between_cones_for_interval","rightContract":"one_foot_per_ladder_space_lateral_pattern","changedDimensions":["foot_pattern","environment","cadence","conditioning_intent"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'continuous-low-hurdle-hop',
        'low-hurdle-hop-continuous-with-turn',
        'continuous_linear_hops_vs_hops_with_declared_turn',
        '{"leftActions":["repeated_low_hurdle_hop"],"rightActions":["repeated_low_hurdle_hop","turn"],"changedDimensions":["action_sequence","orientation","landing_geometry","contact_plan"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'continuous-low-hurdle-hop',
        'low-hurdle-pogo-continuous',
        'deeper_hurdle_hop_strategy_vs_ankle_dominant_pogo_strategy',
        '{"leftStrategy":"declared_hurdle_hop","rightStrategy":"ankle_dominant_pogo","changedDimensions":["joint_strategy","amplitude","ground_contact","impact_distribution"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'countermovement-jump',
        'countermovement-jump-rebound',
        'single_projection_landing_vs_projection_plus_immediate_rebound',
        '{"leftProjectionCount":1,"rightActions":["countermovement_jump","landing","rebound"],"changedDimensions":["contact_count","action_sequence","reactive_demand","impact_budget"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'dead-bug-wall-press',
        'medicine-ball-dead-bug-press',
        'legacy_dead_bug_press_contract_under_specified',
        '{"knownLeft":{"forceSource":"fixed_wall","legAction":"alternating_leg_motion"},"knownRight":{"forceSource":"movable_medicine_ball","legAction":"not_declared"},"missingDimensions":["exact_ball_position","exact_press_direction","exact_leg_action","return_contract"],"candidateOutcomes":["distinct_force_and_leg_action_contracts","one_identity_with_resistance_variants"]}'::JSONB,
        'needs_human_review'
      ),
      (
        'decline-push-up',
        'incline-push-up',
        'feet_elevated_decline_vs_hands_elevated_incline_support',
        '{"leftSupport":"feet_elevated","rightSupport":"hands_elevated","changedDimensions":["body_angle","load_distribution","shoulder_demand","difficulty_direction"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'depth-drop-to-broad-rebound',
        'depth-drop-to-rebound',
        'horizontal_broad_rebound_vs_unspecified_or_vertical_rebound',
        '{"leftReboundDirection":"horizontal_broad","rightReboundDirection":"vertical_or_declared_general","changedDimensions":["projection_direction","landing_target","space","braking_and_reprojection"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'depth-drop-to-lateral-rebound',
        'depth-drop-to-rebound',
        'lateral_rebound_vs_unspecified_or_vertical_rebound',
        '{"leftReboundDirection":"lateral","rightReboundDirection":"vertical_or_declared_general","changedDimensions":["projection_direction","landing_laterality","space","frontal_plane_demand"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'distance-jump-straight-leg-bound',
        'distance-jump-straight-leg-bound-march',
        'elastic_straight_leg_bound_vs_lower_intensity_march',
        '{"leftStrategy":"repeated_elastic_bound","rightStrategy":"controlled_march_preparation","changedDimensions":["flight","contact_intensity","cadence","impact","purpose"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'double-dumbbell-front-squat',
        'split-squat',
        'bilateral_front_rack_squat_vs_split_stance_squat',
        '{"leftBase":"bilateral_front_squat","rightBase":"split_stance","changedDimensions":["stance","laterality","load_distribution","side_dosage"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'drop-catch-medicine-ball-chest-pass',
        'medicine-ball-chest-pass',
        'drop_catch_preload_plus_pass_vs_pass_only',
        '{"leftActions":["drop","catch_or_absorb","chest_pass"],"rightActions":["chest_pass"],"changedDimensions":["action_sequence","incoming_load","reactive_demand","contact_count"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'drop-landing-to-lateral-stick',
        'drop-landing-to-stick',
        'lateral_terminal_projection_or_landing_vs_vertical_drop_stick',
        '{"leftDirection":"lateral","rightDirection":"vertical_drop","changedDimensions":["landing_direction","base_geometry","frontal_plane_demand","target"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'front-rack-kettlebell-split-squat',
        'single-kettlebell-front-rack-squat',
        'split_stance_squat_vs_bilateral_front_rack_squat',
        '{"leftBase":"split_stance","rightBase":"bilateral_squat","changedDimensions":["stance","laterality","load_distribution","side_dosage"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'glute-bridge-iso-hold',
        'single-leg-glute-bridge-hold',
        'bilateral_isometric_bridge_vs_unilateral_isometric_bridge',
        '{"leftLaterality":"bilateral","rightLaterality":"unilateral","changedDimensions":["laterality","pelvic_control","load_distribution","side_dosage"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'half-kneeling-anti-rotation-press-lift-hold',
        'half-kneeling-landmine-anti-rotation-press',
        'band_press_or_lift_hold_vs_fixed_arc_landmine_press',
        '{"leftContract":"band_press_or_diagonal_lift_hold","rightContract":"fixed_angled_landmine_press","changedDimensions":["primary_action","resistance_vector","implement_path","hold_contract"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'half-kneeling-hip-flexor-reach',
        'half-kneeling-hip-flexor-rockback-with-reach',
        'static_reach_vs_rockback_and_reach_sequence',
        '{"leftActions":["half_kneeling_reach"],"rightActions":["half_kneeling_rockback","reach"],"changedDimensions":["action_sequence","hip_excursion","weight_shift","range"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'half-kneeling-medicine-ball-shot-put-throw',
        'medicine-ball-shot-put-throw',
        'half_kneeling_base_vs_standing_or_declared_general_base',
        '{"leftBase":"half_kneeling","rightBase":"standing_or_declared_general","changedDimensions":["base","leg_contribution","pelvic_control","side_dosage"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'half-kneeling-one-arm-landmine-press',
        'tall-kneeling-one-arm-landmine-press',
        'half_kneeling_asymmetric_base_vs_tall_kneeling_symmetric_base',
        '{"leftBase":"half_kneeling_asymmetric","rightBase":"tall_kneeling_symmetric","changedDimensions":["base","laterality","hip_position","pelvic_control","side_dosage"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'half-kneeling-pallof-press',
        'tall-kneeling-pallof-press-hold',
        'half_kneeling_dynamic_press_vs_tall_kneeling_hold',
        '{"leftBase":"half_kneeling","leftAction":"press_and_return","rightBase":"tall_kneeling","rightAction":"press_hold","changedDimensions":["base","laterality","contraction_type","duration"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'half-kneeling-pallof-press',
        'half-kneeling-single-arm-press',
        'horizontal_anti_rotation_press_vs_vertical_overhead_press',
        '{"leftAction":"horizontal_anti_rotation_press","rightAction":"vertical_overhead_press","changedDimensions":["press_direction","primary_stimulus","resistance_line","joint_actions"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'heavy-sled-push-march',
        'heavy-sled-push-strength',
        'deliberate_march_step_pattern_vs_general_heavy_push',
        '{"leftStepPattern":"march","rightStepPattern":"general_heavy_push","changedDimensions":["gait_pattern","cadence","knee_drive","distance_strategy","purpose"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'hurdle-hop-to-box-jump',
        'lateral-hurdle-hop-to-box-jump',
        'forward_hurdle_approach_vs_lateral_hurdle_approach',
        '{"leftApproach":"forward","rightApproach":"lateral","changedDimensions":["approach_direction","landing_geometry","frontal_plane_demand","space"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'hurdle-hop-to-box-jump',
        'single-leg-hurdle-hop-to-box-jump',
        'bilateral_or_declared_general_hurdle_hop_vs_single_leg_hurdle_hop',
        '{"leftTakeoff":"bilateral_or_declared_general","rightTakeoff":"single_leg","changedDimensions":["takeoff_laterality","landing_laterality","impact","side_dosage"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'incline-plyo-push-up',
        'incline-push-up',
        'ballistic_hand_release_press_vs_continuous_controlled_press',
        '{"leftForceStrategy":"ballistic_plyometric","rightForceStrategy":"controlled_continuous","changedDimensions":["flight_or_hand_release","impact","force_strategy","fatigue"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'kettlebell-bottoms-up-carry',
        'kettlebell-bottoms-up-curl',
        'loaded_gait_carry_vs_elbow_flexion_curl',
        '{"leftAction":"bottoms_up_loaded_carry","rightAction":"bottoms_up_elbow_flexion","changedDimensions":["primary_action","locomotion","joint_actions","dosage"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'kettlebell-deadlift',
        'sumo-deadlift',
        'declared_kettlebell_hinge_vs_wide_stance_sumo_deadlift',
        '{"leftStance":"declared_kettlebell_deadlift_stance","rightStance":"wide_sumo","changedDimensions":["stance","grip_location","knee_hip_contribution","implement_path"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'kettlebell-deadlift',
        'romanian-deadlift',
        'floor_start_deadlift_vs_top_down_romanian_hinge',
        '{"leftStart":"floor_or_declared_start","rightStart":"top_down","changedDimensions":["start_position","knee_flexion","range","eccentric_emphasis"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'kneeling-medicine-ball-chest-pass',
        'medicine-ball-chest-pass',
        'kneeling_no_leg_drive_base_vs_standing_or_declared_general_base',
        '{"leftBase":"tall_or_half_kneeling","rightBase":"standing_or_declared_general","changedDimensions":["base","leg_contribution","pelvic_control","variant_contract"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'landmine-anti-rotation-press',
        'landmine-rotational-press',
        'resist_rotation_vs_produce_rotation',
        '{"leftForceStrategy":"resist_rotation","rightForceStrategy":"produce_rotation","changedDimensions":["force_strategy","trunk_action","hip_contribution","press_path"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'landmine-ball-grip-press',
        'landmine-ball-grip-rotational-press',
        'nonrotational_press_vs_rotational_press',
        '{"leftAction":"declared_nonrotational_press","rightAction":"rotational_press","changedDimensions":["trunk_action","hip_contribution","force_direction","stance"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'landmine-ball-grip-press',
        'landmine-ball-grip-squat-to-press',
        'press_only_vs_squat_then_press',
        '{"leftActions":["press"],"rightActions":["squat","press"],"changedDimensions":["action_sequence","lower_body_action","fatigue","duration"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'landmine-ball-grip-rotational-press',
        'landmine-rotational-press',
        'ball_grip_attachment_vs_direct_bar_grip',
        '{"leftGrip":"ball_attachment_grip","rightGrip":"direct_bar_or_handle_grip","changedDimensions":["grip_implement","wrist_position","bar_path_interface","load_limit"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'landmine-drop-step-rotational-press',
        'landmine-rotational-press',
        'drop_step_approach_sequence_vs_in_place_rotation',
        '{"leftActions":["drop_step","rotate","press"],"rightActions":["in_place_rotate","press"],"changedDimensions":["action_sequence","footwork","momentum","space"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'landmine-rotational-press',
        'landmine-split-stance-rotational-press',
        'declared_general_rotation_base_vs_fixed_split_stance_base',
        '{"leftBase":"declared_general_or_square","rightBase":"split_stance","changedDimensions":["stance","laterality","load_transfer","side_dosage"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'lateral-bound-to-rotational-throw',
        'rotational-bound-to-stick',
        'bound_plus_rotational_throw_vs_bound_and_terminal_stick',
        '{"leftActions":["lateral_bound","capture","rotational_throw"],"rightActions":["rotational_bound","terminal_stick"],"changedDimensions":["added_action","implement","release","landing_contract"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'lateral-bound-to-stick',
        'rotational-bound-to-stick',
        'lateral_projection_without_declared_rotation_vs_rotational_projection',
        '{"leftProjection":"lateral","rightProjection":"rotational","changedDimensions":["body_orientation","rotation","landing_geometry","projection_strategy"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'lateral-hop-to-stick',
        'single-leg-lateral-hop-to-stick',
        'legacy_lateral_hop_laterality_under_specified',
        '{"knownLeft":{"direction":"lateral","laterality":"not_declared"},"knownRight":{"direction":"lateral","takeoff":"one_declared_leg","landing":"same_declared_leg"},"missingDimensions":["left_takeoff_laterality","left_landing_laterality","left_free_foot_contract"],"candidateOutcomes":["distinct_bilateral_vs_unilateral_hops","duplicate_single_leg_identity"]}'::JSONB,
        'needs_human_review'
      ),
      (
        'low-beam-bear-crawl',
        'slow-bear-crawl',
        'narrow_elevated_beam_path_vs_floor_crawl_tempo',
        '{"leftEnvironment":"low_narrow_beam","rightEnvironment":"floor_open_lane","changedDimensions":["support_surface","fall_consequence","path_width","balance_strategy"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'low-hurdle-hop-to-stick',
        'low-hurdle-lateral-hop-to-stick',
        'forward_hurdle_hop_vs_lateral_hurdle_hop',
        '{"leftDirection":"forward_or_declared_general","rightDirection":"lateral","changedDimensions":["projection_direction","landing_geometry","frontal_plane_demand","target"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'l-sit',
        'v-sit',
        'horizontal_leg_l_sit_shape_vs_elevated_v_sit_shape',
        '{"leftShape":"legs_near_horizontal_l","rightShape":"legs_elevated_v","changedDimensions":["hip_flexion_angle","center_of_mass","compression_demand","balance"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'med-ball-countermovement-rotational-throw',
        'medicine-ball-countermovement-throw',
        'legacy_countermovement_projection_direction_under_specified',
        '{"knownLeft":{"preload":"countermovement","projection":"rotational"},"knownRight":{"preload":"countermovement","projection":"not_declared"},"missingDimensions":["right_projection_direction","right_stance","right_target","right_return_contract"],"candidateOutcomes":["distinct_rotational_vs_forward_or_overhead_projection","duplicate_rotational_variant"]}'::JSONB,
        'needs_human_review'
      ),
      (
        'med-ball-slam-to-rotational-throw',
        'medicine-ball-rotational-throw',
        'slam_then_rotational_throw_sequence_vs_rotational_throw_only',
        '{"leftActions":["slam","recover_or_receive","rotational_throw"],"rightActions":["rotational_throw"],"changedDimensions":["action_sequence","contact_count","fatigue","ball_return"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'medicine-ball-catch-to-low-hop-and-stick',
        'medicine-ball-scoop-toss-catch-and-stick',
        'incoming_catch_then_hop_vs_scoop_toss_and_catch_absorption',
        '{"leftActions":["catch","low_hop","stick"],"rightActions":["scoop_toss","catch","stick"],"changedDimensions":["action_sequence","projection","incoming_load","contact_count"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'medicine-ball-chest-pass-catch-and-stick',
        'medicine-ball-pivot-catch-and-pass',
        'chest_pass_catch_absorption_vs_catch_pivot_and_repass',
        '{"leftActions":["chest_pass_or_receive","catch","stick"],"rightActions":["catch","pivot","pass"],"changedDimensions":["action_sequence","footwork","rotation","terminal_contract"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'medicine-ball-overhead-slam',
        'slam-ball-rotational-slam',
        'sagittal_overhead_slam_vs_rotational_slam',
        '{"leftDirection":"overhead_sagittal","rightDirection":"rotational_diagonal_or_transverse","changedDimensions":["projection_direction","trunk_action","target","stance"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'medicine-ball-overhead-slam',
        'tall-kneeling-overhead-medicine-ball-slam',
        'standing_or_declared_general_base_vs_tall_kneeling_base',
        '{"leftBase":"standing_or_declared_general","rightBase":"tall_kneeling","changedDimensions":["base","leg_contribution","pelvic_control","load_limit"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'medicine-ball-rotational-scoop-toss',
        'medicine-ball-scoop-toss',
        'rotational_lateral_projection_vs_forward_or_declared_general_scoop',
        '{"leftProjection":"rotational_lateral","rightProjection":"forward_or_declared_general","changedDimensions":["projection_direction","stance","trunk_rotation","target"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'medicine-ball-rotational-throw',
        'shuffle-to-rotational-medicine-ball-throw',
        'in_place_rotational_throw_vs_lateral_shuffle_approach_throw',
        '{"leftApproach":"standing_in_place","rightApproach":"lateral_shuffle_or_crow_hop","changedDimensions":["approach","foot_contacts","momentum","space","fatigue"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'nordic-hamstring-curl',
        'nordic-hamstring-eccentric',
        'full_curl_contract_vs_eccentric_only_lowering',
        '{"leftContraction":"full_declared_curl_with_return","rightContraction":"eccentric_only_lowering","changedDimensions":["contraction_type","return_strategy","range","fatigue"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'one-arm-landmine-arc-press',
        'one-arm-landmine-z-press',
        'standing_or_declared_arc_press_vs_seated_z_press_base',
        '{"leftBase":"standing_or_declared_base","leftPath":"arc_press","rightBase":"seated_z_sit","rightPath":"press","changedDimensions":["base","hip_contribution","press_path","mobility"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'one-arm-landmine-arc-press',
        'one-arm-landmine-push-press',
        'arc_press_without_declared_leg_drive_vs_push_press_leg_drive',
        '{"leftForceStrategy":"declared_arc_press","rightForceStrategy":"dip_and_leg_drive_push_press","changedDimensions":["leg_drive","force_strategy","load_potential","coordination"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'one-arm-landmine-push-press',
        'one-arm-landmine-z-press',
        'standing_leg_drive_push_press_vs_seated_no_leg_drive_press',
        '{"leftBase":"standing","leftLegDrive":true,"rightBase":"seated_z_sit","rightLegDrive":false,"changedDimensions":["base","leg_drive","load_potential","mobility"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'reactive-45-degree-cut',
        'reactive-45-degree-hop-to-cut',
        'reactive_cut_vs_hop_then_reactive_cut',
        '{"leftActions":["reactive_cut"],"rightActions":["hop","land","reactive_cut"],"changedDimensions":["action_sequence","contact_count","impact","timing"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'scapular-pull-up',
        'scapular-push-up',
        'hanging_scapular_depression_vs_plank_scapular_protraction',
        '{"leftBase":"hanging","leftAction":"scapular_depression_and_elevation","rightBase":"plank","rightAction":"scapular_protraction_and_retraction","changedDimensions":["base","joint_action","load_direction","grip"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'side-plank',
        'side-plank-row',
        'isometric_side_plank_vs_side_plank_plus_row',
        '{"leftActions":["side_plank_hold"],"rightActions":["side_plank_hold","row"],"changedDimensions":["added_action","external_load","shoulder_action","fatigue"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'single-leg-glute-bridge',
        'single-leg-glute-bridge-hold',
        'dynamic_repetitions_vs_isometric_terminal_hold',
        '{"leftContraction":"dynamic_concentric_eccentric_repetitions","rightContraction":"isometric_hold","changedDimensions":["contraction_type","joint_displacement","duration","dosage"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'single-leg-hop-to-stick',
        'single-leg-lateral-hop-to-stick',
        'forward_or_declared_general_hop_vs_lateral_hop',
        '{"leftDirection":"forward_or_declared_general","rightDirection":"lateral","changedDimensions":["projection_direction","landing_geometry","frontal_plane_demand","target"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'snap-down-to-pogo-rebound',
        'snap-down-to-rebound',
        'snap_down_plus_pogo_series_vs_single_rebound',
        '{"leftActions":["snap_down","multiple_low_pogos"],"rightActions":["snap_down","single_vertical_rebound"],"changedDimensions":["contact_count","action_sequence","reactive_strategy","impact_budget"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'snap-down-to-stick',
        'step-down-to-stick',
        'active_snap_down_from_tall_vs_elevated_step_down_landing',
        '{"leftStart":"standing_tall","leftAction":"active_snap_down","rightStart":"elevated_step","rightAction":"step_down_and_land","changedDimensions":["start_height","action","flight_or_drop","impact"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'split-squat-jump',
        'squat-jump',
        'split_stance_asymmetric_jump_vs_bilateral_squat_jump',
        '{"leftBase":"split_stance_asymmetric","rightBase":"bilateral_squat","changedDimensions":["stance","laterality","propulsion_distribution","landing","side_dosage"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'split-stance-one-arm-landmine-press',
        'square-stance-one-arm-landmine-press',
        'split_stance_asymmetric_base_vs_square_bilateral_base',
        '{"leftBase":"split_stance","rightBase":"square_stance","changedDimensions":["stance","laterality","load_transfer","pelvic_control","side_dosage"]}'::JSONB,
        'distinct_exercises'
      ),
      (
        'weighted-vest-pull-up-strength',
        'weighted-vest-push-up-strength',
        'vertical_pull_vs_horizontal_push',
        '{"leftAction":"vertical_pull","rightAction":"horizontal_push","changedDimensions":["primary_action","joint_actions","base","load_direction","target_tissues"]}'::JSONB,
        'distinct_exercises'
      )
    ) AS boundaries(
      left_slug,
      right_slug,
      identity_boundary,
      evidence,
      decision
    )
  LOOP
    IF EXISTS (
      SELECT 1
      FROM coaching.exercise_definition_v1 active_right
      WHERE active_right.slug = boundary.right_slug
        AND active_right.status <> 'archived'
        AND NOT EXISTS (
          SELECT 1
          FROM coaching.exercise_definition_v1 active_left
          WHERE active_left.facility_id = active_right.facility_id
            AND active_left.slug = boundary.left_slug
            AND active_left.status <> 'archived'
        )
    ) THEN
      RAISE EXCEPTION
        'Identity adjudication found active definition % without % in the same facility',
        boundary.right_slug,
        boundary.left_slug;
    END IF;

    FOR left_definition IN
      SELECT id, facility_id, canonical_name
      FROM coaching.exercise_definition_v1
      WHERE slug = boundary.left_slug
        AND status <> 'archived'
    LOOP
      SELECT id, canonical_name
      INTO right_definition
      FROM coaching.exercise_definition_v1
      WHERE facility_id = left_definition.facility_id
        AND slug = boundary.right_slug
        AND status <> 'archived';

      IF right_definition.id IS NULL THEN
        CONTINUE;
      END IF;

      SELECT COUNT(*)
      INTO conflicting_resolutions
      FROM coaching.exercise_identity_resolution_v1 resolution
      WHERE (
        (
          resolution.survivor_definition_id = left_definition.id
          AND resolution.resolved_definition_id = right_definition.id
        )
        OR (
          resolution.survivor_definition_id = right_definition.id
          AND resolution.resolved_definition_id = left_definition.id
        )
      )
        AND resolution.decision <> boundary.decision;

      IF conflicting_resolutions > 0 THEN
        RAISE EXCEPTION
          'Identity adjudication for % and % conflicts with % existing resolution(s)',
          boundary.left_slug,
          boundary.right_slug,
          conflicting_resolutions;
      END IF;

      INSERT INTO coaching.exercise_identity_resolution_v1 (
        facility_id,
        survivor_definition_id,
        resolved_definition_id,
        decision,
        rationale,
        evidence_json,
        resolution_source,
        reviewed_by
      )
      SELECT
        left_definition.facility_id,
        left_definition.id,
        right_definition.id,
        boundary.decision,
        CASE boundary.decision
          WHEN 'distinct_exercises' THEN format(
            '%s and %s remain separate because their declared movement contracts cross the %s identity boundary.',
            left_definition.canonical_name,
            right_definition.canonical_name,
            boundary.identity_boundary
          )
          ELSE format(
            '%s and %s remain quarantined because the legacy sources do not declare enough information to resolve the %s identity boundary without human review.',
            left_definition.canonical_name,
            right_definition.canonical_name,
            boundary.identity_boundary
          )
        END,
        boundary.evidence || jsonb_build_object(
          'identityBoundary', boundary.identity_boundary,
          'decisionScope',
            'identity_only_not_card_media_graph_calibration_or_publication_approval',
          'humanReviewRequired',
            boundary.decision = 'needs_human_review',
          'exerciseDifficultyModel',
            'exercise_complexity_and_physical_difficulty_only',
          'proficiencyClassificationScope',
            'coaching_skill_library_only'
        ),
        'deterministic_identity_equivalence',
        NULL
      WHERE NOT EXISTS (
        SELECT 1
        FROM coaching.exercise_identity_resolution_v1 resolution
        WHERE (
          (
            resolution.survivor_definition_id = left_definition.id
            AND resolution.resolved_definition_id = right_definition.id
          )
          OR (
            resolution.survivor_definition_id = right_definition.id
            AND resolution.resolved_definition_id = left_definition.id
          )
        )
          AND resolution.decision = boundary.decision
      )
      ON CONFLICT (survivor_definition_id, resolved_definition_id)
      DO NOTHING;

      IF NOT EXISTS (
        SELECT 1
        FROM coaching.exercise_identity_resolution_v1 resolution
        WHERE (
          (
            resolution.survivor_definition_id = left_definition.id
            AND resolution.resolved_definition_id = right_definition.id
          )
          OR (
            resolution.survivor_definition_id = right_definition.id
            AND resolution.resolved_definition_id = left_definition.id
          )
        )
          AND resolution.decision = boundary.decision
      ) THEN
        RAISE EXCEPTION
          'Identity adjudication for % and % was not persisted',
          boundary.left_slug,
          boundary.right_slug;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;
