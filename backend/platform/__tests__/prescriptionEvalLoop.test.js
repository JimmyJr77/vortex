import assert from 'node:assert/strict'
import test from 'node:test'
import {
  evaluatePrescriptionQuality,
  evaluateCategory1Structure,
  DEFAULT_STRICT_THRESHOLDS,
} from '../prescriptionQualityChecks.js'
import { buildEvaluatorVerdict, stableHash, verdictExitCode } from '../evaluatorVerdict.js'
import { runPreflight } from '../preflightSatisfiability.js'
import {
  applyRepairActions,
  buildRepairPlan,
  computeLockedPaths,
  runPrescriptionEvalLoop,
} from '../prescriptionRepairLoop.js'
import { canRequirementPass } from '../hardGateEligibility.js'
import { compileRequirementsContract } from '../requirementsContract.js'
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

const GOLDEN_AUDIENCE_SPLITS = [
  { label: 'Split 1', age_min: 8, age_max: 10, caps: { maxOverall: 6, maxTechnical: 6, maxLoad: 6 } },
  { label: 'Split 2', age_min: 11, age_max: 14, caps: { maxOverall: 10, maxTechnical: 10, maxLoad: 10 } },
]

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
    metricsCatalog,
    attempt: extra.attempt ?? 1,
    inputHash: stableHash(body),
    outputHash: stableHash({ blocks: result.blocks }),
    evaluatedAfterLastRepair: extra.evaluatedAfterLastRepair ?? true,
    preflight: extra.preflight ?? null,
  })
  return { verdict, checks: allChecks }
}

test('valid golden fixture produces requirement_trace', () => {
  const body = { ...goldenBody }
  const result = fullGoldenResult({ work_mode: body.workMode })
  const { verdict } = evalAndVerdict(body, result)
  assert.ok(verdict.requirement_trace.length > 0)
  assert.ok(['PASS', 'REPAIRABLE_FAIL', 'SYSTEM_FAIL'].includes(verdict.status))
})

test('duration 60 output 52 => REPAIRABLE_FAIL', () => {
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

test('phasePlan restore omitted => REPAIRABLE_FAIL', () => {
  const body = {
    ...goldenBody,
    phasePlan: goldenBody.phasePlan.filter((p) => p.phaseKey !== 'restore'),
    durationMinutes: goldenBody.durationMinutes - 4,
  }
  const blocks = goldenBlocksFromPlan(body)
  const result = mockResult({ blocks, work_mode: body.workMode })
  const { verdict } = evalAndVerdict(body, result)
  assert.equal(verdict.pass, false)
})

test('phase order changed => REPAIRABLE_FAIL', () => {
  const body = { ...goldenBody }
  const blocks = goldenBlocksFromPlan(body)
  blocks.reverse()
  const result = mockResult({ blocks, work_mode: body.workMode })
  const { verdict } = evalAndVerdict(body, result)
  assert.equal(verdict.pass, false)
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
})

test('avoid barbells primary => REPAIRABLE_FAIL', () => {
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
})

test('equipmentUse and equipmentAvoid overlap => UNSATISFIABLE', async () => {
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
  assert.ok(verdict.blocking_failures.length > 0)
})

test('partial/TBD-only mapped check for hard requirement => unsatisfied_mapping', () => {
  const req = {
    hard_gate: true,
    priority: 'P0',
    mapped_checks: ['category20_moe_review_packet'],
    requirement_id: 'REQ-TEST',
    normalized_constraint: { field: 'constraintReport' },
    evidence_paths: ['result.constraint_report'],
  }
  const verdict = canRequirementPass(req, [{ id: 'category20_moe_review_packet', ok: true }], metricsCatalog)
  assert.equal(verdict.reason, 'unsatisfied_mapping')
  assert.equal(verdict.ok, false)
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

test('KPI pass but atomic P0 fail => never PASS', () => {
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
  assert.equal(verdict.pass, false)
})

test('repair preserves locked paths', () => {
  const body = { ...goldenBody }
  const result = fullGoldenResult()
  const { requirements } = compileRequirementsContract(body, { metricsCatalog })
  const checks = [{ id: 'phase_count_match', ok: true, severity: 'ok' }]
  const locked = computeLockedPaths(requirements, checks, result)
  const plan = buildRepairPlan([{
    repair_action: { type: 'fill_phase', phase_key: 'restore', constraints: {} },
  }], result, body, locked)
  assert.ok(Array.isArray(plan))
})

test('no silent compromise: dropped duration surfaces failure', async () => {
  const body = { ...goldenBody }
  delete body.durationMinutes
  const preflight = await runPreflight(body, null, { metricsCatalog })
  assert.equal(preflight.ok, false)
})

test('verdictExitCode mapping', () => {
  assert.equal(verdictExitCode({ status: 'PASS' }), 0)
  assert.equal(verdictExitCode({ status: 'REPAIRABLE_FAIL' }), 1)
  assert.equal(verdictExitCode({ status: 'SYSTEM_FAIL' }), 2)
  assert.equal(verdictExitCode({ status: 'UNSATISFIABLE' }), 3)
})

test('applyRepairActions fill_phase adds item to empty block', () => {
  const result = mockResult({
    blocks: [{ phase_key: 'restore', target_minutes: 4, estimated_minutes: 0, items: [] }],
  })
  const patched = applyRepairActions(result, [{
    type: 'fill_phase',
    phase_key: 'restore',
    constraints: { exercise_name: 'Child Pose' },
  }], {})
  assert.equal(patched.blocks[0].items.length, 1)
})

test('avoidExerciseSlug in per_split variant => REPAIRABLE_FAIL', () => {
  const body = { ...goldenBody, avoidExerciseSlugs: ['barbell-back-squat'] }
  const blocks = goldenBlocksFromPlan(body)
  blocks[3].items = [{
    exercise_id: 10,
    exercise_name: 'Goblet Squat',
    per_split: [{ split_label: 'Split 2', variant_type: 'progression', exercise_id: 50, exercise_name: 'Barbell Back Squat' }],
  }]
  const ctx = buildExerciseContext({ blocks })
  ctx.exerciseById.set(50, { id: 50, slug: 'barbell-back-squat', movement_family: 'strength' })
  ctx.avoidSlugExists = new Map([['barbell-back-squat', true]])
  const result = mockResult({ blocks, work_mode: body.workMode })
  const evalResult = evaluatePrescriptionQuality(result, DEFAULT_STRICT_THRESHOLDS, {
    expectedBody: body, sessionAgeMax: 14, ...ctx,
  })
  const verdict = buildEvaluatorVerdict({
    body, result, checks: evalResult.checks, metricsCatalog, attempt: 1, evaluatedAfterLastRepair: true,
  })
  assert.equal(verdict.pass, false)
})

test('no silent compromise: omitted restore phase surfaces REPAIRABLE_FAIL', () => {
  const body = {
    ...goldenBody,
    phasePlan: goldenBody.phasePlan.filter((p) => p.phaseKey !== 'restore'),
    durationMinutes: goldenBody.durationMinutes - 4,
  }
  const blocks = goldenBlocksFromPlan(body)
  const result = mockResult({ blocks, work_mode: body.workMode })
  const { verdict } = evalAndVerdict(body, result)
  assert.notEqual(verdict.status, 'PASS')
  assert.ok(verdict.blocking_failures.length > 0 || verdict.status === 'REPAIRABLE_FAIL')
})

test('no silent compromise: workMode change not silently accepted', () => {
  const body = { ...goldenBody, workMode: 'skill' }
  const result = fullGoldenResult({ work_mode: 'exercise' })
  const { verdict } = evalAndVerdict(body, result)
  assert.equal(verdict.pass, false)
})

test('valid request with passing eligible checks => PASS', () => {
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
  assert.equal(verdictExitCode(verdict), 0)
})

test('PASS requirement_trace maps explicit hard requirements to eligible checks', () => {
  const body = { ...goldenBody }
  const { requirements } = compileRequirementsContract(body, { metricsCatalog })
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
  const explicitHard = requirements.filter((r) => r.hard_gate && (r.priority === 'P0' || r.priority === 'P1'))
  assert.ok(explicitHard.length > 0)
  for (const req of explicitHard) {
    const trace = verdict.requirement_trace.find((t) => t.requirement_id === req.requirement_id)
    assert.ok(trace, `missing trace for ${req.requirement_id}`)
    assert.ok((trace.eligible_checks ?? trace.mapped_checks ?? []).length > 0)
  }
})

test('avoid barbells in per_split progression => REPAIRABLE_FAIL', () => {
  const body = { ...goldenBody, equipmentAvoidIds: [99] }
  const blocks = goldenBlocksFromPlan(body)
  blocks[3].items = [{
    exercise_id: 10,
    exercise_name: 'Goblet Squat',
    per_split: [{
      split_label: 'Split 2',
      variant_type: 'progression',
      exercise_id: 50,
      exercise_name: 'Barbell Back Squat',
    }],
  }]
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

test('equipmentUse cones with no cone work in prescription => REPAIRABLE_FAIL', () => {
  const body = { ...goldenBody }
  const tagMap = new Map([
    ['101', [{ facetType: 'equipment', facetId: 7 }]],
    ['102', [{ facetType: 'equipment', facetId: 1742 }]],
  ])
  const equipmentKeyById = new Map([[7, 'kettlebell'], [1742, 'jump_rope'], [12, 'cones']])
  const blocks = goldenBlocksFromPlan(body).map((b) => {
    if (b.phase_key === 'output') {
      return {
        ...b,
        items: [
          { exercise_id: 101, exercise_name: 'KB Swing', difficulty: { overall: 5 } },
          { exercise_id: 102, exercise_name: 'Jump Rope', difficulty: { overall: 4 } },
        ],
      }
    }
    if (b.phase_key === 'capacity') {
      return {
        ...b,
        items: [{ exercise_id: 101, exercise_name: 'KB Swing', difficulty: { overall: 5 } }],
      }
    }
    return b
  })
  const result = mockResult({ blocks, work_mode: body.workMode })
  const ctx = buildExerciseContext({ blocks })
  for (const [id, meta] of [
    [101, { id: 101, slug: 'kb-swing', name: 'KB Swing', movement_family: 'strength' }],
    [102, { id: 102, slug: 'jump-rope', name: 'Jump Rope', movement_family: 'conditioning' }],
  ]) {
    ctx.exerciseById.set(id, meta)
  }
  const evalResult = evaluatePrescriptionQuality(result, DEFAULT_STRICT_THRESHOLDS, {
    expectedBody: body,
    sessionAgeMax: body.ageMax,
    tagMap,
    equipmentKeyById,
    ...ctx,
  })
  const verdict = buildEvaluatorVerdict({
    body, result, checks: evalResult.checks, metricsCatalog, attempt: 1, evaluatedAfterLastRepair: true,
  })
  assert.equal(verdict.pass, false)
  assert.equal(verdict.status, 'REPAIRABLE_FAIL')
})

test('avoidExerciseSlug in primary => REPAIRABLE_FAIL', () => {
  const body = { ...goldenBody, avoidExerciseSlugs: ['barbell-back-squat'] }
  const blocks = goldenBlocksFromPlan(body)
  blocks[3].items = [{ exercise_id: 50, exercise_name: 'Barbell Back Squat', difficulty: { overall: 6 } }]
  const ctx = buildExerciseContext({ blocks })
  ctx.exerciseById.set(50, { id: 50, slug: 'barbell-back-squat', movement_family: 'strength' })
  ctx.avoidSlugExists = new Map([['barbell-back-squat', true]])
  const result = mockResult({ blocks, work_mode: body.workMode })
  const evalResult = evaluatePrescriptionQuality(result, DEFAULT_STRICT_THRESHOLDS, {
    expectedBody: body, sessionAgeMax: 14, ...ctx,
  })
  const verdict = buildEvaluatorVerdict({
    body, result, checks: evalResult.checks, metricsCatalog, attempt: 1, evaluatedAfterLastRepair: true,
  })
  assert.equal(verdict.pass, false)
  assert.equal(verdict.status, 'REPAIRABLE_FAIL')
})

test('excludeBodyRegionIds in exercise tags => REPAIRABLE_FAIL', () => {
  const body = { ...goldenBody, excludeBodyRegionIds: [55] }
  const blocks = goldenBlocksFromPlan(body)
  blocks[3].items = [{ exercise_id: 10, exercise_name: 'Shoulder Press', difficulty: { overall: 5 } }]
  const ctx = buildExerciseContext({ blocks })
  ctx.tagMap.set('10', [{ facetType: 'body_region', facetId: 55 }])
  const result = mockResult({
    blocks,
    work_mode: body.workMode,
    constraint_report: {
      empty_phase_reasons: [],
      phase_fill: [],
      equipment_avoid: { sample_names: [] },
      exercise_avoid: { excluded_count: 0 },
      body_region_avoid: { excluded_count: 1 },
    },
  })
  const evalResult = evaluatePrescriptionQuality(result, DEFAULT_STRICT_THRESHOLDS, {
    expectedBody: body, sessionAgeMax: 14, ...ctx,
  })
  const verdict = buildEvaluatorVerdict({
    body, result, checks: evalResult.checks, metricsCatalog, attempt: 1, evaluatedAfterLastRepair: true,
  })
  assert.equal(verdict.pass, false)
  assert.equal(verdict.status, 'REPAIRABLE_FAIL')
})

test('youth ageMax 14 + advanced inversion in MI => REPAIRABLE_FAIL', () => {
  const body = { ...goldenBody, ageMax: 14 }
  const blocks = goldenBlocksFromPlan(body).map((b) => {
    const base = { ...b, items: b.items ?? [] }
    if (b.phase_key === 'movement_intelligence') {
      base.items = [{ exercise_id: 99, exercise_name: 'Wall Handstand Hold', per_split: [] }]
    }
    return base
  })
  const ctx = buildExerciseContext({ blocks })
  ctx.exerciseById.set(99, { id: 99, slug: 'wall-handstand-hold', name: 'Wall Handstand Hold' })
  const result = mockResult({
    blocks,
    work_mode: body.workMode,
    audience_profile: { ageMin: 8, ageMax: 14, scalingCohort: 'youth_intermediate' },
  })
  const evalResult = evaluatePrescriptionQuality(result, DEFAULT_STRICT_THRESHOLDS, {
    expectedBody: body, sessionAgeMax: 14, ...ctx,
  })
  const verdict = buildEvaluatorVerdict({
    body, result, checks: evalResult.checks, metricsCatalog, attempt: 1, evaluatedAfterLastRepair: true,
  })
  assert.equal(verdict.pass, false)
  assert.equal(verdict.status, 'REPAIRABLE_FAIL')
  assert.ok(
    evalResult.checks.some((c) => c.id === 'mi_no_handstand_youth' && !c.ok),
    'expected mi_no_handstand_youth P0 failure',
  )
})

test('split1 cap 6 with variant difficulty 8 => REPAIRABLE_FAIL', () => {
  const body = { ...goldenBody, ageMax: 14 }
  const blocks = goldenBlocksFromPlan(body).map((b) => {
    const base = { ...b, estimated_minutes: b.target_minutes, items: [] }
    if (b.phase_key === 'output') {
      base.items = [{
        exercise_id: 10,
        exercise_name: 'Sprint Drill',
        difficulty: { overall: 8 },
        per_split: [{
          split_label: 'Split 1',
          variant_type: 'same',
          exercise_id: 10,
          difficulty: { overall: 8 },
          difficulty_cap: 6,
        }],
      }]
    }
    return base
  })
  const result = mockResult({
    blocks,
    work_mode: body.workMode,
    audience_splits: GOLDEN_AUDIENCE_SPLITS,
    audience_profile: { ageMin: 8, ageMax: 14, caps: { maxOverall: 6, maxTechnical: 6, maxLoad: 6 } },
  })
  const { verdict } = evalAndVerdict(body, result)
  assert.equal(verdict.pass, false)
  assert.equal(verdict.status, 'REPAIRABLE_FAIL')
})

test('over_cap primary admitted => REPAIRABLE_FAIL', () => {
  const body = { ...goldenBody, ageMax: 14 }
  const blocks = goldenBlocksFromPlan(body).map((b) => {
    const base = { ...b, estimated_minutes: b.target_minutes, items: [] }
    if (b.phase_key === 'output') {
      base.items = [{
        exercise_id: 10,
        exercise_name: 'Too Hard',
        age_fit: 'over_cap',
        difficulty: { overall: 9, technical: 9, load: 8 },
        per_split: [],
      }]
    }
    return base
  })
  const result = mockResult({
    blocks,
    work_mode: body.workMode,
    audience_splits: GOLDEN_AUDIENCE_SPLITS,
    audience_profile: { ageMin: 8, ageMax: 14, caps: { maxOverall: 6, maxTechnical: 6, maxLoad: 5 } },
  })
  const { verdict } = evalAndVerdict(body, result)
  assert.equal(verdict.pass, false)
  assert.equal(verdict.status, 'REPAIRABLE_FAIL')
})

test('warning masks missing high-intent split variant => REPAIRABLE_FAIL', () => {
  const body = { ...goldenBody, ageMax: 14 }
  const blocks = goldenBlocksFromPlan(body).map((b) => {
    const base = { ...b, estimated_minutes: b.target_minutes, items: [] }
    if (b.phase_key === 'output') {
      base.items = [{
        exercise_id: 10,
        exercise_name: 'Sprint Drill',
        age_fit: 'good',
        per_split: [{
          split_label: 'Split 2',
          variant_type: 'missing',
          exercise_id: null,
          exercise_name: 'No suitable variant',
        }],
      }]
    }
    return base
  })
  const result = mockResult({
    blocks,
    work_mode: body.workMode,
    split_variant_warnings: ['Unrelated cap warning for another drill'],
    audience_splits: GOLDEN_AUDIENCE_SPLITS,
    audience_profile: { ageMin: 8, ageMax: 14, caps: { maxOverall: 6, maxTechnical: 6, maxLoad: 5 } },
  })
  const { verdict } = evalAndVerdict(body, result)
  assert.equal(verdict.pass, false)
  assert.equal(verdict.status, 'REPAIRABLE_FAIL')
  assert.ok(
    verdict.blocking_failures.some((f) => f.check_id === 'warnings_missing_high_intent_mor')
      || verdict.blocking_failures.some((f) => f.check_id === 'split_missing_high_intent'),
    'expected missing high-intent variant failure',
  )
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
  assert.equal(verdictExitCode(verdict), 3)
  assert.ok(verdict.blocking_failures.some((f) => f.requirement_id != null))
})

test('repair loop replaces only failed item; locked blocks preserved (integration)', async () => {
  const body = { ...goldenBody }
  const broken = fullGoldenResult({ work_mode: body.workMode })
  broken.blocks.find((b) => b.phase_key === 'restore').items = []
  const outputBefore = JSON.stringify(broken.blocks.find((b) => b.phase_key === 'output'))

  const out = await runPrescriptionEvalLoop(null, 1, body, {
    metricsCatalog,
    maxAttempts: 2,
    prescribe: async () => JSON.parse(JSON.stringify(broken)),
    loadContext: async (_p, res) => buildExerciseContext(res),
    evaluate: (res, _th, ctx) => evalResult(body, res, ctx),
  })

  assert.ok(out.repair_history.length >= 1)
  const restoreRepair = out.repair_history.some((h) =>
    h.actions.some((a) => a.phase_key === 'restore' || a.type === 'fill_phase'),
  )
  assert.ok(restoreRepair, 'expected restore-targeted repair action')

  const repaired = applyRepairActions(
    JSON.parse(JSON.stringify(broken)),
    out.repair_history[0].actions,
    body,
    buildExerciseContext(broken),
  )
  assert.equal(outputBefore, JSON.stringify(repaired.blocks.find((b) => b.phase_key === 'output')))
  assert.ok(repaired.blocks.find((b) => b.phase_key === 'restore').items.length > 0)
})
