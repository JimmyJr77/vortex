import assert from 'node:assert/strict'
import test from 'node:test'
import {
  exerciseViolatesEquipmentAvoid,
  inferAvoidedEquipmentKeys,
  EQUIPMENT_AVOID_ALIASES,
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
