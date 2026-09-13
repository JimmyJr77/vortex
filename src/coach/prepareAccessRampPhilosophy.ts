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
    goal: 'Express explosive movement, build full-body strength, then practice appropriate body control.',
    examples: 'Explosiveness → Strength → Body Control / Tumbling. Movement intelligence and resilience are embedded; conditioning is optional and must preserve readiness for tumbling.',
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
    goal: 'Rehearse muscle actions and support positions needed for the upcoming work.',
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
export const RAMP_PHILOSOPHY_INTRO = `RAMP describes Raise → Activate → Mobilize → Potentiate. Vortex retains a familiar preparation sequence that helps athletes access useful positions, coordinate movement and progressively rehearse the upcoming task without fatigue. Activate and Mobilize can overlap within a drill.`

/** Why Vortex reorders Mobilize before Activate. */
export const VORTEX_ORDER_RATIONALE = `Vortex uses Mobilize before Activate as a consistent coaching sequence: explore comfortable range, rehearse support and force positions, then integrate movement. This is an organizational choice, not a claim that muscles cannot activate before mobility work. Multiple preparation purposes can be met in one drill.`

/** Expanded variants coaches may see elsewhere. */
export const RAMP_VARIANTS_NOTE = `Vortex uses Raise → Mobilize → Activate → Integrate → Potentiate Bridge. Integrate adds purposeful crawling, skipping and movement coordination. The bridge consists of a position rehearsal and a progressive version of today's explosive task. These are preparation purposes within the allotted 10 or 15 minutes, not five extra timed blocks.`

/** Who benefits most from Potentiate Bridge. */
export const POTENTIATE_BRIDGE_AUDIENCE =
  'The bridge is especially valuable for American Ninja Warrior training, sprinting, gymnastics, football, tactical athletes, parkour, and high-performance youth athletes.'
