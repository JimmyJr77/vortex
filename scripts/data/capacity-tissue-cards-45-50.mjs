/**
 * Rich card v2 content for Capacity phase Tissue Capacity cards 45–50.
 * Consumed by scripts/generate-127-capacity-tissue-cards.mjs
 * UPDATE-only on slugs seeded in migration 121.
 */

const GENDER_DEFAULT =
  'No default sex-based adjustment. Scale by movement quality, load tolerance, goals, and symptoms rather than gender alone.'

const SUBROLE = 'tissue_capacity_isometric_eccentric_accessory'
const FAMILY = 'Tissue capacity: isometric, eccentric & accessory strength'

const CLUSTER_MISUSE =
  'Capacity builds tissue, tendon, and accessory strength with controlled positions, meaningful time-under-tension, and full rest — not Prepare activation fluff, Fitness burnout circuits, or Control rehab-style holds at low intensity.'

const CLUSTER_PLACEMENT =
  'This cluster usually lives after Output and main Capacity lifts unless used as a low-intensity primer, readiness tool, or rehab-style accessory.'

const SCALING_BASE = {
  youth_beginner:
    'Conservative holds or reps with coach supervision; pain-free range only; stop on sharp symptoms or loss of control.',
  youth_intermediate:
    'Moderate dose with full rest between sets; prioritize position quality over hold time or load.',
  teen: 'Progress hold time, depth, or load only when alignment and symptoms stay clean.',
  adult_beginner: 'Start with regressions and shorter dose; master position before progressing hold time or load.',
  adult_advanced: 'Can progress hold time, depth, load, or lever length when mechanics and symptoms stay clean.',
  older_adult: 'Prefer supported regressions, shorter holds, and generous rest.',
  pregnancy_postpartum:
    'Use shallow range, no breath-holding, and symptom-guided loading with stable setup.',
}

const SETUP_COMMON = [
  'Secure band or strap anchor for Spanish squat setups',
  'Bench or box support for Copenhagen plank short lever',
  'Wall or tib bar for tibialis raise progressions',
  'Bench or calf-raise machine for seated soleus raise',
  'Light dumbbell, band, rice bucket, or wrist roller for wrist/forearm series',
]

/** @param {Record<string, unknown>} c */
function card(c) {
  return {
    family: FAMILY,
    subrole: SUBROLE,
    genderSpecificNotes: GENDER_DEFAULT,
    goodForSessions: ['capacity_tissue', 'tissue_capacity_accessory', 'injury_prevention'],
    scaling: { ...SCALING_BASE, ...(c.scalingOverrides ?? {}) },
    ...c,
  }
}

/** @type {import('./foundation-access-cards-1-10.mjs').FoundationCard[]} */
export const CAPACITY_TISSUE_CARDS = [
  card({
    slug: 'spanish-squat-isometric',
    name: 'Spanish Squat Isometric',
    slot: 'quad_tendon_capacity',
    cardSummary:
      'Band- or strap-assisted squat isometric that loads the quadriceps and anterior knee while allowing an upright trunk and controlled shin/knee position.',
    bestPlacement:
      `quad_tendon_capacity after Output and main Capacity squat work; ${CLUSTER_PLACEMENT}`,
    description:
      'The athlete anchors a thick band or strap behind the knees, leans backward into the support, descends into a squat, keeps the torso upright, and holds the position.',
    coachLanguage:
      'Use as a quad/patellar-tendon capacity drill or knee-friendly isometric squat option. It can be a useful bridge for athletes who need quad loading without heavy loaded squats.',
    athleteLanguage: 'Lean back into the strap, sit into a squat, keep your chest tall, and hold strong without pain.',
    tenets: [
      { key: 'strength', weight: 4 },
      { key: 'body_control', weight: 4 },
      { key: 'balance', weight: 3 },
    ],
    methodologies: [
      { key: 'isometrics', weight: 5 },
      { key: 'resistance_calisthenics', weight: 4 },
      { key: 'balance_stability', weight: 3 },
    ],
    physiology: [
      { key: 'force_tissue_capacity', weight: 5 },
      { key: 'control_stability', weight: 4 },
    ],
    patterns: [
      { key: 'squat', weight: 5 },
      { key: 'brace', weight: 3 },
    ],
    equipment: [
      { key: 'bands', weight: 5 },
      { key: 'strap', weight: 5 },
      { key: 'rack', weight: 3 },
    ],
    body_regions: [
      { key: 'knee', weight: 5 },
      { key: 'hip', weight: 4 },
      { key: 'ankle', weight: 2 },
      { key: 'core', weight: 3 },
    ],
    whyItWorks:
      'The Spanish squat is an isometric squat variation that can create strong quadriceps demand while the band or strap supports the athlete\'s body position. Research on the Basas Spanish Squat found that it can be a challenging quadriceps exercise even though it is isometric, and it is commonly discussed in patellar tendinopathy and anterior-knee-pain contexts.',
    whyItGoesHere:
      'Belongs in quad_tendon_capacity (461) — default Capacity quad/patellar tendon isometric after main squat work.',
    commonMisuse: `${CLUSTER_MISUSE} Do not use unsafe band anchors, passive hanging into the strap, or aggressive depth/hold progressions that irritate anterior knee symptoms.`,
    scalingGuidance:
      'Regress depth or hold time before reducing posture standard; hypermobility athletes need active knee/hip control — avoid hanging passively into the band.',
    movementRequirements: {
      primary_joint_actions: ['knee_flexion', 'hip_flexion', 'ankle_dorsiflexion', 'trunk_bracing'],
      primary_tissues: ['quadriceps', 'patellar_tendon', 'core'],
      breathing_demand: 'nasal',
      balance_demand: 'stable',
      impact_level: 0,
      prerequisites: [],
    },
    setupRequirements: [...SETUP_COMMON],
    coachingExecution: {
      movement_description:
        'Band or strap behind knees, lean back into support, squat to assigned depth, hold upright with active quads, breathe, exit carefully.',
      setup: [
        'Anchor thick band or strap securely behind athlete.',
        'Band sits behind both knees.',
        'Athlete steps back until band supports the knees.',
        'Feet about squat-width.',
        'Torso upright.',
      ],
      execution_steps: [
        'Lean back into the band.',
        'Descend into a squat position.',
        'Keep chest tall.',
        'Hold steady without bouncing.',
        'Breathe during the hold.',
        'Stand and step out carefully.',
      ],
      breathing_cues: ['Breathe through the brace — do not breath-hold to survive the hold.'],
      coach_cues: ['Lean into the strap.', 'Chest tall.', 'Knees strong.', 'Hold steady.', 'Breathe through the brace.'],
      athlete_cues: ['Sit and hold.', 'Tall chest.', 'Strong quads.', 'Breathe.'],
      common_faults: [
        'Band or strap anchored unsafely.',
        'Athlete relaxes into the band with no quad effort.',
        'Knees collapse inward.',
        'Depth is too deep for symptoms.',
        'Athlete holds breath.',
        'Load/hold is too aggressive too soon.',
      ],
      stop_signs: [
        'Sharp knee pain.',
        'Pain increases during or after the hold.',
        'Band slips.',
        'Numbness or tingling around knee.',
        'Athlete cannot exit position safely.',
      ],
    },
    dosage: {
      volume_unit: 'seconds',
      default_sets: 3,
      default_reps: null,
      default_work_seconds: 20,
      default_rest_seconds: 60,
      est_seconds_per_set: 90,
      tempo: 'static isometric hold',
      default_rpe_min: 4,
      default_rpe_max: 8,
      session_volume_min: 20,
      session_volume_max: 225,
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
      requires_supervision: 'recommended_for_symptomatic_athletes',
      notes: 'Strong quad/tendon loading option. Symptom response should guide depth, hold time, and frequency.',
    },
    scalingOverrides: {
      youth_beginner: 'Short shallow holds, 10–15 seconds, only if pain-free and supervised.',
      youth_intermediate: '2–3 holds of 15–25 seconds.',
      teen: 'Shallow-to-moderate depth, shorter holds first.',
      adult_beginner: 'Shallow-to-moderate depth, shorter holds first.',
      adult_advanced: 'Longer holds, deeper position, or load vest if tolerated.',
      older_adult: 'Supported wall sit or box squat hold may be better.',
      pregnancy_postpartum: 'Use shallow range, no breath-holding, and symptom-guided loading.',
    },
    pairsWellBefore: ['Split Squat Isometric Hold', 'Goblet Squat', 'Box Squat', 'Landing-control progressions'],
    pairsWellAfter: ['Squat pattern prep', 'Quad activation', 'Ankle Rockers', 'Step-Up'],
    avoidBefore: [
      'Jumping if knee symptoms worsen',
      'Hard COD if anterior knee pain is irritated',
      'Heavy squatting if isometric hold provokes symptoms',
    ],
    doNotUseWhen: [
      'Unsafe band/strap anchor',
      'Sharp anterior knee pain',
      'Pain increases after exposure',
      'Athlete cannot control knee alignment',
    ],
    mediaReferences: [
      'Basas Spanish Squat quadriceps isometric research',
      'Patellar tendinopathy isometric squat progressions',
    ],
    mediaInternalNotes: ['Validator should error on unsafe anchor; flag symptom increase after session.'],
  }),
  card({
    slug: 'split-squat-isometric-hold',
    name: 'Split Squat Isometric Hold',
    slot: 'split_stance_isometric',
    cardSummary:
      'Static split-stance hold that builds unilateral hip/knee tolerance, split-stance strength, trunk position, and lunge control.',
    bestPlacement:
      `split_stance_isometric after Output and main Capacity unilateral work; ${CLUSTER_PLACEMENT}`,
    description:
      'The athlete sets a split stance, lowers into a lunge/split squat position, and holds the position with the front knee tracking, back knee hovering, torso controlled, and feet stable.',
    coachLanguage:
      'Use as a bridge between split squat strength, lunge mechanics, sprint-start positions, and knee/hip tissue capacity.',
    athleteLanguage: 'Hold the split squat position, front knee strong, back knee hovering, trunk tall, and breathe.',
    tenets: [
      { key: 'strength', weight: 4 },
      { key: 'balance', weight: 4 },
      { key: 'body_control', weight: 5 },
      { key: 'coordination', weight: 2 },
    ],
    methodologies: [
      { key: 'isometrics', weight: 5 },
      { key: 'resistance_calisthenics', weight: 4 },
      { key: 'balance_stability', weight: 4 },
      { key: 'core_body_control', weight: 3 },
    ],
    physiology: [
      { key: 'force_tissue_capacity', weight: 4 },
      { key: 'control_stability', weight: 5 },
    ],
    patterns: [
      { key: 'squat', weight: 3 },
      { key: 'locomote', weight: 2 },
      { key: 'brace', weight: 3 },
    ],
    equipment: [
      { key: 'none', weight: 5 },
      { key: 'dumbbell', weight: 3 },
      { key: 'kettlebell', weight: 3 },
      { key: 'mat', weight: 2 },
    ],
    body_regions: [
      { key: 'knee', weight: 5 },
      { key: 'hip', weight: 5 },
      { key: 'ankle', weight: 3 },
      { key: 'core', weight: 3 },
      { key: 'spine', weight: 2 },
    ],
    whyItWorks:
      'Split-stance isometrics build positional strength and tissue tolerance without the coordination demand of stepping in and out of lunges. Isometrics are often useful when the goal is to hold a joint angle, build position tolerance, and control alignment before adding dynamic reps.',
    whyItGoesHere:
      'Belongs in split_stance_isometric (462) — unilateral split-stance Capacity isometric after bilateral squat base.',
    commonMisuse: `${CLUSTER_MISUSE} Do not allow knee valgus, breath-holding, or depth beyond control — not a lunge burnout circuit.`,
    scalingGuidance:
      'Regress to supported hold or shallow depth before reducing alignment standard; hypermobility athletes need active foot/knee/hip tension — avoid sinking passively.',
    movementRequirements: {
      primary_joint_actions: ['knee_flexion', 'hip_flexion', 'hip_stabilization', 'trunk_bracing'],
      primary_tissues: ['quadriceps', 'glutes', 'hip_stabilizers', 'core'],
      breathing_demand: 'nasal',
      balance_demand: 'single_leg',
      impact_level: 0,
      prerequisites: ['split-squat'],
    },
    setupRequirements: [...SETUP_COMMON, 'Mat or pad under back knee if needed'],
    coachingExecution: {
      movement_description:
        'Split stance, lower to assigned depth, front knee tracks toes, back knee hovers, hips square, hold and breathe, exit carefully — both sides.',
      setup: [
        'Set split stance.',
        'Front foot flat.',
        'Back heel lifted.',
        'Torso tall or slightly inclined.',
        'Back knee hovers above floor or pad.',
      ],
      execution_steps: [
        'Lower into split squat position.',
        'Hold at assigned depth.',
        'Keep front knee tracking toes.',
        'Keep hips square.',
        'Breathe during hold.',
        'Stand up or step out carefully.',
      ],
      breathing_cues: ['Breathe during the hold — do not breath-hold to survive the position.'],
      coach_cues: ['Front foot owns the floor.', 'Knee tracks toes.', 'Back knee hovers.', 'Stay tall.', 'Breathe.'],
      athlete_cues: ['Hold strong.', 'Knee steady.', 'Stay tall.', 'Breathe.'],
      common_faults: [
        'Front knee collapses inward.',
        'Stride is too narrow.',
        'Back knee rests on floor unintentionally.',
        'Torso twists or leans.',
        'Athlete holds breath.',
        'Depth exceeds control.',
      ],
      stop_signs: [
        'Knee pain.',
        'Hip pinching.',
        'Ankle instability.',
        'Cannot exit safely.',
        'Numbness or tingling.',
      ],
    },
    dosage: {
      volume_unit: 'seconds',
      default_sets: 3,
      default_reps: null,
      default_work_seconds: 20,
      default_rest_seconds: 45,
      est_seconds_per_set: 75,
      tempo: 'static isometric hold',
      default_rpe_min: 4,
      default_rpe_max: 8,
      session_volume_min: 20,
      session_volume_max: 180,
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
      notes: 'Useful for building split-stance tolerance before dynamic lunges, sprint-start strength, and unilateral loading.',
    },
    scalingOverrides: {
      youth_beginner: 'Supported split stance hold, shallow range, 10 seconds.',
      youth_intermediate: 'Bodyweight split squat hold, 15–25 seconds.',
      teen: 'Hand-supported hold or shorter depth.',
      adult_beginner: 'Hand-supported hold or shorter depth.',
      adult_advanced: 'Loaded split squat iso, front-foot elevated hold, or offset load.',
      older_adult: 'Supported split stance hold or staggered stance sit-to-stand.',
      pregnancy_postpartum: 'Use support, shallow range, and breathing control.',
    },
    pairsWellBefore: ['Split Squat', 'Reverse Lunge', 'Rear-Foot-Elevated Split Squat', 'Sprint start strength'],
    pairsWellAfter: ['Lunge pattern prep', 'Hip Flexor Prep', 'Single-Leg Balance Reach Clock', 'Spanish Squat Isometric'],
    avoidBefore: [
      'Dynamic lunges if iso position is unstable',
      'Sprint starts if split-stance knee/hip symptoms increase',
    ],
    doNotUseWhen: [
      'Painful split stance',
      'Uncontrolled knee valgus',
      'Poor balance without support',
      'Cannot exit safely',
    ],
    mediaReferences: ['Split-stance isometric progressions for unilateral knee/hip capacity', 'Lunge isometric hold coaching'],
    mediaInternalNotes: ['Validator should recommend support/regress on knee valgus or balance loss.'],
  }),
  card({
    slug: 'copenhagen-plank-short-lever',
    name: 'Copenhagen Plank — Short Lever',
    slot: 'adductor_capacity',
    cardSummary:
      'Short-lever side-plank variation that builds adductor, groin, lateral trunk, hip, and pelvis capacity.',
    bestPlacement:
      `adductor_capacity after Output and main Capacity lower-body work; default Copenhagen regression before long lever; ${CLUSTER_PLACEMENT}`,
    description:
      'The athlete lies side-on with the top knee or thigh supported on a bench/box, bottom leg underneath, forearm on the floor, and lifts the hips into a side-plank position.',
    coachLanguage:
      'Use as the default Copenhagen regression. Start short lever before long lever, and progress by hold time, lever length, and control.',
    athleteLanguage: 'Top knee or thigh on the bench, lift your hips, squeeze your inner thigh, and hold a straight body line.',
    tenets: [
      { key: 'strength', weight: 4 },
      { key: 'body_control', weight: 5 },
      { key: 'balance', weight: 4 },
      { key: 'coordination', weight: 3 },
    ],
    methodologies: [
      { key: 'isometrics', weight: 5 },
      { key: 'resistance_calisthenics', weight: 4 },
      { key: 'core_body_control', weight: 5 },
      { key: 'balance_stability', weight: 4 },
    ],
    physiology: [
      { key: 'force_tissue_capacity', weight: 5 },
      { key: 'control_stability', weight: 5 },
    ],
    patterns: [
      { key: 'brace', weight: 5 },
      { key: 'land', weight: 1 },
      { key: 'locomote', weight: 1 },
    ],
    equipment: [
      { key: 'bench', weight: 5 },
      { key: 'box', weight: 4 },
      { key: 'mat', weight: 3 },
    ],
    body_regions: [
      { key: 'hip', weight: 5 },
      { key: 'core', weight: 5 },
      { key: 'spine', weight: 3 },
      { key: 'knee', weight: 3 },
    ],
    whyItWorks:
      'The Copenhagen plank trains the adductors and lateral trunk, which are important for cutting, sprinting, lateral movement, and groin durability. A 2025 review describes the Copenhagen Adduction Exercise as one of the most studied eccentric exercises in groin-injury-prevention contexts, and E3 Rehab describes the short-lever version as lifting the hips until the body forms a straight line with the knee/thigh supported.',
    whyItGoesHere:
      'Belongs in adductor_capacity (463) — default short-lever Copenhagen before long-lever progressions.',
    commonMisuse: `${CLUSTER_MISUSE} Do not use long lever too soon, ignore groin pain, or stack holds with short rest as a burnout circuit.`,
    scalingGuidance:
      'Regress to side plank or adductor squeeze before long lever; hypermobility athletes need stacked pelvis/ribs — avoid end-range hip strain.',
    movementRequirements: {
      primary_joint_actions: ['hip_adduction', 'trunk_lateral_flexion', 'shoulder_stabilization'],
      primary_tissues: ['adductors', 'obliques', 'core', 'glutes'],
      breathing_demand: 'nasal',
      balance_demand: 'stable',
      impact_level: 0,
      prerequisites: [],
    },
    setupRequirements: [...SETUP_COMMON],
    coachingExecution: {
      movement_description:
        'Side-on to bench, top knee/thigh on bench, forearm down, press top leg into bench, lift hips to straight line, hold without twist, lower with control — both sides.',
      setup: [
        'Place top knee or thigh on bench.',
        'Bottom forearm on floor.',
        'Body side-on to bench.',
        'Bottom leg can stay on floor or lift if advanced.',
        'Stack ribs, pelvis, and shoulders.',
      ],
      execution_steps: [
        'Press top leg into bench.',
        'Lift hips into side plank.',
        'Keep body in straight line.',
        'Hold without twisting.',
        'Lower with control.',
        'Repeat both sides.',
      ],
      breathing_cues: ['Breathe steadily — do not breath-hold and sag hips.'],
      coach_cues: ['Top thigh pushes down.', 'Hips up.', 'Straight line.', 'Do not rotate.', 'Groin works, but no sharp pain.'],
      athlete_cues: ['Push down.', 'Lift hips.', 'Straight body.', 'Hold.'],
      common_faults: [
        'Using long lever too soon.',
        'Hips sag.',
        'Torso rotates forward or backward.',
        'Top knee/leg placement is uncomfortable.',
        'Athlete holds breath.',
        'Groin pain is ignored.',
      ],
      stop_signs: [
        'Sharp groin pain.',
        'Hip pinching.',
        'Knee discomfort on bench.',
        'Low-back pain.',
        'Cannot hold body line.',
      ],
    },
    dosage: {
      volume_unit: 'seconds',
      default_sets: 3,
      default_reps: null,
      default_work_seconds: 15,
      default_rest_seconds: 45,
      est_seconds_per_set: 75,
      tempo: 'static isometric hold',
      default_rpe_min: 4,
      default_rpe_max: 8,
      session_volume_min: 16,
      session_volume_max: 120,
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
      notes: 'Start short lever. Groin/adductor symptoms should be monitored carefully.',
    },
    scalingOverrides: {
      youth_beginner: 'Side plank or adductor squeeze instead.',
      youth_intermediate: 'Short-lever Copenhagen, 8–15 seconds.',
      teen: 'Short lever with top knee/thigh supported.',
      adult_beginner: 'Short lever with top knee/thigh supported.',
      adult_advanced: 'Longer holds, long-lever Copenhagen, dynamic reps, or bottom-leg lift.',
      older_adult: 'Side plank or seated adductor squeeze.',
      pregnancy_postpartum: 'Use side plank regression or adductor squeeze if appropriate and symptom-free.',
    },
    pairsWellBefore: ['Loaded Cossack Squat', 'Lateral Lunge', 'Lateral Bound to Stick', 'COD preparation'],
    pairsWellAfter: ['Adductor Rockback', 'Side Plank', 'Lateral Lunge Shift', 'Cossack Shift'],
    avoidBefore: [
      'Hard cutting if Copenhagen causes groin symptoms',
      'Loaded Cossack if adductor is irritated',
    ],
    doNotUseWhen: [
      'Acute groin strain',
      'Sharp adductor pain',
      'Cannot hold short-lever version',
      'Bench pressure causes knee pain',
    ],
    mediaReferences: [
      'Copenhagen adduction exercise groin-injury-prevention review',
      'E3 Rehab short-lever Copenhagen plank coaching',
    ],
    mediaInternalNotes: ['Validator should recommend short lever or adductor squeeze for beginners; stop on sharp groin pain.'],
  }),
  card({
    slug: 'tibialis-raise',
    name: 'Tibialis Raise',
    slot: 'shin_capacity',
    cardSummary:
      'Anterior-shin strengthening drill that trains ankle dorsiflexion capacity, shin tolerance, foot control, and lower-leg balance.',
    bestPlacement:
      `shin_capacity after Output and main Capacity work; daily-ok at low-to-moderate load; ${CLUSTER_PLACEMENT}`,
    description:
      'The athlete leans back against a wall with heels on the floor and lifts the toes toward the shins, then lowers the toes under control.',
    coachLanguage:
      'Use as a lower-leg accessory for athletes who sprint, jump, land, run, or need shin/ankle resilience. Start with wall-supported bodyweight.',
    athleteLanguage: 'Lean on the wall, keep your heels down, lift your toes toward your shins, and lower with control.',
    tenets: [
      { key: 'strength', weight: 3 },
      { key: 'balance', weight: 3 },
      { key: 'body_control', weight: 4 },
      { key: 'coordination', weight: 3 },
    ],
    methodologies: [
      { key: 'resistance_calisthenics', weight: 4 },
      { key: 'eccentric_negative', weight: 3 },
      { key: 'isometrics', weight: 2 },
      { key: 'balance_stability', weight: 3 },
    ],
    physiology: [
      { key: 'force_tissue_capacity', weight: 4 },
      { key: 'control_stability', weight: 4 },
    ],
    patterns: [
      { key: 'locomote', weight: 3 },
      { key: 'land', weight: 2 },
      { key: 'brace', weight: 1 },
    ],
    equipment: [
      { key: 'none', weight: 4 },
      { key: 'wall', weight: 4 },
      { key: 'tib_bar', weight: 4 },
      { key: 'bands', weight: 2 },
    ],
    body_regions: [
      { key: 'ankle', weight: 5 },
      { key: 'knee', weight: 1 },
      { key: 'hip', weight: 1 },
    ],
    whyItWorks:
      'Tibialis raises strengthen the anterior tibialis, the muscle group responsible for dorsiflexing the ankle and helping control foot position. Hinge Health describes tibialis raises as a strengthening exercise for shin, ankle, and foot strength, often performed by leaning against a wall and lifting the toes off the ground; a 2023 study also reported that tibialis anterior resistance training can improve tibialis anterior strength and ankle/foot function.',
    whyItGoesHere:
      'Belongs in shin_capacity (464) — anterior shin Capacity accessory; can be used frequently at low-to-moderate load.',
    commonMisuse: `${CLUSTER_MISUSE} Do not ignore cramping, use aggressive wall angle, or stack high volume before sprint/jump Output when shins are irritated.`,
    scalingGuidance:
      'Regress to seated toe lifts or closer wall angle before adding tib bar load; hypermobility athletes need controlled range — avoid aggressive end-range snapping.',
    movementRequirements: {
      primary_joint_actions: ['ankle_dorsiflexion'],
      primary_tissues: ['tibialis_anterior'],
      breathing_demand: 'nasal',
      balance_demand: 'stable',
      impact_level: 0,
      prerequisites: [],
    },
    setupRequirements: [...SETUP_COMMON],
    coachingExecution: {
      movement_description:
        'Back against wall, heels down, lift toes toward shins with brief pause, lower under control without hip rocking.',
      setup: [
        'Stand with back against wall.',
        'Feet slightly in front of body.',
        'Heels stay on floor.',
        'Knees mostly straight or softly bent.',
        'Hands can rest on wall.',
      ],
      execution_steps: [
        'Lift toes toward shins.',
        'Pause briefly at top.',
        'Lower toes under control.',
        'Keep heels planted.',
        'Maintain steady rhythm.',
        'Stop before cramping or sloppy reps.',
      ],
      breathing_cues: ['Breathe normally — avoid bracing the neck or jaw.'],
      coach_cues: ['Heels stay down.', 'Lift toes high.', 'Control the lower.', 'Do not rock hips.', 'Shins do the work.'],
      athlete_cues: ['Toes up.', 'Slow down.', 'Heels down.', 'Shins work.'],
      common_faults: [
        'Heels lift.',
        'Athlete rocks hips instead of lifting toes.',
        'Range gets smaller with fatigue.',
        'Cramping is ignored.',
        'Too much volume too soon.',
        'Wall angle too aggressive.',
      ],
      stop_signs: [
        'Sharp shin pain.',
        'Anterior ankle pain.',
        'Numbness or tingling.',
        'Cramping that does not resolve.',
        'Pain worsens after session.',
      ],
    },
    dosage: {
      volume_unit: 'reps',
      default_sets: 2,
      default_reps: 15,
      default_rest_seconds: 30,
      est_seconds_per_set: 45,
      tempo: 'controlled up, controlled down',
      default_rpe_min: 3,
      default_rpe_max: 7,
      session_volume_min: 10,
      session_volume_max: 100,
    },
    phaseProfile: {
      role: 'primary',
      fit_weight: 4,
      freshness_required: false,
      fatigue_sensitivity: 2,
      fatigue_cost: 2,
      technical_complexity: 2,
      impact_level: 0,
      intensity_ceiling: 'low_to_moderate',
      daily_ok: true,
      requires_supervision: 'optional',
      notes: 'Can be used frequently at low-to-moderate load. Hard loaded tib work still needs progression.',
    },
    scalingOverrides: {
      youth_beginner: 'Wall tib raises, 1–2 sets of 8–12.',
      youth_intermediate: 'Wall tib raises, 2–3 sets of 12–20.',
      teen: 'Wall-supported version before tib bar or band.',
      adult_beginner: 'Wall-supported version before tib bar or band.',
      adult_advanced: 'Tib bar, banded dorsiflexion, or single-leg tib raise.',
      older_adult: 'Seated toe raises or wall-supported tib raises.',
      pregnancy_postpartum: 'Generally low risk when balance is supported; use wall support.',
    },
    pairsWellBefore: ['Seated Soleus Raise', 'Low Pogos', 'Sprint mechanics', 'Ankle capacity block'],
    pairsWellAfter: ['Ankle Rockers', 'Foot Tripod Weight Shifts', 'Calf Raise', 'A-March'],
    avoidBefore: [
      'High-volume jump work if shins are irritated',
      'Sprint volume if tib raises provoke shin pain',
    ],
    doNotUseWhen: [
      'Sharp shin pain',
      'Anterior ankle impingement',
      'Symptoms worsen with dorsiflexion',
      'Pain increases after loading',
    ],
    mediaReferences: [
      'Hinge Health tibialis raise dorsiflexion strengthening',
      'Tibialis anterior resistance training ankle/foot function research',
    ],
    mediaInternalNotes: ['daily_ok true — validator should warn on high volume before sprint/jump session.'],
  }),
  card({
    slug: 'seated-soleus-raise-bent-knee-calf-raise',
    name: 'Seated Soleus Raise / Bent-Knee Calf Raise',
    slot: 'soleus_capacity',
    cardSummary:
      'Bent-knee calf-strength drill that biases the soleus and supports Achilles, landing, running, sprinting, and lower-leg capacity.',
    bestPlacement:
      `soleus_capacity after Output and main Capacity work; default soleus/Achilles Capacity card; ${CLUSTER_PLACEMENT}`,
    description:
      'The athlete sits with knees bent, forefeet on the floor or a small step, load placed over the thighs if appropriate, lifts the heels high, pauses, then lowers under control.',
    coachLanguage:
      'Use as the default soleus/Achilles capacity card. Bent-knee calf work targets the soleus more than straight-knee calf work.',
    athleteLanguage: 'Sit tall, knees bent, push through the balls of your feet, lift your heels high, then lower slowly.',
    tenets: [
      { key: 'strength', weight: 4 },
      { key: 'balance', weight: 2 },
      { key: 'body_control', weight: 3 },
      { key: 'explosiveness', weight: 1 },
    ],
    methodologies: [
      { key: 'resistance_calisthenics', weight: 5 },
      { key: 'eccentric_negative', weight: 3 },
      { key: 'isometrics', weight: 3 },
    ],
    physiology: [
      { key: 'force_tissue_capacity', weight: 5 },
      { key: 'control_stability', weight: 3 },
      { key: 'ssc_stiffness', weight: 1 },
    ],
    patterns: [
      { key: 'locomote', weight: 3 },
      { key: 'land', weight: 2 },
      { key: 'jump', weight: 1 },
    ],
    equipment: [
      { key: 'dumbbell', weight: 3 },
      { key: 'kettlebell', weight: 3 },
      { key: 'bench', weight: 3 },
      { key: 'calf_raise_machine', weight: 5 },
      { key: 'step', weight: 3 },
    ],
    body_regions: [
      { key: 'ankle', weight: 5 },
      { key: 'knee', weight: 2 },
      { key: 'hip', weight: 1 },
    ],
    whyItWorks:
      'Bent-knee calf raises bias the soleus because the knee-flexed position reduces gastrocnemius contribution and increases the relative role of the deeper calf muscle. TreatMyAchilles describes bent-knee calf raises as an effective way to target the soleus and the Achilles tendon portion associated with it, and RehabHero describes seated calf raises as specifically targeting the soleus with forefoot elevation and load placed near the knee.',
    whyItGoesHere:
      'Belongs in soleus_capacity (465) — default Capacity soleus/Achilles bent-knee calf raise.',
    commonMisuse: `${CLUSTER_MISUSE} Do not bounce reps, progress load too fast with Achilles symptoms, or stack hard soleus work before high-volume pogos or sprints.`,
    scalingGuidance:
      'Regress to bodyweight seated raises before loading; hypermobility athletes need controlled top and bottom range — avoid collapsing into end range.',
    movementRequirements: {
      primary_joint_actions: ['ankle_plantarflexion', 'knee_flexion'],
      primary_tissues: ['soleus', 'achilles'],
      breathing_demand: 'nasal',
      balance_demand: 'stable',
      impact_level: 0,
      prerequisites: [],
    },
    setupRequirements: [...SETUP_COMMON],
    coachingExecution: {
      movement_description:
        'Seated with knees bent, forefeet on floor or step, press through balls of feet, raise heels high with pause, lower slowly without bounce.',
      setup: [
        'Sit on bench or machine.',
        'Knees bent around 90 degrees or comfortable angle.',
        'Forefeet on floor or edge of step.',
        'Load placed over thighs near knees if used.',
        'Toes stay in contact.',
      ],
      execution_steps: [
        'Press through balls of feet.',
        'Raise heels as high as controlled.',
        'Pause at top.',
        'Lower slowly to controlled depth.',
        'Avoid bouncing.',
        'Repeat with steady rhythm.',
      ],
      breathing_cues: ['Exhale on the raise; steady breath on the lower — no breath-holding.'],
      coach_cues: ['Lift heels high.', 'Pause at top.', 'Slow lower.', 'Do not bounce.', 'Keep pressure through big toe and little toe.'],
      athlete_cues: ['Heels up.', 'Squeeze calf.', 'Slow down.', 'Control.'],
      common_faults: [
        'Bouncing out of bottom.',
        'Toes lose contact.',
        'Feet roll outward.',
        'Range shortens with fatigue.',
        'Load digs painfully into thighs.',
        'Too much volume too soon.',
      ],
      stop_signs: [
        'Sharp Achilles pain.',
        'Calf strain sensation.',
        'Foot cramping that persists.',
        'Pain worsens after session.',
        'Numbness or tingling.',
      ],
    },
    dosage: {
      volume_unit: 'reps',
      default_sets: 3,
      default_reps: 12,
      default_rest_seconds: 45,
      est_seconds_per_set: 60,
      tempo: '1 sec up, 1 sec pause, 3 sec down',
      default_rpe_min: 4,
      default_rpe_max: 8,
      session_volume_min: 16,
      session_volume_max: 100,
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
      requires_supervision: 'optional',
      notes: 'Important lower-leg tissue capacity drill. Progress slowly if Achilles/calf symptoms exist.',
    },
    scalingOverrides: {
      youth_beginner: 'Seated bodyweight calf raises, 1–2 sets of 10–15.',
      youth_intermediate: 'Light loaded seated soleus raise.',
      teen: 'Seated loaded raise, slow eccentric.',
      adult_beginner: 'Seated loaded raise, slow eccentric.',
      adult_advanced: 'Heavy seated calf raise, single-leg bent-knee calf raise, or isometric holds.',
      older_adult: 'Seated calf raise with light load or machine support.',
      pregnancy_postpartum: 'Generally scalable; avoid breath-holding and use stable seated setup.',
    },
    pairsWellBefore: ['Tibialis Raise', 'Pogos', 'Sprint mechanics', 'Lower-leg capacity block'],
    pairsWellAfter: ['Ankle Rockers', 'Foot Tripod Weight Shifts', 'Wall Calf Stretch', 'Standing Calf Raise'],
    avoidBefore: [
      'High-volume pogos if soleus/Achilles is fatigued',
      'Max sprinting after hard calf capacity if lower legs feel heavy',
    ],
    doNotUseWhen: [
      'Sharp Achilles pain',
      'Acute calf strain',
      'Pain worsens after bent-knee loading',
      'Foot cramps persist',
    ],
    mediaReferences: [
      'TreatMyAchilles bent-knee calf raise soleus targeting',
      'RehabHero seated calf raise soleus loading',
    ],
    mediaInternalNotes: ['Validator should warn on hard soleus work before high-volume pogos, sprints, or jumps.'],
  }),
  card({
    slug: 'wrist-forearm-capacity-series',
    name: 'Wrist / Forearm Capacity Series',
    slot: 'wrist_forearm_capacity',
    cardSummary:
      'Accessory series for wrist flexion, wrist extension, pronation/supination, grip, and hand-support tolerance.',
    bestPlacement:
      `wrist_forearm_capacity after Output and main Capacity work; choose 2–4 drills per session; ${CLUSTER_PLACEMENT}`,
    description:
      'The athlete performs a small series of controlled wrist and forearm drills, usually 2–4 selected movements per session. The coach chooses based on the athlete\'s sport demand and symptoms.',
    coachLanguage:
      'Use as the default wrist/forearm capacity card for gymnastics, tumbling, ninja, climbing, crawling, handstands, bars, rings, and grip work.',
    athleteLanguage: 'Move the wrist slowly, control the weight, build both sides of the forearm, and stop if pain gets sharp.',
    tenets: [
      { key: 'strength', weight: 4 },
      { key: 'body_control', weight: 4 },
      { key: 'coordination', weight: 3 },
      { key: 'balance', weight: 1 },
    ],
    methodologies: [
      { key: 'resistance_calisthenics', weight: 4 },
      { key: 'eccentric_negative', weight: 3 },
      { key: 'isometrics', weight: 3 },
      { key: 'core_body_control', weight: 1 },
    ],
    physiology: [
      { key: 'force_tissue_capacity', weight: 5 },
      { key: 'control_stability', weight: 4 },
    ],
    patterns: [
      { key: 'hang', weight: 3 },
      { key: 'push', weight: 2 },
      { key: 'pull', weight: 2 },
      { key: 'brace', weight: 1 },
    ],
    equipment: [
      { key: 'dumbbell', weight: 4 },
      { key: 'bands', weight: 3 },
      { key: 'wrist_roller', weight: 4 },
      { key: 'rice_bucket', weight: 3 },
      { key: 'grip_tool', weight: 3 },
    ],
    body_regions: [
      { key: 'wrist', weight: 5 },
      { key: 'elbow', weight: 4 },
      { key: 'shoulder', weight: 1 },
    ],
    whyItWorks:
      'Wrist and forearm capacity matters because gymnasts, tumblers, ninja athletes, and climbers repeatedly load the hands through gripping, hanging, crawling, hand support, and impact positions. Hinge Health lists wrist strengthening drills as useful for improving mobility, reducing pain, and supporting hand/wrist function, while grip-strength research and reviews emphasize that grip can be a limiting factor in strength and sport performance. A good series should cover both sides of the forearm: wrist flexion, wrist extension, pronation, supination, radial/ulnar deviation, finger flexor/grip work, and hand-support tolerance.',
    whyItGoesHere:
      'Belongs in wrist_forearm_capacity (466) — default Capacity wrist/forearm/grip accessory series; can be frequent at low intensity.',
    commonMisuse: `${CLUSTER_MISUSE} Do not load too heavy, train flexors only, or work to grip failure before ninja, bars, rings, or tumbling skill work.`,
    scalingGuidance:
      'Choose 2–4 drills per session with light load; hypermobility athletes need active control and small loads — avoid end-range hanging.',
    movementRequirements: {
      primary_joint_actions: ['wrist_flexion', 'wrist_extension', 'forearm_pronation', 'forearm_supination', 'grip'],
      primary_tissues: ['forearm_flexors', 'forearm_extensors', 'finger_flexors'],
      breathing_demand: 'nasal',
      balance_demand: 'stable',
      impact_level: 0,
      prerequisites: [],
    },
    setupRequirements: [...SETUP_COMMON],
    coachingExecution: {
      movement_description:
        'Coach selects 2–4 controlled wrist/forearm drills from the series options; athlete performs slow reps or short holds with forearm supported and pain-free range.',
      series_options: [
        'Wrist extension curl',
        'Wrist flexion curl',
        'Pronation / supination with light dumbbell or hammer',
        'Radial / ulnar deviation',
        'Wrist roller',
        'Rice bucket open / close / rotate',
        'Finger extension band opens',
        'Grip squeeze or towel squeeze',
        'Quadruped wrist rockers',
        'Palm lift / fingertip support progression',
      ],
      setup: [
        'Choose 2-4 drills based on athlete need.',
        'Use light load.',
        'Forearm supported for isolation drills.',
        'Move slowly through pain-free range.',
        'Stop before form or symptoms degrade.',
      ],
      execution_steps: [
        'Control the full range.',
        'Pause briefly at end range if assigned.',
        'Lower slowly.',
        'Avoid jerky reps.',
        'Train both sides of the forearm.',
        'Track symptom response after session.',
      ],
      breathing_cues: ['Breathe normally — avoid jaw/neck tension during grip work.'],
      coach_cues: ['Slow and controlled.', 'Small joints, small load.', 'Train both directions.', 'No sharp pain.', 'Stop before grip fails.'],
      athlete_cues: ['Control it.', 'Light weight.', 'Both sides.', 'No sharp pain.'],
      common_faults: [
        'Load too heavy.',
        'Jerky wrist reps.',
        'Only training wrist flexors and ignoring extensors.',
        'Working to grip failure before skill work.',
        'Ignoring radial-side wrist pain.',
        'Too much volume after hanging/climbing.',
      ],
      stop_signs: [
        'Sharp wrist pain.',
        'Numbness or tingling.',
        'Pain with gripping that worsens.',
        'Thumb-side wrist pain during grip or deviation.',
        'Loss of hand support tolerance.',
      ],
    },
    dosage: {
      volume_unit: 'reps_or_seconds',
      default_sets: 2,
      default_reps: 12,
      default_work_seconds: 20,
      default_rest_seconds: 30,
      est_seconds_per_set: 45,
      tempo: 'slow controlled reps',
      default_rpe_min: 2,
      default_rpe_max: 6,
      session_volume_min: 4,
      session_volume_max: 24,
    },
    phaseProfile: {
      role: 'primary',
      fit_weight: 5,
      freshness_required: false,
      fatigue_sensitivity: 3,
      fatigue_cost: 2,
      technical_complexity: 3,
      impact_level: 0,
      intensity_ceiling: 'low_to_moderate',
      daily_ok: true,
      requires_supervision: 'optional',
      notes: 'Can be frequent at low intensity. Hard grip/forearm work should not be placed before ninja, bars, rings, or tumbling if it compromises hand support.',
    },
    scalingOverrides: {
      youth_beginner: 'Wrist rockers, rice bucket, light band finger opens, short sets.',
      youth_intermediate: 'Light dumbbell wrist flexion/extension and grip series.',
      teen: '2–3 drills, light load, controlled reps.',
      adult_beginner: '2–3 drills, light load, controlled reps.',
      adult_advanced: 'Wrist roller, loaded pronation/supination, heavier grip work, sport-specific holds.',
      older_adult: 'Light wrist ROM, grip squeeze, and supported wrist curls.',
      pregnancy_postpartum: 'Use light grip/wrist work; monitor fluid-related wrist symptoms or numbness.',
    },
    pairsWellBefore: [
      'Dead Hang / Active Hang',
      'Ring Support Hold',
      'Handstand Prep',
      'Rope Climb Progression',
      'Ninja Grip Work',
    ],
    pairsWellAfter: ['Wrist Rockers', 'Palm Pulses', 'Forearm Soft Tissue Prep', 'Scapular Push-Up'],
    avoidBefore: [
      'Max grip work before ninja obstacles',
      'Hard wrist extension work before handstand/tumbling if it causes fatigue',
      'High-volume forearm work after rope climbs',
    ],
    doNotUseWhen: [
      'Sharp wrist pain',
      'Numbness or tingling',
      'Grip pain worsening with reps',
      'Recent wrist injury without clearance',
      'Hand support becomes painful after series',
    ],
    mediaReferences: [
      'Hinge Health wrist strengthening drills',
      'Healthline forearm exercise and grip strength guidance',
      'PureGym wrist-strengthening and stretching balance across the week',
    ],
    mediaInternalNotes: [
      'daily_ok true — validator should warn on wrist/grip fatigue before tumbling, handstand, ninja, rings, or bar work.',
    ],
  }),
]

export const CAPACITY_TISSUE_SLUGS = CAPACITY_TISSUE_CARDS.map((c) => c.slug)
