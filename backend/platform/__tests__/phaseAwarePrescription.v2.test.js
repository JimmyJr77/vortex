import assert from 'node:assert/strict'
import test from 'node:test'
import { runPhaseAwarePrescription, PrescriptionError } from '../phaseAwarePrescription.js'

function mockPool(handlers) {
  return {
    query: async (sql, params) => {
      for (const handler of handlers) {
        const result = handler(String(sql), params)
        if (result !== undefined) return result
      }
      return { rows: [] }
    },
  }
}

const baseHandlers = () => [
  (sql) => {
    if (sql.includes('FROM coaching.session_phase')) {
      return { rows: [{ id: 1, key: 'capacity', name: 'Capacity' }] }
    }
    if (sql.includes("entity_type = 'session_phase'")) {
      return { rows: [] }
    }
    if (sql.includes('FROM coaching.equipment WHERE')) {
      return { rows: [{ id: 99, name: 'Rings' }] }
    }
  },
]

test('workMode skill filters programming_kind skill_drill', async () => {
  let exerciseSql = ''
  const pool = mockPool([
    ...baseHandlers(),
    (sql) => {
      if (sql.includes('FROM coaching.exercise e WHERE')) {
        exerciseSql = sql
        return { rows: [] }
      }
    },
  ])
  try {
    await runPhaseAwarePrescription(pool, 1, {
      workMode: 'skill',
      phasePlan: [{ phaseKey: 'capacity', minutes: 20 }],
    })
  } catch {
    /* may throw on empty */
  }
  assert.match(exerciseSql, /programming_kind = 'skill_drill'/)
})

test('workMode exercise filters programming_kind exercise', async () => {
  let exerciseSql = ''
  const pool = mockPool([
    ...baseHandlers(),
    (sql) => {
      if (sql.includes('FROM coaching.exercise e WHERE')) {
        exerciseSql = sql
        return { rows: [] }
      }
    },
  ])
  await runPhaseAwarePrescription(pool, 1, {
    workMode: 'exercise',
    phasePlan: [{ phaseKey: 'capacity', minutes: 20 }],
  })
  assert.match(exerciseSql, /programming_kind = 'exercise'/)
})

test('unsatisfiable equipment Use returns PrescriptionError 422 payload', async () => {
  const pool = mockPool([
    ...baseHandlers(),
    (sql) => {
      if (sql.includes('FROM coaching.exercise e WHERE')) {
        return { rows: [] }
      }
    },
  ])
  await assert.rejects(
    () => runPhaseAwarePrescription(pool, 1, {
      equipmentUseIds: [99],
      phasePlan: [{ phaseKey: 'capacity', minutes: 20, label: 'Main' }],
    }),
    (err) => {
      assert.ok(err instanceof PrescriptionError)
      assert.equal(err.code, 'unsatisfiable_equipment')
      assert.deepEqual(err.details.unsatisfiable_equipment, [{ id: 99, name: 'Rings' }])
      return true
    },
  )
})

test('tramp_tumble Other block emits placeholder with no items', async () => {
  const pool = mockPool([...baseHandlers()])
  const result = await runPhaseAwarePrescription(pool, 1, {
    phasePlan: [{ phaseKey: 'other', otherKind: 'tramp_tumble', minutes: 12, label: 'Tramp block' }],
  })
  assert.equal(result.blocks.length, 1)
  assert.equal(result.blocks[0].other_kind, 'tramp_tumble')
  assert.equal(result.blocks[0].items.length, 0)
  assert.equal(result.blocks[0].estimated_minutes, 12)
})
