import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PREPARE_PINNED_MINUTES,
  buildPhasePlan,
  redistributeOnDelete,
  defaultPhaseRows,
} from '../phaseArchitect.js'

test('pinned Prepare minutes 7/10/10 for standard durations', () => {
  assert.equal(PREPARE_PINNED_MINUTES[60], 7)
  assert.equal(PREPARE_PINNED_MINUTES[90], 10)
  assert.equal(PREPARE_PINNED_MINUTES[120], 10)
  const plan60 = buildPhasePlan({ durationMinutes: 60, sessionObjective: 'general_athletic_development' })
  const prepare = plan60.plan.find((p) => p.phaseKey === 'prepare_and_access')
  assert.equal(prepare?.minutes, 7)
  const plan90 = buildPhasePlan({ durationMinutes: 90, sessionObjective: 'general_athletic_development' })
  assert.equal(plan90.plan.find((p) => p.phaseKey === 'prepare_and_access')?.minutes, 10)
})

test('skill mode shifts minutes toward movement intelligence', () => {
  const exercise = buildPhasePlan({ durationMinutes: 60, sessionObjective: 'general_athletic_development', workMode: 'exercise' })
  const skill = buildPhasePlan({ durationMinutes: 60, sessionObjective: 'general_athletic_development', workMode: 'skill' })
  const exMi = exercise.plan.find((p) => p.phaseKey === 'movement_intelligence')?.minutes ?? 0
  const skMi = skill.plan.find((p) => p.phaseKey === 'movement_intelligence')?.minutes ?? 0
  assert.ok(skMi >= exMi)
  assert.ok(skill.adjustments.some((a) => a.includes('Skill mode')))
})

test('redistributeOnDelete keeps pinned prepare', () => {
  const plan = defaultPhaseRows(60)
  const withoutOutput = redistributeOnDelete(plan, 'output', 60, 7)
  assert.ok(!withoutOutput.some((p) => p.phaseKey === 'output'))
  assert.equal(withoutOutput.find((p) => p.phaseKey === 'prepare_and_access')?.minutes, 7)
})
