/**
 * Prescription quality gates for golden-scenario evaluation (strict loop).
 * Used by scripts/evaluate-prescription-quality.mjs and unit tests.
 */

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
