import { CANONICAL_PHASE_ORDER, normalizePhaseKey } from './sessionPhaseKeys.js'

const HARD_CONDITIONING_TYPES = new Set([
  'hiit', 'amrap', 'tabata', 'interval', 'repeat_sprint', 'repeat_shuttle', 'hiit_interval',
])

const HIGH_RISK_EXERCISE_TYPES = new Set(['tumbling', 'advanced_skill', 'high_impact_plyometrics'])

function phaseIndex(key) {
  const normalized = normalizePhaseKey(key)
  if (!normalized) return -1
  return CANONICAL_PHASE_ORDER.indexOf(normalized)
}

/**
 * @param {import('pg').Pool} pool
 * @param {{ blocks?: unknown[], programmingMethodId?: number, phaseKey?: string, exercises?: unknown[] }} draft
 */
export async function validateProgrammingBlock(pool, draft) {
  const issues = []
  const block = draft?.block ?? draft
  const methodId = num(block?.programming_method_id ?? block?.programmingMethodId ?? draft?.programmingMethodId)
  if (!methodId) return { issues, method: null }

  const methodRow = await pool.query(
    `SELECT pm.* FROM coaching.programming_method pm WHERE pm.id = $1 AND pm.archived = FALSE`,
    [methodId],
  )
  if (methodRow.rows.length === 0) {
    issues.push({ severity: 'error', ruleKey: 'programming_method_missing', message: 'Programming method not found.' })
    return { issues, method: null }
  }
  const method = methodRow.rows[0]
  const fp = parseJson(method.fatigue_profile)
  const wbr = parseJson(method.workout_builder_rules)
  const phaseKey = normalizePhaseKey(block?.phase_key ?? block?.phaseKey ?? draft?.phaseKey)

  if (phaseKey && method.incompatible_phases?.includes?.(phaseKey)) {
    issues.push({
      severity: 'strong_warning',
      ruleKey: 'incompatible_phase',
      message: `${method.name} is high-risk or misplaced in ${phaseKey.replace(/_/g, ' ')}.`,
    })
  }

  const workSeconds = num(block?.work_seconds ?? block?.workSeconds)
  const restSeconds = num(block?.rest_seconds ?? block?.restSeconds)
  if (method.programming_type === 'emom' && workSeconds != null && workSeconds > 45) {
    issues.push({
      severity: 'warning',
      ruleKey: 'emom_no_rest_remaining',
      message: 'This EMOM may leave too little rest. Reduce reps, load, or complexity.',
    })
  }

  if (wbr.requires_lanes && !draft?.hasLanes && !draft?.hasClearRunout) {
    issues.push({
      severity: 'error',
      ruleKey: 'missing_runout_space',
      message: 'Sprint/shuttle formats require clear lanes and safe deceleration space.',
    })
  }

  const exercises = draft?.exercises ?? block?.items ?? []
  for (const ex of exercises) {
    const types = ex.exercise_types ?? ex.exerciseTypes ?? []
    for (const t of types) {
      if (HIGH_RISK_EXERCISE_TYPES.has(t) && ['amrap', 'hiit', 'circuit', 'tabata'].includes(method.programming_type)) {
        issues.push({
          severity: 'strong_warning',
          ruleKey: 'advanced_skill_in_fatigue_format',
          message: `Advanced or high-risk exercise types should not appear in ${method.name} under fatigue.`,
        })
      }
    }
  }

  if (fp.fatigue_level === 'high' && fp.technical_risk_under_fatigue === 'high') {
    issues.push({
      severity: 'strong_warning',
      ruleKey: 'high_fatigue_high_technical',
      message: 'High fatigue + high technical complexity is unsafe for most groups.',
    })
  }

  const validatorRows = await pool.query(
    `SELECT * FROM coaching.programming_method_validator_rule WHERE programming_method_id = $1`,
    [methodId],
  )
  for (const rule of validatorRows.rows) {
    issues.push({
      severity: rule.severity,
      ruleKey: rule.rule_key,
      message: rule.message,
      recommendedAction: rule.recommended_action,
    })
  }

  return { issues, method: attachSummary(method) }
}

/**
 * Global programming-aware checks for full workout drafts.
 * @param {{ blocks: Array<{ phase_key?: string, programming_method_id?: number, programming_type?: string, items?: unknown[] }> }} draft
 * @param {Map<string, object>} methodById
 */
export function analyzeProgrammingPlacement(draft, methodById = new Map()) {
  const issues = []
  const blocks = draft?.blocks ?? []

  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i]
    const phaseKey = normalizePhaseKey(block.phase_key ?? block.phaseKey)
    const methodId = String(block.programming_method_id ?? block.programmingMethodId ?? '')
    const method = methodById.get(methodId)
    const programmingType = method?.programming_type ?? block.block_format

    if (!phaseKey || (!HARD_CONDITIONING_TYPES.has(programmingType) && !HARD_CONDITIONING_TYPES.has(method?.programming_type))) continue

    for (let k = i + 1; k < blocks.length; k += 1) {
      const later = normalizePhaseKey(blocks[k].phase_key ?? blocks[k].phaseKey)
      if (later === 'output') {
        issues.push({
          severity: 'strong_warning',
          ruleKey: 'conditioning_before_output',
          message: 'Conditioning before Output may reduce sprint, jump, tumbling, and reactive quality.',
          blockIndex: i,
        })
        break
      }
    }

    for (let j = 0; j < i; j += 1) {
      const earlier = normalizePhaseKey(blocks[j].phase_key ?? blocks[j].phaseKey)
      if (!earlier) continue
      if (earlier === 'movement_intelligence' && HARD_CONDITIONING_TYPES.has(programmingType)) {
        issues.push({
          severity: 'warning',
          ruleKey: 'conditioning_before_movement_intelligence',
          message: 'Fatigue can interfere with motor learning and coordination.',
          blockIndex: i,
        })
      }
    }

    if (['amrap', 'hiit'].includes(programmingType) && !(block.quality_standard ?? block.qualityStandard)) {
      issues.push({
        severity: 'warning',
        ruleKey: 'missing_quality_standards',
        message: 'Sustained Capacity blocks require quality standards and stop rules.',
        blockIndex: i,
      })
    }
  }

  return issues
}

/**
 * Score programming methods for Needs Engine block prescription.
 */
export function scoreProgrammingMethodForBlock(method, ctx) {
  let score = 0
  const phaseKey = normalizePhaseKey(ctx.phaseKey)
  const profiles = method.phase_profiles ?? []
  const profile = profiles.find((p) => normalizePhaseKey(p.phaseKey ?? p.phase_key) === phaseKey)
  if (profile?.role === 'primary') score += 20
  else if (profile?.role === 'secondary') score += 12
  else if (profile?.role === 'conditional') score += 6
  else if (profile?.role === 'avoid') score -= 30

  const fp = method.fatigue_profile ?? {}
  if (ctx.youth && fp.fatigue_level === 'high') score -= 15
  if (ctx.lowImpact && fp.impact_risk_under_fatigue === 'high') score -= 20
  if (ctx.groupSize > 8 && method.workout_builder_rules?.group_friendly) score += 8
  if (ctx.desiredAdaptation && method.primary_development_goal?.toLowerCase().includes(ctx.desiredAdaptation.toLowerCase())) score += 10
  return score
}

function num(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function parseJson(val) {
  if (val == null) return {}
  if (typeof val === 'object') return val
  try {
    return JSON.parse(val)
  } catch {
    return {}
  }
}

function attachSummary(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    programming_type: row.programming_type,
    workout_builder_rules: parseJson(row.workout_builder_rules),
  }
}
