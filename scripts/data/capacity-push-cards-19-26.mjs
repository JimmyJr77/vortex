/**
 * Rich card v2 content for Capacity phase Upper-Body Push Strength cards 19–26.
 * Consumed by scripts/generate-124-capacity-push-cards.mjs.
 * UPDATE-only on slugs seeded in migration 121.
 */

const GENDER_DEFAULT =
  'No default sex-based adjustment. Scale by movement quality, load tolerance, goals, and symptoms rather than gender alone.'

const SUBROLE = 'upper_body_push_strength'
const FAMILY = 'Upper-body push strength'

const CLUSTER_MISUSE =
  'Upper-body push Capacity builds pressing reserve with controlled load and full rest — not explosive Output pushes or high-rep Fitness circuits.'

const SCALING_BASE = {
  youth_beginner:
    'Incline or wall push-up only; coach-supervised; stop on shoulder pinching, wrist pain, or loss of trunk brace.',
  youth_intermediate:
    'Conservative reps with full rest between sets; prioritize plank line and scapular control over chasing load or depth.',
  teen: 'Progress incline height, load, or variation only when push mechanics and shoulder control stay clean across all reps.',
  adult_beginner: 'Start with incline or elevated push-up; master floor press before bench press and overhead progressions.',
  adult_advanced: 'Can progress load, tempo pause, or inverted demand when mechanics stay crisp across all reps.',
  older_adult: 'Prefer incline push-up, floor press, or supported variations; moderate load with generous rest.',
  pregnancy_postpartum:
    'Scale ROM and load by trimester and symptoms; avoid max intent and prolonged prone loading unless cleared.',
}

const SETUP_COMMON = [
  'Stable bench or box for incline and pike variations',
  'Dumbbells, kettlebells, or bench as appropriate to variation',
  'Clear floor space for push-up and floor-press patterns',
  'Dip bars or rings at appropriate height for support holds',
]

/** @param {Record<string, unknown>} c */
function card(c) {
  return {
    family: FAMILY,
    subrole: SUBROLE,
    genderSpecificNotes: GENDER_DEFAULT,
    goodForSessions: ['capacity_upper_body', 'push_capacity', 'strength_development'],
    scaling: { ...SCALING_BASE, ...(c.scalingOverrides ?? {}) },
    ...c,
  }
}

/** @type {import('./foundation-access-cards-1-10.mjs').FoundationCard[]} */
export const CAPACITY_PUSH_CARDS = [
  card({
    slug: 'incline-push-up',
    name: 'Incline Push-Up',
    slot: 'pushup_regression',
    cardSummary:
      'Foundational Capacity push regression using an elevated surface to teach plank line, scapular control, and progressive horizontal pressing strength.',
    bestPlacement:
      'Primary entry in pushup_regression after Output; before floor push-up, loaded press, or inverted push when horizontal push mechanics are still developing.',
    description:
      'The athlete places hands on a bench or box, sets a braced plank line from head to heel, lowers chest toward the surface under control, and presses back to full elbow extension without sagging or flaring.',
    coachLanguage:
      'Use as the foundational Capacity horizontal push. Progressive overload with full rest — not a warm-up fluff set or circuit finisher. Lower the incline only when every rep stays crisp.',
    athleteLanguage: 'Hands on the box, strong plank, lower your chest with control, and push the box away to stand tall in your line.',
    tenets: [
      { key: 'strength', weight: 4 },
      { key: 'body_control', weight: 5 },
      { key: 'coordination', weight: 3 },
      { key: 'balance', weight: 2 },
    ],
    methodologies: [
      { key: 'resistance_calisthenics', weight: 5 },
      { key: 'core_body_control', weight: 4 },
      { key: 'eccentric_negative', weight: 2 },
    ],
    physiology: [
      { key: 'force_tissue_capacity', weight: 4 },
      { key: 'control_stability', weight: 5 },
    ],
    patterns: [
      { key: 'push', weight: 5 },
      { key: 'brace', weight: 4 },
    ],
    equipment: [
      { key: 'box', weight: 5 },
      { key: 'bench', weight: 4 },
      { key: 'none', weight: 2 },
    ],
    body_regions: [
      { key: 'shoulder', weight: 5 },
      { key: 'chest', weight: 4 },
      { key: 'core', weight: 4 },
      { key: 'triceps', weight: 3 },
      { key: 'wrist', weight: 3 },
    ],
    whyItWorks:
      'Incline push-ups reduce the percentage of body weight on the hands while preserving the closed-chain pressing pattern. They build chest, shoulder, and triceps force capacity with trunk bracing demand relevant to tumbling, vaulting, and hand support without requiring floor push-up competency first.',
    whyItGoesHere:
      'Belongs in pushup_regression (431) — foundational Capacity horizontal push before floor push-up and loaded press work.',
    commonMisuse: `${CLUSTER_MISUSE} Do not use as high-rep conditioning, allow hip sag every rep, or lower incline before plank line and scapular control are clean.`,
    scalingGuidance:
      'Regress to wall push-up or higher incline; progress to lower incline or floor push-up only when ribs stay down and elbows track. Hypermobility athletes need active serratus and rib control — no passive shoulder hang.',
    movementRequirements: {
      primary_joint_actions: ['shoulder_horizontal_adduction', 'shoulder_extension', 'elbow_extension', 'scapular_protraction'],
      primary_tissues: ['pectorals', 'anterior_deltoid', 'triceps', 'serratus_anterior', 'core'],
      breathing_demand: 'nasal',
      balance_demand: 'stable',
      impact_level: 0,
      prerequisites: [],
    },
    setupRequirements: [...SETUP_COMMON],
    coachingExecution: {
      movement_description:
        'Hands on elevated surface, braced plank line, controlled descent with elbows at roughly 45°, press to full extension without hip sag or rib flare.',
      setup: [
        'Select stable bench or box height appropriate to skill.',
        'Hands shoulder-width, fingers spread.',
        'Walk feet back until plank line is straight.',
        'Confirm pain-free range and supervision for youth.',
      ],
      execution_steps: [
        'Set braced plank — ribs down, glutes on.',
        'Lower chest toward surface under control.',
        'Keep elbows tracking — not flared to 90°.',
        'Press through full hand to return to plank.',
        'Finish with scapular protraction at top.',
        'Rest fully before the next set.',
      ],
      breathing_cues: ['Inhale on descent — exhale through the press without losing brace.'],
      coach_cues: ['Plank line.', 'Ribs down.', 'Elbows angle back.', 'Push the box away.', 'Control the descent.'],
      athlete_cues: ['Tight core.', 'Down slow.', 'Push away.', 'Stay long.'],
      common_faults: [
        'Hips sagging or piking.',
        'Rib flare at bottom or top.',
        'Elbows flaring to 90°.',
        'Head dropping toward surface.',
        'Rushing reps with short rest.',
        'Lowering incline before control is earned.',
      ],
      stop_signs: [
        'Shoulder pinching during descent or press.',
        'Wrist pain limiting hand support.',
        'Cannot maintain plank line.',
        'Sharp anterior shoulder pain.',
        'Neck tension replacing scapular control.',
      ],
    },
    dosage: {
      volume_unit: 'reps',
      default_sets: 3,
      default_reps: 8,
      default_rest_seconds: 90,
      est_seconds_per_set: 40,
      tempo: '2-0-1-0',
      default_rpe_min: 5,
      default_rpe_max: 7,
      session_volume_min: '16 reps',
      session_volume_max: '36 reps',
    },
    phaseProfile: {
      role: 'primary',
      fit_weight: 5,
      freshness_required: false,
      fatigue_sensitivity: 2,
      fatigue_cost: 2,
      technical_complexity: 2,
      impact_level: 0,
      intensity_ceiling: 'moderate',
      daily_ok: false,
      requires_supervision: 'recommended',
      notes: 'Foundational Capacity push regression. Master before floor push-up and loaded horizontal press.',
    },
    scalingOverrides: {
      youth_beginner: 'Wall push-up or high incline with coach at side.',
      youth_intermediate: 'Moderate incline, 3 × 6–8 with full rest.',
      teen: 'Progress to lower incline when plank line stays clean.',
      adult_beginner: 'High incline or wall push-up before floor work.',
      adult_advanced: 'Lower incline or weighted vest progression when earned.',
      older_adult: 'Higher incline, conservative reps, generous rest.',
      pregnancy_postpartum: 'Elevated surface; avoid deep prone compression if uncomfortable.',
    },
    pairsWellBefore: ['Scapular Push-Up', 'Wrist Rockers', 'Wall Slides with Lift-Off', 'Dead Bug'],
    pairsWellAfter: ['Push-Up', 'Tempo / Eccentric Push-Up', 'Dumbbell / Kettlebell Floor Press'],
    avoidBefore: ['Floor push-up if incline plank line is poor', 'Loaded bench press before horizontal push competency'],
    doNotUseWhen: ['Shoulder pinching every rep', 'Wrist pain with hand support', 'Using as conditioning circuit', 'Hip sag on every rep'],
    mediaReferences: ['NSCA push-up regression progressions', 'Incline push-up teaching for athletic populations'],
    mediaInternalNotes: ['Validator should confirm incline control before floor push-up or loaded press.'],
  }),
  card({
    slug: 'push-up',
    name: 'Push-Up',
    slot: 'horizontal_push_strength',
    cardSummary:
      'Primary Capacity floor push-up that builds horizontal pressing strength, trunk bracing, and scapular control with bodyweight load and full rest.',
    bestPlacement:
      'horizontal_push_strength after incline push-up competency; before tempo eccentric, floor press, or inverted push when floor push quality is established.',
    description:
      'The athlete assumes a high plank with hands shoulder-width, lowers chest toward the floor under control, and presses back to full extension while maintaining a braced line from head to heel.',
    coachLanguage:
      'Use as the primary Capacity horizontal push. Progressive overload with full rest — not max-rep AMRAPs or explosive plyo push-ups. Add load or tempo only when every rep stays crisp.',
    athleteLanguage: 'Strong plank, lower your chest to the floor with control, and push the ground away to finish tall.',
    tenets: [
      { key: 'strength', weight: 5 },
      { key: 'body_control', weight: 5 },
      { key: 'coordination', weight: 3 },
      { key: 'balance', weight: 2 },
    ],
    methodologies: [
      { key: 'resistance_calisthenics', weight: 5 },
      { key: 'core_body_control', weight: 5 },
      { key: 'eccentric_negative', weight: 3 },
    ],
    physiology: [
      { key: 'force_tissue_capacity', weight: 5 },
      { key: 'control_stability', weight: 4 },
    ],
    patterns: [
      { key: 'push', weight: 5 },
      { key: 'brace', weight: 5 },
    ],
    equipment: [
      { key: 'none', weight: 5 },
      { key: 'mat', weight: 2 },
    ],
    body_regions: [
      { key: 'shoulder', weight: 5 },
      { key: 'chest', weight: 5 },
      { key: 'triceps', weight: 4 },
      { key: 'core', weight: 5 },
      { key: 'wrist', weight: 3 },
    ],
    whyItWorks:
      'The floor push-up loads the entire pressing chain — chest, shoulders, triceps, and trunk stabilizers — in a closed-chain pattern directly relevant to tumbling, vault push-off, and hand support. Capacity intent with tempo and full rest builds tissue reserve without the speed demand of Output plyometric pushes.',
    whyItGoesHere:
      'Belongs in horizontal_push_strength (432) — primary Capacity floor push after incline regression competency.',
    commonMisuse: `${CLUSTER_MISUSE} Do not rep out to failure with short rest, allow hip sag, or prescribe before incline push-up control is earned.`,
    scalingGuidance:
      'Regress to incline push-up; progress to tempo eccentric, weighted vest, or floor press only when plank line and elbow tracking stay clean. Use 45° elbow angle cue — not flared 90°.',
    movementRequirements: {
      primary_joint_actions: ['shoulder_horizontal_adduction', 'shoulder_extension', 'elbow_extension', 'scapular_protraction'],
      primary_tissues: ['pectorals', 'anterior_deltoid', 'triceps', 'serratus_anterior', 'core'],
      breathing_demand: 'nasal',
      balance_demand: 'stable',
      impact_level: 0,
      prerequisites: ['incline-push-up'],
    },
    setupRequirements: [...SETUP_COMMON],
    coachingExecution: {
      movement_description:
        'High plank, braced trunk, controlled descent to floor or fist-height target, press to full extension with scapular protraction at top.',
      setup: [
        'Hands shoulder-width, fingers spread.',
        'Feet hip-width, plank line set before first rep.',
        'Optional fist or block target for consistent depth.',
        'Confirm incline push-up competency and pain-free range.',
      ],
      execution_steps: [
        'Brace ribs down and set glutes on.',
        'Lower chest toward floor under control.',
        'Keep elbows at roughly 45° from torso.',
        'Press through full hand to return to plank.',
        'Finish with shoulder blades protracted — push floor away.',
        'Rest fully between sets.',
      ],
      breathing_cues: ['Inhale on descent — exhale through the sticking point without losing brace.'],
      coach_cues: ['Plank line.', 'Ribs down.', 'Elbows back.', 'Push the floor.', 'Full extension.'],
      athlete_cues: ['Tight.', 'Down slow.', 'Push.', 'Stay long.'],
      common_faults: [
        'Hips sagging or piking.',
        'Partial ROM — chest never reaches target depth.',
        'Elbows flaring to 90°.',
        'Head jutting forward.',
        'Scapular winging at top.',
        'Rushing reps with short rest.',
      ],
      stop_signs: [
        'Shoulder pinching during descent or press.',
        'Wrist pain limiting hand support.',
        'Cannot maintain plank line.',
        'Sharp anterior shoulder or elbow pain.',
        'Low back pain from sagging every rep.',
      ],
    },
    dosage: {
      volume_unit: 'reps',
      default_sets: 3,
      default_reps: 8,
      default_rest_seconds: 90,
      est_seconds_per_set: 40,
      tempo: '2-0-1-0',
      default_rpe_min: 6,
      default_rpe_max: 8,
      session_volume_min: '16 reps',
      session_volume_max: '40 reps',
    },
    phaseProfile: {
      role: 'primary',
      fit_weight: 5,
      freshness_required: false,
      fatigue_sensitivity: 3,
      fatigue_cost: 3,
      technical_complexity: 2,
      impact_level: 0,
      intensity_ceiling: 'moderate_to_high',
      daily_ok: false,
      requires_supervision: 'recommended',
      notes: 'Requires incline push-up competency. Primary horizontal push before loaded press and inverted progressions.',
    },
    scalingOverrides: {
      youth_beginner: 'Incline push-up only — not floor push-up until earned.',
      youth_intermediate: 'Floor push-up with coach supervision when incline is clean.',
      teen: 'Progress reps or add tempo when form stays crisp.',
      adult_beginner: 'Incline regression until floor push-up is clean.',
      adult_advanced: 'Weighted vest, tempo pause, or floor press progression.',
      older_adult: 'Incline push-up or partial ROM floor push with generous rest.',
      pregnancy_postpartum: 'Incline or elevated push-up if prone loading is uncomfortable.',
    },
    pairsWellBefore: ['Incline Push-Up', 'Scapular Push-Up', 'Dead Bug', 'Wrist Rockers'],
    pairsWellAfter: ['Tempo / Eccentric Push-Up', 'Dumbbell / Kettlebell Floor Press', 'Half-Kneeling Single-Arm Press'],
    avoidBefore: ['Floor push-up if incline control is poor', 'Explosive plyo push-up Output in same block if shoulders are pre-fatigued'],
    doNotUseWhen: ['No incline push-up competency', 'Shoulder pinching every rep', 'Hip sag on every rep', 'Used as high-rep conditioning circuit'],
    mediaReferences: ['NSCA push-up technique standards', 'Closed-chain pressing progressions for athletes'],
    mediaInternalNotes: ['Prerequisite incline-push-up should be documented before floor push-up prescription.'],
  }),
  card({
    slug: 'tempo-eccentric-push-up',
    name: 'Tempo / Eccentric Push-Up',
    slot: 'push_eccentric',
    cardSummary:
      'Capacity tempo and eccentric-emphasis push-up that builds pressing tissue capacity through controlled lowering, pause, or slow eccentric before concentric drive.',
    bestPlacement:
      'push_eccentric after floor push-up competency; useful when athletes need eccentric pressing strength without adding external load.',
    description:
      'The athlete performs a floor or incline push-up with prescribed tempo — typically a 3–4 second lowering, optional pause at bottom, and controlled press — emphasizing eccentric control and full rest between sets.',
    coachLanguage:
      'Use for eccentric pressing capacity with intentional tempo and full rest. Not a speed push-up, plyometric variation, or Fitness AMRAP.',
    athleteLanguage: 'Lower yourself slowly, stay tight at the bottom, and push back up with control — no bouncing.',
    tenets: [
      { key: 'strength', weight: 5 },
      { key: 'body_control', weight: 5 },
      { key: 'coordination', weight: 3 },
    ],
    methodologies: [
      { key: 'resistance_calisthenics', weight: 5 },
      { key: 'eccentric_negative', weight: 5 },
      { key: 'core_body_control', weight: 4 },
    ],
    physiology: [
      { key: 'force_tissue_capacity', weight: 5 },
      { key: 'control_stability', weight: 4 },
    ],
    patterns: [
      { key: 'push', weight: 5 },
      { key: 'brace', weight: 4 },
    ],
    equipment: [
      { key: 'none', weight: 5 },
      { key: 'box', weight: 2 },
    ],
    body_regions: [
      { key: 'shoulder', weight: 5 },
      { key: 'chest', weight: 5 },
      { key: 'triceps', weight: 4 },
      { key: 'core', weight: 4 },
      { key: 'wrist', weight: 3 },
    ],
    whyItWorks:
      'Tempo and eccentric-emphasis push-ups increase time under tension on chest, shoulders, and triceps during the lowering phase. This builds tissue capacity and deceleration-relevant pressing strength when dosed conservatively with full rest — distinct from explosive Output push variations.',
    whyItGoesHere:
      'Belongs in push_eccentric (433) — eccentric Capacity push after floor push-up competency.',
    commonMisuse: `${CLUSTER_MISUSE} Do not bounce at bottom, rush the eccentric, prescribe before push-up control, or stack high volume before tumbling Output.`,
    scalingGuidance:
      'Regress to incline tempo push-up or eccentric-only to elevated surface; shorten eccentric duration before reducing incline height. Lower rep count than standard push-up.',
    movementRequirements: {
      primary_joint_actions: ['shoulder_horizontal_adduction', 'shoulder_extension', 'elbow_extension', 'scapular_protraction'],
      primary_tissues: ['pectorals', 'anterior_deltoid', 'triceps', 'serratus_anterior', 'core'],
      breathing_demand: 'nasal',
      balance_demand: 'stable',
      impact_level: 0,
      prerequisites: ['push-up'],
    },
    setupRequirements: [...SETUP_COMMON],
    coachingExecution: {
      movement_description:
        'Push-up with 3–4 second eccentric, optional 1-second pause at bottom, controlled concentric — no bounce or speed intent.',
      setup: [
        'Select floor or incline based on push-up competency.',
        'Set tempo prescription before first rep.',
        'Confirm pain-free shoulder and wrist range.',
        'Use fist or block target for consistent bottom position.',
      ],
      execution_steps: [
        'Set braced plank before descent.',
        'Lower over 3–4 seconds with elbows at 45°.',
        'Pause lightly at bottom without relaxing trunk.',
        'Press to full extension without momentum bounce.',
        'Finish with scapular protraction.',
        'Rest fully between sets — lower rep count than standard push-up.',
      ],
      breathing_cues: ['Brace before descent — controlled exhale through the press.'],
      coach_cues: ['Slow down.', 'No bounce.', 'Stay tight at bottom.', 'Elbows back.', 'Full rest between sets.'],
      athlete_cues: ['Slow.', 'Pause.', 'Push.', 'Tight.'],
      common_faults: [
        'Rushing the eccentric.',
        'Bouncing off the floor at bottom.',
        'Hips sagging under eccentric load.',
        'Partial ROM to make tempo easier.',
        'Too many reps with short rest.',
        'Prescribing before floor push-up competency.',
      ],
      stop_signs: [
        'Shoulder pinching worsens with slow eccentric.',
        'Cannot control 3-second lowering.',
        'Elbow pain under tempo load.',
        'Trunk collapses at bottom pause.',
        'Athlete reports excessive DOMS beyond normal adaptation.',
      ],
    },
    dosage: {
      volume_unit: 'reps',
      default_sets: 3,
      default_reps: 6,
      default_rest_seconds: 90,
      est_seconds_per_set: 45,
      tempo: '3-1-1-0',
      default_rpe_min: 6,
      default_rpe_max: 8,
      session_volume_min: '12 reps',
      session_volume_max: '24 reps',
    },
    phaseProfile: {
      role: 'primary',
      fit_weight: 4,
      freshness_required: false,
      fatigue_sensitivity: 4,
      fatigue_cost: 4,
      technical_complexity: 3,
      impact_level: 0,
      intensity_ceiling: 'moderate_to_high',
      daily_ok: false,
      requires_supervision: 'recommended',
      notes: 'Requires push-up competency. Lower rep count than standard push-up — eccentric emphasis increases tissue demand.',
    },
    scalingOverrides: {
      youth_beginner: 'Incline eccentric-only push-up with coach — not floor tempo.',
      youth_intermediate: 'Incline tempo push-up, 3 × 4–6 with full rest.',
      teen: 'Floor tempo push-up after push-up mastery.',
      adult_beginner: 'Incline tempo or eccentric-only regression.',
      adult_advanced: 'Floor tempo with 4-second eccentric or pause at bottom.',
      older_adult: 'Incline tempo with generous rest and reduced reps.',
      pregnancy_postpartum: 'Incline tempo if prone floor work is uncomfortable.',
    },
    pairsWellBefore: ['Push-Up', 'Incline Push-Up', 'Scapular Push-Up'],
    pairsWellAfter: ['Dumbbell / Kettlebell Floor Press', 'Pike Push-Up / Box Pike Push-Up'],
    avoidBefore: ['Tempo push-up before floor push-up is clean', 'Explosive upper-body Output immediately after heavy eccentric block'],
    doNotUseWhen: ['No push-up competency', 'Bouncing every rep', 'Shoulder pinching under slow eccentric', 'Used as conditioning AMRAP'],
    mediaReferences: ['Tempo push-up eccentric progressions', 'Eccentric training dose for upper-body pressing'],
    mediaInternalNotes: ['Prerequisite push-up required. Flag high rep tempo push-ups with short rest.'],
  }),
  card({
    slug: 'dumbbell-kettlebell-floor-press',
    name: 'Dumbbell / Kettlebell Floor Press',
    slot: 'horizontal_push_strength',
    cardSummary:
      'Capacity floor press using dumbbells or kettlebells that builds horizontal pressing strength with reduced shoulder ROM versus bench press and a stable floor reference.',
    bestPlacement:
      'horizontal_push_strength after push-up competency; before dumbbell bench press when athletes need loaded horizontal push with controlled ROM.',
    description:
      'The athlete lies supine on the floor, presses dumbbells or kettlebells from chest level to full elbow extension, pauses lightly at floor contact, and lowers under control with braced trunk.',
    coachLanguage:
      'Use for loaded horizontal push with intentional load and full rest. Floor contact limits ROM — not a bench press substitute with bounce or short-rest circuits.',
    athleteLanguage: 'Lie on your back, press the weights up, touch your upper arms to the floor, and press back up without arching.',
    tenets: [
      { key: 'strength', weight: 5 },
      { key: 'body_control', weight: 4 },
      { key: 'coordination', weight: 3 },
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
      { key: 'push', weight: 5 },
      { key: 'brace', weight: 3 },
    ],
    equipment: [
      { key: 'dumbbell', weight: 5 },
      { key: 'kettlebell', weight: 4 },
      { key: 'mat', weight: 2 },
    ],
    body_regions: [
      { key: 'shoulder', weight: 5 },
      { key: 'chest', weight: 5 },
      { key: 'triceps', weight: 4 },
      { key: 'core', weight: 3 },
    ],
    whyItWorks:
      'The floor press limits shoulder extension ROM at the bottom, reducing anterior shoulder stress while still loading chest and triceps. It builds horizontal pressing force capacity with a clear depth reference and is a natural bridge from push-up to bench press progressions.',
    whyItGoesHere:
      'Belongs in horizontal_push_strength (432) — loaded horizontal Capacity push after push-up competency, before bench press.',
    commonMisuse: `${CLUSTER_MISUSE} Do not bounce upper arms off floor, arch excessively, or prescribe before push-up control. Not a high-rep burnout set.`,
    scalingGuidance:
      'Regress to lighter load or neutral-grip dumbbells; progress load only when elbows track and trunk stays braced. Use tempo before load jumps.',
    movementRequirements: {
      primary_joint_actions: ['shoulder_horizontal_adduction', 'shoulder_extension', 'elbow_extension'],
      primary_tissues: ['pectorals', 'anterior_deltoid', 'triceps', 'core'],
      breathing_demand: 'nasal',
      balance_demand: 'stable',
      impact_level: 0,
      prerequisites: ['push-up'],
    },
    setupRequirements: [...SETUP_COMMON, 'Mat or clear floor space for supine pressing'],
    coachingExecution: {
      movement_description:
        'Supine on floor, dumbbells at chest, press to full extension, upper arms touch floor lightly at bottom, controlled press with braced trunk.',
      setup: [
        'Select dumbbell or kettlebell load appropriate to skill.',
        'Lie supine with knees bent, feet flat.',
        'Set shoulder blades slightly retracted and down.',
        'Confirm push-up competency and pain-free range.',
      ],
      execution_steps: [
        'Start weights at chest with wrists stacked over elbows.',
        'Brace trunk — slight posterior pelvic tilt.',
        'Press to full elbow extension.',
        'Lower until upper arms lightly contact floor.',
        'Pause without bouncing off floor.',
        'Rest fully between sets.',
      ],
      breathing_cues: ['Brace before press — exhale through sticking point without losing trunk.'],
      coach_cues: ['Wrists stacked.', 'Upper arms to floor.', 'No bounce.', 'Ribs down.', 'Control the descent.'],
      athlete_cues: ['Press.', 'Touch.', 'No arch.', 'Tight core.'],
      common_faults: [
        'Bouncing upper arms off floor.',
        'Excessive lumbar arch.',
        'Elbows flaring to 90°.',
        'Partial ROM — arms never reach floor.',
        'Weights drifting out of line.',
        'Rushing reps with short rest.',
      ],
      stop_signs: [
        'Shoulder pinching at bottom range.',
        'Sharp anterior shoulder pain.',
        'Cannot control eccentric to floor contact.',
        'Low back pain from arching every rep.',
        'Elbow pain under load.',
      ],
    },
    dosage: {
      volume_unit: 'reps',
      default_sets: 3,
      default_reps: 8,
      default_rest_seconds: 90,
      est_seconds_per_set: 40,
      tempo: '2-0-1-0',
      default_rpe_min: 6,
      default_rpe_max: 8,
      session_volume_min: '16 reps',
      session_volume_max: '36 reps',
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
      notes: 'Requires push-up competency. Bridge to bench press — floor limits ROM for shoulder-friendly loading.',
    },
    scalingOverrides: {
      youth_beginner: 'Light floor press with coach — not heavy load.',
      youth_intermediate: 'Light DB floor press, 3 × 6–8 with full rest.',
      teen: 'Progress load when push-up and floor press form stay clean.',
      adult_beginner: 'Light DB floor press before bench press.',
      adult_advanced: 'Heavier floor press with tempo pause before bench.',
      older_adult: 'Moderate load floor press with generous rest.',
      pregnancy_postpartum: 'Reduce load; monitor supine symptoms — use incline press if needed.',
    },
    pairsWellBefore: ['Push-Up', 'Incline Push-Up', 'Dead Bug'],
    pairsWellAfter: ['Dumbbell Bench Press', 'Half-Kneeling Single-Arm Press'],
    avoidBefore: ['Floor press before push-up is clean', 'Bench press same session if shoulder is already fatigued from eccentric work'],
    doNotUseWhen: ['No push-up competency', 'Shoulder pinching at bottom', 'Bouncing every rep', 'Used as conditioning circuit'],
    mediaReferences: ['Floor press vs bench press ROM and shoulder stress', 'NSCA dumbbell pressing progressions'],
    mediaInternalNotes: ['Prerequisite push-up required before loaded floor press in youth.'],
  }),
  card({
    slug: 'dumbbell-bench-press',
    name: 'Dumbbell Bench Press',
    slot: 'horizontal_push_strength',
    cardSummary:
      'Capacity dumbbell bench press that builds horizontal pressing strength through full ROM with independent arm demand and trunk stability on a stable bench.',
    bestPlacement:
      'horizontal_push_strength after floor press or push-up competency; primary loaded horizontal push when bench setup is available and shoulder tolerance allows full ROM.',
    description:
      'The athlete lies on a flat bench with dumbbells at chest level, presses to full extension with controlled path, and lowers under tempo with feet planted and braced trunk.',
    coachLanguage:
      'Use for loaded horizontal push with intentional load and full rest. Supervise bench setup — not a max-effort powerlifting bench or Fitness circuit with short rest.',
    athleteLanguage: 'Feet planted, back braced, press the dumbbells up, lower with control, and keep your shoulders packed.',
    tenets: [
      { key: 'strength', weight: 5 },
      { key: 'body_control', weight: 4 },
      { key: 'coordination', weight: 4 },
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
      { key: 'push', weight: 5 },
      { key: 'brace', weight: 3 },
    ],
    equipment: [
      { key: 'dumbbell', weight: 5 },
      { key: 'bench', weight: 5 },
    ],
    body_regions: [
      { key: 'shoulder', weight: 5 },
      { key: 'chest', weight: 5 },
      { key: 'triceps', weight: 4 },
      { key: 'core', weight: 3 },
    ],
    whyItWorks:
      'Dumbbell bench press allows independent arm loading and natural wrist path while building chest, shoulder, and triceps force capacity through full ROM. It progresses horizontal pressing reserve beyond bodyweight and floor press when dosed with tempo and full rest.',
    whyItGoesHere:
      'Belongs in horizontal_push_strength (432) — loaded horizontal Capacity push after floor press or push-up competency.',
    commonMisuse: `${CLUSTER_MISUSE} Do not bounce off chest, use excessive arch, or prescribe before floor press or push-up control. Not a metcon with short rest.`,
    scalingGuidance:
      'Regress to floor press or lighter dumbbells; progress load only when elbows track and trunk stays braced. Use spotter or self-rack safely on heavy sets.',
    movementRequirements: {
      primary_joint_actions: ['shoulder_horizontal_adduction', 'shoulder_extension', 'elbow_extension'],
      primary_tissues: ['pectorals', 'anterior_deltoid', 'triceps', 'core'],
      breathing_demand: 'nasal',
      balance_demand: 'stable',
      impact_level: 0,
      prerequisites: ['dumbbell-kettlebell-floor-press'],
    },
    setupRequirements: [...SETUP_COMMON, 'Stable flat bench with clear dumbbell rack path'],
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
      breathing_cues: ['Brace before press — exhale through sticking point without losing trunk.'],
      coach_cues: ['Feet planted.', 'Shoulders packed.', 'Control the path.', 'No bounce.', 'Safe rerack.'],
      athlete_cues: ['Plant feet.', 'Press.', 'Lower slow.', 'Pack shoulders.'],
      common_faults: [
        'Bouncing dumbbells off chest.',
        'Excessive lumbar arch and rib flare.',
        'Elbows flaring to 90°.',
        'Asymmetric pressing path.',
        'Unsafe dumbbell pickup or rerack.',
        'Short rest turning it into conditioning.',
      ],
      stop_signs: [
        'Shoulder pinching at bottom ROM.',
        'Sharp anterior shoulder pain.',
        'Cannot control eccentric to chest.',
        'Unsafe bench or dumbbell setup.',
        'Elbow pain under load.',
      ],
    },
    dosage: {
      volume_unit: 'reps',
      default_sets: 3,
      default_reps: 8,
      default_rest_seconds: 90,
      est_seconds_per_set: 45,
      tempo: '2-0-1-0',
      default_rpe_min: 6,
      default_rpe_max: 8,
      session_volume_min: '16 reps',
      session_volume_max: '36 reps',
    },
    phaseProfile: {
      role: 'primary',
      fit_weight: 5,
      freshness_required: false,
      fatigue_sensitivity: 3,
      fatigue_cost: 4,
      technical_complexity: 3,
      impact_level: 0,
      intensity_ceiling: 'moderate_to_high',
      daily_ok: false,
      requires_supervision: 'recommended',
      notes: 'Requires floor press or push-up competency. Supervise dumbbell bench setup and rerack.',
    },
    scalingOverrides: {
      youth_beginner: 'Floor press only — not bench press until earned.',
      youth_intermediate: 'Light DB bench with coach spotting.',
      teen: 'DB bench after floor press mastery.',
      adult_beginner: 'Floor press before full ROM bench.',
      adult_advanced: 'Heavier DB bench with tempo pause or neutral grip.',
      older_adult: 'Moderate load with spotter and generous rest.',
      pregnancy_postpartum: 'Reduce load and ROM; use floor press if supine is uncomfortable.',
    },
    pairsWellBefore: ['Dumbbell / Kettlebell Floor Press', 'Push-Up', 'Scapular Push-Up'],
    pairsWellAfter: ['Half-Kneeling Single-Arm Press', 'Pike Push-Up / Box Pike Push-Up'],
    avoidBefore: ['Bench press before floor press or push-up is clean', 'Max tumbling Output if shoulders are pre-fatigued from heavy bench'],
    doNotUseWhen: ['No floor press or push-up competency', 'Unsafe bench setup', 'Shoulder pinching at bottom', 'Used as metcon with short rest'],
    mediaReferences: ['NSCA dumbbell bench press technique', 'DB bench vs barbell for athletic pressing progressions'],
    mediaInternalNotes: ['Prerequisite dumbbell-kettlebell-floor-press recommended before heavy bench in youth.'],
  }),
  card({
    slug: 'half-kneeling-single-arm-press',
    name: 'Half-Kneeling Single-Arm Press',
    slot: 'vertical_push_strength',
    cardSummary:
      'Capacity half-kneeling single-arm press that builds vertical pressing strength, trunk anti-rotation, and shoulder stability with unilateral load demand.',
    bestPlacement:
      'vertical_push_strength after horizontal push competency; primary vertical push entry before overhead barbell work when anti-extension and shoulder control are priorities.',
    description:
      'The athlete assumes a half-kneeling stance, braces trunk against extension and rotation, and presses a dumbbell or kettlebell overhead to full extension without rib flare or lumbar arch.',
    coachLanguage:
      'Use for vertical push with intentional load and full rest. Half-kneeling exposes trunk and shoulder control — not a standing push-press or explosive Output overhead work.',
    athleteLanguage: 'Half-kneel tall, brace your core, press the weight straight up, and lower under control without leaning back.',
    tenets: [
      { key: 'strength', weight: 5 },
      { key: 'body_control', weight: 5 },
      { key: 'balance', weight: 3 },
      { key: 'coordination', weight: 3 },
    ],
    methodologies: [
      { key: 'resistance_calisthenics', weight: 5 },
      { key: 'core_body_control', weight: 5 },
      { key: 'balance_stability', weight: 3 },
    ],
    physiology: [
      { key: 'force_tissue_capacity', weight: 5 },
      { key: 'control_stability', weight: 5 },
    ],
    patterns: [
      { key: 'push', weight: 5 },
      { key: 'brace', weight: 5 },
    ],
    equipment: [
      { key: 'dumbbell', weight: 5 },
      { key: 'kettlebell', weight: 4 },
      { key: 'mat', weight: 2 },
    ],
    body_regions: [
      { key: 'shoulder', weight: 5 },
      { key: 'core', weight: 5 },
      { key: 'triceps', weight: 4 },
      { key: 'hip', weight: 3 },
    ],
    whyItWorks:
      'Half-kneeling removes lower-body drive and increases demand on trunk anti-extension and anti-rotation while pressing overhead. It builds vertical pressing force capacity and shoulder stability relevant to handstand, tumbling overhead, and bar path control when progressed from horizontal push competency.',
    whyItGoesHere:
      'Belongs in vertical_push_strength (434) — primary Capacity vertical push after horizontal push base.',
    commonMisuse: `${CLUSTER_MISUSE} Do not lean back to finish reps, use leg drive, or prescribe before push-up control. Not a push-press or jerk pattern.`,
    scalingGuidance:
      'Regress to tall-kneeling or lighter load; shorten ROM before adding weight. Complete all reps one side before switching or alternate by set — be consistent.',
    movementRequirements: {
      primary_joint_actions: ['shoulder_flexion', 'shoulder_extension', 'elbow_extension', 'scapular_upward_rotation'],
      primary_tissues: ['anterior_deltoid', 'triceps', 'serratus_anterior', 'core', 'hip_flexors'],
      breathing_demand: 'nasal',
      balance_demand: 'dynamic',
      impact_level: 0,
      prerequisites: ['push-up'],
    },
    setupRequirements: [...SETUP_COMMON, 'Mat or pad for kneeling knee comfort'],
    coachingExecution: {
      movement_description:
        'Half-kneeling stance, dumbbell at shoulder, press overhead to full extension without rib flare, lower under control with trunk braced.',
      setup: [
        'Set half-kneeling — front foot flat, back knee down on pad.',
        'Select dumbbell or kettlebell load appropriate to skill.',
        'Rack weight at shoulder with wrist stacked.',
        'Confirm horizontal push competency and pain-free overhead range.',
      ],
      execution_steps: [
        'Brace ribs down and glutes on.',
        'Press vertically — biceps by ear at top.',
        'Avoid leaning back or rib flare.',
        'Lower under control to shoulder rack.',
        'Keep hips square — no trunk rotation.',
        'Complete reps per side with full rest between sets.',
      ],
      breathing_cues: ['Brace before press — exhale through top without losing ribs down.'],
      coach_cues: ['Ribs down.', 'Press straight up.', 'No lean back.', 'Hips square.', 'Control the descent.'],
      athlete_cues: ['Tight core.', 'Press up.', 'Stay tall.', 'No arch.'],
      common_faults: [
        'Leaning back to finish press.',
        'Rib flare at lockout.',
        'Trunk rotating toward pressing side.',
        'Pressing forward instead of vertical.',
        'Using leg drive from half-kneel.',
        'Short rest alternating arms as conditioning.',
      ],
      stop_signs: [
        'Shoulder pinching at overhead range.',
        'Sharp anterior shoulder pain.',
        'Low back pain from arching every rep.',
        'Cannot press without lean-back compensation.',
        'Loss of half-kneeling balance every rep.',
      ],
    },
    dosage: {
      volume_unit: 'reps',
      default_sets: 3,
      default_reps: 8,
      default_rest_seconds: 90,
      est_seconds_per_set: 45,
      tempo: '2-0-1-0',
      default_rpe_min: 6,
      default_rpe_max: 8,
      session_volume_min: '12 reps per side',
      session_volume_max: '32 reps per side',
    },
    phaseProfile: {
      role: 'primary',
      fit_weight: 5,
      freshness_required: false,
      fatigue_sensitivity: 3,
      fatigue_cost: 3,
      technical_complexity: 3,
      impact_level: 0,
      intensity_ceiling: 'moderate_to_high',
      daily_ok: false,
      requires_supervision: 'recommended',
      notes: 'Requires horizontal push competency. Primary vertical push before inverted and support progressions.',
    },
    scalingOverrides: {
      youth_beginner: 'Tall-kneeling or landmine press regression with coach.',
      youth_intermediate: 'Light half-kneeling press when push-up is clean.',
      teen: 'Progress load when trunk stays braced without lean-back.',
      adult_beginner: 'Tall-kneeling or lighter load before half-kneeling.',
      adult_advanced: 'Heavier single-arm press with pause at top.',
      older_adult: 'Seated or tall-kneeling press with conservative load.',
      pregnancy_postpartum: 'Reduce load and ROM; avoid max overhead intent unless cleared.',
    },
    pairsWellBefore: ['Push-Up', 'Wall Slides with Lift-Off', 'Dead Bug', 'Half-Kneeling Pallof Hold'],
    pairsWellAfter: ['Pike Push-Up / Box Pike Push-Up', 'Overhead Carry', 'Dip Support / Ring Support Hold'],
    avoidBefore: ['Overhead press if horizontal push base is poor', 'Handstand Output if shoulders are pre-fatigued from heavy vertical push'],
    doNotUseWhen: ['Shoulder pinching overhead', 'No push-up competency', 'Lean-back every rep', 'Used as push-press or conditioning circuit'],
    mediaReferences: ['Half-kneeling press for trunk and shoulder integration', 'NSCA overhead pressing progressions from half-kneel'],
    mediaInternalNotes: ['Prerequisite push-up recommended. Flag lean-back compensation on validator review.'],
  }),
  card({
    slug: 'pike-push-up-box-pike-push-up',
    name: 'Pike Push-Up / Box Pike Push-Up',
    slot: 'inverted_push_strength',
    cardSummary:
      'Capacity pike or box-elevated pike push-up that builds inverted pressing strength, shoulder flexion force, and handstand-relevant vertical push demand with controlled reps.',
    bestPlacement:
      'inverted_push_strength after push-up and optional vertical press competency; before dip support or handstand Output when inverted push control is the goal.',
    description:
      'The athlete sets hips high in pike position — feet on floor or elevated on box — lowers head toward floor or box edge under control, and presses back to pike with braced trunk and active shoulders.',
    coachLanguage:
      'Use for inverted pressing capacity with intentional tempo and full rest. Not a handstand hold, walk, or explosive Output skill drill.',
    athleteLanguage: 'Hips up, head toward the floor, press the ground away, and stay tight through your shoulders and core.',
    tenets: [
      { key: 'strength', weight: 5 },
      { key: 'body_control', weight: 5 },
      { key: 'balance', weight: 4 },
      { key: 'coordination', weight: 4 },
    ],
    methodologies: [
      { key: 'resistance_calisthenics', weight: 5 },
      { key: 'balance_stability', weight: 4 },
      { key: 'core_body_control', weight: 4 },
    ],
    physiology: [
      { key: 'force_tissue_capacity', weight: 5 },
      { key: 'control_stability', weight: 5 },
    ],
    patterns: [
      { key: 'push', weight: 5 },
      { key: 'invert', weight: 4 },
      { key: 'brace', weight: 4 },
    ],
    equipment: [
      { key: 'none', weight: 4 },
      { key: 'box', weight: 4 },
      { key: 'mat', weight: 2 },
    ],
    body_regions: [
      { key: 'shoulder', weight: 5 },
      { key: 'core', weight: 4 },
      { key: 'triceps', weight: 4 },
      { key: 'wrist', weight: 4 },
    ],
    whyItWorks:
      'Pike push-ups increase shoulder flexion demand and shift load toward deltoids and triceps in an inverted pressing angle relevant to handstand push-up progressions. Box elevation adjusts difficulty while preserving Capacity intent with controlled reps and full rest.',
    whyItGoesHere:
      'Belongs in inverted_push_strength (435) — inverted Capacity push after horizontal push base, before dip support and handstand Output.',
    commonMisuse: `${CLUSTER_MISUSE} Do not collapse into forward fold without shoulder load, rep out with short rest, or prescribe before push-up control. Not a handstand skill substitute.`,
    scalingGuidance:
      'Regress to box pike with hands elevated or feet on floor with shallow ROM; progress to feet-elevated pike only when head path and shoulder control stay clean. Use tempo before ROM depth increases.',
    movementRequirements: {
      primary_joint_actions: ['shoulder_flexion', 'shoulder_extension', 'elbow_flexion', 'elbow_extension', 'scapular_upward_rotation'],
      primary_tissues: ['anterior_deltoid', 'triceps', 'serratus_anterior', 'core', 'wrist_flexors'],
      breathing_demand: 'nasal',
      balance_demand: 'dynamic',
      impact_level: 0,
      prerequisites: ['push-up'],
    },
    setupRequirements: [...SETUP_COMMON, 'Box or bench for feet-elevated pike variation when progressed'],
    coachingExecution: {
      movement_description:
        'Pike position with hips high, controlled descent of head toward floor or box, press back to pike with active shoulders and braced trunk.',
      setup: [
        'Select floor pike or box feet-elevated pike based on skill.',
        'Hands shoulder-width, fingers spread.',
        'Walk feet in until hips stack over shoulders as tolerated.',
        'Confirm push-up competency and wrist tolerance.',
      ],
      execution_steps: [
        'Set pike — hips high, ears between arms.',
        'Lower head toward floor or target under control.',
        'Keep elbows tracking — not flaring wide.',
        'Press through hands to return to pike.',
        'Maintain trunk brace — no sag at top.',
        'Rest fully between sets.',
      ],
      breathing_cues: ['Brace before descent — controlled exhale through the press.'],
      coach_cues: ['Hips up.', 'Head between hands.', 'Elbows back.', 'Push the floor.', 'Stay active in shoulders.'],
      athlete_cues: ['Pike tall.', 'Down slow.', 'Press.', 'Stay tight.'],
      common_faults: [
        'Hips too low — becomes regular push-up.',
        'Collapsing into forward fold without pressing.',
        'Head landing hard on floor.',
        'Elbows flaring excessively.',
        'Wrist collapsing under load.',
        'Short rest high-rep burnout.',
      ],
      stop_signs: [
        'Shoulder pinching in inverted position.',
        'Wrist pain limiting hand support.',
        'Neck compression from head hitting floor hard.',
        'Cannot control eccentric descent.',
        'Dizziness or blood-pressure symptoms in inverted position.',
      ],
    },
    dosage: {
      volume_unit: 'reps',
      default_sets: 3,
      default_reps: 8,
      default_rest_seconds: 90,
      est_seconds_per_set: 45,
      tempo: '2-0-1-0',
      default_rpe_min: 6,
      default_rpe_max: 8,
      session_volume_min: '12 reps',
      session_volume_max: '32 reps',
    },
    phaseProfile: {
      role: 'primary',
      fit_weight: 4,
      freshness_required: false,
      fatigue_sensitivity: 4,
      fatigue_cost: 4,
      technical_complexity: 4,
      impact_level: 0,
      intensity_ceiling: 'moderate_to_high',
      daily_ok: false,
      requires_supervision: 'recommended',
      notes: 'Requires push-up competency. Inverted demand — supervise ROM and wrist tolerance before feet-elevated progressions.',
    },
    scalingOverrides: {
      youth_beginner: 'Box pike with hands elevated — not feet-elevated pike.',
      youth_intermediate: 'Floor pike with shallow ROM and coach supervision.',
      teen: 'Progress to feet on box when floor pike is clean.',
      adult_beginner: 'Hands-elevated pike or shallow floor pike.',
      adult_advanced: 'Feet-elevated pike with tempo pause at bottom.',
      older_adult: 'Hands-elevated pike with conservative ROM.',
      pregnancy_postpartum: 'Avoid deep inverted loading unless cleared; use hands-elevated regression.',
    },
    pairsWellBefore: ['Push-Up', 'Half-Kneeling Single-Arm Press', 'Wall Slides with Lift-Off', 'Wrist Rockers'],
    pairsWellAfter: ['Dip Support / Ring Support Hold', 'Handstand — Skill pattern'],
    avoidBefore: ['Feet-elevated pike before floor pike control', 'Handstand Output immediately after heavy pike block if shoulders are fatigued'],
    doNotUseWhen: ['No push-up competency', 'Wrist or shoulder pinching in pike', 'Head crashes floor every rep', 'Used as handstand skill substitute in Output block'],
    mediaReferences: ['Pike push-up progressions toward handstand push-up', 'Box pike push-up scaling for athletes'],
    mediaInternalNotes: ['Prerequisite push-up required. Distinguish Capacity pike from Skill handstand work.'],
  }),
  card({
    slug: 'dip-support-ring-support-hold',
    name: 'Dip Support / Ring Support Hold',
    slot: 'support_strength',
    cardSummary:
      'Capacity dip or ring support hold that builds locked-out pressing support strength, shoulder stability, and trunk bracing at the top of the dip position.',
    bestPlacement:
      'support_strength after push-up and pike push-up competency; end of push cluster or before dip eccentric progressions when support strength is the limiting factor.',
    description:
      'The athlete jumps or steps to support on parallel bars or rings, locks elbows with shoulders depressed and protracted, holds the top position for prescribed time, and descends under control or steps down safely.',
    coachLanguage:
      'Use for support strength with intentional hold time and full rest — not dip eccentrics for high volume, ring swings, or Fitness hold circuits with short rest.',
    athleteLanguage: 'Jump to support, lock your arms, push the bars away, stay tight, and hold strong without shrugging.',
    tenets: [
      { key: 'strength', weight: 5 },
      { key: 'body_control', weight: 5 },
      { key: 'balance', weight: 4 },
      { key: 'coordination', weight: 3 },
    ],
    methodologies: [
      { key: 'resistance_calisthenics', weight: 5 },
      { key: 'isometrics', weight: 4 },
      { key: 'balance_stability', weight: 4 },
    ],
    physiology: [
      { key: 'force_tissue_capacity', weight: 4 },
      { key: 'control_stability', weight: 5 },
    ],
    patterns: [
      { key: 'push', weight: 4 },
      { key: 'hang', weight: 3 },
      { key: 'brace', weight: 4 },
    ],
    equipment: [
      { key: 'rings', weight: 4 },
      { key: 'none', weight: 3 },
    ],
    body_regions: [
      { key: 'shoulder', weight: 5 },
      { key: 'triceps', weight: 5 },
      { key: 'core', weight: 4 },
      { key: 'wrist', weight: 3 },
    ],
    whyItWorks:
      'Top-of-dip support holds train isometric pressing strength, scapular depression and protraction, and trunk bracing at a position relevant to ring work, bar support, and tumbling hand support. Capacity dosing with short holds and full rest builds support reserve before dynamic dip or ring Output work.',
    whyItGoesHere:
      'Belongs in support_strength (436) — isometric Capacity support after horizontal and inverted push base, before dip eccentrics or ring Output.',
    commonMisuse: `${CLUSTER_MISUSE} Do not turn into high-rep dip eccentrics, allow shoulder shrug or elbow unlock, or prescribe before push-up and pike competency. Not a Control isometric in a warm-up circuit.`,
    scalingGuidance:
      'Regress to parallel bar support with feet assisted or shorter hold; progress hold time before adding ring instability. Use 10-second default holds with full rest.',
    movementRequirements: {
      primary_joint_actions: ['shoulder_extension', 'elbow_extension', 'scapular_depression', 'scapular_protraction'],
      primary_tissues: ['triceps', 'anterior_deltoid', 'serratus_anterior', 'core'],
      breathing_demand: 'nasal',
      balance_demand: 'dynamic',
      impact_level: 0,
      prerequisites: ['push-up', 'pike-push-up-box-pike-push-up'],
    },
    setupRequirements: [...SETUP_COMMON, 'Stable dip bars or ring setup at appropriate height', 'Mat or crash pad under rings for safe dismount'],
    coachingExecution: {
      movement_description:
        'Jump or step to top support on bars or rings, lock elbows, depress and protract shoulders, hold prescribed time with braced trunk, dismount safely.',
      setup: [
        'Set dip bars or rings at height athlete can safely enter support.',
        'Confirm push-up and pike push-up competency.',
        'Review safe jump-to-support and step-down entry.',
        'Place mat under rings if instability is high.',
      ],
      execution_steps: [
        'Jump or step to support with locked elbows.',
        'Depress shoulders — push bars or rings away.',
        'Ribs down, trunk braced, legs controlled.',
        'Hold prescribed time without shrug or unlock.',
        'Step down or lower under control to safe dismount.',
        'Rest fully before the next hold.',
      ],
      breathing_cues: ['Steady nasal breathing — do not hold breath and lose shoulder position.'],
      coach_cues: ['Lock elbows.', 'Push down on bars.', 'Shoulders away from ears.', 'Ribs down.', 'Safe dismount.'],
      athlete_cues: ['Lock.', 'Push down.', 'Stay tall.', 'Breathe.'],
      common_faults: [
        'Shoulders shrugging to ears.',
        'Elbows unlocking during hold.',
        'Ring or bar swing from leg kick.',
        'Turning hold into dip eccentrics for reps.',
        'Prescribing before push-up or pike base.',
        'Short rest between holds like conditioning.',
      ],
      stop_signs: [
        'Shoulder pinching in support position.',
        'Sharp anterior shoulder or sternum pain.',
        'Cannot achieve locked elbow support.',
        'Excessive ring instability without control.',
        'Dizziness or inability to dismount safely.',
      ],
    },
    dosage: {
      volume_unit: 'seconds',
      default_sets: 3,
      default_work_seconds: 10,
      default_rest_seconds: 60,
      est_seconds_per_set: 15,
      tempo: 'isometric_hold',
      default_rpe_min: 6,
      default_rpe_max: 8,
      session_volume_min: '20 seconds total',
      session_volume_max: '60 seconds total',
    },
    phaseProfile: {
      role: 'primary',
      fit_weight: 4,
      freshness_required: false,
      fatigue_sensitivity: 3,
      fatigue_cost: 3,
      technical_complexity: 3,
      impact_level: 0,
      intensity_ceiling: 'moderate_to_high',
      daily_ok: false,
      requires_supervision: 'recommended',
      notes: 'Requires push-up and pike push-up competency. Support hold — not dip eccentric volume. Progress hold time before ring instability.',
    },
    scalingOverrides: {
      youth_beginner: 'Feet-assisted bar support hold only with coach.',
      youth_intermediate: 'Parallel bar support, 3 × 8–10 seconds with full rest.',
      teen: 'Full support hold after push-up and pike mastery.',
      adult_beginner: 'Feet-assisted or shorter hold before full support.',
      adult_advanced: 'Ring support hold or weighted support progression.',
      older_adult: 'Feet-assisted bar support with conservative hold time.',
      pregnancy_postpartum: 'Avoid unsupported ring work unless cleared; use feet-assisted bar support.',
    },
    pairsWellBefore: ['Push-Up', 'Pike Push-Up / Box Pike Push-Up', 'Scapular Push-Up', 'Wrist Rockers'],
    pairsWellAfter: ['Ring Row / TRX Row', 'Handstand — Skill pattern', 'Dip Eccentric — Skill progression'],
    avoidBefore: ['Support hold before push-up and pike are clean', 'Ring Output swings immediately after support block if shoulders are fatigued'],
    doNotUseWhen: ['No push-up or pike competency', 'Shoulder shrugs every hold', 'Cannot lock elbows', 'Used as high-rep dip eccentric circuit'],
    mediaReferences: ['Dip support hold progressions for rings and bars', 'Support strength before dip and muscle-up progressions'],
    mediaInternalNotes: ['Prerequisites push-up and pike-push-up-box-pike-push-up. Distinguish Capacity hold from Skill dip eccentrics.'],
  }),
]

export const CAPACITY_PUSH_SLUGS = CAPACITY_PUSH_CARDS.map((c) => c.slug)
