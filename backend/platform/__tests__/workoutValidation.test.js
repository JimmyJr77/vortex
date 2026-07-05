import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  phaseIndex,
  itemSeconds,
  blockSeconds,
  computePriorFatigue,
  computeTimeSummary,
  PHASE_ORDER,
} from '../workoutValidation.js'

describe('workoutValidation helpers', () => {
  it('orders phases correctly', () => {
    assert.equal(phaseIndex('prepare_access'), 0)
    assert.equal(phaseIndex('output'), 2)
    assert.equal(phaseIndex('restore'), PHASE_ORDER.length - 1)
    assert.equal(phaseIndex('unknown'), 999)
  })

  it('computes item and block seconds', () => {
    assert.equal(itemSeconds({ sets: 3, work_seconds: 30, rest_seconds: 20 }), 150)
    assert.equal(blockSeconds({ rounds: 2, rest_between_rounds_seconds: 10, items: [{ sets: 2, work_seconds: 20, rest_seconds: 10 }] }), 130)
  })

  it('accumulates prior fatigue from profiles and fitness phase', () => {
    const blockMeta = [
      { phaseKey: 'fitness_repeatability', block: { items: [{ exercise_id: 1, exercise_name: 'Burpees' }] } },
      { phaseKey: 'output', block: { items: [{ exercise_id: 2, exercise_name: 'Sprint' }] } },
    ]
    const profileByExercisePhase = new Map([
      ['1:fitness_repeatability', { fatigue_cost: 4 }],
    ])
    const regimenByExercise = new Map()
    const fatigue = computePriorFatigue(blockMeta, 1, profileByExercisePhase, regimenByExercise)
    assert.ok(fatigue >= 4)
  })

  it('computes time summary against budget', () => {
    const blockMeta = [
      { block: { rounds: 1, items: [{ sets: 2, work_seconds: 60, rest_seconds: 0 }] } },
    ]
    const time = computeTimeSummary(blockMeta, 2)
    assert.equal(time.planned_seconds, 120)
    assert.equal(time.budget_seconds, 120)
    assert.equal(time.delta_seconds, 0)
  })
})
