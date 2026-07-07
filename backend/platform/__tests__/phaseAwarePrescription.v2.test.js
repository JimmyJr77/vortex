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

test('audience splits emit per-group exercise variants', async () => {
  const exercises = [
    {
      id: 1,
      name: 'Hard Jump',
      slug: 'hard-jump',
      programming_kind: 'exercise',
      default_sets: 3,
      default_reps: 2,
      default_rest_seconds: 30,
      default_work_seconds: null,
      est_seconds_per_set: 45,
      facility_id: 1,
      archived: false,
      is_published: true,
    },
    {
      id: 2,
      name: 'Easy Jump',
      slug: 'easy-jump',
      programming_kind: 'exercise',
      default_sets: 3,
      default_reps: 2,
      default_rest_seconds: 30,
      default_work_seconds: null,
      est_seconds_per_set: 45,
      facility_id: 1,
      archived: false,
      is_published: true,
    },
  ]

  const pool = mockPool([
    ...baseHandlers(),
    (sql) => {
      if (sql.includes('FROM coaching.session_phase')) {
        return { rows: [{ id: 2, key: 'output', name: 'Output' }] }
      }
      if (sql.includes('FROM coaching.exercise e WHERE')) return { rows: exercises }
      if (sql.includes('FROM coaching.exercise_tag')) {
        return {
          rows: [
            { exercise_id: 1, facet_type: 'pattern', facet_id: 10, weight: 1 },
            { exercise_id: 2, facet_type: 'pattern', facet_id: 10, weight: 1 },
          ],
        }
      }
      if (sql.includes('FROM coaching.exercise_phase_profile')) {
        return {
          rows: [
            { exercise_id: 1, phase_id: 2, phase_key: 'output', role: 'primary', fit_weight: 10, order_slot: null, notes: null, impact_level: 2, order_index: 1, freshness_required: false, fatigue_sensitivity: 1, fatigue_cost: 1, technical_complexity: 1, intensity_ceiling: null },
            { exercise_id: 2, phase_id: 2, phase_key: 'output', role: 'secondary', fit_weight: 4, order_slot: null, notes: null, impact_level: 1, order_index: 1, freshness_required: false, fatigue_sensitivity: 1, fatigue_cost: 1, technical_complexity: 1, intensity_ceiling: null },
          ],
        }
      }
      if (sql.includes('FROM coaching.exercise_difficulty_profile')) {
        return {
          rows: [
            { exercise_id: 1, technical: 6, load: 6, overall: 8, recommended_age_min: null, recommended_age_max: null, attention_demand: null, notes: null, source: 'derived' },
            { exercise_id: 2, technical: 4, load: 4, overall: 4, recommended_age_min: null, recommended_age_max: null, attention_demand: null, notes: null, source: 'derived' },
          ],
        }
      }
      if (sql.includes('FROM coaching.exercise_scaling_profile')) return { rows: [] }
      if (sql.includes('FROM coaching.exercise_dosage_profile')) return { rows: [] }
      if (sql.includes('FROM coaching.exercise_safety_profile')) return { rows: [] }
      if (sql.includes('FROM coaching.exercise_regimen_rule')) return { rows: [] }
      if (sql.includes("entity_type = 'exercise'")) return { rows: [] }
    },
  ])

  const result = await runPhaseAwarePrescription(pool, 1, {
    ageMin: 8,
    ageMax: 13,
    capsOverride: { maxOverall: 8, maxTechnical: 8, maxLoad: 8 },
    audienceSplits: [
      { label: 'Younger', ageMin: 8, ageMax: 10, difficultyOverride: 5 },
      { label: 'Older', ageMin: 11, ageMax: 13, difficultyOverride: 6 },
    ],
    phasePlan: [{ phaseKey: 'output', minutes: 20, label: 'Output' }],
  })

  assert.equal(result.blocks.length, 1)
  const hardItem = result.blocks[0].items.find((entry) => entry.exercise_name === 'Hard Jump')
  assert.ok(hardItem, 'expected Hard Jump to be selected for the older split')
  assert.equal(hardItem.per_split?.length, 2)
  const younger = hardItem.per_split?.find((entry) => entry.split_label === 'Younger')
  const older = hardItem.per_split?.find((entry) => entry.split_label === 'Older')
  assert.ok(younger)
  assert.ok(older)
  assert.equal(younger.exercise_name, 'Easy Jump')
  assert.equal(younger.variant_type, 'substituted')
  assert.equal(older.exercise_name, 'Hard Jump')
  assert.equal(older.variant_type, 'same')
})
