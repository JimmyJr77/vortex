/**
 * Rich card v2 factory for Resilience phase movement cards.
 * Consumed by scripts/data/control-*-cards-*.mjs seed generators.
 */

const GENDER_DEFAULT =
  'No default sex-based adjustment. Scale by movement quality, symptom tolerance, and supervision needs rather than gender alone.'

export const CLUSTER_MISUSE =
  'Control is precision work — own positions, absorb force, and maintain alignment under low-to-moderate stress. Not Capacity force loading, Fitness conditioning circuits, or high-volume Output speed work.'

const FAMILY_BY_SUBROLE = {
  landing_braking_control: 'Landing & Braking Control',
  single_leg_balance_foot_ankle_hip_control: 'Single-Leg Balance / Foot-Ankle-Hip Control',
  trunk_pelvis_anti_movement_control: 'Trunk / Pelvis / Anti-Movement Control',
  scapular_wrist_hand_support_resilience: 'Scapular / Wrist / Hand-Support Resilience',
  slow_eccentric_isometric_joint_resilience: 'Slow Eccentric / Isometric Joint Resilience',
}

const SCALING_BASE = {
  youth_beginner:
    'Coach-supervised; low amplitude and short holds; stop on pain, loss of alignment, or visible fear response.',
  youth_intermediate:
    'Conservative volume with full rest; prioritize clean sticks, holds, and alignment over amplitude or duration.',
  teen: 'Progress amplitude, reach distance, or hold time only when alignment and control stay crisp across all sets.',
  adult_beginner: 'Start with regressions and short work intervals; master bracing and foot tripod before adding reach or load.',
  adult_advanced: 'Can progress amplitude, hold time, or complexity when mechanics stay clean across all sets.',
  older_adult: 'Prefer supported variations, shorter holds, and generous rest; avoid high-impact landing if symptoms present.',
  pregnancy_postpartum:
    'Scale impact, reach, and hold duration by trimester and symptoms; avoid breath-holding and excessive intra-abdominal pressure.',
}

const EQUIP_OVERRIDES = {
  'low-box-step-off-to-stick': [{ key: 'box', weight: 5 }],
  'single-leg-squat-to-box': [{ key: 'box', weight: 5 }],
  'dead-bug-pullover-band-dead-bug': [{ key: 'bands', weight: 5 }],
  'pallof-press-iso-hold': [{ key: 'bands', weight: 5 }, { key: 'cable', weight: 4 }],
  'half-kneeling-anti-rotation-press-lift-hold': [{ key: 'bands', weight: 5 }, { key: 'cable', weight: 4 }],
  'plank-pull-through': [{ key: 'dumbbell', weight: 4 }],
  'ring-support-hold-assisted-control': [{ key: 'rings', weight: 5 }],
  'slider-hamstring-eccentric-slow-lower': [{ key: 'mat', weight: 4 }, { key: 'slider', weight: 5 }],
  'perturbation-single-leg-balance': [{ key: 'none', weight: 5 }],
  'beam-line-balance-freeze': [{ key: 'none', weight: 5 }],
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

const DOSAGE_OVERRIDES = {
  'drop-squat-to-stick': { volume_unit: 'attempts', default_sets: 2, default_reps: 4, default_work_seconds: null, default_rest_seconds: 45 },
  'single-leg-hop-to-stick-low-amplitude': { volume_unit: 'attempts', default_sets: 2, default_reps: 3, default_work_seconds: null, default_rest_seconds: 60 },
  'slow-bear-crawl': { volume_unit: 'distance', default_sets: 2, default_reps: null, default_distance: 10, default_work_seconds: null, default_rest_seconds: 45 },
  'nordic-lean-isometric-partial-range': { volume_unit: 'seconds', default_sets: 3, default_reps: null, default_work_seconds: 15, default_rest_seconds: 90 },
  'wall-handstand-line-hold': { volume_unit: 'seconds', default_sets: 3, default_reps: null, default_work_seconds: 15, default_rest_seconds: 60 },
  'split-squat-eccentric-to-pause': { volume_unit: 'reps', default_sets: 3, default_reps: 5, default_work_seconds: null, default_rest_seconds: 60 },
  'slider-hamstring-eccentric-slow-lower': { volume_unit: 'reps', default_sets: 3, default_reps: 4, default_work_seconds: null, default_rest_seconds: 60 },
}

/** @type {Record<string, object>} */
const SUBROLE_CONFIG = {
  landing_braking_control: {
    goodForSessions: ['control_landing', 'deceleration', 'resilience'],
    tenets: [
      { key: 'body_control', weight: 5 },
      { key: 'coordination', weight: 4 },
      { key: 'balance', weight: 3 },
    ],
    methodologies: [
      { key: 'plyometrics', weight: 4 },
      { key: 'core_body_control', weight: 5 },
      { key: 'balance_stability', weight: 3 },
    ],
    physiology: [
      { key: 'control_stability', weight: 5 },
      { key: 'force_tissue_capacity', weight: 3 },
    ],
    patterns: [
      { key: 'jump', weight: 4 },
      { key: 'brace', weight: 5 },
      { key: 'locomote', weight: 3 },
    ],
    equipment: [{ key: 'none', weight: 5 }],
    body_regions: [
      { key: 'ankle', weight: 5 },
      { key: 'knee', weight: 4 },
      { key: 'hip', weight: 4 },
      { key: 'core', weight: 4 },
    ],
    dosage: {
      volume_unit: 'attempts',
      default_sets: 3,
      default_reps: 4,
      default_distance: null,
      default_work_seconds: null,
      default_rest_seconds: 45,
      tempo: 'stick and hold',
      default_rpe_min: 3,
      default_rpe_max: 5,
      session_volume_min: 6,
      session_volume_max: 24,
    },
    phaseProfile: {
      role: 'primary',
      fit_weight: 5,
      freshness_required: false,
      fatigue_sensitivity: 2,
      fatigue_cost: 2,
      technical_complexity: 3,
      impact_level: 1,
      intensity_ceiling: 'low_to_moderate',
      daily_ok: false,
      requires_supervision: 'recommended_for_youth',
      notes: 'Landing and braking control — low amplitude, clean sticks, full rest between attempts.',
    },
    movementRequirements: {
      primary_joint_actions: ['ankle_dorsiflexion', 'knee_flexion', 'hip_flexion', 'trunk_bracing', 'deceleration'],
      primary_tissues: ['quads', 'glutes', 'calves', 'core'],
      breathing_demand: 'nasal',
      balance_demand: 'dynamic',
      impact_level: 1,
      prerequisites: ['Pain-free bilateral squat and landing pattern'],
    },
    setupRequirements: [
      'Clear landing lane with non-slip surface',
      'Low box or step when variation requires elevation',
      'Coach spotting plan for youth and high-fear athletes',
    ],
    scalingGuidance:
      'Regress amplitude, speed, or unilateral demand before reducing stick quality; progress only when every rep ends in a quiet, aligned hold.',
    pairsWellBefore: ['Breathing Reset', 'Ankle Mobility', 'Glute Bridge', 'Drop Squat Prep'],
    pairsWellAfter: ['Single-Leg Balance Hold', 'Lateral Step-Down', 'Pallof Press Iso Hold'],
    avoidBefore: ['Heavy squat or plyometric fatigue that compromises landing mechanics'],
    doNotUseWhen: ['Acute knee or ankle pain', 'Visible fear or inability to stick landing', 'No clear landing space'],
  },
  single_leg_balance_foot_ankle_hip_control: {
    goodForSessions: ['control_balance', 'single_leg', 'foot_ankle_hip'],
    tenets: [
      { key: 'balance', weight: 5 },
      { key: 'body_control', weight: 5 },
      { key: 'coordination', weight: 3 },
    ],
    methodologies: [
      { key: 'balance_stability', weight: 5 },
      { key: 'core_body_control', weight: 4 },
    ],
    physiology: [{ key: 'control_stability', weight: 5 }],
    patterns: [
      { key: 'balance', weight: 5 },
      { key: 'brace', weight: 4 },
    ],
    equipment: [{ key: 'none', weight: 5 }],
    body_regions: [
      { key: 'ankle', weight: 5 },
      { key: 'hip', weight: 5 },
      { key: 'core', weight: 4 },
      { key: 'knee', weight: 3 },
    ],
    dosage: {
      volume_unit: 'seconds',
      default_sets: 3,
      default_reps: null,
      default_distance: null,
      default_work_seconds: 20,
      default_rest_seconds: 30,
      tempo: 'controlled hold',
      default_rpe_min: 3,
      default_rpe_max: 5,
      session_volume_min: 30,
      session_volume_max: 120,
    },
    phaseProfile: {
      role: 'primary',
      fit_weight: 5,
      freshness_required: false,
      fatigue_sensitivity: 1,
      fatigue_cost: 1,
      technical_complexity: 3,
      impact_level: 0,
      intensity_ceiling: 'low_to_moderate',
      daily_ok: false,
      requires_supervision: 'recommended_for_youth',
      notes: 'Single-leg balance and reach — tripod foot, hip control, and quiet trunk.',
    },
    movementRequirements: {
      primary_joint_actions: ['ankle_stabilization', 'hip_stabilization', 'trunk_bracing', 'single_leg_balance'],
      primary_tissues: ['foot_intrinsics', 'glutes', 'core'],
      breathing_demand: 'nasal',
      balance_demand: 'single_leg',
      impact_level: 0,
      prerequisites: ['Pain-free bilateral stance and basic single-leg stand'],
    },
    setupRequirements: [
      'Non-slip floor or balance surface',
      'Box or step for step-down variations',
      'Wall or dowel for supported reach progressions',
    ],
    scalingGuidance:
      'Regress to bilateral or hand-supported balance before shortening hold time; progress reach distance or surface challenge only when foot tripod stays active.',
    pairsWellBefore: ['Breathing Reset', 'Ankle Mobility', 'Glute Bridge', 'Drop Squat to Stick'],
    pairsWellAfter: ['Single-Leg RDL Reach', 'Lateral Step-Down', 'Perturbation Balance'],
    avoidBefore: ['Heavy leg fatigue that compromises single-leg stability'],
    doNotUseWhen: ['Acute ankle or hip pain', 'Athlete cannot stand on one leg without support', 'Dizziness or vestibular symptoms'],
  },
  trunk_pelvis_anti_movement_control: {
    goodForSessions: ['control_trunk', 'anti_movement', 'core_control'],
    tenets: [
      { key: 'body_control', weight: 5 },
      { key: 'coordination', weight: 3 },
    ],
    methodologies: [
      { key: 'isometrics', weight: 5 },
      { key: 'core_body_control', weight: 5 },
    ],
    physiology: [{ key: 'control_stability', weight: 5 }],
    patterns: [
      { key: 'brace', weight: 5 },
      { key: 'anti_rotation', weight: 4 },
    ],
    equipment: [
      { key: 'mat', weight: 5 },
      { key: 'none', weight: 3 },
    ],
    body_regions: [
      { key: 'core', weight: 5 },
      { key: 'spine', weight: 4 },
      { key: 'hip', weight: 3 },
    ],
    dosage: {
      volume_unit: 'seconds',
      default_sets: 3,
      default_reps: null,
      default_distance: null,
      default_work_seconds: 20,
      default_rest_seconds: 30,
      tempo: 'controlled hold',
      default_rpe_min: 3,
      default_rpe_max: 5,
      session_volume_min: 30,
      session_volume_max: 120,
    },
    phaseProfile: {
      role: 'primary',
      fit_weight: 5,
      freshness_required: false,
      fatigue_sensitivity: 1,
      fatigue_cost: 1,
      technical_complexity: 2,
      impact_level: 0,
      intensity_ceiling: 'low_to_moderate',
      daily_ok: false,
      requires_supervision: 'optional',
      notes: 'Trunk and pelvis anti-movement — ribs stacked, pelvis quiet, no compensation.',
    },
    movementRequirements: {
      primary_joint_actions: ['trunk_bracing', 'anti_extension', 'anti_rotation', 'hip_flexion'],
      primary_tissues: ['abdominals', 'obliques', 'erectors', 'glutes'],
      breathing_demand: 'nasal',
      balance_demand: 'stable',
      impact_level: 0,
      prerequisites: ['Pain-free supine and quadruped positions'],
    },
    setupRequirements: [
      'Mat or padded floor for supine and quadruped work',
      'Band or cable anchor for anti-rotation holds when prescribed',
      'Clear space for bear plank and dynamic anti-rotation drills',
    ],
    scalingGuidance:
      'Regress lever length or add support before reducing hold standard; progress reach, load, or dynamic taps only when ribs stay down and pelvis stays quiet.',
    pairsWellBefore: ['Breathing Reset', '90/90 Breathing', 'Glute Bridge'],
    pairsWellAfter: ['Pallof Press Iso Hold', 'Single-Leg Balance Hold', 'Landing Control Drills'],
    avoidBefore: ['High spinal load or fatigue that compromises bracing'],
    doNotUseWhen: ['Acute low-back pain', 'Diastasis symptoms with trunk loading', 'Cannot maintain neutral spine in starting position'],
  },
  scapular_wrist_hand_support_resilience: {
    goodForSessions: ['control_upper_support', 'scapular', 'wrist_resilience'],
    tenets: [
      { key: 'body_control', weight: 5 },
      { key: 'strength', weight: 3 },
      { key: 'coordination', weight: 3 },
    ],
    methodologies: [
      { key: 'isometrics', weight: 5 },
      { key: 'core_body_control', weight: 4 },
    ],
    physiology: [
      { key: 'control_stability', weight: 5 },
      { key: 'force_tissue_capacity', weight: 3 },
    ],
    patterns: [
      { key: 'push', weight: 4 },
      { key: 'brace', weight: 5 },
      { key: 'crawl', weight: 2 },
    ],
    equipment: [
      { key: 'mat', weight: 4 },
      { key: 'none', weight: 3 },
    ],
    body_regions: [
      { key: 'shoulder', weight: 5 },
      { key: 'wrist', weight: 5 },
      { key: 'core', weight: 4 },
      { key: 'spine', weight: 3 },
    ],
    dosage: {
      volume_unit: 'seconds',
      default_sets: 3,
      default_reps: null,
      default_distance: null,
      default_work_seconds: 20,
      default_rest_seconds: 45,
      tempo: 'controlled hold',
      default_rpe_min: 3,
      default_rpe_max: 5,
      session_volume_min: 30,
      session_volume_max: 120,
    },
    phaseProfile: {
      role: 'primary',
      fit_weight: 5,
      freshness_required: false,
      fatigue_sensitivity: 2,
      fatigue_cost: 2,
      technical_complexity: 3,
      impact_level: 0,
      intensity_ceiling: 'low_to_moderate',
      daily_ok: false,
      requires_supervision: 'recommended_for_youth',
      notes: 'Scapular, wrist, and support resilience — straight arms, active shoulders, no collapse.',
    },
    movementRequirements: {
      primary_joint_actions: ['scapular_protraction', 'scapular_depression', 'wrist_extension', 'trunk_bracing'],
      primary_tissues: ['serratus', 'rotator_cuff', 'forearms', 'core'],
      breathing_demand: 'nasal',
      balance_demand: 'stable',
      impact_level: 0,
      prerequisites: ['Pain-free quadruped and plank positions'],
    },
    setupRequirements: [
      'Mat for wrist-friendly support',
      'Wall space for handstand line and walk-down progressions',
      'Rings or parallettes at appropriate height for support holds',
    ],
    scalingGuidance:
      'Regress to elevated or knee-supported positions before reducing hold quality; progress height, lever, or walk distance only when scapular control stays active.',
    pairsWellBefore: ['Breathing Reset', 'Wrist Mobility', 'Dead Bug', 'Scapular Push-Up Prep'],
    pairsWellAfter: ['Trunk Anti-Rotation Holds', 'Slow Bear Crawl', 'Capacity Row Progressions'],
    avoidBefore: ['Heavy pressing or grip fatigue that compromises support positions'],
    doNotUseWhen: ['Acute wrist, elbow, or shoulder pain', 'Cannot bear weight through hands without symptoms', 'No safe wall or support setup'],
  },
  slow_eccentric_isometric_joint_resilience: {
    goodForSessions: ['control_eccentric', 'isometric', 'joint_resilience'],
    tenets: [
      { key: 'strength', weight: 4 },
      { key: 'body_control', weight: 5 },
      { key: 'flexibility', weight: 2 },
    ],
    methodologies: [
      { key: 'isometrics', weight: 5 },
      { key: 'eccentric_negative', weight: 4 },
      { key: 'core_body_control', weight: 3 },
    ],
    physiology: [
      { key: 'force_tissue_capacity', weight: 5 },
      { key: 'control_stability', weight: 4 },
    ],
    patterns: [
      { key: 'squat', weight: 3 },
      { key: 'hinge', weight: 3 },
      { key: 'brace', weight: 4 },
    ],
    equipment: [{ key: 'none', weight: 5 }],
    body_regions: [
      { key: 'hip', weight: 4 },
      { key: 'knee', weight: 4 },
      { key: 'ankle', weight: 4 },
      { key: 'hamstring', weight: 3 },
    ],
    dosage: {
      volume_unit: 'reps',
      default_sets: 3,
      default_reps: 5,
      default_distance: null,
      default_work_seconds: 20,
      default_rest_seconds: 45,
      tempo: '3-2-0-0',
      default_rpe_min: 4,
      default_rpe_max: 6,
      session_volume_min: 9,
      session_volume_max: 30,
    },
    phaseProfile: {
      role: 'primary',
      fit_weight: 5,
      freshness_required: false,
      fatigue_sensitivity: 2,
      fatigue_cost: 2,
      technical_complexity: 3,
      impact_level: 0,
      intensity_ceiling: 'low_to_moderate',
      daily_ok: false,
      requires_supervision: 'recommended_for_youth',
      notes: 'Slow eccentric and isometric joint resilience — own the bottom, pause with control, no bounce.',
    },
    movementRequirements: {
      primary_joint_actions: ['eccentric_control', 'isometric_hold', 'knee_flexion', 'hip_flexion', 'ankle_dorsiflexion'],
      primary_tissues: ['quads', 'hamstrings', 'adductors', 'calves', 'glutes'],
      breathing_demand: 'nasal',
      balance_demand: 'stable',
      impact_level: 0,
      prerequisites: ['Pain-free bilateral squat or split stance pattern'],
    },
    setupRequirements: [
      'Non-slip floor for isometric holds',
      'Sliders or socks on smooth surface for hamstring eccentric work',
      'Wall or anchor for Nordic lean support when prescribed',
    ],
    scalingGuidance:
      'Regress range, lever, or pause duration before adding speed; progress depth or hold time only when alignment and symptom tolerance stay clean.',
    pairsWellBefore: ['Breathing Reset', 'Ankle Mobility', 'Glute Bridge', 'Single-Leg Balance Hold'],
    pairsWellAfter: ['Landing Control Drills', 'Capacity Squat Progressions', 'Single-Leg Step-Down'],
    avoidBefore: ['Heavy leg training that compromises eccentric control'],
    doNotUseWhen: ['Acute joint pain during eccentric loading', 'History of hamstring strain with unresolved symptoms', 'Cannot control descent without collapse'],
  },
}

function mergeCoachingExecution(base, extra) {
  if (!extra) return base
  return {
    ...base,
    ...extra,
    setup: extra.setup ?? base.setup,
    execution_steps: extra.execution_steps ?? base.execution_steps,
    breathing_cues: extra.breathing_cues ?? base.breathing_cues,
    coach_cues: extra.coach_cues ?? base.coach_cues,
    athlete_cues: extra.athlete_cues ?? base.athlete_cues,
    common_faults: extra.common_faults ?? base.common_faults,
    stop_signs: extra.stop_signs ?? base.stop_signs,
  }
}

function focusName(name) {
  return name.split(' / ')[0].split(' — ')[0]
}

/**
 * Build a full Resilience rich card from a movement row and optional overrides.
 *
 * @param {{ number: number, name: string, slug: string, subrole: string, slot: string, family?: string }} row
 * @param {Record<string, unknown>} [extra]
 */
export function buildControlCard(row, extra = {}) {
  const { slug, name, subrole, slot } = row
  const family = row.family ?? FAMILY_BY_SUBROLE[subrole]
  const cfg = SUBROLE_CONFIG[subrole]
  if (!cfg) throw new Error(`Unknown control subrole: ${subrole}`)

  const focus = focusName(name)
  const dosageOverride = DOSAGE_OVERRIDES[slug] ?? {}
  const equipment = EQUIP_OVERRIDES[slug] ?? cfg.equipment
  const dailyOk = DAILY_OK_SLUGS.has(slug)

  const baseCoachingExecution = {
    movement_description: `Resilience drill: ${name}. Own positions, maintain alignment, and finish each rep or hold with precision — not speed or volume.`,
    setup: [
      'Clear space and explain the control goal',
      'Confirm pain-free range and appropriate supervision for youth',
      'Set braced posture before starting',
    ],
    execution_steps: [
      'Set braced posture and controlled tempo',
      `Complete prescribed reps, holds, or sticks for ${focus}`,
      'Rest fully before the next set',
    ],
    breathing_cues: ['Nasal breathing where possible — avoid breath-holding or rib flare'],
    coach_cues: ['Own the position', 'Stay aligned', 'Quality over speed or volume'],
    athlete_cues: ['Brace', 'Stay still', 'Control the finish'],
    common_faults: ['Rushing reps', 'Loss of alignment', 'Breath-holding or rib flare'],
    stop_signs: ['Joint pain during the drill', 'Visible loss of control or fear response', 'Athlete cannot maintain starting position safely'],
  }

  const card = {
    slug,
    name,
    slot,
    subrole,
    family,
    cardSummary: `${focus} — Resilience drill for ${family.toLowerCase()} with precision, alignment, and low-to-moderate stress.`,
    description: `The athlete performs ${name} with controlled tempo, clean alignment, and a quiet finish. Control phase intent is position ownership and resilience — not force production or conditioning volume.`,
    coachLanguage: `Use as Resilience work in ${slot}. Precision and alignment with full rest — ${CLUSTER_MISUSE}`,
    athleteLanguage: `Move slow, stay aligned, and own the finish for ${focus}.`,
    tenets: cfg.tenets,
    methodologies: cfg.methodologies,
    physiology: cfg.physiology,
    patterns: cfg.patterns,
    equipment,
    body_regions: cfg.body_regions,
    whyItWorks: `${focus} trains controlled absorption, joint alignment, and trunk organization under low-to-moderate demand — building the resilience layer between Prepare access work and Capacity force loading.`,
    whyItGoesHere: `Belongs in ${slot} (${row.number}) — ${family} cluster for Resilience phase programming.`,
    commonMisuse: `${CLUSTER_MISUSE} Do not chase volume, speed, or load when alignment breaks down.`,
    scalingGuidance: cfg.scalingGuidance,
    movementRequirements: { ...cfg.movementRequirements },
    setupRequirements: [...cfg.setupRequirements],
    coachingExecution: baseCoachingExecution,
    dosage: { ...cfg.dosage, ...dosageOverride },
    phaseProfile: {
      ...cfg.phaseProfile,
      daily_ok: dailyOk,
      notes: `${focus}: ${cfg.phaseProfile.notes}`,
    },
    scaling: { ...SCALING_BASE },
    pairsWellBefore: [...cfg.pairsWellBefore],
    pairsWellAfter: [...cfg.pairsWellAfter],
    avoidBefore: [...cfg.avoidBefore],
    doNotUseWhen: [...cfg.doNotUseWhen],
    genderSpecificNotes: GENDER_DEFAULT,
    goodForSessions: [...cfg.goodForSessions],
    mediaReferences: [`Resilience programming — ${family}`, `${focus} coaching progressions`],
    mediaInternalNotes: [`Control card #${row.number} — validator should flag alignment loss and rushed reps on ${slug}.`],
  }

  const merged = {
    ...card,
    ...extra,
    tenets: extra.tenets ?? card.tenets,
    methodologies: extra.methodologies ?? card.methodologies,
    physiology: extra.physiology ?? card.physiology,
    patterns: extra.patterns ?? card.patterns,
    equipment: extra.equipment ?? card.equipment,
    body_regions: extra.body_regions ?? card.body_regions,
    setupRequirements: extra.setupRequirements ?? card.setupRequirements,
    pairsWellBefore: extra.pairsWellBefore ?? card.pairsWellBefore,
    pairsWellAfter: extra.pairsWellAfter ?? card.pairsWellAfter,
    avoidBefore: extra.avoidBefore ?? card.avoidBefore,
    doNotUseWhen: extra.doNotUseWhen ?? card.doNotUseWhen,
    goodForSessions: extra.goodForSessions ?? card.goodForSessions,
    mediaReferences: extra.mediaReferences ?? card.mediaReferences,
    mediaInternalNotes: extra.mediaInternalNotes ?? card.mediaInternalNotes,
    dosage: { ...card.dosage, ...(extra.dosage ?? {}) },
    phaseProfile: { ...card.phaseProfile, ...(extra.phaseProfile ?? {}) },
    scaling: { ...card.scaling, ...(extra.scaling ?? {}) },
    movementRequirements: { ...card.movementRequirements, ...(extra.movementRequirements ?? {}) },
    coachingExecution: mergeCoachingExecution(card.coachingExecution, extra.coachingExecution),
  }

  if (extra.scalingOverrides) {
    merged.scaling = { ...merged.scaling, ...extra.scalingOverrides }
    delete merged.scalingOverrides
  }

  return merged
}
