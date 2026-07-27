-- Adjudicate the score-73 identity queue after score-74 consolidation.
--
-- Each boundary is based on the source-card movement contract, not athlete
-- proficiency. Exercise cards use exercise complexity and physical difficulty
-- only. Ambiguous source contracts remain quarantined for human review.
-- This migration creates no card, media, relationship, calibration, or
-- publication approval. IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '393_coaching_score_73_identity_boundaries';
  boundary RECORD;
  left_id UUID;
  right_id UUID;
  left_name TEXT;
  right_name TEXT;
  facility BIGINT;
  rationale_text TEXT;
BEGIN
  FOR boundary IN
    SELECT *
    FROM (VALUES
      ('split-squat-jump-to-stick','squat-jump','distinct_exercises','split_stance_unilateral_bias_vs_bilateral_static_takeoff','["stance","laterality","takeoff_support","landing_contract","side_dose"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/33359798/"]'::JSONB),
      ('landmine-press','landmine-rotational-press','distinct_exercises','fixed_trunk_angled_press_vs_deliberate_hip_trunk_rotation','["rotation_objective","foot_pivot","stance","force_direction","side_dose"]'::JSONB,'["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB),
      ('landmine-rotational-press','landmine-row-with-hip-rotation','distinct_exercises','rotational_press_vs_rotational_pull','["force_direction","elbow_action","bar_path","muscle_action","failure_response"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/19620925/"]'::JSONB),
      ('half-kneeling-anti-rotation-press-lift-hold','landmine-press','distinct_exercises','band_press_or_lift_isometric_vs_fixed_bar_angled_press','["implement_behavior","force_direction","contraction_mode","hand_path","return_contract"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/32707142/"]'::JSONB),
      ('medicine-ball-catch-to-decel-stick','medicine-ball-pivot-catch-and-pass','distinct_exercises','terminal_catch_and_brake_vs_catch_pivot_and_outgoing_pass','["action_order","pivot","outgoing_release","terminal_state","repetition_boundary"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB),
      ('medicine-ball-catch-to-decel-stick','medicine-ball-chest-pass','distinct_exercises','incoming_catch_and_absorption_vs_outgoing_chest_projection','["object_direction","hand_action","release","absorption","terminal_state"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB),
      ('drop-landing-to-stick','single-leg-hop-to-stick','distinct_exercises','passive_elevated_drop_vs_active_unilateral_projection','["takeoff","flight_origin","laterality","projection","impact"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB),
      ('drop-catch-medicine-ball-chest-pass','medicine-ball-catch-to-decel-stick','distinct_exercises','incoming_drop_catch_to_rapid_reoutput_vs_terminal_catch_and_stop','["incoming_trajectory","reoutput","release","action_order","terminal_state"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB),
      ('dead-bug-iso-press','dead-bug-pullover-band-dead-bug','distinct_exercises','contralateral_hand_knee_press_vs_overhead_pullover_resistance','["force_interface","arm_path","implement","shoulder_action","lever"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/32707142/"]'::JSONB),
      ('half-kneeling-one-arm-landmine-press','landmine-press','needs_human_review','generic_landmine_press_missing_hand_count_and_base_contract','["generic card hand count","generic card stance","generic card laterality","whether half-kneeling is included"]'::JSONB,'["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB),
      ('medicine-ball-catch-to-decel-stick','medicine-ball-rotational-catch-and-stick','distinct_exercises','sagittal_or_declared_catch_and_brake_vs_rotational_catch_absorption','["plane","trunk_rotation","stance","incoming_direction","side_dose"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB),
      ('squat-jump','static-squat-jump-to-box','distinct_exercises','floor_to_floor_vertical_jump_vs_floor_to_elevated_box','["landing_surface","target_height","impact","exit","failure_consequence"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/33359798/"]'::JSONB),
      ('drop-squat-to-stick','squat-jump','distinct_exercises','rapid_downward_reposition_without_takeoff_vs_vertical_projection','["takeoff","flight","force_direction","terminal_action","impact"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB),
      ('landmine-press','landmine-rotation','distinct_exercises','angled_press_vs_arc_rotation_without_required_press','["elbow_action","bar_path","rotation","force_direction","terminal_position"]'::JSONB,'["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB),
      ('landmine-press','pallof-press-pallof-hold','distinct_exercises','fixed_bar_angled_press_vs_horizontal_anti_rotation_press_or_hold','["implement_behavior","force_vector","anti_rotation","contraction_mode","setup"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/32707142/"]'::JSONB),
      ('squat-jump','tuck-jump','distinct_exercises','static_vertical_jump_vs_airborne_knee_tuck','["airborne_action","hip_flexion","start_contract","landing_demand","progression"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/33359798/"]'::JSONB),
      ('landmine-ball-grip-rotational-press','landmine-row-with-hip-rotation','distinct_exercises','rotational_press_vs_rotational_row','["force_direction","elbow_action","bar_path","attachment","failure_response"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/19620925/"]'::JSONB),
      ('barbell-z-press','kettlebell-strict-press','distinct_exercises','unsupported_floor_seated_press_vs_upright_strict_press','["base","hip_position","lower_body_support","implement","setup"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/23096062/"]'::JSONB),
      ('180-jump-to-stick','squat-jump','distinct_exercises','half_turn_jump_and_reorientation_vs_nonrotational_vertical_jump','["rotation","visual_reorientation","landing_orientation","balance","space"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB),
      ('barbell-z-press','dumbbell-incline-press','distinct_exercises','unsupported_floor_vertical_press_vs_incline_bench_press','["base","torso_angle","support","press_direction","setup"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/36026487/"]'::JSONB),
      ('landmine-row-with-hip-rotation','one-arm-landmine-row','distinct_exercises','deliberate_hip_trunk_rotation_vs_braced_unilateral_row','["rotation_objective","stance","bar_path","trunk_constraint","side_dose"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/19620925/"]'::JSONB),
      ('barbell-z-press','bottoms-up-kettlebell-press','distinct_exercises','floor_seated_press_vs_bottoms_up_instability_press','["base","implement_orientation","grip_stability","load_ceiling","failure_response"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/23096062/"]'::JSONB),
      ('drop-landing-to-stick','single-leg-lateral-hop-to-stick','distinct_exercises','passive_vertical_drop_vs_active_lateral_unilateral_projection','["takeoff","projection_direction","laterality","flight_origin","impact"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB),
      ('drop-landing-to-stick','single-leg-triple-hop-to-stick','distinct_exercises','single_imposed_drop_vs_three_active_horizontal_hops','["takeoff","contact_count","projection_distance","laterality","repetition_boundary"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB),
      ('kneeling-medicine-ball-chest-pass','medicine-ball-catch-to-decel-stick','distinct_exercises','kneeling_outgoing_chest_pass_vs_upright_incoming_catch_and_brake','["object_direction","base","release","absorption","terminal_state"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB),
      ('landmine-ball-grip-anti-rotation-hold','landmine-row-with-hip-rotation','distinct_exercises','isometric_anti_rotation_hold_vs_dynamic_rotational_pull','["contraction_mode","rotation_objective","elbow_action","bar_path","dose_unit"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/32707142/"]'::JSONB),
      ('landmine-drop-step-rotational-press','landmine-press','distinct_exercises','drop_step_rotation_and_press_sequence_vs_press_without_required_step','["foot_contacts","rotation","action_order","momentum","space"]'::JSONB,'["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB),
      ('barbell-z-press','dumbbell-squeeze-press','distinct_exercises','floor_seated_vertical_press_vs_supine_horizontal_adduction_press','["base","body_orientation","press_direction","implement_pressure","support"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/23096062/"]'::JSONB),
      ('landmine-drop-step-rotational-press','landmine-row-with-hip-rotation','distinct_exercises','drop_step_rotational_press_vs_rotational_pull','["foot_contacts","force_direction","elbow_action","action_order","bar_path"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/19620925/"]'::JSONB),
      ('45-degree-cut-bound-to-stick','90-degree-speed-cut','distinct_exercises','forty_five_degree_cut_then_bound_vs_ninety_degree_cut','["redirect_angle","bound","contact_count","exit","landing_contract"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/33098142/"]'::JSONB),
      ('5-10-5-decel-stick','jog-to-stick-linear-deceleration','distinct_exercises','multidirectional_shuttle_and_terminal_brake_vs_single_linear_deceleration','["route","direction_changes","distance","contact_sequence","measurement"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/33098142/"]'::JSONB),
      ('ankling-pogo-hop','ankling-walk','distinct_exercises','repeated_airborne_pogo_contacts_vs_grounded_ankling_gait','["flight","gait","contact_time","amplitude","impact"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/17544325/"]'::JSONB),
      ('ankling-pogo-hop','line-pogo-hops','distinct_exercises','ankling_posture_pogo_vs_two_foot_line_crossing_pattern','["foot_count","line_target","direction","posture","contact_placement"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/17544325/"]'::JSONB),
      ('backpedal-to-sprint-turn','serpentine-sprint-to-backpedal-drill','distinct_exercises','single_backward_to_forward_turn_transition_vs_repeated_serpentine_route','["route","transition_count","curve","distance","repetition_boundary"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/33217086/"]'::JSONB),
      ('medicine-ball-overhead-back-throw','slam-ball-rotational-slam','distinct_exercises','backward_overhead_projection_vs_rotational_downward_slam','["force_direction","plane","release_angle","target","retrieval"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB),
      ('band-cable-row','cable-band-lift','distinct_exercises','horizontal_pull_vs_diagonal_lift','["force_direction","hand_path","plane","elbow_action","trunk_rotation"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/19620925/"]'::JSONB),
      ('beam-split-stance-reach','split-stance-reactive-hop-switch','distinct_exercises','supported_balance_reach_vs_reactive_airborne_stance_switch','["flight","support_width","stimulus","contact_sequence","impact"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/30366506/"]'::JSONB),
      ('bent-over-barbell-row','dumbbell-rear-delt-row','distinct_exercises','elbows_near_trunk_row_vs_flared_rear_delt_row_path','["elbow_path","grip","implement","target_tissue","load_ceiling"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/19620925/"]'::JSONB),
      ('bent-over-barbell-row','romanian-deadlift','distinct_exercises','held_hip_hinge_with_upper_body_pull_vs_dynamic_loaded_hip_hinge','["elbow_action","hip_motion","load_path","repetition_boundary","primary_region"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/19620925/"]'::JSONB),
      ('bound-and-stick-ladder','lateral-bound','distinct_exercises','ladder_target_sequence_with_terminal_sticks_vs_open_single_lateral_bound','["equipment","target_sequence","contact_count","distance","repetition_boundary"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB),
      ('box-drill-sprint-shuffle-backpedal','serpentine-sprint-to-backpedal-drill','distinct_exercises','rectangular_multigait_box_route_vs_curved_serpentine_route','["route_geometry","gait_sequence","turns","cone_layout","measurement"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/33217086/"]'::JSONB),
      ('box-jump-to-depth-drop','low-box-drop-to-broad-jump','distinct_exercises','jump_to_box_then_drop_land_vs_drop_then_horizontal_jump','["action_order","first_takeoff","projection_direction","landing_surface","contact_count"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/33359798/"]'::JSONB),
      ('broad-jump-to-box-jump','standing-box-jump-to-single-leg-landing','distinct_exercises','horizontal_jump_then_box_jump_vs_single_box_jump_to_unilateral_landing','["action_count","projection_sequence","landing_foot_count","contact_count","space"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/33359798/"]'::JSONB),
      ('broad-jump-to-box-jump','hurdle-hop-to-broad-jump','distinct_exercises','broad_jump_then_box_target_vs_hurdle_contact_then_broad_jump','["action_order","obstacle","terminal_target","contact_count","landing_surface"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/33359798/"]'::JSONB),
      ('broad-jump-to-box-jump','pogo-to-box-jump','distinct_exercises','horizontal_jump_then_box_jump_vs_vertical_elastic_contacts_then_box_jump','["entry_action","projection_direction","contact_strategy","action_order","space"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/33359798/"]'::JSONB),
      ('broad-jump-to-stick','low-box-jump-to-stick','distinct_exercises','horizontal_floor_to_floor_projection_vs_vertical_floor_to_box_projection','["projection_direction","landing_surface","target_height","impact","exit"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/33359798/"]'::JSONB),
      ('broad-jump-to-stick','squat-jump','distinct_exercises','horizontal_projection_vs_vertical_projection','["force_direction","travel","landing_distance","measurement","space"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/33359798/"]'::JSONB),
      ('burpee-box-jump-over','side-to-side-box-jump-over','distinct_exercises','sprawl_push_up_to_box_jump_sequence_vs_repeated_lateral_box_crossing','["floor_transition","upper_body_support","direction","action_order","conditioning_demand"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/33359798/"]'::JSONB),
      ('cable-band-chop','cable-band-lift','distinct_exercises','high_to_low_diagonal_path_vs_low_to_high_diagonal_path','["force_direction","start_height","finish_height","trunk_action","stance"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/32707142/"]'::JSONB),
      ('cable-or-band-ninety-ninety-external-rotation','eccentric-band-external-rotation','needs_human_review','eccentric_source_missing_arm_abduction_and_rotation_plane','["eccentric source shoulder-abduction angle","rotation plane","start position","return assistance"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/38156065/"]'::JSONB),
      ('curved-bound-to-stick','lateral-bound','distinct_exercises','curved_route_bound_and_stick_vs_direct_lateral_projection','["route_geometry","projection_direction","contact_sequence","terminal_hold","space"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB),
      ('curved-sprint-arc-run','curved-sprint-bound','distinct_exercises','running_gait_on_curve_vs_exaggerated_airborne_bound_on_curve','["gait","flight_time","stride_amplitude","contact_pattern","impact"]'::JSONB,'["https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/"]'::JSONB),
      ('deceleration-step-down-stop-step-stick','jog-to-stick-linear-deceleration','distinct_exercises','declared_stop_step_sequence_vs_continuous_linear_braking_to_hold','["footwork_sequence","contact_count","braking_strategy","cue","repetition_boundary"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/33098142/"]'::JSONB),
      ('decline-push-up','dumbbell-incline-press','distinct_exercises','feet_elevated_closed_chain_push_up_vs_incline_bench_external_load_press','["kinetic_chain","body_orientation","support","load_path","failure_response"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/36026487/"]'::JSONB),
      ('depth-drop-to-box-jump','low-box-drop-to-broad-jump','distinct_exercises','drop_then_vertical_box_jump_vs_drop_then_horizontal_broad_jump','["projection_direction","terminal_target","landing_surface","space","measurement"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/33359798/"]'::JSONB),
      ('diagonal-bound-to-stick','lateral-bound','distinct_exercises','diagonal_projection_and_terminal_stick_vs_direct_lateral_bound','["projection_angle","terminal_hold","route","distance","side_dose"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB),
      ('drop-landing-to-stick','snap-down-to-stick','distinct_exercises','elevated_passive_drop_and_impact_vs_active_floor_connected_snap_down','["start_height","flight","impact","downward_action","equipment"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB),
      ('drop-squat-to-stick','split-squat-jump-to-stick','distinct_exercises','bilateral_rapid_downward_reposition_vs_split_stance_takeoff_and_flight','["stance","takeoff","flight","laterality","impact"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB),
      ('dumbbell-deadlift-from-floor','romanian-deadlift','distinct_exercises','floor_start_deadlift_vs_top_down_hip_hinge_without_floor_reset','["start_height","knee_flexion","floor_contact","range","reset"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/30676181/"]'::JSONB),
      ('dumbbell-waiter-carry','suitcase-carry','distinct_exercises','overhead_load_carry_vs_load_beside_hip_carry','["load_position","shoulder_angle","center_of_mass","grip","failure_response"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/38665162/"]'::JSONB),
      ('eccentric-pull-up','push-up','distinct_exercises','vertical_upper_body_pull_lowering_vs_horizontal_closed_chain_press','["force_direction","elbow_action","support","body_orientation","muscle_action"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/38156065/"]'::JSONB),
      ('front-squat','single-leg-squat-to-box','distinct_exercises','bilateral_anterior_loaded_squat_vs_unilateral_box_target_squat','["foot_count","laterality","target","load_position","side_dose"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/30676181/"]'::JSONB),
      ('half-kneeling-cable-lift','half-kneeling-medicine-ball-lift','distinct_exercises','anchored_resisted_diagonal_lift_vs_retained_free_ball_lift','["object_behavior","resistance_direction","release","load_path","return_contract"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/32707142/"]'::JSONB),
      ('half-kneeling-get-up-to-stand','kneeling-jump-to-stand','distinct_exercises','controlled_step_through_get_up_vs_ballistic_kneeling_takeoff','["takeoff","flight","foot_sequence","velocity","impact"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/33359798/"]'::JSONB),
      ('heavy-sled-push-strength','heavy-sled-row-strength','distinct_exercises','forward_sled_push_vs_pull_row_against_sled','["force_direction","hand_action","gait","elbow_action","setup"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/19620925/"]'::JSONB),
      ('hurdle-hop-to-box-jump','shuffle-to-box-jump','distinct_exercises','airborne_hurdle_entry_vs_grounded_lateral_shuffle_entry','["entry_gait","flight","contact_count","direction","space"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/33359798/"]'::JSONB),
      ('kettlebell-deadlift','split-squat','distinct_exercises','bilateral_floor_pull_vs_stationary_staggered_squat','["movement_pattern","stance","load_path","floor_start","side_dose"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/30676181/"]'::JSONB),
      ('l-drill-3-cone','x-drill-cone-cut','distinct_exercises','three_cone_l_route_vs_four_target_x_route','["route_geometry","cone_count","turn_sequence","distance","measurement"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/33098142/"]'::JSONB),
      ('lacrosse-roll-dodge-to-reaccelerate','lacrosse-split-dodge-to-acceleration','distinct_exercises','roll_dodge_rotation_vs_split_dodge_weight_shift','["dodge_footwork","rotation","stick_path","contact_sequence","exit"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/33098142/"]'::JSONB),
      ('landmine-rotation','one-arm-landmine-row','distinct_exercises','two_hand_or_declared_arc_rotation_vs_unilateral_pull','["bar_path","elbow_action","rotation","force_direction","stance"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/19620925/"]'::JSONB),
      ('landmine-squat-to-press','med-ball-squat-press-hiit-fitness','distinct_exercises','fixed_bar_angled_press_sequence_vs_free_ball_overhead_press_or_release','["implement_behavior","press_path","release","target","return_contract"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB),
      ('lateral-bound','lateral-shuffle-decel-stick','distinct_exercises','airborne_single_projection_vs_grounded_repeated_shuffle_and_brake','["flight","contact_count","gait","distance","braking"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB),
      ('medicine-ball-lateral-shuffle-pass','medicine-ball-shot-put-throw','distinct_exercises','lateral_shuffle_entry_then_pass_vs_stationary_or_declared_shot_put_projection','["entry_gait","foot_contacts","action_order","release_path","space"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB),
      ('medicine-ball-pivot-catch-and-pass','medicine-ball-rotational-catch-and-stick','distinct_exercises','catch_pivot_and_outgoing_pass_vs_rotational_catch_and_terminal_hold','["pivot","outgoing_release","terminal_state","action_order","partner_contract"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB),
      ('medicine-ball-rotational-catch-and-stick','medicine-ball-shot-put-throw','distinct_exercises','incoming_rotational_catch_absorption_vs_outgoing_shot_put_projection','["object_direction","release","catch","absorption","terminal_state"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB),
      ('mirror-shuffle','partner-crossover-mirror-box','distinct_exercises','lateral_mirror_shuffle_vs_crossover_pattern_inside_box_route','["gait","route","crossover","space","error_definition"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/33098142/"]'::JSONB),
      ('mirror-shuffle','partner-mirror-shuffle-with-crossover-exit','distinct_exercises','continuous_mirror_shuffle_vs_mirror_then_crossover_exit_sequence','["terminal_exit","crossover","action_order","cue","repetition_boundary"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/33098142/"]'::JSONB),
      ('partner-chase-first-step-sprint','partner-point-reactive-sprint-start','distinct_exercises','moving_partner_chase_stimulus_vs_partner_point_directional_cue','["stimulus","decision_branch","target","first_movement","success_metric"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/33098142/"]'::JSONB),
      ('partner-point-hop-to-stick','star-hop-to-stick','distinct_exercises','live_partner_selected_hop_direction_vs_predeclared_star_target_sequence','["stimulus","target_selection","anticipation","route","error_definition"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB),
      ('quadruped-shoulder-circles','quadruped-spinal-circles','distinct_exercises','glenohumeral_scapular_circles_vs_segmental_spinal_circles','["primary_joints","moving_region","range","trunk_motion","support_shift"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/22889652/"]'::JSONB),
      ('reactive-broad-jump-d7','repeated-broad-jump','distinct_exercises','approach_to_single_elastic_broad_jump_vs_two_or_three_jump_series','["approach","jump_count","contact_count","rebound_sequence","repetition_boundary"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/33359798/"]'::JSONB),
      ('bulgarian-split-squat','push-up','distinct_exercises','rear_foot_elevated_lower_body_squat_vs_upper_body_horizontal_press','["body_region","support","joint_actions","load_path","orientation"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/30676181/"]'::JSONB),
      ('ring-row-eccentric','romanian-deadlift','distinct_exercises','suspended_upper_body_pull_lowering_vs_loaded_hip_hinge','["body_region","force_direction","elbow_action","hip_motion","support"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/19620925/"]'::JSONB),
      ('barbell-rollout','bent-over-barbell-row','distinct_exercises','rolling_long_lever_trunk_extension_vs_fixed_hinge_upper_body_pull','["implement_behavior","elbow_action","shoulder_path","trunk_motion","load_path"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/32707142/"]'::JSONB),
      ('side-to-side-box-jump-over','skater-jump-to-box','distinct_exercises','repeated_bilateral_box_crossings_vs_single_lateral_projection_to_box','["takeoff_foot_count","contact_sequence","route","terminal_target","repetition_boundary"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/33359798/"]'::JSONB),
      ('single-leg-cone-reach-stick','single-leg-romanian-deadlift','distinct_exercises','multi_target_free_foot_or_hand_reach_balance_task_vs_loaded_or_unloaded_hip_hinge','["target_sequence","hinge_requirement","trail_leg_path","load","repetition_boundary"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/30366506/"]'::JSONB),
      ('single-leg-hop-stick-plus-catch','single-leg-hop-to-stick','distinct_exercises','hop_and_stick_with_incoming_object_catch_vs_hop_only','["object_flight","visual_tracking","hand_action","catch_timing","failure_state"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB),
      ('single-leg-lateral-box-jump','single-leg-lateral-hop-to-stick','distinct_exercises','unilateral_lateral_jump_to_elevated_box_vs_floor_to_floor_hop','["landing_surface","target_height","impact","exit","failure_consequence"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/33359798/"]'::JSONB),
      ('single-leg-line-hop-and-stick','single-leg-pogo-hold-stick','needs_human_review','sources_missing_exact_contact_count_line_direction_and_hold_order','["line-hop contact count","line direction","pogo contact count","hold timing","terminal behavior"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB),
      ('single-leg-pogo','single-leg-rebound-hop','needs_human_review','rebound_source_missing_amplitude_contact_count_and_terminal_behavior','["rebound amplitude","contact count","direction","terminal stick","repetition boundary"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/17544325/"]'::JSONB),
      ('single-leg-takeoff-to-two-foot-box-landing','standing-box-jump-to-single-leg-landing','distinct_exercises','unilateral_takeoff_bilateral_landing_vs_bilateral_takeoff_unilateral_landing','["takeoff_foot_count","landing_foot_count","laterality","balance","side_dose"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/33359798/"]'::JSONB),
      ('slam-ball-slam-to-sprint-start','slam-ball-sprawl-to-slam','distinct_exercises','slam_then_acceleration_exit_vs_sprawl_then_slam','["action_order","floor_support","sprint_exit","contact_sequence","space"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB),
      ('split-stance-anti-rotation-row','wall-split-stance-rotation-reach','distinct_exercises','anchored_pull_resisting_rotation_vs_supported_reach_with_deliberate_rotation','["force_direction","rotation_objective","elbow_action","wall_support","hand_path"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/19620925/"]'::JSONB),
      ('split-stance-one-arm-landmine-press','tall-kneeling-one-arm-landmine-press','distinct_exercises','split_stance_asymmetric_base_vs_tall_kneeling_symmetric_base','["base","support_height","lead_leg","lower_body_contribution","balance"]'::JSONB,'["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB),
      ('walking-knee-hug','walking-knee-hug-to-calf-raise','distinct_exercises','walking_knee_hug_cycle_vs_knee_hug_then_calf_raise_sequence','["added_action","plantar_flexion","balance","action_order","repetition_boundary"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/22889652/"]'::JSONB),
      ('wall-handstand-hold','wall-handstand-shoulder-shrug','distinct_exercises','inverted_static_line_hold_vs_dynamic_scapular_elevation_cycle','["scapular_motion","contraction_mode","repetition_unit","range","fatigue"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/32707142/"]'::JSONB),
      ('wall-handstand-push-up','wall-walk-handstand-line','distinct_exercises','inverted_vertical_press_repetitions_vs_floor_to_wall_climb_transition','["action_order","hand_contacts","foot_travel","elbow_motion","terminal_state"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/32707142/"]'::JSONB),
      ('zercher-carry','zercher-squat','distinct_exercises','loaded_gait_with_elbow_crook_support_vs_stationary_squat_cycle','["locomotion","hip_knee_range","distance","dose_unit","space"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/38665162/"]'::JSONB)
    ) AS boundaries(
      left_slug,
      right_slug,
      decision,
      identity_boundary,
      changed_or_missing_dimensions,
      research_sources
    )
  LOOP
    left_id := NULL;
    right_id := NULL;
    left_name := NULL;
    right_name := NULL;
    facility := NULL;

    SELECT id, display_name, facility_id
    INTO left_id, left_name, facility
    FROM coaching.exercise_definition_v1
    WHERE slug = boundary.left_slug
      AND facility_id = 1
      AND status <> 'archived';

    SELECT id, display_name
    INTO right_id, right_name
    FROM coaching.exercise_definition_v1
    WHERE slug = boundary.right_slug
      AND facility_id = facility
      AND status <> 'archived';

    IF left_id IS NULL OR right_id IS NULL THEN
      RAISE EXCEPTION
        '% requires active definitions % and %',
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
        '% conflicts with protected identity decision for % and %',
        migration_key,
        boundary.left_slug,
        boundary.right_slug;
    END IF;

    rationale_text := CASE
      WHEN boundary.decision = 'needs_human_review' THEN
        format(
          '%s and %s remain quarantined because the audited legacy cards do not declare: %s.',
          left_name,
          right_name,
          (
            SELECT string_agg(value, ', ')
            FROM jsonb_array_elements_text(
              boundary.changed_or_missing_dimensions
            ) value
          )
        )
      ELSE
        format(
          '%s and %s remain separate because their required movement contracts differ across: %s.',
          left_name,
          right_name,
          (
            SELECT string_agg(value, ', ')
            FROM jsonb_array_elements_text(
              boundary.changed_or_missing_dimensions
            ) value
          )
        )
    END;

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
    VALUES (
      facility,
      left_id,
      right_id,
      boundary.decision,
      rationale_text,
      jsonb_build_object(
        'identityBoundary', boundary.identity_boundary,
        'legacySourceCardsAudited', TRUE,
        'changedOrMissingDimensions',
          boundary.changed_or_missing_dimensions,
        'researchSources', boundary.research_sources,
        'missingIdentityFacts',
          boundary.decision = 'needs_human_review',
        'decisionScope',
          'identity_only_not_card_media_graph_calibration_or_publication_approval',
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
