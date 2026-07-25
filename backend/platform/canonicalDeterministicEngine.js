import { buildPhasePlan } from './phaseArchitect.js'
import {
  GENERATOR_VERSION,
  SESSION_PHASE_ORDER,
  WORKOUT_SCHEMA_VERSION,
  assertCanonicalPhaseOrder,
  normalizeWorkoutIntent,
  score100,
  validateExerciseCard,
} from './canonicalWorkoutContract.js'
import { evaluateCanonicalWorkoutQuality } from './canonicalQualityEvaluation.js'
import { attachCanonicalWorkoutViews } from './canonicalWorkoutRendering.js'

export class CanonicalGenerationError extends Error {
  constructor(message, code, details = {}) {
    super(message)
    this.name = 'CanonicalGenerationError'
    this.code = code
    this.details = details
  }
}

function hash32(value) {
  let hash = 2166136261
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function seededJitter(seed, key) {
  return (hash32(`${seed}:${key}`) % 10001) / 10000
}

function list(value) {
  return Array.isArray(value) ? value : []
}

function requiredEquipment(card, profile) {
  return [...new Set([...list(card.equipment?.required), ...list(profile?.equipmentRequired)])]
}

function intersection(a, b) {
  const right = new Set(b)
  return a.filter((value) => right.has(value))
}

const FATIGUE_BUDGET_FIELDS = Object.freeze([
  'grip',
  'localMuscle',
  'spinalLoading',
  'eccentricStress',
  'impactAccumulation',
  'technicalSensitivity',
])

function fatigueBudgetCost(card, phaseMinutes, durationMinutes, itemTarget) {
  const weight = phaseMinutes / Math.max(1, durationMinutes * itemTarget)
  const fatigue = card.fatigueProfile ?? {}
  const load = card.loadProfile ?? {}
  const weighted = (value) => Math.round(Math.max(1, Number(value ?? 1)) * weight * 100) / 100
  return {
    grip: weighted(fatigue.gripFatigue ?? load.gripDemand),
    localMuscle: weighted(fatigue.localMuscleFatigue),
    spinalLoading: weighted(load.spinalLoading),
    eccentricStress: weighted(load.eccentricStress),
    impactAccumulation: weighted(fatigue.impactAccumulation),
    technicalSensitivity: weighted(fatigue.technicalFatigueSensitivity),
  }
}

function addFatigueCost(total, cost) {
  return Object.fromEntries(FATIGUE_BUDGET_FIELDS.map((field) => [
    field,
    Math.round((Number(total[field] ?? 0) + Number(cost[field] ?? 0)) * 100) / 100,
  ]))
}

function fatigueBudgetBreaches(total, budgets) {
  return FATIGUE_BUDGET_FIELDS.filter((field) => Number(total[field] ?? 0) > Number(budgets[field]))
}

function eligibleCard(card, profile, intent) {
  const reasons = []
  const cardValidation = validateExerciseCard(card)
  if (!cardValidation.valid) reasons.push(...cardValidation.errors.map((error) => `publication_gate:${error}`))
  if (card.status !== 'published') reasons.push('status_not_published')
  if (!profile) reasons.push('delivery_profile_missing')
  if (profile && profile.role === 'avoid') reasons.push('delivery_profile_avoids_phase')
  if (intent.exerciseAvoid.includes(card.id) || intent.exerciseAvoid.includes(card.slug)) reasons.push('explicit_exercise_avoid')
  if (intent.movementAvoid.some((key) => list(card.movementPatterns).includes(key))) reasons.push('movement_avoid')
  if (intent.bodyRegionAvoid.some((key) => list(card.bodyRegions).includes(key))) reasons.push('body_region_avoid')
  const patterns = list(card.movementPatterns)
  if (intent.limitations.includes('no_jumping') && intersection(patterns, ['jump', 'land', 'bound']).length) {
    reasons.push('no_jumping')
  }
  if ((intent.limitations.includes('low_impact') || intent.modifiers.includes('reduce_impact'))
    && Number(card.difficulty?.impact) > 40) reasons.push('low_impact_cap')

  const equipment = requiredEquipment(card, profile)
  const unavailable = equipment.filter((key) => !intent.equipmentAvailable.includes(key))
  if (unavailable.length) reasons.push(`unavailable_equipment:${unavailable.join(',')}`)
  const avoided = equipment.filter((key) => intent.equipmentAvoid.includes(key))
  if (avoided.length) reasons.push(`avoided_equipment:${avoided.join(',')}`)
  if (intent.modifiers.includes('remove_equipment') && equipment.length) reasons.push('modifier_remove_equipment')
  const stationCapacity = Math.max(1, Number(card.environment?.stationCapacity ?? intent.athleteCount))
  const stationCount = Math.ceil(intent.athleteCount / stationCapacity)
  const insufficient = equipment.filter((key) => {
    const quantity = intent.equipmentQuantities[key]
    const perStation = Number(card.equipment?.quantityPerStation?.[key] ?? 1)
    return quantity != null && quantity < stationCount * perStation
  })
  if (insufficient.length) reasons.push(`insufficient_equipment_quantity:${insufficient.join(',')}`)
  if (Number(card.difficulty?.baseOverallDifficulty) > intent.maxDifficulty) reasons.push('difficulty_cap')
  const risk = Math.max(
    Number(card.difficulty?.technicalComplexity || 1),
    Number(card.difficulty?.supervisionDemand || 1),
    Number(card.difficulty?.failureConsequence || 1),
  )
  if (risk > intent.maxTechnicalRisk) reasons.push('technical_risk_cap')
  const maxAthletesPerCoach = risk >= 76 ? 2 : risk >= 61 ? 4 : risk >= 41 ? 8 : 16
  if (intent.athleteCount > intent.coachCount * maxAthletesPerCoach) reasons.push('coach_supervision_capacity')
  if (card.population?.ageMin != null && intent.ageMin < card.population.ageMin) reasons.push('minimum_age')
  if (card.population?.ageMax != null && intent.ageMax > card.population.ageMax) reasons.push('maximum_age')
  if (card.population?.trainingAgeMonthsMin != null && intent.trainingAgeMonths < card.population.trainingAgeMonthsMin) {
    reasons.push('training_age')
  }
  if (intent.athleteCohorts.length > 0) {
    for (const cohort of intent.athleteCohorts) {
      if (!profile?.scalingByCohort?.[cohort.key]) reasons.push(`missing_cohort_scaling:${cohort.key}`)
      if (Number(card.difficulty?.baseOverallDifficulty) > cohort.maxDifficulty) {
        reasons.push(`cohort_difficulty_cap:${cohort.key}`)
      }
    }
  }
  for (const modifier of intent.modifiers) {
    if (!list(profile?.modifierKeys).includes(modifier)) reasons.push(`invalid_modifier:${modifier}`)
  }
  if (intent.objective === 'fitness_priority'
    && Number(card.difficulty?.technicalComplexity) > 60
    && profile?.phaseKey === 'sustained_capacity') reasons.push('hiit_technical_complexity')
  if (card.environment?.environment && !list(card.environment.environment).includes(intent.space.environment)) {
    reasons.push('environment')
  }
  if (card.environment?.floorAreaSquareFeet && intent.space.floorAreaSquareFeet != null
    && card.environment.floorAreaSquareFeet > intent.space.floorAreaSquareFeet) reasons.push('floor_space')
  if (card.environment?.laneLengthFeet && intent.space.laneLengthFeet != null
    && card.environment.laneLengthFeet > intent.space.laneLengthFeet) reasons.push('lane_length')
  return [...new Set(reasons)]
}

function candidateScore(card, profile, intent) {
  const components = {
    phaseSuitability: score100(profile.phaseSuitability, { nullable: false, field: 'phaseSuitability' }),
    objectiveRelevance: score100(
      profile.objectiveRelevance?.[intent.objective] ?? profile.objectiveRelevance?.default ?? 50,
      { nullable: false, field: 'objectiveRelevance' },
    ),
    athleteCompatibility: score100(
      card.population?.athleteCompatibility ?? 70,
      { nullable: false, field: 'athleteCompatibility' },
    ),
    methodologyAlignment: score100(profile.methodologyAlignment ?? 70, {
      nullable: false,
      field: 'methodologyAlignment',
    }),
  }
  let score = (
    components.phaseSuitability * 0.4
    + components.objectiveRelevance * 0.3
    + components.athleteCompatibility * 0.2
    + components.methodologyAlignment * 0.1
  )
  if (intent.exerciseInclude.includes(card.id) || intent.exerciseInclude.includes(card.slug)) score += 15
  if (intersection(requiredEquipment(card, profile), intent.equipmentRequired).length) score += 12
  if (intent.recentExerciseIds.includes(card.id) || intent.recentExerciseIds.includes(card.slug)) score -= 20
  score = Math.max(1, Math.min(100, score))
  return { score: Math.round(score * 100) / 100, components }
}

function dosageFor(card, profile, executionBudgetSeconds, modifiers) {
  const dose = profile.dosage ?? {}
  const preferredWork = Number(dose.workSeconds ?? 30)
  const preferredRest = Number(dose.restSeconds ?? 30)
  let sets = Math.max(1, Math.min(6, Math.round(
    executionBudgetSeconds / Math.max(20, preferredWork + preferredRest),
  )))
  let reps = dose.reps == null ? null : Number(dose.reps)
  const restSeconds = Math.max(0, Math.min(preferredRest, Math.floor(executionBudgetSeconds / sets / 2)))
  let workSeconds = Math.max(10, Math.floor(executionBudgetSeconds / sets) - restSeconds)
  let resolvedRestSeconds = restSeconds
  let tempo = dose.tempo ?? null
  if (modifiers.includes('make_explosive')) {
    workSeconds = Math.min(workSeconds, 20)
    resolvedRestSeconds = Math.max(resolvedRestSeconds, 60)
    sets = Math.max(1, Math.min(6, Math.round(
      executionBudgetSeconds / (workSeconds + resolvedRestSeconds),
    )))
  }
  if (modifiers.includes('make_isometric')) {
    reps = null
    workSeconds = Math.max(20, Math.min(workSeconds, 40))
  }
  if (modifiers.includes('make_eccentric')) tempo = '4-1-1'
  return {
    sets,
    reps,
    workSeconds,
    restSeconds: resolvedRestSeconds,
    tempo,
    loadMethod: dose.loadMethod ?? 'bodyweight_or_coach_selected',
    loadTarget: dose.loadTarget ?? null,
    rpe: dose.rpe ?? null,
    contacts: dose.contactsPerSet != null
      ? sets * Number(dose.contactsPerSet)
      : (card.loadProfile?.landingContactsPerRep > 0 && reps != null
          ? sets * reps * Number(card.loadProfile.landingContactsPerRep)
          : null),
    estimatedSeconds: sets * (workSeconds + resolvedRestSeconds),
  }
}

function logisticsFor(card, profile, intent, dose, allocationSeconds) {
  const equipment = requiredEquipment(card, profile)
  const stationCapacity = Math.max(1, Number(card.environment?.stationCapacity ?? intent.athleteCount))
  const stationCount = Math.ceil(intent.athleteCount / stationCapacity)
  const equipmentFeasible = equipment.every((key) => {
    const quantity = intent.equipmentQuantities[key]
    const perStation = Number(card.equipment?.quantityPerStation?.[key] ?? 1)
    return quantity == null || quantity >= stationCount * perStation
  })
  const timeModel = profile.timeModel ?? {}
  return {
    equipment,
    stationCapacity,
    stationCount,
    equipmentFeasible,
    queueRisk: stationCapacity * stationCount >= intent.athleteCount ? 1 : 100,
    setupSeconds: Math.max(0, Number(timeModel.setupSeconds ?? 0)),
    transitionSeconds: Math.min(Number(timeModel.transitionSeconds ?? profile.transitionSeconds ?? 30), Math.floor(allocationSeconds * 0.1)),
    demonstrationSeconds: Math.min(Number(timeModel.demonstrationSeconds ?? profile.demonstrationSeconds ?? 45), Math.floor(allocationSeconds * 0.15)),
    resetSeconds: Math.max(0, Number(timeModel.resetSeconds ?? 0)),
    cleanupSeconds: Math.max(0, Number(timeModel.cleanupSeconds ?? 0)),
    executionSeconds: dose.estimatedSeconds,
  }
}

function prescribe(card, profile, phase, intent, score, allocationSeconds, fatigueCost = null) {
  const timeModel = profile.timeModel ?? {}
  const overheadSeconds = (
    Math.min(Number(timeModel.transitionSeconds ?? profile.transitionSeconds ?? 30), Math.floor(allocationSeconds * 0.1))
    + Math.min(Number(timeModel.demonstrationSeconds ?? profile.demonstrationSeconds ?? 45), Math.floor(allocationSeconds * 0.15))
    + Math.max(0, Number(timeModel.setupSeconds ?? 0))
    + Math.max(0, Number(timeModel.resetSeconds ?? 0))
    + Math.max(0, Number(timeModel.cleanupSeconds ?? 0))
  )
  const dose = dosageFor(card, profile, Math.max(10, allocationSeconds - overheadSeconds), intent.modifiers)
  const logistics = logisticsFor(card, profile, intent, dose, allocationSeconds)
  const predictedChallenge = Math.max(1, Math.min(100, Math.round(
    Number(card.difficulty.baseOverallDifficulty) * 0.65
      + Number(card.difficulty.workCapacityDemand || card.difficulty.baseOverallDifficulty) * 0.2
      + Math.min(100, dose.sets * 8) * 0.15,
  )))
  const technicalRisk = Math.max(
    Number(card.difficulty.technicalComplexity || 1),
    Number(card.difficulty.supervisionDemand || 1),
    Number(card.difficulty.failureConsequence || 1),
  )
  const predictedChallengeByCohort = Object.fromEntries(intent.athleteCohorts.map((cohort) => [
    cohort.key,
    Math.max(1, Math.min(100, Math.round(
      predictedChallenge * (intent.maxDifficulty / cohort.maxDifficulty),
    ))),
  ]))
  return {
    exerciseId: card.id,
    variantId: card.variantId ?? card.id,
    exerciseName: card.displayName ?? card.canonicalName,
    familyId: card.familyId,
    movementPatterns: list(card.movementPatterns),
    bodyRegions: list(card.bodyRegions),
    anatomy: card.anatomy ?? {},
    loadProfile: card.loadProfile ?? {},
    fatigueProfile: card.fatigueProfile ?? {},
    programming: card.programming ?? {},
    fatigueBudgetCost: fatigueCost ?? fatigueBudgetCost(card, phase.minutes, intent.durationMinutes, 1),
    difficulty: card.difficulty,
    deliveryProfileId: profile.id,
    phaseKey: phase.phaseKey,
    purpose: profile.purpose,
    dose,
    equipment: logistics.equipment,
    logistics,
    qualityGate: profile.qualityGate,
    stopRules: list(profile.stopRules),
    coachInstructions: profile.coachInstructions,
    athleteInstructions: profile.athleteInstructions,
    athleteSupport: card.athleteSupport ?? {},
    coachSupport: card.coachSupport ?? {},
    measurement: profile.measurement ?? {},
    supportPrompts: profile.supportPrompts ?? {},
    doseScaling: profile.doseScaling ?? {},
    videoUrl: card.media.approvedVideoUrl,
    substitutions: list(profile.substitutions),
    appliedModifiers: intent.modifiers,
    cohortScaling: Object.fromEntries(intent.athleteCohorts.map((cohort) => [
      cohort.key,
      profile.scalingByCohort[cohort.key],
    ])),
    expectedAdaptation: profile.expectedAdaptation,
    methodologyKey: profile.methodologyKey ?? null,
    selectionScore: score,
    predictedChallengeScore: predictedChallenge,
    predictedChallengeByCohort,
    technicalRiskScore: technicalRisk,
    impactScore: Number(card.difficulty.impact || 1),
  }
}

function phaseCandidates(library, phase, intent, rejectionCounts) {
  const candidates = []
  for (const card of library) {
    const profile = list(card.deliveryProfiles).find((entry) => entry.phaseKey === phase.phaseKey)
    const reasons = eligibleCard(card, profile, intent)
    if (reasons.length) {
      for (const reason of reasons) rejectionCounts[reason] = (rejectionCounts[reason] ?? 0) + 1
      continue
    }
    const scoring = candidateScore(card, profile, intent)
    candidates.push({
      card,
      profile,
      ...scoring,
      jitter: seededJitter(intent.randomSeed, `${phase.phaseKey}:${card.id}:${profile.id}`),
    })
  }
  return candidates.sort((a, b) => b.score - a.score || b.jitter - a.jitter || String(a.card.id).localeCompare(String(b.card.id)))
}

function validateOutput(output, intent) {
  const errors = []
  const warnings = []
  try { assertCanonicalPhaseOrder(output.phases.map((phase) => phase.phaseKey)) } catch (error) { errors.push(error.message) }
  if (output.phases.some((phase) => phase.prescriptions.length === 0)) errors.push('required phase is empty')
  const plannedMinutes = output.phases.reduce((sum, phase) => sum + phase.targetMinutes, 0)
  if (plannedMinutes !== intent.durationMinutes) errors.push('phase duration does not equal requested duration')
  const estimatedMinutes = output.phases.reduce((sum, phase) => sum + phase.estimatedMinutes, 0)
  const durationTolerance = Math.max(2, intent.durationMinutes * 0.05)
  if (Math.abs(estimatedMinutes - intent.durationMinutes) > durationTolerance) {
    errors.push(`estimated duration ${estimatedMinutes.toFixed(1)} is outside tolerance of requested ${intent.durationMinutes}`)
  }
  for (const phase of output.phases) {
    const phaseTolerance = Math.max(1, phase.targetMinutes * 0.15)
    if (Math.abs(phase.estimatedMinutes - phase.targetMinutes) > phaseTolerance) {
      errors.push(`${phase.phaseKey}: estimated minutes are outside phase tolerance`)
    }
    const cycles = phase.prescriptions.map((item) => item.dose.workSeconds + item.dose.restSeconds)
    if (cycles.length > 1 && Math.max(...cycles) - Math.min(...cycles) > 15
      && !phase.stationSynchronizationPlan) {
      errors.push(`${phase.phaseKey}: station cycles are not synchronized`)
    }
  }
  const prescribedEquipment = new Set(output.phases.flatMap((phase) => (
    phase.prescriptions.flatMap((item) => item.equipment)
  )))
  for (const required of intent.equipmentRequired) {
    if (!prescribedEquipment.has(required)) errors.push(`required equipment was not used: ${required}`)
  }
  const highImpactContacts = output.phases.reduce((sum, phase) => sum + phase.prescriptions.reduce((phaseSum, item) => (
    phaseSum + (item.impactScore > 40 ? Number(item.dose.contacts ?? 0) : 0)
  ), 0), 0)
  if (highImpactContacts > intent.maxHighImpactContacts) {
    errors.push(`high-impact contacts ${highImpactContacts} exceed cap ${intent.maxHighImpactContacts}`)
  }
  const cumulativeFatigue = output.phases
    .flatMap((phase) => phase.prescriptions)
    .reduce((total, item) => addFatigueCost(total, item.fatigueBudgetCost ?? {}), {})
  for (const field of fatigueBudgetBreaches(cumulativeFatigue, intent.fatigueBudgets)) {
    errors.push(`cumulative ${field} fatigue ${cumulativeFatigue[field]} exceeds budget ${intent.fatigueBudgets[field]}`)
  }
  for (const phase of output.phases) {
    for (const item of phase.prescriptions) {
      if (!item.deliveryProfileId) errors.push(`${item.exerciseId}: missing delivery profile`)
      if (!item.videoUrl) errors.push(`${item.exerciseId}: missing approved video`)
      if (!item.logistics.equipmentFeasible) errors.push(`${item.exerciseId}: equipment quantity infeasible`)
      if (item.predictedChallengeScore > intent.maxDifficulty) errors.push(`${item.exerciseId}: challenge exceeds cap`)
      if (item.technicalRiskScore > intent.maxTechnicalRisk) errors.push(`${item.exerciseId}: technical risk exceeds cap`)
      for (const cohort of intent.athleteCohorts) {
        if (!item.cohortScaling?.[cohort.key]) errors.push(`${item.exerciseId}: missing cohort scaling for ${cohort.key}`)
        if (item.predictedChallengeByCohort?.[cohort.key] == null) {
          errors.push(`${item.exerciseId}: missing predicted challenge for ${cohort.key}`)
        }
      }
    }
  }
  return {
    status: errors.length ? 'failed' : 'passed',
    errors,
    warnings,
    passedHardConstraints: errors.length === 0,
    durationReconciliation: {
      requestedMinutes: intent.durationMinutes,
      estimatedMinutes: Math.round(estimatedMinutes * 10) / 10,
      toleranceMinutes: durationTolerance,
    },
    impactBudget: {
      highImpactContacts,
      maximumHighImpactContacts: intent.maxHighImpactContacts,
    },
    fatigueBudget: {
      cumulative: cumulativeFatigue,
      maximum: intent.fatigueBudgets,
      withinBudget: fatigueBudgetBreaches(cumulativeFatigue, intent.fatigueBudgets).length === 0,
    },
  }
}

function applyBoundedRepairs(output, intent, maximumRepairs = 3) {
  let validation = validateOutput(output, intent)
  const repairs = []
  for (let attempt = 0; attempt < maximumRepairs && validation.status === 'failed'; attempt += 1) {
    const impactError = validation.errors.find((error) => error.startsWith('high-impact contacts '))
    if (!impactError) break
    let remainingContacts = intent.maxHighImpactContacts
    const changed = []
    for (const phase of output.phases) {
      for (const item of phase.prescriptions) {
        if (item.impactScore <= 40 || item.dose.contacts == null) continue
        const before = Number(item.dose.contacts)
        const after = Math.max(0, Math.min(before, remainingContacts))
        remainingContacts -= after
        if (after !== before) {
          item.dose.contacts = after
          changed.push({ exerciseId: item.exerciseId, beforeContacts: before, afterContacts: after })
        }
      }
    }
    if (changed.length === 0) break
    const beforeScore = validation.passedHardConstraints ? 100 : 1
    validation = validateOutput(output, intent)
    repairs.push({
      repairType: 'adjust_dose_reduce_impact',
      priority: 'P0',
      reason: impactError,
      changes: changed,
      beforeScore,
      afterScore: validation.passedHardConstraints ? 100 : 1,
    })
  }
  return { validation, repairs }
}

export function generateCanonicalWorkout(rawIntent, library, options = {}) {
  const intent = normalizeWorkoutIntent(rawIntent)
  if (!Array.isArray(library) || library.length === 0) {
    throw new CanonicalGenerationError('exercise library is empty', 'empty_library')
  }
  let { plan, adjustments } = buildPhasePlan({
    durationMinutes: intent.durationMinutes,
    sessionObjective: intent.objective,
    ageMin: intent.ageMin,
    ageMax: intent.ageMax,
  })
  if (intent.tumblingBlock) {
    const movementIndex = plan.findIndex((phase) => phase.phaseKey === 'movement_intelligence')
    const capacityIndex = plan.findIndex((phase) => phase.phaseKey === 'capacity')
    if (movementIndex < 0 || capacityIndex < 0) {
      throw new CanonicalGenerationError('tumbling block requires movement intelligence and capacity phases', 'unsatisfiable_tumbling')
    }
    const delta = intent.tumblingBlock.minutes - plan[movementIndex].minutes
    if (delta > 0 && plan[capacityIndex].minutes - delta < 1) {
      throw new CanonicalGenerationError('tumbling block exceeds available session time', 'unsatisfiable_tumbling')
    }
    plan = plan.map((phase, index) => {
      if (index === movementIndex) return { ...phase, minutes: intent.tumblingBlock.minutes, contains_tumbling: true }
      if (index === capacityIndex) return { ...phase, minutes: phase.minutes - delta }
      return phase
    }).filter((phase) => phase.minutes > 0)
    adjustments = [...adjustments, `Tumbling ${intent.tumblingBlock.placement}: ${intent.tumblingBlock.minutes} min`]
  }
  assertCanonicalPhaseOrder(plan.map((phase) => phase.phaseKey))

  const usedFamilies = new Set()
  let cumulativeFatigue = Object.fromEntries(FATIGUE_BUDGET_FIELDS.map((field) => [field, 0]))
  const rejectionCounts = {}
  const phases = plan.map((phase) => {
    const candidates = phaseCandidates(library, phase, intent, rejectionCounts)
    if (candidates.length === 0) {
      throw new CanonicalGenerationError(
        `no eligible published exercise for ${phase.phaseKey}`,
        'unsatisfiable_phase',
        { phaseKey: phase.phaseKey, rejectionCounts },
      )
    }
    const itemTarget = Math.min(3, candidates.length, Math.max(1, Math.ceil(phase.minutes / 5)))
    const selected = []
    const selectCandidate = (candidate) => {
      const cost = fatigueBudgetCost(candidate.card, phase.minutes, intent.durationMinutes, itemTarget)
      const projected = addFatigueCost(cumulativeFatigue, cost)
      if (fatigueBudgetBreaches(projected, intent.fatigueBudgets).length > 0) return false
      selected.push({ ...candidate, fatigueCost: cost })
      cumulativeFatigue = projected
      return true
    }
    for (const candidate of candidates) {
      if (selected.length >= itemTarget) break
      if (selected.some((entry) => entry.card.familyId === candidate.card.familyId)) continue
      if (usedFamilies.has(candidate.card.familyId) && candidates.length > itemTarget) continue
      selectCandidate(candidate)
    }
    for (const candidate of candidates) {
      if (selected.length >= itemTarget) break
      if (!selected.some((entry) => entry.card === candidate.card)) selectCandidate(candidate)
    }
    if (selected.length < itemTarget) {
      throw new CanonicalGenerationError(
        `cumulative fatigue budgets cannot fill ${phase.phaseKey}`,
        'unsatisfiable_fatigue_budget',
        {
          phaseKey: phase.phaseKey,
          selectedCount: selected.length,
          requiredCount: itemTarget,
          cumulativeFatigue,
          fatigueBudgets: intent.fatigueBudgets,
        },
      )
    }
    selected.forEach((candidate) => usedFamilies.add(candidate.card.familyId))
    const allocationSeconds = Math.floor((phase.minutes * 60) / selected.length)
    const prescriptions = selected.map((candidate) => prescribe(
      candidate.card,
      candidate.profile,
      phase,
      intent,
      { total: candidate.score, components: candidate.components },
      allocationSeconds,
      candidate.fatigueCost,
    ))
    const estimatedSeconds = prescriptions.reduce((sum, prescription) => (
      sum
      + prescription.logistics.executionSeconds
      + prescription.logistics.setupSeconds
      + prescription.logistics.transitionSeconds
      + prescription.logistics.demonstrationSeconds
      + prescription.logistics.resetSeconds
      + prescription.logistics.cleanupSeconds
    ), 0)
    const averageScore = selected.reduce((sum, candidate) => sum + candidate.score, 0) / selected.length
    const cycles = prescriptions.map((prescription) => prescription.dose.workSeconds + prescription.dose.restSeconds)
    const stationSynchronizationPlan = cycles.length > 1 && Math.max(...cycles) - Math.min(...cycles) > 15
      ? 'Stagger station starts so all rotations end together.'
      : 'Stations rotate together on the shared interval.'
    return {
      phaseKey: phase.phaseKey,
      label: phase.label ?? phase.phaseKey.replaceAll('_', ' '),
      purpose: selected[0].profile.phasePurpose ?? selected[0].profile.purpose,
      targetMinutes: phase.minutes,
      estimatedMinutes: Math.round(estimatedSeconds / 6) / 10,
      focusVector: selected[0].profile.objectiveRelevance ?? {},
      prescriptions,
      stationArrangement: prescriptions.map((prescription) => (
        `${prescription.logistics.stationCount} station(s), capacity ${prescription.logistics.stationCapacity}`
      )).join('; '),
      stationSynchronizationPlan,
      phaseRationale: `Selected the highest eligible phase-aware delivery profile for ${intent.objective}.`,
      containsTumbling: Boolean(phase.contains_tumbling),
      tumblingPlacement: phase.contains_tumbling ? intent.tumblingBlock?.placement ?? null : null,
      phaseQualityScore: Math.round(averageScore),
    }
  })

  const output = {
    schemaVersion: WORKOUT_SCHEMA_VERSION,
    workoutId: options.workoutId ?? `workout-${hash32(`${intent.randomSeed}:${JSON.stringify(intent)}`).toString(16)}`,
    generatorVersion: GENERATOR_VERSION,
    libraryVersion: options.libraryVersion ?? 'unversioned',
    ruleVersion: options.ruleVersion ?? 'canonical-rules-1',
    mode: intent.mode,
    randomSeed: intent.randomSeed,
    generatedAt: options.generatedAt ?? null,
    intent,
    assumptions: intent.assumptions,
    phaseAdjustments: adjustments,
    phases,
    validation: null,
    diagnostics: {
      rejectionCounts,
      candidatePoolDepthByPhase: Object.fromEntries(plan.map((phase) => [
        phase.phaseKey,
        phaseCandidates(library, phase, intent, {}).length,
      ])),
      repairs: [],
      cumulativeFatigue,
      unmetPreferences: intent.exerciseInclude.filter((preferred) => !phases.some((phase) => (
        phase.prescriptions.some((item) => item.exerciseId === preferred)
      ))),
    },
  }
  const repaired = applyBoundedRepairs(output, intent)
  output.validation = repaired.validation
  output.diagnostics.repairs = repaired.repairs
  output.qualityEvaluation = evaluateCanonicalWorkoutQuality(output)
  output.overallQualityScore = output.validation.status === 'passed'
    ? output.qualityEvaluation.overallScore
    : 1
  if (output.validation.status !== 'passed') {
    throw new CanonicalGenerationError('generated workout failed hard validation', 'validation_failed', {
      validation: output.validation,
      output,
    })
  }
  return attachCanonicalWorkoutViews(output)
}

export function listCanonicalSwapCandidates(rawIntent, library, prescription) {
  const intent = normalizeWorkoutIntent(rawIntent)
  const source = list(library).find((card) => (
    String(card.variantId) === String(prescription.variantId)
      || String(card.id) === String(prescription.exerciseId)
  ))
  if (!source) return []
  const phaseKey = prescription.phaseKey
  const allowedTypes = new Set(['regression', 'lateral_substitution', 'equipment_equivalent', 'phase_equivalent'])
  return list(source.relationships)
    .filter((edge) => allowedTypes.has(edge.type))
    .map((edge) => {
      const card = list(library).find((candidate) => String(candidate.variantId) === String(edge.toVariantId))
      const profile = list(card?.deliveryProfiles).find((candidate) => candidate.phaseKey === phaseKey)
      if (!card || !profile) return null
      const rejectionReasons = eligibleCard(card, profile, intent)
      if (rejectionReasons.length > 0) return null
      const selection = candidateScore(card, profile, intent)
      const similarityScore = score100(edge.similarityScore, { nullable: false, field: 'similarityScore' })
      return {
        exerciseId: card.id,
        variantId: card.variantId,
        exerciseName: card.displayName ?? card.canonicalName,
        deliveryProfileId: profile.id,
        relationshipId: edge.id,
        relationshipType: edge.type,
        similarityScore,
        selectionScore: selection,
        combinedScore: Math.round((similarityScore * 0.6 + selection.score * 0.4) * 100) / 100,
        changedDimensions: list(edge.dimensions),
        rationale: edge.reason,
      }
    })
    .filter(Boolean)
    .sort((left, right) => right.combinedScore - left.combinedScore
      || String(left.variantId).localeCompare(String(right.variantId)))
}

export function applyCanonicalWorkoutSwap(output, library, request, options = {}) {
  if (!output || typeof output !== 'object') throw new TypeError('A canonical workout output is required.')
  const intent = normalizeWorkoutIntent(output.intent ?? {})
  const phaseKey = String(request.phaseKey || '')
  const sourceVariantId = String(request.sourceVariantId || '')
  const targetVariantId = String(request.targetVariantId || '')
  const candidates = listCanonicalSwapCandidates(intent, library, {
    variantId: sourceVariantId,
    exerciseId: request.sourceExerciseId,
    phaseKey,
  })
  const chosen = candidates.find((candidate) => String(candidate.variantId) === targetVariantId)
  if (!chosen) {
    throw new CanonicalGenerationError(
      'requested swap is not an eligible approved graph substitution',
      'invalid_swap',
      { phaseKey, sourceVariantId, targetVariantId },
    )
  }
  const targetCard = list(library).find((card) => String(card.variantId) === targetVariantId)
  const targetProfile = list(targetCard?.deliveryProfiles).find((profile) => profile.phaseKey === phaseKey)
  if (!targetCard || !targetProfile) {
    throw new CanonicalGenerationError('swap target delivery profile is unavailable', 'invalid_swap')
  }
  const next = structuredClone(output)
  const phase = list(next.phases).find((entry) => entry.phaseKey === phaseKey)
  const prescriptionIndex = list(phase?.prescriptions).findIndex((item) => (
    String(item.variantId) === sourceVariantId
      || String(item.exerciseId) === String(request.sourceExerciseId || '')
  ))
  if (!phase || prescriptionIndex < 0) {
    throw new CanonicalGenerationError('swap source prescription was not found', 'invalid_swap')
  }
  const sourcePrescription = phase.prescriptions[prescriptionIndex]
  const allocationSeconds = Math.floor((phase.targetMinutes * 60) / phase.prescriptions.length)
  const scoring = candidateScore(targetCard, targetProfile, intent)
  const replacementFatigueCost = fatigueBudgetCost(
    targetCard,
    phase.targetMinutes,
    intent.durationMinutes,
    phase.prescriptions.length,
  )
  const replacement = prescribe(
    targetCard,
    targetProfile,
    { phaseKey, minutes: phase.targetMinutes },
    intent,
    { total: scoring.score, components: scoring.components },
    allocationSeconds,
    replacementFatigueCost,
  )
  phase.prescriptions[prescriptionIndex] = replacement
  const estimatedSeconds = phase.prescriptions.reduce((sum, item) => (
    sum + item.logistics.executionSeconds + item.logistics.setupSeconds
      + item.logistics.transitionSeconds + item.logistics.demonstrationSeconds
      + item.logistics.resetSeconds + item.logistics.cleanupSeconds
  ), 0)
  phase.estimatedMinutes = Math.round(estimatedSeconds / 6) / 10
  phase.stationArrangement = phase.prescriptions.map((item) => (
    `${item.logistics.stationCount} station(s), capacity ${item.logistics.stationCapacity}`
  )).join('; ')
  phase.phaseQualityScore = Math.round(
    phase.prescriptions.reduce((sum, item) => sum + Number(item.selectionScore.total), 0)
      / phase.prescriptions.length,
  )
  next.workoutId = options.workoutId ?? `workout-${hash32(`${output.workoutId}:${sourceVariantId}:${targetVariantId}`).toString(16)}`
  next.generatedAt = options.generatedAt ?? null
  next.validation = validateOutput(next, intent)
  next.qualityEvaluation = evaluateCanonicalWorkoutQuality(next)
  next.overallQualityScore = next.validation.status === 'passed' ? next.qualityEvaluation.overallScore : 1
  next.diagnostics = {
    ...next.diagnostics,
    cumulativeFatigue: next.validation.fatigueBudget.cumulative,
    swaps: [
      ...list(next.diagnostics?.swaps),
      {
        relationshipId: chosen.relationshipId,
        relationshipType: chosen.relationshipType,
        sourceExerciseId: sourcePrescription.exerciseId,
        sourceVariantId,
        targetExerciseId: replacement.exerciseId,
        targetVariantId,
        similarityScore: chosen.similarityScore,
        changedDimensions: chosen.changedDimensions,
        rationale: chosen.rationale,
      },
    ],
  }
  if (next.validation.status !== 'passed') {
    throw new CanonicalGenerationError('swapped workout failed hard validation', 'invalid_swap', {
      validation: next.validation,
    })
  }
  return attachCanonicalWorkoutViews(next)
}

export { validateOutput as validateCanonicalWorkoutOutput }
