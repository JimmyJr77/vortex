-- Output phase infrastructure: subroles, fine order slots, validation education.
-- IDEMPOTENT.

ALTER TABLE coaching.exercise DROP CONSTRAINT IF EXISTS exercise_phase_subrole_check;
ALTER TABLE coaching.exercise ADD CONSTRAINT exercise_phase_subrole_check
  CHECK (phase_subrole IS NULL OR phase_subrole IN (
    'raise', 'mobilize', 'activate', 'integrate', 'potentiate_bridge',
    'shape_position_intelligence',
    'rotation_inversion_tumbling_foundations',
    'locomotion_sprint_mechanics',
    'balance_coordination_rhythm',
    'perception_action_reactive_movement',
    'acceleration_start_speed',
    'max_velocity_exposure',
    'elastic_stiffness_plyometric_rudiments',
    'jump_throw_explosive_power',
    'deceleration_cod_power',
    'reactive_agility_tumbling_output',
    'squat_knee_dominant_strength',
    'hinge_posterior_chain_strength',
    'upper_body_push_strength',
    'pull_hang_grip_strength',
    'carry_trunk_loaded_bracing_strength',
    'tissue_capacity_isometric_eccentric_accessory',
    'landing_braking_control',
    'single_leg_balance_foot_ankle_hip_control',
    'trunk_pelvis_anti_movement_control',
    'scapular_wrist_hand_support_resilience',
    'slow_eccentric_isometric_joint_resilience',
    'conditioning_intervals'
  ));

INSERT INTO coaching.phase_subrole (
  phase_id, key, name, description, order_index,
  why_it_exists, what_belongs_here, what_to_avoid, fatigue_guidance, coach_guidance
)
SELECT
  sp.id,
  v.key,
  v.name,
  v.description,
  v.order_index,
  v.why_it_exists,
  v.what_belongs_here,
  v.what_to_avoid,
  v.fatigue_guidance,
  v.coach_guidance
FROM coaching.session_phase sp
CROSS JOIN (VALUES
  ('acceleration_start_speed', 'Acceleration & Start Speed', 'First-step speed, projection, and acceleration intent.', 310,
   'Trains first-step speed, projection, acceleration posture, horizontal force expression, and rapid start mechanics.',
   'Falling starts, two/three-point starts, resisted acceleration, hill sprints, chase accelerations.',
   'Fatiguing sprint intervals, conditioning disguised as speed work, max volume before quality drops.',
   'Low volume, high intent, full recovery. Athletes should feel fast and sharp — not gassed.',
   'Stop when speed drops or mechanics degrade. Output is not trained by surviving reps.'),
  ('max_velocity_exposure', 'Max-Velocity Exposure', 'Controlled upright high-speed sprinting and rhythm.', 320,
   'Provides controlled exposure to upright high-speed sprinting, rhythm, relaxation, and top-speed mechanics.',
   'Build-ups, flying 10/20, sprint-float-sprint, ins-and-outs, wicket runs, curved sprints.',
   'Repeated max sprints with inadequate rest, speed work after heavy strength or HIIT.',
   'Fresh neural drive with 48–72h between hard sprint exposures for most athletes.',
   'NSCA speed guidance: 95–100% intent requires full recovery between reps and sessions.'),
  ('elastic_stiffness_plyometric_rudiments', 'Elastic Stiffness / Plyometric Rudiments', 'Short ground contact, stiffness, and SSC prep.', 330,
   'Develops short ground contact, elastic stiffness, stretch-shortening-cycle use, landing-to-rebound skill, and reactive foot/ankle qualities.',
   'Pogos, line hops, snap-downs, drop landings, low hurdle hop series.',
   'High contact volume, depth jumps for beginners, loud contacts, burnout plyo circuits.',
   'Track contacts not just reps. Low frequency (2–3 sessions/week) and low volume per session.',
   'Progress conservatively — landing quality and surface matter more than exercise count.'),
  ('jump_throw_explosive_power', 'Jump, Throw & Explosive Power', 'High-intent jumps, throws, and total-body power.', 340,
   'Trains high-intent force expression through jumps, throws, and explosive total-body power patterns.',
   'Vertical/broad/lateral jumps, bounds, medicine-ball throws and slams.',
   'High-rep jump circuits, short rest burnout, degraded landing quality.',
   '2–6 sets × 2–5 reps with full reset. Max intent, clean landings.',
   'Medicine-ball work allows power expression at lower technical complexity than Olympic lifts.'),
  ('deceleration_cod_power', 'Deceleration / Change-of-Direction Power', 'Braking, redirection, and COD power.', 350,
   'Trains high-quality braking, force absorption, redirection, cutting, and re-acceleration mechanics.',
   'Sprint-to-stick, accel-decel, lateral bound decel, pro-agility technical reps, cuts and shuttles.',
   'High-volume COD conditioning, cuts after fatigue, sloppy knee tracking.',
   'Crisp, low-volume reps with full recovery. Deceleration is Output when quality stays high.',
   'NSCA deceleration: force absorption through ankle, knee, hip flexion with rearward lean.'),
  ('reactive_agility_tumbling_output', 'High-Intensity Reactive Agility & Tumbling Output', 'Cue-driven reactive power and tumbling expression.', 360,
   'Trains high-intensity response to external cues, explosive tumbling entries, rebound mechanics, and reactive movement expression.',
   'Reactive gate sprints, mirror shuffle exits, ball-drop catches, power hurdle entries, round-off rebounds.',
   'Pre-planned cone runs without cues, tumbling output without skill prerequisites, reactive drills when winded.',
   'Fast, intense, decision-based — not conditioning. Requires skill prerequisites for tumbling output.',
   'Add visual, auditory, partner, or object cues. Agility differs from pre-planned COD by decision demand.')
) AS v(key, name, description, order_index, why_it_exists, what_belongs_here, what_to_avoid, fatigue_guidance, coach_guidance)
WHERE sp.key = 'output'
ON CONFLICT (phase_id, key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  order_index = EXCLUDED.order_index,
  why_it_exists = EXCLUDED.why_it_exists,
  what_belongs_here = EXCLUDED.what_belongs_here,
  what_to_avoid = EXCLUDED.what_to_avoid,
  fatigue_guidance = EXCLUDED.fatigue_guidance,
  coach_guidance = EXCLUDED.coach_guidance,
  updated_at = now();

UPDATE coaching.phase_order_slot pos SET subrole_key = v.subrole_key
FROM coaching.session_phase sp,
(VALUES
  ('speed_acceleration', 'acceleration_start_speed'),
  ('elastic_prep', 'elastic_stiffness_plyometric_rudiments'),
  ('main_plyometric', 'jump_throw_explosive_power'),
  ('agility_deceleration', 'deceleration_cod_power'),
  ('agility_reactive', 'reactive_agility_tumbling_output')
) AS v(slot_key, subrole_key)
WHERE sp.key = 'output'
  AND pos.phase_id = sp.id
  AND pos.key = v.slot_key;

INSERT INTO coaching.phase_order_slot (key, name, description, phase_id, order_index, freshness_sensitivity, subrole_key)
SELECT v.key, v.name, v.description, sp.id, v.order_index, v.freshness_sensitivity, v.subrole_key
FROM coaching.session_phase sp
CROSS JOIN (VALUES
  ('acceleration_start', 'Acceleration Start', 'Projection and first-step acceleration.', 311, 5, 'acceleration_start_speed'),
  ('start_variation', 'Start Variation', 'Low-position and ground-reaction starts.', 312, 5, 'acceleration_start_speed'),
  ('multidirectional_start', 'Multidirectional Start', 'Lateral and backward-to-forward breakout speed.', 313, 5, 'acceleration_start_speed'),
  ('chase_acceleration', 'Chase Acceleration', 'Competitive acceleration and reaction.', 314, 5, 'acceleration_start_speed'),
  ('resisted_acceleration', 'Resisted Acceleration', 'Band or sled resisted projection.', 315, 5, 'acceleration_start_speed'),
  ('hill_acceleration', 'Hill Acceleration', 'Incline acceleration mechanics.', 316, 5, 'acceleration_start_speed'),
  ('sprint_exposure', 'Sprint Exposure', 'Build-up and stride-out speed exposure.', 321, 5, 'max_velocity_exposure'),
  ('flying_sprint', 'Flying Sprint', 'Fly-in max-velocity zone work.', 322, 5, 'max_velocity_exposure'),
  ('speed_change', 'Speed Change', 'Sprint-float-sprint and ins-and-outs rhythm.', 323, 5, 'max_velocity_exposure'),
  ('wicket_rhythm', 'Wicket Rhythm', 'Wicket or mini-hurdle upright rhythm.', 324, 5, 'max_velocity_exposure'),
  ('curved_sprint', 'Curved Sprint', 'Arc and curved path sprinting.', 325, 5, 'max_velocity_exposure'),
  ('elastic_ankle', 'Elastic Ankle', 'Fast ankle pogos and directional stiffness.', 331, 5, 'elastic_stiffness_plyometric_rudiments'),
  ('lateral_elastic', 'Lateral Elastic', 'Frontal-plane line hops and stiffness.', 332, 5, 'elastic_stiffness_plyometric_rudiments'),
  ('single_leg_elastic', 'Single-Leg Elastic', 'Single-leg pogo and hold-to-hop.', 333, 5, 'elastic_stiffness_plyometric_rudiments'),
  ('landing_to_output', 'Landing to Output', 'Snap-down stick and rebound transitions.', 334, 5, 'elastic_stiffness_plyometric_rudiments'),
  ('drop_landing', 'Drop Landing', 'Drop landing stick and absorption.', 335, 5, 'elastic_stiffness_plyometric_rudiments'),
  ('drop_rebound', 'Drop Rebound', 'Depth drop to reactive rebound.', 336, 5, 'elastic_stiffness_plyometric_rudiments'),
  ('repeated_elastic_hop', 'Repeated Elastic Hop', 'Low hurdle hop series and rhythm.', 337, 5, 'elastic_stiffness_plyometric_rudiments'),
  ('vertical_jump_power', 'Vertical Jump Power', 'Countermovement and squat jumps.', 341, 5, 'jump_throw_explosive_power'),
  ('horizontal_jump_power', 'Horizontal Jump Power', 'Broad jump stick and rebound.', 342, 5, 'jump_throw_explosive_power'),
  ('lateral_jump_power', 'Lateral Jump Power', 'Lateral bound and skater patterns.', 343, 5, 'jump_throw_explosive_power'),
  ('split_jump_power', 'Split Jump Power', 'Split and scissor jump power.', 344, 5, 'jump_throw_explosive_power'),
  ('upper_body_power', 'Upper Body Power', 'Medicine-ball chest pass and push patterns.', 345, 5, 'jump_throw_explosive_power'),
  ('total_body_power', 'Total Body Power', 'Overhead slam and total-body throws.', 346, 5, 'jump_throw_explosive_power'),
  ('rotational_power', 'Rotational Power', 'Rotational scoop and shot-put throws.', 347, 5, 'jump_throw_explosive_power'),
  ('linear_deceleration', 'Linear Deceleration', 'Sprint-to-stick and accel-decel.', 351, 5, 'deceleration_cod_power'),
  ('lateral_deceleration', 'Lateral Deceleration', 'Lateral bound to decel stick.', 352, 5, 'deceleration_cod_power'),
  ('cod_power', 'COD Power', 'Pro-agility, cuts, and shuttle turns.', 353, 5, 'deceleration_cod_power'),
  ('curved_to_cut', 'Curved to Cut', 'Curved run into directional change.', 354, 5, 'deceleration_cod_power'),
  ('reactive_sprint', 'Reactive Sprint', 'Gate and visual reactive sprints.', 361, 5, 'reactive_agility_tumbling_output'),
  ('reactive_agility_output', 'Reactive Agility Output', 'Partner mirror and shuffle-to-sprint exits.', 362, 5, 'reactive_agility_tumbling_output'),
  ('object_reaction_output', 'Object Reaction Output', 'Ball drop catch and object-tracking bursts.', 363, 5, 'reactive_agility_tumbling_output'),
  ('tumbling_takeoff_output', 'Tumbling Takeoff Output', 'Power hurdle and round-off entry expression.', 364, 5, 'reactive_agility_tumbling_output'),
  ('tumbling_rebound_output', 'Tumbling Rebound Output', 'Round-off rebound and snap-down power.', 365, 5, 'reactive_agility_tumbling_output')
) AS v(key, name, description, order_index, freshness_sensitivity, subrole_key)
WHERE sp.key = 'output'
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  phase_id = EXCLUDED.phase_id,
  order_index = EXCLUDED.order_index,
  freshness_sensitivity = EXCLUDED.freshness_sensitivity,
  subrole_key = EXCLUDED.subrole_key;

INSERT INTO coaching.education_content (
  entity_type, entity_key, entity_id, title, short_summary, what_it_is, why_it_matters, programming_guidance, common_misuse
)
SELECT
  'phase_subrole', ps.key, ps.id, ps.name, ps.description,
  ps.what_belongs_here, ps.why_it_exists, ps.coach_guidance, ps.what_to_avoid
FROM coaching.phase_subrole ps
JOIN coaching.session_phase sp ON sp.id = ps.phase_id AND sp.key = 'output'
ON CONFLICT (entity_type, entity_key, entity_id) DO UPDATE SET
  title = EXCLUDED.title,
  short_summary = EXCLUDED.short_summary,
  what_it_is = EXCLUDED.what_it_is,
  why_it_matters = EXCLUDED.why_it_matters,
  programming_guidance = EXCLUDED.programming_guidance,
  common_misuse = EXCLUDED.common_misuse,
  updated_at = now();

INSERT INTO coaching.education_content (
  entity_type, entity_key, entity_id, title, short_summary, what_it_is, why_it_matters,
  programming_guidance, common_misuse
)
VALUES (
  'validation_rule',
  'output_readiness',
  NULL,
  'Output without fatigue',
  'Output expresses patterns fast and powerfully while fresh — not after conditioning or high-volume strength.',
  'Output is where the athlete expresses speed, explosiveness, elastic stiffness, plyometric power, reactive strength, jump/throw power, deceleration quality, COD power, and high-intensity reactive agility. Skill teaches the pattern; Output expresses it with intent.',
  'These qualities are most sensitive to fatigue. Output belongs after Prepare & Access and Movement Intelligence, but before Capacity, Resilience, and Sustained Capacity.',
  'Use low reps, low total volume, high rest, and high intent. Stop when speed, jump height, landing quality, or reaction quality drops. NSCA: hard sprinting often needs 48–72h between exposures; plyometrics favor 2–3 sessions/week with 3–6 sets of 2–5 reps.',
  'Do not place Output after Sustained Capacity, HIIT, or high-volume Capacity. Do not let sprints, jumps, or plyos become conditioning circuits with short rest.'
)
ON CONFLICT (entity_type, entity_key, entity_id) DO UPDATE SET
  title = EXCLUDED.title,
  short_summary = EXCLUDED.short_summary,
  what_it_is = EXCLUDED.what_it_is,
  why_it_matters = EXCLUDED.why_it_matters,
  programming_guidance = EXCLUDED.programming_guidance,
  common_misuse = EXCLUDED.common_misuse,
  updated_at = now();
