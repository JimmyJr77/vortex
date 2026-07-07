import assert from 'node:assert/strict'
import test from 'node:test'
import {
  hasHiitFocus,
  minItemsForPhase,
  maxItemsForPhase,
  phaseFillTarget,
  sustainedCapacityCandidateEligible,
} from '../sustainedCapacityPolicy.js'

test('HIIT focus requires 2 items in sustained_capacity', () => {
  const targets = [{ facetType: 'methodology', facetKey: 'hiit' }]
  assert.equal(minItemsForPhase('sustained_capacity', targets), 2)
  assert.ok(hasHiitFocus(targets))
})

test('prepare requires 2 min items', () => {
  assert.equal(minItemsForPhase('prepare_and_access', []), 2)
})

test('small sustained block has 80% fill target', () => {
  assert.equal(phaseFillTarget('sustained_capacity', [{ facetType: 'methodology', facetKey: 'hiit' }], 4), 0.8)
})

test('prepare max items scales with block minutes', () => {
  assert.equal(maxItemsForPhase('prepare_and_access', 10), 5)
  assert.equal(maxItemsForPhase('prepare_and_access', 4), 2)
  assert.equal(maxItemsForPhase('restore', 12), 3)
})

test('sustained HIIT candidate requires hiit methodology tag', () => {
  const methodologyKeyById = new Map([[1, 'hiit']])
  const intentKeyById = new Map([[2, 'conditioning']])
  const exercise = { primary_phase_key: 'sustained_capacity', phase_subrole: 'conditioning_intervals' }
  const tags = [{ facetType: 'methodology', facetId: 1 }]
  assert.equal(sustainedCapacityCandidateEligible(exercise, tags, methodologyKeyById, intentKeyById), true)
})
