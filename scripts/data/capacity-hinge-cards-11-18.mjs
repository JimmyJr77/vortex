/**
 * Rich card v2 content for Capacity phase Hinge / Posterior-Chain Strength cards 11–18.
 * Consumed by scripts/generate-123-capacity-hinge-cards.mjs
 * UPDATE-only on slugs seeded in migration 121.
 */

const GENDER_DEFAULT =
  'No default sex-based adjustment. Scale by movement quality, load tolerance, goals, and symptoms rather than gender alone.'

const SUBROLE = 'hinge_posterior_chain_strength'
const FAMILY = 'Hinge / posterior-chain strength'

const CLUSTER_MISUSE =
  'Capacity builds strength reserve with intentional load, controlled reps, and full rest — not Prepare warm-up fluff, Output speed work, Fitness circuits, or Control isometric holds.'

const SCALING_BASE = {
  youth_beginner:
    'Bodyweight hip hinge or light kettlebell deadlift only; coach-supervised; stop on back pain, hamstring cramping, or loss of trunk brace.',
  youth_intermediate:
    'Conservative load with full rest between sets; prioritize hinge mechanics and bracing over chasing weight.',
  teen: 'Progress load or reps only when hinge pattern and lumbar control stay clean; earn unilateral and barbell progressions after bilateral competency.',
  adult_beginner: 'Start light with tempo control; master kettlebell deadlift or glute bridge before advanced barbell hinge work.',
  adult_advanced: 'Can progress load, tempo pause, or unilateral demand when mechanics stay crisp across all reps.',
  older_adult: 'Prefer trap bar, supported hip thrust, or reduced ROM; moderate load with generous rest.',
  pregnancy_postpartum:
    'Scale ROM and load by trimester and symptoms; avoid max intent and heavy spinal loading unless cleared.',
}

const SETUP_COMMON = [
  'Clear floor space for hinge and deadlift patterns',
  'Load appropriate to athlete skill and session intent',
  'Stable bench or box for hip thrust and supported patterns',
  'Slider, towel, or Nordic pad setup when hamstring work requires it',
]

/** @param {Record<string, unknown>} c */
function card(c) {
  return {
    family: FAMILY,
    subrole: SUBROLE,
    genderSpecificNotes: GENDER_DEFAULT,
    goodForSessions: ['capacity_lower_body', 'hinge_capacity', 'strength_development'],
    scaling: { ...SCALING_BASE, ...(c.scalingOverrides ?? {}) },
    ...c,
  }
}

/** @type {import('./foundation-access-cards-1-10.mjs').FoundationCard[]} */
export const CAPACITY_HINGE_CARDS = [
  card({
    slug: 'kettlebell-deadlift-trap-bar-deadlift',
    name: 'Kettlebell Deadlift / Trap-Bar Deadlift',
    slot: 'deadlift_strength',
    cardSummary:
      'Foundational Capacity hip-hinge deadlift using kettlebell, trap bar, dumbbell, or barbell to build posterior-chain force, bracing, and progressive lower-body strength.',
    bestPlacement:
      'Primary entry in deadlift_strength after Output; before heavy RDL, good morning, or unilateral hinge when bilateral deadlift mechanics and bracing are still developing.',
    description:
      'The athlete sets feet hip-width, braces the trunk, hinges at the hips to grip the load, and stands by driving hips forward while keeping a neutral spine and full foot pressure.',
    coachLanguage:
      'Use as the foundational Capacity deadlift. Progressive overload with full rest — not a warm-up fluff set or circuit finisher. Add load only when every rep stays crisp.',
    athleteLanguage: 'Brace your core, push your hips back, grip the weight, and stand tall by driving your hips forward.',
    tenets: [
      { key: 'strength', weight: 5 },
      { key: 'body_control', weight: 5 },
      { key: 'coordination', weight: 3 },
    ],
    methodologies: [
      { key: 'resistance_calisthenics', weight: 5 },
      { key: 'core_body_control', weight: 5 },
      { key: 'eccentric_negative', weight: 2 },
    ],
    physiology: [
      { key: 'force_tissue_capacity', weight: 5 },
      { key: 'control_stability', weight: 4 },
    ],
    patterns: [
      { key: 'hinge', weight: 5 },
      { key: 'brace', weight: 5 },
    ],
    equipment: [
      { key: 'kettlebell', weight: 5 },
      { key: 'trap_bar', weight: 5 },
      { key: 'dumbbell', weight: 3 },
      { key: 'barbell', weight: 4 },
    ],
    body_regions: [
      { key: 'hip', weight: 5 },
      { key: 'hamstring', weight: 5 },
      { key: 'glute', weight: 5 },
      { key: 'spine', weight: 4 },
      { key: 'core', weight: 5 },
    ],
    whyItWorks:
      'The deadlift pattern loads the entire posterior chain — glutes, hamstrings, and erectors — through a hip hinge with trunk bracing. Kettlebell and trap-bar options reduce technical barrier while building force capacity that supports sprinting, jumping, landing, and lifting.',
    whyItGoesHere:
      'Belongs in deadlift_strength (421) — foundational Capacity bilateral hinge before RDL, good morning, or heavy unilateral patterns.',
    commonMisuse: `${CLUSTER_MISUSE} Do not use as a high-rep conditioning drill, max-youth load without supervision, or substitute when athlete cannot maintain neutral spine and hip hinge.`,
    scalingGuidance:
      'Regress to hip hinge drill or elevated trap-bar pull; progress load or barbell only when lumbar control and hip drive stay clean. Hypermobility athletes need active brace — no passive spinal hang.',
    movementRequirements: {
      primary_joint_actions: ['hip_hinge', 'hip_extension', 'knee_flexion', 'knee_extension'],
      primary_tissues: ['glutes', 'hamstrings', 'erectors', 'core'],
      breathing_demand: 'nasal',
      balance_demand: 'stable',
      impact_level: 0,
      prerequisites: [],
    },
    setupRequirements: [...SETUP_COMMON],
    coachingExecution: {
      movement_description:
        'Brace trunk, hinge at hips to grip load with neutral spine, drive hips forward to stand without lumbar rounding or early knee shoot.',
      setup: [
        'Select kettlebell, trap bar, dumbbell, or barbell based on skill.',
        'Feet hip-width, bar or KB between mid-foot.',
        'Confirm pain-free range and supervision for youth.',
        'Use trap bar or KB for beginners before straight barbell.',
      ],
      execution_steps: [
        'Brace trunk and set neutral spine.',
        'Push hips back and hinge to grip load.',
        'Keep shins relatively vertical on KB/trap bar pulls.',
        'Drive through full foot and extend hips to stand.',
        'Finish tall without hyperextending lumbar spine.',
        'Lower under control and rest fully before the next set.',
      ],
      breathing_cues: ['Big breath and brace before pull — maintain pressure through the rep without losing neutral spine.'],
      coach_cues: ['Hips back.', 'Chest proud.', 'Push the floor.', 'Hips through.', 'Control the descent.'],
      athlete_cues: ['Brace.', 'Hinge.', 'Drive hips.', 'Stand tall.'],
      common_faults: [
        'Lumbar rounding at setup or pull.',
        'Bar drifting away from body on barbell pulls.',
        'Squatting the movement instead of hinging.',
        'Hyperextending at lockout.',
        'Rushing reps with short rest.',
        'Using weight beyond clean rep capacity.',
      ],
      stop_signs: [
        'Sharp low back pain during pull.',
        'Hamstring cramping that breaks form.',
        'Cannot maintain neutral spine under load.',
        'Dizziness or breath-holding valsalva at inappropriate load.',
        'Youth attempting max loads without supervision.',
      ],
    },
    dosage: {
      volume_unit: 'reps',
      default_sets: 3,
      default_reps: 5,
      default_rest_seconds: 120,
      est_seconds_per_set: 45,
      tempo: '2-0-1-0',
      default_rpe_min: 5,
      default_rpe_max: 8,
      session_volume_min: 10,
      session_volume_max: 30,
    },
    phaseProfile: {
      role: 'primary',
      fit_weight: 5,
      freshness_required: false,
      fatigue_sensitivity: 4,
      fatigue_cost: 5,
      technical_complexity: 3,
      impact_level: 0,
      intensity_ceiling: 'high',
      daily_ok: false,
      requires_supervision: 'recommended',
      notes: 'Foundational Capacity deadlift. Master before RDL, good morning, and heavy unilateral hinge progressions.',
    },
    scalingOverrides: {
      youth_beginner: 'Hip hinge drill or light KB deadlift with coach at side.',
      youth_intermediate: 'Light KB or trap-bar deadlift, 3 × 3–5 with full rest.',
      teen: 'Progress load when hinge and lumbar control stay clean.',
      adult_beginner: 'Trap bar or KB deadlift before straight barbell.',
      adult_advanced: 'Heavier trap bar or barbell with tempo pause progressions.',
      older_adult: 'Trap bar or moderate KB load with generous rest.',
      pregnancy_postpartum: 'Reduce load and ROM by symptoms; avoid max intent.',
    },
    pairsWellBefore: ['Glute Bridge', 'Hip Hinge — Skill pattern', 'Dead Bug', 'Mini-Band Hip Activation'],
    pairsWellAfter: ['Romanian Deadlift', 'Hip Thrust / Loaded Glute Bridge', 'Single-Leg Romanian Deadlift', 'Farmer Carry'],
    avoidBefore: ['Heavy RDL if deadlift hinge is poor', 'Max velocity sprints in same session if heavy deadlift block precedes Output'],
    doNotUseWhen: ['Low back pain with loaded hinge', 'Cannot maintain neutral spine', 'Using as conditioning circuit', 'Youth max load without supervision'],
    mediaReferences: ['NSCA deadlift coaching progressions', 'Trap bar deadlift teaching model for athletes'],
    mediaInternalNotes: ['Validator should confirm bilateral deadlift competency before RDL or good morning.'],
  }),
  card({
    slug: 'romanian-deadlift',
    name: 'Romanian Deadlift',
    slot: 'hinge_strength',
    cardSummary:
      'Capacity Romanian deadlift emphasizing controlled eccentric hip hinge, hamstring length under load, and posterior-chain strength through partial ROM deadlift pattern.',
    bestPlacement:
      'hinge_strength after kettlebell or trap-bar deadlift competency; before good morning or single-leg RDL when bilateral RDL mechanics are established.',
    description:
      'The athlete starts standing with load at hips, pushes hips back with soft knees, lowers load along the thighs to hamstring stretch, and returns by driving hips forward while maintaining neutral spine.',
    coachLanguage:
      'Use for hamstring and glute strength with intentional eccentric control and full rest. Capacity RDL is not a stiff-leg deadlift race or Fitness AMRAP.',
    athleteLanguage: 'Soft knees, push your hips back, feel your hamstrings stretch, and drive your hips forward to stand.',
    tenets: [
      { key: 'strength', weight: 5 },
      { key: 'body_control', weight: 5 },
      { key: 'flexibility', weight: 2 },
    ],
    methodologies: [
      { key: 'resistance_calisthenics', weight: 5 },
      { key: 'core_body_control', weight: 4 },
      { key: 'eccentric_negative', weight: 4 },
    ],
    physiology: [
      { key: 'force_tissue_capacity', weight: 5 },
      { key: 'control_stability', weight: 4 },
    ],
    patterns: [
      { key: 'hinge', weight: 5 },
      { key: 'brace', weight: 4 },
    ],
    equipment: [
      { key: 'barbell', weight: 5 },
      { key: 'dumbbell', weight: 4 },
      { key: 'kettlebell', weight: 3 },
    ],
    body_regions: [
      { key: 'hamstring', weight: 5 },
      { key: 'glute', weight: 5 },
      { key: 'hip', weight: 5 },
      { key: 'spine', weight: 4 },
      { key: 'core', weight: 4 },
    ],
    whyItWorks:
      'The RDL loads hamstrings and glutes through a hip hinge with emphasis on eccentric control and hamstring length under tension. It builds posterior-chain force capacity with less total-system demand than conventional deadlift from the floor when programmed with tempo and full rest.',
    whyItGoesHere:
      'Belongs in hinge_strength (422) — primary Capacity RDL after deadlift competency.',
    commonMisuse: `${CLUSTER_MISUSE} Do not round the back to chase depth, use as speed pull, or prescribe before deadlift hinge competency.`,
    scalingGuidance:
      'Regress to KB deadlift or dowel hip hinge; shorten ROM before reducing load if hamstring cramping dominates. Use 3-second eccentric before load jumps.',
    movementRequirements: {
      primary_joint_actions: ['hip_hinge', 'hip_extension', 'knee_flexion'],
      primary_tissues: ['hamstrings', 'glutes', 'erectors', 'core'],
      breathing_demand: 'nasal',
      balance_demand: 'stable',
      impact_level: 0,
      prerequisites: ['kettlebell-deadlift-trap-bar-deadlift'],
    },
    setupRequirements: [...SETUP_COMMON],
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
      breathing_cues: ['Brace at top — maintain trunk pressure through the eccentric.'],
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
      stop_signs: [
        'Sharp low back pain.',
        'Hamstring cramping that breaks form.',
        'Cannot control 3-second eccentric.',
        'Barbell RDL before KB/trap-bar deadlift mastery in youth.',
      ],
    },
    dosage: {
      volume_unit: 'reps',
      default_sets: 3,
      default_reps: 6,
      default_rest_seconds: 90,
      est_seconds_per_set: 50,
      tempo: '3-0-1-0',
      default_rpe_min: 6,
      default_rpe_max: 8,
      session_volume_min: 10,
      session_volume_max: 40,
    },
    phaseProfile: {
      role: 'primary',
      fit_weight: 5,
      freshness_required: false,
      fatigue_sensitivity: 4,
      fatigue_cost: 4,
      technical_complexity: 3,
      impact_level: 0,
      intensity_ceiling: 'moderate_to_high',
      daily_ok: false,
      requires_supervision: 'recommended',
      notes: 'Requires deadlift hinge competency. Emphasize eccentric control — 3-second lowering is default.',
    },
    scalingOverrides: {
      youth_beginner: 'KB deadlift or dowel hinge only — not barbell RDL.',
      youth_intermediate: 'Light DB or KB RDL with short ROM.',
      teen: 'DB RDL before barbell when lumbar control is clean.',
      adult_beginner: 'Light DB RDL with tempo before barbell.',
      adult_advanced: 'Heavier barbell RDL with pause at bottom.',
      older_adult: 'Short ROM DB RDL with generous rest.',
      pregnancy_postpartum: 'Reduce ROM and load by symptoms; avoid max intent.',
    },
    pairsWellBefore: ['Kettlebell Deadlift / Trap-Bar Deadlift', 'Glute Bridge', 'Hamstring Slider Curl'],
    pairsWellAfter: ['Single-Leg Romanian Deadlift', 'Good Morning — Light / Technical', 'Hip Thrust / Loaded Glute Bridge'],
    avoidBefore: ['RDL before deadlift hinge is clean', 'Nordic hamstring same session if hamstrings already fatigued'],
    doNotUseWhen: ['Low back pain with loaded hinge', 'No deadlift competency', 'Lumbar rounds every rep', 'Used as conditioning circuit'],
    mediaReferences: ['NSCA RDL technique', 'Hamstring length under load — RDL coaching cues'],
    mediaInternalNotes: ['Prerequisite kettlebell-deadlift-trap-bar-deadlift before barbell RDL in youth.'],
  }),
  card({
    slug: 'single-leg-romanian-deadlift',
    name: 'Single-Leg Romanian Deadlift',
    slot: 'single_leg_hinge',
    cardSummary:
      'Unilateral Capacity RDL that builds single-leg hamstring and glute strength, hip stability, and balance demand for sport deceleration and landing.',
    bestPlacement:
      'single_leg_hinge after bilateral RDL competency; before advanced single-leg loading when static hinge control on one leg is established.',
    description:
      'The athlete balances on one leg, hinges at the hip with soft knee while the trail leg extends behind, lowers load toward the floor under control, and returns to standing on the stance leg.',
    coachLanguage:
      'Use to build unilateral posterior-chain strength with intentional load and full rest. Not a speed balance drill or Fitness alternating circuit.',
    athleteLanguage: 'Stand on one leg, push your hip back, reach toward the floor, and drive your hip forward to stand tall.',
    tenets: [
      { key: 'strength', weight: 5 },
      { key: 'balance', weight: 5 },
      { key: 'body_control', weight: 5 },
      { key: 'coordination', weight: 3 },
    ],
    methodologies: [
      { key: 'resistance_calisthenics', weight: 5 },
      { key: 'balance_stability', weight: 5 },
      { key: 'eccentric_negative', weight: 4 },
    ],
    physiology: [
      { key: 'force_tissue_capacity', weight: 5 },
      { key: 'control_stability', weight: 5 },
    ],
    patterns: [
      { key: 'hinge', weight: 5 },
      { key: 'brace', weight: 3 },
    ],
    equipment: [
      { key: 'dumbbell', weight: 5 },
      { key: 'kettlebell', weight: 4 },
      { key: 'none', weight: 3 },
    ],
    body_regions: [
      { key: 'hamstring', weight: 5 },
      { key: 'glute', weight: 5 },
      { key: 'hip', weight: 5 },
      { key: 'core', weight: 4 },
      { key: 'ankle', weight: 3 },
    ],
    whyItWorks:
      'Single-leg RDL increases unilateral hamstring and glute demand while exposing balance and hip stability deficits that bilateral RDL can hide. It builds deceleration-relevant single-leg force capacity for landing, cutting, and sprint mechanics.',
    whyItGoesHere:
      'Belongs in single_leg_hinge (423) — unilateral Capacity hinge after bilateral RDL competency.',
    commonMisuse: `${CLUSTER_MISUSE} Do not prescribe before bilateral RDL control, allow trunk rotation every rep, or use short rest alternating sets as Fitness work.`,
    scalingGuidance:
      'Regress to supported SL RDL or bilateral RDL; add load only when hip stays square and trunk stays stable. Complete all reps one side before switching.',
    movementRequirements: {
      primary_joint_actions: ['hip_hinge', 'hip_extension', 'knee_flexion'],
      primary_tissues: ['hamstrings', 'glutes', 'hip_stabilizers', 'core'],
      breathing_demand: 'nasal',
      balance_demand: 'single_leg',
      impact_level: 0,
      prerequisites: ['romanian-deadlift'],
    },
    setupRequirements: [...SETUP_COMMON],
    coachingExecution: {
      movement_description:
        'Single-leg stance, hinge with soft knee, trail leg extends behind as counterbalance, load lowers under control, hip drives forward to stand.',
      setup: [
        'Select dumbbell or kettlebell appropriate to balance skill.',
        'Optional hand on wall or dowel for regression.',
        'Choose same-side or contralateral load based on coaching preference.',
        'Confirm bilateral RDL competency first.',
      ],
      execution_steps: [
        'Set stance leg soft knee and brace trunk.',
        'Push hip back — trail leg extends behind.',
        'Keep hips square to the floor.',
        'Lower to hamstring stretch without trunk rotation.',
        'Drive stance hip forward to stand.',
        'Complete prescribed reps per side with full rest.',
      ],
      breathing_cues: ['Brace before hinge — stay tight through single-leg balance.'],
      coach_cues: ['Hips square.', 'Long back leg.', 'Reach back.', 'Drive hip through.', 'Control the wobble.'],
      athlete_cues: ['Square.', 'Back.', 'Hinge.', 'Drive.'],
      common_faults: [
        'Trunk rotating open every rep.',
        'Stance knee collapsing inward.',
        'Reaching with load instead of hinging.',
        'Trail leg turning out excessively.',
        'Alternating reps with short rest for conditioning.',
        'Prescribing before bilateral RDL competency.',
      ],
      stop_signs: [
        'Hamstring cramping on stance leg.',
        'Low back pain under load.',
        'Repeated loss of balance without control.',
        'Hip pinching on descent.',
        'Cannot control eccentric on loaded reps.',
      ],
    },
    dosage: {
      volume_unit: 'reps',
      default_sets: 3,
      default_reps: 6,
      default_rest_seconds: 90,
      est_seconds_per_set: 55,
      tempo: '3-0-1-0',
      default_rpe_min: 6,
      default_rpe_max: 8,
      session_volume_min: 10,
      session_volume_max: 32,
    },
    phaseProfile: {
      role: 'primary',
      fit_weight: 5,
      freshness_required: false,
      fatigue_sensitivity: 4,
      fatigue_cost: 4,
      technical_complexity: 4,
      impact_level: 0,
      intensity_ceiling: 'moderate_to_high',
      daily_ok: false,
      requires_supervision: 'recommended',
      notes: 'Requires bilateral RDL competency. High balance demand — supervise load and regress to support when needed.',
    },
    scalingOverrides: {
      youth_beginner: 'Supported bodyweight SL hinge — not loaded SL RDL.',
      youth_intermediate: 'Bodyweight or light DB SL RDL with wall support.',
      teen: 'Light DB SL RDL after bilateral RDL mastery.',
      adult_beginner: 'Supported or bodyweight SL RDL before load.',
      adult_advanced: 'Heavy contralateral DB SL RDL with tempo pause.',
      older_adult: 'Supported SL RDL with conservative ROM.',
      pregnancy_postpartum: 'Reduce load and ROM; use support if balance is affected.',
    },
    pairsWellBefore: ['Romanian Deadlift', 'Split Squat', 'Single-Leg Balance Reach Clock'],
    pairsWellAfter: ['Rear-Foot-Elevated Split Squat', 'Reverse Lunge', 'Hamstring Slider Curl', 'Farmer Carry'],
    avoidBefore: ['SL RDL before bilateral RDL is clean', 'Nordic eccentric same session if hamstrings already taxed'],
    doNotUseWhen: ['No bilateral RDL competency', 'Trunk rotates every rep', 'Hamstring cramping under load', 'Used as balance conditioning circuit'],
    mediaReferences: ['NSCA unilateral hinge progressions', 'Single-leg RDL for athletic deceleration'],
    mediaInternalNotes: ['Prerequisite romanian-deadlift required. Flag if prescribed before bilateral RDL control.'],
  }),
  card({
    slug: 'hip-thrust-loaded-glute-bridge',
    name: 'Hip Thrust / Loaded Glute Bridge',
    slot: 'hip_extension_strength',
    cardSummary:
      'Capacity hip thrust or loaded glute bridge that builds maximal hip extension strength, glute force capacity, and posterior-chain drive with reduced spinal shear vs standing hinge.',
    bestPlacement:
      'hip_extension_strength after deadlift hinge base; pairs with RDL for full posterior-chain Capacity when glute-dominant hip extension is the priority.',
    description:
      'The athlete sets upper back on bench, loads hips with barbell or weight, drives through heels to full hip extension, squeezes glutes at top, and lowers under control.',
    coachLanguage:
      'Use for glute-dominant hip extension strength with intentional load and full rest. Supervise loaded barbell setup — not a high-rep glute burnout circuit.',
    athleteLanguage: 'Shoulders on the bench, feet planted, drive your hips up, squeeze your glutes, and lower under control.',
    tenets: [
      { key: 'strength', weight: 5 },
      { key: 'body_control', weight: 4 },
      { key: 'coordination', weight: 2 },
    ],
    methodologies: [
      { key: 'resistance_calisthenics', weight: 5 },
      { key: 'core_body_control', weight: 3 },
    ],
    physiology: [
      { key: 'force_tissue_capacity', weight: 5 },
      { key: 'control_stability', weight: 3 },
    ],
    patterns: [
      { key: 'hinge', weight: 5 },
      { key: 'brace', weight: 3 },
    ],
    equipment: [
      { key: 'barbell', weight: 5 },
      { key: 'bench', weight: 5 },
      { key: 'dumbbell', weight: 3 },
      { key: 'mat', weight: 2 },
    ],
    body_regions: [
      { key: 'glute', weight: 5 },
      { key: 'hip', weight: 5 },
      { key: 'hamstring', weight: 4 },
      { key: 'core', weight: 3 },
    ],
    whyItWorks:
      'Hip thrusts isolate hip extension with high glute activation and reduced spinal loading compared with standing hinges. They build horizontal force capacity relevant to sprint acceleration, jumping, and hip extension strength reserve.',
    whyItGoesHere:
      'Belongs in hip_extension_strength (424) — glute-dominant Capacity hip extension after hinge base.',
    commonMisuse: `${CLUSTER_MISUSE} Do not hyperextend lumbar at top, use as Fitness burnout reps, or load heavily without supervising barbell setup.`,
    scalingGuidance:
      'Regress to bodyweight or band glute bridge; progress barbell load only when full extension stays glute-driven without lumbar hyperextension. Pad bar for comfort.',
    movementRequirements: {
      primary_joint_actions: ['hip_extension', 'hip_flexion', 'knee_flexion', 'knee_extension'],
      primary_tissues: ['glutes', 'hamstrings', 'core'],
      breathing_demand: 'nasal',
      balance_demand: 'stable',
      impact_level: 0,
      prerequisites: ['kettlebell-deadlift-trap-bar-deadlift'],
    },
    setupRequirements: [...SETUP_COMMON, 'Stable bench that will not slide', 'Bar pad for loaded barbell hip thrust'],
    coachingExecution: {
      movement_description:
        'Upper back on bench, feet flat, load at hips, drive to full hip extension with glute squeeze, lower under control without lumbar hyperextension.',
      setup: [
        'Place stable bench for upper back support.',
        'Feet shoulder-width, shins vertical at top.',
        'Load barbell, dumbbell, or plate on hips.',
        'Supervise barbell setup and pad placement.',
      ],
      execution_steps: [
        'Set upper back on bench edge.',
        'Brace core and tuck chin slightly.',
        'Drive through heels to full hip extension.',
        'Squeeze glutes at top — ribs down.',
        'Lower under control without dropping hips.',
        'Rest fully between sets.',
      ],
      breathing_cues: ['Exhale through the top — do not arch the low back to finish the rep.'],
      coach_cues: ['Ribs down.', 'Heels down.', 'Squeeze glutes.', 'No back arch.', 'Control the drop.'],
      athlete_cues: ['Drive.', 'Squeeze.', 'Ribs down.', 'Lower slow.'],
      common_faults: [
        'Lumbar hyperextension at lockout.',
        'Feet too far forward or back.',
        'Bench sliding during set.',
        'Dropping hips on descent.',
        'High-rep burnout with short rest.',
        'Loaded barbell without supervision.',
      ],
      stop_signs: [
        'Low back pain at top or bottom.',
        'Cannot achieve extension without lumbar arch.',
        'Bench instability.',
        'Hip pinching at top.',
        'Bar discomfort without pad on loaded work.',
      ],
    },
    dosage: {
      volume_unit: 'reps',
      default_sets: 3,
      default_reps: 8,
      default_rest_seconds: 90,
      est_seconds_per_set: 45,
      tempo: '2-0-1-1',
      default_rpe_min: 6,
      default_rpe_max: 8,
      session_volume_min: 12,
      session_volume_max: 48,
    },
    phaseProfile: {
      role: 'primary',
      fit_weight: 4,
      freshness_required: false,
      fatigue_sensitivity: 3,
      fatigue_cost: 3,
      technical_complexity: 2,
      impact_level: 0,
      intensity_ceiling: 'moderate_to_high',
      daily_ok: false,
      requires_supervision: 'recommended_if_loaded',
      notes: 'Supervise loaded barbell hip thrust setup. Glute-dominant complement to RDL and deadlift.',
    },
    scalingOverrides: {
      youth_beginner: 'Bodyweight glute bridge only.',
      youth_intermediate: 'Bodyweight hip thrust with coach supervision.',
      teen: 'Light load hip thrust when extension stays glute-driven.',
      adult_beginner: 'Bodyweight or band hip thrust before barbell.',
      adult_advanced: 'Heavy barbell hip thrust with pause at top.',
      older_adult: 'Moderate load glute bridge with generous rest.',
      pregnancy_postpartum: 'Reduce load; monitor pelvic floor symptoms at top range.',
    },
    pairsWellBefore: ['Glute Bridge', 'Kettlebell Deadlift / Trap-Bar Deadlift', 'Romanian Deadlift'],
    pairsWellAfter: ['Heavy Sled Push / Sled Drive March', 'Single-Leg Romanian Deadlift', 'Back Extension / Hip Extension'],
    avoidBefore: ['Loaded barbell hip thrust without hinge base', 'Max velocity Output immediately after heavy hip thrust if fatigued'],
    doNotUseWhen: ['Low back pain with loaded extension', 'Lumbar hyperextends every rep', 'Unstable bench', 'Loaded barbell without supervision'],
    mediaReferences: ['NSCA hip thrust progressions', 'Glute bridge to hip thrust loading continuum'],
    mediaInternalNotes: ['Flag loaded barbell hip thrust without recommended_if_loaded supervision note.'],
  }),
  card({
    slug: 'good-morning-light-technical',
    name: 'Good Morning — Light / Technical',
    slot: 'hinge_strength',
    cardSummary:
      'Light, technical Capacity good morning for posterior-chain hinge awareness, erector endurance under load, and advanced hinge patterning — conservative load only.',
    bestPlacement:
      'hinge_strength after RDL competency; conditional use when athlete needs erector and hamstring hinge strength without heavy spinal compression from floor pulls.',
    description:
      'The athlete stands with light load on upper back, braces trunk, pushes hips back with soft knees, lowers torso to controlled hinge angle, and returns by driving hips forward while maintaining neutral spine.',
    coachLanguage:
      'Light and technical only — Capacity good morning is not a max-effort good morning or Fitness finisher. Earn with RDL competency and stay at moderate intensity.',
    athleteLanguage: 'Light weight on your back, push your hips back, bow forward with a flat back, and stand tall by driving your hips forward.',
    tenets: [
      { key: 'strength', weight: 4 },
      { key: 'body_control', weight: 5 },
      { key: 'coordination', weight: 3 },
    ],
    methodologies: [
      { key: 'resistance_calisthenics', weight: 4 },
      { key: 'core_body_control', weight: 5 },
      { key: 'eccentric_negative', weight: 3 },
    ],
    physiology: [
      { key: 'force_tissue_capacity', weight: 4 },
      { key: 'control_stability', weight: 5 },
    ],
    patterns: [
      { key: 'hinge', weight: 5 },
      { key: 'brace', weight: 5 },
    ],
    equipment: [
      { key: 'barbell', weight: 5 },
      { key: 'dumbbell', weight: 3 },
    ],
    body_regions: [
      { key: 'spine', weight: 5 },
      { key: 'hamstring', weight: 5 },
      { key: 'glute', weight: 4 },
      { key: 'hip', weight: 4 },
      { key: 'core', weight: 5 },
    ],
    whyItWorks:
      'The good morning trains the posterior chain — erectors, hamstrings, and glutes — through a loaded hip hinge with the load on the upper back. At light technical loads with full rest, it builds hinge awareness and erector capacity when RDL and deadlift patterns are already established.',
    whyItGoesHere:
      'Belongs in hinge_strength (422) — conditional Capacity good morning after RDL competency; moderate intensity ceiling only.',
    commonMisuse: `${CLUSTER_MISUSE} Do not load heavily, prescribe before RDL competency, or use as max-effort powerlifting good morning in youth or general athletic populations.`,
    scalingGuidance:
      'Stay light — regress to dowel or band good morning; shorten ROM before adding load. Discontinue if any low back pain appears.',
    movementRequirements: {
      primary_joint_actions: ['hip_hinge', 'hip_extension', 'spinal_flexion_control'],
      primary_tissues: ['erectors', 'hamstrings', 'glutes', 'core'],
      breathing_demand: 'nasal',
      balance_demand: 'stable',
      impact_level: 0,
      prerequisites: ['romanian-deadlift'],
    },
    setupRequirements: [...SETUP_COMMON, 'Light load only — barbell with conservative plates or dumbbell at chest'],
    coachingExecution: {
      movement_description:
        'Light load on upper back, brace trunk, hip hinge with neutral spine to controlled depth, drive hips forward to stand — moderate intensity only.',
      setup: [
        'Select very light barbell or dumbbell load.',
        'Feet hip-width, bar in back rack or DB at chest.',
        'Confirm RDL and deadlift hinge competency.',
        'Set conservative ROM target before first rep.',
      ],
      execution_steps: [
        'Unrack or lift light load into position.',
        'Brace ribs down and trunk tight.',
        'Push hips back with soft knees.',
        'Lower torso to controlled hinge angle — stop before lumbar rounds.',
        'Drive hips forward to stand tall.',
        'Rerack safely and rest fully between sets.',
      ],
      breathing_cues: ['Strong brace before hinge — maintain pressure without losing neutral spine.'],
      coach_cues: ['Light load only.', 'Hips back.', 'Flat back.', 'Stop before round.', 'Hips through.'],
      athlete_cues: ['Light.', 'Back.', 'Flat.', 'Drive.'],
      common_faults: [
        'Loading too heavy for technical intent.',
        'Lumbar rounding at bottom.',
        'Knees locking into stiff-leg pattern.',
        'Prescribing before RDL competency.',
        'Using as max-effort lift.',
        'Short rest turning it into conditioning.',
      ],
      stop_signs: [
        'Any low back pain during or after reps.',
        'Cannot maintain neutral spine at chosen ROM.',
        'Dizziness or excessive valsalva at light load.',
        'Youth athletes without RDL and deadlift base.',
        'Load exceeds moderate intensity ceiling.',
      ],
    },
    dosage: {
      volume_unit: 'reps',
      default_sets: 3,
      default_reps: 6,
      default_rest_seconds: 90,
      est_seconds_per_set: 45,
      tempo: '3-0-1-0',
      default_rpe_min: 5,
      default_rpe_max: 7,
      session_volume_min: 10,
      session_volume_max: 30,
    },
    phaseProfile: {
      role: 'conditional',
      fit_weight: 3,
      freshness_required: false,
      fatigue_sensitivity: 4,
      fatigue_cost: 3,
      technical_complexity: 4,
      impact_level: 0,
      intensity_ceiling: 'moderate',
      daily_ok: false,
      requires_supervision: 'recommended',
      notes: 'Conditional — light technical load only after RDL competency. Not a max-effort lift for general athletes.',
    },
    scalingOverrides: {
      youth_beginner: 'Not recommended — use hip hinge drill or KB deadlift.',
      youth_intermediate: 'Dowel good morning only with coach — no barbell load.',
      teen: 'Very light barbell good morning after RDL mastery only.',
      adult_beginner: 'Dowel or band good morning before any bar load.',
      adult_advanced: 'Light barbell good morning with tempo — still moderate ceiling.',
      older_adult: 'Band or dowel good morning; avoid heavy spinal loading.',
      pregnancy_postpartum: 'Avoid unless cleared; prefer glute bridge or RDL alternatives.',
    },
    pairsWellBefore: ['Romanian Deadlift', 'Kettlebell Deadlift / Trap-Bar Deadlift', 'Dead Bug'],
    pairsWellAfter: ['Back Extension / Hip Extension', 'Hamstring Slider Curl', 'Farmer Carry'],
    avoidBefore: ['Good morning before RDL competency', 'Heavy deadlift same session if erectors already fatigued'],
    doNotUseWhen: ['Low back pain', 'No RDL competency', 'Load exceeds moderate intent', 'Youth max-effort good morning'],
    mediaReferences: ['Light good morning for athletic hinge training', 'Posterior-chain hinge progressions — conservative loading'],
    mediaInternalNotes: ['Conditional role — validator should flag heavy good morning load or missing RDL prerequisite.'],
  }),
  card({
    slug: 'hamstring-slider-curl',
    name: 'Hamstring Slider Curl',
    slot: 'hamstring_capacity',
    cardSummary:
      'Capacity hamstring slider curl using sliders or towels on a smooth surface to build knee-flexion hamstring strength and eccentric control with hip-extended bias.',
    bestPlacement:
      'hamstring_capacity after hinge base; useful accessory before Nordic progressions when athletes need hamstring tissue capacity without high spinal load.',
    description:
      'The athlete lies supine with heels on sliders, bridges hips up, and extends knees to slide heels away under control, then curls heels back using hamstrings while maintaining hip extension.',
    coachLanguage:
      'Use for hamstring capacity with eccentric emphasis and full rest — not a core burnout or Fitness AMRAP. Progress reps before adding band resistance.',
    athleteLanguage: 'Bridge up, slide your heels away slowly, then pull them back using your hamstrings while keeping your hips up.',
    tenets: [
      { key: 'strength', weight: 4 },
      { key: 'body_control', weight: 4 },
      { key: 'coordination', weight: 3 },
    ],
    methodologies: [
      { key: 'resistance_calisthenics', weight: 4 },
      { key: 'eccentric_negative', weight: 5 },
      { key: 'core_body_control', weight: 3 },
    ],
    physiology: [
      { key: 'force_tissue_capacity', weight: 5 },
      { key: 'control_stability', weight: 3 },
    ],
    patterns: [
      { key: 'hinge', weight: 4 },
      { key: 'brace', weight: 2 },
    ],
    equipment: [
      { key: 'mat', weight: 4 },
      { key: 'none', weight: 3 },
    ],
    body_regions: [
      { key: 'hamstring', weight: 5 },
      { key: 'glute', weight: 3 },
      { key: 'core', weight: 3 },
      { key: 'knee', weight: 4 },
    ],
    whyItWorks:
      'Slider curls train hamstrings in knee flexion with hips extended — a length-tension position that complements hip-hinge patterns. Eccentric emphasis builds hamstring tissue capacity relevant to sprinting and deceleration without barbell spinal load.',
    whyItGoesHere:
      'Belongs in hamstring_capacity (425) — knee-flexion hamstring Capacity before Nordic eccentric progressions.',
    commonMisuse: `${CLUSTER_MISUSE} Do not let hips drop every rep, rush eccentrics, or stack high volume before Output sprint work when hamstrings are already sensitive.`,
    scalingGuidance:
      'Regress to partial ROM or double-leg before single-leg; shorten slide distance before adding band. Emphasize slow eccentric before rep progressions.',
    movementRequirements: {
      primary_joint_actions: ['knee_flexion', 'knee_extension', 'hip_extension'],
      primary_tissues: ['hamstrings', 'glutes', 'core'],
      breathing_demand: 'nasal',
      balance_demand: 'stable',
      impact_level: 0,
      prerequisites: ['kettlebell-deadlift-trap-bar-deadlift'],
    },
    setupRequirements: [...SETUP_COMMON, 'Sliders or towels on smooth floor surface', 'Mat for comfort if needed'],
    coachingExecution: {
      movement_description:
        'Supine hip bridge, heels on sliders, controlled eccentric knee extension sliding heels away, hamstring curl back while hips stay elevated.',
      setup: [
        'Place sliders or towels under heels on smooth floor.',
        'Lie supine with arms at sides for stability.',
        'Set hip bridge height before first slide.',
        'Confirm no current hamstring strain.',
      ],
      execution_steps: [
        'Bridge hips to neutral alignment.',
        'Slowly extend knees — slide heels away.',
        'Keep hips up throughout eccentric.',
        'Curl heels back using hamstrings.',
        'Maintain bridge height through curl.',
        'Rest fully between sets.',
      ],
      breathing_cues: ['Steady breathing — do not hold breath and lose hip height.'],
      coach_cues: ['Hips up.', 'Slow out.', 'Pull in.', 'Stay bridged.', 'Control the slide.'],
      athlete_cues: ['Up.', 'Slow.', 'Pull.', 'Stay up.'],
      common_faults: [
        'Hips dropping during slide.',
        'Rushing eccentric phase.',
        'Using momentum to curl back.',
        'Excessive rep volume with short rest.',
        'Prescribing before basic hinge base.',
        'Single-leg too soon.',
      ],
      stop_signs: [
        'Sharp hamstring pain during curl.',
        'Hamstring cramping that breaks hip height.',
        'Low back pain from bridging.',
        'Cannot control eccentric tempo.',
        'Athlete reports strain symptoms next day.',
      ],
    },
    dosage: {
      volume_unit: 'reps',
      default_sets: 2,
      default_reps: 6,
      default_rest_seconds: 90,
      est_seconds_per_set: 40,
      tempo: '4-0-1-0',
      default_rpe_min: 6,
      default_rpe_max: 8,
      session_volume_min: 8,
      session_volume_max: 32,
    },
    phaseProfile: {
      role: 'primary',
      fit_weight: 4,
      freshness_required: false,
      fatigue_sensitivity: 4,
      fatigue_cost: 3,
      technical_complexity: 2,
      impact_level: 0,
      intensity_ceiling: 'moderate',
      daily_ok: false,
      requires_supervision: 'recommended',
      notes: 'Hamstring tissue capacity accessory. Eccentric tempo is default — progress ROM before reps.',
    },
    scalingOverrides: {
      youth_beginner: 'Partial ROM double-leg slider curl with coach.',
      youth_intermediate: 'Double-leg slider curl, short slide distance.',
      teen: 'Full ROM double-leg before single-leg progression.',
      adult_beginner: 'Short ROM double-leg with slow eccentric.',
      adult_advanced: 'Single-leg slider curl or band-assisted regression.',
      older_adult: 'Partial ROM double-leg with generous rest.',
      pregnancy_postpartum: 'Double-leg only if supine bridging is comfortable.',
    },
    pairsWellBefore: ['Glute Bridge', 'Romanian Deadlift', 'Nordic Hamstring Eccentric — regress if needed'],
    pairsWellAfter: ['Nordic Hamstring Eccentric', 'Single-Leg Romanian Deadlift', 'Back Extension / Hip Extension'],
    avoidBefore: ['Nordic same session if hamstrings already cramping', 'Max velocity sprints with fresh hamstring eccentric fatigue'],
    doNotUseWhen: ['Hamstring strain symptoms', 'Hips drop every rep', 'Cannot control eccentric', 'Used as high-rep conditioning'],
    mediaReferences: ['Hamstring slider curl progressions', 'Nordic curl regression pathway — slider curl'],
    mediaInternalNotes: ['Lower volume than main lifts — flag if paired with Nordic same session without readiness check.'],
  }),
  card({
    slug: 'nordic-hamstring-eccentric',
    name: 'Nordic Hamstring Eccentric',
    slot: 'hamstring_eccentric',
    cardSummary:
      'High-intensity Capacity Nordic hamstring eccentric for advanced hamstring eccentric strength and injury-resilience — low rep count, full rest, conditional prescription.',
    bestPlacement:
      'hamstring_eccentric after slider curl or established hamstring capacity; end of hinge cluster or standalone when athlete tolerates high eccentric demand.',
    description:
      'The athlete kneels with ankles anchored, maintains straight line from knees to shoulders, lowers torso forward under control using hamstrings, and uses hands or band assist to return to start.',
    coachLanguage:
      'Conditional high-eccentric demand — 2–3 reps with full rest, not a beginner exercise or Fitness finisher. Partner or pad required; regress with band assist.',
    athleteLanguage: 'Kneel tall, lower yourself forward as slowly as you can, catch yourself, and push back up to start.',
    tenets: [
      { key: 'strength', weight: 5 },
      { key: 'body_control', weight: 5 },
      { key: 'coordination', weight: 3 },
    ],
    methodologies: [
      { key: 'resistance_calisthenics', weight: 5 },
      { key: 'eccentric_negative', weight: 5 },
    ],
    physiology: [
      { key: 'force_tissue_capacity', weight: 5 },
      { key: 'control_stability', weight: 4 },
    ],
    patterns: [
      { key: 'hinge', weight: 4 },
      { key: 'brace', weight: 3 },
    ],
    equipment: [
      { key: 'mat', weight: 4 },
      { key: 'bands', weight: 3 },
      { key: 'none', weight: 2 },
    ],
    body_regions: [
      { key: 'hamstring', weight: 5 },
      { key: 'knee', weight: 4 },
      { key: 'core', weight: 3 },
      { key: 'hip', weight: 3 },
    ],
    whyItWorks:
      'The Nordic eccentric places maximal demand on hamstrings in lengthened position with high eccentric force — among the strongest evidence-based hamstring resilience tools when dosed conservatively with progression from slider curl and band assist.',
    whyItGoesHere:
      'Belongs in hamstring_eccentric (426) — conditional high-intensity Capacity eccentric after hamstring capacity base.',
    commonMisuse: `${CLUSTER_MISUSE} Do not prescribe to beginners, stack volume before sprint Output, or use short rest between reps. Not a Control isometric hold.`,
    scalingGuidance:
      'Regress to band-assisted Nordic or slider curl; limit to 2–3 reps with 120s rest. Stop if hamstring cramping or strain symptoms appear.',
    movementRequirements: {
      primary_joint_actions: ['knee_flexion', 'knee_extension', 'hip_extension'],
      primary_tissues: ['hamstrings', 'core'],
      breathing_demand: 'nasal',
      balance_demand: 'stable',
      impact_level: 0,
      prerequisites: ['hamstring-slider-curl'],
    },
    setupRequirements: [...SETUP_COMMON, 'Ankle anchor, partner hold, or Nordic bench', 'Pad under knees for comfort'],
    coachingExecution: {
      movement_description:
        'Tall kneel with ankles fixed, eccentric lower forward maintaining hip-knee-shoulder line, controlled catch, assist return — high intensity, low reps.',
      setup: [
        'Anchor ankles with partner, strap, or Nordic bench.',
        'Pad knees on mat.',
        'Set band assist level for current strength.',
        'Confirm hamstring slider curl tolerance first.',
      ],
      execution_steps: [
        'Kneel tall with hips extended.',
        'Brace trunk — straight line knees to shoulders.',
        'Lower forward as slowly as possible.',
        'Use hamstrings to resist gravity.',
        'Catch with hands at end range if needed.',
        'Assist or push back to start and rest fully.',
      ],
      breathing_cues: ['Brace before lowering — controlled exhale through the eccentric if needed.'],
      coach_cues: ['Tall hips.', 'Slow down.', 'Straight line.', 'Catch clean.', 'Full rest before next rep.'],
      athlete_cues: ['Tall.', 'Slow.', 'Fight it.', 'Rest.'],
      common_faults: [
        'Dropping fast without eccentric control.',
        'Hips breaking — sitting back.',
        'Too many reps with short rest.',
        'Prescribing to beginners without regression.',
        'No ankle anchor — unsafe setup.',
        'Stacking with sprint Output same session when fatigued.',
      ],
      stop_signs: [
        'Sharp hamstring pain during eccentric.',
        'Hamstring cramping every rep.',
        'Prior hamstring strain not cleared.',
        'Cannot control descent even with band assist.',
        'Athlete reports strain symptoms within 24 hours.',
      ],
    },
    dosage: {
      volume_unit: 'reps',
      default_sets: 2,
      default_reps: 3,
      default_rest_seconds: 120,
      est_seconds_per_set: 35,
      tempo: 'controlled_eccentric',
      default_rpe_min: 7,
      default_rpe_max: 9,
      session_volume_min: 2,
      session_volume_max: 15,
    },
    phaseProfile: {
      role: 'conditional',
      fit_weight: 4,
      freshness_required: false,
      fatigue_sensitivity: 5,
      fatigue_cost: 4,
      technical_complexity: 3,
      impact_level: 0,
      intensity_ceiling: 'high',
      daily_ok: false,
      requires_supervision: 'recommended',
      notes: 'Conditional high-eccentric demand. Requires hamstring capacity base. Low rep, full rest — not daily hard tissue work.',
    },
    scalingOverrides: {
      youth_beginner: 'Not recommended — use slider curl only.',
      youth_intermediate: 'Band-assisted Nordic with coach only after slider curl tolerance.',
      teen: 'Band-assisted Nordic, 2 × 2–3 with full rest.',
      adult_beginner: 'Slider curl regression — not full Nordic.',
      adult_advanced: 'Full Nordic eccentric, 2 × 3 with 120s rest.',
      older_adult: 'Band-assisted Nordic or slider curl substitute.',
      pregnancy_postpartum: 'Avoid kneeling loaded eccentrics unless cleared.',
    },
    pairsWellBefore: ['Hamstring Slider Curl', 'Romanian Deadlift', 'Glute Bridge'],
    pairsWellAfter: ['Back Extension / Hip Extension', 'Light sprint Output — next session only if recovered'],
    avoidBefore: ['Nordic before slider curl tolerance', 'Max velocity sprints same session after Nordic block'],
    doNotUseWhen: ['Hamstring strain history not cleared', 'Beginner without regression', 'High rep volume', 'No ankle anchor setup'],
    mediaReferences: ['Nordic hamstring curl evidence and dosing', 'Band-assisted Nordic progressions'],
    mediaInternalNotes: ['Conditional role with fatigue_sensitivity 5. Validator capacity_nordic_beginner should fire on novices.'],
  }),
  card({
    slug: 'back-extension-hip-extension',
    name: 'Back Extension / Hip Extension',
    slot: 'posterior_chain_capacity',
    cardSummary:
      'Capacity back extension or hip extension on bench or floor that builds posterior-chain endurance and hip-extension bias — distinguish glute-driven hip extension from spinal hyperextension.',
    bestPlacement:
      'posterior_chain_capacity at end of hinge cluster or as accessory when athletes need erector and glute capacity without heavy barbell spinal load.',
    description:
      'The athlete anchors feet on back extension bench or floor setup, hinges at hips with neutral spine, extends to hip-extension bias with glute squeeze, and lowers under control without excessive lumbar hyperextension.',
    coachLanguage:
      'Coach hip-extension bias — glutes drive the movement, not spinal hyperextension. Capacity intent means controlled reps and full rest, not high-rep back extension burnout.',
    athleteLanguage: 'Hinge at your hips, squeeze your glutes to come up, and lower under control without arching your back excessively.',
    tenets: [
      { key: 'strength', weight: 4 },
      { key: 'body_control', weight: 5 },
      { key: 'coordination', weight: 2 },
    ],
    methodologies: [
      { key: 'resistance_calisthenics', weight: 4 },
      { key: 'core_body_control', weight: 4 },
      { key: 'eccentric_negative', weight: 2 },
    ],
    physiology: [
      { key: 'force_tissue_capacity', weight: 4 },
      { key: 'control_stability', weight: 4 },
    ],
    patterns: [
      { key: 'hinge', weight: 5 },
      { key: 'brace', weight: 4 },
    ],
    equipment: [
      { key: 'bench', weight: 4 },
      { key: 'none', weight: 4 },
      { key: 'mat', weight: 2 },
    ],
    body_regions: [
      { key: 'spine', weight: 4 },
      { key: 'glute', weight: 5 },
      { key: 'hamstring', weight: 4 },
      { key: 'hip', weight: 4 },
      { key: 'core', weight: 4 },
    ],
    whyItWorks:
      'Back extension and hip extension patterns build posterior-chain capacity — glutes, hamstrings, and erectors — with adjustable load and ROM. When coached for hip-extension bias rather than spinal hyperextension, they complement deadlift and RDL without the same compressive floor-pull demand.',
    whyItGoesHere:
      'Belongs in posterior_chain_capacity (427) — hip-extension-biased Capacity accessory; distinguish from spinal-extension-dominant reps.',
    commonMisuse: `${CLUSTER_MISUSE} Do not hyperextend lumbar every rep, use as high-rep erector burnout, or confuse hip extension with spinal extension dominance.`,
    scalingGuidance:
      'Regress ROM or use bodyweight floor hip extension; add plate at chest only when hip-extension bias stays clean. Stop if low back pain increases.',
    movementRequirements: {
      primary_joint_actions: ['hip_extension', 'hip_flexion', 'spinal_extension_control'],
      primary_tissues: ['glutes', 'hamstrings', 'erectors', 'core'],
      breathing_demand: 'nasal',
      balance_demand: 'stable',
      impact_level: 0,
      prerequisites: ['kettlebell-deadlift-trap-bar-deadlift'],
    },
    setupRequirements: [...SETUP_COMMON, 'Back extension bench or stable floor anchor for feet'],
    coachingExecution: {
      movement_description:
        'Anchored feet, hinge at hips with neutral spine, extend with glute-driven hip extension bias, lower under control — minimize spinal hyperextension.',
      setup: [
        'Set back extension bench or floor anchor.',
        'Pad hip crease if needed for comfort.',
        'Start bodyweight before adding plate at chest.',
        'Review hip-extension vs spinal-extension coaching cue.',
      ],
      execution_steps: [
        'Anchor feet and set neutral spine.',
        'Hinge forward at hips with soft knees if on bench.',
        'Extend by squeezing glutes — ribs stay down.',
        'Stop before lumbar hyperextension.',
        'Lower under control to start position.',
        'Rest fully between sets.',
      ],
      breathing_cues: ['Exhale through extension — ribs down, glutes on, not low back arch.'],
      coach_cues: ['Hip hinge down.', 'Glutes on.', 'Ribs down.', 'Not a back arch.', 'Control the return.'],
      athlete_cues: ['Hinge.', 'Squeeze.', 'Ribs down.', 'Lower slow.'],
      common_faults: [
        'Spinal hyperextension at top.',
        'Using momentum bounce at bottom.',
        'Legs swinging or unstable anchor.',
        'High-rep burnout with short rest.',
        'Confusing hip extension with back arch.',
        'Adding load before bodyweight control.',
      ],
      stop_signs: [
        'Low back pain increases during or after set.',
        'Cannot extend without lumbar hyperextension.',
        'Bench or anchor instability.',
        'Hamstring cramping that breaks form.',
        'Athlete reports erector spasm post-session.',
      ],
    },
    dosage: {
      volume_unit: 'reps',
      default_sets: 3,
      default_reps: 8,
      default_rest_seconds: 90,
      est_seconds_per_set: 40,
      tempo: '2-0-1-1',
      default_rpe_min: 6,
      default_rpe_max: 8,
      session_volume_min: 12,
      session_volume_max: 48,
    },
    phaseProfile: {
      role: 'primary',
      fit_weight: 4,
      freshness_required: false,
      fatigue_sensitivity: 3,
      fatigue_cost: 3,
      technical_complexity: 2,
      impact_level: 0,
      intensity_ceiling: 'moderate_to_high',
      daily_ok: false,
      requires_supervision: 'recommended',
      notes: 'Coach hip-extension bias vs spinal-extension dominance. Accessory posterior-chain capacity at end of hinge cluster.',
    },
    scalingOverrides: {
      youth_beginner: 'Bodyweight floor hip extension with coach cueing.',
      youth_intermediate: 'Bodyweight back extension bench, short ROM.',
      teen: 'Bodyweight or light plate when hip-extension bias is clean.',
      adult_beginner: 'Bodyweight with reduced ROM before load.',
      adult_advanced: 'Loaded back extension with pause at top — hip bias only.',
      older_adult: 'Short ROM bodyweight with generous rest.',
      pregnancy_postpartum: 'Reduce ROM; avoid prone loading if uncomfortable.',
    },
    pairsWellBefore: ['Glute Bridge', 'Romanian Deadlift', 'Hip Thrust / Loaded Glute Bridge'],
    pairsWellAfter: ['Farmer Carry', 'Hamstring Slider Curl', 'Restore — Hip Flexor Stretch Access'],
    avoidBefore: ['Loaded back extension if hip hinge base is poor', 'Heavy deadlift same session if erectors already fatigued'],
    doNotUseWhen: ['Low back pain with extension', 'Spinal hyperextension every rep', 'Used as high-rep erector burnout', 'Unstable bench setup'],
    mediaReferences: ['Hip extension vs back extension coaching', 'Back extension bench progressions for athletes'],
    mediaInternalNotes: ['Note hip-extension vs spinal-extension bias in validator education. Flag hyperextension faults.'],
  }),
]

export const CAPACITY_HINGE_SLUGS = CAPACITY_HINGE_CARDS.map((c) => c.slug)
