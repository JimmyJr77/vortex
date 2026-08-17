import test from 'node:test'
import assert from 'node:assert/strict'

import {
  assertCanonicalPhaseOrder,
  convertLegacyScore,
  deriveOverallDifficulty,
  normalizeWorkoutIntent,
  score100,
  validateExerciseCard,
} from '../canonicalWorkoutContract.js'

test('score100 accepts only integer 1-100 scores and null', () => {
  assert.equal(score100(null), null)
  assert.equal(score100(1), 1)
  assert.equal(score100(100), 100)
  assert.throws(() => score100(0), /1 to 100/)
  assert.throws(() => score100(10.5), /integer/)
})

test('legacy conversion preserves provenance and queues review', () => {
  assert.deepEqual(convertLegacyScore(4, 5), {
    value: 80, legacyValue: 4, legacyScale: 5, confidence: 40, reviewRequired: true,
  })
  assert.equal(convertLegacyScore(7, 10).value, 70)
  assert.equal(convertLegacyScore(0, 10).value, null)
  assert.equal(convertLegacyScore(0, 10, 'negligible').value, 1)
})

test('overall exercise difficulty is derived from technical and physical difficulty', () => {
  assert.equal(deriveOverallDifficulty(30, 45), 45)
  assert.equal(deriveOverallDifficulty(70, 45), 70)
  assert.throws(() => deriveOverallDifficulty(null, 45), /technicalComplexity is required/)
})

test('intent normalization rejects contradictions and preserves deterministic seed', () => {
  const intent = normalizeWorkoutIntent({
    durationMinutes: 60,
    athleteCount: 12,
    coachCount: 1,
    ageMin: 8,
    ageMax: 10,
    equipmentAvailable: ['bodyweight'],
    randomSeed: 'golden-1',
  })
  assert.equal(intent.randomSeed, 'golden-1')
  assert.deepEqual(intent.equipmentAvailable, ['none'])
  assert.equal(intent.maxDifficulty, 60)
  assert.equal(intent.trainingExperience, 'beginner')
  assert.equal(Object.hasOwn(intent, 'skillLevel'), false)
  assert.throws(() => normalizeWorkoutIntent({
    durationMinutes: 60, athleteCount: 1, coachCount: 1, ageMin: 10, ageMax: 8,
  }), /ageMin/)
  assert.throws(() => normalizeWorkoutIntent({
    durationMinutes: 60, athleteCount: 1, coachCount: 1, ageMin: 8, ageMax: 10,
    equipmentRequired: ['barbell'], equipmentAvoid: ['barbell'],
  }), /both required and avoided/)
})

test('intent v2 normalizes phase emphasis and controlled scoped focuses', () => {
  const intent = normalizeWorkoutIntent({
    durationMinutes: 60,
    athleteCount: 12,
    coachCount: 1,
    ageMin: 8,
    ageMax: 10,
    phaseEmphasis: { output: 100, capacity: 40 },
    focuses: [{
      facet: 'training_family',
      value: 'olympic_weightlifting',
      scope: ['movement_intelligence', 'output', 'capacity'],
      strength: 'required',
      weight: 100,
    }],
  })
  assert.deepEqual(intent.phaseEmphasis, { output: 100, capacity: 40 })
  assert.deepEqual(intent.focuses[0].scopes, ['movement_intelligence', 'output', 'capacity'])
  assert.equal(intent.focuses[0].preserveOnSubstitution, true)
  assert.throws(() => normalizeWorkoutIntent({
    durationMinutes: 60, athleteCount: 1, coachCount: 1, ageMin: 8, ageMax: 10,
    focuses: [{ facet: 'training_family', value: 'invented_family' }],
  }), /Unknown Taxonomy v2 focus/)
})

test('intent rejects unknown equipment keys and quantities for unavailable equipment', () => {
  const base = {
    durationMinutes: 60,
    athleteCount: 8,
    coachCount: 1,
    ageMin: 8,
    ageMax: 10,
    equipmentAvailable: ['bodyweight'],
  }
  assert.throws(() => normalizeWorkoutIntent({
    ...base,
    equipmentAvailable: ['mystery_implement'],
  }), /unknown controlled equipment keys/)
  assert.throws(() => normalizeWorkoutIntent({
    ...base,
    equipmentQuantities: { dumbbell: 8 },
  }), /quantity was supplied for unavailable equipment/)
})

test('intent normalizes direct controlled equipment aliases without accepting ambiguous labels', () => {
  const intent = normalizeWorkoutIntent({
    durationMinutes: 60,
    athleteCount: 8,
    coachCount: 1,
    ageMin: 8,
    ageMax: 10,
    equipmentAvailable: ['bodyweight', 'cone'],
    equipmentQuantities: { cone: 8 },
  })
  assert.deepEqual(intent.equipmentAvailable, ['none', 'cones'])
  assert.deepEqual(intent.equipmentQuantities, { cones: 8 })
  assert.throws(() => normalizeWorkoutIntent({
    durationMinutes: 60, athleteCount: 8, coachCount: 1, ageMin: 8, ageMax: 10,
    equipmentAvailable: ['rope'],
  }), /unknown controlled equipment keys/)
})

test('canonical phase order allows omissions but not reordering', () => {
  assert.equal(assertCanonicalPhaseOrder(['prepare_and_access', 'output', 'capacity', 'restore']), true)
  assert.throws(() => assertCanonicalPhaseOrder(['capacity', 'output']), /canonical order/)
})

test('publication gate rejects incomplete production cards', () => {
  const result = validateExerciseCard({
    id: 'push-up',
    slug: 'push-up',
    canonicalName: 'Push-Up',
    cardVersion: 1,
    schemaVersion: '1.0.0',
    status: 'published',
    familyId: 'push-up',
    deliveryProfiles: [{ id: 'controlled-strength', phaseKey: 'capacity' }],
    difficulty: { technicalComplexity: 30, baseOverallDifficulty: 40 },
  })
  assert.equal(result.valid, false)
  assert.ok(result.errors.some((error) => error.includes('approved demonstration video')))
  assert.ok(result.errors.some((error) => error.includes('confidence')))
  assert.ok(result.errors.some((error) => error.includes('difficulty.absoluteLoadDemand')))
})

test('exercise cards reject skill-level metadata and retain difficulty as the assessment model', () => {
  const result = validateExerciseCard({
    id: 'push-up',
    slug: 'push-up',
    canonicalName: 'Push-Up',
    cardVersion: 1,
    schemaVersion: '1.0.0',
    status: 'review',
    familyId: 'push-up',
    deliveryProfiles: [{ id: 'controlled-strength', phaseKey: 'capacity' }],
    difficulty: {
      technicalComplexity: 30,
      absoluteLoadDemand: 35,
      baseOverallDifficulty: 35,
    },
    scaling: { minimumSkillLevel: 'beginner' },
  })
  assert.equal(result.valid, false)
  assert.ok(result.errors.some((error) => error.includes('scaling.minimumSkillLevel')))
})

test('exercise cards reject an independently inflated overall difficulty', () => {
  const result = validateExerciseCard({
    id: 'push-up',
    slug: 'push-up',
    canonicalName: 'Push-Up',
    cardVersion: 1,
    schemaVersion: '1.0.0',
    status: 'review',
    familyId: 'push-up',
    deliveryProfiles: [{ id: 'controlled-strength', phaseKey: 'capacity' }],
    difficulty: {
      technicalComplexity: 30,
      absoluteLoadDemand: 35,
      baseOverallDifficulty: 60,
    },
  })
  assert.equal(result.valid, false)
  assert.ok(result.errors.some((error) => error.includes('must equal the greater')))
})

test('exercise cards cannot retain an overall score without both core dimensions', () => {
  const result = validateExerciseCard({
    id: 'push-up',
    slug: 'push-up',
    canonicalName: 'Push-Up',
    cardVersion: 1,
    schemaVersion: '1.0.0',
    status: 'review',
    familyId: 'push-up',
    deliveryProfiles: [{ id: 'controlled-strength', phaseKey: 'capacity' }],
    difficulty: {
      technicalComplexity: 30,
      baseOverallDifficulty: 30,
    },
  })
  assert.equal(result.valid, false)
  assert.ok(result.errors.some((error) => error.includes('requires both')))
})
