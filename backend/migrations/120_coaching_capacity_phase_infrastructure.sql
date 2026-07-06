-- Capacity phase infrastructure: subroles, fine order slots, validation education.
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
    'tissue_capacity_isometric_eccentric_accessory'
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
  ('squat_knee_dominant_strength', 'Squat / Knee-Dominant Strength', 'Lower-body knee-dominant force and loading patterns.', 410,
   'Builds lower-body force capacity through squat, lunge, step-up, and frontal-plane knee-dominant patterns that support jumping, landing, sprinting, cutting, and general strength.',
   'Goblet squat, box squat, front squat, split squat, RFESS, reverse lunge, step-up, lateral lunge, Cossack, sled push.',
   'High-rep squat circuits before Output, grinding max singles without supervision, depth before control.',
   'Progressive overload with full rest between sets. Strength tolerates moderate fatigue but not before speed/power work.',
   'Use progressive load, reps, ROM, tempo, or unilateral demand — not random burnout circuits.'),
  ('hinge_posterior_chain_strength', 'Hinge / Posterior-Chain Strength', 'Hip hinge and posterior-chain loading.', 420,
   'Builds hip-extension, hamstring, glute, and posterior-chain force capacity needed for sprinting, jumping, tumbling takeoffs, deceleration, and back-side durability.',
   'Deadlift, RDL, single-leg RDL, hip thrust, good morning, slider curl, Nordic eccentric, back extension.',
   'Heavy hinges before max sprinting or jumping Output, high-volume Nordics for beginners.',
   'Eccentric and hinge work accumulates tissue stress — moderate rest and weekly frequency caps.',
   'Master hinge pattern before load. Nordics and heavy RDLs need progression and recovery.'),
  ('upper_body_push_strength', 'Upper-Body Push Strength', 'Horizontal and vertical pressing and support strength.', 430,
   'Builds pressing, hand-support, shoulder, elbow, wrist, and trunk capacity for tumbling, gymnastics, ninja, climbing, push-ups, dips, and overhead work.',
   'Incline push-up, push-up, tempo push-up, floor press, bench press, half-kneeling press, pike push-up, dip support.',
   'Max push volume before tumbling Output, aggressive overhead work without shoulder control.',
   'Pressing strength tolerates moderate fatigue; prioritize technical reps over failure.',
   'Scale angle, load, and range before chasing max reps.'),
  ('pull_hang_grip_strength', 'Upper-Body Pull, Hang & Grip Strength', 'Pulling, hanging, and grip capacity.', 440,
   'Builds pulling, hanging, climbing, scapular, and grip capacity for ninja, gymnastics, bars, rings, rope climbs, and general upper-body strength.',
   'Ring row, inverted row, dumbbell row, band row, assisted pull-up, eccentric pull-up, pull-up, scap pull-up, dead hang, rope/towel pull.',
   'Max pull-up testing before fresh Output, high-volume hangs when grip is already fried.',
   'Grip and hang work is locally fatiguing — spread across sessions and monitor tissue tolerance.',
   'Use regressions until controlled reps are automatic. Eccentrics need low volume.'),
  ('carry_trunk_loaded_bracing_strength', 'Carry / Trunk / Loaded-Bracing Strength', 'Loaded carries and trunk bracing under external load.', 450,
   'Builds trunk stiffness, grip, loaded posture, anti-rotation, anti-lateral-flexion, and total-body bracing under external load.',
   'Farmer, suitcase, front-rack, bear-hug, Zercher, overhead carry, Pallof press/hold, tall-kneeling chop.',
   'Heavy carries with collapsed posture, overhead carry without mobility, carries before fresh Output when strength-priority is not intended.',
   'Carries create systemic and grip fatigue — moderate rest and load that preserves tall posture.',
   'If posture breaks, reduce load or distance. Overhead carry requires shoulder control and mobility.'),
  ('tissue_capacity_isometric_eccentric_accessory', 'Tissue Capacity: Isometric, Eccentric & Accessory Strength', 'Targeted tendon and joint tolerance work.', 460,
   'Builds targeted tendon, joint, and tissue tolerance through isometric, eccentric, and accessory strength for knees, ankles, hips, adductors, wrists, forearms, and lower legs.',
   'Spanish squat iso, split squat hold, Copenhagen plank, tibialis raise, soleus raise, wrist/forearm series.',
   'Hard tissue work daily at max intensity, Nordics/Copenhagen for beginners without progression.',
   'Hard eccentric/isometric accessories usually 1–3×/week with recovery between hard exposures.',
   'Accessory tissue work supports Output and sport — it is not a substitute for main strength patterns.')
) AS v(key, name, description, order_index, why_it_exists, what_belongs_here, what_to_avoid, fatigue_guidance, coach_guidance)
WHERE sp.key = 'capacity'
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
  ('primary_strength', 'squat_knee_dominant_strength'),
  ('secondary_strength', 'hinge_posterior_chain_strength'),
  ('calisthenics_strength', 'upper_body_push_strength'),
  ('accessory_strength', 'tissue_capacity_isometric_eccentric_accessory'),
  ('loaded_carry', 'carry_trunk_loaded_bracing_strength')
) AS v(slot_key, subrole_key)
WHERE sp.key = 'capacity'
  AND pos.phase_id = sp.id
  AND pos.key = v.slot_key;

INSERT INTO coaching.phase_order_slot (key, name, description, phase_id, order_index, freshness_sensitivity, subrole_key)
SELECT v.key, v.name, v.description, sp.id, v.order_index, v.freshness_sensitivity, v.subrole_key
FROM coaching.session_phase sp
CROSS JOIN (VALUES
  ('squat_strength', 'Squat Strength', 'Foundational loaded squat patterns.', 411, 2, 'squat_knee_dominant_strength'),
  ('squat_regression', 'Squat Regression', 'Box squat and depth-controlled squat progressions.', 412, 2, 'squat_knee_dominant_strength'),
  ('front_loaded_squat', 'Front-Loaded Squat', 'Front squat with DB, KB, or barbell.', 413, 2, 'squat_knee_dominant_strength'),
  ('split_stance_strength', 'Split-Stance Strength', 'Split squat and RFESS unilateral strength.', 414, 2, 'squat_knee_dominant_strength'),
  ('lunge_strength', 'Lunge Strength', 'Reverse lunge and controlled decel strength.', 415, 2, 'squat_knee_dominant_strength'),
  ('step_up_strength', 'Step-Up Strength', 'Step-up hip and knee extension strength.', 416, 2, 'squat_knee_dominant_strength'),
  ('frontal_plane_strength', 'Frontal-Plane Strength', 'Lateral lunge and loaded Cossack patterns.', 417, 2, 'squat_knee_dominant_strength'),
  ('loaded_drive_strength', 'Loaded Drive Strength', 'Heavy sled push and drive march.', 418, 2, 'squat_knee_dominant_strength'),
  ('deadlift_strength', 'Deadlift Strength', 'Foundational hip-hinge deadlift patterns.', 421, 2, 'hinge_posterior_chain_strength'),
  ('hinge_strength', 'Hinge Strength', 'RDL and technical good morning patterns.', 422, 2, 'hinge_posterior_chain_strength'),
  ('single_leg_hinge', 'Single-Leg Hinge', 'Single-leg RDL and balance hinge strength.', 423, 3, 'hinge_posterior_chain_strength'),
  ('hip_extension_strength', 'Hip Extension Strength', 'Hip thrust and loaded glute bridge.', 424, 2, 'hinge_posterior_chain_strength'),
  ('hamstring_capacity', 'Hamstring Capacity', 'Slider curl and hamstring knee-flexion work.', 425, 2, 'hinge_posterior_chain_strength'),
  ('hamstring_eccentric', 'Hamstring Eccentric', 'Nordic and high-intensity hamstring eccentrics.', 426, 3, 'hinge_posterior_chain_strength'),
  ('posterior_chain_capacity', 'Posterior Chain Capacity', 'Back extension and hip extension capacity.', 427, 2, 'hinge_posterior_chain_strength'),
  ('pushup_regression', 'Push-Up Regression', 'Incline and scaled push strength.', 431, 2, 'upper_body_push_strength'),
  ('horizontal_push_strength', 'Horizontal Push Strength', 'Push-up, floor press, and bench press.', 432, 2, 'upper_body_push_strength'),
  ('push_eccentric', 'Push Eccentric', 'Tempo and eccentric push-up capacity.', 433, 2, 'upper_body_push_strength'),
  ('vertical_push_strength', 'Vertical Push Strength', 'Half-kneeling and overhead press patterns.', 434, 2, 'upper_body_push_strength'),
  ('inverted_push_strength', 'Inverted Push Strength', 'Pike push-up and handstand-push progressions.', 435, 3, 'upper_body_push_strength'),
  ('support_strength', 'Support Strength', 'Dip and ring support holds.', 436, 2, 'upper_body_push_strength'),
  ('horizontal_pull_strength', 'Horizontal Pull Strength', 'Ring row and inverted row patterns.', 441, 2, 'pull_hang_grip_strength'),
  ('single_arm_pull_strength', 'Single-Arm Pull Strength', 'One-arm dumbbell row strength.', 442, 2, 'pull_hang_grip_strength'),
  ('row_strength', 'Row Strength', 'Band and cable row patterns.', 443, 2, 'pull_hang_grip_strength'),
  ('vertical_pull_progression', 'Vertical Pull Progression', 'Assisted pull-up progressions.', 444, 2, 'pull_hang_grip_strength'),
  ('vertical_pull_eccentric', 'Vertical Pull Eccentric', 'Eccentric pull-up and chin-up negatives.', 445, 3, 'pull_hang_grip_strength'),
  ('vertical_pull_strength', 'Vertical Pull Strength', 'Pull-up and chin-up strength.', 446, 3, 'pull_hang_grip_strength'),
  ('scapular_pull_strength', 'Scapular Pull Strength', 'Scapular pull-up and depression work.', 447, 2, 'pull_hang_grip_strength'),
  ('hang_grip_capacity', 'Hang & Grip Capacity', 'Dead hang and active hang tolerance.', 448, 2, 'pull_hang_grip_strength'),
  ('climb_grip_strength', 'Climb & Grip Strength', 'Rope climb foot-lock and towel pull patterns.', 449, 3, 'pull_hang_grip_strength'),
  ('loaded_carry', 'Loaded Carry', 'Farmer and bear-hug carry patterns.', 451, 2, 'carry_trunk_loaded_bracing_strength'),
  ('anti_lateral_flexion_carry', 'Anti-Lateral-Flexion Carry', 'Suitcase carry anti-side-bend strength.', 452, 2, 'carry_trunk_loaded_bracing_strength'),
  ('front_loaded_carry', 'Front-Loaded Carry', 'Front-rack and Zercher carry patterns.', 453, 2, 'carry_trunk_loaded_bracing_strength'),
  ('overhead_carry', 'Overhead Carry', 'Overhead carry shoulder and trunk capacity.', 454, 3, 'carry_trunk_loaded_bracing_strength'),
  ('anti_rotation_strength', 'Anti-Rotation Strength', 'Pallof press and hold patterns.', 455, 2, 'carry_trunk_loaded_bracing_strength'),
  ('rotational_trunk_strength', 'Rotational Trunk Strength', 'Tall-kneeling chop and controlled rotation.', 456, 2, 'carry_trunk_loaded_bracing_strength'),
  ('quad_tendon_capacity', 'Quad Tendon Capacity', 'Spanish squat isometric and patellar tendon work.', 461, 2, 'tissue_capacity_isometric_eccentric_accessory'),
  ('split_stance_isometric', 'Split-Stance Isometric', 'Split squat isometric hold capacity.', 462, 2, 'tissue_capacity_isometric_eccentric_accessory'),
  ('adductor_capacity', 'Adductor Capacity', 'Copenhagen plank and adductor tolerance.', 463, 3, 'tissue_capacity_isometric_eccentric_accessory'),
  ('shin_capacity', 'Shin Capacity', 'Tibialis raise and anterior shin work.', 464, 1, 'tissue_capacity_isometric_eccentric_accessory'),
  ('soleus_capacity', 'Soleus Capacity', 'Seated soleus and bent-knee calf raise.', 465, 2, 'tissue_capacity_isometric_eccentric_accessory'),
  ('wrist_forearm_capacity', 'Wrist & Forearm Capacity', 'Wrist and forearm tolerance for gymnastics and ninja.', 466, 2, 'tissue_capacity_isometric_eccentric_accessory')
) AS v(key, name, description, order_index, freshness_sensitivity, subrole_key)
WHERE sp.key = 'capacity'
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
JOIN coaching.session_phase sp ON sp.id = ps.phase_id AND sp.key = 'capacity'
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
  'capacity_readiness',
  NULL,
  'Capacity without compromising Output or mistaking conditioning for strength',
  'Capacity builds force and tissue tolerance after Output — progressive overload with full rest, not fatiguing circuits before speed or power work.',
  'Capacity is where athletes build the ability to produce, tolerate, and progressively adapt to force — strength, muscle/tendon capacity, grip, trunk bracing, and targeted tissue work.',
  'Strength supports safer and more powerful Output over time. Capacity belongs after Output in standard sessions because heavy strength before sprinting, jumping, or reactive work reduces quality and increases risk.',
  'Use progressive overload (load, reps, sets, ROM, tempo, unilateral demand) with full rest between sets. Youth resistance training is supported when supervised and technique-first. Hard eccentrics and tissue accessories need recovery days.',
  'Do not program heavy Capacity before Output unless the session is strength-priority. Do not use short-rest high-density circuits and call it Capacity — that is Fitness / Repeatability. Do not chase max loads without supervision or technique.'
)
ON CONFLICT (entity_type, entity_key) WHERE entity_id IS NULL DO UPDATE SET
  title = EXCLUDED.title,
  short_summary = EXCLUDED.short_summary,
  what_it_is = EXCLUDED.what_it_is,
  why_it_matters = EXCLUDED.why_it_matters,
  programming_guidance = EXCLUDED.programming_guidance,
  common_misuse = EXCLUDED.common_misuse,
  updated_at = now();
