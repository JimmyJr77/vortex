import { loadSubroleMapForPhase, PREPARE_ACCESS } from './phaseSubrole.js'

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

  if (exerciseIds.length > 0) {
    const [profiles, tags, regimens, dosages, exercises] = await Promise.all([
      pool.query(
        `SELECT p.*, sp.key AS phase_key FROM coaching.exercise_phase_profile p
         JOIN coaching.session_phase sp ON sp.id = p.phase_id WHERE p.exercise_id = ANY($1::bigint[])`,
        [exerciseIds],
      ),
      pool.query(
        `SELECT t.exercise_id, t.facet_type, t.facet_id, t.weight,
                COALESCE(ten.key, m.key, pe.key) AS facet_key
         FROM coaching.exercise_tag t
         LEFT JOIN coaching.tenet ten ON ten.id = t.facet_id AND t.facet_type = 'tenet'
         LEFT JOIN coaching.methodology m ON m.id = t.facet_id AND t.facet_type = 'methodology'
         LEFT JOIN coaching.physiological_emphasis pe ON pe.id = t.facet_id AND t.facet_type = 'physiology'
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
      if (t.facet_type !== 'methodology') continue
      const list = methodologyKeysByExercise.get(String(t.exercise_id)) ?? []
      if (t.facet_key) list.push(t.facet_key)
      methodologyKeysByExercise.set(String(t.exercise_id), list)
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
}
