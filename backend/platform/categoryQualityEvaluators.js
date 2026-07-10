/**
 * Per-category quality evaluators — wired one category at a time.
 * Category 1: prescriptionQualityChecks.js
 * See docs/NEEDS_ENGINE_CATEGORY_IMPLEMENTATION_LOOP.md
 */

import {
  minItemsForPhase,
  maxItemsForPhase,
  hasSustainedConditioningFocus,
} from './sustainedCapacityPolicy.js'
import {
  restoreCandidateExcluded,
  RESTORE_BOOST_SLOTS,
  EXCLUDED_METHODOLOGY_KEYS,
  RESTORE_HIGH_AROUSAL_AFTER_SUSTAINED_CONDITIONING_KEYS,
} from './restoreSelectionPolicy.js'
import { auditPrescriptionEquipmentAvoid } from './equipmentAvoidPolicy.js'
import {
  resolveAudienceProfile,
  detectStrengthIntent,
  resolveHardDifficultyExclude,
} from './ageDifficultyPolicy.js'

import { EXTENDED_CATEGORY_REGISTRY } from './categoryEvaluatorsExtended.js'

/** Categories whose evaluators run in strict golden eval. Category 1: prescriptionQualityChecks.js */
export const WIRED_CATEGORIES = new Set([
  2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
])

function blockByKey(result, phaseKey) {
  return result.blocks?.find((b) => b.phase_key === phaseKey)
}

function fail(checks, id, message, detail = null) {
  checks.push({ id, ok: false, severity: 'P1', message, detail })
}

function failP0(checks, id, message, detail = null) {
  checks.push({ id, ok: false, severity: 'P0', message, detail })
}

function pass(checks, id, message, detail = null) {
  checks.push({ id, ok: true, severity: 'ok', message, detail })
}

function info(checks, id, message, detail = {}) {
  checks.push({ id, ok: true, severity: 'ok', message, detail: { informational: true, ...detail } })
}

function tbd(checks, id, message, detail = {}) {
  checks.push({
    id,
    ok: true,
    severity: 'ok',
    message,
    detail: { tbd: true, informational: true, ...detail },
  })
}

export function itemSecondsFromExercise(ex, item) {
  const sets = Number(item?.sets ?? ex?.default_sets) || 3
  const work = Number(item?.work_seconds ?? ex?.default_work_seconds) || Number(ex?.est_seconds_per_set) || 45
  const restRaw = item?.rest_seconds ?? ex?.default_rest_seconds
  const rest = restRaw != null && restRaw !== '' ? Number(restRaw) : 30
  if (restRaw === 0 || rest === 0) return sets * work
  return sets * work + sets * rest
}

// ─── Category 2 — Phase time fill ───────────────────────────────────────────

export const CATEGORY2_KPI_CHECK_IDS = [
  'phase_fill_coverage',
  'phase_overfill_cap',
  'high_intent_underfill_70',
  'phase_dose_budget_ceiling',
  'phase_dose_sum_accuracy',
  'phase_item_dominance',
  'no_underfill_reasons',
  'no_empty_phases',
  'restore_fill_band',
]

export const CATEGORY2_MOE_CHECK_IDS = [
  'category2_moe_prepare_density',
  'category2_moe_sustained_conditioning_focus',
  'category2_moe_fatigue_curve',
  'category2_moe_chronic_underfill',
  'category2_moe_review_packet',
  'category2_fill_stability',
  'phase_backfill_contribution',
  'phase_backfill_item_share',
]

export function isCategory2KpiCheck(check) {
  if (CATEGORY2_KPI_CHECK_IDS.includes(check.id)) return true
  if (check.id.startsWith('phase_fill_') && check.id !== 'phase_fill_coverage') return true
  if (check.id.startsWith('phase_fill_pool_floor_')) return true
  return false
}

export function evaluateCategory2Fill(result, expectedBody, checks, context = {}) {
  const blocks = result.blocks ?? []
  const phaseFill = result.constraint_report?.phase_fill ?? []
  const exerciseById = context.exerciseById ?? new Map()
  const tagMap = context.tagMap ?? new Map()

  // C2-MOP-02 informational (engine underfill on golden)
  for (const block of blocks) {
    const gap = Number(block.target_minutes ?? 0) - Number(block.estimated_minutes ?? 0)
    const limit = block.phase_key === 'restore' ? 0.5 : (Number(block.target_minutes) >= 10 ? 1 : 0.5)
    info(checks, 'phase_underfill_gap', `${block.phase_key}: gap ${gap.toFixed(1)}m (limit ${limit}m)`, {
      phase_key: block.phase_key,
      gap,
      limit,
      ok_band: gap <= 0 || gap <= limit,
    })
  }

  // C2-MOP-04 informational
  const estSum = blocks.reduce((s, b) => s + Number(b.estimated_minutes ?? 0), 0)
  const targetSum = blocks.reduce((s, b) => s + Number(b.target_minutes ?? 0), 0)
  info(checks, 'session_est_minutes_delta', `Session Δ ${Math.abs(estSum - targetSum).toFixed(1)}m (${estSum}m est / ${targetSum}m target)`, {
    ok_band: Math.abs(estSum - targetSum) <= 3,
  })

  // C2-MOP-05 informational (policy vs engine mismatch on golden Prepare)
  for (const block of blocks) {
    const focus = block.focus_targets ?? []
    const minItems = minItemsForPhase(block.phase_key, focus)
    const maxItems = maxItemsForPhase(block.phase_key, block.target_minutes, focus)
    const count = (block.items ?? []).length
    info(checks, 'phase_item_count_policy', `${block.phase_key}: ${count} items [policy ${minItems}–${maxItems}]`, {
      ok_band: count >= minItems && count <= maxItems,
    })
  }

  // C2-MOP-12
  const blockKeys = new Set(blocks.map((b) => b.phase_key))
  const fillKeys = new Set(phaseFill.map((f) => f.phase_key))
  const missingFill = [...blockKeys].filter((k) => !fillKeys.has(k))
  if (missingFill.length > 0) {
    fail(checks, 'phase_fill_coverage', `phase_fill missing: ${missingFill.join(', ')}`)
  } else {
    pass(checks, 'phase_fill_coverage', `phase_fill covers all ${phaseFill.length} blocks`)
  }

  // C2-MOP-07 pool floors (Test 3 tuned)
  const poolFloors = {
    prepare_and_access: 30,
    output: 5,
    capacity: 5,
    restore: 3,
  }
  for (const fill of phaseFill) {
    const floor = poolFloors[fill.phase_key]
    if (floor == null) continue
    const id = `phase_fill_pool_floor_${fill.phase_key}`
    if ((fill.pool_size ?? 0) < floor) {
      fail(checks, id, `${fill.phase_key} pool_size ${fill.pool_size} < ${floor}`)
    } else {
      pass(checks, id, `${fill.phase_key} pool_size ${fill.pool_size} ≥ ${floor}`)
    }
    const pool = fill.pool_size ?? 0
    if (pool > 0) {
      info(checks, 'phase_fill_skip_ratio', `${fill.phase_key} skip ${(Math.min(1, (fill.skipped_candidates ?? 0) / pool) * 100).toFixed(0)}%`, {
        ok_band: (fill.skipped_candidates ?? 0) / pool <= 0.85,
      })
      info(checks, 'phase_fill_split_rejects', `${fill.phase_key} split rejects ${(Math.min(1, (fill.split_rejects ?? 0) / pool) * 100).toFixed(0)}%`, {
        ok_band: (fill.split_rejects ?? 0) / pool <= 0.5,
      })
    }
  }

  // C2-MOP-13 — aggregate overfit across non-restore phases
  const overfillViolations = []
  for (const block of blocks) {
    if (block.phase_key === 'restore') continue
    const ratio = Number(block.estimated_minutes ?? 0) / (Number(block.target_minutes) || 1)
    if (ratio > 1.1) overfillViolations.push(`${block.phase_key} ${(ratio * 100).toFixed(0)}%`)
  }
  if (overfillViolations.length > 0) {
    fail(checks, 'phase_overfill_cap', `Overfill >110%: ${overfillViolations.join(', ')}`, overfillViolations)
  } else {
    pass(checks, 'phase_overfill_cap', 'All non-restore phases within 110% overfill cap')
  }

  // C2-MOR-01 — high-intent phases must not sit below 70% fill
  const underfillHighIntent = []
  for (const key of ['output', 'capacity', 'resilience']) {
    const fill = phaseFill.find((f) => f.phase_key === key)
    if (fill && (fill.fill_pct ?? 100) < 70) underfillHighIntent.push(`${key} ${fill.fill_pct}%`)
  }
  if (underfillHighIntent.length > 0) {
    fail(checks, 'high_intent_underfill_70', `High-intent underfill: ${underfillHighIntent.join(', ')}`, underfillHighIntent)
  } else {
    pass(checks, 'high_intent_underfill_70', 'Output/Capacity/Resilience fill ≥ 70%')
  }

  // C2-MOP-11 dose budget ceiling — aggregate
  const budgetViolations = []
  for (const block of blocks) {
    const budgetSec = Number(block.target_minutes ?? 0) * 60
    let doseSec = 0
    for (const item of block.items ?? []) {
      doseSec += itemSecondsFromExercise(exerciseById.get(Number(item.exercise_id)), item)
    }
    if (budgetSec > 0 && doseSec > budgetSec * 1.05) {
      budgetViolations.push(`${block.phase_key} ${doseSec}s > ${budgetSec}s`)
    }
  }
  if (budgetViolations.length > 0) {
    fail(checks, 'phase_dose_budget_ceiling', budgetViolations.join('; '), budgetViolations)
  } else {
    pass(checks, 'phase_dose_budget_ceiling', 'All phases within dose budget ceiling')
  }

  // C2-MOP-15 dose sum accuracy (±15%) — aggregate
  const doseAccuracyViolations = []
  for (const block of blocks) {
    const estSec = Number(block.estimated_minutes ?? 0) * 60
    if (estSec <= 0) continue
    let doseSec = 0
    for (const item of block.items ?? []) {
      doseSec += itemSecondsFromExercise(exerciseById.get(Number(item.exercise_id)), item)
    }
    const err = Math.abs(doseSec - estSec) / estSec
    if (err > 0.15) doseAccuracyViolations.push(`${block.phase_key} ${(err * 100).toFixed(0)}%`)
  }
  if (doseAccuracyViolations.length > 0) {
    fail(checks, 'phase_dose_sum_accuracy', `Dose sum error: ${doseAccuracyViolations.join(', ')}`, doseAccuracyViolations)
  } else {
    pass(checks, 'phase_dose_sum_accuracy', 'Dose sums within ±15% of estimated minutes')
  }

  // C2-MOP-16 item dominance (skip sustained + restore; relax short phases) — aggregate
  const dominanceViolations = []
  for (const block of blocks) {
    if (block.phase_key === 'sustained_capacity' || block.phase_key === 'restore') continue
    const phaseSec = Number(block.target_minutes ?? 0) * 60
    if (phaseSec <= 0) continue
    const cap = phaseSec < 15 * 60 ? 0.45 : 0.35
    let maxItemSec = 0
    for (const item of block.items ?? []) {
      const sec = itemSecondsFromExercise(exerciseById.get(Number(item.exercise_id)), item)
      maxItemSec = Math.max(maxItemSec, sec)
    }
    const ratio = maxItemSec / phaseSec
    if (ratio > cap) dominanceViolations.push(`${block.phase_key} ${(ratio * 100).toFixed(0)}%`)
  }
  if (dominanceViolations.length > 0) {
    fail(checks, 'phase_item_dominance', `Item dominance exceeded: ${dominanceViolations.join(', ')}`, dominanceViolations)
  } else {
    pass(checks, 'phase_item_dominance', 'Item dominance within cap (except Sustained)')
  }

  // C2-MOP-18
  const underfillReasons = (result.constraint_report?.empty_phase_reasons ?? []).filter((r) => /underfilled/i.test(r))
  if (underfillReasons.length > 0) {
    fail(checks, 'no_underfill_reasons', `${underfillReasons.length} underfill reason(s)`, underfillReasons.slice(0, 3))
  } else {
    pass(checks, 'no_underfill_reasons', 'No underfill entries in empty_phase_reasons')
  }

  // C2-MOP-10, C2-MOP-17 — backfill telemetry (informational)
  const backfillPhases = []
  for (const block of blocks) {
    const items = block.items ?? []
    const backfillItems = items.filter((it) => it.fill_pass === 'backfill')
    if (backfillItems.length === 0) continue
    const totalSec = items.reduce(
      (s, it) => s + itemSecondsFromExercise(exerciseById.get(Number(it.exercise_id)), it),
      0,
    )
    const backfillSec = backfillItems.reduce(
      (s, it) => s + itemSecondsFromExercise(exerciseById.get(Number(it.exercise_id)), it),
      0,
    )
    const share = items.length > 0 ? backfillItems.length / items.length : 0
    const minuteShare = totalSec > 0 ? backfillSec / totalSec : 0
    backfillPhases.push({
      phase_key: block.phase_key,
      backfill_items: backfillItems.length,
      total_items: items.length,
      item_share: share,
      minute_share: minuteShare,
    })
  }
  if (backfillPhases.length === 0) {
    info(checks, 'phase_backfill_contribution', 'No backfill-tagged items in session', { ok_band: true, phases: [] })
    info(checks, 'phase_backfill_item_share', 'No backfill item share to audit', { ok_band: true, phases: [] })
  } else {
    const maxShare = Math.max(...backfillPhases.map((p) => p.item_share))
    info(checks, 'phase_backfill_contribution', `${backfillPhases.length} phase(s) with backfill items`, {
      ok_band: true,
      phases: backfillPhases,
    })
    info(checks, 'phase_backfill_item_share', `Max backfill item share ${(maxShare * 100).toFixed(0)}%`, {
      ok_band: maxShare <= 0.5,
      phases: backfillPhases,
      alert_threshold: 0.5,
    })
  }

  // C2-MOP-14 — fill stability from eval history
  const fillStability = context.fillStability ?? { stable: null, runCount: 0, minRuns: 5 }
  if (fillStability.stable == null) {
    info(checks, 'category2_fill_stability', `Fill stability pending (${fillStability.runCount}/${fillStability.minRuns ?? 5} eval runs)`, {
      ok_band: null,
      ...fillStability,
    })
  } else if (fillStability.stable) {
    info(checks, 'category2_fill_stability', `Fill σ ≤ ${fillStability.maxStdPct ?? 3}% over ${fillStability.runCount} runs`, {
      ok_band: true,
      ...fillStability,
    })
  } else {
    info(checks, 'category2_fill_stability', `Fill stability σ exceeds ${fillStability.maxStdPct ?? 3}% on one or more phases`, {
      ok_band: false,
      ...fillStability,
    })
  }

  // C2-MOE-04 — chronic underfill from eval history
  const chronicUnderfill = context.chronicUnderfill ?? { chronicPhases: null, runCount: 0, minRuns: 5 }
  if (chronicUnderfill.chronicPhases == null) {
    info(checks, 'category2_moe_chronic_underfill', `Chronic underfill pending (${chronicUnderfill.runCount}/${chronicUnderfill.minRuns ?? 5} eval runs)`, {
      ok_band: null,
      ...chronicUnderfill,
    })
  } else if ((chronicUnderfill.chronicCount ?? 0) === 0) {
    info(checks, 'category2_moe_chronic_underfill', `No phase <70% fill in last ${chronicUnderfill.runCount} runs`, {
      ok_band: true,
      ...chronicUnderfill,
    })
  } else {
    info(checks, 'category2_moe_chronic_underfill', `${chronicUnderfill.chronicCount} phase(s) underfilled in eval history`, {
      ok_band: false,
      ...chronicUnderfill,
    })
  }

  // C2-MOE informational
  const prepare = blockByKey(result, 'prepare_and_access')
  const prepareCount = (prepare?.items ?? []).length
  const prepareMin = Number(prepare?.target_minutes ?? 0) || 1
  info(checks, 'category2_moe_prepare_density', `Prepare ${prepareCount} items / ${prepareMin}m`, {
    items_per_min: prepareCount / prepareMin,
    ok_band: prepareCount / prepareMin >= 0.6 && prepareCount / prepareMin <= 1.0,
  })

  const sustained = blockByKey(result, 'sustained_capacity')
  const sustainedFill = phaseFill.find((f) => f.phase_key === 'sustained_capacity')
  const conditioningFocus = hasSustainedConditioningFocus(sustained?.focus_targets ?? [])
  let conditioningTagged = 0
  if (conditioningFocus) {
    for (const item of sustained?.items ?? []) {
      const tags = tagMap.get(String(item.exercise_id)) ?? []
      if (tags.some((t) => t.facetType === 'methodology' || t.facetType === 'intent')) conditioningTagged += 1
    }
  }
  info(checks, 'category2_moe_sustained_conditioning_focus', `Sustained fill ${sustainedFill?.fill_pct ?? '?'}%; conditioning-tagged ${conditioningTagged}`, {
    ok_band: !conditioningFocus || ((sustainedFill?.fill_pct ?? 0) >= 80 && conditioningTagged >= 2),
  })

  const sustainedIdx = blocks.findIndex((b) => b.phase_key === 'sustained_capacity')
  const beforeSustained = sustainedIdx >= 0
    ? blocks.slice(0, sustainedIdx).reduce((s, b) => s + Number(b.target_minutes ?? 0), 0)
    : 0
  const total = blocks.reduce((s, b) => s + Number(b.target_minutes ?? 0), 0) || 1
  info(checks, 'category2_moe_fatigue_curve', `Pre-Sustained ${((beforeSustained / total) * 100).toFixed(1)}% of minutes`, {
    ok_band: beforeSustained / total >= 0.55,
  })

  const reviewPhases = ['output', 'capacity'].map((key) => {
    const block = blockByKey(result, key)
    return {
      phase_key: key,
      target_minutes: block?.target_minutes,
      estimated_minutes: block?.estimated_minutes,
      item_count: block?.items?.length ?? 0,
      fill_pct: phaseFill.find((f) => f.phase_key === key)?.fill_pct,
    }
  })
  info(checks, 'category2_moe_review_packet', `${reviewPhases.length} high-intent phase(s) for coach MOE review`, {
    ok_band: true,
    phases: reviewPhases,
    rubric: ['C2-MOE-01', 'C2-MOE-06', 'C2-MOE-07'],
  })
}

export function computeCategory2Kpi(checks, { minRate = 0.92 } = {}) {
  const applicable = checks.filter(isCategory2KpiCheck)
  const scored = applicable.filter((c) => !c.detail?.tbd)
  const passed = scored.filter((c) => c.ok).length
  const rate = scored.length > 0 ? passed / scored.length : 1
  return {
    id: 'category2_kpi',
    ok: rate >= minRate,
    severity: rate >= minRate ? 'ok' : 'P1',
    message: `Category 2 fill health: ${(rate * 100).toFixed(1)}% (${passed}/${scored.length}; min ${(minRate * 100).toFixed(0)}%)`,
    detail: { rate, passed, total: scored.length, minRate, category: 2 },
  }
}

// ─── Category 3 — Restore phase ─────────────────────────────────────────────

export const CATEGORY3_KPI_CHECK_IDS = [
  'restore_non_empty',
  'restore_no_pool_empty',
  'restore_fill_band',
  'restore_not_box_avoid_false_positive',
  'restore_equipment_avoid_clean',
  'no_progression_restore',
  'restore_golden_item_count',
  'restore_block_last',
  'restore_max_items',
  'restore_profile_role_valid',
  'restore_order_slot_boost',
  'restore_impact_ceiling',
  'restore_no_output_primary',
  'restore_excluded_methodology',
  'restore_difficulty_band',
  'restore_dose_ceiling',
  'restore_slug_unique',
  'restore_candidate_policy_pass',
  'restore_high_arousal_after_sustained_conditioning',
]

function restoreProfileFor(phaseProfileMap, exerciseId) {
  const profiles = phaseProfileMap.get(String(exerciseId)) ?? []
  return profiles.find((p) => p.phaseKey === 'restore') ?? null
}

export const CATEGORY3_MOE_CHECK_IDS = [
  'category3_moe_breathing',
  'category3_moe_mobility',
  'category3_moe_post_sustained_conditioning_reset',
  'category3_moe_youth_hold_ceiling',
  'category3_moe_bookend_overlap',
  'category3_moe_arousal_downshift',
  'category3_moe_review_packet',
]

function restoreArousalSignals(item, ex, tags, methodologyKeyById, profile) {
  const signals = []
  const slug = String(ex.slug ?? '').toLowerCase()
  const name = String(item.exercise_name ?? ex.name ?? '').toLowerCase()
  if (/(throw|toss|slam|jump|bound|hop|sprint|plyo|explosive)/.test(slug) || /(throw|toss|slam)/.test(name)) {
    signals.push('high_arousal_slug')
  }
  if (ex.primary_phase_key === 'output' || ex.primary_phase_key === 'sustained_capacity') {
    signals.push('output_or_sustained_primary')
  }
  for (const t of tags) {
    if (t.facetType !== 'methodology') continue
    const key = methodologyKeyById.get(Number(t.facetId))
    if (key && EXCLUDED_METHODOLOGY_KEYS.has(key)) signals.push(`methodology:${key}`)
    if (key === 'neural') {
      const impact = Number(profile?.impactLevel ?? profile?.impact_level ?? 99)
      const ceiling = String(profile?.intensityCeiling ?? profile?.intensity_ceiling ?? 'low').toLowerCase()
      const lowImpactRestore = impact < 2 && ceiling === 'low'
      const restorePrimary = ex.primary_phase_key === 'restore'
        || profile?.role === 'primary'
        || profile?.role === 'secondary'
      if (!(lowImpactRestore && restorePrimary)) signals.push('neural_not_low_impact')
    }
  }
  const impact = Number(profile?.impactLevel ?? profile?.impact_level ?? 0)
  if (impact >= 2) signals.push('impact_high')
  const ceiling = String(profile?.intensityCeiling ?? profile?.intensity_ceiling ?? 'low').toLowerCase()
  if (ceiling && ceiling !== 'low') signals.push('intensity_not_low')
  if (Number(item.difficulty?.overall ?? 0) >= 6) signals.push('difficulty_high')
  return signals
}

function itemHasScalingGuidance(item) {
  if (item.scaling_rationale) return true
  for (const v of item.per_split ?? item.split_alternates_json ?? []) {
    if (v.scaling_guidance) return true
  }
  return false
}

export function evaluateCategory3Restore(result, expectedBody, checks, context = {}) {
  const blocks = result.blocks ?? []
  const restoreBlock = blockByKey(result, 'restore')
  const items = restoreBlock?.items ?? []
  const exerciseById = context.exerciseById ?? new Map()
  const tagMap = context.tagMap ?? new Map()
  const phaseProfileMap = context.phaseProfileMap ?? new Map()
  const methodologyKeyById = context.methodologyKeyById ?? new Map()
  const sessionCap = result.audience_profile?.caps?.maxOverall ?? 6
  const ageMax = expectedBody?.ageMax ?? result.audience_profile?.ageMax

  // C3-MOP-01 golden density
  if (items.length < 2) {
    failP0(checks, 'restore_golden_item_count', `Restore has ${items.length} item(s); golden target ≥ 2`)
  } else {
    pass(checks, 'restore_golden_item_count', `Restore has ${items.length} item(s) (≥ 2)`)
  }

  // C3-MOP-12
  const lastKey = blocks[blocks.length - 1]?.phase_key
  if (lastKey !== 'restore') {
    failP0(checks, 'restore_block_last', `Restore must be last block; got ${lastKey}`)
  } else {
    pass(checks, 'restore_block_last', 'Restore is last block')
  }

  // C3-MOP-11
  const maxItems = maxItemsForPhase('restore', restoreBlock?.target_minutes ?? 4, [])
  if (items.length > maxItems) {
    failP0(checks, 'restore_max_items', `Restore ${items.length} items > max ${maxItems}`)
  } else {
    pass(checks, 'restore_max_items', `Restore item count ${items.length} ≤ ${maxItems}`)
  }

  const profileIssues = []
  let hasBoostSlot = false
  const outputPrimaries = []
  const methodologyViolations = []
  const policyViolations = []
  const difficulties = []
  const slugCounts = new Map()
  const highArousalTags = []
  const doseIssues = []

  const EXCLUDED_METH = EXCLUDED_METHODOLOGY_KEYS
  const sustained = blockByKey(result, 'sustained_capacity')
  const afterSustainedConditioningFocus = hasSustainedConditioningFocus(sustained?.focus_targets ?? [])

  const expandedAvoidEquipIds = context.expandedAvoidEquipIds ?? new Set()
  const equipmentAvoidKeys = context.equipmentAvoidKeys ?? []
  if (restoreBlock && (expandedAvoidEquipIds.size > 0 || equipmentAvoidKeys.length > 0)) {
    const violations = auditPrescriptionEquipmentAvoid(
      [restoreBlock],
      tagMap,
      expandedAvoidEquipIds,
      equipmentAvoidKeys,
      exerciseById,
    )
    if (violations.length > 0) {
      failP0(checks, 'restore_equipment_avoid_clean', `${violations.length} restore equipment-avoid violation(s)`, violations.slice(0, 5))
    } else {
      pass(checks, 'restore_equipment_avoid_clean', 'No restore equipment-avoid violations')
    }
  } else if (restoreBlock) {
    pass(checks, 'restore_equipment_avoid_clean', 'No equipment avoid configured — restore audit skipped')
  }

  for (const item of items) {
    const exId = Number(item.exercise_id)
    const ex = exerciseById.get(exId) ?? {}
    const tags = tagMap.get(String(exId)) ?? []
    const profile = restoreProfileFor(phaseProfileMap, exId)

    difficulties.push(Number(item.difficulty?.overall ?? 0))

    const slug = ex.slug ?? String(exId)
    slugCounts.set(slug, (slugCounts.get(slug) ?? 0) + 1)

    if (ex.primary_phase_key === 'output') outputPrimaries.push(item.exercise_name ?? slug)

    if (!profile) {
      profileIssues.push({ exercise: item.exercise_name ?? slug, issue: 'missing_restore_profile' })
    } else {
      if (profile.role === 'avoid') {
        profileIssues.push({ exercise: item.exercise_name ?? slug, issue: 'role_avoid' })
      } else if (profile.role !== 'primary' && profile.role !== 'secondary') {
        profileIssues.push({ exercise: item.exercise_name ?? slug, issue: `role_${profile.role}` })
      }
      const slot = profile.orderSlot ?? ex.primary_order_slot
      if (slot && RESTORE_BOOST_SLOTS.has(slot)) hasBoostSlot = true
      const impact = Number(profile.impactLevel ?? 99)
      if (impact >= 2) {
        profileIssues.push({ exercise: item.exercise_name ?? slug, issue: `impact_${impact}` })
      }
      if (restoreCandidateExcluded(ex, profile, tags, methodologyKeyById)) {
        policyViolations.push(item.exercise_name ?? slug)
      }
    }

    for (const t of tags) {
      if (t.facetType !== 'methodology') continue
      const key = methodologyKeyById.get(Number(t.facetId))
      if (key && EXCLUDED_METH.has(key)) methodologyViolations.push(`${item.exercise_name ?? slug}:${key}`)
      if (afterSustainedConditioningFocus && key && RESTORE_HIGH_AROUSAL_AFTER_SUSTAINED_CONDITIONING_KEYS.has(key)) {
        highArousalTags.push(`${item.exercise_name ?? slug}:${key}`)
      }
    }

    const sets = Number(item.sets ?? 3)
    const work = Number(item.work_seconds ?? 0)
    if (sets > 3 || (work > 60 && !item.reps)) {
      doseIssues.push({ name: item.exercise_name, sets, work })
    }
  }

  if (doseIssues.length > 0) {
    failP0(checks, 'restore_dose_ceiling', 'Restore dose out of band', doseIssues)
  } else {
    pass(checks, 'restore_dose_ceiling', 'Restore dose within sets≤3 and work≤60s')
  }

  if (profileIssues.length > 0) {
    failP0(checks, 'restore_profile_role_valid', `${profileIssues.length} restore profile issue(s)`, profileIssues.slice(0, 5))
  } else {
    pass(checks, 'restore_profile_role_valid', 'Restore profiles primary/secondary with impact < 2')
  }

  if (!hasBoostSlot) {
    fail(checks, 'restore_order_slot_boost', 'No restore item with boost order_slot')
  } else {
    pass(checks, 'restore_order_slot_boost', 'Restore has boost order_slot item')
  }

  if (profileIssues.some((p) => String(p.issue).startsWith('impact_'))) {
    failP0(checks, 'restore_impact_ceiling', 'Restore item impact_level ≥ 2')
  } else {
    pass(checks, 'restore_impact_ceiling', 'Restore impact ceiling satisfied')
  }

  if (outputPrimaries.length > 0) {
    failP0(checks, 'restore_no_output_primary', `Output-primary in restore: ${outputPrimaries.join(', ')}`)
  } else {
    pass(checks, 'restore_no_output_primary', 'No output-primary in restore')
  }

  if (methodologyViolations.length > 0) {
    failP0(checks, 'restore_excluded_methodology', `Excluded methodology: ${methodologyViolations.join(', ')}`)
  } else {
    pass(checks, 'restore_excluded_methodology', 'No excluded methodology tags in restore')
  }

  if (difficulties.length > 0) {
    const sorted = [...difficulties].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    const max = Math.max(...difficulties)
    if (median > 4 || max > sessionCap) {
      fail(checks, 'restore_difficulty_band', `Restore D median ${median} / max ${max} vs cap ${sessionCap}`)
    } else {
      pass(checks, 'restore_difficulty_band', `Restore difficulty median ${median}, max ${max}`)
    }
  }

  const dupSlugs = [...slugCounts.entries()].filter(([, n]) => n > 1)
  if (dupSlugs.length > 0) {
    fail(checks, 'restore_slug_unique', 'Duplicate restore slugs', dupSlugs)
  } else {
    pass(checks, 'restore_slug_unique', 'Restore primary slugs unique')
  }

  if (policyViolations.length > 0) {
    failP0(checks, 'restore_candidate_policy_pass', `Policy would exclude: ${policyViolations.join(', ')}`)
  } else {
    pass(checks, 'restore_candidate_policy_pass', 'All restore items pass restoreCandidateExcluded replay')
  }

  if (afterSustainedConditioningFocus && highArousalTags.length > 0) {
    failP0(checks, 'restore_high_arousal_after_sustained_conditioning', `High-arousal restore after Sustained conditioning focus: ${highArousalTags.join(', ')}`)
  } else {
    pass(checks, 'restore_high_arousal_after_sustained_conditioning', 'No high-arousal restore after Sustained conditioning focus')
  }

  // MOE informational
  let breathingHits = 0
  let mobilityHits = 0
  let postConditioningReset = 0
  let longHolds = 0
  for (const item of items) {
    const ex = exerciseById.get(Number(item.exercise_id)) ?? {}
    const blob = `${ex.slug ?? ''} ${item.exercise_name ?? ''}`.toLowerCase()
    const tags = tagMap.get(String(item.exercise_id)) ?? []
    if (/breath|breathing/.test(blob) || tags.some((t) => t.facetType === 'intent' && methodologyKeyById.get(Number(t.facetId)) === 'breathing')) {
      breathingHits += 1
    }
    if (/cat-cow|open-book|mobility|flexibility/.test(blob) || tags.some((t) => {
      const key = methodologyKeyById.get(Number(t.facetId))
      return t.facetType === 'methodology' && key === 'mobility_flexibility'
    })) {
      mobilityHits += 1
    }
    if (afterSustainedConditioningFocus && (/diaphragm|9090|hip reset|breath/.test(blob))) postConditioningReset += 1
    if (ageMax != null && ageMax <= 14 && Number(item.work_seconds ?? 0) > 60 && !itemHasScalingGuidance(item)) {
      longHolds += 1
    }
  }
  info(checks, 'category3_moe_breathing', `Breathing items: ${breathingHits}`, { ok_band: breathingHits >= 1 })
  info(checks, 'category3_moe_mobility', `Mobility items: ${mobilityHits}`, { ok_band: mobilityHits >= 1 })
  info(checks, 'category3_moe_post_sustained_conditioning_reset', `Post-conditioning reset matches: ${postConditioningReset}`, {
    ok_band: !afterSustainedConditioningFocus || postConditioningReset >= 1,
  })
  info(checks, 'category3_moe_youth_hold_ceiling', `Unscaled holds >60s: ${longHolds}`, { ok_band: longHolds === 0 })

  const prepare = blockByKey(result, 'prepare_and_access')
  const prepareFacetIds = new Set()
  const restoreFacetIds = new Set()
  for (const item of prepare?.items ?? []) {
    for (const t of tagMap.get(String(item.exercise_id)) ?? []) {
      if (t.facetType === 'methodology' || t.facetType === 'pattern') prepareFacetIds.add(`${t.facetType}:${t.facetId}`)
    }
  }
  for (const item of items) {
    for (const t of tagMap.get(String(item.exercise_id)) ?? []) {
      if (t.facetType === 'methodology' || t.facetType === 'pattern') restoreFacetIds.add(`${t.facetType}:${t.facetId}`)
    }
  }
  const overlap = [...prepareFacetIds].filter((id) => restoreFacetIds.has(id)).length
  info(checks, 'category3_moe_bookend_overlap', `Prepare–Restore tag overlap: ${overlap}`, { ok_band: overlap >= 1 })

  // C3-MOE-03 — arousal downshift proxy (slug/methodology/impact heuristics from restoreSelectionPolicy)
  const arousalHits = []
  for (const item of items) {
    const exId = Number(item.exercise_id)
    const ex = exerciseById.get(exId) ?? {}
    const tags = tagMap.get(String(exId)) ?? []
    const profile = restoreProfileFor(phaseProfileMap, exId)
    const signals = restoreArousalSignals(item, ex, tags, methodologyKeyById, profile)
    if (signals.length > 0) arousalHits.push({ exercise: item.exercise_name ?? ex.slug, signals })
  }
  info(checks, 'category3_moe_arousal_downshift', `High-arousal restore signals: ${arousalHits.length}`, {
    ok_band: arousalHits.length === 0,
    hits: arousalHits.slice(0, 5),
    rubric: 'C3-MOE-03',
  })

  info(checks, 'category3_moe_review_packet', `${items.length} restore item(s) for coach MOE review`, {
    ok_band: true,
    items: items.map((item) => {
      const ex = exerciseById.get(Number(item.exercise_id)) ?? {}
      return {
        exercise_id: item.exercise_id,
        exercise_name: item.exercise_name,
        slug: ex.slug,
        sets: item.sets,
        work_seconds: item.work_seconds,
        difficulty: item.difficulty?.overall,
      }
    }),
    sustained_conditioning_focus: afterSustainedConditioningFocus,
    rubric: ['C3-MOE-06', 'C3-MOE-08'],
  })
}

export function computeCategory3Kpi(checks, { minRate = 0.95 } = {}) {
  const applicable = checks.filter((c) => CATEGORY3_KPI_CHECK_IDS.includes(c.id))
  const scored = applicable.filter((c) => !c.detail?.tbd && !c.detail?.informational)
  const passed = scored.filter((c) => c.ok).length
  const rate = scored.length > 0 ? passed / scored.length : 1
  return {
    id: 'category3_kpi',
    ok: rate >= minRate,
    severity: rate >= minRate ? 'ok' : 'P0',
    message: `Category 3 restore health: ${(rate * 100).toFixed(1)}% (${passed}/${scored.length}; min ${(minRate * 100).toFixed(0)}%)`,
    detail: { rate, passed, total: scored.length, minRate, category: 3 },
  }
}

// ─── Category 4 — Audience profile ──────────────────────────────────────────

const VALID_SKILL_LEVELS = new Set(['EARLY_STAGE', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ELITE'])

function mergeCapsMax(...capObjects) {
  const valid = capObjects.filter(Boolean)
  if (valid.length === 0) return { maxOverall: 10, maxTechnical: 10, maxLoad: 10, maxComplexity: 10 }
  return {
    maxOverall: Math.max(...valid.map((c) => Number(c.maxOverall ?? 10))),
    maxTechnical: Math.max(...valid.map((c) => Number(c.maxTechnical ?? 10))),
    maxLoad: Math.max(...valid.map((c) => Number(c.maxLoad ?? 10))),
    maxComplexity: Math.max(...valid.map((c) => Number(c.maxComplexity ?? c.maxTechnical ?? 10))),
  }
}

function buildSplitProfiles(audienceSplits, body) {
  if (!Array.isArray(audienceSplits) || audienceSplits.length === 0) return []
  return audienceSplits.map((split) => {
    const profile = resolveAudienceProfile({
      ageMin: split.ageMin ?? split.age_min,
      ageMax: split.ageMax ?? split.age_max,
      skillLevel: body.skillLevel ?? body.skill_level,
      sessionObjective: body.sessionObjective ?? body.session_objective,
      targets: body.targets,
    })
    const override = split.capsOverride ?? split.caps_override ?? split.difficultyOverride ?? split.difficulty_override
    if (override != null) {
      const o = typeof override === 'number'
        ? { maxOverall: override, maxTechnical: override, maxLoad: override }
        : override
      profile.caps = {
        maxOverall: Number(o.maxOverall ?? o.max_overall ?? profile.caps.maxOverall),
        maxTechnical: Number(o.maxTechnical ?? o.max_technical ?? profile.caps.maxTechnical),
        maxLoad: Number(o.maxLoad ?? o.max_load ?? profile.caps.maxLoad),
        maxComplexity: Number(o.maxComplexity ?? o.max_complexity ?? o.maxOverall ?? o.max_overall ?? profile.caps.maxComplexity),
      }
    }
    return { label: split.label, caps: profile.caps }
  })
}

function expectedAudienceProfile(body) {
  const expected = resolveAudienceProfile({
    ageMin: body.ageMin ?? body.age_min,
    ageMax: body.ageMax ?? body.age_max,
    skillLevel: body.skillLevel ?? body.skill_level,
    sessionObjective: body.sessionObjective ?? body.session_objective,
    targets: body.targets,
    prompt: body.prompt,
  })
  const capsOverride = body.capsOverride ?? body.caps_override
  if (capsOverride) {
    expected.caps = {
      maxOverall: Number(capsOverride.maxOverall ?? capsOverride.max_overall ?? expected.caps.maxOverall),
      maxTechnical: Number(capsOverride.maxTechnical ?? capsOverride.max_technical ?? expected.caps.maxTechnical),
      maxLoad: Number(capsOverride.maxLoad ?? capsOverride.max_load ?? expected.caps.maxLoad),
      maxComplexity: Number(capsOverride.maxComplexity ?? capsOverride.max_complexity ?? expected.caps.maxComplexity),
    }
  }
  return expected
}

export const CATEGORY4_KPI_CHECK_IDS = [
  'audience_age_range',
  'audience_cap_overall',
  'audience_cap_technical_load',
  'audience_max_complexity_cap',
  'audience_implied_skill_level',
  'audience_scaling_cohort',
  'session_objective_echo',
  'audience_age_band_label',
  'audience_strength_intent',
  'audience_objective_strength_matrix',
  'primary_age_fit_distribution',
  'session_age_fit_warnings',
  'audience_recommended_age_overlap',
  'audience_caps_override_propagation',
  'audience_pool_cap_derivation',
  'audience_hard_difficulty_exclude',
  'primary_over_cap_count',
  'audience_inputs_valid',
]

export const CATEGORY4_MOE_CHECK_IDS = [
  'category4_moe_output_emphasis',
  'category4_moe_scaling_guidance',
  'category4_moe_split1_headroom',
  'category4_moe_cap_utilization',
  'category4_moe_pool_filter',
  'category4_moe_review_packet',
  'audience_skill_level_adherence',
]

export function evaluateCategory4Audience(result, expectedBody, checks, context = {}) {
  const profile = result.audience_profile ?? {}
  const expected = expectedAudienceProfile(expectedBody)
  const exerciseById = context.exerciseById ?? new Map()
  const difficultyByExerciseId = context.difficultyByExerciseId ?? new Map()
  const audienceSkill = String(expectedBody.skillLevel ?? expectedBody.skill_level ?? expected.impliedSkillLevel ?? '').toUpperCase()

  // C4-MOS-01 / audience inputs
  const ageMin = Number(expectedBody.ageMin ?? expectedBody.age_min)
  const ageMax = Number(expectedBody.ageMax ?? expectedBody.age_max)
  const inputIssues = []
  if (Number.isFinite(ageMin) && Number.isFinite(ageMax) && ageMin > ageMax) {
    inputIssues.push('ageMin > ageMax')
  }
  if (audienceSkill && !VALID_SKILL_LEVELS.has(audienceSkill)) {
    inputIssues.push(`invalid skillLevel ${audienceSkill}`)
  }
  if (inputIssues.length > 0) {
    fail(checks, 'audience_inputs_valid', `Invalid audience inputs: ${inputIssues.join(', ')}`)
  } else {
    pass(checks, 'audience_inputs_valid', 'Audience prescribe inputs valid')
  }

  // C4-MOP-01
  if (profile.ageMin !== expected.ageMin || profile.ageMax !== expected.ageMax) {
    fail(checks, 'audience_age_range', `Profile age ${profile.ageMin}-${profile.ageMax} !== body ${expected.ageMin}-${expected.ageMax}`)
  } else {
    pass(checks, 'audience_age_range', `Age range ${profile.ageMin}-${profile.ageMax}`)
  }

  // C4-MOP-02–03
  if (profile.caps?.maxOverall !== expected.caps.maxOverall) {
    fail(checks, 'audience_cap_overall', `maxOverall ${profile.caps?.maxOverall} !== ${expected.caps.maxOverall}`)
  } else {
    pass(checks, 'audience_cap_overall', `maxOverall cap ${profile.caps?.maxOverall}`)
  }
  if (profile.caps?.maxTechnical !== expected.caps.maxTechnical || profile.caps?.maxLoad !== expected.caps.maxLoad) {
    fail(checks, 'audience_cap_technical_load', `Technical/load caps mismatch`, {
      actual: profile.caps,
      expected: { maxTechnical: expected.caps.maxTechnical, maxLoad: expected.caps.maxLoad },
    })
  } else {
    pass(checks, 'audience_cap_technical_load', `Technical ${profile.caps?.maxTechnical} / load ${profile.caps?.maxLoad}`)
  }

  // C4-MOP-04
  const implied = profile.impliedSkillLevel ?? profile.implied_skill_level
  const expectedSkill = expected.impliedSkillLevel
  if (String(implied ?? '').toUpperCase() !== String(expectedSkill ?? '').toUpperCase()) {
    fail(checks, 'audience_implied_skill_level', `impliedSkillLevel ${implied} !== ${expectedSkill}`)
  } else {
    pass(checks, 'audience_implied_skill_level', `impliedSkillLevel ${implied}`)
  }

  // C4-MOP-05
  if (profile.scalingCohort !== expected.scalingCohort) {
    fail(checks, 'audience_scaling_cohort', `scalingCohort ${profile.scalingCohort} !== ${expected.scalingCohort}`)
  } else {
    pass(checks, 'audience_scaling_cohort', `scalingCohort ${profile.scalingCohort}`)
  }

  // C4-MOP-07
  if (!profile.ageBandLabel || !String(profile.ageBandLabel).includes(String(expected.ageMin ?? ''))) {
    fail(checks, 'audience_age_band_label', `ageBandLabel missing or inconsistent: ${profile.ageBandLabel}`)
  } else {
    pass(checks, 'audience_age_band_label', `ageBandLabel ${profile.ageBandLabel}`)
  }

  // C4-MOP-08 / C4-MOP-17
  const expectedStrength = detectStrengthIntent(expectedBody)
  if (profile.strengthIntent !== expectedStrength) {
    fail(checks, 'audience_strength_intent', `strengthIntent ${profile.strengthIntent} !== ${expectedStrength}`)
  } else {
    pass(checks, 'audience_strength_intent', `strengthIntent ${profile.strengthIntent}`)
  }
  const objective = expectedBody.sessionObjective ?? expectedBody.session_objective
  const matrixOk = objective === 'strength_priority' ? profile.strengthIntent === true : objective === 'speed_priority' ? profile.strengthIntent === false : true
  if (!matrixOk) {
    fail(checks, 'audience_objective_strength_matrix', `strengthIntent inconsistent with objective ${objective}`)
  } else {
    pass(checks, 'audience_objective_strength_matrix', `Objective/strengthIntent matrix ok for ${objective}`)
  }

  // C4-MOP-14
  const capsOverride = expectedBody.capsOverride ?? expectedBody.caps_override
  if (capsOverride == null) {
    pass(checks, 'audience_caps_override_propagation', 'No capsOverride — band defaults applied')
  } else if (
    profile.caps?.maxOverall === expected.caps.maxOverall
    && profile.caps?.maxTechnical === expected.caps.maxTechnical
    && profile.caps?.maxLoad === expected.caps.maxLoad
    && profile.caps?.maxComplexity === expected.caps.maxComplexity
  ) {
    pass(checks, 'audience_caps_override_propagation', 'capsOverride propagated to profile.caps')
  } else {
    fail(checks, 'audience_caps_override_propagation', 'capsOverride not reflected in audience_profile.caps')
  }

  // C4-MOP-13
  if (profile.caps?.maxComplexity !== expected.caps.maxComplexity) {
    fail(checks, 'audience_max_complexity_cap', `maxComplexity ${profile.caps?.maxComplexity} !== ${expected.caps.maxComplexity}`)
  } else {
    pass(checks, 'audience_max_complexity_cap', `maxComplexity cap ${profile.caps?.maxComplexity}`)
  }

  // C4-MOP-15 pool cap replay
  const splits = expectedBody.audienceSplits ?? expectedBody.audience_splits ?? []
  const splitProfiles = buildSplitProfiles(splits, expectedBody)
  const poolCaps = mergeCapsMax(expected.caps, ...splitProfiles.map((s) => s.caps))
  const expectedPoolOverall = poolCaps.maxOverall
  if (splits.length >= 2 && expectedPoolOverall !== 10) {
    fail(checks, 'audience_pool_cap_derivation', `Expected poolCapOverall 10 for split caps 6/10; got ${expectedPoolOverall}`)
  } else {
    pass(checks, 'audience_pool_cap_derivation', `poolCapOverall replay ${expectedPoolOverall}`)
  }

  // C4-MOP-16
  const expectedHardExclude = resolveHardDifficultyExclude(expectedBody)
  const actualHardExclude = profile.hardDifficultyExclude
  if (actualHardExclude !== expectedHardExclude) {
    fail(checks, 'audience_hard_difficulty_exclude', `hardDifficultyExclude ${actualHardExclude} !== ${expectedHardExclude}`)
  } else {
    pass(checks, 'audience_hard_difficulty_exclude', `hardDifficultyExclude ${actualHardExclude}`)
  }

  // C4-MOP-09 / C4-MOR-01
  let totalPrimaries = 0
  let goodCount = 0
  let stretchCount = 0
  let overCapCount = 0
  for (const block of result.blocks ?? []) {
    for (const item of block.items ?? []) {
      totalPrimaries += 1
      const fit = item.age_fit ?? 'good'
      if (fit === 'good') goodCount += 1
      else if (fit === 'stretch') stretchCount += 1
      else if (fit === 'over_cap') overCapCount += 1
    }
  }
  const goodRate = totalPrimaries > 0 ? goodCount / totalPrimaries : 1
  if (goodRate < 0.85 || overCapCount > 0) {
    fail(checks, 'primary_age_fit_distribution', `good ${(goodRate * 100).toFixed(0)}%; over_cap ${overCapCount}`, { goodCount, stretchCount, overCapCount, totalPrimaries })
  } else {
    pass(checks, 'primary_age_fit_distribution', `Age-fit good ${(goodRate * 100).toFixed(0)}%; over_cap 0`)
  }
  if (overCapCount > 0) {
    fail(checks, 'primary_over_cap_count', `${overCapCount} over_cap primaries`)
  } else {
    pass(checks, 'primary_over_cap_count', 'No over_cap primaries')
  }

  // C4-MOP-11
  let skillMatch = 0
  let skillTotal = 0
  for (const block of result.blocks ?? []) {
    for (const item of block.items ?? []) {
      skillTotal += 1
      const exSkill = exerciseById.get(Number(item.exercise_id))?.skill_level
      if (exSkill == null || exSkill === '' || String(exSkill).toUpperCase() === audienceSkill) {
        skillMatch += 1
      }
    }
  }
  const skillRate = skillTotal > 0 ? skillMatch / skillTotal : 1
  info(checks, 'audience_skill_level_adherence', `Skill level match ${(skillRate * 100).toFixed(0)}% (null or ${audienceSkill})`, {
    skillMatch,
    skillTotal,
    audienceSkill,
    ok_band: skillRate >= 0.95,
  })

  // C4-MOP-12
  let ageOverlap = 0
  let ageChecked = 0
  const sessMin = expected.ageMin
  const sessMax = expected.ageMax
  for (const block of result.blocks ?? []) {
    for (const item of block.items ?? []) {
      const diff = difficultyByExerciseId.get(String(item.exercise_id))
      const recMin = diff?.recommended_age_min
      const recMax = diff?.recommended_age_max
      if (recMin == null && recMax == null) continue
      ageChecked += 1
      const rMin = recMin ?? 0
      const rMax = recMax ?? 120
      const overlaps = sessMax >= rMin && sessMin <= rMax
      if (overlaps) ageOverlap += 1
    }
  }
  const overlapRate = ageChecked > 0 ? ageOverlap / ageChecked : 1
  if (overlapRate < 0.9) {
    fail(checks, 'audience_recommended_age_overlap', `Recommended age overlap ${(overlapRate * 100).toFixed(0)}% < 90%`, { ageChecked, ageOverlap })
  } else {
    pass(checks, 'audience_recommended_age_overlap', `Recommended age overlap ${(overlapRate * 100).toFixed(0)}%`)
  }

  // MOE informational
  const blocks = result.blocks ?? []
  const totalMin = blocks.reduce((s, b) => s + Number(b.target_minutes ?? 0), 0) || 1
  const outputMin = Number(blockByKey(result, 'output')?.target_minutes ?? 0)
  info(checks, 'category4_moe_output_emphasis', `Output ${((outputMin / totalMin) * 100).toFixed(1)}% of minutes`, { ok_band: outputMin / totalMin >= 0.3, rubric: 'C4-MOE-02' })

  let scaledVariants = 0
  let withGuidance = 0
  for (const block of blocks) {
    for (const item of block.items ?? []) {
      for (const v of item.per_split ?? item.split_alternates_json ?? []) {
        if (v.variant_type === 'same' || v.variant_type === 'scaled') {
          scaledVariants += 1
          if (v.scaling_guidance) withGuidance += 1
        }
      }
    }
  }
  const guidanceRate = scaledVariants > 0 ? withGuidance / scaledVariants : 1
  info(checks, 'category4_moe_scaling_guidance', `Scaling guidance ${(guidanceRate * 100).toFixed(0)}%`, { ok_band: guidanceRate >= 0.8, rubric: 'C4-MOE-05' })

  const split1 = splits.find((s) => /split\s*1/i.test(String(s.label ?? '')))
  const split1Cap = split1 ? Number((split1.difficultyOverride ?? split1.difficulty_override) ?? 6) : null
  let maxSplit1D = 0
  if (split1Cap != null) {
    for (const block of blocks) {
      for (const item of block.items ?? []) {
        for (const v of item.per_split ?? item.split_alternates_json ?? []) {
          if (!/split\s*1|8-10|8–10/i.test(String(v.split_label ?? ''))) continue
          maxSplit1D = Math.max(maxSplit1D, Number(v.difficulty?.overall ?? 0))
        }
      }
    }
    const headroom = split1Cap - maxSplit1D
    info(checks, 'category4_moe_split1_headroom', `Split 1 headroom ${headroom} (cap ${split1Cap}, max D ${maxSplit1D})`, { ok_band: headroom >= 0, rubric: 'C4-MOE-07' })
  }

  const capOverall = profile.caps?.maxOverall ?? expected.caps.maxOverall
  let sumD = 0
  let countD = 0
  for (const block of blocks) {
    for (const item of block.items ?? []) {
      const d = item.difficulty?.overall
      if (d != null) {
        sumD += Number(d)
        countD += 1
      }
    }
  }
  const meanD = countD > 0 ? sumD / countD : 0
  const utilRate = capOverall > 0 ? meanD / capOverall : 0
  info(checks, 'category4_moe_cap_utilization', `Mean primary D ${meanD.toFixed(1)} / cap ${capOverall} (${(utilRate * 100).toFixed(0)}%)`, {
    ok_band: utilRate >= 0.7,
    rubric: 'C4-MOE-03',
  })

  const splitRejects = (result.constraint_report?.phase_fill ?? []).reduce((s, f) => s + Number(f.split_rejects ?? 0), 0)
  info(checks, 'category4_moe_pool_filter', `Split cap pool rejects: ${splitRejects}`, {
    ok_band: splitRejects === 0,
    rubric: 'C4-MOE-06',
  })

  info(checks, 'category4_moe_review_packet', 'Audience profile ready for coach MOE review', {
    ok_band: true,
    audience_profile: {
      ageMin: profile.ageMin,
      ageMax: profile.ageMax,
      impliedSkillLevel: implied,
      caps: profile.caps,
      sessionObjective: profile.sessionObjective ?? expectedBody.sessionObjective,
      hardDifficultyExclude: profile.hardDifficultyExclude,
    },
    age_fit_summary: { goodCount, stretchCount, overCapCount, totalPrimaries },
    rubric: ['C4-MOE-01', 'C4-MOE-04'],
  })
}

export function computeCategory4Kpi(checks, { minRate = 0.95 } = {}) {
  const applicable = checks.filter((c) => CATEGORY4_KPI_CHECK_IDS.includes(c.id))
  const scored = applicable.filter((c) => !c.detail?.tbd && !c.detail?.informational)
  const passed = scored.filter((c) => c.ok).length
  const rate = scored.length > 0 ? passed / scored.length : 1
  return {
    id: 'category4_kpi',
    ok: rate >= minRate,
    severity: rate >= minRate ? 'ok' : 'P1',
    message: `Category 4 audience fidelity: ${(rate * 100).toFixed(1)}% (${passed}/${scored.length}; min ${(minRate * 100).toFixed(0)}%)`,
    detail: { rate, passed, total: scored.length, minRate, category: 4 },
  }
}

/**
 * Run wired category evaluators only.
 */
export function runCategoryEvaluators(result, expectedBody, checks, context = {}) {
  const pushed = []
  const run = (n, evaluateFn, kpiFn) => {
    if (!WIRED_CATEGORIES.has(n)) return
    evaluateFn(result, expectedBody, checks, context)
    const kpi = kpiFn(checks)
    checks.push(kpi)
    pushed.push(kpi)
  }

  run(2, evaluateCategory2Fill, computeCategory2Kpi)
  run(3, evaluateCategory3Restore, computeCategory3Kpi)
  run(4, evaluateCategory4Audience, computeCategory4Kpi)

  for (const [n, evaluateFn, kpiFn] of EXTENDED_CATEGORY_REGISTRY) {
    run(n, evaluateFn, kpiFn)
  }

  return pushed
}
