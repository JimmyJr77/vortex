-- Adjudicate the final score-72 canonical identity queue.
--
-- Exercise identity is separated from athlete proficiency. Exercise cards use
-- exercise complexity and physical difficulty only. Missing movement-contract
-- facts remain explicitly quarantined for human review. No approval is created
-- for cards, media, relationships, calibration, or publication.
-- IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '395_coaching_score_72_identity_boundaries';
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
      ('dumbbell-incline-press','push-up','distinct_exercises','incline_bench_external_load_press_vs_closed_chain_bodyweight_press','["kinetic chain","support","load path","body orientation","failure response"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/36026487/"]'::JSONB),
      ('lateral-hop-to-stick','medial-lateral-ankle-hop-series','distinct_exercises','single_bilateral_lateral_jump_and_stick_vs_repeated_ankle_hop_series','["contact count","terminal hold","amplitude","knee strategy","repetition boundary"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB),
      ('landmine-press','one-arm-dumbbell-row','distinct_exercises','angled_press_vs_unilateral_pull','["force direction","elbow action","bar path","muscle action","terminal position"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/19620925/"]'::JSONB),
      ('landmine-romanian-deadlift-to-row','one-arm-dumbbell-row','distinct_exercises','compound_hip_hinge_then_row_vs_braced_row_without_required_hinge_cycle','["action order","hip motion","load path","hand count","repetition boundary"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/19620925/"]'::JSONB),
      ('pull-up-chin-up','push-up','distinct_exercises','vertical_pull_vs_horizontal_closed_chain_press','["force direction","elbow action","support","body orientation","primary muscles"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/38156065/"]'::JSONB),
      ('back-bridge','glute-bridge','distinct_exercises','full_spinal_shoulder_extension_bridge_vs_supine_hip_extension_bridge','["spinal extension","shoulder position","hand support","range","failure consequence"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/22889652/"]'::JSONB),
      ('one-arm-dumbbell-row','romanian-deadlift','distinct_exercises','braced_unilateral_upper_body_pull_vs_dynamic_loaded_hip_hinge','["elbow action","hip motion","load path","primary region","repetition boundary"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/19620925/"]'::JSONB),
      ('jumping-wall-ball-shot','standard-wall-ball-shot','distinct_exercises','wall_ball_cycle_with_required_takeoff_vs_ground_connected_wall_ball_cycle','["flight","takeoff","landing","impact","contact count"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB),
      ('landmine-ball-grip-rotational-press','one-arm-dumbbell-row','distinct_exercises','rotational_fixed_bar_press_vs_braced_unilateral_row','["force direction","rotation objective","elbow action","attachment","bar path"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/19620925/"]'::JSONB),
      ('landmine-row-with-hip-rotation','one-arm-dumbbell-row','distinct_exercises','deliberate_rotational_row_vs_braced_nonrotational_one_arm_row','["rotation objective","stance","bar path","trunk constraint","side dose"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/19620925/"]'::JSONB),
      ('one-arm-dumbbell-row','one-arm-landmine-z-press','distinct_exercises','braced_unilateral_pull_vs_floor_seated_angled_press','["force direction","elbow action","base","body orientation","bar path"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/19620925/"]'::JSONB),
      ('sandbag-get-up-strength','step-up','distinct_exercises','floor_or_kneeling_get_up_sequence_vs_platform_step_up','["start height","foot sequence","floor transition","platform","action order"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/22889652/"]'::JSONB),
      ('one-arm-dumbbell-row','one-arm-landmine-arc-press','distinct_exercises','unilateral_pull_vs_angled_arc_press','["force direction","elbow action","bar path","stance","terminal position"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/19620925/"]'::JSONB),
      ('landmine-rotation','one-arm-dumbbell-row','distinct_exercises','landmine_arc_rotation_vs_unilateral_row','["bar path","rotation","elbow action","force direction","hand count"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/19620925/"]'::JSONB),
      ('backpedal-turn-to-hop-and-go','partner-backpedal-turn-and-go-cue','distinct_exercises','backpedal_turn_hop_and_accelerate_sequence_vs_cued_turn_and_go_without_required_hop','["hop","stimulus","action order","contact count","repetition boundary"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/33098142/"]'::JSONB),
      ('band-external-rotation','eccentric-band-external-rotation','needs_human_review','eccentric_source_missing_elbow_position_and_rotation_plane','["eccentric source elbow position","shoulder-abduction angle","rotation plane","return assistance"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/38156065/"]'::JSONB),
      ('band-assisted-overspeed-jump','resisted-band-assisted-rebound-jump','needs_human_review','band_sources_missing_anchor_force_direction_and_rebound_contract','["band anchor","assistance versus resistance direction","contact count","rebound sequence","terminal landing"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/33359798/"]'::JSONB),
      ('beam-hop-to-stick','lateral-bound','distinct_exercises','narrow_beam_or_line_hop_and_balance_vs_open_lateral_projection','["support width","target","projection direction","distance","terminal balance"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB),
      ('atlas-stone-d-ball-bear-hug-carry-strength','sandbag-shoulder-carry-strength','distinct_exercises','anterior_bear_hug_carry_vs_asymmetric_shoulder_loaded_carry','["load position","load symmetry","arm position","trunk demand","side dose"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/38665162/"]'::JSONB),
      ('lateral-hop-to-stick','star-hop-to-stick','distinct_exercises','single_declared_lateral_jump_vs_multidirectional_star_target_hop','["target set","direction selection","route","contact sequence","error definition"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB),
      ('pause-bodyweight-squat','step-up','distinct_exercises','bilateral_squat_with_pause_vs_unilateral_platform_ascent','["stance","platform","laterality","foot sequence","side dose"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/30676181/"]'::JSONB),
      ('broad-jump-to-box-jump','depth-drop-to-box-jump','distinct_exercises','horizontal_jump_then_box_jump_vs_elevated_drop_then_box_jump','["entry action","flight origin","action order","contact count","impact"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/33359798/"]'::JSONB),
      ('broad-jump-to-vertical-pop','depth-jump','distinct_exercises','horizontal_jump_then_vertical_jump_vs_elevated_drop_then_rebound_jump','["entry action","flight origin","force sequence","impact","contact strategy"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/33359798/"]'::JSONB),
      ('cable-band-chop','tall-kneeling-overhead-medicine-ball-slam','distinct_exercises','anchored_diagonal_pull_vs_ballistic_overhead_to_floor_release','["object behavior","force direction","release","base","velocity"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB),
      ('clean-grip-deadlift','landmine-handle-grip-deadlift','needs_human_review','landmine_deadlift_source_missing_stance_handle_geometry_and_floor_start','["stance width","handle geometry","bar position","floor start","grip contract"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/30676181/"]'::JSONB),
      ('crossover-step-to-bound-and-stick','lateral-bound','distinct_exercises','crossover_entry_then_bound_vs_direct_lateral_bound','["entry footwork","action order","contact count","pelvic rotation","space"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB),
      ('depth-drop-to-lateral-rebound','depth-jump','distinct_exercises','lateral_rebound_after_drop_vs_vertical_rebound_after_drop','["projection direction","landing orientation","route","space","side dose"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/33359798/"]'::JSONB),
      ('drop-landing-to-lateral-stick','kick-to-landing-stick','distinct_exercises','imposed_drop_and_lateral_landing_vs_kick_then_landing','["entry action","limb swing","object interaction","flight origin","terminal stance"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB),
      ('drop-landing-to-lateral-stick','lateral-bound','distinct_exercises','elevated_drop_to_lateral_landing_vs_active_lateral_bound','["takeoff","flight origin","projection","impact","contact strategy"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB),
      ('drop-landing-to-lateral-stick','lateral-quick-step-to-stick','distinct_exercises','airborne_drop_landing_vs_grounded_lateral_step_and_brake','["flight","start height","contact sequence","impact","braking"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB),
      ('dumbbell-sumo-squat','single-leg-squat-to-box','distinct_exercises','wide_bilateral_loaded_squat_vs_unilateral_target_squat','["foot count","stance width","laterality","target","side dose"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/30676181/"]'::JSONB),
      ('dumbbell-windmill','romanian-deadlift','distinct_exercises','rotational_lateral_hip_hinge_with_overhead_load_vs_bilateral_sagittal_hinge','["plane","rotation","load position","stance","hand path"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/30676181/"]'::JSONB),
      ('medicine-ball-overhead-throw','tall-kneeling-overhead-wall-throw','distinct_exercises','standing_forward_overhead_throw_vs_tall_kneeling_wall_projection','["base","lower-body contribution","target","release angle","retrieval"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB),
      ('half-kneeling-medicine-ball-lift','half-kneeling-rotational-wall-throw','distinct_exercises','retained_diagonal_ball_lift_vs_ballistic_rotational_wall_release','["release","force direction","rotation","target","return contract"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB),
      ('half-kneeling-medicine-ball-lift','kneeling-medicine-ball-chest-pass','distinct_exercises','diagonal_retained_lift_vs_horizontal_chest_projection','["hand path","force direction","release","base symmetry","target"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB),
      ('half-kneeling-rotational-wall-throw','med-ball-slam-to-rotational-throw','distinct_exercises','single_half_kneeling_rotational_throw_vs_slam_then_rotational_throw_sequence','["base","preceding slam","action count","action order","contact sequence"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB),
      ('half-kneeling-t-spine-rotation-reach','landmine-press','distinct_exercises','unloaded_or_light_rotational_reach_vs_loaded_angled_press','["external load","force direction","rotation objective","elbow action","bar path"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/22889652/"]'::JSONB),
      ('hanging-leg-raise','tibialis-raise-eccentric-lower','distinct_exercises','suspended_trunk_hip_flexion_vs_grounded_ankle_dorsiflexion','["body region","support","joint actions","orientation","load path"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/38156065/"]'::JSONB),
      ('hop-to-hop-to-stick-linear','lateral-bound','distinct_exercises','two_linear_same_leg_projections_then_stick_vs_single_lateral_projection','["direction","contact count","projection count","terminal hold","side dose"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB),
      ('kneeling-medicine-ball-chest-pass','pallof-press-pallof-hold','distinct_exercises','free_ball_horizontal_release_vs_anchored_anti_rotation_press_or_hold','["object behavior","release","force vector","anti-rotation","return contract"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB),
      ('landmine-ball-grip-anti-rotation-hold','one-arm-dumbbell-row','distinct_exercises','isometric_anti_rotation_hold_vs_dynamic_unilateral_pull','["contraction mode","elbow action","force direction","rotation objective","dose unit"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/32707142/"]'::JSONB),
      ('landmine-ball-grip-rotational-press','wall-split-stance-rotation-reach','distinct_exercises','loaded_fixed_bar_rotational_press_vs_wall_supported_rotation_reach','["external load","force direction","bar path","wall support","elbow action"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/19620925/"]'::JSONB),
      ('landmine-handle-grip-deadlift','romanian-deadlift','distinct_exercises','floor_start_landmine_pull_vs_top_down_romanian_hinge','["start height","floor contact","bar path","knee flexion","reset"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/30676181/"]'::JSONB),
      ('landmine-press','landmine-row-with-hip-rotation','distinct_exercises','angled_press_vs_rotational_pull','["force direction","elbow action","rotation objective","bar path","terminal position"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/19620925/"]'::JSONB),
      ('landmine-press','tall-kneeling-one-arm-landmine-press','needs_human_review','generic_landmine_press_missing_hand_count_and_base_exclusion_for_tall_kneeling','["generic card hand count","generic card base","whether tall-kneeling is included","laterality"]'::JSONB,'["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB),
      ('landmine-romanian-deadlift-to-row','sumo-deadlift','distinct_exercises','hinge_then_row_compound_sequence_vs_floor_deadlift_only','["added row","action order","elbow action","stance","repetition boundary"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/30676181/"]'::JSONB),
      ('landmine-squat-to-press','square-stance-one-arm-landmine-press','distinct_exercises','squat_then_press_sequence_vs_press_without_required_squat','["squat","action order","lower-body range","momentum","repetition boundary"]'::JSONB,'["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB),
      ('lateral-ape-walk','pallof-press-step-out','distinct_exercises','quadrupedal_lateral_locomotion_vs_upright_anchored_anti_rotation_step','["orientation","support contacts","locomotion","implement","force direction"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/32707142/"]'::JSONB),
      ('lateral-bound','tuck-jump-to-lateral-stick','distinct_exercises','direct_lateral_projection_vs_vertical_tuck_then_lateral_landing','["airborne action","projection sequence","hip flexion","landing direction","contact count"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB),
      ('lateral-bound-to-rotational-throw','med-ball-slam-to-rotational-throw','distinct_exercises','lateral_bound_then_throw_vs_slam_then_rotational_throw','["first action","action order","contact count","object interaction","space"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB),
      ('lateral-one-in-shuffle','lateral-shuffle-decel-stick','distinct_exercises','ladder_one_in_contact_pattern_vs_open_shuffle_then_brake','["equipment","foot pattern","target spacing","terminal stop","measurement"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/33098142/"]'::JSONB),
      ('lateral-shuffle-to-wall-ball-shot','lateral-two-in-shuffle','distinct_exercises','shuffle_then_ball_squat_throw_sequence_vs_ladder_footwork_only','["object interaction","release","added squat","equipment","terminal action"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB),
      ('low-hurdle-hop-to-stick','reactive-cone-call-hop-to-stick','distinct_exercises','preplanned_obstacle_hop_vs_live_cue_selected_hop_target','["stimulus","decision branch","obstacle","target selection","anticipation"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/33098142/"]'::JSONB),
      ('low-hurdle-hop-to-stick','single-leg-hop-to-stick','needs_human_review','low_hurdle_source_missing_takeoff_and_landing_foot_count','["takeoff foot count","landing foot count","hurdle direction","projection distance","side-dose contract"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB),
      ('med-ball-slam-reset-hiit-fitness','med-ball-squat-press-hiit-fitness','distinct_exercises','overhead_to_floor_slam_vs_squat_to_overhead_press','["force direction","squat","release target","action order","return contract"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB),
      ('med-ball-slam-to-rotational-throw','medicine-ball-rotational-toss-to-lateral-bound','distinct_exercises','slam_then_rotational_throw_vs_rotational_toss_then_lateral_bound','["action order","first action","terminal action","contact sequence","space"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB),
      ('medicine-ball-catch-to-absorb-hold','medicine-ball-catch-to-low-hop-and-stick','distinct_exercises','terminal_catch_and_isometric_absorption_vs_catch_then_active_hop','["added hop","takeoff","flight","action order","terminal state"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB),
      ('medicine-ball-catch-to-decel-stick','medicine-ball-over-shoulder-track-and-catch','distinct_exercises','front_or_declared_incoming_catch_and_brake_vs_over_shoulder_visual_tracking_catch','["incoming trajectory","visual field","body orientation","travel","catch timing"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB),
      ('medicine-ball-chest-pass','medicine-ball-squat-clean-to-wall-ball-shot','distinct_exercises','single_horizontal_chest_projection_vs_floor_clean_squat_and_wall_shot_sequence','["pickup","clean","squat","target","action count"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB),
      ('medicine-ball-rotational-throw','split-stance-anti-rotation-row','distinct_exercises','free_ball_rotational_release_vs_anchored_pull_resisting_rotation','["object behavior","force direction","release","rotation objective","elbow action"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB),
      ('mirror-balance-reach','y-balance-reach-star-reach','distinct_exercises','live_visual_mirroring_reach_vs_preassigned_y_or_star_target_sequence','["stimulus","decision branch","target sequence","anticipation","success metric"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/30366506/"]'::JSONB),
      ('one-arm-landmine-floor-press','split-stance-one-arm-landmine-press','distinct_exercises','supine_floor_press_vs_upright_split_stance_angled_press','["body orientation","base","shoulder range","lower-body support","bar path"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/23096062/"]'::JSONB),
      ('overhead-dumbbell-hold','seated-barbell-overhead-press','distinct_exercises','overhead_isometric_support_vs_dynamic_seated_vertical_press','["contraction mode","elbow motion","implement","base","dose unit"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/23096062/"]'::JSONB),
      ('pallof-press-pallof-hold','partner-band-waist-tug-hold','distinct_exercises','hand_driven_anchored_press_or_hold_vs_waist_applied_partner_perturbation','["force interface","hand action","partner","perturbation timing","failure response"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/30366506/"]'::JSONB),
      ('partner-hollow-body-med-ball-exchange','partner-trunk-twist-medicine-ball-exchange','distinct_exercises','supine_hollow_body_exchange_vs_upright_or_declared_trunk_rotation_exchange','["body orientation","trunk action","ball path","support","side dose"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/32707142/"]'::JSONB),
      ('pike-push-up','wall-handstand-push-up','distinct_exercises','feet_supported_pike_press_vs_fully_inverted_wall_vertical_press','["body angle","foot height","load distribution","range","spotting"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/38156065/"]'::JSONB),
      ('pin-squat','pistol-squat','distinct_exercises','bilateral_barbell_squat_from_pins_vs_unilateral_bodyweight_squat','["foot count","implement","start support","laterality","side dose"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/30676181/"]'::JSONB),
      ('pull-up-chin-up','scapular-pull-up','distinct_exercises','full_vertical_pull_with_elbow_flexion_vs_straight_arm_scapular_motion','["elbow action","range","scapular motion","repetition boundary","load"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/38156065/"]'::JSONB),
      ('quadruped-scapular-clock','scapular-push-up','distinct_exercises','multidirectional_scapular_target_clock_vs_protraction_retraction_cycle','["direction set","target sequence","scapular path","error definition","repetition boundary"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/32707142/"]'::JSONB),
      ('reactive-med-ball-target-pass','reactive-med-ball-toss-and-relocate','distinct_exercises','live_target_selected_pass_vs_throw_then_relocate_and_receive_sequence','["locomotion","action order","catch","target selection","terminal state"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB),
      ('romanian-deadlift','split-squat','distinct_exercises','bilateral_hip_hinge_vs_stationary_staggered_squat','["movement pattern","stance","knee range","load path","side dose"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/30676181/"]'::JSONB),
      ('single-leg-hop-stick-plus-catch','single-leg-rdl-reach-plus-catch','distinct_exercises','airborne_hop_then_catch_vs_grounded_hip_hinge_reach_and_catch','["flight","hinge","takeoff","trail-leg path","catch timing"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/30366506/"]'::JSONB),
      ('single-leg-hop-to-stick','star-hop-to-stick','distinct_exercises','single_declared_projection_vs_multidirectional_star_target_sequence','["target set","route","direction selection","contact count","error definition"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB),
      ('single-leg-pogo-hold-stick','single-leg-triple-hop-to-stick','distinct_exercises','repeated_low_amplitude_vertical_contacts_then_hold_vs_three_horizontal_projections','["amplitude","direction","contact count","distance","repetition boundary"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB),
      ('spanish-squat-hold','split-squat-isometric-hold','distinct_exercises','bilateral_band_supported_squat_isometric_vs_staggered_split_squat_isometric','["stance","laterality","external support","load direction","side dose"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/38156065/"]'::JSONB),
      ('split-squat-jump-to-stick','tuck-jump','distinct_exercises','split_stance_jump_and_declared_stick_vs_bilateral_vertical_jump_with_knee_tuck','["stance","laterality","airborne action","landing contract","side dose"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB),
      ('square-stance-one-arm-landmine-press','tall-kneeling-one-arm-landmine-press','distinct_exercises','square_upright_bilateral_base_vs_tall_kneeling_symmetric_base','["base","support height","lower-body contribution","balance","failure response"]'::JSONB,'["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB),
      ('distance-jump-standing-calf-raise','soleus-isometric-hold-bent-knee','distinct_exercises','straight_knee_dynamic_calf_raise_vs_bent_knee_isometric_soleus_hold','["knee angle","contraction mode","range","dose unit","muscle bias"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/38156065/"]'::JSONB),
      ('standing-calf-raise-eccentric-lower','tibialis-raise-eccentric-lower','distinct_exercises','plantar_flexor_eccentric_lower_vs_dorsiflexor_eccentric_lower','["joint action","muscle group","force direction","foot contact","range"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/38156065/"]'::JSONB),
      ('strict-overhead-press','tall-kneeling-sandbag-overhead-press-strength','distinct_exercises','standing_barbell_strict_press_vs_tall_kneeling_sandbag_press','["base","implement","load stability","lower-body contribution","setup"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/23096062/"]'::JSONB),
      ('tall-kneeling-overhead-wall-throw','tall-kneeling-sandbag-overhead-press-strength','distinct_exercises','ballistic_wall_release_vs_retained_loaded_overhead_press','["release","target","velocity","return contract","load ceiling"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB),
      ('standard-wall-ball-shot','wall-ball-target-tap','distinct_exercises','full_squat_throw_catch_cycle_vs_nonballistic_target_rehearsal','["squat","release","catch","ball flight","repetition boundary"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB),
      ('color-call-tennis-ball-catch-on-single-leg-balance','single-leg-med-ball-catch','distinct_exercises','late_color_decision_catch_vs_predeclared_loaded_ball_catch','["live stimulus","decision branch","object mass","catch mechanics","anticipation policy"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/30366506/"]'::JSONB),
      ('2-point-acceleration-start','random-gate-acceleration','distinct_exercises','preplanned_two_point_start_vs_live_cue_selected_acceleration','["stimulus","decision branch","start stance","target count","anticipation policy"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/33098142/"]'::JSONB),
      ('random-gate-acceleration','three-point-start-acceleration','distinct_exercises','live_cue_selected_acceleration_vs_preplanned_three_point_start','["stimulus","decision branch","start support","target count","anticipation policy"]'::JSONB,'["https://pubmed.ncbi.nlm.nih.gov/33098142/"]'::JSONB)
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
