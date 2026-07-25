import test from 'node:test'
import assert from 'node:assert/strict'

import {
  assertCanonicalPhaseOrder,
  convertLegacyScore,
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
  assert.equal(intent.maxDifficulty, 60)
  assert.throws(() => normalizeWorkoutIntent({
    durationMinutes: 60, athleteCount: 1, coachCount: 1, ageMin: 10, ageMax: 8,
  }), /ageMin/)
  assert.throws(() => normalizeWorkoutIntent({
    durationMinutes: 60, athleteCount: 1, coachCount: 1, ageMin: 8, ageMax: 10,
    equipmentRequired: ['barbell'], equipmentAvoid: ['barbell'],
  }), /both required and avoided/)
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
})
