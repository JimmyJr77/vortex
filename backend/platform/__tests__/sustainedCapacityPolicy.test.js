import assert from 'node:assert/strict'
import test from 'node:test'
import {
  hasSustainedConditioningFocus,
  minItemsForPhase,
  phaseFillTarget,
  sustainedCapacityCandidateEligible,
} from '../sustainedCapacityPolicy.js'

test('conditioning focus on Sustained requires 2 items in sustained_capacity', () => {
  const targets = [{ facetType: 'methodology', facetKey: 'hiit' }]
  assert.ok(hasSustainedConditioningFocus(targets))
  assert.equal(minItemsForPhase('sustained_capacity', targets), 2)
  assert.equal(minItemsForPhase('sustained_capacity', []), 1)
})

test('short sustained block uses 0.8 fill target when conditioning focused', () => {
  assert.equal(phaseFillTarget('sustained_capacity', [{ facetType: 'methodology', facetKey: 'hiit' }], 4), 0.8)
})

test('sustained conditioning candidate requires methodology or intent tag', () => {
  const methodologyKeyById = new Map([[1, 'hiit']])
  const intentKeyById = new Map([[2, 'conditioning']])
  const exercise = { primary_phase_key: 'output' }
  const tags = [{ facetType: 'methodology', facetId: 1 }]
  assert.ok(sustainedCapacityCandidateEligible(exercise, tags, methodologyKeyById, intentKeyById))
  const intentOnly = [{ facetType: 'intent', facetId: 2 }]
  assert.ok(sustainedCapacityCandidateEligible(exercise, intentOnly, methodologyKeyById, intentKeyById, { strictConditioningMethodology: false }))
})
