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
    if (target.facetId != null) {
      resolved.push(target)
      continue
    }
    const key = target.facetKey ?? target.key
    if (!key || !target.facetType) continue
    const tableMap = {
      tenet: 'tenet',
      methodology: 'methodology',
      physiology: 'physiological_emphasis',
    }
    const table = tableMap[target.facetType]
    if (!table) continue
    const row = await pool.query(`SELECT id FROM coaching.${table} WHERE key = $1 LIMIT 1`, [String(key)])
    if (row.rows[0]?.id) {
      resolved.push({ ...target, facetId: Number(row.rows[0].id) })
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

export async function runPhaseAwarePrescription(pool, facilityId, body) {
  const audience = resolveAudienceProfile({
    ageMin: body.ageMin ?? body.age_min,
    ageMax: body.ageMax ?? body.age_max,
    skillLevel: body.skillLevel ?? body.skill_level,
    sessionObjective: body.sessionObjective ?? body.session_objective,
    targets: body.targets,
    prompt: body.prompt,
  })

  const sportId = body.sportId != null ? Number(body.sportId) : null
  const level = body.skillLevel || body.skill_level || audience.impliedSkillLevel || null
  const ageMin = audience.ageMin
  const ageMax = audience.ageMax
  const caps = audience.caps
  const strengthIntent = audience.strengthIntent
  const scalingCohort = audience.scalingCohort

  const equipmentIds = Array.isArray(body.equipmentIds) ? body.equipmentIds.map(Number).filter(Number.isFinite) : []
  const excludeBodyRegionIds = Array.isArray(body.excludeBodyRegionIds)
    ? body.excludeBodyRegionIds.map(Number).filter(Number.isFinite)
    : []
  const rawTargets = Array.isArray(body.targets) ? body.targets : audience.targets ?? []
  const targets = await resolveTargetFacetIds(pool, rawTargets.filter((t) => t.facetId != null || t.facetKey || t.key))

  const phasePlan = Array.isArray(body.phasePlan) && body.phasePlan.length > 0
    ? body.phasePlan
    : Array.isArray(body.blocks) && body.blocks.length > 0
      ? body.blocks
      : [{ phaseKey: 'capacity', label: 'Main Work', minutes: 30 }]

  const phaseRows = await pool.query(`SELECT id, key, name FROM coaching.session_phase`)
  const phaseByKey = new Map(phaseRows.rows.map((p) => [p.key, p]))

  const params = [facilityId]
  const where = [`e.facility_id = $1`, `e.archived = FALSE`, `e.is_published = TRUE`]
  if (sportId) {
    params.push(sportId)
    where.push(`(e.sport_id = $${params.length} OR e.sport_id IS NULL)`)
  }
  if (level) {
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
  const allowedEquip = new Set(equipmentIds)
  const usedPatterns = new Map()
  const sessionWarnings = new Set()

  const scored = candidates.rows
    .map((ex) => {
      const tags = tagMap.get(String(ex.id)) ?? []
      if (allowedEquip.size > 0) {
        const equip = tags.filter((t) => t.facetType === 'equipment')
        if (equip.some((t) => !allowedEquip.has(t.facetId))) return null
      }
      let score = 0
      for (const target of targets) {
        const facetId = target.facetId != null ? Number(target.facetId) : null
        if (facetId == null) continue
        const match = tags.find((t) => t.facetType === target.facetType && t.facetId === facetId)
        if (match) score += match.weight * (Number(target.weight) || 3)
      }
      const profiles = bundle.phaseProfiles.get(String(ex.id)) ?? []
      const difficulty = bundle.difficultyProfiles?.get(String(ex.id)) ?? null
      const primary = profiles.find((p) => p.role === 'primary') ?? profiles[0]
      const isSkillDrill = ex.programming_kind === 'skill_drill'

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

  const resultBlocks = []
  const phaseRationales = []

  for (const block of phasePlan) {
    const phaseKey = block.phaseKey ?? block.phase_key ?? block.phase
    const phase = phaseByKey.get(phaseKey)
    const budgetSeconds = (Number(block.minutes) || 20) * 60
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
        let phaseFit = profile.fitWeight * 2
        if (profile.role === 'primary') phaseFit += 6
        else if (profile.role === 'secondary') phaseFit += 2
        else if (profile.role === 'conditional') phaseFit *= 0.75
        const patternId = c.tags.find((t) => t.facetType === 'pattern')?.facetId
        const penalty = patternId && usedPatterns.get(patternId) ? 0.25 : 0
        let adjScore = (c.score + phaseFit) * (1 - Math.min(penalty, 0.75))
        if (strengthIntent && phaseKey === 'capacity') adjScore *= 1.15
        return { ...c, adjScore, profile }
      })
      .filter(Boolean)
      .sort((a, b) => b.adjScore - a.adjScore)

    const items = []
    let usedSeconds = 0

    for (const c of poolForPhase) {
      const cost = itemSecondsFromExercise(c.exercise, {})
      if (usedSeconds + cost > budgetSeconds && items.length > 0) continue

      const eduEx = await loadEducationForExercise(pool, Number(c.exercise.id), c.exercise.slug)
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
        selection_rationale: why?.training_purpose ?? `Selected for ${phase?.name ?? phaseKey} (score ${c.score.toFixed(1)}).`,
        placement_rationale: why?.phase_rationale ?? c.profile.notes ?? `Placed in ${phase?.name ?? phaseKey} based on phase fit.`,
        scaling_rationale: cohortScaling ?? why?.scaling_rationale ?? null,
      })
      usedSeconds += cost
      const patternTag = c.tags.find((t) => t.facetType === 'pattern')
      if (patternTag) usedPatterns.set(patternTag.facetId, (usedPatterns.get(patternTag.facetId) || 0) + 1)
      if (usedSeconds >= budgetSeconds) break
    }

    resultBlocks.push({
      label: block.label || phase?.name || 'Block',
      phase_key: phaseKey,
      phase_id: phase?.id ?? null,
      target_minutes: Number(block.minutes) || 20,
      estimated_minutes: Math.round(usedSeconds / 60),
      items,
    })
  }

  return {
    blocks: resultBlocks,
    phase_rationales: phaseRationales,
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
