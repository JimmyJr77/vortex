import test from 'node:test'
import assert from 'node:assert/strict'

import {
  CANONICAL_QUALITY_CATEGORY_NAMES,
  evaluateCanonicalWorkoutQuality,
} from '../canonicalQualityEvaluation.js'
import { generateCanonicalWorkout } from '../canonicalDeterministicEngine.js'
import { BASE_GOLDEN_INTENT, goldenLibrary } from './canonicalGoldenFixtures.js'

test('canonical evaluator returns all 38 categories on 1-100 or null scales', () => {
  const output = generateCanonicalWorkout(BASE_GOLDEN_INTENT, goldenLibrary(), {
    libraryVersion: 'quality-fixture-1',
  })
  const evaluation = evaluateCanonicalWorkoutQuality(output)
  assert.equal(Object.keys(evaluation.categories).length, 38)
  assert.deepEqual(Object.keys(evaluation.categories), [...CANONICAL_QUALITY_CATEGORY_NAMES])
  assert.ok(Object.values(evaluation.categories).every((score) => (
    score == null || (Number.isInteger(score) && score >= 1 && score <= 100)
  )))
  assert.equal(evaluation.safetyScore, 100)
  assert.equal(evaluation.logisticsFeasibilityScore, 100)
  assert.equal(evaluation.hardViolationCount, 0)
})

test('golden workout meets canonical overall quality target', () => {
  const output = generateCanonicalWorkout(BASE_GOLDEN_INTENT, goldenLibrary(), {
    libraryVersion: 'quality-fixture-1',
  })
  assert.ok(output.overallQualityScore >= 90)
  assert.equal(output.qualityEvaluation.categories.phase_intent >= 90, true)
  assert.equal(output.qualityEvaluation.categories.athlete_age_fit, 100)
})
