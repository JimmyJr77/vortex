import assert from 'node:assert/strict'
import test from 'node:test'
import {
  compileRequirementsContract,
  updateRequirementStatuses,
  detectRequirementContradictions,
  summarizeRequirements,
} from '../requirementsContract.js'
import {
  canRequirementPass,
  isHardGateEligibleMetric,
  filterHardGateChecks,
} from '../hardGateEligibility.js'
import {
  getChecksForRequirement,
  getRequirementKeysForCheck,
  resolveCheckIdsForRequirement,
} from '../checkMappingRegistry.js'
import { goldenBody, loadMetricsCatalog, makeShiftedC20Metric } from './evalLoopFixtures.js'

const catalog = loadMetricsCatalog()

test('compileRequirementsContract golden body has no parse_errors', () => {
  const { requirements, parse_errors } = compileRequirementsContract(goldenBody, { metricsCatalog: catalog })
  assert.equal(parse_errors.length, 0)
  assert.ok(requirements.length >= 20)
})

test('compileRequirementsContract covers explicit golden body fields', () => {
  const { requirements } = compileRequirementsContract(goldenBody, { metricsCatalog: catalog })
  const fields = new Set(requirements.map((r) => r.normalized_constraint.field))
  for (const f of [
    'durationMinutes',
    'phasePlan',
    'phasePlanOrder',
    'phasePlanMinutes',
    'workMode',
    'sportId',
    'sessionObjective',
    'skillLevel',
    'audience',
    'audienceSplits',
    'splitDifficultyCaps',
    'equipmentUseIds',
    'equipmentAvoidIds',
    'focusTargets',
    'pinnedPrepare',
    'restore',
    'youthSafety',
    'constraintReport',
    'feasibility',
  ]) {
    assert.ok(fields.has(f), `missing field ${f}`)
  }
})

test('durationMinutes maps to phase_plan_minute_sum_mos and session_minutes_sum', () => {
  const mapped = getChecksForRequirement('durationMinutes')
  assert.ok(mapped.includes('phase_plan_minute_sum_mos'))
  assert.ok(mapped.includes('session_minutes_sum'))
  assert.ok(mapped.includes('phase_minutes_exact'))
  const resolved = resolveCheckIdsForRequirement('durationMinutes', catalog)
  assert.ok(resolved.includes('phase_plan_minute_sum_mos'))
})

test('every P0/P1 hard requirement has mapped_checks or unsatisfied_mapping', () => {
  const { requirements } = compileRequirementsContract(goldenBody, { metricsCatalog: catalog })
  const hard = requirements.filter((r) => r.hard_gate && (r.priority === 'P0' || r.priority === 'P1'))
  for (const req of hard) {
    assert.ok(
      req.mapped_checks.length > 0 || req.status === 'unsatisfied_mapping',
      `${req.normalized_constraint.field} has no mapped checks`,
    )
  }
})

test('hard requirement with only partial mapped check is unsatisfied_mapping', () => {
  const req = {
    hard_gate: true,
    priority: 'P0',
    mapped_checks: ['category20_moe_review_packet'],
  }
  const verdict = canRequirementPass(req, [{ id: 'category20_moe_review_packet', ok: true }], catalog)
  assert.equal(verdict.ok, false)
  assert.equal(verdict.reason, 'unsatisfied_mapping')
  assert.equal(filterHardGateChecks(req, catalog).length, 0)
})

test('isHardGateEligibleMetric rejects ineligible metric types', () => {
  assert.equal(isHardGateEligibleMetric(makeShiftedC20Metric()), false)
  assert.equal(isHardGateEligibleMetric({
    'In app?': 'yes',
    'Evaluable?': 'partial (manual)',
    check_id: 'category20_moe_review_packet',
    Metric: 'Review',
  }), false)
  assert.equal(isHardGateEligibleMetric({
    'In app?': 'yes',
    'Evaluable?': 'yes (TBD stub)',
    check_id: 'category20_tbd_split_reject_codes',
    Metric: 'TBD',
  }), false)
  assert.equal(isHardGateEligibleMetric({
    'In app?': 'yes',
    'Evaluable?': 'yes (info)',
    check_id: 'constraint_hiit_fallback_logged',
    Metric: 'Info metric',
  }), false)
})

test('equipmentUse and equipmentAvoid overlap detected at compile', () => {
  const body = { ...goldenBody, equipmentUseIds: [3, 7], equipmentAvoidIds: [3] }
  const { contradictions } = detectRequirementContradictions(body)
  assert.equal(contradictions.length, 1)
  assert.equal(contradictions[0].type, 'equipment_use_avoid_overlap')
  const compiled = compileRequirementsContract(body, { metricsCatalog: catalog })
  assert.ok(compiled.contradictions.length > 0)
})

test('use_only ignores equipmentAvoidIds for overlap and avoid requirements', () => {
  const body = {
    ...goldenBody,
    equipmentUsePolicy: 'use_only',
    equipmentUseIds: [7],
    equipmentAvoidIds: [3],
  }
  const { contradictions } = detectRequirementContradictions(body)
  assert.equal(contradictions.length, 0)
  const compiled = compileRequirementsContract(body, { metricsCatalog: catalog })
  assert.ok(!compiled.requirements.some((r) => r.normalized_constraint?.field === 'equipmentAvoidIds'))
  assert.ok(compiled.requirements.some((r) => r.normalized_constraint?.field === 'equipmentUsePolicy'))
})

test('updateRequirementStatuses marks pass when eligible checks ok', () => {
  const { requirements } = compileRequirementsContract(goldenBody, { metricsCatalog: catalog })
  const durationReq = requirements.find((r) => r.normalized_constraint.field === 'durationMinutes')
  const checks = [
    { id: 'phase_plan_minute_sum_mos', ok: true },
    { id: 'session_minutes_sum', ok: true },
    { id: 'phase_minutes_exact', ok: true },
  ]
  updateRequirementStatuses(requirements, checks, catalog)
  updateRequirementStatuses([durationReq], checks, catalog)
  assert.equal(durationReq.status, 'pass')
})

test('getRequirementKeysForCheck reverse index', () => {
  const keys = getRequirementKeysForCheck('phase_count_match')
  assert.ok(keys.includes('phasePlan'))
})

test('summarizeRequirements reports counts', () => {
  const { requirements } = compileRequirementsContract(goldenBody, { metricsCatalog: catalog })
  const summary = summarizeRequirements(requirements)
  assert.ok(summary.total >= 20)
  assert.ok(summary.hard_p01 > 0)
})
