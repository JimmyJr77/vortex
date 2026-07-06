/**
 * Top 50 Output phase movement candidates (JSON-lite + seed metadata).
 * Consumed by scripts/generate-111-output-seed.mjs
 */

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[–—/]/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** @type {Array<{ number: number, name: string, subrole: string, slot: string }>} */
export const OUTPUT_TOP50 = [
  { number: 1, name: 'Falling Start to 5–10 Yard Sprint', subrole: 'acceleration_start_speed', slot: 'acceleration_start' },
  { number: 2, name: 'Two-Point Start to 5–10 Yard Sprint', subrole: 'acceleration_start_speed', slot: 'acceleration_start' },
  { number: 3, name: 'Three-Point Start Acceleration', subrole: 'acceleration_start_speed', slot: 'acceleration_start' },
  { number: 4, name: 'Half-Kneeling Start Sprint', subrole: 'acceleration_start_speed', slot: 'start_variation' },
  { number: 5, name: 'Push-Up / Prone Start Sprint', subrole: 'acceleration_start_speed', slot: 'start_variation' },
  { number: 6, name: 'Lateral Start to Sprint Breakout', subrole: 'acceleration_start_speed', slot: 'multidirectional_start' },
  { number: 7, name: 'Backpedal to Sprint Turn', subrole: 'acceleration_start_speed', slot: 'multidirectional_start' },
  { number: 8, name: 'Partner Chase Acceleration', subrole: 'acceleration_start_speed', slot: 'chase_acceleration' },
  { number: 9, name: 'Light Sled Sprint / Band-Resisted Acceleration', subrole: 'acceleration_start_speed', slot: 'resisted_acceleration' },
  { number: 10, name: 'Low-Incline Hill Sprint Acceleration', subrole: 'acceleration_start_speed', slot: 'hill_acceleration' },
  { number: 11, name: 'Build-Up Sprint / Stride-Out', subrole: 'max_velocity_exposure', slot: 'sprint_exposure' },
  { number: 12, name: 'Flying 10', subrole: 'max_velocity_exposure', slot: 'flying_sprint' },
  { number: 13, name: 'Flying 20', subrole: 'max_velocity_exposure', slot: 'flying_sprint' },
  { number: 14, name: 'Sprint-Float-Sprint', subrole: 'max_velocity_exposure', slot: 'speed_change' },
  { number: 15, name: 'Ins-and-Outs', subrole: 'max_velocity_exposure', slot: 'speed_change' },
  { number: 16, name: 'Wicket Runs', subrole: 'max_velocity_exposure', slot: 'wicket_rhythm' },
  { number: 17, name: 'Mini-Hurdle Sprint Rhythm', subrole: 'max_velocity_exposure', slot: 'wicket_rhythm' },
  { number: 18, name: 'Curved Sprint / Arc Run', subrole: 'max_velocity_exposure', slot: 'curved_sprint' },
  { number: 19, name: 'Fast Low Pogos', subrole: 'elastic_stiffness_plyometric_rudiments', slot: 'elastic_ankle' },
  { number: 20, name: 'Forward / Backward Pogos', subrole: 'elastic_stiffness_plyometric_rudiments', slot: 'elastic_ankle' },
  { number: 21, name: 'Lateral Line Hops', subrole: 'elastic_stiffness_plyometric_rudiments', slot: 'lateral_elastic' },
  { number: 22, name: 'Single-Leg Pogo Hold-to-Hop', subrole: 'elastic_stiffness_plyometric_rudiments', slot: 'single_leg_elastic' },
  { number: 23, name: 'Snap-Down to Stick', subrole: 'elastic_stiffness_plyometric_rudiments', slot: 'landing_to_output' },
  { number: 24, name: 'Snap-Down to Rebound', subrole: 'elastic_stiffness_plyometric_rudiments', slot: 'landing_to_output' },
  { number: 25, name: 'Drop Landing to Stick', subrole: 'elastic_stiffness_plyometric_rudiments', slot: 'drop_landing' },
  { number: 26, name: 'Depth Drop to Rebound', subrole: 'elastic_stiffness_plyometric_rudiments', slot: 'drop_rebound' },
  { number: 27, name: 'Hurdle Hop Series — Low Hurdles', subrole: 'elastic_stiffness_plyometric_rudiments', slot: 'repeated_elastic_hop' },
  { number: 28, name: 'Countermovement Vertical Jump', subrole: 'jump_throw_explosive_power', slot: 'vertical_jump_power' },
  { number: 29, name: 'Squat Jump', subrole: 'jump_throw_explosive_power', slot: 'vertical_jump_power' },
  { number: 30, name: 'Broad Jump to Stick', subrole: 'jump_throw_explosive_power', slot: 'horizontal_jump_power' },
  { number: 31, name: 'Single Broad Jump to Rebound', subrole: 'jump_throw_explosive_power', slot: 'horizontal_jump_power' },
  { number: 32, name: 'Lateral Bound to Stick', subrole: 'jump_throw_explosive_power', slot: 'lateral_jump_power' },
  { number: 33, name: 'Skater Bound Continuous', subrole: 'jump_throw_explosive_power', slot: 'lateral_jump_power' },
  { number: 34, name: 'Split Jump / Scissor Jump', subrole: 'jump_throw_explosive_power', slot: 'split_jump_power' },
  { number: 35, name: 'Medicine Ball Chest Pass', subrole: 'jump_throw_explosive_power', slot: 'upper_body_power' },
  { number: 36, name: 'Medicine Ball Overhead Slam', subrole: 'jump_throw_explosive_power', slot: 'total_body_power' },
  { number: 37, name: 'Medicine Ball Rotational Scoop Toss', subrole: 'jump_throw_explosive_power', slot: 'rotational_power' },
  { number: 38, name: 'Medicine Ball Shot-Put Throw', subrole: 'jump_throw_explosive_power', slot: 'rotational_power' },
  { number: 39, name: 'Sprint to Stick Deceleration', subrole: 'deceleration_cod_power', slot: 'linear_deceleration' },
  { number: 40, name: '5-Yard Accel to Decel Stick', subrole: 'deceleration_cod_power', slot: 'linear_deceleration' },
  { number: 41, name: 'Lateral Bound to Decel Stick', subrole: 'deceleration_cod_power', slot: 'lateral_deceleration' },
  { number: 42, name: 'Pro-Agility 5-10-5 Technical Rep', subrole: 'deceleration_cod_power', slot: 'cod_power' },
  { number: 43, name: '90-Degree Cut Drill', subrole: 'deceleration_cod_power', slot: 'cod_power' },
  { number: 44, name: '180-Degree Turn / Shuttle Cut', subrole: 'deceleration_cod_power', slot: 'cod_power' },
  { number: 45, name: 'Curved Run to Cut', subrole: 'deceleration_cod_power', slot: 'curved_to_cut' },
  { number: 46, name: 'Reactive Gate Sprint', subrole: 'reactive_agility_tumbling_output', slot: 'reactive_sprint' },
  { number: 47, name: 'Mirror Shuffle to Sprint Exit', subrole: 'reactive_agility_tumbling_output', slot: 'reactive_agility_output' },
  { number: 48, name: 'Ball Drop Sprint Catch', subrole: 'reactive_agility_tumbling_output', slot: 'object_reaction_output' },
  { number: 49, name: 'Power Hurdle to Cartwheel / Round-Off Entry', subrole: 'reactive_agility_tumbling_output', slot: 'tumbling_takeoff_output' },
  { number: 50, name: 'Round-Off Rebound / Snap-Down to Stick', subrole: 'reactive_agility_tumbling_output', slot: 'tumbling_rebound_output' },
]

const FAMILY_BY_SUBROLE = {
  acceleration_start_speed: 'Acceleration & start speed',
  max_velocity_exposure: 'Max-velocity exposure',
  elastic_stiffness_plyometric_rudiments: 'Elastic stiffness / plyometric rudiments',
  jump_throw_explosive_power: 'Jump, throw & explosive power',
  deceleration_cod_power: 'Deceleration / change-of-direction power',
  reactive_agility_tumbling_output: 'Reactive agility & tumbling output',
}

const DEFAULTS_BY_SUBROLE = {
  acceleration_start_speed: { sets: 4, reps: 1, work: null, rest: 90, est: 25, unit: 'reps', impact: 3, skill: 'INTERMEDIATE', pattern: 'locomote', equip: 'none', body: 'full_body' },
  max_velocity_exposure: { sets: 4, reps: 1, work: null, rest: 120, est: 30, unit: 'reps', impact: 4, skill: 'INTERMEDIATE', pattern: 'locomote', equip: 'none', body: 'full_body' },
  elastic_stiffness_plyometric_rudiments: { sets: 3, reps: 10, work: null, rest: 45, est: 25, unit: 'contacts', impact: 2, skill: 'BEGINNER', pattern: 'jump', equip: 'none', body: 'full_body' },
  jump_throw_explosive_power: { sets: 4, reps: 3, work: null, rest: 60, est: 20, unit: 'reps', impact: 3, skill: 'INTERMEDIATE', pattern: 'jump', equip: 'none', body: 'full_body' },
  deceleration_cod_power: { sets: 4, reps: 1, work: null, rest: 75, est: 25, unit: 'reps', impact: 3, skill: 'INTERMEDIATE', pattern: 'locomote', equip: 'none', body: 'full_body' },
  reactive_agility_tumbling_output: { sets: 4, reps: 1, work: null, rest: 60, est: 25, unit: 'reps', impact: 3, skill: 'INTERMEDIATE', pattern: 'locomote', equip: 'none', body: 'full_body' },
}

const EQUIP_OVERRIDES = {
  'light-sled-sprint-band-resisted-acceleration': 'sled',
  'low-incline-hill-sprint-acceleration': 'none',
  'wicket-runs': 'cones',
  'mini-hurdle-sprint-rhythm': 'low_hurdles',
  'hurdle-hop-series-low-hurdles': 'low_hurdles',
  'medicine-ball-chest-pass': 'medicine_ball',
  'medicine-ball-overhead-slam': 'medicine_ball',
  'medicine-ball-rotational-scoop-toss': 'medicine_ball',
  'medicine-ball-shot-put-throw': 'medicine_ball',
  'power-hurdle-to-cartwheel-round-off-entry': 'mat',
  'round-off-rebound-snap-down-to-stick': 'mat',
}

/** Full movement rows for seed generator */
export function buildOutputMovements() {
  return OUTPUT_TOP50.map((row) => {
    const slug = slugify(row.name)
    const d = DEFAULTS_BY_SUBROLE[row.subrole]
    const equip = EQUIP_OVERRIDES[slug] ?? d.equip
    const focus = row.name.split(' / ')[0]
    return {
      ...row,
      slug,
      family: FAMILY_BY_SUBROLE[row.subrole],
      desc: `Output-phase drill: ${row.name}. Express force quickly with high intent and full recovery.`,
      focus,
      joints: ['multi_joint'],
      tenets: ['speed', 'explosiveness', 'coordination'],
      methods: ['neural', 'plyometrics'],
      phys: ['neural_output_readiness', 'ssc_stiffness'],
      pattern: d.pattern,
      equip,
      body: d.body,
      sets: d.sets,
      reps: d.reps,
      work: d.work,
      rest: d.rest,
      est: d.est,
      unit: d.unit,
      impact: d.impact,
      skill: d.skill,
      ageMin: 8,
      setup: ['Clear sprint lane or mat space', 'Confirm athlete is fresh and pain-free'],
      steps: ['Set up with crisp posture and intent', 'Execute one high-quality rep', 'Reset fully before the next rep'],
      cues: ['Fast and sharp', 'Stick the landing or finish', 'Quality over volume'],
      faults: ['Speed drops', 'Sloppy mechanics', 'Short rest between reps'],
    }
  })
}

export const OUTPUT_MOVEMENTS = buildOutputMovements()
export const OUTPUT_SLUGS = OUTPUT_MOVEMENTS.map((m) => m.slug)
