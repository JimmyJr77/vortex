/**
 * Top 50 Resilience phase movement candidates (JSON-lite + seed metadata).
 * Consumed by scripts/generate-128-control-seed.mjs
 */

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[–—/]/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Control-specific slugs where intent differs from other phases */
const SLUG_OVERRIDES = {
  'Snap-Down to Stick — Control Version': 'snap-down-to-stick-control-version',
  'Single-Leg Balance Reach Clock — Control Version': 'single-leg-balance-reach-clock-control',
  'Dead Bug Heel Tap / Dead Bug Progression': 'dead-bug-heel-tap-control-progression',
  'Pallof Press Iso Hold': 'pallof-press-iso-hold',
  'Bird Dog ISO Hold': 'bird-dog-iso-hold',
  'Beam / Line Balance Freeze': 'beam-line-balance-freeze',
  'Crab / Reverse Tabletop Hold': 'crab-reverse-tabletop-hold',
  'Wall Handstand Line Hold': 'wall-handstand-line-hold',
  'Wall Handstand Shoulder Shrug': 'wall-handstand-shoulder-shrug',
  'Wall Walk Negative / Controlled Wall Walk-Down': 'wall-walk-negative-controlled-wall-walk-down',
  'Ring Support Hold — Assisted / Control Version': 'ring-support-hold-assisted-control',
  'Wrist Lean Isometric / Wrist Support Rock Hold': 'wrist-lean-isometric-wrist-support-rock-hold',
  'Split Squat Eccentric to Pause': 'split-squat-eccentric-to-pause',
  'Isometric Lateral Lunge Hold': 'isometric-lateral-lunge-hold',
  'Cossack Bottom Hold / Cossack Shift Hold': 'cossack-bottom-hold-cossack-shift-hold',
  'Adductor Squeeze Bridge Hold': 'adductor-squeeze-bridge-hold',
  'Hamstring Bridge ISO / Long-Lever Bridge Hold': 'hamstring-bridge-iso-long-lever-bridge-hold',
  'Slider Hamstring Eccentric — Slow Lower': 'slider-hamstring-eccentric-slow-lower',
  'Calf Isometric Hold — Straight-Knee': 'calf-isometric-hold-straight-knee',
  'Soleus Isometric Hold — Bent-Knee': 'soleus-isometric-hold-bent-knee',
  'Tibialis ISO Toe-Up Hold': 'tibialis-iso-toe-up-hold',
  'Nordic Lean Isometric — Partial Range': 'nordic-lean-isometric-partial-range',
  'Half-Kneeling Anti-Rotation Press / Lift Hold': 'half-kneeling-anti-rotation-press-lift-hold',
  'Y-Balance Reach / Star Reach': 'y-balance-reach-star-reach',
  'Single-Leg RDL Reach — Bodyweight Control': 'single-leg-rdl-reach-bodyweight-control',
  'Hip Airplane — Supported': 'hip-airplane-supported',
  'Deceleration Step-Down / Stop-Step Stick': 'deceleration-step-down-stop-step-stick',
  'Jog-to-Stick Linear Deceleration': 'jog-to-stick-linear-deceleration',
  'Forward Hop to Stick — Low Amplitude': 'forward-hop-to-stick-low-amplitude',
  'Lateral Hop to Stick — Low Amplitude': 'lateral-hop-to-stick-low-amplitude',
  'Single-Leg Hop to Stick — Low Amplitude': 'single-leg-hop-to-stick-low-amplitude',
  'Front Plank / Long-Lever Plank': 'front-plank-long-lever-plank',
  'Dead Bug Pullover / Band Dead Bug': 'dead-bug-pullover-band-dead-bug',
  'Quadruped Scapular Push-Up Hold': 'quadruped-scapular-push-up-hold',
  'Prone Y-T-W Isometric Series': 'prone-y-t-w-isometric-series',
}

/** @type {Array<{ number: number, name: string, subrole: string, slot: string }>} */
export const CONTROL_TOP50 = [
  { number: 1, name: 'Drop Squat to Stick', subrole: 'landing_braking_control', slot: 'bilateral_landing_control' },
  { number: 2, name: 'Snap-Down to Stick — Control Version', subrole: 'landing_braking_control', slot: 'snapdown_landing_control' },
  { number: 3, name: 'Low Box Step-Off to Stick', subrole: 'landing_braking_control', slot: 'drop_landing_control' },
  { number: 4, name: 'Forward Hop to Stick — Low Amplitude', subrole: 'landing_braking_control', slot: 'forward_landing_control' },
  { number: 5, name: 'Lateral Hop to Stick — Low Amplitude', subrole: 'landing_braking_control', slot: 'lateral_landing_control' },
  { number: 6, name: 'Single-Leg Hop to Stick — Low Amplitude', subrole: 'landing_braking_control', slot: 'single_leg_landing_control' },
  { number: 7, name: 'Deceleration Step-Down / Stop-Step Stick', subrole: 'landing_braking_control', slot: 'braking_position_control' },
  { number: 8, name: 'Jog-to-Stick Linear Deceleration', subrole: 'landing_braking_control', slot: 'linear_deceleration_control' },
  { number: 9, name: 'Lateral Shuffle to Stick', subrole: 'landing_braking_control', slot: 'lateral_deceleration_control' },
  { number: 10, name: 'Backpedal to Stick', subrole: 'landing_braking_control', slot: 'backward_deceleration_control' },
  { number: 11, name: 'Single-Leg Balance Hold — Tripod Foot', subrole: 'single_leg_balance_foot_ankle_hip_control', slot: 'single_leg_static_balance' },
  { number: 12, name: 'Single-Leg Balance Reach Clock — Control Version', subrole: 'single_leg_balance_foot_ankle_hip_control', slot: 'single_leg_reach_control' },
  { number: 13, name: 'Y-Balance Reach / Star Reach', subrole: 'single_leg_balance_foot_ankle_hip_control', slot: 'multi_direction_reach_control' },
  { number: 14, name: 'Single-Leg RDL Reach — Bodyweight Control', subrole: 'single_leg_balance_foot_ankle_hip_control', slot: 'single_leg_hinge_control' },
  { number: 15, name: 'Hip Airplane — Supported', subrole: 'single_leg_balance_foot_ankle_hip_control', slot: 'hip_rotation_balance_control' },
  { number: 16, name: 'Step-Down to Hover', subrole: 'single_leg_balance_foot_ankle_hip_control', slot: 'eccentric_stepdown_control' },
  { number: 17, name: 'Lateral Step-Down', subrole: 'single_leg_balance_foot_ankle_hip_control', slot: 'frontal_plane_stepdown_control' },
  { number: 18, name: 'Single-Leg Squat to Box', subrole: 'single_leg_balance_foot_ankle_hip_control', slot: 'single_leg_squat_control' },
  { number: 19, name: 'Perturbation Single-Leg Balance', subrole: 'single_leg_balance_foot_ankle_hip_control', slot: 'perturbation_balance' },
  { number: 20, name: 'Beam / Line Balance Freeze', subrole: 'single_leg_balance_foot_ankle_hip_control', slot: 'narrow_base_balance_control' },
  { number: 21, name: 'Dead Bug Heel Tap / Dead Bug Progression', subrole: 'trunk_pelvis_anti_movement_control', slot: 'anti_extension_control' },
  { number: 22, name: 'Dead Bug Pullover / Band Dead Bug', subrole: 'trunk_pelvis_anti_movement_control', slot: 'loaded_anti_extension_control' },
  { number: 23, name: 'Bird Dog ISO Hold', subrole: 'trunk_pelvis_anti_movement_control', slot: 'contralateral_trunk_control' },
  { number: 24, name: 'Front Plank / Long-Lever Plank', subrole: 'trunk_pelvis_anti_movement_control', slot: 'anterior_trunk_control' },
  { number: 25, name: 'Side Plank', subrole: 'trunk_pelvis_anti_movement_control', slot: 'lateral_trunk_control' },
  { number: 26, name: 'Bear Plank Hold', subrole: 'trunk_pelvis_anti_movement_control', slot: 'quadruped_trunk_control' },
  { number: 27, name: 'Bear Plank Shoulder Tap', subrole: 'trunk_pelvis_anti_movement_control', slot: 'anti_rotation_quadruped_control' },
  { number: 28, name: 'Plank Pull-Through', subrole: 'trunk_pelvis_anti_movement_control', slot: 'dynamic_anti_rotation_control' },
  { number: 29, name: 'Pallof Press Iso Hold', subrole: 'trunk_pelvis_anti_movement_control', slot: 'anti_rotation_hold' },
  { number: 30, name: 'Half-Kneeling Anti-Rotation Press / Lift Hold', subrole: 'trunk_pelvis_anti_movement_control', slot: 'half_kneeling_trunk_control' },
  { number: 31, name: 'Quadruped Scapular Push-Up Hold', subrole: 'scapular_wrist_hand_support_resilience', slot: 'scapular_quadruped_control' },
  { number: 32, name: 'Prone Y-T-W Isometric Series', subrole: 'scapular_wrist_hand_support_resilience', slot: 'scapular_posterior_chain_control' },
  { number: 33, name: 'Tall Plank Shoulder Tap', subrole: 'scapular_wrist_hand_support_resilience', slot: 'plank_shoulder_control' },
  { number: 34, name: 'Slow Bear Crawl', subrole: 'scapular_wrist_hand_support_resilience', slot: 'crawling_control' },
  { number: 35, name: 'Crab / Reverse Tabletop Hold', subrole: 'scapular_wrist_hand_support_resilience', slot: 'posterior_support_control' },
  { number: 36, name: 'Wall Handstand Line Hold', subrole: 'scapular_wrist_hand_support_resilience', slot: 'handstand_line_control' },
  { number: 37, name: 'Wall Handstand Shoulder Shrug', subrole: 'scapular_wrist_hand_support_resilience', slot: 'overhead_scapular_control' },
  { number: 38, name: 'Wall Walk Negative / Controlled Wall Walk-Down', subrole: 'scapular_wrist_hand_support_resilience', slot: 'handstand_eccentric_control' },
  { number: 39, name: 'Ring Support Hold — Assisted / Control Version', subrole: 'scapular_wrist_hand_support_resilience', slot: 'straight_arm_support_control' },
  { number: 40, name: 'Wrist Lean Isometric / Wrist Support Rock Hold', subrole: 'scapular_wrist_hand_support_resilience', slot: 'wrist_support_control' },
  { number: 41, name: 'Split Squat Eccentric to Pause', subrole: 'slow_eccentric_isometric_joint_resilience', slot: 'split_stance_eccentric_control' },
  { number: 42, name: 'Isometric Lateral Lunge Hold', subrole: 'slow_eccentric_isometric_joint_resilience', slot: 'frontal_plane_isometric_control' },
  { number: 43, name: 'Cossack Bottom Hold / Cossack Shift Hold', subrole: 'slow_eccentric_isometric_joint_resilience', slot: 'deep_frontal_plane_control' },
  { number: 44, name: 'Adductor Squeeze Bridge Hold', subrole: 'slow_eccentric_isometric_joint_resilience', slot: 'adductor_isometric_control' },
  { number: 45, name: 'Hamstring Bridge ISO / Long-Lever Bridge Hold', subrole: 'slow_eccentric_isometric_joint_resilience', slot: 'hamstring_bridge_control' },
  { number: 46, name: 'Slider Hamstring Eccentric — Slow Lower', subrole: 'slow_eccentric_isometric_joint_resilience', slot: 'hamstring_eccentric_control' },
  { number: 47, name: 'Calf Isometric Hold — Straight-Knee', subrole: 'slow_eccentric_isometric_joint_resilience', slot: 'gastroc_isometric_control' },
  { number: 48, name: 'Soleus Isometric Hold — Bent-Knee', subrole: 'slow_eccentric_isometric_joint_resilience', slot: 'soleus_isometric_control' },
  { number: 49, name: 'Tibialis ISO Toe-Up Hold', subrole: 'slow_eccentric_isometric_joint_resilience', slot: 'tibialis_isometric_control' },
  { number: 50, name: 'Nordic Lean Isometric — Partial Range', subrole: 'slow_eccentric_isometric_joint_resilience', slot: 'hamstring_isometric_resilience' },
]

const FAMILY_BY_SUBROLE = {
  landing_braking_control: 'Landing & Braking Control',
  single_leg_balance_foot_ankle_hip_control: 'Single-Leg Balance / Foot-Ankle-Hip Control',
  trunk_pelvis_anti_movement_control: 'Trunk / Pelvis / Anti-Movement Control',
  scapular_wrist_hand_support_resilience: 'Scapular / Wrist / Hand-Support Resilience',
  slow_eccentric_isometric_joint_resilience: 'Slow Eccentric / Isometric Joint Resilience',
}

const DEFAULTS_BY_SUBROLE = {
  landing_braking_control: { sets: 3, reps: 4, work: null, rest: 45, est: 30, unit: 'attempts', impact: 1, skill: 'BEGINNER', pattern: 'jump', equip: 'none', body: 'lower_body' },
  single_leg_balance_foot_ankle_hip_control: { sets: 3, reps: null, work: 20, rest: 30, est: 35, unit: 'seconds', impact: 0, skill: 'BEGINNER', pattern: 'balance', equip: 'none', body: 'lower_body' },
  trunk_pelvis_anti_movement_control: { sets: 3, reps: null, work: 20, rest: 30, est: 30, unit: 'seconds', impact: 0, skill: 'BEGINNER', pattern: 'brace', equip: 'mat', body: 'core' },
  scapular_wrist_hand_support_resilience: { sets: 3, reps: null, work: 20, rest: 45, est: 35, unit: 'seconds', impact: 0, skill: 'INTERMEDIATE', pattern: 'push', equip: 'mat', body: 'upper_body' },
  slow_eccentric_isometric_joint_resilience: { sets: 3, reps: 5, work: 20, rest: 45, est: 40, unit: 'seconds', impact: 0, skill: 'INTERMEDIATE', pattern: 'squat', equip: 'none', body: 'lower_body' },
}

const DAILY_OK_SLUGS = new Set([
  'dead-bug-heel-tap-control-progression',
  'bird-dog-iso-hold',
  'pallof-press-iso-hold',
  'wrist-lean-isometric-wrist-support-rock-hold',
  'single-leg-balance-hold-tripod-foot',
  'tibialis-iso-toe-up-hold',
  'beam-line-balance-freeze',
  'drop-squat-to-stick',
])

const EQUIP_OVERRIDES = {
  'low-box-step-off-to-stick': 'box',
  'single-leg-squat-to-box': 'box',
  'dead-bug-pullover-band-dead-bug': 'bands',
  'pallof-press-iso-hold': 'bands',
  'half-kneeling-anti-rotation-press-lift-hold': 'bands',
  'plank-pull-through': 'dumbbell',
  'ring-support-hold-assisted-control': 'rings',
  'slider-hamstring-eccentric-slow-lower': 'mat',
  'perturbation-single-leg-balance': 'none',
  'beam-line-balance-freeze': 'none',
}

const PATTERN_OVERRIDES = {
  'slow-bear-crawl': 'crawl',
  'quadruped-scapular-push-up-hold': 'push',
  'jog-to-stick-linear-deceleration': 'locomote',
  'lateral-shuffle-to-stick': 'locomote',
  'backpedal-to-stick': 'locomote',
}

const DOSAGE_OVERRIDES = {
  'drop-squat-to-stick': { sets: 2, reps: 5, work: null, rest: 20, unit: 'reps' },
  'snap-down-to-stick-control-version': { sets: 2, reps: 5, work: null, rest: 25, unit: 'reps' },
  'low-box-step-off-to-stick': { sets: 2, reps: 4, work: null, rest: 30, unit: 'attempts' },
  'forward-hop-to-stick-low-amplitude': { sets: 2, reps: 4, work: null, rest: 30, unit: 'attempts' },
  'lateral-hop-to-stick-low-amplitude': { sets: 2, reps: 4, work: null, rest: 30, unit: 'attempts' },
  'single-leg-hop-to-stick-low-amplitude': { sets: 2, reps: 3, work: null, rest: 40, unit: 'attempts' },
  'deceleration-step-down-stop-step-stick': { sets: 2, reps: 5, work: null, rest: 25, unit: 'attempts' },
  'jog-to-stick-linear-deceleration': { sets: 2, reps: 4, work: null, rest: 40, unit: 'attempts' },
  'lateral-shuffle-to-stick': { sets: 2, reps: 4, work: null, rest: 40, unit: 'attempts' },
  'backpedal-to-stick': { sets: 2, reps: 4, work: null, rest: 40, unit: 'attempts' },
  'slow-bear-crawl': { sets: 2, reps: null, work: null, rest: 45, unit: 'distance', distance: 10 },
  'nordic-lean-isometric-partial-range': { sets: 2, reps: 3, work: 5, rest: 90, unit: 'seconds' },
  'split-squat-eccentric-to-pause': { sets: 2, reps: 5, work: null, rest: 45, unit: 'reps' },
  'slider-hamstring-eccentric-slow-lower': { sets: 2, reps: 5, work: null, rest: 60, unit: 'reps' },
  'isometric-lateral-lunge-hold': { sets: 2, reps: null, work: 20, rest: 40, unit: 'seconds' },
  'cossack-bottom-hold-cossack-shift-hold': { sets: 2, reps: null, work: 15, rest: 45, unit: 'seconds' },
  'adductor-squeeze-bridge-hold': { sets: 2, reps: null, work: 20, rest: 30, unit: 'seconds' },
  'hamstring-bridge-iso-long-lever-bridge-hold': { sets: 3, reps: null, work: 20, rest: 45, unit: 'seconds' },
  'calf-isometric-hold-straight-knee': { sets: 3, reps: null, work: 20, rest: 45, unit: 'seconds' },
  'soleus-isometric-hold-bent-knee': { sets: 3, reps: null, work: 20, rest: 45, unit: 'seconds' },
  'tibialis-iso-toe-up-hold': { sets: 2, reps: 10, work: 15, rest: 20, unit: 'reps' },
  'wall-handstand-line-hold': { sets: 3, reps: null, work: 15, rest: 60, unit: 'seconds' },
  'dead-bug-heel-tap-control-progression': { sets: 2, reps: 6, work: null, rest: 20, unit: 'reps' },
  'dead-bug-pullover-band-dead-bug': { sets: 2, reps: 5, work: null, rest: 30, unit: 'reps' },
  'bird-dog-iso-hold': { sets: 2, reps: 5, work: 3, rest: 20, unit: 'reps' },
  'front-plank-long-lever-plank': { sets: 3, reps: null, work: 20, rest: 40, unit: 'seconds' },
  'side-plank': { sets: 2, reps: null, work: 20, rest: 30, unit: 'seconds' },
  'bear-plank-hold': { sets: 3, reps: null, work: 15, rest: 30, unit: 'seconds' },
  'bear-plank-shoulder-tap': { sets: 2, reps: 6, work: null, rest: 40, unit: 'reps' },
  'plank-pull-through': { sets: 2, reps: 6, work: null, rest: 45, unit: 'reps' },
  'pallof-press-iso-hold': { sets: 3, reps: 6, work: 10, rest: 30, unit: 'reps' },
  'half-kneeling-anti-rotation-press-lift-hold': { sets: 2, reps: 6, work: 10, rest: 40, unit: 'reps' },
}

const METHODS_BY_SUBROLE = {
  landing_braking_control: ['plyometrics', 'core_body_control'],
  single_leg_balance_foot_ankle_hip_control: ['balance_stability', 'core_body_control'],
  trunk_pelvis_anti_movement_control: ['isometrics', 'core_body_control'],
  scapular_wrist_hand_support_resilience: ['isometrics', 'core_body_control'],
  slow_eccentric_isometric_joint_resilience: ['isometrics', 'eccentric_negative'],
}

const PHYS_BY_SUBROLE = {
  landing_braking_control: ['control_stability', 'force_tissue_capacity'],
  single_leg_balance_foot_ankle_hip_control: ['control_stability'],
  trunk_pelvis_anti_movement_control: ['control_stability'],
  scapular_wrist_hand_support_resilience: ['control_stability', 'force_tissue_capacity'],
  slow_eccentric_isometric_joint_resilience: ['force_tissue_capacity', 'control_stability'],
}

const TENETS_BY_SUBROLE = {
  landing_braking_control: ['body_control', 'coordination'],
  single_leg_balance_foot_ankle_hip_control: ['balance', 'body_control'],
  trunk_pelvis_anti_movement_control: ['body_control'],
  scapular_wrist_hand_support_resilience: ['body_control', 'strength'],
  slow_eccentric_isometric_joint_resilience: ['strength', 'body_control'],
}

export function slugForControl(name) {
  return SLUG_OVERRIDES[name] ?? slugify(name)
}

/** Full movement rows for seed generator */
export function buildControlMovements() {
  return CONTROL_TOP50.map((row) => {
    const slug = slugForControl(row.name)
    const d = { ...DEFAULTS_BY_SUBROLE[row.subrole], ...DOSAGE_OVERRIDES[slug] }
    const equip = EQUIP_OVERRIDES[slug] ?? d.equip
    const pattern = PATTERN_OVERRIDES[slug] ?? d.pattern
    const focus = row.name.split(' / ')[0].split(' — ')[0]
    return {
      ...row,
      slug,
      family: FAMILY_BY_SUBROLE[row.subrole],
      desc: `Resilience drill: ${row.name}. Precision work — own positions, absorb force, and maintain alignment under low-to-moderate stress.`,
      focus,
      joints: row.subrole.includes('single_leg') || row.slot.includes('single_leg') ? ['hip_flexion', 'ankle_plantarflexion'] : ['multi_joint'],
      tenets: TENETS_BY_SUBROLE[row.subrole],
      methods: METHODS_BY_SUBROLE[row.subrole],
      phys: PHYS_BY_SUBROLE[row.subrole],
      pattern,
      equip,
      body: d.body,
      sets: d.sets,
      reps: d.reps,
      work: d.work,
      rest: d.rest,
      est: d.est,
      unit: d.unit,
      distance: d.distance ?? null,
      impact: d.impact,
      skill: d.skill,
      ageMin: 6,
      dailyOk: DAILY_OK_SLUGS.has(slug),
      setup: ['Clear space and explain the control goal', 'Confirm pain-free range and appropriate supervision for youth'],
      steps: ['Set braced posture and controlled tempo', 'Complete prescribed reps, holds, or sticks with clean alignment', 'Rest fully before the next set'],
      cues: ['Own the position', 'Stay aligned', 'Quality over speed or volume'],
      faults: ['Rushing reps', 'Loss of alignment', 'Breath-holding or rib flare'],
    }
  })
}

export const CONTROL_MOVEMENTS = buildControlMovements()
export const CONTROL_SLUGS = CONTROL_MOVEMENTS.map((m) => m.slug)
