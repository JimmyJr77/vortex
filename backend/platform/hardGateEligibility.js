/**
 * Hard-gate eligibility for requirement → check mapping.
 */

import {
  isHardGateEligibleMetric,
  isHardGateEligibleByCheckId,
} from './categoryMetricsSchema.js'

export { isHardGateEligibleMetric, isHardGateEligibleByCheckId }

/**
 * @param {object} requirement
 * @param {object} metricsCatalog
 * @returns {string[]}
 */
export function filterHardGateChecks(requirement, metricsCatalog) {
  const mapped = requirement.mapped_checks ?? []
  return mapped.filter((checkId) => isHardGateEligibleByCheckId(checkId, metricsCatalog))
}

/**
 * @param {object} requirement
 * @param {Map<string, {ok: boolean}>|Array<{id: string, ok: boolean}>} checkResults
 * @param {object} metricsCatalog
 */
export function canRequirementPass(requirement, checkResults, metricsCatalog) {
  const resultMap = checkResults instanceof Map
    ? checkResults
    : new Map((checkResults ?? []).map((c) => [c.id, c]))

  const eligible = filterHardGateChecks(requirement, metricsCatalog)
  if (requirement.hard_gate && eligible.length === 0) {
    return { ok: false, reason: 'unsatisfied_mapping', eligibleChecks: [], failedChecks: [] }
  }

  const failedChecks = eligible.filter((id) => !resultMap.get(id)?.ok)
  const ok = eligible.length > 0 && failedChecks.length === 0
  return {
    ok,
    reason: ok ? 'pass' : (eligible.length === 0 ? 'not_evaluable' : 'fail'),
    eligibleChecks: eligible,
    failedChecks,
  }
}
