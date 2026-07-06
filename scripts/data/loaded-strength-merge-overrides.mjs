/**
 * Trainer-reviewed merge rules for Capacity cards that overlap migration 121 slugs.
 * Preserves multi-modal coaching where the existing card is more accurate;
 * enriches with new source quality gates, scaling, safety, and scoring notes.
 */

export const MERGE_SLUGS = new Set([
  'goblet-squat',
  'romanian-deadlift',
  'zercher-carry',
  'front-rack-carry',
  'dumbbell-bench-press',
  'one-arm-dumbbell-row',
])

/** Barbell box-squat is split to a new slug; generic box-squat stays untouched. */
export const BARBELL_BOX_SQUAT_RENAME = { from: 'box-squat', to: 'barbell-box-squat' }

function mergeExec(existing, incoming) {
  const exec = { ...incoming }
  if (existing.movement_description) exec.movement_description = existing.movement_description
  if (existing.setup?.length) exec.setup = existing.setup
  if (existing.execution_steps?.length) exec.execution_steps = existing.execution_steps
  if (existing.coach_cues?.length) exec.coach_cues = existing.coach_cues
  if (existing.athlete_cues?.length) exec.athlete_cues = existing.athlete_cues
  if (existing.breathing_cues?.length) exec.breathing_cues = existing.breathing_cues
  // Enrich with incoming quality gates when present
  if (incoming.quality_gate?.length) exec.quality_gate = incoming.quality_gate
  if (incoming.stop_signs?.length) exec.stop_signs = incoming.stop_signs
  if (existing.common_faults?.length) {
    exec.common_faults = [...new Set([...existing.common_faults, ...(incoming.common_faults ?? [])])]
  }
  return exec
}

function mergeEquipment(existingTags, incomingTags) {
  const byKey = new Map((incomingTags ?? []).map((t) => [t.key, { ...t }]))
  for (const t of existingTags ?? []) {
    if (!byKey.has(t.key)) byKey.set(t.key, { ...t })
    else byKey.set(t.key, { key: t.key, weight: Math.max(byKey.get(t.key).weight, t.weight) })
  }
  return [...byKey.values()]
}

function mergePairing(existing, incoming) {
  return {
    pairsWellBefore: existing.pairsWellBefore ?? incoming.pairsWellBefore ?? [],
    pairsWellAfter: existing.pairsWellAfter ?? incoming.pairsWellAfter ?? [],
    goodForSessions: existing.goodForSessions ?? incoming.goodForSessions ?? [],
    avoidBefore: existing.avoidBefore ?? incoming.avoidBefore ?? [],
    avoidAfter: existing.avoidAfter ?? incoming.avoidAfter ?? [],
    doNotUseWhen: [...new Set([...(incoming.doNotUseWhen ?? []), ...(existing.doNotUseWhen ?? [])])],
  }
}

const EXISTING = {
  'goblet-squat': {
    description:
      'The athlete holds a kettlebell or dumbbell at the chest, sets feet shoulder-width, braces the trunk, and squats to controlled depth with knees tracking over toes.',
    cardSummary:
      'Foundational Capacity squat pattern using a front-loaded kettlebell or dumbbell to teach depth, trunk bracing, and progressive lower-body strength.',
    coachLanguage:
      'Use as the foundational Capacity squat. Progressive overload with full rest — not a warm-up fluff set or circuit finisher. Add load only when every rep stays crisp.',
    athleteLanguage:
      'Hold the weight at your chest, brace your core, sit between your hips, and stand up strong.',
    family: 'Squat / knee-dominant strength',
    slot: 'squat_strength',
    equipment: [
      { key: 'kettlebell', weight: 5 },
      { key: 'dumbbell', weight: 4 },
    ],
    coachingExecution: {
      movement_description:
        'Hold kettlebell or dumbbell at chest, brace trunk, squat to controlled depth with knees tracking toes, and stand without losing posture.',
      setup: [
        'Select kettlebell or dumbbell load appropriate to skill.',
        'Feet shoulder-width, toes slightly out.',
        'Elbows down, weight close to chest.',
        'Confirm pain-free range and supervision for youth.',
      ],
      execution_steps: [
        'Brace trunk and set neutral spine.',
        'Sit hips down and back together.',
        'Keep knees tracking over mid-foot.',
        'Reach controlled depth without butt wink or collapse.',
        'Drive through full foot to stand.',
        'Rest fully before the next set.',
      ],
      coach_cues: ['Elbows down.', 'Ribs down.', 'Knees out.', 'Full foot pressure.', 'Control the descent.'],
      athlete_cues: ['Brace.', 'Sit down.', 'Push the floor.', 'Stand tall.'],
      breathing_cues: [
        'Big breath and brace at the top — exhale through the sticking point if needed without losing brace.',
      ],
      common_faults: [
        'Weight drifting away from chest.',
        'Heels rising early.',
        'Knees collapsing inward.',
        'Excessive forward lean or lumbar flexion at bottom.',
        'Rushing reps with short rest.',
        'Using weight beyond clean rep capacity.',
      ],
    },
    pairing: {
      pairsWellBefore: ['Box Squat', 'Air Squat — Skill pattern', 'Glute Bridge', 'Mini-Band Hip Activation'],
      pairsWellAfter: ['Front Squat — DB / KB / Barbell', 'Split Squat', 'Romanian Deadlift', 'Farmer Carry'],
      goodForSessions: ['capacity_lower_body', 'squat_capacity', 'strength_development'],
      avoidBefore: ['Max velocity sprints in same session if heavy squat block precedes Output', 'Front squat if goblet depth is poor'],
      doNotUseWhen: ['Knee pain with loaded squat', 'Cannot control knee valgus', 'Using as conditioning circuit', 'Youth max load without supervision'],
    },
    mediaInternalNotes: [
      'Validator should confirm bilateral squat competency before front squat or RFESS.',
      'Keep Strength as the primary tenet.',
    ],
    phaseProfile: { role: 'primary', technical_complexity: 2, notes: 'Foundational Capacity squat. Master before front squat and heavy unilateral progressions. Supervision: recommended.' },
  },

  'romanian-deadlift': {
    description:
      'The athlete starts standing with load at hips, pushes hips back with soft knees, lowers load along the thighs to hamstring stretch, and returns by driving hips forward while maintaining neutral spine.',
    cardSummary:
      'Capacity Romanian deadlift emphasizing controlled eccentric hip hinge, hamstring length under load, and posterior-chain strength through partial ROM deadlift pattern.',
    coachLanguage:
      'Use for hamstring and glute strength with intentional eccentric control and full rest. Capacity RDL is not a stiff-leg deadlift race or Fitness AMRAP.',
    athleteLanguage: 'Soft knees, push your hips back, feel your hamstrings stretch, and drive your hips forward to stand.',
    family: 'Hinge / posterior-chain strength',
    slot: 'hinge_strength',
    equipment: [
      { key: 'barbell', weight: 5 },
      { key: 'dumbbell', weight: 4 },
      { key: 'kettlebell', weight: 3 },
    ],
    movementRequirements: {
      prerequisites: ['kettlebell-deadlift-trap-bar-deadlift'],
    },
    coachingExecution: {
      movement_description:
        'Standing hinge with soft knees, load tracks close to legs, controlled eccentric to hamstring stretch, hip drive to stand with neutral spine.',
      setup: [
        'Select barbell, dumbbells, or kettlebells based on skill.',
        'Start from hang position at hip height.',
        'Feet hip-width, soft knees.',
        'Confirm deadlift hinge competency first.',
      ],
      execution_steps: [
        'Brace trunk and set neutral spine.',
        'Push hips back with soft knees.',
        'Slide load down thighs — shins stay relatively vertical.',
        'Stop at hamstring stretch without lumbar rounding.',
        'Drive hips forward to stand tall.',
        'Rest fully between sets.',
      ],
      coach_cues: ['Hips back.', 'Bar close.', 'Soft knees.', 'Feel hamstrings.', 'Hips through.'],
      athlete_cues: ['Back.', 'Close.', 'Stretch.', 'Drive.'],
      common_faults: [
        'Lumbar rounding to reach floor.',
        'Bar drifting away from legs.',
        'Bending knees into squat pattern.',
        'Bouncing at bottom.',
        'Rushing eccentric — no tempo control.',
        'Prescribing before deadlift competency.',
      ],
    },
    pairing: {
      pairsWellBefore: ['Kettlebell Deadlift / Trap-Bar Deadlift', 'Glute Bridge', 'Hamstring Slider Curl'],
      pairsWellAfter: ['Single-Leg Romanian Deadlift', 'Good Morning — Light / Technical', 'Hip Thrust / Loaded Glute Bridge'],
      goodForSessions: ['capacity_lower_body', 'hinge_capacity', 'strength_development'],
      doNotUseWhen: ['Low back pain with loaded hinge', 'No deadlift competency', 'Lumbar rounds every rep', 'Used as conditioning circuit'],
    },
    phaseProfile: { role: 'primary', fatigue_sensitivity: 4, fatigue_cost: 4, technical_complexity: 3, notes: 'Requires deadlift hinge competency. Emphasize eccentric control — 3-second lowering is default. Supervision: recommended.' },
  },

  'zercher-carry': {
    description:
      'The athlete holds a barbell, axle, or sandbag in the crooks of the elbows, braces, and walks while keeping the load close to the torso and posture tall.',
    cardSummary:
      'Anterior-loaded carry held in the crooks of the elbows that builds trunk stiffness, upper-back strength, posture, and front-loaded bracing capacity.',
    coachLanguage:
      'Use as an advanced front-loaded carry after bear-hug and front-rack carry competency. Pad the bar if needed and keep the load close — moderate-to-high intensity with full rest.',
    athleteLanguage: 'Hold the bar in your elbows, keep it close, brace your trunk, and walk tall.',
    family: 'Carry / trunk / loaded bracing',
    slot: 'front_loaded_carry',
    equipment: [
      { key: 'barbell', weight: 5 },
      { key: 'sandbag', weight: 3 },
      { key: 'axle_bar', weight: 3 },
    ],
    phaseProfile: { role: 'conditional', technical_complexity: 4, notes: 'Advanced anterior carry. High upper-back and trunk demand. Elbow crease comfort must be managed. Supervision: recommended_when_heavy.' },
    scaling: {
      youth_beginner: 'Use bear-hug ball/sandbag carry instead.',
      youth_intermediate: 'Light sandbag Zercher-style carry, short distance.',
    },
  },

  'front-rack-carry': {
    description:
      'The athlete holds one or two kettlebells or dumbbells in the front-rack position and walks while keeping the ribs down, elbows organized, and trunk stiff.',
    cardSummary:
      'Anterior-loaded carry that builds trunk stiffness, upper-back capacity, front-rack posture, and breathing under load.',
    coachLanguage:
      'Use when the athlete needs front-loaded posture, core bracing, and upper-back strength. Great bridge to front squat and loaded carries — not a high-rep burnout walk.',
    athleteLanguage: 'Hold the weights in the front rack, keep ribs down, elbows steady, and walk tall.',
    family: 'Carry / trunk / loaded bracing',
    slot: 'front_loaded_carry',
    equipment: [
      { key: 'kettlebell', weight: 5 },
      { key: 'dumbbell', weight: 5 },
    ],
    coachingExecution: {
      movement_description: 'Front-rack load at chest, ribs down, elbows organized, controlled walk without lean-back, set down safely.',
      setup: [
        'Clean or safely place weights into front rack.',
        'Elbows slightly forward or down based on implement.',
        'Ribs stacked over pelvis.',
        'Feet under hips.',
        'Brace before walking.',
      ],
    },
    pairing: {
      pairsWellBefore: ['Front Squat — DB/KB/Barbell', 'Bear-Hug Sandbag Carry', 'Farmer Carry', 'Goblet Squat'],
      pairsWellAfter: ['Zercher Carry', 'Goblet Squat', 'Farmer Carry', 'Dead Bug'],
    },
    phaseProfile: { role: 'primary', fit_weight: 4, fatigue_cost: 5, technical_complexity: 4 },
  },

  'dumbbell-bench-press': {
    description:
      'The athlete lies on a flat bench with dumbbells at chest level, presses to full extension with controlled path, and lowers under tempo with feet planted and braced trunk.',
    cardSummary:
      'Capacity dumbbell bench press that builds horizontal pressing strength through full ROM with independent arm demand and trunk stability on a stable bench.',
    coachLanguage:
      'Use for loaded horizontal push with intentional load and full rest. Supervise bench setup — not a max-effort powerlifting bench or Fitness circuit with short rest.',
    athleteLanguage:
      'Feet planted, back braced, press the dumbbells up, lower with control, and keep your shoulders packed.',
    family: 'Upper-body push strength',
    slot: 'horizontal_push_strength',
    movementRequirements: {
      prerequisites: ['dumbbell-kettlebell-floor-press'],
    },
    coachingExecution: {
      movement_description:
        'Supine on bench, dumbbells at chest, press to full extension with controlled path, lower under tempo with braced trunk and feet planted.',
      setup: [
        'Select dumbbell load appropriate to skill.',
        'Sit on bench, dumbbells on thighs, lie back safely.',
        'Feet flat, slight arch only — ribs controlled.',
        'Confirm floor press or push-up competency first.',
      ],
      execution_steps: [
        'Set shoulder blades retracted and down.',
        'Start dumbbells at chest with wrists stacked.',
        'Press to full extension without shrugging.',
        'Lower under control to chest level.',
        'Keep elbows at roughly 45° from torso.',
        'Rerack safely and rest fully between sets.',
      ],
    },
    pairing: {
      pairsWellBefore: ['Dumbbell / Kettlebell Floor Press', 'Push-Up', 'Scapular Push-Up'],
      pairsWellAfter: ['Half-Kneeling Single-Arm Press', 'Pike Push-Up / Box Pike Push-Up'],
      doNotUseWhen: ['No floor press or push-up competency', 'Unsafe bench setup', 'Shoulder pinching at bottom', 'Used as metcon with short rest'],
    },
    phaseProfile: { role: 'primary', technical_complexity: 3, notes: 'Requires floor press or push-up competency. Supervise dumbbell bench setup and rerack. Supervision: recommended.' },
  },

  'one-arm-dumbbell-row': {
    description:
      'The athlete supports one hand and knee on a bench, holds a dumbbell in the opposite hand with flat braced back, pulls elbow toward hip or ribs without torso rotation, squeezes at top, and lowers with control.',
    cardSummary:
      'Unilateral dumbbell row that builds lat, upper-back, grip, trunk, and shoulder-control capacity.',
    coachLanguage:
      'Use for single-arm pulling strength, left-right balance, and upper-back capacity without requiring hanging strength. Full rest between sets — not alternating-arm conditioning.',
    athleteLanguage:
      'Support your body, keep your back flat, pull your elbow toward your hip, and lower the weight with control.',
    family: 'Upper-body pull, hang & grip strength',
    slot: 'single_arm_pull_strength',
    equipment: [
      { key: 'dumbbell', weight: 5 },
      { key: 'kettlebell', weight: 3 },
      { key: 'bench', weight: 4 },
    ],
    coachingExecution: {
      movement_description:
        'Bench-supported single-arm row: flat braced back, pull elbow toward hip without trunk rotation, control eccentric.',
    },
    pairing: {
      pairsWellBefore: ['Ring Row / TRX Row', 'Inverted Row', 'Band / Cable Row'],
      pairsWellAfter: ['Assisted Pull-Up', 'Band / Cable Row', 'Dead Hang / Active Hang'],
    },
    phaseProfile: { role: 'primary', fit_weight: 4, notes: 'Useful unilateral pull when hanging or pull-up progressions are too difficult or grip-limited. Supervision: recommended.' },
  },
}

/**
 * @param {string} slug
 * @param {object} incoming - normalized source card
 * @returns {object} merged card with _action: 'merge'
 */
export function mergeCard(slug, incoming) {
  const base = EXISTING[slug]
  if (!base) return { ...incoming, _action: 'merge' }

  const merged = {
    ...incoming,
    _action: 'merge',
    description: base.description ?? incoming.description,
    cardSummary: base.cardSummary ?? incoming.cardSummary,
    coachLanguage: base.coachLanguage ?? incoming.coachLanguage,
    athleteLanguage: base.athleteLanguage ?? incoming.athleteLanguage,
    family: base.family ?? incoming.family,
    slot: base.slot ?? incoming.slot,
    primary_order_slot: base.slot ?? incoming.slot,
    equipment: mergeEquipment(base.equipment, incoming.equipment),
    coachingExecution: mergeExec(base.coachingExecution ?? {}, incoming.coachingExecution ?? {}),
    movementRequirements: {
      ...(incoming.movementRequirements ?? {}),
      ...(base.movementRequirements ?? {}),
      prerequisites: base.movementRequirements?.prerequisites ?? incoming.movementRequirements?.prerequisites,
    },
    phaseProfile: { ...(incoming.phaseProfile ?? {}), ...(base.phaseProfile ?? {}) },
    scaling: { ...(incoming.scaling ?? {}), ...(base.scaling ?? {}) },
  }

  if (incoming.scoringNotes) merged.scoringNotes = incoming.scoringNotes

  // Dosage: prefer incoming rest/RPE when stronger for strength work
  merged.dosage = {
    ...(incoming.dosage ?? {}),
    default_rest_seconds: Math.max(incoming.dosage?.default_rest_seconds ?? 90, 90),
  }

  const pairingFlat = mergePairing(base.pairing ?? {}, incoming)
  merged.pairsWellBefore = pairingFlat.pairsWellBefore
  merged.pairsWellAfter = pairingFlat.pairsWellAfter
  merged.goodForSessions = pairingFlat.goodForSessions
  merged.avoidBefore = pairingFlat.avoidBefore
  merged.doNotUseWhen = pairingFlat.doNotUseWhen

  if (base.mediaInternalNotes) {
    merged.mediaInternalNotes = [...new Set([...(incoming.mediaInternalNotes ?? []), ...base.mediaInternalNotes])]
  }

  // Enrich front-rack-carry with barbell progression note from barbell source when present
  if (slug === 'front-rack-carry' && incoming.coachLanguage?.includes('barbell')) {
    merged.coachLanguage = `${base.coachLanguage} Progress to barbell front-rack carry only after KB/DB rack posture is clean.`
  }

  return merged
}
