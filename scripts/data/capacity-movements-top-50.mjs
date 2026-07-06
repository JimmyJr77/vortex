/**
 * Top 50 Capacity phase movement candidates (JSON-lite + seed metadata).
 * Consumed by scripts/generate-121-capacity-seed.mjs
 */

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[–—/]/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** @type {Array<{ number: number, name: string, subrole: string, slot: string }>} */
export const CAPACITY_TOP50 = [
  { number: 1, name: 'Goblet Squat', subrole: 'squat_knee_dominant_strength', slot: 'squat_strength' },
  { number: 2, name: 'Box Squat', subrole: 'squat_knee_dominant_strength', slot: 'squat_regression' },
  { number: 3, name: 'Front Squat — DB / KB / Barbell', subrole: 'squat_knee_dominant_strength', slot: 'front_loaded_squat' },
  { number: 4, name: 'Split Squat', subrole: 'squat_knee_dominant_strength', slot: 'split_stance_strength' },
  { number: 5, name: 'Rear-Foot-Elevated Split Squat', subrole: 'squat_knee_dominant_strength', slot: 'split_stance_strength' },
  { number: 6, name: 'Reverse Lunge', subrole: 'squat_knee_dominant_strength', slot: 'lunge_strength' },
  { number: 7, name: 'Step-Up', subrole: 'squat_knee_dominant_strength', slot: 'step_up_strength' },
  { number: 8, name: 'Lateral Lunge — Loaded', subrole: 'squat_knee_dominant_strength', slot: 'frontal_plane_strength' },
  { number: 9, name: 'Loaded Cossack Squat', subrole: 'squat_knee_dominant_strength', slot: 'frontal_plane_strength' },
  { number: 10, name: 'Heavy Sled Push / Sled Drive March', subrole: 'squat_knee_dominant_strength', slot: 'loaded_drive_strength' },
  { number: 11, name: 'Kettlebell Deadlift / Trap-Bar Deadlift', subrole: 'hinge_posterior_chain_strength', slot: 'deadlift_strength' },
  { number: 12, name: 'Romanian Deadlift', subrole: 'hinge_posterior_chain_strength', slot: 'hinge_strength' },
  { number: 13, name: 'Single-Leg Romanian Deadlift', subrole: 'hinge_posterior_chain_strength', slot: 'single_leg_hinge' },
  { number: 14, name: 'Hip Thrust / Loaded Glute Bridge', subrole: 'hinge_posterior_chain_strength', slot: 'hip_extension_strength' },
  { number: 15, name: 'Good Morning — Light / Technical', subrole: 'hinge_posterior_chain_strength', slot: 'hinge_strength' },
  { number: 16, name: 'Hamstring Slider Curl', subrole: 'hinge_posterior_chain_strength', slot: 'hamstring_capacity' },
  { number: 17, name: 'Nordic Hamstring Eccentric', subrole: 'hinge_posterior_chain_strength', slot: 'hamstring_eccentric' },
  { number: 18, name: 'Back Extension / Hip Extension', subrole: 'hinge_posterior_chain_strength', slot: 'posterior_chain_capacity' },
  { number: 19, name: 'Incline Push-Up', subrole: 'upper_body_push_strength', slot: 'pushup_regression' },
  { number: 20, name: 'Push-Up', subrole: 'upper_body_push_strength', slot: 'horizontal_push_strength' },
  { number: 21, name: 'Tempo / Eccentric Push-Up', subrole: 'upper_body_push_strength', slot: 'push_eccentric' },
  { number: 22, name: 'Dumbbell / Kettlebell Floor Press', subrole: 'upper_body_push_strength', slot: 'horizontal_push_strength' },
  { number: 23, name: 'Dumbbell Bench Press', subrole: 'upper_body_push_strength', slot: 'horizontal_push_strength' },
  { number: 24, name: 'Half-Kneeling Single-Arm Press', subrole: 'upper_body_push_strength', slot: 'vertical_push_strength' },
  { number: 25, name: 'Pike Push-Up / Box Pike Push-Up', subrole: 'upper_body_push_strength', slot: 'inverted_push_strength' },
  { number: 26, name: 'Dip Support / Ring Support Hold', subrole: 'upper_body_push_strength', slot: 'support_strength' },
  { number: 27, name: 'Ring Row / TRX Row', subrole: 'pull_hang_grip_strength', slot: 'horizontal_pull_strength' },
  { number: 28, name: 'Inverted Row', subrole: 'pull_hang_grip_strength', slot: 'horizontal_pull_strength' },
  { number: 29, name: 'One-Arm Dumbbell Row', subrole: 'pull_hang_grip_strength', slot: 'single_arm_pull_strength' },
  { number: 30, name: 'Band / Cable Row', subrole: 'pull_hang_grip_strength', slot: 'row_strength' },
  { number: 31, name: 'Assisted Pull-Up', subrole: 'pull_hang_grip_strength', slot: 'vertical_pull_progression' },
  { number: 32, name: 'Eccentric Pull-Up / Chin-Up Negative', subrole: 'pull_hang_grip_strength', slot: 'vertical_pull_eccentric' },
  { number: 33, name: 'Pull-Up / Chin-Up', subrole: 'pull_hang_grip_strength', slot: 'vertical_pull_strength' },
  { number: 34, name: 'Scapular Pull-Up', subrole: 'pull_hang_grip_strength', slot: 'scapular_pull_strength' },
  { number: 35, name: 'Dead Hang / Active Hang', subrole: 'pull_hang_grip_strength', slot: 'hang_grip_capacity' },
  { number: 36, name: 'Rope Climb Foot-Lock Pull / Towel Pull', subrole: 'pull_hang_grip_strength', slot: 'climb_grip_strength' },
  { number: 37, name: 'Farmer Carry', subrole: 'carry_trunk_loaded_bracing_strength', slot: 'loaded_carry' },
  { number: 38, name: 'Suitcase Carry', subrole: 'carry_trunk_loaded_bracing_strength', slot: 'anti_lateral_flexion_carry' },
  { number: 39, name: 'Front-Rack Carry', subrole: 'carry_trunk_loaded_bracing_strength', slot: 'front_loaded_carry' },
  { number: 40, name: 'Bear-Hug Sandbag Carry', subrole: 'carry_trunk_loaded_bracing_strength', slot: 'loaded_carry' },
  { number: 41, name: 'Zercher Carry', subrole: 'carry_trunk_loaded_bracing_strength', slot: 'front_loaded_carry' },
  { number: 42, name: 'Overhead Carry', subrole: 'carry_trunk_loaded_bracing_strength', slot: 'overhead_carry' },
  { number: 43, name: 'Pallof Press / Pallof Hold', subrole: 'carry_trunk_loaded_bracing_strength', slot: 'anti_rotation_strength' },
  { number: 44, name: 'Tall-Kneeling Cable / Band Chop', subrole: 'carry_trunk_loaded_bracing_strength', slot: 'rotational_trunk_strength' },
  { number: 45, name: 'Spanish Squat Isometric', subrole: 'tissue_capacity_isometric_eccentric_accessory', slot: 'quad_tendon_capacity' },
  { number: 46, name: 'Split Squat Isometric Hold', subrole: 'tissue_capacity_isometric_eccentric_accessory', slot: 'split_stance_isometric' },
  { number: 47, name: 'Copenhagen Plank — Short Lever', subrole: 'tissue_capacity_isometric_eccentric_accessory', slot: 'adductor_capacity' },
  { number: 48, name: 'Tibialis Raise', subrole: 'tissue_capacity_isometric_eccentric_accessory', slot: 'shin_capacity' },
  { number: 49, name: 'Seated Soleus Raise / Bent-Knee Calf Raise', subrole: 'tissue_capacity_isometric_eccentric_accessory', slot: 'soleus_capacity' },
  { number: 50, name: 'Wrist / Forearm Capacity Series', subrole: 'tissue_capacity_isometric_eccentric_accessory', slot: 'wrist_forearm_capacity' },
]

const FAMILY_BY_SUBROLE = {
  squat_knee_dominant_strength: 'Squat / Knee-Dominant Strength',
  hinge_posterior_chain_strength: 'Hinge / Posterior-Chain Strength',
  upper_body_push_strength: 'Upper-Body Push Strength',
  pull_hang_grip_strength: 'Upper-Body Pull, Hang & Grip Strength',
  carry_trunk_loaded_bracing_strength: 'Carry / Trunk / Loaded-Bracing Strength',
  tissue_capacity_isometric_eccentric_accessory: 'Tissue Capacity: Isometric, Eccentric & Accessory Strength',
}

const DEFAULTS_BY_SUBROLE = {
  squat_knee_dominant_strength: { sets: 3, reps: 8, work: null, rest: 90, est: 45, unit: 'reps', impact: 2, skill: 'INTERMEDIATE', pattern: 'squat', equip: 'kettlebell', body: 'lower_body' },
  hinge_posterior_chain_strength: { sets: 3, reps: 8, work: null, rest: 90, est: 45, unit: 'reps', impact: 2, skill: 'INTERMEDIATE', pattern: 'hinge', equip: 'bar', body: 'lower_body' },
  upper_body_push_strength: { sets: 3, reps: 8, work: null, rest: 90, est: 40, unit: 'reps', impact: 1, skill: 'INTERMEDIATE', pattern: 'push', equip: 'none', body: 'upper_body' },
  pull_hang_grip_strength: { sets: 3, reps: 8, work: null, rest: 90, est: 40, unit: 'reps', impact: 1, skill: 'INTERMEDIATE', pattern: 'pull', equip: 'none', body: 'upper_body' },
  carry_trunk_loaded_bracing_strength: { sets: 3, reps: null, work: 30, rest: 60, est: 35, unit: 'seconds', impact: 2, skill: 'INTERMEDIATE', pattern: 'carry', equip: 'dumbbell', body: 'full_body' },
  tissue_capacity_isometric_eccentric_accessory: { sets: 3, reps: null, work: 20, rest: 45, est: 30, unit: 'seconds', impact: 1, skill: 'BEGINNER', pattern: 'squat', equip: 'none', body: 'lower_body' },
}

const EQUIP_OVERRIDES = {
  'goblet-squat': 'kettlebell',
  'box-squat': 'box',
  'front-squat-db-kb-barbell': 'bar',
  'split-squat': 'dumbbell',
  'rear-foot-elevated-split-squat': 'dumbbell',
  'reverse-lunge': 'dumbbell',
  'step-up': 'box',
  'lateral-lunge-loaded': 'dumbbell',
  'loaded-cossack-squat': 'kettlebell',
  'heavy-sled-push-sled-drive-march': 'sled',
  'kettlebell-deadlift-trap-bar-deadlift': 'bar',
  'romanian-deadlift': 'bar',
  'single-leg-romanian-deadlift': 'dumbbell',
  'hip-thrust-loaded-glute-bridge': 'bar',
  'good-morning-light-technical': 'bar',
  'hamstring-slider-curl': 'mat',
  'nordic-hamstring-eccentric': 'mat',
  'back-extension-hip-extension': 'none',
  'incline-push-up': 'box',
  'push-up': 'none',
  'tempo-eccentric-push-up': 'none',
  'dumbbell-kettlebell-floor-press': 'dumbbell',
  'dumbbell-bench-press': 'dumbbell',
  'half-kneeling-single-arm-press': 'dumbbell',
  'pike-push-up-box-pike-push-up': 'box',
  'dip-support-ring-support-hold': 'rings',
  'ring-row-trx-row': 'rings',
  'inverted-row': 'bar',
  'one-arm-dumbbell-row': 'dumbbell',
  'band-cable-row': 'bands',
  'assisted-pull-up': 'bands',
  'eccentric-pull-up-chin-up-negative': 'none',
  'pull-up-chin-up': 'none',
  'scapular-pull-up': 'none',
  'dead-hang-active-hang': 'none',
  'rope-climb-foot-lock-pull-towel-pull': 'none',
  'farmer-carry': 'dumbbell',
  'suitcase-carry': 'dumbbell',
  'front-rack-carry': 'kettlebell',
  'bear-hug-sandbag-carry': 'none',
  'zercher-carry': 'bar',
  'overhead-carry': 'dumbbell',
  'pallof-press-pallof-hold': 'bands',
  'tall-kneeling-cable-band-chop': 'bands',
  'spanish-squat-isometric': 'bands',
  'split-squat-isometric-hold': 'none',
  'copenhagen-plank-short-lever': 'mat',
  'tibialis-raise': 'none',
  'seated-soleus-raise-bent-knee-calf-raise': 'none',
  'wrist-forearm-capacity-series': 'none',
}

const PATTERN_OVERRIDES = {
  'heavy-sled-push-sled-drive-march': 'locomote',
  'single-leg-romanian-deadlift': 'hinge',
  'hamstring-slider-curl': 'hinge',
  'nordic-hamstring-eccentric': 'hinge',
  'back-extension-hip-extension': 'hinge',
  'pike-push-up-box-pike-push-up': 'invert',
  'dip-support-ring-support-hold': 'hang',
  'dead-hang-active-hang': 'hang',
  'rope-climb-foot-lock-pull-towel-pull': 'pull',
  'pallof-press-pallof-hold': 'brace',
  'tall-kneeling-cable-band-chop': 'rotate',
  'spanish-squat-isometric': 'squat',
  'split-squat-isometric-hold': 'squat',
  'copenhagen-plank-short-lever': 'brace',
  'tibialis-raise': 'squat',
  'seated-soleus-raise-bent-knee-calf-raise': 'squat',
  'wrist-forearm-capacity-series': 'push',
}

const SKILL_OVERRIDES = {
  'box-squat': 'BEGINNER',
  'incline-push-up': 'BEGINNER',
  'assisted-pull-up': 'BEGINNER',
  'hamstring-slider-curl': 'BEGINNER',
  'nordic-hamstring-eccentric': 'ADVANCED',
  'pull-up-chin-up': 'ADVANCED',
  'overhead-carry': 'ADVANCED',
}

const DOSAGE_OVERRIDES = {
  'nordic-hamstring-eccentric': { sets: 3, reps: 5, work: null, rest: 120, unit: 'reps' },
  'eccentric-pull-up-chin-up-negative': { sets: 3, reps: 5, work: null, rest: 120, unit: 'reps' },
  'tempo-eccentric-push-up': { sets: 3, reps: 6, work: null, rest: 90, unit: 'reps' },
  'dip-support-ring-support-hold': { sets: 3, reps: null, work: 20, rest: 60, unit: 'seconds' },
  'dead-hang-active-hang': { sets: 3, reps: null, work: 20, rest: 60, unit: 'seconds' },
  'rope-climb-foot-lock-pull-towel-pull': { sets: 3, reps: null, work: 20, rest: 60, unit: 'seconds' },
  'tibialis-raise': { sets: 3, reps: 15, work: null, rest: 45, unit: 'reps' },
  'seated-soleus-raise-bent-knee-calf-raise': { sets: 3, reps: 15, work: null, rest: 45, unit: 'reps' },
  'wrist-forearm-capacity-series': { sets: 3, reps: 12, work: null, rest: 45, unit: 'reps' },
}

const METHODS_BY_SUBROLE = {
  squat_knee_dominant_strength: ['resistance_calisthenics'],
  hinge_posterior_chain_strength: ['resistance_calisthenics'],
  upper_body_push_strength: ['resistance_calisthenics'],
  pull_hang_grip_strength: ['resistance_calisthenics'],
  carry_trunk_loaded_bracing_strength: ['resistance_calisthenics'],
  tissue_capacity_isometric_eccentric_accessory: ['isometrics', 'eccentric_negative'],
}

const METHOD_OVERRIDES = {
  'tempo-eccentric-push-up': ['resistance_calisthenics', 'eccentric_negative'],
  'nordic-hamstring-eccentric': ['resistance_calisthenics', 'eccentric_negative'],
  'eccentric-pull-up-chin-up-negative': ['resistance_calisthenics', 'eccentric_negative'],
  'hamstring-slider-curl': ['resistance_calisthenics', 'eccentric_negative'],
}

const PHYS_BY_SUBROLE = {
  squat_knee_dominant_strength: ['force_tissue_capacity'],
  hinge_posterior_chain_strength: ['force_tissue_capacity'],
  upper_body_push_strength: ['force_tissue_capacity'],
  pull_hang_grip_strength: ['force_tissue_capacity'],
  carry_trunk_loaded_bracing_strength: ['control_stability', 'force_tissue_capacity'],
  tissue_capacity_isometric_eccentric_accessory: ['force_tissue_capacity'],
}

const TENETS_BY_SUBROLE = {
  squat_knee_dominant_strength: ['strength'],
  hinge_posterior_chain_strength: ['strength'],
  upper_body_push_strength: ['strength'],
  pull_hang_grip_strength: ['strength', 'grip'],
  carry_trunk_loaded_bracing_strength: ['strength', 'body_control'],
  tissue_capacity_isometric_eccentric_accessory: ['strength'],
}

const TENET_OVERRIDES = {
  'single-leg-romanian-deadlift': ['strength', 'balance'],
  'rear-foot-elevated-split-squat': ['strength', 'balance'],
  'step-up': ['strength', 'balance'],
  'overhead-carry': ['strength', 'balance', 'body_control'],
  'rope-climb-foot-lock-pull-towel-pull': ['strength', 'grip'],
  'dead-hang-active-hang': ['strength', 'grip'],
}

/** Full movement rows for seed generator */
export function buildCapacityMovements() {
  return CAPACITY_TOP50.map((row) => {
    const slug = slugify(row.name)
    const d = { ...DEFAULTS_BY_SUBROLE[row.subrole], ...DOSAGE_OVERRIDES[slug] }
    const equip = EQUIP_OVERRIDES[slug] ?? d.equip
    const pattern = PATTERN_OVERRIDES[slug] ?? d.pattern
    const skill = SKILL_OVERRIDES[slug] ?? d.skill
    const focus = row.name.split(' / ')[0].split(' — ')[0]
    const methods = METHOD_OVERRIDES[slug] ?? METHODS_BY_SUBROLE[row.subrole]
    const phys = PHYS_BY_SUBROLE[row.subrole]
    const tenets = TENET_OVERRIDES[slug] ?? TENETS_BY_SUBROLE[row.subrole]
    return {
      ...row,
      slug,
      family: FAMILY_BY_SUBROLE[row.subrole],
      desc: `Capacity-phase drill: ${row.name}. Progressive overload with full rest between sets.`,
      focus,
      joints: ['multi_joint'],
      tenets,
      methods,
      phys,
      pattern,
      equip,
      body: d.body,
      sets: d.sets,
      reps: d.reps,
      work: d.work,
      rest: d.rest,
      est: d.est,
      unit: d.unit,
      impact: d.impact,
      skill,
      ageMin: 8,
      setup: ['Select load and space appropriate to skill level', 'Confirm athlete is pain-free and supervised for youth'],
      steps: ['Set braced posture and controlled tempo', 'Complete prescribed reps or hold time with clean technique', 'Rest fully before the next set'],
      cues: ['Control the eccentric', 'Stay braced through trunk', 'Add load only when reps stay crisp'],
      faults: ['Grinding reps', 'Collapsed posture', 'Short rest between sets'],
    }
  })
}

export const CAPACITY_MOVEMENTS = buildCapacityMovements()
