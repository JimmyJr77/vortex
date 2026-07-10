/**
 * Schema validation for NEEDS_ENGINE_CATEGORY_METRICS.json
 * and hard-gate eligibility rules for prescription eval.
 */

export const TYPE_TOKENS = new Set(['MOP', 'MOS', 'MOE', 'MOR', 'KPI'])

/** Allowed Evaluable? values (exact or normalized variants). */
export const EVALUABLE_ALLOWED = new Set([
  'yes',
  'yes (info)',
  'yes (P0)',
  'yes (TBD stub)',
  'partial',
  'partial (manual)',
  'partial (TBD)',
  'no',
  'yes (lagging)',
])

const IN_APP_ALLOWED = new Set(['yes', 'no', 'partial'])

const KPI_ONLY_IDS = new Set([
  'category1_kpi', 'category2_kpi', 'category3_kpi', 'category4_kpi', 'category5_kpi',
  'category6_kpi', 'category7_kpi', 'category8_kpi', 'category9_kpi', 'category10_kpi',
  'category11_kpi', 'category12_kpi', 'category13_kpi', 'category14_kpi', 'category15_kpi',
  'category16_kpi', 'category17_kpi', 'category18_kpi', 'category19_kpi', 'category20_kpi',
  'category21_kpi', 'category22_kpi', 'category23_kpi', 'category24_kpi', 'category25_kpi',
])

function looksLikePrerequisite(value) {
  if (!value || typeof value !== 'string') return true
  const v = value.trim()
  if (v === 'yes' || v === 'no' || v === '') return true
  if (v.startsWith('`')) return true
  if (TYPE_TOKENS.has(v)) return true
  return false
}

function evaluableHasBacktickedCheckId(value) {
  if (!value || typeof value !== 'string') return false
  const v = value.trim()
  if (!v.startsWith('`')) return false
  return /^`(constraint_|no_|category20_)/.test(v)
}

export function isEvaluableAllowed(value) {
  if (value == null || value === '') return false
  const raw = String(value).trim()
  const lower = raw.toLowerCase()
  if (EVALUABLE_ALLOWED.has(raw)) return true
  if (lower === 'yes' || lower.startsWith('yes (')) return true
  if (lower.startsWith('partial')) return true
  if (lower === 'no') return true
  if (lower.includes('lagging')) return true
  return false
}

/**
 * @param {Record<string, unknown>} metric
 * @returns {string[]}
 */
export function validateMetricRow(metric) {
  const violations = []
  const id = String(metric.ID ?? '')
  const m = String(metric.Metric ?? '').trim()
  const inApp = String(metric['In app?'] ?? '').trim().toLowerCase()
  const checkId = String(metric.check_id ?? '').trim()
  const evaluable = String(metric['Evaluable?'] ?? '').trim()

  if (TYPE_TOKENS.has(m)) {
    violations.push(`${id}: Metric must not be type token "${m}"`)
  }
  if (checkId === 'yes' || checkId === 'no' || checkId === '') {
    violations.push(`${id}: check_id must not be "${checkId || '(empty)'}"`)
  }
  if (looksLikePrerequisite(checkId)) {
    violations.push(`${id}: check_id looks like prerequisite not check id: "${checkId}"`)
  }
  if (evaluableHasBacktickedCheckId(evaluable)) {
    violations.push(`${id}: Evaluable? contains backticked check id: "${evaluable}"`)
  }
  if (evaluable && !isEvaluableAllowed(evaluable)) {
    violations.push(`${id}: Evaluable? not in allowed set: "${evaluable}"`)
  }
  if (inApp && !IN_APP_ALLOWED.has(inApp)) {
    violations.push(`${id}: In app? must be yes/no/partial, got "${metric['In app?']}"`)
  }
  if (id.startsWith('C20-') && checkId === 'yes') {
    violations.push(`${id}: Category 20 shift artifact check_id=yes`)
  }
  if (id.startsWith('C20-') && m === 'MOP') {
    violations.push(`${id}: Category 20 shift artifact Metric=MOP`)
  }
  return violations
}

/**
 * @param {import('fs').PathOrFileDescriptor | object} jsonOrData
 * @returns {{ ok: boolean, violations: string[], total: number }}
 */
export function validateCategoryMetrics(jsonOrData) {
  const data = typeof jsonOrData === 'object' && jsonOrData !== null && !Array.isArray(jsonOrData)
    ? jsonOrData
    : null
  if (!data) {
    return { ok: false, violations: ['Invalid metrics JSON'], total: 0 }
  }
  const rows = data.all_metrics ?? []
  const violations = []
  for (const row of rows) {
    violations.push(...validateMetricRow(row))
  }
  return { ok: violations.length === 0, violations, total: rows.length }
}

/**
 * Hard-gate eligible: only strict "yes" evaluable, in-app yes, real check_id.
 * @param {Record<string, unknown>} metric
 * @param {{ allowKpi?: boolean }} [opts]
 */
export function isHardGateEligibleMetric(metric, opts = {}) {
  if (!metric) return false
  const inApp = String(metric['In app?'] ?? '').trim().toLowerCase()
  const evaluable = String(metric['Evaluable?'] ?? '').trim().toLowerCase()
  const checkId = String(metric.check_id ?? '').trim()

  if (inApp !== 'yes') return false
  if (evaluable !== 'yes') return false
  if (!checkId || checkId === 'yes' || checkId === 'no') return false
  if (looksLikePrerequisite(checkId)) return false

  const gateBlob = `${inApp} ${evaluable} ${checkId} ${metric.Metric ?? ''}`.toLowerCase()
  if (/partial|manual|tbd|stub|\(info\)/.test(gateBlob)) return false

  if (!opts.allowKpi && KPI_ONLY_IDS.has(checkId)) return false
  if (TYPE_TOKENS.has(String(metric.Metric ?? '').trim())) return false

  return true
}

/**
 * @param {string} checkId
 * @param {object} metricsCatalog
 * @returns {boolean}
 */
export function isHardGateEligibleByCheckId(checkId, metricsCatalog) {
  const rows = metricsCatalog?.all_metrics ?? metricsCatalog?.metrics ?? []
  const matches = rows.filter((m) => {
    const cid = String(m.check_id ?? '').trim()
    if (cid === checkId) return true
    if (Array.isArray(m.check_ids) && m.check_ids.includes(checkId)) return true
    return cid.includes(',') && cid.split(',').map((s) => s.trim()).includes(checkId)
  })
  if (matches.length === 0) {
    return !KPI_ONLY_IDS.has(checkId)
  }
  return matches.some((m) => isHardGateEligibleMetric(m))
}
