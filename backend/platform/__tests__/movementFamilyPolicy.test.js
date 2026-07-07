import assert from 'node:assert/strict'
import test from 'node:test'
import {
  movementFamilyBlocked,
  movementFamilyKey,
  movementFamilyLimit,
  recordMovementFamily,
} from '../movementFamilyPolicy.js'

test('detects pogo family from slug', () => {
  assert.equal(movementFamilyKey({ slug: 'single-leg-pogo-in-place', name: 'Single-Leg Pogo' }), 'pogo')
})

test('output phase caps pogo family at 2', () => {
  assert.equal(movementFamilyLimit('output'), 2)
  const familyCounts = new Map()
  const sessionFamilyCounts = new Map()
  recordMovementFamily('pogo', 'output', familyCounts, sessionFamilyCounts)
  recordMovementFamily('pogo', 'output', familyCounts, sessionFamilyCounts)
  assert.equal(movementFamilyBlocked('pogo', 'output', familyCounts, sessionFamilyCounts), true)
})
