import assert from 'node:assert/strict'
import test from 'node:test'
import {
  evaluatePrescriptionQuality,
  evaluateCategory1Structure,
  DEFAULT_STRICT_THRESHOLDS,
} from '../prescriptionQualityChecks.js'
import { buildEvaluatorVerdict, stableHash } from '../evaluatorVerdict.js'
import { compileRequirementsContract } from '../requirementsContract.js'
import {
  runPrescriptionEvalLoop,
  applyRepairActions,
  buildRepairPlan,
  computeLockedPaths,
} from '../prescriptionRepairLoop.js'
import {
  goldenBody,
  fullGoldenResult,
  loadMetricsCatalog,
  buildExerciseContext,
  mockResult,
} from './evalLoopFixtures.js'

const metricsCatalog = loadMetricsCatalog()

function evalResult(body, result, ctx = {}) {
  const checks = []
  evaluateCategory1Structure(result, body, checks)
  const evaluation = evaluatePrescriptionQuality(result, DEFAULT_STRICT_THRESHOLDS, {
    expectedBody: body,
    sessionAgeMax: body.ageMax,
    ...buildExerciseContext(result),
    ...ctx,
  })
  return { checks: [...checks, ...evaluation.checks], ok: evaluation.ok }
}

test('runPrescriptionEvalLoop returns UNSATISFIABLE on equipment overlap without DB', async () => {
  const body = { ...goldenBody, equipmentUseIds: [3], equipmentAvoidIds: [3] }
  const out = await runPrescriptionEvalLoop(null, 1, body, {
    metricsCatalog,
    prescribe: async () => fullGoldenResult(),
    loadContext: async () => ({}),
  })
  assert.equal(out.verdict.status, 'UNSATISFIABLE')
  assert.equal(out.attempts, 0)
})

test('applyRepairActions replace_exercise mutates item', () => {
  const result = fullGoldenResult()
  const before = result.blocks[0].items[0].exercise_name
  const patched = applyRepairActions(result, [{
    type: 'replace_exercise',
    phase_key: result.blocks[0].phase_key,
    constraints: { replacement: { exercise_name: 'Replaced Exercise' } },
  }], goldenBody)
  assert.notEqual(patched.blocks[0].items[0].exercise_name, before)
})

test('buildEvaluatorVerdict PASS includes requirement_trace', () => {
  const body = goldenBody
  const result = fullGoldenResult({ work_mode: body.workMode })
  const checks = [
    { id: 'phase_count_match', ok: true, severity: 'ok' },
    { id: 'prescribe_body_mos_complete', ok: true, severity: 'ok' },
    { id: 'phase_plan_minute_sum_mos', ok: true, severity: 'ok' },
    { id: 'no_empty_phases', ok: true, severity: 'ok' },
    { id: 'restore_non_empty', ok: true, severity: 'ok' },
  ]
  const verdict = buildEvaluatorVerdict({
    body,
    result,
    checks,
    metricsCatalog,
    attempt: 1,
    inputHash: stableHash(body),
    outputHash: stableHash({ blocks: result.blocks }),
    evaluatedAfterLastRepair: true,
  })
  assert.ok(verdict.requirement_trace.length > 0, `status=${verdict.status}`)
  assert.ok(verdict.requirement_trace.every((t) => t.requirement_id))
})

test('repair replaces only failed item; locked phases unchanged', () => {
  const body = { ...goldenBody }
  const result = fullGoldenResult({ work_mode: body.workMode })
  const restoreBlock = result.blocks.find((b) => b.phase_key === 'restore')
  restoreBlock.items = []

  const outputBefore = JSON.stringify(result.blocks.find((b) => b.phase_key === 'output'))
  const { checks } = evalResult(body, result)
  const { requirements } = compileRequirementsContract(body, { metricsCatalog })
  const locked = computeLockedPaths(requirements, checks, result)
  assert.ok(locked.length > 0, 'expected at least one locked phase when only restore fails')

  const verdict = buildEvaluatorVerdict({
    body,
    result,
    checks,
    metricsCatalog,
    attempt: 1,
    evaluatedAfterLastRepair: true,
  })
  const plan = buildRepairPlan(verdict.blocking_failures, result, body, locked)
  assert.ok(plan.some((a) => a.phase_key === 'restore'))

  const patched = applyRepairActions(result, plan, body, buildExerciseContext(result))
  const outputAfter = JSON.stringify(patched.blocks.find((b) => b.phase_key === 'output'))
  assert.equal(outputBefore, outputAfter)
  assert.ok(patched.blocks.find((b) => b.phase_key === 'restore').items.length > 0)
})

test('stale evaluator result yields SYSTEM_FAIL', () => {
  const body = { ...goldenBody }
  const result = fullGoldenResult()
  const verdict = buildEvaluatorVerdict({
    body,
    result,
    checks: [{ id: 'phase_count_match', ok: true, severity: 'ok' }],
    metricsCatalog,
    attempt: 2,
    evaluatedAfterLastRepair: false,
  })
  assert.equal(verdict.status, 'SYSTEM_FAIL')
  assert.ok(verdict.blocking_failures.some((f) => f.check_id === 'stale_evaluator_output'))
})

test('runPrescriptionEvalLoop re-evaluates after repair before PASS', async () => {
  const body = { ...goldenBody }
  const broken = fullGoldenResult({ work_mode: body.workMode })
  broken.blocks.find((b) => b.phase_key === 'restore').items = []

  let evalCalls = 0
  const out = await runPrescriptionEvalLoop(null, 1, body, {
    metricsCatalog,
    maxAttempts: 2,
    prescribe: async () => JSON.parse(JSON.stringify(broken)),
    loadContext: async (_p, res) => buildExerciseContext(res),
    evaluate: (res, th, ctx) => {
      evalCalls += 1
      return evalResult(body, res, ctx)
    },
  })

  assert.ok(evalCalls >= 2, `expected re-eval after repair, got ${evalCalls} eval calls`)
  assert.ok(out.repair_history.length >= 1)
  if (out.verdict.status === 'PASS') {
    assert.equal(out.verdict.evaluated_after_last_repair, true)
  }
})

test('max attempts exhausted returns REPAIRABLE_FAIL with blockers', async () => {
  const body = { ...goldenBody }
  const broken = fullGoldenResult({ work_mode: body.workMode })
  broken.blocks.find((b) => b.phase_key === 'restore').items = []
  broken.blocks.reverse()

  const out = await runPrescriptionEvalLoop(null, 1, body, {
    metricsCatalog,
    maxAttempts: 2,
    prescribe: async () => JSON.parse(JSON.stringify(broken)),
    loadContext: async (_p, res) => buildExerciseContext(res),
    evaluate: (res, th, ctx) => evalResult(body, res, ctx),
  })

  assert.equal(out.verdict.status, 'REPAIRABLE_FAIL')
  assert.equal(out.verdict.pass, false)
  assert.ok(out.verdict.blocking_failures.length > 0)
  assert.equal(out.attempts, 2)
})

test('buildRepairPlan maps duration failure to adjust_dose', () => {
  const body = { ...goldenBody }
  const result = mockResult({
    blocks: [{ phase_key: 'output', target_minutes: 10, estimated_minutes: 5, items: [{ exercise_name: 'A' }] }],
  })
  const failures = [{
    check_id: 'phase_minute_mismatch',
    repair_action: {
      type: 'adjust_dose',
      phase_key: 'output',
      constraints: { check_id: 'phase_minute_mismatch' },
    },
    current_value: { phase_key: 'output' },
    expected: 10,
  }]
  const plan = buildRepairPlan(failures, result, body, [])
  assert.equal(plan[0].type, 'adjust_dose')
  assert.equal(plan[0].constraints.target_minutes, 10)
})

test('applyRepairActions remove_forbidden_item strips per_split variant', () => {
  const result = mockResult({
    blocks: [{
      phase_key: 'capacity',
      items: [{
        exercise_id: 10,
        exercise_name: 'Goblet Squat',
        per_split: [
          { split_label: 'S2', exercise_id: 50, exercise_name: 'Barbell Back Squat' },
        ],
      }],
    }],
  })
  const patched = applyRepairActions(result, [{
    type: 'remove_forbidden_item',
    phase_key: 'capacity',
    constraints: { forbidden_pattern: /barbell/i },
  }], goldenBody)
  assert.equal(patched.blocks[0].items[0].per_split.length, 0)
})
