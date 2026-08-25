import test from 'node:test'
import assert from 'node:assert/strict'

import {
  CanonicalGenerationError,
  applyCanonicalWorkoutSwap,
  generateCanonicalWorkout,
  listCanonicalSwapCandidates,
} from '../canonicalDeterministicEngine.js'
import { SESSION_PHASE_ORDER } from '../canonicalWorkoutContract.js'
import { persistCanonicalWorkout } from '../canonicalLibraryRepository.js'

const phaseNames = {
  prepare_and_access: 'March and Reach',
  movement_intelligence: 'Balance Line Walk',
  output: 'Medicine Ball Chest Throw',
  capacity: 'Incline Push-Up',
  resilience: 'Split Squat Isometric',
  sustained_capacity: 'Low-Impact Shuttle',
  restore: 'Crocodile Breathing',
}

function card(phaseKey, overrides = {}) {
  const slug = phaseNames[phaseKey].toLowerCase().replaceAll(' ', '-')
  return {
    id: slug,
    slug,
    canonicalName: phaseNames[phaseKey],
    displayName: phaseNames[phaseKey],
    cardVersion: 1,
    schemaVersion: '1.0.0',
    status: 'published',
    familyId: slug,
    approvedBy: 'coach-1',
    contentConfidence: 90,
    scoringConfidence: 90,
    mediaConfidence: 90,
    movementPatterns: phaseKey === 'output' ? ['throw'] : ['locomote'],
    bodyRegions: [],
    equipment: { required: [], quantityPerStation: {} },
    environment: { environment: ['indoor', 'outdoor'], stationCapacity: 12 },
    population: { ageMin: 5, ageMax: 18, athleteCompatibility: 90 },
    difficulty: {
      technicalComplexity: 25,
      absoluteLoadDemand: 35,
      baseOverallDifficulty: 35,
    },
    movementGeometry: { planes: ['sagittal'], projections: [], directions: ['forward'], supports: ['bilateral'], stances: ['square'], limbRelationships: ['symmetrical'] },
    anatomyProfile: { assignments: [{ key: 'total_body', kind: 'body_region', role: 'primary_target' }] },
    equipmentRoles: [{ key: 'none', role: 'required', quantityPerStation: 0, conditions: {} }],
    taskDemands: {
      strengthDemand: 35, powerDemand: 25, mobilityDemand: 20, balanceDemand: 20,
      coordinationDemand: 25, conditioningDemand: 35, impactToleranceDemand: 20,
      eccentricControlDemand: 20, bodyControlDemand: 25, perceptualDemand: 15,
      attentionDemand: 20, supervisionDemand: 20, failureConsequence: 15,
    },
    stressProfile: {
      jointStress: 15, tissueStress: 20, neuralDemand: 25, impactStress: 20,
      localMuscularFatigue: 35, systemicFatigue: 30, gripFatigue: 1,
      conditioningFatigue: 35, recoveryCost: 20,
      bodyRegionStress: ['total_body'], jointStressTargets: [], tissueStressTargets: [],
    },
    scalingHandles: [{ dimension: 'volume', boundary: 'prescription', easier: 'reduce repetitions', harder: 'add repetitions within the profile cap', limits: {} }],
    compositionProfile: { preparesFor: [], preferredAfter: [], avoidAfter: [], avoidSameSession: [], pairsWith: [], acceptablePairs: [], interferenceRules: [] },
    structuredProfileReview: { reviewStatus: 'approved', reviewedBy: 'coach-2', reviewedAt: '2026-08-01T00:00:00.000Z' },
    media: { approvedVideoUrl: `https://media.example/${slug}` },
    deliveryProfiles: [{
      id: `${slug}-${phaseKey}`,
      phaseKey,
      role: 'primary',
      phaseSuitability: 95,
      objectiveRelevance: { general_athletic_development: 90, default: 70 },
      methodologyAlignment: 90,
      purpose: `Develop ${phaseKey}`,
      qualityGate: 'Stop before movement quality declines.',
      stopRules: ['Stop on pain.', 'Stop when technique changes.'],
      coachInstructions: 'Demonstrate, observe, and regress when needed.',
      athleteInstructions: 'Move with control and tell your coach if anything hurts.',
      expectedAdaptation: `Improved ${phaseKey}`,
      dosage: { sets: 2, reps: 6, workSeconds: 30, restSeconds: 30 },
    }],
    ...overrides,
  }
}

function library() {
  return SESSION_PHASE_ORDER.map((phaseKey) => card(phaseKey))
}

function approvedTaxonomy(facetType, key, scope = 'definition') {
  return {
    facetType,
    key,
    scope,
    role: 'primary',
    weight: 5,
    confidence: 95,
    reviewStatus: 'approved',
    reviewedBy: 'coach-2',
    reviewedAt: '2026-08-01T00:00:00.000Z',
  }
}

const intent = {
  durationMinutes: 60,
  athleteCount: 12,
  coachCount: 1,
  ageMin: 8,
  ageMax: 10,
  equipmentAvailable: ['bodyweight', 'medicine_ball'],
  randomSeed: 'golden-youth-1',
  objective: 'general_athletic_development',
}

test('same canonical intent and seed produces identical workout', () => {
  const first = generateCanonicalWorkout(intent, library(), { libraryVersion: 'fixture-1' })
  const second = generateCanonicalWorkout(intent, library(), { libraryVersion: 'fixture-1' })
  assert.deepEqual(first, second)
  assert.equal(first.validation.status, 'passed')
  assert.deepEqual(first.phases.map((phase) => phase.phaseKey), SESSION_PHASE_ORDER)
  assert.equal(first.phases.reduce((sum, phase) => sum + phase.targetMinutes, 0), 60)
  assert.ok(first.phases.every((phase) => phase.prescriptions[0].deliveryProfileId))
})

test('reviewed machine composition constraints reject incompatible same-session candidates', () => {
  const cards = library()
  const prepare = cards.find((entry) => entry.id === 'march-and-reach')
  prepare.compositionProfile.constraints = [{
    type: 'avoid_same_session', targetType: 'variant', targetKey: 'balance-line-walk',
  }]
  let thrown = null
  try {
    generateCanonicalWorkout(intent, cards)
  } catch (error) {
    thrown = error
  }
  assert.ok(thrown instanceof CanonicalGenerationError)
  assert.equal(thrown.code, 'unsatisfiable_workload_budget')
  assert.ok(thrown.details.rejectionCounts['composition_avoid_same_session:variant:balance-line-walk'] > 0)
})

test('phase emphasis reallocates minutes while preserving canonical order', () => {
  const output = generateCanonicalWorkout({
    ...intent,
    phaseEmphasis: { output: 100, capacity: 20, sustained_capacity: 10 },
  }, library())
  const outputPhase = output.phases.find((phase) => phase.phaseKey === 'output')
  const capacityPhase = output.phases.find((phase) => phase.phaseKey === 'capacity')
  assert.deepEqual(output.phases.map((phase) => phase.phaseKey), SESSION_PHASE_ORDER)
  assert.equal(output.phases.reduce((sum, phase) => sum + phase.targetMinutes, 0), 60)
  assert.ok(outputPhase.targetMinutes > capacityPhase.targetMinutes)
  assert.equal(output.selectionArchitecture.strategy, 'anchor_first')
  assert.deepEqual(output.selectionArchitecture.selectionOrder.slice(0, 2), ['output', 'capacity'])
})

test('required scoped training family is enforced only in anchor phases', () => {
  const cards = library()
  for (const entry of cards.filter((candidate) => ['output', 'capacity'].includes(candidate.deliveryProfiles[0].phaseKey))) {
    entry.taxonomyV2 = {
      assignments: [approvedTaxonomy('training_family', 'olympic_weightlifting')],
      decisions: [],
    }
  }
  const output = generateCanonicalWorkout({
    ...intent,
    focuses: [{
      facet: 'training_family', value: 'olympic_weightlifting',
      scope: 'anchor_exercises', strength: 'required', weight: 100,
    }],
  }, cards)
  const anchorPhases = new Set(output.selectionArchitecture.anchorPhaseKeys)
  assert.ok(output.phases.filter((phase) => anchorPhases.has(phase.phaseKey)).every((phase) => (
    phase.prescriptions.every((item) => item.taxonomyV2Assignments.some((assignment) => (
      assignment.facetType === 'training_family' && assignment.key === 'olympic_weightlifting'
    )))
  )))
  assert.ok(output.phases.find((phase) => phase.phaseKey === 'prepare_and_access').prescriptions.length > 0)
})

test('support selection uses the anchor demand signature', () => {
  const cards = library()
  const anchor = cards.find((entry) => entry.deliveryProfiles[0].phaseKey === 'capacity')
  anchor.bodyRegions = ['hip']
  const matchingPrepare = card('prepare_and_access', {
    id: 'hip-access', slug: 'hip-access', canonicalName: 'Hip Access', displayName: 'Hip Access',
    familyId: 'hip-access', bodyRegions: ['hip'],
  })
  matchingPrepare.deliveryProfiles[0].phaseSuitability = 92
  const unmatchedPrepare = card('prepare_and_access', {
    id: 'wrist-access', slug: 'wrist-access', canonicalName: 'Wrist Access', displayName: 'Wrist Access',
    familyId: 'wrist-access', bodyRegions: ['wrist'],
  })
  unmatchedPrepare.deliveryProfiles[0].phaseSuitability = 95
  const output = generateCanonicalWorkout({ ...intent, objective: 'strength_priority' }, [
    ...cards,
    matchingPrepare,
    unmatchedPrepare,
  ])
  const prepareIds = output.phases.find((phase) => phase.phaseKey === 'prepare_and_access')
    .prescriptions.map((item) => item.exerciseId)
  assert.ok(prepareIds.includes('hip-access'))
  assert.ok(output.selectionArchitecture.anchorDemandSignature.bodyRegions.includes('hip'))
})

test('generation remains deterministic and completes against a 7,000-card published pool', () => {
  const largeLibrary = Array.from({ length: 1000 }, (_, index) => (
    library().map((entry) => ({
      ...structuredClone(entry),
      id: `${entry.id}-${index}`,
      slug: `${entry.slug}-${index}`,
      canonicalName: `${entry.canonicalName} ${index}`,
      displayName: `${entry.displayName} ${index}`,
      familyId: `${entry.familyId}-${index}`,
    }))
  )).flat()
  const startedAt = performance.now()
  const first = generateCanonicalWorkout(intent, largeLibrary, { libraryVersion: 'scale-7000' })
  const elapsedMs = performance.now() - startedAt
  const second = generateCanonicalWorkout(intent, largeLibrary, { libraryVersion: 'scale-7000' })
  assert.equal(first.validation.status, 'passed')
  assert.deepEqual(first.phases, second.phases)
  assert.ok(elapsedMs < 5000, `7,000-card generation took ${Math.round(elapsedMs)}ms`)
})

test('no-jumping hard limitation excludes jump cards', () => {
  const cards = library()
  const outputCard = cards.find((entry) => entry.deliveryProfiles[0].phaseKey === 'output')
  outputCard.movementPatterns = ['jump', 'land']
  cards.push(card('output', {
    id: 'medicine-ball-scoop-throw',
    slug: 'medicine-ball-scoop-throw',
    canonicalName: 'Medicine Ball Scoop Throw',
    familyId: 'medicine-ball-throw',
  }))
  const output = generateCanonicalWorkout({ ...intent, limitations: ['no_jumping'] }, cards)
  const prescribedOutput = output.phases.find((phase) => phase.phaseKey === 'output').prescriptions[0]
  assert.equal(prescribedOutput.exerciseId, 'medicine-ball-scoop-throw')
  assert.ok(output.diagnostics.rejectionCounts.no_jumping >= 1)
})

test('unavailable equipment fails closed with traceable rejection', () => {
  const cards = library()
  const outputCard = cards.find((entry) => entry.deliveryProfiles[0].phaseKey === 'output')
  outputCard.equipment = { required: ['barbell'], quantityPerStation: { barbell: 1 } }
  outputCard.equipmentRoles = [{ key: 'barbell', role: 'required', quantityPerStation: 1, conditions: {} }]
  assert.throws(
    () => generateCanonicalWorkout(intent, cards),
    (error) => error instanceof CanonicalGenerationError
      && error.code === 'unsatisfiable_phase'
      && error.details.rejectionCounts['unavailable_equipment:barbell'] >= 1,
  )
})

test('station equipment quantity infeasibility is removed before selection', () => {
  const cards = library()
  const capacityCard = cards.find((entry) => entry.deliveryProfiles[0].phaseKey === 'capacity')
  capacityCard.equipment = { required: ['dumbbell'], quantityPerStation: { dumbbell: 2 } }
  capacityCard.equipmentRoles = [{ key: 'dumbbell', role: 'required', quantityPerStation: 2, conditions: {} }]
  capacityCard.environment.stationCapacity = 3
  assert.throws(
    () => generateCanonicalWorkout({
      ...intent,
      equipmentAvailable: [...intent.equipmentAvailable, 'dumbbell'],
      equipmentQuantities: { dumbbell: 2 },
    }, cards),
    (error) => error instanceof CanonicalGenerationError
      && error.code === 'unsatisfiable_phase'
      && error.details.rejectionCounts['insufficient_equipment_quantity:dumbbell'] >= 1,
  )
})

test('bounded deterministic repair reduces high-impact dose and records before/after evidence', () => {
  const cards = library()
  const outputCard = cards.find((entry) => entry.deliveryProfiles[0].phaseKey === 'output')
  outputCard.taskDemands.impactToleranceDemand = 60
  outputCard.stressProfile.impactStress = 60
  outputCard.deliveryProfiles[0].dosage.contactsPerSet = 6
  const output = generateCanonicalWorkout({ ...intent, maxHighImpactContacts: 4 }, cards)
  assert.equal(output.validation.impactBudget.highImpactContacts, 4)
  assert.equal(output.diagnostics.repairs.length, 1)
  assert.equal(output.diagnostics.repairs[0].repairType, 'adjust_dose_reduce_impact')
  assert.equal(output.diagnostics.repairs[0].beforeScore, 1)
  assert.equal(output.diagnostics.repairs[0].afterScore, 100)
})

test('anatomy load profile supplies landing contacts when a dosage override is absent', () => {
  const cards = library()
  const outputCard = cards.find((entry) => entry.deliveryProfiles[0].phaseKey === 'output')
  outputCard.taskDemands.impactToleranceDemand = 60
  outputCard.stressProfile.impactStress = 60
  outputCard.loadProfile = {
    gripDemand: 1,
    spinalLoading: 5,
    eccentricStress: 30,
    landingContactsPerRep: 2,
    externalLoadMethod: 'bodyweight',
  }
  outputCard.anatomy = {
    primaryMuscles: ['quadriceps'],
    joints: ['hip', 'knee', 'ankle'],
    planes: ['sagittal'],
    laterality: 'bilateral',
  }
  const output = generateCanonicalWorkout({ ...intent, maxHighImpactContacts: 100 }, cards)
  const prescription = output.phases.find((phase) => phase.phaseKey === 'output').prescriptions[0]
  assert.equal(prescription.dose.contacts, prescription.dose.sets * prescription.dose.reps * 2)
  assert.deepEqual(prescription.anatomy.planes, ['sagittal'])
  assert.equal(prescription.loadProfile.externalLoadMethod, 'bodyweight')
})

test('bounded contact exposure profiles use their documented planning default for workout budgets', () => {
  const cards = library()
  const outputCard = cards.find((entry) => entry.deliveryProfiles[0].phaseKey === 'output')
  outputCard.taskDemands.impactToleranceDemand = 60
  outputCard.stressProfile.impactStress = 60
  outputCard.loadProfile = {
    gripDemand: 1,
    spinalLoading: 5,
    eccentricStress: 30,
    contactExposureModel: {
      model: 'per_set_range',
      minimumContactsPerSet: 8,
      planningDefaultContactsPerSet: 12,
      maximumContactsPerSet: 16,
    },
    externalLoadMethod: 'bodyweight',
  }
  const output = generateCanonicalWorkout({ ...intent, maxHighImpactContacts: 100 }, cards)
  const prescription = output.phases.find((phase) => phase.phaseKey === 'output').prescriptions[0]
  assert.equal(prescription.dose.contacts, prescription.dose.sets * 12)
  assert.equal(output.validation.impactBudget.highImpactContacts, prescription.dose.contacts)
})

test('cumulative fatigue budgets fail closed before selecting an over-budget phase', () => {
  const cards = library().map((entry) => ({
    ...entry,
    loadProfile: {
      gripDemand: 100,
      spinalLoading: 100,
      eccentricStress: 100,
      landingContactsPerRep: 0,
      externalLoadMethod: 'bodyweight',
    },
    fatigueProfile: {
      localMuscleFatigue: 100,
      gripFatigue: 100,
      technicalFatigueSensitivity: 100,
      impactAccumulation: 100,
      recoveryHours: 48,
    },
  }))
  assert.throws(
    () => generateCanonicalWorkout({
      ...intent,
      fatigueBudgets: {
        grip: 1,
        localMuscle: 1,
        spinalLoading: 1,
        eccentricStress: 1,
        impactAccumulation: 1,
        technicalSensitivity: 1,
      },
    }, cards),
    (error) => error instanceof CanonicalGenerationError
      && error.code === 'unsatisfiable_workload_budget'
      && error.details.fatigueBudgets.grip === 1,
  )
})

test('cumulative exact-variant stress budgets fail closed before composition', () => {
  const cards = library().map((entry) => ({
    ...entry,
    stressProfile: { ...entry.stressProfile, jointStress: 100 },
  }))
  assert.throws(
    () => generateCanonicalWorkout({
      ...intent,
      stressBudgets: { jointStress: 1 },
    }, cards),
    (error) => error instanceof CanonicalGenerationError
      && error.code === 'unsatisfiable_workload_budget'
      && error.details.stressBudgets.jointStress === 1,
  )
})

test('unpublished and video-incomplete cards never enter production pools', () => {
  const cards = library()
  const restore = cards.find((entry) => entry.deliveryProfiles[0].phaseKey === 'restore')
  restore.status = 'review'
  restore.media = {}
  assert.throws(
    () => generateCanonicalWorkout(intent, cards),
    (error) => error instanceof CanonicalGenerationError
      && error.code === 'unsatisfiable_phase'
      && error.details.rejectionCounts.status_not_published >= 1,
  )
})

test('swap candidates use only approved loaded graph edges and reapply hard gates', () => {
  const cards = library()
  const source = cards.find((entry) => entry.deliveryProfiles[0].phaseKey === 'capacity')
  const safe = card('capacity', {
    id: 'incline-push-up',
    variantId: 'incline-push-up-variant',
    slug: 'incline-push-up',
    canonicalName: 'Incline Push-Up',
    familyId: 'push-up',
  })
  const unavailable = card('capacity', {
    id: 'barbell-bench-press',
    variantId: 'barbell-bench-press-variant',
    slug: 'barbell-bench-press',
    canonicalName: 'Barbell Bench Press',
    familyId: 'press',
    equipment: { required: ['barbell'], quantityPerStation: { barbell: 1 } },
    equipmentRoles: [{ key: 'barbell', role: 'required', quantityPerStation: 1, conditions: {} }],
  })
  source.relationships = [
    {
      id: 'edge-safe',
      toVariantId: safe.variantId,
      type: 'regression',
      similarityScore: 95,
      dimensions: ['leverage'],
      reason: 'Reduces relative load using a higher surface.',
    },
    {
      id: 'edge-unavailable',
      toVariantId: unavailable.variantId,
      type: 'equipment_equivalent',
      similarityScore: 90,
      dimensions: ['load'],
      reason: 'Changes the loading tool.',
    },
  ]
  const swaps = listCanonicalSwapCandidates(intent, [...cards, safe, unavailable], {
    exerciseId: source.id,
    variantId: source.variantId ?? source.id,
    phaseKey: 'capacity',
  })
  assert.deepEqual(swaps.map((swap) => swap.variantId), ['incline-push-up-variant'])
  assert.equal(swaps[0].relationshipType, 'regression')
})

test('substitution graph cannot discard an explicitly preserved focus', () => {
  const cards = library()
  const source = cards.find((entry) => entry.deliveryProfiles[0].phaseKey === 'capacity')
  source.taxonomyV2 = {
    assignments: [approvedTaxonomy('training_family', 'calisthenics')],
    decisions: [],
  }
  const nonMatching = card('capacity', {
    id: 'dumbbell-press',
    variantId: 'dumbbell-press-variant',
    slug: 'dumbbell-press',
    canonicalName: 'Dumbbell Press',
    familyId: 'press',
  })
  nonMatching.taxonomyV2 = {
    assignments: [approvedTaxonomy('training_family', 'general_resistance')],
    decisions: [],
  }
  source.relationships = [{
    id: 'edge-family-loss',
    toVariantId: nonMatching.variantId,
    type: 'lateral_substitution',
    similarityScore: 96,
    dimensions: ['training_family'],
    reason: 'Similar press pattern but a different requested training family.',
  }]
  const swaps = listCanonicalSwapCandidates({
    ...intent,
    objective: 'strength_priority',
    focuses: [{
      facet: 'training_family', value: 'calisthenics', scope: 'anchor_exercises',
      strength: 'preferred', preserveOnSubstitution: true,
    }],
  }, [...cards, nonMatching], {
    exerciseId: source.id,
    variantId: source.variantId ?? source.id,
    phaseKey: 'capacity',
  })
  assert.deepEqual(swaps, [])
})

test('controlled swap replaces only the requested prescription and revalidates the whole workout', () => {
  const cards = library()
  const source = cards.find((entry) => entry.deliveryProfiles[0].phaseKey === 'capacity')
  const safe = card('capacity', {
    id: 'incline-push-up',
    variantId: 'incline-push-up-variant',
    slug: 'incline-push-up',
    canonicalName: 'Incline Push-Up',
    familyId: 'push-up',
  })
  source.relationships = [{
    id: 'edge-safe',
    toVariantId: safe.variantId,
    type: 'regression',
    similarityScore: 95,
    dimensions: ['leverage'],
    reason: 'Reduces relative load using a higher surface.',
  }]
  const allCards = [...cards, safe]
  const output = generateCanonicalWorkout(intent, allCards)
  const beforeCount = output.phases.reduce((sum, phase) => sum + phase.prescriptions.length, 0)
  const swapped = applyCanonicalWorkoutSwap(output, allCards, {
    phaseKey: 'capacity',
    sourceVariantId: source.id,
    sourceExerciseId: source.id,
    targetVariantId: safe.variantId,
  })
  assert.equal(swapped.validation.status, 'passed')
  assert.equal(swapped.phases.reduce((sum, phase) => sum + phase.prescriptions.length, 0), beforeCount)
  assert.ok(swapped.phases.find((phase) => phase.phaseKey === 'capacity').prescriptions
    .some((item) => item.variantId === safe.variantId))
  assert.equal(swapped.diagnostics.swaps[0].relationshipId, 'edge-safe')
  assert.notEqual(swapped.workoutId, output.workoutId)
})

test('single-workout flow selects, budgets, substitutes, persists, and renders both audiences', async () => {
  const cards = library().map((entry) => ({
    ...entry,
    loadProfile: {
      gripDemand: 10,
      spinalLoading: 10,
      eccentricStress: 10,
      landingContactsPerRep: entry.deliveryProfiles[0].phaseKey === 'output' ? 1 : 0,
      externalLoadMethod: 'bodyweight',
    },
    fatigueProfile: {
      localMuscleFatigue: 20,
      gripFatigue: 10,
      technicalFatigueSensitivity: 15,
      impactAccumulation: entry.deliveryProfiles[0].phaseKey === 'output' ? 25 : 5,
      recoveryHours: 24,
    },
  }))
  const source = cards.find((entry) => entry.deliveryProfiles[0].phaseKey === 'capacity')
  source.variantId = 'capacity-source-variant'
  const substitute = card('capacity', {
    id: 'capacity-regression',
    variantId: 'capacity-regression-variant',
    slug: 'capacity-regression',
    canonicalName: 'Capacity Regression',
    displayName: 'Capacity Regression',
    familyId: 'capacity-regression',
    loadProfile: source.loadProfile,
    fatigueProfile: source.fatigueProfile,
  })
  source.relationships = [{
    id: 'approved-regression-edge',
    toVariantId: substitute.variantId,
    type: 'regression',
    similarityScore: 95,
    dimensions: ['leverage'],
    reason: 'Reduces leverage while retaining the same capacity intent.',
  }]
  const allCards = [...cards, substitute]
  const generated = generateCanonicalWorkout({
    ...intent,
    maxHighImpactContacts: 20,
    fatigueBudgets: {
      grip: 100, localMuscle: 100, spinalLoading: 100,
      eccentricStress: 100, impactAccumulation: 100, technicalSensitivity: 100,
    },
  }, allCards, { libraryVersion: 'production-fixture-1' })
  const swapped = applyCanonicalWorkoutSwap(generated, allCards, {
    phaseKey: 'capacity',
    sourceVariantId: source.variantId,
    sourceExerciseId: source.id,
    targetVariantId: substitute.variantId,
  })

  let persisted
  const pool = {
    async query(sql, params) {
      persisted = { sql, params }
      return { rows: [{ id: '20000000-0000-4000-8000-000000000001' }] }
    },
  }
  const savedId = await persistCanonicalWorkout(
    pool,
    1,
    2,
    { id: '30000000-0000-4000-8000-000000000001' },
    swapped,
  )
  assert.equal(savedId, '20000000-0000-4000-8000-000000000001')
  assert.equal(swapped.validation.status, 'passed')
  assert.ok(swapped.validation.impactBudget.highImpactContacts
    <= swapped.validation.impactBudget.maximumHighImpactContacts)
  assert.equal(swapped.validation.fatigueBudget.withinBudget, true)
  assert.equal(swapped.phases.reduce((sum, phase) => sum + phase.targetMinutes, 0), 60)
  assert.ok(swapped.phases.every((phase) => phase.prescriptions.every((item) => item.logistics.equipmentFeasible)))
  assert.ok(swapped.views.coach.phases.every((phase) => phase.prescriptions.every((item) => item.coachInstructions)))
  assert.ok(swapped.views.athlete.exercises.every((item) => item.instructions && item.stopRules.length > 0))
  assert.equal(swapped.views.athlete.diagnostics, undefined)
  assert.match(persisted.sql, /generated_workout_v1/)
  assert.deepEqual(JSON.parse(persisted.params[9]).views, swapped.views)
})
