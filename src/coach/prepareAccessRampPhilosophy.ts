/**
 * Coach-facing RAMP / Prepare–Access sequence philosophy.
 * Rendered in FrameworkPanel (Philosophy tab) and referenced in EXERCISE_CARD_SPEC.
 */

export const VORTEX_PREPARE_SEQUENCE = [
  'Raise',
  'Mobilize',
  'Activate',
  'Integrate',
  'Potentiate Bridge',
] as const

export const VORTEX_SESSION_PROGRESSION = [
  {
    stage: 'Raise',
    goal: 'Elevate heart rate and body temperature.',
    examples: 'Light jog, jump rope, bike, skipping, carioca, marches, light movement games.',
  },
  {
    stage: 'Mobilize',
    goal: 'Dynamic mobility through ankles, hips, thoracic spine, shoulders, and wrists.',
    examples: 'World\'s Greatest Stretch, leg swings, hip openers, T-spine rotation, ankle dorsiflexion, deep squat pry.',
  },
  {
    stage: 'Activate',
    goal: 'Prime glutes, core, scapular stabilizers, feet, and posterior chain.',
    examples: 'Glute bridge, mini-band lateral walks, dead bug, bird dog, scapular push-up, plank variations, single-leg balance.',
  },
  {
    stage: 'Integrate',
    goal: 'Reinforce efficient movement patterns using locomotion, coordination, balance, and sprint mechanics.',
    examples: 'Crawls, single-leg balance reaches, bear crawl, lateral shuffles, skip progressions, marches, sprint drills.',
  },
  {
    stage: 'Potentiate Bridge',
    goal: 'Progressively faster, more elastic, and reactive drills before maximal output.',
    examples: 'Fast skips, pogos, ankling, straight-leg bounds, low hurdle hops, sprint build-ups, snap-down prep.',
  },
  {
    stage: 'Performance Work',
    goal: 'Express skill, speed, power, strength, or conditioning at session intent.',
    examples: 'Movement Intelligence, Output (sprinting, jumping, tumbling), Capacity, Resilience, Sustained Capacity — then Restore.',
  },
] as const

export const ORIGINAL_RAMP_PHASES = [
  {
    letter: 'R',
    name: 'Raise',
    goal: 'Increase physiological readiness — heart rate, core temperature, blood flow, respiration, nervous system activity.',
    examples: 'Light jog, jump rope, bike, skipping, carioca, marches, light movement games.',
  },
  {
    letter: 'A',
    name: 'Activate',
    goal: 'Wake up muscles that need to contribute — commonly inhibited stabilizers.',
    examples: 'Glute bridge, mini-band lateral walks, dead bug, bird dog, scapular push-up, plank variations, single-leg balance.',
  },
  {
    letter: 'M',
    name: 'Mobilize',
    goal: 'Improve usable movement through required ranges — dynamic mobility, not static stretching.',
    examples: 'World\'s Greatest Stretch, leg swings, hip openers, T-spine rotation, walking lunges with rotation, deep squat pry, ankle dorsiflexion.',
  },
  {
    letter: 'P',
    name: 'Potentiate',
    goal: 'Prepare the nervous system for explosive or sport-specific performance; intensity ramps toward the session.',
    examples: 'Accelerations, broad jumps, vertical jumps, med ball throws, bounding, short sprints, Olympic lift derivatives, fast agility drills.',
  },
] as const

/** Short intro shown above the Prepare & Access subrole list in Philosophy. */
export const RAMP_PHILOSOPHY_INTRO = `RAMP is a widely accepted warm-up framework developed by Ian Jeffreys and used across collegiate athletics, professional sports, military performance, and elite strength & conditioning. The original acronym is Raise → Activate → Mobilize → Potentiate — note that Activate comes before Mobilize in Jeffreys' model.`

/** Why Vortex reorders Mobilize before Activate. */
export const VORTEX_ORDER_RATIONALE = `Vortex deliberately runs Mobilize before Activate. For athletic development, tumbling, and Ninja-style movement, usable joint range through the ankles, hips, spine, shoulders, and wrists should be accessible before we ask stabilizers to fire in integrated positions. Activate still belongs before high-intent work — it simply follows mobility access in our sequence.`

/** Expanded variants coaches may see elsewhere. */
export const RAMP_VARIANTS_NOTE = `Many coaches expand RAMP because Activate and Mobilize often happen together. You may see Raise → Mobilize → Activate → Integrate → Potentiate, or Raise → Release → Activate → Mobilize → Potentiate. Integrate means: take newly activated muscles and improved mobility and teach the body to coordinate them — crawls, balance reaches, skip progressions, sprint patterning. Vortex includes Integrate explicitly and adds Potentiate Bridge — a low-stress ramp from warm-up into Skill and Output without the abrupt jump to maximal effort.`

/** Who benefits most from Potentiate Bridge. */
export const POTENTIATE_BRIDGE_AUDIENCE =
  'The bridge is especially valuable for American Ninja Warrior training, sprinting, gymnastics, football, tactical athletes, parkour, and high-performance youth athletes.'
