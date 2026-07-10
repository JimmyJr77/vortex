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

test('enablePreflight throws unsatisfiable_requirements before generation', async () => {
  const pool = mockPool([...baseHandlers()])
  await assert.rejects(
    () => runPhaseAwarePrescription(pool, 1, {
      enablePreflight: true,
      workMode: 'exercise',
      ageMin: 8,
      ageMax: 14,
      skillLevel: 'INTERMEDIATE',
      durationMinutes: 20,
      phasePlan: [{ phaseKey: 'capacity', minutes: 20, label: 'Main' }],
      equipmentUseIds: [7],
      equipmentAvoidIds: [7],
    }),
    (err) => {
      assert.ok(err instanceof PrescriptionError)
      assert.equal(err.code, 'unsatisfiable_requirements')
      assert.ok(Array.isArray(err.details.blocking_requirements))
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

function prescriptionMockHandlers({
  exercises,
  phaseKey = 'output',
  phaseId = 2,
  phaseProfiles = null,
  difficulties = null,
  tags = null,
}) {
  const profileRows = phaseProfiles ?? exercises.flatMap((ex) => ([{
    exercise_id: ex.id,
    phase_id: phaseId,
    phase_key: phaseKey,
    role: ex.role ?? 'primary',
    fit_weight: ex.fit_weight ?? 10,
    order_slot: null,
    notes: null,
    impact_level: ex.impact_level ?? 1,
    order_index: 1,
    freshness_required: false,
    fatigue_sensitivity: 1,
    fatigue_cost: 1,
    technical_complexity: 1,
    intensity_ceiling: 'low',
  }]))

  const difficultyRows = difficulties ?? exercises.map((ex) => ({
    exercise_id: ex.id,
    technical: ex.technical ?? ex.difficulty ?? 4,
    load: ex.load ?? ex.difficulty ?? 4,
    overall: ex.difficulty ?? 4,
    recommended_age_min: null,
    recommended_age_max: null,
    attention_demand: null,
    notes: null,
    source: 'test',
  }))

  const tagRows = tags ?? exercises.flatMap((ex) => (
    ex.tags ?? [{ exercise_id: ex.id, facet_type: 'pattern', facet_id: ex.pattern_id ?? 10, weight: 1 }]
  ))

  return [
    ...baseHandlers(),
    (sql) => {
      if (sql.includes('FROM coaching.session_phase')) {
        return { rows: [{ id: phaseId, key: phaseKey, name: phaseKey }] }
      }
      if (sql.includes('FROM coaching.exercise e WHERE')) return { rows: exercises }
      if (sql.includes('FROM coaching.exercise_tag')) return { rows: tagRows }
      if (sql.includes('FROM coaching.exercise_phase_profile')) return { rows: profileRows }
      if (sql.includes('FROM coaching.exercise_difficulty_profile')) return { rows: difficultyRows }
      if (sql.includes('FROM coaching.exercise_scaling_profile')) return { rows: [] }
      if (sql.includes('FROM coaching.exercise_dosage_profile')) return { rows: [] }
      if (sql.includes('FROM coaching.exercise_safety_profile')) return { rows: [] }
      if (sql.includes('FROM coaching.exercise_regimen_rule')) return { rows: [] }
      if (sql.includes("entity_type = 'exercise'")) return { rows: [] }
      if (sql.includes('FROM coaching.methodology')) return { rows: [{ id: 4, key: 'neural' }] }
    },
  ]
}

test('high-cap split receives progression variant with higher difficulty', async () => {
  const exercises = [
    {
      id: 1,
      name: 'Base Pass',
      slug: 'base-pass',
      programming_kind: 'exercise',
      default_sets: 3,
      default_reps: 5,
      default_rest_seconds: 30,
      default_work_seconds: 45,
      est_seconds_per_set: 45,
      facility_id: 1,
      archived: false,
      is_published: true,
      difficulty: 4,
      fit_weight: 12,
      pattern_id: 10,
    },
    {
      id: 2,
      name: 'Heavy Pass',
      slug: 'heavy-pass',
      programming_kind: 'exercise',
      default_sets: 3,
      default_reps: 5,
      default_rest_seconds: 30,
      default_work_seconds: 45,
      est_seconds_per_set: 45,
      facility_id: 1,
      archived: false,
      is_published: true,
      difficulty: 7,
      fit_weight: 8,
      role: 'secondary',
      pattern_id: 10,
    },
  ]

  const pool = mockPool(prescriptionMockHandlers({ exercises, phaseKey: 'output' }))

  const result = await runPhaseAwarePrescription(pool, 1, {
    ageMin: 8,
    ageMax: 14,
    skillLevel: 'INTERMEDIATE',
    audienceSplits: [
      { label: 'Ages 8-10', ageMin: 8, ageMax: 10, difficultyOverride: 6 },
      { label: 'Ages 11-14', ageMin: 11, ageMax: 14, difficultyOverride: 10 },
    ],
    phasePlan: [{ phaseKey: 'output', minutes: 20, label: 'Output' }],
  })

  const item = result.blocks[0].items[0]
  assert.ok(item)
  assert.equal(item.exercise_name, 'Base Pass')
  const younger = item.per_split?.find((entry) => entry.split_label === 'Ages 8-10')
  const older = item.per_split?.find((entry) => entry.split_label === 'Ages 11-14')
  assert.ok(younger)
  assert.ok(older)
  assert.equal(younger.variant_type, 'same')
  assert.equal(older.variant_type, 'progression')
  assert.equal(older.exercise_name, 'Heavy Pass')
  assert.ok((older.difficulty?.overall ?? 0) > (younger.difficulty?.overall ?? 0))
})

test('split progressions stay off low-intent phases', async () => {
  const exercises = [
    {
      id: 1,
      name: 'Bear Crawl Prep',
      slug: 'bear-crawl-prep',
      programming_kind: 'exercise',
      default_sets: 1,
      default_reps: 6,
      default_rest_seconds: 0,
      default_work_seconds: 45,
      est_seconds_per_set: 45,
      facility_id: 1,
      archived: false,
      is_published: true,
      difficulty: 4,
      fit_weight: 12,
      pattern_id: 11,
    },
    {
      id: 2,
      name: 'Goblet Squat Tempo 3-1',
      slug: 'goblet-squat-tempo-d6',
      programming_kind: 'exercise',
      default_sets: 3,
      default_reps: 6,
      default_rest_seconds: 45,
      default_work_seconds: 45,
      est_seconds_per_set: 90,
      facility_id: 1,
      archived: false,
      is_published: true,
      difficulty: 6,
      fit_weight: 8,
      role: 'secondary',
      pattern_id: 99,
    },
  ]

  const pool = mockPool(prescriptionMockHandlers({ exercises, phaseKey: 'prepare_and_access', phaseId: 7 }))

  const result = await runPhaseAwarePrescription(pool, 1, {
    ageMin: 8,
    ageMax: 14,
    skillLevel: 'INTERMEDIATE',
    audienceSplits: [
      { label: 'Ages 8-10', ageMin: 8, ageMax: 10, difficultyOverride: 6 },
      { label: 'Ages 11-14', ageMin: 11, ageMax: 14, difficultyOverride: 10 },
    ],
    phasePlan: [{ phaseKey: 'prepare_and_access', minutes: 10, label: 'Prepare' }],
  })

  const item = result.blocks[0].items[0]
  assert.equal(item.exercise_name, 'Bear Crawl Prep')
  assert.equal(item.per_split?.find((entry) => entry.split_label === 'Ages 8-10')?.variant_type, 'same')
  assert.equal(item.per_split?.find((entry) => entry.split_label === 'Ages 11-14')?.variant_type, 'same')
})

test('split progressions require a compatible lane within the phase', async () => {
  const exercises = [
    {
      id: 1,
      name: 'Push-Up Start 10m',
      slug: 'push-up-start-10m',
      programming_kind: 'exercise',
      default_sets: 3,
      default_reps: 1,
      default_rest_seconds: 60,
      default_work_seconds: 20,
      est_seconds_per_set: 20,
      facility_id: 1,
      archived: false,
      is_published: true,
      difficulty: 4,
      fit_weight: 12,
      pattern_id: 11,
      primary_order_slot: 'acceleration_start_speed',
      movement_family: 'Acceleration start',
    },
    {
      id: 2,
      name: 'Nordic Hamstring Iso Hold',
      slug: 'nordic-hamstring-iso-hold',
      programming_kind: 'exercise',
      default_sets: 2,
      default_reps: null,
      default_rest_seconds: 60,
      default_work_seconds: 30,
      est_seconds_per_set: 30,
      facility_id: 1,
      archived: false,
      is_published: true,
      difficulty: 8,
      fit_weight: 8,
      role: 'secondary',
      pattern_id: 99,
      primary_order_slot: 'slow_eccentric_isometric_joint_resilience',
      movement_family: 'Hamstring isometric',
    },
  ]

  const pool = mockPool(prescriptionMockHandlers({ exercises, phaseKey: 'output' }))

  const result = await runPhaseAwarePrescription(pool, 1, {
    ageMin: 8,
    ageMax: 14,
    skillLevel: 'INTERMEDIATE',
    audienceSplits: [
      { label: 'Ages 8-10', ageMin: 8, ageMax: 10, difficultyOverride: 6 },
      { label: 'Ages 11-14', ageMin: 11, ageMax: 14, difficultyOverride: 10 },
    ],
    phasePlan: [{ phaseKey: 'output', minutes: 20, label: 'Output' }],
  })

  const item = result.blocks[0].items[0]
  assert.equal(item.exercise_name, 'Push-Up Start 10m')
  const older = item.per_split?.find((entry) => entry.split_label === 'Ages 11-14')
  assert.ok(older)
  assert.equal(older.variant_type, 'same')
  assert.equal(older.exercise_name, 'Push-Up Start 10m')
})

test('poolCaps admits high-difficulty candidates when split cap exceeds session cap', async () => {
  const exercises = [
    {
      id: 10,
      name: 'Elite Bound',
      slug: 'elite-bound',
      programming_kind: 'exercise',
      default_sets: 3,
      default_reps: 3,
      default_rest_seconds: 30,
      default_work_seconds: 45,
      est_seconds_per_set: 45,
      facility_id: 1,
      archived: false,
      is_published: true,
      difficulty: 8,
      fit_weight: 15,
    },
  ]

  const pool = mockPool(prescriptionMockHandlers({ exercises, phaseKey: 'output' }))

  const result = await runPhaseAwarePrescription(pool, 1, {
    ageMin: 8,
    ageMax: 14,
    skillLevel: 'INTERMEDIATE',
    audienceSplits: [
      { label: 'Older', ageMin: 11, ageMax: 14, difficultyOverride: 10 },
    ],
    phasePlan: [{ phaseKey: 'output', minutes: 20, label: 'Output' }],
  })

  assert.equal(result.blocks[0].items.length, 1)
  assert.equal(result.blocks[0].items[0].exercise_name, 'Elite Bound')
})

test('prepare respects max item cap and phase budget', async () => {
  const exercises = Array.from({ length: 8 }, (_, i) => ({
    id: i + 1,
    name: `Prep Drill ${i + 1}`,
    slug: `prep-drill-${i + 1}`,
    programming_kind: 'exercise',
    default_sets: 2,
    default_reps: 5,
    default_rest_seconds: 0,
    default_work_seconds: 60,
    est_seconds_per_set: 60,
    facility_id: 1,
    archived: false,
    is_published: true,
    difficulty: 3,
    fit_weight: 10 - i,
    pattern_id: 100 + i,
    tags: [{ exercise_id: i + 1, facet_type: 'pattern', facet_id: 100 + i, weight: 1 }],
  }))

  const pool = mockPool(prescriptionMockHandlers({
    exercises,
    phaseKey: 'prepare_and_access',
    phaseId: 7,
  }))

  const result = await runPhaseAwarePrescription(pool, 1, {
    ageMin: 8,
    ageMax: 14,
    phasePlan: [{ phaseKey: 'prepare_and_access', minutes: 10, label: 'Prepare' }],
  })

  const block = result.blocks[0]
  assert.ok(block.items.length <= 5)
  assert.ok(block.estimated_minutes <= 10)
})

test('restore phase fills when neural-tagged low-impact card is eligible', async () => {
  const exercises = [{
    id: 50,
    name: 'Box Breathing Hold',
    slug: 'box-breathing-hold-restore',
    programming_kind: 'exercise',
    primary_phase_key: 'restore',
    default_sets: 2,
    default_reps: 4,
    default_rest_seconds: 15,
    default_work_seconds: 60,
    est_seconds_per_set: 60,
    facility_id: 1,
    archived: false,
    is_published: true,
    difficulty: 2,
    fit_weight: 12,
    tags: [
      { exercise_id: 50, facet_type: 'methodology', facet_id: 4, weight: 1 },
      { exercise_id: 50, facet_type: 'pattern', facet_id: 200, weight: 1 },
    ],
  }]

  const pool = mockPool(prescriptionMockHandlers({
    exercises,
    phaseKey: 'restore',
    phaseId: 8,
    phaseProfiles: [{
      exercise_id: 50,
      phase_id: 8,
      phase_key: 'restore',
      role: 'primary',
      fit_weight: 12,
      order_slot: 'cooldown_breathing',
      notes: null,
      impact_level: 0,
      order_index: 1,
      freshness_required: false,
      fatigue_sensitivity: 1,
      fatigue_cost: 1,
      technical_complexity: 1,
      intensity_ceiling: 'low',
    }],
  }))

  const result = await runPhaseAwarePrescription(pool, 1, {
    ageMin: 8,
    ageMax: 14,
    phasePlan: [{ phaseKey: 'restore', minutes: 8, label: 'Restore' }],
  })

  assert.equal(result.blocks[0].items.length, 1)
  assert.equal(result.blocks[0].items[0].exercise_name, 'Box Breathing Hold')
})

test('restore backfill does not exceed remaining phase budget', async () => {
  const exercises = [
    {
      id: 60,
      name: 'Med Ball Belly Breathing',
      slug: 'med-ball-belly-breathing-restore',
      programming_kind: 'exercise',
      primary_phase_key: 'restore',
      default_sets: 2,
      default_reps: 5,
      default_rest_seconds: 10,
      default_work_seconds: 105,
      est_seconds_per_set: 105,
      facility_id: 1,
      archived: false,
      is_published: true,
      difficulty: 2,
      fit_weight: 12,
      pattern_id: 200,
    },
    {
      id: 61,
      name: 'Supine Hamstring Hold',
      slug: 'supine-hamstring-hold-restore',
      programming_kind: 'exercise',
      primary_phase_key: 'restore',
      default_sets: 2,
      default_reps: 1,
      default_rest_seconds: 10,
      default_work_seconds: 45,
      est_seconds_per_set: 45,
      facility_id: 1,
      archived: false,
      is_published: true,
      difficulty: 2,
      fit_weight: 10,
      pattern_id: 201,
    },
  ]

  const pool = mockPool(prescriptionMockHandlers({
    exercises,
    phaseKey: 'restore',
    phaseId: 8,
    phaseProfiles: exercises.map((ex, index) => ({
      exercise_id: ex.id,
      phase_id: 8,
      phase_key: 'restore',
      role: 'primary',
      fit_weight: 12 - index,
      order_slot: 'cooldown_breathing',
      notes: null,
      impact_level: 0,
      order_index: index + 1,
      freshness_required: false,
      fatigue_sensitivity: 1,
      fatigue_cost: 1,
      technical_complexity: 1,
      intensity_ceiling: 'low',
    })),
  }))

  const result = await runPhaseAwarePrescription(pool, 1, {
    ageMin: 8,
    ageMax: 14,
    phasePlan: [{ phaseKey: 'restore', minutes: 4, label: 'Restore' }],
  })

  assert.equal(result.blocks[0].items.length, 1)
  assert.ok(result.blocks[0].estimated_minutes <= 4)
})
