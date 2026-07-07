import assert from 'node:assert/strict'
import test from 'node:test'
import {
  restoreCandidateExcluded,
  restoreProfileEligible,
  restoreScoreBoost,
} from '../restoreSelectionPolicy.js'

const methodologyKeyById = new Map([
  [1, 'plyometrics'],
  [2, 'mobility_flexibility'],
  [3, 'hiit'],
])

test('restore rejects output-primary med-ball throw', () => {
  const exercise = {
    slug: 'step-behind-rotational-medicine-ball-throw',
    name: 'Step-Behind Rotational Medicine Ball Throw',
    primary_phase_key: 'output',
  }
  const profile = { role: 'conditional', impactLevel: 1, intensityCeiling: 'low', orderSlot: 'cooldown_breathing' }
  assert.equal(restoreProfileEligible(exercise, profile), false)
  assert.equal(restoreCandidateExcluded(exercise, profile, [{ facetType: 'methodology', facetId: 2 }], methodologyKeyById), true)
})

test('restore accepts restore-primary breathing card', () => {
  const exercise = {
    slug: '9090-breathing-with-reach',
    name: '90/90 Breathing with Reach',
    primary_phase_key: 'restore',
  }
  const profile = { role: 'primary', impactLevel: 0, intensityCeiling: 'low', orderSlot: 'cooldown_breathing', fatigueCost: 1 }
  assert.equal(restoreProfileEligible(exercise, profile), true)
  assert.equal(restoreCandidateExcluded(exercise, profile, [{ facetType: 'methodology', facetId: 2 }], methodologyKeyById), false)
  assert.ok(restoreScoreBoost(exercise, profile, [{ facetType: 'methodology', facetId: 2 }], methodologyKeyById) >= 10)
})
