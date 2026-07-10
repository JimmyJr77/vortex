/**
 * Prescription quality gates for golden-scenario evaluation (strict loop).
 * Used by scripts/evaluate-prescription-quality.mjs and unit tests.
 */

import { SESSION_PHASE_ORDER, buildPhasePlan } from './phaseArchitect.js'
import { runCategoryEvaluators } from './categoryQualityEvaluators.js'

/** Check IDs that feed C1-KPI-01 (MOP/MOS structure; excludes informational MOE). */
export const CATEGORY1_KPI_CHECK_IDS = [
  'prescribe_body_mos_complete',
  'phase_plan_minute_sum_mos',
  'phase_count_match',
  'phase_key_set_equality',
  'canonical_phase_order',
  'phase_minutes_exact',
  'session_minutes_sum',
  'focus_targets_count_parity',
  'focus_targets_field_parity',
  'pinned_prepare_first',
  'work_mode_echo',
  'no_orphan_other_blocks',
  'phase_label_parity',
  'session_objective_echo',
  'focus_weight_sum_sanity',
  'phase_rationales_present',
  'focus_weight_intent_minimum',
  'other_phase_fidelity',
  'block_index_order',
  'sport_id_preflight',
]

/** Informational Category 1 MOE check ids (non-blocking). */
export const CATEGORY1_MOE_CHECK_IDS = [
  'category1_moe_high_intent_ratio',
  'category1_moe_prepare_share',
  'category1_moe_mi_proportion',
  'category1_moe_restore_prepare_ratio',
  'category1_moe_objective_template_proportions',
  'category1_moe_restore_last',
  'category1_moe_review_packet',
]

export const LOW_INTENT_PHASES = new Set([
  'prepare_and_access',
  'movement_intelligence',
  'restore',
  'sustained_capacity',
])

export const PROGRESSION_PHASES = new Set(['output', 'capacity', 'resilience'])

export const DEFAULT_BASELINE_THRESHOLDS = {
  minPhaseFillPct: 70,
  restoreMinFillPct: 90,
  restoreMaxOverfillPct: 105,
  maxStretchPrimariesInPrepare: 0,
  maxStretchPrimariesInMI: 99,
  maxStretchPrimariesInCapacity: 99,
  maxStretchPrimariesInOutput: 99,
  maxStretchPrimariesInResilience: 99,
  requireSplit2ProgressionInPhases: ['output', 'capacity'],
  minSplit2ProgressionCount: 1,
  minSplit2ProgressionCountByPhase: null,
  maxProgressionReusePerPhase: 99,
  progressionMustIncreaseDifficulty: false,
  progressionMustSharePatternOrFamily: false,
  maxAgeFitWarnings: 99,
  maxSplitVariantWarnings: 99,
  minEquipmentUseKeysPresent: [],
  forbidHandstandInMIUnderAge: null,
  maxDuplicateSlugs: 99,
  forbidProgressionNameSubstrings: [],
}

export const DEFAULT_STRICT_THRESHOLDS = {
  minPhaseFillPct: 85,
  phaseFillPctOverrides: {
    prepare_and_access: 90,
    output: 90,
    capacity: 90,
    resilience: 90,
    sustained_capacity: 80,
    movement_intelligence: 85,
  },
  restoreMinFillPct: 95,
  restoreMaxOverfillPct: 105,
  maxStretchPrimariesInPrepare: 0,
  maxStretchPrimariesInMI: 0,
  maxStretchPrimariesInCapacity: 0,
  maxStretchPrimariesInOutput: 0,
  maxStretchPrimariesInResilience: 0,
  requireSplit2ProgressionInPhases: ['output', 'capacity', 'resilience'],
  minSplit2ProgressionCount: 3,
  minSplit2ProgressionCountByPhase: {
    output: 3,
    capacity: 2,
    resilience: 1,
  },
  maxProgressionReusePerPhase: 1,
  progressionMustIncreaseDifficulty: true,
  progressionMustSharePatternOrFamily: true,
  maxAgeFitWarnings: 0,
  maxSplitVariantWarnings: 1,
  minEquipmentUseKeysPresent: ['kettlebell', 'jump_rope', 'cones'],
  forbidHandstandInMIUnderAge: 15,
  maxDuplicateSlugs: 0,
  forbidProgressionNameSubstrings: [],
}

function fail(checks, id, message, detail = null) {
  checks.push({ id, ok: false, severity: id.startsWith('restore_') || id.includes('avoid') ? 'P0' : 'P1', message, detail })
}

function pass(checks, id, message, detail = null) {
  checks.push({ id, ok: true, severity: 'ok', message, detail })
}

export function blockByKey(result, phaseKey) {
  return result.blocks?.find((b) => b.phase_key === phaseKey)
}

export function isSplit2Label(label) {
  return /split 2|11-14|11–14/i.test(String(label ?? ''))
}

export function allPerSplitVariants(block) {
  const variants = []
  for (const item of block?.items ?? []) {
    for (const v of item.per_split ?? item.split_alternates_json ?? []) {
      variants.push({ item, variant: v })
    }
  }
  return variants
}

export function collectExerciseIds(result) {
  const ids = new Set()
  for (const block of result.blocks ?? []) {
    for (const item of block.items ?? []) {
      if (item.exercise_id) ids.add(Number(item.exercise_id))
      for (const v of item.per_split ?? item.split_alternates_json ?? []) {
        if (v.exercise_id) ids.add(Number(v.exercise_id))
      }
    }
  }
  return [...ids]
}

export function patternIdsForExercise(exerciseId, tagMap) {
  return (tagMap.get(String(exerciseId)) ?? [])
    .filter((t) => t.facetType === 'pattern')
    .map((t) => Number(t.facetId))
}

export function equipmentKeysForExercise(exerciseId, tagMap, equipmentKeyById) {
  return (tagMap.get(String(exerciseId)) ?? [])
    .filter((t) => t.facetType === 'equipment')
    .map((t) => equipmentKeyById.get(Number(t.facetId)))
    .filter(Boolean)
}

export function sharesPatternOrFamily(primaryId, otherId, tagMap, exerciseById) {
  const aPatterns = new Set(patternIdsForExercise(primaryId, tagMap))
  const bPatterns = patternIdsForExercise(otherId, tagMap)
  if (aPatterns.size > 0 && bPatterns.some((id) => aPatterns.has(id))) return true

  const a = exerciseById.get(Number(primaryId))
  const b = exerciseById.get(Number(otherId))
  const aFamily = String(a?.movement_family ?? '').toLowerCase()
  const bFamily = String(b?.movement_family ?? '').toLowerCase()
  return Boolean(aFamily && bFamily && aFamily === bFamily)
}

/** C7-MOP-05 — how lane match was satisfied */
export function progressionLaneMatchMethod(primaryId, progId, tagMap, exerciseById) {
  const aPatterns = new Set(patternIdsForExercise(primaryId, tagMap))
  const bPatterns = patternIdsForExercise(progId, tagMap)
  if (aPatterns.size > 0 && bPatterns.some((id) => aPatterns.has(id))) return 'pattern'
  if (sharesPatternOrFamily(primaryId, progId, tagMap, exerciseById)) return 'family'
  return 'none'
}

/** Engine-style lane gate (profile role + pattern/family) for C7-MOP-04 parity */
export function engineStyleLaneValid(primaryId, progId, phaseKey, tagMap, exerciseById, phaseProfileMap = new Map()) {
  const progressionPhases = ['output', 'capacity', 'resilience']
  if (!progressionPhases.includes(phaseKey)) return false
  if (!sharesPatternOrFamily(primaryId, progId, tagMap, exerciseById)) return false
  const profiles = phaseProfileMap.get(String(progId)) ?? phaseProfileMap.get(Number(progId)) ?? []
  if (profiles.length === 0) return true
  const role = profiles.find((p) => (p.phaseKey ?? p.phase_key) === phaseKey)?.role
  return role === 'primary' || role === 'secondary'
}

function minFillForPhase(phaseKey, thresholds) {
  return thresholds.phaseFillPctOverrides?.[phaseKey] ?? thresholds.minPhaseFillPct ?? 85
}

function maxStretchForPhase(phaseKey, thresholds) {
  const map = {
    prepare_and_access: thresholds.maxStretchPrimariesInPrepare,
    movement_intelligence: thresholds.maxStretchPrimariesInMI,
    capacity: thresholds.maxStretchPrimariesInCapacity,
    output: thresholds.maxStretchPrimariesInOutput,
    resilience: thresholds.maxStretchPrimariesInResilience,
  }
  return map[phaseKey] ?? 99
}

function planRows(body) {
  return Array.isArray(body?.phasePlan) ? body.phasePlan : []
}

function planPhaseKey(row) {
  return row.phaseKey ?? row.phase_key ?? row.phase
}

function normFocusTarget(t) {
  return {
    facetId: Number(t.facetId ?? t.facet_id),
    facetType: String(t.facetType ?? t.facet_type ?? ''),
    weight: Number(t.weight),
  }
}

function focusTargetsMatch(a, b) {
  const na = normFocusTarget(a)
  const nb = normFocusTarget(b)
  return na.facetId === nb.facetId && na.facetType === nb.facetType && na.weight === nb.weight
}

/**
 * Pre-prescribe MOS gates (C1-MOS-01, C1-MOS-02).
 * @returns {{ checks: object[], ok: boolean }}
 */
export function validatePrescribeBodyMOS(body) {
  const checks = []
  const missing = []
  if (body?.ageMin == null) missing.push('ageMin')
  if (body?.ageMax == null) missing.push('ageMax')
  if (body?.durationMinutes == null || !Number.isFinite(Number(body.durationMinutes))) missing.push('durationMinutes')
  if (!Array.isArray(body?.phasePlan) || body.phasePlan.length === 0) missing.push('phasePlan')
  if (body?.sessionObjective == null || body.sessionObjective === '') missing.push('sessionObjective')
  if (body?.workMode == null || body.workMode === '') missing.push('workMode')
  if (body?.skillLevel == null || body.skillLevel === '') missing.push('skillLevel')

  if (missing.length > 0) {
    fail(checks, 'prescribe_body_mos_complete', `Prescribe body missing mandatory fields: ${missing.join(', ')}`, missing)
  } else {
    pass(checks, 'prescribe_body_mos_complete', 'Prescribe body has mandatory fields')
  }

  const planSum = planRows(body).reduce((s, r) => s + Number(r.minutes ?? 0), 0)
  const duration = Number(body?.durationMinutes ?? 0)
  if (planSum !== duration) {
    fail(checks, 'phase_plan_minute_sum_mos', `phasePlan minutes sum ${planSum} !== durationMinutes ${duration}`, { planSum, duration })
  } else {
    pass(checks, 'phase_plan_minute_sum_mos', `phasePlan minutes sum equals durationMinutes (${duration})`)
  }

  return { checks, ok: checks.every((c) => c.ok) }
}

/**
 * Category 1 structure parity (C1-MOP-01–17, C1-MOE-06).
 */
export function evaluateCategory1Structure(result, expectedBody, checks) {
  const plan = planRows(expectedBody)
  const blocks = result.blocks ?? []

  if (blocks.length !== plan.length) {
    fail(checks, 'phase_count_match', `blocks.length ${blocks.length} !== phasePlan.length ${plan.length}`)
  } else {
    pass(checks, 'phase_count_match', `Phase count match (${blocks.length})`)
  }

  const planKeys = plan.map(planPhaseKey)
  const blockKeys = blocks.map((b) => b.phase_key)
  const planKeySet = new Set(planKeys)
  const blockKeySet = new Set(blockKeys)
  const missingKeys = planKeys.filter((k) => !blockKeySet.has(k))
  const extraKeys = blockKeys.filter((k) => !planKeySet.has(k))
  if (missingKeys.length > 0 || extraKeys.length > 0 || planKeys.length !== blockKeys.length) {
    fail(checks, 'phase_key_set_equality', 'Phase key set mismatch', { missingKeys, extraKeys, planKeys, blockKeys })
  } else {
    pass(checks, 'phase_key_set_equality', 'Phase key sets equal')
  }

  const orderIndices = blockKeys.map((k) => SESSION_PHASE_ORDER.indexOf(k))
  const hasUnknown = orderIndices.some((i) => i < 0)
  const inversions = orderIndices.some((idx, i) => i > 0 && idx < orderIndices[i - 1])
  if (hasUnknown || inversions) {
    fail(checks, 'canonical_phase_order', 'Block phase order violates SESSION_PHASE_ORDER', { blockKeys, orderIndices })
  } else {
    pass(checks, 'canonical_phase_order', 'Canonical phase order preserved')
  }

  const expectedIndexOrder = SESSION_PHASE_ORDER.filter((k) => blockKeySet.has(k))
  const indexMismatches = blockKeys
    .map((k, i) => ({ i, key: k, expected: expectedIndexOrder[i] }))
    .filter((row) => row.key !== row.expected)
  if (indexMismatches.length > 0) {
    fail(checks, 'block_index_order', 'Block index order does not match canonical phase order', indexMismatches)
  } else {
    pass(checks, 'block_index_order', 'Block index order matches canonical phase order')
  }

  const minuteMismatches = []
  for (const row of plan) {
    const key = planPhaseKey(row)
    const block = blockByKey(result, key)
    const planned = Number(row.minutes ?? 0)
    const actual = Number(block?.target_minutes ?? -1)
    if (!block || actual !== planned) {
      minuteMismatches.push({ phase_key: key, planned, actual })
    }
  }
  if (minuteMismatches.length > 0) {
    fail(checks, 'phase_minutes_exact', 'Per-phase target_minutes differ from phasePlan', minuteMismatches)
  } else {
    pass(checks, 'phase_minutes_exact', 'Per-phase target minutes exact')
  }

  const blockSum = blocks.reduce((s, b) => s + Number(b.target_minutes ?? 0), 0)
  const duration = Number(expectedBody.durationMinutes ?? 0)
  if (blockSum !== duration) {
    fail(checks, 'session_minutes_sum', `sum(target_minutes) ${blockSum} !== durationMinutes ${duration}`)
  } else {
    pass(checks, 'session_minutes_sum', `Session minutes sum equals durationMinutes (${duration})`)
  }

  const focusCountMismatches = []
  for (const row of plan) {
    const key = planPhaseKey(row)
    const block = blockByKey(result, key)
    const planFocus = row.focusTargets ?? row.focus_targets ?? []
    const blockFocus = block?.focus_targets ?? []
    if (planFocus.length !== blockFocus.length) {
      focusCountMismatches.push({ phase_key: key, plan: planFocus.length, block: blockFocus.length })
    }
  }
  if (focusCountMismatches.length > 0) {
    fail(checks, 'focus_targets_count_parity', 'focus_targets count mismatch', focusCountMismatches)
  } else {
    pass(checks, 'focus_targets_count_parity', 'Focus target counts match per phase')
  }

  const focusFieldMismatches = []
  for (const row of plan) {
    const key = planPhaseKey(row)
    const block = blockByKey(result, key)
    const planFocus = (row.focusTargets ?? row.focus_targets ?? []).map(normFocusTarget)
    const blockFocus = (block?.focus_targets ?? []).map(normFocusTarget)
    for (let i = 0; i < planFocus.length; i++) {
      if (!focusTargetsMatch(planFocus[i], blockFocus[i])) {
        focusFieldMismatches.push({ phase_key: key, index: i, plan: planFocus[i], block: blockFocus[i] })
      }
    }
  }
  if (focusFieldMismatches.length > 0) {
    fail(checks, 'focus_targets_field_parity', 'focus_targets facetId/facetType/weight mismatch', focusFieldMismatches)
  } else {
    pass(checks, 'focus_targets_field_parity', 'Focus target fields match per phase')
  }

  const preparePlan = plan.find((r) => planPhaseKey(r) === 'prepare_and_access')
  if (preparePlan?.pinned) {
    const firstKey = blocks[0]?.phase_key
    const prepareBlock = blockByKey(result, 'prepare_and_access')
    const planMinutes = Number(preparePlan.minutes ?? 0)
    const blockMinutes = Number(prepareBlock?.target_minutes ?? 0)
    if (firstKey !== 'prepare_and_access' || blockMinutes < planMinutes) {
      fail(checks, 'pinned_prepare_first', 'Pinned Prepare must be first block with minutes >= plan', {
        firstKey,
        blockMinutes,
        planMinutes,
      })
    } else {
      pass(checks, 'pinned_prepare_first', 'Pinned Prepare first with correct minutes')
    }
  } else {
    pass(checks, 'pinned_prepare_first', 'Prepare not pinned — check skipped')
  }

  const expectedWorkMode = expectedBody.workMode ?? expectedBody.work_mode ?? 'exercise'
  if (result.work_mode !== expectedWorkMode) {
    fail(checks, 'work_mode_echo', `work_mode ${result.work_mode} !== ${expectedWorkMode}`)
  } else {
    pass(checks, 'work_mode_echo', `work_mode echoes body (${expectedWorkMode})`)
  }

  const orphanOther = blocks.filter((b) => b.phase_key === 'other' && !(b.other_kind ?? b.otherKind))
  if (orphanOther.length > 0) {
    fail(checks, 'no_orphan_other_blocks', 'other phase blocks missing other_kind', orphanOther.map((b) => b.phase_key))
  } else {
    pass(checks, 'no_orphan_other_blocks', 'No orphan other blocks')
  }

  const labelMismatches = []
  for (const row of plan) {
    const key = planPhaseKey(row)
    const block = blockByKey(result, key)
    const planLabel = row.label ?? ''
    const blockLabel = block?.label ?? ''
    if (planLabel && blockLabel && planLabel !== blockLabel) {
      labelMismatches.push({ phase_key: key, plan: planLabel, block: blockLabel })
    }
  }
  if (labelMismatches.length > 0) {
    fail(checks, 'phase_label_parity', 'Phase labels differ from plan', labelMismatches)
  } else {
    pass(checks, 'phase_label_parity', 'Phase labels match plan')
  }

  const expectedObjective = expectedBody.sessionObjective ?? expectedBody.session_objective
  const actualObjective = result.audience_profile?.sessionObjective
  if (expectedObjective != null && actualObjective !== expectedObjective) {
    fail(checks, 'session_objective_echo', `sessionObjective ${actualObjective} !== ${expectedObjective}`)
  } else {
    pass(checks, 'session_objective_echo', `sessionObjective echoes body (${expectedObjective})`)
  }

  const weightIssues = []
  for (const block of blocks) {
    const targets = block.focus_targets ?? []
    if (targets.length === 0) continue
    const sum = targets.reduce((s, t) => s + Number(t.weight ?? 0), 0)
    if (sum < 1 || sum > 10) {
      weightIssues.push({ phase_key: block.phase_key, sum })
    }
  }
  if (weightIssues.length > 0) {
    fail(checks, 'focus_weight_sum_sanity', 'Focus weight sum out of range 1–10', weightIssues)
  } else {
    pass(checks, 'focus_weight_sum_sanity', 'Focus weight sums in valid range')
  }

  const rationales = result.phase_rationales ?? []
  if (rationales.length !== blocks.length) {
    fail(checks, 'phase_rationales_present', `phase_rationales.length ${rationales.length} !== blocks.length ${blocks.length}`)
  } else {
    pass(checks, 'phase_rationales_present', `phase_rationales present (${rationales.length})`)
  }

  const outputBlock = blockByKey(result, 'output')
  const sustainedBlock = blockByKey(result, 'sustained_capacity')
  const intentIssues = []
  const outputFocus = outputBlock?.focus_targets ?? []
  const sustainedFocus = sustainedBlock?.focus_targets ?? []
  if (outputFocus.length > 0) {
    const maxOutputWeight = Math.max(...outputFocus.map((t) => Number(t.weight ?? 0)))
    if (maxOutputWeight < 3) intentIssues.push({ phase: 'output', maxWeight: maxOutputWeight, min: 3 })
  }
  if (sustainedFocus.length > 0) {
    const maxSustainedWeight = Math.max(...sustainedFocus.map((t) => Number(t.weight ?? 0)))
    if (maxSustainedWeight < 3) intentIssues.push({ phase: 'sustained_capacity', maxWeight: maxSustainedWeight, min: 3 })
  }
  if (intentIssues.length > 0) {
    fail(checks, 'focus_weight_intent_minimum', 'Focused phases need weight >= 3', intentIssues)
  } else {
    pass(checks, 'focus_weight_intent_minimum', 'Focus weights meet intent minimums')
  }

  const otherPlanRows = plan.filter((r) => planPhaseKey(r) === 'other')
  if (otherPlanRows.length > 0) {
    const fidelityIssues = []
    for (const row of otherPlanRows) {
      const block = blockByKey(result, 'other')
      const planKind = row.otherKind ?? row.other_kind
      const blockKind = block?.other_kind ?? block?.otherKind
      if (planKind && blockKind !== planKind) {
        fidelityIssues.push({ planKind, blockKind })
      }
    }
    if (fidelityIssues.length > 0) {
      fail(checks, 'other_phase_fidelity', 'other phase otherKind mismatch', fidelityIssues)
    } else {
      pass(checks, 'other_phase_fidelity', 'other phase fidelity preserved')
    }
  } else {
    pass(checks, 'other_phase_fidelity', 'No other phase in plan — check skipped')
  }
}

/**
 * Informational Category 1 MOE calculators (non-blocking).
 */
export function evaluateCategory1MoeInfo(result, expectedBody, checks) {
  const blocks = result.blocks ?? []
  const totalMinutes = blocks.reduce((s, b) => s + Number(b.target_minutes ?? 0), 0) || 1

  const highIntentKeys = new Set(['output', 'capacity', 'resilience', 'sustained_capacity'])
  const highIntentMinutes = blocks
    .filter((b) => highIntentKeys.has(b.phase_key))
    .reduce((s, b) => s + Number(b.target_minutes ?? 0), 0)
  const highIntentRatio = highIntentMinutes / totalMinutes
  pass(checks, 'category1_moe_high_intent_ratio', `High-intent minutes ratio: ${(highIntentRatio * 100).toFixed(1)}%`, {
    informational: true,
    ratio: highIntentRatio,
    threshold: 0.75,
    ok_band: highIntentRatio >= 0.75,
  })

  const prepareBlock = blockByKey(result, 'prepare_and_access')
  const prepareShare = Number(prepareBlock?.target_minutes ?? 0) / totalMinutes
  pass(checks, 'category1_moe_prepare_share', `Prepare share: ${(prepareShare * 100).toFixed(1)}%`, {
    informational: true,
    ratio: prepareShare,
    threshold_max: 0.12,
    ok_band: prepareShare <= 0.12,
  })

  const miBlock = blockByKey(result, 'movement_intelligence')
  const miShare = Number(miBlock?.target_minutes ?? 0) / totalMinutes
  const sessionObjective = expectedBody?.sessionObjective ?? result.audience_profile?.sessionObjective
  pass(checks, 'category1_moe_mi_proportion', `MI proportion: ${(miShare * 100).toFixed(1)}%`, {
    informational: true,
    ratio: miShare,
    band_min: 0.08,
    band_max: 0.15,
    ok_band: sessionObjective === 'speed_priority' ? miShare >= 0.08 && miShare <= 0.15 : null,
  })

  const restoreBlock = blockByKey(result, 'restore')
  const restoreMinutes = Number(restoreBlock?.target_minutes ?? 0)
  const prepareMinutes = Number(prepareBlock?.target_minutes ?? 0)
  const restorePrepareRatio = prepareMinutes > 0 ? restoreMinutes / prepareMinutes : 0
  pass(checks, 'category1_moe_restore_prepare_ratio', `Restore/Prepare ratio: ${restorePrepareRatio.toFixed(2)}`, {
    informational: true,
    ratio: restorePrepareRatio,
    threshold_min: 0.30,
    ok_band: restorePrepareRatio >= 0.30,
  })

  const objective = expectedBody?.sessionObjective ?? 'general_athletic_development'
  const duration = Number(expectedBody?.durationMinutes ?? totalMinutes)
  const { plan: templatePlan } = buildPhasePlan({ sessionObjective: objective, durationMinutes: duration })
  const templateTotal = templatePlan.reduce((s, r) => s + Number(r.minutes ?? 0), 0) || 1
  const proportionBands = []
  for (const row of planRows(expectedBody)) {
    const key = planPhaseKey(row)
    const templateRow = templatePlan.find((p) => p.phaseKey === key)
    const actualPct = (Number(row.minutes ?? 0) / totalMinutes) * 100
    const templatePct = templateRow ? (Number(templateRow.minutes ?? 0) / templateTotal) * 100 : null
    const delta = templatePct != null ? Math.abs(actualPct - templatePct) : null
    proportionBands.push({ phase_key: key, actualPct, templatePct, delta })
  }
  const outsideBand = proportionBands.filter((b) => b.delta != null && b.delta > 5)
  pass(checks, 'category1_moe_objective_template_proportions', `Template proportion compare: ${outsideBand.length} phase(s) outside ±5%`, {
    informational: true,
    phases: proportionBands,
    outside_band_count: outsideBand.length,
    ok_band: outsideBand.length <= 1,
  })

  const lastKey = blocks[blocks.length - 1]?.phase_key
  const restorePresent = blocks.some((b) => b.phase_key === 'restore')
  pass(checks, 'category1_moe_restore_last', `Restore last: ${lastKey === 'restore'}; present: ${restorePresent}`, {
    informational: true,
    last_phase_key: lastKey,
    restore_present: restorePresent,
    ok_band: restorePresent && lastKey === 'restore',
  })

  pass(checks, 'category1_moe_review_packet', `${blocks.length} phase(s) for coach MOE review`, {
    informational: true,
    phases: blocks.map((b) => ({
      phase_key: b.phase_key,
      label: b.label,
      target_minutes: b.target_minutes,
      item_count: b.items?.length ?? 0,
    })),
    rubric: ['C1-MOE-01', 'C1-MOE-07'],
  })
}

/**
 * C1-KPI-01 aggregate over CATEGORY1_KPI_CHECK_IDS (skips N/A checks marked skipped in message).
 */
export function computeCategory1Kpi(checks, { minRate = 0.95 } = {}) {
  const applicable = checks.filter((c) => CATEGORY1_KPI_CHECK_IDS.includes(c.id))
  const scored = applicable.filter((c) => !String(c.message).includes('skipped'))
  const passed = scored.filter((c) => c.ok).length
  const rate = scored.length > 0 ? passed / scored.length : 1
  return {
    id: 'category1_kpi',
    ok: rate >= minRate,
    severity: rate >= minRate ? 'ok' : 'P1',
    message: `Category 1 structure fidelity: ${(rate * 100).toFixed(1)}% (${passed}/${scored.length}; min ${(minRate * 100).toFixed(0)}%)`,
    detail: { rate, passed, total: scored.length, minRate },
  }
}

export function evaluatePrescriptionQuality(result, thresholds, context = {}) {
  const checks = []
  const tagMap = context.tagMap ?? new Map()
  const exerciseById = context.exerciseById ?? new Map()
  const equipmentKeyById = context.equipmentKeyById ?? new Map()
  const sessionAgeMax = context.sessionAgeMax ?? result.audience_profile?.ageMax ?? null

  const restoreBlock = blockByKey(result, 'restore')
  const restoreItems = restoreBlock?.items ?? []
  const restoreTarget = restoreBlock?.target_minutes ?? 4
  const restoreEst = restoreBlock?.estimated_minutes ?? 0
  const restoreFillPct = restoreTarget > 0 ? Math.round((restoreEst / restoreTarget) * 100) : 100

  if (restoreItems.length === 0) {
    fail(checks, 'restore_non_empty', 'Restore phase must contain at least one exercise')
  } else {
    pass(checks, 'restore_non_empty', `Restore has ${restoreItems.length} item(s)`)
  }

  const restoreEmptyReason = (result.constraint_report?.empty_phase_reasons ?? [])
    .some((r) => /restore/i.test(r) && /pool_empty|no exercises/i.test(r))
  if (restoreEmptyReason) {
    fail(checks, 'restore_no_pool_empty', 'Restore must not report pool_empty')
  } else {
    pass(checks, 'restore_no_pool_empty', 'Restore has no pool_empty reason')
  }

  if (restoreFillPct < (thresholds.restoreMinFillPct ?? 95)) {
    fail(checks, 'restore_min_fill', `Restore under target: ${restoreEst}m / ${restoreTarget}m (${restoreFillPct}%)`)
  } else if (restoreEst > restoreTarget * ((thresholds.restoreMaxOverfillPct ?? 105) / 100)) {
    fail(checks, 'restore_within_budget', `Restore over budget: ${restoreEst}m / ${restoreTarget}m (${restoreFillPct}%)`)
  } else {
    pass(checks, 'restore_fill_band', `Restore fill in band: ${restoreEst}m / ${restoreTarget}m (${restoreFillPct}%)`)
  }

  for (const phaseKey of LOW_INTENT_PHASES) {
    const block = blockByKey(result, phaseKey)
    if (!block) continue
    const bad = allPerSplitVariants(block).filter(({ variant }) => variant.variant_type === 'progression')
    if (bad.length > 0) {
      fail(
        checks,
        `no_progression_${phaseKey}`,
        `${phaseKey} must not use Progression variants`,
        bad.slice(0, 5).map(({ item, variant }) => `${item.exercise_name} → ${variant.exercise_name}`),
      )
    } else {
      pass(checks, `no_progression_${phaseKey}`, `${phaseKey} has no Progression variants`)
    }
  }

  const avoidSamples = result.constraint_report?.equipment_avoid?.sample_names ?? []
  const boxBreathingExcluded = avoidSamples.some((n) => /box breathing/i.test(String(n)))
  if (boxBreathingExcluded) {
    fail(checks, 'restore_not_box_avoid_false_positive', 'Box Breathing Hold must not appear in equipment-avoid samples when avoiding plyo box')
  } else {
    pass(checks, 'restore_not_box_avoid_false_positive', 'No box-breathing false positive in avoid samples')
  }

  for (const fill of result.constraint_report?.phase_fill ?? []) {
    if (fill.phase_key === 'restore') continue
    const minPct = minFillForPhase(fill.phase_key, thresholds)
    if ((fill.fill_pct ?? 0) < minPct) {
      fail(
        checks,
        `phase_fill_${fill.phase_key}`,
        `${fill.phase_key} underfilled: ${fill.fill_pct}% (min ${minPct}%)`,
      )
    } else {
      pass(checks, `phase_fill_${fill.phase_key}`, `${fill.phase_key} fill ${fill.fill_pct}%`)
    }
  }

  for (const phaseKey of ['prepare_and_access', 'movement_intelligence', 'output', 'capacity', 'resilience']) {
    const block = blockByKey(result, phaseKey)
    if (!block) continue
    const stretchCount = (block.items ?? []).filter((it) => it.age_fit === 'stretch').length
    const maxStretch = maxStretchForPhase(phaseKey, thresholds)
    if (stretchCount > maxStretch) {
      fail(
        checks,
        `stretch_primaries_${phaseKey}`,
        `${phaseKey} has ${stretchCount} stretch primary item(s) (max ${maxStretch})`,
        (block.items ?? []).filter((it) => it.age_fit === 'stretch').map((it) => it.exercise_name),
      )
    } else {
      pass(checks, `stretch_primaries_${phaseKey}`, `${phaseKey} stretch primaries within limit (${stretchCount})`)
    }
  }

  if (thresholds.forbidHandstandInMIUnderAge != null && sessionAgeMax != null && sessionAgeMax < thresholds.forbidHandstandInMIUnderAge) {
    const miBlock = blockByKey(result, 'movement_intelligence')
    const handstands = (miBlock?.items ?? []).filter((it) => {
      const ex = exerciseById.get(Number(it.exercise_id))
      const blob = `${ex?.slug ?? ''} ${it.exercise_name ?? ''}`.toLowerCase()
      return /handstand|inversion|inverted/.test(blob)
    })
    if (handstands.length > 0) {
      fail(checks, 'mi_no_handstand_youth', 'Movement Intelligence must not prescribe handstand/inversion for youth session', handstands.map((it) => it.exercise_name))
    } else {
      pass(checks, 'mi_no_handstand_youth', 'MI has no handstand/inversion for youth')
    }
  }

  const slugCounts = new Map()
  for (const block of result.blocks ?? []) {
    for (const item of block.items ?? []) {
      const ex = exerciseById.get(Number(item.exercise_id))
      const slug = ex?.slug ?? String(item.exercise_id)
      slugCounts.set(slug, (slugCounts.get(slug) ?? 0) + 1)
    }
  }
  const dupSlugs = [...slugCounts.entries()].filter(([, n]) => n > 1)
  if (dupSlugs.length > (thresholds.maxDuplicateSlugs ?? 0)) {
    fail(checks, 'no_duplicate_session_slugs', 'Session must not repeat the same exercise slug as a primary', dupSlugs.map(([slug, n]) => `${slug} x${n}`))
  } else {
    pass(checks, 'no_duplicate_session_slugs', 'No duplicate primary slugs session-wide')
  }

  const minEquipKeys = thresholds.minEquipmentUseKeysPresent ?? []
  if (minEquipKeys.length > 0) {
    const usedEquipKeys = new Set()
    for (const block of result.blocks ?? []) {
      for (const item of block.items ?? []) {
        for (const key of equipmentKeysForExercise(item.exercise_id, tagMap, equipmentKeyById)) {
          usedEquipKeys.add(key)
        }
      }
    }
    const missingEquip = minEquipKeys.filter((key) => !usedEquipKeys.has(key))
    if (missingEquip.length > 0) {
      fail(checks, 'equipment_use_coverage', `Prescription must use requested equipment: missing ${missingEquip.join(', ')}`, { used: [...usedEquipKeys], required: minEquipKeys })
    } else {
      pass(checks, 'equipment_use_coverage', `All requested equipment keys appear in prescription (${minEquipKeys.join(', ')})`)
    }
  }

  let totalSplit2Progressions = 0
  const progressionPhases = thresholds.requireSplit2ProgressionInPhases ?? ['output', 'capacity']
  for (const phaseKey of progressionPhases) {
    const block = blockByKey(result, phaseKey)
    const split2Progressions = []
    for (const { item, variant } of allPerSplitVariants(block)) {
      if (!isSplit2Label(variant.split_label)) continue
      if (variant.variant_type !== 'progression') continue
      split2Progressions.push({ item, variant })
      totalSplit2Progressions += 1
    }

    const minForPhase = thresholds.minSplit2ProgressionCountByPhase?.[phaseKey]
      ?? thresholds.minSplit2ProgressionCount
      ?? 1
    if (split2Progressions.length < minForPhase) {
      fail(
        checks,
        `split2_progressions_${phaseKey}`,
        `${phaseKey}: expected ≥${minForPhase} Split 2 progressions; got ${split2Progressions.length}`,
      )
    } else {
      pass(checks, `split2_progressions_${phaseKey}`, `${phaseKey}: ${split2Progressions.length} Split 2 progressions`)
    }

    const reuseLimit = thresholds.maxProgressionReusePerPhase ?? 99
    const progUseCount = new Map()
    for (const { variant } of split2Progressions) {
      const id = Number(variant.exercise_id)
      progUseCount.set(id, (progUseCount.get(id) ?? 0) + 1)
    }
    const overReused = [...progUseCount.entries()].filter(([, n]) => n > reuseLimit)
    if (overReused.length > 0) {
      const names = overReused.map(([id, n]) => {
        const ex = exerciseById.get(id)
        return `${ex?.name ?? id} reused ${n}x`
      })
      fail(checks, `progression_reuse_${phaseKey}`, `${phaseKey}: progression exercise reused beyond limit (${reuseLimit})`, names)
    } else {
      pass(checks, `progression_reuse_${phaseKey}`, `${phaseKey}: progression reuse within limit`)
    }

    if (thresholds.progressionMustIncreaseDifficulty) {
      const badDiff = split2Progressions.filter(({ item, variant }) => {
        const pDiff = Number(item.difficulty?.overall ?? 0)
        const vDiff = Number(variant.difficulty?.overall ?? 0)
        return vDiff <= pDiff
      })
      if (badDiff.length > 0) {
        fail(
          checks,
          `progression_difficulty_${phaseKey}`,
          `${phaseKey}: Split 2 progressions must exceed primary difficulty`,
          badDiff.slice(0, 5).map(({ item, variant }) => `${item.exercise_name} D${item.difficulty?.overall} → ${variant.exercise_name} D${variant.difficulty?.overall}`),
        )
      } else if (split2Progressions.length > 0) {
        pass(checks, `progression_difficulty_${phaseKey}`, `${phaseKey}: progressions increase difficulty`)
      }
    }

    if (thresholds.progressionMustSharePatternOrFamily && split2Progressions.length > 0) {
      const badLane = split2Progressions.filter(({ item, variant }) => {
        return !sharesPatternOrFamily(item.exercise_id, variant.exercise_id, tagMap, exerciseById)
      })
      if (badLane.length > 0) {
        fail(
          checks,
          `progression_lane_${phaseKey}`,
          `${phaseKey}: Split 2 progressions must share pattern or movement family with primary`,
          badLane.slice(0, 8).map(({ item, variant }) => `${item.exercise_name} → ${variant.exercise_name}`),
        )
      } else {
        pass(checks, `progression_lane_${phaseKey}`, `${phaseKey}: progressions share lane with primaries`)
      }
    }

    const forbidden = thresholds.forbidProgressionNameSubstrings ?? []
    if (forbidden.length > 0) {
      const badNames = split2Progressions.filter(({ variant }) => {
        const name = String(variant.exercise_name ?? '').toLowerCase()
        return forbidden.some((sub) => name.includes(String(sub).toLowerCase()))
      })
      if (badNames.length > 0) {
        fail(checks, `progression_forbidden_${phaseKey}`, `${phaseKey}: forbidden progression name matched`, badNames.map(({ item, variant }) => `${item.exercise_name} → ${variant.exercise_name}`))
      }
    }
  }

  if (thresholds.minSplit2ProgressionCount != null && !thresholds.minSplit2ProgressionCountByPhase) {
    if (totalSplit2Progressions < thresholds.minSplit2ProgressionCount) {
      fail(checks, 'split2_has_progressions', `Expected ≥${thresholds.minSplit2ProgressionCount} Split 2 progressions total; got ${totalSplit2Progressions}`)
    } else {
      pass(checks, 'split2_has_progressions', `Split 2 progressions total: ${totalSplit2Progressions}`)
    }
  }

  const ageWarnings = result.age_fit_warnings ?? []
  if (ageWarnings.length > (thresholds.maxAgeFitWarnings ?? 99)) {
    fail(checks, 'session_age_fit_warnings', `Too many age-fit warnings (${ageWarnings.length}; max ${thresholds.maxAgeFitWarnings})`, ageWarnings.slice(0, 8))
  } else {
    pass(checks, 'session_age_fit_warnings', `Age-fit warnings: ${ageWarnings.length}`)
  }

  const splitWarnings = result.split_variant_warnings ?? []
  if (splitWarnings.length > (thresholds.maxSplitVariantWarnings ?? 99)) {
    fail(checks, 'split_variant_warnings', `Too many split variant warnings (${splitWarnings.length}; max ${thresholds.maxSplitVariantWarnings})`, splitWarnings.slice(0, 5))
  } else {
    pass(checks, 'split_variant_warnings', `Split variant warnings: ${splitWarnings.length}`)
  }

  const emptyPhases = (result.constraint_report?.empty_phase_reasons ?? []).filter((r) => /pool_empty|no exercises/i.test(r))
  if (emptyPhases.length > 0) {
    fail(checks, 'no_empty_phases', 'No phase may report pool_empty', emptyPhases)
  } else {
    pass(checks, 'no_empty_phases', 'No pool_empty phase reasons')
  }

  if (context.expectedBody) {
    evaluateCategory1Structure(result, context.expectedBody, checks)
    evaluateCategory1MoeInfo(result, context.expectedBody, checks)
    const kpiCheck = computeCategory1Kpi(checks, { minRate: thresholds.category1KpiMinRate ?? 0.95 })
    checks.push(kpiCheck)
    context.evalInfraOk = context.evalInfraOk !== false
    runCategoryEvaluators(result, context.expectedBody, checks, { ...context, expectedBody: context.expectedBody, thresholds })
  }

  const failed = checks.filter((c) => !c.ok)
  const p0Failed = failed.filter((c) => c.severity === 'P0')
  return {
    checks,
    passed: checks.filter((c) => c.ok).length,
    failed,
    p0Failed,
    ok: failed.length === 0,
  }
}
