import { FATIGUE_BUDGET_FIELDS, fatigueBudgetCost, addFatigueCost, fatigueBudgetBreaches, weightedProfileCost, addBudgetCost, budgetBreaches } from './canonicalLoadBudget.js'
import {
  hash32,
  list,
  requiredEquipment,
  equipmentQuantityPerStation,
  focusAppliesToPhase,
  approvedTaxonomyAssignments,
  compositionConflictReasons,
  focusMatchesCard,
  focusMatchesPrescription,
  resolveAnchorPhaseKeys,
  demandSignature,
  eligibleCard,
  candidateScore,
  phaseCandidates,
} from './canonicalExerciseSelection.js'
import { buildPhasePlan } from './phaseArchitect.js'
import {
  GENERATOR_VERSION,
  SESSION_PHASE_ORDER,
  WORKOUT_SCHEMA_VERSION,
  WORKOUT_STRESS_BUDGET_FIELDS,
  assertCanonicalPhaseOrder,
  normalizeWorkoutIntent,
  score100,
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

function applyPhaseEmphasis(plan, emphasis, durationMinutes) {
  if (Object.keys(emphasis).length === 0) return plan
  const raw = plan.map((phase, index) => {
    const multiplier = emphasis[phase.phaseKey] == null ? 1 : emphasis[phase.phaseKey] / 50
    return { phase, index, rawExact: Math.max(0.01, phase.minutes * multiplier) }
  })
  const rawTotal = raw.reduce((sum, entry) => sum + entry.rawExact, 0)
  const weighted = raw.map(({ phase, index, rawExact }) => {
    const exact = (rawExact / rawTotal) * durationMinutes
    return { phase, index, exact, minutes: Math.max(1, Math.floor(exact)), fraction: exact % 1 }
  })
  let total = weighted.reduce((sum, entry) => sum + entry.minutes, 0)
  while (total < durationMinutes) {
    const target = [...weighted].sort((a, b) => b.fraction - a.fraction || b.exact - a.exact || a.index - b.index)[0]
    target.minutes += 1
    target.fraction = 0
    total += 1
  }
  while (total > durationMinutes) {
    const target = [...weighted]
      .filter((entry) => entry.minutes > 1)
      .sort((a, b) => b.minutes - a.minutes || a.fraction - b.fraction || b.index - a.index)[0]
    if (!target) break
    target.minutes -= 1
    total -= 1
  }
  return weighted.sort((a, b) => a.index - b.index).map((entry) => ({
    ...entry.phase,
    minutes: entry.minutes,
    emphasis: emphasis[entry.phase.phaseKey] ?? 50,
  }))
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
  const numericContactsPerSet = Number(dose.contactsPerSet)
  const contactModel = card.loadProfile?.contactExposureModel ?? {}
  const profileContactModel = dose.contactEstimate ?? {}
  const estimatedContactsPerSet = Number(
    profileContactModel.planningDefaultContactsPerSet
      ?? contactModel.planningDefaultContactsPerSet,
  )
  return {
    sets,
    reps,
    workSeconds,
    restSeconds: resolvedRestSeconds,
    tempo,
    loadMethod: dose.loadMethod ?? 'bodyweight_or_coach_selected',
    loadTarget: dose.loadTarget ?? null,
    rpe: dose.rpe ?? null,
    contacts: Number.isFinite(numericContactsPerSet)
      ? sets * numericContactsPerSet
      : (Number.isFinite(estimatedContactsPerSet)
          ? sets * estimatedContactsPerSet
      : (card.loadProfile?.landingContactsPerRep > 0 && reps != null
          ? sets * reps * Number(card.loadProfile.landingContactsPerRep)
          : null)),
    estimatedSeconds: sets * (workSeconds + resolvedRestSeconds),
  }
}

function logisticsFor(card, profile, intent, dose, allocationSeconds) {
  const equipment = requiredEquipment(card, profile)
  const stationCapacity = Math.max(1, Number(card.environment?.stationCapacity ?? intent.athleteCount))
  const stationCount = Math.ceil(intent.athleteCount / stationCapacity)
  const equipmentFeasible = equipment.every((key) => {
    const quantity = intent.equipmentQuantities[key]
    const perStation = equipmentQuantityPerStation(card, key)
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

function prescribe(card, profile, phase, intent, score, allocationSeconds, fatigueCost = null, stressCost = null) {
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
      + Number(card.taskDemands?.conditioningDemand || card.difficulty.baseOverallDifficulty) * 0.2
      + Math.min(100, dose.sets * 8) * 0.15,
  )))
  const technicalRisk = Math.max(
    Number(card.difficulty.technicalComplexity || 1),
    Number(card.taskDemands?.supervisionDemand || 1),
    Number(card.taskDemands?.failureConsequence || 1),
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
    exerciseSlug: card.slug,
    exerciseName: card.displayName ?? card.canonicalName,
    familyId: card.familyId,
    movementPatterns: list(card.movementPatterns),
    bodyRegions: list(card.bodyRegions),
    anatomy: card.anatomy ?? {},
    loadProfile: card.loadProfile ?? {},
    fatigueProfile: card.fatigueProfile ?? {},
    movementGeometry: card.movementGeometry ?? {},
    anatomyProfile: card.anatomyProfile ?? {},
    equipmentRoles: card.equipmentRoles ?? [],
    taskDemands: card.taskDemands ?? {},
    stressProfile: card.stressProfile ?? {},
    scalingHandles: card.scalingHandles ?? [],
    compositionProfile: card.compositionProfile ?? {},
    programming: card.programming ?? {},
    taxonomyV2Assignments: approvedTaxonomyAssignments(card, profile),
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
    stressBudgetCost: stressCost ?? weightedProfileCost(card.stressProfile, WORKOUT_STRESS_BUDGET_FIELDS, phase.minutes, intent.durationMinutes, 1),
    impactScore: Number(card.stressProfile?.impactStress ?? card.taskDemands?.impactToleranceDemand ?? 1),
  }
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
  const anchorPhaseKeys = new Set(output.selectionArchitecture?.anchorPhaseKeys ?? [])
  const compositionEntries = output.phases.flatMap((phase) => (
    phase.prescriptions.map((item) => ({ card: item, profile: null, phaseKey: phase.phaseKey }))
  ))
  for (const entry of compositionEntries) {
    for (const reason of compositionConflictReasons(entry.card, entry.profile, entry.phaseKey, compositionEntries)) {
      errors.push(`${entry.card.exerciseId}: ${reason}`)
    }
  }
  for (const focus of intent.focuses) {
    if (focus.facet !== 'phase') continue
    const present = output.phases.some((phase) => phase.phaseKey === focus.value)
    if (focus.strength === 'required' && !present) errors.push(`required phase focus is absent: ${focus.value}`)
    if (focus.strength === 'exclude' && present) errors.push(`excluded phase focus is present: ${focus.value}`)
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
  const cumulativeStress = output.phases
    .flatMap((phase) => phase.prescriptions)
    .reduce((total, item) => addBudgetCost(total, item.stressBudgetCost ?? {}, WORKOUT_STRESS_BUDGET_FIELDS), {})
  for (const field of budgetBreaches(cumulativeStress, intent.stressBudgets, WORKOUT_STRESS_BUDGET_FIELDS)) {
    errors.push(`cumulative ${field} stress ${cumulativeStress[field]} exceeds budget ${intent.stressBudgets[field]}`)
  }
  for (const phase of output.phases) {
    for (const item of phase.prescriptions) {
      if (!item.deliveryProfileId) errors.push(`${item.exerciseId}: missing delivery profile`)
      if (!item.videoUrl) errors.push(`${item.exerciseId}: missing approved video`)
      if (!item.logistics.equipmentFeasible) errors.push(`${item.exerciseId}: equipment quantity infeasible`)
      if (item.predictedChallengeScore > intent.maxDifficulty) errors.push(`${item.exerciseId}: challenge exceeds cap`)
      if (item.technicalRiskScore > intent.maxTechnicalRisk) errors.push(`${item.exerciseId}: technical risk exceeds cap`)
      for (const focus of intent.focuses) {
        if (focus.facet === 'phase'
          || !focusAppliesToPhase(focus, phase.phaseKey, anchorPhaseKeys.has(phase.phaseKey))) continue
        const matches = focusMatchesPrescription(focus, item, phase.phaseKey)
        if (focus.strength === 'required' && !matches) {
          errors.push(`${item.exerciseId}: required focus is not preserved (${focus.facet}:${focus.value})`)
        }
        if (focus.strength === 'exclude' && matches) {
          errors.push(`${item.exerciseId}: excluded focus was selected (${focus.facet}:${focus.value})`)
        }
      }
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
    errors: [...new Set(errors)],
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
    stressBudget: {
      cumulative: cumulativeStress,
      maximum: intent.stressBudgets,
      withinBudget: budgetBreaches(cumulativeStress, intent.stressBudgets, WORKOUT_STRESS_BUDGET_FIELDS).length === 0,
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
  const { plan: basePlan, adjustments } = buildPhasePlan({
    durationMinutes: intent.durationMinutes,
    sessionObjective: intent.objective,
    ageMin: intent.ageMin,
    ageMax: intent.ageMax,
  })
  const plan = applyPhaseEmphasis(basePlan, intent.phaseEmphasis, intent.durationMinutes)
  if (Object.keys(intent.phaseEmphasis).length > 0) {
    adjustments.push('Phase emphasis reallocated minutes without changing canonical sequence.')
  }
  assertCanonicalPhaseOrder(plan.map((phase) => phase.phaseKey))

  const usedFamilies = new Set()
  let cumulativeFatigue = Object.fromEntries(FATIGUE_BUDGET_FIELDS.map((field) => [field, 0]))
  let cumulativeStress = Object.fromEntries(WORKOUT_STRESS_BUDGET_FIELDS.map((field) => [field, 0]))
  const rejectionCounts = {}
  const anchorPhaseKeys = resolveAnchorPhaseKeys(intent, plan.map((phase) => phase.phaseKey))
  const anchorPhaseSet = new Set(anchorPhaseKeys)
  const selectionOrder = [
    ...plan.filter((phase) => anchorPhaseSet.has(phase.phaseKey)),
    ...plan.filter((phase) => !anchorPhaseSet.has(phase.phaseKey)),
  ]
  const selectedByPhase = new Map()
  const anchorCards = []
  const selectedCompositionEntries = []
  for (const phase of selectionOrder) {
    const isAnchor = anchorPhaseSet.has(phase.phaseKey)
    const signature = demandSignature(anchorCards)
    const candidates = phaseCandidates(library, phase, intent, rejectionCounts, {
      isAnchor,
      anchorDemandSignature: anchorCards.length > 0 ? signature : null,
    })
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
      const compositionReasons = compositionConflictReasons(candidate.card, candidate.profile, phase.phaseKey, [
        ...selectedCompositionEntries,
        ...selected.map((entry) => ({ card: entry.card, profile: entry.profile, phaseKey: phase.phaseKey })),
      ])
      if (compositionReasons.length) {
        for (const reason of compositionReasons) rejectionCounts[reason] = (rejectionCounts[reason] ?? 0) + 1
        return false
      }
      const cost = fatigueBudgetCost(candidate.card, phase.minutes, intent.durationMinutes, itemTarget)
      const projected = addFatigueCost(cumulativeFatigue, cost)
      if (fatigueBudgetBreaches(projected, intent.fatigueBudgets).length > 0) return false
      const stressCost = weightedProfileCost(
        candidate.card.stressProfile, WORKOUT_STRESS_BUDGET_FIELDS,
        phase.minutes, intent.durationMinutes, itemTarget,
      )
      const projectedStress = addBudgetCost(cumulativeStress, stressCost, WORKOUT_STRESS_BUDGET_FIELDS)
      if (budgetBreaches(projectedStress, intent.stressBudgets, WORKOUT_STRESS_BUDGET_FIELDS).length > 0) return false
      selected.push({ ...candidate, fatigueCost: cost, stressCost })
      cumulativeFatigue = projected
      cumulativeStress = projectedStress
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
        `cumulative fatigue or stress budgets cannot fill ${phase.phaseKey}`,
        'unsatisfiable_workload_budget',
        {
          phaseKey: phase.phaseKey,
          selectedCount: selected.length,
          requiredCount: itemTarget,
          cumulativeFatigue,
          fatigueBudgets: intent.fatigueBudgets,
          cumulativeStress,
          stressBudgets: intent.stressBudgets,
          rejectionCounts,
        },
      )
    }
    selected.forEach((candidate) => usedFamilies.add(candidate.card.familyId))
    selectedCompositionEntries.push(...selected.map((candidate) => ({
      card: candidate.card,
      profile: candidate.profile,
      phaseKey: phase.phaseKey,
    })))
    if (isAnchor) anchorCards.push(...selected.map((candidate) => candidate.card))
    selectedByPhase.set(phase.phaseKey, selected)
  }

  const finalAnchorDemandSignature = demandSignature(anchorCards)
  const phases = plan.map((phase) => {
    const selected = selectedByPhase.get(phase.phaseKey) ?? []
    const allocationSeconds = Math.floor((phase.minutes * 60) / selected.length)
    const prescriptions = selected.map((candidate) => prescribe(
      candidate.card,
      candidate.profile,
      phase,
      intent,
      { total: candidate.score, components: candidate.components },
      allocationSeconds,
      candidate.fatigueCost,
      candidate.stressCost,
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
      phaseRationale: anchorPhaseSet.has(phase.phaseKey)
        ? `Selected this anchor phase first for ${intent.objective}; its demands shaped the supporting phases.`
        : `Selected for phase intent and compatibility with the anchor demand signature for ${intent.objective}.`,
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
    selectionArchitecture: {
      strategy: 'anchor_first',
      anchorPhaseKeys,
      selectionOrder: selectionOrder.map((phase) => phase.phaseKey),
      anchorDemandSignature: finalAnchorDemandSignature,
    },
    phases,
    validation: null,
    diagnostics: {
      rejectionCounts,
      candidatePoolDepthByPhase: Object.fromEntries(plan.map((phase) => [
        phase.phaseKey,
        phaseCandidates(library, phase, intent, {}, {
          isAnchor: anchorPhaseSet.has(phase.phaseKey),
          anchorDemandSignature: finalAnchorDemandSignature,
        }).length,
      ])),
      repairs: [],
      cumulativeFatigue,
      cumulativeStress,
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
  const sourceProfile = list(source.deliveryProfiles).find((candidate) => candidate.phaseKey === phaseKey)
  const anchorPhaseKeys = new Set(resolveAnchorPhaseKeys(intent))
  const context = { phaseKey, isAnchor: anchorPhaseKeys.has(phaseKey) }
  const preservedFocuses = intent.focuses.filter((focus) => (
    focus.preserveOnSubstitution
    && focus.facet !== 'phase'
    && focusAppliesToPhase(focus, phaseKey, context.isAnchor)
    && focusMatchesCard(focus, source, sourceProfile, phaseKey)
  ))
  const allowedTypes = new Set(['regression', 'lateral_substitution', 'equipment_equivalent', 'phase_equivalent'])
  return list(source.relationships)
    .filter((edge) => allowedTypes.has(edge.type))
    .map((edge) => {
      const card = list(library).find((candidate) => String(candidate.variantId) === String(edge.toVariantId))
      const profile = list(card?.deliveryProfiles).find((candidate) => candidate.phaseKey === phaseKey)
      if (!card || !profile) return null
      const rejectionReasons = eligibleCard(card, profile, intent, context)
      if (rejectionReasons.length > 0) return null
      if (preservedFocuses.some((focus) => !focusMatchesCard(focus, card, profile, phaseKey))) return null
      const selection = candidateScore(card, profile, intent, context)
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
        preservedFocuses: preservedFocuses.map((focus) => `${focus.facet}:${focus.value}`),
        rationale: edge.reason,
      }
    })
    .filter(Boolean)
    .sort((left, right) => right.combinedScore - left.combinedScore
      || String(left.variantId).localeCompare(String(right.variantId)))
}

export function applyCanonicalWorkoutSwap(output, library, request, options = {}) {
  if (output?.sessionModel === 'vortex_components_v1') throw new CanonicalGenerationError('Component-session swaps require whole-session programming revalidation', 'session_workflow_required')
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
  const scoring = candidateScore(targetCard, targetProfile, intent, {
    phaseKey,
    isAnchor: list(next.selectionArchitecture?.anchorPhaseKeys).includes(phaseKey),
  })
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
    weightedProfileCost(
      targetCard.stressProfile, WORKOUT_STRESS_BUDGET_FIELDS,
      phase.targetMinutes, intent.durationMinutes, phase.prescriptions.length,
    ),
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
    cumulativeStress: next.validation.stressBudget.cumulative,
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
