-- Resilience phase infrastructure: subroles, fine order slots, validation education.
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
    'slow_eccentric_isometric_joint_resilience'
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
  ('landing_braking_control', 'Landing & Braking Control', 'Landing sticks, braking, and deceleration control patterns.', 510,
   'Teaches athletes to absorb force, stop, stick landings, organize knee/hip/ankle alignment, and prepare for safer jumping, cutting, sprinting, and tumbling.',
   'Drop squat to stick, snap-down stick, hop-to-stick (low amplitude), step-off stick, decel step-down, jog/shuffle/backpedal to stick.',
   'High approach-speed decels (Output intent), landing/braking after Fitness when quality degrades, max volume without clean sticks.',
   'Low volume with full rest between sticks. Progress height, speed, or distance only when alignment stays clean.',
   'Regress height, speed, or distance when knee valgus, loud landings, extra steps, or trunk collapse appear.'),
  ('single_leg_balance_foot_ankle_hip_control', 'Single-Leg Balance / Foot-Ankle-Hip Control', 'Single-leg stance, reach, and step-down control.', 520,
   'Builds single-leg stance quality, foot tripod, ankle stability, hip control, pelvis control, and low-speed balance under changing positions.',
   'Single-leg balance hold, reach clock, Y-balance/star reach, SL RDL reach, hip airplane, step-down to hover, lateral step-down, SL squat to box, perturbation balance, beam/line freeze.',
   'Single-leg hop to stick without balance foundation, random flailing, high perturbation for beginners without supervision.',
   'Holds and reaches accumulate local fatigue — moderate rest. Many drills can be daily at low intensity.',
   'Reduce challenge, add hand support, or shorten hold when balance degrades or knee tracking fails.'),
  ('trunk_pelvis_anti_movement_control', 'Trunk / Pelvis / Anti-Movement Control', 'Anti-extension, anti-rotation, and trunk stiffness holds.', 530,
   'Builds anti-extension, anti-rotation, anti-lateral-flexion, rib/pelvis control, and trunk stiffness needed for force transfer and safe movement.',
   'Dead bug, bird dog ISO, front/side/bear plank, bear shoulder tap, plank pull-through, Pallof ISO hold, half-kneeling anti-rotation press/lift hold.',
   'Rib flare, breath-holding, shoulder/wrist fatigue before trunk stimulus, high-density core circuits calling themselves Control.',
   'Moderate hold duration with rest between sets. Dead bug, bird dog, and Pallof can be daily at low intensity.',
   'Reduce lever length, range, load, or hold when rib flare, low-back arching, or breath-holding appears.'),
  ('scapular_wrist_hand_support_resilience', 'Scapular / Wrist / Hand-Support Resilience', 'Scapular, wrist, and hand-support control and endurance.', 540,
   'Builds shoulder-blade control, wrist tolerance, crawling support, handstand support, ring/bar support, and upper-body support durability.',
   'Scapular push-up hold, prone Y-T-W ISO, tall plank shoulder tap, slow bear crawl, crab hold, wall handstand line, ring support hold, wrist lean ISO.',
   'Wall handstand or wall walk without wrist/scapular prerequisites, ring support when rings drift wide, hard daily wrist loading.',
   'Hand and wrist work is locally fatiguing — spread volume and monitor symptoms between sessions.',
   'Use fists, handles, incline support, or regress to dead bug/Pallof when hand/wrist pain appears before trunk stimulus.'),
  ('slow_eccentric_isometric_joint_resilience', 'Slow Eccentric / Isometric Joint Resilience', 'Slow eccentrics, isometric holds, and joint tissue tolerance.', 550,
   'Builds low-speed joint and tissue tolerance through slow eccentrics, holds, and controlled isometrics for knees, hips, adductors, hamstrings, calves, shins, and tendons.',
   'Split squat eccentric to pause, lateral lunge/Cossack holds, adductor squeeze bridge, hamstring bridge ISO, slider hamstring eccentric, calf/soleus/tibialis ISO, Nordic lean partial.',
   'Hard daily Nordics or slider eccentrics, lower-leg isometrics before Output when elastic quality matters, high-density short-rest circuits.',
   'Meaningful tissue stress — hard work usually 1–3×/week with recovery between exposures.',
   'Regress to supported split squat ISO or bridge hold when knee collapse, groin pain, or sharp hamstring pain appears.')
) AS v(key, name, description, order_index, why_it_exists, what_belongs_here, what_to_avoid, fatigue_guidance, coach_guidance)
WHERE sp.key = 'resilience'
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
  ('isometric_control', 'slow_eccentric_isometric_joint_resilience'),
  ('eccentric_control', 'slow_eccentric_isometric_joint_resilience'),
  ('balance_stability', 'single_leg_balance_foot_ankle_hip_control'),
  ('core_body_control', 'trunk_pelvis_anti_movement_control'),
  ('tissue_capacity', 'slow_eccentric_isometric_joint_resilience')
) AS v(slot_key, subrole_key)
WHERE sp.key = 'resilience'
  AND pos.phase_id = sp.id
  AND pos.key = v.slot_key;

INSERT INTO coaching.phase_order_slot (key, name, description, phase_id, order_index, freshness_sensitivity, subrole_key)
SELECT v.key, v.name, v.description, sp.id, v.order_index, v.freshness_sensitivity, v.subrole_key
FROM coaching.session_phase sp
CROSS JOIN (VALUES
  ('bilateral_landing_control', 'Bilateral Landing Control', 'Athletic landing shape, knee/hip alignment.', 511, 2, 'landing_braking_control'),
  ('snapdown_landing_control', 'Snapdown Landing Control', 'Fast-to-stable landing organization.', 512, 2, 'landing_braking_control'),
  ('drop_landing_control', 'Drop Landing Control', 'Low-impact force absorption.', 513, 2, 'landing_braking_control'),
  ('forward_landing_control', 'Forward Landing Control', 'Horizontal landing control.', 514, 2, 'landing_braking_control'),
  ('lateral_landing_control', 'Lateral Landing Control', 'Side-to-side landing alignment.', 515, 2, 'landing_braking_control'),
  ('single_leg_landing_control', 'Single-Leg Landing Control', 'Single-leg landing ownership.', 516, 3, 'landing_braking_control'),
  ('braking_position_control', 'Braking Position Control', 'Step-based braking mechanics.', 517, 2, 'landing_braking_control'),
  ('linear_deceleration_control', 'Linear Deceleration Control', 'Low-speed decel control.', 518, 2, 'landing_braking_control'),
  ('lateral_deceleration_control', 'Lateral Deceleration Control', 'Lateral stop mechanics.', 519, 2, 'landing_braking_control'),
  ('backward_deceleration_control', 'Backward Deceleration Control', 'Backward-to-stop control.', 520, 2, 'landing_braking_control'),
  ('single_leg_static_balance', 'Single-Leg Static Balance', 'Foot tripod, ankle, hip, posture.', 521, 2, 'single_leg_balance_foot_ankle_hip_control'),
  ('single_leg_reach_control', 'Single-Leg Reach Control', 'Reach control and knee tracking.', 522, 2, 'single_leg_balance_foot_ankle_hip_control'),
  ('multi_direction_reach_control', 'Multi-Direction Reach Control', 'Dynamic single-leg balance.', 523, 2, 'single_leg_balance_foot_ankle_hip_control'),
  ('single_leg_hinge_control', 'Single-Leg Hinge Control', 'Hip hinge and pelvic control.', 524, 2, 'single_leg_balance_foot_ankle_hip_control'),
  ('hip_rotation_balance_control', 'Hip Rotation Balance Control', 'Hip rotation and pelvis ownership.', 525, 2, 'single_leg_balance_foot_ankle_hip_control'),
  ('eccentric_stepdown_control', 'Eccentric Step-Down Control', 'Knee/hip eccentric control.', 526, 2, 'single_leg_balance_foot_ankle_hip_control'),
  ('frontal_plane_stepdown_control', 'Frontal-Plane Step-Down Control', 'Frontal-plane knee/hip control.', 527, 2, 'single_leg_balance_foot_ankle_hip_control'),
  ('single_leg_squat_control', 'Single-Leg Squat Control', 'Single-leg squat pattern control.', 528, 2, 'single_leg_balance_foot_ankle_hip_control'),
  ('perturbation_balance', 'Perturbation Balance', 'Reactive balance and joint control.', 529, 3, 'single_leg_balance_foot_ankle_hip_control'),
  ('narrow_base_balance_control', 'Narrow-Base Balance Control', 'Narrow-base balance and freeze control.', 530, 2, 'single_leg_balance_foot_ankle_hip_control'),
  ('anti_extension_control', 'Anti-Extension Control', 'Rib/pelvis control, anti-extension.', 531, 2, 'trunk_pelvis_anti_movement_control'),
  ('loaded_anti_extension_control', 'Loaded Anti-Extension Control', 'Loaded trunk control.', 532, 2, 'trunk_pelvis_anti_movement_control'),
  ('contralateral_trunk_control', 'Contralateral Trunk Control', 'Cross-body trunk/pelvis control.', 533, 2, 'trunk_pelvis_anti_movement_control'),
  ('anterior_trunk_control', 'Anterior Trunk Control', 'Anti-extension bracing.', 534, 2, 'trunk_pelvis_anti_movement_control'),
  ('lateral_trunk_control', 'Lateral Trunk Control', 'Anti-lateral-flexion control.', 535, 2, 'trunk_pelvis_anti_movement_control'),
  ('quadruped_trunk_control', 'Quadruped Trunk Control', 'Trunk stiffness in crawling base.', 536, 2, 'trunk_pelvis_anti_movement_control'),
  ('anti_rotation_quadruped_control', 'Anti-Rotation Quadruped Control', 'Anti-rotation under hand support.', 537, 2, 'trunk_pelvis_anti_movement_control'),
  ('dynamic_anti_rotation_control', 'Dynamic Anti-Rotation Control', 'Anti-rotation with arm reach.', 538, 2, 'trunk_pelvis_anti_movement_control'),
  ('anti_rotation_hold', 'Anti-Rotation Hold', 'Resisting rotational pull.', 539, 2, 'trunk_pelvis_anti_movement_control'),
  ('half_kneeling_trunk_control', 'Half-Kneeling Trunk Control', 'Pelvis/trunk control in split stance.', 540, 2, 'trunk_pelvis_anti_movement_control'),
  ('scapular_quadruped_control', 'Scapular Quadruped Control', 'Scapular protraction/retraction control.', 541, 2, 'scapular_wrist_hand_support_resilience'),
  ('scapular_posterior_chain_control', 'Scapular Posterior Chain Control', 'Lower trap, mid trap, posterior shoulder.', 542, 2, 'scapular_wrist_hand_support_resilience'),
  ('plank_shoulder_control', 'Plank Shoulder Control', 'Anti-rotation and shoulder support.', 543, 2, 'scapular_wrist_hand_support_resilience'),
  ('crawling_control', 'Crawling Control', 'Cross-body support and trunk control.', 544, 2, 'scapular_wrist_hand_support_resilience'),
  ('posterior_support_control', 'Posterior Support Control', 'Rear support, shoulder extension tolerance.', 545, 2, 'scapular_wrist_hand_support_resilience'),
  ('handstand_line_control', 'Handstand Line Control', 'Inverted line and hand-support control.', 546, 3, 'scapular_wrist_hand_support_resilience'),
  ('overhead_scapular_control', 'Overhead Scapular Control', 'Scapular elevation/depression in handstand.', 547, 3, 'scapular_wrist_hand_support_resilience'),
  ('handstand_eccentric_control', 'Handstand Eccentric Control', 'Controlled handstand exit and shoulder endurance.', 548, 3, 'scapular_wrist_hand_support_resilience'),
  ('straight_arm_support_control', 'Straight-Arm Support Control', 'Straight-arm support and ring/bar control.', 549, 3, 'scapular_wrist_hand_support_resilience'),
  ('wrist_support_control', 'Wrist Support Control', 'Wrist extension tolerance and hand support.', 550, 2, 'scapular_wrist_hand_support_resilience'),
  ('split_stance_eccentric_control', 'Split-Stance Eccentric Control', 'Knee/hip control through slow lowering.', 551, 2, 'slow_eccentric_isometric_joint_resilience'),
  ('frontal_plane_isometric_control', 'Frontal-Plane Isometric Control', 'Lateral hip/adductor control.', 552, 2, 'slow_eccentric_isometric_joint_resilience'),
  ('deep_frontal_plane_control', 'Deep Frontal-Plane Control', 'Deep lateral position ownership.', 553, 3, 'slow_eccentric_isometric_joint_resilience'),
  ('adductor_isometric_control', 'Adductor Isometric Control', 'Groin/adductor capacity with trunk/hip control.', 554, 3, 'slow_eccentric_isometric_joint_resilience'),
  ('hamstring_bridge_control', 'Hamstring Bridge Control', 'Hamstring/glute posterior-chain hold.', 555, 2, 'slow_eccentric_isometric_joint_resilience'),
  ('hamstring_eccentric_control', 'Hamstring Eccentric Control', 'Hamstring eccentric control.', 556, 3, 'slow_eccentric_isometric_joint_resilience'),
  ('gastroc_isometric_control', 'Gastroc Isometric Control', 'Gastroc/Achilles capacity.', 557, 2, 'slow_eccentric_isometric_joint_resilience'),
  ('soleus_isometric_control', 'Soleus Isometric Control', 'Soleus/Achilles bent-knee capacity.', 558, 2, 'slow_eccentric_isometric_joint_resilience'),
  ('tibialis_isometric_control', 'Tibialis Isometric Control', 'Shin/dorsiflexor control.', 559, 2, 'slow_eccentric_isometric_joint_resilience'),
  ('hamstring_isometric_resilience', 'Hamstring Isometric Resilience', 'High-level hamstring position tolerance.', 560, 3, 'slow_eccentric_isometric_joint_resilience')
) AS v(key, name, description, order_index, freshness_sensitivity, subrole_key)
WHERE sp.key = 'resilience'
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
JOIN coaching.session_phase sp ON sp.id = ps.phase_id AND sp.key = 'resilience'
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
  'control_resilience_readiness',
  NULL,
  'Resilience without mistaking precision for conditioning or Fitness',
  'Control teaches position ownership and force absorption after Output and Capacity — quality and alignment under low-to-moderate stress, not fatiguing circuits.',
  'Resilience is where athletes own positions, absorb force, resist unwanted motion, stabilize joints, control speed slowly, and maintain alignment under low-to-moderate stress. Capacity builds force and tissue reserve; Control organizes that force safely before Fitness tests repeatability under fatigue.',
  'Landing control, single-leg stability, trunk anti-motion, scapular/wrist support, and slow eccentric/isometric resilience buffer injury risk and support performance. Hard control work belongs after Output and usually after main Capacity; low-intensity control can appear earlier as readiness.',
  'Progress with longer holds, slower eccentrics, better alignment, smaller base of support, single-leg demand, perturbation, or slightly higher approach speed — not random burnout volume. Use full rest between quality reps. Many trunk and balance drills can be daily at low intensity; hard tissue and hand-support work needs recovery.',
  'Do not program high-density short-rest Control circuits — that is Sustained Capacity. Do not place hard landing sticks, decels, or lower-leg isometrics before Output when elastic quality matters. Do not chase volume when alignment, landing quality, or pain flags degrade.'
)
ON CONFLICT (entity_type, entity_key) WHERE entity_id IS NULL DO UPDATE SET
  title = EXCLUDED.title,
  short_summary = EXCLUDED.short_summary,
  what_it_is = EXCLUDED.what_it_is,
  why_it_matters = EXCLUDED.why_it_matters,
  programming_guidance = EXCLUDED.programming_guidance,
  common_misuse = EXCLUDED.common_misuse,
  updated_at = now();
