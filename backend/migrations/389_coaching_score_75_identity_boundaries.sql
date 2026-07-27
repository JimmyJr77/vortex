-- Adjudicate mechanically distinct and source-ambiguous pairs in the score-75
-- canonical identity queue after the score-76 pass.
--
-- Identity decisions do not approve cards, media, relationships, calibration,
-- or publication. Exercise cards use exercise complexity and physical
-- difficulty only; skill/proficiency levels belong only to coaching.skill.
-- IDEMPOTENT and fail-closed.

DO $$
DECLARE
  migration_key CONSTANT TEXT :=
    '389_coaching_score_75_identity_boundaries';
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
        'broad-jump-to-stick',
        'distinct_exercises',
        'half_turn_reorientation_and_landing_vs_forward_horizontal_projection',
        '180 Jump to Stick rotates and reorients the body through a half turn before landing. Broad Jump to Stick projects forward for horizontal distance without a required change of facing. Plane, visual reference, force vector, landing orientation, measurement, space, and failure state differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/33359798/","https://pubmed.ncbi.nlm.nih.gov/17544325/"]'::JSONB
      ),
      (
        'atlas-stone-d-ball-deadlift-strength',
        'atlas-stone-d-ball-lap-squat-strength',
        'distinct_exercises',
        'round_object_floor_deadlift_vs_squat_from_lapped_load_position',
        'Atlas Stone/D-Ball Deadlift lifts the object from the floor or low pad through a hinge to standing. Atlas Stone/D-Ball Lap Squat begins with the object supported in the lap and repeatedly squats. Start, load support, action sequence, knee contribution, range, repetition boundary, and failure response differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/24978835/","https://pubmed.ncbi.nlm.nih.gov/30676181/"]'::JSONB
      ),
      (
        'atlas-stone-d-ball-bear-hug-carry-strength',
        'sandbag-front-loaded-squat-strength',
        'distinct_exercises',
        'bear_hug_loaded_gait_vs_stationary_front_loaded_squat',
        'Bear-Hug Carry walks with the load secured against the trunk and is dosed by distance or time. Sandbag Squat remains stationary and repeatedly descends and stands with the load supported anteriorly. Locomotion, joint excursion, route, repetition boundary, dose, fatigue exposure, and stop rules differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/38665162/","https://pubmed.ncbi.nlm.nih.gov/30676181/"]'::JSONB
      ),
      (
        'back-squat',
        'barbell-hack-squat',
        'distinct_exercises',
        'posterior_shoulder_supported_barbell_squat_vs_bar_held_behind_legs',
        'Back Squat supports the bar across the posterior shoulder complex. Barbell Hack Squat holds the bar behind the legs and lifts it along a different path. Load support, grip, shoulder involvement, center of mass, pickup, range, and failure response differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/30676181/"]'::JSONB
      ),
      (
        'balance-pad-tennis-ball-catch-plus-color-call',
        'color-call-tennis-ball-catch-on-single-leg-balance',
        'needs_human_review',
        'balance_pad_source_does_not_declare_single_or_double_leg_support',
        'Both sources add a live color choice and tennis-ball catch to balance, but the balance-pad source does not declare whether support is unilateral or bilateral. Support foot count, pad use, and side sequencing determine whether these are one balance-catch identity or distinct tasks.',
        '["https://pubmed.ncbi.nlm.nih.gov/22889652/"]'::JSONB
      ),
      (
        'band-cable-row',
        'cable-band-chop',
        'distinct_exercises',
        'horizontal_anchored_pull_vs_diagonal_trunk_and_shoulder_chop',
        'Band/Cable Row pulls resistance horizontally toward the ribs through scapular retraction and elbow flexion. Cable/Band Chop moves resistance diagonally across the body with trunk and shoulder control. Force direction, elbow action, plane, anchor, stance, muscles, and coaching faults differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/19620925/","https://pubmed.ncbi.nlm.nih.gov/22889652/"]'::JSONB
      ),
      (
        'band-resisted-first-step',
        'band-resisted-squat',
        'distinct_exercises',
        'resisted_acceleration_first_step_vs_stationary_bilateral_squat',
        'Band-Resisted First Step uses a projected acceleration contact against horizontal resistance. Band-Resisted Squat descends and stands from a stationary bilateral base. Locomotion, force direction, stance, contact sequence, range, space, and dose differ.',
        '["https://pmc.ncbi.nlm.nih.gov/articles/PMC6872694/","https://pubmed.ncbi.nlm.nih.gov/30676181/"]'::JSONB
      ),
      (
        'bear-plank-shoulder-tap',
        'bear-position-shoulder-tap',
        'needs_human_review',
        'bear_position_source_does_not_declare_knee_contact_or_hover_support_state',
        'Both sources name a bear-position shoulder tap, but only Bear Plank Shoulder Tap declares a hover with anti-rotation control. The other source does not declare whether the knees remain down, hover, or transition. Support state and visible motion are required before consolidation.',
        '["https://pubmed.ncbi.nlm.nih.gov/32707142/"]'::JSONB
      ),
      (
        'box-squat',
        'cossack-squat',
        'distinct_exercises',
        'bilateral_sagittal_squat_to_rear_box_vs_frontal_weight_shift_to_one_leg',
        'Box Squat uses a bilateral stance and rear box depth target. Cossack Squat shifts laterally onto one bent leg while the trail leg lengthens. Plane, stance, laterality, target, trail-leg role, balance, range, and loading differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/30676181/","https://pubmed.ncbi.nlm.nih.gov/22889652/"]'::JSONB
      ),
      (
        'box-squat',
        'front-squat',
        'distinct_exercises',
        'squat_to_rear_box_contact_and_pause_vs_continuous_front_loaded_squat',
        'Box Squat uses a rear box or bench as a declared depth, contact, and pause target. Front Squat supports load anteriorly and reverses from an owned bottom without requiring rear-surface contact. External support, contact policy, depth target, pause, balance, setup, and failure response differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/22505136/","https://pubmed.ncbi.nlm.nih.gov/30676181/"]'::JSONB
      ),
      (
        'broad-jump-to-box-jump',
        'reactive-rebound-broad-jump-to-box-jump',
        'needs_human_review',
        'reactive_rebound_source_does_not_declare_extra_contact_or_rebound_sequence',
        'The source descriptions are identical floor-to-box jump summaries, while one title adds Reactive Rebound. It does not declare the entry contact, rebound direction, ground-contact target, or whether an additional broad-jump landing occurs. The ordered contact sequence is required before consolidation.',
        '["https://pubmed.ncbi.nlm.nih.gov/17544325/","https://pubmed.ncbi.nlm.nih.gov/17620779/"]'::JSONB
      ),
      (
        'cable-band-chop',
        'half-kneeling-medicine-ball-lift',
        'distinct_exercises',
        'anchored_high_to_low_chop_vs_free_ball_low_to_high_lift',
        'Cable/Band Chop moves anchored resistance on a high-to-low diagonal path. Half-Kneeling Medicine Ball Lift moves a free ball low to high without an anchor. Force direction, implement path, anchor, grip, base, range, return contract, and dose differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/22889652/"]'::JSONB
      ),
      (
        'cone-lateral-shuffle-hiit-fitness',
        'lateral-two-in-shuffle',
        'distinct_exercises',
        'open_cone_lateral_shuffle_interval_vs_ladder_two_contacts_per_box',
        'Cone Lateral Shuffle Interval travels between cone targets for timed work. Lateral Two-In Shuffle follows a ladder route with both feet entering each box. Route, equipment, contact sequence, terminal action, conditioning intent, measurement, and error state differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/24290613/","https://pubmed.ncbi.nlm.nih.gov/33217086/"]'::JSONB
      ),
      (
        'continuous-low-hurdle-hop',
        'low-hurdle-hops',
        'needs_human_review',
        'continuous_hurdle_source_does_not_declare_hurdle_count_direction_or_contact_contract',
        'Low Hurdle Hops declares a short row, bilateral elastic takeoffs, and rebound contacts. Continuous Low Hurdle Hop names repeated work but does not declare hurdle count, travel direction, takeoff and landing foot count, or whether contacts rebound. Those facts are required for identity.',
        '["https://pubmed.ncbi.nlm.nih.gov/17544325/"]'::JSONB
      ),
      (
        'cossack-squat',
        'dumbbell-sumo-squat',
        'distinct_exercises',
        'frontal_shift_to_one_bent_leg_vs_loaded_bilateral_wide_stance_squat',
        'Cossack Squat shifts laterally onto one leg while the opposite leg lengthens. Dumbbell Sumo Squat keeps both feet planted in a wide bilateral stance while descending centrally under load. Laterality, plane, trail-leg role, load, balance, range, and side dosage differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/22889652/","https://pubmed.ncbi.nlm.nih.gov/30676181/"]'::JSONB
      ),
      (
        'dumbbell-renegade-row',
        'one-arm-dumbbell-row',
        'distinct_exercises',
        'high_plank_row_with_anti_rotation_vs_supported_or_hinged_single_arm_row',
        'Renegade Row holds a high plank while one arm rows and the trunk resists rotation. One-Arm Dumbbell Row uses a supported or hinged base without the required hand-and-feet plank. Support, body orientation, kinetic chain, trunk demand, load tolerance, range, and failure response differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/19620925/","https://pubmed.ncbi.nlm.nih.gov/32707142/"]'::JSONB
      ),
      (
        'dumbbell-squeeze-press',
        'dumbbell-z-press',
        'distinct_exercises',
        'supine_horizontal_press_with_adduction_pressure_vs_floor_seated_vertical_press',
        'Dumbbell Squeeze Press lies supine and presses horizontally while maintaining inward implement pressure. Dumbbell Z-Press sits on the floor with legs extended and presses vertically. Orientation, force direction, adduction demand, base, hip position, range, and failure response differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/23096062/"]'::JSONB
      ),
      (
        'dumbbell-sumo-squat',
        'sumo-deadlift',
        'distinct_exercises',
        'wide_stance_squat_with_continuous_front_load_vs_floor_deadlift_to_standing',
        'Dumbbell Sumo Squat holds the load while repeatedly squatting through knee and hip flexion. Sumo Deadlift begins each repetition from the floor and stands through a wide-stance pull. Start, repetition boundary, load path, range, knee contribution, pickup, and failure response differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/30676181/","https://pubmed.ncbi.nlm.nih.gov/24978835/"]'::JSONB
      ),
      (
        'dumbbell-kettlebell-floor-press',
        'kettlebell-crush-grip-curl',
        'distinct_exercises',
        'supine_horizontal_press_with_elbow_extension_vs_upright_elbow_flexion_curl',
        'Floor Press lies supine and presses the implement through elbow extension and shoulder horizontal adduction. Kettlebell Crush-Grip Curl flexes the elbows while maintaining inward grip pressure. Orientation, force direction, primary joint action, muscles, range, support, and load path differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/19620925/","https://pubmed.ncbi.nlm.nih.gov/23096062/"]'::JSONB
      ),
      (
        'dumbbell-pullover',
        'hollow-body-hold',
        'distinct_exercises',
        'dynamic_loaded_shoulder_extension_pullover_vs_isometric_hollow_body_line',
        'Dumbbell Pullover dynamically moves external load through shoulder flexion and extension while the trunk remains supported. Hollow Body Hold maintains an isometric trunk and limb line without requiring repeated shoulder excursion. Visible motion, primary joint action, contraction mode, load path, dose unit, range, and failure response differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/19620925/","https://pubmed.ncbi.nlm.nih.gov/32707142/"]'::JSONB
      ),
      (
        'dumbbell-sumo-squat',
        'front-squat',
        'distinct_exercises',
        'wide_turned_out_center_loaded_squat_vs_front_racked_upright_squat',
        'Dumbbell Sumo Squat uses a wide turned-out stance and a centered hanging or goblet load with its corresponding hip strategy. Front Squat uses a declared anterior rack or chest support and does not require the sumo stance. Stance, foot angle, load position, grip, joint contribution, range, setup, and load ceiling differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/30676181/"]'::JSONB
      ),
      (
        'front-squat',
        'goblet-squat-bottom-iso-hold',
        'distinct_exercises',
        'dynamic_front_loaded_squat_repetitions_vs_fixed_bottom_isometric',
        'Front Squat completes controlled eccentric and concentric repetitions through a declared range. Goblet Squat Bottom Iso Hold maintains one declared bottom position without visible joint motion. Contraction type, repetition boundary, dose unit, range, local fatigue, measurement, and stop rules differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/30580468/","https://pubmed.ncbi.nlm.nih.gov/30676181/"]'::JSONB
      ),
      (
        'front-squat',
        'heels-elevated-front-squat',
        'distinct_exercises',
        'general_front_loaded_squat_vs_required_heel_elevation_and_barbell_front_rack',
        'Front Squat now retains barbell, dumbbell, kettlebell, and goblet source variants without requiring a raised heel. Heels-Elevated Front Squat requires a heel wedge or plates and a barbell front rack. Support surface, ankle constraint, implement contract, wrist and rack demand, setup, spotting, and load ceiling differ.',
        '["https://pmc.ncbi.nlm.nih.gov/articles/PMC12965823/","https://pubmed.ncbi.nlm.nih.gov/33161870/"]'::JSONB
      ),
      (
        'front-rack-carry',
        'split-squat',
        'distinct_exercises',
        'front_rack_loaded_gait_vs_stationary_split_stance_squat',
        'Front-Rack Carry walks with a load supported at the shoulders. Split Squat remains stationary in a staggered stance and repeatedly descends and stands. Locomotion, stance, laterality, joint excursion, distance, repetition boundary, and fatigue profile differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/38665162/","https://pubmed.ncbi.nlm.nih.gov/30676181/"]'::JSONB
      ),
      (
        'half-kneeling-one-arm-landmine-press',
        'one-arm-landmine-arc-press',
        'needs_human_review',
        'arc_press_source_does_not_declare_base_or_arc_path_contract',
        'Both sources declare a unilateral angled landmine press, but the Arc Press source does not declare its stance, start, finish, or how its arc differs from the normal fixed bar path. Those path and base facts are required before treating it as a base or trajectory variant.',
        '["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB
      ),
      (
        'half-kneeling-one-arm-landmine-press',
        'one-arm-landmine-z-press',
        'distinct_exercises',
        'half_kneeling_asymmetric_base_vs_floor_seated_long_sit_base',
        'Half-Kneeling One-Arm Landmine Press uses an upright asymmetric kneeling base with one foot planted. One-Arm Landmine Z-Press fixes the athlete seated on the floor with both legs extended. Support, hip and knee position, balance, trunk demand, setup, load tolerance, and safe failure differ.',
        '["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB
      ),
      (
        'hamstring-slider-curl',
        'nordic-hamstring-eccentric',
        'distinct_exercises',
        'supine_bridge_heel_slide_vs_ankle_anchored_kneeling_body_lowering',
        'Hamstring Slider Curl maintains a supine bridge while the heels slide away and return. Nordic Hamstring Eccentric anchors the ankles and lowers the trunk and thighs from kneeling. Orientation, support, kinetic chain, hip action, range, assistance, and failure response differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/40827942/","https://pubmed.ncbi.nlm.nih.gov/38156065/"]'::JSONB
      ),
      (
        'kneeling-medicine-ball-chest-pass',
        'medicine-ball-chest-pass-catch-and-stick',
        'distinct_exercises',
        'kneeling_horizontal_projection_vs_pass_return_catch_and_terminal_stick',
        'Kneeling Medicine Ball Chest Pass fixes a kneeling base and ends after projection or declared retrieval. Chest Pass Catch-and-Stick includes a return catch and controlled terminal stance. Base, leg contribution, action order, incoming ball, partner contract, repetition boundary, and failure states differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'landmine-anti-rotation-press',
        'landmine-ball-grip-rotational-press',
        'distinct_exercises',
        'anti_rotation_press_with_square_pelvis_vs_deliberate_hip_trunk_rotation_and_pivot',
        'Landmine Anti-Rotation Press resists trunk and pelvis rotation while pressing. Rotational Landmine Press deliberately turns the hips and thorax with a foot pivot. Trunk objective, plane, foot action, force transfer, stance, load tolerance, and error state differ.',
        '["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB
      ),
      (
        'landmine-anti-rotation-press',
        'landmine-drop-step-rotational-press',
        'distinct_exercises',
        'fixed_base_anti_rotation_press_vs_drop_step_then_rotational_press',
        'Landmine Anti-Rotation Press maintains the declared base and resists rotation. Drop-Step Rotational Press adds a directional step and deliberate rotation before pressing. Ordered actions, foot contacts, trunk objective, plane, space, force transfer, and repetition boundary differ.',
        '["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB
      ),
      (
        'landmine-ball-grip-anti-rotation-hold',
        'landmine-handle-grip-rotational-row',
        'distinct_exercises',
        'isometric_anti_rotation_hold_vs_dynamic_rotational_pull',
        'Landmine Anti-Rotation Hold keeps the bar still while resisting rotation. Landmine Rotational Row pulls the bar toward the body while deliberately rotating. Visible motion, force direction, elbow action, trunk objective, contraction mode, range, and dose unit differ.',
        '["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB
      ),
      (
        'landmine-ball-grip-rotational-press',
        'split-stance-one-arm-landmine-press',
        'distinct_exercises',
        'intentional_whole_body_rotation_vs_fixed_split_stance_strict_press',
        'Rotational Landmine Press deliberately turns through the feet, hips, and trunk while pressing. Split-Stance One-Arm Landmine Press fixes the asymmetrical base and preserves torso organization without required rotation. Rotation policy, foot action, force transfer, path, load tolerance, fatigue, and stop rules differ.',
        '["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB
      ),
      (
        'landmine-front-squat',
        'landmine-hack-squat',
        'distinct_exercises',
        'anterior_landmine_front_squat_support_vs_hack_position_with_bar_beside_or_behind',
        'Landmine Front Squat supports the bar anteriorly at the chest. Landmine Hack Squat positions the landmine beside or behind the body with a different torso and knee path. Load position, bar path, stance, center of mass, range, setup, and failure response differ.',
        '["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB
      ),
      (
        'landmine-handle-grip-deadlift',
        'sumo-deadlift',
        'needs_human_review',
        'landmine_handle_deadlift_source_does_not_declare_stance_or_handle_geometry',
        'Both sources declare a floor-based hinge, and the Sumo Deadlift family already contains a landmine sumo source. The Handle-Grip source does not declare stance width, foot angle, handle type, bar position, or whether knee contribution is sumo-specific. Those facts are required before consolidation.',
        '["https://pubmed.ncbi.nlm.nih.gov/24978835/","https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB
      ),
      (
        'landmine-handle-grip-rotational-row',
        'one-arm-landmine-row',
        'distinct_exercises',
        'dynamic_rotational_landmine_row_vs_braced_nonrotational_hinge_row',
        'Rotational Landmine Row deliberately turns the hips or trunk during the pull. Landmine Row holds a braced hinge and pulls without required rotation. Plane, foot action, trunk strategy, force transfer, stance, load path, and technical failure differ.',
        '["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB
      ),
      (
        'one-arm-landmine-push-press',
        'split-stance-one-arm-landmine-press',
        'distinct_exercises',
        'standing_dip_drive_push_press_vs_fixed_split_stance_strict_press',
        'Landmine Push Press uses a standing dip and leg drive to accelerate the bar. Split-Stance One-Arm Landmine Press establishes a fixed asymmetrical base and presses without a required dip-drive. Lower-body action, momentum, action order, velocity, load tolerance, fatigue, and repetition contract differ.',
        '["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB
      ),
      (
        'lateral-shuffle-decel-stick',
        'lateral-shuffle-to-wall-ball-shot',
        'distinct_exercises',
        'lateral_shuffle_to_braking_hold_vs_shuffle_then_squat_and_ball_projection',
        'Lateral Shuffle Decel Stick ends in a controlled braking hold. Lateral Shuffle to Wall Ball Shot adds a squat and ball projection to a wall target. Ordered actions, object interaction, target, release, terminal state, duration, and failure states differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/33217086/","https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'lateral-shuffle-decel-stick',
        'low-hurdle-lateral-hop-to-stick',
        'distinct_exercises',
        'grounded_lateral_shuffle_and_braking_vs_airborne_hurdle_clearance_and_landing',
        'Lateral Shuffle Decel Stick uses repeated grounded shuffle contacts before braking. Low-Hurdle Lateral Hop to Stick requires an airborne projection over an obstacle and controlled landing. Flight, obstacle, contact sequence, locomotion, impact, space, and dose differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/33217086/","https://pubmed.ncbi.nlm.nih.gov/17544325/"]'::JSONB
      ),
      (
        'med-ball-squat-press-hiit-fitness',
        'medicine-ball-chest-pass',
        'distinct_exercises',
        'squat_then_overhead_press_without_required_release_vs_horizontal_chest_projection',
        'Medicine Ball Squat to Press descends through a squat and drives the ball overhead without requiring a release. Medicine Ball Chest Pass projects and releases the ball horizontally from the chest without a required squat. Ordered actions, force direction, release, target, return contract, and dose differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'med-ball-squat-press-hiit-fitness',
        'medicine-ball-clean-to-squat',
        'distinct_exercises',
        'squat_then_overhead_press_vs_floor_clean_then_front_loaded_squat',
        'Medicine Ball Squat to Press begins with the ball already supported and drives it overhead while standing. Medicine Ball Clean to Squat begins with a floor pickup, cleans the ball to the anterior body, and completes a front-loaded squat without a required overhead press. Start, ordered actions, pickup, terminal position, range, load path, and dose differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'med-ball-squat-press-hiit-fitness',
        'medicine-ball-front-squat',
        'distinct_exercises',
        'squat_to_overhead_press_vs_front_loaded_squat_without_press',
        'Medicine Ball Squat to Press adds a declared overhead press as the athlete stands. Medicine Ball Front Squat keeps the ball at the chest or front rack and ends each repetition at standing without required overhead motion. Ordered actions, shoulder and elbow motion, load path, terminal position, range, fatigue, and stop rules differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/39589937/","https://pubmed.ncbi.nlm.nih.gov/30676181/"]'::JSONB
      ),
      (
        'medicine-ball-chest-pass',
        'medicine-ball-pivot-catch-and-pass',
        'distinct_exercises',
        'chest_projection_from_declared_base_vs_incoming_catch_pivot_reorientation_and_pass',
        'Medicine Ball Chest Pass projects the ball from an established base. Pivot Catch-and-Pass first receives an incoming ball, establishes a pivot, reorients, and passes. Incoming catch, footwork, rotation, action order, partner positioning, and repetition boundary differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'medicine-ball-rotational-throw',
        'medicine-ball-scoop-toss-to-broad-rebound',
        'distinct_exercises',
        'rotational_ball_projection_only_vs_scoop_projection_then_broad_rebound_sequence',
        'Medicine Ball Rotational Throw ends after the rotational projection and return or retrieval. Scoop Toss to Broad Rebound adds a lower-body broad rebound and landing. Ordered actions, throw path, foot contacts, flight, landing, impact, space, and success criteria differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/39589937/","https://pubmed.ncbi.nlm.nih.gov/17544325/"]'::JSONB
      ),
      (
        'medicine-ball-shot-put-throw',
        'partner-medicine-ball-sit-up-throw',
        'distinct_exercises',
        'upright_unilateral_shot_put_projection_vs_supine_trunk_flexion_then_partner_throw',
        'Medicine Ball Shot-Put Throw projects the ball unilaterally from an upright or declared kneeling base. Partner Sit-Up Throw begins supine, flexes the trunk, and throws to a partner. Orientation, action order, trunk range, release path, partner contract, load tolerance, and dose differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'medicine-ball-shot-put-throw',
        'shuffle-to-rotational-medicine-ball-throw',
        'distinct_exercises',
        'unilateral_shot_put_release_vs_lateral_shuffle_entry_to_rotational_projection',
        'Medicine Ball Shot-Put Throw uses a unilateral shot-put release from its declared base. Shuffle-to-Rotational Throw adds lateral locomotion and a rotational projection. Entry contacts, release path, plane, action order, space, timing, and failure states differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'one-arm-landmine-arc-press',
        'tall-kneeling-one-arm-landmine-press',
        'needs_human_review',
        'arc_press_source_does_not_declare_base_or_arc_path_against_tall_kneeling_press',
        'Tall-Kneeling One-Arm Landmine Press declares a symmetric kneeling base and strict angled press. The Arc Press source does not declare its base, start, finish, or how its arc differs from the normal fixed bar path. Those facts are required before deciding whether the cards cross an identity boundary.',
        '["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB
      ),
      (
        'one-arm-landmine-floor-press',
        'square-stance-one-arm-landmine-press',
        'distinct_exercises',
        'supine_horizontal_landmine_press_vs_square_standing_angled_press',
        'One-Arm Landmine Floor Press lies supine and presses from a floor-limited horizontal path. Square-Stance One-Arm Landmine Press uses a symmetric standing base and an angled upward path. Orientation, force direction, range boundary, support, setup, balance, and failure response differ.',
        '["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB
      ),
      (
        'one-arm-landmine-z-press',
        'tall-kneeling-one-arm-landmine-press',
        'distinct_exercises',
        'floor_seated_long_sit_base_vs_tall_kneeling_symmetric_base',
        'One-Arm Landmine Z-Press fixes the athlete seated on the floor with both legs extended. Tall-Kneeling One-Arm Landmine Press uses a symmetric upright kneeling base. Support, hip and knee position, balance, trunk demand, setup, load tolerance, and safe failure differ.',
        '["https://www.nsca.com/education/articles/kinetic-select/landmine-exercises/"]'::JSONB
      ),
      (
        'pogo-to-box-jump',
        'standing-box-jump-to-single-leg-landing',
        'distinct_exercises',
        'repeated_ankle_contact_entry_then_box_jump_vs_direct_floor_jump_to_single_leg_box_landing',
        'Pogo to Box Jump requires one or more elastic pogo contacts before takeoff. Box Jump to Single-Leg Landing jumps directly from its declared floor stance and lands on one leg. Entry contacts, elastic strategy, takeoff contract, landing laterality, impact, timing, and dose differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/17620779/","https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB
      ),
      (
        'round-off-rebound-snap-down-to-stick',
        'snap-down-to-pogo-rebound',
        'distinct_exercises',
        'round_off_rebound_and_snap_down_sequence_vs_snap_down_then_ankle_rebound',
        'Round-Off Rebound/Snap-Down to Stick begins with a round-off and its rebound before the snap-down and terminal landing. Snap-Down to Pogo Rebound begins from the snap-down and adds an ankle-dominant rebound. Entry skill, hand contacts, action order, flight, landing, complexity, and prerequisites differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB
      ),
      (
        'round-off-rebound-snap-down-to-stick',
        'snap-down-to-stick',
        'distinct_exercises',
        'round_off_and_rebound_before_snap_down_vs_snap_down_only',
        'Round-Off Rebound/Snap-Down to Stick includes a round-off and rebound before the snap-down. Snap-Down to Stick begins from an upright or declared raised-arm start without the round-off. Entry skill, hand contacts, action order, flight, space, complexity, and prerequisites differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB
      ),
      (
        'single-leg-bounds',
        'single-leg-rebound-hop',
        'distinct_exercises',
        'repeated_horizontal_unilateral_bounds_vs_single_rebound_hop_and_landing',
        'Single-Leg Bounds repeatedly project horizontally on one leg over distance. Single-Leg Rebound Hop uses a declared landing or contact to create one immediate rebound. Contact count, projection sequence, ground-contact target, terminal action, distance, impact, and dose differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB
      ),
      (
        'single-leg-depth-drop-to-stick',
        'single-leg-lateral-hop-to-stick',
        'distinct_exercises',
        'elevated_step_off_to_vertical_unilateral_landing_vs_same_leg_lateral_projection',
        'Single-Leg Depth Drop steps from an elevated surface and receives the imposed landing on one leg. Single-Leg Lateral Hop projects laterally from and to the same leg. Entry height, takeoff, force vector, obstacle, landing preparation, impact, and space differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/27428530/","https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB
      ),
      (
        'single-leg-depth-drop-to-stick',
        'single-leg-triple-hop-to-stick',
        'distinct_exercises',
        'single_elevated_step_off_landing_vs_three_unilateral_horizontal_projections',
        'Single-Leg Depth Drop has one imposed landing after stepping from a box. Single-Leg Triple Hop performs three repeated unilateral horizontal projections before the final stick. Entry, contact count, force direction, equipment, distance, cumulative impact, and dose differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/27428530/","https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB
      ),
      (
        'single-leg-landing-stick',
        'single-leg-lateral-hop-to-stick',
        'needs_human_review',
        'generic_single_leg_landing_source_does_not_declare_entry_or_projection_direction',
        'Single-Leg Lateral Hop declares a same-leg lateral takeoff and landing. Single-Leg Landing Stick declares unilateral landing alignment but not whether the athlete steps, drops, jumps, hops, or receives an external perturbation. Entry and projection direction are required before consolidation.',
        '["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB
      ),
      (
        'single-leg-line-hop-and-stick',
        'single-leg-triple-hop-to-stick',
        'needs_human_review',
        'line_hop_source_does_not_declare_contact_count_or_projection_direction',
        'Single-Leg Triple Hop declares three unilateral horizontal projections. Single-Leg Line Hop and Stick does not declare whether the line is crossed once or repeatedly, the travel direction, or whether the finish follows exactly three contacts. Those facts are required for identity.',
        '["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB
      ),
      (
        'single-leg-triple-hop-to-stick',
        'triple-line-hop-and-stick',
        'needs_human_review',
        'triple_line_source_does_not_declare_line_orientation_or_projection_distance',
        'Both sources declare three single-leg contacts and a final stick, but Triple-Line Hop does not declare line orientation or whether contacts are small in-place crossings versus distance-oriented horizontal projections. Direction and projection distance are identity-defining.',
        '["https://pubmed.ncbi.nlm.nih.gov/39228781/"]'::JSONB
      ),
      (
        'slam-ball-rotational-slam',
        'tall-kneeling-overhead-medicine-ball-slam',
        'distinct_exercises',
        'standing_or_declared_rotational_slam_vs_tall_kneeling_sagittal_overhead_slam',
        'Rotational Slam loads and projects through transverse hip and trunk rotation. Tall-Kneeling Overhead Slam fixes both knees down and projects the ball downward in the sagittal path. Base, plane, hip contribution, foot action, target, retrieval, and dose differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
      ),
      (
        'sumo-deadlift',
        'trap-bar-deadlift',
        'distinct_exercises',
        'wide_turned_out_barbell_or_center_load_pull_vs_hip_width_trap_bar_pull',
        'Sumo Deadlift uses a wide, turned-out stance and its corresponding hip and knee strategy. Trap-Bar Deadlift uses a hip-width stance with the athlete centered inside the implement. Stance, foot angle, implement geometry, grip, load path, joint contribution, setup, and failure response differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/24978835/"]'::JSONB
      ),
      (
        'wall-ball-target-cycling',
        'wall-ball-target-tap',
        'distinct_exercises',
        'repeated_throws_and_catches_across_targets_vs_nonballistic_target_rehearsal',
        'Wall Ball Target Cycling throws and catches the ball while changing among two or three targets. Wall Ball Target Tap rehearses eye line and finish position without a hard throw. Release intent, flight, catch, target count, repetition sequence, impact, and dose differ.',
        '["https://pubmed.ncbi.nlm.nih.gov/39589937/"]'::JSONB
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
