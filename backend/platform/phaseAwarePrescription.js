import { loadExerciseProgrammingBundle, attachProgrammingToExercise } from './exerciseProgramming.js'
import { loadEducationForExercise, educationToWhyResponse } from './educationContent.js'
import {
  resolveAudienceProfile,
  scoreAgeDifficultyFit,
  classifyAgeFit,
  ageFitWarnings,
} from './ageDifficultyPolicy.js'
import {
  expandEquipmentAvoidIds,
  exerciseViolatesEquipmentAvoid,
  auditPrescriptionEquipmentAvoid,
} from './equipmentAvoidPolicy.js'
import { buildSkillLevelSql } from './skillLevelPolicy.js'
import { beginnerAppropriatenessPenalty } from './beginnerExclusionPolicy.js'
import { implicitPhaseFocusHints } from './sessionObjectivePolicy.js'
import {
  restoreCandidateExcluded,
  restoreProfileEligible,
  restoreScoreBoost,
} from './restoreSelectionPolicy.js'
import {
  hasHiitFocus,
  minItemsForPhase,
  maxItemsForPhase,
  phaseFillTarget,
  shouldRelaxSplitGate,
  sustainedCapacityExcluded,
  sustainedCapacityCandidateEligible,
} from './sustainedCapacityPolicy.js'
import { sportContextMultiplier } from './sportContextPolicy.js'
import {
  movementFamilyBlocked,
  movementFamilyKey,
  normalizeSlugStem,
  recordMovementFamily,
} from './movementFamilyPolicy.js'

function itemSecondsFromExercise(ex, item) {
  const sets = Number(item?.sets ?? ex.default_sets) || 3
  const work = Number(item?.work_seconds ?? ex.default_work_seconds) || Number(ex.est_seconds_per_set) || 45
  const restRaw = item?.rest_seconds ?? ex.default_rest_seconds
  const rest = restRaw != null && restRaw !== '' ? Number(restRaw) : 30
  return sets * work + sets * rest
}

function mergeCapsMax(...capObjects) {
  const valid = capObjects.filter(Boolean)
  if (valid.length === 0) {
    return { maxOverall: 10, maxTechnical: 10, maxLoad: 10 }
  }
  return {
    maxOverall: Math.max(...valid.map((c) => Number(c.maxOverall ?? 10))),
    maxTechnical: Math.max(...valid.map((c) => Number(c.maxTechnical ?? 10))),
    maxLoad: Math.max(...valid.map((c) => Number(c.maxLoad ?? 10))),
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
  for (const target of targets) {
    const facetType = target.facetType ?? target.facet_type
    if (target.facetId != null && facetType === 'order_slot' && !target.facetKey && !target.key) {
      const row = await pool.query(
        `SELECT key FROM coaching.phase_order_slot WHERE id = $1 LIMIT 1`,
        [Number(target.facetId)],
      )
      if (row.rows[0]?.key) {
        resolved.push({ ...target, facetType, facetKey: row.rows[0].key })
        continue
      }
    }
    if (target.facetId != null) {
      resolved.push({ ...target, facetType })
      continue
    }
    const key = target.facetKey ?? target.key
    if (!key || !facetType) continue
    const tableMap = {
      tenet: 'tenet',
      methodology: 'methodology',
      physiology: 'physiological_emphasis',
      order_slot: 'phase_order_slot',
    }
    const table = tableMap[facetType]
    if (!table) continue
    const row = await pool.query(`SELECT id, key FROM coaching.${table} WHERE key = $1 LIMIT 1`, [String(key)])
    if (row.rows[0]?.id) {
      const entry = { ...target, facetType, facetId: Number(row.rows[0].id) }
      if (facetType === 'order_slot') entry.facetKey = row.rows[0].key
      resolved.push(entry)
    }
  }
  return resolved
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

  const candidateSlot = candidate.exercise.primary_order_slot ?? profile.order_slot ?? profile.orderSlot
  const primaryProfile = candidatePhaseProfile(primaryCandidate, phaseKey)
  const primarySlot = primaryCandidate.exercise.primary_order_slot ?? primaryProfile?.order_slot ?? primaryProfile?.orderSlot
  return Boolean(candidateSlot && primarySlot && candidateSlot === primarySlot)
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

function pickSplitProgression(candidates, primaryCandidate, caps, phaseKey, excludeIds = new Set(), fullScored = []) {
  const primaryExerciseId = Number(primaryCandidate.exercise.id)
  const primaryPattern = primaryCandidate.tags?.find((t) => t.facetType === 'pattern')?.facetId
  const primaryDiff = Number(primaryCandidate.difficulty?.overall ?? 0)
  const targetCap = Number(caps?.maxOverall ?? 10)
  if (targetCap <= primaryDiff + 1) return null

  const tryPick = (pool) => {
    const eligible = pool.filter((c) => {
      if (Number(c.exercise.id) === primaryExerciseId) return false
      if (excludeIds.has(Number(c.exercise.id))) return false
      if (!sameProgressionLane(c, primaryCandidate, phaseKey)) return false
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

    return eligible[0] ?? null
  }

  return tryPick(candidates) ?? tryPick(fullScored)
}

function normalizeExerciseName(name) {
  return String(name ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function buildSplitVariantEntry(split, candidate, { variantType, substituted = false, scalingGuidance = null } = {}) {
  return {
    split_label: split.label,
    age_min: split.ageMin ?? null,
    age_max: split.ageMax ?? null,
    difficulty_cap: split.caps?.maxOverall ?? null,
    exercise_id: Number(candidate.exercise.id),
    exercise_name: candidate.exercise.name,
    difficulty: candidate.difficulty ?? null,
    substituted: substituted || variantType === 'substituted',
    variant_type: variantType,
    scaling_guidance: scalingGuidance ?? null,
  }
}

function resolvePerSplitVariants(primary, poolForPhase, scored, splitProfiles, phaseKey) {
  const perSplit = []
  const warnings = []
  const reservedIds = new Set([Number(primary.exercise.id)])

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
      if (cap > primaryDiff + 1) {
        const progressed = pickSplitProgression(searchPool, primary, split.caps, phaseKey, reservedIds, scored)
        if (progressed) {
          reservedIds.add(Number(progressed.exercise.id))
          perSplit.push(buildSplitVariantEntry(split, progressed, {
            variantType: 'progression',
            scalingGuidance: scalingGuidanceForCohort(progressed.scalingProfiles, split.scalingCohort),
          }))
          continue
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
        scalingGuidance: scalingGuidanceForCohort(alt.scalingProfiles, split.scalingCohort),
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
  }
}

function splitCandidateAcceptable(resolved, primary, splitProfiles, relaxSplit) {
  if (resolved.complete) return true
  if (relaxSplit) return true
  const hasScaled = resolved.perSplit.some((e) => e.variant_type === 'scaled' || e.scaling_guidance)
  if (hasScaled) return true
  if (splitProfiles.length === 0) return false
  const youngest = splitProfiles.reduce((a, b) => (
    Number(a.ageMax ?? 99) <= Number(b.ageMax ?? 99) ? a : b
  ))
  const fit = classifyAgeFit(primary.difficulty, youngest.caps)
  return fit !== 'over_cap'
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
}) {
  return scored
    .map((c) => {
      const profile = c.profiles.find((p) => p.phaseKey === phaseKey && p.role !== 'avoid')
      if (!profile) return null

      if (phaseKey === 'restore') {
        if (!restoreProfileEligible(c.exercise, profile)) return null
        if (restoreCandidateExcluded(c.exercise, profile, c.tags, methodologyKeyById)) return null
      }

      if (sustainedCapacityExcluded(phaseKey, c.exercise, c.tags, methodologyKeyById, intentKeyById, resolvedPhaseTargets)) {
        return null
      }

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
  sustainedFallback = false,
  methodologyKeyById,
  intentKeyById,
  resolvedPhaseTargets,
}) {
  const items = []
  let usedSeconds = 0
  let skippedCandidates = 0
  let splitRejects = 0
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

    const patternTag = c.tags.find((t) => t.facetType === 'pattern')
    if (!allowRelaxedPatternDedup && patternTag && phasePatternUsed.has(patternTag.facetId)) {
      skippedCandidates += 1
      continue
    }

    if (sustainedFallback && phaseKey === 'sustained_capacity') {
      if (!sustainedCapacityCandidateEligible(c.exercise, c.tags, methodologyKeyById, intentKeyById, { strictHiit: false })) {
        skippedCandidates += 1
        continue
      }
    }

    const cost = itemSecondsFromExercise(c.exercise, {})
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
    if (splitProfiles.length > 0 && !sustainedFallback) {
      const resolved = resolvePerSplitVariants(c, poolForPhase, scored, splitProfiles, phaseKey)
      if (!splitCandidateAcceptable(resolved, c, splitProfiles, relaxSplit)) {
        splitRejects += 1
        skippedCandidates += 1
        continue
      }
      if (!resolved.complete) splitFallbackUsed = true
      perSplit = resolved.perSplit
      splitReservedIds = resolved.reservedIds
      for (const w of resolved.warnings) splitVariantWarnings.add(w)
    }

    const eduEx = await loadEducationForExercise(dbPool, Number(c.exercise.id), c.exercise.slug)
    const why = educationToWhyResponse(eduEx)
    const cohortScaling = scalingGuidanceForCohort(c.scalingProfiles, scalingCohort)

    items.push({
      exercise_id: Number(c.exercise.id),
      exercise_name: c.exercise.name,
      sets: c.exercise.default_sets ?? 3,
      reps: c.exercise.default_reps,
      rest_seconds: c.exercise.default_rest_seconds ?? 30,
      work_seconds: c.exercise.default_work_seconds,
      est_seconds_per_set: c.exercise.est_seconds_per_set,
      score: Number(c.score.toFixed(2)),
      phase_fit: c.profile.fitWeight,
      difficulty: c.difficulty,
      age_fit: classifyAgeFit(c.difficulty, caps),
      per_split: perSplit.length > 0 ? perSplit : undefined,
      split_alternates_json: perSplit.length > 0 ? perSplit : undefined,
      split_fallback_used: splitFallbackUsed || undefined,
      selection_rationale: sustainedFallback
        ? 'HIIT fallback — limited library match.'
        : (why?.training_purpose ?? `Selected for ${phase?.name ?? phaseKey} (score ${c.score.toFixed(1)}).`),
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

  return { items, usedSeconds, skippedCandidates, splitRejects }
}

export class PrescriptionError extends Error {
  constructor(message, code, details = {}) {
    super(message)
    this.code = code
    this.details = details
  }
}

export async function runPhaseAwarePrescription(pool, facilityId, body) {
  const capsOverride = body.capsOverride ?? body.caps_override ?? null
  const audienceSplits = Array.isArray(body.audienceSplits ?? body.audience_splits)
    ? (body.audienceSplits ?? body.audience_splits)
    : []

  const audience = resolveAudienceProfile({
    ageMin: body.ageMin ?? body.age_min,
    ageMax: body.ageMax ?? body.age_max,
    skillLevel: body.skillLevel ?? body.skill_level,
    sessionObjective: body.sessionObjective ?? body.session_objective,
    targets: body.targets,
    prompt: body.prompt,
  })

  if (capsOverride) {
    audience.caps = {
      maxOverall: Number(capsOverride.maxOverall ?? capsOverride.max_overall ?? audience.caps.maxOverall),
      maxTechnical: Number(capsOverride.maxTechnical ?? capsOverride.max_technical ?? audience.caps.maxTechnical),
      maxLoad: Number(capsOverride.maxLoad ?? capsOverride.max_load ?? audience.caps.maxLoad),
    }
  }

  const workMode = body.workMode ?? body.work_mode ?? 'exercise'
  const hardDifficultyExclude = capsOverride != null || audienceSplits.some((s) => {
    const override = s.capsOverride ?? s.caps_override ?? s.difficultyOverride ?? s.difficulty_override
    return override != null
  })

  const sportId = body.sportId != null ? Number(body.sportId) : null
  let sportKey = null
  if (sportId) {
    const sportRow = await pool.query(`SELECT key FROM coaching.sport WHERE id = $1 LIMIT 1`, [sportId])
    sportKey = sportRow.rows[0]?.key ?? null
  }
  const level = body.skillLevel || body.skill_level || audience.impliedSkillLevel || null
  const ageMin = audience.ageMin
  const ageMax = audience.ageMax
  const caps = audience.caps
  const strengthIntent = audience.strengthIntent
  const scalingCohort = audience.scalingCohort

  const splitProfiles = buildSplitProfiles(audienceSplits, body)
  const poolCaps = mergeCapsMax(caps, ...splitProfiles.map((s) => s.caps))

  const { methodologyKeyById, intentKeyById, sportIdByKey } = await loadFacetKeyMaps(pool)

  const equipmentUseIds = Array.isArray(body.equipmentUseIds ?? body.equipment_use_ids)
    ? (body.equipmentUseIds ?? body.equipment_use_ids).map(Number).filter(Number.isFinite)
    : []
  const equipmentAvoidIds = Array.isArray(body.equipmentAvoidIds ?? body.equipment_avoid_ids)
    ? (body.equipmentAvoidIds ?? body.equipment_avoid_ids).map(Number).filter(Number.isFinite)
    : []
  const legacyEquipmentIds = Array.isArray(body.equipmentIds) ? body.equipmentIds.map(Number).filter(Number.isFinite) : []

  const { expandedIds: expandedAvoidEquip, avoidKeys } = await expandEquipmentAvoidIds(
    pool,
    [...equipmentAvoidIds, ...legacyEquipmentIds],
  )

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
  }
  if (level && level !== 'N/A') {
    const skillSql = buildSkillLevelSql(level, params.length + 1)
    if (skillSql.clause) {
      params.push(...skillSql.params)
      where.push(skillSql.clause)
    }
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
  const avoidEquip = expandedAvoidEquip
  const usedPatterns = new Map()
  const usedPatternsByPhase = new Map()
  const usedSlugs = new Set()
  const usedSlugStems = new Set()
  const usedMovementFamilies = new Set()
  const usedNamesNormalized = new Set()
  const sessionWarnings = new Set()
  const usedExerciseIds = new Set()
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
      const isSkillDrill = ex.programming_kind === 'skill_drill'

      if (hardDifficultyExclude && !isSkillDrill && !difficultyWithinCaps(difficulty, poolCaps, true)) return null

      if (strengthIntent && primary?.phaseKey === 'capacity') score += 4
      if (strengthIntent && (primary?.impactLevel ?? 99) <= 1) score += 2

      const beginnerPenalty = beginnerAppropriatenessPenalty(ex, primary, level, sportKey)
      score -= beginnerPenalty

      const ageMultiplier = isSkillDrill ? 1 : scoreAgeDifficultyFit(difficulty, poolCaps)
      score *= ageMultiplier
      score *= sportContextMultiplier(ex, sportKey, sportIdByKey)

      if (!isSkillDrill && difficulty && caps && classifyAgeFit(difficulty, caps) !== 'good') {
        for (const w of ageFitWarnings(difficulty, caps, ex.name)) sessionWarnings.add(w)
      }

      const scalingProfiles = bundle.scalingProfiles.get(String(ex.id)) ?? []
      return {
        exercise: ex,
        tags,
        score,
        profiles,
        difficulty,
        scalingProfiles,
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

  for (const block of phasePlan) {
    const phaseKey = block.phaseKey ?? block.phase_key ?? block.phase
    const otherKind = block.otherKind ?? block.other_kind

    if (otherKind === 'tramp_tumble' || phaseKey === 'other_tramp_tumble') {
      resultBlocks.push({
        label: block.label || 'Tramp & Tumble',
        phase_key: 'other',
        other_kind: 'tramp_tumble',
        focus_targets: block.focusTargets ?? [],
        target_minutes: Number(block.minutes) || 15,
        estimated_minutes: Number(block.minutes) || 15,
        items: [],
      })
      continue
    }

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
    let resolvedPhaseTargets = await resolveTargetFacetIds(pool, phaseTargets)
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

    const poolForPhase = buildPoolForPhase({
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
    })

    const minItems = minItemsForPhase(phaseKey, resolvedPhaseTargets)
    const maxItems = maxItemsForPhase(phaseKey, blockMinutes)
    const fillTargetRatio = phaseFillTarget(phaseKey, resolvedPhaseTargets, blockMinutes)
    const relaxSplit = shouldRelaxSplitGate(phaseKey, blockMinutes, resolvedPhaseTargets)
    const phasePatternUsed = usedPatternsByPhase.get(phaseKey) ?? new Set()

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
    })

    if (fillResult.items.length < minItems
      || fillResult.usedSeconds < budgetSeconds * fillTargetRatio) {
      const remainingSeconds = Math.max(0, budgetSeconds - fillResult.usedSeconds)
      if (remainingSeconds > 0) {
        const backfill = await fillPhaseItems({
          dbPool: pool,
          poolForPhase,
          scored,
          phaseKey,
          phase,
          budgetSeconds: remainingSeconds,
          minItems: Math.max(0, minItems - fillResult.items.length),
          maxItems: maxItems != null ? Math.max(0, maxItems - fillResult.items.length) : null,
          fillTargetRatio: 1,
          splitProfiles: [],
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
        })
        if (backfill.items.length > 0 || backfill.usedSeconds > 0) {
          fillResult = {
            items: [...fillResult.items, ...backfill.items],
            usedSeconds: fillResult.usedSeconds + backfill.usedSeconds,
            skippedCandidates: fillResult.skippedCandidates + backfill.skippedCandidates,
            splitRejects: fillResult.splitRejects + backfill.splitRejects,
          }
        }
      }
    }

    if (phaseKey === 'sustained_capacity'
      && hasHiitFocus(resolvedPhaseTargets)
      && fillResult.items.length < minItems) {
      const remainingSeconds = Math.max(0, budgetSeconds - fillResult.usedSeconds)
      if (remainingSeconds > 0) {
        const hiitFallback = await fillPhaseItems({
          dbPool: pool,
          poolForPhase,
          scored,
          phaseKey,
          phase,
          budgetSeconds: remainingSeconds,
          minItems: Math.max(0, minItems - fillResult.items.length),
          maxItems: maxItems != null ? Math.max(0, maxItems - fillResult.items.length) : null,
          fillTargetRatio: 1,
          splitProfiles: [],
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
          sustainedFallback: true,
          methodologyKeyById,
          intentKeyById,
          resolvedPhaseTargets,
        })
        if (hiitFallback.items.length > 0) {
          fillResult = {
            items: [...fillResult.items, ...hiitFallback.items],
            usedSeconds: fillResult.usedSeconds + hiitFallback.usedSeconds,
            skippedCandidates: fillResult.skippedCandidates + hiitFallback.skippedCandidates,
            splitRejects: fillResult.splitRejects + hiitFallback.splitRejects,
          }
        }
      }
    }

    usedPatternsByPhase.set(phaseKey, phasePatternUsed)

    const estimatedMinutes = Math.round(fillResult.usedSeconds / 60)
    const fillPct = blockMinutes > 0 ? Math.round((estimatedMinutes / blockMinutes) * 100) : 0
    constraintReport.phase_fill.push({
      phase_key: phaseKey,
      target_minutes: blockMinutes,
      estimated_minutes: estimatedMinutes,
      fill_pct: fillPct,
      skipped_candidates: fillResult.skippedCandidates,
      split_rejects: fillResult.splitRejects,
      pool_size: poolForPhase.length,
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
      focus_targets: phaseTargets,
      target_minutes: blockMinutes,
      estimated_minutes: estimatedMinutes,
      fill_pct: fillPct,
      items: fillResult.items,
    })
  }

  if (useEquip.size > 0) {
    const usedEquipIds = new Set()
    for (const block of resultBlocks) {
      for (const item of block.items) {
        const tags = tagMap.get(String(item.exercise_id)) ?? []
        for (const t of tags) {
          if (t.facetType === 'equipment' && useEquip.has(t.facetId)) usedEquipIds.add(t.facetId)
        }
      }
    }
    const missing = [...useEquip].filter((id) => !usedEquipIds.has(id))
    if (missing.length > 0) {
      const names = await pool.query(`SELECT id, name FROM coaching.equipment WHERE id = ANY($1::bigint[])`, [missing])
      throw new PrescriptionError(
        'No workout satisfies required equipment for this session.',
        'unsatisfiable_equipment',
        { unsatisfiable_equipment: names.rows.map((r) => ({ id: Number(r.id), name: r.name })) },
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

export async function saveCoachNeedsEngineRequirements(pool, facilityId, coachUserId, name, requirementsJson) {
  const result = await pool.query(
    `INSERT INTO coaching.coach_needs_engine_requirements (facility_id, coach_user_id, name, requirements_json, updated_at)
     VALUES ($1, $2, $3, $4::jsonb, now()) RETURNING id, name, requirements_json, created_at, updated_at`,
    [facilityId, coachUserId, name, JSON.stringify(requirementsJson ?? {})],
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
