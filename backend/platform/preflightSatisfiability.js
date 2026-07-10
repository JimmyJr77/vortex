/**
 * Preflight satisfiability checks before prescription generation.
 */

import { validatePrescribeBodyMOS } from './prescriptionQualityChecks.js'
import { compileRequirementsContract } from './requirementsContract.js'
import { SESSION_PHASE_ORDER } from './phaseArchitect.js'
import { skillLevelRank } from './skillLevelPolicy.js'

const VALID_WORK_MODES = new Set(['exercise', 'skill', 'hybrid'])
const VALID_FOCUS_FACET_TYPES = new Set(['tenet', 'methodology', 'physiology', 'order_slot', 'pattern'])

function planRows(body) {
  return body?.phasePlan ?? body?.phase_plan ?? []
}

function findRequirementId(requirements, field) {
  return requirements.find((r) => r.normalized_constraint.field === field)?.requirement_id ?? null
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

function mapContradictionToBlocking(contradiction, requirements) {
  return {
    requirement_id: findRequirementId(requirements, contradiction.field),
    check_id: contradiction.type,
    message: contradiction.message,
    evidence_path: contradiction.field ? `body.${contradiction.field}` : 'body',
    current_value: contradiction.overlapping_ids ?? contradiction.plan_sum ?? null,
    expected: contradiction.duration_minutes ?? (contradiction.overlapping_ids ? [] : null),
  }
}

function validateFocusTargetsResolvable(body, requirements, blocking_requirements) {
  for (const row of planRows(body)) {
    const phaseKey = row.phaseKey ?? row.phase_key
    const targets = row.focusTargets ?? row.focus_targets ?? []
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i]
      const facetType = t?.facetType ?? t?.facet_type
      if (!facetType || !VALID_FOCUS_FACET_TYPES.has(String(facetType))) {
        blocking_requirements.push({
          requirement_id: findRequirementId(requirements, 'focusTargets'),
          check_id: 'focus_targets_resolvable',
          message: `Invalid focus target facetType at ${phaseKey}[${i}]: ${facetType ?? '(missing)'}`,
          evidence_path: 'body.phasePlan',
        })
        continue
      }
      const facetId = t.facetId ?? t.facet_id
      const facetKey = t.facetKey ?? t.facet_key
      if (facetId == null && !facetKey) {
        blocking_requirements.push({
          requirement_id: findRequirementId(requirements, 'focusTargets'),
          check_id: 'focus_targets_resolvable',
          message: `Focus target at ${phaseKey}[${i}] missing facetId/facetKey`,
          evidence_path: 'body.phasePlan',
        })
      }
    }
  }
}

/**
 * @param {object} body
 * @param {import('pg').Pool|null} pool
 * @param {object} [context]
 */
export async function runPreflight(body, pool = null, context = {}) {
  const blocking_requirements = []
  let suggested_relaxations = []
  const checks = []

  const { requirements, parse_errors, contradictions } = compileRequirementsContract(body, {
    metricsCatalog: context.metricsCatalog,
  })

  if (parse_errors.length > 0) {
    return {
      ok: false,
      status: 'SYSTEM_FAIL',
      blocking_requirements: parse_errors.map((msg) => ({
        requirement_id: null,
        check_id: 'feasibility_requirements_parseable',
        message: msg,
        evidence_path: 'body',
      })),
      suggested_relaxations: [],
      checks,
    }
  }

  for (const c of contradictions) {
    blocking_requirements.push(mapContradictionToBlocking(c, requirements))
  }
  suggested_relaxations = suggestedRelaxationsFromContradictions(contradictions)
  if (contradictions.some((c) => c.type === 'equipment_use_avoid_overlap')) {
    return {
      ok: false,
      status: 'UNSATISFIABLE',
      blocking_requirements,
      suggested_relaxations,
      checks,
    }
  }

  const mos = validatePrescribeBodyMOS(body)
  checks.push(...mos.checks)
  if (!mos.ok) {
    for (const c of mos.checks.filter((x) => !x.ok)) {
      blocking_requirements.push({
        requirement_id: null,
        check_id: c.id,
        message: c.message,
        evidence_path: 'body',
      })
    }
    return { ok: false, status: 'UNSATISFIABLE', blocking_requirements, suggested_relaxations, checks }
  }

  const plan = planRows(body)
  for (const key of plan.map((r) => r.phaseKey ?? r.phase_key)) {
    if (!SESSION_PHASE_ORDER.includes(key) && key !== 'other') {
      blocking_requirements.push({
        requirement_id: null,
        check_id: 'phase_plan_keys_canonical',
        message: `Non-canonical phase key: ${key}`,
        evidence_path: 'body.phasePlan',
      })
    }
  }

  if (body.workMode && !VALID_WORK_MODES.has(body.workMode)) {
    blocking_requirements.push({
      requirement_id: findRequirementId(requirements, 'workMode'),
      check_id: 'work_mode_valid_enum',
      message: `Invalid workMode: ${body.workMode}`,
      evidence_path: 'body.workMode',
    })
  }

  const skillLevel = body.skillLevel ?? body.skill_level
  if (skillLevel != null && skillLevel !== '' && skillLevelRank(skillLevel) == null) {
    blocking_requirements.push({
      requirement_id: findRequirementId(requirements, 'skillLevel'),
      check_id: 'skill_level_valid',
      message: `Invalid skillLevel: ${skillLevel}`,
      evidence_path: 'body.skillLevel',
    })
  }

  const ageMin = Number(body.ageMin)
  const ageMax = Number(body.ageMax)
  if (!Number.isFinite(ageMin) || !Number.isFinite(ageMax) || ageMin > ageMax) {
    blocking_requirements.push({
      requirement_id: findRequirementId(requirements, 'audience'),
      check_id: 'audience_inputs_valid',
      message: 'Invalid ageMin/ageMax',
      evidence_path: 'body',
    })
  }

  validateFocusTargetsResolvable(body, requirements, blocking_requirements)

  if (pool) {
    if (body.sportId != null) {
      const sport = await pool.query(`SELECT id FROM coaching.sport WHERE id = $1 LIMIT 1`, [Number(body.sportId)])
      if (!sport.rows[0]) {
        blocking_requirements.push({
          requirement_id: findRequirementId(requirements, 'sportId'),
          check_id: 'sport_id_preflight',
          message: `sportId ${body.sportId} not found`,
          evidence_path: 'body.sportId',
        })
      }
    }

    const useIds = (body.equipmentUseIds ?? body.equipment_use_ids ?? []).map(Number).filter(Number.isFinite)
    const avoidIds = (body.equipmentAvoidIds ?? body.equipment_avoid_ids ?? []).map(Number).filter(Number.isFinite)

    if (useIds.length > 0) {
      const rows = await pool.query(
        `SELECT id FROM coaching.equipment WHERE id = ANY($1::bigint[])`,
        [useIds],
      )
      const found = new Set(rows.rows.map((r) => Number(r.id)))
      const missing = useIds.filter((id) => !found.has(id))
      if (missing.length > 0) {
        blocking_requirements.push({
          requirement_id: findRequirementId(requirements, 'equipmentUseIds'),
          check_id: 'equipment_use_ids_resolvable',
          message: `Unresolvable equipmentUseIds: ${missing.join(', ')}`,
          evidence_path: 'body.equipmentUseIds',
          current_value: missing,
          expected: useIds,
        })
        suggested_relaxations.push({
          field: 'equipmentUseIds',
          suggestion: `Remove or replace missing equipment IDs: ${missing.join(', ')}`,
        })
      }
    }

    if (avoidIds.length > 0) {
      const rows = await pool.query(
        `SELECT id FROM coaching.equipment WHERE id = ANY($1::bigint[])`,
        [avoidIds],
      )
      const found = new Set(rows.rows.map((r) => Number(r.id)))
      const missing = avoidIds.filter((id) => !found.has(id))
      if (missing.length > 0) {
        blocking_requirements.push({
          requirement_id: findRequirementId(requirements, 'equipmentAvoidIds'),
          check_id: 'equipment_avoid_ids_resolvable',
          message: `Unresolvable equipmentAvoidIds: ${missing.join(', ')}`,
          evidence_path: 'body.equipmentAvoidIds',
        })
      }
    }

    const avoidSlugs = (body.avoidExerciseSlugs ?? body.avoid_exercise_slugs ?? []).map(String).filter(Boolean)
    if (avoidSlugs.length > 0) {
      const slugRows = await pool.query(
        `SELECT slug FROM coaching.exercise WHERE slug = ANY($1::text[]) AND archived = FALSE`,
        [avoidSlugs],
      )
      const found = new Set(slugRows.rows.map((r) => String(r.slug).toLowerCase()))
      const missing = avoidSlugs.filter((s) => !found.has(String(s).toLowerCase()))
      if (missing.length > 0) {
        blocking_requirements.push({
          requirement_id: findRequirementId(requirements, 'exerciseAvoid'),
          check_id: 'avoid_exercise_slugs_resolvable',
          message: `Unresolvable avoidExerciseSlugs: ${missing.join(', ')}`,
          evidence_path: 'body.avoidExerciseSlugs',
        })
      }
    }

    const excludeBody = (body.excludeBodyRegionIds ?? body.exclude_body_region_ids ?? []).map(Number).filter(Number.isFinite)
    if (excludeBody.length > 0) {
      try {
        const br = await pool.query(`SELECT id FROM coaching.body_region WHERE id = ANY($1::bigint[])`, [excludeBody])
        const found = new Set(br.rows.map((r) => Number(r.id)))
        const missing = excludeBody.filter((id) => !found.has(id))
        if (missing.length > 0) {
          blocking_requirements.push({
            requirement_id: findRequirementId(requirements, 'excludeBodyRegionIds'),
            check_id: 'body_region_exclude_id_valid',
            message: `Invalid excludeBodyRegionIds: ${missing.join(', ')}`,
            evidence_path: 'body.excludeBodyRegionIds',
          })
        }
      } catch {
        // body_region table may be absent in test env
      }
    }
  }

  const splits = body.audienceSplits ?? body.audience_splits ?? []
  if (splits.length >= 2 && Number.isFinite(ageMin) && Number.isFinite(ageMax)) {
    const splitMin = Math.min(...splits.map((s) => Number(s.ageMin ?? s.age_min)))
    const splitMax = Math.max(...splits.map((s) => Number(s.ageMax ?? s.age_max)))
    if (splitMin > ageMin || splitMax < ageMax) {
      blocking_requirements.push({
        requirement_id: findRequirementId(requirements, 'audienceSplits'),
        check_id: 'split_age_coverage',
        message: `Splits ${splitMin}-${splitMax} do not cover session age ${ageMin}-${ageMax}`,
        evidence_path: 'body.audienceSplits',
      })
    }
  }

  const ok = blocking_requirements.length === 0
  return {
    ok,
    status: ok ? null : 'UNSATISFIABLE',
    blocking_requirements,
    suggested_relaxations,
    checks,
  }
}
