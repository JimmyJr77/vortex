import { loadSubroleMapForPhase, PREPARE_ACCESS, SKILL_MOVEMENT_INTELLIGENCE } from './phaseSubrole.js'

const SUBROLE_ORDER = {
  raise: 10,
  mobilize: 20,
  activate: 30,
  integrate: 40,
  potentiate_bridge: 50,
}

const PHASE_ORDER = [
  'prepare_access',
  'skill_movement_intelligence',
  'output',
  'capacity',
  'control_resilience',
  'fitness_repeatability',
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
    if (priorPhase === 'fitness_repeatability') priorFatigue = Math.max(priorFatigue, 4)
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

/** Analyze Prepare / Access block for drills that steal output readiness. Pure helper for tests. */
function analyzePrepareAccessDrain(items, ctx) {
  const {
    profileByExercisePhase,
    methodologyKeysByExercise,
    dosageByExercise,
    phaseKey = PREPARE_ACCESS,
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
    if (key === 'output' || key === 'skill_movement_intelligence') return true
  }
  return false
}

/** Lower-leg Prepare / Access dose and symptom checks. Pure helper for tests. */
function analyzePrepareLowerLegReadiness(items, ctx) {
  const {
    slugByExercise,
    profileByExercisePhase,
    dosageByExercise,
    phaseKey = PREPARE_ACCESS,
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
          message: `${name}: jump rope RPE (${rpe}) is high for Prepare / Access before Output.`,
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
      message: 'Prepare / Access lower-leg spring volume may reduce Output readiness.',
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

/** Hip/pelvis Prepare / Access dose and symptom checks. Pure helper for tests. */
function analyzePrepareHipAccessReadiness(items, ctx) {
  const {
    slugByExercise,
    profileByExercisePhase,
    dosageByExercise,
    methodologyKeysByExercise,
    phaseKey = PREPARE_ACCESS,
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
      message: 'Prepare / Access hip/pelvis volume may create leg heaviness before Output.',
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
    if (key === 'fitness_repeatability' || key === 'capacity_resilience') return true
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

/** Activation / integration Prepare / Access dose and symptom checks. Pure helper for tests. */
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
          message: `${name}: glute bridge volume (${totalReps} reps${workSeconds > 30 ? `, ${workSeconds}s work` : ''}) may become Capacity or Control / Resilience before Output.`,
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
          message: `${name}: high RPE (${rpe}) suggests Skill / Movement Intelligence, not Prepare / Access.`,
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
const SHAPE_HOLD_SLUGS = new Set([
  'hollow-body-hold', 'arch-body-hold', 'tuck-hold-rock', 'front-support-shape-hold',
  'rear-support-shape-hold',
])

function hasPriorFatiguePhase(blockMeta, blockIndex) {
  for (let j = 0; j < blockIndex; j++) {
    const key = blockMeta[j].phaseKey
    if (key === 'fitness_repeatability' || key === 'capacity_resilience') return true
  }
  return false
}

/** Skill / Movement Intelligence dose and placement checks. Pure helper for tests. */
function analyzeSkillMovementIntelligenceReadiness(items, ctx) {
  const {
    slugByExercise,
    profileByExercisePhase,
    dosageByExercise,
    phaseKey = SKILL_MOVEMENT_INTELLIGENCE,
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
          message: `${name}: ladder passes (${totalPasses}) exceed Skill dose (~4 per pattern) — may belong in Fitness / Repeatability.`,
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
          message: `${name}: shape hold (${workSeconds}s) may belong in Control / Resilience, not Skill.`,
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
      message: `Skill / Movement Intelligence block may be fatigue-based (avg RPE ${avgRpe.toFixed(1)}, fatigue sum ${totalFatigueCost}).`,
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
          message: `${name}: handstand hold (${workSeconds}s) may belong in Control / Resilience — reduce hold time if the goal is skill quality.`,
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
    if (meta.phaseKey === SKILL_MOVEMENT_INTELLIGENCE) {
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
    const profile = profileByExercisePhase.get(`${exerciseId}:${SKILL_MOVEMENT_INTELLIGENCE}`)
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
    nextMeta?.phaseKey === SKILL_MOVEMENT_INTELLIGENCE
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
      pool.query(`SELECT id, slug FROM coaching.exercise WHERE id = ANY($1::bigint[])`, [exerciseIds]),
    ])
    tagRows = tags.rows
    for (const ex of exercises.rows) {
      slugByExercise.set(String(ex.id), ex.slug)
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
          recommendation: 'Move to Fitness / Repeatability near the end of the session.',
          affected_items: [item.exercise_name ?? String(exerciseId)],
          related_phase: meta.phaseKey,
          can_override: true,
        })
      }
    }
  }

  // Prepare / Access subrole sequence within blocks
  let slotSubroleMap = new Map()
  try {
    slotSubroleMap = await loadSubroleMapForPhase(pool, PREPARE_ACCESS)
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
    if (meta.phaseKey !== PREPARE_ACCESS) continue
    const items = meta.block.items ?? []
    let lastSubroleOrder = -1
    const subrolesSeen = new Set()
    for (const item of items) {
      const exerciseId = Number(item.exercise_id ?? item.exerciseId)
      if (!exerciseId) continue
      const phaseProfile = profileByExercisePhase.get(`${exerciseId}:${PREPARE_ACCESS}`)
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
          why: 'Prepare / Access should follow Raise → Mobilize → Activate → Integrate → Potentiate Bridge.',
          recommendation: 'Reorder exercises to follow the RAMP subrole sequence within Prepare / Access.',
          affected_items: [item.exercise_name ?? String(exerciseId)],
          related_phase: PREPARE_ACCESS,
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
        message: 'Prepare / Access block uses fewer than 3 subroles for a longer warm-up.',
        why: 'A full Prepare / Access sequence typically spans Raise through Potentiate Bridge.',
        recommendation: 'Consider adding mobility, activation, or bridge drills across more subroles.',
        affected_items: [],
        related_phase: PREPARE_ACCESS,
        can_override: true,
      })
    }

    const drain = analyzePrepareAccessDrain(items, {
      profileByExercisePhase,
      methodologyKeysByExercise,
      dosageByExercise,
      phaseKey: PREPARE_ACCESS,
    })
    if (drain.stealsOutput) {
      const edu = await pool.query(
        `SELECT * FROM coaching.education_content WHERE entity_type = 'validation_rule' AND entity_key = 'prepare_readiness_stealing' LIMIT 1`,
      )
      const affected = drain.flagged.map((f) => f.name)
      warnings.push({
        severity: 'warning',
        rule_key: 'prepare_readiness_stealing',
        message: 'Prepare / Access block may steal readiness from Skill or Output.',
        why: edu.rows[0]?.why_it_matters ?? 'Prepare / Access should increase readiness without stealing output.',
        recommendation: edu.rows[0]?.programming_guidance
          ?? 'Reduce high fatigue-cost drills, long isometric holds, conditioning work, and repeated high-impact contacts in the warm-up.',
        affected_items: [...new Set(affected)],
        related_phase: PREPARE_ACCESS,
        can_override: true,
        override_requires_reason: true,
        meta: { prepare_drain_counts: drain.counts },
      })
    }

    const lowerLegFindings = analyzePrepareLowerLegReadiness(items, {
      slugByExercise,
      profileByExercisePhase,
      dosageByExercise,
      phaseKey: PREPARE_ACCESS,
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
          related_phase: PREPARE_ACCESS,
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
      phaseKey: PREPARE_ACCESS,
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
          related_phase: PREPARE_ACCESS,
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
          related_phase: PREPARE_ACCESS,
          can_override: true,
          meta: finding.meta,
        })
      }
    }
  }

  for (let i = 0; i < blockMeta.length; i++) {
    const meta = blockMeta[i]
    if (meta.phaseKey !== SKILL_MOVEMENT_INTELLIGENCE) continue
    const items = meta.block.items ?? []
    const skillFindings = analyzeSkillMovementIntelligenceReadiness(items, {
      slugByExercise,
      profileByExercisePhase,
      dosageByExercise,
      phaseKey: SKILL_MOVEMENT_INTELLIGENCE,
      blockMeta,
      skillBlockIndex: i,
    })
    if (skillFindings.length > 0) {
      const edu = await pool.query(
        `SELECT * FROM coaching.education_content WHERE entity_type = 'validation_rule' AND entity_key = 'skill_movement_intelligence_readiness' LIMIT 1`,
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
          related_phase: SKILL_MOVEMENT_INTELLIGENCE,
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
          related_phase: SKILL_MOVEMENT_INTELLIGENCE,
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
          related_phase: SKILL_MOVEMENT_INTELLIGENCE,
          can_override: finding.severity !== 'error',
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
      related_phase: SKILL_MOVEMENT_INTELLIGENCE,
      can_override: true,
      meta: sprintPrepFinding.meta,
    })
  }

  // HIIT before skill/output (phase-level)
  const fitnessIdx = blockMeta.findIndex((m) => m.phaseKey === 'fitness_repeatability')
  const earlySensitive = blockMeta.findIndex((m) => ['skill_movement_intelligence', 'output'].includes(m.phaseKey))
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
      if (!['output', 'skill_movement_intelligence'].includes(meta.phaseKey)) continue
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
  analyzeSprintPrepBeforeOutput,
}
