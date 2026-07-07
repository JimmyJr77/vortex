import assert from 'node:assert/strict'
import test from 'node:test'

/** Mirrors useCoachBuilderStore phaseBlocksFromPlan — applyPhasePlan must not run after populated setWorkout. */
function phaseBlocksFromPlan(plan) {
  return plan.map((p) => ({
    label: p.label ?? p.phaseKey,
    phase_key: p.phaseKey,
    minutes_budget: p.minutes,
    block_format: 'straight_sets',
    rounds: 1,
    rest_between_rounds_seconds: 0,
    items: [],
  }))
}

test('applyPhasePlan pattern wipes prescribed items if called after setWorkout', () => {
  const prescribedItems = [{ exercise_id: 1, exercise_name: 'Pull-Up', sets: 3 }]
  const workoutWithItems = {
    blocks: [{ label: 'Output', phase_key: 'output', items: prescribedItems }],
  }
  const plan = [{ phaseKey: 'output', minutes: 15, label: 'Output' }]
  const afterApplyPhasePlan = { blocks: phaseBlocksFromPlan(plan) }
  assert.equal(workoutWithItems.blocks[0].items.length, 1)
  assert.equal(afterApplyPhasePlan.blocks[0].items.length, 0)
})
