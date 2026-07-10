/**
 * Structured evaluator verdict for prescription quality loop.
 */

import { createHash } from 'node:crypto'
import { validateCategoryMetrics } from './categoryMetricsSchema.js'
import {
  compileRequirementsContract,
  updateRequirementStatuses,
  buildRequirementTrace,
} from './requirementsContract.js'
import { filterHardGateChecks } from './hardGateEligibility.js'

export const EVALUATOR_VERSION = '1.0.0'

export function stableHash(value) {
  const json = JSON.stringify(value, Object.keys(value).sort())
  return createHash('sha256').update(json).digest('hex').slice(0, 16)
}

function isAdvisoryCheck(check) {
  if (!check?.ok) return false
  const d = check.detail ?? {}
  if (d.tbd || d.informational) return true
  if (String(check.id).includes('_moe_') || String(check.id).includes('_tbd_')) return true
  if (String(check.id).endsWith('_kpi')) return true
  return false
}

function inferRepairAction(check, requirement) {
  const id = check.id ?? ''
  let type = 'regenerate_phase'
  if (/avoid|barbell|equipment/.test(id)) type = 'replace_exercise'
  else if (/duration|minutes|fill|underfill/.test(id)) type = 'adjust_dose'
  else if (/empty|non_empty|pool_empty/.test(id)) type = 'fill_phase'
  else if (/progression|variant|split/.test(id)) type = 'change_variant'
  else if (/over_cap|stretch|handstand|youth/.test(id)) type = 'remove_forbidden_item'

  return {
    type,
    phase_key: check.detail?.phase_key ?? null,
    item_path: check.detail?.item_path ?? null,
    preserve_minutes: true,
    preserve_phase_intent: true,
    constraints: { check_id: id, requirement_id: requirement?.requirement_id ?? null },
  }
}

export function mapCheckToFailure(check, requirement) {
  return {
    requirement_id: requirement?.requirement_id ?? null,
    severity: check.severity === 'P0' ? 'P0' : (requirement?.priority ?? 'P1'),
    check_id: check.id,
    message: check.message,
    evidence_path: requirement?.evidence_paths?.[0] ?? `checks.${check.id}`,
    current_value: check.detail?.current ?? check.detail ?? null,
    expected: check.detail?.expected ?? null,
    repair_action: inferRepairAction(check, requirement),
  }
}

function findRequirementForField(requirements, field) {
  return requirements.find((r) => r.normalized_constraint.field === field) ?? null
}

function mapContradictionToFailure(contradiction, requirements) {
  const req = findRequirementForField(requirements, contradiction.field)
  const relaxations = {}
  if (contradiction.type === 'equipment_use_avoid_overlap') {
    relaxations.field = 'equipmentAvoidIds'
    relaxations.suggestion = `Remove overlapping IDs: ${(contradiction.overlapping_ids ?? []).join(', ')}`
  }
  if (contradiction.type === 'duration_phase_plan_mismatch') {
    relaxations.field = 'durationMinutes'
    relaxations.suggestion = `Set durationMinutes to ${contradiction.plan_sum} or adjust phase minutes`
  }
  return {
    requirement_id: req?.requirement_id ?? null,
    severity: 'P0',
    check_id: contradiction.type,
    message: contradiction.message,
    evidence_path: contradiction.field ? `body.${contradiction.field}` : 'body',
    current_value: contradiction.overlapping_ids ?? contradiction.plan_sum ?? null,
    expected: contradiction.duration_minutes ?? contradiction.overlapping_ids ? [] : null,
    repair_action: {
      type: 'return_unsatisfiable',
      phase_key: null,
      item_path: null,
      preserve_minutes: true,
      preserve_phase_intent: true,
      constraints: relaxations,
    },
  }
}

function suggestedRelaxationsFromContradictions(contradictions) {
  return contradictions.map((c) => {
    if (c.type === 'equipment_use_avoid_overlap') {
      return {
        field: 'equipmentAvoidIds',
        suggestion: `Remove overlapping IDs from avoid list: ${(c.overlapping_ids ?? []).join(', ')}`,
      }
    }
    if (c.type === 'duration_phase_plan_mismatch') {
      return {
        field: 'durationMinutes',
        suggestion: `Set durationMinutes to ${c.plan_sum} or adjust phase minutes`,
      }
    }
    return { field: c.field ?? 'body', suggestion: c.message }
  })
}

function findRequirementForCheck(requirements, checkId) {
  return requirements.find((r) => (r.mapped_checks ?? []).includes(checkId))
    ?? requirements.find((r) => (r.eligible_checks ?? []).includes(checkId))
}

/**
 * @param {object} params
 */
export function buildEvaluatorVerdict(params) {
  const {
    body,
    result = null,
    checks = [],
    metricsCatalog = null,
    context = {},
    attempt = 1,
    inputHash = null,
    outputHash = null,
    evaluatedAfterLastRepair = true,
    preflight = null,
  } = params

  const blocking_failures = []
  const advisory_findings = []
  const passed_requirements = []
  const locked_paths = []

  if (metricsCatalog) {
    const schema = validateCategoryMetrics(metricsCatalog)
    if (!schema.ok) {
      return finalizeVerdict({
        status: 'SYSTEM_FAIL',
        pass: false,
        attempt,
        inputHash: inputHash ?? stableHash(body ?? {}),
        outputHash,
        evaluatedAfterLastRepair,
        blocking_failures: [{
          requirement_id: null,
          severity: 'P0',
          check_id: 'metrics_schema',
          message: `Malformed metrics catalog: ${schema.violations.slice(0, 3).join('; ')}`,
          evidence_path: 'docs/NEEDS_ENGINE_CATEGORY_METRICS.json',
          current_value: schema.violations.length,
          expected: 0,
          repair_action: { type: 'return_unsatisfiable', phase_key: null, item_path: null, preserve_minutes: true, preserve_phase_intent: true, constraints: {} },
        }],
        advisory_findings: [],
        requirement_trace: [],
        passed_requirements: [],
        locked_paths: [],
        repair_plan: null,
        checks,
      })
    }
  }

  if (preflight && !preflight.ok && preflight.status === 'UNSATISFIABLE') {
    return finalizeVerdict({
      status: 'UNSATISFIABLE',
      pass: false,
      attempt,
      inputHash: inputHash ?? stableHash(body ?? {}),
      outputHash,
      evaluatedAfterLastRepair,
      blocking_failures: (preflight.blocking_requirements ?? []).map((br) => ({
        requirement_id: br.requirement_id ?? null,
        severity: 'P0',
        check_id: br.check_id ?? 'preflight',
        message: br.message ?? 'Preflight unsatisfiable',
        evidence_path: br.evidence_path ?? 'preflight',
        current_value: br.current_value ?? null,
        expected: br.expected ?? null,
        repair_action: { type: 'return_unsatisfiable', phase_key: null, item_path: null, preserve_minutes: true, preserve_phase_intent: true, constraints: br.relaxations ?? {} },
      })),
      advisory_findings: [],
      requirement_trace: [],
      passed_requirements: [],
      locked_paths: [],
      repair_plan: null,
      checks,
      suggested_relaxations: preflight.suggested_relaxations ?? [],
    })
  }

  const { requirements, parse_errors, contradictions } = compileRequirementsContract(body, { metricsCatalog })
  if (parse_errors.length > 0) {
    return finalizeVerdict({
      status: 'SYSTEM_FAIL',
      pass: false,
      attempt,
      inputHash: inputHash ?? stableHash(body ?? {}),
      outputHash,
      evaluatedAfterLastRepair,
      blocking_failures: parse_errors.map((msg) => ({
        requirement_id: null,
        severity: 'P0',
        check_id: 'requirements_parse',
        message: msg,
        evidence_path: 'body',
        current_value: null,
        expected: 'parseable',
        repair_action: { type: 'return_unsatisfiable', phase_key: null, item_path: null, preserve_minutes: true, preserve_phase_intent: true, constraints: {} },
      })),
      advisory_findings: [],
      requirement_trace: [],
      passed_requirements: [],
      locked_paths: [],
      repair_plan: null,
      checks,
    })
  }

  if (contradictions.length > 0) {
    return finalizeVerdict({
      status: 'UNSATISFIABLE',
      pass: false,
      attempt,
      inputHash: inputHash ?? stableHash(body ?? {}),
      outputHash,
      evaluatedAfterLastRepair,
      blocking_failures: contradictions.map((c) => mapContradictionToFailure(c, requirements)),
      advisory_findings: [],
      requirement_trace: buildRequirementTrace(requirements),
      passed_requirements: [],
      locked_paths: [],
      repair_plan: null,
      checks,
      suggested_relaxations: suggestedRelaxationsFromContradictions(contradictions),
    })
  }

  updateRequirementStatuses(requirements, checks, metricsCatalog)

  for (const req of requirements) {
    if (req.status === 'pass') passed_requirements.push(req.requirement_id)
    if (req.hard_gate && req.status === 'unsatisfied_mapping' && (req.priority === 'P0' || req.priority === 'P1')) {
      blocking_failures.push({
        requirement_id: req.requirement_id,
        severity: req.priority,
        check_id: 'unsatisfied_mapping',
        message: `Hard requirement ${req.normalized_constraint.field} maps only to partial/TBD/ineligible checks`,
        evidence_path: req.evidence_paths[0],
        current_value: req.mapped_checks,
        expected: 'hard-gate eligible check',
        repair_action: { type: 'return_unsatisfiable', phase_key: null, item_path: null, preserve_minutes: true, preserve_phase_intent: true, constraints: {} },
      })
    }
    if (req.hard_gate && req.status === 'fail' && (req.priority === 'P0' || req.priority === 'P1')) {
      for (const checkId of req.failed_checks ?? []) {
        const check = checks.find((c) => c.id === checkId)
        if (check && !check.ok) blocking_failures.push(mapCheckToFailure(check, req))
      }
    }
  }

  const failedAtomic = checks.filter((c) => !c.ok && (c.severity === 'P0' || c.severity === 'P1'))
  for (const check of failedAtomic) {
    const req = findRequirementForCheck(requirements, check.id)
    const existing = blocking_failures.some((f) => f.check_id === check.id)
    if (!existing) blocking_failures.push(mapCheckToFailure(check, req))
  }

  for (const check of checks) {
    if (isAdvisoryCheck(check)) {
      advisory_findings.push({
        check_id: check.id,
        message: check.message,
        detail: check.detail ?? null,
      })
    }
  }

  // KPI pass but atomic P0 fail
  const kpiChecks = checks.filter((c) => String(c.id).endsWith('_kpi') && c.ok)
  const p0Fails = checks.filter((c) => !c.ok && c.severity === 'P0')
  if (kpiChecks.length > 0 && p0Fails.length > 0) {
    for (const check of p0Fails) {
      if (!blocking_failures.some((f) => f.check_id === check.id)) {
        blocking_failures.push(mapCheckToFailure(check, findRequirementForCheck(requirements, check.id)))
      }
    }
  }

  if (attempt > 0 && !evaluatedAfterLastRepair) {
    blocking_failures.push({
      requirement_id: null,
      severity: 'P0',
      check_id: 'stale_evaluator_output',
      message: 'Evaluator result generated before last repair attempt',
      evidence_path: 'verdict.evaluated_after_last_repair',
      current_value: false,
      expected: true,
      repair_action: { type: 'regenerate_session', phase_key: null, item_path: null, preserve_minutes: false, preserve_phase_intent: false, constraints: {} },
    })
  }

  const hardP01Unmapped = requirements.filter(
    (r) => r.hard_gate && (r.priority === 'P0' || r.priority === 'P1') && r.status === 'unsatisfied_mapping',
  )
  const hasSystemFail = hardP01Unmapped.length > 0 || blocking_failures.some((f) => f.check_id === 'stale_evaluator_output' || f.check_id === 'metrics_schema')
  const hasBlocking = blocking_failures.length > 0

  let status = 'PASS'
  let pass = true
  if (hasSystemFail) {
    status = 'SYSTEM_FAIL'
    pass = false
  } else if (hasBlocking) {
    status = 'REPAIRABLE_FAIL'
    pass = false
  }

  const repair_plan = status === 'REPAIRABLE_FAIL'
    ? blocking_failures.map((f) => f.repair_action).filter(Boolean)
    : null

  for (const req of requirements) {
    if (req.status === 'pass' && req.hard_gate) {
      locked_paths.push(...(req.evidence_paths ?? []))
    }
  }

  return finalizeVerdict({
    status,
    pass,
    attempt,
    inputHash: inputHash ?? stableHash(body ?? {}),
    outputHash: outputHash ?? (result ? stableHash({ blocks: result.blocks }) : null),
    evaluatedAfterLastRepair,
    blocking_failures,
    advisory_findings,
    requirement_trace: buildRequirementTrace(requirements),
    passed_requirements,
    locked_paths: [...new Set(locked_paths)],
    repair_plan,
    checks,
  })
}

function finalizeVerdict(v) {
  return {
    status: v.status,
    pass: v.pass,
    attempt: v.attempt,
    input_hash: v.inputHash,
    output_hash: v.outputHash,
    engine_version: null,
    evaluator_version: EVALUATOR_VERSION,
    evaluated_after_last_repair: v.evaluatedAfterLastRepair,
    blocking_failures: v.blocking_failures,
    advisory_findings: v.advisory_findings,
    requirement_trace: v.requirement_trace,
    passed_requirements: v.passed_requirements,
    locked_paths: v.locked_paths,
    repair_plan: v.repair_plan,
    suggested_relaxations: v.suggested_relaxations ?? null,
    checks: v.checks,
  }
}

export function verdictExitCode(verdict) {
  if (verdict.status === 'PASS') return 0
  if (verdict.status === 'REPAIRABLE_FAIL') return 1
  if (verdict.status === 'SYSTEM_FAIL') return 2
  if (verdict.status === 'UNSATISFIABLE') return 3
  return 1
}
