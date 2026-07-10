import assert from 'node:assert/strict'
import test from 'node:test'
import {
  exerciseViolatesEquipmentAvoid,
  inferAvoidedEquipmentKeys,
  EQUIPMENT_AVOID_ALIASES,
  exerciseAllowedUseOnly,
} from '../equipmentAvoidPolicy.js'

test('bar avoid alias includes pull_up_bar keys', () => {
  assert.ok(EQUIPMENT_AVOID_ALIASES.bar.includes('pull_up_bar'))
})

test('inferAvoidedEquipmentKeys detects hang from slug', () => {
  const keys = inferAvoidedEquipmentKeys({ slug: 'active-hang', name: 'Active Hang' }, ['bar'])
  assert.ok(keys.includes('bar'))
})

test('exerciseViolatesEquipmentAvoid uses semantic fallback when untagged', () => {
  const exercise = { slug: 'drop-landing-stick', name: 'Drop Landing to Stick' }
  const violated = exerciseViolatesEquipmentAvoid(exercise, [], new Set(), ['box'])
  assert.equal(violated, true)
})

test('box breathing restore card is not excluded when avoiding plyo box', () => {
  const exercise = { slug: 'box-breathing-hold-restore', name: 'Box Breathing Hold' }
  const keys = inferAvoidedEquipmentKeys(exercise, ['box'])
  assert.deepEqual(keys, [])
  assert.equal(exerciseViolatesEquipmentAvoid(exercise, [], new Set(), ['box']), false)
  assert.equal(exerciseViolatesEquipmentAvoid(exercise, [{ facetId: 99 }], new Set([99]), ['box']), false)
})

test('exerciseAllowedUseOnly permits untagged exercises when bodyweight allowed', () => {
  const allowed = new Set([10])
  const bw = new Set([1])
  assert.equal(exerciseAllowedUseOnly([], allowed, true, bw), true)
  assert.equal(exerciseAllowedUseOnly([], allowed, false, bw), false)
})

test('exerciseAllowedUseOnly permits mixed allowed and bodyweight tags', () => {
  const allowed = new Set([10])
  const bw = new Set([1])
  assert.equal(exerciseAllowedUseOnly([{ facetId: 10 }, { facetId: 1 }], allowed, true, bw), true)
  assert.equal(exerciseAllowedUseOnly([{ facetId: 10 }, { facetId: 99 }], allowed, true, bw), false)
})

test('exerciseAllowedUseOnly requires only allowed tags when bodyweight disallowed', () => {
  const allowed = new Set([10])
  assert.equal(exerciseAllowedUseOnly([{ facetId: 10 }], allowed, false, new Set([1])), true)
  assert.equal(exerciseAllowedUseOnly([{ facetId: 1 }], allowed, false, new Set([1])), false)
})
