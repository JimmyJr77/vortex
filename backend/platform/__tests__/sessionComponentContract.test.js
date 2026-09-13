import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeWorkoutIntent, SESSION_PHASE_ORDER } from '../canonicalWorkoutContract.js'
import { normalizeSessionComponentPlan, SESSION_COMPONENT_ORDER } from '../sessionComponentContract.js'

function request(overrides = {}) {
  return {
    durationMinutes: 60,
    equipment: { available: ['dumbbells', 'bench'], quantities: { dumbbells: 15, bench: 5 } },
    components: [
      { key: 'prepare_and_access', budgetSeconds: 600 },
      { key: 'explosiveness', budgetSeconds: 1500 },
      { key: 'strength', budgetSeconds: 1200 },
      { key: 'capacity_competition', budgetSeconds: 300, equipment: { allowed: [] } },
    ],
    ...overrides,
  }
}

test('60 and 90 minute athletic budgets fit exactly without mandatory extra phases', () => {
  const sixty = normalizeSessionComponentPlan(request())
  assert.equal(sixty.bookedSeconds, 3600)
  assert.equal(sixty.reserveSeconds, 0)
  const ninety = normalizeSessionComponentPlan(request({
    durationMinutes: 90,
    components: request().components.map((component, index) => ({
      ...component, budgetSeconds: [900, 1800, 1800, 900][index],
    })),
  }))
  assert.equal(ninety.allocatedSeconds, 5400)
  assert.equal(ninety.reserveSeconds, 0)
  assert.deepEqual(SESSION_COMPONENT_ORDER, ['prepare_and_access', 'explosiveness', 'strength', 'capacity_competition', 'body_control'])
})

test('tumbling consumes booked time and cannot silently extend a 60-minute class', () => {
  const components = [...request().components, { key: 'body_control', budgetSeconds: 1800 }]
  assert.throws(() => normalizeSessionComponentPlan(request({ components })), /exceed booked duration by 1800/)
  assert.equal(normalizeSessionComponentPlan(request({ durationMinutes: 90, components })).reserveSeconds, 0)
  assert.throws(() => normalizeSessionComponentPlan(request({
    components: request().components.map((c, index) => ({ ...c, budgetSeconds: c.budgetSeconds + (index === 0 ? 1 : 0) })),
  })), /exceed booked duration by 1 seconds/)
})

test('unallocated time stays explicit rather than inflating work or recovery', () => {
  const plan = normalizeSessionComponentPlan(request({ components: [{ key: 'strength', budgetSeconds: 1200 }] }))
  assert.equal(plan.reserveSeconds, 2400)
  assert.equal(plan.components[0].budgetSeconds, 1200)
})

test('inherited equipment uses canonical aliases and explicit empty scope means bodyweight', () => {
  const plan = normalizeSessionComponentPlan(request())
  assert.deepEqual(plan.equipment.available, ['none', 'dumbbell', 'bench'])
  assert.deepEqual(plan.components[2].equipment.quantities, { dumbbell: 15, bench: 5 })
  assert.equal(plan.components[2].equipment.scope, 'inherit')
  assert.deepEqual(plan.components[3].equipment.allowed, ['none'])
  assert.deepEqual(plan.components[3].equipment.quantities, {})
  assert.equal(plan.components[3].equipment.scope, 'restricted')
  assert.deepEqual(normalizeSessionComponentPlan(request({ equipment: { available: [] } })).equipment.available, ['none'])
})

test('component scope can narrow availability but cannot invent equipment or quantities', () => {
  const withScope = (equipment) => request({ components: [{ key: 'strength', budgetSeconds: 1200, equipment }] })
  const plan = normalizeSessionComponentPlan(withScope({ allowed: ['dumbbells'], preferred: ['dumbbell'] }))
  assert.deepEqual(plan.components[0].equipment.allowed, ['none', 'dumbbell'])
  assert.deepEqual(plan.components[0].equipment.preferred, ['dumbbell'])
  assert.throws(() => normalizeSessionComponentPlan(withScope({ allowed: ['barbell'] })), /unavailable or excluded equipment/)
  assert.throws(() => normalizeSessionComponentPlan(withScope({ allowed: ['dumbbell'], preferred: ['bench'] })), /preferred cannot select/)
  assert.throws(() => normalizeSessionComponentPlan(withScope({ quantities: { dumbbell: 20 } })), /unknown fields: quantities/)
})

test('global exclusions and zero inventory cannot be reintroduced by a component', () => {
  for (const equipment of [
    { available: ['dumbbell'], excluded: ['dumbbells'] },
    { available: ['dumbbell'], quantities: { dumbbell: 0 } },
  ]) {
    const plan = normalizeSessionComponentPlan(request({ equipment }))
    assert.deepEqual(plan.components[0].equipment.allowed, ['none'])
    assert.throws(() => normalizeSessionComponentPlan(request({ equipment,
      components: [{ key: 'strength', budgetSeconds: 1200, equipment: { allowed: ['dumbbell'] } }],
    })), /unavailable or excluded equipment/)
  }
  const plan = normalizeSessionComponentPlan(request({
    components: [{ key: 'strength', budgetSeconds: 1200, equipment: { excluded: ['dumbbells'] } }],
  }))
  assert.deepEqual(plan.components[0].equipment.allowed, ['none', 'bench'])
})

test('unknown quantity is retained for the scheduler and is never treated as unlimited', () => {
  const plan = normalizeSessionComponentPlan(request({ equipment: { available: ['dumbbell', 'bench'], quantities: { bench: null } } }))
  assert.deepEqual(plan.equipment.quantities, { dumbbell: null, bench: null })
  assert.deepEqual(plan.components[0].equipment.unknownQuantityKeys, ['dumbbell', 'bench'])
  assert.deepEqual(plan.components[3].equipment.unknownQuantityKeys, [])
})

test('reject ambiguous or unsupported taxonomy, unavailable quantities and alias collisions', () => {
  for (const available of [['rope'], ['sled'], ['invented_equipment']]) {
    assert.throws(() => normalizeSessionComponentPlan(request({ equipment: { available } })), /equipment:/)
  }
  assert.throws(() => normalizeSessionComponentPlan(request({ equipment: {
    available: ['dumbbell'], quantities: { bench: 2 },
  } })), /unavailable equipment: bench/)
  assert.throws(() => normalizeSessionComponentPlan(request({ equipment: {
    available: ['dumbbell'], quantities: { dumbbell: 2, dumbbells: 3 },
  } })), /duplicate aliases/)
  assert.throws(() => normalizeSessionComponentPlan(request({ equipment: {
    available: ['bodyweight'], quantities: { none: 15 },
  } })), /quantity to no equipment/)
  assert.throws(() => normalizeSessionComponentPlan(request({ equipment: {
    available: [], excluded: ['bodyweight'],
  } })), /cannot exclude the no-equipment sentinel/)
})

test('component order is distinct from legacy phases and refuses duplicates or silent sorting', () => {
  assert.throws(() => normalizeSessionComponentPlan(request({ components: [...request().components].reverse() })), /Vortex session order/)
  assert.throws(() => normalizeSessionComponentPlan(request({ components: [request().components[0], request().components[0]] })), /unique/)
  assert.throws(() => normalizeSessionComponentPlan(request({ components: [{ key: 'capacity', budgetSeconds: 300 }] })), /not a Vortex session component/)
  assert.deepEqual(SESSION_PHASE_ORDER, ['prepare_and_access', 'movement_intelligence', 'output', 'capacity', 'resilience', 'sustained_capacity', 'restore'])
  assert.deepEqual(normalizeWorkoutIntent({ equipmentAvailable: ['dumbbells', 'bench'] }).equipmentAvailable, ['dumbbell', 'bench'])
})

test('reject malformed model output rather than coercing, defaulting or dropping constraints', () => {
  for (const value of [null, [], 'json', new Date()]) {
    assert.throws(() => normalizeSessionComponentPlan(value), /plain object/)
  }
  for (const value of [undefined, null, '60', true, 60.5, NaN, Infinity, 0, 241]) {
    assert.throws(() => normalizeSessionComponentPlan(request({ durationMinutes: value })), /durationMinutes must be an integer/)
  }
  for (const value of [0, -1, 0.5, '600', null, Infinity]) {
    assert.throws(() => normalizeSessionComponentPlan(request({ components: [{ key: 'strength', budgetSeconds: value }] })), /budgetSeconds must be an integer/)
  }
  for (const value of [-1, 1.5, '3', true, undefined, NaN, Infinity, 1001]) {
    assert.throws(() => normalizeSessionComponentPlan(request({ equipment: { available: ['dumbbell'], quantities: { dumbbell: value } } })), /must be an integer/)
  }
  for (const overrides of [
    { schemaVersion: '2.0.0' }, { schemaVersion: null }, { ruleOverrides: [] },
    { components: [] }, { components: {} }, { components: [null] },
    { equipment: null }, { equipment: { available: 'dumbbell' } },
    { equipment: { available: [1] } }, { equipment: { available: [], quantities: null } },
    { components: [{ key: 'strength', budgetSeconds: 600, equipment: { allowed: null } }] },
    { components: [{ key: 'strength', budgetSeconds: 600, equipment: { preferred: null } }] },
    { components: [{ key: 'strength', budgetSeconds: 600, approved: true }] },
  ]) assert.throws(() => normalizeSessionComponentPlan(request(overrides)))
})

test('normalization is deterministic, does not mutate inputs and freezes handoff constraints', () => {
  const input = request()
  const snapshot = structuredClone(input)
  const first = normalizeSessionComponentPlan(input)
  assert.deepEqual(input, snapshot)
  assert.deepEqual(first, normalizeSessionComponentPlan(input))
  input.equipment.quantities.dumbbells = 100
  input.components[0].budgetSeconds = 1
  assert.equal(first.equipment.quantities.dumbbell, 15)
  assert.equal(first.components[0].budgetSeconds, 600)
  assert.throws(() => { first.equipment.quantities.dumbbell = 100 }, TypeError)
  assert.throws(() => { first.components[0].budgetSeconds = 1 }, TypeError)
  assert.throws(() => { first.components[0].equipment.allowed.push('barbell') }, TypeError)
})
