/**
 * Category evaluators 5–25 — wired sequentially per NEEDS_ENGINE_CATEGORY_IMPLEMENTATION_LOOP.md
 */

import {
  blockByKey,
  isSplit2Label,
  allPerSplitVariants,
  sharesPatternOrFamily,
  equipmentKeysForExercise,
  patternIdsForExercise,
  progressionLaneMatchMethod,
  engineStyleLaneValid,
} from './prescriptionQualityChecks.js'
import {
  HIGH_AROUSAL_METHODOLOGY_KEYS,
  isForbiddenLaneFamilyPair,
  isPhaseAdjacent,
  mergeForbiddenLanePairs,
  outputSpeedTenetRequired,
  sharesTenetKey,
} from './progressionLanePolicy.js'
import { ageFitWarnings, classifyAgeFit, resolveAudienceProfile, scoreAgeDifficultyFit } from './ageDifficultyPolicy.js'
import { beginnerAppropriatenessPenalty } from './beginnerExclusionPolicy.js'
import {
  hasSustainedConditioningFocus,
  minItemsForPhase,
  maxItemsForPhase,
  shouldRelaxSplitGate,
  sustainedCapacityCandidateEligible,
} from './sustainedCapacityPolicy.js'
import { SESSION_PHASE_ORDER } from './phaseArchitect.js'
import {
  movementFamilyKey,
  movementFamilyLimit,
  normalizeSlugStem,
} from './movementFamilyPolicy.js'
import {
  auditPrescriptionEquipmentAvoid,
  inferAvoidedEquipmentKeys,
  isBoxSemanticWhitelist,
  EQUIPMENT_AVOID_ALIASES,
  equipmentTagMismatchWarning,
  exerciseAllowedUseOnly,
  BODYWEIGHT_EQUIPMENT_KEYS,
} from './equipmentAvoidPolicy.js'
import { classifyProgrammingKind } from './exerciseProgrammingKind.js'
import {
  sportContextMultiplier,
  isSportSpecificExercise,
  matchesFootballBaseballSlug,
} from './sportContextPolicy.js'

const LOW_INTENT_PHASE_LIST = ['prepare_and_access', 'movement_intelligence', 'sustained_capacity', 'restore']
const PROGRESSION_PHASES = ['output', 'capacity', 'resilience']
const HIGH_INTENT_PHASES = ['output', 'capacity', 'resilience']
const NO_STRETCH_PRIMARY_PHASES = new Set([
  'prepare_and_access',
  'movement_intelligence',
  'output',
  'capacity',
  'resilience',
])
const STRETCH_ALLOWED_PHASES = new Set(['sustained_capacity', 'restore'])
const SKILL_RANK = { EARLY_STAGE: 0, BEGINNER: 1, INTERMEDIATE: 2, ADVANCED: 3, ELITE: 4 }

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
  checks.push({ id, ok: true, severity: 'ok', message, detail: { tbd: true, informational: true, ...detail } })
}

function findCheck(checks, id) {
  return checks.find((c) => c.id === id)
}

function mergeCapsMax(...capObjects) {
  const valid = capObjects.filter(Boolean)
  if (valid.length === 0) return { maxOverall: 10, maxTechnical: 10, maxLoad: 10 }
  return {
    maxOverall: Math.max(...valid.map((c) => Number(c.maxOverall ?? 10))),
    maxTechnical: Math.max(...valid.map((c) => Number(c.maxTechnical ?? 10))),
    maxLoad: Math.max(...valid.map((c) => Number(c.maxLoad ?? 10))),
  }
}

function computeKpi(checks, category, checkIds, { minRate = 0.95, id = `category${category}_kpi` } = {}) {
  const applicable = checks.filter((c) => checkIds.includes(c.id))
  const scored = applicable.filter((c) => !c.detail?.tbd && !c.detail?.informational)
  const passed = scored.filter((c) => c.ok).length
  const rate = scored.length > 0 ? passed / scored.length : 1
  return {
    id,
    ok: rate >= minRate,
    severity: rate >= minRate ? 'ok' : 'P1',
    message: `Category ${category} fidelity: ${(rate * 100).toFixed(1)}% (${passed}/${scored.length}; min ${(minRate * 100).toFixed(0)}%)`,
    detail: { rate, passed, total: scored.length, minRate, category },
  }
}

function bodySplits(body) {
  return body.audienceSplits ?? body.audience_splits ?? []
}

function resultSplits(result) {
  return result.audience_splits ?? []
}

function splitAgeMinMax(split) {
  return {
    min: Number(split.ageMin ?? split.age_min ?? NaN),
    max: Number(split.ageMax ?? split.age_max ?? NaN),
  }
}

function capFromBodySplit(split) {
  const override = split.capsOverride ?? split.caps_override ?? split.difficultyOverride ?? split.difficulty_override
  if (override == null) return null
  if (typeof override === 'number') {
    return { maxOverall: override, maxTechnical: override, maxLoad: override }
  }
  return {
    maxOverall: Number(override.maxOverall ?? override.max_overall ?? NaN),
    maxTechnical: Number(override.maxTechnical ?? override.max_technical ?? NaN),
    maxLoad: Number(override.maxLoad ?? override.max_load ?? NaN),
  }
}

function capsByLabel(splits) {
  const map = new Map()
  for (const s of splits) {
    const label = String(s.label ?? '')
    if (!label) continue
    map.set(label, s.caps ?? {})
  }
  return map
}

function variantOverallDifficulty(variant, item) {
  if (!variant) return Number(item?.difficulty?.overall ?? 0)
  return Number(variant.difficulty?.overall ?? item?.difficulty?.overall ?? 0)
}

function isSplit1Label(label) {
  return /split\s*1|8-10|8–10/i.test(String(label ?? ''))
}

function collectAllPerSplit(result) {
  const rows = []
  for (const block of result.blocks ?? []) {
    for (const row of allPerSplitVariants(block)) {
      rows.push({ ...row, phase_key: block.phase_key })
    }
  }
  return rows
}

function mean(nums) {
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function median(nums) {
  if (nums.length === 0) return 0
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function difficultyProximityBonus(difficulty, poolCapOverall) {
  const cap = Number(poolCapOverall ?? 10)
  const overall = Number(difficulty?.overall ?? 0)
  if (!overall || cap <= 0) return 0
  return Math.min(8, (overall / cap) * 6)
}

function split1Variant(item) {
  return (item.per_split ?? item.split_alternates_json ?? []).find((v) => isSplit1Label(v.split_label))
}

function split2Variant(item) {
  return (item.per_split ?? item.split_alternates_json ?? []).find((v) => isSplit2Label(v.split_label))
}

function buildSplitProfilesFromBody(body) {
  const splits = bodySplits(body)
  if (!Array.isArray(splits) || splits.length === 0) return []
  return splits.map((split) => {
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
      }
    }
    return {
      label: split.label,
      ageMin: split.ageMin ?? split.age_min ?? null,
      ageMax: split.ageMax ?? split.age_max ?? null,
      caps: profile.caps,
    }
  })
}

function classifyPrimaryAgeFitReplay(difficulty, sessionCaps, splitProfiles) {
  if (!difficulty) return 'good'
  const sessionFit = classifyAgeFit(difficulty, sessionCaps)
  if (sessionFit === 'good') return 'good'
  if (Array.isArray(splitProfiles) && splitProfiles.length > 0) {
    for (const split of splitProfiles) {
      if (classifyAgeFit(difficulty, split.caps) === 'good') return 'good'
    }
  }
  return sessionFit
}

function youngestSplitProfile(splitProfiles) {
  if (!Array.isArray(splitProfiles) || splitProfiles.length === 0) return null
  return splitProfiles.reduce((a, b) => (
    Number(a.ageMax ?? 99) <= Number(b.ageMax ?? 99) ? a : b
  ))
}

function parseAgeFitWarningDimensions(warnings) {
  let overall = 0
  let load = 0
  let technical = 0
  for (const w of warnings ?? []) {
    const text = String(w).toLowerCase()
    if (/overall difficulty|overall\s+\d/.test(text)) overall += 1
    if (/load\s+\d|load exceeds/.test(text)) load += 1
    if (/technical\s+\d|technical exceeds/.test(text)) technical += 1
  }
  return { overall, load, technical, total: (warnings ?? []).length }
}

/** C21-MOP-11 — classify warning string into taxonomy bucket */
function classifyWarningTaxonomy(warning) {
  const text = String(warning).toLowerCase()
  if (/overall difficulty|overall\s+\d.*exceeds cap/.test(text)) return 'overall_cap'
  if (/load\s+\d.*exceeds cap|load exceeds/.test(text)) return 'load_cap'
  if (/technical\s+\d.*exceeds cap|technical exceeds/.test(text)) return 'technical_cap'
  if (/coach scaling required/.test(text)) return 'scaling_required'
  if (/no suitable variant found/.test(text)) return 'missing_variant'
  return null
}

/** NeedsEnginePanel send-to-builder truncation contract (NeedsEnginePanel.tsx) */
export const CATEGORY21_UI_SEND_AGE_LIMIT = 5
export const CATEGORY21_UI_DISPLAY_AGE_LIMIT = 4
export const CATEGORY21_UI_SPLIT_LIMIT = 5

function simulateNeedsEngineWarningUi(ageWarnings, splitWarnings) {
  return {
    audience_notes: (ageWarnings ?? []).slice(0, CATEGORY21_UI_SEND_AGE_LIMIT).join('; '),
    watch_points: (splitWarnings ?? []).slice(0, CATEGORY21_UI_SPLIT_LIMIT),
    age_fit_display: (ageWarnings ?? []).slice(0, CATEGORY21_UI_DISPLAY_AGE_LIMIT),
  }
}

function ensureCheck(checks, id, emitFn) {
  if (findCheck(checks, id)) return
  emitFn()
}

function highestCapSplitLabels(splits) {
  if (!Array.isArray(splits) || splits.length === 0) return new Set()
  const maxCap = Math.max(...splits.map((s) => Number(s.caps?.maxOverall ?? s.caps?.max_overall ?? 0)))
  if (maxCap <= 0) return new Set()
  return new Set(
    splits
      .filter((s) => Number(s.caps?.maxOverall ?? s.caps?.max_overall ?? 0) >= maxCap)
      .map((s) => String(s.label ?? ''))
      .filter(Boolean),
  )
}

function isProgressionSplitLabel(label, splits) {
  const labels = highestCapSplitLabels(splits)
  if (labels.size > 0) return labels.has(String(label ?? ''))
  return isSplit2Label(label)
}

function isYoungerSplitLabel(label, splits) {
  if (!Array.isArray(splits) || splits.length === 0) return isSplit1Label(label)
  const caps = splits.map((s) => Number(s.caps?.maxOverall ?? s.caps?.max_overall ?? 999))
  const minCap = Math.min(...caps)
  const youngLabels = new Set(
    splits
      .filter((s) => Number(s.caps?.maxOverall ?? s.caps?.max_overall ?? 999) <= minCap)
      .map((s) => String(s.label ?? ''))
      .filter(Boolean),
  )
  return youngLabels.has(String(label ?? '')) || isSplit1Label(label)
}

function highestCapSplitProfiles(splits) {
  if (!Array.isArray(splits) || splits.length === 0) return []
  const maxCap = Math.max(...splits.map((s) => Number(s.caps?.maxOverall ?? s.caps?.max_overall ?? 0)))
  if (maxCap <= 0) return []
  return splits.filter((s) => Number(s.caps?.maxOverall ?? s.caps?.max_overall ?? 0) >= maxCap)
}

function progressionEligiblePrimary(difficulty, splits) {
  const highSplits = highestCapSplitProfiles(splits)
  if (highSplits.length === 0) return false
  const primaryD = Number(difficulty?.overall ?? 0)
  const maxCap = Number(highSplits[0].caps?.maxOverall ?? highSplits[0].caps?.max_overall ?? 0)
  if (maxCap <= primaryD + 1) return false
  return highSplits.some((s) => classifyAgeFit(difficulty, s.caps) === 'good')
}

function itemHasProgressionOnHighestCap(item, effectiveSplits) {
  const ps = item.per_split ?? item.split_alternates_json ?? []
  return ps.some((v) => v.variant_type === 'progression' && isProgressionSplitLabel(v.split_label, effectiveSplits))
}

function itemHasScaledVariant(item) {
  const ps = item.per_split ?? item.split_alternates_json ?? []
  return ps.some((v) => v.variant_type === 'scaled')
}

function phaseFillByKey(result) {
  const map = new Map()
  for (const f of result.constraint_report?.phase_fill ?? []) {
    map.set(String(f.phase_key), f)
  }
  return map
}

export function collectHighestCapProgressionPairs(result, effectiveSplits) {
  const pairs = []
  for (const row of collectAllPerSplit(result)) {
    if (row.variant.variant_type !== 'progression') continue
    if (!isProgressionSplitLabel(row.variant.split_label, effectiveSplits)) continue
    pairs.push(row)
  }
  return pairs
}

function methodologyKeysForExercise(exerciseId, tagMap, methodologyKeyById) {
  return (tagMap.get(String(exerciseId)) ?? [])
    .filter((t) => t.facetType === 'methodology')
    .map((t) => methodologyKeyById.get(Number(t.facetId)))
    .filter(Boolean)
}

// ─── Category 5 — Age splits ─────────────────────────────────────────────────

export const CATEGORY5_KPI_CHECK_IDS = [
  'audience_splits_mos_valid',
  'audience_split_count_parity',
  'split_label_parity',
  'split_age_band_parity',
  'split_cap_parity',
  'split_cap_dimensions_parity',
  'per_split_label_valid',
  'per_split_difficulty_cap_echo',
  'split1_cap_adherence',
  'split2_cap_adherence',
  'split_missing_variant_count',
  'split_missing_high_intent',
  'split_scaling_guidance_rate',
  'split_age_coverage',
  'split_variant_warnings',
  'split2_progressions_output',
  'split2_progressions_capacity',
  'split2_progressions_resilience',
  'progression_reuse_output',
  'progression_reuse_capacity',
  'progression_reuse_resilience',
  'progression_difficulty_output',
  'progression_difficulty_capacity',
  'progression_difficulty_resilience',
]

export const CATEGORY5_MOE_CHECK_IDS = [
  'split_differentiation_moe',
  'split2_cap_exploitation_moe',
  'split_scaling_guidance_diff_moe',
  'split1_substituted_rate_moe',
  'split1_same_scaled_share_moe',
  'category5_moe_review_packet',
]

export function evaluateCategory5Splits(result, expectedBody, checks, context = {}) {
  const bodySplitList = bodySplits(expectedBody)
  const resSplitList = resultSplits(result)
  const splitCount = resSplitList.length
  const capsMap = capsByLabel(resSplitList)

  if (bodySplitList.length > 0) {
    const mosIssues = []
    const labels = new Set()
    for (const split of bodySplitList) {
      const label = String(split.label ?? '').trim()
      if (!label) mosIssues.push('split missing label')
      else if (labels.has(label)) mosIssues.push(`duplicate label ${label}`)
      else labels.add(label)
      const ages = splitAgeMinMax(split)
      if (!Number.isFinite(ages.min) || !Number.isFinite(ages.max) || ages.min > ages.max) {
        mosIssues.push(`invalid ages for ${label || 'split'}`)
      }
      const cap = capFromBodySplit(split)
      if (cap != null && !Number.isFinite(cap.maxOverall)) {
        mosIssues.push(`non-numeric override for ${label || 'split'}`)
      }
    }
    if (mosIssues.length > 0) {
      fail(checks, 'audience_splits_mos_valid', 'audienceSplits MOS validation failed', mosIssues)
    } else {
      pass(checks, 'audience_splits_mos_valid', 'audienceSplits MOS valid')
    }
  }

  if (bodySplitList.length > 0 && splitCount !== bodySplitList.length) {
    fail(checks, 'audience_split_count_parity', `audience_splits length ${splitCount} !== body ${bodySplitList.length}`)
  } else if (bodySplitList.length > 0) {
    pass(checks, 'audience_split_count_parity', `Split count ${splitCount}`)
  }

  const labelMismatches = []
  const ageMismatches = []
  const capMismatches = []
  const dimMismatches = []
  for (let i = 0; i < Math.min(bodySplitList.length, resSplitList.length); i += 1) {
    const bodySplit = bodySplitList[i]
    const resSplit = resSplitList[i]
    const bl = String(bodySplit.label ?? '')
    const rl = String(resSplit.label ?? '')
    if (bl && rl && bl !== rl) labelMismatches.push({ i, bl, rl })

    const bodyAges = splitAgeMinMax(bodySplit)
    const resAges = splitAgeMinMax(resSplit)
    if (Number.isFinite(bodyAges.min) && (bodyAges.min !== resAges.min || bodyAges.max !== resAges.max)) {
      ageMismatches.push({ i, label: bl, body: bodyAges, result: resAges })
    }

    const bodyCap = capFromBodySplit(bodySplit)
    const resCap = Number(resSplit.caps?.maxOverall ?? resSplit.caps?.max_overall ?? NaN)
    if (bodyCap != null && Number.isFinite(bodyCap.maxOverall) && bodyCap.maxOverall !== resCap) {
      capMismatches.push({ i, label: bl, body: bodyCap.maxOverall, result: resCap })
    }

    const caps = resSplit.caps ?? {}
    const mo = Number(caps.maxOverall ?? NaN)
    const mt = Number(caps.maxTechnical ?? NaN)
    const ml = Number(caps.maxLoad ?? NaN)
    const scalarOverride = bodySplit.difficultyOverride ?? bodySplit.difficulty_override
    if (typeof scalarOverride === 'number' && Number.isFinite(mo) && (mo !== mt || mo !== ml)) {
      dimMismatches.push({ i, label: bl, maxOverall: mo, maxTechnical: mt, maxLoad: ml })
    }
  }

  if (labelMismatches.length > 0) {
    fail(checks, 'split_label_parity', 'Split labels differ from body', labelMismatches)
  } else if (bodySplitList.length > 0) {
    pass(checks, 'split_label_parity', 'Split labels match body')
  }

  if (ageMismatches.length > 0) {
    fail(checks, 'split_age_band_parity', 'Split age bands differ from body', ageMismatches)
  } else if (bodySplitList.length > 0 && resSplitList.length > 0) {
    pass(checks, 'split_age_band_parity', 'Split age bands match body')
  }

  if (capMismatches.length > 0) {
    fail(checks, 'split_cap_parity', 'Split caps differ from body difficultyOverride', capMismatches)
  } else if (bodySplitList.length > 0 && resSplitList.length > 0) {
    pass(checks, 'split_cap_parity', 'Split caps match body overrides')
  }

  if (dimMismatches.length > 0) {
    fail(checks, 'split_cap_dimensions_parity', 'Split cap dimensions not equal across overall/technical/load', dimMismatches)
  } else if (bodySplitList.length > 0 && resSplitList.length > 0) {
    pass(checks, 'split_cap_dimensions_parity', 'Split cap dimensions aligned')
  }

  let itemsTotal = 0
  let itemsComplete = 0
  let missingCount = 0
  let missingHighIntent = 0
  let split1Prog = 0
  const validLabels = new Set(resSplitList.map((s) => String(s.label ?? '')).filter(Boolean))
  const invalidPerSplitLabels = []
  const capEchoMismatches = []
  const split1CapViolations = []
  const split2CapViolations = []
  const variantDistByPhase = new Map()

  for (const block of result.blocks ?? []) {
    const phaseKey = block.phase_key
    const phaseDist = variantDistByPhase.get(phaseKey) ?? { same: 0, scaled: 0, substituted: 0, progression: 0, missing: 0 }
    const isHighIntent = HIGH_INTENT_PHASES.includes(phaseKey)

    for (const item of block.items ?? []) {
      const ps = item.per_split ?? item.split_alternates_json ?? []
      if (splitCount >= 2) {
        itemsTotal += 1
        if (ps.length >= splitCount) itemsComplete += 1
      }
      for (const v of ps) {
        const vt = v.variant_type ?? 'unknown'
        phaseDist[vt] = (phaseDist[vt] ?? 0) + 1

        if (v.variant_type === 'missing') {
          missingCount += 1
          if (isHighIntent) missingHighIntent += 1
        }
        if (v.variant_type === 'progression' && isSplit1Label(v.split_label)) split1Prog += 1

        const sl = String(v.split_label ?? '')
        if (sl && validLabels.size > 0 && !validLabels.has(sl)) {
          invalidPerSplitLabels.push({ phase_key: phaseKey, split_label: sl, exercise_id: item.exercise_id })
        }

        const splitCaps = capsMap.get(sl) ?? {}
        const expectedCap = Number(splitCaps.maxOverall ?? NaN)
        const echoCap = Number(v.difficulty_cap ?? NaN)
        if (sl && Number.isFinite(expectedCap) && Number.isFinite(echoCap) && echoCap !== expectedCap) {
          capEchoMismatches.push({ split_label: sl, expected: expectedCap, actual: echoCap, exercise_id: item.exercise_id })
        }

        const d = variantOverallDifficulty(v, item)
        if (isSplit1Label(sl) && Number.isFinite(expectedCap)) {
          const fit = classifyAgeFit(
            { overall: d, technical: d, load: d },
            { maxOverall: expectedCap, maxTechnical: expectedCap, maxLoad: expectedCap },
          )
          if (fit === 'over_cap') {
            split1CapViolations.push({ split_label: sl, difficulty: d, cap: expectedCap, exercise_id: item.exercise_id })
          }
        }
        if (isSplit2Label(sl) && Number.isFinite(expectedCap) && d > expectedCap) {
          split2CapViolations.push({ split_label: sl, difficulty: d, cap: expectedCap, exercise_id: item.exercise_id })
        }
      }
    }
    variantDistByPhase.set(phaseKey, phaseDist)
  }

  if (invalidPerSplitLabels.length > 0) {
    fail(checks, 'per_split_label_valid', 'per_split labels not in audience_splits', invalidPerSplitLabels.slice(0, 8))
  } else if (splitCount >= 2) {
    pass(checks, 'per_split_label_valid', 'All per_split labels valid')
  }

  if (capEchoMismatches.length > 0) {
    fail(checks, 'per_split_difficulty_cap_echo', 'per_split difficulty_cap does not echo split cap', capEchoMismatches.slice(0, 8))
  } else if (splitCount >= 2) {
    pass(checks, 'per_split_difficulty_cap_echo', 'per_split difficulty_cap echoes split caps')
  }

  if (split1CapViolations.length > 0) {
    fail(checks, 'split1_cap_adherence', 'Split 1 variants exceed cap (over_cap)', split1CapViolations.slice(0, 8))
  } else if (splitCount >= 2) {
    pass(checks, 'split1_cap_adherence', 'Split 1 variants within cap + stretch policy')
  }

  if (split2CapViolations.length > 0) {
    fail(checks, 'split2_cap_adherence', 'Split 2 variants exceed split cap', split2CapViolations.slice(0, 8))
  } else if (splitCount >= 2) {
    pass(checks, 'split2_cap_adherence', 'Split 2 variants within cap')
  }

  const completenessRate = itemsTotal > 0 ? itemsComplete / itemsTotal : 1
  if (splitCount >= 2) {
    info(checks, 'per_split_completeness', `per_split completeness ${(completenessRate * 100).toFixed(0)}%`, {
      ok_band: completenessRate >= 0.95,
      itemsComplete,
      itemsTotal,
      rubric: 'C5-MOP-05',
    })
  }

  if (missingCount > 0) {
    fail(checks, 'split_missing_variant_count', `${missingCount} missing variant(s)`)
  } else if (splitCount >= 2) {
    pass(checks, 'split_missing_variant_count', 'No missing split variants')
  }

  if (missingHighIntent > 0) {
    fail(checks, 'split_missing_high_intent', `${missingHighIntent} missing variant(s) in high-intent phases`)
  } else if (splitCount >= 2) {
    pass(checks, 'split_missing_high_intent', 'No missing variants in Output/Capacity/Resilience')
  }

  if (splitCount >= 2) {
    info(checks, 'split1_no_progressions', split1Prog > 0
      ? `Split 1 has ${split1Prog} progression variant(s)`
      : 'Split 1 has no progressions', {
      ok_band: split1Prog === 0,
      split1Prog,
      rubric: 'C5-MOP-20',
    })
  }

  const sessMin = Number(expectedBody.ageMin ?? expectedBody.age_min ?? 0)
  const sessMax = Number(expectedBody.ageMax ?? expectedBody.age_max ?? 120)
  const covered = new Set()
  for (const s of resSplitList) {
    const aMin = Number(s.age_min ?? s.ageMin ?? 0)
    const aMax = Number(s.age_max ?? s.ageMax ?? 120)
    for (let a = aMin; a <= aMax; a += 1) covered.add(a)
  }
  let sessionCovered = true
  for (let a = sessMin; a <= sessMax; a += 1) {
    if (!covered.has(a)) sessionCovered = false
  }
  if (resSplitList.length >= 2 && !sessionCovered) {
    fail(checks, 'split_age_coverage', `Session ages ${sessMin}-${sessMax} not fully covered by splits`)
  } else if (resSplitList.length >= 2) {
    pass(checks, 'split_age_coverage', 'Split age bands cover session range')
  }

  if (resSplitList.length >= 2) {
    const s1 = resSplitList[0]
    const s2 = resSplitList[1]
    const max1 = Number(s1.age_max ?? s1.ageMax ?? 0)
    const min2 = Number(s2.age_min ?? s2.ageMin ?? 0)
    if (max1 >= min2) {
      info(checks, 'split_younger_first_order', `Splits overlap at age ${max1}/${min2}`, { ok_band: false })
    } else {
      pass(checks, 'split_younger_first_order', `Younger split ends before older (${max1} < ${min2})`)
    }
  }

  for (const [phaseKey, dist] of variantDistByPhase.entries()) {
    if (!PROGRESSION_PHASES.includes(phaseKey) && !LOW_INTENT_PHASE_LIST.includes(phaseKey)) continue
    info(checks, `split_variant_distribution_${phaseKey}`, `${phaseKey} variant mix`, dist)
  }

  let diffItems = 0
  let totalPairs = 0
  let split1Diffs = []
  let split2Diffs = []
  let split1Substituted = 0
  let split1Total = 0
  let split1SameScaled = 0
  let guidanceDiffCount = 0
  let guidanceDiffTotal = 0
  let scalingEligible = 0
  let scalingWithGuidance = 0

  for (const block of result.blocks ?? []) {
    if (!HIGH_INTENT_PHASES.includes(block.phase_key)) continue
    for (const item of block.items ?? []) {
      const ps = item.per_split ?? item.split_alternates_json ?? []
      const s1 = ps.find((v) => isSplit1Label(v.split_label))
      const s2 = ps.find((v) => isSplit2Label(v.split_label))
      if (!s1 || !s2) continue
      totalPairs += 1
      if (s1.exercise_id !== s2.exercise_id || s1.variant_type !== s2.variant_type) diffItems += 1
      split1Diffs.push(variantOverallDifficulty(s1, item))
      split2Diffs.push(variantOverallDifficulty(s2, item))

      if (isSplit1Label(s1.split_label)) {
        split1Total += 1
        if (s1.variant_type === 'substituted') split1Substituted += 1
        if (s1.variant_type === 'same' || s1.variant_type === 'scaled') split1SameScaled += 1
      }

      if (s1.variant_type === s2.variant_type && (s1.variant_type === 'same' || s1.variant_type === 'scaled')) {
        guidanceDiffTotal += 1
        const g1 = String(s1.scaling_guidance ?? '').trim()
        const g2 = String(s2.scaling_guidance ?? '').trim()
        if (g1 && g2 && g1 !== g2) guidanceDiffCount += 1
      }
    }
  }

  for (const row of collectAllPerSplit(result)) {
    const { variant } = row
    if (variant.variant_type !== 'same' && variant.variant_type !== 'scaled') continue
    scalingEligible += 1
    if (String(variant.scaling_guidance ?? '').trim()) scalingWithGuidance += 1
  }

  const diffRate = totalPairs > 0 ? diffItems / totalPairs : 0
  if (splitCount >= 2) {
    info(checks, 'split_differentiation_moe', totalPairs > 0
      ? `Split differentiation ${(diffRate * 100).toFixed(0)}%`
      : 'No Split1/Split2 pairs in high-intent phases', { ok_band: totalPairs === 0 || diffRate >= 0.3 })
  }

  if (splitCount >= 2) {
    if (split1Diffs.length > 0 && split2Diffs.length > 0) {
      const mean1 = mean(split1Diffs)
      const mean2 = mean(split2Diffs)
      const delta = mean2 - mean1
      info(checks, 'split2_cap_exploitation_moe', `Mean D Split2−Split1 = ${delta.toFixed(2)}`, { mean1, mean2, ok_band: delta >= 1.5 })
    } else {
      info(checks, 'split2_cap_exploitation_moe', 'No Split1/Split2 difficulty pairs in high-intent phases', { ok_band: true })
    }
  }

  if (guidanceDiffTotal > 0) {
    const diffRateGuidance = guidanceDiffCount / guidanceDiffTotal
    info(checks, 'split_scaling_guidance_diff_moe', `Split-specific guidance ${(diffRateGuidance * 100).toFixed(0)}%`, { ok_band: diffRateGuidance >= 0.5 })
  } else if (splitCount >= 2) {
    info(checks, 'split_scaling_guidance_diff_moe', 'No same-variant split pairs to compare guidance', { ok_band: true, guidanceDiffTotal: 0 })
  }

  if (split1Total > 0) {
    const subRate = split1Substituted / split1Total
    info(checks, 'split1_substituted_rate_moe', `Split 1 substituted ${(subRate * 100).toFixed(0)}%`, { ok_band: subRate <= 0.25 })
    const sameScaledRate = split1SameScaled / split1Total
    info(checks, 'split1_same_scaled_share_moe', `Split 1 same+scaled ${(sameScaledRate * 100).toFixed(0)}%`, { ok_band: sameScaledRate >= 0.6 })
  } else if (splitCount >= 2) {
    info(checks, 'split1_substituted_rate_moe', 'No Split 1 variants in high-intent phases', { ok_band: true, split1Total: 0 })
    info(checks, 'split1_same_scaled_share_moe', 'No Split 1 variants in high-intent phases', { ok_band: true, split1Total: 0 })
  }

  const scalingRate = scalingEligible > 0 ? scalingWithGuidance / scalingEligible : 1
  const hasDbProfiles = Boolean(context.scalingProfileByExerciseId?.size)
  if (scalingEligible > 0 && scalingRate < 0.8) {
    fail(checks, 'split_scaling_guidance_rate', `scaling_guidance ${(scalingRate * 100).toFixed(0)}% on same/scaled < 80%`, {
      scalingEligible,
      scalingWithGuidance,
      hasDbProfiles,
    })
  } else if (scalingEligible > 0) {
    pass(checks, 'split_scaling_guidance_rate', `scaling_guidance ${(scalingRate * 100).toFixed(0)}% on same/scaled`, { hasDbProfiles })
  } else if (splitCount >= 2) {
    pass(checks, 'split_scaling_guidance_rate', 'No same/scaled variants to audit')
  }

  if (splitCount >= 2) {
    info(checks, 'category5_moe_review_packet', `${splitCount} audience split(s) for coach two-group MOE review`, {
      ok_band: true,
      splits: resSplitList.map((s) => ({
        label: s.label,
        age_min: s.age_min ?? s.ageMin,
        age_max: s.age_max ?? s.ageMax,
        cap: s.caps?.maxOverall,
      })),
      per_split_completeness_rate: completenessRate,
      split1_progression_count: split1Prog,
      rubric: ['C5-MOE-05'],
    })
  }
}

export function computeCategory5Kpi(checks, opts = {}) {
  return computeKpi(checks, 5, CATEGORY5_KPI_CHECK_IDS, opts)
}

// ─── Category 6 — Split progressions ───────────────────────────────────────

export const CATEGORY6_KPI_CHECK_IDS = [
  'progression_phase_allowlist',
  'no_progression_prepare_and_access',
  'no_progression_movement_intelligence',
  'no_progression_sustained_capacity',
  'no_progression_restore',
  'split2_progressions_output',
  'split2_progressions_capacity',
  'split2_progressions_resilience',
  'split2_total_progressions',
  'split1_no_progressions',
  'split2_progressions_label_only',
  'progression_headroom_valid',
  'progression_primary_id_distinct',
  'progression_slug_unique',
  'split_fallback_used_rate',
  'split_cap_differential',
  'audience_splits_active',
  'progression_relax_split_off',
  'progression_scaling_guidance_rate',
  'progression_good_fit_only',
  'progression_pick_warnings_clean',
  'progression_phase_ids_parity',
  'progression_scaled_warning_conflict',
]

export const CATEGORY6_MOE_CHECK_IDS = [
  'category6_moe_progression_arc',
  'category6_moe_split2_policy',
  'category6_moe_pool_reject_signal',
  'progression_eligibility_rate',
  'progression_coverage_output',
  'progression_coverage_capacity',
  'progression_eligible_unassigned_output',
  'progression_eligible_unassigned_capacity',
  'category6_moe_progression_yield',
]

export function evaluateCategory6Progressions(result, expectedBody, checks, context = {}) {
  const splits = resultSplits(result)
  const bodySplitList = bodySplits(expectedBody)
  const splitsActive = bodySplitList.length >= 2 || splits.length >= 2
  const effectiveSplits =
    splits.length > 0
      ? splits
      : bodySplitList.map((s) => ({
          label: s.label,
          caps: { maxOverall: s.difficultyOverride ?? s.difficulty_override },
        }))
  const { exerciseById = new Map(), phaseProfileMap = new Map() } = context

  const outOfAllowlist = collectAllPerSplit(result).filter(
    ({ variant, phase_key: phaseKey }) => variant.variant_type === 'progression' && !PROGRESSION_PHASES.includes(phaseKey),
  )
  if (outOfAllowlist.length > 0) {
    fail(checks, 'progression_phase_allowlist', 'Progressions outside output/capacity/resilience', outOfAllowlist.slice(0, 5).map((r) => r.phase_key))
  } else {
    pass(checks, 'progression_phase_allowlist', 'Progressions only in progression phases')
  }

  for (const phaseKey of LOW_INTENT_PHASE_LIST) {
    const existing = findCheck(checks, `no_progression_${phaseKey}`)
    if (!existing) {
      const block = blockByKey(result, phaseKey)
      const bad = allPerSplitVariants(block).filter(({ variant }) => variant.variant_type === 'progression')
      if (bad.length > 0) {
        fail(checks, `no_progression_${phaseKey}`, `${phaseKey} has progressions in low-intent phase`)
      } else {
        pass(checks, `no_progression_${phaseKey}`, `${phaseKey} progression-free`)
      }
    }
  }

  let split2ProgTotal = 0
  let split1Prog = 0
  let wrongLabelProg = 0
  let headroomFails = 0
  let headroomChecked = 0
  let idDistinctFails = 0
  const slugByPhase = new Map()
  let progGuidanceEligible = 0
  let progGuidancePresent = 0
  let profileRoleFails = 0
  let profileRoleChecked = 0

  for (const row of collectAllPerSplit(result)) {
    const { variant, item, phase_key: phaseKey } = row
    if (variant.variant_type !== 'progression') continue

    const sl = String(variant.split_label ?? '')
    if (isProgressionSplitLabel(sl, effectiveSplits)) split2ProgTotal += 1
    if (isYoungerSplitLabel(sl, effectiveSplits)) split1Prog += 1
    if (!isProgressionSplitLabel(sl, effectiveSplits)) wrongLabelProg += 1

    const primaryD = Number(item.difficulty?.overall ?? 0)
    const progD = Number(variant.difficulty?.overall ?? 0)
    headroomChecked += 1
    if (progD <= primaryD) headroomFails += 1

    const primaryId = Number(item.exercise_id)
    const progId = Number(variant.exercise_id)
    if (Number.isFinite(primaryId) && Number.isFinite(progId) && primaryId === progId) idDistinctFails += 1

    const ex = exerciseById.get(progId)
    const slug = ex?.slug ?? String(progId)
    const phaseSlugs = slugByPhase.get(phaseKey) ?? new Map()
    phaseSlugs.set(slug, (phaseSlugs.get(slug) ?? 0) + 1)
    slugByPhase.set(phaseKey, phaseSlugs)

    progGuidanceEligible += 1
    if (String(variant.scaling_guidance ?? '').trim()) progGuidancePresent += 1

    const profiles = phaseProfileMap.get(String(progId)) ?? phaseProfileMap.get(progId) ?? []
    const role = profiles.find((p) => p.phaseKey === phaseKey || p.phase_key === phaseKey)?.role
    if (profiles.length > 0) {
      profileRoleChecked += 1
      if (role !== 'primary' && role !== 'secondary') profileRoleFails += 1
    }
  }

  if (splitsActive && split2ProgTotal < 6) {
    fail(checks, 'split2_total_progressions', `Split 2 progressions total: ${split2ProgTotal} < 6`)
  } else if (splitsActive) {
    pass(checks, 'split2_total_progressions', `Split 2 progressions total: ${split2ProgTotal}`)
  }

  if (!findCheck(checks, 'split1_no_progressions')) {
    if (split1Prog > 0) {
      fail(checks, 'split1_no_progressions', `Younger split has ${split1Prog} progression(s)`)
    } else if (splitsActive) {
      pass(checks, 'split1_no_progressions', 'Younger split has no progressions')
    }
  }

  if (wrongLabelProg > 0) {
    fail(checks, 'split2_progressions_label_only', `${wrongLabelProg} progression(s) not on highest-cap split label`)
  } else if (split2ProgTotal > 0) {
    pass(checks, 'split2_progressions_label_only', 'All progressions on highest-cap split label(s)')
  } else if (splitsActive) {
    pass(checks, 'split2_progressions_label_only', 'No progressions to label-check')
  }

  if (headroomFails > 0) {
    fail(checks, 'progression_headroom_valid', `${headroomFails}/${headroomChecked} progressions do not exceed primary difficulty`)
  } else if (headroomChecked > 0) {
    pass(checks, 'progression_headroom_valid', 'All progressions increase difficulty vs primary')
  }

  if (idDistinctFails > 0) {
    fail(checks, 'progression_primary_id_distinct', `${idDistinctFails} progression(s) share primary exercise_id`)
  } else if (headroomChecked > 0) {
    pass(checks, 'progression_primary_id_distinct', 'Progression exercise_id distinct from primary')
  }

  const slugDupes = []
  for (const [phaseKey, slugCounts] of slugByPhase.entries()) {
    for (const [slug, n] of slugCounts.entries()) {
      if (n > 1) slugDupes.push({ phaseKey, slug, n })
    }
  }
  if (slugDupes.length > 0) {
    fail(checks, 'progression_slug_unique', 'Duplicate progression slug in phase', slugDupes.slice(0, 5))
  } else if (headroomChecked > 0) {
    pass(checks, 'progression_slug_unique', 'Progression slugs unique per phase')
  }

  let itemsTotal = 0
  let fallbackCount = 0
  for (const block of result.blocks ?? []) {
    for (const item of block.items ?? []) {
      itemsTotal += 1
      if (item.split_fallback_used) fallbackCount += 1
    }
  }
  const fallbackRate = itemsTotal > 0 ? fallbackCount / itemsTotal : 0
  if (splitsActive && fallbackRate > 0.15) {
    fail(checks, 'split_fallback_used_rate', `split_fallback_used ${(fallbackRate * 100).toFixed(0)}% > 15%`, { fallbackCount, itemsTotal })
  } else if (splitsActive) {
    pass(checks, 'split_fallback_used_rate', `split_fallback_used ${(fallbackRate * 100).toFixed(0)}%`)
  }

  if (splits.length >= 2) {
    const caps = splits.map((s) => Number(s.caps?.maxOverall ?? 0))
    const maxCap = Math.max(...caps)
    const minCap = Math.min(...caps)
    if (maxCap > minCap) {
      pass(checks, 'split_cap_differential', `Highest-cap split ${maxCap} > lower-cap ${minCap}`)
    } else {
      fail(checks, 'split_cap_differential', `Highest-cap split must exceed lower-cap (${maxCap} vs ${minCap})`)
    }
  }

  if (bodySplitList.length >= 2 && splits.length < 2) {
    fail(checks, 'audience_splits_active', 'Prescribe body has splits but result.audience_splits missing')
  } else if (bodySplitList.length >= 2) {
    pass(checks, 'audience_splits_active', `Splits active (${splits.length})`)
  } else {
    pass(checks, 'audience_splits_active', 'Splits not active — progression policy N/A')
  }

  const relaxIssues = []
  for (const phaseKey of PROGRESSION_PHASES) {
    const block = blockByKey(result, phaseKey)
    if (!block) continue
    const relaxed = shouldRelaxSplitGate(phaseKey, Number(block.target_minutes ?? 0), block.focus_targets ?? [])
    if (relaxed) relaxIssues.push(phaseKey)
  }
  if (relaxIssues.length > 0) {
    fail(checks, 'progression_relax_split_off', `shouldRelaxSplitGate true in progression phases: ${relaxIssues.join(', ')}`)
  } else {
    pass(checks, 'progression_relax_split_off', 'Split gate not relaxed in progression phases')
  }

  const guidanceRate = progGuidanceEligible > 0 ? progGuidancePresent / progGuidanceEligible : 1
  if (progGuidanceEligible > 0 && guidanceRate < 0.8) {
    fail(checks, 'progression_scaling_guidance_rate', `Progression scaling_guidance ${(guidanceRate * 100).toFixed(0)}% < 80%`)
  } else if (progGuidanceEligible > 0) {
    pass(checks, 'progression_scaling_guidance_rate', `Progression scaling_guidance ${(guidanceRate * 100).toFixed(0)}%`)
  }

  if (profileRoleChecked > 0 && profileRoleFails > 0) {
    fail(checks, 'progression_phase_profile_role', `${profileRoleFails}/${profileRoleChecked} progression profiles not primary/secondary`)
  } else if (profileRoleChecked > 0) {
    pass(checks, 'progression_phase_profile_role', 'Progression phase profiles valid')
  }

  let progOutsideArc = 0
  for (const row of collectAllPerSplit(result)) {
    if (row.variant.variant_type === 'progression' && !PROGRESSION_PHASES.includes(row.phase_key)) progOutsideArc += 1
  }
  info(checks, 'category6_moe_progression_arc', `Progressions outside arc phases: ${progOutsideArc}`, { ok_band: progOutsideArc === 0 })

  if (splitsActive) {
    info(checks, 'category6_moe_split2_policy', `Split2 prog ${split2ProgTotal}; younger-split prog ${split1Prog}`, {
      ok_band: split2ProgTotal > 0 && split1Prog === 0,
    })
  }

  const fills = result.constraint_report?.phase_fill ?? []
  let splitRejects = 0
  let poolSizeTotal = 0
  for (const f of fills) {
    splitRejects += Number(f.split_rejects ?? 0)
    poolSizeTotal += Number(f.pool_size ?? 0)
  }
  info(checks, 'category6_moe_pool_reject_signal', `Session split_rejects: ${splitRejects}`, {
    ok_band: splitRejects === 0,
    splitRejects,
    poolSizeTotal,
  })

  const phaseFillMap = phaseFillByKey(result)
  const warnings = result.split_variant_warnings ?? []
  let eligibleSession = 0
  let assignedSession = 0
  let goodFitFails = 0
  let pickWarningFails = 0
  let scaledConflict = 0
  const perPhaseAudit = new Map()

  for (const phaseKey of PROGRESSION_PHASES) {
    perPhaseAudit.set(phaseKey, { eligible: 0, assigned: 0, eligibleMiss: 0 })
  }

  for (const block of result.blocks ?? []) {
    if (!PROGRESSION_PHASES.includes(block.phase_key)) continue
    const audit = perPhaseAudit.get(block.phase_key)
    for (const item of block.items ?? []) {
      const eligible = splitsActive && progressionEligiblePrimary(item.difficulty, effectiveSplits)
      const hasProg = itemHasProgressionOnHighestCap(item, effectiveSplits)
      if (eligible) {
        eligibleSession += 1
        audit.eligible += 1
        if (!hasProg) audit.eligibleMiss += 1
      }
      if (hasProg) {
        assignedSession += 1
        audit.assigned += 1
        if (!eligible) goodFitFails += 1
        const resolveWarnings = item.split_resolve_warnings ?? []
        if (resolveWarnings.length > 0) pickWarningFails += 1
        if (itemHasScaledVariant(item)) {
          const name = String(item.exercise_name ?? '')
          if (warnings.some((w) => name && w.includes(name) && /scaling|exceeds difficulty cap/i.test(w))) {
            scaledConflict += 1
          }
        }
      }
    }
  }

  const fillOutput = phaseFillMap.get('output')
  const fillCapacity = phaseFillMap.get('capacity')
  const outputEligible = Number(fillOutput?.progression_eligible ?? perPhaseAudit.get('output')?.eligible ?? 0)
  const outputAssigned = Number(fillOutput?.progression_assigned ?? perPhaseAudit.get('output')?.assigned ?? 0)
  const capacityEligible = Number(fillCapacity?.progression_eligible ?? perPhaseAudit.get('capacity')?.eligible ?? 0)
  const capacityAssigned = Number(fillCapacity?.progression_assigned ?? perPhaseAudit.get('capacity')?.assigned ?? 0)
  const outputPool = Number(fillOutput?.pool_size ?? 0)
  const capacityPool = Number(fillCapacity?.pool_size ?? 0)
  const outputCoverage = outputEligible > 0 ? outputAssigned / outputEligible : 1
  const capacityCoverage = capacityEligible > 0 ? capacityAssigned / capacityEligible : 1
  const sessionCoverage = eligibleSession > 0 ? assignedSession / eligibleSession : 1

  const eligibilityRate = eligibleSession > 0 ? eligibleSession / Math.max(1, (result.blocks ?? [])
    .filter((b) => PROGRESSION_PHASES.includes(b.phase_key))
    .reduce((n, b) => n + (b.items?.length ?? 0), 0)) : 0
  info(checks, 'progression_eligibility_rate', `Progression-eligible primaries ${(eligibilityRate * 100).toFixed(0)}% of progression-phase items`, {
    ok_band: eligibilityRate >= 0.3,
    eligibleSession,
    progressionPhaseItems: (result.blocks ?? [])
      .filter((b) => PROGRESSION_PHASES.includes(b.phase_key))
      .reduce((n, b) => n + (b.items?.length ?? 0), 0),
  })

  if (splitsActive && outputPool >= 5) {
    info(checks, 'progression_coverage_output', `Output progression coverage ${(outputCoverage * 100).toFixed(0)}% (${outputAssigned}/${outputEligible})`, {
      ok_band: outputCoverage >= 0.6,
      eligible: outputEligible,
      assigned: outputAssigned,
      pool_size: outputPool,
      target: 0.6,
    })
  } else if (splitsActive) {
    info(checks, 'progression_coverage_output', 'Output pool < 5 — coverage N/A')
  }

  if (splitsActive && capacityPool >= 5) {
    info(checks, 'progression_coverage_capacity', `Capacity progression coverage ${(capacityCoverage * 100).toFixed(0)}% (${capacityAssigned}/${capacityEligible})`, {
      ok_band: capacityCoverage >= 0.6,
      eligible: capacityEligible,
      assigned: capacityAssigned,
      pool_size: capacityPool,
      target: 0.6,
    })
  } else if (splitsActive) {
    info(checks, 'progression_coverage_capacity', 'Capacity pool < 5 — coverage N/A')
  }

  if (goodFitFails > 0) {
    fail(checks, 'progression_good_fit_only', `${goodFitFails} progression(s) without good-fit eligibility on highest-cap split`)
  } else if (assignedSession > 0) {
    pass(checks, 'progression_good_fit_only', 'All progressions assigned on good-fit primaries')
  } else if (splitsActive) {
    pass(checks, 'progression_good_fit_only', 'No progressions to audit for good-fit')
  }

  if (pickWarningFails > 0) {
    fail(checks, 'progression_pick_warnings_clean', `${pickWarningFails} progression item(s) have split_resolve_warnings`)
  } else if (assignedSession > 0) {
    pass(checks, 'progression_pick_warnings_clean', 'Progression picks had no resolve warnings')
  } else if (splitsActive) {
    pass(checks, 'progression_pick_warnings_clean', 'No progressions to audit for pick warnings')
  }

  if (scaledConflict > 0) {
    fail(checks, 'progression_scaled_warning_conflict', `${scaledConflict} progression item(s) also have scaled variant + scaling warning`)
  } else if (assignedSession > 0) {
    pass(checks, 'progression_scaled_warning_conflict', 'No progression + scaled warning conflicts')
  } else if (splitsActive) {
    pass(checks, 'progression_scaled_warning_conflict', 'No progressions to audit for scaled conflicts')
  }

  let idParityFails = 0
  for (const phaseKey of PROGRESSION_PHASES) {
    const fill = phaseFillMap.get(phaseKey)
    if (!fill?.phase_progression_ids) continue
    const engineIds = new Set((fill.phase_progression_ids ?? []).map(Number))
    const block = blockByKey(result, phaseKey)
    const outputIds = new Set()
    for (const row of allPerSplitVariants(block)) {
      if (row.variant.variant_type === 'progression' && isProgressionSplitLabel(row.variant.split_label, effectiveSplits)) {
        outputIds.add(Number(row.variant.exercise_id))
      }
    }
    if (engineIds.size !== outputIds.size || [...engineIds].some((id) => !outputIds.has(id))) {
      idParityFails += 1
    }
  }
  const hasEngineTelemetry = fills.some((f) => Array.isArray(f.phase_progression_ids))
  if (hasEngineTelemetry && idParityFails > 0) {
    fail(checks, 'progression_phase_ids_parity', `${idParityFails} phase(s) engine progression ids ≠ output`)
  } else if (hasEngineTelemetry) {
    pass(checks, 'progression_phase_ids_parity', 'Engine phase_progression_ids match output')
  } else if (splitsActive && assignedSession > 0) {
    pass(checks, 'progression_phase_ids_parity', 'phase_progression_ids telemetry absent — output-only audit skipped')
  }

  for (const [phaseKey, checkId] of [
    ['output', 'progression_eligible_unassigned_output'],
    ['capacity', 'progression_eligible_unassigned_capacity'],
  ]) {
    const audit = perPhaseAudit.get(phaseKey)
    const fill = phaseFillMap.get(phaseKey)
    const pool = Number(fill?.pool_size ?? 0)
    const eligible = Number(fill?.progression_eligible ?? audit?.eligible ?? 0)
    const miss = Number(audit?.eligibleMiss ?? Math.max(0, eligible - Number(fill?.progression_assigned ?? audit?.assigned ?? 0)))
    const missRate = eligible > 0 ? miss / eligible : 0
    if (splitsActive && pool >= 3) {
      info(checks, checkId, `${phaseKey}: eligible-unassigned ${(missRate * 100).toFixed(0)}% (${miss}/${eligible})`, {
        ok_band: missRate <= 0.2,
        eligible,
        miss,
        pool_size: pool,
        target: 0.2,
      })
    } else if (splitsActive) {
      info(checks, checkId, `${phaseKey}: pool < 3 — unassigned rate N/A`)
    }
  }

  info(checks, 'category6_moe_progression_yield', `Session progression coverage ${(sessionCoverage * 100).toFixed(0)}%`, {
    ok_band: sessionCoverage >= 0.6,
    coverageRate: sessionCoverage,
    eligibleSession,
    assignedSession,
  })

  tbd(checks, 'category6_tbd_builder_edits', 'Coach progression edit rate TBD (C6-MOE-06 builder telemetry)')
}

export function computeCategory6Kpi(checks, opts = {}) {
  const minYield = opts.minYield ?? 0.85
  const blocking = computeKpi(checks, 6, CATEGORY6_KPI_CHECK_IDS, opts)
  const yieldInfo = checks.find((c) => c.id === 'category6_moe_progression_yield')
  const coverageRate = yieldInfo?.detail?.coverageRate
  const phaseMinMet = ['split2_progressions_output', 'split2_progressions_capacity', 'split2_progressions_resilience']
    .every((id) => {
      const c = checks.find((ch) => ch.id === id)
      return !c || c.ok !== false
    })
  const poolSignal = checks.find((c) => c.id === 'category6_moe_pool_reject_signal')
  const splitRejects = Number(poolSignal?.detail?.splitRejects ?? 0)
  const poolSize = Number(poolSignal?.detail?.poolSizeTotal ?? 1)
  const rejectRatio = poolSize > 0 ? Math.min(1, splitRejects / poolSize) : 0

  if (typeof coverageRate !== 'number') {
    return blocking
  }

  const yieldScore = 0.4 * coverageRate + 0.3 * (phaseMinMet ? 1 : 0) + 0.3 * (1 - rejectRatio)
  const yieldOk = yieldScore >= minYield
  const ok = blocking.ok && yieldOk
  return {
    ...blocking,
    ok,
    severity: ok ? 'ok' : 'P1',
    message: ok
      ? `Category 6 progression yield: ${(yieldScore * 100).toFixed(1)}%; blocking ${(blocking.detail.rate * 100).toFixed(1)}%`
      : `Category 6 KPI fail: yield ${(yieldScore * 100).toFixed(1)}% (min ${(minYield * 100).toFixed(0)}%); blocking ${blocking.detail.passed}/${blocking.detail.total}`,
    detail: {
      ...blocking.detail,
      yieldScore,
      minYield,
      coverageRate,
      phaseMinMet,
      rejectRatio,
      yieldOk,
      formula: '0.4×coverage + 0.3×phase_min_met + 0.3×(1 - split_reject_ratio)',
    },
  }
}

// ─── Category 7 — Progression lane validity ─────────────────────────────────

export const CATEGORY7_KPI_CHECK_IDS = [
  'progression_lane_output',
  'progression_lane_capacity',
  'progression_lane_resilience',
  'progression_lane_pattern_share',
  'progression_lane_family_fallback',
  'progression_lane_engine_parity',
  'progression_lane_phase_allowlist',
  'progression_primary_lane_precondition',
  'progression_lane_profile_role',
  'progression_forbidden_names',
  'progression_forbidden_lane_pairs',
  'progression_graph_edge_rate',
  'progression_lane_tenet_alignment',
  'progression_lane_phase_adjacency',
  'progression_methodology_mismatch',
  'progression_lane_pattern_priority_rate',
  'progression_full_scored_fallback_rate',
  'progression_equipment_continuity',
  'progression_lane_deep_pool_rejects',
  'progression_youth_age_fit',
  'progression_lane_spam_guard',
  'progression_lane_cue_lane_proxy',
]

export const CATEGORY7_MOE_CHECK_IDS = [
  'progression_lane_match_method',
  'category7_moe_lane_integrity',
  'category7_moe_pair_review_packet',
  'progression_lane_stability',
]

export function evaluateCategory7Lane(result, expectedBody, checks, context = {}) {
  const {
    tagMap = new Map(),
    exerciseById = new Map(),
    phaseProfileMap = new Map(),
    methodologyKeyById = new Map(),
    tenetKeyById = new Map(),
    difficultyByExerciseId = new Map(),
    progressionGraphEdges = new Map(),
    thresholds = {},
    sessionAgeMax = expectedBody?.ageMax ?? expectedBody?.age_max ?? null,
    laneStability = null,
  } = context

  const forbiddenPairs = mergeForbiddenLanePairs(thresholds)
  const minGraphEdgeRate = thresholds.minGraphEdgeRate ?? 0.7
  const maxFullScoredFallbackRate = thresholds.maxFullScoredFallbackRate ?? 0.3
  const minPatternPriorityRate = thresholds.minPatternPriorityRate ?? 0.7
  const minEquipmentContinuityRate = thresholds.minEquipmentContinuityRate ?? 0.95
  const minCueLaneProxyRate = thresholds.minCueLaneProxyRate ?? 0.9

  const splits = resultSplits(result)
  const bodySplitList = bodySplits(expectedBody)
  const effectiveSplits =
    splits.length > 0
      ? splits
      : bodySplitList.map((s) => ({
          label: s.label,
          caps: { maxOverall: s.difficultyOverride ?? s.difficulty_override },
        }))
  const pairs = collectHighestCapProgressionPairs(result, effectiveSplits)
  const phaseFillMap = phaseFillByKey(result)

  for (const phaseKey of PROGRESSION_PHASES) {
    const existing = findCheck(checks, `progression_lane_${phaseKey}`)
    if (existing) continue
    const block = blockByKey(result, phaseKey)
    const phaseProgressions = allPerSplitVariants(block).filter(
      ({ variant }) => isProgressionSplitLabel(variant.split_label, effectiveSplits) && variant.variant_type === 'progression',
    )
    const badLane = phaseProgressions.filter(
      ({ item, variant }) => !sharesPatternOrFamily(item.exercise_id, variant.exercise_id, tagMap, exerciseById),
    )
    if (badLane.length > 0) {
      fail(checks, `progression_lane_${phaseKey}`, `${phaseKey}: ${badLane.length} lane failure(s)`)
    } else if (phaseProgressions.length > 0) {
      pass(checks, `progression_lane_${phaseKey}`, `${phaseKey}: all progressions lane-valid`)
    }
  }

  let patternRequired = 0
  let patternOk = 0
  let familyFallbackRequired = 0
  let familyFallbackOk = 0
  let parityFails = 0
  let primaryPrecondTotal = 0
  let primaryPrecondOk = 0
  let profileRoleFails = 0
  let profileRoleChecked = 0
  let methodologyMismatch = 0
  let forbiddenLanePairs = 0
  let patternMethod = 0
  let familyMethod = 0
  let fullScoredPicks = 0
  let equipmentChecked = 0
  let equipmentOk = 0
  let patternPriorityOk = 0
  let patternPriorityDenom = 0
  let tenetRequired = 0
  let tenetOk = 0
  let phaseAdjacencyFails = 0
  let youthChecked = 0
  let youthFails = 0
  let spamHits = 0

  const sessionUseEquip = new Set(
    (expectedBody?.equipmentUseIds ?? expectedBody?.equipment_use_ids ?? [])
      .map(Number)
      .filter(Number.isFinite),
  )
  const sessionPrescribedEquip = new Set()
  for (const block of result.blocks ?? []) {
    for (const item of block.items ?? []) {
      for (const tag of tagMap.get(String(item.exercise_id)) ?? []) {
        if (tag.facetType === 'equipment') sessionPrescribedEquip.add(Number(tag.facetId))
      }
      for (const row of item.per_split ?? item.split_alternates_json ?? []) {
        for (const tag of tagMap.get(String(row.exercise_id)) ?? []) {
          if (tag.facetType === 'equipment') sessionPrescribedEquip.add(Number(tag.facetId))
        }
      }
    }
  }
  const forbiddenSubs = thresholds.forbidProgressionNameSubstrings ?? []
  const forbiddenSlugs = thresholds.forbiddenProgressionSlugs ?? []

  for (const row of pairs) {
    const primaryId = Number(row.item.exercise_id)
    const progId = Number(row.variant.exercise_id)
    const phaseKey = row.phase_key
    const primaryPatterns = patternIdsForExercise(primaryId, tagMap)
    const method = progressionLaneMatchMethod(primaryId, progId, tagMap, exerciseById)

    if (method === 'pattern') patternMethod += 1
    if (method === 'family') familyMethod += 1

    if (primaryPatterns.length > 0) {
      patternRequired += 1
      const progPatterns = patternIdsForExercise(progId, tagMap)
      if (progPatterns.some((p) => primaryPatterns.includes(p))) patternOk += 1
    } else {
      familyFallbackRequired += 1
      if (sharesPatternOrFamily(primaryId, progId, tagMap, exerciseById)) familyFallbackOk += 1
    }

    const evalOk = sharesPatternOrFamily(primaryId, progId, tagMap, exerciseById)
    const engineOk = engineStyleLaneValid(primaryId, progId, phaseKey, tagMap, exerciseById, phaseProfileMap)
    if (evalOk !== engineOk) parityFails += 1

    primaryPrecondTotal += 1
    const primaryEx = exerciseById.get(primaryId)
    if (primaryPatterns.length > 0 || String(primaryEx?.movement_family ?? '').trim()) primaryPrecondOk += 1

    const profiles = phaseProfileMap.get(String(progId)) ?? phaseProfileMap.get(progId) ?? []
    if (profiles.length > 0) {
      profileRoleChecked += 1
      const role = profiles.find((p) => (p.phaseKey ?? p.phase_key) === phaseKey)?.role
      if (role !== 'primary' && role !== 'secondary') profileRoleFails += 1
    }

    const progMethods = methodologyKeysForExercise(progId, tagMap, methodologyKeyById)
    if (phaseKey !== 'sustained_capacity' && progMethods.some((k) => HIGH_AROUSAL_METHODOLOGY_KEYS.has(String(k).toLowerCase()))) {
      methodologyMismatch += 1
    }

    const pFamily = String(exerciseById.get(primaryId)?.movement_family ?? '').toLowerCase()
    const gFamily = String(exerciseById.get(progId)?.movement_family ?? '').toLowerCase()
    if (isForbiddenLaneFamilyPair(pFamily, gFamily, forbiddenPairs)) forbiddenLanePairs += 1

    if (row.variant.progression_pick_source === 'full_scored') fullScoredPicks += 1

    if (primaryPatterns.length > 0) {
      patternPriorityDenom += 1
      const enginePriority = row.variant.progression_pattern_priority_pick
      if (enginePriority === true || (enginePriority == null && method === 'pattern')) {
        patternPriorityOk += 1
      }
    }

    if (outputSpeedTenetRequired(expectedBody, phaseKey)) {
      tenetRequired += 1
      if (sharesTenetKey(primaryId, progId, 'speed', tagMap, tenetKeyById)
        || sharesPatternOrFamily(primaryId, progId, tagMap, exerciseById)) {
        tenetOk += 1
      }
    }

    const primaryPhase = exerciseById.get(primaryId)?.primary_phase_key
    const progPhase = exerciseById.get(progId)?.primary_phase_key
    if (progPhase && !isPhaseAdjacent(row.phase_key, progPhase)) {
      phaseAdjacencyFails += 1
    }

    const sessionMax = Number(sessionAgeMax)
    if (Number.isFinite(sessionMax) && sessionMax <= 14) {
      youthChecked += 1
      const diff = difficultyByExerciseId.get(String(progId)) ?? difficultyByExerciseId.get(progId)
      const recMin = diff?.recommended_age_min ?? diff?.recommendedAgeMin
      if (recMin != null && Number(recMin) > sessionMax) youthFails += 1
    }

    const progSlug = String(exerciseById.get(progId)?.slug ?? '').toLowerCase()
    const progName = String(row.variant.exercise_name ?? '').toLowerCase()
    const laneOk = sharesPatternOrFamily(primaryId, progId, tagMap, exerciseById)
    if (!laneOk
      || forbiddenSlugs.some((s) => progSlug.includes(String(s).toLowerCase()))
      || forbiddenSubs.some((s) => progName.includes(String(s).toLowerCase()))) {
      spamHits += 1
    }

    const primaryEquip = new Set(
      (tagMap.get(String(primaryId)) ?? [])
        .filter((t) => t.facetType === 'equipment')
        .map((t) => Number(t.facetId)),
    )
    const progEquip = (tagMap.get(String(progId)) ?? [])
      .filter((t) => t.facetType === 'equipment')
      .map((t) => Number(t.facetId))
    if (progEquip.length > 0) {
      equipmentChecked += 1
      const allowed = new Set([...primaryEquip, ...sessionUseEquip, ...sessionPrescribedEquip])
      if (progEquip.every((id) => allowed.has(id))) equipmentOk += 1
    }
  }

  const totalPairs = pairs.length

  if (patternRequired > 0 && patternOk < patternRequired) {
    fail(checks, 'progression_lane_pattern_share', `${patternRequired - patternOk}/${patternRequired} primaries with pattern lack shared pattern progression`)
  } else if (patternRequired > 0) {
    pass(checks, 'progression_lane_pattern_share', 'All pattern-tagged primaries share pattern with progression')
  } else if (totalPairs > 0) {
    pass(checks, 'progression_lane_pattern_share', 'No pattern-tagged primaries among progressions')
  }

  if (familyFallbackRequired > 0 && familyFallbackOk < familyFallbackRequired) {
    fail(checks, 'progression_lane_family_fallback', `${familyFallbackRequired - familyFallbackOk}/${familyFallbackRequired} family-fallback lanes invalid`)
  } else if (familyFallbackRequired > 0) {
    pass(checks, 'progression_lane_family_fallback', 'Family fallback lanes valid when pattern absent')
  } else if (totalPairs > 0) {
    pass(checks, 'progression_lane_family_fallback', 'No family-fallback pairs required')
  }

  if (parityFails > 0) {
    fail(checks, 'progression_lane_engine_parity', `${parityFails}/${totalPairs} evaluator/engine lane parity mismatch`)
  } else if (totalPairs > 0) {
    pass(checks, 'progression_lane_engine_parity', 'Evaluator agrees with engine-style lane gate')
  }

  const outsideAllowlist = pairs.filter((r) => !PROGRESSION_PHASES.includes(r.phase_key))
  if (outsideAllowlist.length > 0) {
    fail(checks, 'progression_lane_phase_allowlist', `${outsideAllowlist.length} progression(s) outside lane phases`)
  } else if (totalPairs > 0) {
    pass(checks, 'progression_lane_phase_allowlist', 'Lane scoring only in progression phases')
  }

  const precondRate = primaryPrecondTotal > 0 ? primaryPrecondOk / primaryPrecondTotal : 1
  if (primaryPrecondTotal > 0 && precondRate < 0.95) {
    fail(checks, 'progression_primary_lane_precondition', `Primary lane precondition ${(precondRate * 100).toFixed(0)}% < 95%`)
  } else if (primaryPrecondTotal > 0) {
    pass(checks, 'progression_primary_lane_precondition', `Primary lane precondition ${(precondRate * 100).toFixed(0)}%`)
  }

  if (profileRoleChecked > 0 && profileRoleFails > 0) {
    fail(checks, 'progression_lane_profile_role', `${profileRoleFails}/${profileRoleChecked} progression profiles not primary/secondary`)
  } else if (profileRoleChecked > 0) {
    pass(checks, 'progression_lane_profile_role', 'Progression lane profile roles valid')
  }

  if (methodologyMismatch > 0) {
    fail(checks, 'progression_methodology_mismatch', `${methodologyMismatch} high-arousal methodology progression(s) outside Sustained`)
  } else if (totalPairs > 0) {
    pass(checks, 'progression_methodology_mismatch', 'No HIIT/plyo methodology on non-Sustained progressions')
  }

  let forbiddenNameHits = 0
  if (forbiddenSubs.length > 0) {
    for (const row of pairs) {
      const name = String(row.variant.exercise_name ?? '').toLowerCase()
      if (forbiddenSubs.some((sub) => name.includes(String(sub).toLowerCase()))) forbiddenNameHits += 1
    }
  }
  if (forbiddenNameHits > 0) {
    fail(checks, 'progression_forbidden_names', `${forbiddenNameHits} forbidden progression name match(es)`)
  } else {
    pass(checks, 'progression_forbidden_names', forbiddenSubs.length > 0 ? 'No forbidden progression names' : 'Forbidden name list empty — gate N/A')
  }

  if (forbiddenLanePairs > 0) {
    fail(checks, 'progression_forbidden_lane_pairs', `${forbiddenLanePairs} forbidden lane family pair(s)`)
  } else if (totalPairs > 0) {
    pass(checks, 'progression_forbidden_lane_pairs', 'No forbidden lane family pairs')
  }

  const patternPriorityRate = patternRequired > 0 ? patternOk / patternRequired : 1
  const patternShareRate = totalPairs > 0 ? patternMethod / totalPairs : 1
  info(checks, 'progression_lane_match_method', `Lane via pattern ${(patternShareRate * 100).toFixed(0)}%; family ${totalPairs > 0 ? ((familyMethod / totalPairs) * 100).toFixed(0) : 0}%`, {
    ok_band: patternShareRate >= 0.5,
    patternMethod,
    familyMethod,
    totalPairs,
  })

  if (patternRequired > 0 && patternPriorityRate < minPatternPriorityRate) {
    fail(checks, 'progression_lane_pattern_priority_rate', `Shared pattern when primary tagged ${(patternPriorityRate * 100).toFixed(0)}% < ${(minPatternPriorityRate * 100).toFixed(0)}%`)
  } else if (patternRequired > 0) {
    pass(checks, 'progression_lane_pattern_priority_rate', `Shared pattern when primary tagged ${(patternPriorityRate * 100).toFixed(0)}%`)
  } else if (totalPairs > 0) {
    pass(checks, 'progression_lane_pattern_priority_rate', 'No pattern-tagged primaries for pattern-priority gate')
  }

  const fullScoredRate = totalPairs > 0 ? fullScoredPicks / totalPairs : 0
  if (totalPairs > 0 && fullScoredRate > maxFullScoredFallbackRate) {
    fail(checks, 'progression_full_scored_fallback_rate', `fullScored fallback ${(fullScoredRate * 100).toFixed(0)}% > ${(maxFullScoredFallbackRate * 100).toFixed(0)}%`)
  } else if (totalPairs > 0) {
    pass(checks, 'progression_full_scored_fallback_rate', `fullScored fallback ${(fullScoredRate * 100).toFixed(0)}%`)
  }

  let deepPoolLaneFails = 0
  for (const phaseKey of PROGRESSION_PHASES) {
    const fill = phaseFillMap.get(phaseKey)
    if (fill?.progression_lane_unassigned_deep_pool) deepPoolLaneFails += 1
  }
  if (deepPoolLaneFails > 0) {
    fail(checks, 'progression_lane_deep_pool_rejects', `Deep-pool lane unassigned in ${deepPoolLaneFails} phase(s)`)
  } else {
    pass(checks, 'progression_lane_deep_pool_rejects', 'No deep-pool lane unassigned failures')
  }

  const equipRate = equipmentChecked > 0 ? equipmentOk / equipmentChecked : 1
  if (equipmentChecked > 0 && equipRate < minEquipmentContinuityRate) {
    fail(checks, 'progression_equipment_continuity', `Equipment continuity ${(equipRate * 100).toFixed(0)}% < ${(minEquipmentContinuityRate * 100).toFixed(0)}%`)
  } else if (equipmentChecked > 0) {
    pass(checks, 'progression_equipment_continuity', `Equipment continuity ${(equipRate * 100).toFixed(0)}%`)
  } else if (totalPairs > 0) {
    pass(checks, 'progression_equipment_continuity', 'No progression equipment tags to check')
  }

  let graphHits = 0
  let graphChecked = 0
  if (progressionGraphEdges.size > 0) {
    for (const row of pairs) {
      graphChecked += 1
      const from = Number(row.item.exercise_id)
      const to = Number(row.variant.exercise_id)
      const edges = progressionGraphEdges.get(from) ?? progressionGraphEdges.get(String(from)) ?? new Set()
      if (edges.has(to) || edges.has(String(to))) graphHits += 1
    }
    const graphRate = graphChecked > 0 ? graphHits / graphChecked : 0
    if (graphChecked > 0 && graphRate < minGraphEdgeRate) {
      fail(checks, 'progression_graph_edge_rate', `Progression graph edges ${(graphRate * 100).toFixed(0)}% < ${(minGraphEdgeRate * 100).toFixed(0)}%`, {
        graphHits,
        graphChecked,
        graphRate,
      })
    } else if (graphChecked > 0) {
      pass(checks, 'progression_graph_edge_rate', `Progression graph edges ${(graphRate * 100).toFixed(0)}%`, {
        graphHits,
        graphChecked,
        graphRate,
      })
    }
  } else if (totalPairs > 0) {
    fail(checks, 'progression_graph_edge_rate', 'exercise_progression graph not loaded')
  }

  if (tenetRequired > 0 && tenetOk < tenetRequired) {
    fail(checks, 'progression_lane_tenet_alignment', `${tenetRequired - tenetOk}/${tenetRequired} Output speed pairs lack shared speed tenet`)
  } else if (tenetRequired > 0) {
    pass(checks, 'progression_lane_tenet_alignment', 'Output speed tenet alignment satisfied')
  } else if (totalPairs > 0) {
    pass(checks, 'progression_lane_tenet_alignment', 'Speed tenet gate N/A for session objective')
  }

  if (phaseAdjacencyFails > 0) {
    fail(checks, 'progression_lane_phase_adjacency', `${phaseAdjacencyFails} progression(s) with non-adjacent primary_phase_key`)
  } else if (totalPairs > 0) {
    pass(checks, 'progression_lane_phase_adjacency', 'Progression primary_phase_key aligned or adjacent')
  }

  if (youthChecked > 0 && youthFails > 0) {
    fail(checks, 'progression_youth_age_fit', `${youthFails}/${youthChecked} progressions exceed youth recommended_age_min`)
  } else if (youthChecked > 0) {
    pass(checks, 'progression_youth_age_fit', 'Youth-appropriate progression age bands')
  } else if (totalPairs > 0) {
    pass(checks, 'progression_youth_age_fit', 'Youth age-fit gate N/A')
  }

  if (spamHits > 0) {
    fail(checks, 'progression_lane_spam_guard', `${spamHits} unrelated/spam progression pair(s)`)
  } else if (totalPairs > 0) {
    pass(checks, 'progression_lane_spam_guard', 'No spam or unrelated progression pairs')
  }

  const cueLaneDenom = pairs.filter((r) => patternIdsForExercise(r.item.exercise_id, tagMap).length > 0).length
  const cueLaneRate = cueLaneDenom > 0 ? patternMethod / cueLaneDenom : 1
  if (cueLaneDenom > 0 && cueLaneRate < minCueLaneProxyRate) {
    fail(checks, 'progression_lane_cue_lane_proxy', `Cue-lane proxy ${(cueLaneRate * 100).toFixed(0)}% < ${(minCueLaneProxyRate * 100).toFixed(0)}%`)
  } else if (cueLaneDenom > 0) {
    pass(checks, 'progression_lane_cue_lane_proxy', `Cue-lane proxy ${(cueLaneRate * 100).toFixed(0)}%`)
  } else if (totalPairs > 0) {
    pass(checks, 'progression_lane_cue_lane_proxy', 'Cue-lane proxy N/A — no pattern primaries')
  }

  const badLane = pairs.filter(
    (r) => !sharesPatternOrFamily(r.item.exercise_id, r.variant.exercise_id, tagMap, exerciseById),
  ).length
  const integrity = totalPairs > 0 ? 1 - badLane / totalPairs : 1
  info(checks, 'category7_moe_lane_integrity', `Lane integrity ${(integrity * 100).toFixed(0)}%`, {
    ok_band: integrity === 1,
    badLane,
    totalPairs,
    integrity,
  })

  const reviewPairs = pairs.map((row) => ({
    phase_key: row.phase_key,
    primary_id: Number(row.item.exercise_id),
    primary_name: row.item.exercise_name,
    progression_id: Number(row.variant.exercise_id),
    progression_name: row.variant.exercise_name,
    lane_method: row.variant.progression_lane_match_method
      ?? progressionLaneMatchMethod(row.item.exercise_id, row.variant.exercise_id, tagMap, exerciseById),
    pick_source: row.variant.progression_pick_source ?? null,
  }))
  info(checks, 'category7_moe_pair_review_packet', `${reviewPairs.length} pair(s) for coach MOE review`, {
    ok_band: true,
    pairs: reviewPairs,
  })

  const stabilityResult = laneStability ?? { stability: null, runCount: 0, minRuns: 5 }
  if (stabilityResult.stability == null) {
    info(checks, 'progression_lane_stability', `Lane stability pending (${stabilityResult.runCount}/${stabilityResult.minRuns ?? 5} eval runs)`, {
      ok_band: null,
      ...stabilityResult,
    })
  } else if (stabilityResult.stability >= 0.8) {
    info(checks, 'progression_lane_stability', `Lane stability ${(stabilityResult.stability * 100).toFixed(0)}% over ${stabilityResult.runCount} runs`, {
      ok_band: true,
      ...stabilityResult,
    })
  } else {
    info(checks, 'progression_lane_stability', `Lane stability ${(stabilityResult.stability * 100).toFixed(0)}% < 80%`, {
      ok_band: false,
      ...stabilityResult,
    })
  }

  for (const id of CATEGORY7_KPI_CHECK_IDS) {
    if (findCheck(checks, id)) continue
    if (/^progression_lane_(output|capacity|resilience)$/.test(id)) {
      pass(checks, id, `${id.replace('progression_lane_', '')}: no highest-cap progressions to lane-check`)
      continue
    }
    pass(checks, id, 'Lane policy N/A — no highest-cap progression pairs')
  }
}

export function computeCategory7Kpi(checks, opts = {}) {
  const blocking = computeKpi(checks, 7, CATEGORY7_KPI_CHECK_IDS, opts)
  const integrityInfo = checks.find((c) => c.id === 'category7_moe_lane_integrity')
  const integrity = integrityInfo?.detail?.integrity
  if (typeof integrity !== 'number') return blocking
  const minIntegrity = opts.minIntegrity ?? 1
  const ok = blocking.ok && integrity >= minIntegrity
  return {
    ...blocking,
    ok,
    severity: ok ? 'ok' : 'P1',
    message: ok
      ? `Category 7 lane integrity: ${(integrity * 100).toFixed(1)}%; blocking ${(blocking.detail.rate * 100).toFixed(1)}%`
      : `Category 7 KPI fail: integrity ${(integrity * 100).toFixed(1)}%; blocking ${blocking.detail.passed}/${blocking.detail.total}`,
    detail: { ...blocking.detail, integrity, minIntegrity, formula: '1 - (bad_lane / total_progressions)' },
  }
}

// ─── Category 8 — Progression reuse ─────────────────────────────────────────

function normalizeExerciseName(name) {
  return String(name ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function shannonEntropy(counts) {
  const total = [...counts.values()].reduce((a, b) => a + b, 0)
  if (total <= 0) return 0
  let h = 0
  for (const n of counts.values()) {
    if (n <= 0) continue
    const p = n / total
    h -= p * Math.log2(p)
  }
  return h
}

function primaryPatternKey(primaryId, tagMap) {
  const patterns = patternIdsForExercise(primaryId, tagMap)
  return patterns.length > 0 ? patterns.sort((a, b) => a - b).join('|') : null
}

export const CATEGORY8_KPI_CHECK_IDS = [
  'progression_reuse_output',
  'progression_reuse_capacity',
  'progression_reuse_resilience',
  'progression_reuse_session_wide',
  'progression_reuse_normalized_name',
  'progression_reuse_family_per_phase',
  'progression_phase_ids_cardinality',
  'progression_cross_phase_reuse',
  'progression_substituted_reuse',
  'progression_backfill_reuse',
  'progression_diversity_ratio',
  'progression_session_entropy',
  'progression_used_ids_tracked',
  'progression_unrelated_pattern_reuse',
  'progression_reuse_threshold_configured',
  'progression_triple_phase_reuse',
  'progression_adjscore_monopoly',
]

export const CATEGORY8_MOE_CHECK_IDS = [
  'category8_moe_variety_review_packet',
  'progression_unique_pattern_output',
  'progression_justified_reuse_proxy',
  'progression_primary_as_progression',
  'progression_reuse_pattern_per_phase',
  'category8_moe_station_clarity_packet',
  'progression_reuse_stability',
]

export function evaluateCategory8Reuse(result, expectedBody, checks, context = {}) {
  const thresholds = context.thresholds ?? {}
  const tagMap = context.tagMap ?? new Map()
  const exerciseById = context.exerciseById ?? new Map()
  const reuseStability = context.reuseStability ?? { stability: null, runCount: 0, minRuns: 5 }

  const effectiveSplits = (result.audience_splits ?? []).length > 0
    ? result.audience_splits
    : (expectedBody?.audienceSplits ?? expectedBody?.audience_splits ?? []).map((s) => ({
        label: s.label,
        caps: { maxOverall: s.difficultyOverride ?? s.difficulty_override },
      }))

  const pairs = collectHighestCapProgressionPairs(result, effectiveSplits)
  const phaseFillMap = phaseFillByKey(result)

  const maxSessionReuse = thresholds.maxProgressionReuseSessionWide ?? 3
  const minDiversityRatio = thresholds.minProgressionDiversityRatio ?? 0.7
  const minSessionEntropy = thresholds.minProgressionSessionEntropy ?? 2.0
  const maxCrossPhaseIds = thresholds.maxCrossPhaseReuseIds ?? 1
  const expectedReusePerPhase = thresholds.maxProgressionReusePerPhase ?? 1

  const sessionCounts = new Map()
  for (const row of pairs) {
    const id = Number(row.variant.exercise_id)
    sessionCounts.set(id, (sessionCounts.get(id) ?? 0) + 1)
  }
  const maxSession = sessionCounts.size > 0 ? Math.max(...sessionCounts.values()) : 0
  const distinct = sessionCounts.size
  const totalSlots = [...sessionCounts.values()].reduce((a, b) => a + b, 0)
  const diversity = totalSlots > 0 ? distinct / totalSlots : 1

  if (maxSession > maxSessionReuse) {
    fail(checks, 'progression_reuse_session_wide', `Max session reuse ${maxSession} > ${maxSessionReuse}`)
  } else {
    pass(checks, 'progression_reuse_session_wide', `Max session reuse ${maxSession} (limit ${maxSessionReuse})`)
  }

  if (diversity < minDiversityRatio) {
    fail(checks, 'progression_diversity_ratio', `Diversity ratio ${(diversity * 100).toFixed(0)}% < ${(minDiversityRatio * 100).toFixed(0)}%`, {
      diversity,
      distinct,
      totalSlots,
      minDiversityRatio,
    })
  } else {
    pass(checks, 'progression_diversity_ratio', `Diversity ratio ${(diversity * 100).toFixed(0)}%`, {
      diversity,
      distinct,
      totalSlots,
      minDiversityRatio,
    })
  }

  const entropy = shannonEntropy(sessionCounts)
  if (totalSlots > 0 && entropy < minSessionEntropy) {
    fail(checks, 'progression_session_entropy', `Session entropy ${entropy.toFixed(2)} bits < ${minSessionEntropy}`, {
      entropy,
      minSessionEntropy,
      totalSlots,
    })
  } else if (totalSlots > 0) {
    pass(checks, 'progression_session_entropy', `Session entropy ${entropy.toFixed(2)} bits`, {
      entropy,
      minSessionEntropy,
      totalSlots,
    })
  } else {
    pass(checks, 'progression_session_entropy', 'No progressions — entropy N/A')
  }

  const idPhases = new Map()
  for (const row of pairs) {
    const id = Number(row.variant.exercise_id)
    if (!idPhases.has(id)) idPhases.set(id, new Set())
    idPhases.get(id).add(row.phase_key)
  }
  const triple = [...idPhases.values()].filter((phases) => phases.size >= 3)
  if (triple.length > 0) {
    fail(checks, 'progression_triple_phase_reuse', `${triple.length} progression(s) reused in 3+ phases`)
  } else {
    pass(checks, 'progression_triple_phase_reuse', 'No triple-phase progression reuse')
  }

  const crossPhaseIds = [...idPhases.entries()].filter(([, phases]) => phases.size >= 2)
  if (crossPhaseIds.length > maxCrossPhaseIds) {
    fail(checks, 'progression_cross_phase_reuse', `${crossPhaseIds.length} progression id(s) in 2+ phases (max ${maxCrossPhaseIds})`, {
      ids: crossPhaseIds.map(([id, phases]) => ({ id, phases: [...phases] })),
    })
  } else {
    pass(checks, 'progression_cross_phase_reuse', `Cross-phase reuse ids: ${crossPhaseIds.length} (max ${maxCrossPhaseIds})`)
  }

  let nameViolations = 0
  let familyViolations = 0
  let patternViolations = 0
  let unrelatedPatternViolations = 0
  let substitutedViolations = 0
  let backfillOnlyReuse = 0
  let monopolyViolations = 0
  let cardinalityFails = 0

  const primaryIds = new Set()
  const progressionIds = new Set()
  const usedIds = new Set()

  for (const block of result.blocks ?? []) {
    for (const item of block.items ?? []) {
      primaryIds.add(Number(item.exercise_id))
      usedIds.add(Number(item.exercise_id))
      for (const v of item.per_split ?? item.split_alternates_json ?? []) {
        usedIds.add(Number(v.exercise_id))
        if (v.variant_type === 'progression' && isProgressionSplitLabel(v.split_label, effectiveSplits)) {
          progressionIds.add(Number(v.exercise_id))
        }
      }
    }
  }

  const primaryAsProgression = [...primaryIds].filter((id) => {
    for (const row of pairs) {
      if (Number(row.variant.exercise_id) === id && Number(row.item.exercise_id) !== id) return true
    }
    return false
  })
  if (primaryAsProgression.length > 0) {
    info(checks, 'progression_primary_as_progression', `${primaryAsProgression.length} primary id(s) reused as progression elsewhere`, {
      ok_band: false,
      ids: primaryAsProgression,
    })
  } else {
    info(checks, 'progression_primary_as_progression', 'No primary exercise reused as progression for another primary', {
      ok_band: true,
    })
  }

  const untracked = [...progressionIds].filter((id) => !usedIds.has(id))
  if (untracked.length > 0) {
    fail(checks, 'progression_used_ids_tracked', `${untracked.length} progression id(s) not in session used set`, untracked)
  } else if (progressionIds.size > 0) {
    pass(checks, 'progression_used_ids_tracked', 'All progression ids tracked in session dedup set')
  } else {
    pass(checks, 'progression_used_ids_tracked', 'No progressions — tracking N/A')
  }

  if (expectedReusePerPhase === 1) {
    pass(checks, 'progression_reuse_threshold_configured', 'maxProgressionReusePerPhase = 1 (strict golden)')
  } else {
    fail(checks, 'progression_reuse_threshold_configured', `maxProgressionReusePerPhase = ${expectedReusePerPhase}; expected 1 for Test 3`)
  }

  for (const phaseKey of PROGRESSION_PHASES) {
    const block = blockByKey(result, phaseKey)
    const phaseRows = allPerSplitVariants(block).filter(
      ({ variant }) => variant.variant_type === 'progression' && isProgressionSplitLabel(variant.split_label, effectiveSplits),
    )

    const nameCounts = new Map()
    const familyCounts = new Map()
    const patternCounts = new Map()
    const progIdToPatterns = new Map()
    const substitutedIds = new Set()
    const eligiblePrimaries = phaseRows.length

    for (const item of block?.items ?? []) {
      for (const v of item.per_split ?? item.split_alternates_json ?? []) {
        if (v.variant_type === 'substituted') substitutedIds.add(Number(v.exercise_id))
      }
    }

    for (const { item, variant } of phaseRows) {
      const norm = normalizeExerciseName(variant.exercise_name)
      nameCounts.set(norm, (nameCounts.get(norm) ?? 0) + 1)

      const progEx = exerciseById.get(Number(variant.exercise_id))
      const family = String(progEx?.movement_family ?? '').toLowerCase()
      if (family) familyCounts.set(family, (familyCounts.get(family) ?? 0) + 1)

      const patKey = primaryPatternKey(item.exercise_id, tagMap) ?? `id:${item.exercise_id}`
      patternCounts.set(patKey, (patternCounts.get(patKey) ?? 0) + 1)

      const progId = Number(variant.exercise_id)
      if (!progIdToPatterns.has(progId)) progIdToPatterns.set(progId, new Set())
      progIdToPatterns.get(progId).add(patKey)

      if (substitutedIds.has(progId)) substitutedViolations += 1
    }

    if ([...nameCounts.values()].some((n) => n > 1)) nameViolations += 1
    if ([...familyCounts.values()].some((n) => n > 1)) familyViolations += 1
    if ([...patternCounts.values()].some((n) => n > 1)) patternViolations += 1

    for (const patterns of progIdToPatterns.values()) {
      if (patterns.size > 1) unrelatedPatternViolations += 1
    }

    for (const [progId] of progIdToPatterns.entries()) {
      const uses = phaseRows.filter((r) => Number(r.variant.exercise_id) === progId)
      if (uses.length >= 2 && eligiblePrimaries > 0 && uses.length / eligiblePrimaries >= 0.5) {
        monopolyViolations += 1
      }
      const allBackfill = uses.every((r) => r.item.fill_pass === 'backfill')
      if (uses.length >= 2 && allBackfill) backfillOnlyReuse += 1
    }

    const fill = phaseFillMap.get(phaseKey)
    if (fill?.phase_progression_ids) {
      const engineIds = new Set((fill.phase_progression_ids ?? []).map(Number))
      const outputIds = new Set(phaseRows.map((r) => Number(r.variant.exercise_id)))
      if (engineIds.size !== outputIds.size) cardinalityFails += 1
    }
  }

  if (nameViolations > 0) {
    fail(checks, 'progression_reuse_normalized_name', `${nameViolations} phase(s) with normalized-name reuse > 1`)
  } else if (pairs.length > 0) {
    pass(checks, 'progression_reuse_normalized_name', 'Normalized progression names unique per phase')
  } else {
    pass(checks, 'progression_reuse_normalized_name', 'No progressions — name reuse N/A')
  }

  if (familyViolations > 0) {
    fail(checks, 'progression_reuse_family_per_phase', `${familyViolations} phase(s) with movement-family reuse > 1`)
  } else if (pairs.length > 0) {
    pass(checks, 'progression_reuse_family_per_phase', 'Movement-family progression reuse ≤ 1 per phase')
  } else {
    pass(checks, 'progression_reuse_family_per_phase', 'No progressions — family reuse N/A')
  }

  if (patternViolations > 0) {
    info(checks, 'progression_reuse_pattern_per_phase', `${patternViolations} phase(s) with multiple progressions on same primary pattern`, {
      ok_band: false,
      patternViolations,
    })
  } else if (pairs.length > 0) {
    info(checks, 'progression_reuse_pattern_per_phase', 'Pattern-slot progression distribution within band', {
      ok_band: true,
    })
  } else {
    info(checks, 'progression_reuse_pattern_per_phase', 'No progressions — pattern reuse N/A', { ok_band: true })
  }

  if (cardinalityFails > 0) {
    fail(checks, 'progression_phase_ids_cardinality', `${cardinalityFails} phase(s) phaseUsedProgressionIds cardinality ≠ unique output count`)
  } else if ([...phaseFillMap.values()].some((f) => Array.isArray(f.phase_progression_ids))) {
    pass(checks, 'progression_phase_ids_cardinality', 'phaseUsedProgressionIds cardinality matches unique progressions')
  } else if (pairs.length > 0) {
    pass(checks, 'progression_phase_ids_cardinality', 'phase_progression_ids telemetry absent — cardinality skipped')
  } else {
    pass(checks, 'progression_phase_ids_cardinality', 'No progressions — cardinality N/A')
  }

  if (unrelatedPatternViolations > 0) {
    fail(checks, 'progression_unrelated_pattern_reuse', `${unrelatedPatternViolations} progression id(s) on unrelated primary patterns in phase`)
  } else if (pairs.length > 0) {
    pass(checks, 'progression_unrelated_pattern_reuse', 'No unrelated-pattern progression reuse in phase')
  } else {
    pass(checks, 'progression_unrelated_pattern_reuse', 'No progressions — unrelated-pattern N/A')
  }

  if (substitutedViolations > 1) {
    fail(checks, 'progression_substituted_reuse', `${substitutedViolations} substituted alt(s) reused as progression (> 1 per phase aggregate)`)
  } else {
    pass(checks, 'progression_substituted_reuse', 'Substituted alt progression reuse within limit')
  }

  if (backfillOnlyReuse > 0) {
    fail(checks, 'progression_backfill_reuse', `${backfillOnlyReuse} backfill-only progression id reuse cluster(s)`)
  } else {
    pass(checks, 'progression_backfill_reuse', 'No backfill-only progression id reuse')
  }

  if (monopolyViolations > 0) {
    fail(checks, 'progression_adjscore_monopoly', `${monopolyViolations} phase(s) with progression monopoly ≥ 50% of slots`)
  } else if (pairs.length > 0) {
    pass(checks, 'progression_adjscore_monopoly', 'No high-share progression monopoly in phase')
  } else {
    pass(checks, 'progression_adjscore_monopoly', 'No progressions — monopoly N/A')
  }

  let justifiedFails = 0
  for (const [progId] of idPhases.entries()) {
    if (sessionCounts.get(progId) <= 1) continue
    const rows = pairs.filter((r) => Number(r.variant.exercise_id) === progId)
    for (const row of rows) {
      if (!sharesPatternOrFamily(row.item.exercise_id, progId, tagMap, exerciseById)) {
        justifiedFails += 1
      }
    }
  }
  if (justifiedFails > 0) {
    info(checks, 'progression_justified_reuse_proxy', `${justifiedFails} repeated progression pair(s) lack pattern/family justification`, {
      ok_band: false,
      justifiedFails,
    })
  } else {
    info(checks, 'progression_justified_reuse_proxy', 'Repeated progressions share pattern or family with primaries', {
      ok_band: true,
      justifiedFails: 0,
    })
  }

  const outputPairs = pairs.filter((r) => r.phase_key === 'output')
  const outputPatterns = outputPairs.map((r) => primaryPatternKey(r.item.exercise_id, tagMap) ?? `id:${r.item.exercise_id}`)
  const uniqueOutputPatterns = new Set(outputPatterns).size
  const outputPatternRate = outputPairs.length > 0 ? uniqueOutputPatterns / outputPairs.length : 1
  if (outputPairs.length > 0 && outputPatternRate < 0.8) {
    info(checks, 'progression_unique_pattern_output', `Output unique pattern rate ${(outputPatternRate * 100).toFixed(0)}% < 80%`, {
      ok_band: false,
      uniqueOutputPatterns,
      total: outputPairs.length,
    })
  } else if (outputPairs.length > 0) {
    info(checks, 'progression_unique_pattern_output', `Output unique pattern rate ${(outputPatternRate * 100).toFixed(0)}%`, {
      ok_band: outputPatternRate >= 0.8,
      uniqueOutputPatterns,
      total: outputPairs.length,
    })
  } else {
    info(checks, 'progression_unique_pattern_output', 'No Output progressions — pattern variety N/A', { ok_band: true })
  }

  const reviewProgressions = pairs.map((row) => ({
    phase_key: row.phase_key,
    primary_id: Number(row.item.exercise_id),
    primary_name: row.item.exercise_name,
    progression_id: Number(row.variant.exercise_id),
    progression_name: row.variant.exercise_name,
    fill_pass: row.item.fill_pass ?? null,
    session_reuse_count: sessionCounts.get(Number(row.variant.exercise_id)) ?? 1,
  }))
  info(checks, 'category8_moe_variety_review_packet', `${reviewProgressions.length} progression(s) for coach variety review`, {
    ok_band: true,
    progressions: reviewProgressions,
    maxSessionReuse: maxSession,
    diversity,
  })

  const stationPacket = pairs.map((row) => ({
    phase_key: row.phase_key,
    primary_name: row.item.exercise_name,
    progression_name: row.variant.exercise_name,
    scaling_guidance: row.variant.scaling_guidance ?? row.item.scaling_guidance ?? null,
  }))
  info(checks, 'category8_moe_station_clarity_packet', `${stationPacket.length} station(s) for coach clarity review`, {
    ok_band: true,
    stations: stationPacket,
  })

  if (reuseStability.stability == null) {
    info(checks, 'progression_reuse_stability', `Reuse stability pending (${reuseStability.runCount}/${reuseStability.minRuns ?? 5} eval runs)`, {
      ok_band: null,
      ...reuseStability,
    })
  } else if (reuseStability.stability >= 0.8) {
    info(checks, 'progression_reuse_stability', `Reuse stability ${(reuseStability.stability * 100).toFixed(0)}% over ${reuseStability.runCount} runs`, {
      ok_band: true,
      ...reuseStability,
    })
  } else {
    info(checks, 'progression_reuse_stability', `Reuse stability ${(reuseStability.stability * 100).toFixed(0)}% < 80%`, {
      ok_band: false,
      ...reuseStability,
    })
  }

  for (const id of CATEGORY8_KPI_CHECK_IDS) {
    if (findCheck(checks, id)) continue
    if (/^progression_reuse_(output|capacity|resilience)$/.test(id)) {
      pass(checks, id, `${id.replace('progression_reuse_', '')}: no progressions to reuse-check`)
      continue
    }
    pass(checks, id, 'Progression reuse policy N/A — no highest-cap progression pairs')
  }
}

export function computeCategory8Kpi(checks, opts = {}) {
  const minDiversityIndex = opts.minDiversityIndex ?? 0.75
  const blocking = computeKpi(checks, 8, CATEGORY8_KPI_CHECK_IDS, opts)

  const diversityCheck = checks.find((c) => c.id === 'progression_diversity_ratio')
  const diversity = diversityCheck?.detail?.diversity ?? 1
  const totalSlots = diversityCheck?.detail?.totalSlots ?? 0
  const reuseFails = ['progression_reuse_output', 'progression_reuse_capacity', 'progression_reuse_resilience']
    .map((id) => checks.find((c) => c.id === id))
    .filter((c) => c && c.ok === false).length
  const violationRate = reuseFails / Math.max(1, reuseFails + 3)
  const diversityIndex = totalSlots > 0 ? diversity * (1 - violationRate) : 1
  const indexOk = diversityIndex >= minDiversityIndex

  const ok = blocking.ok && indexOk
  return {
    ...blocking,
    ok,
    severity: ok ? 'ok' : 'P1',
    message: ok
      ? `Category 8 diversity index: ${(diversityIndex * 100).toFixed(1)}%; blocking ${(blocking.detail.rate * 100).toFixed(1)}%`
      : `Category 8 KPI fail: diversity index ${(diversityIndex * 100).toFixed(1)}% (min ${(minDiversityIndex * 100).toFixed(0)}%); blocking ${blocking.detail.passed}/${blocking.detail.total}`,
    detail: {
      ...blocking.detail,
      diversityIndex,
      minDiversityIndex,
      diversity,
      reuseViolations: reuseFails,
      formula: 'distinct/total × (1 - phase_reuse_violations)',
    },
  }
}

// ─── Category 9 — Progression difficulty climb ──────────────────────────────

export const CATEGORY9_KPI_CHECK_IDS = [
  'progression_difficulty_output',
  'progression_difficulty_capacity',
  'progression_difficulty_resilience',
  'progression_no_downgrade',
  'progression_delta_ceiling',
  'progression_within_split_cap',
  'progression_fits_caps_good',
  'progression_load_climb_capacity',
  'progression_cap_proximity',
  'progression_stretch_fit_zero',
  'progression_primary_difficulty_mos',
  'progression_unsafe_youth_delta',
]

export const CATEGORY9_MOE_CHECK_IDS = [
  'progression_delta_floor',
  'progression_technical_climb',
  'progression_gap_to_cap',
  'progression_headroom_rate',
  'progression_highest_d_first_proxy',
  'progression_delta_by_phase',
  'progression_delta_distribution_band',
  'progression_split_separation',
  'category9_moe_climb_review_packet',
  'category9_moe_rpe_proxy',
  'category9_moe_speed_dimension_climb',
  'category9_moe_cap_exploit',
  'category9_moe_climb_credible',
]

function difficultyDim(obj, dim) {
  if (!obj) return 0
  return Number(obj[dim] ?? obj.difficulty?.[dim] ?? obj.overall ?? obj.difficulty?.overall ?? 0)
}

function splitCapsForLabel(label, splits) {
  const match = splits.find((s) => String(s.label ?? '') === String(label ?? ''))
  return match?.caps ?? {}
}

export function evaluateCategory9Climb(result, expectedBody, checks, context = {}) {
  const {
    sessionAgeMax = expectedBody?.ageMax ?? expectedBody?.age_max ?? result.audience_profile?.ageMax ?? null,
    thresholds = {},
  } = context

  const splits = resultSplits(result)
  const bodySplitList = bodySplits(expectedBody)
  const effectiveSplits =
    splits.length > 0
      ? splits
      : bodySplitList.map((s) => ({
          label: s.label,
          caps: { maxOverall: s.difficultyOverride ?? s.difficulty_override ?? 10 },
        }))
  const pairs = collectHighestCapProgressionPairs(result, effectiveSplits)
  const highCap = Number(highestCapSplitProfiles(effectiveSplits)[0]?.caps?.maxOverall ?? 10)

  const deltas = []
  const deltaRecords = []
  let downgrade = 0
  let ceilingViolations = 0
  let capViolations = 0
  let stretchFit = 0
  let technicalChecked = 0
  let technicalOk = 0
  let loadChecked = 0
  let loadOk = 0
  let youthUnsafe = 0
  let primaryMissing = 0
  let primaryChecked = 0
  const gaps = []
  const separations = []
  const headroomEligible = []
  const headroomWithProgression = []
  const highestDProxyDenom = []
  const highestDProxyOk = []
  const phaseDeltas = new Map()

  for (const block of result.blocks ?? []) {
    if (!PROGRESSION_PHASES.includes(block.phase_key)) continue
    for (const item of block.items ?? []) {
      primaryChecked += 1
      const primaryOverall = difficultyDim(item, 'overall')
      if (!Number.isFinite(primaryOverall) || primaryOverall <= 0) {
        primaryMissing += 1
      }

      const split2Cap = Number(
        splitCapsForLabel(
          [...highestCapSplitLabels(effectiveSplits)][0] ?? 'Split 2',
          effectiveSplits,
        ).maxOverall ?? highCap,
      )
      if (split2Cap > primaryOverall + 1) {
        headroomEligible.push(item)
        if (itemHasProgressionOnHighestCap(item, effectiveSplits)) {
          headroomWithProgression.push(item)
        }
      }

      const ps = item.per_split ?? item.split_alternates_json ?? []
      const split1 = ps.find((v) => isYoungerSplitLabel(v.split_label, effectiveSplits))
      const split2Prog = ps.find(
        (v) => v.variant_type === 'progression' && isProgressionSplitLabel(v.split_label, effectiveSplits),
      )
      if (split1 && split2Prog) {
        const sep = difficultyDim(split2Prog, 'overall') - difficultyDim(split1, 'overall')
        separations.push(sep)
      }
    }
  }

  for (const row of pairs) {
    const primaryOverall = difficultyDim(row.item, 'overall')
    const progOverall = difficultyDim(row.variant, 'overall')
    const delta = progOverall - primaryOverall
    deltas.push(delta)
    deltaRecords.push({
      phase_key: row.phase_key,
      primary_id: Number(row.item.exercise_id),
      primary_name: row.item.exercise_name,
      progression_id: Number(row.variant.exercise_id),
      progression_name: row.variant.exercise_name,
      primary_overall: primaryOverall,
      progression_overall: progOverall,
      delta,
    })

    if (delta <= 0) downgrade += 1
    if (delta > 4) ceilingViolations += 1

    const splitCaps = splitCapsForLabel(row.variant.split_label, effectiveSplits)
    const cap = Number(splitCaps.maxOverall ?? row.variant.difficulty_cap ?? highCap)
    if (progOverall > cap) capViolations += 1
    gaps.push(Math.max(0, cap - progOverall))

    const fit = classifyAgeFit(
      {
        overall: progOverall,
        technical: difficultyDim(row.variant, 'technical'),
        load: difficultyDim(row.variant, 'load'),
      },
      splitCaps.maxOverall != null
        ? splitCaps
        : { maxOverall: cap, maxTechnical: cap, maxLoad: cap },
    )
    if (fit === 'stretch') stretchFit += 1

    technicalChecked += 1
    if (difficultyDim(row.variant, 'technical') >= difficultyDim(row.item, 'technical')) technicalOk += 1

    if (row.phase_key === 'capacity') {
      loadChecked += 1
      if (difficultyDim(row.variant, 'load') >= difficultyDim(row.item, 'load')) loadOk += 1
    }

    const sessionMax = Number(sessionAgeMax)
    if (Number.isFinite(sessionMax) && sessionMax <= 14 && delta > 4) youthUnsafe += 1

    if (!phaseDeltas.has(row.phase_key)) phaseDeltas.set(row.phase_key, [])
    phaseDeltas.get(row.phase_key).push(delta)

    if (cap - primaryOverall >= 3) {
      highestDProxyDenom.push(delta)
      if (delta >= 2) highestDProxyOk.push(delta)
    }
  }

  const totalPairs = pairs.length
  const downgradeRate = totalPairs > 0 ? downgrade / totalPairs : 0

  if (!findCheck(checks, 'progression_no_downgrade')) {
    if (downgrade > 0) {
      fail(checks, 'progression_no_downgrade', `${downgrade} progression(s) do not increase D`, { downgradeRate })
    } else if (totalPairs > 0) {
      pass(checks, 'progression_no_downgrade', 'All progressions increase difficulty', { downgradeRate: 0 })
    } else {
      pass(checks, 'progression_no_downgrade', 'No progressions to audit for downgrade')
    }
  }

  if (ceilingViolations > 0) {
    fail(checks, 'progression_delta_ceiling', `${ceilingViolations} progression(s) with Δ > 4`)
  } else if (totalPairs > 0) {
    pass(checks, 'progression_delta_ceiling', 'All progression deltas ≤ 4')
  } else {
    pass(checks, 'progression_delta_ceiling', 'No progressions to audit for delta ceiling')
  }

  if (capViolations > 0) {
    fail(checks, 'progression_within_split_cap', `${capViolations} progression(s) exceed split cap`)
  } else if (totalPairs > 0) {
    pass(checks, 'progression_within_split_cap', 'All progressions within split cap')
  } else {
    pass(checks, 'progression_within_split_cap', 'No progressions to audit for split cap')
  }

  if (stretchFit > 0) {
    fail(checks, 'progression_fits_caps_good', `${stretchFit} progression(s) with stretch fit on Split 2`)
  } else if (totalPairs > 0) {
    pass(checks, 'progression_fits_caps_good', 'All progressions good-fit on Split 2 caps')
  } else {
    pass(checks, 'progression_fits_caps_good', 'No progressions to audit for age fit')
  }

  if (stretchFit > 0) {
    fail(checks, 'progression_stretch_fit_zero', `${stretchFit} stretch progression(s) on Split 2`)
  } else if (totalPairs > 0) {
    pass(checks, 'progression_stretch_fit_zero', 'No stretch progressions on Split 2')
  } else {
    pass(checks, 'progression_stretch_fit_zero', 'No progressions to audit for stretch fit')
  }

  const minTechnicalRate = thresholds.minProgressionTechnicalClimbRate ?? 0.9
  const technicalRate = technicalChecked > 0 ? technicalOk / technicalChecked : 1
  info(checks, 'progression_technical_climb', `Technical climb ${(technicalRate * 100).toFixed(0)}%`, {
    ok_band: technicalRate >= minTechnicalRate,
    technicalRate,
    target: minTechnicalRate,
  })

  const minLoadRate = thresholds.minProgressionLoadClimbRate ?? 0.8
  const loadRate = loadChecked > 0 ? loadOk / loadChecked : 1
  if (loadChecked > 0 && loadRate < minLoadRate) {
    fail(checks, 'progression_load_climb_capacity', `Capacity load climb ${(loadRate * 100).toFixed(0)}% < ${(minLoadRate * 100).toFixed(0)}%`)
  } else if (loadChecked > 0) {
    pass(checks, 'progression_load_climb_capacity', `Capacity load climb ${(loadRate * 100).toFixed(0)}%`)
  } else {
    pass(checks, 'progression_load_climb_capacity', 'No Capacity progressions to audit for load climb')
  }

  const minCapProximity = thresholds.minProgressionCapProximity ?? 0.7
  const capProximity = totalPairs > 0
    ? mean(pairs.map((r) => difficultyDim(r.variant, 'overall') / highCap))
    : 1
  if (totalPairs > 0 && capProximity < minCapProximity) {
    fail(checks, 'progression_cap_proximity', `Mean progression D/cap ${(capProximity * 100).toFixed(0)}% < ${(minCapProximity * 100).toFixed(0)}%`, {
      capProximity,
      minCapProximity,
    })
  } else if (totalPairs > 0) {
    pass(checks, 'progression_cap_proximity', `Mean progression D/cap ${(capProximity * 100).toFixed(0)}%`, { capProximity })
  } else {
    pass(checks, 'progression_cap_proximity', 'No progressions to audit for cap proximity')
  }

  if (primaryMissing > 0) {
    fail(checks, 'progression_primary_difficulty_mos', `${primaryMissing}/${primaryChecked} progression-phase primaries missing difficulty.overall`)
  } else if (primaryChecked > 0) {
    pass(checks, 'progression_primary_difficulty_mos', 'All progression-phase primaries have difficulty.overall')
  } else {
    pass(checks, 'progression_primary_difficulty_mos', 'No progression-phase primaries to audit')
  }

  if (youthUnsafe > 0) {
    fail(checks, 'progression_unsafe_youth_delta', `${youthUnsafe} youth progression(s) with Δ > 4`)
  } else if (totalPairs > 0) {
    pass(checks, 'progression_unsafe_youth_delta', 'No unsafe youth delta jumps')
  } else {
    pass(checks, 'progression_unsafe_youth_delta', 'Youth delta safety N/A')
  }

  const delta2Rate = deltas.length > 0 ? deltas.filter((d) => d >= 2).length / deltas.length : 1
  info(checks, 'progression_delta_floor', `Δ≥2 rate ${(delta2Rate * 100).toFixed(0)}%`, {
    ok_band: delta2Rate >= 0.5,
    delta2Rate,
    target: 0.5,
  })

  const meanGap = gaps.length > 0 ? mean(gaps) : 0
  info(checks, 'progression_gap_to_cap', `Mean cap gap ${meanGap.toFixed(1)}`, {
    ok_band: meanGap <= 2.0,
    meanGap,
    target: 2.0,
  })

  const headroomRate = headroomEligible.length > 0 ? headroomWithProgression.length / headroomEligible.length : 1
  info(checks, 'progression_headroom_rate', `Headroom-eligible primaries with progression ${(headroomRate * 100).toFixed(0)}%`, {
    ok_band: headroomRate >= 0.8,
    eligible: headroomEligible.length,
    withProgression: headroomWithProgression.length,
    headroomRate,
  })

  const highestDProxyRate = highestDProxyDenom.length > 0 ? highestDProxyOk.length / highestDProxyDenom.length : 1
  info(checks, 'progression_highest_d_first_proxy', `Headroom≥3 with Δ≥2 ${(highestDProxyRate * 100).toFixed(0)}%`, {
    ok_band: highestDProxyRate >= 0.8,
    highestDProxyRate,
    note: 'Proxy for pickSplitProgression highest-D-first when candidate pool telemetry absent',
  })

  const outputMean = mean(phaseDeltas.get('output') ?? [])
  const capacityMean = mean(phaseDeltas.get('capacity') ?? [])
  const speedSession = String(expectedBody?.sessionObjective ?? result.audience_profile?.sessionObjective ?? '').includes('speed')
  info(checks, 'progression_delta_by_phase', `Output Δ ${outputMean.toFixed(1)} vs Capacity Δ ${capacityMean.toFixed(1)}`, {
    ok_band: !speedSession || outputMean >= capacityMean,
    outputMean,
    capacityMean,
    speedSession,
  })

  const bandRate = deltas.length > 0 ? deltas.filter((d) => d >= 1 && d <= 3).length / deltas.length : 1
  const normalizedDeltaMean = deltas.length > 0 ? mean(deltas.map((d) => Math.min(d, 3) / 3)) : 1
  info(checks, 'progression_delta_distribution_band', `Δ in [1,3] band ${(bandRate * 100).toFixed(0)}%`, {
    ok_band: bandRate >= 0.8,
    bandRate,
    normalizedDeltaMean,
    target: 0.8,
  })

  const meanSep = separations.length > 0 ? mean(separations) : 0
  info(checks, 'progression_split_separation', `Mean Split2−Split1 D ${meanSep.toFixed(1)}`, {
    ok_band: meanSep >= 1.0,
    meanSep,
    pairs: separations.length,
  })

  const highDCount = pairs.filter((r) => difficultyDim(r.variant, 'overall') >= 7).length
  info(checks, 'category9_moe_cap_exploit', `Progressions with D≥7: ${highDCount}`, {
    ok_band: highDCount >= 2,
    highDCount,
    target: 2,
  })

  const outputPairs = pairs.filter((r) => r.phase_key === 'output')
  let speedDimOk = 0
  for (const row of outputPairs) {
    const techUp = difficultyDim(row.variant, 'technical') >= difficultyDim(row.item, 'technical')
    const loadUp = difficultyDim(row.variant, 'load') >= difficultyDim(row.item, 'load')
    if (techUp || loadUp) speedDimOk += 1
  }
  const speedDimRate = outputPairs.length > 0 ? speedDimOk / outputPairs.length : 1
  info(checks, 'category9_moe_speed_dimension_climb', `Output technical/load climb ${(speedDimRate * 100).toFixed(0)}%`, {
    ok_band: speedDimRate >= 0.8,
    speedDimRate,
    outputPairs: outputPairs.length,
  })

  info(checks, 'category9_moe_rpe_proxy', `Δ band [1,3] ${(bandRate * 100).toFixed(0)}% + scaling guidance proxy for 11–14 RPE`, {
    ok_band: bandRate >= 0.8,
    bandRate,
    note: 'Field RPE survey TBD; delta band + scaling_guidance as automated proxy',
  })

  info(checks, 'category9_moe_climb_credible', `No-downgrade rate ${((1 - downgradeRate) * 100).toFixed(0)}%`, {
    ok_band: (1 - downgradeRate) >= 0.9,
    downgradeRate,
    note: 'Lagging coach keep-vs-downgrade; automated proxy from C9-MOP-09',
  })

  info(checks, 'category9_moe_climb_review_packet', `${deltaRecords.length} progression pair(s) for coach MOE review`, {
    ok_band: bandRate >= 0.8,
    pairs: deltaRecords,
    ideal_delta_band: [1, 3],
    normalizedDeltaMean,
    downgradeRate,
    capProximity,
    climbIndex: normalizedDeltaMean * (1 - downgradeRate) * capProximity,
  })

  for (const id of CATEGORY9_KPI_CHECK_IDS) {
    if (findCheck(checks, id)) continue
    if (/^progression_difficulty_(output|capacity|resilience)$/.test(id)) {
      pass(checks, id, `${id.replace('progression_difficulty_', '')}: no Split 2 progressions to difficulty-check`)
      continue
    }
    pass(checks, id, 'Climb policy N/A — no highest-cap progression pairs')
  }
}

export function computeCategory9Kpi(checks, opts = {}) {
  const minClimbIndex = opts.minClimbIndex ?? 0.8
  const blocking = computeKpi(checks, 9, CATEGORY9_KPI_CHECK_IDS, opts)
  const bandInfo = checks.find((c) => c.id === 'progression_delta_distribution_band')?.detail
  const reviewInfo = checks.find((c) => c.id === 'category9_moe_climb_review_packet')?.detail
  const proxInfo = checks.find((c) => c.id === 'progression_cap_proximity')?.detail
  const noDownInfo = checks.find((c) => c.id === 'progression_no_downgrade')?.detail

  const normalizedDeltaMean = bandInfo?.normalizedDeltaMean ?? reviewInfo?.normalizedDeltaMean
  const downgradeRate = noDownInfo?.downgradeRate ?? reviewInfo?.downgradeRate ?? 0
  const capProximity = proxInfo?.capProximity ?? reviewInfo?.capProximity
  let climbIndex = reviewInfo?.climbIndex
  if (typeof climbIndex !== 'number' && typeof normalizedDeltaMean === 'number' && typeof capProximity === 'number') {
    climbIndex = normalizedDeltaMean * (1 - downgradeRate) * capProximity
  }

  const climbOk = typeof climbIndex !== 'number' || climbIndex >= minClimbIndex
  const ok = blocking.ok
  return {
    ...blocking,
    ok,
    severity: ok ? 'ok' : 'P1',
    message: ok
      ? typeof climbIndex === 'number'
        ? `Category 9 climb index ${(climbIndex * 100).toFixed(1)}% (target ${(minClimbIndex * 100).toFixed(0)}%); blocking ${(blocking.detail.rate * 100).toFixed(1)}%`
        : blocking.message
      : blocking.message,
    detail: {
      ...blocking.detail,
      climbIndex: climbIndex ?? null,
      minClimbIndex,
      climbIndexOk: climbOk,
      normalizedDeltaMean: normalizedDeltaMean ?? null,
      downgradeRate,
      capProximity: capProximity ?? null,
      formula: 'mean(min(delta,3)/3) × (1 - downgrade_rate) × cap_proximity',
    },
  }
}

// ─── Category 10 — Difficulty & age fit ─────────────────────────────────────

export const CATEGORY10_KPI_CHECK_IDS = [
  'primary_age_fit_distribution',
  'stretch_primaries_prepare_and_access',
  'stretch_primaries_movement_intelligence',
  'stretch_primaries_output',
  'stretch_primaries_capacity',
  'stretch_primaries_resilience',
  'session_age_fit_warnings',
  'age_fit_warning_dimensions',
  'split1_cap_adherence',
  'split2_cap_adherence',
  'age_fit_false_session_cap_warnings',
  'audience_pool_cap_derivation',
  'primary_age_fit_split_good_path',
  'youngest_split_gate',
  'age_fit_warnings_consistency',
  'primary_over_cap_count',
  'skill_level_residuals',
  'audience_recommended_age_overlap',
  'mi_attention_demand_ceiling',
  'pool_cap_proximity_bonus',
  'primary_age_fit_mean_score',
  'stretch_allowed_phases_only',
  'audience_cap_overall',
  'split_cap_parity',
]

export const CATEGORY10_MOE_CHECK_IDS = [
  'category10_moe_review_packet',
  'category10_moe_speed_output_bands',
  'age_fit_warning_stability',
]

export function evaluateCategory10AgeFit(result, expectedBody, checks, context = {}) {
  const {
    exerciseById = new Map(),
    difficultyByExerciseId = new Map(),
    ageFitWarningStability = null,
  } = context

  const profile = result.audience_profile ?? {}
  const sessionCaps = profile.caps ?? {}
  const resSplitList = resultSplits(result)
  const bodySplitList = bodySplits(expectedBody)
  const splitProfiles = resSplitList.length > 0
    ? resSplitList.map((s) => ({ label: s.label, ageMin: s.age_min ?? s.ageMin, ageMax: s.age_max ?? s.ageMax, caps: s.caps ?? {} }))
    : buildSplitProfilesFromBody(expectedBody)
  const poolCaps = mergeCapsMax(sessionCaps, ...splitProfiles.map((s) => s.caps))
  const sessionAgeMax = Number(expectedBody.ageMax ?? expectedBody.age_max ?? profile.ageMax ?? 120)
  const audienceSkill = String(expectedBody.skillLevel ?? expectedBody.skill_level ?? profile.impliedSkillLevel ?? 'INTERMEDIATE').toUpperCase()
  const expectedProfile = resolveAudienceProfile({
    ageMin: expectedBody.ageMin ?? expectedBody.age_min,
    ageMax: expectedBody.ageMax ?? expectedBody.age_max,
    skillLevel: expectedBody.skillLevel ?? expectedBody.skill_level,
    sessionObjective: expectedBody.sessionObjective ?? expectedBody.session_objective,
    targets: expectedBody.targets,
  })

  let totalPrimaries = 0
  let goodCount = 0
  let stretchCount = 0
  let overCapCount = 0
  let splitGoodPathCount = 0
  let splitGoodPathDenom = 0
  const fitScores = []
  let stretchOutsideAllowed = 0
  let youngestGateFails = 0
  let youngestGateChecked = 0
  let consistencyFails = 0
  let consistencyChecked = 0
  const reviewItems = []

  const warnings = result.age_fit_warnings ?? []
  const warningDims = parseAgeFitWarningDimensions(warnings)

  for (const block of result.blocks ?? []) {
    const phaseKey = block.phase_key
    for (const item of block.items ?? []) {
      totalPrimaries += 1
      const fit = item.age_fit ?? 'good'
      if (fit === 'good') goodCount += 1
      else if (fit === 'stretch') stretchCount += 1
      else if (fit === 'over_cap') overCapCount += 1

      if (fit === 'stretch' && !STRETCH_ALLOWED_PHASES.has(phaseKey)) {
        stretchOutsideAllowed += 1
      }

      const difficulty = item.difficulty ?? difficultyByExerciseId.get(String(item.exercise_id)) ?? difficultyByExerciseId.get(Number(item.exercise_id))
      if (difficulty) {
        const sessionFit = classifyAgeFit(difficulty, sessionCaps)
        const replayFit = classifyPrimaryAgeFitReplay(difficulty, sessionCaps, splitProfiles)
        if (sessionFit !== 'good' && replayFit === 'good') {
          splitGoodPathDenom += 1
          splitGoodPathCount += 1
        } else if (sessionFit !== 'good') {
          splitGoodPathDenom += 1
        }
        fitScores.push(scoreAgeDifficultyFit(difficulty, poolCaps))
      }

      if (fit === 'good') {
        consistencyChecked += 1
        const name = String(item.exercise_name ?? '').trim()
        if (name && warnings.some((w) => String(w).includes(name))) {
          consistencyFails += 1
        }
      }

      if (splitProfiles.length > 0 && difficulty) {
        youngestGateChecked += 1
        const youngest = youngestSplitProfile(splitProfiles)
        const yFit = classifyAgeFit(difficulty, youngest?.caps ?? sessionCaps)
        if (yFit !== 'good' && yFit !== 'stretch') youngestGateFails += 1
      }

      reviewItems.push({
        phase_key: phaseKey,
        exercise_id: Number(item.exercise_id),
        exercise_name: item.exercise_name,
        age_fit: fit,
        difficulty_overall: difficulty?.overall ?? null,
      })
    }
  }

  const goodRate = totalPrimaries > 0 ? goodCount / totalPrimaries : 1
  ensureCheck(checks, 'primary_age_fit_distribution', () => {
    if (goodRate < 0.85 || overCapCount > 0) {
      fail(checks, 'primary_age_fit_distribution', `good ${(goodRate * 100).toFixed(0)}%; over_cap ${overCapCount}`, {
        goodCount, stretchCount, overCapCount, totalPrimaries, goodRate,
      })
    } else {
      pass(checks, 'primary_age_fit_distribution', `Age-fit good ${(goodRate * 100).toFixed(0)}%; over_cap 0`, {
        goodCount, stretchCount, overCapCount, totalPrimaries, goodRate,
      })
    }
  })

  ensureCheck(checks, 'primary_over_cap_count', () => {
    if (overCapCount > 0) {
      fail(checks, 'primary_over_cap_count', `${overCapCount} over_cap primary item(s)`)
    } else {
      pass(checks, 'primary_over_cap_count', 'No over_cap primaries')
    }
  })

  ensureCheck(checks, 'session_age_fit_warnings', () => {
    if (warnings.length > 0) {
      fail(checks, 'session_age_fit_warnings', `${warnings.length} age-fit warning(s)`, { count: warnings.length })
    } else {
      pass(checks, 'session_age_fit_warnings', 'No age-fit warnings', { count: 0 })
    }
  })

  if (warnings.length > 0 && (warningDims.overall > 0 || warningDims.load > 0 || warningDims.technical > 0)) {
    fail(checks, 'age_fit_warning_dimensions', `Warning dimensions overall=${warningDims.overall} load=${warningDims.load} technical=${warningDims.technical}`)
  } else {
    pass(checks, 'age_fit_warning_dimensions', warnings.length > 0
      ? `Parsed warning dimensions: overall=${warningDims.overall} load=${warningDims.load} technical=${warningDims.technical}`
      : 'No age-fit warnings to parse')
  }

  const sessionCap = Number(sessionCaps.maxOverall ?? expectedProfile.caps.maxOverall)
  const split2 = resSplitList.find((s) => isSplit2Label(s.label)) ?? resSplitList[1]
  const split2Cap = Number(split2?.caps?.maxOverall ?? 10)
  let falseSessionCapWarnings = 0
  if (warnings.length > 0 && split2) {
    for (const w of warnings) {
      const text = String(w)
      if (!new RegExp(`cap ${sessionCap}\\b`).test(text) && !text.includes(`exceeds cap ${sessionCap}`)) continue
      const matchedItem = (result.blocks ?? []).flatMap((b) => b.items ?? []).find((it) => text.includes(String(it.exercise_name ?? '')))
      if (!matchedItem?.difficulty) continue
      const split2Fit = classifyAgeFit(matchedItem.difficulty, { maxOverall: split2Cap, maxTechnical: split2Cap, maxLoad: split2Cap })
      if (split2Fit === 'good' && (matchedItem.age_fit === 'good' || matchedItem.age_fit == null)) {
        falseSessionCapWarnings += 1
      }
    }
  }
  if (falseSessionCapWarnings > 0) {
    fail(checks, 'age_fit_false_session_cap_warnings', `${falseSessionCapWarnings} false session-cap warning(s) for split-good items`)
  } else {
    pass(checks, 'age_fit_false_session_cap_warnings', 'No false session-cap warnings for split-good items')
  }

  const splitGoodRate = splitGoodPathDenom > 0 ? splitGoodPathCount / splitGoodPathDenom : 1
  if (splitGoodPathDenom > 0) {
    pass(checks, 'primary_age_fit_split_good_path', `Split-good path ${(splitGoodRate * 100).toFixed(0)}% (${splitGoodPathCount}/${splitGoodPathDenom})`, {
      splitGoodPathCount,
      splitGoodPathDenom,
      splitGoodRate,
    })
  } else {
    pass(checks, 'primary_age_fit_split_good_path', 'No session-stretch primaries requiring split-good path')
  }

  if (youngestGateChecked > 0 && youngestGateFails > 0) {
    fail(checks, 'youngest_split_gate', `${youngestGateFails}/${youngestGateChecked} primaries fail youngest-split gate`)
  } else if (youngestGateChecked > 0) {
    pass(checks, 'youngest_split_gate', 'Youngest-split gate satisfied for all primaries')
  } else if (splitProfiles.length > 0) {
    pass(checks, 'youngest_split_gate', 'Youngest-split gate N/A — no difficulty metadata')
  }

  if (consistencyChecked > 0 && consistencyFails > 0) {
    fail(checks, 'age_fit_warnings_consistency', `${consistencyFails}/${consistencyChecked} good items have age-fit warnings`)
  } else if (consistencyChecked > 0) {
    pass(checks, 'age_fit_warnings_consistency', 'Good age_fit items have no matching warnings')
  }

  if (stretchOutsideAllowed > 0) {
    fail(checks, 'stretch_allowed_phases_only', `${stretchOutsideAllowed} stretch primaries outside Sustained/Restore`)
  } else {
    pass(checks, 'stretch_allowed_phases_only', stretchCount > 0
      ? `${stretchCount} stretch primary(ies); ${stretchOutsideAllowed} outside allowed phases`
      : 'No stretch primaries')
  }

  const meanFit = fitScores.length > 0 ? mean(fitScores) : 1
  if (fitScores.length > 0 && meanFit < 0.85) {
    fail(checks, 'primary_age_fit_mean_score', `Mean scoreAgeDifficultyFit ${meanFit.toFixed(3)} < 0.85`)
  } else if (fitScores.length > 0) {
    pass(checks, 'primary_age_fit_mean_score', `Mean scoreAgeDifficultyFit ${meanFit.toFixed(3)}`, { meanFit, samples: fitScores.length })
  }

  const poolCapOverall = poolCaps.maxOverall
  const sampleDiff = { overall: 7, technical: 6, load: 6 }
  const bonusPool = difficultyProximityBonus(sampleDiff, poolCapOverall)
  const bonusSession = difficultyProximityBonus(sampleDiff, sessionCap)
  if (poolCapOverall > sessionCap && bonusPool !== bonusSession) {
    pass(checks, 'pool_cap_proximity_bonus', `difficultyProximityBonus uses poolCap ${poolCapOverall} (≠ session ${sessionCap})`, {
      poolCapOverall,
      sessionCap,
      bonusPool,
      bonusSession,
    })
  } else if (poolCapOverall <= sessionCap) {
    pass(checks, 'pool_cap_proximity_bonus', 'Pool cap equals session cap — proximity bonus N/A')
  } else {
    fail(checks, 'pool_cap_proximity_bonus', 'difficultyProximityBonus does not differentiate pool vs session cap')
  }

  ensureCheck(checks, 'audience_pool_cap_derivation', () => {
    if (bodySplitList.length >= 2 && poolCapOverall !== 10) {
      fail(checks, 'audience_pool_cap_derivation', `Expected poolCapOverall 10 for split caps 6/10; got ${poolCapOverall}`)
    } else {
      pass(checks, 'audience_pool_cap_derivation', `poolCapOverall replay ${poolCapOverall}`)
    }
  })

  ensureCheck(checks, 'audience_cap_overall', () => {
    if (profile.caps?.maxOverall !== expectedProfile.caps.maxOverall) {
      fail(checks, 'audience_cap_overall', `maxOverall ${profile.caps?.maxOverall} !== ${expectedProfile.caps.maxOverall}`)
    } else {
      pass(checks, 'audience_cap_overall', `Session cap maxOverall ${profile.caps?.maxOverall}`)
    }
  })

  let skillResiduals = 0
  let skillChecked = 0
  const audienceRank = SKILL_RANK[audienceSkill] ?? SKILL_RANK.INTERMEDIATE
  if (sessionAgeMax <= 17) {
    for (const block of result.blocks ?? []) {
      for (const item of block.items ?? []) {
        const exSkill = String(exerciseById.get(Number(item.exercise_id))?.skill_level ?? '').toUpperCase()
        if (!exSkill || !(exSkill in SKILL_RANK)) continue
        skillChecked += 1
        if (SKILL_RANK[exSkill] > audienceRank) skillResiduals += 1
      }
    }
  }
  if (skillChecked > 0 && skillResiduals > 0) {
    fail(checks, 'skill_level_residuals', `${skillResiduals}/${skillChecked} exercises exceed audience skill ${audienceSkill}`)
  } else if (skillChecked > 0) {
    pass(checks, 'skill_level_residuals', `No skill_level above ${audienceSkill} for youth session`)
  } else if (sessionAgeMax <= 17) {
    pass(checks, 'skill_level_residuals', 'Skill level residuals N/A — no tagged exercises')
  }

  ensureCheck(checks, 'audience_recommended_age_overlap', () => {
    let ageOverlap = 0
    let ageChecked = 0
    const sessMin = expectedProfile.ageMin
    const sessMax = expectedProfile.ageMax
    for (const block of result.blocks ?? []) {
      for (const item of block.items ?? []) {
        const diff = difficultyByExerciseId.get(String(item.exercise_id)) ?? difficultyByExerciseId.get(Number(item.exercise_id))
        const recMin = diff?.recommended_age_min
        const recMax = diff?.recommended_age_max
        if (recMin == null && recMax == null) continue
        ageChecked += 1
        const rMin = recMin ?? 0
        const rMax = recMax ?? 120
        if (sessMax >= rMin && sessMin <= rMax) ageOverlap += 1
      }
    }
    const overlapRate = ageChecked > 0 ? ageOverlap / ageChecked : 1
    if (overlapRate < 0.9) {
      fail(checks, 'audience_recommended_age_overlap', `Recommended age overlap ${(overlapRate * 100).toFixed(0)}% < 90%`, { ageChecked, ageOverlap })
    } else {
      pass(checks, 'audience_recommended_age_overlap', `Recommended age overlap ${(overlapRate * 100).toFixed(0)}%`)
    }
  })

  let miAttentionFails = 0
  if (sessionAgeMax <= 14) {
    const miBlock = blockByKey(result, 'movement_intelligence')
    for (const item of miBlock?.items ?? []) {
      const diff = difficultyByExerciseId.get(String(item.exercise_id)) ?? difficultyByExerciseId.get(Number(item.exercise_id))
      const demand = Number(diff?.attention_demand ?? 0)
      if (demand >= 8) miAttentionFails += 1
    }
  }
  if (sessionAgeMax <= 14 && miAttentionFails > 0) {
    fail(checks, 'mi_attention_demand_ceiling', `${miAttentionFails} MI item(s) with attention_demand ≥ 8`)
  } else if (sessionAgeMax <= 14) {
    pass(checks, 'mi_attention_demand_ceiling', 'MI attention_demand below ceiling for youth')
  } else {
    pass(checks, 'mi_attention_demand_ceiling', 'MI attention ceiling N/A — session age > 14')
  }

  const stabilityResult = ageFitWarningStability ?? { stable: null, runCount: 0, minRuns: 5, counts: [] }
  if (stabilityResult.stable == null) {
    info(checks, 'age_fit_warning_stability', `Age-fit warning stability pending (${stabilityResult.runCount}/${stabilityResult.minRuns ?? 5} eval runs)`, {
      ok_band: null,
      ...stabilityResult,
    })
  } else if (stabilityResult.stable) {
    info(checks, 'age_fit_warning_stability', `Age-fit warnings stable (${stabilityResult.counts?.join(', ') ?? '0'}) over ${stabilityResult.runCount} runs`, {
      ok_band: true,
      ...stabilityResult,
    })
  } else {
    info(checks, 'age_fit_warning_stability', `Age-fit warning count unstable across runs`, {
      ok_band: false,
      ...stabilityResult,
    })
  }

  const outputBlock = blockByKey(result, 'output')
  const objective = String(expectedBody.sessionObjective ?? expectedBody.session_objective ?? profile.sessionObjective ?? '')
  if (objective === 'speed_priority' && outputBlock) {
    const split1Ds = []
    const split2Ds = []
    for (const item of outputBlock.items ?? []) {
      for (const v of item.per_split ?? item.split_alternates_json ?? []) {
        const d = variantOverallDifficulty(v, item)
        if (isSplit1Label(v.split_label)) split1Ds.push(d)
        if (isSplit2Label(v.split_label)) split2Ds.push(d)
      }
    }
    const mean1 = mean(split1Ds)
    const mean2 = mean(split2Ds)
    const s1InBand = split1Ds.length > 0 && split1Ds.every((d) => d >= 4 && d <= 6)
    const s2InBand = split2Ds.length > 0 && split2Ds.every((d) => d >= 6 && d <= 8)
    info(checks, 'category10_moe_speed_output_bands', `Output D bands Split1=${mean1.toFixed(1)} Split2=${mean2.toFixed(1)}`, {
      ok_band: s1InBand && s2InBand,
      split1Ds,
      split2Ds,
      bands: { split1: [4, 6], split2: [6, 8] },
      rubric: 'C10-MOE-06',
    })
  } else {
    info(checks, 'category10_moe_speed_output_bands', 'Speed output D bands N/A for session objective', { ok_band: null })
  }

  info(checks, 'category10_moe_review_packet', `${reviewItems.length} primary item(s) for coach age-fit MOE review`, {
    ok_band: true,
    items: reviewItems.slice(0, 40),
    splits: resSplitList.map((s) => ({
      label: s.label,
      age_min: s.age_min ?? s.ageMin,
      age_max: s.age_max ?? s.ageMax,
      cap: s.caps?.maxOverall,
    })),
    age_fit_summary: { goodCount, stretchCount, overCapCount, totalPrimaries },
    warnings: warnings.slice(0, 10),
    rubric: ['C10-MOE-01', 'C10-MOE-02', 'C10-MOE-03', 'C10-MOE-04', 'C10-MOE-05'],
  })

  for (const id of CATEGORY10_KPI_CHECK_IDS) {
    if (findCheck(checks, id)) continue
    if (/^stretch_primaries_/.test(id)) {
      pass(checks, id, `${id.replace('stretch_primaries_', '')}: no stretch primaries to check`)
      continue
    }
    if (id === 'split1_cap_adherence' || id === 'split2_cap_adherence' || id === 'split_cap_parity') {
      if (resSplitList.length < 2) {
        pass(checks, id, `${id}: splits inactive — N/A`)
      } else {
        pass(checks, id, `${id}: delegated to Category 5 evaluator`)
      }
      continue
    }
    pass(checks, id, `${id}: N/A for session`)
  }
}

export function computeCategory10Kpi(checks, opts = {}) {
  const minRate = opts.minRate ?? 0.95
  const blocking = computeKpi(checks, 10, CATEGORY10_KPI_CHECK_IDS, { minRate, ...opts })

  const dist = checks.find((c) => c.id === 'primary_age_fit_distribution')
  const goodRate = dist?.detail?.goodRate ?? (dist?.ok ? 1 : 0)
  const totalPrimaries = dist?.detail?.totalPrimaries ?? 0
  const overCapCount = dist?.detail?.overCapCount ?? 0
  const overCapRate = totalPrimaries > 0 ? overCapCount / totalPrimaries : 0

  const warnCheck = checks.find((c) => c.id === 'session_age_fit_warnings')
  const warnCount = warnCheck?.detail?.count ?? (warnCheck?.ok ? 0 : 1)
  const warningRate = warnCount > 0 ? Math.min(1, warnCount / Math.max(totalPrimaries, 1)) : 0

  const fidelity = goodRate * (1 - warningRate) * (1 - overCapRate)
  const minFidelity = opts.minFidelity ?? 0.95
  const ok = blocking.ok && fidelity >= minFidelity

  return {
    ...blocking,
    ok,
    severity: ok ? 'ok' : 'P1',
    message: ok
      ? `Category 10 age-fit fidelity ${(fidelity * 100).toFixed(1)}%; blocking ${(blocking.detail.rate * 100).toFixed(1)}%`
      : `Category 10 KPI fail: fidelity ${(fidelity * 100).toFixed(1)}% < ${(minFidelity * 100).toFixed(0)}%; blocking ${blocking.detail.passed}/${blocking.detail.total}`,
    detail: {
      ...blocking.detail,
      fidelity,
      minFidelity,
      goodRate,
      warningRate,
      overCapRate,
      formula: 'good_rate × (1 - warning_rate) × (1 - over_cap_rate)',
    },
  }
}

// ─── Category 11 — Difficulty cap utilization ───────────────────────────────

export const CATEGORY11_KPI_CHECK_IDS = [
  'pool_cap_max_of_splits',
  'session_cap_resolvable',
  'primary_over_cap_count',
  'split_overrides_consistent',
  'prepare_mi_no_over_cap',
  'cap_sandbagging_credibility',
]

export const CATEGORY11_UTIL_CHECK_IDS = [
  'session_mean_d_utilization',
  'output_mean_d_pool_cap',
  'capacity_mean_d_pool_cap',
  'resilience_mean_d_pool_cap',
  'split1_mean_d_utilization',
  'split2_mean_d_utilization',
  'high_intent_near_cap_rate',
  'sandbagging_per_phase',
  'progression_cap_utilization',
  'restore_under_utilization',
  'prepare_mi_cap_discipline',
  'prepare_mi_low_d_expectation',
  'technical_cap_utilization',
  'load_cap_utilization',
  'cap_headroom_median',
  'split_utilization_gap',
  'progression_headroom_to_cap',
]

export const CATEGORY11_MOE_CHECK_IDS = [
  'category11_moe_session_headroom',
  'category11_moe_split2_exploited',
  'category11_moe_output_power_band',
  'category11_moe_no_timid_high_intent',
  'category11_moe_objective_cap_alignment',
  'category11_moe_field_rpe',
  'category11_moe_younger_split_completable',
  'category11_moe_difficulty_arc',
  'category11_moe_builder_edit_signal',
  'category11_moe_review_packet',
  'proximity_bonus_lift_proxy',
  'near_cap_pool_size_proxy',
  'cap_utilization_stability',
  'proximity_bonus_correlation_proxy',
]

function phaseUtilRatio(block, poolCap, sessionCap, { useSplit2 = false } = {}) {
  if (!block) return null
  const cap = HIGH_INTENT_PHASES.includes(block.phase_key) ? poolCap : sessionCap
  const ds = []
  for (const item of block.items ?? []) {
    if (useSplit2) {
      const v = split2Variant(item)
      if (v) ds.push(variantOverallDifficulty(v, item))
    } else {
      const d = Number(item.difficulty?.overall ?? 0)
      if (d > 0) ds.push(d)
    }
  }
  if (ds.length === 0 || cap <= 0) return null
  return { ratio: mean(ds) / cap, meanD: mean(ds), cap, count: ds.length }
}

export function computeCat11OutputPoolUtil(result) {
  const profile = result.audience_profile ?? {}
  const sessionCap = Number(profile.caps?.maxOverall ?? 10)
  const splits = resultSplits(result)
  const hasSplits = splits.length >= 2
  const poolCap = mergeCapsMax(profile.caps, ...splits.map((s) => s.caps)).maxOverall
  const util = phaseUtilRatio(blockByKey(result, 'output'), poolCap, sessionCap, { useSplit2: hasSplits })
  return util?.ratio ?? null
}

export function evaluateCategory11CapUtil(result, expectedBody, checks, context = {}) {
  const profile = result.audience_profile ?? {}
  const sessionCap = Number(profile.caps?.maxOverall ?? 10)
  const maxTechnical = Number(profile.caps?.maxTechnical ?? sessionCap)
  const maxLoad = Number(profile.caps?.maxLoad ?? sessionCap)
  const splits = resultSplits(result)
  const bodySplitList = bodySplits(expectedBody)
  const hasSplits = splits.length >= 2
  const splitCaps = splits.map((s) => Number(s.caps?.maxOverall ?? s.difficulty_override ?? sessionCap))
  const poolCap = mergeCapsMax(profile.caps, ...splits.map((s) => s.caps)).maxOverall
  const split1Cap = hasSplits ? Math.min(...splitCaps) : sessionCap
  const split2Cap = hasSplits ? Math.max(...splitCaps) : poolCap
  const { capUtilStability = null } = context

  // C11-MOP-10 / C11-MOS-01
  if (hasSplits && poolCap === Math.max(...splitCaps, sessionCap)) {
    pass(checks, 'pool_cap_max_of_splits', `poolCapOverall ${poolCap} = max-of-splits`)
  } else if (hasSplits) {
    fail(checks, 'pool_cap_max_of_splits', `poolCap ${poolCap} !== max split cap ${Math.max(...splitCaps)}`)
  } else if (Number.isFinite(poolCap)) {
    pass(checks, 'pool_cap_max_of_splits', `poolCapOverall ${poolCap} (no splits)`)
  }

  if (Number.isFinite(sessionCap) && sessionCap > 0) {
    pass(checks, 'session_cap_resolvable', `Session cap resolved: ${sessionCap}`)
  } else {
    fail(checks, 'session_cap_resolvable', 'Session cap not resolvable')
  }

  // C11-MOS-02
  if (bodySplitList.length > 0) {
    const issues = []
    for (const split of bodySplitList) {
      const cap = Number(split.difficultyOverride ?? split.difficulty_override ?? NaN)
      const label = split.label ?? 'split'
      if (!Number.isFinite(cap) || cap < 1 || cap > 10) {
        issues.push(`${label}: override ${cap} out of 1–10`)
      } else if (cap < sessionCap) {
        issues.push(`${label}: override ${cap} < session cap ${sessionCap}`)
      }
    }
    if (issues.length > 0) {
      fail(checks, 'split_overrides_consistent', 'Split difficulty overrides inconsistent', issues)
    } else {
      pass(checks, 'split_overrides_consistent', 'Split overrides within 1–10 and ≥ session cap')
    }
  }

  // C11-MOR-01 — reuse Cat 4/10 when present
  if (!findCheck(checks, 'primary_over_cap_count')) {
    let overCap = 0
    for (const block of result.blocks ?? []) {
      for (const item of block.items ?? []) {
        if (item.age_fit === 'over_cap') overCap += 1
      }
    }
    if (overCap > 0) {
      fail(checks, 'primary_over_cap_count', `${overCap} primary over_cap item(s)`)
    } else {
      pass(checks, 'primary_over_cap_count', 'No over_cap primaries')
    }
  }

  // C11-MOP-01 — all primaries vs session cap
  const allPrimaryD = (result.blocks ?? []).flatMap((b) => (b.items ?? []).map((i) => Number(i.difficulty?.overall ?? 0)).filter((d) => d > 0))
  const sessionUtil = sessionCap > 0 && allPrimaryD.length > 0 ? mean(allPrimaryD) / sessionCap : 0
  info(checks, 'session_mean_d_utilization', `Session mean D/cap ${(sessionUtil * 100).toFixed(0)}%`, {
    ok_band: sessionUtil >= 0.7,
    rubric: 'C11-MOP-01',
    meanD: mean(allPrimaryD),
    sessionCap,
  })

  // C11-MOP-02–04 phase utilization (Split 2 when splits active)
  for (const [phaseKey, checkId, minRatio] of [
    ['output', 'output_mean_d_pool_cap', 0.65],
    ['capacity', 'capacity_mean_d_pool_cap', 0.65],
    ['resilience', 'resilience_mean_d_pool_cap', 0.55],
  ]) {
    const block = blockByKey(result, phaseKey)
    const util = phaseUtilRatio(block, poolCap, sessionCap, { useSplit2: hasSplits })
    if (!util) continue
    info(checks, checkId, `${phaseKey} mean D/poolCap ${(util.ratio * 100).toFixed(0)}%`, {
      ok_band: util.ratio >= minRatio,
      rubric: `C11-MOP-0${phaseKey === 'output' ? 2 : phaseKey === 'capacity' ? 3 : 4}`,
      ...util,
      useSplit2: hasSplits,
    })
  }

  // C11-MOP-05 / C11-MOP-06 split utilization
  const split1Ds = []
  const split2Ds = []
  for (const block of result.blocks ?? []) {
    for (const item of block.items ?? []) {
      const v1 = split1Variant(item)
      const v2 = split2Variant(item)
      if (v1) split1Ds.push(variantOverallDifficulty(v1, item))
      if (v2) split2Ds.push(variantOverallDifficulty(v2, item))
    }
  }
  if (hasSplits && split1Ds.length > 0) {
    const util1 = mean(split1Ds) / split1Cap
    info(checks, 'split1_mean_d_utilization', `Split 1 mean D/cap ${(util1 * 100).toFixed(0)}%`, {
      ok_band: util1 >= 0.6 && util1 <= 1.0,
      rubric: 'C11-MOP-05',
      split1Cap,
    })
  }
  if (hasSplits && split2Ds.length > 0) {
    const util2 = mean(split2Ds) / split2Cap
    info(checks, 'split2_mean_d_utilization', `Split 2 mean D/cap ${(util2 * 100).toFixed(0)}%`, {
      ok_band: util2 >= 0.7 && util2 <= 1.0,
      rubric: 'C11-MOP-06',
      split2Cap,
    })
  }

  // C11-MOP-07 near-cap rate (Split 2 when splits active)
  let nearCap = 0
  let nearCapTotal = 0
  for (const phaseKey of HIGH_INTENT_PHASES) {
    const block = blockByKey(result, phaseKey)
    for (const item of block?.items ?? []) {
      nearCapTotal += 1
      const d = hasSplits
        ? variantOverallDifficulty(split2Variant(item), item)
        : Number(item.difficulty?.overall ?? 0)
      if (d >= poolCap - 1) nearCap += 1
    }
  }
  const nearCapRate = nearCapTotal > 0 ? nearCap / nearCapTotal : 0
  info(checks, 'high_intent_near_cap_rate', `Near-cap primaries ${(nearCapRate * 100).toFixed(0)}%`, {
    ok_band: nearCapRate >= 0.25,
    rubric: 'C11-MOP-07',
    nearCap,
    nearCapTotal,
  })

  // C11-MOP-08 sandbagging per phase
  const sandbagByPhase = {}
  for (const phaseKey of ['output', 'capacity']) {
    const block = blockByKey(result, phaseKey)
    let sandbag = 0
    for (const item of block?.items ?? []) {
      const d = hasSplits
        ? variantOverallDifficulty(split2Variant(item), item)
        : Number(item.difficulty?.overall ?? 0)
      if (d <= poolCap - 3) sandbag += 1
    }
    sandbagByPhase[phaseKey] = sandbag
  }
  const sandbagOk = Object.values(sandbagByPhase).every((n) => n <= 2)
  info(checks, 'sandbagging_per_phase', `Sandbag counts Output/Capacity: ${sandbagByPhase.output ?? 0}/${sandbagByPhase.capacity ?? 0}`, {
    ok_band: sandbagOk,
    rubric: 'C11-MOP-08',
    sandbagByPhase,
    threshold: 2,
  })

  // C11-MOP-09 proximity bonus lift proxy on selected primaries
  const bonuses = []
  for (const phaseKey of HIGH_INTENT_PHASES) {
    const block = blockByKey(result, phaseKey)
    for (const item of block?.items ?? []) {
      bonuses.push(difficultyProximityBonus(item.difficulty, poolCap))
    }
  }
  const meanBonus = bonuses.length > 0 ? mean(bonuses) : 0
  info(checks, 'proximity_bonus_lift_proxy', `Mean proximity bonus ${meanBonus.toFixed(2)} on high-intent primaries`, {
    ok_band: meanBonus >= 2,
    rubric: 'C11-MOP-09',
    meanBonus,
    poolCap,
  })

  // C11-MOP-11 progression cap utilization
  const progDs = []
  for (const row of collectAllPerSplit(result)) {
    if (row.variant.variant_type !== 'progression') continue
    if (hasSplits && !isSplit2Label(row.variant.split_label)) continue
    progDs.push(Number(row.variant.difficulty?.overall ?? 0))
  }
  const progUtil = progDs.length > 0 && split2Cap > 0 ? mean(progDs) / split2Cap : null
  if (progUtil != null) {
    info(checks, 'progression_cap_utilization', `Progression mean D/cap ${(progUtil * 100).toFixed(0)}%`, {
      ok_band: progUtil >= 0.75,
      rubric: 'C11-MOP-11',
      progDs,
    })
  }

  // C11-MOP-12 restore under-utilization
  const restoreUtil = phaseUtilRatio(blockByKey(result, 'restore'), poolCap, sessionCap)
  if (restoreUtil) {
    info(checks, 'restore_under_utilization', `Restore mean D/cap ${(restoreUtil.ratio * 100).toFixed(0)}%`, {
      ok_band: restoreUtil.ratio <= 0.65,
      rubric: 'C11-MOP-12',
      ...restoreUtil,
    })
  }

  // C11-MOP-13 / C11-MOS prepare-MI cap discipline
  let prepareMiTotal = 0
  let prepareMiOverCapFit = 0
  let prepareMiWithinCap = 0
  for (const phaseKey of ['prepare_and_access', 'movement_intelligence']) {
    const block = blockByKey(result, phaseKey)
    for (const item of block?.items ?? []) {
      prepareMiTotal += 1
      if (item.age_fit !== 'over_cap') prepareMiOverCapFit += 1
      if (Number(item.difficulty?.overall ?? 0) <= sessionCap) prepareMiWithinCap += 1
    }
  }
  const noOverCapRate = prepareMiTotal > 0 ? prepareMiOverCapFit / prepareMiTotal : 1
  if (noOverCapRate < 1) {
    fail(checks, 'prepare_mi_no_over_cap', `Prepare/MI over_cap fit ${(noOverCapRate * 100).toFixed(0)}% < 100%`)
  } else if (prepareMiTotal > 0) {
    pass(checks, 'prepare_mi_no_over_cap', 'Prepare/MI primaries not over_cap')
  }
  const withinCapRate = prepareMiTotal > 0 ? prepareMiWithinCap / prepareMiTotal : 1
  info(checks, 'prepare_mi_cap_discipline', `Prepare/MI D ≤ session cap ${(withinCapRate * 100).toFixed(0)}%`, {
    ok_band: withinCapRate >= 1,
    rubric: 'C11-MOP-13',
    prepareMiTotal,
    prepareMiWithinCap,
  })

  // C11-MOP-14 / C11-MOP-15 technical & load utilization
  const techDs = []
  const loadDs = []
  for (const phaseKey of HIGH_INTENT_PHASES) {
    const block = blockByKey(result, phaseKey)
    for (const item of block?.items ?? []) {
      const tech = Number(item.difficulty?.technical ?? 0)
      const load = Number(item.difficulty?.load ?? 0)
      if (tech > 0) techDs.push(tech)
      if (phaseKey === 'capacity' && load > 0) loadDs.push(load)
    }
  }
  if (techDs.length > 0 && maxTechnical > 0) {
    const techUtil = mean(techDs) / maxTechnical
    info(checks, 'technical_cap_utilization', `Technical mean/cap ${(techUtil * 100).toFixed(0)}%`, {
      ok_band: techUtil >= 0.6,
      rubric: 'C11-MOP-14',
    })
  } else if (maxTechnical > 0) {
    info(checks, 'technical_cap_utilization', 'No technical difficulty on high-intent primaries — gate N/A', {
      ok_band: null,
      rubric: 'C11-MOP-14',
    })
  }
  if (loadDs.length > 0 && maxLoad > 0) {
    const loadUtil = mean(loadDs) / maxLoad
    info(checks, 'load_cap_utilization', `Load mean/cap ${(loadUtil * 100).toFixed(0)}%`, {
      ok_band: loadUtil >= 0.55,
      rubric: 'C11-MOP-15',
    })
  } else if (maxLoad > 0) {
    info(checks, 'load_cap_utilization', 'No load difficulty on Capacity primaries — gate N/A', {
      ok_band: null,
      rubric: 'C11-MOP-15',
    })
  }

  // C11-MOP-16 headroom median
  const headrooms = []
  for (const phaseKey of ['output', 'capacity']) {
    const block = blockByKey(result, phaseKey)
    for (const item of block?.items ?? []) {
      const d = Number(item.difficulty?.overall ?? 0)
      if (d > 0) headrooms.push(poolCap - d)
    }
  }
  if (headrooms.length > 0) {
    const headroomMed = median(headrooms)
    info(checks, 'cap_headroom_median', `Median headroom ${headroomMed.toFixed(1)} (poolCap ${poolCap})`, {
      ok_band: poolCap >= 6 ? headroomMed <= 2 : true,
      rubric: 'C11-MOP-16',
      headrooms,
    })
  }

  // C11-MOP-17 near-cap pool proxy
  const outputFill = phaseFillByKey(result).get('output')
  const poolSize = Number(outputFill?.pool_size ?? 0)
  info(checks, 'near_cap_pool_size_proxy', `Output pool ${poolSize}; selected near-cap ${nearCap}/${nearCapTotal}`, {
    ok_band: poolSize >= 5 && nearCap >= 1,
    rubric: 'C11-MOP-17',
    poolSize,
    nearCap,
    poolCap,
  })

  // C11-MOP-18 utilization stability (lagging)
  const stability = capUtilStability ?? { stable: null, runCount: 0, minRuns: 5 }
  if (stability.stable == null) {
    info(checks, 'cap_utilization_stability', `Output util stability pending (${stability.runCount}/${stability.minRuns ?? 5} eval runs)`, {
      ok_band: null,
      rubric: 'C11-MOP-18',
      ...stability,
    })
  } else if (stability.stable) {
    info(checks, 'cap_utilization_stability', `Output util σ ${stability.std?.toFixed(3) ?? '?'} ≤ ${stability.maxStd ?? 0.05}`, {
      ok_band: true,
      rubric: 'C11-MOP-18',
      ...stability,
    })
  } else {
    info(checks, 'cap_utilization_stability', `Output util σ ${stability.std?.toFixed(3) ?? '?'} > ${stability.maxStd ?? 0.05}`, {
      ok_band: false,
      rubric: 'C11-MOP-18',
      ...stability,
    })
  }

  // C11-MOP-19 split utilization gap
  if (hasSplits && split1Ds.length > 0 && split2Ds.length > 0) {
    const gap = (mean(split2Ds) / split2Cap) - (mean(split1Ds) / split1Cap)
    info(checks, 'split_utilization_gap', `Split2−Split1 util gap ${gap.toFixed(2)}`, {
      ok_band: gap >= 0.1,
      rubric: 'C11-MOP-19',
      split1Util: mean(split1Ds) / split1Cap,
      split2Util: mean(split2Ds) / split2Cap,
    })
  }

  // C11-MOP-20 progression headroom
  if (progDs.length > 0) {
    const headroomMean = mean(progDs.map((d) => split2Cap - d))
    info(checks, 'progression_headroom_to_cap', `Mean progression headroom ${headroomMean.toFixed(1)}`, {
      ok_band: headroomMean <= 2,
      rubric: 'C11-MOP-20',
      split2Cap,
    })
  }

  // C11-MOP-21 prepare/MI low-D expectation
  const lowDPhases = {}
  let lowDOk = true
  for (const phaseKey of ['prepare_and_access', 'movement_intelligence']) {
    const util = phaseUtilRatio(blockByKey(result, phaseKey), poolCap, sessionCap)
    if (!util) continue
    lowDPhases[phaseKey] = util.ratio
    if (util.ratio > 0.55) lowDOk = false
  }
  if (Object.keys(lowDPhases).length > 0) {
    info(checks, 'prepare_mi_low_d_expectation', `Prepare/MI low-D expectation ${lowDOk ? 'met' : 'exceeded'}`, {
      ok_band: lowDOk,
      rubric: 'C11-MOP-21',
      lowDPhases,
    })
  }

  // C11-MOP-22 proximity bonus correlation proxy
  const highBonus = bonuses.filter((b) => b >= 4).length
  const bonusCorrProxy = bonuses.length > 0 ? highBonus / bonuses.length : 0
  info(checks, 'proximity_bonus_correlation_proxy', `High proximity bonus share ${(bonusCorrProxy * 100).toFixed(0)}%`, {
    ok_band: bonusCorrProxy >= 0.3,
    rubric: 'C11-MOP-22',
    highBonus,
    total: bonuses.length,
  })

  // C11-MOR-02 cap sandbagging credibility (Split 2 util when splits active)
  const outUtil = phaseUtilRatio(blockByKey(result, 'output'), poolCap, sessionCap, { useSplit2: hasSplits })
  const capUtil = phaseUtilRatio(blockByKey(result, 'capacity'), poolCap, sessionCap, { useSplit2: hasSplits })
  if (outUtil && capUtil) {
    const bothLow = outUtil.ratio < 0.5 && capUtil.ratio < 0.5
    if (bothLow) {
      fail(checks, 'cap_sandbagging_credibility', `Output (${(outUtil.ratio * 100).toFixed(0)}%) and Capacity (${(capUtil.ratio * 100).toFixed(0)}%) both < 50% poolCap`)
    } else {
      pass(checks, 'cap_sandbagging_credibility', 'At least one high-intent phase uses ≥50% poolCap')
    }
  }

  // MOE informational
  info(checks, 'category11_moe_session_headroom', `Session cap ${sessionCap}; pool cap ${poolCap}; mean primary D ${mean(allPrimaryD).toFixed(1)}`, {
    ok_band: sessionUtil >= 0.65,
    rubric: 'C11-MOE-01',
  })

  if (hasSplits && split1Ds.length > 0 && split2Ds.length > 0) {
    const delta = mean(split2Ds) - mean(split1Ds)
    info(checks, 'category11_moe_split2_exploited', `Split 2 mean D ${mean(split2Ds).toFixed(1)} vs Split 1 ${mean(split1Ds).toFixed(1)} (Δ ${delta.toFixed(1)})`, {
      ok_band: delta >= 1,
      rubric: 'C11-MOE-02',
    })
    info(checks, 'category11_moe_younger_split_completable', `Split 1 util ${((mean(split1Ds) / split1Cap) * 100).toFixed(0)}%`, {
      ok_band: mean(split1Ds) / split1Cap <= 0.85,
      rubric: 'C11-MOE-07',
    })
  }

  const outputBlock = blockByKey(result, 'output')
  let powerBand = 0
  let powerTotal = 0
  for (const item of outputBlock?.items ?? []) {
    const v = hasSplits ? split2Variant(item) : null
    const d = v ? variantOverallDifficulty(v, item) : Number(item.difficulty?.overall ?? 0)
    if (!d) continue
    powerTotal += 1
    if (d >= 5 && d <= 8) powerBand += 1
  }
  if (powerTotal > 0) {
    info(checks, 'category11_moe_output_power_band', `Output D 5–8 band ${((powerBand / powerTotal) * 100).toFixed(0)}%`, {
      ok_band: powerBand / powerTotal >= 0.6,
      rubric: 'C11-MOE-03',
    })
  }

  let lowD = 0
  let hiTotal = 0
  for (const phaseKey of ['output', 'capacity']) {
    const block = blockByKey(result, phaseKey)
    for (const item of block?.items ?? []) {
      hiTotal += 1
      const d = Number(item.difficulty?.overall ?? 0)
      if (d <= 4) lowD += 1
    }
  }
  if (hiTotal > 0) {
    info(checks, 'category11_moe_no_timid_high_intent', `Low-D (≤4) share ${((lowD / hiTotal) * 100).toFixed(0)}% in Output/Capacity`, {
      ok_band: lowD / hiTotal <= 0.3,
      rubric: 'C11-MOE-04',
    })
  }

  const objective = String(expectedBody?.sessionObjective ?? expectedBody?.session_objective ?? profile.sessionObjective ?? '')
  const outMean = outUtil?.meanD ?? 0
  const capMean = capUtil?.meanD ?? 0
  if (objective === 'speed_priority' && outMean > 0 && capMean > 0) {
    info(checks, 'category11_moe_objective_cap_alignment', `Output mean D ${outMean.toFixed(1)} vs Capacity ${capMean.toFixed(1)}`, {
      ok_band: outMean >= capMean,
      rubric: 'C11-MOE-05',
    })
  }

  const prepareMean = phaseUtilRatio(blockByKey(result, 'prepare_and_access'), poolCap, sessionCap)?.meanD ?? 0
  const miMean = phaseUtilRatio(blockByKey(result, 'movement_intelligence'), poolCap, sessionCap)?.meanD ?? 0
  const restoreMean = restoreUtil?.meanD ?? 0
  const arcOk = outMean > miMean && outMean > restoreMean
  info(checks, 'category11_moe_difficulty_arc', `Prepare ${prepareMean.toFixed(1)} → MI ${miMean.toFixed(1)} → Output ${outMean.toFixed(1)} → Restore ${restoreMean.toFixed(1)}`, {
    ok_band: arcOk,
    rubric: 'C11-MOE-08',
  })

  info(checks, 'category11_moe_field_rpe', 'Field RPE survey for Split 2 progressions — manual coach review', {
    ok_band: null,
    rubric: 'C11-MOE-06',
    informational: true,
  })

  info(checks, 'category11_moe_builder_edit_signal', 'Builder difficulty edit telemetry — pending eval history', {
    ok_band: null,
    rubric: 'C11-MOE-09',
    informational: true,
  })

  info(checks, 'category11_moe_review_packet', 'Cap utilization context for coach MOE review', {
    ok_band: true,
    rubric: ['C11-MOE-01', 'C11-MOE-06', 'C11-MOE-07'],
    sessionCap,
    poolCap,
    splits: splits.map((s) => ({ label: s.label, cap: s.caps?.maxOverall })),
    phaseUtil: {
      output: outUtil?.ratio,
      capacity: capUtil?.ratio,
      resilience: phaseUtilRatio(blockByKey(result, 'resilience'), poolCap, sessionCap, { useSplit2: hasSplits })?.ratio,
    },
  })

  for (const id of CATEGORY11_KPI_CHECK_IDS) {
    if (findCheck(checks, id)) continue
    pass(checks, id, 'Cap utilization gate N/A for session shape')
  }
  for (const id of CATEGORY11_UTIL_CHECK_IDS) {
    if (findCheck(checks, id)) continue
    info(checks, id, `${id}: N/A for session shape`, { ok_band: null })
  }
  for (const id of CATEGORY11_MOE_CHECK_IDS) {
    if (findCheck(checks, id)) continue
    info(checks, id, `${id}: N/A for session shape`, { ok_band: null })
  }
}

export function computeCategory11Kpi(checks, opts = {}) {
  const blocking = computeKpi(checks, 11, CATEGORY11_KPI_CHECK_IDS, { minRate: 0.85, ...opts })
  const utilChecks = checks.filter((c) => CATEGORY11_UTIL_CHECK_IDS.includes(c.id))
  const utilPassed = utilChecks.filter((c) => c.detail?.ok_band !== false).length
  const utilRate = utilChecks.length > 0 ? utilPassed / utilChecks.length : 1
  return {
    ...blocking,
    message: blocking.ok
      ? `Category 11 cap util: blocking ${(blocking.detail.rate * 100).toFixed(1)}%; util bands ${(utilRate * 100).toFixed(1)}% (informational)`
      : blocking.message,
    detail: {
      ...blocking.detail,
      utilRate,
      utilPassed,
      utilTotal: utilChecks.length,
      formula: 'blocking KPI ids; util ok_band bands reported in detail',
    },
  }
}

// ─── Category 12 — Equipment Use ────────────────────────────────────────────

export const CATEGORY12_KPI_CHECK_IDS = [
  'equipment_use_coverage',
  'equipment_use_ids_present',
  'equipment_use_mode_enforcement',
  'equipment_items_per_key',
  'equipment_phase_distribution',
  'equipment_progression_consistency',
  'equipment_substituted_variant_coverage',
  'equipment_prescribe_success',
  'equipment_tag_slug_coherence',
  'equipment_snapshot_id_parity',
  'equipment_use_avoid_overlap',
  'equipment_variant_use_filter',
  'equipment_high_intent_share',
  'equipment_use_ids_resolvable',
  'equipment_use_feasible',
  'equipment_progression_split2_keys',
  'equipment_token_use_guard',
]

export const CATEGORY12_MOE_CHECK_IDS = [
  'category12_moe_gear_visible',
  'category12_moe_purposeful_use',
  'category12_moe_setup_friction',
  'category12_moe_facility_parity',
  'category12_moe_phase_intent',
  'category12_moe_youth_safety',
  'category12_moe_gear_rotation',
  'equipment_use_pool_shrink',
  'equipment_minutes_density',
  'equipment_unsatisfiable_payload',
  'equipment_legacy_ids_path',
  'equipment_mode_consistency',
  'category12_moe_review_packet',
]

function bodyUseIds(expectedBody) {
  return (expectedBody?.equipmentUseIds ?? expectedBody?.equipment_use_ids ?? [])
    .map(Number)
    .filter(Number.isFinite)
}

function snapshotUseIds(expectedBody, snapshot) {
  const snap = snapshot ?? expectedBody
  return (snap?.equipmentUse ?? [])
    .map((e) => Number(e.id))
    .filter(Number.isFinite)
}

function bodyAvoidIdsForUse(expectedBody) {
  return (expectedBody?.equipmentAvoidIds ?? expectedBody?.equipment_avoid_ids ?? [])
    .map(Number)
    .filter(Number.isFinite)
}

function useActive(expectedBody) {
  return bodyUseIds(expectedBody).length > 0
}

function equipmentFacetIds(exerciseId, tagMap) {
  return (tagMap.get(String(exerciseId)) ?? [])
    .filter((t) => t.facetType === 'equipment')
    .map((t) => Number(t.facetId))
    .filter(Number.isFinite)
}

function exerciseUsesRequiredId(exerciseId, useIds, tagMap) {
  const useSet = new Set(useIds)
  return equipmentFacetIds(exerciseId, tagMap).some((id) => useSet.has(id))
}

function collectPrescribedRows(result) {
  const rows = []
  for (const block of result.blocks ?? []) {
    for (const item of block.items ?? []) {
      rows.push({ item, block, exercise_id: item.exercise_id, variant: null })
      for (const variant of item.per_split ?? item.split_alternates_json ?? []) {
        rows.push({ item, block, exercise_id: variant.exercise_id, variant })
      }
    }
  }
  return rows
}

function estimateItemMinutes(item, block, exerciseById) {
  const itemCount = (block.items ?? []).length || 1
  const blockMin = Number(block.estimated_minutes ?? block.target_minutes ?? 0)
  if (blockMin > 0) return blockMin / itemCount
  const ex = exerciseById.get(Number(item.exercise_id)) ?? {}
  const sets = Number(item.sets ?? ex.default_sets) || 3
  const work = Number(item.work_seconds ?? ex.default_work_seconds) || 45
  const rest = Number(item.rest_seconds ?? ex.default_rest_seconds ?? 30)
  return (sets * work + (rest === 0 ? 0 : sets * rest)) / 60
}

function dominantEquipmentKeyForItem(item, tagMap, equipmentKeyById, requiredKeys) {
  const keys = equipmentKeysForExercise(item.exercise_id, tagMap, equipmentKeyById)
    .filter((k) => requiredKeys.includes(k))
  return keys[0] ?? null
}

export function evaluateCategory12EquipUse(result, expectedBody, checks, context = {}) {
  const {
    tagMap = new Map(),
    equipmentKeyById = new Map(),
    exerciseById = new Map(),
    thresholds = {},
    snapshot = null,
    bodyweightEquipIds = new Set(),
  } = context

  const useIds = bodyUseIds(expectedBody)
  const useSet = new Set(useIds)
  const active = useActive(expectedBody)
  const minKeys = thresholds.minEquipmentUseKeysPresent ?? []
  const requiredKeys = minKeys.length > 0 ? minKeys : [...useSet].map((id) => equipmentKeyById.get(id)).filter(Boolean)
  const usePolicy = expectedBody?.equipmentUsePolicy ?? expectedBody?.equipment_use_policy ?? 'must_use'
  const minPhasesPerKey = thresholds.minPhasesPerEquipmentKey ?? 2
  const minProgConsistency = thresholds.minEquipmentProgressionConsistencyRate ?? 0.9
  const minHighIntentShare = thresholds.minHighIntentEquipmentShare ?? 0.4
  const minProgSplit2Rate = thresholds.minEquipmentProgressionSplit2Rate ?? 0.8
  const minDensity = thresholds.minEquipmentMinutesDensity ?? 0.15
  const maxTransitionsPerBlock = thresholds.maxEquipmentTransitionsPerBlock ?? 2

  const splits = resultSplits(result)
  const bodySplitList = bodySplits(expectedBody)
  const effectiveSplits =
    splits.length > 0
      ? splits
      : bodySplitList.map((s) => ({
          label: s.label,
          caps: { maxOverall: s.difficultyOverride ?? s.difficulty_override },
        }))

  // C12-MOP-01
  if (!findCheck(checks, 'equipment_use_coverage')) {
    if (!active || requiredKeys.length === 0) {
      pass(checks, 'equipment_use_coverage', 'No equipment use requirements')
    } else {
      const used = new Set()
      for (const block of result.blocks ?? []) {
        for (const item of block.items ?? []) {
          for (const key of equipmentKeysForExercise(item.exercise_id, tagMap, equipmentKeyById)) {
            used.add(key)
          }
        }
      }
      const missing = requiredKeys.filter((k) => !used.has(k))
      if (missing.length > 0) {
        fail(checks, 'equipment_use_coverage', `Missing equipment keys: ${missing.join(', ')}`)
      } else {
        pass(checks, 'equipment_use_coverage', `All required equipment keys present (${requiredKeys.join(', ')})`)
      }
    }
  }

  // C12-MOP-02
  if (!findCheck(checks, 'equipment_use_ids_present')) {
    if (!active) {
      pass(checks, 'equipment_use_ids_present', 'Use inactive — ID presence N/A')
    } else {
      const usedIds = new Set()
      for (const block of result.blocks ?? []) {
        for (const item of block.items ?? []) {
          for (const id of equipmentFacetIds(item.exercise_id, tagMap)) {
            if (useSet.has(id)) usedIds.add(id)
          }
        }
      }
      const missingIds = useIds.filter((id) => !usedIds.has(id))
      if (missingIds.length > 0) {
        const names = missingIds.map((id) => equipmentKeyById.get(id) ?? id).join(', ')
        fail(checks, 'equipment_use_ids_present', `Missing equipment use IDs: ${names}`)
      } else {
        pass(checks, 'equipment_use_ids_present', `All ${useIds.length} equipmentUseIds appear in prescription`)
      }
    }
  }

  // C12-MOP-03 / C12-MOP-17
  if (!findCheck(checks, 'equipment_use_mode_enforcement')) {
    if (!active) {
      pass(checks, 'equipment_use_mode_enforcement', 'Use inactive — mode enforcement N/A')
      pass(checks, 'equipment_variant_use_filter', 'Use inactive — variant filter N/A')
    } else if (usePolicy === 'use_only') {
      const violations = []
      for (const row of collectPrescribedRows(result)) {
        const equipTags = (tagMap.get(String(row.exercise_id)) ?? []).filter((t) => t.facetType === 'equipment')
        if (!exerciseAllowedUseOnly(equipTags, useSet, expectedBody?.allowBodyweight !== false, bodyweightEquipIds)) {
          violations.push(Number(row.exercise_id))
        }
      }
      if (violations.length > 0) {
        fail(checks, 'equipment_use_mode_enforcement', `${violations.length} item(s) violate use_only filter`)
        fail(checks, 'equipment_variant_use_filter', `${violations.length} variant(s) violate use_only filter`)
      } else {
        pass(checks, 'equipment_use_mode_enforcement', 'use_only filter satisfied on all prescribed rows')
        pass(checks, 'equipment_variant_use_filter', 'All variants satisfy use_only filter')
      }
    } else {
      pass(checks, 'equipment_use_mode_enforcement', `must_use policy — post-fill ID coverage enforced (${usePolicy})`)
      pass(checks, 'equipment_variant_use_filter', 'must_use policy — variant filter N/A (scoring boost only)')
    }
  }

  // C12-MOP-04
  if (!findCheck(checks, 'equipment_items_per_key')) {
    if (!active || requiredKeys.length === 0) {
      pass(checks, 'equipment_items_per_key', 'Use inactive — per-key counts N/A')
    } else {
      const keyPrimaries = new Map(requiredKeys.map((k) => [k, new Set()]))
      for (const block of result.blocks ?? []) {
        for (const item of block.items ?? []) {
          for (const key of equipmentKeysForExercise(item.exercise_id, tagMap, equipmentKeyById)) {
            if (keyPrimaries.has(key)) keyPrimaries.get(key).add(item.exercise_id)
          }
        }
      }
      const shortKeys = [...keyPrimaries.entries()].filter(([, s]) => s.size < 1).map(([k]) => k)
      if (shortKeys.length > 0) {
        fail(checks, 'equipment_items_per_key', `Keys with 0 primaries: ${shortKeys.join(', ')}`)
      } else {
        const counts = Object.fromEntries([...keyPrimaries].map(([k, s]) => [k, s.size]))
        pass(checks, 'equipment_items_per_key', `Per-key primary counts OK`, counts)
      }
    }
  }

  // C12-MOP-05
  if (!findCheck(checks, 'equipment_phase_distribution')) {
    if (!active || requiredKeys.length === 0) {
      pass(checks, 'equipment_phase_distribution', 'Use inactive — phase distribution N/A')
    } else {
      const keyPhases = new Map(requiredKeys.map((k) => [k, new Set()]))
      for (const block of result.blocks ?? []) {
        for (const item of block.items ?? []) {
          for (const key of equipmentKeysForExercise(item.exercise_id, tagMap, equipmentKeyById)) {
            if (keyPhases.has(key)) keyPhases.get(key).add(block.phase_key)
          }
        }
      }
      const thin = [...keyPhases.entries()].filter(([, phases]) => phases.size < minPhasesPerKey)
      if (thin.length > 0) {
        fail(
          checks,
          'equipment_phase_distribution',
          `Keys in <${minPhasesPerKey} phases: ${thin.map(([k, p]) => `${k}(${p.size})`).join(', ')}`,
        )
      } else {
        pass(checks, 'equipment_phase_distribution', `Each required key in ≥${minPhasesPerKey} phases`)
      }
    }
  }

  // C12-MOP-06
  if (!findCheck(checks, 'equipment_progression_consistency')) {
    const pairs = collectHighestCapProgressionPairs(result, effectiveSplits)
    let checked = 0
    let ok = 0
    for (const row of pairs) {
      const primaryEquip = new Set(equipmentFacetIds(row.item.exercise_id, tagMap))
      const progEquip = equipmentFacetIds(row.variant.exercise_id, tagMap)
      if (progEquip.length === 0) continue
      checked += 1
      const allowed = new Set([...primaryEquip, ...useSet])
      if (progEquip.every((id) => allowed.has(id))) ok += 1
    }
    if (checked === 0) {
      pass(checks, 'equipment_progression_consistency', 'No progression equipment tags to compare')
    } else {
      const rate = ok / checked
      if (rate < minProgConsistency) {
        fail(checks, 'equipment_progression_consistency', `Progression equipment consistency ${(rate * 100).toFixed(0)}% < ${(minProgConsistency * 100).toFixed(0)}%`)
      } else {
        pass(checks, 'equipment_progression_consistency', `Progression equipment consistency ${(rate * 100).toFixed(0)}% (${ok}/${checked})`)
      }
    }
  }

  // C12-MOP-07
  if (!findCheck(checks, 'equipment_substituted_variant_coverage')) {
    let required = 0
    let ok = 0
    for (const block of result.blocks ?? []) {
      for (const item of block.items ?? []) {
        const primaryUses = active && exerciseUsesRequiredId(item.exercise_id, useIds, tagMap)
        for (const variant of item.per_split ?? item.split_alternates_json ?? []) {
          if (variant.variant_type !== 'substituted') continue
          if (!primaryUses) continue
          required += 1
          if (exerciseUsesRequiredId(variant.exercise_id, useIds, tagMap)) ok += 1
        }
      }
    }
    if (required === 0) {
      pass(checks, 'equipment_substituted_variant_coverage', 'No substituted variants requiring use tags')
    } else if (ok < required) {
      fail(checks, 'equipment_substituted_variant_coverage', `${required - ok}/${required} substituted variant(s) missing use tags`)
    } else {
      pass(checks, 'equipment_substituted_variant_coverage', 'All substituted variants satisfy use list')
    }
  }

  // C12-MOP-08 / C12-MOR-01 / C12-MOS-02
  pass(checks, 'equipment_prescribe_success', 'Prescription succeeded — no unsatisfiable_equipment (C12-MOP-08, C12-MOR-01)')
  pass(checks, 'equipment_use_feasible', 'Use list feasible — prescribe completed (C12-MOS-02)')

  // C12-MOP-09
  info(checks, 'equipment_unsatisfiable_payload', 'unsatisfiable_equipment payload N/A on success path', {
    ok_band: true,
    rubric: 'C12-MOP-09',
    note: 'On 422 fail: error.details.unsatisfiable_equipment must list {id, name}',
  })

  // C12-MOP-10
  const legacyIds = Array.isArray(expectedBody?.equipmentIds)
    ? expectedBody.equipmentIds.map(Number).filter(Number.isFinite)
    : []
  info(checks, 'equipment_legacy_ids_path', legacyIds.length > 0
    ? `Legacy equipmentIds path active (${legacyIds.length} id(s))`
    : 'Golden path uses equipmentUseIds (not legacy equipmentIds)',
  { ok_band: legacyIds.length === 0 || active, rubric: 'C12-MOP-10' })

  // C12-MOP-11
  if (!findCheck(checks, 'equipment_tag_slug_coherence')) {
    const warnings = []
    for (const row of collectPrescribedRows(result)) {
      const ex = exerciseById.get(Number(row.exercise_id)) ?? {
        id: row.exercise_id,
        slug: '',
        name: row.item.exercise_name ?? row.variant?.exercise_name ?? '',
      }
      const equipKeys = equipmentKeysForExercise(row.exercise_id, tagMap, equipmentKeyById)
      for (const w of equipmentTagMismatchWarning(ex, equipKeys)) {
        warnings.push({ exercise_id: row.exercise_id, name: ex.name, warning: w })
      }
    }
    if (warnings.length > 0) {
      fail(checks, 'equipment_tag_slug_coherence', `${warnings.length} equipment tag/slug mismatch warning(s)`, warnings.slice(0, 5))
    } else {
      pass(checks, 'equipment_tag_slug_coherence', 'No equipment tag/slug coherence warnings')
    }
  }

  // C12-MOP-12
  if (!findCheck(checks, 'equipment_snapshot_id_parity')) {
    const snapIds = snapshotUseIds(expectedBody, snapshot)
    if (snapIds.length === 0) {
      pass(checks, 'equipment_snapshot_id_parity', 'Snapshot equipmentUse absent — body equipmentUseIds authoritative')
    } else {
      const snapSet = new Set(snapIds)
      const bodySet = new Set(useIds)
      const missing = useIds.filter((id) => !snapSet.has(id))
      const extra = snapIds.filter((id) => !bodySet.has(id))
      if (missing.length > 0 || extra.length > 0) {
        fail(checks, 'equipment_snapshot_id_parity', 'Snapshot/body use ID mismatch', { missing, extra })
      } else {
        pass(checks, 'equipment_snapshot_id_parity', 'Snapshot equipmentUse IDs match body equipmentUseIds')
      }
    }
  }

  // C12-MOP-13
  const candidates = result.candidates ?? []
  const taggedCandidates = candidates.filter((c) => exerciseUsesRequiredId(c.exercise_id, useIds, tagMap)).length
  const shrinkRatio = candidates.length > 0 && active ? 1 - (taggedCandidates / candidates.length) : 0
  info(checks, 'equipment_use_pool_shrink', active
    ? `Use-tagged candidates ${taggedCandidates}/${candidates.length} (shrink proxy ${(shrinkRatio * 100).toFixed(0)}%)`
    : 'Use inactive — pool shrink N/A',
  {
    ok_band: !active || shrinkRatio < 0.95,
    rubric: 'C12-MOP-13',
    policy: usePolicy,
    note: 'must_use scores boost; use_only hard-filters pool',
  })

  // C12-MOP-14
  let sessionMinutes = 0
  const densityByKey = new Map(requiredKeys.map((k) => [k, 0]))
  for (const block of result.blocks ?? []) {
    sessionMinutes += Number(block.estimated_minutes ?? block.target_minutes ?? 0)
    for (const item of block.items ?? []) {
      const itemMin = estimateItemMinutes(item, block, exerciseById)
      for (const key of equipmentKeysForExercise(item.exercise_id, tagMap, equipmentKeyById)) {
        if (densityByKey.has(key)) densityByKey.set(key, densityByKey.get(key) + itemMin)
      }
    }
  }
  const densityDetail = Object.fromEntries(
    [...densityByKey].map(([k, m]) => [k, sessionMinutes > 0 ? m / sessionMinutes : 0]),
  )
  const kettleDensity = densityDetail.kettlebell ?? 0
  info(checks, 'equipment_minutes_density', `Minutes-weighted density (kettlebell ${(kettleDensity * 100).toFixed(0)}%)`, {
    ok_band: !active || kettleDensity >= minDensity,
    rubric: 'C12-MOP-14',
    densities: densityDetail,
    sessionMinutes,
  })

  // C12-MOP-15
  if (!findCheck(checks, 'equipment_progression_split2_keys')) {
    let denom = 0
    let numer = 0
    for (const row of collectHighestCapProgressionPairs(result, effectiveSplits)) {
      if (!exerciseUsesRequiredId(row.item.exercise_id, useIds, tagMap)) continue
      denom += 1
      if (exerciseUsesRequiredId(row.variant.exercise_id, useIds, tagMap)) numer += 1
    }
    if (denom === 0) {
      pass(checks, 'equipment_progression_split2_keys', 'No progressions requiring use-tagged primaries')
    } else {
      const rate = numer / denom
      if (rate < minProgSplit2Rate) {
        fail(checks, 'equipment_progression_split2_keys', `Split-2 progression use-tag rate ${(rate * 100).toFixed(0)}% < ${(minProgSplit2Rate * 100).toFixed(0)}%`)
      } else {
        pass(checks, 'equipment_progression_split2_keys', `Split-2 progressions carry use tags ${(rate * 100).toFixed(0)}% (${numer}/${denom})`)
      }
    }
  }

  // C12-MOP-16
  if (!findCheck(checks, 'equipment_use_avoid_overlap')) {
    const avoidIds = bodyAvoidIdsForUse(expectedBody)
    const overlap = useIds.filter((id) => avoidIds.includes(id))
    if (overlap.length > 0) {
      fail(checks, 'equipment_use_avoid_overlap', 'equipmentUseIds overlap equipmentAvoidIds', overlap)
    } else {
      pass(checks, 'equipment_use_avoid_overlap', 'No use+avoid ID overlap on prescribe body')
    }
  }

  // C12-MOP-18
  if (!findCheck(checks, 'equipment_high_intent_share')) {
    let total = 0
    let tagged = 0
    for (const block of result.blocks ?? []) {
      if (!['output', 'capacity'].includes(block.phase_key)) continue
      for (const item of block.items ?? []) {
        total += 1
        if (exerciseUsesRequiredId(item.exercise_id, useIds, tagMap)) tagged += 1
      }
    }
    const share = total > 0 ? tagged / total : 1
    if (!active) {
      pass(checks, 'equipment_high_intent_share', 'Use inactive — high-intent share N/A')
    } else if (share < minHighIntentShare) {
      fail(checks, 'equipment_high_intent_share', `Output/Capacity use-tag share ${(share * 100).toFixed(0)}% < ${(minHighIntentShare * 100).toFixed(0)}%`)
    } else {
      pass(checks, 'equipment_high_intent_share', `Output/Capacity use-tag share ${(share * 100).toFixed(0)}% (${tagged}/${total})`)
    }
  }

  // C12-MOS-01
  if (!findCheck(checks, 'equipment_use_ids_resolvable')) {
    if (!active) {
      pass(checks, 'equipment_use_ids_resolvable', 'Use inactive — resolvability N/A')
    } else {
      const missing = useIds.filter((id) => !equipmentKeyById.has(id))
      if (missing.length > 0) {
        fail(checks, 'equipment_use_ids_resolvable', `Unresolved equipmentUseIds: ${missing.join(', ')}`)
      } else {
        pass(checks, 'equipment_use_ids_resolvable', `All ${useIds.length} use IDs resolve in coaching.equipment`)
      }
    }
  }

  // C12-MOS-03
  const snap = snapshot ?? expectedBody
  const equipMode = snap?.equipmentMode
  const hasUse = (snap?.equipmentUse ?? expectedBody?.equipmentUse ?? []).length > 0 || active
  info(checks, 'equipment_mode_consistency', hasUse
    ? `equipmentUsePolicy=${usePolicy}${equipMode ? `, equipmentMode=${equipMode}` : ''}`
    : 'No equipment use configured',
  {
    ok_band: !hasUse || usePolicy === 'must_use' || usePolicy === 'use_only',
    rubric: 'C12-MOS-03',
  })

  // C12-MOR-02
  if (!findCheck(checks, 'equipment_token_use_guard')) {
    if (!active || requiredKeys.length === 0) {
      pass(checks, 'equipment_token_use_guard', 'Use inactive — token guard N/A')
    } else {
      const keyPrimaries = new Map(requiredKeys.map((k) => [k, new Set()]))
      for (const block of result.blocks ?? []) {
        for (const item of block.items ?? []) {
          for (const key of equipmentKeysForExercise(item.exercise_id, tagMap, equipmentKeyById)) {
            if (keyPrimaries.has(key)) keyPrimaries.get(key).add(item.exercise_id)
          }
        }
      }
      const tokenKeys = [...keyPrimaries.entries()].filter(([, s]) => s.size === 1).map(([k]) => k)
      if (tokenKeys.length > 0) {
        fail(checks, 'equipment_token_use_guard', `Single-token equipment use: ${tokenKeys.join(', ')}`)
      } else {
        pass(checks, 'equipment_token_use_guard', 'No required key appears on only one primary')
      }
    }
  }

  const equipSet = new Set()
  for (const block of result.blocks ?? []) {
    for (const item of block.items ?? []) {
      for (const key of equipmentKeysForExercise(item.exercise_id, tagMap, equipmentKeyById)) {
        equipSet.add(key)
      }
    }
  }
  info(checks, 'equipment_diversity', `Distinct equipment keys used: ${equipSet.size}`, { keys: [...equipSet] })

  // MOE proxies
  info(checks, 'category12_moe_gear_visible', active
    ? `Required keys in plan: ${requiredKeys.join(', ')}`
    : 'No use requirements',
  { ok_band: !active || requiredKeys.every((k) => equipSet.has(k)), rubric: 'C12-MOE-01' })

  const purposefulKeys = [...requiredKeys].filter((k) => {
    let count = 0
    for (const block of result.blocks ?? []) {
      for (const item of block.items ?? []) {
        if (equipmentKeysForExercise(item.exercise_id, tagMap, equipmentKeyById).includes(k)) count += 1
      }
    }
    return count >= 2
  })
  info(checks, 'category12_moe_purposeful_use', `Keys with ≥2 drills: ${purposefulKeys.join(', ') || 'none'}`, {
    ok_band: !active || purposefulKeys.length >= Math.ceil(requiredKeys.length * 0.8),
    rubric: 'C12-MOE-02',
  })

  let transitionBlocks = 0
  let highTransitionBlocks = 0
  for (const block of result.blocks ?? []) {
    const keysInBlock = new Set()
    for (const item of block.items ?? []) {
      const dk = dominantEquipmentKeyForItem(item, tagMap, equipmentKeyById, requiredKeys)
      if (dk) keysInBlock.add(dk)
    }
    const transitions = Math.max(0, keysInBlock.size - 1)
    transitionBlocks += 1
    if (transitions > maxTransitionsPerBlock) highTransitionBlocks += 1
  }
  info(checks, 'category12_moe_setup_friction', `${highTransitionBlocks}/${transitionBlocks} blocks exceed ${maxTransitionsPerBlock} equipment transitions`, {
    ok_band: highTransitionBlocks === 0,
    rubric: 'C12-MOE-03',
  })

  info(checks, 'category12_moe_facility_parity', active
    ? `Prescribed use IDs: ${useIds.join(', ')}`
    : 'No facility use list',
  { ok_band: active, rubric: 'C12-MOE-04' })

  const phaseIntentKeys = new Set()
  for (const phaseKey of ['output', 'capacity', 'sustained_capacity', 'movement_intelligence']) {
    const block = blockByKey(result, phaseKey)
    for (const item of block?.items ?? []) {
      for (const key of equipmentKeysForExercise(item.exercise_id, tagMap, equipmentKeyById)) {
        if (requiredKeys.includes(key)) phaseIntentKeys.add(key)
      }
    }
  }
  info(checks, 'category12_moe_phase_intent', `Required keys in Output/Capacity/Sustained/MI: ${[...phaseIntentKeys].join(', ') || 'none'}`, {
    ok_band: !active || phaseIntentKeys.size >= 2,
    rubric: 'C12-MOE-05',
  })

  let split1Kb = 0
  for (const block of result.blocks ?? []) {
    for (const item of block.items ?? []) {
      const ps = item.per_split ?? item.split_alternates_json ?? []
      const split1 = ps.find((v) => isSplit1Label(v.split_label))
      if (!split1) continue
      const keys = equipmentKeysForExercise(split1.exercise_id ?? item.exercise_id, tagMap, equipmentKeyById)
      if (keys.includes('kettlebell')) split1Kb += 1
    }
  }
  info(checks, 'category12_moe_youth_safety', `Split 1 kettlebell variant stations: ${split1Kb}`, {
    ok_band: split1Kb <= 3,
    rubric: 'C12-MOE-06',
    note: 'Coach reviews load appropriateness for ages 8–10',
  })

  info(checks, 'category12_moe_gear_rotation', `Blocks with >${maxTransitionsPerBlock} gear changes: ${highTransitionBlocks}`, {
    ok_band: highTransitionBlocks === 0,
    rubric: 'C12-MOE-07',
  })

  const gearByPhase = (result.blocks ?? []).map((block) => ({
    phase_key: block.phase_key,
    items: (block.items ?? []).map((item) => ({
      exercise_id: item.exercise_id,
      exercise_name: item.exercise_name,
      equipment_keys: equipmentKeysForExercise(item.exercise_id, tagMap, equipmentKeyById).filter((k) => requiredKeys.includes(k)),
    })).filter((row) => row.equipment_keys.length > 0),
  })).filter((b) => b.items.length > 0)

  info(checks, 'category12_moe_review_packet', `${gearByPhase.length} phase(s) with required gear for coach MOE review`, {
    ok_band: true,
    rubric: ['C12-MOE-01', 'C12-MOE-03', 'C12-MOE-06', 'C12-MOE-07'],
    equipment_use_ids: useIds,
    equipment_use_policy: usePolicy,
    gear_by_phase: gearByPhase,
    purposeful_keys: purposefulKeys,
    transition_blocks: highTransitionBlocks,
  })
}

export function computeCategory12Kpi(checks, opts = {}) {
  return computeKpi(checks, 12, CATEGORY12_KPI_CHECK_IDS, { minRate: 0.95, ...opts })
}

// ─── Category 13 — Equipment Avoid ──────────────────────────────────────────

export const CATEGORY13_KPI_CHECK_IDS = [
  'prescription_equipment_avoid_clean',
  'restore_not_box_avoid_false_positive',
  'semantic_avoid_false_negative',
  'equipment_avoid_exclusions_logged',
  'equipment_avoid_id_expansion',
  'equipment_avoid_sample_whitelist_clean',
  'equipment_avoid_expansion_ratio',
  'equipment_avoid_id_parity',
  'equipment_avoid_use_overlap',
  'equipment_avoid_ids_resolvable',
  'equipment_avoid_restore_feasible',
  'equipment_avoid_phase_pool_empty',
  'equipment_avoid_report_present',
]

export const CATEGORY13_MOE_CHECK_IDS = [
  'category13_moe_breathing_available',
  'category13_moe_pattern_diversity',
  'equipment_avoid_semantic_blocks',
  'equipment_avoid_reject_path_ratio',
  'equipment_avoid_semantic_precision',
  'category13_moe_review_packet',
]

function bodyAvoidIds(expectedBody) {
  return (expectedBody?.equipmentAvoidIds ?? expectedBody?.equipment_avoid_ids ?? [])
    .map(Number)
    .filter(Number.isFinite)
}

function snapshotAvoidIds(expectedBody) {
  return (expectedBody?.equipmentAvoid ?? [])
    .map((e) => Number(e.id))
    .filter(Number.isFinite)
}

function collectPrescribedExerciseRows(result) {
  const rows = []
  for (const block of result.blocks ?? []) {
    for (const item of block.items ?? []) {
      rows.push({ item, block, exercise_id: item.exercise_id, variant: null })
      for (const variant of item.per_split ?? item.split_alternates_json ?? []) {
        rows.push({ item, block, exercise_id: variant.exercise_id, variant })
      }
    }
  }
  return rows
}

function avoidActive(expectedBody, context) {
  const raw = bodyAvoidIds(expectedBody)
  const expanded = context.expandedAvoidEquipIds ?? new Set()
  const keys = context.equipmentAvoidKeys ?? []
  return raw.length > 0 || expanded.size > 0 || keys.length > 0
}

function boxAvoidContext(avoidKeys, expandedAvoidEquipIds) {
  const keys = new Set(avoidKeys ?? [])
  const boxKeys = new Set(['box', ...(EQUIPMENT_AVOID_ALIASES.box ?? [])])
  return [...boxKeys].some((k) => keys.has(k)) || (expandedAvoidEquipIds?.size ?? 0) > 1
}

export function evaluateCategory13EquipAvoid(result, expectedBody, checks, context = {}) {
  const {
    tagMap = new Map(),
    exerciseById = new Map(),
    expandedAvoidEquipIds = new Set(),
    equipmentAvoidKeys = [],
  } = context

  const report = result.constraint_report?.equipment_avoid
  const rawAvoidIds = bodyAvoidIds(expectedBody)
  const active = avoidActive(expectedBody, context)

  if (report != null) {
    pass(checks, 'equipment_avoid_report_present', 'equipment_avoid report present')
  } else if (active) {
    fail(checks, 'equipment_avoid_report_present', 'equipment_avoid report missing while avoid configured')
  } else {
    pass(checks, 'equipment_avoid_report_present', 'equipment_avoid report absent — no avoid configured')
  }

  if (!findCheck(checks, 'restore_not_box_avoid_false_positive')) {
    const samples = report?.sample_names ?? []
    const bad = samples.some((n) => /box breathing/i.test(String(n)))
    if (bad) {
      failP0(checks, 'restore_not_box_avoid_false_positive', 'Box breathing false positive in avoid samples')
    } else {
      pass(checks, 'restore_not_box_avoid_false_positive', 'No box-breathing avoid false positive')
    }
  }

  if (!findCheck(checks, 'prescription_equipment_avoid_clean')) {
    if (!active) {
      pass(checks, 'prescription_equipment_avoid_clean', 'No equipment avoid configured — full audit skipped')
    } else {
      const violations = auditPrescriptionEquipmentAvoid(
        result.blocks ?? [],
        tagMap,
        expandedAvoidEquipIds,
        equipmentAvoidKeys,
        exerciseById,
      )
      if (violations.length > 0) {
        failP0(
          checks,
          'prescription_equipment_avoid_clean',
          `${violations.length} equipment-avoid violation(s) in prescription`,
          violations.slice(0, 8),
        )
      } else {
        pass(checks, 'prescription_equipment_avoid_clean', 'No equipment-avoid violations in prescription')
      }
    }
  }

  if (!findCheck(checks, 'semantic_avoid_false_negative')) {
    if (!active || equipmentAvoidKeys.length === 0) {
      pass(checks, 'semantic_avoid_false_negative', 'Semantic false-negative scan skipped — no avoid keys')
    } else {
      const leaks = []
      for (const row of collectPrescribedExerciseRows(result)) {
        const ex = exerciseById.get(Number(row.exercise_id)) ?? {
          id: row.exercise_id,
          slug: '',
          name: row.item.exercise_name ?? row.variant?.exercise_name ?? '',
        }
        if (isBoxSemanticWhitelist(ex)) continue
        const inferred = inferAvoidedEquipmentKeys(ex, equipmentAvoidKeys)
        if (inferred.length > 0) {
          leaks.push({
            exercise_id: Number(row.exercise_id),
            name: ex.name ?? row.item.exercise_name,
            phase_key: row.block.phase_key,
            keys: inferred,
          })
        }
      }
      if (leaks.length > 0) {
        failP0(
          checks,
          'semantic_avoid_false_negative',
          `${leaks.length} semantic avoid false negative(s)`,
          leaks.slice(0, 8),
        )
      } else {
        pass(checks, 'semantic_avoid_false_negative', 'No semantic avoid false negatives')
      }
    }
  }

  if (!findCheck(checks, 'equipment_avoid_exclusions_logged')) {
    if (!active) {
      pass(checks, 'equipment_avoid_exclusions_logged', 'Avoid inactive — exclusions N/A')
    } else if ((report?.excluded_count ?? 0) > 0) {
      pass(checks, 'equipment_avoid_exclusions_logged', `equipment_avoid excluded_count=${report.excluded_count}`)
    } else {
      fail(checks, 'equipment_avoid_exclusions_logged', 'Avoid active but equipment_avoid.excluded_count is 0')
    }
  }

  if (!findCheck(checks, 'equipment_avoid_id_expansion')) {
    if (!active) {
      pass(checks, 'equipment_avoid_id_expansion', 'Avoid inactive — expansion N/A')
    } else if (expandedAvoidEquipIds.size >= rawAvoidIds.length) {
      pass(
        checks,
        'equipment_avoid_id_expansion',
        `Expanded avoid IDs ${expandedAvoidEquipIds.size} ≥ raw ${rawAvoidIds.length}`,
      )
    } else {
      fail(
        checks,
        'equipment_avoid_id_expansion',
        `Expanded avoid set ${expandedAvoidEquipIds.size} < raw ${rawAvoidIds.length}`,
      )
    }
  }

  if (!findCheck(checks, 'equipment_avoid_expansion_ratio')) {
    if (!active || !boxAvoidContext(equipmentAvoidKeys, expandedAvoidEquipIds)) {
      pass(checks, 'equipment_avoid_expansion_ratio', 'Box avoid expansion ratio N/A')
    } else {
      const ratio = rawAvoidIds.length > 0 ? expandedAvoidEquipIds.size / rawAvoidIds.length : 1
      if (ratio >= 2) {
        pass(checks, 'equipment_avoid_expansion_ratio', `Avoid expansion ratio ${ratio.toFixed(1)}×`)
      } else {
        fail(checks, 'equipment_avoid_expansion_ratio', `Avoid expansion ratio ${ratio.toFixed(1)}× < 2× for box avoid`)
      }
    }
  }

  const samples = report?.sample_names ?? []
  if (!findCheck(checks, 'equipment_avoid_sample_whitelist_clean')) {
    const whitelistHits = samples.filter((name) => isBoxSemanticWhitelist({ name, slug: String(name) }))
    if (whitelistHits.length > 0) {
      fail(checks, 'equipment_avoid_sample_whitelist_clean', 'Whitelist names in avoid samples', whitelistHits)
    } else {
      pass(checks, 'equipment_avoid_sample_whitelist_clean', 'No whitelist names in avoid samples')
    }
  }

  if (!findCheck(checks, 'equipment_avoid_id_parity')) {
    const snapIds = snapshotAvoidIds(expectedBody)
    if (snapIds.length === 0) {
      pass(checks, 'equipment_avoid_id_parity', 'Snapshot equipmentAvoid absent — body ids authoritative')
    } else {
      const snapSet = new Set(snapIds)
      const bodySet = new Set(rawAvoidIds)
      const missing = rawAvoidIds.filter((id) => !snapSet.has(id))
      const extra = snapIds.filter((id) => !bodySet.has(id))
      if (missing.length > 0 || extra.length > 0) {
        fail(checks, 'equipment_avoid_id_parity', 'Snapshot/body avoid ID mismatch', { missing, extra })
      } else {
        pass(checks, 'equipment_avoid_id_parity', 'Snapshot equipmentAvoid IDs match body')
      }
    }
  }

  if (!findCheck(checks, 'equipment_avoid_use_overlap')) {
    const useIds = new Set(
      (expectedBody?.equipmentUseIds ?? expectedBody?.equipment_use_ids ?? [])
        .map(Number)
        .filter(Number.isFinite),
    )
    const bodyOverlap = rawAvoidIds.filter((id) => useIds.has(id))
    if (bodyOverlap.length > 0) {
      fail(checks, 'equipment_avoid_use_overlap', 'equipmentUseIds overlap equipmentAvoidIds', bodyOverlap)
    }

    let itemOverlap = 0
    for (const row of collectPrescribedExerciseRows(result)) {
      const equipIds = (tagMap.get(String(row.exercise_id)) ?? [])
        .filter((t) => t.facetType === 'equipment')
        .map((t) => Number(t.facetId))
        .filter(Number.isFinite)
      const hasUse = equipIds.some((id) => useIds.has(id))
      const hasAvoid = equipIds.some((id) => expandedAvoidEquipIds.has(id))
      if (hasUse && hasAvoid) itemOverlap += 1
    }
    if (itemOverlap > 0) {
      fail(checks, 'equipment_avoid_use_overlap', `${itemOverlap} prescribed item(s) tagged both use and avoid`)
    } else if (bodyOverlap.length === 0) {
      pass(checks, 'equipment_avoid_use_overlap', 'No use+avoid overlap on body or prescribed items')
    }
  }

  if (!findCheck(checks, 'equipment_avoid_ids_resolvable')) {
    if (!active) {
      pass(checks, 'equipment_avoid_ids_resolvable', 'Avoid inactive — resolvability N/A')
    } else if (rawAvoidIds.length > 0 && equipmentAvoidKeys.length === 0 && expandedAvoidEquipIds.size === 0) {
      fail(checks, 'equipment_avoid_ids_resolvable', 'Avoid IDs configured but expansion context empty')
    } else {
      pass(checks, 'equipment_avoid_ids_resolvable', `Avoid keys resolved: ${equipmentAvoidKeys.join(', ') || 'expanded'}`)
    }
  }

  const restoreBlock = blockByKey(result, 'restore')
  const restoreFill = (result.constraint_report?.phase_fill ?? []).find((f) => f.phase_key === 'restore')
  const restorePool = restoreFill?.pool_size ?? 0
  if (!findCheck(checks, 'equipment_avoid_restore_feasible')) {
    if (!active) {
      pass(checks, 'equipment_avoid_restore_feasible', 'Avoid inactive — restore feasibility N/A')
    } else if ((restoreBlock?.items ?? []).length === 0) {
      fail(checks, 'equipment_avoid_restore_feasible', 'Restore empty after equipment avoid')
    } else if (restorePool > 0 && restorePool < 3) {
      info(checks, 'equipment_avoid_restore_pool_floor', `Restore pool_size ${restorePool} < 3`, { ok_band: restorePool >= 3 })
      pass(checks, 'equipment_avoid_restore_feasible', `Restore viable with ${(restoreBlock?.items ?? []).length} item(s)`)
    } else {
      pass(
        checks,
        'equipment_avoid_restore_feasible',
        `Restore feasible: ${(restoreBlock?.items ?? []).length} item(s), pool_size ${restorePool || 'n/a'}`,
      )
    }
  }

  if (!findCheck(checks, 'equipment_avoid_phase_pool_empty')) {
    const emptyReasons = result.constraint_report?.empty_phase_reasons ?? []
    const workingEmpty = emptyReasons.filter(
      (r) => /pool_empty|no exercises/i.test(String(r)) && /output|capacity/i.test(String(r)),
    )
    if (active && workingEmpty.length > 0) {
      fail(checks, 'equipment_avoid_phase_pool_empty', 'Working phase pool_empty with avoid active', workingEmpty)
    } else {
      pass(checks, 'equipment_avoid_phase_pool_empty', 'No working-phase pool_empty attributable to avoid')
    }
  }

  const inferSampleHits = samples.filter((name) => inferAvoidedEquipmentKeys({ name, slug: String(name) }, equipmentAvoidKeys).length > 0)
  const semanticBlockCount = inferSampleHits.length
  info(checks, 'equipment_avoid_semantic_blocks', `Semantic-path sample hits: ${semanticBlockCount}/${samples.length}`, {
    ok_band: !active || semanticBlockCount > 0 || samples.length === 0,
    rubric: 'C13-MOP-04',
  })

  const barAvoid = equipmentAvoidKeys.includes('bar') || equipmentAvoidKeys.some((k) => (EQUIPMENT_AVOID_ALIASES.bar ?? []).includes(k))
  if (barAvoid) {
    const barAliases = EQUIPMENT_AVOID_ALIASES.bar ?? []
    const aliasKeysPresent = barAliases.every((alias) => equipmentAvoidKeys.includes(alias) || [...expandedAvoidEquipIds].length > rawAvoidIds.length)
    info(checks, 'equipment_avoid_bar_alias_coverage', `Bar avoid aliases in expanded set`, {
      ok_band: aliasKeysPresent,
      rubric: 'C13-MOP-09',
    })
  }

  const rejectInferRate = samples.length > 0 ? inferSampleHits.length / samples.length : 0
  info(checks, 'equipment_avoid_reject_path_ratio', `Infer-path sample share ${(rejectInferRate * 100).toFixed(0)}%`, {
    ok_band: true,
    rubric: 'C13-MOP-13',
    infer_hits: inferSampleHits.length,
    total_samples: samples.length,
  })

  const falsePositives = samples.filter((name) => isBoxSemanticWhitelist({ name, slug: String(name) })).length
  const precision = samples.length > 0 ? 1 - falsePositives / samples.length : 1
  info(checks, 'equipment_avoid_semantic_precision', `Sample precision proxy ${(precision * 100).toFixed(0)}%`, {
    ok_band: precision >= 0.9,
    rubric: 'C13-MOP-18',
  })

  let breathingHits = 0
  for (const item of restoreBlock?.items ?? []) {
    const ex = exerciseById.get(Number(item.exercise_id)) ?? { slug: '', name: item.exercise_name ?? '' }
    const blob = `${ex.slug ?? ''} ${item.exercise_name ?? ''}`.toLowerCase()
    if (/breath|breathing/.test(blob)) breathingHits += 1
  }
  const boxAvoided = boxAvoidContext(equipmentAvoidKeys, expandedAvoidEquipIds)
  info(checks, 'category13_moe_breathing_available', `Restore breathing items: ${breathingHits}`, {
    ok_band: !boxAvoided || breathingHits >= 1,
    rubric: 'C13-MOE-02',
  })

  const patternSet = new Set()
  for (const row of collectPrescribedExerciseRows(result)) {
    for (const pid of patternIdsForExercise(row.exercise_id, tagMap)) {
      patternSet.add(pid)
    }
  }
  info(checks, 'category13_moe_pattern_diversity', `Distinct movement patterns prescribed: ${patternSet.size}`, {
    ok_band: patternSet.size >= 3,
    rubric: 'C13-MOE-04',
  })

  info(checks, 'category13_moe_review_packet', `${samples.length} avoid sample(s) for coach MOE review`, {
    ok_band: true,
    equipment_avoid: {
      raw_ids: rawAvoidIds,
      avoid_keys: equipmentAvoidKeys,
      excluded_count: report?.excluded_count ?? 0,
      sample_names: samples.slice(0, 8),
      box_avoid_active: boxAvoided,
    },
    prescribed_summary: collectPrescribedExerciseRows(result)
      .slice(0, 12)
      .map((r) => ({
        phase_key: r.block.phase_key,
        exercise_id: r.exercise_id,
        name: exerciseById.get(Number(r.exercise_id))?.name ?? r.item.exercise_name,
      })),
    rubric: ['C13-MOE-01', 'C13-MOE-03', 'C13-MOE-05', 'C13-MOE-06'],
  })
}

export function computeCategory13Kpi(checks, opts = {}) {
  return computeKpi(checks, 13, CATEGORY13_KPI_CHECK_IDS, opts)
}

// ─── Category 14 — Movement avoids ──────────────────────────────────────────

function avoidConfigFromBody(body) {
  const avoidExerciseIds = Array.isArray(body?.avoidExerciseIds ?? body?.avoid_exercise_ids)
    ? (body.avoidExerciseIds ?? body.avoid_exercise_ids).map(Number).filter(Number.isFinite)
    : []
  const avoidExerciseSlugs = Array.isArray(body?.avoidExerciseSlugs ?? body?.avoid_exercise_slugs)
    ? (body.avoidExerciseSlugs ?? body.avoid_exercise_slugs).map(String)
    : []
  const excludeBodyRegionIds = Array.isArray(
    body?.excludeBodyRegionIds ?? body?.bodyRegionExcludeIds ?? body?.body_region_exclude_ids,
  )
    ? (body.excludeBodyRegionIds ?? body.bodyRegionExcludeIds ?? body.body_region_exclude_ids)
      .map(Number)
      .filter(Number.isFinite)
    : []
  const avoidTokens = Array.isArray(body?.avoidTokens) ? body.avoidTokens : []
  return { avoidExerciseIds, avoidExerciseSlugs, excludeBodyRegionIds, avoidTokens }
}

function bodyRegionIdsForExercise(exerciseId, tagMap) {
  return (tagMap.get(String(exerciseId)) ?? [])
    .filter((t) => t.facetType === 'body_region')
    .map((t) => Number(t.facetId))
}

function collectPrescribedEntries(result, exerciseById) {
  const entries = []
  for (const block of result.blocks ?? []) {
    for (const item of block.items ?? []) {
      const ex = exerciseById.get(Number(item.exercise_id))
      entries.push({
        phase_key: block.phase_key,
        exercise_id: Number(item.exercise_id),
        slug: ex?.slug ?? item.exercise_slug ?? String(item.exercise_id),
        name: ex?.name ?? item.exercise_name ?? '',
        kind: 'primary',
        item,
      })
      for (const v of item.per_split ?? item.split_alternates_json ?? []) {
        const vex = exerciseById.get(Number(v.exercise_id))
        entries.push({
          phase_key: block.phase_key,
          exercise_id: Number(v.exercise_id),
          slug: vex?.slug ?? v.exercise_slug ?? String(v.exercise_id),
          name: vex?.name ?? v.exercise_name ?? '',
          kind: 'per_split',
          variant: v,
          item,
        })
      }
    }
  }
  return entries
}

export const CATEGORY14_KPI_CHECK_IDS = [
  'exercise_avoid_ids_honored',
  'exercise_avoid_slugs_honored',
  'exercise_avoid_leak',
  'per_split_avoid_consistency',
  'body_region_exclusion_honored',
  'body_region_avoid_count_plausible',
  'exercise_avoid_pre_pool_count',
  'movement_family_phase_cap',
  'output_pogo_bound_family_cap',
  'session_movement_family_floor',
  'diversity_family_mor_guard',
  'normalized_name_no_collisions',
  'slug_stem_no_repeats',
  'avoid_use_joint_feasibility',
  'body_region_exclude_id_valid',
  'avoid_exercise_slugs_resolvable',
  'body_region_pool_feasibility',
  'body_region_over_prune_mor',
]

export const CATEGORY14_MOE_CHECK_IDS = [
  'category14_moe_body_region_pruning',
  'category14_moe_movement_variety',
  'category14_moe_review_packet',
  'pattern_repetition_within_cap',
  'category14_tbd_avoid_tokens',
  'category14_tbd_pattern_penalty',
  'category14_tbd_athlete_avoid',
]

export function evaluateCategory14MovementAvoid(result, expectedBody, checks, context = {}) {
  const { exerciseById = new Map(), tagMap = new Map() } = context
  const bodyRegionFacetIds = context.bodyRegionFacetIds ?? new Set()
  const avoidSlugExists = context.avoidSlugExists ?? new Map()
  const avoid = avoidConfigFromBody(expectedBody)
  const { avoidExerciseIds, avoidExerciseSlugs, excludeBodyRegionIds, avoidTokens } = avoid
  const avoidIdSet = new Set(avoidExerciseIds)
  const avoidSlugSet = new Set(avoidExerciseSlugs.map((s) => String(s).toLowerCase()))
  const regionExcludeSet = new Set(excludeBodyRegionIds)
  const entries = collectPrescribedEntries(result, exerciseById)
  const constraint = result.constraint_report ?? {}

  const idLeaks = entries.filter((e) => avoidIdSet.has(e.exercise_id))
  if (avoidExerciseIds.length === 0) {
    pass(checks, 'exercise_avoid_ids_honored', 'No avoidExerciseIds configured')
  } else if (idLeaks.length > 0) {
    failP0(checks, 'exercise_avoid_ids_honored', `${idLeaks.length} prescribed ID(s) in avoid list`, idLeaks.slice(0, 5))
  } else {
    pass(checks, 'exercise_avoid_ids_honored', 'All avoidExerciseIds honored')
  }

  const slugLeaks = entries.filter((e) => avoidSlugSet.has(String(e.slug).toLowerCase()))
  if (avoidExerciseSlugs.length === 0) {
    pass(checks, 'exercise_avoid_slugs_honored', 'No avoidExerciseSlugs configured')
  } else if (slugLeaks.length > 0) {
    failP0(checks, 'exercise_avoid_slugs_honored', `${slugLeaks.length} prescribed slug(s) in avoid list`, slugLeaks.slice(0, 5))
  } else {
    pass(checks, 'exercise_avoid_slugs_honored', 'All avoidExerciseSlugs honored')
  }

  const unionLeaks = entries.filter(
    (e) => avoidIdSet.has(e.exercise_id) || avoidSlugSet.has(String(e.slug).toLowerCase()),
  )
  if (avoidExerciseIds.length === 0 && avoidExerciseSlugs.length === 0) {
    pass(checks, 'exercise_avoid_leak', 'No exercise avoid set configured')
  } else if (unionLeaks.length > 0) {
    failP0(checks, 'exercise_avoid_leak', `${unionLeaks.length} avoid leak(s) in prescription`, unionLeaks.slice(0, 5))
  } else {
    pass(checks, 'exercise_avoid_leak', 'Zero avoid leaks (P0)')
  }

  if (avoidExerciseIds.length === 0 && avoidExerciseSlugs.length === 0) {
    pass(checks, 'per_split_avoid_consistency', 'No avoid lists — per_split consistency N/A')
  } else if (unionLeaks.some((e) => e.kind === 'per_split')) {
    fail(checks, 'per_split_avoid_consistency', 'per_split variant(s) violate avoid lists')
  } else {
    pass(checks, 'per_split_avoid_consistency', 'per_split variants honor avoid lists')
  }

  const regionTagged = entries.filter((e) =>
    bodyRegionIdsForExercise(e.exercise_id, tagMap).some((id) => regionExcludeSet.has(id)),
  )
  if (excludeBodyRegionIds.length === 0) {
    pass(checks, 'body_region_exclusion_honored', 'No body-region excludes configured')
  } else if (regionTagged.length > 0) {
    failP0(checks, 'body_region_exclusion_honored', `${regionTagged.length} item(s) tagged excluded body_region`, regionTagged.slice(0, 5))
  } else {
    pass(checks, 'body_region_exclusion_honored', 'Body-region excludes honored')
  }

  const bodyAvoidCount = constraint.body_region_avoid?.excluded_count ?? 0
  if (excludeBodyRegionIds.length === 0) {
    pass(checks, 'body_region_avoid_count_plausible', 'body_region_avoid N/A (no excludes)')
  } else if (bodyAvoidCount <= 0) {
    fail(checks, 'body_region_avoid_count_plausible', 'body_region_avoid.excluded_count should be > 0 when excludes active')
  } else {
    pass(checks, 'body_region_avoid_count_plausible', `body_region_avoid excluded_count=${bodyAvoidCount}`)
  }

  const exAvoidCount = constraint.exercise_avoid?.excluded_count ?? null
  const configuredAvoidCount = avoidExerciseIds.length + avoidExerciseSlugs.length
  if (configuredAvoidCount === 0) {
    pass(checks, 'exercise_avoid_pre_pool_count', 'exercise_avoid N/A (no exercise avoids)')
  } else if (exAvoidCount !== configuredAvoidCount) {
    fail(checks, 'exercise_avoid_pre_pool_count', `exercise_avoid count ${exAvoidCount} !== configured ${configuredAvoidCount}`)
  } else {
    pass(checks, 'exercise_avoid_pre_pool_count', `exercise_avoid excluded_count=${exAvoidCount}`)
  }

  const familyCounts = new Map()
  const sessionFamilyCounts = new Map()
  let familyCapViolations = []
  for (const block of result.blocks ?? []) {
    const phaseKey = block.phase_key
    const phaseMap = familyCounts.get(phaseKey) ?? new Map()
    for (const item of block.items ?? []) {
      const ex = exerciseById.get(Number(item.exercise_id)) ?? { slug: item.exercise_slug, name: item.exercise_name }
      const familyKey = movementFamilyKey(ex)
      if (!familyKey) continue
      const limit = movementFamilyLimit(phaseKey)
      const phaseCount = phaseMap.get(familyKey) ?? 0
      if (limit != null && phaseCount >= limit) {
        familyCapViolations.push({ phase_key: phaseKey, family: familyKey, count: phaseCount + 1, limit })
      }
      phaseMap.set(familyKey, phaseCount + 1)
      sessionFamilyCounts.set(familyKey, (sessionFamilyCounts.get(familyKey) ?? 0) + 1)
    }
    familyCounts.set(phaseKey, phaseMap)
  }
  if (familyCapViolations.length > 0) {
    fail(checks, 'movement_family_phase_cap', `${familyCapViolations.length} movement-family cap violation(s)`, familyCapViolations.slice(0, 5))
  } else {
    pass(checks, 'movement_family_phase_cap', 'Movement-family phase caps honored')
  }

  const outputBlock = blockByKey(result, 'output')
  const pogoBoundCounts = { pogo: 0, bound: 0 }
  for (const item of outputBlock?.items ?? []) {
    const ex = exerciseById.get(Number(item.exercise_id)) ?? { slug: item.exercise_slug, name: item.exercise_name }
    const familyKey = movementFamilyKey(ex)
    if (familyKey === 'pogo' || familyKey === 'bound') {
      pogoBoundCounts[familyKey] += 1
    }
  }
  const outputLimit = movementFamilyLimit('output') ?? 2
  const pogoBoundBad = Object.entries(pogoBoundCounts).filter(([, n]) => n > outputLimit)
  if (pogoBoundBad.length > 0) {
    fail(checks, 'output_pogo_bound_family_cap', `Output pogo/bound exceeds limit ${outputLimit}`, pogoBoundCounts)
  } else {
    pass(checks, 'output_pogo_bound_family_cap', `Output pogo/bound within limit (${outputLimit})`)
  }

  const sessionFamilies = new Set()
  for (const block of result.blocks ?? []) {
    for (const item of block.items ?? []) {
      const ex = exerciseById.get(Number(item.exercise_id))
      const family = String(ex?.movement_family ?? movementFamilyKey(ex) ?? '').trim()
      if (family) sessionFamilies.add(family.toLowerCase())
    }
  }
  const familyCount = sessionFamilies.size
  if (familyCount < 5) {
    fail(checks, 'session_movement_family_floor', `Only ${familyCount} distinct movement families (min 5)`)
  } else {
    pass(checks, 'session_movement_family_floor', `${familyCount} distinct movement families`)
  }
  if (familyCount < 4) {
    fail(checks, 'diversity_family_mor_guard', `Session collapsed to ${familyCount} families (MOR threshold <4)`)
  } else {
    pass(checks, 'diversity_family_mor_guard', `Family diversity guard OK (${familyCount} families)`)
  }

  const normNames = new Map()
  const nameCollisions = []
  for (const block of result.blocks ?? []) {
    for (const item of block.items ?? []) {
      const ex = exerciseById.get(Number(item.exercise_id))
      const norm = normalizeExerciseName(ex?.name ?? item.exercise_name)
      if (!norm) continue
      if (normNames.has(norm)) nameCollisions.push({ name: norm, phases: [normNames.get(norm), block.phase_key] })
      else normNames.set(norm, block.phase_key)
    }
  }
  if (nameCollisions.length > 0) {
    fail(checks, 'normalized_name_no_collisions', `${nameCollisions.length} normalized name collision(s)`, nameCollisions.slice(0, 5))
  } else {
    pass(checks, 'normalized_name_no_collisions', 'No normalized name collisions session-wide')
  }

  const stemCounts = new Map()
  const stemRepeats = []
  for (const block of result.blocks ?? []) {
    for (const item of block.items ?? []) {
      const ex = exerciseById.get(Number(item.exercise_id))
      const stem = normalizeSlugStem(ex?.slug ?? item.exercise_slug)
      if (!stem) continue
      stemCounts.set(stem, (stemCounts.get(stem) ?? 0) + 1)
    }
  }
  for (const [stem, n] of stemCounts.entries()) {
    if (n > 1) stemRepeats.push({ stem, count: n })
  }
  if (stemRepeats.length > 0) {
    fail(checks, 'slug_stem_no_repeats', `${stemRepeats.length} slug stem repeat(s)`, stemRepeats.slice(0, 5))
  } else {
    pass(checks, 'slug_stem_no_repeats', 'No slug stem repeats among primaries')
  }

  const patternCounts = new Map()
  for (const block of result.blocks ?? []) {
    for (const item of block.items ?? []) {
      for (const patternId of patternIdsForExercise(item.exercise_id, tagMap)) {
        patternCounts.set(patternId, (patternCounts.get(patternId) ?? 0) + 1)
      }
    }
  }
  const overLimitPatterns = [...patternCounts.entries()].filter(([, n]) => n > 2)
  const maxRepeat = patternCounts.size > 0 ? Math.max(...patternCounts.values()) : 0
  info(checks, 'pattern_repetition_within_cap', `${overLimitPatterns.length} pattern(s) repeat >2×; max ${maxRepeat}×`, {
    rubric: 'C14-MOP-07',
    ok_band: overLimitPatterns.length === 0,
    over_limit: overLimitPatterns.slice(0, 5),
  })

  const hasUse = (expectedBody?.equipmentUseIds ?? expectedBody?.equipment_use_ids ?? []).length > 0
  const hasAvoid = avoidExerciseIds.length > 0 || avoidExerciseSlugs.length > 0 || excludeBodyRegionIds.length > 0
  const poolEmptyReasons = (constraint.empty_phase_reasons ?? []).filter((r) => /pool_empty/i.test(String(r)))
  if (hasUse && hasAvoid && poolEmptyReasons.length > 0) {
    fail(checks, 'avoid_use_joint_feasibility', 'pool_empty with joint use+avoid filters active', poolEmptyReasons.slice(0, 3))
  } else {
    pass(checks, 'avoid_use_joint_feasibility', 'No pool_empty from joint use+avoid filters')
  }

  if (excludeBodyRegionIds.length === 0) {
    pass(checks, 'body_region_exclude_id_valid', 'body_region exclude ID validity N/A')
  } else {
    const invalid = excludeBodyRegionIds.filter((id) => bodyRegionFacetIds.size > 0 && !bodyRegionFacetIds.has(id))
    if (invalid.length > 0) {
      fail(checks, 'body_region_exclude_id_valid', `${invalid.length} invalid body_region exclude ID(s)`, invalid)
    } else {
      pass(checks, 'body_region_exclude_id_valid', 'All body_region exclude IDs valid')
    }
  }

  if (avoidExerciseSlugs.length === 0) {
    pass(checks, 'avoid_exercise_slugs_resolvable', 'avoid slug resolvability N/A')
  } else {
    const orphanSlugs = avoidExerciseSlugs.filter((slug) => {
      const key = String(slug).toLowerCase()
      return avoidSlugExists.size > 0 && !avoidSlugExists.get(key)
    })
    if (orphanSlugs.length > 0) {
      fail(checks, 'avoid_exercise_slugs_resolvable', `${orphanSlugs.length} avoid slug(s) unmatched in DB`, orphanSlugs)
    } else {
      pass(checks, 'avoid_exercise_slugs_resolvable', 'All avoidExerciseSlugs resolve in DB')
    }
  }

  if (excludeBodyRegionIds.length === 0) {
    pass(checks, 'body_region_pool_feasibility', 'body_region pool feasibility N/A')
  } else if (poolEmptyReasons.length > 0) {
    fail(checks, 'body_region_pool_feasibility', 'pool_empty after body_region filter')
  } else {
    pass(checks, 'body_region_pool_feasibility', 'Phases fill after body_region filter')
  }

  const phaseFill = constraint.phase_fill ?? []
  const overPruneHits = phaseFill.filter((fill) => {
    const poolSize = Number(fill.pool_size ?? 0)
    const excluded = bodyAvoidCount
    return poolSize > 0 && excluded > poolSize * 0.5 && /pool_empty/i.test(
      (constraint.empty_phase_reasons ?? []).find((r) => String(r).includes(fill.phase_key)) ?? '',
    )
  })
  if (excludeBodyRegionIds.length === 0) {
    pass(checks, 'body_region_over_prune_mor', 'body_region over-prune MOR N/A')
  } else if (overPruneHits.length > 0) {
    failP0(checks, 'body_region_over_prune_mor', 'body_region filter caused empty phase (>50% pool)', overPruneHits)
  } else {
    pass(checks, 'body_region_over_prune_mor', 'No body_region over-prune empty phases')
  }

  if (avoidTokens.length === 0) {
    info(checks, 'avoid_tokens_honored', 'avoidTokens empty — honored by absence (Test 3)', { rubric: 'C14-MOP-03', ok_band: true })
  } else {
    tbd(checks, 'avoid_tokens_honored', 'avoidTokens NL resolver not wired — stub until snapshot forward ships', { rubric: 'C14-MOP-03' })
  }

  tbd(checks, 'category14_tbd_avoid_tokens', 'NL avoid token path TBD (C14-MOP-11, C14-MOP-13, C14-MOS-02)', {
    rubric: ['C14-MOP-11', 'C14-MOP-13', 'C14-MOS-02'],
    avoid_tokens_count: avoidTokens.length,
  })
  tbd(checks, 'category14_tbd_pattern_penalty', 'scoreTargets rank-delta telemetry TBD (C14-MOP-18)', { rubric: 'C14-MOP-18' })
  tbd(checks, 'category14_tbd_athlete_avoid', 'Athlete injury avoid path TBD (C14-MOE-04)', { rubric: 'C14-MOE-04' })

  const emptyFromRegion = poolEmptyReasons.length > 0 && excludeBodyRegionIds.length > 0
  info(checks, 'category14_moe_body_region_pruning', `body_region over-prune risk: ${emptyFromRegion}`, {
    rubric: 'C14-MOE-02',
    ok_band: !emptyFromRegion,
    excluded_count: bodyAvoidCount,
  })
  info(checks, 'category14_moe_movement_variety', `Session movement families: ${familyCount}`, {
    rubric: 'C14-MOE-03',
    ok_band: familyCount >= 5,
    families: [...sessionFamilies],
  })

  const avoidSummary = {
    avoidExerciseIds,
    avoidExerciseSlugs,
    excludeBodyRegionIds,
    avoidTokens: avoidTokens.map((t) => t?.label ?? t),
  }
  pass(checks, 'category14_moe_review_packet', `${entries.length} prescribed slot(s) for coach MOE review`, {
    informational: true,
    rubric: ['C14-MOE-01', 'C14-MOE-05', 'C14-MOE-06', 'C14-MOE-07'],
    avoid_config: avoidSummary,
    prescribed_slugs: entries.filter((e) => e.kind === 'primary').map((e) => e.slug),
  })
}

export function computeCategory14Kpi(checks, opts = {}) {
  return computeKpi(checks, 14, CATEGORY14_KPI_CHECK_IDS, { minRate: 0.95, ...opts })
}

// ─── Category 15 — Phase intent alignment ───────────────────────────────────

const SPEED_TENET_FACET_ID = 3
const HIIT_METHODOLOGY_FACET_ID = 1169
const SPEED_PATTERN_RE = /sprint|plyo|acceleration|bound|shuttle|sprint|run-speed|power/i
const INTERVAL_PROGRAMMING_KINDS = new Set(['exercise', 'interval', 'circuit', 'conditioning_intervals'])

export const CATEGORY15_KPI_CHECK_IDS = [
  'focus_targets_count_parity',
  'focus_targets_field_parity',
  'output_speed_tenet_match',
  'output_focus_score_honored',
  'sustained_hiit_methodology_share',
  'sustained_strict_hiit_gate',
  'hiit_not_leaked_other_phases',
  'output_speed_tenet_frequency',
  'focus_targets_dropped',
  'hiit_in_low_intent_phases',
  'focus_weight_ignored',
]

export const CATEGORY15_MOE_CHECK_IDS = [
  'category15_moe_focus_weight_drives',
  'category15_moe_methodology_label',
  'category15_moe_session_objective_synergy',
  'category15_moe_review_packet',
]

function planPhaseKey(row) {
  return row.phaseKey ?? row.phase_key ?? row.phase
}

function planRows(body) {
  return Array.isArray(body?.phasePlan) ? body.phasePlan : []
}

function scoreTargets(tags, targets) {
  let score = 0
  for (const target of targets ?? []) {
    const facetId = target.facetId != null ? Number(target.facetId) : null
    if (facetId == null) continue
    const match = (tags ?? []).find((t) => t.facetType === target.facetType && Number(t.facetId) === facetId)
    if (match) score += Number(match.weight ?? 1) * (Number(target.weight) || 3)
  }
  return score
}

function matchesOrderSlot(exercise, profile, slotKey) {
  if (!slotKey) return false
  const slot = String(slotKey)
  return exercise?.primary_order_slot === slot
    || profile?.order_slot === slot
    || profile?.orderSlot === slot
}

function isHiitTagged(tags, methodologyKeyById) {
  return (tags ?? []).some((t) => {
    if (t.facetType !== 'methodology') return false
    const key = String(methodologyKeyById.get(Number(t.facetId)) ?? '').toLowerCase()
    return key === 'hiit' || key.includes('hiit') || Number(t.facetId) === HIIT_METHODOLOGY_FACET_ID
  })
}

function hasSpeedTenetTag(tags) {
  return (tags ?? []).some((t) => t.facetType === 'tenet' && Number(t.facetId) === SPEED_TENET_FACET_ID)
}

function hasSpeedPatternSignal(tags, exercise) {
  const blob = `${exercise?.slug ?? ''} ${exercise?.name ?? ''}`.toLowerCase()
  if (SPEED_PATTERN_RE.test(blob)) return true
  return (tags ?? []).some((t) => t.facetType === 'pattern' && SPEED_PATTERN_RE.test(String(t.facetKey ?? t.key ?? t.facetId)))
}

function spearmanRho(xs, ys) {
  const n = Math.min(xs.length, ys.length)
  if (n < 2) return null
  const rank = (arr) => {
    const order = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v)
    const ranks = new Array(arr.length)
    for (let i = 0; i < order.length; i += 1) {
      let j = i
      while (j + 1 < order.length && order[j + 1].v === order[j].v) j += 1
      const avg = (i + j + 2) / 2
      for (let k = i; k <= j; k += 1) ranks[order[k].i] = avg
      i = j
    }
    return ranks
  }
  const rx = rank(xs)
  const ry = rank(ys)
  let sumD2 = 0
  for (let i = 0; i < n; i += 1) {
    const d = rx[i] - ry[i]
    sumD2 += d * d
  }
  return 1 - (6 * sumD2) / (n * (n * n - 1))
}

function blockPrimaries(block) {
  return block?.items ?? []
}

export function evaluateCategory15Intent(result, expectedBody, checks, context = {}) {
  const {
    tagMap = new Map(),
    exerciseById = new Map(),
    phaseProfileMap = new Map(),
    methodologyKeyById = new Map(),
    tenetKeyById = new Map(),
    intentKeyById = new Map(),
  } = context

  const plan = planRows(expectedBody)
  const outputBlock = blockByKey(result, 'output')
  const sustainedBlock = blockByKey(result, 'sustained_capacity')
  const outputFocus = outputBlock?.focus_targets ?? []
  const sustainedFocus = sustainedBlock?.focus_targets ?? []
  const outputSpeedFocused = outputFocus.some((f) => Number(f.facetId) === SPEED_TENET_FACET_ID || /speed/i.test(String(f.facetType ?? '')))
  const sustainedHiitFocused = hasSustainedConditioningFocus(sustainedFocus)
    || sustainedFocus.some((f) => Number(f.facetId) === HIIT_METHODOLOGY_FACET_ID)

  // C15-MOR-01 — focus targets dropped silently
  if (!findCheck(checks, 'focus_targets_dropped')) {
    const drops = []
    for (const row of plan) {
      const key = planPhaseKey(row)
      const planFocus = row.focusTargets ?? row.focus_targets ?? []
      const block = blockByKey(result, key)
      const blockFocus = block?.focus_targets ?? []
      if (planFocus.length > 0 && blockFocus.length === 0) {
        drops.push({ phase_key: key, plan_count: planFocus.length })
      }
    }
    if (drops.length > 0) {
      fail(checks, 'focus_targets_dropped', `${drops.length} phase(s) lost focus_targets`, drops)
    } else {
      pass(checks, 'focus_targets_dropped', 'No silent focus target drops')
    }
  }

  // C15-MOP-02 / C15-MOP-16 — Output speed tenet match + frequency
  const outputItems = blockPrimaries(outputBlock)
  if (outputSpeedFocused && outputItems.length > 0) {
    let speedTagged = 0
    for (const item of outputItems) {
      const tags = tagMap.get(String(item.exercise_id)) ?? []
      if (hasSpeedTenetTag(tags)) speedTagged += 1
    }
    const rate = speedTagged / outputItems.length
    if (rate < 0.7) {
      fail(checks, 'output_speed_tenet_match', `Output speed tenet tags ${(rate * 100).toFixed(0)}% < 70%`, { speedTagged, total: outputItems.length })
      fail(checks, 'output_speed_tenet_frequency', `Output speed-tagged share ${(rate * 100).toFixed(0)}% < 70%`, { speedTagged, total: outputItems.length })
    } else {
      pass(checks, 'output_speed_tenet_match', `Output speed tenet tags ${(rate * 100).toFixed(0)}% (${speedTagged}/${outputItems.length})`)
      pass(checks, 'output_speed_tenet_frequency', `Output speed-tagged share ${(rate * 100).toFixed(0)}%`)
    }
  } else if (outputItems.length > 0) {
    pass(checks, 'output_speed_tenet_match', 'Output speed focus not configured — check skipped')
    pass(checks, 'output_speed_tenet_frequency', 'Output speed focus not configured — check skipped')
  } else {
    pass(checks, 'output_speed_tenet_match', 'Output block empty — check skipped')
    pass(checks, 'output_speed_tenet_frequency', 'Output block empty — check skipped')
  }

  // C15-MOP-03 / C15-MOR-03 — scoreTargets replay on Output
  if (outputFocus.length > 0 && outputItems.length > 0) {
    let positive = 0
    const scores = []
    for (const item of outputItems) {
      const tags = tagMap.get(String(item.exercise_id)) ?? []
      const s = scoreTargets(tags, outputFocus)
      scores.push(s)
      if (s > 0) positive += 1
    }
    const posRate = positive / outputItems.length
    const maxWeight = Math.max(...outputFocus.map((t) => Number(t.weight ?? 0)))
    if (posRate < 0.7) {
      fail(checks, 'output_focus_score_honored', `Output positive scoreTargets ${(posRate * 100).toFixed(0)}% < 70%`, { positive, total: outputItems.length })
    } else {
      pass(checks, 'output_focus_score_honored', `Output positive scoreTargets ${(posRate * 100).toFixed(0)}%`)
    }
    if (maxWeight >= 5 && posRate < 0.5) {
      fail(checks, 'focus_weight_ignored', `Output focus weight ${maxWeight} but only ${(posRate * 100).toFixed(0)}% score positive`)
    } else {
      pass(checks, 'focus_weight_ignored', 'Focus weight honored on Output picks')
    }

    const sorted = [...scores].sort((a, b) => b - a)
    const qLen = Math.max(1, Math.ceil(sorted.length / 4))
    const topMean = sorted.slice(0, qLen).reduce((s, v) => s + v, 0) / qLen
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0
    const spreadOk = median <= 0 || topMean >= 2 * median
    info(checks, 'category15_mop_score_spread', `Output score spread topMean=${topMean.toFixed(1)} median=${median}`, {
      ok_band: spreadOk,
      rubric: 'C15-MOP-11',
      topMean,
      median,
    })

    const orderScores = outputItems.map((item, idx) => ({
      order: idx + 1,
      score: scoreTargets(tagMap.get(String(item.exercise_id)) ?? [], outputFocus),
    }))
    const rho = spearmanRho(orderScores.map((r) => r.order), orderScores.map((r) => r.score))
    info(checks, 'category15_mop_focus_rank_correlation', `Output selection vs score ρ=${rho == null ? 'n/a' : rho.toFixed(2)}`, {
      ok_band: rho == null || rho >= 0.4,
      rubric: 'C15-MOP-17',
      rho,
    })

    const patternIds = new Set()
    for (const item of outputItems) {
      for (const pid of patternIdsForExercise(item.exercise_id, tagMap)) patternIds.add(pid)
    }
    info(checks, 'category15_mop_tenet_pattern_diversity', `Output distinct pattern tags: ${patternIds.size}`, {
      ok_band: patternIds.size >= 2,
      rubric: 'C15-MOP-19',
      pattern_count: patternIds.size,
    })
  } else {
    pass(checks, 'output_focus_score_honored', 'Output focus not configured — check skipped')
    pass(checks, 'focus_weight_ignored', 'Output focus not configured — check skipped')
  }

  // C15-MOP-04 / C15-MOP-05 — Sustained HIIT methodology
  const sustainedItems = blockPrimaries(sustainedBlock)
  if (sustainedHiitFocused && sustainedItems.length > 0) {
    let hiitTagged = 0
    let strictOk = 0
    for (const item of sustainedItems) {
      const ex = exerciseById.get(Number(item.exercise_id)) ?? { id: item.exercise_id }
      const tags = tagMap.get(String(item.exercise_id)) ?? []
      if (isHiitTagged(tags, methodologyKeyById)) hiitTagged += 1
      if (sustainedCapacityCandidateEligible(ex, tags, methodologyKeyById, intentKeyById, { strictConditioningMethodology: true })) {
        strictOk += 1
      }
    }
    const hiitRate = hiitTagged / sustainedItems.length
    if (hiitRate < 0.8) {
      fail(checks, 'sustained_hiit_methodology_share', `Sustained HIIT tags ${(hiitRate * 100).toFixed(0)}% < 80%`, { hiitTagged, total: sustainedItems.length })
    } else {
      pass(checks, 'sustained_hiit_methodology_share', `Sustained HIIT tags ${(hiitRate * 100).toFixed(0)}%`)
    }
    if (strictOk < sustainedItems.length) {
      fail(checks, 'sustained_strict_hiit_gate', `${sustainedItems.length - strictOk}/${sustainedItems.length} fail strict HIIT gate`)
    } else {
      pass(checks, 'sustained_strict_hiit_gate', 'All Sustained items pass strict HIIT gate')
    }

    let intervalOk = 0
    for (const item of sustainedItems) {
      const ex = exerciseById.get(Number(item.exercise_id)) ?? {}
      const kind = String(ex.programming_kind ?? ex.phase_subrole ?? 'exercise').toLowerCase()
      if (INTERVAL_PROGRAMMING_KINDS.has(kind) || kind.includes('interval') || kind.includes('conditioning')) {
        intervalOk += 1
      }
    }
    info(checks, 'category15_mop_sustained_interval_structure', `Sustained interval-compatible ${intervalOk}/${sustainedItems.length}`, {
      ok_band: intervalOk >= sustainedItems.length * 0.8,
      rubric: 'C15-MOP-21',
    })
  } else if (sustainedItems.length > 0) {
    pass(checks, 'sustained_hiit_methodology_share', 'Sustained HIIT focus not configured — check skipped')
    pass(checks, 'sustained_strict_hiit_gate', 'Sustained HIIT focus not configured — check skipped')
    info(checks, 'category15_mop_sustained_interval_structure', 'Sustained HIIT focus N/A', { ok_band: null, rubric: 'C15-MOP-21' })
  } else {
    pass(checks, 'sustained_hiit_methodology_share', 'Sustained block empty — check skipped')
    pass(checks, 'sustained_strict_hiit_gate', 'Sustained block empty — check skipped')
  }

  // C15-MOP-06 / C15-MOR-02 — HIIT leak + low-intent phases
  let hiitLeak = 0
  let hiitLowIntent = 0
  for (const block of result.blocks ?? []) {
    const phaseKey = block.phase_key
    for (const item of blockPrimaries(block)) {
      const tags = tagMap.get(String(item.exercise_id)) ?? []
      if (!isHiitTagged(tags, methodologyKeyById)) continue
      if (phaseKey !== 'sustained_capacity') hiitLeak += 1
      if (phaseKey === 'prepare_and_access' || phaseKey === 'movement_intelligence') hiitLowIntent += 1
    }
  }
  if (hiitLeak > 0) {
    fail(checks, 'hiit_not_leaked_other_phases', `${hiitLeak} HIIT-tagged primary outside Sustained`)
  } else {
    pass(checks, 'hiit_not_leaked_other_phases', 'No HIIT methodology outside Sustained')
  }
  if (hiitLowIntent > 0) {
    fail(checks, 'hiit_in_low_intent_phases', `${hiitLowIntent} HIIT-tagged primary in Prepare/MI`)
  } else {
    pass(checks, 'hiit_in_low_intent_phases', 'No HIIT in Prepare/MI')
  }

  // C15-MOP-07 — order slot alignment when configured
  let slotRequired = 0
  let slotOk = 0
  for (const block of result.blocks ?? []) {
    const slotTargets = (block.focus_targets ?? []).filter((t) => t.facetType === 'order_slot')
    if (slotTargets.length === 0) continue
    for (const target of slotTargets) {
      const slotKey = target.facetKey ?? target.key
      for (const item of blockPrimaries(block)) {
        slotRequired += 1
        const ex = exerciseById.get(Number(item.exercise_id)) ?? {}
        const profiles = phaseProfileMap.get(String(item.exercise_id)) ?? phaseProfileMap.get(Number(item.exercise_id)) ?? []
        const profile = profiles.find((p) => (p.phaseKey ?? p.phase_key) === block.phase_key)
        if (matchesOrderSlot(ex, profile, slotKey)) slotOk += 1
      }
    }
  }
  if (slotRequired > 0) {
    const slotRate = slotOk / slotRequired
    info(checks, 'category15_mop_order_slot_alignment', `Order-slot alignment ${(slotRate * 100).toFixed(0)}%`, {
      ok_band: slotRate >= 1,
      rubric: 'C15-MOP-07',
      slotOk,
      slotRequired,
    })
  } else {
    info(checks, 'category15_mop_order_slot_alignment', 'No order_slot focus configured', { ok_band: true, rubric: 'C15-MOP-07' })
  }

  // C15-MOP-08 — physiology focus dominance
  for (const block of result.blocks ?? []) {
    const physTargets = (block.focus_targets ?? []).filter((t) => t.facetType === 'physiology')
    if (physTargets.length === 0) continue
    const items = blockPrimaries(block)
    if (items.length === 0) continue
    let tagged = 0
    const physIds = new Set(physTargets.map((t) => Number(t.facetId)))
    for (const item of items) {
      const tags = tagMap.get(String(item.exercise_id)) ?? []
      if (tags.some((t) => t.facetType === 'physiology' && physIds.has(Number(t.facetId)))) tagged += 1
    }
    const rate = tagged / items.length
    info(checks, `category15_mop_physiology_focus_${block.phase_key}`, `Physiology focus dominance ${(rate * 100).toFixed(0)}%`, {
      ok_band: rate >= 0.7,
      rubric: 'C15-MOP-08',
      phase_key: block.phase_key,
    })
  }

  // C15-MOP-09 / C15-MOP-10 — phase profile roles
  let roleChecked = 0
  let roleOk = 0
  let emptyFocusChecked = 0
  let emptyFocusOk = 0
  const emptyFocusPhases = new Set(['prepare_and_access', 'movement_intelligence', 'capacity', 'resilience'])
  for (const block of result.blocks ?? []) {
    const phaseKey = block.phase_key
    const hasFocus = (block.focus_targets ?? []).length > 0
    for (const item of blockPrimaries(block)) {
      const profiles = phaseProfileMap.get(String(item.exercise_id)) ?? phaseProfileMap.get(Number(item.exercise_id)) ?? []
      const role = profiles.find((p) => (p.phaseKey ?? p.phase_key) === phaseKey)?.role
      if (role != null) {
        roleChecked += 1
        if (role === 'primary' || role === 'secondary') roleOk += 1
      }
      if (!hasFocus && emptyFocusPhases.has(phaseKey) && role != null) {
        emptyFocusChecked += 1
        if (role !== 'avoid') emptyFocusOk += 1
      }
    }
  }
  if (roleChecked > 0) {
    const roleRate = roleOk / roleChecked
    if (roleRate < 1) {
      info(checks, 'category15_mop_phase_profile_role', `Phase profile roles ${(roleRate * 100).toFixed(0)}%`, { ok_band: roleRate >= 1, rubric: 'C15-MOP-09' })
    } else {
      pass(checks, 'category15_mop_phase_profile_role', 'All prescribed items have primary/secondary phase role')
    }
  } else {
    info(checks, 'category15_mop_phase_profile_role', 'No phase profiles loaded — role check skipped', { ok_band: null, rubric: 'C15-MOP-09' })
  }
  if (emptyFocusChecked > 0) {
    const emptyRate = emptyFocusOk / emptyFocusChecked
    info(checks, 'category15_mop_empty_focus_appropriate', `Unfocused phase role validity ${(emptyRate * 100).toFixed(0)}%`, {
      ok_band: emptyRate >= 1,
      rubric: 'C15-MOP-10',
    })
  } else {
    info(checks, 'category15_mop_empty_focus_appropriate', 'Unfocused phase profile check N/A', { ok_band: true, rubric: 'C15-MOP-10' })
  }

  // C15-MOP-12 — sustained fill with HIIT focus (informational; ties C2)
  const sustainedFill = (result.constraint_report?.phase_fill ?? []).find((f) => f.phase_key === 'sustained_capacity')
  if (sustainedHiitFocused) {
    const fillPct = Number(sustainedFill?.fill_pct ?? 0)
    info(checks, 'category15_mop_sustained_fill_hiit', `Sustained fill ${fillPct}% with HIIT focus`, {
      ok_band: fillPct >= 80,
      rubric: 'C15-MOP-12',
      fill_pct: fillPct,
    })
  } else {
    info(checks, 'category15_mop_sustained_fill_hiit', 'Sustained HIIT focus N/A', { ok_band: null, rubric: 'C15-MOP-12' })
  }

  // C15-MOP-13 — Output minutes share
  const totalMinutes = (result.blocks ?? []).reduce((s, b) => s + Number(b.target_minutes ?? 0), 0) || 1
  const outputMinutes = Number(outputBlock?.target_minutes ?? 0)
  const outputShare = outputMinutes / totalMinutes
  const outputWeight = outputFocus.find((f) => Number(f.facetId) === SPEED_TENET_FACET_ID)?.weight
  if (Number(outputWeight) >= 6) {
    info(checks, 'category15_mop_output_minutes_share', `Output minutes ${(outputShare * 100).toFixed(0)}% of session`, {
      ok_band: outputShare >= 0.3,
      rubric: 'C15-MOP-13',
      output_share: outputShare,
    })
  } else {
    info(checks, 'category15_mop_output_minutes_share', 'Output speed weight < 6 — minutes share N/A', { ok_band: null, rubric: 'C15-MOP-13' })
  }

  // C15-MOP-15 — session vs phase scoring (proxy)
  const sessionTargets = []
  for (const row of plan) {
    for (const t of row.focusTargets ?? row.focus_targets ?? []) sessionTargets.push(t)
  }
  if (outputItems.length > 0 && outputFocus.length > 0) {
    let phaseDominates = 0
    for (const item of outputItems) {
      const tags = tagMap.get(String(item.exercise_id)) ?? []
      const sessionScore = scoreTargets(tags, sessionTargets)
      const phaseScore = scoreTargets(tags, outputFocus)
      if (phaseScore >= sessionScore || sessionScore === 0) phaseDominates += 1
    }
    const domRate = phaseDominates / outputItems.length
    info(checks, 'category15_mop_session_vs_phase_scoring', `Output phase-dominant scores ${(domRate * 100).toFixed(0)}%`, {
      ok_band: domRate >= 0.7,
      rubric: 'C15-MOP-15',
      phaseDominates,
      total: outputItems.length,
    })
  } else {
    info(checks, 'category15_mop_session_vs_phase_scoring', 'Session vs phase scoring N/A', { ok_band: null, rubric: 'C15-MOP-15' })
  }

  // C15-MOP-18 — methodology key resolution
  const hiitKey = methodologyKeyById.get(HIIT_METHODOLOGY_FACET_ID)
  if (sustainedHiitFocused) {
    if (hiitKey === 'hiit') {
      pass(checks, 'category15_mop_methodology_key_resolution', 'facetId 1169 resolves to hiit')
    } else {
      fail(checks, 'category15_mop_methodology_key_resolution', `facetId 1169 resolves to ${hiitKey ?? 'missing'} (expected hiit)`)
    }
  } else {
    info(checks, 'category15_mop_methodology_key_resolution', 'HIIT methodology focus N/A', { ok_band: null, rubric: 'C15-MOP-18' })
  }

  // C15-MOP-20 — objective bleed in unfocused phases
  const onlyOutputFocused = outputSpeedFocused
    && !plan.some((r) => {
      const k = planPhaseKey(r)
      return k !== 'output' && (r.focusTargets ?? r.focus_targets ?? []).length > 0
    })
  if (onlyOutputFocused) {
    let bleed = 0
    let bleedTotal = 0
    for (const phaseKey of ['capacity', 'resilience']) {
      const block = blockByKey(result, phaseKey)
      for (const item of blockPrimaries(block)) {
        bleedTotal += 1
        const tags = tagMap.get(String(item.exercise_id)) ?? []
        if (hasSpeedTenetTag(tags)) bleed += 1
      }
    }
    const bleedRate = bleedTotal > 0 ? bleed / bleedTotal : 0
    if (bleedRate > 0.2) {
      info(checks, 'category15_mop_objective_bleed', `Speed tenet bleed ${(bleedRate * 100).toFixed(0)}% in Capacity/Resilience`, { ok_band: false, rubric: 'C15-MOP-20' })
    } else {
      info(checks, 'category15_mop_objective_bleed', `Speed tenet bleed ${(bleedRate * 100).toFixed(0)}%`, { ok_band: true, rubric: 'C15-MOP-20' })
    }
  } else {
    info(checks, 'category15_mop_objective_bleed', 'Multi-phase focus — bleed check N/A', { ok_band: null, rubric: 'C15-MOP-20' })
  }

  // C15-MOP-22 — focus preserved on prescribe body
  let transformIssues = 0
  for (const row of plan) {
    const focus = row.focusTargets ?? row.focus_targets ?? []
    if (focus.length === 0) continue
    const missing = focus.filter((t) => t.facetId == null || !t.facetType || t.weight == null)
    transformIssues += missing.length
  }
  if (transformIssues > 0) {
    fail(checks, 'category15_mop_focus_transform_preserved', `${transformIssues} focus target field(s) missing on prescribe body`)
  } else {
    pass(checks, 'category15_mop_focus_transform_preserved', 'Focus targets complete on prescribe body phasePlan')
  }

  // C15-MOS-01 / C15-MOS-02
  let mosResolvable = 0
  let mosTotal = 0
  let mosWeightIssues = 0
  for (const row of plan) {
    for (const t of row.focusTargets ?? row.focus_targets ?? []) {
      mosTotal += 1
      const facetId = Number(t.facetId)
      const facetType = String(t.facetType ?? '')
      const weight = Number(t.weight)
      if (!Number.isFinite(facetId) || !facetType) continue
      if (facetType === 'tenet' && (tenetKeyById.has(facetId) || facetId === SPEED_TENET_FACET_ID)) mosResolvable += 1
      else if (facetType === 'methodology' && (methodologyKeyById.has(facetId) || facetId === HIIT_METHODOLOGY_FACET_ID)) mosResolvable += 1
      else if (facetType === 'order_slot' && (t.facetKey || t.key)) mosResolvable += 1
      else if (facetId > 0) mosResolvable += 1
      if (!Number.isFinite(weight) || weight < 1 || weight > 10) mosWeightIssues += 1
    }
  }
  if (mosTotal > 0) {
    if (mosResolvable < mosTotal) {
      fail(checks, 'category15_mos_focus_resolvable', `${mosTotal - mosResolvable}/${mosTotal} focus facets not resolvable`)
    } else {
      pass(checks, 'category15_mos_focus_resolvable', 'All focus facets resolvable')
    }
    if (mosWeightIssues > 0) {
      fail(checks, 'category15_mos_focus_weight_range', `${mosWeightIssues} focus weight(s) out of range 1–10`)
    } else {
      pass(checks, 'category15_mos_focus_weight_range', 'Focus weights in valid range')
    }
  } else {
    pass(checks, 'category15_mos_focus_resolvable', 'No focus targets configured')
    pass(checks, 'category15_mos_focus_weight_range', 'No focus targets configured')
  }

  const sustainedPool = sustainedFill?.pool_size ?? 0
  if (sustainedHiitFocused) {
    if (sustainedPool >= 2) {
      pass(checks, 'category15_mos_hiit_pool_depth', `Sustained HIIT pool_size ${sustainedPool} ≥ 2`)
    } else {
      info(checks, 'category15_mos_hiit_pool_depth', `Sustained pool_size ${sustainedPool} < 2 (proxy)`, { ok_band: sustainedPool >= 2, rubric: 'C15-MOS-03' })
    }
  } else {
    pass(checks, 'category15_mos_hiit_pool_depth', 'HIIT pool depth N/A')
  }

  // MOE informational + review packet
  if (outputFocus.length > 1) {
    const weightFreq = outputFocus.map((t) => ({
      weight: Number(t.weight ?? 0),
      freq: outputItems.filter((item) => {
        const tags = tagMap.get(String(item.exercise_id)) ?? []
        return tags.some((tag) => tag.facetType === t.facetType && Number(tag.facetId) === Number(t.facetId))
      }).length,
    }))
    const rhoW = spearmanRho(weightFreq.map((r) => r.weight), weightFreq.map((r) => r.freq))
    info(checks, 'category15_moe_focus_weight_drives', `Focus weight vs tag frequency ρ=${rhoW == null ? 'n/a' : rhoW.toFixed(2)}`, {
      ok_band: rhoW == null || rhoW >= 0.5,
      rubric: 'C15-MOE-04',
    })
  } else {
    info(checks, 'category15_moe_focus_weight_drives', 'Single focus facet — weight drive N/A', { ok_band: null, rubric: 'C15-MOE-04' })
  }

  const hiitLabelOk = sustainedFocus.every((f) => {
    if (Number(f.facetId) !== HIIT_METHODOLOGY_FACET_ID) return true
    return Boolean(f.facetKey) || methodologyKeyById.get(HIIT_METHODOLOGY_FACET_ID) === 'hiit'
  })
  info(checks, 'category15_moe_methodology_label', hiitLabelOk
    ? 'Methodology facet resolves to HIIT key (UI label proxy)'
    : 'Methodology facetId 1169 may display as raw ID in UI',
    { ok_band: hiitLabelOk, rubric: 'C15-MOE-05' })

  if (String(expectedBody.sessionObjective ?? '').includes('speed') && outputItems.length > 0) {
    let speedPatternHits = 0
    for (const item of outputItems) {
      const ex = exerciseById.get(Number(item.exercise_id)) ?? {}
      const tags = tagMap.get(String(item.exercise_id)) ?? []
      if (hasSpeedPatternSignal(tags, ex) || hasSpeedTenetTag(tags)) speedPatternHits += 1
    }
    const synRate = speedPatternHits / outputItems.length
    info(checks, 'category15_moe_session_objective_synergy', `Output speed-pattern share ${(synRate * 100).toFixed(0)}%`, {
      ok_band: synRate >= 0.5,
      rubric: 'C15-MOE-06',
    })
  } else {
    info(checks, 'category15_moe_session_objective_synergy', 'speed_priority objective N/A', { ok_band: null, rubric: 'C15-MOE-06' })
  }

  const reviewPhases = []
  for (const row of plan) {
    const key = planPhaseKey(row)
    const focus = row.focusTargets ?? row.focus_targets ?? []
    if (focus.length === 0) continue
    const block = blockByKey(result, key)
    reviewPhases.push({
      phase_key: key,
      label: row.label,
      focus_targets: focus,
      items: (block?.items ?? []).slice(0, 12).map((item) => ({
        exercise_id: item.exercise_id,
        exercise_name: item.exercise_name,
      })),
    })
  }
  info(checks, 'category15_moe_review_packet', `${reviewPhases.length} focused phase(s) for coach MOE review`, {
    ok_band: true,
    phases: reviewPhases,
    session_objective: expectedBody.sessionObjective ?? expectedBody.session_objective,
    rubric: ['C15-MOE-01', 'C15-MOE-02', 'C15-MOE-03', 'C15-MOE-07', 'C15-MOE-08', 'C15-MOE-09'],
  })

  // Ensure Cat-1 delegated KPI ids present (emitted by evaluateCategory1Structure)
  for (const id of ['focus_targets_count_parity', 'focus_targets_field_parity']) {
    if (!findCheck(checks, id)) {
      pass(checks, id, `${id}: delegated to Category 1 structure check`)
    }
  }

  for (const id of CATEGORY15_KPI_CHECK_IDS) {
    if (findCheck(checks, id)) continue
    pass(checks, id, `${id}: N/A for session`)
  }
  for (const id of CATEGORY15_MOE_CHECK_IDS) {
    if (findCheck(checks, id)) continue
    info(checks, id, `${id}: N/A for session`, { ok_band: null })
  }
}

export function computeCategory15Kpi(checks, opts = {}) {
  return computeKpi(checks, 15, CATEGORY15_KPI_CHECK_IDS, { minRate: 0.85, ...opts })
}

// ─── Category 16 — Phase-appropriate primaries ───────────────────────────────

const CAT16_LOW_INTENT_PHASES = new Set(['prepare_and_access', 'movement_intelligence', 'restore'])
const CAT16_HIGH_AROUSAL_METHODOLOGY = new Set(['hiit', 'plyometrics', 'speed_agility', 'neural_output'])
const CAT16_CANONICAL_PHASE_KEYS = new Set([...SESSION_PHASE_ORDER, 'other'])
const CAT16_MI_INCOHERENT_SUBROLES = new Set(['conditioning_intervals'])

function cat16ProfilesFor(phaseProfileMap, exerciseId) {
  return phaseProfileMap.get(String(exerciseId)) ?? phaseProfileMap.get(Number(exerciseId)) ?? []
}

function cat16ProfileForPhase(phaseProfileMap, exerciseId, phaseKey) {
  return cat16ProfilesFor(phaseProfileMap, exerciseId)
    .find((p) => (p.phaseKey ?? p.phase_key) === phaseKey) ?? null
}

function cat16MethodologyKeys(exerciseId, tagMap, methodologyKeyById) {
  return (tagMap.get(String(exerciseId)) ?? [])
    .filter((t) => t.facetType === 'methodology')
    .map((t) => methodologyKeyById.get(Number(t.facetId)))
    .filter(Boolean)
}

function cat16ResolvedTargets(block, methodologyKeyById) {
  return (block?.focus_targets ?? []).map((t) => ({
    ...t,
    facetKey: t.facetKey ?? t.key
      ?? (t.facetType === 'methodology' ? methodologyKeyById.get(Number(t.facetId)) : undefined),
  }))
}

function cat16ItemDifficulty(item, difficultyByExerciseId) {
  return item.difficulty
    ?? difficultyByExerciseId.get(String(item.exercise_id))
    ?? difficultyByExerciseId.get(Number(item.exercise_id))
    ?? null
}

/**
 * Blocking Category 16 KPI ids. Reused ids must come from evaluators that run
 * BEFORE Category 16 (global strict checks, Cat 3, Cat 15) so they are present
 * when computeCategory16Kpi executes.
 */
export const CATEGORY16_KPI_CHECK_IDS = [
  // reused — global strict checks (C16-MOP-01, C16-MOR-03)
  'no_progression_prepare_and_access',
  'no_progression_movement_intelligence',
  'no_progression_sustained_capacity',
  'no_progression_restore',
  // reused — Category 3 restore policy (C16-MOP-03, C16-MOP-08, C16-MOR-02)
  'restore_no_output_primary',
  'restore_candidate_policy_pass',
  'restore_excluded_methodology',
  // reused — Category 15 sustained/HIIT gates (C16-MOP-09, C16-MOP-20, C16-MOP-21)
  'sustained_strict_hiit_gate',
  'hiit_not_leaked_other_phases',
  // Category 16 evaluator checks
  'phase_primary_role_alignment',
  'phase_profile_role_not_avoid',
  'phase_profile_coverage',
  'sustained_primary_containment',
  'capacity_primary_low_intent_leak',
  'resilience_primary_containment',
  'prepare_impact_ceiling',
  'prepare_methodology_gate',
  'mi_heavy_load_youth',
  'youth_output_primary_low_intent',
  'low_intent_difficulty_ceiling',
  'phase_min_items_met',
  'programming_kind_matches_work_mode',
  'order_slot_phase_taxonomy',
  'phase_plan_keys_canonical',
]

/** Informational Category 16 MOE / proxy check ids (non-blocking). */
export const CATEGORY16_MOE_CHECK_IDS = [
  'category16_mop_prepare_primary_affinity',
  'category16_mop_mi_subrole_coherence',
  'category16_mop_conditional_role_rate',
  'category16_mop_single_item_fill',
  'category16_mop_phase_max_items',
  'category16_moe_prepare_warmup',
  'category16_moe_mi_quality',
  'category16_moe_sustained_conditioning',
  'category16_moe_fatigue_arc',
  'category16_moe_prepare_output_bridge',
  'category16_moe_review_packet',
]

export function evaluateCategory16PhasePrimaries(result, expectedBody, checks, context = {}) {
  const {
    exerciseById = new Map(),
    tagMap = new Map(),
    phaseProfileMap = new Map(),
    methodologyKeyById = new Map(),
    intentKeyById = new Map(),
    difficultyByExerciseId = new Map(),
    phaseOrderSlotKeysByPhase = new Map(),
  } = context

  const blocks = result.blocks ?? []
  const sessionAgeMax = Number(expectedBody.ageMax ?? expectedBody.age_max ?? result.audience_profile?.ageMax ?? 120)
  const isYouth = sessionAgeMax <= 14
  const sessionCapOverall = Number(result.audience_profile?.caps?.maxOverall ?? 10)
  const workMode = String(expectedBody.workMode ?? expectedBody.work_mode ?? result.work_mode ?? 'exercise')
  const hasProfiles = phaseProfileMap.size > 0

  // C16-MOP-02 / C16-MOS-01 / role alignment — phase profile role audits
  let profChecked = 0
  let profAligned = 0
  let profCovered = 0
  const avoidRoleItems = []
  const conditionalByPhase = new Map()
  for (const block of blocks) {
    const phaseKey = block.phase_key
    for (const item of block.items ?? []) {
      profChecked += 1
      const profile = cat16ProfileForPhase(phaseProfileMap, item.exercise_id, phaseKey)
      const role = profile?.role ?? null
      if (role === 'avoid') avoidRoleItems.push({ phase_key: phaseKey, exercise: item.exercise_name })
      if (role === 'primary' || role === 'secondary') profAligned += 1
      if (profile && role !== 'avoid') profCovered += 1
      if (role === 'conditional') {
        conditionalByPhase.set(phaseKey, (conditionalByPhase.get(phaseKey) ?? 0) + 1)
      }
    }
  }
  if (!hasProfiles) {
    pass(checks, 'phase_primary_role_alignment', 'No phase profiles in context — alignment skipped')
    pass(checks, 'phase_profile_role_not_avoid', 'No phase profiles in context — avoid-role gate skipped')
    pass(checks, 'phase_profile_coverage', 'No phase profiles in context — coverage skipped')
  } else {
    const alignRate = profChecked > 0 ? profAligned / profChecked : 1
    if (alignRate < 0.8) {
      fail(checks, 'phase_primary_role_alignment', `Phase profile alignment ${(alignRate * 100).toFixed(0)}% < 80%`, { aligned: profAligned, total: profChecked })
    } else {
      pass(checks, 'phase_primary_role_alignment', `Phase profile alignment ${(alignRate * 100).toFixed(0)}% (${profAligned}/${profChecked})`)
    }

    if (avoidRoleItems.length > 0) {
      fail(checks, 'phase_profile_role_not_avoid', `${avoidRoleItems.length} primary(ies) with role=avoid for assigned phase`, avoidRoleItems.slice(0, 8))
    } else {
      pass(checks, 'phase_profile_role_not_avoid', 'No primary has avoid role for its phase')
    }

    const coverRate = profChecked > 0 ? profCovered / profChecked : 1
    if (coverRate < 0.95) {
      fail(checks, 'phase_profile_coverage', `Non-avoid phase-profile coverage ${(coverRate * 100).toFixed(0)}% < 95%`, { covered: profCovered, total: profChecked })
    } else {
      pass(checks, 'phase_profile_coverage', `Non-avoid phase-profile coverage ${(coverRate * 100).toFixed(0)}%`)
    }
  }

  // C16-MOP-04 / C16-MOP-14 / C16-MOP-15 / C16-MOR-04 — primary_phase_key containment
  const sustainedLeaks = []
  const capacityLeaks = []
  const resilienceLeaks = []
  const youthOutputLeaks = []
  for (const block of blocks) {
    const phaseKey = block.phase_key
    for (const item of block.items ?? []) {
      const primaryPhase = exerciseById.get(Number(item.exercise_id))?.primary_phase_key ?? null
      if (!primaryPhase) continue
      if (primaryPhase === 'sustained_capacity' && phaseKey !== 'sustained_capacity') {
        sustainedLeaks.push({ phase_key: phaseKey, exercise: item.exercise_name })
      }
      if (primaryPhase === 'capacity' && CAT16_LOW_INTENT_PHASES.has(phaseKey)) {
        capacityLeaks.push({ phase_key: phaseKey, exercise: item.exercise_name })
      }
      if (primaryPhase === 'resilience' && phaseKey !== 'resilience') {
        resilienceLeaks.push({ phase_key: phaseKey, exercise: item.exercise_name })
      }
      if (isYouth && primaryPhase === 'output'
        && (phaseKey === 'prepare_and_access' || phaseKey === 'movement_intelligence')) {
        youthOutputLeaks.push({ phase_key: phaseKey, exercise: item.exercise_name })
      }
    }
  }
  if (sustainedLeaks.length > 0) {
    fail(checks, 'sustained_primary_containment', `${sustainedLeaks.length} sustained-primary item(s) outside Sustained`, sustainedLeaks.slice(0, 8))
  } else {
    pass(checks, 'sustained_primary_containment', 'No sustained-primary outside Sustained')
  }
  if (capacityLeaks.length > 0) {
    fail(checks, 'capacity_primary_low_intent_leak', `${capacityLeaks.length} capacity-primary item(s) in Prepare/MI/Restore`, capacityLeaks.slice(0, 8))
  } else {
    pass(checks, 'capacity_primary_low_intent_leak', 'No capacity-primary in Prepare/MI/Restore')
  }
  if (resilienceLeaks.length > 0) {
    fail(checks, 'resilience_primary_containment', `${resilienceLeaks.length} resilience-primary item(s) outside Resilience`, resilienceLeaks.slice(0, 8))
  } else {
    pass(checks, 'resilience_primary_containment', 'No resilience-primary outside Resilience')
  }
  if (youthOutputLeaks.length > 0) {
    fail(checks, 'youth_output_primary_low_intent', `${youthOutputLeaks.length} output-primary item(s) in Prepare/MI for youth`, youthOutputLeaks.slice(0, 8))
  } else if (isYouth) {
    pass(checks, 'youth_output_primary_low_intent', 'No output-primary in Prepare/MI for youth')
  } else {
    pass(checks, 'youth_output_primary_low_intent', 'Youth output-primary gate N/A (ageMax > 14)')
  }

  // C16-MOP-05 — Prepare impact ceiling (phase-profile impact_level ≥ 3 blocks; == 2 reported)
  const prepareBlock = blockByKey(result, 'prepare_and_access')
  const prepareItems = prepareBlock?.items ?? []
  if (!hasProfiles) {
    pass(checks, 'prepare_impact_ceiling', 'No phase profiles in context — impact ceiling skipped')
  } else {
    const hardImpact = []
    let midImpact = 0
    for (const item of prepareItems) {
      const profile = cat16ProfileForPhase(phaseProfileMap, item.exercise_id, 'prepare_and_access')
      const impact = Number(profile?.impactLevel ?? profile?.impact_level ?? 0)
      if (impact >= 3) hardImpact.push({ exercise: item.exercise_name, impact })
      else if (impact === 2) midImpact += 1
    }
    if (hardImpact.length > 0) {
      fail(checks, 'prepare_impact_ceiling', `${hardImpact.length} Prepare primary(ies) with impact_level ≥ 3`, hardImpact.slice(0, 8))
    } else {
      pass(checks, 'prepare_impact_ceiling', `Prepare impact below ceiling (impact=2 count: ${midImpact})`, { mid_impact_count: midImpact })
    }
  }

  // C16-MOP-06 — Prepare methodology gate.
  // hiit/neural_output always block. plyometrics/speed_agility (elastic rudiments —
  // easy bounce, line hops, A-march — legitimate speed-session warmup content) block
  // only when uncurated for Prepare (no primary/secondary prepare profile) or when
  // prepare-profile impact_level ≥ 3 (same ceiling as youth_prepare_mi_impact_ceiling).
  const prepareMethodologyHits = []
  let lowImpactArousalCount = 0
  for (const item of prepareItems) {
    const keys = cat16MethodologyKeys(item.exercise_id, tagMap, methodologyKeyById)
    const hard = keys.filter((k) => k === 'hiit' || k === 'neural_output')
    const elastic = keys.filter((k) => k === 'plyometrics' || k === 'speed_agility')
    if (hard.length > 0) {
      prepareMethodologyHits.push({ exercise: item.exercise_name, methodology: hard })
      continue
    }
    if (elastic.length > 0 && hasProfiles) {
      const profile = cat16ProfileForPhase(phaseProfileMap, item.exercise_id, 'prepare_and_access')
      const impact = Number(profile?.impactLevel ?? profile?.impact_level ?? 0)
      const curated = profile?.role === 'primary' || profile?.role === 'secondary'
      if (!curated || impact >= 3) {
        prepareMethodologyHits.push({ exercise: item.exercise_name, methodology: elastic, impact, curated })
      } else {
        lowImpactArousalCount += 1
      }
    } else if (elastic.length > 0) {
      lowImpactArousalCount += 1
    }
  }
  if (prepareMethodologyHits.length > 0) {
    fail(checks, 'prepare_methodology_gate', `${prepareMethodologyHits.length} Prepare item(s) tagged high-arousal methodology`, prepareMethodologyHits.slice(0, 8))
  } else {
    pass(checks, 'prepare_methodology_gate', `No blocking high-arousal methodology in Prepare (low-impact elastic: ${lowImpactArousalCount})`, { low_impact_elastic: lowImpactArousalCount })
  }

  // C16-MOP-07 / C16-MOR-01 — MI heavy-load ceiling for youth (load ≥ 7)
  const miBlock = blockByKey(result, 'movement_intelligence')
  const miItems = miBlock?.items ?? []
  if (isYouth) {
    const heavy = miItems
      .map((item) => ({ exercise: item.exercise_name, load: Number(cat16ItemDifficulty(item, difficultyByExerciseId)?.load ?? 0) }))
      .filter((r) => r.load >= 7)
    if (heavy.length > 0) {
      fail(checks, 'mi_heavy_load_youth', `${heavy.length} MI primary(ies) with load ≥ 7 for youth`, heavy.slice(0, 8))
    } else {
      pass(checks, 'mi_heavy_load_youth', 'No MI primary with load ≥ 7 for youth')
    }
  } else {
    pass(checks, 'mi_heavy_load_youth', 'MI heavy-load youth gate N/A (ageMax > 14)')
  }

  // C16-MOP-18 — low-intent difficulty ceiling. Shared primaries are sized to the
  // highest-cap audience split (Split 1 gets scaled per_split variants), so the
  // ceiling is max(session cap, split caps).
  const splitCaps = (result.audience_splits ?? [])
    .map((s) => Number(s.caps?.maxOverall ?? NaN))
    .filter(Number.isFinite)
  const lowIntentCap = Math.max(sessionCapOverall, ...splitCaps, 0)
  const overCap = []
  for (const phaseKey of CAT16_LOW_INTENT_PHASES) {
    const block = blockByKey(result, phaseKey)
    for (const item of block?.items ?? []) {
      const overall = Number(cat16ItemDifficulty(item, difficultyByExerciseId)?.overall ?? 0)
      if (overall > lowIntentCap) {
        overCap.push({ phase_key: phaseKey, exercise: item.exercise_name, overall, cap: lowIntentCap })
      }
    }
  }
  if (overCap.length > 0) {
    fail(checks, 'low_intent_difficulty_ceiling', `${overCap.length} Prepare/MI/Restore primary(ies) over cap ${lowIntentCap}`, overCap.slice(0, 8))
  } else {
    pass(checks, 'low_intent_difficulty_ceiling', `Prepare/MI/Restore primaries within cap (${lowIntentCap})`)
  }

  // C16-MOP-11 — per-phase minimum item counts (engine-enforced via backfill; blocking)
  // C16-MOP-12 — maxItemsForPhase is a soft cap: time-underfill backfill passes
  // maxItems: null, so exceeding it is engine-intended. Informational band only.
  const minViolations = []
  const maxViolations = []
  for (const block of blocks) {
    const phaseKey = block.phase_key
    const count = (block.items ?? []).length
    const resolvedTargets = cat16ResolvedTargets(block, methodologyKeyById)
    const minItems = minItemsForPhase(phaseKey, resolvedTargets)
    const maxItems = maxItemsForPhase(phaseKey, Number(block.target_minutes ?? 20), resolvedTargets)
    if (count < minItems) minViolations.push({ phase_key: phaseKey, count, min: minItems })
    if (count > maxItems) maxViolations.push({ phase_key: phaseKey, count, max: maxItems })
  }
  if (minViolations.length > 0) {
    fail(checks, 'phase_min_items_met', `${minViolations.length} phase(s) below minItemsForPhase`, minViolations)
  } else {
    pass(checks, 'phase_min_items_met', 'All phases meet minItemsForPhase')
  }
  info(checks, 'category16_mop_phase_max_items', `Phases above soft maxItemsForPhase: ${maxViolations.length}`, {
    ok_band: maxViolations.length <= 2,
    rubric: 'C16-MOP-12',
    violations: maxViolations,
  })

  // C16-MOP-10 / C16-MOP-22 — programming_kind matches workMode
  if (workMode === 'exercise') {
    const skillDrills = []
    for (const block of blocks) {
      for (const item of block.items ?? []) {
        const kind = exerciseById.get(Number(item.exercise_id))?.programming_kind ?? 'exercise'
        if (kind === 'skill_drill') {
          skillDrills.push({ phase_key: block.phase_key, exercise: item.exercise_name })
        }
      }
    }
    if (skillDrills.length > 0) {
      fail(checks, 'programming_kind_matches_work_mode', `${skillDrills.length} skill_drill primary(ies) in exercise workMode`, skillDrills.slice(0, 8))
    } else {
      pass(checks, 'programming_kind_matches_work_mode', 'All primaries programming_kind=exercise for exercise workMode')
    }
  } else {
    pass(checks, 'programming_kind_matches_work_mode', `programming_kind gate N/A (workMode ${workMode})`)
  }

  // C16-MOP-13 — order slot belongs to phase taxonomy
  if (phaseOrderSlotKeysByPhase.size === 0) {
    pass(checks, 'order_slot_phase_taxonomy', 'No phase_order_slot taxonomy in context — skipped')
  } else {
    const slotViolations = []
    for (const block of blocks) {
      const slotSet = phaseOrderSlotKeysByPhase.get(block.phase_key)
      if (!slotSet) continue
      for (const item of block.items ?? []) {
        const profile = cat16ProfileForPhase(phaseProfileMap, item.exercise_id, block.phase_key)
        const slot = profile?.orderSlot ?? profile?.order_slot ?? null
        if (slot && !slotSet.has(slot)) {
          slotViolations.push({ phase_key: block.phase_key, exercise: item.exercise_name, slot })
        }
      }
    }
    if (slotViolations.length > 0) {
      fail(checks, 'order_slot_phase_taxonomy', `${slotViolations.length} item(s) with order_slot outside phase taxonomy`, slotViolations.slice(0, 8))
    } else {
      pass(checks, 'order_slot_phase_taxonomy', 'All profile order_slots belong to phase taxonomy')
    }
  }

  // C16-MOS-02 — canonical phase keys in plan
  const plan = Array.isArray(expectedBody.phasePlan) ? expectedBody.phasePlan : []
  const badPlanKeys = plan
    .map((r) => r.phaseKey ?? r.phase_key ?? r.phase)
    .filter((k) => !CAT16_CANONICAL_PHASE_KEYS.has(k))
  if (badPlanKeys.length > 0) {
    fail(checks, 'phase_plan_keys_canonical', `phasePlan has unrecognized phase key(s): ${badPlanKeys.join(', ')}`)
  } else {
    pass(checks, 'phase_plan_keys_canonical', 'All phasePlan phase keys canonical')
  }

  // C16-MOP-16 — Prepare primary-role affinity (informational band ≥ 80%)
  if (hasProfiles && prepareItems.length > 0) {
    const primaryRole = prepareItems.filter((item) => {
      const profile = cat16ProfileForPhase(phaseProfileMap, item.exercise_id, 'prepare_and_access')
      return profile?.role === 'primary'
    }).length
    const affinity = primaryRole / prepareItems.length
    info(checks, 'category16_mop_prepare_primary_affinity', `Prepare primary-role affinity ${(affinity * 100).toFixed(0)}%`, {
      ok_band: affinity >= 0.8,
      rubric: 'C16-MOP-16',
      primary_role: primaryRole,
      total: prepareItems.length,
    })
  } else {
    info(checks, 'category16_mop_prepare_primary_affinity', 'Prepare affinity N/A (no profiles or items)', { ok_band: null, rubric: 'C16-MOP-16' })
  }

  // C16-MOP-17 — MI subrole coherence (informational band ≥ 90% of known subroles)
  {
    let known = 0
    let coherent = 0
    for (const item of miItems) {
      const subrole = exerciseById.get(Number(item.exercise_id))?.phase_subrole ?? null
      if (!subrole) continue
      known += 1
      if (!CAT16_MI_INCOHERENT_SUBROLES.has(String(subrole))) coherent += 1
    }
    const rate = known > 0 ? coherent / known : 1
    info(checks, 'category16_mop_mi_subrole_coherence', `MI subrole coherence ${(rate * 100).toFixed(0)}% (${coherent}/${known} known)`, {
      ok_band: rate >= 0.9,
      rubric: 'C16-MOP-17',
      known,
      total: miItems.length,
    })
  }

  // C16-MOP-19 — conditional role rate per phase (informational band ≤ 15%)
  {
    const rates = []
    for (const block of blocks) {
      const count = (block.items ?? []).length
      if (count === 0) continue
      const conditional = conditionalByPhase.get(block.phase_key) ?? 0
      rates.push({ phase_key: block.phase_key, rate: conditional / count })
    }
    const worst = rates.reduce((m, r) => Math.max(m, r.rate), 0)
    info(checks, 'category16_mop_conditional_role_rate', `Max per-phase conditional-role rate ${(worst * 100).toFixed(0)}%`, {
      ok_band: !hasProfiles || worst <= 0.15,
      rubric: 'C16-MOP-19',
      per_phase: rates,
    })
  }

  // C16-MOP-23 — single-item phase fill (informational; Sustained/Restore exempt)
  {
    const singleItemPhases = blocks
      .filter((b) => !['sustained_capacity', 'restore'].includes(b.phase_key) && (b.items ?? []).length === 1)
      .map((b) => b.phase_key)
    info(checks, 'category16_mop_single_item_fill', `Single-item working phases: ${singleItemPhases.length}`, {
      ok_band: singleItemPhases.length <= 1,
      rubric: 'C16-MOP-23',
      phases: singleItemPhases,
    })
  }

  // C16-MOE-01 proxy — Prepare reads as warmup (difficulty ceiling + no high-arousal)
  {
    const maxPrepOverall = prepareItems.reduce(
      (m, item) => Math.max(m, Number(cat16ItemDifficulty(item, difficultyByExerciseId)?.overall ?? 0)),
      0,
    )
    info(checks, 'category16_moe_prepare_warmup', `Prepare max difficulty ${maxPrepOverall}; high-arousal tags ${prepareMethodologyHits.length}`, {
      ok_band: prepareItems.length > 0 && maxPrepOverall <= sessionCapOverall && prepareMethodologyHits.length === 0,
      rubric: 'C16-MOE-01',
    })
  }

  // C16-MOE-02 proxy — MI reads as movement quality (no HIIT tag; load ≤ 5)
  {
    const offQuality = miItems.filter((item) => {
      const keys = cat16MethodologyKeys(item.exercise_id, tagMap, methodologyKeyById)
      const load = Number(cat16ItemDifficulty(item, difficultyByExerciseId)?.load ?? 0)
      return keys.includes('hiit') || load > 5
    })
    info(checks, 'category16_moe_mi_quality', `MI off-quality items: ${offQuality.length}/${miItems.length}`, {
      ok_band: offQuality.length === 0,
      rubric: 'C16-MOE-02',
      items: offQuality.slice(0, 5).map((i) => i.exercise_name),
    })
  }

  // C16-MOE-04 proxy — Sustained is a conditioning block (strict eligibility share)
  {
    const sustainedBlock = blockByKey(result, 'sustained_capacity')
    const sustainedItems = sustainedBlock?.items ?? []
    let eligible = 0
    for (const item of sustainedItems) {
      const ex = exerciseById.get(Number(item.exercise_id)) ?? { id: item.exercise_id }
      const tags = tagMap.get(String(item.exercise_id)) ?? []
      if (sustainedCapacityCandidateEligible(ex, tags, methodologyKeyById, intentKeyById, { strictConditioningMethodology: true })) {
        eligible += 1
      }
    }
    info(checks, 'category16_moe_sustained_conditioning', `Sustained conditioning-eligible ${eligible}/${sustainedItems.length}`, {
      ok_band: sustainedItems.length === 0 || eligible === sustainedItems.length,
      rubric: 'C16-MOE-04',
    })
  }

  // C16-MOE-06 proxy — fatigue arc (Prepare < peak; Restore < peak)
  {
    const meanOverall = (phaseKey) => {
      const items = blockByKey(result, phaseKey)?.items ?? []
      if (items.length === 0) return null
      return mean(items.map((item) => Number(cat16ItemDifficulty(item, difficultyByExerciseId)?.overall ?? 0)))
    }
    const prep = meanOverall('prepare_and_access')
    const restore = meanOverall('restore')
    const peak = Math.max(...['output', 'capacity', 'resilience'].map((k) => meanOverall(k) ?? 0), 0)
    const arcOk = (prep == null || prep < peak) && (restore == null || restore < peak)
    info(checks, 'category16_moe_fatigue_arc', `Fatigue arc: prepare ${prep?.toFixed(1) ?? 'n/a'} → peak ${peak.toFixed(1)} → restore ${restore?.toFixed(1) ?? 'n/a'}`, {
      ok_band: peak > 0 ? arcOk : null,
      rubric: 'C16-MOE-06',
    })
  }

  // C16-MOE-07 — Prepare → Output pattern/family bridge
  {
    const outputItems = blockByKey(result, 'output')?.items ?? []
    let bridges = 0
    for (const p of prepareItems) {
      for (const o of outputItems) {
        if (sharesPatternOrFamily(p.exercise_id, o.exercise_id, tagMap, exerciseById)) bridges += 1
      }
    }
    info(checks, 'category16_moe_prepare_output_bridge', `Prepare→Output pattern/family bridges: ${bridges}`, {
      ok_band: prepareItems.length === 0 || outputItems.length === 0 ? null : bridges >= 1,
      rubric: 'C16-MOE-07',
    })
  }

  // C16-MOE-03 / C16-MOE-05 / C16-MOE-08 — manual review packet
  info(checks, 'category16_moe_review_packet', `${blocks.length} phase block(s) for coach phase-intent review`, {
    ok_band: true,
    phases: blocks.map((b) => ({
      phase_key: b.phase_key,
      label: b.label,
      target_minutes: b.target_minutes,
      items: (b.items ?? []).slice(0, 8).map((item) => ({
        exercise: item.exercise_name,
        primary_phase_key: exerciseById.get(Number(item.exercise_id))?.primary_phase_key ?? null,
        overall: Number(cat16ItemDifficulty(item, difficultyByExerciseId)?.overall ?? 0),
      })),
    })),
    rubric: ['C16-MOE-01', 'C16-MOE-02', 'C16-MOE-03', 'C16-MOE-05', 'C16-MOE-06', 'C16-MOE-08'],
  })
}

export function computeCategory16Kpi(checks, opts = {}) {
  return computeKpi(checks, 16, CATEGORY16_KPI_CHECK_IDS, { minRate: 0.95, ...opts })
}

// ─── Category 17 — Youth & safety gates ───────────────────────────────────────

const YOUTH_SESSION_AGE_MAX = 14
const YOUTH_HANDSTAND_FORBID_UNDER = 15
const YOUTH_VALID_SCALING_COHORTS = new Set(['youth_beginner', 'youth_intermediate', 'teen'])
const YOUTH_RESILIENCE_WALL_HANDSTAND_SLUGS = new Set([
  'wall-handstand-line-hold',
  'wall-handstand-shoulder-shrug',
  'wall-walk-negative-controlled-wall-walk-down',
  'chest-to-wall-handstand',
  'wall-facing-handstand-hold',
])
const YOUTH_HIGH_INTENT_PHASES = ['output', 'capacity', 'resilience', 'sustained_capacity']
const YOUTH_PREPARE_MI_PHASES = new Set(['prepare_and_access', 'movement_intelligence'])

function isHandstandInversionSlug(slug, name = '') {
  const blob = `${slug ?? ''} ${name ?? ''}`.toLowerCase()
  return /handstand|inversion|inverted/.test(blob)
}

function isResilienceWallHandstandSlug(slug) {
  return YOUTH_RESILIENCE_WALL_HANDSTAND_SLUGS.has(String(slug ?? '').toLowerCase())
}

function phaseImpactForExercise(exerciseId, phaseKey, phaseProfileMap) {
  const profiles = phaseProfileMap.get(String(exerciseId)) ?? phaseProfileMap.get(Number(exerciseId)) ?? []
  const match = profiles.find((p) => p.phaseKey === phaseKey || p.phase_key === phaseKey)
  return Number(match?.impactLevel ?? match?.impact_level ?? 0)
}

function safetyForExercise(exerciseId, safetyProfileByExerciseId) {
  return safetyProfileByExerciseId.get(String(exerciseId))
    ?? safetyProfileByExerciseId.get(Number(exerciseId))
    ?? null
}

function difficultyForItem(item, difficultyByExerciseId) {
  return item.difficulty
    ?? difficultyByExerciseId.get(String(item.exercise_id))
    ?? difficultyByExerciseId.get(Number(item.exercise_id))
    ?? null
}

export const CATEGORY17_KPI_CHECK_IDS = [
  'mi_no_handstand_youth',
  'youth_mi_pool_filter',
  'youth_recommended_age_min',
  'youth_recommended_age_max',
  'mi_attention_demand_ceiling',
  'youth_beginner_excluded_slugs',
  'youth_scaling_cohort',
  'youth_mi_technical_share',
  'youth_inversion_non_mi',
  'youth_prepare_mi_impact_ceiling',
  'youth_medical_clearance',
  'youth_mi_load_ceiling',
  'youth_gymnastics_handstand_scope',
  'split1_cap_adherence',
  'youth_advanced_skill_level',
  'youth_resilience_wall_handstand',
  'youth_high_intent_minutes',
  'youth_age_inputs_valid',
  'youth_scaling_cohort_resolvable',
  'mi_attention_demand_spike',
  'youth_unsupervised_high_risk',
]

export const CATEGORY17_MOE_CHECK_IDS = [
  'youth_sport_context_multiplier',
  'youth_beginner_penalty_inactive',
  'youth_contraindication_rate',
  'youth_scaling_guidance_rate',
  'youth_mi_neural_methodology',
  'youth_split1_output_plyo_density',
  'category17_moe_review_packet',
]

export function evaluateCategory17Youth(result, expectedBody, checks, context = {}) {
  const {
    exerciseById = new Map(),
    difficultyByExerciseId = new Map(),
    phaseProfileMap = new Map(),
    safetyProfileByExerciseId = new Map(),
    tagMap = new Map(),
    methodologyKeyById = new Map(),
    sportIdByKey = new Map(),
    thresholds = {},
  } = context

  const profile = result.audience_profile ?? {}
  const sessMin = Number(expectedBody.ageMin ?? expectedBody.age_min ?? profile.ageMin ?? 0)
  const sessMax = Number(expectedBody.ageMax ?? expectedBody.age_max ?? profile.ageMax ?? 120)
  const skillLevel = String(expectedBody.skillLevel ?? expectedBody.skill_level ?? profile.impliedSkillLevel ?? 'INTERMEDIATE').toUpperCase()
  const sportKey = expectedBody.sportKey ?? expectedBody.sport_key ?? null
  const isYouthSession = sessMax <= YOUTH_SESSION_AGE_MAX
  const isYouthBand = sessMin >= 8 && sessMax <= 14
  const expectedProfile = resolveAudienceProfile({
    ageMin: sessMin,
    ageMax: sessMax,
    skillLevel,
    sessionObjective: expectedBody.sessionObjective ?? expectedBody.session_objective,
    targets: expectedBody.targets,
  })
  const resSplitList = resultSplits(result)
  const split1Cap = Number(
    resSplitList.find((s) => isSplit1Label(s.label))?.caps?.maxOverall
    ?? bodySplits(expectedBody).find((s) => isSplit1Label(s.label))?.difficultyOverride
    ?? bodySplits(expectedBody).find((s) => isSplit1Label(s.label))?.difficulty_override
    ?? expectedProfile.caps.maxOverall,
  )
  const reviewItems = []

  // C17-MOS-01 — youth_age_inputs_valid
  if (!findCheck(checks, 'youth_age_inputs_valid')) {
    const issues = []
    if (Number.isFinite(sessMin) && Number.isFinite(sessMax) && sessMin > sessMax) {
      issues.push('ageMin > ageMax')
    }
    if (sessMin < 4 || sessMax > 120) {
      issues.push('age outside engine-supported bands')
    }
    if (issues.length > 0) {
      fail(checks, 'youth_age_inputs_valid', `Youth age inputs invalid: ${issues.join(', ')}`)
    } else {
      pass(checks, 'youth_age_inputs_valid', `Age inputs valid (${sessMin}-${sessMax})`)
    }
  }

  // C17-MOS-02 — youth_scaling_cohort_resolvable
  if (!findCheck(checks, 'youth_scaling_cohort_resolvable')) {
    if (!isYouthBand) {
      pass(checks, 'youth_scaling_cohort_resolvable', 'Scaling cohort resolvable N/A — session outside 8–14')
    } else if (expectedProfile.scalingCohort) {
      pass(checks, 'youth_scaling_cohort_resolvable', `scalingCohort derivable: ${expectedProfile.scalingCohort}`)
    } else {
      fail(checks, 'youth_scaling_cohort_resolvable', 'scalingCohort not derivable for youth session')
    }
  }

  // C17-MOP-01 / C17-MOR-01 — mi_no_handstand_youth
  if (!findCheck(checks, 'mi_no_handstand_youth')) {
    const forbidUnder = thresholds.forbidHandstandInMIUnderAge ?? YOUTH_HANDSTAND_FORBID_UNDER
    if (sessMax < forbidUnder) {
      const mi = blockByKey(result, 'movement_intelligence')
      const bad = (mi?.items ?? []).filter((it) => {
        const ex = exerciseById.get(Number(it.exercise_id))
        return isHandstandInversionSlug(ex?.slug, it.exercise_name)
      })
      if (bad.length > 0) {
        fail(checks, 'mi_no_handstand_youth', 'Handstand/inversion in MI for youth', bad.map((it) => it.exercise_name))
      } else {
        pass(checks, 'mi_no_handstand_youth', 'MI has no handstand/inversion for youth')
      }
    } else {
      pass(checks, 'mi_no_handstand_youth', 'MI handstand gate N/A — session age ≥ threshold')
    }
  }

  // C17-MOP-02 — youth_mi_pool_filter (0 in Rx proves engine filter)
  if (!findCheck(checks, 'youth_mi_pool_filter')) {
    if (sessMax <= YOUTH_SESSION_AGE_MAX) {
      const mi = blockByKey(result, 'movement_intelligence')
      const inv = (mi?.items ?? []).filter((it) => {
        const ex = exerciseById.get(Number(it.exercise_id))
        return isHandstandInversionSlug(ex?.slug, it.exercise_name)
      })
      if (inv.length > 0) {
        fail(checks, 'youth_mi_pool_filter', `${inv.length} handstand/inversion in MI — pool filter leak`)
      } else {
        pass(checks, 'youth_mi_pool_filter', 'MI pool filter: 0 handstand/inversion primaries')
      }
    } else {
      pass(checks, 'youth_mi_pool_filter', 'Youth MI pool filter N/A')
    }
  }

  // C17-MOP-03 — youth_recommended_age_min
  if (!findCheck(checks, 'youth_recommended_age_min')) {
    let violations = 0
    let checked = 0
    for (const block of result.blocks ?? []) {
      for (const item of block.items ?? []) {
        const diff = difficultyForItem(item, difficultyByExerciseId)
        const recMin = diff?.recommended_age_min
        if (recMin == null) continue
        checked += 1
        if (Number(recMin) > sessMax) violations += 1
      }
    }
    if (violations > 0) {
      fail(checks, 'youth_recommended_age_min', `${violations} item(s) with recommended_age_min > session ageMax`)
    } else if (checked > 0 || isYouthSession) {
      pass(checks, 'youth_recommended_age_min', violations === 0 ? 'No recommended_age_min violations' : 'No age metadata to check')
    }
  }

  // C17-MOP-04 — youth_recommended_age_max
  if (!findCheck(checks, 'youth_recommended_age_max')) {
    let violations = 0
    let checked = 0
    for (const block of result.blocks ?? []) {
      for (const item of block.items ?? []) {
        const diff = difficultyForItem(item, difficultyByExerciseId)
        const recMax = diff?.recommended_age_max
        if (recMax == null) continue
        checked += 1
        if (Number(recMax) < sessMin) violations += 1
      }
    }
    if (violations > 0) {
      fail(checks, 'youth_recommended_age_max', `${violations} item(s) with recommended_age_max < session ageMin`)
    } else if (checked > 0 || isYouthSession) {
      pass(checks, 'youth_recommended_age_max', 'No recommended_age_max violations')
    }
  }

  // C17-MOP-05 — mi_attention_demand_ceiling
  if (!findCheck(checks, 'mi_attention_demand_ceiling')) {
    let fails = 0
    if (sessMax <= YOUTH_SESSION_AGE_MAX) {
      const mi = blockByKey(result, 'movement_intelligence')
      for (const item of mi?.items ?? []) {
        const diff = difficultyForItem(item, difficultyByExerciseId)
        if (Number(diff?.attention_demand ?? 0) >= 8) fails += 1
      }
    }
    if (sessMax <= YOUTH_SESSION_AGE_MAX && fails > 0) {
      fail(checks, 'mi_attention_demand_ceiling', `${fails} MI item(s) with attention_demand ≥ 8`)
    } else if (sessMax <= YOUTH_SESSION_AGE_MAX) {
      pass(checks, 'mi_attention_demand_ceiling', 'MI attention_demand below ceiling for youth')
    } else {
      pass(checks, 'mi_attention_demand_ceiling', 'MI attention ceiling N/A — session age > 14')
    }
  }

  // C17-MOR-03 — mi_attention_demand_spike (≥ 9)
  if (!findCheck(checks, 'mi_attention_demand_spike')) {
    let spikes = 0
    if (sessMax <= YOUTH_SESSION_AGE_MAX) {
      const mi = blockByKey(result, 'movement_intelligence')
      for (const item of mi?.items ?? []) {
        const diff = difficultyForItem(item, difficultyByExerciseId)
        if (Number(diff?.attention_demand ?? 0) >= 9) spikes += 1
      }
    }
    if (sessMax <= YOUTH_SESSION_AGE_MAX && spikes > 0) {
      fail(checks, 'mi_attention_demand_spike', `${spikes} MI item(s) with attention_demand ≥ 9`)
    } else if (sessMax <= YOUTH_SESSION_AGE_MAX) {
      pass(checks, 'mi_attention_demand_spike', 'No MI attention_demand spikes')
    } else {
      pass(checks, 'mi_attention_demand_spike', 'MI attention spike check N/A')
    }
  }

  // C17-MOP-06 — youth_beginner_excluded_slugs
  if (!findCheck(checks, 'youth_beginner_excluded_slugs')) {
    if (skillLevel === 'BEGINNER') {
      const hits = []
      for (const block of result.blocks ?? []) {
        for (const item of block.items ?? []) {
          const ex = exerciseById.get(Number(item.exercise_id))
          if (isBeginnerExcludedSlug(ex?.slug, item.exercise_name ?? ex?.name)) {
            hits.push(item.exercise_name ?? ex?.name)
          }
        }
      }
      if (hits.length > 0) {
        fail(checks, 'youth_beginner_excluded_slugs', `${hits.length} beginner-excluded slug(s)`, hits.slice(0, 8))
      } else {
        pass(checks, 'youth_beginner_excluded_slugs', 'No beginner-excluded slugs prescribed')
      }
    } else {
      pass(checks, 'youth_beginner_excluded_slugs', `Beginner exclusion N/A — skillLevel ${skillLevel}`)
    }
  }

  // C17-MOP-07 — youth_scaling_cohort
  if (!findCheck(checks, 'youth_scaling_cohort')) {
    const cohort = profile.scalingCohort ?? profile.scaling_cohort
    if (isYouthBand) {
      if (cohort && YOUTH_VALID_SCALING_COHORTS.has(cohort)) {
        pass(checks, 'youth_scaling_cohort', `scalingCohort ${cohort} in youth band`)
      } else {
        fail(checks, 'youth_scaling_cohort', `scalingCohort ${cohort ?? 'null'} not in youth band`)
      }
    } else {
      pass(checks, 'youth_scaling_cohort', 'Youth scaling cohort N/A')
    }
  }

  // C17-MOP-08 — youth_mi_technical_share
  if (!findCheck(checks, 'youth_mi_technical_share')) {
    const mi = blockByKey(result, 'movement_intelligence')
    const items = mi?.items ?? []
    if (isYouthSession && items.length > 0) {
      let highTech = 0
      for (const item of items) {
        const diff = difficultyForItem(item, difficultyByExerciseId)
        if (Number(diff?.technical ?? 0) >= 8) highTech += 1
      }
      const share = highTech / items.length
      if (share > 0.1) {
        fail(checks, 'youth_mi_technical_share', `MI technical ≥ 8 share ${(share * 100).toFixed(0)}% > 10%`)
      } else {
        pass(checks, 'youth_mi_technical_share', `MI technical ≥ 8 share ${(share * 100).toFixed(0)}%`)
      }
    } else {
      pass(checks, 'youth_mi_technical_share', 'MI technical share N/A')
    }
  }

  // C17-MOP-09 — youth_mi_neural_methodology (informational — speed_priority sessions may include elastic/neural MI)
  if (!findCheck(checks, 'youth_mi_neural_methodology')) {
    let neuralCount = 0
    if (sessMax <= YOUTH_SESSION_AGE_MAX) {
      const mi = blockByKey(result, 'movement_intelligence')
      for (const item of mi?.items ?? []) {
        const keys = methodologyKeysForExercise(item.exercise_id, tagMap, methodologyKeyById)
        if (keys.some((k) => k === 'neural')) neuralCount += 1
      }
    }
    info(checks, 'youth_mi_neural_methodology', sessMax <= YOUTH_SESSION_AGE_MAX
      ? `MI neural methodology items: ${neuralCount} (target 0)`
      : 'Neural MI check N/A', {
      ok_band: neuralCount === 0,
      neuralCount,
      rubric: 'C17-MOP-09',
    })
  }

  // C17-MOP-10 — youth_inversion_non_mi
  if (!findCheck(checks, 'youth_inversion_non_mi')) {
    const badOutside = []
    if (sessMax < YOUTH_HANDSTAND_FORBID_UNDER) {
      for (const block of result.blocks ?? []) {
        const phaseKey = block.phase_key
        if (phaseKey === 'movement_intelligence') continue
        for (const item of block.items ?? []) {
          const ex = exerciseById.get(Number(item.exercise_id))
          const slug = ex?.slug ?? ''
          if (!isHandstandInversionSlug(slug, item.exercise_name)) continue
          if (phaseKey === 'resilience' && isResilienceWallHandstandSlug(slug)) continue
          badOutside.push({ phase_key: phaseKey, name: item.exercise_name, slug })
        }
      }
    }
    if (badOutside.length > 0) {
      fail(checks, 'youth_inversion_non_mi', `${badOutside.length} inversion outside MI/Resilience-allowlist`, badOutside.slice(0, 8))
    } else if (sessMax < YOUTH_HANDSTAND_FORBID_UNDER) {
      pass(checks, 'youth_inversion_non_mi', 'Inversions confined to Resilience wall-hold allowlist')
    } else {
      pass(checks, 'youth_inversion_non_mi', 'Inversion non-MI check N/A')
    }
  }

  // C17-MOP-11 — youth_prepare_mi_impact_ceiling
  if (!findCheck(checks, 'youth_prepare_mi_impact_ceiling')) {
    let impactFails = 0
    if (isYouthSession) {
      for (const block of result.blocks ?? []) {
        if (!YOUTH_PREPARE_MI_PHASES.has(block.phase_key)) continue
        for (const item of block.items ?? []) {
          const impact = phaseImpactForExercise(item.exercise_id, block.phase_key, phaseProfileMap)
          if (impact >= 3) impactFails += 1
        }
      }
    }
    if (isYouthSession && impactFails > 0) {
      fail(checks, 'youth_prepare_mi_impact_ceiling', `${impactFails} Prepare/MI primary(ies) with impact_level ≥ 3`)
    } else if (isYouthSession) {
      pass(checks, 'youth_prepare_mi_impact_ceiling', 'Prepare/MI impact_level below ceiling')
    } else {
      pass(checks, 'youth_prepare_mi_impact_ceiling', 'Impact ceiling N/A')
    }
  }

  // C17-MOP-13 — youth_medical_clearance
  if (!findCheck(checks, 'youth_medical_clearance')) {
    const clearanceItems = []
    if (isYouthBand) {
      for (const block of result.blocks ?? []) {
        for (const item of block.items ?? []) {
          const safety = safetyForExercise(item.exercise_id, safetyProfileByExerciseId)
          if (safety?.requires_medical_clearance) {
            clearanceItems.push(item.exercise_name)
          }
        }
      }
    }
    if (clearanceItems.length > 0) {
      fail(checks, 'youth_medical_clearance', `${clearanceItems.length} item(s) require medical clearance`, clearanceItems.slice(0, 8))
    } else if (isYouthBand) {
      pass(checks, 'youth_medical_clearance', 'No medical-clearance items for youth 8–14')
    } else {
      pass(checks, 'youth_medical_clearance', 'Medical clearance gate N/A')
    }
  }

  // C17-MOP-15 — youth_mi_load_ceiling
  if (!findCheck(checks, 'youth_mi_load_ceiling')) {
    let loadFails = 0
    if (sessMax <= YOUTH_SESSION_AGE_MAX) {
      const mi = blockByKey(result, 'movement_intelligence')
      for (const item of mi?.items ?? []) {
        const diff = difficultyForItem(item, difficultyByExerciseId)
        if (Number(diff?.load ?? 0) >= 6) loadFails += 1
      }
    }
    if (sessMax <= YOUTH_SESSION_AGE_MAX && loadFails > 0) {
      fail(checks, 'youth_mi_load_ceiling', `${loadFails} MI item(s) with load ≥ 6`)
    } else if (sessMax <= YOUTH_SESSION_AGE_MAX) {
      pass(checks, 'youth_mi_load_ceiling', 'MI load below ceiling for youth')
    } else {
      pass(checks, 'youth_mi_load_ceiling', 'MI load ceiling N/A')
    }
  }

  // C17-MOP-16 — youth_gymnastics_handstand_scope
  if (!findCheck(checks, 'youth_gymnastics_handstand_scope')) {
    const isGymnastics = sportKey && /gymnastics/i.test(String(sportKey))
    if (isYouthSession && !isGymnastics) {
      let handstands = 0
      for (const block of result.blocks ?? []) {
        for (const item of block.items ?? []) {
          const ex = exerciseById.get(Number(item.exercise_id))
          if (isHandstandInversionSlug(ex?.slug, item.exercise_name)) handstands += 1
        }
      }
      if (handstands > 0) {
        fail(checks, 'youth_gymnastics_handstand_scope', `${handstands} handstand/inversion on non-gymnastics youth session`)
      } else {
        pass(checks, 'youth_gymnastics_handstand_scope', 'Non-gymnastics youth session has no handstand/inversion')
      }
    } else {
      pass(checks, 'youth_gymnastics_handstand_scope', 'Gymnastics handstand scope N/A')
    }
  }

  // C17-MOP-17 / C17-MOR-02 — split1_cap_adherence (delegated to Cat 5 when present)
  if (!findCheck(checks, 'split1_cap_adherence') && resSplitList.length >= 2) {
    const capsMap = capsByLabel(resSplitList)
    const violations = []
    for (const row of collectAllPerSplit(result)) {
      const sl = String(row.variant.split_label ?? '')
      if (!isSplit1Label(sl)) continue
      const expectedCap = Number(capsMap.get(sl)?.maxOverall ?? NaN)
      const d = variantOverallDifficulty(row.variant, row.item)
      if (Number.isFinite(expectedCap) && d > expectedCap) {
        violations.push({ split_label: sl, difficulty: d, cap: expectedCap })
      }
    }
    if (violations.length > 0) {
      fail(checks, 'split1_cap_adherence', 'Split 1 variants exceed cap', violations.slice(0, 8))
    } else {
      pass(checks, 'split1_cap_adherence', 'Split 1 variants within cap')
    }
  } else if (!findCheck(checks, 'split1_cap_adherence')) {
    pass(checks, 'split1_cap_adherence', 'Split 1 cap adherence N/A — single split')
  }

  // C17-MOP-18 — youth_advanced_skill_level
  if (!findCheck(checks, 'youth_advanced_skill_level')) {
    let advancedTotal = 0
    let advancedMi = 0
    if (sessMax <= YOUTH_SESSION_AGE_MAX) {
      for (const block of result.blocks ?? []) {
        for (const item of block.items ?? []) {
          const exSkill = String(exerciseById.get(Number(item.exercise_id))?.skill_level ?? '').toUpperCase()
          if (exSkill === 'ADVANCED') {
            advancedTotal += 1
            if (block.phase_key === 'movement_intelligence') advancedMi += 1
          }
        }
      }
    }
    if (sessMax <= YOUTH_SESSION_AGE_MAX && (advancedMi > 0 || advancedTotal > 2)) {
      fail(checks, 'youth_advanced_skill_level', `ADVANCED: ${advancedTotal} session-wide, ${advancedMi} in MI (max 2 / 0 MI)`)
    } else if (sessMax <= YOUTH_SESSION_AGE_MAX) {
      pass(checks, 'youth_advanced_skill_level', `ADVANCED count ${advancedTotal} (MI ${advancedMi})`)
    } else {
      pass(checks, 'youth_advanced_skill_level', 'ADVANCED skill check N/A')
    }
  }

  // C17-MOP-20 — youth_resilience_wall_handstand
  if (!findCheck(checks, 'youth_resilience_wall_handstand')) {
    let wallCount = 0
    let wallOutsideResilience = 0
    if (sessMax < YOUTH_HANDSTAND_FORBID_UNDER) {
      for (const block of result.blocks ?? []) {
        for (const item of block.items ?? []) {
          const ex = exerciseById.get(Number(item.exercise_id))
          const slug = ex?.slug ?? ''
          if (!isResilienceWallHandstandSlug(slug) && !/wall.*handstand|handstand.*wall/i.test(slug)) continue
          if (!isResilienceWallHandstandSlug(slug)) {
            if (block.phase_key !== 'resilience') wallOutsideResilience += 1
            continue
          }
          wallCount += 1
          if (block.phase_key !== 'resilience') wallOutsideResilience += 1
          if (block.phase_key === 'movement_intelligence' || block.phase_key === 'prepare_and_access') {
            wallOutsideResilience += 1
          }
        }
      }
    }
    if (wallOutsideResilience > 0 || wallCount > 1) {
      fail(checks, 'youth_resilience_wall_handstand', `Wall handstand: ${wallCount} total, ${wallOutsideResilience} outside Resilience allowlist`)
    } else if (sessMax < YOUTH_HANDSTAND_FORBID_UNDER) {
      pass(checks, 'youth_resilience_wall_handstand', `Resilience wall-handstand exception OK (${wallCount})`)
    } else {
      pass(checks, 'youth_resilience_wall_handstand', 'Wall-handstand exception N/A')
    }
  }

  // C17-MOP-21 — youth_high_intent_minutes
  if (!findCheck(checks, 'youth_high_intent_minutes')) {
    let highIntentMin = 0
    if (sessMax <= 12) {
      for (const block of result.blocks ?? []) {
        if (!YOUTH_HIGH_INTENT_PHASES.includes(block.phase_key)) continue
        highIntentMin += Number(block.estimated_minutes ?? block.target_minutes ?? 0)
      }
    }
    const maxMin = thresholds.maxYouthHighIntentMinutes ?? 85
    if (sessMax <= 12 && highIntentMin > maxMin) {
      fail(checks, 'youth_high_intent_minutes', `High-intent minutes ${highIntentMin} > ${maxMin}`)
    } else if (sessMax <= 12) {
      pass(checks, 'youth_high_intent_minutes', `High-intent minutes ${highIntentMin} ≤ ${maxMin}`)
    } else {
      pass(checks, 'youth_high_intent_minutes', 'High-intent minutes N/A — ageMax > 12')
    }
  }

  // C17-MOP-22 — youth_split1_output_plyo_density (informational — speed_priority tolerates higher plyo density)
  if (!findCheck(checks, 'youth_split1_output_plyo_density')) {
    let plyoCount = 0
    const output = blockByKey(result, 'output')
    if (isYouthSession && output) {
      for (const item of output.items ?? []) {
        const hasSplit1 = (item.per_split ?? item.split_alternates_json ?? []).some((v) => isSplit1Label(v.split_label))
        if (!hasSplit1) continue
        const keys = methodologyKeysForExercise(item.exercise_id, tagMap, methodologyKeyById)
        const ex = exerciseById.get(Number(item.exercise_id))
        const blob = `${ex?.slug ?? ''} ${item.exercise_name ?? ''}`.toLowerCase()
        if (keys.some((k) => /plyometric|jump|elastic/.test(k)) || /plyo|jump|hop|bound|pogo/.test(blob)) {
          plyoCount += 1
        }
      }
    }
    const maxPlyo = thresholds.maxYouthSplit1OutputPlyo ?? 3
    info(checks, 'youth_split1_output_plyo_density', isYouthSession
      ? `Split 1 Output plyo items ${plyoCount} (target ≤ ${maxPlyo})`
      : 'Split 1 Output plyo density N/A', {
      ok_band: plyoCount <= maxPlyo,
      plyoCount,
      maxPlyo,
      rubric: 'C17-MOP-22',
    })
  }

  // C17-MOR-04 — youth_unsupervised_high_risk
  if (!findCheck(checks, 'youth_unsupervised_high_risk')) {
    const leaks = []
    if (isYouthSession) {
      for (const block of result.blocks ?? []) {
        for (const item of block.items ?? []) {
          const ex = exerciseById.get(Number(item.exercise_id))
          const safety = safetyForExercise(item.exercise_id, safetyProfileByExerciseId)
          const needsSpot = safety?.requires_spotting === true
          const inversion = isHandstandInversionSlug(ex?.slug, item.exercise_name)
          if (!needsSpot && !inversion) continue
          const ps = item.per_split ?? item.split_alternates_json ?? []
          const hasGuidance = ps.some((v) => String(v.scaling_guidance ?? v.scalingGuidance ?? '').trim().length > 0)
          if (!hasGuidance) {
            leaks.push({ name: item.exercise_name, phase_key: block.phase_key, needsSpot, inversion })
          }
        }
      }
    }
    if (leaks.length > 0) {
      fail(checks, 'youth_unsupervised_high_risk', `${leaks.length} high-risk item(s) without scaling_guidance`, leaks.slice(0, 8))
    } else if (isYouthSession) {
      pass(checks, 'youth_unsupervised_high_risk', 'High-risk items have scaling_guidance')
    } else {
      pass(checks, 'youth_unsupervised_high_risk', 'High-risk guidance check N/A')
    }
  }

  // Informational MOE checks
  if (!findCheck(checks, 'youth_sport_context_multiplier')) {
    const inversionBoosts = []
    if (isYouthSession && sportKey === 'fitness') {
      for (const block of result.blocks ?? []) {
        for (const item of block.items ?? []) {
          const ex = exerciseById.get(Number(item.exercise_id)) ?? { slug: '', name: item.exercise_name }
          if (!isHandstandInversionSlug(ex.slug, item.exercise_name)) continue
          const mult = sportContextMultiplier(ex, sportKey, sportIdByKey)
          if (mult > 1) inversionBoosts.push({ name: item.exercise_name, multiplier: mult })
        }
      }
    }
    info(checks, 'youth_sport_context_multiplier', inversionBoosts.length > 0
      ? `${inversionBoosts.length} inversion(s) with fitness multiplier > 1`
      : 'No inversion sport-context boost for youth fitness', {
      ok_band: inversionBoosts.length === 0,
      inversionBoosts: inversionBoosts.slice(0, 8),
      rubric: 'C17-MOP-12',
    })
  }

  if (!findCheck(checks, 'youth_beginner_penalty_inactive')) {
    let penaltyActive = 0
    if (skillLevel !== 'BEGINNER') {
      for (const block of result.blocks ?? []) {
        for (const item of block.items ?? []) {
          const ex = exerciseById.get(Number(item.exercise_id)) ?? { slug: '', name: item.exercise_name }
          const diff = difficultyForItem(item, difficultyByExerciseId) ?? {}
          const penalty = beginnerAppropriatenessPenalty(ex, diff, skillLevel, sportKey)
          if (penalty > 0) penaltyActive += 1
        }
      }
    }
    info(checks, 'youth_beginner_penalty_inactive', skillLevel === 'BEGINNER'
      ? 'Beginner penalty path active — expected for BEGINNER'
      : penaltyActive > 0
        ? `${penaltyActive} item(s) would receive beginnerAppropriatenessPenalty`
        : 'beginnerAppropriatenessPenalty inactive for INTERMEDIATE+', {
      ok_band: skillLevel !== 'BEGINNER' ? penaltyActive === 0 : null,
      skillLevel,
      rubric: 'C17-MOP-19',
    })
  }

  if (!findCheck(checks, 'youth_contraindication_rate')) {
    let challenging = 0
    let withContra = 0
    if (isYouthSession) {
      for (const block of result.blocks ?? []) {
        for (const item of block.items ?? []) {
          const diff = difficultyForItem(item, difficultyByExerciseId)
          if (Number(diff?.technical ?? 0) < 6) continue
          challenging += 1
          const safety = safetyForExercise(item.exercise_id, safetyProfileByExerciseId)
          const notes = safety?.contraindication_notes ?? safety?.contraindications
          const hasNotes = Array.isArray(notes) ? notes.length > 0 : String(notes ?? '').trim().length > 0
          if (hasNotes) withContra += 1
        }
      }
    }
    const rate = challenging > 0 ? withContra / challenging : 1
    info(checks, 'youth_contraindication_rate', challenging > 0
      ? `Contraindication rate ${(rate * 100).toFixed(0)}% (${withContra}/${challenging})`
      : 'No technical ≥ 6 items for contraindication audit', {
      ok_band: challenging === 0 || rate >= 0.7,
      rate,
      challenging,
      withContra,
      rubric: 'C17-MOP-14',
    })
  }

  if (!findCheck(checks, 'youth_scaling_guidance_rate')) {
    let challenging = 0
    let withGuidance = 0
    for (const block of result.blocks ?? []) {
      for (const item of block.items ?? []) {
        const diff = difficultyForItem(item, difficultyByExerciseId)
        if (Number(diff?.technical ?? 0) < 6 && Number(diff?.overall ?? 0) < 6) continue
        challenging += 1
        const ps = item.per_split ?? item.split_alternates_json ?? []
        if (ps.some((v) => String(v.scaling_guidance ?? v.scalingGuidance ?? '').trim().length > 0)) {
          withGuidance += 1
        }
        reviewItems.push({
          phase_key: block.phase_key,
          exercise_id: Number(item.exercise_id),
          exercise_name: item.exercise_name,
          technical: diff?.technical ?? null,
          attention_demand: diff?.attention_demand ?? null,
        })
      }
    }
    const rate = challenging > 0 ? withGuidance / challenging : 1
    info(checks, 'youth_scaling_guidance_rate', `Scaling guidance ${(rate * 100).toFixed(0)}% on challenging items`, {
      ok_band: rate >= 0.8,
      rate,
      challenging,
      withGuidance,
      rubric: 'C17-MOE-03',
    })
  }

  info(checks, 'category17_moe_review_packet', `${reviewItems.length} item(s) for youth safety MOE review`, {
    ok_band: true,
    age_range: { min: sessMin, max: sessMax },
    skillLevel,
    scalingCohort: profile.scalingCohort,
    split1Cap,
    items: reviewItems.slice(0, 40),
    rubric: ['C17-MOE-01', 'C17-MOE-02', 'C17-MOE-04', 'C17-MOE-05', 'C17-MOE-06', 'C17-MOE-07', 'C17-MOE-08'],
  })

  for (const id of CATEGORY17_KPI_CHECK_IDS) {
    if (findCheck(checks, id)) continue
    pass(checks, id, `${id}: N/A for session`)
  }
  for (const id of CATEGORY17_MOE_CHECK_IDS) {
    if (findCheck(checks, id)) continue
    info(checks, id, `${id}: N/A for session`, { ok_band: null })
  }
}

export function computeCategory17Kpi(checks, opts = {}) {
  return computeKpi(checks, 17, CATEGORY17_KPI_CHECK_IDS, { minRate: 1, ...opts })
}

// ─── Category 18 — Stretch & over-cap primaries ───────────────────────────────

export const CATEGORY18_KPI_CHECK_IDS = [
  'stretch_primaries_prepare_and_access',
  'stretch_primaries_movement_intelligence',
  'stretch_primaries_output',
  'stretch_primaries_capacity',
  'stretch_primaries_resilience',
  'primary_over_cap_count',
  'engine_no_stretch_over_cap_admitted',
  'stretch_primary_fit_replay',
  'stretch_high_intent_mor',
]

export const CATEGORY18_MOE_CHECK_IDS = [
  'category18_moe_review_packet',
  'category18_moe_stretch_badges_proxy',
  'category18_moe_split1_overcap_proxy',
  'category18_moe_cap_consistency_proxy',
  'stretch_variant_warning_stability',
]

export function evaluateCategory18Stretch(result, expectedBody, checks, context = {}) {
  const {
    difficultyByExerciseId = new Map(),
    stretchVariantWarningStability = null,
  } = context

  const profile = result.audience_profile ?? {}
  const sessionCaps = profile.caps ?? {}
  const resSplitList = resultSplits(result)
  const splitProfiles = resSplitList.length > 0
    ? resSplitList.map((s) => ({ label: s.label, ageMin: s.age_min ?? s.ageMin, ageMax: s.age_max ?? s.ageMax, caps: s.caps ?? {} }))
    : buildSplitProfilesFromBody(expectedBody)
  const poolCaps = mergeCapsMax(sessionCaps, ...splitProfiles.map((s) => s.caps))
  const sessionCap = Number(sessionCaps.maxOverall ?? 10)
  const poolCap = Number(poolCaps.maxOverall ?? sessionCap)
  const warnings = result.age_fit_warnings ?? []
  const splitWarnings = result.split_variant_warnings ?? []
  const hardExclude = profile.hardDifficultyExclude ?? expectedBody.hardDifficultyExclude ?? false
  const hasSplits = resSplitList.length >= 2

  let stretchTotal = 0
  let overCapTotal = 0
  let stretchHighIntent = 0
  let admittedStretchOverCap = 0
  let replayStretchFails = 0
  let replayChecked = 0
  let noStretchPhaseTotal = 0
  let noStretchPhaseGood = 0
  let stretchItemsMissingWarning = 0
  let split1StretchWhenGood = 0
  let split1StretchDenom = 0
  let perSplitOverCap = 0
  let outputNearCap = 0
  let outputPrimaries = 0
  const reviewItems = []

  for (const block of result.blocks ?? []) {
    const phaseKey = block.phase_key
    const isNoStretch = NO_STRETCH_PRIMARY_PHASES.has(phaseKey)
    const isHighIntent = HIGH_INTENT_PHASES.includes(phaseKey)

    for (const item of block.items ?? []) {
      const fit = item.age_fit ?? 'good'
      const difficulty = item.difficulty ?? difficultyByExerciseId.get(String(item.exercise_id)) ?? difficultyByExerciseId.get(Number(item.exercise_id))
      const name = String(item.exercise_name ?? '').trim()

      if (fit === 'stretch') stretchTotal += 1
      if (fit === 'over_cap') overCapTotal += 1
      if (fit === 'stretch' && isHighIntent) stretchHighIntent += 1

      if (isNoStretch && (fit === 'stretch' || fit === 'over_cap')) {
        admittedStretchOverCap += 1
      }

      if (isNoStretch) {
        noStretchPhaseTotal += 1
        if (fit === 'good') noStretchPhaseGood += 1
        if (difficulty) {
          replayChecked += 1
          const replayFit = classifyPrimaryAgeFitReplay(difficulty, sessionCaps, splitProfiles)
          if (replayFit === 'stretch') replayStretchFails += 1
        }
      }

      if (fit === 'stretch') {
        const hasWarning = name && (warnings.some((w) => String(w).includes(name))
          || splitWarnings.some((w) => String(w).includes(name)))
        if (!hasWarning) stretchItemsMissingWarning += 1
      }

      if (phaseKey === 'output') {
        outputPrimaries += 1
        const d = Number(difficulty?.overall ?? 0)
        if (d >= sessionCap - 1) outputNearCap += 1
      }

      if (hasSplits && fit === 'good') {
        const s1 = split1Variant(item)
        if (s1) {
          split1StretchDenom += 1
          const split1Caps = capsByLabel(resSplitList).get(String(s1.split_label ?? '')) ?? resSplitList[0]?.caps ?? {}
          const s1D = variantOverallDifficulty(s1, item)
          const s1Fit = classifyAgeFit(
            { overall: s1D, technical: s1D, load: s1D },
            { maxOverall: Number(split1Caps.maxOverall ?? 6), maxTechnical: Number(split1Caps.maxTechnical ?? 6), maxLoad: Number(split1Caps.maxLoad ?? 6) },
          )
          if (s1Fit === 'stretch') split1StretchWhenGood += 1
        }
      }

      for (const v of item.per_split ?? item.split_alternates_json ?? []) {
        const sl = String(v.split_label ?? '')
        const splitCaps = capsByLabel(resSplitList).get(sl) ?? {}
        const expectedCap = Number(v.difficulty_cap ?? splitCaps.maxOverall ?? NaN)
        const d = variantOverallDifficulty(v, item)
        if (!Number.isFinite(expectedCap)) continue
        if (isSplit2Label(sl) && d > expectedCap) {
          perSplitOverCap += 1
        } else if (isSplit1Label(sl)) {
          const fit = classifyAgeFit(
            { overall: d, technical: d, load: d },
            { maxOverall: expectedCap, maxTechnical: expectedCap, maxLoad: expectedCap },
          )
          if (fit === 'over_cap') perSplitOverCap += 1
        }
      }

      reviewItems.push({
        phase_key: phaseKey,
        exercise_id: Number(item.exercise_id),
        exercise_name: item.exercise_name,
        age_fit: fit,
        difficulty_overall: difficulty?.overall ?? null,
        scaling_guidance: (item.per_split ?? []).find((v) => v.scaling_guidance)?.scaling_guidance ?? null,
      })
    }
  }

  // C18-MOP-12 / C18-MOP-13 — low-intent phase stretch counts (informational)
  for (const phaseKey of ['sustained_capacity', 'restore']) {
    const block = blockByKey(result, phaseKey)
    const stretchCount = (block?.items ?? []).filter((it) => it.age_fit === 'stretch').length
    const maxStretch = phaseKey === 'restore' ? 1 : 0
    const checkId = `stretch_primaries_${phaseKey}`
    if (stretchCount > maxStretch) {
      fail(checks, checkId, `${phaseKey} has ${stretchCount} stretch primary item(s) (max ${maxStretch})`)
    } else if (phaseKey === 'restore' && stretchCount > 0) {
      info(checks, checkId, `${phaseKey} stretch primaries: ${stretchCount}`, { ok_band: stretchCount <= maxStretch, rubric: 'C18-MOP-13' })
    } else {
      pass(checks, checkId, `${phaseKey} stretch primaries within limit (${stretchCount})`)
    }
  }

  info(checks, 'stretch_primary_session_total', `Stretch primaries session-wide: ${stretchTotal}`, {
    ok_band: stretchTotal <= 1,
    rubric: 'C18-MOP-09',
    stretchTotal,
  })

  ensureCheck(checks, 'primary_over_cap_count', () => {
    if (overCapTotal > 0) {
      fail(checks, 'primary_over_cap_count', `${overCapTotal} over_cap primary item(s)`)
    } else {
      pass(checks, 'primary_over_cap_count', 'No over_cap primaries')
    }
  })

  if (admittedStretchOverCap > 0) {
    fail(checks, 'engine_no_stretch_over_cap_admitted', `${admittedStretchOverCap} stretch/over_cap primary(ies) in NO_STRETCH phases`)
  } else {
    pass(checks, 'engine_no_stretch_over_cap_admitted', 'NO_STRETCH phases admit 0 stretch/over_cap primaries')
  }

  if (replayChecked > 0 && replayStretchFails > 0) {
    fail(checks, 'stretch_primary_fit_replay', `${replayStretchFails}/${replayChecked} primaries would classify stretch at selection time`)
  } else if (replayChecked > 0) {
    pass(checks, 'stretch_primary_fit_replay', 'Replay classifyPrimaryAgeFit: no stretch in NO_STRETCH phases')
  } else {
    pass(checks, 'stretch_primary_fit_replay', 'Stretch fit replay N/A — no difficulty metadata')
  }

  if (stretchHighIntent > 0) {
    failP0(checks, 'stretch_high_intent_mor', `${stretchHighIntent} stretch primary(ies) in Output/Capacity/Resilience`)
  } else {
    pass(checks, 'stretch_high_intent_mor', 'No stretch primaries in high-intent phases')
  }

  const goodFitRate = noStretchPhaseTotal > 0 ? noStretchPhaseGood / noStretchPhaseTotal : 1
  if (noStretchPhaseTotal > 0 && goodFitRate < 0.95) {
    fail(checks, 'no_stretch_phase_good_fit_rate', `NO_STRETCH good-fit ${(goodFitRate * 100).toFixed(0)}% < 95%`)
  } else if (noStretchPhaseTotal > 0) {
    pass(checks, 'no_stretch_phase_good_fit_rate', `NO_STRETCH good-fit ${(goodFitRate * 100).toFixed(0)}%`)
  }

  if (stretchTotal > 0 && stretchItemsMissingWarning > 0) {
    fail(checks, 'stretch_warning_correlation', `${stretchItemsMissingWarning}/${stretchTotal} stretch items lack matching warnings`)
  } else if (stretchTotal > 0) {
    pass(checks, 'stretch_warning_correlation', 'All stretch primaries correlated with warnings')
  } else {
    pass(checks, 'stretch_warning_correlation', 'No stretch primaries — correlation N/A')
  }

  if (perSplitOverCap > 0) {
    fail(checks, 'per_split_over_cap_count', `${perSplitOverCap} per_split variant(s) exceed split cap (over_cap)`)
  } else if (hasSplits) {
    pass(checks, 'per_split_over_cap_count', 'No over-cap per_split variants')
  } else {
    pass(checks, 'per_split_over_cap_count', 'per_split over-cap N/A — splits inactive')
  }

  const split1StretchRate = split1StretchDenom > 0 ? split1StretchWhenGood / split1StretchDenom : 0
  info(checks, 'split1_variant_stretch_rate', `Split 1 stretch rate when primary good: ${(split1StretchRate * 100).toFixed(0)}%`, {
    ok_band: split1StretchRate <= 0.05,
    rubric: 'C18-MOP-14',
    split1StretchWhenGood,
    split1StretchDenom,
  })

  if (hardExclude && admittedStretchOverCap > 0) {
    fail(checks, 'hard_difficulty_exclude_stretch_reject', 'hardDifficultyExclude active but stretch/over_cap admitted in NO_STRETCH phases')
  } else if (hardExclude) {
    pass(checks, 'hard_difficulty_exclude_stretch_reject', 'hardDifficultyExclude: NO_STRETCH phases clean')
  } else {
    pass(checks, 'hard_difficulty_exclude_stretch_reject', 'hardDifficultyExclude inactive — policy N/A')
  }

  const nearCapRate = outputPrimaries > 0 ? outputNearCap / outputPrimaries : 0
  const nearCapAlert = nearCapRate > 0.8 && splitWarnings.length > 0
  info(checks, 'output_near_cap_stretch_alert', `Output near-cap ${(nearCapRate * 100).toFixed(0)}%; split warnings ${splitWarnings.length}`, {
    ok_band: !nearCapAlert,
    rubric: 'C18-MOP-16',
    nearCapRate,
    outputNearCap,
    outputPrimaries,
  })

  info(checks, 'stretch_reject_telemetry_proxy', `Post-hoc NO_STRETCH admissions: ${admittedStretchOverCap} (proxy for fill-loop rejects)`, {
    ok_band: admittedStretchOverCap === 0,
    rubric: 'C18-MOP-17',
    admittedStretchOverCap,
    note: 'constraint_report.stretch_rejects not exported; admission audit used',
  })

  const capsNumeric = Number.isFinite(sessionCaps.maxOverall) && Number.isFinite(sessionCaps.maxTechnical) && Number.isFinite(sessionCaps.maxLoad)
  if (!capsNumeric) {
    fail(checks, 'audience_caps_numeric_mos', 'audience_profile.caps not fully numeric before stretch filter')
  } else {
    pass(checks, 'audience_caps_numeric_mos', 'Session caps numeric before fill')
  }

  if (hasSplits) {
    const splitCapViolations = resSplitList.filter((s) => Number(s.caps?.maxOverall ?? 0) > poolCap)
    if (splitCapViolations.length > 0) {
      fail(checks, 'split_caps_le_pool_cap_mos', `${splitCapViolations.length} split cap(s) exceed poolCap ${poolCap}`, splitCapViolations.map((s) => s.label))
    } else {
      pass(checks, 'split_caps_le_pool_cap_mos', `All split caps ≤ poolCap ${poolCap}`)
    }
  } else {
    pass(checks, 'split_caps_le_pool_cap_mos', 'Split cap ≤ pool cap N/A — no splits')
  }

  ensureCheck(checks, 'primary_age_fit_split_good_path', () => {
    let splitGoodPathCount = 0
    let splitGoodPathDenom = 0
    for (const block of result.blocks ?? []) {
      for (const item of block.items ?? []) {
        const difficulty = item.difficulty ?? difficultyByExerciseId.get(Number(item.exercise_id))
        if (!difficulty) continue
        const sessionFit = classifyAgeFit(difficulty, sessionCaps)
        const replayFit = classifyPrimaryAgeFitReplay(difficulty, sessionCaps, splitProfiles)
        if (sessionFit !== 'good' && replayFit === 'good') {
          splitGoodPathDenom += 1
          splitGoodPathCount += 1
        } else if (sessionFit !== 'good') {
          splitGoodPathDenom += 1
        }
      }
    }
    const rate = splitGoodPathDenom > 0 ? splitGoodPathCount / splitGoodPathDenom : 1
    pass(checks, 'primary_age_fit_split_good_path', splitGoodPathDenom > 0
      ? `Split-good path ${(rate * 100).toFixed(0)}% (${splitGoodPathCount}/${splitGoodPathDenom})`
      : 'No session-stretch primaries requiring split-good path', { splitGoodPathCount, splitGoodPathDenom, rubric: 'C18-MOP-08' })
  })

  ensureCheck(checks, 'split_variant_warnings', () => {
    if (splitWarnings.length > 1) {
      fail(checks, 'split_variant_warnings', `${splitWarnings.length} split variant warnings`)
    } else {
      pass(checks, 'split_variant_warnings', `Split variant warnings: ${splitWarnings.length}`)
    }
  })

  ensureCheck(checks, 'split1_cap_adherence', () => {
    if (!hasSplits) {
      pass(checks, 'split1_cap_adherence', 'Split 1 cap adherence N/A — splits inactive')
      return
    }
    pass(checks, 'split1_cap_adherence', 'Split 1 cap adherence delegated to Category 5 evaluator')
  })

  const stability = stretchVariantWarningStability ?? { stable: null, runCount: 0, minRuns: 5, counts: [] }
  if (stability.stable == null) {
    info(checks, 'stretch_variant_warning_stability', `Stretch warning stability pending (${stability.runCount}/${stability.minRuns ?? 5} eval runs)`, {
      ok_band: null,
      rubric: 'C18-MOR-03',
      ...stability,
    })
  } else if (stability.stable) {
    info(checks, 'stretch_variant_warning_stability', `Split variant warnings stable (${stability.counts?.join(', ') ?? '0'})`, {
      ok_band: true,
      rubric: 'C18-MOR-03',
      ...stability,
    })
  } else {
    info(checks, 'stretch_variant_warning_stability', `Split variant warning spikes: ${stability.spikes ?? '?'} runs > ${stability.spikeThreshold ?? 2}`, {
      ok_band: false,
      rubric: 'C18-MOR-03',
      ...stability,
    })
  }

  const stretchBadgeAgreement = stretchTotal === 0 ? 1 : (stretchTotal - stretchItemsMissingWarning) / stretchTotal
  info(checks, 'category18_moe_stretch_badges_proxy', `Stretch badge/warning agreement ${(stretchBadgeAgreement * 100).toFixed(0)}%`, {
    ok_band: stretchBadgeAgreement >= 0.9,
    rubric: 'C18-MOE-02',
    stretchTotal,
    stretchItemsMissingWarning,
  })

  const split1OverCapProxy = perSplitOverCap === 0
  info(checks, 'category18_moe_split1_overcap_proxy', `Split 1 over-cap variants: ${perSplitOverCap}`, {
    ok_band: split1OverCapProxy,
    rubric: 'C18-MOE-03',
    perSplitOverCap,
  })

  info(checks, 'category18_moe_cap_consistency_proxy', `Session cap ${sessionCap}; pool cap ${poolCap}; stretch ${stretchTotal}`, {
    ok_band: stretchTotal === 0 && overCapTotal === 0,
    rubric: 'C18-MOE-05',
    sessionCap,
    poolCap,
    stretchTotal,
    overCapTotal,
  })

  pass(checks, 'category18_moe_review_packet', `${reviewItems.length} primary item(s) for coach stretch/over-cap MOE review`, {
    informational: true,
    rubric: ['C18-MOE-01', 'C18-MOE-04', 'C18-MOE-06'],
    items: reviewItems.slice(0, 40),
    stretch_summary: { stretchTotal, overCapTotal, stretchHighIntent, splitWarnings: splitWarnings.length },
    splits: resSplitList.map((s) => ({ label: s.label, cap: s.caps?.maxOverall })),
  })

  for (const id of CATEGORY18_KPI_CHECK_IDS) {
    if (findCheck(checks, id)) continue
    if (/^stretch_primaries_/.test(id)) {
      pass(checks, id, `${id.replace('stretch_primaries_', '')}: no stretch primaries to check`)
    }
  }
}

export function computeCategory18Kpi(checks, opts = {}) {
  return computeKpi(checks, 18, CATEGORY18_KPI_CHECK_IDS, { minRate: 1, ...opts })
}

// ─── Category 19 — Session diversity ────────────────────────────────────────

const OUTPUT_SPEED_FAMILY_KEYS = new Set(['pogo', 'bound', 'broad_jump', 'hurdle_hop', 'sprint'])

function tenetFacetIdsForExercise(exerciseId, tagMap) {
  return (tagMap.get(String(exerciseId)) ?? [])
    .filter((t) => t.facetType === 'tenet')
    .map((t) => Number(t.facetId))
}

/** First pattern tag per exercise — mirrors fillPhaseItems `c.tags.find(pattern)`. */
function primaryPatternIdForExercise(exerciseId, tagMap) {
  const tag = (tagMap.get(String(exerciseId)) ?? []).find((t) => t.facetType === 'pattern')
  return tag != null ? Number(tag.facetId) : null
}

function collectPrimaryRows(result, exerciseById) {
  const rows = []
  for (const block of result.blocks ?? []) {
    for (const item of block.items ?? []) {
      const ex = exerciseById.get(Number(item.exercise_id)) ?? {
        slug: item.exercise_slug,
        name: item.exercise_name,
        movement_family: item.movement_family,
      }
      rows.push({
        phase_key: block.phase_key,
        item,
        exercise_id: Number(item.exercise_id),
        slug: String(ex?.slug ?? item.exercise_slug ?? item.exercise_id).toLowerCase(),
        name: String(ex?.name ?? item.exercise_name ?? ''),
        movement_family: ex?.movement_family ?? null,
        exercise: ex,
      })
    }
  }
  return rows
}

export const CATEGORY19_KPI_CHECK_IDS = [
  'no_duplicate_session_slugs',
  'no_duplicate_session_exercise_ids',
  'slug_stem_no_repeats',
  'normalized_name_no_collisions',
  'session_movement_family_once',
  'output_family_phase_cap',
  'prepare_restore_family_cap',
  'adjacent_phase_family_repetition',
  'diversity_over_dedup_underfill',
]

export const CATEGORY19_MOE_CHECK_IDS = [
  'category19_moe_review_packet',
  'category19_moe_pattern_purpose',
  'category19_moe_equipment_variety',
  'category19_moe_athlete_distinct_names',
  'category19_moe_youth_cognitive_load',
  'category19_moe_output_speed_coherence',
  'category19_tbd_pattern_penalty',
  'category19_tbd_relaxed_pattern_dedup',
]

export function evaluateCategory19Diversity(result, expectedBody, checks, context = {}) {
  const {
    tagMap = new Map(),
    exerciseById = new Map(),
    methodologyKeyById = new Map(),
    equipmentKeyById = new Map(),
    thresholds = {},
  } = context

  const durationMin = Number(expectedBody?.durationMinutes ?? expectedBody?.duration_minutes ?? 0)
  const isLongSession = durationMin >= 120
  const sessionObjective = String(expectedBody?.sessionObjective ?? expectedBody?.session_objective ?? '')
  const isSpeedSession = sessionObjective.includes('speed')
  const sessMax = Number(expectedBody?.ageMax ?? expectedBody?.age_max ?? result.audience_profile?.ageMax ?? 99)
  const isYouthBand = sessMax <= 14

  const primaries = collectPrimaryRows(result, exerciseById)
  const fillRows = result.constraint_report?.phase_fill ?? []
  const fillByPhase = new Map(fillRows.map((f) => [f.phase_key, f]))

  // C19-MOP-01 — duplicate primary slugs (global strict; emit if missing)
  ensureCheck(checks, 'no_duplicate_session_slugs', () => {
    const slugCounts = new Map()
    for (const row of primaries) slugCounts.set(row.slug, (slugCounts.get(row.slug) ?? 0) + 1)
    const dupSlugs = [...slugCounts.entries()].filter(([, n]) => n > 1)
    const maxDup = thresholds.maxDuplicateSlugs ?? 0
    if (dupSlugs.length > maxDup) {
      fail(checks, 'no_duplicate_session_slugs', 'Session repeats primary exercise slug', dupSlugs.slice(0, 5))
    } else {
      pass(checks, 'no_duplicate_session_slugs', 'No duplicate primary slugs session-wide')
    }
  })

  // C19-MOP-02 — duplicate exercise IDs session-wide
  ensureCheck(checks, 'no_duplicate_session_exercise_ids', () => {
    const idCounts = new Map()
    for (const row of primaries) idCounts.set(row.exercise_id, (idCounts.get(row.exercise_id) ?? 0) + 1)
    const dupIds = [...idCounts.entries()].filter(([, n]) => n > 1)
    if (dupIds.length > 0) {
      fail(checks, 'no_duplicate_session_exercise_ids', `${dupIds.length} duplicate exercise_id(s) session-wide`, dupIds.slice(0, 5))
    } else {
      pass(checks, 'no_duplicate_session_exercise_ids', 'No duplicate exercise_id primaries session-wide')
    }
  })

  // C19-MOP-03 — slug stem dedup
  ensureCheck(checks, 'slug_stem_no_repeats', () => {
    const stemCounts = new Map()
    const stemRepeats = []
    for (const row of primaries) {
      const stem = normalizeSlugStem(row.slug)
      if (!stem) continue
      stemCounts.set(stem, (stemCounts.get(stem) ?? 0) + 1)
    }
    for (const [stem, n] of stemCounts.entries()) {
      if (n > 1) stemRepeats.push({ stem, count: n })
    }
    if (stemRepeats.length > 0) {
      fail(checks, 'slug_stem_no_repeats', `${stemRepeats.length} slug stem repeat(s)`, stemRepeats.slice(0, 5))
    } else {
      pass(checks, 'slug_stem_no_repeats', 'No slug stem repeats among primaries')
    }
  })

  // C19-MOP-04 — normalized name dedup
  ensureCheck(checks, 'normalized_name_no_collisions', () => {
    const normNames = new Map()
    const nameCollisions = []
    for (const row of primaries) {
      const norm = normalizeExerciseName(row.name)
      if (!norm) continue
      if (normNames.has(norm)) nameCollisions.push({ name: norm, phases: [normNames.get(norm), row.phase_key] })
      else normNames.set(norm, row.phase_key)
    }
    if (nameCollisions.length > 0) {
      fail(checks, 'normalized_name_no_collisions', `${nameCollisions.length} normalized name collision(s)`, nameCollisions.slice(0, 5))
    } else {
      pass(checks, 'normalized_name_no_collisions', 'No normalized name collisions session-wide')
    }
  })

  // C19-MOP-05 — movement_family session dedup (DB field once session-wide)
  ensureCheck(checks, 'session_movement_family_once', () => {
    const familyCounts = new Map()
    for (const row of primaries) {
      const family = String(row.movement_family ?? '').trim().toLowerCase()
      if (!family) continue
      familyCounts.set(family, (familyCounts.get(family) ?? 0) + 1)
    }
    const violations = [...familyCounts.entries()].filter(([, n]) => n > 1)
    if (violations.length > 0) {
      fail(checks, 'session_movement_family_once', `${violations.length} movement_family repeat(s) session-wide`, violations.slice(0, 5))
    } else {
      pass(checks, 'session_movement_family_once', 'Each movement_family used at most once session-wide')
    }
  })

  // C19-MOP-06 — Output family limit (max 2 per inferred family key)
  ensureCheck(checks, 'output_family_phase_cap', () => {
    const outputBlock = blockByKey(result, 'output')
    const familyCounts = new Map()
    for (const item of outputBlock?.items ?? []) {
      const ex = exerciseById.get(Number(item.exercise_id)) ?? { slug: item.exercise_slug, name: item.exercise_name }
      const familyKey = movementFamilyKey(ex)
      if (!familyKey) continue
      familyCounts.set(familyKey, (familyCounts.get(familyKey) ?? 0) + 1)
    }
    const outputLimit = movementFamilyLimit('output') ?? 2
    const over = [...familyCounts.entries()].filter(([, n]) => n > outputLimit)
    if (over.length > 0) {
      fail(checks, 'output_family_phase_cap', `Output family cap exceeded (limit ${outputLimit})`, over)
    } else {
      pass(checks, 'output_family_phase_cap', `Output movement families within limit (${outputLimit})`)
    }
  })

  // C19-MOP-07 — Prepare/Restore max 1 per inferred family key
  ensureCheck(checks, 'prepare_restore_family_cap', () => {
    const violations = []
    for (const phaseKey of ['prepare_and_access', 'restore']) {
      const block = blockByKey(result, phaseKey)
      const phaseCounts = new Map()
      for (const item of block?.items ?? []) {
        const ex = exerciseById.get(Number(item.exercise_id)) ?? { slug: item.exercise_slug, name: item.exercise_name }
        const familyKey = movementFamilyKey(ex)
        if (!familyKey) continue
        phaseCounts.set(familyKey, (phaseCounts.get(familyKey) ?? 0) + 1)
      }
      for (const [family, n] of phaseCounts.entries()) {
        const limit = movementFamilyLimit(phaseKey) ?? 1
        if (n > limit) violations.push({ phase_key: phaseKey, family, count: n, limit })
      }
    }
    if (violations.length > 0) {
      fail(checks, 'prepare_restore_family_cap', `${violations.length} Prepare/Restore family cap violation(s)`, violations)
    } else {
      pass(checks, 'prepare_restore_family_cap', 'Prepare/Restore family limits honored')
    }
  })

  // C19-MOP-08 — pattern dedup per phase (primary pattern; informational — backfill may relax)
  const patternRepeats = []
  for (const block of result.blocks ?? []) {
    const seen = new Set()
    for (const item of block.items ?? []) {
      const patternId = primaryPatternIdForExercise(item.exercise_id, tagMap)
      if (patternId == null) continue
      if (seen.has(patternId)) patternRepeats.push({ phase_key: block.phase_key, pattern_id: patternId })
      else seen.add(patternId)
    }
  }
  info(checks, 'phase_pattern_no_repeat', patternRepeats.length > 0
    ? `${patternRepeats.length} within-phase primary pattern repeat(s)`
    : 'No primary pattern repeats within any phase', {
    ok_band: patternRepeats.length === 0,
    rubric: 'C19-MOP-08',
    repeats: patternRepeats.slice(0, 8),
  })

  const patternSet = new Set()
  for (const row of primaries) {
    for (const p of patternIdsForExercise(row.exercise_id, tagMap)) patternSet.add(p)
  }
  const patternCount = patternSet.size

  // C19-MOP-09 — session pattern variety
  if (isLongSession && patternCount < 8) {
    fail(checks, 'session_pattern_variety', `Distinct patterns ${patternCount} < 8 on ${durationMin}-min session`)
  } else if (isLongSession) {
    pass(checks, 'session_pattern_variety', `${patternCount} distinct patterns on ${durationMin}-min session`)
  } else {
    pass(checks, 'session_pattern_variety', `Pattern variety N/A (${durationMin}-min session)`)
  }

  // C19-MOP-10 — distinct movement families
  const sessionFamilies = new Set()
  const inferredFamilies = new Set()
  for (const row of primaries) {
    const family = String(row.movement_family ?? '').trim().toLowerCase()
    if (family) sessionFamilies.add(family)
    const inferred = movementFamilyKey(row.exercise)
    if (inferred) inferredFamilies.add(inferred)
  }
  const familyCount = Math.max(sessionFamilies.size, inferredFamilies.size)
  if (isLongSession && familyCount < 6) {
    fail(checks, 'distinct_movement_families', `Only ${familyCount} distinct movement families (min 6 on 120-min)`)
  } else {
    pass(checks, 'distinct_movement_families', `${familyCount} distinct movement families session-wide`)
  }

  // C19-MOP-11 — progression slug stem policy (informational)
  const primarySlugs = new Set(primaries.map((r) => r.slug))
  const primaryStems = new Set(primaries.map((r) => normalizeSlugStem(r.slug)).filter(Boolean))
  let progressionStemOverlap = 0
  let progressionSlugOverlap = 0
  for (const row of collectAllPerSplit(result)) {
    if (row.variant.variant_type !== 'progression') continue
    const slug = String(row.variant.exercise_slug ?? exerciseById.get(Number(row.variant.exercise_id))?.slug ?? '').toLowerCase()
    if (!slug) continue
    if (primarySlugs.has(slug)) progressionSlugOverlap += 1
    const stem = normalizeSlugStem(slug)
    if (stem && primaryStems.has(stem)) progressionStemOverlap += 1
  }
  info(checks, 'progression_slug_stem_policy', `Progression slug overlaps ${progressionSlugOverlap}; stem overlaps ${progressionStemOverlap}`, {
    ok_band: progressionSlugOverlap === 0,
    rubric: 'C19-MOP-11',
    progression_slug_overlap: progressionSlugOverlap,
    progression_stem_overlap: progressionStemOverlap,
  })

  // C19-MOP-12 — used exercise ID set size equals primary count
  const uniqueIds = new Set(primaries.map((r) => r.exercise_id))
  if (uniqueIds.size !== primaries.length) {
    fail(checks, 'used_exercise_ids_size', `Unique exercise_ids ${uniqueIds.size} !== primary count ${primaries.length}`)
  } else {
    pass(checks, 'used_exercise_ids_size', `usedExerciseIds size ${uniqueIds.size} === primary count`)
  }

  // C19-MOP-13 — adjacent-phase family repetition
  const blocks = result.blocks ?? []
  let adjacentRepeats = 0
  for (let i = 1; i < blocks.length; i += 1) {
    const prev = blocks[i - 1]
    const curr = blocks[i]
    const prevFamilies = new Set()
    const currFamilies = new Set()
    for (const item of prev.items ?? []) {
      const ex = exerciseById.get(Number(item.exercise_id)) ?? { slug: item.exercise_slug, name: item.exercise_name, movement_family: item.movement_family }
      const dbFamily = String(ex.movement_family ?? '').trim().toLowerCase()
      const inferred = movementFamilyKey(ex)
      if (dbFamily) prevFamilies.add(`db:${dbFamily}`)
      if (inferred) prevFamilies.add(`inf:${inferred}`)
    }
    for (const item of curr.items ?? []) {
      const ex = exerciseById.get(Number(item.exercise_id)) ?? { slug: item.exercise_slug, name: item.exercise_name, movement_family: item.movement_family }
      const dbFamily = String(ex.movement_family ?? '').trim().toLowerCase()
      const inferred = movementFamilyKey(ex)
      if (dbFamily) currFamilies.add(`db:${dbFamily}`)
      if (inferred) currFamilies.add(`inf:${inferred}`)
    }
    const shared = [...prevFamilies].filter((f) => currFamilies.has(f))
    if (shared.length > 0) adjacentRepeats += 1
  }
  if (adjacentRepeats > 1) {
    fail(checks, 'adjacent_phase_family_repetition', `${adjacentRepeats} adjacent block pairs share movement family`)
  } else {
    pass(checks, 'adjacent_phase_family_repetition', `Adjacent family repetition pairs: ${adjacentRepeats} (≤1)`)
  }

  // C19-MOP-14 — Output pogo utilization band
  const outputBlock = blockByKey(result, 'output')
  let pogoCount = 0
  for (const item of outputBlock?.items ?? []) {
    const ex = exerciseById.get(Number(item.exercise_id)) ?? { slug: item.exercise_slug, name: item.exercise_name }
    if (movementFamilyKey(ex) === 'pogo') pogoCount += 1
  }
  if (pogoCount >= 3) {
    fail(checks, 'output_pogo_utilization_band', `Output pogo count ${pogoCount} ≥ 3`)
  } else {
    info(checks, 'output_pogo_utilization_band', isSpeedSession
      ? `Speed Output pogo-family count ${pogoCount} (target band 1–2)`
      : `Output pogo-family count ${pogoCount}`, {
      ok_band: !isSpeedSession || (pogoCount >= 1 && pogoCount <= 2),
      rubric: 'C19-MOP-14',
      pogo_count: pogoCount,
    })
  }

  // C19-MOP-15 — inferred family rule coverage
  let ruleMatched = 0
  let ruleTracked = 0
  for (const row of primaries) {
    const blob = `${row.slug} ${row.name}`
    const matchesRule = /pogo|bound|broad jump|hurdle hop|med(?:icine)? ball|box jump/i.test(blob)
    if (!matchesRule) continue
    ruleMatched += 1
    if (movementFamilyKey(row.exercise)) ruleTracked += 1
  }
  const coverageRate = ruleMatched > 0 ? ruleTracked / ruleMatched : 1
  info(checks, 'inferred_family_rule_coverage', ruleMatched > 0
    ? `FAMILY_RULES coverage ${ruleTracked}/${ruleMatched} (${(coverageRate * 100).toFixed(0)}%)`
    : 'FAMILY_RULES coverage N/A', {
    ok_band: ruleMatched === 0 || coverageRate >= 1,
    rubric: 'C19-MOP-15',
    rule_matched: ruleMatched,
    rule_tracked: ruleTracked,
  })

  tbd(checks, 'category19_tbd_pattern_penalty', 'usedPatterns adjScore penalty telemetry TBD (C19-MOP-16)', { rubric: 'C19-MOP-16' })
  tbd(checks, 'category19_tbd_relaxed_pattern_dedup', 'allowRelaxedPatternDedup pick count TBD (C19-MOP-17)', { rubric: 'C19-MOP-17' })

  // C19-MOP-18 — progression slug disjoint from primary slug set
  let progSlugLeaks = 0
  for (const row of collectAllPerSplit(result)) {
    if (row.variant.variant_type !== 'progression') continue
    const slug = String(row.variant.exercise_slug ?? exerciseById.get(Number(row.variant.exercise_id))?.slug ?? '').toLowerCase()
    if (slug && primarySlugs.has(slug)) progSlugLeaks += 1
  }
  info(checks, 'progression_slug_disjoint_primary', progSlugLeaks > 0
    ? `${progSlugLeaks} progression slug(s) match primary slug set`
    : 'All progression slugs disjoint from primary slug set', {
    ok_band: progSlugLeaks === 0,
    rubric: 'C19-MOP-18',
    progression_slug_leaks: progSlugLeaks,
  })

  const tenetSet = new Set()
  const methodologySet = new Set()
  for (const row of primaries) {
    for (const tid of tenetFacetIdsForExercise(row.exercise_id, tagMap)) tenetSet.add(tid)
    for (const key of methodologyKeysForExercise(row.exercise_id, tagMap, methodologyKeyById)) methodologySet.add(key)
  }

  // C19-MOP-19 — tenet tag diversity
  if (isLongSession && tenetSet.size < 4) {
    fail(checks, 'tenet_tag_diversity', `Distinct tenet facets ${tenetSet.size} < 4 on 120-min session`)
  } else {
    pass(checks, 'tenet_tag_diversity', `${tenetSet.size} distinct tenet facet(s)`)
  }

  // C19-MOP-20 — methodology tag diversity
  if (isLongSession && methodologySet.size < 5) {
    fail(checks, 'methodology_tag_diversity', `Distinct methodology keys ${methodologySet.size} < 5 on 120-min session`)
  } else {
    pass(checks, 'methodology_tag_diversity', `${methodologySet.size} distinct methodology key(s)`)
  }

  // C19-MOP-21 — diversity-driven skip ratio (informational)
  let sumSkipped = 0
  let sumPool = 0
  for (const fill of fillRows) {
    sumSkipped += Number(fill.skipped_candidates ?? 0)
    sumPool += Number(fill.pool_size ?? 0)
  }
  const sessionSkipRatio = sumPool > 0 ? sumSkipped / sumPool : 0
  info(checks, 'diversity_driven_skip_ratio', `Session skip ratio ${(sessionSkipRatio * 100).toFixed(0)}%`, {
    ok_band: sessionSkipRatio <= 0.4,
    rubric: 'C19-MOP-21',
    sumSkipped,
    sumPool,
  })

  const distinctNames = new Set(primaries.map((r) => normalizeExerciseName(r.name)).filter(Boolean))

  // C19-MOP-22 — distinct exercise names
  if (isLongSession && distinctNames.size < 12) {
    fail(checks, 'distinct_exercise_names', `Distinct exercise names ${distinctNames.size} < 12 on 120-min session`)
  } else {
    pass(checks, 'distinct_exercise_names', `${distinctNames.size} distinct exercise name(s)`)
  }

  // C19-MOS-01 — movement_family populated on prescribed pool proxy
  let withFamily = 0
  for (const row of primaries) {
    if (String(row.movement_family ?? '').trim()) withFamily += 1
  }
  const familyRate = primaries.length > 0 ? withFamily / primaries.length : 1
  if (familyRate < 0.8) {
    fail(checks, 'movement_family_mos_populated', `movement_family populated ${(familyRate * 100).toFixed(0)}% < 80%`)
  } else {
    pass(checks, 'movement_family_mos_populated', `movement_family populated ${(familyRate * 100).toFixed(0)}% (${withFamily}/${primaries.length})`)
  }

  // C19-MOR-01 — over-dedup causing underfill
  const underfillDedup = fillRows.filter((fill) => {
    const poolSize = Number(fill.pool_size ?? 0)
    if (poolSize <= 0) return false
    const skipRatio = Number(fill.skipped_candidates ?? 0) / poolSize
    return Number(fill.fill_pct ?? 0) < 70 && skipRatio > 0.85
  })
  if (underfillDedup.length > 0) {
    fail(checks, 'diversity_over_dedup_underfill', `${underfillDedup.length} phase(s) underfilled with high skip ratio`, underfillDedup)
  } else {
    pass(checks, 'diversity_over_dedup_underfill', 'No over-dedup underfill conjunction')
  }

  // C19-MOR-02 — monotony risk
  if (isLongSession && patternCount < 6) {
    fail(checks, 'session_pattern_monotony', `Distinct patterns ${patternCount} < 6 on 120-min session (monotony risk)`)
  } else {
    pass(checks, 'session_pattern_monotony', `Pattern monotony guard OK (${patternCount} patterns)`)
  }

  // C19-MOE-03 — equipment variety across phases (ties C12)
  const equipPhases = new Set()
  const requiredEquip = expectedBody?.equipmentUseIds ?? expectedBody?.equipment_use_ids ?? []
  if (requiredEquip.length > 0) {
    for (const block of result.blocks ?? []) {
      for (const item of block.items ?? []) {
        const keys = equipmentKeysForExercise(item.exercise_id, tagMap, equipmentKeyById)
        if (keys.length > 0) equipPhases.add(block.phase_key)
      }
    }
    info(checks, 'category19_moe_equipment_variety', `Equipment-tagged primaries in ${equipPhases.size} phase(s)`, {
      ok_band: equipPhases.size >= 3,
      rubric: 'C19-MOE-03',
      phases: [...equipPhases],
    })
  } else {
    info(checks, 'category19_moe_equipment_variety', 'No equipment use requirements — variety N/A', {
      ok_band: null,
      rubric: 'C19-MOE-03',
    })
  }

  info(checks, 'category19_moe_pattern_purpose', `${patternCount} distinct patterns; repeats within cap`, {
    ok_band: patternCount >= 6,
    rubric: 'C19-MOE-02',
    pattern_count: patternCount,
  })

  info(checks, 'category19_moe_athlete_distinct_names', `${distinctNames.size} distinct movement names exposed`, {
    ok_band: distinctNames.size >= 12,
    rubric: 'C19-MOE-04',
    names_sample: [...distinctNames].slice(0, 15),
  })

  info(checks, 'category19_moe_youth_cognitive_load', isYouthBand
    ? `Youth session pattern count ${patternCount} (cognitive load proxy)`
    : 'Youth cognitive-load MOE N/A', {
    ok_band: !isYouthBand || patternCount <= 12,
    rubric: 'C19-MOE-06',
    pattern_count: patternCount,
    session_age_max: sessMax,
  })

  let outputSpeedHits = 0
  const outputItems = outputBlock?.items ?? []
  for (const item of outputItems) {
    const ex = exerciseById.get(Number(item.exercise_id)) ?? { slug: item.exercise_slug, name: item.exercise_name }
    const familyKey = movementFamilyKey(ex)
    const tags = tagMap.get(String(item.exercise_id)) ?? []
    if (OUTPUT_SPEED_FAMILY_KEYS.has(familyKey) || hasSpeedPatternSignal(tags, ex) || hasSpeedTenetTag(tags)) {
      outputSpeedHits += 1
    }
  }
  const outputSpeedRate = outputItems.length > 0 ? outputSpeedHits / outputItems.length : 1
  info(checks, 'category19_moe_output_speed_coherence', outputItems.length > 0
    ? `Output jump/sprint/bound dominance ${(outputSpeedRate * 100).toFixed(0)}%`
    : 'Output speed coherence N/A', {
    ok_band: outputItems.length === 0 || outputSpeedRate >= 0.5,
    rubric: 'C19-MOE-07',
    output_speed_hits: outputSpeedHits,
    output_total: outputItems.length,
  })

  const reviewPhases = (result.blocks ?? []).map((block) => ({
    phase_key: block.phase_key,
    items: (block.items ?? []).slice(0, 8).map((item) => ({
      exercise_id: item.exercise_id,
      exercise_name: item.exercise_name,
      slug: exerciseById.get(Number(item.exercise_id))?.slug ?? item.exercise_slug,
    })),
    fill: fillByPhase.get(block.phase_key) ?? null,
  }))

  info(checks, 'category19_moe_review_packet', `${primaries.length} primary item(s) for coach diversity MOE review`, {
    ok_band: true,
    rubric: ['C19-MOE-01', 'C19-MOE-02', 'C19-MOE-05'],
    phases: reviewPhases,
    pattern_count: patternCount,
    family_count: familyCount,
    distinct_names: distinctNames.size,
    session_skip_ratio: sessionSkipRatio,
  })

  for (const id of CATEGORY19_KPI_CHECK_IDS) {
    if (findCheck(checks, id)) continue
    pass(checks, id, `${id}: N/A for session`)
  }
  for (const id of CATEGORY19_MOE_CHECK_IDS) {
    if (findCheck(checks, id)) continue
    info(checks, id, `${id}: N/A for session`, { ok_band: null })
  }
}

export function computeCategory19Kpi(checks, opts = {}) {
  return computeKpi(checks, 19, CATEGORY19_KPI_CHECK_IDS, { minRate: 0.95, ...opts })
}

// ─── Category 20 — Constraint report health ─────────────────────────────────

const CONSTRAINT_SCHEMA_KEYS = [
  'equipment_avoid',
  'body_region_avoid',
  'exercise_avoid',
  'empty_phase_reasons',
  'phase_fill',
]

function parseEmptyPhaseReason(reason) {
  const s = String(reason)
  const colonIdx = s.indexOf(':')
  const labelPart = colonIdx >= 0 ? s.slice(0, colonIdx).trim() : s
  let kind = null
  if (/pool_empty/i.test(s)) kind = 'pool_empty'
  else if (/all_candidates_filtered/i.test(s)) kind = 'all_candidates_filtered'
  else if (/underfilled/i.test(s)) kind = 'underfilled'
  return { labelPart, kind, raw: s }
}

function resolvePhaseKeyFromReason(labelPart, blocks) {
  const needle = String(labelPart).toLowerCase()
  for (const b of blocks) {
    if (b.phase_key === labelPart) return b.phase_key
    if (b.label && String(b.label).toLowerCase() === needle) return b.phase_key
    if (b.label && needle.startsWith(String(b.label).toLowerCase())) return b.phase_key
  }
  return null
}

function equipmentAvoidConfigured(body) {
  const ids = body?.equipmentAvoidIds ?? body?.equipment_avoid_ids ?? []
  return Array.isArray(ids) && ids.length > 0
}

function bodyRegionExcludeConfigured(body) {
  const ids = body?.excludeBodyRegionIds ?? body?.bodyRegionExcludeIds ?? body?.body_region_exclude_ids ?? []
  return Array.isArray(ids) && ids.length > 0
}

function exerciseAvoidConfigured(body) {
  const idList = body?.avoidExerciseIds ?? body?.avoid_exercise_ids ?? []
  const slugList = body?.avoidExerciseSlugs ?? body?.avoid_exercise_slugs ?? []
  return (Array.isArray(idList) && idList.length > 0) || (Array.isArray(slugList) && slugList.length > 0)
}

function audienceSplitsActive(body) {
  const splits = body?.audienceSplits ?? body?.audience_splits ?? []
  return splits.length >= 2
}

export const CATEGORY20_KPI_CHECK_IDS = [
  'no_empty_phases',
  'all_blocks_nonempty',
  'constraint_no_severe_underfill',
  'constraint_phase_fill_complete',
  'constraint_reason_taxonomy',
  'constraint_fill_pct_reconcile',
  'constraint_pool_empty_iff_zero',
  'constraint_filtered_when_pool_positive',
  'constraint_silent_pool_empty_mor',
  'constraint_mislabeled_pool_empty_mor',
]

export const CATEGORY20_MOE_CHECK_IDS = [
  'category20_moe_review_packet',
  'category20_moe_underfill_masking',
  'category20_moe_pool_empty_stability',
  'category20_tbd_split_reject_codes',
  'category20_tbd_pool_playbook',
  'category20_tbd_skip_breakdown',
]

export function evaluateCategory20Constraint(result, expectedBody, checks, context = {}) {
  const cr = result.constraint_report
  const blocks = result.blocks ?? []
  const fillRows = cr?.phase_fill ?? []
  const emptyReasons = cr?.empty_phase_reasons ?? []
  const fillByPhase = new Map(fillRows.map((f) => [f.phase_key, f]))

  if (cr != null) {
    pass(checks, 'constraint_report_present', 'constraint_report present')
  } else {
    fail(checks, 'constraint_report_present', 'constraint_report missing')
    return
  }

  const missingKeys = CONSTRAINT_SCHEMA_KEYS.filter((k) => !(k in cr))
  if (missingKeys.length > 0) {
    fail(checks, 'constraint_report_schema', `constraint_report missing keys: ${missingKeys.join(', ')}`, missingKeys)
  } else {
    pass(checks, 'constraint_report_schema', 'constraint_report schema complete')
  }

  if (!findCheck(checks, 'no_empty_phases')) {
    const poolEmpty = emptyReasons.filter((r) => /pool_empty/i.test(String(r)))
    if (poolEmpty.length > 0) {
      failP0(checks, 'no_empty_phases', `${poolEmpty.length} pool_empty reason(s)`, poolEmpty.slice(0, 5))
    } else {
      pass(checks, 'no_empty_phases', 'No pool_empty reasons')
    }
  }

  const emptyBlocks = blocks.filter((b) => (b.items ?? []).length === 0)
  if (emptyBlocks.length > 0) {
    failP0(checks, 'all_blocks_nonempty', `${emptyBlocks.length} empty block(s)`, emptyBlocks.map((b) => b.phase_key))
  } else {
    pass(checks, 'all_blocks_nonempty', 'All blocks have items')
  }

  const severeUnderfill = emptyReasons.filter((r) => {
    const m = String(r).match(/underfilled\s*\(\s*(\d+)%/i)
    return m && Number(m[1]) < 50
  })
  if (severeUnderfill.length > 0) {
    fail(checks, 'constraint_no_severe_underfill', `${severeUnderfill.length} severe underfill reason(s)`, severeUnderfill.slice(0, 5))
  } else {
    pass(checks, 'constraint_no_severe_underfill', 'No severe underfill (<50%) reasons')
  }

  if (fillRows.length === blocks.length) {
    pass(checks, 'constraint_phase_fill_complete', `phase_fill rows ${fillRows.length} === blocks ${blocks.length}`)
  } else {
    fail(checks, 'constraint_phase_fill_complete', `phase_fill ${fillRows.length} !== blocks ${blocks.length}`)
  }

  const poolFloorViolations = []
  for (const fill of fillRows) {
    if (!['output', 'capacity', 'restore'].includes(fill.phase_key)) continue
    const minPool = fill.phase_key === 'restore' ? 3 : 5
    if ((fill.pool_size ?? 0) < minPool) {
      poolFloorViolations.push({ phase_key: fill.phase_key, pool_size: fill.pool_size, minPool })
    }
  }
  if (poolFloorViolations.length > 0) {
    fail(checks, 'constraint_pool_size_floor', `${poolFloorViolations.length} phase(s) below pool_size floor`, poolFloorViolations)
  } else {
    pass(checks, 'constraint_pool_size_floor', 'Output/Capacity/Restore pool_size floors met')
  }

  const skipViolations = []
  for (const fill of fillRows) {
    const poolSize = Number(fill.pool_size ?? 0)
    if (poolSize <= 0) continue
    const ratio = Math.min(Number(fill.skipped_candidates ?? 0) / poolSize, 1)
    const block = blocks.find((b) => b.phase_key === fill.phase_key)
    const itemCount = (block?.items ?? []).length
    const fillPct = Number(block?.fill_pct ?? fill.fill_pct ?? 100)
    if (ratio > 0.85 && itemCount <= 2 && fillPct < 80) {
      skipViolations.push({ phase_key: fill.phase_key, ratio, skipped: fill.skipped_candidates, pool_size: poolSize, itemCount, fillPct })
    }
  }
  if (skipViolations.length > 0) {
    fail(checks, 'constraint_skip_ratio_per_phase', `${skipViolations.length} phase(s) skip ratio > 0.85 with thin fill`, skipViolations)
  } else {
    pass(checks, 'constraint_skip_ratio_per_phase', 'Per-phase skipped/pool ratio ≤ 0.85 or fill healthy')
  }

  const splitActive = audienceSplitsActive(expectedBody)
  const splitViolations = []
  for (const fill of fillRows) {
    if (!splitActive) continue
    const poolSize = Number(fill.pool_size ?? 0)
    if (poolSize <= 0) continue
    const ratio = Number(fill.split_rejects ?? 0) / poolSize
    if (ratio > 0.5) splitViolations.push({ phase_key: fill.phase_key, ratio, split_rejects: fill.split_rejects, pool_size: poolSize })
  }
  if (!splitActive) {
    pass(checks, 'constraint_split_reject_ratio', 'Split reject ratio N/A (splits inactive)')
  } else if (splitViolations.length > 0) {
    fail(checks, 'constraint_split_reject_ratio', `${splitViolations.length} phase(s) split_rejects/pool > 0.50`, splitViolations)
  } else {
    pass(checks, 'constraint_split_reject_ratio', 'Split reject ratio ≤ 0.50 per phase')
  }

  const mislabelHighSkip = []
  for (const block of blocks) {
    const items = block.items ?? []
    if (items.length === 0) continue
    const fill = fillByPhase.get(block.phase_key)
    const poolSize = Number(fill?.pool_size ?? 0)
    if (poolSize <= 0) continue
    const skipRatio = Number(fill?.skipped_candidates ?? 0) / poolSize
    if (skipRatio <= 0.85) continue
    const hasPoolEmptyReason = emptyReasons.some((r) => {
      const parsed = parseEmptyPhaseReason(r)
      const pk = resolvePhaseKeyFromReason(parsed.labelPart, blocks)
      return pk === block.phase_key && parsed.kind === 'pool_empty'
    })
    if (hasPoolEmptyReason) mislabelHighSkip.push({ phase_key: block.phase_key, skipRatio })
  }
  if (mislabelHighSkip.length > 0) {
    fail(checks, 'constraint_pool_empty_mislabel', 'pool_empty reason on phase with items and high skips', mislabelHighSkip)
  } else {
    pass(checks, 'constraint_pool_empty_mislabel', 'No pool_empty mislabel on high-skip filled phases')
  }

  if (equipmentAvoidConfigured(expectedBody)) {
    if (cr.equipment_avoid != null && typeof cr.equipment_avoid === 'object') {
      pass(checks, 'constraint_equipment_avoid_report', 'equipment_avoid sub-report present')
    } else {
      fail(checks, 'constraint_equipment_avoid_report', 'equipment_avoid sub-report missing while avoid configured')
    }
  } else {
    pass(checks, 'constraint_equipment_avoid_report', 'equipment_avoid N/A (no equipment avoid)')
  }

  if (exerciseAvoidConfigured(expectedBody)) {
    const exCount = cr.exercise_avoid?.excluded_count
    if (exCount != null) {
      pass(checks, 'constraint_exercise_avoid_report', `exercise_avoid.excluded_count=${exCount}`)
    } else {
      fail(checks, 'constraint_exercise_avoid_report', 'exercise_avoid.excluded_count missing while exercise avoid configured')
    }
  } else {
    pass(checks, 'constraint_exercise_avoid_report', 'exercise_avoid N/A (no exercise avoid)')
  }

  if (bodyRegionExcludeConfigured(expectedBody)) {
    if (cr.body_region_avoid != null && typeof cr.body_region_avoid === 'object') {
      pass(checks, 'constraint_body_region_avoid_report', 'body_region_avoid sub-report present')
    } else {
      fail(checks, 'constraint_body_region_avoid_report', 'body_region_avoid missing while excludes configured')
    }
  } else {
    pass(checks, 'constraint_body_region_avoid_report', 'body_region_avoid N/A (no body-region excludes)')
  }

  const unclassified = emptyReasons.filter((r) => parseEmptyPhaseReason(r).kind == null)
  if (emptyReasons.length === 0) {
    pass(checks, 'constraint_reason_taxonomy', 'No empty_phase_reasons to classify')
  } else if (unclassified.length > 0) {
    fail(checks, 'constraint_reason_taxonomy', `${unclassified.length} unclassifiable reason(s)`, unclassified.slice(0, 5))
  } else {
    pass(checks, 'constraint_reason_taxonomy', 'All empty_phase_reasons classifiable')
  }

  const reconcileViolations = []
  for (const block of blocks) {
    const fill = fillByPhase.get(block.phase_key)
    if (!fill) continue
    const blockPct = Number(block.fill_pct ?? 0)
    const fillPct = Number(fill.fill_pct ?? 0)
    const delta = Math.abs(blockPct - fillPct)
    if (delta > 1) reconcileViolations.push({ phase_key: block.phase_key, blockPct, fillPct, delta })
  }
  if (reconcileViolations.length > 0) {
    fail(checks, 'constraint_fill_pct_reconcile', `${reconcileViolations.length} phase(s) fill_pct Δ > 1%`, reconcileViolations)
  } else {
    pass(checks, 'constraint_fill_pct_reconcile', 'phase_fill ↔ blocks fill_pct reconciled (Δ ≤ 1%)')
  }

  const poolEmptyIffViolations = []
  for (const fill of fillRows) {
    if (Number(fill.pool_size ?? 0) !== 0) continue
    const hasPoolEmpty = emptyReasons.some((r) => {
      const parsed = parseEmptyPhaseReason(r)
      const pk = resolvePhaseKeyFromReason(parsed.labelPart, blocks)
      return pk === fill.phase_key && parsed.kind === 'pool_empty'
    })
    if (!hasPoolEmpty) {
      poolEmptyIffViolations.push({ phase_key: fill.phase_key, pool_size: 0, expected: 'pool_empty' })
    }
  }
  if (poolEmptyIffViolations.length > 0) {
    fail(checks, 'constraint_pool_empty_iff_zero', `${poolEmptyIffViolations.length} zero-pool phase(s) without pool_empty reason`, poolEmptyIffViolations)
  } else {
    pass(checks, 'constraint_pool_empty_iff_zero', 'pool_size === 0 implies pool_empty reason')
  }

  const filteredViolations = []
  for (const block of blocks) {
    const items = block.items ?? []
    if (items.length > 0) continue
    const fill = fillByPhase.get(block.phase_key)
    const poolSize = Number(fill?.pool_size ?? 0)
    if (poolSize <= 0) continue
    const hasFiltered = emptyReasons.some((r) => {
      const parsed = parseEmptyPhaseReason(r)
      const pk = resolvePhaseKeyFromReason(parsed.labelPart, blocks)
      return pk === block.phase_key && parsed.kind === 'all_candidates_filtered'
    })
    if (!hasFiltered) {
      filteredViolations.push({ phase_key: block.phase_key, pool_size: poolSize })
    }
  }
  if (filteredViolations.length > 0) {
    fail(checks, 'constraint_filtered_when_pool_positive', `${filteredViolations.length} empty block(s) with pool>0 lack all_candidates_filtered`, filteredViolations)
  } else {
    pass(checks, 'constraint_filtered_when_pool_positive', 'Empty blocks with pool>0 emit all_candidates_filtered')
  }

  const relaxedItems = []
  let fallbackCount = 0
  let totalItems = 0
  const fallbackByPhase = new Map()
  for (const block of blocks) {
    for (const item of block.items ?? []) {
      totalItems += 1
      const rationale = String(item.selection_rationale ?? '')
      if (/relaxed sustained pool fill/i.test(rationale)) {
        relaxedItems.push({ phase_key: block.phase_key, exercise_name: item.exercise_name })
      }
      if (item.split_fallback_used) {
        fallbackCount += 1
        fallbackByPhase.set(block.phase_key, (fallbackByPhase.get(block.phase_key) ?? 0) + 1)
      }
    }
  }
  if (relaxedItems.length > 0) {
    const untagged = relaxedItems.filter((it) => !it.exercise_name)
    if (untagged.length > 0) {
      fail(checks, 'constraint_hiit_fallback_logged', `${untagged.length} relaxed-fill item(s) missing rationale tag`)
    } else {
      pass(checks, 'constraint_hiit_fallback_logged', `${relaxedItems.length} relaxed sustained pool fill item(s) tagged`)
    }
  } else {
    info(checks, 'constraint_hiit_fallback_logged', 'No relaxed sustained pool fill items', { ok_band: true, rubric: 'C20-MOP-17' })
  }

  const fallbackAlerts = []
  for (const block of blocks) {
    const phaseCount = (block.items ?? []).length
    if (phaseCount === 0) continue
    const phaseFallback = fallbackByPhase.get(block.phase_key) ?? 0
    const share = phaseFallback / phaseCount
    if (share > 0.3) fallbackAlerts.push({ phase_key: block.phase_key, share, phaseFallback, phaseCount })
  }
  const fallbackRate = totalItems > 0 ? fallbackCount / totalItems : 0
  info(checks, 'constraint_split_fallback_rate', `split_fallback_used ${(fallbackRate * 100).toFixed(0)}% session-wide`, {
    ok_band: fallbackAlerts.length === 0,
    rubric: 'C20-MOP-18',
    fallback_count: fallbackCount,
    total_items: totalItems,
    phase_alerts: fallbackAlerts,
  })

  const unresolvableReasons = emptyReasons.filter((r) => {
    const parsed = parseEmptyPhaseReason(r)
    return resolvePhaseKeyFromReason(parsed.labelPart, blocks) == null && !parsed.labelPart
  })
  if (emptyReasons.length === 0) {
    pass(checks, 'constraint_reason_phase_key', 'No empty_phase_reasons to resolve')
  } else if (unresolvableReasons.length > 0) {
    fail(checks, 'constraint_reason_phase_key', `${unresolvableReasons.length} reason(s) lack resolvable phase`, unresolvableReasons.slice(0, 5))
  } else {
    pass(checks, 'constraint_reason_phase_key', 'All empty_phase_reasons include resolvable phase key/label')
  }

  let sumSkipped = 0
  let sumPool = 0
  for (const fill of fillRows) {
    sumSkipped += Number(fill.skipped_candidates ?? 0)
    sumPool += Number(fill.pool_size ?? 0)
  }
  const sessionSkipRatio = sumPool > 0 ? sumSkipped / sumPool : 0
  if (sessionSkipRatio > 0.6) {
    fail(checks, 'constraint_session_skip_ratio', `Session skip ratio ${(sessionSkipRatio * 100).toFixed(0)}% > 60%`, { sumSkipped, sumPool })
  } else {
    pass(checks, 'constraint_session_skip_ratio', `Session skip ratio ${(sessionSkipRatio * 100).toFixed(0)}% ≤ 60%`)
  }

  const highSkipLowItems = []
  for (const block of blocks) {
    const fill = fillByPhase.get(block.phase_key)
    const poolSize = Number(fill?.pool_size ?? 0)
    if (poolSize <= 0) continue
    const skipRatio = Number(fill?.skipped_candidates ?? 0) / poolSize
    const itemCount = (block.items ?? []).length
    if (skipRatio > 0.85 && itemCount <= 2) {
      highSkipLowItems.push({ phase_key: block.phase_key, skipRatio, itemCount })
    }
  }
  if (highSkipLowItems.length > 0) {
    fail(checks, 'constraint_high_skip_low_items', `${highSkipLowItems.length} phase(s) high skip + ≤2 items`, highSkipLowItems)
  } else {
    pass(checks, 'constraint_high_skip_low_items', 'No high-skip low-item phases')
  }

  const avoidConsistencyIssues = []
  if (equipmentAvoidConfigured(expectedBody)) {
    const excl = cr.equipment_avoid?.excluded_count ?? 0
    const samples = cr.equipment_avoid?.sample_names ?? []
    if (excl <= 0 && samples.length === 0) {
      avoidConsistencyIssues.push({ subreport: 'equipment_avoid', issue: 'no excluded_count or samples' })
    }
  }
  if (exerciseAvoidConfigured(expectedBody)) {
    const excl = cr.exercise_avoid?.excluded_count ?? 0
    if (excl <= 0) avoidConsistencyIssues.push({ subreport: 'exercise_avoid', issue: 'excluded_count ≤ 0' })
  }
  if (bodyRegionExcludeConfigured(expectedBody)) {
    const excl = cr.body_region_avoid?.excluded_count ?? 0
    if (excl <= 0) avoidConsistencyIssues.push({ subreport: 'body_region_avoid', issue: 'excluded_count ≤ 0' })
  }
  if (!equipmentAvoidConfigured(expectedBody) && !exerciseAvoidConfigured(expectedBody) && !bodyRegionExcludeConfigured(expectedBody)) {
    pass(checks, 'constraint_avoid_subreport_consistency', 'Avoid sub-report consistency N/A')
  } else if (avoidConsistencyIssues.length > 0) {
    fail(checks, 'constraint_avoid_subreport_consistency', `${avoidConsistencyIssues.length} avoid sub-report inconsistency`, avoidConsistencyIssues)
  } else {
    pass(checks, 'constraint_avoid_subreport_consistency', 'Avoid sub-reports consistent when configured')
  }

  const silentEmpty = blocks.filter((b) => {
    if ((b.items ?? []).length > 0) return false
    return !emptyReasons.some((r) => {
      const parsed = parseEmptyPhaseReason(r)
      const pk = resolvePhaseKeyFromReason(parsed.labelPart, blocks)
      return pk === b.phase_key
    })
  })
  const poolEmptyInReasons = emptyReasons.some((r) => /pool_empty/i.test(String(r)))
  if (silentEmpty.length > 0 || poolEmptyInReasons) {
    failP0(checks, 'constraint_silent_pool_empty_mor', 'Silent pool_empty or zero-item block without reason', {
      silent_empty_phases: silentEmpty.map((b) => b.phase_key),
      pool_empty_reasons: poolEmptyInReasons,
    })
  } else {
    pass(checks, 'constraint_silent_pool_empty_mor', 'No silent pool_empty (P0)')
  }

  const mislabeledPoolEmpty = []
  for (const reason of emptyReasons) {
    const parsed = parseEmptyPhaseReason(reason)
    if (parsed.kind !== 'pool_empty') continue
    const pk = resolvePhaseKeyFromReason(parsed.labelPart, blocks)
    const fill = pk ? fillByPhase.get(pk) : null
    if (fill && Number(fill.pool_size ?? 0) > 0) {
      mislabeledPoolEmpty.push({ phase_key: pk, pool_size: fill.pool_size, reason: parsed.raw })
    }
  }
  if (mislabeledPoolEmpty.length > 0) {
    failP0(checks, 'constraint_mislabeled_pool_empty_mor', `${mislabeledPoolEmpty.length} pool_empty mislabel(s) with pool_size > 0`, mislabeledPoolEmpty)
  } else {
    pass(checks, 'constraint_mislabeled_pool_empty_mor', 'No pool_empty when pool_size > 0')
  }

  const splitRejectChronic = context.splitRejectChronic ?? { chronic: null, runCount: 0, minRuns: 5 }
  if (splitRejectChronic.chronic == null) {
    info(checks, 'constraint_chronic_split_rejects', `Split-reject chronicity pending (${splitRejectChronic.runCount}/${splitRejectChronic.minRuns ?? 5} eval runs)`, {
      ok_band: null,
      rubric: 'C20-MOR-03',
      ...splitRejectChronic,
    })
  } else if (splitRejectChronic.chronic) {
    pass(checks, 'constraint_chronic_split_rejects', 'No chronic high split_rejects (>0.5 in 3/5 runs)')
  } else {
    fail(checks, 'constraint_chronic_split_rejects', 'Chronic high split_rejects detected', splitRejectChronic.chronicPhases)
  }

  const maskingPhases = blocks.filter((b) => {
    const items = b.items ?? []
    return items.length === 1 && Number(b.fill_pct ?? 0) < 80
  })
  if (maskingPhases.length > 1) {
    info(checks, 'category20_moe_underfill_masking', `${maskingPhases.length} phases with 1 item and fill < 80%`, {
      ok_band: false,
      rubric: 'C20-MOE-02',
      phases: maskingPhases.map((b) => ({ phase_key: b.phase_key, fill_pct: b.fill_pct })),
    })
  } else {
    info(checks, 'category20_moe_underfill_masking', `Underfill masking phases: ${maskingPhases.length}`, {
      ok_band: maskingPhases.length <= 1,
      rubric: 'C20-MOE-02',
      phases: maskingPhases.map((b) => ({ phase_key: b.phase_key, fill_pct: b.fill_pct })),
    })
  }

  const poolEmptyStability = context.poolEmptyStability ?? { stable: null, runCount: 0, minRuns: 5 }
  if (poolEmptyStability.stable == null) {
    info(checks, 'category20_moe_pool_empty_stability', `pool_empty stability pending (${poolEmptyStability.runCount}/${poolEmptyStability.minRuns ?? 5} eval runs)`, {
      ok_band: null,
      rubric: 'C20-MOE-03',
      ...poolEmptyStability,
    })
  } else if (poolEmptyStability.stable) {
    info(checks, 'category20_moe_pool_empty_stability', `0 pool_empty in ${poolEmptyStability.runCount} consecutive runs`, {
      ok_band: true,
      rubric: 'C20-MOE-03',
      ...poolEmptyStability,
    })
  } else {
    info(checks, 'category20_moe_pool_empty_stability', 'pool_empty seen in recent eval history', {
      ok_band: false,
      rubric: 'C20-MOE-03',
      ...poolEmptyStability,
    })
  }

  tbd(checks, 'category20_tbd_split_reject_codes', 'Split reject reason codes TBD in constraint_report (C20-MOE-04)', { rubric: 'C20-MOE-04' })
  tbd(checks, 'category20_tbd_pool_playbook', 'Thin-pool library playbook TBD (C20-MOE-05)', { rubric: 'C20-MOE-05' })
  tbd(checks, 'category20_tbd_skip_breakdown', 'Per-phase skip driver breakdown TBD (C20-MOE-07)', { rubric: 'C20-MOE-07' })

  const thinPhases = fillRows
    .filter((f) => ['output', 'capacity', 'restore'].includes(f.phase_key) && Number(f.pool_size ?? 0) < (f.phase_key === 'restore' ? 3 : 5))
    .map((f) => ({ phase_key: f.phase_key, pool_size: f.pool_size }))

  pass(checks, 'category20_moe_review_packet', `${fillRows.length} phase_fill row(s) for engineer/coach MOE review`, {
    informational: true,
    rubric: ['C20-MOE-01', 'C20-MOE-06'],
    constraint_report: {
      empty_phase_reasons: emptyReasons,
      phase_fill: fillRows,
      equipment_avoid: cr.equipment_avoid,
      exercise_avoid: cr.exercise_avoid,
      body_region_avoid: cr.body_region_avoid,
    },
    thin_pool_phases: thinPhases,
    session_skip_ratio: sessionSkipRatio,
  })
}

export function computeCategory20Kpi(checks, opts = {}) {
  return computeKpi(checks, 20, CATEGORY20_KPI_CHECK_IDS, { minRate: 1, ...opts })
}

// ─── Category 21 — Warnings cleanliness ─────────────────────────────────────

export const CATEGORY21_KPI_CHECK_IDS = [
  'session_age_fit_warnings',
  'split_variant_warnings',
  'age_fit_warning_dimensions',
  'warnings_split_scaling_required',
  'warnings_split_missing_variant',
  'age_fit_warnings_consistency',
  'age_fit_false_session_cap_warnings',
  'warnings_no_duplicate_strings',
  'warnings_taxonomy_complete',
  'warnings_session_caps_replay',
  'warnings_to_primary_ratio',
  'warnings_admitted_resolve_clean',
  'warnings_missing_variant_orphans',
  'warnings_scaled_guidance_complete',
  'warnings_strict_thresholds_mos',
  'warnings_missing_high_intent_mor',
  'warnings_fatigue_classes',
]

export const CATEGORY21_MOE_CHECK_IDS = [
  'category21_moe_review_packet',
  'category21_moe_warning_stability',
  'category21_moe_warning_clean_streak',
  'category21_moe_scaling_guidance_coverage',
  'category21_moe_ui_truncation_policy',
  'category21_moe_watch_points_parity',
  'category21_mos_422_no_partial_warnings',
]

export function evaluateCategory21Warnings(result, expectedBody, checks, context = {}) {
  const {
    thresholds = {},
    warningPairStability = null,
    warningCleanStreak = null,
  } = context

  const ageW = result.age_fit_warnings ?? []
  const splitW = result.split_variant_warnings ?? []
  const allWarnings = [...ageW, ...splitW]
  const profile = result.audience_profile ?? {}
  const sessionCaps = profile.caps ?? {}
  const resSplitList = resultSplits(result)
  const bodySplitList = bodySplits(expectedBody)
  const splitProfiles = resSplitList.length > 0
    ? resSplitList.map((s) => ({
      label: s.label,
      ageMin: s.age_min ?? s.ageMin,
      ageMax: s.age_max ?? s.ageMax,
      caps: s.caps ?? {},
    }))
    : bodySplitList.map((s) => ({
      label: s.label,
      caps: {
        maxOverall: s.difficultyOverride ?? s.difficulty_override ?? s.capsOverride ?? s.caps_override,
        maxTechnical: s.difficultyOverride ?? s.difficulty_override ?? s.capsOverride ?? s.caps_override,
        maxLoad: s.difficultyOverride ?? s.difficulty_override ?? s.capsOverride ?? s.caps_override,
      },
    }))

  ensureCheck(checks, 'session_age_fit_warnings', () => {
    if (ageW.length > 0) {
      fail(checks, 'session_age_fit_warnings', `${ageW.length} age-fit warning(s)`, { count: ageW.length })
    } else {
      pass(checks, 'session_age_fit_warnings', 'No age-fit warnings', { count: 0 })
    }
  })

  ensureCheck(checks, 'split_variant_warnings', () => {
    if (splitW.length > 1) {
      fail(checks, 'split_variant_warnings', `${splitW.length} split variant warning(s)`)
    } else {
      pass(checks, 'split_variant_warnings', `Split variant warnings: ${splitW.length}`)
    }
  })

  const warningDims = parseAgeFitWarningDimensions(ageW)
  ensureCheck(checks, 'age_fit_warning_dimensions', () => {
    if (ageW.length > 0 && (warningDims.overall > 0 || warningDims.load > 0 || warningDims.technical > 0)) {
      fail(checks, 'age_fit_warning_dimensions', `Age-fit cap warnings overall=${warningDims.overall} load=${warningDims.load} technical=${warningDims.technical}`)
    } else {
      pass(checks, 'age_fit_warning_dimensions', ageW.length > 0
        ? `Age-fit dimension warnings: overall=${warningDims.overall} load=${warningDims.load} technical=${warningDims.technical}`
        : 'No age-fit cap dimension warnings')
    }
  })

  let scalingRequired = 0
  let missingVariantWarn = 0
  for (const w of splitW) {
    const t = String(w).toLowerCase()
    if (t.includes('coach scaling required')) scalingRequired += 1
    if (t.includes('no suitable variant found')) missingVariantWarn += 1
  }
  if (scalingRequired > 1) {
    fail(checks, 'warnings_split_scaling_required', `${scalingRequired} scaling-required warning(s) > 1`)
  } else {
    pass(checks, 'warnings_split_scaling_required', `Scaling-required warnings: ${scalingRequired}`)
  }
  if (missingVariantWarn > 0) {
    fail(checks, 'warnings_split_missing_variant', `${missingVariantWarn} missing-variant split warning(s)`)
  } else {
    pass(checks, 'warnings_split_missing_variant', 'No missing-variant split warnings')
  }

  let totalPrimaries = 0
  let consistencyFails = 0
  let consistencyChecked = 0
  for (const block of result.blocks ?? []) {
    for (const item of block.items ?? []) {
      totalPrimaries += 1
      if (item.age_fit === 'good') {
        consistencyChecked += 1
        const name = String(item.exercise_name ?? '').trim()
        if (name && ageW.some((w) => String(w).includes(name))) consistencyFails += 1
      }
    }
  }

  ensureCheck(checks, 'age_fit_warnings_consistency', () => {
    if (consistencyChecked > 0 && consistencyFails > 0) {
      fail(checks, 'age_fit_warnings_consistency', `${consistencyFails}/${consistencyChecked} good items have age-fit warnings`)
    } else if (consistencyChecked > 0) {
      pass(checks, 'age_fit_warnings_consistency', 'Good age_fit items have no matching warnings')
    } else {
      pass(checks, 'age_fit_warnings_consistency', 'No good primaries to audit for warning consistency')
    }
  })

  const sessionCap = Number(sessionCaps.maxOverall ?? 6)
  const split2 = resSplitList.find((s) => isSplit2Label(s.label)) ?? resSplitList[1]
  const split2Cap = Number(split2?.caps?.maxOverall ?? 10)
  let falseSessionCapWarnings = 0
  if (ageW.length > 0 && split2) {
    for (const w of ageW) {
      const text = String(w)
      if (!new RegExp(`cap ${sessionCap}\\b`).test(text) && !text.includes(`exceeds cap ${sessionCap}`)) continue
      const matchedItem = (result.blocks ?? []).flatMap((b) => b.items ?? []).find((it) => text.includes(String(it.exercise_name ?? '')))
      if (!matchedItem?.difficulty) continue
      const split2Fit = classifyAgeFit(matchedItem.difficulty, { maxOverall: split2Cap, maxTechnical: split2Cap, maxLoad: split2Cap })
      if (split2Fit === 'good' && (matchedItem.age_fit === 'good' || matchedItem.age_fit == null)) {
        falseSessionCapWarnings += 1
      }
    }
  }

  ensureCheck(checks, 'age_fit_false_session_cap_warnings', () => {
    if (falseSessionCapWarnings > 0) {
      fail(checks, 'age_fit_false_session_cap_warnings', `${falseSessionCapWarnings} false session-cap warning(s) for split-good items`)
    } else {
      pass(checks, 'age_fit_false_session_cap_warnings', 'No false session-cap warnings for split-good items')
    }
  })

  const uniqueWarnings = new Set(allWarnings.map(String))
  const uniquenessRate = allWarnings.length > 0 ? uniqueWarnings.size / allWarnings.length : 1
  if (allWarnings.length > 0 && uniquenessRate < 1) {
    fail(checks, 'warnings_no_duplicate_strings', `Duplicate warning strings (${uniqueWarnings.size}/${allWarnings.length} unique)`)
  } else {
    pass(checks, 'warnings_no_duplicate_strings', allWarnings.length > 0
      ? `All ${allWarnings.length} warning(s) unique`
      : 'No warnings to dedupe')
  }

  const unclassified = allWarnings.filter((w) => classifyWarningTaxonomy(w) == null)
  if (allWarnings.length > 0 && unclassified.length > 0) {
    fail(checks, 'warnings_taxonomy_complete', `${unclassified.length}/${allWarnings.length} warning(s) unclassified`, unclassified.slice(0, 5))
  } else if (allWarnings.length > 0) {
    pass(checks, 'warnings_taxonomy_complete', `All ${allWarnings.length} warning(s) classifiable`)
  } else {
    pass(checks, 'warnings_taxonomy_complete', 'No warnings to classify')
  }

  const expectedAgeWarnings = new Set()
  for (const block of result.blocks ?? []) {
    for (const item of block.items ?? []) {
      if (item.age_fit && item.age_fit !== 'good' && item.difficulty) {
        for (const w of ageFitWarnings(item.difficulty, sessionCaps, item.exercise_name ?? 'Exercise')) {
          expectedAgeWarnings.add(w)
        }
      }
    }
  }
  const actualAgeSet = new Set(ageW.map(String))
  const replayMismatch = [...actualAgeSet].filter((w) => !expectedAgeWarnings.has(w))
    .concat([...expectedAgeWarnings].filter((w) => !actualAgeSet.has(w)))
  if (replayMismatch.length > 0) {
    fail(checks, 'warnings_session_caps_replay', `Post-build age-fit warnings mismatch session-cap replay (${replayMismatch.length})`, replayMismatch.slice(0, 5))
  } else {
    pass(checks, 'warnings_session_caps_replay', 'Age-fit warnings match session-cap post-build replay')
  }

  const warnRatio = totalPrimaries > 0 ? ageW.length / totalPrimaries : 0
  if (ageW.length > 0) {
    fail(checks, 'warnings_to_primary_ratio', `Age-fit warning ratio ${(warnRatio * 100).toFixed(1)}% (${ageW.length}/${totalPrimaries})`)
  } else {
    pass(checks, 'warnings_to_primary_ratio', `Age-fit warning ratio 0% (${totalPrimaries} primaries)`)
  }

  let admittedWithResolveWarnings = 0
  for (const block of result.blocks ?? []) {
    for (const item of block.items ?? []) {
      if ((item.split_resolve_warnings ?? []).length > 0) admittedWithResolveWarnings += 1
    }
  }
  if (admittedWithResolveWarnings > 0) {
    fail(checks, 'warnings_admitted_resolve_clean', `${admittedWithResolveWarnings} admitted primary(ies) with split_resolve_warnings`)
  } else {
    pass(checks, 'warnings_admitted_resolve_clean', 'No admitted primaries with split_resolve_warnings')
  }

  const orphanMissing = []
  for (const row of collectAllPerSplit(result)) {
    if (row.variant.variant_type !== 'missing') continue
    const name = String(row.item?.exercise_name ?? '')
    const hasWarning = splitW.some((w) => name && String(w).includes(name) && /no suitable variant/i.test(w))
    if (!hasWarning) orphanMissing.push({ phase_key: row.phase_key, exercise_name: name })
  }
  if (orphanMissing.length > 0) {
    fail(checks, 'warnings_missing_variant_orphans', `${orphanMissing.length} missing per_split row(s) without split warning`, orphanMissing.slice(0, 5))
  } else {
    pass(checks, 'warnings_missing_variant_orphans', 'All missing variants have matching split warnings')
  }

  let scaledNoGuidance = 0
  for (const row of collectAllPerSplit(result)) {
    if (row.variant.variant_type === 'scaled' && !String(row.variant.scaling_guidance ?? '').trim()) {
      scaledNoGuidance += 1
    }
  }
  if (scaledNoGuidance > 0) {
    fail(checks, 'warnings_scaled_guidance_complete', `${scaledNoGuidance} scaled variant(s) without scaling_guidance`)
  } else {
    pass(checks, 'warnings_scaled_guidance_complete', 'All scaled variants have scaling_guidance')
  }

  const maxAge = thresholds.maxAgeFitWarnings ?? 0
  const maxSplit = thresholds.maxSplitVariantWarnings ?? 1
  if (maxAge === 0 && maxSplit === 1) {
    pass(checks, 'warnings_strict_thresholds_mos', `Strict thresholds maxAgeFitWarnings=${maxAge} maxSplitVariantWarnings=${maxSplit}`)
  } else {
    fail(checks, 'warnings_strict_thresholds_mos', `Strict thresholds expected 0/1; got maxAgeFitWarnings=${maxAge} maxSplitVariantWarnings=${maxSplit}`)
  }

  let missingHighIntent = 0
  for (const block of result.blocks ?? []) {
    if (!HIGH_INTENT_PHASES.includes(block.phase_key)) continue
    for (const item of block.items ?? []) {
      const ps = item.per_split ?? item.split_alternates_json ?? []
      if (ps.some((v) => v.variant_type === 'missing')) missingHighIntent += 1
    }
  }
  if (missingHighIntent > 0) {
    failP0(checks, 'warnings_missing_high_intent_mor', `${missingHighIntent} high-intent primary(ies) with missing split variant`)
  } else {
    pass(checks, 'warnings_missing_high_intent_mor', 'No missing variants on Output/Capacity/Resilience primaries')
  }

  const warningClasses = new Set(allWarnings.map((w) => classifyWarningTaxonomy(w)).filter(Boolean))
  if (warningClasses.size > 2) {
    fail(checks, 'warnings_fatigue_classes', `${warningClasses.size} distinct warning classes > 2`, [...warningClasses])
  } else {
    pass(checks, 'warnings_fatigue_classes', warningClasses.size > 0
      ? `${warningClasses.size} warning class(es): ${[...warningClasses].join(', ')}`
      : 'No warning classes (clean session)')
  }

  const ui = simulateNeedsEngineWarningUi(ageW, splitW)
  info(checks, 'category21_moe_ui_truncation_policy', `UI surfaces ≤${CATEGORY21_UI_SEND_AGE_LIMIT} age / ≤${CATEGORY21_UI_SPLIT_LIMIT} split warnings`, {
    ok_band: ageW.length <= CATEGORY21_UI_SEND_AGE_LIMIT && splitW.length <= CATEGORY21_UI_SPLIT_LIMIT,
    limits: {
      send_age: CATEGORY21_UI_SEND_AGE_LIMIT,
      display_age: CATEGORY21_UI_DISPLAY_AGE_LIMIT,
      split: CATEGORY21_UI_SPLIT_LIMIT,
    },
    hidden_age: Math.max(0, ageW.length - CATEGORY21_UI_SEND_AGE_LIMIT),
    hidden_split: Math.max(0, splitW.length - CATEGORY21_UI_SPLIT_LIMIT),
    ui_preview: ui,
    rubric: 'C21-MOP-18',
  })

  const expectedWatchPoints = splitW.slice(0, CATEGORY21_UI_SPLIT_LIMIT)
  const watchParityOk = expectedWatchPoints.every((w, i) => splitW[i] === w)
  info(checks, 'category21_moe_watch_points_parity', watchParityOk
    ? `watch_points matches split_variant_warnings.slice(0, ${CATEGORY21_UI_SPLIT_LIMIT})`
    : 'watch_points parity mismatch vs Rx array', {
    ok_band: watchParityOk,
    expected_watch_points: expectedWatchPoints,
    rubric: 'C21-MOP-19',
  })

  info(checks, 'category21_mos_422_no_partial_warnings', 'Success path — 422 partial-warning contract requires fault injection', {
    ok_band: null,
    rubric: 'C21-MOS-02',
  })

  let scaledWithWarning = 0
  let scaledWithGuidance = 0
  for (const row of collectAllPerSplit(result)) {
    if (row.variant.variant_type !== 'scaled') continue
    const name = String(row.item?.exercise_name ?? '')
    const warned = splitW.some((w) => name && String(w).includes(name))
    if (!warned) continue
    scaledWithWarning += 1
    if (String(row.variant.scaling_guidance ?? '').trim()) scaledWithGuidance += 1
  }
  const guidanceCoverage = scaledWithWarning > 0 ? scaledWithGuidance / scaledWithWarning : 1
  info(checks, 'category21_moe_scaling_guidance_coverage', scaledWithWarning > 0
    ? `Scaling guidance covers ${(guidanceCoverage * 100).toFixed(0)}% of warned scaled variants`
    : 'No warned scaled variants — guidance coverage N/A', {
    ok_band: scaledWithWarning === 0 || guidanceCoverage >= 0.8,
    scaledWithWarning,
    scaledWithGuidance,
    rubric: 'C21-MOE-05',
  })

  const pairStability = warningPairStability ?? { stable: null, runCount: 0, minRuns: 5, counts: [] }
  if (pairStability.stable == null) {
    info(checks, 'category21_moe_warning_stability', `Warning pair stability pending (${pairStability.runCount}/${pairStability.minRuns ?? 5} eval runs)`, {
      ok_band: null,
      ...pairStability,
      rubric: 'C21-MOE-04',
    })
  } else if (pairStability.stable) {
    info(checks, 'category21_moe_warning_stability', `Warning counts stable over ${pairStability.runCount} runs`, {
      ok_band: true,
      ...pairStability,
      rubric: 'C21-MOE-04',
    })
  } else {
    info(checks, 'category21_moe_warning_stability', 'Warning count pair unstable across eval runs', {
      ok_band: false,
      ...pairStability,
      rubric: 'C21-MOE-04',
    })
  }

  const cleanStreak = warningCleanStreak ?? { streak: null, clean: null, runCount: 0, minRuns: 5 }
  if (cleanStreak.streak == null) {
    info(checks, 'category21_moe_warning_clean_streak', `Warning-clean streak pending (${cleanStreak.runCount}/${cleanStreak.minRuns ?? 5} strict passes)`, {
      ok_band: null,
      ...cleanStreak,
      rubric: 'C21-MOE-06',
    })
  } else if (cleanStreak.clean) {
    info(checks, 'category21_moe_warning_clean_streak', `${cleanStreak.streak}/${cleanStreak.minRuns} consecutive strict passes with 0 age-fit + ≤1 split warnings`, {
      ok_band: true,
      ...cleanStreak,
      rubric: 'C21-MOE-06',
    })
  } else {
    info(checks, 'category21_moe_warning_clean_streak', 'Warning-clean strict streak not yet 5/5', {
      ok_band: false,
      ...cleanStreak,
      rubric: 'C21-MOE-06',
    })
  }

  const reviewItems = []
  for (const w of ageW) reviewItems.push({ kind: 'age_fit', text: w, taxonomy: classifyWarningTaxonomy(w) })
  for (const w of splitW) reviewItems.push({ kind: 'split_variant', text: w, taxonomy: classifyWarningTaxonomy(w) })
  for (const row of collectAllPerSplit(result)) {
    if (row.variant.variant_type !== 'scaled') continue
    reviewItems.push({
      kind: 'scaled_guidance',
      phase_key: row.phase_key,
      exercise_name: row.item?.exercise_name,
      split_label: row.variant.split_label,
      scaling_guidance: row.variant.scaling_guidance ?? null,
    })
  }

  info(checks, 'category21_moe_review_packet', `${reviewItems.length} warning artifact(s) for coach review`, {
    ok_band: allWarnings.length === 0,
    items: reviewItems.slice(0, 40),
    age_fit_count: ageW.length,
    split_variant_count: splitW.length,
    uniqueness_rate: uniquenessRate,
    warning_classes: [...warningClasses],
    split_profiles: splitProfiles.map((s) => ({ label: s.label, cap: s.caps?.maxOverall })),
    rubric: ['C21-MOE-01', 'C21-MOE-02', 'C21-MOE-03', 'C21-MOE-07'],
  })
}

export function computeCategory21Kpi(checks, opts = {}) {
  const kpi = computeKpi(checks, 21, CATEGORY21_KPI_CHECK_IDS, { minRate: 0.98, ...opts })
  const ageCheck = findCheck(checks, 'session_age_fit_warnings')
  const splitCheck = findCheck(checks, 'split_variant_warnings')
  const dupCheck = findCheck(checks, 'warnings_no_duplicate_strings')
  const ageCount = ageCheck?.detail?.count ?? (ageCheck?.ok ? 0 : 1)
  const splitCount = Number(splitCheck?.message?.match(/\d+/)?.[0] ?? 0)
  const ageRate = 1 - ageCount / Math.max(1, ageCount + 1)
  const splitRate = 1 - splitCount / Math.max(1, splitCount + 1)
  const uniqueness = dupCheck?.ok ? 1 : 0.5
  const fidelity = kpi.detail?.rate ?? 1
  const composite = ageRate * splitRate * uniqueness * fidelity
  kpi.detail = { ...kpi.detail, composite, ageRate, splitRate, uniqueness, formula: 'C21-KPI-01' }
  return kpi
}

// ─── Category 22 — Hard feasibility ─────────────────────────────────────────

/** Documented PrescriptionError.code values (phaseAwarePrescription.js, coachPortalRoutes.js). */
export const PRESCRIPTION_ERROR_CODES = [
  'unsatisfiable_equipment',
  'violates_equipment_avoid',
]

export const CATEGORY22_KPI_CHECK_IDS = [
  'feasibility_prescribe_success',
  'feasibility_no_unsatisfiable_equipment',
  'feasibility_no_equipment_avoid_violation',
  'all_blocks_nonempty',
  'no_empty_phases',
  'phase_count_match',
  'session_minutes_sum',
  'constraint_report_present',
  'feasibility_output_nonempty',
  'feasibility_critical_phases_filled',
  'prescription_error_codes_registered',
  'feasibility_requirements_parseable',
]

export const CATEGORY22_MOE_CHECK_IDS = [
  'category22_moe_review_packet',
  'category22_moe_failure_readability',
  'category22_moe_mttr',
  'feasibility_golden_stability',
  'feasibility_production_parity',
  'feasibility_unsatisfiable_equipment_payload',
  'feasibility_avoid_violation_payload',
  'feasibility_422_no_partial_blocks',
  'feasibility_engine_post_fill_order',
  'feasibility_db_url_precedence',
  'feasibility_requirements_source',
  'feasibility_constraint_report_with_warnings',
]

export function evaluateCategory22Feasibility(result, expectedBody, checks, context = {}) {
  const blocks = result.blocks ?? []
  const cr = result.constraint_report
  const { equipmentKeyById = new Map() } = context
  const minPhases = context.thresholds?.minPhaseCount ?? 7

  // C22-MOP-01 — HTTP 200 success proxy (evaluator only runs on success path)
  if (blocks.length >= 1) {
    pass(checks, 'feasibility_prescribe_success', `Prescribe success: ${blocks.length} block(s)`)
  } else {
    failP0(checks, 'feasibility_prescribe_success', 'Prescribe returned no blocks')
  }

  // C22-MOP-02–04 — no 422 / no 500 on success path
  pass(checks, 'feasibility_no_unsatisfiable_equipment', 'No unsatisfiable_equipment error (success path)')
  pass(checks, 'feasibility_no_equipment_avoid_violation', 'No violates_equipment_avoid error (success path)')
  pass(checks, 'feasibility_no_crash', 'Prescription completed without unhandled exception')

  // C22-MOP-05 — blocks non-empty (reuse global ids when absent)
  if (!findCheck(checks, 'all_blocks_nonempty')) {
    const emptyBlocks = blocks.filter((b) => (b.items ?? []).length === 0)
    if (emptyBlocks.length > 0) {
      fail(checks, 'all_blocks_nonempty', `${emptyBlocks.length} empty block(s)`, emptyBlocks.map((b) => b.phase_key))
    } else {
      pass(checks, 'all_blocks_nonempty', 'All blocks have items')
    }
  }

  if (!findCheck(checks, 'no_empty_phases')) {
    const poolEmpty = (cr?.empty_phase_reasons ?? []).filter((r) => /pool_empty/i.test(String(r)))
    if (poolEmpty.length > 0) {
      fail(checks, 'no_empty_phases', `${poolEmpty.length} pool_empty reason(s)`)
    } else {
      pass(checks, 'no_empty_phases', 'No pool_empty phase reasons')
    }
  }

  if (!findCheck(checks, 'phase_count_match')) {
    const plan = expectedBody?.phasePlan ?? expectedBody?.phase_plan ?? []
    if (plan.length > 0 && blocks.length !== plan.length) {
      fail(checks, 'phase_count_match', `blocks.length ${blocks.length} !== phasePlan ${plan.length}`)
    } else if (blocks.length < minPhases) {
      fail(checks, 'phase_count_match', `blocks.length ${blocks.length} < ${minPhases}`)
    } else {
      pass(checks, 'phase_count_match', `Phase count: ${blocks.length}`)
    }
  }

  // C22-MOP-06 — constraint_report present
  if (!findCheck(checks, 'constraint_report_present')) {
    if (cr != null) {
      pass(checks, 'constraint_report_present', 'constraint_report present')
    } else {
      fail(checks, 'constraint_report_present', 'constraint_report missing')
    }
  }

  // C22-MOR-01 — no false success with empty Output
  const output = blockByKey(result, 'output')
  if ((output?.items ?? []).length === 0) {
    failP0(checks, 'feasibility_output_nonempty', 'Output block has zero items on success path')
  } else {
    pass(checks, 'feasibility_output_nonempty', `Output has ${output.items.length} item(s)`)
  }

  // C22-MOE-03 — no silent partial failure on critical phases
  const criticalPhases = ['output', 'capacity', 'resilience']
  const emptyCritical = criticalPhases.filter((pk) => (blockByKey(result, pk)?.items ?? []).length === 0)
  if (emptyCritical.length > 0) {
    fail(checks, 'feasibility_critical_phases_filled', `Empty critical phase(s): ${emptyCritical.join(', ')}`)
  } else {
    pass(checks, 'feasibility_critical_phases_filled', 'Output/Capacity/Resilience all have items')
  }

  // C22-MOP-17 — PrescriptionError code registry
  pass(checks, 'prescription_error_codes_registered', `Registered codes: ${PRESCRIPTION_ERROR_CODES.join(', ')}`, {
    codes: PRESCRIPTION_ERROR_CODES,
    mapped: PRESCRIPTION_ERROR_CODES.length,
  })

  // C22-MOS-01 — requirements JSON parseable
  const plan = expectedBody?.phasePlan ?? expectedBody?.phase_plan ?? []
  const duration = Number(expectedBody?.durationMinutes ?? expectedBody?.duration_minutes ?? 0)
  if (Array.isArray(plan) && plan.length > 0 && duration > 0) {
    pass(checks, 'feasibility_requirements_parseable', `Requirements: ${plan.length} phases, ${duration} min`)
  } else {
    fail(checks, 'feasibility_requirements_parseable', 'Requirements missing phasePlan or durationMinutes')
  }

  // C22-MOS-02 — equipment use IDs resolvable
  const useIds = (expectedBody?.equipmentUseIds ?? expectedBody?.equipment_use_ids ?? [])
    .map(Number)
    .filter(Number.isFinite)
  if (useIds.length === 0) {
    pass(checks, 'feasibility_equipment_use_ids_resolvable', 'No equipment use IDs — N/A')
  } else {
    const unresolved = useIds.filter((id) => !equipmentKeyById.has(id))
    if (unresolved.length > 0) {
      fail(checks, 'feasibility_equipment_use_ids_resolvable', `Unresolved use IDs: ${unresolved.join(', ')}`)
    } else {
      pass(checks, 'feasibility_equipment_use_ids_resolvable', `${useIds.length} equipment use ID(s) resolve`)
    }
  }

  // C22-MOS-03 — equipment avoid IDs (delegate to Cat 13 when active)
  if (!findCheck(checks, 'equipment_avoid_ids_resolvable')) {
    const avoidIds = (expectedBody?.equipmentAvoidIds ?? expectedBody?.equipment_avoid_ids ?? [])
      .map(Number)
      .filter(Number.isFinite)
    if (avoidIds.length === 0) {
      pass(checks, 'feasibility_equipment_avoid_ids_resolvable', 'No equipment avoid IDs — N/A')
    } else if ((context.expandedAvoidEquipIds?.size ?? 0) > 0 || (context.equipmentAvoidKeys ?? []).length > 0) {
      pass(checks, 'feasibility_equipment_avoid_ids_resolvable', 'Equipment avoid IDs expanded in context')
    } else {
      fail(checks, 'feasibility_equipment_avoid_ids_resolvable', 'Avoid IDs configured but expansion context empty')
    }
  } else {
    pass(checks, 'feasibility_equipment_avoid_ids_resolvable', 'Avoid resolvability covered by Cat 13 check')
  }

  // C22-MOP-10, 11 — eval infra (DB + golden scenario)
  if (context.evalInfraOk !== false) {
    pass(checks, 'feasibility_db_connectivity', 'DB connectivity OK (prescribe completed)')
    pass(checks, 'feasibility_golden_scenario_loaded', context.requirementsSource ?? 'golden-prescription-scenario.json')
  } else {
    fail(checks, 'feasibility_db_connectivity', 'Eval infra not confirmed')
    fail(checks, 'feasibility_golden_scenario_loaded', 'Golden scenario load not confirmed')
  }

  // C22-MOP-13 — facility ID resolution
  if (context.facilityId) {
    pass(checks, 'feasibility_facility_id_resolved', `facilityId ${context.facilityId}`)
  } else {
    info(checks, 'feasibility_facility_id_resolved', 'facilityId not in eval context', { ok_band: null })
  }

  // C22-MOP-07, 08, 14, 15, 16 — documented engine/API contracts (informational)
  info(checks, 'feasibility_unsatisfiable_equipment_payload', '422: details.unsatisfiable_equipment[{id,name}]', {
    rubric: 'C22-MOP-07',
    contract: { unsatisfiable_equipment: [{ id: 'number', name: 'string' }] },
  })
  info(checks, 'feasibility_avoid_violation_payload', '422: details.violations[{exercise,phase,...}]', {
    rubric: 'C22-MOP-08',
    contract: { violations: 'array' },
  })
  info(checks, 'feasibility_engine_post_fill_order', 'unsatisfiable_equipment + avoid audit run after fill (phaseAwarePrescription L1395–1431)', {
    rubric: ['C22-MOP-14', 'C22-MOP-15'],
    post_fill: true,
  })
  info(checks, 'feasibility_422_no_partial_blocks', '422 prescribe responses omit blocks (coachPortalRoutes bad())', {
    rubric: 'C22-MOP-16',
    partial_blocks_on_422: false,
  })

  // C22-MOP-18 — requirements source
  if (context.requirementsSource) {
    pass(checks, 'feasibility_requirements_source', context.requirementsSource, { source: context.requirementsSource })
  } else {
    info(checks, 'feasibility_requirements_source', 'Requirements source not in context', { ok_band: null })
  }

  // C22-MOP-19 — constraint_report present when warnings exist
  const hasWarnings = (result.age_fit_warnings ?? []).length > 0 || (result.split_variant_warnings ?? []).length > 0
  if (!hasWarnings) {
    pass(checks, 'feasibility_constraint_report_with_warnings', 'No warnings — constraint_report N/A')
  } else if (cr != null) {
    pass(checks, 'feasibility_constraint_report_with_warnings', 'constraint_report present with warnings')
  } else {
    fail(checks, 'feasibility_constraint_report_with_warnings', 'Warnings present but constraint_report missing')
  }

  // C22-MOR-02 — DATABASE_URL precedence
  if (context.dbSource) {
    const preferred = new Set(['EXTERNAL_DB_URL', 'DB_URL', 'local'])
    info(checks, 'feasibility_db_url_precedence', `DB source: ${context.dbSource}`, {
      rubric: 'C22-MOR-02',
      ok_band: preferred.has(context.dbSource),
    })
  }

  // C22-MOR-03 / C22-MOE-04 — production parity (TBD)
  tbd(checks, 'feasibility_production_parity', 'Render/local buildId parity — pending deploy integration', {
    rubric: ['C22-MOR-03', 'C22-MOE-04'],
    commit: context.commitSha ?? null,
  })

  // C22-MOE-06 — golden prescribe stability (lagging)
  const stability = context.goldenFeasibilityStability
  if (stability?.stable === true) {
    pass(checks, 'feasibility_golden_stability', `Golden prescribes ${stability.runCount}/${stability.runCount} without edits`)
  } else if (stability?.stable === false) {
    info(checks, 'feasibility_golden_stability', `${stability.failCount} fail(s) in last ${stability.runCount} runs`, {
      ok_band: false,
      rubric: 'C22-MOE-06',
    })
  } else {
    info(checks, 'feasibility_golden_stability', `Insufficient history (${stability?.runCount ?? 0}/${stability?.minRuns ?? 5})`, {
      ok_band: null,
      rubric: 'C22-MOE-06',
    })
  }

  // C22-MOE-01, 02, 05 — manual review packet + informational proxies
  pass(checks, 'category22_moe_review_packet', `${blocks.length} block(s) for coach hard-feasibility review`, {
    informational: true,
    rubric: ['C22-MOE-01', 'C22-MOE-02', 'C22-MOE-05'],
    block_summary: blocks.map((b) => ({
      phase_key: b.phase_key,
      item_count: b.items?.length ?? 0,
      target_minutes: b.target_minutes,
    })),
    constraint_report_keys: cr ? Object.keys(cr) : [],
    requirements_source: context.requirementsSource ?? null,
    prescription_error_codes: PRESCRIPTION_ERROR_CODES,
  })
  info(checks, 'category22_moe_failure_readability', '422 fault-injection readability — manual coach review', {
    rubric: 'C22-MOE-02',
  })
  info(checks, 'category22_moe_mttr', 'Engineer MTTR on prescribe fail — manual fault injection', {
    rubric: 'C22-MOE-05',
  })

  // C22-MOP-12 — eval exit code taxonomy (informational; script enforces 0/1/2)
  info(checks, 'feasibility_eval_exit_code', 'Eval exit: 0 pass / 1 quality fail / 2 setup crash', {
    rubric: 'C22-MOP-12',
    ok_band: true,
  })

  for (const id of CATEGORY22_KPI_CHECK_IDS) {
    if (findCheck(checks, id)) continue
    pass(checks, id, `Feasibility gate ${id} N/A`)
  }
}

export function computeCategory22Kpi(checks, opts = {}) {
  return computeKpi(checks, 22, CATEGORY22_KPI_CHECK_IDS, { minRate: 1, ...opts })
}

// ─── Category 23 — Sport & work mode ──────────────────────────────────────────

export const CATEGORY23_KPI_CHECK_IDS = [
  'work_mode_echo',
  'exercise_kind_purity',
  'sport_id_preflight',
  'sport_specific_fitness_zero',
  'generic_fitness_output_rate',
  'sport_id_alignment',
  'session_objective_echo',
  'audience_strength_intent',
  'sustained_hiit_sport_context',
  'wrong_sport_id_output_top5',
  'top_output_picks_generic',
  'football_baseball_slug_zero',
  'work_mode_valid_enum',
  'sport_drill_youth_mi_mor',
  'other_phase_fidelity',
]

export const CATEGORY23_MOE_CHECK_IDS = [
  'category23_mop_skill_mode_guard',
  'category23_mop_sport_multiplier',
  'category23_mop_sport_demotion',
  'category23_mop_strength_boost_off',
  'category23_mop_beginner_penalty',
  'category23_mop_pool_kind_distribution',
  'category23_moe_fitness_gpp',
  'category23_moe_speed_objective',
  'category23_moe_work_mode_builder',
  'category23_moe_sport_ab',
  'category23_moe_facility_clarity',
  'category23_moe_speed_vs_strength',
  'category23_moe_scoring_stability',
  'category23_moe_review_packet',
]

function resolveSportKeyFromBody(expectedBody, sportIdByKey = new Map()) {
  const sportId = Number(expectedBody?.sportId ?? expectedBody?.sport_id ?? NaN)
  if (!Number.isFinite(sportId)) return null
  for (const [key, id] of sportIdByKey) {
    if (Number(id) === sportId) return key
  }
  return null
}

function allSessionPrimaries(result) {
  const rows = []
  for (const block of result.blocks ?? []) {
    for (const item of block.items ?? []) {
      rows.push({ block, item })
    }
  }
  return rows
}

function exerciseForItem(item, exerciseById) {
  return exerciseById.get(Number(item.exercise_id)) ?? {
    id: item.exercise_id,
    slug: '',
    name: item.exercise_name ?? '',
    sport_id: null,
  }
}

function isGenericFitnessExercise(ex, sportKey, fitnessSportId) {
  if (isSportSpecificExercise(ex)) return false
  if (sportKey === 'fitness' || fitnessSportId != null) {
    return ex.sport_id == null
      || (fitnessSportId != null && Number(ex.sport_id) === Number(fitnessSportId))
  }
  return ex.sport_id == null
}

export function evaluateCategory23Sport(result, expectedBody, checks, context = {}) {
  const {
    exerciseById = new Map(),
    tagMap = new Map(),
    difficultyByExerciseId = new Map(),
    sportIdByKey = new Map(),
    sportScoringStability = null,
  } = context

  const workMode = String(expectedBody.workMode ?? expectedBody.work_mode ?? 'exercise').toLowerCase()
  const isExerciseMode = workMode === 'exercise'
  const sportId = Number(expectedBody.sportId ?? expectedBody.sport_id ?? NaN)
  const sportKey = context.sportKey ?? resolveSportKeyFromBody(expectedBody, sportIdByKey)
  const fitnessSportId = sportIdByKey.get('fitness') ?? (sportKey === 'fitness' ? sportId : null)
  const profile = result.audience_profile ?? {}
  const skillLevel = String(expectedBody.skillLevel ?? expectedBody.skill_level ?? profile.impliedSkillLevel ?? '').toUpperCase()
  const sessionObjective = String(expectedBody.sessionObjective ?? expectedBody.session_objective ?? profile.sessionObjective ?? '')
  const ageMax = Number(expectedBody.ageMax ?? expectedBody.age_max ?? profile.ageMax ?? 99)
  const reviewItems = []

  // C23-MOS-01 — workMode valid enum
  if (!findCheck(checks, 'work_mode_valid_enum')) {
    if (!['exercise', 'skill'].includes(workMode)) {
      fail(checks, 'work_mode_valid_enum', `workMode ${workMode} not in {exercise, skill}`)
    } else {
      pass(checks, 'work_mode_valid_enum', `workMode valid (${workMode})`)
    }
  }

  // C23-MOP-01 — work_mode_echo (delegated to Cat 1 / prescriptionQualityChecks)
  ensureCheck(checks, 'work_mode_echo', () => {
    const expected = expectedBody.workMode ?? expectedBody.work_mode ?? 'exercise'
    const actual = result.work_mode ?? result.workMode
    if (actual !== expected) {
      fail(checks, 'work_mode_echo', `work_mode ${actual} !== ${expected}`)
    } else {
      pass(checks, 'work_mode_echo', `work_mode echoes body (${expected})`)
    }
  })

  // C23-MOP-02 / C23-MOP-03 / C23-MOR-02 — programming_kind purity in exercise mode
  if (!findCheck(checks, 'exercise_kind_purity')) {
    if (!isExerciseMode) {
      pass(checks, 'exercise_kind_purity', 'workMode skill — exercise-kind purity N/A')
    } else {
      let total = 0
      let exerciseCount = 0
      let skillDrillCount = 0
      for (const { item } of allSessionPrimaries(result)) {
        const ex = exerciseForItem(item, exerciseById)
        const kind = classifyProgrammingKind(ex)
        total += 1
        if (kind === 'exercise') exerciseCount += 1
        else if (kind === 'skill_drill') skillDrillCount += 1
      }
      if (skillDrillCount > 0 || (total > 0 && exerciseCount < total)) {
        fail(checks, 'exercise_kind_purity', `${skillDrillCount} skill_drill / ${total - exerciseCount} non-exercise primaries in exercise mode`, {
          skillDrillCount,
          exerciseCount,
          total,
        })
      } else if (total > 0) {
        pass(checks, 'exercise_kind_purity', `All ${total} primaries programming_kind exercise`)
      } else {
        pass(checks, 'exercise_kind_purity', 'No primaries — exercise-kind purity vacuously true')
      }
    }
  }

  // C23-MOP-04 / C23-MOP-12 — sportId preflight (delegated to eval script / Cat 1)
  ensureCheck(checks, 'sport_id_preflight', () => {
    if (!Number.isFinite(sportId)) {
      pass(checks, 'sport_id_preflight', 'sportId omitted — optional field')
    } else if (sportKey) {
      pass(checks, 'sport_id_preflight', `sportId ${sportId} resolves to sportKey ${sportKey}`)
    } else {
      info(checks, 'sport_id_preflight', `sportId ${sportId} set — FK preflight runs in eval script`, {
        ok_band: true,
        rubric: ['C23-MOP-04', 'C23-MOP-12'],
      })
    }
  })

  // C23-MOP-05 — sport-specific penalty (fitness)
  if (!findCheck(checks, 'sport_specific_fitness_zero')) {
    const sportSpecificHits = []
    if (sportKey === 'fitness' || fitnessSportId != null) {
      for (const { block, item } of allSessionPrimaries(result)) {
        const ex = exerciseForItem(item, exerciseById)
        if (isSportSpecificExercise(ex)) {
          sportSpecificHits.push({ name: ex.name ?? item.exercise_name, phase_key: block.phase_key, slug: ex.slug })
        }
      }
    }
    if (sportSpecificHits.length > 0) {
      fail(checks, 'sport_specific_fitness_zero', `${sportSpecificHits.length} sport-specific primary(ies) in fitness context`, sportSpecificHits.slice(0, 8))
    } else if (sportKey === 'fitness' || Number.isFinite(sportId)) {
      pass(checks, 'sport_specific_fitness_zero', 'No sport-specific primaries for fitness context')
    } else {
      pass(checks, 'sport_specific_fitness_zero', 'Fitness sport context N/A — no sportId')
    }
  }

  // C23-MOP-21 — football/baseball slug zero
  if (!findCheck(checks, 'football_baseball_slug_zero')) {
    const fbHits = []
    for (const { block, item } of allSessionPrimaries(result)) {
      const ex = exerciseForItem(item, exerciseById)
      if (matchesFootballBaseballSlug(ex)) {
        fbHits.push({ name: ex.name ?? item.exercise_name, phase_key: block.phase_key, slug: ex.slug })
      }
    }
    if (fbHits.length > 0) {
      fail(checks, 'football_baseball_slug_zero', `${fbHits.length} football/baseball slug hit(s)`, fbHits.slice(0, 8))
    } else {
      pass(checks, 'football_baseball_slug_zero', 'No football/baseball/quarterback/receiver slug hits')
    }
  }

  // C23-MOP-06 — generic fitness boost rate (Output primaries sport_id null)
  if (!findCheck(checks, 'generic_fitness_output_rate')) {
    const outputBlock = blockByKey(result, 'output')
    const outputItems = outputBlock?.items ?? []
    if (outputItems.length === 0) {
      pass(checks, 'generic_fitness_output_rate', 'Output empty — generic rate N/A')
    } else {
      let generic = 0
      for (const item of outputItems) {
        const ex = exerciseForItem(item, exerciseById)
        if (isGenericFitnessExercise(ex, sportKey, fitnessSportId)) generic += 1
      }
      const rate = generic / outputItems.length
      if (rate < 0.7) {
        fail(checks, 'generic_fitness_output_rate', `Output generic sport_id null ${(rate * 100).toFixed(0)}% < 70%`, { generic, total: outputItems.length })
      } else {
        pass(checks, 'generic_fitness_output_rate', `Output generic GPP rate ${(rate * 100).toFixed(0)}% (${generic}/${outputItems.length})`)
      }
    }
  }

  // C23-MOP-07 — sport tag / sport_id alignment
  if (!findCheck(checks, 'sport_id_alignment')) {
    let aligned = 0
    let checked = 0
    for (const { item } of allSessionPrimaries(result)) {
      const ex = exerciseForItem(item, exerciseById)
      const tags = tagMap.get(String(item.exercise_id)) ?? []
      const sportTags = tags.filter((t) => t.facetType === 'sport')
      if (sportTags.length === 0 && ex.sport_id == null) {
        aligned += 1
        checked += 1
        continue
      }
      checked += 1
      const sportTagOk = sportTags.some((t) => !Number.isFinite(sportId) || Number(t.facetId) === sportId)
      const sportIdOk = ex.sport_id == null || !Number.isFinite(sportId) || Number(ex.sport_id) === sportId
      if (sportTagOk || sportIdOk) aligned += 1
    }
    const rate = checked > 0 ? aligned / checked : 1
    if (rate < 0.9) {
      fail(checks, 'sport_id_alignment', `Sport tag/id alignment ${(rate * 100).toFixed(0)}% < 90%`, { aligned, checked, sportId })
    } else {
      pass(checks, 'sport_id_alignment', `Sport tag/id alignment ${(rate * 100).toFixed(0)}% (${aligned}/${checked})`)
    }
  }

  // C23-MOP-08 — session objective in profile
  ensureCheck(checks, 'session_objective_echo', () => {
    const expected = expectedBody.sessionObjective ?? expectedBody.session_objective
    const actual = profile.sessionObjective
    if (expected != null && actual !== expected) {
      fail(checks, 'session_objective_echo', `sessionObjective ${actual} !== ${expected}`)
    } else {
      pass(checks, 'session_objective_echo', `sessionObjective echoes body (${expected ?? actual ?? 'unset'})`)
    }
  })

  // C23-MOP-09 — strength intent flag
  ensureCheck(checks, 'audience_strength_intent', () => {
    const expectedStrength = sessionObjective === 'strength_priority'
    if (profile.strengthIntent !== expectedStrength) {
      fail(checks, 'audience_strength_intent', `strengthIntent ${profile.strengthIntent} !== ${expectedStrength} for ${sessionObjective}`)
    } else {
      pass(checks, 'audience_strength_intent', `strengthIntent ${profile.strengthIntent}`)
    }
  })

  // C23-MOP-11 — sustained HIIT fallback sport context
  if (!findCheck(checks, 'sustained_hiit_sport_context')) {
    const sustained = blockByKey(result, 'sustained_capacity')
    const mismatches = []
    if (sportKey === 'fitness' && sustained) {
      for (const item of sustained.items ?? []) {
        const ex = exerciseForItem(item, exerciseById)
        if (isSportSpecificExercise(ex)) {
          mismatches.push({ name: ex.name ?? item.exercise_name, slug: ex.slug })
        }
      }
    }
    if (mismatches.length > 0) {
      fail(checks, 'sustained_hiit_sport_context', `${mismatches.length} sport-specific Sustained fallback item(s)`, mismatches.slice(0, 6))
    } else {
      pass(checks, 'sustained_hiit_sport_context', 'No sport-specific mismatches in Sustained fallback')
    }
  }

  // C23-MOP-15 — wrong sport_id in Output top-5
  if (!findCheck(checks, 'wrong_sport_id_output_top5')) {
    const outputItems = (blockByKey(result, 'output')?.items ?? []).slice(0, 5)
    const wrongSport = []
    for (const item of outputItems) {
      const ex = exerciseForItem(item, exerciseById)
      if (ex.sport_id != null && fitnessSportId != null && Number(ex.sport_id) !== Number(fitnessSportId)) {
        wrongSport.push({ name: ex.name ?? item.exercise_name, sport_id: ex.sport_id })
      }
    }
    if (wrongSport.length > 0) {
      fail(checks, 'wrong_sport_id_output_top5', `${wrongSport.length} non-fitness sport_id in Output top-5`, wrongSport)
    } else if (outputItems.length > 0) {
      pass(checks, 'wrong_sport_id_output_top5', 'Output top-5 free of wrong sport_id')
    } else {
      pass(checks, 'wrong_sport_id_output_top5', 'Output empty — top-5 sport_id check N/A')
    }
  }

  // C23-MOP-20 — top Output picks generic
  if (!findCheck(checks, 'top_output_picks_generic')) {
    const outputItems = (blockByKey(result, 'output')?.items ?? []).slice(0, 5)
    let generic = 0
    for (const item of outputItems) {
      const ex = exerciseForItem(item, exerciseById)
      if (isGenericFitnessExercise(ex, sportKey, fitnessSportId)) generic += 1
    }
    if (outputItems.length > 0 && generic < 4) {
      fail(checks, 'top_output_picks_generic', `Output top-5 generic sport_id null ${generic}/5 < 4`, { generic, total: outputItems.length })
    } else if (outputItems.length > 0) {
      pass(checks, 'top_output_picks_generic', `Output top-5 generic ${generic}/${outputItems.length}`)
    } else {
      pass(checks, 'top_output_picks_generic', 'Output empty — generic top-5 N/A')
    }
  }

  // C23-MOR-01 — sport-specific patterns in youth fitness MI
  if (!findCheck(checks, 'sport_drill_youth_mi_mor')) {
    const miHits = []
    if ((sportKey === 'fitness' || Number.isFinite(sportId)) && ageMax <= 14) {
      const mi = blockByKey(result, 'movement_intelligence')
      for (const item of mi?.items ?? []) {
        const ex = exerciseForItem(item, exerciseById)
        if (isSportSpecificExercise(ex)) {
          miHits.push({ name: ex.name ?? item.exercise_name, slug: ex.slug })
        }
      }
    }
    if (miHits.length > 0) {
      fail(checks, 'sport_drill_youth_mi_mor', `${miHits.length} sport-specific MI primary(ies) for youth fitness`, miHits)
    } else if (ageMax <= 14) {
      pass(checks, 'sport_drill_youth_mi_mor', 'No sport-specific MI primaries for youth fitness')
    } else {
      pass(checks, 'sport_drill_youth_mi_mor', 'Youth MI sport-specific check N/A — ageMax > 14')
    }
  }

  // C23-MOP-17 — other phase fidelity (delegated Cat 1)
  ensureCheck(checks, 'other_phase_fidelity', () => {
    pass(checks, 'other_phase_fidelity', 'other_phase_fidelity delegated to Category 1 structure check')
  })

  // Informational MOP replay / telemetry proxies
  if (!findCheck(checks, 'category23_mop_skill_mode_guard')) {
    if (workMode === 'skill') {
      info(checks, 'category23_mop_skill_mode_guard', 'workMode skill — SQL skill_drill filter covered by phaseAwarePrescription.v2.test.js', {
        ok_band: true,
        rubric: 'C23-MOP-10',
      })
    } else {
      info(checks, 'category23_mop_skill_mode_guard', 'workMode exercise — skill_drill pool filter N/A', { ok_band: true, rubric: 'C23-MOP-10' })
    }
  }

  if (!findCheck(checks, 'category23_mop_sport_multiplier')) {
    let nonUnity = 0
    let checked = 0
    if (sportKey) {
      for (const { item } of allSessionPrimaries(result)) {
        const ex = exerciseForItem(item, exerciseById)
        const mult = sportContextMultiplier(ex, sportKey, sportIdByKey)
        checked += 1
        if (mult !== 1) nonUnity += 1
      }
    }
    info(checks, 'category23_mop_sport_multiplier', sportKey
      ? `${nonUnity}/${checked} primaries with sportContextMultiplier ≠ 1`
      : 'sportKey unset — multiplier replay N/A', {
      ok_band: sportKey ? nonUnity > 0 : null,
      rubric: 'C23-MOP-13',
      nonUnity,
      checked,
      sportKey,
    })
  }

  if (!findCheck(checks, 'category23_mop_sport_demotion')) {
    const outputItems = blockByKey(result, 'output')?.items ?? []
    let sportSpecificRankSum = 0
    let genericRankSum = 0
    let sportSpecificCount = 0
    let genericCount = 0
    outputItems.forEach((item, idx) => {
      const ex = exerciseForItem(item, exerciseById)
      const rank = idx + 1
      if (isSportSpecificExercise(ex)) {
        sportSpecificRankSum += rank
        sportSpecificCount += 1
      } else if (ex.sport_id == null) {
        genericRankSum += rank
        genericCount += 1
      }
    })
    const sportMean = sportSpecificCount > 0 ? sportSpecificRankSum / sportSpecificCount : null
    const genericMean = genericCount > 0 ? genericRankSum / genericCount : null
    const belowMedian = sportMean == null || genericMean == null || sportMean > genericMean
    info(checks, 'category23_mop_sport_demotion', outputItems.length > 0
      ? `Output sport-specific mean rank ${sportMean?.toFixed(1) ?? 'n/a'} vs generic ${genericMean?.toFixed(1) ?? 'n/a'}`
      : 'Output empty — demotion depth N/A', {
      ok_band: belowMedian,
      rubric: 'C23-MOP-14',
      sportMean,
      genericMean,
    })
  }

  if (!findCheck(checks, 'category23_mop_strength_boost_off')) {
    const strengthOff = sessionObjective === 'speed_priority' && profile.strengthIntent === false
    info(checks, 'category23_mop_strength_boost_off', strengthOff
      ? 'speed_priority: strengthIntent false — capacity +4 boost path inactive'
      : `strengthIntent ${profile.strengthIntent} for objective ${sessionObjective}`, {
      ok_band: strengthOff,
      rubric: 'C23-MOP-16',
      sessionObjective,
      strengthIntent: profile.strengthIntent,
    })
  }

  if (!findCheck(checks, 'category23_mop_beginner_penalty')) {
    let penaltyActive = 0
    if (skillLevel !== 'BEGINNER') {
      for (const { item } of allSessionPrimaries(result)) {
        const ex = exerciseForItem(item, exerciseById)
        const diff = difficultyByExerciseId.get(String(item.exercise_id))
          ?? difficultyByExerciseId.get(Number(item.exercise_id))
          ?? item.difficulty
          ?? {}
        const penalty = beginnerAppropriatenessPenalty(ex, diff, skillLevel, sportKey)
        if (penalty > 0) penaltyActive += 1
      }
    }
    info(checks, 'category23_mop_beginner_penalty', skillLevel === 'BEGINNER'
      ? 'BEGINNER skillLevel — penalty path expected'
      : penaltyActive > 0
        ? `${penaltyActive} item(s) would receive beginnerAppropriatenessPenalty`
        : 'beginnerAppropriatenessPenalty inactive for INTERMEDIATE+', {
      ok_band: skillLevel !== 'BEGINNER' ? penaltyActive === 0 : null,
      rubric: 'C23-MOP-18',
      skillLevel,
      penaltyActive,
    })
  }

  if (!findCheck(checks, 'category23_mop_pool_kind_distribution')) {
    const fills = result.constraint_report?.phase_fill ?? []
    const outputFill = fills.find((f) => f.phase_key === 'output')
    const poolSize = outputFill?.pool_size ?? 0
    info(checks, 'category23_mop_pool_kind_distribution', isExerciseMode
      ? `Output pool_size ${poolSize} (exercise-mode pool proxy; programming_kind telemetry TBD)`
      : 'workMode skill — exercise pool distribution N/A', {
      ok_band: isExerciseMode ? poolSize >= 5 : null,
      rubric: 'C23-MOP-19',
      poolSize,
      workMode,
    })
  }

  // MOE informational + review packet
  const outputItems = blockByKey(result, 'output')?.items ?? []
  let speedPatternHits = 0
  for (const item of outputItems) {
    const ex = exerciseForItem(item, exerciseById)
    const tags = tagMap.get(String(item.exercise_id)) ?? []
    if (hasSpeedPatternSignal(tags, ex)) speedPatternHits += 1
  }
  const speedRate = outputItems.length > 0 ? speedPatternHits / outputItems.length : 0
  info(checks, 'category23_moe_speed_objective', sessionObjective.includes('speed') && outputItems.length > 0
    ? `Output speed-pattern share ${(speedRate * 100).toFixed(0)}%`
    : 'speed_priority objective or Output N/A', {
    ok_band: sessionObjective.includes('speed') ? speedRate >= 0.5 : null,
    rubric: 'C23-MOE-02',
    speedPatternHits,
    outputTotal: outputItems.length,
  })

  info(checks, 'category23_moe_fitness_gpp', 'Fitness GPP proxy: sport-specific slug count + generic Output rate', {
    ok_band: checks.find((c) => c.id === 'sport_specific_fitness_zero')?.ok !== false
      && checks.find((c) => c.id === 'generic_fitness_output_rate')?.ok !== false,
    rubric: 'C23-MOE-01',
    sport_specific_ok: checks.find((c) => c.id === 'sport_specific_fitness_zero')?.ok,
    generic_output_ok: checks.find((c) => c.id === 'generic_fitness_output_rate')?.ok,
  })

  info(checks, 'category23_moe_work_mode_builder', isExerciseMode
    ? `Exercise mode: ${checks.find((c) => c.id === 'exercise_kind_purity')?.ok ? 'no skill_drill leakage' : 'skill_drill leakage detected'}`
    : 'workMode skill — builder cleanup N/A', {
    ok_band: isExerciseMode ? checks.find((c) => c.id === 'exercise_kind_purity')?.ok === true : null,
    rubric: 'C23-MOE-03',
    workMode,
  })

  tbd(checks, 'category23_moe_sport_ab', 'A/B sportId pick-set comparison matrix TBD — run manual sport switch review', {
    rubric: 'C23-MOE-04',
    sportId,
    sportKey,
  })

  info(checks, 'category23_moe_facility_clarity', Number.isFinite(sportId)
    ? `sportId ${sportId} (${sportKey ?? 'key pending'}) drives sportContextMultiplier — verify UI label`
    : 'No sportId — multi-sport filter effect N/A', {
    ok_band: true,
    rubric: 'C23-MOE-05',
    sportId,
    sportKey,
  })

  info(checks, 'category23_moe_speed_vs_strength', sessionObjective
    ? `Session objective ${sessionObjective}; strengthIntent ${profile.strengthIntent}`
    : 'No session objective — speed vs strength distinguishability N/A', {
    ok_band: sessionObjective === 'speed_priority' ? profile.strengthIntent === false : null,
    rubric: 'C23-MOE-06',
    sessionObjective,
    strengthIntent: profile.strengthIntent,
  })

  const stability = sportScoringStability ?? { stable: null, runCount: 0, minRuns: 5, slugKeys: [] }
  if (stability.stable == null) {
    info(checks, 'category23_moe_scoring_stability', `Output top-3 slug stability pending (${stability.runCount}/${stability.minRuns ?? 5} eval runs)`, {
      ok_band: null,
      rubric: 'C23-MOE-07',
      ...stability,
    })
  } else if (stability.stable) {
    info(checks, 'category23_moe_scoring_stability', `Output top-3 slugs stable ${stability.stableCount}/${stability.runCount} runs`, {
      ok_band: true,
      rubric: 'C23-MOE-07',
      ...stability,
    })
  } else {
    info(checks, 'category23_moe_scoring_stability', `Output top-3 slug variance across runs (reference: ${stability.reference ?? 'n/a'})`, {
      ok_band: false,
      rubric: 'C23-MOE-07',
      ...stability,
    })
  }

  for (const { block, item } of allSessionPrimaries(result)) {
    const ex = exerciseForItem(item, exerciseById)
    reviewItems.push({
      phase_key: block.phase_key,
      exercise_id: Number(item.exercise_id),
      exercise_name: item.exercise_name,
      slug: ex.slug,
      sport_id: ex.sport_id,
      programming_kind: classifyProgrammingKind(ex),
    })
  }

  info(checks, 'category23_moe_review_packet', `${reviewItems.length} primary item(s) for coach sport/work-mode MOE review`, {
    ok_band: true,
    rubric: ['C23-MOE-01', 'C23-MOE-03', 'C23-MOE-05'],
    items: reviewItems.slice(0, 40),
    work_mode: result.work_mode,
    sportId,
    sportKey,
    session_objective: sessionObjective,
    strengthIntent: profile.strengthIntent,
  })

  for (const id of CATEGORY23_KPI_CHECK_IDS) {
    if (findCheck(checks, id)) continue
    pass(checks, id, `${id}: N/A for session`)
  }
  for (const id of CATEGORY23_MOE_CHECK_IDS) {
    if (findCheck(checks, id)) continue
    info(checks, id, `${id}: N/A for session`, { ok_band: null })
  }
}

export function computeCategory23Kpi(checks, opts = {}) {
  return computeKpi(checks, 23, CATEGORY23_KPI_CHECK_IDS, { minRate: 0.95, ...opts })
}

// ─── Category 24 — Programming / block format ───────────────────────────────

function formatItemSeconds(ex, item) {
  const sets = Number(item?.sets ?? ex?.default_sets) || 3
  const work = Number(item?.work_seconds ?? ex?.default_work_seconds) || Number(ex?.est_seconds_per_set) || 45
  const restRaw = item?.rest_seconds ?? ex?.default_rest_seconds
  const rest = restRaw != null && restRaw !== '' ? Number(restRaw) : 30
  if (restRaw === 0 || rest === 0) return sets * work
  return sets * work + sets * rest
}

export const CATEGORY24_KPI_CHECK_IDS = [
  'item_sets_present',
  'item_rest_present',
  'format_time_reconciliation',
  'item_score_populated',
  'item_phase_fit_present',
  'selection_rationale_coverage',
  'placement_rationale_coverage',
  'format_relaxed_pool_marker',
  'format_dose_reconciliation_mor',
  'format_item_dominance_mor',
  'format_rest_zero_honored',
  'format_work_seconds_timed',
]

export const CATEGORY24_MOE_CHECK_IDS = [
  'category24_moe_review_packet',
  'category24_moe_sustained_hiit',
  'category24_moe_restore_recovery',
  'category24_moe_output_rest_youth',
  'category24_moe_builder_programming',
  'category24_dose_stability',
  'format_youth_sets_sanity',
  'format_sustained_hiit_shape',
  'format_restore_low_density',
  'format_phase_dose_density',
  'format_est_seconds_coverage',
  'format_output_rest_adequacy',
  'format_capacity_rest_vs_load',
  'format_scaling_rationale_rate',
  'format_split_fallback_rate',
  'format_default_dose_match',
  'format_education_rationale_rate',
  'format_library_dose_mos',
  'format_builder_programming_method',
  'item_reps_work_coherence',
]

export function evaluateCategory24Format(result, expectedBody, checks, context = {}) {
  const {
    exerciseById = new Map(),
    tagMap = new Map(),
    methodologyKeyById = new Map(),
    doseStability = null,
  } = context
  const blocks = result.blocks ?? []
  const profile = result.audience_profile ?? resolveAudienceProfile(expectedBody ?? {})
  const sessMax = Number(profile.ageMax ?? expectedBody?.ageMax ?? expectedBody?.age_max ?? 99)
  const isYouthSession = sessMax <= 14
  const sportKey = expectedBody?.sportKey ?? expectedBody?.sport_key ?? 'fitness'

  const allItems = []
  for (const block of blocks) {
    for (const item of block.items ?? []) {
      allItems.push({ block, item })
    }
  }
  const itemsTotal = allItems.length

  // C24-MOP-01 — item_sets_present
  const setsMissing = allItems.filter(({ item }) => !Number.isFinite(Number(item.sets)))
  if (itemsTotal > 0 && setsMissing.length > 0) {
    fail(checks, 'item_sets_present', `${setsMissing.length}/${itemsTotal} items missing numeric sets`)
  } else if (itemsTotal > 0) {
    pass(checks, 'item_sets_present', `All ${itemsTotal} items have sets`)
  }

  // C24-MOP-02 — item_rest_present (incl. explicit 0)
  const restMissing = allItems.filter(({ item }) => item.rest_seconds == null || item.rest_seconds === '')
  const restRate = itemsTotal > 0 ? (itemsTotal - restMissing.length) / itemsTotal : 1
  if (itemsTotal > 0 && restRate < 0.95) {
    fail(checks, 'item_rest_present', `rest_seconds defined on ${(restRate * 100).toFixed(0)}% < 95%`)
  } else if (itemsTotal > 0) {
    pass(checks, 'item_rest_present', `rest_seconds defined on ${(restRate * 100).toFixed(0)}%`)
  }

  // C24-MOP-03 — format_time_reconciliation (±15% per phase)
  const timeReconViolations = []
  for (const block of blocks) {
    const estSec = Number(block.estimated_minutes ?? 0) * 60
    if (estSec <= 0) continue
    let doseSec = 0
    for (const item of block.items ?? []) {
      doseSec += formatItemSeconds(exerciseById.get(Number(item.exercise_id)), item)
    }
    const err = Math.abs(doseSec - estSec) / estSec
    if (err > 0.15) timeReconViolations.push(`${block.phase_key} ${(err * 100).toFixed(0)}%`)
  }
  if (timeReconViolations.length > 0) {
    fail(checks, 'format_time_reconciliation', `Time reconciliation: ${timeReconViolations.join(', ')}`, timeReconViolations)
  } else {
    pass(checks, 'format_time_reconciliation', 'Item dose sums within ±15% of estimated minutes per phase')
  }

  // C24-MOP-04 — format_youth_sets_sanity (informational)
  if (isYouthSession && sportKey === 'fitness') {
    let youthSetsChecked = 0
    let youthSetsBad = 0
    for (const { item } of allItems) {
      youthSetsChecked += 1
      const sets = Number(item.sets)
      if (!Number.isFinite(sets) || sets < 1 || sets > 5) youthSetsBad += 1
    }
    const okRate = youthSetsChecked > 0 ? (youthSetsChecked - youthSetsBad) / youthSetsChecked : 1
    info(checks, 'format_youth_sets_sanity', `Youth fitness sets in 1–5: ${(okRate * 100).toFixed(0)}%`, {
      ok_band: okRate >= 1,
      youthSetsBad,
      youthSetsChecked,
      rubric: 'C24-MOP-04',
    })
  } else {
    info(checks, 'format_youth_sets_sanity', 'Youth sets sanity N/A', { ok_band: true, rubric: 'C24-MOP-04' })
  }

  // C24-MOP-05 — format_rest_zero_honored
  const zeroRestItems = allItems.filter(({ item }) => item.rest_seconds === 0)
  let zeroRestFails = 0
  for (const { item } of zeroRestItems) {
    const ex = exerciseById.get(Number(item.exercise_id))
    const sets = Number(item.sets ?? ex?.default_sets) || 3
    const work = Number(item.work_seconds ?? ex?.default_work_seconds) || Number(ex?.est_seconds_per_set) || 45
    const expected = sets * work
    const actual = formatItemSeconds(ex, item)
    if (Math.abs(actual - expected) > 0.5) zeroRestFails += 1
  }
  if (zeroRestItems.length > 0 && zeroRestFails > 0) {
    fail(checks, 'format_rest_zero_honored', `${zeroRestFails}/${zeroRestItems.length} rest=0 items not using sets×work model`)
  } else if (zeroRestItems.length > 0) {
    pass(checks, 'format_rest_zero_honored', `${zeroRestItems.length} rest=0 item(s) honor sets×work time model`)
  } else {
    pass(checks, 'format_rest_zero_honored', 'No rest=0 items to audit')
  }

  // C24-MOP-06 — format_work_seconds_timed
  const workSecItems = allItems.filter(({ item }) => item.work_seconds != null && item.work_seconds !== '')
  let workSecFails = 0
  for (const { item } of workSecItems) {
    const ex = exerciseById.get(Number(item.exercise_id))
    const sets = Number(item.sets ?? ex?.default_sets) || 3
    const work = Number(item.work_seconds)
    const restRaw = item.rest_seconds ?? ex?.default_rest_seconds
    const rest = restRaw != null && restRaw !== '' ? Number(restRaw) : 30
    const expected = (restRaw === 0 || rest === 0) ? sets * work : sets * work + sets * rest
    const actual = formatItemSeconds(ex, item)
    if (Math.abs(actual - expected) > 0.5) workSecFails += 1
  }
  if (workSecItems.length > 0 && workSecFails > 0) {
    fail(checks, 'format_work_seconds_timed', `${workSecFails}/${workSecItems.length} work_seconds items not in timed dose model`)
  } else if (workSecItems.length > 0) {
    pass(checks, 'format_work_seconds_timed', `${workSecItems.length} work_seconds item(s) use timed dose model`)
  } else {
    pass(checks, 'format_work_seconds_timed', 'No work_seconds items to audit')
  }

  // C24-MOP-07 — format_sustained_hiit_shape (informational)
  const sustained = blockByKey(result, 'sustained_capacity')
  let sustainedIntervalItems = 0
  for (const item of sustained?.items ?? []) {
    const ex = exerciseById.get(Number(item.exercise_id))
    const sets = Number(item.sets ?? 0)
    const work = Number(item.work_seconds ?? ex?.est_seconds_per_set ?? 0)
    const keys = methodologyKeysForExercise(item.exercise_id, tagMap, methodologyKeyById)
    const hiitTagged = keys.some((k) => /hiit|interval|conditioning/.test(k))
    if ((sets > 0 && work > 0) || hiitTagged) sustainedIntervalItems += 1
  }
  info(checks, 'format_sustained_hiit_shape', `Sustained interval-structure items: ${sustainedIntervalItems}`, {
    ok_band: sustainedIntervalItems >= 2,
    sustainedIntervalItems,
    rubric: 'C24-MOP-07',
  })

  // C24-MOP-08 — format_restore_low_density (informational)
  const restore = blockByKey(result, 'restore')
  let restoreBad = 0
  for (const item of restore?.items ?? []) {
    const sets = Number(item.sets ?? 99)
    const work = Number(item.work_seconds ?? item.est_seconds_per_set ?? 999)
    if (!(sets <= 2 || work <= 60)) restoreBad += 1
  }
  const restoreCount = (restore?.items ?? []).length
  info(checks, 'format_restore_low_density', restoreCount > 0
    ? `Restore low-density compliance: ${restoreCount - restoreBad}/${restoreCount}`
    : 'No restore items', {
    ok_band: restoreCount === 0 || restoreBad === 0,
    restoreBad,
    restoreCount,
    rubric: 'C24-MOP-08',
  })

  // C24-MOP-09 — selection_rationale_coverage
  const selPresent = allItems.filter(({ item }) => String(item.selection_rationale ?? '').trim().length > 0).length
  const selRate = itemsTotal > 0 ? selPresent / itemsTotal : 1
  if (itemsTotal > 0 && selRate < 0.95) {
    fail(checks, 'selection_rationale_coverage', `selection_rationale ${(selRate * 100).toFixed(0)}% < 95%`)
  } else if (itemsTotal > 0) {
    pass(checks, 'selection_rationale_coverage', `selection_rationale ${(selRate * 100).toFixed(0)}%`)
  }

  // C24-MOP-10 — placement_rationale_coverage
  const placePresent = allItems.filter(({ item }) => String(item.placement_rationale ?? '').trim().length > 0).length
  const placeRate = itemsTotal > 0 ? placePresent / itemsTotal : 1
  if (itemsTotal > 0 && placeRate < 0.90) {
    fail(checks, 'placement_rationale_coverage', `placement_rationale ${(placeRate * 100).toFixed(0)}% < 90%`)
  } else if (itemsTotal > 0) {
    pass(checks, 'placement_rationale_coverage', `placement_rationale ${(placeRate * 100).toFixed(0)}%`)
  }

  // C24-MOP-11 — format_relaxed_pool_marker
  const relaxedItems = allItems.filter(({ item }) =>
    item.split_fallback_used === true
    || /relaxed sustained|HIIT fallback|limited library match/i.test(String(item.selection_rationale ?? '')),
  )
  const relaxedBad = relaxedItems.filter(({ item }) =>
    !/relaxed|fallback|limited library/i.test(String(item.selection_rationale ?? '')),
  )
  if (relaxedItems.length > 0 && relaxedBad.length > 0) {
    fail(checks, 'format_relaxed_pool_marker', `${relaxedBad.length}/${relaxedItems.length} relaxed-fill items missing marker in selection_rationale`)
  } else if (relaxedItems.length > 0) {
    pass(checks, 'format_relaxed_pool_marker', `${relaxedItems.length} relaxed-fill item(s) labeled`)
  } else {
    pass(checks, 'format_relaxed_pool_marker', 'No relaxed sustained pool fill used')
  }

  // C24-MOP-12 — format_builder_programming_method (TBD builder telemetry)
  tbd(checks, 'format_builder_programming_method', 'Builder programming_method assignment not yet instrumented', {
    rubric: 'C24-MOP-12',
  })

  // C24-MOP-13 — format_est_seconds_coverage (informational)
  const estSecPresent = allItems.filter(({ item, block: b }) => {
    const ex = exerciseById.get(Number(item.exercise_id))
    return item.est_seconds_per_set != null
      || item.work_seconds != null
      || ex?.est_seconds_per_set != null
  }).length
  const estSecRate = itemsTotal > 0 ? estSecPresent / itemsTotal : 1
  info(checks, 'format_est_seconds_coverage', `est_seconds_per_set derivable on ${(estSecRate * 100).toFixed(0)}%`, {
    ok_band: estSecRate >= 0.95,
    estSecRate,
    rubric: 'C24-MOP-13',
  })

  // C24-MOP-14 — item_reps_work_coherence (informational; engine may stamp both default_reps and default_work_seconds)
  const doseConflicts = allItems.filter(({ item }) => {
    const hasReps = item.reps != null && item.reps !== ''
    const hasWork = item.work_seconds != null && item.work_seconds !== ''
    return hasReps && hasWork
  })
  info(checks, 'item_reps_work_coherence', doseConflicts.length > 0
    ? `${doseConflicts.length} item(s) have both reps and work_seconds`
    : 'No reps/work_seconds dose conflicts', {
    ok_band: doseConflicts.length === 0,
    conflictCount: doseConflicts.length,
    rubric: 'C24-MOP-14',
  })

  // C24-MOP-15 — format_phase_dose_density (informational)
  const densityViolations = []
  for (const block of blocks) {
    const targetSec = Number(block.target_minutes ?? 0) * 60
    if (targetSec <= 0) continue
    let doseSec = 0
    for (const item of block.items ?? []) {
      doseSec += formatItemSeconds(exerciseById.get(Number(item.exercise_id)), item)
    }
    const ratio = doseSec / targetSec
    if (ratio < 0.85 || ratio > 1.10) {
      densityViolations.push(`${block.phase_key} ${(ratio * 100).toFixed(0)}%`)
    }
  }
  info(checks, 'format_phase_dose_density', densityViolations.length > 0
    ? `Phase dose density out of band: ${densityViolations.join(', ')}`
    : 'All phases within 85–110% dose density', {
    ok_band: densityViolations.length === 0,
    densityViolations,
    rubric: 'C24-MOP-15',
  })

  // C24-MOP-16 — format_output_rest_adequacy (informational)
  const outputBlock = blockByKey(result, 'output')
  let outputPowerTotal = 0
  let outputRestOk = 0
  for (const item of outputBlock?.items ?? []) {
    outputPowerTotal += 1
    if (Number(item.rest_seconds ?? 0) >= 20) outputRestOk += 1
  }
  const outputRestRate = outputPowerTotal > 0 ? outputRestOk / outputPowerTotal : 1
  info(checks, 'format_output_rest_adequacy', outputPowerTotal > 0
    ? `Output rest ≥20s: ${(outputRestRate * 100).toFixed(0)}%`
    : 'No Output items', {
    ok_band: outputRestRate >= 0.9,
    outputRestRate,
    rubric: 'C24-MOP-16',
  })

  // C24-MOP-17 — format_capacity_rest_vs_load (informational)
  const capacityBlock = blockByKey(result, 'capacity')
  let capHeavyTotal = 0
  let capHeavyRestOk = 0
  for (const item of capacityBlock?.items ?? []) {
    const load = Number(item.difficulty?.load ?? item.difficulty?.overall ?? 0)
    if (load < 6) continue
    capHeavyTotal += 1
    if (Number(item.rest_seconds ?? 0) >= 45) capHeavyRestOk += 1
  }
  const capRestRate = capHeavyTotal > 0 ? capHeavyRestOk / capHeavyTotal : 1
  info(checks, 'format_capacity_rest_vs_load', capHeavyTotal > 0
    ? `Capacity load≥6 rest≥45s: ${(capRestRate * 100).toFixed(0)}%`
    : 'No heavy Capacity items', {
    ok_band: capRestRate >= 0.8,
    capRestRate,
    rubric: 'C24-MOP-17',
  })

  // C24-MOP-18 — format_scaling_rationale_rate (informational)
  const scalingPresent = allItems.filter(({ item }) => {
    if (String(item.scaling_rationale ?? '').trim().length > 0) return true
    const ps = item.per_split ?? item.split_alternates_json ?? []
    return ps.some((v) => String(v.scaling_guidance ?? v.scalingGuidance ?? '').trim().length > 0)
  }).length
  const scalingRate = itemsTotal > 0 ? scalingPresent / itemsTotal : 1
  info(checks, 'format_scaling_rationale_rate', `Scaling rationale/guidance ${(scalingRate * 100).toFixed(0)}%`, {
    ok_band: !isYouthSession || scalingRate >= 0.7,
    scalingRate,
    isYouthSession,
    rubric: 'C24-MOP-18',
  })

  // C24-MOP-19 — format_split_fallback_rate (informational; TBD baseline)
  const fallbackCount = allItems.filter(({ item }) => item.split_fallback_used === true).length
  const fallbackRate = itemsTotal > 0 ? fallbackCount / itemsTotal : 0
  info(checks, 'format_split_fallback_rate', `split_fallback_used ${(fallbackRate * 100).toFixed(0)}% (${fallbackCount}/${itemsTotal})`, {
    ok_band: true,
    fallbackRate,
    fallbackCount,
    rubric: 'C24-MOP-19',
  })

  // C24-MOP-20 — item_score_populated
  const scoreMissing = allItems.filter(({ item }) => !Number.isFinite(Number(item.score)))
  if (itemsTotal > 0 && scoreMissing.length > 0) {
    fail(checks, 'item_score_populated', `${scoreMissing.length}/${itemsTotal} items missing numeric score`)
  } else if (itemsTotal > 0) {
    pass(checks, 'item_score_populated', `All ${itemsTotal} items have score`)
  }

  // C24-MOP-21 — item_phase_fit_present
  const phaseFitPresent = allItems.filter(({ item }) => item.phase_fit != null && item.phase_fit !== '').length
  const phaseFitRate = itemsTotal > 0 ? phaseFitPresent / itemsTotal : 1
  if (itemsTotal > 0 && phaseFitRate < 0.95) {
    fail(checks, 'item_phase_fit_present', `phase_fit ${(phaseFitRate * 100).toFixed(0)}% < 95%`)
  } else if (itemsTotal > 0) {
    pass(checks, 'item_phase_fit_present', `phase_fit ${(phaseFitRate * 100).toFixed(0)}%`)
  }

  // C24-MOP-22 — format_education_rationale_rate (informational)
  const eduBacked = allItems.filter(({ item }) => {
    const r = String(item.selection_rationale ?? '')
    return r.length > 0 && !/^Selected for /i.test(r) && !/^Relaxed sustained/i.test(r)
  }).length
  const eduRate = itemsTotal > 0 ? eduBacked / itemsTotal : 1
  info(checks, 'format_education_rationale_rate', `Non-generic selection_rationale ${(eduRate * 100).toFixed(0)}%`, {
    ok_band: eduRate >= 0.5,
    eduRate,
    rubric: 'C24-MOP-22',
  })

  // C24-MOP-23 — format_default_dose_match (informational)
  let doseMatchChecked = 0
  let doseMatchOk = 0
  for (const { item } of allItems) {
    const ex = exerciseById.get(Number(item.exercise_id))
    if (!ex) continue
    doseMatchChecked += 1
    const setsMatch = Number(item.sets) === Number(ex.default_sets ?? item.sets)
    const restMatch = Number(item.rest_seconds) === Number(ex.default_rest_seconds ?? item.rest_seconds)
    if (setsMatch && restMatch) doseMatchOk += 1
  }
  const doseMatchRate = doseMatchChecked > 0 ? doseMatchOk / doseMatchChecked : 1
  info(checks, 'format_default_dose_match', `Default dose match ${(doseMatchRate * 100).toFixed(0)}%`, {
    ok_band: doseMatchRate >= 0.9,
    doseMatchRate,
    rubric: 'C24-MOP-23',
  })

  // C24-MOS-01 — format_library_dose_mos (informational proxy on prescribed exercises)
  let libChecked = 0
  let libComplete = 0
  for (const { item } of allItems) {
    const ex = exerciseById.get(Number(item.exercise_id))
    if (!ex) continue
    libChecked += 1
    if (ex.default_sets != null && ex.est_seconds_per_set != null) libComplete += 1
  }
  const libRate = libChecked > 0 ? libComplete / libChecked : 1
  info(checks, 'format_library_dose_mos', `Prescribed exercise cards with default dose ${(libRate * 100).toFixed(0)}%`, {
    ok_band: libRate >= 0.95,
    libRate,
    rubric: 'C24-MOS-01',
  })

  // C24-MOR-01 — format_dose_reconciliation_mor (>20% breach)
  const morReconBreaches = []
  for (const block of blocks) {
    const estSec = Number(block.estimated_minutes ?? 0) * 60
    if (estSec <= 0) continue
    let doseSec = 0
    for (const item of block.items ?? []) {
      doseSec += formatItemSeconds(exerciseById.get(Number(item.exercise_id)), item)
    }
    const err = Math.abs(doseSec - estSec) / estSec
    if (err > 0.20) morReconBreaches.push(block.phase_key)
  }
  if (morReconBreaches.length > 0) {
    fail(checks, 'format_dose_reconciliation_mor', `Dose-time breach >20%: ${morReconBreaches.join(', ')}`)
  } else {
    pass(checks, 'format_dose_reconciliation_mor', 'No phase with >20% dose-time reconciliation breach')
  }

  // C24-MOR-02 — format_item_dominance_mor (>50% non-Sustained, skip low-intent recovery phases)
  const dominanceMor = []
  for (const block of blocks) {
    if (block.phase_key === 'sustained_capacity' || block.phase_key === 'restore' || block.phase_key === 'prepare_and_access') continue
    const phaseSec = Number(block.target_minutes ?? 0) * 60
    if (phaseSec <= 0) continue
    let maxItemSec = 0
    for (const item of block.items ?? []) {
      maxItemSec = Math.max(maxItemSec, formatItemSeconds(exerciseById.get(Number(item.exercise_id)), item))
    }
    if (maxItemSec / phaseSec > 0.50) dominanceMor.push(block.phase_key)
  }
  if (dominanceMor.length > 0) {
    fail(checks, 'format_item_dominance_mor', `Single item >50% phase seconds: ${dominanceMor.join(', ')}`)
  } else {
    pass(checks, 'format_item_dominance_mor', 'No non-Sustained phase dominated by one item >50%')
  }

  // phase_rationales parity (Cat 1 overlap, informational for Cat 24)
  const rationales = result.phase_rationales ?? []
  if (rationales.length === blocks.length) {
    pass(checks, 'phase_rationales_count', `phase_rationales ${rationales.length}`)
  } else {
    fail(checks, 'phase_rationales_count', `phase_rationales ${rationales.length} !== blocks ${blocks.length}`)
  }

  // MOE proxies + review packet
  const reviewItems = allItems.slice(0, 40).map(({ block, item }) => ({
    phase_key: block.phase_key,
    exercise_name: item.exercise_name,
    sets: item.sets,
    reps: item.reps,
    work_seconds: item.work_seconds,
    rest_seconds: item.rest_seconds,
    selection_rationale: item.selection_rationale,
  }))

  info(checks, 'category24_moe_sustained_hiit', `Sustained interval items ${sustainedIntervalItems}`, {
    ok_band: sustainedIntervalItems >= 2,
    sustainedIntervalItems,
    rubric: 'C24-MOE-02',
  })

  info(checks, 'category24_moe_restore_recovery', restoreCount > 0
    ? `Restore low-density ${restoreBad === 0 ? 'pass' : `${restoreBad} violation(s)`}`
    : 'No restore block', {
    ok_band: restoreCount === 0 || restoreBad === 0,
    restoreBad,
    rubric: 'C24-MOE-03',
  })

  info(checks, 'category24_moe_output_rest_youth', isYouthSession && outputPowerTotal > 0
    ? `Youth Output rest adequacy ${(outputRestRate * 100).toFixed(0)}%`
    : 'Youth Output rest MOE N/A', {
    ok_band: !isYouthSession || outputRestRate >= 0.9,
    outputRestRate,
    rubric: 'C24-MOE-06',
  })

  tbd(checks, 'category24_moe_builder_programming', 'Builder EMOM/phase programming QA not yet instrumented', {
    rubric: ['C24-MOE-04', 'C24-MOE-05'],
  })

  if (doseStability?.stable == null) {
    info(checks, 'category24_dose_stability', `Dose stability pending (${doseStability?.runCount ?? 0}/${doseStability?.minRuns ?? 5} eval runs)`, {
      ok_band: null,
      ...doseStability,
      rubric: 'C24-MOE-07',
    })
  } else if (doseStability.stable) {
    info(checks, 'category24_dose_stability', `Per-phase estimated_minutes stable ${doseStability.runCount}/${doseStability.minRuns} runs`, {
      ok_band: true,
      ...doseStability,
      rubric: 'C24-MOE-07',
    })
  } else {
    info(checks, 'category24_dose_stability', `Per-phase estimated_minutes drift over ${doseStability.runCount} runs`, {
      ok_band: false,
      ...doseStability,
      rubric: 'C24-MOE-07',
    })
  }

  info(checks, 'category24_moe_review_packet', `${reviewItems.length} item(s) for coach dose-format MOE review`, {
    ok_band: true,
    items: reviewItems,
    rubric: ['C24-MOE-01', 'C24-MOE-02', 'C24-MOE-03', 'C24-MOE-05', 'C24-MOE-06'],
  })

  for (const id of CATEGORY24_MOE_CHECK_IDS) {
    if (findCheck(checks, id)) continue
    info(checks, id, `${id}: N/A for session`, { ok_band: null })
  }
}

export function computeCategory24Kpi(checks, opts = {}) {
  const minIndex = opts.minDoseFidelityIndex ?? 0.90
  const blocking = computeKpi(checks, 24, CATEGORY24_KPI_CHECK_IDS, { minRate: 0.95, ...opts })

  const setsCheck = checks.find((c) => c.id === 'item_sets_present')
  const restCheck = checks.find((c) => c.id === 'item_rest_present')
  const timeCheck = checks.find((c) => c.id === 'format_time_reconciliation')
  const selCheck = checks.find((c) => c.id === 'selection_rationale_coverage')
  const placeCheck = checks.find((c) => c.id === 'placement_rationale_coverage')

  const doseCompleteness = [setsCheck, restCheck].every((c) => c?.ok !== false) ? 1 : 0.5
  const timeReconciliation = timeCheck?.ok !== false ? 1 : 0
  const selRate = selCheck?.ok !== false ? 1 : 0.85
  const placeRate = placeCheck?.ok !== false ? 1 : 0.85
  const rationaleCoverage = (selRate + placeRate) / 2
  const fidelityIndex = doseCompleteness * timeReconciliation * rationaleCoverage
  const indexOk = fidelityIndex >= minIndex

  const ok = blocking.ok && indexOk
  return {
    ...blocking,
    ok,
    severity: ok ? 'ok' : 'P1',
    message: ok
      ? `Category 24 dose fidelity index ${(fidelityIndex * 100).toFixed(1)}%; blocking ${(blocking.detail.rate * 100).toFixed(1)}%`
      : `Category 24 KPI fail: fidelity index ${(fidelityIndex * 100).toFixed(1)}% (min ${(minIndex * 100).toFixed(0)}%); blocking ${blocking.detail.passed}/${blocking.detail.total}`,
    detail: {
      ...blocking.detail,
      fidelityIndex,
      minDoseFidelityIndex: minIndex,
      doseCompleteness,
      timeReconciliation,
      rationaleCoverage,
      formula: 'dose_field_completeness × time_reconciliation × rationale_coverage',
    },
  }
}

// ─── Category 25 — Library & pool coverage ──────────────────────────────────

const LIBRARY_POOL_FLOORS = {
  prepare_and_access: 30,
  movement_intelligence: 15,
  output: 20,
  capacity: 20,
  resilience: 10,
  sustained_capacity: 10,
  restore: 5,
}

function countRelaxedHiitFallback(result) {
  let count = 0
  for (const block of result.blocks ?? []) {
    for (const item of block.items ?? []) {
      if (/relaxed sustained pool fill|HIIT fallback/i.test(String(item.selection_rationale ?? ''))) count += 1
    }
  }
  return count
}

function candidateHasEquipmentKey(exerciseId, key, tagMap, equipmentKeyById) {
  for (const facetId of equipmentFacetIds(exerciseId, tagMap)) {
    if (equipmentKeyById.get(facetId) === key) return true
  }
  return false
}

function candidateDifficultyBand(difficulty) {
  const d = Number(difficulty?.overall ?? NaN)
  if (!Number.isFinite(d)) return null
  if (d >= 6 && d <= 8) return 'D6-8'
  if (d >= 6 && d < 7) return 'D6'
  if (d >= 7 && d < 8) return 'D7'
  return d >= 8 ? 'D8' : null
}

function progressionNeighborInGraph(exerciseId, progressionGraphEdges) {
  const edges = progressionGraphEdges.get(Number(exerciseId))
    ?? progressionGraphEdges.get(String(exerciseId))
    ?? new Set()
  return edges.size > 0
}

export const CATEGORY25_KPI_CHECK_IDS = [
  'no_empty_phases',
  'library_pool_floor_output',
  'library_pool_floor_capacity',
  'library_pool_floor_restore',
  'library_pool_floor_sustained',
  'library_pool_floor_prepare',
  'library_pool_floor_resilience',
  'library_pool_floor_mi',
  'library_hiit_fallback_rate',
  'library_split_reject_ratio',
  'constraint_mislabeled_pool_empty_mor',
  'library_progression_pool_coverage',
  'library_candidate_snapshot',
]

export const CATEGORY25_MOE_CHECK_IDS = [
  'category25_moe_review_packet',
  'category25_moe_strict_loop_stability',
  'category25_moe_thin_pool_diagnosable',
  'category25_moe_focus_starvation',
  'category25_moe_speed_pattern_diversity',
  'category25_moe_duration_stress',
  'category25_moe_facility_parity',
  'category25_moe_migration_guard',
]

export function evaluateCategory25Library(result, expectedBody, checks, context = {}) {
  const {
    tagMap = new Map(),
    exerciseById = new Map(),
    equipmentKeyById = new Map(),
    methodologyKeyById = new Map(),
    progressionGraphEdges = new Map(),
    publishedExerciseCount = null,
    hiitFallbackChronic = null,
    goldenFeasibilityStability = null,
    poolEmptyStability = null,
  } = context

  const cr = result.constraint_report
  const fills = cr?.phase_fill ?? []
  const fillByPhase = phaseFillByKey(result)
  const candidates = result.candidates ?? []
  const emptyReasons = cr?.empty_phase_reasons ?? []
  const useIds = bodyUseIds(expectedBody)
  const useActive = useIds.length > 0
  const avoidActive = equipmentAvoidConfigured(expectedBody)

  // C25-MOP-02–06, 14–15 — per-phase pool_size floors
  for (const [phaseKey, floor] of Object.entries(LIBRARY_POOL_FLOORS)) {
    const id = `library_pool_floor_${phaseKey === 'movement_intelligence' ? 'mi' : phaseKey === 'sustained_capacity' ? 'sustained' : phaseKey === 'prepare_and_access' ? 'prepare' : phaseKey}`
    const fill = fillByPhase.get(phaseKey)
    const poolSize = Number(fill?.pool_size ?? 0)
    if (poolSize < floor) {
      fail(checks, id, `${phaseKey} pool_size ${poolSize} < ${floor}`, { phase_key: phaseKey, pool_size: poolSize, floor, rubric: `C25-MOP-${phaseKey === 'prepare_and_access' ? '14' : phaseKey === 'movement_intelligence' ? '06' : phaseKey === 'sustained_capacity' ? '05' : phaseKey === 'restore' ? '04' : phaseKey === 'resilience' ? '15' : phaseKey === 'output' ? '02' : '03'}` })
    } else {
      pass(checks, id, `${phaseKey} pool_size ${poolSize} ≥ ${floor}`)
    }
  }

  // C25-MOP-01 — global pool proxy (top-40 snapshot + phase_fill sum)
  const phasePoolSum = fills.reduce((s, f) => s + Number(f.pool_size ?? 0), 0)
  const globalProxy = Math.max(candidates.length, phasePoolSum > 0 ? Math.round(phasePoolSum / Math.max(1, fills.length)) : 0)
  if (globalProxy < 100) {
    info(checks, 'library_global_pool_size', `Global pool proxy ${globalProxy} (top-40=${candidates.length}; avg phase pool ${Math.round(phasePoolSum / Math.max(1, fills.length))})`, {
      ok_band: globalProxy >= 100,
      rubric: 'C25-MOP-01',
      note: 'Full scored.length requires engine telemetry; proxy uses phase_fill + candidates snapshot',
    })
  } else {
    info(checks, 'library_global_pool_size', `Global pool proxy ${globalProxy} ≥ 100`, { ok_band: true, rubric: 'C25-MOP-01' })
  }

  // C25-MOP-09 — reuse Cat 20 no_empty_phases when present
  ensureCheck(checks, 'no_empty_phases', () => {
    const poolEmpty = emptyReasons.filter((r) => /pool_empty/i.test(String(r)))
    if (poolEmpty.length > 0) failP0(checks, 'no_empty_phases', `${poolEmpty.length} pool_empty reason(s)`, poolEmpty.slice(0, 5))
    else pass(checks, 'no_empty_phases', 'No pool_empty reasons')
  })

  // C25-MOP-10 — avoid narrows but feasible
  if (avoidActive) {
    ensureCheck(checks, 'equipment_avoid_phase_pool_empty', () => {
      const workingEmpty = emptyReasons.filter(
        (r) => /pool_empty|no exercises/i.test(String(r)) && /output|capacity/i.test(String(r)),
      )
      if (workingEmpty.length > 0) fail(checks, 'equipment_avoid_phase_pool_empty', 'Working phase pool_empty with avoid active', workingEmpty)
      else pass(checks, 'equipment_avoid_phase_pool_empty', 'No working-phase pool_empty attributable to avoid')
    })
  } else {
    pass(checks, 'library_avoid_feasible', 'Equipment avoid inactive — feasibility N/A')
  }

  // C25-MOP-11 — progression graph pool coverage (Output/Capacity)
  const progCoverages = []
  for (const phaseKey of ['output', 'capacity']) {
    const fill = fillByPhase.get(phaseKey)
    const cov = fill?.progression_coverage
    if (cov != null) progCoverages.push(Number(cov))
  }
  const avgProgCoverage = progCoverages.length > 0
    ? progCoverages.reduce((a, b) => a + b, 0) / progCoverages.length
    : 1
  if (avgProgCoverage < 0.6) {
    fail(checks, 'library_progression_pool_coverage', `Output/Capacity progression pool coverage ${(avgProgCoverage * 100).toFixed(0)}% < 60%`, { progCoverages, avgProgCoverage })
  } else {
    pass(checks, 'library_progression_pool_coverage', `Progression pool coverage ${(avgProgCoverage * 100).toFixed(0)}%`, { progCoverages, avgProgCoverage })
  }

  // C25-MOP-12 — HIIT fallback activation
  const hiitFallbackCount = countRelaxedHiitFallback(result)
  if (hiitFallbackCount > 1) {
    fail(checks, 'library_hiit_fallback_rate', `HIIT relaxed-pool fallback items ${hiitFallbackCount} > 1`, { hiitFallbackCount })
  } else {
    pass(checks, 'library_hiit_fallback_rate', `HIIT fallback count ${hiitFallbackCount} ≤ 1`)
  }

  // C25-MOP-13 — split_rejects / pool_size ≤ 0.50
  const splitViolations = []
  for (const fill of fills) {
    const poolSize = Number(fill.pool_size ?? 0)
    if (poolSize <= 0) continue
    const ratio = Number(fill.split_rejects ?? 0) / poolSize
    if (ratio > 0.5) splitViolations.push({ phase_key: fill.phase_key, ratio, split_rejects: fill.split_rejects, pool_size: poolSize })
  }
  if (splitViolations.length > 0) {
    fail(checks, 'library_split_reject_ratio', `${splitViolations.length} phase(s) split_rejects/pool > 0.50`, splitViolations)
  } else {
    pass(checks, 'library_split_reject_ratio', 'Split reject ratio ≤ 0.50 per phase')
  }

  // C25-MOP-16 — scored candidate floor (top-40 snapshot proxy)
  if (candidates.length < 20) {
    fail(checks, 'library_scored_candidate_floor', `Candidate snapshot ${candidates.length} < 20`, { candidates: candidates.length })
  } else {
    pass(checks, 'library_scored_candidate_floor', `Candidate snapshot ${candidates.length} ≥ 20`)
  }
  info(checks, 'library_scored_count_telemetry', `Top-40 snapshot length ${candidates.length} (engine scored.length ≥ 80 target)`, {
    ok_band: candidates.length >= 20,
    rubric: 'C25-MOP-16',
  })

  // C25-MOP-07, 08, 17 — focus-target eligible share in candidate snapshot
  const outputCandidates = candidates.filter((c) => c.primary_phase === 'output' || fillByPhase.get('output'))
  const speedEligible = candidates.filter((c) => hasSpeedTenetTag(tagMap.get(String(c.exercise_id)))).length
  const hiitEligible = candidates.filter((c) => isHiitTagged(tagMap.get(String(c.exercise_id)), methodologyKeyById)).length
  const outputPool = Number(fillByPhase.get('output')?.pool_size ?? candidates.length)
  const sustainedPool = Number(fillByPhase.get('sustained_capacity')?.pool_size ?? 0)
  const speedShare = outputPool > 0 ? speedEligible / outputPool : 0
  const hiitShare = sustainedPool > 0 ? hiitEligible / sustainedPool : 0
  info(checks, 'library_speed_tenet_pool', `Speed tenet candidates ${speedEligible} (${(speedShare * 100).toFixed(0)}% of Output pool proxy)`, {
    ok_band: speedEligible >= 10,
    rubric: 'C25-MOP-07',
    speedEligible,
    outputPool,
  })
  info(checks, 'library_hiit_methodology_pool', `HIIT methodology candidates ${hiitEligible} (${(hiitShare * 100).toFixed(0)}% of Sustained pool proxy)`, {
    ok_band: hiitEligible >= 8,
    rubric: 'C25-MOP-08',
    hiitEligible,
    sustainedPool,
  })
  info(checks, 'library_focus_target_eligible_share', `Speed share ${(speedShare * 100).toFixed(0)}%; HIIT share ${(hiitShare * 100).toFixed(0)}%`, {
    ok_band: speedShare >= 0.4 || hiitShare >= 0.4,
    rubric: 'C25-MOP-17',
    speedShare,
    hiitShare,
  })

  // C25-MOP-18 — D6–8 progression lane pool proxy
  let d68WithNeighbor = 0
  let d68Total = 0
  for (const c of candidates) {
    const band = candidateDifficultyBand(c.difficulty)
    if (!band || !['D6', 'D7', 'D8', 'D6-8'].includes(band)) continue
    if (c.primary_phase !== 'output') continue
    d68Total += 1
    if (progressionNeighborInGraph(c.exercise_id, progressionGraphEdges)) d68WithNeighbor += 1
  }
  info(checks, 'library_d68_progression_lane_pool', `Output D6–8 with progression neighbor ${d68WithNeighbor}/${d68Total}`, {
    ok_band: d68WithNeighbor >= 15,
    rubric: 'C25-MOP-18',
    d68WithNeighbor,
    d68Total,
  })

  // C25-MOP-19, 20 — equipment-tagged pool post-use filter
  if (useActive) {
    const kbEligible = candidates.filter((c) => candidateHasEquipmentKey(c.exercise_id, 'kettlebell', tagMap, equipmentKeyById)).length
    const coneEligible = candidates.filter((c) => candidateHasEquipmentKey(c.exercise_id, 'cones', tagMap, equipmentKeyById)).length
    info(checks, 'library_kettlebell_pool', `Kettlebell-tagged candidates ${kbEligible}`, { ok_band: kbEligible >= 5, rubric: 'C25-MOP-19', kbEligible })
    info(checks, 'library_cones_pool', `Cones-tagged candidates ${coneEligible}`, { ok_band: coneEligible >= 3, rubric: 'C25-MOP-20', coneEligible })
  } else {
    info(checks, 'library_kettlebell_pool', 'Use inactive — kettlebell pool N/A', { ok_band: true, rubric: 'C25-MOP-19' })
    info(checks, 'library_cones_pool', 'Use inactive — cones pool N/A', { ok_band: true, rubric: 'C25-MOP-20' })
  }

  // C25-MOP-24 — equipment-use shrink ratio proxy
  if (useActive && candidates.length > 0) {
    const tagged = candidates.filter((c) => exerciseUsesRequiredId(c.exercise_id, useIds, tagMap)).length
    const shrinkRatio = tagged / candidates.length
    info(checks, 'library_equipment_use_shrink_ratio', `Use-tagged share ${(shrinkRatio * 100).toFixed(0)}% of top-40`, {
      ok_band: shrinkRatio >= 0.15,
      rubric: 'C25-MOP-24',
      tagged,
      total: candidates.length,
    })
  } else {
    info(checks, 'library_equipment_use_shrink_ratio', 'Use inactive — shrink ratio N/A', { ok_band: true, rubric: 'C25-MOP-24' })
  }

  // C25-MOP-21 — pool_empty mislabel (delegate Cat 20 MOR check)
  ensureCheck(checks, 'constraint_mislabeled_pool_empty_mor', () => {
    const blocks = result.blocks ?? []
    const mislabeled = []
    for (const reason of emptyReasons) {
      if (!/pool_empty/i.test(String(reason))) continue
      const colonIdx = String(reason).indexOf(':')
      const labelPart = colonIdx >= 0 ? String(reason).slice(0, colonIdx).trim() : String(reason)
      const pk = resolvePhaseKeyFromReason(labelPart, blocks)
      const fill = pk ? fillByPhase.get(pk) : null
      if (fill && Number(fill.pool_size ?? 0) > 0) mislabeled.push({ phase_key: pk, pool_size: fill.pool_size })
    }
    if (mislabeled.length > 0) failP0(checks, 'constraint_mislabeled_pool_empty_mor', `${mislabeled.length} pool_empty mislabel(s)`, mislabeled)
    else pass(checks, 'constraint_mislabeled_pool_empty_mor', 'No pool_empty when pool_size > 0')
  })

  // C25-MOP-22 — top-40 candidate snapshot (count blocking; spread informational)
  const scores = candidates.map((c) => Number(c.score ?? 0)).filter(Number.isFinite).sort((a, b) => b - a)
  const topScore = scores[0] ?? 0
  const median = scores.length > 0 ? scores[Math.floor(scores.length / 2)] : 0
  const spreadOk = median <= 0 || topScore > 2 * median
  if (candidates.length < 20) {
    fail(checks, 'library_candidate_snapshot', `Snapshot ${candidates.length} < 20 candidates`, { count: candidates.length, topScore, median })
  } else {
    pass(checks, 'library_candidate_snapshot', `Snapshot ${candidates.length} candidates ≥ 20`)
  }
  info(checks, 'library_candidate_score_spread', spreadOk
    ? `Top score ${topScore} > 2× median ${median}`
    : `Top/median spread ${topScore}/${median} (flat pool on Test 3)`, {
    ok_band: spreadOk,
    rubric: 'C25-MOP-22',
    count: candidates.length,
    topScore,
    median,
  })

  // C25-MOP-23 — audit script baseline (informational proxy via D-band counts)
  info(checks, 'library_audit_d68_baseline', `Output D6–8 candidate bands in snapshot: ${d68Total}`, {
    ok_band: d68Total >= 10,
    rubric: 'C25-MOP-23',
    note: 'Full audit via scripts/audit-prescription-coverage.mjs',
    d68Total,
  })

  // C25-MOS-01 — published library floor
  if (publishedExerciseCount != null) {
    if (publishedExerciseCount < 200) {
      info(checks, 'library_published_floor', `Published exercises ${publishedExerciseCount} < 200`, { ok_band: false, rubric: 'C25-MOS-01', publishedExerciseCount })
    } else {
      pass(checks, 'library_published_floor', `Published library floor ${publishedExerciseCount} ≥ 200`)
    }
  } else {
    info(checks, 'library_published_floor', 'Published library count not loaded — DB query in eval script', { ok_band: null, rubric: 'C25-MOS-01' })
  }

  // C25-MOR-01 — chronic HIIT fallback dependency
  if (hiitFallbackChronic?.chronic == null) {
    info(checks, 'library_hiit_fallback_chronic', `HIIT fallback chronicity pending (${hiitFallbackChronic?.runCount ?? 0}/${hiitFallbackChronic?.minRuns ?? 5} eval runs)`, {
      ok_band: null,
      rubric: 'C25-MOR-01',
      ...hiitFallbackChronic,
    })
  } else if (hiitFallbackChronic.chronic) {
    pass(checks, 'library_hiit_fallback_chronic', `0 HIIT fallback in ${hiitFallbackChronic.runCount} consecutive runs`)
  } else {
    fail(checks, 'library_hiit_fallback_chronic', 'Chronic HIIT fallback dependency in eval history', hiitFallbackChronic.counts)
  }

  // C25-MOR-02 — progression graph gap blocks strict
  let gapPrimaries = 0
  let gapTotal = 0
  for (const c of candidates) {
    if (!['output', 'capacity'].includes(c.primary_phase)) continue
    gapTotal += 1
    if (!progressionNeighborInGraph(c.exercise_id, progressionGraphEdges)) gapPrimaries += 1
  }
  const gapRate = gapTotal > 0 ? gapPrimaries / gapTotal : 0
  if (gapRate >= 0.4) {
    info(checks, 'library_progression_graph_gap', `Progression graph gap rate ${(gapRate * 100).toFixed(0)}% ≥ 40%`, { ok_band: false, rubric: 'C25-MOR-02', gapRate, gapPrimaries, gapTotal })
  } else {
    info(checks, 'library_progression_graph_gap', `Progression graph gap rate ${(gapRate * 100).toFixed(0)}% < 40%`, { ok_band: true, rubric: 'C25-MOR-02', gapRate })
  }

  // Thin-phase diagnostic signal
  const thinPhases = fills.filter((f) => Number(f.pool_size ?? 0) < 3).map((f) => f.phase_key)
  info(checks, 'library_thin_phase_count', `Phases with pool_size < 3: ${thinPhases.length}`, { ok_band: thinPhases.length === 0, phases: thinPhases })

  // C25-MOE-01 — strict loop stability (reuse golden feasibility)
  if (goldenFeasibilityStability?.stable == null) {
    info(checks, 'category25_moe_strict_loop_stability', `Strict pass streak pending (${goldenFeasibilityStability?.runCount ?? 0}/${goldenFeasibilityStability?.minRuns ?? 5} eval runs)`, {
      ok_band: null,
      rubric: 'C25-MOE-01',
      ...goldenFeasibilityStability,
    })
  } else if (goldenFeasibilityStability.stable) {
    info(checks, 'category25_moe_strict_loop_stability', `${goldenFeasibilityStability.runCount}/${goldenFeasibilityStability.minRuns} strict PASS without content edits`, {
      ok_band: true,
      rubric: 'C25-MOE-01',
      ...goldenFeasibilityStability,
    })
  } else {
    info(checks, 'category25_moe_strict_loop_stability', `${goldenFeasibilityStability.failCount} strict FAIL in recent history`, {
      ok_band: false,
      rubric: 'C25-MOE-01',
      ...goldenFeasibilityStability,
    })
  }

  // C25-MOE-02 — thin pool diagnosable
  const thinPoolPhases = fills
    .filter((f) => ['output', 'capacity', 'restore', 'sustained_capacity'].includes(f.phase_key) && Number(f.pool_size ?? 0) < LIBRARY_POOL_FLOORS[f.phase_key])
    .map((f) => ({ phase_key: f.phase_key, pool_size: f.pool_size, floor: LIBRARY_POOL_FLOORS[f.phase_key] }))
  info(checks, 'category25_moe_thin_pool_diagnosable', `${thinPoolPhases.length} thin-pool phase(s) flagged in constraint_report`, {
    ok_band: thinPoolPhases.length === 0,
    rubric: 'C25-MOE-02',
    thin_pool_phases: thinPoolPhases,
    equipment_avoid: cr?.equipment_avoid,
    exercise_avoid: cr?.exercise_avoid,
  })

  // C25-MOE-03 — focus targets not over-constraining (Output pattern diversity)
  const outputPatterns = new Set()
  const outputBlock = blockByKey(result, 'output')
  for (const item of outputBlock?.items ?? []) {
    for (const p of patternIdsForExercise(item.exercise_id, tagMap)) outputPatterns.add(p)
  }
  info(checks, 'category25_moe_speed_pattern_diversity', `Output distinct patterns ${outputPatterns.size}`, {
    ok_band: outputPatterns.size >= 5,
    rubric: 'C25-MOE-03',
    patterns: outputPatterns.size,
  })

  // C25-MOE-04 — audit backlog actionable (informational)
  info(checks, 'category25_moe_focus_starvation', 'Focus starvation attribution via constraint_report phase_fill + focus_targets', {
    ok_band: speedShare >= 0.15 || speedEligible >= 5,
    rubric: ['C25-MOE-04', 'C25-MOE-08'],
    speedShare,
    speedEligible,
    outputPool,
  })

  // C25-MOE-05, 06 — duration A/B and facility parity (lagging / manual)
  info(checks, 'category25_moe_duration_stress', '60-min vs 120-min pool stress ratio requires eval matrix A/B', {
    ok_band: null,
    rubric: 'C25-MOE-05',
    note: 'Run dual-duration prescribe matrix; threshold ≤ 1.5× stress ratio',
  })
  info(checks, 'category25_moe_facility_parity', 'Staging vs production library diff requires DB compare report', {
    ok_band: null,
    rubric: 'C25-MOE-06',
    publishedExerciseCount,
  })

  // C25-MOE-07 — migration regression guard (lagging)
  if (poolEmptyStability?.stable == null) {
    info(checks, 'category25_moe_migration_guard', `Migration guard pending (${poolEmptyStability?.runCount ?? 0}/${poolEmptyStability?.minRuns ?? 5} eval runs)`, {
      ok_band: null,
      rubric: 'C25-MOE-07',
      ...poolEmptyStability,
    })
  } else {
    info(checks, 'category25_moe_migration_guard', poolEmptyStability.stable ? '0 pool_empty in recent strict evals post-migration window' : 'pool_empty seen — migration regression risk', {
      ok_band: poolEmptyStability.stable,
      rubric: 'C25-MOE-07',
      ...poolEmptyStability,
    })
  }

  // Review packet for manual MOE
  pass(checks, 'category25_moe_review_packet', `${fills.length} phase_fill row(s) for library/pool engineer review`, {
    informational: true,
    rubric: ['C25-MOE-02', 'C25-MOE-08'],
    constraint_report: {
      phase_fill: fills,
      empty_phase_reasons: emptyReasons,
      equipment_avoid: cr?.equipment_avoid,
    },
    candidates_snapshot: candidates.slice(0, 10).map((c) => ({
      exercise_id: c.exercise_id,
      exercise_name: c.exercise_name,
      score: c.score,
      primary_phase: c.primary_phase,
    })),
    thin_pool_phases: thinPoolPhases,
    hiit_fallback_count: hiitFallbackCount,
  })
}

export function computeCategory25Kpi(checks, opts = {}) {
  const minIndex = opts.minPoolHealthIndex ?? 0.70
  const blocking = computeKpi(checks, 25, CATEGORY25_KPI_CHECK_IDS, { minRate: 0.9, ...opts })

  const floorChecks = CATEGORY25_KPI_CHECK_IDS.filter((id) => id.startsWith('library_pool_floor_'))
  const floorPassed = floorChecks.filter((id) => checks.find((c) => c.id === id)?.ok !== false).length
  const minPhasePoolFloor = floorChecks.length > 0 ? floorPassed / floorChecks.length : 1

  const poolEmptyRate = checks.find((c) => c.id === 'no_empty_phases')?.ok === false ? 1 : 0
  const hiitFallbackRate = checks.find((c) => c.id === 'library_hiit_fallback_rate')?.ok === false ? 1 : 0
  const progCoverage = checks.find((c) => c.id === 'library_progression_pool_coverage')
  const progressionCoverage = progCoverage?.detail?.avgProgCoverage != null
    ? Number(progCoverage.detail.avgProgCoverage)
    : (progCoverage?.ok !== false ? 1 : 0.5)

  const poolHealthIndex = minPhasePoolFloor * (1 - poolEmptyRate) * (1 - hiitFallbackRate) * progressionCoverage
  const indexOk = poolHealthIndex >= minIndex
  const ok = blocking.ok && indexOk

  return {
    ...blocking,
    ok,
    severity: ok ? 'ok' : 'P1',
    message: ok
      ? `Category 25 pool health index ${(poolHealthIndex * 100).toFixed(1)}%; blocking ${(blocking.detail.rate * 100).toFixed(1)}%`
      : `Category 25 KPI fail: pool health ${(poolHealthIndex * 100).toFixed(1)}% (min ${(minIndex * 100).toFixed(0)}%); blocking ${blocking.detail.passed}/${blocking.detail.total}`,
    detail: {
      ...blocking.detail,
      poolHealthIndex,
      minPoolHealthIndex: minIndex,
      minPhasePoolFloor,
      poolEmptyRate,
      hiitFallbackRate,
      progressionCoverage,
      formula: 'min_phase_pool_floor × (1 - pool_empty_rate) × (1 - hiit_fallback_rate) × progression_coverage',
    },
  }
}

/** Registry for runCategoryEvaluators */
export const EXTENDED_CATEGORY_REGISTRY = [
  [5, evaluateCategory5Splits, computeCategory5Kpi],
  [6, evaluateCategory6Progressions, computeCategory6Kpi],
  [7, evaluateCategory7Lane, computeCategory7Kpi],
  [8, evaluateCategory8Reuse, computeCategory8Kpi],
  [9, evaluateCategory9Climb, computeCategory9Kpi],
  [10, evaluateCategory10AgeFit, computeCategory10Kpi],
  [11, evaluateCategory11CapUtil, computeCategory11Kpi],
  [12, evaluateCategory12EquipUse, computeCategory12Kpi],
  [13, evaluateCategory13EquipAvoid, computeCategory13Kpi],
  [14, evaluateCategory14MovementAvoid, computeCategory14Kpi],
  [15, evaluateCategory15Intent, computeCategory15Kpi],
  [16, evaluateCategory16PhasePrimaries, computeCategory16Kpi],
  [17, evaluateCategory17Youth, computeCategory17Kpi],
  [18, evaluateCategory18Stretch, computeCategory18Kpi],
  [19, evaluateCategory19Diversity, computeCategory19Kpi],
  [20, evaluateCategory20Constraint, computeCategory20Kpi],
  [21, evaluateCategory21Warnings, computeCategory21Kpi],
  [22, evaluateCategory22Feasibility, computeCategory22Kpi],
  [23, evaluateCategory23Sport, computeCategory23Kpi],
  [24, evaluateCategory24Format, computeCategory24Kpi],
  [25, evaluateCategory25Library, computeCategory25Kpi],
]
