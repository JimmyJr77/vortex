/**
 * Bounded generate → evaluate → repair loop for prescriptions.
 */

import { evaluatePrescriptionQuality, validatePrescribeBodyMOS } from './prescriptionQualityChecks.js'
import { compileRequirementsContract, updateRequirementStatuses } from './requirementsContract.js'
import { runPreflight } from './preflightSatisfiability.js'
import { buildEvaluatorVerdict, stableHash } from './evaluatorVerdict.js'
import { auditPrescriptionEquipmentAvoid } from './equipmentAvoidPolicy.js'

function requirementAppliesToPhase(req, phaseKey) {
  if (req.mapKey === 'restore' && phaseKey === 'restore') return true
  if (req.mapKey === 'pinnedPrepare' && phaseKey === 'prepare_and_access') return true
  if (req.mapKey === 'focusTargets') {
    const phases = req.normalized_constraint?.value ?? []
    return phases.some((p) => (p.phaseKey ?? p.phase_key) === phaseKey)
  }
  for (const checkId of req.mapped_checks ?? []) {
    if (checkId.includes(phaseKey) || checkId === `phase_fill_${phaseKey}`) return true
  }
  return false
}

function checksForPhase(checks, phaseKey) {
  return (checks ?? []).filter((c) => {
    if (c.severity !== 'P0' && c.severity !== 'P1') return false
    if (c.detail?.phase_key === phaseKey) return true
    const id = String(c.id)
    return id.includes(`_${phaseKey}`) || id.includes(`${phaseKey}_`) || id.startsWith(`${phaseKey}_`)
  })
}

function inferPhaseKeyFromCheck(checkId, result) {
  if (!checkId) return null
  if (checkId.includes('restore')) return 'restore'
  const phaseFill = /^phase_fill_(.+)$/.exec(checkId)
  if (phaseFill) return phaseFill[1]
  const libraryFloor = /^library_pool_floor_(.+)$/.exec(checkId)
  if (libraryFloor) {
    const key = libraryFloor[1]
    if (key === 'prepare') return 'prepare_and_access'
    if (key === 'mi') return 'movement_intelligence'
    return key
  }
  if (checkId === 'all_blocks_nonempty') {
    const empty = result?.blocks?.find((b) => !b.items?.length)
    return empty?.phase_key ?? null
  }
  return null
}

function enrichRepairAction(action, failure, result, body) {
  const enriched = { ...action, constraints: { ...(action.constraints ?? {}) } }
  const checkId = failure.check_id ?? enriched.constraints.check_id ?? ''
  const phaseKey = enriched.phase_key
    ?? failure.repair_action?.phase_key
    ?? failure.current_value?.phase_key
    ?? inferPhaseKeyFromCheck(checkId, result)

  if (!enriched.phase_key && phaseKey) enriched.phase_key = phaseKey

  if (enriched.type === 'remove_forbidden_item' || enriched.type === 'replace_exercise') {
    if (/barbell|bar/.test(checkId)) {
      enriched.constraints.forbidden_pattern = /\bbarbell\b/i
    }
    const avoidSlugs = body?.avoidExerciseSlugs ?? body?.avoid_exercise_slugs ?? []
    if (avoidSlugs.length > 0) {
      enriched.constraints.forbidden_slugs = avoidSlugs.map(String)
    }
    if (failure.current_value?.exercise_name) {
      enriched.constraints.forbidden_pattern = new RegExp(failure.current_value.exercise_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    }
    if (failure.evidence_path && !enriched.item_path) {
      enriched.item_path = failure.evidence_path
    }
  }

  if (enriched.type === 'adjust_dose') {
    const block = phaseKey ? result?.blocks?.find((b) => b.phase_key === phaseKey) : null
    if (block?.target_minutes != null) {
      enriched.constraints.target_minutes = block.target_minutes
      enriched.constraints.estimated_minutes = block.target_minutes
    }
    if (failure.expected?.minutes != null) {
      enriched.constraints.target_minutes = failure.expected.minutes
      enriched.constraints.estimated_minutes = failure.expected.minutes
    }
    if (failure.current_value?.phase_key && failure.expected != null) {
      enriched.constraints.target_minutes = Number(failure.expected)
      enriched.constraints.estimated_minutes = Number(failure.expected)
    }
  }

  if (enriched.type === 'fill_phase') {
    enriched.constraints.exercise_name = enriched.constraints.exercise_name ?? 'Repair placeholder'
    enriched.constraints.exercise_id = enriched.constraints.exercise_id ?? 1
  }

  if (enriched.type === 'change_variant') {
    enriched.constraints.drop_progression = true
  }

  if (enriched.type === 'regenerate_phase' && phaseKey) {
    enriched.type = 'fill_phase'
  }

  if (enriched.type === 'regenerate_phase' && !phaseKey) {
    return null
  }

  return enriched
}

const V1_ACTION_TYPES = new Set([
  'replace_exercise',
  'remove_forbidden_item',
  'fill_phase',
  'adjust_dose',
  'change_variant',
])

function dedupeActions(actions) {
  const seen = new Set()
  return actions.filter((a) => {
    const key = `${a.type}|${a.phase_key}|${a.item_path}|${a.constraints?.check_id ?? ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * @param {object[]} blocking_failures
 * @param {object} result
 * @param {object} body
 * @param {string[]} locked_paths
 */
export function buildRepairPlan(blocking_failures, result, body, locked_paths = []) {
  const lockedPhases = new Set()
  for (const path of locked_paths) {
    const m = /blocks\[(\d+)\]/.exec(path)
    if (m) {
      const idx = Number(m[1])
      const block = result?.blocks?.[idx]
      if (block?.phase_key) lockedPhases.add(block.phase_key)
    }
  }

  const actions = []
  for (const failure of blocking_failures ?? []) {
    const base = failure.repair_action
    if (!base || base.type === 'return_unsatisfiable' || base.type === 'regenerate_session') continue
    if (base.phase_key && lockedPhases.has(base.phase_key)) continue
    const enriched = enrichRepairAction(base, failure, result, body)
    if (!enriched || !V1_ACTION_TYPES.has(enriched.type)) continue
    if (enriched.phase_key && lockedPhases.has(enriched.phase_key)) continue
    actions.push(enriched)
  }
  return dedupeActions(actions)
}

function itemMatchesForbidden(item, action, context) {
  const name = String(item.exercise_name ?? '').toLowerCase()
  const slug = String(item.exercise_slug ?? item.slug ?? '').toLowerCase()
  if (action.constraints?.forbidden_pattern?.test(name)) return true
  if (action.constraints?.forbidden_slugs?.includes(slug)) return true
  const exercise = context.exerciseById?.get(Number(item.exercise_id))
  if (exercise && action.constraints?.forbidden_slugs?.includes(String(exercise.slug ?? '').toLowerCase())) return true
  return false
}

function findReplacementCandidate(action, context, body) {
  if (action.constraints?.replacement) return action.constraints.replacement
  for (const [, ex] of context.exerciseById ?? []) {
    const tags = context.tagMap?.get(String(ex.id)) ?? []
    const avoidIds = context.expandedAvoidEquipIds ?? new Set()
    const avoidKeys = context.equipmentAvoidKeys ?? []
    const equipTags = tags.filter((t) => t.facetType === 'equipment')
    const violates = auditPrescriptionEquipmentAvoid(
      [{ phase_key: action.phase_key, items: [{ exercise_id: ex.id, exercise_name: ex.name }] }],
      context.tagMap ?? new Map(),
      avoidIds,
      avoidKeys,
      context.exerciseById ?? new Map(),
    )
    if (violates.length === 0) {
      return { exercise_id: ex.id, exercise_name: ex.name, exercise_slug: ex.slug }
    }
  }
  return { exercise_name: 'Safe alternative', exercise_id: action.constraints?.exercise_id ?? 999 }
}

function patchItemDose(item, targetMinutes, block) {
  if (!item || targetMinutes == null) return
  const currentEst = Number(block.estimated_minutes ?? block.target_minutes ?? targetMinutes)
  if (currentEst <= 0) return
  const ratio = targetMinutes / currentEst
  if (item.sets != null) item.sets = Math.max(1, Math.round(Number(item.sets) * ratio))
  if (item.work_seconds != null) item.work_seconds = Math.max(10, Math.round(Number(item.work_seconds) * ratio))
}

/**
 * @param {object} result
 * @param {object[]} actions
 * @param {object} body
 * @param {object} context
 */
export function applyRepairActions(result, actions, body, context = {}) {
  const patched = JSON.parse(JSON.stringify(result))
  for (const action of actions ?? []) {
    if (!action) continue
    const phaseKey = action.phase_key
    const block = phaseKey
      ? patched.blocks?.find((b) => b.phase_key === phaseKey)
      : null
    if (!block && phaseKey) continue

    if (action.type === 'remove_forbidden_item' && block) {
      block.items = (block.items ?? []).filter((it) => !itemMatchesForbidden(it, action, context))
      for (const item of block.items ?? []) {
        if (Array.isArray(item.per_split)) {
          item.per_split = item.per_split.filter((v) => {
            const fake = { exercise_name: v.exercise_name, exercise_id: v.exercise_id }
            return !itemMatchesForbidden(fake, action, context)
          })
        }
      }
    }

    if (action.type === 'replace_exercise' && block) {
      const items = block.items ?? []
      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx]
        if (itemMatchesForbidden(item, action, context) || idx === 0) {
          const replacement = findReplacementCandidate(action, context, body)
          Object.assign(item, replacement)
          if (action.item_path?.includes('per_split')) {
            for (const v of item.per_split ?? []) {
              if (itemMatchesForbidden(v, action, context)) {
                Object.assign(v, replacement)
              }
            }
          }
          break
        }
      }
    }

    if (action.type === 'adjust_dose' && block) {
      const target = action.constraints?.target_minutes ?? action.constraints?.estimated_minutes
      if (target != null) {
        block.target_minutes = target
        block.estimated_minutes = action.constraints?.estimated_minutes ?? target
        block.fill_pct = block.target_minutes > 0
          ? Math.min(100, Math.round((block.estimated_minutes / block.target_minutes) * 100))
          : block.fill_pct
      }
      for (const item of block.items ?? []) {
        patchItemDose(item, block.estimated_minutes, block)
      }
    }

    if (action.type === 'fill_phase' && block) {
      if (!block.items?.length) {
        block.items = [{
          exercise_id: action.constraints?.exercise_id ?? 1,
          exercise_name: action.constraints?.exercise_name ?? 'Repair placeholder',
          sets: 2,
          work_seconds: 30,
        }]
      }
      block.estimated_minutes = block.target_minutes ?? block.estimated_minutes ?? 1
      block.fill_pct = block.target_minutes > 0
        ? Math.min(100, Math.round((block.estimated_minutes / block.target_minutes) * 100))
        : 100
    }

    if (action.type === 'change_variant' && block) {
      for (const item of block.items ?? []) {
        for (const v of item.per_split ?? []) {
          if (v.variant_type === 'progression' && action.constraints?.drop_progression) {
            v.variant_type = 'same'
            v.exercise_id = item.exercise_id
            v.exercise_name = item.exercise_name
          }
          if (action.constraints?.forbidden_slugs?.includes(String(v.exercise_slug ?? '').toLowerCase())) {
            v.variant_type = 'same'
            v.exercise_id = item.exercise_id
            v.exercise_name = item.exercise_name
          }
        }
      }
    }
  }
  return patched
}

/**
 * @param {object[]} requirements
 * @param {object[]} checks
 * @param {object} result
 */
export function computeLockedPaths(requirements, checks, result) {
  updateRequirementStatuses(requirements, checks, null)
  const locked = []
  for (let i = 0; i < (result?.blocks ?? []).length; i++) {
    const block = result.blocks[i]
    const phaseKey = block.phase_key
    const phaseReqs = requirements.filter(
      (r) => r.hard_gate && (r.priority === 'P0' || r.priority === 'P1') && requirementAppliesToPhase(r, phaseKey),
    )
    const phaseChecks = checksForPhase(checks, phaseKey)
    const reqsPass = phaseReqs.length === 0 || phaseReqs.every((r) => r.status === 'pass')
    const checksPass = phaseChecks.length === 0 || phaseChecks.every((c) => c.ok)
    if ((phaseReqs.length > 0 || phaseChecks.length > 0) && reqsPass && checksPass) {
      locked.push(`blocks[${i}]`)
    }
  }
  return locked
}

async function evaluateOnce(pool, body, result, thresholds, metricsCatalog, loadContext, evaluate, attempt, inputHash, evaluatedAfterLastRepair) {
  const context = loadContext
    ? await loadContext(pool, result, body)
    : { expectedBody: body, thresholds }
  context.expectedBody = body
  context.thresholds = thresholds

  let evaluation = evaluate(result, thresholds, context)
  const mos = validatePrescribeBodyMOS(body)
  const allChecks = [...mos.checks, ...evaluation.checks]
  evaluation = { ...evaluation, checks: allChecks, ok: allChecks.every((c) => c.ok) }

  const outputHash = stableHash({ blocks: result?.blocks })
  const verdict = buildEvaluatorVerdict({
    body,
    result,
    checks: evaluation.checks,
    metricsCatalog,
    context,
    attempt,
    inputHash,
    outputHash,
    evaluatedAfterLastRepair,
  })
  return { verdict, evaluation, context, outputHash }
}

/**
 * @param {import('pg').Pool} pool
 * @param {number} facilityId
 * @param {object} body
 * @param {object} options
 */
export async function runPrescriptionEvalLoop(pool, facilityId, body, options = {}) {
  const {
    maxAttempts = 3,
    thresholds = {},
    enablePreflight = true,
    metricsCatalog = null,
    loadContext = null,
    prescribe = null,
    evaluate = evaluatePrescriptionQuality,
  } = options

  const inputHash = stableHash(body)
  const repair_history = []
  let attempt = 0
  let result = null
  let repairedAwaitingEval = false

  if (enablePreflight) {
    const preflight = await runPreflight(body, pool, { metricsCatalog })
    if (!preflight.ok && preflight.status === 'UNSATISFIABLE') {
      const verdict = buildEvaluatorVerdict({
        body,
        result: null,
        checks: preflight.checks,
        metricsCatalog,
        attempt: 0,
        inputHash,
        evaluatedAfterLastRepair: true,
        preflight,
      })
      return { verdict, result: null, attempts: 0, repair_history }
    }
  }

  const runPrescribe = prescribe ?? (async () => {
    const { runPhaseAwarePrescription } = await import('./phaseAwarePrescription.js')
    return runPhaseAwarePrescription(pool, facilityId, body)
  })

  while (attempt < maxAttempts) {
    attempt += 1
    result = await runPrescribe()
    repairedAwaitingEval = false
    let justRepaired = false
    let repairDoneThisAttempt = false

    while (true) {
      const evaluatedAfterLastRepair = justRepaired || !repairedAwaitingEval
      const { verdict, evaluation, context } = await evaluateOnce(
        pool, body, result, thresholds, metricsCatalog, loadContext, evaluate, attempt, inputHash, evaluatedAfterLastRepair,
      )
      justRepaired = false
      repairedAwaitingEval = false

      if (verdict.status === 'PASS') {
        if (repair_history.length > 0 && !verdict.evaluated_after_last_repair) {
          return {
            verdict: buildEvaluatorVerdict({
              body,
              result,
              checks: evaluation.checks,
              metricsCatalog,
              attempt,
              inputHash,
              outputHash: stableHash({ blocks: result?.blocks }),
              evaluatedAfterLastRepair: false,
            }),
            result,
            attempts: attempt,
            repair_history,
          }
        }
        return { verdict, result, attempts: attempt, repair_history }
      }

      if (verdict.status === 'SYSTEM_FAIL' || verdict.status === 'UNSATISFIABLE') {
        return { verdict, result, attempts: attempt, repair_history }
      }

      if (verdict.status !== 'REPAIRABLE_FAIL') {
        return { verdict, result, attempts: attempt, repair_history }
      }

      if (attempt >= maxAttempts) {
        return { verdict, result, attempts: attempt, repair_history }
      }

      if (repairDoneThisAttempt) {
        break
      }

      const { requirements } = compileRequirementsContract(body, { metricsCatalog })
      const locked_paths = computeLockedPaths(requirements, evaluation.checks, result)
      const repairPlan = buildRepairPlan(verdict.blocking_failures, result, body, locked_paths)

      if (repairPlan.length === 0) {
        return { verdict, result, attempts: attempt, repair_history }
      }

      result = applyRepairActions(result, repairPlan, body, context)
      repair_history.push({ attempt, actions: repairPlan, locked_paths })
      repairedAwaitingEval = true
      justRepaired = true
      repairDoneThisAttempt = true
    }
  }

  const finalEval = await evaluateOnce(
    pool, body, result, thresholds, metricsCatalog, loadContext, evaluate, attempt, inputHash, false,
  )
  return { verdict: finalEval.verdict, result, attempts: attempt, repair_history }
}
