/**
 * Compiles prescribe body into atomic requirements with mapped checks.
 */

import { SESSION_PHASE_ORDER } from './phaseArchitect.js'
import { getChecksForRequirement } from './checkMappingRegistry.js'
import { canRequirementPass, filterHardGateChecks } from './hardGateEligibility.js'

let reqCounter = 0

function nextReqId() {
  reqCounter += 1
  return `REQ-${String(reqCounter).padStart(3, '0')}`
}

function planRows(body) {
  return body?.phasePlan ?? body?.phase_plan ?? []
}

function bodySplits(body) {
  return body?.audienceSplits ?? body?.audience_splits ?? []
}

function overlapNumericArrays(a, b) {
  const setB = new Set((b ?? []).map(Number))
  return (a ?? []).map(Number).filter((id) => setB.has(id))
}

function makeRequirement({
  source,
  rawText,
  field,
  operator,
  value,
  priority,
  hard_gate,
  mapKey,
  evidence_paths,
  metricsCatalog,
}) {
  const mapped_checks = getChecksForRequirement(mapKey)
  const eligible = metricsCatalog
    ? filterHardGateChecks({ mapped_checks, hard_gate }, metricsCatalog)
    : mapped_checks

  return {
    requirement_id: nextReqId(),
    source,
    raw_text: rawText ?? null,
    normalized_constraint: { field, operator, value },
    priority,
    hard_gate,
    mapped_checks,
    eligible_checks: eligible,
    evidence_paths: evidence_paths ?? [`body.${field}`],
    status: hard_gate && eligible.length === 0 ? 'unsatisfied_mapping' : 'not_evaluable',
    repair_hint: null,
  }
}

/**
 * Detect contradictory prescribe body fields before generation.
 * @param {object} body
 * @returns {{ contradictions: object[], warnings: string[] }}
 */
export function detectRequirementContradictions(body) {
  const contradictions = []
  const warnings = []

  const useIds = body?.equipmentUseIds ?? body?.equipment_use_ids ?? []
  const avoidIds = body?.equipmentAvoidIds ?? body?.equipment_avoid_ids ?? []
  const overlap = overlapNumericArrays(useIds, avoidIds)
  if (overlap.length > 0) {
    contradictions.push({
      type: 'equipment_use_avoid_overlap',
      field: 'equipmentUseIds',
      overlapping_ids: overlap,
      message: `equipmentUseIds and equipmentAvoidIds overlap: ${overlap.join(', ')}`,
    })
  }

  const plan = planRows(body)
  const planSum = plan.reduce((s, r) => s + Number(r.minutes ?? 0), 0)
  const duration = Number(body?.durationMinutes ?? 0)
  if (plan.length > 0 && duration > 0 && planSum !== duration) {
    contradictions.push({
      type: 'duration_phase_plan_mismatch',
      field: 'durationMinutes',
      plan_sum: planSum,
      duration_minutes: duration,
      message: `phasePlan minutes sum ${planSum} !== durationMinutes ${duration}`,
    })
  }

  return { contradictions, warnings }
}

/**
 * @param {object} body
 * @param {{ metricsCatalog?: object }} [context]
 */
export function compileRequirementsContract(body, context = {}) {
  reqCounter = 0
  const requirements = []
  const parse_errors = []
  const metricsCatalog = context.metricsCatalog ?? null

  if (!body || typeof body !== 'object') {
    return { requirements: [], parse_errors: ['body is not an object'], contradictions: [] }
  }

  const { contradictions } = detectRequirementContradictions(body)

  if (body.durationMinutes != null) {
    requirements.push(makeRequirement({
      source: 'user',
      field: 'durationMinutes',
      operator: '=',
      value: Number(body.durationMinutes),
      priority: 'P0',
      hard_gate: true,
      mapKey: 'durationMinutes',
      rawText: `durationMinutes=${body.durationMinutes}`,
      metricsCatalog,
    }))
  }

  const plan = planRows(body)
  if (plan.length > 0) {
    requirements.push(makeRequirement({
      source: 'user',
      field: 'phasePlan',
      operator: 'exists',
      value: plan.map((r) => r.phaseKey ?? r.phase_key),
      priority: 'P0',
      hard_gate: true,
      mapKey: 'phasePlan',
      evidence_paths: ['body.phasePlan', 'result.blocks'],
      metricsCatalog,
    }))

    requirements.push(makeRequirement({
      source: 'user',
      field: 'phasePlanOrder',
      operator: 'equals',
      value: plan.map((r) => r.phaseKey ?? r.phase_key),
      priority: 'P0',
      hard_gate: true,
      mapKey: 'phasePlan',
      evidence_paths: ['body.phasePlan', 'result.blocks'],
      metricsCatalog,
    }))

    requirements.push(makeRequirement({
      source: 'user',
      field: 'phasePlanMinutes',
      operator: 'sum_equals',
      value: plan.map((r) => ({ phaseKey: r.phaseKey ?? r.phase_key, minutes: r.minutes })),
      priority: 'P0',
      hard_gate: true,
      mapKey: 'durationMinutes',
      evidence_paths: ['body.phasePlan', 'result.blocks'],
      metricsCatalog,
    }))

    const pinnedPrepare = plan.find((r) => (r.phaseKey ?? r.phase_key) === 'prepare_and_access' && r.pinned)
    if (pinnedPrepare) {
      requirements.push(makeRequirement({
        source: 'user',
        field: 'pinnedPrepare',
        operator: 'exists',
        value: { minutes: pinnedPrepare.minutes, pinned: true },
        priority: 'P1',
        hard_gate: true,
        mapKey: 'pinnedPrepare',
        metricsCatalog,
      }))
    }

    const restore = plan.find((r) => (r.phaseKey ?? r.phase_key) === 'restore')
    if (restore) {
      requirements.push(makeRequirement({
        source: 'user',
        field: 'restore',
        operator: 'exists',
        value: { minutes: restore.minutes },
        priority: 'P0',
        hard_gate: true,
        mapKey: 'restore',
        metricsCatalog,
      }))
    }

    const focusPhases = plan.filter((r) => (r.focusTargets ?? r.focus_targets ?? []).length > 0)
    if (focusPhases.length > 0) {
      requirements.push(makeRequirement({
        source: 'user',
        field: 'focusTargets',
        operator: 'exists',
        value: focusPhases.map((r) => ({
          phaseKey: r.phaseKey ?? r.phase_key,
          targets: r.focusTargets ?? r.focus_targets,
        })),
        priority: 'P1',
        hard_gate: true,
        mapKey: 'focusTargets',
        metricsCatalog,
      }))
    }
  }

  if (body.workMode != null) {
    requirements.push(makeRequirement({
      source: 'user',
      field: 'workMode',
      operator: '=',
      value: body.workMode,
      priority: 'P0',
      hard_gate: true,
      mapKey: 'workMode',
      metricsCatalog,
    }))
  }

  if (body.sportId != null) {
    requirements.push(makeRequirement({
      source: 'user',
      field: 'sportId',
      operator: '=',
      value: Number(body.sportId),
      priority: 'P1',
      hard_gate: true,
      mapKey: 'sportId',
      metricsCatalog,
    }))
  }

  if (body.sessionObjective != null) {
    requirements.push(makeRequirement({
      source: 'user',
      field: 'sessionObjective',
      operator: '=',
      value: body.sessionObjective,
      priority: 'P1',
      hard_gate: true,
      mapKey: 'sessionObjective',
      metricsCatalog,
    }))
  }

  if (body.skillLevel != null) {
    requirements.push(makeRequirement({
      source: 'user',
      field: 'skillLevel',
      operator: '=',
      value: body.skillLevel,
      priority: 'P1',
      hard_gate: true,
      mapKey: 'skillLevel',
      metricsCatalog,
    }))
  }

  if (body.ageMin != null || body.ageMax != null) {
    requirements.push(makeRequirement({
      source: 'user',
      field: 'audience',
      operator: 'subset',
      value: { ageMin: body.ageMin, ageMax: body.ageMax },
      priority: 'P0',
      hard_gate: true,
      mapKey: 'audience',
      metricsCatalog,
    }))
  }

  const splits = bodySplits(body)
  if (splits.length > 0) {
    requirements.push(makeRequirement({
      source: 'user',
      field: 'audienceSplits',
      operator: 'exists',
      value: splits.map((s) => ({
        label: s.label,
        ageMin: s.ageMin ?? s.age_min,
        ageMax: s.ageMax ?? s.age_max,
        cap: s.difficultyOverride ?? s.difficulty_override ?? s.caps?.maxOverall,
      })),
      priority: 'P0',
      hard_gate: true,
      mapKey: 'audienceSplits',
      metricsCatalog,
    }))

    const hasCaps = splits.some((s) => s.difficultyOverride != null || s.difficulty_override != null || s.caps)
    if (hasCaps) {
      requirements.push(makeRequirement({
        source: 'user',
        field: 'splitDifficultyCaps',
        operator: 'exists',
        value: splits.map((s) => s.difficultyOverride ?? s.difficulty_override ?? s.caps?.maxOverall),
        priority: 'P0',
        hard_gate: true,
        mapKey: 'splitCaps',
        metricsCatalog,
      }))
    }
  }

  if (body.capsOverride != null) {
    requirements.push(makeRequirement({
      source: 'user',
      field: 'capsOverride',
      operator: '=',
      value: body.capsOverride,
      priority: 'P1',
      hard_gate: true,
      mapKey: 'capsOverride',
      metricsCatalog,
    }))
  }

  const useIds = body.equipmentUseIds ?? body.equipment_use_ids ?? []
  if (useIds.length > 0) {
    requirements.push(makeRequirement({
      source: 'user',
      field: 'equipmentUseIds',
      operator: 'includes',
      value: useIds,
      priority: 'P0',
      hard_gate: true,
      mapKey: 'equipmentUse',
      metricsCatalog,
    }))
  }

  const usePolicy = body.equipmentUsePolicy ?? body.equipment_use_policy
  if (usePolicy) {
    requirements.push(makeRequirement({
      source: 'user',
      field: 'equipmentUsePolicy',
      operator: '=',
      value: usePolicy,
      priority: 'P1',
      hard_gate: true,
      mapKey: 'equipmentUsePolicy',
      metricsCatalog,
    }))
  }

  const avoidIds = body.equipmentAvoidIds ?? body.equipment_avoid_ids ?? []
  if (avoidIds.length > 0) {
    requirements.push(makeRequirement({
      source: 'user',
      field: 'equipmentAvoidIds',
      operator: 'excludes',
      value: avoidIds,
      priority: 'P0',
      hard_gate: true,
      mapKey: 'equipmentAvoid',
      metricsCatalog,
    }))
  }

  const avoidExerciseIds = body.avoidExerciseIds ?? body.avoid_exercise_ids ?? []
  const avoidSlugs = body.avoidExerciseSlugs ?? body.avoid_exercise_slugs ?? []
  if (avoidExerciseIds.length > 0 || avoidSlugs.length > 0) {
    requirements.push(makeRequirement({
      source: 'user',
      field: 'exerciseAvoid',
      operator: 'excludes',
      value: { ids: avoidExerciseIds, slugs: avoidSlugs },
      priority: 'P0',
      hard_gate: true,
      mapKey: 'exerciseAvoid',
      metricsCatalog,
    }))
  }

  const excludeBody = body.excludeBodyRegionIds ?? body.exclude_body_region_ids ?? []
  if (excludeBody.length > 0) {
    requirements.push(makeRequirement({
      source: 'user',
      field: 'excludeBodyRegionIds',
      operator: 'excludes',
      value: excludeBody,
      priority: 'P0',
      hard_gate: true,
      mapKey: 'exerciseAvoid',
      metricsCatalog,
    }))
  }

  const avoidTokens = body.avoidTokens ?? body.avoid_tokens ?? []
  if (avoidTokens.length > 0) {
    requirements.push(makeRequirement({
      source: 'user',
      field: 'avoidTokens',
      operator: 'excludes',
      value: avoidTokens,
      priority: 'P1',
      hard_gate: true,
      mapKey: 'avoidTokens',
      metricsCatalog,
    }))
  }

  // Policy / safety requirements (always emitted for eval sessions)
  const policySpecs = [
    { field: 'youthSafety', mapKey: 'youthSafety', priority: 'P0' },
    { field: 'phaseRole', mapKey: 'phaseRole', priority: 'P0', value: SESSION_PHASE_ORDER },
    { field: 'phaseIntent', mapKey: 'phaseIntentPolicy', priority: 'P1' },
    { field: 'constraintReport', mapKey: 'constraintReport', priority: 'P0' },
    { field: 'feasibility', mapKey: 'feasibility', priority: 'P0' },
    { field: 'overCapExclusion', mapKey: 'overCapExclusion', priority: 'P0' },
    { field: 'stretchRestriction', mapKey: 'stretchRestriction', priority: 'P0' },
    { field: 'highArousalRestore', mapKey: 'highArousalRestore', priority: 'P0' },
    { field: 'emptyPhase', mapKey: 'emptyPhase', priority: 'P0' },
    { field: 'equipmentAvoidPolicy', mapKey: 'equipmentAvoid', priority: 'P0' },
    { field: 'exerciseAvoidPolicy', mapKey: 'exerciseAvoid', priority: 'P0' },
    { field: 'silentPartialFailure', mapKey: 'silentPartialFailure', priority: 'P1' },
  ]

  for (const spec of policySpecs) {
    requirements.push(makeRequirement({
      source: 'policy',
      field: spec.field,
      operator: 'exists',
      value: spec.value ?? true,
      priority: spec.priority,
      hard_gate: true,
      mapKey: spec.mapKey,
      evidence_paths: spec.field.includes('Report')
        ? ['result.constraint_report']
        : ['result.blocks', `policy.${spec.field}`],
      metricsCatalog,
    }))
  }

  return { requirements, parse_errors, contradictions }
}

/**
 * @param {object[]} requirements
 * @param {object[]} checks
 * @param {object} metricsCatalog
 */
export function updateRequirementStatuses(requirements, checks, metricsCatalog) {
  for (const req of requirements) {
    const verdict = canRequirementPass(req, checks, metricsCatalog)
    if (req.status === 'unsatisfied_mapping') continue
    if (verdict.reason === 'unsatisfied_mapping') {
      req.status = 'unsatisfied_mapping'
    } else if (verdict.ok) {
      req.status = 'pass'
    } else if (verdict.eligibleChecks.length === 0) {
      req.status = 'not_evaluable'
    } else {
      req.status = 'fail'
    }
    req.eligible_checks = verdict.eligibleChecks
    req.failed_checks = verdict.failedChecks
  }
  return requirements
}

export function buildRequirementTrace(requirements) {
  return requirements.map((r) => ({
    requirement_id: r.requirement_id,
    field: r.normalized_constraint.field,
    priority: r.priority,
    hard_gate: r.hard_gate,
    status: r.status,
    mapped_checks: r.mapped_checks,
    eligible_checks: r.eligible_checks ?? [],
    failed_checks: r.failed_checks ?? [],
    evidence_paths: r.evidence_paths,
    source: r.source,
  }))
}

/**
 * @param {object[]} requirements
 */
export function summarizeRequirements(requirements) {
  const hard = requirements.filter((r) => r.hard_gate && (r.priority === 'P0' || r.priority === 'P1'))
  return {
    total: requirements.length,
    hard_p01: hard.length,
    unsatisfied_mapping: hard.filter((r) => r.status === 'unsatisfied_mapping').length,
    passed: requirements.filter((r) => r.status === 'pass').length,
    failed: requirements.filter((r) => r.status === 'fail').length,
  }
}
