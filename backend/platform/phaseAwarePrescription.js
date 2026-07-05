import { loadExerciseProgrammingBundle, attachProgrammingToExercise } from './exerciseProgramming.js'
import { loadEducationForExercise, educationToWhyResponse } from './educationContent.js'

function itemSecondsFromExercise(ex, item) {
  const sets = Number(item?.sets ?? ex.default_sets) || 3
  const work = Number(item?.work_seconds ?? ex.default_work_seconds) || Number(ex.est_seconds_per_set) || 45
  const rest = Number(item?.rest_seconds ?? ex.default_rest_seconds) || 30
  return sets * work + sets * rest
}

export async function runPhaseAwarePrescription(pool, facilityId, body) {
  const sportId = body.sportId != null ? Number(body.sportId) : null
  const level = body.skillLevel || body.skill_level || null
  const ageMin = body.ageMin != null ? Number(body.ageMin) : null
  const ageMax = body.ageMax != null ? Number(body.ageMax) : null
  const equipmentIds = Array.isArray(body.equipmentIds) ? body.equipmentIds.map(Number).filter(Number.isFinite) : []
  const excludeBodyRegionIds = Array.isArray(body.excludeBodyRegionIds)
    ? body.excludeBodyRegionIds.map(Number).filter(Number.isFinite)
    : []
  const targets = Array.isArray(body.targets)
    ? body.targets.filter((t) => t.facetId != null || t.facetKey || t.key)
    : []
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
      return { exercise: ex, tags, score, profiles, bundleRow: attachProgrammingToExercise(ex, bundle, null) }
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)

  const resultBlocks = []
  const phaseRationales = []

  for (const block of phasePlan) {
    const phaseKey = block.phaseKey ?? block.phase_key ?? block.phase
    const phase = phaseByKey.get(phaseKey)
    const budgetSeconds = (Number(block.minutes) || 20) * 60
    const intentId = block.intentId != null ? Number(block.intentId) : (block.intent_id != null ? Number(block.intent_id) : null)
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
        if (intentId) {
          const intentMatch = c.tags.some((t) => t.facetType === 'intent' && t.facetId === intentId)
          if (!intentMatch) return null
        }
        let phaseFit = profile.fitWeight * 2
        if (profile.role === 'primary') phaseFit += 6
        else if (profile.role === 'secondary') phaseFit += 2
        else if (profile.role === 'conditional') phaseFit *= 0.75
        const patternId = c.tags.find((t) => t.facetType === 'pattern')?.facetId
        const penalty = patternId && usedPatterns.get(patternId) ? 0.25 : 0
        return { ...c, adjScore: (c.score + phaseFit) * (1 - Math.min(penalty, 0.75)), profile }
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
        selection_rationale: why?.training_purpose ?? `Selected for ${phase?.name ?? phaseKey} (score ${c.score.toFixed(1)}).`,
        placement_rationale: why?.phase_rationale ?? c.profile.notes ?? `Placed in ${phase?.name ?? phaseKey} based on phase fit.`,
        scaling_rationale: why?.scaling_rationale ?? null,
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
      intentId: block.intentId ?? null,
      target_minutes: Number(block.minutes) || 20,
      estimated_minutes: Math.round(usedSeconds / 60),
      items,
    })
  }

  return {
    blocks: resultBlocks,
    phase_rationales: phaseRationales,
    candidates: scored.slice(0, 40).map((c) => ({
      exercise_id: Number(c.exercise.id),
      exercise_name: c.exercise.name,
      score: Number(c.score.toFixed(2)),
      est_seconds_per_set: Number(c.exercise.est_seconds_per_set),
      primary_phase: c.profiles.find((p) => p.role === 'primary')?.phaseKey ?? null,
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
