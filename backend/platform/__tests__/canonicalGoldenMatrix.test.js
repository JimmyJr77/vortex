import test from 'node:test'
import assert from 'node:assert/strict'

import { validatedAiInterpretationToIntent, AiIntentError } from '../canonicalAiIntent.js'
import { CanonicalGenerationError, generateCanonicalWorkout } from '../canonicalDeterministicEngine.js'
import { BASE_GOLDEN_INTENT, goldenCard, goldenLibrary } from './canonicalGoldenFixtures.js'

function generate(overrides = {}, library = goldenLibrary()) {
  return generateCanonicalWorkout({ ...BASE_GOLDEN_INTENT, ...overrides }, library, {
    libraryVersion: 'golden-1',
    ruleVersion: 'golden-rules-1',
  })
}

function ids(output) {
  return output.phases.flatMap((phase) => phase.prescriptions.map((item) => item.exerciseId))
}

function assertFloorReady(output, duration) {
  assert.equal(output.validation.status, 'passed')
  assert.equal(output.validation.errors.length, 0)
  assert.ok(Math.abs(output.validation.durationReconciliation.estimatedMinutes - duration) <= output.validation.durationReconciliation.toleranceMinutes)
  assert.ok(output.phases.every((phase) => phase.prescriptions.length > 0))
  assert.ok(output.phases.every((phase) => phase.prescriptions.every((item) => (
    item.deliveryProfileId && item.videoUrl && item.qualityGate && item.stopRules.length > 0
  ))))
}

test('G01 youth beginner bodyweight group, one coach, 60 minutes', () => {
  const output = generate()
  assertFloorReady(output, 60)
  assert.ok(output.phases.every((phase) => phase.prescriptions.every((item) => item.technicalRiskScore <= 60)))
  assert.ok(output.validation.impactBudget.highImpactContacts <= output.validation.impactBudget.maximumHighImpactContacts)
})

test('G02 mixed 10-14 group, two coaches, limited dumbbells and medicine balls, 90 minutes', () => {
  const output = generate({
    durationMinutes: 90, ageMin: 10, ageMax: 14, athleteCount: 16, coachCount: 2,
    equipmentAvailable: ['bodyweight', 'dumbbell', 'medicine_ball'],
    equipmentQuantities: { dumbbell: 8, medicine_ball: 4 },
    athleteCohorts: [
      { key: 'younger', ageMin: 10, ageMax: 11, maxDifficulty: 55 },
      { key: 'older', ageMin: 12, ageMax: 14, maxDifficulty: 65 },
    ],
  })
  assertFloorReady(output, 90)
  assert.ok(output.phases.every((phase) => phase.prescriptions.every((item) => Object.keys(item.cohortScaling).length === 2)))
})

test('G03 advanced speed and explosiveness on field with cones', () => {
  const output = generate({
    durationMinutes: 90, ageMin: 15, ageMax: 17, trainingAgeMonths: 36,
    skillLevel: 'advanced', objective: 'speed_priority', equipmentAvailable: ['bodyweight', 'cone'],
    space: { environment: 'outdoor', floorAreaSquareFeet: 10000, laneLengthFeet: 60 },
    maxDifficulty: 80, maxTechnicalRisk: 80,
  })
  assertFloorReady(output, 90)
  const outputIndex = output.phases.findIndex((phase) => phase.phaseKey === 'output')
  const fitnessIndex = output.phases.findIndex((phase) => phase.phaseKey === 'sustained_capacity')
  assert.ok(outputIndex < fitnessIndex)
})

test('G04 individual youth full-gym strength session', () => {
  const output = generate({
    athleteCount: 1, objective: 'strength_priority',
    equipmentAvailable: ['bodyweight', 'dumbbell', 'barbell'],
    maxDifficulty: 70, maxTechnicalRisk: 70,
  })
  assertFloorReady(output, 60)
  assert.ok(output.phases.find((phase) => phase.phaseKey === 'capacity').targetMinutes >= 25)
})

test('G05 chest focus does not create push-up family spam', () => {
  const output = generate({ exerciseInclude: ['contextual-push-up'] })
  const families = output.phases.flatMap((phase) => phase.prescriptions.map((item) => item.exerciseId === 'contextual-push-up' ? 'push-up' : item.exerciseId))
  assert.equal(families.filter((family) => family === 'push-up').length, 1)
})

test('G06 pull-up goal for athletes without a pull-up selects regression', () => {
  const output = generate({ objective: 'strength_priority', exerciseInclude: ['assisted-pull-up'] })
  assert.ok(ids(output).includes('assisted-pull-up'))
  const item = output.phases.flatMap((phase) => phase.prescriptions).find((entry) => entry.exerciseId === 'assisted-pull-up')
  assert.match(item.purpose, /below strict pull-up strength/i)
})

test('G07 HIIT excludes high-skill Olympic lifts', () => {
  const output = generate({
    objective: 'fitness_priority',
    ageMin: 15, ageMax: 17, trainingAgeMonths: 36,
    equipmentAvailable: ['bodyweight', 'barbell'],
    maxDifficulty: 100, maxTechnicalRisk: 100,
  })
  assert.ok(!ids(output).includes('hiit-olympic-lift'))
  assert.ok(output.diagnostics.rejectionCounts.hiit_technical_complexity >= 1)
})

test('G08 supervised Olympic technique prioritizes technique and recovery', () => {
  const output = generate({
    ageMin: 15, ageMax: 17, trainingAgeMonths: 36, athleteCount: 4, coachCount: 2,
    objective: 'strength_priority', equipmentAvailable: ['bodyweight', 'barbell'],
    equipmentQuantities: { barbell: 4 }, maxDifficulty: 90, maxTechnicalRisk: 90,
    exerciseInclude: ['olympic-lift-technique'],
  })
  const item = output.phases.flatMap((phase) => phase.prescriptions).find((entry) => entry.exerciseId === 'olympic-lift-technique')
  assert.ok(item)
  assert.match(item.qualityGate, /every repetition/i)
  assert.ok(item.dose.restSeconds >= 60)
})

test('high-supervision exercises are excluded when coach capacity is insufficient', () => {
  const output = generate({
    ageMin: 15,
    ageMax: 17,
    trainingAgeMonths: 36,
    athleteCount: 12,
    coachCount: 1,
    objective: 'strength_priority',
    equipmentAvailable: ['bodyweight', 'barbell'],
    equipmentQuantities: { barbell: 12 },
    maxDifficulty: 90,
    maxTechnicalRisk: 90,
    exerciseInclude: ['olympic-lift-technique'],
  })
  assert.ok(!ids(output).includes('olympic-lift-technique'))
  assert.ok(output.diagnostics.rejectionCounts.coach_supervision_capacity >= 1)
})

test('G09 low-impact conditioning obeys impact cap', () => {
  const output = generate({ objective: 'fitness_priority', limitations: ['low_impact'] })
  assert.ok(!ids(output).includes('output-1'))
  assert.ok(output.diagnostics.rejectionCounts.low_impact_cap >= 1)
})

test('G10 no-jumping limitation removes all jump, land, and bound cards', () => {
  const output = generate({ limitations: ['no_jumping'] })
  assert.ok(!ids(output).includes('output-1'))
  assert.ok(output.diagnostics.rejectionCounts.no_jumping >= 1)
})

test('G11 avoided body region is excluded', () => {
  assert.throws(
    () => generate({ bodyRegionAvoid: ['full_body'] }),
    (error) => error instanceof CanonicalGenerationError && error.code === 'unsatisfiable_phase',
  )
})

test('G12 required and avoided equipment contradiction fails before selection', () => {
  assert.throws(
    () => generate({ equipmentRequired: ['barbell'], equipmentAvoid: ['barbell'] }),
    /both required and avoided/,
  )
})

test('required equipment must actually appear in the final prescription', () => {
  const output = generate({
    ageMin: 15,
    ageMax: 17,
    trainingAgeMonths: 36,
    athleteCount: 2,
    coachCount: 1,
    equipmentAvailable: ['bodyweight', 'barbell'],
    equipmentRequired: ['barbell'],
    equipmentQuantities: { barbell: 2 },
    maxDifficulty: 90,
    maxTechnicalRisk: 90,
    exerciseInclude: ['olympic-lift-technique'],
  })
  assert.ok(output.phases.some((phase) => phase.prescriptions.some((item) => item.equipment.includes('barbell'))))
})

test('G13 minimal equipment and small indoor space remains feasible', () => {
  const output = generate({
    athleteCount: 4,
    space: { environment: 'indoor', floorAreaSquareFeet: 50, laneLengthFeet: 20 },
  })
  assertFloorReady(output, 60)
})

test('G14 large group with limited station capacity produces rotations without queues', () => {
  const output = generate({ athleteCount: 24, coachCount: 2 })
  assert.ok(output.phases.some((phase) => phase.prescriptions.some((item) => item.logistics.stationCount >= 6)))
  assert.ok(output.phases.every((phase) => phase.prescriptions.every((item) => item.logistics.queueRisk === 1)))
})

test('G15 mixed younger and older cohorts receive variants', () => {
  const output = generate({
    ageMin: 8, ageMax: 16,
    athleteCohorts: [
      { key: 'younger', ageMin: 8, ageMax: 11, maxDifficulty: 50 },
      { key: 'older', ageMin: 12, ageMax: 16, maxDifficulty: 70 },
    ],
  })
  assert.ok(output.phases.every((phase) => phase.prescriptions.every((item) => item.cohortScaling.younger && item.cohortScaling.older)))
})

test('G17 60, 90, and 120 minute versions reconcile duration', () => {
  for (const durationMinutes of [60, 90, 120]) {
    const output = generate({ durationMinutes, randomSeed: `duration-${durationMinutes}` })
    assertFloorReady(output, durationMinutes)
  }
})

function aiInterpretation(overrides = {}) {
  return {
    originalRequest: 'Make it athletic but not too hard.',
    interpretedObjective: 'general_athletic_development',
    hardConstraints: {},
    softPreferences: {},
    athleteProfile: { athleteCount: 12, ageMin: 8, ageMax: 10 },
    facilityProfile: { coachCount: 1, equipmentAvailable: ['bodyweight'] },
    uncertainties: [],
    assumptions: [],
    confidence: { objective: 80, constraints: 80 },
    clarificationRequired: false,
    ...overrides,
  }
}

test('G18 ambiguous AI wording requires clarification', () => {
  assert.throws(
    () => validatedAiInterpretationToIntent(aiInterpretation({
      uncertainties: ['Meaning of not too hard'],
      clarificationRequired: true,
      clarificationQuestion: 'What difficulty cap should I use?',
    }), BASE_GOLDEN_INTENT),
    (error) => error instanceof AiIntentError && error.code === 'clarification_required',
  )
})

test('G19 conflicting AI constraints fail closed', () => {
  assert.throws(
    () => validatedAiInterpretationToIntent(aiInterpretation({
      hardConstraints: { equipmentRequired: ['barbell'], equipmentAvoid: ['barbell'] },
    }), BASE_GOLDEN_INTENT),
    (error) => error instanceof AiIntentError && error.code === 'invalid_canonical_intent',
  )
})

test('G20 unsatisfiable request fails with typed phase and rejection evidence', () => {
  const onlyJumpOutput = goldenLibrary().filter((card) => (
    !card.deliveryProfiles.some((profile) => profile.phaseKey === 'output') || card.id === 'output-1'
  ))
  assert.throws(
    () => generate({ limitations: ['no_jumping'] }, onlyJumpOutput),
    (error) => error instanceof CanonicalGenerationError
      && error.code === 'unsatisfiable_phase'
      && error.details.phaseKey === 'output'
      && error.details.rejectionCounts.no_jumping >= 1,
  )
})

test('G21 same request and seed deeply equals across repeated runs', () => {
  const first = generate({ randomSeed: 'repeatable' })
  const second = generate({ randomSeed: 'repeatable' })
  assert.deepEqual(first, second)
})

test('G22 recent-use penalty selects an alternative when pool depth permits', () => {
  const baseline = generate({ randomSeed: 'recent-use' })
  const recent = baseline.phases.flatMap((phase) => phase.prescriptions.map((item) => item.exerciseId))
  const next = generate({ randomSeed: 'recent-use', recentExerciseIds: recent })
  assert.ok(ids(next).some((id) => !recent.includes(id)))
})

test('G23 same movement uses distinct delivery profiles across contexts', () => {
  const contexts = ['prepare_and_access', 'output', 'capacity', 'sustained_capacity']
  const observedProfiles = new Set()
  for (const context of contexts) {
    const library = goldenLibrary().map((card) => (
      card.id === 'contextual-push-up'
        ? { ...card, deliveryProfiles: card.deliveryProfiles.filter((profile) => profile.phaseKey === context) }
        : card
    ))
    const output = generate({ exerciseInclude: ['contextual-push-up'], randomSeed: `context-${context}` }, library)
    const item = output.phases.flatMap((phase) => phase.prescriptions).find((entry) => entry.exerciseId === 'contextual-push-up')
    assert.ok(item)
    assert.equal(item.phaseKey, context)
    assert.match(item.purpose, new RegExp(context))
    observedProfiles.add(item.deliveryProfileId)
  }
  assert.equal(observedProfiles.size, 4)
})

test('G24 controlled modifiers apply only through compatible delivery profiles', () => {
  for (const modifier of ['make_explosive', 'make_isometric', 'make_eccentric', 'reduce_impact', 'remove_equipment']) {
    const output = generate({ modifiers: [modifier], randomSeed: modifier })
    assert.ok(output.phases.every((phase) => phase.prescriptions.every((item) => item.appliedModifiers.includes(modifier))))
    const prescribed = output.phases.flatMap((phase) => phase.prescriptions)
    if (modifier === 'make_explosive') {
      assert.ok(prescribed.every((item) => item.dose.workSeconds <= 20 && item.dose.restSeconds >= 60))
    }
    if (modifier === 'make_isometric') assert.ok(prescribed.every((item) => item.dose.reps == null))
    if (modifier === 'make_eccentric') assert.ok(prescribed.every((item) => item.dose.tempo === '4-1-1'))
    if (modifier === 'reduce_impact') assert.ok(prescribed.every((item) => item.impactScore <= 40))
    if (modifier === 'remove_equipment') assert.ok(prescribed.every((item) => item.equipment.length === 0))
  }
  const incompatible = goldenLibrary().map((card) => ({
    ...card,
    deliveryProfiles: card.deliveryProfiles.map((profile) => ({ ...profile, modifierKeys: [] })),
  }))
  assert.throws(
    () => generate({ modifiers: ['make_explosive'] }, incompatible),
    (error) => error instanceof CanonicalGenerationError
      && Object.keys(error.details.rejectionCounts).includes('invalid_modifier:make_explosive'),
  )
})

test('G25 broken-video and unpublished cards are excluded', () => {
  const library = goldenLibrary()
  library.push(goldenCard('output', 99, {
    id: 'broken-video',
    slug: 'broken-video',
    familyId: 'broken-video',
    status: 'review',
    media: {},
    deliveryProfiles: [{ ...goldenCard('output').deliveryProfiles[0], phaseSuitability: 100 }],
  }))
  const output = generate({}, library)
  assert.ok(!ids(output).includes('broken-video'))
  assert.ok(output.diagnostics.rejectionCounts.status_not_published >= 1)
})
