-- The candidate cards already use these repeatable movement and station/
-- observation concepts.  Register them as stable controlled vocabulary rather
-- than silently collapsing meaningful protocol distinctions into generic
-- labels.  This migration changes registry metadata only.
WITH additions(key, name, ordinal) AS (
  VALUES
    ('alternating_power_skip_for_distance', 'Alternating Power Skip for Distance', 1),
    ('balance', 'Balance Control', 2),
    ('bilateral_bounce_contact', 'Bilateral Bounce Contact', 3),
    ('bound', 'Bound', 4),
    ('bridge', 'Bridge', 5),
    ('clear_obstacle', 'Clear Obstacle', 6),
    ('continuous_uphill_sprint', 'Continuous Uphill Sprint', 7),
    ('controlled_deceleration', 'Controlled Deceleration', 8),
    ('cyclic_sprint_mechanics', 'Cyclic Sprint Mechanics', 9),
    ('decelerate', 'Decelerate', 10),
    ('dribble_progression', 'Dribble Progression', 11),
    ('final_bilateral_landing', 'Final Bilateral Landing', 12),
    ('full_reset', 'Full Reset', 13),
    ('hop', 'Hop', 14),
    ('horizontal_projection', 'Horizontal Projection', 15),
    ('horizontal_repeated_step_hop_projection', 'Horizontal Repeated Step-Hop Projection', 16),
    ('incline_resisted_linear_acceleration', 'Incline-Resisted Linear Acceleration', 17),
    ('knee_flexion', 'Knee Flexion', 18),
    ('landing', 'Landing', 19),
    ('low_amplitude_sprint_mechanics', 'Low-Amplitude Sprint Mechanics', 20),
    ('lunge', 'Lunge', 21),
    ('platform_step_off', 'Platform Step-Off', 22),
    ('repeated_unilateral_stretch_shortening_cycle', 'Repeated Unilateral Stretch-Shortening Cycle', 23),
    ('short_ground_contact', 'Short Ground Contact', 24),
    ('sprint', 'Sprint', 25),
    ('sprint_contact_learning', 'Sprint Contact Learning', 26),
    ('sprint_start', 'Sprint Start', 27),
    ('stabilize', 'Stabilize', 28),
    ('straight_leg_bound', 'Straight-Leg Bound', 29),
    ('transition_to_upright_sprint', 'Transition to Upright Sprint', 30),
    ('traveling_alternating_ankling', 'Traveling Alternating Ankling', 31),
    ('traveling_alternating_high_dribble', 'Traveling Alternating High Dribble', 32),
    ('traveling_alternating_straight_leg_bound', 'Traveling Alternating Straight-Leg Bound', 33),
    ('traveling_alternating_straight_leg_march', 'Traveling Alternating Straight-Leg March', 34),
    ('vertical_projection', 'Vertical Projection', 35),
    ('vertical_rebound', 'Vertical Rebound', 36)
), offset_value AS (
  SELECT COALESCE(MAX(sort_order), 0) AS offset FROM coaching.movement_pattern
)
INSERT INTO coaching.movement_pattern(key, name, sort_order)
SELECT additions.key, additions.name, offset_value.offset + additions.ordinal
FROM additions CROSS JOIN offset_value
ON CONFLICT (key) DO NOTHING;

WITH additions(key, name, ordinal) AS (
  VALUES
    ('10_to_20_metre_clear_lane', '10–20 Metre Clear Lane', 1),
    ('15_to_25_metre_clear_lane', '15–25 Metre Clear Lane', 2),
    ('15_to_30_metre_clear_lane', '15–30 Metre Clear Lane', 3),
    ('30_to_50_metre_clear_lane', '30–50 Metre Clear Lane', 4),
    ('cadence_feedback', 'Cadence Feedback', 5),
    ('clear_level_15_to_30_metre_lane', 'Clear Level 15–30 Metre Lane', 6),
    ('collars', 'Barbell Collars', 7),
    ('compatible_handle', 'Compatible Handle', 8),
    ('contact_markers', 'Contact Markers', 9),
    ('contact_mat_or_force_plate', 'Contact Mat or Force Plate', 10),
    ('contact_padding', 'Contact Padding', 11),
    ('elevated_hand_support', 'Elevated Hand Support', 12),
    ('elevated_target', 'Elevated Target', 13),
    ('exercise_mat', 'Exercise Mat', 14),
    ('floor_markers', 'Floor Markers', 15),
    ('floor_marks', 'Floor Marks', 16),
    ('floor_mat', 'Floor Mat', 17),
    ('grade_meter', 'Grade Meter', 18),
    ('jump_height_device', 'Jump Height Device', 19),
    ('knee_height_reference', 'Knee-Height Reference', 20),
    ('knee_pad', 'Knee Pad', 21),
    ('knee_padding', 'Knee Padding', 22),
    ('landing_markers', 'Landing Markers', 23),
    ('landing_mat', 'Landing Mat', 24),
    ('level_reactive_landing_surface', 'Level Reactive Landing Surface', 25),
    ('long_safe_finish_zone', 'Long Safe Finish Zone', 26),
    ('low_hurdle', 'Low Hurdle', 27),
    ('marked_bound_transition_sprint_and_deceleration_zones', 'Marked Bound, Sprint, and Deceleration Zones', 28),
    ('marked_dribble_transition_sprint_and_deceleration_zones', 'Marked Dribble, Sprint, and Deceleration Zones', 29),
    ('measuring_tape', 'Measuring Tape', 30),
    ('orientation_target', 'Orientation Target', 31),
    ('overhead_target', 'Overhead Target', 32),
    ('padding', 'Padding', 33),
    ('safe_finish_zone', 'Safe Finish Zone', 34),
    ('safe_run_out', 'Safe Run-Out', 35),
    ('socks_on_compatible_surface', 'Socks on Compatible Surface', 36),
    ('stable_hand_support', 'Stable Hand Support', 37),
    ('stable_non_slip_platform', 'Stable Non-Slip Platform', 38),
    ('stable_support', 'Stable Support', 39),
    ('start_finish_cones', 'Start/Finish Cones', 40),
    ('timing', 'Timing Device', 41),
    ('towels', 'Towels', 42),
    ('video', 'Video Recording / Replay', 43),
    ('video_capture', 'Video Capture', 44),
    ('visual_sequence_card', 'Visual Sequence Card', 45)
), offset_value AS (
  SELECT COALESCE(MAX(sort_order), 0) AS offset FROM coaching.equipment
)
INSERT INTO coaching.equipment(key, name, sort_order)
SELECT additions.key, additions.name, offset_value.offset + additions.ordinal
FROM additions CROSS JOIN offset_value
ON CONFLICT (key) DO NOTHING;
