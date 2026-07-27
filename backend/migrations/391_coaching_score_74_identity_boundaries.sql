-- Adjudicate mechanically distinct and source-ambiguous pairs in the score-74
-- canonical identity queue after the score-75 pass.
--
-- Identity decisions do not approve cards, media, relationships, calibration,
-- or publication. Exercise cards use exercise complexity and physical
-- difficulty only; skill/proficiency levels belong only to coaching.skill.
-- IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '391_coaching_score_74_identity_boundaries';
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
        '9090-breathing-with-reach',
        '9090-hip-switch',
        'distinct_exercises',
        'supine_wall_supported_breathing_reset_vs_seated_dynamic_hip_rotation',
        '90/90 Breathing with Reach is a supine wall- or box-supported respiratory reset with no required hip rotation. 90/90 Hip Switch is a seated dynamic internal/external hip-rotation task. Orientation, support, visible motion, joints, breathing contract, range, repetition boundary, and stop rules differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/22889652/"]'::JSONB
      ),
      (
        'ankle-pogo-in-place',
        'single-leg-pogo',
        'distinct_exercises',
        'bilateral_stationary_ankle_pogo_vs_unilateral_repeated_pogo',
        'Ankle Pogo in Place uses simultaneous bilateral takeoff and landing contacts. Single-Leg Pogo repeats contacts on one declared leg. Support-foot count, laterality, balance, pelvis control, impact distribution, side dosage, failure response, and progression requirements differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/17544325/","https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB
      ),
      (
        'back-squat',
        'cossack-squat',
        'distinct_exercises',
        'posterior_loaded_bilateral_sagittal_squat_vs_frontal_shift_to_one_leg',
        'Back Squat uses a bilateral stance and posterior shoulder-supported load while both legs share the squat cycle. Cossack Squat shifts laterally onto one bent leg as the other leg lengthens. Plane, stance, laterality, load position, trail-leg role, balance, range, and spotting differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/30676181/","https://pubmed.ncbi.nlm.nih.gov/22889652/"]'::JSONB
      ),
      (
        'backpedal-to-stick',
        'medicine-ball-catch-to-decel-stick',
        'distinct_exercises',
        'backward_locomotion_to_terminal_braking_vs_incoming_object_catch_and_braking',
        'Backpedal-to-Stick travels backward before a controlled terminal stop. Medicine Ball Catch-to-Decel Stick receives an incoming external load while the athlete absorbs and stops. Object interaction, incoming momentum, hand action, locomotion, partner contract, load, action order, and failure consequences differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/33217086/","https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'barbell-walking-lunge',
        'lateral-lunge',
        'distinct_exercises',
        'loaded_forward_traveling_lunge_sequence_vs_frontal_step_and_return',
        'Barbell Walking Lunge advances through repeated forward split-stance contacts with a posterior shoulder load. Lateral Lunge steps or shifts into the frontal plane and returns from the same side. Travel direction, plane, foot sequence, stance, load position, adductor role, space, and side dosage differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/22889652/"]'::JSONB
      ),
      (
        'beam-hop-to-stick',
        'hop-to-hop-to-stick-linear',
        'distinct_exercises',
        'single_low_beam_or_line_hop_and_balance_vs_two_linear_same_leg_hops',
        'Beam Hop to Stick requires one small hop on or to a narrow beam or line and a balance hold. Hop-to-Hop-to-Stick Linear requires two declared same-leg projections before the terminal landing. Support width, equipment, contact count, projection distance, balance, impact, space, and repetition boundary differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB
      ),
      (
        'bear-plank-shoulder-tap',
        'partner-shoulder-bump-balance',
        'distinct_exercises',
        'quadruped_hand_support_tap_with_anti_rotation_vs_upright_partner_perturbation',
        'Bear Plank Shoulder Tap uses hands and feet in a quadruped hover while one hand leaves support and the trunk resists rotation. Partner Shoulder Bump Balance is an upright stance exposed to external perturbations. Orientation, support contacts, moving limb, partner input, balance strategy, load, and safe stop differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/32707142/","https://pubmed.ncbi.nlm.nih.gov/30366506/"]'::JSONB
      ),
      (
        'atlas-stone-d-ball-bear-hug-carry-strength',
        'zercher-carry',
        'distinct_exercises',
        'anterior_trunk_bear_hug_support_vs_load_supported_in_elbow_crooks',
        'Bear-Hug Carry secures the implement against the anterior trunk with the arms wrapped around it. Zercher Carry supports the load in both elbow crooks. Load-support geometry, pressure interface, arm position, grip assistance, breathing constraint, pickup, set-down, and failure response differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/38665162/"]'::JSONB
      ),
      (
        'barbell-bench-press',
        'dumbbell-kettlebell-floor-press',
        'distinct_exercises',
        'bench_supported_press_with_free_humeral_extension_vs_floor_limited_press',
        'Bench Press lies on a bench and permits the upper arm to travel below the torso as declared. Floor Press is supported on the floor and ends the eccentric when the upper arm contacts it. Support height, shoulder-extension range, setup, leg drive, spotting, load ceiling, and safe failure differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/23096062/"]'::JSONB
      ),
      (
        'box-jump',
        'pogo-to-box-jump',
        'distinct_exercises',
        'direct_floor_takeoff_to_box_vs_repeated_ankle_contact_entry_then_box_jump',
        'Box Jump begins from its declared stationary floor stance and jumps directly to the box. Pogo to Box Jump requires one or more elastic ankle contacts before the box takeoff. Entry contacts, action order, elastic strategy, timing, impact exposure, technical demand, and repetition boundary differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/17620779/","https://pubmed.ncbi.nlm.nih.gov/33359798/"]'::JSONB
      ),
      (
        'box-jump',
        'seated-box-jump',
        'distinct_exercises',
        'standing_floor_takeoff_with_declared_countermovement_vs_seated_static_start',
        'Box Jump begins standing and may use a declared countermovement or pause. Seated Box Jump begins supported on a bench or box and removes the normal standing eccentric entry before takeoff. Initial support, hip and knee position, countermovement, force-time strategy, setup, load, and failure response differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/33359798/"]'::JSONB
      ),
      (
        'build-up-sprint-stride-out',
        'curve-sprint-build-up',
        'distinct_exercises',
        'straight_progressive_speed_exposure_vs_progressive_speed_on_curved_route',
        'Build-Up Sprint / Stride-Out progresses speed along a straight lane. Curve Sprint Build-Up follows a declared curved path. Route geometry, inside/outside leg demand, trunk lean, force direction, visual reference, lane setup, measurement, and safe deceleration differ.',
        '["https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/"]'::JSONB
      ),
      (
        'commanded-pro-agility-shuttle',
        'pro-agility-5-10-5',
        'distinct_exercises',
        'live_command_selected_shuttle_response_vs_preplanned_5_10_5_route',
        'Commanded Pro Agility Shuttle requires the athlete to wait for and act on a live directional command. Pro Agility 5-10-5 follows a known first direction and fixed route. Stimulus, decision branch, anticipation policy, cue timing, first movement, measurement, coaching, and failure state differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/33098142/","https://pubmed.ncbi.nlm.nih.gov/33217086/"]'::JSONB
      ),
      (
        'cone-lateral-shuffle-hiit-fitness',
        'icky-shuffle',
        'distinct_exercises',
        'open_lateral_shuffle_between_cones_vs_ladder_specific_icky_contact_sequence',
        'Cone Lateral Shuffle travels between open cone targets for timed work. Icky Shuffle follows a ladder route with a specific in-in-out contact pattern. Equipment, route, foot contacts, cadence, lead/trail exchange, terminal action, conditioning intent, and error definition differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/24290613/","https://pubmed.ncbi.nlm.nih.gov/33217086/"]'::JSONB
      ),
      (
        'cossack-squat',
        'front-squat',
        'distinct_exercises',
        'frontal_shift_to_one_bent_leg_vs_bilateral_anterior_loaded_squat',
        'Cossack Squat shifts laterally onto one leg while the trail leg lengthens. Front Squat remains bilateral and supports load anteriorly while both knees and hips complete the squat cycle. Plane, laterality, stance, trail-leg role, load position, balance, side dosage, and spotting differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/22889652/","https://pubmed.ncbi.nlm.nih.gov/30676181/"]'::JSONB
      ),
      (
        'cossack-squat',
        'split-squat',
        'distinct_exercises',
        'frontal_lateral_shift_with_lengthened_trail_leg_vs_sagittal_stationary_split_stance',
        'Cossack Squat moves in the frontal plane onto one bent leg while the other leg lengthens. Split Squat fixes a sagittal staggered stance with the rear forefoot supporting repeated vertical descent and ascent. Plane, stance, foot orientation, trail-leg action, balance, range, and side dose differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/22889652/"]'::JSONB
      ),
      (
        'countermovement-medicine-ball-scoop-toss',
        'medicine-ball-rotational-throw',
        'distinct_exercises',
        'sagittal_countermovement_scoop_projection_vs_transverse_rotational_projection',
        'Countermovement Medicine Ball Scoop Toss loads through a sagittal countermovement and projects the ball on a scoop path. Medicine Ball Rotational Throw deliberately turns through the hips and trunk to project transversely. Plane, force direction, foot action, release path, target, retrieval, and side dosage differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'crossover-icky-shuffle',
        'icky-shuffle',
        'distinct_exercises',
        'crossover_ladder_contact_pattern_vs_non_crossover_icky_pattern',
        'Crossover Icky Shuffle crosses one leg over or behind during its ladder sequence. Icky Shuffle uses its declared in-in-out contacts without the same crossover. Ordered contacts, hip rotation, foot placement, lead/trail timing, balance, cadence, and error definition differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/33217086/"]'::JSONB
      ),
      (
        'dumbbell-rear-delt-row',
        'dumbbell-renegade-row',
        'distinct_exercises',
        'hinged_rear_delt_biased_row_vs_high_plank_row_with_anti_rotation',
        'Dumbbell Rear-Delt Row uses a hinged or supported base and a flared elbow path to bias the posterior shoulder. Renegade Row holds a high plank while one arm rows and the trunk resists rotation. Support, body orientation, elbow path, kinetic chain, trunk demand, load tolerance, and safe failure differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/19620925/","https://pubmed.ncbi.nlm.nih.gov/32707142/"]'::JSONB
      ),
      (
        'dumbbell-reverse-curl',
        'reverse-nordic-curl',
        'distinct_exercises',
        'pronated_grip_elbow_flexion_vs_kneeling_knee_extensor_eccentric_body_lowering',
        'Dumbbell Reverse Curl flexes the elbows with a pronated grip while the torso remains upright. Reverse Nordic Curl lowers the trunk and thighs from kneeling through knee extension/flexion control. Body region, joints, orientation, support, load path, muscles, range, and failure consequence differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/19620925/","https://pubmed.ncbi.nlm.nih.gov/38156065/"]'::JSONB
      ),
      (
        'dumbbell-windmill',
        'kettlebell-swing',
        'distinct_exercises',
        'slow_loaded_frontal_transverse_hip_hinge_with_overhead_arm_vs_ballistic_sagittal_swing',
        'Dumbbell Windmill uses a slow asymmetrical hinge with trunk rotation or lateral flexion and a vertically organized arm. Kettlebell Swing uses a ballistic sagittal hip hinge to project the implement forward. Velocity, plane, arm position, load path, stance, range, fatigue, and failure response differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/24978835/"]'::JSONB
      ),
      (
        'forward-roll-to-stand',
        'rock-and-roll-to-stand',
        'distinct_exercises',
        'forward_inversion_over_shoulders_with_hand_support_vs_supine_rocking_transition',
        'Forward Roll to Stand passes the body over the shoulders and may use hand contact while the head remains protected. Rock-and-Roll to Stand rocks along the back from a supine tuck without the same forward inversion. Entry, support contacts, head/neck demand, action order, momentum, prerequisite, and failure consequence differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB
      ),
      (
        'front-squat',
        'landmine-front-squat',
        'distinct_exercises',
        'free_anterior_rack_squat_vs_fixed_angled_landmine_bar_path',
        'Front Squat supports a free barbell, dumbbell, kettlebell, or goblet load anteriorly. Landmine Front Squat follows a fixed anchored bar-end arc. Implement geometry, anchor, force direction, load path, grip, stance relative to the pivot, setup, and safe failure differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/30676181/","https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB
      ),
      (
        'front-rack-carry',
        'front-squat',
        'distinct_exercises',
        'front_rack_loaded_gait_vs_stationary_front_loaded_squat',
        'Front-Rack Carry walks with the load supported at the shoulders and is dosed by distance or time. Front Squat remains stationary and repeatedly descends and stands. Locomotion, joint excursion, route, repetition boundary, balance, dose, fatigue exposure, and stop rules differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/38665162/","https://pubmed.ncbi.nlm.nih.gov/30676181/"]'::JSONB
      ),
      (
        'half-kneeling-landmine-anti-rotation-press',
        'landmine-rotational-press',
        'distinct_exercises',
        'half_kneeling_anti_rotation_press_out_vs_deliberate_whole_body_rotational_press',
        'Half-Kneeling Landmine Anti-Rotation Press resists pelvis and trunk rotation from a kneeling base. Landmine Rotational Press deliberately turns through the feet, hips, and trunk. Base, rotation objective, foot action, force transfer, plane, load tolerance, side dosage, and error state differ.',
        '["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB
      ),
      (
        'half-kneeling-one-arm-landmine-press',
        'one-arm-landmine-push-press',
        'distinct_exercises',
        'fixed_half_kneeling_strict_press_vs_standing_dip_drive_press',
        'Half-Kneeling One-Arm Landmine Press uses a fixed kneeling base and no required leg drive. One-Arm Landmine Push Press begins standing and uses a dip and forceful lower-body drive. Base, action order, lower-body impulse, velocity, load ceiling, fatigue, side dosage, and failure response differ.',
        '["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB
      ),
      (
        'heavy-sled-backward-drag-strength',
        'heavy-sled-forward-harness-drag-strength',
        'distinct_exercises',
        'backward_sled_drag_with_retrograde_steps_vs_forward_harness_locmotion',
        'Heavy Sled Backward Drag faces the sled and travels backward through retrograde contacts. Heavy Sled Forward Harness Drag faces away and walks or drives forward through a harness. Body orientation, travel direction, attachment, joint contribution, visual field, gait contacts, setup, and stop rules differ.',
        '["https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/"]'::JSONB
      ),
      (
        'hop-to-hop-to-stick-linear',
        'partner-point-hop-to-stick',
        'distinct_exercises',
        'preplanned_two_hop_linear_sequence_vs_live_partner_selected_single_hop_direction',
        'Hop-to-Hop-to-Stick Linear performs two declared same-leg projections along a known line. Partner Point Hop-to-Stick waits for a live directional cue and selects the hop response. Contact count, stimulus, decision branch, direction, anticipation policy, cue timing, and repetition boundary differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB
      ),
      (
        'kick-to-landing-stick',
        'single-leg-landing-stick',
        'distinct_exercises',
        'kick_action_then_unilateral_landing_vs_generic_unilateral_landing_contract',
        'Kick-to-Landing Stick includes a declared kick before the athlete receives and owns the landing. Single-Leg Landing Stick contains no required kicking action. Ordered actions, moving limb, visual focus, trunk and pelvis strategy, entry condition, sport context, and repetition boundary differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB
      ),
      (
        'landmine-handle-grip-deadlift',
        'landmine-split-squat',
        'distinct_exercises',
        'floor_origin_bilateral_hinge_pull_vs_stationary_split_stance_squat',
        'Landmine Handle-Grip Deadlift begins with the load near the floor and stands through a hinge. Landmine Split Squat fixes an asymmetrical stance and repeatedly lowers and rises without returning the load to the floor each repetition. Start, stance, laterality, joint contribution, repetition boundary, load path, and side dose differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/24978835/","https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB
      ),
      (
        'one-arm-landmine-push-press',
        'tall-kneeling-one-arm-landmine-press',
        'distinct_exercises',
        'standing_dip_drive_push_press_vs_tall_kneeling_strict_press',
        'One-Arm Landmine Push Press stands and uses a dip-drive to accelerate the bar. Tall-Kneeling One-Arm Landmine Press fixes both knees down and presses strictly. Base, lower-body action, momentum, velocity, load tolerance, trunk demand, side dosage, and safe failure differ.',
        '["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB
      ),
      (
        'landmine-squat-to-press',
        'two-hand-landmine-press',
        'distinct_exercises',
        'squat_then_angled_press_sequence_vs_angled_press_without_required_squat',
        'Landmine Squat-to-Press descends through a squat and uses the stand to transition into the press. Two-Hand Landmine Press begins from its declared standing or kneeling base without a required squat. Ordered actions, lower-body range, momentum, load, velocity, fatigue, and repetition boundary differ.',
        '["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB
      ),
      (
        'lateral-box-jump',
        'lateral-hurdle-hop-to-box-jump',
        'distinct_exercises',
        'direct_lateral_floor_to_box_jump_vs_hurdle_contact_sequence_then_box_jump',
        'Lateral Box Jump projects directly from the floor to the box. Lateral Hurdle Hop to Box Jump first negotiates a hurdle and then completes the box jump. Obstacle sequence, contact count, action order, approach space, impact exposure, timing, equipment, and failure consequence differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/17544325/","https://pubmed.ncbi.nlm.nih.gov/33359798/"]'::JSONB
      ),
      (
        'lateral-line-pogo',
        'line-hops',
        'needs_human_review',
        'line_hops_source_does_not_declare_direction_foot_count_or_pogo_contact_contract',
        'Lateral Line Pogo declares repeated frontal-plane elastic contacts. The Line Hops source does not declare whether travel is lateral or forward-back, whether contacts are bilateral or unilateral, or whether the knee and contact-time strategy is pogo-like. Those facts are required before identity consolidation.',
        '["https://pubmed.ncbi.nlm.nih.gov/17544325/"]'::JSONB
      ),
      (
        'lateral-quick-step-to-stick',
        'lateral-shuffle-decel-stick',
        'distinct_exercises',
        'single_lateral_quick_step_and_brake_vs_repeated_shuffle_contacts_then_brake',
        'Lateral Quick Step to Stick uses one declared lateral step before the braking hold. Lateral Shuffle Decel Stick uses repeated shuffle contacts over distance before stopping. Contact count, gait pattern, lead/trail action, distance, speed, braking demand, dose, and repetition boundary differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/33217086/"]'::JSONB
      ),
      (
        'lateral-shuffle-decel-stick',
        'single-leg-lateral-hop-to-stick',
        'distinct_exercises',
        'grounded_repeated_shuffle_contacts_vs_airborne_same_leg_lateral_projection',
        'Lateral Shuffle Decel Stick stays grounded through repeated shuffle contacts before braking. Single-Leg Lateral Hop to Stick has an airborne projection from and to one leg. Flight, support-foot count, contact sequence, locomotion, impact, balance, side dosage, and failure response differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/33217086/","https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB
      ),
      (
        'line-pogo-hops',
        'single-leg-pogo',
        'distinct_exercises',
        'declared_two_foot_line_pogo_contacts_vs_unilateral_repeated_pogo',
        'Line Pogo Hops declares two-foot elastic contacts around a line. Single-Leg Pogo repeats contacts on one declared leg. Support-foot count, laterality, pelvis demand, balance, direction variants, impact distribution, side dosage, and progression requirements differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/17544325/","https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB
      ),
      (
        'low-box-jump-to-stick',
        'tuck-jump',
        'distinct_exercises',
        'floor_to_low_box_landing_and_hold_vs_vertical_jump_with_airborne_knee_tuck',
        'Low Box Jump to Stick lands on an elevated target and owns the box landing. Tuck Jump remains floor-to-floor and brings the knees toward the trunk during flight. Target, landing height, flight action, range, equipment, impact, space, and safe failure differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/33359798/","https://pubmed.ncbi.nlm.nih.gov/17544325/"]'::JSONB
      ),
      (
        'medicine-ball-chest-pass',
        'medicine-ball-overhead-throw',
        'distinct_exercises',
        'horizontal_chest_projection_vs_forward_overhead_projection',
        'Medicine Ball Chest Pass projects horizontally from chest level through shoulder horizontal adduction and elbow extension. Forward Overhead Throw moves the ball from overhead through a different release path. Start, force direction, shoulder action, release angle, visual field, target, and return contract differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'medicine-ball-chest-pass',
        'reactive-med-ball-target-pass',
        'distinct_exercises',
        'preselected_chest_projection_vs_live_cue_selected_target_pass',
        'Medicine Ball Chest Pass uses a declared partner or wall target. Reactive Med Ball Target Pass waits for a live cue and selects among targets before releasing. Stimulus, decision branch, anticipation policy, target count, cue timing, accuracy demand, reset, and failure state differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'medicine-ball-pivot-catch-and-pass',
        'medicine-ball-rainbow-catch-to-pivot',
        'distinct_exercises',
        'incoming_catch_then_pivot_and_pass_vs_rainbow_trajectory_catch_then_pivot_finish',
        'Pivot Catch-and-Pass receives the ball, establishes a pivot, reorients, and passes. Rainbow Catch to Pivot receives a declared high arcing trajectory and finishes through the pivot without a required outgoing pass. Incoming trajectory, action order, release, partner contract, terminal state, and repetition boundary differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'medicine-ball-scoop-toss',
        'medicine-ball-side-toss-with-step',
        'distinct_exercises',
        'sagittal_underhand_scoop_projection_vs_lateral_step_and_rotational_side_projection',
        'Medicine Ball Scoop Toss projects on an underhand sagittal path from its declared base. Side Toss with Step adds a lateral step and rotational side projection. Plane, foot contacts, action order, release path, force direction, space, side dosage, and failure state differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'med-ball-squat-press-hiit-fitness',
        'medicine-ball-squat-clean-to-wall-ball-shot',
        'distinct_exercises',
        'squat_to_overhead_press_vs_floor_clean_squat_and_wall_target_release',
        'Medicine Ball Squat to Press begins with the ball supported and finishes with an overhead press. Squat Clean to Wall Ball Shot starts from the floor, cleans the ball, squats, releases to a wall target, and receives or retrieves it. Pickup, ordered actions, release, target, catch, repetition boundary, and fatigue differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'one-arm-landmine-arc-press',
        'one-arm-landmine-row',
        'distinct_exercises',
        'unilateral_angled_press_with_elbow_extension_vs_hinged_unilateral_pull',
        'One-Arm Landmine Arc Press moves the bar away through a pressing path and elbow extension. One-Arm Landmine Row holds a hinge and pulls the bar toward the trunk through elbow flexion. Force direction, elbow action, base, load path, muscles, range, and safe failure differ.',
        '["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB
      ),
      (
        'reactive-5-10-5-catch-finish',
        'reactive-5-10-5-finish-on-signal',
        'distinct_exercises',
        'reactive_shuttle_with_terminal_object_catch_vs_signal_selected_finish_gate',
        'Reactive 5-10-5 Catch Finish ends by receiving an incoming object while braking. Finish on Signal selects a terminal direction or gate from the live cue without a required catch. Object interaction, hand action, stimulus mapping, terminal task, partner contract, failure consequence, and reset differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/33098142/","https://pubmed.ncbi.nlm.nih.gov/33217086/"]'::JSONB
      ),
      (
        'repeated-vertical-jump',
        'repeat-vertical-jump-tall-posture',
        'distinct_exercises',
        'repeated_full_vertical_jumps_vs_low_amplitude_stiff_tall_posture_rebounds',
        'Repeated Vertical Jump uses repeated full vertical projections with a declared countermovement and quiet landing. Tall-Posture Repeats deliberately limit knee bend to train elastic stiffness. Amplitude, knee strategy, force-time profile, contact time, jump height, impact, intent, and stop rules differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/17544325/","https://pubmed.ncbi.nlm.nih.gov/17620779/"]'::JSONB
      ),
      (
        'rope-climb-foot-lock-pull-towel-pull',
        'rope-climb-with-foot-lock-strength',
        'needs_human_review',
        'combined_rope_and_towel_source_does_not_declare_one_repetition_contract',
        'Rope Climb with Foot Lock declares a coordinated vertical climb. The combined Rope Climb Foot-Lock Pull / Towel Pull source permits rope or towel, full or low pulls, and optional foot lock without declaring which combinations are one exercise versus separate grip and range variants. Exact support, ascent, return, and repetition facts are required.',
        '[]'::JSONB
      ),
      (
        'side-stance-wall-ball-shot',
        'standard-wall-ball-shot',
        'distinct_exercises',
        'side_on_rotational_entry_to_wall_shot_vs_square_sagittal_wall_ball_cycle',
        'Side-Stance Wall Ball Shot begins side-on and rotates to square during the throw. Standard Wall Ball Shot uses a square stance and sagittal squat-to-target cycle. Start orientation, plane, foot action, trunk rotation, load transfer, target alignment, side dosage, and error state differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'single-leg-hop-to-stick',
        'single-leg-landing-stick',
        'needs_human_review',
        'generic_single_leg_landing_source_does_not_declare_entry_against_forward_hop',
        'Single-Leg Hop to Stick declares a unilateral takeoff, flight, and terminal landing. Single-Leg Landing Stick declares alignment at landing but not whether the athlete steps, drops, jumps, hops, or receives a perturbation. Entry, takeoff, and projection direction are required before consolidation.',
        '["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB
      ),
      (
        'single-leg-hop-to-stick',
        'single-leg-pogo-hold-to-hop',
        'distinct_exercises',
        'single_projection_and_terminal_stick_vs_hold_then_repeated_pogo_contacts_and_hop',
        'Single-Leg Hop to Stick performs one declared projection and ends in a held landing. Single-Leg Pogo Hold-to-Hop begins with a balance hold and adds one or more quick pogo contacts before its hop or reset. Entry, contact count, action order, elastic strategy, terminal state, dose, and impact differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/39228781/","https://pubmed.ncbi.nlm.nih.gov/17544325/"]'::JSONB
      ),
      (
        'split-squat-jump-to-stick',
        'static-squat-jump-to-box',
        'distinct_exercises',
        'split_stance_vertical_jump_and_floor_stick_vs_bilateral_static_squat_to_box',
        'Split-Squat Jump to Stick begins in an asymmetrical stance and lands to a declared controlled floor position. Static Squat Jump to Box begins bilaterally from a held squat and lands on an elevated box. Stance, laterality, target, landing surface, foot contacts, balance, side dose, and failure consequence differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/33359798/","https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB
      ),
      (
        'split-stance-anti-rotation-row',
        'split-stance-rotational-catch-and-throw',
        'distinct_exercises',
        'anchored_pull_while_resisting_rotation_vs_free_ball_catch_rotation_and_projection',
        'Split-Stance Anti-Rotation Row pulls anchored resistance while preventing trunk rotation. Rotational Catch and Throw receives a free ball, deliberately rotates, and projects it. Object behavior, force direction, elbow action, rotation objective, release, partner contract, repetition boundary, and failure state differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/19620925/","https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        '45-degree-cut-and-stick',
        '90-degree-speed-cut',
        'distinct_exercises',
        'forty_five_degree_redirect_and_stick_vs_ninety_degree_redirect',
        'The 45-Degree Cut-and-Stick redirects approximately forty-five degrees and terminates in an owned balance position. The 90-Degree Speed Cut redirects approximately ninety degrees and may reaccelerate or use its declared stick delivery. Redirect angle, approach line, plant orientation, braking impulse, exit line, cone geometry, measurement, and progression differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/33098142/"]'::JSONB
      ),
      (
        'build-up-sprint-stride-out',
        'sprint-float-sprint-build-up',
        'distinct_exercises',
        'continuous_progressive_acceleration_vs_accelerate_float_reaccelerate_sequence',
        'Build-Up Sprint progressively increases speed through the run without a required unloading segment. Sprint-Float-Sprint Build-Up requires an accelerate-float-reaccelerate sequence. Segment intent, velocity profile, force application, timing, distance layout, cueing, measurement, and repetition boundary differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/33217086/"]'::JSONB
      ),
      (
        'drop-landing-to-stick',
        'low-box-jump-to-stick',
        'distinct_exercises',
        'elevated_drop_to_floor_absorption_vs_concentric_floor_jump_to_box',
        'Drop Landing to Stick begins elevated, removes a concentric takeoff, and ends by absorbing a floor landing. Low-Box Jump to Stick begins on the floor, uses a concentric projection, and ends on the box. Takeoff, flight origin, projection, landing surface, impact exposure, box role, exit, and failure response differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/39228781/","https://pubmed.ncbi.nlm.nih.gov/33359798/"]'::JSONB
      ),
      (
        'dumbbell-incline-press',
        'plyo-push-up',
        'distinct_exercises',
        'incline_bench_external_load_press_vs_ballistic_closed_chain_push_up',
        'Incline Press uses an inclined bench and retained external load through a controlled pressing repetition. Plyometric Push-Up moves the body rapidly from fixed hand support and may include hand flight. Kinetic-chain behavior, support, implement, load path, velocity intent, landing demand, spotting, and stop rules differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/36026487/","https://pubmed.ncbi.nlm.nih.gov/38156065/"]'::JSONB
      ),
      (
        'front-squat',
        'med-ball-squat-press-hiit-fitness',
        'distinct_exercises',
        'anterior_loaded_squat_without_press_vs_squat_to_overhead_ball_press',
        'Front Squat retains the anterior load and ends each repetition at standing without required overhead motion. Medicine Ball Squat to Press adds a declared overhead press or release as the athlete stands. Ordered actions, shoulder and elbow motion, load path, terminal position, target or release contract, fatigue, and stop rules differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/30676181/","https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'front-squat',
        'medicine-ball-clean-to-squat',
        'distinct_exercises',
        'front_rack_squat_cycle_vs_floor_clean_receive_then_squat_sequence',
        'Front Squat begins with the load already supported in the declared front position and cycles the squat. Medicine Ball Clean to Squat begins at the floor or low position, cleans and receives the ball, then performs the squat. Pickup, ballistic pull, object acceleration, receive, action order, repetition boundary, load ceiling, and failure response differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/30676181/","https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'heels-elevated-front-squat',
        'split-squat',
        'distinct_exercises',
        'bilateral_heel_elevated_anterior_squat_vs_stationary_staggered_split_squat',
        'Heels-Elevated Front Squat keeps a bilateral stance with both heels supported on a wedge or plates and an anterior load. Split Squat fixes a staggered stance and biases the declared lead leg. Stance, laterality, support geometry, rear-leg role, load distribution, balance, side dosage, and spotting differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/30676181/","https://pubmed.ncbi.nlm.nih.gov/22889652/"]'::JSONB
      ),
      (
        'single-leg-balance-hold-tripod-foot',
        'single-leg-perturbation-catch',
        'distinct_exercises',
        'single_leg_balance_with_optional_body_perturbation_vs_object_catch_task',
        'Single-Leg Balance Hold owns one-leg support and may receive a controlled body perturbation overlay without requiring object handling. Single-Leg Perturbation Catch requires tracking and catching an incoming object while balancing. Object flight, visual tracking, hand action, catch timing, partner contract, error state, dose, and progression differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/30366506/"]'::JSONB
      ),
      (
        'skipping-rhythm-change-with-ball-toss',
        'skipping-rhythm-drill',
        'distinct_exercises',
        'skipping_with_object_toss_and_catch_vs_unloaded_skip_rhythm',
        'Skipping Rhythm Drill repeats the alternating skip cycle without required object interaction. Skipping Rhythm Change with Ball Toss adds a timed toss and catch while cadence changes. Object flight, visual tracking, hand action, dual-task timing, catch failure, partner or self-toss contract, space, and progression differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/33217086/","https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'snap-down-to-stick',
        'step-down-to-hover',
        'distinct_exercises',
        'active_rapid_snap_down_from_tall_vs_slow_elevated_single_leg_step_down',
        'Snap-Down to Stick begins standing and rapidly pulls into a bilateral or declared landing stance without stepping from a platform. Step-Down begins elevated and slowly lowers through one stance leg toward a hover or light tap. Start height, action speed, laterality, flight or step-off, impact, balance, dose, and stop rules differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB
      ),
      (
        'tall-kneeling-overhead-medicine-ball-slam',
        'tall-kneeling-overhead-wall-throw',
        'distinct_exercises',
        'downward_floor_slam_vs_forward_overhead_wall_projection',
        'Tall-Kneeling Overhead Slam accelerates the ball downward into the floor and manages rebound or retrieval. Tall-Kneeling Overhead Wall Throw projects forward to a wall target. Force direction, release angle, target, visual field, rebound, return contract, spacing, and failure consequence differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'tall-kneeling-overhead-medicine-ball-slam',
        'tall-kneeling-sandbag-overhead-press-strength',
        'distinct_exercises',
        'ballistic_ball_release_to_floor_vs_controlled_nonrelease_sandbag_press',
        'Tall-Kneeling Medicine Ball Slam uses a ballistic overhead-to-floor release. Tall-Kneeling Sandbag Overhead Press moves a retained load upward under control and returns it. Release, force direction, velocity, implement behavior, elbow action, return contract, load ceiling, and failure consequence differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/39589937/","https://pubmed.ncbi.nlm.nih.gov/23096062/"]'::JSONB
      ),
      (
        'wall-handstand-hold',
        'wall-handstand-push-up',
        'distinct_exercises',
        'inverted_isometric_support_hold_vs_dynamic_inverted_vertical_press',
        'Wall Handstand Hold maintains an inverted line without required elbow motion. Wall Handstand Push-Up repeatedly lowers and presses the body through shoulder and elbow range. Visible motion, contraction mode, joint actions, range, strength demand, dose unit, spotting, and safe failure differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/32707142/"]'::JSONB
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
