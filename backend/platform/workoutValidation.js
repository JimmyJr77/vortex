import { loadSubroleMapForPhase, PREPARE_AND_ACCESS, MOVEMENT_INTELLIGENCE, OUTPUT, CAPACITY, CONTROL_RESILIENCE } from './phaseSubrole.js'
import {
  analyzeControlResilienceReadiness,
  analyzeControlLandingReadiness,
  analyzeControlSingleLegReadiness,
  analyzeControlTrunkReadiness,
  analyzeControlSlowEccentricReadiness,
  analyzeControlHandSupportReadiness,
} from './controlResilienceValidation.js'

const SUBROLE_ORDER = {
  raise: 10,
  mobilize: 20,
  activate: 30,
  integrate: 40,
  potentiate_bridge: 50,
}

const PHASE_ORDER = [
  'prepare_and_access',
  'movement_intelligence',
  'output',
  'capacity',
  'resilience',
  'sustained_capacity',
  'restore',
]

function phaseIndex(key) {
  const idx = PHASE_ORDER.indexOf(key)
  return idx >= 0 ? idx : 999
}

function itemSeconds(item) {
  const sets = Number(item.sets) || 1
  const work = Number(item.work_seconds ?? item.est_seconds_per_set) || 45
  const rest = Number(item.rest_seconds) || 0
  return sets * work + sets * rest
}

function blockSeconds(block) {
  const rounds = Number(block.rounds) || 1
  const itemsSeconds = (block.items ?? []).reduce((sum, item) => sum + itemSeconds(item), 0)
  const restBetween = Number(block.rest_between_rounds_seconds) || 0
  return rounds * itemsSeconds + restBetween * Math.max(rounds - 1, 0)
}

function computePriorFatigue(blockMeta, blockIndex, profileByExercisePhase, regimenByExercise) {
  let priorFatigue = 0
  for (let j = 0; j < blockIndex; j++) {
    const priorPhase = blockMeta[j].phaseKey
    if (priorPhase === 'sustained_capacity') priorFatigue = Math.max(priorFatigue, 4)
    if (priorPhase === 'capacity') priorFatigue = Math.max(priorFatigue, 3)
    for (const pi of blockMeta[j].block.items ?? []) {
      const exerciseId = Number(pi.exercise_id ?? pi.exerciseId)
      if (!exerciseId || !priorPhase) continue
      const profile = profileByExercisePhase.get(`${exerciseId}:${priorPhase}`)
      const regimen = regimenByExercise.get(String(exerciseId))
      if (profile) priorFatigue = Math.max(priorFatigue, Number(profile.fatigue_cost) || 0)
      if (regimen?.counts_as_conditioning) priorFatigue = Math.max(priorFatigue, 4)
      if (regimen?.counts_as_high_intensity) priorFatigue = Math.max(priorFatigue, 3)
      priorFatigue = Math.max(priorFatigue, Number(pi.fatigue_cost) || 0)
    }
  }
  return priorFatigue
}

function computeCoverage(blockMeta, tagRows, taxonomyKeys) {
  const coverage = { tenets: {}, methodologies: {}, physiology: {} }
  for (const facetType of ['tenet', 'methodology', 'physiology']) {
    for (const key of taxonomyKeys[facetType] ?? []) {
      coverage[facetType === 'tenet' ? 'tenets' : facetType === 'methodology' ? 'methodologies' : 'physiology'][key] = 0
    }
  }
  for (const meta of blockMeta) {
    for (const item of meta.block.items ?? []) {
      const exerciseId = Number(item.exercise_id ?? item.exerciseId)
      if (!exerciseId) continue
      for (const tag of tagRows.filter((t) => String(t.exercise_id) === String(exerciseId))) {
        const bucket = tag.facet_type === 'tenet' ? 'tenets' : tag.facet_type === 'methodology' ? 'methodologies' : tag.facet_type === 'physiology' ? 'physiology' : null
        if (!bucket || !tag.facet_key) continue
        coverage[bucket][tag.facet_key] = (coverage[bucket][tag.facet_key] ?? 0) + Number(tag.weight || 1)
      }
    }
  }
  return coverage
}

function computeFatigueSummary(blockMeta, profileByExercisePhase, regimenByExercise) {
  let neural = 0
  let impact = 0
  let tissue = 0
  let conditioning = 0
  for (const meta of blockMeta) {
    for (const item of meta.block.items ?? []) {
      const exerciseId = Number(item.exercise_id ?? item.exerciseId)
      if (!exerciseId) continue
      const regimen = regimenByExercise.get(String(exerciseId))
      const profile = meta.phaseKey ? profileByExercisePhase.get(`${exerciseId}:${meta.phaseKey}`) : null
      if (regimen?.counts_as_neural) neural += 2
      if (regimen?.counts_as_high_impact || (profile && Number(profile.impact_level) >= 4)) impact += 2
      if (regimen?.counts_as_tissue_stress) tissue += 2
      if (regimen?.counts_as_conditioning) conditioning += 3
      if (profile) {
        neural = Math.max(neural, Number(profile.freshness_required) ? 1 : 0)
        impact = Math.max(impact, Number(profile.impact_level) || 0)
      }
    }
  }
  return { neural_load: neural, impact_load: impact, tissue_stress: tissue, conditioning_load: conditioning }
}

function computeTimeSummary(blockMeta, budgetMinutes) {
  const plannedSeconds = blockMeta.reduce((sum, m) => sum + blockSeconds(m.block), 0)
  const budgetSeconds = (Number(budgetMinutes) || 0) * 60
  return {
    planned_seconds: plannedSeconds,
    budget_seconds: budgetSeconds,
    delta_seconds: budgetSeconds > 0 ? plannedSeconds - budgetSeconds : 0,
    planned_minutes: Math.round(plannedSeconds / 60),
    budget_minutes: budgetMinutes ?? null,
  }
}

/** Analyze Prepare & Access block for drills that steal output readiness. Pure helper for tests. */
function analyzePrepareAccessDrain(items, ctx) {
  const {
    profileByExercisePhase,
    methodologyKeysByExercise,
    dosageByExercise,
    phaseKey = PREPARE_AND_ACCESS,
  } = ctx

  const counts = {
    high_fatigue: 0,
    high_impact: 0,
    long_isometric: 0,
    conditioning_like: 0,
    non_low_ceiling: 0,
  }
  const flagged = []

  for (const item of items ?? []) {
    const exerciseId = Number(item.exercise_id ?? item.exerciseId)
    if (!exerciseId) continue
    const name = item.exercise_name ?? item.exerciseName ?? String(exerciseId)
    const profile = profileByExercisePhase.get(`${exerciseId}:${phaseKey}`)
    const methods = methodologyKeysByExercise.get(String(exerciseId)) ?? []
    const dosage = dosageByExercise.get(String(exerciseId))
    const fatigue = Number(profile?.fatigue_cost) || 0
    const impact = Number(profile?.impact_level) || 0
    const workSeconds = Number(item.work_seconds ?? item.workSeconds ?? dosage?.default_work_seconds) || 0
    const sets = Number(item.sets ?? dosage?.default_sets) || 1

    if (fatigue > 2) {
      counts.high_fatigue += 1
      flagged.push({ name, reason: 'high_fatigue_cost', fatigue })
    }
    if (impact >= 2) {
      counts.high_impact += 1
      flagged.push({ name, reason: 'high_impact', impact })
    }
    if (methods.includes('isometrics') && workSeconds * sets >= 45) {
      counts.long_isometric += 1
      flagged.push({ name, reason: 'long_isometric', workSeconds })
    }
    if (methods.includes('hiit') || methods.includes('plyometrics')) {
      counts.conditioning_like += 1
      flagged.push({ name, reason: 'conditioning_methodology', methods })
    }
    if (profile?.intensity_ceiling && profile.intensity_ceiling !== 'low') {
      counts.non_low_ceiling += 1
      flagged.push({ name, reason: 'non_low_intensity_ceiling', ceiling: profile.intensity_ceiling })
    }
  }

  const stealsOutput =
    counts.high_fatigue >= 2
    || counts.high_impact >= 3
    || counts.long_isometric >= 2
    || counts.conditioning_like >= 1
    || counts.non_low_ceiling >= 2

  return { counts, flagged, stealsOutput }
}

const LOW_POGOS_SLUG = 'low-pogos'
const JUMP_ROPE_SLUG = 'jump-rope-easy-bounce'
const CALF_HEEL_DROP_SLUG = 'calf-raise-to-heel-drop'
const LOWER_LEG_SYMPTOM_PATTERN = /achilles|heel|shin|calf/i

function exerciseSlug(item, slugByExercise) {
  const exerciseId = Number(item.exercise_id ?? item.exerciseId)
  return slugByExercise.get(String(exerciseId)) ?? null
}

function itemContacts(item, dosage, slug) {
  if (item.contacts != null) return Number(item.contacts) || 0
  const sets = Number(item.sets ?? dosage?.default_sets) || 1
  const reps = Number(item.reps ?? dosage?.default_reps) || 0
  if (reps > 0) return sets * reps
  if (slug === LOW_POGOS_SLUG && dosage?.default_contacts != null) {
    return Number(dosage.default_contacts) || 0
  }
  return 0
}

function itemWorkSeconds(item, dosage) {
  const sets = Number(item.sets ?? dosage?.default_sets) || 1
  const work = Number(item.work_seconds ?? item.workSeconds ?? dosage?.default_work_seconds) || 0
  return sets * work
}

function itemRpe(item, dosage) {
  const rpe = item.rpe ?? item.RPE
  if (rpe != null) return Number(rpe) || 0
  return Number(dosage?.default_rpe_max ?? dosage?.default_rpe_min) || 0
}

function hasLowerLegSymptomFlags(draft) {
  const sources = [
    ...(draft?.readiness_checks ?? []),
    ...(draft?.safety_flags ?? []),
    ...(draft?.audience_json?.exclusions ?? []),
    ...(draft?.audience_json?.readiness_checks ?? []),
    ...(draft?.coach_rationale_json?.watch_points ?? []),
  ]
  return sources.some((s) => LOWER_LEG_SYMPTOM_PATTERN.test(String(s)))
}

function hasLaterOutputPhase(blockMeta, prepareBlockIndex) {
  for (let j = prepareBlockIndex + 1; j < blockMeta.length; j++) {
    const key = blockMeta[j].phaseKey
    if (key === 'output' || key === 'movement_intelligence') return true
  }
  return false
}

/** Lower-leg Prepare & Access dose and symptom checks. Pure helper for tests. */
function analyzePrepareLowerLegReadiness(items, ctx) {
  const {
    slugByExercise,
    profileByExercisePhase,
    dosageByExercise,
    phaseKey = PREPARE_AND_ACCESS,
    blockMeta = [],
    prepareBlockIndex = 0,
    draft = {},
  } = ctx

  const findings = []
  let totalElasticContacts = 0
  let highImpactCount = 0
  let hasElasticPrep = false

  for (const item of items ?? []) {
    const exerciseId = Number(item.exercise_id ?? item.exerciseId)
    if (!exerciseId) continue
    const name = item.exercise_name ?? item.exerciseName ?? String(exerciseId)
    const slug = exerciseSlug(item, slugByExercise)
    const dosage = dosageByExercise.get(String(exerciseId))
    const profile = profileByExercisePhase.get(`${exerciseId}:${phaseKey}`)
    const impact = Number(profile?.impact_level) || 0

    if (slug === LOW_POGOS_SLUG) {
      hasElasticPrep = true
      const contacts = itemContacts(item, dosage, slug)
      totalElasticContacts += contacts
      if (contacts > 40) {
        findings.push({
          rule_key: 'prepare_pogos_output_dose',
          message: `${name}: pogos contacts (${contacts}) exceed ~40 before Output.`,
          affected_items: [name],
          meta: { contacts, slug },
        })
      }
    }

    if (slug === JUMP_ROPE_SLUG) {
      hasElasticPrep = true
      const workSeconds = itemWorkSeconds(item, dosage)
      const rpe = itemRpe(item, dosage)
      totalElasticContacts += Math.max(1, Math.round(workSeconds / 2))
      if (workSeconds > 90) {
        findings.push({
          rule_key: 'prepare_jump_rope_fitness_dose',
          message: `${name}: jump rope duration (${workSeconds}s) exceeds ~90s at warm-up dose.`,
          affected_items: [name],
          meta: { work_seconds: workSeconds, slug },
        })
      } else if (rpe > 4) {
        findings.push({
          rule_key: 'prepare_jump_rope_fitness_dose',
          message: `${name}: jump rope RPE (${rpe}) is high for Prepare & Access before Output.`,
          affected_items: [name],
          meta: { rpe, slug },
        })
      }
    }

    if (slug === CALF_HEEL_DROP_SLUG && hasLaterOutputPhase(blockMeta, prepareBlockIndex)) {
      const sets = Number(item.sets ?? dosage?.default_sets) || 1
      const reps = Number(item.reps ?? dosage?.default_reps) || 0
      const totalReps = sets * reps
      if (totalReps > 15) {
        findings.push({
          rule_key: 'prepare_calf_fatigue_before_output',
          message: `${name}: calf raise volume (${totalReps} reps) may pre-fatigue calves before Output.`,
          affected_items: [name],
          meta: { total_reps: totalReps, slug },
        })
      }
    }

    if (impact >= 2) highImpactCount += 1
  }

  if (
    hasElasticPrep
    && hasLowerLegSymptomFlags(draft)
  ) {
    const elasticNames = (items ?? [])
      .filter((it) => {
        const slug = exerciseSlug(it, slugByExercise)
        return slug === LOW_POGOS_SLUG || slug === JUMP_ROPE_SLUG
      })
      .map((it) => it.exercise_name ?? it.exerciseName ?? String(it.exercise_id ?? it.exerciseId))
    findings.push({
      rule_key: 'prepare_lower_leg_symptoms',
      message: 'Elastic lower-leg prep paired with Achilles/heel/shin/calf symptom flags.',
      affected_items: elasticNames,
      meta: { symptom_flags: true },
    })
  }

  if (
    hasLaterOutputPhase(blockMeta, prepareBlockIndex)
    && (highImpactCount >= 2 || totalElasticContacts > 60)
  ) {
    findings.push({
      rule_key: 'prepare_lower_leg_spring_check',
      message: 'Prepare & Access lower-leg spring volume may reduce Output readiness.',
      affected_items: [],
      meta: { high_impact_count: highImpactCount, total_elastic_contacts: totalElasticContacts },
    })
  }

  return findings
}

const DEEP_SQUAT_PRY_SLUG = 'deep-squat-pry'
const COSSACK_SHIFT_SLUG = 'cossack-shift'
const LATERAL_LUNGE_SHIFT_SLUG = 'lateral-lunge-shift'
const LEG_SWING_SLUGS = new Set(['leg-swings-front-back', 'leg-swings-lateral'])
const HIP_ROTATION_SLUGS = new Set(['9090-hip-switch', 'shin-box-switch', 'shin-box-get-up', 'hip-cars'])
const GROIN_SENSITIVE_SLUGS = new Set([
  'adductor-rockback', 'frog-rockback', COSSACK_SHIFT_SLUG, LATERAL_LUNGE_SHIFT_SLUG,
])
const HIP_CLUSTER_SLUGS = new Set([
  'walking-knee-hug', 'walking-quad-pull', 'leg-swings-front-back', 'leg-swings-lateral',
  '9090-hip-switch', 'shin-box-switch', 'shin-box-get-up', 'hip-cars',
  'adductor-rockback', 'frog-rockback', COSSACK_SHIFT_SLUG, DEEP_SQUAT_PRY_SLUG,
  'squat-to-stand-with-reach', LATERAL_LUNGE_SHIFT_SLUG,
])
const GROIN_SYMPTOM_PATTERN = /groin|adductor/i

function itemTotalReps(item, dosage) {
  const sets = Number(item.sets ?? dosage?.default_sets) || 1
  const reps = Number(item.reps ?? dosage?.default_reps) || 0
  return sets * reps
}

function hasGroinSymptomFlags(draft) {
  const sources = [
    ...(draft?.readiness_checks ?? []),
    ...(draft?.safety_flags ?? []),
    ...(draft?.audience_json?.exclusions ?? []),
    ...(draft?.audience_json?.readiness_checks ?? []),
    ...(draft?.coach_rationale_json?.watch_points ?? []),
  ]
  return sources.some((s) => GROIN_SYMPTOM_PATTERN.test(String(s)))
}

/** Hip/pelvis Prepare & Access dose and symptom checks. Pure helper for tests. */
function analyzePrepareHipAccessReadiness(items, ctx) {
  const {
    slugByExercise,
    profileByExercisePhase,
    dosageByExercise,
    methodologyKeysByExercise,
    phaseKey = PREPARE_AND_ACCESS,
    blockMeta = [],
    prepareBlockIndex = 0,
    draft = {},
  } = ctx

  const findings = []
  let hipRotationSlugCount = 0
  let hipRotationReps = 0
  let hipClusterReps = 0
  let highFatigueHipCount = 0
  let hasGroinSensitive = false

  for (const item of items ?? []) {
    const exerciseId = Number(item.exercise_id ?? item.exerciseId)
    if (!exerciseId) continue
    const name = item.exercise_name ?? item.exerciseName ?? String(exerciseId)
    const slug = exerciseSlug(item, slugByExercise)
    if (!slug) continue
    const dosage = dosageByExercise.get(String(exerciseId))
    const profile = profileByExercisePhase.get(`${exerciseId}:${phaseKey}`)
    const methods = methodologyKeysByExercise?.get(String(exerciseId)) ?? []
    const totalReps = itemTotalReps(item, dosage)

    if (HIP_CLUSTER_SLUGS.has(slug)) hipClusterReps += totalReps
    if (GROIN_SENSITIVE_SLUGS.has(slug)) hasGroinSensitive = true

    if (slug === DEEP_SQUAT_PRY_SLUG) {
      const workSeconds = itemWorkSeconds(item, dosage)
      if (workSeconds > 60) {
        findings.push({
          rule_key: 'prepare_squat_pry_duration',
          message: `${name}: deep squat pry (${workSeconds}s) exceeds ~60s — becoming a mobility block.`,
          affected_items: [name],
          meta: { work_seconds: workSeconds, slug },
        })
      }
    }

    if (
      (slug === COSSACK_SHIFT_SLUG || slug === LATERAL_LUNGE_SHIFT_SLUG)
      && hasLaterOutputPhase(blockMeta, prepareBlockIndex)
      && totalReps > 16
    ) {
      findings.push({
        rule_key: 'prepare_frontal_plane_fatigue',
        message: `${name}: frontal-plane prep volume (${totalReps} reps) may fatigue adductors before Output.`,
        affected_items: [name],
        meta: { total_reps: totalReps, slug },
      })
    }

    if (LEG_SWING_SLUGS.has(slug)) {
      const impact = Number(profile?.impact_level) || 0
      const rpe = itemRpe(item, dosage)
      if (impact >= 2 || methods.includes('plyometrics') || rpe > 4) {
        findings.push({
          rule_key: 'prepare_leg_swing_intensity',
          message: `${name}: leg swings should stay dynamic and controlled, not ballistic.`,
          affected_items: [name],
          meta: { impact, rpe, slug },
        })
      }
    }

    if (HIP_ROTATION_SLUGS.has(slug)) {
      hipRotationSlugCount += 1
      hipRotationReps += totalReps
    }

    if (HIP_CLUSTER_SLUGS.has(slug) && Number(profile?.fatigue_cost) >= 2) {
      highFatigueHipCount += 1
    }
  }

  if (hipRotationSlugCount >= 3 && hipRotationReps > 24) {
    findings.push({
      rule_key: 'prepare_hip_rotation_volume',
      message: `Hip rotation prep volume (${hipRotationReps} reps across ${hipRotationSlugCount} drills) may be excessive before Output.`,
      affected_items: [],
      meta: { hip_rotation_reps: hipRotationReps, hip_rotation_drill_count: hipRotationSlugCount },
    })
  }

  if (hasGroinSensitive && hasGroinSymptomFlags(draft)) {
    const groinNames = (items ?? [])
      .filter((it) => GROIN_SENSITIVE_SLUGS.has(exerciseSlug(it, slugByExercise) ?? ''))
      .map((it) => it.exercise_name ?? it.exerciseName ?? String(it.exercise_id ?? it.exerciseId))
    findings.push({
      rule_key: 'prepare_groin_symptoms',
      message: 'Adductor/groin-sensitive prep paired with groin symptom flags.',
      affected_items: groinNames,
      meta: { symptom_flags: true },
    })
  }

  if (
    hasLaterOutputPhase(blockMeta, prepareBlockIndex)
    && (highFatigueHipCount >= 2 || hipClusterReps > 80)
  ) {
    findings.push({
      rule_key: 'prepare_hip_heaviness_before_output',
      message: 'Prepare & Access hip/pelvis volume may create leg heaviness before Output.',
      affected_items: [],
      meta: { high_fatigue_hip_count: highFatigueHipCount, hip_cluster_reps: hipClusterReps },
    })
  }

  return findings
}

const GLUTE_BRIDGE_SLUG = 'glute-bridge'
const GLUTE_BRIDGE_MARCH_SLUG = 'glute-bridge-march'
const DEAD_BUG_HEEL_TAP_SLUG = 'dead-bug-heel-tap'
const BIRD_DOG_SLUG = 'bird-dog'
const MINI_BAND_LATERAL_WALK_SLUG = 'mini-band-lateral-walk'
const A_MARCH_SLUG = 'a-march'
const ACTIVATION_CLUSTER_SLUGS = new Set([
  GLUTE_BRIDGE_SLUG,
  GLUTE_BRIDGE_MARCH_SLUG,
  DEAD_BUG_HEEL_TAP_SLUG,
  BIRD_DOG_SLUG,
  MINI_BAND_LATERAL_WALK_SLUG,
  A_MARCH_SLUG,
])
const PELVIC_SYMPTOM_PATTERN = /postpartum|pelvic\s*floor|pelvic\s*symptom|diastasis|prolapse/i

function hasPriorConditioningPhase(blockMeta, blockIndex) {
  for (let j = 0; j < blockIndex; j++) {
    const key = blockMeta[j].phaseKey
    if (key === 'sustained_capacity' || key === 'capacity_resilience') return true
  }
  return false
}

function hasPelvicSymptomFlags(draft) {
  const sources = [
    ...(draft?.readiness_checks ?? []),
    ...(draft?.safety_flags ?? []),
    ...(draft?.audience_json?.exclusions ?? []),
    ...(draft?.audience_json?.readiness_checks ?? []),
    ...(draft?.coach_rationale_json?.watch_points ?? []),
  ]
  return sources.some((s) => PELVIC_SYMPTOM_PATTERN.test(String(s)))
}

/** Activation / integration Prepare & Access dose and symptom checks. Pure helper for tests. */
function analyzePrepareActivationReadiness(items, ctx) {
  const {
    slugByExercise,
    dosageByExercise,
    blockMeta = [],
    prepareBlockIndex = 0,
    draft = {},
  } = ctx

  const findings = []
  const priorConditioning = hasPriorConditioningPhase(blockMeta, prepareBlockIndex)
  const pelvicSymptoms = hasPelvicSymptomFlags(draft)
  let hasActivationWithPelvicFlags = false

  for (const item of items ?? []) {
    const exerciseId = Number(item.exercise_id ?? item.exerciseId)
    if (!exerciseId) continue
    const name = item.exercise_name ?? item.exerciseName ?? String(exerciseId)
    const slug = exerciseSlug(item, slugByExercise)
    const dosage = dosageByExercise.get(String(exerciseId))
    const totalReps = itemTotalReps(item, dosage)
    const workSeconds = Number(item.work_seconds ?? item.workSeconds ?? dosage?.default_work_seconds) || 0

    if (slug === GLUTE_BRIDGE_SLUG) {
      if (totalReps > 15 || workSeconds > 30) {
        findings.push({
          rule_key: 'prepare_glute_bridge_dose',
          message: `${name}: glute bridge volume (${totalReps} reps${workSeconds > 30 ? `, ${workSeconds}s work` : ''}) may become Capacity or Resilience before Output.`,
          affected_items: [name],
          meta: { total_reps: totalReps, work_seconds: workSeconds, slug },
        })
      }
    }

    if (slug === MINI_BAND_LATERAL_WALK_SLUG && totalReps > 24) {
      findings.push({
        rule_key: 'prepare_mini_band_lateral_dose',
        message: `${name}: lateral walk volume (${totalReps} steps) may fatigue glutes before agility or Output.`,
        affected_items: [name],
        meta: { total_reps: totalReps, slug },
      })
    }

    if (slug === A_MARCH_SLUG) {
      if (priorConditioning) {
        findings.push({
          rule_key: 'prepare_amarch_after_conditioning',
          message: `${name} is sprint-mechanics prep placed after conditioning — posture and rhythm suffer under fatigue.`,
          affected_items: [name],
          meta: { slug },
        })
      }
      const rpe = itemRpe(item, dosage)
      if (rpe > 4) {
        findings.push({
          rule_key: 'prepare_amarch_skill_phase',
          message: `${name}: high RPE (${rpe}) suggests Movement Intelligence, not Prepare & Access.`,
          affected_items: [name],
          meta: { rpe, slug },
        })
      }
    }

    if (pelvicSymptoms && ACTIVATION_CLUSTER_SLUGS.has(slug ?? '')) {
      hasActivationWithPelvicFlags = true
    }
  }

  if (hasActivationWithPelvicFlags) {
    const activationNames = (items ?? [])
      .filter((it) => ACTIVATION_CLUSTER_SLUGS.has(exerciseSlug(it, slugByExercise) ?? ''))
      .map((it) => it.exercise_name ?? it.exerciseName ?? String(it.exercise_id ?? it.exerciseId))
    findings.push({
      rule_key: 'prepare_activation_pelvic_floor',
      message: 'Activation cluster paired with postpartum/pelvic-floor symptom flags — use low-pressure variants.',
      affected_items: activationNames,
      meta: { symptom_flags: true },
    })
  }

  return findings
}

const TUMBLING_SKILL_SLUGS = new Set([
  'log-roll', 'egg-roll', 'rock-and-roll-to-stand', 'forward-roll-progression',
  'backward-roll-progression', 'shoulder-roll-progression', 'donkey-kick',
  'wall-walk-handstand-line', 'handstand-kick-up-wall', 'handstand-hold', 'cartwheel',
  'cartwheel-step-over', 'cartwheel-finish-lunge', 'round-off', 'hurdle-step-lunge',
])
const SPRINT_MECHANICS_SKILL_SLUGS = new Set([
  'wall-drill-split-shin-hold', 'wall-drill-march', 'wall-drill-switch', 'a-march',
  'a-skip', 'ankling-dribble-march', 'straight-leg-bound-march', 'falling-start-hold',
  'two-point-start-walk-in', 'arm-action-drill',
])
const LADDER_SKILL_SLUGS = new Set(['ladder-in-in-out-out', 'ladder-ickey-shuffle'])
const BALANCE_SKILL_SLUGS = new Set([
  'beam-walk', 'single-leg-balance-clock', 'cross-crawl-march', 'skipping-rhythm-drill',
  'carioca-walkthrough', 'lateral-shuffle-walkthrough', 'backpedal-walkthrough',
  'ladder-in-in-out-out', 'ladder-ickey-shuffle', 'low-hurdle-step-over',
])
const PERCEPTION_SKILL_SLUGS = new Set([
  'mirror-shuffle-drill', 'coach-point-and-go', 'colored-cone-call-out',
  'ball-drop-reaction', 'partner-shadow-tag', 'gate-reaction-drill',
])
const LATERAL_SHUFFLE_MECHANICS_SLUG = 'lateral-shuffle-walkthrough'
const MIRROR_SHUFFLE_SLUG = 'mirror-shuffle-drill'
const TAG_GAME_SLUG = 'partner-shadow-tag'
const BALL_DROP_SLUG = 'ball-drop-reaction'
const GATE_REACTION_SLUG = 'gate-reaction-drill'
const REACTIVE_OUTPUT_SLUGS = new Set([BALL_DROP_SLUG, GATE_REACTION_SLUG])
const DIVE_CATCH_PATTERN = /dive|diving|fall(?:ing)?\s+catch/i
const UNSAFE_TAG_CONTACT_PATTERN = /grab|push|collision|unsafe\s+contact|rough\s+tag/i
const SHAPE_HOLD_SLUGS = new Set([
  'hollow-body-hold', 'arch-body-hold', 'tuck-hold-rock', 'front-support-shape-hold',
  'rear-support-shape-hold',
])

function hasPriorFatiguePhase(blockMeta, blockIndex) {
  for (let j = 0; j < blockIndex; j++) {
    const key = blockMeta[j].phaseKey
    if (key === 'sustained_capacity' || key === 'capacity_resilience') return true
  }
  return false
}

/** Movement Intelligence dose and placement checks. Pure helper for tests. */
function analyzeSkillMovementIntelligenceReadiness(items, ctx) {
  const {
    slugByExercise,
    profileByExercisePhase,
    dosageByExercise,
    phaseKey = MOVEMENT_INTELLIGENCE,
    blockMeta = [],
    skillBlockIndex = 0,
  } = ctx

  const findings = []
  let totalFatigueCost = 0
  let rpeSum = 0
  let rpeCount = 0
  const priorFatiguePhase = hasPriorFatiguePhase(blockMeta, skillBlockIndex)

  for (const item of items ?? []) {
    const exerciseId = Number(item.exercise_id ?? item.exerciseId)
    if (!exerciseId) continue
    const name = item.exercise_name ?? item.exerciseName ?? String(exerciseId)
    const slug = exerciseSlug(item, slugByExercise)
    const dosage = dosageByExercise.get(String(exerciseId))
    const profile = profileByExercisePhase.get(`${exerciseId}:${phaseKey}`)
    const fatigueCost = Number(profile?.fatigue_cost) || 1
    const impact = Number(profile?.impact_level) || 0
    totalFatigueCost += fatigueCost

    const rpe = itemRpe(item, dosage)
    if (rpe > 0) {
      rpeSum += rpe
      rpeCount += 1
    }

    if (priorFatiguePhase && TUMBLING_SKILL_SLUGS.has(slug ?? '')) {
      findings.push({
        rule_key: 'skill_tumbling_after_fitness',
        message: `${name}: technical tumbling should usually occur while fresh to protect coordination and safety.`,
        affected_items: [name],
        meta: { slug },
      })
    }

    if (priorFatiguePhase && BALANCE_SKILL_SLUGS.has(slug ?? '')) {
      findings.push({
        rule_key: 'skill_balance_after_fitness',
        message: `${name}: balance/coordination/rhythm skill quality may be reduced after Fitness — move earlier or reduce complexity.`,
        affected_items: [name],
        meta: { slug },
      })
    }

    if (LADDER_SKILL_SLUGS.has(slug ?? '')) {
      const workSeconds = itemWorkSeconds(item, dosage)
      const restSeconds = Number(item.rest_seconds ?? item.restSeconds ?? dosage?.default_rest_seconds) || 0
      const sets = Number(item.sets ?? item.default_sets ?? dosage?.default_sets) || 1
      const reps = Number(item.reps ?? item.default_reps ?? dosage?.default_reps) || 1
      const totalPasses = sets * reps
      if (workSeconds > 90 || (workSeconds > 45 && restSeconds < 15)) {
        findings.push({
          rule_key: 'skill_agility_conditioning_dose',
          message: `${name}: ladder/footwork volume (${workSeconds}s work) may be conditioning, not skill.`,
          affected_items: [name],
          meta: { work_seconds: workSeconds, rest_seconds: restSeconds, slug },
        })
      }
      if (totalPasses > 4 || (reps > 4 && sets >= 1)) {
        findings.push({
          rule_key: 'skill_ladder_pass_volume',
          message: `${name}: ladder passes (${totalPasses}) exceed Skill dose (~4 per pattern) — may belong in Sustained Capacity.`,
          affected_items: [name],
          meta: { total_passes: totalPasses, sets, reps, slug },
        })
      }
    }

    if (slug === 'skipping-rhythm-drill' && rpe > 5) {
      findings.push({
        rule_key: 'skill_skipping_high_intensity',
        message: `${name}: RPE ${rpe} suggests Output or conditioning — reduce skip height, distance, or intensity for Skill rhythm work.`,
        affected_items: [name],
        meta: { rpe, slug },
      })
    }

    if (SPRINT_MECHANICS_SKILL_SLUGS.has(slug ?? '') && (rpe > 5 || impact >= 2)) {
      findings.push({
        rule_key: 'skill_sprint_max_speed',
        message: `${name}: high RPE (${rpe}) or impact suggests Output, not Skill-phase sprint mechanics.`,
        affected_items: [name],
        meta: { rpe, impact, slug },
      })
    }

    if (SHAPE_HOLD_SLUGS.has(slug ?? '')) {
      const workSeconds = Number(item.work_seconds ?? item.workSeconds ?? dosage?.default_work_seconds) || 0
      if (workSeconds > 30) {
        findings.push({
          rule_key: 'skill_shape_hold_duration',
          message: `${name}: shape hold (${workSeconds}s) may belong in Resilience, not Skill.`,
          affected_items: [name],
          meta: { work_seconds: workSeconds, slug },
        })
      }
    }
  }

  const avgRpe = rpeCount > 0 ? rpeSum / rpeCount : 0
  if (avgRpe > 6 || totalFatigueCost >= 8) {
    findings.push({
      rule_key: 'skill_block_fatigue',
      message: `Movement Intelligence block may be fatigue-based (avg RPE ${avgRpe.toFixed(1)}, fatigue sum ${totalFatigueCost}).`,
      affected_items: [],
      meta: { avg_rpe: avgRpe, total_fatigue_cost: totalFatigueCost },
    })
  }

  return findings
}

const ROLL_SLUGS = new Set([
  'log-roll', 'egg-roll', 'rock-and-roll-to-stand',
  'forward-roll-progression', 'backward-roll-progression', 'shoulder-roll-progression',
])
const HANDSTAND_SKILL_SLUGS = new Set(['wall-walk-handstand-line', 'handstand-kick-up-wall'])
const CARTWHEEL_SLUGS = new Set(['cartwheel', 'cartwheel-step-over', 'cartwheel-finish-lunge'])
const FORWARD_ROLL_PREREQ_SLUGS = new Set(['egg-roll', 'rock-and-roll-to-stand', 'tuck-hold-rock'])
const BACKWARD_ROLL_PROGRESSION_EQUIP = new Set(['wedge', 'panel_mat'])
const NECK_SYMPTOM_PATTERN = /neck|head\s*pressure|headache|head\s*contact/i
const ROTATIONAL_STOP_PATTERN = /dizziness|vertigo|neck|fear|panic|disorient|orientation\s*loss/i

function draftWatchText(draft = {}) {
  return [
    ...(draft?.readiness_checks ?? []),
    ...(draft?.watch_points ?? []),
    ...(draft?.audience_json?.exclusions ?? []),
    ...(draft?.audience_json?.readiness_checks ?? []),
    ...(draft?.coach_rationale_json?.watch_points ?? []),
  ]
    .map((v) => String(v ?? ''))
    .join(' ')
}

function equipmentWeightMap(equipmentKeysByExercise, exerciseId) {
  return equipmentKeysByExercise.get(String(exerciseId)) ?? new Map()
}

function hasEquipment(exerciseId, key, equipmentKeysByExercise, minWeight = 1) {
  const weights = equipmentWeightMap(equipmentKeysByExercise, exerciseId)
  return (weights.get(key) ?? 0) >= minWeight
}

function hasAnyEquipment(exerciseId, keys, equipmentKeysByExercise, minWeight = 1) {
  for (const key of keys) {
    if (hasEquipment(exerciseId, key, equipmentKeysByExercise, minWeight)) return true
  }
  return false
}

/** Rotation / tumbling foundation cluster checks. Pure helper for tests. */
function analyzeSkillTumblingReadiness(items, ctx) {
  const {
    slugByExercise,
    dosageByExercise,
    equipmentKeysByExercise = new Map(),
    draft = {},
  } = ctx

  const findings = []
  const watchText = draftWatchText(draft)
  const hasNeckSymptoms = NECK_SYMPTOM_PATTERN.test(watchText)
  const hasRotationalStop = ROTATIONAL_STOP_PATTERN.test(watchText)

  const ordered = []
  for (const item of items ?? []) {
    const exerciseId = Number(item.exercise_id ?? item.exerciseId)
    if (!exerciseId) continue
    const name = item.exercise_name ?? item.exerciseName ?? String(exerciseId)
    const slug = exerciseSlug(item, slugByExercise)
    if (!slug) continue
    ordered.push({ item, exerciseId, name, slug })
  }

  const slugsInBlock = new Set(ordered.map((o) => o.slug))
  const slugIndex = (s) => ordered.findIndex((o) => o.slug === s)

  if (hasRotationalStop && ordered.some((o) => TUMBLING_SKILL_SLUGS.has(o.slug))) {
    findings.push({
      rule_key: 'skill_rotational_stop',
      severity: 'error',
      message: 'Rotational skill attempts should stop for the day — regress to shape drills when dizziness, fear, or orientation loss is present.',
      affected_items: ordered.filter((o) => TUMBLING_SKILL_SLUGS.has(o.slug)).map((o) => o.name),
      meta: { symptom_flags: true },
    })
  }

  if (slugsInBlock.has('round-off')) {
    const hasCartwheel = [...CARTWHEEL_SLUGS].some((s) => slugsInBlock.has(s))
    const hasHandstandLine = slugsInBlock.has('wall-walk-handstand-line')
    if (!hasCartwheel || !hasHandstandLine) {
      findings.push({
        rule_key: 'skill_roundoff_prerequisite',
        severity: 'error',
        message: 'Round-off foundations require cartwheel and handstand-line prerequisites in the same Skill block.',
        affected_items: ordered.filter((o) => o.slug === 'round-off').map((o) => o.name),
        meta: { has_cartwheel: hasCartwheel, has_handstand_line: hasHandstandLine },
      })
    }
  }

  const roundOffIdx = slugIndex('round-off')
  const cartwheelLineIdx = slugIndex('cartwheel')
  const cartwheelFinishIdx = slugIndex('cartwheel-finish-lunge')
  const hurdleIdx = slugIndex('hurdle-step-lunge')

  if (roundOffIdx >= 0 && cartwheelLineIdx >= 0 && roundOffIdx < cartwheelLineIdx) {
    findings.push({
      rule_key: 'skill_cartwheel_hand_placement',
      severity: 'recommendation',
      message: 'Use Cartwheel Hand-Placement Line Drill before round-off or full step-over progressions.',
      affected_items: [ordered[roundOffIdx].name],
      meta: { slug: 'round-off' },
    })
  }

  if (roundOffIdx >= 0 && cartwheelFinishIdx >= 0 && roundOffIdx < cartwheelFinishIdx) {
    findings.push({
      rule_key: 'skill_cartwheel_finish',
      severity: 'recommendation',
      message: 'Add Cartwheel Finish Lunge Drill before round-off entry when finish control is unstable.',
      affected_items: [ordered[roundOffIdx].name],
      meta: { slug: 'round-off' },
    })
  }

  const stepOverIdx = slugIndex('cartwheel-step-over')
  if (stepOverIdx >= 0 && cartwheelLineIdx >= 0 && stepOverIdx < cartwheelLineIdx) {
    findings.push({
      rule_key: 'skill_cartwheel_hand_placement',
      severity: 'recommendation',
      message: 'Use hand-placement line drill before cartwheel step-over when hand order is inconsistent.',
      affected_items: [ordered[stepOverIdx].name],
      meta: { slug: 'cartwheel-step-over' },
    })
  }

  if (hurdleIdx >= 0 && cartwheelFinishIdx < 0 && (roundOffIdx >= 0 || stepOverIdx >= 0)) {
    const tumblingIdx = Math.min(
      roundOffIdx >= 0 ? roundOffIdx : Infinity,
      stepOverIdx >= 0 ? stepOverIdx : Infinity,
    )
    if (tumblingIdx < hurdleIdx) {
      findings.push({
        rule_key: 'skill_hurdle_entry_balance',
        severity: 'recommendation',
        message: 'Use Step-to-Lunge Freeze or Hurdle-to-Lunge Shape before adding cartwheel or round-off when hurdle entry is off-balance.',
        affected_items: [ordered[hurdleIdx].name],
        meta: { slug: 'hurdle-step-lunge' },
      })
    }
  }

  for (let i = 0; i < ordered.length; i++) {
    const { item, exerciseId, name, slug } = ordered[i]
    const dosage = dosageByExercise.get(String(exerciseId))
    const priorSlugs = new Set(ordered.slice(0, i).map((o) => o.slug))

    if (ROLL_SLUGS.has(slug) && !hasEquipment(exerciseId, 'mat', equipmentKeysByExercise, 3)) {
      findings.push({
        rule_key: slug === 'shoulder-roll-progression' ? 'skill_shoulder_roll_surface' : 'skill_roll_mat_required',
        severity: 'error',
        message:
          slug === 'shoulder-roll-progression'
            ? `${name}: safety roll progressions must be mastered on mat before harder surfaces.`
            : `${name}: rolling and tumbling foundations require a safe mat surface.`,
        affected_items: [name],
        meta: { slug },
      })
    }

    if (slug === 'forward-roll-progression') {
      const hasPrereq = [...FORWARD_ROLL_PREREQ_SLUGS].some((s) => priorSlugs.has(s))
      if (!hasPrereq) {
        findings.push({
          rule_key: 'skill_forward_roll_prerequisite',
          severity: 'warning',
          message: `${name}: regress to tuck rock, egg roll, or rock-and-roll to stand before forward roll progressions.`,
          affected_items: [name],
          meta: { slug },
        })
      }
    }

    if (slug === 'backward-roll-progression') {
      if (!hasAnyEquipment(exerciseId, BACKWARD_ROLL_PROGRESSION_EQUIP, equipmentKeysByExercise, 2)) {
        findings.push({
          rule_key: 'skill_backward_roll_progression',
          severity: 'warning',
          message: `${name}: backward roll requires progression support, correct hand placement, and arm push (wedge/panel mat or spotting).`,
          affected_items: [name],
          meta: { slug },
        })
      }
      if (hasNeckSymptoms) {
        findings.push({
          rule_key: 'skill_backward_roll_neck_stop',
          severity: 'error',
          message: `${name}: end backward roll attempts and regress immediately when head/neck loading or neck symptoms are present.`,
          affected_items: [name],
          meta: { slug, symptom_flags: true },
        })
      }
    }

    if (HANDSTAND_SKILL_SLUGS.has(slug)) {
      const workSeconds = Number(item.work_seconds ?? item.workSeconds ?? dosage?.default_work_seconds) || 0
      if (workSeconds > 20) {
        findings.push({
          rule_key: 'skill_handstand_endurance',
          severity: 'warning',
          message: `${name}: handstand hold (${workSeconds}s) may belong in Resilience — reduce hold time if the goal is skill quality.`,
          affected_items: [name],
          meta: { work_seconds: workSeconds, slug },
        })
      }
    }

    if (slug === 'donkey-kick') {
      const sets = Number(item.sets ?? dosage?.default_sets) || 1
      const reps = Number(item.reps ?? dosage?.default_reps) || 0
      const totalAttempts = sets * reps
      if (totalAttempts > 10) {
        findings.push({
          rule_key: 'skill_donkey_kick_volume',
          severity: 'warning',
          message: `${name}: ${totalAttempts} bunny hops may fatigue wrists/shoulders before tumbling — reduce reps or move conditioning elsewhere.`,
          affected_items: [name],
          meta: { total_attempts: totalAttempts, slug },
        })
      }
    }
  }

  return findings
}

const WALL_DRILL_SLUGS = new Set(['wall-drill-split-shin-hold', 'wall-drill-march', 'wall-drill-switch'])
const HIGH_INTENT_SPRINT_SKILL_SLUGS = new Set(['a-skip', 'straight-leg-bound-march'])
const TOE_DOWN_PATTERN = /toe\s*(point|drop)|plantarflex|toe\s*down|toes?\s*point/i
const BACKWARD_LEAN_PATTERN = /lean(ing)?\s*back|overstrid/i
const HIP_BEHIND_PATTERN = /hips?\s*(behind|sitting?\s*back|drop(ping)?\s*back)/i
const WAIST_HINGE_PATTERN = /hing(e|ing)\s*(at\s*)?(the\s*)?waist|fold\s*at\s*waist|bend\s*at\s*waist/i
const ARM_MIDLINE_PATTERN = /cross(ing)?\s*(the\s*)?midline|torso\s*rotat/i
const CALF_HIP_FATIGUE_PATTERN = /calf|achilles|hip\s*flexor|shin\s*pain/i
const TIMED_START_PATTERN = /timed|competitive|race|max\s*start|sprint\s*out/i
const SPEED_OUTPUT_SLUG_PATTERN = /sprint|acceleration|fly|start|speed|dash/i

function parseDistanceYards(item, dosage) {
  const raw = item.distance ?? item.default_distance ?? dosage?.default_distance ?? ''
  const match = String(raw).match(/(\d+)/)
  return match ? Number(match[1]) : 0
}

/** Recommend sprint-mechanics prep before Output speed work. Pure helper for tests. */
function analyzeSprintPrepBeforeOutput(blockMeta, slugByExercise) {
  let sawSprintMechanics = false
  for (const meta of blockMeta ?? []) {
    if (meta.phaseKey === MOVEMENT_INTELLIGENCE) {
      for (const item of meta.block?.items ?? []) {
        const slug = exerciseSlug(item, slugByExercise)
        if (SPRINT_MECHANICS_SKILL_SLUGS.has(slug ?? '')) sawSprintMechanics = true
      }
    }
    if (meta.phaseKey === 'output') {
      const hasSpeedOutput = (meta.block?.items ?? []).some((item) => {
        const slug = exerciseSlug(item, slugByExercise) ?? ''
        const name = String(item.exercise_name ?? item.exerciseName ?? '')
        return SPEED_OUTPUT_SLUG_PATTERN.test(slug) || SPEED_OUTPUT_SLUG_PATTERN.test(name)
      })
      if (hasSpeedOutput && !sawSprintMechanics) {
        return {
          rule_key: 'skill_sprint_missing_prep_before_output',
          severity: 'recommendation',
          message:
            'Speed Output is scheduled without prior Locomotion / Sprint Mechanics skill work — add A-March, wall march, ankling, or two-point walk-in before max-speed work.',
          affected_items: (meta.block?.items ?? [])
            .filter((item) => {
              const slug = exerciseSlug(item, slugByExercise) ?? ''
              const name = String(item.exercise_name ?? item.exerciseName ?? '')
              return SPEED_OUTPUT_SLUG_PATTERN.test(slug) || SPEED_OUTPUT_SLUG_PATTERN.test(name)
            })
            .map((item) => item.exercise_name ?? item.exerciseName ?? String(item.exercise_id ?? item.exerciseId)),
          meta: { output_block: true },
        }
      }
    }
  }
  return null
}

const DEPTH_PLYO_OUTPUT_SLUGS = new Set(['drop-landing-to-stick', 'depth-drop-to-rebound'])
const HURDLE_HOP_OUTPUT_SLUGS = new Set(['hurdle-hop-series-low-hurdles'])
const ADVANCED_PLYO_OUTPUT_SLUGS = new Set([...DEPTH_PLYO_OUTPUT_SLUGS, ...HURDLE_HOP_OUTPUT_SLUGS, 'single-leg-pogo-hold-to-hop'])
const REACTIVE_OUTPUT_MOVEMENT_SLUGS = new Set([
  'reactive-gate-sprint', 'mirror-shuffle-to-sprint-exit', 'ball-drop-sprint-catch',
  'power-hurdle-to-cartwheel-round-off-entry', 'round-off-rebound-snap-down-to-stick',
])
const PREPLANNED_COD_OUTPUT_SLUGS = new Set([
  'pro-agility-5-10-5-technical-rep', '90-degree-cut-drill', '180-degree-turn-shuttle-cut', 'curved-run-to-cut',
])
const DECEL_FOUNDATION_OUTPUT_SLUGS = new Set([
  'sprint-to-stick-deceleration', '5-yard-accel-to-decel-stick', 'lateral-bound-to-decel-stick',
])
const TUMBLING_OUTPUT_SLUGS = new Set([
  'power-hurdle-to-cartwheel-round-off-entry', 'round-off-rebound-snap-down-to-stick',
])
const ROUND_OFF_REBOUND_SLUG = 'round-off-rebound-snap-down-to-stick'
const TUMBLING_SKILL_PREREQ_SLUGS = new Set(['cartwheel', 'cartwheel-step-over', 'round-off', 'handstand-kick-up-wall', 'wall-walk-handstand-line'])

const MAX_VELOCITY_OUTPUT_SLUGS = new Set([
  'build-up-sprint-stride-out', 'flying-10', 'flying-20', 'sprint-float-sprint',
  'ins-and-outs', 'wicket-runs', 'mini-hurdle-sprint-rhythm', 'curved-sprint-arc-run',
])
const ADVANCED_MAX_VELOCITY_SLUGS = new Set([
  'flying-10', 'flying-20', 'sprint-float-sprint', 'ins-and-outs', 'wicket-runs',
])
const FLYING_SPRINT_OUTPUT_SLUGS = new Set(['flying-10', 'flying-20'])
const SPEED_CHANGE_OUTPUT_SLUGS = new Set(['sprint-float-sprint', 'ins-and-outs'])
const WICKET_RHYTHM_OUTPUT_SLUGS = new Set(['wicket-runs', 'mini-hurdle-sprint-rhythm'])
const BUILD_UP_SPRINT_SLUG = 'build-up-sprint-stride-out'
const FLYING_10_SLUG = 'flying-10'
const FLYING_20_SLUG = 'flying-20'
const MAX_VELOCITY_SYMPTOM_PATTERN = /hamstring|calf|achilles|shin|hip\s*pain|low\s*back|lumbar/i
const MAX_VELOCITY_FLOAT_CONFUSION_PATTERN = /cannot\s*(float|explain)|float\s*concept|doesn['']t\s*understand/i
const MAX_VELOCITY_QUALITY_DROP_PATTERN = /speed\s*drop|posture\s*drop|rhythm\s*drop|quality\s*drop|speed\s*declin/i
const MAX_VELOCITY_WICKET_CLIP_PATTERN = /clip(s|ping)?\s*(wicket|hurdle)|trips?\s*(wicket|hurdle)|clips?\s*more\s*than\s*twice/i
const MAX_VELOCITY_CURVE_UNSAFE_PATTERN = /slip(ping)?|curve\s*too\s*tight|unsafe\s*surface|drift\s*wide|cannot\s*stay\s*on\s*arc/i
const MAX_VELOCITY_CONSECUTIVE_PATTERN = /consecutive|back\s*to\s*back|yesterday|prior\s*day|hard\s*day\s*before/i
const FLY_SPRINT_MIN_REST_SECONDS = 120

function parseTotalDistanceYards(item, dosage) {
  const raw = String(item.distance ?? item.default_distance ?? dosage?.default_distance ?? '')
  const nums = [...raw.matchAll(/(\d+)/g)].map((m) => Number(m[1]))
  if (nums.length === 0) return 0
  if (raw.includes('+') || /sprint|float|zone/i.test(raw)) {
    return nums.reduce((sum, n) => sum + n, 0)
  }
  if (raw.includes('-') && nums.length >= 2) return Math.max(...nums)
  return Math.max(...nums)
}

/** Max-velocity Output cluster checks. Pure helper for tests. */
function analyzeOutputMaxVelocityReadiness(items, ctx) {
  const {
    slugByExercise,
    dosageByExercise,
    blockMeta = [],
    outputBlockIndex = 0,
    exerciseSkillLevelById = new Map(),
    draft = {},
  } = ctx

  const findings = []
  const watchText = draftWatchText(draft)
  const ordered = []

  for (const item of items ?? []) {
    const exerciseId = Number(item.exercise_id ?? item.exerciseId)
    if (!exerciseId) continue
    const name = item.exercise_name ?? item.exerciseName ?? String(exerciseId)
    const slug = exerciseSlug(item, slugByExercise)
    if (!slug || !MAX_VELOCITY_OUTPUT_SLUGS.has(slug)) continue
    ordered.push({ item, exerciseId, name, slug })
  }

  if (ordered.length === 0) return findings

  const slugsInBlock = new Set(ordered.map((o) => o.slug))
  const slugsInWorkout = new Set(slugsInBlock)
  for (const meta of blockMeta ?? []) {
    if (meta.phaseKey !== OUTPUT) continue
    for (const item of meta.block?.items ?? []) {
      const slug = exerciseSlug(item, slugByExercise)
      if (slug && MAX_VELOCITY_OUTPUT_SLUGS.has(slug)) slugsInWorkout.add(slug)
    }
  }

  for (let j = 0; j < outputBlockIndex; j++) {
    const priorKey = blockMeta[j]?.phaseKey
    if (priorKey === 'sustained_capacity') {
      findings.push({
        rule_key: 'output_max_velocity_after_fitness',
        severity: 'error',
        message: 'Max-velocity sprinting requires freshness — move before Sustained Capacity conditioning.',
        affected_items: ordered.map((o) => o.name),
        meta: { prior_phase: priorKey },
      })
    }
    if (priorKey === 'capacity') {
      findings.push({
        rule_key: 'output_max_velocity_after_capacity',
        severity: 'warning',
        message:
          'Hamstring, calf, Achilles, and sprint mechanics may be compromised after heavy lower-body Capacity or eccentric work.',
        affected_items: ordered.map((o) => o.name),
        meta: { prior_phase: priorKey },
      })
    }
  }

  const isBeginnerAthlete = ordered.some(({ exerciseId }) => {
    const level = String(exerciseSkillLevelById.get(String(exerciseId)) ?? '').toUpperCase()
    return level === 'EARLY_STAGE' || level === 'BEGINNER'
  })

  if (
    isBeginnerAthlete
    && [...ADVANCED_MAX_VELOCITY_SLUGS].some((slug) => slugsInBlock.has(slug))
    && !slugsInBlock.has(BUILD_UP_SPRINT_SLUG)
  ) {
    findings.push({
      rule_key: 'output_max_velocity_beginner_advanced',
      severity: 'recommendation',
      message: 'Use Build-Up Sprint / Stride-Out first before Flying 10, Flying 20, speed-change, or wicket max-velocity work.',
      affected_items: ordered.filter((o) => ADVANCED_MAX_VELOCITY_SLUGS.has(o.slug)).map((o) => o.name),
      meta: { beginner: true },
    })
  }

  if (slugsInBlock.has(FLYING_20_SLUG) && !slugsInWorkout.has(FLYING_10_SLUG)) {
    findings.push({
      rule_key: 'output_max_velocity_flying20_prerequisite',
      severity: 'warning',
      message: 'Flying 20 is a longer max-velocity exposure — use Flying 10 first or confirm prior competency.',
      affected_items: ordered.filter((o) => o.slug === FLYING_20_SLUG).map((o) => o.name),
      meta: { missing_prereq: FLYING_10_SLUG },
    })
  }

  if (MAX_VELOCITY_SYMPTOM_PATTERN.test(watchText)) {
    findings.push({
      rule_key: 'output_max_velocity_tissue_warning',
      severity: 'recommendation',
      message:
        'Hamstring, calf, Achilles, shin, hip, or low-back warning signs — substitute Build-Up at lower intensity, sprint mechanics drills, or skip max-velocity exposure today.',
      affected_items: ordered.map((o) => o.name),
      meta: { symptom_flags: true },
    })
  }

  if (MAX_VELOCITY_QUALITY_DROP_PATTERN.test(watchText)) {
    findings.push({
      rule_key: 'output_max_velocity_quality_stop',
      severity: 'warning',
      message: 'Speed, posture, or rhythm is dropping — end max-velocity exposure or increase rest before continuing.',
      affected_items: ordered.map((o) => o.name),
      meta: { symptom_flags: true },
    })
  }

  if (MAX_VELOCITY_CONSECUTIVE_PATTERN.test(watchText)) {
    findings.push({
      rule_key: 'output_max_velocity_consecutive_days',
      severity: 'warning',
      message:
        'High-speed sprinting generally needs substantial recovery — consider spacing hard max-velocity exposures by 48–72+ hours.',
      affected_items: ordered.map((o) => o.name),
      meta: { symptom_flags: true },
    })
  }

  for (const { item, exerciseId, name, slug } of ordered) {
    const dosage = dosageByExercise.get(String(exerciseId))
    const restSeconds = Number(item.rest_seconds ?? item.restSeconds ?? dosage?.default_rest_seconds) || 0

    if (FLYING_SPRINT_OUTPUT_SLUGS.has(slug) && restSeconds > 0 && restSeconds < FLY_SPRINT_MIN_REST_SECONDS) {
      findings.push({
        rule_key: 'output_max_velocity_short_rest',
        severity: 'warning',
        message: `${name}: rest (${restSeconds}s) is likely too short for true max-velocity Output — increase rest or classify as Sustained Capacity.`,
        affected_items: [name],
        meta: { rest_seconds: restSeconds, slug },
      })
    }

    if (SPEED_CHANGE_OUTPUT_SLUGS.has(slug)) {
      const totalYards = parseTotalDistanceYards(item, dosage)
      if (totalYards > 80) {
        findings.push({
          rule_key: 'output_max_velocity_speed_endurance',
          severity: 'warning',
          message: `${name}: ${totalYards} yards/meters total may shift toward speed endurance — confirm intent and recovery.`,
          affected_items: [name],
          meta: { total_yards: totalYards, slug },
        })
      }
      if (MAX_VELOCITY_FLOAT_CONFUSION_PATTERN.test(watchText)) {
        findings.push({
          rule_key: 'output_max_velocity_float_confusion',
          severity: 'recommendation',
          message: `${name}: athlete cannot perform the float concept — use Build-Up Sprint or Flying 10 instead.`,
          affected_items: [name],
          meta: { slug, symptom_flags: true },
        })
      }
    }

    if (WICKET_RHYTHM_OUTPUT_SLUGS.has(slug)) {
      findings.push({
        rule_key: 'output_max_velocity_wicket_spacing',
        severity: 'recommendation',
        message: `${name}: confirm wicket/hurdle spacing matches athlete size and speed, athlete runs tall without jumping, and contacts stay clean.`,
        affected_items: [name],
        meta: { slug },
      })
      if (MAX_VELOCITY_WICKET_CLIP_PATTERN.test(watchText)) {
        findings.push({
          rule_key: 'output_max_velocity_wicket_clips',
          severity: 'warning',
          message: `${name}: repeated wicket/hurdle clips — reduce speed, adjust spacing, or regress to lower markers.`,
          affected_items: [name],
          meta: { slug, symptom_flags: true },
        })
      }
    }

    if (slug === 'curved-sprint-arc-run') {
      findings.push({
        rule_key: 'output_max_velocity_curve_safety',
        severity: 'recommendation',
        message: `${name}: confirm safe surface, lane is clear, curve radius is not too tight, and a deceleration zone exists.`,
        affected_items: [name],
        meta: { slug },
      })
      if (MAX_VELOCITY_CURVE_UNSAFE_PATTERN.test(watchText)) {
        findings.push({
          rule_key: 'output_max_velocity_curve_unsafe',
          severity: 'warning',
          message: `${name}: curve control or surface safety is compromised — widen radius, reduce speed, or stop curved sprinting.`,
          affected_items: [name],
          meta: { slug, symptom_flags: true },
        })
      }
    }
  }

  return findings
}

const ELASTIC_OUTPUT_SLUGS = new Set([
  'fast-low-pogos', 'forward-backward-pogos', 'lateral-line-hops', 'single-leg-pogo-hold-to-hop',
  'snap-down-to-stick', 'snap-down-to-rebound', 'drop-landing-to-stick', 'depth-drop-to-rebound',
  'hurdle-hop-series-low-hurdles',
])
const POGO_ELASTIC_SLUGS = new Set(['fast-low-pogos', 'forward-backward-pogos'])
const BILATERAL_POGO_SLUGS = new Set(['fast-low-pogos', 'forward-backward-pogos'])
const SNAP_DOWN_STICK_SLUG = 'snap-down-to-stick'
const SNAP_DOWN_REBOUND_SLUG = 'snap-down-to-rebound'
const DROP_LANDING_SLUG = 'drop-landing-to-stick'
const DEPTH_REBOUND_SLUG = 'depth-drop-to-rebound'
const SINGLE_LEG_POGO_SLUG = 'single-leg-pogo-hold-to-hop'
const LATERAL_LINE_HOPS_SLUG = 'lateral-line-hops'
const HURDLE_HOP_ELASTIC_SLUG = 'hurdle-hop-series-low-hurdles'
const SINGLE_LEG_BALANCE_SKILL_SLUGS = new Set([
  'single-leg-balance-clock', 'foot-tripod-weight-shifts', 'beam-walk', 'cross-crawl-march',
])
const ELASTIC_SYMPTOM_PATTERN = /achilles|calf|shin|heel|knee|hip|low\s*back|lumbar/i
const ELASTIC_LOUD_SLOW_PATTERN = /loud|slow\s*contact|contacts?\s*(get|are|become)\s*(loud|slow)|rhythm\s*slow/i
const ELASTIC_KNEE_VALGUS_PATTERN = /knee\s*collapse|valgus|knees?\s*cav(e|ing)/i
const ELASTIC_HURDLE_CLIP_PATTERN = /clip(s|ping)?\s*hurdle|clips?\s*hurdles|clips?\s*repeatedly/i
const ELASTIC_LANDING_FAIL_PATTERN = /landing\s*(fail|poor|quality\s*fail)|cannot\s*stick|landing\s*twice/i
const ELASTIC_HIGH_BOX_PATTERN = /box\s*too\s*high|height\s*too\s*high|drop\s*too\s*high/i
const ELASTIC_CONTACT_LIMIT_BEGINNER = 60
const ELASTIC_CONTACT_LIMIT_DEFAULT = 80
const ELASTIC_SHORT_REST_SECONDS = 30

function countElasticVolume(item, dosage) {
  const sets = Number(item.sets ?? dosage?.default_sets) || 1
  const reps = Number(item.reps ?? item.contacts ?? dosage?.default_reps) || 1
  return sets * reps
}

/** Elastic stiffness / plyometric rudiments cluster checks. Pure helper for tests. */
function analyzeOutputElasticReadiness(items, ctx) {
  const {
    slugByExercise,
    dosageByExercise,
    blockMeta = [],
    outputBlockIndex = 0,
    exerciseSkillLevelById = new Map(),
    skillSlugsInWorkout = new Set(),
    draft = {},
  } = ctx

  const findings = []
  const watchText = draftWatchText(draft)
  const ordered = []

  for (const item of items ?? []) {
    const exerciseId = Number(item.exercise_id ?? item.exerciseId)
    if (!exerciseId) continue
    const name = item.exercise_name ?? item.exerciseName ?? String(exerciseId)
    const slug = exerciseSlug(item, slugByExercise)
    if (!slug || !ELASTIC_OUTPUT_SLUGS.has(slug)) continue
    ordered.push({ item, exerciseId, name, slug })
  }

  if (ordered.length === 0) return findings

  const slugsInBlock = new Set(ordered.map((o) => o.slug))
  const slugsInWorkout = new Set(slugsInBlock)
  for (const meta of blockMeta ?? []) {
    if (meta.phaseKey !== OUTPUT) continue
    for (const item of meta.block?.items ?? []) {
      const slug = exerciseSlug(item, slugByExercise)
      if (slug && ELASTIC_OUTPUT_SLUGS.has(slug)) slugsInWorkout.add(slug)
    }
  }

  for (let j = 0; j < outputBlockIndex; j++) {
    const priorKey = blockMeta[j]?.phaseKey
    if (priorKey === 'sustained_capacity') {
      findings.push({
        rule_key: 'output_elastic_after_fitness',
        severity: 'error',
        message: 'Elastic Output requires freshness — move before Sustained Capacity conditioning.',
        affected_items: ordered.map((o) => o.name),
        meta: { prior_phase: priorKey },
      })
    }
    if (priorKey === 'capacity') {
      findings.push({
        rule_key: 'output_elastic_after_capacity',
        severity: 'warning',
        message:
          'Lower-leg stiffness, landing quality, and tendon tolerance may be compromised after heavy lower-body Capacity or eccentric work.',
        affected_items: ordered.map((o) => o.name),
        meta: { prior_phase: priorKey },
      })
    }
  }

  let totalContacts = 0
  let hasHighContactShortRest = false
  for (const { item, exerciseId, name, slug } of ordered) {
    const dosage = dosageByExercise.get(String(exerciseId))
    const volume = countElasticVolume(item, dosage)
    const restSeconds = Number(item.rest_seconds ?? item.restSeconds ?? dosage?.default_rest_seconds) || 0
    const unit = String(dosage?.volume_unit ?? item.volume_unit ?? '')

    if (unit === 'contacts' || slug.includes('pogo') || slug.includes('hop')) {
      totalContacts += volume
    }

    if ((unit === 'contacts' || POGO_ELASTIC_SLUGS.has(slug)) && restSeconds > 0 && restSeconds < ELASTIC_SHORT_REST_SECONDS && volume >= 10) {
      hasHighContactShortRest = true
    }

    if (POGO_ELASTIC_SLUGS.has(slug) && ELASTIC_LOUD_SLOW_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'output_elastic_pogo_quality_stop',
        severity: 'warning',
        message: `${name}: contacts are loud or slow — end the set. Elastic quality has dropped.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === LATERAL_LINE_HOPS_SLUG && ELASTIC_KNEE_VALGUS_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'output_elastic_lateral_knee_valgus',
        severity: 'recommendation',
        message: `${name}: knee collapse on lateral hops — regress to lateral step, lunge shift, or mini-band lateral walk.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === SINGLE_LEG_POGO_SLUG) {
      const hasBilateralPogo = [...BILATERAL_POGO_SLUGS].some((s) => slugsInWorkout.has(s))
      const hasBalanceSkill = [...SINGLE_LEG_BALANCE_SKILL_SLUGS].some((s) => skillSlugsInWorkout.has(s))
      if (!hasBilateralPogo || !hasBalanceSkill) {
        findings.push({
          rule_key: 'output_elastic_single_leg_prerequisite',
          severity: 'warning',
          message: `${name}: single-leg elastic work requires bilateral pogo competency and single-leg balance skill earlier in the session.`,
          affected_items: [name],
          meta: { missing_bilateral_pogo: !hasBilateralPogo, missing_balance_skill: !hasBalanceSkill, slug },
        })
      }
    }

    if (slug === SNAP_DOWN_REBOUND_SLUG && !slugsInWorkout.has(SNAP_DOWN_STICK_SLUG)) {
      findings.push({
        rule_key: 'output_elastic_snap_rebound_prerequisite',
        severity: 'error',
        message: `${name}: rebound requires Snap-Down to Stick landing-stick competency first.`,
        affected_items: [name],
        meta: { missing_prereq: SNAP_DOWN_STICK_SLUG, slug },
      })
    }

    if (slug === DROP_LANDING_SLUG && ELASTIC_HIGH_BOX_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'output_elastic_drop_box_height',
        severity: 'warning',
        message: `${name}: lower the box — landing quality matters more than drop height.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === DEPTH_REBOUND_SLUG) {
      const isBeginner = ordered.some(({ exerciseId: eid }) => {
        const level = String(exerciseSkillLevelById.get(String(eid)) ?? '').toUpperCase()
        return level === 'EARLY_STAGE' || level === 'BEGINNER'
      })
      if (isBeginner) {
        findings.push({
          rule_key: 'output_elastic_depth_rebound_beginner',
          severity: 'warning',
          message: `${name}: depth rebound is advanced — use snap-downs and drop landings first.`,
          affected_items: [name],
          meta: { beginner: true, slug },
        })
      }
    }

    if (slug === HURDLE_HOP_ELASTIC_SLUG && ELASTIC_HURDLE_CLIP_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'output_elastic_hurdle_clips',
        severity: 'warning',
        message: `${name}: repeated hurdle clips — lower hurdle height, reduce speed, or regress to line hops.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }
  }

  const contactLimit = ordered.some(({ exerciseId }) => {
    const level = String(exerciseSkillLevelById.get(String(exerciseId)) ?? '').toUpperCase()
    return level === 'EARLY_STAGE' || level === 'BEGINNER'
  })
    ? ELASTIC_CONTACT_LIMIT_BEGINNER
    : ELASTIC_CONTACT_LIMIT_DEFAULT

  if (totalContacts > contactLimit) {
    findings.push({
      rule_key: 'output_elastic_contact_volume',
      severity: 'warning',
      message: `Elastic block contacts (~${totalContacts}) exceed recommended limit (~${contactLimit}) — reduce contacts or split across sessions.`,
      affected_items: ordered.filter(({ slug }) => slug.includes('pogo') || slug.includes('hop')).map((o) => o.name),
      meta: { total_contacts: totalContacts, contact_limit: contactLimit },
    })
  }

  if (hasHighContactShortRest) {
    findings.push({
      rule_key: 'output_elastic_short_rest',
      severity: 'warning',
      message: 'High contact volume with short rest is drifting toward Sustained Capacity — increase rest or reduce contacts.',
      affected_items: ordered.map((o) => o.name),
      meta: {},
    })
  }

  if (ELASTIC_SYMPTOM_PATTERN.test(watchText)) {
    findings.push({
      rule_key: 'output_elastic_tissue_warning',
      severity: 'recommendation',
      message:
        'Achilles, calf, shin, knee, hip, or back warning signs — substitute marching/calf raises, lateral step, single-leg balance hold, snap-down stick only, low step-down, or low hurdle step-over.',
      affected_items: ordered.map((o) => o.name),
      meta: { symptom_flags: true },
    })
  }

  if (ELASTIC_LANDING_FAIL_PATTERN.test(watchText)) {
    findings.push({
      rule_key: 'output_elastic_landing_quality_stop',
      severity: 'warning',
      message: 'Landing quality has failed — end elastic Output for that drill and regress to landing mechanics.',
      affected_items: ordered.filter(({ slug }) =>
        slug === SNAP_DOWN_REBOUND_SLUG || slug === DROP_LANDING_SLUG || slug === DEPTH_REBOUND_SLUG || slug === HURDLE_HOP_ELASTIC_SLUG,
      ).map((o) => o.name),
      meta: { symptom_flags: true },
    })
  }

  return findings
}

const JUMP_POWER_OUTPUT_SLUGS = new Set([
  'countermovement-vertical-jump',
  'squat-jump',
  'broad-jump-to-stick',
  'single-broad-jump-to-rebound',
  'lateral-bound-to-stick',
  'skater-bound-continuous',
  'split-jump-scissor-jump',
  'medicine-ball-chest-pass',
  'medicine-ball-overhead-slam',
  'medicine-ball-rotational-scoop-toss',
  'medicine-ball-shot-put-throw',
])
const CMJ_SLUG = 'countermovement-vertical-jump'
const SQUAT_JUMP_SLUG = 'squat-jump'
const BROAD_JUMP_STICK_SLUG = 'broad-jump-to-stick'
const BROAD_JUMP_REBOUND_SLUG = 'single-broad-jump-to-rebound'
const LATERAL_BOUND_STICK_SLUG = 'lateral-bound-to-stick'
const SKATER_BOUND_SLUG = 'skater-bound-continuous'
const SPLIT_JUMP_SLUG = 'split-jump-scissor-jump'
const OVERHEAD_SLAM_SLUG = 'medicine-ball-overhead-slam'
const MED_BALL_JUMP_POWER_SLUGS = new Set([
  'medicine-ball-chest-pass',
  'medicine-ball-overhead-slam',
  'medicine-ball-rotational-scoop-toss',
  'medicine-ball-shot-put-throw',
])
const ROTATIONAL_MED_BALL_SLUGS = new Set([
  'medicine-ball-rotational-scoop-toss',
  'medicine-ball-shot-put-throw',
])
const CMJ_MAX_JUMPS = 15
const JUMP_POWER_QUALITY_DROP_PATTERN =
  /height\s*drop|distance\s*drop|velocity\s*drop|throw\s*speed\s*drop|jump\s*height\s*drop|jump\s*distance\s*drop|power\s*quality\s*drop|quality\s*drop/i
const JUMP_LANDING_FAULT_PATTERN =
  /knee\s*valgus|valgus|knees?\s*cav(e|ing)|loud\s*land|extra\s*step|balance\s*loss|cannot\s*stick/i
const SQUAT_JUMP_DIP_PATTERN = /dip(s)?\s*again|bounce(s)?\s*before|countermovement\s*before/i
const BROAD_JUMP_STICK_FAIL_PATTERN = /cannot\s*stick|stick\s*fail|extra\s*step|landing\s*uncontrolled/i
const JUMP_POWER_LATERAL_KNEE_PATTERN = /knee\s*collapse|valgus|knees?\s*cav(e|ing)/i
const SPLIT_LANDING_FAIL_PATTERN = /cannot\s*land.*split|split\s*stance\s*fail|landing\s*instability/i
const MED_BALL_SLOW_PATTERN = /ball\s*too\s*heavy|throw\s*slow|slow\s*throw|heavy\s*ball/i
const SLAM_RIB_FLARE_PATTERN = /rib\s*flare|low\s*back\s*ext(en(sion)?)?|lumbar\s*ext/i
const ROTATIONAL_LOW_BACK_PATTERN = /low\s*back\s*pain|lumbar\s*pain|back\s*pain.*rotat/i
const UNSAFE_THROW_AREA_PATTERN =
  /unsafe\s*(wall|throw|area|lane|rebound)|no\s*safe\s*(wall|partner|throw)|rebound\s*unsafe/i
const YOUTH_ATHLETE_PATTERN = /youth|kids?|child|teen\s*beginner/i

function countJumpPowerVolume(item, dosage) {
  const sets = Number(item.sets ?? dosage?.default_sets) || 1
  const reps = Number(item.reps ?? dosage?.default_reps) || 1
  return sets * reps
}

/** Jump, Throw & Explosive Power Output cluster checks. Pure helper for tests. */
function analyzeOutputJumpPowerReadiness(items, ctx) {
  const {
    slugByExercise,
    dosageByExercise,
    blockMeta = [],
    outputBlockIndex = 0,
    exerciseSkillLevelById = new Map(),
    draft = {},
  } = ctx

  const findings = []
  const watchText = draftWatchText(draft)
  const ordered = []

  for (const item of items ?? []) {
    const exerciseId = Number(item.exercise_id ?? item.exerciseId)
    if (!exerciseId) continue
    const name = item.exercise_name ?? item.exerciseName ?? String(exerciseId)
    const slug = exerciseSlug(item, slugByExercise)
    if (!slug || !JUMP_POWER_OUTPUT_SLUGS.has(slug)) continue
    ordered.push({ item, exerciseId, name, slug })
  }

  if (ordered.length === 0) return findings

  const slugsInBlock = new Set(ordered.map((o) => o.slug))
  const slugsInWorkout = new Set(slugsInBlock)
  for (const meta of blockMeta ?? []) {
    if (meta.phaseKey !== OUTPUT) continue
    for (const item of meta.block?.items ?? []) {
      const slug = exerciseSlug(item, slugByExercise)
      if (slug && JUMP_POWER_OUTPUT_SLUGS.has(slug)) slugsInWorkout.add(slug)
    }
  }

  for (let j = 0; j < outputBlockIndex; j++) {
    const priorKey = blockMeta[j]?.phaseKey
    if (priorKey === 'sustained_capacity') {
      findings.push({
        rule_key: 'output_jump_power_after_fitness',
        severity: 'warning',
        message: 'Power output is fatigue-sensitive. Move before conditioning.',
        affected_items: ordered.map((o) => o.name),
        meta: { prior_phase: priorKey },
      })
    }
    if (priorKey === 'capacity') {
      findings.push({
        rule_key: 'output_jump_power_after_capacity',
        severity: 'warning',
        message:
          'Lower-body fatigue may reduce jump height, distance, and landing quality — move jump/throw Output earlier in the session.',
        affected_items: ordered.map((o) => o.name),
        meta: { prior_phase: priorKey },
      })
    }
  }

  if (JUMP_POWER_QUALITY_DROP_PATTERN.test(watchText)) {
    findings.push({
      rule_key: 'output_jump_power_quality_stop',
      severity: 'warning',
      message: 'End set or increase rest. Power quality has dropped.',
      affected_items: ordered.map((o) => o.name),
      meta: { symptom_flags: true },
    })
  }

  const jumpItems = ordered.filter(({ slug }) => !MED_BALL_JUMP_POWER_SLUGS.has(slug))
  if (jumpItems.length > 0 && JUMP_LANDING_FAULT_PATTERN.test(watchText)) {
    findings.push({
      rule_key: 'output_jump_power_landing_regress',
      severity: 'recommendation',
      message: 'Regress to Snap-Down to Stick, Drop Landing to Stick, or lower jump intensity.',
      affected_items: jumpItems.map((o) => o.name),
      meta: { symptom_flags: true },
    })
  }

  for (const { item, exerciseId, name, slug } of ordered) {
    const dosage = dosageByExercise.get(String(exerciseId))
    const volume = countJumpPowerVolume(item, dosage)

    if (slug === CMJ_SLUG && volume > CMJ_MAX_JUMPS) {
      findings.push({
        rule_key: 'output_jump_power_cmj_volume',
        severity: 'warning',
        message: 'High jump volume may shift toward fatigue. Reduce reps or split across sessions.',
        affected_items: [name],
        meta: { total_jumps: volume, jump_limit: CMJ_MAX_JUMPS, slug },
      })
    }

    if (slug === SQUAT_JUMP_SLUG && SQUAT_JUMP_DIP_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'output_jump_power_squat_jump_dip',
        severity: 'warning',
        message: 'This is no longer a squat jump. Add a clear pause or classify as countermovement jump.',
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === BROAD_JUMP_STICK_SLUG && BROAD_JUMP_STICK_FAIL_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'output_jump_power_broad_stick_fail',
        severity: 'warning',
        message: 'Do not progress to Broad Jump Rebound or COD power until horizontal landing is controlled.',
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }
  }

  if (slugsInBlock.has(BROAD_JUMP_REBOUND_SLUG) && !slugsInWorkout.has(BROAD_JUMP_STICK_SLUG)) {
    findings.push({
      rule_key: 'output_jump_power_broad_rebound_prerequisite',
      severity: 'error',
      message: 'Rebound requires horizontal landing competency.',
      affected_items: ordered.filter((o) => o.slug === BROAD_JUMP_REBOUND_SLUG).map((o) => o.name),
      meta: { slug: BROAD_JUMP_REBOUND_SLUG },
    })
  }

  if (slugsInBlock.has(LATERAL_BOUND_STICK_SLUG) && JUMP_POWER_LATERAL_KNEE_PATTERN.test(watchText)) {
    findings.push({
      rule_key: 'output_jump_power_lateral_knee_regress',
      severity: 'recommendation',
      message: 'Regress to lateral line hops, lateral lunge shift, or single-leg balance reach.',
      affected_items: ordered.filter((o) => o.slug === LATERAL_BOUND_STICK_SLUG).map((o) => o.name),
      meta: { slug: LATERAL_BOUND_STICK_SLUG, symptom_flags: true },
    })
  }

  if (slugsInBlock.has(SKATER_BOUND_SLUG) && !slugsInWorkout.has(LATERAL_BOUND_STICK_SLUG)) {
    findings.push({
      rule_key: 'output_jump_power_skater_prerequisite',
      severity: 'warning',
      message: 'Continuous lateral bounds require stick competency first.',
      affected_items: ordered.filter((o) => o.slug === SKATER_BOUND_SLUG).map((o) => o.name),
      meta: { slug: SKATER_BOUND_SLUG },
    })
  }

  if (slugsInBlock.has(SPLIT_JUMP_SLUG) && SPLIT_LANDING_FAIL_PATTERN.test(watchText)) {
    findings.push({
      rule_key: 'output_jump_power_split_landing_regress',
      severity: 'recommendation',
      message: 'Use split squat, split squat jump low depth, or lunge-to-stick first.',
      affected_items: ordered.filter((o) => o.slug === SPLIT_JUMP_SLUG).map((o) => o.name),
      meta: { slug: SPLIT_JUMP_SLUG, symptom_flags: true },
    })
  }

  const medBallItems = ordered.filter(({ slug }) => MED_BALL_JUMP_POWER_SLUGS.has(slug))
  if (medBallItems.length > 0 && MED_BALL_SLOW_PATTERN.test(watchText)) {
    findings.push({
      rule_key: 'output_jump_power_med_ball_slow',
      severity: 'warning',
      message: 'This is no longer Output. Use a lighter ball or classify as Capacity.',
      affected_items: medBallItems.map((o) => o.name),
      meta: { symptom_flags: true },
    })
  }

  if (slugsInBlock.has(OVERHEAD_SLAM_SLUG) && SLAM_RIB_FLARE_PATTERN.test(watchText)) {
    findings.push({
      rule_key: 'output_jump_power_slam_rib_flare',
      severity: 'recommendation',
      message: 'Reduce load, reduce overhead range, or use chest pass.',
      affected_items: ordered.filter((o) => o.slug === OVERHEAD_SLAM_SLUG).map((o) => o.name),
      meta: { slug: OVERHEAD_SLAM_SLUG, symptom_flags: true },
    })
  }

  const rotMedBallItems = ordered.filter(({ slug }) => ROTATIONAL_MED_BALL_SLUGS.has(slug))
  if (rotMedBallItems.length > 0 && ROTATIONAL_LOW_BACK_PATTERN.test(watchText)) {
    findings.push({
      rule_key: 'output_jump_power_rotational_low_back_stop',
      severity: 'warning',
      message: 'Stop rotational throws and regress to anti-rotation, half-kneeling, or thoracic/hip prep.',
      affected_items: rotMedBallItems.map((o) => o.name),
      meta: { symptom_flags: true },
    })
  }

  if (medBallItems.length > 0 && UNSAFE_THROW_AREA_PATTERN.test(watchText)) {
    findings.push({
      rule_key: 'output_jump_power_unsafe_throw_area',
      severity: 'error',
      message: 'Medicine ball throws require safe wall, partner, lane, and rebound control.',
      affected_items: medBallItems.map((o) => o.name),
      meta: { symptom_flags: true },
    })
  }

  const isYouthAthlete = ordered.some(({ exerciseId }) => {
    const level = String(exerciseSkillLevelById.get(String(exerciseId)) ?? '').toUpperCase()
    return level === 'EARLY_STAGE' || level === 'BEGINNER'
  })
  if (medBallItems.length > 0 && (isYouthAthlete || YOUTH_ATHLETE_PATTERN.test(watchText))) {
    findings.push({
      rule_key: 'output_jump_power_youth_med_ball_confirm',
      severity: 'recommendation',
      message:
        'Youth medicine-ball throws require coach confirmation: light ball, low reps, clear throw area, and speed/coordination emphasis — not max load.',
      affected_items: medBallItems.map((o) => o.name),
      meta: { youth_flags: true },
    })
  }

  return findings
}

const DECEL_COD_OUTPUT_SLUGS = new Set([
  'sprint-to-stick-deceleration', '5-yard-accel-to-decel-stick', 'lateral-bound-to-decel-stick',
  'pro-agility-5-10-5-technical-rep', '90-degree-cut-drill', '180-degree-turn-shuttle-cut', 'curved-run-to-cut',
])
const LINEAR_DECEL_OUTPUT_SLUGS = new Set(['sprint-to-stick-deceleration', '5-yard-accel-to-decel-stick'])
const SPRINT_TO_STICK_SLUG = 'sprint-to-stick-deceleration'
const FIVE_YARD_DECEL_SLUG = '5-yard-accel-to-decel-stick'
const LATERAL_BOUND_DECEL_SLUG = 'lateral-bound-to-decel-stick'
const PRO_AGILITY_SLUG = 'pro-agility-5-10-5-technical-rep'
const NINETY_CUT_SLUG = '90-degree-cut-drill'
const ONE_EIGHTY_TURN_SLUG = '180-degree-turn-shuttle-cut'
const CURVED_RUN_TO_CUT_SLUG = 'curved-run-to-cut'
const COD_POWER_ADVANCED_SLUGS = new Set([
  PRO_AGILITY_SLUG, NINETY_CUT_SLUG, ONE_EIGHTY_TURN_SLUG, CURVED_RUN_TO_CUT_SLUG,
])
const PRO_AGILITY_MIN_REST_SECONDS = 120
const DECEL_COD_SYMPTOM_PATTERN = /knee|ankle|hip|back\s*pain|plant\s*slip|heel\s*pain/i
const DECEL_EXTRA_STEPS_PATTERN = /extra\s*step|uncontrolled\s*stop|stutter\s*step|cannot\s*stick/i
const DECEL_KNEE_VALGUS_PATTERN = /knee\s*collapse|valgus|knees?\s*cav(e|ing)/i
const DECEL_PLANT_DROP_PATTERN = /plant\s*quality|poor\s*plant|plant\s*drops|plant\s*deteriorat/i
const DECEL_REACTIVE_MISLABEL_PATTERN = /reactive\s*agility|true\s*agility|reactive\s*cod/i
const DECEL_UNSAFE_SURFACE_PATTERN = /slip(ping)?|unsafe\s*surface|poor\s*traction|plant\s*foot\s*slip/i
const DECEL_CURVE_UNSAFE_PATTERN = /curve\s*too\s*tight|cannot\s*hold\s*curve|drift\s*wide|cannot\s*run\s*curve/i
const DECEL_ANGLE_VELOCITY_PATTERN = /sharp\s*angle|high\s*speed.*cut|max\s*speed.*90|max\s*speed.*180/i
const DECEL_EXIT_FAIL_PATTERN = /cannot\s*decelerate|no\s*decel|cannot\s*stop\s*after/i

/** Deceleration / COD Power Output cluster checks. Pure helper for tests. */
function analyzeOutputDecelCodReadiness(items, ctx) {
  const {
    slugByExercise,
    dosageByExercise,
    blockMeta = [],
    outputBlockIndex = 0,
    exerciseSkillLevelById = new Map(),
    draft = {},
  } = ctx

  const findings = []
  const watchText = draftWatchText(draft)
  const ordered = []

  for (const item of items ?? []) {
    const exerciseId = Number(item.exercise_id ?? item.exerciseId)
    if (!exerciseId) continue
    const name = item.exercise_name ?? item.exerciseName ?? String(exerciseId)
    const slug = exerciseSlug(item, slugByExercise)
    if (!slug || !DECEL_COD_OUTPUT_SLUGS.has(slug)) continue
    ordered.push({ item, exerciseId, name, slug })
  }

  if (ordered.length === 0) return findings

  const slugsInBlock = new Set(ordered.map((o) => o.slug))
  const slugsInWorkout = new Set(slugsInBlock)
  for (const meta of blockMeta ?? []) {
    if (meta.phaseKey !== OUTPUT) continue
    for (const item of meta.block?.items ?? []) {
      const slug = exerciseSlug(item, slugByExercise)
      if (slug && DECEL_COD_OUTPUT_SLUGS.has(slug)) slugsInWorkout.add(slug)
    }
  }

  const hasLinearDecelFoundation = [...LINEAR_DECEL_OUTPUT_SLUGS].some((s) => slugsInWorkout.has(s))
  const hasCodPower = [...COD_POWER_ADVANCED_SLUGS].some((s) => slugsInBlock.has(s))

  for (let j = 0; j < outputBlockIndex; j++) {
    const priorKey = blockMeta[j]?.phaseKey
    if (priorKey === 'sustained_capacity') {
      findings.push({
        rule_key: 'output_decel_cod_after_fitness',
        severity: 'warning',
        message: 'COD Output requires freshness — move before Sustained Capacity conditioning.',
        affected_items: ordered.map((o) => o.name),
        meta: { prior_phase: priorKey },
      })
    }
    if (priorKey === 'capacity') {
      findings.push({
        rule_key: 'output_decel_cod_after_capacity',
        severity: 'warning',
        message:
          'Braking and plant quality may be compromised after heavy lower-body strength, eccentrics, or high plyometric volume.',
        affected_items: ordered.map((o) => o.name),
        meta: { prior_phase: priorKey },
      })
    }
  }

  if (hasCodPower && !slugsInWorkout.has(SPRINT_TO_STICK_SLUG)) {
    findings.push({
      rule_key: 'output_decel_cod_linear_prerequisite',
      severity: 'error',
      message: 'Do not progress to COD power until linear Sprint to Stick deceleration is controlled.',
      affected_items: ordered.filter((o) => COD_POWER_ADVANCED_SLUGS.has(o.slug)).map((o) => o.name),
      meta: { missing_prereq: SPRINT_TO_STICK_SLUG },
    })
  }

  if (DECEL_COD_SYMPTOM_PATTERN.test(watchText)) {
    findings.push({
      rule_key: 'output_decel_cod_tissue_warning',
      severity: 'recommendation',
      message: 'Knee, ankle, hip, or back warning signs — end COD Output and regress to lower-speed mechanics or Resilience.',
      affected_items: ordered.map((o) => o.name),
      meta: { symptom_flags: true },
    })
  }

  if (DECEL_PLANT_DROP_PATTERN.test(watchText)) {
    findings.push({
      rule_key: 'output_decel_cod_plant_quality_stop',
      severity: 'warning',
      message: 'Plant quality is dropping — end COD reps or increase rest. Do not practice poor plants.',
      affected_items: ordered.map((o) => o.name),
      meta: { symptom_flags: true },
    })
  }

  if (DECEL_UNSAFE_SURFACE_PATTERN.test(watchText)) {
    findings.push({
      rule_key: 'output_decel_cod_unsafe_surface',
      severity: 'error',
      message: 'Do not perform high-intent COD on unsafe surface or when plant foot slips.',
      affected_items: ordered.map((o) => o.name),
      meta: { symptom_flags: true },
    })
  }

  if (DECEL_ANGLE_VELOCITY_PATTERN.test(watchText)) {
    findings.push({
      rule_key: 'output_decel_cod_angle_velocity',
      severity: 'warning',
      message: 'Angle and approach speed both increase COD stress — progress only one variable at a time.',
      affected_items: ordered.map((o) => o.name),
      meta: { symptom_flags: true },
    })
  }

  if (DECEL_EXIT_FAIL_PATTERN.test(watchText)) {
    findings.push({
      rule_key: 'output_decel_cod_exit_deceleration',
      severity: 'recommendation',
      message: 'Add deceleration zone coaching after exit or reduce exit speed.',
      affected_items: ordered.map((o) => o.name),
      meta: { symptom_flags: true },
    })
  }

  for (const { item, exerciseId, name, slug } of ordered) {
    const dosage = dosageByExercise.get(String(exerciseId))
    const restSeconds = Number(item.rest_seconds ?? item.restSeconds ?? dosage?.default_rest_seconds) || 0
    const skillLevel = String(exerciseSkillLevelById.get(String(exerciseId)) ?? '').toUpperCase()
    const isBeginner = skillLevel === 'EARLY_STAGE' || skillLevel === 'BEGINNER'

    if (slug === FIVE_YARD_DECEL_SLUG && DECEL_EXTRA_STEPS_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'output_decel_cod_accel_extra_steps',
        severity: 'recommendation',
        message: `${name}: increase stop zone, reduce approach speed, or regress to Sprint to Stick.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === LATERAL_BOUND_DECEL_SLUG && DECEL_KNEE_VALGUS_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'output_decel_cod_lateral_valgus',
        severity: 'recommendation',
        message: `${name}: regress to lateral line hops, lateral lunge shift, or supported single-leg balance.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === PRO_AGILITY_SLUG) {
      if (restSeconds > 0 && restSeconds < PRO_AGILITY_MIN_REST_SECONDS) {
        findings.push({
          rule_key: 'output_decel_cod_pro_agility_short_rest',
          severity: 'warning',
          message: `${name}: rest (${restSeconds}s) is becoming conditioning — increase rest or classify as Sustained Capacity.`,
          affected_items: [name],
          meta: { rest_seconds: restSeconds, slug },
        })
      }
      if (DECEL_REACTIVE_MISLABEL_PATTERN.test(watchText)) {
        findings.push({
          rule_key: 'output_decel_cod_pro_agility_not_reactive',
          severity: 'warning',
          message: `${name}: 5-10-5 is pre-planned change-of-direction speed, not true reactive agility without an external cue.`,
          affected_items: [name],
          meta: { slug, symptom_flags: true },
        })
      }
    }

    if (slug === NINETY_CUT_SLUG && !hasLinearDecelFoundation) {
      findings.push({
        rule_key: 'output_decel_cod_90cut_prerequisite',
        severity: 'recommendation',
        message: `${name}: use linear decel stick and controlled plant rehearsal before 90-degree cuts.`,
        affected_items: [name],
        meta: { slug },
      })
    }

    if (slug === ONE_EIGHTY_TURN_SLUG && isBeginner) {
      findings.push({
        rule_key: 'output_decel_cod_180_beginner',
        severity: 'warning',
        message: `${name}: 180-degree turns have high braking demand — use lower-speed shuttle turn or decel stick first.`,
        affected_items: [name],
        meta: { beginner: true, slug },
      })
    }

    if (slug === CURVED_RUN_TO_CUT_SLUG) {
      findings.push({
        rule_key: 'output_decel_cod_curve_safety',
        severity: 'recommendation',
        message: `${name}: confirm curve radius, traction, clear exit lane, and curved sprint control before cutting.`,
        affected_items: [name],
        meta: { slug },
      })
      if (DECEL_CURVE_UNSAFE_PATTERN.test(watchText)) {
        findings.push({
          rule_key: 'output_decel_cod_curve_unsafe',
          severity: 'warning',
          message: `${name}: curve control or surface safety is compromised — widen radius, reduce speed, or stop.`,
          affected_items: [name],
          meta: { slug, symptom_flags: true },
        })
      }
    }
  }

  return findings
}

const REACTIVE_TUMBLING_OUTPUT_SLUGS = new Set([
  'reactive-gate-sprint',
  'mirror-shuffle-to-sprint-exit',
  'ball-drop-sprint-catch',
  'power-hurdle-to-cartwheel-round-off-entry',
  'round-off-rebound-snap-down-to-stick',
])
const REACTIVE_AGILITY_OUTPUT_SLUGS = new Set([
  'reactive-gate-sprint',
  'mirror-shuffle-to-sprint-exit',
  'ball-drop-sprint-catch',
])
const TUMBLING_TAKEOFF_SLUG = 'power-hurdle-to-cartwheel-round-off-entry'
const ROUND_OFF_REBOUND_OUTPUT_SLUG = 'round-off-rebound-snap-down-to-stick'
const MIRROR_SPRINT_EXIT_SLUG = 'mirror-shuffle-to-sprint-exit'
const BALL_DROP_SPRINT_CATCH_SLUG = 'ball-drop-sprint-catch'
const REACTIVE_GATE_SPRINT_SLUG = 'reactive-gate-sprint'

const REACTIVE_GATE_PREREQ_SLUGS = new Set([
  'coach-point-and-go', 'gate-reaction-drill', 'two-point-start-walk-in', 'sprint-to-stick-deceleration',
])
const MIRROR_EXIT_PREREQ_SLUGS = new Set([
  'mirror-shuffle-drill', 'lateral-shuffle-walkthrough', 'lateral-bound-to-decel-stick',
])
const BALL_DROP_OUTPUT_PREREQ_SLUGS = new Set([
  'ball-drop-reaction', 'two-point-start-to-5-10-yard-sprint', 'sprint-to-stick-deceleration',
])
const POWER_HURDLE_OUTPUT_PREREQ_SLUGS = new Set([
  'hurdle-step-lunge', 'cartwheel', 'cartwheel-step-over', 'cartwheel-finish-lunge', 'round-off',
])
const ROUND_OFF_REBOUND_OUTPUT_PREREQ_SLUGS = new Set([
  'cartwheel', 'cartwheel-step-over', 'cartwheel-finish-lunge', 'round-off',
  'power-hurdle-to-cartwheel-round-off-entry', 'snap-down-to-rebound',
])

const REACTIVE_COLLISION_PATTERN = /cross(ing)?\s*path|collision\s*risk|paths?\s*cross/i
const REACTIVE_NO_DECEL_ZONE_PATTERN = /no\s*(safe\s*)?(run-out|deceleration|decel)|cannot\s*(stop|decelerate)/i
const REACTIVE_DIVING_PATTERN = /\bdive(s|ing)?\b|\blunge(s)?\s*reckless/i
const REACTIVE_GUESSING_PATTERN = /guess(es|ing)?\s*(before|early)|chooses?\s*wrong\s*gate/i
const REACTIVE_NO_CUE_PATTERN = /pre-planned|no\s*(external\s*)?cue|predetermined\s*route/i
const REACTIVE_QUALITY_DROP_PATTERN = /chaotic|sloppy|quality\s*drop|tired|reckless/i
const REACTIVE_SYMPTOM_PATTERN = /wrist|shoulder|neck|back|knee|ankle|achilles/i
const REACTIVE_FEAR_PATTERN = /fear|hesitat/i
const TUMBLING_FRONT_FOOT_PATTERN = /front\s*foot\s*(too\s*)?(far|reach)|kicking\s*far\s*out/i
const TUMBLING_ROUND_OFF_FAULT_PATTERN = /bent\s*arm|slow\s*snap|feet\s*apart|dead\s*landing|no\s*rebound/i
const REACTIVE_HIGH_VOLUME_THRESHOLD = 10
const MIRROR_MAX_WORK_SECONDS = 10

/** Reactive Agility & Tumbling Output cluster checks. Pure helper for tests. */
function analyzeOutputReactiveTumblingReadiness(items, ctx) {
  const {
    slugByExercise,
    dosageByExercise,
    blockMeta = [],
    outputBlockIndex = 0,
    skillSlugsInWorkout = new Set(),
    draft = {},
  } = ctx

  const findings = []
  const watchText = draftWatchText(draft)
  const ordered = []

  for (const item of items ?? []) {
    const exerciseId = Number(item.exercise_id ?? item.exerciseId)
    if (!exerciseId) continue
    const name = item.exercise_name ?? item.exerciseName ?? String(exerciseId)
    const slug = exerciseSlug(item, slugByExercise)
    if (!slug || !REACTIVE_TUMBLING_OUTPUT_SLUGS.has(slug)) continue
    ordered.push({ item, exerciseId, name, slug })
  }

  if (ordered.length === 0) return findings

  const slugsInWorkout = new Set(skillSlugsInWorkout)
  for (const meta of blockMeta ?? []) {
    for (const item of meta.block?.items ?? []) {
      const slug = exerciseSlug(item, slugByExercise)
      if (slug) slugsInWorkout.add(slug)
    }
  }

  let totalAttempts = 0

  for (let j = 0; j < outputBlockIndex; j++) {
    const priorKey = blockMeta[j]?.phaseKey
    if (priorKey === 'sustained_capacity') {
      findings.push({
        rule_key: 'output_reactive_tumbling_after_fitness',
        severity: 'warning',
        message: 'Reactive and tumbling Output require freshness — move before Sustained Capacity conditioning.',
        affected_items: ordered.map((o) => o.name),
        meta: { prior_phase: priorKey },
      })
    }
    if (priorKey === 'capacity') {
      findings.push({
        rule_key: 'output_reactive_tumbling_after_capacity',
        severity: 'warning',
        message: 'Reactive cue recognition and tumbling rebound quality may be compromised after heavy Capacity work.',
        affected_items: ordered.map((o) => o.name),
        meta: { prior_phase: priorKey },
      })
    }
  }

  if (REACTIVE_COLLISION_PATTERN.test(watchText)) {
    findings.push({
      rule_key: 'output_reactive_tumbling_collision',
      severity: 'error',
      message: 'Gate or partner layout creates collision risk — redesign lanes and eliminate crossing paths.',
      affected_items: ordered.filter((o) => REACTIVE_AGILITY_OUTPUT_SLUGS.has(o.slug)).map((o) => o.name),
      meta: { symptom_flags: true },
    })
  }

  if (REACTIVE_NO_DECEL_ZONE_PATTERN.test(watchText)) {
    findings.push({
      rule_key: 'output_reactive_tumbling_no_decel_zone',
      severity: 'error',
      message: 'Sprint exits require safe run-out and deceleration space.',
      affected_items: ordered.filter((o) => REACTIVE_AGILITY_OUTPUT_SLUGS.has(o.slug)).map((o) => o.name),
      meta: { symptom_flags: true },
    })
  }

  if (REACTIVE_NO_CUE_PATTERN.test(watchText)) {
    findings.push({
      rule_key: 'output_reactive_tumbling_no_cue',
      severity: 'warning',
      message: 'This is not reactive Output — add visual, auditory, partner, object, or spatial cue, or classify as COD/acceleration.',
      affected_items: ordered.filter((o) => REACTIVE_AGILITY_OUTPUT_SLUGS.has(o.slug)).map((o) => o.name),
      meta: { symptom_flags: true },
    })
  }

  if (REACTIVE_GUESSING_PATTERN.test(watchText)) {
    findings.push({
      rule_key: 'output_reactive_tumbling_guessing',
      severity: 'recommendation',
      message: 'Add false-cue penalty, longer ready hold, or reduce cue options when athlete guesses instead of reacting.',
      affected_items: ordered.filter((o) => REACTIVE_AGILITY_OUTPUT_SLUGS.has(o.slug)).map((o) => o.name),
      meta: { symptom_flags: true },
    })
  }

  if (REACTIVE_SYMPTOM_PATTERN.test(watchText) && /pain|symptom|hurt/i.test(watchText)) {
    findings.push({
      rule_key: 'output_reactive_tumbling_tissue_warning',
      severity: 'recommendation',
      message:
        'Pain warning signs — regress reactive/tumbling Output (Coach Point-and-Go, Mirror Shuffle Drill, Ball Drop Reaction, Hurdle-to-Lunge, or Round-Off Snap-Down Shape).',
      affected_items: ordered.map((o) => o.name),
      meta: { symptom_flags: true },
    })
  }

  if (REACTIVE_QUALITY_DROP_PATTERN.test(watchText)) {
    findings.push({
      rule_key: 'output_reactive_tumbling_quality_stop',
      severity: 'warning',
      message: 'High-complexity Output quality is dropping — stop reps or increase rest before movement becomes chaotic.',
      affected_items: ordered.map((o) => o.name),
      meta: { symptom_flags: true },
    })
  }

  for (const { item, exerciseId, name, slug } of ordered) {
    const dosage = dosageByExercise.get(String(exerciseId))
    const sets = Number(item.sets ?? dosage?.default_sets) || 1
    const reps = Number(item.reps ?? dosage?.default_reps) || 1
    const workSeconds = Number(item.work_seconds ?? item.workSeconds ?? dosage?.default_work_seconds) || 0
    totalAttempts += sets * (reps || 1)

    if (slug === REACTIVE_GATE_SPRINT_SLUG) {
      const missing = [...REACTIVE_GATE_PREREQ_SLUGS].filter((s) => !slugsInWorkout.has(s))
      if (missing.length >= 3) {
        findings.push({
          rule_key: 'output_reactive_tumbling_gate_prerequisite',
          severity: 'recommendation',
          message: `${name}: build Coach Point-and-Go, Gate Reaction, walk-in start, and Sprint to Stick before reactive gate sprints.`,
          affected_items: [name],
          meta: { missing_prereqs: missing, slug },
        })
      }
    }

    if (slug === MIRROR_SPRINT_EXIT_SLUG) {
      const missing = [...MIRROR_EXIT_PREREQ_SLUGS].filter((s) => !slugsInWorkout.has(s))
      if (!slugsInWorkout.has('mirror-shuffle-drill') && !slugsInWorkout.has('lateral-shuffle-walkthrough')) {
        findings.push({
          rule_key: 'output_reactive_tumbling_mirror_prerequisite',
          severity: 'warning',
          message: `${name}: regress to Mirror Shuffle Drill or Lateral Shuffle Mechanics Walkthrough before sprint exit.`,
          affected_items: [name],
          meta: { slug },
        })
      } else if (missing.length >= 2) {
        findings.push({
          rule_key: 'output_reactive_tumbling_mirror_prerequisite',
          severity: 'recommendation',
          message: `${name}: confirm mirror shuffle, lateral shuffle mechanics, and lateral decel stick before sprint exit.`,
          affected_items: [name],
          meta: { missing_prereqs: missing, slug },
        })
      }
      if (workSeconds > MIRROR_MAX_WORK_SECONDS) {
        findings.push({
          rule_key: 'output_reactive_tumbling_mirror_long_round',
          severity: 'warning',
          message: `${name}: mirror round (${workSeconds}s) may become fatigue-based — keep mirror phase short before sprint exit.`,
          affected_items: [name],
          meta: { work_seconds: workSeconds, slug },
        })
      }
    }

    if (slug === BALL_DROP_SPRINT_CATCH_SLUG) {
      if (REACTIVE_DIVING_PATTERN.test(watchText)) {
        findings.push({
          rule_key: 'output_reactive_tumbling_diving',
          severity: 'error',
          message: `${name}: no diving in Output reaction drills — reduce distance or allow more bounces.`,
          affected_items: [name],
          meta: { slug, symptom_flags: true },
        })
      }
      if (REACTIVE_NO_DECEL_ZONE_PATTERN.test(watchText)) {
        findings.push({
          rule_key: 'output_reactive_tumbling_ball_decel',
          severity: 'recommendation',
          message: `${name}: reduce sprint distance and confirm Sprint to Stick deceleration before max-intent ball drops.`,
          affected_items: [name],
          meta: { slug, symptom_flags: true },
        })
      }
      const missing = [...BALL_DROP_OUTPUT_PREREQ_SLUGS].filter((s) => !slugsInWorkout.has(s))
      if (missing.length >= 2) {
        findings.push({
          rule_key: 'output_reactive_tumbling_ball_prerequisite',
          severity: 'recommendation',
          message: `${name}: use Ball Drop Reaction, sprint start, and decel stick foundations before sprint-and-catch Output.`,
          affected_items: [name],
          meta: { missing_prereqs: missing, slug },
        })
      }
    }

    if (slug === TUMBLING_TAKEOFF_SLUG) {
      const missing = [...POWER_HURDLE_OUTPUT_PREREQ_SLUGS].filter((s) => !slugsInWorkout.has(s))
      if (missing.length >= 3) {
        findings.push({
          rule_key: 'output_reactive_tumbling_hurdle_prerequisite',
          severity: 'error',
          message: `${name}: explosive tumbling entry requires hurdle, cartwheel, hand-placement, and round-off foundation prerequisites.`,
          affected_items: [name],
          meta: { missing_prereqs: missing, slug },
        })
      }
      if (TUMBLING_FRONT_FOOT_PATTERN.test(watchText)) {
        findings.push({
          rule_key: 'output_reactive_tumbling_hurdle_front_foot',
          severity: 'recommendation',
          message: `${name}: return to Hurdle Step to Lunge Shape and weight-transfer drills when front foot reaches too far.`,
          affected_items: [name],
          meta: { slug, symptom_flags: true },
        })
      }
      findings.push({
        rule_key: 'output_reactive_tumbling_surface',
        severity: 'recommendation',
        message: `${name}: tumbling Output requires safe mat/tumbling surface and qualified coach supervision.`,
        affected_items: [name],
        meta: { slug },
      })
    }

    if (slug === ROUND_OFF_REBOUND_OUTPUT_SLUG) {
      const missing = [...ROUND_OFF_REBOUND_OUTPUT_PREREQ_SLUGS].filter((s) => !slugsInWorkout.has(s))
      if (missing.length >= 3) {
        findings.push({
          rule_key: 'output_reactive_tumbling_roundoff_prerequisite',
          severity: 'error',
          message: `${name}: round-off rebound requires cartwheel, round-off entry, snap-down, and power hurdle foundations.`,
          affected_items: [name],
          meta: { missing_prereqs: missing, slug },
        })
      }
      if (TUMBLING_ROUND_OFF_FAULT_PATTERN.test(watchText)) {
        findings.push({
          rule_key: 'output_reactive_tumbling_roundoff_quality_stop',
          severity: 'warning',
          message: `${name}: end Output round-off reps and regress to snap-down or cartwheel-to-snap when block, snap, or rebound quality fails.`,
          affected_items: [name],
          meta: { slug, symptom_flags: true },
        })
      }
      if (REACTIVE_FEAR_PATTERN.test(watchText)) {
        findings.push({
          rule_key: 'output_reactive_tumbling_fear_stop',
          severity: 'warning',
          message: `${name}: stop Output tumbling and regress to Movement Intelligence when fear or hesitation appears.`,
          affected_items: [name],
          meta: { slug, symptom_flags: true },
        })
      }
      findings.push({
        rule_key: 'output_reactive_tumbling_surface',
        severity: 'recommendation',
        message: `${name}: tumbling Output requires safe mat/tumbling surface and qualified coach supervision.`,
        affected_items: [name],
        meta: { slug },
      })
    }
  }

  if (totalAttempts > REACTIVE_HIGH_VOLUME_THRESHOLD) {
    findings.push({
      rule_key: 'output_reactive_tumbling_volume_high',
      severity: 'warning',
      message: `High-complexity reactive/tumbling Output volume (~${totalAttempts} attempts) is high — confirm quality, rest, and athlete readiness.`,
      affected_items: ordered.map((o) => o.name),
      meta: { total_attempts: totalAttempts },
    })
  }

  return findings
}

const ACCELERATION_OUTPUT_SLUGS = new Set([
  'falling-start-to-5-10-yard-sprint',
  'two-point-start-to-5-10-yard-sprint',
  'three-point-start-acceleration',
  'half-kneeling-start-sprint',
  'push-up-prone-start-sprint',
  'lateral-start-to-sprint-breakout',
  'backpedal-to-sprint-turn',
  'partner-chase-acceleration',
  'light-sled-sprint-band-resisted-acceleration',
  'low-incline-hill-sprint-acceleration',
])
const THREE_POINT_START_SLUG = 'three-point-start-acceleration'
const PRONE_START_SLUG = 'push-up-prone-start-sprint'
const HALF_KNEELING_START_SLUG = 'half-kneeling-start-sprint'
const PARTNER_CHASE_SLUG = 'partner-chase-acceleration'
const RESISTED_ACCEL_SLUG = 'light-sled-sprint-band-resisted-acceleration'
const HILL_ACCEL_SLUG = 'low-incline-hill-sprint-acceleration'
const ACCEL_MIN_REST_SECONDS = 45
const ACCEL_MAX_DISTANCE_YARDS = 15
const WRIST_SHOULDER_SYMPTOM_PATTERN = /wrist|shoulder/i
const LOW_BACK_SYMPTOM_PATTERN = /low\s*back|lumbar/i
const PREGNANCY_FLAG_PATTERN = /pregnan|postpartum/i
const KNEE_RESTRICTION_PATTERN = /knee\s*pain|kneeling|patell|knee\s*irrit/i
const LARGE_GROUP_PATTERN = /large\s*group|big\s*group|\b(6|8|10|12)\+?\s*(athletes|kids|players)\b/i
const HILL_SURFACE_PATTERN = /slip(ping)?|unsafe\s*(hill|surface|incline)|achilles|calf/i
const RESISTED_GRIND_PATTERN = /grind(ing)?|posture\s*break|choppy|heavy\s*(sled|band|resist)/i

/** Acceleration & Start Speed Output cluster checks. Pure helper for tests. */
function analyzeOutputAccelerationReadiness(items, ctx) {
  const {
    slugByExercise,
    dosageByExercise,
    blockMeta = [],
    outputBlockIndex = 0,
    exerciseSkillLevelById = new Map(),
    draft = {},
  } = ctx

  const findings = []
  const watchText = draftWatchText(draft)
  const ordered = []

  for (const item of items ?? []) {
    const exerciseId = Number(item.exercise_id ?? item.exerciseId)
    if (!exerciseId) continue
    const name = item.exercise_name ?? item.exerciseName ?? String(exerciseId)
    const slug = exerciseSlug(item, slugByExercise)
    if (!slug || !ACCELERATION_OUTPUT_SLUGS.has(slug)) continue
    ordered.push({ item, exerciseId, name, slug })
  }

  if (ordered.length === 0) return findings

  const slugsInBlock = new Set(ordered.map((o) => o.slug))
  let hasDecelInOutput = false
  for (const meta of blockMeta ?? []) {
    if (meta.phaseKey !== OUTPUT) continue
    for (const item of meta.block?.items ?? []) {
      const slug = exerciseSlug(item, slugByExercise)
      if (slug && DECEL_FOUNDATION_OUTPUT_SLUGS.has(slug)) hasDecelInOutput = true
    }
  }

  for (let j = 0; j < outputBlockIndex; j++) {
    const priorKey = blockMeta[j]?.phaseKey
    if (priorKey === 'sustained_capacity') {
      findings.push({
        rule_key: 'output_acceleration_after_fitness',
        severity: 'error',
        message: 'Acceleration Output requires freshness — move before Sustained Capacity conditioning.',
        affected_items: ordered.map((o) => o.name),
        meta: { prior_phase: priorKey },
      })
    }
    if (priorKey === 'capacity') {
      findings.push({
        rule_key: 'output_acceleration_after_capacity',
        severity: 'warning',
        message:
          'Lower-body fatigue may reduce sprint quality and increase risk — move acceleration Output earlier in the session.',
        affected_items: ordered.map((o) => o.name),
        meta: { prior_phase: priorKey },
      })
    }
  }

  if (!hasDecelInOutput) {
    findings.push({
      rule_key: 'output_acceleration_decel_prerequisite',
      severity: 'recommendation',
      message:
        'High-intent acceleration is scheduled without a deceleration foundation drill — add Sprint-to-Stick or 5-Yard Accel-to-Decel Stick first if stopping control is uncertain.',
      affected_items: ordered.map((o) => o.name),
      meta: {},
    })
  }

  if (MAX_VELOCITY_QUALITY_DROP_PATTERN.test(watchText)) {
    findings.push({
      rule_key: 'output_acceleration_quality_stop',
      severity: 'warning',
      message: 'Sprint quality is dropping — end Output acceleration reps or extend rest before continuing.',
      affected_items: ordered.map((o) => o.name),
      meta: { symptom_flags: true },
    })
  }

  const isBeginnerAthlete = ordered.some(({ exerciseId }) => {
    const level = String(exerciseSkillLevelById.get(String(exerciseId)) ?? '').toUpperCase()
    return level === 'EARLY_STAGE' || level === 'BEGINNER'
  })

  if (isBeginnerAthlete && slugsInBlock.has(THREE_POINT_START_SLUG)) {
    findings.push({
      rule_key: 'output_three_point_beginner',
      severity: 'warning',
      message: 'Three-point starts are advanced — use falling start or two-point start first for beginner athletes.',
      affected_items: ordered.filter((o) => o.slug === THREE_POINT_START_SLUG).map((o) => o.name),
      meta: { skill_level: 'BEGINNER', slug: THREE_POINT_START_SLUG },
    })
  }

  const hasUpperBodyRestriction =
    WRIST_SHOULDER_SYMPTOM_PATTERN.test(watchText)
    || LOW_BACK_SYMPTOM_PATTERN.test(watchText)
    || PREGNANCY_FLAG_PATTERN.test(watchText)
    || PELVIC_SYMPTOM_PATTERN.test(watchText)

  if (slugsInBlock.has(PRONE_START_SLUG) && hasUpperBodyRestriction) {
    findings.push({
      rule_key: 'output_prone_start_substitution',
      severity: 'recommendation',
      message:
        'Push-Up / Prone Start may be inappropriate with wrist, shoulder, low-back, or pregnancy/postpartum flags — use two-point start, falling start, or step-out start.',
      affected_items: ordered.filter((o) => o.slug === PRONE_START_SLUG).map((o) => o.name),
      meta: { symptom_flags: true, slug: PRONE_START_SLUG },
    })
  }

  if (slugsInBlock.has(HALF_KNEELING_START_SLUG) && KNEE_RESTRICTION_PATTERN.test(watchText)) {
    findings.push({
      rule_key: 'output_half_kneeling_substitution',
      severity: 'recommendation',
      message:
        'Half-Kneeling Start may be inappropriate with knee pain or kneeling restriction — use two-point start or falling start.',
      affected_items: ordered.filter((o) => o.slug === HALF_KNEELING_START_SLUG).map((o) => o.name),
      meta: { symptom_flags: true, slug: HALF_KNEELING_START_SLUG },
    })
  }

  if (slugsInBlock.has(PARTNER_CHASE_SLUG)) {
    findings.push({
      rule_key: 'output_partner_chase_group',
      severity: 'recommendation',
      message:
        'Partner Chase Acceleration requires clear lanes, no-contact rules, and pairing by speed, size, and maturity.',
      affected_items: ordered.filter((o) => o.slug === PARTNER_CHASE_SLUG).map((o) => o.name),
      meta: { slug: PARTNER_CHASE_SLUG },
    })
    if (LARGE_GROUP_PATTERN.test(watchText) || UNSAFE_TAG_CONTACT_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'output_partner_chase_unsafe',
        severity: 'warning',
        message:
          'Large-group or unsafe-contact context reported — widen lanes, enforce no-contact, or substitute point-and-go acceleration.',
        affected_items: ordered.filter((o) => o.slug === PARTNER_CHASE_SLUG).map((o) => o.name),
        meta: { slug: PARTNER_CHASE_SLUG, symptom_flags: true },
      })
    }
  }

  if (slugsInBlock.has(RESISTED_ACCEL_SLUG)) {
    findings.push({
      rule_key: 'output_resisted_load_check',
      severity: 'recommendation',
      message:
        'Resisted acceleration requires unloaded sprint competency — resistance must not destroy posture, cause grinding, or break sprint rhythm.',
      affected_items: ordered.filter((o) => o.slug === RESISTED_ACCEL_SLUG).map((o) => o.name),
      meta: { slug: RESISTED_ACCEL_SLUG },
    })
    if (RESISTED_GRIND_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'output_resisted_mechanics_break',
        severity: 'warning',
        message:
          'Resisted sprint mechanics appear compromised — reduce load, shorten distance, or return to unresisted acceleration.',
        affected_items: ordered.filter((o) => o.slug === RESISTED_ACCEL_SLUG).map((o) => o.name),
        meta: { slug: RESISTED_ACCEL_SLUG, symptom_flags: true },
      })
    }
  }

  if (slugsInBlock.has(HILL_ACCEL_SLUG)) {
    findings.push({
      rule_key: 'output_hill_surface_check',
      severity: 'recommendation',
      message:
        'Hill sprint requires a safe low incline, no slipping, clear run-out, and pain-free calves/Achilles.',
      affected_items: ordered.filter((o) => o.slug === HILL_ACCEL_SLUG).map((o) => o.name),
      meta: { slug: HILL_ACCEL_SLUG },
    })
    if (HILL_SURFACE_PATTERN.test(watchText) || LOWER_LEG_SYMPTOM_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'output_hill_surface_unsafe',
        severity: 'warning',
        message:
          'Hill surface or lower-leg warning signs reported — check traction, reduce incline, or substitute flat acceleration.',
        affected_items: ordered.filter((o) => o.slug === HILL_ACCEL_SLUG).map((o) => o.name),
        meta: { slug: HILL_ACCEL_SLUG, symptom_flags: true },
      })
    }
  }

  for (const { item, exerciseId, name, slug } of ordered) {
    const dosage = dosageByExercise.get(String(exerciseId))
    const rpe = itemRpe(item, dosage)
    const restSeconds = Number(item.rest_seconds ?? item.restSeconds ?? dosage?.default_rest_seconds) || 0
    const totalYards = parseTotalDistanceYards(item, dosage)

    if (totalYards > ACCEL_MAX_DISTANCE_YARDS) {
      findings.push({
        rule_key: 'output_acceleration_distance',
        severity: 'recommendation',
        message: `${name}: ${totalYards} yards may shift from acceleration start work toward longer acceleration or max-velocity exposure.`,
        affected_items: [name],
        meta: { total_yards: totalYards, slug },
      })
    }

    if (rpe >= 7 && restSeconds > 0 && restSeconds < ACCEL_MIN_REST_SECONDS) {
      findings.push({
        rule_key: 'output_acceleration_short_rest',
        severity: 'warning',
        message: `${name}: rest (${restSeconds}s) may be too short for Output acceleration — increase rest or classify as Sustained Capacity.`,
        affected_items: [name],
        meta: { rest_seconds: restSeconds, rpe, slug },
      })
    }
  }

  return findings
}

const CAPACITY_HEAVY_LOWER_SUBROLES = new Set([
  'squat_knee_dominant_strength',
  'hinge_posterior_chain_strength',
])
const NORDIC_SLUG = 'nordic-hamstring-eccentric'
const COPENHAGEN_SLUG = 'copenhagen-plank-short-lever'
const PULL_UP_SLUG = 'pull-up-chin-up'
const ASSISTED_PULL_UP_SLUG = 'assisted-pull-up'
const DEAD_HANG_SLUG = 'dead-hang-active-hang'
const OVERHEAD_CARRY_SLUG = 'overhead-carry'
const SLED_PUSH_SLUG = 'heavy-sled-push-sled-drive-march'
const ECCENTRIC_CAPACITY_SLUGS = new Set([
  NORDIC_SLUG,
  'hamstring-slider-curl',
  'eccentric-pull-up-chin-up-negative',
  'tempo-eccentric-push-up',
])
const TISSUE_CAPACITY_SUBROLE = 'tissue_capacity_isometric_eccentric_accessory'
const CAPACITY_SHORT_REST_SECONDS = 45
const CAPACITY_MIN_RPE_STRENGTH = 6
const HEAVY_LOAD_PATTERN = /heavy\s*load|max\s*lift|1rm|grinding|near\s*max/i
const YOUTH_ATHLETE_CAPACITY_PATTERN = /youth|kids?|child|teen\s*beginner/i
const ECCENTRIC_VOLUME_PATTERN = /high\s*volume\s*eccentric|too\s*many\s*eccentric|eccentric\s*volume/i
const POSTURE_COLLAPSE_PATTERN = /posture\s*collapse|trunk\s*collapse|rounded\s*back|leaning\s*badly/i
const SHOULDER_PAIN_PATTERN = /shoulder\s*pain|shoulder\s*irrit/i
const JOINT_PAIN_PATTERN = /knee\s*pain|hip\s*pain|back\s*pain|wrist\s*pain|achilles|elbow\s*pain/i
const OVERHEAD_MOBILITY_PATTERN = /overhead\s*mobility|shoulder\s*mobility|cannot\s*overhead|overhead\s*restriction/i
const SLED_GRIND_PATTERN = /sled\s*grind|posture\s*break|choppy\s*push|heavy\s*sled/i
const LIGHT_LOAD_PATTERN = /too\s*light|no\s*strength\s*stimulus|load\s*too\s*light/i

function countCapacityVolume(item, dosage) {
  const sets = Number(item.sets ?? dosage?.default_sets) || 1
  const reps = Number(item.reps ?? dosage?.default_reps) || 1
  return sets * reps
}

const CAPACITY_SQUAT_SLUGS = new Set([
  'goblet-squat',
  'box-squat',
  'front-squat-db-kb-barbell',
  'split-squat',
  'rear-foot-elevated-split-squat',
  'reverse-lunge',
  'step-up',
  'lateral-lunge-loaded',
  'loaded-cossack-squat',
  'heavy-sled-push-sled-drive-march',
])
const GOBLET_SQUAT_SLUG = 'goblet-squat'
const BOX_SQUAT_SLUG = 'box-squat'
const FRONT_SQUAT_SLUG = 'front-squat-db-kb-barbell'
const SPLIT_SQUAT_SLUG = 'split-squat'
const RFESS_SLUG = 'rear-foot-elevated-split-squat'
const REVERSE_LUNGE_SLUG = 'reverse-lunge'
const STEP_UP_SLUG = 'step-up'
const LATERAL_LUNGE_LOADED_SLUG = 'lateral-lunge-loaded'
const LOADED_COSSACK_SLUG = 'loaded-cossack-squat'
const HEAVY_SLED_SLUG = 'heavy-sled-push-sled-drive-march'

const CAPACITY_SQUAT_KNEE_VALGUS_PATTERN = /knee\s*valgus|knees?\s*cave|knees?\s*collapse/i
const CAPACITY_SQUAT_TRUNK_COLLAPSE_PATTERN = /trunk\s*collapse|back\s*round|rounded\s*back|low\s*back\s*round/i
const CAPACITY_SQUAT_BOX_RELAX_PATTERN = /hard\s*(sit|touch)|rock(ing)?\s*(on\s*)?box|relax(es|ed)?\s*(on\s*)?box|crash(es)?\s*onto\s*box/i
const CAPACITY_SQUAT_RACK_PAIN_PATTERN = /wrist\s*pain|shoulder\s*pain|rack\s*pain|cannot\s*maintain\s*rack/i
const CAPACITY_SQUAT_SPLIT_UNSTABLE_PATTERN = /split\s*squat\s*unstable|cannot\s*control\s*split|balance\s*fail/i
const CAPACITY_SQUAT_MIDLINE_CROSS_PATTERN = /cross(es|ing)?\s*midline|step\s*crosses/i
const CAPACITY_SQUAT_FLOOR_LEG_PATTERN = /push(es|ing)?\s*off\s*(the\s*)?floor\s*leg|floor\s*leg\s*push/i
const CAPACITY_SQUAT_GROIN_PAIN_PATTERN = /groin\s*pain|adductor\s*pain|sharp\s*groin/i
const CAPACITY_SQUAT_SLED_LIGHT_FAST_PATTERN = /light\s*sled|fast\s*sled|sled\s*sprint|resisted\s*acceleration/i
const CAPACITY_SQUAT_SLED_CONDITIONING_PATTERN = /long\s*duration|short\s*rest|sled\s*circuit|conditioning\s*sled/i
const CAPACITY_SQUAT_TISSUE_PAIN_PATTERN = /knee\s*pain|hip\s*pain|ankle\s*pain|low\s*back\s*pain|low-back\s*pain/i
const CAPACITY_SQUAT_YOUTH_LOAD_PATTERN = /external\s*load|loaded|weight\s*added|dumbbell|kettlebell|barbell/i
const CAPACITY_SQUAT_STEP_HEIGHT_PATTERN = /box\s*too\s*high|cannot\s*control\s*step|step\s*up\s*height/i

/** Squat / knee-dominant Capacity cluster checks. Pure helper for tests. */
function analyzeCapacitySquatReadiness(items, ctx) {
  const {
    slugByExercise,
    dosageByExercise,
    blockMeta = [],
    capacityBlockIndex = 0,
    exerciseSkillLevelById = new Map(),
    draft = {},
  } = ctx

  const findings = []
  const watchText = draftWatchText(draft)
  const ordered = []

  for (const item of items ?? []) {
    const exerciseId = Number(item.exercise_id ?? item.exerciseId)
    if (!exerciseId) continue
    const name = item.exercise_name ?? item.exerciseName ?? String(exerciseId)
    const slug = exerciseSlug(item, slugByExercise)
    if (!slug || !CAPACITY_SQUAT_SLUGS.has(slug)) continue
    ordered.push({ item, exerciseId, name, slug })
  }

  if (ordered.length === 0) return findings

  const slugsInWorkout = new Set(ordered.map((o) => o.slug))
  for (const meta of blockMeta ?? []) {
    for (const blockItem of meta.block?.items ?? []) {
      const slug = exerciseSlug(blockItem, slugByExercise)
      if (slug) slugsInWorkout.add(slug)
    }
  }

  let outputAfterCapacity = false
  for (let j = capacityBlockIndex + 1; j < blockMeta.length; j++) {
    if (blockMeta[j]?.phaseKey === OUTPUT) outputAfterCapacity = true
  }

  if (outputAfterCapacity) {
    findings.push({
      rule_key: 'capacity_squat_before_output',
      severity: 'warning',
      message: 'Lower-body Capacity may reduce sprint, jump, tumbling, or COD quality. Confirm strength-priority session.',
      affected_items: ordered.map((o) => o.name),
      meta: { capacity_before_output: true },
    })
  }

  const isYouthAthlete = ordered.some(({ exerciseId }) => {
    const level = String(exerciseSkillLevelById.get(String(exerciseId)) ?? '').toUpperCase()
    return level === 'EARLY_STAGE' || level === 'BEGINNER'
  })

  if (
    (isYouthAthlete || YOUTH_ATHLETE_CAPACITY_PATTERN.test(watchText))
    && (CAPACITY_SQUAT_YOUTH_LOAD_PATTERN.test(watchText) || HEAVY_LOAD_PATTERN.test(watchText))
  ) {
    findings.push({
      rule_key: 'capacity_squat_youth_load_confirm',
      severity: 'recommendation',
      message:
        'Youth external load on squat patterns requires coach confirmation: controlled technique, light-to-moderate load, qualified supervision, no max-lift intent.',
      affected_items: ordered.map((o) => o.name),
      meta: { youth_flags: true },
    })
  }

  if (CAPACITY_SQUAT_TISSUE_PAIN_PATTERN.test(watchText)) {
    findings.push({
      rule_key: 'capacity_squat_tissue_substitution',
      severity: 'recommendation',
      message:
        'Pain warning signs — substitute: goblet→box squat; front squat→goblet; RFESS→split squat or step-up; reverse lunge→split squat; lateral/Cossack→lateral shift; sled→lighter march or squat pattern.',
      affected_items: ordered.map((o) => o.name),
      meta: { symptom_flags: true },
    })
  }

  for (const { item, exerciseId, name, slug } of ordered) {
    const dosage = dosageByExercise.get(String(exerciseId))
    const restSeconds = Number(item.rest_seconds ?? item.restSeconds ?? dosage?.default_rest_seconds) || 0
    const skillLevel = String(exerciseSkillLevelById.get(String(exerciseId)) ?? '').toUpperCase()
    const isBeginner = skillLevel === 'EARLY_STAGE' || skillLevel === 'BEGINNER'

    if (slug === GOBLET_SQUAT_SLUG && (CAPACITY_SQUAT_KNEE_VALGUS_PATTERN.test(watchText) || CAPACITY_SQUAT_TRUNK_COLLAPSE_PATTERN.test(watchText))) {
      findings.push({
        rule_key: 'capacity_squat_goblet_valgus',
        severity: 'recommendation',
        message: `${name}: reduce load, use box squat, or regress to bodyweight squat when knee valgus or trunk collapse appears.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === BOX_SQUAT_SLUG && CAPACITY_SQUAT_BOX_RELAX_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_squat_box_relax',
        severity: 'warning',
        message: `${name}: box is a target, not a rest — reduce load or coach a controlled soft touch.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === FRONT_SQUAT_SLUG && CAPACITY_SQUAT_RACK_PAIN_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_squat_front_rack_pain',
        severity: 'recommendation',
        message: `${name}: use goblet squat, double DB front squat, or box squat when rack position causes wrist/shoulder pain.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === SPLIT_SQUAT_SLUG && CAPACITY_SQUAT_SPLIT_UNSTABLE_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_squat_split_unstable',
        severity: 'recommendation',
        message: `${name}: use hand support, shorter range, or split squat isometric hold before loading.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === RFESS_SLUG && !slugsInWorkout.has(SPLIT_SQUAT_SLUG)) {
      findings.push({
        rule_key: 'capacity_squat_rfe_ss_prerequisite',
        severity: 'warning',
        message: `${name}: RFESS is advanced unilateral loading — use split squat first.`,
        affected_items: [name],
        meta: { slug },
      })
    }

    if (slug === REVERSE_LUNGE_SLUG && CAPACITY_SQUAT_MIDLINE_CROSS_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_squat_reverse_lunge_midline',
        severity: 'recommendation',
        message: `${name}: use split squat or floor markers before loading when step path crosses midline.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === STEP_UP_SLUG && (CAPACITY_SQUAT_STEP_HEIGHT_PATTERN.test(watchText) || CAPACITY_SQUAT_FLOOR_LEG_PATTERN.test(watchText))) {
      findings.push({
        rule_key: 'capacity_squat_step_up_height',
        severity: 'warning',
        message: `${name}: lower the box — athlete should not push off the floor leg excessively.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if ((slug === LATERAL_LUNGE_LOADED_SLUG || slug === LOADED_COSSACK_SLUG) && CAPACITY_SQUAT_GROIN_PAIN_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_squat_groin_stop',
        severity: 'warning',
        message: `${name}: end frontal-plane loaded strength and regress to adductor rockback, lateral shift, or shallow lateral lunge.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === LOADED_COSSACK_SLUG && isBeginner) {
      findings.push({
        rule_key: 'capacity_squat_cossack_beginner',
        severity: 'recommendation',
        message: `${name}: use Cossack shift, supported Cossack, or lateral lunge before loaded deep range.`,
        affected_items: [name],
        meta: { slug, beginner: true },
      })
    }

    if (slug === HEAVY_SLED_SLUG) {
      if (SLED_GRIND_PATTERN.test(watchText) || CAPACITY_SQUAT_TRUNK_COLLAPSE_PATTERN.test(watchText)) {
        findings.push({
          rule_key: 'capacity_squat_sled_grind',
          severity: 'warning',
          message: `${name}: reduce load or shorten distance — Capacity requires strong posture, not low-back grinding.`,
          affected_items: [name],
          meta: { slug, symptom_flags: true },
        })
      }
      if (CAPACITY_SQUAT_SLED_LIGHT_FAST_PATTERN.test(watchText)) {
        findings.push({
          rule_key: 'capacity_squat_sled_output_suggest',
          severity: 'recommendation',
          message: `${name}: light fast sled with full recovery may belong in Output as resisted acceleration.`,
          affected_items: [name],
          meta: { slug, symptom_flags: true },
        })
      }
      if (CAPACITY_SQUAT_SLED_CONDITIONING_PATTERN.test(watchText) || (restSeconds > 0 && restSeconds < CAPACITY_SHORT_REST_SECONDS)) {
        findings.push({
          rule_key: 'capacity_squat_sled_fitness_suggest',
          severity: 'recommendation',
          message: `${name}: long-duration or short-rest sled work may belong in Sustained Capacity.`,
          affected_items: [name],
          meta: { slug, rest_seconds: restSeconds, symptom_flags: true },
        })
      }
    }
  }

  return findings
}

const CAPACITY_HINGE_SLUGS = new Set([
  'kettlebell-deadlift-trap-bar-deadlift',
  'romanian-deadlift',
  'single-leg-romanian-deadlift',
  'hip-thrust-loaded-glute-bridge',
  'good-morning-light-technical',
  'hamstring-slider-curl',
  'nordic-hamstring-eccentric',
  'back-extension-hip-extension',
])
const KB_DEADLIFT_SLUG = 'kettlebell-deadlift-trap-bar-deadlift'
const RDL_SLUG = 'romanian-deadlift'
const SLRDL_SLUG = 'single-leg-romanian-deadlift'
const HIP_THRUST_SLUG = 'hip-thrust-loaded-glute-bridge'
const GOOD_MORNING_SLUG = 'good-morning-light-technical'
const HAMSTRING_SLIDER_SLUG = 'hamstring-slider-curl'
const BACK_EXT_SLUG = 'back-extension-hip-extension'
const CAPACITY_HINGE_HEAVY_BEFORE_SPRINT_SLUGS = new Set([
  KB_DEADLIFT_SLUG,
  RDL_SLUG,
  GOOD_MORNING_SLUG,
  HAMSTRING_SLIDER_SLUG,
  NORDIC_SLUG,
])
const CAPACITY_HINGE_BACK_ROUND_PATTERN = /back\s*round|rounded\s*back|low\s*back\s*round|spine\s*round/i
const CAPACITY_HINGE_RDL_RANGE_PATTERN = /chase\s*(the\s*)?floor|too\s*deep|exceeds?\s*control|floor\s*range/i
const CAPACITY_HINGE_BALANCE_FAIL_PATTERN = /balance\s*fail|cannot\s*balance|foot\s*touch|kickstand/i
const CAPACITY_HINGE_LUMBAR_EXT_PATTERN = /lumbar\s*extension|arch(es|ing)?\s*at\s*lockout|over\s*arch/i
const CAPACITY_HINGE_HAMSTRING_CRAMP_PATTERN = /hamstring\s*cramp|cramp(s|ing)?\s*immediately/i
const CAPACITY_HINGE_SPRINT_SCHEDULE_PATTERN = /max\s*speed|max\s*velocity|sprint(ing)?\s*(within|in)\s*(24|48)|speed\s*day|high.?speed\s*sprint/i
const CAPACITY_HINGE_BACK_DOMINANCE_PATTERN = /low\s*back\s*dominance|only\s*low\s*back|feels?\s*only\s*back/i
const CAPACITY_HINGE_NERVE_PATTERN = /nerve|tingling|numbness|radiating|sciatica/i
const CAPACITY_HINGE_TISSUE_PAIN_PATTERN = /hamstring\s*pain|low\s*back\s*pain|low-back\s*pain|hip\s*pain|knee\s*pain/i
const NORDIC_MAX_VOLUME = 15

/** Hinge / posterior-chain Capacity cluster checks. Pure helper for tests. */
function analyzeCapacityHingeReadiness(items, ctx) {
  const {
    slugByExercise,
    dosageByExercise,
    blockMeta = [],
    capacityBlockIndex = 0,
    exerciseSkillLevelById = new Map(),
    draft = {},
  } = ctx

  const findings = []
  const watchText = draftWatchText(draft)
  const ordered = []

  for (const item of items ?? []) {
    const exerciseId = Number(item.exercise_id ?? item.exerciseId)
    if (!exerciseId) continue
    const name = item.exercise_name ?? item.exerciseName ?? String(exerciseId)
    const slug = exerciseSlug(item, slugByExercise)
    if (!slug || !CAPACITY_HINGE_SLUGS.has(slug)) continue
    ordered.push({ item, exerciseId, name, slug })
  }

  if (ordered.length === 0) return findings

  const slugsInWorkout = new Set(ordered.map((o) => o.slug))
  for (const meta of blockMeta ?? []) {
    for (const blockItem of meta.block?.items ?? []) {
      const slug = exerciseSlug(blockItem, slugByExercise)
      if (slug) slugsInWorkout.add(slug)
    }
  }

  let outputAfterCapacity = false
  let maxVelocityAfterCapacity = false
  for (let j = capacityBlockIndex + 1; j < blockMeta.length; j++) {
    const key = blockMeta[j]?.phaseKey
    if (key === OUTPUT) outputAfterCapacity = true
    if (key === OUTPUT) {
      for (const blockItem of blockMeta[j]?.block?.items ?? []) {
        const slug = exerciseSlug(blockItem, slugByExercise)
        if (slug && MAX_VELOCITY_OUTPUT_SLUGS.has(slug)) maxVelocityAfterCapacity = true
      }
    }
  }

  if (outputAfterCapacity) {
    findings.push({
      rule_key: 'capacity_hinge_before_output',
      severity: 'warning',
      message:
        'Posterior-chain fatigue may reduce sprint, jump, tumbling, and deceleration quality. Confirm strength-priority session.',
      affected_items: ordered.map((o) => o.name),
      meta: { capacity_before_output: true },
    })
  }

  const heavyBeforeSprint = ordered.filter((o) => CAPACITY_HINGE_HEAVY_BEFORE_SPRINT_SLUGS.has(o.slug))
  if (outputAfterCapacity && maxVelocityAfterCapacity && heavyBeforeSprint.length > 0) {
    findings.push({
      rule_key: 'capacity_hinge_before_max_velocity',
      severity: 'warning',
      message:
        'Hamstring and trunk fatigue may compromise high-speed sprint exposure when heavy RDL, deadlift, good morning, Nordic, or hard slider curl precedes max-velocity Output.',
      affected_items: heavyBeforeSprint.map((o) => o.name),
      meta: { max_velocity_after_capacity: true },
    })
  }

  const isYouthAthlete = ordered.some(({ exerciseId }) => {
    const level = String(exerciseSkillLevelById.get(String(exerciseId)) ?? '').toUpperCase()
    return level === 'EARLY_STAGE' || level === 'BEGINNER'
  })

  if (CAPACITY_HINGE_TISSUE_PAIN_PATTERN.test(watchText)) {
    findings.push({
      rule_key: 'capacity_hinge_tissue_substitution',
      severity: 'recommendation',
      message:
        'Pain warning signs — substitute: deadlift→elevated KB deadlift or hip thrust; RDL→shorter-range RDL or bridge; single-leg RDL→kickstand RDL; good morning→dowel hinge or RDL; slider→bridge hold; Nordic→assisted slider curl; back extension→glute bridge or bird dog.',
      affected_items: ordered.map((o) => o.name),
      meta: { symptom_flags: true },
    })
  }

  if (CAPACITY_HINGE_NERVE_PATTERN.test(watchText)) {
    findings.push({
      rule_key: 'capacity_hinge_nerve_symptoms',
      severity: 'error',
      message: 'End the drill and regress. Do not load through nerve symptoms.',
      affected_items: ordered.map((o) => o.name),
      meta: { symptom_flags: true },
    })
  }

  const hasNordic = ordered.some((o) => o.slug === NORDIC_SLUG)
  if (hasNordic && !slugsInWorkout.has(HAMSTRING_SLIDER_SLUG)) {
    findings.push({
      rule_key: 'capacity_hinge_nordic_prerequisite',
      severity: 'warning',
      message: 'Nordics are high-stress eccentric work. Use hamstring slider curl or assisted partial-range Nordic first.',
      affected_items: ordered.filter((o) => o.slug === NORDIC_SLUG).map((o) => o.name),
      meta: { slug: NORDIC_SLUG },
    })
  }

  if (CAPACITY_HINGE_SPRINT_SCHEDULE_PATTERN.test(watchText) && ordered.some((o) => ECCENTRIC_CAPACITY_SLUGS.has(o.slug) || o.slug === RDL_SLUG)) {
    findings.push({
      rule_key: 'capacity_hinge_sprint_schedule',
      severity: 'warning',
      message: 'Hard hamstring eccentric work may create soreness or reduce sprint quality within 24–48 hours.',
      affected_items: ordered
        .filter((o) => ECCENTRIC_CAPACITY_SLUGS.has(o.slug) || o.slug === RDL_SLUG || o.slug === GOOD_MORNING_SLUG)
        .map((o) => o.name),
      meta: { symptom_flags: true },
    })
  }

  let hasHighDensity = false
  for (const { item, exerciseId, name, slug } of ordered) {
    const dosage = dosageByExercise.get(String(exerciseId))
    const restSeconds = Number(item.rest_seconds ?? item.restSeconds ?? dosage?.default_rest_seconds) || 0
    const volume = countCapacityVolume(item, dosage)
    const rpe = itemRpe(item, dosage)
    const skillLevel = String(exerciseSkillLevelById.get(String(exerciseId)) ?? '').toUpperCase()
    const isBeginner = skillLevel === 'EARLY_STAGE' || skillLevel === 'BEGINNER'

    if (restSeconds > 0 && restSeconds < CAPACITY_SHORT_REST_SECONDS && volume >= 12 && rpe >= CAPACITY_MIN_RPE_STRENGTH) {
      hasHighDensity = true
    }

    if (slug === KB_DEADLIFT_SLUG && CAPACITY_HINGE_BACK_ROUND_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_hinge_deadlift_rounding',
        severity: 'recommendation',
        message: `${name}: elevate the load, reduce load, or regress to hip-hinge drill when back rounds before lift.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === RDL_SLUG && CAPACITY_HINGE_RDL_RANGE_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_hinge_rdl_range',
        severity: 'warning',
        message: `${name}: do not chase floor range. Stop where the hinge remains clean.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === SLRDL_SLUG && CAPACITY_HINGE_BALANCE_FAIL_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_hinge_slrdf_balance',
        severity: 'recommendation',
        message: `${name}: use kickstand RDL, supported single-leg RDL, or bilateral RDL when balance dominates over strength.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === HIP_THRUST_SLUG && CAPACITY_HINGE_LUMBAR_EXT_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_hinge_hip_thrust_lumbar',
        severity: 'recommendation',
        message: `${name}: reduce load, cue ribs down, shorten range, or use bodyweight bridge when lumbar extension appears at lockout.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === GOOD_MORNING_SLUG && (isBeginner || isYouthAthlete || YOUTH_ATHLETE_CAPACITY_PATTERN.test(watchText))) {
      findings.push({
        rule_key: 'capacity_hinge_good_morning_beginner',
        severity: 'warning',
        message: `${name}: good morning is technical and spine-position sensitive. Use dowel hinge, band good morning, or RDL first.`,
        affected_items: [name],
        meta: { slug, skill_level: 'BEGINNER' },
      })
    }

    if (slug === HAMSTRING_SLIDER_SLUG && CAPACITY_HINGE_HAMSTRING_CRAMP_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_hinge_slider_cramp',
        severity: 'recommendation',
        message: `${name}: use shorter range, eccentric-only, bridge hold, or hip thrust when cramping appears immediately.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === NORDIC_SLUG && volume > NORDIC_MAX_VOLUME) {
      findings.push({
        rule_key: 'capacity_hinge_nordic_volume',
        severity: 'warning',
        message: `${name}: Nordic volume is high (>${NORDIC_MAX_VOLUME} reps). Monitor soreness and sprint schedule.`,
        affected_items: [name],
        meta: { slug, volume },
      })
    }

    if (slug === BACK_EXT_SLUG && CAPACITY_HINGE_BACK_DOMINANCE_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_hinge_back_extension_dominance',
        severity: 'recommendation',
        message: `${name}: adjust pad, cue hip hinge/glute squeeze, reduce range, or substitute hip thrust/RDL when low back dominates.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }
  }

  if (hasHighDensity) {
    findings.push({
      rule_key: 'capacity_hinge_short_rest_density',
      severity: 'warning',
      message: 'This may be Sustained Capacity rather than Capacity. Confirm intent — hinge strength needs full rest between sets.',
      affected_items: ordered.map((o) => o.name),
      meta: {},
    })
  }

  return findings
}

const CAPACITY_PUSH_SLUGS = new Set([
  'incline-push-up',
  'push-up',
  'tempo-eccentric-push-up',
  'dumbbell-kettlebell-floor-press',
  'dumbbell-bench-press',
  'half-kneeling-single-arm-press',
  'pike-push-up-box-pike-push-up',
  'dip-support-ring-support-hold',
])
const INCLINE_PUSH_UP_SLUG = 'incline-push-up'
const PUSH_UP_SLUG = 'push-up'
const TEMPO_ECCENTRIC_PUSH_UP_SLUG = 'tempo-eccentric-push-up'
const FLOOR_PRESS_SLUG = 'dumbbell-kettlebell-floor-press'
const BENCH_PRESS_SLUG = 'dumbbell-bench-press'
const HALF_KNEELING_PRESS_SLUG = 'half-kneeling-single-arm-press'
const PIKE_PUSH_UP_SLUG = 'pike-push-up-box-pike-push-up'
const DIP_SUPPORT_SLUG = 'dip-support-ring-support-hold'
const HAND_SUPPORT_AFTER_PUSH_CAPACITY_SLUGS = new Set([
  ...TUMBLING_SKILL_PREREQ_SLUGS,
  ...HANDSTAND_SKILL_SLUGS,
  'handstand-hold',
  'donkey-kick',
  'ring-row-trx-row',
])
const CAPACITY_PUSH_SAG_PATTERN = /hips?\s*sag|sagging\s*hip|butt\s*pike|elbow\s*flare|flaring\s*elbow/i
const CAPACITY_PUSH_PLANK_FAIL_PATTERN = /cannot\s*maintain\s*plank|plank\s*line\s*break|lose\s*plank|trunk\s*sag|hips?\s*sag/i
const CAPACITY_PUSH_QUALITY_BREAK_PATTERN = /form\s*break|quality\s*break|sloppy\s*rep|cannot\s*control\s*(the\s*)?rep|rep\s*quality\s*break/i
const CAPACITY_PUSH_ECCENTRIC_SORENESS_PATTERN = /eccentric\s*soreness|excessive\s*soreness|too\s*much\s*soreness|doms/i
const CAPACITY_PUSH_SETUP_FAIL_PATTERN = /cannot\s*(safely\s*)?get\s*weight|setup\s*unsafe|cannot\s*control\s*dumbbell|dumbbell\s*control\s*fail/i
const CAPACITY_PUSH_SHOULDER_BOTTOM_PATTERN = /shoulder\s*pain\s*at\s*bottom|pinch(es|ing)?\s*at\s*bottom|pain\s*at\s*depth|shoulder\s*pinch/i
const CAPACITY_PUSH_RIB_FLARE_PATTERN = /rib\s*flare|low\s*back\s*arch|lean(s|ing)?\s*back|lumbar\s*extension/i
const CAPACITY_PUSH_RING_FAULT_PATTERN = /ring(s)?\s*drift|shoulder\s*shrug|elbow\s*bend|cannot\s*hold\s*support|rings?\s*wide/i
const CAPACITY_PUSH_BOX_PIKE_PATTERN = /box\s*pike|feet\s*on\s*box\s*pike/i
const CAPACITY_PUSH_PARALLEL_BAR_FAIL_PATTERN = /cannot\s*hold\s*parallel|parallel\s*bar\s*support\s*fail|unstable\s*support/i
const WRIST_PAIN_PATTERN = /wrist\s*pain/i

/** Upper-body push Capacity cluster checks. Pure helper for tests. */
function analyzeCapacityPushReadiness(items, ctx) {
  const {
    slugByExercise,
    dosageByExercise,
    blockMeta = [],
    capacityBlockIndex = 0,
    exerciseSkillLevelById = new Map(),
    draft = {},
  } = ctx

  const findings = []
  const watchText = draftWatchText(draft)
  const ordered = []

  for (const item of items ?? []) {
    const exerciseId = Number(item.exercise_id ?? item.exerciseId)
    if (!exerciseId) continue
    const name = item.exercise_name ?? item.exerciseName ?? String(exerciseId)
    const slug = exerciseSlug(item, slugByExercise)
    if (!slug || !CAPACITY_PUSH_SLUGS.has(slug)) continue
    ordered.push({ item, exerciseId, name, slug })
  }

  if (ordered.length === 0) return findings

  const slugsInWorkout = new Set(ordered.map((o) => o.slug))
  for (const meta of blockMeta ?? []) {
    for (const blockItem of meta.block?.items ?? []) {
      const slug = exerciseSlug(blockItem, slugByExercise)
      if (slug) slugsInWorkout.add(slug)
    }
  }

  let handSupportAfterCapacity = false
  for (let j = capacityBlockIndex + 1; j < blockMeta.length; j++) {
    const key = blockMeta[j]?.phaseKey
    if (key !== MOVEMENT_INTELLIGENCE && key !== OUTPUT) continue
    for (const blockItem of blockMeta[j]?.block?.items ?? []) {
      const slug = exerciseSlug(blockItem, slugByExercise)
      if (slug && HAND_SUPPORT_AFTER_PUSH_CAPACITY_SLUGS.has(slug)) {
        handSupportAfterCapacity = true
        break
      }
    }
    if (handSupportAfterCapacity) break
  }

  if (handSupportAfterCapacity) {
    findings.push({
      rule_key: 'capacity_push_before_hand_support',
      severity: 'warning',
      message:
        'Pressing fatigue may reduce hand-support quality. Confirm strength-priority session.',
      affected_items: ordered.map((o) => o.name),
      meta: { capacity_before_hand_support: true },
    })
  }

  const isYouthAthlete = ordered.some(({ exerciseId }) => {
    const level = String(exerciseSkillLevelById.get(String(exerciseId)) ?? '').toUpperCase()
    return level === 'EARLY_STAGE' || level === 'BEGINNER'
  })

  if (WRIST_PAIN_PATTERN.test(watchText)) {
    findings.push({
      rule_key: 'capacity_push_wrist_pain',
      severity: 'recommendation',
      message:
        'Wrist pain — substitute: push-up→handles/parallettes or incline push-up; pike→overhead press; ring support→parallel-bar or box-assisted support; floor/bench press→neutral-grip DB press.',
      affected_items: ordered.map((o) => o.name),
      meta: { symptom_flags: true },
    })
  }

  if (SHOULDER_PAIN_PATTERN.test(watchText)) {
    findings.push({
      rule_key: 'capacity_push_shoulder_pain',
      severity: 'recommendation',
      message:
        'Shoulder pain — substitute: push-up→incline with shorter range; bench press→floor press; overhead press→landmine/band press or wall slide; pike→half-kneeling press or push-up regression; ring support→front support or scapular prep.',
      affected_items: ordered.map((o) => o.name),
      meta: { symptom_flags: true },
    })
  }

  let hasHighDensity = false
  for (const { item, exerciseId, name, slug } of ordered) {
    const dosage = dosageByExercise.get(String(exerciseId))
    const restSeconds = Number(item.rest_seconds ?? item.restSeconds ?? dosage?.default_rest_seconds) || 0
    const volume = countCapacityVolume(item, dosage)
    const rpe = itemRpe(item, dosage)
    const skillLevel = String(exerciseSkillLevelById.get(String(exerciseId)) ?? '').toUpperCase()
    const isBeginner = skillLevel === 'EARLY_STAGE' || skillLevel === 'BEGINNER'

    if (restSeconds > 0 && restSeconds < CAPACITY_SHORT_REST_SECONDS && volume >= 12 && rpe >= CAPACITY_MIN_RPE_STRENGTH) {
      hasHighDensity = true
    }

    if (slug === INCLINE_PUSH_UP_SLUG && CAPACITY_PUSH_SAG_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_push_incline_sag',
        severity: 'recommendation',
        message: `${name}: raise the incline, reduce reps, or return to front support hold when hips sag or elbows flare.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === PUSH_UP_SLUG && CAPACITY_PUSH_QUALITY_BREAK_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_push_pushup_quality_stop',
        severity: 'warning',
        message: `${name}: end the set — do not finish sloppy reps for Capacity.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === PUSH_UP_SLUG && CAPACITY_PUSH_PLANK_FAIL_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_push_pushup_plank_regress',
        severity: 'recommendation',
        message: `${name}: use Incline Push-Up or Tempo Incline Push-Up when plank line cannot be maintained.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === TEMPO_ECCENTRIC_PUSH_UP_SLUG && (CAPACITY_PUSH_ECCENTRIC_SORENESS_PATTERN.test(watchText) || WRIST_PAIN_PATTERN.test(watchText) || SHOULDER_PAIN_PATTERN.test(watchText))) {
      findings.push({
        rule_key: 'capacity_push_eccentric_volume',
        severity: 'warning',
        message: `${name}: eccentric push volume may be too high — reduce tempo, range, reps, or incline.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === FLOOR_PRESS_SLUG && CAPACITY_PUSH_SETUP_FAIL_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_push_floor_press_setup',
        severity: 'recommendation',
        message: `${name}: use lighter load, coach handoff, or push-up regression when setup is unsafe.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if ((slug === FLOOR_PRESS_SLUG || slug === BENCH_PRESS_SLUG) && CAPACITY_PUSH_SHOULDER_BOTTOM_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_push_press_shoulder_pain',
        severity: 'recommendation',
        message: `${name}: reduce range, use neutral grip, use floor press, or substitute incline push-up when shoulder pain appears at bottom.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (
      slug === BENCH_PRESS_SLUG
      && (isYouthAthlete || YOUTH_ATHLETE_CAPACITY_PATTERN.test(watchText))
      && (CAPACITY_SQUAT_YOUTH_LOAD_PATTERN.test(watchText) || HEAVY_LOAD_PATTERN.test(watchText))
    ) {
      findings.push({
        rule_key: 'capacity_push_bench_youth_load',
        severity: 'recommendation',
        message: `${name}: youth bench press requires coach confirmation — sound technique, appropriate load, no max-lift intent, safe spot/setup.`,
        affected_items: [name],
        meta: { slug, youth_flags: true },
      })
    }

    if (slug === HALF_KNEELING_PRESS_SLUG && CAPACITY_PUSH_RIB_FLARE_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_push_overhead_rib_flare',
        severity: 'recommendation',
        message: `${name}: reduce load, use landmine/band press, or return to core/overhead prep when rib flare or low-back extension appears.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === PIKE_PUSH_UP_SLUG && !slugsInWorkout.has(PUSH_UP_SLUG) && !slugsInWorkout.has(INCLINE_PUSH_UP_SLUG)) {
      findings.push({
        rule_key: 'capacity_push_pike_prerequisite',
        severity: 'warning',
        message: `${name}: pike push-ups require standard push-up strength and shoulder control — use incline push-up or pike hold first.`,
        affected_items: [name],
        meta: { slug },
      })
    }

    if (slug === PIKE_PUSH_UP_SLUG && CAPACITY_PUSH_BOX_PIKE_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_push_box_pike_prerequisite',
        severity: 'warning',
        message: `${name}: box pike increases vertical load — regress to floor pike or hands-elevated pike first.`,
        affected_items: [name],
        meta: { slug },
      })
    }

    if (slug === DIP_SUPPORT_SLUG && (CAPACITY_PUSH_PARALLEL_BAR_FAIL_PATTERN.test(watchText) || (isBeginner && !slugsInWorkout.has(PUSH_UP_SLUG) && !slugsInWorkout.has(PIKE_PUSH_UP_SLUG)))) {
      findings.push({
        rule_key: 'capacity_push_support_prerequisite',
        severity: 'recommendation',
        message: `${name}: use box-assisted support, parallel bars, or front support before rings when support is unstable or push-up/pike competency is missing.`,
        affected_items: [name],
        meta: { slug, symptom_flags: CAPACITY_PUSH_PARALLEL_BAR_FAIL_PATTERN.test(watchText), beginner: isBeginner },
      })
    }

    if (slug === DIP_SUPPORT_SLUG && CAPACITY_PUSH_RING_FAULT_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_push_ring_support_stop',
        severity: 'warning',
        message: `${name}: end the hold and regress to assisted or bar support when rings drift, shoulders shrug, or elbows bend.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }
  }

  if (hasHighDensity) {
    findings.push({
      rule_key: 'capacity_push_short_rest_density',
      severity: 'warning',
      message: 'This may be Sustained Capacity rather than Capacity. Confirm intent — push strength needs full rest between sets.',
      affected_items: ordered.map((o) => o.name),
      meta: {},
    })
  }

  return findings
}

const CAPACITY_PULL_SLUGS = new Set([
  'ring-row-trx-row',
  'inverted-row',
  'one-arm-dumbbell-row',
  'band-cable-row',
  'assisted-pull-up',
  'eccentric-pull-up-chin-up-negative',
  'pull-up-chin-up',
  'scapular-pull-up',
  'dead-hang-active-hang',
  'rope-climb-foot-lock-pull-towel-pull',
])
const RING_ROW_SLUG = 'ring-row-trx-row'
const INVERTED_ROW_SLUG = 'inverted-row'
const ONE_ARM_ROW_SLUG = 'one-arm-dumbbell-row'
const BAND_CABLE_ROW_SLUG = 'band-cable-row'
const ECCENTRIC_PULL_SLUG = 'eccentric-pull-up-chin-up-negative'
const SCAPULAR_PULL_UP_SLUG = 'scapular-pull-up'
const ROPE_CLIMB_SLUG = 'rope-climb-foot-lock-pull-towel-pull'
const HORIZONTAL_PULL_FOUNDATION_SLUGS = new Set([
  RING_ROW_SLUG,
  INVERTED_ROW_SLUG,
  BAND_CABLE_ROW_SLUG,
  ONE_ARM_ROW_SLUG,
])
const CAPACITY_PULL_BODY_SAG_PATTERN = /body\s*sag|hip\s*sag|hips?\s*sag|sagging/i
const CAPACITY_PULL_UNSAFE_BAR_PATTERN = /unstable\s*bar|unsafe\s*rack|bar\s*setup\s*unsafe|setup\s*unstable|rack\s*unstable/i
const CAPACITY_PULL_TORSO_ROTATION_PATTERN = /torso\s*rotat|trunk\s*rotat|twist(s|ing)?\s*open|rotates?\s*open/i
const CAPACITY_PULL_UNSAFE_ANCHOR_PATTERN = /unsafe\s*anchor|anchor\s*fail|band\s*snap|anchor\s*unsafe/i
const CAPACITY_PULL_KIPPING_PATTERN = /kipp(ing)?|swing(ing)?|leg\s*kick|kick(ing)?|bounce|rebound/i
const CAPACITY_PULL_CANNOT_LOWER_PATTERN = /cannot\s*lower|incomplete\s*lower|no\s*control\s*on\s*lower|cannot\s*control\s*lower/i
const CAPACITY_PULL_FAST_ECCENTRIC_PATTERN = /drop(s|ped)?\s*quick|less\s*than\s*3|fast\s*lower|crash(es|ing)?\s*down|drops?\s*after\s*top/i
const CAPACITY_PULL_PARTIAL_REP_PATTERN = /partial\s*rep|cannot\s*complete\s*strict|incomplete\s*range|not\s*full\s*range/i
const CAPACITY_PULL_ELBOW_BEND_SCAPULAR_PATTERN = /elbow\s*bend|mini\s*pull.?up|partial\s*pull|elbows?\s*bend/i
const CAPACITY_PULL_HANG_STOP_PATTERN = /shoulder\s*pain|numbness|tingling|grip\s*slip/i
const CAPACITY_PULL_GRIP_FAILURE_PATTERN = /grip\s*fail|hold\s*to\s*failure|cannot\s*hold|grip\s*slipping|grip\s*fail/i
const CAPACITY_PULL_FOOTLOCK_PATTERN = /foot\s*lock\s*fail|no\s*foot.?lock|footlock\s*not|cannot\s*lock\s*feet|foot\s*lock\s*slip/i
const CAPACITY_PULL_ROPE_SETUP_PATTERN = /no\s*mat|no\s*supervision|unsafe\s*descent|cannot\s*descend|no\s*safe\s*descent/i
const CAPACITY_PULL_TISSUE_PAIN_PATTERN = /shoulder\s*pain|elbow\s*pain|wrist\s*pain|hand\s*pain/i

/** Pull / hang / grip Capacity cluster checks. Pure helper for tests. */
function analyzeCapacityPullReadiness(items, ctx) {
  const {
    slugByExercise,
    dosageByExercise,
    blockMeta = [],
    capacityBlockIndex = 0,
    exerciseSkillLevelById = new Map(),
    draft = {},
  } = ctx

  const findings = []
  const watchText = draftWatchText(draft)
  const ordered = []

  for (const item of items ?? []) {
    const exerciseId = Number(item.exercise_id ?? item.exerciseId)
    if (!exerciseId) continue
    const name = item.exercise_name ?? item.exerciseName ?? String(exerciseId)
    const slug = exerciseSlug(item, slugByExercise)
    if (!slug || !CAPACITY_PULL_SLUGS.has(slug)) continue
    ordered.push({ item, exerciseId, name, slug })
  }

  if (ordered.length === 0) return findings

  const slugsInWorkout = new Set(ordered.map((o) => o.slug))
  for (const meta of blockMeta ?? []) {
    for (const blockItem of meta.block?.items ?? []) {
      const slug = exerciseSlug(blockItem, slugByExercise)
      if (slug) slugsInWorkout.add(slug)
    }
  }

  let skillAfterCapacity = false
  for (let j = capacityBlockIndex + 1; j < blockMeta.length; j++) {
    if (blockMeta[j]?.phaseKey === MOVEMENT_INTELLIGENCE) {
      skillAfterCapacity = true
      break
    }
  }

  if (skillAfterCapacity) {
    findings.push({
      rule_key: 'capacity_pull_before_skill',
      severity: 'warning',
      message:
        'Grip and pulling fatigue may reduce skill safety. Confirm strength-priority session.',
      affected_items: ordered.map((o) => o.name),
      meta: { capacity_before_skill: true },
    })
  }

  const isYouthAthlete = ordered.some(({ exerciseId }) => {
    const level = String(exerciseSkillLevelById.get(String(exerciseId)) ?? '').toUpperCase()
    return level === 'EARLY_STAGE' || level === 'BEGINNER'
  })

  const hasHorizontalFoundation = [...HORIZONTAL_PULL_FOUNDATION_SLUGS].some((s) => slugsInWorkout.has(s))

  if (CAPACITY_PULL_TISSUE_PAIN_PATTERN.test(watchText)) {
    findings.push({
      rule_key: 'capacity_pull_tissue_substitution',
      severity: 'recommendation',
      message:
        'Pain warning signs — substitute: pull-up→assisted pull-up or row; eccentric→band/cable row; dead hang→feet-assisted active hang; rope climb→rope foot-lock practice or towel row; inverted row→TRX/ring row at easier angle.',
      affected_items: ordered.map((o) => o.name),
      meta: { symptom_flags: true },
    })
  }

  let hasHighDensity = false
  for (const { item, exerciseId, name, slug } of ordered) {
    const dosage = dosageByExercise.get(String(exerciseId))
    const restSeconds = Number(item.rest_seconds ?? item.restSeconds ?? dosage?.default_rest_seconds) || 0
    const volume = countCapacityVolume(item, dosage)
    const rpe = itemRpe(item, dosage)
    const skillLevel = String(exerciseSkillLevelById.get(String(exerciseId)) ?? '').toUpperCase()
    const isBeginner = skillLevel === 'EARLY_STAGE' || skillLevel === 'BEGINNER'

    if (restSeconds > 0 && restSeconds < CAPACITY_SHORT_REST_SECONDS && volume >= 12 && rpe >= CAPACITY_MIN_RPE_STRENGTH) {
      hasHighDensity = true
    }

    if (slug === RING_ROW_SLUG && CAPACITY_PULL_BODY_SAG_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_pull_ring_row_sag',
        severity: 'recommendation',
        message: `${name}: increase body angle, reduce reps, or regress to band/cable row when body sags.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === INVERTED_ROW_SLUG && CAPACITY_PULL_UNSAFE_BAR_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_pull_inverted_row_unsafe',
        severity: 'error',
        message: `${name}: inverted rows require a secure bar/rack setup.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === ONE_ARM_ROW_SLUG && CAPACITY_PULL_TORSO_ROTATION_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_pull_db_row_rotation',
        severity: 'recommendation',
        message: `${name}: reduce load, add bench support, or use cable row when torso rotates.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === BAND_CABLE_ROW_SLUG && CAPACITY_PULL_UNSAFE_ANCHOR_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_pull_band_anchor_unsafe',
        severity: 'error',
        message: `${name}: do not perform band/cable row without secure anchor.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === ASSISTED_PULL_UP_SLUG && CAPACITY_PULL_KIPPING_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_pull_assisted_kipping',
        severity: 'warning',
        message: `${name}: assistance should support controlled strict pulling, not rebound or kipping reps.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === ASSISTED_PULL_UP_SLUG && CAPACITY_PULL_CANNOT_LOWER_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_pull_assisted_lower',
        severity: 'recommendation',
        message: `${name}: increase assistance or use ring rows when lowering is uncontrolled.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (
      slug === ECCENTRIC_PULL_SLUG
      && (isYouthAthlete || isBeginner || YOUTH_ATHLETE_CAPACITY_PATTERN.test(watchText))
    ) {
      findings.push({
        rule_key: 'capacity_pull_eccentric_beginner',
        severity: 'warning',
        message: `${name}: eccentric pull-ups create high tissue stress — use assisted pull-up or ring row first.`,
        affected_items: [name],
        meta: { slug, youth_flags: isYouthAthlete, beginner: isBeginner },
      })
    }

    if (slug === ECCENTRIC_PULL_SLUG && CAPACITY_PULL_FAST_ECCENTRIC_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_pull_eccentric_fast',
        severity: 'recommendation',
        message: `${name}: increase assistance or reduce range until controlled 3+ second lowering is possible.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === PULL_UP_SLUG && (CAPACITY_PULL_PARTIAL_REP_PATTERN.test(watchText) || CAPACITY_PULL_CANNOT_LOWER_PATTERN.test(watchText))) {
      findings.push({
        rule_key: 'capacity_pull_pullup_strict',
        severity: 'recommendation',
        message: `${name}: use assisted pull-up, eccentric pull-up, or ring row when strict full-range reps are not available.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === PULL_UP_SLUG && !hasHorizontalFoundation && !slugsInWorkout.has(ASSISTED_PULL_UP_SLUG) && !slugsInWorkout.has(ECCENTRIC_PULL_SLUG)) {
      findings.push({
        rule_key: 'capacity_pull_pullup_prerequisite',
        severity: 'warning',
        message: `${name}: build horizontal row and assisted vertical pulling before strict pull-ups/chin-ups.`,
        affected_items: [name],
        meta: { slug },
      })
    }

    if (slug === PULL_UP_SLUG && CAPACITY_PULL_KIPPING_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_pull_pullup_kipping',
        severity: 'recommendation',
        message: `${name}: kipping or swinging is not strict Capacity — classify separately or regress to assisted pull-up.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === SCAPULAR_PULL_UP_SLUG && CAPACITY_PULL_ELBOW_BEND_SCAPULAR_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_pull_scapular_elbow',
        severity: 'warning',
        message: `${name}: scapular pull-up should be straight-arm shoulder-blade control — no elbow bend.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === DEAD_HANG_SLUG && CAPACITY_PULL_HANG_STOP_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_pull_hang_stop',
        severity: 'warning',
        message: `${name}: end hanging and regress to feet-assisted active hang or band pulldown when shoulder pain, numbness, or tingling appears.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (
      (slug === DEAD_HANG_SLUG || slug === ROPE_CLIMB_SLUG)
      && CAPACITY_PULL_GRIP_FAILURE_PATTERN.test(watchText)
      && skillAfterCapacity
    ) {
      findings.push({
        rule_key: 'capacity_pull_grip_failure_before_skill',
        severity: 'warning',
        message: `${name}: grip failure can compromise skill safety — reduce volume or move hang/grip work after skill.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (
      slug === ROPE_CLIMB_SLUG
      && (CAPACITY_PULL_FOOTLOCK_PATTERN.test(watchText) || (isBeginner && !hasHorizontalFoundation))
    ) {
      findings.push({
        rule_key: 'capacity_pull_rope_footlock',
        severity: 'warning',
        message: `${name}: teach foot-lock from seated/low position before climbing or high rope pulls.`,
        affected_items: [name],
        meta: { slug, beginner: isBeginner, symptom_flags: CAPACITY_PULL_FOOTLOCK_PATTERN.test(watchText) },
      })
    }

    if (slug === ROPE_CLIMB_SLUG && CAPACITY_PULL_GRIP_FAILURE_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_pull_rope_grip_failure',
        severity: 'warning',
        message: `${name}: end set immediately — do not continue grip-based climbing when descent cannot be controlled.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === ROPE_CLIMB_SLUG && CAPACITY_PULL_ROPE_SETUP_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_pull_rope_setup',
        severity: 'error',
        message: `${name}: rope-climb capacity requires safe setup, mat, supervision, and a planned descent.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }
  }

  if (hasHighDensity) {
    findings.push({
      rule_key: 'capacity_pull_short_rest_density',
      severity: 'warning',
      message: 'This may be Sustained Capacity rather than Capacity. Confirm intent — pull strength needs full rest between sets.',
      affected_items: ordered.map((o) => o.name),
      meta: {},
    })
  }

  return findings
}

const CAPACITY_CARRY_SLUGS = new Set([
  'farmer-carry',
  'suitcase-carry',
  'front-rack-carry',
  'bear-hug-sandbag-carry',
  'zercher-carry',
  'overhead-carry',
  'pallof-press-pallof-hold',
  'tall-kneeling-cable-band-chop',
])
const CAPACITY_CARRY_WALK_SLUGS = new Set([
  'farmer-carry',
  'suitcase-carry',
  'front-rack-carry',
  'bear-hug-sandbag-carry',
  'zercher-carry',
  'overhead-carry',
])
const FARMER_CARRY_SLUG = 'farmer-carry'
const SUITCASE_CARRY_SLUG = 'suitcase-carry'
const FRONT_RACK_CARRY_SLUG = 'front-rack-carry'
const BEAR_HUG_CARRY_SLUG = 'bear-hug-sandbag-carry'
const ZERCHER_CARRY_SLUG = 'zercher-carry'
const PALLOF_SLUG = 'pallof-press-pallof-hold'
const CHOP_SLUG = 'tall-kneeling-cable-band-chop'
const CAPACITY_CARRY_SKILL_AFTER_SLUGS = new Set([
  ...TUMBLING_SKILL_SLUGS,
  ...TUMBLING_SKILL_PREREQ_SLUGS,
  ...HANDSTAND_SKILL_SLUGS,
  'handstand-hold',
  DEAD_HANG_SLUG,
  PULL_UP_SLUG,
  'rope-climb-foot-lock-pull-towel-pull',
  'assisted-pull-up',
])
const CAPACITY_CARRY_GRIP_HANG_SLUGS = new Set([
  DEAD_HANG_SLUG,
  PULL_UP_SLUG,
  'assisted-pull-up',
  'eccentric-pull-up-chin-up-negative',
  'rope-climb-foot-lock-pull-towel-pull',
  'scapular-pull-up',
])
const CAPACITY_CARRY_FARMER_FAULT_PATTERN = /shoulder\s*shrug|grip\s*slip|posture\s*collapse|trunk\s*collapse|rounded\s*back/i
const CAPACITY_CARRY_LATERAL_LEAN_PATTERN = /lateral\s*lean|lean(s|ing)?\s*(away|toward)|side\s*bend|cannot\s*resist\s*side/i
const CAPACITY_CARRY_RIB_FLARE_PATTERN = /rib\s*flare|low\s*back\s*arch|breath.?hold|valsalva/i
const CAPACITY_CARRY_FOLD_PATTERN = /fold(s|ing)?\s*forward|forward\s*fold|trunk\s*collapse|bag\s*slides/i
const CAPACITY_CARRY_ZERCHER_FAULT_PATTERN = /elbow\s*pain|elbow\s*numb|load\s*drift|drifts?\s*away/i
const CAPACITY_CARRY_OVERHEAD_DRIFT_PATTERN = /arm\s*drift|ribs?\s*flare|low\s*back\s*arch|over\s*arch/i
const CAPACITY_CARRY_PALLof_ROTATION_PATTERN = /rotat(es|ing)?\s*toward|twist(s|ing)?\s*toward|turns?\s*toward\s*anchor/i
const CAPACITY_CARRY_ANCHOR_UNSAFE_PATTERN = /unsafe\s*anchor|anchor\s*fail|band\s*slip|cable\s*detach|unsecured\s*anchor/i
const CAPACITY_CARRY_CHOP_HIP_SHIFT_PATTERN = /hip\s*shift|hips?\s*rotate|low\s*back\s*rotat/i
const CAPACITY_CARRY_TISSUE_PAIN_PATTERN = /shoulder\s*pain|elbow\s*pain|wrist\s*pain|hip\s*pain|back\s*pain|pressure\s*symptom|pelvic\s*floor/i
const CAPACITY_CARRY_GRIP_FAIL_PATTERN = /grip\s*fail|grip\s*slip|cannot\s*hold\s*load|drops?\s*weight/i
const CAPACITY_CARRY_MAX_YARDS = 40
const CAPACITY_CARRY_MAX_WORK_SECONDS = 45

/** Carry / trunk / loaded-bracing Capacity cluster checks. Pure helper for tests. */
function analyzeCapacityCarryReadiness(items, ctx) {
  const {
    slugByExercise,
    dosageByExercise,
    blockMeta = [],
    capacityBlockIndex = 0,
    exerciseSkillLevelById = new Map(),
    draft = {},
  } = ctx

  const findings = []
  const watchText = draftWatchText(draft)
  const ordered = []

  for (const item of items ?? []) {
    const exerciseId = Number(item.exercise_id ?? item.exerciseId)
    if (!exerciseId) continue
    const name = item.exercise_name ?? item.exerciseName ?? String(exerciseId)
    const slug = exerciseSlug(item, slugByExercise)
    if (!slug || !CAPACITY_CARRY_SLUGS.has(slug)) continue
    ordered.push({ item, exerciseId, name, slug })
  }

  if (ordered.length === 0) return findings

  let skillAfterCapacity = false
  for (let j = capacityBlockIndex + 1; j < blockMeta.length; j++) {
    const key = blockMeta[j]?.phaseKey
    if (key === MOVEMENT_INTELLIGENCE || key === OUTPUT) {
      for (const blockItem of blockMeta[j]?.block?.items ?? []) {
        const slug = exerciseSlug(blockItem, slugByExercise) ?? ''
        const name = String(blockItem.exercise_name ?? blockItem.exerciseName ?? '')
        if (CAPACITY_CARRY_SKILL_AFTER_SLUGS.has(slug)) {
          skillAfterCapacity = true
          break
        }
        if (key === OUTPUT && (SPEED_OUTPUT_SLUG_PATTERN.test(slug) || SPEED_OUTPUT_SLUG_PATTERN.test(name))) {
          skillAfterCapacity = true
          break
        }
      }
    }
    if (skillAfterCapacity) break
  }

  if (skillAfterCapacity) {
    findings.push({
      rule_key: 'capacity_carry_before_skill',
      severity: 'warning',
      message:
        'Loaded bracing, grip, and shoulder fatigue may reduce skill quality. Confirm strength-priority session.',
      affected_items: ordered.map((o) => o.name),
      meta: { capacity_before_skill: true },
    })
  }

  let gripHangBeforeCapacity = false
  for (let j = 0; j < capacityBlockIndex; j++) {
    for (const blockItem of blockMeta[j]?.block?.items ?? []) {
      const slug = exerciseSlug(blockItem, slugByExercise)
      if (slug && CAPACITY_CARRY_GRIP_HANG_SLUGS.has(slug)) {
        gripHangBeforeCapacity = true
        break
      }
    }
    if (gripHangBeforeCapacity) break
  }

  if (gripHangBeforeCapacity && ordered.some((o) => CAPACITY_CARRY_WALK_SLUGS.has(o.slug))) {
    findings.push({
      rule_key: 'capacity_carry_after_grip_hang',
      severity: 'warning',
      message: 'Grip fatigue may compromise carry safety. Reduce load or move carries earlier/later in the session.',
      affected_items: ordered.filter((o) => CAPACITY_CARRY_WALK_SLUGS.has(o.slug)).map((o) => o.name),
      meta: { grip_fatigue: true },
    })
  }

  const isYouthAthlete = ordered.some(({ exerciseId }) => {
    const level = String(exerciseSkillLevelById.get(String(exerciseId)) ?? '').toUpperCase()
    return level === 'EARLY_STAGE' || level === 'BEGINNER'
  })

  if (CAPACITY_CARRY_TISSUE_PAIN_PATTERN.test(watchText)) {
    findings.push({
      rule_key: 'capacity_carry_tissue_substitution',
      severity: 'recommendation',
      message:
        'Symptom warning signs — substitute: farmer→lighter farmer or goblet carry; suitcase→Pallof hold; front-rack→bear-hug; Zercher→bear-hug; overhead→front-rack or half-kneeling press; Pallof/chop→dead bug or supported anti-rotation hold.',
      affected_items: ordered.map((o) => o.name),
      meta: { symptom_flags: true },
    })
  }

  let hasHighDensity = false
  for (const { item, exerciseId, name, slug } of ordered) {
    const dosage = dosageByExercise.get(String(exerciseId))
    const restSeconds = Number(item.rest_seconds ?? item.restSeconds ?? dosage?.default_rest_seconds) || 0
    const volume = countCapacityVolume(item, dosage)
    const rpe = itemRpe(item, dosage)
    const workSeconds = Number(item.work_seconds ?? item.workSeconds ?? dosage?.default_work_seconds) || 0
    const totalYards = parseTotalDistanceYards(item, dosage)
    const skillLevel = String(exerciseSkillLevelById.get(String(exerciseId)) ?? '').toUpperCase()
    const isBeginner = skillLevel === 'EARLY_STAGE' || skillLevel === 'BEGINNER'

    if (restSeconds > 0 && restSeconds < CAPACITY_SHORT_REST_SECONDS && volume >= 12 && rpe >= CAPACITY_MIN_RPE_STRENGTH) {
      hasHighDensity = true
    }

    if (
      CAPACITY_CARRY_WALK_SLUGS.has(slug)
      && restSeconds > 0
      && restSeconds < CAPACITY_SHORT_REST_SECONDS
      && (totalYards > CAPACITY_CARRY_MAX_YARDS || workSeconds > CAPACITY_CARRY_MAX_WORK_SECONDS)
    ) {
      findings.push({
        rule_key: 'capacity_carry_fitness_distance',
        severity: 'recommendation',
        message: `${name}: long distance or timed carry with short rest may be Sustained Capacity rather than Capacity. Confirm intent.`,
        affected_items: [name],
        meta: { slug, total_yards: totalYards, work_seconds: workSeconds, rest_seconds: restSeconds },
      })
    }

    if (slug === FARMER_CARRY_SLUG && CAPACITY_CARRY_FARMER_FAULT_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_carry_farmer_posture',
        severity: 'recommendation',
        message: `${name}: reduce load, distance, or use shorter sets when shoulder shrugging, grip slipping, or posture collapses.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === SUITCASE_CARRY_SLUG && CAPACITY_CARRY_LATERAL_LEAN_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_carry_suitcase_lean',
        severity: 'recommendation',
        message: `${name}: reduce load or shorten distance — the goal is resisting side bend, not leaning to survive.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === FRONT_RACK_CARRY_SLUG && CAPACITY_CARRY_RIB_FLARE_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_carry_front_rack_rib_flare',
        severity: 'recommendation',
        message: `${name}: reduce load, switch to goblet/bear-hug carry, or shorten distance when ribs flare, low back arches, or breath-holding appears.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === BEAR_HUG_CARRY_SLUG && CAPACITY_CARRY_FOLD_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_carry_bear_hug_fold',
        severity: 'recommendation',
        message: `${name}: reduce bag weight/size, elevate pickup height, or shorten distance when the athlete folds forward.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === ZERCHER_CARRY_SLUG && CAPACITY_CARRY_ZERCHER_FAULT_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_carry_zercher_elbow',
        severity: 'recommendation',
        message: `${name}: use bear-hug sandbag carry or front-rack carry when elbow pain, numbness, or load drift appears.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (
      slug === OVERHEAD_CARRY_SLUG
      && (isBeginner || isYouthAthlete || OVERHEAD_MOBILITY_PATTERN.test(watchText))
    ) {
      findings.push({
        rule_key: 'capacity_carry_overhead_prerequisite',
        severity: 'warning',
        message: `${name}: use half-kneeling press, front-rack carry, or farmer carry first when overhead mobility or shoulder control is limited.`,
        affected_items: [name],
        meta: { slug, skill_level: isBeginner ? 'BEGINNER' : undefined, symptom_flags: OVERHEAD_MOBILITY_PATTERN.test(watchText) },
      })
    }

    if (slug === OVERHEAD_CARRY_SLUG && CAPACITY_CARRY_OVERHEAD_DRIFT_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_carry_overhead_quality_stop',
        severity: 'error',
        message: `${name}: end overhead carry and regress to lighter hold or front-rack carry when rib flare, arm drift, or low-back arch appears.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === PALLOF_SLUG && CAPACITY_CARRY_PALLof_ROTATION_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_carry_pallof_rotation',
        severity: 'recommendation',
        message: `${name}: reduce resistance, shorten lever, or use Pallof hold when the torso rotates toward the anchor.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if ((slug === PALLOF_SLUG || slug === CHOP_SLUG) && CAPACITY_CARRY_ANCHOR_UNSAFE_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_carry_anchor_unsafe',
        severity: 'error',
        message: `${name}: do not perform band/cable trunk work without a secure anchor.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === CHOP_SLUG && CAPACITY_CARRY_CHOP_HIP_SHIFT_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_carry_chop_hip_shift',
        severity: 'recommendation',
        message: `${name}: reduce load/range or regress to Pallof hold when hips shift or low back rotates.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (CAPACITY_CARRY_WALK_SLUGS.has(slug) && CAPACITY_CARRY_GRIP_FAIL_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_carry_grip_not_target',
        severity: 'recommendation',
        message: `${name}: use straps only if grip is not the target, or reduce load/distance when grip fails before posture stimulus.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }
  }

  if (hasHighDensity) {
    findings.push({
      rule_key: 'capacity_carry_short_rest_density',
      severity: 'warning',
      message: 'This may be Sustained Capacity rather than Capacity. Confirm intent — loaded bracing needs full rest between sets.',
      affected_items: ordered.map((o) => o.name),
      meta: {},
    })
  }

  return findings
}

const CAPACITY_TISSUE_SLUGS = new Set([
  'spanish-squat-isometric',
  'split-squat-isometric-hold',
  COPENHAGEN_SLUG,
  'tibialis-raise',
  'seated-soleus-raise-bent-knee-calf-raise',
  'wrist-forearm-capacity-series',
])
const SPANISH_SQUAT_ISO_SLUG = 'spanish-squat-isometric'
const SPLIT_SQUAT_ISO_SLUG = 'split-squat-isometric-hold'
const TIBIALIS_RAISE_SLUG = 'tibialis-raise'
const SOLEUS_RAISE_SLUG = 'seated-soleus-raise-bent-knee-calf-raise'
const WRIST_FOREARM_SERIES_SLUG = 'wrist-forearm-capacity-series'
const CAPACITY_TISSUE_HAND_SUPPORT_AFTER_SLUGS = new Set([
  ...CAPACITY_CARRY_SKILL_AFTER_SLUGS,
  'dip-support-ring-support-hold',
  'ring-row-trx-row',
])
const CAPACITY_TISSUE_ELASTIC_OUTPUT_SLUGS = new Set([
  ...POGO_ELASTIC_SLUGS,
  LOW_POGOS_SLUG,
  'single-leg-pogo-hold-to-hop',
])
const CAPACITY_TISSUE_JUMP_OUTPUT_PATTERN = /jump|bound|hop|plyo|pogo|sprint|acceleration|fly/i
const CAPACITY_TISSUE_SPANISH_ANCHOR_UNSAFE_PATTERN = /unsafe\s*anchor|anchor\s*fail|band\s*slip|strap\s*slip|unsecured\s*anchor|band\s*snap/i
const CAPACITY_TISSUE_ANTERIOR_KNEE_PATTERN = /anterior\s*knee|patellar|sharp\s*knee|knee\s*pain\s*worsen|knee\s*pain\s*increase/i
const CAPACITY_TISSUE_SPLIT_ISO_FAULT_PATTERN = /knee\s*valgus|knees?\s*cave|knees?\s*collapse|balance\s*loss|cannot\s*balance|breath\s*hold|breath-hold|holding\s*breath/i
const CAPACITY_TISSUE_SHIN_PAIN_PATTERN = /shin\s*pain|anterior\s*shin|tibialis\s*pain|sharp\s*shin|anterior\s*ankle/i
const CAPACITY_TISSUE_ACHILLES_PATTERN = /achilles\s*pain|calf\s*pain|achilles\s*worsen|calf\s*strain/i
const CAPACITY_TISSUE_WRIST_STOP_PATTERN = /numbness|tingling|sharp\s*wrist|wrist\s*pain|grip\s*pain\s*worsen|thumb.?side\s*wrist/i
const CAPACITY_TISSUE_PAIN_SUBSTITUTION_PATTERN = /knee\s*pain|groin|adductor|shin|achilles|calf|wrist|forearm|grip\s*pain/i
const CAPACITY_TISSUE_CONSECUTIVE_GRIP_PATTERN = /consecutive\s*day|every\s*day|daily\s*grip|back.?to.?back\s*day|two\s*days?\s*in\s*a\s*row/i
const CAPACITY_TISSUE_HIGH_TIB_VOLUME = 40

/** Tissue Capacity cluster checks (cards 45–50). Pure helper for tests. */
function analyzeCapacityTissueReadiness(items, ctx) {
  const {
    slugByExercise,
    dosageByExercise,
    blockMeta = [],
    capacityBlockIndex = 0,
    exerciseSkillLevelById = new Map(),
    draft = {},
  } = ctx

  const findings = []
  const watchText = draftWatchText(draft)
  const ordered = []

  for (const item of items ?? []) {
    const exerciseId = Number(item.exercise_id ?? item.exerciseId)
    if (!exerciseId) continue
    const name = item.exercise_name ?? item.exerciseName ?? String(exerciseId)
    const slug = exerciseSlug(item, slugByExercise)
    if (!slug || !CAPACITY_TISSUE_SLUGS.has(slug)) continue
    ordered.push({ item, exerciseId, name, slug })
  }

  if (ordered.length === 0) return findings

  let outputAfterCapacity = false
  let elasticOutputAfterCapacity = false
  let jumpSprintOutputAfterCapacity = false
  let handSupportAfterCapacity = false

  for (let j = capacityBlockIndex + 1; j < blockMeta.length; j++) {
    const key = blockMeta[j]?.phaseKey
    if (key === OUTPUT) outputAfterCapacity = true
    if (key === MOVEMENT_INTELLIGENCE || key === OUTPUT) {
      for (const blockItem of blockMeta[j]?.block?.items ?? []) {
        const slug = exerciseSlug(blockItem, slugByExercise) ?? ''
        const itemName = String(blockItem.exercise_name ?? blockItem.exerciseName ?? '')
        if (CAPACITY_TISSUE_HAND_SUPPORT_AFTER_SLUGS.has(slug)) {
          handSupportAfterCapacity = true
        }
        if (/ninja|rope\s*climb|ring\s*support|bar\s*support|handstand/i.test(slug) || /ninja|rope\s*climb|handstand/i.test(itemName)) {
          handSupportAfterCapacity = true
        }
        if (key === OUTPUT) {
          if (CAPACITY_TISSUE_ELASTIC_OUTPUT_SLUGS.has(slug)) elasticOutputAfterCapacity = true
          if (CAPACITY_TISSUE_JUMP_OUTPUT_PATTERN.test(slug) || CAPACITY_TISSUE_JUMP_OUTPUT_PATTERN.test(itemName)) {
            jumpSprintOutputAfterCapacity = true
          }
        }
      }
    }
  }

  if (outputAfterCapacity) {
    findings.push({
      rule_key: 'capacity_tissue_before_output',
      severity: 'warning',
      message:
        'Hard tissue-capacity work may reduce sprint, jump, tumbling, or grip quality. Confirm primer vs capacity intent.',
      affected_items: ordered.map((o) => o.name),
      meta: { capacity_before_output: true },
    })
  }

  if (CAPACITY_TISSUE_PAIN_SUBSTITUTION_PATTERN.test(watchText)) {
    findings.push({
      rule_key: 'capacity_tissue_pain_substitution',
      severity: 'recommendation',
      message:
        'Pain flags — substitute: anterior knee → shallow Spanish squat, box squat hold, or split squat iso; groin/adductor → adductor squeeze, side plank, adductor rockback; shin → seated toe raise or lower-volume tibialis raise; Achilles/calf → isometric calf hold or lower-range seated soleus raise; wrist/forearm → wrist ROM, light band work, handles for push support.',
      affected_items: ordered.map((o) => o.name),
      meta: { symptom_flags: true },
    })
  }

  if (/daily|every\s*day|hard\s*intensity/i.test(watchText)) {
    findings.push({
      rule_key: 'capacity_tissue_daily_hard',
      severity: 'warning',
      message: 'Daily hard tissue-capacity work can irritate tissues. Use low-intensity daily exposure only if tolerated.',
      affected_items: ordered.map((o) => o.name),
      meta: { tissue_flags: true },
    })
  }

  if (CAPACITY_TISSUE_CONSECUTIVE_GRIP_PATTERN.test(watchText)
    && ordered.some((o) => o.slug === WRIST_FOREARM_SERIES_SLUG)) {
    findings.push({
      rule_key: 'capacity_tissue_grip_consecutive_days',
      severity: 'warning',
      message: 'Grip and forearm tissues need recovery. Reduce load, volume, or intensity.',
      affected_items: ordered.filter((o) => o.slug === WRIST_FOREARM_SERIES_SLUG).map((o) => o.name),
      meta: { tissue_flags: true },
    })
  }

  if (handSupportAfterCapacity && ordered.some((o) => o.slug === WRIST_FOREARM_SERIES_SLUG)) {
    findings.push({
      rule_key: 'capacity_tissue_wrist_before_skill',
      severity: 'warning',
      message: 'Wrist/grip fatigue may compromise hand support or hanging safety.',
      affected_items: ordered.filter((o) => o.slug === WRIST_FOREARM_SERIES_SLUG).map((o) => o.name),
      meta: { capacity_before_skill: true },
    })
  }

  const isYouthAthlete = ordered.some(({ exerciseId }) => {
    const level = String(exerciseSkillLevelById.get(String(exerciseId)) ?? '').toUpperCase()
    return level === 'EARLY_STAGE' || level === 'BEGINNER'
  })

  for (const { item, exerciseId, name, slug } of ordered) {
    const dosage = dosageByExercise.get(String(exerciseId))
    const sets = Number(item.sets ?? dosage?.default_sets) || 1
    const reps = Number(item.reps ?? dosage?.default_reps) || 0
    const volume = sets * (reps || 1)
    const skillLevel = String(exerciseSkillLevelById.get(String(exerciseId)) ?? '').toUpperCase()
    const isBeginner = skillLevel === 'EARLY_STAGE' || skillLevel === 'BEGINNER' || isYouthAthlete

    if (slug === SPANISH_SQUAT_ISO_SLUG && CAPACITY_TISSUE_SPANISH_ANCHOR_UNSAFE_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_tissue_spanish_anchor_unsafe',
        severity: 'error',
        message: `${name}: Spanish squat requires secure anchor.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === SPANISH_SQUAT_ISO_SLUG && CAPACITY_TISSUE_ANTERIOR_KNEE_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_tissue_spanish_knee_stop',
        severity: 'warning',
        message: `${name}: reduce depth/intensity or remove from session when anterior knee pain is sharp or worsens after exposure.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === SPLIT_SQUAT_ISO_SLUG && CAPACITY_TISSUE_SPLIT_ISO_FAULT_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_tissue_split_iso_valgus',
        severity: 'recommendation',
        message: `${name}: use support, reduce depth, shorten hold, or regress to split stance when knee valgus, balance loss, or breath-holding appears.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === COPENHAGEN_SLUG && isBeginner) {
      findings.push({
        rule_key: 'capacity_tissue_copenhagen_beginner',
        severity: 'recommendation',
        message: `${name}: use short-lever version or adductor squeeze before long-lever Copenhagen.`,
        affected_items: [name],
        meta: { slug, skill_level: 'BEGINNER' },
      })
    }

    if (slug === COPENHAGEN_SLUG && CAPACITY_SQUAT_GROIN_PAIN_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_tissue_copenhagen_groin_stop',
        severity: 'warning',
        message: `${name}: end adductor loading and regress to adductor squeeze or rockback when sharp groin pain appears.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === TIBIALIS_RAISE_SLUG && CAPACITY_TISSUE_SHIN_PAIN_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_tissue_tibialis_shin_stop',
        severity: 'warning',
        message: `${name}: reduce range, reduce volume, or remove from session when sharp shin or anterior ankle pain appears.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (
      slug === TIBIALIS_RAISE_SLUG
      && jumpSprintOutputAfterCapacity
      && volume >= CAPACITY_TISSUE_HIGH_TIB_VOLUME
    ) {
      findings.push({
        rule_key: 'capacity_tissue_tibialis_before_sprint',
        severity: 'warning',
        message: `${name}: anterior shin fatigue may affect foot strike and lower-leg rhythm before sprint/jump Output.`,
        affected_items: [name],
        meta: { slug, volume, jump_output_after: true },
      })
    }

    if (slug === SOLEUS_RAISE_SLUG && CAPACITY_TISSUE_ACHILLES_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_tissue_soleus_achilles_stop',
        severity: 'warning',
        message: `${name}: reduce load/range/volume and monitor response when Achilles or calf pain worsens.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === SOLEUS_RAISE_SLUG && elasticOutputAfterCapacity) {
      findings.push({
        rule_key: 'capacity_tissue_soleus_before_elastic',
        severity: 'warning',
        message: `${name}: lower-leg fatigue may compromise elastic Output when hard calf/soleus work precedes pogos, sprints, or jumps.`,
        affected_items: [name],
        meta: { slug, elastic_output_after: true },
      })
    }

    if (slug === WRIST_FOREARM_SERIES_SLUG && CAPACITY_TISSUE_WRIST_STOP_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_tissue_wrist_stop',
        severity: 'warning',
        message: `${name}: end wrist/forearm loading and regress when numbness, tingling, sharp wrist pain, or worsening grip pain appears.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }
  }

  return findings
}

/** Capacity phase dose, placement, and progression checks. Pure helper for tests. */
function analyzeCapacityReadiness(items, ctx) {
  const {
    slugByExercise,
    dosageByExercise,
    blockMeta = [],
    capacityBlockIndex = 0,
    exerciseSkillLevelById = new Map(),
    draft = {},
  } = ctx

  const findings = []
  const watchText = draftWatchText(draft)
  const ordered = []

  for (const item of items ?? []) {
    const exerciseId = Number(item.exercise_id ?? item.exerciseId)
    if (!exerciseId) continue
    const name = item.exercise_name ?? item.exerciseName ?? String(exerciseId)
    const slug = exerciseSlug(item, slugByExercise)
    if (!slug) continue
    ordered.push({ item, exerciseId, name, slug, subrole: item.phase_subrole ?? item.phaseSubrole ?? null })
  }

  if (ordered.length === 0) return findings

  let outputAfterCapacity = false
  let maxVelocityAfterCapacity = false
  for (let j = capacityBlockIndex + 1; j < blockMeta.length; j++) {
    const key = blockMeta[j]?.phaseKey
    if (key === OUTPUT) outputAfterCapacity = true
    if (key === OUTPUT) {
      for (const item of blockMeta[j]?.block?.items ?? []) {
        const slug = exerciseSlug(item, slugByExercise)
        if (slug && MAX_VELOCITY_OUTPUT_SLUGS.has(slug)) maxVelocityAfterCapacity = true
      }
    }
  }

  if (outputAfterCapacity) {
    findings.push({
      rule_key: 'capacity_before_output',
      severity: 'warning',
      message: 'Strength work may reduce sprint, jump, tumbling, and reactive Output quality. Confirm strength-priority session.',
      affected_items: ordered.map((o) => o.name),
      meta: { capacity_before_output: true },
    })
  }

  const hasHeavyLower = ordered.some((o) => CAPACITY_HEAVY_LOWER_SUBROLES.has(String(o.subrole ?? '')))
  if (outputAfterCapacity && hasHeavyLower && maxVelocityAfterCapacity) {
    findings.push({
      rule_key: 'capacity_heavy_lower_before_max_velocity',
      severity: 'warning',
      message: 'Heavy lower-body work may compromise high-speed sprint mechanics and tissue readiness before max-velocity Output.',
      affected_items: ordered.filter((o) => CAPACITY_HEAVY_LOWER_SUBROLES.has(String(o.subrole ?? ''))).map((o) => o.name),
      meta: { max_velocity_after_capacity: true },
    })
  }

  const isYouthAthlete = ordered.some(({ exerciseId }) => {
    const level = String(exerciseSkillLevelById.get(String(exerciseId)) ?? '').toUpperCase()
    return level === 'EARLY_STAGE' || level === 'BEGINNER'
  })

  if ((isYouthAthlete || YOUTH_ATHLETE_CAPACITY_PATTERN.test(watchText)) && HEAVY_LOAD_PATTERN.test(watchText)) {
    findings.push({
      rule_key: 'capacity_youth_heavy_load_confirm',
      severity: 'recommendation',
      message:
        'Youth heavy external load requires coach confirmation: technique mastered, load appropriate, qualified supervision, and no max attempts.',
      affected_items: ordered.map((o) => o.name),
      meta: { youth_flags: true },
    })
  }

  if (ECCENTRIC_VOLUME_PATTERN.test(watchText)) {
    findings.push({
      rule_key: 'capacity_eccentric_volume',
      severity: 'warning',
      message: 'Eccentric work has high tissue stress. Limit volume and avoid placing before sprint/jump Output.',
      affected_items: ordered.filter(({ slug }) => ECCENTRIC_CAPACITY_SLUGS.has(slug)).map((o) => o.name),
      meta: { symptom_flags: true },
    })
  }

  if (LIGHT_LOAD_PATTERN.test(watchText)) {
    findings.push({
      rule_key: 'capacity_load_progression',
      severity: 'recommendation',
      message: 'Progress load, reps, tempo, range, or complexity — load may be too light for a strength stimulus.',
      affected_items: ordered.map((o) => o.name),
      meta: { symptom_flags: true },
    })
  }

  if (JOINT_PAIN_PATTERN.test(watchText)) {
    findings.push({
      rule_key: 'capacity_joint_pain_substitution',
      severity: 'recommendation',
      message:
        'Substitute by region: knee — box squat, sled push, split squat iso; hip — hip thrust, step-up; back — goblet squat, floor press; shoulder — floor press, ring row; wrist — handles, floor press; Achilles — soleus raise, calf iso.',
      affected_items: ordered.map((o) => o.name),
      meta: { symptom_flags: true },
    })
  }

  let hasHighDensity = false
  for (const { item, exerciseId, name, slug } of ordered) {
    const dosage = dosageByExercise.get(String(exerciseId))
    const restSeconds = Number(item.rest_seconds ?? item.restSeconds ?? dosage?.default_rest_seconds) || 0
    const volume = countCapacityVolume(item, dosage)
    const rpe = itemRpe(item, dosage)

    if (restSeconds > 0 && restSeconds < CAPACITY_SHORT_REST_SECONDS && volume >= 12 && rpe >= CAPACITY_MIN_RPE_STRENGTH) {
      hasHighDensity = true
    }

    if (slug === NORDIC_SLUG && isYouthAthlete) {
      findings.push({
        rule_key: 'capacity_nordic_beginner',
        severity: 'warning',
        message: 'Nordics are high-intensity eccentric work. Regress to hamstring slider curl or assisted Nordic.',
        affected_items: [name],
        meta: { slug, skill_level: 'BEGINNER' },
      })
    }

    if (slug === PULL_UP_SLUG && isYouthAthlete) {
      findings.push({
        rule_key: 'capacity_pullup_regression',
        severity: 'recommendation',
        message: 'Use assisted pull-up, ring row, or eccentric pull-up before full pull-up/chin-up.',
        affected_items: [name],
        meta: { slug, skill_level: 'BEGINNER' },
      })
    }

    if (slug === DEAD_HANG_SLUG && SHOULDER_PAIN_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_dead_hang_shoulder',
        severity: 'recommendation',
        message: 'Use active hang, scapular pull-up, or supported hang only if pain-free.',
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if ((slug.includes('carry') || slug.includes('farmer') || slug.includes('suitcase') || slug.includes('zercher')) && POSTURE_COLLAPSE_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_carry_posture',
        severity: 'recommendation',
        message: 'Reduce load, distance, or use a simpler carry variation when posture collapses.',
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === OVERHEAD_CARRY_SLUG && OVERHEAD_MOBILITY_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_overhead_carry_mobility',
        severity: 'warning',
        message: 'Use front-rack, suitcase, or farmer carry instead of overhead carry when overhead mobility or shoulder control is limited.',
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === SLED_PUSH_SLUG && SLED_GRIND_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'capacity_sled_posture',
        severity: 'recommendation',
        message: 'Classify as Capacity only if force work is intended; reduce load if movement quality breaks.',
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }
  }

  if (hasHighDensity) {
    findings.push({
      rule_key: 'capacity_short_rest_density',
      severity: 'warning',
      message: 'This may be Sustained Capacity rather than Capacity. Confirm intent — strength work needs full rest between sets.',
      affected_items: ordered.map((o) => o.name),
      meta: {},
    })
  }

  return findings
}

/** Output phase dose, placement, and prerequisite checks. Pure helper for tests. */
function analyzeOutputReadiness(items, ctx) {
  const {
    slugByExercise,
    profileByExercisePhase,
    dosageByExercise,
    blockMeta = [],
    outputBlockIndex = 0,
    skillSlugsInWorkout = new Set(),
    exerciseSkillLevelById = new Map(),
    phaseKey = OUTPUT,
  } = ctx

  const findings = []
  let plyoContacts = 0
  let hasDecelFoundation = false
  let hasCodWithoutReactiveCue = false

  for (let j = 0; j < outputBlockIndex; j++) {
    const priorKey = blockMeta[j]?.phaseKey
    if (priorKey === 'sustained_capacity') {
      findings.push({
        rule_key: 'output_after_fitness',
        severity: 'error',
        message: 'Output is fatigue-sensitive — move before Sustained Capacity conditioning.',
        affected_items: [],
        meta: { prior_phase: priorKey },
      })
    }
    if (priorKey === 'capacity') {
      findings.push({
        rule_key: 'output_after_capacity',
        severity: 'warning',
        message: 'Speed, jumping, plyometric, COD, and tumbling output may be reduced after high-volume Capacity work.',
        affected_items: [],
        meta: { prior_phase: priorKey },
      })
    }
  }

  for (const item of items ?? []) {
    const exerciseId = Number(item.exercise_id ?? item.exerciseId)
    if (!exerciseId) continue
    const name = item.exercise_name ?? item.exerciseName ?? String(exerciseId)
    const slug = exerciseSlug(item, slugByExercise) ?? ''
    const dosage = dosageByExercise.get(String(exerciseId))
    const profile = profileByExercisePhase.get(`${exerciseId}:${phaseKey}`)
    const rpe = itemRpe(item, dosage)
    const restSeconds = Number(item.rest_seconds ?? item.restSeconds ?? dosage?.default_rest_seconds) || 0
    const sets = Number(item.sets ?? dosage?.default_sets) || 1
    const reps = Number(item.reps ?? dosage?.default_reps) || 1
    const skillLevel = String(exerciseSkillLevelById.get(String(exerciseId)) ?? '').toUpperCase()

    if (DECEL_FOUNDATION_OUTPUT_SLUGS.has(slug)) hasDecelFoundation = true

    if (dosage?.volume_unit === 'contacts' || slug.includes('pogo') || slug.includes('hop')) {
      plyoContacts += sets * reps
    }

    if (rpe > 7 && restSeconds > 0 && restSeconds < 45) {
      findings.push({
        rule_key: 'output_high_rpe_short_rest',
        severity: 'warning',
        message: `${name}: RPE ${rpe} with ${restSeconds}s rest may become Sustained Capacity — increase rest or move to conditioning.`,
        affected_items: [name],
        meta: { rpe, rest_seconds: restSeconds, slug },
      })
    }

    if ((skillLevel === 'EARLY_STAGE' || skillLevel === 'BEGINNER') && ADVANCED_PLYO_OUTPUT_SLUGS.has(slug)) {
      findings.push({
        rule_key: 'output_advanced_plyo_prerequisite',
        severity: 'warning',
        message: `${name}: depth drops, hurdle hops, or single-leg plyos require landing stick, squat pattern, and pain-free hopping progressions.`,
        affected_items: [name],
        meta: { skill_level: skillLevel, slug },
      })
    }

    if (PREPLANNED_COD_OUTPUT_SLUGS.has(slug) && !REACTIVE_OUTPUT_MOVEMENT_SLUGS.has(slug)) {
      hasCodWithoutReactiveCue = true
    }

    if (TUMBLING_OUTPUT_SLUGS.has(slug)) {
      const missing = [...TUMBLING_SKILL_PREREQ_SLUGS].filter((s) => !skillSlugsInWorkout.has(s))
      if (missing.length > 0) {
        findings.push({
          rule_key: 'output_tumbling_missing_skill_prereq',
          severity: 'error',
          message: `${name}: explosive tumbling output requires prerequisite skill cards earlier in the session (cartwheel, handstand line, round-off).`,
          affected_items: [name],
          meta: { missing_prereqs: missing, slug },
        })
      }
    }

    if (slug === ROUND_OFF_REBOUND_SLUG) {
      const needs = ['cartwheel', 'round-off']
      const missing = needs.filter((s) => !skillSlugsInWorkout.has(s))
      if (missing.length > 0) {
        findings.push({
          rule_key: 'output_roundoff_rebound_prerequisite',
          severity: 'error',
          message: `${name}: round-off rebound requires cartwheel and round-off snap-down foundations marked in Skill first.`,
          affected_items: [name],
          meta: { missing_prereqs: missing, slug },
        })
      }
    }

    if (Number(profile?.fatigue_cost) >= 4 && Number(profile?.freshness_required)) {
      findings.push({
        rule_key: 'output_fatigue_sensitive_dose',
        severity: 'warning',
        message: `${name}: stop the set when speed, height, landing, or reaction quality drops — Output is not trained by surviving reps.`,
        affected_items: [name],
        meta: { fatigue_cost: profile?.fatigue_cost, slug },
      })
    }
  }

  if (plyoContacts > 80) {
    findings.push({
      rule_key: 'output_plyo_contact_volume',
      severity: 'warning',
      message: `Output block plyometric contacts (~${plyoContacts}) are high — reduce contacts or split across sessions.`,
      affected_items: [],
      meta: { plyo_contacts: plyoContacts },
    })
  }

  const hasCod = (items ?? []).some((item) => PREPLANNED_COD_OUTPUT_SLUGS.has(exerciseSlug(item, slugByExercise) ?? ''))
  if (hasCod && !hasDecelFoundation) {
    findings.push({
      rule_key: 'output_cod_missing_decel_prerequisite',
      severity: 'recommendation',
      message: 'COD power drills are scheduled without a deceleration foundation drill in this Output block.',
      affected_items: [],
      meta: {},
    })
  }

  if (hasCodWithoutReactiveCue) {
    findings.push({
      rule_key: 'output_cod_not_reactive_agility',
      severity: 'recommendation',
      message: 'Pre-planned COD drills are present — add visual, partner, or object cues for true reactive agility output.',
      affected_items: (items ?? [])
        .filter((item) => PREPLANNED_COD_OUTPUT_SLUGS.has(exerciseSlug(item, slugByExercise) ?? ''))
        .map((item) => item.exercise_name ?? item.exerciseName ?? String(item.exercise_id ?? item.exerciseId)),
      meta: {},
    })
  }

  return findings
}

/** Locomotion / sprint mechanics cluster checks. Pure helper for tests. */
function analyzeSkillSprintReadiness(items, ctx) {
  const {
    slugByExercise,
    dosageByExercise,
    profileByExercisePhase = new Map(),
    draft = {},
    blockMeta = [],
    skillBlockIndex = 0,
  } = ctx

  const findings = []
  const watchText = draftWatchText(draft)
  const priorFatiguePhase = hasPriorFatiguePhase(blockMeta, skillBlockIndex)

  const ordered = []
  for (const item of items ?? []) {
    const exerciseId = Number(item.exercise_id ?? item.exerciseId)
    if (!exerciseId) continue
    const name = item.exercise_name ?? item.exerciseName ?? String(exerciseId)
    const slug = exerciseSlug(item, slugByExercise)
    if (!slug) continue
    ordered.push({ item, exerciseId, name, slug })
  }

  const hasSprintInBlock = ordered.some((o) => SPRINT_MECHANICS_SKILL_SLUGS.has(o.slug))

  if (hasSprintInBlock && TOE_DOWN_PATTERN.test(watchText)) {
    findings.push({
      rule_key: 'skill_sprint_toe_down',
      severity: 'recommendation',
      message: 'Toe-down contacts during sprint mechanics — regress to A-March, wall march, tibialis raises, or ankling at lower speed.',
      affected_items: ordered.filter((o) => SPRINT_MECHANICS_SKILL_SLUGS.has(o.slug)).map((o) => o.name),
      meta: { symptom_flags: true },
    })
  }

  if (hasSprintInBlock && BACKWARD_LEAN_PATTERN.test(watchText)) {
    findings.push({
      rule_key: 'skill_sprint_backward_lean',
      severity: 'warning',
      message:
        'Leaning back during sprint-mechanics drills reduces effective ground contact and may encourage overstriding — slow down and reduce range.',
      affected_items: ordered.filter((o) => SPRINT_MECHANICS_SKILL_SLUGS.has(o.slug)).map((o) => o.name),
      meta: { symptom_flags: true },
    })
  }

  if (
    hasSprintInBlock
    && HIP_BEHIND_PATTERN.test(watchText)
    && ordered.some((o) => WALL_DRILL_SLUGS.has(o.slug))
  ) {
    findings.push({
      rule_key: 'skill_sprint_hip_projection',
      severity: 'recommendation',
      message: 'Wall drills show hips behind the body — return to Wall Drill ISO and cue hip projection before marching or switching.',
      affected_items: ordered.filter((o) => WALL_DRILL_SLUGS.has(o.slug)).map((o) => o.name),
      meta: { symptom_flags: true },
    })
  }

  let sprintFatigueCost = 0
  for (const { item, exerciseId, name, slug } of ordered) {
    const dosage = dosageByExercise.get(String(exerciseId))
    const profile = profileByExercisePhase.get(`${exerciseId}:${MOVEMENT_INTELLIGENCE}`)
    const rpe = itemRpe(item, dosage)
    const impact = Number(profile?.impact_level) || 0

    if (SPRINT_MECHANICS_SKILL_SLUGS.has(slug)) {
      sprintFatigueCost += Number(profile?.fatigue_cost) || 1
    }

    if (priorFatiguePhase && SPRINT_MECHANICS_SKILL_SLUGS.has(slug)) {
      findings.push({
        rule_key: 'skill_sprint_after_fitness',
        severity: 'warning',
        message: `${name}: sprint mechanics learning is fatigue-sensitive — move earlier in the session or reduce complexity.`,
        affected_items: [name],
        meta: { slug },
      })
    }

    if (slug === 'wall-drill-split-shin-hold') {
      const workSeconds = Number(item.work_seconds ?? item.workSeconds ?? dosage?.default_work_seconds) || 0
      if (workSeconds > 8) {
        findings.push({
          rule_key: 'skill_sprint_iso_hold_duration',
          severity: 'warning',
          message: `${name}: hold (${workSeconds}s) is becoming an isometric strength/control drill — reduce hold time if the goal is sprint mechanics.`,
          affected_items: [name],
          meta: { work_seconds: workSeconds, slug },
        })
      }
    }

    if (slug === 'wall-drill-switch') {
      const sets = Number(item.sets ?? dosage?.default_sets) || 1
      const reps = Number(item.reps ?? dosage?.default_reps) || 0
      if (sets * reps > 8) {
        findings.push({
          rule_key: 'skill_sprint_switch_volume',
          severity: 'warning',
          message: `${name}: ${sets * reps} switches may become fatigue-based — keep wall switches crisp if the goal is sprint mechanics.`,
          affected_items: [name],
          meta: { total_switches: sets * reps, slug },
        })
      }
    }

    if (HIGH_INTENT_SPRINT_SKILL_SLUGS.has(slug) && (rpe > 5 || impact >= 2)) {
      findings.push({
        rule_key: 'skill_sprint_high_intensity_drill',
        severity: 'recommendation',
        message: `${name}: high RPE (${rpe}) or impact suggests Output — Skill-phase sprint drills should emphasize rhythm and quality.`,
        affected_items: [name],
        meta: { rpe, impact, slug },
      })
    }

    if (slug === 'falling-start-hold' && WAIST_HINGE_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'skill_sprint_falling_hinge',
        severity: 'warning',
        message: `${name}: falling start should be a full-body lean — regress to wall lean or falling-position hold.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === 'two-point-start-walk-in') {
      const yards = parseDistanceYards(item, dosage)
      if (yards > 5 || TIMED_START_PATTERN.test(watchText)) {
        findings.push({
          rule_key: 'skill_sprint_start_overreach',
          severity: 'recommendation',
          message: `${name}: distance or timed/competitive intent suggests Output acceleration — use walk-in to freeze or reduce distance in Skill.`,
          affected_items: [name],
          meta: { yards, slug, timed: TIMED_START_PATTERN.test(watchText) },
        })
      }
    }

    if (slug === 'arm-action-drill' && ARM_MIDLINE_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'skill_sprint_arm_midline',
        severity: 'recommendation',
        message: `${name}: arm path crosses midline — use seated arm-action drill or mirror feedback before integrating with sprint drills.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (SPRINT_MECHANICS_SKILL_SLUGS.has(slug) && rpe > 6) {
      findings.push({
        rule_key: 'skill_sprint_max_speed',
        severity: 'warning',
        message: `${name}: RPE ${rpe} is no longer technical skill — move to Output or reduce intensity.`,
        affected_items: [name],
        meta: { rpe, slug },
      })
    }
  }

  const nextMeta = blockMeta[skillBlockIndex + 1]
  if (
    nextMeta?.phaseKey === MOVEMENT_INTELLIGENCE
    && hasSprintInBlock
    && (nextMeta.block?.items ?? []).some((item) => TUMBLING_SKILL_SLUGS.has(exerciseSlug(item, slugByExercise) ?? ''))
  ) {
    if (sprintFatigueCost >= 6 || CALF_HIP_FATIGUE_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'skill_sprint_before_tumbling_fatigue',
        severity: 'warning',
        message:
          'Sprint mechanics immediately before tumbling may leave calf/hip-flexor fatigue — reduce sprint volume or reorder if advanced tumbling follows.',
        affected_items: ordered.filter((o) => SPRINT_MECHANICS_SKILL_SLUGS.has(o.slug)).map((o) => o.name),
        meta: { sprint_fatigue_cost: sprintFatigueCost, symptom_flags: CALF_HIP_FATIGUE_PATTERN.test(watchText) },
      })
    }
  }

  return findings
}

/** Perception-Action / reactive movement cluster checks. Pure helper for tests. */
function analyzeSkillPerceptionReadiness(items, ctx) {
  const {
    slugByExercise,
    dosageByExercise,
    draft = {},
    blockMeta = [],
    skillBlockIndex = 0,
  } = ctx

  const findings = []
  const watchText = draftWatchText(draft)
  const priorFatiguePhase = hasPriorFatiguePhase(blockMeta, skillBlockIndex)
  const hasUnsafeContact = UNSAFE_TAG_CONTACT_PATTERN.test(watchText)
  const hasDiveCatch = DIVE_CATCH_PATTERN.test(watchText)

  const ordered = []
  for (const item of items ?? []) {
    const exerciseId = Number(item.exercise_id ?? item.exerciseId)
    if (!exerciseId) continue
    const name = item.exercise_name ?? item.exerciseName ?? String(exerciseId)
    const slug = exerciseSlug(item, slugByExercise)
    if (!slug || !PERCEPTION_SKILL_SLUGS.has(slug)) continue
    ordered.push({ item, exerciseId, name, slug })
  }

  if (ordered.length === 0) return findings

  const slugsInBlock = new Set(ordered.map((o) => o.slug))
  if (slugsInBlock.has(MIRROR_SHUFFLE_SLUG) && !slugsInBlock.has(LATERAL_SHUFFLE_MECHANICS_SLUG)) {
    findings.push({
      rule_key: 'skill_mirror_shuffle_prerequisite',
      severity: 'recommendation',
      message: 'Mirror shuffle drill selected without lateral shuffle mechanics in the same Skill block — add or regress to Lateral Shuffle Mechanics Walkthrough first.',
      affected_items: ordered.filter((o) => o.slug === MIRROR_SHUFFLE_SLUG).map((o) => o.name),
      meta: { slug: MIRROR_SHUFFLE_SLUG },
    })
  }

  for (const { item, exerciseId, name, slug } of ordered) {
    const dosage = dosageByExercise.get(String(exerciseId))
    const rpe = itemRpe(item, dosage)
    const workSeconds = itemWorkSeconds(item, dosage)

    if (priorFatiguePhase) {
      findings.push({
        rule_key: 'skill_reactive_after_fitness',
        severity: 'warning',
        message: `${name}: reactive decision quality is fatigue-sensitive — move earlier or reduce complexity.`,
        affected_items: [name],
        meta: { slug },
      })
    }

    if (slug === MIRROR_SHUFFLE_SLUG && workSeconds > 15) {
      findings.push({
        rule_key: 'skill_mirror_round_duration',
        severity: 'warning',
        message: `${name}: mirror round (${workSeconds}s) may become conditioning — keep reactive skill rounds ≤15s in Skill.`,
        affected_items: [name],
        meta: { work_seconds: workSeconds, slug },
      })
    }

    if (slug === TAG_GAME_SLUG && (workSeconds > 12 || rpe > 6)) {
      findings.push({
        rule_key: 'skill_tag_game_conditioning',
        severity: 'warning',
        message: `${name}: tag/shadow round (${workSeconds}s, RPE ${rpe}) may belong in Fitness — shorten rounds or increase rest.`,
        affected_items: [name],
        meta: { work_seconds: workSeconds, rpe, slug },
      })
    }

    if (slug === TAG_GAME_SLUG && hasUnsafeContact) {
      findings.push({
        rule_key: 'skill_tag_unsafe_contact',
        severity: 'error',
        message: 'Unsafe partner contact reported — use no-contact shadow version or reset rules.',
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === BALL_DROP_SLUG && hasDiveCatch) {
      findings.push({
        rule_key: 'skill_ball_drop_diving',
        severity: 'error',
        message: 'Do not allow diving in Skill ball-drop work — reduce distance or allow more bounces.',
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (REACTIVE_OUTPUT_SLUGS.has(slug) && rpe > 6) {
      findings.push({
        rule_key: 'skill_reactive_output_intent',
        severity: 'recommendation',
        message: `${name}: RPE ${rpe} suggests Output acceleration with reaction cue — Skill version should emphasize see-decide-move quality.`,
        affected_items: [name],
        meta: { rpe, slug },
      })
    }
  }

  return findings
}

export async function validateWorkoutDraft(pool, draft) {
  const errors = []
  const warnings = []
  const recommendations = []

  const phaseRows = await pool.query(`SELECT id, key, name, order_index FROM coaching.session_phase ORDER BY order_index`)
  const phaseById = new Map(phaseRows.rows.map((p) => [String(p.id), p]))
  const phaseByKey = new Map(phaseRows.rows.map((p) => [p.key, p]))

  const blocks = Array.isArray(draft.blocks) ? draft.blocks : []
  const blockMeta = []

  for (const block of blocks) {
    const phaseKey = block.phase_key ?? block.phaseKey ?? (block.phase_id != null ? phaseById.get(String(block.phase_id))?.key : null)
    const phase = phaseKey ? phaseByKey.get(phaseKey) : (block.phase_id != null ? phaseById.get(String(block.phase_id)) : null)
    blockMeta.push({ block, phase, phaseKey: phase?.key ?? phaseKey })
  }

  const exerciseIds = [...new Set(
    blockMeta.flatMap((m) => (m.block.items ?? []).map((it) => Number(it.exercise_id ?? it.exerciseId)).filter(Number.isFinite)),
  )]

  const profileByExercisePhase = new Map()
  const regimenByExercise = new Map()
  const dosageByExercise = new Map()
  const slugByExercise = new Map()
  const exerciseSkillLevelById = new Map()
  let tagRows = []
  const methodologyKeysByExercise = new Map()
  const equipmentKeysByExercise = new Map()

  if (exerciseIds.length > 0) {
    const [profiles, tags, regimens, dosages, exercises] = await Promise.all([
      pool.query(
        `SELECT p.*, sp.key AS phase_key FROM coaching.exercise_phase_profile p
         JOIN coaching.session_phase sp ON sp.id = p.phase_id WHERE p.exercise_id = ANY($1::bigint[])`,
        [exerciseIds],
      ),
      pool.query(
        `SELECT t.exercise_id, t.facet_type, t.facet_id, t.weight,
                COALESCE(ten.key, m.key, pe.key, eq.key) AS facet_key
         FROM coaching.exercise_tag t
         LEFT JOIN coaching.tenet ten ON ten.id = t.facet_id AND t.facet_type = 'tenet'
         LEFT JOIN coaching.methodology m ON m.id = t.facet_id AND t.facet_type = 'methodology'
         LEFT JOIN coaching.physiological_emphasis pe ON pe.id = t.facet_id AND t.facet_type = 'physiology'
         LEFT JOIN coaching.equipment eq ON eq.id = t.facet_id AND t.facet_type = 'equipment'
         WHERE t.exercise_id = ANY($1::bigint[])`,
        [exerciseIds],
      ),
      pool.query(`SELECT * FROM coaching.exercise_regimen_rule WHERE exercise_id = ANY($1::bigint[])`, [exerciseIds]),
      pool.query(
        `SELECT exercise_id, default_work_seconds, default_sets, default_reps, default_contacts,
                default_rpe_min, default_rpe_max, volume_unit
         FROM coaching.exercise_dosage_profile WHERE exercise_id = ANY($1::bigint[]) AND profile_name = 'Default'`,
        [exerciseIds],
      ),
      pool.query(`SELECT id, slug, skill_level FROM coaching.exercise WHERE id = ANY($1::bigint[])`, [exerciseIds]),
    ])
    tagRows = tags.rows
    for (const ex of exercises.rows) {
      slugByExercise.set(String(ex.id), ex.slug)
      if (ex.skill_level) exerciseSkillLevelById.set(String(ex.id), ex.skill_level)
    }
    for (const p of profiles.rows) {
      profileByExercisePhase.set(`${p.exercise_id}:${p.phase_key}`, p)
    }
    for (const r of regimens.rows) {
      regimenByExercise.set(String(r.exercise_id), r)
    }
    for (const d of dosages.rows) {
      dosageByExercise.set(String(d.exercise_id), d)
    }
    for (const t of tags.rows) {
      if (t.facet_type === 'methodology') {
        const list = methodologyKeysByExercise.get(String(t.exercise_id)) ?? []
        if (t.facet_key) list.push(t.facet_key)
        methodologyKeysByExercise.set(String(t.exercise_id), list)
      }
      if (t.facet_type === 'equipment' && t.facet_key) {
        const weights = equipmentKeysByExercise.get(String(t.exercise_id)) ?? new Map()
        const prev = weights.get(t.facet_key) ?? 0
        weights.set(t.facet_key, Math.max(prev, Number(t.weight) || 0))
        equipmentKeysByExercise.set(String(t.exercise_id), weights)
      }
    }
  }

  const taxonomyKeys = {
    tenet: (await pool.query(`SELECT key FROM coaching.tenet`)).rows.map((r) => r.key),
    methodology: (await pool.query(`SELECT key FROM coaching.methodology`)).rows.map((r) => r.key),
    physiology: (await pool.query(`SELECT key FROM coaching.physiological_emphasis`)).rows.map((r) => r.key),
  }

  // Phase order
  let lastOrder = -1
  for (const meta of blockMeta) {
    if (!meta.phaseKey) continue
    const idx = phaseIndex(meta.phaseKey)
    if (idx < lastOrder) {
      const edu = await pool.query(
        `SELECT * FROM coaching.education_content WHERE entity_type = 'validation_rule' AND entity_key = 'phase_order_violation' LIMIT 1`,
      )
      warnings.push({
        severity: 'warning',
        rule_key: 'phase_order_violation',
        message: `Phase ${meta.phase?.name ?? meta.phaseKey} appears out of recommended order.`,
        why: edu.rows[0]?.why_it_matters,
        recommendation: edu.rows[0]?.programming_guidance ?? 'Follow Prepare → Skill → Output → Capacity → Control → Fitness → Restore.',
        affected_items: [],
        related_phase: meta.phaseKey,
        can_override: true,
      })
    }
    lastOrder = Math.max(lastOrder, idx)
  }

  // Per-item rules
  for (let i = 0; i < blockMeta.length; i++) {
    const meta = blockMeta[i]
    const items = meta.block.items ?? []
    if (!meta.phaseKey || items.length === 0) continue

    const priorFatigue = computePriorFatigue(blockMeta, i, profileByExercisePhase, regimenByExercise)

    for (const item of items) {
      const exerciseId = Number(item.exercise_id ?? item.exerciseId)
      if (!exerciseId) continue

      const profiles = [...profileByExercisePhase.entries()]
        .filter(([k]) => k.startsWith(`${exerciseId}:`))
        .map(([, v]) => v)

      const phaseProfile = profileByExercisePhase.get(`${exerciseId}:${meta.phaseKey}`)
      const avoidProfile = profiles.find((p) => p.role === 'avoid' && p.phase_key === meta.phaseKey)

      if (avoidProfile) {
        errors.push({
          severity: 'error',
          rule_key: 'exercise_avoid_in_phase',
          message: `${item.exercise_name ?? 'Exercise'} should not be used in ${meta.phase?.name ?? meta.phaseKey}.`,
          why: avoidProfile.notes ?? 'This exercise is marked avoid for this phase.',
          recommendation: 'Remove or move to an allowed phase.',
          affected_items: [item.exercise_name ?? String(exerciseId)],
          related_phase: meta.phaseKey,
          can_override: false,
        })
      }

      const freshnessRequired = Boolean(
        phaseProfile?.freshness_required
        || (phaseProfile?.role === 'primary' && meta.phaseKey === 'output')
        || Number(phaseProfile?.fatigue_sensitivity) >= 4,
      )

      if (freshnessRequired && priorFatigue >= 3) {
        const [edu, exEdu] = await Promise.all([
          pool.query(`SELECT * FROM coaching.education_content WHERE entity_type = 'validation_rule' AND entity_key = 'freshness_required_after_fatigue' LIMIT 1`),
          pool.query(`SELECT * FROM coaching.education_content WHERE entity_type = 'exercise' AND entity_id = $1 LIMIT 1`, [exerciseId]),
        ])
        warnings.push({
          severity: 'warning',
          rule_key: 'freshness_required_after_fatigue',
          message: `${item.exercise_name ?? 'Exercise'} is placed after fatiguing work.`,
          why: exEdu.rows[0]?.fatigue_logic ?? edu.rows[0]?.why_it_matters,
          recommendation: edu.rows[0]?.programming_guidance ?? `Move ${item.exercise_name ?? 'exercise'} earlier, before Capacity or Fitness.`,
          affected_items: [item.exercise_name ?? String(exerciseId)],
          related_phase: meta.phaseKey,
          can_override: true,
          override_requires_reason: true,
        })
      }

      const methods = methodologyKeysByExercise.get(String(exerciseId)) ?? []
      if (meta.phaseKey === 'output' && methods.includes('hiit')) {
        warnings.push({
          severity: 'warning',
          rule_key: 'hiit_in_output_phase',
          message: `${item.exercise_name ?? 'Exercise'} is tagged HIIT but placed in Output.`,
          why: 'HIIT trains repeatability under fatigue, not maximal speed or power.',
          recommendation: 'Move to Sustained Capacity near the end of the session.',
          affected_items: [item.exercise_name ?? String(exerciseId)],
          related_phase: meta.phaseKey,
          can_override: true,
        })
      }
    }
  }

  // Prepare & Access subrole sequence within blocks
  let slotSubroleMap = new Map()
  try {
    slotSubroleMap = await loadSubroleMapForPhase(pool, PREPARE_AND_ACCESS)
  } catch {
    slotSubroleMap = new Map()
  }
  const exerciseSubroleCache = new Map()
  if (exerciseIds.length > 0) {
    const exRows = await pool.query(
      `SELECT id, phase_subrole, primary_order_slot FROM coaching.exercise WHERE id = ANY($1::bigint[])`,
      [exerciseIds],
    )
    for (const row of exRows.rows) {
      exerciseSubroleCache.set(String(row.id), row)
    }
  }

  for (const meta of blockMeta) {
    if (meta.phaseKey !== PREPARE_AND_ACCESS) continue
    const items = meta.block.items ?? []
    let lastSubroleOrder = -1
    const subrolesSeen = new Set()
    for (const item of items) {
      const exerciseId = Number(item.exercise_id ?? item.exerciseId)
      if (!exerciseId) continue
      const phaseProfile = profileByExercisePhase.get(`${exerciseId}:${PREPARE_AND_ACCESS}`)
      const exRow = exerciseSubroleCache.get(String(exerciseId))
      const orderSlot = phaseProfile?.order_slot ?? exRow?.primary_order_slot
      let subroleKey = orderSlot ? slotSubroleMap.get(orderSlot) : null
      if (!subroleKey && exRow?.phase_subrole) subroleKey = exRow.phase_subrole
      if (!subroleKey) continue
      subrolesSeen.add(subroleKey)
      const subroleOrder = SUBROLE_ORDER[subroleKey] ?? 999
      if (subroleOrder < lastSubroleOrder) {
        warnings.push({
          severity: 'warning',
          rule_key: 'prepare_subrole_sequence',
          message: `${item.exercise_name ?? 'Exercise'} (${subroleKey.replace(/_/g, ' ')}) appears before an earlier Prepare subrole in this block.`,
          why: 'Prepare & Access should follow Raise → Mobilize → Activate → Integrate → Potentiate Bridge.',
          recommendation: 'Reorder exercises to follow the RAMP subrole sequence within Prepare & Access.',
          affected_items: [item.exercise_name ?? String(exerciseId)],
          related_phase: PREPARE_AND_ACCESS,
          can_override: true,
        })
      }
      lastSubroleOrder = Math.max(lastSubroleOrder, subroleOrder)
    }
    const budgetMin = Number(meta.block.minutes_budget ?? meta.block.minutesBudget ?? 0)
    if (budgetMin >= 10 && subrolesSeen.size > 0 && subrolesSeen.size < 3) {
      recommendations.push({
        severity: 'recommendation',
        rule_key: 'prepare_subrole_coverage',
        message: 'Prepare & Access block uses fewer than 3 subroles for a longer warm-up.',
        why: 'A full Prepare & Access sequence typically spans Raise through Potentiate Bridge.',
        recommendation: 'Consider adding mobility, activation, or bridge drills across more subroles.',
        affected_items: [],
        related_phase: PREPARE_AND_ACCESS,
        can_override: true,
      })
    }

    const drain = analyzePrepareAccessDrain(items, {
      profileByExercisePhase,
      methodologyKeysByExercise,
      dosageByExercise,
      phaseKey: PREPARE_AND_ACCESS,
    })
    if (drain.stealsOutput) {
      const edu = await pool.query(
        `SELECT * FROM coaching.education_content WHERE entity_type = 'validation_rule' AND entity_key = 'prepare_readiness_stealing' LIMIT 1`,
      )
      const affected = drain.flagged.map((f) => f.name)
      warnings.push({
        severity: 'warning',
        rule_key: 'prepare_readiness_stealing',
        message: 'Prepare & Access block may steal readiness from Skill or Output.',
        why: edu.rows[0]?.why_it_matters ?? 'Prepare & Access should increase readiness without stealing output.',
        recommendation: edu.rows[0]?.programming_guidance
          ?? 'Reduce high fatigue-cost drills, long isometric holds, conditioning work, and repeated high-impact contacts in the warm-up.',
        affected_items: [...new Set(affected)],
        related_phase: PREPARE_AND_ACCESS,
        can_override: true,
        override_requires_reason: true,
        meta: { prepare_drain_counts: drain.counts },
      })
    }

    const lowerLegFindings = analyzePrepareLowerLegReadiness(items, {
      slugByExercise,
      profileByExercisePhase,
      dosageByExercise,
      phaseKey: PREPARE_AND_ACCESS,
      blockMeta,
      prepareBlockIndex: i,
      draft,
    })
    if (lowerLegFindings.length > 0) {
      const edu = await pool.query(
        `SELECT * FROM coaching.education_content WHERE entity_type = 'validation_rule' AND entity_key = 'prepare_lower_leg_readiness' LIMIT 1`,
      )
      for (const finding of lowerLegFindings) {
        warnings.push({
          severity: 'warning',
          rule_key: finding.rule_key,
          message: finding.message,
          why: edu.rows[0]?.why_it_matters
            ?? 'Foot/ankle readiness drills should prepare lower-body output without pre-fatigue.',
          recommendation: edu.rows[0]?.programming_guidance
            ?? 'Keep pogos under ~40 contacts, jump rope under ~90 seconds at low RPE, and calf raises at warm-up dose.',
          affected_items: finding.affected_items ?? [],
          related_phase: PREPARE_AND_ACCESS,
          can_override: true,
          meta: finding.meta,
        })
      }
    }

    const hipAccessFindings = analyzePrepareHipAccessReadiness(items, {
      slugByExercise,
      profileByExercisePhase,
      dosageByExercise,
      methodologyKeysByExercise,
      phaseKey: PREPARE_AND_ACCESS,
      blockMeta,
      prepareBlockIndex: i,
      draft,
    })
    if (hipAccessFindings.length > 0) {
      const edu = await pool.query(
        `SELECT * FROM coaching.education_content WHERE entity_type = 'validation_rule' AND entity_key = 'prepare_hip_access_readiness' LIMIT 1`,
      )
      for (const finding of hipAccessFindings) {
        warnings.push({
          severity: 'warning',
          rule_key: finding.rule_key,
          message: finding.message,
          why: edu.rows[0]?.why_it_matters
            ?? 'Hip/pelvis access should improve positions without pre-fatiguing legs before Output.',
          recommendation: edu.rows[0]?.programming_guidance
            ?? 'Keep squat pry under ~60s, frontal-plane prep moderate, and leg swings controlled.',
          affected_items: finding.affected_items ?? [],
          related_phase: PREPARE_AND_ACCESS,
          can_override: true,
          meta: finding.meta,
        })
      }
    }

    const activationFindings = analyzePrepareActivationReadiness(items, {
      slugByExercise,
      dosageByExercise,
      blockMeta,
      prepareBlockIndex: i,
      draft,
    })
    if (activationFindings.length > 0) {
      const edu = await pool.query(
        `SELECT * FROM coaching.education_content WHERE entity_type = 'validation_rule' AND entity_key = 'prepare_activation_readiness' LIMIT 1`,
      )
      for (const finding of activationFindings) {
        warnings.push({
          severity: 'warning',
          rule_key: finding.rule_key,
          message: finding.message,
          why: edu.rows[0]?.why_it_matters
            ?? 'Activation drills should improve position and readiness without trunk, hip, or shoulder fatigue before Skill or Output.',
          recommendation: edu.rows[0]?.programming_guidance
            ?? 'Keep bridges under ~15 reps, lateral walks under ~12 steps per direction, and A-March slow and technical before speed work.',
          affected_items: finding.affected_items ?? [],
          related_phase: PREPARE_AND_ACCESS,
          can_override: true,
          meta: finding.meta,
        })
      }
    }
  }

  for (let i = 0; i < blockMeta.length; i++) {
    const meta = blockMeta[i]
    if (meta.phaseKey !== MOVEMENT_INTELLIGENCE) continue
    const items = meta.block.items ?? []
    const skillFindings = analyzeSkillMovementIntelligenceReadiness(items, {
      slugByExercise,
      profileByExercisePhase,
      dosageByExercise,
      phaseKey: MOVEMENT_INTELLIGENCE,
      blockMeta,
      skillBlockIndex: i,
    })
    if (skillFindings.length > 0) {
      const edu = await pool.query(
        `SELECT * FROM coaching.education_content WHERE entity_type = 'validation_rule' AND entity_key = 'movement_intelligence_readiness' LIMIT 1`,
      )
      for (const finding of skillFindings) {
        warnings.push({
          severity: 'warning',
          rule_key: finding.rule_key,
          message: finding.message,
          why: edu.rows[0]?.why_it_matters
            ?? 'Skill training teaches coordination and decision-making while fresh — not conditioning or max output.',
          recommendation: edu.rows[0]?.programming_guidance
            ?? 'Keep block RPE ≤6, place tumbling before Fitness, use crisp ladder rhythm with rest, and move max-speed sprint work to Output.',
          affected_items: finding.affected_items ?? [],
          related_phase: MOVEMENT_INTELLIGENCE,
          can_override: true,
          meta: finding.meta,
        })
      }
    }

    const tumblingFindings = analyzeSkillTumblingReadiness(items, {
      slugByExercise,
      dosageByExercise,
      equipmentKeysByExercise,
      draft,
    })
    if (tumblingFindings.length > 0) {
      const tumblingEdu = await pool.query(
        `SELECT * FROM coaching.education_content WHERE entity_type = 'validation_rule' AND entity_key = 'skill_tumbling_readiness' LIMIT 1`,
      )
      for (const finding of tumblingFindings) {
        const payload = {
          severity: finding.severity ?? 'warning',
          rule_key: finding.rule_key,
          message: finding.message,
          why: tumblingEdu.rows[0]?.why_it_matters
            ?? 'Tumbling foundations require fresh athletes, safe surfaces, and gated progressions.',
          recommendation: tumblingEdu.rows[0]?.programming_guidance
            ?? 'Use mats for rolls, cap handstand holds at ~20s in Skill, and stop on dizziness or neck symptoms.',
          affected_items: finding.affected_items ?? [],
          related_phase: MOVEMENT_INTELLIGENCE,
          can_override: finding.severity !== 'error',
          meta: finding.meta,
        }
        if (finding.severity === 'error') errors.push(payload)
        else if (finding.severity === 'recommendation') recommendations.push(payload)
        else warnings.push(payload)
      }
    }

    const sprintFindings = analyzeSkillSprintReadiness(items, {
      slugByExercise,
      dosageByExercise,
      profileByExercisePhase,
      draft,
      blockMeta,
      skillBlockIndex: i,
    })
    if (sprintFindings.length > 0) {
      const sprintEdu = await pool.query(
        `SELECT * FROM coaching.education_content WHERE entity_type = 'validation_rule' AND entity_key = 'skill_sprint_readiness' LIMIT 1`,
      )
      for (const finding of sprintFindings) {
        const payload = {
          severity: finding.severity ?? 'warning',
          rule_key: finding.rule_key,
          message: finding.message,
          why: sprintEdu.rows[0]?.why_it_matters
            ?? 'Sprint mechanics require fresh athletes and technical intent before Output speed work.',
          recommendation: sprintEdu.rows[0]?.programming_guidance
            ?? 'Keep wall ISO holds short, regress when posture breaks, and move max-intent work to Output.',
          affected_items: finding.affected_items ?? [],
          related_phase: MOVEMENT_INTELLIGENCE,
          can_override: finding.severity !== 'error',
          meta: finding.meta,
        }
        if (finding.severity === 'error') errors.push(payload)
        else if (finding.severity === 'recommendation') recommendations.push(payload)
        else warnings.push(payload)
      }
    }

    const perceptionFindings = analyzeSkillPerceptionReadiness(items, {
      slugByExercise,
      dosageByExercise,
      draft,
      blockMeta,
      skillBlockIndex: i,
    })
    if (perceptionFindings.length > 0) {
      const perceptionEdu = await pool.query(
        `SELECT * FROM coaching.education_content WHERE entity_type = 'validation_rule' AND entity_key = 'skill_perception_readiness' LIMIT 1`,
      )
      for (const finding of perceptionFindings) {
        const payload = {
          severity: finding.severity ?? 'warning',
          rule_key: finding.rule_key,
          message: finding.message,
          why: perceptionEdu.rows[0]?.why_it_matters
            ?? 'Reactive drills require fresh athletes, clear cues, and safe spacing for perception-action learning.',
          recommendation: perceptionEdu.rows[0]?.programming_guidance
            ?? 'Keep mirror/tag rounds short, require shuffle prep before mirror work, and move max sprints to Output.',
          affected_items: finding.affected_items ?? [],
          related_phase: MOVEMENT_INTELLIGENCE,
          can_override: finding.severity !== 'error',
          meta: finding.meta,
        }
        if (finding.severity === 'error') errors.push(payload)
        else if (finding.severity === 'recommendation') recommendations.push(payload)
        else warnings.push(payload)
      }
    }
  }

  const skillSlugsInWorkout = new Set()
  for (const meta of blockMeta) {
    if (meta.phaseKey !== MOVEMENT_INTELLIGENCE) continue
    for (const item of meta.block.items ?? []) {
      const slug = exerciseSlug(item, slugByExercise)
      if (slug) skillSlugsInWorkout.add(slug)
    }
  }

  for (let i = 0; i < blockMeta.length; i++) {
    const meta = blockMeta[i]
    if (meta.phaseKey !== OUTPUT) continue
    const items = meta.block.items ?? []
    const outputFindings = analyzeOutputReadiness(items, {
      slugByExercise,
      profileByExercisePhase,
      dosageByExercise,
      blockMeta,
      outputBlockIndex: i,
      skillSlugsInWorkout,
      exerciseSkillLevelById,
      phaseKey: OUTPUT,
    })
    const maxVelocityFindings = analyzeOutputMaxVelocityReadiness(items, {
      slugByExercise,
      dosageByExercise,
      blockMeta,
      outputBlockIndex: i,
      exerciseSkillLevelById,
      draft,
    })
    const accelerationFindings = analyzeOutputAccelerationReadiness(items, {
      slugByExercise,
      dosageByExercise,
      blockMeta,
      outputBlockIndex: i,
      exerciseSkillLevelById,
      draft,
    })
    const elasticFindings = analyzeOutputElasticReadiness(items, {
      slugByExercise,
      dosageByExercise,
      blockMeta,
      outputBlockIndex: i,
      exerciseSkillLevelById,
      skillSlugsInWorkout,
      draft,
    })
    const jumpPowerFindings = analyzeOutputJumpPowerReadiness(items, {
      slugByExercise,
      dosageByExercise,
      blockMeta,
      outputBlockIndex: i,
      exerciseSkillLevelById,
      draft,
    })
    const decelCodFindings = analyzeOutputDecelCodReadiness(items, {
      slugByExercise,
      dosageByExercise,
      blockMeta,
      outputBlockIndex: i,
      exerciseSkillLevelById,
      draft,
    })
    const reactiveTumblingFindings = analyzeOutputReactiveTumblingReadiness(items, {
      slugByExercise,
      dosageByExercise,
      blockMeta,
      outputBlockIndex: i,
      skillSlugsInWorkout,
      draft,
    })
    const allOutputFindings = [
      ...outputFindings,
      ...maxVelocityFindings,
      ...accelerationFindings,
      ...elasticFindings,
      ...jumpPowerFindings,
      ...decelCodFindings,
      ...reactiveTumblingFindings,
    ]
    if (allOutputFindings.length > 0) {
      const outputEdu = await pool.query(
        `SELECT * FROM coaching.education_content WHERE entity_type = 'validation_rule' AND entity_key = 'output_readiness' LIMIT 1`,
      )
      const maxVelocityEdu = await pool.query(
        `SELECT * FROM coaching.education_content WHERE entity_type = 'validation_rule' AND entity_key = 'output_max_velocity_readiness' LIMIT 1`,
      )
      const accelerationEdu = await pool.query(
        `SELECT * FROM coaching.education_content WHERE entity_type = 'validation_rule' AND entity_key = 'output_acceleration_readiness' LIMIT 1`,
      )
      const elasticEdu = await pool.query(
        `SELECT * FROM coaching.education_content WHERE entity_type = 'validation_rule' AND entity_key = 'output_elastic_readiness' LIMIT 1`,
      )
      const jumpPowerEdu = await pool.query(
        `SELECT * FROM coaching.education_content WHERE entity_type = 'validation_rule' AND entity_key = 'output_jump_power_readiness' LIMIT 1`,
      )
      const decelCodEdu = await pool.query(
        `SELECT * FROM coaching.education_content WHERE entity_type = 'validation_rule' AND entity_key = 'output_decel_cod_readiness' LIMIT 1`,
      )
      const reactiveTumblingEdu = await pool.query(
        `SELECT * FROM coaching.education_content WHERE entity_type = 'validation_rule' AND entity_key = 'output_reactive_tumbling_readiness' LIMIT 1`,
      )
      for (const finding of allOutputFindings) {
        const ruleKey = String(finding.rule_key ?? '')
        const isMaxVelocityRule = ruleKey.startsWith('output_max_velocity_')
        const isElasticRule = ruleKey.startsWith('output_elastic_')
        const isJumpPowerRule = ruleKey.startsWith('output_jump_power_')
        const isDecelCodRule = ruleKey.startsWith('output_decel_cod_')
        const isReactiveTumblingRule = ruleKey.startsWith('output_reactive_tumbling_')
        const isAccelerationRule = ruleKey.startsWith('output_acceleration_')
          || ruleKey.startsWith('output_three_point_')
          || ruleKey.startsWith('output_prone_start_')
          || ruleKey.startsWith('output_half_kneeling_')
          || ruleKey.startsWith('output_partner_chase_')
          || ruleKey.startsWith('output_resisted_')
          || ruleKey.startsWith('output_hill_')
        const edu = isMaxVelocityRule
          ? maxVelocityEdu.rows[0]
          : isElasticRule
            ? elasticEdu.rows[0]
            : isJumpPowerRule
              ? jumpPowerEdu.rows[0]
              : isDecelCodRule
                ? decelCodEdu.rows[0]
                : isReactiveTumblingRule
                  ? reactiveTumblingEdu.rows[0]
                  : isAccelerationRule
                    ? accelerationEdu.rows[0]
                    : outputEdu.rows[0]
        const payload = {
          severity: finding.severity ?? 'warning',
          rule_key: finding.rule_key,
          message: finding.message,
          why: edu?.why_it_matters
            ?? (isMaxVelocityRule
              ? 'Max-velocity sprinting is high neural and tissue stress — quality, freshness, and full rest are non-negotiable.'
              : isElasticRule
                ? 'Elastic Output should make the athlete springier, not tired — crisp contacts and clean landings require freshness.'
                : isJumpPowerRule
                  ? 'Jump and throw Output expresses power while fresh — not after conditioning or when height, distance, or throw speed drops.'
                  : isDecelCodRule
                    ? 'COD Output requires clean plants and controlled braking while fresh — not tired shuttle running.'
                    : isAccelerationRule
                      ? 'Acceleration Output expresses speed while fresh — not after conditioning or with short rest.'
                      : 'Output expresses speed and power while fresh — not after conditioning or high-volume strength.'),
          recommendation: edu?.programming_guidance
            ?? (isMaxVelocityRule
              ? 'Use Build-Up first for beginners, Flying 10 before Flying 20, 2+ minute rest on fly sprints, and stop when speed drops.'
              : isElasticRule
                ? 'Use bilateral pogos before single-leg work, Snap-Down to Stick before rebound, cap contacts, and stop when contacts get loud.'
                : isJumpPowerRule
                  ? 'Keep reps low, rest generous, landings clean, throws fast, and stop when power quality drops.'
                  : isDecelCodRule
                    ? 'Master Sprint to Stick before COD power, use 2+ minute rest on 5-10-5, and stop when plant quality drops.'
                    : isAccelerationRule
                      ? 'Keep distance short, reps low, rest generous, and stop when speed or first-step quality drops.'
                      : 'Use low reps, full rest, and stop when quality drops. Place Output after Prepare and Skill, before Capacity and Fitness.'),
          affected_items: finding.affected_items ?? [],
          related_phase: OUTPUT,
          can_override: finding.severity !== 'error',
          override_requires_reason: finding.severity === 'error',
          meta: finding.meta,
        }
        if (finding.severity === 'error') errors.push(payload)
        else if (finding.severity === 'recommendation') recommendations.push(payload)
        else warnings.push(payload)
      }
    }
  }

  for (let i = 0; i < blockMeta.length; i++) {
    const meta = blockMeta[i]
    if (meta.phaseKey !== CAPACITY) continue
    const items = meta.block.items ?? []
    const capacityFindings = analyzeCapacityReadiness(items, {
      slugByExercise,
      dosageByExercise,
      blockMeta,
      capacityBlockIndex: i,
      exerciseSkillLevelById,
      draft,
    })
    const squatFindings = analyzeCapacitySquatReadiness(items, {
      slugByExercise,
      dosageByExercise,
      blockMeta,
      capacityBlockIndex: i,
      exerciseSkillLevelById,
      draft,
    })
    const hingeFindings = analyzeCapacityHingeReadiness(items, {
      slugByExercise,
      dosageByExercise,
      blockMeta,
      capacityBlockIndex: i,
      exerciseSkillLevelById,
      draft,
    })
    const pushFindings = analyzeCapacityPushReadiness(items, {
      slugByExercise,
      dosageByExercise,
      blockMeta,
      capacityBlockIndex: i,
      exerciseSkillLevelById,
      draft,
    })
    const pullFindings = analyzeCapacityPullReadiness(items, {
      slugByExercise,
      dosageByExercise,
      blockMeta,
      capacityBlockIndex: i,
      exerciseSkillLevelById,
      draft,
    })
    const carryFindings = analyzeCapacityCarryReadiness(items, {
      slugByExercise,
      dosageByExercise,
      blockMeta,
      capacityBlockIndex: i,
      exerciseSkillLevelById,
      draft,
    })
    const tissueFindings = analyzeCapacityTissueReadiness(items, {
      slugByExercise,
      dosageByExercise,
      blockMeta,
      capacityBlockIndex: i,
      exerciseSkillLevelById,
      draft,
    })
    const allCapacityFindings = [...capacityFindings, ...squatFindings, ...hingeFindings, ...pushFindings, ...pullFindings, ...carryFindings, ...tissueFindings]
    if (allCapacityFindings.length > 0) {
      const capacityEdu = await pool.query(
        `SELECT * FROM coaching.education_content WHERE entity_type = 'validation_rule' AND entity_key = 'capacity_readiness' LIMIT 1`,
      )
      const squatEdu = await pool.query(
        `SELECT * FROM coaching.education_content WHERE entity_type = 'validation_rule' AND entity_key = 'capacity_squat_readiness' LIMIT 1`,
      )
      const hingeEdu = await pool.query(
        `SELECT * FROM coaching.education_content WHERE entity_type = 'validation_rule' AND entity_key = 'capacity_hinge_readiness' LIMIT 1`,
      )
      const pushEdu = await pool.query(
        `SELECT * FROM coaching.education_content WHERE entity_type = 'validation_rule' AND entity_key = 'capacity_push_readiness' LIMIT 1`,
      )
      const pullEdu = await pool.query(
        `SELECT * FROM coaching.education_content WHERE entity_type = 'validation_rule' AND entity_key = 'capacity_pull_readiness' LIMIT 1`,
      )
      const carryEdu = await pool.query(
        `SELECT * FROM coaching.education_content WHERE entity_type = 'validation_rule' AND entity_key = 'capacity_carry_readiness' LIMIT 1`,
      )
      const tissueEdu = await pool.query(
        `SELECT * FROM coaching.education_content WHERE entity_type = 'validation_rule' AND entity_key = 'capacity_tissue_readiness' LIMIT 1`,
      )
      for (const finding of allCapacityFindings) {
        const ruleKey = String(finding.rule_key ?? '')
        const isSquatRule = ruleKey.startsWith('capacity_squat_')
        const isHingeRule = ruleKey.startsWith('capacity_hinge_')
        const isPushRule = ruleKey.startsWith('capacity_push_')
        const isPullRule = ruleKey.startsWith('capacity_pull_')
        const isCarryRule = ruleKey.startsWith('capacity_carry_')
        const isTissueRule = ruleKey.startsWith('capacity_tissue_')
        const edu = isSquatRule
          ? squatEdu.rows[0]
          : isHingeRule
            ? hingeEdu.rows[0]
            : isPushRule
              ? pushEdu.rows[0]
              : isPullRule
                ? pullEdu.rows[0]
                : isCarryRule
                  ? carryEdu.rows[0]
                  : isTissueRule
                    ? tissueEdu.rows[0]
                    : capacityEdu.rows[0]
        const payload = {
          severity: finding.severity ?? 'warning',
          rule_key: finding.rule_key,
          message: finding.message,
          why: edu?.why_it_matters
            ?? (isSquatRule
              ? 'Squat Capacity builds lower-body force with controlled load and full rest — not before fresh Output or as fatiguing circuits.'
              : isHingeRule
                ? 'Hinge Capacity builds posterior-chain strength without stealing sprint, jump, or max-velocity quality earlier in the session.'
                : isPushRule
                  ? 'Push Capacity builds pressing reserve without wrist, shoulder, elbow, or trunk fatigue that ruins hand-support skill quality.'
                  : isPullRule
                    ? 'Pull/hang/grip Capacity builds useful strength without reckless shoulder, elbow, wrist, or grip fatigue before ninja, bars, rings, or tumbling skill.'
                    : isCarryRule
                      ? 'Loaded-bracing Capacity builds trunk stiffness and posture under load without ugly posture survival or grip fatigue before skill work.'
                      : isTissueRule
                        ? 'Tissue Capacity builds durable tendons and accessory strength without irritating bottleneck tissues or stealing elastic or hand-support quality.'
                        : 'Capacity builds force and tissue tolerance after Output — not before speed/power work or as fatiguing circuits.'),
          recommendation: edu?.programming_guidance
            ?? (isSquatRule
              ? 'Master goblet/box before front squat and RFESS; stop on groin pain in frontal-plane work; heavy slow sled is Capacity.'
              : isHingeRule
                ? 'Master deadlift/RDL before good morning and Nordics; use slider curl before full Nordics; keep eccentric volume low before speed days.'
                : isPushRule
                  ? 'Master incline/floor push-up before pike and ring support; regress on wrist/shoulder pain; keep eccentric push volume conservative before hand-support skill.'
                  : isPullRule
                    ? 'Progress rows → assisted vertical → eccentrics → pull-ups → scapular → hang → climb; regress on pain; avoid grip-to-failure before skill.'
                    : isCarryRule
                      ? 'Master farmer/suitcase before overhead and Zercher; keep carry distance moderate with full rest; regress on lean, rib flare, or grip failure.'
                      : isTissueRule
                        ? 'Place tissue work after Output and main lifts unless primer intent; monitor symptoms; keep wrist/grip conservative before bars, rings, ninja, or tumbling.'
                        : 'Use progressive overload with full rest. Place Capacity after Output unless strength-priority session.'),
          affected_items: finding.affected_items ?? [],
          related_phase: CAPACITY,
          can_override: finding.severity !== 'error',
          override_requires_reason: finding.severity === 'error',
          meta: finding.meta,
        }
        if (finding.severity === 'error') errors.push(payload)
        else if (finding.severity === 'recommendation') recommendations.push(payload)
        else warnings.push(payload)
      }
    }
  }

  for (let i = 0; i < blockMeta.length; i++) {
    const meta = blockMeta[i]
    if (meta.phaseKey !== CONTROL_RESILIENCE) continue
    const items = meta.block.items ?? []
    const controlFindings = analyzeControlResilienceReadiness(items, {
      slugByExercise,
      dosageByExercise,
      blockMeta,
      controlBlockIndex: i,
      exerciseSkillLevelById,
      draft,
    })
    if (controlFindings.length > 0) {
      const controlEdu = await pool.query(
        `SELECT * FROM coaching.education_content WHERE entity_type = 'validation_rule' AND entity_key = 'control_resilience_readiness' LIMIT 1`,
      )
      for (const finding of controlFindings) {
        const edu = controlEdu.rows[0]
        const payload = {
          severity: finding.severity ?? 'warning',
          rule_key: finding.rule_key,
          message: finding.message,
          why: edu?.why_it_matters
            ?? 'Resilience builds precision, landing quality, balance, trunk stiffness, and tissue tolerance — not speed, power, or fatiguing circuits.',
          recommendation: edu?.programming_guidance
            ?? 'Use low volume, full rest, clean shapes, and regress on valgus, rib flare, balance flail, or pain. Place after Output and Capacity for hard work; light daily-safe drills can appear elsewhere.',
          affected_items: finding.affected_items ?? [],
          related_phase: CONTROL_RESILIENCE,
          can_override: finding.severity !== 'error',
          override_requires_reason: finding.severity === 'error',
          meta: finding.meta,
        }
        if (finding.severity === 'error') errors.push(payload)
        else if (finding.severity === 'recommendation') recommendations.push(payload)
        else warnings.push(payload)
      }
    }
  }

  const sprintPrepFinding = analyzeSprintPrepBeforeOutput(blockMeta, slugByExercise)
  if (sprintPrepFinding) {
    const sprintEdu = await pool.query(
      `SELECT * FROM coaching.education_content WHERE entity_type = 'validation_rule' AND entity_key = 'skill_sprint_readiness' LIMIT 1`,
    )
    recommendations.push({
      severity: 'recommendation',
      rule_key: sprintPrepFinding.rule_key,
      message: sprintPrepFinding.message,
      why: sprintEdu.rows[0]?.why_it_matters
        ?? 'Sprint mechanics teach the pattern before Output expresses it at speed.',
      recommendation: sprintEdu.rows[0]?.programming_guidance
        ?? 'Add A-March, wall march, ankling, or two-point walk-in before speed Output.',
      affected_items: sprintPrepFinding.affected_items ?? [],
      related_phase: MOVEMENT_INTELLIGENCE,
      can_override: true,
      meta: sprintPrepFinding.meta,
    })
  }

  // HIIT before skill/output (phase-level)
  const fitnessIdx = blockMeta.findIndex((m) => m.phaseKey === 'sustained_capacity')
  const earlySensitive = blockMeta.findIndex((m) => ['movement_intelligence', 'output'].includes(m.phaseKey))
  if (fitnessIdx >= 0 && earlySensitive >= 0 && fitnessIdx < earlySensitive) {
    const edu = await pool.query(
      `SELECT * FROM coaching.education_content WHERE entity_type = 'validation_rule' AND entity_key = 'hiit_before_skill_output' LIMIT 1`,
    )
    warnings.push({
      severity: 'warning',
      rule_key: 'hiit_before_skill_output',
      message: 'Conditioning appears before Skill or Output phases.',
      why: edu.rows[0]?.why_it_matters,
      recommendation: edu.rows[0]?.programming_guidance,
      affected_items: [],
      can_override: true,
      override_requires_reason: true,
    })
  }

  // Plyo/output after fitness — methodology in earlier blocks
  if (fitnessIdx >= 0) {
    for (let i = fitnessIdx + 1; i < blockMeta.length; i++) {
      const meta = blockMeta[i]
      if (!['output', 'movement_intelligence'].includes(meta.phaseKey)) continue
      for (const item of meta.block.items ?? []) {
        const exerciseId = Number(item.exercise_id ?? item.exerciseId)
        const methods = methodologyKeysByExercise.get(String(exerciseId)) ?? []
        if (methods.includes('plyometrics') || methods.includes('neural')) {
          recommendations.push({
            severity: 'recommendation',
            rule_key: 'plyo_after_conditioning',
            message: `${item.exercise_name ?? 'Exercise'} is a freshness-sensitive drill placed after conditioning.`,
            why: 'Plyometrics and max neural work require stiffness, intent, and clean mechanics that fatigue degrades.',
            recommendation: `Move ${item.exercise_name ?? 'exercise'} before the Fitness phase.`,
            affected_items: [item.exercise_name ?? String(exerciseId)],
            related_phase: meta.phaseKey,
            can_override: true,
          })
        }
      }
    }
  }

  // Duration overflow
  const budgetMinutes = draft.duration_minutes ?? draft.target_minutes ?? draft.durationMinutes ?? draft.targetMinutes
  const time = computeTimeSummary(blockMeta, budgetMinutes)
  if (time.budget_seconds > 0 && time.planned_seconds > time.budget_seconds * 1.1) {
    warnings.push({
      severity: 'warning',
      rule_key: 'duration_overflow',
      message: `Session is ~${time.planned_minutes} min planned vs ${time.budget_minutes} min budget.`,
      why: 'Over-filled sessions reduce quality and recovery between efforts.',
      recommendation: 'Reduce sets, remove an accessory, or extend the session budget.',
      can_override: true,
    })
  }

  const coverage = computeCoverage(blockMeta, tagRows, taxonomyKeys)
  const fatigue = computeFatigueSummary(blockMeta, profileByExercisePhase, regimenByExercise)

  const status = errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : recommendations.length > 0 ? 'warning' : 'valid'
  return { status, errors, warnings, recommendations, coverage, fatigue, time }
}

export {
  PHASE_ORDER,
  phaseIndex,
  itemSeconds,
  blockSeconds,
  computePriorFatigue,
  computeTimeSummary,
  analyzePrepareAccessDrain,
  analyzePrepareLowerLegReadiness,
  analyzePrepareHipAccessReadiness,
  analyzePrepareActivationReadiness,
  analyzeSkillMovementIntelligenceReadiness,
  analyzeSkillTumblingReadiness,
  analyzeSkillSprintReadiness,
  analyzeSkillPerceptionReadiness,
  analyzeSprintPrepBeforeOutput,
  analyzeOutputReadiness,
  analyzeOutputMaxVelocityReadiness,
  analyzeOutputElasticReadiness,
  analyzeOutputJumpPowerReadiness,
  analyzeOutputDecelCodReadiness,
  analyzeOutputReactiveTumblingReadiness,
  analyzeOutputAccelerationReadiness,
  analyzeCapacityReadiness,
  analyzeCapacitySquatReadiness,
  analyzeCapacityHingeReadiness,
  analyzeCapacityPushReadiness,
  analyzeCapacityPullReadiness,
  analyzeCapacityCarryReadiness,
  analyzeCapacityTissueReadiness,
  analyzeControlResilienceReadiness,
  analyzeControlLandingReadiness,
  analyzeControlSingleLegReadiness,
  analyzeControlTrunkReadiness,
  analyzeControlSlowEccentricReadiness,
  analyzeControlHandSupportReadiness,
}
