import assert from 'node:assert/strict'
import test from 'node:test'
import {
  evaluatePrescriptionQuality,
  evaluateCategory1Structure,
  DEFAULT_STRICT_THRESHOLDS,
} from '../prescriptionQualityChecks.js'
import { buildEvaluatorVerdict, mapCheckToFailure, stableHash, verdictExitCode } from '../evaluatorVerdict.js'
import { runPreflight } from '../preflightSatisfiability.js'
import { compileRequirementsContract } from '../requirementsContract.js'
import { getChecksForRequirement } from '../checkMappingRegistry.js'
import {
  goldenBody,
  loadMetricsCatalog,
  mockResult,
  fullGoldenResult,
  goldenBlocksFromPlan,
  buildExerciseContext,
  scalePhasePlanToDuration,
} from './evalLoopFixtures.js'

const metricsCatalog = loadMetricsCatalog()

function catalogIneligibleForMapKey(catalog, mapKey) {
  const checkIds = new Set(getChecksForRequirement(mapKey))
  const copy = JSON.parse(JSON.stringify(catalog))
  for (const m of copy.all_metrics ?? []) {
    if (checkIds.has(m.check_id)) {
      m['Evaluable?'] = 'partial (TBD)'
      m['In app?'] = 'partial'
    }
  }
  return copy
}

function passingChecksForBody(body, catalog) {
  const { requirements } = compileRequirementsContract(body, { metricsCatalog: catalog })
  const seen = new Set()
  const checks = []
  for (const req of requirements) {
    if (!req.hard_gate || (req.priority !== 'P0' && req.priority !== 'P1')) continue
    for (const checkId of req.eligible_checks ?? req.mapped_checks ?? []) {
      if (seen.has(checkId)) continue
      seen.add(checkId)
      checks.push({ id: checkId, ok: true, severity: 'ok', message: 'pass' })
    }
  }
  return checks
}

function evalAndVerdict(body, result, extra = {}) {
  const checks = []
  evaluateCategory1Structure(result, body, checks)
  const ctx = buildExerciseContext(result)
  const evalResult = evaluatePrescriptionQuality(result, DEFAULT_STRICT_THRESHOLDS, {
    expectedBody: body,
    sessionAgeMax: body.ageMax,
    ...ctx,
    ...extra.context,
  })
  const allChecks = [...checks, ...evalResult.checks]
  const verdict = buildEvaluatorVerdict({
    body,
    result,
    checks: allChecks,
    metricsCatalog: extra.metricsCatalog ?? metricsCatalog,
    attempt: extra.attempt ?? 1,
    inputHash: stableHash(body),
    outputHash: stableHash({ blocks: result.blocks }),
    evaluatedAfterLastRepair: extra.evaluatedAfterLastRepair ?? true,
    preflight: extra.preflight ?? null,
  })
  return { verdict, checks: allChecks }
}

test('valid golden fixture => PASS with full requirement_trace', () => {
  const body = { ...goldenBody }
  const result = fullGoldenResult({ work_mode: body.workMode })
  const checks = passingChecksForBody(body, metricsCatalog)
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
  assert.equal(verdict.status, 'PASS')
  assert.equal(verdict.pass, true)
  assert.ok(verdict.requirement_trace.length > 0)
  assert.ok(verdict.requirement_trace.every((t) => t.requirement_id))
  const hardP01 = verdict.requirement_trace.filter((t) => t.hard_gate && (t.priority === 'P0' || t.priority === 'P1'))
  assert.ok(hardP01.length > 0)
  assert.equal(verdictExitCode(verdict), 0)
})

test('duration 60 output sums 52 => REPAIRABLE_FAIL', () => {
  const body = {
    ...goldenBody,
    durationMinutes: 60,
    phasePlan: scalePhasePlanToDuration(goldenBody.phasePlan, 60),
  }
  const blocks = goldenBlocksFromPlan(body)
  blocks.forEach((b) => { b.estimated_minutes = Math.max(1, b.target_minutes - 2) })
  const total = blocks.reduce((s, b) => s + b.estimated_minutes, 0)
  assert.ok(total <= 52)
  const result = mockResult({ blocks, work_mode: 'exercise' })
  const { verdict } = evalAndVerdict(body, result)
  assert.equal(verdict.pass, false)
  assert.equal(verdict.status, 'REPAIRABLE_FAIL')
})

test('phasePlan includes restore, output omits => REPAIRABLE_FAIL', () => {
  const body = { ...goldenBody }
  const blocks = goldenBlocksFromPlan(body).filter((b) => b.phase_key !== 'restore')
  const result = mockResult({ blocks, work_mode: body.workMode })
  const { verdict } = evalAndVerdict(body, result)
  assert.equal(verdict.pass, false)
  assert.equal(verdict.status, 'REPAIRABLE_FAIL')
})

test('workMode exercise + skill_drill primary => REPAIRABLE_FAIL', () => {
  const body = { ...goldenBody, workMode: 'exercise' }
  const blocks = goldenBlocksFromPlan(body)
  blocks[2].items = [{
    exercise_id: 1,
    exercise_name: 'Skill Drill',
    programming_kind: 'skill_drill',
    difficulty: { overall: 4 },
  }]
  const ctx = buildExerciseContext({ blocks })
  ctx.exerciseById.set(1, { id: 1, programming_kind: 'skill_drill', slug: 'skill-drill', movement_family: 'general' })
  const result = mockResult({ blocks, work_mode: 'exercise' })
  const evalResult = evaluatePrescriptionQuality(result, DEFAULT_STRICT_THRESHOLDS, {
    expectedBody: body,
    sessionAgeMax: 14,
    ...ctx,
  })
  const verdict = buildEvaluatorVerdict({
    body,
    result,
    checks: evalResult.checks,
    metricsCatalog,
    attempt: 1,
    evaluatedAfterLastRepair: true,
  })
  assert.equal(verdict.pass, false)
  assert.equal(verdict.status, 'REPAIRABLE_FAIL')
})

test('avoid barbells + barbell primary => REPAIRABLE_FAIL', () => {
  const body = { ...goldenBody, equipmentAvoidIds: [99] }
  const blocks = goldenBlocksFromPlan(body)
  blocks[3].items = [{ exercise_id: 50, exercise_name: 'Barbell Back Squat', difficulty: { overall: 6 } }]
  const ctx = buildExerciseContext({ blocks })
  ctx.exerciseById.set(50, { id: 50, slug: 'barbell-back-squat', movement_family: 'strength' })
  ctx.tagMap.set('50', [{ facetType: 'equipment', facetId: 99 }])
  ctx.equipmentKeyById.set(99, 'barbell')
  const result = mockResult({ blocks, work_mode: body.workMode })
  const evalResult = evaluatePrescriptionQuality(result, DEFAULT_STRICT_THRESHOLDS, {
    expectedBody: body,
    ...ctx,
    expandedAvoidEquipIds: new Set([99]),
    equipmentAvoidKeys: ['barbell'],
    sessionAgeMax: 14,
  })
  const verdict = buildEvaluatorVerdict({
    body, result, checks: evalResult.checks, metricsCatalog, attempt: 1, evaluatedAfterLastRepair: true,
  })
  assert.equal(verdict.pass, false)
  assert.equal(verdict.status, 'REPAIRABLE_FAIL')
})

test('equipmentUse + equipmentAvoid same ID => UNSATISFIABLE (preflight)', async () => {
  const body = { ...goldenBody, equipmentUseIds: [7, 3], equipmentAvoidIds: [3] }
  const preflight = await runPreflight(body, null, { metricsCatalog })
  assert.equal(preflight.ok, false)
  assert.equal(preflight.status, 'UNSATISFIABLE')
  const verdict = buildEvaluatorVerdict({
    body,
    result: null,
    checks: preflight.checks,
    metricsCatalog,
    preflight,
    attempt: 0,
    evaluatedAfterLastRepair: true,
  })
  assert.equal(verdict.status, 'UNSATISFIABLE')
  assert.equal(verdictExitCode(verdict), 3)
  assert.ok(verdict.blocking_failures.some((f) => f.check_id === 'equipment_use_avoid_overlap'))
})

test('equipmentUse + equipmentAvoid same ID => UNSATISFIABLE at eval time without preflight', () => {
  const body = { ...goldenBody, equipmentUseIds: [7, 3], equipmentAvoidIds: [3] }
  const verdict = buildEvaluatorVerdict({
    body,
    result: null,
    checks: [],
    metricsCatalog,
    attempt: 0,
    evaluatedAfterLastRepair: true,
  })
  assert.equal(verdict.status, 'UNSATISFIABLE')
  assert.ok(verdict.blocking_failures.some((f) => f.check_id === 'equipment_use_avoid_overlap'))
})

test('manual/partial/TBD-only mapped check for hard requirement => SYSTEM_FAIL', () => {
  const ineligibleCatalog = catalogIneligibleForMapKey(metricsCatalog, 'emptyPhase')
  const body = { ...goldenBody }
  const result = fullGoldenResult({ work_mode: body.workMode })
  const checks = passingChecksForBody(body, ineligibleCatalog)
  const verdict = buildEvaluatorVerdict({
    body,
    result,
    checks,
    metricsCatalog: ineligibleCatalog,
    attempt: 1,
    evaluatedAfterLastRepair: true,
  })
  assert.equal(verdict.status, 'SYSTEM_FAIL')
  assert.equal(verdict.pass, false)
  assert.ok(verdict.blocking_failures.some((f) => f.check_id === 'unsatisfied_mapping'))
})

test('KPI passes but atomic P0 fails => REPAIRABLE_FAIL, never PASS', () => {
  const body = { ...goldenBody }
  const blocks = goldenBlocksFromPlan(body)
  blocks.forEach((b) => { if (b.phase_key === 'restore') b.items = [] })
  const result = mockResult({
    blocks,
    constraint_report: {
      empty_phase_reasons: ['restore: pool_empty'],
      phase_fill: blocks.map((b) => ({ phase_key: b.phase_key, fill_pct: b.phase_key === 'restore' ? 0 : 100, pool_size: 5 })),
      equipment_avoid: { sample_names: [] },
    },
  })
  const ctx = buildExerciseContext(result)
  const evalResult = evaluatePrescriptionQuality(result, DEFAULT_STRICT_THRESHOLDS, {
    expectedBody: body,
    sessionAgeMax: 14,
    ...ctx,
  })
  const checks = [...evalResult.checks, { id: 'category3_kpi', ok: true, severity: 'ok', message: 'kpi pass' }]
  const verdict = buildEvaluatorVerdict({
    body, result, checks, metricsCatalog, attempt: 1, evaluatedAfterLastRepair: true,
  })
  assert.notEqual(verdict.status, 'PASS')
  assert.equal(verdict.status, 'REPAIRABLE_FAIL')
  assert.equal(verdict.pass, false)
})

test('unsatisfiable equipment request => UNSATISFIABLE with blocking requirement IDs', async () => {
  const body = { ...goldenBody, equipmentUseIds: [99999] }
  const pool = {
    query: async (sql) => {
      if (String(sql).includes('coaching.equipment')) return { rows: [] }
      if (String(sql).includes('coaching.sport')) return { rows: [{ id: 1 }] }
      return { rows: [] }
    },
  }
  const preflight = await runPreflight(body, pool, { metricsCatalog })
  assert.equal(preflight.ok, false)
  assert.equal(preflight.status, 'UNSATISFIABLE')
  assert.ok(preflight.blocking_requirements.some((b) => b.check_id === 'equipment_use_ids_resolvable'))
  assert.ok(preflight.blocking_requirements.some((b) => b.requirement_id != null))
  const verdict = buildEvaluatorVerdict({
    body,
    result: null,
    checks: preflight.checks,
    metricsCatalog,
    preflight,
    attempt: 0,
    evaluatedAfterLastRepair: true,
  })
  assert.equal(verdict.status, 'UNSATISFIABLE')
  assert.ok(verdict.blocking_failures.some((f) => f.requirement_id != null))
})

test('evaluator before last repair => SYSTEM_FAIL', () => {
  const body = { ...goldenBody }
  const result = fullGoldenResult()
  const checks = [{ id: 'phase_count_match', ok: true, severity: 'ok' }]
  const verdict = buildEvaluatorVerdict({
    body,
    result,
    checks,
    metricsCatalog,
    attempt: 2,
    evaluatedAfterLastRepair: false,
  })
  assert.equal(verdict.status, 'SYSTEM_FAIL')
  assert.ok(verdict.blocking_failures.some((f) => f.check_id === 'stale_evaluator_output'))
})

test('mapCheckToFailure bridges check to failure with repair_action', () => {
  const failure = mapCheckToFailure(
    { id: 'session_minutes_sum', ok: false, severity: 'P0', message: 'minutes mismatch', detail: { current: 52, expected: 60 } },
    { requirement_id: 'REQ-001', priority: 'P0', evidence_paths: ['result.blocks'] },
  )
  assert.equal(failure.requirement_id, 'REQ-001')
  assert.equal(failure.check_id, 'session_minutes_sum')
  assert.equal(failure.repair_action.type, 'adjust_dose')
})

test('verdictExitCode mapping', () => {
  assert.equal(verdictExitCode({ status: 'PASS' }), 0)
  assert.equal(verdictExitCode({ status: 'REPAIRABLE_FAIL' }), 1)
  assert.equal(verdictExitCode({ status: 'SYSTEM_FAIL' }), 2)
  assert.equal(verdictExitCode({ status: 'UNSATISFIABLE' }), 3)
})
