import { loadExerciseProgrammingBundle, attachProgrammingToExercise } from './exerciseProgramming.js'
import { loadEducationForExercise, educationToWhyResponse } from './educationContent.js'
import {
  resolveAudienceProfile,
  scoreAgeDifficultyFit,
  classifyAgeFit,
  ageFitWarnings,
} from './ageDifficultyPolicy.js'

function itemSecondsFromExercise(ex, item) {
  const sets = Number(item?.sets ?? ex.default_sets) || 3
  const work = Number(item?.work_seconds ?? ex.default_work_seconds) || Number(ex.est_seconds_per_set) || 45
  const rest = Number(item?.rest_seconds ?? ex.default_rest_seconds) || 30
  return sets * work + sets * rest
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

function pickSplitAlternate(candidates, primaryExerciseId, caps, hardExclude) {
  const primaryPattern = candidates.find((c) => Number(c.exercise.id) === Number(primaryExerciseId))
    ?.tags?.find((t) => t.facetType === 'pattern')?.facetId

  for (const c of candidates) {
    if (Number(c.exercise.id) === Number(primaryExerciseId)) continue
    if (!difficultyWithinCaps(c.difficulty, caps, hardExclude)) continue
    if (primaryPattern) {
      const pat = c.tags.find((t) => t.facetType === 'pattern')?.facetId
      if (pat && pat !== primaryPattern) continue
    }
    return c
  }
  return null
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
  const hardDifficultyExclude = capsOverride != null || audienceSplits.some((s) => s.capsOverride ?? s.caps_override)

  const sportId = body.sportId != null ? Number(body.sportId) : null
  const level = body.skillLevel || body.skill_level || audience.impliedSkillLevel || null
  const ageMin = audience.ageMin
  const ageMax = audience.ageMax
  const caps = audience.caps
  const strengthIntent = audience.strengthIntent
  const scalingCohort = audience.scalingCohort

  const equipmentUseIds = Array.isArray(body.equipmentUseIds ?? body.equipment_use_ids)
    ? (body.equipmentUseIds ?? body.equipment_use_ids).map(Number).filter(Number.isFinite)
    : []
  const equipmentAvoidIds = Array.isArray(body.equipmentAvoidIds ?? body.equipment_avoid_ids)
    ? (body.equipmentAvoidIds ?? body.equipment_avoid_ids).map(Number).filter(Number.isFinite)
    : []
  const legacyEquipmentIds = Array.isArray(body.equipmentIds) ? body.equipmentIds.map(Number).filter(Number.isFinite) : []

  const excludeBodyRegionIds = Array.isArray(body.excludeBodyRegionIds)
    ? body.excludeBodyRegionIds.map(Number).filter(Number.isFinite)
    : []
  const avoidExerciseSlugs = Array.isArray(body.avoidExerciseSlugs ?? body.avoid_exercise_slugs)
    ? (body.avoidExerciseSlugs ?? body.avoid_exercise_slugs).map(String)
    : []
  const avoidExerciseIds = Array.isArray(body.avoidExerciseIds ?? body.avoid_exercise_ids)
    ? (body.avoidExerciseIds ?? body.avoid_exercise_ids).map(Number).filter(Number.isFinite)
    : []

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
    params.push(level)
    where.push(`(e.skill_level IS NULL OR e.skill_level = $${params.length}::public.skill_level)`)
  }
  if (ageMin != null) {
    params.push(ageMin)
    where.push(`(e.age_max IS NULL OR e.age_max >= $${params.length})`)
    where.push(`NOT EXISTS (
      SELECT 1 FROM coaching.exercise_difficulty_profile d
      WHERE d.exercise_id = e.id
        AND e.programming_kind = 'exercise'
        AND d.recommended_age_min IS NOT NULL AND d.recommended_age_min > $${params.length}
    )`)
  }
  if (ageMax != null) {
    params.push(ageMax)
    where.push(`(e.age_min IS NULL OR e.age_min <= $${params.length})`)
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
  const useEquip = new Set(equipmentUseIds)
  const avoidEquip = new Set([...equipmentAvoidIds, ...legacyEquipmentIds])
  const usedPatterns = new Map()
  const sessionWarnings = new Set()
  const usedExerciseIds = new Set()

  const scored = candidates.rows
    .map((ex) => {
      const tags = tagMap.get(String(ex.id)) ?? []
      const equipTags = tags.filter((t) => t.facetType === 'equipment')

      if (avoidEquip.size > 0 && equipTags.some((t) => avoidEquip.has(t.facetId))) return null

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

      if (hardDifficultyExclude && !isSkillDrill && !difficultyWithinCaps(difficulty, caps, true)) return null

      if (strengthIntent && primary?.phaseKey === 'capacity') score += 4
      if (strengthIntent && (primary?.impactLevel ?? 99) <= 1) score += 2

      const ageMultiplier = isSkillDrill ? 1 : scoreAgeDifficultyFit(difficulty, caps)
      score *= ageMultiplier

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

  const splitProfiles = audienceSplits.length > 0
    ? audienceSplits.map((split) => {
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
        return { label: split.label || `Ages ${split.ageMin}-${split.ageMax}`, caps: profile.caps, scalingCohort: profile.scalingCohort }
      })
    : []

  const resultBlocks = []
  const phaseRationales = []

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
    const budgetSeconds = (Number(block.minutes) || 20) * 60
    const phaseTargets = Array.isArray(block.focusTargets ?? block.focus_targets)
      ? (block.focusTargets ?? block.focus_targets)
      : []
    const resolvedPhaseTargets = await resolveTargetFacetIds(pool, phaseTargets)

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

    const poolForPhase = scored
      .map((c) => {
        const profile = c.profiles.find((p) => p.phaseKey === phaseKey && p.role !== 'avoid')
        if (!profile) return null

        let phaseTargetScore = scoreTargets(c.tags, resolvedPhaseTargets)
        for (const t of resolvedPhaseTargets) {
          if (t.facetType === 'order_slot' && t.facetKey) {
            if (matchesOrderSlot(c.exercise, profile, t.facetKey)) phaseTargetScore += 8
          }
        }

        let phaseFit = profile.fitWeight * 2
        if (profile.role === 'primary') phaseFit += 6
        else if (profile.role === 'secondary') phaseFit += 2
        else if (profile.role === 'conditional') phaseFit *= 0.75

        const patternId = c.tags.find((t) => t.facetType === 'pattern')?.facetId
        const penalty = patternId && usedPatterns.get(patternId) ? 0.25 : 0
        let adjScore = (c.score + phaseFit + phaseTargetScore) * (1 - Math.min(penalty, 0.75))
        if (strengthIntent && phaseKey === 'capacity') adjScore *= 1.15
        return { ...c, adjScore, profile, phaseTargetScore }
      })
      .filter(Boolean)
      .sort((a, b) => b.adjScore - a.adjScore)

    const items = []
    let usedSeconds = 0

    for (const c of poolForPhase) {
      if (usedExerciseIds.has(Number(c.exercise.id))) continue
      const cost = itemSecondsFromExercise(c.exercise, {})
      if (usedSeconds + cost > budgetSeconds && items.length > 0) continue

      const eduEx = await loadEducationForExercise(pool, Number(c.exercise.id), c.exercise.slug)
      const why = educationToWhyResponse(eduEx)
      const cohortScaling = scalingGuidanceForCohort(c.scalingProfiles, scalingCohort)

      const perSplit = []
      for (const split of splitProfiles) {
        const fits = difficultyWithinCaps(c.difficulty, split.caps, true)
        if (fits) {
          perSplit.push({
            split_label: split.label,
            exercise_id: Number(c.exercise.id),
            exercise_name: c.exercise.name,
            difficulty: c.difficulty,
          })
        } else {
          const alt = pickSplitAlternate(poolForPhase, Number(c.exercise.id), split.caps, true)
          if (alt) {
            perSplit.push({
              split_label: split.label,
              exercise_id: Number(alt.exercise.id),
              exercise_name: alt.exercise.name,
              difficulty: alt.difficulty,
              substituted: true,
            })
          }
        }
      }

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
        selection_rationale: why?.training_purpose ?? `Selected for ${phase?.name ?? phaseKey} (score ${c.score.toFixed(1)}).`,
        placement_rationale: why?.phase_rationale ?? c.profile.notes ?? `Placed in ${phase?.name ?? phaseKey} based on phase fit.`,
        scaling_rationale: cohortScaling ?? why?.scaling_rationale ?? null,
      })
      usedSeconds += cost
      usedExerciseIds.add(Number(c.exercise.id))
      const patternTag = c.tags.find((t) => t.facetType === 'pattern')
      if (patternTag) usedPatterns.set(patternTag.facetId, (usedPatterns.get(patternTag.facetId) || 0) + 1)
      if (usedSeconds >= budgetSeconds) break
    }

    resultBlocks.push({
      label: block.label || phase?.name || 'Block',
      phase_key: phaseKey,
      phase_id: phase?.id ?? null,
      focus_targets: phaseTargets,
      target_minutes: Number(block.minutes) || 20,
      estimated_minutes: Math.round(usedSeconds / 60),
      items,
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
