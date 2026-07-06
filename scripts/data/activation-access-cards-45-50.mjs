/**
 * Rich card v2 content for Prepare/Access activation + integrated movement-prep cards 45–50.
 * Consumed by scripts/generate-103-activation-access-cards.mjs
 */

const GENDER_DEFAULT =
  'No sex-based default. Scale by trunk control, hip control, coordination, sport demand, and symptoms.'

/** @type {import('./foundation-access-cards-1-10.mjs').FoundationCard[]} */
export const ACTIVATION_ACCESS_CARDS = [
  {
    slug: 'glute-bridge',
    name: 'Glute Bridge',
    family: 'Glute activation',
    subrole: 'activate',
    slot: 'glute_activation',
    cardSummary:
      'Low-level hip-extension activation drill that teaches athletes to use the glutes while controlling ribcage, pelvis, and spine.',
    bestPlacement:
      'After hip/spine access and before sprint, jump, squat, lunge, tumbling takeoff, or lower-body strength when hip-extension readiness is needed.',
    description:
      'Lie on the back with knees bent and feet flat. Lightly brace the trunk, drive through the heels and midfoot, squeeze the glutes, and lift the hips until the shoulders, hips, and knees form one line. Lower slowly.',
    coachLanguage:
      'Use before sprinting, jumping, squatting, lunging, tumbling takeoffs, and lower-body strength when the athlete needs hip-extension readiness.',
    athleteLanguage:
      'Drive through your heels, squeeze your glutes, and lift your hips without arching your back.',
    tenets: [
      { key: 'strength', weight: 2 },
      { key: 'body_control', weight: 4 },
      { key: 'balance', weight: 2 },
      { key: 'coordination', weight: 2 },
    ],
    methodologies: [
      { key: 'resistance_calisthenics', weight: 2 },
      { key: 'core_body_control', weight: 3 },
      { key: 'balance_stability', weight: 2 },
      { key: 'neural', weight: 2 },
    ],
    physiology: [
      { key: 'control_stability', weight: 4 },
      { key: 'force_tissue_capacity', weight: 2 },
      { key: 'neural_output_readiness', weight: 2 },
    ],
    patterns: [
      { key: 'hinge', weight: 4 },
      { key: 'brace', weight: 3 },
    ],
    equipment: [
      { key: 'none', weight: 5 },
      { key: 'mat', weight: 2 },
      { key: 'bands', weight: 1 },
    ],
    body_regions: [
      { key: 'hip', weight: 5 },
      { key: 'core', weight: 4 },
      { key: 'spine', weight: 3 },
      { key: 'knee', weight: 2 },
    ],
    whyItWorks:
      'The glute bridge introduces hip extension in a low-threat position and helps athletes use the glutes without compensating through the low back, hamstrings, adductors, or quads. The Prehab Guys describe bridging as a foundational drill for learning glute activation, using the glutes as the primary mover, and coordinating abdominal control while the hip joint moves.',
    whyItGoesHere:
      'Belongs in Activate (glute_activation) — low-dose hip-extension and glute priming before integrated or power work.',
    commonMisuse:
      'Do not use as a high-volume finisher, long isometric hold, or loaded strength set before Output; that belongs in Capacity or Resilience.',
    scalingGuidance:
      'Scale by hip-extension control, trunk strategy, hamstring dominance, pregnancy/postpartum considerations, and symptoms.',
    movementRequirements: {
      primary_joint_actions: ['hip_extension'],
      primary_tissues: ['glutes'],
      breathing_demand: 'nasal',
      balance_demand: 'stable',
      impact_level: 0,
    },
    coachingExecution: {
      movement_description:
        'Lie on the back with knees bent and feet flat. Lightly brace the trunk, drive through the heels and midfoot, squeeze the glutes, and lift the hips until the shoulders, hips, and knees form one line. Lower slowly.',
      setup: [
        'Lie on back with knees bent.',
        'Feet hip-width and flat.',
        'Heels close enough that athlete can feel glutes, not only hamstrings.',
        'Ribs down and pelvis controlled.',
        'Arms relaxed on floor.',
      ],
      execution_steps: [
        'Exhale lightly to bring ribs down.',
        'Press through heels and midfoot.',
        'Squeeze glutes to lift hips.',
        'Stop when knees, hips, and shoulders form a straight line.',
        'Lower with control.',
      ],
      breathing_cues: ['Exhale before the lift.', 'Breathe behind the brace.', 'Do not hold breath.'],
      coach_cues: [
        'Glutes lift the hips.',
        'Ribs stay down.',
        'Do not arch your low back.',
        'Knees stay in line with toes.',
        'Control down.',
      ],
      athlete_cues: ['Squeeze your pockets.', 'Hips up, ribs down.', 'Quiet back.', 'Slow lower.'],
      common_faults: [
        'Low back arching at the top.',
        'Hamstrings cramping.',
        'Knees collapsing inward.',
        'Feet too far away from hips.',
        'Rib flare.',
        'Pushing too high instead of stopping at hip extension.',
      ],
      stop_signs: [
        'Low-back pain.',
        'Hamstring cramp that does not resolve with foot adjustment.',
        'Hip pinching.',
        'Knee pain.',
        'Unable to feel glutes after coaching and regressions.',
      ],
    },
    dosage: {
      volume_unit: 'reps',
      default_sets: 1,
      default_reps: 8,
      default_work_seconds: 35,
      default_rest_seconds: 0,
      est_seconds_per_set: 40,
      default_rpe_min: 2,
      default_rpe_max: 4,
      session_volume_min: 5,
      session_volume_max: 15,
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
      daily_ok: true,
      notes:
        'Use as glute activation and hip-extension access. If loaded, long-held, or high-volume, shift to Capacity or Resilience.',
    },
    scaling: {
      youth_beginner: 'Use simple cue: "push the floor, squeeze your glutes." Keep reps low.',
      youth_intermediate: 'Add 1-second top pause.',
      teen: 'Adjust foot position to reduce hamstring cramping. Emphasize rib-pelvis control and avoid overextending at the top.',
      adult_beginner: 'Adjust foot position to reduce hamstring cramping. Emphasize rib-pelvis control and avoid overextending at the top.',
      adult_advanced: 'Add mini-band around knees or single-leg bridge only if not fatiguing.',
      older_adult: 'Use smaller range or elevated surface if floor transfer is difficult.',
      pregnancy_postpartum:
        'Avoid prolonged supine positioning if uncomfortable or contraindicated; use elevated bridge, standing hip hinge activation, or wall-supported hip extension as alternatives.',
    },
    genderSpecificNotes: GENDER_DEFAULT,
    goodForSessions: ['sprint_prep', 'landing_prep', 'squat_prep', 'general_warmup'],
    pairsWellBefore: ['90/90 Breathing', 'Dead Bug', 'Hip CARs', 'Walking Knee Hug'],
    pairsWellAfter: ['Bridge March', 'A-March', 'Sprint mechanics', 'Squat-to-Stand', 'Low Pogos', 'Landing prep'],
    avoidBefore: [
      'Max sprinting if high-volume bridges fatigue hamstrings or glutes',
      'Plyometrics if athlete loses hip extension snap after excessive bridge volume',
    ],
    doNotUseWhen: [
      'Supine position is not appropriate',
      'Low-back pain increases',
      'Hamstring cramping persists',
      'Hip pinching worsens',
    ],
    mediaReferences: [
      'The Prehab Guys Bridge Progressions',
      'The Prehab Guys Bridge Exercise Article',
    ],
    mediaInternalNotes: ['Primary reference for glute activation, avoiding low-back compensation, and progressions.'],
  },
  {
    slug: 'glute-bridge-march',
    name: 'Glute Bridge March',
    family: 'Glute activation',
    subrole: 'activate',
    slot: 'glute_core_integration',
    cardSummary:
      'Bridge progression that integrates glute activation, pelvic control, and anti-rotation as the athlete alternates single-leg support.',
    bestPlacement:
      'After a clean glute bridge when the athlete needs pelvic control before sprinting, tumbling, jumping, or single-leg work.',
    description:
      'Set up in a glute bridge. Hold the top position without arching. Shift weight slightly to one leg, lift the opposite foot a few inches, replace it, and alternate sides without letting the hips drop or rotate.',
    coachLanguage:
      'Dual activate/integrate intent: use after a clean glute bridge when the athlete needs pelvic control before sprinting, tumbling, jumping, or single-leg work.',
    athleteLanguage: 'Hold your bridge, keep your hips level, and slowly march one foot at a time.',
    tenets: [
      { key: 'body_control', weight: 5 },
      { key: 'balance', weight: 4 },
      { key: 'coordination', weight: 3 },
      { key: 'strength', weight: 2 },
    ],
    methodologies: [
      { key: 'core_body_control', weight: 4 },
      { key: 'balance_stability', weight: 4 },
      { key: 'resistance_calisthenics', weight: 2 },
      { key: 'neural', weight: 2 },
    ],
    physiology: [
      { key: 'control_stability', weight: 5 },
      { key: 'force_tissue_capacity', weight: 2 },
      { key: 'neural_output_readiness', weight: 2 },
    ],
    patterns: [
      { key: 'hinge', weight: 4 },
      { key: 'brace', weight: 4 },
      { key: 'locomote', weight: 2 },
    ],
    equipment: [
      { key: 'none', weight: 5 },
      { key: 'mat', weight: 2 },
      { key: 'bands', weight: 1 },
    ],
    body_regions: [
      { key: 'hip', weight: 5 },
      { key: 'core', weight: 5 },
      { key: 'spine', weight: 3 },
      { key: 'knee', weight: 2 },
    ],
    whyItWorks:
      'The bridge march keeps the athlete in hip extension while alternating single-leg support, which forces pelvic control and trunk stability. The Prehab Guys cue tightening the stomach and glutes first, driving the heels down, lifting into a straight knee-hip-shoulder line, shifting weight onto one leg, and marching slowly with control.',
    whyItGoesHere:
      'Belongs in Activate (glute_core_integration) — pelvic-control primer linking glute activation to single-leg readiness.',
    commonMisuse:
      'Do not march before the athlete owns a level double-leg bridge, or use high volume before Output; that belongs in Resilience.',
    scalingGuidance:
      'Scale by trunk control, pelvic control, hip-extension quality, and postpartum/pelvic-floor symptoms when relevant.',
    movementRequirements: {
      primary_joint_actions: ['hip_extension', 'hip_flexion'],
      primary_tissues: ['glutes'],
      breathing_demand: 'nasal',
      balance_demand: 'stable',
      impact_level: 0,
    },
    coachingExecution: {
      movement_description:
        'Set up in a glute bridge. Hold the top position without arching. Shift weight slightly to one leg, lift the opposite foot a few inches, replace it, and alternate sides without letting the hips drop or rotate.',
      setup: [
        'Start in clean double-leg glute bridge.',
        'Ribs down.',
        'Glutes active.',
        'Feet hip-width.',
        'Hips level.',
      ],
      execution_steps: [
        'Lift hips into bridge.',
        'Shift weight slightly to one leg.',
        'Lift the opposite foot a few inches.',
        'Lower the foot quietly.',
        'Alternate sides while keeping pelvis level.',
      ],
      breathing_cues: ['Exhale to set ribs before lifting.', 'Breathe gently during the march.', 'Do not hold breath.'],
      coach_cues: [
        'Hips stay level.',
        'Small march.',
        'Do not twist.',
        'Keep glutes on.',
        'Slow is better.',
      ],
      athlete_cues: ['Freeze your hips.', 'March small.', 'No wobble.', 'Stay tall through the hips.'],
      common_faults: [
        'Hip dropping on the lifted side.',
        'Pelvis rotating.',
        'Low back arching.',
        'Hamstring cramping.',
        'Marching too high or too fast.',
        'Losing rib-pelvis stack.',
      ],
      stop_signs: [
        'Low-back pain.',
        'Hamstring cramping that persists.',
        'Hip pinching.',
        'Unable to maintain level pelvis.',
        'Symptoms worsen with single-leg support.',
      ],
    },
    dosage: {
      volume_unit: 'reps',
      default_sets: 1,
      default_reps: 6,
      default_work_seconds: 35,
      default_rest_seconds: 0,
      est_seconds_per_set: 45,
      default_rpe_min: 3,
      default_rpe_max: 5,
      session_volume_min: 3,
      session_volume_max: 10,
    },
    phaseProfile: {
      role: 'primary',
      fit_weight: 4,
      freshness_required: false,
      fatigue_sensitivity: 3,
      fatigue_cost: 3,
      technical_complexity: 4,
      impact_level: 0,
      intensity_ceiling: 'moderate',
      daily_ok: true,
      notes:
        'Use only after athlete owns a clean bridge. Low-volume primer in Prepare & Access; higher-volume version belongs in Resilience.',
    },
    scaling: {
      youth_beginner: 'Stay with regular glute bridge until hips stay level.',
      youth_intermediate: 'Add small march, 3–5 per side.',
      teen: 'Use hands on hips to feel pelvic movement. Keep range small and controlled; avoid excessive lumbar extension.',
      adult_beginner: 'Use hands on hips to feel pelvic movement. Keep range small and controlled; avoid excessive lumbar extension.',
      adult_advanced: 'Add longer lever march or mini-band only if it does not fatigue.',
      older_adult: 'Use double-leg bridge hold or bridge with alternating heel lift.',
      pregnancy_postpartum:
        'Use elevated or side-lying alternatives if supine bridging is uncomfortable or contraindicated.',
    },
    genderSpecificNotes: GENDER_DEFAULT,
    goodForSessions: ['sprint_prep', 'landing_prep', 'squat_prep', 'general_warmup'],
    pairsWellBefore: ['Glute Bridge', 'Dead Bug', '90/90 Breathing'],
    pairsWellAfter: ['A-March', 'Sprint wall drill', 'Single-leg balance', 'Split-stance isometric mechanics', 'Landing prep'],
    avoidBefore: [
      'Max sprinting if bridge march fatigues hamstrings or glutes',
      'High-output jumping if pelvis control fails',
    ],
    doNotUseWhen: [
      'Athlete cannot perform clean glute bridge',
      'Low-back pain increases',
      'Hamstring cramping persists',
      'Supine position is inappropriate',
    ],
    mediaReferences: [
      'The Prehab Guys Bridge March',
      'The Prehab Guys Bridge Progressions Article',
    ],
    mediaInternalNotes: ['Primary reference for setup, execution, and progression framework.'],
  },
  {
    slug: 'dead-bug-heel-tap',
    name: 'Dead Bug Breathing / Heel Tap',
    family: 'Core activation',
    subrole: 'activate',
    slot: 'core_activation',
    cardSummary:
      'Low-level anti-extension core drill that teaches rib-pelvis control, breathing, and trunk organization before athletic movement.',
    bestPlacement:
      'After breathing reset when athletes need anterior-core control without fatigue before sprint, tumbling, jump, lift, or hand-support work.',
    description:
      'Lie on the back with hips and knees bent to 90 degrees and arms toward the ceiling. Exhale to stack ribs over pelvis. Slowly lower one heel to the floor, return, and alternate sides without the low back arching.',
    coachLanguage:
      'Use before sprinting, tumbling, jumping, lifting, or hand-support work when athletes need anterior-core control without fatigue.',
    athleteLanguage:
      'Keep your low back quiet, breathe out, and tap your heel without letting your ribs pop up.',
    tenets: [
      { key: 'body_control', weight: 5 },
      { key: 'coordination', weight: 3 },
      { key: 'balance', weight: 2 },
      { key: 'strength', weight: 2 },
    ],
    methodologies: [
      { key: 'core_body_control', weight: 5 },
      { key: 'isometrics', weight: 2 },
      { key: 'neural', weight: 2 },
      { key: 'balance_stability', weight: 2 },
    ],
    physiology: [
      { key: 'control_stability', weight: 5 },
      { key: 'neural_output_readiness', weight: 2 },
    ],
    patterns: [
      { key: 'brace', weight: 5 },
      { key: 'locomote', weight: 1 },
    ],
    equipment: [
      { key: 'none', weight: 5 },
      { key: 'mat', weight: 2 },
      { key: 'bands', weight: 1 },
    ],
    body_regions: [
      { key: 'core', weight: 5 },
      { key: 'spine', weight: 4 },
      { key: 'hip', weight: 2 },
      { key: 'shoulder', weight: 1 },
    ],
    whyItWorks:
      'Dead bugs train trunk control while the limbs move, which is exactly what athletes need before sprinting, tumbling, jumping, crawling, and lifting. The Prehab Guys describe the dead bug as a core-stabilization exercise requiring control from the entire core, and they specifically warn that athletes often compensate by over-arching the low back, which shifts demand away from the core.',
    whyItGoesHere:
      'Belongs in Activate (core_activation) — low-dose anti-extension and rib-pelvis organization before integrated movement.',
    commonMisuse:
      'Do not use as a core burnout or high-volume finisher before Output; that belongs in Resilience.',
    scalingGuidance:
      'Scale by trunk control, breathing, pressure management, and ability to keep the spine organized.',
    movementRequirements: {
      primary_joint_actions: ['hip_flexion', 'shoulder_flexion'],
      primary_tissues: [],
      breathing_demand: 'nasal',
      balance_demand: 'stable',
      impact_level: 0,
    },
    coachingExecution: {
      movement_description:
        'Lie on the back with hips and knees bent to 90 degrees and arms toward the ceiling. Exhale to stack ribs over pelvis. Slowly lower one heel to the floor, return, and alternate sides without the low back arching.',
      setup: [
        'Lie on back.',
        'Hips and knees at 90 degrees.',
        'Arms reach toward ceiling.',
        'Ribs down.',
        'Low back gently controlled, not aggressively smashed.',
      ],
      execution_steps: [
        'Exhale to set rib-pelvis position.',
        'Slowly lower one heel toward the floor.',
        'Tap lightly or stop before the back arches.',
        'Return to start.',
        'Alternate sides.',
      ],
      breathing_cues: ['Exhale as heel lowers.', 'Inhale at the top.', 'Keep breath smooth and quiet.'],
      coach_cues: [
        'Ribs stay down.',
        'Move slow.',
        'Back does not arch.',
        'Only go as low as you can control.',
        'No neck tension.',
      ],
      athlete_cues: ['Quiet back.', 'Slow heel tap.', 'Breathe out.', 'Do not let your ribs pop.'],
      common_faults: [
        'Low back arching.',
        'Rib flare.',
        'Moving too fast.',
        'Neck tension.',
        'Dropping leg too low too soon.',
        'Holding breath.',
      ],
      stop_signs: [
        'Low-back pain.',
        'Hip flexor pinching.',
        'Neck strain.',
        'Abdominal pressure symptoms.',
        'Cannot breathe while controlling the position.',
      ],
    },
    dosage: {
      volume_unit: 'reps',
      default_sets: 1,
      default_reps: 6,
      default_work_seconds: 35,
      default_rest_seconds: 0,
      est_seconds_per_set: 45,
      default_rpe_min: 2,
      default_rpe_max: 4,
      session_volume_min: 3,
      session_volume_max: 10,
    },
    phaseProfile: {
      role: 'primary',
      fit_weight: 5,
      freshness_required: false,
      fatigue_sensitivity: 2,
      fatigue_cost: 2,
      technical_complexity: 3,
      impact_level: 0,
      intensity_ceiling: 'moderate',
      daily_ok: true,
      notes: 'Use as activation, not a core burnout. If fatigue-based, move to Resilience.',
    },
    scaling: {
      youth_beginner: 'Use heel taps from feet-on-floor position.',
      youth_intermediate: 'Use 90/90 heel tap with arms still.',
      teen: 'Reduce range; stop before back arches. Focus on active rib-pelvis control; avoid excessive spinal flattening or gripping.',
      adult_beginner: 'Reduce range; stop before back arches. Focus on active rib-pelvis control; avoid excessive spinal flattening or gripping.',
      adult_advanced: 'Add opposite arm reach or band-resisted dead bug, but avoid fatigue before Output.',
      older_adult: 'Feet-on-floor heel slides or seated dead bug pattern.',
      pregnancy_postpartum:
        'Use incline, side-lying, quadruped, or standing core alternatives when supine or pressure symptoms are inappropriate.',
    },
    genderSpecificNotes: GENDER_DEFAULT,
    goodForSessions: ['sprint_prep', 'landing_prep', 'squat_prep', 'general_warmup'],
    pairsWellBefore: ['90/90 Breathing', 'Glute Bridge', 'Cat-Cow'],
    pairsWellAfter: ['Bird Dog', 'A-March', 'Sprint mechanics', 'Bear Crawl Rock-Back', 'Tumbling shapes', 'Landing prep'],
    avoidBefore: [
      'Advanced tumbling if used as a core burnout',
      'Max sprinting if hip flexors or trunk are fatigued',
    ],
    doNotUseWhen: [
      'Supine position is inappropriate',
      'Low-back pain increases',
      'Poor pressure management',
      'Hip flexor pinching dominates the drill',
    ],
    mediaReferences: [
      'The Prehab Guys Dead Bug Form',
      'The Prehab Guys Dead Bug Variations',
    ],
    mediaInternalNotes: ['Primary coach references for preventing low-back arch compensation.'],
  },
  {
    slug: 'bird-dog',
    name: 'Bird Dog',
    family: 'Core activation',
    subrole: 'integrate',
    slot: 'cross_body_core',
    cardSummary:
      'Contralateral core-control drill that integrates shoulder, hip, spine, and anti-rotation control.',
    bestPlacement:
      'Before crawling, tumbling, sprint mechanics, lifting, or single-leg work when the athlete needs cross-body trunk control.',
    description:
      'Begin on hands and knees. Brace lightly. Reach one arm forward and the opposite leg back without shifting the hips or arching the low back. Pause briefly, return, and switch sides.',
    coachLanguage:
      'Use before crawling, tumbling, sprint mechanics, lifting, or single-leg work when the athlete needs cross-body trunk control.',
    athleteLanguage: 'Reach opposite arm and leg long while keeping your back and hips still.',
    tenets: [
      { key: 'body_control', weight: 5 },
      { key: 'coordination', weight: 4 },
      { key: 'balance', weight: 3 },
      { key: 'strength', weight: 2 },
    ],
    methodologies: [
      { key: 'core_body_control', weight: 5 },
      { key: 'balance_stability', weight: 4 },
      { key: 'neural', weight: 2 },
      { key: 'isometrics', weight: 1 },
    ],
    physiology: [
      { key: 'control_stability', weight: 5 },
      { key: 'perception_action_skill', weight: 3 },
      { key: 'neural_output_readiness', weight: 2 },
    ],
    patterns: [
      { key: 'brace', weight: 5 },
      { key: 'locomote', weight: 3 },
      { key: 'push', weight: 1 },
    ],
    equipment: [
      { key: 'none', weight: 5 },
      { key: 'mat', weight: 2 },
    ],
    body_regions: [
      { key: 'core', weight: 5 },
      { key: 'spine', weight: 4 },
      { key: 'hip', weight: 4 },
      { key: 'shoulder', weight: 3 },
      { key: 'wrist', weight: 2 },
    ],
    whyItWorks:
      'The bird dog asks the athlete to control the trunk while moving the opposite arm and leg, making it useful for anti-rotation, cross-body coordination, and spine/hip/shoulder integration. The Prehab Guys describe the bird dog as balancing on opposite arm and leg, with a wider base making it easier and a narrower base more challenging; they also list variations that target anti-rotation musculature such as the obliques and multifidus.',
    whyItGoesHere:
      'Belongs in Integrate (cross_body_core) — contralateral trunk control linking upper and lower body before crawl or power work.',
    commonMisuse:
      'Do not rush reps, use high volume, or load heavily before Output; advanced variations belong in Resilience or Skill.',
    scalingGuidance:
      'Scale by trunk control, shoulder/wrist tolerance, and cross-body coordination.',
    movementRequirements: {
      primary_joint_actions: ['hip_extension', 'shoulder_flexion'],
      primary_tissues: [],
      breathing_demand: 'nasal',
      balance_demand: 'single_leg',
      impact_level: 0,
    },
    coachingExecution: {
      movement_description:
        'Begin on hands and knees. Brace lightly. Reach one arm forward and the opposite leg back without shifting the hips or arching the low back. Pause briefly, return, and switch sides.',
      setup: [
        'Hands under shoulders.',
        'Knees under hips.',
        'Neutral spine.',
        'Eyes down.',
        'Base wider for beginners, narrower for advanced athletes.',
      ],
      execution_steps: [
        'Brace lightly.',
        'Reach opposite arm and leg long.',
        'Keep hips square to the floor.',
        'Pause briefly.',
        'Return with control and switch sides.',
      ],
      breathing_cues: ['Exhale as you reach.', 'Inhale on return.', 'Do not hold breath.'],
      coach_cues: [
        'Long reach, not high reach.',
        'Hips stay square.',
        'Do not arch your back.',
        'Push the floor away.',
        'Slow return.',
      ],
      athlete_cues: ['Reach long.', 'No wiggle.', 'Freeze your hips.', 'Quiet back.'],
      common_faults: [
        'Low back arching.',
        'Hip opening to the side.',
        'Lifting arm or leg too high.',
        'Shoulder collapsing.',
        'Rushing reps.',
        'Holding breath.',
      ],
      stop_signs: [
        'Low-back pain.',
        'Wrist pain.',
        'Shoulder pinching.',
        'Hip pinching.',
        'Cannot control rotation.',
      ],
    },
    dosage: {
      volume_unit: 'reps',
      default_sets: 1,
      default_reps: 6,
      default_work_seconds: 35,
      default_rest_seconds: 0,
      est_seconds_per_set: 45,
      default_rpe_min: 2,
      default_rpe_max: 4,
      session_volume_min: 3,
      session_volume_max: 10,
    },
    phaseProfile: {
      role: 'primary',
      fit_weight: 5,
      freshness_required: false,
      fatigue_sensitivity: 2,
      fatigue_cost: 2,
      technical_complexity: 4,
      impact_level: 0,
      intensity_ceiling: 'moderate',
      daily_ok: true,
      notes:
        'Excellent cross-body integration drill. Keep reps crisp; high-volume or advanced variations belong in Resilience.',
    },
    scaling: {
      youth_beginner: 'Start with only leg reach or only arm reach.',
      youth_intermediate: 'Opposite arm/leg reach with 1-second hold.',
      teen: 'Widen knees and hands for stability. Emphasize active trunk control and avoid sagging into shoulders/spine.',
      adult_beginner: 'Widen knees and hands for stability. Emphasize active trunk control and avoid sagging into shoulders/spine.',
      adult_advanced: 'Add bird-dog squares or elbow-to-knee, but keep warm-up dose low.',
      older_adult: 'Use elevated hands on bench or only leg reach.',
      pregnancy_postpartum:
        'Quadruped variation may be useful if comfortable; regress if pressure, pelvic, or wrist symptoms occur.',
    },
    genderSpecificNotes: GENDER_DEFAULT,
    goodForSessions: [
      'sprint_prep',
      'landing_prep',
      'squat_prep',
      'general_warmup',
      'tumbling_prep',
      'crawling_prep',
    ],
    pairsWellBefore: ['Dead Bug', 'Cat-Cow', 'Quadruped Shoulder Circles', 'Hip CARs'],
    pairsWellAfter: [
      'Bear Crawl Rock-Back',
      'Crawling patterns',
      'A-March',
      'Sprint mechanics',
      'Tumbling line drills',
      'Single-leg balance',
    ],
    avoidBefore: [
      'Advanced tumbling if it fatigues wrists or trunk',
      'Max sprinting if hip extension becomes sloppy or cramped',
    ],
    doNotUseWhen: [
      'Wrist pain in quadruped',
      'Low-back pain increases',
      'Shoulder compression symptoms',
      'Cannot maintain neutral trunk',
    ],
    mediaReferences: [
      'The Prehab Guys Bird Dog',
      'The Prehab Guys Bird Dog Variations',
    ],
    mediaInternalNotes: ['Primary demonstration and progression ideas; base-width scaling and anti-rotation rationale.'],
  },
  {
    slug: 'mini-band-lateral-walk',
    name: 'Mini-Band Lateral Walk',
    family: 'Glute activation',
    subrole: 'activate',
    slot: 'lateral_hip_activation',
    cardSummary:
      'Low-dose lateral hip activation drill that prepares glute medius, knee tracking, pelvis control, and frontal-plane readiness.',
    bestPlacement:
      'Before lateral movement, agility, landing, squatting, lunging, cutting, or single-leg work when glute medius activation is needed.',
    description:
      'Place a mini-band around the knees, ankles, or feet depending on skill and tolerance. Assume a slight athletic stance. Step sideways while maintaining band tension, foot tripod, knees tracking over toes, and pelvis level.',
    coachLanguage:
      'Use before lateral movement, agility, landing, squatting, lunging, cutting, or single-leg work when the athlete needs glute medius activation.',
    athleteLanguage:
      'Keep the band tight, toes forward, hips level, and step side to side without letting your knees cave.',
    tenets: [
      { key: 'strength', weight: 2 },
      { key: 'balance', weight: 4 },
      { key: 'body_control', weight: 4 },
      { key: 'agility', weight: 3 },
      { key: 'coordination', weight: 2 },
    ],
    methodologies: [
      { key: 'balance_stability', weight: 4 },
      { key: 'resistance_calisthenics', weight: 3 },
      { key: 'core_body_control', weight: 2 },
      { key: 'neural', weight: 2 },
    ],
    physiology: [
      { key: 'control_stability', weight: 5 },
      { key: 'force_tissue_capacity', weight: 2 },
      { key: 'neural_output_readiness', weight: 2 },
    ],
    patterns: [
      { key: 'locomote', weight: 4 },
      { key: 'squat', weight: 3 },
      { key: 'land', weight: 3 },
      { key: 'brace', weight: 2 },
    ],
    equipment: [{ key: 'bands', weight: 5 }],
    body_regions: [
      { key: 'hip', weight: 5 },
      { key: 'knee', weight: 4 },
      { key: 'ankle', weight: 3 },
      { key: 'core', weight: 2 },
    ],
    whyItWorks:
      'Mini-band lateral walks are commonly used to retrain lateral hip control and neuromuscular movement patterns, but they are often misused as high-volume "burn" work. The Prehab Guys note that banded side steps can be useful for retraining movement patterns and neuromuscular control, while also warning that the drill is often performed incorrectly and should maintain band tension; Verywell Fit similarly describes the lateral band walk as targeting hip abductors/gluteus medius and supporting hip/knee stability when done correctly.',
    whyItGoesHere:
      'Belongs in Activate (lateral_hip_activation) — low-volume glute-med and knee-tracking primer before frontal-plane work.',
    commonMisuse:
      'Do not prescribe high step counts or heavy band tension before agility or Output; that becomes Capacity / Control fatigue work.',
    scalingGuidance:
      'Scale by knee tracking, hip control, strength level, and sport demands rather than gender alone.',
    movementRequirements: {
      primary_joint_actions: ['hip_abduction'],
      primary_tissues: ['glute_med'],
      breathing_demand: 'nasal',
      balance_demand: 'stable',
      impact_level: 0,
    },
    coachingExecution: {
      movement_description:
        'Place a mini-band around the knees, ankles, or feet depending on skill and tolerance. Assume a slight athletic stance. Step sideways while maintaining band tension, foot tripod, knees tracking over toes, and pelvis level.',
      setup: [
        'Band around knees for easiest version, ankles or feet for harder versions.',
        'Feet about hip-width.',
        'Soft knees.',
        'Hips slightly back.',
        'Ribs stacked over pelvis.',
      ],
      execution_steps: [
        'Create light band tension.',
        'Step sideways with control.',
        'Let the trailing foot follow without snapping in.',
        'Keep tension in the band.',
        'Repeat in both directions.',
      ],
      breathing_cues: ['Breathe normally.', 'Do not brace the neck or jaw.'],
      coach_cues: [
        'Keep tension on the band.',
        'Toes mostly forward.',
        'Knees track over toes.',
        'Do not bounce.',
        'Small clean steps.',
      ],
      athlete_cues: ['Step, control, follow.', 'Band stays tight.', 'Knees strong.', 'No wobble.'],
      common_faults: [
        'Band tension disappearing between steps.',
        'Toes turning outward excessively.',
        'Knees collapsing inward.',
        'Torso swaying side to side.',
        'Trailing foot snapping in.',
        'Too many reps causing glute fatigue before agility or jumping.',
      ],
      stop_signs: [
        'Hip pinching.',
        'Knee pain.',
        'Low-back compensation.',
        'Glute cramping or fatigue that changes movement quality.',
        'Foot or ankle pain from band placement.',
      ],
    },
    dosage: {
      volume_unit: 'reps',
      default_sets: 1,
      default_reps: 8,
      default_work_seconds: 30,
      default_rest_seconds: 0,
      est_seconds_per_set: 40,
      default_rpe_min: 2,
      default_rpe_max: 4,
      session_volume_min: 4,
      session_volume_max: 12,
    },
    phaseProfile: {
      role: 'primary',
      fit_weight: 5,
      freshness_required: false,
      fatigue_sensitivity: 3,
      fatigue_cost: 3,
      technical_complexity: 3,
      impact_level: 0,
      intensity_ceiling: 'moderate',
      daily_ok: true,
      notes: 'Useful activation drill, but commonly overdosed. Keep low volume before Output or agility.',
    },
    scaling: {
      youth_beginner: 'No band first; lateral step with knee-track cue.',
      youth_intermediate: 'Light band above knees, 4–8 steps each way.',
      teen: 'Band above knees or ankles; small controlled steps. Emphasize active hip/knee control and avoid collapsing into knee valgus.',
      adult_beginner: 'Band above knees or ankles; small controlled steps. Emphasize active hip/knee control and avoid collapsing into knee valgus.',
      adult_advanced: 'Band at feet or double-band only if not fatiguing.',
      older_adult: 'Band above knees with support nearby, or side step without band.',
      pregnancy_postpartum: 'Use light band, short sets, and support if balance or pelvic symptoms occur.',
    },
    genderSpecificNotes: GENDER_DEFAULT,
    goodForSessions: ['sprint_prep', 'landing_prep', 'squat_prep', 'general_warmup'],
    pairsWellBefore: ['Foot Tripod Weight Shifts', 'Short-Foot Drill', 'Glute Bridge', 'Hip CARs'],
    pairsWellAfter: [
      'Lateral Lunge Shift',
      'Side Shuffle',
      'Agility prep',
      'Landing prep',
      'Single-leg balance',
      'Cossack Shift',
    ],
    avoidBefore: [
      'Reactive agility if glutes become fatigued',
      'Max sprinting if hips feel heavy',
      'Jumping if knees track worse after band work',
    ],
    doNotUseWhen: [
      'Knee pain increases',
      'Hip pinching worsens',
      'Band placement irritates ankle or knee',
      'Athlete cannot control knee position',
    ],
    mediaReferences: [
      'The Prehab Guys Banded Side Step',
      'The Prehab Guys Lateral Band Walk Archive',
      'E3 Rehab Gluteus Medius Resources',
    ],
    mediaInternalNotes: ['Primary references for band tension, foot position, and lateral hip function.'],
  },
  {
    slug: 'a-march',
    name: 'A-March / Marching Mechanics',
    family: 'Sprint posture prep',
    subrole: 'potentiate_bridge',
    slot: 'marching_mechanics',
    cardSummary:
      'Low-intensity sprint-mechanics primer that teaches posture, knee lift, dorsiflexion, rhythm, and ground contact before speed or movement skill.',
    bestPlacement:
      'Final bridge from Prepare & Access into Movement Intelligence or Output on speed, agility, tumbling, or general athletic days.',
    description:
      'March forward slowly with tall posture. Lift one knee to roughly hip height, keep the toe pulled up, coordinate opposite arm swing, and step down under the hip with control. Repeat rhythmically.',
    coachLanguage:
      'Use as the final bridge from Prepare & Access into Movement Intelligence or Output on speed, agility, tumbling, or general athletic days.',
    athleteLanguage: 'Stand tall, knee up, toe up, step down under your hip with rhythm.',
    tenets: [
      { key: 'speed', weight: 4 },
      { key: 'coordination', weight: 5 },
      { key: 'body_control', weight: 4 },
      { key: 'balance', weight: 3 },
      { key: 'agility', weight: 2 },
    ],
    methodologies: [
      { key: 'neural', weight: 5 },
      { key: 'mobility_flexibility', weight: 2 },
      { key: 'balance_stability', weight: 2 },
      { key: 'core_body_control', weight: 2 },
    ],
    physiology: [
      { key: 'neural_output_readiness', weight: 5 },
      { key: 'perception_action_skill', weight: 4 },
      { key: 'control_stability', weight: 3 },
      { key: 'ssc_stiffness', weight: 1 },
    ],
    patterns: [
      { key: 'locomote', weight: 5 },
      { key: 'land', weight: 2 },
      { key: 'brace', weight: 2 },
    ],
    equipment: [
      { key: 'none', weight: 5 },
      { key: 'cones', weight: 1 },
    ],
    body_regions: [
      { key: 'hip', weight: 4 },
      { key: 'ankle', weight: 4 },
      { key: 'knee', weight: 3 },
      { key: 'core', weight: 3 },
      { key: 'spine', weight: 2 },
    ],
    whyItWorks:
      'The A-March is a sprint-mechanics bridge: it teaches upright posture, knee lift, recovery mechanics, dorsiflexion, rhythm, and forceful but controlled ground contact. SimpliFaster describes the A-March as a fundamental drill for teaching sprint mechanics, including a straight postural line, knee up, heel under knee, and dorsiflexed toe; Parisi School describes the A-March as the entry point before A-skip and A-run because it isolates knee lift and recovery.',
    whyItGoesHere:
      'Belongs in Potentiate Bridge (marching_mechanics) — slow technical sprint-posture primer before Skill or Output.',
    commonMisuse:
      'Do not march fast, use high coaching detail, or place after conditioning if the goal is sprint-mechanics prep; faster versions belong in Movement Intelligence.',
    scalingGuidance:
      'Scale by coordination, sprint skill, balance, hip-flexor comfort, and pelvic-floor/load tolerance when relevant.',
    movementRequirements: {
      primary_joint_actions: ['hip_flexion', 'ankle_dorsiflexion'],
      primary_tissues: [],
      breathing_demand: 'nasal',
      balance_demand: 'stable',
      impact_level: 1,
    },
    coachingExecution: {
      movement_description:
        'March forward slowly with tall posture. Lift one knee to roughly hip height, keep the toe pulled up, coordinate opposite arm swing, and step down under the hip with control. Repeat rhythmically.',
      setup: [
        'Stand tall.',
        'Eyes forward.',
        'Ribs stacked over pelvis.',
        'Arms bent around 90 degrees.',
        'Feet under hips.',
      ],
      execution_steps: [
        'Lift one knee to hip height or appropriate range.',
        'Pull toe up toward shin.',
        'Keep heel under knee.',
        'Opposite arm moves forward.',
        'Step down under the hip.',
        'Alternate sides with rhythm.',
      ],
      breathing_cues: ['Breathe rhythmically.', 'Stay relaxed through face and shoulders.'],
      coach_cues: [
        'Tall posture.',
        'Knee up, toe up.',
        'Step down under the hip.',
        'Opposite arm, opposite leg.',
        'Smooth rhythm before speed.',
      ],
      athlete_cues: ['Tall.', 'Knee up.', 'Toe up.', 'Step down.', 'Find the beat.'],
      common_faults: [
        'Leaning backward.',
        'Collapsing posture.',
        'Toe pointing down.',
        'Foot striking too far in front.',
        'Arms crossing the body.',
        'Marching too fast before mechanics are clean.',
      ],
      stop_signs: [
        'Hip flexor pinching.',
        'Knee pain.',
        'Ankle pain.',
        'Loss of balance.',
        'Coordination breaks down completely.',
      ],
    },
    dosage: {
      volume_unit: 'distance',
      default_sets: 1,
      default_reps: null,
      default_distance: 12,
      default_work_seconds: 20,
      default_rest_seconds: 0,
      est_seconds_per_set: 30,
      default_rpe_min: 2,
      default_rpe_max: 4,
      session_volume_min: 10,
      session_volume_max: 30,
    },
    phaseProfile: {
      role: 'primary',
      fit_weight: 5,
      freshness_required: false,
      fatigue_sensitivity: 3,
      fatigue_cost: 1,
      technical_complexity: 4,
      impact_level: 1,
      intensity_ceiling: 'moderate',
      daily_ok: true,
      notes:
        'Prepare & Access version is slow and technical. Faster, more coached versions belong in Movement Intelligence.',
    },
    scaling: {
      youth_beginner: 'March in place first; use "knee up, toe up" rhythm game.',
      youth_intermediate: 'March 10 yards with arm action.',
      teen: 'Slow tempo and lower knee height if hip flexors dominate. Emphasize controlled knee lift and foot strike under center; avoid floppy contacts.',
      adult_beginner: 'Slow tempo and lower knee height if hip flexors dominate. Emphasize controlled knee lift and foot strike under center; avoid floppy contacts.',
      adult_advanced: 'Progress to A-skip, wall-drill exchange, or acceleration mechanics in the next phase.',
      older_adult: 'March in place or supported marching with lower knee height.',
      pregnancy_postpartum:
        'Marching is often a useful low-impact alternative to jumping; scale knee height, pace, balance support, and intensity based on symptoms and clearance.',
    },
    genderSpecificNotes: GENDER_DEFAULT,
    goodForSessions: ['sprint_prep', 'landing_prep', 'general_warmup', 'tumbling_prep'],
    pairsWellBefore: ['Glute Bridge', 'Bridge March', 'Dead Bug', 'Foot Tripod Weight Shifts', 'Leg Swings', 'Walking Knee Hug'],
    pairsWellAfter: [
      'Sprint mechanics',
      'Acceleration wall drill',
      'A-Skip',
      'Low Pogos',
      'Agility prep',
      'Tumbling takeoff prep',
    ],
    avoidBefore: [
      'Max sprinting if posture, dorsiflexion, or rhythm are poor',
      'Fast agility if foot contacts are sloppy',
    ],
    doNotUseWhen: [
      'Hip flexor pain worsens',
      'Balance is unsafe',
      'Athlete cannot coordinate marching without frustration or breakdown',
    ],
    mediaReferences: [
      'SimpliFaster A-March Coaching Cues',
      'Parisi School A-March / A-Skip / A-Run Progression',
      'Chris Johnson PT Marching Drills',
    ],
    mediaInternalNotes: ['Start with smooth rhythm before changing tempo.'],
  },
]

export const ACTIVATION_ACCESS_SLUGS = ACTIVATION_ACCESS_CARDS.map((c) => c.slug)
