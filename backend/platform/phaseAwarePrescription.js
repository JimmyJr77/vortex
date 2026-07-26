import { loadExerciseProgrammingBundle, attachProgrammingToExercise } from './exerciseProgramming.js'
import { loadEducationForExercise, educationToWhyResponse } from './educationContent.js'
import {
  resolveAudienceProfile,
  resolveHardDifficultyExclude,
  scoreAgeDifficultyFit,
  classifyAgeFit,
  ageFitWarnings,
} from './ageDifficultyPolicy.js'
import {
  expandEquipmentAvoidIds,
  exerciseViolatesEquipmentAvoid,
  auditPrescriptionEquipmentAvoid,
  exerciseAllowedUseOnly,
  equipmentUsePolicyFromBody,
  equipmentUseIdsFromBody,
  equipmentAvailableIdsFromBody,
  effectiveEquipmentAvoidIds,
  loadBodyweightEquipmentIds,
} from './equipmentAvoidPolicy.js'
import { beginnerAppropriatenessPenalty } from './beginnerExclusionPolicy.js'
import { implicitPhaseFocusHints } from './sessionObjectivePolicy.js'
import {
  restoreCandidateExcluded,
  restoreProfileEligible,
  restoreScoreBoost,
} from './restoreSelectionPolicy.js'
import {
  hasSustainedConditioningFocus,
  minItemsForPhase,
  maxItemsForPhase,
  phaseFillTarget,
  shouldRelaxSplitGate,
  sustainedCapacityExcluded,
  sustainedCapacityCandidateEligible,
} from './sustainedCapacityPolicy.js'
import { sportContextMultiplier } from './sportContextPolicy.js'
import { runPreflight } from './preflightSatisfiability.js'
import {
  movementFamilyBlocked,
  movementFamilyKey,
  normalizeSlugStem,
  recordMovementFamily,
} from './movementFamilyPolicy.js'
import {
  emptyLaneRejectReasons,
  hasHighArousalMethodology,
  mergeLaneRejectReasons,
} from './progressionLanePolicy.js'

function itemSecondsFromExercise(ex, item) {
  const sets = Number(item?.sets ?? ex.default_sets) || 3
  const work = Number(item?.work_seconds ?? ex.default_work_seconds)
    || Number(item?.est_seconds_per_set ?? ex.est_seconds_per_set)
    || 45
  const restRaw = item?.rest_seconds ?? ex.default_rest_seconds
  const rest = restRaw != null && restRaw !== '' ? Number(restRaw) : 30
  return sets * work + sets * rest
}

function candidateDose(candidate) {
  const profiles = candidate?.dosageProfiles ?? []
  const dosage = profiles.find((profile) => profile.is_default)
    ?? profiles.find((profile) => String(profile.profile_name).toLowerCase() === 'default')
    ?? profiles[0]
    ?? {}
  const reps = dosage.default_reps ?? candidate.exercise.default_reps ?? null
  const explicitWork = dosage.default_work_seconds ?? candidate.exercise.default_work_seconds ?? null
  const distance = dosage.default_distance ?? null
  const contacts = dosage.default_contacts ?? null
  const volumeUnit = dosage.volume_unit ?? (reps != null ? 'reps' : 'seconds')
  const sets = dosage.default_sets ?? candidate.exercise.default_sets ?? 3
  const rounds = dosage.default_rounds ?? (volumeUnit === 'rounds' ? sets : null)
  const countIsEncodedBySets = volumeUnit === 'attempts' || volumeUnit === 'rounds'
  const fallbackWork = !countIsEncodedBySets
    && reps == null && distance == null && contacts == null && rounds == null
    ? Math.min(60, Math.max(15, Number(dosage.est_seconds_per_set ?? candidate.exercise.est_seconds_per_set) || 30))
    : null
  return {
    volume_unit: volumeUnit,
    sets,
    reps,
    work_seconds: explicitWork ?? fallbackWork,
    distance,
    contacts,
    rounds,
    rest_seconds: dosage.default_rest_seconds ?? candidate.exercise.default_rest_seconds ?? 30,
    est_seconds_per_set: dosage.est_seconds_per_set ?? candidate.exercise.est_seconds_per_set ?? 45,
  }
}

function mergeCapsMax(...capObjects) {
  const valid = capObjects.filter(Boolean)
  if (valid.length === 0) {
    return { maxOverall: 10, maxTechnical: 10, maxLoad: 10, maxComplexity: 10 }
  }
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
      trainingExperience: body.trainingExperience
        ?? body.training_experience
        ?? body.skillLevel
        ?? body.skill_level,
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
    return {
      label: split.label || `Ages ${split.ageMin ?? split.age_min}-${split.ageMax ?? split.age_max}`,
      ageMin: split.ageMin ?? split.age_min ?? null,
      ageMax: split.ageMax ?? split.age_max ?? null,
      caps: profile.caps,
      scalingCohort: profile.scalingCohort,
    }
  })
}

function difficultyProximityBonus(difficulty, poolCapOverall) {
  const cap = Number(poolCapOverall ?? 10)
  const overall = Number(difficulty?.overall ?? 0)
  if (!overall || cap <= 0) return 0
  return Math.min(8, (overall / cap) * 6)
}

async function resolveTargetFacetIds(pool, targets) {
  const resolved = []
  const tableMap = {
    tenet: 'tenet',
    methodology: 'methodology',
    physiology: 'physiological_emphasis',
    pattern: 'movement_pattern',
    body_region: 'body_region',
    order_slot: 'phase_order_slot',
  }
  for (const target of targets) {
    const facetType = target.facetType ?? target.facet_type
    const table = tableMap[facetType]
    if (target.facetId != null && table && !target.facetKey && !target.key) {
      const row = await pool.query(
        `SELECT key, name FROM coaching.${table} WHERE id = $1 LIMIT 1`,
        [Number(target.facetId)],
      )
      if (row.rows[0]?.key) {
        resolved.push({
          ...target,
          facetType,
          facetKey: row.rows[0].key,
          facetName: row.rows[0].name ?? row.rows[0].key,
        })
        continue
      }
    }
    if (target.facetId != null) {
      resolved.push({ ...target, facetType })
      continue
    }
    const key = target.facetKey ?? target.key
    if (!key || !facetType) continue
    if (!table) continue
    const row = await pool.query(`SELECT id, key, name FROM coaching.${table} WHERE key = $1 LIMIT 1`, [String(key)])
    if (row.rows[0]?.id) {
      const entry = {
        ...target,
        facetType,
        facetId: Number(row.rows[0].id),
        facetKey: row.rows[0].key,
        facetName: row.rows[0].name ?? row.rows[0].key,
      }
      resolved.push(entry)
    }
  }
  return resolved
}

const DERIVED_PHASE_KEYS = new Set(['prepare_and_access', 'restore'])
const WORK_PHASE_WEIGHTS = Object.freeze({
  movement_intelligence: 2,
  output: 5,
  capacity: 4,
  resilience: 3,
  sustained_capacity: 3,
  other: 2,
})

function workDerivedFocusTargets(resultBlocks, tagMap) {
  const totals = new Map()
  for (const block of resultBlocks) {
    if (DERIVED_PHASE_KEYS.has(block.phase_key)) continue
    const phaseWeight = WORK_PHASE_WEIGHTS[block.phase_key] ?? 1
    for (const item of block.items ?? []) {
      const exerciseIds = new Set([
        item.exercise_id,
        ...(item.per_split ?? item.split_alternates_json ?? []).map((variant) => variant.exercise_id),
      ])
      for (const exerciseId of exerciseIds) {
        if (!exerciseId) continue
        for (const tag of tagMap.get(String(exerciseId)) ?? []) {
          if (tag.facetType !== 'body_region' && tag.facetType !== 'pattern') continue
          const key = `${tag.facetType}:${tag.facetId}`
          totals.set(key, {
            facetType: tag.facetType,
            facetId: Number(tag.facetId),
            score: (totals.get(key)?.score ?? 0) + phaseWeight * Math.max(1, Number(tag.weight) || 1),
          })
        }
      }
    }
  }

  const top = (facetType, limit, weight) => [...totals.values()]
    .filter((target) => target.facetType === facetType)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((target) => ({
      facetType: target.facetType,
      facetId: target.facetId,
      weight,
      derivedFromWork: true,
      evidenceScore: target.score,
    }))

  return [
    ...top('body_region', 4, 8),
    ...top('pattern', 3, 5),
  ]
}

async function loadFacetKeyMaps(pool) {
  const [methodology, intent, sport] = await Promise.all([
    pool.query(`SELECT id, key FROM coaching.methodology`),
    pool.query(`SELECT id, key FROM coaching.exercise_intent`),
    pool.query(`SELECT id, key FROM coaching.sport`),
  ])
  return {
    methodologyKeyById: new Map(methodology.rows.map((r) => [Number(r.id), r.key])),
    intentKeyById: new Map(intent.rows.map((r) => [Number(r.id), r.key])),
    sportIdByKey: new Map(sport.rows.map((r) => [r.key, Number(r.id)])),
  }
}

function scalingGuidanceForCohort(scalingProfiles, cohortKey) {
  if (!Array.isArray(scalingProfiles) || !cohortKey) return null
  const row = scalingProfiles.find((s) => s.cohort_key === cohortKey)
  if (!row) return null
  const parts = [row.load_guidance, row.complexity_guidance, row.coach_notes].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : null
}

function resolveSplitScalingGuidance(candidate, primary, split, primarySplitGuidance = null) {
  return (
    scalingGuidanceForCohort(candidate?.scalingProfiles, split.scalingCohort)
    ?? scalingGuidanceForCohort(primary?.scalingProfiles, split.scalingCohort)
    ?? primarySplitGuidance
    ?? null
  )
}

function scoreTargets(tags, targets) {
  let score = 0
  for (const target of targets) {
    const facetId = target.facetId != null ? Number(target.facetId) : null
    if (facetId == null) continue
    const match = tags.find((t) => t.facetType === target.facetType && t.facetId === facetId)
    if (match) score += match.weight * (Number(target.weight) || 3)
  }
  return score
}

const STRICT_FOCUS_PHASES = new Set(['output', 'capacity', 'resilience', 'sustained_capacity'])
const STRICT_FOCUS_FACETS = new Set(['methodology', 'pattern', 'body_region'])

function matchesRequiredPhaseFocus(tags, targets, phaseKey) {
  if (!STRICT_FOCUS_PHASES.has(phaseKey)) return true
  const priorityTargets = targets.filter((target) => (
    STRICT_FOCUS_FACETS.has(target.facetType)
    && Number(target.weight ?? 0) >= 5
  ))
  if (priorityTargets.length === 0) return true

  const grouped = new Map()
  for (const target of priorityTargets) {
    const rows = grouped.get(target.facetType) ?? []
    rows.push(Number(target.facetId))
    grouped.set(target.facetType, rows)
  }
  // Match at least one selected value in every emphasized facet category.
  // This prevents a generic phase-fit tag from overwhelming an explicit
  // methodology, movement-pattern, or muscle-group request.
  for (const [facetType, facetIds] of grouped) {
    if (!tags.some((tag) => tag.facetType === facetType && facetIds.includes(Number(tag.facetId)))) {
      return false
    }
  }
  return true
}

function matchesOrderSlot(exercise, profile, slotKey) {
  if (!slotKey) return false
  const slot = String(slotKey)
  return exercise.primary_order_slot === slot
    || profile?.order_slot === slot
    || profile?.orderSlot === slot
}

function difficultyWithinCaps(difficulty, caps, hardExclude) {
  if (!difficulty || !caps) return true
  if (!hardExclude) return true
  const fit = classifyAgeFit(difficulty, caps)
  return fit === 'good' || fit === 'stretch'
}

function candidatePhaseProfile(candidate, phaseKey) {
  return candidate.profiles?.find((p) => p.phaseKey === phaseKey && p.role !== 'avoid') ?? null
}

const SPLIT_PROGRESSION_PHASE_KEYS = new Set(['output', 'capacity', 'resilience'])

function tagFacetIds(candidate, facetType) {
  return new Set(
    (candidate.tags ?? [])
      .filter((t) => t.facetType === facetType)
      .map((t) => Number(t.facetId))
      .filter(Number.isFinite),
  )
}

function sharesTagFacet(a, b, facetType) {
  const aIds = tagFacetIds(a, facetType)
  if (aIds.size === 0) return false
  for (const id of tagFacetIds(b, facetType)) {
    if (aIds.has(id)) return true
  }
  return false
}

function sameProgressionLane(candidate, primaryCandidate, phaseKey) {
  if (!SPLIT_PROGRESSION_PHASE_KEYS.has(phaseKey)) return false

  const profile = candidatePhaseProfile(candidate, phaseKey)
  if (!profile || !['primary', 'secondary'].includes(profile.role)) return false

  if (sharesTagFacet(candidate, primaryCandidate, 'pattern')) return true

  const candidateFamily = String(candidate.exercise.movement_family ?? '').toLowerCase()
  const primaryFamily = String(primaryCandidate.exercise.movement_family ?? '').toLowerCase()
  if (candidateFamily && primaryFamily && candidateFamily === primaryFamily) return true

  return false
}

function pickSplitAlternate(candidates, primaryCandidate, caps, hardExclude, excludeIds = new Set()) {
  const primaryExerciseId = Number(primaryCandidate.exercise.id)
  const primaryPattern = primaryCandidate.tags?.find((t) => t.facetType === 'pattern')?.facetId

  const eligible = candidates.filter((c) => {
    if (Number(c.exercise.id) === primaryExerciseId) return false
    if (excludeIds.has(Number(c.exercise.id))) return false
    if (!difficultyWithinCaps(c.difficulty, caps, hardExclude)) return false
    if (primaryPattern) {
      const pat = c.tags.find((t) => t.facetType === 'pattern')?.facetId
      if (pat && pat !== primaryPattern) return false
    }
    return true
  })

  eligible.sort((a, b) => {
    const cap = Number(caps?.maxOverall ?? 10)
    const aDiff = Number(a.difficulty?.overall ?? 99)
    const bDiff = Number(b.difficulty?.overall ?? 99)
    const aDist = Math.abs(aDiff - cap)
    const bDist = Math.abs(bDiff - cap)
    if (aDist !== bDist) return aDist - bDist
    return (b.adjScore ?? b.score ?? 0) - (a.adjScore ?? a.score ?? 0)
  })

  return eligible[0] ?? null
}

function progressionFitsCaps(difficulty, caps) {
  if (!difficulty || !caps) return false
  const fit = classifyAgeFit(difficulty, caps)
  return fit === 'good' || fit === 'stretch'
}

function progressionLaneMatchAtPick(primaryCandidate, candidate) {
  const primaryPattern = primaryCandidate.tags?.find((t) => t.facetType === 'pattern')?.facetId
  const candPattern = candidate.tags?.find((t) => t.facetType === 'pattern')?.facetId
  if (primaryPattern && candPattern === primaryPattern) {
    return { method: 'pattern', pattern_priority_pick: true }
  }
  if (sharesTagFacet(candidate, primaryCandidate, 'pattern')) {
    return { method: 'pattern', pattern_priority_pick: false }
  }
  const candidateFamily = String(candidate.exercise.movement_family ?? '').toLowerCase()
  const primaryFamily = String(primaryCandidate.exercise.movement_family ?? '').toLowerCase()
  if (candidateFamily && primaryFamily && candidateFamily === primaryFamily) {
    return { method: 'family', pattern_priority_pick: false }
  }
  return { method: 'none', pattern_priority_pick: false }
}

function countProgressionLaneRejects(pool, primaryCandidate, caps, phaseKey, excludeIds, methodologyKeyById) {
  const reasons = emptyLaneRejectReasons()
  const primaryExerciseId = Number(primaryCandidate.exercise.id)
  const primaryDiff = Number(primaryCandidate.difficulty?.overall ?? 0)
  const targetCap = Number(caps?.maxOverall ?? 10)

  for (const c of pool) {
    if (Number(c.exercise.id) === primaryExerciseId) continue
    if (excludeIds.has(Number(c.exercise.id))) {
      reasons.reuse_excluded += 1
      continue
    }
    if (!sameProgressionLane(c, primaryCandidate, phaseKey)) {
      reasons.lane_mismatch += 1
      continue
    }
    if (phaseKey !== 'sustained_capacity' && methodologyKeyById && hasHighArousalMethodology(
      Number(c.exercise.id),
      new Map([[String(c.exercise.id), (c.tags ?? []).map((t) => ({
        facetType: t.facetType,
        facetId: t.facetId,
      }))]]),
      methodologyKeyById,
    )) {
      reasons.methodology += 1
      continue
    }
    const diff = Number(c.difficulty?.overall ?? 99)
    if (diff <= primaryDiff + 1) {
      reasons.difficulty_gap += 1
      continue
    }
    if (diff > targetCap) {
      reasons.over_cap += 1
      continue
    }
    if (!progressionFitsCaps(c.difficulty, caps)) {
      reasons.over_cap += 1
      continue
    }
    const profile = candidatePhaseProfile(c, phaseKey)
    if (!profile || !['primary', 'secondary'].includes(profile.role)) {
      reasons.profile_role += 1
    }
  }
  return reasons
}

function pickSplitProgression(candidates, primaryCandidate, caps, phaseKey, excludeIds = new Set(), fullScored = [], methodologyKeyById = null) {
  const primaryExerciseId = Number(primaryCandidate.exercise.id)
  const primaryPattern = primaryCandidate.tags?.find((t) => t.facetType === 'pattern')?.facetId
  const primaryDiff = Number(primaryCandidate.difficulty?.overall ?? 0)
  const targetCap = Number(caps?.maxOverall ?? 10)
  if (targetCap <= primaryDiff + 1) return { candidate: null, source: null, laneRejectReasons: emptyLaneRejectReasons() }

  const candidateTagMap = (c) => new Map([[String(c.exercise.id), (c.tags ?? []).map((t) => ({
    facetType: t.facetType,
    facetId: t.facetId,
  }))]])

  const tryPick = (pool, source) => {
    const eligible = pool.filter((c) => {
      if (Number(c.exercise.id) === primaryExerciseId) return false
      if (excludeIds.has(Number(c.exercise.id))) return false
      if (!sameProgressionLane(c, primaryCandidate, phaseKey)) return false
      if (phaseKey !== 'sustained_capacity' && methodologyKeyById && hasHighArousalMethodology(
        Number(c.exercise.id),
        candidateTagMap(c),
        methodologyKeyById,
      )) return false
      const diff = Number(c.difficulty?.overall ?? 99)
      if (diff <= primaryDiff + 1) return false
      if (diff > targetCap) return false
      if (!progressionFitsCaps(c.difficulty, caps)) return false
      return true
    })

    eligible.sort((a, b) => {
      const aPattern = a.tags?.find((t) => t.facetType === 'pattern')?.facetId
      const bPattern = b.tags?.find((t) => t.facetType === 'pattern')?.facetId
      const aMatch = primaryPattern && aPattern === primaryPattern ? 1 : 0
      const bMatch = primaryPattern && bPattern === primaryPattern ? 1 : 0
      if (bMatch !== aMatch) return bMatch - aMatch
      const aDiff = Number(a.difficulty?.overall ?? 0)
      const bDiff = Number(b.difficulty?.overall ?? 0)
      if (bDiff !== aDiff) return bDiff - aDiff
      return (b.adjScore ?? b.score ?? 0) - (a.adjScore ?? a.score ?? 0)
    })

    const picked = eligible[0] ?? null
    if (!picked) return null
    const laneMeta = progressionLaneMatchAtPick(primaryCandidate, picked)
    return {
      candidate: picked,
      source,
      lane_match_method: laneMeta.method,
      pattern_priority_pick: laneMeta.pattern_priority_pick,
    }
  }

  const combinedPool = [...candidates]
  for (const c of fullScored) {
    if (!combinedPool.some((row) => Number(row.exercise.id) === Number(c.exercise.id))) {
      combinedPool.push(c)
    }
  }

  const fromPool = tryPick(candidates, 'pool')
  if (fromPool) return fromPool
  const fromFull = tryPick(fullScored, 'full_scored')
  if (fromFull) return fromFull

  return {
    candidate: null,
    source: null,
    laneRejectReasons: countProgressionLaneRejects(combinedPool, primaryCandidate, caps, phaseKey, excludeIds, methodologyKeyById),
  }
}

function normalizeExerciseName(name) {
  return String(name ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function equipmentIdsForCandidate(candidate) {
  return [...new Set((candidate?.tags ?? [])
    .filter((tag) => tag.facetType === 'equipment')
    .map((tag) => Number(tag.facetId))
    .filter(Number.isFinite))]
}

function humanizeKey(value) {
  return String(value ?? '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function buildSelectionRationale(candidate, phaseKey, targets, caps) {
  const matched = targets.filter((target) => candidate.tags.some((tag) => (
    tag.facetType === target.facetType && Number(tag.facetId) === Number(target.facetId)
  )))
  const focus = [...new Set(matched
    .filter((target) => ['tenet', 'methodology', 'pattern', 'body_region'].includes(target.facetType))
    .map((target) => target.facetName ?? target.facetKey)
    .filter(Boolean))]
    .slice(0, 4)
  const parts = [
    `Fits ${humanizeKey(phaseKey)}`,
    focus.length > 0 ? `matches ${focus.map(humanizeKey).join(', ')}` : null,
  ]
  if (candidate.requiredEquipmentMatch) parts.push('contributes required equipment coverage')
  const difficulty = Number(candidate.difficulty?.overall)
  const cap = Number(caps?.maxOverall)
  if (Number.isFinite(difficulty) && Number.isFinite(cap)) {
    parts.push(`difficulty ${Math.round(difficulty * 10)}/100 within ${Math.round(cap * 10)}/100 cap`)
  }
  return `${parts.filter(Boolean).join('; ')}.`
}

function buildSplitVariantEntry(split, candidate, {
  variantType,
  substituted = false,
  scalingGuidance = null,
  progressionPickSource = null,
  progressionLaneMatchMethod = null,
  progressionPatternPriorityPick = null,
} = {}) {
  return {
    split_label: split.label,
    age_min: split.ageMin ?? null,
    age_max: split.ageMax ?? null,
    difficulty_cap: split.caps?.maxOverall ?? null,
    exercise_id: Number(candidate.exercise.id),
    exercise_name: candidate.exercise.name,
    equipment_ids: equipmentIdsForCandidate(candidate),
    difficulty: candidate.difficulty ?? null,
    substituted: substituted || variantType === 'substituted',
    variant_type: variantType,
    scaling_guidance: scalingGuidance ?? null,
    progression_pick_source: progressionPickSource ?? undefined,
    progression_lane_match_method: progressionLaneMatchMethod ?? undefined,
    progression_pattern_priority_pick: progressionPatternPriorityPick ?? undefined,
  }
}

function resolvePerSplitVariants(primary, poolForPhase, scored, splitProfiles, phaseKey, phaseUsedProgressionIds = new Set(), methodologyKeyById = null) {
  const perSplit = []
  const warnings = []
  let laneRejectReasons = emptyLaneRejectReasons()
  const reservedIds = new Set([Number(primary.exercise.id)])
  const maxSplitCap = splitProfiles.length > 0
    ? Math.max(...splitProfiles.map((s) => Number(s.caps?.maxOverall ?? 0)))
    : 0

  const fallbackPool = scored.filter((c) => {
    if (Number(c.exercise.id) === Number(primary.exercise.id)) return false
    return Boolean(candidatePhaseProfile(c, phaseKey))
  })

  const searchPool = [...poolForPhase]
  for (const c of fallbackPool) {
    if (!searchPool.some((row) => Number(row.exercise.id) === Number(c.exercise.id))) {
      searchPool.push(c)
    }
  }

  for (const split of splitProfiles) {
    const scalingGuidance = scalingGuidanceForCohort(primary.scalingProfiles, split.scalingCohort)
    const fits = primary.difficulty && classifyAgeFit(primary.difficulty, split.caps) === 'good'

    if (fits) {
      const primaryDiff = Number(primary.difficulty?.overall ?? 0)
      const cap = Number(split.caps?.maxOverall ?? 10)
      const isHighestCapSplit = cap >= maxSplitCap && maxSplitCap > 0
      if (isHighestCapSplit && cap > primaryDiff + 1) {
        const progressionExclude = new Set([...reservedIds, ...phaseUsedProgressionIds])
        const picked = pickSplitProgression(searchPool, primary, split.caps, phaseKey, progressionExclude, scored, methodologyKeyById)
        if (picked?.candidate) {
          const progressed = picked.candidate
          phaseUsedProgressionIds.add(Number(progressed.exercise.id))
          reservedIds.add(Number(progressed.exercise.id))
          perSplit.push(buildSplitVariantEntry(split, progressed, {
            variantType: 'progression',
            scalingGuidance: resolveSplitScalingGuidance(progressed, primary, split, scalingGuidance),
            progressionPickSource: picked.source,
            progressionLaneMatchMethod: picked.lane_match_method,
            progressionPatternPriorityPick: picked.pattern_priority_pick,
          }))
          continue
        }
        if (picked?.laneRejectReasons) {
          laneRejectReasons = mergeLaneRejectReasons(laneRejectReasons, picked.laneRejectReasons)
        }
      }
      perSplit.push(buildSplitVariantEntry(split, primary, {
        variantType: 'same',
        scalingGuidance,
      }))
      continue
    }

    const alt = pickSplitAlternate(searchPool, primary, split.caps, true, reservedIds)
    if (alt) {
      reservedIds.add(Number(alt.exercise.id))
      perSplit.push(buildSplitVariantEntry(split, alt, {
        variantType: 'substituted',
        substituted: true,
        scalingGuidance: resolveSplitScalingGuidance(alt, primary, split, scalingGuidance),
      }))
      continue
    }

    if (scalingGuidance) {
      perSplit.push(buildSplitVariantEntry(split, primary, {
        variantType: 'scaled',
        scalingGuidance,
      }))
      warnings.push(`${split.label}: ${primary.exercise.name} exceeds difficulty cap — coach scaling required.`)
      continue
    }

    perSplit.push(buildSplitVariantEntry(split, primary, { variantType: 'missing' }))
    warnings.push(`${split.label}: no suitable variant found for ${primary.exercise.name}.`)
  }

  return {
    perSplit,
    warnings,
    complete: perSplit.every((entry) => entry.variant_type !== 'missing'),
    reservedIds: [...reservedIds].filter((id) => id !== Number(primary.exercise.id)),
    laneRejectReasons,
  }
}

function splitCandidateAcceptable(resolved, primary, splitProfiles, relaxSplit) {
  if ((resolved.warnings?.length ?? 0) > 0) return false
  if (relaxSplit) return resolved.complete
  if (!resolved.complete) return false
  if (splitProfiles.length === 0) return true
  const youngest = splitProfiles.reduce((a, b) => (
    Number(a.ageMax ?? 99) <= Number(b.ageMax ?? 99) ? a : b
  ))
  const fit = classifyAgeFit(primary.difficulty, youngest.caps)
  return fit === 'good' || fit === 'stretch'
}

function buildPoolForPhase({
  scored,
  phaseKey,
  resolvedPhaseTargets,
  usedPatterns,
  strengthIntent,
  methodologyKeyById,
  intentKeyById,
  sportKey,
  sportIdByKey,
  poolCapOverall = 10,
  ageMax = null,
}) {
  return scored
    .map((c) => {
      const profile = c.profiles.find((p) => p.phaseKey === phaseKey && p.role !== 'avoid')
      if (!profile) return null

      if (phaseKey === 'movement_intelligence' && ageMax != null && ageMax <= 14) {
        const blob = `${c.exercise.slug ?? ''} ${c.exercise.name ?? ''}`.toLowerCase()
        if (/handstand|inversion|inverted/.test(blob)) return null
      }

      if (phaseKey === 'restore') {
        if (!restoreProfileEligible(c.exercise, profile)) return null
        if (restoreCandidateExcluded(c.exercise, profile, c.tags, methodologyKeyById)) return null
      }

      if (sustainedCapacityExcluded(phaseKey, c.exercise, c.tags, methodologyKeyById, intentKeyById, resolvedPhaseTargets)) {
        return null
      }
      if (!matchesRequiredPhaseFocus(c.tags, resolvedPhaseTargets, phaseKey)) return null

      let phaseTargetScore = scoreTargets(c.tags, resolvedPhaseTargets)
      for (const t of resolvedPhaseTargets) {
        if (t.facetType === 'order_slot' && t.facetKey) {
          if (matchesOrderSlot(c.exercise, profile, t.facetKey)) phaseTargetScore += 8
        }
      }
      if (resolvedPhaseTargets.length > 0) phaseTargetScore *= 2.5

      let phaseFit = profile.fitWeight * 2
      if (profile.role === 'primary') phaseFit += 6
      else if (profile.role === 'secondary') phaseFit += 2
      else if (profile.role === 'conditional') phaseFit *= 0.75

      if (phaseKey === 'restore') {
        phaseFit += restoreScoreBoost(c.exercise, profile, c.tags, methodologyKeyById)
      }

      const patternId = c.tags.find((t) => t.facetType === 'pattern')?.facetId
      const penalty = patternId && usedPatterns.get(patternId) ? 0.25 : 0
      let adjScore = (c.score + phaseFit + phaseTargetScore) * (1 - Math.min(penalty, 0.75))
      adjScore += difficultyProximityBonus(c.difficulty, poolCapOverall)
      adjScore *= sportContextMultiplier(c.exercise, sportKey, sportIdByKey)
      if (strengthIntent && phaseKey === 'capacity') adjScore *= 1.15
      return { ...c, adjScore, profile, phaseTargetScore }
    })
    .filter(Boolean)
    .sort((a, b) => b.adjScore - a.adjScore)
}

const NO_STRETCH_PRIMARY_PHASES = new Set([
  'prepare_and_access',
  'movement_intelligence',
  'output',
  'capacity',
  'resilience',
])

function highestCapSplitProfiles(splitProfiles) {
  if (!Array.isArray(splitProfiles) || splitProfiles.length === 0) return []
  const maxCap = Math.max(...splitProfiles.map((s) => Number(s.caps?.maxOverall ?? 0)))
  if (maxCap <= 0) return []
  return splitProfiles.filter((s) => Number(s.caps?.maxOverall ?? 0) >= maxCap)
}

function progressionEligiblePrimary(primaryDifficulty, splitProfiles) {
  const highSplits = highestCapSplitProfiles(splitProfiles)
  if (highSplits.length === 0) return false
  const primaryD = Number(primaryDifficulty?.overall ?? 0)
  const maxCap = Number(highSplits[0].caps?.maxOverall ?? 0)
  if (maxCap <= primaryD + 1) return false
  return highSplits.some((s) => classifyAgeFit(primaryDifficulty, s.caps) === 'good')
}

function classifyPrimaryAgeFit(difficulty, sessionCaps, splitProfiles) {
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

function rotatePoolBySeed(pool, seed) {
  const offset = Math.abs(Math.floor(Number(seed))) % Math.max(pool.length, 1)
  if (!Number.isFinite(Number(seed)) || pool.length < 2 || offset === 0) return pool
  return [...pool.slice(offset), ...pool.slice(0, offset)]
}

async function fillPhaseItems({
  dbPool,
  poolForPhase,
  scored,
  phaseKey,
  phase,
  budgetSeconds,
  minItems,
  maxItems = null,
  fillTargetRatio,
  splitProfiles,
  relaxSplit,
  splitVariantWarnings,
  usedExerciseIds,
  usedSlugs,
  usedSlugStems,
  usedNamesNormalized,
  usedMovementFamilies,
  usedPatterns,
  phasePatternUsed,
  familyCounts,
  sessionFamilyCounts,
  caps,
  scalingCohort,
  allowRelaxedPatternDedup = false,
  sustainedRelaxedPoolFill = false,
  methodologyKeyById,
  intentKeyById,
  resolvedPhaseTargets,
  phaseUsedProgressionIds,
  fillPass = 'primary',
}) {
  const items = []
  let usedSeconds = 0
  let skippedCandidates = 0
  let splitRejects = 0
  let progressionEligible = 0
  let progressionAssigned = 0
  let laneRejectReasons = emptyLaneRejectReasons()
  const targetSeconds = Math.floor(budgetSeconds * fillTargetRatio)

  for (const c of poolForPhase) {
    if (usedExerciseIds.has(Number(c.exercise.id))) { skippedCandidates += 1; continue }
    const slug = c.exercise.slug
    const slugStem = normalizeSlugStem(slug)
    if (slug && usedSlugs.has(slug)) { skippedCandidates += 1; continue }
    if (slugStem && usedSlugStems.has(slugStem)) { skippedCandidates += 1; continue }
    const normName = normalizeExerciseName(c.exercise.name)
    if (normName && usedNamesNormalized.has(normName)) { skippedCandidates += 1; continue }
    if (c.exercise.movement_family && usedMovementFamilies.has(c.exercise.movement_family)) { skippedCandidates += 1; continue }

    const familyKey = movementFamilyKey(c.exercise)
    if (movementFamilyBlocked(familyKey, phaseKey, familyCounts, sessionFamilyCounts)) {
      skippedCandidates += 1
      continue
    }

    if (NO_STRETCH_PRIMARY_PHASES.has(phaseKey)) {
      const primaryFit = classifyPrimaryAgeFit(c.difficulty, caps, splitProfiles)
      if (primaryFit === 'stretch' || primaryFit === 'over_cap') {
        skippedCandidates += 1
        continue
      }
    }

    const patternTag = c.tags.find((t) => t.facetType === 'pattern')
    if (!allowRelaxedPatternDedup && patternTag && phasePatternUsed.has(patternTag.facetId)) {
      skippedCandidates += 1
      continue
    }

    if (sustainedRelaxedPoolFill && phaseKey === 'sustained_capacity') {
      if (!sustainedCapacityCandidateEligible(c.exercise, c.tags, methodologyKeyById, intentKeyById, { strictConditioningMethodology: false })) {
        skippedCandidates += 1
        continue
      }
    }

    const dose = candidateDose(c)
    const cost = itemSecondsFromExercise(c.exercise, {
      sets: dose.sets,
      work_seconds: dose.work_seconds,
      rest_seconds: dose.rest_seconds,
      est_seconds_per_set: dose.est_seconds_per_set,
    })
    if (usedSeconds + cost > budgetSeconds) {
      if (items.length === 0 && minItems > 0) {
        // Allow one oversize item so the phase is not empty.
      } else {
        continue
      }
    }
    if (maxItems != null && items.length >= maxItems) break

    let perSplit = []
    let splitReservedIds = []
    let splitFallbackUsed = false
    let splitResolveWarnings = []
    const eligibleForProgression = SPLIT_PROGRESSION_PHASE_KEYS.has(phaseKey)
      && splitProfiles.length > 0
      && progressionEligiblePrimary(c.difficulty, splitProfiles)
    if (eligibleForProgression) progressionEligible += 1

    if (splitProfiles.length > 0) {
      const resolved = resolvePerSplitVariants(c, poolForPhase, scored, splitProfiles, phaseKey, phaseUsedProgressionIds, methodologyKeyById)
      splitResolveWarnings = [...(resolved.warnings ?? [])]
      if (resolved.laneRejectReasons) {
        laneRejectReasons = mergeLaneRejectReasons(laneRejectReasons, resolved.laneRejectReasons)
      }
      if (!splitCandidateAcceptable(resolved, c, splitProfiles, relaxSplit)) {
        splitRejects += 1
        skippedCandidates += 1
        continue
      }
      if (!resolved.complete) splitFallbackUsed = true
      perSplit = resolved.perSplit
      splitReservedIds = resolved.reservedIds
      for (const w of resolved.warnings) splitVariantWarnings.add(w)
      if (eligibleForProgression && perSplit.some((v) => v.variant_type === 'progression')) {
        progressionAssigned += 1
      }
    }

    const eduEx = await loadEducationForExercise(dbPool, Number(c.exercise.id), c.exercise.slug)
    const why = educationToWhyResponse(eduEx)
    const cohortScaling = scalingGuidanceForCohort(c.scalingProfiles, scalingCohort)

    items.push({
      fill_pass: fillPass,
      exercise_id: Number(c.exercise.id),
      exercise_name: c.exercise.name,
      equipment_ids: equipmentIdsForCandidate(c),
      volume_unit: dose.volume_unit,
      sets: dose.sets,
      reps: dose.reps,
      work_seconds: dose.work_seconds,
      distance: dose.distance,
      contacts: dose.contacts,
      rounds: dose.rounds,
      rest_seconds: dose.rest_seconds,
      est_seconds_per_set: dose.est_seconds_per_set,
      score: Number(c.score.toFixed(2)),
      phase_fit: c.profile.fitWeight,
      difficulty: c.difficulty,
      age_fit: classifyPrimaryAgeFit(c.difficulty, caps, splitProfiles),
      per_split: perSplit.length > 0 ? perSplit : undefined,
      split_alternates_json: perSplit.length > 0 ? perSplit : undefined,
      split_fallback_used: splitFallbackUsed || undefined,
      split_resolve_warnings: splitResolveWarnings.length > 0 ? splitResolveWarnings : undefined,
      selection_rationale: sustainedRelaxedPoolFill
        ? 'Relaxed sustained pool fill — limited library match.'
        : buildSelectionRationale(c, phaseKey, resolvedPhaseTargets, caps),
      placement_rationale: why?.phase_rationale ?? c.profile.notes ?? `Placed in ${phase?.name ?? phaseKey} based on phase fit.`,
      scaling_rationale: cohortScaling ?? why?.scaling_rationale ?? null,
    })
    usedSeconds += cost
    usedExerciseIds.add(Number(c.exercise.id))
    for (const altId of splitReservedIds) usedExerciseIds.add(altId)
    if (slug) usedSlugs.add(slug)
    if (slugStem) usedSlugStems.add(slugStem)
    if (normName) usedNamesNormalized.add(normName)
    if (c.exercise.movement_family) usedMovementFamilies.add(c.exercise.movement_family)
    recordMovementFamily(familyKey, phaseKey, familyCounts, sessionFamilyCounts)
    if (patternTag) {
      phasePatternUsed.add(patternTag.facetId)
      usedPatterns.set(patternTag.facetId, (usedPatterns.get(patternTag.facetId) || 0) + 1)
    }
    if (usedSeconds >= targetSeconds && items.length >= minItems) break
    if (usedSeconds >= budgetSeconds && items.length >= minItems) break
  }

  return {
    items,
    usedSeconds,
    skippedCandidates,
    splitRejects,
    progressionEligible,
    progressionAssigned,
    laneRejectReasons,
  }
}

export class PrescriptionError extends Error {
  constructor(message, code, details = {}) {
    super(message)
    this.code = code
    this.details = details
  }
}

export async function runPhaseAwarePrescription(pool, facilityId, body) {
  if (body?.enablePreflight === true) {
    const preflight = await runPreflight(body, pool, {
      metricsCatalog: body.metricsCatalog ?? null,
    })
    if (!preflight.ok) {
      throw new PrescriptionError(
        preflight.status === 'SYSTEM_FAIL'
          ? 'Prescription requirements failed preflight validation.'
          : (preflight.blocking_requirements[0]?.message ?? 'Prescription requirements are unsatisfiable.'),
        'unsatisfiable_requirements',
        {
          status: preflight.status ?? 'UNSATISFIABLE',
          blocking_requirements: preflight.blocking_requirements,
          suggested_relaxations: preflight.suggested_relaxations,
          checks: preflight.checks,
        },
      )
    }
  }

  const capsOverride = body.capsOverride ?? body.caps_override ?? null
  const audienceSplits = Array.isArray(body.audienceSplits ?? body.audience_splits)
    ? (body.audienceSplits ?? body.audience_splits)
    : []

  const audience = resolveAudienceProfile({
    ageMin: body.ageMin ?? body.age_min,
    ageMax: body.ageMax ?? body.age_max,
    trainingExperience: body.trainingExperience
      ?? body.training_experience
      ?? body.skillLevel
      ?? body.skill_level,
    sessionObjective: body.sessionObjective ?? body.session_objective,
    targets: body.targets,
    prompt: body.prompt,
  })

  if (capsOverride) {
    audience.caps = {
      maxOverall: Number(capsOverride.maxOverall ?? capsOverride.max_overall ?? audience.caps.maxOverall),
      maxTechnical: Number(capsOverride.maxTechnical ?? capsOverride.max_technical ?? audience.caps.maxTechnical),
      maxLoad: Number(capsOverride.maxLoad ?? capsOverride.max_load ?? audience.caps.maxLoad),
      maxComplexity: Number(capsOverride.maxComplexity ?? capsOverride.max_complexity ?? audience.caps.maxComplexity),
    }
  }

  const workMode = body.workMode ?? body.work_mode ?? 'exercise'
  const hardDifficultyExclude = resolveHardDifficultyExclude(body)

  const sportId = body.sportId != null ? Number(body.sportId) : null
  let sportKey = null
  if (sportId) {
    const sportRow = await pool.query(`SELECT key FROM coaching.sport WHERE id = $1 LIMIT 1`, [sportId])
    sportKey = sportRow.rows[0]?.key ?? null
  }
  const trainingExperience = body.trainingExperience
    || body.training_experience
    || body.skillLevel
    || body.skill_level
    || audience.trainingExperience
    || audience.impliedSkillLevel
    || null
  const ageMin = audience.ageMin
  const ageMax = audience.ageMax
  const caps = audience.caps
  const strengthIntent = audience.strengthIntent
  const scalingCohort = audience.scalingCohort

  const splitProfiles = buildSplitProfiles(audienceSplits, body)
  const poolCaps = mergeCapsMax(caps, ...splitProfiles.map((s) => s.caps))

  const { methodologyKeyById, intentKeyById, sportIdByKey } = await loadFacetKeyMaps(pool)

  const equipmentUseIds = equipmentUseIdsFromBody(body)
  const equipmentAvailableIds = equipmentAvailableIdsFromBody(body)
  const equipmentUsePolicy = equipmentUsePolicyFromBody(body)
  const allowBodyweight = body.allowBodyweight !== false && body.allow_bodyweight !== false
  let equipmentAvoidIds = effectiveEquipmentAvoidIds(body)
  const legacyEquipmentIds = Array.isArray(body.equipmentIds) ? body.equipmentIds.map(Number).filter(Number.isFinite) : []

  const { expandedIds: expandedAvoidEquip, avoidKeys } = await expandEquipmentAvoidIds(
    pool,
    [...equipmentAvoidIds, ...legacyEquipmentIds],
  )

  let bodyweightEquipIds = new Set()
  if ((equipmentUsePolicy === 'use_only' && equipmentUseIds.length > 0) || equipmentAvailableIds.length > 0) {
    bodyweightEquipIds = await loadBodyweightEquipmentIds(pool)
  }

  const excludeBodyRegionIds = Array.isArray(body.excludeBodyRegionIds)
    ? body.excludeBodyRegionIds.map(Number).filter(Number.isFinite)
    : []
  const avoidExerciseSlugs = Array.isArray(body.avoidExerciseSlugs ?? body.avoid_exercise_slugs)
    ? (body.avoidExerciseSlugs ?? body.avoid_exercise_slugs).map(String)
    : []
  const avoidExerciseIds = Array.isArray(body.avoidExerciseIds ?? body.avoid_exercise_ids)
    ? (body.avoidExerciseIds ?? body.avoid_exercise_ids).map(Number).filter(Number.isFinite)
    : []

  const constraintReport = {
    equipment_avoid: { excluded_count: 0, sample_names: [] },
    body_region_avoid: { excluded_count: 0 },
    exercise_avoid: { excluded_count: avoidExerciseIds.length + avoidExerciseSlugs.length },
    empty_phase_reasons: [],
    phase_fill: [],
  }
  const equipmentExcludedSamples = []

  const rawTargets = Array.isArray(body.targets) ? body.targets : audience.targets ?? []
  const sessionTargets = await resolveTargetFacetIds(pool, rawTargets.filter((t) => t.facetId != null || t.facetKey || t.key))

  const phasePlan = Array.isArray(body.phasePlan) && body.phasePlan.length > 0
    ? body.phasePlan
    : Array.isArray(body.blocks) && body.blocks.length > 0
      ? body.blocks
      : [{ phaseKey: 'capacity', label: 'Main Work', minutes: 30 }]
  const phasePlanOrder = new Map()
  phasePlan.forEach((block, index) => {
    const key = block.phaseKey ?? block.phase_key ?? block.phase ?? 'other'
    if (!phasePlanOrder.has(key)) phasePlanOrder.set(key, index)
  })
  const generationPlan = [
    ...phasePlan.filter((block) => !DERIVED_PHASE_KEYS.has(block.phaseKey ?? block.phase_key ?? block.phase)),
    ...phasePlan.filter((block) => DERIVED_PHASE_KEYS.has(block.phaseKey ?? block.phase_key ?? block.phase)),
  ]

  const phaseRows = await pool.query(`SELECT id, key, name FROM coaching.session_phase`)
  const phaseByKey = new Map(phaseRows.rows.map((p) => [p.key, p]))

  const params = [facilityId]
  const where = [`e.facility_id = $1`, `e.archived = FALSE`, `e.is_published = TRUE`]

  if (workMode === 'skill') {
    where.push(`e.programming_kind = 'skill_drill'`)
  } else if (workMode === 'exercise') {
    where.push(`e.programming_kind = 'exercise'`)
  }

  if (sportId) {
    params.push(sportId)
    where.push(`(e.sport_id = $${params.length} OR e.sport_id IS NULL)`)
  } else {
    // "Universal" means general-purpose programming, not every sport-specific
    // card in the facility. Explicit sport cards only enter the pool when that
    // sport is selected.
    where.push(`e.sport_id IS NULL`)
  }
  let ageMinParamIndex = null
  if (ageMin != null) {
    params.push(ageMin)
    ageMinParamIndex = params.length
    where.push(`(e.age_max IS NULL OR e.age_max >= $${ageMinParamIndex})`)
  }
  if (ageMax != null) {
    params.push(ageMax)
    const ageMaxParamIndex = params.length
    where.push(`(e.age_min IS NULL OR e.age_min <= $${ageMaxParamIndex})`)
    where.push(`NOT EXISTS (
      SELECT 1 FROM coaching.exercise_difficulty_profile d
      WHERE d.exercise_id = e.id
        AND e.programming_kind = 'exercise'
        AND d.recommended_age_min IS NOT NULL AND d.recommended_age_min > $${ageMaxParamIndex}
    )`)
    if (ageMinParamIndex != null) {
      where.push(`NOT EXISTS (
        SELECT 1 FROM coaching.exercise_difficulty_profile d
        WHERE d.exercise_id = e.id
          AND e.programming_kind = 'exercise'
          AND d.recommended_age_max IS NOT NULL AND d.recommended_age_max < $${ageMinParamIndex}
      )`)
    }
  }
  if (excludeBodyRegionIds.length > 0) {
    params.push(excludeBodyRegionIds)
    where.push(`NOT EXISTS (SELECT 1 FROM coaching.exercise_tag t WHERE t.exercise_id = e.id AND t.facet_type = 'body_region' AND t.facet_id = ANY($${params.length}::bigint[]))`)
  }
  if (avoidExerciseIds.length > 0) {
    params.push(avoidExerciseIds)
    where.push(`e.id != ALL($${params.length}::bigint[])`)
  }
  if (avoidExerciseSlugs.length > 0) {
    params.push(avoidExerciseSlugs)
    where.push(`e.slug != ALL($${params.length}::text[])`)
  }

  const candidates = await pool.query(`SELECT e.* FROM coaching.exercise e WHERE ${where.join(' AND ')} LIMIT 1000`, params)
  const ids = candidates.rows.map((r) => Number(r.id))

  const tagResult = await pool.query(
    `SELECT exercise_id, facet_type, facet_id, weight FROM coaching.exercise_tag WHERE exercise_id = ANY($1::bigint[])`,
    [ids],
  )
  const tagMap = new Map()
  for (const row of tagResult.rows) {
    const list = tagMap.get(String(row.exercise_id)) ?? []
    list.push({ facetType: row.facet_type, facetId: Number(row.facet_id), weight: Number(row.weight) })
    tagMap.set(String(row.exercise_id), list)
  }

  const bundle = await loadExerciseProgrammingBundle(pool, ids)
  const idToExercise = new Map(candidates.rows.map((r) => [Number(r.id), r]))
  const useEquip = new Set(equipmentUseIds)
  const useOnly = equipmentUsePolicy === 'use_only' && useEquip.size > 0
  const availableEquip = new Set(equipmentAvailableIds)
  const allowedEquip = useOnly ? useEquip : availableEquip
  const equipmentBoundaryActive = allowedEquip.size > 0
  const avoidEquip = expandedAvoidEquip
  const usedPatterns = new Map()
  const usedPatternsByPhase = new Map()
  const usedSlugs = new Set()
  const usedSlugStems = new Set()
  const usedMovementFamilies = new Set()
  const usedNamesNormalized = new Set()
  const sessionWarnings = new Set()
  const usedExerciseIds = new Set()
  const excludeExerciseIds = Array.isArray(body.excludeExerciseIds ?? body.exclude_exercise_ids)
    ? (body.excludeExerciseIds ?? body.exclude_exercise_ids).map(Number).filter(Number.isFinite)
    : []
  for (const id of excludeExerciseIds) usedExerciseIds.add(id)
  const regenerationSeed = body.regenerationSeed ?? body.regeneration_seed ?? null
  const familyCounts = new Map()
  const sessionFamilyCounts = new Map()

  const scored = candidates.rows
    .map((ex) => {
      const tags = tagMap.get(String(ex.id)) ?? []
      const equipTags = tags.filter((t) => t.facetType === 'equipment')

      if (avoidEquip.size > 0 || avoidKeys?.length > 0) {
        if (exerciseViolatesEquipmentAvoid(ex, equipTags, avoidEquip, avoidKeys)) {
          constraintReport.equipment_avoid.excluded_count += 1
          if (equipmentExcludedSamples.length < 8) equipmentExcludedSamples.push(ex.name)
          return null
        }
      }

      if (equipmentBoundaryActive && !exerciseAllowedUseOnly(equipTags, allowedEquip, allowBodyweight, bodyweightEquipIds)) {
        constraintReport.equipment_avoid.excluded_count += 1
        if (equipmentExcludedSamples.length < 8) equipmentExcludedSamples.push(ex.name)
        return null
      }

      if (legacyEquipmentIds.length > 0 && !equipmentAvoidIds.length && !equipmentUseIds.length) {
        if (equipTags.some((t) => !avoidEquip.has(t.facetId) && !legacyEquipmentIds.includes(t.facetId))) {
          if (equipTags.length > 0 && !equipTags.every((t) => legacyEquipmentIds.includes(t.facetId))) {
            return null
          }
        }
        if (equipTags.length > 0 && equipTags.some((t) => !legacyEquipmentIds.includes(t.facetId))) return null
      }

      let score = scoreTargets(tags, sessionTargets)
      if (useEquip.size > 0 && equipTags.some((t) => useEquip.has(t.facetId))) score += 12

      const profiles = bundle.phaseProfiles.get(String(ex.id)) ?? []
      const difficulty = bundle.difficultyProfiles?.get(String(ex.id)) ?? null
      const primary = profiles.find((p) => p.role === 'primary') ?? profiles[0]
      if (hardDifficultyExclude && !difficultyWithinCaps(difficulty, poolCaps, true)) return null

      if (strengthIntent && primary?.phaseKey === 'capacity') score += 4
      if (strengthIntent && (primary?.impactLevel ?? 99) <= 1) score += 2

      const beginnerPenalty = beginnerAppropriatenessPenalty(ex, primary, trainingExperience, sportKey)
      score -= beginnerPenalty

      const ageMultiplier = scoreAgeDifficultyFit(difficulty, poolCaps)
      score *= ageMultiplier
      score *= sportContextMultiplier(ex, sportKey, sportIdByKey)

      const scalingProfiles = bundle.scalingProfiles.get(String(ex.id)) ?? []
      const dosageProfiles = bundle.dosageProfiles.get(String(ex.id)) ?? []
      return {
        exercise: ex,
        tags,
        score,
        profiles,
        difficulty,
        scalingProfiles,
        dosageProfiles,
        requiredEquipmentMatch: equipTags.some((tag) => useEquip.has(tag.facetId)),
        bundleRow: attachProgrammingToExercise(ex, bundle, null),
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)

  constraintReport.equipment_avoid.sample_names = equipmentExcludedSamples
  if (excludeBodyRegionIds.length > 0) {
    constraintReport.body_region_avoid.excluded_count = Math.max(0, candidates.rows.length - ids.length)
  }

  const resultBlocks = []
  const phaseRationales = []
  const splitVariantWarnings = new Set()

  for (const block of generationPlan) {
    const phaseKey = block.phaseKey ?? block.phase_key ?? block.phase
    const otherKind = block.otherKind ?? block.other_kind

    if (otherKind === 'skills' || otherKind === 'games') {
      const itemIds = block.otherItemIds ?? block.other_item_ids ?? []
      const items = []
      if (otherKind === 'skills' && itemIds.length > 0) {
        const skills = await pool.query(
          `SELECT id, name, exercise_id FROM coaching.skill WHERE id = ANY($1::bigint[]) AND facility_id = $2 AND archived = FALSE`,
          [itemIds, facilityId],
        )
        for (const sk of skills.rows) {
          if (sk.exercise_id) {
            const ex = scored.find((c) => Number(c.exercise.id) === Number(sk.exercise_id))
            if (ex) {
              items.push({
                exercise_id: Number(sk.exercise_id),
                exercise_name: sk.name,
                sets: ex.exercise.default_sets ?? 3,
                reps: ex.exercise.default_reps,
                rest_seconds: ex.exercise.default_rest_seconds ?? 30,
                work_seconds: ex.exercise.default_work_seconds,
                est_seconds_per_set: ex.exercise.est_seconds_per_set,
                score: ex.score,
                selection_rationale: `Skill block: ${sk.name}`,
              })
            } else {
              items.push({
                exercise_id: Number(sk.exercise_id),
                exercise_name: sk.name,
                sets: 3,
                reps: null,
                rest_seconds: 30,
                est_seconds_per_set: 45,
                score: 0,
                selection_rationale: `Skill: ${sk.name}`,
              })
            }
          }
        }
      }
      if (otherKind === 'games' && itemIds.length > 0) {
        const games = await pool.query(
          `SELECT id, name FROM coaching.game WHERE id = ANY($1::bigint[]) AND facility_id = $2 AND archived = FALSE`,
          [itemIds, facilityId],
        )
        for (const g of games.rows) {
          items.push({
            exercise_id: null,
            exercise_name: g.name,
            sets: 1,
            reps: null,
            rest_seconds: 0,
            work_seconds: (Number(block.minutes) || 10) * 60,
            est_seconds_per_set: (Number(block.minutes) || 10) * 60,
            score: 0,
            selection_rationale: `Game: ${g.name}`,
            game_id: Number(g.id),
          })
        }
      }
      resultBlocks.push({
        label: block.label || (otherKind === 'skills' ? 'Skills' : 'Games'),
        phase_key: 'other',
        other_kind: otherKind,
        focus_targets: block.focusTargets ?? [],
        target_minutes: Number(block.minutes) || 15,
        estimated_minutes: Number(block.minutes) || 15,
        items,
      })
      continue
    }

    const phase = phaseByKey.get(phaseKey)
    const blockMinutes = Number(block.minutes) || 20
    const budgetSeconds = blockMinutes * 60
    const phaseTargets = Array.isArray(block.focusTargets ?? block.focus_targets)
      ? (block.focusTargets ?? block.focus_targets)
      : []
    const derivedWorkTargets = DERIVED_PHASE_KEYS.has(phaseKey)
      ? workDerivedFocusTargets(resultBlocks, tagMap)
      : []
    let resolvedPhaseTargets = await resolveTargetFacetIds(pool, [
      ...derivedWorkTargets,
      ...phaseTargets,
    ])
    const implicitHints = implicitPhaseFocusHints(audience.sessionObjective, phaseKey, phaseTargets.length)
    if (implicitHints.length > 0) {
      resolvedPhaseTargets = await resolveTargetFacetIds(pool, [...resolvedPhaseTargets, ...implicitHints])
    }

    const edu = phase
      ? await pool.query(
          `SELECT * FROM coaching.education_content WHERE entity_type = 'session_phase' AND entity_key = $1 LIMIT 1`,
          [phase.key],
        )
      : { rows: [] }

    phaseRationales.push({
      phase_key: phaseKey,
      phase_name: phase?.name ?? block.label,
      phase_rationale: edu.rows[0]?.why_it_goes_here ?? edu.rows[0]?.short_summary ?? null,
    })

    const poolForPhase = rotatePoolBySeed(
      buildPoolForPhase({
        scored,
        phaseKey,
        resolvedPhaseTargets,
        usedPatterns,
        strengthIntent,
        methodologyKeyById,
        intentKeyById,
        sportKey,
        sportIdByKey,
        poolCapOverall: poolCaps.maxOverall,
        ageMax,
      }),
      regenerationSeed != null ? Number(regenerationSeed) + phaseKey.length : null,
    )

    const minItems = minItemsForPhase(phaseKey, resolvedPhaseTargets)
    const maxItems = maxItemsForPhase(phaseKey, blockMinutes, resolvedPhaseTargets)
    const fillTargetRatio = phaseFillTarget(phaseKey, resolvedPhaseTargets, blockMinutes)
    const relaxSplit = shouldRelaxSplitGate(phaseKey, blockMinutes, resolvedPhaseTargets)
    const phasePatternUsed = usedPatternsByPhase.get(phaseKey) ?? new Set()
    const phaseUsedProgressionIds = new Set()

    let fillResult = await fillPhaseItems({
      dbPool: pool,
      poolForPhase,
      scored,
      phaseKey,
      phase,
      budgetSeconds,
      minItems,
      maxItems,
      fillTargetRatio,
      splitProfiles,
      relaxSplit,
      splitVariantWarnings,
      usedExerciseIds,
      usedSlugs,
      usedSlugStems,
      usedNamesNormalized,
      usedMovementFamilies,
      usedPatterns,
      phasePatternUsed,
      familyCounts,
      sessionFamilyCounts,
      caps,
      scalingCohort,
      methodologyKeyById,
      intentKeyById,
      resolvedPhaseTargets,
      phaseUsedProgressionIds,
    })

    const timeUnderfill = fillResult.usedSeconds < budgetSeconds * fillTargetRatio
    const itemUnderfill = fillResult.items.length < minItems
    if (itemUnderfill || timeUnderfill) {
      const remainingSeconds = Math.max(0, budgetSeconds - fillResult.usedSeconds)
      const backfillBudget = remainingSeconds > 0 ? remainingSeconds : (itemUnderfill ? 90 : 0)
      if (backfillBudget > 0) {
        const backfillMaxItems = timeUnderfill
          ? null
          : (maxItems != null ? Math.max(0, maxItems - fillResult.items.length) : null)
        const backfill = await fillPhaseItems({
          dbPool: pool,
          poolForPhase,
          scored,
          phaseKey,
          phase,
          budgetSeconds: backfillBudget,
          minItems: Math.max(0, minItems - fillResult.items.length),
          maxItems: backfillMaxItems,
          fillTargetRatio: 1,
          splitProfiles,
          relaxSplit: true,
          splitVariantWarnings,
          usedExerciseIds,
          usedSlugs,
          usedSlugStems,
          usedNamesNormalized,
          usedMovementFamilies,
          usedPatterns,
          phasePatternUsed,
          familyCounts,
          sessionFamilyCounts,
          caps,
          scalingCohort,
          allowRelaxedPatternDedup: true,
          methodologyKeyById,
          intentKeyById,
          resolvedPhaseTargets,
          phaseUsedProgressionIds,
          fillPass: 'backfill',
        })
        if (backfill.items.length > 0 || backfill.usedSeconds > 0) {
          fillResult = {
            items: [...fillResult.items, ...backfill.items],
            usedSeconds: fillResult.usedSeconds + backfill.usedSeconds,
            skippedCandidates: fillResult.skippedCandidates + backfill.skippedCandidates,
            splitRejects: fillResult.splitRejects + backfill.splitRejects,
            progressionEligible: fillResult.progressionEligible + backfill.progressionEligible,
            progressionAssigned: fillResult.progressionAssigned + backfill.progressionAssigned,
            laneRejectReasons: mergeLaneRejectReasons(fillResult.laneRejectReasons, backfill.laneRejectReasons),
          }
        }
      }
    }

    if (phaseKey === 'sustained_capacity'
      && hasSustainedConditioningFocus(resolvedPhaseTargets)
      && fillResult.items.length < minItems) {
      const remainingSeconds = Math.max(0, budgetSeconds - fillResult.usedSeconds)
      const relaxedBudget = remainingSeconds > 0 ? remainingSeconds : 90
      const sustainedRelaxedFill = await fillPhaseItems({
          dbPool: pool,
          poolForPhase,
          scored,
          phaseKey,
          phase,
          budgetSeconds: relaxedBudget,
          minItems: Math.max(0, minItems - fillResult.items.length),
          maxItems: null,
          fillTargetRatio: 1,
          splitProfiles,
          relaxSplit: true,
          splitVariantWarnings,
          usedExerciseIds,
          usedSlugs,
          usedSlugStems,
          usedNamesNormalized,
          usedMovementFamilies,
          usedPatterns,
          phasePatternUsed,
          familyCounts,
          sessionFamilyCounts,
          caps,
          scalingCohort,
          allowRelaxedPatternDedup: true,
          sustainedRelaxedPoolFill: true,
          methodologyKeyById,
          intentKeyById,
          resolvedPhaseTargets,
          phaseUsedProgressionIds,
        })
      if (sustainedRelaxedFill.items.length > 0) {
        fillResult = {
          items: [...fillResult.items, ...sustainedRelaxedFill.items],
          usedSeconds: fillResult.usedSeconds + sustainedRelaxedFill.usedSeconds,
          skippedCandidates: fillResult.skippedCandidates + sustainedRelaxedFill.skippedCandidates,
          splitRejects: fillResult.splitRejects + sustainedRelaxedFill.splitRejects,
          progressionEligible: fillResult.progressionEligible + sustainedRelaxedFill.progressionEligible,
          progressionAssigned: fillResult.progressionAssigned + sustainedRelaxedFill.progressionAssigned,
          laneRejectReasons: mergeLaneRejectReasons(fillResult.laneRejectReasons, sustainedRelaxedFill.laneRejectReasons),
        }
      }
    }

    usedPatternsByPhase.set(phaseKey, phasePatternUsed)

    const transitionSeconds = fillResult.items.length > 0
      ? Math.min(
          Math.max(0, budgetSeconds - fillResult.usedSeconds),
          Math.max(30, (fillResult.items.length - 1) * 30),
        )
      : 0
    const reconciledSeconds = Math.min(budgetSeconds, fillResult.usedSeconds + transitionSeconds)
    const exerciseMinutes = Math.round(fillResult.usedSeconds / 60)
    const transitionMinutes = Math.round((transitionSeconds / 60) * 10) / 10
    const estimatedMinutes = Math.round(reconciledSeconds / 60)
    const fillPct = blockMinutes > 0 ? Math.round((estimatedMinutes / blockMinutes) * 100) : 0
    const progressionLaneUnassignedDeepPool = SPLIT_PROGRESSION_PHASE_KEYS.has(phaseKey)
      && poolForPhase.length >= 20
      && fillResult.progressionEligible > 0
      && fillResult.progressionAssigned === 0
      && Number(fillResult.laneRejectReasons?.lane_mismatch ?? 0) > 0

    constraintReport.phase_fill.push({
      phase_key: phaseKey,
      target_minutes: blockMinutes,
      estimated_minutes: estimatedMinutes,
      exercise_minutes: exerciseMinutes,
      transition_minutes: transitionMinutes,
      fill_pct: fillPct,
      skipped_candidates: fillResult.skippedCandidates,
      split_rejects: fillResult.splitRejects,
      pool_size: poolForPhase.length,
      progression_eligible: fillResult.progressionEligible,
      progression_assigned: fillResult.progressionAssigned,
      progression_coverage: fillResult.progressionEligible > 0
        ? Number((fillResult.progressionAssigned / fillResult.progressionEligible).toFixed(3))
        : null,
      phase_progression_ids: [...phaseUsedProgressionIds],
      lane_reject_reasons: fillResult.laneRejectReasons ?? emptyLaneRejectReasons(),
      progression_lane_unassigned_deep_pool: progressionLaneUnassignedDeepPool,
    })

    if (fillResult.items.length === 0) {
      const reason = poolForPhase.length === 0 ? 'pool_empty' : 'all_candidates_filtered'
      constraintReport.empty_phase_reasons.push(
        `${block.label || phaseKey}: ${reason} — no exercises selected for phase/focus/constraints.`,
      )
    } else if (fillPct < 50) {
      constraintReport.empty_phase_reasons.push(
        `${block.label || phaseKey}: underfilled (${fillPct}% of ${blockMinutes}m target).`,
      )
    }

    resultBlocks.push({
      label: block.label || phase?.name || 'Block',
      phase_key: phaseKey,
      phase_id: phase?.id ?? null,
      focus_targets: resolvedPhaseTargets,
      derived_focus_targets: derivedWorkTargets,
      target_minutes: blockMinutes,
      estimated_minutes: estimatedMinutes,
      fill_pct: fillPct,
      items: fillResult.items,
    })
  }

  resultBlocks.sort((left, right) => (
    (phasePlanOrder.get(left.phase_key) ?? Number.MAX_SAFE_INTEGER)
    - (phasePlanOrder.get(right.phase_key) ?? Number.MAX_SAFE_INTEGER)
  ))

  // "must_use" is a coverage requirement: every selected equipment item must
  // appear at least once. "use_only" is an allow-list and must not reject an
  // otherwise valid session merely because one allowed item was not selected.
  if (equipmentUsePolicy === 'must_use' && useEquip.size > 0) {
    const versionLabels = splitProfiles.length > 0
      ? splitProfiles.map((split) => split.label)
      : [null]
    const missingByVersion = []
    for (const splitLabel of versionLabels) {
      const usedEquipIds = new Set()
      for (const block of resultBlocks) {
        for (const item of block.items) {
          const selected = splitLabel == null
            ? item
            : ((item.per_split ?? item.split_alternates_json ?? [])
                .find((variant) => variant.split_label === splitLabel) ?? item)
          const tags = tagMap.get(String(selected.exercise_id)) ?? []
          for (const tag of tags) {
            if (tag.facetType === 'equipment' && useEquip.has(tag.facetId)) usedEquipIds.add(tag.facetId)
          }
        }
      }
      const missing = [...useEquip].filter((id) => !usedEquipIds.has(id))
      if (missing.length > 0) missingByVersion.push({ split_label: splitLabel, equipment_ids: missing })
    }
    const missing = [...new Set(missingByVersion.flatMap((row) => row.equipment_ids))]
    if (missing.length > 0) {
      const names = await pool.query(`SELECT id, name FROM coaching.equipment WHERE id = ANY($1::bigint[])`, [missing])
      throw new PrescriptionError(
        'No workout satisfies required equipment for this session.',
        'unsatisfiable_equipment',
        {
          unsatisfiable_equipment: names.rows.map((r) => ({ id: Number(r.id), name: r.name })),
          unsatisfied_versions: missingByVersion,
        },
      )
    }
  }

  if (expandedAvoidEquip.size > 0 || avoidKeys?.length > 0) {
    const violations = auditPrescriptionEquipmentAvoid(
      resultBlocks,
      tagMap,
      expandedAvoidEquip,
      avoidKeys,
      idToExercise,
    )
    if (violations.length > 0) {
      throw new PrescriptionError(
        'Prescription includes avoided equipment.',
        'violates_equipment_avoid',
        { violations },
      )
    }
  }

  sessionWarnings.clear()
  for (const block of resultBlocks) {
    for (const item of block.items ?? []) {
      if (item.age_fit && item.age_fit !== 'good' && item.difficulty) {
        for (const w of ageFitWarnings(item.difficulty, caps, item.exercise_name)) {
          sessionWarnings.add(w)
        }
      }
    }
  }

  return {
    blocks: resultBlocks,
    phase_rationales: phaseRationales,
    work_mode: workMode,
    audience_profile: {
      ageMin: audience.ageMin,
      ageMax: audience.ageMax,
      caps: audience.caps,
      scalingCohort: audience.scalingCohort,
      impliedSkillLevel: audience.impliedSkillLevel,
      ageBandLabel: audience.ageBandLabel,
      strengthIntent: audience.strengthIntent,
      sessionObjective: audience.sessionObjective,
      hardDifficultyExclude,
    },
    audience_splits: splitProfiles,
    age_fit_warnings: [...sessionWarnings],
    split_variant_warnings: [...splitVariantWarnings],
    constraint_report: constraintReport,
    candidates: scored.slice(0, 40).map((c) => ({
      exercise_id: Number(c.exercise.id),
      exercise_name: c.exercise.name,
      score: Number(c.score.toFixed(2)),
      est_seconds_per_set: Number(c.exercise.est_seconds_per_set),
      primary_phase: c.profiles.find((p) => p.role === 'primary')?.phaseKey ?? null,
      difficulty: c.difficulty,
    })),
  }
}

export async function getSessionPhaseTemplates(pool) {
  const result = await pool.query(
    `SELECT entity_key, title, short_summary, examples_json, programming_guidance FROM coaching.education_content
     WHERE entity_type = 'template' AND entity_key LIKE 'session_%' AND is_published = TRUE
     ORDER BY sort_order, entity_key`,
  )
  return result.rows.map((r) => {
    const rawPlan = Array.isArray(r.examples_json) ? r.examples_json : []
    const phase_plan = rawPlan.map((row) => ({
      phaseKey: row.phaseKey ?? row.phase,
      minutes: Number(row.minutes) || 0,
      label: row.label ?? undefined,
      contains_tumbling: Boolean(row.contains_tumbling ?? row.containsTumbling),
      add_on_focus: row.add_on_focus ?? row.addOnFocus ?? undefined,
    })).filter((p) => p.phaseKey && p.minutes >= 0)
    return {
      key: r.entity_key,
      title: r.title,
      summary: r.short_summary,
      phase_plan,
      placement_guidance: r.programming_guidance ?? null,
    }
  })
}

export async function listCoachPhaseTemplates(pool, facilityId, coachUserId) {
  const result = await pool.query(
    `SELECT id, name, phase_plan_json, created_at, updated_at FROM coaching.coach_phase_template
     WHERE facility_id = $1 AND coach_user_id = $2 AND archived = FALSE ORDER BY updated_at DESC`,
    [facilityId, coachUserId],
  )
  return result.rows.map((r) => ({
    id: Number(r.id),
    name: r.name,
    phase_plan: r.phase_plan_json,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }))
}

export async function saveCoachPhaseTemplate(pool, facilityId, coachUserId, name, phasePlanJson) {
  const result = await pool.query(
    `INSERT INTO coaching.coach_phase_template (facility_id, coach_user_id, name, phase_plan_json, updated_at)
     VALUES ($1, $2, $3, $4::jsonb, now()) RETURNING id, name, phase_plan_json, created_at, updated_at`,
    [facilityId, coachUserId, name, JSON.stringify(phasePlanJson ?? [])],
  )
  return result.rows[0]
}

export async function deleteCoachPhaseTemplate(pool, facilityId, coachUserId, templateId) {
  await pool.query(
    `UPDATE coaching.coach_phase_template SET archived = TRUE, updated_at = now()
     WHERE id = $1 AND facility_id = $2 AND coach_user_id = $3`,
    [templateId, facilityId, coachUserId],
  )
}

export async function listCoachNeedsEngineRequirements(pool, facilityId, coachUserId) {
  const result = await pool.query(
    `SELECT id, name, requirements_json, created_at, updated_at FROM coaching.coach_needs_engine_requirements
     WHERE facility_id = $1 AND coach_user_id = $2 AND archived = FALSE ORDER BY updated_at DESC`,
    [facilityId, coachUserId],
  )
  return result.rows.map((r) => ({
    id: Number(r.id),
    name: r.name,
    requirements: r.requirements_json,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }))
}

function sanitizeRequirementsJson(requirementsJson) {
  if (!requirementsJson || typeof requirementsJson !== 'object' || Array.isArray(requirementsJson)) {
    return {}
  }
  const { result: _result, blockProgramming: _blockProgramming, ...requirements } = requirementsJson
  return requirements
}

export async function saveCoachNeedsEngineRequirements(pool, facilityId, coachUserId, name, requirementsJson) {
  const sanitized = sanitizeRequirementsJson(requirementsJson)
  const result = await pool.query(
    `INSERT INTO coaching.coach_needs_engine_requirements (facility_id, coach_user_id, name, requirements_json, updated_at)
     VALUES ($1, $2, $3, $4::jsonb, now()) RETURNING id, name, requirements_json, created_at, updated_at`,
    [facilityId, coachUserId, name, JSON.stringify(sanitized)],
  )
  const row = result.rows[0]
  return {
    id: Number(row.id),
    name: row.name,
    requirements: row.requirements_json,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export async function deleteCoachNeedsEngineRequirements(pool, facilityId, coachUserId, requirementsId) {
  await pool.query(
    `UPDATE coaching.coach_needs_engine_requirements SET archived = TRUE, updated_at = now()
     WHERE id = $1 AND facility_id = $2 AND coach_user_id = $3`,
    [requirementsId, facilityId, coachUserId],
  )
}
